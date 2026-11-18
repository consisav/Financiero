-- Script 246 · parte 5 de 5 · Organización 3 (Futura Farma - Mavisa), lote al 04-11-2026 (carpeta «Data Inventarios 2 Parte»): notas de crédito y débito de proveedores (Compras ›
--   Notas crédito compras), de ACT_NOTAS_COMPRAS.xls (23 notas de esta parte) y ACT_DET_NOTAS_COMPRAS.xls (23 líneas).
--   Misma lógica del script 243 (lote del 05 al 17-11-2026). Notas: 3-02 384 (VIGENTE), 3-02 385 (VIGENTE), 3-02 386 (VIGENTE), 3-02 387 (VIGENTE), 3-02 388 (OPERADA), 3-02 389 (OPERADA), 3-02 390 (VIGENTE), 3-02 391 (VIGENTE), 3-02 392 (VIGENTE), 3-02 393 (OPERADA), 3-02 394 (VIGENTE), 3-02 395 (VIGENTE), 3-02 396 (OPERADA), 3-02 397 (VIGENTE), 3-02 398 (VIGENTE), 3-02 399 (VIGENTE), 3-02 400 (VIGENTE), 3-02 401 (OPERADA), 3-02 402 (VIGENTE), 3-02 403 (OPERADA), 3-02 404 (VIGENTE), 3-02 405 (VIGENTE), 3-02 406 (VIGENTE).
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
--   salida de las devoluciones: script 147). Una nota OPERADA rebaja el saldo de su compra (compras_saldo); una VIGENTE se puede descargar
--   o anular en Compras. Línea INVENTARIADA = S mueve inventario (sin producto queda como concepto). VALOR_TOTAL = cantidad × precio.
--   Fechas escritas con el año en dos cifras (29/04/0025, 28/04/0025, 5/05/0025, 6/06/0025): se toman del año 2000 en adelante.
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
      (2::integer, 384::integer, 'NOTA DE CRÉDITO'::text, '947AE09A'::text, '2825538341'::text, null::text, '2026-09-17'::date, 1::integer, 1::numeric, 'VIGENTE'::text, 85::numeric, 85::numeric, 1::integer, 'MAVISA'::text, 1897::integer, 'VITALIS S.A.'::text, 2::integer, 'DESCUENTO'::text, 'Descuento en la factura: A6D155F7 - 188563862 por pronto pago'::text, 291::integer, 'A6D155F7'::text, '188563862'::text, '2026-09-16'::date, 0::integer, 'M'::text, 'AEV'::text, '2026-09-24 00:00:00'::timestamp, null::text, null::timestamp, 3::integer, null::text, null::timestamp, 'I'::text, null::text),
      (2, 385, 'NOTA DE CRÉDITO', '1EA37FC7', '2585018633', null, '2026-09-24', 1, 1, 'VIGENTE', 7798.5, 7798.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 9E72998C - 4030875753 por pronto pago', 292, '9E72998C', '4030875753', '2026-09-21', 0, 'M', 'AEV', '2026-09-28 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 386, 'NOTA DE CRÉDITO', 'FF16AF69', '1532906057', null, '2026-09-16', 1, 1, 'VIGENTE', 12, 12, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: AE8D4E24 - 713377912 1 unidad faltante de Omeprazol', 293, 'AE8D4E24', '713377912', '2026-09-21', 0, 'M', 'AEV', '2026-09-28 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 387, 'NOTA DE CRÉDITO', '68A070DA', '3232254203', null, '2026-09-24', 1, 1, 'VIGENTE', 2245, 2245, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: AE8D4E24 - 713377912 por pronto pago', 293, 'AE8D4E24', '713377912', '2026-09-21', 0, 'M', 'AEV', '2026-09-28 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 388, 'NOTA DE CRÉDITO', 'FE3A2A099', '2514242191', null, '2026-09-24', 1, 1, 'OPERADA', 660, 660, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 294, '0A21F246', '767576127', '2026-09-23', 0, 'M', 'AEV', '2026-09-28 00:00:00', 'AEV', '2026-09-28 00:00:00', 3, null, null, 'O', null),
      (2, 389, 'NOTA DE CRÉDITO', 'CA9A5E0D', '3749462341', null, '2026-09-25', 1, 1, 'OPERADA', 7, 7, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 294, '0A21F246', '767576127', '2026-09-23', 0, 'M', 'AEV', '2026-09-28 00:00:00', 'AEV', '2026-09-28 00:00:00', 3, null, null, 'O', null),
      (2, 390, 'NOTA DE CRÉDITO', 'B9FEA9FE', '1561412141', null, '2026-09-25', 1, 1, 'VIGENTE', 135, 135, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 0A21F246 - 767576127 por pronto pago', 294, '0A21F246', '767576127', '2026-09-23', 0, 'M', 'AEV', '2026-09-28 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 391, 'NOTA DE CRÉDITO', '5E1A9133', '2540586296', null, '2026-09-28', 1, 1, 'VIGENTE', 460, 460, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: E56ED2FD - 1275021359 por pronto pago', 295, 'E56ED2FD', '1275021359', '2026-09-23', 0, 'M', 'AEV', '2026-09-29 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 392, 'NOTA DE CRÉDITO', 'BD75021C', '272845055', null, '2026-10-07', 1, 1, 'VIGENTE', 555, 555, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B01202A1 - 3707650301 por pronto pago', 297, 'B01202A1', '3707650301', '2026-09-28', 0, 'M', 'AEV', '2026-10-07 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 393, 'NOTA DE CRÉDITO', '2A84773B', '558384472', null, '2026-10-07', 1, 1, 'OPERADA', 1.5, 1.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 298, '4E1847A0', '3508027766', '2026-10-01', 0, 'M', 'AEV', '2026-10-07 00:00:00', 'AEV', '2026-10-07 00:00:00', 3, null, null, 'O', null),
      (2, 394, 'NOTA DE CRÉDITO', '7D2DF641', '2398963518', null, '2026-10-07', 1, 1, 'VIGENTE', 2125, 2125, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 4E1847A0 - 3508027766 por pronto pago', 298, '4E1847A0', '3508027766', '2026-10-01', 0, 'M', 'AEV', '2026-10-07 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 395, 'NOTA DE CRÉDITO', 'C68B95DD', '3637068610', null, '2026-10-07', 1, 1, 'VIGENTE', 116.62, 116.62, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 5006D445 - 4196157809 5% adicional por 14 cajas de Ranitidina en mal estado', 299, '5006D445', '4196157809', '2026-10-07', 0, 'M', 'AEV', '2026-10-21 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 396, 'NOTA DE CRÉDITO', '636F790A', '2674214886', null, '2026-10-07', 1, 1, 'OPERADA', 47.6, 47.6, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRDUCTO QUEBRADO', 299, '5006D445', '4196157809', '2026-10-07', 0, 'M', 'AEV', '2026-10-21 00:00:00', 'AEV', '2026-10-21 00:00:00', 3, null, null, 'O', null),
      (2, 397, 'NOTA DE CRÉDITO', 'FB2C407A', '1728399756', null, '2026-10-12', 1, 1, 'VIGENTE', 375, 375, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 5006D445 - 4196157809 por pronto pago', 299, '5006D445', '4196157809', '2026-10-07', 0, 'M', 'AEV', '2026-10-21 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 398, 'NOTA DE CRÉDITO', '528518F1', '241716639', null, '2026-10-12', 1, 1, 'VIGENTE', 467.5, 467.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: E05D4DD3 - 1475101300 por pronto pago', 300, 'E05D4DD3', '1475101300', '2026-10-08', 0, 'M', 'AEV', '2026-10-21 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 399, 'NOTA DE CRÉDITO', '102672B4', '2533837530', null, '2026-10-12', 1, 1, 'VIGENTE', 125, 125, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: E062C9F7 - 1624787450 por pronto pago', 303, 'E062C9F7', '1624787450', '2026-10-08', 0, 'M', 'AEV', '2026-10-26 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 400, 'NOTA DE CRÉDITO', '5CD5D7B5', '3081849335', null, '2026-10-21', 1, 1, 'VIGENTE', 243, 243, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 16DED6D7 - 3791735109 por 27 cx100 de Tramadol', 302, '16DED6D7', '3791735109', '2026-10-15', 0, 'M', 'AEV', '2026-10-26 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 401, 'NOTA DE CRÉDITO', 'B6323D97', '1067859988', null, '2026-10-21', 1, 1, 'OPERADA', 54, 54, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 302, '16DED6D7', '3791735109', '2026-10-15', 0, 'M', 'AEV', '2026-10-26 00:00:00', 'AEV', '2026-10-26 00:00:00', 3, null, null, 'O', null),
      (2, 402, 'NOTA DE CRÉDITO', '3E6754E8', '663176318', null, '2026-10-22', 1, 1, 'VIGENTE', 805, 805, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 16DED6D7 - 3791735109 por pronto pago', 302, '16DED6D7', '3791735109', '2026-10-15', 0, 'M', 'AEV', '2026-10-26 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 403, 'NOTA DE CRÉDITO', '71F67D80', '616450287', null, '2026-10-12', 1, 1, 'OPERADA', 35.7, 35.7, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 301, 'B03CF68F', '402277795', '2026-10-14', 0, 'M', 'AEV', '2026-10-26 00:00:00', 'AEV', '2026-10-26 00:00:00', 3, null, null, 'O', null),
      (2, 404, 'NOTA DE CRÉDITO', '6E409D91', '243550598', null, '2026-10-12', 1, 1, 'VIGENTE', 85, 85, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B03CF68F - 402277795. 5% adicional por 10 cx100 Ranitidina', 301, 'B03CF68F', '402277795', '2026-10-14', 0, 'M', 'AEV', '2026-10-26 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 405, 'NOTA DE CRÉDITO', '85F21E9F', '490752540', null, '2026-10-21', 1, 1, 'VIGENTE', 2700, 2700, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B03CF68F - 402277795 por pronto pago', 301, 'B03CF68F', '402277795', '2026-10-14', 0, 'M', 'AEV', '2026-10-26 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 406, 'NOTA DE CRÉDITO', 'D2F0D326', '1295142007', null, '2026-10-26', 1, 1, 'VIGENTE', 600, 600, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 681E5079 - 1915307561 por pronto pago', 304, '681E5079', '1915307561', '2026-10-21', 0, 'M', 'AEV', '2026-10-27 00:00:00', null, null, 3, null, null, 'I', null)) as x(loc, nota, tipo, serie, documento, autorizacion, fecha, moneda, cambio, estado, total, total_mi, bodega, bodega_nombre, proveedor, proveedor_nombre,
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
      (2::integer, 384::integer, 1::integer, null::integer, null::text, 'DESCUENTO PARA LAS FACTURAS'::text, null::text, null::date, null::date, 1::numeric, 85::numeric, 85::numeric, 0::numeric, 0::numeric, 85::numeric, 85::numeric, false::boolean, null::integer, null::text),
      (2, 385, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 7798.5, 7798.5, 0, 0, 7798.5, 7798.5, false, null, null),
      (2, 386, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 12, 12, 0, 0, 12, 12, false, null, null),
      (2, 387, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2245, 2245, 0, 0, 2245, 2245, false, null, null),
      (2, 388, 1, 158, 'VIT 0044', 'Dipirona 1g/2ml (Metamizol) - Caja X 100 - Ampolla - AMPOLLA', 'A260682', '2028-06-14', '2026-06-14', 300, 2.2, 2.2, 0, 0, 660, 660, true, 1, null),
      (2, 389, 1, 14, 'VIT 0011', 'Cefotaxima 1 G Polvo Para Solucion Inyectable - Caja X 10 - Vial - VIAL', 'F260074', '2029-06-18', '2026-06-18', 1, 7, 7, 0, 0, 7, 7, true, 1, null),
      (2, 390, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 135, 135, 0, 0, 135, 135, false, null, null),
      (2, 391, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 460, 460, 0, 0, 460, 460, false, null, null),
      (2, 392, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 555, 555, 0, 0, 555, 555, false, null, null),
      (2, 393, 1, 182, 'VIT 0061', 'Furosemida 20 Mg/2 Ml Solución Inyectable - Caja X 100 - Ampolla -2 Mililitro (Ml) - AMPOLLA -2 MILILITRO (ML)', 'A260720', '2029-06-25', '2026-06-25', 1, 1.5, 1.5, 0, 0, 1.5, 1.5, true, 1, null),
      (2, 394, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2125, 2125, 0, 0, 2125, 2125, false, null, null),
      (2, 395, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 116.62, 116.62, 0, 0, 116.62, 116.62, false, null, null),
      (2, 396, 1, 168, 'VIT 0058', 'Ranitidina 50 Mg/2ml Solucion Inyectable - Caja X 100 - Ampolla - AMPOLLA', 'A260784', '2028-07-12', '2026-07-12', 28, 1.7, 1.7, 0, 0, 47.6, 47.6, true, 1, null),
      (2, 397, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 375, 375, 0, 0, 375, 375, false, null, null),
      (2, 398, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 467.5, 467.5, 0, 0, 467.5, 467.5, false, null, null),
      (2, 399, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 125, 125, 0, 0, 125, 125, false, null, null),
      (2, 400, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 243, 243, 0, 0, 243, 243, false, null, null),
      (2, 401, 1, 167, 'VIT 0052', 'Tramadol Clorhidrato 100 Mg/ 2ml Solución Inyectable - Caja X 100 - Ampolla -2 Mililitro (Ml) - AMPOLLA -2 MILILITRO (ML)', 'A260737', '2029-07-03', '2026-07-03', 30, 1.8, 1.8, 0, 0, 54, 54, true, 1, null),
      (2, 402, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 805, 805, 0, 0, 805, 805, false, null, null),
      (2, 403, 1, 168, 'VIT 0058', 'Ranitidina 50 Mg/2ml Solucion Inyectable - Caja X 100 - Ampolla - AMPOLLA', 'A260784', '2028-07-12', '2026-07-12', 21, 1.7, 1.7, 0, 0, 35.7, 35.7, true, 1, null),
      (2, 404, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 85, 85, 0, 0, 85, 85, false, null, null),
      (2, 405, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2700, 2700, 0, 0, 2700, 2700, false, null, null),
      (2, 406, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 600, 600, 0, 0, 600, 600, false, null, null)) as x(loc, nota, linea, producto, cod_prod, descripcion, lote, vence, fabrica, cantidad, precio, precio_mi, descu, descu_mi, total, total_mi, inv, bodega, registro) loop
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
