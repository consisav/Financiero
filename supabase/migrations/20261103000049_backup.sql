-- Administración · Procesos · Backup: respaldo de la información por organización y localidad.
--   respaldo_filtro(tabla, org, loc): condición que deja en una tabla solo las filas de la
--     organización o localidad pedidas: por su columna localidad_id u organizacion_id, o por la
--     llave foránea hacia una tabla que sí la tiene (hasta 3 niveles). Las tablas generales del
--     sistema (monedas, bancos, países, roles…) se respaldan completas.
--   respaldo_tablas(org, loc): tablas con la cantidad de filas que entran en el respaldo.
--   respaldo_datos(tabla, org, loc, desde, cantidad): filas de una tabla en páginas (JSON).
--   Organización y localidad nulas = todas, solo para administradores; los demás usuarios solo
--   pueden respaldar su organización y su localidad.
--   respaldos: historial de cada respaldo generado (quién, cuándo, alcance, archivo, ruta).
-- Se ejecuta después del script 48.

-- ---------- Permiso ----------
create or replace function public.respaldo_permitido(p_org bigint, p_loc bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.usuario_activo() and (
    public.es_admin()
    or exists (select 1 from public.perfiles p
               where p.id = (select auth.uid()) and p.organizacion_id = p_org and p.localidad_id = p_loc)
  );
$$;

-- ---------- Filtro por organización / localidad ----------
create or replace function public.respaldo_filtro(p_tabla text, p_org bigint, p_loc bigint, p_nivel integer default 0) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_loc boolean;
  v_org boolean;
  v_org_efectiva bigint := coalesce(p_org, (select organizacion_id from public.localidades where id = p_loc));
  fk record;
  v_padre text;
begin
  if p_org is null and p_loc is null then return 'true'; end if;
  if p_tabla = 'organizaciones' then return format('id = %s', v_org_efectiva); end if;
  if p_tabla = 'localidades' then
    return case when p_loc is not null then format('id = %s', p_loc) else format('organizacion_id = %s', v_org_efectiva) end;
  end if;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_tabla and column_name = 'localidad_id'),
         exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_tabla and column_name = 'organizacion_id')
    into v_loc, v_org;
  if p_loc is not null and v_loc then return format('localidad_id = %s', p_loc); end if;
  if v_org then return format('organizacion_id = %s', v_org_efectiva); end if;
  if v_loc then return format('localidad_id in (select id from public.localidades where organizacion_id = %s)', v_org_efectiva); end if;
  if p_nivel >= 3 then return 'true'; end if;
  -- Sin columnas propias: por la primera llave foránea hacia una tabla de la organización.
  for fk in
    select a.attname as columna, p.relname as padre, pa.attname as columna_padre
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_class p on p.oid = k.confrelid
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    join pg_attribute pa on pa.attrelid = k.confrelid and pa.attnum = k.confkey[1]
    where n.nspname = 'public' and c.relname = p_tabla and k.contype = 'f'
      and array_length(k.conkey, 1) = 1 and p.relname <> p_tabla
    order by a.attnum
  loop
    v_padre := public.respaldo_filtro(fk.padre, p_org, p_loc, p_nivel + 1);
    if v_padre <> 'true' then
      return format('%I in (select %I from public.%I where %s)', fk.columna, fk.columna_padre, fk.padre, v_padre);
    end if;
  end loop;
  return 'true';   -- tabla general del sistema
end;
$$;

-- ---------- Tablas y filas del respaldo ----------
create or replace function public.respaldo_tablas(p_org bigint, p_loc bigint)
returns table (tabla text, filas bigint, general boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  t record;
  v_filtro text;
begin
  if not public.respaldo_permitido(p_org, p_loc) then
    raise exception 'Solo un administrador puede respaldar otras organizaciones o todas; tú puedes respaldar tu organización y tu localidad.';
  end if;
  for t in select table_name::text as nombre from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name loop
    v_filtro := public.respaldo_filtro(t.nombre, p_org, p_loc);
    tabla := t.nombre;
    general := v_filtro = 'true' and (p_org is not null or p_loc is not null);
    execute format('select count(*) from public.%I where %s', t.nombre, v_filtro) into filas;
    return next;
  end loop;
end;
$$;

create or replace function public.respaldo_datos(p_tabla text, p_org bigint, p_loc bigint, p_desde integer default 0, p_cantidad integer default 1000)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
begin
  if not public.respaldo_permitido(p_org, p_loc) then
    raise exception 'Solo un administrador puede respaldar otras organizaciones o todas.';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' and table_name = p_tabla) then
    raise exception 'La tabla % no existe.', p_tabla;
  end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (select * from public.%I where %s order by 1 limit %s offset %s) t',
                 p_tabla, public.respaldo_filtro(p_tabla, p_org, p_loc), least(greatest(p_cantidad, 1), 5000), greatest(p_desde, 0))
    into v;
  return v;
end;
$$;

-- ---------- Historial de respaldos ----------
create table if not exists public.respaldos (
  id              bigint generated always as identity primary key,
  organizacion_id bigint references public.organizaciones (id),
  localidad_id    bigint references public.localidades (id),
  usuario         text,
  fecha           timestamptz not null default now(),
  archivo         text not null,
  ruta            text,
  tablas          integer not null default 0,
  registros       bigint not null default 0,
  bytes           bigint not null default 0,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create index if not exists respaldos_fecha_idx on public.respaldos (fecha desc);

create or replace function public.preparar_respaldo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.usuario := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
  new.fecha := now();
  return new;
end;
$$;
drop trigger if exists respaldos_preparar on public.respaldos;
create trigger respaldos_preparar before insert on public.respaldos for each row execute function public.preparar_respaldo();
drop trigger if exists respaldos_auditar on public.respaldos;
create trigger respaldos_auditar before insert or update on public.respaldos for each row execute function public.auditar();

alter table public.respaldos enable row level security;
drop policy if exists "respaldos: leer" on public.respaldos;
drop policy if exists "respaldos: crear" on public.respaldos;
create policy "respaldos: leer" on public.respaldos for select to authenticated
  using (public.es_admin() or organizacion_id = (select p.organizacion_id from public.perfiles p where p.id = (select auth.uid())));
create policy "respaldos: crear" on public.respaldos for insert to authenticated
  with check (public.respaldo_permitido(organizacion_id, localidad_id));

revoke execute on function public.respaldo_filtro(text, bigint, bigint, integer) from public, anon, authenticated;
revoke execute on function public.preparar_respaldo() from public, anon, authenticated;
revoke execute on function public.respaldo_permitido(bigint, bigint) from public, anon;
revoke execute on function public.respaldo_tablas(bigint, bigint) from public, anon;
revoke execute on function public.respaldo_datos(text, bigint, bigint, integer, integer) from public, anon;
grant execute on function public.respaldo_permitido(bigint, bigint) to authenticated;
grant execute on function public.respaldo_tablas(bigint, bigint) to authenticated;
grant execute on function public.respaldo_datos(text, bigint, bigint, integer, integer) to authenticated;
grant select, insert on public.respaldos to authenticated;

-- ---------- Menú: Administración · Procesos · Backup ----------
insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
select m.id, 'procesos', 'Procesos', 'backup', 'Backup', coalesce((select max(orden) from public.opciones_sistema), 0) + 1
from public.modulos_sistema m
where m.siglas = 'ADM' and m.modulo_mayor_id is null
  and not exists (select 1 from public.opciones_sistema o where o.clave = 'backup' and o.modulo_id = m.id);

notify pgrst, 'reload schema';
