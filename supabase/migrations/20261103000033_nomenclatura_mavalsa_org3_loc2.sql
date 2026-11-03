-- Nomenclatura contable de Mavalsa (archivo «Nomenclatura Mavalsa.xls», 60 cuentas)
-- para la organización 3 · localidad 2.
-- Se carga como una versión nueva del catálogo de cuentas de esa localidad (la siguiente a las
-- que ya tenga), vigente desde hoy. Cada cuenta queda debajo de su cuenta mayor: la cuenta
-- anterior cuyo código es el inicio más largo de su código (1 → 11 → 1111 → 111101).
-- Tipos de cuenta del archivo y su equivalente en el sistema:
--   ACTIVO → ACTIVO · PASIVO → PASIVO · CAPITAL Y RESERVAS → PATRIMONIO
--   INGRESOS → INGRESOS · GASTOS DE OPERACION → GASTOS DE OPERACIÓN
-- Nota: 411200 SERVICIOS y 411201 Servicios de Transporte empiezan con 4112, pero el archivo
-- no trae la cuenta 4112: quedan debajo de 41 VENTAS (nivel 3).
-- Puede ejecutarse de nuevo: si la localidad ya tiene esta nomenclatura, no la vuelve a cargar.

do $$
declare
  v_org bigint;
  v_loc bigint;
  v_cat bigint;
  v_version integer;
  c record;
begin
  select id into v_org from public.organizaciones where codigo = 3;
  if v_org is null then
    raise exception 'No existe la organización 3. Créala en Catálogos · Geografía · Organizaciones y vuelve a ejecutar este script.';
  end if;
  select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = 2;
  if v_loc is null then
    raise exception 'La organización 3 no tiene la localidad 2 (3-02). Créala en Organizaciones y vuelve a ejecutar este script.';
  end if;

  if exists (select 1 from public.catalogos_cuentas k join public.cuentas x on x.catalogo_id = k.id
             where k.localidad_id = v_loc and x.codigo = '611117' and x.nombre = 'GASTOS BANCARIOS'
               and exists (select 1 from public.cuentas y where y.catalogo_id = k.id and y.codigo = '111101' and y.nombre = 'BANCOS MZ.')) then
    raise notice 'La localidad 3-02 ya tiene la nomenclatura de Mavalsa: no se vuelve a cargar.';
    return;
  end if;

  create temporary table mavalsa (codigo text primary key, nombre text not null, integra boolean not null, tipo integer not null) on commit drop;
  insert into mavalsa (codigo, nombre, integra, tipo) values
    ('1', 'ACTIVO', true, 1),
    ('11', 'CORTO PLAZO', true, 1),
    ('1111', 'BANCOS', true, 1),
    ('111101', 'BANCOS MZ.', false, 1),
    ('111103', 'Caja Chica', false, 1),
    ('1112', 'CUENTAS POR COBRAR', true, 1),
    ('111201', 'Clientes', false, 1),
    ('12', 'LARGO PLAZO', true, 1),
    ('1211', 'PROPIEDAD PLANTA Y EQUIPO', true, 1),
    ('121101', 'Vehiculos', false, 1),
    ('121102', 'Equipo', false, 1),
    ('121199', 'Depreciacion Acumulada', false, 1),
    ('1213', 'OTROS ACTIVOS', true, 1),
    ('121301', 'Gastos Anticipados', false, 1),
    ('2', 'PASIVO', true, 2),
    ('21', 'CORTO PLAZO', true, 2),
    ('2111', 'CUENTAS POR PAGAR', true, 2),
    ('211101', 'Proveedor MZ', false, 2),
    ('211102', 'Cuentas por pagar', false, 2),
    ('211103', 'Tarjeta MZ', false, 2),
    ('211104', 'Salarios por pagar', false, 2),
    ('211105', 'Prestaciones Laborales por pagar', false, 2),
    ('211106', 'IGSS por pagar', false, 2),
    ('211107', 'IVA por pagar', false, 2),
    ('211108', 'ISR por pagar', false, 2),
    ('22', 'LARGO PLAZO', true, 2),
    ('2211', 'Prestamos Bancarios', true, 2),
    ('221101', 'Prestamos Bancarios', false, 2),
    ('3', 'CAPITAL Y RESERVAS', true, 3),
    ('31', 'CAPITAL', true, 3),
    ('3111', 'Capital pagado', false, 3),
    ('32', 'RESERVAS', true, 3),
    ('3211', 'RESULTADOS', true, 3),
    ('321101', 'Resultados acumulados', false, 3),
    ('321102', 'Resultado del Periodo', false, 3),
    ('4', 'VENTAS Y SERVICIOS', true, 4),
    ('41', 'VENTAS', true, 4),
    ('4111', 'VENTAS', true, 4),
    ('411200', 'SERVICIOS', false, 4),
    ('411201', 'Servicios de Transporte', false, 4),
    ('6', 'GASTOS', true, 6),
    ('61', 'GASTOS DE OPERACIÓN', true, 6),
    ('6111', 'GASTOS DE OPERACIÓN', true, 6),
    ('611101', 'Salarios', false, 6),
    ('611102', 'Bonificaciones', false, 6),
    ('611103', 'Prestaciones Laborales', false, 6),
    ('611104', 'Cuotas IGSS', false, 6),
    ('611105', 'Combustibles y Lubricantes', false, 6),
    ('611106', 'Mantenimientos', false, 6),
    ('611107', 'Seguros', false, 6),
    ('611108', 'Depreciaciones', false, 6),
    ('611109', 'Telecomunicaciones', false, 6),
    ('611110', 'Parqueos y Peajes', false, 6),
    ('611111', 'Materiales y utensilios', false, 6),
    ('611112', 'Servicios de fletes', false, 6),
    ('611113', 'Servicios contratados', false, 6),
    ('611114', 'Impuestos y Contirbuciones', false, 6),
    ('611115', 'OTROS GASTOS', false, 6),
    ('611116', 'SERVICIOS DE COMPUTO', false, 6),
    ('611117', 'GASTOS BANCARIOS', false, 6);

  v_version := coalesce((select max(version) from public.catalogos_cuentas where localidad_id = v_loc), 0) + 1;
  insert into public.catalogos_cuentas (organizacion_id, localidad_id, version, fecha_del)
  values (v_org, v_loc, v_version, current_date) returning id into v_cat;

  -- En orden de código más corto a más largo, para que cada cuenta encuentre a su cuenta mayor.
  for c in select * from mavalsa order by length(codigo), codigo loop
    insert into public.cuentas (catalogo_id, codigo, nombre, cuenta_mayor_id, tipo_cuenta_id, integra)
    values (v_cat, c.codigo, c.nombre,
            (select x.id from public.cuentas x
             where x.catalogo_id = v_cat and length(x.codigo) < length(c.codigo) and c.codigo like x.codigo || '%'
             order by length(x.codigo) desc limit 1),
            (select t.id from public.tipos_cuenta t where t.codigo = c.tipo),
            c.integra);
  end loop;

  raise notice 'Nomenclatura de Mavalsa cargada en la localidad 3-02, versión %: % cuentas.',
    v_version, (select count(*) from public.cuentas where catalogo_id = v_cat);
end;
$$;
