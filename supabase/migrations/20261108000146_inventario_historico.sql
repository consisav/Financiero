-- Inventarios: estructura para migrar el historial del sistema anterior (organización 3: Futura Farma y Mavisa).
--   · tipos_movimiento_inventario: catálogo de tipos de movimiento del sistema anterior (código, descripción, siglas,
--     tipo de operación +1 entrada / −1 salida y clasificación).
--   · inventario_movimientos: columnas del kardex anterior (registro, tipo de movimiento, documento interno y físico,
--     línea, observaciones, existencias, costo total, del movimiento y promedio, estado, fecha del movimiento,
--     fabricación y origen). La llave del registro migrado es empresa + bodega + producto + registro: si ya existe,
--     se actualiza. Se agregan los orígenes del sistema anterior (devolución, cambio, cuenta ajena, pedido, orden).
--   · documentos_inventario: tipo DESPACHO (despachos de medicamentos) con sus columnas (receptor, cliente,
--     empleado, tipo de precio, IVA, entrega, efectivo, tarjeta…); fecha de contabilización, estado y origen
--     anteriores, y tipo de traslado. Líneas: precio unitario y total, tipo de precio, entregado y línea anterior.
--   · motivos_ajuste: los motivos reales del sistema anterior en la organización 3.
--   · Un documento migrado que ya estaba operado en el sistema anterior no se revierte aquí (su movimiento está en
--     el kardex histórico, no en sus líneas).
-- Se ejecuta después del script 145. Luego se ejecutan los datos (script 147 y sus partes).

-- ---------- Tipos de movimiento ----------
create table if not exists public.tipos_movimiento_inventario (
  codigo          integer primary key,
  descripcion     text not null,
  siglas          text,
  tipo_operacion  integer not null default 0 check (tipo_operacion in (-1, 0, 1)),
  clasificacion   text
);
insert into public.tipos_movimiento_inventario (codigo, descripcion, siglas, tipo_operacion, clasificacion) values
  (0, 'SIN MOVIMIENTO', 'SMO', 0, 'NUL'), (1, 'INGRESO', 'ING', 1, 'IN'), (2, 'DESPACHO', 'DES', -1, 'OUT'),
  (3, 'ENTRADA-TRASLADO', 'ETR', 1, 'IN'), (4, 'SALIDA-TRASLADO', 'STR', -1, 'OUT'), (5, 'ENTRADA-AJUSTE', 'EAJ', 1, 'IN'),
  (6, 'SALIDA-AJUSTE', 'SAJ', -1, 'OUT'), (7, 'ANULACION INGRESO', 'ANC', -1, 'OUT'), (8, 'ANULACION DESPACHO', 'AND', 1, 'IN'),
  (9, 'ANULACION ENTRADA TRASLADO', 'AET', -1, 'OUT'), (10, 'ANULACION SALIDA TRASLADO', 'AST', 1, 'IN'),
  (11, 'ANULACION ENTRADA AJUSTE', 'AEA', -1, 'OUT'), (12, 'ANULACION SALIDA AJUSTE', 'ASA', 1, 'IN'),
  (13, 'DEVOLUCIÓN SALIDA', 'SDE', -1, 'OUT'), (14, 'ANULACION SALIDA DEVOLUCIÓN', 'AND', 1, 'IN'),
  (15, 'DEVOLUCIÓN ENTRADA', 'EDE', 1, 'IN'), (16, 'ANULACION ENTRADA DEVOLUCIÓN', 'AED', -1, 'OUT'),
  (17, 'SALIDA ORDEN', 'SOR', -1, 'OUT'), (18, 'ANULACIÓN ORDEN', 'AOR', 1, 'IN'), (19, 'SALIDA - FACTURA', 'SFA', -1, 'OUT'),
  (20, 'ANULACION - FACTURA', 'AFA', 1, 'IN'), (21, 'CARGA CONSIGNACION', 'CCO', 1, 'IN'), (22, 'ANULACION CARGA CONSIGNACION', 'ACC', -1, 'OUT'),
  (23, 'CARGA, PEDIDO POR PACIENTE', 'PPP', 1, 'IN'), (24, 'ANULACION DE PEDIDO POR PACIENTE', 'APP', -1, 'OUT'),
  (25, 'ENTRADA - NCRE ELECTRÓNICA', 'ENE', 1, 'IN'), (26, 'ANULACION - NCRE ELECTRÓNICA', 'ANE', -1, 'OUT'),
  (27, 'SALIDA - NOTA CREDITO COMPRA', 'SNC', -1, 'OUT'), (28, 'ANULACION - NOTA CRÉDITO COMPRA', 'ANC', 1, 'IN'),
  (29, 'INGRESO - NOTA CRÉDITO VENTA', 'INV', 1, 'IN'), (30, 'ANULACION - NOTA CRÉDITO VENTA', 'ANV', -1, 'OUT'),
  (31, 'ENTRADA - NABN ELECTRÓNICA', 'EAE', 1, 'IN'), (32, 'ANULACION - NABN ELECTRÓNICA', 'AAE', -1, 'OUT'),
  (33, 'INGRESO CUENA AJENA', 'ICA', 1, 'IN'), (34, 'ANULACION - CUENTA AJENA', 'ACA', -1, 'OUT'),
  (35, 'ENTRADA - NOTA CREDITO COMPRA', 'ENC', 1, 'IN'), (36, 'INGRESO - CAMBIO', 'ICP', 1, 'IN'), (37, 'SALIDA - CAMBIO', 'SCP', -1, 'OUT'),
  (38, 'ANULACION - INGRESO CAMBIO', 'AIC', -1, 'OUT'), (39, 'ANULACION - SALIDA CAMBIO', 'ASC', 1, 'IN'),
  (40, 'REVERSION ENTRADA-TRASLADO', 'ETR', -1, 'OUT'), (41, 'REVERSION SALIDA-TRASLADO', 'STR', 1, 'IN'),
  (42, 'SALIDA - NCRE ELECTRÓNICA', 'SNE', -1, 'OUT'), (43, 'ENTRADA AJUSTE LOTES', 'EAL', 1, 'IN'), (44, 'SALIDA AJUSTE LOTES', 'SAL', -1, 'OUT'),
  (45, 'ANULACION ENTRADA AJUSTE LOTES', 'AEL', -1, 'OUT'), (46, 'ANULACION SALIDA AUSTE LOTES', 'ASA', 1, 'IN')
on conflict (codigo) do update set descripcion = excluded.descripcion, siglas = excluded.siglas, tipo_operacion = excluded.tipo_operacion, clasificacion = excluded.clasificacion;
alter table public.tipos_movimiento_inventario enable row level security;
drop policy if exists "tipos_movimiento_inventario: leer" on public.tipos_movimiento_inventario;
create policy "tipos_movimiento_inventario: leer" on public.tipos_movimiento_inventario for select to authenticated using (public.usuario_activo());
grant select on public.tipos_movimiento_inventario to authenticated;

-- Origen del movimiento en este sistema según el tipo del sistema anterior.
create or replace function public.origen_tipo_movimiento(p_tipo integer) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_tipo in (1, 7) then 'INGRESO'
    when p_tipo in (2, 8) then 'DESPACHO'
    when p_tipo in (3, 4, 9, 10, 40, 41) then 'TRASLADO'
    when p_tipo in (13, 14, 15, 16) then 'DEVOLUCIÓN'
    when p_tipo in (17, 18) then 'ORDEN'
    when p_tipo in (19, 20) then 'VENTA'
    when p_tipo in (21, 22) then 'CONSIGNACIÓN'
    when p_tipo in (23, 24) then 'PEDIDO'
    when p_tipo in (25, 26, 27, 28, 29, 30, 31, 32, 35, 42) then 'NOTA'
    when p_tipo in (33, 34) then 'CUENTA AJENA'
    when p_tipo in (36, 37, 38, 39) then 'CAMBIO'
    else 'AJUSTE' end;
$$;

-- ---------- Kardex histórico ----------
alter table public.inventario_movimientos drop constraint if exists inventario_movimientos_origen_check;
alter table public.inventario_movimientos add constraint inventario_movimientos_origen_check check (origen in ('INGRESO', 'COMPRA', 'NOTA', 'CONSIGNACIÓN', 'AJUSTE', 'DESPACHO', 'TRASLADO', 'VENTA', 'DEVOLUCIÓN', 'CAMBIO', 'CUENTA AJENA', 'PEDIDO', 'ORDEN'));
alter table public.inventario_movimientos
  add column if not exists tipo_movimiento      integer references public.tipos_movimiento_inventario (codigo),
  add column if not exists registro_anterior    integer,
  add column if not exists no_doc_anterior      bigint,
  add column if not exists linea_anterior       integer,
  add column if not exists documento_fisico     text,
  add column if not exists observaciones        text,
  add column if not exists existencias_anterior numeric,
  add column if not exists existencia_acumulada numeric,
  add column if not exists existencia_lote      numeric,
  add column if not exists costo_total          numeric,
  add column if not exists costo_movimiento     numeric,
  add column if not exists costo_promedio       numeric,
  add column if not exists estado_anterior      text,
  add column if not exists fecha_movimiento     timestamptz,
  add column if not exists fecha_fabricacion    date,
  add column if not exists origen_anterior      text;
create unique index if not exists inventario_movimientos_registro_anterior
  on public.inventario_movimientos (localidad_id, bodega_id, producto_id, registro_anterior) where registro_anterior is not null;

-- ---------- Documentos: despachos y datos del sistema anterior ----------
alter table public.documentos_inventario drop constraint if exists documentos_inventario_tipo_check;
alter table public.documentos_inventario add constraint documentos_inventario_tipo_check check (tipo in ('TRASLADO', 'AJUSTE LOTE', 'AJUSTE PRODUCTO', 'DEVOLUCIÓN', 'DESPACHO'));
alter table public.documentos_inventario
  add column if not exists origen_anterior     text,
  add column if not exists estado_anterior     text,
  add column if not exists fecha_conta         timestamptz,
  add column if not exists tipo_traslado       text,
  add column if not exists receptor            text,
  add column if not exists tipo_receptor       text,
  add column if not exists cliente_codigo      integer,
  add column if not exists empleado_codigo     integer,
  add column if not exists tipo_precio_codigo  text,
  add column if not exists pct_iva             numeric,
  add column if not exists fecha_entrega       date,
  add column if not exists tipo_despacho       text,
  add column if not exists efectivo            numeric,
  add column if not exists tarjeta             numeric,
  add column if not exists empresa_codigo      integer,
  add column if not exists aplicar_desglose    text,
  add column if not exists direccion_entrega   text,
  add column if not exists nombre_repenvio     text,
  add column if not exists direccion_repenvio  text;
alter table public.documento_inventario_lineas
  add column if not exists precio_unitario     numeric,
  add column if not exists precio_total        numeric,
  add column if not exists tipo_precio_codigo  integer,
  add column if not exists entregado           text,
  add column if not exists linea_anterior      integer;
-- El historial trae líneas con cantidad cero.
alter table public.documento_inventario_lineas drop constraint if exists documento_inventario_lineas_cantidad_check;
alter table public.documento_inventario_lineas add constraint documento_inventario_lineas_cantidad_check check (cantidad >= 0);
-- Y algunos ajustes con costo negativo (se conservan como venían).
alter table public.documento_inventario_lineas drop constraint if exists documento_inventario_lineas_costo_unitario_check;

-- El motivo solo se exige en los ajustes y las devoluciones (el despacho no lo lleva).
create or replace function public.preparar_documento_inventario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_u text; v_n text;
begin
  if current_setting('fin.docinv', true) is distinct from 'si' then
    select upper(x.usuario), x.nombre into v_u, v_n from public.perfiles x where x.id = (select auth.uid());
    if tg_op = 'INSERT' then
      perform pg_advisory_xact_lock(hashtext('docinv' || new.tipo), new.localidad_id::integer);
      new.numero := coalesce((select max(numero) from public.documentos_inventario where localidad_id = new.localidad_id and tipo = new.tipo), 0) + 1;
      new.estado := 'REGISTRADO'; new.operado_por := null; new.operado_en := null;
      new.anulado_por := null; new.anulado_en := null; new.motivo_anulacion := null;
      new.usuario := coalesce(v_u, 'SISTEMA'); new.usuario_nombre := coalesce(v_n, '');
      new.organizacion_id := (select l.organizacion_id from public.localidades l where l.id = new.localidad_id);
    else
      if old.estado <> 'REGISTRADO' then raise exception 'El documento % está %: ya no se modifica.', old.numero, lower(old.estado); end if;
      new.numero := old.numero; new.estado := old.estado; new.tipo := old.tipo; new.usuario := old.usuario; new.usuario_nombre := old.usuario_nombre;
      new.localidad_id := old.localidad_id; new.organizacion_id := old.organizacion_id;
    end if;
  end if;
  if not exists (select 1 from public.bodegas b where b.id = new.bodega_id and b.localidad_id = new.localidad_id) then raise exception 'La bodega no es de la empresa.'; end if;
  if new.tipo = 'TRASLADO' then
    if new.bodega_destino_id is null then raise exception 'Elige la bodega destino.'; end if;
    if new.bodega_destino_id = new.bodega_id then raise exception 'La bodega destino debe ser distinta de la de origen.'; end if;
    if not exists (select 1 from public.bodegas b where b.id = new.bodega_destino_id and b.localidad_id = new.localidad_id) then raise exception 'La bodega destino no es de la empresa.'; end if;
    new.motivo_id := null; new.direccion := null;
  elsif new.tipo = 'DESPACHO' then
    new.bodega_destino_id := null; new.direccion := 'DISMINUIR';
  else
    new.bodega_destino_id := null;
    if new.motivo_id is null then raise exception 'Elige el motivo del ajuste.'; end if;
    if new.tipo = 'AJUSTE PRODUCTO' then new.direccion := coalesce(new.direccion, 'AÑADIR');
    elsif new.tipo = 'DEVOLUCIÓN' then new.direccion := coalesce(new.direccion, 'DISMINUIR');
    else new.direccion := null; end if;
    if new.compra_id is not null and not exists (select 1 from public.compras c where c.id = new.compra_id and c.localidad_id = new.localidad_id) then raise exception 'La compra de ingreso no es de la empresa.'; end if;
  end if;
  new.descripcion := nullif(upper(trim(new.descripcion)), '');
  new.referencia := nullif(upper(trim(new.referencia)), '');
  if new.tipo <> 'DEVOLUCIÓN' then new.compra_id := null; new.referencia := null; end if;
  return new;
end;
$$;

-- Un documento migrado que ya venía operado no se revierte ni se vuelve a operar aquí.
create or replace function public.procesar_documento_inventario(p_id bigint, p_accion text, p_motivo text default null, p_forzar boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.documentos_inventario;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_n integer := 0; v_mal text; v_fecha date; v_sale boolean;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para procesar documentos de inventario.'; end if;
  select * into d from public.documentos_inventario where id = p_id for update;
  if d.id is null then raise exception 'El documento no existe.'; end if;
  if d.origen_anterior = 'MIGRADO' and d.estado <> 'REGISTRADO'
     and not exists (select 1 from public.inventario_movimientos m join public.documento_inventario_lineas l on l.id = m.documento_linea_id where l.documento_id = d.id) then
    raise exception 'El documento % viene del sistema anterior: su movimiento está en el kardex histórico y no se revierte ni se anula aquí.', d.numero;
  end if;
  perform set_config('fin.docinv', 'si', true);
  v_fecha := (d.fecha at time zone 'America/Guatemala')::date;
  v_sale := d.tipo in ('TRASLADO', 'AJUSTE LOTE', 'DESPACHO') or d.direccion = 'DISMINUIR';
  if p_accion = 'OPERAR' then
    if d.estado <> 'REGISTRADO' then raise exception 'El documento % está %.', d.numero, lower(d.estado); end if;
    if not exists (select 1 from public.documento_inventario_lineas where documento_id = d.id) then raise exception 'Agrega los productos del documento %.', d.numero; end if;
    if v_sale and not coalesce(p_forzar, false) then
      select string_agg(p.nombre || coalesce(' · lote ' || x.lote, '') || ' (existencia ' || trim(to_char(coalesce(e.ex, 0), 'FM999G999G990D####')) || ', se requiere ' || trim(to_char(x.cant, 'FM999G999G990D####')) || ')', '; ') into v_mal
      from (select producto_id, lote, sum(cantidad) as cant from public.documento_inventario_lineas where documento_id = d.id group by 1, 2) x
      join public.productos p on p.id = x.producto_id
      left join lateral (select sum(m.cantidad) as ex from public.inventario_movimientos m
                         where m.producto_id = x.producto_id and m.bodega_id = d.bodega_id and coalesce(m.lote, '') = coalesce(x.lote, '')) e on true
      where x.cant > coalesce(e.ex, 0);
      if v_mal is not null then raise exception 'EXISTENCIA: No hay existencia suficiente en la bodega para: %.', v_mal; end if;
    end if;
    if d.tipo = 'TRASLADO' then
      insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, lote, fecha_vencimiento, usuario, documento_linea_id)
      select d.organizacion_id, d.localidad_id, l.producto_id, d.bodega_id, v_fecha, -l.cantidad, l.costo_unitario, 'TRASLADO', l.lote, l.fecha_vencimiento, v_quien, l.id
      from public.documento_inventario_lineas l where l.documento_id = d.id
      union all
      select d.organizacion_id, d.localidad_id, l.producto_id, d.bodega_destino_id, v_fecha, l.cantidad, l.costo_unitario, 'TRASLADO', l.lote, l.fecha_vencimiento, v_quien, l.id
      from public.documento_inventario_lineas l where l.documento_id = d.id;
    elsif d.tipo = 'AJUSTE LOTE' then
      insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, lote, fecha_vencimiento, usuario, documento_linea_id)
      select d.organizacion_id, d.localidad_id, l.producto_id, d.bodega_id, v_fecha, -l.cantidad, l.costo_unitario, 'AJUSTE', l.lote, l.fecha_vencimiento, v_quien, l.id
      from public.documento_inventario_lineas l where l.documento_id = d.id
      union all
      select d.organizacion_id, d.localidad_id, l.producto_id, d.bodega_id, v_fecha, l.cantidad, l.costo_unitario, 'AJUSTE', l.nuevo_lote, l.nuevo_vencimiento, v_quien, l.id
      from public.documento_inventario_lineas l where l.documento_id = d.id;
    else
      insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, lote, fecha_vencimiento, usuario, documento_linea_id)
      select d.organizacion_id, d.localidad_id, l.producto_id, d.bodega_id, v_fecha, case when d.direccion = 'DISMINUIR' then -l.cantidad else l.cantidad end,
             l.costo_unitario, case when d.tipo = 'DESPACHO' then 'DESPACHO' else 'AJUSTE' end, l.lote, l.fecha_vencimiento, v_quien, l.id
      from public.documento_inventario_lineas l where l.documento_id = d.id;
    end if;
    get diagnostics v_n = row_count;
    update public.documentos_inventario set estado = 'OPERADO', operado_por = v_quien, operado_en = now() where id = d.id;
  elsif p_accion = 'REVERTIR' then
    if d.estado <> 'OPERADO' then raise exception 'El documento % no está operado.', d.numero; end if;
    delete from public.inventario_movimientos where documento_linea_id in (select id from public.documento_inventario_lineas where documento_id = d.id);
    get diagnostics v_n = row_count;
    update public.documentos_inventario set estado = 'REGISTRADO', operado_por = null, operado_en = null where id = d.id;
  elsif p_accion = 'ANULAR' then
    if d.estado <> 'REGISTRADO' then raise exception 'Solo se anula un documento registrado (revierte primero el movimiento).'; end if;
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la anulación.'; end if;
    update public.documentos_inventario set estado = 'ANULADO', anulado_por = v_quien, anulado_en = now(), motivo_anulacion = upper(trim(p_motivo)) where id = d.id;
  else
    raise exception 'Acción no válida.';
  end if;
  perform set_config('fin.docinv', '', true);
  return jsonb_build_object('numero', d.numero, 'movimientos', v_n);
end;
$$;

-- ---------- Motivos de ajuste reales (organización 3) ----------
insert into public.motivos_ajuste (organizacion_id, codigo, nombre)
select o.id, m.codigo, m.nombre from public.organizaciones o
cross join (values (1, 'FALTANTE EN BODEGA'), (2, 'PRODUCTO VENCIDO'), (3, 'PRODUCTO DAÑADO'), (4, 'SOBRANTE'), (5, 'TRASLADO INCORRECTO'),
                   (6, 'CUADRE INVENTARIO'), (7, 'TRITURACION'), (8, 'INCINERACION'), (9, 'REGALIAS'), (10, 'AJUSTE DE LOTES')) as m(codigo, nombre)
where o.codigo::text = '3'
on conflict (organizacion_id, codigo) do update set nombre = excluded.nombre, activo = true;

notify pgrst, 'reload schema';
