-- 222 · Parte 2 de 2 · Catálogo contable de la organización 7 (ASOCIACIÓN AMIGOS PRO OBRAS SOCIALES), localidad 7-01, de los archivos de «Tecnoalsa - AAPOS»:
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
