-- Script 243 · Organización 3 (Futura Farma - Mavisa), lote del 05-11-2026 al 17-11-2026: notas de crédito y débito de proveedores (Compras ›
--   Notas crédito compras), de ACT_NOTAS_COMPRAS.xls (5 notas: 3-02 410 (VIGENTE), 3-02 411 (VIGENTE), 3-02 412 (OPERADA), 3-02 413 (VIGENTE), 3-02 414 (VIGENTE)) y ACT_DET_NOTAS_COMPRAS.xls (5 líneas).
--   Es la primera carga de notas de compras del sistema anterior (las del lote al 04-11-2026 no se habían migrado).
--   1. Una nota se identifica por su localidad y su número NOTA (columna nueva nota_anterior) y conserva ese número; si ya lo usa una nota
--      hecha en este sistema, toma el siguiente libre. Las líneas, por su nota y LINEA. Si ya existen se actualizan.
--   2. Columnas nuevas (traen datos y no existían):
--      notas_compra: origen_anterior (marca MIGRADO), nota_anterior (NOTA), estado_anterior (ESTADO (I, O, A)), tipo_ajuste_anterior (TIPO_AJUSTE), clasificacion_nota_anterior (CLASIFICACION_NOTA), moneda_anterior (MONEDA), valor_mi (TOTAL_NOTA_MI), bodega_nombre_anterior (DESC_BODEGA), bodega_destino_anterior (BODEGA_DESTINO), compra_anterior (DOCUMENTO (compra)), serie_compra_anterior (SERIE_DOC), numero_compra_anterior (NUMERO_DOC), fecha_compra_anterior (FECHAHORA_EMISION_DOC), transaccion_anterior (TRANSACCION), usuario_ingresa_anterior (USUARIO_INGRESA), fecha_ingresa_anterior (FECHA_INGRESA), usuario_modifica_anterior (USUARIO_MODIFICA), fecha_modifica_anterior (FECHA_MODIFICA), observaciones (OBSERVACIONES).
--      nota_compra_lineas: origen_anterior (marca MIGRADO), producto_anterior (PRODUCTO), codigo_producto_anterior (CODIGO_PRODUCTO), precio_mi_anterior (VALOR_UNITARIO_MI), descuento_anterior (DESCUENTO), descuento_mi_anterior (DESCUENTO_MI), valor_total_anterior (VALOR_TOTAL), valor_total_mi_anterior (VALOR_TOTAL_MI).
--      Columnas vacías (no se migran): notas NUMERO_AUTORIZACION, TIPO_PRECIO, DIRECCION, OBSERVACIONES, NUMERO_AUTORIZACION_DOC, AÑO_POLIZA, MES_POLIZA, POLIZA, USUARIO_ANULA, FECHA_ANULA; líneas REGISTRO_SANITARIO, UNIDAD_MEDIDA, COSTO_UNITARIO, COSTO_UNITARIO_MI.
--   Equivalencias: TIPO_NOTA C = nota de crédito, D = de débito; SERIE y NUMERO = serie y documento del DTE; FECHAHORA_EMISION = fecha;
--   MONEDA 1 = quetzales, 2 = dólares, con VALOR_CAMBIO; TOTAL_NOTA = valor (en dólares, TOTAL_NOTA_MI); ESTADO I (ingresada) = VIGENTE,
--   O = OPERADA, A = ANULADA; TIPO_AJUSTE 1 = DEVOLUCIÓN, 2 = DESCUENTO; CLASIFICACION_NOTA M = manual; MOTIVO_AJUSTE = motivo.
--   Proveedor, bodega y producto por su código en la localidad (el NIT y el nombre se toman del proveedor). La factura de referencia es la
--   compra DOCUMENTO (de medicamentos o, si no hay, compra varia) si es del mismo proveedor; si no está en la base queda su número.
--   Las notas se cargan con su estado del sistema anterior, SIN generar póliza ni movimientos de inventario (el kardex migrado ya trae la
--   salida de las devoluciones: script 244). Una nota OPERADA rebaja el saldo de su compra (compras_saldo); una VIGENTE se puede descargar
--   o anular en Compras. Línea INVENTARIADA = S mueve inventario (sin producto queda como concepto). VALOR_TOTAL = cantidad × precio.
--   Se ejecuta después del script 233. Se puede ejecutar de nuevo: actualiza.
set lock_timeout = '20s';
alter table public.notas_compra add column if not exists origen_anterior text;
alter table public.notas_compra add column if not exists nota_anterior integer;
alter table public.notas_compra add column if not exists estado_anterior text;
alter table public.notas_compra add column if not exists tipo_ajuste_anterior integer;
alter table public.notas_compra add column if not exists clasificacion_nota_anterior text;
alter table public.notas_compra add column if not exists moneda_anterior integer;
alter table public.notas_compra add column if not exists valor_mi numeric(18, 2);
alter table public.notas_compra add column if not exists bodega_nombre_anterior text;
alter table public.notas_compra add column if not exists bodega_destino_anterior integer;
alter table public.notas_compra add column if not exists compra_anterior integer;
alter table public.notas_compra add column if not exists serie_compra_anterior text;
alter table public.notas_compra add column if not exists numero_compra_anterior text;
alter table public.notas_compra add column if not exists fecha_compra_anterior date;
alter table public.notas_compra add column if not exists transaccion_anterior integer;
alter table public.notas_compra add column if not exists usuario_ingresa_anterior text;
alter table public.notas_compra add column if not exists fecha_ingresa_anterior timestamp;
alter table public.notas_compra add column if not exists usuario_modifica_anterior text;
alter table public.notas_compra add column if not exists fecha_modifica_anterior timestamp;
alter table public.notas_compra add column if not exists observaciones text;
alter table public.nota_compra_lineas add column if not exists origen_anterior text;
alter table public.nota_compra_lineas add column if not exists producto_anterior integer;
alter table public.nota_compra_lineas add column if not exists codigo_producto_anterior text;
alter table public.nota_compra_lineas add column if not exists precio_mi_anterior numeric(18, 4);
alter table public.nota_compra_lineas add column if not exists descuento_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists descuento_mi_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists valor_total_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists valor_total_mi_anterior numeric(18, 2);
create unique index if not exists notas_compra_nota_anterior on public.notas_compra (localidad_id, nota_anterior) where nota_anterior is not null;

do $notas$
declare
  v_org bigint; v_gtq bigint; v_usd bigint; r record; v_loc bigint; v_prov record; v_compra bigint; v_bod bigint; v_id bigint; v_num int; v_mon bigint;
  n_n int := 0; n_a int := 0; n_s int := 0; n_s_txt text := ''; n_otro int := 0; n_sin_compra int := 0; l_n int := 0; l_a int := 0; l_s int := 0; v_nuevo boolean;
begin
  select id into v_org from public.organizaciones where codigo::text = '3';
  if v_org is null then raise exception 'No existe la organización 3.'; end if;
  select id into v_gtq from public.monedas where iso = 'GTQ';
  select id into v_usd from public.monedas where iso = 'USD';
  -- Carga del sistema anterior: conserva número, estado y usuario (preparar_nota_compra respeta fin.nota).
  perform set_config('fin.nota', 'si', true);

  for r in select * from (values
      (2::integer, 410::integer, 'NOTA DE CRÉDITO'::text, '285BDE46'::text, '2058898709'::text, null::text, '2026-11-06'::date, 1::integer, 1::numeric, 'VIGENTE'::text, 3024::numeric, 3024::numeric, 1::integer, 'MAVISA'::text, 1897::integer, 'VITALIS S.A.'::text, 2::integer, 'DESCUENTO'::text, 'Descuento en la factura: 0696C733 - 2281521372 por pronto pago'::text, 309::integer, '0696C733'::text, '2281521372'::text, '2026-11-02'::date, 0::integer, 'M'::text, 'AEV'::text, '2026-11-06 00:00:00'::timestamp, null::text, null::timestamp, 3::integer, null::text, null::timestamp, 'I'::text, null::text),
      (2, 411, 'NOTA DE CRÉDITO', 'D5F8B710', '89148636', null, '2026-11-10', 1, 1, 'VIGENTE', 462.5, 462.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A17F407E - 4108534719 por pronto pago', 314, 'A17F407E', '4108534719', '2026-11-06', 0, 'M', 'AEV', '2026-11-13 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 412, 'NOTA DE CRÉDITO', '4CF6DC0D', '3247066466', null, '2026-11-06', 1, 1, 'OPERADA', 2.2, 2.2, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 313, '9D179685', '4291251179', '2026-11-04', 0, 'M', 'AEV', '2026-11-13 00:00:00', 'AEV', '2026-11-13 00:00:00', 3, null, null, 'O', null),
      (2, 413, 'NOTA DE CRÉDITO', '85614D8B', '2356887805', null, '2026-11-06', 1, 1, 'VIGENTE', 27, 27, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 9D179685 - 4291251179 5% adicional en 3 cajas de Tramadol dañadas', 313, '9D179685', '4291251179', '2026-11-04', 0, 'M', 'AEV', '2026-11-13 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 414, 'NOTA DE CRÉDITO', '094A9628', '659508185', null, '2026-11-09', 1, 1, 'VIGENTE', 1789, 1789, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 9D179685 - 4291251179 por pronto pago', 313, '9D179685', '4291251179', '2026-11-04', 0, 'M', 'AEV', '2026-11-13 00:00:00', null, null, 3, null, null, 'I', null)) as x(loc, nota, tipo, serie, documento, autorizacion, fecha, moneda, cambio, estado, total, total_mi, bodega, bodega_nombre, proveedor, proveedor_nombre,
       tipo_ajuste_ant, tipo_ajuste, motivo, compra, serie_doc, numero_doc, fecha_doc, transaccion, clasif, usr_ing, f_ing, usr_mod, f_mod, bodega_destino, usr_anula, f_anula,
       estado_ant, obs) order by loc, nota loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    select p.id, p.nit, p.nombre_comercial into v_prov from public.proveedores p where p.localidad_id = v_loc and p.codigo = r.proveedor;
    if v_prov.id is null then n_s := n_s + 1; n_s_txt := n_s_txt || format(' 3-0%s nota %s (proveedor %s);', r.loc, r.nota, r.proveedor); continue; end if;
    v_bod := (select b.id from public.bodegas b where b.localidad_id = v_loc and b.codigo = r.bodega);
    v_compra := coalesce((select c.id from public.compras c where c.localidad_id = v_loc and c.origen_anterior = 'MEDICAMENTOS' and c.compra_anterior = r.compra limit 1),
                         (select c.id from public.compras c where c.localidad_id = v_loc and ((c.origen_anterior = 'VARIAS' and c.compra_anterior = r.compra) or c.compra_varia_anterior = r.compra) limit 1));
    if v_compra is not null and not exists (select 1 from public.compras c where c.id = v_compra and c.proveedor_id = v_prov.id) then v_compra := null; end if;
    if v_compra is null then n_sin_compra := n_sin_compra + 1; end if;
    v_mon := case when r.moneda = 2 then coalesce(v_usd, v_gtq) else v_gtq end;
    select id into v_id from public.notas_compra where localidad_id = v_loc and nota_anterior = r.nota;
    if v_id is null then
      v_num := case when exists (select 1 from public.notas_compra where localidad_id = v_loc and numero = r.nota)
                    then (select coalesce(max(numero), 0) + 1 from public.notas_compra where localidad_id = v_loc) else r.nota end;
      if v_num <> r.nota then n_otro := n_otro + 1; end if;
      insert into public.notas_compra (organizacion_id, localidad_id, numero, tipo, documento, fecha, moneda_id, proveedor_id, nota_anterior, origen_anterior)
      values (v_org, v_loc, v_num, r.tipo, coalesce(r.documento, r.nota::text), r.fecha, v_mon, v_prov.id, r.nota, 'MIGRADO')
      returning id into v_id;
      n_n := n_n + 1;
    else
      n_a := n_a + 1;
    end if;
    update public.notas_compra set
      tipo = r.tipo, numero_autorizacion = r.autorizacion, serie = r.serie, documento = coalesce(r.documento, r.nota::text), fecha = r.fecha,
      moneda_id = v_mon, tipo_cambio = coalesce(nullif(r.cambio, 0), 1), valor = greatest(case when r.moneda = 2 then coalesce(r.total_mi, r.total) else r.total end, 0),
      proveedor_id = v_prov.id, proveedor_codigo = r.proveedor::text, proveedor_nombre = coalesce(r.proveedor_nombre, v_prov.nombre_comercial), nit = v_prov.nit,
      bodega_id = v_bod, compra_id = v_compra, motivo = r.motivo, tipo_ajuste = r.tipo_ajuste,
      tipo_nota = case when r.clasif = 'M' then 'MANUAL' else 'AUTOMÁTICA' end, estado = r.estado,
      usuario = coalesce(upper(r.usr_ing), 'SISTEMA ANTERIOR'),
      operado_por = case when r.estado = 'OPERADA' then upper(coalesce(r.usr_mod, r.usr_ing)) end,
      operado_en = case when r.estado = 'OPERADA' then coalesce(r.f_mod, r.f_ing)::timestamptz end,
      anulado_por = case when r.estado = 'ANULADA' then upper(coalesce(r.usr_anula, r.usr_mod)) end,
      anulado_en = case when r.estado = 'ANULADA' then coalesce(r.f_anula, r.f_mod)::timestamptz end,
      motivo_anulacion = case when r.estado = 'ANULADA' then 'ANULADA EN EL SISTEMA ANTERIOR' end,
      creado_por_nombre = coalesce(upper(r.usr_ing), 'MIGRACIÓN'), creado_en = r.f_ing::timestamptz,
      modificado_por_nombre = upper(r.usr_mod), modificado_en = r.f_mod::timestamptz,
      origen_anterior = 'MIGRADO', nota_anterior = r.nota, estado_anterior = r.estado_ant, tipo_ajuste_anterior = r.tipo_ajuste_ant, clasificacion_nota_anterior = r.clasif,
      moneda_anterior = r.moneda, valor_mi = r.total_mi, bodega_nombre_anterior = r.bodega_nombre, bodega_destino_anterior = r.bodega_destino, compra_anterior = r.compra,
      serie_compra_anterior = r.serie_doc, numero_compra_anterior = r.numero_doc, fecha_compra_anterior = r.fecha_doc, transaccion_anterior = r.transaccion,
      usuario_ingresa_anterior = r.usr_ing, fecha_ingresa_anterior = r.f_ing, usuario_modifica_anterior = r.usr_mod, fecha_modifica_anterior = r.f_mod, observaciones = r.obs
    where id = v_id;
  end loop;

  -- Líneas de las notas.
  for r in select * from (values
      (2::integer, 410::integer, 1::integer, 1::integer, null::text, 'DESCUENTO PARA LAS FACTURAS'::text, null::text, null::date, null::date, 1::numeric, 3024::numeric, 3024::numeric, 0::numeric, 0::numeric, 3024::numeric, 3024::numeric, false::boolean, null::integer, null::text),
      (2, 411, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 462.5, 462.5, 0, 0, 462.5, 462.5, false, null, null),
      (2, 412, 1, 158, 'VIT 0044', 'Dipirona 1g/2ml (Metamizol) - Caja X 100 - Ampolla - AMPOLLA', 'A260682', '2028-06-14', '2026-06-14', 1, 2.2, 2.2, 0, 0, 2.2, 2.2, true, 1, null),
      (2, 413, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 27, 27, 0, 0, 27, 27, false, null, null),
      (2, 414, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1789, 1789, 0, 0, 1789, 1789, false, null, null)) as x(loc, nota, linea, producto, cod_prod, descripcion, lote, vence, fabrica, cantidad, precio, precio_mi, descu, descu_mi, total, total_mi, inv, bodega, registro) loop
    select n.id, n.localidad_id into v_id, v_loc from public.notas_compra n join public.localidades l on l.id = n.localidad_id
    where l.organizacion_id = v_org and l.correlativo = r.loc and n.nota_anterior = r.nota;
    if v_id is null then l_s := l_s + 1; continue; end if;
    insert into public.nota_compra_lineas (nota_id, linea, producto_id, descripcion, cantidad, precio, inventario, lote, registro_sanitario, fecha_vencimiento, fecha_fabricacion,
      bodega_id, origen_anterior, producto_anterior, codigo_producto_anterior, precio_mi_anterior, descuento_anterior, descuento_mi_anterior, valor_total_anterior, valor_total_mi_anterior)
    select v_id, r.linea, p.id, coalesce(r.descripcion, p.nombre, 'SIN DESCRIPCIÓN'), case when coalesce(r.cantidad, 0) > 0 then r.cantidad else 1 end,
           greatest(coalesce(r.precio, 0), 0), coalesce(r.inv, false) and p.id is not null, r.lote, r.registro, r.vence, r.fabrica,
           (select b.id from public.bodegas b where b.localidad_id = v_loc and b.codigo = r.bodega), 'MIGRADO', r.producto, r.cod_prod, r.precio_mi, r.descu, r.descu_mi, r.total, r.total_mi
    from (select 1) uno left join public.productos p on p.localidad_id = v_loc and p.codigo = r.producto
    on conflict (nota_id, linea) do update set producto_id = excluded.producto_id, descripcion = excluded.descripcion, cantidad = excluded.cantidad, precio = excluded.precio,
      inventario = excluded.inventario, lote = excluded.lote, registro_sanitario = excluded.registro_sanitario, fecha_vencimiento = excluded.fecha_vencimiento,
      fecha_fabricacion = excluded.fecha_fabricacion, bodega_id = excluded.bodega_id, origen_anterior = excluded.origen_anterior, producto_anterior = excluded.producto_anterior,
      codigo_producto_anterior = excluded.codigo_producto_anterior, precio_mi_anterior = excluded.precio_mi_anterior, descuento_anterior = excluded.descuento_anterior,
      descuento_mi_anterior = excluded.descuento_mi_anterior, valor_total_anterior = excluded.valor_total_anterior, valor_total_mi_anterior = excluded.valor_total_mi_anterior
    returning (xmax = 0) into v_nuevo;
    if v_nuevo then l_n := l_n + 1; else l_a := l_a + 1; end if;
  end loop;

  perform set_config('fin.nota', '', true);
  raise notice '%', format('Notas de compras de la organización 3: %s nuevas, %s actualizadas, %s con otro número (el suyo ya estaba ocupado), %s sin su compra en la base. Líneas: %s nuevas, %s actualizadas, %s sin nota.%s',
    n_n, n_a, n_otro, n_sin_compra, l_n, l_a, l_s, case when n_s > 0 then ' Omitidas por falta de proveedor:' || n_s_txt else '' end);
end;
$notas$;

notify pgrst, 'reload schema';
