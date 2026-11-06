-- Administración · Procesos · Backup programado (automático).
--   backup_programacion (una sola fila): si está activo, frecuencia DIARIA, SEMANAL o MENSUAL, día de la
--     semana (1 = lunes … 7 = domingo; semanal y mensual), semana del mes (mensual: 1.ª a 4.ª, 5 = última),
--     hora de ejecución (hora de Guatemala), alcance (organización y localidad; vacías = todas), próximo
--     backup y resultado del último.
--   pg_cron revisa cada minuto (trabajo «financiero-backup-programado») y, cuando llega la hora, genera en el
--     servidor el backup de la base de datos con el mismo formato SQL que el backup manual (se restaura en el
--     SQL Editor), aunque nadie esté conectado. Queda en respaldos_automaticos con su resultado: EXITOSO, o
--     ERROR con el detalle del problema. La app lo copia a la carpeta de destino (comprimido .sql.gz) al
--     abrirse en la computadora que tiene la carpeta elegida.
--   El historial (respaldos) agrega origen (MANUAL / AUTOMÁTICO), estado y detalle del resultado.
--   Se guardan los últimos 3 backups automáticos con su contenido (unos 14 MB cada uno sin comprimir); los
--   anteriores conservan solo su resultado (su archivo ya quedó en la carpeta).
--   Requiere la extensión pg_cron (incluida en Supabase): se habilita aquí si no lo está.
-- Se ejecuta después del script 108.

create extension if not exists pg_cron;

-- ---------- Programación ----------
create table if not exists public.backup_programacion (
  id              smallint primary key default 1 check (id = 1),
  activo          boolean not null default false,
  frecuencia      text not null default 'DIARIA' check (frecuencia in ('DIARIA', 'SEMANAL', 'MENSUAL')),
  dia_semana      smallint check (dia_semana between 1 and 7),
  semana_mes      smallint check (semana_mes between 1 and 5),
  hora            time not null default '22:00',
  organizacion_id bigint references public.organizaciones (id),
  localidad_id    bigint references public.localidades (id),
  proximo         timestamptz,
  ultimo          timestamptz,
  ultimo_estado   text,
  ultimo_detalle  text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
insert into public.backup_programacion (id) values (1) on conflict (id) do nothing;

-- Siguiente ejecución después de p_desde, en hora de Guatemala.
create or replace function public.backup_siguiente(p_frecuencia text, p_dia smallint, p_semana smallint, p_hora time, p_desde timestamptz default now())
returns timestamptz language plpgsql stable set search_path = '' as $$
declare
  v_hoy date := (p_desde at time zone 'America/Guatemala')::date;
  v_fecha date;
  v_mes date;
  v_ts timestamptz;
  i integer;
begin
  if p_frecuencia = 'DIARIA' then
    for i in 0..1 loop
      v_ts := ((v_hoy + i) + p_hora) at time zone 'America/Guatemala';
      if v_ts > p_desde then return v_ts; end if;
    end loop;
  elsif p_frecuencia = 'SEMANAL' then
    for i in 0..7 loop
      v_fecha := v_hoy + i;
      if extract(isodow from v_fecha) = coalesce(p_dia, 1) then
        v_ts := (v_fecha + p_hora) at time zone 'America/Guatemala';
        if v_ts > p_desde then return v_ts; end if;
      end if;
    end loop;
  elsif p_frecuencia = 'MENSUAL' then
    for i in 0..2 loop
      v_mes := (date_trunc('month', v_hoy) + make_interval(months => i))::date;
      -- Primer día del mes con ese día de la semana.
      v_fecha := v_mes + ((coalesce(p_dia, 1) - extract(isodow from v_mes)::integer + 7) % 7);
      if coalesce(p_semana, 1) = 5 then
        while (v_fecha + 7) < (v_mes + interval '1 month')::date loop v_fecha := v_fecha + 7; end loop;
      else
        v_fecha := v_fecha + 7 * (coalesce(p_semana, 1) - 1);
      end if;
      v_ts := (v_fecha + p_hora) at time zone 'America/Guatemala';
      if v_ts > p_desde then return v_ts; end if;
    end loop;
  end if;
  return null;
end;
$$;

create or replace function public.preparar_backup_programacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.frecuencia in ('SEMANAL', 'MENSUAL') and new.dia_semana is null then
    raise exception 'Indica el día de la semana del backup %.', lower(new.frecuencia);
  end if;
  if new.frecuencia = 'MENSUAL' and new.semana_mes is null then new.semana_mes := 1; end if;
  if new.frecuencia = 'DIARIA' then new.dia_semana := null; new.semana_mes := null; end if;
  if new.frecuencia = 'SEMANAL' then new.semana_mes := null; end if;
  if new.localidad_id is not null then
    select organizacion_id into new.organizacion_id from public.localidades where id = new.localidad_id;
  end if;
  -- El próximo se recalcula al cambiar la programación (no cuando el proceso registra su resultado).
  if tg_op = 'INSERT' or new.activo is distinct from old.activo or new.frecuencia is distinct from old.frecuencia
     or new.dia_semana is distinct from old.dia_semana or new.semana_mes is distinct from old.semana_mes or new.hora is distinct from old.hora then
    new.proximo := case when new.activo then public.backup_siguiente(new.frecuencia, new.dia_semana, new.semana_mes, new.hora, now()) end;
  end if;
  return new;
end;
$$;
drop trigger if exists backup_programacion_preparar on public.backup_programacion;
create trigger backup_programacion_preparar before insert or update on public.backup_programacion
  for each row execute function public.preparar_backup_programacion();
drop trigger if exists backup_programacion_auditar on public.backup_programacion;
create trigger backup_programacion_auditar before insert or update on public.backup_programacion
  for each row execute function public.auditar();

alter table public.backup_programacion enable row level security;
drop policy if exists "backup_programacion: leer" on public.backup_programacion;
drop policy if exists "backup_programacion: modificar" on public.backup_programacion;
create policy "backup_programacion: leer" on public.backup_programacion for select to authenticated using (public.es_admin());
create policy "backup_programacion: modificar" on public.backup_programacion for update to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());
grant select, update on public.backup_programacion to authenticated;

-- ---------- Backups automáticos y su resultado ----------
create table if not exists public.respaldos_automaticos (
  id              bigint generated always as identity primary key,
  programado_para timestamptz,
  inicio          timestamptz not null default now(),
  fin             timestamptz,
  estado          text not null default 'EN PROCESO' check (estado in ('EN PROCESO', 'EXITOSO', 'ERROR')),
  detalle         text,
  organizacion_id bigint references public.organizaciones (id),
  localidad_id    bigint references public.localidades (id),
  archivo         text,
  tablas          integer not null default 0,
  registros       bigint not null default 0,
  bytes           bigint not null default 0,
  contenido       text,
  copiado_en      timestamptz,
  copiado_por     text,
  copiado_ruta    text,
  respaldo_id     bigint references public.respaldos (id) on delete set null
);
create index if not exists respaldos_automaticos_inicio_idx on public.respaldos_automaticos (inicio desc);
alter table public.respaldos_automaticos enable row level security;
drop policy if exists "respaldos_automaticos: leer" on public.respaldos_automaticos;
create policy "respaldos_automaticos: leer" on public.respaldos_automaticos for select to authenticated using (public.es_admin());
grant select on public.respaldos_automaticos to authenticated;

alter table public.respaldos add column if not exists origen text not null default 'MANUAL';
alter table public.respaldos add column if not exists estado text not null default 'EXITOSO';
alter table public.respaldos add column if not exists detalle text;
alter table public.respaldos add column if not exists automatico_id bigint;

-- Columnas que se pueden insertar al restaurar una tabla (sin las calculadas, que la base recalcula). La usan el
-- backup del servidor y el manual de la pantalla: antes el INSERT llevaba todas y fallaba en tablas con columnas
-- calculadas (por ejemplo costo_total de los artículos de compras).
create or replace function public.respaldo_columnas(p_tabla text) returns text[]
language sql stable security definer set search_path = '' as $$
  select array_agg(column_name::text order by ordinal_position) from information_schema.columns
  where table_schema = 'public' and table_name = p_tabla and is_generated = 'NEVER';
$$;
revoke execute on function public.respaldo_columnas(text) from public, anon;
grant execute on function public.respaldo_columnas(text) to authenticated;

-- Respaldo SQL en el servidor: el mismo formato del backup manual (un INSERT por cada 500 filas de cada tabla).
create or replace function public.respaldo_sql(p_org bigint, p_loc bigint, out sql text, out tablas integer, out registros bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare
  t record;
  v_filtro text;
  v_n bigint;
  v_json jsonb;
  v_desde integer;
  v_cols text;
  partes text[] := '{}';
  o public.organizaciones;
  l public.localidades;
begin
  select * into o from public.organizaciones where id = coalesce(p_org, (select organizacion_id from public.localidades where id = p_loc));
  select * into l from public.localidades where id = p_loc;
  tablas := 0; registros := 0;
  for t in select table_name::text as nombre from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'
           and table_name not in ('respaldos_automaticos') order by table_name loop
    v_filtro := public.respaldo_filtro(t.nombre, p_org, p_loc);
    execute format('select count(*) from public.%I where %s', t.nombre, v_filtro) into v_n;
    tablas := tablas + 1;
    if v_n = 0 then
      partes := array_append(partes, format(E'\n-- %s: sin registros\n', t.nombre));
      continue;
    end if;
    partes := array_append(partes, format(E'\n-- %s: %s registros%s', t.nombre, v_n, case when v_filtro = 'true' and (p_org is not null or p_loc is not null) then ' (tabla general)' else '' end));
    -- Solo las columnas que se pueden insertar (las calculadas, como costo_total, se recalculan solas).
    v_cols := (select string_agg(quote_ident(c), ', ') from unnest(public.respaldo_columnas(t.nombre)) c);
    v_desde := 0;
    while v_desde < v_n loop
      execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (select * from public.%I where %s order by 1 limit 500 offset %s) x', t.nombre, v_filtro, v_desde) into v_json;
      partes := array_append(partes, format(E'\ninsert into public.%I (%s) overriding system value select %s from jsonb_populate_recordset(null::public.%I, %L::jsonb) on conflict do nothing;', t.nombre, v_cols, v_cols, t.nombre, v_json::text));
      v_desde := v_desde + 500;
    end loop;
    partes := array_append(partes, E'\n');
    registros := registros + v_n;
  end loop;
  sql := concat_ws(E'\n',
    '-- Backup de la base de datos · Financiero CONSISAV (Supabase) · AUTOMÁTICO',
    format('-- Generado: %s (hora de Guatemala) · proceso programado', to_char(now() at time zone 'America/Guatemala', 'DD/MM/YYYY HH24:MI:SS')),
    format('-- Organización: %s · Localidad: %s', coalesce(o.codigo || ' · ' || o.nombre, 'TODAS'), coalesce(l.codigo || ' · ' || l.nombre_comercial, 'TODAS')),
    format('-- Tablas: %s', tablas),
    '-- Restaurar: abrir el SQL Editor del proyecto en Supabase, pegar este archivo y ejecutarlo.',
    '-- La estructura (tablas y funciones) se crea con los scripts de supabase/migrations.',
    '', 'begin;', 'set session_replication_role = replica;', '')
    || array_to_string(partes, '') || E'\nset session_replication_role = origin;\ncommit;\n';
end;
$$;
revoke execute on function public.respaldo_sql(bigint, bigint) from public, anon, authenticated;

-- Ejecuta el backup si ya es la hora (o si p_forzar). La llama pg_cron cada minuto y el botón «Probar ahora».
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
begin
  select * into p from public.backup_programacion where id = 1 for update skip locked;
  if p.id is null then return 'ocupado'; end if;
  if not p_forzar and (not p.activo or p.proximo is null or p.proximo > now()) then return 'no toca'; end if;
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

-- Desde la pantalla: probar el backup ahora (Super Administrador) y marcar un backup como copiado a la carpeta.
create or replace function public.probar_backup_programado() returns text
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.es_superadmin() then raise exception 'Solo el Super Administrador puede probar el backup automático.'; end if;
  return public.ejecutar_backup_programado(true);
end;
$$;
create or replace function public.backup_copiado(p_id bigint, p_ruta text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.es_admin() then raise exception 'Solo un administrador copia los backups automáticos.'; end if;
  update public.respaldos_automaticos set copiado_en = now(), copiado_ruta = nullif(trim(p_ruta), ''),
    copiado_por = coalesce((select upper(usuario) from public.perfiles where id = (select auth.uid())), 'SISTEMA')
  where id = p_id;
  update public.respaldos set ruta = coalesce(nullif(trim(p_ruta), ''), ruta) where automatico_id = p_id;
end;
$$;
revoke execute on function public.probar_backup_programado() from public, anon;
revoke execute on function public.backup_copiado(bigint, text) from public, anon;
grant execute on function public.probar_backup_programado() to authenticated;
grant execute on function public.backup_copiado(bigint, text) to authenticated;
-- El contenido (el SQL) se lee aparte, solo el del backup que se copia.
create or replace function public.backup_automatico_contenido(p_id bigint) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_admin() then raise exception 'Solo un administrador descarga los backups automáticos.'; end if;
  return (select contenido from public.respaldos_automaticos where id = p_id);
end;
$$;
revoke execute on function public.backup_automatico_contenido(bigint) from public, anon;
grant execute on function public.backup_automatico_contenido(bigint) to authenticated;

-- ---------- Trabajo de pg_cron: cada minuto revisa si toca el backup ----------
do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'financiero-backup-programado') then
    perform cron.unschedule('financiero-backup-programado');
  end if;
  perform cron.schedule('financiero-backup-programado', '* * * * *', 'select public.ejecutar_backup_programado()');
end;
$cron$;

notify pgrst, 'reload schema';
