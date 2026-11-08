-- Contabilidad: cierre contable completo.
-- Catálogos: ejercicios contables, cuentas de integración y de cierre por empresa, libros autorizados por la SAT.
-- Registros: partidas recurrentes, provisiones y diferidos (amortización mensual) y cuentas intercompañía.
-- Procesos: partidas automáticas (recurrentes, amortizaciones, diferencial cambiario y reversiones) con su control de
-- generación, mayorización (recálculo de totales) y cierre anual: partida de cierre de resultados (PCR), reserva legal
-- del 5 % y traslado a utilidades o pérdidas acumuladas, partida de cierre del ejercicio (PCE) y de apertura (PA) del año
-- siguiente; con el ejercicio cerrado sus 12 meses quedan cerrados. La reapertura es del Super Administrador, con motivo.
-- La PCE y la PA son partidas de registro (se ven en el libro diario) que no alteran saldos: los saldos son acumulados.

-- ============ Marca de las partidas del cierre anual ============
alter table public.partidas add column if not exists cierre_ejercicio text;
alter table public.partidas drop constraint if exists partidas_cierre_ejercicio_check;
alter table public.partidas add constraint partidas_cierre_ejercicio_check check (cierre_ejercicio in ('PCR', 'DIST', 'PCE', 'PA'));
create index if not exists partidas_cierre_ejercicio_idx on public.partidas (localidad_id, anio) where cierre_ejercicio is not null;

-- ============ Catálogos ============
create table if not exists public.ejercicios_contables (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  anio integer not null check (anio between 1900 and 2999), estado text not null default 'ABIERTO' check (estado in ('ABIERTO', 'CERRADO')),
  resultado numeric(16, 2) not null default 0, reserva_legal numeric(16, 2) not null default 0, trasladado numeric(16, 2) not null default 0,
  partida_pcr_id bigint references public.partidas (id), partida_dist_id bigint references public.partidas (id), partida_pce_id bigint references public.partidas (id), partida_pa_id bigint references public.partidas (id),
  cerrado_por text, cerrado_en timestamptz, reabierto_por text, reabierto_en timestamptz, motivo_reapertura text, observaciones text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, anio)
);
create table if not exists public.cuentas_integracion (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  clave text not null, cuenta_codigo text not null, nota text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, clave)
);
create table if not exists public.libros_autorizados (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  libro text not null, resolucion text, fecha_autorizacion date, folio_inicial integer not null default 1, folio_final integer not null default 1, folio_usado integer not null default 0,
  forma text not null default 'HOJAS MÓVILES' check (forma in ('HOJAS MÓVILES', 'LIBRO EMPASTADO', 'ELECTRÓNICO')), activo boolean not null default true, observaciones text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  check (folio_final >= folio_inicial), check (folio_usado >= 0)
);

-- ============ Registros ============
create table if not exists public.partidas_recurrentes (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo integer not null, descripcion text not null, tipo_partida_id bigint not null references public.tipos_partida (id),
  anio_desde integer not null, mes_desde integer not null check (mes_desde between 1 and 12), anio_hasta integer, mes_hasta integer check (mes_hasta between 1 and 12), activa boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.partida_recurrente_lineas (
  id bigint generated always as identity primary key, recurrente_id bigint not null references public.partidas_recurrentes (id) on delete cascade,
  linea integer not null, cuenta_codigo text not null, concepto text, debe numeric(16, 2) not null default 0 check (debe >= 0), haber numeric(16, 2) not null default 0 check (haber >= 0)
);
create table if not exists public.diferidos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo integer not null, descripcion text not null, tipo text not null default 'GASTO DIFERIDO' check (tipo in ('GASTO DIFERIDO', 'PROVISIÓN', 'INGRESO DIFERIDO', 'AMORTIZACIÓN')),
  cuenta_debe text not null, cuenta_haber text not null, monto_total numeric(16, 2) not null check (monto_total > 0), cuotas integer not null check (cuotas between 1 and 600),
  anio_inicio integer not null, mes_inicio integer not null check (mes_inicio between 1 and 12), documento text, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.cuentas_intercompania (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id),
  descripcion text not null, localidad_a_id bigint not null references public.localidades (id), cuenta_a text not null, localidad_b_id bigint not null references public.localidades (id), cuenta_b text not null,
  activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
-- Control de lo que generan los procesos automáticos (para no duplicar una partida del mes).
create table if not exists public.partidas_generadas (
  id bigint generated always as identity primary key, localidad_id bigint not null references public.localidades (id),
  origen text not null check (origen in ('RECURRENTE', 'DIFERIDO', 'DIFERENCIAL', 'REVERSIÓN')), referencia_id bigint not null default 0,
  anio integer not null, mes integer not null, partida_id bigint not null references public.partidas (id) on delete cascade, monto numeric(16, 2) not null default 0,
  usuario text, creado_en timestamptz not null default now()
);
create index if not exists partidas_generadas_idx on public.partidas_generadas (localidad_id, origen, referencia_id, anio, mes);

-- Con el ejercicio cerrado, sus doce meses quedan cerrados.
create or replace function public.periodo_cerrado(p_loc bigint, p_anio integer, p_mes integer)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.cierres_mes c where c.localidad_id = p_loc and c.anio = p_anio and c.mes = p_mes and c.cerrado)
      or exists (select 1 from public.ejercicios_contables e where e.localidad_id = p_loc and e.anio = p_anio and e.estado = 'CERRADO');
$function$;

-- Cuenta configurada para una clave (cuentas de integración y de cierre), con su respaldo en los parámetros generales.
create or replace function public.con_cuenta_clave(p_loc bigint, p_clave text)
 returns text language sql stable security definer set search_path to '' as $function$
  select coalesce(
    (select nullif(trim(ci.cuenta_codigo), '') from public.cuentas_integracion ci where ci.localidad_id = p_loc and ci.clave = p_clave),
    (select nullif(trim(case p_clave when 'RESULTADO_EJERCICIO' then g.cuenta_resultado_ejercicio when 'UTILIDADES_ACUMULADAS' then g.cuenta_principal_ganancia
                                  when 'PERDIDAS_ACUMULADAS' then g.cuenta_principal_perdida when 'DIF_CAMBIARIO_INGRESO' then g.cuenta_dif_cambiario
                                  when 'DIF_CAMBIARIO_GASTO' then g.cuenta_dif_cambiario end), '')
       from public.parametros_generales g where g.localidad_id = p_loc limit 1));
$function$;

-- Partida generada por un proceso: resuelve las cuentas por código en el catálogo de la empresa, la deja aprobada y,
-- si viene de un proceso automático, registra su control. Uso interno (la llaman las funciones públicas).
create or replace function public.con_generar_partida_int(p_loc bigint, p_anio integer, p_mes integer, p_tipo text, p_descripcion text, p_lineas jsonb,
  p_origen text, p_ref bigint, p_monto numeric, p_fecha timestamptz, p_clasificacion text, p_cierre text, p_catalogo bigint)
 returns bigint language plpgsql security definer set search_path to '' as $function$
declare
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_org bigint := (select organizacion_id from public.localidades where id = p_loc);
  v_cat bigint := p_catalogo;
  v_tipo bigint := (select id from public.tipos_partida where siglas = p_tipo limit 1);
  v_mon bigint := (select id from public.monedas where iso = 'GTQ' order by id limit 1);
  v_id bigint; v_cta bigint; e jsonb; v_n integer := 0; v_d numeric := 0; v_h numeric := 0; v_debe numeric; v_haber numeric;
begin
  if v_org is null then raise exception 'La localidad no existe.'; end if;
  if v_tipo is null then raise exception 'No existe el tipo de partida %.', p_tipo; end if;
  if v_mon is null then v_mon := (select moneda_id from public.partidas where localidad_id = p_loc order by id desc limit 1); end if;
  if v_cat is null then
    select catalogo_id into v_cat from public.partidas where localidad_id = p_loc and estado = 'VIGENTE' and anio = p_anio order by id desc limit 1;
  end if;
  if v_cat is null then
    select k.id into v_cat from public.catalogos_cuentas k where k.localidad_id = p_loc and k.activo order by k.version desc limit 1;
  end if;
  if v_cat is null then raise exception 'La empresa no tiene catálogo de cuentas.'; end if;
  for e in select * from jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) loop
    v_debe := round(coalesce((e->>'debe')::numeric, 0), 2); v_haber := round(coalesce((e->>'haber')::numeric, 0), 2);
    if v_debe = 0 and v_haber = 0 then continue; end if;
    v_d := v_d + v_debe; v_h := v_h + v_haber; v_n := v_n + 1;
    if not exists (select 1 from public.cuentas c where c.catalogo_id = v_cat and c.codigo = trim(e->>'cuenta')) then
      raise exception 'La cuenta % no existe en el catálogo de la empresa (versión que usan las partidas de %).', e->>'cuenta', p_anio;
    end if;
  end loop;
  if v_n < 2 then raise exception 'La partida necesita al menos dos líneas con valor.'; end if;
  if abs(v_d - v_h) >= 0.005 then raise exception 'La partida no cuadra: debe Q% y haber Q%.', v_d, v_h; end if;
  if p_origen is not null and exists (select 1 from public.partidas_generadas g join public.partidas p on p.id = g.partida_id and p.estado = 'VIGENTE'
                                      where g.localidad_id = p_loc and g.origen = p_origen and g.referencia_id = coalesce(p_ref, 0) and g.anio = p_anio and g.mes = p_mes) then
    raise exception 'Ya se generó esa partida en %/%: anúlala primero si necesitas generarla de nuevo.', p_mes, p_anio;
  end if;
  perform set_config('fin.partida', 'si', true);
  perform set_config('fin.fecha_partida', coalesce(p_fecha::text, ''), true);
  insert into public.partidas (organizacion_id, localidad_id, catalogo_id, anio, mes, tipo_partida_id, descripcion, moneda_id, tipo_cambio, origen, clasificacion, justificacion)
  values (v_org, p_loc, v_cat, p_anio, p_mes, v_tipo, p_descripcion, v_mon, 1, 'AUTOMÁTICA', coalesce(p_clasificacion, 'PARTIDA DEL MES'), 'Generada por el proceso de ' || coalesce(lower(p_origen), lower(p_tipo)))
  returning id into v_id;
  perform set_config('fin.fecha_partida', '', true);
  v_n := 0;
  for e in select * from jsonb_array_elements(p_lineas) loop
    v_debe := round(coalesce((e->>'debe')::numeric, 0), 2); v_haber := round(coalesce((e->>'haber')::numeric, 0), 2);
    if v_debe = 0 and v_haber = 0 then continue; end if;
    v_n := v_n + 1;
    select c.id into v_cta from public.cuentas c where c.catalogo_id = v_cat and c.codigo = trim(e->>'cuenta');
    insert into public.partida_lineas (partida_id, linea, cuenta_id, centro_id, concepto, debe, haber)
    values (v_id, v_n, v_cta, nullif(e->>'centro_id', '')::bigint, left(coalesce(nullif(e->>'concepto', ''), p_descripcion), 250), v_debe, v_haber);
  end loop;
  perform set_config('fin.partida', 'si', true);
  update public.partidas set aprobada = true, aprobada_por = v_quien, aprobada_en = now(), cierre_ejercicio = p_cierre where id = v_id;
  perform set_config('fin.partida', '', true);
  if p_origen is not null then
    insert into public.partidas_generadas (localidad_id, origen, referencia_id, anio, mes, partida_id, monto, usuario)
    values (p_loc, p_origen, coalesce(p_ref, 0), p_anio, p_mes, v_id, coalesce(p_monto, v_d), v_quien);
  end if;
  return v_id;
end;
$function$;

-- Partidas de los procesos mensuales (recurrentes, amortizaciones, diferencial cambiario y reversiones).
create or replace function public.con_generar_partida(p_loc bigint, p_anio integer, p_mes integer, p_tipo text, p_descripcion text, p_lineas jsonb,
  p_origen text default null, p_ref bigint default null, p_monto numeric default null)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; p public.partidas;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede generar partidas automáticas.'; end if;
  if p_origen is not null and p_origen not in ('RECURRENTE', 'DIFERIDO', 'DIFERENCIAL', 'REVERSIÓN') then raise exception 'Origen no válido.'; end if;
  if p_tipo in ('PCR', 'PCE', 'PA') then raise exception 'Las partidas de cierre y apertura las genera el cierre anual.'; end if;
  v_id := public.con_generar_partida_int(p_loc, p_anio, p_mes, p_tipo, p_descripcion, p_lineas, p_origen, p_ref, p_monto, null, 'PARTIDA DEL MES', null, null);
  select * into p from public.partidas where id = v_id;
  return jsonb_build_object('id', v_id, 'mes', p.mes, 'numero', p.numero, 'total', p.total_debe);
end;
$function$;

-- Mayorización: recalcula los totales de las partidas del año (meses abiertos) desde sus líneas.
create or replace function public.con_mayorizar(p_loc bigint, p_anio integer)
 returns integer language plpgsql security definer set search_path to '' as $function$
declare v_n integer;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede mayorizar.'; end if;
  perform set_config('fin.partida', 'si', true);
  with t as (
    select p.id, coalesce(sum(l.debe), 0) d, coalesce(sum(l.haber), 0) h from public.partidas p left join public.partida_lineas l on l.partida_id = p.id
    where p.localidad_id = p_loc and p.anio = p_anio and not public.periodo_cerrado(p.localidad_id, p.anio, p.mes) group by p.id
  )
  update public.partidas p set total_debe = t.d, total_haber = t.h from t where p.id = t.id and (p.total_debe <> t.d or p.total_haber <> t.h);
  get diagnostics v_n = row_count;
  perform set_config('fin.partida', '', true);
  return v_n;
end;
$function$;

-- Cierre anual del ejercicio y su reapertura.
-- p_opciones: {"reserva": true|false, "pce": true|false}
create or replace function public.con_cierre_anual(p_loc bigint, p_anio integer, p_accion text, p_opciones jsonb default '{}'::jsonb, p_motivo text default null)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_org bigint := (select organizacion_id from public.localidades where id = p_loc);
  ej public.ejercicios_contables;
  v_cat bigint; v_res text; v_util text; v_perd text; v_resv text;
  v_meses text; v_pend integer; v_desc integer; v_lineas jsonb; v_neto numeric; v_eco numeric; v_r numeric; v_reserva numeric := 0;
  v_pcr bigint; v_dist bigint; v_pce bigint; v_pa bigint; v_id bigint; v_c bigint;
  v_fin timestamptz := make_timestamptz(p_anio, 12, 31, 12, 0, 0, 'America/Guatemala');
  v_ini timestamptz := make_timestamptz(p_anio + 1, 1, 1, 12, 0, 0, 'America/Guatemala');
  v_nombres constant text[] := array['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
begin
  if v_org is null then raise exception 'La localidad no existe.'; end if;
  perform pg_advisory_xact_lock(4806, p_loc::integer);
  select * into ej from public.ejercicios_contables where localidad_id = p_loc and anio = p_anio for update;

  if p_accion = 'CERRAR' then
    if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede cerrar el ejercicio.'; end if;
    if ej.estado = 'CERRADO' then raise exception 'El ejercicio % ya está cerrado.', p_anio; end if;
    select string_agg(v_nombres[m.mes], ', ' order by m.mes) into v_meses from (select distinct mes from public.partidas where localidad_id = p_loc and anio = p_anio and estado = 'VIGENTE' and mes < 12) m
      where not public.periodo_cerrado(p_loc, p_anio, m.mes);
    if v_meses is not null then raise exception 'Primero cierra los meses de %: %.', p_anio, v_meses; end if;
    select count(*) filter (where not aprobada), count(*) filter (where total_debe <> total_haber) into v_pend, v_desc
      from public.partidas where localidad_id = p_loc and anio = p_anio and mes = 12 and estado = 'VIGENTE';
    if v_desc > 0 then raise exception 'Hay % partida(s) descuadrada(s) en diciembre.', v_desc; end if;
    if v_pend > 0 then raise exception 'Hay % partida(s) sin aprobar en diciembre.', v_pend; end if;
    if public.periodo_cerrado(p_loc, p_anio, 12) then raise exception 'Diciembre de % está cerrado: reábrelo para registrar las partidas de cierre (el proceso lo vuelve a cerrar).', p_anio; end if;
    v_res := public.con_cuenta_clave(p_loc, 'RESULTADO_EJERCICIO');
    v_util := public.con_cuenta_clave(p_loc, 'UTILIDADES_ACUMULADAS');
    v_perd := coalesce(public.con_cuenta_clave(p_loc, 'PERDIDAS_ACUMULADAS'), v_util);
    v_resv := public.con_cuenta_clave(p_loc, 'RESERVA_LEGAL');
    if v_res is null then raise exception 'Configura la cuenta del resultado del ejercicio (Catálogos › Cuentas de cierre).'; end if;
    if v_util is null then raise exception 'Configura la cuenta de utilidades acumuladas (Catálogos › Cuentas de cierre).'; end if;
    -- Catálogo con que se registró la mayor parte del año (las cuentas se buscan por código en él).
    select p.catalogo_id into v_cat from public.partidas p join public.partida_lineas l on l.partida_id = p.id
     where p.localidad_id = p_loc and p.anio = p_anio and p.estado = 'VIGENTE' group by p.catalogo_id order by count(*) desc, p.catalogo_id desc limit 1;

    -- Resultado económico del año (sin partidas de cierre) y saldos de resultados que quedan por cerrar.
    select coalesce(sum(l.haber - l.debe), 0) into v_eco
      from public.partida_lineas l join public.partidas p on p.id = l.partida_id join public.cuentas c on c.id = l.cuenta_id join public.tipos_cuenta t on t.id = c.tipo_cuenta_id
      join public.tipos_partida tp on tp.id = p.tipo_partida_id
     where p.localidad_id = p_loc and p.anio = p_anio and p.estado = 'VIGENTE' and t.reporte_financiero = 'E' and tp.siglas <> 'PCR' and p.cierre_ejercicio is null;
    select coalesce(jsonb_agg(jsonb_build_object('cuenta', x.codigo, 'concepto', 'Cierre de ' || x.nombre, 'debe', greatest(-x.b, 0), 'haber', greatest(x.b, 0)) order by x.codigo), '[]'::jsonb), coalesce(sum(x.b), 0)
      into v_lineas, v_neto
      from (select c.codigo, min(c.nombre) nombre, round(sum(l.debe - l.haber), 2) b
              from public.partida_lineas l join public.partidas p on p.id = l.partida_id join public.cuentas c on c.id = l.cuenta_id join public.tipos_cuenta t on t.id = c.tipo_cuenta_id
             where p.localidad_id = p_loc and p.anio = p_anio and p.estado = 'VIGENTE' and t.reporte_financiero = 'E' and coalesce(p.cierre_ejercicio, '') not in ('PCE', 'PA')
             group by c.codigo having abs(round(sum(l.debe - l.haber), 2)) >= 0.01) x;
    if jsonb_array_length(v_lineas) > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object('cuenta', v_res, 'concepto', 'Resultado del ejercicio ' || p_anio, 'debe', greatest(v_neto, 0), 'haber', greatest(-v_neto, 0)));
      v_pcr := public.con_generar_partida_int(p_loc, p_anio, 12, 'PCR', 'Partida de cierre de cuentas de resultados del ejercicio ' || p_anio, v_lineas, null, null, null, v_fin, 'PARTIDA DE CIERRE', 'PCR', v_cat);
    end if;

    -- Reserva legal (5 % de la utilidad del año) y traslado del resultado a utilidades o pérdidas acumuladas.
    select coalesce(round(sum(l.haber - l.debe), 2), 0) into v_r
      from public.partida_lineas l join public.partidas p on p.id = l.partida_id join public.cuentas c on c.id = l.cuenta_id
     where p.localidad_id = p_loc and p.anio <= p_anio and p.estado = 'VIGENTE' and c.codigo = v_res and coalesce(p.cierre_ejercicio, '') not in ('PCE', 'PA');
    if v_r >= 0.01 then
      if coalesce((p_opciones->>'reserva')::boolean, true) then
        if v_resv is null then raise exception 'Configura la cuenta de reserva legal (Catálogos › Cuentas de cierre) o desmarca la reserva legal.'; end if;
        v_reserva := round(least(v_r, greatest(v_eco, 0)) * 0.05, 2);
      end if;
      v_lineas := jsonb_build_array(jsonb_build_object('cuenta', v_res, 'concepto', 'Traslado del resultado del ejercicio ' || p_anio, 'debe', v_r, 'haber', 0),
                                    jsonb_build_object('cuenta', v_resv, 'concepto', 'Reserva legal 5 % (Código de Comercio, art. 36)', 'debe', 0, 'haber', v_reserva),
                                    jsonb_build_object('cuenta', v_util, 'concepto', 'Utilidad del ejercicio ' || p_anio || ' a utilidades acumuladas', 'debe', 0, 'haber', v_r - v_reserva));
      v_dist := public.con_generar_partida_int(p_loc, p_anio, 12, 'PRC', 'Reserva legal y traslado del resultado del ejercicio ' || p_anio, v_lineas, null, null, null, v_fin, 'PARTIDA DE CIERRE', 'DIST', v_cat);
    elsif v_r <= -0.01 then
      v_lineas := jsonb_build_array(jsonb_build_object('cuenta', v_perd, 'concepto', 'Pérdida del ejercicio ' || p_anio || ' a pérdidas acumuladas', 'debe', -v_r, 'haber', 0),
                                    jsonb_build_object('cuenta', v_res, 'concepto', 'Traslado del resultado del ejercicio ' || p_anio, 'debe', 0, 'haber', -v_r));
      v_dist := public.con_generar_partida_int(p_loc, p_anio, 12, 'PRC', 'Traslado de la pérdida del ejercicio ' || p_anio, v_lineas, null, null, null, v_fin, 'PARTIDA DE CIERRE', 'DIST', v_cat);
    end if;

    -- Cierre del ejercicio y apertura del siguiente (partidas de registro: no alteran los saldos acumulados).
    -- Una por versión de catálogo: cada partida cuadra dentro de su catálogo, así que sus saldos también.
    if coalesce((p_opciones->>'pce')::boolean, true) then
      for v_c in select distinct p.catalogo_id from public.partidas p where p.localidad_id = p_loc and p.anio <= p_anio and p.estado = 'VIGENTE' order by 1 loop
        select coalesce(jsonb_agg(jsonb_build_object('cuenta', x.codigo, 'concepto', 'Cierre de ' || x.nombre, 'debe', greatest(-x.b, 0), 'haber', greatest(x.b, 0)) order by x.codigo), '[]'::jsonb)
          into v_lineas
          from (select c.codigo, min(c.nombre) nombre, round(sum(l.debe - l.haber), 2) b
                  from public.partida_lineas l join public.partidas p on p.id = l.partida_id join public.cuentas c on c.id = l.cuenta_id
                 where p.localidad_id = p_loc and p.anio <= p_anio and p.estado = 'VIGENTE' and p.catalogo_id = v_c and coalesce(p.cierre_ejercicio, '') not in ('PCE', 'PA')
                 group by c.codigo having abs(round(sum(l.debe - l.haber), 2)) >= 0.01) x;
        if jsonb_array_length(v_lineas) < 2 then continue; end if;
        v_id := public.con_generar_partida_int(p_loc, p_anio, 12, 'PCE', 'Partida de cierre del ejercicio ' || p_anio, v_lineas, null, null, null, v_fin, 'PARTIDA DE CIERRE', 'PCE', v_c);
        v_pce := coalesce(v_pce, v_id);
        select coalesce(jsonb_agg(jsonb_build_object('cuenta', c.codigo, 'concepto', 'Apertura ' || (p_anio + 1) || ': ' || c.nombre, 'debe', l.haber, 'haber', l.debe) order by l.linea), '[]'::jsonb)
          into v_lineas from public.partida_lineas l join public.cuentas c on c.id = l.cuenta_id where l.partida_id = v_id;
        v_id := public.con_generar_partida_int(p_loc, p_anio + 1, 1, 'PA', 'Partida de apertura del ejercicio ' || (p_anio + 1), v_lineas, null, null, null, v_ini, 'PARTIDA DE APERTURA', 'PA', v_c);
        v_pa := coalesce(v_pa, v_id);
      end loop;
    end if;

    insert into public.cierres_mes (organizacion_id, localidad_id, anio, mes, cerrado, cerrado_por, cerrado_en)
    values (v_org, p_loc, p_anio, 12, true, v_quien, now())
    on conflict (localidad_id, anio, mes) do update set cerrado = true, cerrado_por = v_quien, cerrado_en = now();
    insert into public.ejercicios_contables (organizacion_id, localidad_id, anio, estado, resultado, reserva_legal, trasladado, partida_pcr_id, partida_dist_id, partida_pce_id, partida_pa_id, cerrado_por, cerrado_en)
    values (v_org, p_loc, p_anio, 'CERRADO', v_eco, v_reserva, v_r - v_reserva, v_pcr, v_dist, v_pce, v_pa, v_quien, now())
    on conflict (localidad_id, anio) do update set estado = 'CERRADO', resultado = excluded.resultado, reserva_legal = excluded.reserva_legal, trasladado = excluded.trasladado,
      partida_pcr_id = excluded.partida_pcr_id, partida_dist_id = excluded.partida_dist_id, partida_pce_id = excluded.partida_pce_id, partida_pa_id = excluded.partida_pa_id,
      cerrado_por = v_quien, cerrado_en = now();
    return jsonb_build_object('anio', p_anio, 'resultado', v_eco, 'reserva', v_reserva, 'trasladado', v_r - v_reserva, 'pcr', v_pcr, 'dist', v_dist, 'pce', v_pce, 'pa', v_pa);

  elsif p_accion = 'REABRIR' then
    if not public.es_superadmin() then raise exception 'Solo el Super Administrador puede reabrir un ejercicio cerrado.'; end if;
    if ej.id is null or ej.estado <> 'CERRADO' then raise exception 'El ejercicio % no está cerrado.', p_anio; end if;
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la reapertura.'; end if;
    if exists (select 1 from public.partidas where localidad_id = p_loc and anio = p_anio + 1 and cierre_ejercicio = 'PA' and estado = 'VIGENTE') and public.periodo_cerrado(p_loc, p_anio + 1, 1) then
      raise exception 'Enero de % está cerrado y tiene la partida de apertura: reábrelo primero.', p_anio + 1;
    end if;
    update public.ejercicios_contables set estado = 'ABIERTO', reabierto_por = v_quien, reabierto_en = now(), motivo_reapertura = trim(p_motivo),
      observaciones = concat_ws(' · ', observaciones, 'Reabierto ' || to_char(now(), 'DD/MM/YYYY') || ': ' || trim(p_motivo)),
      partida_pcr_id = null, partida_dist_id = null, partida_pce_id = null, partida_pa_id = null
     where id = ej.id;
    update public.cierres_mes set cerrado = false, reabierto_por = v_quien, reabierto_en = now(), motivo_reapertura = 'Reapertura del ejercicio: ' || trim(p_motivo)
     where localidad_id = p_loc and anio = p_anio and mes = 12;
    perform set_config('fin.partida', 'si', true);
    update public.partidas set estado = 'ANULADA', aprobada = false, anulada_por = v_quien, anulada_en = now(), motivo_anulacion = 'Reapertura del ejercicio ' || p_anio || ': ' || trim(p_motivo)
     where localidad_id = p_loc and estado = 'VIGENTE'
       and ((anio = p_anio and cierre_ejercicio in ('PCR', 'DIST', 'PCE')) or (anio = p_anio + 1 and cierre_ejercicio = 'PA'));
    perform set_config('fin.partida', '', true);
    return jsonb_build_object('anio', p_anio, 'accion', 'REABRIR');
  else
    raise exception 'Acción no válida.';
  end if;
end;
$function$;

-- Fecha del período en las partidas de los procesos y marca del cierre anual protegida.
CREATE OR REPLACE FUNCTION public.preparar_partida()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_quien text := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
  v_proceso boolean := current_setting('fin.partida', true) = 'si';
begin
  if tg_op = 'INSERT' then
    if new.catalogo_id is null then
      select k.id into new.catalogo_id from public.catalogos_cuentas k
      where k.localidad_id = new.localidad_id and k.activo order by k.version desc limit 1;
      if new.catalogo_id is null then
        raise exception 'La empresa no tiene un catálogo de cuentas activo.';
      end if;
    elsif not exists (select 1 from public.catalogos_cuentas k where k.id = new.catalogo_id and k.localidad_id = new.localidad_id) then
      raise exception 'La versión del catálogo de cuentas no es de la empresa de la partida.';
    end if;
    perform pg_advisory_xact_lock(4804, new.localidad_id::integer);
    new.numero := coalesce((select max(numero) from public.partidas where localidad_id = new.localidad_id and anio = new.anio and mes = new.mes), 0) + 1;
    new.numero_anual := coalesce((select max(numero_anual) from public.partidas where localidad_id = new.localidad_id and anio = new.anio), 0) + 1;
    -- Las partidas de los procesos (cierre anual) llevan la fecha del período.
    new.fecha := coalesce(nullif(current_setting('fin.fecha_partida', true), '')::timestamptz, now());
    new.cierre_ejercicio := null;
    new.perfil_id := (select auth.uid());
    new.usuario := v_quien;
    new.estado := 'VIGENTE';
    new.aprobada := false; new.aprobada_por := null; new.aprobada_en := null;
    new.definitiva := false; new.definitiva_por := null; new.definitiva_en := null;
    new.anulada_por := null; new.anulada_en := null; new.motivo_anulacion := null;
    new.total_debe := 0; new.total_haber := 0;
  else
    -- Lo que identifica a la partida no cambia.
    new.organizacion_id := old.organizacion_id;
    new.localidad_id := old.localidad_id;
    new.catalogo_id := old.catalogo_id;
    new.anio := old.anio;
    new.mes := old.mes;
    new.numero := old.numero;
    new.numero_anual := old.numero_anual;
    new.fecha := old.fecha;
    new.perfil_id := old.perfil_id;
    new.usuario := old.usuario;
    if not v_proceso then new.cierre_ejercicio := old.cierre_ejercicio; end if;
    if not v_proceso then
      if old.definitiva then raise exception 'La partida %-% es definitiva y ya no se modifica.', old.mes, old.numero; end if;
      if old.estado = 'ANULADA' then raise exception 'La partida %-% está anulada y ya no se modifica.', old.mes, old.numero; end if;
      -- Aprobación, definitiva, anulación y totales solo los cambian sus procesos.
      new.estado := old.estado;
      new.definitiva := old.definitiva; new.definitiva_por := old.definitiva_por; new.definitiva_en := old.definitiva_en;
      new.anulada_por := old.anulada_por; new.anulada_en := old.anulada_en; new.motivo_anulacion := old.motivo_anulacion;
      new.total_debe := old.total_debe; new.total_haber := old.total_haber;
      -- Modificada, pierde la aprobación.
      new.aprobada := false; new.aprobada_por := null; new.aprobada_en := null;
    end if;
  end if;
  new.descripcion := trim(new.descripcion);
  new.justificacion := nullif(trim(new.justificacion), '');
  return new;
end;
$function$;

-- Un mes de un ejercicio cerrado no se reabre suelto.
CREATE OR REPLACE FUNCTION public.cerrar_mes(p_loc bigint, p_anio integer, p_mes integer, p_accion text, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_org bigint := (select organizacion_id from public.localidades where id = p_loc);
  v_pendientes integer;
  v_descuadradas integer;
begin
  if v_org is null then raise exception 'La localidad no existe.'; end if;
  if p_mes not between 1 and 12 then raise exception 'Mes no válido.'; end if;
  perform pg_advisory_xact_lock(4805, p_loc::integer);
  if p_accion = 'CERRAR' then
    if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede cerrar el mes.'; end if;
    if public.periodo_cerrado(p_loc, p_anio, p_mes) then raise exception 'El mes ya está cerrado.'; end if;
    select count(*) filter (where not aprobada), count(*) filter (where total_debe <> total_haber)
      into v_pendientes, v_descuadradas
      from public.partidas where localidad_id = p_loc and anio = p_anio and mes = p_mes and estado = 'VIGENTE';
    if v_descuadradas > 0 then raise exception 'Hay % partida(s) descuadrada(s) en el mes: corrígelas antes de cerrarlo.', v_descuadradas; end if;
    if v_pendientes > 0 then raise exception 'Hay % partida(s) sin aprobar en el mes: apruébalas o anúlalas antes de cerrarlo.', v_pendientes; end if;
    insert into public.cierres_mes (organizacion_id, localidad_id, anio, mes, cerrado, cerrado_por, cerrado_en)
    values (v_org, p_loc, p_anio, p_mes, true, v_quien, now())
    on conflict (localidad_id, anio, mes) do update set cerrado = true, cerrado_por = v_quien, cerrado_en = now();
  elsif p_accion = 'REABRIR' then
    if not public.es_superadmin() then raise exception 'Solo el Super Administrador puede reabrir un mes cerrado.'; end if;
    if exists (select 1 from public.ejercicios_contables e where e.localidad_id = p_loc and e.anio = p_anio and e.estado = 'CERRADO') then
      raise exception 'El ejercicio % está cerrado: reábrelo en Procesos › Cierre del ejercicio.', p_anio;
    end if;
    if not public.periodo_cerrado(p_loc, p_anio, p_mes) then raise exception 'El mes no está cerrado.'; end if;
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la reapertura.'; end if;
    update public.cierres_mes set cerrado = false, reabierto_por = v_quien, reabierto_en = now(), motivo_reapertura = trim(p_motivo)
    where localidad_id = p_loc and anio = p_anio and mes = p_mes;
  else
    raise exception 'Acción no válida.';
  end if;
  return jsonb_build_object('anio', p_anio, 'mes', p_mes, 'accion', p_accion);
end;
$function$;

-- La ejecución del presupuesto no cuenta las partidas de cierre.
CREATE OR REPLACE FUNCTION public.calcular_ejecucion_presupuesto(p_id bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p public.presupuestos;
  l record;
  v_n integer := 0;
  v record;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para calcular la ejecución.'; end if;
  select * into p from public.presupuestos where id = p_id;
  if p.id is null then raise exception 'El presupuesto no existe.'; end if;
  if p.estado in ('FORMULACIÓN', 'EN REVISIÓN', 'ANULADO') then raise exception 'La ejecución se calcula a un presupuesto aprobado.'; end if;
  perform set_config('fin.presupuesto_mod', 'si', true);
  for l in select pl.id, pl.rubro_id, r.naturaleza from public.presupuesto_lineas pl join public.rubros_presupuesto r on r.id = pl.rubro_id where pl.presupuesto_id = p.id loop
    select
      sum(x.v) filter (where x.mes = 1) e1, sum(x.v) filter (where x.mes = 2) e2, sum(x.v) filter (where x.mes = 3) e3, sum(x.v) filter (where x.mes = 4) e4,
      sum(x.v) filter (where x.mes = 5) e5, sum(x.v) filter (where x.mes = 6) e6, sum(x.v) filter (where x.mes = 7) e7, sum(x.v) filter (where x.mes = 8) e8,
      sum(x.v) filter (where x.mes = 9) e9, sum(x.v) filter (where x.mes = 10) e10, sum(x.v) filter (where x.mes = 11) e11, sum(x.v) filter (where x.mes = 12) e12
    into v
    from (
      select pa.mes, case when l.naturaleza = 'INGRESO' then li.haber - li.debe else li.debe - li.haber end as v
      from public.partida_lineas li
      join public.partidas pa on pa.id = li.partida_id
      join public.cuentas c on c.id = li.cuenta_id
      join public.tipos_partida tp on tp.id = pa.tipo_partida_id
      where pa.localidad_id = p.localidad_id and pa.estado = 'VIGENTE' and pa.anio = p.anio
        and tp.siglas <> 'PCR' and pa.cierre_ejercicio is null
        and exists (select 1 from public.presupuesto_rubro_cuentas rc where rc.localidad_id = p.localidad_id and rc.rubro_id = l.rubro_id and c.codigo like rc.cuenta_codigo || '%')
    ) x;
    update public.presupuesto_lineas set e1 = coalesce(v.e1, 0), e2 = coalesce(v.e2, 0), e3 = coalesce(v.e3, 0), e4 = coalesce(v.e4, 0), e5 = coalesce(v.e5, 0), e6 = coalesce(v.e6, 0),
      e7 = coalesce(v.e7, 0), e8 = coalesce(v.e8, 0), e9 = coalesce(v.e9, 0), e10 = coalesce(v.e10, 0), e11 = coalesce(v.e11, 0), e12 = coalesce(v.e12, 0) where id = l.id;
    v_n := v_n + 1;
  end loop;
  perform set_config('fin.presupuesto', 'si', true);
  update public.presupuestos set ejecucion_calculada_en = now(), estado = case when estado = 'APROBADO' then 'EN EJECUCIÓN' else estado end where id = p.id;
  perform set_config('fin.presupuesto', '', true);
  perform set_config('fin.presupuesto_mod', '', true);
  return v_n;
end;
$function$;

-- Saldo contable de la cuenta bancaria sin las partidas de registro del cierre anual (PCE y PA).
create or replace function public.saldo_contable_cuenta_bancaria(p_cuenta bigint, p_anio integer, p_mes integer)
 returns numeric language sql stable security definer set search_path to '' as $function$
  select coalesce(sum(l.debe - l.haber), 0)
  from public.cuentas_bancarias cb
  join public.partida_lineas l on l.cuenta_id = cb.cuenta_id
  join public.partidas p on p.id = l.partida_id and p.estado = 'VIGENTE' and coalesce(p.cierre_ejercicio, '') not in ('PCE', 'PA')
  where cb.id = p_cuenta and public.usuario_activo() and (p.anio < p_anio or (p.anio = p_anio and p.mes <= p_mes));
$function$;

-- ============ Auditoría y permisos ============
do $$
declare t text;
begin
  foreach t in array array['ejercicios_contables', 'cuentas_integracion', 'libros_autorizados', 'partidas_recurrentes', 'diferidos', 'cuentas_intercompania'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.auditar()', t || '_auditar', t);
  end loop;
  foreach t in array array['cuentas_integracion', 'libros_autorizados', 'partidas_recurrentes', 'partida_recurrente_lineas', 'diferidos', 'cuentas_intercompania'] loop
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
  -- El ejercicio y el control de partidas generadas solo los escriben sus procesos.
  foreach t in array array['ejercicios_contables', 'partidas_generadas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
  -- Abrir un ejercicio nuevo (sin cerrarlo) desde Catálogos › Ejercicios contables.
  drop policy if exists "ejercicios_contables: crear" on public.ejercicios_contables;
  create policy "ejercicios_contables: crear" on public.ejercicios_contables for insert to authenticated with check (public.puede_editar_catalogos() and estado = 'ABIERTO' and partida_pcr_id is null);
  grant insert on public.ejercicios_contables to authenticated;
end;
$$;
revoke execute on function public.con_generar_partida_int(bigint, integer, integer, text, text, jsonb, text, bigint, numeric, timestamptz, text, text, bigint) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['public.con_generar_partida(bigint, integer, integer, text, text, jsonb, text, bigint, numeric)', 'public.con_mayorizar(bigint, integer)',
                           'public.con_cierre_anual(bigint, integer, text, jsonb, text)', 'public.con_cuenta_clave(bigint, text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- ============ Menú de Contabilidad ============
do $$
declare v_mod bigint; v_id bigint; v_ref bigint; v_rep bigint; v_orden integer; o record;
begin
  select id into v_mod from public.modulos_sistema where siglas = 'CON' limit 1;
  if v_mod is null then return; end if;
  select id into v_ref from public.opciones_sistema where clave = 'cierre-de-mes' order by id limit 1;
  select id into v_rep from public.opciones_sistema where clave = 'libro-diario' order by id limit 1;
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  for o in select * from (values
    (1, 'catalogos', 'Cierre contable', 'con-ejercicios', 'Ejercicios y períodos contables'), (2, 'catalogos', 'Cierre contable', 'con-cuentas-integracion', 'Cuentas de integración'),
    (3, 'catalogos', 'Cierre contable', 'con-cuentas-cierre', 'Cuentas de cierre'), (4, 'catalogos', 'Cierre contable', 'con-libros-sat', 'Libros autorizados SAT'),
    (5, 'registros', 'Automáticas', 'con-recurrentes', 'Partidas recurrentes'), (6, 'registros', 'Automáticas', 'con-diferidos', 'Provisiones y diferidos'),
    (7, 'registros', 'Automáticas', 'con-intercompania', 'Cuentas intercompañía'),
    (8, 'procesos', 'Cierre mensual', 'con-revision-cierre', 'Revisión previa al cierre'), (9, 'procesos', 'Cierre mensual', 'con-mayorizacion', 'Mayorización y validación'),
    (10, 'procesos', 'Cierre mensual', 'con-automaticas', 'Recurrentes y amortizaciones'), (11, 'procesos', 'Cierre mensual', 'con-diferencial', 'Diferencial cambiario'),
    (12, 'procesos', 'Cierre mensual', 'con-reversion', 'Reversión de provisiones'), (13, 'procesos', 'Cierre anual', 'con-cierre-anual', 'Cierre del ejercicio'),
    (14, 'procesos', 'Integraciones contables', 'con-integraciones', 'Integraciones contables'), (15, 'procesos', 'Integraciones contables', 'con-analisis-cuenta', 'Análisis de cuenta'),
    (16, 'reportes', 'Cierre y análisis', 'rep-integraciones', 'Integraciones contables'), (17, 'reportes', 'Estados financieros', 'estado-cambios-patrimonio', 'Estado de cambios en el patrimonio'),
    (18, 'reportes', 'Estados financieros', 'estados-comparativos', 'Estados financieros comparativos'), (19, 'reportes', 'Estados financieros', 'resultados-centro-costo', 'Resultados por centro de costo'),
    (20, 'reportes', 'Libros contables', 'libro-inventarios-balances', 'Libro de inventarios y balances'), (21, 'reportes', 'Cierre y análisis', 'bitacora-cierres', 'Bitácora de cierres')) as x(n, grupo, subgrupo, clave, nombre) loop
    select id into v_id from public.opciones_sistema where modulo_id = v_mod and clave = o.clave;
    if v_id is null then insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values (v_mod, o.grupo, o.subgrupo, o.clave, o.nombre, v_orden + o.n) returning id into v_id;
    else update public.opciones_sistema set grupo = o.grupo, subgrupo = o.subgrupo, nombre = o.nombre, activo = true where id = v_id; end if;
    if coalesce(case when o.grupo = 'reportes' then v_rep else v_ref end, v_ref) is not null then
      insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
      select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = coalesce(case when o.grupo = 'reportes' then v_rep else v_ref end, v_ref) on conflict do nothing;
    end if;
  end loop;
end;
$$;
notify pgrst, 'reload schema';
select 'Contabilidad: ejercicios, cuentas de integración y de cierre, libros SAT, recurrentes, diferidos, intercompañía, partidas automáticas, mayorización y cierre anual instalados.' as resultado;
