-- Script 326 · Partidas contables (pólizas) del servidor Consisav: organizaciones 13 a 17 (CONSISAV-8 a CONSISAV-12 del sistema anterior),
--   de los archivos de «Datos Contables Servidor Consisav al 04-11-2026»:
--     CON_POLIZAS: 47926 pólizas (CONSISAV-8: 35912, CONSISAV-9: 11071, CONSISAV-10: 3, CONSISAV-11: 517, CONSISAV-12: 423).
--     CON_DETALLE_POLIZAS (3 archivos): 194885 líneas (CONSISAV-8: 129646, CONSISAV-9: 60120, CONSISAV-11: 3918, CONSISAV-12: 1201).
--   Ejecutar después de los scripts 324 (catálogo de cuentas y transacciones) y 325.
--   Cada empresa se busca por su organización (organizacion_anterior = CONSISAV-n) y su correlativo (= LOCALIDAD del sistema anterior).
--   Una partida se identifica por su empresa, año, mes y número de póliza; una línea por su partida y su número. Si ya existe (migrada
--   antes) se actualiza; una partida registrada en el sistema (no migrada) con el mismo número o número anual no se toca y se informa.
--   Columnas con información que no existían (se crean):
--     partidas: documento_anterior (DOCUMENTO), correlativo_auxiliar_anterior (CORRELATIVO_AUXILIAR).
--     partida_lineas: fecha_cierre_anterior (FECHA_CIERRE), clasificacion_anterior (CLASIFICACION), valor_cambio_anterior (VALOR_CAMBIO).
--   Las demás columnas ya existen (scripts 34, 191 y 265). Columnas vacías en todas las filas (no se agregan):
--     CON_POLIZAS: MOTIVO_REVERSION, FECHA_REVERSION, USUARIO_REVERSION, EMPRESA_CONSOLIDA; detalle: EMPRESA_CONSOLIDA, DISTRIBUCION.
--   Equivalencias: POLIZA = número del mes; POLIZA_ANUAL = número anual; FECHA, USUARIO y DESCRIPCION (13 sin descripción: «PÓLIZA SIN DESCRIPCIÓN»);
--     ESTADO V = vigente; TIPO A = automática (M y S = manual); APROBADA S = aprobada, con FECHA_APROBACION y USUARIO_APROBACION;
--     CLASIFICACION M y H = partida del mes, C = de cierre, A = de ajuste, P = de apertura (el código queda en clasificacion_anterior);
--     TIPO_TRANSACCION = transacción contable de la empresa; tipo de partida según el nombre de la transacción: PD 28087, PV 4440, PC 3977, PIM 3727, PN 1950, PI 1781, PE 1749, PA 919, PCR 444, PDA 359, PB 305, PIN 96, PRC 89, PAJ 3.
--     MODULO, MONEDA_INTEGRACION y VALOR_CAMBIO quedan como dato; moneda: quetzales.
--   Transacciones contables: se crean las que usan las pólizas y no existen en la empresa (657 no venían en CON_TIPOS_TRANSACCIONES; toman el
--     nombre de la misma transacción en otra empresa de la organización o la descripción de su primera póliza).
--   Número anual repetido en la misma empresa y año (la base no lo permite): 7 (se les da el siguiente libre; el original queda en numero_anual_anterior).
--   Detalle: CUENTA en el catálogo versión 1 de la empresa (todas existen en CON_CUENTAS_CONTABLES); DEBITO = debe y CREDITO = haber.
--     39 líneas con valores negativos pasan al otro lado; 64 traen débito y crédito a la vez y queda la diferencia (6 quedan en cero);
--     1198 líneas en cero se omiten. Lo que venía queda en debito_anterior y credito_anterior. 62 pólizas venían descuadradas y se migran
--     tal como venían. 392 pólizas no traen detalle. Los totales de cada partida se calculan con sus líneas.
--   Orden: esta parte 0 (estructura, tablas de carga y funciones), las partes de datos (cargan las tablas mig326_*), las partes que pasan las
--   partidas a cada empresa y la última (resumen y limpieza). Se puede ejecutar de nuevo: actualiza, no duplica.

alter table public.partidas add column if not exists origen_anterior text;
alter table public.partidas add column if not exists estado_anterior text;
alter table public.partidas add column if not exists modulo_anterior integer;
alter table public.partidas add column if not exists tipo_anterior text;
alter table public.partidas add column if not exists aprobada_anterior text;
alter table public.partidas add column if not exists clasificacion_anterior text;
alter table public.partidas add column if not exists transaccion_anterior integer;
alter table public.partidas add column if not exists transaccion_id bigint references public.transacciones_contables (id) on delete set null;
alter table public.partidas add column if not exists moneda_integracion integer;
alter table public.partidas add column if not exists valor_cambio_anterior numeric(18, 6);
alter table public.partidas add column if not exists numero_anual_anterior integer;
alter table public.partidas add column if not exists documento_anterior text;
alter table public.partidas add column if not exists correlativo_auxiliar_anterior integer;
alter table public.partida_lineas add column if not exists debe_mi numeric(18, 2);
alter table public.partida_lineas add column if not exists haber_mi numeric(18, 2);
alter table public.partida_lineas add column if not exists cuenta_codigo_anterior text;
alter table public.partida_lineas add column if not exists debito_anterior numeric(18, 2);
alter table public.partida_lineas add column if not exists credito_anterior numeric(18, 2);
alter table public.partida_lineas add column if not exists origen_anterior text;
alter table public.partida_lineas add column if not exists fecha_cierre_anterior date;
alter table public.partida_lineas add column if not exists clasificacion_anterior text;
alter table public.partida_lineas add column if not exists valor_cambio_anterior numeric(18, 6);

-- ---------- Tablas de carga (solo para esta migración: sin acceso desde la aplicación; la última parte las borra) ----------
drop table if exists public.mig326_polizas, public.mig326_lineas, public.mig326_trx;
create table public.mig326_polizas (pid int primary key, org int, loc int, anio int, mes int, numero int, anual int, anual_ant int, fecha numeric, descripcion text,
  estado text, modulo int, tipo text, usuario text, aprobada text, fecha_aprob numeric, usuario_aprob text, clasif text, transaccion int, moneda_int int, cambio numeric,
  documento text, corr_aux int, siglas text, clasificacion text);
create table public.mig326_lineas (pid int, linea int, codigo text, debito numeric, credito numeric, debito_mi numeric, credito_mi numeric, fecha_cierre int, clasif text, cambio numeric);
create table public.mig326_trx (org int, loc int, numero int, descripcion text);
do $$
declare t text;
begin
  foreach t in array array['mig326_polizas', 'mig326_lineas', 'mig326_trx'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- ---------- Paso de las partidas a las empresas (por rango de LOCALIDAD del sistema anterior) ----------
create or replace function public.mig326_cargar_partidas(p_org int, p_desde int, p_hasta int) returns text
language plpgsql set search_path = '' as $fn$
declare
  v_org bigint; v_gtq bigint; v_omit text; v_sincat text; v_trx int; p_n int := 0; p_a int := 0; p_s int; v_choq text;
  l_n int := 0; l_a int := 0; l_s int; l_c int; v_ctas text;
begin
  select id into v_org from public.organizaciones where upper(organizacion_anterior) = 'CONSISAV-' || p_org;
  if v_org is null then raise exception 'No existe la organización CONSISAV-% (ejecuta antes el script 321).', p_org; end if;
  select id into v_gtq from public.monedas where iso = 'GTQ';

  drop table if exists t326_loc;
  create temp table t326_loc on commit drop as
    select m.loc, l.id as loc_id,
           (select k.id from public.catalogos_cuentas k where k.localidad_id = l.id order by (k.version = 1) desc, k.activo desc, k.version desc limit 1) as cat_id
    from (select distinct loc from public.mig326_polizas where org = p_org and loc between p_desde and p_hasta) m
    left join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc;
  select string_agg(loc::text, ', ' order by loc) into v_omit from t326_loc where loc_id is null;
  select string_agg(loc::text, ', ' order by loc) into v_sincat from t326_loc where loc_id is not null and cat_id is null;

  -- Transacciones contables que usan las pólizas y no existen en la empresa.
  insert into public.transacciones_contables (organizacion_id, localidad_id, numero, descripcion, estado, aplica_poliza)
  select v_org, t.loc_id, x.numero, x.descripcion, 'ACTIVO', true
  from public.mig326_trx x join t326_loc t on t.loc = x.loc and t.loc_id is not null
  where x.org = p_org and not exists (select 1 from public.transacciones_contables c where c.localidad_id = t.loc_id and c.numero = x.numero);
  get diagnostics v_trx = row_count;

  drop table if exists t326_p;
  create temp table t326_p on commit drop as
    select m.*, t.loc_id, t.cat_id, e.id as ex_id, e.origen_anterior as ex_origen, false as choque,
           (select tp.id from public.tipos_partida tp where tp.siglas = m.siglas) as tp_id,
           (select c.id from public.transacciones_contables c where c.localidad_id = t.loc_id and c.numero = m.transaccion) as tr_id,
           (timestamp '1899-12-30' + make_interval(secs => round(m.fecha * 86400))) at time zone 'America/Guatemala' as f,
           (timestamp '1899-12-30' + make_interval(secs => round(m.fecha_aprob * 86400))) at time zone 'America/Guatemala' as fa
    from public.mig326_polizas m join t326_loc t on t.loc = m.loc and t.cat_id is not null
    left join public.partidas e on e.localidad_id = t.loc_id and e.anio = m.anio and e.mes = m.mes and e.numero = m.numero
    where m.org = p_org and m.loc between p_desde and p_hasta;
  -- Choques: una partida del sistema (no migrada) con el mismo número, u otra partida con el mismo número anual.
  update t326_p p set choque = true
  where (p.ex_id is not null and p.ex_origen is distinct from 'MIGRADO')
     or exists (select 1 from public.partidas e where e.localidad_id = p.loc_id and e.anio = p.anio and e.numero_anual = p.anual and e.id is distinct from p.ex_id);
  select count(*), string_agg(format('localidad %s %s-%s-%s', loc, anio, lpad(mes::text, 2, '0'), numero), ', ' order by loc, anio, mes, numero)
    into p_s, v_choq from t326_p where choque;

  -- La carga trae número, fecha, usuario y aprobación del sistema anterior: se suspenden los automatismos (numeración, mes cerrado,
  -- cuenta de movimiento y totales); los totales se calculan al final.
  alter table public.partidas disable trigger partidas_preparar;
  alter table public.partidas disable trigger partidas_mes_cerrado;
  alter table public.partida_lineas disable trigger partida_lineas_preparar;
  alter table public.partida_lineas disable trigger partida_lineas_mes_cerrado;
  alter table public.partida_lineas disable trigger partida_lineas_totalizar;

  update public.partidas p set catalogo_id = t.cat_id, numero_anual = t.anual, fecha = coalesce(t.f, make_date(t.anio, t.mes, 1)::timestamptz), usuario = upper(t.usuario),
    tipo_partida_id = t.tp_id, descripcion = t.descripcion, moneda_id = v_gtq, tipo_cambio = 1, origen = case when t.tipo = 'A' then 'AUTOMÁTICA' else 'MANUAL' end,
    estado = case when upper(t.estado) = 'V' then 'VIGENTE' else 'ANULADA' end, clasificacion = t.clasificacion,
    aprobada = upper(t.aprobada) = 'S', aprobada_por = case when upper(t.aprobada) = 'S' then upper(coalesce(t.usuario_aprob, t.usuario)) end,
    aprobada_en = case when upper(t.aprobada) = 'S' then coalesce(t.fa, t.f) end, definitiva = false,
    origen_anterior = 'MIGRADO', estado_anterior = t.estado, modulo_anterior = t.modulo, tipo_anterior = t.tipo, aprobada_anterior = t.aprobada,
    clasificacion_anterior = t.clasif, transaccion_anterior = t.transaccion, transaccion_id = t.tr_id, moneda_integracion = t.moneda_int,
    valor_cambio_anterior = t.cambio, numero_anual_anterior = t.anual_ant, documento_anterior = t.documento, correlativo_auxiliar_anterior = t.corr_aux
  from t326_p t where p.id = t.ex_id and not t.choque;
  get diagnostics p_a = row_count;

  with ins as (
    insert into public.partidas (organizacion_id, localidad_id, catalogo_id, anio, mes, numero, numero_anual, fecha, usuario, tipo_partida_id, descripcion, moneda_id,
      tipo_cambio, origen, estado, aprobada, aprobada_por, aprobada_en, definitiva, clasificacion, origen_anterior, estado_anterior, modulo_anterior, tipo_anterior,
      aprobada_anterior, clasificacion_anterior, transaccion_anterior, transaccion_id, moneda_integracion, valor_cambio_anterior, numero_anual_anterior,
      documento_anterior, correlativo_auxiliar_anterior)
    select v_org, t.loc_id, t.cat_id, t.anio, t.mes, t.numero, t.anual, coalesce(t.f, make_date(t.anio, t.mes, 1)::timestamptz), upper(t.usuario), t.tp_id, t.descripcion,
      v_gtq, 1, case when t.tipo = 'A' then 'AUTOMÁTICA' else 'MANUAL' end, case when upper(t.estado) = 'V' then 'VIGENTE' else 'ANULADA' end,
      upper(t.aprobada) = 'S', case when upper(t.aprobada) = 'S' then upper(coalesce(t.usuario_aprob, t.usuario)) end,
      case when upper(t.aprobada) = 'S' then coalesce(t.fa, t.f) end, false, t.clasificacion, 'MIGRADO', t.estado, t.modulo, t.tipo, t.aprobada, t.clasif,
      t.transaccion, t.tr_id, t.moneda_int, t.cambio, t.anual_ant, t.documento, t.corr_aux
    from t326_p t where t.ex_id is null and not t.choque
    returning id, localidad_id, anio, mes, numero)
  update t326_p t set ex_id = ins.id from ins where t.loc_id = ins.localidad_id and t.anio = ins.anio and t.mes = ins.mes and t.numero = ins.numero;
  get diagnostics p_n = row_count;

  -- Detalle: los negativos pasan al otro lado y débito y crédito en la misma línea se compensan (queda la diferencia).
  drop table if exists t326_l;
  create temp table t326_l on commit drop as
    select l.*, t.ex_id as partida_id, t.loc, (select c.id from public.cuentas c where c.catalogo_id = t.cat_id and c.codigo = l.codigo) as cuenta_id,
           greatest(coalesce(l.debito, 0), 0) + greatest(-coalesce(l.credito, 0), 0) as dd, greatest(coalesce(l.credito, 0), 0) + greatest(-coalesce(l.debito, 0), 0) as hh
    from public.mig326_lineas l join t326_p t on t.pid = l.pid and not t.choque;
  select count(*) filter (where round(dd - hh, 2) = 0), count(*) filter (where round(dd - hh, 2) <> 0 and cuenta_id is null),
         string_agg(distinct format('localidad %s cuenta %s', loc, codigo), ', ') filter (where round(dd - hh, 2) <> 0 and cuenta_id is null)
    into l_s, l_c, v_ctas from t326_l;
  with x as (
    insert into public.partida_lineas (partida_id, linea, cuenta_id, debe, haber, debe_mi, haber_mi, cuenta_codigo_anterior, debito_anterior, credito_anterior,
      origen_anterior, fecha_cierre_anterior, clasificacion_anterior, valor_cambio_anterior)
    select partida_id, linea, cuenta_id, round(greatest(dd - hh, 0), 2), round(greatest(hh - dd, 0), 2), debito_mi, credito_mi, codigo, debito, credito,
      'MIGRADO', date '1899-12-30' + fecha_cierre, clasif, cambio
    from t326_l where cuenta_id is not null and round(dd - hh, 2) <> 0
    on conflict (partida_id, linea) do update set cuenta_id = excluded.cuenta_id, debe = excluded.debe, haber = excluded.haber, debe_mi = excluded.debe_mi,
      haber_mi = excluded.haber_mi, cuenta_codigo_anterior = excluded.cuenta_codigo_anterior, debito_anterior = excluded.debito_anterior,
      credito_anterior = excluded.credito_anterior, origen_anterior = 'MIGRADO', fecha_cierre_anterior = excluded.fecha_cierre_anterior,
      clasificacion_anterior = excluded.clasificacion_anterior, valor_cambio_anterior = excluded.valor_cambio_anterior
    returning (xmax = 0) as nuevo)
  select count(*) filter (where nuevo), count(*) filter (where not nuevo) into l_n, l_a from x;

  update public.partidas p set total_debe = coalesce(s.d, 0), total_haber = coalesce(s.h, 0)
  from t326_p t left join (select partida_id, sum(debe) d, sum(haber) h from public.partida_lineas
                           where partida_id in (select ex_id from t326_p where not choque) group by partida_id) s on s.partida_id = t.ex_id
  where p.id = t.ex_id and not t.choque;

  alter table public.partidas enable trigger partidas_preparar;
  alter table public.partidas enable trigger partidas_mes_cerrado;
  alter table public.partida_lineas enable trigger partida_lineas_preparar;
  alter table public.partida_lineas enable trigger partida_lineas_mes_cerrado;
  alter table public.partida_lineas enable trigger partida_lineas_totalizar;

  return format('CONSISAV-%s localidades %s a %s: %s partidas nuevas, %s actualizadas, %s no se tocaron; %s líneas nuevas, %s actualizadas, %s en cero omitidas, %s sin cuenta; %s transacciones creadas.',
    p_org, p_desde, case when p_hasta = 99999 then 'la última' else p_hasta::text end, p_n, p_a, p_s, l_n, l_a, l_s, l_c, v_trx)
    || case when v_omit is not null then ' Empresas que no existen (omitidas): LOCALIDAD ' || v_omit || '.' else '' end
    || case when v_sincat is not null then ' Empresas sin catálogo de cuentas (omitidas; ejecuta antes el script 324): LOCALIDAD ' || v_sincat || '.' else '' end
    || case when p_s > 0 then ' Partidas del sistema con el mismo número (no se cambiaron): ' || left(v_choq, 2000) || '.' else '' end
    || case when l_c > 0 then ' Cuentas que no existen en el catálogo (líneas omitidas): ' || left(v_ctas, 2000) || '.' else '' end;
end;
$fn$;
revoke execute on function public.mig326_cargar_partidas(int, int, int) from public, anon, authenticated;

notify pgrst, 'reload schema';
