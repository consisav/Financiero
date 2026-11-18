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
