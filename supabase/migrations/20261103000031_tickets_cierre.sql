-- Tickets · Cierre (maestro - detalle).
--   Por cada ticket se registra su cierre: usuario que entrega, usuario que recibe, tipo de
--   pruebas o de cierre, observaciones y archivos adjuntos con las pruebas.
--   Al grabar, el ticket pasa a CERRADO y se graban solos la fecha y hora de cierre (hasta los
--   segundos) y el usuario que lo cerró. Un ticket se cierra una sola vez.
-- Los usuarios que entregan y reciben deben ser usuarios activos de la organización y localidad
-- del ticket. Cerrar: administrador, quien creó el ticket o el recurso asignado.
-- Requiere los scripts 21 y 28. Puede ejecutarse de nuevo.

alter table public.tickets
  add column if not exists cerrado_en  timestamptz,
  add column if not exists cerrado_por text;

create table if not exists public.ticket_cierres (
  id            bigint generated always as identity primary key,
  ticket_id     bigint not null unique references public.tickets (id) on delete cascade,
  fecha         timestamptz not null default now(),
  entrega_id    uuid not null references public.perfiles (id),
  recibe_id     uuid not null references public.perfiles (id),
  tipo          text not null check (tipo in ('PRUEBAS DE USUARIO', 'PRUEBAS TÉCNICAS', 'PRUEBAS INTEGRALES', 'CIERRE ADMINISTRATIVO', 'CIERRE SIN SOLUCIÓN')),
  observaciones text,
  cerrado_por_id uuid references public.perfiles (id),
  cerrado_por   text
);

-- Los adjuntos del cierre (pruebas) se guardan con los demás adjuntos del ticket.
alter table public.ticket_adjuntos add column if not exists cierre_id bigint references public.ticket_cierres (id) on delete cascade;

create or replace function public.preparar_cierre() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  t public.tickets;
begin
  select * into t from public.tickets where id = new.ticket_id;
  if t.estado = 7 then
    raise exception 'El ticket % ya está cerrado.', t.numero;
  end if;
  if exists (select 1 from unnest(array[new.entrega_id, new.recibe_id]) u
             where not exists (select 1 from public.perfiles p where p.id = u and p.activo
                               and p.organizacion_id = t.organizacion_id and p.localidad_id = t.localidad_id)) then
    raise exception 'Los usuarios que entregan y reciben deben ser usuarios activos de la organización y localidad del ticket.';
  end if;
  new.fecha := now();
  new.cerrado_por_id := (select auth.uid());
  new.cerrado_por := coalesce((select upper(p.usuario) from public.perfiles p where p.id = new.cerrado_por_id), 'SISTEMA');
  new.observaciones := nullif(trim(new.observaciones), '');
  return new;
end;
$$;
drop trigger if exists ticket_cierres_preparar on public.ticket_cierres;
create trigger ticket_cierres_preparar before insert on public.ticket_cierres
  for each row execute function public.preparar_cierre();

-- El ticket pasa a CERRADO con la fecha de cierre (queda también en el historial de estados).
create or replace function public.aplicar_cierre() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.tickets set estado = 7, cerrado_en = new.fecha, cerrado_por = new.cerrado_por where id = new.ticket_id;
  return null;
end;
$$;
drop trigger if exists ticket_cierres_aplicar on public.ticket_cierres;
create trigger ticket_cierres_aplicar after insert on public.ticket_cierres
  for each row execute function public.aplicar_cierre();

-- Las columnas de asignación, entrega y cierre del ticket solo las cambian sus procesos.
create or replace function public.proteger_asignacion_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() = 1 then
    new.asignado_en := old.asignado_en;
    new.asignado_por := old.asignado_por;
    new.fecha_entrega := old.fecha_entrega;
    new.cerrado_en := old.cerrado_en;
    new.cerrado_por := old.cerrado_por;
    -- Un ticket se cierra desde Tickets · Cierre, y cerrado ya no cambia de estado.
    if new.estado = 7 and old.estado <> 7 then
      raise exception 'Para cerrar el ticket % usa Tickets · Cierre (registra quién entrega, quién recibe y las pruebas).', old.numero;
    end if;
    if old.estado = 7 and new.estado <> 7 then
      raise exception 'El ticket % está cerrado y ya no cambia de estado.', old.numero;
    end if;
  end if;
  return new;
end;
$$;

alter table public.ticket_cierres enable row level security;
drop policy if exists "ticket_cierres: leer" on public.ticket_cierres;
drop policy if exists "ticket_cierres: crear" on public.ticket_cierres;
create policy "ticket_cierres: leer" on public.ticket_cierres for select to authenticated using (public.usuario_activo());
create policy "ticket_cierres: crear" on public.ticket_cierres for insert to authenticated with check (public.puede_editar_ticket(ticket_id));

revoke execute on function public.preparar_cierre() from public, anon, authenticated;
revoke execute on function public.aplicar_cierre() from public, anon, authenticated;

notify pgrst, 'reload schema';
