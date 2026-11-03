-- Objetos contables y transacciones de Mavisa para la organización 3 · localidad 2 (3-02).
-- Origen: CON_OBJETOS_CONTA_MAVISA, CON_TIPOS_TRANSACCIONES_MAVISA, CON_TRANSACCIONES_OBJETOS_MAVISA
-- y CON_CUENTAS_TRANSACCIONES_MAVISA (los archivos traen organización 1 · localidad 2; se cargan en
-- la 3 · 2 como se indicó).
--   42 objetos contables (1 a 42), con su número original.
--   46 transacciones (1001 a 1046) con estado, aplica póliza y tipo de operación.
--   43 transacciones x objeto (con su cuenta bancaria cuando la traen).
--   105 cuentas x transacción: D → debe, C → haber; operación del sistema anterior
--   5 → TOTAL, 3 → SUBTOTAL, 1 → IMPUESTO (IVA), 2 → RETENCIÓN, 4/6/8 → OTRO.
-- Las cuentas de las transacciones se buscan por código en el catálogo de cuentas activo de la
-- localidad. Las que no existan allí se informan y quedan pendientes: al volver a ejecutar este
-- script (por ejemplo, después de cargar la nomenclatura de Mavisa) se agregan las que falten.
-- Los archivos no traen las cuentas de cada objeto (solo cuántas son): se cargan cuando se tenga
-- ese archivo. Puede ejecutarse de nuevo: no duplica nada. Requiere los scripts 36 y 37.

do $$
declare
  v_org bigint;
  v_loc bigint;
  v_cat bigint;
  o record;
  v_id bigint;
  v_nuevos_obj integer := 0;
  v_nuevas_tra integer := 0;
  v_ot integer;
  v_lin integer;
  v_pend integer;
  v_faltan text;
begin
  select id into v_org from public.organizaciones where codigo = 3;
  if v_org is null then raise exception 'No existe la organización 3. Créala en Catálogos · Geografía · Organizaciones.'; end if;
  select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = 2;
  if v_loc is null then raise exception 'La organización 3 no tiene la localidad 2 (3-02). Créala en Organizaciones.'; end if;
  select id into v_cat from public.catalogos_cuentas where localidad_id = v_loc and activo order by version desc limit 1;

  create temporary table m_objetos (numero integer primary key, descripcion text, cuentas integer, objeto_id bigint) on commit drop;
  insert into m_objetos (numero, descripcion, cuentas) values
    (1, 'PROVEEDORES', 5),
    (2, 'CONTRATOS', 7),
    (3, 'COSTEO MEDICAMENTOS', 2),
    (4, 'PLANES', 7),
    (5, 'TIPOS DE CONTRATOS', 1),
    (6, 'COMPRAS', 5),
    (7, 'TRANSFERENCIAS - AUTORIZACIONES', 2),
    (8, 'FACTURAS', 7),
    (9, 'CHEQUES', 2),
    (10, 'CAJAS/LIQUIDACIONES', 1),
    (11, 'POLIZAS', 10),
    (12, 'DEPOSITOS BANCARIOS', 2),
    (13, 'NOTAS DE CREDITO', 2),
    (14, 'RECIBOS', 2),
    (15, 'ENTRADAS A BODEGA', 2),
    (16, 'TRASLADOS ENTRE BODEGAS', 2),
    (17, 'SALIDAS DE BODEGA', 2),
    (18, 'AJUSTES DE INVENTARIO', 2),
    (19, 'BODEGAS', 1),
    (20, 'NOTAS DE DEBITO', 2),
    (21, 'REVERSIÓN ENTRADAS A BODEGA', 2),
    (22, 'REVERSIÓN TRASLADOS ENTRE BODEGAS', 2),
    (23, 'REVERSIÓN SALIDAS DE BODEGA', 2),
    (24, 'REVERSIÓN AJUSTES DE INVENTARIO', 2),
    (25, 'CHEQUES ANULADOS', 2),
    (26, 'DEPRECIACIONES', 2),
    (27, 'NOTAS DE CREDITO SOBRE VENTAS', 7),
    (28, 'RETENCIONES IVA', 2),
    (29, 'EXENCIONES DE IVA', 2),
    (30, 'ALTAS ACTIVOS FIJOS', 2),
    (31, 'TRANSFERENCIAS - COMISIONES', 9),
    (32, 'DEVOLUCIONES', 2),
    (33, 'TRANSFERENCIA GASTOS OPERATIVOS', 0),
    (34, 'TRANSFERENCIA GASTOS FINANCIEROS', 0),
    (35, 'TRANSFERENCIA COSTOS ADMINISTRACION', 0),
    (36, 'TRANSFERENCIA - CLINICAS', 0),
    (37, 'LIQUIDACION AMBULANCIAS', 0),
    (38, 'CLASIFICACION PRODUCTOS', 0),
    (39, 'TRANSFERENCIA - AMBULANCIAS', 0),
    (40, 'REVERSION DE DEVOLUCIONES', 0),
    (41, 'LIQUIDACION DE EMPLEADOS', 0),
    (42, 'RETENCIONES ISR', 0);

  create temporary table m_transacciones (numero integer primary key, descripcion text, estado text, aplica boolean, tipo_operacion text) on commit drop;
  insert into m_transacciones (numero, descripcion, estado, aplica, tipo_operacion) values
    (1001, 'VENTA DE MEDICAMENTOS GENERICOS LOCAL', 'ACTIVO', true, 'GENERICOS_LOCAL'),
    (1002, 'VENTA DE MEDICAMENTOS DE MARCA LOCAL', 'ACTIVO', true, 'MARCA_LOCAL'),
    (1003, 'VENTA DE MEDICAMENTOS GENERICOS EXTERIOR', 'ACTIVO', true, 'GENERICOS_EXTERIOR'),
    (1004, 'VENTA DE MEDICAMENTOS DE MARCA EXTERIOR', 'ACTIVO', true, 'MARCA_EXTERIOR'),
    (1005, 'REBAJA VENTA DEL INVENTARIO MEDICAMENTOS GENÉRICOS', 'ACTIVO', true, null),
    (1006, 'CHEQUES BI (POR LIQUIDAR)', 'ACTIVO', false, null),
    (1007, 'CHEQUES BI (PROVEEDORES)', 'ACTIVO', false, null),
    (1008, 'DEPOSITOS CTA 206-131947-7 BI', 'ACTIVO', true, 'DEPOSITOS_RECIBOS'),
    (1009, 'NOTAS DE CREDITO CLIENTES BI', 'ACTIVO', true, 'TRANSFERENCIAS_RECIBOS'),
    (1010, 'CHEQUES BANRURAL (POR LIQUIDAR)', 'ACTIVO', true, null),
    (1011, 'CHEQUES BANRURAL (PROVEEDORES)', 'ACTIVO', true, null),
    (1012, 'NOTA DE DEBITO BI Q', 'ACTIVO', true, null),
    (1013, 'NOTA DE DEBITO BI $', 'ACTIVO', true, null),
    (1014, 'NOTAS DE CREDITO $', 'ACTIVO', true, null),
    (1015, 'RECIBOS DE BI 634', 'ACTIVO', true, null),
    (1016, 'POLIZA DE OPERACIONES (APERTURAS Y CIERRES)', 'ACTIVO', true, null),
    (1017, 'COMPRA DE MEDICAMENTOS LOCAL 2024', 'ACTIVO', true, null),
    (1018, 'COMPRA DE MEDICAMENTOS IMPORTACION 2024', 'ACTIVO', true, null),
    (1019, 'RETENCIONES DE IVA', 'ACTIVO', true, null),
    (1020, 'CAJA CHICA', 'ACTIVO', true, null),
    (1021, 'CAJA OPERACIONES', 'ACTIVO', true, null),
    (1022, 'POLIZAS DIARIAS', 'ACTIVO', true, null),
    (1023, 'PAGO DE SERVICIOS', 'ACTIVO', true, null),
    (1024, 'Saldos Mensuales', 'ACTIVO', true, null),
    (1025, 'DEPOSITOS CTA 3235100377 BANRURAL', 'ACTIVO', true, 'DEPOSITOS_RECIBOS'),
    (1026, 'DEPOSITOS CTA USD($) 206-134189-3', 'ACTIVO', true, null),
    (1027, 'ND LIQUIDACION CAJA CHICA BI', 'ACTIVO', true, null),
    (1028, 'NOTA DE DEBITO BI Q (CAJA CHICA)', 'ACTIVO', true, null),
    (1029, 'NOTAS DE CREDITO CLIENTES BANRURAL', 'ACTIVO', true, 'TRANSFERENCIAS_RECIBOS'),
    (1030, 'NOTA DE DEBITO BANRURAL', 'ACTIVO', true, null),
    (1031, 'ND TRANSFERENCIAS BANRURAL', 'ACTIVO', true, null),
    (1032, 'ND TRANSFERENCIAS BI (Q.)', 'ACTIVO', true, null),
    (1033, 'ND TRANSFERENCIAS BI ($.)', 'ACTIVO', true, null),
    (1034, 'NC TRANSFERENCIAS BANRURAL', 'ACTIVO', true, null),
    (1035, 'NC TRANSFERENCIAS BI (Q.)', 'ACTIVO', true, null),
    (1036, 'NC TRANSFERENCIAS BI ($.)', 'ACTIVO', true, null),
    (1037, 'POLIZA REGISTRO DE NOMINA MENSUAL', 'ACTIVO', true, null),
    (1038, 'ND PAGO DE NOMINA ANTICIPO QUINCENAL', 'ACTIVO', true, null),
    (1039, 'ND PAGO DE NOMINA FIN DE MES', 'ACTIVO', true, null),
    (1040, 'ND INDUSTRIAL PAGO DE IMPUESTO RENTA DE TRABAJO', 'ACTIVO', true, null),
    (1041, 'ND BANRURAL PAGO DE IMPUESTO RENTA DE TRABAJO', 'ACTIVO', true, null),
    (1042, 'RETENCIONES DE ISR EFECTUADAS', 'ACTIVO', true, null),
    (1043, 'REGISTRO FACTURAS DE COMPRAS VARIAS (NO MEDICAMENTO)', 'ACTIVO', true, null),
    (1044, 'REGISTRO FACTURAS PEQUEÑO C COMPRAS VARIAS', 'ACTIVO', true, null),
    (1045, 'PAGO DE IGSS', 'ACTIVO', true, null),
    (1046, 'NC ANTICIPO DE CLIENTES BI Q', 'ACTIVO', true, null);

  create temporary table m_obj_trans (objeto integer, transaccion integer, cuenta_bancaria text) on commit drop;
  insert into m_obj_trans (objeto, transaccion, cuenta_bancaria) values
    (6, 1042, null),
    (6, 1023, null),
    (6, 1043, null),
    (6, 1017, null),
    (6, 1044, null),
    (8, 1001, null),
    (8, 1002, null),
    (8, 1004, null),
    (8, 1005, null),
    (8, 1003, null),
    (9, 1007, '206-131947-7'),
    (9, 1006, '206-131947-7'),
    (9, 1011, null),
    (9, 1010, null),
    (10, 1020, null),
    (10, 1021, null),
    (11, 1022, null),
    (11, 1016, null),
    (11, 1037, null),
    (12, 1025, '3235100377'),
    (12, 1026, '206-134189-3'),
    (12, 1008, '206-131947-7'),
    (13, 1034, '3235100377'),
    (13, 1046, '206-131947-7'),
    (13, 1029, '3235100377'),
    (13, 1036, '206-134189-3'),
    (13, 1035, '206-131947-7'),
    (13, 1014, '206-134189-3'),
    (13, 1009, '206-131947-7'),
    (20, 1031, '3235100377'),
    (20, 1039, '206-131947-7'),
    (20, 1038, '206-131947-7'),
    (20, 1032, '206-131947-7'),
    (20, 1030, '3235100377'),
    (20, 1033, '206-134189-3'),
    (20, 1028, '206-131947-7'),
    (20, 1012, '206-131947-7'),
    (20, 1013, '206-134189-3'),
    (20, 1041, '3235100377'),
    (20, 1040, '206-131947-7'),
    (20, 1027, '206-131947-7'),
    (20, 1045, '206-131947-7'),
    (28, 1019, null);

  create temporary table m_lineas (transaccion integer, linea integer, cuenta text, naturaleza text, orden integer, operacion text, operacion_origen integer) on commit drop;
  insert into m_lineas (transaccion, linea, cuenta, naturaleza, orden, operacion, operacion_origen) values
    (1001, 1, '1010201001', 'D', 1, 'TOTAL', 5),
    (1001, 3, '4010101001', 'H', 2, 'TOTAL', 5),
    (1002, 1, '1010201001', 'D', 1, 'TOTAL', 5),
    (1002, 2, '2010201001', 'H', 2, 'IMPUESTO', 1),
    (1002, 3, '4010101002', 'H', 3, 'SUBTOTAL', 3),
    (1003, 1, '1010201001', 'D', 1, 'TOTAL', 5),
    (1003, 2, '4010101001', 'H', 2, 'TOTAL', 5),
    (1004, 1, '1010201001', 'D', 1, 'TOTAL', 5),
    (1004, 2, '4010101002', 'H', 2, 'SUBTOTAL', 3),
    (1004, 3, '2010201001', 'H', 3, 'IMPUESTO', 1),
    (1005, 1, '1010501001', 'H', 1, 'SUBTOTAL', 3),
    (1005, 3, '5010101001', 'D', 3, 'SUBTOTAL', 3),
    (1006, 1, '1010102001', 'H', 1, 'TOTAL', 5),
    (1006, 2, '1010301001', 'D', 2, 'TOTAL', 5),
    (1007, 1, '1010102001', 'H', 1, 'TOTAL', 5),
    (1007, 2, '2010101001', 'D', 2, 'TOTAL', 5),
    (1007, 3, '2010101002', 'D', 3, 'TOTAL', 5),
    (1008, 1, '1010102001', 'D', 1, 'TOTAL', 5),
    (1008, 2, '1010201001', 'H', 2, 'TOTAL', 5),
    (1009, 1, '1010102001', 'D', 1, 'TOTAL', 5),
    (1009, 2, '1010201001', 'H', 2, 'TOTAL', 5),
    (1012, 1, '1010102001', 'H', 1, 'TOTAL', 5),
    (1012, 2, '2010101001', 'D', 2, 'TOTAL', 5),
    (1013, 1, '1010103001', 'H', 1, 'TOTAL', 5),
    (1013, 2, '2010101001', 'D', 2, 'TOTAL', 5),
    (1014, 1, '1010301001', 'H', 1, 'TOTAL', 5),
    (1014, 2, '1010103001', 'D', 2, 'TOTAL', 5),
    (1015, 1, '1010102001', 'D', 2, 'TOTAL', 5),
    (1015, 2, '1010201001', 'H', 1, 'OTRO', 4),
    (1016, 1, '1010101001', 'D', 1, 'TOTAL', 5),
    (1016, 2, '3010101001', 'H', 2, 'TOTAL', 5),
    (1019, 1, '1010401002', 'D', 1, 'TOTAL', 5),
    (1019, 2, '1010201001', 'H', 2, 'TOTAL', 5),
    (1020, 1, '2010101002', 'H', 1, 'TOTAL', 5),
    (1020, 2, '1010401001', 'D', 2, 'IMPUESTO', 1),
    (1020, 3, '6010103022', 'D', 3, 'SUBTOTAL', 3),
    (1020, 4, '6010103031', 'D', 4, 'OTRO', 6),
    (1020, 5, '6010105001', 'D', 5, 'OTRO', 8),
    (1021, 1, '2010101002', 'H', 1, 'TOTAL', 5),
    (1021, 2, '2010201001', 'D', 2, 'IMPUESTO', 1),
    (1021, 3, '6010103021', 'D', 3, 'SUBTOTAL', 3),
    (1023, 1, '6010106002', 'D', 1, 'SUBTOTAL', 3),
    (1023, 2, '1010401001', 'D', 2, 'IMPUESTO', 1),
    (1023, 3, '2010101002', 'H', 3, 'TOTAL', 5),
    (1023, 4, '2010202006', 'H', 4, 'RETENCIÓN', 2),
    (1025, 1, '1010102002', 'D', 1, 'TOTAL', 5),
    (1025, 2, '1010201001', 'H', 2, 'TOTAL', 5),
    (1026, 1, '1010103001', 'D', 1, 'TOTAL', 5),
    (1026, 2, '1010201001', 'H', 2, 'TOTAL', 5),
    (1027, 1, '1010102001', 'H', 1, 'TOTAL', 5),
    (1027, 2, '2010101002', 'D', 2, 'TOTAL', 5),
    (1028, 1, '1010102001', 'H', 1, 'TOTAL', 5),
    (1028, 2, '2010101002', 'D', 2, 'TOTAL', 5),
    (1029, 1, '1010102002', 'D', 1, 'TOTAL', 5),
    (1029, 2, '1010201001', 'H', 2, 'TOTAL', 5),
    (1030, 1, '1010102002', 'H', 1, 'TOTAL', 5),
    (1030, 2, '2010101001', 'D', 2, 'TOTAL', 5),
    (1031, 1, '1010102002', 'H', 1, 'TOTAL', 5),
    (1031, 2, '1010104001', 'D', 2, 'TOTAL', 5),
    (1032, 1, '1010102001', 'H', 1, 'TOTAL', 5),
    (1032, 2, '1010104001', 'D', 2, 'TOTAL', 5),
    (1033, 1, '1010103001', 'H', 1, 'TOTAL', 5),
    (1033, 2, '1010104001', 'D', 2, 'TOTAL', 5),
    (1034, 1, '1010102002', 'D', 1, 'TOTAL', 5),
    (1034, 2, '1010104001', 'H', 2, 'TOTAL', 5),
    (1035, 1, '1010102001', 'D', 1, 'TOTAL', 5),
    (1035, 2, '1010104001', 'H', 2, 'TOTAL', 5),
    (1036, 1, '1010103001', 'D', 1, 'TOTAL', 5),
    (1036, 2, '1010104001', 'H', 2, 'TOTAL', 5),
    (1037, 1, '6010101001', 'D', 1, 'TOTAL', 5),
    (1037, 2, '6010101003', 'D', 2, 'TOTAL', 5),
    (1037, 3, '6010102002', 'D', 3, 'TOTAL', 5),
    (1037, 4, '6010102003', 'D', 4, 'TOTAL', 5),
    (1037, 5, '6010102005', 'D', 5, 'TOTAL', 5),
    (1037, 6, '6010102006', 'D', 6, 'TOTAL', 5),
    (1037, 7, '1010303001', 'H', 7, 'TOTAL', 5),
    (1037, 8, '2010202004', 'H', 8, 'TOTAL', 5),
    (1037, 9, '2010301001', 'H', 9, 'TOTAL', 5),
    (1037, 10, '2010302001', 'H', 10, 'TOTAL', 5),
    (1037, 11, '2010302002', 'H', 11, 'TOTAL', 5),
    (1037, 12, '2010303001', 'H', 12, 'TOTAL', 5),
    (1037, 13, '2010303002', 'H', 13, 'TOTAL', 5),
    (1037, 14, '2010303003', 'H', 14, 'TOTAL', 5),
    (1038, 1, '1010102001', 'H', 1, 'TOTAL', 5),
    (1038, 2, '1010303001', 'D', 2, 'TOTAL', 5),
    (1039, 1, '1010102001', 'H', 1, 'TOTAL', 5),
    (1039, 2, '2010301001', 'D', 2, 'TOTAL', 5),
    (1040, 1, '1010102001', 'H', 1, 'TOTAL', 5),
    (1040, 2, '2010202004', 'D', 2, 'TOTAL', 5),
    (1041, 1, '1010102002', 'H', 1, 'TOTAL', 5),
    (1041, 2, '2010202004', 'D', 2, 'TOTAL', 5),
    (1042, 1, '2010101002', 'D', 1, 'TOTAL', 5),
    (1042, 2, '2010202006', 'H', 2, 'TOTAL', 5),
    (1043, 1, '6010103007', 'D', 1, 'SUBTOTAL', 3),
    (1043, 2, '1010401001', 'D', 2, 'IMPUESTO', 1),
    (1043, 3, '2010101002', 'H', 3, 'TOTAL', 5),
    (1043, 4, '2010202006', 'H', 4, 'RETENCIÓN', 2),
    (1044, 1, '6010103006', 'D', 1, 'TOTAL', 5),
    (1044, 2, '2010101002', 'H', 2, 'TOTAL', 5),
    (1045, 1, '1010102001', 'H', 1, 'TOTAL', 5),
    (1045, 2, '2010303003', 'D', 2, 'TOTAL', 5),
    (1045, 3, '2010303001', 'D', 3, 'TOTAL', 5),
    (1045, 4, '2010303002', 'D', 4, 'TOTAL', 5),
    (1046, 1, '1010102001', 'D', 1, 'TOTAL', 5),
    (1046, 2, '2010104001', 'H', 2, 'TOTAL', 5);

  -- ---------- Objetos (se respeta su número: si ya existe con la misma descripción, se usa) ----------
  for o in select * from m_objetos order by numero loop
    select id into v_id from public.objetos_contables where localidad_id = v_loc and descripcion = upper(trim(o.descripcion));
    if v_id is null then
      insert into public.objetos_contables (organizacion_id, localidad_id, descripcion) values (v_org, v_loc, o.descripcion) returning id into v_id;
      v_nuevos_obj := v_nuevos_obj + 1;
    end if;
    update m_objetos set objeto_id = v_id where numero = o.numero;
  end loop;

  -- ---------- Transacciones (con su código original) ----------
  insert into public.transacciones_contables (organizacion_id, localidad_id, numero, descripcion, estado, aplica_poliza, tipo_operacion)
  select v_org, v_loc, t.numero, t.descripcion, t.estado, t.aplica, nullif(t.tipo_operacion, '')
  from m_transacciones t
  where not exists (select 1 from public.transacciones_contables x where x.localidad_id = v_loc and x.numero = t.numero);
  get diagnostics v_nuevas_tra = row_count;

  -- ---------- Transacciones x objeto ----------
  insert into public.objeto_transacciones (objeto_id, transaccion_id, cuenta_bancaria)
  select mo.objeto_id, x.id, nullif(r.cuenta_bancaria, '')
  from m_obj_trans r
  join m_objetos mo on mo.numero = r.objeto
  join public.transacciones_contables x on x.localidad_id = v_loc and x.numero = r.transaccion
  on conflict (objeto_id, transaccion_id) do nothing;
  get diagnostics v_ot = row_count;

  -- ---------- Cuentas x transacción (solo las cuentas que existen en el catálogo) ----------
  insert into public.transaccion_cuentas (transaccion_id, linea, cuenta_id, naturaleza, orden, operacion)
  select x.id, l.linea, c.id, l.naturaleza, l.orden, l.operacion
  from m_lineas l
  join public.transacciones_contables x on x.localidad_id = v_loc and x.numero = l.transaccion
  join public.cuentas c on c.catalogo_id = v_cat and c.codigo = l.cuenta
  on conflict (transaccion_id, linea) do nothing;
  get diagnostics v_lin = row_count;

  select count(*), string_agg(distinct l.cuenta, ', ' order by l.cuenta) into v_pend, v_faltan
  from m_lineas l
  where not exists (select 1 from public.cuentas c where c.catalogo_id = v_cat and c.codigo = l.cuenta);

  raise notice 'Mavisa 3-02: % objetos nuevos (de %), % transacciones nuevas (de %), % transacciones x objeto agregadas, % cuentas x transacción agregadas.',
    v_nuevos_obj, (select count(*) from m_objetos), v_nuevas_tra, (select count(*) from m_transacciones), v_ot, v_lin;
  if v_cat is null then
    raise notice 'La localidad 3-02 no tiene un catálogo de cuentas activo: las % cuentas x transacción quedan pendientes. Carga la nomenclatura y vuelve a ejecutar este script.', (select count(*) from m_lineas);
  elsif v_pend > 0 then
    raise notice '% cuentas x transacción quedan pendientes porque su cuenta no existe en el catálogo de la localidad: %. Carga esas cuentas y vuelve a ejecutar este script.', v_pend, v_faltan;
  end if;
end;
$$;
