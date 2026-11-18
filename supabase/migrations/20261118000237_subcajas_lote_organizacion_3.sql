-- Script 237 · parte 1 de 2 · Organización 3, lote del 05-11-2026 al 17-11-2026: subcajas (CON_SUBCAJAS.xls, 3 subcajas:
--   3 de la 3-01), con la lógica del script 121. Las cajas ya existen: el lote no trae CON_CAJAS ni CON_DETCON_CAJAS.
--   Una subcaja se identifica por su caja y su número: si ya existe se actualiza. ESTADO C = liquidada en el sistema anterior; V = abierta.
--   Columnas vacías en todas las filas (no se migran): CUENTA_BANCARIA, NUMERO_CHEQUE, REQUISICION_CHEQUE, NUMERO_NOTA, JORNADA, INTEGRANTE, CUENTA_BANCARIA2, NUMERO_CHEQUE2, EMPLEADO, POLIZA, NOTA, TOTAL, FECHA_LIQUIDACION_CAJ, CUENTA_BANCO, CHEQUE, NOTA_ADELANTO, TIPO_CAJA, ARCHIVO, USUARIO_CIERRA, FECHA_CIERRA.
--   Se ejecuta antes de la parte 2 (documentos de las subcajas). Se puede ejecutar de nuevo.
alter table public.cajas_chicas add column if not exists origen_anterior text;
alter table public.cajas_chicas add column if not exists usuario_anterior text;
alter table public.cajas_chicas add column if not exists tipo_anterior text;
alter table public.cajas_chicas add column if not exists tipo_movimiento_anterior text;
alter table public.cajas_chicas add column if not exists version_cuenta_anterior integer;
alter table public.caja_periodos add column if not exists origen_anterior text;
alter table public.caja_periodos add column if not exists concepto text;
alter table public.caja_periodos add column if not exists fecha_creacion_anterior timestamp;
alter table public.caja_periodos add column if not exists cuadrada boolean;
alter table public.caja_periodos add column if not exists liquidada_anterior boolean;
alter table public.caja_periodos add column if not exists fecha_liquidacion_anterior timestamp;
alter table public.caja_periodos add column if not exists usuario_liquida_anterior text;
alter table public.caja_periodos add column if not exists moneda_integracion integer;
alter table public.caja_periodos add column if not exists valor_cambio_anterior numeric(18, 6);
alter table public.caja_periodos add column if not exists estado_anterior text;
alter table public.caja_lineas add column if not exists movimiento_anterior integer;
alter table public.caja_lineas add column if not exists linea_anterior integer;
alter table public.caja_lineas add column if not exists cuenta_codigo_anterior text;
alter table public.caja_lineas add column if not exists version_cuenta_anterior integer;
alter table public.caja_lineas add column if not exists debe_mi numeric(18, 2);
alter table public.caja_lineas add column if not exists haber_mi numeric(18, 2);
-- Columnas del script 120 (por si este script se ejecuta solo).
alter table public.cajas_chicas add column if not exists transaccion_id bigint references public.transacciones_contables(id) on delete set null;
alter table public.cajas_chicas add column if not exists usuario_liquida text;
alter table public.cajas_chicas add column if not exists carga_masiva boolean not null default false;
alter table public.cajas_chicas add column if not exists cuenta_caja_id bigint references public.cuentas(id);

do $migra$
declare
  v_org bigint; v_gtq bigint; r record; v_loc bigint; v_cta bigint; v_tr bigint; v_caja bigint; v_nuevo boolean;
  c_n int := 0; c_a int := 0; s_n int := 0; s_a int := 0; s_s int := 0;
begin
  select id into v_org from public.organizaciones where codigo = '3';
  if v_org is null then raise notice 'No existe la organización 3.'; return; end if;
  select id into v_gtq from public.monedas where iso = 'GTQ';

  -- Subcajas: el número de la subcaja se conserva; la cerrada (C) queda liquidada en el sistema anterior, sin póliza.
  alter table public.caja_periodos disable trigger caja_periodos_preparar;
  for r in select * from (values
    (1, 1, 23, 2026, 11, 'KER', '2026-11-16 14:35:47', false, false, 0, 0, '2026-11-16 14:35:47', 'KER', 0, 'CAJA ADMINISTRATIVA NOVIEMBRE 2026', 1, 7.7, 'V', null, null),
    (1, 7, 8, 2026, 11, 'OLM', '2026-11-16 13:43:18', false, false, 0, 0, '2026-11-16 13:43:18', 'OLM', 0, 'LEGALIZACION GIRA ALTA Y BAJA VERAPAZ DEL 9 AL 13 NOVIEMBRE', 1, 7.7, 'V', null, null),
    (1, 9, 8, 2026, 11, 'VE2', '2026-11-09 07:55:48', false, false, 0, 0, '2026-11-09 07:55:48', 'VE2', 0, 'LIQUIDACION DE VIATICOS CON FECHA 02/11/2026 AL 06/11/2026 A LA GIRA COSTA CHICA', 1, 7.7, 'V', null, null)) as x(loc, caja, numero, anio, mes, usuario, f_crea, cuadrada, liquidada, anticipo, liquidacion, f_liq, usr_liq, adelanto, concepto, moneda_int, cambio, estado, usr_cierra, f_cierra) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    select id into v_caja from public.cajas_chicas where localidad_id = v_loc and codigo = r.caja;
    if v_caja is null then s_s := s_s + 1; continue; end if;
    insert into public.caja_periodos (caja_id, organizacion_id, localidad_id, numero, anio, mes, estado, tipo_cambio, valor, anticipo_valor, adelanto_valor, liquidacion_valor,
      usuario, liquidado_por, liquidado_en, origen_anterior, concepto, fecha_creacion_anterior, cuadrada, liquidada_anterior, fecha_liquidacion_anterior, usuario_liquida_anterior,
      moneda_integracion, valor_cambio_anterior, estado_anterior)
    values (v_caja, v_org, v_loc, r.numero, r.anio, r.mes, case when upper(r.estado::text) = 'C' then 'LIQUIDADA' else 'ABIERTA' end, 1,
      (select monto_fondo from public.cajas_chicas where id = v_caja), coalesce(r.anticipo, 0), coalesce(r.adelanto, 0), coalesce(r.liquidacion, 0),
      upper(coalesce(r.usuario::text, 'SISTEMA ANTERIOR')), case when upper(r.estado::text) = 'C' then upper(r.usr_cierra::text) end, case when upper(r.estado::text) = 'C' then r.f_cierra::timestamp::timestamptz end,
      'MIGRADO', nullif(trim(r.concepto::text), ''), r.f_crea::timestamp, r.cuadrada::boolean, r.liquidada::boolean, r.f_liq::timestamp, r.usr_liq::text,
      r.moneda_int::integer, r.cambio::numeric, r.estado::text)
    on conflict (caja_id, numero) do update set anio = excluded.anio, mes = excluded.mes, estado = excluded.estado, valor = excluded.valor, usuario = excluded.usuario,
      liquidado_por = excluded.liquidado_por, liquidado_en = excluded.liquidado_en, origen_anterior = 'MIGRADO', concepto = excluded.concepto,
      fecha_creacion_anterior = excluded.fecha_creacion_anterior, cuadrada = excluded.cuadrada, liquidada_anterior = excluded.liquidada_anterior,
      fecha_liquidacion_anterior = excluded.fecha_liquidacion_anterior, usuario_liquida_anterior = excluded.usuario_liquida_anterior,
      moneda_integracion = excluded.moneda_integracion, valor_cambio_anterior = excluded.valor_cambio_anterior, estado_anterior = excluded.estado_anterior
    returning (xmax = 0) into v_nuevo;
    if v_nuevo then s_n := s_n + 1; else s_a := s_a + 1; end if;
  end loop;
  alter table public.caja_periodos enable trigger caja_periodos_preparar;
  raise notice '%', format('Cajas: %s nuevas, %s actualizadas. Subcajas: %s nuevas, %s actualizadas, %s sin caja.', c_n, c_a, s_n, s_a, s_s);
end;
$migra$;

notify pgrst, 'reload schema';
