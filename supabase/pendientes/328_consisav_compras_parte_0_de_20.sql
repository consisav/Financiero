-- Script 328 · Proveedores, compras, detalle contable de compras y documentos de caja chica del servidor Consisav: organizaciones 13 a 17
--   (CONSISAV-8 a CONSISAV-12 del sistema anterior), de «Datos Contables Servidor Consisav al 04-11-2026»:
--     ACT_PROVEEDORES: 39984 proveedores (una sola lista para todas las empresas del sistema anterior).
--     ACT_COMPRAS (7 archivos): 423999 compras (CONSISAV-8: 79380, CONSISAV-9: 184693, CONSISAV-10: 13, CONSISAV-11: 159913).
--     ACT_DETALLE_CONTABLE_COMPRAS (17 archivos): 1041820 líneas. CON_MOVIMIENTOS_SUBCAJAS: 29019 documentos de caja chica.
--     CON_COMPRAS_CHEQUE: 1 cheque de compra. ACT_TIPOS_DOCUMENTOS, ACT_TIPOS_DOCTOS_COMPRAS_SAT, ACT_CLASIFICACIONES_COMPRAS y ACT_TIPOS_PROVEEDORES (catálogos).
--   Ejecutar después de los scripts 324 (catálogo de cuentas y transacciones) y 325 (bancos, cajas y subcajas).
--   Orden:
--     1) Esta parte 0: estructura, catálogos, tablas de carga y funciones.
--     2) En el Table Editor de Supabase, importar cada archivo CSV de supabase/pendientes/328_csv a su tabla de carga
--        («Import data from CSV»): 328_1_proveedores.csv → mig328_proveedores (39984); 328_2_compras_1_de_4.csv → mig328_compras (110000); 328_2_compras_2_de_4.csv → mig328_compras (110000); 328_2_compras_3_de_4.csv → mig328_compras (110000); 328_2_compras_4_de_4.csv → mig328_compras (93999); 328_3_detalle_1_de_3.csv → mig328_detalle (350000); 328_3_detalle_2_de_3.csv → mig328_detalle (350000); 328_3_detalle_3_de_3.csv → mig328_detalle (341820); 328_4_documentos_caja.csv → mig328_movimientos (29019).
--     3) Las partes 1 en adelante, en orden. La última muestra el resumen y borra las tablas de carga.
--   Cada empresa se busca por su organización (organizacion_anterior = CONSISAV-n) y su correlativo (= LOCALIDAD del sistema anterior).
--   Se puede ejecutar de nuevo: actualiza, no duplica.
--
--   Catálogos (comunes a todas las organizaciones): los códigos de Consisav no son los del sistema; se buscan por nombre y se crean los que faltan.
--   La equivalencia queda en la tabla nueva equivalencias_anteriores (sistema, catálogo, código anterior → registro del sistema):
--     Tipos de documento: 1 → FACTURA, 2 → NOTA DE CREDITO, 3 → POLIZA, 6 → TICKET, 4 → FACTURA ELECTRONICA, 5 → RECIBO, 7 → COMPROBANTE, 8 → OTROS, 9 → NOTA DE DEBITO, 10 → FACTURA ESPECIAL.
--     Clasificaciones de compra: 0 → VENTAS, 1 → SIN CLASIFICACION VALIDA, 2 → SERVICIOS, 3 → BIENES EXENTOS, 4 → BIENES, 5 → COMBUSTIBLES, 6 → GASTOS ADMINISTRATIVOS, 7 → IMPORTACIONES, 8 → SERVICIOS EXENTOS, 9 → EXENTOS IMPORTACION, 10 → ACTIVOS.
--     Tipos de proveedor: 2 → CLIENTE, 1 → GENERAL.
--     Tipos de documento de la SAT (ACT_TIPOS_DOCTOS_COMPRAS_SAT, 11): tabla nueva tipos_documento_sat_anteriores (código SAT, nombre y tipo de documento).
--   Proveedores: la lista completa queda en la tabla nueva proveedores_anteriores (todas sus columnas). En cada empresa se crea (o actualiza) el
--     proveedor que usan sus compras o sus documentos de caja chica; el proveedor 0 («SIN PROVEEDOR ASIGNADO») queda con el código 999999.
--     NIT que no es NIT, en cero o repetido en la misma empresa: queda vacío y el del archivo en nit_anterior. COD_ANTERIOR va a la columna
--     nueva codigo_sistema_anterior; FECHA_BK a fecha_respaldo_anterior; ESTADO A/I/B = ACTIVO/INACTIVO/BLOQUEADO.
--   Compras: cada una conserva su número (COMPRA); origen_anterior = 'VARIAS' y compra_anterior = COMPRA. Las compras registradas en el sistema
--     con esos números pasan después del último. Quetzales con cambio 1 (MONEDA_INTEGRACION y VALOR_CAMBIO quedan como dato).
--     4360 compras con valor cero o negativo (4190 notas de crédito de la SAT): el sistema no admite compras sin valor;
--       quedan en la tabla nueva compras_anteriores_sin_valor, con todos sus datos. Sus 10910 líneas contables no se migran.
--     2881 documentos repetidos (mismo proveedor, serie y número): al segundo se le agrega « (2)»; el original queda en documento_anterior.
--     4 fechas de documento fuera de rango: queda la fecha de ingreso; la del archivo en fecha_documento_anterior.
--     El exento de Consisav incluye el IDP de los galones; el sistema lo calcula aparte: el exento queda sin el IDP (el del archivo en
--       exento_anterior). Si aun así no alcanza el valor, los galones quedan en cero y los del archivo en galones_*_anterior.
--     Columnas nuevas: sucursal_anterior (SUCURSAL), archivo_anterior (ARCHIVO), migrada_sat (MIGRADA_SAT), revisada_anterior (REVISADA),
--       tipo_documento_anterior (TIPO_DOCUMENTO), tipo_docto_anterior (TIPO_DOCTO), clasificacion_anterior (CLASIFICACION), moneda_integracion
--       (MONEDA_INTEGRACION), fecha_presentacion_anterior (FECHA_PRESENTACION, también en mes y año de presentación), transaccion_tipo_anterior
--       (TRANSACCION), forma_pago_anterior (FORMA_PAGO) y galones_super_anterior, galones_regular_anterior y galones_diesel_anterior.
--       CUENTA_CON va a cuenta_contable_anterior; AÑO, MES y POLIZA a poliza_anio, poliza_mes y poliza_numero.
--     Columnas vacías en todo el archivo: CUENTA_BANCARIA, NUMERO_CHEQUE, FECHA_ESTIMADA_PAGO, FECHA_REVISION, USUARIO_REVISA.
--   Detalle contable: por compra y LINEA; la cuenta en el catálogo versión 1 de la empresa. 10862 valores negativos pasan al otro lado;
--     débito y crédito en la misma línea se compensan; las líneas en cero o con cuenta 0 se omiten (se informan).
--   Documentos de caja chica: a la subcaja (script 325) por CAJA, SUBCAJA y MOVIMIENTO (= línea), con su proveedor, cuenta y clasificación.
--   Los datos (CSV y partes 1 en adelante) traen NIT, nombres y cuentas bancarias: quedan solo en la computadora (no se publican).

-- ---------- Columnas nuevas ----------
alter table public.compras add column if not exists sucursal_anterior text;
alter table public.compras add column if not exists archivo_anterior integer;
alter table public.compras add column if not exists migrada_sat boolean;
alter table public.compras add column if not exists revisada_anterior text;
alter table public.compras add column if not exists tipo_documento_anterior text;
alter table public.compras add column if not exists tipo_docto_anterior integer;
alter table public.compras add column if not exists clasificacion_anterior integer;
alter table public.compras add column if not exists moneda_integracion integer;
alter table public.compras add column if not exists fecha_presentacion_anterior date;
alter table public.compras add column if not exists transaccion_tipo_anterior text;
alter table public.compras add column if not exists forma_pago_anterior text;
alter table public.compras add column if not exists galones_super_anterior numeric;
alter table public.compras add column if not exists galones_regular_anterior numeric;
alter table public.compras add column if not exists galones_diesel_anterior numeric;
alter table public.compras add column if not exists origen_anterior text;
alter table public.compras add column if not exists compra_anterior integer;
alter table public.compras add column if not exists modulo_factura integer;
alter table public.compras add column if not exists usuario_modifica_anterior text;
alter table public.compras add column if not exists fecha_modifica_anterior date;
alter table public.compras add column if not exists tipo_compra_anterior text;
alter table public.compras add column if not exists poliza_anio integer;
alter table public.compras add column if not exists poliza_mes integer;
alter table public.compras add column if not exists poliza_numero integer;
alter table public.compras add column if not exists pct_iva numeric;
alter table public.compras add column if not exists valor_cambio_anterior numeric;
alter table public.compras add column if not exists documento_anterior text;
alter table public.compras add column if not exists proveedor_anterior integer;
alter table public.compras add column if not exists transaccion_anterior integer;
alter table public.compras add column if not exists fecha_ingreso_anterior timestamp;
alter table public.compras add column if not exists usuario_anula_anterior text;
alter table public.compras add column if not exists fecha_anula_anterior timestamp;
alter table public.compras add column if not exists exento_anterior numeric;
alter table public.compras add column if not exists fecha_documento_anterior text;
alter table public.compras add column if not exists cuenta_contable_anterior text;
alter table public.compras add column if not exists numero_cheque text;
alter table public.compras add column if not exists cuenta_bancaria_anterior text;
alter table public.compras add column if not exists liquidacion_anterior integer;
alter table public.compras add column if not exists valor_liquidado_anterior numeric;
create unique index if not exists compras_origen_anterior_uk on public.compras (localidad_id, origen_anterior, compra_anterior) where origen_anterior is not null;
alter table public.proveedores add column if not exists codigo_sistema_anterior text;
alter table public.proveedores add column if not exists nit_anterior text;
alter table public.proveedores add column if not exists fax text;
alter table public.proveedores add column if not exists origen text;
alter table public.proveedores add column if not exists mostrar boolean;
alter table public.proveedores add column if not exists banco_anterior integer;
alter table public.proveedores add column if not exists tipo_anterior integer;
alter table public.proveedores add column if not exists proveedor_anterior integer;
alter table public.proveedores add column if not exists origen_anterior text;
alter table public.proveedores add column if not exists fecha_respaldo_anterior timestamp;
alter table public.compra_lineas add column if not exists cuenta_codigo_anterior text;
alter table public.compra_lineas add column if not exists debe_anterior numeric(18, 2);
alter table public.compra_lineas add column if not exists haber_anterior numeric(18, 2);
alter table public.compra_lineas add column if not exists reconstruida boolean not null default false;
alter table public.caja_documentos add column if not exists origen_anterior text;
alter table public.caja_documentos add column if not exists movimiento_anterior integer;
alter table public.caja_documentos add column if not exists tipo_documento_anterior integer;
alter table public.caja_documentos add column if not exists tipo_docto_anterior integer;
alter table public.caja_documentos add column if not exists tipo_documento_id bigint references public.tipos_documento_compra (id);
alter table public.caja_documentos add column if not exists clasificacion_anterior integer;
alter table public.caja_documentos add column if not exists clasificacion_id bigint references public.clasificaciones_compra (id);
alter table public.caja_documentos add column if not exists proveedor_id bigint references public.proveedores (id);
alter table public.caja_documentos add column if not exists valor_anterior numeric(18, 2);
alter table public.caja_documentos add column if not exists moneda_integracion integer;
alter table public.caja_documentos add column if not exists valor_cambio_anterior numeric(18, 6);
alter table public.caja_documentos add column if not exists anticipo boolean;
alter table public.caja_documentos add column if not exists cuenta_codigo_anterior text;
alter table public.caja_documentos add column if not exists exento_anterior numeric(18, 2);
alter table public.caja_documentos add column if not exists fecha_ingreso_anterior timestamp;
-- Solo los documentos migrados pueden tener total cero o negativo (ajustes del sistema anterior), como en los scripts 122, 187 y 255.
alter table public.caja_documentos drop constraint if exists caja_documentos_total_check;
alter table public.caja_documentos add constraint caja_documentos_total_check check (total > 0 or origen_anterior = 'MIGRADO');
alter table public.clasificaciones_compra add column if not exists tipo text;

-- ---------- Tablas nuevas ----------
create table if not exists public.equivalencias_anteriores (
  sistema text not null, catalogo text not null, codigo_anterior integer not null, nombre_anterior text, registro_id bigint not null,
  primary key (sistema, catalogo, codigo_anterior));
comment on table public.equivalencias_anteriores is 'Equivalencia de los códigos de catálogos de un sistema anterior con los registros del sistema (catalogo = nombre de la tabla).';
create table if not exists public.tipos_documento_sat_anteriores (
  sistema text not null, codigo text not null, nombre text not null, tipo_documento_anterior integer, tipo_documento_id bigint references public.tipos_documento_compra (id),
  primary key (sistema, codigo));
create table if not exists public.proveedores_anteriores (
  sistema text not null, codigo integer not null, nombre text, nit text, telefonos text, contacto text, direccion text, fax text, descripcion_general text,
  tipo_proveedor integer, origen text, critico boolean, nombre_comercial text, efectuar_retencion boolean, nombre_emision text, cuenta_bancaria text, banco integer,
  estado text, codigo_sistema_anterior text, pendiente_revisar boolean, mostrar boolean, dias_credito integer, fecha_respaldo timestamp,
  primary key (sistema, codigo));
comment on table public.proveedores_anteriores is 'Lista completa de proveedores de un sistema anterior que no los separaba por empresa (Consisav). Cada empresa tiene en proveedores los que usa.';
create table if not exists public.compras_anteriores_sin_valor (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  compra integer not null, documento text, serie text, fecha_documento date, fecha_documento_anterior text, proveedor_codigo integer, proveedor_id bigint references public.proveedores (id) on delete set null,
  nit text, valor_total numeric(18, 2), exento numeric(18, 2), tipo_docto_anterior integer, tipo_documento_id bigint references public.tipos_documento_compra (id),
  clasificacion_anterior integer, clasificacion_id bigint references public.clasificaciones_compra (id), estado text, descripcion text, usuario text, fecha_ingreso timestamp,
  transaccion_anterior integer, moneda_integracion integer, valor_cambio numeric, poliza_anio integer, poliza_mes integer, poliza_numero integer, pct_iva numeric,
  sucursal text, archivo integer, migrada_sat boolean, fecha_presentacion date, cuenta_contable_anterior text, galones_super numeric, galones_regular numeric, galones_diesel numeric,
  usuario_anula text, fecha_anula timestamp, usuario_modifica text, fecha_modifica date,
  unique (localidad_id, compra));
comment on table public.compras_anteriores_sin_valor is 'Compras de un sistema anterior con valor cero o negativo (notas de crédito de la SAT): el sistema no admite compras sin valor.';
do $$
declare t text;
begin
  foreach t in array array['equivalencias_anteriores', 'tipos_documento_sat_anteriores', 'proveedores_anteriores', 'compras_anteriores_sin_valor'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || ': leer', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.usuario_activo())', t || ': leer', t);
    execute format('drop policy if exists %I on public.%I', t || ': escribir', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t || ': escribir', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- ---------- Catálogos: se buscan por nombre (sin tildes); los que faltan se crean con el código siguiente ----------
do $cat$
declare r record; v_id bigint; v_n int := 0;
begin
  for r in select * from (values (1, 'FACTURA', 'NORMAL', false), (2, 'NOTA DE CREDITO', 'NORMAL', false), (3, 'POLIZA', 'SIN IVA', false), (6, 'TICKET', 'NORMAL', false), (4, 'FACTURA ELECTRONICA', 'NORMAL', false), (5, 'RECIBO', 'NORMAL', true), (7, 'COMPROBANTE', 'SIN IVA', false), (8, 'OTROS', 'SIN IVA', false), (9, 'NOTA DE DEBITO', 'NORMAL', false), (10, 'FACTURA ESPECIAL', 'NORMAL', false)) as x(cod, nombre, iva, recibo) loop
    select id into v_id from public.tipos_documento_compra where translate(upper(trim(nombre)), 'ÁÉÍÓÚ', 'AEIOU') = r.nombre order by codigo limit 1;
    if v_id is null then
      insert into public.tipos_documento_compra (codigo, nombre, calculo_iva, es_recibo, activo)
      values ((select coalesce(max(codigo), 0) + 1 from public.tipos_documento_compra), r.nombre, r.iva, r.recibo, true) returning id into v_id;
      v_n := v_n + 1;
    end if;
    insert into public.equivalencias_anteriores values ('CONSISAV', 'tipos_documento_compra', r.cod, r.nombre, v_id)
    on conflict (sistema, catalogo, codigo_anterior) do update set nombre_anterior = excluded.nombre_anterior, registro_id = excluded.registro_id;
  end loop;
  for r in select * from (values (0, 'VENTAS', false, false, null, null), (1, 'SIN CLASIFICACION VALIDA', false, true, 'N', '0'), (2, 'SERVICIOS', true, true, 'S', 'SER'), (3, 'BIENES EXENTOS', true, false, 'E', 'EXE'), (4, 'BIENES', true, true, 'B', 'BIE'), (5, 'COMBUSTIBLES', true, true, 'C', 'GAS'), (6, 'GASTOS ADMINISTRATIVOS', false, false, 'N', null), (7, 'IMPORTACIONES', true, false, 'I', 'IMP'), (8, 'SERVICIOS EXENTOS', true, false, 'E', 'EXES'), (9, 'EXENTOS IMPORTACION', true, false, 'I', 'IMPE'), (10, 'ACTIVOS', true, true, 'A', 'ACT')) as x(cod, nombre, libro, iva, tipo, siglas) loop
    select id into v_id from public.clasificaciones_compra where translate(upper(trim(nombre)), 'ÁÉÍÓÚ', 'AEIOU') = r.nombre order by codigo limit 1;
    if v_id is null then
      insert into public.clasificaciones_compra (codigo, nombre, siglas, libro_compras, aplica_iva, activo, tipo)
      values ((select coalesce(max(codigo), 0) + 1 from public.clasificaciones_compra), r.nombre,
              case when upper(r.siglas) ~ '^[A-Z0-9]{1,6}$' and not exists (select 1 from public.clasificaciones_compra k where k.siglas = upper(r.siglas)) then upper(r.siglas) end,
              r.libro, r.iva, true, r.tipo) returning id into v_id;
      v_n := v_n + 1;
    end if;
    insert into public.equivalencias_anteriores values ('CONSISAV', 'clasificaciones_compra', r.cod, r.nombre, v_id)
    on conflict (sistema, catalogo, codigo_anterior) do update set nombre_anterior = excluded.nombre_anterior, registro_id = excluded.registro_id;
  end loop;
  for r in select * from (values (2, 'CLIENTE'), (1, 'GENERAL')) as x(cod, nombre) loop
    select id into v_id from public.tipos_proveedor where translate(upper(trim(nombre)), 'ÁÉÍÓÚ', 'AEIOU') = r.nombre order by codigo limit 1;
    if v_id is null then
      insert into public.tipos_proveedor (codigo, nombre) values ((select coalesce(max(codigo), 0) + 1 from public.tipos_proveedor), r.nombre) returning id into v_id;
      v_n := v_n + 1;
    end if;
    insert into public.equivalencias_anteriores values ('CONSISAV', 'tipos_proveedor', r.cod, r.nombre, v_id)
    on conflict (sistema, catalogo, codigo_anterior) do update set nombre_anterior = excluded.nombre_anterior, registro_id = excluded.registro_id;
  end loop;
  insert into public.tipos_documento_sat_anteriores (sistema, codigo, nombre, tipo_documento_anterior, tipo_documento_id)
  select 'CONSISAV', x.codigo, x.nombre, x.tipo, e.registro_id
  from (values ('FACT', 'FACTURA', 1), ('FCAM', 'FACTURA CAMBIARIA', 1), ('FPEQ', 'FACTURA PEQUEÑO CONTRIBUYENTE', 1), ('FCAP', 'FACTURA CAMBIARIA PEQUEÑO CONTRIBUYENTE', 1), ('FESP', 'FACTURA ESPECIAL', 10), ('NABN', 'NOTA DE ABONO', 2), ('RDON', 'RECIBO POR DONACION', 5), ('RECI', 'RECIBO', 5), ('NDEB', 'NOTA DE DEBITO', 9), ('NCRE', 'NOTA DE CREDITO', 2), ('FAPE', 'FACTURA REGIMEN ELECTRONICO PEQUEÑO CONTRIBUYENTE', 1)) as x(codigo, nombre, tipo)
  left join public.equivalencias_anteriores e on e.sistema = 'CONSISAV' and e.catalogo = 'tipos_documento_compra' and e.codigo_anterior = x.tipo
  on conflict (sistema, codigo) do update set nombre = excluded.nombre, tipo_documento_anterior = excluded.tipo_documento_anterior, tipo_documento_id = excluded.tipo_documento_id;
  raise notice 'Catálogos de compras: % registros creados.', v_n;
end;
$cat$;

-- ---------- Tablas de carga (todas sus columnas son texto; se llenan importando los CSV; la última parte las borra) ----------
create table if not exists public.mig328_proveedores (proveedor text, nombre text, nit text, telefonos text, contacto text, direccion text, fax text, descripcion_general text, tipo_proveedor text, origen text, critico text, nombre_comercial text, efectuar_retencion text, nombre_emision text, cuenta_bancaria text, banco text, estado text, cod_anterior text, pendiente_revisar text, mostrar text, dias_credito text, fecha_bk text);
create table if not exists public.mig328_compras (org text, loc text, compra text, documento text, documento_ant text, fecha_doc text, fecha_doc_ant text, proveedor text, valor text, descripcion text, tipo_trx text, usuario text, fecha_ingreso text, estado text, usuario_anula text, fecha_anula text, moneda_int text, valor_cambio text, fecha_modifica text, anio text, mes text, poliza text, clasif text, pct_iva text, usuario_modifica text, serie text, sucursal text, nit text, tipo_docto text, gal_super text, gal_regular text, gal_diesel text, exento text, fecha_pres text, archivo text, migrada_sat text, cuenta_con text);
create table if not exists public.mig328_detalle (org text, loc text, compra text, linea text, cuenta text, debito text, credito text);
create table if not exists public.mig328_movimientos (org text, loc text, caja text, subcaja text, movimiento text, documento text, tipo_documento text, fecha_doc text, proveedor text, valor text, descripcion text, cuenta text, clasif text, moneda_int text, valor_cambio text, pct_iva text, usuario text, fecha_ingreso text, anticipo text, serie text, tipo_docto text, exento text);
create index if not exists mig328_compras_idx on public.mig328_compras (org, loc);
create index if not exists mig328_detalle_idx on public.mig328_detalle (org, loc, compra);
do $$
declare t text;
begin
  foreach t in array array['mig328_proveedores', 'mig328_compras', 'mig328_detalle', 'mig328_movimientos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- ---------- Revisión de la carga: filas por tabla frente a las de los archivos ----------
create or replace function public.mig328_revisar_carga() returns table (tabla text, filas_cargadas bigint, filas_esperadas bigint, filas_repetidas bigint)
language plpgsql set search_path = '' as $fn$
begin
  return query
  select 'mig328_proveedores', (select count(*) from public.mig328_proveedores), 39984::bigint,
         (select count(*) - count(distinct proveedor) from public.mig328_proveedores)
  union all select 'mig328_compras', (select count(*) from public.mig328_compras), 423999::bigint,
         (select count(*) - count(distinct (org, loc, compra)) from public.mig328_compras)
  union all select 'mig328_detalle', (select count(*) from public.mig328_detalle), 1041820::bigint,
         (select count(*) - count(distinct (org, loc, compra, linea)) from public.mig328_detalle)
  union all select 'mig328_movimientos', (select count(*) from public.mig328_movimientos), 29019::bigint,
         (select count(*) - count(distinct (org, loc, caja, subcaja, movimiento)) from public.mig328_movimientos);
end;
$fn$;

-- Quita filas repetidas de las tablas de carga (si un CSV se importó dos veces).
create or replace function public.mig328_quitar_repetidas() returns text
language plpgsql set search_path = '' as $fn$
declare t text; v_n int; v_res text := '';
begin
  foreach t in array array['mig328_proveedores', 'mig328_compras', 'mig328_detalle', 'mig328_movimientos'] loop
    execute format('delete from public.%I where ctid in (select ctid from (select ctid, row_number() over (partition by x::text order by ctid) as rn from public.%I x) y where rn > 1)', t, t);
    get diagnostics v_n = row_count;
    v_res := v_res || format('%s: %s. ', t, v_n);
  end loop;
  return 'Filas repetidas quitadas: ' || v_res;
end;
$fn$;

-- ---------- Proveedores: lista completa y los de cada empresa ----------
create or replace function public.mig328_proveedores(p_org int) returns text
language plpgsql set search_path = '' as $fn$
declare v_org bigint; v_lista int := 0; v_n int; v_a int; v_nit int; v_omit text;
begin
  select id into v_org from public.organizaciones where upper(organizacion_anterior) = 'CONSISAV-' || p_org;
  if v_org is null then raise exception 'No existe la organización CONSISAV-% (ejecuta antes el script 321).', p_org; end if;
  if p_org = 8 then
    insert into public.proveedores_anteriores (sistema, codigo, nombre, nit, telefonos, contacto, direccion, fax, descripcion_general, tipo_proveedor, origen, critico, nombre_comercial,
      efectuar_retencion, nombre_emision, cuenta_bancaria, banco, estado, codigo_sistema_anterior, pendiente_revisar, mostrar, dias_credito, fecha_respaldo)
    select 'CONSISAV', proveedor::int, nullif(trim(nombre), ''), nullif(trim(nit), ''), nullif(trim(telefonos), ''), nullif(trim(contacto), ''), nullif(trim(direccion), ''),
      nullif(trim(fax), ''), nullif(trim(descripcion_general), ''), nullif(trim(tipo_proveedor), '')::int, nullif(trim(origen), ''), nullif(trim(critico), '') = 'S',
      nullif(trim(nombre_comercial), ''), nullif(trim(efectuar_retencion), '') = 'S', nullif(trim(nombre_emision), ''), nullif(trim(cuenta_bancaria), ''), nullif(trim(banco), '')::int,
      nullif(trim(estado), ''), nullif(trim(cod_anterior), ''), nullif(trim(pendiente_revisar), '') = 'S', nullif(trim(mostrar), '') = 'S', nullif(trim(dias_credito), '')::int,
      nullif(trim(fecha_bk), '')::timestamp
    from public.mig328_proveedores
    on conflict (sistema, codigo) do update set nombre = excluded.nombre, nit = excluded.nit, telefonos = excluded.telefonos, contacto = excluded.contacto, direccion = excluded.direccion,
      fax = excluded.fax, descripcion_general = excluded.descripcion_general, tipo_proveedor = excluded.tipo_proveedor, origen = excluded.origen, critico = excluded.critico,
      nombre_comercial = excluded.nombre_comercial, efectuar_retencion = excluded.efectuar_retencion, nombre_emision = excluded.nombre_emision, cuenta_bancaria = excluded.cuenta_bancaria,
      banco = excluded.banco, estado = excluded.estado, codigo_sistema_anterior = excluded.codigo_sistema_anterior, pendiente_revisar = excluded.pendiente_revisar,
      mostrar = excluded.mostrar, dias_credito = excluded.dias_credito, fecha_respaldo = excluded.fecha_respaldo;
    get diagnostics v_lista = row_count;
  end if;

  -- Proveedores que usa cada empresa (compras y documentos de caja chica).
  drop table if exists t328_pv;
  create temp table t328_pv on commit drop as
    select u.loc, u.codigo, l.id as loc_id, a.nombre, a.nit, a.telefonos, a.contacto, a.direccion, a.fax, a.descripcion_general, a.tipo_proveedor, a.origen, a.critico,
           a.nombre_comercial, a.efectuar_retencion, a.nombre_emision, a.cuenta_bancaria, a.banco, a.estado, a.codigo_sistema_anterior, a.pendiente_revisar, a.mostrar,
           a.dias_credito, a.fecha_respaldo,
           case when a.nit ~ '^([0-9]{1,12}-?[0-9K]|CF|C/F)$' and regexp_replace(a.nit, '[^1-9K]', '', 'g') <> '' then a.nit end as nit_ok
    from (select distinct loc::int as loc, proveedor::int as codigo from public.mig328_compras where org::int = p_org
          union select distinct loc::int, proveedor::int from public.mig328_movimientos where org::int = p_org) u
    left join public.localidades l on l.organizacion_id = v_org and l.correlativo = u.loc
    left join public.proveedores_anteriores a on a.sistema = 'CONSISAV' and a.codigo = u.codigo;
  select string_agg(distinct loc::text, ', ') into v_omit from t328_pv where loc_id is null;
  delete from t328_pv where loc_id is null;
  -- NIT repetido en la misma empresa (en el archivo o con otro proveedor ya registrado): queda vacío.
  update t328_pv t set nit_ok = null from (
    select loc_id, codigo, row_number() over (partition by loc_id, nit_ok order by codigo) as rn from t328_pv where nit_ok is not null and nit_ok not in ('CF', 'C/F')) d
  where d.loc_id = t.loc_id and d.codigo = t.codigo and d.rn > 1;
  update t328_pv t set nit_ok = null
  where t.nit_ok is not null and t.nit_ok not in ('CF', 'C/F')
    and exists (select 1 from public.proveedores p where p.localidad_id = t.loc_id and p.nit = t.nit_ok and p.codigo <> t.codigo);
  select count(*) into v_nit from t328_pv where nit is not null and nit_ok is null;

  update public.proveedores p set nit = t.nit_ok, nit_anterior = t.nit, nombre_comercial = coalesce(t.nombre_comercial, t.nombre, 'PROVEEDOR ' || t.codigo),
    nombre_fiscal = t.nombre, nombre_emision = t.nombre_emision, direccion = t.direccion, telefonos = t.telefonos, contacto = t.contacto, fax = t.fax,
    concepto_gastos = coalesce(t.descripcion_general, 'POR DEFINIR'), servicio_critico = coalesce(t.critico, false), pendiente_revisar = coalesce(t.pendiente_revisar, t.nombre is null),
    tipo_proveedor_id = (select e.registro_id from public.equivalencias_anteriores e where e.sistema = 'CONSISAV' and e.catalogo = 'tipos_proveedor' and e.codigo_anterior = t.tipo_proveedor),
    tipo_anterior = t.tipo_proveedor, estado = case t.estado when 'I' then 'INACTIVO' when 'B' then 'BLOQUEADO' else 'ACTIVO' end, dias_credito = coalesce(t.dias_credito, 0),
    efectuar_retencion = coalesce(t.efectuar_retencion, false), banco_id = (select b.id from public.bancos b where b.localidad_id = t.loc_id and b.codigo = t.banco),
    banco_anterior = t.banco, cuenta_bancaria = t.cuenta_bancaria, origen = t.origen, mostrar = t.mostrar, codigo_sistema_anterior = t.codigo_sistema_anterior,
    fecha_respaldo_anterior = t.fecha_respaldo, proveedor_anterior = t.codigo, origen_anterior = 'MIGRADO'
  from t328_pv t where p.localidad_id = t.loc_id and p.codigo = t.codigo;
  get diagnostics v_a = row_count;
  insert into public.proveedores (organizacion_id, localidad_id, codigo, nit, nit_anterior, nombre_comercial, nombre_fiscal, nombre_emision, direccion, telefonos, contacto, fax,
    concepto_gastos, servicio_critico, pendiente_revisar, tipo_proveedor_id, tipo_anterior, estado, dias_credito, efectuar_retencion, banco_id, banco_anterior, cuenta_bancaria,
    origen, mostrar, codigo_sistema_anterior, fecha_respaldo_anterior, proveedor_anterior, origen_anterior)
  select v_org, t.loc_id, t.codigo, t.nit_ok, t.nit, coalesce(t.nombre_comercial, t.nombre, 'PROVEEDOR ' || t.codigo), t.nombre, t.nombre_emision, t.direccion, t.telefonos,
    t.contacto, t.fax, coalesce(t.descripcion_general, 'POR DEFINIR'), coalesce(t.critico, false), coalesce(t.pendiente_revisar, t.nombre is null),
    (select e.registro_id from public.equivalencias_anteriores e where e.sistema = 'CONSISAV' and e.catalogo = 'tipos_proveedor' and e.codigo_anterior = t.tipo_proveedor),
    t.tipo_proveedor, case t.estado when 'I' then 'INACTIVO' when 'B' then 'BLOQUEADO' else 'ACTIVO' end, coalesce(t.dias_credito, 0), coalesce(t.efectuar_retencion, false),
    (select b.id from public.bancos b where b.localidad_id = t.loc_id and b.codigo = t.banco), t.banco, t.cuenta_bancaria, t.origen, t.mostrar, t.codigo_sistema_anterior,
    t.fecha_respaldo, t.codigo, 'MIGRADO'
  from t328_pv t where not exists (select 1 from public.proveedores p where p.localidad_id = t.loc_id and p.codigo = t.codigo);
  get diagnostics v_n = row_count;
  return format('CONSISAV-%s: %s proveedores nuevos y %s actualizados en sus empresas; %s con NIT inválido o repetido (queda en nit_anterior).', p_org, v_n, v_a, v_nit)
    || case when v_lista > 0 then format(' Lista completa de proveedores (proveedores_anteriores): %s.', v_lista) else '' end
    || case when v_omit is not null then ' Empresas que no existen (omitidas): LOCALIDAD ' || v_omit || '.' else '' end;
end;
$fn$;

-- ---------- Compras (por rango de LOCALIDAD del sistema anterior) ----------
create or replace function public.mig328_compras(p_org int, p_desde int, p_hasta int) returns text
language plpgsql set search_path = '' as $fn$
declare v_org bigint; v_gtq bigint; v_omit text; v_ren int := 0; v_k int; v_n int; v_a int; v_doc int; v_sv int; v_gal int; v_l record;
begin
  select id into v_org from public.organizaciones where upper(organizacion_anterior) = 'CONSISAV-' || p_org;
  if v_org is null then raise exception 'No existe la organización CONSISAV-% (ejecuta antes el script 321).', p_org; end if;
  select id into v_gtq from public.monedas where iso = 'GTQ';
  -- Carga de datos históricos: los períodos fiscales cerrados no la bloquean.
  perform set_config('fin.migracion', 'si', true);

  drop table if exists t328_c;
  create temp table t328_c on commit drop as
    select l.id as loc_id, m.loc::int as loc, m.compra::int as compra, upper(trim(m.documento)) as documento, nullif(trim(m.documento_ant), '') as documento_ant,
           nullif(trim(m.fecha_doc), '')::date as fecha_doc, nullif(trim(m.fecha_doc_ant), '') as fecha_doc_ant, m.proveedor::int as proveedor, m.valor::numeric as valor,
           nullif(trim(m.descripcion), '') as descripcion, nullif(nullif(trim(m.tipo_trx), ''), '0')::int as tipo_trx, nullif(trim(m.usuario), '') as usuario,
           nullif(trim(m.fecha_ingreso), '')::timestamp as fecha_ingreso, trim(m.estado) as estado, nullif(trim(m.usuario_anula), '') as usuario_anula,
           nullif(trim(m.fecha_anula), '')::timestamp as fecha_anula, nullif(trim(m.moneda_int), '')::int as moneda_int, nullif(trim(m.valor_cambio), '')::numeric as valor_cambio,
           nullif(trim(m.fecha_modifica), '')::date as fecha_modifica, nullif(trim(m.anio), '')::int as anio, nullif(trim(m.mes), '')::int as mes, nullif(trim(m.poliza), '')::int as poliza,
           nullif(trim(m.clasif), '')::int as clasif, nullif(trim(m.pct_iva), '')::numeric as pct_iva, nullif(trim(m.usuario_modifica), '') as usuario_modifica,
           nullif(upper(trim(m.serie)), '') as serie, nullif(trim(m.sucursal), '') as sucursal, nullif(upper(trim(m.nit)), '') as nit, nullif(trim(m.tipo_docto), '')::int as tipo_docto,
           coalesce(nullif(trim(m.gal_super), '')::numeric, 0) as gs, coalesce(nullif(trim(m.gal_regular), '')::numeric, 0) as gr, coalesce(nullif(trim(m.gal_diesel), '')::numeric, 0) as gd,
           coalesce(nullif(trim(m.exento), '')::numeric, 0) as exento_ant, nullif(trim(m.fecha_pres), '')::date as fecha_pres, nullif(trim(m.archivo), '')::int as archivo,
           nullif(trim(m.migrada_sat), '') = 'S' as migrada_sat, nullif(trim(m.cuenta_con), '') as cuenta_con,
           td.registro_id as td_id, cl.registro_id as cl_id, coalesce(t.es_recibo, false) as recibo, coalesce(t.calculo_iva, 'NORMAL') as calculo_iva,
           g.idp_super, g.idp_regular, g.idp_diesel
    from public.mig328_compras m
    join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc::int
    left join public.equivalencias_anteriores td on td.sistema = 'CONSISAV' and td.catalogo = 'tipos_documento_compra' and td.codigo_anterior = nullif(trim(m.tipo_docto), '')::int
    left join public.tipos_documento_compra t on t.id = td.registro_id
    left join public.equivalencias_anteriores cl on cl.sistema = 'CONSISAV' and cl.catalogo = 'clasificaciones_compra' and cl.codigo_anterior = nullif(trim(m.clasif), '')::int
    left join lateral (select x.idp_super, x.idp_regular, x.idp_diesel from public.parametros_generales x where x.localidad_id = l.id order by x.id limit 1) g on true
    where m.org::int = p_org and m.loc::int between p_desde and p_hasta;
  select string_agg(distinct x.loc::text, ', ') into v_omit
  from (select distinct loc::int as loc from public.mig328_compras where org::int = p_org and loc::int between p_desde and p_hasta) x
  where not exists (select 1 from public.localidades l where l.organizacion_id = v_org and l.correlativo = x.loc);

  -- Compras con valor cero o negativo: a la tabla de referencia.
  insert into public.compras_anteriores_sin_valor (organizacion_id, localidad_id, compra, documento, serie, fecha_documento, fecha_documento_anterior, proveedor_codigo, proveedor_id, nit,
    valor_total, exento, tipo_docto_anterior, tipo_documento_id, clasificacion_anterior, clasificacion_id, estado, descripcion, usuario, fecha_ingreso, transaccion_anterior,
    moneda_integracion, valor_cambio, poliza_anio, poliza_mes, poliza_numero, pct_iva, sucursal, archivo, migrada_sat, fecha_presentacion, cuenta_contable_anterior,
    galones_super, galones_regular, galones_diesel, usuario_anula, fecha_anula, usuario_modifica, fecha_modifica)
  select v_org, c.loc_id, c.compra, c.documento, c.serie, c.fecha_doc, c.fecha_doc_ant, c.proveedor, (select p.id from public.proveedores p where p.localidad_id = c.loc_id and p.codigo = c.proveedor),
    c.nit, c.valor, c.exento_ant, c.tipo_docto, c.td_id, c.clasif, c.cl_id, c.estado, c.descripcion, c.usuario, c.fecha_ingreso, c.tipo_trx, c.moneda_int, c.valor_cambio, c.anio, c.mes,
    c.poliza, c.pct_iva, c.sucursal, c.archivo, c.migrada_sat, c.fecha_pres, c.cuenta_con, c.gs, c.gr, c.gd, c.usuario_anula, c.fecha_anula, c.usuario_modifica, c.fecha_modifica
  from t328_c c where not (c.valor > 0)
  on conflict (localidad_id, compra) do update set documento = excluded.documento, serie = excluded.serie, fecha_documento = excluded.fecha_documento, proveedor_id = excluded.proveedor_id,
    nit = excluded.nit, valor_total = excluded.valor_total, exento = excluded.exento, tipo_documento_id = excluded.tipo_documento_id, clasificacion_id = excluded.clasificacion_id,
    estado = excluded.estado, descripcion = excluded.descripcion;
  get diagnostics v_sv = row_count;
  delete from t328_c where not (valor > 0);

  -- IDP: el exento de Consisav ya lo incluye; el sistema lo calcula aparte por los galones.
  alter table t328_c add column idp numeric, add column exento numeric, add column gal_cero boolean;
  update t328_c set idp = round(gs * coalesce(idp_super, 0) + gr * coalesce(idp_regular, 0) + gd * coalesce(idp_diesel, 0), 2);
  update t328_c set exento = least(greatest(exento_ant - idp, 0), valor), gal_cero = false;
  update t328_c set gal_cero = true, exento = least(exento_ant, valor), idp = 0 where valor - exento - idp < 0;
  select count(*) into v_gal from t328_c where gal_cero;

  -- Las compras registradas en el sistema con números del archivo pasan después del último.
  for v_l in select loc_id, max(compra) as maximo from t328_c group by loc_id loop
    update public.compras c set numero = greatest((select coalesce(max(numero), 0) from public.compras where localidad_id = v_l.loc_id), v_l.maximo) + q.fila
    from (select id, row_number() over (order by numero) as fila from public.compras
          where localidad_id = v_l.loc_id and origen_anterior is null and numero <= v_l.maximo) q
    where c.id = q.id;
    get diagnostics v_k = row_count; v_ren := v_ren + v_k;
  end loop;

  alter table public.compras disable trigger compras_preparar;
  with x as (
    insert into public.compras (organizacion_id, localidad_id, numero, tipo_documento, tipo_documento_id, serie, documento, fecha_documento, fecha_ingreso, tipo_tercero,
      proveedor_id, proveedor_codigo, proveedor_nombre, nit, beneficiario, transaccion_id, descripcion, moneda_id, tipo_cambio, valor_total, forma_pago, estado, anulado_por, anulado_en,
      motivo_anulacion, usuario, mes_presentacion, anio_presentacion, clasificacion_id, galones_super, galones_regular, galones_diesel, exento,
      origen_anterior, compra_anterior, modulo_factura, usuario_modifica_anterior, fecha_modifica_anterior, tipo_compra_anterior, poliza_anio, poliza_mes, poliza_numero, pct_iva,
      valor_cambio_anterior, documento_anterior, proveedor_anterior, transaccion_anterior, fecha_ingreso_anterior, usuario_anula_anterior, fecha_anula_anterior, exento_anterior,
      fecha_documento_anterior, cuenta_contable_anterior, sucursal_anterior, archivo_anterior, migrada_sat, revisada_anterior, tipo_documento_anterior, tipo_docto_anterior,
      clasificacion_anterior, moneda_integracion, fecha_presentacion_anterior, transaccion_tipo_anterior, forma_pago_anterior, galones_super_anterior, galones_regular_anterior,
      galones_diesel_anterior)
    select v_org, c.loc_id, c.compra, case when c.recibo then 'RECIBO' else 'FACTURA' end, c.td_id, c.serie,
      case when c.estado = 'V' and exists (select 1 from public.compras e where e.localidad_id = c.loc_id and e.origen_anterior is null and e.estado = 'ACTIVA'
        and e.tipo_documento = case when c.recibo then 'RECIBO' else 'FACTURA' end and upper(coalesce(e.proveedor_codigo, e.proveedor_nombre)) = c.proveedor::text
        and upper(coalesce(e.serie, '')) = coalesce(c.serie, '') and upper(e.documento) = c.documento) then c.documento || ' (MIGRADA)' else c.documento end,
      coalesce(c.fecha_doc, c.fecha_ingreso::date), coalesce(c.fecha_ingreso::date, c.fecha_doc), 'PROVEEDOR SERVICIOS',
      p.id, c.proveedor::text, upper(coalesce(nullif(trim(p.nombre_emision), ''), p.nombre_comercial, 'PROVEEDOR ' || c.proveedor)), c.nit,
      upper(coalesce(nullif(trim(p.beneficiario), ''), p.nombre_comercial, 'PROVEEDOR ' || c.proveedor)),
      (select x.id from public.transacciones_contables x where x.localidad_id = c.loc_id and x.numero = c.tipo_trx), c.descripcion, v_gtq, 1, c.valor, 'CHEQUE',
      case when c.estado = 'A' then 'ANULADA' else 'ACTIVA' end, case when c.estado = 'A' then coalesce(c.usuario_anula, 'SISTEMA ANTERIOR') end,
      case when c.estado = 'A' then coalesce(c.fecha_anula, c.fecha_ingreso) at time zone 'America/Guatemala' end, case when c.estado = 'A' then 'ANULADA EN EL SISTEMA ANTERIOR' end,
      c.usuario, extract(month from c.fecha_pres)::int, extract(year from c.fecha_pres)::int, c.cl_id,
      case when c.gal_cero then 0 else c.gs end, case when c.gal_cero then 0 else c.gr end, case when c.gal_cero then 0 else c.gd end, c.exento,
      'VARIAS', c.compra, 10, c.usuario_modifica, c.fecha_modifica, 'V', c.anio, c.mes, c.poliza, c.pct_iva,
      c.valor_cambio, c.documento_ant, c.proveedor, c.tipo_trx, c.fecha_ingreso, c.usuario_anula, c.fecha_anula, case when c.exento <> c.exento_ant then c.exento_ant end,
      c.fecha_doc_ant, c.cuenta_con, c.sucursal, c.archivo, c.migrada_sat, 'N', 'F', c.tipo_docto,
      c.clasif, c.moneda_int, c.fecha_pres, 'L', 'C', case when c.gal_cero then c.gs end, case when c.gal_cero then c.gr end, case when c.gal_cero then c.gd end
    from t328_c c
    left join public.proveedores p on p.localidad_id = c.loc_id and p.codigo = c.proveedor
    on conflict (localidad_id, origen_anterior, compra_anterior) where origen_anterior is not null do update set
      tipo_documento = excluded.tipo_documento, tipo_documento_id = excluded.tipo_documento_id, serie = excluded.serie, documento = excluded.documento,
      fecha_documento = excluded.fecha_documento, fecha_ingreso = excluded.fecha_ingreso, tipo_tercero = excluded.tipo_tercero, proveedor_id = excluded.proveedor_id,
      proveedor_codigo = excluded.proveedor_codigo, proveedor_nombre = excluded.proveedor_nombre, nit = excluded.nit, beneficiario = excluded.beneficiario,
      transaccion_id = excluded.transaccion_id, descripcion = excluded.descripcion, valor_total = excluded.valor_total, estado = excluded.estado, anulado_por = excluded.anulado_por,
      anulado_en = excluded.anulado_en, motivo_anulacion = excluded.motivo_anulacion, usuario = excluded.usuario, mes_presentacion = excluded.mes_presentacion,
      anio_presentacion = excluded.anio_presentacion, clasificacion_id = excluded.clasificacion_id, galones_super = excluded.galones_super, galones_regular = excluded.galones_regular,
      galones_diesel = excluded.galones_diesel, exento = excluded.exento, modulo_factura = excluded.modulo_factura, usuario_modifica_anterior = excluded.usuario_modifica_anterior,
      fecha_modifica_anterior = excluded.fecha_modifica_anterior, tipo_compra_anterior = excluded.tipo_compra_anterior, poliza_anio = excluded.poliza_anio, poliza_mes = excluded.poliza_mes,
      poliza_numero = excluded.poliza_numero, pct_iva = excluded.pct_iva, valor_cambio_anterior = excluded.valor_cambio_anterior, documento_anterior = excluded.documento_anterior,
      proveedor_anterior = excluded.proveedor_anterior, transaccion_anterior = excluded.transaccion_anterior, fecha_ingreso_anterior = excluded.fecha_ingreso_anterior,
      usuario_anula_anterior = excluded.usuario_anula_anterior, fecha_anula_anterior = excluded.fecha_anula_anterior, exento_anterior = excluded.exento_anterior,
      fecha_documento_anterior = excluded.fecha_documento_anterior, cuenta_contable_anterior = excluded.cuenta_contable_anterior, sucursal_anterior = excluded.sucursal_anterior,
      archivo_anterior = excluded.archivo_anterior, migrada_sat = excluded.migrada_sat, revisada_anterior = excluded.revisada_anterior,
      tipo_documento_anterior = excluded.tipo_documento_anterior, tipo_docto_anterior = excluded.tipo_docto_anterior, clasificacion_anterior = excluded.clasificacion_anterior,
      moneda_integracion = excluded.moneda_integracion, fecha_presentacion_anterior = excluded.fecha_presentacion_anterior, transaccion_tipo_anterior = excluded.transaccion_tipo_anterior,
      forma_pago_anterior = excluded.forma_pago_anterior, galones_super_anterior = excluded.galones_super_anterior, galones_regular_anterior = excluded.galones_regular_anterior,
      galones_diesel_anterior = excluded.galones_diesel_anterior
    returning (xmax = 0) as nueva, documento like '% (MIGRADA)' as migrada)
  select count(*) filter (where nueva), count(*) filter (where not nueva), count(*) filter (where migrada) into v_n, v_a, v_doc from x;
  alter table public.compras enable trigger compras_preparar;
  perform set_config('fin.migracion', '', true);

  return format('CONSISAV-%s localidades %s a %s: %s compras nuevas, %s actualizadas; %s con valor cero o negativo (en compras_anteriores_sin_valor).', p_org, p_desde,
      case when p_hasta = 99999 then 'la última' else p_hasta::text end, v_n, v_a, v_sv)
    || case when v_gal > 0 then format(' %s con galones que pasaban del valor (quedan en galones_*_anterior).', v_gal) else '' end
    || case when v_ren > 0 then format(' %s compras registradas en el sistema pasaron a números después de las migradas.', v_ren) else '' end
    || case when v_doc > 0 then format(' %s documentos ya registrados en el sistema llevan « (MIGRADA)».', v_doc) else '' end
    || case when v_omit is not null then ' Empresas que no existen (omitidas): LOCALIDAD ' || v_omit || '.' else '' end;
end;
$fn$;

-- ---------- Detalle contable de compras ----------
create or replace function public.mig328_detalle(p_org int, p_desde int, p_hasta int) returns text
language plpgsql set search_path = '' as $fn$
declare v_org bigint; v_n int; v_a int; v_sc int; v_cero int; v_scta int; v_ctas text;
begin
  select id into v_org from public.organizaciones where upper(organizacion_anterior) = 'CONSISAV-' || p_org;
  if v_org is null then raise exception 'No existe la organización CONSISAV-%.', p_org; end if;
  drop table if exists t328_d;
  create temp table t328_d on commit drop as
    select d.loc::int as loc, d.compra::int as compra, d.linea::int as linea, trim(d.cuenta) as cuenta, nullif(trim(d.debito), '')::numeric as debito, nullif(trim(d.credito), '')::numeric as credito,
           c.id as compra_id, c.estado,
           (select k.id from public.cuentas k join public.catalogos_cuentas g on g.id = k.catalogo_id where g.localidad_id = l.id and k.codigo = trim(d.cuenta)
            order by (g.version = 1) desc, g.activo desc, g.version desc limit 1) as cuenta_id
    from public.mig328_detalle d
    join public.localidades l on l.organizacion_id = v_org and l.correlativo = d.loc::int
    left join public.compras c on c.localidad_id = l.id and c.origen_anterior = 'VARIAS' and c.compra_anterior = d.compra::int
    where d.org::int = p_org and d.loc::int between p_desde and p_hasta;
  alter table t328_d add column dd numeric, add column hh numeric;
  update t328_d set dd = greatest(coalesce(debito, 0), 0) + greatest(-coalesce(credito, 0), 0), hh = greatest(coalesce(credito, 0), 0) + greatest(-coalesce(debito, 0), 0);
  select count(*) filter (where compra_id is null), count(*) filter (where compra_id is not null and round(dd - hh, 2) = 0),
         count(*) filter (where compra_id is not null and round(dd - hh, 2) <> 0 and cuenta_id is null),
         string_agg(distinct format('localidad %s cuenta %s', loc, cuenta), ', ') filter (where compra_id is not null and round(dd - hh, 2) <> 0 and cuenta_id is null)
    into v_sc, v_cero, v_scta, v_ctas from t328_d;
  -- Las validaciones de la pantalla (compra anulada o con partida, cuenta de la localidad) se suspenden durante la carga.
  alter table public.compra_lineas disable trigger compra_lineas_validar;
  with x as (
    insert into public.compra_lineas (compra_id, linea, cuenta_id, debe, haber, cuenta_codigo_anterior, debe_anterior, haber_anterior)
    select compra_id, linea, cuenta_id, round(greatest(dd - hh, 0), 2), round(greatest(hh - dd, 0), 2), cuenta, debito, credito
    from t328_d where compra_id is not null and cuenta_id is not null and round(dd - hh, 2) <> 0
    on conflict (compra_id, linea) do update set cuenta_id = excluded.cuenta_id, debe = excluded.debe, haber = excluded.haber, cuenta_codigo_anterior = excluded.cuenta_codigo_anterior,
      debe_anterior = excluded.debe_anterior, haber_anterior = excluded.haber_anterior, reconstruida = false
    returning (xmax = 0) as nueva)
  select count(*) filter (where nueva), count(*) filter (where not nueva) into v_n, v_a from x;
  alter table public.compra_lineas enable trigger compra_lineas_validar;
  return format('CONSISAV-%s localidades %s a %s: %s líneas nuevas, %s actualizadas; %s de compras sin valor o de empresas que no existen; %s en cero; %s sin cuenta.',
      p_org, p_desde, case when p_hasta = 99999 then 'la última' else p_hasta::text end, v_n, v_a, v_sc, v_cero, v_scta)
    || case when v_ctas is not null then ' Cuentas que no existen en el catálogo (líneas omitidas): ' || left(v_ctas, 1500) || '.' else '' end;
end;
$fn$;

-- ---------- Documentos de caja chica (lógica del script 255) ----------
create or replace function public.mig328_documentos_caja(p_org int) returns text
language plpgsql set search_path = '' as $fn$
declare v_org bigint; v_gtq bigint; v_n int; v_a int; v_sp int; v_scta text;
begin
  select id into v_org from public.organizaciones where upper(organizacion_anterior) = 'CONSISAV-' || p_org;
  if v_org is null then raise exception 'No existe la organización CONSISAV-%.', p_org; end if;
  select id into v_gtq from public.monedas where iso = 'GTQ';
  drop table if exists t328_m;
  create temp table t328_m on commit drop as
    select l.id as loc_id, m.loc::int as loc, m.movimiento::int as movimiento, upper(trim(m.documento)) as documento, nullif(trim(m.tipo_documento), '')::int as tipo_doc,
           nullif(trim(m.fecha_doc), '')::date as fecha_doc, m.proveedor::int as proveedor, coalesce(nullif(trim(m.valor), '')::numeric, 0) as total, nullif(trim(m.descripcion), '') as descripcion,
           nullif(trim(m.cuenta), '') as cuenta, nullif(trim(m.clasif), '')::int as clasif, nullif(trim(m.moneda_int), '')::int as moneda_int, nullif(trim(m.valor_cambio), '')::numeric as cambio,
           coalesce(nullif(trim(m.pct_iva), '')::numeric, 12) as pct_iva, nullif(trim(m.usuario), '') as usuario, nullif(trim(m.fecha_ingreso), '')::timestamp as f_ingreso,
           nullif(trim(m.anticipo), '') = 'S' as anticipo, nullif(upper(trim(m.serie)), '') as serie, nullif(trim(m.tipo_docto), '')::int as tipo_docto,
           coalesce(nullif(trim(m.exento), '')::numeric, 0) as exento_ant,
           (select p.id from public.caja_periodos p join public.cajas_chicas c on c.id = p.caja_id where c.localidad_id = l.id and c.codigo = m.caja::int and p.numero = m.subcaja::int) as periodo_id
    from public.mig328_movimientos m
    join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc::int
    where m.org::int = p_org;
  select count(*) into v_sp from t328_m where periodo_id is null;
  -- Como en los scripts 122, 187 y 255: los documentos de subcajas liquidadas también se cargan (se suspende la validación de la pantalla).
  alter table public.caja_documentos disable trigger caja_documentos_preparar;
  with x as (
    insert into public.caja_documentos (periodo_id, linea, serie, documento, tipo_documento, fecha, nit, proveedor_codigo, proveedor_nombre, moneda_id, clasificacion,
      total, exento, porcentaje_iva, iva, base, justificacion, cuenta_gasto_id, contable, usuario,
      origen_anterior, movimiento_anterior, tipo_documento_anterior, tipo_docto_anterior, tipo_documento_id, clasificacion_anterior, clasificacion_id, proveedor_id, valor_anterior,
      moneda_integracion, valor_cambio_anterior, anticipo, cuenta_codigo_anterior, exento_anterior, fecha_ingreso_anterior)
    select m.periodo_id, m.movimiento, m.serie, coalesce(nullif(m.documento, ''), 'S/N'),
      case m.tipo_doc when 5 then 'RECIBO' when 10 then 'FACTURA ESPECIAL' when 1 then 'FACTURA ELECTRÓNICA' when 4 then 'FACTURA ELECTRÓNICA' else 'OTRO' end,
      coalesce(m.fecha_doc, m.f_ingreso::date, current_date), p.nit, m.proveedor::text,
      upper(coalesce(nullif(trim(p.nombre_fiscal), ''), p.nombre_comercial, 'PROVEEDOR ' || m.proveedor)), v_gtq,
      case m.clasif when 2 then 'SERVICIOS' when 8 then 'SERVICIOS' when 4 then 'BIENES' when 10 then 'BIENES' when 5 then 'COMBUSTIBLE' when 7 then 'IMPORTACIÓN' else 'OTROS' end,
      m.total, least(greatest(m.exento_ant, 0), greatest(m.total, 0)), m.pct_iva,
      case when m.tipo_doc in (5, 2) or m.total - least(greatest(m.exento_ant, 0), greatest(m.total, 0)) <= 0 then 0
           else round((m.total - least(greatest(m.exento_ant, 0), greatest(m.total, 0))) * m.pct_iva / (100 + m.pct_iva), 2) end,
      m.total - least(greatest(m.exento_ant, 0), greatest(m.total, 0)) - case when m.tipo_doc in (5, 2) or m.total - least(greatest(m.exento_ant, 0), greatest(m.total, 0)) <= 0 then 0
           else round((m.total - least(greatest(m.exento_ant, 0), greatest(m.total, 0))) * m.pct_iva / (100 + m.pct_iva), 2) end,
      m.descripcion,
      (select k.id from public.cuentas k join public.catalogos_cuentas g on g.id = k.catalogo_id where g.localidad_id = m.loc_id and k.codigo = m.cuenta
       order by (g.version = 1) desc, g.activo desc, g.version desc limit 1), true, m.usuario,
      'MIGRADO', m.movimiento, m.tipo_doc, m.tipo_docto,
      (select e.registro_id from public.equivalencias_anteriores e where e.sistema = 'CONSISAV' and e.catalogo = 'tipos_documento_compra' and e.codigo_anterior = m.tipo_docto),
      m.clasif, (select e.registro_id from public.equivalencias_anteriores e where e.sistema = 'CONSISAV' and e.catalogo = 'clasificaciones_compra' and e.codigo_anterior = m.clasif),
      p.id, m.total, m.moneda_int, m.cambio, m.anticipo, m.cuenta, case when m.exento_ant <> least(greatest(m.exento_ant, 0), greatest(m.total, 0)) then m.exento_ant end, m.f_ingreso
    from t328_m m left join public.proveedores p on p.localidad_id = m.loc_id and p.codigo = m.proveedor
    where m.periodo_id is not null
    on conflict (periodo_id, linea) do update set serie = excluded.serie, documento = excluded.documento, tipo_documento = excluded.tipo_documento, fecha = excluded.fecha,
      nit = excluded.nit, proveedor_codigo = excluded.proveedor_codigo, proveedor_nombre = excluded.proveedor_nombre, clasificacion = excluded.clasificacion, total = excluded.total,
      exento = excluded.exento, porcentaje_iva = excluded.porcentaje_iva, iva = excluded.iva, base = excluded.base, justificacion = excluded.justificacion,
      cuenta_gasto_id = excluded.cuenta_gasto_id, usuario = excluded.usuario, origen_anterior = 'MIGRADO', movimiento_anterior = excluded.movimiento_anterior,
      tipo_documento_anterior = excluded.tipo_documento_anterior, tipo_docto_anterior = excluded.tipo_docto_anterior, tipo_documento_id = excluded.tipo_documento_id,
      clasificacion_anterior = excluded.clasificacion_anterior, clasificacion_id = excluded.clasificacion_id, proveedor_id = excluded.proveedor_id, valor_anterior = excluded.valor_anterior,
      moneda_integracion = excluded.moneda_integracion, valor_cambio_anterior = excluded.valor_cambio_anterior, anticipo = excluded.anticipo,
      cuenta_codigo_anterior = excluded.cuenta_codigo_anterior, exento_anterior = excluded.exento_anterior, fecha_ingreso_anterior = excluded.fecha_ingreso_anterior
    returning (xmax = 0) as nuevo, cuenta_gasto_id, cuenta_codigo_anterior)
  select count(*) filter (where nuevo), count(*) filter (where not nuevo),
         string_agg(distinct cuenta_codigo_anterior, ', ') filter (where cuenta_gasto_id is null and cuenta_codigo_anterior is not null) into v_n, v_a, v_scta from x;
  alter table public.caja_documentos enable trigger caja_documentos_preparar;
  return format('CONSISAV-%s: %s documentos de caja chica nuevos, %s actualizados; %s sin subcaja (ejecuta antes el script 325).', p_org, v_n, v_a, v_sp)
    || case when v_scta is not null then ' Cuentas que no existen en el catálogo (el documento queda sin cuenta): ' || v_scta || '.' else '' end;
end;
$fn$;
revoke execute on function public.mig328_revisar_carga() from public, anon, authenticated;
revoke execute on function public.mig328_quitar_repetidas() from public, anon, authenticated;
revoke execute on function public.mig328_proveedores(int) from public, anon, authenticated;
revoke execute on function public.mig328_compras(int, int, int) from public, anon, authenticated;
revoke execute on function public.mig328_detalle(int, int, int) from public, anon, authenticated;
revoke execute on function public.mig328_documentos_caja(int) from public, anon, authenticated;

notify pgrst, 'reload schema';
