-- Nomenclatura de MAVISA (archivo «Nomenclatura MAVISA.xls», 252 cuentas en 5 niveles) para la
-- organización 3 · localidad 2: REEMPLAZA POR COMPLETO la nomenclatura que tenga esa localidad.
--   1. Se quitan todas las versiones del catálogo de cuentas de la localidad 3-02 con sus cuentas.
--      No se hace si la localidad ya tiene partidas contables registradas (dependen de sus cuentas).
--   2. Se crea la versión 1 con las cuentas de MAVISA. Cada cuenta queda debajo de su cuenta mayor
--      (la de código más largo que es el inicio de su código: 1 → 101 → 10101 → 1010101 → 1010101001).
--      Nota: 1010403001 viene en nivel 5, pero el archivo no trae la cuenta 1010403: queda debajo de
--      10104 (nivel 4).
--   3. Las cuentas x transacción (objetos contables) se vuelven a ligar por su código con las cuentas
--      nuevas, y las cuentas x objeto que existían se ligan con la cuenta del mismo código.
-- Tipos de cuenta: los del archivo son los del sistema (ACTIVO … OTROS GASTOS).
-- Puede ejecutarse de nuevo: si la localidad ya tiene esta nomenclatura, no hace nada.

do $$
declare
  v_org bigint;
  v_loc bigint;
  v_cat bigint;
  v_nivel integer;
  v_viejas integer;
  v_versiones integer;
  c record;
  v_ligadas integer;
  v_pend integer;
  v_obj integer;
  v_obj_perdidas integer;
begin
  select id into v_org from public.organizaciones where codigo = 3;
  if v_org is null then raise exception 'No existe la organización 3.'; end if;
  select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = 2;
  if v_loc is null then raise exception 'La organización 3 no tiene la localidad 2 (3-02).'; end if;

  -- Ya cargada: la versión activa tiene las 252 cuentas de MAVISA.
  if exists (select 1 from public.catalogos_cuentas k where k.localidad_id = v_loc and k.activo
             and (select count(*) from public.cuentas x where x.catalogo_id = k.id) = 252
             and exists (select 1 from public.cuentas x where x.catalogo_id = k.id and x.codigo = '1010102001' and x.nombre = 'BANCO INDUSTRIAL 206-131947-7')) then
    raise notice 'La localidad 3-02 ya tiene la nomenclatura de MAVISA: no se vuelve a cargar.';
    return;
  end if;

  if exists (select 1 from public.partidas p where p.localidad_id = v_loc) then
    raise exception 'La localidad 3-02 tiene partidas contables registradas con su nomenclatura actual: no se puede reemplazar desde cero. Elimínalas o carga la nomenclatura de MAVISA como una versión nueva.';
  end if;

  create temporary table m_cuentas (codigo text primary key, nombre text not null, integra boolean not null, tipo text not null) on commit drop;
  insert into m_cuentas (codigo, nombre, integra, tipo) values
    ('1', 'ACTIVO', true, 'ACTIVO'),
    ('101', 'CORRIENTE', true, 'ACTIVO'),
    ('10101', 'CAJA Y BANCOS', true, 'ACTIVO'),
    ('1010101', 'CAJA GENERAL', true, 'ACTIVO'),
    ('1010101001', 'CAJA GENERAL', false, 'ACTIVO'),
    ('1010101002', 'CAJA CHICA ADMINISTRACIÓN', false, 'ACTIVO'),
    ('1010101003', 'CAJA CHICA OPERACIONES', false, 'ACTIVO'),
    ('1010102', 'BANCOS LOCALES EN QUETZALES', true, 'ACTIVO'),
    ('1010102001', 'BANCO INDUSTRIAL 206-131947-7', false, 'ACTIVO'),
    ('1010102002', 'BANRURAL 3235100377', false, 'ACTIVO'),
    ('1010103', 'BANCOS LOCALES EN US$', true, 'ACTIVO'),
    ('1010103001', 'BANCO INDUSTRIAL USD 206-134189-3', false, 'ACTIVO'),
    ('1010104', 'TRANSFERENCIAS BANCARIAS', true, 'ACTIVO'),
    ('1010104001', 'TRANSFERENCIAS BANCARIAS', false, 'ACTIVO'),
    ('10102', 'CUENTAS POR COBRAR', true, 'ACTIVO'),
    ('1010201', 'CLIENTES', true, 'ACTIVO'),
    ('1010201001', 'CLIENTES MEDICAMENTOS', false, 'ACTIVO'),
    ('10103', 'ANTICIPOS PARA COMPRAS', true, 'ACTIVO'),
    ('1010301', 'ANTICIPOS A PROVEEDORES', true, 'ACTIVO'),
    ('1010301001', 'ANTICIPOS A PROVEEDORES', false, 'ACTIVO'),
    ('1010301002', 'OTROS PAGOS ANTICIPADOS', false, 'ACTIVO'),
    ('1010302', 'OTRAS CUENTAS POR COBRAR', true, 'ACTIVO'),
    ('1010302001', 'CUENTAS POR LIQUIDAR', false, 'ACTIVO'),
    ('1010303', 'CUENTAS POR COBRAR EMPLEADOS', true, 'ACTIVO'),
    ('1010303001', 'ANTICIPO DE SUELDOS', false, 'ACTIVO'),
    ('1010303002', 'CUENTAS POR COBRAR EMPLEADOS', false, 'ACTIVO'),
    ('1010304', 'EMPRESAS AFILIADAS', true, 'ACTIVO'),
    ('1010304001', 'FUTURA FARMA, S.A.', false, 'ACTIVO'),
    ('10104', 'IMPUESTOS POR COBRAR', true, 'ACTIVO'),
    ('1010401', 'IVA CRÉDITO FISCAL LOCAL', true, 'ACTIVO'),
    ('1010401001', 'IVA CRÉDITO', false, 'ACTIVO'),
    ('1010401002', 'RETEN IVA CRÉDITO', false, 'ACTIVO'),
    ('1010401003', 'IVA CONSTANCIAS DE EXENCIÓN', false, 'ACTIVO'),
    ('1010402', 'IMPUESTOS POR ACREDITAR', true, 'ACTIVO'),
    ('1010402001', 'ISR PAGOS TRIMESTRALES', false, 'ACTIVO'),
    ('1010402002', 'IMPUESTO DE SOLIDARIDAD', false, 'ACTIVO'),
    ('1010403001', 'ISR ANUAL PAGADO EN EXCESO', false, 'ACTIVO'),
    ('10105', 'INVENTARIOS GENERALES', true, 'ACTIVO'),
    ('1010501', 'INVENTARIO GENERALES PT', true, 'ACTIVO'),
    ('1010501001', 'INVENTARIO DE MEDICAMENTOS', false, 'ACTIVO'),
    ('1010501002', 'INVENTARIO DE DESCARTE', false, 'ACTIVO'),
    ('1010501003', 'INVENTARIO EN TRÁNSITO', false, 'ACTIVO'),
    ('102', 'NO CORRIENTE', true, 'ACTIVO'),
    ('10201', 'PROPIEDAD, PLANTA Y EQUIPO', true, 'ACTIVO'),
    ('1020101', 'INMUEBLES', true, 'ACTIVO'),
    ('1020101001', 'TERRENOS', false, 'ACTIVO'),
    ('1020101002', 'INMUEBLES', false, 'ACTIVO'),
    ('1020101999', '(-) DEPRECIACIÓN ACUMULADA 5%', false, 'ACTIVO'),
    ('1020102', 'MOBILIARIO Y EQUIPO', true, 'ACTIVO'),
    ('1020102001', 'MOBILIARIO Y EQUIPO', false, 'ACTIVO'),
    ('1020102999', '(-) DEPRECIACIÓN ACUMULADA MOB Y EQ 20%', false, 'ACTIVO'),
    ('1020103', 'VEHICULOS', true, 'ACTIVO'),
    ('1020103001', 'VEHÍCULOS', false, 'ACTIVO'),
    ('1020103999', '(-) DEPRECIACIÓN ACUMULADA VEHICULOS 20%', false, 'ACTIVO'),
    ('1020104', 'HERRAMIENTAS', true, 'ACTIVO'),
    ('1020104001', 'HERRAMIENTAS', false, 'ACTIVO'),
    ('1020104999', '(-) DEPRECIACIÓN ACUMULADA HERRAMIENTAS 25%', false, 'ACTIVO'),
    ('1020105', 'EQUIPO DE COMPUTACION', true, 'ACTIVO'),
    ('1020105001', 'EQUIPO DE COMPUTACIÓN', false, 'ACTIVO'),
    ('1020105999', '(-) DEPRECIACIÓN ACUMULADA EQ COMPUTACION 33.33%', false, 'ACTIVO'),
    ('1020106', 'SISTEMAS INFORMATICOS', true, 'ACTIVO'),
    ('1020106001', 'SISTEMAS INFORMATICOS', false, 'ACTIVO'),
    ('1020106999', '(-) DEPRECIACIÓN ACUMULADA SISTEMAS INFORMATICO 20%', false, 'ACTIVO'),
    ('10202', 'OTROS ACTIVOS', true, 'ACTIVO'),
    ('1020201', 'GASTOS AMORTIZABLES', true, 'ACTIVO'),
    ('1020201001', 'GASTOS DE CONSITUCIÓN', false, 'ACTIVO'),
    ('1020201999', '(-) AMORTIZACIONES', false, 'ACTIVO'),
    ('2', 'PASIVO', true, 'PASIVO'),
    ('201', 'CORRIENTE', true, 'PASIVO'),
    ('20101', 'CUENTAS COMERCIALES POR PAGAR', true, 'PASIVO'),
    ('2010101', 'PROVEEDORES LOCALES', true, 'PASIVO'),
    ('2010101001', 'PROVEEDORES DE MEDICAMENTOS', false, 'PASIVO'),
    ('2010101002', 'PROVEEDORES VARIOS Y CAJA CHICA', false, 'PASIVO'),
    ('2010102', 'PROVEEDORES DEL EXTERIOR', true, 'PASIVO'),
    ('2010102001', 'PROVEEDORES DEL EXTERIOR', false, 'PASIVO'),
    ('2010103', 'ACREEDORES VARIOS', true, 'PASIVO'),
    ('2010103001', 'ACREEDORES VARIOS', false, 'PASIVO'),
    ('2010104', 'ANTICIPOS SOBRE VENTAS', true, 'PASIVO'),
    ('2010104001', 'ANTICIPOS DE CLIENTES', false, 'PASIVO'),
    ('20102', 'IMPUESTOS POR PAGAR', true, 'PASIVO'),
    ('2010201', 'IMPUESTO AL VALOR AGREGADO', true, 'PASIVO'),
    ('2010201001', 'IVA DÉBITO FISCAL', false, 'PASIVO'),
    ('2010201002', 'IVA FACTURAS ESPECIALES', false, 'PASIVO'),
    ('2010201003', 'RETEN IVA DEBITO', false, 'PASIVO'),
    ('2010202', 'IMPUESTO SOBRE LA RENTA', true, 'PASIVO'),
    ('2010202001', 'ISR ANUAL POR PAGAR', false, 'PASIVO'),
    ('2010202002', 'PAGOS TRIMESTRALES DE ISR', false, 'PASIVO'),
    ('2010202003', 'RETENCIONES ISR FACTURAS ESPECIALES', false, 'PASIVO'),
    ('2010202004', 'ISR RENTAS DE TRABAJO', false, 'PASIVO'),
    ('2010202005', 'ISR RENTAS DE CAPITAL', false, 'PASIVO'),
    ('2010202006', 'RETENCION ISR POR PAGAR', false, 'PASIVO'),
    ('2010203', 'OTROS IMPUESTOS POR PAGAR', true, 'PASIVO'),
    ('2010203001', 'OTROS IMPUESTOS POR PAGAR', false, 'PASIVO'),
    ('20103', 'OTRAS CUENTAS POR PAGAR', true, 'PASIVO'),
    ('2010301', 'SUELDOS Y SALARIOS POR PAGAR', true, 'PASIVO'),
    ('2010301001', 'SUELDOS POR PAGAR', false, 'PASIVO'),
    ('2010302', 'PRESTACIONES LABORALES POR PAGAR', true, 'PASIVO'),
    ('2010302001', 'AGUINALDOS POR PAGAR', false, 'PASIVO'),
    ('2010302002', 'BONIFICACION ANUAL DECRETO No. 42-92 POR PAGAR', false, 'PASIVO'),
    ('2010302003', 'VACACIONES POR PAGAR', false, 'PASIVO'),
    ('2010302004', 'INDEMNIZACIONES POR PAGAR', false, 'PASIVO'),
    ('2010303', 'IGSS POR PAGAR', true, 'PASIVO'),
    ('2010303001', 'CUOTA PATRONAL POR PAGAR', false, 'PASIVO'),
    ('2010303002', 'IRTRA / INTECAP POR PAGAR', false, 'PASIVO'),
    ('2010303003', 'CUOTA LABORAL POR PAGAR', false, 'PASIVO'),
    ('2010304', 'CUENTAS POR PAGAR AFILIADAS', true, 'PASIVO'),
    ('2010304001', 'CUENTAS POR PAGAR MAVISA', false, 'PASIVO'),
    ('2010305', 'OTRAS CUENTAS POR PAGAR', true, 'PASIVO'),
    ('2010305001', 'DEPOSITOS POR APLICAR', false, 'PASIVO'),
    ('2010305002', 'CUENTAS POR PAGAR VARIAS', false, 'PASIVO'),
    ('202', 'NO CORRIENTE', true, 'PASIVO'),
    ('20201', 'PRÉSTAMOS', true, 'PASIVO'),
    ('2020101', 'PRÉSTAMOS', true, 'PASIVO'),
    ('2020101001', 'PRESTAMOS DE SOCIOS', false, 'PASIVO'),
    ('2020101002', 'PRESTAMOS BANCARIOS', false, 'PASIVO'),
    ('3', 'PATRIMONIO', true, 'PATRIMONIO'),
    ('301', 'CAPITAL SOCIAL', true, 'PATRIMONIO'),
    ('30101', 'CAPITAL SOCIAL', true, 'PATRIMONIO'),
    ('3010101', 'CAPITAL PAGADO', true, 'PATRIMONIO'),
    ('3010101001', 'CAPITAL AUTORIZADO', false, 'PATRIMONIO'),
    ('3010101002', 'CAPITAL PAGADO', false, 'PATRIMONIO'),
    ('302', 'RESERVAS', true, 'PATRIMONIO'),
    ('30201', 'RESERVAS', true, 'PATRIMONIO'),
    ('3020101', 'RESERVA LEGAL', true, 'PATRIMONIO'),
    ('3020101001', 'RESERVA LEGAL 5%', false, 'PATRIMONIO'),
    ('303', 'GANANCIA/PERDIDA VENTA DE ACTIVOS', true, 'PATRIMONIO'),
    ('30301', 'GANANCIA/PERDIDA VENTA DE ACTIVOS', true, 'PATRIMONIO'),
    ('3030101', 'GANANCIA/PERDIDA VENTA DE ACTIVOS', true, 'PATRIMONIO'),
    ('3030101001', 'GANANCIA POR VENTA DE ACTIVOS', false, 'PATRIMONIO'),
    ('3030101002', 'PERDIDA POR VENTA DE ACTIVOS', false, 'PATRIMONIO'),
    ('304', 'RESULTADOS', true, 'PATRIMONIO'),
    ('30401', 'RESULTADOS POR OPERACIONES ORDINARIAS', true, 'PATRIMONIO'),
    ('3040101', 'RESULTADO DEL PERIODO', true, 'PATRIMONIO'),
    ('3040101001', 'RESULTADO DEL EJERCICIO', false, 'PATRIMONIO'),
    ('3040102', 'RESULTADOS DE EJERCICIOS ANTERIORES', true, 'PATRIMONIO'),
    ('3040102001', 'SUPERAVIT ACUMULADO', false, 'PATRIMONIO'),
    ('3040102002', 'PÉRDIDA ACUMULADA', false, 'PATRIMONIO'),
    ('4', 'INGRESOS', true, 'INGRESOS'),
    ('401', 'INGRESOS DE OPERACIÓN', true, 'INGRESOS'),
    ('40101', 'INGRESOS LOCALES', true, 'INGRESOS'),
    ('4010101', 'VENTA DE MEDICAMENTOS', true, 'INGRESOS'),
    ('4010101001', 'VENTA DE MEDICAMENTO GENERICOS', false, 'INGRESOS'),
    ('4010101002', 'VENTA DE MEDICAMENTOS NO GENERICOS', false, 'INGRESOS'),
    ('4010101003', '(-) DESCUENTO SOBRE VENTAS', false, 'INGRESOS'),
    ('5', 'COSTO DE VENTAS', true, 'COSTO DE VENTAS'),
    ('501', 'COSTO DE VENTAS', true, 'COSTO DE VENTAS'),
    ('50101', 'COSTO DE VENTAS', true, 'COSTO DE VENTAS'),
    ('5010101', 'COSTO DE VENTAS MEDICAMENTOS', true, 'COSTO DE VENTAS'),
    ('5010101001', 'COSTO DE VENTAS MEDICAMENTOS GENERICOS', false, 'COSTO DE VENTAS'),
    ('5010101002', 'COSTO DE VENTAS MEDICAMENTOS NO GENERICOS', false, 'COSTO DE VENTAS'),
    ('5010103', 'GASTOS SOBRE COMPRAS', true, 'COSTO DE VENTAS'),
    ('5010103001', 'GASTOS ADUANALES DE IMPORTACIÓN', false, 'COSTO DE VENTAS'),
    ('5010103002', 'FLETES SOBRE IMPORTACIONES', false, 'COSTO DE VENTAS'),
    ('5010103003', 'GASTOS LEGALES SOBRE IMPORTACIONES', false, 'COSTO DE VENTAS'),
    ('5010103004', 'IMPUESTOS SOBRE IMPORTACIONES', false, 'COSTO DE VENTAS'),
    ('5010103005', 'SEGURO MERCADERIA', false, 'COSTO DE VENTAS'),
    ('5010103006', 'FLETES Y TRANSPORTES', false, 'COSTO DE VENTAS'),
    ('5010103007', 'ALMACENAJE', false, 'COSTO DE VENTAS'),
    ('6', 'GASTOS DE OPERACIÓN', true, 'GASTOS DE OPERACIÓN'),
    ('601', 'GASTOS DE OPERACIÓN', true, 'GASTOS DE OPERACIÓN'),
    ('60101', 'GASTOS DE OPERACIÓN', true, 'GASTOS DE OPERACIÓN'),
    ('6010101', 'SUELDOS Y BONIFICACIONES', true, 'GASTOS DE OPERACIÓN'),
    ('6010101001', 'SUELDOS Y SALARIOS', false, 'GASTOS DE OPERACIÓN'),
    ('6010101002', 'HORAS EXTRAS', false, 'GASTOS DE OPERACIÓN'),
    ('6010101003', 'BONIFICACION 37-2001', false, 'GASTOS DE OPERACIÓN'),
    ('6010102', 'PRESTACIONES LABORALES', true, 'GASTOS DE OPERACIÓN'),
    ('6010102001', 'INDEMNIZACIÓN', false, 'GASTOS DE OPERACIÓN'),
    ('6010102002', 'AGUINALDO', false, 'GASTOS DE OPERACIÓN'),
    ('6010102003', 'BONIFICACION ANUAL DECRETO No. 42-92', false, 'GASTOS DE OPERACIÓN'),
    ('6010102004', 'VACACIONES GOZADAS', false, 'GASTOS DE OPERACIÓN'),
    ('6010102005', 'CUOTA PATRONAL IGSS', false, 'GASTOS DE OPERACIÓN'),
    ('6010102006', 'INTECAP E IRTRA', false, 'GASTOS DE OPERACIÓN'),
    ('6010102007', 'CURSOS Y CAPACITACIÓN', false, 'GASTOS DE OPERACIÓN'),
    ('6010102008', 'ATENCIÓN COLABORADORES', false, 'GASTOS DE OPERACIÓN'),
    ('6010102009', 'SUMINISTROS DE CAFETERÍA', false, 'GASTOS DE OPERACIÓN'),
    ('6010102010', 'EQUIPO SSO', false, 'GASTOS DE OPERACIÓN'),
    ('6010103', 'GASTOS DE ADMINISTRACION Y VENTAS', true, 'GASTOS DE OPERACIÓN'),
    ('6010103001', 'VIÁTICOS Y TRANSPORTE', false, 'GASTOS DE OPERACIÓN'),
    ('6010103002', 'SERVICIOS PRESTADOS', false, 'GASTOS DE OPERACIÓN'),
    ('6010103003', 'MONITOREO GPS', false, 'GASTOS DE OPERACIÓN'),
    ('6010103004', 'HONORARIOS PROFESIONALES', false, 'GASTOS DE OPERACIÓN'),
    ('6010103005', 'GASTOS DE REPRESENTACIÓN', false, 'GASTOS DE OPERACIÓN'),
    ('6010103006', 'GASTOS POR REGENCIA', false, 'GASTOS DE OPERACIÓN'),
    ('6010103007', 'ARRENDAMIENTO OFICINAS', false, 'GASTOS DE OPERACIÓN'),
    ('6010103008', 'SEGURIDAD Y VIGILANCIA', false, 'GASTOS DE OPERACIÓN'),
    ('6010103009', 'COMBUSTIBLES Y LUBRICANTES', false, 'GASTOS DE OPERACIÓN'),
    ('6010103010', 'LICENCIAS Y SOFTWARE', false, 'GASTOS DE OPERACIÓN'),
    ('6010103011', 'PARQUEOS Y PEAJES', false, 'GASTOS DE OPERACIÓN'),
    ('6010103012', 'SERVICIOS TECNICOS', false, 'GASTOS DE OPERACIÓN'),
    ('6010103013', 'HONORARIOS CONTABLES', false, 'GASTOS DE OPERACIÓN'),
    ('6010103014', 'ASESORIA ADMINISTRACION', false, 'GASTOS DE OPERACIÓN'),
    ('6010103015', 'GASTOS DE LABORATORIO', false, 'GASTOS DE OPERACIÓN'),
    ('6010103016', 'DONACIONES', false, 'GASTOS DE OPERACIÓN'),
    ('6010103017', 'PAPELERIA Y UTILES', false, 'GASTOS DE OPERACIÓN'),
    ('6010103018', 'CUOTAS Y SUSCRIPCIONES', false, 'GASTOS DE OPERACIÓN'),
    ('6010103019', 'FIANZAS', false, 'GASTOS DE OPERACIÓN'),
    ('6010103020', 'PUBLICIDAD', false, 'GASTOS DE OPERACIÓN'),
    ('6010103021', 'FLETES Y TRANSPORTES POR ENVIO AL CLIENTE', false, 'GASTOS DE OPERACIÓN'),
    ('6010103022', 'GASTOS VARIOS', false, 'GASTOS DE OPERACIÓN'),
    ('6010103023', 'SERVICIOS DE LIMPIEZA', false, 'GASTOS DE OPERACIÓN'),
    ('6010103024', 'REP. Y MANT. DE INSTALACIONES', false, 'GASTOS DE OPERACIÓN'),
    ('6010103025', 'REP. Y MANT. DE MOBILIARIO Y EQUIPO', false, 'GASTOS DE OPERACIÓN'),
    ('6010103026', 'REP. Y MANT. DE EQUIPO DE COMPUTO', false, 'GASTOS DE OPERACIÓN'),
    ('6010103027', 'REP. Y MANT. DE VEHÍCULOS', false, 'GASTOS DE OPERACIÓN'),
    ('6010103028', 'REPARACIONES Y REPUESTOS', false, 'GASTOS DE OPERACIÓN'),
    ('6010103029', 'ATENCION A PERSONAL Y CLIENTES', false, 'GASTOS DE OPERACIÓN'),
    ('6010103030', 'MANTENIMIENTO Y LIMPIEZA', false, 'GASTOS DE OPERACIÓN'),
    ('6010103031', 'IMPUESTO A LA DIST. DE PETROLEO IDP', false, 'GASTOS DE OPERACIÓN'),
    ('6010103032', 'MATERIALES Y SUMINISTROS', false, 'GASTOS DE OPERACIÓN'),
    ('6010103033', 'MATERIALES Y SUMINISTROS DE LIMPIEZA', false, 'GASTOS DE OPERACIÓN'),
    ('6010103034', 'ATENCION A CLIENTES', false, 'GASTOS DE OPERACIÓN'),
    ('6010103035', 'GASTOS DE VIAJE AL EXTERIOR', false, 'GASTOS DE OPERACIÓN'),
    ('6010103036', 'GASTOS DECORACIÓN Y ORNATO', false, 'GASTOS DE OPERACIÓN'),
    ('6010103037', 'SERVICIOS FARMACOVIGILANCIA', false, 'GASTOS DE OPERACIÓN'),
    ('6010104', 'SERVICIOS BASICOS', true, 'GASTOS DE OPERACIÓN'),
    ('6010104001', 'ENERGÍA ELECTRICA', false, 'GASTOS DE OPERACIÓN'),
    ('6010104002', 'AGUA POTABLE', false, 'GASTOS DE OPERACIÓN'),
    ('6010104003', 'SERVICIO TELEFÓNICO E INTERNET', false, 'GASTOS DE OPERACIÓN'),
    ('6010105', 'OTROS GASTOS DE OPERACIÓN', true, 'GASTOS DE OPERACIÓN'),
    ('6010105001', 'IMPUESTOS Y CONTRIBUCIONES', false, 'GASTOS DE OPERACIÓN'),
    ('6010105002', 'SEGUROS VARIOS', false, 'GASTOS DE OPERACIÓN'),
    ('6010105003', 'SEGURO VEHICULO', false, 'GASTOS DE OPERACIÓN'),
    ('6010106', 'DEPRE. Y AMORTIZACIONES S', true, 'GASTOS DE OPERACIÓN'),
    ('6010106001', 'DEPRE. INMUEBLES', false, 'GASTOS DE OPERACIÓN'),
    ('6010106002', 'DEPRE. MOBILIARIO Y EQUIPO', false, 'GASTOS DE OPERACIÓN'),
    ('6010106003', 'DEPRE. VEHICULOS', false, 'GASTOS DE OPERACIÓN'),
    ('6010106004', 'DEPRE. HERRAMIENTAS', false, 'GASTOS DE OPERACIÓN'),
    ('6010106005', 'DEPRE. EQUIPO DE COMPUTACIÓN', false, 'GASTOS DE OPERACIÓN'),
    ('6010106006', 'AMORTIZACIONES', false, 'GASTOS DE OPERACIÓN'),
    ('7', 'OTROS INGRESOS', true, 'OTROS INGRESOS'),
    ('701', 'OTROS INGRESOS', true, 'OTROS INGRESOS'),
    ('70101', 'OTROS INGRESOS', true, 'OTROS INGRESOS'),
    ('7010101', 'PRODUCTOS FINANCIEROS', true, 'OTROS INGRESOS'),
    ('7010101001', 'INTERESES BANCARIOS', false, 'OTROS INGRESOS'),
    ('7010101002', 'DIFERENCIAL CAMBIARIO', false, 'OTROS INGRESOS'),
    ('7010101003', 'OTROS INGRESOS, DESCUENTOS POR PRONTO PAGO', false, 'OTROS INGRESOS'),
    ('7010102', 'PRODUCTOS NO FINANCIEROS', true, 'OTROS INGRESOS'),
    ('7010102001', 'OTROS INGRESOS DIVERSOS', false, 'OTROS INGRESOS'),
    ('7010102002', 'AJUSTES DE BODEGA', false, 'OTROS INGRESOS'),
    ('8', 'OTROS GASTOS', true, 'OTROS GASTOS'),
    ('801', 'OTROS GASTOS', true, 'OTROS GASTOS'),
    ('80101', 'OTROS GASTOS', true, 'OTROS GASTOS'),
    ('8010101', 'GASTOS FINANCIEROS', true, 'OTROS GASTOS'),
    ('8010101001', 'INTERESES BANCARIOS', false, 'OTROS GASTOS'),
    ('8010101002', 'COMISIONES BANCARIAS', false, 'OTROS GASTOS'),
    ('8010101003', 'DIFERENCIAL CAMBIARIO', false, 'OTROS GASTOS'),
    ('8010101004', 'COBROS POR CHEQUES RECHAZADOS DE CLIENTES', false, 'OTROS GASTOS'),
    ('8010101005', 'OTROS GASTOS FINANCIEROS', false, 'OTROS GASTOS'),
    ('8010102', 'OTROS GASTOS NO FINANCIEROS', true, 'OTROS GASTOS'),
    ('8010102001', 'AJUSTES DE BODEGA', false, 'OTROS GASTOS'),
    ('8010102002', 'OTROS GASTOS', false, 'OTROS GASTOS'),
    ('8010102003', 'GASTOS NO DEDUCIBLES', false, 'OTROS GASTOS');

  if exists (select 1 from m_cuentas m where not exists (select 1 from public.tipos_cuenta t where upper(t.descripcion) = upper(m.tipo))) then
    raise exception 'Hay tipos de cuenta del archivo que no existen en Tipos de cuentas: %.',
      (select string_agg(distinct m.tipo, ', ') from m_cuentas m where not exists (select 1 from public.tipos_cuenta t where upper(t.descripcion) = upper(m.tipo)));
  end if;

  -- Cuentas x objeto actuales: se guardan por código para volver a ligarlas.
  create temporary table m_objeto_cuentas on commit drop as
    select oc.objeto_id, x.codigo, oc.linea
    from public.objeto_cuentas oc join public.objetos_contables o on o.id = oc.objeto_id join public.cuentas x on x.id = oc.cuenta_id
    where o.localidad_id = v_loc;
  delete from public.objeto_cuentas oc using public.objetos_contables o where o.id = oc.objeto_id and o.localidad_id = v_loc;
  -- Cuentas x transacción: quedan con su código, sin cuenta, hasta que exista la nueva.
  update public.transaccion_cuentas l set cuenta_id = null
  from public.transacciones_contables t where t.id = l.transaccion_id and t.localidad_id = v_loc and l.cuenta_id is not null;

  -- ---------- 1. Se quita la nomenclatura actual ----------
  select count(*) into v_versiones from public.catalogos_cuentas where localidad_id = v_loc;
  select count(*) into v_viejas from public.cuentas x join public.catalogos_cuentas k on k.id = x.catalogo_id where k.localidad_id = v_loc;
  for v_nivel in reverse coalesce((select max(x.nivel) from public.cuentas x join public.catalogos_cuentas k on k.id = x.catalogo_id where k.localidad_id = v_loc), 0)..1 loop
    delete from public.cuentas x using public.catalogos_cuentas k where k.id = x.catalogo_id and k.localidad_id = v_loc and x.nivel = v_nivel;
  end loop;
  delete from public.catalogos_cuentas where localidad_id = v_loc;

  -- ---------- 2. Nomenclatura de MAVISA, versión 1 ----------
  insert into public.catalogos_cuentas (organizacion_id, localidad_id, version, fecha_del)
  values (v_org, v_loc, 1, current_date) returning id into v_cat;
  for c in select * from m_cuentas order by length(codigo), codigo loop
    insert into public.cuentas (catalogo_id, codigo, nombre, cuenta_mayor_id, tipo_cuenta_id, integra)
    values (v_cat, c.codigo, c.nombre,
            (select x.id from public.cuentas x
             where x.catalogo_id = v_cat and length(x.codigo) < length(c.codigo) and c.codigo like x.codigo || '%'
             order by length(x.codigo) desc limit 1),
            (select t.id from public.tipos_cuenta t where upper(t.descripcion) = upper(c.tipo)),
            c.integra);
  end loop;

  -- ---------- 3. Objetos contables ----------
  -- Las cuentas x transacción se ligan solas al crear cada cuenta; por si acaso, se repasa.
  update public.transaccion_cuentas l set cuenta_id = x.id
  from public.transacciones_contables t, public.cuentas x
  where t.id = l.transaccion_id and t.localidad_id = v_loc and l.cuenta_id is null and x.catalogo_id = v_cat and x.codigo = l.cuenta_codigo;
  insert into public.objeto_cuentas (objeto_id, cuenta_id, linea)
  select m.objeto_id, x.id, m.linea from m_objeto_cuentas m join public.cuentas x on x.catalogo_id = v_cat and x.codigo = m.codigo
  on conflict (objeto_id, cuenta_id) do nothing;
  get diagnostics v_obj = row_count;
  select count(*) into v_obj_perdidas from m_objeto_cuentas m where not exists (select 1 from public.cuentas x where x.catalogo_id = v_cat and x.codigo = m.codigo);

  select count(*) filter (where l.cuenta_id is not null), count(*) filter (where l.cuenta_id is null) into v_ligadas, v_pend
  from public.transaccion_cuentas l join public.transacciones_contables t on t.id = l.transaccion_id where t.localidad_id = v_loc;

  raise notice 'Localidad 3-02: se quitaron % versiones con % cuentas; nomenclatura de MAVISA cargada (versión 1, % cuentas en % niveles).',
    v_versiones, v_viejas, (select count(*) from public.cuentas where catalogo_id = v_cat), (select max(nivel) from public.cuentas where catalogo_id = v_cat);
  raise notice 'Objetos contables: % cuentas x transacción ligadas, % pendientes; % cuentas x objeto ligadas de nuevo, % sin cuenta equivalente.',
    v_ligadas, v_pend, v_obj, v_obj_perdidas;
end;
$$;
