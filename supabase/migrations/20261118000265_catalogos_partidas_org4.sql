-- Script 265 · Organización 4 (Tecnoalsa): columnas y catálogos que necesitan las partidas contables (script 266).
--   a) Columnas nuevas (vienen con datos en CON_POLIZAS_N.xlsx y CON_DETALLE_POLIZAS_N.xlsx y no estaban en la base de datos):
--      partidas: origen_anterior (marca MIGRADO), estado_anterior (ESTADO), modulo_anterior (MODULO), tipo_anterior (TIPO (M, A, S)), aprobada_anterior (APROBADA), clasificacion_anterior (CLASIFICACION), transaccion_anterior (TIPO_TRANSACCION), transaccion_id (transacción contable), moneda_integracion (MONEDA_INTEGRACION), valor_cambio_anterior (VALOR_CAMBIO), anticipo (ANTICIPO), definitiva_anterior (DEFINITIVA), revisada (REVISADA), numero_anual_anterior (POLIZA_ANUAL tal como venía), tipo_nomina_anterior (TIPO_NOMINA), nomina_anterior (NOMINA), transaccion_generada (TRANSACCION_GENERADA), nombre_transaccion_anterior (NOMBRE_TRANSACCION), archivo_anterior (ARCHIVO), estado_conta_anterior (ESTADO_CONTA).
--      partida_lineas: debe_mi (DEBITO_MI), haber_mi (CREDITO_MI), cuenta_codigo_anterior (CUENTA), version_cuenta_anterior (VERSION), tipo_int_centro (TIPO_INT_CENTRO), debito_anterior (DEBITO tal como venía), credito_anterior (CREDITO tal como venía), origen_anterior (marca MIGRADO), centro_costo_anterior (CENTRO_COSTO).
--      FECHA_APROBACION y USUARIO_APROBACION van a las columnas que ya existen (aprobada_en y aprobada_por).
--   b) Transacciones contables: se crean las que usan las pólizas y no existen en la localidad (84 usadas; en el catálogo
--      del sistema anterior no estaban: ; se crean con la descripción de su primera póliza).
--   c) Cuentas contables: se crean en el catálogo versión 1 de la localidad las que usa el detalle y no existen (en el catálogo del
--      sistema anterior faltaban: ). Toman el nombre de la misma cuenta en otra
--      localidad (o «CUENTA código (CREADA AL MIGRAR PARTIDAS)») y su cuenta mayor es la de código más largo que la contenga.
--   d) Centros de costo: se crean los que usa el detalle () en la versión 1 del catálogo
--      de centros de la localidad (si la localidad no tiene catálogo de centros, se crea). El centro 0 significa «sin centro».
--   Puede ejecutarse de nuevo: no duplica nada.
alter table public.partidas add column if not exists origen_anterior text;
alter table public.partidas add column if not exists estado_anterior text;
alter table public.partidas add column if not exists modulo_anterior integer;
alter table public.partidas add column if not exists tipo_anterior text;
alter table public.partidas add column if not exists aprobada_anterior text;
alter table public.partidas add column if not exists clasificacion_anterior text;
alter table public.partidas add column if not exists transaccion_anterior integer;
alter table public.partidas add column if not exists transaccion_id bigint references public.transacciones_contables(id) on delete set null;
alter table public.partidas add column if not exists moneda_integracion integer;
alter table public.partidas add column if not exists valor_cambio_anterior numeric(18, 6);
alter table public.partidas add column if not exists anticipo boolean;
alter table public.partidas add column if not exists definitiva_anterior text;
alter table public.partidas add column if not exists revisada boolean;
alter table public.partidas add column if not exists numero_anual_anterior integer;
alter table public.partidas add column if not exists tipo_nomina_anterior integer;
alter table public.partidas add column if not exists nomina_anterior integer;
alter table public.partidas add column if not exists transaccion_generada integer;
alter table public.partidas add column if not exists nombre_transaccion_anterior text;
alter table public.partidas add column if not exists archivo_anterior text;
alter table public.partidas add column if not exists estado_conta_anterior text;
alter table public.partida_lineas add column if not exists debe_mi numeric(18, 2);
alter table public.partida_lineas add column if not exists haber_mi numeric(18, 2);
alter table public.partida_lineas add column if not exists cuenta_codigo_anterior text;
alter table public.partida_lineas add column if not exists version_cuenta_anterior integer;
alter table public.partida_lineas add column if not exists tipo_int_centro text;
alter table public.partida_lineas add column if not exists debito_anterior numeric(18, 2);
alter table public.partida_lineas add column if not exists credito_anterior numeric(18, 2);
alter table public.partida_lineas add column if not exists origen_anterior text;
alter table public.partida_lineas add column if not exists centro_costo_anterior text;

do $cat$
declare
  v_org bigint; v_loc bigint; v_cat bigint; v_kc bigint; v_may bigint; v_tipo bigint; v_nom text; r record;
  t_n int := 0; c_n int := 0; k_n int := 0; z_n int := 0; v_ctas text[] := '{}'; v_cen text[] := '{}';
begin
  select id into v_org from public.organizaciones where codigo::text = '4';
  if v_org is null then raise notice 'No existe la organización 4.'; return; end if;

  -- Transacciones contables.
  for r in select * from (values
    (1, 1001, 'POLIZAS GENERAL'),
    (1, 1002, 'DEPOSITOS VARIOS BI Q'),
    (1, 1004, 'NOTAS DE CREDITO BANRURAL Q'),
    (1, 1005, 'NOTAS DE DEBITO  G&T CONTINENTAL $'),
    (1, 1006, 'SERVICIOS DE IMPORTACIONES'),
    (1, 1007, 'GASTOS VARIOS'),
    (1, 1008, 'COMPRAS INVENTARIO LOCALES'),
    (1, 1009, 'NOTAS DE DEBITO ANTICIPO PROVEEDORES LOCALES BI Q'),
    (1, 1010, 'VENTAS AL CREDITO'),
    (1, 1011, 'SERVICIOS PRESTADOS'),
    (1, 1012, 'NOTA DEBITO DE CXP PROVEEDORES BIENES BI Q'),
    (1, 1013, 'NOTA DEBITO DE CXP PROVEEDORES SERVICIOS BI Q'),
    (1, 1014, 'COMPRA LOCALES VARIAS'),
    (1, 1015, 'SERVICIOS ADQUIRIDOS POR PAGAR'),
    (1, 1016, 'NOTAS DE DEBITO G&T CONTINENTAL Q'),
    (1, 1017, 'BI PAGO DE IMPUESTOS'),
    (1, 1018, 'PAGO BONIFIICACIONES Y/O COMISIONES'),
    (1, 1023, 'NOTAS DE CREDTIO G&T CONTINENTAL Q'),
    (1, 1024, 'NOTAS DE CREDITO G&T CONTINENTAL $'),
    (1, 1025, 'NOTAS DE CREDITO BI Q'),
    (1, 1029, 'NOTAS DE DEBITO  BI Q'),
    (1, 1031, 'CXP CAJA CHICA'),
    (1, 1032, 'CXP DE VIATICOS'),
    (1, 1033, 'NOTAS CREDITO TRASLADO DE FONDOS GYT'),
    (1, 1034, 'NOTAS DEBITO TRASLADO DE FONDOS GYT Q'),
    (1, 1036, 'NOTAS DEBITO TRASLADO DE FONDOS BANRURAL Q'),
    (1, 1040, 'NOTAS CREDITO TRASLADO DE FONDOS G&T $'),
    (1, 1047, 'PAGO PLANILLA DE SUELDO'),
    (1, 1050, 'NOTAS DE DEBITO TRASLADO DE FONDOS BI Q'),
    (1, 1063, 'SALIDAS DE INVENTARIO'),
    (1, 1064, 'NOTAS DE DEBITO OBLIGACIONES DE PAGO DE CREDITOS ACH'),
    (1, 1030, 'NOTAS DE DEBITO BI $'),
    (1, 1037, 'NOTAS DEBITO COMISIONES Y BONIFICACIONES GYT'),
    (1, 1039, 'NOTAS DEBITO TRASLADO DE FONDOS G&T $'),
    (1, 1041, 'NOTAS CREDITO TRASLADO DE FONDOS BI Q'),
    (1, 1048, 'NOTAS DE CREDITO TRASLADOS DE FONDOS BI $'),
    (1, 1056, 'NOTAS DE CREDITO POR CARGOS BANCARIOS GYT Q'),
    (1, 1059, 'NOTAS (CREDITO - ABONO) SOBRE VENTAS'),
    (1, 1061, 'NOTAS DE DEBITOS PAGO DE IMPUESTOS G Y T Q'),
    (1, 1028, 'VENTAS AL CONTADO'),
    (1, 1042, 'NOTAS DE CREDITO ANTICIPO DE BIENES BI Q'),
    (1, 1043, 'NOTAS DE CREDITO ANTICIPO DE BIENES BANRURAL Q'),
    (1, 1049, 'NOTAS DE DEBITO TRASLADO DE FONDOS BI $'),
    (1, 1051, 'NOTAS DE DEBITO POR CARGOS BANCARIOS BI Q'),
    (1, 1026, 'NOTAS DE CREDITO BI $'),
    (1, 1046, 'NOTAS DE CREDITO ANTICIPO DE BIENES G Y T  Q'),
    (1, 1053, 'NOTAS DE DEBITO POR CARGOS BANCARIOS GYT Q'),
    (1, 1054, 'NOTAS DE DEBITO POR CARGOS BANCARIOS GYT $'),
    (1, 1058, 'NOTAS DE CREDITO POR CARGOS BANCARIOS GYT $'),
    (1, 1045, 'NOTAS DE CREDITO ANTICIPO DE BIENES BI $'),
    (1, 1062, 'NOTAS DE CREDITO REEMBOLSO DE VIATICOS'),
    (1, 1067, 'NOTAS DE DEBITO ANTICIPO DE VIAJES AL EXTERIOR BI Q'),
    (1, 1044, 'NOTAS DE CREDITO ANTICIPO DE BIENES G Y T  $'),
    (1, 1069, 'PAGO DE IMPUESTOS BANRURAL Q'),
    (1, 1070, 'COMPRA DE INVENTARIOS DE IMPORTACIONES'),
    (1, 1071, 'PAGO A PROVEEDORES DEL EXTERIOR GYT $'),
    (1, 1073, 'NOTAS DE CREDITO BAC Q'),
    (1, 1074, 'NOTAS DE DEBITO BAC Q'),
    (1, 1076, 'NOTAS DE DEBITO TRASLADO DE FONDOS BAC Q'),
    (1, 1078, 'NOTAS DE CREDITO TRASLADO DE FONDOS BI AHORRO Q'),
    (1, 1082, 'NOTAS DE DEBITO PRESTAMOS DEL ACCIONISTA  BI Q'),
    (1, 1068, 'NOTAS DE DEBITO ANTICIPO DE VIAJES AL EXTERIOR G Y T   Q'),
    (1, 1084, 'NOTAS DE DEBITOS POR CARGOS BANCARIOS BAC Q'),
    (1, 1085, 'NOTAS DE DEBITO PAGOS PRESTAMOS BI Q'),
    (1, 1020, 'NOTAS DE DEBITO BANRURAL Q'),
    (1, 1087, 'NOTAS DE DEBITO POR DONACIONES BI Q'),
    (1, 1088, 'NOTAS DE DEBITO POR BONIFICACIONES G Y T $'),
    (1, 1075, 'NOTAS DE CREDITO TRASLADO DE FONDOS BAC Q'),
    (1, 1089, 'NOTAS DE CREDITO POR CARGOS BANCARIOS BI AHORRO Q'),
    (1, 1091, 'NOTAS DE DEBITO PAGO CUOTAS LEASING BI Q'),
    (1, 1093, 'NOTAS DE CREDITO ANTICIPO DE PROVEEDORES LOCALES BAC Q'),
    (1, 1094, 'NOTAS DE DEBITO ANTICIO DE PROVEEDORES LOCALES BAC Q'),
    (1, 1097, 'NOTA DE CREDITO DEVOLUCION DE PAGOS AL EXTERIOR'),
    (1, 1099, 'NOTAS DE DEBITO FONDOS DE CAJA DE ADMINISTRACION'),
    (1, 1101, 'NOTAS DE CREDITOS POR CARGOS BANCARIOS BAC Q'),
    (1, 1098, 'NOTAS DE CREDITO FONDOS  DE CAJA DE ADMINISTRACION'),
    (1, 1072, 'PAGO A PROVEEDORES DEL EXTERIOR BI $'),
    (1, 1077, 'NOTAS DE CREDITO BI AHORRO Q'),
    (1, 1100, 'RETORNO INVENTARIO NOTAS DE CREDITO SOBRE VENTAS'),
    (1, 1081, 'NOTAS DE CREDITO PRESTAMOS DEL ACCIONISTA  BI Q'),
    (1, 1102, 'NOTAS DE DEBITO ANTICIPOS PROVEEDORES LOCALES BI $'),
    (1, 1104, 'NOTAS DE DEBITO ANTICIPOS PROVEEDORES LOCALES G Y T   $'),
    (1, 1080, 'NOTAS DE DEBITO TRASLADO DE FONDOS BI AHORRO Q'),
    (1, 1105, 'NOTAS DE DEBITO PAGOS PRESTAMOS G Y T  Q')) as x(loc, numero, descripcion) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    -- Solo las que no existen (la regla de numeración rechaza un número repetido antes de llegar a «on conflict»).
    if v_loc is null or exists (select 1 from public.transacciones_contables where localidad_id = v_loc and numero = r.numero) then continue; end if;
    insert into public.transacciones_contables (organizacion_id, localidad_id, numero, descripcion, estado, aplica_poliza)
    values (v_org, v_loc, r.numero, r.descripcion, 'ACTIVO', true);
    t_n := t_n + 1;
  end loop;

  -- Cuentas contables (de la más corta a la más larga, para que la mayor exista antes).
  for r in select * from (values
    (1, '11110202', 'CAJA CHICA ADMINISTRACION'),
    (1, '11120101', 'BI Q. MONETARIA 006-019757-1'),
    (1, '11120102', 'G&T Q MONETARIA 39-0007608-3'),
    (1, '11120103', 'BANRURAL Q MONETARIA 3733005325'),
    (1, '11120105', 'BANCO PROMERICA Q 12335070010653'),
    (1, '11120201', 'BANCO G&T $ MONETARIA 039-5805579-4'),
    (1, '11120203', 'BI $ MONETARIA 0480124890'),
    (1, '1121', 'CLIENTES LOCALES'),
    (1, '112301', 'ANTICIPOS A PROVEEDORES LOCALES'),
    (1, '112302', 'ANTICIPOS DE VIATICOS AÑOS ANTERIORES 2025'),
    (1, '11230301', 'M.C.E. MECANICA SRL'),
    (1, '11230302', 'BALTUR, SPA'),
    (1, '11230303', 'SPAR FOOD MACHINRY'),
    (1, '11230304', 'MIMAC ITALIA SRL'),
    (1, '11230305', 'RUBHIMA- EQUIPANSA SL'),
    (1, '11230306', 'OVO- TECH SP Z.O.O'),
    (1, '11230307', 'TRIMA'),
    (1, '11230310', 'ICB TECNOLOGIE SRL'),
    (1, '11230311', 'COLOM BAKERY EQUIPMENT SL'),
    (1, '11230314', 'KMP SRL'),
    (1, '11230317', 'WAICO SRL'),
    (1, '11230321', 'MECNOSUD SRL'),
    (1, '11230322', 'ECOFLAM BRUCAITORI SPA'),
    (1, '11230323', 'AMASADORAS SAUS, S.L.'),
    (1, '11230324', 'KITCHEN SUPPLIES & PARTS SA DE CV'),
    (1, '11230325', 'INOX HORNOS Y EQUIPOS XONI CIA LTDA'),
    (1, '11230326', 'MASSIMILIANO CHINATO'),
    (1, '11230327', 'INNOVACION FOODSERVICE MEXICO SA DE CV'),
    (1, '11230328', 'EQUIPOS NIETOS S.A.'),
    (1, '11230331', 'JESUS ARGUELLO'),
    (1, '11230333', 'ZUCCHELLI FORNI S.P.A.'),
    (1, '11230334', 'SIGMA SRL'),
    (1, '11230335', 'INDUSTRIAS ZUNINO SRL'),
    (1, '11230336', 'LP GROUP SRL'),
    (1, '11230337', 'GEROSA ACHILLE SRL'),
    (1, '11230338', 'HOBA VB'),
    (1, '11230339', 'STM PRODUCTS SRL'),
    (1, '11230340', 'C.T.M. EN EL EXTERIOR'),
    (1, '1124', 'PROVISIÓN PARA CUENTAS INCOBRABLES'),
    (1, '11250401', 'JUAN MANUEL SAQUICH'),
    (1, '11250402', 'GERBER DE PAZ'),
    (1, '11250403', 'MARIO VASQUEZ'),
    (1, '11250408', 'ABNER ABEL SANTOS'),
    (1, '11250409', 'IRIS JANETTE GONZALEZ MELGAR SAQUICH'),
    (1, '11301', 'IVA CRÉDITO FISCAL'),
    (1, '11302', 'IVA RETENIDO'),
    (1, '11303', 'PAGO TRIMESTRAL  (ISO)'),
    (1, '11304', 'PAGO TRIMESTRAL (ISR)'),
    (1, '11305', 'IVA POR COBRAR IMPORTACIONES'),
    (1, '1141', 'INVENTARIO'),
    (1, '1151', 'MANEJO DE IMPORTACIONES'),
    (1, '1160101', 'DEPOSITO EN GARANTIA'),
    (1, '116030101', 'CUENTAS POR COBRAR EN PROCESO JUDICIAL'),
    (1, '1210101', 'MOBILIARIO Y EQUIPO DE OFICINA'),
    (1, '1210102', 'DEPRE. ACUM. MOBILIARIO Y EQUIPO'),
    (1, '1210103', 'EQUIPO DE COMPUTACIÓN'),
    (1, '1210104', 'DEP. ACUM. EQUIPO DE COMPUTACI'),
    (1, '1210301', 'VEHÍCULOS'),
    (1, '1210302', 'DEP. ACUMULADA VEHÍCULOS'),
    (1, '21110101', 'CXP DE BIENES'),
    (1, '21110102', 'CXP DE SERVICIOS'),
    (1, '21110201', 'ANTICIPOS DE CLIENTES'),
    (1, '2111030106', 'CXP VIATICOS LUIS CARDOZA'),
    (1, '21110302', 'CXP  CAJA CHICA'),
    (1, '2111050101', 'IVA- DEBITO FISCAL'),
    (1, '2111050103', 'IVA -  FACTURAS ESPECIALES'),
    (1, '2111050201', 'ISR RETENIDO EMPLEADOS'),
    (1, '2111050202', 'ISR RETENIDO PROVEEDORES'),
    (1, '2111050203', 'ISR RETENIDO FACTURAS ESPECIALES'),
    (1, '2111050204', 'ISR RETENIDO PROVEEDORES NO DOMICILIADOS'),
    (1, '211106', 'SEGUROS POR PAGAR'),
    (1, '21110701', 'IGSS POR PAGAR LABORAL'),
    (1, '21110702', 'IGSS POR PAGAR PATRONAL'),
    (1, '2111080101', 'CXP SUELDOS'),
    (1, '2111080102', 'CXP COMISIONES'),
    (1, '2111080103', 'CXP BONIFICACIONES'),
    (1, '2111080201', 'CXP  BONO 14'),
    (1, '2111080202', 'CXP AGUINALDO'),
    (1, '2111080204', 'CXP INDEMNIZACIÓN'),
    (1, '2111090102', 'ZUCCHELLI FORNI SPA'),
    (1, '2111090103', 'STM PRODUCTS SRL'),
    (1, '2111090106', 'BARRADAS REFRIGERACION COMERCIAL'),
    (1, '2111090110', 'BALTUR SPA'),
    (1, '2111090111', 'EQUIPOS NIETO, S.A.'),
    (1, '2111090117', 'REYNALDO JACOBO MERIDA ROMERO / CHINATO MX'),
    (1, '2111090120', 'ZIBO TAIBO INDUSTRIAL CO. LTD'),
    (1, '2111090122', 'SULI IVONN GONZLES MORALES'),
    (1, '2111090127', 'CONTEC IND LTD'),
    (1, '21111001', 'JUAN MANUEL SAQUICH'),
    (1, '21111002', 'TARJETA DE CREDITO 1214 MC EMPRESARIAL'),
    (1, '21111003', 'TARJETA DE CREDITO 3438 VISA EMPRESARIAL'),
    (1, '21111004', 'TARJETA INSTITUCIONAL BI 1217'),
    (1, '21111101', 'PROVISION DE COSTOS'),
    (1, '211112', 'ANA GABRIELA SAQUICH'),
    (1, '21130101', 'CREDITO ACH G&T Q'),
    (1, '31101', 'CAPITAL SUSCRITO Y PAGADO'),
    (1, '3110301', 'UTILIDAD O PÉRDIDA ACUMULADA'),
    (1, '3110302', 'RESULTADO DEL EJERCICIO 2020'),
    (1, '3110303', 'RESULTADO DEL EJERCICIO 2021'),
    (1, '3110304', 'RESULTADO DEL EJERCICIO 2022'),
    (1, '3110305', 'RESULTADO DEL EJERCICIO 2023'),
    (1, '4111', 'VENTA DE EQUIPO'),
    (1, '4112', 'VENTA DE REPUESTOS'),
    (1, '4113', 'VENTA DE ACCESORIOS'),
    (1, '4114', 'VENTA DE SERVICIOS'),
    (1, '412', 'DEVOLUCIONES Y REBAJAS DE VENTAS'),
    (1, '511', 'COSTO DE VENTAS'),
    (1, '51201', 'COMPRAS LOCALES ACCESORIOS'),
    (1, '6101', 'GV - SUELDO ORDINARIO'),
    (1, '6102', 'GV - BONIFICACIÓN E INCENTIVO DE LEY'),
    (1, '6103', 'GV - BONIFICACIÓN E INCENTIVO SOBRE METAS'),
    (1, '6104', 'GV - CUOTA PATRONAL'),
    (1, '6105', 'GV - CUOTA IRTRA'),
    (1, '6106', 'GV - CUOTA INTECAP'),
    (1, '6107', 'GV - BONO 14'),
    (1, '6108', 'GV - AGUINALDO'),
    (1, '6110', 'GV - INDEMNIZACIÓN'),
    (1, '6111', 'GV - COMISIONES'),
    (1, '6112', 'GV - ALIMENTACIÓN'),
    (1, '6113', 'GV - HOSPEDAJE'),
    (1, '6114', 'GV - COMBUSTIBLE'),
    (1, '6115', 'GV- IMPUESTOS Y CONTRIBUCIONES'),
    (1, '6116', 'GV - PARQUEO Y PEAJES'),
    (1, '6121', 'GV - COPIAS. IMPRESIONES Y ENCUADERNACIONES'),
    (1, '6122', 'GV - SERVICIOS PROFESIONALES'),
    (1, '6126', 'GV - PUBLICIDAD Y PROPAGANDA'),
    (1, '6127', 'GV - COURIER Y FLETES'),
    (1, '6128', 'GV - FESTEJOS Y AGASAJOS INTERNOS'),
    (1, '6129', 'GV - FESTEJOS Y AGASAJOS CLIENTES EXTERNOS'),
    (1, '6131', 'GV - SUMINISTROS DE COCINA Y LIMPIEZA'),
    (1, '6136', 'GV - GASTOS NO DEDUCIBLES'),
    (1, '6137', 'GV - SERVICIOS TECNICOS'),
    (1, '6201', 'GA - SUELDO ORDINARIO'),
    (1, '6202', 'GA - BONIFICACIÓN E INCENTIVO DE LEY'),
    (1, '6203', 'GA - BONIFICACIÓN E INCENTIVO SOBRE METAS'),
    (1, '6204', 'GA - CUOTA PATRONAL'),
    (1, '6205', 'GA - CUOTA IRTRA'),
    (1, '6206', 'GA - CUOTA INTECAP'),
    (1, '6207', 'GA - BONO 14'),
    (1, '6208', 'GA - AGUINALDO'),
    (1, '6210', 'GA - INDEMNIZACIÓN'),
    (1, '6211', 'GA - ALIMENTACIÓN'),
    (1, '6212', 'GA - HOSPEDAJE'),
    (1, '6213', 'GA - COMBUSTIBLE'),
    (1, '6214', 'GA- IMPUESTOS Y CONTRIBUCIONES'),
    (1, '6215', 'GA - PARQUEO Y PEAJES'),
    (1, '6216', 'GA - PASAJE'),
    (1, '6218', 'GA - TELÉFONO E INTERNET'),
    (1, '6219', 'GA - PAPELERÍA Y ÚTILES'),
    (1, '6220', 'GA - COPIAS. IMPRESIONES Y ENCUADERNACIONES'),
    (1, '6221', 'GA - SERVICIOS PROFESIONALES'),
    (1, '6222', 'GA - GASTOS ADMINISTRATIVOS'),
    (1, '6224', 'GA - COURIER Y FLETES'),
    (1, '6226', 'GA - MANTENIMIENTO VEHÍCULO'),
    (1, '6227', 'GA - MANTENIMIENTO EQUIPO DE COMPUTACIÓN'),
    (1, '6228', 'GA - MANTENIMIENTO Y LIMPIEZA'),
    (1, '6229', 'GA - SUMINISTROS DE COCINA Y LIMPIEZA'),
    (1, '6230', 'GA - ARRENDAMIENTO DE OFICINAS'),
    (1, '6231', 'GA - AGUA'),
    (1, '6233', 'GA - IMPUESTOS Y CONTRIBUCIONES'),
    (1, '6235', 'GA - SEGURO DE VEHÍCULOS'),
    (1, '6236', 'GA - MULTAS Y RECARGOS'),
    (1, '6237', 'GA - MANTENIMIENTO DE OFICINA'),
    (1, '6238', 'GA - GASTOS VARIOS'),
    (1, '6239', 'GA - GASTOS NO DEDUCIBLES'),
    (1, '6240', 'GA-SERVICIOS TECNICOS'),
    (1, '624101', 'MOBILIARIO Y EQUIPO DE OFICINA'),
    (1, '624102', 'EQUIPO COMPUTO'),
    (1, '624104', 'VEHÍCULOS'),
    (1, '6242', 'GA- SEGURO Y GASTOS MÉDICOS'),
    (1, '6246', 'GA- SEGUROS DE VIAJE'),
    (1, '6247', 'GA- GASTOS DEVIAJE AL EXTERIOR'),
    (1, '6301', 'GT- SUELDO ORDINARIO'),
    (1, '6302', 'GT- BONIFICACIÓN E INCENTIVO DE LEY'),
    (1, '6303', 'GT- BONIFICACIÓN E INCENTIVOS SOBRE METAS'),
    (1, '6304', 'GT-CUOTA PATRONAL'),
    (1, '6305', 'GT-CUOTA IRTRA'),
    (1, '6306', 'GT-CUOTA INTECAP'),
    (1, '6307', 'GT-BONO 14'),
    (1, '6308', 'GT-AGUINALDO'),
    (1, '6310', 'GT-INDEMNIZACIÓN'),
    (1, '6311', 'GT- ALIMENTACIÓN'),
    (1, '6312', 'GT- HOSPEDAJE'),
    (1, '6313', 'GT- COMBUSTIBLES Y LUBRICANTES'),
    (1, '6314', 'GT- IMPUESTOS Y CONTRIBUCIONES'),
    (1, '6315', 'GT- TELEFONO'),
    (1, '6316', 'GT- ACCESORIOS Y EQUIPOS PARA REPARACIONES'),
    (1, '6317', 'GT-,MANTENIMIENTO VEHÍCULO'),
    (1, '6318', 'GT- SERVICIOS Y ASISTENCIAS TÉCNICAS'),
    (1, '6319', 'GT-PARQUEO Y PEAJES'),
    (1, '6320', 'GT- COMISIONES'),
    (1, '6321', 'GT- GASTOS NO DEDUCIBLES'),
    (1, '6324', 'GT- HORAS EXTRAS'),
    (1, '70101', 'IF - DESCUENTOS SOBRE COMPRAS'),
    (1, '70102', 'IF - INTERESES GANADOS'),
    (1, '70103', 'IF - DIFERENCIAL CAMBIARIO'),
    (1, '70203', 'GF - COMISIONES BANCARIAS'),
    (1, '70204', 'GF - DIFERENCIAL CAMBIARIO'),
    (1, '70301', 'OTROS INGRESOS NO OPERATIVOS'),
    (1, '70401', 'OTROS GASTOS NO OPERATIVOS'),
    (1, '2111090104', 'COLOM BAKERY EQUIPMENT SL'),
    (1, '11230342', 'FORMEX MAQUINARIA S.A.'),
    (1, '2111030101', 'CXP VIATICOS GERBER DE PAZ'),
    (1, '2111030102', 'CXP VIATICOS MARIO VASQUEZ'),
    (1, '2111030104', 'CXP VIATICOS JUAN MANUEL SAQUICH'),
    (1, '2111030107', 'CXP VIATICOS ABNER ABEL SANTOS SALVAL'),
    (1, '6130', 'GV - MANTENIMIENTO VEHÍCULO'),
    (1, '6243', 'GA- SERVICIO DE MENSAJERÍA'),
    (1, '51204', 'MONTAJE DE EQUIPO'),
    (1, '624103', 'SOFTWARE'),
    (1, '6217', 'GA - UNIFORMES'),
    (1, '112305', 'ANTICIPO A JUAN MANUEL SAQUICH - PICK UP'),
    (1, '11120104', 'TRANSFERENCIA EN TRÁNSITO'),
    (1, '112306', 'ANTICIPO A JUAN MANUEL SAQUICH - COOPERATIVA'),
    (1, '2111090129', 'PCS CENTRAL AMERICA'),
    (1, '2111090130', 'KMP SRL'),
    (1, '51203', 'REPARACIONES TALLER, HERRERÍA Y TORNO'),
    (1, '513', 'OTROS COSTOS Y GASTOS DE IMPORTACION'),
    (1, '11230341', 'ERIKA RECORD, LLC'),
    (1, '11230344', 'COMIPAK  ENGINEERING S.R.L. UNIPERSONALE'),
    (1, '6244', 'GA- DONACIONES'),
    (1, '6325', 'GT - MEDIOS DE PROTECCION'),
    (1, '1123308', 'ANTICIPO A JUAN MANUEL SAQUICH - ABONO INMOBILIARIO'),
    (1, '11230312', 'ZIBO TAIBO INDUSTRIAL CO. LTD.'),
    (1, '70402', 'OTROS GASTOS NO OPERATIVOS OTROS'),
    (1, '112307', 'ANTICIPO A JUAN MANUEL SAQUICH - CREDITO ACH'),
    (1, '6135', 'GV - GASTOS VARIOS'),
    (1, '2111090113', 'ELIWELL IBÉRICA, S.A.'),
    (1, '2111090119', 'WAICO SRL'),
    (1, '2111090131', 'COMIPAK ENGINEERING S.R.L.'),
    (1, '2111090107', 'JUAN SAQUICH EL SALVADOR'),
    (1, '3110306', 'RESULTADO DEL EJERCICIO  2024'),
    (1, '2111030108', 'CXP VIATICOS ADRIAN ITZEP ALVAREZ'),
    (1, '11231001', 'ANTICIPO DE VIATICOS DE GERBER PAZ'),
    (1, '11231002', 'ANTICIPO DE VIATICOS DE LUIS CARDOZA'),
    (1, '11231003', 'ANTICIPO DE VIATICOS DE ABNER SANTOS'),
    (1, '11231004', 'ANTICIPO DE VIATICOS DE MARIO VAZQUEZ'),
    (1, '11231005', 'ANTICIPO DE VIATICOS DE JUAN MANUEL SAQUICH'),
    (1, '11231006', 'ANTICIPO DE VIATICOS DE CAJA CHICA - ANA SAQUICH'),
    (1, '2111090101', 'M.C.E. MECANICA SRL'),
    (1, '6117', 'GV - PASAJE'),
    (1, '112309', 'ANTICIPO VIAJES AL EXTERIOR'),
    (1, '2111080207', 'CXP LIQUIDACION LABORAL ADRIAN ITZEP ALVAREZ'),
    (1, '2111080203', 'CXP VACACIONES'),
    (1, '6209', 'GA - VACACIONES'),
    (1, '11230315', 'ELIWELL IBÉRICA'),
    (1, '11270101', 'CUENTAS POR COBRAR DIVERSAS GERBER DE PAZ'),
    (1, '2111090133', 'MIMAC  TALIA  SRL'),
    (1, '2111090108', 'JESUS ARGUELLO VOZMEDIANO'),
    (1, '1126', 'PAGOS POR CUENTA AJENA'),
    (1, '6141', 'GV- ALQUILER DE EQUIPOS'),
    (1, '2120201', 'PRESTAMOS ACCIONISTA  JUAN MANUEL SAQUICH'),
    (1, '2111050206', 'ISR PAGOS TRIMESTRALES'),
    (1, '2111090109', 'TRIMA'),
    (1, '6234', 'GA - SEGURIDAD Y VIGILANCIA'),
    (1, '6248', 'GA- TRAMITES LEGALES, SERVICIOS JURIDICOS'),
    (1, '11230346', 'NORTHLAND ALUMINUM PRODUCTS INC'),
    (1, '2111090134', 'NORTHLAND ALUMINUM PRODUCTS INC'),
    (1, '6124', 'GV - MATERIALES DIVERSOS'),
    (1, '11250407', 'LUIS CARDOZA'),
    (1, '2111050205', 'ISR RETENIDO RELACION DE DEPENDENCIA'),
    (1, '2120101', 'PRESTAMO BANCO INDUSTRIAL QUETZALES'),
    (1, '11230308', 'FERSAH MAKINA'),
    (1, '11120106', 'BAC MONETARIA Q 905593083'),
    (1, '11120107', 'BI Q. AHORRO 508-12-82473'),
    (1, '2111030105', 'CXP VIATICOS VELVETH BARRERA RAMIREZ'),
    (1, '11250404', 'ANA SAQUICH'),
    (1, '2111090132', 'INOX HORNOS Y EQUIPOS XONI, CIA LTDA'),
    (1, '11230347', 'TORTIMAQ Y DISEÑO, S DE RL'),
    (1, '11604', 'LEASING INDUSTRIAL DE  BI'),
    (1, '2120102', 'LEASING INDUSTRIAL BI QUETZALES'),
    (1, '6223', 'GA - SUSCRIPCIONES Y AFILIACIONES'),
    (1, '70201', 'GF - INTERÉS PRÉSTAMO BANCARIO'),
    (1, '2111090135', 'TORTIMAQ Y DISEÑO, S DE RL'),
    (1, '6118', 'GV - UNIFORMES'),
    (1, '6250', 'GA- GAS'),
    (1, '6249', 'GA- ARRENDAMIENTO DE VEHICULOS'),
    (1, '6140', 'GV- GARANTÍA DE EQUIPOS Y REPUESTOS'),
    (1, '112308', 'ANTICIPO TARJETA 3438'),
    (1, '1220101', 'COSTOS DIFERIDOS POR APLICAR'),
    (1, '6142', 'GV- FERIAS Y EXPOSICIONES'),
    (1, '6251', 'GA- ACCESORIOS Y UTILES DE COMPUTACION'),
    (1, '2111090115', 'FERSAH MAKINA IMALAT GIDA SANAYI VE TICARET'),
    (1, '2111090136', 'NOVATEL MEXICANA S.A. DE C.V.'),
    (1, '11230316', 'NOVATEL MEXICANA S.A. DE C.V.'),
    (1, '2111090138', 'ECOFLAM BRUCIATORI S.P.A.'),
    (1, '2111090137', 'FORMEX MAQUINARIA S.A.'),
    (1, '11230348', 'SOVIFRIGE - INDUSTRIA DE EQUIPAMENTOS HOTELEIROS,LDA'),
    (1, '11110203', 'CAJA CHICA GERENCIA'),
    (1, '11270102', 'CUENTAS POR COBRAR DIVERSAS MARIO MATEO VASQUEZ'),
    (1, '11270103', 'CUENTAS POR COBRAR DIVERSAS ABNER ABEL SANTOS'),
    (1, '11270104', 'CUENTAS POR COBRAR DIVERSAS LUIS CARLOS CARDOZA'),
    (1, '11270105', 'CUENTAS POR COBRAR DIVERSAS ANA GABRIELA SAQUICH'),
    (1, '11270106', 'CUENTAS POR COBRAR DIVERSAS VELVETH NOEMI BARRERA'),
    (1, '11231008', 'VELVETH BSRRERA RAMIREZ'),
    (1, '2111090139', 'MECNOSUD S.R.L.'),
    (1, '2111090140', 'SPAR FOOD MACHINRY'),
    (1, '70205', 'GF - OTROS GASTOS DE OPERACIONES BANCARIAS'),
    (1, '1220201', 'GASTOS POR PERDIDAS DIFERIDOS'),
    (1, '2111090142', 'ICB TECNOLOGIE S.R.L.'),
    (1, '2111090143', 'EQUIPOS NIETOS S.A.'),
    (1, '6252', 'GA- ALQULER DE TAXIS'),
    (1, '70104', 'IF - OTROS INGRESOS DE OPERACIONES BANCARIAS'),
    (1, '1152', 'IMPORTACION EN LITIGIO - FALTATE DE MERCADERIA'),
    (1, '11230349', 'PRISMAFOOD S.R.L.'),
    (1, '6225', 'GA - FESTEJOS Y AGASAJOS'),
    (1, '1210201', 'HERRAMIENTAS'),
    (1, '2110001', 'BICSA'),
    (1, '11110204', 'CAJA CHICA ASISTENTE DE GERENCIA'),
    (1, '624105', 'HERRAMIENTAS'),
    (1, '1210202', 'DEP. ACUM. HERRAMIENTAS'),
    (1, '3110307', 'RESULTADO DEL EJERCICIO 2025'),
    (1, '2111090144', 'CMA CGM HEAD OFFICE FRANCE'),
    (1, '11230350', 'CMA CGM HEAD OFFICE FTANCE'),
    (1, '2111090126', 'HOBA VB'),
    (1, '6143', 'GV - MAT. PRIMAS PARA ELABORAC. ALIMENTOS PRUEBAS EQUIPOS'),
    (1, '6253', 'GA- GASTABLES Y DESECHABLES'),
    (1, '6411', 'GSLV - ALIMENTACIÓN'),
    (1, '6427', 'GSLV - PAPELERIA Y UTILES'),
    (1, '6422', 'GSLV -  PASAJE'),
    (1, '6119', 'GV - TELÉFONO Y FAX'),
    (1, '2111090141', 'SOVIFRIGE - INDUSTRIA DE EQUIPAMENTOS HOTELEIROS,LDA'),
    (1, '6120', 'GV - PAPELERÍA Y ÚTILES'),
    (1, '2111090145', 'PRISMAFOOD S.R.L.'),
    (1, '11230351', 'ZOIN SRL'),
    (1, '211502', 'OTRAS CUENTAS POR PAGAR FACILIDADES DE PAGO IMPUESTOS'),
    (1, '21202202', 'PRESTAMO ACCIONISTA JUAN MANUEL SAQUICH (BAC)'),
    (1, '112312', 'ANTICIPOS DE COBROS POR TRARJETAS NEONET'),
    (1, '2111050301', 'ISO POR PAGAR TRIMESTRAL'),
    (1, '11230352', 'CONTEC IND LTD'),
    (1, '6428', 'GSLV - COURIER Y FLETES'),
    (1, '2111090147', 'SIGMA S.R.L.'),
    (1, '11230353', 'CORONA C. S.P.A.'),
    (1, '2111090148', 'CORONA C.  S.P.A.'),
    (1, '11270201', 'JESUS DE LOS SANTOS MONTES DE OCA ALVAREZ'),
    (1, '2111090146', 'ZOIN SRL'),
    (1, '2111090149', 'COMTEC INDUSTRIES LTD'),
    (1, '6413', 'GSLV - COMBUSTIBLES Y LUBRICANTES'),
    (1, '6414', 'GSLV - IMPUESTOS Y CONTRIBUCIONES'),
    (1, '11230354', 'LA IDEAL S.A. DE  C.V.'),
    (1, '6419', 'GSLV -  PARQUEO Y PEAJES')) as x(loc, codigo, nombre) order by loc, length(codigo), codigo loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    v_cat := null;
    select id into v_cat from public.catalogos_cuentas where localidad_id = v_loc and version = 1 order by activo desc limit 1;
    if v_cat is null then select id into v_cat from public.catalogos_cuentas where localidad_id = v_loc order by activo desc, version desc limit 1; end if;
    if v_cat is null or exists (select 1 from public.cuentas where catalogo_id = v_cat and codigo = r.codigo) then continue; end if;
    v_may := null; v_tipo := null; v_nom := null;
    select id into v_may from public.cuentas where catalogo_id = v_cat and length(codigo) < length(r.codigo) and left(r.codigo, length(codigo)) = codigo order by length(codigo) desc limit 1;
    select c.nombre, c.tipo_cuenta_id into v_nom, v_tipo from public.cuentas c join public.catalogos_cuentas k on k.id = c.catalogo_id
      where k.organizacion_id = v_org and c.codigo = r.codigo order by k.version limit 1;
    if v_tipo is null then select tipo_cuenta_id into v_tipo from public.cuentas where catalogo_id = v_cat and left(codigo, 1) = left(r.codigo, 1) and tipo_cuenta_id is not null limit 1; end if;
    insert into public.cuentas (catalogo_id, codigo, nombre, cuenta_mayor_id, tipo_cuenta_id, integra, cuenta_anterior, vigente)
    values (v_cat, r.codigo, coalesce(v_nom, r.nombre, 'CUENTA ' || r.codigo || ' (CREADA AL MIGRAR PARTIDAS)'), v_may, v_tipo, true, r.codigo, true);
    c_n := c_n + 1; v_ctas := array_append(v_ctas, format('4-0%s %s', r.loc, r.codigo));
  end loop;

  -- Centros de costo.
  for r in select * from (values
    ) as x(loc, codigo) order by loc, length(codigo), codigo loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then continue; end if;
    v_kc := null;
    select id into v_kc from public.catalogos_centros where localidad_id = v_loc order by (version = 1) desc, activo desc, version limit 1;
    if v_kc is null then
      insert into public.catalogos_centros (organizacion_id, localidad_id, version, fecha_del) values (v_org, v_loc, 1, date '2018-01-01') returning id into v_kc;
      k_n := k_n + 1;
    end if;
    if exists (select 1 from public.centros_costo where catalogo_id = v_kc and codigo = r.codigo) then continue; end if;
    v_may := null; v_nom := null;
    select id into v_may from public.centros_costo where catalogo_id = v_kc and length(codigo) < length(r.codigo) and left(r.codigo, length(codigo)) = codigo order by length(codigo) desc limit 1;
    select c.nombre into v_nom from public.centros_costo c where c.organizacion_id = v_org and c.codigo = r.codigo limit 1;
    insert into public.centros_costo (organizacion_id, catalogo_id, codigo, nombre, centro_mayor_id, integra, centro_anterior)
    values (v_org, v_kc, r.codigo, coalesce(v_nom, 'CENTRO DE COSTO ' || r.codigo || ' (CREADO AL MIGRAR PARTIDAS)'), v_may, true, r.codigo);
    z_n := z_n + 1; v_cen := array_append(v_cen, format('4-0%s %s', r.loc, r.codigo));
  end loop;

  raise notice '%', format('Transacciones creadas: %s. Cuentas creadas: %s %s. Catálogos de centros creados: %s. Centros creados: %s %s.',
    t_n, c_n, coalesce(array_to_string(v_ctas, ', '), ''), k_n, z_n, coalesce(array_to_string(v_cen, ', '), ''));
end;
$cat$;

notify pgrst, 'reload schema';
