-- Tickets · Asignación (maestro - detalle).
--   Maestro: tickets filtrados por organización, localidad, rango de fechas, módulo y prioridad.
--   Detalle: se asigna el recurso (usuario) con observaciones; la fecha y hora de asignación
--   (hasta los segundos) y el usuario que asigna se graban solos y no se pueden alterar.
-- Cada asignación queda en ticket_asignaciones (historial) y actualiza el ticket: su recurso
-- asignado, la fecha y quién asignó, y lo pasa a ASIGNADO si estaba en Registrado o En revisión.
-- El recurso debe ser un usuario activo de la organización y localidad del ticket (script 23).
-- Asignar: administrador. Requiere los scripts 21 y 23. Puede ejecutarse de nuevo.

alter table public.tickets
  add column if not exists asignado_en  timestamptz,
  add column if not exists asignado_por text;

create table if not exists public.ticket_asignaciones (
  id              bigint generated always as identity primary key,
  ticket_id       bigint not null references public.tickets (id) on delete cascade,
  recurso_id      uuid not null references public.perfiles (id),
  observaciones   text,
  fecha           timestamptz not null default now(),
  asignado_por_id uuid references public.perfiles (id),
  asignado_por    text
);
create index if not exists ticket_asignaciones_ticket_idx on public.ticket_asignaciones (ticket_id, fecha desc);

-- Fecha y usuario que asigna, automáticos.
create or replace function public.preparar_asignacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.fecha := now();
  new.asignado_por_id := (select auth.uid());
  new.asignado_por := coalesce((select upper(p.usuario) from public.perfiles p where p.id = new.asignado_por_id), 'SISTEMA');
  new.observaciones := nullif(trim(new.observaciones), '');
  return new;
end;
$$;
drop trigger if exists ticket_asignaciones_preparar on public.ticket_asignaciones;
create trigger ticket_asignaciones_preparar before insert on public.ticket_asignaciones
  for each row execute function public.preparar_asignacion();

-- La asignación pasa al ticket (valida que el recurso sea de su organización y localidad).
create or replace function public.aplicar_asignacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.tickets
  set recurso_id = new.recurso_id,
      asignado_en = new.fecha,
      asignado_por = new.asignado_por,
      estado = case when estado < 3 then 3 else estado end
  where id = new.ticket_id;
  return null;
end;
$$;
drop trigger if exists ticket_asignaciones_aplicar on public.ticket_asignaciones;
create trigger ticket_asignaciones_aplicar after insert on public.ticket_asignaciones
  for each row execute function public.aplicar_asignacion();

-- Usuarios activos de una localidad, para elegir el recurso del ticket de esa localidad.
create or replace function public.recursos_localidad(p_localidad bigint) returns table (id uuid, usuario text, nombre text)
language sql stable security definer set search_path = '' as $$
  select p.id, upper(p.usuario), p.nombre
  from public.perfiles p
  where p.activo and p.localidad_id = p_localidad and public.usuario_activo()
  order by p.nombre;
$$;

alter table public.ticket_asignaciones enable row level security;
drop policy if exists "ticket_asignaciones: leer" on public.ticket_asignaciones;
drop policy if exists "ticket_asignaciones: crear" on public.ticket_asignaciones;
create policy "ticket_asignaciones: leer" on public.ticket_asignaciones for select to authenticated using (public.usuario_activo());
create policy "ticket_asignaciones: crear" on public.ticket_asignaciones for insert to authenticated with check (public.puede_editar_catalogos());

revoke execute on function public.preparar_asignacion() from public, anon, authenticated;
revoke execute on function public.aplicar_asignacion() from public, anon, authenticated;
revoke execute on function public.recursos_localidad(bigint) from public, anon;
grant execute on function public.recursos_localidad(bigint) to authenticated;

-- Las columnas de asignación del ticket solo las cambia una asignación.
create or replace function public.proteger_asignacion_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() = 1 then
    new.asignado_en := old.asignado_en;
    new.asignado_por := old.asignado_por;
  end if;
  return new;
end;
$$;
drop trigger if exists tickets_proteger_asignacion on public.tickets;
create trigger tickets_proteger_asignacion before update on public.tickets
  for each row execute function public.proteger_asignacion_ticket();
revoke execute on function public.proteger_asignacion_ticket() from public, anon, authenticated;

notify pgrst, 'reload schema';
