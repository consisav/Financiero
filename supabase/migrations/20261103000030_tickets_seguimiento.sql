-- Tickets · Seguimiento (maestro - detalle): observaciones de seguimiento de cada ticket.
-- La fecha y hora y el usuario que escribe la observación se graban solos; las observaciones
-- no se modifican ni se borran (quedan como bitácora del ticket).
-- Escribir: administrador, quien creó el ticket o el recurso asignado.
-- Requiere el script 21. Puede ejecutarse de nuevo.

create table if not exists public.ticket_seguimientos (
  id          bigint generated always as identity primary key,
  ticket_id   bigint not null references public.tickets (id) on delete cascade,
  observacion text not null check (length(trim(observacion)) > 0),
  fecha       timestamptz not null default now(),
  perfil_id   uuid references public.perfiles (id),
  usuario     text
);
create index if not exists ticket_seguimientos_ticket_idx on public.ticket_seguimientos (ticket_id, fecha desc);

create or replace function public.preparar_seguimiento() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.fecha := now();
  new.perfil_id := (select auth.uid());
  new.usuario := coalesce((select upper(p.usuario) from public.perfiles p where p.id = new.perfil_id), 'SISTEMA');
  new.observacion := trim(new.observacion);
  return new;
end;
$$;
drop trigger if exists ticket_seguimientos_preparar on public.ticket_seguimientos;
create trigger ticket_seguimientos_preparar before insert on public.ticket_seguimientos
  for each row execute function public.preparar_seguimiento();
revoke execute on function public.preparar_seguimiento() from public, anon, authenticated;

alter table public.ticket_seguimientos enable row level security;
drop policy if exists "ticket_seguimientos: leer" on public.ticket_seguimientos;
drop policy if exists "ticket_seguimientos: crear" on public.ticket_seguimientos;
create policy "ticket_seguimientos: leer" on public.ticket_seguimientos for select to authenticated using (public.usuario_activo());
create policy "ticket_seguimientos: crear" on public.ticket_seguimientos for insert to authenticated with check (public.puede_editar_ticket(ticket_id));

notify pgrst, 'reload schema';
