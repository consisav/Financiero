-- Conciliaciones bancarias de la organización 3 (Futura Farma - Mavisa), del archivo «CON_CONCILIACIONES_BANCARIAS.xls»
-- (5 conciliaciones: 3-01 3659016341 12/2023; 3-02 206-131947-7 01/2025; 3-02 206-131947-7 06/2026; 3-02 206-134189-3 01/2025; 3-02 3235100377 12/2025).
--   1. Una conciliación se identifica por su cuenta bancaria, año y mes: si ya existe NO se crea, se actualiza.
--   2. Columnas nuevas en conciliaciones (los totales del mes que calculaba el sistema anterior; vienen con datos
--      y no estaban en la base de datos): saldo_anterior, numero_cheques, cheques_anulados, valor_cheques_anulados, valor_cheques, cheques_circulacion, valor_cheques_circulacion, cheques_cobrados, valor_cheques_cobrados, numero_depositos, valor_depositos, depositos_circulacion, valor_depositos_circulacion, notas_cre, valor_notas_cre, notas_cre_circulacion, valor_notas_cre_circulacion, notas_de, valor_notas_de, notas_de_circulacion, valor_notas_de_circulacion, saldo_actual, diferencias, fecha_inicial, fecha_final, mi_valor_cheques, mi_valor_cheques_anulados, mi_valor_cheques_circulacion, mi_valor_cheques_cobrados, mi_valor_depositos, mi_valor_depositos_circulacion, mi_valor_notas_cre, mi_valor_notas_cre_circulacion, mi_valor_notas_de, mi_valor_notas_de_circulacion, mi_saldo_anterior, mi_saldo_segun_banco, mi_saldo_actual, mi_diferencias, y origen_anterior.
--      Columnas vacías en todas las filas (no se agregan): OBSERVACIONES, FECHA_CIERRE, USUARIO_CARGA, FECHA_CARGA, OBSERVACIONES_CARGA, POLIZAS_CIRCULACION, VALOR_POLIZAS, VALOR_POLIZAS_MI, CANTIDAD_POLIZAS.
--   Equivalencias: SALDO_SEGUN_BANCO = saldo según banco (en la moneda de la cuenta) y su valor en quetzales al cambio
--   de la cuenta; FECHA_CONCILIACION = fecha; USUARIO = usuario. El saldo contable es el de las partidas del sistema
--   hasta ese mes. FECHA_CIERRE viene vacía: las conciliaciones quedan ABIERTAS, como estaban en el sistema anterior.
--   La cuenta bancaria se liga por su número en la localidad.
--   Puede ejecutarse de nuevo: la segunda vez solo actualiza. Se ejecuta después del script 115.

alter table public.conciliaciones add column if not exists saldo_anterior numeric(18, 2);
alter table public.conciliaciones add column if not exists numero_cheques integer;
alter table public.conciliaciones add column if not exists cheques_anulados integer;
alter table public.conciliaciones add column if not exists valor_cheques_anulados numeric(18, 2);
alter table public.conciliaciones add column if not exists valor_cheques numeric(18, 2);
alter table public.conciliaciones add column if not exists cheques_circulacion integer;
alter table public.conciliaciones add column if not exists valor_cheques_circulacion numeric(18, 2);
alter table public.conciliaciones add column if not exists cheques_cobrados integer;
alter table public.conciliaciones add column if not exists valor_cheques_cobrados numeric(18, 2);
alter table public.conciliaciones add column if not exists numero_depositos integer;
alter table public.conciliaciones add column if not exists valor_depositos numeric(18, 2);
alter table public.conciliaciones add column if not exists depositos_circulacion integer;
alter table public.conciliaciones add column if not exists valor_depositos_circulacion numeric(18, 2);
alter table public.conciliaciones add column if not exists notas_cre integer;
alter table public.conciliaciones add column if not exists valor_notas_cre numeric(18, 2);
alter table public.conciliaciones add column if not exists notas_cre_circulacion integer;
alter table public.conciliaciones add column if not exists valor_notas_cre_circulacion numeric(18, 2);
alter table public.conciliaciones add column if not exists notas_de integer;
alter table public.conciliaciones add column if not exists valor_notas_de numeric(18, 2);
alter table public.conciliaciones add column if not exists notas_de_circulacion integer;
alter table public.conciliaciones add column if not exists valor_notas_de_circulacion numeric(18, 2);
alter table public.conciliaciones add column if not exists saldo_actual numeric(18, 2);
alter table public.conciliaciones add column if not exists diferencias numeric(18, 2);
alter table public.conciliaciones add column if not exists fecha_inicial date;
alter table public.conciliaciones add column if not exists fecha_final date;
alter table public.conciliaciones add column if not exists mi_valor_cheques numeric(18, 2);
alter table public.conciliaciones add column if not exists mi_valor_cheques_anulados numeric(18, 2);
alter table public.conciliaciones add column if not exists mi_valor_cheques_circulacion numeric(18, 2);
alter table public.conciliaciones add column if not exists mi_valor_cheques_cobrados numeric(18, 2);
alter table public.conciliaciones add column if not exists mi_valor_depositos numeric(18, 2);
alter table public.conciliaciones add column if not exists mi_valor_depositos_circulacion numeric(18, 2);
alter table public.conciliaciones add column if not exists mi_valor_notas_cre numeric(18, 2);
alter table public.conciliaciones add column if not exists mi_valor_notas_cre_circulacion numeric(18, 2);
alter table public.conciliaciones add column if not exists mi_valor_notas_de numeric(18, 2);
alter table public.conciliaciones add column if not exists mi_valor_notas_de_circulacion numeric(18, 2);
alter table public.conciliaciones add column if not exists mi_saldo_anterior numeric(18, 2);
alter table public.conciliaciones add column if not exists mi_saldo_segun_banco numeric(18, 2);
alter table public.conciliaciones add column if not exists mi_saldo_actual numeric(18, 2);
alter table public.conciliaciones add column if not exists mi_diferencias numeric(18, 2);
alter table public.conciliaciones add column if not exists origen_anterior text;
comment on column public.conciliaciones.origen_anterior is 'MIGRADO: conciliación del sistema anterior (sus totales del mes vienen en las columnas *_circulacion, valor_* y mi_*).';

do $migra$
declare
  v_org bigint; r record; v_loc bigint; v_cb record; v_id bigint; v_tc numeric; v_conta numeric; v_nuevo boolean;
  c_n int := 0; c_a int := 0; c_s int := 0;
begin
  select id into v_org from public.organizaciones where codigo = '3';
  if v_org is null then raise notice 'No existe la organización 3.'; return; end if;
  -- La carga trae usuario y fecha del sistema anterior: se suspende la preparación automática de la pantalla.
  alter table public.conciliaciones disable trigger conciliaciones_preparar;
  for r in select * from (values
    (1, '3659016341', 2023, 12, '2023-12-31', 0, 'FRA', null, 0, 8, 0, 0, 16195.52, 1808, 23900007.71, 7, 13595.52, 0, 0, 0, 0, 6, 260815, 6, 260815, 3, 3161.06, 45, 1705063.37, 0, 0, '2023-12-01', '2023-12-31', 2103.31, 0, 855435.14, 1765.65, 0, 0, 0, 0, 410.53, 221025.96, 0, 0, 0, 0),
    (2, '206-131947-7', 2025, 1, '2025-01-31', 0, 'JRA', null, 0, 0, 0, 0, 0, 0, 0, 0, 0, 54, 215007.6, 0, 0, 54, 306498.5, 0, 0, 1, 29460, 0, 0, 0, 0, '2025-01-01', '2025-01-31', 0, 0, 0, 0, 0, 0, 0, 0, 3825.97, 0, 0, 0, 0, 0),
    (2, '206-131947-7', 2026, 6, '2026-06-30', 0, 'FRA', null, 0, 0, 0, 0, 0, 1, 7738.63, 0, 0, 22, 155649.5, 0, 0, 28, 228181.1, 0, 0, 28, 516127.12, 130, 5961903.44, 0, 0, '2026-06-01', '2026-06-30', 0, 0, 1005.02, 0, 0, 0, 0, 0, 75648.43, 774273.18, 0, 0, 0, 0),
    (2, '206-134189-3', 2025, 1, '2025-01-01', 0, 'LMI', null, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '2025-01-01', '2025-01-31', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
    (2, '3235100377', 2025, 12, '2025-12-31', 0, 'OLM', null, 0, null, null, 0, 0, null, 0, null, 0, null, 0, null, 0, null, 0, null, 0, null, 0, null, 0, 0, 0, '2025-12-01', '2025-12-31', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)) as x(loc, cuenta, anio, mes, fecha, saldo_banco, usuario, observaciones, saldo_anterior, numero_cheques, cheques_anulados, valor_cheques_anulados, valor_cheques, cheques_circulacion, valor_cheques_circulacion, cheques_cobrados, valor_cheques_cobrados, numero_depositos, valor_depositos, depositos_circulacion, valor_depositos_circulacion, notas_cre, valor_notas_cre, notas_cre_circulacion, valor_notas_cre_circulacion, notas_de, valor_notas_de, notas_de_circulacion, valor_notas_de_circulacion, saldo_actual, diferencias, fecha_inicial, fecha_final, mi_valor_cheques, mi_valor_cheques_anulados, mi_valor_cheques_circulacion, mi_valor_cheques_cobrados, mi_valor_depositos, mi_valor_depositos_circulacion, mi_valor_notas_cre, mi_valor_notas_cre_circulacion, mi_valor_notas_de, mi_valor_notas_de_circulacion, mi_saldo_anterior, mi_saldo_segun_banco, mi_saldo_actual, mi_diferencias) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    select cb.id, cb.moneda_id into v_cb from public.cuentas_bancarias cb where cb.localidad_id = v_loc and cb.numero = r.cuenta;
    if v_cb.id is null then c_s := c_s + 1; raise notice 'Conciliación %/% (3-0%): no existe la cuenta bancaria %.', r.mes, r.anio, r.loc, r.cuenta; continue; end if;
    -- Tipo de cambio de venta de la moneda de la cuenta a la fecha de la conciliación (quetzales = 1).
    select case when m.iso = 'GTQ' then 1 else coalesce((select t.valor_venta from public.tipos_cambio t where t.moneda_id = m.id and t.fecha <= r.fecha::date order by t.fecha desc limit 1), 1) end
      into v_tc from public.monedas m where m.id = v_cb.moneda_id;
    begin v_conta := coalesce(public.saldo_contable_cuenta_bancaria(v_cb.id, r.anio::integer, r.mes::integer), 0);
    exception when others then v_conta := 0; end;
    insert into public.conciliaciones (organizacion_id, localidad_id, cuenta_bancaria_id, anio, mes, fecha, usuario, saldo_banco, saldo_banco_ml, saldo_contable, saldo_contable_ml, observaciones, estado, origen_anterior,
      saldo_anterior, numero_cheques, cheques_anulados, valor_cheques_anulados, valor_cheques, cheques_circulacion, valor_cheques_circulacion, cheques_cobrados, valor_cheques_cobrados, numero_depositos, valor_depositos, depositos_circulacion, valor_depositos_circulacion, notas_cre, valor_notas_cre, notas_cre_circulacion, valor_notas_cre_circulacion, notas_de, valor_notas_de, notas_de_circulacion, valor_notas_de_circulacion, saldo_actual, diferencias, fecha_inicial, fecha_final, mi_valor_cheques, mi_valor_cheques_anulados, mi_valor_cheques_circulacion, mi_valor_cheques_cobrados, mi_valor_depositos, mi_valor_depositos_circulacion, mi_valor_notas_cre, mi_valor_notas_cre_circulacion, mi_valor_notas_de, mi_valor_notas_de_circulacion, mi_saldo_anterior, mi_saldo_segun_banco, mi_saldo_actual, mi_diferencias)
    values (v_org, v_loc, v_cb.id, r.anio, r.mes, r.fecha::date, coalesce(upper(r.usuario::text), 'SISTEMA ANTERIOR'), r.saldo_banco, round(r.saldo_banco * coalesce(v_tc, 1), 2), v_conta,
      case when coalesce(v_tc, 1) = 1 then v_conta else round(v_conta / v_tc, 2) end, r.observaciones, 'ABIERTA', 'MIGRADO',
      r.saldo_anterior, r.numero_cheques, r.cheques_anulados, r.valor_cheques_anulados, r.valor_cheques, r.cheques_circulacion, r.valor_cheques_circulacion, r.cheques_cobrados, r.valor_cheques_cobrados, r.numero_depositos, r.valor_depositos, r.depositos_circulacion, r.valor_depositos_circulacion, r.notas_cre, r.valor_notas_cre, r.notas_cre_circulacion, r.valor_notas_cre_circulacion, r.notas_de, r.valor_notas_de, r.notas_de_circulacion, r.valor_notas_de_circulacion, r.saldo_actual, r.diferencias, r.fecha_inicial::date, r.fecha_final::date, r.mi_valor_cheques, r.mi_valor_cheques_anulados, r.mi_valor_cheques_circulacion, r.mi_valor_cheques_cobrados, r.mi_valor_depositos, r.mi_valor_depositos_circulacion, r.mi_valor_notas_cre, r.mi_valor_notas_cre_circulacion, r.mi_valor_notas_de, r.mi_valor_notas_de_circulacion, r.mi_saldo_anterior, r.mi_saldo_segun_banco, r.mi_saldo_actual, r.mi_diferencias)
    on conflict (cuenta_bancaria_id, anio, mes) do update set fecha = excluded.fecha, usuario = excluded.usuario, saldo_banco = excluded.saldo_banco, saldo_banco_ml = excluded.saldo_banco_ml,
      observaciones = coalesce(excluded.observaciones, conciliaciones.observaciones), origen_anterior = 'MIGRADO',
      saldo_anterior = excluded.saldo_anterior, numero_cheques = excluded.numero_cheques, cheques_anulados = excluded.cheques_anulados, valor_cheques_anulados = excluded.valor_cheques_anulados, valor_cheques = excluded.valor_cheques, cheques_circulacion = excluded.cheques_circulacion, valor_cheques_circulacion = excluded.valor_cheques_circulacion, cheques_cobrados = excluded.cheques_cobrados, valor_cheques_cobrados = excluded.valor_cheques_cobrados, numero_depositos = excluded.numero_depositos, valor_depositos = excluded.valor_depositos, depositos_circulacion = excluded.depositos_circulacion, valor_depositos_circulacion = excluded.valor_depositos_circulacion, notas_cre = excluded.notas_cre, valor_notas_cre = excluded.valor_notas_cre, notas_cre_circulacion = excluded.notas_cre_circulacion, valor_notas_cre_circulacion = excluded.valor_notas_cre_circulacion, notas_de = excluded.notas_de, valor_notas_de = excluded.valor_notas_de, notas_de_circulacion = excluded.notas_de_circulacion, valor_notas_de_circulacion = excluded.valor_notas_de_circulacion, saldo_actual = excluded.saldo_actual, diferencias = excluded.diferencias, fecha_inicial = excluded.fecha_inicial, fecha_final = excluded.fecha_final, mi_valor_cheques = excluded.mi_valor_cheques, mi_valor_cheques_anulados = excluded.mi_valor_cheques_anulados, mi_valor_cheques_circulacion = excluded.mi_valor_cheques_circulacion, mi_valor_cheques_cobrados = excluded.mi_valor_cheques_cobrados, mi_valor_depositos = excluded.mi_valor_depositos, mi_valor_depositos_circulacion = excluded.mi_valor_depositos_circulacion, mi_valor_notas_cre = excluded.mi_valor_notas_cre, mi_valor_notas_cre_circulacion = excluded.mi_valor_notas_cre_circulacion, mi_valor_notas_de = excluded.mi_valor_notas_de, mi_valor_notas_de_circulacion = excluded.mi_valor_notas_de_circulacion, mi_saldo_anterior = excluded.mi_saldo_anterior, mi_saldo_segun_banco = excluded.mi_saldo_segun_banco, mi_saldo_actual = excluded.mi_saldo_actual, mi_diferencias = excluded.mi_diferencias
    returning (xmax = 0) into v_nuevo;
    if v_nuevo then c_n := c_n + 1; else c_a := c_a + 1; end if;
  end loop;
  alter table public.conciliaciones enable trigger conciliaciones_preparar;
  raise notice '%', format('Conciliaciones: %s nuevas, %s actualizadas, %s sin cuenta bancaria.', c_n, c_a, c_s);
end;
$migra$;

notify pgrst, 'reload schema';
