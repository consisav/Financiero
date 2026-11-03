-- Tickets: botones Modificar y Eliminar en Generación, Asignación, Seguimiento y Cierre.
--   Eliminar: solo el Super Administrador. Borra el ticket con todo lo suyo (asignaciones,
--   procesos, seguimiento, cierre, historial y adjuntos; los archivos los quita la pantalla).
--   Modificar:
--     Asignación   la asignación vigente (usuario, fecha estimada de entrega, observaciones);
--                  un administrador. Su fecha y quién asignó no cambian.
--     Seguimiento  una observación: quien la escribió o un administrador.
--     Cierre       el cierre registrado (quién entrega, quién recibe, tipo y observaciones):
--                  un administrador, quien creó el ticket o el recurso asignado. La fecha de
--                  cierre y quién cerró no cambian.
--   Cada modificación graba quién y cuándo la modificó.
-- Requiere los scripts 28 a 31. Puede ejecutarse de nuevo.

-- ---------- Eliminar ----------
create or replace function public.eliminar_ticket(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_numero text;
begin
  if not public.es_superadmin() then
    raise exception 'Solo el Super Administrador puede eliminar tickets.';
  end if;
  delete from public.tickets where id = p_id returning numero into v_numero;
  if v_numero is null then raise exception 'El ticket no existe.'; end if;
  return jsonb_build_object('numero', v_numero);
end;
$$;
revoke execute on function public.eliminar_ticket(bigint) from public, anon;
grant execute on function public.eliminar_ticket(bigint) to authenticated;

-- ---------- Modificar la asignación vigente ----------
alter table public.ticket_asignaciones
  add column if not exists modificado_por text,
  add column if not exists modificado_en  timestamptz;

create or replace function public.preparar_asignacion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  t public.tickets;
begin
  if tg_op = 'UPDATE' then
    new.ticket_id := old.ticket_id;
    new.fecha := old.fecha;
    new.asignado_por_id := old.asignado_por_id;
    new.asignado_por := old.asignado_por;
    if new.id <> (select max(a.id) from public.ticket_asignaciones a where a.ticket_id = old.ticket_id) then
      raise exception 'Solo se puede modificar la asignación vigente del ticket.';
    end if;
    if new.recurso_id is distinct from old.recurso_id then
      select * into t from public.tickets where id = old.ticket_id;
      if not exists (select 1 from public.perfiles p where p.id = new.recurso_id and p.activo
                     and p.organizacion_id = t.organizacion_id and p.localidad_id = t.localidad_id) then
        raise exception 'El recurso asignado debe ser un usuario activo de la misma organización y localidad del ticket.';
      end if;
    end if;
    new.modificado_en := now();
    new.modificado_por := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
  else
    new.fecha := now();
    new.asignado_por_id := (select auth.uid());
    new.asignado_por := coalesce((select upper(p.usuario) from public.perfiles p where p.id = new.asignado_por_id), 'SISTEMA');
    new.modificado_por := null;
    new.modificado_en := null;
  end if;
  new.observaciones := nullif(trim(new.observaciones), '');
  return new;
end;
$$;
drop trigger if exists ticket_asignaciones_preparar on public.ticket_asignaciones;
create trigger ticket_asignaciones_preparar before insert or update on public.ticket_asignaciones
  for each row execute function public.preparar_asignacion();

-- La asignación vigente modificada pasa al ticket (recurso y fecha de entrega).
create or replace function public.aplicar_asignacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    update public.tickets set recurso_id = new.recurso_id, fecha_entrega = new.fecha_entrega where id = new.ticket_id;
  else
    update public.tickets
    set recurso_id = new.recurso_id,
        asignado_en = new.fecha,
        asignado_por = new.asignado_por,
        fecha_entrega = new.fecha_entrega,
        estado = case when estado < 3 then 3 else estado end
    where id = new.ticket_id;
  end if;
  return null;
end;
$$;
drop trigger if exists ticket_asignaciones_aplicar on public.ticket_asignaciones;
create trigger ticket_asignaciones_aplicar after insert or update on public.ticket_asignaciones
  for each row execute function public.aplicar_asignacion();

drop policy if exists "ticket_asignaciones: modificar" on public.ticket_asignaciones;
create policy "ticket_asignaciones: modificar" on public.ticket_asignaciones for update to authenticated
  using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());

-- ---------- Modificar observaciones de seguimiento ----------
alter table public.ticket_seguimientos
  add column if not exists modificado_por text,
  add column if not exists modificado_en  timestamptz;

create or replace function public.preparar_seguimiento() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.ticket_id := old.ticket_id;
    new.fecha := old.fecha;
    new.perfil_id := old.perfil_id;
    new.usuario := old.usuario;
    new.modificado_en := now();
    new.modificado_por := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
  else
    new.fecha := now();
    new.perfil_id := (select auth.uid());
    new.usuario := coalesce((select upper(p.usuario) from public.perfiles p where p.id = new.perfil_id), 'SISTEMA');
    new.modificado_por := null;
    new.modificado_en := null;
  end if;
  new.observacion := trim(new.observacion);
  return new;
end;
$$;
drop trigger if exists ticket_seguimientos_preparar on public.ticket_seguimientos;
create trigger ticket_seguimientos_preparar before insert or update on public.ticket_seguimientos
  for each row execute function public.preparar_seguimiento();

drop policy if exists "ticket_seguimientos: modificar" on public.ticket_seguimientos;
create policy "ticket_seguimientos: modificar" on public.ticket_seguimientos for update to authenticated
  using (public.usuario_activo() and (perfil_id = (select auth.uid()) or public.puede_editar_catalogos()))
  with check (public.usuario_activo());

-- ---------- Modificar el cierre ----------
alter table public.ticket_cierres
  add column if not exists modificado_por text,
  add column if not exists modificado_en  timestamptz;

create or replace function public.preparar_cierre() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  t public.tickets;
begin
  if tg_op = 'UPDATE' then
    new.ticket_id := old.ticket_id;
    new.fecha := old.fecha;
    new.cerrado_por_id := old.cerrado_por_id;
    new.cerrado_por := old.cerrado_por;
  end if;
  select * into t from public.tickets where id = new.ticket_id;
  if tg_op = 'INSERT' and t.estado = 7 then
    raise exception 'El ticket % ya está cerrado.', t.numero;
  end if;
  if exists (select 1 from unnest(array[new.entrega_id, new.recibe_id]) u
             where not exists (select 1 from public.perfiles p where p.id = u and p.activo
                               and p.organizacion_id = t.organizacion_id and p.localidad_id = t.localidad_id))
     and (tg_op = 'INSERT' or new.entrega_id is distinct from old.entrega_id or new.recibe_id is distinct from old.recibe_id) then
    raise exception 'Los usuarios que entregan y reciben deben ser usuarios activos de la organización y localidad del ticket.';
  end if;
  if tg_op = 'INSERT' then
    new.fecha := now();
    new.cerrado_por_id := (select auth.uid());
    new.cerrado_por := coalesce((select upper(p.usuario) from public.perfiles p where p.id = new.cerrado_por_id), 'SISTEMA');
    new.modificado_por := null;
    new.modificado_en := null;
  else
    new.modificado_en := now();
    new.modificado_por := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
  end if;
  new.observaciones := nullif(trim(new.observaciones), '');
  return new;
end;
$$;
drop trigger if exists ticket_cierres_preparar on public.ticket_cierres;
create trigger ticket_cierres_preparar before insert or update on public.ticket_cierres
  for each row execute function public.preparar_cierre();

drop policy if exists "ticket_cierres: modificar" on public.ticket_cierres;
create policy "ticket_cierres: modificar" on public.ticket_cierres for update to authenticated
  using (public.puede_editar_ticket(ticket_id)) with check (public.puede_editar_ticket(ticket_id));

notify pgrst, 'reload schema';
