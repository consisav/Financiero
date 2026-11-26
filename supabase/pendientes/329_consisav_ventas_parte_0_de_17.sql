-- Script 329 · Libro de ventas del sistema anterior del servidor Consisav: organizaciones 13 a 17 (CONSISAV-8 a CONSISAV-12),
--   de «Datos Contables Servidor Consisav al 04-11-2026»:
--     CON_VENTAS (7 archivos): 415293 resúmenes diarios del libro de ventas (CONSISAV-8: 58274, CONSISAV-9: 64933, CONSISAV-10: 10, CONSISAV-11: 292076).
--       Cada fila es un día, una serie y un tipo de documento, con el documento inicial y final, cuántos documentos, servicios,
--       productos, exentos, exportaciones, neto, IVA y total. No son facturas emitidas desde el sistema: no van a facturas_venta.
--     CON_DETALLE_VENTAS (19 archivos): 1228825 documentos de esos resúmenes (4317 fuera del rango inicial-final de su resumen: se marcan).
--     CON_DETCON_VENTAS (21 archivos): 1343821 líneas contables de los resúmenes (279504 en cero no se guardan; 353 negativas pasan al otro lado).
--   Tablas nuevas (con todas las columnas que traen datos):
--     ventas_libro_anteriores: el resumen diario. Se liga a la empresa, a su transacción contable (TIPO_TRANSACCION) y al proveedor de la
--       empresa con el código PROVEEDOR (lista de proveedores de Consisav, script 328); el nombre y NIT quedan como vienen.
--     ventas_libro_documentos_anteriores: cada documento del resumen (servicios, productos, exentos, exportaciones y serie electrónica).
--     ventas_libro_contable_anteriores: las líneas contables, con la cuenta del catálogo versión 1 de la empresa (todas existen).
--   Fechas con el año mal escrito en el sistema anterior (4/01/0218, 21/01/0218, 21/02/0012, 12/12/1012, 6/03/0201, 8/12/0214, 10/02/0019, 22/09/1019): el año queda como 2000 + sus dos últimos dígitos y la fecha del
--     archivo en fecha_anterior.
--   2327 resúmenes con total cero o negativo se guardan tal como vienen. Columnas vacías: CON_VENTAS ninguna;
--     CON_DETALLE_VENTAS IVA; CON_DETCON_VENTAS TIPO_DOCUMENTO.
--   Ejecutar después del script 324 (y del 328 para ligar los proveedores). Orden:
--     1) Esta parte 0: tablas, tablas de carga y funciones.
--     2) En el Table Editor de Supabase, importar cada CSV de supabase/pendientes/329_csv a su tabla de carga («Import data from CSV»):
--        329_1_ventas_1_de_4.csv → mig329_ventas (120000); 329_1_ventas_2_de_4.csv → mig329_ventas (120000); 329_1_ventas_3_de_4.csv → mig329_ventas (120000); 329_1_ventas_4_de_4.csv → mig329_ventas (55293); 329_2_documentos_1_de_4.csv → mig329_documentos (320000); 329_2_documentos_2_de_4.csv → mig329_documentos (320000); 329_2_documentos_3_de_4.csv → mig329_documentos (320000); 329_2_documentos_4_de_4.csv → mig329_documentos (268825); 329_3_contable_1_de_3.csv → mig329_contable (380000); 329_3_contable_2_de_3.csv → mig329_contable (380000); 329_3_contable_3_de_3.csv → mig329_contable (304317).
--     3) Las partes 1 en adelante, en orden. La última muestra el resumen y borra las tablas de carga.
--   Se puede ejecutar de nuevo: actualiza, no duplica. Los datos (CSV y partes 1 en adelante) traen nombres y NIT: quedan solo en la computadora.

create table if not exists public.ventas_libro_anteriores (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  fecha date not null, serie text not null default '', tipo_docto integer not null default 0, tipo_documento_anterior integer, tipo_docto2_anterior text,
  documento_inicial text, documento_final text, total_documentos integer, servicios numeric(18, 2), productos numeric(18, 2), exentos numeric(18, 2), exportaciones numeric(18, 2),
  neto numeric(18, 2), iva numeric(18, 2), total numeric(18, 2), cuadrado boolean, estado text, valor_retencion numeric(18, 2),
  transaccion_anterior integer, transaccion_id bigint references public.transacciones_contables (id) on delete set null,
  proveedor_anterior integer, proveedor_id bigint references public.proveedores (id) on delete set null, nombre_proveedor_anterior text, nit text,
  sucursal text, poliza_anio integer, poliza_mes integer, poliza_numero integer, archivo_anterior integer, migrada_sat boolean, fecha_anterior text not null default '',
  unique (localidad_id, fecha, serie, tipo_docto, fecha_anterior));
comment on table public.ventas_libro_anteriores is 'Libro de ventas de un sistema anterior (Consisav CON_VENTAS): resumen diario por serie y tipo de documento.';
create index if not exists ventas_libro_anteriores_org_idx on public.ventas_libro_anteriores (organizacion_id, fecha);
create table if not exists public.ventas_libro_documentos_anteriores (
  id bigint generated always as identity primary key, venta_id bigint not null references public.ventas_libro_anteriores (id) on delete cascade,
  documento text not null, servicios numeric(18, 2), productos numeric(18, 2), exentos numeric(18, 2), exportaciones numeric(18, 2), serie_electronica text,
  fuera_de_rango boolean not null default false, unique (venta_id, documento));
create table if not exists public.ventas_libro_contable_anteriores (
  id bigint generated always as identity primary key, venta_id bigint not null references public.ventas_libro_anteriores (id) on delete cascade,
  linea integer not null, cuenta_codigo text not null, cuenta_id bigint references public.cuentas (id) on delete set null,
  debe numeric(18, 2) not null default 0, haber numeric(18, 2) not null default 0, debito_anterior numeric(18, 2), credito_anterior numeric(18, 2),
  unique (venta_id, linea));
create index if not exists ventas_libro_contable_cuenta_idx on public.ventas_libro_contable_anteriores (cuenta_id);
do $$
declare t text;
begin
  foreach t in array array['ventas_libro_anteriores', 'ventas_libro_documentos_anteriores', 'ventas_libro_contable_anteriores'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || ': leer', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.usuario_activo())', t || ': leer', t);
    execute format('drop policy if exists %I on public.%I', t || ': escribir', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t || ': escribir', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- ---------- Tablas de carga (texto; se llenan importando los CSV; la última parte las borra) ----------
create table if not exists public.mig329_ventas (org text, loc text, fecha text, serie text, tipo_docto text, docto_inicial text, docto_final text, total_doctos text, servicios text, productos text, exentos text, neto text, iva text, total text, cuadrado text, tipo_transaccion text, proveedor text, nit text, exportaciones text, sucursal text, anio_poliza text, mes_poliza text, poliza text, nombre_proveedor text, tipo_documento text, tipo_docto2 text, estado text, valor_retencion text, archivo text, migrada_sat text, fecha_ant text);
create table if not exists public.mig329_documentos (org text, loc text, fecha text, serie text, tipo_docto text, documento text, servicios text, productos text, exentos text, exportaciones text, serie_electronica text, fuera_rango text, fecha_ant text);
create table if not exists public.mig329_contable (org text, loc text, fecha text, serie text, tipo_docto text, linea text, cuenta text, debito text, credito text, fecha_ant text);
create index if not exists mig329_ventas_idx on public.mig329_ventas (org, loc);
create index if not exists mig329_documentos_idx on public.mig329_documentos (org, loc);
create index if not exists mig329_contable_idx on public.mig329_contable (org, loc);
do $$
declare t text;
begin
  foreach t in array array['mig329_ventas', 'mig329_documentos', 'mig329_contable'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

create or replace function public.mig329_revisar_carga() returns table (tabla text, filas_cargadas bigint, filas_esperadas bigint, filas_repetidas bigint)
language plpgsql set search_path = '' as $fn$
begin
  return query
  select 'mig329_ventas', (select count(*) from public.mig329_ventas), 415293::bigint,
         (select count(*) - count(distinct (org, loc, fecha, serie, tipo_docto, fecha_ant)) from public.mig329_ventas)
  union all select 'mig329_documentos', (select count(*) from public.mig329_documentos), 1228825::bigint,
         (select count(*) - count(distinct (org, loc, fecha, serie, tipo_docto, documento, fecha_ant)) from public.mig329_documentos)
  union all select 'mig329_contable', (select count(*) from public.mig329_contable), 1064317::bigint,
         (select count(*) - count(distinct (org, loc, fecha, serie, tipo_docto, linea, fecha_ant)) from public.mig329_contable);
end;
$fn$;

create or replace function public.mig329_quitar_repetidas() returns text
language plpgsql set search_path = '' as $fn$
declare t text; v_n int; v_res text := '';
begin
  foreach t in array array['mig329_ventas', 'mig329_documentos', 'mig329_contable'] loop
    execute format('delete from public.%I where ctid in (select ctid from (select ctid, row_number() over (partition by x::text order by ctid) as rn from public.%I x) y where rn > 1)', t, t);
    get diagnostics v_n = row_count;
    v_res := v_res || format('%s: %s. ', t, v_n);
  end loop;
  return 'Filas repetidas quitadas: ' || v_res;
end;
$fn$;

create or replace function public.mig329_ventas(p_org int, p_desde int, p_hasta int) returns text
language plpgsql set search_path = '' as $fn$
declare v_org bigint; v_n int; v_a int; v_omit text;
begin
  select id into v_org from public.organizaciones where upper(organizacion_anterior) = 'CONSISAV-' || p_org;
  if v_org is null then raise exception 'No existe la organización CONSISAV-% (ejecuta antes el script 321).', p_org; end if;
  select string_agg(distinct m.loc, ', ') into v_omit from public.mig329_ventas m
  where m.org::int = p_org and m.loc::int between p_desde and p_hasta
    and not exists (select 1 from public.localidades l where l.organizacion_id = v_org and l.correlativo = m.loc::int);
  with x as (
    insert into public.ventas_libro_anteriores (organizacion_id, localidad_id, fecha, serie, tipo_docto, tipo_documento_anterior, tipo_docto2_anterior, documento_inicial, documento_final,
      total_documentos, servicios, productos, exentos, exportaciones, neto, iva, total, cuadrado, estado, valor_retencion, transaccion_anterior, transaccion_id, proveedor_anterior,
      proveedor_id, nombre_proveedor_anterior, nit, sucursal, poliza_anio, poliza_mes, poliza_numero, archivo_anterior, migrada_sat, fecha_anterior)
    select v_org, l.id, m.fecha::date, coalesce(nullif(trim(m.serie), ''), ''), coalesce(nullif(trim(m.tipo_docto), '')::int, 0), nullif(trim(m.tipo_documento), '')::int, nullif(trim(m.tipo_docto2), ''), nullif(trim(m.docto_inicial), ''),
      nullif(trim(m.docto_final), ''), nullif(trim(m.total_doctos), '')::int, nullif(trim(m.servicios), '')::numeric, nullif(trim(m.productos), '')::numeric, nullif(trim(m.exentos), '')::numeric, nullif(trim(m.exportaciones), '')::numeric, nullif(trim(m.neto), '')::numeric, nullif(trim(m.iva), '')::numeric, nullif(trim(m.total), '')::numeric,
      nullif(trim(m.cuadrado), '') = 'S', nullif(trim(m.estado), ''), nullif(trim(m.valor_retencion), '')::numeric, nullif(trim(m.tipo_transaccion), '')::int,
      (select x.id from public.transacciones_contables x where x.localidad_id = l.id and x.numero = nullif(trim(m.tipo_transaccion), '')::int), nullif(trim(m.proveedor), '')::int,
      (select p.id from public.proveedores p where p.localidad_id = l.id and p.codigo = case when nullif(trim(m.proveedor), '')::int = 0 then 999999 else nullif(trim(m.proveedor), '')::int end),
      nullif(trim(m.nombre_proveedor), ''), nullif(trim(m.nit), ''), nullif(trim(m.sucursal), ''), nullif(trim(m.anio_poliza), '')::int, nullif(trim(m.mes_poliza), '')::int, nullif(trim(m.poliza), '')::int, nullif(trim(m.archivo), '')::int, nullif(trim(m.migrada_sat), '') = 'S', coalesce(nullif(trim(m.fecha_ant), ''), '')
    from public.mig329_ventas m join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc::int
    where m.org::int = p_org and m.loc::int between p_desde and p_hasta
    on conflict (localidad_id, fecha, serie, tipo_docto, fecha_anterior) do update set tipo_documento_anterior = excluded.tipo_documento_anterior, tipo_docto2_anterior = excluded.tipo_docto2_anterior,
      documento_inicial = excluded.documento_inicial, documento_final = excluded.documento_final, total_documentos = excluded.total_documentos, servicios = excluded.servicios,
      productos = excluded.productos, exentos = excluded.exentos, exportaciones = excluded.exportaciones, neto = excluded.neto, iva = excluded.iva, total = excluded.total,
      cuadrado = excluded.cuadrado, estado = excluded.estado, valor_retencion = excluded.valor_retencion, transaccion_anterior = excluded.transaccion_anterior,
      transaccion_id = excluded.transaccion_id, proveedor_anterior = excluded.proveedor_anterior, proveedor_id = excluded.proveedor_id,
      nombre_proveedor_anterior = excluded.nombre_proveedor_anterior, nit = excluded.nit, sucursal = excluded.sucursal, poliza_anio = excluded.poliza_anio,
      poliza_mes = excluded.poliza_mes, poliza_numero = excluded.poliza_numero, archivo_anterior = excluded.archivo_anterior, migrada_sat = excluded.migrada_sat, fecha_anterior = excluded.fecha_anterior
    returning (xmax = 0) as nuevo)
  select count(*) filter (where nuevo), count(*) filter (where not nuevo) into v_n, v_a from x;
  return format('CONSISAV-%s localidades %s a %s: %s resúmenes de ventas nuevos, %s actualizados.', p_org, p_desde, case when p_hasta = 99999 then 'la última' else p_hasta::text end, v_n, v_a)
    || case when v_omit is not null then ' Empresas que no existen (omitidas): LOCALIDAD ' || v_omit || '.' else '' end;
end;
$fn$;

create or replace function public.mig329_documentos(p_org int, p_desde int, p_hasta int) returns text
language plpgsql set search_path = '' as $fn$
declare v_org bigint; v_n int; v_a int; v_sin int;
begin
  select id into v_org from public.organizaciones where upper(organizacion_anterior) = 'CONSISAV-' || p_org;
  if v_org is null then raise exception 'No existe la organización CONSISAV-%.', p_org; end if;
  select count(*) into v_sin from public.mig329_documentos m join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc::int
    left join public.ventas_libro_anteriores v on v.localidad_id = l.id and v.fecha = m.fecha::date and v.serie = coalesce(nullif(trim(m.serie), ''), '') and v.tipo_docto = coalesce(nullif(trim(m.tipo_docto), '')::int, 0)
      and v.fecha_anterior = coalesce(nullif(trim(m.fecha_ant), ''), '')
  where m.org::int = p_org and m.loc::int between p_desde and p_hasta and v.id is null;
  with x as (
    insert into public.ventas_libro_documentos_anteriores (venta_id, documento, servicios, productos, exentos, exportaciones, serie_electronica, fuera_de_rango)
    select v.id, coalesce(nullif(trim(m.documento), ''), 'S/N'), nullif(trim(m.servicios), '')::numeric, nullif(trim(m.productos), '')::numeric, nullif(trim(m.exentos), '')::numeric, nullif(trim(m.exportaciones), '')::numeric, nullif(trim(m.serie_electronica), ''),
      coalesce(nullif(trim(m.fuera_rango), ''), '') = 'S'
    from public.mig329_documentos m join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc::int
    left join public.ventas_libro_anteriores v on v.localidad_id = l.id and v.fecha = m.fecha::date and v.serie = coalesce(nullif(trim(m.serie), ''), '') and v.tipo_docto = coalesce(nullif(trim(m.tipo_docto), '')::int, 0)
      and v.fecha_anterior = coalesce(nullif(trim(m.fecha_ant), ''), '')
    where m.org::int = p_org and m.loc::int between p_desde and p_hasta and v.id is not null
    on conflict (venta_id, documento) do update set servicios = excluded.servicios, productos = excluded.productos, exentos = excluded.exentos, exportaciones = excluded.exportaciones,
      serie_electronica = excluded.serie_electronica, fuera_de_rango = excluded.fuera_de_rango
    returning (xmax = 0) as nuevo)
  select count(*) filter (where nuevo), count(*) filter (where not nuevo) into v_n, v_a from x;
  return format('CONSISAV-%s localidades %s a %s: %s documentos nuevos, %s actualizados; %s sin resumen (empresa que no existe).', p_org, p_desde,
    case when p_hasta = 99999 then 'la última' else p_hasta::text end, v_n, v_a, v_sin);
end;
$fn$;

create or replace function public.mig329_contable(p_org int, p_desde int, p_hasta int) returns text
language plpgsql set search_path = '' as $fn$
declare v_org bigint; v_n int; v_a int; v_sin int; v_scta int;
begin
  select id into v_org from public.organizaciones where upper(organizacion_anterior) = 'CONSISAV-' || p_org;
  if v_org is null then raise exception 'No existe la organización CONSISAV-%.', p_org; end if;
  drop table if exists t329_c;
  create temp table t329_c on commit drop as
    select v.id as venta_id, m.linea::int as linea, trim(m.cuenta) as cuenta, nullif(trim(m.debito), '')::numeric as debito, nullif(trim(m.credito), '')::numeric as credito,
      (select k.id from public.cuentas k join public.catalogos_cuentas g on g.id = k.catalogo_id where g.localidad_id = l.id and k.codigo = trim(m.cuenta)
       order by (g.version = 1) desc, g.activo desc, g.version desc limit 1) as cuenta_id
    from public.mig329_contable m join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc::int
    left join public.ventas_libro_anteriores v on v.localidad_id = l.id and v.fecha = m.fecha::date and v.serie = coalesce(nullif(trim(m.serie), ''), '') and v.tipo_docto = coalesce(nullif(trim(m.tipo_docto), '')::int, 0)
      and v.fecha_anterior = coalesce(nullif(trim(m.fecha_ant), ''), '')
    where m.org::int = p_org and m.loc::int between p_desde and p_hasta;
  select count(*) filter (where venta_id is null), count(*) filter (where venta_id is not null and cuenta_id is null) into v_sin, v_scta from t329_c;
  with x as (
    insert into public.ventas_libro_contable_anteriores (venta_id, linea, cuenta_codigo, cuenta_id, debe, haber, debito_anterior, credito_anterior)
    select venta_id, linea, cuenta, cuenta_id,
      round(greatest(greatest(coalesce(debito, 0), 0) + greatest(-coalesce(credito, 0), 0) - greatest(coalesce(credito, 0), 0) - greatest(-coalesce(debito, 0), 0), 0), 2),
      round(greatest(greatest(coalesce(credito, 0), 0) + greatest(-coalesce(debito, 0), 0) - greatest(coalesce(debito, 0), 0) - greatest(-coalesce(credito, 0), 0), 0), 2),
      debito, credito
    from t329_c where venta_id is not null
    on conflict (venta_id, linea) do update set cuenta_codigo = excluded.cuenta_codigo, cuenta_id = excluded.cuenta_id, debe = excluded.debe, haber = excluded.haber,
      debito_anterior = excluded.debito_anterior, credito_anterior = excluded.credito_anterior
    returning (xmax = 0) as nuevo)
  select count(*) filter (where nuevo), count(*) filter (where not nuevo) into v_n, v_a from x;
  return format('CONSISAV-%s localidades %s a %s: %s líneas contables nuevas, %s actualizadas; %s sin resumen; %s con una cuenta que no existe (queda su código).', p_org, p_desde,
    case when p_hasta = 99999 then 'la última' else p_hasta::text end, v_n, v_a, v_sin, v_scta);
end;
$fn$;
revoke execute on function public.mig329_revisar_carga() from public, anon, authenticated;
revoke execute on function public.mig329_quitar_repetidas() from public, anon, authenticated;
revoke execute on function public.mig329_ventas(int, int, int) from public, anon, authenticated;
revoke execute on function public.mig329_documentos(int, int, int) from public, anon, authenticated;
revoke execute on function public.mig329_contable(int, int, int) from public, anon, authenticated;

notify pgrst, 'reload schema';
