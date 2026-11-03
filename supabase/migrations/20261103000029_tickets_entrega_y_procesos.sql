-- Tickets · Asignación:
--   Fecha estimada de entrega de la asignación (también queda en el ticket).
--   Procesos de la solución (detalle de la asignación): número correlativo por ticket,
--   descripción, fecha estimada de entrega, usuario responsable (por defecto el recurso asignado),
--   estado (Asignado, En proceso, Finalizado), fecha del estado (se graba sola al cambiar el
--   estado) y observaciones.
-- Procesos: los crea y modifica un administrador, quien creó el ticket o el recurso asignado;
-- el responsable de un proceso puede actualizar su estado y observaciones.
-- Requiere el script 28. Puede ejecutarse de nuevo.

alter table public.ticket_asignaciones add column if not exists fecha_entrega date;
alter table public.tickets add column if not exists fecha_entrega date;

create or replace function public.aplicar_asignacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.tickets
  set recurso_id = new.recurso_id,
      asignado_en = new.fecha,
      asignado_por = new.asignado_por,
      fecha_entrega = new.fecha_entrega,
      estado = case when estado < 3 then 3 else estado end
  where id = new.ticket_id;
  return null;
end;
$$;

create or replace function public.proteger_asignacion_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() = 1 then
    new.asignado_en := old.asignado_en;
    new.asignado_por := old.asignado_por;
    new.fecha_entrega := old.fecha_entrega;
  end if;
  return new;
end;
$$;

-- ---------- Procesos de la solución ----------
create table if not exists public.ticket_procesos (
  id             bigint generated always as identity primary key,
  ticket_id      bigint not null references public.tickets (id) on delete cascade,
  numero         integer not null,
  descripcion    text not null check (length(trim(descripcion)) > 0),
  fecha_entrega  date,
  responsable_id uuid references public.perfiles (id),
  estado         text not null default 'ASIGNADO' check (estado in ('ASIGNADO', 'EN PROCESO', 'FINALIZADO')),
  fecha_estado   timestamptz not null default now(),
  observaciones  text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (ticket_id, numero)
);
create index if not exists ticket_procesos_responsable_idx on public.ticket_procesos (responsable_id);

create or replace function public.preparar_proceso() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  t public.tickets;
begin
  if tg_op = 'UPDATE' then
    new.ticket_id := old.ticket_id;
    new.numero := old.numero;
    new.fecha_estado := case when new.estado is distinct from old.estado then now() else old.fecha_estado end;
  else
    perform pg_advisory_xact_lock(4803, new.ticket_id::integer);
    new.numero := coalesce((select max(numero) from public.ticket_procesos where ticket_id = new.ticket_id), 0) + 1;
    new.fecha_estado := now();
  end if;
  select * into t from public.tickets where id = new.ticket_id;
  if tg_op = 'INSERT' and new.responsable_id is null then
    new.responsable_id := t.recurso_id;
  end if;
  if new.responsable_id is not null and new.responsable_id is distinct from (case when tg_op = 'UPDATE' then old.responsable_id end)
     and not exists (select 1 from public.perfiles p where p.id = new.responsable_id and p.activo
                     and p.organizacion_id = t.organizacion_id and p.localidad_id = t.localidad_id) then
    raise exception 'El responsable debe ser un usuario activo de la misma organización y localidad del ticket.';
  end if;
  new.descripcion := trim(new.descripcion);
  new.observaciones := nullif(trim(new.observaciones), '');
  return new;
end;
$$;
drop trigger if exists ticket_procesos_preparar on public.ticket_procesos;
create trigger ticket_procesos_preparar before insert or update on public.ticket_procesos
  for each row execute function public.preparar_proceso();
drop trigger if exists ticket_procesos_auditar on public.ticket_procesos;
create trigger ticket_procesos_auditar before insert or update on public.ticket_procesos
  for each row execute function public.auditar();

alter table public.ticket_procesos enable row level security;
drop policy if exists "ticket_procesos: leer" on public.ticket_procesos;
drop policy if exists "ticket_procesos: crear" on public.ticket_procesos;
drop policy if exists "ticket_procesos: modificar" on public.ticket_procesos;
drop policy if exists "ticket_procesos: quitar" on public.ticket_procesos;
create policy "ticket_procesos: leer" on public.ticket_procesos for select to authenticated using (public.usuario_activo());
create policy "ticket_procesos: crear" on public.ticket_procesos for insert to authenticated with check (public.puede_editar_ticket(ticket_id));
create policy "ticket_procesos: modificar" on public.ticket_procesos for update to authenticated
  using (public.puede_editar_ticket(ticket_id) or (public.usuario_activo() and responsable_id = (select auth.uid())))
  with check (public.usuario_activo());
create policy "ticket_procesos: quitar" on public.ticket_procesos for delete to authenticated using (public.puede_editar_catalogos());

revoke execute on function public.preparar_proceso() from public, anon, authenticated;

notify pgrst, 'reload schema';
