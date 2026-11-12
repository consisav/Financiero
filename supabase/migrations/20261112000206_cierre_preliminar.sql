-- Contabilidad · Procesos · Generación de Cierres:
--   Transacciones por módulo: cada transacción contable (plantilla de partida) queda asociada a un módulo
--   (Ventas, Compras, Inventarios, Caja y bancos, Nóminas, Contabilidad, Activos fijos, Importaciones).
--   Se asigna sola por su descripción (y, si no la reconoce, por los documentos que la usan); se cambia a mano.
--   La columna «modulo» del sistema anterior no se toca: el módulo del cierre va en «modulo_cierre».
--   Cierre preliminar: por mes y transacción integra en una póliza los documentos del mes que aún no tienen
--   partida propia (compras, documentos de bancos y facturas de venta) sumando su detalle contable por cuenta y
--   centro de costo; a las facturas sin detalle contable les aplica la plantilla de su transacción.
--   Se reversa anulando la póliza: los documentos vuelven a quedar pendientes. Con el mes cerrado no se toca.

-- ============ Transacciones por módulo ============
-- Columnas nuevas: el ALTER TABLE necesita la tabla transacciones_contables sola por un instante. Solo se pide ese bloqueo si falta alguna columna,
--   y si otra consulta la está usando se reintenta cada pocos segundos (unos 25 segundos, para no pasar el límite de conexión del SQL Editor) en vez de cancelar el script.
set lock_timeout = '2s';
do $columnas$
declare v_i int;
begin
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'transacciones_contables'
      and column_name in ('modulo_cierre')) = 1 then return; end if;
  for v_i in 1..8 loop
    begin
      alter table public.transacciones_contables add column if not exists modulo_cierre text;
      return;
    exception when lock_not_available then
      raise notice 'La tabla transacciones_contables está ocupada por otra consulta; reintento %/8.', v_i;
      perform pg_sleep(1);
    end;
  end loop;
  raise exception 'La tabla transacciones_contables sigue ocupada por otra consulta. Espere a que termine (o revise "Ver consultas en ejecución") y vuelva a correr este script.';
end;
$columnas$;
reset lock_timeout;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transacciones_contables_modulo_cierre_check') then
    alter table public.transacciones_contables add constraint transacciones_contables_modulo_cierre_check
      check (modulo_cierre in ('VENTAS', 'COMPRAS', 'INVENTARIOS', 'CAJA Y BANCOS', 'NÓMINAS', 'CONTABILIDAD', 'ACTIVOS FIJOS', 'IMPORTACIONES'));
  end if;
end $$;

-- Módulo que sugiere la descripción (el orden de las reglas importa).
create or replace function public.con_modulo_sugerido(p_descripcion text)
 returns text language sql immutable set search_path to '' as $function$
  select case
    when d ~ '\m(NOMINA|PLANILLA|IGSS|RENTA DE TRABAJO|QUINCENAL|EMPLEADOS?|AGUINALDO|BONO 14|INDEMNIZACION|SALARIOS?|SUELDOS?)\M' then 'NÓMINAS'
    when d ~ '\m(VENTAS?|DEVOLUCIONES Y REBAJAS|EXPORTACION|FACTURACION|FACTURA EMITIDA)\M' then 'VENTAS'
    when d ~ '\m(COMPRAS?|REGISTRO FACTURAS?|IMPORTACION|IMPORTACIONES|PEQUENOS? C)' then 'COMPRAS'
    when d ~ '\m(INVENTARIOS?|INCINERACION|TRITURACION|MUESTRAS?|BODEGAS?)\M' then 'INVENTARIOS'
    when d ~ '\m(DEPRECIACION|DEPRECIACIONES|ACTIVOS? FIJOS?)\M' then 'ACTIVOS FIJOS'
    when d ~ '(\m(CHEQUES?|DEPOSITOS?|TRANSFERENCIAS?|TRASFERENCIAS?|TRASNFERENCIAS?|TRASLADOS?|RECIBOS?|CAJA|CXC|CLIENTES?|PACIENTES|COBRO|COBROS|BANRURAL|INTERBANCO|BAC|GYT|BANCOS?|BANCARIOS?|BANCARIAS?|POS|VISANET|TARJETAS?|PAGO DE SERVICIOS)\M|\mNOTAS? (DE )?(CREDITO|DEBITO)|\mN\.[CD]\.|^(NC|ND)\M|US\$)' then 'CAJA Y BANCOS'
    when d ~ '\m(RETENCION|RETENCIONES|PROVEEDORES?|CUENTAS? POR PAGAR|HONORARIOS|GASTOS?|PAPELERIA|SEGUROS|SEGURIDAD|EEGSA|EGSSA|EMPAGUA|TELEFONO|GASOLINA|ARRENDAMIENTO)\M' then 'COMPRAS'
    when d ~ '\m(POLIZAS?|SALDOS|APERTURA|CIERRE|DESCUENTOS FINANCIEROS|PROVISION|PROVISIONES|AJUSTES?|RECLASIFICACION|DIARIO|OPERACIONES|IMPUESTOS?|IVA|ISR|ISO)\M' then 'CONTABILIDAD'
  end
  from (select translate(upper(coalesce(p_descripcion, '')), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') as d) x;
$function$;

-- Si la descripción no lo dice, el módulo de los documentos que usan la transacción.
create or replace function public.con_modulo_por_uso(p_transaccion bigint)
 returns text language sql stable security definer set search_path to '' as $function$
  select case
    when exists (select 1 from public.parametros_compras pc where pc.transaccion_ventas_id = p_transaccion) then 'VENTAS'
    when exists (select 1 from public.compras c where c.transaccion_id = p_transaccion) then 'COMPRAS'
    when exists (select 1 from public.movimientos_bancarios m where m.transaccion_id = p_transaccion) then 'CAJA Y BANCOS'
    when exists (select 1 from public.cajas_chicas c where c.transaccion_id = p_transaccion) then 'CAJA Y BANCOS'
  end;
$function$;

-- Asigna el módulo a las transacciones de una localidad (todas, o solo las que no lo tienen).
create or replace function public.con_asignar_modulos(p_loc bigint, p_solo_vacias boolean default true)
 returns integer language plpgsql security definer set search_path to '' as $function$
declare v_n integer;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede asignar los módulos.'; end if;
  update public.transacciones_contables t
     set modulo_cierre = coalesce(public.con_modulo_sugerido(t.descripcion), public.con_modulo_por_uso(t.id), t.modulo_cierre)
   where t.localidad_id = p_loc and (not p_solo_vacias or t.modulo_cierre is null)
     and coalesce(public.con_modulo_sugerido(t.descripcion), public.con_modulo_por_uso(t.id), t.modulo_cierre) is distinct from t.modulo_cierre;
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

-- Las transacciones nuevas reciben el módulo sugerido.
create or replace function public.transaccion_modulo_inicial() returns trigger
 language plpgsql set search_path to '' as $function$
begin
  if new.modulo_cierre is null then new.modulo_cierre := public.con_modulo_sugerido(new.descripcion); end if;
  return new;
end;
$function$;
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'transacciones_modulo_inicial') then
    create trigger transacciones_modulo_inicial before insert on public.transacciones_contables
      for each row execute function public.transaccion_modulo_inicial();
  end if;
end $$;

-- Asignación inicial de todas las transacciones existentes.
update public.transacciones_contables t
   set modulo_cierre = coalesce(public.con_modulo_sugerido(t.descripcion), public.con_modulo_por_uso(t.id))
 where t.modulo_cierre is null and coalesce(public.con_modulo_sugerido(t.descripcion), public.con_modulo_por_uso(t.id)) is not null;

-- ============ Cierre preliminar ============
create table if not exists public.cierres_preliminares (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id    bigint not null references public.localidades (id),
  anio            integer not null check (anio between 1900 and 2999),
  mes             integer not null check (mes between 1 and 12),
  transaccion_id  bigint not null references public.transacciones_contables (id),
  modulo          text,
  partida_id      bigint references public.partidas (id) on delete set null,
  documentos      integer not null default 0,
  total           numeric(18, 2) not null default 0,
  estado          text not null default 'GENERADO' check (estado in ('GENERADO', 'REVERSADO')),
  generado_por    text,
  generado_en     timestamptz not null default now(),
  reversado_por   text,
  reversado_en    timestamptz
);
create unique index if not exists cierres_preliminares_vigente on public.cierres_preliminares (localidad_id, anio, mes, transaccion_id) where estado = 'GENERADO';
create index if not exists cierres_preliminares_periodo on public.cierres_preliminares (localidad_id, anio, mes);

create table if not exists public.cierre_preliminar_documentos (
  cierre_id    bigint not null references public.cierres_preliminares (id) on delete cascade,
  origen       text not null check (origen in ('COMPRA', 'BANCO', 'VENTA')),
  documento_id bigint not null,
  primary key (cierre_id, origen, documento_id)
);
create index if not exists cierre_preliminar_documentos_doc on public.cierre_preliminar_documentos (origen, documento_id);

alter table public.cierres_preliminares enable row level security;
alter table public.cierre_preliminar_documentos enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'cierres_preliminares' and policyname = 'cierres_preliminares: leer') then
    create policy "cierres_preliminares: leer" on public.cierres_preliminares for select to authenticated using (public.usuario_activo());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'cierre_preliminar_documentos' and policyname = 'cierre_preliminar_documentos: leer') then
    create policy "cierre_preliminar_documentos: leer" on public.cierre_preliminar_documentos for select to authenticated using (public.usuario_activo());
  end if;
end $$;

-- Detalle contable de los documentos del mes pendientes de póliza (sin partida propia ni cierre preliminar vigente).
create or replace function public.con_preliminar_lineas(p_loc bigint, p_anio integer, p_mes integer)
 returns table (origen text, documento_id bigint, transaccion_id bigint, cuenta_id bigint, centro_id bigint, debe numeric, haber numeric, con_detalle boolean)
 language sql stable security definer set search_path to '' as $function$
  with r as (select make_date(p_anio, p_mes, 1) as d1, (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date as d2),
  vtrx as (select pc.transaccion_ventas_id as id from public.parametros_compras pc where pc.localidad_id = p_loc and pc.transaccion_ventas_id is not null limit 1),
  hecho as (select d.origen, d.documento_id from public.cierre_preliminar_documentos d
              join public.cierres_preliminares c on c.id = d.cierre_id and c.estado = 'GENERADO' and c.localidad_id = p_loc),
  comp as (select c.id, c.transaccion_id from public.compras c, r
            where c.localidad_id = p_loc and c.estado = 'ACTIVA' and c.partida_id is null and c.transaccion_id is not null
              and c.fecha_ingreso between r.d1 and r.d2
              and not exists (select 1 from hecho h where h.origen = 'COMPRA' and h.documento_id = c.id)),
  banc as (select m.id, m.transaccion_id from public.movimientos_bancarios m, r
            where m.localidad_id = p_loc and m.estado = 'ACTIVO' and m.partida_id is null and m.transaccion_id is not null
              and m.fecha between r.d1 and r.d2
              and not exists (select 1 from hecho h where h.origen = 'BANCO' and h.documento_id = m.id)),
  vent as (select f.id, v.id as transaccion_id, f.total, f.iva, f.monto_retencion_iva, f.monto_retencion_isr,
                  case when coalesce((select x.iso from public.monedas x where x.id = f.moneda_id), 'GTQ') = 'GTQ' then 1 else f.tipo_cambio end as tc
             from public.facturas_venta f cross join vtrx v, r
            where f.localidad_id = p_loc and f.estado = 'FACTURADA' and f.partida_id is null
              and (f.fecha_emision at time zone 'America/Guatemala')::date between r.d1 and r.d2
              and not exists (select 1 from hecho h where h.origen = 'VENTA' and h.documento_id = f.id))
  select 'COMPRA', c.id, c.transaccion_id, l.cuenta_id, l.centro_id, coalesce(l.debe, 0), coalesce(l.haber, 0), l.id is not null
    from comp c left join public.compra_lineas l on l.compra_id = c.id
  union all
  select 'BANCO', m.id, m.transaccion_id, l.cuenta_id, l.centro_id, coalesce(l.debe, 0), coalesce(l.haber, 0), l.id is not null
    from banc m left join public.movimiento_lineas l on l.movimiento_id = m.id
  union all
  select 'VENTA', f.id, f.transaccion_id, l.cuenta_id, l.centro_id, l.debe, l.haber, true
    from vent f join public.factura_venta_contable l on l.factura_id = f.id
  union all
  -- Facturas sin detalle contable: la plantilla de la transacción de ventas (total, subtotal, impuesto y retenciones).
  select 'VENTA', f.id, f.transaccion_id, t.cuenta_id, t.centro_id,
         case when t.naturaleza = 'D' then x.monto else 0 end, case when t.naturaleza = 'H' then x.monto else 0 end, t.id is not null
    from vent f
    left join public.transaccion_cuentas t on t.transaccion_id = f.transaccion_id
    cross join lateral (select round(f.tc * case t.operacion when 'TOTAL' then f.total when 'SUBTOTAL' then f.total - f.iva when 'IMPUESTO' then f.iva
                                                             when 'RETENCIÓN' then f.monto_retencion_iva + f.monto_retencion_isr else 0 end, 2) as monto) x
   where not exists (select 1 from public.factura_venta_contable l where l.factura_id = f.id);
$function$;

-- Resumen del mes para la pantalla: estado de los 12 meses y, por transacción, lo pendiente y lo generado.
create or replace function public.con_preliminar_resumen(p_loc bigint, p_anio integer, p_mes integer)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_meses jsonb; v_trx jsonb;
begin
  if not public.usuario_activo() then raise exception 'Usuario no autorizado.'; end if;
  select jsonb_agg(jsonb_build_object('mes', g.m,
           'estado', case when public.periodo_cerrado(p_loc, p_anio, g.m) then 'DEFINITIVO'
                          when exists (select 1 from public.cierres_preliminares c where c.localidad_id = p_loc and c.anio = p_anio and c.mes = g.m and c.estado = 'GENERADO') then 'PRELIMINAR'
                          else 'PENDIENTE' end) order by g.m)
    into v_meses from generate_series(1, 12) g(m);
  with l as (select * from public.con_preliminar_lineas(p_loc, p_anio, p_mes)),
  pend as (select l.transaccion_id, count(distinct (l.origen, l.documento_id)) as documentos,
                  count(distinct (l.origen, l.documento_id)) filter (where not l.con_detalle) as sin_detalle,
                  sum(l.debe) as debe, sum(l.haber) as haber
             from l group by l.transaccion_id),
  gen as (select c.transaccion_id, c.id, c.documentos, c.total, c.generado_por, c.generado_en, p.mes || '-' || p.numero as partida, p.definitiva
            from public.cierres_preliminares c left join public.partidas p on p.id = c.partida_id
           where c.localidad_id = p_loc and c.anio = p_anio and c.mes = p_mes and c.estado = 'GENERADO')
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'numero', t.numero, 'descripcion', t.descripcion, 'modulo', t.modulo_cierre, 'aplica_poliza', t.aplica_poliza,
           'activa', t.estado = 'ACTIVO',
           'pendientes', coalesce(pd.documentos, 0), 'sin_detalle', coalesce(pd.sin_detalle, 0),
           'debe', coalesce(pd.debe, 0), 'haber', coalesce(pd.haber, 0),
           'generado', case when g.id is null then null else jsonb_build_object('partida', g.partida, 'documentos', g.documentos, 'total', g.total,
                                                                                'por', g.generado_por, 'en', g.generado_en, 'definitiva', coalesce(g.definitiva, false)) end)
           order by t.numero), '[]'::jsonb)
    into v_trx
    from public.transacciones_contables t left join pend pd on pd.transaccion_id = t.id left join gen g on g.transaccion_id = t.id
   where t.localidad_id = p_loc;
  return jsonb_build_object('meses', v_meses, 'cerrado', public.periodo_cerrado(p_loc, p_anio, p_mes), 'transacciones', v_trx);
end;
$function$;

-- Genera o reversa las pólizas preliminares del mes de las transacciones indicadas (null = todas las del mes).
create or replace function public.con_cierre_preliminar(p_loc bigint, p_anio integer, p_mes integer, p_accion text, p_transacciones bigint[] default null)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_org bigint := (select organizacion_id from public.localidades where id = p_loc);
  v_meses constant text[] := array['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  v_avisos jsonb := '[]'::jsonb; v_ok integer := 0;
  t public.transacciones_contables; c public.cierres_preliminares;
  v_docs integer; v_sin integer; v_d numeric; v_h numeric; v_cat bigint; v_cats integer; v_tipo bigint; v_mon bigint; v_partida bigint; v_cierre bigint; v_n integer; v_txt text; v_con bigint[]; v_lin jsonb;
  r record;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede generar el cierre preliminar.'; end if;
  if v_org is null then raise exception 'La localidad no existe.'; end if;
  if p_mes not between 1 and 12 then raise exception 'Mes no válido.'; end if;
  if public.periodo_cerrado(p_loc, p_anio, p_mes) then
    raise exception '% % ya tiene cierre mensual definitivo: reábrelo en Cierre Mensual para cambiar sus pólizas.', initcap(v_meses[p_mes]), p_anio;
  end if;

  if p_accion = 'GENERAR' then
    -- Transacciones con documentos pendientes en el mes.
    v_con := array(select distinct x.transaccion_id from public.con_preliminar_lineas(p_loc, p_anio, p_mes) x);
    v_mon := (select id from public.monedas where iso = 'GTQ' order by id limit 1);
    for t in select * from public.transacciones_contables x
              where x.localidad_id = p_loc and (case when p_transacciones is null then x.id = any (v_con) else x.id = any (p_transacciones) end)
              order by x.numero loop
      v_txt := t.numero || ' ' || t.descripcion;
      if not t.aplica_poliza then v_avisos := v_avisos || jsonb_build_object('t', v_txt, 'tipo', 'aviso', 'msg', 'No aplica póliza.'); continue; end if;
      if exists (select 1 from public.cierres_preliminares x where x.localidad_id = p_loc and x.anio = p_anio and x.mes = p_mes and x.transaccion_id = t.id and x.estado = 'GENERADO')
         and not (t.id = any (v_con)) then
        v_avisos := v_avisos || jsonb_build_object('t', v_txt, 'tipo', 'aviso', 'msg', 'Ya está generada: revérsala para generarla de nuevo.'); continue;
      end if;
      -- Detalle contable pendiente de la transacción.
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_lin from public.con_preliminar_lineas(p_loc, p_anio, p_mes) x where x.transaccion_id = t.id;
      select count(distinct (origen, documento_id)), count(distinct (origen, documento_id)) filter (where not con_detalle)
        into v_docs, v_sin from jsonb_to_recordset(v_lin) as p (origen text, documento_id bigint, con_detalle boolean);
      if v_docs = 0 then v_avisos := v_avisos || jsonb_build_object('t', v_txt, 'tipo', 'aviso', 'msg', 'Sin documentos pendientes en el mes.'); continue; end if;
      if exists (select 1 from public.cierres_preliminares x where x.localidad_id = p_loc and x.anio = p_anio and x.mes = p_mes and x.transaccion_id = t.id and x.estado = 'GENERADO') then
        v_avisos := v_avisos || jsonb_build_object('t', v_txt, 'tipo', 'error', 'msg', 'Ya tiene póliza preliminar y hay ' || v_docs || ' documentos nuevos: revérsala y genérala de nuevo para incluirlos.'); continue;
      end if;
      if v_sin > 0 then
        v_avisos := v_avisos || jsonb_build_object('t', v_txt, 'tipo', 'error', 'msg', v_sin || ' documento(s) sin detalle contable ni plantilla: contabilízalos primero.'); continue;
      end if;
      select coalesce(sum(debe), 0), coalesce(sum(haber), 0), min(k.catalogo_id), count(distinct k.catalogo_id)
        into v_d, v_h, v_cat, v_cats from jsonb_to_recordset(v_lin) as p (cuenta_id bigint, debe numeric, haber numeric) join public.cuentas k on k.id = p.cuenta_id;
      if abs(v_d - v_h) >= 0.005 then
        v_avisos := v_avisos || jsonb_build_object('t', v_txt, 'tipo', 'error', 'msg', 'No cuadra: debe Q' || to_char(v_d, 'FM999,999,999,990.00') || ' y haber Q' || to_char(v_h, 'FM999,999,999,990.00') || '.'); continue;
      end if;
      if v_cats > 1 then
        v_avisos := v_avisos || jsonb_build_object('t', v_txt, 'tipo', 'error', 'msg', 'Los documentos usan cuentas de distintas versiones del catálogo.'); continue;
      end if;
      v_tipo := (select id from public.tipos_partida where siglas = case t.modulo_cierre when 'VENTAS' then 'PV' when 'COMPRAS' then 'PC' when 'CAJA Y BANCOS' then 'PB'
                                                                                         when 'NÓMINAS' then 'PN' else 'PD' end limit 1);
      if v_tipo is null then v_tipo := (select id from public.tipos_partida where siglas = 'PD' limit 1); end if;
      begin
        perform set_config('fin.partida', 'si', true);
        -- La póliza lleva la fecha del último día del mes.
        perform set_config('fin.fecha_partida', make_timestamptz(p_anio, p_mes, extract(day from (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day'))::integer, 12, 0, 0, 'America/Guatemala')::text, true);
        insert into public.partidas (organizacion_id, localidad_id, catalogo_id, anio, mes, tipo_partida_id, descripcion, moneda_id, tipo_cambio, origen, clasificacion, justificacion, transaccion_id)
        values (v_org, p_loc, v_cat, p_anio, p_mes, v_tipo,
                left('CIERRE PRELIMINAR ' || v_meses[p_mes] || ' ' || p_anio || ' · ' || t.numero || ' ' || t.descripcion, 250),
                coalesce(v_mon, (select moneda_id from public.partidas where localidad_id = p_loc order by id desc limit 1)), 1, 'AUTOMÁTICA', 'PARTIDA DEL MES',
                'Integración del cierre preliminar: ' || v_docs || ' documento(s) del módulo ' || coalesce(lower(t.modulo_cierre), 'sin módulo') || '.', t.id)
        returning id into v_partida;
        perform set_config('fin.fecha_partida', '', true);
        v_n := 0;
        for r in select p.cuenta_id, p.centro_id, sum(p.debe) - sum(p.haber) as neto
                   from jsonb_to_recordset(v_lin) as p (cuenta_id bigint, centro_id bigint, debe numeric, haber numeric) join public.cuentas k on k.id = p.cuenta_id
                  group by p.cuenta_id, p.centro_id, k.codigo
                 having abs(sum(p.debe) - sum(p.haber)) >= 0.005 order by (sum(p.debe) - sum(p.haber)) < 0, k.codigo loop
          v_n := v_n + 1;
          insert into public.partida_lineas (partida_id, linea, cuenta_id, centro_id, concepto, debe, haber)
          values (v_partida, v_n, r.cuenta_id, r.centro_id, left(t.descripcion, 200), greatest(r.neto, 0), greatest(-r.neto, 0));
        end loop;
        if v_n < 2 then raise exception 'Los documentos se compensan entre sí: no queda saldo que contabilizar.'; end if;
        perform set_config('fin.partida', 'si', true);
        update public.partidas set aprobada = true, aprobada_por = v_quien, aprobada_en = now() where id = v_partida;
        perform set_config('fin.partida', '', true);
        insert into public.cierres_preliminares (organizacion_id, localidad_id, anio, mes, transaccion_id, modulo, partida_id, documentos, total, generado_por)
        values (v_org, p_loc, p_anio, p_mes, t.id, t.modulo_cierre, v_partida, v_docs, round(v_d, 2), v_quien)
        returning id into v_cierre;
        insert into public.cierre_preliminar_documentos (cierre_id, origen, documento_id)
        select distinct v_cierre, p.origen, p.documento_id from jsonb_to_recordset(v_lin) as p (origen text, documento_id bigint);
        v_ok := v_ok + 1;
        v_avisos := v_avisos || jsonb_build_object('t', v_txt, 'tipo', 'ok',
                      'msg', v_docs || ' documento(s) en la póliza ' || (select x.mes || '-' || x.numero from public.partidas x where x.id = v_partida) || ' por Q' || to_char(v_d, 'FM999,999,999,990.00') || '.');
      exception when others then
        perform set_config('fin.partida', '', true);
        perform set_config('fin.fecha_partida', '', true);
        v_avisos := v_avisos || jsonb_build_object('t', v_txt, 'tipo', 'error', 'msg', sqlerrm);
      end;
    end loop;
    if jsonb_array_length(v_avisos) = 0 then v_avisos := jsonb_build_array(jsonb_build_object('t', '', 'tipo', 'aviso', 'msg', 'No hay documentos pendientes en el mes para las transacciones elegidas.')); end if;
    return jsonb_build_object('accion', 'GENERAR', 'generadas', v_ok, 'avisos', v_avisos);

  elsif p_accion = 'REVERSAR' then
    for c in select * from public.cierres_preliminares x
              where x.localidad_id = p_loc and x.anio = p_anio and x.mes = p_mes and x.estado = 'GENERADO'
                and (p_transacciones is null or x.transaccion_id = any (p_transacciones)) order by x.id loop
      select x.numero || ' ' || x.descripcion into v_txt from public.transacciones_contables x where x.id = c.transaccion_id;
      if exists (select 1 from public.partidas p where p.id = c.partida_id and p.definitiva) then
        v_avisos := v_avisos || jsonb_build_object('t', v_txt, 'tipo', 'error', 'msg', 'La póliza ya es definitiva: no se reversa.'); continue;
      end if;
      perform set_config('fin.partida', 'si', true);
      update public.partidas set estado = 'ANULADA', aprobada = false, anulada_por = v_quien, anulada_en = now(),
             motivo_anulacion = 'Reversión del cierre preliminar de ' || lower(v_meses[p_mes]) || ' ' || p_anio
       where id = c.partida_id and estado = 'VIGENTE';
      perform set_config('fin.partida', '', true);
      update public.cierres_preliminares set estado = 'REVERSADO', reversado_por = v_quien, reversado_en = now() where id = c.id;
      v_ok := v_ok + 1;
      v_avisos := v_avisos || jsonb_build_object('t', v_txt, 'tipo', 'ok', 'msg', 'Póliza anulada; ' || c.documentos || ' documento(s) vuelven a quedar pendientes.');
    end loop;
    if v_ok = 0 and jsonb_array_length(v_avisos) = 0 then
      v_avisos := jsonb_build_array(jsonb_build_object('t', '', 'tipo', 'aviso', 'msg', 'No hay pólizas preliminares que reversar en las transacciones elegidas.'));
    end if;
    return jsonb_build_object('accion', 'REVERSAR', 'reversadas', v_ok, 'avisos', v_avisos);
  else
    raise exception 'Acción no válida.';
  end if;
end;
$function$;

revoke execute on function public.con_modulo_por_uso(bigint) from public, anon, authenticated;
revoke execute on function public.con_preliminar_lineas(bigint, integer, integer) from public, anon, authenticated;
revoke execute on function public.transaccion_modulo_inicial() from public, anon, authenticated;
revoke execute on function public.con_asignar_modulos(bigint, boolean) from public, anon;
revoke execute on function public.con_preliminar_resumen(bigint, integer, integer) from public, anon;
revoke execute on function public.con_cierre_preliminar(bigint, integer, integer, text, bigint[]) from public, anon;
grant execute on function public.con_asignar_modulos(bigint, boolean) to authenticated;
grant execute on function public.con_preliminar_resumen(bigint, integer, integer) to authenticated;
grant execute on function public.con_cierre_preliminar(bigint, integer, integer, text, bigint[]) to authenticated;

-- ============ Opciones del menú y accesos ============
-- Grupos de Procesos: «Revisión Preliminar» y «Generación de Cierres» (Transacciones por módulo, Cierre Preliminar,
-- Cierre Mensual y Cierre Anual Fiscal). Las opciones nuevas copian los accesos de Cierre de mes.
do $$
declare v_mod bigint; v_id bigint; v_ref bigint; v_orden integer; o record;
begin
  select id into v_mod from public.modulos_sistema where siglas = 'CON' and modulo_mayor_id is null limit 1;
  if v_mod is null then return; end if;
  select id into v_ref from public.opciones_sistema where clave = 'cierre-de-mes' order by id limit 1;
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  update public.opciones_sistema set subgrupo = 'Revisión Preliminar'
   where modulo_id = v_mod and clave in ('con-revision-cierre', 'con-mayorizacion', 'con-automaticas', 'con-diferencial', 'con-reversion') and subgrupo is distinct from 'Revisión Preliminar';
  update public.opciones_sistema set subgrupo = 'Generación de Cierres', nombre = 'Cierre Mensual' where clave = 'cierre-de-mes' and (subgrupo, nombre) is distinct from ('Generación de Cierres', 'Cierre Mensual');
  update public.opciones_sistema set subgrupo = 'Generación de Cierres', nombre = 'Cierre Anual Fiscal' where clave = 'con-cierre-anual' and (subgrupo, nombre) is distinct from ('Generación de Cierres', 'Cierre Anual Fiscal');
  for o in select * from (values (1, 'con-transacciones-modulo', 'Transacciones por módulo'), (2, 'con-cierre-preliminar', 'Cierre Preliminar')) as x(n, clave, nombre) loop
    select id into v_id from public.opciones_sistema where modulo_id = v_mod and clave = o.clave;
    if v_id is null then
      insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values (v_mod, 'procesos', 'Generación de Cierres', o.clave, o.nombre, v_orden + o.n) returning id into v_id;
    else
      update public.opciones_sistema set nombre = o.nombre, activo = true where id = v_id;  -- no la mueve de grupo (el 208 la pasa a Objetos contables)
    end if;
    if v_ref is not null then
      insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
      select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = v_ref on conflict do nothing;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Resumen: transacciones por módulo.
select coalesce(modulo_cierre, '(SIN MÓDULO)') as modulo, count(*) as transacciones from public.transacciones_contables group by 1 order by 1;
