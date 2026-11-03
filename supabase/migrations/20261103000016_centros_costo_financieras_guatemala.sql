-- Estructura estándar de centros de costo para empresas financieras de Guatemala (bancos,
-- financieras y sociedades de crédito), para la organización 1 · localidad 1-01.
-- Sigue el diseño del catálogo: códigos de 2 dígitos por nivel (1 → 101 → 10101), cada centro
-- dentro de su centro mayor; los centros que agrupan llevan Integración = Sí.
-- Incluye las áreas que exige la regulación de la SIB: gestión integral de riesgos
-- (JM-56-2011), cumplimiento / prevención de lavado de dinero (IVE) y auditoría interna.
-- Se carga en la versión activa más reciente del catálogo de centros de esa localidad (si no hay,
-- se crea la versión 1). Puede ejecutarse de nuevo: no duplica centros que ya existan.

do $$
declare
  v_org bigint;
  v_loc bigint;
  v_cat bigint;
begin
  select id into v_org from public.organizaciones where codigo = 1;
  select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = 1;
  if v_loc is null then
    raise exception 'No existe la organización 1 con su localidad 1-01. Créala en Catálogos · Organizaciones y vuelve a ejecutar este script.';
  end if;

  select id into v_cat from public.catalogos_centros
  where localidad_id = v_loc and activo order by version desc limit 1;
  if v_cat is null then
    insert into public.catalogos_centros (organizacion_id, localidad_id, version, fecha_del)
    values (v_org, v_loc, coalesce((select max(version) from public.catalogos_centros where localidad_id = v_loc), 0) + 1, current_date)
    returning id into v_cat;
  end if;

  create temporary table estructura (codigo text primary key, nombre text not null) on commit drop;
  insert into estructura (codigo, nombre) values
    ('1',     'DIRECCIÓN Y ADMINISTRACIÓN'),
    ('101',   'ASAMBLEA DE ACCIONISTAS Y JUNTA DIRECTIVA'),
    ('102',   'GERENCIA GENERAL'),
    ('103',   'ADMINISTRACIÓN'),
    ('10301', 'RECURSOS HUMANOS'),
    ('10302', 'SERVICIOS GENERALES Y MANTENIMIENTO'),
    ('10303', 'COMPRAS Y PROVEEDURÍA'),
    ('10304', 'SEGURIDAD FÍSICA'),
    ('104',   'FINANZAS'),
    ('10401', 'CONTABILIDAD'),
    ('10402', 'TESORERÍA'),
    ('10403', 'PRESUPUESTO Y CONTROL DE GESTIÓN'),
    ('10404', 'IMPUESTOS'),
    ('105',   'TECNOLOGÍA DE LA INFORMACIÓN'),
    ('10501', 'DESARROLLO DE SISTEMAS'),
    ('10502', 'INFRAESTRUCTURA Y SOPORTE TÉCNICO'),
    ('10503', 'SEGURIDAD DE LA INFORMACIÓN'),
    ('2',     'NEGOCIOS'),
    ('201',   'BANCA DE PERSONAS'),
    ('20101', 'CRÉDITOS DE CONSUMO'),
    ('20102', 'TARJETAS DE CRÉDITO'),
    ('20103', 'CRÉDITOS HIPOTECARIOS PARA VIVIENDA'),
    ('20104', 'MICROCRÉDITOS'),
    ('202',   'BANCA EMPRESARIAL'),
    ('20201', 'CRÉDITOS CORPORATIVOS'),
    ('20202', 'CRÉDITOS PYME'),
    ('20203', 'ARRENDAMIENTO Y FACTORAJE'),
    ('203',   'CAPTACIÓN'),
    ('20301', 'DEPÓSITOS MONETARIOS'),
    ('20302', 'DEPÓSITOS DE AHORRO'),
    ('20303', 'DEPÓSITOS A PLAZO E INVERSIONES'),
    ('204',   'MERCADEO Y CANALES'),
    ('20401', 'MERCADEO Y PUBLICIDAD'),
    ('20402', 'BANCA ELECTRÓNICA Y MÓVIL'),
    ('20403', 'AGENTES BANCARIOS'),
    ('205',   'REMESAS FAMILIARES Y SERVICIOS'),
    ('3',     'OPERACIONES'),
    ('301',   'OPERACIONES CENTRALES'),
    ('30101', 'COMPENSACIÓN Y TRANSFERENCIAS'),
    ('30102', 'CUSTODIA Y VALORES'),
    ('302',   'RED DE AGENCIAS'),
    ('30201', 'AGENCIA CENTRAL'),
    ('30202', 'AGENCIAS METROPOLITANAS'),
    ('30203', 'AGENCIAS DEPARTAMENTALES'),
    ('303',   'CRÉDITOS Y COBROS'),
    ('30301', 'ANÁLISIS Y APROBACIÓN DE CRÉDITOS'),
    ('30302', 'DESEMBOLSOS Y GARANTÍAS'),
    ('30303', 'COBRANZA ADMINISTRATIVA'),
    ('30304', 'COBRO JUDICIAL'),
    ('304',   'CENTRO DE ATENCIÓN AL CLIENTE'),
    ('4',     'RIESGO, CONTROL Y CUMPLIMIENTO'),
    ('401',   'GESTIÓN INTEGRAL DE RIESGOS'),
    ('40101', 'RIESGO DE CRÉDITO'),
    ('40102', 'RIESGO DE LIQUIDEZ Y DE MERCADO'),
    ('40103', 'RIESGO OPERACIONAL Y TECNOLÓGICO'),
    ('402',   'CUMPLIMIENTO Y PREVENCIÓN DE LAVADO DE DINERO'),
    ('403',   'AUDITORÍA INTERNA'),
    ('404',   'ASESORÍA JURÍDICA'),
    ('405',   'ATENCIÓN DE REQUERIMIENTOS DE LA SIB');

  -- Nivel por nivel, para que cada centro encuentre a su centro mayor (código sin los 2 últimos dígitos).
  for i in 1..(select max(length(codigo)) from estructura) loop
    insert into public.centros_costo (catalogo_id, organizacion_id, codigo, nombre, centro_mayor_id, integra, vigente)
    select v_cat, v_org, e.codigo, e.nombre,
           (select c.id from public.centros_costo c where c.catalogo_id = v_cat and c.codigo = left(e.codigo, length(e.codigo) - 2)),
           exists (select 1 from estructura h where h.codigo like e.codigo || '__'),
           true
    from estructura e
    where length(e.codigo) = i
    on conflict (catalogo_id, codigo) do nothing;
  end loop;

  raise notice 'Centros de costo cargados en la versión %: % en total.',
    (select version from public.catalogos_centros where id = v_cat),
    (select count(*) from public.centros_costo where catalogo_id = v_cat);
end;
$$;
