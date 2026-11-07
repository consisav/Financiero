-- Script 121 · parte 1 de 3: cajas y subcajas de la organización 3.
--   Ejecutar las 3 partes en orden en el SQL Editor de Supabase. Es el mismo script 121 partido y cada parte se puede ejecutar de nuevo.
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

  -- Cajas: el código de la caja se conserva en su localidad.
  for r in select * from (values
    (1, 1, 'GERENCIA ADMINISTRATIVA', 'KARLA RIOS', 'RAF', 4000, 1044, 'A', 'C', '2010101002', 1, 'KER', 'A', true),
    (1, 2, 'OPERACIONES', 'JOSE CHICOJ', 'FRA', 1000, 1044, 'A', 'C', '2010101002', 1, 'JAC', 'I', false),
    (1, 3, 'GERENCIA GENERAL', 'OSCAR MARTINEZ', 'ATZ', 0, 1044, 'A', 'C', '2010101002', 1, 'OLM', 'A', false),
    (1, 4, 'GERENCIA FINANCIERO', 'ANA VILLATORO', 'ATZ', 0, 1044, 'A', 'C', '2010101002', 1, 'AEV', 'A', false),
    (1, 5, 'VENTAS GIRA', 'EDGAR CHAN', 'LMI', 1600, 1044, 'A', 'C', '2010101002', 1, 'EDC', 'A', false),
    (1, 6, 'VENTAS GASOLINA', 'EDGAR CHAN', 'OLM', 0, 1044, 'A', 'C', '2010101002', 1, 'EDC', 'A', false),
    (1, 7, 'VENTAS GIRA', 'JONATHAN VASQUEZ', 'OLM', 2000, 1044, 'A', 'C', '2010101002', 1, 'VE1', 'V', true),
    (1, 8, 'VENTAS GASOLINA', 'JONATHAN VASQUEZ', 'OLM', 1000, 1044, 'A', 'C', '2010101002', 1, 'VE1', 'V', true),
    (1, 9, 'VENTAS GIRA', 'PILAR CASTILLO', 'OLM', 2000, 1044, 'A', 'C', '2010101002', 1, 'VE2', 'V', true),
    (1, 10, 'VENTAS GASOLINA', 'PILAR CASTILLO', 'OLM', 1000, 1044, 'A', 'C', '2010101002', 1, 'VE2', 'V', true),
    (2, 1, 'GERENCIA ADMINISTRATIVA', 'KARLA RIOS', 'LMI', 6000, 1020, 'A', 'C', '2010101002', 1, 'KER', 'A', false),
    (2, 2, 'OPERACIONES', 'JOSÉ CHICOJ', 'LMI', 2000, 1020, 'A', 'C', '2010101002', 1, 'JAC', 'I', false),
    (2, 3, 'GERENCIA GENERAL', 'OSCAR MARTINEZ', 'LMI', 0, 1020, 'A', 'C', '2010101002', 1, 'OLM', 'A', false),
    (2, 4, 'GERENCIA FINANCIERA', 'ANA VILLATORO', 'LMI', 0, 1020, 'A', 'C', '2010101002', 1, 'AEV', 'A', false),
    (2, 5, 'VENTAS GIRAS', 'MARIA DEL CARMEN', 'LMI', 2000, 1020, 'A', 'C', '2010101002', 1, 'AJA', 'A', false),
    (2, 6, 'VENTAS GASOLINA', 'MARIA DEL CARMEN', 'OLM', 1000, 1020, 'A', 'C', '2010101002', 1, 'AJA', 'A', false)) as x(loc, codigo, nombre, responsable, usuario, monto, transaccion, estado, tipo, cuenta, version, usuario_liquida, tipo_mov, carga) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    v_cta := null; v_tr := null;
    select k.id into v_cta from public.cuentas k join public.catalogos_cuentas g on g.id = k.catalogo_id
    where g.localidad_id = v_loc and k.codigo = r.cuenta order by (g.version = r.version) desc, g.activo desc, g.version desc limit 1;
    select id into v_tr from public.transacciones_contables where localidad_id = v_loc and numero = r.transaccion::integer;
    insert into public.cajas_chicas (organizacion_id, localidad_id, codigo, nombre, responsable, tipo_caja, modalidad, moneda_id, monto_fondo, cuenta_id, cuenta_caja_id, transaccion_id,
      usuario_liquida, carga_masiva, activa, origen_anterior, usuario_anterior, tipo_anterior, tipo_movimiento_anterior, version_cuenta_anterior)
    values (v_org, v_loc, r.codigo, r.nombre, r.responsable, 'CAJA CHICA', 'NORMAL', v_gtq, coalesce(r.monto, 0), v_cta, v_cta, v_tr,
      upper(r.usuario_liquida::text), coalesce(r.carga::boolean, false), upper(coalesce(r.estado::text, 'A')) = 'A', 'MIGRADO', r.usuario, r.tipo, r.tipo_mov, r.version)
    on conflict (localidad_id, codigo) do update set nombre = excluded.nombre, responsable = excluded.responsable, monto_fondo = excluded.monto_fondo,
      cuenta_id = coalesce(excluded.cuenta_id, cajas_chicas.cuenta_id), cuenta_caja_id = coalesce(excluded.cuenta_caja_id, cajas_chicas.cuenta_caja_id),
      transaccion_id = coalesce(excluded.transaccion_id, cajas_chicas.transaccion_id), usuario_liquida = excluded.usuario_liquida, carga_masiva = excluded.carga_masiva,
      activa = excluded.activa, origen_anterior = 'MIGRADO', usuario_anterior = excluded.usuario_anterior, tipo_anterior = excluded.tipo_anterior,
      tipo_movimiento_anterior = excluded.tipo_movimiento_anterior, version_cuenta_anterior = excluded.version_cuenta_anterior
    returning (xmax = 0) into v_nuevo;
    if v_nuevo then c_n := c_n + 1; else c_a := c_a + 1; end if;
    if v_cta is null then raise notice 'Caja % (3-0%): no existe la cuenta % en el catálogo.', r.codigo, r.loc, r.cuenta; end if;
  end loop;

  -- Subcajas: el número de la subcaja se conserva; la cerrada (C) queda liquidada en el sistema anterior, sin póliza.
  alter table public.caja_periodos disable trigger caja_periodos_preparar;
  for r in select * from (values
    (1, 1, 1, 2025, 7, 'KER', '2025-08-04 14:27:12', false, false, 0, 0, '2025-08-04 14:27:12', 'KER', 0, null, 1, 7.7, 'V', null, null),
    (1, 1, 2, 2025, 8, 'KER', '2025-08-18 14:45:02', false, false, 0, 0, '2025-08-18 14:45:02', 'KER', 0, null, 1, 7.7, 'V', null, null),
    (1, 1, 3, 2025, 9, 'KER', '2025-09-19 15:23:03', false, false, 0, 0, '2025-09-19 15:23:03', 'KER', 0, null, 1, 7.7, 'V', null, null),
    (1, 1, 4, 2025, 10, 'KER', '2025-10-21 09:24:11', false, false, 0, 0, '2025-10-21 09:24:11', 'KER', 0, null, 1, 7.7, 'V', null, null),
    (1, 1, 5, 2025, 10, 'KER', '2025-11-03 12:19:23', false, false, 0, 0, '2025-11-03 12:19:23', 'KER', 0, null, 1, 7.7, 'V', null, null),
    (1, 1, 6, 2025, 11, 'KER', '2025-11-19 14:27:41', false, false, 0, 0, '2025-11-19 14:27:41', 'KER', 0, null, 1, 7.7, 'V', null, null),
    (1, 1, 7, 2025, 11, 'KER', '2025-12-04 12:34:10', false, false, 0, 0, '2025-12-04 12:34:10', 'KER', 0, 'CAJA CHICA NOVIEMBRE 2025', 1, 7.7, 'V', null, null),
    (1, 1, 8, 2025, 12, 'KER', '2026-01-07 07:17:35', false, false, 0, 0, '2026-01-07 07:17:35', 'KER', 0, 'CAJA CHICA DICIEMBRE 2025', 1, 7.7, 'V', null, null),
    (1, 1, 9, 2026, 1, 'KER', '2026-01-29 16:15:38', false, false, 0, 0, '2026-01-29 16:15:38', 'KER', 0, 'CAJA CHICA 2026', 1, 7.7, 'V', null, null),
    (1, 1, 10, 2026, 2, 'KER', '2026-02-13 15:35:53', false, false, 0, 0, '2026-02-13 15:35:53', 'KER', 0, 'CAJA CHICA DE FEBRERO 2026', 1, 7.7, 'V', null, null),
    (1, 1, 11, 2026, 3, 'KER', '2026-03-13 15:23:17', false, false, 0, 0, '2026-03-13 15:23:17', 'KER', 0, 'CAJA CHICA MARZO 2026', 1, 7.7, 'V', null, null),
    (1, 1, 12, 2026, 4, 'KER', '2026-04-30 16:01:04', false, false, 0, 0, '2026-04-30 16:01:04', 'KER', 0, null, 1, 7.7, 'V', null, null),
    (1, 1, 13, 2026, 5, 'KER', '2026-05-15 15:35:08', false, false, 0, 0, '2026-05-15 15:35:08', 'KER', 0, 'CAJA CHICA MAYO 2026', 1, 7.7, 'V', null, null),
    (1, 1, 14, 2026, 6, 'KER', '2026-06-15 15:24:01', false, false, 0, 0, '2026-06-15 15:24:01', 'KER', 0, 'CAJA CHICA JUNIO 2026', 1, 7.7, 'V', null, null),
    (1, 1, 15, 2026, 7, 'KER', '2026-07-20 08:44:36', false, false, 0, 0, '2026-07-20 08:44:36', 'KER', 0, 'CAJA CHICA ADMINISTRATIVA', 1, 7.7, 'V', null, null),
    (1, 1, 16, 2026, 7, 'KER', '2026-07-20 08:47:06', false, false, 0, 0, '2026-07-20 08:47:06', 'KER', 0, 'CAJA CHICA TRANSPORTE', 1, 7.7, 'V', null, null),
    (1, 1, 17, 2026, 8, 'KER', '2026-08-25 09:01:05', false, false, 0, 0, '2026-08-25 09:01:05', 'KER', 0, 'CAJA CHICA ADMINISTRATIVA AGO 2026', 1, 7.7, 'V', null, null),
    (1, 1, 18, 2026, 8, 'KER', '2026-09-01 11:12:16', false, false, 0, 0, '2026-09-01 11:12:16', 'KER', 0, 'CAJA CHICA TRANSPORTE AGOSTO 2026', 1, 7.7, 'V', null, null),
    (1, 1, 19, 2026, 9, 'KER', '2026-09-14 14:41:27', false, false, 0, 0, '2026-09-14 14:41:27', 'KER', 0, 'CAJA CHICA ADMINISTRATIVA 2026', 1, 7.7, 'V', null, null),
    (1, 1, 20, 2026, 9, 'KER', '2026-10-02 11:26:29', false, false, 0, 0, '2026-10-02 11:26:29', 'KER', 0, 'CAJA CHICA DE TRANSPORTE SEPTIEMBRE 2026', 1, 7.7, 'V', null, null),
    (1, 1, 21, 2026, 10, 'KER', '2026-10-30 14:35:11', false, false, 0, 0, '2026-10-30 14:35:11', 'KER', 0, 'CAJA CHICA ADMINISTRATIVA OCTUBRE 2026', 1, 7.7, 'V', null, null),
    (1, 1, 22, 2026, 10, 'KER', '2026-10-30 14:35:31', false, false, 0, 0, '2026-10-30 14:35:31', 'KER', 0, 'CAJA CHICA TRANSPORTE OCTUBRE 2026', 1, 7.7, 'V', null, null),
    (1, 2, 1, 2023, 10, 'FRA', '2023-11-10 08:40:20', false, false, 0, 0, '2023-11-10 08:40:20', 'FRA', 0, null, 1, 7.7, 'V', null, null),
    (1, 2, 2, 2024, 5, 'LMI', '2025-05-28 10:01:06', false, false, 0, 0, '2025-05-28 10:01:06', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (1, 2, 3, 2025, 8, 'JAC', '2025-08-18 12:08:00', false, false, 0, 0, '2025-08-18 12:08:00', 'JAC', 0, null, 1, 7.7, 'V', null, null),
    (1, 2, 4, 2025, 8, 'JAC', '2025-08-18 15:46:34', false, false, 0, 0, '2025-08-18 15:46:34', 'JAC', 0, null, 1, 7.7, 'V', null, null),
    (1, 2, 5, 2025, 8, 'JAC', '2025-08-18 15:50:24', false, false, 0, 0, '2025-08-18 15:50:24', 'JAC', 0, 'TRAQNSPORTE DE PAQUETERIA  DEL 01/08/25 AL 31/08/2025', 1, 7.7, 'V', null, null),
    (1, 2, 6, 2025, 9, 'JAC', '2025-10-08 11:18:48', false, false, 0, 0, '2025-10-08 11:18:48', 'JAC', 0, null, 1, 7.7, 'V', null, null),
    (1, 3, 1, 2025, 4, 'OLM', '2025-05-29 14:04:58', false, false, 0, 0, '2025-05-29 14:04:58', 'OLM', 0, null, 1, 7.7, 'V', null, null),
    (1, 3, 2, 2025, 5, 'OLM', '2025-05-29 20:04:53', false, false, 0, 0, '2025-05-29 20:04:53', 'OLM', 0, null, 1, 7.7, 'V', null, null),
    (1, 3, 3, 2025, 6, 'OLM', '2025-07-30 11:57:06', false, false, 0, 0, '2025-07-30 11:57:06', 'OLM', 0, null, 1, 7.7, 'V', null, null),
    (1, 3, 4, 2025, 7, 'OLM', '2025-08-02 11:46:13', false, false, 0, 0, '2025-08-02 11:46:13', 'OLM', 0, null, 1, 7.7, 'V', null, null),
    (1, 3, 5, 2025, 8, 'OLM', '2025-08-18 15:11:18', false, false, 0, 0, '2025-08-18 15:11:18', 'OLM', 0, 'GIRA RETALHULEU DEL 11 AL 17 AGOSTO 2,025', 1, 7.7, 'V', null, null),
    (1, 3, 6, 2025, 8, 'OLM', '2025-09-10 18:48:22', false, false, 0, 0, '2025-09-10 18:48:22', 'OLM', 0, 'GASTOS AGOSTO GG', 1, 7.7, 'V', null, null),
    (1, 3, 7, 2025, 9, 'OLM', '2025-09-14 14:00:50', false, false, 0, 0, '2025-09-14 14:00:50', 'OLM', 0, 'CUENTA GASTOS 1 GG SEPTIEMBRE', 1, 7.7, 'V', null, null),
    (1, 3, 8, 2025, 9, 'OLM', '2025-10-08 14:10:32', false, false, 0, 0, '2025-10-08 14:10:32', 'OLM', 0, 'CUENTA GASTOS 2 GG SEPTIEMBRE', 1, 7.7, 'V', null, null),
    (1, 3, 9, 2025, 9, 'OLM', '2025-10-08 15:40:01', false, false, 0, 0, '2025-10-08 15:40:01', 'OLM', 0, 'GASTOS GIRA SAN MARCOS DEL 22 AL 25 SEPT', 1, 7.7, 'V', null, null),
    (1, 3, 10, 2025, 10, 'OLM', '2025-10-31 15:54:25', false, false, 0, 0, '2025-10-31 15:54:25', 'OLM', 0, null, 1, 7.7, 'V', null, null),
    (1, 3, 11, 2025, 11, 'OLM', '2025-11-21 19:19:10', false, false, 0, 0, '2025-11-21 19:19:10', 'OLM', 0, 'CUENTA GASTOS GG NOVIEMBRE', 1, 7.7, 'V', null, null),
    (1, 3, 12, 2025, 12, 'OLM', '2026-01-06 13:03:07', false, false, 0, 0, '2026-01-06 13:03:07', 'OLM', 0, 'CUENTA GASTOS DICIEMBRE GG', 1, 7.7, 'V', null, null),
    (1, 3, 13, 2026, 1, 'OLM', '2026-02-11 16:54:55', false, false, 0, 0, '2026-02-11 16:54:55', 'OLM', 0, 'CUENTA GASTOS GG ENERO26', 1, 7.7, 'V', null, null),
    (1, 3, 14, 2026, 2, 'OLM', '2026-03-18 13:26:41', false, false, 0, 0, '2026-03-18 13:26:41', 'OLM', 0, 'CUENTA GASTOS FEB26 GG', 1, 7.7, 'V', null, null),
    (1, 3, 15, 2026, 3, 'OLM', '2026-04-13 14:29:59', false, false, 0, 0, '2026-04-13 14:29:59', 'OLM', 0, 'CUENTA GASTOS GG MARZO 26', 1, 7.7, 'V', null, null),
    (1, 3, 16, 2026, 6, 'OLM', '2026-07-10 15:55:39', false, false, 0, 0, '2026-07-10 15:55:39', 'OLM', 0, 'CUENTA GASTOS GG JUNIO 2026', 1, 7.7, 'V', null, null),
    (1, 3, 17, 2026, 7, 'OLM', '2026-08-12 12:41:55', false, false, 0, 0, '2026-08-12 12:41:55', 'OLM', 0, 'CUENTA GASTOS GG 2026', 1, 7.7, 'V', null, null),
    (1, 3, 18, 2026, 8, 'OLM', '2026-09-06 17:34:25', false, false, 0, 0, '2026-09-06 17:34:25', 'OLM', 0, 'CUENTA GASTOS AGO26 GG', 1, 7.7, 'V', null, null),
    (1, 4, 1, 2025, 10, 'LMI', '2024-11-29 12:43:09', false, false, 0, 0, '2024-11-29 12:43:09', 'LMI', 0, 'GASTOS REPRESENTACION OCTUBRE', 1, 7.7, 'V', null, null),
    (1, 4, 3, 2025, 9, 'LMI', '2024-11-29 12:44:53', false, false, 0, 0, '2024-11-29 12:44:53', 'LMI', 0, 'GASTOS VARIOS INTERESES SEPTIEMBRE', 1, 7.7, 'V', null, null),
    (1, 4, 4, 2025, 8, 'AEV', '2025-09-01 15:13:04', false, false, 0, 0, '2025-09-01 15:13:04', 'AEV', 0, 'GASTOS VARIOS JUN-JUL (INTERESES PTMO)', 1, 7.7, 'V', null, null),
    (1, 4, 5, 2025, 8, 'AEV', '2025-09-01 16:02:04', false, false, 0, 0, '2025-09-01 16:02:04', 'AEV', 0, 'GASTOS REPRESENTACIÓN JULIO', 1, 7.7, 'V', null, null),
    (1, 4, 6, 2025, 11, 'AEV', '2025-12-04 13:56:51', false, false, 0, 0, '2025-12-04 13:56:51', 'AEV', 0, 'GASTOS REPRESENTACION', 1, 7.7, 'V', null, null),
    (1, 4, 7, 2025, 12, 'AEV', '2026-01-06 13:10:36', false, false, 0, 0, '2026-01-06 13:10:36', 'AEV', 0, 'GASTOS REPRESENTACIÓN DICIEMBRE', 1, 7.7, 'V', null, null),
    (1, 4, 8, 2025, 12, 'AEV', '2026-01-07 12:48:07', false, false, 0, 0, '2026-01-07 12:48:07', 'AEV', 0, 'GASTOS VARIOS INTERESES', 1, 7.7, 'V', null, null),
    (1, 4, 9, 2026, 1, 'AEV', '2026-01-28 16:08:52', false, false, 0, 0, '2026-01-28 16:08:52', 'AEV', 0, 'GASTOS VARIOS INTERESES', 1, 7.7, 'V', null, null),
    (1, 4, 10, 2026, 2, 'AEV', '2026-02-11 16:21:24', false, false, 0, 0, '2026-02-11 16:21:24', 'AEV', 0, 'GASTOS VARIOS PTMO', 1, 7.7, 'V', null, null),
    (1, 4, 11, 2026, 3, 'AEV', '2026-03-04 13:02:40', false, false, 0, 0, '2026-03-04 13:02:40', 'AEV', 0, null, 1, 7.7, 'V', null, null),
    (1, 4, 12, 2026, 2, 'AEV', '2026-03-04 13:02:53', false, false, 0, 0, '2026-03-04 13:02:53', 'AEV', 0, 'GASTOS DE REPRESENTACION FEBRERO', 1, 7.7, 'V', null, null),
    (1, 7, 1, 2026, 8, 'VE1', '2026-08-17 08:43:02', false, false, 0, 0, '2026-08-17 08:43:02', 'VE1', 0, 'LIQUIDACION GIRA BAJA VERAPAZ DEL 10 AL 14 DE AGOSTO 2026', 1, 7.7, 'V', null, null),
    (1, 7, 2, 2026, 8, 'VE1', '2026-08-31 08:25:25', false, false, 0, 0, '2026-08-31 08:25:25', 'VE1', 0, 'VAITCOS DE LA SEMANA DEL 24 AL 28 DE AGOSTO', 1, 7.7, 'V', null, null),
    (1, 7, 3, 2026, 9, 'VE1', '2026-09-18 09:34:12', false, false, 0, 0, '2026-09-18 09:34:12', 'VE1', 0, 'LEGALIZACION DE VIATICOS REU Y MALACATAN DEL 07 AL 11 DE SEPTIEMBRE', 1, 7.7, 'C', 'VE1', '2026-09-28 08:15:11'),
    (1, 7, 4, 2026, 9, 'VE1', '2026-09-28 08:41:54', false, false, 0, 0, '2026-09-28 08:41:54', 'VE1', 0, 'LIQUIDACION RUTA IZABAL DEL 21 AL 25 DE SEPTIEMBRE', 1, 7.7, 'C', 'VE1', '2026-09-28 08:58:40'),
    (1, 7, 5, 2026, 10, 'VE1', '2026-10-12 08:25:57', false, false, 0, 0, '2026-10-12 08:25:57', 'VE1', 0, 'LEGALIZACION GIRA 5 AL 9 DE OCTUBRE ALTA Y BAJA VERAPAZ', 1, 7.7, 'V', null, null),
    (1, 7, 6, 2026, 10, 'VE1', '2026-11-02 07:53:53', false, false, 0, 0, '2026-11-02 07:53:53', 'VE1', 0, 'LIQUIDACION DE GASTOS DE LA GIRA DEL 26 AL 30 DE OCTUBRE 2026', 1, 7.7, 'V', null, null),
    (1, 7, 7, 2026, 10, 'OLM', '2026-11-02 10:37:23', false, false, 0, 0, '2026-11-02 10:37:23', 'OLM', 0, 'LEGALIZACION GIRA COSTA GRANDE DEL 19 AL 23 DE OCTUBRE', 1, 7.7, 'V', null, null),
    (1, 8, 1, 2026, 9, 'VE1', '2026-09-05 11:41:55', false, false, 0, 0, '2026-09-05 11:41:55', 'VE1', 0, 'AUXILO GASOLINA MES DE AGOSTO', 1, 7.7, 'C', 'VE1', '2026-09-28 08:11:42'),
    (1, 8, 2, 2026, 9, 'VE1', '2026-10-03 12:17:32', false, false, 0, 0, '2026-10-03 12:17:32', 'VE1', 0, 'AUXILIO GASOLINA MES DE SEPTIEMBRE 12 DIAS', 1, 7.7, 'V', null, null),
    (1, 8, 3, 2026, 10, 'VE1', '2026-11-02 08:20:04', false, false, 0, 0, '2026-11-02 08:20:04', 'VE1', 0, 'LEGALIZACION GASOLINA MES DE OCTUBRE', 1, 7.7, 'V', null, null),
    (1, 9, 1, 2026, 8, 'VE2', '2026-08-17 09:17:22', false, false, 0, 0, '2026-08-17 09:17:22', 'VE2', 0, 'LIQUIDACION GIRA COSTA CHICA DEL 10 AL 14 AGOSTO 2026', 1, 7.7, 'V', null, null),
    (1, 9, 2, 2026, 8, 'VE2', '2026-08-31 09:43:58', false, false, 0, 0, '2026-08-31 09:43:58', 'VE2', 0, 'LIQUIDACION DE GIRA MAZATENANGO REU FECHA 24 AL 28 AGOSTO', 1, 7.7, 'V', null, null),
    (1, 9, 3, 2026, 9, 'VE2', '2026-09-18 09:17:15', false, false, 0, 0, '2026-09-18 09:17:15', 'VE2', 0, 'LEGALIZACION GASTOS GIRA COSTA CHICA DEL 07 AL 11 SEPTIEMBRE', 1, 7.7, 'V', null, null),
    (1, 9, 4, 2026, 9, 'VE2', '2026-09-28 08:35:11', false, false, 0, 0, '2026-09-28 08:35:11', 'VE2', 0, 'LIQUIDACIION DE GIRA MAZATENANGO 21 AL 25', 1, 7.7, 'C', 'VE2', '2026-09-28 09:06:34'),
    (1, 9, 5, 2026, 10, 'VE2', '2026-10-12 07:42:50', false, false, 0, 0, '2026-10-12 07:42:50', 'VE2', 0, 'LIQUIDACION DE VIATICOS DE COSTA CHICA 05/10 AL 09/10/2026', 1, 7.7, 'V', null, null),
    (1, 9, 6, 2026, 10, 'VE2', '2026-11-02 08:10:40', false, false, 0, 0, '2026-11-02 08:10:40', 'VE2', 0, 'LIQUIDACION DE VIATICOS GIRA DEL 26 AL 30 OCTUBRE ESCUINTLA PEDRO DE ALVARADO', 1, 7.7, 'V', null, null),
    (1, 9, 7, 2026, 10, 'VE2', '2026-11-02 10:12:19', false, false, 0, 0, '2026-11-02 10:12:19', 'VE2', 0, 'LEGALIZACION VIATICOS GIRA MAZATENANGO DEL 19 AL 23 OCTUBRE', 1, 7.7, 'V', null, null),
    (1, 10, 1, 2026, 8, 'VE2', '2026-09-05 12:03:06', false, false, 0, 0, '2026-09-05 12:03:06', 'VE2', 0, 'AUXILIO GASOLINA AGOSTO', 1, 7.7, 'V', null, null),
    (1, 10, 2, 2026, 8, 'VE2', '2026-09-05 12:03:56', false, false, 0, 0, '2026-09-05 12:03:56', 'VE2', 0, 'LIQUIDACION DE GIRA MAZATENANGO 21 AL 25 SEPTIEMBRE', 1, 7.7, 'V', null, null),
    (1, 10, 3, 2026, 9, 'VE2', '2026-10-03 12:38:04', false, false, 0, 0, '2026-10-03 12:38:04', 'VE2', 0, 'AUXILIO GASOLINA 12 DIAS DE SEPTIEMBRE', 1, 7.7, 'C', 'VE2', '2026-11-02 08:32:39'),
    (1, 10, 4, 2026, 10, 'VE2', '2026-11-02 08:33:18', false, false, 0, 0, '2026-11-02 08:33:18', 'VE2', 0, 'LEGALIZACION GASOLINA MES DE OCTUBRE', 1, 7.7, 'V', null, null),
    (2, 1, 1, 2024, 1, 'LMI', '2025-04-21 10:26:53', false, false, 0, 0, '2025-04-21 10:26:53', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 2, 2025, 4, 'LMI', '2025-04-28 12:43:33', false, false, 0, 0, '2025-04-28 12:43:33', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 3, 2024, 2, 'LMI', '2025-05-15 15:45:10', false, false, 0, 0, '2025-05-15 15:45:10', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 4, 2024, 2, 'LMI', '2025-05-19 09:34:34', false, false, 0, 0, '2025-05-19 09:34:34', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 5, 2024, 4, 'LMI', '2025-05-26 08:03:13', false, false, 0, 0, '2025-05-26 08:03:13', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 6, 2024, 4, 'LMI', '2025-05-26 09:48:04', false, false, 0, 0, '2025-05-26 09:48:04', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 7, 2024, 5, 'LMI', '2025-05-27 08:37:53', false, false, 0, 0, '2025-05-27 08:37:53', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 8, 2024, 6, 'LMI', '2025-05-28 14:26:07', false, false, 0, 0, '2025-05-28 14:26:07', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 9, 2024, 7, 'LMI', '2025-05-29 10:36:25', false, false, 0, 0, '2025-05-29 10:36:25', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 10, 2024, 7, 'LMI', '2025-05-29 11:33:23', false, false, 0, 0, '2025-05-29 11:33:23', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 11, 2024, 6, 'LMI', '2025-05-29 11:53:41', false, false, 0, 0, '2025-05-29 11:53:41', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 12, 2025, 8, 'KER', '2025-08-08 13:03:55', false, false, 0, 0, '2025-08-08 13:03:55', 'KER', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 13, 2025, 8, 'KER', '2025-08-18 15:42:33', false, false, 0, 0, '2025-08-18 15:42:33', 'KER', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 14, 2025, 9, 'KER', '2025-09-19 15:04:38', false, false, 0, 0, '2025-09-19 15:04:38', 'KER', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 15, 2025, 10, 'KER', '2025-10-21 15:19:42', false, false, 0, 0, '2025-10-21 15:19:42', 'KER', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 16, 2025, 10, 'KER', '2025-11-03 11:27:32', false, false, 0, 0, '2025-11-03 11:27:32', 'KER', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 17, 2025, 11, 'KER', '2025-11-18 11:32:06', false, false, 0, 0, '2025-11-18 11:32:06', 'KER', 0, null, 1, 7.7, 'V', null, null),
    (2, 1, 18, 2025, 12, 'KER', '2025-12-02 08:39:08', false, false, 0, 0, '2025-12-02 08:39:08', 'KER', 0, 'CAJA CHICA DICIEMBRE 2025', 1, 7.7, 'V', null, null),
    (2, 1, 19, 2025, 11, 'KER', '2025-12-02 08:40:19', false, false, 0, 0, '2025-12-02 08:40:19', 'KER', 0, 'CAJA CHICA NOVIEMBRE 2025', 1, 7.7, 'V', null, null),
    (2, 1, 20, 2026, 1, 'KER', '2026-01-29 09:54:32', false, false, 0, 0, '2026-01-29 09:54:32', 'KER', 0, 'CAJA CHICA ENERO 2026', 1, 7.7, 'V', null, null),
    (2, 1, 21, 2026, 3, 'KER', '2026-03-04 11:15:07', false, false, 0, 0, '2026-03-04 11:15:07', 'KER', 0, 'CAJA CHICA FEBRERO 2026', 1, 7.7, 'V', null, null),
    (2, 1, 22, 2026, 3, 'KER', '2026-03-27 09:29:59', false, false, 0, 0, '2026-03-27 09:29:59', 'KER', 0, 'CAJA CHICA MARZO 2026', 1, 7.7, 'V', null, null),
    (2, 1, 23, 2026, 3, 'KER', '2026-04-24 14:28:15', false, false, 0, 0, '2026-04-24 14:28:15', 'KER', 0, 'MARZO CAJA CHICA II', 1, 7.7, 'V', null, null),
    (2, 1, 24, 2026, 4, 'KER', '2026-04-24 15:34:52', false, false, 0, 0, '2026-04-24 15:34:52', 'KER', 0, 'CAJA CHICA ABRIL 2026', 1, 7.7, 'V', null, null),
    (2, 1, 25, 2026, 5, 'KER', '2026-06-01 14:09:16', false, false, 0, 0, '2026-06-01 14:09:16', 'KER', 0, 'CAJA CHICA MAYO 2026', 1, 7.7, 'V', null, null),
    (2, 1, 26, 2026, 6, 'KER', '2026-06-19 09:48:15', false, false, 0, 0, '2026-06-19 09:48:15', 'KER', 0, 'CAJA CHICA JUNIO 2026', 1, 7.7, 'V', null, null),
    (2, 1, 27, 2026, 7, 'KER', '2026-07-31 08:44:38', false, false, 0, 0, '2026-07-31 08:44:38', 'KER', 0, 'CAJA CHICA TRANSPORTE 2026 JULIO', 1, 7.7, 'V', null, null),
    (2, 1, 28, 2026, 7, 'KER', '2026-07-31 08:44:55', false, false, 0, 0, '2026-07-31 08:44:55', 'KER', 0, 'CAJA CHICA ADMINISTRACION', 1, 7.7, 'V', null, null),
    (2, 1, 29, 2026, 7, 'KER', '2026-08-31 11:49:30', false, false, 0, 0, '2026-08-31 11:49:30', 'KER', 0, 'CAJA CHICA TRANSPORTE 2026 JULIO', 1, 7.7, 'V', null, null),
    (2, 1, 30, 2026, 8, 'KER', '2026-09-04 11:30:06', false, false, 0, 0, '2026-09-04 11:30:06', 'KER', 0, 'CAJA CHICA ADMINISTRATIVA AGOSTO 2026', 1, 7.7, 'V', null, null),
    (2, 1, 31, 2026, 8, 'KER', '2026-09-04 12:39:35', false, false, 0, 0, '2026-09-04 12:39:35', 'KER', 0, 'CAJA CHICA TRANSPORTE AGOSTO 2026', 1, 7.7, 'V', null, null),
    (2, 1, 32, 2026, 9, 'KER', '2026-09-29 09:51:39', false, false, 0, 0, '2026-09-29 09:51:39', 'KER', 0, 'CAJA CHICA DE TRANSPORTE SEPTIEMBRE 2026', 1, 7.7, 'V', null, null),
    (2, 1, 33, 2026, 9, 'KER', '2026-09-29 12:52:23', false, false, 0, 0, '2026-09-29 12:52:23', 'KER', 0, 'CAJA CHICA ADMINISTRATIVA SEPTIEMBRE 2026', 1, 7.7, 'V', null, null),
    (2, 2, 1, 2024, 1, 'LMI', '2025-04-08 14:42:07', false, false, 0, 0, '2025-04-08 14:42:07', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 2, 2, 2024, 1, 'LMI', '2025-04-10 11:14:25', false, false, 0, 0, '2025-04-10 11:14:25', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 2, 3, 2024, 2, 'LMI', '2025-05-09 12:30:09', false, false, 0, 0, '2025-05-09 12:30:09', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 2, 4, 2024, 3, 'LMI', '2025-05-20 08:04:21', false, false, 0, 0, '2025-05-20 08:04:21', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 2, 5, 2024, 3, 'LMI', '2025-05-20 10:54:58', false, false, 0, 0, '2025-05-20 10:54:58', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 2, 6, 2024, 4, 'LMI', '2025-05-26 11:17:05', false, false, 0, 0, '2025-05-26 11:17:05', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 2, 7, 2024, 5, 'LMI', '2025-05-26 12:48:15', false, false, 0, 0, '2025-05-26 12:48:15', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 2, 8, 2024, 5, 'LMI', '2025-05-27 14:21:02', false, false, 0, 0, '2025-05-27 14:21:02', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 2, 9, 2024, 5, 'LMI', '2025-05-27 15:35:44', false, false, 0, 0, '2025-05-27 15:35:44', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 2, 10, 2024, 7, 'LMI', '2025-05-29 09:10:17', false, false, 0, 0, '2025-05-29 09:10:17', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 2, 15, 2025, 8, 'JAC', '2025-08-19 07:34:33', false, false, 0, 0, '2025-08-19 07:34:33', 'JAC', 0, 'GASTOS TRANSPORTE PAQUETERIA DEL 1/8/2025 AL 17/08/2025', 1, 7.7, 'V', null, null),
    (2, 2, 16, 2025, 8, 'JAC', '2025-09-01 15:49:28', false, false, 0, 0, '2025-09-01 15:49:28', 'JAC', 0, 'TRANSPORTE DE PAQUETERIA 18/8/25 AL 31/8/25', 1, 7.7, 'V', null, null),
    (2, 2, 17, 2025, 9, 'JAC', '2025-09-19 11:14:46', false, false, 0, 0, '2025-09-19 11:14:46', 'JAC', 0, null, 1, 7.7, 'V', null, null),
    (2, 2, 18, 2025, 9, 'JAC', '2025-10-08 10:52:44', false, false, 0, 0, '2025-10-08 10:52:44', 'JAC', 0, null, 1, 7.7, 'V', null, null),
    (2, 3, 1, 2024, 1, 'LMI', '2025-04-04 15:01:05', false, false, 0, 0, '2025-04-04 15:01:05', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 3, 2, 2024, 2, 'LMI', '2025-05-09 15:40:05', false, false, 0, 0, '2025-05-09 15:40:05', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 3, 3, 2024, 2, 'LMI', '2025-05-13 11:43:41', false, false, 0, 0, '2025-05-13 11:43:41', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 3, 4, 2024, 2, 'LMI', '2025-05-13 11:51:27', false, false, 0, 0, '2025-05-13 11:51:27', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 3, 5, 2024, 2, 'LMI', '2025-05-13 14:08:55', false, false, 0, 0, '2025-05-13 14:08:55', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 3, 6, 2024, 3, 'LMI', '2025-05-20 09:57:21', false, false, 0, 0, '2025-05-20 09:57:21', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 3, 7, 2024, 4, 'LMI', '2025-05-26 11:49:37', false, false, 0, 0, '2025-05-26 11:49:37', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 3, 8, 2024, 3, 'LMI', '2025-05-30 09:53:49', false, false, 0, 0, '2025-05-30 09:53:49', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 3, 9, 2024, 4, 'LMI', '2025-06-04 11:45:28', false, false, 0, 0, '2025-06-04 11:45:28', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 3, 10, 2024, 4, 'LMI', '2025-06-05 09:37:00', false, false, 0, 0, '2025-06-05 09:37:00', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 3, 11, 2024, 5, 'LMI', '2025-06-05 12:59:03', false, false, 0, 0, '2025-06-05 12:59:03', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 3, 12, 2024, 5, 'LMI', '2025-06-05 13:53:57', false, false, 0, 0, '2025-06-05 13:53:57', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 3, 13, 2024, 5, 'LMI', '2025-06-05 14:42:12', false, false, 0, 0, '2025-06-05 14:42:12', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 3, 14, 2024, 6, 'LMI', '2025-06-06 11:25:51', false, false, 0, 0, '2025-06-06 11:25:51', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 3, 15, 2025, 4, 'OLM', '2025-07-29 16:05:15', false, false, 0, 0, '2025-07-29 16:05:15', 'OLM', 0, null, 1, 7.7, 'V', null, null),
    (2, 3, 16, 2025, 12, 'OLM', '2025-12-17 13:26:00', false, false, 0, 0, '2025-12-17 13:26:00', 'OLM', 0, 'PAGO SEGURO VEHICULOS', 1, 7.7, 'V', null, null),
    (2, 3, 17, 2026, 2, 'OLM', '2026-03-17 11:31:04', false, false, 0, 0, '2026-03-17 11:31:04', 'OLM', 0, 'CUENTA GASTOS FEB GG', 1, 7.7, 'V', null, null),
    (2, 3, 18, 2026, 3, 'OLM', '2026-04-13 15:01:01', false, false, 0, 0, '2026-04-13 15:01:01', 'OLM', 0, 'CUENTA GASTOS GG', 1, 7.7, 'V', null, null),
    (2, 3, 19, 2026, 4, 'OLM', '2026-05-18 10:33:11', false, false, 0, 0, '2026-05-18 10:33:11', 'OLM', 0, 'CUENTA GASTOS GG ABR-26', 1, 7.7, 'V', null, null),
    (2, 3, 20, 2026, 5, 'OLM', '2026-06-14 17:09:20', false, false, 0, 0, '2026-06-14 17:09:20', 'OLM', 0, 'CUENTA GASTOS GG MAYO26', 1, 7.7, 'V', null, null),
    (2, 3, 21, 2026, 6, 'OLM', '2026-07-31 10:29:17', false, false, 0, 0, '2026-07-31 10:29:17', 'OLM', 0, 'CUENTA GASTOS JUNIO26 GG', 1, 7.7, 'V', null, null),
    (2, 3, 22, 2026, 7, 'OLM', '2026-08-24 15:15:21', false, false, 0, 0, '2026-08-24 15:15:21', 'OLM', 0, 'CUENTA GASTOS JUL26 GG', 1, 7.7, 'V', null, null),
    (2, 3, 23, 2026, 8, 'OLM', '2026-08-24 15:15:22', false, false, 0, 0, '2026-08-24 15:15:22', 'OLM', 0, 'CUENTA GASTOS GG AGOSTO 26', 1, 7.7, 'V', null, null),
    (2, 3, 24, 2026, 9, 'OLM', '2026-10-05 18:35:44', false, false, 0, 0, '2026-10-05 18:35:44', 'OLM', 0, 'CUENTA GASTOS GG SEP-26', 1, 7.7, 'V', null, null),
    (2, 4, 1, 2024, 1, 'LMI', '2025-04-11 14:28:51', false, false, 0, 0, '2025-04-11 14:28:51', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 4, 2, 2024, 2, 'LMI', '2025-05-12 08:16:03', false, false, 0, 0, '2025-05-12 08:16:03', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 4, 3, 2024, 2, 'LMI', '2025-05-12 10:27:04', false, false, 0, 0, '2025-05-12 10:27:04', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 4, 4, 2024, 3, 'LMI', '2025-05-30 09:37:54', false, false, 0, 0, '2025-05-30 09:37:54', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 4, 5, 2024, 3, 'LMI', '2025-05-30 09:42:32', false, false, 0, 0, '2025-05-30 09:42:32', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 4, 6, 2024, 4, 'LMI', '2025-06-02 14:29:01', false, false, 0, 0, '2025-06-02 14:29:01', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 4, 7, 2026, 4, 'LMI', '2025-06-05 08:04:07', false, false, 0, 0, '2025-06-05 08:04:07', 'LMI', 0, 'GASTOS VARIOS INTERESES PTMO', 1, 7.7, 'V', null, null),
    (2, 4, 8, 2024, 5, 'LMI', '2025-06-05 10:17:28', false, false, 0, 0, '2025-06-05 10:17:28', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 4, 9, 2024, 5, 'LMI', '2025-06-05 10:44:33', false, false, 0, 0, '2025-06-05 10:44:33', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 4, 10, 2026, 3, 'LMI', '2025-06-06 14:47:37', false, false, 0, 0, '2025-06-06 14:47:37', 'LMI', 0, 'GASTOS DE REPRESENTACION MARZO', 1, 7.7, 'V', null, null),
    (2, 4, 11, 2026, 3, 'AEV', '2026-03-27 15:15:18', false, false, 0, 0, '2026-03-27 15:15:18', 'AEV', 0, 'GASTOS VARIOS INTERESES', 1, 7.7, 'V', null, null),
    (2, 4, 12, 2026, 4, 'AEV', '2026-04-08 14:15:06', false, false, 0, 0, '2026-04-08 14:15:06', 'AEV', 0, 'GASTOS REPRESENTACION MARZO', 1, 7.7, 'V', null, null),
    (2, 4, 13, 2026, 5, 'AEV', '2026-05-27 16:24:43', false, false, 0, 0, '2026-05-27 16:24:43', 'AEV', 0, 'GASTOS VARIOS INTERESES', 1, 7.7, 'V', null, null),
    (2, 4, 14, 2026, 5, 'AEV', '2026-05-28 14:06:58', false, false, 0, 0, '2026-05-28 14:06:58', 'AEV', 0, 'GASTOS DE REPRESENTACION ABRIL', 1, 7.7, 'V', null, null),
    (2, 4, 15, 2026, 6, 'AEV', '2026-07-01 16:16:58', false, false, 0, 0, '2026-07-01 16:16:58', 'AEV', 0, 'GASTOS DE REPRESENTACIÓN MAYO', 1, 7.7, 'V', null, null),
    (2, 4, 16, 2026, 6, 'AEV', '2026-07-03 14:42:41', false, false, 0, 0, '2026-07-03 14:42:41', 'AEV', 0, 'GASTOS VARIOS INTERESES MAYO', 1, 7.7, 'V', null, null),
    (2, 4, 17, 2026, 7, 'AEV', '2026-07-24 13:01:02', false, false, 0, 0, '2026-07-24 13:01:02', 'AEV', 0, 'GASTOS REPRESENTACION JUNIO', 1, 7.7, 'V', null, null),
    (2, 4, 18, 2026, 7, 'AEV', '2026-07-24 13:48:10', false, false, 0, 0, '2026-07-24 13:48:10', 'AEV', 0, 'GASTOS VARIOS INTERESES JUNIO', 1, 7.7, 'V', null, null),
    (2, 4, 19, 2026, 8, 'AEV', '2026-08-21 12:40:13', false, false, 0, 0, '2026-08-21 12:40:13', 'AEV', 0, 'GASTOS REPRESENTACIÓN JULIO', 1, 7.7, 'V', null, null),
    (2, 4, 20, 2026, 8, 'AEV', '2026-08-31 15:52:17', false, false, 0, 0, '2026-08-31 15:52:17', 'AEV', 0, 'INTERESES JULIO- GASTOS VARIOS', 1, 7.7, 'V', null, null),
    (2, 4, 21, 2026, 9, 'AEV', '2026-10-06 11:50:31', false, false, 0, 0, '2026-10-06 11:50:31', 'AEV', 0, 'GASTOS VARIOS SEPTIEMBRE', 1, 7.7, 'V', null, null),
    (2, 4, 22, 2026, 9, 'AEV', '2026-10-06 12:18:54', false, false, 0, 0, '2026-10-06 12:18:54', 'AEV', 0, 'GASTOS REPRESENTACIÓN', 1, 7.7, 'V', null, null),
    (2, 4, 23, 2026, 10, 'AEV', '2026-10-27 13:19:48', false, false, 0, 0, '2026-10-27 13:19:48', 'AEV', 0, 'GASTOS REPRESENTACIÓN SEPTIEMBRE', 1, 7.7, 'V', null, null),
    (2, 4, 24, 2026, 10, 'AEV', '2026-10-28 15:37:08', false, false, 0, 0, '2026-10-28 15:37:08', 'AEV', 0, 'GASTOS VARIOS- INTERES SEPTIEMBRE', 1, 7.7, 'V', null, null),
    (2, 5, 1, 2024, 1, 'LMI', '2025-04-21 13:50:06', false, false, 0, 0, '2025-04-21 13:50:06', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 2, 2024, 1, 'LMI', '2025-04-21 15:53:38', false, false, 0, 0, '2025-04-21 15:53:38', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 3, 2024, 1, 'LMI', '2025-04-23 07:29:33', false, false, 0, 0, '2025-04-23 07:29:33', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 4, 2024, 2, 'LMI', '2025-05-15 10:18:12', false, false, 0, 0, '2025-05-15 10:18:12', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 5, 2024, 2, 'LMI', '2025-05-15 10:39:05', false, false, 0, 0, '2025-05-15 10:39:05', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 6, 2024, 2, 'LMI', '2025-05-15 11:39:43', false, false, 0, 0, '2025-05-15 11:39:43', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 7, 2024, 3, 'LMI', '2025-05-20 12:33:38', false, false, 0, 0, '2025-05-20 12:33:38', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 8, 2024, 4, 'LMI', '2025-05-26 07:57:45', false, false, 0, 0, '2025-05-26 07:57:45', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 9, 2024, 4, 'LMI', '2025-05-26 09:26:07', false, false, 0, 0, '2025-05-26 09:26:07', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 10, 2024, 4, 'LMI', '2025-05-26 09:40:34', false, false, 0, 0, '2025-05-26 09:40:34', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 11, 2024, 4, 'LMI', '2025-05-26 10:16:56', false, false, 0, 0, '2025-05-26 10:16:56', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 12, 2024, 5, 'LMI', '2025-05-26 14:41:27', false, false, 0, 0, '2025-05-26 14:41:27', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 13, 2024, 5, 'LMI', '2025-05-26 14:57:42', false, false, 0, 0, '2025-05-26 14:57:42', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 14, 2024, 5, 'LMI', '2025-05-26 15:47:24', false, false, 0, 0, '2025-05-26 15:47:24', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 15, 2024, 5, 'LMI', '2025-05-27 08:13:57', false, false, 0, 0, '2025-05-27 08:13:57', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 16, 2024, 5, 'LMI', '2025-05-27 10:22:58', false, false, 0, 0, '2025-05-27 10:22:58', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 17, 2024, 5, 'LMI', '2025-05-27 10:47:34', false, false, 0, 0, '2025-05-27 10:47:34', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 18, 2024, 6, 'LMI', '2025-05-28 11:51:58', false, false, 0, 0, '2025-05-28 11:51:58', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 19, 2024, 6, 'LMI', '2025-05-28 15:29:58', false, false, 0, 0, '2025-05-28 15:29:58', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 20, 2024, 6, 'LMI', '2025-05-28 15:40:11', false, false, 0, 0, '2025-05-28 15:40:11', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 21, 2024, 6, 'LMI', '2025-05-28 15:54:13', false, false, 0, 0, '2025-05-28 15:54:13', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 22, 2024, 7, 'LMI', '2025-05-29 10:18:34', false, false, 0, 0, '2025-05-29 10:18:34', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 23, 2024, 7, 'LMI', '2025-05-29 12:40:28', false, false, 0, 0, '2025-05-29 12:40:28', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 24, 2024, 7, 'LMI', '2025-05-29 13:46:43', false, false, 0, 0, '2025-05-29 13:46:43', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 25, 2024, 7, 'LMI', '2025-05-29 14:16:08', false, false, 0, 0, '2025-05-29 14:16:08', 'LMI', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 26, 2024, 7, 'LMI', '2025-05-29 14:53:00', false, false, 0, 0, '2025-05-29 14:53:00', 'LMI', 0, null, 1, 7.7, 'C', 'AJA', '2025-08-29 17:28:12'),
    (2, 5, 27, 2025, 8, 'AJA', '2025-08-29 17:28:44', false, false, 0, 0, '2025-08-29 17:28:44', 'AJA', 0, 'LIQUIDACION DE GASTOS GUIRA HUEHUETENANGO DEL 04 AL 08 DE AGOSTO NO. DE DEPOSITO 566002', 1, 7.7, 'V', null, null),
    (2, 5, 28, 2025, 8, 'AJA', '2025-08-29 17:49:04', false, false, 0, 0, '2025-08-29 17:49:04', 'AJA', 0, 'LIQUIDACION DE GASTOS GIRA SAN MARCOS DEL 18 AL 22 DE AGOSTO NO. DE DEPOSITO 578002', 1, 7.7, 'V', null, null),
    (2, 5, 29, 2025, 8, 'AJA', '2025-08-30 15:48:07', false, false, 0, 0, '2025-08-30 15:48:07', 'AJA', 0, 'AUXILIO GASOLINA AGOSTO DE LA SEMANA DEL 11 AL 15 Y DEL 25 AL 29.', 1, 7.7, 'C', 'AJA', '2025-09-18 16:58:46'),
    (2, 5, 30, 2025, 9, 'AJA', '2025-09-18 16:59:05', false, false, 0, 0, '2025-09-18 16:59:05', 'AJA', 0, 'LIQUIDACION DE GASTOS GIRA HUEHUETENANGO DEL 08 AL 12 DE SEPTIEMBRE NO. DE DEPOSITO 589002', 1, 7.7, 'V', null, null),
    (2, 5, 31, 2025, 9, 'AJA', '2025-10-01 07:35:11', false, false, 0, 0, '2025-10-01 07:35:11', 'AJA', 0, 'LIQUIDACION DE GASTOS GIRA SAN MARCOS DEL 22 AL 26 DE SEPTIEMBRE NO. DE DEPOSITO 595002', 1, 7.7, 'V', null, null),
    (2, 5, 32, 2025, 10, 'AJA', '2025-10-13 06:55:36', false, false, 0, 0, '2025-10-13 06:55:36', 'AJA', 0, 'GIRA HUEHUETENANGO DEL 06 AL 10 DE OCTUBRE NO DE DEPOSITO 606002', 1, 7.7, 'V', null, null),
    (2, 5, 33, 2025, 11, 'AJA', '2025-11-03 07:59:58', false, false, 0, 0, '2025-11-03 07:59:58', 'AJA', 0, 'GIRA SAN MARCOS DEL 27 AL 31 DE OCTUBRE NO DE DEPOSITO 614002', 1, 7.7, 'V', null, null),
    (2, 5, 34, 2025, 11, 'AJA', '2025-11-17 07:48:07', false, false, 0, 0, '2025-11-17 07:48:07', 'AJA', 0, 'RECUPERACION DE CARTERA NOVIEMBRE DEL 05 AL 09 HUEHUETENANGO NO.', 1, 7.7, 'V', null, null),
    (2, 5, 35, 2025, 11, 'AJA', '2025-11-17 08:07:06', false, false, 0, 0, '2025-11-17 08:07:06', 'AJA', 0, 'RECUPERACION CARTERA SAN MARCOS NOVIEMBRE DEL 10 AL 14 NO. 627002', 1, 7.7, 'V', null, null),
    (2, 5, 36, 2026, 7, 'AJA', '2026-07-13 10:22:09', false, false, 0, 0, '2026-07-13 10:22:09', 'AJA', 0, 'LIQUIDACION GIRA HUEHUETENANGO
SEMANA DEL  20 AL 24 DE JULIO 2026', 1, 7.7, 'V', null, null),
    (2, 5, 37, 2026, 7, 'AJA', '2026-07-27 10:09:25', false, false, 0, 0, '2026-07-27 10:09:25', 'AJA', 0, 'LIQUIDACION DE GIRA
HUEHUETENANGO DEL 20 AL 24 DE JULIO 2026', 1, 7.7, 'V', null, null),
    (2, 5, 38, 2026, 7, 'AJA', '2026-07-27 10:41:10', false, false, 0, 0, '2026-07-27 10:41:10', 'AJA', 0, 'LIQUIDACION GIRA 10 AL 14 DE AGOSTO SAN MARCOS', 1, 7.7, 'V', null, null),
    (2, 5, 39, 2026, 8, 'AJA', '2026-08-21 06:34:53', false, false, 0, 0, '2026-08-21 06:34:53', 'AJA', 0, 'GIRA SAN MARCOS 10 AL 14 AGOSTO 2026', 1, 7.7, 'V', null, null),
    (2, 5, 40, 2026, 8, 'AJA', '2026-08-31 10:47:38', false, false, 0, 0, '2026-08-31 10:47:38', 'AJA', 0, null, 1, 7.7, 'V', null, null),
    (2, 5, 41, 2026, 8, 'AJA', '2026-08-31 10:48:05', false, false, 0, 0, '2026-08-31 10:48:05', 'AJA', 0, 'LIQUIDACION GIRA SAN MARCOS
7 AL 11 DE SEPTIEMBRE 26', 1, 7.7, 'V', null, null),
    (2, 5, 42, 2026, 9, 'AJA', '2026-09-14 09:39:36', false, false, 0, 0, '2026-09-14 09:39:36', 'AJA', 0, 'LIQUIDACION GIRA SAN MARCOS  5 AL 9 DE OCTUBRE 26', 1, 7.7, 'V', null, null),
    (2, 5, 43, 2026, 10, 'AJA', '2026-10-12 07:48:57', false, false, 0, 0, '2026-10-12 07:48:57', 'AJA', 0, 'LIQUIDACION GIRA   HUEHUETENANGO DEL 19 AL 23 DE OCTUBRE 2026', 1, 7.7, 'V', null, null),
    (2, 5, 44, 2026, 10, 'AJA', '2026-10-26 13:49:46', false, false, 0, 0, '2026-10-26 13:49:46', 'AJA', 0, 'LIQUIDACION GIRA
HUEHUETENANGO
DEL 19AL23DE OCTUBRE 2026', 1, 7.7, 'V', null, null),
    (2, 5, 45, 2026, 10, 'AJA', '2026-11-02 08:52:40', false, false, 0, 0, '2026-11-02 08:52:40', 'AJA', 0, 'LIQUIDACION COMBUSTIBLE
MES DE OCTUBRE 2026', 1, 7.7, 'V', null, null),
    (2, 5, 46, 2026, 10, 'AJA', '2026-11-02 09:03:07', false, false, 0, 0, '2026-11-02 09:03:07', 'AJA', 0, 'LIQUIDACION ALIMENTACION
MES DE OCTUBRE', 1, 7.7, 'V', null, null),
    (2, 6, 1, 2025, 9, 'AJA', '2025-10-01 07:51:41', false, false, 0, 0, '2025-10-01 07:51:41', 'AJA', 0, 'AUXILIO COMBUSTIBLE MES DE SEPTIEMBRE', 1, 7.7, 'V', null, null),
    (2, 6, 2, 2025, 10, 'AJA', '2025-11-03 08:17:53', false, false, 0, 0, '2025-11-03 08:17:53', 'AJA', 0, 'AUXILIO COMBUSTIBLE MES DE OCTUBRE', 1, 7.7, 'V', null, null),
    (2, 6, 3, 2026, 7, 'AJA', '2025-11-03 08:26:27', false, false, 0, 0, '2025-11-03 08:26:27', 'AJA', 0, 'AUXILIO DE GASOLINA JULIO CAPITAL', 1, 7.7, 'V', null, null),
    (2, 6, 4, 2026, 7, 'AJA', '2025-11-17 07:45:37', false, false, 0, 0, '2025-11-17 07:45:37', 'AJA', 0, 'VIATICOS SANARATE Y PROGRESO 28 Y 29 JULIO', 1, 7.7, 'V', null, null),
    (2, 6, 5, 2026, 8, 'AJA', '2026-07-31 10:40:41', false, false, 0, 0, '2026-07-31 10:40:41', 'AJA', 0, 'ALIMENTACION CHIMALTENANGO SEMANA DEL 19 AL 21', 1, 7.7, 'V', null, null),
    (2, 6, 6, 2026, 8, 'AJA', '2026-07-31 10:45:07', false, false, 0, 0, '2026-07-31 10:45:07', 'AJA', 0, 'GASOLINA  SEPTIEMBRE 2026', 1, 7.7, 'V', null, null)) as x(loc, caja, numero, anio, mes, usuario, f_crea, cuadrada, liquidada, anticipo, liquidacion, f_liq, usr_liq, adelanto, concepto, moneda_int, cambio, estado, usr_cierra, f_cierra) loop
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
