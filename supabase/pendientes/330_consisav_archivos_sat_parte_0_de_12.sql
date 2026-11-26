-- Script 330 · Archivos de facturas SAT cargados en el sistema anterior del servidor Consisav: organizaciones 13 a 17 (CONSISAV-8 a CONSISAV-12),
--   con la lógica de los scripts 263 y 264, de «Datos Contables Servidor Consisav al 04-11-2026»:
--     CON_ARCHIVOS_FACTURAS (3502 archivos de facturas recibidas) y CON_ARCHIVOS_FAC_VENTAS (2052 de facturas emitidas) → cargas_sat
--       (tabla de Compras › Carga Facturas SAT, script 140; tipo_carga COMPRAS o VENTAS). CAJA y SUBCAJA = la subcaja (script 325).
--       2 archivos solo vienen en el detalle (sin encabezado en el sistema anterior): se crean, sin nombre, marcados en origen_anterior.
--     CON_DETALLE_ARCHIVOS_FAC (6 archivos, 352111 facturas recibidas) → carga_sat_lineas; CON_DETALLE_ARCHIVOS_VEN (6 archivos, 389994
--       facturas emitidas) → carga_sat_ventas_lineas (script 264). Quedan sin generar: al generar, si la compra ya existe (script 328) solo se enlaza.
--   Datos ajustados:
--     · Una factura va una sola vez por empresa (llave: número de autorización). Recibidas: 7289 venían en dos o más archivos; se guardan en el primero,
--       con la lista de los demás en otras_cargas_anterior (si el primero no traía clasificación o cuenta, se toman del otro). Emitidas: 64618 filas eran
--       copias idénticas (se toman una vez) y 4190 venían en otro archivo.
--     · 369 facturas sin número de autorización (no FEL): su autorización queda «SIN AUTORIZACION tipo serie-número NIT nit».
--     · CLASIFICACION (BIE, SER, GAS, EXE…, en mayúsculas o minúsculas) se liga a la clasificación del sistema con las equivalencias del script 328;
--       CUENTA_CON (0 = sin cuenta) se liga sola a la cuenta de la empresa (si no existe queda el código).
--     · 2271 filas traen ESTADO, MONEDA o ANULADA corridos o mal escritos en el sistema anterior: se guardan como vienen;
--       ANULADA = S, Si o SI. FECHA_ANULADA en 0 queda vacía. 0 fechas de emisión que no son fecha quedan en fecha_emision_anterior.
--   Columnas nuevas en cargas_sat: sucursal_anterior (SUCURSAL) y preferencia_letra_anterior (PREFERENCIA: C, S, B o X; la columna del script 263 es numérica).
--   Columnas vacías: CENTRO_COSTO (recibidas); CUENTA_CON, CENTRO_COSTO, OBSERVACIONES (emitidas).
--   Ejecutar después de los scripts 324, 325 y 328 (parte 0). Orden:
--     1) Esta parte 0: estructura, tablas de carga y funciones.
--     2) En el Table Editor de Supabase, importar los CSV de supabase/pendientes/330_csv a su tabla de carga («Import data from CSV»):
--        330_1_archivos.csv → mig330_archivos (5556); 330_2_facturas_1_de_12.csv → mig330_lineas (60000); 330_2_facturas_2_de_12.csv → mig330_lineas (60000); 330_2_facturas_3_de_12.csv → mig330_lineas (60000); 330_2_facturas_4_de_12.csv → mig330_lineas (60000); 330_2_facturas_5_de_12.csv → mig330_lineas (60000); 330_2_facturas_6_de_12.csv → mig330_lineas (60000); 330_2_facturas_7_de_12.csv → mig330_lineas (60000); 330_2_facturas_8_de_12.csv → mig330_lineas (60000); 330_2_facturas_9_de_12.csv → mig330_lineas (60000); 330_2_facturas_10_de_12.csv → mig330_lineas (60000); 330_2_facturas_11_de_12.csv → mig330_lineas (60000); 330_2_facturas_12_de_12.csv → mig330_lineas (6008).
--     3) Las partes 1 en adelante, en orden. La última muestra el resumen y borra las tablas de carga.
--   Se puede ejecutar de nuevo: actualiza, no duplica. Los datos (CSV y partes 1 en adelante) traen nombres y NIT: quedan solo en la computadora.

-- ---------- Columnas (scripts 263 y 264, y las nuevas) ----------
alter table public.cargas_sat add column if not exists archivo_anterior integer;
alter table public.cargas_sat add column if not exists usuario_anterior text;
alter table public.cargas_sat add column if not exists fecha_anterior timestamp;
alter table public.cargas_sat add column if not exists columnas_ad_anterior text;
alter table public.cargas_sat add column if not exists origen_anterior text;
alter table public.cargas_sat add column if not exists tipo_carga text not null default 'COMPRAS';
alter table public.cargas_sat add column if not exists facturas_generadas boolean;
alter table public.cargas_sat add column if not exists caja_anterior integer;
alter table public.cargas_sat add column if not exists subcaja_anterior integer;
alter table public.cargas_sat add column if not exists sucursal_anterior text;
alter table public.cargas_sat add column if not exists preferencia_letra_anterior text;
create unique index if not exists cargas_sat_archivo_anterior_tipo on public.cargas_sat (localidad_id, tipo_carga, archivo_anterior) where archivo_anterior is not null;
alter table public.carga_sat_lineas add column if not exists centro_costo_anterior text;
alter table public.carga_sat_lineas add column if not exists fecha_emision_anterior text;
alter table public.carga_sat_lineas add column if not exists otras_cargas_anterior text;
create table if not exists public.carga_sat_ventas_lineas (like public.carga_sat_lineas including defaults including identity including constraints);
alter table public.carga_sat_ventas_lineas add column if not exists centro_costo_anterior text;
alter table public.carga_sat_ventas_lineas add column if not exists orden_excel_anterior integer;
alter table public.carga_sat_ventas_lineas add column if not exists fecha_emision_anterior text;
alter table public.carga_sat_ventas_lineas add column if not exists otras_cargas_anterior text;
do $pk$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.carga_sat_ventas_lineas'::regclass and contype = 'p') then
    alter table public.carga_sat_ventas_lineas add primary key (id);
  end if;
end;
$pk$;
create unique index if not exists carga_sat_ventas_lineas_autorizacion on public.carga_sat_ventas_lineas (localidad_id, numero_autorizacion);

-- ---------- Tablas de carga (texto; se llenan importando los CSV; la última parte las borra) ----------
create table if not exists public.mig330_archivos (tipo text, org text, loc text, archivo text, nombre text, fecha text, usuario text, caja text, subcaja text, columnas_ad text, generadas text, sucursal text, preferencia text, sin_encabezado text);
create table if not exists public.mig330_lineas (tipo text, org text, loc text, archivo text, linea text, fecha_emision text, fecha_emision_ant text, otras text, autorizacion text, tipo_dte text, serie text, numero text, nit text, nombre_emisor text, clas_emisor text, exportacion text, cod_estab text, nombre_estab text, id_receptor text, nombre_receptor text, nit_cert text, nombre_cert text, estado text, moneda text, gran_total text, iva text, anulada text, fecha_anulada text, petroleo text, turismo_hosp text, turismo_pasaje text, timbre text, bomberos text, tasa_municipal text, bebidas_alcohol text, tabaco text, cemento text, bebidas_no_alcohol text, tarifa_portuaria text, clasificacion text, cuenta text, observaciones text);
create index if not exists mig330_lineas_idx on public.mig330_lineas (tipo, org, loc);
do $$
declare t text;
begin
  foreach t in array array['mig330_archivos', 'mig330_lineas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

create or replace function public.mig330_revisar_carga() returns table (tabla text, filas_cargadas bigint, filas_esperadas bigint, filas_repetidas bigint)
language plpgsql set search_path = '' as $fn$
begin
  return query
  select 'mig330_archivos', (select count(*) from public.mig330_archivos), 5556::bigint,
         (select count(*) - count(distinct (tipo, org, loc, archivo)) from public.mig330_archivos)
  union all select 'mig330_lineas', (select count(*) from public.mig330_lineas), 666008::bigint,
         (select count(*) - count(distinct (tipo, org, loc, upper(autorizacion))) from public.mig330_lineas);
end;
$fn$;

create or replace function public.mig330_quitar_repetidas() returns text
language plpgsql set search_path = '' as $fn$
declare t text; v_n int; v_res text := '';
begin
  foreach t in array array['mig330_archivos', 'mig330_lineas'] loop
    execute format('delete from public.%I where ctid in (select ctid from (select ctid, row_number() over (partition by x::text order by ctid) as rn from public.%I x) y where rn > 1)', t, t);
    get diagnostics v_n = row_count;
    v_res := v_res || format('%s: %s. ', t, v_n);
  end loop;
  return 'Filas repetidas quitadas: ' || v_res;
end;
$fn$;

-- ---------- Archivos (cargas_sat) de una organización ----------
create or replace function public.mig330_cargas(p_org int) returns text
language plpgsql set search_path = '' as $fn$
declare v_org bigint; v_n int; v_a int; v_sc int; v_omit text;
begin
  select id into v_org from public.organizaciones where upper(organizacion_anterior) = 'CONSISAV-' || p_org;
  if v_org is null then raise exception 'No existe la organización CONSISAV-% (ejecuta antes el script 321).', p_org; end if;
  drop table if exists t330_a;
  create temp table t330_a on commit drop as
    select l.id as loc_id, a.loc::int as loc, a.tipo, a.archivo::int as archivo, nullif(trim(a.nombre), '') as nombre, nullif(trim(a.fecha), '')::timestamp as fecha, nullif(trim(a.usuario), '') as usuario,
      nullif(trim(a.caja), '')::int as caja, nullif(trim(a.subcaja), '')::int as subcaja, nullif(trim(a.columnas_ad), '') as columnas_ad, case nullif(trim(a.generadas), '') when 'S' then true when 'N' then false end as generadas,
      nullif(trim(a.sucursal), '') as sucursal, nullif(trim(a.preferencia), '') as preferencia, coalesce(nullif(trim(a.sin_encabezado), ''), '') = 'S' as sin_encabezado,
      (select p.id from public.caja_periodos p join public.cajas_chicas c on c.id = p.caja_id where c.localidad_id = l.id and c.codigo = nullif(trim(a.caja), '')::int and p.numero = nullif(trim(a.subcaja), '')::int) as periodo_id
    from public.mig330_archivos a left join public.localidades l on l.organizacion_id = v_org and l.correlativo = a.loc::int
    where a.org::int = p_org;
  select string_agg(distinct loc::text, ', ') into v_omit from t330_a where loc_id is null;
  delete from t330_a where loc_id is null;
  select count(*) into v_sc from t330_a where caja is not null and periodo_id is null;
  update public.cargas_sat c set archivo = coalesce(a.nombre, case when a.sin_encabezado then 'ARCHIVO ' || a.archivo || ' (SIN ENCABEZADO EN EL SISTEMA ANTERIOR)' end),
    fecha = coalesce(a.fecha::date, c.fecha), caja_periodo_id = a.periodo_id, estado = case when coalesce(a.generadas, false) then 'GENERADA' else c.estado end,
    usuario_anterior = a.usuario, fecha_anterior = a.fecha, columnas_ad_anterior = a.columnas_ad, facturas_generadas = a.generadas, caja_anterior = a.caja, subcaja_anterior = a.subcaja,
    sucursal_anterior = a.sucursal, preferencia_letra_anterior = a.preferencia, origen_anterior = case when a.sin_encabezado then 'MIGRADO SIN ENCABEZADO' else 'MIGRADO' end
  from t330_a a where c.localidad_id = a.loc_id and c.tipo_carga = a.tipo and c.archivo_anterior = a.archivo;
  get diagnostics v_a = row_count;
  insert into public.cargas_sat (organizacion_id, localidad_id, archivo, fecha, caja_periodo_id, estado, archivo_anterior, tipo_carga, usuario_anterior, fecha_anterior, columnas_ad_anterior,
    facturas_generadas, caja_anterior, subcaja_anterior, sucursal_anterior, preferencia_letra_anterior, origen_anterior)
  select v_org, a.loc_id, coalesce(a.nombre, case when a.sin_encabezado then 'ARCHIVO ' || a.archivo || ' (SIN ENCABEZADO EN EL SISTEMA ANTERIOR)' end),
    coalesce(a.fecha::date, current_date), a.periodo_id, case when coalesce(a.generadas, false) then 'GENERADA' else 'CARGADA' end, a.archivo, a.tipo, a.usuario, a.fecha, a.columnas_ad,
    a.generadas, a.caja, a.subcaja, a.sucursal, a.preferencia, case when a.sin_encabezado then 'MIGRADO SIN ENCABEZADO' else 'MIGRADO' end
  from t330_a a where not exists (select 1 from public.cargas_sat c where c.localidad_id = a.loc_id and c.tipo_carga = a.tipo and c.archivo_anterior = a.archivo)
  order by a.loc_id, a.tipo, a.archivo;
  get diagnostics v_n = row_count;
  return format('CONSISAV-%s: %s archivos SAT nuevos, %s actualizados.', p_org, v_n, v_a)
    || case when v_sc > 0 then format(' %s con una subcaja que no existe (queda su número).', v_sc) else '' end
    || case when v_omit is not null then ' Empresas que no existen (omitidas): LOCALIDAD ' || v_omit || '.' else '' end;
end;
$fn$;

-- ---------- Facturas de los archivos (por tipo y rango de LOCALIDAD) ----------
create or replace function public.mig330_lineas(p_tipo text, p_org int, p_desde int, p_hasta int) returns text
language plpgsql set search_path = '' as $fn$
declare v_org bigint; v_n int; v_a int; v_otra int; v_sin int; v_scta int;
begin
  select id into v_org from public.organizaciones where upper(organizacion_anterior) = 'CONSISAV-' || p_org;
  if v_org is null then raise exception 'No existe la organización CONSISAV-%.', p_org; end if;
  drop table if exists t330_l;
  create temp table t330_l on commit drop as
    select m.*, c.id as carga_id, l.id as loc_id
    from public.mig330_lineas m
    join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc::int
    left join public.cargas_sat c on c.localidad_id = l.id and c.tipo_carga = m.tipo and c.archivo_anterior = m.archivo::int
    where m.tipo = p_tipo and m.org::int = p_org and m.loc::int between p_desde and p_hasta;
  select count(*) into v_sin from t330_l where carga_id is null;
  if p_tipo = 'COMPRAS' then
    with x as (
      insert into public.carga_sat_lineas (carga_id, localidad_id, linea, fecha_emision, fecha_emision_anterior, otras_cargas_anterior, numero_autorizacion, tipo_dte, serie, numero, nit_emisor, nombre_emisor, clasificacion_emisor, exportacion, codigo_establecimiento, nombre_establecimiento, id_receptor, nombre_receptor, nit_certificador, nombre_certificador, estado, moneda, gran_total, iva, anulada, fecha_anulacion, petroleo, turismo_hospedaje, turismo_pasaje, timbre_prensa, bomberos, tasa_municipal, bebidas_alcohol, tabaco, cemento, bebidas_no_alcohol, tarifa_portuaria, clasificacion, clasificacion_id, cuenta_codigo, observaciones)
      select m.carga_id, m.loc_id, m.linea::int, nullif(trim(m.fecha_emision), '')::timestamptz, nullif(trim(m.fecha_emision_ant), ''), nullif(trim(m.otras), ''), trim(m.autorizacion), nullif(trim(m.tipo_dte), ''), nullif(trim(m.serie), ''), nullif(trim(m.numero), ''), nullif(upper(replace(trim(m.nit), '-', '')), ''), nullif(trim(m.nombre_emisor), ''), nullif(trim(m.clas_emisor), ''), nullif(trim(m.exportacion), ''), nullif(trim(m.cod_estab), ''), nullif(trim(m.nombre_estab), ''), nullif(trim(m.id_receptor), ''), nullif(trim(m.nombre_receptor), ''), nullif(trim(m.nit_cert), ''), nullif(trim(m.nombre_cert), ''), nullif(trim(m.estado), ''), nullif(trim(m.moneda), ''), coalesce(nullif(trim(m.gran_total), '')::numeric, 0), coalesce(nullif(trim(m.iva), '')::numeric, 0), coalesce(nullif(trim(m.anulada), ''), '') = 'S', nullif(trim(m.fecha_anulada), '')::timestamptz, coalesce(nullif(trim(m.petroleo), '')::numeric, 0), coalesce(nullif(trim(m.turismo_hosp), '')::numeric, 0), coalesce(nullif(trim(m.turismo_pasaje), '')::numeric, 0), coalesce(nullif(trim(m.timbre), '')::numeric, 0), coalesce(nullif(trim(m.bomberos), '')::numeric, 0), coalesce(nullif(trim(m.tasa_municipal), '')::numeric, 0), coalesce(nullif(trim(m.bebidas_alcohol), '')::numeric, 0), coalesce(nullif(trim(m.tabaco), '')::numeric, 0), coalesce(nullif(trim(m.cemento), '')::numeric, 0), coalesce(nullif(trim(m.bebidas_no_alcohol), '')::numeric, 0), coalesce(nullif(trim(m.tarifa_portuaria), '')::numeric, 0), nullif(trim(m.clasificacion), ''), (select e.registro_id from public.equivalencias_anteriores e where e.sistema = 'CONSISAV' and e.catalogo = 'clasificaciones_compra'
       and e.codigo_anterior = case upper(trim(m.clasificacion)) when '0' then 1 when 'SER' then 2 when 'EXE' then 3 when 'BIE' then 4 when 'BIEN' then 4 when 'GAS' then 5 when 'IMP' then 7 when 'EXES' then 8 when 'IMPE' then 9 when 'ACT' then 10 end), nullif(trim(m.cuenta), ''), nullif(trim(m.observaciones), '')
      from t330_l m where m.carga_id is not null
      on conflict (localidad_id, numero_autorizacion) do update set linea = excluded.linea, fecha_emision = excluded.fecha_emision,
        fecha_emision_anterior = excluded.fecha_emision_anterior, otras_cargas_anterior = excluded.otras_cargas_anterior,
        tipo_dte = excluded.tipo_dte, serie = excluded.serie, numero = excluded.numero, nit_emisor = excluded.nit_emisor, nombre_emisor = excluded.nombre_emisor, clasificacion_emisor = excluded.clasificacion_emisor, exportacion = excluded.exportacion, codigo_establecimiento = excluded.codigo_establecimiento, nombre_establecimiento = excluded.nombre_establecimiento, id_receptor = excluded.id_receptor, nombre_receptor = excluded.nombre_receptor, nit_certificador = excluded.nit_certificador, nombre_certificador = excluded.nombre_certificador, estado = excluded.estado, moneda = excluded.moneda, gran_total = excluded.gran_total, iva = excluded.iva, anulada = excluded.anulada, fecha_anulacion = excluded.fecha_anulacion, petroleo = excluded.petroleo, turismo_hospedaje = excluded.turismo_hospedaje, turismo_pasaje = excluded.turismo_pasaje, timbre_prensa = excluded.timbre_prensa, bomberos = excluded.bomberos, tasa_municipal = excluded.tasa_municipal, bebidas_alcohol = excluded.bebidas_alcohol, tabaco = excluded.tabaco, cemento = excluded.cemento, bebidas_no_alcohol = excluded.bebidas_no_alcohol, tarifa_portuaria = excluded.tarifa_portuaria, clasificacion = excluded.clasificacion, clasificacion_id = excluded.clasificacion_id, cuenta_codigo = excluded.cuenta_codigo, observaciones = excluded.observaciones
        where carga_sat_lineas.carga_id = excluded.carga_id
      returning (xmax = 0) as nuevo, cuenta_codigo is not null and cuenta_id is null as sin_cuenta)
    select count(*) filter (where nuevo), count(*) filter (where not nuevo), count(*) filter (where sin_cuenta) into v_n, v_a, v_scta from x;
  else
    with x as (
      insert into public.carga_sat_ventas_lineas (carga_id, localidad_id, linea, fecha_emision, fecha_emision_anterior, otras_cargas_anterior, numero_autorizacion, tipo_dte, serie, numero, nit_emisor, nombre_emisor, clasificacion_emisor, exportacion, codigo_establecimiento, nombre_establecimiento, id_receptor, nombre_receptor, nit_certificador, nombre_certificador, estado, moneda, gran_total, iva, anulada, fecha_anulacion, petroleo, turismo_hospedaje, turismo_pasaje, timbre_prensa, bomberos, tasa_municipal, bebidas_alcohol, tabaco, cemento, bebidas_no_alcohol, tarifa_portuaria, clasificacion, clasificacion_id, cuenta_codigo, observaciones)
      select m.carga_id, m.loc_id, m.linea::int, nullif(trim(m.fecha_emision), '')::timestamptz, nullif(trim(m.fecha_emision_ant), ''), nullif(trim(m.otras), ''), trim(m.autorizacion), nullif(trim(m.tipo_dte), ''), nullif(trim(m.serie), ''), nullif(trim(m.numero), ''), nullif(upper(replace(trim(m.nit), '-', '')), ''), nullif(trim(m.nombre_emisor), ''), nullif(trim(m.clas_emisor), ''), nullif(trim(m.exportacion), ''), nullif(trim(m.cod_estab), ''), nullif(trim(m.nombre_estab), ''), nullif(trim(m.id_receptor), ''), nullif(trim(m.nombre_receptor), ''), nullif(trim(m.nit_cert), ''), nullif(trim(m.nombre_cert), ''), nullif(trim(m.estado), ''), nullif(trim(m.moneda), ''), coalesce(nullif(trim(m.gran_total), '')::numeric, 0), coalesce(nullif(trim(m.iva), '')::numeric, 0), coalesce(nullif(trim(m.anulada), ''), '') = 'S', nullif(trim(m.fecha_anulada), '')::timestamptz, coalesce(nullif(trim(m.petroleo), '')::numeric, 0), coalesce(nullif(trim(m.turismo_hosp), '')::numeric, 0), coalesce(nullif(trim(m.turismo_pasaje), '')::numeric, 0), coalesce(nullif(trim(m.timbre), '')::numeric, 0), coalesce(nullif(trim(m.bomberos), '')::numeric, 0), coalesce(nullif(trim(m.tasa_municipal), '')::numeric, 0), coalesce(nullif(trim(m.bebidas_alcohol), '')::numeric, 0), coalesce(nullif(trim(m.tabaco), '')::numeric, 0), coalesce(nullif(trim(m.cemento), '')::numeric, 0), coalesce(nullif(trim(m.bebidas_no_alcohol), '')::numeric, 0), coalesce(nullif(trim(m.tarifa_portuaria), '')::numeric, 0), nullif(trim(m.clasificacion), ''), (select e.registro_id from public.equivalencias_anteriores e where e.sistema = 'CONSISAV' and e.catalogo = 'clasificaciones_compra'
       and e.codigo_anterior = case upper(trim(m.clasificacion)) when '0' then 1 when 'SER' then 2 when 'EXE' then 3 when 'BIE' then 4 when 'BIEN' then 4 when 'GAS' then 5 when 'IMP' then 7 when 'EXES' then 8 when 'IMPE' then 9 when 'ACT' then 10 end), nullif(trim(m.cuenta), ''), nullif(trim(m.observaciones), '')
      from t330_l m where m.carga_id is not null
      on conflict (localidad_id, numero_autorizacion) do update set linea = excluded.linea, fecha_emision = excluded.fecha_emision,
        fecha_emision_anterior = excluded.fecha_emision_anterior, otras_cargas_anterior = excluded.otras_cargas_anterior,
        tipo_dte = excluded.tipo_dte, serie = excluded.serie, numero = excluded.numero, nit_emisor = excluded.nit_emisor, nombre_emisor = excluded.nombre_emisor, clasificacion_emisor = excluded.clasificacion_emisor, exportacion = excluded.exportacion, codigo_establecimiento = excluded.codigo_establecimiento, nombre_establecimiento = excluded.nombre_establecimiento, id_receptor = excluded.id_receptor, nombre_receptor = excluded.nombre_receptor, nit_certificador = excluded.nit_certificador, nombre_certificador = excluded.nombre_certificador, estado = excluded.estado, moneda = excluded.moneda, gran_total = excluded.gran_total, iva = excluded.iva, anulada = excluded.anulada, fecha_anulacion = excluded.fecha_anulacion, petroleo = excluded.petroleo, turismo_hospedaje = excluded.turismo_hospedaje, turismo_pasaje = excluded.turismo_pasaje, timbre_prensa = excluded.timbre_prensa, bomberos = excluded.bomberos, tasa_municipal = excluded.tasa_municipal, bebidas_alcohol = excluded.bebidas_alcohol, tabaco = excluded.tabaco, cemento = excluded.cemento, bebidas_no_alcohol = excluded.bebidas_no_alcohol, tarifa_portuaria = excluded.tarifa_portuaria, clasificacion = excluded.clasificacion, clasificacion_id = excluded.clasificacion_id, cuenta_codigo = excluded.cuenta_codigo, observaciones = excluded.observaciones
        where carga_sat_ventas_lineas.carga_id = excluded.carga_id
      returning (xmax = 0) as nuevo, false as sin_cuenta)
    select count(*) filter (where nuevo), count(*) filter (where not nuevo), 0 into v_n, v_a, v_scta from x;
  end if;
  v_otra := (select count(*) from t330_l where carga_id is not null) - v_n - v_a;
  return format('%s CONSISAV-%s localidades %s a %s: %s facturas nuevas, %s actualizadas.', case p_tipo when 'COMPRAS' then 'Facturas recibidas' else 'Facturas emitidas' end,
      p_org, p_desde, case when p_hasta = 99999 then 'la última' else p_hasta::text end, v_n, v_a)
    || case when v_otra > 0 then format(' %s ya estaban en una carga del sistema (no se tocan).', v_otra) else '' end
    || case when v_scta > 0 then format(' %s con una cuenta que no existe en el catálogo (queda su código).', v_scta) else '' end
    || case when v_sin > 0 then format(' %s sin su archivo (ejecuta antes la parte de archivos).', v_sin) else '' end;
end;
$fn$;
revoke execute on function public.mig330_revisar_carga() from public, anon, authenticated;
revoke execute on function public.mig330_quitar_repetidas() from public, anon, authenticated;
revoke execute on function public.mig330_cargas(int) from public, anon, authenticated;
revoke execute on function public.mig330_lineas(text, int, int, int) from public, anon, authenticated;

notify pgrst, 'reload schema';
