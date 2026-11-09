-- Integraciones SAT · repositorio de DTE certificados (FEL) y catálogos que faltaban.
-- Estructura para migrar el historial FEL del sistema anterior (los datos van en las partes 164_fel del repositorio
-- privado): cada DTE con sus líneas e impuestos, frases, abonos de factura cambiaria, adendas, exportación, referencias
-- de notas, anulación y resultado de la certificación; enlazado a su factura o nota de venta. Catálogos: datos del
-- emisor (dirección y afiliación), escenarios de frases y tipos de documento FEL del sistema anterior.
-- No se migran credenciales del certificador.

-- ============ Catálogos ============
alter table public.sat_emisores add column if not exists direccion text;
alter table public.sat_emisores add column if not exists codigo_postal text;
alter table public.sat_emisores add column if not exists municipio text;
alter table public.sat_emisores add column if not exists departamento text;
alter table public.sat_emisores add column if not exists pais text default 'GT';
alter table public.sat_emisores add column if not exists correo_emisor text;
alter table public.sat_emisores add column if not exists afiliacion_iva text;
alter table public.sat_establecimientos add column if not exists codigo_postal text;
alter table public.sat_establecimientos add column if not exists pais text default 'GT';

create table if not exists public.sat_tipos_documento_fel (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id),
  codigo integer not null, tipo_dte text not null, descripcion text not null, unique (organizacion_id, codigo)
);

-- Escenarios de frases que faltaban (catálogo de la SAT que usaba el sistema anterior).
insert into public.sat_frases (tipo, escenario, descripcion, texto)
select x.t, x.e, x.d, x.x from (values
  (1, 1, 'SUJETO A PAGOS TRIMESTRALES ISR', 'Afiliado al ISR Régimen Sobre las Utilidades de Actividades Lucrativas.'),
  (1, 2, 'Sujeto a retención definitiva ISR', 'Afiliado al ISR Régimen Opcional Simplificado Sobre Ingresos de Actividades Lucrativas (y NO cuenta con una Resolución de la SAT que le permitiría hacer el pago directo y le evitaría ser objeto de retención)'),
  (1, 3, 'Sujeto a pago directo ISR (número de resolución y fecha)', 'Afiliado al ISR Régimen Opcional Simplificado Sobre Ingresos de Actividades Lucrativas (y SÍ cuenta con una Resolución de la SAT que le permite hacer el pago directo y le evita ser objeto de retención)'),
  (2, 1, 'Agente de Retención del IVA', 'Es Agente de Retención del IVA'),
  (3, 1, 'No genera derecho a crédito fiscal', 'Es pequeño contribuyente del IVA'),
  (4, 1, 'EXENTA DEL IVA (art. 7 núm. 2 Ley del IVA)', 'Exportaciones: Cuando el vendedor exporta bienes o servicios'),
  (4, 2, 'Exenta del IVA (art. 7 núm. 4 Ley del IVA)', 'Servicios que presten las instituciones fiscalizadas por la Superintendencia de Bancos y las bolsas de valores autorizadas para operar en el país.'),
  (4, 3, 'Ventas de cooperativas. Exenta del IVA (art. 7 núm. 5 Ley del IVA)', 'Cuando una cooperativa le vende bienes o servicios a sus asociados, cooperativas, federaciones, centrales de servicios y confederaciones de cooperativas.'),
  (4, 4, 'Exenta del IVA (art. 7 núm. 9 Ley del IVA)', 'Aportes y donaciones a asociaciones, fundaciones e instituciones, educativas, culturales de asistencia o de servicio social y las religiosas no lucrativas.'),
  (4, 5, 'Exenta del IVA (art. 7 núm. 10 Ley del IVA)', 'Pagos por el derecho de ser miembro y las cuotas periódicas a las asociaciones o instituciones sociales, gremiales, culturales, científicas, educativas y deportivas, así como a los colegios de profesionales y los partidos políticos.'),
  (4, 6, 'Exenta del IVA (art. 7 núm. 13 Ley del IVA)', 'Servicios exentos que prestan las asociaciones, fundaciones e instituciones educativas, de asistencia o de servicio social y las religiosas, y otras.'),
  (4, 7, 'Exenta del IVA (art. 7 núm. 14 Ley del IVA)', 'Venta de activos de Bancos o Sociedades Financieras a las que la Superintendencia de Bancos haya aprobado un plan de regulación o en que exista Junta de Exclusión de activos y pasivos, cuando se transfieran a otros Bancos o sociedades financieras, previa autorización de la Junta Monetaria. Esta exención tendrá validez siempre que la operación no sea para eludir responsabilidades civiles, penales, o de otra naturaleza.'),
  (4, 8, 'Exenta del IVA (art. 8 núm. 1 Ley del IVA)', 'Servicios exentos centros educativos privados en lo que respecta a la matrícula de inscripción, colegiaturas y derechos de examen, de los cursos que tengan autorizados por la autoridad competente.'),
  (4, 9, 'EXENTA DEL IVA (art. 7 núm. 15 Ley del IVA)', 'Medicamentos: Cuando una compañía farmacéutica le vende medicamentos genéricos o antirretrovirales a determinados pacientes.'),
  (4, 10, 'Vehículos. Esta factura no incluye IVA (art. 55 Ley del IVA)', 'Cuando se vende un vehículo terrestre del modelo de dos o más años anteriores al del año en curso.'),
  (4, 11, 'Ventas a maquilas. No afecta al IVA (Decreto 29-89 Ley de Maquila)', 'Cuando el vendedor vende bienes o servicios de producción local a empresas calificadas bajo el decreto 29-89. Base legal: artículo 12 bis literal g del decreto 29-89 Ley de Maquila; artículo 11 del Acuerdo Gubernativo 5-2013 Reglamento de la Ley del IVA.'),
  (4, 12, 'Ventas a zonas francas. No afecta al IVA (Decreto 65-89 Ley de Zonas Francas)', 'Cuando el vendedor vende bienes o servicios de producción local a empresas calificadas bajo el decreto 65-89. Base legal: artículo 22 bis literal e del decreto 29-89 Ley de Zonas Francas'),
  (4, 22, 'FACTURA ORIGEN NO INCLUYE IVA', 'Las notas de débito y crédito no deben incluir IVA cuando el documento origen al que hacen referencia tampoco lo incluye.')) x(t, e, d, x)
where not exists (select 1 from public.sat_frases f where f.tipo = x.t and f.escenario = x.e);

-- ============ Repositorio de DTE ============
create table if not exists public.sat_dte (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  id_anterior bigint not null, tipo_dte text not null, tipo_documento_anterior integer, no_interno text, fecha_emision timestamptz, moneda text not null default 'GTQ',
  gran_total numeric(16, 2) not null default 0, total_iva numeric(16, 2) not null default 0, exportacion boolean not null default false,
  emisor_nit text, establecimiento integer, afiliacion_iva text,
  receptor_id text, receptor_nit text, receptor_nombre text, receptor_correo text, receptor_direccion text, receptor_tipo_especial text,
  serie text, numero_dte text, autorizacion text, fecha_certificacion timestamptz,
  resultado text not null default 'SIN RESULTADO' check (resultado in ('CERTIFICADO', 'ERROR', 'PENDIENTE', 'SIN RESULTADO')), motivo_error text,
  estado text not null default 'VIGENTE' check (estado in ('VIGENTE', 'ANULADO')), anulado_en timestamptz, motivo_anulacion text,
  export_incoterm text, export_consignatario text, export_direccion_consignatario text, export_exportador text, export_codigo_exportador text,
  nota_autorizacion_origen text, nota_serie_origen text, nota_numero_origen text, nota_fecha_origen date, nota_motivo text,
  factura_venta_id bigint references public.facturas_venta (id) on delete set null, nota_venta_id bigint references public.notas_venta (id) on delete set null,
  origen text not null default 'MIGRADO', creado_en timestamptz not null default now(), unique (localidad_id, id_anterior)
);
create index if not exists sat_dte_fecha_idx on public.sat_dte (localidad_id, fecha_emision);
create index if not exists sat_dte_no_interno_idx on public.sat_dte (localidad_id, no_interno);
create table if not exists public.sat_dte_items (
  id bigint generated always as identity primary key, dte_id bigint not null references public.sat_dte (id) on delete cascade, linea integer not null,
  bien_servicio text, cantidad numeric(16, 4) not null default 0, unidad text, descripcion text, precio_unitario numeric(16, 6) not null default 0, precio_total numeric(16, 2) not null default 0,
  descuento numeric(16, 2) not null default 0, monto_gravable numeric(16, 2), iva numeric(16, 2), comentario text, unique (dte_id, linea)
);
create table if not exists public.sat_dte_frases (
  id bigint generated always as identity primary key, dte_id bigint not null references public.sat_dte (id) on delete cascade, tipo integer not null, escenario integer not null, unique (dte_id, tipo, escenario)
);
create table if not exists public.sat_dte_abonos (
  id bigint generated always as identity primary key, dte_id bigint not null references public.sat_dte (id) on delete cascade, numero integer not null, fecha_vencimiento date, monto numeric(16, 2) not null default 0, unique (dte_id, numero)
);
create table if not exists public.sat_dte_adendas (
  id bigint generated always as identity primary key, dte_id bigint not null references public.sat_dte (id) on delete cascade, llave text not null, valor text, unique (dte_id, llave)
);

-- Enlaza cada DTE con su factura o nota de venta (por empresa y número interno) y completa en ellas la serie, el
-- número DTE, la autorización, la fecha de certificación y el tipo de DTE cuando faltan. Devuelve el resumen.
create or replace function public.sat_vincular_dte(p_organizacion bigint) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_fac integer; v_not integer; v_ff integer; v_fn integer; v_dif integer;
begin
  -- Desde la aplicación solo un administrador; desde el SQL Editor (sin usuario) corre como parte de la migración.
  if (select auth.uid()) is not null and not public.puede_editar_catalogos() then raise exception 'No tienes permiso.'; end if;
  perform set_config('fin.migracion', 'si', true);
  update public.sat_dte d set factura_venta_id = f.id
    from public.facturas_venta f where d.organizacion_id = p_organizacion and d.factura_venta_id is null and d.tipo_dte in ('FACT', 'FCAM', 'FPEQ', 'FCAP', 'FESP')
     and f.localidad_id = d.localidad_id and f.no_interno = d.no_interno;
  get diagnostics v_fac = row_count;
  -- Las registradas en este sistema con otro número interno se reconocen por su autorización.
  update public.sat_dte d set factura_venta_id = f.id
    from public.facturas_venta f where d.organizacion_id = p_organizacion and d.factura_venta_id is null and d.autorizacion is not null and d.tipo_dte in ('FACT', 'FCAM', 'FPEQ', 'FCAP', 'FESP')
     and f.localidad_id = d.localidad_id and upper(f.autorizacion) = d.autorizacion
     and not exists (select 1 from public.sat_dte x where x.factura_venta_id = f.id);
  get diagnostics v_ff = row_count; v_fac := v_fac + v_ff;
  update public.sat_dte d set nota_venta_id = n.id
    from public.notas_venta n where d.organizacion_id = p_organizacion and d.nota_venta_id is null and d.tipo_dte in ('NCRE', 'NDEB', 'NABN')
     and n.localidad_id = d.localidad_id and n.no_interno_anterior = d.no_interno;
  get diagnostics v_not = row_count;
  update public.sat_dte d set nota_venta_id = n.id
    from public.notas_venta n where d.organizacion_id = p_organizacion and d.nota_venta_id is null and d.autorizacion is not null and d.tipo_dte in ('NCRE', 'NDEB', 'NABN')
     and n.localidad_id = d.localidad_id and upper(n.autorizacion) = d.autorizacion and not exists (select 1 from public.sat_dte x where x.nota_venta_id = n.id);
  get diagnostics v_fn = row_count; v_not := v_not + v_fn;
  perform set_config('fin.factura', 'si', true);
  update public.facturas_venta f set serie = coalesce(f.serie, d.serie), numero_dte = coalesce(f.numero_dte, d.numero_dte), autorizacion = coalesce(f.autorizacion, d.autorizacion),
      fecha_certificacion = coalesce(f.fecha_certificacion, d.fecha_certificacion), tipo_dte = case when f.autorizacion is null and d.tipo_dte in ('FACT', 'FCAM', 'FESP', 'FPEQ', 'FEXP') then d.tipo_dte else f.tipo_dte end
    from public.sat_dte d where d.factura_venta_id = f.id and d.resultado = 'CERTIFICADO' and d.autorizacion is not null
      and (f.autorizacion is null or f.serie is null or f.numero_dte is null or f.fecha_certificacion is null);
  get diagnostics v_ff = row_count;
  update public.notas_venta n set serie = coalesce(n.serie, d.serie), numero_dte = coalesce(n.numero_dte, d.numero_dte), autorizacion = coalesce(n.autorizacion, d.autorizacion),
      fecha_certificacion = coalesce(n.fecha_certificacion, d.fecha_certificacion), tipo_dte = coalesce(n.tipo_dte, d.tipo_dte)
    from public.sat_dte d where d.nota_venta_id = n.id and d.resultado = 'CERTIFICADO' and d.autorizacion is not null
      and (n.autorizacion is null or n.serie is null or n.numero_dte is null or n.fecha_certificacion is null);
  get diagnostics v_fn = row_count;
  perform set_config('fin.factura', '', true);
  perform set_config('fin.migracion', '', true);
  -- DTE anulado en la SAT cuya factura sigue vigente: se informa para revisarlo (no se anula automáticamente).
  select count(*) into v_dif from public.sat_dte d join public.facturas_venta f on f.id = d.factura_venta_id where d.organizacion_id = p_organizacion and d.estado = 'ANULADO' and f.estado <> 'ANULADA';
  return jsonb_build_object('facturas_enlazadas', v_fac, 'notas_enlazadas', v_not, 'facturas_completadas', v_ff, 'notas_completadas', v_fn, 'anulados_en_sat_vigentes_aqui', v_dif,
    'dte', (select count(*) from public.sat_dte where organizacion_id = p_organizacion),
    'sin_documento', (select count(*) from public.sat_dte where organizacion_id = p_organizacion and factura_venta_id is null and nota_venta_id is null and resultado = 'CERTIFICADO'),
    'emisores_con_nit_distinto', (select count(*) from public.sat_emisores s where s.organizacion_id = p_organizacion and exists (select 1 from public.sat_dte d where d.localidad_id = s.localidad_id and d.emisor_nit is not null and d.emisor_nit <> s.nit)));
end;
$$;


-- Crea en Facturación/Ventas la factura de un DTE certificado que no tiene documento (emitida en el sistema anterior
-- después de la exportación de facturas), con su detalle; queda enlazada al DTE.
create or replace function public.sat_crear_factura(p_dte bigint) returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.sat_dte; v_fac bigint; v_mon bigint; v_dias integer; v_n integer := 0; it record; v_exento boolean;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso.'; end if;
  select * into d from public.sat_dte where id = p_dte for update;
  if d.id is null then raise exception 'El DTE no existe.'; end if;
  if d.factura_venta_id is not null then raise exception 'El DTE ya tiene su factura.'; end if;
  if d.tipo_dte not in ('FACT', 'FCAM') or d.resultado <> 'CERTIFICADO' then raise exception 'Solo se crean facturas (FACT o FCAM) certificadas.'; end if;
  if exists (select 1 from public.facturas_venta f where f.localidad_id = d.localidad_id and (f.no_interno = d.no_interno or upper(f.autorizacion) = d.autorizacion)) then raise exception 'Ya existe una factura con ese número interno o autorización: ejecuta el enlace.'; end if;
  v_mon := coalesce((select id from public.monedas where iso = d.moneda limit 1), (select id from public.monedas where iso = 'GTQ' limit 1));
  v_dias := coalesce((select max(fecha_vencimiento) from public.sat_dte_abonos where dte_id = d.id) - (d.fecha_emision at time zone 'America/Guatemala')::date, 0);
  v_exento := d.total_iva = 0 and exists (select 1 from public.sat_dte_frases f where f.dte_id = d.id and f.tipo = 4);
  perform set_config('fin.migracion', 'si', true); perform set_config('fin.factura', 'si', true);
  insert into public.facturas_venta (organizacion_id, localidad_id, numero, no_interno, tipo_factura, tipo_dte, serie, numero_dte, autorizacion, fecha_emision, fecha_certificacion, estado, moneda_id, tipo_cambio,
    nombre, nit, correo, direccion, forma_pago, dias_credito, exento_iva, observaciones, motivo_anulacion, anulada_en)
  values (d.organizacion_id, d.localidad_id, 0, d.no_interno, case when d.tipo_dte = 'FCAM' then 'FACTURA CAMBIARIA' else 'FACTURA NORMAL' end, d.tipo_dte, d.serie, d.numero_dte, d.autorizacion, d.fecha_emision, d.fecha_certificacion,
    case when d.estado = 'ANULADO' then 'ANULADA' else 'FACTURADA' end, v_mon, 1, coalesce(nullif(trim(d.receptor_nombre), ''), 'CONSUMIDOR FINAL'), coalesce(nullif(trim(d.receptor_nit), ''), 'CF'), d.receptor_correo, d.receptor_direccion,
    case when v_dias > 0 then 'CRÉDITO' else 'CONTADO' end, least(greatest(v_dias, 0), 365), v_exento, 'Creada desde el DTE FEL del sistema anterior', d.motivo_anulacion, d.anulado_en)
  returning id into v_fac;
  for it in select * from public.sat_dte_items where dte_id = d.id order by linea loop
    v_n := v_n + 1;
    insert into public.factura_venta_lineas (factura_id, linea, descripcion, tipo, cantidad, precio, inventario)
    values (v_fac, v_n, left(coalesce(nullif(trim(it.descripcion), ''), 'PRODUCTO'), 250), case when it.bien_servicio = 'S' then 'SERVICIO' else 'BIEN' end, greatest(it.cantidad, 0.0001), round(it.precio_total / nullif(it.cantidad, 0), 6), false);
  end loop;
  update public.facturas_venta set saldo = case when forma_pago = 'CRÉDITO' and estado = 'FACTURADA' then total else 0 end, pagado = case when forma_pago = 'CONTADO' and estado = 'FACTURADA' then total else 0 end where id = v_fac;
  update public.sat_dte set factura_venta_id = v_fac where id = d.id;
  perform set_config('fin.migracion', '', true); perform set_config('fin.factura', '', true);
  return jsonb_build_object('factura', v_fac, 'numero', (select numero from public.facturas_venta where id = v_fac), 'total', (select total from public.facturas_venta where id = v_fac), 'gran_total', d.gran_total);
end;
$$;
revoke execute on function public.sat_crear_factura(bigint) from public, anon;
grant execute on function public.sat_crear_factura(bigint) to authenticated;

-- ============ Permisos ============
do $$
declare t text;
begin
  foreach t in array array['sat_tipos_documento_fel', 'sat_dte', 'sat_dte_items', 'sat_dte_frases', 'sat_dte_abonos', 'sat_dte_adendas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('drop policy if exists "%s: escribir" on public.%I', t, t);
    execute format('create policy "%s: escribir" on public.%I for all to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;
revoke execute on function public.sat_vincular_dte(bigint) from public, anon;
grant execute on function public.sat_vincular_dte(bigint) to authenticated;
do $$
declare v_mod bigint; v_id bigint; v_orden integer;
begin
  select id into v_mod from public.opciones_sistema where clave = 'dte-emitidos' order by id limit 1;
  select modulo_id into v_mod from public.opciones_sistema where id = v_mod;
  if v_mod is null then return; end if;
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  select id into v_id from public.opciones_sistema where modulo_id = v_mod and clave = 'sat-historial-fel';
  if v_id is null then insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values (v_mod, 'registros', 'Documentos', 'sat-historial-fel', 'Historial FEL (DTE certificados)', v_orden + 1); end if;
end;
$$;
notify pgrst, 'reload schema';
select 'Integraciones SAT: repositorio de DTE certificados (FEL), catálogos del emisor, frases y tipos de documento FEL instalados. Ejecuta después las partes 164_fel.' as resultado;
