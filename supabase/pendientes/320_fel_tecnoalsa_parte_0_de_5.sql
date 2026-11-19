-- Script 320 · parte 0 de 5 · Organizaciones 4 (Tecnoalsa) y 7 (AAPOS): revisión de la estructura FEL. Sin datos de empresas ni de clientes.
--   Se ejecuta UNA vez, antes de las partes 1 a 5. Crea solo las columnas y tablas del historial FEL que falten (scripts 205 y 318).
--   No vuelve a cargar catálogos: CAR_TIPOS_DOCUMENTOS_FEL ya se migró en el script 263, y CAR_TIPOS_FRASES_FEL y CAR_COD_ESCENARIO_FEL
--   (iguales a los del hospital) en el script 318.
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
    ('sat_dte_abonos', 'complemento', 'text'),
    ('sat_dte_abonos', 'id_complemento', 'text'),
    ('sat_dte_abonos', 'uri_complemento', 'text'),
    ('sat_dte_adendas', 'adenda', 'integer'),
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
  raise notice '%', format('FEL organizaciones 4 y 7: %s columnas nuevas (las demás ya existían).', v_n);
end;
$col$;
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
do $seg$
declare t text;
begin
  foreach t in array array['sat_dte_anulaciones', 'sat_fel_ids'] loop
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
analyze public.sat_dte;
notify pgrst, 'reload schema';
