-- 222 · Catálogo contable de la organización 4 (TECNOALSA S.A.), localidad 4-01, de los archivos de «Tecnoalsa - AAPOS»:
--   1. «3.1 CON_CUENTAS_VERSION.xlsx»: 513 cuentas (versión 1).
--   2. «5. CON_OBJETOS_CONTA.xlsx»: 38 objetos contables.
--   3. «5.2 CON_TIPOS_TRANSACCIONES.xlsx» y «5.3 CON_CUENTAS_TRANSACCIONES.xlsx»: 107 transacciones y 224 líneas.
--   4. «5.1 CON_TRANSACCIONES_OBJETOS.xlsx»: 106 transacciones x objeto.
-- Misma lógica de los scripts 77 a 80 (organización 3) y 177 (organización 2): lo que existe se actualiza y lo que falta se crea.
-- Columnas con información que no existían (se crean antes de migrar):
--   cuentas.aplica_centro_costo (APLICA_CENTRO S/N);
--   transacciones_contables.usuario_ingresa_anterior, fecha_ingresa_anterior y tipo_operacion_anterior (USR_INGRESA,
--     FECHA_INGRESA y TIPO_OPERACION del sistema anterior);
--   transaccion_cuentas.centro_costo_anterior (CENTRO_COSTO; si el centro existe en la localidad la línea se liga a él) y
--     gastos (GASTOS S/N).
-- Se ejecuta después del script 221. Puede ejecutarse de nuevo: la segunda vez solo actualiza.

-- ======================================================================================
-- 1. Cuentas contables
-- ======================================================================================
alter table public.cuentas add column if not exists mascara text;
alter table public.cuentas add column if not exists mostrar boolean not null default true;
alter table public.cuentas add column if not exists aplica_centro_costo boolean not null default false;

do $migra$
declare
  v_org bigint;
  v_loc bigint;
  v_cat bigint;
  v_tipo bigint;
  v_mayor bigint;
  v_id bigint;
  r record;
  v_nuevas integer := 0;
  v_actualizadas integer := 0;
  v_versiones integer := 0;
  v_otra_mayor integer := 0;
  v_omitidas text := '';
begin
  select id into v_org from public.organizaciones where codigo = 4;
  if v_org is null then raise exception 'No existe la organización 4.'; end if;

  drop table if exists m_cuentas;
  create temp table m_cuentas (localidad integer, codigo text, version integer, nombre text, tipo integer, integracion text,
                               cuenta_mayor text, cuenta_anterior text, mascara text, vigente text, mostrar text, aplica_centro text) on commit drop;
  insert into m_cuentas values
      (1, '1', 1, 'ACTIVO', 1, 'S', null, null, null, 'S', 'S', 'N'),
      (1, '11', 1, 'ACTIVO CORRIENTE', 1, 'S', '1', null, null, 'S', 'S', 'N'),
      (1, '111', 1, 'CAJAS Y BANCOS', 1, 'S', '11', null, null, 'S', 'S', 'N'),
      (1, '1111', 1, 'CAJAS', 1, 'S', '111', null, null, 'S', 'S', 'N'),
      (1, '111102', 1, 'CAJAS CHICA', 1, 'S', '1111', null, null, 'S', 'S', 'N'),
      (1, '11110201', 1, 'CAJA CHICA VENTAS', 1, 'N', '111102', null, null, 'S', 'S', 'N'),
      (1, '11110202', 1, 'CAJA CHICA ADMINISTRACION', 1, 'N', '111102', null, null, 'S', 'S', 'N'),
      (1, '11110203', 1, 'CAJA CHICA GERENCIA', 1, 'N', '111102', null, null, 'S', 'S', 'N'),
      (1, '11110204', 1, 'CAJA CHICA ASISTENTE DE GERENCIA', 1, 'N', '111102', null, null, 'S', 'S', 'N'),
      (1, '1112', 1, 'BANCOS', 1, 'S', '111', null, null, 'S', 'S', 'N'),
      (1, '111201', 1, 'QUETZALES', 1, 'S', '1112', null, null, 'S', 'S', 'N'),
      (1, '11120101', 1, 'BI Q. MONETARIA 006-019757-1', 1, 'N', '111201', null, null, 'S', 'S', 'N'),
      (1, '11120102', 1, 'G&T Q MONETARIA 39-0007608-3', 1, 'N', '111201', null, null, 'S', 'S', 'N'),
      (1, '11120103', 1, 'BANRURAL Q MONETARIA 3733005325', 1, 'N', '111201', null, null, 'S', 'S', 'N'),
      (1, '11120104', 1, 'TRANSFERENCIA EN TRÁNSITO', 1, 'N', '111201', null, null, 'S', 'S', 'N'),
      (1, '11120105', 1, 'BANCO PROMERICA Q 12335070010653', 1, 'N', '111201', null, null, 'S', 'S', 'N'),
      (1, '11120106', 1, 'BAC MONETARIA Q 905593083', 1, 'N', '111201', null, null, 'S', 'S', 'N'),
      (1, '11120107', 1, 'BI Q. AHORRO 508-12-82473', 1, 'N', '111201', null, null, 'S', 'S', 'N'),
      (1, '11120108', 1, 'BI Q MONETARIA 2130086172', 1, 'N', '111201', null, null, 'S', 'S', 'N'),
      (1, '111202', 1, 'DOLARES', 1, 'S', '1112', null, null, 'S', 'S', 'N'),
      (1, '11120201', 1, 'BANCO G&T $ MONETARIA 039-5805579-4', 1, 'N', '111202', null, null, 'S', 'S', 'N'),
      (1, '11120202', 1, 'BANRURAL $ MONETARIA 6733000448', 1, 'N', '111202', null, null, 'S', 'S', 'N'),
      (1, '11120203', 1, 'BI $ MONETARIA 0480124890', 1, 'N', '111202', null, null, 'S', 'S', 'N'),
      (1, '112', 1, 'CUENTAS POR COBRAR', 1, 'S', '11', null, null, 'S', 'S', 'N'),
      (1, '1121', 1, 'CLIENTES LOCALES', 1, 'N', '112', null, null, 'S', 'S', 'N'),
      (1, '1122', 1, 'CLIENTES DEL EXTERIOR', 1, 'N', '112', null, null, 'S', 'S', 'N'),
      (1, '1123', 1, 'ANTICIPOS', 1, 'S', '112', null, null, 'S', 'S', 'N'),
      (1, '112301', 1, 'ANTICIPOS A PROVEEDORES LOCALES', 1, 'N', '1123', null, null, 'S', 'S', 'N'),
      (1, '112302', 1, 'ANTICIPOS DE VIATICOS AÑOS ANTERIORES 2025', 1, 'N', '1123', null, null, 'S', 'S', 'N'),
      (1, '112303', 1, 'ANTICIPOS PROVEEDORES EXTERIOR', 1, 'S', '1123', null, null, 'S', 'S', 'N'),
      (1, '11230301', 1, 'M.C.E. MECANICA SRL', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230302', 1, 'BALTUR, SPA', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230303', 1, 'SPAR FOOD MACHINRY', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230304', 1, 'MIMAC ITALIA SRL', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230305', 1, 'RUBHIMA- EQUIPANSA SL', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230306', 1, 'OVO- TECH SP Z.O.O', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230307', 1, 'TRIMA', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230308', 1, 'FERSAH MAKINA', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230309', 1, 'EDHARD CORP', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230310', 1, 'ICB TECNOLOGIE SRL', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230311', 1, 'COLOM BAKERY EQUIPMENT SL', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230312', 1, 'ZIBO TAIBO INDUSTRIAL CO. LTD.', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230313', 1, 'GOODWINTUCK', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230314', 1, 'KMP SRL', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230315', 1, 'ELIWELL IBÉRICA', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230316', 1, 'NOVATEL MEXICANA S.A. DE C.V.', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230317', 1, 'WAICO SRL', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230318', 1, 'ARMANDO MARTINEZ', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230319', 1, 'MACADAMS INTERNATIONAL', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230320', 1, 'OLIVER PACKAGING AND EQUIPMENT COMPANY', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230321', 1, 'MECNOSUD SRL', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230322', 1, 'ECOFLAM BRUCAITORI SPA', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230323', 1, 'AMASADORAS SAUS, S.L.', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230324', 1, 'KITCHEN SUPPLIES & PARTS SA DE CV', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230325', 1, 'INOX HORNOS Y EQUIPOS XONI CIA LTDA', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230326', 1, 'MASSIMILIANO CHINATO', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230327', 1, 'INNOVACION FOODSERVICE MEXICO SA DE CV', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230328', 1, 'EQUIPOS NIETOS S.A.', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230329', 1, 'COMTEC INDUSTRIES LTD.', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230330', 1, 'CIMENET USA, LLC', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230331', 1, 'JESUS ARGUELLO', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230332', 1, 'SULI IVONN GONZALEZ MORALES', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230333', 1, 'ZUCCHELLI FORNI S.P.A.', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230334', 1, 'SIGMA SRL', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230335', 1, 'INDUSTRIAS ZUNINO SRL', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230336', 1, 'LP GROUP SRL', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230337', 1, 'GEROSA ACHILLE SRL', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230338', 1, 'HOBA VB', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230339', 1, 'STM PRODUCTS SRL', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230340', 1, 'C.T.M. EN EL EXTERIOR', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230341', 1, 'ERIKA RECORD, LLC', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230342', 1, 'FORMEX MAQUINARIA S.A.', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230343', 1, 'DALIA WOMEN', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230344', 1, 'COMIPAK  ENGINEERING S.R.L. UNIPERSONALE', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230345', 1, 'COMIPAK ENGINEERING S.R.L.', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230346', 1, 'NORTHLAND ALUMINUM PRODUCTS INC', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230347', 1, 'TORTIMAQ Y DISEÑO, S DE RL', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230348', 1, 'SOVIFRIGE - INDUSTRIA DE EQUIPAMENTOS HOTELEIROS,LDA', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230349', 1, 'PRISMAFOOD S.R.L.', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230350', 1, 'CMA CGM HEAD OFFICE FTANCE', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230351', 1, 'ZOIN SRL', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230352', 1, 'CONTEC IND LTD', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230353', 1, 'CORONA C. S.P.A.', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '11230354', 1, 'LA IDEAL S.A. DE  C.V.', 1, 'N', '112303', null, null, 'S', 'S', 'N'),
      (1, '112304', 1, 'ANTICIPOS COMPRA DE INSUMOS', 1, 'N', '1123', null, null, 'S', 'S', 'N'),
      (1, '112305', 1, 'ANTICIPO A JUAN MANUEL SAQUICH - PICK UP', 1, 'N', '1123', null, null, 'S', 'S', 'N'),
      (1, '112306', 1, 'ANTICIPO A JUAN MANUEL SAQUICH - COOPERATIVA', 1, 'N', '1123', null, null, 'S', 'S', 'N'),
      (1, '112307', 1, 'ANTICIPO A JUAN MANUEL SAQUICH - CREDITO ACH', 1, 'N', '1123', null, null, 'S', 'S', 'N'),
      (1, '112308', 1, 'ANTICIPO TARJETA 3438', 1, 'N', '1123', null, null, 'S', 'S', 'N'),
      (1, '112309', 1, 'ANTICIPO VIAJES AL EXTERIOR', 1, 'N', '1123', null, null, 'S', 'S', 'N'),
      (1, '112310', 1, 'ANTICIPO DE VIATICOS ACTUAL', 1, 'S', '1123', null, null, 'S', 'S', 'N'),
      (1, '11231001', 1, 'ANTICIPO DE VIATICOS DE GERBER PAZ', 1, 'N', '112310', null, null, 'S', 'S', 'N'),
      (1, '11231002', 1, 'ANTICIPO DE VIATICOS DE LUIS CARDOZA', 1, 'N', '112310', null, null, 'S', 'S', 'N'),
      (1, '11231003', 1, 'ANTICIPO DE VIATICOS DE ABNER SANTOS', 1, 'N', '112310', null, null, 'S', 'S', 'N'),
      (1, '11231004', 1, 'ANTICIPO DE VIATICOS DE MARIO VAZQUEZ', 1, 'N', '112310', null, null, 'S', 'S', 'N'),
      (1, '11231005', 1, 'ANTICIPO DE VIATICOS DE JUAN MANUEL SAQUICH', 1, 'N', '112310', null, null, 'S', 'S', 'N'),
      (1, '11231006', 1, 'ANTICIPO DE VIATICOS DE CAJA CHICA - ANA SAQUICH', 1, 'N', '112310', null, null, 'S', 'S', 'N'),
      (1, '11231007', 1, 'ANTICIPO DE VIATICOS DE ADRIAN ITZEP ALVAREZ', 1, 'N', '112310', null, null, 'S', 'S', 'N'),
      (1, '11231008', 1, 'VELVETH BSRRERA RAMIREZ', 1, 'N', '112310', null, null, 'S', 'S', 'N'),
      (1, '112311', 1, 'ANTICIPO TARJETA 1214', 1, 'N', '1123', null, null, 'S', 'S', 'N'),
      (1, '112312', 1, 'ANTICIPOS DE COBROS POR TRARJETAS NEONET', 1, 'N', '1123', null, null, 'S', 'S', 'N'),
      (1, '112313', 1, 'ANTICIPO TARJETA CREDIEMPRESA BICLUB INSTITUCIONAL 1217', 1, 'N', '1123', null, null, 'S', 'S', 'N'),
      (1, '1123308', 1, 'ANTICIPO A JUAN MANUEL SAQUICH - ABONO INMOBILIARIO', 1, 'N', '1123', null, null, 'S', 'S', 'N'),
      (1, '1124', 1, 'PROVISIÓN PARA CUENTAS INCOBRABLES', 1, 'N', '112', null, null, 'S', 'S', 'N'),
      (1, '1125', 1, 'CLIENTES INTERNOS', 1, 'S', '112', null, null, 'S', 'S', 'N'),
      (1, '112504', 1, 'ANTICIPOS SOBRE SUELDOS', 1, 'S', '1125', null, null, 'S', 'S', 'N'),
      (1, '11250401', 1, 'JUAN MANUEL SAQUICH', 1, 'N', '112504', null, null, 'S', 'S', 'N'),
      (1, '11250402', 1, 'GERBER DE PAZ', 1, 'N', '112504', null, null, 'S', 'S', 'N'),
      (1, '11250403', 1, 'MARIO VASQUEZ', 1, 'N', '112504', null, null, 'S', 'S', 'N'),
      (1, '11250404', 1, 'ANA SAQUICH', 1, 'N', '112504', null, null, 'S', 'S', 'N'),
      (1, '11250405', 1, 'JOSUE ALEJANDRO MIRON', 1, 'N', '112504', null, null, 'S', 'S', 'N'),
      (1, '11250406', 1, 'CARMEN BARRIOS', 1, 'N', '112504', null, null, 'S', 'S', 'N'),
      (1, '11250407', 1, 'LUIS CARDOZA', 1, 'N', '112504', null, null, 'S', 'S', 'N'),
      (1, '11250408', 1, 'ABNER ABEL SANTOS', 1, 'N', '112504', null, null, 'S', 'S', 'N'),
      (1, '11250409', 1, 'IRIS JANETTE GONZALEZ MELGAR SAQUICH', 1, 'N', '112504', null, null, 'S', 'S', 'N'),
      (1, '1126', 1, 'PAGOS POR CUENTA AJENA', 1, 'N', '112', null, null, 'S', 'S', 'N'),
      (1, '1127', 1, 'CUENTAS POR COBRAR DIVERSAS', 1, 'S', '112', null, null, 'S', 'S', 'N'),
      (1, '112701', 1, 'CUENTAS POR COBRAR DIVERSAS EMPLEADOS', 1, 'S', '1127', null, null, 'S', 'S', 'N'),
      (1, '11270101', 1, 'CUENTAS POR COBRAR DIVERSAS GERBER DE PAZ', 1, 'N', '112701', null, null, 'S', 'S', 'N'),
      (1, '11270102', 1, 'CUENTAS POR COBRAR DIVERSAS MARIO MATEO VASQUEZ', 1, 'N', '112701', null, null, 'S', 'S', 'N'),
      (1, '11270103', 1, 'CUENTAS POR COBRAR DIVERSAS ABNER ABEL SANTOS', 1, 'N', '112701', null, null, 'S', 'S', 'N'),
      (1, '11270104', 1, 'CUENTAS POR COBRAR DIVERSAS LUIS CARLOS CARDOZA', 1, 'N', '112701', null, null, 'S', 'S', 'N'),
      (1, '11270105', 1, 'CUENTAS POR COBRAR DIVERSAS ANA GABRIELA SAQUICH', 1, 'N', '112701', null, null, 'S', 'S', 'N'),
      (1, '11270106', 1, 'CUENTAS POR COBRAR DIVERSAS VELVETH NOEMI BARRERA', 1, 'N', '112701', null, null, 'S', 'S', 'N'),
      (1, '112702', 1, 'CUENTAS POR COBRAR DIVERSAS CLIENTES LOCALES', 1, 'S', '1127', null, null, 'S', 'S', 'N'),
      (1, '11270201', 1, 'JESUS DE LOS SANTOS MONTES DE OCA ALVAREZ', 1, 'N', '112702', null, null, 'S', 'S', 'N'),
      (1, '113', 1, 'IMPUESTOS', 1, 'S', '11', null, null, 'S', 'S', 'N'),
      (1, '11301', 1, 'IVA CRÉDITO FISCAL', 1, 'N', '113', null, null, 'S', 'S', 'N'),
      (1, '11302', 1, 'IVA RETENIDO', 1, 'N', '113', null, null, 'S', 'S', 'N'),
      (1, '11303', 1, 'PAGO TRIMESTRAL  (ISO)', 1, 'N', '113', null, null, 'S', 'S', 'N'),
      (1, '11304', 1, 'PAGO TRIMESTRAL (ISR)', 1, 'N', '113', null, null, 'S', 'S', 'N'),
      (1, '11305', 1, 'IVA POR COBRAR IMPORTACIONES', 1, 'N', '113', null, null, 'S', 'S', 'N'),
      (1, '114', 1, 'INVENTARIO', 1, 'S', '11', null, null, 'S', 'S', 'N'),
      (1, '1141', 1, 'INVENTARIO', 1, 'N', '114', null, null, 'S', 'S', 'N'),
      (1, '115', 1, 'CUENTAS TRANSITORIAS', 1, 'S', '11', null, null, 'S', 'S', 'N'),
      (1, '1151', 1, 'MANEJO DE IMPORTACIONES', 1, 'N', '115', null, null, 'S', 'S', 'N'),
      (1, '1152', 1, 'IMPORTACION EN LITIGIO - FALTATE DE MERCADERIA', 1, 'N', '115', null, null, 'S', 'S', 'N'),
      (1, '116', 1, 'OTROS ACTIVOS', 1, 'S', '11', null, null, 'S', 'S', 'N'),
      (1, '11601', 1, 'GARANTIAS', 1, 'S', '116', null, null, 'S', 'S', 'N'),
      (1, '1160101', 1, 'DEPOSITO EN GARANTIA', 1, 'N', '11601', null, null, 'S', 'S', 'N'),
      (1, '11602', 1, 'PAGOS POR ANTICIPADO', 1, 'S', '116', null, null, 'S', 'S', 'N'),
      (1, '1160201', 1, 'SEGUROS PAGADOS POR ANTICIPADO', 1, 'N', '11602', null, null, 'S', 'S', 'N'),
      (1, '1160202', 1, 'SERVICIOS PAGADOS POR ANTICIPADO', 1, 'N', '11602', null, null, 'S', 'S', 'N'),
      (1, '11603', 1, 'CUENTAS POR COBRAR EN LITIGIO', 1, 'S', '116', null, null, 'S', 'S', 'N'),
      (1, '1160301', 1, 'CUENTAS POR COBRAR EN PROCESO', 1, 'S', '11603', null, null, 'S', 'S', 'N'),
      (1, '116030101', 1, 'CUENTAS POR COBRAR EN PROCESO JUDICIAL', 1, 'N', '1160301', null, null, 'S', 'S', 'N'),
      (1, '11604', 1, 'LEASING INDUSTRIAL DE  BI', 1, 'N', '116', null, null, 'S', 'S', 'N'),
      (1, '12', 1, 'ACTIVO NO CORRIENTE', 1, 'S', '1', null, null, 'S', 'S', 'N'),
      (1, '121', 1, 'PROPIEDAD. PLANTA Y EQUIPO', 1, 'S', '12', null, null, 'S', 'S', 'N'),
      (1, '12101', 1, 'MOBILIARIO Y EQUIPO DE OFICINA', 1, 'S', '121', null, null, 'S', 'S', 'N'),
      (1, '1210101', 1, 'MOBILIARIO Y EQUIPO DE OFICINA', 1, 'N', '12101', null, null, 'S', 'S', 'N'),
      (1, '1210102', 1, 'DEPRE. ACUM. MOBILIARIO Y EQUIPO', 1, 'N', '12101', null, null, 'S', 'S', 'N'),
      (1, '1210103', 1, 'EQUIPO DE COMPUTACIÓN', 1, 'N', '12101', null, null, 'S', 'S', 'N'),
      (1, '1210104', 1, 'DEP. ACUM. EQUIPO DE COMPUTACI', 1, 'N', '12101', null, null, 'S', 'S', 'N'),
      (1, '12102', 1, 'HERRAMIENTAS', 1, 'S', '121', null, null, 'S', 'S', 'N'),
      (1, '1210201', 1, 'HERRAMIENTAS', 1, 'N', '12102', null, null, 'S', 'S', 'N'),
      (1, '1210202', 1, 'DEP. ACUM. HERRAMIENTAS', 1, 'N', '12102', null, null, 'S', 'S', 'N'),
      (1, '12103', 1, 'VEHÍCULOS', 1, 'S', '121', null, null, 'S', 'S', 'N'),
      (1, '1210301', 1, 'VEHÍCULOS', 1, 'N', '12103', null, null, 'S', 'S', 'N'),
      (1, '1210302', 1, 'DEP. ACUMULADA VEHÍCULOS', 1, 'N', '12103', null, null, 'S', 'S', 'N'),
      (1, '12104', 1, 'SOFTWARE', 1, 'S', '121', null, null, 'S', 'S', 'N'),
      (1, '1210401', 1, 'SOFWARE', 1, 'N', '12104', null, null, 'S', 'S', 'N'),
      (1, '1210402', 1, 'DEP. ACUM. SOFWARE', 1, 'N', '12104', null, null, 'S', 'S', 'N'),
      (1, '122', 1, 'GASTOS DIFERIDOS', 1, 'S', '12', null, null, 'S', 'S', 'N'),
      (1, '12201', 1, 'COSTOS Y GASTOS DIFERIDOS', 1, 'S', '122', null, null, 'S', 'S', 'N'),
      (1, '1220101', 1, 'COSTOS DIFERIDOS POR APLICAR', 1, 'N', '12201', null, null, 'S', 'S', 'N'),
      (1, '1220102', 1, 'GASTOS DIFERIDOS POR APLICAR', 1, 'N', '12201', null, null, 'S', 'S', 'N'),
      (1, '12202', 1, 'GASTOS POR PERDIDAS DIFERIDOS', 1, 'S', '122', null, null, 'S', 'S', 'N'),
      (1, '1220201', 1, 'GASTOS POR PERDIDAS DIFERIDOS', 1, 'N', '12202', null, null, 'S', 'S', 'N'),
      (1, '2', 1, 'PASIVO', 2, 'S', null, null, null, 'S', 'S', 'N'),
      (1, '21', 1, 'PASIVO CORRIENTE', 2, 'S', '2', null, null, 'S', 'S', 'N'),
      (1, '211', 1, 'A CORTO PLAZO', 2, 'S', '21', null, null, 'S', 'S', 'N'),
      (1, '2110001', 1, 'BICSA', 2, 'N', '2114', null, null, 'S', 'S', 'N'),
      (1, '2111', 1, 'CUENTAS POR PAGAR', 2, 'S', '211', null, null, 'S', 'S', 'N'),
      (1, '211101', 1, 'PROVEEDORES LOCALES', 2, 'S', '2111', null, null, 'S', 'S', 'N'),
      (1, '21110101', 1, 'CXP DE BIENES', 2, 'N', '211101', null, null, 'S', 'S', 'N'),
      (1, '21110102', 1, 'CXP DE SERVICIOS', 2, 'N', '211101', null, null, 'S', 'S', 'N'),
      (1, '21110103', 1, 'CXP X PROVEEDOR', 2, 'N', '211101', null, null, 'S', 'S', 'N'),
      (1, '211102', 1, 'ANTICIPOS DE CLIENTES', 2, 'S', '2111', null, null, 'S', 'S', 'N'),
      (1, '21110201', 1, 'ANTICIPOS DE CLIENTES', 2, 'N', '211102', null, null, 'S', 'S', 'N'),
      (1, '211103', 1, 'CAJA CHICA Y VIATICOS', 2, 'S', '2111', null, null, 'S', 'S', 'N'),
      (1, '21110301', 1, 'CXP VIÁTICOS', 2, 'S', '211103', null, null, 'S', 'S', 'N'),
      (1, '2111030101', 1, 'CXP VIATICOS GERBER DE PAZ', 2, 'N', '21110301', null, null, 'S', 'S', 'N'),
      (1, '2111030102', 1, 'CXP VIATICOS MARIO VASQUEZ', 2, 'N', '21110301', null, null, 'S', 'S', 'N'),
      (1, '2111030103', 1, 'CXP VIATICOS ALEJANDRO MIRON', 2, 'N', '21110301', null, null, 'S', 'S', 'N'),
      (1, '2111030104', 1, 'CXP VIATICOS JUAN MANUEL SAQUICH', 2, 'N', '21110301', null, null, 'S', 'S', 'N'),
      (1, '2111030105', 1, 'CXP VIATICOS VELVETH BARRERA RAMIREZ', 2, 'N', '21110301', null, null, 'S', 'S', 'N'),
      (1, '2111030106', 1, 'CXP VIATICOS LUIS CARDOZA', 2, 'N', '21110301', null, null, 'S', 'S', 'N'),
      (1, '2111030107', 1, 'CXP VIATICOS ABNER ABEL SANTOS SALVAL', 2, 'N', '21110301', null, null, 'S', 'S', 'N'),
      (1, '2111030108', 1, 'CXP VIATICOS ADRIAN ITZEP ALVAREZ', 2, 'N', '21110301', null, null, 'S', 'S', 'N'),
      (1, '21110302', 1, 'CXP  CAJA CHICA', 2, 'N', '211103', null, null, 'S', 'S', 'N'),
      (1, '211105', 1, 'IMPUESTOS POR PAGAR', 2, 'S', '2111', null, null, 'S', 'S', 'N'),
      (1, '21110501', 1, 'IVA DEBITO FISCAL', 2, 'S', '211105', null, null, 'S', 'S', 'N'),
      (1, '2111050101', 1, 'IVA- DEBITO FISCAL', 2, 'N', '21110501', null, null, 'S', 'S', 'N'),
      (1, '2111050103', 1, 'IVA -  FACTURAS ESPECIALES', 2, 'N', '21110501', null, null, 'S', 'S', 'N'),
      (1, '21110502', 1, 'ISR POR PAGAR', 2, 'S', '211105', null, null, 'S', 'S', 'N'),
      (1, '2111050201', 1, 'ISR RETENIDO EMPLEADOS', 2, 'N', '21110502', null, null, 'S', 'S', 'N'),
      (1, '2111050202', 1, 'ISR RETENIDO PROVEEDORES', 2, 'N', '21110502', null, null, 'S', 'S', 'N'),
      (1, '2111050203', 1, 'ISR RETENIDO FACTURAS ESPECIALES', 2, 'N', '21110502', null, null, 'S', 'S', 'N'),
      (1, '2111050204', 1, 'ISR RETENIDO PROVEEDORES NO DOMICILIADOS', 2, 'N', '21110502', null, null, 'S', 'S', 'N'),
      (1, '2111050205', 1, 'ISR RETENIDO RELACION DE DEPENDENCIA', 2, 'N', '21110502', null, null, 'S', 'S', 'N'),
      (1, '2111050206', 1, 'ISR PAGOS TRIMESTRALES', 2, 'N', '21110502', null, null, 'S', 'S', 'N'),
      (1, '2111050207', 1, 'ISR RETENIDO / PAGO DE DIVIDENDOS', 2, 'N', '21110502', null, null, 'S', 'S', 'N'),
      (1, '21110503', 1, 'ISO POR PAGAR', 2, 'S', '211105', null, null, 'S', 'S', 'N'),
      (1, '2111050301', 1, 'ISO POR PAGAR TRIMESTRAL', 2, 'N', '21110503', null, null, 'S', 'S', 'N'),
      (1, '211106', 1, 'SEGUROS POR PAGAR', 2, 'N', '2111', null, null, 'S', 'S', 'N'),
      (1, '211107', 1, 'IGSS POR PAGAR', 2, 'S', '2111', null, null, 'S', 'S', 'N'),
      (1, '21110701', 1, 'IGSS POR PAGAR LABORAL', 2, 'N', '211107', null, null, 'S', 'S', 'N'),
      (1, '21110702', 1, 'IGSS POR PAGAR PATRONAL', 2, 'N', '211107', null, null, 'S', 'S', 'N'),
      (1, '211108', 1, 'GASTOS ACUMULADOS POR PAGAR', 2, 'S', '2111', null, null, 'S', 'S', 'N'),
      (1, '21110801', 1, 'CXP  EMPLEADOS', 2, 'S', '211108', null, null, 'S', 'S', 'N'),
      (1, '2111080101', 1, 'CXP SUELDOS', 2, 'N', '21110801', null, null, 'S', 'S', 'N'),
      (1, '2111080102', 1, 'CXP COMISIONES', 2, 'N', '21110801', null, null, 'S', 'S', 'N'),
      (1, '2111080103', 1, 'CXP BONIFICACIONES', 2, 'N', '21110801', null, null, 'S', 'S', 'N'),
      (1, '21110802', 1, 'CXP PRESTACIONES LABORALES', 2, 'S', '211108', null, null, 'S', 'S', 'N'),
      (1, '2111080201', 1, 'CXP  BONO 14', 2, 'N', '21110802', null, null, 'S', 'S', 'N'),
      (1, '2111080202', 1, 'CXP AGUINALDO', 2, 'N', '21110802', null, null, 'S', 'S', 'N'),
      (1, '2111080203', 1, 'CXP VACACIONES', 2, 'N', '21110802', null, null, 'S', 'S', 'N'),
      (1, '2111080204', 1, 'CXP INDEMNIZACIÓN', 2, 'N', '21110802', null, null, 'S', 'S', 'N'),
      (1, '2111080205', 1, 'CXP LIQUIDACION LABORAL ALEJANDRO MIRON', 2, 'N', '21110802', null, null, 'S', 'S', 'N'),
      (1, '2111080206', 1, 'CXP LIQUIDACION LABORAL CARMEN BARRIOS', 2, 'N', '21110802', null, null, 'S', 'S', 'N'),
      (1, '2111080207', 1, 'CXP LIQUIDACION LABORAL ADRIAN ITZEP ALVAREZ', 2, 'N', '21110802', null, null, 'S', 'S', 'N'),
      (1, '211109', 1, 'PROVEEDORES DEL EXTERIOR', 2, 'S', '2111', null, null, 'S', 'S', 'N'),
      (1, '21110901', 1, 'CXP EXTERIOR', 2, 'S', '211109', null, null, 'S', 'S', 'N'),
      (1, '2111090101', 1, 'M.C.E. MECANICA SRL', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090102', 1, 'ZUCCHELLI FORNI SPA', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090103', 1, 'STM PRODUCTS SRL', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090104', 1, 'COLOM BAKERY EQUIPMENT SL', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090105', 1, 'MACADAMS INTERNATIONAL', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090106', 1, 'BARRADAS REFRIGERACION COMERCIAL', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090107', 1, 'JUAN SAQUICH EL SALVADOR', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090108', 1, 'JESUS ARGUELLO VOZMEDIANO', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090109', 1, 'TRIMA', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090110', 1, 'BALTUR SPA', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090111', 1, 'EQUIPOS NIETO, S.A.', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090112', 1, 'EDHARD CORP', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090113', 1, 'ELIWELL IBÉRICA, S.A.', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090114', 1, 'TEMPZONE SA DE CV', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090115', 1, 'FERSAH MAKINA IMALAT GIDA SANAYI VE TICARET', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090116', 1, 'COMPAÑIA DE TRANSPORTACION MARITIMA ITALIA', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090117', 1, 'REYNALDO JACOBO MERIDA ROMERO / CHINATO MX', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090118', 1, 'ARMANDO JIMENEZ MARTINEZ', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090119', 1, 'WAICO SRL', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090120', 1, 'ZIBO TAIBO INDUSTRIAL CO. LTD', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090121', 1, 'CIMENET USA,LLC', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090122', 1, 'SULI IVONN GONZLES MORALES', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090123', 1, 'INDUSTRIAS ZUNINO SRL', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090124', 1, 'LP GROUP SRL', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090125', 1, 'GEROSA ACHILLE SRL', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090126', 1, 'HOBA VB', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090127', 1, 'CONTEC IND LTD', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090128', 1, 'C.T.M. EN EL EXTERIOR', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090129', 1, 'PCS CENTRAL AMERICA', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090130', 1, 'KMP SRL', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090131', 1, 'COMIPAK ENGINEERING S.R.L.', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090132', 1, 'INOX HORNOS Y EQUIPOS XONI, CIA LTDA', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090133', 1, 'MIMAC  TALIA  SRL', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090134', 1, 'NORTHLAND ALUMINUM PRODUCTS INC', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090135', 1, 'TORTIMAQ Y DISEÑO, S DE RL', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090136', 1, 'NOVATEL MEXICANA S.A. DE C.V.', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090137', 1, 'FORMEX MAQUINARIA S.A.', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090138', 1, 'ECOFLAM BRUCIATORI S.P.A.', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090139', 1, 'MECNOSUD S.R.L.', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090140', 1, 'SPAR FOOD MACHINRY', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090141', 1, 'SOVIFRIGE - INDUSTRIA DE EQUIPAMENTOS HOTELEIROS,LDA', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090142', 1, 'ICB TECNOLOGIE S.R.L.', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090143', 1, 'EQUIPOS NIETOS S.A.', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090144', 1, 'CMA CGM HEAD OFFICE FRANCE', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090145', 1, 'PRISMAFOOD S.R.L.', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090146', 1, 'ZOIN SRL', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090147', 1, 'SIGMA S.R.L.', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090148', 1, 'CORONA C.  S.P.A.', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090149', 1, 'COMTEC INDUSTRIES LTD', 2, 'N', '21110901', null, null, 'S', 'S', 'N'),
      (1, '2111090150', 1, 'LA IDEAL S.A. DE C.V.', 2, 'S', '21110901', null, null, 'S', 'S', 'N'),
      (1, '211110', 1, 'OTRAS CUENTAS POR PAGAR', 2, 'S', '2111', null, null, 'S', 'S', 'N'),
      (1, '21111001', 1, 'JUAN MANUEL SAQUICH', 2, 'N', '211110', null, null, 'S', 'S', 'N'),
      (1, '21111002', 1, 'TARJETA DE CREDITO 1214 MC EMPRESARIAL', 2, 'N', '211110', null, null, 'S', 'S', 'N'),
      (1, '21111003', 1, 'TARJETA DE CREDITO 3438 VISA EMPRESARIAL', 2, 'N', '211110', null, null, 'S', 'S', 'N'),
      (1, '21111004', 1, 'TARJETA INSTITUCIONAL BI 1217', 2, 'N', '211110', null, null, 'S', 'S', 'N'),
      (1, '21111005', 1, 'TARJETA VISA EMPRESARIAL DÓLARES', 2, 'N', '211110', null, null, 'S', 'S', 'N'),
      (1, '211111', 1, 'PROVISION DE COSTOS', 2, 'S', '2111', null, null, 'S', 'S', 'N'),
      (1, '21111101', 1, 'PROVISION DE COSTOS', 2, 'N', '211111', null, null, 'S', 'S', 'N'),
      (1, '211112', 1, 'ANA GABRIELA SAQUICH', 2, 'N', '2111', null, null, 'S', 'S', 'N'),
      (1, '2112', 1, 'ANTICIPO DE CLIENTES', 2, 'S', '211', null, null, 'S', 'S', 'N'),
      (1, '2113', 1, 'CREDITO BANCARIO', 2, 'S', '211', null, null, 'S', 'S', 'N'),
      (1, '21130101', 1, 'CREDITO ACH G&T Q', 2, 'N', '2113', null, null, 'S', 'S', 'N'),
      (1, '2114', 1, 'CXP DIVERSAS', 2, 'S', '211', null, null, 'S', 'S', 'N'),
      (1, '2115', 1, 'OTRAS CUENTAS POR PAGAR', 2, 'S', '211', null, null, 'S', 'S', 'N'),
      (1, '211501', 1, 'OTRAS CUENTAS POR PAGAR PROVEEDORES', 2, 'N', '2115', null, null, 'S', 'S', 'N'),
      (1, '211502', 1, 'OTRAS CUENTAS POR PAGAR FACILIDADES DE PAGO IMPUESTOS', 2, 'N', '2115', null, null, 'S', 'S', 'N'),
      (1, '212', 1, 'A LARGO PLAZO', 2, 'S', '21', null, null, 'S', 'S', 'N'),
      (1, '21201', 1, 'PRESTAMOS BANCARIOS', 2, 'S', '212', null, null, 'S', 'S', 'N'),
      (1, '2120101', 1, 'PRESTAMO BANCO INDUSTRIAL QUETZALES', 2, 'N', '21201', null, null, 'S', 'S', 'N'),
      (1, '2120102', 1, 'LEASING INDUSTRIAL BI QUETZALES', 2, 'N', '21201', null, null, 'S', 'S', 'N'),
      (1, '21202', 1, 'PRESTAMOS ACCIONISTA', 2, 'S', '212', null, null, 'S', 'S', 'N'),
      (1, '2120201', 1, 'PRESTAMOS ACCIONISTA  JUAN MANUEL SAQUICH', 2, 'N', '21202', null, null, 'S', 'S', 'N'),
      (1, '21202202', 1, 'PRESTAMO ACCIONISTA JUAN MANUEL SAQUICH (BAC)', 2, 'N', '21202', null, null, 'S', 'S', 'N'),
      (1, '3', 1, 'CAPITAL. RESERVAS Y UTILIDADES', 3, 'S', null, null, null, 'S', 'S', 'N'),
      (1, '31', 1, 'CAPITAL. RESERVAS Y UTILIDADES', 3, 'S', '3', null, null, 'S', 'S', 'N'),
      (1, '311', 1, 'CAPITAL SOCIAL', 3, 'S', '31', null, null, 'S', 'S', 'N'),
      (1, '31101', 1, 'CAPITAL SUSCRITO Y PAGADO', 3, 'N', '311', null, null, 'S', 'S', 'N'),
      (1, '31102', 1, 'APORTE A FUTURAS CAPITALIZACIONES', 3, 'N', '311', null, null, 'S', 'S', 'N'),
      (1, '31103', 1, 'RESULTADOS ACUMULADOS', 3, 'S', '311', null, null, 'S', 'S', 'N'),
      (1, '3110301', 1, 'UTILIDAD O PÉRDIDA ACUMULADA', 3, 'N', '31103', null, null, 'S', 'S', 'N'),
      (1, '3110302', 1, 'RESULTADO DEL EJERCICIO 2020', 3, 'N', '31103', null, null, 'S', 'S', 'N'),
      (1, '3110303', 1, 'RESULTADO DEL EJERCICIO 2021', 3, 'N', '31103', null, null, 'S', 'S', 'N'),
      (1, '3110304', 1, 'RESULTADO DEL EJERCICIO 2022', 3, 'N', '31103', null, null, 'S', 'S', 'N'),
      (1, '3110305', 1, 'RESULTADO DEL EJERCICIO 2023', 3, 'N', '31103', null, null, 'S', 'S', 'N'),
      (1, '3110306', 1, 'RESULTADO DEL EJERCICIO  2024', 3, 'N', '31103', null, null, 'S', 'S', 'N'),
      (1, '3110307', 1, 'RESULTADO DEL EJERCICIO 2025', 3, 'N', '31103', null, null, 'S', 'S', 'N'),
      (1, '3110308', 1, 'RESULTADO DEL EJERCICIO ACTUAL', 3, 'N', '31103', null, null, 'S', 'S', 'N'),
      (1, '312', 1, 'RESERVAS', 3, 'S', '31', null, null, 'S', 'S', 'N'),
      (1, '3121', 1, 'RESERVAS', 3, 'S', '312', null, null, 'S', 'S', 'N'),
      (1, '312101', 1, 'RESERVA LEGAL 5%', 3, 'N', '3121', null, null, 'S', 'S', 'N'),
      (1, '33', 1, 'UTILIDAD O PERDIDA DEL EJERCICIO ACTUAL', 3, 'S', '3', null, null, 'S', 'S', 'N'),
      (1, '331', 1, 'RESULTADO DEL EJERCICIO ACTUAL', 3, 'N', '33', null, null, 'S', 'S', 'N'),
      (1, '332', 1, 'RESULTADO DE EJERCICIOS ANTERIORES', 3, 'N', '33', null, null, 'S', 'S', 'N'),
      (1, '4', 1, 'INGRESOS', 4, 'S', null, null, null, 'S', 'S', 'N'),
      (1, '41', 1, 'INGRESOS DE VENTAS', 4, 'S', '4', null, null, 'S', 'S', 'N'),
      (1, '411', 1, 'VENTAS', 4, 'S', '41', null, null, 'S', 'S', 'N'),
      (1, '4111', 1, 'VENTA DE EQUIPO', 4, 'N', '411', null, null, 'S', 'S', 'N'),
      (1, '4112', 1, 'VENTA DE REPUESTOS', 4, 'N', '411', null, null, 'S', 'S', 'N'),
      (1, '4113', 1, 'VENTA DE ACCESORIOS', 4, 'N', '411', null, null, 'S', 'S', 'N'),
      (1, '4114', 1, 'VENTA DE SERVICIOS', 4, 'N', '411', null, null, 'S', 'S', 'N'),
      (1, '412', 1, 'DEVOLUCIONES Y REBAJAS DE VENTAS', 4, 'N', '41', null, null, 'S', 'S', 'N'),
      (1, '413', 1, 'INGRESOS OPERATIVOS POR COMISION', 4, 'N', '41', null, null, 'S', 'S', 'N'),
      (1, '5', 1, 'COSTO DE VENTAS', 5, 'S', null, null, null, 'S', 'S', 'N'),
      (1, '51', 1, 'COSTO DE VENTAS', 5, 'S', '5', null, null, 'S', 'S', 'N'),
      (1, '511', 1, 'COSTO DE VENTAS', 5, 'N', '51', null, null, 'S', 'S', 'N'),
      (1, '512', 1, 'COMPRAS Y SERVICIOS', 5, 'S', '51', null, null, 'S', 'S', 'N'),
      (1, '51201', 1, 'COMPRAS LOCALES ACCESORIOS', 5, 'N', '512', null, null, 'S', 'S', 'N'),
      (1, '51202', 1, 'FLETES', 5, 'N', '512', null, null, 'S', 'S', 'N'),
      (1, '51203', 1, 'REPARACIONES TALLER, HERRERÍA Y TORNO', 5, 'N', '512', null, null, 'S', 'S', 'N'),
      (1, '51204', 1, 'MONTAJE DE EQUIPO', 5, 'N', '512', null, null, 'S', 'S', 'N'),
      (1, '513', 1, 'OTROS COSTOS Y GASTOS DE IMPORTACION', 5, 'N', '51', null, null, 'S', 'S', 'N'),
      (1, '52', 1, 'DESCUENTO SOBRE COMPRAS', 5, 'N', '5', null, null, 'S', 'S', 'N'),
      (1, '6', 1, 'COSTOS Y GASTOS DE OPERACIÓN', 6, 'S', null, null, null, 'S', 'S', 'N'),
      (1, '61', 1, 'GASTO DE VENTAS  ( GV )', 6, 'S', '6', null, null, 'S', 'S', 'N'),
      (1, '6101', 1, 'GV - SUELDO ORDINARIO', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6102', 1, 'GV - BONIFICACIÓN E INCENTIVO DE LEY', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6103', 1, 'GV - BONIFICACIÓN E INCENTIVO SOBRE METAS', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6104', 1, 'GV - CUOTA PATRONAL', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6105', 1, 'GV - CUOTA IRTRA', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6106', 1, 'GV - CUOTA INTECAP', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6107', 1, 'GV - BONO 14', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6108', 1, 'GV - AGUINALDO', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6109', 1, 'GV - VACACIONES', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6110', 1, 'GV - INDEMNIZACIÓN', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6111', 1, 'GV - COMISIONES', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6112', 1, 'GV - ALIMENTACIÓN', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6113', 1, 'GV - HOSPEDAJE', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6114', 1, 'GV - COMBUSTIBLE', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6115', 1, 'GV- IMPUESTOS Y CONTRIBUCIONES', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6116', 1, 'GV - PARQUEO Y PEAJES', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6117', 1, 'GV - PASAJE', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6118', 1, 'GV - UNIFORMES', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6119', 1, 'GV - TELÉFONO Y FAX', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6120', 1, 'GV - PAPELERÍA Y ÚTILES', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6121', 1, 'GV - COPIAS. IMPRESIONES Y ENCUADERNACIONES', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6122', 1, 'GV - SERVICIOS PROFESIONALES', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6123', 1, 'GV - ACTIVOS MENORES Y HERRAMIENTAS', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6124', 1, 'GV - MATERIALES DIVERSOS', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6125', 1, 'GV - CONGRESOS Y CAPACITACIONES', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6126', 1, 'GV - PUBLICIDAD Y PROPAGANDA', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6127', 1, 'GV - COURIER Y FLETES', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6128', 1, 'GV - FESTEJOS Y AGASAJOS INTERNOS', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6129', 1, 'GV - FESTEJOS Y AGASAJOS CLIENTES EXTERNOS', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6130', 1, 'GV - MANTENIMIENTO VEHÍCULO', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6131', 1, 'GV - SUMINISTROS DE COCINA Y LIMPIEZA', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6132', 1, 'GV - SEGURIDAD Y VIGILANCIA', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6133', 1, 'GV - SEGURO DE VEHÍCULOS', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6134', 1, 'GV - GASTOS DE IMPORTACIÓN DE MUESTRAS', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6135', 1, 'GV - GASTOS VARIOS', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6136', 1, 'GV - GASTOS NO DEDUCIBLES', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6137', 1, 'GV - SERVICIOS TECNICOS', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6138', 1, 'GV - DEPRECIACION ACTIVO FIJO', 6, 'S', '61', null, null, 'S', 'S', 'N'),
      (1, '613801', 1, 'HERRAMIENTA', 6, 'N', '6138', null, null, 'S', 'S', 'N'),
      (1, '613802', 1, 'VEHICULOS', 6, 'N', '6138', null, null, 'S', 'S', 'N'),
      (1, '6140', 1, 'GV- GARANTÍA DE EQUIPOS Y REPUESTOS', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6141', 1, 'GV- ALQUILER DE EQUIPOS', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6142', 1, 'GV- FERIAS Y EXPOSICIONES', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '6143', 1, 'GV - MAT. PRIMAS PARA ELABORAC. ALIMENTOS PRUEBAS EQUIPOS', 6, 'N', '61', null, null, 'S', 'S', 'N'),
      (1, '62', 1, 'GASTOS DE ADMINISTRACION ( GA )', 6, 'S', '6', null, null, 'S', 'S', 'N'),
      (1, '6201', 1, 'GA - SUELDO ORDINARIO', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6202', 1, 'GA - BONIFICACIÓN E INCENTIVO DE LEY', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6203', 1, 'GA - BONIFICACIÓN E INCENTIVO SOBRE METAS', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6204', 1, 'GA - CUOTA PATRONAL', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6205', 1, 'GA - CUOTA IRTRA', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6206', 1, 'GA - CUOTA INTECAP', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6207', 1, 'GA - BONO 14', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6208', 1, 'GA - AGUINALDO', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6209', 1, 'GA - VACACIONES', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6210', 1, 'GA - INDEMNIZACIÓN', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6211', 1, 'GA - ALIMENTACIÓN', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6212', 1, 'GA - HOSPEDAJE', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6213', 1, 'GA - COMBUSTIBLE', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6214', 1, 'GA- IMPUESTOS Y CONTRIBUCIONES', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6215', 1, 'GA - PARQUEO Y PEAJES', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6216', 1, 'GA - PASAJE', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6217', 1, 'GA - UNIFORMES', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6218', 1, 'GA - TELÉFONO E INTERNET', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6219', 1, 'GA - PAPELERÍA Y ÚTILES', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6220', 1, 'GA - COPIAS. IMPRESIONES Y ENCUADERNACIONES', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6221', 1, 'GA - SERVICIOS PROFESIONALES', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6222', 1, 'GA - GASTOS ADMINISTRATIVOS', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6223', 1, 'GA - SUSCRIPCIONES Y AFILIACIONES', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6224', 1, 'GA - COURIER Y FLETES', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6225', 1, 'GA - FESTEJOS Y AGASAJOS', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6226', 1, 'GA - MANTENIMIENTO VEHÍCULO', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6227', 1, 'GA - MANTENIMIENTO EQUIPO DE COMPUTACIÓN', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6228', 1, 'GA - MANTENIMIENTO Y LIMPIEZA', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6229', 1, 'GA - SUMINISTROS DE COCINA Y LIMPIEZA', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6230', 1, 'GA - ARRENDAMIENTO DE OFICINAS', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6231', 1, 'GA - AGUA', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6232', 1, 'GA - ENERGÍA ELÉCTRICA', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6233', 1, 'GA - IMPUESTOS Y CONTRIBUCIONES', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6234', 1, 'GA - SEGURIDAD Y VIGILANCIA', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6235', 1, 'GA - SEGURO DE VEHÍCULOS', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6236', 1, 'GA - MULTAS Y RECARGOS', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6237', 1, 'GA - MANTENIMIENTO DE OFICINA', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6238', 1, 'GA - GASTOS VARIOS', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6239', 1, 'GA - GASTOS NO DEDUCIBLES', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6240', 1, 'GA-SERVICIOS TECNICOS', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6241', 1, 'GA - DEPRECIACION ACTIVOS FIJOS', 6, 'S', '62', null, null, 'S', 'S', 'N'),
      (1, '624101', 1, 'MOBILIARIO Y EQUIPO DE OFICINA', 6, 'N', '6241', null, null, 'S', 'S', 'N'),
      (1, '624102', 1, 'EQUIPO COMPUTO', 6, 'N', '6241', null, null, 'S', 'S', 'N'),
      (1, '624103', 1, 'SOFTWARE', 6, 'N', '6241', null, null, 'S', 'S', 'N'),
      (1, '624104', 1, 'VEHÍCULOS', 6, 'N', '6241', null, null, 'S', 'S', 'N'),
      (1, '624105', 1, 'HERRAMIENTAS', 6, 'N', '6241', null, null, 'S', 'S', 'N'),
      (1, '6242', 1, 'GA- SEGURO Y GASTOS MÉDICOS', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6243', 1, 'GA- SERVICIO DE MENSAJERÍA', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6244', 1, 'GA- DONACIONES', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6245', 1, 'GA- ACTIVOS MENORES Y HERRAMIENTAS', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6246', 1, 'GA- SEGUROS DE VIAJE', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6247', 1, 'GA- GASTOS DEVIAJE AL EXTERIOR', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6248', 1, 'GA- TRAMITES LEGALES, SERVICIOS JURIDICOS', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6249', 1, 'GA- ARRENDAMIENTO DE VEHICULOS', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6250', 1, 'GA- GAS', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6251', 1, 'GA- ACCESORIOS Y UTILES DE COMPUTACION', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6252', 1, 'GA- ALQULER DE TAXIS', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '6253', 1, 'GA- GASTABLES Y DESECHABLES', 6, 'N', '62', null, null, 'S', 'S', 'N'),
      (1, '63', 1, 'GASTOS DEPARTAMENTO TÉCNICO ( GT )', 6, 'S', '6', null, null, 'S', 'S', 'N'),
      (1, '6301', 1, 'GT- SUELDO ORDINARIO', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6302', 1, 'GT- BONIFICACIÓN E INCENTIVO DE LEY', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6303', 1, 'GT- BONIFICACIÓN E INCENTIVOS SOBRE METAS', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6304', 1, 'GT-CUOTA PATRONAL', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6305', 1, 'GT-CUOTA IRTRA', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6306', 1, 'GT-CUOTA INTECAP', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6307', 1, 'GT-BONO 14', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6308', 1, 'GT-AGUINALDO', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6309', 1, 'GT-VACACIONES', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6310', 1, 'GT-INDEMNIZACIÓN', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6311', 1, 'GT- ALIMENTACIÓN', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6312', 1, 'GT- HOSPEDAJE', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6313', 1, 'GT- COMBUSTIBLES Y LUBRICANTES', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6314', 1, 'GT- IMPUESTOS Y CONTRIBUCIONES', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6315', 1, 'GT- TELEFONO', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6316', 1, 'GT- ACCESORIOS Y EQUIPOS PARA REPARACIONES', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6317', 1, 'GT-,MANTENIMIENTO VEHÍCULO', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6318', 1, 'GT- SERVICIOS Y ASISTENCIAS TÉCNICAS', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6319', 1, 'GT-PARQUEO Y PEAJES', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6320', 1, 'GT- COMISIONES', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6321', 1, 'GT- GASTOS NO DEDUCIBLES', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6322', 1, 'GT- PASAJE', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6323', 1, 'GT- GASTOS DE VIAJE', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6324', 1, 'GT- HORAS EXTRAS', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6325', 1, 'GT - MEDIOS DE PROTECCION', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '6326', 1, 'GT - ALQUILER DE EQUIPOS', 6, 'N', '63', null, null, 'S', 'S', 'N'),
      (1, '64', 1, 'SUCURSAL DE EL SALVADOR (GSLV)', 6, 'S', '6', null, null, 'S', 'S', 'N'),
      (1, '6401', 1, 'GSLV - SUELDO ORDINARIO', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6402', 1, 'GSLV - BONIFICACIÓN E INCENTIVO DE LEY', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6403', 1, 'GSLV - BONIFICACIÓN E INCENTIVOS SOBRE METAS', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6404', 1, 'GSLV - CUOTA PATRONAL', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6405', 1, 'GSLV - CUOTA IRTRA', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6406', 1, 'GSLV - CUOTA INTECAP', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6407', 1, 'GSLV - BONO 14', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6408', 1, 'GSLV - AGUINALDO', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6409', 1, 'GSLV - VACACIONES', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6410', 1, 'GSLV - INDEMNIZACIÓN', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6411', 1, 'GSLV - ALIMENTACIÓN', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6412', 1, 'GSLV - HOSPEDAJE', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6413', 1, 'GSLV - COMBUSTIBLES Y LUBRICANTES', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6414', 1, 'GSLV - IMPUESTOS Y CONTRIBUCIONES', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6415', 1, 'GSLV - TELEFONO', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6416', 1, 'GSLV - ACCESORIOS Y EQUIPOS PARA REPARACIONES', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6417', 1, 'GSLV - MANTENIMIENTO VEHÍCULO', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6418', 1, 'GSLV - SERVICIOS Y ASISTENCIAS TÉCNICAS', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6419', 1, 'GSLV -  PARQUEO Y PEAJES', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6420', 1, 'GSLV -  COMISIONES', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6421', 1, 'GSLV -  GASTOS NO DEDUCIBLES', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6422', 1, 'GSLV -  PASAJE', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6423', 1, 'GSLV -  GASTOS DE VIAJE', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6424', 1, 'GSLV -  HORAS EXTRAS', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6425', 1, 'GSLV - MEDIOS DE PROTECCION', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6426', 1, 'GSLV - ALQUILER DE EQUIPOS', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6427', 1, 'GSLV - PAPELERIA Y UTILES', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '6428', 1, 'GSLV - COURIER Y FLETES', 6, 'N', '64', null, null, 'S', 'S', 'N'),
      (1, '7', 1, 'OTROS INGRESOS Y GASTOS', 7, 'S', null, null, null, 'S', 'S', 'N'),
      (1, '701', 1, 'OTROS INGRESOS FINANCIEROS  ( IF )', 7, 'S', '7', null, null, 'S', 'S', 'N'),
      (1, '70101', 1, 'IF - DESCUENTOS SOBRE COMPRAS', 7, 'N', '701', null, null, 'S', 'S', 'N'),
      (1, '70102', 1, 'IF - INTERESES GANADOS', 7, 'N', '701', null, null, 'S', 'S', 'N'),
      (1, '70103', 1, 'IF - DIFERENCIAL CAMBIARIO', 7, 'N', '701', null, null, 'S', 'S', 'N'),
      (1, '70104', 1, 'IF - OTROS INGRESOS DE OPERACIONES BANCARIAS', 7, 'N', '701', null, null, 'S', 'S', 'N'),
      (1, '702', 1, 'OTROS GASTOS FINANCIEROS  ( GF )', 7, 'S', '7', null, null, 'S', 'S', 'N'),
      (1, '70201', 1, 'GF - INTERÉS PRÉSTAMO BANCARIO', 7, 'N', '702', null, null, 'S', 'S', 'N'),
      (1, '70203', 1, 'GF - COMISIONES BANCARIAS', 7, 'N', '702', null, null, 'S', 'S', 'N'),
      (1, '70204', 1, 'GF - DIFERENCIAL CAMBIARIO', 7, 'N', '702', null, null, 'S', 'S', 'N'),
      (1, '70205', 1, 'GF - OTROS GASTOS DE OPERACIONES BANCARIAS', 7, 'N', '702', null, null, 'S', 'S', 'N'),
      (1, '703', 1, 'OTROS INGRESOS NO OPERATIVOS', 7, 'S', '7', null, null, 'S', 'S', 'N'),
      (1, '70301', 1, 'OTROS INGRESOS NO OPERATIVOS', 7, 'N', '703', null, null, 'S', 'S', 'N'),
      (1, '704', 1, 'OTROS GASTOS NO OPERATIVOS', 7, 'S', '7', null, null, 'S', 'S', 'N'),
      (1, '70401', 1, 'OTROS GASTOS NO OPERATIVOS', 7, 'N', '704', null, null, 'S', 'S', 'N'),
      (1, '70402', 1, 'OTROS GASTOS NO OPERATIVOS OTROS', 7, 'N', '704', null, null, 'S', 'S', 'N');

  -- De la cuenta de nivel 1 hacia las subcuentas, para que cada cuenta mayor exista antes.
  for r in select * from m_cuentas order by localidad, version, length(codigo), codigo loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.localidad;
    if v_loc is null then
      if position(format('4-%s', lpad(r.localidad::text, 2, '0')) in v_omitidas) = 0 then v_omitidas := v_omitidas || format(' 4-%s', lpad(r.localidad::text, 2, '0')); end if;
      continue;
    end if;
    select id into v_cat from public.catalogos_cuentas where localidad_id = v_loc and version = r.version;
    if v_cat is null then
      insert into public.catalogos_cuentas (organizacion_id, localidad_id, version, fecha_del, activo)
      values (v_org, v_loc, r.version, current_date, true) returning id into v_cat;
      v_versiones := v_versiones + 1;
    end if;
    select id into v_tipo from public.tipos_cuenta where localidad_id = v_loc and codigo = r.tipo;
    select c.id into v_mayor from public.cuentas c
    where c.catalogo_id = v_cat and length(c.codigo) < length(r.codigo) and left(r.codigo, length(c.codigo)) = c.codigo
    order by length(c.codigo) desc limit 1;
    select id into v_id from public.cuentas where catalogo_id = v_cat and codigo = r.codigo;
    if v_id is not null then
      update public.cuentas set
        nombre = upper(trim(r.nombre)),
        integra = r.integracion = 'S',
        vigente = coalesce(r.vigente, 'N') = 'S',
        mostrar = coalesce(r.mostrar, 'N') = 'S',
        aplica_centro_costo = coalesce(r.aplica_centro, 'N') = 'S',
        mascara = coalesce(r.mascara, mascara),
        cuenta_anterior = coalesce(r.cuenta_anterior, cuenta_anterior),
        tipo_cuenta_id = case when cuenta_mayor_id is null and v_tipo is not null then v_tipo else tipo_cuenta_id end
      where id = v_id;
      if (select cuenta_mayor_id from public.cuentas where id = v_id) is distinct from v_mayor then v_otra_mayor := v_otra_mayor + 1; end if;
      v_actualizadas := v_actualizadas + 1;
    else
      if v_mayor is null and v_tipo is null then
        raise exception 'La localidad 4-% no tiene el tipo de cuenta % (cuenta %): ejecuta antes el script 221.', lpad(r.localidad::text, 2, '0'), r.tipo, r.codigo;
      end if;
      insert into public.cuentas (catalogo_id, codigo, nombre, cuenta_mayor_id, tipo_cuenta_id, integra, cuenta_anterior, vigente, mascara, mostrar, aplica_centro_costo)
      values (v_cat, r.codigo, upper(trim(r.nombre)), v_mayor, v_tipo, r.integracion = 'S', r.cuenta_anterior,
              coalesce(r.vigente, 'N') = 'S', r.mascara, coalesce(r.mostrar, 'N') = 'S', coalesce(r.aplica_centro, 'N') = 'S');
      v_nuevas := v_nuevas + 1;
    end if;
  end loop;
  raise notice '%', format('Cuentas de la organización 4: %s nuevas, %s actualizadas, %s versiones de catálogo creadas.%s%s', v_nuevas, v_actualizadas, v_versiones,
    case when v_otra_mayor > 0 then format(' %s cuentas existentes tienen otra cuenta mayor (no se cambia).', v_otra_mayor) else '' end,
    case when v_omitidas <> '' then ' Localidades que no existen (omitidas):' || v_omitidas else '' end);
end;
$migra$;


-- ======================================================================================
-- 2. Objetos contables
-- ======================================================================================
alter table public.objetos_contables add column if not exists version_nomenclatura integer;
alter table public.objetos_contables add column if not exists no_cuentas_anterior integer;

create or replace function public.numerar_objeto_contable() returns trigger
language plpgsql security definer set search_path = '' as $fn$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4805, new.localidad_id::integer);
    if tg_table_name = 'objetos_contables' then
      -- Migración: se conserva el número del sistema anterior.
      if not (current_setting('fin.migracion', true) = 'si' and new.numero is not null) then
        new.numero := coalesce((select max(numero) from public.objetos_contables where localidad_id = new.localidad_id), 0) + 1;
      end if;
    elsif new.numero is null then
      new.numero := coalesce((select max(numero) from public.transacciones_contables where localidad_id = new.localidad_id), 1000) + 1;
    end if;
  else
    new.organizacion_id := old.organizacion_id;
    new.localidad_id := old.localidad_id;
    if tg_table_name = 'objetos_contables' or new.numero is null then
      new.numero := old.numero;
    end if;
  end if;
  if tg_table_name = 'transacciones_contables' and exists (
       select 1 from public.transacciones_contables t
       where t.localidad_id = new.localidad_id and t.numero = new.numero and t.id is distinct from new.id) then
    raise exception 'Ya existe la transacción % en esta localidad: usa otro código.', new.numero;
  end if;
  new.descripcion := upper(trim(new.descripcion));
  return new;
end;
$fn$;

do $migra$
declare
  v_org bigint;
  v_loc bigint;
  r record;
  v_nuevos integer := 0;
  v_actualizados integer := 0;
  v_omitidas text := '';
begin
  select id into v_org from public.organizaciones where codigo = 4;
  if v_org is null then raise exception 'No existe la organización 4.'; end if;
  perform set_config('fin.migracion', 'si', true);
  for r in
    select * from (values
      (1, 1, 'PROVEEDORES', 1, 5),
      (1, 2, 'CREDITOS', 1, 7),
      (1, 3, 'COSTEO PROYECTOS', 1, 2),
      (1, 4, 'IMPUESTOS', 1, 7),
      (1, 5, 'TIPOS DE CONTRATOS', 1, 1),
      (1, 6, 'COMPRAS', 1, 5),
      (1, 7, 'TRANSFERENCIAS - AUTORIZACIONES', 1, 2),
      (1, 8, 'FACTURAS VENTAS', 1, 7),
      (1, 9, 'CHEQUES', 1, 2),
      (1, 10, 'CAJAS/LIQUIDACIONES', 1, 1),
      (1, 11, 'POLIZAS', 1, 10),
      (1, 12, 'DEPOSITOS BANCARIOS', 1, 2),
      (1, 13, 'NOTAS DE CREDITO BANCOS', 1, 2),
      (1, 14, 'RECIBOS', 1, 2),
      (1, 15, 'ENTRADAS A BODEGA', 1, 2),
      (1, 16, 'TRASLADOS ENTRE BODEGAS', 1, 2),
      (1, 17, 'SALIDAS DE BODEGA', 1, 2),
      (1, 18, 'AJUSTES DE INVENTARIO', 1, 2),
      (1, 19, 'BODEGAS', 1, 1),
      (1, 20, 'NOTAS DE DEBITO BANCOS', 1, 2),
      (1, 21, 'REVERSIÓN ENTRADAS A BODEGA', 1, 2),
      (1, 22, 'REVERSIÓN TRASLADOS ENTRE BODEGAS', 1, 2),
      (1, 23, 'REVERSIÓN SALIDAS DE BODEGA', 1, 2),
      (1, 24, 'REVERSIÓN AJUSTES DE INVENTARIO', 1, 2),
      (1, 25, 'CHEQUES ANULADOS', 1, 2),
      (1, 26, 'DEPRECIACIONES', 1, 2),
      (1, 27, 'NOTAS  SOBRE VENTAS', 1, 7),
      (1, 28, 'RETENCIONES IVA', 1, 2),
      (1, 29, 'EXENCIONES DE IVA', 1, 2),
      (1, 30, 'ALTAS ACTIVOS FIJOS', 1, 2),
      (1, 31, 'TRANSFERENCIAS - COMISIONES', 1, 9),
      (1, 32, 'DEVOLUCIONES', 1, 2),
      (1, 33, 'NOTAS CREDITO SOBRE COMPRAS', 1, 2),
      (1, 34, 'NOMINAS', 1, 2),
      (1, 35, 'ANTICIPOS VARIOS', 1, 1),
      (1, 36, 'PAGOS CON TC', 1, 1),
      (1, 37, 'LIQUIDACION TC', 1, 1),
      (1, 39, 'INVENTARIO NOTAS DE CREDITO SOBRE VENTAS', 1, 1)
    ) as x (localidad, objeto, descripcion, version_nomenclatura, no_cuentas)
    order by localidad, objeto
  loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.localidad;
    if v_loc is null then
      if position(format('4-%s', lpad(r.localidad::text, 2, '0')) in v_omitidas) = 0 then v_omitidas := v_omitidas || format(' 4-%s', lpad(r.localidad::text, 2, '0')); end if;
      continue;
    end if;
    if exists (select 1 from public.objetos_contables where localidad_id = v_loc and numero = r.objeto) then
      update public.objetos_contables set descripcion = r.descripcion, version_nomenclatura = r.version_nomenclatura, no_cuentas_anterior = r.no_cuentas
      where localidad_id = v_loc and numero = r.objeto;
      v_actualizados := v_actualizados + 1;
    else
      insert into public.objetos_contables (organizacion_id, localidad_id, numero, descripcion, activo, version_nomenclatura, no_cuentas_anterior)
      values (v_org, v_loc, r.objeto, r.descripcion, true, r.version_nomenclatura, r.no_cuentas);
      v_nuevos := v_nuevos + 1;
    end if;
  end loop;
  perform set_config('fin.migracion', '', true);
  raise notice '%', format('Objetos contables de la organización 4: %s nuevos, %s actualizados.%s', v_nuevos, v_actualizados,
    case when v_omitidas <> '' then ' Localidades que no existen (omitidas):' || v_omitidas else '' end);
end;
$migra$;


-- ======================================================================================
-- 3. Transacciones contables y sus cuentas
-- ======================================================================================
alter table public.transacciones_contables add column if not exists modulo text;
alter table public.transacciones_contables add column if not exists plantilla text;
alter table public.transacciones_contables add column if not exists automatica boolean;
alter table public.transacciones_contables add column if not exists version_nomenclatura integer;
alter table public.transacciones_contables add column if not exists transaccion_visual integer;
alter table public.transacciones_contables add column if not exists modo_generacion text;
alter table public.transacciones_contables add column if not exists tipo_transaccion text;
alter table public.transacciones_contables add column if not exists usuario_modifica_anterior text;
alter table public.transacciones_contables add column if not exists fecha_modifica_anterior date;
alter table public.transaccion_cuentas add column if not exists version integer;
alter table public.transaccion_cuentas add column if not exists operacion_anterior integer;
alter table public.transaccion_cuentas add column if not exists tipo_int_centro text;
alter table public.transaccion_cuentas add column if not exists centro_costo_anterior text;
alter table public.transaccion_cuentas add column if not exists gastos boolean;
alter table public.transacciones_contables add column if not exists usuario_ingresa_anterior text;
alter table public.transacciones_contables add column if not exists fecha_ingresa_anterior date;
alter table public.transacciones_contables add column if not exists tipo_operacion_anterior text;

do $migra$
declare
  v_org bigint;
  v_loc bigint;
  v_trx bigint;
  v_cuenta bigint;
  v_centro bigint;
  r record;
  v_trx_nuevas integer := 0;
  v_trx_act integer := 0;
  v_lin_nuevas integer := 0;
  v_lin_act integer := 0;
  v_sin_cuenta integer := 0;
  v_omitidas text := '';
begin
  select id into v_org from public.organizaciones where codigo = 4;
  if v_org is null then raise exception 'No existe la organización 4.'; end if;

  -- ---------- Encabezados ----------
  for r in
    select * from (values
      (1, 1001, 'POLIZAS GENERAL', null::text, null::text, null::text, 1, null, 'A', 'C', 'N', 'S', null, null, null::text, 'FRA'::text, 45414::integer, null::text),
      (1, 1002, 'DEPOSITOS VARIOS BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'AIA', 45502, null, 'AIA', 45462, null),
      (1, 1003, 'BANRURAL DEPOSITOS VARIOS', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'FRA', 45574, null, 'AIA', 45462, null),
      (1, 1004, 'NOTAS DE CREDITO BANRURAL Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45546, null, 'FRA', 45476, null),
      (1, 1005, 'NOTAS DE DEBITO  G&T CONTINENTAL $', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45546, null, 'FRA', 45476, null),
      (1, 1006, 'SERVICIOS DE IMPORTACIONES', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'AIA', 45498, null, 'FRA', 45476, null),
      (1, 1007, 'GASTOS VARIOS', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'AIA', 45499, null, 'FRA', 45476, null),
      (1, 1008, 'COMPRAS INVENTARIO LOCALES', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45749, null, 'FRA', 45490, null),
      (1, 1009, 'NOTAS DE DEBITO ANTICIPO PROVEEDORES LOCALES BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45871, null, 'AIA', 45497, null),
      (1, 1010, 'VENTAS AL CREDITO', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45560, null, 'AIA', 45497, null),
      (1, 1011, 'SERVICIOS PRESTADOS', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'AIA', 45499, null),
      (1, 1012, 'NOTA DEBITO DE CXP PROVEEDORES BIENES BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45871, null, 'AIA', 45502, null),
      (1, 1013, 'NOTA DEBITO DE CXP PROVEEDORES SERVICIOS BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45871, null, 'AIA', 45502, null),
      (1, 1014, 'COMPRA LOCALES VARIAS', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'AIA', 45517, null, 'AIA', 45502, null),
      (1, 1015, 'SERVICIOS ADQUIRIDOS POR PAGAR', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'AIA', 45531, null, 'AIA', 45502, null),
      (1, 1016, 'NOTAS DE DEBITO G&T CONTINENTAL Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45546, null, 'AIA', 45537, null),
      (1, 1017, 'BI PAGO DE IMPUESTOS', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'AIA', 45544, null, 'AIA', 45544, null),
      (1, 1018, 'PAGO BONIFIICACIONES Y/O COMISIONES', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45544, null, 'JES', 45544, null),
      (1, 1019, 'NOTAS DE DEBITO PROMERICA', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45546, null, 'JES', 45544, null),
      (1, 1020, 'NOTAS DE DEBITO BANRURAL Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45871, null, 'JES', 45544, null),
      (1, 1021, 'NOTAS DE DEBITO BANRURAL $', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45546, null, 'JES', 45544, null),
      (1, 1022, 'NOTAS DE CREDITO BANRURAL $', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45546, null),
      (1, 1023, 'NOTAS DE CREDTIO G&T CONTINENTAL Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45546, null),
      (1, 1024, 'NOTAS DE CREDITO G&T CONTINENTAL $', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45546, null),
      (1, 1025, 'NOTAS DE CREDITO BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45546, null, 'JES', 45546, null),
      (1, 1026, 'NOTAS DE CREDITO BI $', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45546, null),
      (1, 1027, 'NOTAS DE CREDITO PROMERICA', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45546, null),
      (1, 1028, 'VENTAS AL CONTADO', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45560, null),
      (1, 1029, 'NOTAS DE DEBITO  BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45611, null, 'AIA', 45560, null),
      (1, 1030, 'NOTAS DE DEBITO BI $', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'FRA', 45567, null),
      (1, 1031, 'CXP CAJA CHICA', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45569, null),
      (1, 1032, 'CXP DE VIATICOS', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45569, null),
      (1, 1033, 'NOTAS CREDITO TRASLADO DE FONDOS GYT', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'FRA', 45575, null),
      (1, 1034, 'NOTAS DEBITO TRASLADO DE FONDOS GYT Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45866, null, 'FRA', 45575, null),
      (1, 1035, 'NOTAS CREDITO TRASLADO DE FONDOS BANRURAL Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45871, null, 'FRA', 45575, null),
      (1, 1036, 'NOTAS DEBITO TRASLADO DE FONDOS BANRURAL Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45871, null, 'FRA', 45575, null),
      (1, 1037, 'NOTAS DEBITO COMISIONES Y BONIFICACIONES GYT', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45582, null, 'FRA', 45575, null),
      (1, 1038, 'NOTAS DEBITO COMISIONES Y BONIFICACIONES BANRURAL Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45871, null, 'FRA', 45575, null),
      (1, 1039, 'NOTAS DEBITO TRASLADO DE FONDOS G&T $', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45581, null),
      (1, 1040, 'NOTAS CREDITO TRASLADO DE FONDOS G&T $', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45581, null),
      (1, 1041, 'NOTAS CREDITO TRASLADO DE FONDOS BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45583, null),
      (1, 1042, 'NOTAS DE CREDITO ANTICIPO DE BIENES BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45603, null, 'JES', 45603, null),
      (1, 1043, 'NOTAS DE CREDITO ANTICIPO DE BIENES BANRURAL Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45603, null),
      (1, 1044, 'NOTAS DE CREDITO ANTICIPO DE BIENES G Y T  $', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45603, null),
      (1, 1045, 'NOTAS DE CREDITO ANTICIPO DE BIENES BI $', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45603, null),
      (1, 1046, 'NOTAS DE CREDITO ANTICIPO DE BIENES G Y T  Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45603, null),
      (1, 1047, 'PAGO PLANILLA DE SUELDO', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45603, null),
      (1, 1048, 'NOTAS DE CREDITO TRASLADOS DE FONDOS BI $', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45604, null, 'JES', 45604, null),
      (1, 1049, 'NOTAS DE DEBITO TRASLADO DE FONDOS BI $', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45604, null),
      (1, 1050, 'NOTAS DE DEBITO TRASLADO DE FONDOS BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45606, null),
      (1, 1051, 'NOTAS DE DEBITO POR CARGOS BANCARIOS BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45607, null),
      (1, 1052, 'NOTAS DE DEBITO PÓR CARGOS BANCARIOS BI $', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45607, null),
      (1, 1053, 'NOTAS DE DEBITO POR CARGOS BANCARIOS GYT Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45755, null, 'JES', 45607, null),
      (1, 1054, 'NOTAS DE DEBITO POR CARGOS BANCARIOS GYT $', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45755, null, 'JES', 45607, null),
      (1, 1055, 'NOTAS DE CREDITO POR CARGOS BANCARIOS BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45611, null),
      (1, 1056, 'NOTAS DE CREDITO POR CARGOS BANCARIOS GYT Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45611, null),
      (1, 1057, 'NOTAS DE CREDITO POR CARGOS BANCARIOS BI $', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45611, null),
      (1, 1058, 'NOTAS DE CREDITO POR CARGOS BANCARIOS GYT $', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45611, null),
      (1, 1059, 'NOTAS (CREDITO - ABONO) SOBRE VENTAS', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'FRA', 46020, null, 'FRA', 45614, null),
      (1, 1060, 'PLANILLA DE SUELDO', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45637, null),
      (1, 1061, 'NOTAS DE DEBITOS PAGO DE IMPUESTOS G Y T Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45664, null),
      (1, 1062, 'NOTAS DE CREDITO REEMBOLSO DE VIATICOS', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45672, null),
      (1, 1063, 'SALIDAS DE INVENTARIO', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45677, null),
      (1, 1064, 'NOTAS DE DEBITO OBLIGACIONES DE PAGO DE CREDITOS ACH', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45679, null),
      (1, 1065, 'NOTAS DE BITITO OBLIGACIONES DE PAGO DE CREDITOS ACH', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45679, null, 'JES', 45679, null),
      (1, 1066, 'AJUSTES INVENTARIO', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'FRA', 45685, null),
      (1, 1067, 'NOTAS DE DEBITO ANTICIPO DE VIAJES AL EXTERIOR BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45705, null, 'JES', 45705, null),
      (1, 1068, 'NOTAS DE DEBITO ANTICIPO DE VIAJES AL EXTERIOR G Y T   Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45818, null, 'JES', 45705, null),
      (1, 1069, 'PAGO DE IMPUESTOS BANRURAL Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45802, null, 'JES', 45749, null),
      (1, 1070, 'COMPRA DE INVENTARIOS DE IMPORTACIONES', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45749, null),
      (1, 1071, 'PAGO A PROVEEDORES DEL EXTERIOR GYT $', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45802, null, 'JES', 45757, null),
      (1, 1072, 'PAGO A PROVEEDORES DEL EXTERIOR BI $', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45757, null),
      (1, 1073, 'NOTAS DE CREDITO BAC Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45785, null),
      (1, 1074, 'NOTAS DE DEBITO BAC Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45785, null, 'JES', 45785, null),
      (1, 1075, 'NOTAS DE CREDITO TRASLADO DE FONDOS BAC Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45785, null),
      (1, 1076, 'NOTAS DE DEBITO TRASLADO DE FONDOS BAC Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45785, null),
      (1, 1077, 'NOTAS DE CREDITO BI AHORRO Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45785, null),
      (1, 1078, 'NOTAS DE CREDITO TRASLADO DE FONDOS BI AHORRO Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45785, null),
      (1, 1079, 'NOTAS DE DEBITO BI AHORRO Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45785, null),
      (1, 1080, 'NOTAS DE DEBITO TRASLADO DE FONDOS BI AHORRO Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45785, null),
      (1, 1081, 'NOTAS DE CREDITO PRESTAMOS DEL ACCIONISTA  BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45792, null, 'JES', 45791, null),
      (1, 1082, 'NOTAS DE DEBITO PRESTAMOS DEL ACCIONISTA  BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45792, null, 'JES', 45792, null),
      (1, 1083, 'AJUSTE DE INVENTARIOS POR SOBRANTE DE BIENES', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45797, null),
      (1, 1084, 'NOTAS DE DEBITOS POR CARGOS BANCARIOS BAC Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45819, null),
      (1, 1085, 'NOTAS DE DEBITO PAGOS PRESTAMOS BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45820, null),
      (1, 1086, 'PLANILLA DE SUELDOS  (COMPLETA MENSUAL)', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'FRA', 45988, null, 'FRA', 45821, null),
      (1, 1087, 'NOTAS DE DEBITO POR DONACIONES BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45842, null, 'JES', 45838, null),
      (1, 1088, 'NOTAS DE DEBITO POR BONIFICACIONES G Y T $', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45842, null),
      (1, 1089, 'NOTAS DE CREDITO POR CARGOS BANCARIOS BI AHORRO Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45859, null),
      (1, 1090, 'NOTAS DE DEBITO POR CARGOS BANCARIOS BI HORRO Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45859, null),
      (1, 1091, 'NOTAS DE DEBITO PAGO CUOTAS LEASING BI Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45861, null),
      (1, 1092, 'NOTAS DE CREDITO ANTICIPO DE BIENES BAC Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45894, null),
      (1, 1093, 'NOTAS DE CREDITO ANTICIPO DE PROVEEDORES LOCALES BAC Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45894, null),
      (1, 1094, 'NOTAS DE DEBITO ANTICIO DE PROVEEDORES LOCALES BAC Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45894, null, 'JES', 45894, null),
      (1, 1095, 'NOTAS DE DEBITO ANTICIPO DE PROVEEDORES LOCALES BAMRURAL', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45894, null, 'JES', 45894, null),
      (1, 1096, 'NOTAS DE DEBITO ANTICIPO DE PROVEEDORES LOCALES DE G Y T  Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45894, null),
      (1, 1097, 'NOTA DE CREDITO DEVOLUCION DE PAGOS AL EXTERIOR', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45909, null),
      (1, 1098, 'NOTAS DE CREDITO FONDOS  DE CAJA DE ADMINISTRACION', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 45912, null, 'JES', 45912, null),
      (1, 1099, 'NOTAS DE DEBITO FONDOS DE CAJA DE ADMINISTRACION', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45912, null),
      (1, 1100, 'RETORNO INVENTARIO NOTAS DE CREDITO SOBRE VENTAS', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'FRA', 45924, null),
      (1, 1101, 'NOTAS DE CREDITOS POR CARGOS BANCARIOS BAC Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 45936, null),
      (1, 1102, 'NOTAS DE DEBITO ANTICIPOS PROVEEDORES LOCALES BI $', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 46127, null),
      (1, 1104, 'NOTAS DE DEBITO ANTICIPOS PROVEEDORES LOCALES G Y T   $', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 46158, null),
      (1, 1105, 'NOTAS DE DEBITO PAGOS PRESTAMOS G Y T  Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 46186, null, 'JES', 46186, null),
      (1, 1106, 'NOTA DE DEBITO DE CXP DE PROVEEDORES DE BIENES BANRURAL Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', 'JES', 46211, null, 'JES', 46211, null),
      (1, 1107, 'NOTA DE DEBITO DE CXP DE PROVEEDORES DE SERVICIOS BANRURAL  Q', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 46211, null),
      (1, 1108, 'NOTA DE CREDITO BI Q SOCIEDAD ANONIMA', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'JES', 46329, null)
    ) as x (localidad, numero, descripcion, modulo, plantilla, automatica, version_nomenclatura, transaccion_visual, estado,
            modo_generacion, tipo, aplica_poliza, usr_modifica, fecha_modifica, tipo_operacion, usr_ingresa, fecha_ingresa, tipo_operacion_ant)
    order by localidad, numero
  loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.localidad;
    if v_loc is null then
      if position(format('4-%s', lpad(r.localidad::text, 2, '0')) in v_omitidas) = 0 then v_omitidas := v_omitidas || format(' 4-%s', lpad(r.localidad::text, 2, '0')); end if;
      continue;
    end if;
    select id into v_trx from public.transacciones_contables where localidad_id = v_loc and numero = r.numero;
    if v_trx is not null then
      update public.transacciones_contables set
        descripcion = r.descripcion, estado = case when r.estado = 'I' then 'INACTIVO' else 'ACTIVO' end,
        aplica_poliza = coalesce(r.aplica_poliza, 'S') = 'S', tipo_operacion = coalesce(r.tipo_operacion, tipo_operacion),
        modulo = r.modulo, plantilla = r.plantilla, automatica = case r.automatica when 'S' then true when 'N' then false end,
        version_nomenclatura = r.version_nomenclatura, transaccion_visual = r.transaccion_visual, modo_generacion = r.modo_generacion,
        tipo_transaccion = r.tipo, usuario_modifica_anterior = r.usr_modifica,
        fecha_modifica_anterior = case when r.fecha_modifica is not null then date '1899-12-30' + r.fecha_modifica::integer end,
        usuario_ingresa_anterior = r.usr_ingresa, tipo_operacion_anterior = r.tipo_operacion_ant,
        fecha_ingresa_anterior = case when r.fecha_ingresa is not null then date '1899-12-30' + r.fecha_ingresa::integer end
      where id = v_trx;
      v_trx_act := v_trx_act + 1;
    else
      insert into public.transacciones_contables (organizacion_id, localidad_id, numero, descripcion, estado, aplica_poliza, tipo_operacion,
             modulo, plantilla, automatica, version_nomenclatura, transaccion_visual, modo_generacion, tipo_transaccion,
             usuario_modifica_anterior, fecha_modifica_anterior, usuario_ingresa_anterior, fecha_ingresa_anterior, tipo_operacion_anterior)
      values (v_org, v_loc, r.numero, r.descripcion, case when r.estado = 'I' then 'INACTIVO' else 'ACTIVO' end,
              coalesce(r.aplica_poliza, 'S') = 'S', r.tipo_operacion, r.modulo, r.plantilla,
              case r.automatica when 'S' then true when 'N' then false end, r.version_nomenclatura, r.transaccion_visual,
              r.modo_generacion, r.tipo, r.usr_modifica,
              case when r.fecha_modifica is not null then date '1899-12-30' + r.fecha_modifica::integer end, r.usr_ingresa,
              case when r.fecha_ingresa is not null then date '1899-12-30' + r.fecha_ingresa::integer end, r.tipo_operacion_ant);
      v_trx_nuevas := v_trx_nuevas + 1;
    end if;
  end loop;

  -- ---------- Cuentas x transacción ----------
  for r in
    select * from (values
      (1, 1001, 1, '112301', 1, 'D', 1, null::text, 5, null::text, 'I', 'N'::text),
      (1, 1001, 2, '11120101', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1002, 1, '11120101', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1002, 2, '112304', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1003, 1, '1121', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1003, 2, '11120103', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1004, 2, '11120103', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1005, 2, '11120201', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1006, 1, '1151', 1, 'D', 1, null, 3, null, 'I', 'N'),
      (1, 1006, 2, '11301', 1, 'D', 2, null, 1, null, 'I', 'N'),
      (1, 1006, 3, '21110102', 1, 'C', 3, null, 5, null, 'I', 'N'),
      (1, 1007, 1, '112302', 1, 'C', 4, null, 5, null, 'I', 'N'),
      (1, 1007, 2, '11301', 1, 'D', 3, null, 1, null, 'I', 'N'),
      (1, 1007, 3, '112302', 1, 'D', 1, null, 3, null, 'I', 'N'),
      (1, 1007, 4, '6214', 1, 'D', 2, null, 6, null, 'I', 'N'),
      (1, 1007, 5, '6214', 1, 'D', 5, null, 8, null, 'I', 'N'),
      (1, 1008, 1, '1141', 1, 'D', 1, null, 3, null, 'I', 'N'),
      (1, 1008, 2, '11301', 1, 'D', 2, null, 1, null, 'I', 'N'),
      (1, 1008, 3, '21110101', 1, 'C', 3, null, 5, null, 'I', 'N'),
      (1, 1009, 1, '112301', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1009, 2, '11120101', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1010, 1, '1121', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1010, 2, '4111', 1, 'C', 2, null, 3, 'EQUIPOS', 'I', 'N'),
      (1, 1010, 3, '4112', 1, 'C', 3, null, 3, 'REPUESTOS', 'I', 'N'),
      (1, 1010, 4, '4113', 1, 'C', 4, null, 3, 'ACCESORIOS', 'I', 'N'),
      (1, 1010, 5, '4114', 1, 'C', 5, null, 3, 'SERVICIOS', 'I', 'N'),
      (1, 1010, 6, '2111050101', 1, 'C', 6, null, 1, null, 'I', 'N'),
      (1, 1011, 1, '6221', 1, 'D', 1, null, 3, null, 'I', 'N'),
      (1, 1011, 2, '11301', 1, 'D', 2, null, 1, null, 'I', 'N'),
      (1, 1011, 3, '2111050202', 1, 'C', 3, null, 12, null, 'I', 'N'),
      (1, 1011, 4, '21110102', 1, 'C', 4, null, 5, null, 'I', 'N'),
      (1, 1012, 1, '21110101', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1012, 2, '11120101', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1013, 1, '21110102', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1013, 2, '11120101', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1014, 1, '51201', 1, 'D', 1, null, 3, null, 'I', 'N'),
      (1, 1014, 2, '11301', 1, 'D', 2, null, 1, null, 'I', 'N'),
      (1, 1014, 3, '21110101', 1, 'C', 3, null, 5, null, 'I', 'N'),
      (1, 1015, 1, '6127', 1, 'D', 1, null, 3, null, 'I', 'N'),
      (1, 1015, 2, '11301', 1, 'D', 2, null, 1, null, 'I', 'N'),
      (1, 1015, 3, '21110102', 1, 'C', 3, null, 5, null, 'I', 'N'),
      (1, 1016, 1, '21110102', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1016, 2, '11120102', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1017, 4, '11120101', 1, 'C', 6, null, 5, null, 'I', 'N'),
      (1, 1018, 1, '11120101', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1018, 2, '2111080103', 1, 'D', 2, null, 5, null, 'I', 'N'),
      (1, 1018, 3, '2111080102', 1, 'D', 3, null, 5, null, 'I', 'N'),
      (1, 1018, 4, '11120102', 1, 'C', 4, null, 5, null, 'I', 'N'),
      (1, 1019, 1, '11120105', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1020, 1, '11120103', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1021, 1, '11120202', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1022, 1, '11120202', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1023, 1, '11120102', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1024, 1, '11120201', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1025, 1, '11120101', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1026, 1, '11120203', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1027, 1, '11120105', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1028, 1, '1121', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1028, 2, '4111', 1, 'C', 2, null, 3, 'EQUIPOS', 'I', 'N'),
      (1, 1028, 3, '4112', 1, 'C', 3, null, 3, 'REPUESTOS', 'I', 'N'),
      (1, 1028, 4, '4113', 1, 'C', 4, null, 3, 'ACCESORIOS', 'I', 'N'),
      (1, 1028, 5, '4114', 1, 'C', 5, null, 3, 'SERVICIOS', 'I', 'N'),
      (1, 1028, 6, '2111050101', 1, 'C', 6, null, 1, null, 'I', 'N'),
      (1, 1029, 1, '11120101', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1030, 1, '11120203', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1031, 1, '11120101', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1032, 1, '11120101', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1033, 1, '11120102', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1033, 2, '11120104', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1034, 1, '11120102', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1034, 2, '11120104', 1, 'D', 2, null, 5, null, 'I', 'N'),
      (1, 1035, 1, '11120103', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1035, 2, '11120104', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1036, 1, '11120103', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1036, 2, '11120104', 1, 'D', 2, null, 5, null, 'I', 'N'),
      (1, 1037, 1, '11120102', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1038, 1, '11120103', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1039, 1, '11120201', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1039, 2, '11120104', 1, 'D', 2, null, 5, null, 'I', 'N'),
      (1, 1040, 1, '11120201', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1040, 2, '11120104', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1041, 1, '11120101', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1041, 2, '11120104', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1042, 1, '11120101', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1042, 2, '21110201', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1043, 1, '11120103', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1043, 2, '21110201', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1044, 1, '11120201', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1044, 2, '21110201', 1, 'C', 2, null, 10, null, 'I', 'N'),
      (1, 1045, 1, '11120203', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1045, 2, '21110201', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1046, 1, '11120102', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1046, 2, '21110201', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1047, 1, '11120101', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1047, 2, '2111080101', 1, 'D', 2, null, 5, null, 'I', 'N'),
      (1, 1048, 1, '11120203', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1048, 2, '11120104', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1049, 1, '11120203', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1049, 2, '11120104', 1, 'D', 2, null, 5, null, 'I', 'N'),
      (1, 1050, 1, '11120101', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1050, 2, '11120104', 1, 'D', 2, null, 5, null, 'I', 'N'),
      (1, 1051, 1, '11120101', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1052, 1, '11120203', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1053, 1, '11120102', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1054, 1, '11120201', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1055, 1, '11120101', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1056, 1, '11120102', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1057, 1, '11120203', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1058, 1, '11120201', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1059, 1, '1121', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1059, 2, '4111', 1, 'D', 2, null, 3, 'EQUIPOS', 'I', 'N'),
      (1, 1059, 3, '4112', 1, 'D', 3, null, 3, 'REPUESTOS', 'I', 'N'),
      (1, 1059, 4, '4113', 1, 'D', 4, null, 3, 'ACCESORIOS', 'I', 'N'),
      (1, 1059, 5, '4114', 1, 'D', 5, null, 3, 'SERVICIOS', 'I', 'N'),
      (1, 1059, 6, '2111050101', 1, 'D', 6, null, 1, null, 'I', 'N'),
      (1, 1060, 1, '11120101', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1060, 2, '2111080101', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1061, 1, '11120102', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1062, 1, '11120101', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1063, 1, '511', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1063, 2, '1141', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1064, 1, '11120101', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1065, 1, '11120102', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1066, 1, '1141', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1066, 2, '511', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1066, 3, '51201', 1, 'C', 3, null, 5, null, 'I', 'N'),
      (1, 1067, 1, '11120101', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1068, 1, '11120102', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1069, 1, '11120103', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1070, 1, '1141', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1070, 2, '1151', 1, 'C', 2, null, 1, null, 'I', 'N'),
      (1, 1071, 1, '11120201', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1072, 1, '11120203', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1073, 1, '11120106', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1074, 1, '11120106', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1075, 1, '11120106', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1075, 2, '11120104', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1076, 1, '11120106', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1076, 2, '11120104', 1, 'D', 2, null, 5, null, 'I', 'N'),
      (1, 1077, 1, '11120107', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1078, 1, '11120107', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1078, 2, '11120104', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1079, 1, '11120107', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1080, 1, '11120107', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1080, 2, '11120104', 1, 'D', 2, null, 5, null, 'I', 'N'),
      (1, 1081, 1, '11120101', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1082, 1, '11120101', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1082, 2, '2120201', 1, 'D', 2, null, 0, null, 'I', 'N'),
      (1, 1082, 3, '70201', 1, 'D', 3, null, 0, null, 'I', 'N'),
      (1, 1083, 1, '1141', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1083, 2, '70301', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1084, 1, '11120201', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1084, 2, '70203', 1, 'D', 2, null, 5, null, 'I', 'N'),
      (1, 1085, 1, '11120101', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1085, 2, '2120101', 1, 'D', 2, null, 0, null, 'I', 'N'),
      (1, 1085, 3, '70201', 1, 'D', 3, null, 0, null, 'I', 'N'),
      (1, 1086, 1, '6101', 1, 'D', 1, null, 5, 'ORDINARIO', 'I', 'N'),
      (1, 1086, 2, '6102', 1, 'D', 2, null, 5, 'BONIFICACION', 'I', 'N'),
      (1, 1086, 3, '6103', 1, 'D', 3, null, 5, 'BONOS', 'I', 'N'),
      (1, 1086, 4, '6104', 1, 'D', 4, null, 5, 'CUOTAS LABORAL', 'I', 'N'),
      (1, 1086, 5, '6105', 1, 'D', 5, null, 5, 'IRTRA', 'I', 'N'),
      (1, 1086, 6, '6106', 1, 'D', 6, null, 5, 'INTECAP', 'I', 'N'),
      (1, 1086, 7, '6107', 1, 'D', 7, null, 5, 'BONO 14', 'I', 'N'),
      (1, 1086, 8, '6108', 1, 'D', 8, null, 5, 'AGUINALDO', 'I', 'N'),
      (1, 1086, 9, '6109', 1, 'D', 9, null, 5, 'VACACIONES', 'I', 'N'),
      (1, 1086, 10, '6110', 1, 'D', 10, null, 5, 'INDEMNIZACION', 'I', 'N'),
      (1, 1086, 11, '6201', 1, 'D', 11, null, 5, 'ORDINARIO', 'I', 'N'),
      (1, 1086, 12, '6202', 1, 'D', 12, null, 5, 'BONIFICACION', 'I', 'N'),
      (1, 1086, 13, '6203', 1, 'D', 13, null, 5, 'BONOS', 'I', 'N'),
      (1, 1086, 14, '6204', 1, 'D', 14, null, 5, 'CUOTAS LABORAL', 'I', 'N'),
      (1, 1086, 15, '6205', 1, 'D', 15, null, 5, 'IRTRA', 'I', 'N'),
      (1, 1086, 16, '6206', 1, 'D', 16, null, 5, 'INTECAP', 'I', 'N'),
      (1, 1086, 17, '6207', 1, 'D', 17, null, 5, 'BONO 14', 'I', 'N'),
      (1, 1086, 18, '6208', 1, 'D', 18, null, 5, 'AGUINALDO', 'I', 'N'),
      (1, 1086, 19, '6209', 1, 'D', 19, null, 5, 'VACACIONES', 'I', 'N'),
      (1, 1086, 20, '6210', 1, 'D', 20, null, 5, 'INDEMNIZACION', 'I', 'N'),
      (1, 1086, 21, '6301', 1, 'D', 21, null, 5, 'ORDINARIO', 'I', 'N'),
      (1, 1086, 22, '6302', 1, 'D', 22, null, 5, 'BONIFICACION', 'I', 'N'),
      (1, 1086, 23, '6303', 1, 'D', 23, null, 5, 'BONOS', 'I', 'N'),
      (1, 1086, 24, '6304', 1, 'D', 24, null, 5, 'CUOTAS LABORAL', 'I', 'N'),
      (1, 1086, 25, '6305', 1, 'D', 25, null, 5, 'IRTRA', 'I', 'N'),
      (1, 1086, 26, '6306', 1, 'D', 26, null, 5, 'INTECAP', 'I', 'N'),
      (1, 1086, 27, '6307', 1, 'D', 27, null, 5, 'BONO 14', 'I', 'N'),
      (1, 1086, 28, '6308', 1, 'D', 28, null, 5, 'AGUINALDO', 'I', 'N'),
      (1, 1086, 29, '6309', 1, 'D', 29, null, 5, 'VACACIONES', 'I', 'N'),
      (1, 1086, 30, '6310', 1, 'D', 30, null, 5, 'INDEMNIZACION', 'I', 'N'),
      (1, 1086, 31, '2111080101', 1, 'C', 31, null, 5, 'ANTICIPO', 'I', 'N'),
      (1, 1086, 32, '2111080101', 1, 'C', 32, null, 5, 'LIQUIDO A RECIBIR', 'I', 'N'),
      (1, 1086, 33, '21110701', 1, 'C', 33, null, 5, 'CUOTA LABORAL', 'I', 'N'),
      (1, 1086, 34, '21110702', 1, 'C', 34, null, 5, 'CUOTA PATRONAL', 'I', 'N'),
      (1, 1086, 35, '2111050201', 1, 'C', 35, null, 5, 'ISR', 'I', 'N'),
      (1, 1086, 36, '2111080201', 1, 'C', 36, null, 5, 'BONO 14', 'I', 'N'),
      (1, 1086, 37, '2111080202', 1, 'C', 37, null, 5, 'AGUINALDO', 'I', 'N'),
      (1, 1086, 38, '2111080203', 1, 'C', 38, null, 5, 'VACACIONES', 'I', 'N'),
      (1, 1086, 39, '2111080204', 1, 'C', 39, null, 5, 'INDEMNIZACION', 'I', 'N'),
      (1, 1087, 1, '11120101', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1088, 1, '11120201', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1088, 2, '6203', 1, 'D', 2, null, 5, null, 'I', 'N'),
      (1, 1089, 1, '11120107', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1090, 1, '11120107', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1091, 1, '11120101', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1091, 2, '2120102', 1, 'D', 2, null, 5, null, 'I', 'N'),
      (1, 1092, 1, '11120106', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1093, 1, '11120106', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1094, 1, '11120106', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1095, 1, '11120103', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1096, 1, '11120102', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1097, 1, '11120201', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1098, 1, '11120101', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1099, 1, '11120101', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1100, 1, '511', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1100, 2, '1141', 1, 'D', 2, null, 5, null, 'I', 'N'),
      (1, 1101, 1, '11120106', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1101, 2, '70102', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1102, 1, '11120203', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1102, 2, '112301', 1, 'D', 2, null, 5, null, 'I', 'N'),
      (1, 1104, 1, '11120201', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1105, 1, '11120102', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1105, 2, '21202202', 1, 'D', 2, null, 0, null, 'I', 'N'),
      (1, 1106, 1, '21110101', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1106, 2, '11120103', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1107, 1, '21110102', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1107, 2, '11120103', 1, 'C', 2, null, 5, null, 'I', 'N'),
      (1, 1108, 1, '11120108', 1, 'D', 1, null, 5, null, 'I', 'N')
    ) as x (localidad, numero, linea, cuenta, version, tipo_movimiento, orden, centro_costo, operacion, columna, tipo_int_centro, gastos)
    order by localidad, numero, linea
  loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.localidad;
    if v_loc is null then continue; end if;
    select id into v_trx from public.transacciones_contables where localidad_id = v_loc and numero = r.numero;
    if v_trx is null then continue; end if;
    select c.id into v_cuenta from public.cuentas c join public.catalogos_cuentas k on k.id = c.catalogo_id
    where k.localidad_id = v_loc and k.version = r.version and c.codigo = r.cuenta;
    if v_cuenta is null then v_sin_cuenta := v_sin_cuenta + 1; end if;
    v_centro := null;
    if r.centro_costo is not null then
      select c.id into v_centro from public.centros_costo c join public.catalogos_centros k on k.id = c.catalogo_id
      where k.localidad_id = v_loc and c.codigo = r.centro_costo limit 1;
    end if;
    if exists (select 1 from public.transaccion_cuentas where transaccion_id = v_trx and linea = r.linea) then
      update public.transaccion_cuentas set
        cuenta_id = v_cuenta, cuenta_codigo = r.cuenta, naturaleza = case when r.tipo_movimiento = 'C' then 'H' else 'D' end,
        orden = r.orden,
        operacion = case r.operacion when 5 then 'TOTAL' when 3 then 'SUBTOTAL' when 1 then 'IMPUESTO' when 6 then 'IMPUESTO'
                                     when 2 then 'RETENCIÓN' when 4 then 'RETENCIÓN' when 12 then 'RETENCIÓN' else 'OTRO' end,
        columna_nomina = r.columna, version = r.version, operacion_anterior = r.operacion, tipo_int_centro = r.tipo_int_centro,
        centro_costo_anterior = r.centro_costo, centro_id = coalesce(v_centro, centro_id), gastos = case r.gastos when 'S' then true when 'N' then false end
      where transaccion_id = v_trx and linea = r.linea;
      v_lin_act := v_lin_act + 1;
    else
      insert into public.transaccion_cuentas (transaccion_id, linea, cuenta_id, cuenta_codigo, naturaleza, orden, operacion, columna_nomina,
             version, operacion_anterior, tipo_int_centro, centro_costo_anterior, centro_id, gastos)
      values (v_trx, r.linea, v_cuenta, r.cuenta, case when r.tipo_movimiento = 'C' then 'H' else 'D' end, r.orden,
              case r.operacion when 5 then 'TOTAL' when 3 then 'SUBTOTAL' when 1 then 'IMPUESTO' when 6 then 'IMPUESTO'
                               when 2 then 'RETENCIÓN' when 4 then 'RETENCIÓN' when 12 then 'RETENCIÓN' else 'OTRO' end,
              r.columna, r.version, r.operacion, r.tipo_int_centro, r.centro_costo, v_centro, case r.gastos when 'S' then true when 'N' then false end);
      v_lin_nuevas := v_lin_nuevas + 1;
    end if;
  end loop;

  raise notice '%', format('Transacciones de la organización 4: %s nuevas, %s actualizadas; líneas: %s nuevas, %s actualizadas%s.%s',
    v_trx_nuevas, v_trx_act, v_lin_nuevas, v_lin_act,
    case when v_sin_cuenta > 0 then format(' (%s con una cuenta que aún no existe: quedan con su código)', v_sin_cuenta) else '' end,
    case when v_omitidas <> '' then ' Localidades que no existen (omitidas):' || v_omitidas else '' end);
end;
$migra$;


-- ======================================================================================
-- 4. Transacciones x objeto
-- ======================================================================================
do $migra$
declare
  v_org bigint;
  v_loc bigint;
  v_obj bigint;
  v_trx bigint;
  v_banco text;
  r record;
  v_nuevas integer := 0;
  v_act integer := 0;
  v_faltan text := '';
  v_omitidas text := '';
begin
  select id into v_org from public.organizaciones where codigo = 4;
  if v_org is null then raise exception 'No existe la organización 4.'; end if;

  for r in
    select * from (values
      (1, 6, 1006, null::text),
      (1, 6, 1008, null),
      (1, 6, 1011, null),
      (1, 6, 1014, null),
      (1, 6, 1070, null),
      (1, 8, 1010, null),
      (1, 8, 1028, null),
      (1, 9, 1003, '3733005325'),
      (1, 10, 1007, null),
      (1, 11, 1001, null),
      (1, 12, 1002, '0060197571'),
      (1, 13, 1004, '3733005325'),
      (1, 13, 1022, '6733000448'),
      (1, 13, 1023, '39-7608-3'),
      (1, 13, 1024, '39-5805579-4'),
      (1, 13, 1025, '0060197571'),
      (1, 13, 1026, '0480124890'),
      (1, 13, 1027, '12335070010653'),
      (1, 13, 1033, '39-7608-3'),
      (1, 13, 1035, '3733005325'),
      (1, 13, 1040, '39-5805579-4'),
      (1, 13, 1041, '0060197571'),
      (1, 13, 1042, '0060197571'),
      (1, 13, 1043, '3733005325'),
      (1, 13, 1044, '39-5805579-4'),
      (1, 13, 1045, '0480124890'),
      (1, 13, 1046, '39-7608-3'),
      (1, 13, 1048, '0480124890'),
      (1, 13, 1055, '0060197571'),
      (1, 13, 1056, '39-7608-3'),
      (1, 13, 1057, '0480124890'),
      (1, 13, 1058, '39-5805579-4'),
      (1, 13, 1060, '0060197571'),
      (1, 13, 1062, '0060197571'),
      (1, 13, 1073, '905593083'),
      (1, 13, 1075, '905593083'),
      (1, 13, 1077, '508-12-82473'),
      (1, 13, 1078, '508-12-82473'),
      (1, 13, 1081, '0060197571'),
      (1, 13, 1089, '508-12-82473'),
      (1, 13, 1092, '905593083'),
      (1, 13, 1093, '905593083'),
      (1, 13, 1097, '39-5805579-4'),
      (1, 13, 1098, '0060197571'),
      (1, 13, 1101, '905593083'),
      (1, 15, 1083, null),
      (1, 17, 1063, null),
      (1, 18, 1066, null),
      (1, 20, 1005, '39-5805579-4'),
      (1, 20, 1009, '0060197571'),
      (1, 20, 1012, '0060197571'),
      (1, 20, 1013, '0060197571'),
      (1, 20, 1015, '0060197571'),
      (1, 20, 1016, '39-7608-3'),
      (1, 20, 1017, '0060197571'),
      (1, 20, 1018, '0060197571'),
      (1, 20, 1019, '12335070010653'),
      (1, 20, 1020, '3733005325'),
      (1, 20, 1021, '6733000448'),
      (1, 20, 1029, '0060197571'),
      (1, 20, 1030, '0480124890'),
      (1, 20, 1031, '0060197571'),
      (1, 20, 1032, '0060197571'),
      (1, 20, 1034, '39-7608-3'),
      (1, 20, 1036, '3733005325'),
      (1, 20, 1037, '39-7608-3'),
      (1, 20, 1038, '3733005325'),
      (1, 20, 1039, '39-5805579-4'),
      (1, 20, 1047, '0060197571'),
      (1, 20, 1049, '0480124890'),
      (1, 20, 1050, '0060197571'),
      (1, 20, 1051, '0060197571'),
      (1, 20, 1052, '0480124890'),
      (1, 20, 1053, '39-7608-3'),
      (1, 20, 1054, '39-5805579-4'),
      (1, 20, 1061, '39-7608-3'),
      (1, 20, 1064, '0060197571'),
      (1, 20, 1065, '39-7608-3'),
      (1, 20, 1067, '0060197571'),
      (1, 20, 1068, '39-7608-3'),
      (1, 20, 1069, '3733005325'),
      (1, 20, 1071, '39-5805579-4'),
      (1, 20, 1072, '0480124890'),
      (1, 20, 1074, '905593083'),
      (1, 20, 1076, '905593083'),
      (1, 20, 1079, '508-12-82473'),
      (1, 20, 1080, '508-12-82473'),
      (1, 20, 1082, '0060197571'),
      (1, 20, 1084, '905593083'),
      (1, 20, 1085, '0060197571'),
      (1, 20, 1087, '0060197571'),
      (1, 20, 1088, '39-5805579-4'),
      (1, 20, 1090, '508-12-82473'),
      (1, 20, 1091, '0060197571'),
      (1, 20, 1094, '905593083'),
      (1, 20, 1095, '3733005325'),
      (1, 20, 1096, '39-7608-3'),
      (1, 20, 1099, '0060197571'),
      (1, 20, 1102, '0480124890'),
      (1, 20, 1104, '39-5805579-4'),
      (1, 20, 1105, '39-7608-3'),
      (1, 20, 1106, '3733005325'),
      (1, 20, 1107, '3733005325'),
      (1, 27, 1059, null),
      (1, 34, 1086, null),
      (1, 39, 1100, null)
    ) as x (localidad, objeto, transaccion, cuenta_bancaria)
    order by localidad, objeto, transaccion
  loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.localidad;
    if v_loc is null then
      if position(format('4-%s', lpad(r.localidad::text, 2, '0')) in v_omitidas) = 0 then v_omitidas := v_omitidas || format(' 4-%s', lpad(r.localidad::text, 2, '0')); end if;
      continue;
    end if;
    select id into v_obj from public.objetos_contables where localidad_id = v_loc and numero = r.objeto;
    select id into v_trx from public.transacciones_contables where localidad_id = v_loc and numero = r.transaccion;
    if v_obj is null or v_trx is null then
      v_faltan := v_faltan || format(' 4-%s objeto %s / transacción %s;', lpad(r.localidad::text, 2, '0'), r.objeto, r.transaccion);
      continue;
    end if;
    v_banco := nullif(regexp_replace(trim(r.cuenta_bancaria), '\.+$', ''), '');
    if exists (select 1 from public.objeto_transacciones where objeto_id = v_obj and transaccion_id = v_trx) then
      update public.objeto_transacciones set cuenta_bancaria = v_banco where objeto_id = v_obj and transaccion_id = v_trx;
      v_act := v_act + 1;
    else
      insert into public.objeto_transacciones (objeto_id, transaccion_id, cuenta_bancaria) values (v_obj, v_trx, v_banco);
      v_nuevas := v_nuevas + 1;
    end if;
  end loop;

  raise notice '%', format('Transacciones x objeto de la organización 4: %s nuevas, %s actualizadas.%s%s',
    v_nuevas, v_act,
    case when v_faltan <> '' then ' Omitidas (no existe el objeto o la transacción):' || v_faltan else '' end,
    case when v_omitidas <> '' then ' Localidades que no existen (omitidas):' || v_omitidas else '' end);
end;
$migra$;

notify pgrst, 'reload schema';

-- 222 · Catálogo contable de la organización 7 (ASOCIACIÓN AMIGOS PRO OBRAS SOCIALES), localidad 7-01, de los archivos de «Tecnoalsa - AAPOS»:
--   1. «3.1 CON_CUENTAS_VERSION.xlsx»: 135 cuentas (versión 1).
--   2. «5. CON_OBJETOS_CONTA.xlsx»: 34 objetos contables.
--   3. «5.2 CON_TIPOS_TRANSACCIONES.xlsx» y «5.3 CON_CUENTAS_TRANSACCIONES.xlsx»: 118 transacciones y 29 líneas.
--   4. «5.1 CON_TRANSACCIONES_OBJETOS.xlsx»: 118 transacciones x objeto.
-- Misma lógica de los scripts 77 a 80 (organización 3) y 177 (organización 2): lo que existe se actualiza y lo que falta se crea.
-- Columnas con información que no existían (se crean antes de migrar):
--   cuentas.aplica_centro_costo (APLICA_CENTRO S/N);
--   transacciones_contables.usuario_ingresa_anterior, fecha_ingresa_anterior y tipo_operacion_anterior (USR_INGRESA,
--     FECHA_INGRESA y TIPO_OPERACION del sistema anterior);
--   transaccion_cuentas.centro_costo_anterior (CENTRO_COSTO; si el centro existe en la localidad la línea se liga a él) y
--     gastos (GASTOS S/N).
-- Se ejecuta después del script 221. Puede ejecutarse de nuevo: la segunda vez solo actualiza.

-- ======================================================================================
-- 1. Cuentas contables
-- ======================================================================================
alter table public.cuentas add column if not exists mascara text;
alter table public.cuentas add column if not exists mostrar boolean not null default true;
alter table public.cuentas add column if not exists aplica_centro_costo boolean not null default false;

do $migra$
declare
  v_org bigint;
  v_loc bigint;
  v_cat bigint;
  v_tipo bigint;
  v_mayor bigint;
  v_id bigint;
  r record;
  v_nuevas integer := 0;
  v_actualizadas integer := 0;
  v_versiones integer := 0;
  v_otra_mayor integer := 0;
  v_omitidas text := '';
begin
  select id into v_org from public.organizaciones where codigo = 7;
  if v_org is null then raise exception 'No existe la organización 7.'; end if;

  drop table if exists m_cuentas;
  create temp table m_cuentas (localidad integer, codigo text, version integer, nombre text, tipo integer, integracion text,
                               cuenta_mayor text, cuenta_anterior text, mascara text, vigente text, mostrar text, aplica_centro text) on commit drop;
  insert into m_cuentas values
      (1, '1', 1, 'ACTIVO', 1, 'S', null, null, null, 'S', 'S', 'N'),
      (1, '11', 1, 'CIRCULANTE', 1, 'S', '1', null, null, 'S', 'S', 'N'),
      (1, '111', 1, 'CAJA Y BANCOS', 1, 'S', '11', null, null, 'S', 'S', 'N'),
      (1, '11101', 1, 'CAJA', 1, 'S', '111', null, null, 'S', 'S', 'N'),
      (1, '11101001', 1, 'Caja Chica', 1, 'N', '11101', null, null, 'S', 'S', 'N'),
      (1, '11101002', 1, 'Caja General', 1, 'N', '11101', null, null, 'S', 'S', 'N'),
      (1, '11102', 1, 'BANCOS', 1, 'S', '111', null, null, 'S', 'S', 'N'),
      (1, '11102001', 1, 'Cuentas Nacionales Bancarias en Quetzales', 1, 'N', '11102', null, null, 'S', 'S', 'N'),
      (1, '11102002', 1, 'Cuentas Nacionales Bancarias en Dólares', 1, 'N', '11102', null, null, 'S', 'S', 'N'),
      (1, '11102003', 1, 'Cuentas Extranjeras Bancarias en Dólares', 1, 'N', '11102', null, null, 'S', 'S', 'N'),
      (1, '112', 1, 'CUENTAS POR COBRAR', 1, 'S', '11', null, null, 'S', 'S', 'N'),
      (1, '11201', 1, 'CLIENTES', 1, 'S', '112', null, null, 'S', 'S', 'N'),
      (1, '1120101', 1, 'Clientes Locales', 1, 'N', '11201', null, null, 'S', 'S', 'N'),
      (1, '1120102', 1, 'Deudores Varios', 1, 'N', '11201', null, null, 'S', 'S', 'N'),
      (1, '1120103', 1, 'PRESTAMOS A EMPLEADOS', 1, 'N', '11201', null, null, 'S', 'S', 'N'),
      (1, '1120104', 1, 'PRESTAMOS X COBRAR', 1, 'N', '11201', null, null, 'S', 'S', 'N'),
      (1, '1120105', 1, 'Cuentas X liquidar', 1, 'N', '11201', null, null, 'S', 'S', 'N'),
      (1, '1120106', 1, 'Impuestos por Cobrar', 1, 'N', '11201', null, null, 'S', 'S', 'N'),
      (1, '1120107', 1, 'Otras CXC', 1, 'N', '11201', null, null, 'S', 'S', 'N'),
      (1, '1120108', 1, 'Anticipo quincenal', 1, 'N', '11201', null, null, 'S', 'S', 'N'),
      (1, '1120109', 1, 'Provisión para Cuentas Incobrables', 1, 'N', '11201', null, null, 'S', 'S', 'N'),
      (1, '1120110', 1, 'DONACIONES AL CREDITO', 1, 'N', '1120104', null, null, 'S', 'S', 'N'),
      (1, '1120111', 1, 'PATROCINIOS POR COBRAR', 1, 'N', '112', null, null, 'S', 'S', 'N'),
      (1, '113', 1, 'INVENTARIOS', 1, 'S', '11', null, null, 'S', 'S', 'N'),
      (1, '11301', 1, 'Inventarios Generales', 1, 'N', '113', null, null, 'S', 'S', 'N'),
      (1, '12', 1, 'FIJO', 1, 'S', '1', null, null, 'S', 'S', 'N'),
      (1, '121', 1, 'MOBILIARIO Y EQUIPO', 1, 'S', '12', null, null, 'S', 'S', 'N'),
      (1, '12101', 1, 'Mobiliario y Equipo', 1, 'N', '121', null, null, 'S', 'S', 'N'),
      (1, '12102', 1, 'Depreciacion Acumulada (Mobiliario y Equipo)', 1, 'N', '121', null, null, 'S', 'S', 'N'),
      (1, '12103', 1, 'Equipo de Computacion', 1, 'N', '121', null, null, 'S', 'S', 'N'),
      (1, '12104', 1, 'Depreciacion Acumulada (Equipo de computacion)', 1, 'N', '121', null, null, 'S', 'S', 'N'),
      (1, '12105', 1, 'Maquinaria', 1, 'N', '121', null, null, 'S', 'S', 'N'),
      (1, '12106', 1, 'Depreciacion Acumulada (Maquinaria)', 1, 'N', '121', null, null, 'S', 'S', 'N'),
      (1, '122', 1, 'HERRAMIENTAS', 1, 'S', '12', null, null, 'S', 'S', 'N'),
      (1, '12201', 1, 'Herramientas', 1, 'N', '122', null, null, 'S', 'S', 'N'),
      (1, '12202', 1, 'Depreciacion Acumulada (Herramientas)', 1, 'N', '122', null, null, 'S', 'S', 'N'),
      (1, '123', 1, 'VEHICULOS', 1, 'S', '12', null, null, 'S', 'S', 'N'),
      (1, '12301', 1, 'Vehiculos', 1, 'N', '123', null, null, 'S', 'S', 'N'),
      (1, '12302', 1, 'Depreciacion Acumulada (Vehiculos)', 1, 'N', '123', null, null, 'S', 'S', 'N'),
      (1, '124', 1, 'EDIFICIOS', 1, 'S', '12', null, null, 'S', 'S', 'N'),
      (1, '12401', 1, 'Edificios', 1, 'N', '124', null, null, 'S', 'S', 'N'),
      (1, '12402', 1, 'Depreciacion Acumulada (Edificios)', 1, 'N', '124', null, null, 'S', 'S', 'N'),
      (1, '125', 1, 'OTROS ACTIVOS DEPRECIABLES', 1, 'S', '12', null, null, 'S', 'S', 'N'),
      (1, '12501', 1, 'Otros activos depreciables', 1, 'N', '125', null, null, 'S', 'S', 'N'),
      (1, '12502', 1, 'Depreciacion Acumulada (Otros activos depreciables)', 1, 'N', '125', null, null, 'S', 'S', 'N'),
      (1, '126', 1, 'BIENES INMUEBLES', 1, 'S', '12', null, null, 'S', 'S', 'N'),
      (1, '12601', 1, 'Bienes Inmuebles', 1, 'N', '126', null, null, 'S', 'S', 'N'),
      (1, '127', 1, 'BIENES INMUEBLES EN GARANTIA', 1, 'S', '12', null, null, 'S', 'S', 'N'),
      (1, '12701', 1, 'Bienes Inmuebles en garantia', 1, 'N', '127', null, null, 'S', 'S', 'N'),
      (1, '13', 1, 'DIFERIDO', 1, 'S', '1', null, null, 'S', 'S', 'N'),
      (1, '131', 1, 'Gastos de Organización', 1, 'N', '13', null, null, 'S', 'S', 'N'),
      (1, '13101', 1, 'Amortizacion Gastos de Organización', 1, 'N', '131', null, null, 'S', 'S', 'N'),
      (1, '132', 1, 'Otros gastos amortizables', 1, 'N', '13', null, null, 'S', 'S', 'N'),
      (1, '13201', 1, 'Amortizacion otros gastos amortizables', 1, 'N', '132', null, null, 'S', 'S', 'N'),
      (1, '133', 1, 'Inversiones', 1, 'N', '13', null, null, 'S', 'S', 'N'),
      (1, '134', 1, 'Gastos pagados anticipadamente', 1, 'N', '13', null, null, 'S', 'S', 'N'),
      (1, '2', 1, 'PASIVO', 2, 'S', null, null, null, 'S', 'S', 'N'),
      (1, '21', 1, 'CIRCULANTE', 2, 'S', '2', null, null, 'S', 'S', 'N'),
      (1, '211', 1, 'CUENTAS POR PAGAR', 2, 'S', '21', null, null, 'S', 'S', 'N'),
      (1, '21101', 1, 'PROVEEDORES', 2, 'S', '211', null, null, 'S', 'S', 'N'),
      (1, '2110101', 1, 'Proveedores Locales', 2, 'N', '21101', null, null, 'S', 'S', 'N'),
      (1, '2110102', 1, 'Proveedores del Extranjero', 2, 'N', '21101', null, null, 'S', 'S', 'N'),
      (1, '2110103', 1, 'Acreedores', 2, 'N', '21101', null, null, 'S', 'S', 'N'),
      (1, '2110104', 1, 'Prestamos Bancarios', 2, 'N', '21101', null, null, 'S', 'S', 'N'),
      (1, '2110105', 1, 'Impuestos por pagar', 2, 'N', '21101', null, null, 'S', 'S', 'N'),
      (1, '2110106', 1, 'Prestamos', 2, 'N', '21101', null, null, 'S', 'S', 'N'),
      (1, '2110107', 1, 'Pagares', 2, 'N', '21101', null, null, 'S', 'S', 'N'),
      (1, '2110108', 1, 'Cuentas para futuras capitalizaciones', 2, 'N', '21101', null, null, 'S', 'S', 'N'),
      (1, '2110109', 1, 'Otras CXP', 2, 'N', '21101', null, null, 'S', 'S', 'N'),
      (1, '2110110', 1, 'Garantías X pagar', 2, 'N', '21101', null, null, 'S', 'S', 'N'),
      (1, '2110111', 1, 'Cuenta puente X pagar', 2, 'N', '21101', null, null, 'S', 'S', 'N'),
      (1, '2110112', 1, 'DONACIONES POR PAGAR', 2, 'N', '21', null, null, 'S', 'S', 'N'),
      (1, '2110113', 1, 'CUENTAS POR PAGAR (REAL)', 2, 'N', '21101', null, null, 'S', 'S', 'N'),
      (1, '2110114', 1, 'CUENTA POR PAGAR TARJETA DE CREDITO', 2, 'N', '21101', null, null, 'S', 'S', 'N'),
      (1, '21103', 1, 'PRESTACIONES LABORALES POR PAGAR', 2, 'S', '211', null, null, 'S', 'S', 'N'),
      (1, '2110301', 1, 'Indemnizacion', 2, 'N', '21103', null, null, 'S', 'S', 'N'),
      (1, '2110302', 1, 'Bono 14', 2, 'N', '21103', null, null, 'S', 'S', 'N'),
      (1, '2110303', 1, 'Aguinaldo', 2, 'N', '21103', null, null, 'S', 'S', 'N'),
      (1, '2110304', 1, 'Vacaciones', 2, 'N', '21103', null, null, 'S', 'S', 'N'),
      (1, '2110305', 1, 'Prestaciones Laborales IGSS', 2, 'N', '21103', null, null, 'S', 'S', 'N'),
      (1, '2110306', 1, 'Prestaciones Patronales', 2, 'N', '21103', null, null, 'S', 'S', 'N'),
      (1, '2110307', 1, 'Otras Provisiones', 2, 'N', '21103', null, null, 'S', 'S', 'N'),
      (1, '2110308', 1, 'Descuentos Judiciales', 2, 'N', '21103', null, null, 'S', 'S', 'N'),
      (1, '2110309', 1, 'Descuentos', 2, 'N', '21103', null, null, 'S', 'S', 'N'),
      (1, '2110310', 1, 'Sueldos X Pagar', 2, 'N', '21103', null, null, 'S', 'S', 'N'),
      (1, '21104', 1, 'DIVIDENDOS POR PAGAR', 2, 'S', '211', null, null, 'S', 'S', 'N'),
      (1, '2110401', 1, 'Dividendos por pagar', 2, 'N', '21104', null, null, 'S', 'S', 'N'),
      (1, '21105', 1, 'INGRESOS ANTICIPADOS', 2, 'S', '211', null, null, 'S', 'S', 'N'),
      (1, '2110501', 1, 'Ingresos Anticipados', 2, 'N', '21105', null, null, 'S', 'S', 'N'),
      (1, '3', 1, 'CAPITAL, RESERVAS Y UTILIDADES', 3, 'S', null, null, null, 'S', 'S', 'N'),
      (1, '31', 1, 'CAPITAL, AUTORIZADO Y PAGADO', 3, 'S', '3', null, null, 'S', 'S', 'N'),
      (1, '3101', 1, 'Capital Autorizado', 3, 'N', '31', null, null, 'S', 'S', 'N'),
      (1, '3102', 1, 'Capital Suscrito', 3, 'N', '31', null, null, 'S', 'S', 'N'),
      (1, '3103', 1, 'Capital Pagado', 3, 'N', '31', null, null, 'S', 'S', 'N'),
      (1, '32', 1, 'RESERVAS', 3, 'S', '3', null, null, 'S', 'S', 'N'),
      (1, '3201', 1, 'Reserva Legal', 3, 'N', '32', null, null, 'S', 'S', 'N'),
      (1, '33', 1, 'UTILIDADES', 3, 'S', '3', null, null, 'S', 'S', 'N'),
      (1, '3301', 1, 'Utilidades Acumuladas', 3, 'N', '33', null, null, 'S', 'S', 'N'),
      (1, '3302', 1, 'Utilidades del ejercicio', 3, 'N', '33', null, null, 'S', 'S', 'N'),
      (1, '34', 1, 'PERDIDAS', 3, 'S', '3', null, null, 'S', 'S', 'N'),
      (1, '3401', 1, 'Perdidas Acumuladas', 3, 'N', '34', null, null, 'S', 'S', 'N'),
      (1, '3402', 1, 'Perdida del Ejercicio', 3, 'N', '34', null, null, 'S', 'S', 'N'),
      (1, '4', 1, 'INGRESOS', 4, 'S', null, null, null, 'S', 'S', 'N'),
      (1, '41', 1, 'INGRESOS', 4, 'S', '4', null, null, 'S', 'S', 'N'),
      (1, '411', 1, 'VENTAS', 4, 'S', '41', null, null, 'S', 'S', 'N'),
      (1, '41101', 1, 'Venta de bienes', 4, 'N', '411', null, null, 'S', 'S', 'N'),
      (1, '41102', 1, 'Ventas generales', 4, 'N', '411', null, null, 'S', 'S', 'N'),
      (1, '41103', 1, 'Otras ventas', 4, 'N', '411', null, null, 'S', 'S', 'N'),
      (1, '41104', 1, 'Donaciones', 4, 'N', '411', null, null, 'S', 'S', 'N'),
      (1, '412', 1, 'SERVICIOS PRESTADOS', 4, 'S', '41', null, null, 'S', 'S', 'N'),
      (1, '41201', 1, 'Servicios Prestados', 4, 'N', '412', null, null, 'S', 'S', 'N'),
      (1, '413', 1, 'OTROS INGRESOS', 4, 'S', '4', null, null, 'S', 'S', 'N'),
      (1, '41301', 1, 'Intereses Bancarios', 4, 'N', '413', null, null, 'S', 'S', 'N'),
      (1, '41302', 1, 'Diferencia Cambiario', 4, 'N', '413', null, null, 'S', 'S', 'N'),
      (1, '41303', 1, 'Descuentos sobre Compras', 4, 'N', '413', null, null, 'S', 'S', 'N'),
      (1, '5', 1, 'EGRESOS', 5, 'S', null, null, null, 'S', 'S', 'N'),
      (1, '51', 1, 'COSTOS', 5, 'S', '5', null, null, 'S', 'S', 'N'),
      (1, '5101', 1, 'COSTOS DE VENTA', 5, 'S', '51', null, null, 'S', 'S', 'N'),
      (1, '510101', 1, 'Costos de ventas', 5, 'N', '5101', null, null, 'S', 'S', 'N'),
      (1, '51010101', 1, 'Costos de ventas generales', 5, 'N', '510101', null, null, 'S', 'S', 'N'),
      (1, '52', 1, 'GASTOS', 5, 'S', '5', null, null, 'S', 'S', 'N'),
      (1, '5201', 1, 'GASTOS GENERALES', 5, 'N', '52', null, null, 'S', 'S', 'N'),
      (1, '53', 1, 'GASTOS FINACIEROS', 5, 'S', '5', null, null, 'S', 'S', 'N'),
      (1, '5301', 1, 'GASTOS FINANCIEROS', 5, 'S', '53', null, null, 'S', 'S', 'N'),
      (1, '530101', 1, 'GASTOS FINANCIEROS', 5, 'N', '5301', null, null, 'S', 'S', 'N'),
      (1, '530102', 1, 'OTROS GASTOS FINANCIEROS', 5, 'N', '5301', null, null, 'S', 'S', 'N'),
      (1, '530103', 1, 'GASTOS FINANCIEROS', 5, 'N', '5301', null, null, 'S', 'S', 'N'),
      (1, '530104', 1, 'DIFERENCIAL CAMBIARIO', 5, 'N', '5301', null, null, 'S', 'S', 'N'),
      (1, '530105', 1, 'PERDIDA EN VENTA DE ACTIVOS', 5, 'N', '5301', null, null, 'S', 'S', 'N'),
      (1, '54', 1, 'INGRESOS FINANCIEROS', 5, 'S', '5', null, null, 'S', 'S', 'N'),
      (1, '5401', 1, 'OTROS INGRESOS Y PRODUCTOS FINANCIEROS', 5, 'S', '54', null, null, 'S', 'S', 'N'),
      (1, '540101', 1, 'INTERESES CUENTAS BANCARIAS Y FINANCIERAS', 5, 'N', '5401', null, null, 'S', 'S', 'N'),
      (1, '540102', 1, 'DIFERENCIAL CAMBIARIO', 5, 'N', '5401', null, null, 'S', 'S', 'N'),
      (1, '540103', 1, 'GANANCIA EN VENTA DE ACTIVO', 5, 'N', '5401', null, null, 'S', 'S', 'N'),
      (1, '540104', 1, 'OTROS PRODUCTOS', 5, 'N', '5401', null, null, 'S', 'S', 'N');

  -- De la cuenta de nivel 1 hacia las subcuentas, para que cada cuenta mayor exista antes.
  for r in select * from m_cuentas order by localidad, version, length(codigo), codigo loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.localidad;
    if v_loc is null then
      if position(format('7-%s', lpad(r.localidad::text, 2, '0')) in v_omitidas) = 0 then v_omitidas := v_omitidas || format(' 7-%s', lpad(r.localidad::text, 2, '0')); end if;
      continue;
    end if;
    select id into v_cat from public.catalogos_cuentas where localidad_id = v_loc and version = r.version;
    if v_cat is null then
      insert into public.catalogos_cuentas (organizacion_id, localidad_id, version, fecha_del, activo)
      values (v_org, v_loc, r.version, current_date, true) returning id into v_cat;
      v_versiones := v_versiones + 1;
    end if;
    select id into v_tipo from public.tipos_cuenta where localidad_id = v_loc and codigo = r.tipo;
    select c.id into v_mayor from public.cuentas c
    where c.catalogo_id = v_cat and length(c.codigo) < length(r.codigo) and left(r.codigo, length(c.codigo)) = c.codigo
    order by length(c.codigo) desc limit 1;
    select id into v_id from public.cuentas where catalogo_id = v_cat and codigo = r.codigo;
    if v_id is not null then
      update public.cuentas set
        nombre = upper(trim(r.nombre)),
        integra = r.integracion = 'S',
        vigente = coalesce(r.vigente, 'N') = 'S',
        mostrar = coalesce(r.mostrar, 'N') = 'S',
        aplica_centro_costo = coalesce(r.aplica_centro, 'N') = 'S',
        mascara = coalesce(r.mascara, mascara),
        cuenta_anterior = coalesce(r.cuenta_anterior, cuenta_anterior),
        tipo_cuenta_id = case when cuenta_mayor_id is null and v_tipo is not null then v_tipo else tipo_cuenta_id end
      where id = v_id;
      if (select cuenta_mayor_id from public.cuentas where id = v_id) is distinct from v_mayor then v_otra_mayor := v_otra_mayor + 1; end if;
      v_actualizadas := v_actualizadas + 1;
    else
      if v_mayor is null and v_tipo is null then
        raise exception 'La localidad 7-% no tiene el tipo de cuenta % (cuenta %): ejecuta antes el script 221.', lpad(r.localidad::text, 2, '0'), r.tipo, r.codigo;
      end if;
      insert into public.cuentas (catalogo_id, codigo, nombre, cuenta_mayor_id, tipo_cuenta_id, integra, cuenta_anterior, vigente, mascara, mostrar, aplica_centro_costo)
      values (v_cat, r.codigo, upper(trim(r.nombre)), v_mayor, v_tipo, r.integracion = 'S', r.cuenta_anterior,
              coalesce(r.vigente, 'N') = 'S', r.mascara, coalesce(r.mostrar, 'N') = 'S', coalesce(r.aplica_centro, 'N') = 'S');
      v_nuevas := v_nuevas + 1;
    end if;
  end loop;
  raise notice '%', format('Cuentas de la organización 7: %s nuevas, %s actualizadas, %s versiones de catálogo creadas.%s%s', v_nuevas, v_actualizadas, v_versiones,
    case when v_otra_mayor > 0 then format(' %s cuentas existentes tienen otra cuenta mayor (no se cambia).', v_otra_mayor) else '' end,
    case when v_omitidas <> '' then ' Localidades que no existen (omitidas):' || v_omitidas else '' end);
end;
$migra$;


-- ======================================================================================
-- 2. Objetos contables
-- ======================================================================================
alter table public.objetos_contables add column if not exists version_nomenclatura integer;
alter table public.objetos_contables add column if not exists no_cuentas_anterior integer;

create or replace function public.numerar_objeto_contable() returns trigger
language plpgsql security definer set search_path = '' as $fn$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4805, new.localidad_id::integer);
    if tg_table_name = 'objetos_contables' then
      -- Migración: se conserva el número del sistema anterior.
      if not (current_setting('fin.migracion', true) = 'si' and new.numero is not null) then
        new.numero := coalesce((select max(numero) from public.objetos_contables where localidad_id = new.localidad_id), 0) + 1;
      end if;
    elsif new.numero is null then
      new.numero := coalesce((select max(numero) from public.transacciones_contables where localidad_id = new.localidad_id), 1000) + 1;
    end if;
  else
    new.organizacion_id := old.organizacion_id;
    new.localidad_id := old.localidad_id;
    if tg_table_name = 'objetos_contables' or new.numero is null then
      new.numero := old.numero;
    end if;
  end if;
  if tg_table_name = 'transacciones_contables' and exists (
       select 1 from public.transacciones_contables t
       where t.localidad_id = new.localidad_id and t.numero = new.numero and t.id is distinct from new.id) then
    raise exception 'Ya existe la transacción % en esta localidad: usa otro código.', new.numero;
  end if;
  new.descripcion := upper(trim(new.descripcion));
  return new;
end;
$fn$;

do $migra$
declare
  v_org bigint;
  v_loc bigint;
  r record;
  v_nuevos integer := 0;
  v_actualizados integer := 0;
  v_omitidas text := '';
begin
  select id into v_org from public.organizaciones where codigo = 7;
  if v_org is null then raise exception 'No existe la organización 7.'; end if;
  perform set_config('fin.migracion', 'si', true);
  for r in
    select * from (values
      (1, 1, 'PROVEEDORES', 1, 5),
      (1, 2, 'CREDITOS', 1, 7),
      (1, 3, 'COSTEO PROYECTOS', 1, 2),
      (1, 4, 'PLANES', 1, 7),
      (1, 5, 'TIPOS DE CONTRATOS', 1, 1),
      (1, 6, 'COMPRAS', 1, 5),
      (1, 7, 'TRANSFERENCIAS - AUTORIZACIONES', 1, 2),
      (1, 8, 'FACTURAS', 1, 7),
      (1, 9, 'CHEQUES', 1, 2),
      (1, 10, 'CAJAS/LIQUIDACIONES', 1, 1),
      (1, 11, 'POLIZAS', 1, 10),
      (1, 12, 'DEPOSITOS BANCARIOS', 1, 2),
      (1, 13, 'NOTAS DE CREDITO BANCOS', 1, 2),
      (1, 14, 'RECIBOS', 1, 2),
      (1, 15, 'ENTRADAS A BODEGA', 1, 2),
      (1, 16, 'TRASLADOS ENTRE BODEGAS', 1, 2),
      (1, 17, 'SALIDAS DE BODEGA', 1, 2),
      (1, 18, 'AJUSTES DE INVENTARIO', 1, 2),
      (1, 19, 'BODEGAS', 1, 1),
      (1, 20, 'NOTAS DE DEBITO BANCOS', 1, 2),
      (1, 21, 'REVERSIÓN ENTRADAS A BODEGA', 1, 2),
      (1, 22, 'REVERSIÓN TRASLADOS ENTRE BODEGAS', 1, 2),
      (1, 23, 'REVERSIÓN SALIDAS DE BODEGA', 1, 2),
      (1, 24, 'REVERSIÓN AJUSTES DE INVENTARIO', 1, 2),
      (1, 25, 'CHEQUES ANULADOS', 1, 2),
      (1, 26, 'DEPRECIACIONES', 1, 2),
      (1, 27, 'NOTAS  SOBRE VENTAS', 1, 7),
      (1, 28, 'RETENCIONES IVA', 1, 2),
      (1, 29, 'EXENCIONES DE IVA', 1, 2),
      (1, 30, 'ALTAS ACTIVOS FIJOS', 1, 2),
      (1, 31, 'TRANSFERENCIAS - COMISIONES', 1, 9),
      (1, 32, 'DEVOLUCIONES', 1, 2),
      (1, 33, 'NOTAS CREDITO SOBRE COMPRAS', 1, 2),
      (1, 34, 'NOMINAS', 1, 2)
    ) as x (localidad, objeto, descripcion, version_nomenclatura, no_cuentas)
    order by localidad, objeto
  loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.localidad;
    if v_loc is null then
      if position(format('7-%s', lpad(r.localidad::text, 2, '0')) in v_omitidas) = 0 then v_omitidas := v_omitidas || format(' 7-%s', lpad(r.localidad::text, 2, '0')); end if;
      continue;
    end if;
    if exists (select 1 from public.objetos_contables where localidad_id = v_loc and numero = r.objeto) then
      update public.objetos_contables set descripcion = r.descripcion, version_nomenclatura = r.version_nomenclatura, no_cuentas_anterior = r.no_cuentas
      where localidad_id = v_loc and numero = r.objeto;
      v_actualizados := v_actualizados + 1;
    else
      insert into public.objetos_contables (organizacion_id, localidad_id, numero, descripcion, activo, version_nomenclatura, no_cuentas_anterior)
      values (v_org, v_loc, r.objeto, r.descripcion, true, r.version_nomenclatura, r.no_cuentas);
      v_nuevos := v_nuevos + 1;
    end if;
  end loop;
  perform set_config('fin.migracion', '', true);
  raise notice '%', format('Objetos contables de la organización 7: %s nuevos, %s actualizados.%s', v_nuevos, v_actualizados,
    case when v_omitidas <> '' then ' Localidades que no existen (omitidas):' || v_omitidas else '' end);
end;
$migra$;


-- ======================================================================================
-- 3. Transacciones contables y sus cuentas
-- ======================================================================================
alter table public.transacciones_contables add column if not exists modulo text;
alter table public.transacciones_contables add column if not exists plantilla text;
alter table public.transacciones_contables add column if not exists automatica boolean;
alter table public.transacciones_contables add column if not exists version_nomenclatura integer;
alter table public.transacciones_contables add column if not exists transaccion_visual integer;
alter table public.transacciones_contables add column if not exists modo_generacion text;
alter table public.transacciones_contables add column if not exists tipo_transaccion text;
alter table public.transacciones_contables add column if not exists usuario_modifica_anterior text;
alter table public.transacciones_contables add column if not exists fecha_modifica_anterior date;
alter table public.transaccion_cuentas add column if not exists version integer;
alter table public.transaccion_cuentas add column if not exists operacion_anterior integer;
alter table public.transaccion_cuentas add column if not exists tipo_int_centro text;
alter table public.transaccion_cuentas add column if not exists centro_costo_anterior text;
alter table public.transaccion_cuentas add column if not exists gastos boolean;
alter table public.transacciones_contables add column if not exists usuario_ingresa_anterior text;
alter table public.transacciones_contables add column if not exists fecha_ingresa_anterior date;
alter table public.transacciones_contables add column if not exists tipo_operacion_anterior text;

do $migra$
declare
  v_org bigint;
  v_loc bigint;
  v_trx bigint;
  v_cuenta bigint;
  v_centro bigint;
  r record;
  v_trx_nuevas integer := 0;
  v_trx_act integer := 0;
  v_lin_nuevas integer := 0;
  v_lin_act integer := 0;
  v_sin_cuenta integer := 0;
  v_omitidas text := '';
begin
  select id into v_org from public.organizaciones where codigo = 7;
  if v_org is null then raise exception 'No existe la organización 7.'; end if;

  -- ---------- Encabezados ----------
  for r in
    select * from (values
      (1, 1001, 'PARTIDAS DIARIAS', null::text, null::text, 'N'::text, 1, 1001, 'A', 'C', 'N', 'S', null, null, null::text, 'SYS'::text, 45574::integer, null::text),
      (1, 1002, 'CHEQUES RIFA CTA 3445872209', null, null, 'N', 1, 1002, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45575, null),
      (1, 1003, 'CHEQUES RIFA CTA 3445923680', null, null, 'N', 1, 1003, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45576, null),
      (1, 1004, 'CHEQUES RIFA CTA 027-006935-4', null, null, 'N', 1, 1004, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45577, null),
      (1, 1005, 'CHEQUES RIFA CTA 0270070311', null, null, 'N', 1, 1005, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45578, null),
      (1, 1006, 'CHEQUES RIFA CTA 092-005488-9', null, null, 'N', 1, 1006, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45579, null),
      (1, 1007, 'CHEQUES RIFA CTA 34-27743', null, null, 'N', 1, 1007, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45580, null),
      (1, 1008, 'CHEQUES RIFA CTA 385-06-80919', null, null, 'N', 1, 1008, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45581, null),
      (1, 1009, 'CHEQUES RIFA CTA 066-0030635-4', null, null, 'N', 1, 1009, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45582, null),
      (1, 1010, 'CHEQUES RIFA CTA 90-142044-8', null, null, 'N', 1, 1010, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45583, null),
      (1, 1011, 'CHEQUES RIFA CTA 3579-0112616782', null, null, 'N', 1, 1011, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45584, null),
      (1, 1012, 'CHEQUES ALBERGUE CTA 49-0009122-0', null, null, 'N', 1, 1012, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45585, null),
      (1, 1013, 'CHEQUES MUNAG CTA 027-007030-3', null, null, 'N', 1, 1013, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45586, null),
      (1, 1014, 'CHEQUES MUNAG CTA 159-34-00207', null, null, 'N', 1, 1014, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45587, null),
      (1, 1015, 'CHEQUES MCDVP CTA 027-007418-0', null, null, 'N', 1, 1015, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45588, null),
      (1, 1016, 'CHEQUES DIG OSSHP CTA 34-27743', null, null, 'N', 1, 1016, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45589, null),
      (1, 1017, 'CHEQUES DIG OSSHP CTA  90-143399-5', null, null, 'N', 1, 1017, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45590, null),
      (1, 1018, 'CHEQUES CUB PLAZA VDS CTA 027-007418-0', null, null, 'N', 1, 1018, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45591, null),
      (1, 1019, 'CHEQUES CUB PLAZA VDS CTA 90-143399-5', null, null, 'N', 1, 1019, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45592, null),
      (1, 1020, 'CHEQUES MANT DE INFRAES CTA 027-007418-0', null, null, 'N', 1, 1020, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45593, null),
      (1, 1021, 'CHEQUES PISCINA VDS CTA 027-007418-0', null, null, 'N', 1, 1021, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45594, null),
      (1, 1022, 'CHEQUES CLINICA ODONTO CTA 027-007418-0', null, null, 'N', 1, 1022, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45595, null),
      (1, 1023, 'CHEQUES RECAUDACION CTA 027-007418-0', null, null, 'N', 1, 1023, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45596, null),
      (1, 1024, 'CHEQUES QUIRIGUA CTA 027-007418-0', null, null, 'N', 1, 1024, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45597, null),
      (1, 1025, 'CHEQUES CLINICA OFTAL CTA 027-007418-0', null, null, 'N', 1, 1025, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45598, null),
      (1, 1026, 'CHEQUES ENTIDAD', null, null, 'N', 1, 1026, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45599, null),
      (1, 1027, 'DEPOSITOS  RIFA CTA 3445872209', null, null, 'N', 1, 1027, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45650, null),
      (1, 1028, 'DEPOSITOS  RIFA CTA 3445923680', null, null, 'N', 1, 1028, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45651, null),
      (1, 1029, 'DEPOSITOS  RIFA CTA 027-006935-4', null, null, 'N', 1, 1029, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45652, null),
      (1, 1030, 'DEPOSITOS  RIFA CTA 0270070311', null, null, 'N', 1, 1030, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45653, null),
      (1, 1031, 'DEPOSITOS  RIFA CTA 092-005488-9', null, null, 'N', 1, 1031, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45654, null),
      (1, 1032, 'DEPOSITOS  RIFA CTA 34-27743', null, null, 'N', 1, 1032, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45655, null),
      (1, 1033, 'DEPOSITOS  RIFA CTA 385-06-80919', null, null, 'N', 1, 1033, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45656, null),
      (1, 1034, 'DEPOSITOS  RIFA CTA 066-0030635-4', null, null, 'N', 1, 1034, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45657, null),
      (1, 1035, 'DEPOSITOS  RIFA CTA 90-142044-8', null, null, 'N', 1, 1035, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45658, null),
      (1, 1036, 'DEPOSITOS  RIFA CTA 3579-0112616782', null, null, 'N', 1, 1036, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45659, null),
      (1, 1037, 'DEPOSITOS  ALBERGUE CTA 49-0009122-0', null, null, 'N', 1, 1037, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45660, null),
      (1, 1038, 'DEPOSITOS  MUNAG CTA 027-007030-3', null, null, 'N', 1, 1038, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45661, null),
      (1, 1039, 'DEPOSITOS  MUNAG CTA 159-34-00207', null, null, 'N', 1, 1039, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45662, null),
      (1, 1040, 'DEPOSITOS  MCDVP CTA 027-007418-0', null, null, 'N', 1, 1040, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45663, null),
      (1, 1041, 'DEPOSITOS  DIG OSSHP CTA 34-27743', null, null, 'N', 1, 1041, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45664, null),
      (1, 1042, 'DEPOSITOS  DIG OSSHP CTA  90-143399-5', null, null, 'N', 1, 1042, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45665, null),
      (1, 1043, 'DEPOSITOS  CUB PLAZA VDS CTA 027-007418-0', null, null, 'N', 1, 1043, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45666, null),
      (1, 1044, 'DEPOSITOS  CUB PLAZA VDS CTA 90-143399-5', null, null, 'N', 1, 1044, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45667, null),
      (1, 1045, 'DEPOSITOS  MANT DE INFRAES CTA 027-007418-0', null, null, 'N', 1, 1045, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45668, null),
      (1, 1046, 'DEPOSITOS  PISCINA VDS CTA 027-007418-0', null, null, 'N', 1, 1046, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45669, null),
      (1, 1047, 'DEPOSITOS  CLINICA ODONTO CTA 027-007418-0', null, null, 'N', 1, 1047, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45670, null),
      (1, 1048, 'DEPOSITOS  RECAUDACION CTA 027-007418-0', null, null, 'N', 1, 1048, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45671, null),
      (1, 1049, 'DEPOSITOS  QUIRIGUA CTA 027-007418-0', null, null, 'N', 1, 1049, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45672, null),
      (1, 1050, 'DEPOSITOS  CLINICA OFTAL CTA 027-007418-0', null, null, 'N', 1, 1050, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45673, null),
      (1, 1051, 'DEPOSITOS  ENTIDAD', null, null, 'N', 1, 1051, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45674, null),
      (1, 1052, 'NOTAS CREDITO RIFA CTA 3445872209', null, null, 'N', 1, 1052, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45600, null),
      (1, 1053, 'NOTAS CREDITO RIFA CTA 3445923680', null, null, 'N', 1, 1053, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45601, null),
      (1, 1054, 'NOTAS CREDITO RIFA CTA 027-006935-4', null, null, 'N', 1, 1054, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45602, null),
      (1, 1055, 'NOTAS CREDITO RIFA CTA 0270070311', null, null, 'N', 1, 1055, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45603, null),
      (1, 1056, 'NOTAS CREDITO RIFA CTA 092-005488-9', null, null, 'N', 1, 1056, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45604, null),
      (1, 1057, 'NOTAS CREDITO RIFA CTA 34-27743', null, null, 'N', 1, 1057, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45605, null),
      (1, 1058, 'NOTAS CREDITO RIFA CTA 385-06-80919', null, null, 'N', 1, 1058, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45606, null),
      (1, 1059, 'NOTAS CREDITO RIFA CTA 066-0030635-4', null, null, 'N', 1, 1059, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45607, null),
      (1, 1060, 'NOTAS CREDITO RIFA CTA 90-142044-8', null, null, 'N', 1, 1060, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45608, null),
      (1, 1061, 'NOTAS CREDITO RIFA CTA 3579-0112616782', null, null, 'N', 1, 1061, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45609, null),
      (1, 1062, 'NOTAS CREDITO ALBERGUE CTA 49-0009122-0', null, null, 'N', 1, 1062, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45610, null),
      (1, 1063, 'NOTAS CREDITO MUNAG CTA 027-007030-3', null, null, 'N', 1, 1063, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45611, null),
      (1, 1064, 'NOTAS CREDITO MUNAG CTA 159-34-00207', null, null, 'N', 1, 1064, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45612, null),
      (1, 1065, 'NOTAS CREDITO MCDVP CTA 027-007418-0', null, null, 'N', 1, 1065, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45613, null),
      (1, 1066, 'NOTAS CREDITO DIG OSSHP CTA 34-27743', null, null, 'N', 1, 1066, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45614, null),
      (1, 1067, 'NOTAS CREDITO DIG OSSHP CTA  90-143399-5', null, null, 'N', 1, 1067, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45615, null),
      (1, 1068, 'NOTAS CREDITO CUB PLAZA VDS CTA 027-007418-0', null, null, 'N', 1, 1068, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45616, null),
      (1, 1069, 'NOTAS CREDITO CUB PLAZA VDS CTA 90-143399-5', null, null, 'N', 1, 1069, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45617, null),
      (1, 1070, 'NOTAS CREDITO MANT DE INFRAES CTA 027-007418-0', null, null, 'N', 1, 1070, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45618, null),
      (1, 1071, 'NOTAS CREDITO PISCINA VDS CTA 027-007418-0', null, null, 'N', 1, 1071, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45619, null),
      (1, 1072, 'NOTAS CREDITO CLINICA ODONTO CTA 027-007418-0', null, null, 'N', 1, 1072, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45620, null),
      (1, 1073, 'NOTAS CREDITO RECAUDACION CTA 027-007418-0', null, null, 'N', 1, 1073, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45621, null),
      (1, 1074, 'NOTAS CREDITO QUIRIGUA CTA 027-007418-0', null, null, 'N', 1, 1074, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45622, null),
      (1, 1075, 'NOTAS CREDITO CLINICA OFTAL CTA 027-007418-0', null, null, 'N', 1, 1075, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45623, null),
      (1, 1076, 'NOTAS CREDITO ENTIDAD', null, null, 'N', 1, 1076, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45624, null),
      (1, 1077, 'NOTAS DEBITO  RIFA CTA 3445872209', null, null, 'N', 1, 1077, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45625, null),
      (1, 1078, 'NOTAS DEBITO  RIFA CTA 3445923680', null, null, 'N', 1, 1078, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45626, null),
      (1, 1079, 'NOTAS DEBITO  RIFA CTA 027-006935-4', null, null, 'N', 1, 1079, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45627, null),
      (1, 1080, 'NOTAS DEBITO  RIFA CTA 0270070311', null, null, 'N', 1, 1080, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45628, null),
      (1, 1081, 'NOTAS DEBITO  RIFA CTA 092-005488-9', null, null, 'N', 1, 1081, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45629, null),
      (1, 1082, 'NOTAS DEBITO  RIFA CTA 34-27743', null, null, 'N', 1, 1082, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45630, null),
      (1, 1083, 'NOTAS DEBITO  RIFA CTA 385-06-80919', null, null, 'N', 1, 1083, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45631, null),
      (1, 1084, 'NOTAS DEBITO  RIFA CTA 066-0030635-4', null, null, 'N', 1, 1084, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45632, null),
      (1, 1085, 'NOTAS DEBITO  RIFA CTA 90-142044-8', null, null, 'N', 1, 1085, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45633, null),
      (1, 1086, 'NOTAS DEBITO  RIFA CTA 3579-0112616782', null, null, 'N', 1, 1086, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45634, null),
      (1, 1087, 'NOTAS DEBITO  ALBERGUE CTA 49-0009122-0', null, null, 'N', 1, 1087, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45635, null),
      (1, 1088, 'NOTAS DEBITO  MUNAG CTA 027-007030-3', null, null, 'N', 1, 1088, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45636, null),
      (1, 1089, 'NOTAS DEBITO  MUNAG CTA 159-34-00207', null, null, 'N', 1, 1089, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45637, null),
      (1, 1090, 'NOTAS DEBITO  MCDVP CTA 027-007418-0', null, null, 'N', 1, 1090, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45638, null),
      (1, 1091, 'NOTAS DEBITO  DIG OSSHP CTA 34-27743', null, null, 'N', 1, 1091, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45639, null),
      (1, 1092, 'NOTAS DEBITO  DIG OSSHP CTA  90-143399-5', null, null, 'N', 1, 1092, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45640, null),
      (1, 1093, 'NOTAS DEBITO  CUB PLAZA VDS CTA 027-007418-0', null, null, 'N', 1, 1093, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45641, null),
      (1, 1094, 'NOTAS DEBITO  CUB PLAZA VDS CTA 90-143399-5', null, null, 'N', 1, 1094, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45642, null),
      (1, 1095, 'NOTAS DEBITO  MANT DE INFRAES CTA 027-007418-0', null, null, 'N', 1, 1095, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45643, null),
      (1, 1096, 'NOTAS DEBITO  PISCINA VDS CTA 027-007418-0', null, null, 'N', 1, 1096, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45644, null),
      (1, 1097, 'NOTAS DEBITO  CLINICA ODONTO CTA 027-007418-0', null, null, 'N', 1, 1097, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45645, null),
      (1, 1098, 'NOTAS DEBITO  RECAUDACION CTA 027-007418-0', null, null, 'N', 1, 1098, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45646, null),
      (1, 1099, 'NOTAS DEBITO  QUIRIGUA CTA 027-007418-0', null, null, 'N', 1, 1099, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45647, null),
      (1, 1100, 'NOTAS DEBITO  CLINICA OFTAL CTA 027-007418-0', null, null, 'N', 1, 1100, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45648, null),
      (1, 1101, 'NOTAS DEBITO  ENTIDAD', null, null, 'N', 1, 1101, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45649, null),
      (1, 1102, 'GASTOS CAJA CHICA (COMPRAS)', null, null, 'N', 1, 1102, 'A', 'C', 'N', 'S', 'STE', 45943, null, 'SYS', 45675, null),
      (1, 1103, 'GASTOS COMPRAS', null, null, 'N', 1, 1103, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45676, null),
      (1, 1104, 'INGRESOS VENTAS (MIGRACION)', null, null, 'N', 1, 1104, 'A', 'C', 'N', 'S', null, null, null, 'SYS', 45677, null),
      (1, 1105, 'TRASLADO ENTRE CUENTAS CTA 34-27740', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'FRA', 45841, null),
      (1, 1106, 'CHEQUES ENTIDAD (EVELYN)', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'STE', 45943, null),
      (1, 1107, 'MIGRACION DE COMPRAS', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'STE', 45943, 'MIGRACION COM'),
      (1, 1108, 'NOTAS DEBITO PISCINA II  027-008450-2', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'HEM', 46099, null),
      (1, 1109, 'NOTAS CREDITO PISCINA II  027-008450-2', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'HEM', 46099, null),
      (1, 1110, 'CHEQUES PISCINA II  027-008450-2', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'HEM', 46099, null),
      (1, 1111, 'DEPOSITOS  PISCINA II  027-008450-2', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'HEM', 46099, null),
      (1, 1112, 'NOTAS DEBITO DIGITALIZACION III 027-008447-8', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'HEM', 46099, null),
      (1, 1113, 'NOTAS CREDITO DIGITALIZACION III 027-008447-8', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'HEM', 46099, null),
      (1, 1114, 'CHEQUES DIGITALIZACION III 027-008447-8', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'HEM', 46099, null),
      (1, 1115, 'DEPOSITOS DIGITALIZACION III 027-008447-8', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'HEM', 46099, null),
      (1, 1116, 'TRASLADO ENTRE CUENTAS CTA 027-008447-8', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'HEM', 46099, null),
      (1, 1117, 'TRASLADO ENTRE CUENTAS CTA 027-008450-2', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'HEM', 46099, null),
      (1, 1118, 'NOTAS DEBITO OFTALMOLOGIA 027-008447-8', null, null, null, 1, null, 'A', 'C', 'N', 'S', null, null, null, 'HEM', 46129, null)
    ) as x (localidad, numero, descripcion, modulo, plantilla, automatica, version_nomenclatura, transaccion_visual, estado,
            modo_generacion, tipo, aplica_poliza, usr_modifica, fecha_modifica, tipo_operacion, usr_ingresa, fecha_ingresa, tipo_operacion_ant)
    order by localidad, numero
  loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.localidad;
    if v_loc is null then
      if position(format('7-%s', lpad(r.localidad::text, 2, '0')) in v_omitidas) = 0 then v_omitidas := v_omitidas || format(' 7-%s', lpad(r.localidad::text, 2, '0')); end if;
      continue;
    end if;
    select id into v_trx from public.transacciones_contables where localidad_id = v_loc and numero = r.numero;
    if v_trx is not null then
      update public.transacciones_contables set
        descripcion = r.descripcion, estado = case when r.estado = 'I' then 'INACTIVO' else 'ACTIVO' end,
        aplica_poliza = coalesce(r.aplica_poliza, 'S') = 'S', tipo_operacion = coalesce(r.tipo_operacion, tipo_operacion),
        modulo = r.modulo, plantilla = r.plantilla, automatica = case r.automatica when 'S' then true when 'N' then false end,
        version_nomenclatura = r.version_nomenclatura, transaccion_visual = r.transaccion_visual, modo_generacion = r.modo_generacion,
        tipo_transaccion = r.tipo, usuario_modifica_anterior = r.usr_modifica,
        fecha_modifica_anterior = case when r.fecha_modifica is not null then date '1899-12-30' + r.fecha_modifica::integer end,
        usuario_ingresa_anterior = r.usr_ingresa, tipo_operacion_anterior = r.tipo_operacion_ant,
        fecha_ingresa_anterior = case when r.fecha_ingresa is not null then date '1899-12-30' + r.fecha_ingresa::integer end
      where id = v_trx;
      v_trx_act := v_trx_act + 1;
    else
      insert into public.transacciones_contables (organizacion_id, localidad_id, numero, descripcion, estado, aplica_poliza, tipo_operacion,
             modulo, plantilla, automatica, version_nomenclatura, transaccion_visual, modo_generacion, tipo_transaccion,
             usuario_modifica_anterior, fecha_modifica_anterior, usuario_ingresa_anterior, fecha_ingresa_anterior, tipo_operacion_anterior)
      values (v_org, v_loc, r.numero, r.descripcion, case when r.estado = 'I' then 'INACTIVO' else 'ACTIVO' end,
              coalesce(r.aplica_poliza, 'S') = 'S', r.tipo_operacion, r.modulo, r.plantilla,
              case r.automatica when 'S' then true when 'N' then false end, r.version_nomenclatura, r.transaccion_visual,
              r.modo_generacion, r.tipo, r.usr_modifica,
              case when r.fecha_modifica is not null then date '1899-12-30' + r.fecha_modifica::integer end, r.usr_ingresa,
              case when r.fecha_ingresa is not null then date '1899-12-30' + r.fecha_ingresa::integer end, r.tipo_operacion_ant);
      v_trx_nuevas := v_trx_nuevas + 1;
    end if;
  end loop;

  -- ---------- Cuentas x transacción ----------
  for r in
    select * from (values
      (1, 1002, 1, '11102001', 1, 'C', 1, '1110200114'::text, 5, null::text, 'I', 'N'::text),
      (1, 1003, 1, '11102001', 1, 'C', 1, '1110200115', 5, null, 'I', 'N'),
      (1, 1004, 1, '11102001', 1, 'C', 1, '1110200120', 5, null, 'I', 'N'),
      (1, 1005, 1, '11102001', 1, 'C', 1, '1110200121', 5, null, 'I', 'N'),
      (1, 1006, 1, '11102001', 1, 'C', 1, '1110200113', 5, null, 'I', 'N'),
      (1, 1007, 1, '11102001', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1008, 1, '11102001', 1, 'C', 1, '1110200119', 5, null, 'I', 'N'),
      (1, 1009, 1, '11102001', 1, 'C', 1, '1110200118', 5, null, 'I', 'N'),
      (1, 1010, 1, '11102001', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1029, 1, '11102001', 1, 'D', 1, '1110200120', 5, null, 'I', 'N'),
      (1, 1029, 2, '2110111', 1, 'C', 2, '211011101', 5, null, 'I', 'N'),
      (1, 1038, 1, '11102001', 1, 'D', 1, '1110200123', 5, null, 'I', 'N'),
      (1, 1038, 2, '2110111', 1, 'C', 2, '211011102', 5, null, 'I', 'N'),
      (1, 1039, 1, '11102002', 1, 'D', 1, '1110200202', 5, null, 'I', 'N'),
      (1, 1039, 2, '2110111', 1, 'C', 2, '211011102', 5, null, 'I', 'N'),
      (1, 1102, 1, '11101001', 1, 'C', 1, '1110100101', 5, null, 'I', 'N'),
      (1, 1102, 2, '1120106', 1, 'D', 2, null, 1, null, 'I', 'N'),
      (1, 1102, 3, '5201', 1, 'D', 3, '52010119', 3, null, 'I', 'N'),
      (1, 1103, 1, '2110111', 1, 'C', 1, null, 5, null, 'I', 'N'),
      (1, 1103, 2, '2110105', 1, 'C', 2, '211010501', 2, null, 'I', 'N'),
      (1, 1103, 3, '5201', 1, 'D', 3, '52010140', 5, null, 'I', 'N'),
      (1, 1104, 1, '11101002', 1, 'D', 1, null, 5, null, 'I', 'N'),
      (1, 1104, 2, '2110105', 1, 'C', 2, null, 1, null, 'I', 'N'),
      (1, 1104, 3, '41101', 1, 'C', 3, null, 3, null, 'I', 'N'),
      (1, 1106, 1, '11102001', 1, 'C', 1, '1110200101', 5, null, 'I', 'N'),
      (1, 1106, 2, '2110111', 1, 'D', 2, '211011103', 5, null, 'I', 'N'),
      (1, 1107, 1, '2110111', 1, 'C', 1, '211011101', 5, null, 'I', 'N'),
      (1, 1107, 2, '1120106', 1, 'D', 2, null, 1, null, 'I', 'N'),
      (1, 1107, 3, '5201', 1, 'D', 3, '52010101', 3, null, 'I', 'N')
    ) as x (localidad, numero, linea, cuenta, version, tipo_movimiento, orden, centro_costo, operacion, columna, tipo_int_centro, gastos)
    order by localidad, numero, linea
  loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.localidad;
    if v_loc is null then continue; end if;
    select id into v_trx from public.transacciones_contables where localidad_id = v_loc and numero = r.numero;
    if v_trx is null then continue; end if;
    select c.id into v_cuenta from public.cuentas c join public.catalogos_cuentas k on k.id = c.catalogo_id
    where k.localidad_id = v_loc and k.version = r.version and c.codigo = r.cuenta;
    if v_cuenta is null then v_sin_cuenta := v_sin_cuenta + 1; end if;
    v_centro := null;
    if r.centro_costo is not null then
      select c.id into v_centro from public.centros_costo c join public.catalogos_centros k on k.id = c.catalogo_id
      where k.localidad_id = v_loc and c.codigo = r.centro_costo limit 1;
    end if;
    if exists (select 1 from public.transaccion_cuentas where transaccion_id = v_trx and linea = r.linea) then
      update public.transaccion_cuentas set
        cuenta_id = v_cuenta, cuenta_codigo = r.cuenta, naturaleza = case when r.tipo_movimiento = 'C' then 'H' else 'D' end,
        orden = r.orden,
        operacion = case r.operacion when 5 then 'TOTAL' when 3 then 'SUBTOTAL' when 1 then 'IMPUESTO' when 6 then 'IMPUESTO'
                                     when 2 then 'RETENCIÓN' when 4 then 'RETENCIÓN' when 12 then 'RETENCIÓN' else 'OTRO' end,
        columna_nomina = r.columna, version = r.version, operacion_anterior = r.operacion, tipo_int_centro = r.tipo_int_centro,
        centro_costo_anterior = r.centro_costo, centro_id = coalesce(v_centro, centro_id), gastos = case r.gastos when 'S' then true when 'N' then false end
      where transaccion_id = v_trx and linea = r.linea;
      v_lin_act := v_lin_act + 1;
    else
      insert into public.transaccion_cuentas (transaccion_id, linea, cuenta_id, cuenta_codigo, naturaleza, orden, operacion, columna_nomina,
             version, operacion_anterior, tipo_int_centro, centro_costo_anterior, centro_id, gastos)
      values (v_trx, r.linea, v_cuenta, r.cuenta, case when r.tipo_movimiento = 'C' then 'H' else 'D' end, r.orden,
              case r.operacion when 5 then 'TOTAL' when 3 then 'SUBTOTAL' when 1 then 'IMPUESTO' when 6 then 'IMPUESTO'
                               when 2 then 'RETENCIÓN' when 4 then 'RETENCIÓN' when 12 then 'RETENCIÓN' else 'OTRO' end,
              r.columna, r.version, r.operacion, r.tipo_int_centro, r.centro_costo, v_centro, case r.gastos when 'S' then true when 'N' then false end);
      v_lin_nuevas := v_lin_nuevas + 1;
    end if;
  end loop;

  raise notice '%', format('Transacciones de la organización 7: %s nuevas, %s actualizadas; líneas: %s nuevas, %s actualizadas%s.%s',
    v_trx_nuevas, v_trx_act, v_lin_nuevas, v_lin_act,
    case when v_sin_cuenta > 0 then format(' (%s con una cuenta que aún no existe: quedan con su código)', v_sin_cuenta) else '' end,
    case when v_omitidas <> '' then ' Localidades que no existen (omitidas):' || v_omitidas else '' end);
end;
$migra$;


-- ======================================================================================
-- 4. Transacciones x objeto
-- ======================================================================================
do $migra$
declare
  v_org bigint;
  v_loc bigint;
  v_obj bigint;
  v_trx bigint;
  v_banco text;
  r record;
  v_nuevas integer := 0;
  v_act integer := 0;
  v_faltan text := '';
  v_omitidas text := '';
begin
  select id into v_org from public.organizaciones where codigo = 7;
  if v_org is null then raise exception 'No existe la organización 7.'; end if;

  for r in
    select * from (values
      (1, 1, 1017, '90-143399-5'::text),
      (1, 6, 1103, null),
      (1, 8, 1104, null),
      (1, 9, 1002, '3445872209'),
      (1, 9, 1003, '3445923680'),
      (1, 9, 1004, '027-006935-4'),
      (1, 9, 1005, '0270070311'),
      (1, 9, 1006, '092-005488-9'),
      (1, 9, 1007, '34-27743'),
      (1, 9, 1008, '385-06-80919'),
      (1, 9, 1009, '066-0030635-4'),
      (1, 9, 1010, '90-142044-8'),
      (1, 9, 1011, '3579-0112616782'),
      (1, 9, 1012, '49-0009122-0'),
      (1, 9, 1013, '027-007030-3'),
      (1, 9, 1014, '159-34-00207'),
      (1, 9, 1015, '027-007418-0'),
      (1, 9, 1016, '34-27743'),
      (1, 9, 1017, '90-143399-5'),
      (1, 9, 1018, '027-007418-0'),
      (1, 9, 1019, '90-143399-5'),
      (1, 9, 1020, '027-007418-0'),
      (1, 9, 1021, '027-007418-0'),
      (1, 9, 1022, '027-007418-0'),
      (1, 9, 1023, '027-007418-0'),
      (1, 9, 1024, '027-007418-0'),
      (1, 9, 1025, '027-007418-0'),
      (1, 9, 1026, '3445872209
3445923680'),
      (1, 9, 1106, '90-126614-8'),
      (1, 9, 1110, '027-008450-2'),
      (1, 9, 1112, '027-008447-8'),
      (1, 9, 1113, '027-008447-8'),
      (1, 9, 1114, '027-008447-8'),
      (1, 9, 1115, '027-008447-8'),
      (1, 10, 1102, null),
      (1, 10, 1107, null),
      (1, 11, 1001, null),
      (1, 12, 1027, '3445872209'),
      (1, 12, 1028, '3445923680'),
      (1, 12, 1029, '027-006935-4'),
      (1, 12, 1030, '0270070311'),
      (1, 12, 1031, '092-005488-9'),
      (1, 12, 1032, '34-27743'),
      (1, 12, 1033, '385-06-80919'),
      (1, 12, 1034, '066-0030635-4'),
      (1, 12, 1035, '90-142044-8'),
      (1, 12, 1036, '3579-0112616782'),
      (1, 12, 1037, '49-0009122-0'),
      (1, 12, 1038, '027-007030-3'),
      (1, 12, 1039, '159-34-00207'),
      (1, 12, 1040, '027-007418-0'),
      (1, 12, 1041, '34-27743'),
      (1, 12, 1042, '90-143399-5'),
      (1, 12, 1043, '027-007418-0'),
      (1, 12, 1044, '90-143399-5'),
      (1, 12, 1045, '027-007418-0'),
      (1, 12, 1046, '027-007418-0'),
      (1, 12, 1047, '027-007418-0'),
      (1, 12, 1048, '027-007418-0'),
      (1, 12, 1049, '027-007418-0'),
      (1, 12, 1050, '027-007418-0'),
      (1, 12, 1051, '3445872209
3445923680'),
      (1, 12, 1111, '027-008450-2'),
      (1, 13, 1052, '3445872209'),
      (1, 13, 1053, '3445923680'),
      (1, 13, 1054, '027-006935-4'),
      (1, 13, 1055, '0270070311'),
      (1, 13, 1056, '092-005488-9'),
      (1, 13, 1057, '34-27743'),
      (1, 13, 1058, '385-06-80919'),
      (1, 13, 1059, '066-0030635-4'),
      (1, 13, 1060, '90-142044-8'),
      (1, 13, 1061, '3579-0112616782'),
      (1, 13, 1062, '49-0009122-0'),
      (1, 13, 1063, '027-007030-3'),
      (1, 13, 1064, '159-34-00207'),
      (1, 13, 1065, '027-007418-0'),
      (1, 13, 1066, '34-27743'),
      (1, 13, 1067, '90-143399-5'),
      (1, 13, 1068, '027-007418-0'),
      (1, 13, 1069, '90-143399-5'),
      (1, 13, 1070, '027-007418-0'),
      (1, 13, 1071, '027-007418-0'),
      (1, 13, 1072, '027-007418-0'),
      (1, 13, 1073, '027-007418-0'),
      (1, 13, 1074, '027-007418-0'),
      (1, 13, 1075, '027-007418-0'),
      (1, 13, 1076, '3445872209
3445923680'),
      (1, 13, 1109, '027-008450-2'),
      (1, 20, 1077, '3445872209'),
      (1, 20, 1078, '3445923680'),
      (1, 20, 1079, '027-006935-4'),
      (1, 20, 1080, '0270070311'),
      (1, 20, 1081, '092-005488-9'),
      (1, 20, 1082, '34-27743'),
      (1, 20, 1083, '385-06-80919'),
      (1, 20, 1084, '066-0030635-4'),
      (1, 20, 1085, '90-142044-8'),
      (1, 20, 1086, '3579-0112616782'),
      (1, 20, 1087, '49-0009122-0'),
      (1, 20, 1088, '027-007030-3'),
      (1, 20, 1089, '159-34-00207'),
      (1, 20, 1090, '027-007418-0'),
      (1, 20, 1091, '34-27743'),
      (1, 20, 1092, '90-143399-5'),
      (1, 20, 1093, '027-007418-0'),
      (1, 20, 1094, '90-143399-5'),
      (1, 20, 1095, '027-007418-0'),
      (1, 20, 1096, '027-007418-0'),
      (1, 20, 1097, '027-007418-0'),
      (1, 20, 1098, '027-007418-0'),
      (1, 20, 1099, '027-007418-0'),
      (1, 20, 1100, '027-007418-0'),
      (1, 20, 1101, '3445872209
3445923680'),
      (1, 20, 1105, '34-27740'),
      (1, 20, 1106, '027-008450-2'),
      (1, 20, 1108, '027-008450-2'),
      (1, 20, 1118, '027-008447-8')
    ) as x (localidad, objeto, transaccion, cuenta_bancaria)
    order by localidad, objeto, transaccion
  loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.localidad;
    if v_loc is null then
      if position(format('7-%s', lpad(r.localidad::text, 2, '0')) in v_omitidas) = 0 then v_omitidas := v_omitidas || format(' 7-%s', lpad(r.localidad::text, 2, '0')); end if;
      continue;
    end if;
    select id into v_obj from public.objetos_contables where localidad_id = v_loc and numero = r.objeto;
    select id into v_trx from public.transacciones_contables where localidad_id = v_loc and numero = r.transaccion;
    if v_obj is null or v_trx is null then
      v_faltan := v_faltan || format(' 7-%s objeto %s / transacción %s;', lpad(r.localidad::text, 2, '0'), r.objeto, r.transaccion);
      continue;
    end if;
    v_banco := nullif(regexp_replace(trim(r.cuenta_bancaria), '\.+$', ''), '');
    if exists (select 1 from public.objeto_transacciones where objeto_id = v_obj and transaccion_id = v_trx) then
      update public.objeto_transacciones set cuenta_bancaria = v_banco where objeto_id = v_obj and transaccion_id = v_trx;
      v_act := v_act + 1;
    else
      insert into public.objeto_transacciones (objeto_id, transaccion_id, cuenta_bancaria) values (v_obj, v_trx, v_banco);
      v_nuevas := v_nuevas + 1;
    end if;
  end loop;

  raise notice '%', format('Transacciones x objeto de la organización 7: %s nuevas, %s actualizadas.%s%s',
    v_nuevas, v_act,
    case when v_faltan <> '' then ' Omitidas (no existe el objeto o la transacción):' || v_faltan else '' end,
    case when v_omitidas <> '' then ' Localidades que no existen (omitidas):' || v_omitidas else '' end);
end;
$migra$;

notify pgrst, 'reload schema';
