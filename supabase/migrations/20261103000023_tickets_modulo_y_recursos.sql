-- Tickets:
--   Módulo del sistema al que corresponde el requerimiento (módulos principales de
--   Catálogos · Módulos). Vacío = todos los módulos (valor por defecto).
--   Recurso asignado: solo se ofrecen y se aceptan usuarios activos de la misma organización y
--   localidad del ticket.
-- Requiere el script 21. Puede ejecutarse de nuevo.

alter table public.tickets add column if not exists modulo_id bigint references public.modulos_sistema (id);
create index if not exists tickets_modulo_id_idx on public.tickets (modulo_id);

-- Usuarios activos de la organización y localidad de quien consulta.
create or replace function public.recursos_ticket() returns table (id uuid, usuario text, nombre text)
language sql stable security definer set search_path = '' as $$
  select p.id, upper(p.usuario), p.nombre
  from public.perfiles p
  join public.perfiles yo on yo.id = (select auth.uid())
  where p.activo and yo.activo
    and p.organizacion_id = yo.organizacion_id and p.localidad_id = yo.localidad_id
  order by p.nombre;
$$;

-- El recurso asignado debe pertenecer a la organización y localidad del ticket, y el módulo
-- debe ser un módulo principal.
create or replace function public.validar_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.recurso_id is not null and new.recurso_id is distinct from (case when tg_op = 'UPDATE' then old.recurso_id end)
     and not exists (
       select 1 from public.perfiles p
       where p.id = new.recurso_id and p.activo
         and p.organizacion_id = new.organizacion_id and p.localidad_id = new.localidad_id) then
    raise exception 'El recurso asignado debe ser un usuario activo de la misma organización y localidad del ticket.';
  end if;
  if new.modulo_id is not null and not exists (
       select 1 from public.modulos_sistema m where m.id = new.modulo_id and m.modulo_mayor_id is null) then
    raise exception 'Selecciona un módulo principal del sistema.';
  end if;
  return new;
end;
$$;
-- Se ejecuta después de tickets_preparar (orden alfabético), cuando ya tiene organización y localidad.
drop trigger if exists tickets_validar on public.tickets;
create trigger tickets_validar before insert or update on public.tickets
  for each row execute function public.validar_ticket();
revoke execute on function public.validar_ticket() from public, anon, authenticated;

notify pgrst, 'reload schema';
