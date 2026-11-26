-- Script 324 · Catálogo contable del servidor Consisav: organizaciones 13 a 17 (CONSISAV-8 a CONSISAV-12 del sistema anterior),
--   de los archivos de «Datos Contables Servidor Consisav al 04-11-2026»:
--     CON_CUENTAS_CONTABLES (partes 1 y 2): 123856 cuentas de 369 empresas (versión 1 del catálogo de cada empresa).
--     CON_TIPOS_TRANSACCIONES, CON_PLANTILLAS y CON_DETALLE_PLANTILLAS: 3092 transacciones, 3103 plantillas y 7288 líneas.
--     CON_REPORTES, CON_GRUPOS_REPORTES, CON_DETALLE_REPORTES y CON_DATOS_REPORTES: 96 reportes contables con 334 grupos,
--       10877 líneas y 8386 valores históricos.
--   Cada empresa se busca por su organización (organizacion_anterior = CONSISAV-n) y su correlativo (= LOCALIDAD del sistema anterior).
--   Lo que ya existe se actualiza y lo que falta se crea; se puede ejecutar de nuevo.
--   Orden: esta parte 0 (estructura y tablas de carga), las partes de datos (cargan las tablas mig324_*), las partes que pasan las cuentas
--   a cada empresa y la última (transacciones, reportes, resumen y limpieza). Si se vuelve a ejecutar la parte 0, se repiten todas.
--   Columnas con información que no existían (se crean):
--     cuentas: nivel_anterior (NIVEL), cuenta_mayor_anterior (CUENTA_MAYOR), ant_saldo_anterior, ant_debitos, ant_creditos, ant_saldo_actual y
--       sus equivalentes en moneda extranjera ant_mi_* (SALDO_ANTERIOR, DEBITOS, CREDITOS, SALDO_ACTUAL y MI_* al 04-11-2026).
--     transacciones_contables: tipo_plantilla (TIPO_PLANTILLA de la plantilla).
--     Reportes contables (estados financieros definidos en el sistema anterior): tablas reportes_contables, reportes_contables_grupos,
--       reportes_contables_detalle y reportes_contables_datos con todas sus columnas.

alter table public.cuentas add column if not exists mascara text;
alter table public.cuentas add column if not exists mostrar boolean not null default true;
alter table public.cuentas add column if not exists nivel_anterior integer;
alter table public.cuentas add column if not exists cuenta_mayor_anterior text;
alter table public.cuentas add column if not exists ant_saldo_anterior numeric(18, 2);
alter table public.cuentas add column if not exists ant_debitos numeric(18, 2);
alter table public.cuentas add column if not exists ant_creditos numeric(18, 2);
alter table public.cuentas add column if not exists ant_saldo_actual numeric(18, 2);
alter table public.cuentas add column if not exists ant_mi_saldo_anterior numeric(18, 2);
alter table public.cuentas add column if not exists ant_mi_debitos numeric(18, 2);
alter table public.cuentas add column if not exists ant_mi_creditos numeric(18, 2);
alter table public.cuentas add column if not exists ant_mi_saldo_actual numeric(18, 2);
alter table public.transacciones_contables add column if not exists modulo text;
alter table public.transacciones_contables add column if not exists plantilla text;
alter table public.transacciones_contables add column if not exists tipo_plantilla text;
alter table public.transaccion_cuentas add column if not exists cuenta_codigo text;
-- Al crear una cuenta se ligan las líneas de transacción que la esperaban: con este índice esa búsqueda es inmediata.
create index if not exists transaccion_cuentas_pendientes_idx on public.transaccion_cuentas (cuenta_codigo) where cuenta_id is null;

-- ---------- Reportes contables del sistema anterior ----------
create table if not exists public.reportes_contables (
  id                   bigint generated always as identity primary key,
  organizacion_id      bigint not null references public.organizaciones (id),
  localidad_id         bigint not null references public.localidades (id),
  tipo_reporte         integer not null,
  reporte              integer not null,
  nombre               text,
  siglas               text,
  titulo_1             text,
  titulo_2             text,
  titulo_3             text,
  modulo               integer,
  moneda               integer,
  frecuencia_impresion integer,
  copias               integer,
  tipo_valor           text,
  modo_operacion       text,
  texto_final          text,
  fecha_inicio         date,
  fecha_final          date,
  localidad_generada   integer,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (localidad_id, tipo_reporte, reporte)
);
create table if not exists public.reportes_contables_grupos (
  id                 bigint generated always as identity primary key,
  reporte_id         bigint not null references public.reportes_contables (id) on delete cascade,
  grupo              integer not null,
  orden_impresion    integer,
  cuenta             text,
  descripcion        text,
  operacion          integer,
  columna            integer,
  columna_visualizar integer,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (reporte_id, grupo)
);
create table if not exists public.reportes_contables_detalle (
  id                 bigint generated always as identity primary key,
  reporte_id         bigint not null references public.reportes_contables (id) on delete cascade,
  grupo              integer not null,
  linea              integer not null,
  orden_grupo        integer,
  orden_reporte      integer,
  cuenta             text,
  descripcion        text,
  operacion          integer,
  columna            integer,
  columna_visualizar integer,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (reporte_id, grupo, linea)
);
create table if not exists public.reportes_contables_datos (
  id              bigint generated always as identity primary key,
  reporte_id      bigint not null references public.reportes_contables (id) on delete cascade,
  anio            integer not null,
  mes             integer not null,
  orden_impresion integer not null,
  cuenta          text,
  descripcion     text,
  valor_columna1  numeric(18, 2),
  valor_columna2  numeric(18, 2),
  valor_columna3  numeric(18, 2),
  valor_columna4  numeric(18, 2),
  operacion       integer,
  origen_dato     text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (reporte_id, anio, mes, orden_impresion)
);
create index if not exists reportes_contables_localidad_idx on public.reportes_contables (localidad_id);
do $$
declare t text;
begin
  foreach t in array array['reportes_contables', 'reportes_contables_grupos', 'reportes_contables_detalle', 'reportes_contables_datos'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.auditar()', t || '_auditar', t);
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

-- ---------- Tablas de carga (solo para esta migración: sin acceso desde la aplicación; la última parte las borra) ----------
drop table if exists public.mig324_cuentas, public.mig324_saldos, public.mig324_trans, public.mig324_plantillas, public.mig324_detpl,
  public.mig324_reportes, public.mig324_grupos, public.mig324_detrep, public.mig324_datos;
create table public.mig324_cuentas (org int, loc int, codigo text, nombre text, tipo int, integracion text, mayor text, mascara text, vigente text, nivel int);
create table public.mig324_saldos (org int, loc int, codigo text, s_ant numeric, deb numeric, cre numeric, s_act numeric, mi_s_ant numeric, mi_deb numeric, mi_cre numeric, mi_s_act numeric);
create table public.mig324_trans (org int, loc int, numero int, descripcion text, modulo int, plantilla int);
create table public.mig324_plantillas (org int, loc int, modulo int, plantilla int, descripcion text, tipo text, forma text);
create table public.mig324_detpl (org int, loc int, modulo int, plantilla int, secuencia int, cuenta text, mov text);
create table public.mig324_reportes (org int, loc int, tipo int, reporte int, nombre text, siglas text, t1 text, t2 text, t3 text, modulo int, moneda int,
  frecuencia int, copias int, tipo_valor text, modo text, texto_final text, f_ini date, f_fin date, loc_gen int);
create table public.mig324_grupos (org int, loc int, tipo int, reporte int, grupo int, orden int, cuenta text, descripcion text, operacion int, columna int, col_vis int);
create table public.mig324_detrep (org int, loc int, tipo int, reporte int, grupo int, linea int, orden_grupo int, orden_reporte int, cuenta text, descripcion text,
  operacion int, columna int, col_vis int);
create table public.mig324_datos (org int, loc int, tipo int, reporte int, anio int, mes int, orden int, cuenta text, descripcion text, v1 numeric, v2 numeric,
  v3 numeric, v4 numeric, operacion int, origen text);
do $$
declare t text;
begin
  foreach t in array array['mig324_cuentas', 'mig324_saldos', 'mig324_trans', 'mig324_plantillas', 'mig324_detpl', 'mig324_reportes', 'mig324_grupos',
                           'mig324_detrep', 'mig324_datos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;
create index on public.mig324_cuentas (org, loc);

-- ---------- Paso de las cuentas a las empresas (por rango de LOCALIDAD del sistema anterior) ----------
create or replace function public.mig324_cargar_cuentas(p_org int, p_desde int, p_hasta int) returns text
language plpgsql set search_path = '' as $fn$
declare
  v_org bigint; v_nuevas int := 0; v_n int; v_act int := 0; v_cat int; v_tipos int; v_omit text; v_sal int; L int;
begin
  select id into v_org from public.organizaciones where upper(organizacion_anterior) = 'CONSISAV-' || p_org;
  if v_org is null then raise exception 'No existe la organización CONSISAV-% (ejecuta antes el script 321).', p_org; end if;
  drop table if exists t324_loc;
  create temp table t324_loc on commit drop as
    select m.loc, l.id as loc_id from (select distinct loc from public.mig324_cuentas where org = p_org and loc between p_desde and p_hasta) m
    left join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc;
  select string_agg(loc::text, ', ' order by loc) into v_omit from t324_loc where loc_id is null;

  insert into public.catalogos_cuentas (organizacion_id, localidad_id, version, fecha_del, activo)
  select v_org, t.loc_id, 1, current_date, true from t324_loc t
  where t.loc_id is not null and not exists (select 1 from public.catalogos_cuentas k where k.localidad_id = t.loc_id and k.version = 1);
  get diagnostics v_cat = row_count;

  -- Tipos de cuenta que le falten a la empresa: se copian de otra empresa con el mismo código.
  insert into public.tipos_cuenta (codigo, descripcion, tipo_operacion, operacion_resultado, incluye_centro_costo, activo, localidad_id)
  select m.tipo, coalesce(s.descripcion, 'TIPO ' || m.tipo), coalesce(s.tipo_operacion, 'DEBE-HABER'), coalesce(s.operacion_resultado, 'NINGUNA'),
         coalesce(s.incluye_centro_costo, false), true, t.loc_id
  from (select distinct loc, tipo from public.mig324_cuentas where org = p_org and loc between p_desde and p_hasta and tipo is not null) m
  join t324_loc t on t.loc = m.loc and t.loc_id is not null
  left join lateral (select * from public.tipos_cuenta s where s.codigo = m.tipo order by s.id limit 1) s on true
  where not exists (select 1 from public.tipos_cuenta x where x.localidad_id = t.loc_id and x.codigo = m.tipo);
  get diagnostics v_tipos = row_count;

  drop table if exists t324_c;
  create temp table t324_c on commit drop as
    select m.*, k.id as cat_id, c.id as cuenta_id, tc.id as tipo_id, s.s_ant, s.deb, s.cre, s.s_act, s.mi_s_ant, s.mi_deb, s.mi_cre, s.mi_s_act
    from public.mig324_cuentas m
    join t324_loc t on t.loc = m.loc and t.loc_id is not null
    join public.catalogos_cuentas k on k.localidad_id = t.loc_id and k.version = 1
    left join public.cuentas c on c.catalogo_id = k.id and c.codigo = m.codigo
    left join public.tipos_cuenta tc on tc.localidad_id = t.loc_id and tc.codigo = m.tipo
    left join public.mig324_saldos s on s.org = m.org and s.loc = m.loc and s.codigo = m.codigo
    where m.org = p_org and m.loc between p_desde and p_hasta;

  update public.cuentas c set
    nombre = coalesce(upper(trim(x.nombre)), c.nombre), integra = x.integracion = 'S', vigente = coalesce(x.vigente, 'N') = 'S',
    mascara = coalesce(x.mascara, c.mascara), nivel_anterior = x.nivel, cuenta_mayor_anterior = x.mayor,
    ant_saldo_anterior = coalesce(x.s_ant, 0), ant_debitos = coalesce(x.deb, 0), ant_creditos = coalesce(x.cre, 0), ant_saldo_actual = coalesce(x.s_act, 0),
    ant_mi_saldo_anterior = coalesce(x.mi_s_ant, 0), ant_mi_debitos = coalesce(x.mi_deb, 0), ant_mi_creditos = coalesce(x.mi_cre, 0),
    ant_mi_saldo_actual = coalesce(x.mi_s_act, 0)
  from t324_c x where c.id = x.cuenta_id;
  get diagnostics v_act = row_count;
  -- El tipo solo se cambia en las cuentas raíz y solo si es otro (las subcuentas lo heredan de su cuenta mayor).
  update public.cuentas c set tipo_cuenta_id = x.tipo_id
  from t324_c x where c.id = x.cuenta_id and c.cuenta_mayor_id is null and x.tipo_id is not null and c.tipo_cuenta_id is distinct from x.tipo_id;

  -- Cuentas nuevas, de las más cortas a las más largas: así cada cuenta mayor ya existe. La cuenta mayor es la del archivo si su código es
  -- el inicio del código de la subcuenta; si no, la cuenta existente más larga que sea el inicio de su código.
  for L in select distinct length(codigo) from t324_c where cuenta_id is null order by 1 loop
    insert into public.cuentas (catalogo_id, codigo, nombre, cuenta_mayor_id, tipo_cuenta_id, integra, vigente, mascara, mostrar, nivel_anterior,
           cuenta_mayor_anterior, ant_saldo_anterior, ant_debitos, ant_creditos, ant_saldo_actual, ant_mi_saldo_anterior, ant_mi_debitos,
           ant_mi_creditos, ant_mi_saldo_actual)
    select x.cat_id, x.codigo, coalesce(upper(trim(x.nombre)), 'CUENTA ' || x.codigo), mm.id, x.tipo_id, x.integracion = 'S',
           coalesce(x.vigente, 'N') = 'S', x.mascara, true, x.nivel, x.mayor, coalesce(x.s_ant, 0), coalesce(x.deb, 0), coalesce(x.cre, 0),
           coalesce(x.s_act, 0), coalesce(x.mi_s_ant, 0), coalesce(x.mi_deb, 0), coalesce(x.mi_cre, 0), coalesce(x.mi_s_act, 0)
    from t324_c x
    left join lateral (
      select c.id from public.cuentas c
      where c.catalogo_id = x.cat_id and c.codigo = any (array(select left(x.codigo, g) from generate_series(1, length(x.codigo) - 1) g))
      order by (c.codigo = x.mayor) desc, length(c.codigo) desc limit 1) mm on true
    where x.cuenta_id is null and length(x.codigo) = L;
    get diagnostics v_n = row_count;
    v_nuevas := v_nuevas + v_n;
  end loop;

  return format('CONSISAV-%s localidades %s a %s: %s cuentas nuevas, %s actualizadas, %s catálogos y %s tipos de cuenta creados.%s', p_org, p_desde, p_hasta,
    v_nuevas, v_act, v_cat, v_tipos, case when v_omit is not null then ' Empresas que no existen (omitidas): LOCALIDAD ' || v_omit || '.' else '' end);
end;
$fn$;

-- ---------- Transacciones con las cuentas de su plantilla ----------
create or replace function public.mig324_cargar_transacciones() returns text
language plpgsql set search_path = '' as $fn$
declare v_tr int; v_n int; v_lin int; v_pend int;
begin
  drop table if exists t324_loc;
  create temp table t324_loc on commit drop as
    select o.id as org_id, o.organizacion_anterior, split_part(o.organizacion_anterior, '-', 2)::int as org, l.correlativo as loc, l.id as loc_id
    from public.organizaciones o join public.localidades l on l.organizacion_id = o.id
    where upper(o.organizacion_anterior) like 'CONSISAV-%';
  -- Transacciones del archivo, y las plantillas que no tienen transacción (con el número de la plantilla, si está libre).
  drop table if exists t324_t;
  create temp table t324_t on commit drop as
    select t.org_id, t.loc_id, x.numero, upper(trim(coalesce(x.descripcion, p.descripcion, 'TRANSACCIÓN ' || x.numero))) as descripcion,
           x.modulo, x.plantilla, p.tipo
    from public.mig324_trans x join t324_loc t on t.org = x.org and t.loc = x.loc
    left join public.mig324_plantillas p on p.org = x.org and p.loc = x.loc and p.modulo = x.modulo and p.plantilla = x.plantilla
    union all
    select t.org_id, t.loc_id, p.plantilla, upper(trim(coalesce(p.descripcion, 'PLANTILLA ' || p.plantilla))), p.modulo, p.plantilla, p.tipo
    from public.mig324_plantillas p join t324_loc t on t.org = p.org and t.loc = p.loc
    where not exists (select 1 from public.mig324_trans x where x.org = p.org and x.loc = p.loc and x.modulo = p.modulo and x.plantilla = p.plantilla)
      and not exists (select 1 from public.mig324_trans x where x.org = p.org and x.loc = p.loc and x.numero = p.plantilla);

  -- La numeración de transacciones no admite «on conflict» (rechaza el número repetido antes): se actualiza lo que existe y se crea lo demás.
  drop table if exists t324_u;
  create temp table t324_u on commit drop as select distinct on (loc_id, numero) * from t324_t order by loc_id, numero;
  update public.transacciones_contables x set descripcion = u.descripcion, modulo = u.modulo::text, plantilla = u.plantilla::text, tipo_plantilla = u.tipo
  from t324_u u where x.localidad_id = u.loc_id and x.numero = u.numero;
  get diagnostics v_tr = row_count;
  insert into public.transacciones_contables (organizacion_id, localidad_id, numero, descripcion, estado, aplica_poliza, modulo, plantilla, tipo_plantilla)
  select u.org_id, u.loc_id, u.numero, u.descripcion, 'ACTIVO', true, u.modulo::text, u.plantilla::text, u.tipo from t324_u u
  where not exists (select 1 from public.transacciones_contables x where x.localidad_id = u.loc_id and x.numero = u.numero);
  get diagnostics v_n = row_count;
  v_tr := v_tr + v_n;

  insert into public.transaccion_cuentas (transaccion_id, linea, cuenta_codigo, naturaleza, orden, operacion, version)
  select tc.id, d.secuencia, d.cuenta, case when d.mov = 'C' then 'H' else 'D' end, d.secuencia, 'OTRO', 1
  from t324_t t
  join public.transacciones_contables tc on tc.localidad_id = t.loc_id and tc.numero = t.numero
  join t324_loc l on l.loc_id = t.loc_id
  join public.mig324_detpl d on d.org = l.org and d.loc = l.loc and d.modulo = t.modulo and d.plantilla = t.plantilla
  where d.secuencia > 0 and d.cuenta is not null
  on conflict (transaccion_id, linea) do update set cuenta_codigo = excluded.cuenta_codigo, cuenta_id = null, naturaleza = excluded.naturaleza,
    orden = excluded.orden;
  get diagnostics v_lin = row_count;
  select count(*) into v_pend from public.transaccion_cuentas c join public.transacciones_contables t on t.id = c.transaccion_id
  join t324_loc l on l.loc_id = t.localidad_id where c.cuenta_id is null;
  return format('Transacciones: %s creadas o actualizadas; líneas de plantilla: %s%s.', v_tr, v_lin,
    case when v_pend > 0 then format(' (%s con una cuenta que no está en el catálogo de la empresa: quedan con su código)', v_pend) else '' end);
end;
$fn$;

-- ---------- Reportes contables ----------
create or replace function public.mig324_cargar_reportes() returns text
language plpgsql set search_path = '' as $fn$
declare v_r int; v_g int; v_d int; v_v int;
begin
  drop table if exists t324_loc;
  create temp table t324_loc on commit drop as
    select o.id as org_id, split_part(o.organizacion_anterior, '-', 2)::int as org, l.correlativo as loc, l.id as loc_id
    from public.organizaciones o join public.localidades l on l.organizacion_id = o.id where upper(o.organizacion_anterior) like 'CONSISAV-%';
  insert into public.reportes_contables (organizacion_id, localidad_id, tipo_reporte, reporte, nombre, siglas, titulo_1, titulo_2, titulo_3, modulo, moneda,
         frecuencia_impresion, copias, tipo_valor, modo_operacion, texto_final, fecha_inicio, fecha_final, localidad_generada)
  select t.org_id, t.loc_id, r.tipo, r.reporte, r.nombre, r.siglas, r.t1, r.t2, r.t3, r.modulo, r.moneda, r.frecuencia, r.copias, r.tipo_valor, r.modo,
         r.texto_final, r.f_ini, r.f_fin, r.loc_gen
  from public.mig324_reportes r join t324_loc t on t.org = r.org and t.loc = r.loc
  on conflict (localidad_id, tipo_reporte, reporte) do update set nombre = excluded.nombre, siglas = excluded.siglas, titulo_1 = excluded.titulo_1,
    titulo_2 = excluded.titulo_2, titulo_3 = excluded.titulo_3, modulo = excluded.modulo, moneda = excluded.moneda,
    frecuencia_impresion = excluded.frecuencia_impresion, copias = excluded.copias, tipo_valor = excluded.tipo_valor,
    modo_operacion = excluded.modo_operacion, texto_final = excluded.texto_final, fecha_inicio = excluded.fecha_inicio,
    fecha_final = excluded.fecha_final, localidad_generada = excluded.localidad_generada;
  get diagnostics v_r = row_count;
  drop table if exists t324_r;
  create temp table t324_r on commit drop as
    select l.org, l.loc, x.tipo_reporte as tipo, x.reporte, x.id from public.reportes_contables x join t324_loc l on l.loc_id = x.localidad_id;
  insert into public.reportes_contables_grupos (reporte_id, grupo, orden_impresion, cuenta, descripcion, operacion, columna, columna_visualizar)
  select r.id, g.grupo, g.orden, g.cuenta, g.descripcion, g.operacion, g.columna, g.col_vis
  from public.mig324_grupos g join t324_r r on r.org = g.org and r.loc = g.loc and r.tipo = g.tipo and r.reporte = g.reporte
  on conflict (reporte_id, grupo) do update set orden_impresion = excluded.orden_impresion, cuenta = excluded.cuenta, descripcion = excluded.descripcion,
    operacion = excluded.operacion, columna = excluded.columna, columna_visualizar = excluded.columna_visualizar;
  get diagnostics v_g = row_count;
  insert into public.reportes_contables_detalle (reporte_id, grupo, linea, orden_grupo, orden_reporte, cuenta, descripcion, operacion, columna, columna_visualizar)
  select r.id, d.grupo, d.linea, d.orden_grupo, d.orden_reporte, d.cuenta, d.descripcion, d.operacion, d.columna, d.col_vis
  from public.mig324_detrep d join t324_r r on r.org = d.org and r.loc = d.loc and r.tipo = d.tipo and r.reporte = d.reporte
  on conflict (reporte_id, grupo, linea) do update set orden_grupo = excluded.orden_grupo, orden_reporte = excluded.orden_reporte, cuenta = excluded.cuenta,
    descripcion = excluded.descripcion, operacion = excluded.operacion, columna = excluded.columna, columna_visualizar = excluded.columna_visualizar;
  get diagnostics v_d = row_count;
  insert into public.reportes_contables_datos (reporte_id, anio, mes, orden_impresion, cuenta, descripcion, valor_columna1, valor_columna2, valor_columna3,
         valor_columna4, operacion, origen_dato)
  select r.id, d.anio, d.mes, d.orden, d.cuenta, d.descripcion, d.v1, d.v2, d.v3, d.v4, d.operacion, d.origen
  from public.mig324_datos d join t324_r r on r.org = d.org and r.loc = d.loc and r.tipo = d.tipo and r.reporte = d.reporte
  on conflict (reporte_id, anio, mes, orden_impresion) do update set cuenta = excluded.cuenta, descripcion = excluded.descripcion,
    valor_columna1 = excluded.valor_columna1, valor_columna2 = excluded.valor_columna2, valor_columna3 = excluded.valor_columna3,
    valor_columna4 = excluded.valor_columna4, operacion = excluded.operacion, origen_dato = excluded.origen_dato;
  get diagnostics v_v = row_count;
  return format('Reportes contables: %s reportes, %s grupos, %s líneas y %s valores históricos.', v_r, v_g, v_d, v_v);
end;
$fn$;
revoke execute on function public.mig324_cargar_cuentas(int, int, int) from public, anon, authenticated;
revoke execute on function public.mig324_cargar_transacciones() from public, anon, authenticated;
revoke execute on function public.mig324_cargar_reportes() from public, anon, authenticated;

notify pgrst, 'reload schema';
