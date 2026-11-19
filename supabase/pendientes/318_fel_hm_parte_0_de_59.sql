-- Script 318 · parte 0 de 59 · Organización 2 (Hospital Miraflores): estructura y catálogos FEL. Sin datos de empresas ni de clientes.
--   Se ejecuta UNA vez, antes de la parte 1 (emisores y conexión) y de las partes 2 a 59 (historial). Solo agrega lo que falta.
--   · Columnas que traen datos los archivos y no existían: sat_dte_items.precio_total_descuento (CAR_FEL_ITEMS.PRECIO_TOTAL_DESCUENTO),
--     sat_fel_conexiones.transaccion_consulta_dpi y dato_consulta_dpi (CAR_DATOS_FEL, tipo de conexión 4 «CONSULTA DPI»).
--     Las demás columnas del historial FEL (script 205) se revisan y se crean solo si faltan.
--   · Tabla nueva factura_venta_comentarios (CAR_COMENTARIOS_FACTURAS: comentarios por línea de cada factura del sistema anterior).
--   · Tipos de documento FEL de la organización 2, tipos de frase y escenarios (con EXENTO_IVA).
set lock_timeout = '20s';
do $col$
declare r record; v_n int := 0;
begin
  for r in select * from (values
    ('sat_dte', 'emisor_codigo_anterior', 'integer'),
    ('sat_dte', 'emisor_nombre', 'text'),
    ('sat_dte', 'emisor_nombre_comercial', 'text'),
    ('sat_dte', 'emisor_correo', 'text'),
    ('sat_dte', 'emisor_direccion', 'text'),
    ('sat_dte', 'emisor_codigo_postal', 'text'),
    ('sat_dte', 'emisor_municipio', 'text'),
    ('sat_dte', 'emisor_departamento', 'text'),
    ('sat_dte', 'emisor_pais', 'text'),
    ('sat_dte', 'receptor_direccion_anterior', 'text'),
    ('sat_dte', 'receptor_codigo_postal', 'text'),
    ('sat_dte', 'receptor_municipio', 'text'),
    ('sat_dte', 'receptor_departamento', 'text'),
    ('sat_dte', 'receptor_pais', 'text'),
    ('sat_dte', 'impuesto_nombre', 'text'),
    ('sat_dte', 'resultado_anterior', 'text'),
    ('sat_dte', 'resultado_proceso', 'integer'),
    ('sat_dte', 'resultado_certificacion', 'text'),
    ('sat_dte', 'motivo_error_anterior', 'text'),
    ('sat_dte', 'no_interno_resultado', 'text'),
    ('sat_dte', 'export_complemento', 'text'),
    ('sat_dte', 'export_uri_complemento', 'text'),
    ('sat_dte', 'nota_complemento', 'text'),
    ('sat_dte', 'nota_uri_complemento', 'text'),
    ('sat_dte', 'nota_version', 'integer'),
    ('sat_dte_items', 'impuesto_nombre', 'text'),
    ('sat_dte_items', 'codigo_unidad_gravable', 'integer'),
    ('sat_dte_items', 'total_impuesto_linea', 'numeric(16, 2)'),
    ('sat_dte_items', 'precio_total_descuento', 'numeric(16, 2)'),
    ('sat_dte_frases', 'orden', 'integer'),
    ('sat_dte_adendas', 'adenda', 'integer'),
    ('sat_frases', 'exento_iva', 'boolean'),
    ('sat_fel_conexiones', 'dato_consulta', 'text'),
    ('sat_fel_conexiones', 'url_anterior', 'text'),
    ('sat_fel_conexiones', 'transaccion_consulta_dpi', 'text'),
    ('sat_fel_conexiones', 'dato_consulta_dpi', 'text')
  ) as x(tabla, col, tipo) loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = r.tabla and column_name = r.col) then
      execute format('alter table public.%I add column %I %s', r.tabla, r.col, r.tipo);
      v_n := v_n + 1;
    end if;
  end loop;
  raise notice '%', format('FEL organización 2: %s columnas nuevas (las demás ya existían).', v_n);
end;
$col$;
comment on column public.sat_dte_items.precio_total_descuento is 'CAR_FEL_ITEMS.PRECIO_TOTAL_DESCUENTO: total de la línea menos el descuento.';
comment on column public.sat_fel_conexiones.transaccion_consulta_dpi is 'CAR_DATOS_FEL.TRANSACCION del tipo de conexión 4 (CONSULTA DPI).';
comment on column public.sat_fel_conexiones.dato_consulta_dpi is 'CAR_DATOS_FEL.IDENTIFICADOR del tipo de conexión 4 (CONSULTA DPI, p. ej. CONSULTA_CUI).';

create table if not exists public.sat_dte_anulaciones (
  id bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id bigint references public.localidades (id),
  id_anterior bigint not null,
  dte_id bigint references public.sat_dte (id) on delete set null,
  no_interno text, fecha_emision_documento timestamptz, fecha_hora_anulacion timestamptz, id_receptor text, nit_emisor text, motivo text, numero_documento text,
  creado_en timestamptz not null default now(),
  unique (organizacion_id, id_anterior)
);
create table if not exists public.sat_fel_ids (
  organizacion_id bigint not null references public.organizaciones (id),
  id_anterior bigint not null,
  estado text,
  dte_id bigint references public.sat_dte (id) on delete set null,
  primary key (organizacion_id, id_anterior)
);
create index if not exists sat_dte_autorizacion on public.sat_dte (organizacion_id, autorizacion);

-- Comentarios de las facturas del sistema anterior (CAR_COMENTARIOS_FACTURAS).
create table if not exists public.factura_venta_comentarios (
  id bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id bigint not null references public.localidades (id),
  factura_id bigint references public.facturas_venta (id) on delete cascade,
  factura_anterior bigint not null,
  linea integer,
  comentario integer,
  descripcion text,
  creado_en timestamptz not null default now()
);
create unique index if not exists factura_venta_comentarios_uk on public.factura_venta_comentarios (localidad_id, factura_anterior, linea, comentario) nulls not distinct;
create index if not exists factura_venta_comentarios_factura on public.factura_venta_comentarios (factura_id);
comment on table public.factura_venta_comentarios is 'Comentarios por línea de las facturas del sistema anterior (CAR_COMENTARIOS_FACTURAS): LINEA, COMENTARIO (número) y DESCRIPCION.';
do $seg$
declare t text;
begin
  foreach t in array array['sat_dte_anulaciones', 'sat_fel_ids', 'factura_venta_comentarios'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': leer') then
      execute format('create policy %I on public.%I for select to authenticated using (public.usuario_activo())', t || ': leer', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': escribir') then
      execute format('create policy %I on public.%I for all to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t || ': escribir', t);
    end if;
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$seg$;

-- Tipos de documento FEL de la organización 2 (CAR_TIPOS_DOCUMENTOS_FEL).
insert into public.sat_tipos_documento_fel (organizacion_id, codigo, tipo_dte, descripcion)
select g.id, v.c::int, v.t, v.d from (values ('1', 'FACT', 'FACTURA'), ('2', 'FACT', 'FACTURA EXPORTACIÓN'), ('3', 'FCAM', 'FACTURA CAMBIARIA'), ('4', 'FPEQ', 'FACTURA PEQUEÑO CONTRIBUYENTE'), ('5', 'FCAP', 'FACTURA CAMBIARIA PEQUEÑO CONTRIBUYENTE'), ('6', 'FESP', 'FACTURA ESPECIAL'), ('7', 'NABN', 'NOTA DE ABONO'), ('8', 'NABN', 'NOTA DE ABONO EXPORTACIÓN'), ('9', 'RECI', 'RECIBO'), ('10', 'NDEB', 'NOTA DE DÉBITO'), ('11', 'NCRE', 'NOTA DE CRÉDITO'), ('12', 'NDEB', 'NOTA DE DÉBITO EXPORTACIÓN'), ('13', 'NCRE', 'NOTA DE CRÉDITO EXPORTACIÓN')) v(c, t, d)
cross join public.organizaciones g where g.codigo = '2'
on conflict (organizacion_id, codigo) do update set tipo_dte = excluded.tipo_dte, descripcion = excluded.descripcion;
-- Tipos de frase (CAR_TIPOS_FRASES_FEL; catálogo común): se crean los que falten.
insert into public.sat_tipos_frase (codigo, nombre, descripcion)
values (1, 'Frase de retención del ISR', 'Indica el régimen al que se encuentra inscrito el EMISOR para que el RECEPTOR sepa si debe efectuarle o no la respectiva retención.'), (2, 'Frase de retención del IVA', 'Indica si el EMISOR es Agente de Retención del IVA. Si el RECEPTOR también lo es sabrá que no debe efectuar la respectiva retención.'), (3, 'Frase de no genera derecho a crédito fiscal del IVA', 'Cuando el emisor se encuentre afiliado al régimen de pequeño contribuyente, para que el receptor sepa que la factura no genera derecho a crédito fiscal.'), (4, 'Frase de exento o no afecto al IVA', 'Existen facturas que por diferentes motivos: a) NO deben incluir el IVA. b) Deben incluir la base legal por la cual no incluyen el IVA (art. 11 Reglamento de la Ley del IVA y art. 29 literal “a” Ley del IVA).')
on conflict (codigo) do nothing;
-- Escenarios de frases (CAR_COD_ESCENARIO_FEL; catálogo común): se crean los que falten y se completa si es exento de IVA.
insert into public.sat_frases (tipo, escenario, descripcion, texto, exento_iva)
select v.t, v.e, v.d, v.x, v.ex from (values (1, 1, 'Sujeto a pagos trimestrales ISR', 'Afiliado al ISR Régimen Sobre las Utilidades de Actividades Lucrativas.', false), (1, 2, 'Sujeto a retención definitiva ISR', 'Afiliado al ISR Régimen Opcional Simplificado Sobre Ingresos de Actividades Lucrativas (y NO cuenta con una Resolución de la SAT que le permitiría hacer el pago directo y le evitaría ser objeto de retención)', false), (1, 3, 'Sujeto a pago directo ISR (número de resolución y fecha)', 'Afiliado al ISR Régimen Opcional Simplificado Sobre Ingresos de Actividades Lucrativas (y SÍ cuenta con una Resolución de la SAT que le permite hacer el pago directo y le evita ser objeto de retención)', false), (2, 1, 'Agente de Retención del IVA', 'Es Agente de Retención del IVA', true), (3, 1, 'No genera derecho a crédito fiscal', 'Es pequeño contribuyente del IVA', true), (4, 1, 'Exenta del IVA (art. 7 núm. 2 Ley del IVA)', 'Cuando el vendedor exporta bienes o servicios', true), (4, 2, 'Exenta del IVA (art. 7 núm. 4 Ley del IVA)', 'Servicios que presten las instituciones fiscalizadas por la Superintendencia de Bancos y las bolsas de valores autorizadas para operar en el país.', true), (4, 3, 'Exenta del IVA (art. 7 núm. 5 Ley del IVA)', 'Cuando una cooperativa le vende bienes o servicios a sus asociados, cooperativas, federaciones, centrales de servicios y confederaciones de cooperativas.', true), (4, 4, 'Exenta del IVA (art. 7 núm. 9 Ley del IVA)', 'Aportes y donaciones a asociaciones, fundaciones e instituciones, educativas, culturales de asistencia o de servicio social y las religiosas no lucrativas.', true), (4, 5, 'Exenta del IVA (art. 7 núm. 10 Ley del IVA)', 'Pagos por el derecho de ser miembro y las cuotas periódicas a las asociaciones o instituciones sociales, gremiales, culturales, científicas, educativas y deportivas, así como a los colegios de profesionales y los partidos políticos.', true), (4, 6, 'Exenta del IVA (art. 7 núm. 13 Ley del IVA)', 'Servicios exentos que prestan las asociaciones, fundaciones e instituciones educativas, de asistencia o de servicio social y las religiosas, y otras.', true), (4, 7, 'Exenta del IVA (art. 7 núm. 14 Ley del IVA)', 'Venta de activos de Bancos o Sociedades Financieras a las que la Superintendencia de Bancos haya aprobado un plan de regulación o en que exista Junta de Exclusión de activos y pasivos, cuando se transfieran a otros Bancos o sociedades financieras, previa autorización de la Junta Monetaria. Esta exención tendrá validez siempre que la operación no sea para eludir responsabilidades civiles, penales, o de otra naturaleza.', true), (4, 8, 'Exenta del IVA (art. 8 núm. 1 Ley del IVA)', 'Servicios exentos centros educativos privados en lo que respecta a la matrícula de inscripción, colegiaturas y derechos de examen, de los cursos que tengan autorizados por la autoridad competente.', true), (4, 9, 'Exenta del IVA (art. 7 núm. 15 Ley del IVA)', 'Cuando una compañía farmacéutica le vende medicamentos genéricos o antirretrovirales a determinados pacientes.', true), (4, 10, 'Esta factura no incluye IVA (art. 55 Ley del IVA)', 'Cuando se vende un vehículo terrestre del modelo de dos o más años anteriores al del año en curso.', true), (4, 11, 'No afecta al IVA (Decreto 29-89 Ley de Maquila)', 'Cuando el vendedor vende bienes o servicios de producción local a empresas calificadas bajo el decreto 29-89. Base legal: artículo 12 bis literal g del decreto 29-89 Ley de Maquila; artículo 11 del Acuerdo Gubernativo 5-2013 Reglamento de la Ley del IVA.', true), (4, 12, 'No afecta al IVA (Decreto 65-89 Ley de Zonas Francas)', 'Cuando el vendedor vende bienes o servicios de producción local a empresas calificadas bajo el decreto 65-89. Base legal: artículo 22 bis literal e del decreto 29-89 Ley de Zonas Francas', true)) v(t, e, d, x, ex)
on conflict (tipo, escenario) do update set exento_iva = coalesce(public.sat_frases.exento_iva, excluded.exento_iva);
analyze public.sat_dte;
notify pgrst, 'reload schema';
