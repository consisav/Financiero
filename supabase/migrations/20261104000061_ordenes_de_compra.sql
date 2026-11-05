-- Compras · Registros · Órdenes de compra: solicitud, autorización, recepción e inventario.
--   ordenes_compra: folio (correlativo por localidad) y número de orden (correlativo del mes por
--   bodega: 003-11-FF-2026), fecha, estado (INGRESADA, EN AUTORIZACIÓN, AUTORIZADA, RECHAZADA,
--   RECIBIDA PARCIAL, RECIBIDA, ANULADA), proveedor, forma de pago, días de crédito, moneda y
--   cambio, tipo de proveedor, bodega, observaciones internas, al proveedor y generales, condiciones
--   (entrega, lugar, contacto) y quién la ingresó, envió, aprobó o rechazó.
--   orden_compra_lineas: producto, cantidad solicitada y aprobada, si se aprueba, precio unitario y
--   observaciones. orden_cotizaciones: las cotizaciones de otros proveedores.
--   ingresos_compra (Órdenes de compra · ingresos basados en órdenes): número, fecha, bodega, moneda,
--   cambio, estado (VIGENTE, APLICADO, ANULADO), la orden, el proveedor, el documento del proveedor
--   (serie, número y fecha), la transacción, el descuento y la compra que se genera.
--   ingreso_lineas: producto, lote, fechas de vencimiento y fabricación, cantidad y costo.
--   inventario_movimientos y la vista existencias: lo que entra a cada bodega por los ingresos.
--   orden_lineas_saldo: lo aprobado, lo recibido y el saldo de cada línea de orden.
--   procesar_orden (ENVIAR, APROBAR, RECHAZAR, DEVOLVER, ANULAR) y procesar_ingreso (APLICAR con o
--   sin generar la factura de compra, REVERTIR, ANULAR).
-- Escribir: administrador. Se ejecuta después del script 60.

-- ---------- Órdenes de compra ----------
create table if not exists public.ordenes_compra (
  id                      bigint generated always as identity primary key,
  organizacion_id         bigint not null references public.organizaciones (id),
  localidad_id            bigint not null,
  folio                   integer not null,
  numero                  text,
  fecha                   date not null default current_date,
  estado                  text not null default 'INGRESADA' check (estado in ('INGRESADA', 'EN AUTORIZACIÓN', 'AUTORIZADA', 'RECHAZADA', 'RECIBIDA PARCIAL', 'RECIBIDA', 'ANULADA')),
  proveedor_id            bigint not null references public.proveedores (id),
  forma_pago              text not null default 'CONTADO' check (forma_pago in ('CONTADO', 'CRÉDITO')),
  dias_credito            integer not null default 0 check (dias_credito between 0 and 365),
  moneda_id               bigint not null references public.monedas (id),
  tipo_cambio             numeric(18, 6) not null default 1 check (tipo_cambio > 0),
  tipo_proveedor_id       bigint references public.tipos_proveedor (id),
  bodega_id               bigint not null references public.bodegas (id),
  observaciones_internas  text,
  observaciones_proveedor text,
  observaciones           text,
  fecha_entrega           date,
  lugar_entrega           text,
  contacto_entrega        text,
  condiciones             text,
  usuario                 text,
  enviado_por text, enviado_en timestamptz,
  aprobado_por text, aprobado_en timestamptz,
  rechazado_por text, rechazado_en timestamptz, motivo_rechazo text,
  anulado_por text, anulado_en timestamptz, motivo_anulacion text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, folio)
);
create index if not exists ordenes_compra_estado_idx on public.ordenes_compra (localidad_id, estado, fecha desc);

create table if not exists public.orden_compra_lineas (
  id                  bigint generated always as identity primary key,
  orden_id            bigint not null references public.ordenes_compra (id) on delete cascade,
  linea               integer not null,
  producto_id         bigint not null references public.productos (id),
  cantidad_solicitada numeric(14, 3) not null check (cantidad_solicitada > 0),
  cantidad_aprobada   numeric(14, 3) not null default 0 check (cantidad_aprobada >= 0),
  aprueba             boolean not null default true,
  precio_unitario     numeric(18, 4) not null default 0 check (precio_unitario >= 0),
  observaciones       text,
  unique (orden_id, linea)
);
create index if not exists orden_compra_lineas_producto_idx on public.orden_compra_lineas (producto_id);

create table if not exists public.orden_cotizaciones (
  id               bigint generated always as identity primary key,
  orden_id         bigint not null references public.ordenes_compra (id) on delete cascade,
  linea            integer not null,
  proveedor_nombre text not null check (length(trim(proveedor_nombre)) > 0),
  fecha            date,
  valor            numeric(18, 2) not null default 0 check (valor >= 0),
  dias_entrega     integer check (dias_entrega >= 0),
  observaciones    text,
  elegida          boolean not null default false,
  unique (orden_id, linea)
);

create or replace function public.preparar_orden_compra() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_proceso boolean := current_setting('fin.orden', true) = 'si';
  b public.bodegas;
  p public.proveedores;
  v_sec integer;
begin
  select * into b from public.bodegas where id = new.bodega_id;
  if b.localidad_id is distinct from new.localidad_id then raise exception 'La bodega no es de la localidad de la orden.'; end if;
  select * into p from public.proveedores where id = new.proveedor_id;
  if p.localidad_id is distinct from new.localidad_id then raise exception 'El proveedor no es de la localidad de la orden.'; end if;
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4818, new.localidad_id::integer);
    new.folio := coalesce((select max(folio) from public.ordenes_compra where localidad_id = new.localidad_id), 0) + 1;
    select count(*) + 1 into v_sec from public.ordenes_compra
    where localidad_id = new.localidad_id and bodega_id = new.bodega_id and extract(year from fecha) = extract(year from new.fecha) and extract(month from fecha) = extract(month from new.fecha);
    new.numero := lpad(v_sec::text, 3, '0') || '-' || to_char(new.fecha, 'MM') || '-' || coalesce(b.siglas, b.codigo::text) || '-' || to_char(new.fecha, 'YYYY');
    new.usuario := v_quien;
    if not v_proceso then new.estado := 'INGRESADA'; end if;
  else
    new.organizacion_id := old.organizacion_id; new.localidad_id := old.localidad_id; new.folio := old.folio; new.numero := old.numero; new.usuario := old.usuario;
    if not v_proceso then
      if old.estado not in ('INGRESADA', 'RECHAZADA') then raise exception 'La orden % está %: ya no se modifica.', old.numero, lower(old.estado); end if;
      new.estado := old.estado;
      new.bodega_id := old.bodega_id;
    end if;
  end if;
  if new.forma_pago = 'CONTADO' then new.dias_credito := 0; end if;
  new.tipo_proveedor_id := coalesce(new.tipo_proveedor_id, p.tipo_proveedor_id);
  new.observaciones_internas := nullif(trim(new.observaciones_internas), '');
  new.observaciones_proveedor := nullif(trim(new.observaciones_proveedor), '');
  new.observaciones := nullif(trim(new.observaciones), '');
  new.lugar_entrega := nullif(upper(trim(new.lugar_entrega)), '');
  new.contacto_entrega := nullif(upper(trim(new.contacto_entrega)), '');
  new.condiciones := nullif(trim(new.condiciones), '');
  return new;
end;
$$;
drop trigger if exists ordenes_compra_preparar on public.ordenes_compra;
create trigger ordenes_compra_preparar before insert or update on public.ordenes_compra for each row execute function public.preparar_orden_compra();
drop trigger if exists ordenes_compra_auditar on public.ordenes_compra;
create trigger ordenes_compra_auditar before insert or update on public.ordenes_compra for each row execute function public.auditar();

-- Las líneas cambian mientras la orden se ingresa; en autorización solo lo aprobado.
create or replace function public.validar_orden_linea() returns trigger
language plpgsql security definer set search_path = '' as $$
declare o public.ordenes_compra;
begin
  select * into o from public.ordenes_compra where id = coalesce(new.orden_id, old.orden_id);
  if current_setting('fin.orden', true) is distinct from 'si' then
    if o.estado = 'EN AUTORIZACIÓN' then
      if tg_op <> 'UPDATE' or new.producto_id <> old.producto_id or new.cantidad_solicitada <> old.cantidad_solicitada or new.precio_unitario <> old.precio_unitario then
        raise exception 'La orden % está en autorización: solo cambian la cantidad aprobada y si se aprueba.', o.numero;
      end if;
    elsif o.estado not in ('INGRESADA', 'RECHAZADA') then
      raise exception 'La orden % está %: sus líneas ya no cambian.', o.numero, lower(o.estado);
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if not exists (select 1 from public.productos x where x.id = new.producto_id and x.localidad_id = o.localidad_id) then
    raise exception 'El producto de la línea % no es de la localidad de la orden.', new.linea;
  end if;
  if new.cantidad_aprobada > new.cantidad_solicitada then raise exception 'En la línea % se aprueba más de lo solicitado.', new.linea; end if;
  new.observaciones := nullif(trim(new.observaciones), '');
  return new;
end;
$$;
drop trigger if exists orden_compra_lineas_validar on public.orden_compra_lineas;
create trigger orden_compra_lineas_validar before insert or update or delete on public.orden_compra_lineas for each row execute function public.validar_orden_linea();

-- ---------- Ingresos de compras basados en órdenes ----------
create table if not exists public.ingresos_compra (
  id               bigint generated always as identity primary key,
  organizacion_id  bigint not null references public.organizaciones (id),
  localidad_id     bigint not null,
  numero           integer not null,
  fecha_ingreso    date not null default current_date,
  orden_id         bigint not null references public.ordenes_compra (id),
  bodega_id        bigint not null references public.bodegas (id),
  proveedor_id     bigint not null references public.proveedores (id),
  moneda_id        bigint not null references public.monedas (id),
  tipo_cambio      numeric(18, 6) not null default 1 check (tipo_cambio > 0),
  forma_pago       text not null default 'CONTADO' check (forma_pago in ('CONTADO', 'CRÉDITO')),
  dias_credito     integer not null default 0 check (dias_credito between 0 and 365),
  serie            text,
  documento        text,
  fecha_documento  date,
  transaccion_id   bigint references public.transacciones_contables (id) on delete set null,
  valor_descuento  numeric(18, 2) not null default 0 check (valor_descuento >= 0),
  observaciones    text,
  estado           text not null default 'VIGENTE' check (estado in ('VIGENTE', 'APLICADO', 'ANULADO')),
  compra_id        bigint references public.compras (id) on delete set null,
  usuario          text,
  aplicado_por text, aplicado_en timestamptz,
  anulado_por text, anulado_en timestamptz, motivo_anulacion text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, numero)
);
create index if not exists ingresos_compra_orden_idx on public.ingresos_compra (orden_id);

create table if not exists public.ingreso_lineas (
  id                bigint generated always as identity primary key,
  ingreso_id        bigint not null references public.ingresos_compra (id) on delete cascade,
  linea             integer not null,
  orden_linea_id    bigint not null references public.orden_compra_lineas (id),
  producto_id       bigint not null references public.productos (id),
  lote              text,
  fecha_vencimiento date,
  fecha_fabricacion date,
  cantidad          numeric(14, 3) not null check (cantidad > 0),
  costo_unitario    numeric(18, 4) not null default 0 check (costo_unitario >= 0),
  inventariado      boolean not null default false,
  unique (ingreso_id, linea)
);

create table if not exists public.inventario_movimientos (
  id               bigint generated always as identity primary key,
  organizacion_id  bigint not null,
  localidad_id     bigint not null,
  producto_id      bigint not null references public.productos (id),
  bodega_id        bigint not null references public.bodegas (id),
  fecha            date not null default current_date,
  cantidad         numeric(14, 3) not null,
  costo_unitario   numeric(18, 4) not null default 0,
  origen           text not null default 'INGRESO' check (origen in ('INGRESO', 'AJUSTE', 'DESPACHO', 'TRASLADO')),
  ingreso_linea_id bigint references public.ingreso_lineas (id) on delete cascade,
  lote             text,
  fecha_vencimiento date,
  usuario          text,
  creado_en        timestamptz not null default now()
);
create index if not exists inventario_movimientos_producto_idx on public.inventario_movimientos (producto_id, bodega_id);

create or replace view public.existencias with (security_invoker = true) as
  select producto_id, bodega_id, localidad_id, sum(cantidad) as existencia
  from public.inventario_movimientos group by producto_id, bodega_id, localidad_id;

create or replace view public.orden_lineas_saldo with (security_invoker = true) as
  select l.*, o.localidad_id, o.bodega_id, o.estado,
         coalesce(r.recibido, 0) as recibido,
         case when o.estado in ('AUTORIZADA', 'RECIBIDA PARCIAL') and l.aprueba then greatest(l.cantidad_aprobada - coalesce(r.recibido, 0), 0) else 0 end as saldo
  from public.orden_compra_lineas l
  join public.ordenes_compra o on o.id = l.orden_id
  left join lateral (
    select sum(il.cantidad) as recibido from public.ingreso_lineas il join public.ingresos_compra i on i.id = il.ingreso_id and i.estado = 'APLICADO'
    where il.orden_linea_id = l.id) r on true;

create or replace function public.preparar_ingreso_compra() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o public.ordenes_compra;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
begin
  select * into o from public.ordenes_compra where id = new.orden_id;
  if tg_op = 'INSERT' then
    if o.localidad_id is distinct from new.localidad_id then raise exception 'La orden no es de la localidad del ingreso.'; end if;
    if o.estado not in ('AUTORIZADA', 'RECIBIDA PARCIAL') then raise exception 'La orden % está %: solo se recibe una orden autorizada.', o.numero, lower(o.estado); end if;
    perform pg_advisory_xact_lock(4819, new.localidad_id::integer);
    new.numero := coalesce((select max(numero) from public.ingresos_compra where localidad_id = new.localidad_id), 0) + 1;
    new.usuario := v_quien;
    new.estado := 'VIGENTE'; new.compra_id := null;
  else
    new.organizacion_id := old.organizacion_id; new.localidad_id := old.localidad_id; new.numero := old.numero; new.orden_id := old.orden_id; new.usuario := old.usuario;
    if current_setting('fin.ingreso', true) is distinct from 'si' then
      if old.estado <> 'VIGENTE' then raise exception 'El ingreso % está %: ya no se modifica.', old.numero, lower(old.estado); end if;
      new.estado := old.estado; new.compra_id := old.compra_id;
    end if;
  end if;
  new.proveedor_id := o.proveedor_id;
  if not exists (select 1 from public.bodegas b where b.id = new.bodega_id and b.localidad_id = new.localidad_id) then raise exception 'La bodega no es de la localidad del ingreso.'; end if;
  if new.forma_pago = 'CONTADO' then new.dias_credito := 0; end if;
  new.serie := nullif(upper(trim(new.serie)), '');
  new.documento := nullif(upper(trim(new.documento)), '');
  new.observaciones := nullif(trim(new.observaciones), '');
  return new;
end;
$$;
drop trigger if exists ingresos_compra_preparar on public.ingresos_compra;
create trigger ingresos_compra_preparar before insert or update on public.ingresos_compra for each row execute function public.preparar_ingreso_compra();
drop trigger if exists ingresos_compra_auditar on public.ingresos_compra;
create trigger ingresos_compra_auditar before insert or update on public.ingresos_compra for each row execute function public.auditar();

create or replace function public.validar_ingreso_linea() returns trigger
language plpgsql security definer set search_path = '' as $$
declare i public.ingresos_compra; l public.orden_compra_lineas;
begin
  select * into i from public.ingresos_compra where id = coalesce(new.ingreso_id, old.ingreso_id);
  if current_setting('fin.ingreso', true) is distinct from 'si' and i.estado <> 'VIGENTE' then
    raise exception 'El ingreso % está %: sus líneas ya no cambian.', i.numero, lower(i.estado);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  select * into l from public.orden_compra_lineas where id = new.orden_linea_id;
  if l.orden_id is distinct from i.orden_id then raise exception 'La línea % no es de la orden del ingreso.', new.linea; end if;
  new.producto_id := l.producto_id;
  new.lote := nullif(upper(trim(new.lote)), '');
  return new;
end;
$$;
drop trigger if exists ingreso_lineas_validar on public.ingreso_lineas;
create trigger ingreso_lineas_validar before insert or update or delete on public.ingreso_lineas for each row execute function public.validar_ingreso_linea();

-- ---------- Procesos ----------
create or replace function public.procesar_orden(p_id bigint, p_accion text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.ordenes_compra;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_n integer;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede procesar órdenes de compra.'; end if;
  select * into o from public.ordenes_compra where id = p_id for update;
  if o.id is null then raise exception 'La orden no existe.'; end if;
  perform set_config('fin.orden', 'si', true);
  if p_accion = 'ENVIAR' then
    if o.estado not in ('INGRESADA', 'RECHAZADA') then raise exception 'Solo se envía a autorización una orden ingresada o rechazada.'; end if;
    select count(*) into v_n from public.orden_compra_lineas where orden_id = o.id;
    if v_n = 0 then raise exception 'La orden % no tiene productos.', o.numero; end if;
    if exists (select 1 from public.orden_compra_lineas where orden_id = o.id and precio_unitario <= 0) then raise exception 'Escribe el precio unitario de todos los productos de la orden.'; end if;
    update public.orden_compra_lineas set cantidad_aprobada = cantidad_solicitada, aprueba = true where orden_id = o.id;
    update public.ordenes_compra set estado = 'EN AUTORIZACIÓN', enviado_por = v_quien, enviado_en = now(), rechazado_por = null, rechazado_en = null, motivo_rechazo = null where id = o.id;
  elsif p_accion = 'APROBAR' then
    if o.estado <> 'EN AUTORIZACIÓN' then raise exception 'Solo se aprueba una orden en autorización.'; end if;
    update public.orden_compra_lineas set cantidad_aprobada = 0 where orden_id = o.id and not aprueba;
    if not exists (select 1 from public.orden_compra_lineas where orden_id = o.id and aprueba and cantidad_aprobada > 0) then raise exception 'Aprueba al menos un producto con su cantidad.'; end if;
    update public.ordenes_compra set estado = 'AUTORIZADA', aprobado_por = v_quien, aprobado_en = now() where id = o.id;
  elsif p_accion in ('RECHAZAR', 'DEVOLVER') then
    if o.estado <> 'EN AUTORIZACIÓN' then raise exception 'Solo se rechaza o devuelve una orden en autorización.'; end if;
    if p_accion = 'RECHAZAR' and nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo del rechazo.'; end if;
    update public.ordenes_compra set estado = case when p_accion = 'RECHAZAR' then 'RECHAZADA' else 'INGRESADA' end,
           rechazado_por = v_quien, rechazado_en = now(), motivo_rechazo = nullif(trim(p_motivo), '') where id = o.id;
  elsif p_accion = 'ANULAR' then
    if o.estado in ('ANULADA', 'RECIBIDA') then raise exception 'La orden % ya está %.', o.numero, lower(o.estado); end if;
    if exists (select 1 from public.ingresos_compra i where i.orden_id = o.id and i.estado <> 'ANULADO') then raise exception 'La orden % tiene ingresos: anúlalos primero.', o.numero; end if;
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la anulación.'; end if;
    update public.ordenes_compra set estado = 'ANULADA', anulado_por = v_quien, anulado_en = now(), motivo_anulacion = trim(p_motivo) where id = o.id;
  else
    raise exception 'Acción no válida.';
  end if;
  perform set_config('fin.orden', '', true);
  return jsonb_build_object('numero', o.numero);
end;
$$;

-- Estado de la orden según lo recibido.
create or replace function public.recalcular_orden(p_orden bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pend numeric; v_rec numeric;
begin
  select coalesce(sum(greatest(l.cantidad_aprobada - coalesce(r.recibido, 0), 0)) filter (where l.aprueba), 0), coalesce(sum(r.recibido), 0) into v_pend, v_rec
  from public.orden_compra_lineas l
  left join lateral (select sum(il.cantidad) as recibido from public.ingreso_lineas il join public.ingresos_compra i on i.id = il.ingreso_id and i.estado = 'APLICADO' where il.orden_linea_id = l.id) r on true
  where l.orden_id = p_orden;
  perform set_config('fin.orden', 'si', true);
  update public.ordenes_compra set estado = case when v_rec = 0 then 'AUTORIZADA' when v_pend > 0 then 'RECIBIDA PARCIAL' else 'RECIBIDA' end
  where id = p_orden and estado in ('AUTORIZADA', 'RECIBIDA PARCIAL', 'RECIBIDA');
  perform set_config('fin.orden', '', true);
end;
$$;

create or replace function public.procesar_ingreso(p_id bigint, p_accion text, p_generar_compra boolean default true, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  i public.ingresos_compra;
  o public.ordenes_compra;
  pv public.proveedores;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_mal text;
  v_total numeric;
  v_compra bigint;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede procesar ingresos de compra.'; end if;
  select * into i from public.ingresos_compra where id = p_id for update;
  if i.id is null then raise exception 'El ingreso no existe.'; end if;
  select * into o from public.ordenes_compra where id = i.orden_id for update;
  perform set_config('fin.ingreso', 'si', true);

  if p_accion = 'APLICAR' then
    if i.estado <> 'VIGENTE' then raise exception 'El ingreso % ya está %.', i.numero, lower(i.estado); end if;
    if not exists (select 1 from public.ingreso_lineas where ingreso_id = i.id) then raise exception 'El ingreso % no tiene productos.', i.numero; end if;
    select string_agg(p.nombre, ', ') into v_mal
    from (select il.orden_linea_id, sum(il.cantidad) as cant from public.ingreso_lineas il where il.ingreso_id = i.id group by il.orden_linea_id) x
    join public.orden_lineas_saldo s on s.id = x.orden_linea_id join public.productos p on p.id = s.producto_id
    where x.cant > s.saldo;
    if v_mal is not null then raise exception 'Se recibe más de lo pendiente de la orden en: %.', v_mal; end if;
    insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, ingreso_linea_id, lote, fecha_vencimiento, usuario)
    select i.organizacion_id, i.localidad_id, il.producto_id, i.bodega_id, i.fecha_ingreso, il.cantidad, il.costo_unitario * i.tipo_cambio, 'INGRESO', il.id, il.lote, il.fecha_vencimiento, v_quien
    from public.ingreso_lineas il where il.ingreso_id = i.id;
    update public.ingreso_lineas set inventariado = true where ingreso_id = i.id;
    -- La factura de compra del ingreso (si hay documento del proveedor).
    if p_generar_compra and i.documento is not null then
      select * into pv from public.proveedores where id = i.proveedor_id;
      select round(sum(il.cantidad * il.costo_unitario), 2) - i.valor_descuento into v_total from public.ingreso_lineas il where il.ingreso_id = i.id;
      insert into public.compras (organizacion_id, localidad_id, numero, tipo_documento, serie, documento, fecha_documento, fecha_ingreso, fecha_vencimiento,
                                  proveedor_id, proveedor_codigo, proveedor_nombre, nit, transaccion_id, descripcion, moneda_id, tipo_cambio, valor_total,
                                  forma_pago, banco_destino_id, cuenta_destino, pago_inmediato, dias_credito, bodega_id, compra_inventario, regimen_isr_id)
      values (i.organizacion_id, i.localidad_id, 0, 'FACTURA', i.serie, i.documento, coalesce(i.fecha_documento, i.fecha_ingreso), i.fecha_ingreso,
              coalesce(i.fecha_documento, i.fecha_ingreso) + i.dias_credito, pv.id, pv.codigo::text, coalesce(pv.nombre_fiscal, pv.nombre_comercial), pv.nit, i.transaccion_id,
              'COMPRA GENERADA AUTOMÁTICAMENTE PARA EL INGRESO ' || i.numero || ' DE LA ORDEN ' || o.numero, i.moneda_id, i.tipo_cambio, v_total,
              pv.forma_pago, pv.banco_id, pv.cuenta_bancaria, i.forma_pago = 'CONTADO', i.dias_credito, i.bodega_id, i.numero::text, pv.regimen_isr_id)
      returning id into v_compra;
      insert into public.compra_items (compra_id, linea, descripcion, cantidad, costo_total)
      select v_compra, row_number() over (order by il.linea), p.nombre, il.cantidad, round(il.cantidad * il.costo_unitario, 2)
      from public.ingreso_lineas il join public.productos p on p.id = il.producto_id where il.ingreso_id = i.id;
    end if;
    update public.ingresos_compra set estado = 'APLICADO', aplicado_por = v_quien, aplicado_en = now(), compra_id = v_compra where id = i.id;
    perform public.recalcular_orden(o.id);
  elsif p_accion = 'REVERTIR' then
    if i.estado <> 'APLICADO' then raise exception 'Solo se revierte un ingreso aplicado.'; end if;
    if i.compra_id is not null then
      if exists (select 1 from public.compras_saldo s where s.id = i.compra_id and s.pagado > 0) then raise exception 'La compra del ingreso ya tiene pagos: anúlalos primero.'; end if;
      if exists (select 1 from public.compras c join public.partidas p on p.id = c.partida_id and p.estado = 'VIGENTE' where c.id = i.compra_id) then raise exception 'La compra del ingreso ya tiene partida: anúlala primero.'; end if;
      perform set_config('fin.compra', 'si', true);
      update public.compras set estado = 'ANULADA', anulado_por = v_quien, anulado_en = now(), motivo_anulacion = 'Reversión del ingreso ' || i.numero where id = i.compra_id;
      perform set_config('fin.compra', '', true);
    end if;
    delete from public.inventario_movimientos where ingreso_linea_id in (select id from public.ingreso_lineas where ingreso_id = i.id);
    update public.ingreso_lineas set inventariado = false where ingreso_id = i.id;
    update public.ingresos_compra set estado = 'VIGENTE', aplicado_por = null, aplicado_en = null, compra_id = null where id = i.id;
    perform public.recalcular_orden(o.id);
  elsif p_accion = 'ANULAR' then
    if i.estado <> 'VIGENTE' then raise exception 'Solo se anula un ingreso vigente (revierte primero el inventario).'; end if;
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la anulación.'; end if;
    update public.ingresos_compra set estado = 'ANULADO', anulado_por = v_quien, anulado_en = now(), motivo_anulacion = trim(p_motivo) where id = i.id;
  else
    raise exception 'Acción no válida.';
  end if;
  perform set_config('fin.ingreso', '', true);
  return jsonb_build_object('numero', i.numero, 'compra', (select c.numero from public.compras c where c.id = v_compra));
end;
$$;

-- ---------- Seguridad ----------
do $$
declare t text;
begin
  foreach t in array array['ordenes_compra', 'orden_compra_lineas', 'orden_cotizaciones', 'ingresos_compra', 'ingreso_lineas', 'inventario_movimientos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
  foreach t in array array['ordenes_compra', 'orden_compra_lineas', 'orden_cotizaciones', 'ingresos_compra', 'ingreso_lineas'] loop
    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format('drop policy if exists "%s: modificar" on public.%I', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
    execute format('grant insert, update on public.%I to authenticated', t);
  end loop;
  foreach t in array array['orden_compra_lineas', 'orden_cotizaciones', 'ingreso_lineas'] loop
    execute format('drop policy if exists "%s: quitar" on public.%I', t, t);
    execute format('create policy "%s: quitar" on public.%I for delete to authenticated using (public.puede_editar_catalogos())', t, t);
    execute format('grant delete on public.%I to authenticated', t);
  end loop;
end;
$$;
grant select on public.existencias, public.orden_lineas_saldo to authenticated;
revoke execute on function public.preparar_orden_compra() from public, anon, authenticated;
revoke execute on function public.validar_orden_linea() from public, anon, authenticated;
revoke execute on function public.preparar_ingreso_compra() from public, anon, authenticated;
revoke execute on function public.validar_ingreso_linea() from public, anon, authenticated;
revoke execute on function public.recalcular_orden(bigint) from public, anon, authenticated;
revoke execute on function public.procesar_orden(bigint, text, text) from public, anon;
revoke execute on function public.procesar_ingreso(bigint, text, boolean, text) from public, anon;
grant execute on function public.procesar_orden(bigint, text, text) to authenticated;
grant execute on function public.procesar_ingreso(bigint, text, boolean, text) to authenticated;

-- ---------- Menú: Compras · Registros · Órdenes de compra ----------
insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
select m.id, 'registros', 'Órdenes de compra', x.clave, x.nombre, coalesce((select max(orden) from public.opciones_sistema), 0) + x.n
from public.modulos_sistema m
cross join (values (1, 'solicitudes-de-compra', 'Solicitudes de compra'), (2, 'autorizaciones-de-compras', 'Autorizaciones de compras'),
                   (3, 'autorizar-ordenes', 'Autorizar órdenes'), (4, 'ordenes-de-compra', 'Órdenes de compra')) as x (n, clave, nombre)
where m.siglas = 'COM' and m.modulo_mayor_id is null
  and not exists (select 1 from public.opciones_sistema o where o.clave = x.clave and o.modulo_id = m.id);

notify pgrst, 'reload schema';
