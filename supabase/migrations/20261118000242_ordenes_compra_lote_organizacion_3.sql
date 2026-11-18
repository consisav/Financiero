-- Script 242 · parte 1 de 2 · Organización 3 (lote del 05-11-2026 al 17-11-2026): catálogos que faltan y 2 órdenes de compra (ACT_ORDENES_COMPRA.xls).
-- Se ejecuta después del script 233 (proveedores). Lógica del script 196 (organización 2) con lo propio de Futura Farma:
--   moneda y tipo de cambio (MONEDA, TIPO_CAMBIO), precio y total en dólares de las líneas (VALOR_UNITARIO_MI, VALOR_TOTAL_MI: columnas nuevas),
--   el producto por su código y, si el folio ya lo usa otra orden, el siguiente libre (como el script 175). Se puede ejecutar de nuevo: actualiza lo migrado.
-- Columnas del sistema anterior que no existían en las órdenes de compra.
alter table public.ordenes_compra add column if not exists orden_anterior integer;
alter table public.ordenes_compra add column if not exists codigo_orden_anterior text;
alter table public.ordenes_compra add column if not exists orden_mes_anterior integer;
alter table public.ordenes_compra add column if not exists orden_original_anterior integer;
alter table public.ordenes_compra add column if not exists orden_original_id bigint references public.ordenes_compra (id) on delete set null;
alter table public.ordenes_compra add column if not exists estado_anterior text;
alter table public.ordenes_compra add column if not exists proceso_anterior integer;
alter table public.ordenes_compra add column if not exists bodega_anterior integer;
alter table public.ordenes_compra add column if not exists proveedor_anterior integer;
alter table public.ordenes_compra add column if not exists forma_pago_anterior text;
alter table public.ordenes_compra add column if not exists usuario_ingresa_anterior text;
alter table public.ordenes_compra add column if not exists fecha_ingresa_anterior timestamp;
alter table public.ordenes_compra add column if not exists usuario_aprueba_anterior text;
alter table public.ordenes_compra add column if not exists fecha_aprueba_anterior timestamp;
alter table public.ordenes_compra add column if not exists usuario_modifica_anterior text;
alter table public.ordenes_compra add column if not exists fecha_modifica_anterior timestamp;
alter table public.ordenes_compra add column if not exists documento_anterior text;
alter table public.ordenes_compra add column if not exists serie_documento_anterior text;
alter table public.ordenes_compra add column if not exists tipo_documento_anterior integer;
alter table public.ordenes_compra add column if not exists fecha_documento_anterior date;
alter table public.ordenes_compra add column if not exists valor_total_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists total_nc_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists descuentos_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists descuentos_nd_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists bonificaciones_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists total_sin_descuentos_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists tipo_transaccion_anterior integer;
alter table public.ordenes_compra add column if not exists tipo_compra_anterior text;
alter table public.ordenes_compra add column if not exists clasificacion_anterior integer;
alter table public.ordenes_compra add column if not exists bodega_ingreso_anterior integer;
alter table public.ordenes_compra add column if not exists compra_ingreso_anterior integer;
alter table public.ordenes_compra add column if not exists aviso_enviado boolean;
alter table public.ordenes_compra add column if not exists fecha_aviso timestamp;
alter table public.ordenes_compra add column if not exists origen_anterior text;
create unique index if not exists ordenes_compra_orden_anterior_key on public.ordenes_compra (localidad_id, orden_anterior) where orden_anterior is not null;
alter table public.orden_compra_lineas add column if not exists producto_anterior integer;
alter table public.orden_compra_lineas add column if not exists cantidad_anterior numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists cantidad_solicitada_anterior numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists aprobado_anterior text;
alter table public.orden_compra_lineas add column if not exists usuario_aprueba_anterior text;
alter table public.orden_compra_lineas add column if not exists fecha_aprueba_anterior timestamp;
alter table public.orden_compra_lineas add column if not exists usuario_modifica_anterior text;
alter table public.orden_compra_lineas add column if not exists fecha_modifica_anterior timestamp;
alter table public.orden_compra_lineas add column if not exists ultimo_proveedor_anterior integer;
alter table public.orden_compra_lineas add column if not exists proveedor_asignado_anterior integer;
alter table public.orden_compra_lineas add column if not exists existencia_bc numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists existencia_anterior numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists minimo_actual numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists maximo_actual numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists valor_total_anterior numeric(18, 2);
alter table public.orden_compra_lineas add column if not exists forma_pago_anterior text;
alter table public.orden_compra_lineas add column if not exists dias_credito_anterior integer;
alter table public.orden_compra_lineas add column if not exists costo_unitario_compra numeric(18, 4);
alter table public.orden_compra_lineas add column if not exists costo_total_pre numeric(18, 2);
alter table public.orden_compra_lineas add column if not exists costo_total_anterior numeric(18, 2);
alter table public.orden_compra_lineas add column if not exists exento_iva boolean;
alter table public.orden_compra_lineas add column if not exists ingreso_anterior boolean;
alter table public.bodegas add column if not exists codigo_anterior integer;
alter table public.ordenes_compra add column if not exists moneda_anterior integer;
alter table public.orden_compra_lineas add column if not exists precio_unitario_mi_anterior numeric(18, 4);
alter table public.orden_compra_lineas add column if not exists valor_total_mi_anterior numeric(18, 2);

do $oc$
declare
  v_org bigint; v_loc bigint; v_gtq bigint; v_usd bigint; v_id bigint; v_folio int; v_prov bigint; v_bod bigint; v_cod int; r record; v_l record;
  f_n int := 0; p_n int := 0; b_n int := 0; o_n int := 0; o_a int := 0;
begin
  select id into v_org from public.organizaciones where codigo::text = '3';
  if v_org is null then raise notice 'No existe la organización 3.'; return; end if;
  select id into v_gtq from public.monedas where iso = 'GTQ';
  if v_gtq is null then raise exception 'No existe la moneda GTQ.'; end if;
  select id into v_usd from public.monedas where iso = 'USD';

  -- b) Proveedores de las órdenes: se ligan por su código; si no existe (los proveedores aún no se migran), se crea con
  --    «PROVEEDOR n (CREADO AL MIGRAR ÓRDENES DE COMPRA)» para revisar. Las órdenes sin proveedor (0 o vacío) llevan
  --    «PROVEEDOR NO DEFINIDO (ÓRDENES DE COMPRA MIGRADAS)», código 999999.
  for r in select * from (values (1, 3091)) as x(loc, codigo) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then continue; end if;
    if exists (select 1 from public.proveedores where localidad_id = v_loc and codigo = r.codigo) then continue; end if;
    insert into public.proveedores (organizacion_id, localidad_id, codigo, nombre_comercial, concepto_gastos, pendiente_revisar)
    values (v_org, v_loc, r.codigo, case when r.codigo = 999999 then 'PROVEEDOR NO DEFINIDO (ÓRDENES DE COMPRA MIGRADAS)'
                                         else 'PROVEEDOR ' || r.codigo || ' (CREADO AL MIGRAR ÓRDENES DE COMPRA)' end, 'POR DEFINIR', true);
    p_n := p_n + 1;
  end loop;

  -- c) Bodegas de las órdenes: se ligan por su código; si no existe, se crea.
  for r in select * from (values (1, 2)) as x(loc, codigo) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then continue; end if;
    if exists (select 1 from public.bodegas where localidad_id = v_loc and (codigo_anterior = r.codigo or (codigo_anterior is null and codigo = r.codigo))) then continue; end if;
    v_cod := case when exists (select 1 from public.bodegas where localidad_id = v_loc and codigo = r.codigo) then (select max(codigo) + 1 from public.bodegas where localidad_id = v_loc) else r.codigo end;
    insert into public.bodegas (organizacion_id, localidad_id, codigo, nombre, codigo_anterior)
    values (v_org, v_loc, v_cod, 'BODEGA ' || r.codigo || ' (CREADA AL MIGRAR ÓRDENES DE COMPRA)', r.codigo);
    b_n := b_n + 1;
  end loop;

  -- d) Las órdenes: estado COT y ECT (cotización) → INGRESADA, EAU → EN AUTORIZACIÓN, AUT → AUTORIZADA; forma de pago R → CRÉDITO, C → CONTADO.
  --    El número de la orden (COD_ORDEN) y el folio (ORDEN) se conservan; los datos del sistema anterior quedan en las columnas *_anterior.
  alter table public.ordenes_compra disable trigger user;
  for r in select * from (values
    (1::int, 33::int, '2026-11-11'::date, '004-11-FF-2026'::text, 'AUTORIZADA'::text, 3091::int, 2::int, 90::int, 'CRÉDITO'::text, 4::int, 'AUT'::text, null::text, 'NOG 32419708 IGSS ZACAPA'::text, 'R'::text, 'KER'::text, '2026-11-11 11:49:14'::timestamp, 'OLM'::text, '2026-11-11 12:56:31'::timestamp, 'OLM'::text, '2026-11-11 12:56:31'::timestamp, null::text, null::text, 3::int, null::date, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::int, null::text, null::int, null::int, null::int, 4::int, false::boolean, null::timestamp, null::text, null::int, 3091::int, 1, 8),
    (1, 34, '2026-11-11', '005-11-FF-2026', 'AUTORIZADA', 3091, 2, 90, 'CRÉDITO', 5, 'AUT', null, 'NOG 32456476 IGSS CHIMALTENANGO', 'R', 'KER', '2026-11-11 11:51:48', 'OLM', '2026-11-11 12:56:25', 'OLM', '2026-11-11 12:56:25', null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 4, false, null, null, null, 3091, 1, 8)) as x(loc, orden, fecha, numero, estado, proveedor, bodega, dias, forma_pago, orden_mes, estado_ant, obs, obs_prov, fp_ant, usr_ing, f_ing, usr_apr, f_apr, usr_mod, f_mod,
       documento, serie, tipo_doc, fecha_doc, valor_total, total_nc, descuentos, descuentos_nd, bonificaciones, total_sin_desc, tipo_trans, tipo_compra, clasificacion, bodega_ingreso, compra_ingreso,
       proceso, aviso, f_aviso, nada, orden_original, proveedor_ant, moneda, tc) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then continue; end if;
    select id into v_prov from public.proveedores where localidad_id = v_loc and codigo = coalesce(r.proveedor, 999999);
    select id into v_bod from public.bodegas where localidad_id = v_loc and (codigo_anterior = r.bodega or (codigo_anterior is null and codigo = r.bodega))
      order by (codigo_anterior = r.bodega) desc nulls last limit 1;
    if v_prov is null or v_bod is null then raise exception 'Orden 3-0% %: falta su proveedor o su bodega.', r.loc, r.orden; end if;
    v_id := null;
    select id into v_id from public.ordenes_compra where localidad_id = v_loc and orden_anterior = r.orden;
    if v_id is null then
      v_folio := case when exists (select 1 from public.ordenes_compra where localidad_id = v_loc and folio = r.orden)
                      then (select coalesce(max(folio), 0) + 1 from public.ordenes_compra where localidad_id = v_loc) else r.orden end;
      if v_folio <> r.orden then f_n := f_n + 1; end if;
      insert into public.ordenes_compra (organizacion_id, localidad_id, folio, fecha, proveedor_id, moneda_id, bodega_id, orden_anterior)
      values (v_org, v_loc, v_folio, r.fecha, v_prov, v_gtq, v_bod, r.orden) returning id into v_id;
      o_n := o_n + 1;
    else
      o_a := o_a + 1;
    end if;
    update public.ordenes_compra set
      numero = r.numero, fecha = r.fecha, estado = r.estado, proveedor_id = v_prov, bodega_id = v_bod, moneda_id = case when r.moneda = 2 then coalesce(v_usd, v_gtq) else v_gtq end, tipo_cambio = coalesce(nullif(r.tc, 0), 1), moneda_anterior = r.moneda,
      tipo_proveedor_id = (select p.tipo_proveedor_id from public.proveedores p where p.id = v_prov),
      forma_pago = r.forma_pago, dias_credito = case when r.forma_pago = 'CRÉDITO' then coalesce(r.dias, 0) else 0 end,
      observaciones_internas = r.obs, observaciones_proveedor = r.obs_prov,
      usuario = r.usr_ing, aprobado_por = r.usr_apr, aprobado_en = r.f_apr at time zone 'America/Guatemala',
      creado_por_nombre = r.usr_ing, creado_en = r.f_ing at time zone 'America/Guatemala',
      modificado_por_nombre = r.usr_mod, modificado_en = r.f_mod at time zone 'America/Guatemala',
      codigo_orden_anterior = r.numero, orden_mes_anterior = r.orden_mes, orden_original_anterior = r.orden_original, estado_anterior = r.estado_ant,
      proceso_anterior = r.proceso, bodega_anterior = r.bodega, proveedor_anterior = r.proveedor_ant, forma_pago_anterior = r.fp_ant,
      usuario_ingresa_anterior = r.usr_ing, fecha_ingresa_anterior = r.f_ing, usuario_aprueba_anterior = r.usr_apr, fecha_aprueba_anterior = r.f_apr,
      usuario_modifica_anterior = r.usr_mod, fecha_modifica_anterior = r.f_mod, documento_anterior = r.documento, serie_documento_anterior = r.serie,
      tipo_documento_anterior = r.tipo_doc, fecha_documento_anterior = r.fecha_doc, valor_total_anterior = r.valor_total, total_nc_anterior = r.total_nc,
      descuentos_anterior = r.descuentos, descuentos_nd_anterior = r.descuentos_nd, bonificaciones_anterior = r.bonificaciones, total_sin_descuentos_anterior = r.total_sin_desc,
      tipo_transaccion_anterior = r.tipo_trans, tipo_compra_anterior = r.tipo_compra, clasificacion_anterior = r.clasificacion, bodega_ingreso_anterior = r.bodega_ingreso,
      compra_ingreso_anterior = r.compra_ingreso, aviso_enviado = r.aviso, fecha_aviso = r.f_aviso, origen_anterior = 'MIGRADO'
    where id = v_id;
  end loop;
  -- La orden original (la cotización de la que salió cada orden «-A-»).
  update public.ordenes_compra o set orden_original_id = x.id
  from public.ordenes_compra x
  where o.organizacion_id = v_org and o.orden_original_anterior is not null and x.localidad_id = o.localidad_id and x.orden_anterior = o.orden_original_anterior;
  alter table public.ordenes_compra enable trigger user;

  raise notice '%', format('Órdenes con otro folio (el suyo ya estaba ocupado): %s. Creados: %s proveedores y %s bodegas. Órdenes nuevas: %s; actualizadas: %s. Sigue con la parte 2.', f_n, p_n, b_n, o_n, o_a);
end;
$oc$;
-- Script 242 · parte 2 de 2 · Organización 3 (lote del 05-11-2026 al 17-11-2026): las 2 líneas de las órdenes de compra (ACT_DETALLE_ORDENES_COM.xls).
-- Se ejecuta después de la parte 1. Se puede ejecutar de nuevo: actualiza las líneas migradas.
-- Columnas del sistema anterior que no existían en las órdenes de compra.
alter table public.ordenes_compra add column if not exists orden_anterior integer;
alter table public.ordenes_compra add column if not exists codigo_orden_anterior text;
alter table public.ordenes_compra add column if not exists orden_mes_anterior integer;
alter table public.ordenes_compra add column if not exists orden_original_anterior integer;
alter table public.ordenes_compra add column if not exists orden_original_id bigint references public.ordenes_compra (id) on delete set null;
alter table public.ordenes_compra add column if not exists estado_anterior text;
alter table public.ordenes_compra add column if not exists proceso_anterior integer;
alter table public.ordenes_compra add column if not exists bodega_anterior integer;
alter table public.ordenes_compra add column if not exists proveedor_anterior integer;
alter table public.ordenes_compra add column if not exists forma_pago_anterior text;
alter table public.ordenes_compra add column if not exists usuario_ingresa_anterior text;
alter table public.ordenes_compra add column if not exists fecha_ingresa_anterior timestamp;
alter table public.ordenes_compra add column if not exists usuario_aprueba_anterior text;
alter table public.ordenes_compra add column if not exists fecha_aprueba_anterior timestamp;
alter table public.ordenes_compra add column if not exists usuario_modifica_anterior text;
alter table public.ordenes_compra add column if not exists fecha_modifica_anterior timestamp;
alter table public.ordenes_compra add column if not exists documento_anterior text;
alter table public.ordenes_compra add column if not exists serie_documento_anterior text;
alter table public.ordenes_compra add column if not exists tipo_documento_anterior integer;
alter table public.ordenes_compra add column if not exists fecha_documento_anterior date;
alter table public.ordenes_compra add column if not exists valor_total_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists total_nc_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists descuentos_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists descuentos_nd_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists bonificaciones_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists total_sin_descuentos_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists tipo_transaccion_anterior integer;
alter table public.ordenes_compra add column if not exists tipo_compra_anterior text;
alter table public.ordenes_compra add column if not exists clasificacion_anterior integer;
alter table public.ordenes_compra add column if not exists bodega_ingreso_anterior integer;
alter table public.ordenes_compra add column if not exists compra_ingreso_anterior integer;
alter table public.ordenes_compra add column if not exists aviso_enviado boolean;
alter table public.ordenes_compra add column if not exists fecha_aviso timestamp;
alter table public.ordenes_compra add column if not exists origen_anterior text;
create unique index if not exists ordenes_compra_orden_anterior_key on public.ordenes_compra (localidad_id, orden_anterior) where orden_anterior is not null;
alter table public.orden_compra_lineas add column if not exists producto_anterior integer;
alter table public.orden_compra_lineas add column if not exists cantidad_anterior numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists cantidad_solicitada_anterior numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists aprobado_anterior text;
alter table public.orden_compra_lineas add column if not exists usuario_aprueba_anterior text;
alter table public.orden_compra_lineas add column if not exists fecha_aprueba_anterior timestamp;
alter table public.orden_compra_lineas add column if not exists usuario_modifica_anterior text;
alter table public.orden_compra_lineas add column if not exists fecha_modifica_anterior timestamp;
alter table public.orden_compra_lineas add column if not exists ultimo_proveedor_anterior integer;
alter table public.orden_compra_lineas add column if not exists proveedor_asignado_anterior integer;
alter table public.orden_compra_lineas add column if not exists existencia_bc numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists existencia_anterior numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists minimo_actual numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists maximo_actual numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists valor_total_anterior numeric(18, 2);
alter table public.orden_compra_lineas add column if not exists forma_pago_anterior text;
alter table public.orden_compra_lineas add column if not exists dias_credito_anterior integer;
alter table public.orden_compra_lineas add column if not exists costo_unitario_compra numeric(18, 4);
alter table public.orden_compra_lineas add column if not exists costo_total_pre numeric(18, 2);
alter table public.orden_compra_lineas add column if not exists costo_total_anterior numeric(18, 2);
alter table public.orden_compra_lineas add column if not exists exento_iva boolean;
alter table public.orden_compra_lineas add column if not exists ingreso_anterior boolean;
alter table public.bodegas add column if not exists codigo_anterior integer;
alter table public.ordenes_compra add column if not exists moneda_anterior integer;
alter table public.orden_compra_lineas add column if not exists precio_unitario_mi_anterior numeric(18, 4);
alter table public.orden_compra_lineas add column if not exists valor_total_mi_anterior numeric(18, 2);

do $ol$
declare
  v_org bigint; v_loc bigint; v_ord bigint; v_prod bigint; r record; v_cache text := ''; l_n int := 0; l_a int := 0; v_ins boolean;
begin
  select id into v_org from public.organizaciones where codigo::text = '3';
  if v_org is null then raise notice 'No existe la organización 3.'; return; end if;
  -- Cantidad solicitada: CANTIDAD_SOLICITADA (en las cotizaciones CANTIDAD viene en 0); si no trae, CANTIDAD.
  -- Se aprueba: APROBADO = S. Precio unitario: VALOR_UNITARIO. El producto se busca por su código anterior (script 195).
  alter table public.orden_compra_lineas disable trigger user;
  for r in select * from (values
    (1::int, 33::int, 1::int, 152::int, 300::numeric, 300::numeric, true::boolean, 236.08::numeric, 0::numeric, 300::numeric, 'S'::text, 'OLM'::text, '2026-11-11 00:00:00'::timestamp, 'OLM'::text, '2026-11-11 00:00:00'::timestamp, null::int, null::int, null::numeric, null::numeric, null::numeric, null::numeric, 70824::numeric, 'R'::text, null::int, null::numeric, null::numeric, null::numeric, false::boolean, null::boolean, 29.51, 8853),
    (1, 34, 1, 152, 300, 300, true, 236.08, 0, 300, 'S', 'OLM', '2026-11-11 00:00:00', 'OLM', '2026-11-11 00:00:00', null, null, null, null, null, null, 70824, 'R', null, null, null, null, false, null, 29.51, 8853)) as x(loc, orden, linea, producto, solicitada, aprobada, aprueba, precio, cantidad_ant, solicitada_ant, aprobado_ant, usr_apr, f_apr, usr_mod, f_mod,
       ultimo_prov, prov_asignado, existencia_bc, existencia, minimo, maximo, valor_total, forma_pago, dias_credito, costo_unit, costo_pre, costo_total, exento, ingreso, precio_mi, total_mi) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then continue; end if;
    select id into v_ord from public.ordenes_compra where localidad_id = v_loc and orden_anterior = r.orden;
    if v_ord is null then raise exception 'No existe la orden 3-0% % del sistema anterior: ejecuta primero la parte 1 del script 242.', r.loc, r.orden; end if;
    select id into v_prod from public.productos where localidad_id = v_loc and (codigo_anterior = r.producto or (codigo_anterior is null and codigo = r.producto))
      order by (codigo_anterior = r.producto) desc nulls last limit 1;
    if v_prod is null then raise exception 'No existe el producto 3-0% % del sistema anterior: créalo antes en Inventarios (no viene en este lote).', r.loc, r.producto; end if;
    insert into public.orden_compra_lineas (orden_id, linea, producto_id, cantidad_solicitada, cantidad_aprobada, aprueba, precio_unitario,
      producto_anterior, cantidad_anterior, cantidad_solicitada_anterior, aprobado_anterior, usuario_aprueba_anterior, fecha_aprueba_anterior,
      usuario_modifica_anterior, fecha_modifica_anterior, ultimo_proveedor_anterior, proveedor_asignado_anterior, existencia_bc, existencia_anterior,
      minimo_actual, maximo_actual, valor_total_anterior, forma_pago_anterior, dias_credito_anterior, costo_unitario_compra, costo_total_pre, costo_total_anterior,
      exento_iva, ingreso_anterior, precio_unitario_mi_anterior, valor_total_mi_anterior)
    values (v_ord, r.linea, v_prod, r.solicitada, r.aprobada, r.aprueba, coalesce(r.precio, 0),
      r.producto, r.cantidad_ant, r.solicitada_ant, r.aprobado_ant, r.usr_apr, r.f_apr, r.usr_mod, r.f_mod, r.ultimo_prov, r.prov_asignado, r.existencia_bc, r.existencia,
      r.minimo, r.maximo, r.valor_total, r.forma_pago, r.dias_credito, r.costo_unit, r.costo_pre, r.costo_total, r.exento, r.ingreso, r.precio_mi, r.total_mi)
    on conflict (orden_id, linea) do update set
      producto_id = excluded.producto_id, cantidad_solicitada = excluded.cantidad_solicitada, cantidad_aprobada = excluded.cantidad_aprobada, aprueba = excluded.aprueba,
      precio_unitario = excluded.precio_unitario, producto_anterior = excluded.producto_anterior, cantidad_anterior = excluded.cantidad_anterior,
      cantidad_solicitada_anterior = excluded.cantidad_solicitada_anterior, aprobado_anterior = excluded.aprobado_anterior, usuario_aprueba_anterior = excluded.usuario_aprueba_anterior,
      fecha_aprueba_anterior = excluded.fecha_aprueba_anterior, usuario_modifica_anterior = excluded.usuario_modifica_anterior, fecha_modifica_anterior = excluded.fecha_modifica_anterior,
      ultimo_proveedor_anterior = excluded.ultimo_proveedor_anterior, proveedor_asignado_anterior = excluded.proveedor_asignado_anterior, existencia_bc = excluded.existencia_bc,
      existencia_anterior = excluded.existencia_anterior, minimo_actual = excluded.minimo_actual, maximo_actual = excluded.maximo_actual, valor_total_anterior = excluded.valor_total_anterior,
      forma_pago_anterior = excluded.forma_pago_anterior, dias_credito_anterior = excluded.dias_credito_anterior, costo_unitario_compra = excluded.costo_unitario_compra,
      costo_total_pre = excluded.costo_total_pre, costo_total_anterior = excluded.costo_total_anterior, exento_iva = excluded.exento_iva, ingreso_anterior = excluded.ingreso_anterior,
      precio_unitario_mi_anterior = excluded.precio_unitario_mi_anterior, valor_total_mi_anterior = excluded.valor_total_mi_anterior
    returning (xmax = 0) into v_ins;
    if v_ins then l_n := l_n + 1; else l_a := l_a + 1; end if;
  end loop;
  alter table public.orden_compra_lineas enable trigger user;
  raise notice '%', format('Líneas de órdenes de compra nuevas: %s; actualizadas: %s.', l_n, l_a);
end;
$ol$;

notify pgrst, 'reload schema';
