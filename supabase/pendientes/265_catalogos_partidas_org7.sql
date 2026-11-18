-- Script 265 · Organización 7 (AAPOS): columnas y catálogos que necesitan las partidas contables (script 266).
--   a) Columnas nuevas (vienen con datos en CON_POLIZAS_N.xlsx y CON_DETALLE_POLIZAS_N.xlsx y no estaban en la base de datos):
--      partidas: origen_anterior (marca MIGRADO), estado_anterior (ESTADO), modulo_anterior (MODULO), tipo_anterior (TIPO (M, A, S)), aprobada_anterior (APROBADA), clasificacion_anterior (CLASIFICACION), transaccion_anterior (TIPO_TRANSACCION), transaccion_id (transacción contable), moneda_integracion (MONEDA_INTEGRACION), valor_cambio_anterior (VALOR_CAMBIO), anticipo (ANTICIPO), definitiva_anterior (DEFINITIVA), revisada (REVISADA), numero_anual_anterior (POLIZA_ANUAL tal como venía), tipo_nomina_anterior (TIPO_NOMINA), nomina_anterior (NOMINA), transaccion_generada (TRANSACCION_GENERADA), nombre_transaccion_anterior (NOMBRE_TRANSACCION), archivo_anterior (ARCHIVO), estado_conta_anterior (ESTADO_CONTA).
--      partida_lineas: debe_mi (DEBITO_MI), haber_mi (CREDITO_MI), cuenta_codigo_anterior (CUENTA), version_cuenta_anterior (VERSION), tipo_int_centro (TIPO_INT_CENTRO), debito_anterior (DEBITO tal como venía), credito_anterior (CREDITO tal como venía), origen_anterior (marca MIGRADO), centro_costo_anterior (CENTRO_COSTO).
--      FECHA_APROBACION y USUARIO_APROBACION van a las columnas que ya existen (aprobada_en y aprobada_por).
--   b) Transacciones contables: se crean las que usan las pólizas y no existen en la localidad (38 usadas; en el catálogo
--      del sistema anterior no estaban: ; se crean con la descripción de su primera póliza).
--   c) Cuentas contables: se crean en el catálogo versión 1 de la localidad las que usa el detalle y no existen (en el catálogo del
--      sistema anterior faltaban: ). Toman el nombre de la misma cuenta en otra
--      localidad (o «CUENTA código (CREADA AL MIGRAR PARTIDAS)») y su cuenta mayor es la de código más largo que la contenga.
--   d) Centros de costo: se crean los que usa el detalle (7-01 1110100101, 7-01 1110100102, 7-01 1110100106, 7-01 1110200101, 7-01 1110200124, 7-01 1110200108, 7-01 1110200113, 7-01 1110200114, 7-01 1110200115, 7-01 1110200116, 7-01 1110200118, 7-01 1110200119, 7-01 1110200120, 7-01 1110200121, 7-01 111020012201, 7-01 111020012202, 7-01 111020012203, 7-01 111020012208, 7-01 1110200123, 7-01 1110200201, 7-01 1110200202, 7-01 111020020302, 7-01 1110200204, 7-01 112010501, 7-01 112010502, 7-01 112010504, 7-01 112010507, 7-01 112010508, 7-01 112010513, 7-01 211010501, 7-01 211010602, 7-01 211010610, 7-01 211010902, 7-01 211010903, 7-01 211010904, 7-01 211010905, 7-01 211010906, 7-01 211010908, 7-01 211011101, 7-01 411040105, 7-01 411040204, 7-01 411040304, 7-01 411041201, 7-01 411040106, 7-01 411040306, 7-01 52010237, 7-01 52010342, 7-01 211011102, 7-01 111020012205, 7-01 211011104, 7-01 211011106, 7-01 52010217, 7-01 52010218, 7-01 52010227, 7-01 52010235, 7-01 52010106, 7-01 52010109, 7-01 52010110, 7-01 52010112, 7-01 52010113, 7-01 52010116, 7-01 52010120, 7-01 52010123, 7-01 52010126, 7-01 52010127, 7-01 52010140, 7-01 52010306, 7-01 52010345, 7-01 52010536, 7-01 52010729, 7-01 52010736, 7-01 52011201, 7-01 211011301, 7-01 211011401, 7-01 1110100103, 7-01 52010129, 7-01 411040706, 7-01 411040101, 7-01 411040701, 7-01 52010107, 7-01 112010510, 7-01 52010117, 7-01 52010236, 7-01 52010108, 7-01 52010104, 7-01 52010309, 7-01 211011103, 7-01 52010219, 7-01 52010115, 7-01 52010206, 7-01 52010326, 7-01 52010726, 7-01 211011303, 7-01 411040102, 7-01 411040103, 7-01 411040202, 7-01 411040302, 7-01 111020020301, 7-01 52010114, 7-01 52010122, 7-01 52010725, 7-01 211011108, 7-01 211011304, 7-01 52010119, 7-01 52010118, 7-01 52010121, 7-01 52010105, 7-01 52010135, 7-01 52010205, 7-01 52010305, 7-01 52010704, 7-01 52010919, 7-01 112010509, 7-01 111020012204, 7-01 52010220, 7-01 52010308, 7-01 52010320, 7-01 52010619, 7-01 52010638, 7-01 52011105, 7-01 211011302, 7-01 52010101, 7-01 52010143, 7-01 52010124, 7-01 52010314, 7-01 52010327, 7-01 411040301, 7-01 54010204, 7-01 411040702, 7-01 52010137, 7-01 211011110, 7-01 1110200125, 7-01 211011109, 7-01 52010313, 7-01 52010707, 7-01 52010711, 7-01 52010713, 7-01 411040506, 7-01 411040704, 7-01 54010202, 7-01 52010739, 7-01 54010201, 7-01 52010141, 7-01 52010125, 7-01 52010130, 7-01 52011202, 7-01 1110200112, 7-01 211010901, 7-01 411040104, 7-01 411041202, 7-01 52010815, 7-01 52010839, 7-01 52010840, 7-01 52010841, 7-01 211011107, 7-01 1110200102, 7-01 411040111, 7-01 52010706, 7-01 52010519, 7-01 52010812, 7-01 211011307, 7-01 211011404, 7-01 1110200126, 7-01 1110200127, 7-01 52010136, 7-01 52010719, 7-01 211011306, 7-01 411040602, 7-01 52010712, 7-01 211011105, 7-01 112010511, 7-01 52010526) en la versión 1 del catálogo
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
  select id into v_org from public.organizaciones where codigo::text = '7';
  if v_org is null then raise notice 'No existe la organización 7.'; return; end if;

  -- Transacciones contables.
  for r in select * from (values
    (1, 1001, 'PARTIDAS DIARIAS'),
    (1, 1104, 'INGRESOS VENTAS (MIGRACION)'),
    (1, 1002, 'CHEQUES RIFA CTA 3445872209'),
    (1, 1003, 'CHEQUES RIFA CTA 3445923680'),
    (1, 1004, 'CHEQUES RIFA CTA 027-006935-4'),
    (1, 1010, 'CHEQUES RIFA CTA 90-142044-8'),
    (1, 1013, 'CHEQUES MUNAG CTA 027-007030-3'),
    (1, 1063, 'NOTAS CREDITO MUNAG CTA 027-007030-3'),
    (1, 1079, 'NOTAS DEBITO  RIFA CTA 027-006935-4'),
    (1, 1081, 'NOTAS DEBITO  RIFA CTA 092-005488-9'),
    (1, 1083, 'NOTAS DEBITO  RIFA CTA 385-06-80919'),
    (1, 1088, 'NOTAS DEBITO  MUNAG CTA 027-007030-3'),
    (1, 1090, 'NOTAS DEBITO  MCDVP CTA 027-007418-0'),
    (1, 1102, 'GASTOS CAJA CHICA (COMPRAS)'),
    (1, 1103, 'GASTOS COMPRAS'),
    (1, 1105, 'TRASLADO ENTRE CUENTAS CTA 34-27740'),
    (1, 1106, 'CHEQUES ENTIDAD (EVELYN)'),
    (1, 1107, 'MIGRACION DE COMPRAS'),
    (1, 1082, 'NOTAS DEBITO  RIFA CTA 34-27743'),
    (1, 1038, 'DEPOSITOS  MUNAG CTA 027-007030-3'),
    (1, 1019, 'CHEQUES CUB PLAZA VDS CTA 90-143399-5'),
    (1, 1065, 'NOTAS CREDITO MCDVP CTA 027-007418-0'),
    (1, 1009, 'CHEQUES RIFA CTA 066-0030635-4'),
    (1, 1015, 'CHEQUES MCDVP CTA 027-007418-0'),
    (1, 1029, 'DEPOSITOS  RIFA CTA 027-006935-4'),
    (1, 1031, 'DEPOSITOS  RIFA CTA 092-005488-9'),
    (1, 1054, 'NOTAS CREDITO RIFA CTA 027-006935-4'),
    (1, 1039, 'DEPOSITOS  MUNAG CTA 159-34-00207'),
    (1, 1012, 'CHEQUES ALBERGUE CTA 49-0009122-0'),
    (1, 1077, 'NOTAS DEBITO  RIFA CTA 3445872209'),
    (1, 1080, 'NOTAS DEBITO  RIFA CTA 0270070311'),
    (1, 1089, 'NOTAS DEBITO  MUNAG CTA 159-34-00207'),
    (1, 1078, 'NOTAS DEBITO  RIFA CTA 3445923680'),
    (1, 1084, 'NOTAS DEBITO  RIFA CTA 066-0030635-4'),
    (1, 1085, 'NOTAS DEBITO  RIFA CTA 90-142044-8'),
    (1, 1040, 'DEPOSITOS  MCDVP CTA 027-007418-0'),
    (1, 1110, 'CHEQUES PISCINA II  027-008450-2'),
    (1, 1118, 'NOTAS DEBITO OFTALMOLOGIA 027-008447-8')) as x(loc, numero, descripcion) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    -- Solo las que no existen (la regla de numeración rechaza un número repetido antes de llegar a «on conflict»).
    if v_loc is null or exists (select 1 from public.transacciones_contables where localidad_id = v_loc and numero = r.numero) then continue; end if;
    insert into public.transacciones_contables (organizacion_id, localidad_id, numero, descripcion, estado, aplica_poliza)
    values (v_org, v_loc, r.numero, r.descripcion, 'ACTIVO', true);
    t_n := t_n + 1;
  end loop;

  -- Cuentas contables (de la más corta a la más larga, para que la mayor exista antes).
  for r in select * from (values
    (1, '11101001', 'Caja Chica'),
    (1, '11101002', 'Caja General'),
    (1, '11102001', 'Cuentas Nacionales Bancarias en Quetzales'),
    (1, '11102002', 'Cuentas Nacionales Bancarias en Dólares'),
    (1, '1120101', 'Clientes Locales'),
    (1, '1120103', 'PRESTAMOS A EMPLEADOS'),
    (1, '1120104', 'PRESTAMOS X COBRAR'),
    (1, '1120105', 'Cuentas X liquidar'),
    (1, '1120110', 'DONACIONES AL CREDITO'),
    (1, '12101', 'Mobiliario y Equipo'),
    (1, '12103', 'Equipo de Computacion'),
    (1, '12301', 'Vehiculos'),
    (1, '2110105', 'Impuestos por pagar'),
    (1, '2110106', 'Prestamos'),
    (1, '2110109', 'Otras CXP'),
    (1, '2110111', 'Cuenta puente X pagar'),
    (1, '3301', 'Utilidades Acumuladas'),
    (1, '41104', 'Donaciones'),
    (1, '5201', 'GASTOS GENERALES'),
    (1, '2110113', 'CUENTAS POR PAGAR (REAL)'),
    (1, '2110114', 'CUENTA POR PAGAR TARJETA DE CREDITO'),
    (1, '530103', 'GASTOS FINANCIEROS'),
    (1, '2110101', 'Proveedores Locales'),
    (1, '530101', 'GASTOS FINANCIEROS'),
    (1, '530104', 'DIFERENCIAL CAMBIARIO'),
    (1, '540102', 'DIFERENCIAL CAMBIARIO'),
    (1, '540101', 'INTERESES CUENTAS BANCARIAS Y FINANCIERAS'),
    (1, '3402', 'Perdida del Ejercicio'),
    (1, '3401', 'Perdidas Acumuladas'),
    (1, '1120107', 'Otras CXC')) as x(loc, codigo, nombre) order by loc, length(codigo), codigo loop
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
    c_n := c_n + 1; v_ctas := array_append(v_ctas, format('7-0%s %s', r.loc, r.codigo));
  end loop;

  -- Centros de costo.
  for r in select * from (values
    (1, '1110100101'),
    (1, '1110100102'),
    (1, '1110100106'),
    (1, '1110200101'),
    (1, '1110200124'),
    (1, '1110200108'),
    (1, '1110200113'),
    (1, '1110200114'),
    (1, '1110200115'),
    (1, '1110200116'),
    (1, '1110200118'),
    (1, '1110200119'),
    (1, '1110200120'),
    (1, '1110200121'),
    (1, '111020012201'),
    (1, '111020012202'),
    (1, '111020012203'),
    (1, '111020012208'),
    (1, '1110200123'),
    (1, '1110200201'),
    (1, '1110200202'),
    (1, '111020020302'),
    (1, '1110200204'),
    (1, '112010501'),
    (1, '112010502'),
    (1, '112010504'),
    (1, '112010507'),
    (1, '112010508'),
    (1, '112010513'),
    (1, '211010501'),
    (1, '211010602'),
    (1, '211010610'),
    (1, '211010902'),
    (1, '211010903'),
    (1, '211010904'),
    (1, '211010905'),
    (1, '211010906'),
    (1, '211010908'),
    (1, '211011101'),
    (1, '411040105'),
    (1, '411040204'),
    (1, '411040304'),
    (1, '411041201'),
    (1, '411040106'),
    (1, '411040306'),
    (1, '52010237'),
    (1, '52010342'),
    (1, '211011102'),
    (1, '111020012205'),
    (1, '211011104'),
    (1, '211011106'),
    (1, '52010217'),
    (1, '52010218'),
    (1, '52010227'),
    (1, '52010235'),
    (1, '52010106'),
    (1, '52010109'),
    (1, '52010110'),
    (1, '52010112'),
    (1, '52010113'),
    (1, '52010116'),
    (1, '52010120'),
    (1, '52010123'),
    (1, '52010126'),
    (1, '52010127'),
    (1, '52010140'),
    (1, '52010306'),
    (1, '52010345'),
    (1, '52010536'),
    (1, '52010729'),
    (1, '52010736'),
    (1, '52011201'),
    (1, '211011301'),
    (1, '211011401'),
    (1, '1110100103'),
    (1, '52010129'),
    (1, '411040706'),
    (1, '411040101'),
    (1, '411040701'),
    (1, '52010107'),
    (1, '112010510'),
    (1, '52010117'),
    (1, '52010236'),
    (1, '52010108'),
    (1, '52010104'),
    (1, '52010309'),
    (1, '211011103'),
    (1, '52010219'),
    (1, '52010115'),
    (1, '52010206'),
    (1, '52010326'),
    (1, '52010726'),
    (1, '211011303'),
    (1, '411040102'),
    (1, '411040103'),
    (1, '411040202'),
    (1, '411040302'),
    (1, '111020020301'),
    (1, '52010114'),
    (1, '52010122'),
    (1, '52010725'),
    (1, '211011108'),
    (1, '211011304'),
    (1, '52010119'),
    (1, '52010118'),
    (1, '52010121'),
    (1, '52010105'),
    (1, '52010135'),
    (1, '52010205'),
    (1, '52010305'),
    (1, '52010704'),
    (1, '52010919'),
    (1, '112010509'),
    (1, '111020012204'),
    (1, '52010220'),
    (1, '52010308'),
    (1, '52010320'),
    (1, '52010619'),
    (1, '52010638'),
    (1, '52011105'),
    (1, '211011302'),
    (1, '52010101'),
    (1, '52010143'),
    (1, '52010124'),
    (1, '52010314'),
    (1, '52010327'),
    (1, '411040301'),
    (1, '54010204'),
    (1, '411040702'),
    (1, '52010137'),
    (1, '211011110'),
    (1, '1110200125'),
    (1, '211011109'),
    (1, '52010313'),
    (1, '52010707'),
    (1, '52010711'),
    (1, '52010713'),
    (1, '411040506'),
    (1, '411040704'),
    (1, '54010202'),
    (1, '52010739'),
    (1, '54010201'),
    (1, '52010141'),
    (1, '52010125'),
    (1, '52010130'),
    (1, '52011202'),
    (1, '1110200112'),
    (1, '211010901'),
    (1, '411040104'),
    (1, '411041202'),
    (1, '52010815'),
    (1, '52010839'),
    (1, '52010840'),
    (1, '52010841'),
    (1, '211011107'),
    (1, '1110200102'),
    (1, '411040111'),
    (1, '52010706'),
    (1, '52010519'),
    (1, '52010812'),
    (1, '211011307'),
    (1, '211011404'),
    (1, '1110200126'),
    (1, '1110200127'),
    (1, '52010136'),
    (1, '52010719'),
    (1, '211011306'),
    (1, '411040602'),
    (1, '52010712'),
    (1, '211011105'),
    (1, '112010511'),
    (1, '52010526')) as x(loc, codigo) order by loc, length(codigo), codigo loop
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
    z_n := z_n + 1; v_cen := array_append(v_cen, format('7-0%s %s', r.loc, r.codigo));
  end loop;

  raise notice '%', format('Transacciones creadas: %s. Cuentas creadas: %s %s. Catálogos de centros creados: %s. Centros creados: %s %s.',
    t_n, c_n, coalesce(array_to_string(v_ctas, ', '), ''), k_n, z_n, coalesce(array_to_string(v_cen, ', '), ''));
end;
$cat$;

notify pgrst, 'reload schema';
