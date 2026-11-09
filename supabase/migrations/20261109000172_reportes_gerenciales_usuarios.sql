-- 172 · Reportes gerenciales: una configuración por localidad y módulo con los usuarios a los que se aplica.
--   usuarios:     ids de los usuarios del sistema marcados (a cada uno se le generan en su sesión).
--   ejecuciones:  { "<id del usuario>": "<fecha y hora de su última generación automática>" }.
--   En reportes (jsonb) cada reporte lleva además su prioridad (1 … n): el orden de la lista y de la generación.
--   Las configuraciones por usuario del script 171 se juntan en una por localidad y módulo (la más reciente, con
--   todos sus usuarios).
-- Se ejecuta después del script 171.

alter table public.reportes_gerenciales add column if not exists usuarios uuid[] not null default '{}';
alter table public.reportes_gerenciales add column if not exists ejecuciones jsonb not null default '{}';
alter table public.reportes_gerenciales alter column perfil_id drop not null;
alter table public.reportes_gerenciales drop constraint if exists reportes_gerenciales_localidad_id_modulo_perfil_id_key;
drop index if exists public.reportes_gerenciales_prox;

update public.reportes_gerenciales set usuarios = array[perfil_id] where perfil_id is not null and usuarios = '{}';
with g as (
  select localidad_id, modulo, max(id) as queda, array_agg(distinct u) as us
  from public.reportes_gerenciales, unnest(usuarios) u group by 1, 2
)
update public.reportes_gerenciales r set usuarios = g.us from g where r.id = g.queda;
delete from public.reportes_gerenciales r
 where exists (select 1 from public.reportes_gerenciales x where x.localidad_id = r.localidad_id and x.modulo = r.modulo and x.id > r.id);
update public.reportes_gerenciales set perfil_id = null;

create unique index if not exists reportes_gerenciales_un on public.reportes_gerenciales (localidad_id, modulo);
create index if not exists reportes_gerenciales_usuarios on public.reportes_gerenciales using gin (usuarios);

drop policy if exists "reportes_gerenciales: leer" on public.reportes_gerenciales;
drop policy if exists "reportes_gerenciales: escribir" on public.reportes_gerenciales;
-- Los administradores ven y definen todas; cada usuario, las que se le aplican.
create policy "reportes_gerenciales: leer" on public.reportes_gerenciales for select to authenticated
  using (public.usuario_activo() and ((select auth.uid()) = any (usuarios) or public.puede_editar_catalogos()));
create policy "reportes_gerenciales: escribir" on public.reportes_gerenciales for all to authenticated
  using (public.usuario_activo() and public.puede_editar_catalogos())
  with check (public.usuario_activo() and public.puede_editar_catalogos());

-- Marca la generación automática del usuario actual solo si nadie la marcó antes (una sola sesión la toma).
create or replace function public.marcar_reporte_gerencial(p_id bigint, p_previa text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_uid text := (select auth.uid())::text; n int;
begin
  update public.reportes_gerenciales
     set ejecuciones = ejecuciones || jsonb_build_object(v_uid, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
         ultima_ejecucion = now()
   where id = p_id and (select auth.uid()) = any (usuarios) and activo
     and (ejecuciones ->> v_uid) is not distinct from p_previa;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;
revoke execute on function public.marcar_reporte_gerencial(bigint, text) from public, anon;
grant execute on function public.marcar_reporte_gerencial(bigint, text) to authenticated;
