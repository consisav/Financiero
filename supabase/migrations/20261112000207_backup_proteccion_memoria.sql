-- Script 207 · Backup automático: evitar que reinicie el servidor.
--   El backup programado (script 109) arma el respaldo de toda la base en memoria dentro de una sola transacción. Con los datos
--   migrados el servidor se queda sin memoria y se reinicia; como el backup no termina, su próximo horario no avanza y pg_cron lo
--   vuelve a lanzar al minuto siguiente: el servidor se reiniciaba cada 2 minutos y las tablas quedaban tomadas.
--   Ahora, antes de generar el respaldo:
--     1) si un intento anterior de ese mismo horario falló (el servidor se reinició), no lo repite: lo registra como ERROR y pasa
--        al próximo horario;
--     2) si las tablas ocupan más de 150 MB, no lo intenta: lo registra como ERROR con la indicación de usar los respaldos diarios
--        de Supabase o el backup manual por organización o localidad.
--   No reactiva el trabajo de pg_cron: si se pausó con pausar_backup_programado.sql, se reactiva con la línea del final de ese archivo.
--   Se puede ejecutar de nuevo.

create or replace function public.ejecutar_backup_programado(p_forzar boolean default false) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  p public.backup_programacion;
  v_id bigint;
  v_res record;
  v_archivo text;
  v_resp bigint;
  v_msg text; v_ctx text;
  v_alcance text;
  v_motivo text;
  v_tam bigint;
begin
  select * into p from public.backup_programacion where id = 1 for update skip locked;
  if p.id is null then return 'ocupado'; end if;
  if not p_forzar and (not p.activo or p.proximo is null or p.proximo > now()) then return 'no toca'; end if;

  -- Protección 1: si un intento anterior de este mismo horario se interrumpió porque el servidor se reinició
  --   (el backup se quedó sin memoria), no se repite cada minuto: se registra el error y pasa al próximo horario.
  if not p_forzar and exists (
      select 1 from cron.job_run_details d join cron.job j on j.jobid = d.jobid
      where j.jobname = 'financiero-backup-programado' and d.start_time >= p.proximo and d.status = 'failed') then
    v_motivo := 'Un intento anterior de este backup se interrumpió porque el servidor se reinició (probablemente sin memoria suficiente '
      || 'para generar el respaldo completo). No se repite; queda para el próximo horario. Use los respaldos diarios de Supabase '
      || 'o limite el alcance a una organización o localidad.';
  end if;
  -- Protección 2: el respaldo se arma completo en memoria; si las tablas pasan del límite, no se intenta.
  if v_motivo is null then
    select coalesce(sum(pg_table_size(c.oid)), 0) into v_tam
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname not in ('respaldos_automaticos', 'respaldos');
    if v_tam > 150 * 1024 * 1024 then
      v_motivo := format('Las tablas ocupan %s y el backup automático en el servidor admite hasta 150 MB: generarlo podría dejar al '
        || 'servidor sin memoria. Use los respaldos diarios de Supabase (Database › Backups) o el backup manual por organización o localidad.',
        pg_catalog.pg_size_pretty(v_tam));
    end if;
  end if;
  if v_motivo is not null then
    insert into public.respaldos_automaticos (programado_para, organizacion_id, localidad_id, fin, estado, detalle)
    values (case when p_forzar then now() else p.proximo end, p.organizacion_id, p.localidad_id, clock_timestamp(), 'ERROR', v_motivo)
    returning id into v_id;
    insert into public.respaldos (organizacion_id, localidad_id, archivo, ruta, tablas, registros, bytes, origen, estado, detalle, automatico_id)
    values (p.organizacion_id, p.localidad_id, '(sin archivo)', 'SERVIDOR (Supabase)', 0, 0, 0, 'AUTOMÁTICO', 'ERROR', v_motivo, v_id)
    returning id into v_resp;
    update public.respaldos_automaticos set respaldo_id = v_resp where id = v_id;
    update public.backup_programacion set ultimo = now(), ultimo_estado = 'ERROR', ultimo_detalle = v_motivo,
      proximo = case when p_forzar then proximo when activo then public.backup_siguiente(frecuencia, dia_semana, semana_mes, hora, greatest(now(), coalesce(proximo, now()))) end
    where id = 1;
    return 'ERROR';
  end if;
  insert into public.respaldos_automaticos (programado_para, organizacion_id, localidad_id) values (case when p_forzar then now() else p.proximo end, p.organizacion_id, p.localidad_id)
  returning id into v_id;
  select coalesce((select 'org' || codigo from public.organizaciones where id = p.organizacion_id), 'TODAS') || '_' ||
         coalesce((select 'loc' || codigo from public.localidades where id = p.localidad_id), 'TODAS') into v_alcance;
  v_archivo := format('backup_bd_%s_%s_auto.sql', v_alcance, to_char(now() at time zone 'America/Guatemala', 'YYYYMMDD_HH24MISS'));
  begin
    select * into v_res from public.respaldo_sql(p.organizacion_id, p.localidad_id);
    update public.respaldos_automaticos set fin = clock_timestamp(), estado = 'EXITOSO', archivo = v_archivo, tablas = v_res.tablas, registros = v_res.registros,
      bytes = octet_length(v_res.sql), contenido = v_res.sql,
      detalle = format('%s tablas · %s registros · generado en el servidor; se copia a la carpeta al abrir la app.', v_res.tablas, v_res.registros)
    where id = v_id;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_ctx = pg_exception_context;
    update public.respaldos_automaticos set fin = clock_timestamp(), estado = 'ERROR', detalle = v_msg || coalesce(E'\n' || v_ctx, '') where id = v_id;
  end;
  insert into public.respaldos (organizacion_id, localidad_id, archivo, ruta, tablas, registros, bytes, origen, estado, detalle, automatico_id)
  select organizacion_id, localidad_id, coalesce(archivo, '(sin archivo)'), 'SERVIDOR (Supabase)', tablas, registros, bytes, 'AUTOMÁTICO', estado, detalle, id
  from public.respaldos_automaticos where id = v_id returning id into v_resp;
  update public.respaldos_automaticos set respaldo_id = v_resp where id = v_id;
  update public.backup_programacion set ultimo = now(), ultimo_estado = (select estado from public.respaldos_automaticos where id = v_id),
    ultimo_detalle = (select detalle from public.respaldos_automaticos where id = v_id),
    -- Una prueba («Probar ahora») no mueve el próximo backup programado.
    proximo = case when p_forzar then proximo when activo then public.backup_siguiente(frecuencia, dia_semana, semana_mes, hora, greatest(now(), coalesce(proximo, now()))) end
  where id = 1;
  -- Solo los últimos 3 conservan el contenido.
  update public.respaldos_automaticos set contenido = null
  where contenido is not null and id not in (select id from public.respaldos_automaticos where contenido is not null order by inicio desc limit 3);
  return (select estado from public.respaldos_automaticos where id = v_id);
end;
$$;
revoke execute on function public.ejecutar_backup_programado(boolean) from public, anon, authenticated;

notify pgrst, 'reload schema';
