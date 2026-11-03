-- Contabilidad · Registros · Partidas contables (administración de pólizas).
--   Encabezado: organización y localidad (empresa), período (año y mes), número de partida del
--   mes y número anual (correlativos automáticos por localidad), fecha y hora y usuario
--   (automáticos), tipo de partida, descripción, moneda y tipo de cambio, justificación.
--   Detalle: líneas con cuenta contable (de movimiento, de la versión del catálogo de la
--   partida), concepto, debe o haber y centro de costo.
--   Estados: VIGENTE o ANULADA; además Aprobada y Definitiva.
--     Aprobar: la partida debe estar cuadrada (debe = haber) y tener al menos dos líneas.
--     Definitiva: solo una partida aprobada; ya no se modifica ni se anula.
--     Si se modifica una partida aprobada (no definitiva), pierde la aprobación.
--   Los totales de debe y haber se calculan solos.
-- Escribir, aprobar, hacer definitiva y anular: administrador. Eliminar: Super Administrador,
-- y solo si no es definitiva. Requiere los scripts 15, 19 y 14. Puede ejecutarse de nuevo.

create table if not exists public.partidas (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id    bigint not null,
  catalogo_id     bigint not null references public.catalogos_cuentas (id),
  anio            integer not null check (anio between 1900 and 2999),
  mes             integer not null check (mes between 1 and 12),
  numero          integer not null,
  numero_anual    integer not null,
  fecha           timestamptz not null default now(),
  perfil_id       uuid references public.perfiles (id),
  usuario         text,
  tipo_partida_id bigint not null references public.tipos_partida (id),
  descripcion     text not null check (length(trim(descripcion)) > 0),
  moneda_id       bigint not null references public.monedas (id),
  tipo_cambio     numeric(18, 6) not null default 1 check (tipo_cambio > 0),
  origen          text not null default 'MANUAL' check (origen in ('MANUAL', 'AUTOMÁTICA')),
  estado          text not null default 'VIGENTE' check (estado in ('VIGENTE', 'ANULADA')),
  aprobada        boolean not null default false,
  aprobada_por    text,
  aprobada_en     timestamptz,
  definitiva      boolean not null default false,
  definitiva_por  text,
  definitiva_en   timestamptz,
  anulada_por     text,
  anulada_en      timestamptz,
  motivo_anulacion text,
  justificacion   text,
  total_debe      numeric(18, 2) not null default 0,
  total_haber     numeric(18, 2) not null default 0,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, anio, mes, numero),
  unique (localidad_id, anio, numero_anual)
);
create index if not exists partidas_periodo_idx on public.partidas (organizacion_id, localidad_id, anio, mes);

create table if not exists public.partida_lineas (
  id         bigint generated always as identity primary key,
  partida_id bigint not null references public.partidas (id) on delete cascade,
  linea      integer not null check (linea > 0),
  cuenta_id  bigint not null references public.cuentas (id),
  centro_id  bigint references public.centros_costo (id),
  concepto   text,
  debe       numeric(18, 2) not null default 0 check (debe >= 0),
  haber      numeric(18, 2) not null default 0 check (haber >= 0),
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  check (debe = 0 or haber = 0),
  check (debe + haber > 0),
  unique (partida_id, linea)
);
create index if not exists partida_lineas_cuenta_idx on public.partida_lineas (cuenta_id);
create index if not exists partida_lineas_centro_idx on public.partida_lineas (centro_id);

-- ---------- Encabezado ----------
create or replace function public.preparar_partida() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_quien text := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
  v_proceso boolean := current_setting('fin.partida', true) = 'si';
begin
  if tg_op = 'INSERT' then
    if new.catalogo_id is null then
      select k.id into new.catalogo_id from public.catalogos_cuentas k
      where k.localidad_id = new.localidad_id and k.activo order by k.version desc limit 1;
      if new.catalogo_id is null then
        raise exception 'La empresa no tiene un catálogo de cuentas activo.';
      end if;
    elsif not exists (select 1 from public.catalogos_cuentas k where k.id = new.catalogo_id and k.localidad_id = new.localidad_id) then
      raise exception 'La versión del catálogo de cuentas no es de la empresa de la partida.';
    end if;
    perform pg_advisory_xact_lock(4804, new.localidad_id::integer);
    new.numero := coalesce((select max(numero) from public.partidas where localidad_id = new.localidad_id and anio = new.anio and mes = new.mes), 0) + 1;
    new.numero_anual := coalesce((select max(numero_anual) from public.partidas where localidad_id = new.localidad_id and anio = new.anio), 0) + 1;
    new.fecha := now();
    new.perfil_id := (select auth.uid());
    new.usuario := v_quien;
    new.estado := 'VIGENTE';
    new.aprobada := false; new.aprobada_por := null; new.aprobada_en := null;
    new.definitiva := false; new.definitiva_por := null; new.definitiva_en := null;
    new.anulada_por := null; new.anulada_en := null; new.motivo_anulacion := null;
    new.total_debe := 0; new.total_haber := 0;
  else
    -- Lo que identifica a la partida no cambia.
    new.organizacion_id := old.organizacion_id;
    new.localidad_id := old.localidad_id;
    new.catalogo_id := old.catalogo_id;
    new.anio := old.anio;
    new.mes := old.mes;
    new.numero := old.numero;
    new.numero_anual := old.numero_anual;
    new.fecha := old.fecha;
    new.perfil_id := old.perfil_id;
    new.usuario := old.usuario;
    if not v_proceso then
      if old.definitiva then raise exception 'La partida %-% es definitiva y ya no se modifica.', old.mes, old.numero; end if;
      if old.estado = 'ANULADA' then raise exception 'La partida %-% está anulada y ya no se modifica.', old.mes, old.numero; end if;
      -- Aprobación, definitiva, anulación y totales solo los cambian sus procesos.
      new.estado := old.estado;
      new.definitiva := old.definitiva; new.definitiva_por := old.definitiva_por; new.definitiva_en := old.definitiva_en;
      new.anulada_por := old.anulada_por; new.anulada_en := old.anulada_en; new.motivo_anulacion := old.motivo_anulacion;
      new.total_debe := old.total_debe; new.total_haber := old.total_haber;
      -- Modificada, pierde la aprobación.
      new.aprobada := false; new.aprobada_por := null; new.aprobada_en := null;
    end if;
  end if;
  new.descripcion := trim(new.descripcion);
  new.justificacion := nullif(trim(new.justificacion), '');
  return new;
end;
$$;
drop trigger if exists partidas_preparar on public.partidas;
create trigger partidas_preparar before insert or update on public.partidas
  for each row execute function public.preparar_partida();
drop trigger if exists partidas_auditar on public.partidas;
create trigger partidas_auditar before insert or update on public.partidas
  for each row execute function public.auditar();

-- ---------- Líneas ----------
create or replace function public.preparar_linea_partida() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p public.partidas;
  c public.cuentas;
begin
  select * into p from public.partidas where id = coalesce(new.partida_id, old.partida_id);
  if p.definitiva then raise exception 'La partida %-% es definitiva y ya no se modifica.', p.mes, p.numero; end if;
  if p.estado = 'ANULADA' then raise exception 'La partida %-% está anulada y ya no se modifica.', p.mes, p.numero; end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_op = 'UPDATE' then new.partida_id := old.partida_id; end if;
  select * into c from public.cuentas where id = new.cuenta_id;
  if c.catalogo_id is distinct from p.catalogo_id then
    raise exception 'La cuenta de la línea % no es del catálogo de cuentas de la partida.', new.linea;
  end if;
  if exists (select 1 from public.cuentas h where h.cuenta_mayor_id = c.id) then
    raise exception 'La cuenta % (%) agrupa a otras cuentas: usa una cuenta de movimiento.', c.codigo, c.nombre;
  end if;
  if not c.vigente then
    raise exception 'La cuenta % (%) no está vigente.', c.codigo, c.nombre;
  end if;
  if new.centro_id is not null and not exists (
       select 1 from public.centros_costo x join public.catalogos_centros k on k.id = x.catalogo_id
       where x.id = new.centro_id and k.localidad_id = p.localidad_id) then
    raise exception 'El centro de costo de la línea % no es de la empresa de la partida.', new.linea;
  end if;
  new.concepto := nullif(trim(new.concepto), '');
  return new;
end;
$$;
drop trigger if exists partida_lineas_preparar on public.partida_lineas;
create trigger partida_lineas_preparar before insert or update or delete on public.partida_lineas
  for each row execute function public.preparar_linea_partida();
drop trigger if exists partida_lineas_auditar on public.partida_lineas;
create trigger partida_lineas_auditar before insert or update on public.partida_lineas
  for each row execute function public.auditar();

-- Totales de la partida; si cambian sus líneas, pierde la aprobación.
create or replace function public.totalizar_partida() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint := coalesce(new.partida_id, old.partida_id);
begin
  perform set_config('fin.partida', 'si', true);
  update public.partidas p
  set total_debe = coalesce((select sum(l.debe) from public.partida_lineas l where l.partida_id = v_id), 0),
      total_haber = coalesce((select sum(l.haber) from public.partida_lineas l where l.partida_id = v_id), 0),
      aprobada = false, aprobada_por = null, aprobada_en = null
  where p.id = v_id and not p.definitiva;
  perform set_config('fin.partida', '', true);
  return null;
end;
$$;
drop trigger if exists partida_lineas_totalizar on public.partida_lineas;
create trigger partida_lineas_totalizar after insert or update or delete on public.partida_lineas
  for each row execute function public.totalizar_partida();

-- ---------- Procesos ----------
create or replace function public.cambiar_estado_partida(p_id bigint, p_accion text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.partidas;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_lineas integer;
begin
  if p_accion = 'ELIMINAR' then
    if not public.es_superadmin() then raise exception 'Solo el Super Administrador puede eliminar partidas.'; end if;
  elsif not public.puede_editar_catalogos() then
    raise exception 'Solo un administrador puede aprobar, hacer definitiva o anular partidas.';
  end if;
  select * into p from public.partidas where id = p_id for update;
  if p.id is null then raise exception 'La partida no existe.'; end if;
  if p.definitiva then raise exception 'La partida %-% es definitiva: ya no cambia.', p.mes, p.numero; end if;
  if p.estado = 'ANULADA' and p_accion <> 'ELIMINAR' then raise exception 'La partida %-% está anulada.', p.mes, p.numero; end if;
  select count(*) into v_lineas from public.partida_lineas where partida_id = p.id;

  perform set_config('fin.partida', 'si', true);
  if p_accion = 'APROBAR' then
    if v_lineas < 2 then raise exception 'La partida necesita al menos dos líneas para aprobarse.'; end if;
    if p.total_debe <> p.total_haber or p.total_debe = 0 then
      raise exception 'La partida no está cuadrada: debe Q% y haber Q% (diferencia %).', p.total_debe, p.total_haber, p.total_debe - p.total_haber;
    end if;
    update public.partidas set aprobada = true, aprobada_por = v_quien, aprobada_en = now() where id = p.id;
  elsif p_accion = 'DESAPROBAR' then
    update public.partidas set aprobada = false, aprobada_por = null, aprobada_en = null where id = p.id;
  elsif p_accion = 'DEFINITIVA' then
    if not p.aprobada then raise exception 'Primero aprueba la partida para hacerla definitiva.'; end if;
    update public.partidas set definitiva = true, definitiva_por = v_quien, definitiva_en = now() where id = p.id;
  elsif p_accion = 'ANULAR' then
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la anulación.'; end if;
    update public.partidas set estado = 'ANULADA', aprobada = false, anulada_por = v_quien, anulada_en = now(), motivo_anulacion = trim(p_motivo) where id = p.id;
  elsif p_accion = 'ELIMINAR' then
    delete from public.partidas where id = p.id;
  else
    raise exception 'Acción no válida.';
  end if;
  perform set_config('fin.partida', '', true);
  return jsonb_build_object('mes', p.mes, 'numero', p.numero, 'accion', p_accion);
end;
$$;

alter table public.partidas enable row level security;
alter table public.partida_lineas enable row level security;
do $$
declare t text;
begin
  foreach t in array array['partidas', 'partida_lineas'] loop
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format('drop policy if exists "%s: modificar" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
  end loop;
end;
$$;
drop policy if exists "partida_lineas: quitar" on public.partida_lineas;
create policy "partida_lineas: quitar" on public.partida_lineas for delete to authenticated using (public.puede_editar_catalogos());

revoke execute on function public.preparar_partida() from public, anon, authenticated;
revoke execute on function public.preparar_linea_partida() from public, anon, authenticated;
revoke execute on function public.totalizar_partida() from public, anon, authenticated;
revoke execute on function public.cambiar_estado_partida(bigint, text, text) from public, anon;
grant execute on function public.cambiar_estado_partida(bigint, text, text) to authenticated;

-- La pantalla pasa a un subgrupo de Registros en el menú y en Roles módulos.
update public.opciones_sistema set subgrupo = 'Partidas' where clave = 'partidas-contables' and grupo = 'registros';

notify pgrst, 'reload schema';
