-- Contabilidad · Catálogos · Tipos de cambio: actualización automática programada.
--   tasas_programacion (una sola fila): si está activa, frecuencia DIARIA, SEMANAL o MENSUAL, día de la semana
--     (semanal y mensual), semana del mes (mensual: 1.ª a 4.ª, 5 = última) y hora (hora de Guatemala), como el
--     backup programado (script 109; usa su función backup_siguiente para calcular el próximo).
--   pg_cron revisa cada minuto (trabajo «financiero-tasas-programado») y, cuando llega la hora, graba la compra y
--     venta de todas las monedas con referencia de Banco Industrial: la misma función del botón «Tasa cambio
--     actual» (script 18), aunque nadie esté conectado.
--   tasas_ejecuciones: el resultado de cada actualización automática o de prueba: EXITOSO (con las tasas
--     grabadas) o ERROR (con el detalle del problema, por ejemplo si la página de Banco Industrial no respondió).
--   Puede ejecutarse de nuevo.
-- Se ejecuta después del script 110 (y requiere el 109).

create extension if not exists pg_cron;

create table if not exists public.tasas_programacion (
  id              smallint primary key default 1 check (id = 1),
  activo          boolean not null default false,
  frecuencia      text not null default 'DIARIA' check (frecuencia in ('DIARIA', 'SEMANAL', 'MENSUAL')),
  dia_semana      smallint check (dia_semana between 1 and 7),
  semana_mes      smallint check (semana_mes between 1 and 5),
  hora            time not null default '07:00',
  proximo         timestamptz,
  ultimo          timestamptz,
  ultimo_estado   text,
  ultimo_detalle  text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
insert into public.tasas_programacion (id) values (1) on conflict (id) do nothing;

create or replace function public.preparar_tasas_programacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.frecuencia in ('SEMANAL', 'MENSUAL') and new.dia_semana is null then
    raise exception 'Indica el día de la semana de la actualización %.', lower(new.frecuencia);
  end if;
  if new.frecuencia = 'MENSUAL' and new.semana_mes is null then new.semana_mes := 1; end if;
  if new.frecuencia = 'DIARIA' then new.dia_semana := null; new.semana_mes := null; end if;
  if new.frecuencia = 'SEMANAL' then new.semana_mes := null; end if;
  if tg_op = 'INSERT' or new.activo is distinct from old.activo or new.frecuencia is distinct from old.frecuencia
     or new.dia_semana is distinct from old.dia_semana or new.semana_mes is distinct from old.semana_mes or new.hora is distinct from old.hora then
    new.proximo := case when new.activo then public.backup_siguiente(new.frecuencia, new.dia_semana, new.semana_mes, new.hora, now()) end;
  end if;
  return new;
end;
$$;
drop trigger if exists tasas_programacion_preparar on public.tasas_programacion;
create trigger tasas_programacion_preparar before insert or update on public.tasas_programacion
  for each row execute function public.preparar_tasas_programacion();
drop trigger if exists tasas_programacion_auditar on public.tasas_programacion;
create trigger tasas_programacion_auditar before insert or update on public.tasas_programacion
  for each row execute function public.auditar();

alter table public.tasas_programacion enable row level security;
drop policy if exists "tasas_programacion: leer" on public.tasas_programacion;
drop policy if exists "tasas_programacion: modificar" on public.tasas_programacion;
create policy "tasas_programacion: leer" on public.tasas_programacion for select to authenticated using (public.usuario_activo());
create policy "tasas_programacion: modificar" on public.tasas_programacion for update to authenticated
  using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());
grant select, update on public.tasas_programacion to authenticated;

create table if not exists public.tasas_ejecuciones (
  id         bigint generated always as identity primary key,
  inicio     timestamptz not null default now(),
  fin        timestamptz,
  origen     text not null default 'AUTOMÁTICO' check (origen in ('AUTOMÁTICO', 'PRUEBA')),
  usuario    text,
  estado     text not null default 'EN PROCESO' check (estado in ('EN PROCESO', 'EXITOSO', 'ERROR')),
  detalle    text,
  monedas    jsonb
);
create index if not exists tasas_ejecuciones_inicio_idx on public.tasas_ejecuciones (inicio desc);
alter table public.tasas_ejecuciones enable row level security;
drop policy if exists "tasas_ejecuciones: leer" on public.tasas_ejecuciones;
create policy "tasas_ejecuciones: leer" on public.tasas_ejecuciones for select to authenticated using (public.usuario_activo());
grant select on public.tasas_ejecuciones to authenticated;

-- La función del botón (script 18) acepta también al proceso automático (sin usuario de la app).
do $f$
declare d text; n text;
begin
  d := pg_get_functiondef('public.actualizar_tasas_banco_industrial()'::regprocedure);
  if position('fin.tasas_automatico' in d) > 0 then return; end if;
  n := replace(d, 'if not public.puede_editar_catalogos() then',
    'if not public.puede_editar_catalogos() and coalesce(current_setting(''fin.tasas_automatico'', true), '''') <> ''si'' then');
  if n = d then raise exception 'No se encontró la validación de permisos en actualizar_tasas_banco_industrial (script 18).'; end if;
  execute n;
end;
$f$;

-- Ejecuta la actualización si ya es la hora (o si p_forzar). La llama pg_cron cada minuto y «Probar ahora».
create or replace function public.ejecutar_tasas_programado(p_forzar boolean default false) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  p public.tasas_programacion;
  v_id bigint;
  v_res jsonb;
  v_msg text;
  v_usd jsonb;
begin
  select * into p from public.tasas_programacion where id = 1 for update skip locked;
  if p.id is null then return 'ocupado'; end if;
  if not p_forzar and (not p.activo or p.proximo is null or p.proximo > now()) then return 'no toca'; end if;
  insert into public.tasas_ejecuciones (origen, usuario) values (case when p_forzar then 'PRUEBA' else 'AUTOMÁTICO' end,
    coalesce((select upper(usuario) from public.perfiles where id = (select auth.uid())), 'AUTOMÁTICO'))
  returning id into v_id;
  begin
    perform set_config('fin.tasas_automatico', 'si', true);
    v_res := public.actualizar_tasas_banco_industrial();
    perform set_config('fin.tasas_automatico', '', true);
    select x into v_usd from jsonb_array_elements(v_res -> 'monedas') x where x ->> 'iso' = 'USD';
    update public.tasas_ejecuciones set fin = clock_timestamp(), estado = 'EXITOSO', monedas = v_res -> 'monedas',
      detalle = format('%s monedas actualizadas%s%s', jsonb_array_length(coalesce(v_res -> 'monedas', '[]'::jsonb)),
        case when v_usd is not null then format(' · Dólar: compra Q%s · venta Q%s', v_usd ->> 'compra', v_usd ->> 'venta') else '' end,
        case when v_res ->> 'cotizacion_bi' is not null then ' · cotización de Banco Industrial ' || (v_res ->> 'cotizacion_bi') else '' end)
    where id = v_id;
  exception when others then
    get stacked diagnostics v_msg = message_text;
    perform set_config('fin.tasas_automatico', '', true);
    update public.tasas_ejecuciones set fin = clock_timestamp(), estado = 'ERROR', detalle = v_msg where id = v_id;
  end;
  update public.tasas_programacion set ultimo = now(),
    ultimo_estado = (select estado from public.tasas_ejecuciones where id = v_id),
    ultimo_detalle = (select detalle from public.tasas_ejecuciones where id = v_id),
    -- Una prueba no mueve la próxima actualización programada.
    proximo = case when p_forzar then proximo when activo then public.backup_siguiente(frecuencia, dia_semana, semana_mes, hora, greatest(now(), coalesce(proximo, now()))) end
  where id = 1;
  return (select estado from public.tasas_ejecuciones where id = v_id);
end;
$$;
revoke execute on function public.ejecutar_tasas_programado(boolean) from public, anon, authenticated;

create or replace function public.probar_tasas_programado() returns text
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede probar la actualización automática.'; end if;
  return public.ejecutar_tasas_programado(true);
end;
$$;
revoke execute on function public.probar_tasas_programado() from public, anon;
grant execute on function public.probar_tasas_programado() to authenticated;

do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'financiero-tasas-programado') then
    perform cron.unschedule('financiero-tasas-programado');
  end if;
  perform cron.schedule('financiero-tasas-programado', '* * * * *', 'select public.ejecutar_tasas_programado()');
end;
$cron$;

notify pgrst, 'reload schema';
