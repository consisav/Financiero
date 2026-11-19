-- Lote del 05-11 al 17-11-2026 («Datos Tecnoasla - AAPOS del 05-11-2026 al 17-11-2026»): mismo proceso del script 265, solo con los registros de este lote.
-- Script 290 · Organización 4 (Tecnoalsa): columnas y catálogos que necesitan las partidas contables (script 266).
--   a) Columnas nuevas (vienen con datos en CON_POLIZAS_N.xlsx y CON_DETALLE_POLIZAS_N.xlsx y no estaban en la base de datos):
--      partidas: origen_anterior (marca MIGRADO), estado_anterior (ESTADO), modulo_anterior (MODULO), tipo_anterior (TIPO (M, A, S)), aprobada_anterior (APROBADA), clasificacion_anterior (CLASIFICACION), transaccion_anterior (TIPO_TRANSACCION), transaccion_id (transacción contable), moneda_integracion (MONEDA_INTEGRACION), valor_cambio_anterior (VALOR_CAMBIO), anticipo (ANTICIPO), definitiva_anterior (DEFINITIVA), revisada (REVISADA), numero_anual_anterior (POLIZA_ANUAL tal como venía), tipo_nomina_anterior (TIPO_NOMINA), nomina_anterior (NOMINA), transaccion_generada (TRANSACCION_GENERADA), nombre_transaccion_anterior (NOMBRE_TRANSACCION), archivo_anterior (ARCHIVO), estado_conta_anterior (ESTADO_CONTA).
--      partida_lineas: debe_mi (DEBITO_MI), haber_mi (CREDITO_MI), cuenta_codigo_anterior (CUENTA), version_cuenta_anterior (VERSION), tipo_int_centro (TIPO_INT_CENTRO), debito_anterior (DEBITO tal como venía), credito_anterior (CREDITO tal como venía), origen_anterior (marca MIGRADO), centro_costo_anterior (CENTRO_COSTO).
--      FECHA_APROBACION y USUARIO_APROBACION van a las columnas que ya existen (aprobada_en y aprobada_por).
--   b) Transacciones contables: se crean las que usan las pólizas y no existen en la localidad (8 usadas; en el catálogo
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
    (1, 1008, 'COMPRAS INVENTARIO LOCALES'),
    (1, 1011, 'SERVICIOS PRESTADOS'),
    (1, 1012, 'NOTA DEBITO DE CXP PROVEEDORES BIENES BI Q'),
    (1, 1013, 'NOTA DEBITO DE CXP PROVEEDORES SERVICIOS BI Q'),
    (1, 1018, 'PAGO BONIFIICACIONES Y/O COMISIONES'),
    (1, 1029, 'NOTAS DE DEBITO  BI Q'),
    (1, 1042, 'NOTAS DE CREDITO ANTICIPO DE BIENES BI Q')) as x(loc, numero, descripcion) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    -- Solo las que no existen (la regla de numeración rechaza un número repetido antes de llegar a «on conflict»).
    if v_loc is null or exists (select 1 from public.transacciones_contables where localidad_id = v_loc and numero = r.numero) then continue; end if;
    insert into public.transacciones_contables (organizacion_id, localidad_id, numero, descripcion, estado, aplica_poliza)
    values (v_org, v_loc, r.numero, r.descripcion, 'ACTIVO', true);
    t_n := t_n + 1;
  end loop;

  -- Cuentas contables (de la más corta a la más larga, para que la mayor exista antes).
  for r in select * from (values
    (1, '21110201', 'ANTICIPOS DE CLIENTES'),
    (1, '1121', 'CLIENTES LOCALES'),
    (1, '21110102', 'CXP DE SERVICIOS'),
    (1, '112312', 'ANTICIPOS DE COBROS POR TRARJETAS NEONET'),
    (1, '70401', 'OTROS GASTOS NO OPERATIVOS'),
    (1, '112301', 'ANTICIPOS A PROVEEDORES LOCALES'),
    (1, '6101', 'GV - SUELDO ORDINARIO'),
    (1, '6102', 'GV - BONIFICACIÓN E INCENTIVO DE LEY'),
    (1, '6103', 'GV - BONIFICACIÓN E INCENTIVO SOBRE METAS'),
    (1, '6104', 'GV - CUOTA PATRONAL'),
    (1, '6105', 'GV - CUOTA IRTRA'),
    (1, '6106', 'GV - CUOTA INTECAP'),
    (1, '6107', 'GV - BONO 14'),
    (1, '6108', 'GV - AGUINALDO'),
    (1, '6110', 'GV - INDEMNIZACIÓN'),
    (1, '6201', 'GA - SUELDO ORDINARIO'),
    (1, '6202', 'GA - BONIFICACIÓN E INCENTIVO DE LEY'),
    (1, '6203', 'GA - BONIFICACIÓN E INCENTIVO SOBRE METAS'),
    (1, '6204', 'GA - CUOTA PATRONAL'),
    (1, '6205', 'GA - CUOTA IRTRA'),
    (1, '6206', 'GA - CUOTA INTECAP'),
    (1, '6207', 'GA - BONO 14'),
    (1, '6208', 'GA - AGUINALDO'),
    (1, '6210', 'GA - INDEMNIZACIÓN'),
    (1, '6301', 'GT- SUELDO ORDINARIO'),
    (1, '6302', 'GT- BONIFICACIÓN E INCENTIVO DE LEY'),
    (1, '6303', 'GT- BONIFICACIÓN E INCENTIVOS SOBRE METAS'),
    (1, '6304', 'GT-CUOTA PATRONAL'),
    (1, '6305', 'GT-CUOTA IRTRA'),
    (1, '6306', 'GT-CUOTA INTECAP'),
    (1, '6307', 'GT-BONO 14'),
    (1, '6308', 'GT-AGUINALDO'),
    (1, '6310', 'GT-INDEMNIZACIÓN'),
    (1, '2111080101', 'CXP SUELDOS'),
    (1, '21110701', 'IGSS POR PAGAR LABORAL'),
    (1, '21110702', 'IGSS POR PAGAR PATRONAL'),
    (1, '2111050201', 'ISR RETENIDO EMPLEADOS'),
    (1, '2111080201', 'CXP  BONO 14'),
    (1, '2111080202', 'CXP AGUINALDO'),
    (1, '2111080204', 'CXP INDEMNIZACIÓN'),
    (1, '2111080103', 'CXP BONIFICACIONES'),
    (1, '70301', 'OTROS INGRESOS NO OPERATIVOS'),
    (1, '6320', 'GT- COMISIONES'),
    (1, '2111080102', 'CXP COMISIONES'),
    (1, '2111030105', 'CXP VIATICOS VELVETH BARRERA RAMIREZ'),
    (1, '11110202', 'CAJA CHICA ADMINISTRACION'),
    (1, '1141', 'INVENTARIO'),
    (1, '11301', 'IVA CRÉDITO FISCAL'),
    (1, '21110101', 'CXP DE BIENES'),
    (1, '6218', 'GA - TELÉFONO E INTERNET'),
    (1, '6221', 'GA - SERVICIOS PROFESIONALES'),
    (1, '6230', 'GA - ARRENDAMIENTO DE OFICINAS'),
    (1, '6243', 'GA- SERVICIO DE MENSAJERÍA'),
    (1, '2111050103', 'IVA -  FACTURAS ESPECIALES'),
    (1, '2111050202', 'ISR RETENIDO PROVEEDORES'),
    (1, '2111050203', 'ISR RETENIDO FACTURAS ESPECIALES'),
    (1, '11120101', 'BI Q. MONETARIA 006-019757-1'),
    (1, '21110103', 'CXP X PROVEEDOR')) as x(loc, codigo, nombre) order by loc, length(codigo), codigo loop
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
    (null::integer, null::text)) as x(loc, codigo) where loc is not null order by loc, length(codigo), codigo loop
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
