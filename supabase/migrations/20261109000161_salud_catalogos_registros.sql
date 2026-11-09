-- Hospital y Clínicas médicas · etapa 1: catálogos y registros clínicos de un hospital o clínica de primer nivel.
-- Catálogos (med_ compartidos, hos_ del hospital, cli_ de la clínica): procedimientos CIE-9-MC, paquetes quirúrgicos
-- de precio cerrado, kits por procedimiento, pruebas y perfiles de laboratorio con valores de referencia, estudios de
-- imagen, planes de aseguradora, empresas con convenio, médicos referentes, formulario terapéutico y controlados,
-- dietas, salas de operaciones, personal de enfermería y esquema de vacunación.
-- Registros: triaje de emergencia, notas de evolución y enfermería, kardex de medicamentos, resultados de laboratorio,
-- informes de imagen, hoja quirúrgica con lista de verificación OMS, consentimientos, partos y recién nacidos,
-- defunciones, epicrisis, cotizaciones, cartas de garantía, controles (prenatal y niño sano) y vacunación.

-- ============ Catálogos ============
create table if not exists public.med_procedimientos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo text not null, descripcion text not null, tipo text not null default 'QUIRÚRGICO' check (tipo in ('QUIRÚRGICO', 'DIAGNÓSTICO', 'TERAPÉUTICO', 'OBSTÉTRICO', 'MENOR')),
  especialidad_id bigint references public.hos_especialidades (id), tiempo_min integer not null default 60, precio numeric(12, 2) not null default 0, requiere_consentimiento boolean not null default true, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.hos_paquetes_qx (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo integer not null, nombre text not null, procedimiento_id bigint references public.med_procedimientos (id), dias_estancia integer not null default 1, tipo_cama text not null default 'PRIVADA',
  precio numeric(12, 2) not null default 0, honorario_cirujano numeric(12, 2) not null default 0, honorario_anestesia numeric(12, 2) not null default 0, incluye text, excluye text, vigente_hasta date, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.med_kits (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo integer not null, nombre text not null, procedimiento_id bigint references public.med_procedimientos (id), activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.med_kit_items (
  id bigint generated always as identity primary key, kit_id bigint not null references public.med_kits (id) on delete cascade,
  producto_id bigint, descripcion text not null, cantidad numeric(12, 3) not null default 1 check (cantidad > 0), cobrable boolean not null default true
);
create table if not exists public.lab_pruebas (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo text not null, nombre text not null, area text not null default 'QUÍMICA' check (area in ('HEMATOLOGÍA', 'QUÍMICA', 'ORINA', 'HECES', 'INMUNOLOGÍA', 'HORMONAS', 'MICROBIOLOGÍA', 'COAGULACIÓN', 'OTRA')),
  unidad text, ref_min numeric(14, 4), ref_max numeric(14, 4), ref_texto text, critico_min numeric(14, 4), critico_max numeric(14, 4), muestra text, tiempo_horas integer not null default 24,
  precio numeric(12, 2) not null default 0, es_perfil boolean not null default false, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.lab_perfil_pruebas (
  id bigint generated always as identity primary key, perfil_id bigint not null references public.lab_pruebas (id) on delete cascade, prueba_id bigint not null references public.lab_pruebas (id) on delete cascade, unique (perfil_id, prueba_id)
);
create table if not exists public.img_estudios (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo text not null, nombre text not null, modalidad text not null default 'RAYOS X' check (modalidad in ('RAYOS X', 'ULTRASONIDO', 'TOMOGRAFÍA', 'RESONANCIA', 'MAMOGRAFÍA', 'DENSITOMETRÍA', 'FLUOROSCOPÍA', 'OTRA')),
  preparacion text, plantilla text, precio numeric(12, 2) not null default 0, tiempo_horas integer not null default 24, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.med_planes (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  aseguradora_id bigint not null references public.hos_aseguradoras (id) on delete cascade, nombre text not null, deducible numeric(12, 2) not null default 0, coaseguro_pct numeric(6, 2) not null default 0,
  tope_anual numeric(14, 2), copago_consulta numeric(12, 2) not null default 0, requiere_preautorizacion boolean not null default true, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.med_convenios (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  empresa text not null, nit text, contacto text, telefono text, descuento_pct numeric(6, 2) not null default 0, dias_credito integer not null default 30, vigente_hasta date, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.med_referentes (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  nombre text not null, colegiado text, especialidad text, telefono text, comision_pct numeric(6, 2) not null default 0, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.far_formulario (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  producto_id bigint, nombre text not null, grupo text not null default 'GENERAL', controlado boolean not null default false,
  clase_control text check (clase_control in ('PSICOTRÓPICO', 'ESTUPEFACIENTE', 'PRECURSOR')), requiere_receta boolean not null default true, stock_minimo numeric(12, 3) not null default 0, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.hos_dietas (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo integer not null, nombre text not null, descripcion text, precio_dia numeric(12, 2) not null default 0, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.hos_salas (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo text not null, nombre text not null, tipo text not null default 'QUIRÓFANO' check (tipo in ('QUIRÓFANO', 'SALA DE PARTOS', 'PROCEDIMIENTOS', 'ENDOSCOPÍA', 'RECUPERACIÓN')),
  tarifa_hora numeric(12, 2) not null default 0, estado text not null default 'DISPONIBLE' check (estado in ('DISPONIBLE', 'OCUPADA', 'LIMPIEZA', 'MANTENIMIENTO')), activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.hos_personal (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  nombre text not null, cargo text not null default 'ENFERMERA(O) AUXILIAR' check (cargo in ('ENFERMERA(O) PROFESIONAL', 'ENFERMERA(O) AUXILIAR', 'INSTRUMENTISTA', 'TÉCNICO DE LABORATORIO', 'TÉCNICO DE RAYOS X', 'QUÍMICO BIÓLOGO', 'QUÍMICO FARMACÉUTICO', 'CAMILLERO', 'NUTRICIONISTA', 'OTRO')),
  area_id bigint references public.hos_areas (id), turno text not null default 'MAÑANA' check (turno in ('MAÑANA', 'TARDE', 'NOCHE', 'ROTATIVO')), registro text, telefono text, empleado_id bigint, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.cli_vacunas (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo text not null, nombre text not null, dosis text not null, edad_meses integer, via text, producto_id bigint, precio numeric(12, 2) not null default 0, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);

-- ============ Registros ============
create table if not exists public.hos_triaje (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, paciente_id bigint references public.hos_pacientes (id), nombre_provisional text, llegada timestamptz not null default now(),
  prioridad integer not null default 3 check (prioridad between 1 and 5), motivo text not null, presion text, frecuencia_cardiaca integer, temperatura numeric(4, 1), saturacion integer, glasgow integer, dolor integer,
  medico_id bigint references public.hos_medicos (id), atencion timestamptz, destino text check (destino in ('ALTA', 'OBSERVACIÓN', 'HOSPITALIZACIÓN', 'CIRUGÍA', 'REFERENCIA', 'FALLECIDO', 'FUGA')), salida timestamptz,
  admision_id bigint references public.hos_admisiones (id), diagnostico text, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.hos_notas (
  id bigint generated always as identity primary key, admision_id bigint not null references public.hos_admisiones (id) on delete cascade, tipo text not null default 'EVOLUCIÓN' check (tipo in ('EVOLUCIÓN', 'ENFERMERÍA', 'INTERCONSULTA', 'NUTRICIÓN')),
  fecha timestamptz not null default now(), turno text check (turno in ('MAÑANA', 'TARDE', 'NOCHE')), presion text, frecuencia_cardiaca integer, frecuencia_respiratoria integer, temperatura numeric(4, 1), saturacion integer, glucosa numeric(6, 1),
  ingesta_ml numeric(8, 1), excreta_ml numeric(8, 1), dieta_id bigint references public.hos_dietas (id), texto text not null, autor text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.hos_kardex (
  id bigint generated always as identity primary key, admision_id bigint not null references public.hos_admisiones (id) on delete cascade, orden_id bigint references public.hos_ordenes (id) on delete set null,
  medicamento text not null, dosis text, via text, programada timestamptz not null, estado text not null default 'PROGRAMADA' check (estado in ('PROGRAMADA', 'ADMINISTRADA', 'OMITIDA', 'SUSPENDIDA')),
  administrada timestamptz, responsable text, observacion text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.lab_resultados (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, paciente_id bigint not null references public.hos_pacientes (id), origen text not null default 'CLÍNICA' check (origen in ('HOSPITAL', 'CLÍNICA', 'EMERGENCIA', 'EXTERNO')),
  admision_id bigint references public.hos_admisiones (id), consulta_id bigint references public.cli_consultas (id), medico_id bigint references public.hos_medicos (id),
  toma timestamptz not null default now(), entrega timestamptz, estado text not null default 'EN PROCESO' check (estado in ('EN PROCESO', 'VALIDADO', 'ENTREGADO', 'ANULADO')), validado_por text, observaciones text, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.lab_resultado_lineas (
  id bigint generated always as identity primary key, resultado_id bigint not null references public.lab_resultados (id) on delete cascade, prueba_id bigint not null references public.lab_pruebas (id),
  valor text, valor_num numeric(14, 4), unidad text, referencia text, alerta text check (alerta in ('NORMAL', 'BAJO', 'ALTO', 'CRÍTICO'))
);
create table if not exists public.img_informes (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, paciente_id bigint not null references public.hos_pacientes (id), estudio_id bigint not null references public.img_estudios (id), origen text not null default 'CLÍNICA' check (origen in ('HOSPITAL', 'CLÍNICA', 'EMERGENCIA', 'EXTERNO')),
  admision_id bigint references public.hos_admisiones (id), consulta_id bigint references public.cli_consultas (id), medico_solicita_id bigint references public.hos_medicos (id), radiologo_id bigint references public.hos_medicos (id),
  fecha timestamptz not null default now(), hallazgos text, conclusion text, estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'INFORMADO', 'ENTREGADO', 'ANULADO')), usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.hos_cirugias (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, quirofano_id bigint references public.hos_quirofanos (id), admision_id bigint references public.hos_admisiones (id), paciente_id bigint not null references public.hos_pacientes (id),
  sala_id bigint references public.hos_salas (id), procedimiento_id bigint references public.med_procedimientos (id), procedimiento_texto text, fecha date not null default current_date,
  cirujano_id bigint references public.hos_medicos (id), ayudante_id bigint references public.hos_medicos (id), anestesiologo_id bigint references public.hos_medicos (id), instrumentista text, circulante text,
  tipo_anestesia text check (tipo_anestesia in ('GENERAL', 'RAQUÍDEA', 'EPIDURAL', 'BLOQUEO', 'LOCAL', 'SEDACIÓN')), asa text check (asa in ('I', 'II', 'III', 'IV', 'V', 'VI')),
  clasificacion text not null default 'ELECTIVA' check (clasificacion in ('ELECTIVA', 'URGENCIA', 'EMERGENCIA')), herida text check (herida in ('LIMPIA', 'LIMPIA-CONTAMINADA', 'CONTAMINADA', 'SUCIA')),
  checklist jsonb not null default '{}'::jsonb, ingreso_sala timestamptz, inicio_anestesia timestamptz, incision timestamptz, cierre timestamptz, salida_sala timestamptz,
  diagnostico_pre text, diagnostico_post text, hallazgos text, protocolo text, complicaciones text, sangrado_ml integer, conteo_completo boolean, muestras_patologia boolean not null default false,
  estado text not null default 'EN CURSO' check (estado in ('EN CURSO', 'TERMINADA', 'SUSPENDIDA')), usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.med_consentimientos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, paciente_id bigint not null references public.hos_pacientes (id), procedimiento_id bigint references public.med_procedimientos (id), procedimiento_texto text,
  tipo text not null default 'QUIRÚRGICO' check (tipo in ('QUIRÚRGICO', 'ANESTÉSICO', 'TRANSFUSIÓN', 'PROCEDIMIENTO', 'ALTA VOLUNTARIA', 'HOSPITALIZACIÓN')),
  medico_id bigint references public.hos_medicos (id), riesgos text, alternativas text, firmante text not null, parentesco text, dpi_firmante text, testigo text, fecha date not null default current_date,
  admision_id bigint references public.hos_admisiones (id), consulta_id bigint references public.cli_consultas (id), usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.hos_partos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, admision_id bigint references public.hos_admisiones (id), madre_id bigint not null references public.hos_pacientes (id), fecha_hora timestamptz not null default now(),
  tipo text not null default 'EUTÓCICO' check (tipo in ('EUTÓCICO', 'DISTÓCICO', 'CESÁREA', 'INSTRUMENTADO')), semanas_gestacion integer, gesta integer, para integer,
  rn_sexo text check (rn_sexo in ('M', 'F', 'I')), rn_peso_g integer, rn_talla_cm numeric(5, 1), apgar_1 integer check (apgar_1 between 0 and 10), apgar_5 integer check (apgar_5 between 0 and 10),
  rn_condicion text not null default 'VIVO' check (rn_condicion in ('VIVO', 'MORTINATO', 'FALLECIDO')), rn_paciente_id bigint references public.hos_pacientes (id), medico_id bigint references public.hos_medicos (id),
  complicaciones text, observaciones text, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.hos_defunciones (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, paciente_id bigint not null references public.hos_pacientes (id), admision_id bigint references public.hos_admisiones (id), fecha_hora timestamptz not null default now(),
  causa_directa text, causa_intermedia text, causa_basica_codigo text, causa_basica text not null, contribuyentes text, menos_48h boolean not null default false, necropsia boolean not null default false,
  medico_id bigint references public.hos_medicos (id), certificado text, observaciones text, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.hos_epicrisis (
  id bigint generated always as identity primary key, admision_id bigint not null unique references public.hos_admisiones (id) on delete cascade,
  motivo_ingreso text, resumen text, procedimientos text, diagnostico_ingreso text, diagnostico_egreso text, diagnostico_codigo text, condicion_egreso text check (condicion_egreso in ('MEJORADO', 'CURADO', 'IGUAL', 'EMPEORADO', 'FALLECIDO', 'TRASLADADO')),
  tratamiento_egreso text, recomendaciones text, control text, medico_id bigint references public.hos_medicos (id), usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.med_cotizaciones (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, paciente_id bigint references public.hos_pacientes (id), nombre text not null, fecha date not null default current_date, vigencia_dias integer not null default 15,
  paquete_id bigint references public.hos_paquetes_qx (id), procedimiento_id bigint references public.med_procedimientos (id), aseguradora_id bigint references public.hos_aseguradoras (id), detalle jsonb not null default '[]'::jsonb,
  total numeric(14, 2) not null default 0, estado text not null default 'EMITIDA' check (estado in ('EMITIDA', 'ACEPTADA', 'RECHAZADA', 'VENCIDA')), observaciones text, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.med_garantias (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, paciente_id bigint not null references public.hos_pacientes (id), aseguradora_id bigint not null references public.hos_aseguradoras (id), plan_id bigint references public.med_planes (id),
  admision_id bigint references public.hos_admisiones (id), cotizacion_id bigint references public.med_cotizaciones (id), procedimiento text, diagnostico text, fecha_solicitud date not null default current_date,
  monto_solicitado numeric(14, 2) not null default 0, monto_autorizado numeric(14, 2), autorizacion text, vence date,
  estado text not null default 'SOLICITADA' check (estado in ('SOLICITADA', 'AUTORIZADA', 'PARCIAL', 'RECHAZADA', 'VENCIDA', 'UTILIZADA')), observaciones text, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.cli_controles (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  paciente_id bigint not null references public.hos_pacientes (id), tipo text not null check (tipo in ('PRENATAL', 'NIÑO SANO', 'CRÓNICO')), fecha date not null default current_date, consulta_id bigint references public.cli_consultas (id),
  semanas_gestacion integer, edad_meses integer, peso_kg numeric(6, 2), talla_cm numeric(6, 1), perimetro_cefalico numeric(5, 1), presion text, altura_uterina numeric(5, 1), fcf integer, glucosa numeric(6, 1),
  observaciones text, proximo date, medico_id bigint references public.hos_medicos (id),
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.cli_vacunacion (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  paciente_id bigint not null references public.hos_pacientes (id), vacuna_id bigint not null references public.cli_vacunas (id), fecha date not null default current_date, lote text, aplicada_por text, proxima date, observaciones text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);

-- ============ Reglas ============
create or replace function public.med_numerar() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(4814, new.localidad_id::integer);
  execute format('select coalesce(max(numero), 0) + 1 from public.%I where localidad_id = $1', tg_table_name) into new.numero using new.localidad_id;
  new.usuario := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  return new;
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['hos_triaje', 'lab_resultados', 'img_informes', 'hos_cirugias', 'med_consentimientos', 'hos_partos', 'hos_defunciones', 'med_cotizaciones', 'med_garantias'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_numerar', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.med_numerar()', t || '_numerar', t);
  end loop;
end;
$$;
-- Resultado de laboratorio: alerta según los valores de referencia y críticos de la prueba.
create or replace function public.lab_alerta() returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.lab_pruebas; v numeric;
begin
  select * into p from public.lab_pruebas where id = new.prueba_id;
  new.unidad := coalesce(new.unidad, p.unidad);
  new.referencia := coalesce(new.referencia, p.ref_texto, case when p.ref_min is not null or p.ref_max is not null then coalesce(trim_scale(p.ref_min)::text, '') || ' - ' || coalesce(trim_scale(p.ref_max)::text, '') end);
  begin v := replace(trim(new.valor), ',', '.')::numeric; exception when others then v := null; end;
  new.valor_num := v;
  new.alerta := case when v is null then case when nullif(trim(coalesce(new.valor, '')), '') is null then null else 'NORMAL' end when (p.critico_min is not null and v < p.critico_min) or (p.critico_max is not null and v > p.critico_max) then 'CRÍTICO'
                     when p.ref_min is not null and v < p.ref_min then 'BAJO' when p.ref_max is not null and v > p.ref_max then 'ALTO' else 'NORMAL' end;
  return new;
end;
$$;
drop trigger if exists lab_resultado_lineas_alerta on public.lab_resultado_lineas;
create trigger lab_resultado_lineas_alerta before insert or update on public.lab_resultado_lineas for each row execute function public.lab_alerta();
-- Kardex: al administrar queda la hora y el responsable.
create or replace function public.hos_kardex_preparar() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'ADMINISTRADA' and new.administrada is null then new.administrada := now(); end if;
  if new.estado in ('ADMINISTRADA', 'OMITIDA') and new.responsable is null then new.responsable := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA'); end if;
  return new;
end;
$$;
drop trigger if exists hos_kardex_preparar on public.hos_kardex;
create trigger hos_kardex_preparar before insert or update on public.hos_kardex for each row execute function public.hos_kardex_preparar();

-- Catálogos iniciales de cada empresa.
create or replace function public.med_asegurar_catalogos(p_localidad bigint) returns void language plpgsql security definer set search_path = '' as $$
declare v_org bigint := (select organizacion_id from public.localidades where id = p_localidad);
begin
  perform public.hos_asegurar_catalogos(p_localidad);
  insert into public.med_procedimientos (organizacion_id, localidad_id, codigo, descripcion, tipo, tiempo_min, precio) select v_org, p_localidad, x.c, x.d, x.t, x.m, x.p from (values
    ('47.09', 'APENDICECTOMÍA', 'QUIRÚRGICO', 60, 9000), ('47.01', 'APENDICECTOMÍA LAPAROSCÓPICA', 'QUIRÚRGICO', 75, 12000), ('51.23', 'COLECISTECTOMÍA LAPAROSCÓPICA', 'QUIRÚRGICO', 90, 15000),
    ('53.00', 'HERNIORRAFIA INGUINAL', 'QUIRÚRGICO', 60, 8000), ('53.49', 'HERNIORRAFIA UMBILICAL', 'QUIRÚRGICO', 45, 7000), ('74.1', 'CESÁREA SEGMENTARIA', 'OBSTÉTRICO', 60, 10000),
    ('73.59', 'PARTO EUTÓCICO', 'OBSTÉTRICO', 45, 5000), ('68.49', 'HISTERECTOMÍA ABDOMINAL', 'QUIRÚRGICO', 120, 16000), ('69.09', 'LEGRADO UTERINO', 'MENOR', 30, 3500),
    ('66.32', 'SALPINGECTOMÍA BILATERAL (ESTERILIZACIÓN)', 'QUIRÚRGICO', 45, 6000), ('63.73', 'VASECTOMÍA', 'MENOR', 30, 2500), ('64.0', 'CIRCUNCISIÓN', 'MENOR', 30, 2500),
    ('79.36', 'REDUCCIÓN ABIERTA CON FIJACIÓN INTERNA DE FRACTURA', 'QUIRÚRGICO', 120, 18000), ('79.0', 'REDUCCIÓN CERRADA DE FRACTURA', 'MENOR', 30, 3000), ('81.54', 'ARTROPLASTIA TOTAL DE RODILLA', 'QUIRÚRGICO', 150, 45000),
    ('80.6', 'MENISCECTOMÍA ARTROSCÓPICA', 'QUIRÚRGICO', 60, 14000), ('28.3', 'AMIGDALECTOMÍA CON ADENOIDECTOMÍA', 'QUIRÚRGICO', 45, 7000), ('21.5', 'SEPTOPLASTIA', 'QUIRÚRGICO', 60, 9000),
    ('13.41', 'FACOEMULSIFICACIÓN DE CATARATA', 'QUIRÚRGICO', 30, 9000), ('86.04', 'DRENAJE DE ABSCESO', 'MENOR', 20, 1200), ('86.3', 'EXCÉRESIS DE LESIÓN DE PIEL', 'MENOR', 30, 1500),
    ('86.59', 'SUTURA DE HERIDA', 'MENOR', 20, 600), ('45.13', 'ENDOSCOPÍA DIGESTIVA ALTA', 'DIAGNÓSTICO', 20, 2500), ('45.23', 'COLONOSCOPÍA', 'DIAGNÓSTICO', 40, 3500),
    ('88.72', 'ECOCARDIOGRAMA', 'DIAGNÓSTICO', 30, 1200), ('89.52', 'ELECTROCARDIOGRAMA', 'DIAGNÓSTICO', 10, 250), ('96.04', 'INTUBACIÓN ENDOTRAQUEAL', 'TERAPÉUTICO', 10, 800),
    ('38.93', 'COLOCACIÓN DE CATÉTER VENOSO CENTRAL', 'TERAPÉUTICO', 20, 1500), ('99.04', 'TRANSFUSIÓN DE CONCENTRADO DE ERITROCITOS', 'TERAPÉUTICO', 60, 900), ('34.04', 'COLOCACIÓN DE SONDA PLEURAL', 'TERAPÉUTICO', 30, 2000)) x(c, d, t, m, p)
    on conflict (localidad_id, codigo) do nothing;
  insert into public.lab_pruebas (organizacion_id, localidad_id, codigo, nombre, area, unidad, ref_min, ref_max, ref_texto, critico_min, critico_max, muestra, precio) select v_org, p_localidad, x.* from (values
    ('HB', 'Hemoglobina', 'HEMATOLOGÍA', 'g/dL', 12::numeric, 17.5::numeric, null, 7::numeric, 20::numeric, 'SANGRE EDTA', 30::numeric), ('HTO', 'Hematocrito', 'HEMATOLOGÍA', '%', 36, 52, null, 20, 60, 'SANGRE EDTA', 30),
    ('GB', 'Glóbulos blancos', 'HEMATOLOGÍA', '/mm³', 4500, 11000, null, 2000, 30000, 'SANGRE EDTA', 30), ('PLT', 'Plaquetas', 'HEMATOLOGÍA', '/mm³', 150000, 450000, null, 50000, 1000000, 'SANGRE EDTA', 30),
    ('HEMA', 'Hematología completa', 'HEMATOLOGÍA', null, null, null, 'Perfil', null, null, 'SANGRE EDTA', 100), ('VS', 'Velocidad de sedimentación', 'HEMATOLOGÍA', 'mm/h', 0, 20, null, null, null, 'SANGRE EDTA', 40),
    ('GLU', 'Glucosa en ayunas', 'QUÍMICA', 'mg/dL', 70, 100, null, 40, 400, 'SUERO', 40), ('HBA1C', 'Hemoglobina glicosilada', 'QUÍMICA', '%', 4, 5.6, null, null, null, 'SANGRE EDTA', 150),
    ('CREA', 'Creatinina', 'QUÍMICA', 'mg/dL', 0.6, 1.3, null, null, 5, 'SUERO', 50), ('BUN', 'Nitrógeno de urea', 'QUÍMICA', 'mg/dL', 7, 20, null, null, 100, 'SUERO', 50),
    ('AU', 'Ácido úrico', 'QUÍMICA', 'mg/dL', 3.5, 7.2, null, null, null, 'SUERO', 50), ('COL', 'Colesterol total', 'QUÍMICA', 'mg/dL', null, 200, null, null, null, 'SUERO', 50),
    ('TG', 'Triglicéridos', 'QUÍMICA', 'mg/dL', null, 150, null, null, null, 'SUERO', 50), ('HDL', 'Colesterol HDL', 'QUÍMICA', 'mg/dL', 40, null, null, null, null, 'SUERO', 60),
    ('LDL', 'Colesterol LDL', 'QUÍMICA', 'mg/dL', null, 130, null, null, null, 'SUERO', 60), ('LIP', 'Perfil de lípidos', 'QUÍMICA', null, null, null, 'Perfil', null, null, 'SUERO', 180),
    ('TGO', 'Transaminasa oxalacética (AST)', 'QUÍMICA', 'U/L', 0, 40, null, null, null, 'SUERO', 50), ('TGP', 'Transaminasa pirúvica (ALT)', 'QUÍMICA', 'U/L', 0, 41, null, null, null, 'SUERO', 50),
    ('NA', 'Sodio', 'QUÍMICA', 'mEq/L', 135, 145, null, 120, 160, 'SUERO', 60), ('K', 'Potasio', 'QUÍMICA', 'mEq/L', 3.5, 5.1, null, 2.5, 6.5, 'SUERO', 60),
    ('TSH', 'Hormona estimulante de tiroides', 'HORMONAS', 'µUI/mL', 0.4, 4.0, null, null, null, 'SUERO', 150), ('BHCG', 'Prueba de embarazo en sangre', 'HORMONAS', null, null, null, 'Negativo', null, null, 'SUERO', 120),
    ('ORI', 'Orina completa', 'ORINA', null, null, null, 'Ver informe', null, null, 'ORINA', 50), ('HEC', 'Heces simple', 'HECES', null, null, null, 'Ver informe', null, null, 'HECES', 40),
    ('PCR', 'Proteína C reactiva', 'INMUNOLOGÍA', 'mg/L', 0, 5, null, null, null, 'SUERO', 120), ('VIH', 'Prueba de VIH', 'INMUNOLOGÍA', null, null, null, 'No reactivo', null, null, 'SUERO', 150),
    ('TP', 'Tiempo de protrombina', 'COAGULACIÓN', 's', 11, 13.5, null, null, 30, 'PLASMA CITRATADO', 80), ('TPT', 'Tiempo parcial de tromboplastina', 'COAGULACIÓN', 's', 25, 35, null, null, 70, 'PLASMA CITRATADO', 80),
    ('UROC', 'Urocultivo', 'MICROBIOLOGÍA', null, null, null, 'Sin crecimiento', null, null, 'ORINA', 200), ('GS', 'Grupo sanguíneo y Rh', 'INMUNOLOGÍA', null, null, null, null, null, null, 'SANGRE EDTA', 50)) x
    on conflict (localidad_id, codigo) do nothing;
  update public.lab_pruebas set es_perfil = true where localidad_id = p_localidad and codigo in ('HEMA', 'LIP');
  insert into public.lab_perfil_pruebas (perfil_id, prueba_id) select pf.id, pr.id from public.lab_pruebas pf join public.lab_pruebas pr on pr.localidad_id = pf.localidad_id
    where pf.localidad_id = p_localidad and ((pf.codigo = 'HEMA' and pr.codigo in ('HB', 'HTO', 'GB', 'PLT')) or (pf.codigo = 'LIP' and pr.codigo in ('COL', 'TG', 'HDL', 'LDL'))) on conflict do nothing;
  insert into public.img_estudios (organizacion_id, localidad_id, codigo, nombre, modalidad, preparacion, precio) select v_org, p_localidad, x.* from (values
    ('RX-TOR', 'RAYOS X DE TÓRAX PA Y LATERAL', 'RAYOS X', null, 300::numeric), ('RX-COL', 'RAYOS X DE COLUMNA LUMBAR', 'RAYOS X', null, 350), ('RX-EXT', 'RAYOS X DE EXTREMIDAD', 'RAYOS X', null, 250),
    ('RX-ABD', 'RAYOS X DE ABDOMEN', 'RAYOS X', null, 300), ('US-ABD', 'ULTRASONIDO ABDOMINAL', 'ULTRASONIDO', 'Ayuno de 8 horas', 500), ('US-PEL', 'ULTRASONIDO PÉLVICO', 'ULTRASONIDO', 'Vejiga llena', 450),
    ('US-OBS', 'ULTRASONIDO OBSTÉTRICO', 'ULTRASONIDO', null, 450), ('US-TIR', 'ULTRASONIDO DE TIROIDES', 'ULTRASONIDO', null, 450), ('US-MAM', 'ULTRASONIDO DE MAMA', 'ULTRASONIDO', null, 500),
    ('TAC-CR', 'TOMOGRAFÍA DE CRÁNEO', 'TOMOGRAFÍA', null, 1800), ('TAC-ABD', 'TOMOGRAFÍA DE ABDOMEN CON CONTRASTE', 'TOMOGRAFÍA', 'Ayuno de 6 horas; creatinina reciente', 3200),
    ('RM-RO', 'RESONANCIA MAGNÉTICA DE RODILLA', 'RESONANCIA', null, 4500), ('MAMO', 'MAMOGRAFÍA BILATERAL', 'MAMOGRAFÍA', 'Sin desodorante ni talco', 600), ('DMO', 'DENSITOMETRÍA ÓSEA', 'DENSITOMETRÍA', null, 650)) x
    on conflict (localidad_id, codigo) do nothing;
  insert into public.hos_dietas (organizacion_id, localidad_id, codigo, nombre, descripcion, precio_dia) select v_org, p_localidad, x.* from (values
    (1, 'NADA POR VÍA ORAL (NPO)', 'Ayuno', 0::numeric), (2, 'LÍQUIDOS CLAROS', 'Agua, té, gelatina, caldos colados', 120), (3, 'LÍQUIDOS COMPLETOS', 'Incluye lácteos y purés', 140), (4, 'BLANDA', 'Fácil digestión', 180),
    (5, 'LIBRE / NORMAL', 'Sin restricciones', 200), (6, 'HIPOSÓDICA', 'Baja en sodio', 200), (7, 'PARA DIABÉTICO', 'Controlada en carbohidratos', 210), (8, 'HIPOGRASA', 'Baja en grasas', 200)) x on conflict (localidad_id, codigo) do nothing;
  insert into public.hos_salas (organizacion_id, localidad_id, codigo, nombre, tipo, tarifa_hora) select v_org, p_localidad, x.* from (values
    ('SOP-1', 'SALA DE OPERACIONES 1', 'QUIRÓFANO', 2000::numeric), ('SOP-2', 'SALA DE OPERACIONES 2', 'QUIRÓFANO', 2000), ('PAR-1', 'SALA DE PARTOS', 'SALA DE PARTOS', 1200), ('REC-1', 'RECUPERACIÓN', 'RECUPERACIÓN', 400)) x on conflict (localidad_id, codigo) do nothing;
  insert into public.cli_vacunas (organizacion_id, localidad_id, codigo, nombre, dosis, edad_meses, via) select v_org, p_localidad, x.* from (values
    ('BCG', 'BCG', 'ÚNICA', 0, 'INTRADÉRMICA'), ('HEPB-0', 'HEPATITIS B', 'RECIÉN NACIDO', 0, 'INTRAMUSCULAR'),
    ('PENTA-1', 'PENTAVALENTE', '1RA', 2, 'INTRAMUSCULAR'), ('PENTA-2', 'PENTAVALENTE', '2DA', 4, 'INTRAMUSCULAR'), ('PENTA-3', 'PENTAVALENTE', '3RA', 6, 'INTRAMUSCULAR'),
    ('POLIO-1', 'POLIO (IPV/OPV)', '1RA', 2, 'ORAL/IM'), ('POLIO-2', 'POLIO (IPV/OPV)', '2DA', 4, 'ORAL/IM'), ('POLIO-3', 'POLIO (IPV/OPV)', '3RA', 6, 'ORAL/IM'),
    ('ROTA-1', 'ROTAVIRUS', '1RA', 2, 'ORAL'), ('ROTA-2', 'ROTAVIRUS', '2DA', 4, 'ORAL'), ('NEUMO-1', 'NEUMOCOCO CONJUGADA', '1RA', 2, 'INTRAMUSCULAR'), ('NEUMO-2', 'NEUMOCOCO CONJUGADA', '2DA', 4, 'INTRAMUSCULAR'),
    ('NEUMO-R', 'NEUMOCOCO CONJUGADA', 'REFUERZO', 12, 'INTRAMUSCULAR'), ('SPR-1', 'SARAMPIÓN, PAPERAS Y RUBÉOLA (SPR)', '1RA', 12, 'SUBCUTÁNEA'), ('SPR-2', 'SARAMPIÓN, PAPERAS Y RUBÉOLA (SPR)', '2DA', 18, 'SUBCUTÁNEA'),
    ('DPT-R1', 'DPT', '1ER REFUERZO', 18, 'INTRAMUSCULAR'), ('DPT-R2', 'DPT', '2DO REFUERZO', 48, 'INTRAMUSCULAR'), ('VPH', 'VIRUS DEL PAPILOMA HUMANO', 'SEGÚN EDAD', 120, 'INTRAMUSCULAR'),
    ('INFL', 'INFLUENZA', 'ANUAL', 6, 'INTRAMUSCULAR'), ('TD', 'TÉTANOS Y DIFTERIA (Td)', 'SEGÚN ESQUEMA', null, 'INTRAMUSCULAR')) x on conflict (localidad_id, codigo) do nothing;
end;
$$;

-- ============ Auditoría, permisos y menú ============
do $$
declare t text;
begin
  foreach t in array array['med_procedimientos', 'hos_paquetes_qx', 'med_kits', 'lab_pruebas', 'img_estudios', 'med_planes', 'med_convenios', 'med_referentes', 'far_formulario', 'hos_dietas', 'hos_salas', 'hos_personal', 'cli_vacunas',
                           'hos_triaje', 'hos_notas', 'hos_kardex', 'lab_resultados', 'img_informes', 'hos_cirugias', 'med_consentimientos', 'hos_partos', 'hos_defunciones', 'hos_epicrisis', 'med_cotizaciones', 'med_garantias', 'cli_controles', 'cli_vacunacion'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.auditar()', t || '_auditar', t);
  end loop;
  foreach t in array array['med_procedimientos', 'hos_paquetes_qx', 'med_kits', 'med_kit_items', 'lab_pruebas', 'lab_perfil_pruebas', 'img_estudios', 'med_planes', 'med_convenios', 'med_referentes', 'far_formulario', 'hos_dietas', 'hos_salas', 'hos_personal', 'cli_vacunas',
                           'hos_triaje', 'hos_notas', 'hos_kardex', 'lab_resultados', 'lab_resultado_lineas', 'img_informes', 'hos_cirugias', 'med_consentimientos', 'hos_partos', 'hos_defunciones', 'hos_epicrisis', 'med_cotizaciones', 'med_garantias', 'cli_controles', 'cli_vacunacion'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('drop policy if exists "%s: modificar" on public.%I', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
    execute format('drop policy if exists "%s: quitar" on public.%I', t, t);
    execute format('create policy "%s: quitar" on public.%I for delete to authenticated using (public.puede_editar_catalogos())', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;
revoke execute on function public.med_numerar() from public, anon, authenticated;
revoke execute on function public.lab_alerta() from public, anon, authenticated;
revoke execute on function public.hos_kardex_preparar() from public, anon, authenticated;
revoke execute on function public.med_asegurar_catalogos(bigint) from public, anon;
grant execute on function public.med_asegurar_catalogos(bigint) to authenticated;
do $$
declare v_mod bigint; v_id bigint; v_orden integer; o record;
begin
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  for o in select * from (values
    ('HOS', 1, 'catalogos', 'Procedimientos y paquetes', 'med-procedimientos', 'Procedimientos, paquetes y kits'), ('HOS', 2, 'catalogos', 'Apoyo diagnóstico', 'med-laboratorio', 'Pruebas de laboratorio e imagen'),
    ('HOS', 3, 'catalogos', 'Convenios', 'med-convenios', 'Planes, convenios y referentes'), ('HOS', 4, 'catalogos', 'Hospital', 'hos-recursos', 'Formulario, dietas, salas y personal'),
    ('HOS', 5, 'registros', 'Atención clínica', 'hos-triaje', 'Emergencia y triaje'), ('HOS', 6, 'registros', 'Atención clínica', 'hos-notas', 'Notas de evolución y enfermería'), ('HOS', 7, 'registros', 'Atención clínica', 'hos-kardex', 'Kardex de medicamentos'),
    ('HOS', 8, 'registros', 'Apoyo diagnóstico', 'med-resultados-lab', 'Resultados de laboratorio'), ('HOS', 9, 'registros', 'Apoyo diagnóstico', 'med-informes-imagen', 'Informes de imagen'),
    ('HOS', 10, 'registros', 'Quirófano y obstetricia', 'hos-hoja-quirurgica', 'Hoja quirúrgica'), ('HOS', 11, 'registros', 'Quirófano y obstetricia', 'hos-partos', 'Partos y recién nacidos'),
    ('HOS', 12, 'registros', 'Documentos clínicos', 'med-consentimientos', 'Consentimientos informados'), ('HOS', 13, 'registros', 'Documentos clínicos', 'hos-epicrisis', 'Epicrisis'), ('HOS', 14, 'registros', 'Documentos clínicos', 'hos-defunciones', 'Defunciones'),
    ('HOS', 15, 'registros', 'Comercial', 'med-cotizaciones', 'Cotizaciones'), ('HOS', 16, 'registros', 'Comercial', 'med-garantias', 'Cartas de garantía'),
    ('CLI', 1, 'catalogos', 'Clínico', 'med-procedimientos', 'Procedimientos, paquetes y kits'), ('CLI', 2, 'catalogos', 'Clínico', 'med-laboratorio', 'Pruebas de laboratorio e imagen'), ('CLI', 3, 'catalogos', 'Clínica', 'med-convenios', 'Planes, convenios y referentes'),
    ('CLI', 4, 'catalogos', 'Clínico', 'cli-vacunas', 'Esquema de vacunación'), ('CLI', 5, 'registros', 'Apoyo diagnóstico', 'med-resultados-lab', 'Resultados de laboratorio'), ('CLI', 6, 'registros', 'Apoyo diagnóstico', 'med-informes-imagen', 'Informes de imagen'),
    ('CLI', 7, 'registros', 'Atención', 'med-consentimientos', 'Consentimientos informados'), ('CLI', 8, 'registros', 'Programas', 'cli-controles', 'Control prenatal y niño sano'), ('CLI', 9, 'registros', 'Programas', 'cli-vacunacion', 'Vacunación'),
    ('CLI', 10, 'registros', 'Caja', 'med-cotizaciones', 'Cotizaciones'), ('CLI', 11, 'registros', 'Caja', 'med-garantias', 'Cartas de garantía')) as x(m, n, grupo, subgrupo, clave, nombre) loop
    select id into v_mod from public.modulos_sistema where siglas = o.m limit 1;
    if v_mod is null then continue; end if;
    select id into v_id from public.opciones_sistema where modulo_id = v_mod and clave = o.clave;
    if v_id is null then insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values (v_mod, o.grupo, o.subgrupo, o.clave, o.nombre, v_orden + o.n + case when o.m = 'CLI' then 100 else 0 end); end if;
  end loop;
end;
$$;
notify pgrst, 'reload schema';
select 'Hospital y clínicas (etapa 1): catálogos clínicos y registros instalados.' as resultado;
