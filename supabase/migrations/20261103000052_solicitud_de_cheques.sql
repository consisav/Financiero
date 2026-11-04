-- Caja y Bancos · Cheques · Solicitud de cheques (antes de la emisión).
--   solicitudes_cheque: tipo de solicitud, número de requisición (correlativo por localidad, con
--   él se da seguimiento), formulario, fecha, proveedor o empleado, beneficiario, departamento,
--   solicitante (automático), descripción general del pago, observaciones, moneda, valor de
--   cambio, monto y monto en quetzales.
--   Estados: PENDIENTE → APROBADA (o RECHAZADA) → EMITIDA (al emitir el cheque); ANULADA.
--   Solicitar: cualquier usuario activo; modificar: su solicitante o un administrador, solo
--   mientras está pendiente. Aprobar, rechazar y anular: administrador.
--   movimientos_bancarios.solicitud_id: el cheque emitido con la solicitud aprobada; al emitirlo la
--   solicitud queda EMITIDA con el número y la fecha del cheque, y si el cheque se anula vuelve a
--   APROBADA para emitir otro.
-- Se ejecuta después del script 51.

create table if not exists public.solicitudes_cheque (
  id                  bigint generated always as identity primary key,
  organizacion_id     bigint not null references public.organizaciones (id),
  localidad_id        bigint not null,
  numero              integer not null,
  tipo_solicitud      text not null default 'PAGO A PROVEEDORES'
                      check (tipo_solicitud in ('ANTICIPOS', 'PAGO A PROVEEDORES', 'REEMBOLSO', 'VIÁTICOS', 'PLANILLA', 'CAJA CHICA', 'OTROS')),
  formulario          text,
  fecha               date not null default current_date,
  estado              text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'EMITIDA', 'ANULADA')),
  proveedor_codigo    text,
  proveedor_nombre    text,
  empleado_codigo     text,
  empleado_nombre     text,
  beneficiario        text not null check (length(trim(beneficiario)) > 0),
  departamento_codigo text,
  departamento_nombre text,
  solicitante         text,
  descripcion         text not null check (length(trim(descripcion)) > 0),
  observaciones       text,
  moneda_id           bigint not null references public.monedas (id),
  tipo_cambio         numeric(18, 6) not null default 1 check (tipo_cambio > 0),
  monto               numeric(18, 2) not null check (monto > 0),
  monto_ml            numeric(18, 2),
  cuenta_bancaria_id  bigint references public.cuentas_bancarias (id),
  aprobado_por        text,
  aprobado_en         timestamptz,
  motivo              text,
  movimiento_id       bigint references public.movimientos_bancarios (id) on delete set null,
  cheque_numero       text,
  cheque_fecha        date,
  perfil_id           uuid,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, numero)
);
create index if not exists solicitudes_cheque_fecha_idx on public.solicitudes_cheque (localidad_id, fecha desc);

alter table public.movimientos_bancarios add column if not exists solicitud_id bigint references public.solicitudes_cheque (id) on delete set null;
create unique index if not exists movimientos_bancarios_solicitud on public.movimientos_bancarios (solicitud_id) where solicitud_id is not null and estado = 'ACTIVO';

create or replace function public.preparar_solicitud_cheque() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_quien text := coalesce((select upper(coalesce(p.nombre, p.usuario)) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
  v_proceso boolean := current_setting('fin.solicitud', true) = 'si';
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4808, new.localidad_id::integer);
    new.numero := coalesce((select max(numero) from public.solicitudes_cheque where localidad_id = new.localidad_id), 0) + 1;
    new.estado := 'PENDIENTE';
    new.solicitante := v_quien;
    new.perfil_id := (select auth.uid());
    new.aprobado_por := null; new.aprobado_en := null; new.motivo := null;
    new.movimiento_id := null; new.cheque_numero := null; new.cheque_fecha := null;
  else
    new.organizacion_id := old.organizacion_id; new.localidad_id := old.localidad_id;
    new.numero := old.numero; new.solicitante := old.solicitante; new.perfil_id := old.perfil_id;
    if not v_proceso then
      if old.estado <> 'PENDIENTE' then
        raise exception 'La solicitud % está %: ya no se modifica.', old.numero, lower(old.estado);
      end if;
      if not public.puede_editar_catalogos() and old.perfil_id is distinct from (select auth.uid()) then
        raise exception 'Solo quien hizo la solicitud o un administrador la modifica.';
      end if;
      new.estado := old.estado; new.aprobado_por := old.aprobado_por; new.aprobado_en := old.aprobado_en; new.motivo := old.motivo;
      new.movimiento_id := old.movimiento_id; new.cheque_numero := old.cheque_numero; new.cheque_fecha := old.cheque_fecha;
    end if;
  end if;
  new.monto_ml := round(new.monto * new.tipo_cambio, 2);
  new.beneficiario := upper(trim(new.beneficiario));
  new.descripcion := trim(new.descripcion);
  new.observaciones := nullif(trim(new.observaciones), '');
  new.proveedor_nombre := nullif(upper(trim(new.proveedor_nombre)), '');
  new.empleado_nombre := nullif(upper(trim(new.empleado_nombre)), '');
  new.departamento_nombre := nullif(upper(trim(new.departamento_nombre)), '');
  return new;
end;
$$;
drop trigger if exists solicitudes_cheque_preparar on public.solicitudes_cheque;
create trigger solicitudes_cheque_preparar before insert or update on public.solicitudes_cheque
  for each row execute function public.preparar_solicitud_cheque();
drop trigger if exists solicitudes_cheque_auditar on public.solicitudes_cheque;
create trigger solicitudes_cheque_auditar before insert or update on public.solicitudes_cheque
  for each row execute function public.auditar();

-- ---------- Aprobar, rechazar, anular y regresar a pendiente ----------
create or replace function public.procesar_solicitud_cheque(p_id bigint, p_accion text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.solicitudes_cheque;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador aprueba, rechaza o anula solicitudes de cheque.'; end if;
  select * into s from public.solicitudes_cheque where id = p_id for update;
  if s.id is null then raise exception 'La solicitud no existe.'; end if;
  perform set_config('fin.solicitud', 'si', true);
  if p_accion = 'APROBAR' then
    if s.estado <> 'PENDIENTE' then raise exception 'Solo se aprueba una solicitud pendiente (la % está %).', s.numero, lower(s.estado); end if;
    update public.solicitudes_cheque set estado = 'APROBADA', aprobado_por = v_quien, aprobado_en = now(), motivo = null where id = s.id;
  elsif p_accion = 'RECHAZAR' then
    if s.estado <> 'PENDIENTE' then raise exception 'Solo se rechaza una solicitud pendiente.'; end if;
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo del rechazo.'; end if;
    update public.solicitudes_cheque set estado = 'RECHAZADA', aprobado_por = v_quien, aprobado_en = now(), motivo = trim(p_motivo) where id = s.id;
  elsif p_accion = 'PENDIENTE' then
    if s.estado not in ('APROBADA', 'RECHAZADA') then raise exception 'Solo una solicitud aprobada o rechazada (sin cheque) regresa a pendiente.'; end if;
    update public.solicitudes_cheque set estado = 'PENDIENTE', aprobado_por = null, aprobado_en = null, motivo = null where id = s.id;
  elsif p_accion = 'ANULAR' then
    if s.estado = 'EMITIDA' then raise exception 'La solicitud % ya tiene el cheque %: anula primero el cheque.', s.numero, s.cheque_numero; end if;
    if s.estado = 'ANULADA' then raise exception 'La solicitud ya está anulada.'; end if;
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la anulación.'; end if;
    update public.solicitudes_cheque set estado = 'ANULADA', motivo = trim(p_motivo) where id = s.id;
  else
    raise exception 'Acción no válida.';
  end if;
  perform set_config('fin.solicitud', '', true);
  return jsonb_build_object('numero', s.numero, 'accion', p_accion);
end;
$$;

-- ---------- El cheque emitido con la solicitud ----------
create or replace function public.validar_solicitud_del_cheque() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  s public.solicitudes_cheque;
begin
  if new.solicitud_id is null or new.tipo <> 'CHEQUE' then
    if new.solicitud_id is not null then raise exception 'Solo un cheque se emite con una solicitud.'; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.solicitud_id is not distinct from old.solicitud_id then return new; end if;
  select * into s from public.solicitudes_cheque where id = new.solicitud_id;
  if s.localidad_id is distinct from new.localidad_id then raise exception 'La solicitud no es de la localidad del cheque.'; end if;
  if s.estado <> 'APROBADA' then raise exception 'La solicitud % está %: solo se emite el cheque de una solicitud aprobada.', s.numero, lower(s.estado); end if;
  return new;
end;
$$;
drop trigger if exists movimientos_bancarios_solicitud on public.movimientos_bancarios;
create trigger movimientos_bancarios_solicitud before insert or update on public.movimientos_bancarios
  for each row execute function public.validar_solicitud_del_cheque();

create or replace function public.marcar_solicitud_del_cheque() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('fin.solicitud', 'si', true);
  -- La solicitud que se quitó o cuyo cheque se anuló vuelve a aprobada.
  if tg_op = 'UPDATE' and old.solicitud_id is not null and (new.solicitud_id is distinct from old.solicitud_id or new.estado = 'ANULADO') then
    update public.solicitudes_cheque set estado = 'APROBADA', movimiento_id = null, cheque_numero = null, cheque_fecha = null
    where id = old.solicitud_id and movimiento_id = old.id;
  end if;
  if new.solicitud_id is not null and new.estado = 'ACTIVO' then
    update public.solicitudes_cheque set estado = 'EMITIDA', movimiento_id = new.id, cheque_numero = new.numero_documento, cheque_fecha = new.fecha,
           cuenta_bancaria_id = new.cuenta_bancaria_id
    where id = new.solicitud_id;
  end if;
  perform set_config('fin.solicitud', '', true);
  return null;
end;
$$;
drop trigger if exists movimientos_bancarios_marcar_solicitud on public.movimientos_bancarios;
create trigger movimientos_bancarios_marcar_solicitud after insert or update on public.movimientos_bancarios
  for each row execute function public.marcar_solicitud_del_cheque();

alter table public.solicitudes_cheque enable row level security;
drop policy if exists "solicitudes_cheque: leer" on public.solicitudes_cheque;
drop policy if exists "solicitudes_cheque: crear" on public.solicitudes_cheque;
drop policy if exists "solicitudes_cheque: modificar" on public.solicitudes_cheque;
create policy "solicitudes_cheque: leer" on public.solicitudes_cheque for select to authenticated using (public.usuario_activo());
create policy "solicitudes_cheque: crear" on public.solicitudes_cheque for insert to authenticated with check (public.usuario_activo());
create policy "solicitudes_cheque: modificar" on public.solicitudes_cheque for update to authenticated
  using (public.puede_editar_catalogos() or perfil_id = (select auth.uid())) with check (public.usuario_activo());

revoke execute on function public.preparar_solicitud_cheque() from public, anon, authenticated;
revoke execute on function public.validar_solicitud_del_cheque() from public, anon, authenticated;
revoke execute on function public.marcar_solicitud_del_cheque() from public, anon, authenticated;
revoke execute on function public.procesar_solicitud_cheque(bigint, text, text) from public, anon;
grant execute on function public.procesar_solicitud_cheque(bigint, text, text) to authenticated;
grant select, insert, update on public.solicitudes_cheque to authenticated;

-- ---------- Menú: Caja y Bancos · Cheques · Solicitud de cheques (antes de la emisión) ----------
insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
select m.id, 'cheques', 'Cheques', 'solicitud-de-cheques', 'Solicitud de cheques',
       coalesce((select min(orden) - 1 from public.opciones_sistema where clave = 'emision-de-cheques'), (select max(orden) + 1 from public.opciones_sistema), 1)
from public.modulos_sistema m
where m.siglas = 'CYB' and m.modulo_mayor_id is null
  and not exists (select 1 from public.opciones_sistema o where o.clave = 'solicitud-de-cheques' and o.modulo_id = m.id);

notify pgrst, 'reload schema';
