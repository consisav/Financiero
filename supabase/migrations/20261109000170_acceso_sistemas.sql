-- 170 · Acceso Sistemas: módulos a los que tiene acceso cada organización y cada localidad (empresa).
--   Administración · Catálogos · Parámetros · Acceso Sistemas. Solo el Super Administrador Global la ve y la modifica.
--   Una fila por organización (localidad_id nulo) y, si se quiere distinto, una por localidad:
--     * la localidad con fila propia usa sus módulos;
--     * la localidad sin fila propia usa los de su organización;
--     * sin ninguna fila, todos los módulos (como hasta ahora).
--   modulos: ids de los módulos permitidos (los de menu.js: contabilidad, caja-bancos, facturacion, …).
--   Administración siempre queda disponible para poder administrar la empresa.
-- Se ejecuta después del script 99 (es_superadmin_global).

create table if not exists public.acceso_sistemas (
  id bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones(id) on delete cascade,
  localidad_id bigint references public.localidades(id) on delete cascade,
  modulos text[] not null default '{}',
  creado_en timestamptz not null default now(),
  modificado_en timestamptz,
  modificado_por text
);
create unique index if not exists acceso_sistemas_un on public.acceso_sistemas (organizacion_id, coalesce(localidad_id, 0));

alter table public.acceso_sistemas enable row level security;
drop policy if exists "acceso_sistemas: leer" on public.acceso_sistemas;
drop policy if exists "acceso_sistemas: escribir" on public.acceso_sistemas;
-- Cada usuario activo lee el acceso (el menú lo necesita para mostrar los módulos de su empresa).
create policy "acceso_sistemas: leer" on public.acceso_sistemas for select to authenticated using (public.usuario_activo());
create policy "acceso_sistemas: escribir" on public.acceso_sistemas for all to authenticated
  using (public.es_superadmin_global()) with check (public.es_superadmin_global());
grant select, insert, update, delete on public.acceso_sistemas to authenticated;

-- Módulos permitidos para una localidad (null = todos).
create or replace function public.modulos_permitidos(p_localidad bigint) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select a.modulos from public.acceso_sistemas a where a.localidad_id = p_localidad),
    (select a.modulos from public.acceso_sistemas a join public.localidades l on l.organizacion_id = a.organizacion_id
      where l.id = p_localidad and a.localidad_id is null));
$$;
revoke execute on function public.modulos_permitidos(bigint) from public, anon;
grant execute on function public.modulos_permitidos(bigint) to authenticated;
