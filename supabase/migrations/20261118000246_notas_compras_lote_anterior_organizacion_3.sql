-- Script 246 · parte 1 de 5 · Organización 3 (Futura Farma - Mavisa), lote al 04-11-2026 (carpeta «Data Inventarios 2 Parte»): notas de crédito y débito de proveedores (Compras ›
--   Notas crédito compras), de ACT_NOTAS_COMPRAS.xls (150 notas de esta parte) y ACT_DET_NOTAS_COMPRAS.xls (150 líneas).
--   Misma lógica del script 243 (lote del 05 al 17-11-2026). Notas: 3-01 1 (VIGENTE), 3-01 2 (VIGENTE), 3-01 3 (VIGENTE), 3-01 4 (VIGENTE), 3-01 5 (VIGENTE), 3-01 6 (VIGENTE), 3-01 7 (VIGENTE), 3-01 8 (VIGENTE), 3-01 9 (VIGENTE), 3-01 10 (VIGENTE), 3-01 11 (VIGENTE), 3-01 12 (VIGENTE), 3-01 13 (VIGENTE), 3-01 14 (VIGENTE), 3-01 15 (VIGENTE), 3-01 16 (VIGENTE), 3-01 17 (OPERADA), 3-01 18 (OPERADA), 3-01 19 (VIGENTE), 3-01 20 (VIGENTE), 3-01 21 (VIGENTE), 3-01 22 (VIGENTE), 3-01 23 (VIGENTE), 3-01 24 (VIGENTE), 3-01 25 (VIGENTE), 3-01 26 (VIGENTE), 3-01 27 (VIGENTE), 3-01 28 (VIGENTE), 3-01 29 (VIGENTE), 3-01 30 (VIGENTE), 3-01 31 (VIGENTE), 3-01 32 (VIGENTE), 3….
--   1. Una nota se identifica por su localidad y su número NOTA (columna nueva nota_anterior) y conserva ese número; si ya lo usa una nota
--      hecha en este sistema, toma el siguiente libre. Las líneas, por su nota y LINEA. Si ya existen se actualizan.
--   2. Columnas nuevas (traen datos y no existían):
--      notas_compra: origen_anterior (marca MIGRADO), nota_anterior (NOTA), estado_anterior (ESTADO (I, O, A)), tipo_ajuste_anterior (TIPO_AJUSTE), clasificacion_nota_anterior (CLASIFICACION_NOTA), moneda_anterior (MONEDA), valor_mi (TOTAL_NOTA_MI), bodega_nombre_anterior (DESC_BODEGA), bodega_destino_anterior (BODEGA_DESTINO), compra_anterior (DOCUMENTO (compra)), serie_compra_anterior (SERIE_DOC), numero_compra_anterior (NUMERO_DOC), fecha_compra_anterior (FECHAHORA_EMISION_DOC), transaccion_anterior (TRANSACCION), usuario_ingresa_anterior (USUARIO_INGRESA), fecha_ingresa_anterior (FECHA_INGRESA), usuario_modifica_anterior (USUARIO_MODIFICA), fecha_modifica_anterior (FECHA_MODIFICA), observaciones (OBSERVACIONES).
--      nota_compra_lineas: origen_anterior (marca MIGRADO), producto_anterior (PRODUCTO), codigo_producto_anterior (CODIGO_PRODUCTO), precio_mi_anterior (VALOR_UNITARIO_MI), descuento_anterior (DESCUENTO), descuento_mi_anterior (DESCUENTO_MI), valor_total_anterior (VALOR_TOTAL), valor_total_mi_anterior (VALOR_TOTAL_MI).
--      Columnas vacías (no se migran): notas TIPO_PRECIO, DIRECCION, OBSERVACIONES, NUMERO_AUTORIZACION_DOC, AÑO_POLIZA, MES_POLIZA, POLIZA, USUARIO_ANULA, FECHA_ANULA, BODEGA_DESTINO; líneas REGISTRO_SANITARIO, UNIDAD_MEDIDA, COSTO_UNITARIO, COSTO_UNITARIO_MI, BODEGA.
--   Equivalencias: TIPO_NOTA C = nota de crédito, D = de débito; SERIE y NUMERO = serie y documento del DTE; FECHAHORA_EMISION = fecha;
--   MONEDA 1 = quetzales, 2 = dólares, con VALOR_CAMBIO; TOTAL_NOTA = valor (en dólares, TOTAL_NOTA_MI); ESTADO I (ingresada) = VIGENTE,
--   O = OPERADA, A = ANULADA; TIPO_AJUSTE 1 = DEVOLUCIÓN, 2 = DESCUENTO; CLASIFICACION_NOTA M = manual; MOTIVO_AJUSTE = motivo.
--   Proveedor, bodega y producto por su código en la localidad (el NIT y el nombre se toman del proveedor). La factura de referencia es la
--   compra DOCUMENTO (de medicamentos o, si no hay, compra varia) si es del mismo proveedor; si no está en la base queda su número.
--   Las notas se cargan con su estado del sistema anterior, SIN generar póliza ni movimientos de inventario (el kardex migrado ya trae la
--   salida de las devoluciones: script 147). Una nota OPERADA rebaja el saldo de su compra (compras_saldo); una VIGENTE se puede descargar
--   o anular en Compras. Línea INVENTARIADA = S mueve inventario (sin producto queda como concepto). VALOR_TOTAL = cantidad × precio.
--   Se ejecuta después del script 233. Se puede ejecutar de nuevo: actualiza.
set lock_timeout = '20s';
alter table public.notas_compra add column if not exists origen_anterior text;
alter table public.notas_compra add column if not exists nota_anterior integer;
alter table public.notas_compra add column if not exists estado_anterior text;
alter table public.notas_compra add column if not exists tipo_ajuste_anterior integer;
alter table public.notas_compra add column if not exists clasificacion_nota_anterior text;
alter table public.notas_compra add column if not exists moneda_anterior integer;
alter table public.notas_compra add column if not exists valor_mi numeric(18, 2);
alter table public.notas_compra add column if not exists bodega_nombre_anterior text;
alter table public.notas_compra add column if not exists bodega_destino_anterior integer;
alter table public.notas_compra add column if not exists compra_anterior integer;
alter table public.notas_compra add column if not exists serie_compra_anterior text;
alter table public.notas_compra add column if not exists numero_compra_anterior text;
alter table public.notas_compra add column if not exists fecha_compra_anterior date;
alter table public.notas_compra add column if not exists transaccion_anterior integer;
alter table public.notas_compra add column if not exists usuario_ingresa_anterior text;
alter table public.notas_compra add column if not exists fecha_ingresa_anterior timestamp;
alter table public.notas_compra add column if not exists usuario_modifica_anterior text;
alter table public.notas_compra add column if not exists fecha_modifica_anterior timestamp;
alter table public.notas_compra add column if not exists observaciones text;
alter table public.nota_compra_lineas add column if not exists origen_anterior text;
alter table public.nota_compra_lineas add column if not exists producto_anterior integer;
alter table public.nota_compra_lineas add column if not exists codigo_producto_anterior text;
alter table public.nota_compra_lineas add column if not exists precio_mi_anterior numeric(18, 4);
alter table public.nota_compra_lineas add column if not exists descuento_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists descuento_mi_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists valor_total_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists valor_total_mi_anterior numeric(18, 2);
create unique index if not exists notas_compra_nota_anterior on public.notas_compra (localidad_id, nota_anterior) where nota_anterior is not null;

do $notas$
declare
  v_org bigint; v_gtq bigint; v_usd bigint; r record; v_loc bigint; v_prov record; v_compra bigint; v_bod bigint; v_id bigint; v_num int; v_mon bigint;
  n_n int := 0; n_a int := 0; n_s int := 0; n_s_txt text := ''; n_otro int := 0; n_sin_compra int := 0; l_n int := 0; l_a int := 0; l_s int := 0; v_nuevo boolean;
begin
  select id into v_org from public.organizaciones where codigo::text = '3';
  if v_org is null then raise exception 'No existe la organización 3.'; end if;
  select id into v_gtq from public.monedas where iso = 'GTQ';
  select id into v_usd from public.monedas where iso = 'USD';
  -- Carga del sistema anterior: conserva número, estado y usuario (preparar_nota_compra respeta fin.nota).
  perform set_config('fin.nota', 'si', true);

  for r in select * from (values
      (1::integer, 1::integer, 'NOTA DE CRÉDITO'::text, 'B'::text, '100'::text, null::text, '2021-01-19'::date, 1::integer, 1::numeric, 'VIGENTE'::text, 800::numeric, 800::numeric, 1::integer, 'FUTURA FARMA'::text, 1879::integer, 'VITALIS, S.A'::text, 2::integer, 'DESCUENTO'::text, 'Descuento en la factura: B - 1239'::text, 325::integer, 'B'::text, '1239'::text, '2021-01-19'::date, 0::integer, 'M'::text, 'JRA'::text, '2021-12-09 00:00:00'::timestamp, 'JRA'::text, '2021-12-09 00:00:00'::timestamp, null::integer, null::text, null::timestamp, 'I'::text, null::text),
      (1, 2, 'NOTA DE CRÉDITO', 'B', '102', null, '2021-01-25', 1, 1, 'VIGENTE', 31.5, 31.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: B - 1240', 326, 'B', '1240', '2021-01-28', 0, 'M', 'JRA', '2021-12-09 00:00:00', 'FRA', '2022-06-07 00:00:00', null, null, null, 'I', null),
      (1, 3, 'NOTA DE CRÉDITO', 'B', '106', null, '2021-01-29', 1, 1, 'VIGENTE', 5657.5, 5657.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 1250', 327, 'B', '1250', '2021-01-28', 0, 'M', 'JRA', '2021-12-09 00:00:00', null, null, null, null, null, 'I', null),
      (1, 4, 'NOTA DE CRÉDITO', 'B', '101', null, '2021-01-25', 1, 1, 'VIGENTE', 13587.5, 13587.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 1240', 326, 'B', '1240', '2021-01-28', 0, 'M', 'JRA', '2021-12-09 00:00:00', null, null, null, null, null, 'I', null),
      (1, 5, 'NOTA DE CRÉDITO', 'B', '108', null, '2021-02-08', 1, 1, 'VIGENTE', 5891.99, 5891.99, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 1254', 328, 'B', '1254', '2021-02-09', 0, 'M', 'JRA', '2021-12-09 00:00:00', null, null, null, null, null, 'I', null),
      (1, 6, 'NOTA DE CRÉDITO', 'B', '110', null, '2021-02-16', 1, 1, 'VIGENTE', 3343.75, 3343.75, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 1260', 329, 'B', '1260', '2021-02-16', 0, 'M', 'JRA', '2021-12-09 00:00:00', null, null, null, null, null, 'I', null),
      (1, 7, 'NOTA DE CRÉDITO', 'B', '111', null, '2021-02-22', 1, 1, 'VIGENTE', 137, 137, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 1265', 330, 'B', '1265', '2021-02-24', 0, 'M', 'JRA', '2021-12-09 00:00:00', null, null, null, null, null, 'I', null),
      (1, 8, 'NOTA DE CRÉDITO', 'B', '112', null, '2021-02-24', 1, 1, 'VIGENTE', 7662.5, 7662.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 1268', 331, 'B', '1268', '2021-02-24', 0, 'M', 'JRA', '2021-12-09 00:00:00', null, null, null, null, null, 'I', null),
      (1, 9, 'NOTA DE CRÉDITO', 'B', '113', null, '2021-02-24', 1, 1, 'VIGENTE', 2983.75, 2983.75, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura:  -', 370, null, null, null, 0, 'M', 'JRA', '2021-12-09 00:00:00', 'JRA', '2021-12-09 00:00:00', null, null, null, 'I', null),
      (1, 10, 'NOTA DE CRÉDITO', 'B', '115', null, '2021-02-25', 1, 1, 'VIGENTE', 7200, 7200, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 1, 'DEVOLUCIÓN', 'DEVELOCION DE RANITIDINA 50 MG P201265 FACT: B 1260', 331, 'B', '1268', '2021-02-24', 0, 'M', 'JRA', '2021-12-09 00:00:00', 'FRA', '2022-06-07 00:00:00', null, null, null, 'I', null),
      (1, 11, 'NOTA DE CRÉDITO', 'B', '120', null, '2021-03-12', 1, 1, 'VIGENTE', 8694, 8694, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 1290', 333, 'B', '1290', '2021-03-15', 0, 'M', 'JRA', '2021-12-09 00:00:00', 'JRA', '2021-12-09 00:00:00', null, null, null, 'I', null),
      (1, 12, 'NOTA DE CRÉDITO', '0E7E294E', '14893721', '0E7E294E-00E3-4299-9077-5756BE1E31E3', '2021-04-26', 1, 1, 'VIGENTE', 23453.12, 23453.12, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: 723927261', 335, '7F665637', '723927261', '2021-04-23', 0, 'M', 'JRA', '2021-12-09 00:00:00', 'JRA', '2021-12-09 00:00:00', null, null, null, 'I', null),
      (1, 13, 'NOTA DE CRÉDITO', 'B32165CA', '3746187319', 'B32165CA-DF4A-4837-9F5D-79FCE56C5745', '2021-04-29', 1, 1, 'VIGENTE', 4500, 4500, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura:  783433777', 336, 'A7173743', '783433777', '2021-04-29', 0, 'M', 'JRA', '2021-12-09 00:00:00', null, null, null, null, null, 'I', null),
      (1, 14, 'NOTA DE CRÉDITO', 'E22D5439', '1015300826', 'E22D5439-3C84-42DA-BFE8-80ABBE9190EB', '2021-04-29', 1, 1, 'VIGENTE', 112.5, 112.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: 968576547', 337, '78E76BB5', '968576547', '2021-04-30', 0, 'M', 'JRA', '2021-12-09 00:00:00', null, null, null, null, null, 'I', null),
      (1, 15, 'NOTA DE CRÉDITO', 'A1E18877', '1504333347', 'A1E18877-59AA-4E23-A3B4-7D75AF08BE2F', '2021-05-19', 1, 1, 'VIGENTE', 19548.03, 19548.03, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: 1055476822', 338, '35F08522', '1055476822', '2021-05-19', 0, 'M', 'JRA', '2021-12-09 00:00:00', null, null, null, null, null, 'I', null),
      (1, 16, 'NOTA DE CRÉDITO', '5C774225', '646139749', '5C774225-2683-4F65-8641-7472DC73A6BA', '2021-06-01', 1, 1, 'VIGENTE', 3916.12, 3916.12, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura:  - 311510868', 334, 'E9D8E452', '311510868', '2021-06-01', 0, 'M', 'JRA', '2021-12-09 00:00:00', 'JRA', '2021-12-09 00:00:00', null, null, null, 'I', null),
      (1, 17, 'NOTA DE CRÉDITO', 'A', '4', null, '2022-01-06', 1, 1, 'OPERADA', 16215, 16215, 1, 'FUTURA FARMA', 1888, 'MAVISA PHARMACEUTICALS, S.A', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: A - 31', 400, 'A', '31', '2021-12-08', 0, 'M', 'JRA', '2022-02-01 00:00:00', 'JRA', '2022-02-01 00:00:00', null, null, null, 'O', null),
      (1, 18, 'NOTA DE CRÉDITO', '9DC9EA17', '3301262414', null, '2022-02-24', 1, 1, 'OPERADA', 4675, 4675, 1, 'FUTURA FARMA', 1888, 'MAVISA PHARMACEUTICALS, S.A', 1, 'DEVOLUCIÓN', 'DEVOLUCION DE PRODUCTO', 409, '7E60A869', '2247902296', '2022-02-22', 0, 'M', 'OLM', '2022-02-24 00:00:00', 'OLM', '2022-02-24 00:00:00', null, null, null, 'O', null),
      (1, 19, 'NOTA DE CRÉDITO', 'B', '115', null, '2021-02-25', 1, 1, 'VIGENTE', 12800, 12800, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 1, 'DEVOLUCIÓN', 'DEVELOCION DE RANITIDINA 50 MG P201265 FACT: B 1260', 332, 'B', '1271', '2021-02-25', 0, 'M', 'FRA', '2022-06-01 00:00:00', 'FRA', '2022-06-07 00:00:00', null, null, null, 'I', null),
      (1, 20, 'NOTA DE CRÉDITO', 'B541D671', '2765636533', null, '2021-04-14', 1, 1, 'VIGENTE', 2573, 2573, 1, 'FUTURA FARMA', 1879, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 2168679B - 1311657859', 340, '2168679B', '1311657859', '2021-04-14', 0, 'M', 'FRA', '2022-06-01 00:00:00', 'FRA', '2022-06-07 00:00:00', null, null, null, 'I', null),
      (1, 21, 'NOTA DE CRÉDITO', '8958066F', '2337229363', null, '2021-04-21', 1, 1, 'VIGENTE', 15, 15, 1, 'FUTURA FARMA', 1879, 'VITALES, S.A.', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: 0437A6D4 - 3079815482', 341, '0437A6D4', '3079815482', '2021-04-22', 0, 'M', 'FRA', '2022-06-01 00:00:00', 'FRA', '2022-06-01 00:00:00', null, null, null, 'I', null),
      (1, 22, 'NOTA DE CRÉDITO', '279C3AE8', '1990610066', null, '2021-04-09', 1, 1, 'VIGENTE', 4725, 4725, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: 8E0B49EB - 4264839827', 342, '8E0B49EB', '4264839827', '2021-04-12', 0, 'M', 'FRA', '2022-06-01 00:00:00', 'FRA', '2022-06-01 00:00:00', null, null, null, 'I', null),
      (1, 23, 'NOTA DE CRÉDITO', 'FF42ABF7', '3658368526', null, '2021-04-09', 1, 1, 'VIGENTE', 21600, 21600, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: 8E0B49EB - 4264839827', 342, '8E0B49EB', '4264839827', '2021-04-12', 0, 'M', 'FRA', '2022-06-01 00:00:00', null, null, null, null, null, 'I', null),
      (1, 24, 'NOTA DE CRÉDITO', '43D46B39', '3134737812', null, '2021-05-06', 1, 1, 'VIGENTE', 168.75, 168.75, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: 9ECAECD6 - 1215318782', 339, '9ECAECD6', '1215318782', '2021-05-05', 0, 'M', 'FRA', '2022-06-01 00:00:00', null, null, null, null, null, 'I', null),
      (1, 25, 'NOTA DE CRÉDITO', 'B', '85', null, '2020-12-14', 1, 1, 'VIGENTE', 9289.58, 9289.58, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: B - 1219', 323, 'B', '1219', '2020-12-14', 0, 'M', 'FRA', '2022-06-01 00:00:00', null, null, null, null, null, 'I', null),
      (1, 26, 'NOTA DE CRÉDITO', 'B', '86', null, '2020-12-14', 1, 1, 'VIGENTE', 2218.25, 2218.25, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: B - 1220', 324, 'B', '1220', '2020-12-14', 0, 'M', 'FRA', '2022-06-01 00:00:00', 'FRA', '2022-06-01 00:00:00', null, null, null, 'I', null),
      (1, 27, 'NOTA DE CRÉDITO', 'B', '87', null, '2020-12-14', 1, 1, 'VIGENTE', 70, 70, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: B - 1220', 324, 'B', '1220', '2020-12-14', 0, 'M', 'FRA', '2022-06-01 00:00:00', null, null, null, null, null, 'I', null),
      (1, 28, 'NOTA DE CRÉDITO', 'B', '65', null, '2020-10-30', 1, 1, 'VIGENTE', 46382.4, 46382.4, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: B - 1176', 318, 'B', '1176', '2020-11-02', 0, 'M', 'FRA', '2022-06-01 00:00:00', null, null, null, null, null, 'I', null),
      (1, 29, 'NOTA DE CRÉDITO', 'B', '66', null, '2020-10-30', 1, 1, 'VIGENTE', 2649.06, 2649.06, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: B - 1176', 318, 'B', '1176', '2020-11-02', 0, 'M', 'FRA', '2022-06-01 00:00:00', null, null, null, null, null, 'I', null),
      (1, 30, 'NOTA DE CRÉDITO', 'B', '69', null, '2020-11-11', 1, 1, 'VIGENTE', 3895.2, 3895.2, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura:  -', 320, 'B', '1188', '2020-11-11', 0, 'M', 'FRA', '2022-06-01 00:00:00', null, null, null, null, null, 'I', null),
      (1, 31, 'NOTA DE CRÉDITO', 'B', '74', null, '2020-11-27', 1, 1, 'VIGENTE', 24892.3, 24892.3, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: B - 1200', 321, 'B', '1200', '2020-11-27', 0, 'M', 'FRA', '2022-06-01 00:00:00', null, null, null, null, null, 'I', null),
      (1, 32, 'NOTA DE CRÉDITO', 'B', '75', null, '2020-11-27', 1, 1, 'VIGENTE', 6927.05, 6927.05, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: B - 1204', 322, 'B', '1204', '2020-11-27', 0, 'M', 'FRA', '2022-06-02 00:00:00', null, null, null, null, null, 'I', null),
      (1, 33, 'NOTA DE CRÉDITO', 'INT', '1', null, '2021-01-04', 1, 1, 'VIGENTE', 2004, 2004, 1, 'FUTURA FARMA', 1891, 'GUARDADO S.A DE C.V /LABORATORIOS FARDEL', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: 20SD000X - 112', 383, '20SD000X', '112', '2020-11-13', 0, 'M', 'FRA', '2022-06-02 00:00:00', null, null, null, null, null, 'I', null),
      (1, 34, 'NOTA DE CRÉDITO', 'B', '53', null, '2020-10-02', 1, 1, 'VIGENTE', 10557.63, 10557.63, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 2, 'DESCUENTO', 'PRONTO PAGO FAC-B-1145', 313, 'B', '1145', '2020-10-01', 0, 'M', 'FRA', '2022-06-02 00:00:00', 'FRA', '2022-06-03 00:00:00', null, null, null, 'I', null),
      (1, 35, 'NOTA DE CRÉDITO', 'B', '12', null, '2020-07-31', 1, 1, 'VIGENTE', 85, 85, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B - 1154', 314, 'B', '1154', '2020-10-09', 0, 'M', 'FRA', '2022-06-03 00:00:00', 'FRA', '2022-06-07 00:00:00', null, null, null, 'I', null),
      (1, 36, 'NOTA DE CRÉDITO', 'B', '56', null, '2020-10-09', 1, 1, 'VIGENTE', 1837.5, 1837.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1154', 314, 'B', '1154', '2020-10-09', 0, 'M', 'FRA', '2022-06-03 00:00:00', 'FRA', '2022-06-03 00:00:00', null, null, null, 'I', null),
      (1, 37, 'NOTA DE CRÉDITO', 'B', '62', null, '2020-10-16', 1, 1, 'VIGENTE', 2106.71, 2106.71, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B - 1164', 316, 'B', '1164', '2020-10-16', 0, 'M', 'FRA', '2022-06-03 00:00:00', 'FRA', '2022-06-07 00:00:00', null, null, null, 'I', null),
      (1, 38, 'NOTA DE CRÉDITO', 'B', '57', null, '2020-10-15', 1, 1, 'VIGENTE', 5931.63, 5931.63, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT 1157', 315, 'B', '1157', '2020-10-16', 0, 'M', 'FRA', '2022-06-03 00:00:00', 'FRA', '2022-06-03 00:00:00', null, null, null, 'I', null),
      (1, 39, 'NOTA DE CRÉDITO', 'B', '59', null, '2020-10-15', 1, 1, 'VIGENTE', 21375, 21375, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 1, 'DEVOLUCIÓN', 'DEVOLUCION DE PRODUCTO FACT. 1154', 315, 'B', '1157', '2020-10-16', 0, 'M', 'FRA', '2022-06-03 00:00:00', 'FRA', '2022-06-03 00:00:00', null, null, null, 'I', null),
      (1, 40, 'NOTA DE CRÉDITO', 'B', '39', null, '2020-09-18', 1, 1, 'VIGENTE', 4709.38, 4709.38, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 1, 'DEVOLUCIÓN', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1135', 309, 'B', '1135', '2020-09-16', 0, 'M', 'FRA', '2022-06-03 00:00:00', null, null, null, null, null, 'I', null),
      (1, 41, 'NOTA DE CRÉDITO', 'B', '34', null, '2020-09-17', 1, 1, 'VIGENTE', 1945, 1945, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 1, 'DEVOLUCIÓN', 'DEVOLUCION DE CEFTRIAXONA LOT P201395', 307, 'B', '1129', '2020-08-31', 0, 'M', 'FRA', '2022-06-03 00:00:00', null, null, null, null, null, 'I', null),
      (1, 42, 'NOTA DE CRÉDITO', 'B', '34', null, '2020-09-17', 1, 1, 'VIGENTE', 2305, 2305, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 1, 'DEVOLUCIÓN', 'DEVOLUCION DE CEFTRIAXONA LOT P201395', 295, 'B', '1103', '2020-07-21', 0, 'M', 'FRA', '2022-06-03 00:00:00', null, null, null, null, null, 'I', null),
      (1, 43, 'NOTA DE CRÉDITO', '24B4DF4A', '617236318', null, '2020-08-31', 1, 1, 'VIGENTE', 2625, 2625, 1, 'FUTURA FARMA', 1889, 'LATIN VOX, SOCIEDAD ANONIMA', 1, 'DEVOLUCIÓN', 'DEVOLUCION Y/O REBAJA: AJUSTE DE PRECIO', 382, 'BB926D23', '3184281333', '2020-08-03', 0, 'M', 'FRA', '2022-06-03 00:00:00', null, null, null, null, null, 'I', null),
      (1, 44, 'NOTA DE CRÉDITO', '7B39F6A4', '3894232089', null, '2020-08-31', 1, 1, 'VIGENTE', 2625, 2625, 1, 'FUTURA FARMA', 1889, 'LATIN VOX, SOCIEDAD ANONIMA', 2, 'DESCUENTO', 'Descuento en la factura: 9D2FF5F2 - 1958300897', 381, '9D2FF5F2', '1958300897', '2020-08-03', 0, 'M', 'FRA', '2022-06-03 00:00:00', 'FRA', '2022-06-07 00:00:00', null, null, null, 'I', null),
      (1, 45, 'NOTA DE CRÉDITO', 'A', '492', null, '2020-07-27', 1, 1, 'VIGENTE', 17660.7, 17660.7, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 1088', 287, 'B', '1088', '2020-07-14', 0, 'M', 'FRA', '2022-06-03 00:00:00', 'FRA', '2022-06-07 00:00:00', null, null, null, 'I', null),
      (1, 46, 'NOTA DE CRÉDITO', 'A', '488', null, '2020-07-08', 1, 1, 'VIGENTE', 3260.8, 3260.8, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1090 Y B-1091', 289, 'B', '1090', '2020-07-07', 0, 'M', 'FRA', '2022-06-03 00:00:00', 'FRA', '2022-06-03 00:00:00', null, null, null, 'I', null),
      (1, 47, 'NOTA DE CRÉDITO', 'A', '493', null, '2020-07-27', 1, 1, 'VIGENTE', 16849.35, 16849.35, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1093, B-1095, B-1099, B-1101, B-1104, B-', 291, 'B', '1093', '2020-07-08', 0, 'M', 'FRA', '2022-06-03 00:00:00', 'FRA', '2022-06-07 00:00:00', null, null, null, 'I', null),
      (1, 48, 'NOTA DE CRÉDITO', 'A', '491', null, '2020-07-27', 1, 1, 'VIGENTE', 21920, 21920, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: B - 1103', 295, 'B', '1103', '2020-07-21', 0, 'M', 'FRA', '2022-06-03 00:00:00', 'FRA', '2022-06-07 00:00:00', null, null, null, 'I', null),
      (1, 49, 'NOTA DE CRÉDITO', 'B', '23', null, '2020-08-18', 1, 1, 'VIGENTE', 14647.99, 14647.99, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1114, B-1116, B-1117, B-1118', 300, 'B', '1114', '2020-07-29', 0, 'M', 'FRA', '2022-06-03 00:00:00', null, null, null, null, null, 'I', null),
      (1, 50, 'NOTA DE CRÉDITO', 'A', '487', null, '2020-07-08', 1, 1, 'VIGENTE', 5232.1, 5232.1, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1072 Y B-1081', 285, 'B', '1072', '2020-06-11', 0, 'M', 'FRA', '2022-06-03 00:00:00', null, null, null, null, null, 'I', null),
      (1, 51, 'NOTA DE CRÉDITO', 'A', '484', null, '2020-06-30', 1, 1, 'VIGENTE', 3817.1, 3817.1, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1071', 284, 'B', '1071', '2020-06-11', 0, 'M', 'FRA', '2022-06-03 00:00:00', 'FRA', '2022-06-03 00:00:00', null, null, null, 'I', null),
      (1, 52, 'NOTA DE CRÉDITO', 'A', '483', null, '2020-06-26', 1, 1, 'VIGENTE', 5933.56, 5933.56, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1067', 283, 'B', '1067', '2020-06-05', 0, 'M', 'FRA', '2022-06-03 00:00:00', 'FRA', '2022-06-03 00:00:00', null, null, null, 'I', null),
      (1, 53, 'NOTA DE CRÉDITO', 'A', '482', null, '2020-06-23', 1, 1, 'VIGENTE', 12572.4, 12572.4, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1041, B-1053, B-1059, B-1065, B-1066', 278, 'B', '1041', '2020-04-30', 0, 'M', 'FRA', '2022-06-03 00:00:00', null, null, null, null, null, 'I', null),
      (1, 54, 'NOTA DE CRÉDITO', 'A', '471', null, '2020-04-28', 1, 1, 'VIGENTE', 5040, 5040, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1021', 272, 'B', '1021', '2020-03-25', 0, 'M', 'FRA', '2022-06-03 00:00:00', null, null, null, null, null, 'I', null),
      (1, 55, 'NOTA DE CRÉDITO', 'A', '470', null, '2020-04-06', 1, 1, 'VIGENTE', 8734.5, 8734.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1001, B-1007, B-1009, B-1010', 271, 'B', '1020', '2020-03-25', 0, 'M', 'FRA', '2022-06-03 00:00:00', null, null, null, null, null, 'I', null),
      (1, 56, 'NOTA DE CRÉDITO', 'A', '467', null, '2020-03-16', 1, 1, 'VIGENTE', 6528.68, 6528.68, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-984, B-986, B-993', 265, 'B', '993', '2020-03-09', 0, 'M', 'FRA', '2022-06-03 00:00:00', 'FRA', '2022-06-03 00:00:00', null, null, null, 'I', null),
      (1, 57, 'NOTA DE CRÉDITO', 'A', '466', null, '2020-02-27', 1, 1, 'VIGENTE', 2691.63, 2691.63, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 1, 'DEVOLUCIÓN', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-975, B-976, B-978, B-981', 258, 'B', '975', '2020-02-06', 0, 'M', 'FRA', '2022-06-03 00:00:00', 'FRA', '2022-06-03 00:00:00', null, null, null, 'I', null),
      (1, 58, 'NOTA DE CRÉDITO', 'A', '465', null, '2020-02-24', 1, 1, 'VIGENTE', 7329.8, 7329.8, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-968, B-972, B-974', 256, 'B', '972', '2020-02-04', 0, 'M', 'FRA', '2022-06-03 00:00:00', null, null, null, null, null, 'I', null),
      (1, 59, 'NOTA DE CRÉDITO', 'A', '462', null, '2020-01-24', 1, 1, 'VIGENTE', 13853.27, 13853.27, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-961, B-965 Y B-966', 252, 'B', '961', '2020-01-13', 0, 'M', 'FRA', '2022-06-03 00:00:00', null, null, null, null, null, 'I', null),
      (1, 60, 'NOTA DE CRÉDITO', 'A', '460', null, '2019-11-28', 1, 1, 'VIGENTE', 6480.6, 6480.6, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-940, B-942, B-948 Y B-952', 247, 'B', '942', '2019-11-05', 0, 'M', 'FRA', '2022-06-06 00:00:00', 'FRA', '2022-06-06 00:00:00', null, null, null, 'I', null),
      (1, 61, 'NOTA DE CRÉDITO', 'A', '458', null, '2019-10-28', 1, 1, 'VIGENTE', 2290.54, 2290.54, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-930, B-932, B-934 Y B-937', 242, 'B', '930', '2019-10-14', 0, 'M', 'FRA', '2022-06-06 00:00:00', null, null, null, null, null, 'I', null),
      (1, 62, 'NOTA DE CRÉDITO', 'A', '456', null, '2019-10-23', 1, 1, 'VIGENTE', 42.62, 42.62, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-919', 242, 'B', '930', '2019-10-14', 0, 'M', 'FRA', '2022-06-06 00:00:00', null, null, null, null, null, 'I', null),
      (1, 63, 'NOTA DE CRÉDITO', 'A', '450', null, '2019-10-14', 1, 1, 'VIGENTE', 3812.55, 3812.55, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-925 Y B296', 241, 'B', '926', '2019-10-03', 0, 'M', 'FRA', '2022-06-06 00:00:00', null, null, null, null, null, 'I', null),
      (1, 64, 'NOTA DE CRÉDITO', 'A', '455', null, '2019-10-23', 1, 1, 'VIGENTE', 9.58, 9.58, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-909', 242, 'B', '930', '2019-10-14', 0, 'M', 'FRA', '2022-06-06 00:00:00', null, null, null, null, null, 'I', null),
      (1, 65, 'NOTA DE CRÉDITO', 'A', '449', null, '2019-09-30', 1, 1, 'VIGENTE', 4385.29, 4385.29, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-913 Y B-919', 239, 'B', '919', '2019-09-12', 0, 'M', 'FRA', '2022-06-06 00:00:00', 'FRA', '2022-06-07 00:00:00', null, null, null, 'I', null),
      (1, 66, 'NOTA DE CRÉDITO', 'A', '448', null, '2019-09-02', 1, 1, 'VIGENTE', 4182.03, 4182.03, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-895, B-897, B-909- B-910', 237, 'B', '910', '2019-09-02', 0, 'M', 'FRA', '2022-06-06 00:00:00', null, null, null, null, null, 'I', null),
      (1, 67, 'NOTA DE CRÉDITO', 'A', '447', null, '2019-08-06', 1, 1, 'VIGENTE', 7785.45, 7785.45, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-891 Y B-892', 232, 'B', '891', '2019-08-02', 0, 'M', 'FRA', '2022-06-07 00:00:00', 'FRA', '2022-06-07 00:00:00', null, null, null, 'I', null),
      (1, 68, 'NOTA DE CRÉDITO', 'A', '446', null, '2019-08-01', 1, 1, 'VIGENTE', 4438.79, 4438.79, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-890', 231, 'B', '890', '2019-08-02', 0, 'M', 'FRA', '2022-06-07 00:00:00', null, null, null, null, null, 'I', null),
      (1, 69, 'NOTA DE CRÉDITO', 'A', '442', null, '2019-07-17', 1, 1, 'VIGENTE', 5305.3, 5305.3, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-876', 230, 'B', '876', '2019-07-12', 0, 'M', 'FRA', '2022-06-07 00:00:00', null, null, null, null, null, 'I', null),
      (1, 70, 'NOTA DE CRÉDITO', 'A', '441', null, '2019-07-03', 1, 1, 'VIGENTE', 5482.42, 5482.42, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-868', 229, 'B', '868', '2019-06-28', 0, 'M', 'FRA', '2022-06-07 00:00:00', null, null, null, null, null, 'I', null),
      (1, 71, 'NOTA DE CRÉDITO', 'A', '440', null, '2019-06-26', 1, 1, 'VIGENTE', 2292.5, 2292.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-863, B-865', 227, 'B', '863', '2019-06-14', 0, 'M', 'FRA', '2022-06-07 00:00:00', null, null, null, null, null, 'I', null),
      (1, 72, 'NOTA DE CRÉDITO', 'A', '439', null, '2019-06-13', 1, 1, 'VIGENTE', 3612.56, 3612.56, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-855, B-857, B-858, B-859', 223, 'B', '855', '2019-06-03', 0, 'M', 'FRA', '2022-06-07 00:00:00', null, null, null, null, null, 'I', null),
      (1, 73, 'NOTA DE CRÉDITO', 'A', '431', null, '2019-05-20', 1, 1, 'VIGENTE', 3261.36, 3261.36, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-841, B-842', 217, 'B', '841', '2019-05-08', 0, 'M', 'FRA', '2022-06-07 00:00:00', null, null, null, null, null, 'I', null),
      (1, 74, 'NOTA DE CRÉDITO', 'A', '430', null, '2019-05-14', 1, 1, 'VIGENTE', 5625, 5625, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-840', 216, 'B', '840', '2019-05-08', 0, 'M', 'FRA', '2022-06-07 00:00:00', null, null, null, null, null, 'I', null),
      (1, 75, 'NOTA DE CRÉDITO', 'A', '429', null, '2019-05-14', 1, 1, 'VIGENTE', 1908.02, 1908.02, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-824, B-826, B-830, B-833', 216, 'B', '840', '2019-05-08', 0, 'M', 'FRA', '2022-06-07 00:00:00', null, null, null, null, null, 'I', null),
      (1, 76, 'NOTA DE CRÉDITO', 'A', '423', null, '2019-04-23', 1, 1, 'VIGENTE', 3298.52, 3298.52, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-818', 211, 'B', '818', '2019-04-03', 0, 'M', 'FRA', '2022-06-07 00:00:00', null, null, null, null, null, 'I', null),
      (1, 77, 'NOTA DE CRÉDITO', 'A', '422', null, '2019-04-12', 1, 1, 'VIGENTE', 12836.94, 12836.94, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-817', 210, 'B', '817', '2019-04-03', 0, 'M', 'FRA', '2022-06-07 00:00:00', null, null, null, null, null, 'I', null),
      (1, 78, 'NOTA DE CRÉDITO', 'A', '421', null, '2019-03-21', 1, 1, 'VIGENTE', 8459.19, 8459.19, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-795, B-797, B-798, B-802, B-805, B-806, B-810', 209, 'B', '810', '2019-03-18', 0, 'M', 'FRA', '2022-06-07 00:00:00', null, null, null, null, null, 'I', null),
      (1, 79, 'NOTA DE CRÉDITO', 'A', '416', null, '2019-01-29', 1, 1, 'VIGENTE', 6137.88, 6137.88, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 768', 196, 'B', '768', '2019-01-08', 0, 'M', 'FRA', '2022-06-07 00:00:00', null, null, null, null, null, 'I', null),
      (1, 80, 'NOTA DE CRÉDITO', 'A', '411', null, '2019-01-16', 1, 1, 'VIGENTE', 11.88, 11.88, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura:  - 763', 195, 'B', '763', '2019-01-02', 0, 'M', 'FRA', '2022-06-07 00:00:00', null, null, null, null, null, 'I', null),
      (1, 81, 'NOTA DE CRÉDITO', 'A', '434', null, '2019-05-30', 1, 1, 'VIGENTE', 1535.77, 1535.77, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-846, B-849, B-851, B-852', 219, 'B', '846', '2019-05-17', 0, 'M', 'FRA', '2022-06-07 00:00:00', null, null, null, null, null, 'I', null),
      (1, 82, 'NOTA DE CRÉDITO', 'A', '406', null, '2018-12-05', 1, 1, 'VIGENTE', 11008.6, 11008.6, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B-746, B-747, B-751, B - 752', 192, 'B', '752', '2018-12-03', 0, 'M', 'FRA', '2022-06-07 00:00:00', 'FRA', '2022-06-09 00:00:00', null, null, null, 'I', null),
      (1, 83, 'NOTA DE CRÉDITO', 'A', '405', null, '2018-11-27', 1, 1, 'VIGENTE', 7149.86, 7149.86, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B-744, B-743', 188, 'B', '744', '2018-11-23', 0, 'M', 'FRA', '2022-06-09 00:00:00', null, null, null, null, null, 'I', null),
      (1, 84, 'NOTA DE CRÉDITO', 'A', '404', null, '2018-11-20', 1, 1, 'VIGENTE', 4140.66, 4140.66, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 737  B - 736  B - 733', 186, 'B', '737', '2018-11-09', 0, 'M', 'FRA', '2022-06-09 00:00:00', 'FRA', '2022-06-10 00:00:00', null, null, null, 'I', null),
      (1, 85, 'NOTA DE CRÉDITO', 'A', '401', null, '2018-10-31', 1, 1, 'VIGENTE', 2248.63, 2248.63, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B - 731', 183, 'B', '731', '2018-10-31', 0, 'M', 'FRA', '2022-06-09 00:00:00', 'FRA', '2022-06-10 00:00:00', null, null, null, 'I', null),
      (1, 86, 'NOTA DE CRÉDITO', 'A', '345', null, '2018-09-26', 1, 1, 'VIGENTE', 4521.04, 4521.04, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 705', 171, 'B', '705', '2018-09-06', 0, 'M', 'FRA', '2022-06-10 00:00:00', null, null, null, null, null, 'I', null),
      (1, 87, 'NOTA DE CRÉDITO', 'A', '337', null, '2018-09-10', 1, 1, 'VIGENTE', 3395.5, 3395.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 697', 169, 'B', '697', '2018-09-04', 0, 'M', 'FRA', '2022-06-10 00:00:00', null, null, null, null, null, 'I', null),
      (1, 88, 'NOTA DE CRÉDITO', 'A', '336', null, '2018-08-21', 1, 1, 'VIGENTE', 2522.62, 2522.62, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 680', 165, 'B', '680', '2018-08-14', 0, 'M', 'FRA', '2022-06-10 00:00:00', null, null, null, null, null, 'I', null),
      (1, 89, 'NOTA DE CRÉDITO', 'A', '334', null, '2018-08-17', 1, 1, 'VIGENTE', 2164.53, 2164.53, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 680', 165, 'B', '680', '2018-08-14', 0, 'M', 'FRA', '2022-06-10 00:00:00', null, null, null, null, null, 'I', null),
      (1, 90, 'NOTA DE CRÉDITO', 'A', '333', null, '2018-07-31', 1, 1, 'VIGENTE', 1657.46, 1657.46, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 660', 159, 'B', '660', '2018-07-23', 0, 'M', 'FRA', '2022-06-10 00:00:00', null, null, null, null, null, 'I', null),
      (1, 91, 'NOTA DE CRÉDITO', 'A', '329', null, '2018-07-23', 1, 1, 'VIGENTE', 5064.81, 5064.81, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 660', 159, 'B', '660', '2018-07-23', 0, 'M', 'FRA', '2022-06-10 00:00:00', null, null, null, null, null, 'I', null),
      (1, 92, 'NOTA DE CRÉDITO', 'A', '328', null, '2018-06-25', 1, 1, 'VIGENTE', 23, 23, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 646', 153, 'B', '646', '2018-06-14', 0, 'M', 'FRA', '2022-06-13 00:00:00', null, null, null, null, null, 'I', null),
      (1, 93, 'NOTA DE CRÉDITO', 'A', '324', null, '2018-06-15', 1, 1, 'VIGENTE', 2954.23, 2954.23, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 646', 153, 'B', '646', '2018-06-14', 0, 'M', 'FRA', '2022-06-13 00:00:00', null, null, null, null, null, 'I', null),
      (1, 94, 'NOTA DE CRÉDITO', 'A', '321', null, '2018-06-05', 1, 1, 'VIGENTE', 2994.26, 2994.26, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 632', 147, 'B', '632', '2018-05-30', 0, 'M', 'FRA', '2022-06-13 00:00:00', null, null, null, null, null, 'I', null),
      (1, 95, 'NOTA DE CRÉDITO', 'A', '318', null, '2018-02-23', 1, 1, 'VIGENTE', 1350.2, 1350.2, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 565', 125, 'B', '565', '2018-01-22', 0, 'M', 'FRA', '2022-06-13 00:00:00', 'FRA', '2022-06-13 00:00:00', null, null, null, 'I', null),
      (1, 96, 'NOTA DE CRÉDITO', 'OTR', '52', null, '2016-01-06', 1, 1, 'VIGENTE', 1000, 1000, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'REGISTRO SISTEMA ANTERIOR PARA REBAJAR CXP, SE CREAN POR ESTE MEDIO YA QUE NO SE TIENE DOCUMENTACION EN LA INFORMACION ANTERIOR.', 1, 'B', '82', '2016-01-06', 0, 'M', 'FRA', '2022-06-14 00:00:00', 'FRA', '2022-06-14 00:00:00', null, null, null, 'I', null),
      (1, 97, 'NOTA DE CRÉDITO', 'OTR', '53', null, '2016-01-12', 1, 1, 'VIGENTE', 3277.5, 3277.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 84', 2, 'B', '84', '2016-01-08', 0, 'M', 'FRA', '2022-06-14 00:00:00', null, null, null, null, null, 'I', null),
      (1, 98, 'NOTA DE CRÉDITO', 'OTR', '53', null, '2016-01-12', 1, 1, 'VIGENTE', 1000, 1000, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'REGISTRO SISTEMA ANTERIOR PARA REBAJAR CXP, SE CREAN POR ESTE MEDIO YA QUE NO SE TIENE DOCUMENTACION EN LA INFORMACION ANTERIOR.', 3, 'B', '85', '2016-01-11', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 99, 'NOTA DE CRÉDITO', 'OTR', '54', null, '2016-01-19', 1, 1, 'VIGENTE', 19142.5, 19142.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'REGISTRO SISTEMA ANTERIOR PARA REBAJAR CXP, SE CREAN POR ESTE MEDIO YA QUE NO SE TIENE DOCUMENTACION EN LA INFORMACION ANTERIOR.', 4, 'B', '86', '2016-06-13', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 100, 'NOTA DE CRÉDITO', 'OTR', '54', null, '2016-01-19', 1, 1, 'VIGENTE', 8892, 8892, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'REGISTRO SISTEMA ANTERIOR PARA REBAJAR CXP, SE CREAN POR ESTE MEDIO YA QUE NO SE TIENE DOCUMENTACION EN LA INFORMACION ANTERIOR.', 5, 'B', '91', '2016-06-13', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 101, 'NOTA DE CRÉDITO', 'OTR', '56', null, '2016-01-29', 1, 1, 'VIGENTE', 14283.25, 14283.25, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 93', 6, 'B', '93', '2016-01-20', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 102, 'NOTA DE CRÉDITO', 'OTR', '56', null, '2016-01-29', 1, 1, 'VIGENTE', 2058, 2058, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 94', 7, 'B', '94', '2016-01-26', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 103, 'NOTA DE CRÉDITO', 'OTR', '60', null, '2016-02-15', 1, 1, 'VIGENTE', 10355, 10355, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 100', 8, 'B', '100', '2016-02-09', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 104, 'NOTA DE CRÉDITO', 'OTR', '62', null, '2016-02-23', 1, 1, 'VIGENTE', 1500, 1500, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 104', 9, 'B', '104', '2016-02-18', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 105, 'NOTA DE CRÉDITO', 'OTR', '66', null, '2016-03-16', 1, 1, 'VIGENTE', 21897.5, 21897.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 108', 10, 'B', '108', '2016-03-07', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 106, 'NOTA DE CRÉDITO', 'OTR', '71', null, '2016-03-31', 1, 1, 'VIGENTE', 600, 600, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 116', 11, 'B', '116', '2016-03-17', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 107, 'NOTA DE CRÉDITO', 'OTR', '71', null, '2016-03-31', 1, 1, 'VIGENTE', 8905.3, 8905.3, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 125', 12, 'B', '125', '2016-03-31', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 108, 'NOTA DE CRÉDITO', 'OTR', '73', null, '2016-09-11', 1, 1, 'VIGENTE', 2400, 2400, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 129', 13, 'B', '129', '2016-04-05', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 109, 'NOTA DE CRÉDITO', 'OTR', '73', null, '2016-09-11', 1, 1, 'VIGENTE', 220, 220, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 130', 14, 'B', '130', '2016-04-05', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 110, 'NOTA DE CRÉDITO', 'OTR', '73', null, '2016-04-11', 1, 1, 'VIGENTE', 10934.5, 10934.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 131', 15, 'B', '131', '2016-04-11', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-09-07 00:00:00', null, null, null, 'I', null),
      (1, 111, 'NOTA DE CRÉDITO', 'OTR', '75', null, '2016-04-27', 1, 1, 'VIGENTE', 300, 300, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 132', 16, 'B', '132', '2016-04-13', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 112, 'NOTA DE CRÉDITO', 'OTR', '75', null, '2016-04-27', 1, 1, 'VIGENTE', 4322.5, 4322.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 135', 17, 'B', '135', '2016-04-15', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 113, 'NOTA DE CRÉDITO', 'B', '11', null, '2016-04-27', 1, 1, 'VIGENTE', 137.75, 137.75, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 137', 18, 'B', '137', '2016-04-20', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 114, 'NOTA DE CRÉDITO', 'OTR', '75', null, '2016-04-27', 1, 1, 'VIGENTE', 862.25, 862.25, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 137', 18, 'B', '137', '2016-04-20', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 115, 'NOTA DE CRÉDITO', 'OTR', '75', null, '2016-04-27', 1, 1, 'VIGENTE', 930, 930, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 141', 19, 'B', '141', '2016-04-25', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 116, 'NOTA DE CRÉDITO', 'OTR', '75', null, '2016-04-27', 1, 1, 'VIGENTE', 750, 750, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 142', 20, 'B', '142', '2016-04-26', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 117, 'NOTA DE CRÉDITO', 'OTR', '81', null, '2016-05-16', 1, 1, 'VIGENTE', 7287.45, 7287.45, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 144', 21, 'B', '144', '2016-04-28', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 118, 'NOTA DE CRÉDITO', 'OTR', '81', null, '2016-05-16', 1, 1, 'VIGENTE', 711.2, 711.2, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 146', 22, 'B', '146', '2016-05-02', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 119, 'NOTA DE CRÉDITO', 'OTR', '81', null, '2016-05-16', 1, 1, 'VIGENTE', 1325, 1325, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 147', 23, 'B', '147', '2016-05-05', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 120, 'NOTA DE CRÉDITO', 'OTR', '81', null, '2016-05-16', 1, 1, 'VIGENTE', 17461, 17461, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 148', 24, 'B', '148', '2016-05-09', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 121, 'NOTA DE CRÉDITO', 'OTR', '81', null, '2016-05-16', 1, 1, 'VIGENTE', 300, 300, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 150', 25, 'B', '150', '2016-05-10', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 122, 'NOTA DE CRÉDITO', 'OTR', '81', null, '2016-05-16', 1, 1, 'VIGENTE', 905.1, 905.1, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 153', 26, 'B', '153', '2016-05-11', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 123, 'NOTA DE CRÉDITO', 'OTR', '84', null, '2016-05-25', 1, 1, 'VIGENTE', 2130, 2130, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 155', 27, 'B', '155', '2016-05-16', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 124, 'NOTA DE CRÉDITO', 'OTR', '84', null, '2016-05-25', 1, 1, 'VIGENTE', 528, 528, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 156', 28, 'B', '156', '2016-05-16', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 125, 'NOTA DE CRÉDITO', 'OTR', '84', null, '2016-05-25', 1, 1, 'VIGENTE', 19617.5, 19617.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 158', 29, 'B', '158', '2016-05-17', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 126, 'NOTA DE CRÉDITO', 'OTR', '84', null, '2016-05-25', 1, 1, 'VIGENTE', 6662.83, 6662.83, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 160', 30, 'B', '160', '2016-05-20', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 127, 'NOTA DE CRÉDITO', 'OTR', '85', null, '2016-05-31', 1, 1, 'VIGENTE', 21088.29, 21088.29, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 162', 31, 'B', '162', '2016-05-30', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 128, 'NOTA DE CRÉDITO', 'OTR', '86', null, '2016-06-07', 1, 1, 'VIGENTE', 6631, 6631, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 164', 32, 'B', '164', '2016-06-06', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 129, 'NOTA DE CRÉDITO', 'OTR', '89', null, '2016-06-30', 1, 1, 'VIGENTE', 3325, 3325, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 166', 33, 'B', '166', '2016-06-08', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 130, 'NOTA DE CRÉDITO', 'OTR', '89', null, '2016-06-30', 1, 1, 'VIGENTE', 9785, 9785, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 172', 34, 'B', '172', '2016-09-12', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 131, 'NOTA DE CRÉDITO', 'OTR', '90', null, '2016-06-30', 1, 1, 'VIGENTE', 1224.2, 1224.2, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 174', 35, 'B', '174', '2016-06-23', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 132, 'NOTA DE CRÉDITO', 'OTR', '90', null, '2016-06-30', 1, 1, 'VIGENTE', 4560, 4560, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 177', 36, 'B', '177', '2016-06-24', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 133, 'NOTA DE CRÉDITO', 'OTR', '90', null, '2016-06-30', 1, 1, 'VIGENTE', 220, 220, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 178', 37, 'B', '178', '2016-06-24', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 134, 'NOTA DE CRÉDITO', 'OTR', '109', null, '2016-09-28', 1, 1, 'VIGENTE', 11761.05, 11761.05, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 180', 38, 'B', '180', '2016-06-29', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 135, 'NOTA DE CRÉDITO', 'OTR', '106', null, '2016-09-14', 1, 1, 'VIGENTE', 44613.74, 44613.74, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 181', 39, 'B', '181', '2016-06-29', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 136, 'NOTA DE CRÉDITO', 'OTR', '110', null, '2016-09-28', 1, 1, 'VIGENTE', 600, 600, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 305', 40, 'B', '305', '2016-07-19', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 137, 'NOTA DE CRÉDITO', 'OTR', '110', null, '2016-09-28', 1, 1, 'VIGENTE', 1200, 1200, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 307', 41, 'B', '307', '2016-07-25', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 138, 'NOTA DE CRÉDITO', 'OTR', '118', null, '2016-11-28', 1, 1, 'VIGENTE', 19019, 19019, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 309', 42, 'B', '309', '2016-07-26', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 139, 'NOTA DE CRÉDITO', 'OTR', '114', null, '2016-10-31', 1, 1, 'VIGENTE', 1045, 1045, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 310', 43, 'B', '310', '2016-07-26', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 140, 'NOTA DE CRÉDITO', 'OTR', '114', null, '2016-10-31', 1, 1, 'VIGENTE', 175, 175, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 312', 44, 'B', '312', '2016-08-01', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 141, 'NOTA DE CRÉDITO', 'OTR', '114', null, '2016-10-31', 1, 1, 'VIGENTE', 9523.75, 9523.75, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 317', 45, 'B', '317', '2016-08-05', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 142, 'NOTA DE CRÉDITO', 'OTR', '118', null, '2016-11-28', 1, 1, 'VIGENTE', 41293.08, 41293.08, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 322', 46, 'B', '322', '2016-08-29', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 143, 'NOTA DE CRÉDITO', 'OTR', '118', null, '2016-11-28', 1, 1, 'VIGENTE', 2400, 2400, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 326', 47, 'B', '326', '2016-08-30', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 144, 'NOTA DE CRÉDITO', 'OTR', '118', null, '2016-11-28', 1, 1, 'VIGENTE', 1225, 1225, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 327', 48, 'B', '327', '2016-08-31', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 145, 'NOTA DE CRÉDITO', 'OTR', '118', null, '2016-11-28', 1, 1, 'VIGENTE', 719, 719, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 330', 49, 'B', '330', '2016-09-05', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 146, 'NOTA DE CRÉDITO', 'OTR', '125', null, '2016-12-28', 1, 1, 'VIGENTE', 15751, 15751, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 335', 50, 'B', '335', '2016-09-29', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 147, 'NOTA DE CRÉDITO', 'OTR', '134', null, '2017-01-30', 1, 1, 'VIGENTE', 35000, 35000, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 341', 51, 'B', '341', '2016-10-03', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 148, 'NOTA DE CRÉDITO', 'OTR', '137', null, '2017-02-24', 1, 1, 'VIGENTE', 15820, 15820, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 341', 51, 'B', '341', '2016-10-03', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 149, 'NOTA DE CRÉDITO', 'OTR', '125', null, '2016-12-28', 1, 1, 'VIGENTE', 2850, 2850, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 347', 52, 'B', '347', '2016-10-12', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 150, 'NOTA DE CRÉDITO', 'OTR', '125', null, '2016-12-28', 1, 1, 'VIGENTE', 382.5, 382.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 354', 53, 'B', '354', '2016-10-17', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null)) as x(loc, nota, tipo, serie, documento, autorizacion, fecha, moneda, cambio, estado, total, total_mi, bodega, bodega_nombre, proveedor, proveedor_nombre,
       tipo_ajuste_ant, tipo_ajuste, motivo, compra, serie_doc, numero_doc, fecha_doc, transaccion, clasif, usr_ing, f_ing, usr_mod, f_mod, bodega_destino, usr_anula, f_anula,
       estado_ant, obs) order by loc, nota loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    select p.id, p.nit, p.nombre_comercial into v_prov from public.proveedores p where p.localidad_id = v_loc and p.codigo = r.proveedor;
    if v_prov.id is null then n_s := n_s + 1; n_s_txt := n_s_txt || format(' 3-0%s nota %s (proveedor %s);', r.loc, r.nota, r.proveedor); continue; end if;
    v_bod := (select b.id from public.bodegas b where b.localidad_id = v_loc and b.codigo = r.bodega);
    v_compra := coalesce((select c.id from public.compras c where c.localidad_id = v_loc and c.origen_anterior = 'MEDICAMENTOS' and c.compra_anterior = r.compra limit 1),
                         (select c.id from public.compras c where c.localidad_id = v_loc and ((c.origen_anterior = 'VARIAS' and c.compra_anterior = r.compra) or c.compra_varia_anterior = r.compra) limit 1));
    if v_compra is not null and not exists (select 1 from public.compras c where c.id = v_compra and c.proveedor_id = v_prov.id) then v_compra := null; end if;
    if v_compra is null then n_sin_compra := n_sin_compra + 1; end if;
    v_mon := case when r.moneda = 2 then coalesce(v_usd, v_gtq) else v_gtq end;
    select id into v_id from public.notas_compra where localidad_id = v_loc and nota_anterior = r.nota;
    if v_id is null then
      v_num := case when exists (select 1 from public.notas_compra where localidad_id = v_loc and numero = r.nota)
                    then (select coalesce(max(numero), 0) + 1 from public.notas_compra where localidad_id = v_loc) else r.nota end;
      if v_num <> r.nota then n_otro := n_otro + 1; end if;
      insert into public.notas_compra (organizacion_id, localidad_id, numero, tipo, documento, fecha, moneda_id, proveedor_id, nota_anterior, origen_anterior)
      values (v_org, v_loc, v_num, r.tipo, coalesce(r.documento, r.nota::text), r.fecha, v_mon, v_prov.id, r.nota, 'MIGRADO')
      returning id into v_id;
      n_n := n_n + 1;
    else
      n_a := n_a + 1;
    end if;
    update public.notas_compra set
      tipo = r.tipo, numero_autorizacion = r.autorizacion, serie = r.serie, documento = coalesce(r.documento, r.nota::text), fecha = r.fecha,
      moneda_id = v_mon, tipo_cambio = coalesce(nullif(r.cambio, 0), 1), valor = greatest(case when r.moneda = 2 then coalesce(r.total_mi, r.total) else r.total end, 0),
      proveedor_id = v_prov.id, proveedor_codigo = r.proveedor::text, proveedor_nombre = coalesce(r.proveedor_nombre, v_prov.nombre_comercial), nit = v_prov.nit,
      bodega_id = v_bod, compra_id = v_compra, motivo = r.motivo, tipo_ajuste = r.tipo_ajuste,
      tipo_nota = case when r.clasif = 'M' then 'MANUAL' else 'AUTOMÁTICA' end, estado = r.estado,
      usuario = coalesce(upper(r.usr_ing), 'SISTEMA ANTERIOR'),
      operado_por = case when r.estado = 'OPERADA' then upper(coalesce(r.usr_mod, r.usr_ing)) end,
      operado_en = case when r.estado = 'OPERADA' then coalesce(r.f_mod, r.f_ing)::timestamptz end,
      anulado_por = case when r.estado = 'ANULADA' then upper(coalesce(r.usr_anula, r.usr_mod)) end,
      anulado_en = case when r.estado = 'ANULADA' then coalesce(r.f_anula, r.f_mod)::timestamptz end,
      motivo_anulacion = case when r.estado = 'ANULADA' then 'ANULADA EN EL SISTEMA ANTERIOR' end,
      creado_por_nombre = coalesce(upper(r.usr_ing), 'MIGRACIÓN'), creado_en = r.f_ing::timestamptz,
      modificado_por_nombre = upper(r.usr_mod), modificado_en = r.f_mod::timestamptz,
      origen_anterior = 'MIGRADO', nota_anterior = r.nota, estado_anterior = r.estado_ant, tipo_ajuste_anterior = r.tipo_ajuste_ant, clasificacion_nota_anterior = r.clasif,
      moneda_anterior = r.moneda, valor_mi = r.total_mi, bodega_nombre_anterior = r.bodega_nombre, bodega_destino_anterior = r.bodega_destino, compra_anterior = r.compra,
      serie_compra_anterior = r.serie_doc, numero_compra_anterior = r.numero_doc, fecha_compra_anterior = r.fecha_doc, transaccion_anterior = r.transaccion,
      usuario_ingresa_anterior = r.usr_ing, fecha_ingresa_anterior = r.f_ing, usuario_modifica_anterior = r.usr_mod, fecha_modifica_anterior = r.f_mod, observaciones = r.obs
    where id = v_id;
  end loop;

  -- Líneas de las notas.
  for r in select * from (values
      (1::integer, 1::integer, 1::integer, null::integer, null::text, 'DESCUENTO PARA LAS FACTURAS'::text, null::text, null::date, null::date, 1::numeric, 800::numeric, 800::numeric, 0::numeric, 0::numeric, 800::numeric, 800::numeric, false::boolean, null::integer, null::text),
      (1, 2, 1, 121, 'FFM 0044', 'TRAMADOL CLORHIDRATO Vitalis 100 mg/ 2mL Solución Inyectable', 'P203140', null, null, 21, 1.5, 1.5, 0, 0, 31.5, 31.5, false, null, null),
      (1, 3, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5657.5, 5657.5, 0, 0, 5657.5, 5657.5, false, null, null),
      (1, 4, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 13587.5, 13587.5, 0, 0, 13587.5, 13587.5, false, null, null),
      (1, 5, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5891.99, 5891.99, 0, 0, 5891.99, 5891.99, false, null, null),
      (1, 6, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3343.75, 3343.75, 0, 0, 3343.75, 3343.75, false, null, null),
      (1, 7, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 137, 137, 0, 0, 137, 137, false, null, null),
      (1, 8, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 7662.5, 7662.5, 0, 0, 7662.5, 7662.5, false, null, null),
      (1, 9, 1, null, null, 'Descuento por pronto pago', null, null, null, 1, 2983.75, 2983.75, 0, 0, 2983.75, 2983.75, false, null, null),
      (1, 10, 1, null, null, 'DEVELOCION DE RANITIDINA 50 MG P201265 FACT: B 1260', null, null, null, 1, 7200, 7200, 0, 0, 7200, 7200, false, null, null),
      (1, 11, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 8694, 8694, 0, 0, 8694, 8694, false, null, null),
      (1, 12, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 23453.12, 23453.12, 0, 0, 23453.12, 23453.12, false, null, null),
      (1, 13, 1, null, null, 'Descuento por pronto pago', null, null, null, 1, 4500, 4500, 0, 0, 4500, 4500, false, null, null),
      (1, 14, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 112.5, 112.5, 0, 0, 112.5, 112.5, false, null, null),
      (1, 15, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 19548.03, 19548.03, 0, 0, 19548.03, 19548.03, false, null, null),
      (1, 16, 1, null, null, 'NOTA DE CREDITO DE DESCUENTO', null, null, null, 1, 3916.12, 3916.12, 0, 0, 3916.12, 3916.12, false, null, null),
      (1, 17, 1, 106, 'FFM 0029', 'HIERRO SACAROSA Vitalis 100 mg/5 mL  Solución Inyectable', 'P212211', '2023-06-30', '2021-06-30', 690, 23.5, 23.5, 0, 0, 16215, 16215, true, null, null),
      (1, 18, 1, 96, 'FFM 0019', 'CEFTRIAXONA SODICA VITALIS 1G POLVO PARA SOLUCIÓN INYECTABLE CAJA X 1', 'P213235', '2024-10-31', '2021-10-31', 850, 5.5, 5.5, 0, 0, 4675, 4675, true, null, null),
      (1, 19, 1, 1, null, 'DEVELOCION DE RANITIDINA 50 MG P201265 FACT: B 1260', null, null, null, 1, 12800, 12800, 0, 0, 12800, 12800, false, null, null),
      (1, 20, 1, 1, null, 'REBAJA POR DESCUENTO PRONTO PAGO', null, null, null, 1, 2573, 2573, 0, 0, 2573, 2573, false, null, null),
      (1, 21, 1, null, null, 'REBAJA DESCUENTO, PRONTO PAGO FA 3079815482', null, null, null, 1, 15, 15, 0, 0, 15, 15, false, null, null),
      (1, 22, 1, null, null, 'DEVOLUCION DE PRODUCTO AMFOTERICINA B', null, null, null, 1, 4725, 4725, 0, 0, 4725, 4725, false, null, null),
      (1, 23, 1, null, null, 'DEVOLUCION POR 1920 TRIMETOPRIM + SILFAMETOZAXOL', null, null, null, 1, 21600, 21600, 0, 0, 21600, 21600, false, null, null),
      (1, 24, 1, null, null, 'PRONTO PAGO', null, null, null, 1, 168.75, 168.75, 0, 0, 168.75, 168.75, false, null, null),
      (1, 25, 1, null, null, 'DESCUENTOS', null, null, null, 1, 9289.58, 9289.58, 0, 0, 9289.58, 9289.58, false, null, null),
      (1, 26, 1, null, null, 'DEVOLUCION Y/O REBAJA', null, null, null, 1, 2218.25, 2218.25, 0, 0, 2218.25, 2218.25, false, null, null),
      (1, 27, 1, null, null, 'DEVOLUCION Y/O REBAJA', null, null, null, 1, 70, 70, 0, 0, 70, 70, false, null, null),
      (1, 28, 1, null, null, 'DEVOLUCION 3221 ESOMEPRAZOL', null, null, null, 1, 46382.4, 46382.4, 0, 0, 46382.4, 46382.4, false, null, null),
      (1, 29, 1, null, null, 'PRONTO PAGO FAC. B-1176', null, null, null, 1, 2649.06, 2649.06, 0, 0, 2649.06, 2649.06, false, null, null),
      (1, 30, 1, null, null, 'PRONTO PAGO A LA FACTURA B-1188', null, null, null, 1, 3895.2, 3895.2, 0, 0, 3895.2, 3895.2, false, null, null),
      (1, 31, 1, null, null, 'PRONTO PAGO FA-B-1200', null, null, null, 1, 24892.3, 24892.3, 0, 0, 24892.3, 24892.3, false, null, null),
      (1, 32, 1, null, null, 'PRONTO PAGO A LA FACT-1204', null, null, null, 1, 6927.05, 6927.05, 0, 0, 6927.05, 6927.05, false, null, null),
      (1, 33, 1, null, null, 'CRUCE DE CUENTAS', null, null, null, 1, 2004, 2004, 0, 0, 2004, 2004, false, null, null),
      (1, 34, 1, null, null, 'PRONTO PAGO FAC-B-1145', null, null, null, 1, 10557.63, 10557.63, 0, 0, 10557.63, 10557.63, false, null, null),
      (1, 35, 1, 1, null, 'DEVOLUCION Y/O REBAJA POR FALTANTE DE FACT B-1117', null, null, null, 1, 85, 85, 0, 0, 85, 85, false, null, null),
      (1, 36, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1154', null, null, null, 1, 1837.5, 1837.5, 0, 0, 1837.5, 1837.5, false, null, null),
      (1, 37, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1164', null, null, null, 1, 2106.71, 2106.71, 0, 0, 2106.71, 2106.71, false, null, null),
      (1, 38, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1157', null, null, null, 1, 5931.63, 5931.63, 0, 0, 5931.63, 5931.63, false, null, null),
      (1, 39, 1, 1, null, 'DEVOLUCION DE PRODUCTO FACT. 1154', null, null, null, 1, 21375, 21375, 0, 0, 21375, 21375, false, null, null),
      (1, 40, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1135', null, null, null, 1, 4709.38, 4709.38, 0, 0, 4709.38, 4709.38, false, null, null),
      (1, 41, 1, 1, null, 'DEVOLUCION DE CEFTRIAXONA LOT P201395', null, null, null, 1, 1945, 1945, 0, 0, 1945, 1945, false, null, null),
      (1, 42, 1, 1, null, 'DEVOLUCION DE CEFTRIAXONA LOT P201395', null, null, null, 1, 2305, 2305, 0, 0, 2305, 2305, false, null, null),
      (1, 43, 1, 1, null, 'DEVOLUCION Y/O REBAJA: AJUSTE DE PRECIO', null, null, null, 1, 2625, 2625, 0, 0, 2625, 2625, false, null, null),
      (1, 44, 1, 1, null, 'DEVOLUCION Y/O REBAJA: AJUSTE DE PRECIO', null, null, null, 1, 2625, 2625, 0, 0, 2625, 2625, false, null, null),
      (1, 45, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1088 Y B-1089', null, null, null, 1, 17660.7, 17660.7, 0, 0, 17660.7, 17660.7, false, null, null),
      (1, 46, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1090 Y B-1091', null, null, null, 1, 3260.8, 3260.8, 0, 0, 3260.8, 3260.8, false, null, null),
      (1, 47, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1093, B-1095, B-1099, B-1101, B-1104, B-', null, null, null, 1, 16849.35, 16849.35, 0, 0, 16849.35, 16849.35, false, null, null),
      (1, 48, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DEV. CEFALOTINA EN FACT. B-1081', null, null, null, 1, 21920, 21920, 0, 0, 21920, 21920, false, null, null),
      (1, 49, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1114, B-1116, B-1117, B-1118', null, null, null, 1, 14647.99, 14647.99, 0, 0, 14647.99, 14647.99, false, null, null),
      (1, 50, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1072 Y B-1081', null, null, null, 1, 5232.1, 5232.1, 0, 0, 5232.1, 5232.1, false, null, null),
      (1, 51, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1071', null, null, null, 1, 3817.1, 3817.1, 0, 0, 3817.1, 3817.1, false, null, null),
      (1, 52, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1067', null, null, null, 1, 5933.56, 5933.56, 0, 0, 5933.56, 5933.56, false, null, null),
      (1, 53, 1, null, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1041, B-1053, B-1059, B-1065, B-1066', null, null, null, 1, 12572.4, 12572.4, 0, 0, 12572.4, 12572.4, false, null, null),
      (1, 54, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1021', null, null, null, 1, 5040, 5040, 0, 0, 5040, 5040, false, null, null),
      (1, 55, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-1001, B-1007, B-1009, B-1010', null, null, null, 1, 8734.5, 8734.5, 0, 0, 8734.5, 8734.5, false, null, null),
      (1, 56, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-984, B-986, B-993', null, null, null, 1, 6528.68, 6528.68, 0, 0, 6528.68, 6528.68, false, null, null),
      (1, 57, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-975, B-976, B-978, B-981', null, null, null, 1, 2691.63, 2691.63, 0, 0, 2691.63, 2691.63, false, null, null),
      (1, 58, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-968, B-972, B-974', null, null, null, 1, 7329.8, 7329.8, 0, 0, 7329.8, 7329.8, false, null, null),
      (1, 59, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-961, B-965 Y B-966', null, null, null, 1, 13853.27, 13853.27, 0, 0, 13853.27, 13853.27, false, null, null),
      (1, 60, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-940, B-942, B-948 Y B-952', null, null, null, 1, 6480.6, 6480.6, 0, 0, 6480.6, 6480.6, false, null, null),
      (1, 61, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-930, B-932, B-934 Y B-937', null, null, null, 1, 2290.54, 2290.54, 0, 0, 2290.54, 2290.54, false, null, null),
      (1, 62, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-919', null, null, null, 1, 42.62, 42.62, 0, 0, 42.62, 42.62, false, null, null),
      (1, 63, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-925 Y B296', null, null, null, 1, 3812.55, 3812.55, 0, 0, 3812.55, 3812.55, false, null, null),
      (1, 64, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-909', null, null, null, 1, 9.58, 9.58, 0, 0, 9.58, 9.58, false, null, null),
      (1, 65, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-913 Y B-919', null, null, null, 1, 4385.29, 4385.29, 0, 0, 4385.29, 4385.29, false, null, null),
      (1, 66, 1, 1, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-895, B-897, B-909- B-910', null, null, null, 1, 4182.03, 4182.03, 0, 0, 4182.03, 4182.03, false, null, null),
      (1, 67, 1, null, null, 'DEVOLUCION Y/O REBAJA: DESC. PRONTO PAGO FACT B-891 Y B-892', null, null, null, 1, 7785.45, 7785.45, 0, 0, 7785.45, 7785.45, false, null, null),
      (1, 68, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4438.79, 4438.79, 0, 0, 4438.79, 4438.79, false, null, null),
      (1, 69, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5305.3, 5305.3, 0, 0, 5305.3, 5305.3, false, null, null),
      (1, 70, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5482.42, 5482.42, 0, 0, 5482.42, 5482.42, false, null, null),
      (1, 71, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2292.5, 2292.5, 0, 0, 2292.5, 2292.5, false, null, null),
      (1, 72, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3612.56, 3612.56, 0, 0, 3612.56, 3612.56, false, null, null),
      (1, 73, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3261.36, 3261.36, 0, 0, 3261.36, 3261.36, false, null, null),
      (1, 74, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5625, 5625, 0, 0, 5625, 5625, false, null, null),
      (1, 75, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1908.02, 1908.02, 0, 0, 1908.02, 1908.02, false, null, null),
      (1, 76, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3298.52, 3298.52, 0, 0, 3298.52, 3298.52, false, null, null),
      (1, 77, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 12836.94, 12836.94, 0, 0, 12836.94, 12836.94, false, null, null),
      (1, 78, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 8459.19, 8459.19, 0, 0, 8459.19, 8459.19, false, null, null),
      (1, 79, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6137.88, 6137.88, 0, 0, 6137.88, 6137.88, false, null, null),
      (1, 80, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 11.88, 11.88, 0, 0, 11.88, 11.88, false, null, null),
      (1, 81, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1535.77, 1535.77, 0, 0, 1535.77, 1535.77, false, null, null),
      (1, 82, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 11008.6, 11008.6, 0, 0, 11008.6, 11008.6, false, null, null),
      (1, 83, 1, null, null, 'DESCUENTO PARA LAS  FACTURAS B-744, B-743', null, null, null, 1, 7149.86, 7149.86, 0, 0, 7149.86, 7149.86, false, null, null),
      (1, 84, 1, null, null, 'DESCUENTO PARA LAS  FACTURAS B-737', null, null, null, 1, 4140.66, 4140.66, 0, 0, 4140.66, 4140.66, false, null, null),
      (1, 85, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2248.63, 2248.63, 0, 0, 2248.63, 2248.63, false, null, null),
      (1, 86, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4521.04, 4521.04, 0, 0, 4521.04, 4521.04, false, null, null),
      (1, 87, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3395.5, 3395.5, 0, 0, 3395.5, 3395.5, false, null, null),
      (1, 88, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2522.62, 2522.62, 0, 0, 2522.62, 2522.62, false, null, null),
      (1, 89, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2164.53, 2164.53, 0, 0, 2164.53, 2164.53, false, null, null),
      (1, 90, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1657.46, 1657.46, 0, 0, 1657.46, 1657.46, false, null, null),
      (1, 91, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5064.81, 5064.81, 0, 0, 5064.81, 5064.81, false, null, null),
      (1, 92, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 23, 23, 0, 0, 23, 23, false, null, null),
      (1, 93, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2954.23, 2954.23, 0, 0, 2954.23, 2954.23, false, null, null),
      (1, 94, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2994.26, 2994.26, 0, 0, 2994.26, 2994.26, false, null, null),
      (1, 95, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1350.2, 1350.2, 0, 0, 1350.2, 1350.2, false, null, null),
      (1, 96, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1000, 1000, 0, 0, 1000, 1000, false, null, null),
      (1, 97, 1, null, null, 'REBAJAS CXP', null, null, null, 1, 3277.5, 3277.5, 0, 0, 3277.5, 3277.5, false, null, null),
      (1, 98, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1000, 1000, 0, 0, 1000, 1000, false, null, null),
      (1, 99, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 19142.5, 19142.5, 0, 0, 19142.5, 19142.5, false, null, null),
      (1, 100, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 8892, 8892, 0, 0, 8892, 8892, false, null, null),
      (1, 101, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 14283.25, 14283.25, 0, 0, 14283.25, 14283.25, false, null, null),
      (1, 102, 1, null, null, 'Descuento en la factura: B - 94', null, null, null, 1, 2058, 2058, 0, 0, 2058, 2058, false, null, null),
      (1, 103, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 10355, 10355, 0, 0, 10355, 10355, false, null, null),
      (1, 104, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1500, 1500, 0, 0, 1500, 1500, false, null, null),
      (1, 105, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 21897.5, 21897.5, 0, 0, 21897.5, 21897.5, false, null, null),
      (1, 106, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 600, 600, 0, 0, 600, 600, false, null, null),
      (1, 107, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 8905.3, 8905.3, 0, 0, 8905.3, 8905.3, false, null, null),
      (1, 108, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2400, 2400, 0, 0, 2400, 2400, false, null, null),
      (1, 109, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 220, 220, 0, 0, 220, 220, false, null, null),
      (1, 110, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 10934.5, 10934.5, 0, 0, 10934.5, 10934.5, false, null, null),
      (1, 111, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 300, 300, 0, 0, 300, 300, false, null, null),
      (1, 112, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4322.5, 4322.5, 0, 0, 4322.5, 4322.5, false, null, null),
      (1, 113, 1, null, null, 'Descuento en la factura: B - 137', null, null, null, 1, 137.75, 137.75, 0, 0, 137.75, 137.75, false, null, null),
      (1, 114, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 862.25, 862.25, 0, 0, 862.25, 862.25, false, null, null),
      (1, 115, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 930, 930, 0, 0, 930, 930, false, null, null),
      (1, 116, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 750, 750, 0, 0, 750, 750, false, null, null),
      (1, 117, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 7287.45, 7287.45, 0, 0, 7287.45, 7287.45, false, null, null),
      (1, 118, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 711.2, 711.2, 0, 0, 711.2, 711.2, false, null, null),
      (1, 119, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1325, 1325, 0, 0, 1325, 1325, false, null, null),
      (1, 120, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 17461, 17461, 0, 0, 17461, 17461, false, null, null),
      (1, 121, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 300, 300, 0, 0, 300, 300, false, null, null),
      (1, 122, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 905.1, 905.1, 0, 0, 905.1, 905.1, false, null, null),
      (1, 123, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2130, 2130, 0, 0, 2130, 2130, false, null, null),
      (1, 124, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 528, 528, 0, 0, 528, 528, false, null, null),
      (1, 125, 1, null, null, 'Descuento en la factura: B - 158', null, null, null, 1, 19617.5, 19617.5, 0, 0, 19617.5, 19617.5, false, null, null),
      (1, 126, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6662.83, 6662.83, 0, 0, 6662.83, 6662.83, false, null, null),
      (1, 127, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 21088.29, 21088.29, 0, 0, 21088.29, 21088.29, false, null, null),
      (1, 128, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6631, 6631, 0, 0, 6631, 6631, false, null, null),
      (1, 129, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3325, 3325, 0, 0, 3325, 3325, false, null, null),
      (1, 130, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 9785, 9785, 0, 0, 9785, 9785, false, null, null),
      (1, 131, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1224.2, 1224.2, 0, 0, 1224.2, 1224.2, false, null, null),
      (1, 132, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4560, 4560, 0, 0, 4560, 4560, false, null, null),
      (1, 133, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 220, 220, 0, 0, 220, 220, false, null, null),
      (1, 134, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 11761.05, 11761.05, 0, 0, 11761.05, 11761.05, false, null, null),
      (1, 135, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 44613.74, 44613.74, 0, 0, 44613.74, 44613.74, false, null, null),
      (1, 136, 1, null, null, 'Descuento en la factura: B - 305', null, null, null, 1, 600, 600, 0, 0, 600, 600, false, null, null),
      (1, 137, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1200, 1200, 0, 0, 1200, 1200, false, null, null),
      (1, 138, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 19019, 19019, 0, 0, 19019, 19019, false, null, null),
      (1, 139, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1045, 1045, 0, 0, 1045, 1045, false, null, null),
      (1, 140, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 175, 175, 0, 0, 175, 175, false, null, null),
      (1, 141, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 9523.75, 9523.75, 0, 0, 9523.75, 9523.75, false, null, null),
      (1, 142, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 41293.08, 41293.08, 0, 0, 41293.08, 41293.08, false, null, null),
      (1, 143, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2400, 2400, 0, 0, 2400, 2400, false, null, null),
      (1, 144, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1225, 1225, 0, 0, 1225, 1225, false, null, null),
      (1, 145, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 719, 719, 0, 0, 719, 719, false, null, null),
      (1, 146, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 15751, 15751, 0, 0, 15751, 15751, false, null, null),
      (1, 147, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 35000, 35000, 0, 0, 35000, 35000, false, null, null),
      (1, 148, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 15820, 15820, 0, 0, 15820, 15820, false, null, null),
      (1, 149, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2850, 2850, 0, 0, 2850, 2850, false, null, null),
      (1, 150, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 382.5, 382.5, 0, 0, 382.5, 382.5, false, null, null)) as x(loc, nota, linea, producto, cod_prod, descripcion, lote, vence, fabrica, cantidad, precio, precio_mi, descu, descu_mi, total, total_mi, inv, bodega, registro) loop
    select n.id, n.localidad_id into v_id, v_loc from public.notas_compra n join public.localidades l on l.id = n.localidad_id
    where l.organizacion_id = v_org and l.correlativo = r.loc and n.nota_anterior = r.nota;
    if v_id is null then l_s := l_s + 1; continue; end if;
    insert into public.nota_compra_lineas (nota_id, linea, producto_id, descripcion, cantidad, precio, inventario, lote, registro_sanitario, fecha_vencimiento, fecha_fabricacion,
      bodega_id, origen_anterior, producto_anterior, codigo_producto_anterior, precio_mi_anterior, descuento_anterior, descuento_mi_anterior, valor_total_anterior, valor_total_mi_anterior)
    select v_id, r.linea, p.id, coalesce(r.descripcion, p.nombre, 'SIN DESCRIPCIÓN'), case when coalesce(r.cantidad, 0) > 0 then r.cantidad else 1 end,
           greatest(coalesce(r.precio, 0), 0), coalesce(r.inv, false) and p.id is not null, r.lote, r.registro, r.vence, r.fabrica,
           (select b.id from public.bodegas b where b.localidad_id = v_loc and b.codigo = r.bodega), 'MIGRADO', r.producto, r.cod_prod, r.precio_mi, r.descu, r.descu_mi, r.total, r.total_mi
    from (select 1) uno left join public.productos p on p.localidad_id = v_loc and p.codigo = r.producto
    on conflict (nota_id, linea) do update set producto_id = excluded.producto_id, descripcion = excluded.descripcion, cantidad = excluded.cantidad, precio = excluded.precio,
      inventario = excluded.inventario, lote = excluded.lote, registro_sanitario = excluded.registro_sanitario, fecha_vencimiento = excluded.fecha_vencimiento,
      fecha_fabricacion = excluded.fecha_fabricacion, bodega_id = excluded.bodega_id, origen_anterior = excluded.origen_anterior, producto_anterior = excluded.producto_anterior,
      codigo_producto_anterior = excluded.codigo_producto_anterior, precio_mi_anterior = excluded.precio_mi_anterior, descuento_anterior = excluded.descuento_anterior,
      descuento_mi_anterior = excluded.descuento_mi_anterior, valor_total_anterior = excluded.valor_total_anterior, valor_total_mi_anterior = excluded.valor_total_mi_anterior
    returning (xmax = 0) into v_nuevo;
    if v_nuevo then l_n := l_n + 1; else l_a := l_a + 1; end if;
  end loop;

  perform set_config('fin.nota', '', true);
  raise notice '%', format('Notas de compras de la organización 3: %s nuevas, %s actualizadas, %s con otro número (el suyo ya estaba ocupado), %s sin su compra en la base. Líneas: %s nuevas, %s actualizadas, %s sin nota.%s',
    n_n, n_a, n_otro, n_sin_compra, l_n, l_a, l_s, case when n_s > 0 then ' Omitidas por falta de proveedor:' || n_s_txt else '' end);
end;
$notas$;

notify pgrst, 'reload schema';
-- Script 246 · parte 2 de 5 · Organización 3 (Futura Farma - Mavisa), lote al 04-11-2026 (carpeta «Data Inventarios 2 Parte»): notas de crédito y débito de proveedores (Compras ›
--   Notas crédito compras), de ACT_NOTAS_COMPRAS.xls (150 notas de esta parte) y ACT_DET_NOTAS_COMPRAS.xls (157 líneas).
--   Misma lógica del script 243 (lote del 05 al 17-11-2026). Notas: 3-01 151 (VIGENTE), 3-01 152 (VIGENTE), 3-01 153 (VIGENTE), 3-01 154 (VIGENTE), 3-01 155 (VIGENTE), 3-01 156 (VIGENTE), 3-01 157 (VIGENTE), 3-01 158 (VIGENTE), 3-01 159 (VIGENTE), 3-01 160 (VIGENTE), 3-01 161 (VIGENTE), 3-01 162 (VIGENTE), 3-01 163 (VIGENTE), 3-01 164 (VIGENTE), 3-01 165 (VIGENTE), 3-01 166 (VIGENTE), 3-01 167 (VIGENTE), 3-01 168 (VIGENTE), 3-01 169 (VIGENTE), 3-01 170 (VIGENTE), 3-01 171 (VIGENTE), 3-01 172 (VIGENTE), 3-01 173 (VIGENTE), 3-01 174 (VIGENTE), 3-01 175 (VIGENTE), 3-01 176 (VIGENTE), 3-01 177 (VIGENTE), 3-01 178 (VIGENTE), 3-01 179 (VIGENTE), 3-01 180 (VIGENTE), ….
--   1. Una nota se identifica por su localidad y su número NOTA (columna nueva nota_anterior) y conserva ese número; si ya lo usa una nota
--      hecha en este sistema, toma el siguiente libre. Las líneas, por su nota y LINEA. Si ya existen se actualizan.
--   2. Columnas nuevas (traen datos y no existían):
--      notas_compra: origen_anterior (marca MIGRADO), nota_anterior (NOTA), estado_anterior (ESTADO (I, O, A)), tipo_ajuste_anterior (TIPO_AJUSTE), clasificacion_nota_anterior (CLASIFICACION_NOTA), moneda_anterior (MONEDA), valor_mi (TOTAL_NOTA_MI), bodega_nombre_anterior (DESC_BODEGA), bodega_destino_anterior (BODEGA_DESTINO), compra_anterior (DOCUMENTO (compra)), serie_compra_anterior (SERIE_DOC), numero_compra_anterior (NUMERO_DOC), fecha_compra_anterior (FECHAHORA_EMISION_DOC), transaccion_anterior (TRANSACCION), usuario_ingresa_anterior (USUARIO_INGRESA), fecha_ingresa_anterior (FECHA_INGRESA), usuario_modifica_anterior (USUARIO_MODIFICA), fecha_modifica_anterior (FECHA_MODIFICA), observaciones (OBSERVACIONES).
--      nota_compra_lineas: origen_anterior (marca MIGRADO), producto_anterior (PRODUCTO), codigo_producto_anterior (CODIGO_PRODUCTO), precio_mi_anterior (VALOR_UNITARIO_MI), descuento_anterior (DESCUENTO), descuento_mi_anterior (DESCUENTO_MI), valor_total_anterior (VALOR_TOTAL), valor_total_mi_anterior (VALOR_TOTAL_MI).
--      Columnas vacías (no se migran): notas TIPO_PRECIO, DIRECCION, OBSERVACIONES, NUMERO_AUTORIZACION_DOC, AÑO_POLIZA, MES_POLIZA, POLIZA, USUARIO_ANULA, FECHA_ANULA, BODEGA_DESTINO; líneas REGISTRO_SANITARIO, UNIDAD_MEDIDA, COSTO_UNITARIO, COSTO_UNITARIO_MI, BODEGA.
--   Equivalencias: TIPO_NOTA C = nota de crédito, D = de débito; SERIE y NUMERO = serie y documento del DTE; FECHAHORA_EMISION = fecha;
--   MONEDA 1 = quetzales, 2 = dólares, con VALOR_CAMBIO; TOTAL_NOTA = valor (en dólares, TOTAL_NOTA_MI); ESTADO I (ingresada) = VIGENTE,
--   O = OPERADA, A = ANULADA; TIPO_AJUSTE 1 = DEVOLUCIÓN, 2 = DESCUENTO; CLASIFICACION_NOTA M = manual; MOTIVO_AJUSTE = motivo.
--   Proveedor, bodega y producto por su código en la localidad (el NIT y el nombre se toman del proveedor). La factura de referencia es la
--   compra DOCUMENTO (de medicamentos o, si no hay, compra varia) si es del mismo proveedor; si no está en la base queda su número.
--   Las notas se cargan con su estado del sistema anterior, SIN generar póliza ni movimientos de inventario (el kardex migrado ya trae la
--   salida de las devoluciones: script 147). Una nota OPERADA rebaja el saldo de su compra (compras_saldo); una VIGENTE se puede descargar
--   o anular en Compras. Línea INVENTARIADA = S mueve inventario (sin producto queda como concepto). VALOR_TOTAL = cantidad × precio.
--   Se ejecuta después del script 233. Se puede ejecutar de nuevo: actualiza.
set lock_timeout = '20s';
alter table public.notas_compra add column if not exists origen_anterior text;
alter table public.notas_compra add column if not exists nota_anterior integer;
alter table public.notas_compra add column if not exists estado_anterior text;
alter table public.notas_compra add column if not exists tipo_ajuste_anterior integer;
alter table public.notas_compra add column if not exists clasificacion_nota_anterior text;
alter table public.notas_compra add column if not exists moneda_anterior integer;
alter table public.notas_compra add column if not exists valor_mi numeric(18, 2);
alter table public.notas_compra add column if not exists bodega_nombre_anterior text;
alter table public.notas_compra add column if not exists bodega_destino_anterior integer;
alter table public.notas_compra add column if not exists compra_anterior integer;
alter table public.notas_compra add column if not exists serie_compra_anterior text;
alter table public.notas_compra add column if not exists numero_compra_anterior text;
alter table public.notas_compra add column if not exists fecha_compra_anterior date;
alter table public.notas_compra add column if not exists transaccion_anterior integer;
alter table public.notas_compra add column if not exists usuario_ingresa_anterior text;
alter table public.notas_compra add column if not exists fecha_ingresa_anterior timestamp;
alter table public.notas_compra add column if not exists usuario_modifica_anterior text;
alter table public.notas_compra add column if not exists fecha_modifica_anterior timestamp;
alter table public.notas_compra add column if not exists observaciones text;
alter table public.nota_compra_lineas add column if not exists origen_anterior text;
alter table public.nota_compra_lineas add column if not exists producto_anterior integer;
alter table public.nota_compra_lineas add column if not exists codigo_producto_anterior text;
alter table public.nota_compra_lineas add column if not exists precio_mi_anterior numeric(18, 4);
alter table public.nota_compra_lineas add column if not exists descuento_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists descuento_mi_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists valor_total_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists valor_total_mi_anterior numeric(18, 2);
create unique index if not exists notas_compra_nota_anterior on public.notas_compra (localidad_id, nota_anterior) where nota_anterior is not null;

do $notas$
declare
  v_org bigint; v_gtq bigint; v_usd bigint; r record; v_loc bigint; v_prov record; v_compra bigint; v_bod bigint; v_id bigint; v_num int; v_mon bigint;
  n_n int := 0; n_a int := 0; n_s int := 0; n_s_txt text := ''; n_otro int := 0; n_sin_compra int := 0; l_n int := 0; l_a int := 0; l_s int := 0; v_nuevo boolean;
begin
  select id into v_org from public.organizaciones where codigo::text = '3';
  if v_org is null then raise exception 'No existe la organización 3.'; end if;
  select id into v_gtq from public.monedas where iso = 'GTQ';
  select id into v_usd from public.monedas where iso = 'USD';
  -- Carga del sistema anterior: conserva número, estado y usuario (preparar_nota_compra respeta fin.nota).
  perform set_config('fin.nota', 'si', true);

  for r in select * from (values
      (1::integer, 151::integer, 'NOTA DE CRÉDITO'::text, 'OTR'::text, '125'::text, null::text, '2016-12-28'::date, 1::integer, 1::numeric, 'VIGENTE'::text, 1476::numeric, 1476::numeric, 1::integer, 'FUTURA FARMA'::text, 1879::integer, 'VITALIS, S.A'::text, 2::integer, 'DESCUENTO'::text, 'Descuento en la factura: B - 356'::text, 54::integer, 'B'::text, '356'::text, '2016-10-24'::date, 0::integer, 'M'::text, 'FRA'::text, '2022-06-16 00:00:00'::timestamp, null::text, null::timestamp, null::integer, null::text, null::timestamp, 'I'::text, null::text),
      (1, 152, 'NOTA DE CRÉDITO', 'OTR', '125', null, '2016-12-28', 1, 1, 'VIGENTE', 900, 900, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 357', 55, 'B', '357', '2016-10-26', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 153, 'NOTA DE CRÉDITO', 'OTR', '137', null, '2017-02-24', 1, 1, 'VIGENTE', 41819.4, 41819.4, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 359', 56, 'B', '359', '2016-10-28', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 154, 'NOTA DE CRÉDITO', 'OTR', '142', null, '2017-03-20', 1, 1, 'VIGENTE', 8991.75, 8991.75, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 363', 57, 'B', '363', '2016-11-03', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 155, 'NOTA DE CRÉDITO', 'OTR', '137', null, '2017-02-24', 1, 1, 'VIGENTE', 3909.25, 3909.25, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 367', 58, 'B', '367', '2016-11-11', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 156, 'NOTA DE CRÉDITO', 'OTR', '137', null, '2017-02-24', 1, 1, 'VIGENTE', 2968.75, 2968.75, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 370', 59, 'B', '370', '2016-11-21', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 157, 'NOTA DE CRÉDITO', 'OTR', '137', null, '2017-02-24', 1, 1, 'VIGENTE', 900, 900, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 372', 60, 'B', '372', '2016-11-28', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 158, 'NOTA DE CRÉDITO', 'OTR', '137', null, '2017-02-24', 1, 1, 'VIGENTE', 900, 900, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 373', 61, 'B', '373', '2016-12-01', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 159, 'NOTA DE CRÉDITO', 'OTR', '142', null, '2017-03-20', 1, 1, 'VIGENTE', 6417.25, 6417.25, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 385', 62, 'B', '385', '2017-01-11', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 160, 'NOTA DE CRÉDITO', 'OTR', '142', null, '2017-03-20', 1, 1, 'VIGENTE', 13399.75, 13399.75, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 386', 63, 'B', '386', '2017-01-11', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 161, 'NOTA DE CRÉDITO', 'OTR', '142', null, '2017-03-20', 1, 1, 'VIGENTE', 127991.4, 127991.4, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 392', 64, 'B', '392', '2017-01-16', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 162, 'NOTA DE CRÉDITO', 'OTR', '143', null, '2017-03-29', 1, 1, 'VIGENTE', 2725, 2725, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 393', 65, 'B', '393', '2017-01-16', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 163, 'NOTA DE CRÉDITO', 'OTR', '143', null, '2017-03-29', 1, 1, 'VIGENTE', 360, 360, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 394', 66, 'B', '394', '2017-01-18', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 164, 'NOTA DE CRÉDITO', 'OTR', '143', null, '2017-03-29', 1, 1, 'VIGENTE', 6650, 6650, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 396', 67, 'B', '396', '2017-01-18', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 165, 'NOTA DE CRÉDITO', 'OTR', '143', null, '2017-03-29', 1, 1, 'VIGENTE', 900, 900, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 399', 68, 'B', '399', '2017-01-24', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 166, 'NOTA DE CRÉDITO', 'OTR', '143', null, '2017-03-29', 1, 1, 'VIGENTE', 400, 400, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 401', 69, 'B', '401', '2017-01-25', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 167, 'NOTA DE CRÉDITO', 'OTR', '1630', null, '2016-03-08', 1, 1, 'VIGENTE', 540, 540, 1, 'FUTURA FARMA', 1881, 'MEDICARE DE GUATEMALA', 2, 'DESCUENTO', 'Descuento en la factura:  - 1651', 356, null, '1651', '2016-01-28', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 168, 'NOTA DE CRÉDITO', 'OTR', '1630', null, '2016-03-08', 1, 1, 'VIGENTE', 540, 540, 1, 'FUTURA FARMA', 1881, 'MEDICARE DE GUATEMALA', 2, 'DESCUENTO', 'Descuento en la factura:  - 1655', 357, null, '1655', '2016-02-01', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 169, 'NOTA DE CRÉDITO', 'OTR', '1629', null, '2016-03-08', 1, 1, 'VIGENTE', 810, 810, 1, 'FUTURA FARMA', 1881, 'MEDICARE DE GUATEMALA', 2, 'DESCUENTO', 'Descuento en la factura:  - 1698', 358, null, '1698', '2016-02-19', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 170, 'NOTA DE CRÉDITO', 'OTR', '1686', null, '2016-05-05', 1, 1, 'VIGENTE', 715, 715, 1, 'FUTURA FARMA', 1881, 'MEDICARE DE GUATEMALA', 2, 'DESCUENTO', 'Descuento en la factura:  - 1765', 359, null, '1765', '2016-03-16', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 171, 'NOTA DE CRÉDITO', 'OTR', '1707', null, '2016-05-20', 1, 1, 'VIGENTE', 175, 175, 1, 'FUTURA FARMA', 1881, 'MEDICARE DE GUATEMALA', 2, 'DESCUENTO', 'Descuento en la factura:  - 1797', 360, null, '1797', '2016-04-05', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 172, 'NOTA DE CRÉDITO', 'OTR', '1707', null, '2016-05-20', 1, 1, 'VIGENTE', 1494, 1494, 1, 'FUTURA FARMA', 1881, 'MEDICARE DE GUATEMALA', 2, 'DESCUENTO', 'Descuento en la factura:  - 1817', 361, null, '1817', '2016-04-12', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 173, 'NOTA DE CRÉDITO', 'OTR', '1752', null, '2016-06-21', 1, 1, 'VIGENTE', 2515, 2515, 1, 'FUTURA FARMA', 1881, 'MEDICARE DE GUATEMALA', 2, 'DESCUENTO', 'Descuento en la factura:  - 1885', 362, null, '1885', '2016-05-05', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 174, 'NOTA DE CRÉDITO', 'OTR', '1781', null, '2016-07-12', 1, 1, 'VIGENTE', 1201, 1201, 1, 'FUTURA FARMA', 1881, 'MEDICARE DE GUATEMALA', 2, 'DESCUENTO', 'Descuento en la factura:  - 1937', 363, null, '1937', '2016-05-20', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 175, 'NOTA DE CRÉDITO', 'OTR', '1865', null, '2016-08-05', 1, 1, 'VIGENTE', 425, 425, 1, 'FUTURA FARMA', 1881, 'MEDICARE DE GUATEMALA', 2, 'DESCUENTO', 'Descuento en la factura:  - 1982', 364, null, '1982', '2016-06-02', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 176, 'NOTA DE CRÉDITO', 'OTR', '1865', null, '2016-08-05', 1, 1, 'VIGENTE', 1015, 1015, 1, 'FUTURA FARMA', 1881, 'MEDICARE DE GUATEMALA', 2, 'DESCUENTO', 'Descuento en la factura: FC - 1995', 365, 'FC', '1995', '2016-06-08', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 177, 'NOTA DE CRÉDITO', 'OTR', '1898', null, '2016-09-06', 1, 1, 'VIGENTE', 975, 975, 1, 'FUTURA FARMA', 1881, 'MEDICARE DE GUATEMALA', 2, 'DESCUENTO', 'Descuento en la factura: FC - 2026', 366, 'FC', '2026', '2016-06-21', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 178, 'NOTA DE CRÉDITO', 'OTR', '1929', null, '2016-10-10', 1, 1, 'VIGENTE', 1445, 1445, 1, 'FUTURA FARMA', 1881, 'MEDICARE DE GUATEMALA', 2, 'DESCUENTO', 'Descuento en la factura: FC - 2167', 367, 'FC', '2167', '2016-08-10', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 179, 'NOTA DE CRÉDITO', 'OTR', '210423', null, '2016-03-10', 1, 1, 'VIGENTE', 250, 250, 1, 'FUTURA FARMA', 1882, 'LABORATORIOS FARMACEUTICOS Y COSMETICOS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C - 68799', 343, 'C', '68799', '2016-02-08', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 180, 'NOTA DE CRÉDITO', 'OTR', '210423', null, '2016-03-10', 1, 1, 'VIGENTE', 704, 704, 1, 'FUTURA FARMA', 1882, 'LABORATORIOS FARMACEUTICOS Y COSMETICOS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C - 68946', 344, 'C', '68946', '2016-02-12', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 181, 'NOTA DE CRÉDITO', 'OTR', '210592', null, '2016-04-21', 1, 1, 'VIGENTE', 398, 398, 1, 'FUTURA FARMA', 1882, 'LABORATORIOS FARMACEUTICOS Y COSMETICOS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C - 69348', 345, 'C', '69348', '2016-03-01', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 182, 'NOTA DE CRÉDITO', 'OTR', '211339', null, '2016-05-18', 1, 1, 'VIGENTE', 1408.39, 1408.39, 1, 'FUTURA FARMA', 1882, 'LABORATORIOS FARMACEUTICOS Y COSMETICOS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C - 70399', 346, 'C', '70399', '2016-04-13', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 183, 'NOTA DE CRÉDITO', 'OTR', '212936', null, '2016-07-11', 1, 1, 'VIGENTE', 1046.01, 1046.01, 1, 'FUTURA FARMA', 1882, 'LABORATORIOS FARMACEUTICOS Y COSMETICOS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C - 71210', 347, 'C', '71210', '2016-05-13', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 184, 'NOTA DE CRÉDITO', 'OTR', '213356', null, '2016-07-09', 1, 1, 'VIGENTE', 657.5, 657.5, 1, 'FUTURA FARMA', 1882, 'LABORATORIOS FARMACEUTICOS Y COSMETICOS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C - 71774', 348, 'C', '71774', '2016-06-02', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 185, 'NOTA DE CRÉDITO', 'OTR', '213356', null, '2016-07-09', 1, 1, 'VIGENTE', 1116.25, 1116.25, 1, 'FUTURA FARMA', 1882, 'LABORATORIOS FARMACEUTICOS Y COSMETICOS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C - 71862', 349, 'C', '71862', '2016-06-06', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 186, 'NOTA DE CRÉDITO', 'OTR', '213356', null, '2016-07-09', 1, 1, 'VIGENTE', 216.25, 216.25, 1, 'FUTURA FARMA', 1882, 'LABORATORIOS FARMACEUTICOS Y COSMETICOS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C - 71905', 350, 'C', '71905', '2016-06-08', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 187, 'NOTA DE CRÉDITO', 'OTR', '213392', null, '2016-08-08', 1, 1, 'VIGENTE', 414, 414, 1, 'FUTURA FARMA', 1882, 'LABORATORIOS FARMACEUTICOS Y COSMETICOS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C - 72275', 351, 'C', '72275', '2016-08-03', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 188, 'NOTA DE CRÉDITO', 'OTR', '214007', null, '2016-08-17', 1, 1, 'VIGENTE', 1372.5, 1372.5, 1, 'FUTURA FARMA', 1882, 'LABORATORIOS FARMACEUTICOS Y COSMETICOS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C - 72787', 352, 'C', '72787', '2016-07-12', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 189, 'NOTA DE CRÉDITO', 'OTR', '214631', null, '2016-09-21', 1, 1, 'VIGENTE', 275.82, 275.82, 1, 'FUTURA FARMA', 1882, 'LABORATORIOS FARMACEUTICOS Y COSMETICOS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C - 73277', 353, 'C', '73277', '2016-08-01', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 190, 'NOTA DE CRÉDITO', 'OTR', '214631', null, '2016-09-21', 1, 1, 'VIGENTE', 300, 300, 1, 'FUTURA FARMA', 1882, 'LABORATORIOS FARMACEUTICOS Y COSMETICOS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C - 73858', 354, 'C', '73858', '2016-08-23', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 191, 'NOTA DE CRÉDITO', 'OTR', '216682', null, '2017-01-18', 1, 1, 'VIGENTE', 1264.76, 1264.76, 1, 'FUTURA FARMA', 1882, 'LABORATORIOS FARMACEUTICOS Y COSMETICOS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C - 75939', 355, 'C', '75939', '2016-08-23', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 192, 'NOTA DE CRÉDITO', 'OTR', '175', null, '2017-09-05', 1, 1, 'VIGENTE', 39436.8, 39436.8, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 467', 90, 'B', '467', '2017-06-19', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 193, 'NOTA DE CRÉDITO', 'OTR', '147', null, '2017-04-24', 1, 1, 'VIGENTE', 3175.85, 3175.85, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 402', 70, 'B', '402', '2017-02-06', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 194, 'NOTA DE CRÉDITO', 'OTR', '147', null, '2017-04-24', 1, 1, 'VIGENTE', 1769.5, 1769.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 403', 71, 'B', '403', '2017-02-10', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 195, 'NOTA DE CRÉDITO', 'OTR', '147', null, '2017-04-24', 1, 1, 'VIGENTE', 5177.5, 5177.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 405', 72, 'B', '405', '2017-02-16', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 196, 'NOTA DE CRÉDITO', 'OTR', '147', null, '2017-04-24', 1, 1, 'VIGENTE', 26949.6, 26949.6, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 409', 73, 'B', '409', '2017-02-22', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 197, 'NOTA DE CRÉDITO', 'OTR', '155', null, '2017-05-23', 1, 1, 'VIGENTE', 6201.12, 6201.12, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 415', 74, 'B', '415', '2017-03-03', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 198, 'NOTA DE CRÉDITO', 'OTR', '155', null, '2017-05-23', 1, 1, 'VIGENTE', 20, 20, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 425', 76, 'B', '425', '2017-03-09', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 199, 'NOTA DE CRÉDITO', 'OTR', '155', null, '2017-05-23', 1, 1, 'VIGENTE', 31903.8, 31903.8, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 421', 75, 'B', '421', '2017-03-06', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 200, 'NOTA DE CRÉDITO', 'OTR', '155', null, '2017-05-23', 1, 1, 'VIGENTE', 13129, 13129, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 428', 77, 'B', '428', '2017-03-13', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 201, 'NOTA DE CRÉDITO', 'OTR', '155', null, '2017-05-23', 1, 1, 'VIGENTE', 11191, 11191, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 429', 78, 'B', '429', '2017-03-22', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 202, 'NOTA DE CRÉDITO', 'OTR', '155', null, '2017-05-23', 1, 1, 'VIGENTE', 5177.5, 5177.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 433', 79, 'B', '433', '2017-03-20', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 203, 'NOTA DE CRÉDITO', 'OTR', '160', null, '2017-06-28', 1, 1, 'VIGENTE', 1500, 1500, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 437', 80, 'B', '437', '2017-03-27', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 204, 'NOTA DE CRÉDITO', 'OTR', '160', null, '2017-06-28', 1, 1, 'VIGENTE', 2588.75, 2588.75, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 439', 81, 'B', '439', '2017-03-31', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 205, 'NOTA DE CRÉDITO', 'OTR', '160', null, '2017-06-28', 1, 1, 'VIGENTE', 12402.25, 12402.25, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 441', 82, 'B', '441', '2017-04-17', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 206, 'NOTA DE CRÉDITO', 'OTR', '160', null, '2017-06-28', 1, 1, 'VIGENTE', 32565.96, 32565.96, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 450', 83, 'B', '450', '2017-05-03', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 208, 'NOTA DE CRÉDITO', 'OTR', '167', null, '2017-07-31', 1, 1, 'VIGENTE', 4104, 4104, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 454', 85, 'B', '454', '2017-05-09', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 209, 'NOTA DE CRÉDITO', 'OTR', '167', null, '2017-07-31', 1, 1, 'VIGENTE', 43560.42, 43560.42, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 451', 84, 'B', '451', '2017-05-05', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 210, 'NOTA DE CRÉDITO', 'OTR', '167', null, '2017-07-31', 1, 1, 'VIGENTE', 5130, 5130, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 459', 86, 'B', '459', '2017-05-17', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 211, 'NOTA DE CRÉDITO', 'OTR', '175', null, '2019-09-05', 1, 1, 'VIGENTE', 60000, 60000, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 461', 87, 'B', '461', '2017-05-23', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 213, 'NOTA DE CRÉDITO', 'A', '313', null, '2017-08-30', 1, 1, 'VIGENTE', 20940, 20940, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 461', 87, 'B', '461', '2017-05-23', 0, 'M', 'FRA', '2022-06-16 00:00:00', 'FRA', '2022-06-16 00:00:00', null, null, null, 'I', null),
      (1, 214, 'NOTA DE CRÉDITO', 'OTR', '173', null, '2017-08-31', 1, 1, 'VIGENTE', 269, 269, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 462', 88, 'B', '462', '2017-05-30', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 215, 'NOTA DE CRÉDITO', 'OTR', '173', null, '2017-09-05', 1, 1, 'VIGENTE', 4243.5, 4243.5, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 461', 87, 'B', '461', '2017-05-23', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 216, 'NOTA DE CRÉDITO', 'OTR', '173', null, '2017-08-31', 1, 1, 'VIGENTE', 2000, 2000, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 465', 89, 'B', '465', '2017-06-09', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 217, 'NOTA DE CRÉDITO', 'OTR', '175', null, '2017-09-05', 1, 1, 'VIGENTE', 1536, 1536, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: B - 471', 91, 'B', '471', '2017-07-06', 0, 'M', 'FRA', '2022-06-16 00:00:00', null, null, null, null, null, 'I', null),
      (1, 218, 'NOTA DE CRÉDITO', 'A', '2', null, '2022-01-05', 1, 1, 'VIGENTE', 163.1, 163.1, 1, 'FUTURA FARMA', 1888, 'MAVISA PHARMACEUTICALS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: A - 31 (DEVOLUCIÓN DE FLUCONAZOL 7 UNIDADES)', 400, 'A', '31', '2021-12-08', 0, 'M', 'OLM', '2022-07-21 00:00:00', null, null, null, null, null, 'I', null),
      (1, 219, 'NOTA DE CRÉDITO', 'E0E2011E', '340018961', null, '2021-06-24', 1, 1, 'VIGENTE', null, null, 1, 'FUTURA FARMA', 1879, 'VITALIS, S.A', 2, 'DESCUENTO', 'Descuento en la factura: 6B067FD3 - 657802235', null, '6B067FD3', '657802235', null, 0, 'M', 'OLM', '2022-09-02 00:00:00', 'OLM', '2022-09-02 00:00:00', null, null, null, 'I', null),
      (2, 1, 'NOTA DE CRÉDITO', '4650F3E6', '1436041902', '4650F3E6-5598-42AE-AA2D-66E0F63DBA33', '2021-07-21', 1, 1, 'VIGENTE', 95, 95, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'Por faltante de productos según factura: 11839E49 - 1212696483', 8, 'BB508368', '1854358313', '2021-07-30', 0, 'M', 'JRA', '2021-12-06 00:00:00', 'OLM', '2022-09-02 00:00:00', null, null, null, 'I', null),
      (2, 2, 'NOTA DE CRÉDITO', 'BA419592', '4194582898', 'BA419562-FA04-4172-9460-2AE436C669EF', '2021-07-13', 1, 1, 'VIGENTE', 20851.91, 20851.91, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 11839E49 - 1212696483', 3, '11839E49', '1212696483', '2021-07-13', 0, 'M', 'JRA', '2021-12-09 00:00:00', null, null, null, null, null, 'I', null),
      (2, 3, 'NOTA DE CRÉDITO', 'CF924AB3', '2671657666', 'CF924AB3-9F3E-42C2-A347-E7ECA02286A7', '2021-07-19', 1, 1, 'ANULADA', 5118.75, 5118.75, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura:  - 1073826184', null, null, '1073826184', null, 0, 'M', 'JRA', '2021-12-10 00:00:00', 'JRA', '2021-12-10 00:00:00', null, null, null, 'A', null),
      (2, 4, 'NOTA DE CRÉDITO', '971EDA88', '4066070261', '971EDA88-F25B-4EF5-80B2-DD41C42684CD', '2021-07-30', 1, 1, 'VIGENTE', 4650, 4650, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: BB508368 - 1854358313', 8, 'BB508368', '1854358313', '2021-07-30', 0, 'M', 'JRA', '2021-12-10 00:00:00', null, null, null, null, null, 'I', null),
      (2, 5, 'NOTA DE CRÉDITO', '982EBF42', '3021948076', '982EBF42-B41F-44AC-8CE5-6ABA2F7E05D1', '2021-07-23', 1, 1, 'VIGENTE', 3714.98, 3714.98, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B013D431 - 3748874063', 6, 'B013D431', '3748874063', '2021-07-23', 0, 'M', 'JRA', '2021-12-10 00:00:00', null, null, null, null, null, 'I', null),
      (2, 6, 'NOTA DE CRÉDITO', '5C68A497', '1222856697', '5C68A497-48E34FF9-BA24-94207BF10570', '2021-07-23', 1, 1, 'ANULADA', 10115.38, 10115.38, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura:  - 200359980', null, null, '200359980', null, 0, 'M', 'JRA', '2021-12-10 00:00:00', 'JRA', '2021-12-10 00:00:00', null, null, null, 'A', null),
      (2, 7, 'NOTA DE CRÉDITO', '73C78459', '634733325', '73C78459-25D5-430D-A263-DEE5CFD53E4D', '2021-07-30', 1, 1, 'ANULADA', 8790.13, 8790.13, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura:  - 64899611', null, null, '64899611', null, 0, 'M', 'JRA', '2021-12-10 00:00:00', 'JRA', '2021-12-10 00:00:00', null, null, null, 'A', null),
      (2, 8, 'NOTA DE CRÉDITO', '2BF5AF79', '3664858054', '2BF5AF79-DA71-4BC6-A8E3-4B208F4F037F', '2021-07-30', 1, 1, 'VIGENTE', 8405.38, 8405.38, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 9A889722 - 1872707724', 10, '9A889722', '1872707724', '2021-07-30', 0, 'M', 'JRA', '2021-12-10 00:00:00', null, null, null, null, null, 'I', null),
      (2, 9, 'NOTA DE CRÉDITO', '2040C15F', '1297763184', '2040C15F-4D5A-4B70-AAA9-D18711995E43', '2021-08-23', 1, 1, 'VIGENTE', 15482.28, 15482.28, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 28CFA239 - 2309767698', 12, '28CFA239', '2309767698', '2021-08-23', 0, 'M', 'JRA', '2021-12-10 00:00:00', null, null, null, null, null, 'I', null),
      (2, 10, 'NOTA DE CRÉDITO', '0517DFD9', '2368815570', '0517DFD9-8D31-41D2-9E2D-272CF0A67F20', '2021-09-09', 1, 1, 'VIGENTE', 7046.86, 7046.86, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: ECA35EFA - 941771372', 13, 'ECA35EFA', '941771372', '2021-09-09', 0, 'M', 'JRA', '2021-12-10 00:00:00', null, null, null, null, null, 'I', null),
      (2, 11, 'NOTA DE CRÉDITO', 'C684E1CD', '2003650918', 'C684E1CD-776D-4966-8CAD-A6F04E9B849B', '2021-09-23', 1, 1, 'VIGENTE', 11169.28, 11169.28, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 9FF07F5C - 1423196949', 14, '9FF07F5C', '1423196949', '2021-09-22', 0, 'M', 'JRA', '2021-12-10 00:00:00', null, null, null, null, null, 'I', null),
      (2, 12, 'NOTA DE CRÉDITO', 'E3C0874A', '2265663102', 'E3C0874A-870B-467E-8F71-894C865A9BFF', '2021-09-28', 1, 1, 'VIGENTE', 12279.1, 12279.1, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 429196A6 - 2474920446', 15, '429196A6', '2474920446', '2021-09-28', 0, 'M', 'JRA', '2021-12-10 00:00:00', null, null, null, null, null, 'I', null),
      (2, 13, 'NOTA DE CRÉDITO', 'B67BBE67', '2450998703', 'B67BBE67-9217-45AF-92DA-50BFB9449603', '2021-10-11', 1, 1, 'VIGENTE', 2100, 2100, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 7B264F9A - 2036485907', 16, '7B264F9A', '2036485907', '2021-10-11', 0, 'M', 'JRA', '2021-12-10 00:00:00', null, null, null, null, null, 'I', null),
      (2, 14, 'NOTA DE CRÉDITO', '3DD6B996', '1129729533', '3DD6B996-4356-4DFD-B616-E811286508DF', '2021-10-27', 1, 1, 'VIGENTE', 7110, 7110, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: DFA1BD52 - 748832590', 17, 'DFA1BD52', '748832590', '2021-10-27', 0, 'M', 'JRA', '2021-12-10 00:00:00', null, null, null, null, null, 'I', null),
      (2, 15, 'NOTA DE CRÉDITO', '47844293', '2261730875', '47844293-86CF-463B-816D-9FF28C8D73EA', '2021-11-18', 1, 1, 'VIGENTE', 12446.3, 12446.3, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 3D0764B7 - 791299053', 18, '3D0764B7', '791299053', '2021-11-12', 0, 'M', 'JRA', '2021-12-10 00:00:00', null, null, null, null, null, 'I', null),
      (2, 16, 'NOTA DE CRÉDITO', 'AD2F6F85', '781402901', null, '2022-02-15', 1, 1, 'VIGENTE', 7.9, 7.9, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', '10 DICLOFENACOS QUEBRADOS', 33, '8F51695C', '2651212163', '2022-04-25', 0, 'M', 'OLM', '2022-02-24 00:00:00', 'OLM', '2022-09-03 00:00:00', null, null, null, 'I', null),
      (2, 17, 'NOTA DE CRÉDITO', 'E0E2011E', '340018961', null, '2021-06-24', 1, 1, 'VIGENTE', 15262.71, 15262.71, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 6B067FD3 - 657802235', 1, '6B067FD3', '657802235', '2021-06-24', 0, 'M', 'OLM', '2022-09-02 00:00:00', null, null, null, null, null, 'I', null),
      (2, 18, 'NOTA DE CRÉDITO', '5F99C786', '2963686661', null, '2021-07-01', 1, 1, 'VIGENTE', 10192.54, 10192.54, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 376E64DA - 477513088', 2, '376E64DA', '477513088', '2021-06-30', 0, 'M', 'OLM', '2022-09-02 00:00:00', 'OLM', '2022-09-02 00:00:00', null, null, null, 'I', null),
      (2, 19, 'NOTA DE CRÉDITO', 'F2CFF31A', '2183414007', null, '2021-07-30', 1, 1, 'VIGENTE', 1.5, 1.5, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: BB508368 - 1854358313', 8, 'BB508368', '1854358313', '2021-07-30', 0, 'M', 'OLM', '2022-09-02 00:00:00', null, null, null, null, null, 'I', null),
      (2, 20, 'NOTA DE CRÉDITO', 'F5E87805', '1305169866', null, '2021-07-22', 1, 1, 'VIGENTE', 4776.25, 4776.25, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B70ACBE3 - 3900198561', 5, 'B70ACBE3', '3900198561', '2021-07-21', 0, 'M', 'OLM', '2022-09-02 00:00:00', 'OLM', '2022-09-02 00:00:00', null, null, null, 'I', null),
      (2, 21, 'NOTA DE CRÉDITO', '426811AD', '811617357', null, '2021-08-16', 1, 1, 'VIGENTE', 6630.9, 6630.9, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: F098E02C - 2985577793', 11, 'F098E02C', '2985577793', '2021-08-16', 0, 'M', 'OLM', '2022-09-02 00:00:00', 'OLM', '2022-09-02 00:00:00', null, null, null, 'I', null),
      (2, 22, 'NOTA DE CRÉDITO', '7224268F', '466569946', null, '2021-12-03', 1, 1, 'VIGENTE', 7.5, 7.5, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 2C02BADD - 2429373206', 19, '2C02BADD', '2429373206', '2021-11-30', 0, 'M', 'OLM', '2022-09-02 00:00:00', null, null, null, null, null, 'I', null),
      (2, 23, 'NOTA DE CRÉDITO', '155F95C5', '163007284', null, '2021-12-15', 1, 1, 'VIGENTE', 22043.22, 22043.22, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 2C02BADD - 2429373206', 19, '2C02BADD', '2429373206', '2021-11-30', 0, 'M', 'OLM', '2022-09-02 00:00:00', null, null, null, null, null, 'I', null),
      (2, 24, 'NOTA DE CRÉDITO', '0C58EB04', '2065515444', null, '2021-12-14', 1, 1, 'VIGENTE', 18.75, 18.75, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 18B8A19E - 1904888599', 20, '18B8A19E', '1904888599', '2021-12-08', 0, 'M', 'OLM', '2022-09-02 00:00:00', null, null, null, null, null, 'I', null),
      (2, 25, 'NOTA DE CRÉDITO', '551D69A6', '3386853134', null, '2021-12-14', 1, 1, 'VIGENTE', 6202.93, 6202.93, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 18B8A19E - 1904888599', 20, '18B8A19E', '1904888599', '2021-12-08', 0, 'M', 'OLM', '2022-09-02 00:00:00', null, null, null, null, null, 'I', null),
      (2, 26, 'NOTA DE CRÉDITO', 'E8A2606D', '2924629024', null, '2021-12-14', 1, 1, 'VIGENTE', 14.68, 14.68, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 18B8A19E - 1904888599', 20, '18B8A19E', '1904888599', '2021-12-08', 0, 'M', 'OLM', '2022-09-02 00:00:00', null, null, null, null, null, 'I', null),
      (2, 27, 'NOTA DE CRÉDITO', 'DA185CCF', '2574208123', null, '2021-12-15', 1, 1, 'VIGENTE', 21575.6, 21575.6, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 4D17F0C6 - 592267291', 21, '4D17F0C6', '592267291', '2021-12-14', 0, 'M', 'OLM', '2022-09-02 00:00:00', null, null, null, null, null, 'I', null),
      (2, 28, 'NOTA DE CRÉDITO', 'D4E06C85', '2335393181', null, '2021-12-31', 1, 1, 'VIGENTE', 4264, 4264, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: F73CA545 - 3484700127', 22, 'F73CA545', '3484700127', '2021-12-17', 0, 'M', 'OLM', '2022-09-02 00:00:00', null, null, null, null, null, 'I', null),
      (2, 29, 'NOTA DE CRÉDITO', 'B8323A9C', '1412121079', null, '2022-01-31', 1, 1, 'VIGENTE', 21427.35, 21427.35, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 85E967EF - 3687401598', 24, '85E967EF', '3687401598', '2022-01-26', 0, 'M', 'OLM', '2022-09-02 00:00:00', null, null, null, null, null, 'I', null),
      (2, 30, 'NOTA DE CRÉDITO', '3E41CB0A', '278152340', null, '2022-01-27', 1, 1, 'VIGENTE', 42179.23, 42179.23, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C0748C1D - 1793805092', 23, 'C0748C1D', '1793805092', '2022-01-18', 0, 'M', 'OLM', '2022-09-02 00:00:00', null, null, null, null, null, 'I', null),
      (2, 31, 'NOTA DE CRÉDITO', '13DB10FD', '1906329500', null, '2022-02-17', 1, 1, 'VIGENTE', 18550.3, 18550.3, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: ACBE23FB - 291325061', 25, 'ACBE23FB', '291325061', '2022-02-09', 0, 'M', 'OLM', '2022-09-02 00:00:00', null, null, null, null, null, 'I', null),
      (2, 32, 'NOTA DE CRÉDITO', 'C5D2D9AA', '3852289060', null, '2022-02-28', 1, 1, 'VIGENTE', 16727.23, 16727.23, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 46F46496 - 65225623', 27, '46F46496', '65225623', '2022-02-21', 0, 'M', 'OLM', '2022-09-03 00:00:00', null, null, null, null, null, 'I', null),
      (2, 33, 'NOTA DE CRÉDITO', '574886F1', '3683862497', null, '2022-02-28', 1, 1, 'VIGENTE', 105, 105, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A3FB0420 - 123095042', 26, 'A3FB0420', '123095042', '2022-02-16', 0, 'M', 'OLM', '2022-09-03 00:00:00', null, null, null, null, null, 'I', null),
      (2, 34, 'NOTA DE CRÉDITO', '2EE372AE', '1484670050', null, '2022-03-11', 1, 1, 'VIGENTE', 12154.5, 12154.5, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 117F8E3B - 2118862527', 29, '117F8E3B', '2118862527', '2022-03-10', 0, 'M', 'OLM', '2022-09-03 00:00:00', null, null, null, null, null, 'I', null),
      (2, 35, 'NOTA DE CRÉDITO', 'F6F3E948', '1022970452', null, '2022-03-28', 1, 1, 'VIGENTE', 18795, 18795, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 2CB5C375 - 3322299972', 30, '2CB5C375', '3322299972', '2022-03-18', 0, 'M', 'OLM', '2022-09-03 00:00:00', null, null, null, null, null, 'I', null),
      (2, 36, 'NOTA DE CRÉDITO', '3BFCA36F', '2511553801', null, '2022-04-19', 1, 1, 'VIGENTE', 5698, 5698, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 8FE52AD0 - 991182977', 31, '8FE52AD0', '991182977', '2022-03-25', 0, 'M', 'OLM', '2022-09-03 00:00:00', null, null, null, null, null, 'I', null),
      (2, 37, 'NOTA DE CRÉDITO', '9DF0ECD8', '119817163', null, '2022-04-29', 1, 1, 'VIGENTE', 17128.75, 17128.75, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 8F51695C - 2651212163', 33, '8F51695C', '2651212163', '2022-04-25', 0, 'M', 'OLM', '2022-09-03 00:00:00', null, null, null, null, null, 'I', null),
      (2, 38, 'NOTA DE CRÉDITO', '6E000E80', '1693470671', null, '2022-04-19', 1, 1, 'OPERADA', 210, 210, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: 8F51695C - 2651212163', 33, '8F51695C', '2651212163', '2022-04-25', 0, 'M', 'OLM', '2022-09-03 00:00:00', 'OLM', '2023-07-06 00:00:00', null, null, null, 'O', null),
      (2, 39, 'NOTA DE CRÉDITO', '34E042B2', '2333294913', null, '2022-04-19', 1, 1, 'VIGENTE', 15276, 15276, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A507D581 - 2648720285', 32, 'A507D581', '2648720285', '2022-04-08', 0, 'M', 'OLM', '2022-09-03 00:00:00', null, null, null, null, null, 'I', null),
      (2, 40, 'NOTA DE CRÉDITO', '1A425C4B', '3956887337', null, '2022-05-17', 1, 1, 'VIGENTE', 64204.94, 64204.94, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C25F92DA - 774259499', 34, 'C25F92DA', '774259499', '2022-05-05', 0, 'M', 'OLM', '2022-09-03 00:00:00', null, null, null, null, null, 'I', null),
      (2, 41, 'NOTA DE CRÉDITO', '610ECA18', '3177006548', null, '2022-05-12', 1, 1, 'VIGENTE', 10836, 10836, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C25F92DA - 774259499  por Devolución de Fluconazol 516 und Lote P2131452', 34, 'C25F92DA', '774259499', '2022-05-05', 0, 'M', 'OLM', '2022-09-03 00:00:00', 'OLM', '2022-09-03 00:00:00', null, null, null, 'I', null),
      (2, 42, 'NOTA DE CRÉDITO', '842A7043', '359353993', null, '2022-05-26', 1, 1, 'VIGENTE', 4722.5, 4722.5, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: BADC3F39 - 2803650295', 35, 'BADC3F39', '2803650295', '2022-05-20', 0, 'M', 'OLM', '2022-09-03 00:00:00', null, null, null, null, null, 'I', null),
      (2, 43, 'NOTA DE CRÉDITO', 'A0CE904E', '3956035550', null, '2022-06-20', 1, 1, 'VIGENTE', 51175.25, 51175.25, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B239991A - 3724627062', 37, 'B239991A', '3724627062', '2022-06-08', 0, 'M', 'OLM', '2022-09-03 00:00:00', null, null, null, null, null, 'I', null),
      (2, 44, 'NOTA DE CRÉDITO', '5697DCE3', '2504412091', null, '2022-06-29', 1, 1, 'VIGENTE', 1871, 1871, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 26EFF2DF - 864636751', 38, '26EFF2DF', '864636751', '2022-06-23', 0, 'M', 'OLM', '2022-09-03 00:00:00', null, null, null, null, null, 'I', null),
      (2, 45, 'NOTA DE CRÉDITO', '3B4EFFBE', '402147528', null, '2022-08-17', 1, 1, 'ANULADA', 22153.5, 22153.5, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 46E06093 - 3734783765', 41, '46E06093', '3734783765', '2022-08-05', 0, 'M', 'OLM', '2022-09-03 00:00:00', 'OLM', '2023-07-06 00:00:00', null, null, null, 'A', null),
      (2, 46, 'NOTA DE CRÉDITO', 'B239991A', '3724627062', null, '2022-06-08', 1, 1, 'VIGENTE', 0.01, 0.01, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B239991A - 3724627062  Cuadre por 0.01 diferencia', 37, 'B239991A', '3724627062', '2022-06-08', 0, 'M', 'OLM', '2022-09-03 00:00:00', 'OLM', '2022-09-03 00:00:00', null, null, null, 'I', null),
      (2, 47, 'NOTA DE CRÉDITO', '8F50E833', '1084050811', null, '2022-07-29', 1, 1, 'VIGENTE', 38140.07, 38140.07, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 2DF5791F - 1693403526', 40, '2DF5791F', '1693403526', '2022-07-15', 0, 'M', 'OLM', '2022-09-04 00:00:00', null, null, null, null, null, 'I', null),
      (2, 48, 'NOTA DE CRÉDITO', 'CD135EA1', '4275389622', null, '2022-07-29', 1, 1, 'VIGENTE', 18344.2, 18344.2, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 74193148 - 220545456', 39, '74193148', '220545456', '2022-07-15', 0, 'M', 'OLM', '2022-09-04 00:00:00', null, null, null, null, null, 'I', null),
      (2, 49, 'NOTA DE CRÉDITO', '6E6A61BF', '900874241', null, '2023-06-26', 1, 1, 'ANULADA', 3590, 3590, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: FE06CE93 - 3322367876', null, 'FE06CE93', '3322367876', null, 0, 'M', 'OLM', '2023-07-05 00:00:00', 'OLM', '2023-07-05 00:00:00', null, null, null, 'A', null),
      (2, 50, 'NOTA DE CRÉDITO', '6E6A61BF', '900874241', null, '2023-06-26', 1, 1, 'VIGENTE', 3590, 3590, 1, 'FUTURA FARMA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: FE06CE93 - 3322367876', 68, 'FE06CE93', '3322367876', '2023-06-21', 0, 'M', 'OLM', '2023-07-05 00:00:00', 'OLM', '2023-07-05 00:00:00', null, null, null, 'I', null),
      (2, 51, 'NOTA DE CRÉDITO', '2BBA1046', '2514044636', null, '2023-06-21', 1, 1, 'OPERADA', 90, 90, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO EN MAL ESTADO', 69, '1FD4738B', '3759294163', '2023-06-19', 0, 'M', 'OLM', '2023-07-05 00:00:00', 'OLM', '2023-07-05 00:00:00', null, null, null, 'O', null),
      (2, 52, 'NOTA DE CRÉDITO', '09289777', '4010953760', null, '2023-06-26', 1, 1, 'VIGENTE', 3150, 3150, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 1FD4738B - 3759294163', 69, '1FD4738B', '3759294163', '2023-06-19', 0, 'M', 'OLM', '2023-07-05 00:00:00', null, null, null, null, null, 'I', null),
      (2, 53, 'NOTA DE CRÉDITO', '53CA813D', '320423839', null, '2023-05-22', 1, 1, 'OPERADA', 24.01, 24.01, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO/MAL ESTADO', 67, '53F19315', '1040074612', '2023-05-26', 0, 'M', 'OLM', '2023-07-05 00:00:00', 'OLM', '2023-07-05 00:00:00', null, null, null, 'O', null),
      (2, 54, 'NOTA DE CRÉDITO', '3AD0D3AD', '4189929881', null, '2023-06-06', 1, 1, 'VIGENTE', 6768, 6768, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 53F19315 - 1040074612', 67, '53F19315', '1040074612', '2023-05-26', 0, 'M', 'OLM', '2023-07-05 00:00:00', null, null, null, null, null, 'I', null),
      (2, 55, 'NOTA DE CRÉDITO', '9F8CA877', '216875778', null, '2023-03-15', 1, 1, 'VIGENTE', 35415.75, 35415.75, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 2B2AFAEE - 3496296482', 60, '2B2AFAEE', '3496296482', '2023-02-28', 0, 'M', 'OLM', '2023-07-05 00:00:00', null, null, null, null, null, 'I', null),
      (2, 56, 'NOTA DE CRÉDITO', '6579A921', '3996533498', null, '2023-03-31', 1, 1, 'VIGENTE', 1420, 1420, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 7CC4D897 - 1096697194', 63, '7CC4D897', '1096697194', '2023-04-18', 0, 'M', 'OLM', '2023-07-05 00:00:00', null, null, null, null, null, 'I', null),
      (2, 57, 'NOTA DE CRÉDITO', 'B7373C6E', '3227273902', null, '2023-02-20', 1, 1, 'VIGENTE', 2343.75, 2343.75, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 35A2C01D - 2449949471', 59, '35A2C01D', '2449949471', '2023-01-31', 0, 'M', 'OLM', '2023-07-05 00:00:00', null, null, null, null, null, 'I', null),
      (2, 58, 'NOTA DE CRÉDITO', '97C5E413', '3142077055', null, '2023-01-10', 1, 1, 'OPERADA', 229, 229, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', null, 58, 'A476ED57', '2253934272', '2023-01-26', 0, 'M', 'OLM', '2023-07-05 00:00:00', 'OLM', '2023-07-05 00:00:00', null, null, null, 'O', null),
      (2, 59, 'NOTA DE CRÉDITO', '0D10FC65', '995379805', null, '2023-02-20', 1, 1, 'VIGENTE', 3315.11, 3315.11, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A476ED57 - 2253934272', 58, 'A476ED57', '2253934272', '2023-01-26', 0, 'M', 'OLM', '2023-07-05 00:00:00', null, null, null, null, null, 'I', null),
      (2, 60, 'NOTA DE CRÉDITO', 'B41E826A', '502877507', null, '2023-01-16', 1, 1, 'VIGENTE', 3877.58, 3877.58, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 104A4127 - 230967480', 57, '104A4127', '230967480', '2023-01-09', 0, 'M', 'OLM', '2023-07-05 00:00:00', null, null, null, null, null, 'I', null),
      (2, 61, 'NOTA DE CRÉDITO', 'A9C872F6', '4167519419', null, '2023-03-31', 1, 1, 'VIGENTE', 630, 630, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 9A034CF0 - 701974435', 62, '9A034CF0', '701974435', '2023-03-23', 0, 'M', 'OLM', '2023-07-05 00:00:00', null, null, null, null, null, 'I', null),
      (2, 62, 'NOTA DE CRÉDITO', '86AAA59D', '567101319', null, '2023-03-23', 1, 1, 'OPERADA', 38.9, 38.9, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', null, 62, '9A034CF0', '701974435', '2023-03-23', 0, 'M', 'OLM', '2023-07-06 00:00:00', 'OLM', '2023-07-06 00:00:00', null, null, null, 'O', null),
      (2, 63, 'NOTA DE CRÉDITO', '3B4EFFBE', '402147528', null, '2022-08-17', 1, 1, 'VIGENTE', 22153.5, 22153.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 46E06093 - 3734783765', 41, '46E06093', '3734783765', '2022-08-05', 0, 'M', 'OLM', '2023-07-06 00:00:00', 'OLM', '2023-07-06 00:00:00', null, null, null, 'I', null),
      (2, 64, 'NOTA DE CRÉDITO', 'D448094D', '1657488048', null, '2022-08-30', 1, 1, 'VIGENTE', 25281.78, 25281.78, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 43961927 - 2034844018', 42, '43961927', '2034844018', '2022-08-23', 0, 'M', 'OLM', '2023-07-06 00:00:00', null, null, null, null, null, 'I', null),
      (2, 65, 'NOTA DE CRÉDITO', 'E492EB67', '2042840054', null, '2022-09-22', 1, 1, 'VIGENTE', 26264.26, 26264.26, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 73467918 - 2869576255', 44, '73467918', '2869576255', '2022-09-13', 0, 'M', 'OLM', '2023-07-06 00:00:00', null, null, null, null, null, 'I', null),
      (2, 66, 'NOTA DE CRÉDITO', 'B7F352B3', '1810777985', null, '2022-09-29', 1, 1, 'VIGENTE', 6671.5, 6671.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: BF56B341 - 1001999476', 45, 'BF56B341', '1001999476', '2022-09-22', 0, 'M', 'OLM', '2023-07-06 00:00:00', null, null, null, null, null, 'I', null),
      (2, 67, 'NOTA DE CRÉDITO', '56EF4F90', '1009863530', null, '2022-09-29', 1, 1, 'VIGENTE', 266, 266, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 992374DE - 629293217', 46, '992374DE', '629293217', '2022-09-28', 0, 'M', 'OLM', '2023-07-06 00:00:00', null, null, null, null, null, 'I', null),
      (2, 68, 'NOTA DE CRÉDITO', 'BC011AB3', '3122086894', null, '2022-10-31', 1, 1, 'VIGENTE', 25791.84, 25791.84, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 597EA173 - 789268520', 48, '597EA173', '789268520', '2022-10-17', 0, 'M', 'OLM', '2023-07-06 00:00:00', null, null, null, null, null, 'I', null),
      (2, 69, 'NOTA DE CRÉDITO', '61EBE7E4', '834814260', null, '2022-11-30', 1, 1, 'VIGENTE', 40257.18, 40257.18, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C1B10661 - 264128122', 52, 'C1B10661', '264128122', '2022-11-14', 0, 'M', 'OLM', '2023-07-06 00:00:00', null, null, null, null, null, 'I', null),
      (2, 70, 'NOTA DE CRÉDITO', '851822C8', '127091894', null, '2022-11-30', 1, 1, 'VIGENTE', 24754.1, 24754.1, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 9F20A296 - 504712319', 49, '9F20A296', '504712319', '2022-10-28', 0, 'M', 'OLM', '2023-07-06 00:00:00', null, null, null, null, null, 'I', null),
      (2, 71, 'NOTA DE CRÉDITO', '03B7BC9A', '2361410995', null, '2022-09-06', 1, 1, 'OPERADA', 989, 989, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NC POR PRODUCTO EN MAL ESTADO/QUEBRADO', 53, 'A0F1150C', '3743172927', '2022-11-30', 0, 'M', 'OLM', '2023-07-06 00:00:00', 'OLM', '2023-07-06 00:00:00', null, null, null, 'O', null),
      (2, 72, 'NOTA DE CRÉDITO', 'C899B89B', '1903839290', null, '2022-12-05', 1, 1, 'OPERADA', 466.41, 466.41, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTOS QUEBRADOS Y FALTANTES', 53, 'A0F1150C', '3743172927', '2022-11-30', 0, 'M', 'OLM', '2023-07-06 00:00:00', 'OLM', '2023-07-06 00:00:00', null, null, null, 'O', null),
      (2, 73, 'NOTA DE CRÉDITO', '6565D071', '2682733900', null, '2022-12-15', 1, 1, 'VIGENTE', 9336, 9336, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A0F1150C - 3743172927', 53, 'A0F1150C', '3743172927', '2022-11-30', 0, 'M', 'OLM', '2023-07-06 00:00:00', null, null, null, null, null, 'I', null),
      (2, 74, 'NOTA DE CRÉDITO', 'C4CC76AA', '2189183121', null, '2022-12-15', 1, 1, 'VIGENTE', 538.5, 538.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: D0AA1C21 - 2801878053', 54, 'D0AA1C21', '2801878053', '2022-12-14', 0, 'M', 'OLM', '2023-07-06 00:00:00', null, null, null, null, null, 'I', null),
      (2, 75, 'NOTA DE CRÉDITO', 'F41CFE3B', '2657370659', null, '2022-12-15', 1, 1, 'VIGENTE', 4260.15, 4260.15, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A1257BA7 - 3120778629', 55, 'A1257BA7', '3120778629', '2022-12-14', 0, 'M', 'OLM', '2023-07-06 00:00:00', null, null, null, null, null, 'I', null),
      (2, 76, 'NOTA DE CRÉDITO', '56EA3BDC', '3412280693', null, '2023-06-26', 1, 1, 'OPERADA', 46.67, 46.67, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR DAÑADOS/QUEBRADOS', 70, '3800C4B0', '722092163', '2023-06-30', 0, 'M', 'AEV', '2023-07-11 00:00:00', 'AEV', '2023-07-11 00:00:00', null, null, null, 'O', null),
      (2, 77, 'NOTA DE CRÉDITO', 'C2487DB4', '2092977921', null, '2023-07-17', 1, 1, 'VIGENTE', 11513.5, 11513.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 1A46D7D4 - 3970713085', 71, '1A46D7D4', '3970713085', '2023-06-30', 0, 'M', 'AEV', '2023-07-19 00:00:00', null, null, null, null, null, 'I', null),
      (2, 78, 'NOTA DE CRÉDITO', '932B8073', '480986446', null, '2023-07-17', 1, 1, 'VIGENTE', 828.52, 828.52, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 3800C4B0 - 722092163', 70, '3800C4B0', '722092163', '2023-06-30', 0, 'M', 'AEV', '2023-07-19 00:00:00', null, null, null, null, null, 'I', null),
      (2, 79, 'NOTA DE CRÉDITO', '74BD4CC1', '728124988', null, '2023-03-31', 1, 1, 'OPERADA', 1.68, 1.68, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'DEVOLUCIÓN POR PRODUCTOS QUEBRADOS', 64, 'D52DD25A', '2980203558', '2023-04-28', 0, 'M', 'AEV', '2023-07-19 00:00:00', 'AEV', '2023-07-19 00:00:00', null, null, null, 'O', null),
      (2, 80, 'NOTA DE CRÉDITO', 'D85D85F6', '667567414', null, '2023-05-05', 1, 1, 'VIGENTE', 1385.5, 1385.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: D52DD25A - 2980203558', 64, 'D52DD25A', '2980203558', '2023-04-28', 0, 'M', 'AEV', '2023-07-19 00:00:00', null, null, null, null, null, 'I', null),
      (2, 81, 'NOTA DE CRÉDITO', '114DA6D9', '4051189923', null, '2023-07-19', 1, 1, 'VIGENTE', 14092.5, 14092.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 2F2F95B2 - 3865136788', 65, '2F2F95B2', '3865136788', '2023-05-09', 0, 'M', 'AEV', '2023-07-19 00:00:00', 'OLM', '2024-07-12 00:00:00', null, null, null, 'I', null),
      (2, 82, 'NOTA DE CRÉDITO', 'F6AFED81', '2184462881', null, '2023-05-05', 1, 1, 'OPERADA', 15, 15, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR PRODUCTOS QUEBRADOS/DAÑADOS', 65, '2F2F95B2', '3865136788', '2023-05-09', 0, 'M', 'AEV', '2023-07-19 00:00:00', 'AEV', '2023-07-19 00:00:00', null, null, null, 'O', null),
      (2, 83, 'NOTA DE CRÉDITO', 'A8A0F8B6', '4231610460', null, '2023-07-17', 1, 1, 'OPERADA', 250, 250, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO DAÑADOS Y QUEBRADOS', 72, '37ABAC26', '1707953274', '2023-07-28', 0, 'M', 'AEV', '2023-08-10 00:00:00', 'AEV', '2023-08-10 00:00:00', null, null, null, 'O', null)) as x(loc, nota, tipo, serie, documento, autorizacion, fecha, moneda, cambio, estado, total, total_mi, bodega, bodega_nombre, proveedor, proveedor_nombre,
       tipo_ajuste_ant, tipo_ajuste, motivo, compra, serie_doc, numero_doc, fecha_doc, transaccion, clasif, usr_ing, f_ing, usr_mod, f_mod, bodega_destino, usr_anula, f_anula,
       estado_ant, obs) order by loc, nota loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    select p.id, p.nit, p.nombre_comercial into v_prov from public.proveedores p where p.localidad_id = v_loc and p.codigo = r.proveedor;
    if v_prov.id is null then n_s := n_s + 1; n_s_txt := n_s_txt || format(' 3-0%s nota %s (proveedor %s);', r.loc, r.nota, r.proveedor); continue; end if;
    v_bod := (select b.id from public.bodegas b where b.localidad_id = v_loc and b.codigo = r.bodega);
    v_compra := coalesce((select c.id from public.compras c where c.localidad_id = v_loc and c.origen_anterior = 'MEDICAMENTOS' and c.compra_anterior = r.compra limit 1),
                         (select c.id from public.compras c where c.localidad_id = v_loc and ((c.origen_anterior = 'VARIAS' and c.compra_anterior = r.compra) or c.compra_varia_anterior = r.compra) limit 1));
    if v_compra is not null and not exists (select 1 from public.compras c where c.id = v_compra and c.proveedor_id = v_prov.id) then v_compra := null; end if;
    if v_compra is null then n_sin_compra := n_sin_compra + 1; end if;
    v_mon := case when r.moneda = 2 then coalesce(v_usd, v_gtq) else v_gtq end;
    select id into v_id from public.notas_compra where localidad_id = v_loc and nota_anterior = r.nota;
    if v_id is null then
      v_num := case when exists (select 1 from public.notas_compra where localidad_id = v_loc and numero = r.nota)
                    then (select coalesce(max(numero), 0) + 1 from public.notas_compra where localidad_id = v_loc) else r.nota end;
      if v_num <> r.nota then n_otro := n_otro + 1; end if;
      insert into public.notas_compra (organizacion_id, localidad_id, numero, tipo, documento, fecha, moneda_id, proveedor_id, nota_anterior, origen_anterior)
      values (v_org, v_loc, v_num, r.tipo, coalesce(r.documento, r.nota::text), r.fecha, v_mon, v_prov.id, r.nota, 'MIGRADO')
      returning id into v_id;
      n_n := n_n + 1;
    else
      n_a := n_a + 1;
    end if;
    update public.notas_compra set
      tipo = r.tipo, numero_autorizacion = r.autorizacion, serie = r.serie, documento = coalesce(r.documento, r.nota::text), fecha = r.fecha,
      moneda_id = v_mon, tipo_cambio = coalesce(nullif(r.cambio, 0), 1), valor = greatest(case when r.moneda = 2 then coalesce(r.total_mi, r.total) else r.total end, 0),
      proveedor_id = v_prov.id, proveedor_codigo = r.proveedor::text, proveedor_nombre = coalesce(r.proveedor_nombre, v_prov.nombre_comercial), nit = v_prov.nit,
      bodega_id = v_bod, compra_id = v_compra, motivo = r.motivo, tipo_ajuste = r.tipo_ajuste,
      tipo_nota = case when r.clasif = 'M' then 'MANUAL' else 'AUTOMÁTICA' end, estado = r.estado,
      usuario = coalesce(upper(r.usr_ing), 'SISTEMA ANTERIOR'),
      operado_por = case when r.estado = 'OPERADA' then upper(coalesce(r.usr_mod, r.usr_ing)) end,
      operado_en = case when r.estado = 'OPERADA' then coalesce(r.f_mod, r.f_ing)::timestamptz end,
      anulado_por = case when r.estado = 'ANULADA' then upper(coalesce(r.usr_anula, r.usr_mod)) end,
      anulado_en = case when r.estado = 'ANULADA' then coalesce(r.f_anula, r.f_mod)::timestamptz end,
      motivo_anulacion = case when r.estado = 'ANULADA' then 'ANULADA EN EL SISTEMA ANTERIOR' end,
      creado_por_nombre = coalesce(upper(r.usr_ing), 'MIGRACIÓN'), creado_en = r.f_ing::timestamptz,
      modificado_por_nombre = upper(r.usr_mod), modificado_en = r.f_mod::timestamptz,
      origen_anterior = 'MIGRADO', nota_anterior = r.nota, estado_anterior = r.estado_ant, tipo_ajuste_anterior = r.tipo_ajuste_ant, clasificacion_nota_anterior = r.clasif,
      moneda_anterior = r.moneda, valor_mi = r.total_mi, bodega_nombre_anterior = r.bodega_nombre, bodega_destino_anterior = r.bodega_destino, compra_anterior = r.compra,
      serie_compra_anterior = r.serie_doc, numero_compra_anterior = r.numero_doc, fecha_compra_anterior = r.fecha_doc, transaccion_anterior = r.transaccion,
      usuario_ingresa_anterior = r.usr_ing, fecha_ingresa_anterior = r.f_ing, usuario_modifica_anterior = r.usr_mod, fecha_modifica_anterior = r.f_mod, observaciones = r.obs
    where id = v_id;
  end loop;

  -- Líneas de las notas.
  for r in select * from (values
      (1::integer, 151::integer, 1::integer, null::integer, null::text, 'DESCUENTO PARA LAS FACTURAS'::text, null::text, null::date, null::date, 1::numeric, 1476::numeric, 1476::numeric, 0::numeric, 0::numeric, 1476::numeric, 1476::numeric, false::boolean, null::integer, null::text),
      (1, 152, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 900, 900, 0, 0, 900, 900, false, null, null),
      (1, 153, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 41819.4, 41819.4, 0, 0, 41819.4, 41819.4, false, null, null),
      (1, 154, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 8991.75, 8991.75, 0, 0, 8991.75, 8991.75, false, null, null),
      (1, 155, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3909.25, 3909.25, 0, 0, 3909.25, 3909.25, false, null, null),
      (1, 156, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2968.75, 2968.75, 0, 0, 2968.75, 2968.75, false, null, null),
      (1, 157, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 900, 900, 0, 0, 900, 900, false, null, null),
      (1, 158, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 900, 900, 0, 0, 900, 900, false, null, null),
      (1, 159, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6417.25, 6417.25, 0, 0, 6417.25, 6417.25, false, null, null),
      (1, 160, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 13399.75, 13399.75, 0, 0, 13399.75, 13399.75, false, null, null),
      (1, 161, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 127991.4, 127991.4, 0, 0, 127991.4, 127991.4, false, null, null),
      (1, 162, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2725, 2725, 0, 0, 2725, 2725, false, null, null),
      (1, 163, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 360, 360, 0, 0, 360, 360, false, null, null),
      (1, 164, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6650, 6650, 0, 0, 6650, 6650, false, null, null),
      (1, 165, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 900, 900, 0, 0, 900, 900, false, null, null),
      (1, 166, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 400, 400, 0, 0, 400, 400, false, null, null),
      (1, 167, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 540, 540, 0, 0, 540, 540, false, null, null),
      (1, 168, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 540, 540, 0, 0, 540, 540, false, null, null),
      (1, 169, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 810, 810, 0, 0, 810, 810, false, null, null),
      (1, 170, 1, null, null, 'Descuento en la factura:  - 1765', null, null, null, 1, 715, 715, 0, 0, 715, 715, false, null, null),
      (1, 171, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 175, 175, 0, 0, 175, 175, false, null, null),
      (1, 172, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1494, 1494, 0, 0, 1494, 1494, false, null, null),
      (1, 173, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2515, 2515, 0, 0, 2515, 2515, false, null, null),
      (1, 174, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1201, 1201, 0, 0, 1201, 1201, false, null, null),
      (1, 175, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 425, 425, 0, 0, 425, 425, false, null, null),
      (1, 176, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1015, 1015, 0, 0, 1015, 1015, false, null, null),
      (1, 177, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 975, 975, 0, 0, 975, 975, false, null, null),
      (1, 178, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1445, 1445, 0, 0, 1445, 1445, false, null, null),
      (1, 179, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 250, 250, 0, 0, 250, 250, false, null, null),
      (1, 180, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 704, 704, 0, 0, 704, 704, false, null, null),
      (1, 181, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 398, 398, 0, 0, 398, 398, false, null, null),
      (1, 182, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1408.39, 1408.39, 0, 0, 1408.39, 1408.39, false, null, null),
      (1, 183, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1046.01, 1046.01, 0, 0, 1046.01, 1046.01, false, null, null),
      (1, 184, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 657.5, 657.5, 0, 0, 657.5, 657.5, false, null, null),
      (1, 185, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1116.25, 1116.25, 0, 0, 1116.25, 1116.25, false, null, null),
      (1, 186, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 216.25, 216.25, 0, 0, 216.25, 216.25, false, null, null),
      (1, 187, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 414, 414, 0, 0, 414, 414, false, null, null),
      (1, 188, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1372.5, 1372.5, 0, 0, 1372.5, 1372.5, false, null, null),
      (1, 189, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 275.82, 275.82, 0, 0, 275.82, 275.82, false, null, null),
      (1, 190, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 300, 300, 0, 0, 300, 300, false, null, null),
      (1, 191, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1264.76, 1264.76, 0, 0, 1264.76, 1264.76, false, null, null),
      (1, 192, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 39436.8, 39436.8, 0, 0, 39436.8, 39436.8, false, null, null),
      (1, 193, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3175.85, 3175.85, 0, 0, 3175.85, 3175.85, false, null, null),
      (1, 194, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1769.5, 1769.5, 0, 0, 1769.5, 1769.5, false, null, null),
      (1, 195, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5177.5, 5177.5, 0, 0, 5177.5, 5177.5, false, null, null),
      (1, 196, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 26949.6, 26949.6, 0, 0, 26949.6, 26949.6, false, null, null),
      (1, 197, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6201.12, 6201.12, 0, 0, 6201.12, 6201.12, false, null, null),
      (1, 198, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 20, 20, 0, 0, 20, 20, false, null, null),
      (1, 199, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 31903.8, 31903.8, 0, 0, 31903.8, 31903.8, false, null, null),
      (1, 200, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 13129, 13129, 0, 0, 13129, 13129, false, null, null),
      (1, 201, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 11191, 11191, 0, 0, 11191, 11191, false, null, null),
      (1, 202, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5177.5, 5177.5, 0, 0, 5177.5, 5177.5, false, null, null),
      (1, 203, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1500, 1500, 0, 0, 1500, 1500, false, null, null),
      (1, 204, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2588.75, 2588.75, 0, 0, 2588.75, 2588.75, false, null, null),
      (1, 205, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 12402.25, 12402.25, 0, 0, 12402.25, 12402.25, false, null, null),
      (1, 206, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 32565.96, 32565.96, 0, 0, 32565.96, 32565.96, false, null, null),
      (1, 208, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4104, 4104, 0, 0, 4104, 4104, false, null, null),
      (1, 209, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 43560.42, 43560.42, 0, 0, 43560.42, 43560.42, false, null, null),
      (1, 210, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5130, 5130, 0, 0, 5130, 5130, false, null, null),
      (1, 211, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 60000, 60000, 0, 0, 60000, 60000, false, null, null),
      (1, 213, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 20940, 20940, 0, 0, 20940, 20940, false, null, null),
      (1, 214, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 269, 269, 0, 0, 269, 269, false, null, null),
      (1, 215, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4243.5, 4243.5, 0, 0, 4243.5, 4243.5, false, null, null),
      (1, 216, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2000, 2000, 0, 0, 2000, 2000, false, null, null),
      (1, 217, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1536, 1536, 0, 0, 1536, 1536, false, null, null),
      (1, 218, 1, null, null, 'DESCUENTO PARA LAS FACTURAS A 31', null, null, null, 7, 23.3, 23.3, 0, 0, 163.1, 163.1, false, null, null),
      (2, 1, 1, 17, 'FUT- 001-', 'CEFTRIAXONA SODICA Vitalis 1g Polvo para solución inyectable', 'P202496', '2023-09-30', '2020-09-30', 20, 4.75, 4.75, 0, 0, 95, 95, false, null, null),
      (2, 2, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 20851.91, 20851.91, 0, 0, 20851.91, 20851.91, false, null, null),
      (2, 3, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5118.75, 5118.75, 0, 0, 5118.75, 5118.75, false, null, null),
      (2, 4, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4650, 4650, 0, 0, 4650, 4650, false, null, null),
      (2, 5, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3714.98, 3714.98, 0, 0, 3714.98, 3714.98, false, null, null),
      (2, 6, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 10115.38, 10115.38, 0, 0, 10115.38, 10115.38, false, null, null),
      (2, 7, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 8790.13, 8790.13, 0, 0, 8790.13, 8790.13, false, null, null),
      (2, 8, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 8405.38, 8405.38, 0, 0, 8405.38, 8405.38, false, null, null),
      (2, 9, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 15482.28, 15482.28, 0, 0, 15482.28, 15482.28, false, null, null),
      (2, 10, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 7046.86, 7046.86, 0, 0, 7046.86, 7046.86, false, null, null),
      (2, 11, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 11169.28, 11169.28, 0, 0, 11169.28, 11169.28, false, null, null),
      (2, 12, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 12279.1, 12279.1, 0, 0, 12279.1, 12279.1, false, null, null),
      (2, 13, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2100, 2100, 0, 0, 2100, 2100, false, null, null),
      (2, 14, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 7110, 7110, 0, 0, 7110, 7110, false, null, null),
      (2, 15, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 12446.3, 12446.3, 0, 0, 12446.3, 12446.3, false, null, null),
      (2, 16, 1, 20, 'VIT 0017', 'DICLOFENACO SODICO Vitalis 75 mg/3 mL Solución Inyectable', 'P212678', '2024-09-30', '2021-09-30', 9, 0.79, 0.79, 0, 0, 7.11, 7.11, false, null, null),
      (2, 16, 2, 20, 'VIT 0017', 'DICLOFENACO SODICO Vitalis 75 mg/3 mL Solución Inyectable', 'P212679', '2024-09-30', '2021-09-30', 1, 0.79, 0.79, 0, 0, 0.79, 0.79, false, null, null),
      (2, 17, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 15262.71, 15262.71, 0, 0, 15262.71, 15262.71, false, null, null),
      (2, 18, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 10192.54, 10192.54, 0, 0, 10192.54, 10192.54, false, null, null),
      (2, 19, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1.5, 1.5, 0, 0, 1.5, 1.5, false, null, null),
      (2, 20, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4776.25, 4776.25, 0, 0, 4776.25, 4776.25, false, null, null),
      (2, 21, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6630.9, 6630.9, 0, 0, 6630.9, 6630.9, false, null, null),
      (2, 22, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 7.5, 7.5, 0, 0, 7.5, 7.5, false, null, null),
      (2, 23, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 22043.22, 22043.22, 0, 0, 22043.22, 22043.22, false, null, null),
      (2, 24, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 18.75, 18.75, 0, 0, 18.75, 18.75, false, null, null),
      (2, 25, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6202.93, 6202.93, 0, 0, 6202.93, 6202.93, false, null, null),
      (2, 26, 1, 1, null, 'DESCUENTO PARA FACTURA', null, null, null, 1, 14.68, 14.68, 0, 0, 14.68, 14.68, false, null, null),
      (2, 27, 1, 1, null, 'DESCUENTO FACTURA', null, null, null, 1, 21575.6, 21575.6, 0, 0, 21575.6, 21575.6, false, null, null),
      (2, 28, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4264, 4264, 0, 0, 4264, 4264, false, null, null),
      (2, 29, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 21427.35, 21427.35, 0, 0, 21427.35, 21427.35, false, null, null),
      (2, 30, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 42179.23, 42179.23, 0, 0, 42179.23, 42179.23, false, null, null),
      (2, 31, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 18550.3, 18550.3, 0, 0, 18550.3, 18550.3, false, null, null),
      (2, 32, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 16727.23, 16727.23, 0, 0, 16727.23, 16727.23, false, null, null),
      (2, 33, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 105, 105, 0, 0, 105, 105, false, null, null),
      (2, 34, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 12154.5, 12154.5, 0, 0, 12154.5, 12154.5, false, null, null),
      (2, 35, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 18795, 18795, 0, 0, 18795, 18795, false, null, null),
      (2, 36, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5698, 5698, 0, 0, 5698, 5698, false, null, null),
      (2, 37, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 17128.75, 17128.75, 0, 0, 17128.75, 17128.75, false, null, null),
      (2, 38, 1, 37, 'VIT 0034', 'PIPERACILINA + TAZOBACTAM  Vitalis 4 g / 0.5 g Polvo para uso parenter', 'P213555', '2024-11-30', '2021-11-30', 10, 21, 21, 0, 0, 210, 210, true, null, null),
      (2, 39, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 15276, 15276, 0, 0, 15276, 15276, false, null, null),
      (2, 40, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 64204.94, 64204.94, 0, 0, 64204.94, 64204.94, false, null, null),
      (2, 41, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 10836, 10836, 0, 0, 10836, 10836, false, null, null),
      (2, 42, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4722.5, 4722.5, 0, 0, 4722.5, 4722.5, false, null, null),
      (2, 43, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 51175.25, 51175.25, 0, 0, 51175.25, 51175.25, false, null, null),
      (2, 44, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1871, 1871, 0, 0, 1871, 1871, false, null, null),
      (2, 45, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 22153.5, 22153.5, 0, 0, 22153.5, 22153.5, false, null, null),
      (2, 46, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 0.01, 0.01, 0, 0, 0.01, 0.01, false, null, null),
      (2, 47, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 38140.07, 38140.07, 0, 0, 38140.07, 38140.07, false, null, null),
      (2, 48, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 18344.2, 18344.2, 0, 0, 18344.2, 18344.2, false, null, null),
      (2, 49, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3590, 3590, 0, 0, 3590, 3590, false, null, null),
      (2, 50, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3590, 3590, 0, 0, 3590, 3590, false, null, null),
      (2, 51, 1, 39, 'VIT 0036', 'TRAMADOL CLORHIDRATO Vitalis 100 mg/ 2mL Solución Inyectable', 'A230068', '2026-02-21', '2023-02-21', 60, 1.5, 1.5, 0, 0, 90, 90, true, null, null),
      (2, 52, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3150, 3150, 0, 0, 3150, 3150, false, null, null),
      (2, 53, 1, 14, 'VIT 0011', 'CEFOTAXIMA Vitalis 1 g Polvo para solucion Inyectable', 'C220203', '2025-09-28', '2022-09-28', 1, 4.69, 4.69, 0, 0, 4.69, 4.69, true, null, null),
      (2, 53, 2, 16, 'VIT 0013', 'CEFTRIAXONA SODICA Vitalis 1g Polvo para solución inyectable', 'C220218', '2025-10-14', '2022-10-14', 4, 4.83, 4.83, 0, 0, 19.32, 19.32, true, null, null),
      (2, 54, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6768, 6768, 0, 0, 6768, 6768, false, null, null),
      (2, 55, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 35415.75, 35415.75, 0, 0, 35415.75, 35415.75, false, null, null),
      (2, 56, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1420, 1420, 0, 0, 1420, 1420, false, null, null),
      (2, 57, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2343.75, 2343.75, 0, 0, 2343.75, 2343.75, false, null, null),
      (2, 58, 1, 19, 'VIT 0016', 'DEXAMETASONA FOSFATO Vitalis 4 mg/mL Solución Inyectable', 'P222900', '2025-08-31', '2022-08-31', 50, 1.49, 1.49, 0, 0, 74.5, 74.5, true, null, null),
      (2, 58, 2, 38, 'VIT 0035', 'RANITIDINA VITALIS 50 mg/2mL SOLUCION INYECTABLE', 'P222601', '2024-07-31', '2022-07-31', 150, 1.03, 1.03, 0, 0, 154.5, 154.5, true, null, null),
      (2, 59, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3315.11, 3315.11, 0, 0, 3315.11, 3315.11, false, null, null),
      (2, 60, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3877.57, 3877.57, 0, 0, 3877.57, 3877.57, false, null, null),
      (2, 60, 2, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 0.01, 0.01, 0, 0, 0.01, 0.01, false, null, null),
      (2, 61, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 630, 630, 0, 0, 630, 630, false, null, null),
      (2, 62, 1, 18, 'VIT 0015', 'CLINDAMICINA Vitalis 600 mg/4 mL solución inyectable', 'A230313', '2024-05-13', '2023-05-13', 10, 3.59, 3.59, 0, 0, 35.9, 35.9, false, null, null),
      (2, 62, 2, 39, 'VIT 0036', 'TRAMADOL CLORHIDRATO Vitalis 100 mg/ 2mL Solución Inyectable', 'A221146', '2025-10-31', '2022-10-31', 2, 1.5, 1.5, 0, 0, 3, 3, false, null, null),
      (2, 63, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 22153.5, 22153.5, 0, 0, 22153.5, 22153.5, false, null, null),
      (2, 64, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 25281.78, 25281.78, 0, 0, 25281.78, 25281.78, false, null, null),
      (2, 65, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 26264.26, 26264.26, 0, 0, 26264.26, 26264.26, false, null, null),
      (2, 66, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6671.5, 6671.5, 0, 0, 6671.5, 6671.5, false, null, null),
      (2, 67, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 266, 266, 0, 0, 266, 266, false, null, null),
      (2, 68, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 25791.84, 25791.84, 0, 0, 25791.84, 25791.84, false, null, null),
      (2, 69, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 40257.18, 40257.18, 0, 0, 40257.18, 40257.18, false, null, null),
      (2, 70, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 24754.1, 24754.1, 0, 0, 24754.1, 24754.1, false, null, null),
      (2, 71, 1, 38, 'VIT 0035', 'RANITIDINA VITALIS 50 mg/2mL SOLUCION INYECTABLE', 'P221407', '2024-05-31', '2022-05-31', 50, 1.03, 1.03, 0, 0, 51.5, 51.5, true, null, null),
      (2, 71, 2, 27, 'VIT 0024', 'HIERRO SACAROSA Vitalis 100 mg/5 mL  Solución Inyectable', 'P213921', '2023-12-31', '2021-12-31', 50, 18.75, 18.75, 0, 0, 937.5, 937.5, true, null, null),
      (2, 72, 1, 17, 'VIT 0014', 'CEFTRIAXONA SODICA Vitalis 1g Polvo para solución inyectable', 'P222093', '2025-07-31', '2022-07-31', 88, 5.22, 5.22, 0, 0, 459.36, 459.36, true, null, null),
      (2, 72, 2, 23, 'VIT 0020', 'FUROSEMIDA Vitalis 20 mg/2 mL Solución Inyectable', 'P221404', '2025-05-31', '2022-05-31', 2, 0.95, 0.95, 0, 0, 1.9, 1.9, true, null, null),
      (2, 72, 3, 38, 'VIT 0035', 'RANITIDINA VITALIS 50 mg/2mL SOLUCION INYECTABLE', 'P222290', '2024-07-31', '2022-07-31', 5, 1.03, 1.03, 0, 0, 5.15, 5.15, true, null, null),
      (2, 73, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 9336, 9336, 0, 0, 9336, 9336, false, null, null),
      (2, 74, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 538.5, 538.5, 0, 0, 538.5, 538.5, false, null, null),
      (2, 75, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4260.15, 4260.15, 0, 0, 4260.15, 4260.15, false, null, null),
      (2, 76, 1, 18, 'VIT 0015', 'CLINDAMICINA Vitalis 600 mg/4 mL solución inyectable', 'A230313', '2024-05-13', '2023-05-13', 13, 3.59, 3.59, 0, 0, 46.67, 46.67, true, null, null),
      (2, 77, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 11513.5, 11513.5, 0, 0, 11513.5, 11513.5, false, null, null),
      (2, 78, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 828.52, 828.52, 0, 0, 828.52, 828.52, false, null, null),
      (2, 79, 1, 20, 'VIT 0017', 'DICLOFENACO SODICO Vitalis 75 mg/3 mL Solución Inyectable', 'A221326', '2025-11-06', '2022-11-06', 2, 0.84, 0.84, 0, 0, 1.68, 1.68, true, null, null),
      (2, 80, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1385.5, 1385.5, 0, 0, 1385.5, 1385.5, false, null, null),
      (2, 81, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 14092.5, 14092.5, 0, 0, 14092.5, 14092.5, false, null, null),
      (2, 82, 1, 39, 'VIT 0036', 'TRAMADOL CLORHIDRATO Vitalis 100 mg/ 2mL Solución Inyectable', 'A221274', '2025-11-02', '2022-11-02', 10, 1.5, 1.5, 0, 0, 15, 15, true, null, null),
      (2, 83, 1, 38, 'VIT 0035', 'RANITIDINA VITALIS 50 mg/2mL SOLUCION INYECTABLE', 'P222603', '2024-08-31', '2022-08-31', 250, 1, 1, 0, 0, 250, 250, true, null, null)) as x(loc, nota, linea, producto, cod_prod, descripcion, lote, vence, fabrica, cantidad, precio, precio_mi, descu, descu_mi, total, total_mi, inv, bodega, registro) loop
    select n.id, n.localidad_id into v_id, v_loc from public.notas_compra n join public.localidades l on l.id = n.localidad_id
    where l.organizacion_id = v_org and l.correlativo = r.loc and n.nota_anterior = r.nota;
    if v_id is null then l_s := l_s + 1; continue; end if;
    insert into public.nota_compra_lineas (nota_id, linea, producto_id, descripcion, cantidad, precio, inventario, lote, registro_sanitario, fecha_vencimiento, fecha_fabricacion,
      bodega_id, origen_anterior, producto_anterior, codigo_producto_anterior, precio_mi_anterior, descuento_anterior, descuento_mi_anterior, valor_total_anterior, valor_total_mi_anterior)
    select v_id, r.linea, p.id, coalesce(r.descripcion, p.nombre, 'SIN DESCRIPCIÓN'), case when coalesce(r.cantidad, 0) > 0 then r.cantidad else 1 end,
           greatest(coalesce(r.precio, 0), 0), coalesce(r.inv, false) and p.id is not null, r.lote, r.registro, r.vence, r.fabrica,
           (select b.id from public.bodegas b where b.localidad_id = v_loc and b.codigo = r.bodega), 'MIGRADO', r.producto, r.cod_prod, r.precio_mi, r.descu, r.descu_mi, r.total, r.total_mi
    from (select 1) uno left join public.productos p on p.localidad_id = v_loc and p.codigo = r.producto
    on conflict (nota_id, linea) do update set producto_id = excluded.producto_id, descripcion = excluded.descripcion, cantidad = excluded.cantidad, precio = excluded.precio,
      inventario = excluded.inventario, lote = excluded.lote, registro_sanitario = excluded.registro_sanitario, fecha_vencimiento = excluded.fecha_vencimiento,
      fecha_fabricacion = excluded.fecha_fabricacion, bodega_id = excluded.bodega_id, origen_anterior = excluded.origen_anterior, producto_anterior = excluded.producto_anterior,
      codigo_producto_anterior = excluded.codigo_producto_anterior, precio_mi_anterior = excluded.precio_mi_anterior, descuento_anterior = excluded.descuento_anterior,
      descuento_mi_anterior = excluded.descuento_mi_anterior, valor_total_anterior = excluded.valor_total_anterior, valor_total_mi_anterior = excluded.valor_total_mi_anterior
    returning (xmax = 0) into v_nuevo;
    if v_nuevo then l_n := l_n + 1; else l_a := l_a + 1; end if;
  end loop;

  perform set_config('fin.nota', '', true);
  raise notice '%', format('Notas de compras de la organización 3: %s nuevas, %s actualizadas, %s con otro número (el suyo ya estaba ocupado), %s sin su compra en la base. Líneas: %s nuevas, %s actualizadas, %s sin nota.%s',
    n_n, n_a, n_otro, n_sin_compra, l_n, l_a, l_s, case when n_s > 0 then ' Omitidas por falta de proveedor:' || n_s_txt else '' end);
end;
$notas$;

notify pgrst, 'reload schema';
-- Script 246 · parte 3 de 5 · Organización 3 (Futura Farma - Mavisa), lote al 04-11-2026 (carpeta «Data Inventarios 2 Parte»): notas de crédito y débito de proveedores (Compras ›
--   Notas crédito compras), de ACT_NOTAS_COMPRAS.xls (150 notas de esta parte) y ACT_DET_NOTAS_COMPRAS.xls (183 líneas).
--   Misma lógica del script 243 (lote del 05 al 17-11-2026). Notas: 3-02 84 (OPERADA), 3-02 85 (VIGENTE), 3-02 86 (VIGENTE), 3-02 87 (VIGENTE), 3-02 88 (OPERADA), 3-02 89 (VIGENTE), 3-02 90 (OPERADA), 3-02 91 (OPERADA), 3-02 92 (VIGENTE), 3-02 93 (VIGENTE), 3-02 94 (OPERADA), 3-02 95 (VIGENTE), 3-02 96 (OPERADA), 3-02 97 (VIGENTE), 3-02 98 (OPERADA), 3-02 99 (OPERADA), 3-02 100 (OPERADA), 3-02 101 (VIGENTE), 3-02 102 (OPERADA), 3-02 103 (VIGENTE), 3-02 104 (VIGENTE), 3-02 105 (VIGENTE), 3-02 106 (VIGENTE), 3-02 107 (OPERADA), 3-02 108 (OPERADA), 3-02 109 (VIGENTE), 3-02 110 (VIGENTE), 3-02 111 (VIGENTE), 3-02 112 (OPERADA), 3-02 113 (OPERADA), 3-02 114 (VIGENT….
--   1. Una nota se identifica por su localidad y su número NOTA (columna nueva nota_anterior) y conserva ese número; si ya lo usa una nota
--      hecha en este sistema, toma el siguiente libre. Las líneas, por su nota y LINEA. Si ya existen se actualizan.
--   2. Columnas nuevas (traen datos y no existían):
--      notas_compra: origen_anterior (marca MIGRADO), nota_anterior (NOTA), estado_anterior (ESTADO (I, O, A)), tipo_ajuste_anterior (TIPO_AJUSTE), clasificacion_nota_anterior (CLASIFICACION_NOTA), moneda_anterior (MONEDA), valor_mi (TOTAL_NOTA_MI), bodega_nombre_anterior (DESC_BODEGA), bodega_destino_anterior (BODEGA_DESTINO), compra_anterior (DOCUMENTO (compra)), serie_compra_anterior (SERIE_DOC), numero_compra_anterior (NUMERO_DOC), fecha_compra_anterior (FECHAHORA_EMISION_DOC), transaccion_anterior (TRANSACCION), usuario_ingresa_anterior (USUARIO_INGRESA), fecha_ingresa_anterior (FECHA_INGRESA), usuario_modifica_anterior (USUARIO_MODIFICA), fecha_modifica_anterior (FECHA_MODIFICA), observaciones (OBSERVACIONES).
--      nota_compra_lineas: origen_anterior (marca MIGRADO), producto_anterior (PRODUCTO), codigo_producto_anterior (CODIGO_PRODUCTO), precio_mi_anterior (VALOR_UNITARIO_MI), descuento_anterior (DESCUENTO), descuento_mi_anterior (DESCUENTO_MI), valor_total_anterior (VALOR_TOTAL), valor_total_mi_anterior (VALOR_TOTAL_MI).
--      Columnas vacías (no se migran): notas TIPO_PRECIO, DIRECCION, OBSERVACIONES, NUMERO_AUTORIZACION_DOC, AÑO_POLIZA, MES_POLIZA, POLIZA, USUARIO_ANULA, FECHA_ANULA; líneas REGISTRO_SANITARIO, UNIDAD_MEDIDA, COSTO_UNITARIO, COSTO_UNITARIO_MI, BODEGA.
--   Equivalencias: TIPO_NOTA C = nota de crédito, D = de débito; SERIE y NUMERO = serie y documento del DTE; FECHAHORA_EMISION = fecha;
--   MONEDA 1 = quetzales, 2 = dólares, con VALOR_CAMBIO; TOTAL_NOTA = valor (en dólares, TOTAL_NOTA_MI); ESTADO I (ingresada) = VIGENTE,
--   O = OPERADA, A = ANULADA; TIPO_AJUSTE 1 = DEVOLUCIÓN, 2 = DESCUENTO; CLASIFICACION_NOTA M = manual; MOTIVO_AJUSTE = motivo.
--   Proveedor, bodega y producto por su código en la localidad (el NIT y el nombre se toman del proveedor). La factura de referencia es la
--   compra DOCUMENTO (de medicamentos o, si no hay, compra varia) si es del mismo proveedor; si no está en la base queda su número.
--   Las notas se cargan con su estado del sistema anterior, SIN generar póliza ni movimientos de inventario (el kardex migrado ya trae la
--   salida de las devoluciones: script 147). Una nota OPERADA rebaja el saldo de su compra (compras_saldo); una VIGENTE se puede descargar
--   o anular en Compras. Línea INVENTARIADA = S mueve inventario (sin producto queda como concepto). VALOR_TOTAL = cantidad × precio.
--   Fechas escritas con el año en dos cifras (29/04/0025, 28/04/0025, 5/05/0025, 6/06/0025): se toman del año 2000 en adelante.
--   Se ejecuta después del script 233. Se puede ejecutar de nuevo: actualiza.
set lock_timeout = '20s';
alter table public.notas_compra add column if not exists origen_anterior text;
alter table public.notas_compra add column if not exists nota_anterior integer;
alter table public.notas_compra add column if not exists estado_anterior text;
alter table public.notas_compra add column if not exists tipo_ajuste_anterior integer;
alter table public.notas_compra add column if not exists clasificacion_nota_anterior text;
alter table public.notas_compra add column if not exists moneda_anterior integer;
alter table public.notas_compra add column if not exists valor_mi numeric(18, 2);
alter table public.notas_compra add column if not exists bodega_nombre_anterior text;
alter table public.notas_compra add column if not exists bodega_destino_anterior integer;
alter table public.notas_compra add column if not exists compra_anterior integer;
alter table public.notas_compra add column if not exists serie_compra_anterior text;
alter table public.notas_compra add column if not exists numero_compra_anterior text;
alter table public.notas_compra add column if not exists fecha_compra_anterior date;
alter table public.notas_compra add column if not exists transaccion_anterior integer;
alter table public.notas_compra add column if not exists usuario_ingresa_anterior text;
alter table public.notas_compra add column if not exists fecha_ingresa_anterior timestamp;
alter table public.notas_compra add column if not exists usuario_modifica_anterior text;
alter table public.notas_compra add column if not exists fecha_modifica_anterior timestamp;
alter table public.notas_compra add column if not exists observaciones text;
alter table public.nota_compra_lineas add column if not exists origen_anterior text;
alter table public.nota_compra_lineas add column if not exists producto_anterior integer;
alter table public.nota_compra_lineas add column if not exists codigo_producto_anterior text;
alter table public.nota_compra_lineas add column if not exists precio_mi_anterior numeric(18, 4);
alter table public.nota_compra_lineas add column if not exists descuento_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists descuento_mi_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists valor_total_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists valor_total_mi_anterior numeric(18, 2);
create unique index if not exists notas_compra_nota_anterior on public.notas_compra (localidad_id, nota_anterior) where nota_anterior is not null;

do $notas$
declare
  v_org bigint; v_gtq bigint; v_usd bigint; r record; v_loc bigint; v_prov record; v_compra bigint; v_bod bigint; v_id bigint; v_num int; v_mon bigint;
  n_n int := 0; n_a int := 0; n_s int := 0; n_s_txt text := ''; n_otro int := 0; n_sin_compra int := 0; l_n int := 0; l_a int := 0; l_s int := 0; v_nuevo boolean;
begin
  select id into v_org from public.organizaciones where codigo::text = '3';
  if v_org is null then raise exception 'No existe la organización 3.'; end if;
  select id into v_gtq from public.monedas where iso = 'GTQ';
  select id into v_usd from public.monedas where iso = 'USD';
  -- Carga del sistema anterior: conserva número, estado y usuario (preparar_nota_compra respeta fin.nota).
  perform set_config('fin.nota', 'si', true);

  for r in select * from (values
      (2::integer, 84::integer, 'NOTA DE CRÉDITO'::text, '0A728563'::text, '1875330694'::text, null::text, '2023-07-17'::date, 1::integer, 1::numeric, 'OPERADA'::text, 10::numeric, 10::numeric, 1::integer, 'MAVISA'::text, 1897::integer, 'VITALIS S.A.'::text, 1::integer, 'DEVOLUCIÓN'::text, 'NOTA DE CRÉDITO QUEBRADOS Y DAÑADOS'::text, 72::integer, '37ABAC26'::text, '1707953274'::text, '2023-07-28'::date, 0::integer, 'M'::text, 'AEV'::text, '2023-08-10 00:00:00'::timestamp, 'AEV'::text, '2023-08-10 00:00:00'::timestamp, null::integer, null::text, null::timestamp, 'O'::text, null::text),
      (2, 85, 'NOTA DE CRÉDITO', '6CFADA40', '4080550433', null, '2023-08-16', 1, 1, 'VIGENTE', 894.65, 894.65, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 37ABAC26 - 1707953274', 72, '37ABAC26', '1707953274', '2023-07-28', 0, 'M', 'AEV', '2023-08-16 00:00:00', null, null, null, null, null, 'I', null),
      (2, 86, 'NOTA DE CRÉDITO', '85867DC0', '2982232362', null, '2023-08-16', 1, 1, 'VIGENTE', 675, 675, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 0D31DBB2 - 3443805494', 73, '0D31DBB2', '3443805494', '2023-07-31', 0, 'M', 'AEV', '2023-08-16 00:00:00', null, null, null, null, null, 'I', null),
      (2, 87, 'NOTA DE CRÉDITO', 'EC7C213A', '3045214837', null, '2023-08-30', 1, 1, 'VIGENTE', 2513, 2513, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 00641F09 - 3583332019', 74, '00641F09', '3583332019', '2023-08-21', 0, 'M', 'AEV', '2023-09-07 00:00:00', null, null, null, null, null, 'I', null),
      (2, 88, 'NOTA DE CRÉDITO', '10E4B152', '2014986395', null, '2023-08-16', 1, 1, 'OPERADA', 580, 580, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR DAÑADOS Y QUEBRADOS FACT 1707953274', 74, '00641F09', '3583332019', '2023-08-21', 0, 'M', 'AEV', '2023-09-07 00:00:00', 'AEV', '2023-09-07 00:00:00', null, null, null, 'O', null),
      (2, 89, 'NOTA DE CRÉDITO', 'A866D094', '3819981570', null, '2023-08-31', 1, 1, 'VIGENTE', 2337.4, 2337.4, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: BECC3F6A - 1209485372', 75, 'BECC3F6A', '1209485372', '2023-08-21', 0, 'M', 'AEV', '2023-09-07 00:00:00', null, null, null, null, null, 'I', null),
      (2, 90, 'NOTA DE CRÉDITO', '944F778E', '3688713645', null, '2023-08-30', 1, 1, 'OPERADA', 35.9, 35.9, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR QUEBRADOS Y DAÑADOS FACT 3583332019', 75, 'BECC3F6A', '1209485372', '2023-08-21', 0, 'M', 'AEV', '2023-09-07 00:00:00', 'AEV', '2023-09-07 00:00:00', null, null, null, 'O', null),
      (2, 91, 'NOTA DE CRÉDITO', '20477D6E', '2374782148', null, '2023-09-01', 1, 1, 'OPERADA', 1015, 1015, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR DAÑADOS Y QUEBRADOS FACT1209485372', 76, '92595BAB', '2439201767', '2023-08-31', 0, 'M', 'AEV', '2023-09-07 00:00:00', 'AEV', '2023-09-07 00:00:00', null, null, null, 'O', null),
      (2, 92, 'NOTA DE CRÉDITO', '8E4C9E44', '450774129', null, '2023-10-19', 1, 1, 'VIGENTE', 8100.35, 8100.35, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 7B9F28EA - 1566524380', 77, '7B9F28EA', '1566524380', '2023-09-29', 0, 'M', 'AEV', '2023-10-31 00:00:00', null, null, null, null, null, 'I', null),
      (2, 93, 'NOTA DE CRÉDITO', '312D5DE6', '2098874591', null, '2023-10-19', 1, 1, 'VIGENTE', 486.68, 486.68, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 0DD045DB - 2310359239', 80, '0DD045DB', '2310359239', '2023-09-29', 0, 'M', 'AEV', '2023-10-31 00:00:00', null, null, null, null, null, 'I', null),
      (2, 94, 'NOTA DE CRÉDITO', 'BECF1979', '1343635929', null, '2024-05-07', 1, 1, 'OPERADA', 3861, 3861, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR QUEBRADOS Y DAÑADOS', 96, '324629DE', '2680243111', '2024-04-30', 0, 'M', 'AEV', '2023-10-31 00:00:00', 'AEV', '2024-05-15 00:00:00', 3, null, null, 'O', null),
      (2, 95, 'NOTA DE CRÉDITO', '2D1D96B7', '4233317954', null, '2023-10-19', 1, 1, 'VIGENTE', 4433.65, 4433.65, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 068D617A - 2890023775', 78, '068D617A', '2890023775', '2023-09-27', 0, 'M', 'AEV', '2023-10-31 00:00:00', null, null, null, null, null, 'I', null),
      (2, 96, 'NOTA DE CRÉDITO', 'FB56D6E5', '1062226232', null, '2023-10-03', 1, 1, 'OPERADA', 4757.6, 4757.6, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR DAÑADOS Y QUEBRADOS', 78, '068D617A', '2890023775', '2023-09-27', 0, 'M', 'AEV', '2023-10-31 00:00:00', 'AEV', '2023-10-31 00:00:00', 3, null, null, 'O', null),
      (2, 97, 'NOTA DE CRÉDITO', '592AF8F7', '2247836177', null, '2023-09-29', 1, 1, 'VIGENTE', 6290.69, 6290.69, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 92595BAB - 2439201767', 76, '92595BAB', '2439201767', '2023-08-31', 0, 'M', 'AEV', '2023-10-31 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 98, 'NOTA DE CRÉDITO', '6D8F13FA', '2783332744', null, '2023-10-19', 1, 1, 'OPERADA', 2204, 2204, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR DAÑADOS Y QUEBRADOS', 82, '9DEDCD57', '240864469', '2023-10-19', 0, 'M', 'AEV', '2023-11-07 00:00:00', 'AEV', '2023-11-07 00:00:00', 3, null, null, 'O', null),
      (2, 99, 'NOTA DE CRÉDITO', 'F606BD70', '1373588431', null, '2023-10-19', 1, 1, 'OPERADA', 6641.5, 6641.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR QUEBRADOS Y DAÑADOS', 82, '9DEDCD57', '240864469', '2023-10-19', 0, 'M', 'AEV', '2023-11-07 00:00:00', 'AEV', '2023-11-07 00:00:00', 3, null, null, 'O', null),
      (2, 100, 'NOTA DE CRÉDITO', 'C96FD71F', '3056029367', null, '2023-10-19', 1, 1, 'OPERADA', 60, 60, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR DAÑADOS Y QUEBRADOS', 82, '9DEDCD57', '240864469', '2023-10-19', 0, 'M', 'AEV', '2023-11-07 00:00:00', 'AEV', '2023-11-07 00:00:00', 3, null, null, 'O', null),
      (2, 101, 'NOTA DE CRÉDITO', 'B3DA16B8', '2775664446', null, '2023-10-31', 1, 1, 'VIGENTE', 1187.5, 1187.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 9DEDCD57 - 240864469', 82, '9DEDCD57', '240864469', '2023-10-19', 0, 'M', 'AEV', '2023-11-08 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 102, 'NOTA DE CRÉDITO', '9904EFB6', '3533652266', null, '2023-11-06', 1, 1, 'OPERADA', 57, 57, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR DAÑADOS Y QUEBRADOS', 83, 'C71909AE', '3128312510', '2023-11-24', 0, 'M', 'AEV', '2023-12-04 00:00:00', 'AEV', '2023-12-04 00:00:00', 3, null, null, 'O', null),
      (2, 103, 'NOTA DE CRÉDITO', 'C0744057', '4234363158', null, '2023-11-30', 1, 1, 'VIGENTE', 2155.05, 2155.05, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C71909AE - 3128312510', 83, 'C71909AE', '3128312510', '2023-11-24', 0, 'M', 'AEV', '2023-12-04 00:00:00', 'AEV', '2023-12-04 00:00:00', 3, null, null, 'I', null),
      (2, 104, 'NOTA DE CRÉDITO', '4B477B48', '3851636098', null, '2023-12-12', 1, 1, 'VIGENTE', 1489.25, 1489.25, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 4CA65495 - 2950120055', 84, '4CA65495', '2950120055', '2023-11-30', 0, 'M', 'AEV', '2023-12-15 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 105, 'NOTA DE CRÉDITO', '57238E98', '1007043135', null, '2024-01-31', 1, 1, 'VIGENTE', 6603.44, 6603.44, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 63B915CD - 2741260060', 85, '63B915CD', '2741260060', '2024-01-26', 0, 'M', 'AEV', '2024-02-02 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 106, 'NOTA DE CRÉDITO', '86706A3B', '828129864', null, '2024-02-29', 1, 1, 'VIGENTE', 11658.92, 11658.92, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B73D09F1 - 3353626338', 86, 'B73D09F1', '3353626338', '2024-02-26', 0, 'M', 'AEV', '2024-03-05 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 107, 'NOTA DE CRÉDITO', '069D4545', '3172550499', null, '2024-01-31', 1, 1, 'OPERADA', 390.9, 390.9, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR DAÑADOS Y QUEBRADOS', 86, 'B73D09F1', '3353626338', '2024-02-26', 0, 'M', 'AEV', '2024-03-05 00:00:00', 'AEV', '2024-03-05 00:00:00', 3, null, null, 'O', null),
      (2, 108, 'NOTA DE CRÉDITO', 'A50C77DA', '3324788866', null, '2024-01-31', 1, 1, 'OPERADA', 1.49, 1.49, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR DAÑADOS Y QUEBRADOS', 86, 'B73D09F1', '3353626338', '2024-02-26', 0, 'M', 'AEV', '2024-03-05 00:00:00', 'AEV', '2024-03-05 00:00:00', 3, null, null, 'O', null),
      (2, 109, 'NOTA DE CRÉDITO', '35B4EDBB', '1482180792', null, '2024-03-21', 1, 1, 'VIGENTE', 1654.1, 1654.1, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: BFB1E8DD - 4210902722', 88, 'BFB1E8DD', '4210902722', '2024-02-29', 0, 'M', 'AEV', '2024-04-09 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 110, 'NOTA DE CRÉDITO', '9F2F93AA', '2560968254', null, '2024-03-21', 1, 1, 'VIGENTE', 12801.92, 12801.92, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 53066D55 - 2619556364', 89, '53066D55', '2619556364', '2024-02-29', 0, 'M', 'AEV', '2024-04-09 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 111, 'NOTA DE CRÉDITO', 'F8B3BD39', '1975009434', null, '2024-03-25', 1, 1, 'VIGENTE', 2443.18, 2443.18, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 1677430D - 713048145', 90, '1677430D', '713048145', '2024-03-18', 0, 'M', 'AEV', '2024-04-09 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 112, 'NOTA DE CRÉDITO', '841B3812', '3078505031', null, '2024-03-20', 1, 1, 'OPERADA', 1362.2, 1362.2, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR QUEBRADOS Y/O DAÑADOS', 90, '1677430D', '713048145', '2024-03-18', 0, 'M', 'AEV', '2024-04-09 00:00:00', 'AEV', '2024-04-09 00:00:00', 3, null, null, 'O', null),
      (2, 113, 'NOTA DE CRÉDITO', '145F385C', '616189781', null, '2024-03-20', 1, 1, 'OPERADA', 53.13, 53.13, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR DÑADOS Y/O QUEBRADOS', 90, '1677430D', '713048145', '2024-03-18', 0, 'M', 'AEV', '2024-04-09 00:00:00', 'AEV', '2024-04-09 00:00:00', 3, null, null, 'O', null),
      (2, 114, 'NOTA DE CRÉDITO', '85BAC34B', '1259160503', null, '2024-04-15', 1, 1, 'VIGENTE', 1399, 1399, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: DD229A06 - 3100984494', 91, 'DD229A06', '3100984494', '2024-03-22', 0, 'M', 'AEV', '2024-04-22 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 115, 'NOTA DE CRÉDITO', '3D0F6AFE', '3845737331', null, '2024-04-15', 1, 1, 'VIGENTE', 8444.33, 8444.33, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: F56918E9 - 2982889817', 92, 'F56918E9', '2982889817', '2024-03-22', 0, 'M', 'AEV', '2024-04-22 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 116, 'NOTA DE CRÉDITO', '4135FA52', '1429490427', null, '2024-05-07', 1, 1, 'VIGENTE', 25844.5, 25844.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A5A46F88 - 180637658', 94, 'A5A46F88', '180637658', '2024-04-24', 0, 'M', 'AEV', '2024-05-08 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 117, 'NOTA DE CRÉDITO', 'B4BCB9F1', '1928743445', null, '2024-04-15', 1, 1, 'OPERADA', 6369.75, 6369.75, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR PRODUCTOS QUEBRADOS Y DAÑADOS', 94, 'A5A46F88', '180637658', '2024-04-24', 0, 'M', 'AEV', '2024-05-08 00:00:00', 'AEV', '2024-05-08 00:00:00', 3, null, null, 'O', null),
      (2, 118, 'NOTA DE CRÉDITO', '086AF23C', '2352106232', null, '2024-04-11', 1, 1, 'OPERADA', 19.46, 19.46, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR DAÑADOS Y QUEBRADOS', 94, 'A5A46F88', '180637658', '2024-04-24', 0, 'M', 'AEV', '2024-05-08 00:00:00', 'AEV', '2024-05-08 00:00:00', 3, null, null, 'O', null),
      (2, 119, 'NOTA DE CRÉDITO', '465125E8', '31999406', null, '2024-04-22', 1, 1, 'VIGENTE', 910, 910, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B65B6619-1055737896', 94, 'A5A46F88', '180637658', '2024-04-24', 0, 'M', 'AEV', '2024-05-08 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 120, 'NOTA DE CRÉDITO', '83BB0A7D', '1028014329', null, '2024-05-07', 1, 1, 'VIGENTE', 6529.5, 6529.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 75C68709 - 3950267253', 95, '75C68709', '3950267253', '2024-04-25', 0, 'M', 'AEV', '2024-05-08 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 121, 'NOTA DE CRÉDITO', '5C00F8D7', '4121772234', null, '2024-05-14', 1, 1, 'VIGENTE', 1330, 1330, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 324629DE - 2680243111', 96, '324629DE', '2680243111', '2024-04-30', 0, 'M', 'AEV', '2024-05-15 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 122, 'NOTA DE CRÉDITO', 'AB89A9B1', '542460620', null, '2024-05-06', 1, 1, 'OPERADA', 968.8, 968.8, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR QUEBRADOS Y DAÑADOS', 96, '324629DE', '2680243111', '2024-04-30', 0, 'M', 'AEV', '2024-05-15 00:00:00', 'AEV', '2024-05-15 00:00:00', 3, null, null, 'O', null),
      (2, 123, 'NOTA DE CRÉDITO', '858C28BD', '61230004', null, '2023-09-28', 1, 1, 'VIGENTE', 2175, 2175, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 6F5B5DFE - 1428046735', 79, '6F5B5DFE', '1428046735', '2023-09-28', 0, 'M', 'AEV', '2024-05-15 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 124, 'NOTA DE CRÉDITO', '394E5FC0', '2122075004', null, '2024-05-30', 1, 1, 'VIGENTE', 2100, 2100, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C6058772 - 613239700', 104, 'C6058772', '613239700', '2024-05-20', 0, 'M', 'AEV', '2024-05-30 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 125, 'NOTA DE CRÉDITO', '0576B837', '3053340339', null, '2024-05-24', 1, 1, 'VIGENTE', 1108.7, 1108.7, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 6A417AC6 - 107954407', 102, '6A417AC6', '107954407', '2024-05-10', 0, 'M', 'AEV', '2024-05-30 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 126, 'NOTA DE CRÉDITO', '046952F7', '3291236479', null, '2024-05-30', 1, 1, 'VIGENTE', 6782.5, 6782.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: DD63323E - 791891786', 103, 'DD63323E', '791891786', '2024-05-23', 0, 'M', 'AEV', '2024-05-31 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 127, 'NOTA DE CRÉDITO', 'FC0E294D', '3390652727', null, '2024-05-30', 1, 1, 'OPERADA', 398, 398, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR QUEBRADOS Y DAÑADOS', 105, 'D954A75C', '2345420081', '2024-05-29', 0, 'M', 'AEV', '2024-06-12 00:00:00', 'AEV', '2024-06-12 00:00:00', 3, null, null, 'O', null),
      (2, 128, 'NOTA DE CRÉDITO', 'EDAE22A5', '2931704341', null, '2024-06-10', 1, 1, 'VIGENTE', 3770.25, 3770.25, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: D954A75C - 2345420081', 105, 'D954A75C', '2345420081', '2024-05-29', 0, 'M', 'AEV', '2024-06-12 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 129, 'NOTA DE CRÉDITO', 'DAA60643', '2698792235', null, '2024-06-10', 1, 1, 'VIGENTE', 535.28, 535.28, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: BC30590C - 1527203139', 106, 'BC30590C', '1527203139', '2024-05-30', 0, 'M', 'AEV', '2024-06-12 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 130, 'NOTA DE CRÉDITO', '7D187B70', '3381677752', null, '2024-06-17', 1, 1, 'VIGENTE', 7005.95, 7005.95, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 8535DED7 - 1027883535', 107, '8535DED7', '1027883535', '2024-06-10', 0, 'M', 'AEV', '2024-06-18 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 131, 'NOTA DE CRÉDITO', 'E686B6C6', '3416932373', null, '2024-06-26', 1, 1, 'VIGENTE', 9775.4, 9775.4, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 7D966B1E - 3942401263', 108, '7D966B1E', '3942401263', '2024-06-18', 0, 'M', 'AEV', '2024-07-03 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 132, 'NOTA DE CRÉDITO', '7A5E9B0F', '3966060037', null, '2024-06-17', 1, 1, 'OPERADA', 1574, 1574, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y/O EN MAL ESTADO', 108, '7D966B1E', '3942401263', '2024-06-18', 0, 'M', 'AEV', '2024-07-03 00:00:00', 'AEV', '2024-07-03 00:00:00', 3, null, null, 'O', null),
      (2, 133, 'NOTA DE CRÉDITO', '9B3BD5D7', '2071937747', null, '2024-06-26', 1, 1, 'VIGENTE', 37, 37, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: F62806B2 - 1937461046', 109, 'F62806B2', '1937461046', '2024-06-25', 0, 'M', 'AEV', '2024-07-03 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 134, 'NOTA DE CRÉDITO', '860FBC3C', '1038700122', null, '2024-06-26', 1, 1, 'OPERADA', 83.7, 83.7, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: A1FDEA0B - 774783948', 111, 'A1FDEA0B', '774783948', '2024-06-27', 0, 'M', 'AEV', '2024-07-05 00:00:00', 'AEV', '2024-07-05 00:00:00', 3, null, null, 'O', null),
      (2, 135, 'NOTA DE CRÉDITO', 'D1F9EE11', '1418021146', null, '2024-07-04', 1, 1, 'VIGENTE', 3001.5, 3001.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A1FDEA0B - 774783948', 111, 'A1FDEA0B', '774783948', '2024-06-27', 0, 'M', 'AEV', '2024-07-05 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 136, 'NOTA DE CRÉDITO', '939E4C97', '2265727152', null, '2024-07-05', 1, 1, 'VIGENTE', 40, 40, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: F16F0EC7 - 3324855604', 110, 'F16F0EC7', '3324855604', '2024-06-28', 0, 'M', 'AEV', '2024-07-05 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 137, 'NOTA DE CRÉDITO', '771C771C', '4087693501', null, '2024-07-30', 1, 1, 'VIGENTE', 1870, 1870, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: CB4443B8 - 3279505596', 113, 'CB4443B8', '3279505596', '2024-07-22', 0, 'M', 'AEV', '2024-08-06 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 138, 'NOTA DE CRÉDITO', '0935D328', '3440397319', null, '2024-07-23', 1, 1, 'VIGENTE', 3390, 3390, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 60C1E5C5 - 1938967280', 112, '60C1E5C5', '1938967280', '2024-07-16', 0, 'M', 'AEV', '2024-08-06 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 139, 'NOTA DE CRÉDITO', '85CC606F', '75211805', null, '2024-07-31', 1, 1, 'ANULADA', 9160, 9160, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'AJUSTE POR PRODUCTO DAÑADO Y/O QUEBRADO', 114, '85CC606F', '752110805', '2024-07-31', 0, 'M', 'AEV', '2024-08-16 00:00:00', 'AEV', '2024-08-16 00:00:00', 3, null, null, 'A', null),
      (2, 140, 'NOTA DE CRÉDITO', '5DE68551', '1577010035', null, '2024-07-31', 1, 1, 'OPERADA', 6281, 6281, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'AJUSTE DE INVENTARIO POR PRODUCTO DAÑADO Y/O QUEBRADO', 114, '85CC606F', '752110805', '2024-07-31', 0, 'M', 'AEV', '2024-08-16 00:00:00', 'AEV', '2024-08-16 00:00:00', 3, null, null, 'O', null),
      (2, 141, 'NOTA DE CRÉDITO', '9AA9B7ED', '3640018747', null, '2024-08-14', 1, 1, 'VIGENTE', 595.5, 595.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 85CC606F - 752110805', 114, '85CC606F', '752110805', '2024-07-31', 0, 'M', 'AEV', '2024-08-16 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 142, 'NOTA DE CRÉDITO', 'C63902BF', '3766436914', null, '2024-08-14', 1, 1, 'VIGENTE', 6004.3, 6004.3, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 61B94128 - 145639035', 115, '61B94128', '145639035', '2024-07-31', 0, 'M', 'AEV', '2024-08-16 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 143, 'NOTA DE CRÉDITO', '18A973E0', '2174831548', null, '2024-08-14', 1, 1, 'VIGENTE', 6493, 6493, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A711C554 - 2001095779', 116, 'A711C554', '2001095779', '2024-07-31', 0, 'M', 'AEV', '2024-08-16 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 144, 'NOTA DE CRÉDITO', '025A4D07', '4172761513', null, '2024-08-19', 1, 1, 'VIGENTE', 97.5, 97.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 2471029E - 3192668751', 117, '2471029E', '3192668751', '2024-08-12', 0, 'M', 'AEV', '2024-08-19 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 145, 'NOTA DE CRÉDITO', 'AFC3FCA6', '64179401', null, '2024-08-21', 1, 1, 'OPERADA', 34.72, 34.72, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTOS QUEBRADOS Y/O EN MAL ESTADO', 118, '7852D66C', '2566867498', '2024-08-14', 0, 'M', 'AEV', '2024-08-23 00:00:00', 'AEV', '2024-08-23 00:00:00', 3, null, null, 'O', null),
      (2, 146, 'NOTA DE CRÉDITO', '20F2EBA0', '3242213644', null, '2024-08-21', 1, 1, 'VIGENTE', 49.5, 49.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 7852D66C - 2566867498', 118, '7852D66C', '2566867498', '2024-08-14', 0, 'M', 'AEV', '2024-08-23 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 147, 'NOTA DE CRÉDITO', 'D1466E76', '999245704', null, '2024-08-30', 1, 1, 'VIGENTE', 1375, 1375, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 4A05661C - 3825682661', 121, '4A05661C', '3825682661', '2024-08-23', 0, 'M', 'AEV', '2024-09-04 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 148, 'NOTA DE CRÉDITO', '203D021F', '871252359', null, '2024-08-30', 1, 1, 'VIGENTE', 487.5, 487.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 560E11B6 - 2807973706', 123, '560E11B6', '2807973706', '2024-08-27', 0, 'M', 'AEV', '2024-09-04 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 149, 'NOTA DE CRÉDITO', '56D51ED5', '3359328284', null, '2024-08-23', 1, 1, 'VIGENTE', 4006, 4006, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 70E20F61 - 335628887', 120, '70E20F61', '335628887', '2024-08-20', 0, 'M', 'AEV', '2024-09-04 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 150, 'NOTA DE CRÉDITO', 'E663C18C', '1641041812', null, '2024-09-05', 1, 1, 'VIGENTE', 6254.1, 6254.1, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 331518ED - 709707540', 122, '331518ED', '709707540', '2024-08-29', 0, 'M', 'AEV', '2024-09-05 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 151, 'NOTA DE CRÉDITO', '3FA96BA9', '1773030834', null, '2024-08-30', 1, 1, 'OPERADA', 32, 32, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'NOTA DE CRÉDITO POR PRODUCTO QUEBRADO', 124, '82403ECE', '1452294377', '2024-09-04', 0, 'M', 'AEV', '2024-09-05 00:00:00', 'AEV', '2024-09-05 00:00:00', 3, null, null, 'O', null),
      (2, 152, 'NOTA DE CRÉDITO', 'DCAC8085', '1521698051', null, '2024-09-05', 1, 1, 'VIGENTE', 49.5, 49.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 82403ECE - 1452294377', 124, '82403ECE', '1452294377', '2024-09-04', 0, 'M', 'AEV', '2024-09-05 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 153, 'NOTA DE CRÉDITO', 'C7114E28', '3040429362', null, '2024-09-05', 1, 1, 'OPERADA', 112, 112, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y/O DAÑADO', 125, '7ED8B7A6', '1831488127', '2024-09-12', 0, 'M', 'AEV', '2024-09-17 00:00:00', 'AEV', '2024-09-17 00:00:00', 3, null, null, 'O', null),
      (2, 154, 'NOTA DE CRÉDITO', '8CC1F153', '81087065', null, '2024-09-17', 1, 1, 'VIGENTE', 260, 260, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 7ED8B7A6 - 1831488127', 125, '7ED8B7A6', '1831488127', '2024-09-12', 0, 'M', 'AEV', '2024-09-17 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 155, 'NOTA DE CRÉDITO', '2FE69AD1', '1171538666', null, '2024-10-02', 1, 1, 'VIGENTE', 3135, 3135, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 5CA767DC - 887049682', 126, '5CA767DC', '887049682', '2024-09-27', 0, 'M', 'AEV', '2024-10-07 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 156, 'NOTA DE CRÉDITO', 'B47B0802', '1393511811', null, '2024-10-02', 1, 1, 'VIGENTE', 2360, 2360, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 9B3D5535 - 2827764478', 127, '9B3D5535', '2827764478', '2024-09-30', 0, 'M', 'AEV', '2024-10-07 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 157, 'NOTA DE CRÉDITO', 'A7DB0611', '2926199535', null, '2024-10-03', 1, 1, 'OPERADA', 695.2, 695.2, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y/O DAÑADO', 128, '13AFFDBA', '750864700', '2024-10-15', 0, 'M', 'AEV', '2024-10-22 00:00:00', 'AEV', '2024-10-22 00:00:00', 3, null, null, 'O', null),
      (2, 158, 'NOTA DE CRÉDITO', '0B6D3CDF', '1271283937', null, '2024-10-21', 1, 1, 'VIGENTE', 480, 480, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 13AFFDBA - 750864700', 128, '13AFFDBA', '750864700', '2024-10-15', 0, 'M', 'AEV', '2024-10-22 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 159, 'NOTA DE CRÉDITO', 'B3F3635E', '2373733276', null, '2024-10-25', 1, 1, 'OPERADA', 340, 340, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTOS QUEBRADOS Y/O EN MAL ESTADO', 131, '87DC2949', '3093119479', '2024-10-22', 0, 'M', 'AEV', '2024-10-29 00:00:00', 'AEV', '2024-10-29 00:00:00', 3, null, null, 'O', null),
      (2, 160, 'NOTA DE CRÉDITO', '5B96AF97', '1531988557', null, '2024-10-25', 1, 1, 'VIGENTE', 17146.25, 17146.25, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 87DC2949 - 3093119479', 131, '87DC2949', '3093119479', '2024-10-22', 0, 'M', 'AEV', '2024-10-29 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 161, 'NOTA DE CRÉDITO', '8E539746', '3092400673', null, '2024-10-18', 1, 1, 'VIGENTE', 36, 36, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 5A8001EE - 2391493835', 130, '5A8001EE', '2391493835', '2024-10-21', 0, 'M', 'AEV', '2024-10-29 00:00:00', 'AEV', '2024-10-29 00:00:00', 3, null, null, 'I', null),
      (2, 162, 'NOTA DE CRÉDITO', 'A269207A', '3641985911', null, '2024-10-24', 1, 1, 'VIGENTE', 1249.75, 1249.75, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 5A8001EE - 2391493835', 130, '5A8001EE', '2391493835', '2024-10-21', 0, 'M', 'AEV', '2024-10-29 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 163, 'NOTA DE CRÉDITO', 'A8821180', '1178420255', null, '2024-10-28', 1, 1, 'OPERADA', 27, 27, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO DAÑADO Y/O QUEBRADO', 132, '02313A81', '3493547645', '2024-10-30', 0, 'M', 'AEV', '2024-11-20 00:00:00', 'AEV', '2024-11-20 00:00:00', 3, null, null, 'O', null),
      (2, 164, 'NOTA DE CRÉDITO', '4966716D', '360270044', null, '2024-11-08', 1, 1, 'VIGENTE', 4205.5, 4205.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 02313A81 - 3493547645', 132, '02313A81', '3493547645', '2024-10-30', 0, 'M', 'AEV', '2024-11-20 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 165, 'NOTA DE CRÉDITO', 'A27AD5B3', '1567704170', null, '2024-11-08', 1, 1, 'VIGENTE', 447.7, 447.7, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A6DF9DC4 - 3831251855', 133, 'A6DF9DC4', '3831251855', '2024-11-05', 0, 'M', 'AEV', '2024-11-20 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 166, 'NOTA DE CRÉDITO', '5B9F979E', '3838135043', null, '2024-11-08', 1, 1, 'OPERADA', 22, 22, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y/O DAÑADO', 134, '644543A0', '626214215', '2024-11-05', 0, 'M', 'AEV', '2024-11-20 00:00:00', 'AEV', '2024-11-20 00:00:00', 3, null, null, 'O', null),
      (2, 167, 'NOTA DE CRÉDITO', '7E68055E', '4070917157', null, '2024-11-08', 1, 1, 'OPERADA', 8, 8, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y/O DAÑADO', 134, '644543A0', '626214215', '2024-11-05', 0, 'M', 'AEV', '2024-11-20 00:00:00', 'AEV', '2024-11-20 00:00:00', 3, null, null, 'O', null),
      (2, 168, 'NOTA DE CRÉDITO', '471AA46D', '4083042653', null, '2024-11-13', 1, 1, 'VIGENTE', 6566.75, 6566.75, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 644543A0 - 626214215', 134, '644543A0', '626214215', '2024-11-05', 0, 'M', 'AEV', '2024-11-20 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 169, 'NOTA DE CRÉDITO', '88D544D3', '299254134', null, '2024-11-13', 1, 1, 'VIGENTE', 1569.5, 1569.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 442540E4 - 962282612', 135, '442540E4', '962282612', '2024-11-07', 0, 'M', 'AEV', '2024-11-20 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 170, 'NOTA DE CRÉDITO', 'DCCA6886', '1632456642', null, '2024-11-13', 1, 1, 'OPERADA', 79.98, 79.98, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO DAÑADO Y/O QUEBRADO', 136, 'F961C57A', '1899775135', '2024-11-15', 0, 'M', 'AEV', '2024-12-02 00:00:00', 'AEV', '2024-12-02 00:00:00', 3, null, null, 'O', null),
      (2, 171, 'NOTA DE CRÉDITO', '70D56E2A', '3069135668', null, '2024-11-29', 1, 1, 'VIGENTE', 4600.75, 4600.75, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: F961C57A - 1899775135', 136, 'F961C57A', '1899775135', '2024-11-15', 0, 'M', 'AEV', '2024-12-02 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 172, 'NOTA DE CRÉDITO', 'B2857086', '2846444376', null, '2024-11-29', 1, 1, 'VIGENTE', 387.5, 387.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 03589BF9 - 4276242513', 137, '03589BF9', '4276242513', '2024-11-28', 0, 'M', 'AEV', '2024-12-02 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 173, 'NOTA DE CRÉDITO', '8758E553', '992036365', null, '2024-12-09', 1, 1, 'VIGENTE', 2347.5, 2347.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 37C1EDA3 - 283919006', 138, '37C1EDA3', '283919006', '2024-12-03', 0, 'M', 'AEV', '2024-12-16 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 174, 'NOTA DE CRÉDITO', 'C961FBE6', '2437824795', null, '2024-12-09', 1, 1, 'OPERADA', 2.6, 2.6, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 139, '6F679958', '2533837264', '2024-12-10', 0, 'M', 'AEV', '2024-12-17 00:00:00', 'AEV', '2024-12-17 00:00:00', 3, null, null, 'O', null),
      (2, 175, 'NOTA DE CRÉDITO', '107463E8', '3232451827', null, '2024-12-16', 1, 1, 'VIGENTE', 19159.72, 19159.72, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 6F679958 - 2533837264', 139, '6F679958', '2533837264', '2024-12-10', 0, 'M', 'AEV', '2024-12-17 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 176, 'NOTA DE CRÉDITO', '9DDE1A7E', '323764693', null, '2024-12-16', 1, 1, 'OPERADA', 47, 47, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO DAÑADO Y/O MAL ESTADO', 140, '3D2B7B53', '908676336', '2025-01-14', 0, 'M', 'AEV', '2025-01-21 00:00:00', 'AEV', '2025-01-21 00:00:00', 3, null, null, 'O', null),
      (2, 177, 'NOTA DE CRÉDITO', 'F704BE98', '2891270837', null, '2025-01-20', 1, 1, 'VIGENTE', 1553, 1553, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 3D2B7B53 - 908676336', 140, '3D2B7B53', '908676336', '2025-01-14', 0, 'M', 'AEV', '2025-01-21 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 178, 'NOTA DE CRÉDITO', 'CF189233', '3879749310', null, '2025-01-20', 1, 1, 'OPERADA', 14.3, 14.3, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 141, 'A6840B03', '3746448708', '2025-01-31', 0, 'M', 'AEV', '2025-02-10 00:00:00', 'AEV', '2025-02-10 00:00:00', 3, null, null, 'O', null),
      (2, 179, 'NOTA DE CRÉDITO', '91FA3E89', '1567443615', null, '2025-02-06', 1, 1, 'VIGENTE', 49.5, 49.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A6840B03 - 3746448708', 141, 'A6840B03', '3746448708', '2025-01-31', 0, 'M', 'AEV', '2025-02-10 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 180, 'NOTA DE CRÉDITO', '9D39746E', '3394127168', null, '2025-02-10', 1, 1, 'VIGENTE', 2000, 2000, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 34F63F74 - 2504935159', 142, '34F63F74', '2504935159', '2025-02-03', 0, 'M', 'AEV', '2025-02-10 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 181, 'NOTA DE CRÉDITO', '3EB5FFA5', '3388817952', null, '2025-02-14', 1, 1, 'VIGENTE', 475, 475, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 445B2507 - 2240890130', 143, '445B2507', '2240890130', '2025-02-12', 0, 'M', 'AEV', '2025-02-17 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 182, 'NOTA DE CRÉDITO', 'B52BB846', '3070315635', null, '2025-02-20', 1, 1, 'VIGENTE', 2466, 2466, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 607D16FB - 776753106', 144, '607D16FB', '776753106', '2025-02-14', 0, 'M', 'AEV', '2025-02-24 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 183, 'NOTA DE CRÉDITO', '5B8307EA', '3422308803', null, '2025-02-25', 1, 1, 'VIGENTE', 6250, 6250, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: E2CF2114 - 3799664218', 145, 'E2CF2114', '3799664218', '2025-02-20', 0, 'M', 'AEV', '2025-02-25 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 184, 'NOTA DE CRÉDITO', 'E6AEEE04', '1890599524', null, '2025-02-25', 1, 1, 'VIGENTE', 50, 50, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 4E74CFA2 - 1314736029', 146, '4E74CFA2', '1314736029', '2025-03-12', 0, 'M', 'AEV', '2025-03-14 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 185, 'NOTA DE CRÉDITO', '4FFDAE62', '3822865792', null, '2025-03-13', 1, 1, 'VIGENTE', 687.5, 687.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 4E74CFA2 - 1314736029', 146, '4E74CFA2', '1314736029', '2025-03-12', 0, 'M', 'AEV', '2025-03-14 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 186, 'NOTA DE CRÉDITO', '59065023', '1068058769', null, '2025-03-13', 1, 1, 'VIGENTE', 2500, 2500, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 53020BC8 - 1336297655', 147, '53020BC8', '1336297655', '2025-03-12', 0, 'M', 'AEV', '2025-03-14 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 187, 'NOTA DE CRÉDITO', '3F4A1D09', '476728656', null, '2025-03-26', 1, 1, 'OPERADA', 1020, 1020, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO DAÑADO Y/O QUEBRADO', 150, '460B5B62', '245844747', '2025-04-09', 0, 'M', 'AEV', '2025-04-11 00:00:00', 'AEV', '2025-04-11 00:00:00', 3, null, null, 'O', null),
      (2, 188, 'NOTA DE CRÉDITO', '79513FD0', '1015367756', null, '2025-04-09', 1, 1, 'VIGENTE', 5000, 5000, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 460B5B62 - 245844747', 150, '460B5B62', '245844747', '2025-04-09', 0, 'M', 'AEV', '2025-04-11 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 189, 'NOTA DE CRÉDITO', '6D548B4E', '539119238', null, '2025-03-19', 1, 1, 'VIGENTE', 6488.05, 6488.05, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'Devolución de productos según factura: 23C7E5C2 - 3259911486', 148, '23C7E5C2', '3259911486', '2025-03-21', 0, 'M', 'AEV', '2025-04-11 00:00:00', 'OLM', '2025-04-11 00:00:00', 3, null, null, 'I', null),
      (2, 190, 'NOTA DE CRÉDITO', '41AEEA20', '2063748020', null, '2025-03-26', 1, 1, 'VIGENTE', 3161.5, 3161.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 23C7E5C2 - 3259911486', 148, '23C7E5C2', '3259911486', '2025-03-21', 0, 'M', 'AEV', '2025-04-11 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 191, 'NOTA DE CRÉDITO', '2C78E151', '4125966410', null, '2025-04-23', 1, 1, 'VIGENTE', 8490.5, 8490.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: F5D03670 - 1152534090', 151, 'F5D03670', '1152534090', '2025-04-10', 0, 'M', 'AEV', '2025-05-12 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 192, 'NOTA DE CRÉDITO', 'B1D49B59', '518341171', null, '2025-04-09', 1, 1, 'OPERADA', 15, 15, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO DAÑADO Y/O EN MAL ESTADO', 151, 'F5D03670', '1152534090', '2025-04-10', 0, 'M', 'AEV', '2025-05-12 00:00:00', 'AEV', '2025-05-12 00:00:00', 3, null, null, 'O', null),
      (2, 193, 'NOTA DE CRÉDITO', '6D02FD15', '4195829602', null, '2025-04-29', 1, 1, 'VIGENTE', 3430.6, 3430.6, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: D8D312FB - 488000528', 152, 'D8D312FB', '488000528', '2025-04-22', 0, 'M', 'AEV', '2025-05-12 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 194, 'NOTA DE CRÉDITO', 'A17809CB', '1783906781', null, '2025-04-28', 1, 1, 'VIGENTE', 5820.8, 5820.8, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 1FC36AC3 - 30559772', 153, '1FC36AC3', '30559772', '2025-04-25', 0, 'M', 'AEV', '2025-05-12 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 195, 'NOTA DE CRÉDITO', '0B277A7E', '3129558422', null, '2025-05-05', 1, 1, 'VIGENTE', 279.5, 279.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 4F79344F - 2658815225', 154, '4F79344F', '2658815225', '2025-04-28', 0, 'M', 'AEV', '2025-05-12 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 196, 'NOTA DE CRÉDITO', '43400C04', '1797016531', null, '2025-04-29', 1, 1, 'OPERADA', 38240, 38240, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'DOCUMENTOS EMITIDOS PARA AJUSTE DE PRECIOS', 155, '713D36D0', '1926450501', '2025-04-29', 0, 'M', 'AEV', '2025-05-13 00:00:00', 'AEV', '2025-05-13 00:00:00', 3, null, null, 'O', null),
      (2, 197, 'NOTA DE CRÉDITO', '5416D485', '3812640268', null, '2025-05-12', 1, 1, 'VIGENTE', 239, 239, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 713D36D0 - 1926450501', 155, '713D36D0', '1926450501', '2025-04-29', 0, 'M', 'AEV', '2025-05-13 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 198, 'NOTA DE CRÉDITO', '20E2672F', '1402621076', null, '2025-04-28', 1, 1, 'OPERADA', 73.6, 73.6, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y/O EN MAL ESTADO', 155, '713D36D0', '1926450501', '2025-04-29', 0, 'M', 'AEV', '2025-05-13 00:00:00', 'AEV', '2025-05-13 00:00:00', 3, null, null, 'O', null),
      (2, 199, 'NOTA DE CRÉDITO', '4850D0D9', '2346405014', null, '2025-04-29', 1, 1, 'OPERADA', 270, 270, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO FALTANTE EN DESPACHO', 155, '713D36D0', '1926450501', '2025-04-29', 0, 'M', 'AEV', '2025-05-13 00:00:00', 'AEV', '2025-05-13 00:00:00', 3, null, null, 'O', null),
      (2, 200, 'NOTA DE CRÉDITO', 'F6AF9C4A', '1666600895', null, '2025-04-29', 1, 1, 'OPERADA', 9, 9, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 155, '713D36D0', '1926450501', '2025-04-29', 0, 'M', 'AEV', '2025-05-13 00:00:00', 'AEV', '2025-05-13 00:00:00', 3, null, null, 'O', null),
      (2, 201, 'NOTA DE CRÉDITO', 'C785FCC3', '3772862382', null, '2025-04-23', 1, 1, 'VIGENTE', 58, 58, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 713D36D0 - 1926450501', 155, '713D36D0', '1926450501', '2025-04-29', 0, 'M', 'AEV', '2025-05-13 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 202, 'NOTA DE CRÉDITO', '703D1BFD', '2862434650', null, '2025-05-05', 1, 1, 'VIGENTE', 32.5, 32.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 713D36D0 - 1926450501', 155, '713D36D0', '1926450501', '2025-04-29', 0, 'M', 'AEV', '2025-05-13 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 203, 'NOTA DE CRÉDITO', '351113C9', '1592871819', null, '2025-05-05', 1, 1, 'OPERADA', 5.2, 5.2, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'DEVOLUCIÓN POR PRODUCTO QUEBRADO', 155, '713D36D0', '1926450501', '2025-04-29', 0, 'M', 'AEV', '2025-05-13 00:00:00', 'AEV', '2025-05-13 00:00:00', 3, null, null, 'O', null),
      (2, 204, 'NOTA DE CRÉDITO', 'E3470336', '740836005', null, '2025-05-05', 1, 1, 'VIGENTE', 71.5, 71.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 713D36D0 - 1926450501', 155, '713D36D0', '1926450501', '2025-04-29', 0, 'M', 'AEV', '2025-05-13 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 205, 'NOTA DE CRÉDITO', 'EFA4C2FE', '3934536260', null, '2025-05-05', 1, 1, 'OPERADA', 22.1, 22.1, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'DEVOLUCIÓN POR PRODUCTO QUEBRADO', 155, '713D36D0', '1926450501', '2025-04-29', 0, 'M', 'AEV', '2025-05-13 00:00:00', 'AEV', '2025-05-13 00:00:00', 3, null, null, 'O', null),
      (2, 206, 'NOTA DE CRÉDITO', '5BFA9B11', '3004713076', null, '2025-05-12', 1, 1, 'VIGENTE', 249, 249, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: BA7C14CA - 2544453241', 156, 'BA7C14CA', '2544453241', '2025-05-07', 0, 'M', 'AEV', '2025-05-13 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 207, 'NOTA DE CRÉDITO', '4144BFD6', '3817948183', null, '2025-05-12', 1, 1, 'VIGENTE', 243.75, 243.75, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A517124A - 1052920945', 157, 'A517124A', '1052920945', '2025-05-12', 0, 'M', 'AEV', '2025-05-13 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 208, 'NOTA DE CRÉDITO', '2F4CF882', '1831225787', null, '2025-05-20', 1, 1, 'VIGENTE', 312, 312, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: AD48BCC0 - 2361279052', 158, 'AD48BCC0', '2361279052', '2025-05-16', 0, 'M', 'AEV', '2025-06-03 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 209, 'NOTA DE CRÉDITO', 'B43FA27E', '2485143263', null, '2025-06-06', 1, 1, 'VIGENTE', 11240, 11240, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: DA140455 - 3974645941', 163, 'DA140455', '3974645941', '2025-05-30', 0, 'M', 'AEV', '2025-06-10 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 210, 'NOTA DE CRÉDITO', '4BABB0CD', '628378422', null, '2025-05-20', 1, 1, 'OPERADA', 3.2, 3.2, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 159, 'D438942A', '1031357224', '2025-05-29', 0, 'M', 'AEV', '2025-06-10 00:00:00', 'AEV', '2025-06-10 00:00:00', 3, null, null, 'O', null),
      (2, 211, 'NOTA DE CRÉDITO', 'EC48B9E1', '857686806', null, '2025-06-10', 1, 1, 'VIGENTE', 1250, 1250, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: D438942A - 1031357224', 159, 'D438942A', '1031357224', '2025-05-29', 0, 'M', 'AEV', '2025-06-10 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 212, 'NOTA DE CRÉDITO', 'CD630BC8', '848185606', null, '2025-06-06', 1, 1, 'VIGENTE', 3500, 3500, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 79A8A1DC - 2189838223', 160, '79A8A1DC', '2189838223', '2025-06-02', 0, 'M', 'AEV', '2025-06-10 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 213, 'NOTA DE CRÉDITO', 'FD6C773B', '445795141', null, '2025-06-10', 1, 1, 'VIGENTE', 64, 64, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A82BDFEA - 2250261449', 162, 'A82BDFEA', '2250261449', '2025-05-30', 0, 'M', 'AEV', '2025-06-13 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 214, 'NOTA DE CRÉDITO', '22E8F374', '1497514602', null, '2025-06-06', 1, 1, 'OPERADA', 324, 324, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO DAÑADO Y/O QUEBRADO', 166, '974D7003', '141443713', '2025-06-12', 0, 'M', 'AEV', '2025-06-25 00:00:00', 'AEV', '2025-06-25 00:00:00', 3, null, null, 'O', null),
      (2, 215, 'NOTA DE CRÉDITO', '5BC81DD3', '4011805853', null, '2025-06-06', 1, 1, 'OPERADA', 5, 5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y/O EN MAL ESTADO', 166, '974D7003', '141443713', '2025-06-12', 0, 'M', 'AEV', '2025-06-25 00:00:00', 'AEV', '2025-06-25 00:00:00', 3, null, null, 'O', null),
      (2, 216, 'NOTA DE CRÉDITO', '2303FA83', '2472691666', null, '2025-06-24', 1, 1, 'VIGENTE', 715, 715, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 974D7003 - 141443713', 166, '974D7003', '141443713', '2025-06-12', 0, 'M', 'AEV', '2025-06-25 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 217, 'NOTA DE CRÉDITO', 'FA7848C6', '4014820496', null, '2025-06-25', 1, 1, 'VIGENTE', 11857.15, 11857.15, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 160B2B27 - 1161642527', 167, '160B2B27', '1161642527', '2025-06-19', 0, 'M', 'AEV', '2025-06-26 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 218, 'NOTA DE CRÉDITO', '8C919679', '3779412502', null, '2025-07-11', 1, 1, 'VIGENTE', 2990, 2990, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A85C7227 - 4284237703', 168, 'A85C7227', '4284237703', '2025-06-26', 0, 'M', 'AEV', '2025-07-14 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 219, 'NOTA DE CRÉDITO', '47CC8C08', '2717536225', null, '2025-07-11', 1, 1, 'VIGENTE', 600, 600, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 1348DB88 - 998001761', 170, '1348DB88', '998001761', '2025-07-04', 0, 'M', 'AEV', '2025-07-14 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 220, 'NOTA DE CRÉDITO', '6326EAA1', '43796537', null, '2025-07-11', 1, 1, 'VIGENTE', 3300, 3300, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: F692CB04 - 2769502596', 169, 'F692CB04', '2769502596', '2025-06-27', 0, 'M', 'AEV', '2025-07-14 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 221, 'NOTA DE CRÉDITO', '2BB040C8', '3434759051', null, '2025-06-25', 1, 1, 'ANULADA', 214, 214, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: F692CB04 - 2769502596', 169, 'F692CB04', '2769502596', '2025-06-27', 0, 'M', 'AEV', '2025-07-14 00:00:00', 'AEV', '2025-07-14 00:00:00', 3, null, null, 'A', null),
      (2, 222, 'NOTA DE CRÉDITO', '2BB040C8', '3434759051', null, '2025-06-25', 1, 1, 'OPERADA', 214, 214, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'VECURONIO FALTANTE EN FACT NO.1161642527', 169, 'F692CB04', '2769502596', '2025-06-27', 0, 'M', 'AEV', '2025-07-14 00:00:00', 'AEV', '2025-07-14 00:00:00', 3, null, null, 'O', null),
      (2, 223, 'NOTA DE CRÉDITO', '20FEF8B8', '2895791267', null, '2025-06-25', 1, 1, 'VIGENTE', 89.05, 89.05, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', '5% DESCUENTO ADICIONAL EN 1,370 UNIDADES DE RANITIDINA DAÑADAS FACT 141443713', 169, 'F692CB04', '2769502596', '2025-06-27', 0, 'M', 'AEV', '2025-07-14 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 224, 'NOTA DE CRÉDITO', '54693A79', '4209659550', null, '2025-06-25', 1, 1, 'OPERADA', 39, 39, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO FACT 141443713', 169, 'F692CB04', '2769502596', '2025-06-27', 0, 'M', 'AEV', '2025-07-14 00:00:00', 'AEV', '2025-07-14 00:00:00', 3, null, null, 'O', null),
      (2, 225, 'NOTA DE CRÉDITO', 'B1AF689C', '371345979', null, '2025-06-27', 1, 1, 'OPERADA', 880, 880, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO FACT 1161642527', 169, 'F692CB04', '2769502596', '2025-06-27', 0, 'M', 'AEV', '2025-07-14 00:00:00', 'AEV', '2025-07-14 00:00:00', 3, null, null, 'O', null),
      (2, 226, 'NOTA DE CRÉDITO', '861FC5CF', '638077126', null, '2025-07-02', 1, 1, 'ANULADA', 143, 143, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', '5% DESCUENTO ADICIONAL EN 13 CAJAS DAÑADAS DE PIPERACILINA FACT 1161642527', 169, 'F692CB04', '2769502596', '2025-06-27', 0, 'M', 'AEV', '2025-07-14 00:00:00', 'AEV', '2025-09-04 00:00:00', 3, null, null, 'A', null),
      (2, 227, 'NOTA DE CRÉDITO', '588DB104', '2912896215', null, '2025-07-11', 1, 1, 'VIGENTE', 88, 88, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 2FA0FC3A - 1130840119 por 8 cajas dañadas de piperacilima', 172, '2FA0FC3A', '1130840119', '2025-07-10', 0, 'M', 'AEV', '2025-07-29 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 228, 'NOTA DE CRÉDITO', 'F16763B0', '3405923605', null, '2025-07-11', 1, 1, 'OPERADA', 418, 418, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 172, '2FA0FC3A', '1130840119', '2025-07-10', 0, 'M', 'AEV', '2025-07-29 00:00:00', 'AEV', '2025-07-29 00:00:00', 3, null, null, 'O', null),
      (2, 229, 'NOTA DE CRÉDITO', 'A0F18464', '4139860292', null, '2025-07-23', 1, 1, 'VIGENTE', 6788.1, 6788.1, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 2FA0FC3A - 1130840119', 172, '2FA0FC3A', '1130840119', '2025-07-10', 0, 'M', 'AEV', '2025-07-29 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 230, 'NOTA DE CRÉDITO', '0BE65DD3', '4262809218', null, '2025-07-23', 1, 1, 'VIGENTE', 1000, 1000, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 4126662D - 1066028662', 174, '4126662D', '1066028662', '2025-07-16', 0, 'M', 'AEV', '2025-07-29 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 231, 'NOTA DE CRÉDITO', '0608ECF6', '2419869572', '|', '2025-07-30', 1, 1, 'VIGENTE', 1527.5, 1527.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 1634C5CA - 336351063', 175, '1634C5CA', '336351063', '2025-07-18', 0, 'M', 'AEV', '2025-07-30 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 232, 'NOTA DE CRÉDITO', 'F60E8C8C', '1943422206', null, '2025-07-29', 1, 1, 'VIGENTE', 120, 120, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 20D91A04 - 299057525', 177, '20D91A04', '299057525', '2025-07-28', 0, 'M', 'AEV', '2025-08-04 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 233, 'NOTA DE CRÉDITO', '8C968A46', '371934098', null, '2025-08-04', 1, 1, 'ANULADA', 5070, 5070, 9, 'MAVISA', 1910, 'POLIFARMA, S. A.', 1, 'DEVOLUCIÓN', 'PRODUCTO CORTO VENCIMIENTO CON CARTA DE COMPROMISO (PIPERACILINA)', 164, '7F0AD628', '20072283', '2025-06-06', 0, 'M', 'AEV', '2025-08-05 00:00:00', 'AEV', '2025-08-05 00:00:00', 9, null, null, 'A', null)) as x(loc, nota, tipo, serie, documento, autorizacion, fecha, moneda, cambio, estado, total, total_mi, bodega, bodega_nombre, proveedor, proveedor_nombre,
       tipo_ajuste_ant, tipo_ajuste, motivo, compra, serie_doc, numero_doc, fecha_doc, transaccion, clasif, usr_ing, f_ing, usr_mod, f_mod, bodega_destino, usr_anula, f_anula,
       estado_ant, obs) order by loc, nota loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    select p.id, p.nit, p.nombre_comercial into v_prov from public.proveedores p where p.localidad_id = v_loc and p.codigo = r.proveedor;
    if v_prov.id is null then n_s := n_s + 1; n_s_txt := n_s_txt || format(' 3-0%s nota %s (proveedor %s);', r.loc, r.nota, r.proveedor); continue; end if;
    v_bod := (select b.id from public.bodegas b where b.localidad_id = v_loc and b.codigo = r.bodega);
    v_compra := coalesce((select c.id from public.compras c where c.localidad_id = v_loc and c.origen_anterior = 'MEDICAMENTOS' and c.compra_anterior = r.compra limit 1),
                         (select c.id from public.compras c where c.localidad_id = v_loc and ((c.origen_anterior = 'VARIAS' and c.compra_anterior = r.compra) or c.compra_varia_anterior = r.compra) limit 1));
    if v_compra is not null and not exists (select 1 from public.compras c where c.id = v_compra and c.proveedor_id = v_prov.id) then v_compra := null; end if;
    if v_compra is null then n_sin_compra := n_sin_compra + 1; end if;
    v_mon := case when r.moneda = 2 then coalesce(v_usd, v_gtq) else v_gtq end;
    select id into v_id from public.notas_compra where localidad_id = v_loc and nota_anterior = r.nota;
    if v_id is null then
      v_num := case when exists (select 1 from public.notas_compra where localidad_id = v_loc and numero = r.nota)
                    then (select coalesce(max(numero), 0) + 1 from public.notas_compra where localidad_id = v_loc) else r.nota end;
      if v_num <> r.nota then n_otro := n_otro + 1; end if;
      insert into public.notas_compra (organizacion_id, localidad_id, numero, tipo, documento, fecha, moneda_id, proveedor_id, nota_anterior, origen_anterior)
      values (v_org, v_loc, v_num, r.tipo, coalesce(r.documento, r.nota::text), r.fecha, v_mon, v_prov.id, r.nota, 'MIGRADO')
      returning id into v_id;
      n_n := n_n + 1;
    else
      n_a := n_a + 1;
    end if;
    update public.notas_compra set
      tipo = r.tipo, numero_autorizacion = r.autorizacion, serie = r.serie, documento = coalesce(r.documento, r.nota::text), fecha = r.fecha,
      moneda_id = v_mon, tipo_cambio = coalesce(nullif(r.cambio, 0), 1), valor = greatest(case when r.moneda = 2 then coalesce(r.total_mi, r.total) else r.total end, 0),
      proveedor_id = v_prov.id, proveedor_codigo = r.proveedor::text, proveedor_nombre = coalesce(r.proveedor_nombre, v_prov.nombre_comercial), nit = v_prov.nit,
      bodega_id = v_bod, compra_id = v_compra, motivo = r.motivo, tipo_ajuste = r.tipo_ajuste,
      tipo_nota = case when r.clasif = 'M' then 'MANUAL' else 'AUTOMÁTICA' end, estado = r.estado,
      usuario = coalesce(upper(r.usr_ing), 'SISTEMA ANTERIOR'),
      operado_por = case when r.estado = 'OPERADA' then upper(coalesce(r.usr_mod, r.usr_ing)) end,
      operado_en = case when r.estado = 'OPERADA' then coalesce(r.f_mod, r.f_ing)::timestamptz end,
      anulado_por = case when r.estado = 'ANULADA' then upper(coalesce(r.usr_anula, r.usr_mod)) end,
      anulado_en = case when r.estado = 'ANULADA' then coalesce(r.f_anula, r.f_mod)::timestamptz end,
      motivo_anulacion = case when r.estado = 'ANULADA' then 'ANULADA EN EL SISTEMA ANTERIOR' end,
      creado_por_nombre = coalesce(upper(r.usr_ing), 'MIGRACIÓN'), creado_en = r.f_ing::timestamptz,
      modificado_por_nombre = upper(r.usr_mod), modificado_en = r.f_mod::timestamptz,
      origen_anterior = 'MIGRADO', nota_anterior = r.nota, estado_anterior = r.estado_ant, tipo_ajuste_anterior = r.tipo_ajuste_ant, clasificacion_nota_anterior = r.clasif,
      moneda_anterior = r.moneda, valor_mi = r.total_mi, bodega_nombre_anterior = r.bodega_nombre, bodega_destino_anterior = r.bodega_destino, compra_anterior = r.compra,
      serie_compra_anterior = r.serie_doc, numero_compra_anterior = r.numero_doc, fecha_compra_anterior = r.fecha_doc, transaccion_anterior = r.transaccion,
      usuario_ingresa_anterior = r.usr_ing, fecha_ingresa_anterior = r.f_ing, usuario_modifica_anterior = r.usr_mod, fecha_modifica_anterior = r.f_mod, observaciones = r.obs
    where id = v_id;
  end loop;

  -- Líneas de las notas.
  for r in select * from (values
      (2::integer, 84::integer, 1::integer, 38::integer, 'VIT 0035'::text, 'RANITIDINA VITALIS 50 mg/2mL SOLUCION INYECTABLE'::text, 'A221459'::text, '2024-12-03'::date, '2022-12-03'::date, 10::numeric, 1::numeric, 1::numeric, 0::numeric, 0::numeric, 10::numeric, 10::numeric, true::boolean, null::integer, null::text),
      (2, 85, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 894.65, 894.65, 0, 0, 894.65, 894.65, false, null, null),
      (2, 86, 1, 1, 'VIT 0015', 'DESCUENTO PARA LAS FACTURAS', 'P213564', '2023-12-31', '2021-12-31', 1, 675, 675, 0, 0, 675, 675, false, null, null),
      (2, 87, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2513, 2513, 0, 0, 2513, 2513, false, null, null),
      (2, 88, 1, 7, 'VIT 0004', 'AMIKACINA Vitalis 500 mg/2mL Solución inyectable', 'A230024', '2026-01-11', '2023-01-11', 200, 2.9, 2.9, 0, 0, 580, 580, true, null, null),
      (2, 89, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2337.4, 2337.4, 0, 0, 2337.4, 2337.4, false, null, null),
      (2, 90, 1, 18, 'VIT 0015', 'CLINDAMICINA Vitalis 600 mg/4 mL solución inyectable', 'A230565', '2024-07-03', '2023-07-03', 10, 3.59, 3.59, 0, 0, 35.9, 35.9, true, null, null),
      (2, 91, 1, 7, 'VIT 0004', 'AMIKACINA Vitalis 500 mg/2mL Solución inyectable', 'A230298', '2026-04-27', '2023-04-27', 350, 2.9, 2.9, 0, 0, 1015, 1015, true, null, null),
      (2, 92, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 8100.35, 8100.35, 0, 0, 8100.35, 8100.35, false, null, null),
      (2, 93, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 486.68, 486.68, 0, 0, 486.68, 486.68, false, null, null),
      (2, 94, 1, 38, 'VIT 0035', 'RANITIDINA VITALIS 50 mg/2mL SOLUCION INYECTABLE', 'A240122', '2026-02-14', '2024-02-14', 2970, 1.3, 1.3, 0, 0, 3861, 3861, true, null, null),
      (2, 95, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4433.65, 4433.65, 0, 0, 4433.65, 4433.65, false, null, null),
      (2, 96, 1, 18, 'VIT 0015', 'CLINDAMICINA Vitalis 600 mg/4 mL solución inyectable', 'A230678', '2024-08-02', '2023-08-02', 1140, 3.59, 3.59, 0, 0, 4092.6, 4092.6, true, null, null),
      (2, 96, 2, 23, 'VIT 0020', 'FUROSEMIDA Vitalis 20 mg/2 mL Solución Inyectable', 'A230572', '2026-07-06', '2023-07-06', 700, 0.95, 0.95, 0, 0, 665, 665, true, null, null),
      (2, 97, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6290.69, 6290.69, 0, 0, 6290.69, 6290.69, false, null, null),
      (2, 98, 1, 7, 'VIT 0004', 'AMIKACINA Vitalis 500 mg/2mL Solución inyectable', 'A230536', '2026-06-27', '2023-06-27', 760, 2.9, 2.9, 0, 0, 2204, 2204, true, null, null),
      (2, 99, 1, 18, 'VIT 0015', 'CLINDAMICINA Vitalis 600 mg/4 mL solución inyectable', 'A230793', '2024-09-04', '2023-09-04', 1850, 3.59, 3.59, 0, 0, 6641.5, 6641.5, true, null, null),
      (2, 100, 1, 29, 'VIT 0026', 'LIDOCAINA 1 % Polifarma Solución Inyectable', 'A221032', '2025-09-30', '2022-09-30', 1, 1.31, 1.31, 0, 0, 1.31, 1.31, true, null, null),
      (2, 100, 2, 15, 'VIT 0012', 'CEFTAZIDIMA Vitalis 1g Polvo Esteril para Solución Inyectable', 'C230070', '2026-05-27', '2023-05-27', 6, 9, 9, 0, 0, 54, 54, true, null, null),
      (2, 100, 3, 14, 'VIT 0011', 'CEFOTAXIMA Vitalis 1 g Polvo para solucion Inyectable', 'C230101', '2026-07-31', '2023-07-31', 1, 4.69, 4.69, 0, 0, 4.69, 4.69, true, null, null),
      (2, 101, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1187.5, 1187.5, 0, 0, 1187.5, 1187.5, false, null, null),
      (2, 102, 1, 23, 'VIT 0020', 'FUROSEMIDA Vitalis 20 mg/2 mL Solución Inyectable', 'A230729', '2026-08-19', '2023-08-19', 60, 0.95, 0.95, 0, 0, 57, 57, true, null, null),
      (2, 103, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2155.05, 2155.05, 0, 0, 2155.05, 2155.05, false, null, null),
      (2, 104, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1489.25, 1489.25, 0, 0, 1489.25, 1489.25, false, null, null),
      (2, 105, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6603.44, 6603.44, 0, 0, 6603.44, 6603.44, false, null, null),
      (2, 106, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 11658.92, 11658.92, 0, 0, 11658.92, 11658.92, false, null, null),
      (2, 107, 1, 7, 'VIT 0004', 'AMIKACINA Vitalis 500 mg/2mL Solución inyectable', 'A230740', '2026-08-20', '2023-08-20', 40, 2.9, 2.9, 0, 0, 116, 116, true, null, null),
      (2, 107, 2, 20, 'VIT 0017', 'DICLOFENACO SODICO Vitalis 75 mg/3 mL Solución Inyectable', 'A230339', '2026-05-07', '2023-05-07', 150, 0.84, 0.84, 0, 0, 126, 126, true, null, null),
      (2, 107, 3, 20, 'VIT 0017', 'DICLOFENACO SODICO Vitalis 75 mg/3 mL Solución Inyectable', 'A230516', '2026-06-23', '2023-06-23', 10, 0.84, 0.84, 0, 0, 8.4, 8.4, true, null, null),
      (2, 107, 4, 23, 'VIT 0020', 'FUROSEMIDA Vitalis 20 mg/2 mL Solución Inyectable', 'A230902', '2026-09-30', '2023-09-30', 10, 0.95, 0.95, 0, 0, 9.5, 9.5, true, null, null),
      (2, 107, 5, 29, 'VIT 0026', 'LIDOCAINA 1 % Polifarma Solución Inyectable', 'A230358', '2026-05-18', '2023-05-18', 100, 1.31, 1.31, 0, 0, 131, 131, true, null, null),
      (2, 108, 1, 19, 'VIT 0016', 'DEXAMETASONA FOSFATO Vitalis 4 mg/mL Solución Inyectable', 'P222900', '2025-08-31', '2022-08-31', 1, 1.49, 1.49, 0, 0, 1.49, 1.49, true, null, null),
      (2, 109, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1654.1, 1654.1, 0, 0, 1654.1, 1654.1, false, null, null),
      (2, 110, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 12801.92, 12801.92, 0, 0, 12801.92, 12801.92, false, null, null),
      (2, 111, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2443.18, 2443.18, 0, 0, 2443.18, 2443.18, false, null, null),
      (2, 112, 1, 30, 'VIT 0027', 'MEROPENEM Vitalis 500 mg polvo para solucion Inyectable', 'C230175', '2026-12-04', '2023-12-04', 70, 19.46, 19.46, 0, 0, 1362.2, 1362.2, true, null, null),
      (2, 113, 1, 16, 'VIT 0013', 'CEFTRIAXONA SODICA Vitalis 1g Polvo para solución inyectable', 'C230181', '2026-12-11', '2023-12-11', 11, 4.83, 4.83, 0, 0, 53.13, 53.13, true, null, null),
      (2, 114, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1399, 1399, 0, 0, 1399, 1399, false, null, null),
      (2, 115, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 8444.33, 8444.33, 0, 0, 8444.33, 8444.33, false, null, null),
      (2, 116, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 25844.5, 25844.5, 0, 0, 25844.5, 25844.5, false, null, null),
      (2, 117, 1, 40, 'VIT 0037', 'VANCOMICINA Vitalis 500 mg Polvo Liofilizado para Uso Parenteral', 'M230219', '2026-12-27', '2023-12-27', 10, 8.85, 8.85, 0, 0, 88.5, 88.5, true, null, null),
      (2, 117, 2, 27, 'VIT 0024', 'HIERRO SACAROSA Vitalis 100 mg/5 mL  Solución Inyectable', 'A240057', '2026-02-04', '2024-02-04', 335, 18.75, 18.75, 0, 0, 6281.25, 6281.25, true, null, null),
      (2, 118, 1, 30, 'VIT 0027', 'MEROPENEM Vitalis 500 mg polvo para solucion Inyectable', 'C230175', '2026-12-04', '2023-12-04', 1, 19.46, 19.46, 0, 0, 19.46, 19.46, true, null, null),
      (2, 119, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 910, 910, 0, 0, 910, 910, false, null, null),
      (2, 120, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6529.5, 6529.5, 0, 0, 6529.5, 6529.5, false, null, null),
      (2, 121, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1330, 1330, 0, 0, 1330, 1330, false, null, null),
      (2, 122, 1, 35, 'VIT 0032', 'PENICILINA G BENZATINICA VITALIS 2,400,000 UI POLVO PARA USO PARENTERAL', 'B240010', '2027-01-31', '2024-01-31', 1, 5.8, 5.8, 0, 0, 5.8, 5.8, true, null, null),
      (2, 122, 2, 7, 'VIT 0004', 'AMIKACINA Vitalis 500 mg/2mL Solución inyectable', 'A230939', '2026-10-05', '2023-10-05', 10, 3.4, 3.4, 0, 0, 34, 34, true, null, null),
      (2, 122, 3, 7, 'VIT 0004', 'AMIKACINA Vitalis 500 mg/2mL Solución inyectable', 'A231109', '2026-11-15', '2023-11-15', 40, 3.4, 3.4, 0, 0, 136, 136, true, null, null),
      (2, 122, 4, 20, 'VIT 0017', 'DICLOFENACO SODICO Vitalis 75 mg/3 mL Solución Inyectable', 'A230998', '2025-10-19', '2023-10-19', 250, 1.1, 1.1, 0, 0, 275, 275, true, null, null),
      (2, 122, 5, 23, 'VIT 0020', 'FUROSEMIDA Vitalis 20 mg/2 mL Solución Inyectable', 'A231107', '2026-11-07', '2023-11-07', 190, 0.99, 0.99, 0, 0, 188.1, 188.1, true, null, null),
      (2, 122, 6, 29, 'VIT 0026', 'LIDOCAINA 1 % Polifarma Solución Inyectable', 'A230358', '2026-05-18', '2023-05-18', 4, 1.6, 1.6, 0, 0, 6.4, 6.4, true, null, null),
      (2, 122, 7, 39, 'VIT 0036', 'TRAMADOL CLORHIDRATO Vitalis 100 mg/ 2mL Solución Inyectable', 'A230523', '2026-07-10', '2023-07-10', 40, 1.6, 1.6, 0, 0, 64, 64, true, null, null),
      (2, 122, 8, 4, 'VIT 0001', 'ACICLOVIR Vitalis 250 mg Polvo Liofilizado para Reconstituir', 'M240012', '2027-02-01', '2024-02-01', 1, 19.5, 19.5, 0, 0, 19.5, 19.5, true, null, null),
      (2, 122, 9, 40, 'VIT 0037', 'VANCOMICINA Vitalis 500 mg Polvo Liofilizado para Uso Parenteral', 'M240025', '2027-02-13', '2024-02-13', 4, 9, 9, 0, 0, 36, 36, true, null, null),
      (2, 122, 10, 16, 'VIT 0013', 'CEFTRIAXONA SODICA VITALIS 1G POLVO PARA SOLUCIÓN INYECTABLE CX10', 'C240010', '2027-01-23', '2024-01-23', 10, 5.1, 5.1, 0, 0, 51, 51, true, null, null),
      (2, 122, 11, 16, 'VIT 0013', 'CEFTRIAXONA SODICA VITALIS 1G POLVO PARA SOLUCIÓN INYECTABLE CX10', 'C240034', '2027-02-21', '2024-02-21', 30, 5.1, 5.1, 0, 0, 153, 153, true, null, null),
      (2, 123, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2175, 2175, 0, 0, 2175, 2175, false, null, null),
      (2, 124, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2100, 2100, 0, 0, 2100, 2100, false, null, null),
      (2, 125, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1108.7, 1108.7, 0, 0, 1108.7, 1108.7, false, null, null),
      (2, 126, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6782.5, 6782.5, 0, 0, 6782.5, 6782.5, false, null, null),
      (2, 127, 1, 158, 'VIT 0044', 'DIPIRONA 1G/2ML (METAMIZOL)', 'A240073', '2026-01-29', '2024-01-29', 200, 1.99, 1.99, 0, 0, 398, 398, true, null, null),
      (2, 128, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3770.25, 3770.25, 0, 0, 3770.25, 3770.25, false, null, null),
      (2, 129, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 535.28, 535.28, 0, 0, 535.28, 535.28, false, null, null),
      (2, 130, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 7005.95, 7005.95, 0, 0, 7005.95, 7005.95, false, null, null),
      (2, 131, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 9775.4, 9775.4, 0, 0, 9775.4, 9775.4, false, null, null),
      (2, 132, 1, 29, 'VIT 0026', 'LIDOCAINA 1 % Polifarma Solución Inyectable', 'A230358', '2026-05-18', '2023-05-18', 100, 1.6, 1.6, 0, 0, 160, 160, true, null, null),
      (2, 132, 2, 39, 'VIT 0036', 'TRAMADOL CLORHIDRATO Vitalis 100 mg/ 2mL Solución Inyectable', 'A230523', '2026-07-10', '2023-07-10', 110, 1.6, 1.6, 0, 0, 176, 176, true, null, null),
      (2, 132, 3, 39, 'VIT 0036', 'TRAMADOL CLORHIDRATO Vitalis 100 mg/ 2mL Solución Inyectable', 'A230524', '2026-07-10', '2023-07-10', 100, 1.6, 1.6, 0, 0, 160, 160, true, null, null),
      (2, 132, 4, 7, 'VIT 0004', 'AMIKACINA Vitalis 500 mg/2mL Solución inyectable', 'A240012', '2027-01-16', '2024-01-16', 300, 3.4, 3.4, 0, 0, 1020, 1020, true, null, null),
      (2, 132, 5, 35, 'VIT 0032', 'PENICILINA G BENZATINICA VITALIS 2,400,000 UI POLVO PARA USO PARENTERAL', 'B240010', '2027-01-31', '2024-01-31', 10, 5.8, 5.8, 0, 0, 58, 58, true, null, null),
      (2, 133, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 37, 37, 0, 0, 37, 37, false, null, null),
      (2, 134, 1, 4, 'VIT 0001', 'ACICLOVIR Vitalis 250 mg Polvo Liofilizado para Reconstituir', 'M240012', '2027-02-01', '2024-02-01', 3, 19.5, 19.5, 0, 0, 58.5, 58.5, true, null, null),
      (2, 134, 2, 52, 'VIT 0040', 'OMEPRAZOL VITALIS 40 MG. POLVO LIOFILIZADO PARA USO PARENTERAL CAJA X 50', 'Z240358', '2027-04-24', '2024-04-24', 1, 6.5, 6.5, 0, 0, 6.5, 6.5, true, null, null),
      (2, 134, 3, 21, 'VIT 0018', 'ESOMEPRAZOL Vitalis 40 mg Polvo liofilizado para uso parenteral', 'N240424', '2027-04-11', '2024-04-11', 1, 18.7, 18.7, 0, 0, 18.7, 18.7, true, null, null),
      (2, 135, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3001.5, 3001.5, 0, 0, 3001.5, 3001.5, false, null, null),
      (2, 136, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 40, 40, 0, 0, 40, 40, false, null, null),
      (2, 137, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1870, 1870, 0, 0, 1870, 1870, false, null, null),
      (2, 138, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3390, 3390, 0, 0, 3390, 3390, false, null, null),
      (2, 139, 1, 22, 'VIT 0019', 'FLUCONAZOL Vitalis 200 mg/100 mL Solución Inyectable', 'S240665', '2026-06-02', '2024-06-02', 400, 22.9, 22.9, 0, 0, 9160, 9160, false, null, null),
      (2, 140, 1, 38, 'VIT 0035', 'RANITIDINA VITALIS 50 mg/2mL SOLUCION INYECTABLE', 'A240265', '2026-03-18', '2024-03-18', 770, 1.3, 1.3, 0, 0, 1001, 1001, true, null, null),
      (2, 140, 2, 20, 'VIT 0017', 'DICLOFENACO SODICO Vitalis 75 mg/3 mL Solución Inyectable', 'A240075', '2026-01-30', '2024-01-30', 4800, 1.1, 1.1, 0, 0, 5280, 5280, true, null, null),
      (2, 141, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 595.5, 595.5, 0, 0, 595.5, 595.5, false, null, null),
      (2, 142, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6004.3, 6004.3, 0, 0, 6004.3, 6004.3, false, null, null),
      (2, 143, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6493, 6493, 0, 0, 6493, 6493, false, null, null),
      (2, 144, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 97.5, 97.5, 0, 0, 97.5, 97.5, false, null, null),
      (2, 145, 1, 29, 'VIT 0026', 'LIDOCAINA 1 % Polifarma Solución Inyectable', 'A230358', '2026-05-18', '2023-05-18', 13, 1.44, 1.44, 0, 0, 18.72, 18.72, true, null, null),
      (2, 145, 2, 30, 'VIT 0027', 'MEROPENEM Vitalis 500 mg polvo para solucion Inyectable', 'C240037', '2027-02-28', '2024-02-29', 1, 16, 16, 0, 0, 16, 16, true, null, null),
      (2, 146, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 49.5, 49.5, 0, 0, 49.5, 49.5, false, null, null),
      (2, 147, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1375, 1375, 0, 0, 1375, 1375, false, null, null),
      (2, 148, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 487.5, 487.5, 0, 0, 487.5, 487.5, false, null, null),
      (2, 149, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4006, 4006, 0, 0, 4006, 4006, false, null, null),
      (2, 150, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6254.1, 6254.1, 0, 0, 6254.1, 6254.1, false, null, null),
      (2, 151, 1, 163, 'VIT0049', 'CLINDAMICINA 600 MG/4ML- C100 LGU', 'A240823', '2026-01-03', '2024-07-03', 8, 4, 4, 0, 0, 32, 32, true, null, null),
      (2, 152, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 49.5, 49.5, 0, 0, 49.5, 49.5, false, null, null),
      (2, 153, 1, 38, 'VIT 0035', 'RANITIDINA VITALIS 50 mg/2mL SOLUCION INYECTABLE', 'A240265', '2026-03-18', '2024-03-18', 10, 1.3, 1.3, 0, 0, 13, 13, true, null, null),
      (2, 153, 2, 23, 'VIT 0020', 'FUROSEMIDA Vitalis 20 mg/2 mL Solución Inyectable', 'A231108', '2026-11-13', '2023-11-13', 100, 0.99, 0.99, 0, 0, 99, 99, true, null, null),
      (2, 154, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 260, 260, 0, 0, 260, 260, false, null, null),
      (2, 155, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3135, 3135, 0, 0, 3135, 3135, false, null, null),
      (2, 156, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2360, 2360, 0, 0, 2360, 2360, false, null, null),
      (2, 157, 1, 23, 'VIT 0020', 'FUROSEMIDA Vitalis 20 mg/2 mL Solución Inyectable', 'A240273', '2027-03-14', '2024-03-14', 700, 0.99, 0.99, 0, 0, 693, 693, true, null, null),
      (2, 157, 2, 161, 'VIT 0048', 'DICLOFENACO SODICO VITALIS 75 MG/3 ML SOLUCIÓN INYECTABLE CX100', 'A240683', '2026-06-06', '2024-06-06', 2, 1.1, 1.1, 0, 0, 2.2, 2.2, true, null, null),
      (2, 158, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 480, 480, 0, 0, 480, 480, false, null, null),
      (2, 159, 1, 164, 'VIT0050', 'AMIKACINA VITALIS 500 MG/2ML SOLUCIÓN INYECTABLE CAJA X 100', 'A240211', '2027-02-26', '2024-02-26', 100, 3.4, 3.4, 0, 0, 340, 340, true, null, null),
      (2, 160, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 17146.25, 17146.25, 0, 0, 17146.25, 17146.25, false, null, null),
      (2, 161, 1, 1, 'VIT0049', 'DESCUENTO PARA LAS FACTURAS', 'A240823', '2026-01-03', '2024-07-03', 1, 36, 36, 0, 0, 36, 36, false, null, null),
      (2, 162, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1249.75, 1249.75, 0, 0, 1249.75, 1249.75, false, null, null),
      (2, 163, 1, 40, 'VIT 0037', 'VANCOMICINA Vitalis 500 mg Polvo Liofilizado para Uso Parenteral', 'M240151', '2027-07-26', '2024-07-26', 3, 9, 9, 0, 0, 27, 27, true, null, null),
      (2, 164, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4205.5, 4205.5, 0, 0, 4205.5, 4205.5, false, null, null),
      (2, 165, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 447.7, 447.7, 0, 0, 447.7, 447.7, false, null, null),
      (2, 166, 1, 20, 'VIT 0017', 'DICLOFENACO SODICO Vitalis 75 mg/3 mL Solución Inyectable', 'A240772', '2026-06-26', '2024-06-26', 20, 1.1, 1.1, 0, 0, 22, 22, true, null, null),
      (2, 167, 1, 163, 'VIT0049', 'CLINDAMICINA 600 MG/4ML- C100 LGU', 'A241078', '2026-08-23', '2024-08-23', 2, 4, 4, 0, 0, 8, 8, true, null, null),
      (2, 168, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6566.75, 6566.75, 0, 0, 6566.75, 6566.75, false, null, null),
      (2, 169, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1569.5, 1569.5, 0, 0, 1569.5, 1569.5, false, null, null),
      (2, 170, 1, 13, 'VIT 0010', 'CEFEPIMA Vitalis 1 g Polvo Para Uso Parenteral', 'C240133', '2027-07-22', '2024-07-22', 5, 15.2, 15.2, 0, 0, 76, 76, true, null, null),
      (2, 170, 2, 158, 'VIT 0044', 'DIPIRONA 1G/2ML (METAMIZOL)', 'A240576', '2026-05-28', '2024-05-28', 2, 1.99, 1.99, 0, 0, 3.98, 3.98, true, null, null),
      (2, 171, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4600.75, 4600.75, 0, 0, 4600.75, 4600.75, false, null, null),
      (2, 172, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 387.5, 387.5, 0, 0, 387.5, 387.5, false, null, null),
      (2, 173, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2347.5, 2347.5, 0, 0, 2347.5, 2347.5, false, null, null),
      (2, 174, 1, 38, 'VIT 0035', 'RANITIDINA VITALIS 50 mg/2mL SOLUCION INYECTABLE', 'A240832', '2026-07-06', '2024-07-06', 2, 1.3, 1.3, 0, 0, 2.6, 2.6, true, null, null),
      (2, 175, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 19159.72, 19159.72, 0, 0, 19159.72, 19159.72, false, null, null),
      (2, 176, 1, 40, 'VIT 0037', 'VANCOMICINA Vitalis 500 mg Polvo Liofilizado para Uso Parenteral', 'M240192', '2027-10-04', '2024-10-04', 3, 9, 9, 0, 0, 27, 27, true, null, null),
      (2, 176, 2, 163, 'VIT0049', 'CLINDAMICINA 600 MG/4ML- C100 LGU', 'A241188', '2026-03-13', '2024-09-13', 3, 4, 4, 0, 0, 12, 12, true, null, null),
      (2, 176, 3, 167, 'VIT 0052', 'TRAMADOL CLORHIDRATO VITALIS 100 MG/ 2ML SOLUCIÓN INYECTABLE', 'A240675', '2027-06-13', '2024-06-13', 5, 1.6, 1.6, 0, 0, 8, 8, true, null, null),
      (2, 177, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1553, 1553, 0, 0, 1553, 1553, false, null, null),
      (2, 178, 1, 168, 'VIT0051', 'RANITIDINA VITALIS 50 MG/2ML SOLUCION INYECTABLE', 'A241153', '2026-09-10', '2024-09-10', 11, 1.3, 1.3, 0, 0, 14.3, 14.3, true, null, null),
      (2, 179, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 49.5, 49.5, 0, 0, 49.5, 49.5, false, null, null),
      (2, 180, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2000, 2000, 0, 0, 2000, 2000, false, null, null),
      (2, 181, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 475, 475, 0, 0, 475, 475, false, null, null),
      (2, 182, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2466, 2466, 0, 0, 2466, 2466, false, null, null),
      (2, 183, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6250, 6250, 0, 0, 6250, 6250, false, null, null),
      (2, 184, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 50, 50, 0, 0, 50, 50, false, null, null),
      (2, 185, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 687.5, 687.5, 0, 0, 687.5, 687.5, false, null, null),
      (2, 186, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2500, 2500, 0, 0, 2500, 2500, false, null, null),
      (2, 187, 1, 164, 'VIT0050', 'AMIKACINA VITALIS 500 MG/2ML SOLUCIÓN INYECTABLE CAJA X 100', 'A241194', '2027-09-19', '2024-09-19', 300, 3.4, 3.4, 0, 0, 1020, 1020, true, null, null),
      (2, 188, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5000, 5000, 0, 0, 5000, 5000, false, null, null),
      (2, 189, 1, 157, 'VIT 0045', 'KETOROLACO TROMETAMINA 30 MG/ML', 'KE23E03', '2025-05-17', '2023-05-17', 1445, 4.49, 4.49, 0, 0, 6488.05, 6488.05, true, null, null),
      (2, 190, 1, 1, 'VIT 0015', 'DESCUENTO PARA LAS FACTURAS', 'P213564', '2023-12-31', '2021-12-31', 1, 3161.5, 3161.5, 0, 0, 3161.5, 3161.5, false, null, null),
      (2, 191, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 8490.5, 8490.5, 0, 0, 8490.5, 8490.5, false, null, null),
      (2, 192, 1, 51, 'VIT 0039', 'CEFTRIAXONA SODICA VITALIS 1G POLVO PARA SOLUCIÓN INYECTABLE CX50', 'C240157', '2027-09-13', '2024-09-13', 3, 5, 5, 0, 0, 15, 15, true, null, null),
      (2, 193, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3430.6, 3430.6, 0, 0, 3430.6, 3430.6, false, null, null),
      (2, 194, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5820.8, 5820.8, 0, 0, 5820.8, 5820.8, false, null, null),
      (2, 195, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 279.5, 279.5, 0, 0, 279.5, 279.5, false, null, null),
      (2, 196, 1, 40, 'VIT 0037', 'VANCOMICINA Vitalis 500 mg Polvo Liofilizado para Uso Parenteral', 'M240207', '2027-10-29', '2024-10-29', 4780, 8, 8, 0, 0, 38240, 38240, true, null, null),
      (2, 197, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 239, 239, 0, 0, 239, 239, false, null, null),
      (2, 198, 1, 163, 'VIT0049', 'CLINDAMICINA 600 MG/4ML- C100 LGU', 'A241307', '2026-04-12', '2024-10-12', 10, 4, 4, 0, 0, 40, 40, true, null, null),
      (2, 198, 2, 167, 'VIT 0052', 'TRAMADOL CLORHIDRATO VITALIS 100 MG/ 2ML SOLUCIÓN INYECTABLE', 'A240886', '2027-08-09', '2024-08-09', 21, 1.6, 1.6, 0, 0, 33.6, 33.6, true, null, null),
      (2, 199, 1, 40, 'VIT 0037', 'VANCOMICINA Vitalis 500 mg Polvo Liofilizado para Uso Parenteral', 'M240207', '2027-10-29', '2024-10-29', 30, 9, 9, 0, 0, 270, 270, true, null, null),
      (2, 200, 1, 40, 'VIT 0037', 'VANCOMICINA Vitalis 500 mg Polvo Liofilizado para Uso Parenteral', 'M240207', '2027-10-29', '2024-10-29', 1, 9, 9, 0, 0, 9, 9, true, null, null),
      (2, 201, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 58, 58, 0, 0, 58, 58, false, null, null),
      (2, 202, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 32.5, 32.5, 0, 0, 32.5, 32.5, false, null, null),
      (2, 203, 1, 170, 'VIT 0054', 'METOCLOPRAMIDA 10 MG/2ML SOLUCION INYECTABLE', 'A241193', '2026-09-13', '2024-09-13', 4, 1.3, 1.3, 0, 0, 5.2, 5.2, true, null, null),
      (2, 204, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 71.5, 71.5, 0, 0, 71.5, 71.5, false, null, null),
      (2, 205, 1, 170, 'VIT 0054', 'METOCLOPRAMIDA 10 MG/2ML SOLUCION INYECTABLE', 'A241193', '2026-09-13', '2024-09-13', 17, 1.3, 1.3, 0, 0, 22.1, 22.1, true, null, null),
      (2, 206, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 249, 249, 0, 0, 249, 249, false, null, null),
      (2, 207, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 243.75, 243.75, 0, 0, 243.75, 243.75, false, null, null),
      (2, 208, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 312, 312, 0, 0, 312, 312, false, null, null),
      (2, 209, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 11240, 11240, 0, 0, 11240, 11240, false, null, null),
      (2, 210, 1, 167, 'VIT 0052', 'TRAMADOL CLORHIDRATO VITALIS 100 MG/ 2ML SOLUCIÓN INYECTABLE', 'A240888', '2027-08-09', '2024-08-09', 2, 1.6, 1.6, 0, 0, 3.2, 3.2, true, null, null),
      (2, 211, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1250, 1250, 0, 0, 1250, 1250, false, null, null),
      (2, 212, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3500, 3500, 0, 0, 3500, 3500, false, null, null),
      (2, 213, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 64, 64, 0, 0, 64, 64, false, null, null),
      (2, 214, 1, 165, 'VIT 0051', 'DEXAMETASONA FOSFATO VITALIS 4 MG/ML SOLUCIÓN INYECTABLE CAJA X 100', 'A240561', '2027-05-10', '2024-05-10', 2, 1, 1, 0, 0, 2, 2, true, null, null),
      (2, 214, 2, 28, 'VIT 0025', 'IMIPENEM + CILASTATINA Vitalis 0.5 g + 0.5 g Polvo para uso parenteral', 'C250047', '2028-03-06', '2025-03-06', 10, 32.2, 32.2, 0, 0, 322, 322, true, null, null),
      (2, 215, 1, 34, 'VIT 0031', 'OXACILINA Vitalis 1 g  Polvo para solucion Inyectable', 'L250031', '2028-02-24', '2025-02-24', 1, 5, 5, 0, 0, 5, 5, true, null, null),
      (2, 216, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 715, 715, 0, 0, 715, 715, false, null, null),
      (2, 217, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 11857.15, 11857.15, 0, 0, 11857.15, 11857.15, false, null, null),
      (2, 218, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2990, 2990, 0, 0, 2990, 2990, false, null, null),
      (2, 219, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 600, 600, 0, 0, 600, 600, false, null, null),
      (2, 220, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3300, 3300, 0, 0, 3300, 3300, false, null, null),
      (2, 221, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 214, 214, 0, 0, 214, 214, false, null, null),
      (2, 222, 1, 41, 'VIT 0038', 'VECURONIO BROMURO VITALIS 4mg/mL POLVO LIOFILIZADO PARA SOLUCIÓN INYEC', 'N241236', '2027-09-23', '2024-09-23', 20, 10.7, 10.7, 0, 0, 214, 214, true, null, null),
      (2, 223, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 89.05, 89.05, 0, 0, 89.05, 89.05, false, null, null),
      (2, 224, 1, 168, 'VIT0051', 'RANITIDINA VITALIS 50 MG/2ML SOLUCION INYECTABLE', 'A240832', '2026-07-06', '2024-07-06', 30, 1.3, 1.3, 0, 0, 39, 39, true, null, null),
      (2, 225, 1, 172, 'VIT 0056', 'PIPERACILINA + TAZOBACTAM  VITALIS 4 G / 0.5 G POLVO PARA USO PARENTERAL', 'L250062', '2028-04-28', '2025-04-28', 40, 22, 22, 0, 0, 880, 880, true, null, null),
      (2, 226, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 143, 143, 0, 0, 143, 143, false, null, null),
      (2, 227, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 88, 88, 0, 0, 88, 88, false, null, null),
      (2, 228, 1, 172, 'VIT 0056', 'PIPERACILINA + TAZOBACTAM  VITALIS 4 G / 0.5 G POLVO PARA USO PARENTERAL - CAJA X 10', 'L250062', '2028-04-28', '2025-04-28', 19, 22, 22, 0, 0, 418, 418, true, null, null),
      (2, 229, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6788.1, 6788.1, 0, 0, 6788.1, 6788.1, false, null, null),
      (2, 230, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1000, 1000, 0, 0, 1000, 1000, false, null, null),
      (2, 231, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1527.5, 1527.5, 0, 0, 1527.5, 1527.5, false, null, null),
      (2, 232, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 120, 120, 0, 0, 120, 120, false, null, null),
      (2, 233, 1, 176, 'LOT 0005', 'PIPERACILINA + TAZOBACTAM  4 G / 0.5 G POLVO PARA USO PARENTERAL - CAJA X 1', 'PT45I2402', '2026-01-31', '2024-02-01', 300, 16.9, 16.9, 0, 0, 5070, 5070, false, null, null)) as x(loc, nota, linea, producto, cod_prod, descripcion, lote, vence, fabrica, cantidad, precio, precio_mi, descu, descu_mi, total, total_mi, inv, bodega, registro) loop
    select n.id, n.localidad_id into v_id, v_loc from public.notas_compra n join public.localidades l on l.id = n.localidad_id
    where l.organizacion_id = v_org and l.correlativo = r.loc and n.nota_anterior = r.nota;
    if v_id is null then l_s := l_s + 1; continue; end if;
    insert into public.nota_compra_lineas (nota_id, linea, producto_id, descripcion, cantidad, precio, inventario, lote, registro_sanitario, fecha_vencimiento, fecha_fabricacion,
      bodega_id, origen_anterior, producto_anterior, codigo_producto_anterior, precio_mi_anterior, descuento_anterior, descuento_mi_anterior, valor_total_anterior, valor_total_mi_anterior)
    select v_id, r.linea, p.id, coalesce(r.descripcion, p.nombre, 'SIN DESCRIPCIÓN'), case when coalesce(r.cantidad, 0) > 0 then r.cantidad else 1 end,
           greatest(coalesce(r.precio, 0), 0), coalesce(r.inv, false) and p.id is not null, r.lote, r.registro, r.vence, r.fabrica,
           (select b.id from public.bodegas b where b.localidad_id = v_loc and b.codigo = r.bodega), 'MIGRADO', r.producto, r.cod_prod, r.precio_mi, r.descu, r.descu_mi, r.total, r.total_mi
    from (select 1) uno left join public.productos p on p.localidad_id = v_loc and p.codigo = r.producto
    on conflict (nota_id, linea) do update set producto_id = excluded.producto_id, descripcion = excluded.descripcion, cantidad = excluded.cantidad, precio = excluded.precio,
      inventario = excluded.inventario, lote = excluded.lote, registro_sanitario = excluded.registro_sanitario, fecha_vencimiento = excluded.fecha_vencimiento,
      fecha_fabricacion = excluded.fecha_fabricacion, bodega_id = excluded.bodega_id, origen_anterior = excluded.origen_anterior, producto_anterior = excluded.producto_anterior,
      codigo_producto_anterior = excluded.codigo_producto_anterior, precio_mi_anterior = excluded.precio_mi_anterior, descuento_anterior = excluded.descuento_anterior,
      descuento_mi_anterior = excluded.descuento_mi_anterior, valor_total_anterior = excluded.valor_total_anterior, valor_total_mi_anterior = excluded.valor_total_mi_anterior
    returning (xmax = 0) into v_nuevo;
    if v_nuevo then l_n := l_n + 1; else l_a := l_a + 1; end if;
  end loop;

  perform set_config('fin.nota', '', true);
  raise notice '%', format('Notas de compras de la organización 3: %s nuevas, %s actualizadas, %s con otro número (el suyo ya estaba ocupado), %s sin su compra en la base. Líneas: %s nuevas, %s actualizadas, %s sin nota.%s',
    n_n, n_a, n_otro, n_sin_compra, l_n, l_a, l_s, case when n_s > 0 then ' Omitidas por falta de proveedor:' || n_s_txt else '' end);
end;
$notas$;

notify pgrst, 'reload schema';
-- Script 246 · parte 4 de 5 · Organización 3 (Futura Farma - Mavisa), lote al 04-11-2026 (carpeta «Data Inventarios 2 Parte»): notas de crédito y débito de proveedores (Compras ›
--   Notas crédito compras), de ACT_NOTAS_COMPRAS.xls (150 notas de esta parte) y ACT_DET_NOTAS_COMPRAS.xls (164 líneas).
--   Misma lógica del script 243 (lote del 05 al 17-11-2026). Notas: 3-02 234 (ANULADA), 3-02 235 (OPERADA), 3-02 236 (VIGENTE), 3-02 237 (ANULADA), 3-02 238 (VIGENTE), 3-02 239 (VIGENTE), 3-02 240 (VIGENTE), 3-02 241 (VIGENTE), 3-02 242 (OPERADA), 3-02 243 (VIGENTE), 3-02 244 (VIGENTE), 3-02 245 (OPERADA), 3-02 246 (VIGENTE), 3-02 247 (VIGENTE), 3-02 248 (VIGENTE), 3-02 249 (VIGENTE), 3-02 250 (VIGENTE), 3-02 251 (VIGENTE), 3-02 252 (OPERADA), 3-02 253 (VIGENTE), 3-02 254 (VIGENTE), 3-02 255 (OPERADA), 3-02 256 (OPERADA), 3-02 257 (VIGENTE), 3-02 258 (ANULADA), 3-02 259 (VIGENTE), 3-02 260 (VIGENTE), 3-02 261 (VIGENTE), 3-02 262 (VIGENTE), 3-02 263 (VIGENTE), ….
--   1. Una nota se identifica por su localidad y su número NOTA (columna nueva nota_anterior) y conserva ese número; si ya lo usa una nota
--      hecha en este sistema, toma el siguiente libre. Las líneas, por su nota y LINEA. Si ya existen se actualizan.
--   2. Columnas nuevas (traen datos y no existían):
--      notas_compra: origen_anterior (marca MIGRADO), nota_anterior (NOTA), estado_anterior (ESTADO (I, O, A)), tipo_ajuste_anterior (TIPO_AJUSTE), clasificacion_nota_anterior (CLASIFICACION_NOTA), moneda_anterior (MONEDA), valor_mi (TOTAL_NOTA_MI), bodega_nombre_anterior (DESC_BODEGA), bodega_destino_anterior (BODEGA_DESTINO), compra_anterior (DOCUMENTO (compra)), serie_compra_anterior (SERIE_DOC), numero_compra_anterior (NUMERO_DOC), fecha_compra_anterior (FECHAHORA_EMISION_DOC), transaccion_anterior (TRANSACCION), usuario_ingresa_anterior (USUARIO_INGRESA), fecha_ingresa_anterior (FECHA_INGRESA), usuario_modifica_anterior (USUARIO_MODIFICA), fecha_modifica_anterior (FECHA_MODIFICA), observaciones (OBSERVACIONES).
--      nota_compra_lineas: origen_anterior (marca MIGRADO), producto_anterior (PRODUCTO), codigo_producto_anterior (CODIGO_PRODUCTO), precio_mi_anterior (VALOR_UNITARIO_MI), descuento_anterior (DESCUENTO), descuento_mi_anterior (DESCUENTO_MI), valor_total_anterior (VALOR_TOTAL), valor_total_mi_anterior (VALOR_TOTAL_MI).
--      Columnas vacías (no se migran): notas NUMERO_AUTORIZACION, TIPO_PRECIO, DIRECCION, OBSERVACIONES, NUMERO_AUTORIZACION_DOC, AÑO_POLIZA, MES_POLIZA, POLIZA, USUARIO_ANULA, FECHA_ANULA; líneas REGISTRO_SANITARIO, UNIDAD_MEDIDA, COSTO_UNITARIO, COSTO_UNITARIO_MI.
--   Equivalencias: TIPO_NOTA C = nota de crédito, D = de débito; SERIE y NUMERO = serie y documento del DTE; FECHAHORA_EMISION = fecha;
--   MONEDA 1 = quetzales, 2 = dólares, con VALOR_CAMBIO; TOTAL_NOTA = valor (en dólares, TOTAL_NOTA_MI); ESTADO I (ingresada) = VIGENTE,
--   O = OPERADA, A = ANULADA; TIPO_AJUSTE 1 = DEVOLUCIÓN, 2 = DESCUENTO; CLASIFICACION_NOTA M = manual; MOTIVO_AJUSTE = motivo.
--   Proveedor, bodega y producto por su código en la localidad (el NIT y el nombre se toman del proveedor). La factura de referencia es la
--   compra DOCUMENTO (de medicamentos o, si no hay, compra varia) si es del mismo proveedor; si no está en la base queda su número.
--   Las notas se cargan con su estado del sistema anterior, SIN generar póliza ni movimientos de inventario (el kardex migrado ya trae la
--   salida de las devoluciones: script 147). Una nota OPERADA rebaja el saldo de su compra (compras_saldo); una VIGENTE se puede descargar
--   o anular en Compras. Línea INVENTARIADA = S mueve inventario (sin producto queda como concepto). VALOR_TOTAL = cantidad × precio.
--   Fechas escritas con el año en dos cifras (29/04/0025, 28/04/0025, 5/05/0025, 6/06/0025): se toman del año 2000 en adelante.
--   Se ejecuta después del script 233. Se puede ejecutar de nuevo: actualiza.
set lock_timeout = '20s';
alter table public.notas_compra add column if not exists origen_anterior text;
alter table public.notas_compra add column if not exists nota_anterior integer;
alter table public.notas_compra add column if not exists estado_anterior text;
alter table public.notas_compra add column if not exists tipo_ajuste_anterior integer;
alter table public.notas_compra add column if not exists clasificacion_nota_anterior text;
alter table public.notas_compra add column if not exists moneda_anterior integer;
alter table public.notas_compra add column if not exists valor_mi numeric(18, 2);
alter table public.notas_compra add column if not exists bodega_nombre_anterior text;
alter table public.notas_compra add column if not exists bodega_destino_anterior integer;
alter table public.notas_compra add column if not exists compra_anterior integer;
alter table public.notas_compra add column if not exists serie_compra_anterior text;
alter table public.notas_compra add column if not exists numero_compra_anterior text;
alter table public.notas_compra add column if not exists fecha_compra_anterior date;
alter table public.notas_compra add column if not exists transaccion_anterior integer;
alter table public.notas_compra add column if not exists usuario_ingresa_anterior text;
alter table public.notas_compra add column if not exists fecha_ingresa_anterior timestamp;
alter table public.notas_compra add column if not exists usuario_modifica_anterior text;
alter table public.notas_compra add column if not exists fecha_modifica_anterior timestamp;
alter table public.notas_compra add column if not exists observaciones text;
alter table public.nota_compra_lineas add column if not exists origen_anterior text;
alter table public.nota_compra_lineas add column if not exists producto_anterior integer;
alter table public.nota_compra_lineas add column if not exists codigo_producto_anterior text;
alter table public.nota_compra_lineas add column if not exists precio_mi_anterior numeric(18, 4);
alter table public.nota_compra_lineas add column if not exists descuento_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists descuento_mi_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists valor_total_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists valor_total_mi_anterior numeric(18, 2);
create unique index if not exists notas_compra_nota_anterior on public.notas_compra (localidad_id, nota_anterior) where nota_anterior is not null;

do $notas$
declare
  v_org bigint; v_gtq bigint; v_usd bigint; r record; v_loc bigint; v_prov record; v_compra bigint; v_bod bigint; v_id bigint; v_num int; v_mon bigint;
  n_n int := 0; n_a int := 0; n_s int := 0; n_s_txt text := ''; n_otro int := 0; n_sin_compra int := 0; l_n int := 0; l_a int := 0; l_s int := 0; v_nuevo boolean;
begin
  select id into v_org from public.organizaciones where codigo::text = '3';
  if v_org is null then raise exception 'No existe la organización 3.'; end if;
  select id into v_gtq from public.monedas where iso = 'GTQ';
  select id into v_usd from public.monedas where iso = 'USD';
  -- Carga del sistema anterior: conserva número, estado y usuario (preparar_nota_compra respeta fin.nota).
  perform set_config('fin.nota', 'si', true);

  for r in select * from (values
      (2::integer, 234::integer, 'NOTA DE CRÉDITO'::text, '8C969A46'::text, '371934098'::text, null::text, '2025-08-04'::date, 1::integer, 1::numeric, 'ANULADA'::text, 5070::numeric, 5070::numeric, 9::integer, 'MAVISA'::text, 1910::integer, 'POLIFARMA, S. A.'::text, 1::integer, 'DEVOLUCIÓN'::text, 'DEVOLUCIÓN PIPERACILINA CORTO VENCIMIENTO CON CARTA DE COMPROMISO'::text, 164::integer, '7F0AD628'::text, '20072283'::text, '2025-06-06'::date, 0::integer, 'M'::text, 'AEV'::text, '2025-08-05 00:00:00'::timestamp, 'AEV'::text, '2025-08-05 00:00:00'::timestamp, 9::integer, null::text, null::timestamp, 'A'::text, null::text),
      (2, 235, 'NOTA DE CRÉDITO', '8C968A46', '371934098', null, '2025-08-04', 1, 1, 'OPERADA', 5070, 5070, 9, 'MAVISA', 1910, 'POLIFARMA, S. A.', 1, 'DEVOLUCIÓN', 'DEVOLUCIÓN PIPERACILINA VENCIMIENTO 01-26 CON CARTA DE COMPROMISO', 164, '7F0AD628', '20072283', '2025-06-06', 0, 'M', 'AEV', '2025-08-08 00:00:00', 'AEV', '2025-08-08 00:00:00', 9, null, null, 'O', null),
      (2, 236, 'NOTA DE CRÉDITO', '057FC407', '2990425500', null, '2025-07-29', 1, 1, 'VIGENTE', 120, 120, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', '5% DESCUENTO ADICIONAL EN 2,000 UNIDADES DE DICLOFENACO CORTOVENCIMIENTO 01-2026', 180, 'F12F32EC', '2824425357', '2025-08-04', 0, 'M', 'AEV', '2025-08-12 00:00:00', 'AEV', '2025-08-12 00:00:00', 3, null, null, 'I', null),
      (2, 237, 'NOTA DE CRÉDITO', '8A6A0B4A', '2162705033', null, '2025-07-30', 1, 1, 'ANULADA', 4, 4, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 180, 'F12F32EC', '2824425357', '2025-08-04', 0, 'M', 'AEV', '2025-08-12 00:00:00', 'AEV', '2025-08-12 00:00:00', 3, null, null, 'A', null),
      (2, 238, 'NOTA DE CRÉDITO', '40568FB4', '4205791688', null, '2025-08-11', 1, 1, 'VIGENTE', 15924.1, 15924.1, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: D2151873 - 65883283', 178, 'D2151873', '65883283', '2025-07-30', 0, 'M', 'AEV', '2025-08-12 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 239, 'NOTA DE CRÉDITO', '5F0054F9', '2697677074', null, '2025-08-11', 1, 1, 'VIGENTE', 56.25, 56.25, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: F12F32EC - 2824425357 por pronto pago', 180, 'F12F32EC', '2824425357', '2025-08-04', 0, 'M', 'AEV', '2025-08-12 00:00:00', 'AEV', '2025-08-12 00:00:00', 3, null, null, 'I', null),
      (2, 240, 'NOTA DE CRÉDITO', '8A6A0B4A', '2162705033', null, '2025-07-30', 1, 1, 'VIGENTE', 4, 4, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: F12F32EC - 2824425357', 180, 'F12F32EC', '2824425357', '2025-08-04', 0, 'M', 'AEV', '2025-08-12 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 241, 'NOTA DE CRÉDITO', '69F0FB90', '4150873592', null, '2025-08-11', 1, 1, 'VIGENTE', 32.3, 32.3, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 95F41FC2 - 1320765135 5% adicional por 190 amikacinas con caja en mal estado', 181, '95F41FC2', '1320765135', '2025-08-07', 0, 'M', 'AEV', '2025-08-19 00:00:00', 'AEV', '2025-08-19 00:00:00', 3, null, null, 'I', null),
      (2, 242, 'NOTA DE CRÉDITO', '14512DA8', '2047821252', null, '2025-08-11', 1, 1, 'OPERADA', 61, 61, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODCUTO QUEBRADO', 181, '95F41FC2', '1320765135', '2025-08-07', 0, 'M', 'AEV', '2025-08-19 00:00:00', 'AEV', '2025-08-19 00:00:00', 3, null, null, 'O', null),
      (2, 243, 'NOTA DE CRÉDITO', '5C22DDB0', '1375358830', null, '2025-08-18', 1, 1, 'VIGENTE', 2573, 2573, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 95F41FC2 - 1320765135', 181, '95F41FC2', '1320765135', '2025-08-07', 0, 'M', 'AEV', '2025-08-19 00:00:00', 'AEV', '2025-08-19 00:00:00', 3, null, null, 'I', null),
      (2, 244, 'NOTA DE CRÉDITO', '00196114', '478234204', null, '2025-08-18', 1, 1, 'VIGENTE', 1000, 1000, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 1A004E4A - 1880966960 5% adicional por hierro corto vencimiento.', 185, '1A004E4A', '1880966960', '2025-08-20', 0, 'M', 'AEV', '2025-08-25 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 245, 'NOTA DE CRÉDITO', '473D4DB2', '3410971601', null, '2025-08-14', 1, 1, 'OPERADA', 12, 12, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'Clindamicina quebrada', 185, '1A004E4A', '1880966960', '2025-08-20', 0, 'M', 'AEV', '2025-08-25 00:00:00', 'AEV', '2025-08-25 00:00:00', 3, null, null, 'O', null),
      (2, 246, 'NOTA DE CRÉDITO', '3EFE6BAD', '1786793961', null, '2025-08-22', 1, 1, 'VIGENTE', 112.5, 112.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 1A004E4A - 1880966960', 185, '1A004E4A', '1880966960', '2025-08-20', 0, 'M', 'AEV', '2025-08-25 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 247, 'NOTA DE CRÉDITO', '096374C0', '3593489383', null, '2025-08-22', 1, 1, 'VIGENTE', 561, 561, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: E325C505 - 2865580272', 184, 'E325C505', '2865580272', '2025-08-18', 0, 'M', 'AEV', '2025-08-25 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 248, 'NOTA DE CRÉDITO', 'B58623A3', '326059563', null, '2025-08-26', 1, 1, 'VIGENTE', 1900, 1900, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: FA4E45E4 - 732647174', 186, 'FA4E45E4', '732647174', '2025-08-22', 0, 'M', 'AEV', '2025-08-29 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 249, 'NOTA DE CRÉDITO', '347DEEAC', '3748742551', null, '2025-08-26', 1, 1, 'VIGENTE', 124.5, 124.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 9AEA6CA6 - 809517993', 187, '9AEA6CA6', '809517993', '2025-08-22', 0, 'M', 'AEV', '2025-08-29 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 250, 'NOTA DE CRÉDITO', '438FD033', '1491092567', null, '2025-07-25', 1, 1, 'VIGENTE', 57.2, 57.2, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: F692CB04 - 2769502596 2% 13 cajas de piperacilina dañadas', 169, 'F692CB04', '2769502596', '2025-06-27', 0, 'M', 'AEV', '2025-09-04 00:00:00', 'AEV', '2025-09-04 00:00:00', 3, null, null, 'I', null),
      (2, 251, 'NOTA DE CRÉDITO', '881A9070', '2535564958', null, '2025-06-27', 1, 1, 'VIGENTE', 85.8, 85.8, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: F692CB04 - 2769502596 3% 13 cajas de piperacilina dañadas', 169, 'F692CB04', '2769502596', '2025-06-27', 0, 'M', 'AEV', '2025-09-04 00:00:00', 'AEV', '2025-09-04 00:00:00', 3, null, null, 'I', null),
      (2, 252, 'NOTA DE CRÉDITO', '4F435BFE', '2329694142', null, '2025-08-26', 1, 1, 'OPERADA', 38, 38, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 190, '334471F0', '2820096101', '2025-09-02', 0, 'M', 'AEV', '2025-09-08 00:00:00', 'AEV', '2025-09-08 00:00:00', 3, null, null, 'O', null),
      (2, 253, 'NOTA DE CRÉDITO', '5F4B034B', '3526184213', null, '2025-08-26', 1, 1, 'VIGENTE', 43.7, 43.7, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 334471F0 - 2820096101 230 unidades de amikacina con cajas en mal estado. 5% adicional', 190, '334471F0', '2820096101', '2025-09-02', 0, 'M', 'AEV', '2025-09-08 00:00:00', 'AEV', '2025-09-08 00:00:00', 3, null, null, 'I', null),
      (2, 254, 'NOTA DE CRÉDITO', '4075CA55', '2868726291', null, '2025-09-05', 1, 1, 'VIGENTE', 415, 415, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 334471F0 - 2820096101', 190, '334471F0', '2820096101', '2025-09-02', 0, 'M', 'AEV', '2025-09-08 00:00:00', 'FRA', '2025-09-24 00:00:00', 3, null, null, 'I', null),
      (2, 255, 'NOTA DE CRÉDITO', 'D9E0B09A', '3529789157', null, '2025-09-11', 1, 1, 'OPERADA', 10.2, 10.2, 1, 'MAVISA', 2647, 'REUS PHARMA', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 182, '158019DB', '1710902094', '2025-08-13', 0, 'M', 'AEV', '2025-09-16 00:00:00', 'AEV', '2025-09-16 00:00:00', 2, null, null, 'O', null),
      (2, 256, 'NOTA DE CRÉDITO', '46EB960B', '1368211919', null, '2025-09-05', 1, 1, 'OPERADA', 41.5, 41.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 191, '08FC5A66', '239421120', '2025-09-05', 0, 'M', 'AEV', '2025-09-24 00:00:00', 'AEV', '2025-09-24 00:00:00', 3, null, null, 'O', null),
      (2, 257, 'NOTA DE CRÉDITO', 'CCACD919', '3391570641', null, '2025-09-19', 1, 1, 'VIGENTE', 835, 835, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 08FC5A66 - 239421120', 191, '08FC5A66', '239421120', '2025-09-05', 0, 'M', 'AEV', '2025-09-24 00:00:00', 'AEV', '2025-09-24 00:00:00', 3, null, null, 'I', null),
      (2, 258, 'NOTA DE CRÉDITO', '9F1328A5', '2613268258', null, '2025-09-26', 1, 1, 'ANULADA', 27956.25, 27956.25, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 8B585422 - 3797829814', 192, '8B585422', '3797829814', '2025-09-16', 0, 'M', 'AEV', '2025-09-30 00:00:00', 'AEV', '2025-09-30 00:00:00', 3, null, null, 'A', null),
      (2, 259, 'NOTA DE CRÉDITO', '9F1328A5', '2613268258', null, '2025-09-26', 1, 1, 'VIGENTE', 17956.25, 17956.25, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 8B585422 - 3797829814', 192, '8B585422', '3797829814', '2025-09-16', 0, 'M', 'AEV', '2025-09-30 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 260, 'NOTA DE CRÉDITO', '29F4B4AE', '2803846387', null, '2025-09-29', 1, 1, 'VIGENTE', 112.5, 112.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 1E7DC01F - 49563998', 195, '1E7DC01F', '49563998', '2025-09-23', 0, 'M', 'AEV', '2025-09-30 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 261, 'NOTA DE CRÉDITO', 'DD1F2152', '2608809641', null, '2025-09-29', 1, 1, 'VIGENTE', 75, 75, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 32C7BEBF - 1482835832', 193, '32C7BEBF', '1482835832', '2025-09-17', 0, 'M', 'AEV', '2025-09-30 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 262, 'NOTA DE CRÉDITO', '7040FD11', '4063118996', null, '2025-09-26', 1, 1, 'VIGENTE', 1626, 1626, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 7C8310AA - 2531673318', 194, '7C8310AA', '2531673318', '2025-09-22', 0, 'M', 'AEV', '2025-09-30 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 263, 'NOTA DE CRÉDITO', '019E831B', '1669809911', null, '2025-09-26', 1, 1, 'VIGENTE', 27, 27, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 054BD770 - 3559997627 90 unidades de metoclopramida con cajas en mal estado', 196, '054BD770', '3559997627', '2025-09-26', 0, 'M', 'AEV', '2025-10-07 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 264, 'NOTA DE CRÉDITO', '67CBDE2E', '3421392793', null, '2025-09-26', 1, 1, 'OPERADA', 9.1, 9.1, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 196, '054BD770', '3559997627', '2025-09-26', 0, 'M', 'AEV', '2025-10-07 00:00:00', 'AEV', '2025-10-07 00:00:00', 3, null, null, 'O', null),
      (2, 265, 'NOTA DE CRÉDITO', 'F1027256', '2709275780', null, '2025-09-29', 1, 1, 'OPERADA', 120, 120, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 196, '054BD770', '3559997627', '2025-09-26', 0, 'M', 'AEV', '2025-10-07 00:00:00', 'AEV', '2025-10-07 00:00:00', 3, null, null, 'O', null),
      (2, 266, 'NOTA DE CRÉDITO', 'CB0CAF73', '2431798516', null, '2025-10-03', 1, 1, 'VIGENTE', 279.5, 279.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 054BD770 - 3559997627', 196, '054BD770', '3559997627', '2025-09-26', 0, 'M', 'AEV', '2025-10-07 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 267, 'NOTA DE CRÉDITO', 'C797367A', '2725855770', null, '2025-10-03', 1, 1, 'VIGENTE', 337.5, 337.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: E059C82D - 1990606983', 197, 'E059C82D', '1990606983', '2025-10-01', 0, 'M', 'AEV', '2025-10-07 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 268, 'NOTA DE CRÉDITO', 'D44C459D', '304171253', null, '2025-10-03', 1, 1, 'ANULADA', 5.2, 5.2, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 198, '88E15D73', '2676181493', '2025-10-07', 0, 'M', 'AEV', '2025-10-23 00:00:00', 'AEV', '2025-11-03 00:00:00', 3, null, null, 'A', null),
      (2, 269, 'NOTA DE CRÉDITO', 'C839E5FA', '368235449', null, '2025-10-21', 1, 1, 'VIGENTE', 5568.1, 5568.1, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: D082DED5 - 2753052979', 199, 'D082DED5', '2753052979', '2025-10-09', 0, 'M', 'AEV', '2025-10-23 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 270, 'NOTA DE CRÉDITO', '7C3468C1', '2149141197', null, '2025-10-17', 1, 1, 'VIGENTE', 112.5, 112.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura:  7C9C106F - 3432400644', 200, '7C9C106F', '3432400644', '2025-10-10', 0, 'M', 'AEV', '2025-10-23 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 271, 'NOTA DE CRÉDITO', 'D44C459D', '304171253', null, '2025-10-03', 1, 1, 'VIGENTE', 5.2, 5.2, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 88E15D73 - 2676181493', 198, '88E15D73', '2676181493', '2025-10-07', 0, 'M', 'AEV', '2025-11-03 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 272, 'NOTA DE CRÉDITO', '41A02100', '2472495611', null, '2025-10-21', 1, 1, 'VIGENTE', 11959.27, 11959.27, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 88E15D73 - 2676181493', 198, '88E15D73', '2676181493', '2025-10-07', 0, 'M', 'AEV', '2025-11-03 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 273, 'NOTA DE CRÉDITO', '6BC9078C', '85674848', null, '2025-10-21', 1, 1, 'VIGENTE', 231.2, 231.2, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 9824E962 - 226119194 1,584 furosemida con cajas en mal estado y 1,900 Tramadol con cajas en mal estado (5% adicional descuento)', 201, '9824E962', '226119194', '2025-10-21', 0, 'M', 'AEV', '2025-11-03 00:00:00', 'AEV', '2025-11-03 00:00:00', 3, null, null, 'I', null),
      (2, 274, 'NOTA DE CRÉDITO', '40E8C540', '3015394586', null, '2025-10-17', 1, 1, 'ANULADA', 760, 760, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 201, '9824E962', '226119194', '2025-10-21', 0, 'M', 'AEV', '2025-11-03 00:00:00', 'AEV', '2025-11-03 00:00:00', 3, null, null, 'A', null),
      (2, 275, 'NOTA DE CRÉDITO', 'E509E01C', '2895773983', null, '2025-10-21', 1, 1, 'OPERADA', 105.2, 105.2, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 201, '9824E962', '226119194', '2025-10-21', 0, 'M', 'AEV', '2025-11-03 00:00:00', 'AEV', '2025-11-03 00:00:00', 3, null, null, 'O', null),
      (2, 276, 'NOTA DE CRÉDITO', 'ECF81C82', '2764260288', null, '2025-10-29', 1, 1, 'VIGENTE', 125, 125, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 9824E962 - 226119194', 201, '9824E962', '226119194', '2025-10-21', 0, 'M', 'AEV', '2025-11-03 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 277, 'NOTA DE CRÉDITO', '7EBA9F93', '4221912706', null, '2025-10-29', 1, 1, 'VIGENTE', 2472, 2472, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: CB3E2D3D - 2102673507', 202, 'CB3E2D3D', '2102673507', '2025-10-23', 0, 'M', 'AEV', '2025-11-03 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 278, 'NOTA DE CRÉDITO', '132FA05D', '3138167841', null, '2025-10-31', 1, 1, 'VIGENTE', 6811.1, 6811.1, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 6BD88285 - 3975432423', 203, '6BD88285', '3975432423', '2025-10-27', 0, 'M', 'AEV', '2025-11-03 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 279, 'NOTA DE CRÉDITO', '40E8C540', '3015394586', null, '2025-10-17', 1, 1, 'VIGENTE', 760, 760, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 9824E962 - 226119194 nota ingresada como descuento ya que por error de bodega se despacho el producto en mal estado.', 201, '9824E962', '226119194', '2025-10-21', 0, 'M', 'AEV', '2025-11-07 00:00:00', 'AEV', '2025-11-07 00:00:00', 3, null, null, 'I', null),
      (2, 280, 'NOTA DE CRÉDITO', '710F199A', '2593213223', null, '2025-11-07', 1, 1, 'VIGENTE', 1491.5, 1491.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 9856CBD7 - 1004683511', 205, '9856CBD7', '1004683511', '2025-10-29', 0, 'M', 'AEV', '2025-11-07 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 281, 'NOTA DE CRÉDITO', 'CE1E83B8', '2150908557', null, '2025-10-30', 1, 1, 'VIGENTE', 154.8, 154.8, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 514F5B63 - 3375252690 descuento 5% adicional por cajas en mal estado', 204, '514F5B63', '3375252690', '2025-10-29', 0, 'M', 'AEV', '2025-11-07 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 282, 'NOTA DE CRÉDITO', '5F803C58', '1370636694', null, '2025-10-29', 1, 1, 'OPERADA', 907.4, 907.4, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y/O DAÑADO', 204, '514F5B63', '3375252690', '2025-10-29', 0, 'M', 'AEV', '2025-11-07 00:00:00', 'AEV', '2025-11-07 00:00:00', 3, null, null, 'O', null),
      (2, 283, 'NOTA DE CRÉDITO', '7DD9D814', '1633305293', null, '2025-11-07', 1, 1, 'VIGENTE', 2159.8, 2159.8, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 514F5B63 - 3375252690 por pronto pago', 204, '514F5B63', '3375252690', '2025-10-29', 0, 'M', 'AEV', '2025-11-07 00:00:00', 'AEV', '2025-11-07 00:00:00', 3, null, null, 'I', null),
      (2, 284, 'NOTA DE CRÉDITO', '7D53A373', '3837084202', null, '2025-11-07', 1, 1, 'OPERADA', 6, 6, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 206, '771B3B66', '941969147', '2025-11-05', 0, 'M', 'AEV', '2025-11-24 00:00:00', 'JRA', '2025-11-25 00:00:00', 3, null, null, 'O', null),
      (2, 285, 'NOTA DE CRÉDITO', '872208D3', '1284654433', null, '2025-11-21', 1, 1, 'VIGENTE', 2007.75, 2007.75, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 771B3B66 - 941969147 por pronto pago', 206, '771B3B66', '941969147', '2025-11-05', 0, 'M', 'AEV', '2025-11-24 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 286, 'NOTA DE CRÉDITO', 'C4B30120', '3918283451', null, '2025-11-07', 1, 1, 'OPERADA', 3.6, 3.6, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 208, '6796F82B', '1362315684', '2025-11-11', 0, 'M', 'AEV', '2025-11-24 00:00:00', 'JRA', '2025-11-25 00:00:00', 3, null, null, 'O', null),
      (2, 287, 'NOTA DE CRÉDITO', '4C77CAC1', '2266187420', null, '2025-11-07', 1, 1, 'OPERADA', 7200, 7200, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO SOLICITADO POR VITALIS PARA CUMPLIMIENTO HOSPITALARIO', 208, '6796F82B', '1362315684', '2025-11-11', 0, 'M', 'AEV', '2025-11-24 00:00:00', 'JRA', '2025-11-25 00:00:00', 3, null, null, 'O', null),
      (2, 288, 'NOTA DE CRÉDITO', '397EA95D', '2333363372', null, '2025-11-21', 1, 1, 'VIGENTE', 624.75, 624.75, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 6796F82B - 1362315684 por pronto pago', 208, '6796F82B', '1362315684', '2025-11-11', 0, 'M', 'AEV', '2025-11-24 00:00:00', 'AEV', '2025-11-24 00:00:00', 3, null, null, 'I', null),
      (2, 289, 'NOTA DE CRÉDITO', 'FD9C0B48', '2556775657', null, '2025-11-27', 1, 1, 'VIGENTE', 414.25, 414.25, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: CCB0557F - 1318208095 por pronto pago', 209, 'CCB0557F', '1318208095', '2025-11-24', 0, 'M', 'AEV', '2025-12-11 00:00:00', 'AEV', '2025-12-11 00:00:00', 3, null, null, 'I', null),
      (2, 290, 'NOTA DE CRÉDITO', 'B7ECB9C5', '1565673251', null, '2025-12-02', 1, 1, 'VIGENTE', 6437, 6437, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 61AFE65B - 3162523489 por pronto pago', 210, '61AFE65B', '3162523489', '2025-11-25', 0, 'M', 'AEV', '2025-12-11 00:00:00', 'AEV', '2025-12-11 00:00:00', 3, null, null, 'I', null),
      (2, 291, 'NOTA DE CRÉDITO', '3691B770', '3193193785', null, '2025-12-11', 1, 1, 'VIGENTE', 415, 415, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 911887F4 - 841958026 por pronto pago', 212, '911887F4', '841958026', '2025-11-27', 0, 'M', 'AEV', '2025-12-11 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 292, 'NOTA DE CRÉDITO', 'AAE05A84', '2157660140', null, '2025-12-02', 1, 1, 'VIGENTE', null, null, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', '1 UNIDAD FALTANTE DE FUROSEMIDA', 211, '9B1F4F50', '128077487', '2025-11-28', 0, 'M', 'AEV', '2025-12-11 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 293, 'NOTA DE CRÉDITO', 'AAE05A84', '2157660140', null, '2025-12-01', 1, 1, 'VIGENTE', null, null, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', '1 UNIDAD QUEBRADA DE FUROSEMIDA', 211, '9B1F4F50', '128077487', '2025-11-28', 0, 'M', 'AEV', '2025-12-11 00:00:00', null, null, 2, null, null, 'I', null),
      (2, 294, 'NOTA DE CRÉDITO', 'AAE05A84', '2157660140', null, '2025-12-02', 1, 1, 'OPERADA', 1, 1, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', '1 UNIDAD FALTANTE FUROSEMIDA', 211, '9B1F4F50', '128077487', '2025-11-28', 0, 'M', 'AEV', '2025-12-11 00:00:00', 'AEV', '2025-12-11 00:00:00', 2, null, null, 'O', null),
      (2, 295, 'NOTA DE CRÉDITO', '99E7A463', '2536456345', null, '2025-12-02', 1, 1, 'OPERADA', 31.6, 31.6, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y/O DAÑADO', 211, '9B1F4F50', '128077487', '2025-11-28', 0, 'M', 'AEV', '2025-12-11 00:00:00', 'AEV', '2025-12-11 00:00:00', 3, null, null, 'O', null),
      (2, 296, 'NOTA DE CRÉDITO', '0401AD00', '1392003065', null, '2025-12-11', 1, 1, 'VIGENTE', 3546.25, 3546.25, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 9B1F4F50 - 128077487', 211, '9B1F4F50', '128077487', '2025-11-28', 0, 'M', 'AEV', '2025-12-11 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 297, 'NOTA DE CRÉDITO', '5154F1B2', '3134406867', null, '2025-12-11', 1, 1, 'VIGENTE', 8178.3, 8178.3, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 0A868DC5 - 321079020', 213, '0A868DC5', '321079020', '2025-12-05', 0, 'M', 'AEV', '2025-12-11 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 298, 'NOTA DE CRÉDITO', 'D8FAD98A', '2207991063', null, '2025-12-11', 1, 1, 'OPERADA', 280, 280, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y/O DAÑADO', 214, '672DE506', '2344765981', '2025-12-15', 0, 'M', 'AEV', '2025-12-18 00:00:00', 'AEV', '2025-12-18 00:00:00', 3, null, null, 'O', null),
      (2, 299, 'NOTA DE CRÉDITO', '06B80CD9', '1066618520', null, '2025-12-18', 1, 1, 'VIGENTE', 2600, 2600, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 672DE506 - 2344765981 por pronto pago', 214, '672DE506', '2344765981', '2025-12-15', 0, 'M', 'AEV', '2025-12-18 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 300, 'NOTA DE CRÉDITO', '6D8F3C89', '1350586046', null, '2026-01-15', 1, 1, 'VIGENTE', 25, 25, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 6C488171 - 3810410927 por pronto pago', 218, '6C488171', '3810410927', '2026-01-14', 0, 'M', 'AEV', '2026-01-20 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 301, 'NOTA DE CRÉDITO', '5825642D', '3768077297', null, '2026-01-15', 1, 1, 'VIGENTE', 10163.3, 10163.3, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 8CDFB6EC - 1618167682 por pronto pago', 215, '8CDFB6EC', '1618167682', '2026-01-07', 0, 'M', 'AEV', '2026-01-20 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 302, 'NOTA DE CRÉDITO', 'F1E721D2', '3032435677', null, '2026-01-15', 1, 1, 'VIGENTE', 5085.34, 5085.34, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 44A053D1 - 2523483625 por pronto pago', 216, '44A053D1', '2523483625', '2026-01-08', 0, 'M', 'AEV', '2026-01-20 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 303, 'NOTA DE CRÉDITO', '371EF92F', '2264747264', null, '2026-01-19', 1, 1, 'VIGENTE', 900, 900, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 082DE401 - 3901505848 por pronto pago', 221, '082DE401', '3901505848', '2026-01-15', 0, 'M', 'AEV', '2026-01-20 00:00:00', 'AEV', '2026-01-20 00:00:00', 3, null, null, 'I', null),
      (2, 304, 'NOTA DE CRÉDITO', '11858307', '4000073148', null, '2026-01-15', 1, 1, 'OPERADA', 250.8, 250.8, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y/O EN MAL ESTADO', 219, '93C006CC', '908805901', '2026-01-15', 0, 'M', 'AEV', '2026-01-21 00:00:00', 'AEV', '2026-01-21 00:00:00', 3, null, null, 'O', null),
      (2, 305, 'NOTA DE CRÉDITO', 'F69762BC', '2943305632', null, '2026-01-20', 1, 1, 'VIGENTE', 505.03, 505.03, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 93C006CC - 908805901 por pronto pago', 219, '93C006CC', '908805901', '2026-01-15', 0, 'M', 'AEV', '2026-01-21 00:00:00', 'AEV', '2026-01-21 00:00:00', 3, null, null, 'I', null),
      (2, 306, 'NOTA DE CRÉDITO', '732A893B', '3229565420', null, '2026-01-21', 1, 1, 'OPERADA', 1802, 1802, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y/O DAÑADO', 222, 'F930777E', '3914420017', '2026-01-21', 0, 'M', 'AEV', '2026-01-28 00:00:00', 'FRA', '2026-01-28 00:00:00', 3, null, null, 'O', null),
      (2, 307, 'NOTA DE CRÉDITO', '6D1E9553', '1531136668', null, '2026-01-28', 1, 1, 'VIGENTE', 84.38, 84.38, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: BB3B2B19 - 2028226936 por pronto pago', 223, 'BB3B2B19', '2028226936', '2026-01-19', 0, 'M', 'AEV', '2026-01-28 00:00:00', 'AEV', '2026-01-28 00:00:00', 3, null, null, 'I', null),
      (2, 308, 'NOTA DE CRÉDITO', '2272C62B', '671040276', null, '2026-01-27', 1, 1, 'VIGENTE', 292.34, 292.34, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: F930777E - 3914420017 por pronto pago', 222, 'F930777E', '3914420017', '2026-01-21', 0, 'M', 'AEV', '2026-01-28 00:00:00', 'AEV', '2026-01-28 00:00:00', 3, null, null, 'I', null),
      (2, 309, 'NOTA DE CRÉDITO', '8D619837', '3308604034', null, '2026-02-06', 1, 1, 'VIGENTE', 4575, 4575, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 2446AF3B - 3278654380 por pronto pago', 224, '2446AF3B', '3278654380', '2026-01-27', 0, 'M', 'AEV', '2026-02-09 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 310, 'NOTA DE CRÉDITO', '20B8650D', '1777616872', null, '2026-02-06', 1, 1, 'VIGENTE', 204, 204, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 513C1617 - 2976074001 por pronto pago', 227, '513C1617', '2976074001', '2026-01-27', 0, 'M', 'AEV', '2026-02-09 00:00:00', 'AEV', '2026-02-09 00:00:00', 3, null, null, 'I', null),
      (2, 311, 'NOTA DE CRÉDITO', '89E92530', '413683199', null, '2026-02-06', 1, 1, 'VIGENTE', 362.5, 362.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: E01547B2 - 2916632374 por pronto pago', 225, 'E01547B2', '2916632374', '2026-02-02', 0, 'M', 'AEV', '2026-02-09 00:00:00', 'AEV', '2026-02-09 00:00:00', 3, null, null, 'I', null),
      (2, 312, 'NOTA DE CRÉDITO', '60601F5C', '1665943338', null, '2026-02-06', 1, 1, 'OPERADA', 823.5, 823.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y/O MAL ESTADO', 228, 'ADC71DB8', '3748217874', '2026-02-09', 0, 'M', 'AEV', '2026-02-17 00:00:00', 'AEV', '2026-02-17 00:00:00', 3, null, null, 'O', null),
      (2, 313, 'NOTA DE CRÉDITO', '5F45FD5C', '413354823', null, '2026-02-16', 1, 1, 'VIGENTE', 3225, 3225, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: ADC71DB8 - 3748217874 por pronto pago', 228, 'ADC71DB8', '3748217874', '2026-02-09', 0, 'M', 'AEV', '2026-02-17 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 314, 'NOTA DE CRÉDITO', '3374E8CB', '2557297779', null, '2026-02-16', 1, 1, 'VIGENTE', 1695.75, 1695.75, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 55FF502A - 2236893318 por pronto pago', 229, '55FF502A', '2236893318', '2026-02-09', 0, 'M', 'AEV', '2026-02-17 00:00:00', 'AEV', '2026-02-17 00:00:00', 3, null, null, 'I', null),
      (2, 315, 'NOTA DE CRÉDITO', '3CDCF6DC', '2213497812', null, '2026-02-16', 1, 1, 'OPERADA', 1.2, 1.2, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 230, 'CB67DB77', '212553697', '2026-02-11', 0, 'M', 'AEV', '2026-02-17 00:00:00', 'AEV', '2026-02-17 00:00:00', 3, null, null, 'O', null),
      (2, 316, 'NOTA DE CRÉDITO', '9A7B5BE6', '4017964736', null, '2026-02-17', 1, 1, 'VIGENTE', 112.5, 112.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: CB67DB77 - 212553697 por pronto pago', 230, 'CB67DB77', '212553697', '2026-02-11', 0, 'M', 'AEV', '2026-02-17 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 317, 'NOTA DE CRÉDITO', '2234BD3B', '2618838154', null, '2026-02-20', 1, 1, 'VIGENTE', 2140, 2140, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 3848BADB - 3182316083 por pronto pago', 232, '3848BADB', '3182316083', '2026-02-11', 0, 'M', 'AEV', '2026-02-27 00:00:00', 'AEV', '2026-02-27 00:00:00', 3, null, null, 'I', null),
      (2, 318, 'NOTA DE CRÉDITO', 'FF023806', '875513539', null, '2026-02-23', 1, 1, 'OPERADA', 4, 4, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 233, 'A0AE936C', '2954971872', '2026-02-23', 0, 'M', 'AEV', '2026-03-03 00:00:00', 'AEV', '2026-03-03 00:00:00', 3, null, null, 'O', null),
      (2, 319, 'NOTA DE CRÉDITO', 'BD63C501', '3992338436', null, '2026-02-20', 1, 1, 'VIGENTE', 87.2, 87.2, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A0AE936C - 2954971872 . 200 Dipirona con cajas en mal estado y 140 Cefotaxima con cajas en mal estado. 5% adicional.', 233, 'A0AE936C', '2954971872', '2026-02-23', 0, 'M', 'AEV', '2026-03-03 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 320, 'NOTA DE CRÉDITO', 'ECA796A0', '2402568030', null, '2026-02-25', 1, 1, 'VIGENTE', 1428, 1428, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A0AE936C - 2954971872 por proto pago', 233, 'A0AE936C', '2954971872', '2026-02-23', 0, 'M', 'AEV', '2026-03-03 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 321, 'NOTA DE CRÉDITO', '4D72F70A', '3970844511', null, '2026-03-05', 1, 1, 'VIGENTE', 3750, 3750, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 0570B98A - 4077339150 por pronto pago', 234, '0570B98A', '4077339150', '2026-02-20', 0, 'M', 'AEV', '2026-03-10 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 322, 'NOTA DE CRÉDITO', 'C1B29C10', '1693665612', null, '2026-03-05', 1, 1, 'VIGENTE', 3750, 3750, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 5894A04F - 1764247097 por pronto pago', 235, '5894A04F', '1764247097', '2026-02-20', 0, 'M', 'AEV', '2026-03-10 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 323, 'NOTA DE CRÉDITO', 'F8CED1D2', '1234847475', null, '2026-03-05', 1, 1, 'VIGENTE', 243, 243, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A81E8763 - 2424065687 por pronto pago', 236, 'A81E8763', '2424065687', '2026-03-02', 0, 'M', 'AEV', '2026-03-10 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 324, 'NOTA DE CRÉDITO', '634F737F', '2261992647', null, '2026-03-05', 1, 1, 'VIGENTE', 684, 684, 11, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 839D8C1A - 2213367378 por pronto pago', 237, '839D8C1A', '2213367378', '2026-03-02', 0, 'M', 'AEV', '2026-03-10 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 325, 'NOTA DE CRÉDITO', 'E9732880', '3088139576', null, '2026-03-10', 1, 1, 'VIGENTE', 270, 270, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: BC9316F4 - 233915850 por pronto pago', 239, 'BC9316F4', '233915850', '2026-03-03', 0, 'M', 'AEV', '2026-03-10 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 326, 'NOTA DE CRÉDITO', '564C0B63', '620185008', null, '2026-03-10', 1, 1, 'OPERADA', 7.2, 7.2, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', '3 TRAMADOL QUEBRADOS', 243, '26DA33A6', '1547453791', '2026-03-09', 0, 'M', 'AEV', '2026-03-16 00:00:00', 'FRA', '2026-03-18 00:00:00', 3, null, null, 'O', null),
      (2, 327, 'NOTA DE CRÉDITO', '42705260', '133974628', null, '2026-03-05', 1, 1, 'OPERADA', 48, 48, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO EN MAL ESTADO', 243, '26DA33A6', '1547453791', '2026-03-09', 0, 'M', 'AEV', '2026-03-26 00:00:00', 'AEV', '2026-03-26 00:00:00', 3, null, null, 'O', null),
      (2, 328, 'NOTA DE CRÉDITO', '9444BAF4', '3733603308', null, '2026-03-05', 1, 1, 'OPERADA', 5, 5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 243, '26DA33A6', '1547453791', '2026-03-09', 0, 'M', 'AEV', '2026-03-26 00:00:00', 'AEV', '2026-03-26 00:00:00', 3, null, null, 'O', null),
      (2, 329, 'NOTA DE CRÉDITO', 'F5AC9AFE', '492783662', null, '2026-03-05', 1, 1, 'OPERADA', 5, 5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO FALTANTE', 243, '26DA33A6', '1547453791', '2026-03-09', 0, 'M', 'AEV', '2026-03-26 00:00:00', 'AEV', '2026-03-26 00:00:00', 3, null, null, 'O', null),
      (2, 330, 'NOTA DE CRÉDITO', '59F051AC', '905266139', null, '2026-03-13', 1, 1, 'VIGENTE', 3427, 3427, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 26DA33A6 - 1547453791 por pronto pago', 243, '26DA33A6', '1547453791', '2026-03-09', 0, 'M', 'AEV', '2026-03-26 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 331, 'NOTA DE CRÉDITO', '5DD51C8B', '243420319', null, '2026-03-13', 1, 1, 'VIGENTE', 444.2, 444.2, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A77C7D28 - 1239632297 por pronto pago', 245, 'A77C7D28', '1239632297', '2026-03-10', 0, 'M', 'AEV', '2026-03-26 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 332, 'NOTA DE CRÉDITO', '0F0226ED', '657410744', null, '2026-03-16', 1, 1, 'OPERADA', 240, 240, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y/O EN MAL ESTADO', 246, 'D1A53BED', '3397927694', '2026-03-10', 0, 'M', 'AEV', '2026-03-26 00:00:00', 'AEV', '2026-03-26 00:00:00', 3, null, null, 'O', null),
      (2, 333, 'NOTA DE CRÉDITO', 'A291196D', '2030977095', null, '2026-03-18', 1, 1, 'VIGENTE', 4192, 4192, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: D1A53BED - 3397927694 por pronto pago', 246, 'D1A53BED', '3397927694', '2026-03-10', 0, 'M', 'AEV', '2026-03-26 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 334, 'NOTA DE CRÉDITO', '547AD1CB', '2779596200', null, '2026-03-18', 1, 1, 'OPERADA', 1.3, 1.3, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 248, 'CA4A2334', '2757772212', '2026-03-24', 0, 'M', 'AEV', '2026-03-26 00:00:00', 'AEV', '2026-03-26 00:00:00', 3, null, null, 'O', null),
      (2, 335, 'NOTA DE CRÉDITO', 'DA476C2C', '2292269197', null, '2026-03-18', 1, 1, 'OPERADA', 1800, 1800, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO SOLICITADO POR EL PROVEEDOR POR DESABASTECIMIENTO', 248, 'CA4A2334', '2757772212', '2026-03-24', 0, 'M', 'AEV', '2026-03-26 00:00:00', 'AEV', '2026-03-26 00:00:00', 3, null, null, 'O', null),
      (2, 336, 'NOTA DE CRÉDITO', '7E291559', '80102399', null, '2026-03-26', 1, 1, 'VIGENTE', 1062.5, 1062.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: CA4A2334 - 2757772212 por pronto pago', 248, 'CA4A2334', '2757772212', '2026-03-24', 0, 'M', 'AEV', '2026-03-26 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 337, 'NOTA DE CRÉDITO', '9759BB2E', '2419606196', null, '2026-04-14', 1, 1, 'VIGENTE', 371.25, 371.25, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: E9FDA8EA - 1391937268 por pronto pago', 252, 'E9FDA8EA', '1391937268', '2026-04-10', 0, 'M', 'AEV', '2026-04-14 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 338, 'NOTA DE CRÉDITO', '7DAB3284', '368723488', null, '2026-04-14', 1, 1, 'VIGENTE', 3235, 3235, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B91C40C9 - 2598522295 por pronto pago', 254, 'B91C40C9', '2598522295', '2026-04-09', 0, 'M', 'AEV', '2026-04-14 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 339, 'NOTA DE CRÉDITO', '1E7DB023', '1655851917', null, '2026-04-13', 1, 1, 'VIGENTE', 12090, 12090, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A689D9EA - 169822047 por pronto pago', 253, 'A689D9EA', '169822047', '2026-04-08', 0, 'M', 'AEV', '2026-04-14 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 340, 'NOTA DE CRÉDITO', '139D22B4', '2941930472', null, '2026-04-15', 1, 1, 'OPERADA', 1.3, 1.3, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 251, '63861D65', '474894089', '2026-04-10', 0, 'M', 'AEV', '2026-04-16 00:00:00', 'AEV', '2026-04-16 00:00:00', 3, null, null, 'O', null),
      (2, 341, 'NOTA DE CRÉDITO', '94546514', '7883176', null, '2026-04-15', 1, 1, 'OPERADA', 812, 812, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y/O MAL ESTADO', 251, '63861D65', '474894089', '2026-04-10', 0, 'M', 'AEV', '2026-04-16 00:00:00', 'AEV', '2026-04-16 00:00:00', 3, null, null, 'O', null),
      (2, 342, 'NOTA DE CRÉDITO', '91CA2E30', '1294158434', null, '2026-04-15', 1, 1, 'OPERADA', 240, 240, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO FALTANTE', 251, '63861D65', '474894089', '2026-04-10', 0, 'M', 'AEV', '2026-04-16 00:00:00', 'AEV', '2026-04-16 00:00:00', 3, null, null, 'O', null),
      (2, 343, 'NOTA DE CRÉDITO', '649F07ED', '4189080380', null, '2026-04-16', 1, 1, 'VIGENTE', 561, 561, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 63861D65 - 474894089 por pronto pago', 251, '63861D65', '474894089', '2026-04-10', 0, 'M', 'AEV', '2026-04-16 00:00:00', 'AEV', '2026-04-16 00:00:00', 3, null, null, 'I', null),
      (2, 344, 'NOTA DE CRÉDITO', '82A31CC6', '3335866648', null, '2026-04-16', 1, 1, 'OPERADA', 170, 170, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO DAÑADO Y/O QUEBRADO', 256, '3BC18456C', '1903841033', '2026-05-06', 0, 'M', 'AEV', '2026-05-12 00:00:00', 'AEV', '2026-05-12 00:00:00', 3, null, null, 'O', null),
      (2, 345, 'NOTA DE CRÉDITO', 'F3DBA0B1', '1166820795', null, '2026-05-11', 1, 1, 'VIGENTE', 1518, 1518, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 3BC18456C - 1903841033 por pronto pago', 256, '3BC18456C', '1903841033', '2026-05-06', 0, 'M', 'AEV', '2026-05-12 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 346, 'NOTA DE CRÉDITO', 'C240D33B', '4104669117', null, '2026-05-13', 1, 1, 'VIGENTE', 4019, 4019, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 96B14665 - 837370830 por pronto pago', 257, '96B14665', '837370830', '2026-05-07', 0, 'M', 'AEV', '2026-05-20 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 347, 'NOTA DE CRÉDITO', 'F8D629F', '164121343', null, '2026-05-22', 1, 1, 'VIGENTE', 3435, 3435, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: C49D4FAC - 1882474401 por pronto pago', 259, 'C49D4FAC', '1882474401', '2026-05-15', 0, 'M', 'AEV', '2026-05-22 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 348, 'NOTA DE CRÉDITO', 'D1030B00', '1401373152', null, '2026-05-18', 1, 1, 'VIGENTE', 1033.75, 1033.75, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: D1030B00 - 1401373152 por pronto pago', 260, 'D1030B00', '1401373152', '2026-05-18', 0, 'M', 'AEV', '2026-05-22 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 349, 'NOTA DE CRÉDITO', '26788AB1', '1897613969', null, '2026-05-22', 1, 1, 'OPERADA', 12, 12, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 261, '434C8D5D', '2866956646', '2026-05-28', 0, 'M', 'AEV', '2026-06-03 00:00:00', 'AEV', '2026-06-03 00:00:00', 3, null, null, 'O', null),
      (2, 350, 'NOTA DE CRÉDITO', 'CCFDFDC7', '3777709144', null, '2026-05-22', 1, 1, 'VIGENTE', 22, 22, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento adicional 5% 2 cajas de dipirona x 100 dañadas', 261, '434C8D5D', '2866956646', '2026-05-28', 0, 'M', 'AEV', '2026-06-03 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 351, 'NOTA DE CRÉDITO', '60451733', '1679641399', null, '2026-06-02', 1, 1, 'VIGENTE', 1950, 1950, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 434C8D5D - 2866956646 por pronto pago', 261, '434C8D5D', '2866956646', '2026-05-28', 0, 'M', 'AEV', '2026-06-03 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 352, 'NOTA DE CRÉDITO', 'BCE0EC97', '3392883848', null, '2026-06-24', 1, 1, 'VIGENTE', 6239.25, 6239.25, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 487B77A1 - 1899513524 por pronto pago', 262, '487B77A1', '1899513524', '2026-06-16', 0, 'M', 'AEV', '2026-07-06 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 353, 'NOTA DE CRÉDITO', '53A6FB01', '3008906046', null, '2026-06-26', 1, 1, 'VIGENTE', 680, 680, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 7E87FA03 - 3043704999 por pronto pago', 265, '7E87FA03', '3043704999', '2026-06-23', 0, 'M', 'AEV', '2026-07-06 00:00:00', 'AEV', '2026-07-06 00:00:00', 3, null, null, 'I', null),
      (2, 354, 'NOTA DE CRÉDITO', 'D91B9B5', '4228597206', null, '2026-07-01', 1, 1, 'VIGENTE', 8782.5, 8782.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 5715EE75 - 295321923 por pronto pago', 264, '5715EE75', '295321923', '2026-06-24', 0, 'M', 'AEV', '2026-07-06 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 355, 'NOTA DE CRÉDITO', '4F1475F1', '291520955', null, '2026-07-01', 1, 1, 'VIGENTE', 1800, 1800, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 13C2716C - 175329225 por pronto pago', 266, '13C2716C', '175329225', '2026-06-24', 0, 'M', 'AEV', '2026-07-06 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 356, 'NOTA DE CRÉDITO', 'D7E2EC26', '3960161228', null, '2026-07-02', 1, 1, 'VIGENTE', 495, 495, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: CBC25158 - 230181696 por pronto pago', 267, 'CBC25158', '230181696', '2026-06-24', 0, 'M', 'AEV', '2026-07-06 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 357, 'NOTA DE CRÉDITO', 'B13B471B', '3654567322', null, '2026-07-01', 1, 1, 'OPERADA', 4.8, 4.8, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 268, '8D5D1822', '3472770605', '2026-07-02', 0, 'M', 'AEV', '2026-07-14 00:00:00', 'AEV', '2026-07-14 00:00:00', 3, null, null, 'O', null),
      (2, 358, 'NOTA DE CRÉDITO', '1E2236F4', '1876904492', null, '2026-07-01', 1, 1, 'OPERADA', 7.2, 7.2, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 268, '8D5D1822', '3472770605', '2026-07-02', 0, 'M', 'AEV', '2026-07-14 00:00:00', 'AEV', '2026-07-14 00:00:00', 3, null, null, 'O', null),
      (2, 359, 'NOTA DE CRÉDITO', '8B5C804A', '2034846764', null, '2026-07-10', 1, 1, 'VIGENTE', 22.5, 22.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 8D5D1822 - 3472770605 por pronto pago', 268, '8D5D1822', '3472770605', '2026-07-02', 0, 'M', 'AEV', '2026-07-14 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 360, 'NOTA DE CRÉDITO', '62A70D60', '1892172674', null, '2026-07-10', 1, 1, 'VIGENTE', 848.5, 848.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B7D71C1F - 32458631 por pronto pago', 269, 'B7D71C1F', '32458631', '2026-07-02', 0, 'M', 'AEV', '2026-07-14 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 361, 'NOTA DE CRÉDITO', 'D1881964', '4090249245', null, '2026-07-10', 1, 1, 'VIGENTE', 1625, 1625, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 68480271 - 4206314111 por pronto pago', 270, '68480271', '4206314111', '2026-07-02', 0, 'M', 'AEV', '2026-07-14 00:00:00', 'AEV', '2026-07-14 00:00:00', 3, null, null, 'I', null),
      (2, 362, 'NOTA DE CRÉDITO', '95E225A8', '2130461442', null, '2026-07-10', 1, 1, 'VIGENTE', 1875, 1875, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 30D48C32 - 1588022611 por pronto pago', 271, '30D48C32', '1588022611', '2026-07-02', 0, 'M', 'AEV', '2026-07-14 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 363, 'NOTA DE CRÉDITO', '51C6497A', '943014110', null, '2026-07-10', 1, 1, 'VIGENTE', 67.5, 67.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 4BF872C4 - 2889894287 por pronto pago', 272, '4BF872C4', '2889894287', '2026-07-06', 0, 'M', 'AEV', '2026-07-14 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 364, 'NOTA DE CRÉDITO', 'ECB2BF79', '2269597530', null, '2026-07-15', 1, 1, 'OPERADA', 150, 150, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO EN MAL ESTADO', 273, '04A638E4', '2626110762', '2026-07-22', 0, 'M', 'AEV', '2026-07-28 00:00:00', 'AEV', '2026-07-28 00:00:00', 3, null, null, 'O', null),
      (2, 365, 'NOTA DE CRÉDITO', '29564D0D', '3394978419', null, '2026-07-15', 1, 1, 'OPERADA', 180, 180, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO EN MAL ESTADO', 273, '04A638E4', '2626110762', '2026-07-22', 0, 'M', 'AEV', '2026-07-28 00:00:00', 'AEV', '2026-07-28 00:00:00', 3, null, null, 'O', null),
      (2, 366, 'NOTA DE CRÉDITO', '69BC258B', '277112208', null, '2026-07-24', 1, 1, 'VIGENTE', 1343.75, 1343.75, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 04A638E4 - 2626110762 por pronto pago', 273, '04A638E4', '2626110762', '2026-07-22', 0, 'M', 'AEV', '2026-07-28 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 367, 'NOTA DE CRÉDITO', 'D9AEF8F8', '4292756897', null, '2026-07-29', 1, 1, 'VIGENTE', 5879.5, 5879.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 09899515 - 2136754703 por pronto pago', 274, '09899515', '2136754703', '2026-07-23', 0, 'M', 'AEV', '2026-08-03 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 368, 'NOTA DE CRÉDITO', '992097A6', '2165391364', null, '2026-07-29', 1, 1, 'OPERADA', 4.9, 4.9, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 275, '8E47F6E2', '2560312563', '2026-07-27', 0, 'M', 'AEV', '2026-08-07 00:00:00', 'AEV', '2026-08-07 00:00:00', 3, null, null, 'O', null),
      (2, 369, 'NOTA DE CRÉDITO', '4557850A', '3818931031', null, '2026-08-07', 1, 1, 'VIGENTE', 735, 735, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 8E47F6E2 - 2560312563 por pronto pago', 275, '8E47F6E2', '2560312563', '2026-07-27', 0, 'M', 'AEV', '2026-08-07 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 370, 'NOTA DE CRÉDITO', '7E006619', '2606975330', null, '2026-08-10', 1, 1, 'VIGENTE', 150, 150, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 1C5E9B67 - 1744389241 por pronto pago', 276, '1C5E9B67', '1744389241', '2026-08-03', 0, 'M', 'AEV', '2026-08-13 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 371, 'NOTA DE CRÉDITO', 'D8B24817', '529682429', null, '2026-08-11', 1, 1, 'VIGENTE', 90, 90, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B196BEE2 - 2923775765 por pronto pago', 278, 'B196BEE2', '2923775765', '2026-08-11', 0, 'M', 'AEV', '2026-08-13 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 372, 'NOTA DE CRÉDITO', '7504C475', '4151135946', null, '2026-08-11', 1, 1, 'VIGENTE', 3221.15, 3221.15, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 1E8A3E5C - 2718582702 por pronto pago', 277, '1E8A3E5C', '2718582702', '2026-08-08', 0, 'M', 'AEV', '2026-08-13 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 373, 'NOTA DE CRÉDITO', '46716B10', '112676522', null, '2026-08-11', 1, 1, 'OPERADA', 1.5, 1.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 280, '86C34B34', '2904051002', '2026-08-13', 0, 'M', 'AEV', '2026-08-20 00:00:00', 'AEV', '2026-08-20 00:00:00', 3, null, null, 'O', null),
      (2, 374, 'NOTA DE CRÉDITO', '10B563CB', '1497909390', null, '2026-08-20', 1, 1, 'VIGENTE', 682.1, 682.1, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 86C34B34 - 2904051002 por pronto pago', 280, '86C34B34', '2904051002', '2026-08-13', 0, 'M', 'AEV', '2026-08-20 00:00:00', 'AEV', '2026-08-20 00:00:00', 3, null, null, 'I', null),
      (2, 375, 'NOTA DE CRÉDITO', '2BCBFFC3', '4021109764', null, '2026-08-20', 1, 1, 'OPERADA', 3.2, 3.2, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y EN MAL ESTADO', 283, '845B320D', '2819965201', '2026-08-26', 0, 'M', 'AEV', '2026-09-08 00:00:00', 'AEV', '2026-09-08 00:00:00', 3, null, null, 'O', null),
      (2, 376, 'NOTA DE CRÉDITO', 'B769B23B', '1065045938', null, '2026-09-04', 1, 1, 'VIGENTE', 3820, 3820, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 845B320D - 2819965201 por pronto pago', 283, '845B320D', '2819965201', '2026-08-26', 0, 'M', 'AEV', '2026-09-08 00:00:00', 'AEV', '2026-09-08 00:00:00', 3, null, null, 'I', null),
      (2, 377, 'NOTA DE CRÉDITO', '3D114241', '524502383', null, '2026-09-07', 1, 1, 'OPERADA', 46, 46, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO Y/O MAL ESTADO', 285, '5BDB5D2E', '1107378572', '2026-09-07', 0, 'M', 'AEV', '2026-09-10 00:00:00', 'AEV', '2026-09-10 00:00:00', 3, null, null, 'O', null),
      (2, 378, 'NOTA DE CRÉDITO', '8A8BD4D5', '995248146', null, '2026-09-09', 1, 1, 'VIGENTE', 750, 750, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 5BDB5D2E - 1107378572 por pronto pago', 285, '5BDB5D2E', '1107378572', '2026-09-07', 0, 'M', 'AEV', '2026-09-10 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 379, 'NOTA DE CRÉDITO', '433C8D9E', '1104299946', null, '2026-09-10', 1, 1, 'VIGENTE', 300, 300, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 470AFB24 - 3440658572 por pronto pago', 286, '470AFB24', '3440658572', '2026-09-08', 0, 'M', 'AEV', '2026-09-11 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 380, 'NOTA DE CRÉDITO', 'E3CFE41C', '3007401427', null, '2026-09-16', 1, 1, 'VIGENTE', 4908.7, 4908.7, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 19842191 - 1981434123 por pronto pago', 287, '19842191', '1981434123', '2026-09-09', 0, 'M', 'AEV', '2026-09-24 00:00:00', 'AEV', '2026-09-24 00:00:00', 3, null, null, 'I', null),
      (2, 381, 'NOTA DE CRÉDITO', '8F94E6B9', '2911715974', null, '2026-09-09', 1, 1, 'VIGENTE', 62770.6, 62770.6, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 19842191 - 1981434123 por ajuste de precio', 287, '19842191', '1981434123', '2026-09-09', 0, 'M', 'AEV', '2026-09-24 00:00:00', 'AEV', '2026-09-24 00:00:00', 3, null, null, 'I', null),
      (2, 382, 'NOTA DE CRÉDITO', '37AF59ED', '2533117741', null, '2026-09-16', 1, 1, 'VIGENTE', 760, 760, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 23C8E9EA - 2415806097 por pronto pago', 290, '23C8E9EA', '2415806097', '2026-09-16', 0, 'M', 'AEV', '2026-09-24 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 383, 'NOTA DE CRÉDITO', '63B95677', '3712057722', null, '2026-09-16', 1, 1, 'VIGENTE', 150, 150, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: A276878D - 796082391 por pronto pago', 289, 'A276878D', '796082391', '2026-09-10', 0, 'M', 'AEV', '2026-09-24 00:00:00', null, null, 3, null, null, 'I', null)) as x(loc, nota, tipo, serie, documento, autorizacion, fecha, moneda, cambio, estado, total, total_mi, bodega, bodega_nombre, proveedor, proveedor_nombre,
       tipo_ajuste_ant, tipo_ajuste, motivo, compra, serie_doc, numero_doc, fecha_doc, transaccion, clasif, usr_ing, f_ing, usr_mod, f_mod, bodega_destino, usr_anula, f_anula,
       estado_ant, obs) order by loc, nota loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    select p.id, p.nit, p.nombre_comercial into v_prov from public.proveedores p where p.localidad_id = v_loc and p.codigo = r.proveedor;
    if v_prov.id is null then n_s := n_s + 1; n_s_txt := n_s_txt || format(' 3-0%s nota %s (proveedor %s);', r.loc, r.nota, r.proveedor); continue; end if;
    v_bod := (select b.id from public.bodegas b where b.localidad_id = v_loc and b.codigo = r.bodega);
    v_compra := coalesce((select c.id from public.compras c where c.localidad_id = v_loc and c.origen_anterior = 'MEDICAMENTOS' and c.compra_anterior = r.compra limit 1),
                         (select c.id from public.compras c where c.localidad_id = v_loc and ((c.origen_anterior = 'VARIAS' and c.compra_anterior = r.compra) or c.compra_varia_anterior = r.compra) limit 1));
    if v_compra is not null and not exists (select 1 from public.compras c where c.id = v_compra and c.proveedor_id = v_prov.id) then v_compra := null; end if;
    if v_compra is null then n_sin_compra := n_sin_compra + 1; end if;
    v_mon := case when r.moneda = 2 then coalesce(v_usd, v_gtq) else v_gtq end;
    select id into v_id from public.notas_compra where localidad_id = v_loc and nota_anterior = r.nota;
    if v_id is null then
      v_num := case when exists (select 1 from public.notas_compra where localidad_id = v_loc and numero = r.nota)
                    then (select coalesce(max(numero), 0) + 1 from public.notas_compra where localidad_id = v_loc) else r.nota end;
      if v_num <> r.nota then n_otro := n_otro + 1; end if;
      insert into public.notas_compra (organizacion_id, localidad_id, numero, tipo, documento, fecha, moneda_id, proveedor_id, nota_anterior, origen_anterior)
      values (v_org, v_loc, v_num, r.tipo, coalesce(r.documento, r.nota::text), r.fecha, v_mon, v_prov.id, r.nota, 'MIGRADO')
      returning id into v_id;
      n_n := n_n + 1;
    else
      n_a := n_a + 1;
    end if;
    update public.notas_compra set
      tipo = r.tipo, numero_autorizacion = r.autorizacion, serie = r.serie, documento = coalesce(r.documento, r.nota::text), fecha = r.fecha,
      moneda_id = v_mon, tipo_cambio = coalesce(nullif(r.cambio, 0), 1), valor = greatest(case when r.moneda = 2 then coalesce(r.total_mi, r.total) else r.total end, 0),
      proveedor_id = v_prov.id, proveedor_codigo = r.proveedor::text, proveedor_nombre = coalesce(r.proveedor_nombre, v_prov.nombre_comercial), nit = v_prov.nit,
      bodega_id = v_bod, compra_id = v_compra, motivo = r.motivo, tipo_ajuste = r.tipo_ajuste,
      tipo_nota = case when r.clasif = 'M' then 'MANUAL' else 'AUTOMÁTICA' end, estado = r.estado,
      usuario = coalesce(upper(r.usr_ing), 'SISTEMA ANTERIOR'),
      operado_por = case when r.estado = 'OPERADA' then upper(coalesce(r.usr_mod, r.usr_ing)) end,
      operado_en = case when r.estado = 'OPERADA' then coalesce(r.f_mod, r.f_ing)::timestamptz end,
      anulado_por = case when r.estado = 'ANULADA' then upper(coalesce(r.usr_anula, r.usr_mod)) end,
      anulado_en = case when r.estado = 'ANULADA' then coalesce(r.f_anula, r.f_mod)::timestamptz end,
      motivo_anulacion = case when r.estado = 'ANULADA' then 'ANULADA EN EL SISTEMA ANTERIOR' end,
      creado_por_nombre = coalesce(upper(r.usr_ing), 'MIGRACIÓN'), creado_en = r.f_ing::timestamptz,
      modificado_por_nombre = upper(r.usr_mod), modificado_en = r.f_mod::timestamptz,
      origen_anterior = 'MIGRADO', nota_anterior = r.nota, estado_anterior = r.estado_ant, tipo_ajuste_anterior = r.tipo_ajuste_ant, clasificacion_nota_anterior = r.clasif,
      moneda_anterior = r.moneda, valor_mi = r.total_mi, bodega_nombre_anterior = r.bodega_nombre, bodega_destino_anterior = r.bodega_destino, compra_anterior = r.compra,
      serie_compra_anterior = r.serie_doc, numero_compra_anterior = r.numero_doc, fecha_compra_anterior = r.fecha_doc, transaccion_anterior = r.transaccion,
      usuario_ingresa_anterior = r.usr_ing, fecha_ingresa_anterior = r.f_ing, usuario_modifica_anterior = r.usr_mod, fecha_modifica_anterior = r.f_mod, observaciones = r.obs
    where id = v_id;
  end loop;

  -- Líneas de las notas.
  for r in select * from (values
      (2::integer, 234::integer, 1::integer, 176::integer, 'LOT 0005'::text, 'PIPERACILINA + TAZOBACTAM  4 G / 0.5 G POLVO PARA USO PARENTERAL - CAJA X 1'::text, 'PT45I2402'::text, '2026-01-31'::date, '2024-02-01'::date, 300::numeric, 16.9::numeric, 16.9::numeric, 0::numeric, 0::numeric, 5070::numeric, 5070::numeric, false::boolean, null::integer, null::text),
      (2, 235, 1, 176, 'LOT 0005', 'PIPERACILINA + TAZOBACTAM  4 G / 0.5 G POLVO PARA USO PARENTERAL - CAJA X 1', 'PT45I2402', '2026-01-31', '2024-02-01', 300, 16.9, 16.9, 0, 0, 5070, 5070, true, null, null),
      (2, 236, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 120, 120, 0, 0, 120, 120, false, null, null),
      (2, 237, 1, 158, 'VIT 0044', 'DIPIRONA 1G/2ML (METAMIZOL) - CAJA X 100', 'A250105', '2027-05-06', '2025-05-06', 2, 2, 2, 0, 0, 4, 4, false, null, null),
      (2, 238, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 15924.1, 15924.1, 0, 0, 15924.1, 15924.1, false, null, null),
      (2, 239, 1, null, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 56.25, 56.25, 0, 0, 56.25, 56.25, false, null, null),
      (2, 240, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4, 4, 0, 0, 4, 4, false, null, null),
      (2, 241, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 32.3, 32.3, 0, 0, 32.3, 32.3, false, null, null),
      (2, 242, 1, 164, 'VIT 0050', 'AMIKACINA VITALIS 500 MG/2ML SOLUCIÓN INYECTABLE CAJA X 100 - CAJA X 100', 'A250116', '2028-05-08', '2025-05-08', 10, 3.4, 3.4, 0, 0, 34, 34, true, null, null),
      (2, 242, 2, 40, 'VIT 0037', 'VANCOMICINA Vitalis 500 mg Polvo Liofilizado para Uso Parenteral - VIAL - 1 UNIDAD (ES)', 'M240239', '2027-12-20', '2024-12-20', 3, 9, 9, 0, 0, 27, 27, true, null, null),
      (2, 243, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2573, 2573, 0, 0, 2573, 2573, false, null, null),
      (2, 244, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1000, 1000, 0, 0, 1000, 1000, false, null, null),
      (2, 245, 1, 163, 'VIT 0049', 'CLINDAMICINA 600 MG/4ML- C100 LGU - AMPOLLA', 'A250195', '2026-12-04', '2025-06-04', 3, 4, 4, 0, 0, 12, 12, true, null, null),
      (2, 246, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 112.5, 112.5, 0, 0, 112.5, 112.5, false, null, null),
      (2, 247, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 561, 561, 0, 0, 561, 561, false, null, null),
      (2, 248, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1900, 1900, 0, 0, 1900, 1900, false, null, null),
      (2, 249, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 124.5, 124.5, 0, 0, 124.5, 124.5, false, null, null),
      (2, 250, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 57.2, 57.2, 0, 0, 57.2, 57.2, false, null, null),
      (2, 251, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 85.8, 85.8, 0, 0, 85.8, 85.8, false, null, null),
      (2, 252, 1, 7, 'VIT 0004', 'Amikacina 500 Mg/2ml Solución Inyectable - Caja X 10 - Ampollas - AMPOLLAS', 'A250117', '2028-05-10', '2025-05-10', 10, 3.8, 3.8, 0, 0, 38, 38, true, null, null),
      (2, 253, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 43.7, 43.7, 0, 0, 43.7, 43.7, false, null, null),
      (2, 254, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 415, 415, 0, 0, 415, 415, false, null, null),
      (2, 255, 1, 161, 'VIT 0048', 'Diclofenaco Sodico 75 Mg/3 Ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A241187', '2026-09-20', '2024-09-20', 4, 1.2, 1.2, 0, 0, 4.8, 4.8, true, null, null),
      (2, 255, 2, 14, 'VIT 0011', 'Cefotaxima 1 G Polvo Para Solucion Inyectable - Caja X 10 - Vial - VIAL', 'C240178', '2027-10-10', '2024-10-10', 1, 5.4, 5.4, 0, 0, 5.4, 5.4, true, null, null),
      (2, 256, 1, 10, 'VIT 0007', 'Aztreonam 1 G Polvo Para Solución Inyectable - Caja X 10 - Vial - VIAL', 'C250029', '2027-02-12', '2025-02-12', 1, 41.5, 41.5, 0, 0, 41.5, 41.5, true, null, null),
      (2, 257, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 835, 835, 0, 0, 835, 835, false, null, null),
      (2, 258, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 27956.25, 27956.25, 0, 0, 27956.25, 27956.25, false, null, null),
      (2, 259, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 17956.25, 17956.25, 0, 0, 17956.25, 17956.25, false, null, null),
      (2, 260, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 112.5, 112.5, 0, 0, 112.5, 112.5, false, null, null),
      (2, 261, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 75, 75, 0, 0, 75, 75, false, null, null),
      (2, 262, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1626, 1626, 0, 0, 1626, 1626, false, null, null),
      (2, 263, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 27, 27, 0, 0, 27, 27, false, null, null),
      (2, 264, 1, 170, 'VIT 0054', 'Metoclopramida 10 Mg/2ml Solucion Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250233', '2027-06-21', '2025-06-21', 7, 1.3, 1.3, 0, 0, 9.1, 9.1, true, null, null),
      (2, 265, 1, 35, 'VIT 0032', 'Penicilina G Benzatinica 2,400,000 Ui Polvo Para Uso Parenteral - Caja X 10 - Vial - VIAL', 'L250075', '2028-05-21', '2025-05-21', 20, 6, 6, 0, 0, 120, 120, true, null, null),
      (2, 266, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 279.5, 279.5, 0, 0, 279.5, 279.5, false, null, null),
      (2, 267, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 337.5, 337.5, 0, 0, 337.5, 337.5, false, null, null),
      (2, 268, 1, 170, 'VIT 0054', 'Metoclopramida 10 Mg/2ml Solucion Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250233', '2027-06-21', '2025-06-21', 4, 1.3, 1.3, 0, 0, 5.2, 5.2, false, null, null),
      (2, 269, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5568.1, 5568.1, 0, 0, 5568.1, 5568.1, false, null, null),
      (2, 270, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 112.5, 112.5, 0, 0, 112.5, 112.5, false, null, null),
      (2, 271, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5.2, 5.2, 0, 0, 5.2, 5.2, false, null, null),
      (2, 272, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 11959.27, 11959.27, 0, 0, 11959.27, 11959.27, false, null, null),
      (2, 273, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 231.2, 231.2, 0, 0, 231.2, 231.2, false, null, null),
      (2, 274, 1, 23, 'VIT 0020', 'Furosemida 20 Mg/2 Ml Solución Inyectable - Caja X 10 - Ampollas - AMPOLLAS', 'A250528', '2028-08-16', '2025-08-16', 600, 1, 1, 0, 0, 600, 600, false, null, null),
      (2, 274, 2, 167, 'VIT 0052', 'Tramadol Clorhidrato 100 Mg/ 2ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250061', '2028-05-09', '2025-05-09', 100, 1.6, 1.6, 0, 0, 160, 160, false, null, null),
      (2, 275, 1, 14, 'VIT 0011', 'Cefotaxima 1 G Polvo Para Solucion Inyectable - Caja X 10 - Vial - VIAL', 'C250068', '2028-04-09', '2025-04-09', 3, 5.2, 5.2, 0, 0, 15.6, 15.6, true, null, null),
      (2, 275, 2, 167, 'VIT 0052', 'Tramadol Clorhidrato 100 Mg/ 2ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250063', '2028-05-09', '2025-05-09', 46, 1.6, 1.6, 0, 0, 73.6, 73.6, true, null, null),
      (2, 275, 3, 182, 'VIT 0061', 'Furosemida 20 Mg/2 Ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250409', '2028-07-23', '2025-07-23', 16, 1, 1, 0, 0, 16, 16, true, null, null),
      (2, 276, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 125, 125, 0, 0, 125, 125, false, null, null),
      (2, 277, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2472, 2472, 0, 0, 2472, 2472, false, null, null),
      (2, 278, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6811.1, 6811.1, 0, 0, 6811.1, 6811.1, false, null, null),
      (2, 279, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 760, 760, 0, 0, 760, 760, false, null, null),
      (2, 280, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1491.5, 1491.5, 0, 0, 1491.5, 1491.5, false, null, null),
      (2, 281, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 154.8, 154.8, 0, 0, 154.8, 154.8, false, null, null),
      (2, 282, 1, 164, 'VIT 0050', 'Amikacina 500 Mg/2ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250345', '2028-07-21', '2025-07-21', 1, 3.4, 3.4, 0, 0, 3.4, 3.4, true, null, null),
      (2, 282, 2, 163, 'VIT 0049', 'Clindamicina 600 Mg/4ml - Caja X 100 - Ampollas - AMPOLLAS', 'A250376', '2027-01-16', '2025-07-16', 26, 4, 4, 0, 0, 104, 104, true, null, null),
      (2, 282, 3, 158, 'VIT 0044', 'Dipirona 1g/2ml (Metamizol) - Caja X 100 - Ampollas - AMPOLLAS', 'A250527', '2027-08-20', '2025-08-20', 400, 2, 2, 0, 0, 800, 800, true, null, null),
      (2, 283, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2159.8, 2159.8, 0, 0, 2159.8, 2159.8, false, null, null),
      (2, 284, 1, 161, 'VIT 0048', 'Diclofenaco Sodico 75 Mg/3 Ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250612', '2027-09-09', '2025-09-09', 5, 1.2, 1.2, 0, 0, 6, 6, true, null, null),
      (2, 285, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2007.75, 2007.75, 0, 0, 2007.75, 2007.75, false, null, null),
      (2, 286, 1, 161, 'VIT 0048', 'Diclofenaco Sodico 75 Mg/3 Ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250612', '2027-09-09', '2025-09-09', 3, 1.2, 1.2, 0, 0, 3.6, 3.6, true, null, null),
      (2, 287, 1, 182, 'VIT 0061', 'Furosemida 20 Mg/2 Ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250409', '2028-07-23', '2025-07-23', 7200, 1, 1, 0, 0, 7200, 7200, true, null, null),
      (2, 288, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 624.75, 624.75, 0, 0, 624.75, 624.75, false, null, null),
      (2, 289, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 414.25, 414.25, 0, 0, 414.25, 414.25, false, null, null),
      (2, 290, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6437, 6437, 0, 0, 6437, 6437, false, null, null),
      (2, 291, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 415, 415, 0, 0, 415, 415, false, null, null),
      (2, 294, 1, 182, 'VIT 0061', 'Furosemida 20 Mg/2 Ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250684', '2028-09-17', '2025-09-17', 1, 1, 1, 0, 0, 1, 1, true, null, null),
      (2, 295, 1, 158, 'VIT 0044', 'Dipirona 1g/2ml (Metamizol) - Caja X 100 - Ampollas - AMPOLLAS', 'A250527', '2027-08-20', '2025-08-20', 5, 2, 2, 0, 0, 10, 10, true, null, null),
      (2, 295, 2, 182, 'VIT 0061', 'Furosemida 20 Mg/2 Ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250684', '2028-09-17', '2025-09-17', 3, 1, 1, 0, 0, 3, 3, true, null, null),
      (2, 295, 3, 170, 'VIT 0054', 'Metoclopramida 10 Mg/2ml Solucion Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250621', '2027-09-08', '2025-09-08', 2, 1.3, 1.3, 0, 0, 2.6, 2.6, true, null, null),
      (2, 295, 4, 167, 'VIT 0052', 'Tramadol Clorhidrato 100 Mg/ 2ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250590', '2028-09-08', '2025-09-08', 10, 1.6, 1.6, 0, 0, 16, 16, true, null, null),
      (2, 296, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3546.25, 3546.25, 0, 0, 3546.25, 3546.25, false, null, null),
      (2, 297, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 8178.3, 8178.3, 0, 0, 8178.3, 8178.3, false, null, null),
      (2, 298, 1, 161, 'VIT 0048', 'Diclofenaco Sodico 75 Mg/3 Ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250742', '2027-10-10', '2025-10-10', 100, 1.2, 1.2, 0, 0, 120, 120, true, null, null),
      (2, 298, 2, 29, 'VIT 0026', 'Lidocaina 1 % Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250719', '2028-09-22', '2025-09-22', 100, 1.6, 1.6, 0, 0, 160, 160, true, null, null),
      (2, 299, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2600, 2600, 0, 0, 2600, 2600, false, null, null),
      (2, 300, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 25, 25, 0, 0, 25, 25, false, null, null),
      (2, 301, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 10163.3, 10163.3, 0, 0, 10163.3, 10163.3, false, null, null),
      (2, 302, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5085.34, 5085.34, 0, 0, 5085.34, 5085.34, false, null, null),
      (2, 303, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 900, 900, 0, 0, 900, 900, false, null, null),
      (2, 304, 1, 164, 'VIT 0050', 'Amikacina 500 Mg/2ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250751', '2028-10-24', '2025-10-24', 70, 3.4, 3.4, 0, 0, 238, 238, true, null, null),
      (2, 304, 2, 167, 'VIT 0052', 'Tramadol Clorhidrato 100 Mg/ 2ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250102', '2028-05-09', '2025-05-09', 8, 1.6, 1.6, 0, 0, 12.8, 12.8, true, null, null),
      (2, 305, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 505.03, 505.03, 0, 0, 505.03, 505.03, false, null, null),
      (2, 306, 1, 164, 'VIT 0050', 'Amikacina 500 Mg/2ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250751', '2028-10-24', '2025-10-24', 530, 3.4, 3.4, 0, 0, 1802, 1802, true, null, null),
      (2, 307, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 84.38, 84.38, 0, 0, 84.38, 84.38, false, null, null),
      (2, 308, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 292.34, 292.34, 0, 0, 292.34, 292.34, false, null, null),
      (2, 309, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4575, 4575, 0, 0, 4575, 4575, false, null, null),
      (2, 310, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 204, 204, 0, 0, 204, 204, false, null, null),
      (2, 311, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 362.5, 362.5, 0, 0, 362.5, 362.5, false, null, null),
      (2, 312, 1, 30, 'VIT 0027', 'Meropenem 500 Mg Polvo Para Solucion Inyectable - Caja X 10 - Vial - VIAL', 'C250110', '2028-06-17', '2025-06-17', 60, 9.15, 9.15, 0, 0, 549, 549, true, null, null),
      (2, 312, 2, 30, 'VIT 0027', 'Meropenem 500 Mg Polvo Para Solucion Inyectable - Caja X 10 - Vial - VIAL', 'C250098', '2028-05-30', '2025-05-30', 30, 9.15, 9.15, 0, 0, 274.5, 274.5, true, null, null),
      (2, 313, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3225, 3225, 0, 0, 3225, 3225, false, null, null),
      (2, 314, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1695.75, 1695.75, 0, 0, 1695.75, 1695.75, false, null, null),
      (2, 315, 1, 161, 'VIT 0048', 'Diclofenaco Sodico 75 Mg/3 Ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250860', '2027-11-12', '2025-11-12', 1, 1.2, 1.2, 0, 0, 1.2, 1.2, true, null, null),
      (2, 316, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 112.5, 112.5, 0, 0, 112.5, 112.5, false, null, null),
      (2, 317, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2140, 2140, 0, 0, 2140, 2140, false, null, null),
      (2, 318, 1, 163, 'VIT 0049', 'Clindamicina 600 Mg/4ml - Caja X 100 - Ampollas - AMPOLLAS', 'A250853', '2027-04-29', '2025-10-29', 1, 4, 4, 0, 0, 4, 4, true, null, null),
      (2, 319, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 87.2, 87.2, 0, 0, 87.2, 87.2, false, null, null),
      (2, 320, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1428, 1428, 0, 0, 1428, 1428, false, null, null),
      (2, 321, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3750, 3750, 0, 0, 3750, 3750, false, null, null),
      (2, 322, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3750, 3750, 0, 0, 3750, 3750, false, null, null),
      (2, 323, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 243, 243, 0, 0, 243, 243, false, null, null),
      (2, 324, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 684, 684, 0, 0, 684, 684, false, null, null),
      (2, 325, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 270, 270, 0, 0, 270, 270, false, null, null),
      (2, 326, 1, 191, 'VIT 0063', 'Tramadol Clorhidrato 100 Mg/ 2ml Solución Inyectable - Caja X 1 - Ampolla - AMPOLLA', 'A250333', '2028-07-07', '2025-07-07', 3, 2.4, 2.4, 0, 0, 7.2, 7.2, true, 11, null),
      (2, 327, 1, 191, 'VIT 0063', 'Tramadol Clorhidrato 100 Mg/ 2ml Solución Inyectable - Caja X 1 - Ampolla - AMPOLLA', 'A250333', '2028-07-07', '2025-07-07', 20, 2.4, 2.4, 0, 0, 48, 48, true, 11, null),
      (2, 328, 1, 16, 'VIT 0013', 'Ceftriaxona Sodica 1g Polvo Para Solución Inyectable - Caja X 10 - Vial - VIAL', 'C250073', '2028-04-08', '2025-04-08', 1, 5, 5, 0, 0, 5, 5, true, 1, null),
      (2, 329, 1, 51, 'VIT 0039', 'Ceftriaxona Sodica 1g Polvo Para Solución Inyectable - Caja X 50 - Vial - VIAL', 'F250002', '2028-09-11', '2025-09-11', 1, 5, 5, 0, 0, 5, 5, true, 1, null),
      (2, 330, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3427, 3427, 0, 0, 3427, 3427, false, null, null),
      (2, 331, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 444.2, 444.2, 0, 0, 444.2, 444.2, false, null, null),
      (2, 332, 1, 161, 'VIT 0048', 'Diclofenaco Sodico 75 Mg/3 Ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A260063', '2028-01-14', '2026-01-14', 200, 1.2, 1.2, 0, 0, 240, 240, true, 1, null),
      (2, 333, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4192, 4192, 0, 0, 4192, 4192, false, null, null),
      (2, 334, 1, 170, 'VIT 0054', 'Metoclopramida 10 Mg/2ml Solucion Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250857', '2027-11-23', '2025-11-23', 1, 1.3, 1.3, 0, 0, 1.3, 1.3, true, 1, null),
      (2, 335, 1, 161, 'VIT 0048', 'Diclofenaco Sodico 75 Mg/3 Ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A250860', '2027-11-12', '2025-11-12', 1500, 1.2, 1.2, 0, 0, 1800, 1800, true, 1, null),
      (2, 336, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1062.5, 1062.5, 0, 0, 1062.5, 1062.5, false, null, null),
      (2, 337, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 371.25, 371.25, 0, 0, 371.25, 371.25, false, null, null),
      (2, 338, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3235, 3235, 0, 0, 3235, 3235, false, null, null),
      (2, 339, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 12090, 12090, 0, 0, 12090, 12090, false, null, null),
      (2, 340, 1, 170, 'VIT 0054', 'Metoclopramida 10 Mg/2ml Solucion Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A260093', '2028-01-24', '2026-01-24', 1, 1.3, 1.3, 0, 0, 1.3, 1.3, true, 1, null),
      (2, 341, 1, 163, 'VIT 0049', 'Clindamicina 600 Mg/4ml - Caja X 100 - Ampollas - AMPOLLAS', 'A250853', '2027-04-29', '2025-10-29', 203, 4, 4, 0, 0, 812, 812, true, 1, null),
      (2, 342, 1, 40, 'VIT 0037', 'Vancomicina 500 Mg Polvo Liofilizado Para Uso Parenteral - Caja X 10 - Vial - VIAL', 'M240207', '2027-10-29', '2024-10-29', 30, 8, 8, 0, 0, 240, 240, true, 1, null),
      (2, 343, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 561, 561, 0, 0, 561, 561, false, null, null),
      (2, 344, 1, 168, 'VIT 0058', 'Ranitidina 50 Mg/2ml Solucion Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A260098', '2028-01-20', '2026-01-20', 100, 1.7, 1.7, 0, 0, 170, 170, true, 1, null),
      (2, 345, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1518, 1518, 0, 0, 1518, 1518, false, null, null),
      (2, 346, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4019, 4019, 0, 0, 4019, 4019, false, null, null),
      (2, 347, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3435, 3435, 0, 0, 3435, 3435, false, null, null),
      (2, 348, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1033.75, 1033.75, 0, 0, 1033.75, 1033.75, false, null, null),
      (2, 349, 1, 161, 'VIT 0048', 'Diclofenaco Sodico 75 Mg/3 Ml Solución Inyectable - Caja X 100 - Ampollas - AMPOLLAS', 'A260327', '2028-03-11', '2026-03-11', 8, 1.5, 1.5, 0, 0, 12, 12, true, 1, null),
      (2, 350, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 22, 22, 0, 0, 22, 22, false, null, null),
      (2, 351, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1950, 1950, 0, 0, 1950, 1950, false, null, null),
      (2, 352, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 6239.25, 6239.25, 0, 0, 6239.25, 6239.25, false, null, null),
      (2, 353, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 680, 680, 0, 0, 680, 680, false, null, null),
      (2, 354, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 8782.5, 8782.5, 0, 0, 8782.5, 8782.5, false, null, null),
      (2, 355, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1800, 1800, 0, 0, 1800, 1800, false, null, null),
      (2, 356, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 495, 495, 0, 0, 495, 495, false, null, null),
      (2, 357, 1, 182, 'VIT 0061', 'Furosemida 20 Mg/2 Ml Solución Inyectable - Caja X 100 - Ampolla -2 Mililitro (Ml) - AMPOLLA -2 MILILITRO (ML)', 'A260373', '2029-03-29', '2026-03-29', 2, 1.5, 1.5, 0, 0, 3, 3, true, 1, null),
      (2, 357, 2, 167, 'VIT 0052', 'Tramadol Clorhidrato 100 Mg/ 2ml Solución Inyectable - Caja X 100 - Ampolla -2 Mililitro (Ml) - AMPOLLA -2 MILILITRO (ML)', 'A260271', '2029-03-09', '2026-03-09', 1, 1.8, 1.8, 0, 0, 1.8, 1.8, true, 1, null),
      (2, 358, 1, 167, 'VIT 0052', 'Tramadol Clorhidrato 100 Mg/ 2ml Solución Inyectable - Caja X 100 - Ampolla -2 Mililitro (Ml) - AMPOLLA -2 MILILITRO (ML)', 'A260269', '2029-03-09', '2026-03-09', 4, 1.8, 1.8, 0, 0, 7.2, 7.2, true, 1, null),
      (2, 359, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 22.5, 22.5, 0, 0, 22.5, 22.5, false, null, null),
      (2, 360, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 848.5, 848.5, 0, 0, 848.5, 848.5, false, null, null),
      (2, 361, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1625, 1625, 0, 0, 1625, 1625, false, null, null),
      (2, 362, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1875, 1875, 0, 0, 1875, 1875, false, null, null),
      (2, 363, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 67.5, 67.5, 0, 0, 67.5, 67.5, false, null, null),
      (2, 364, 1, 182, 'VIT 0061', 'Furosemida 20 Mg/2 Ml Solución Inyectable - Caja X 100 - Ampolla -2 Mililitro (Ml) - AMPOLLA -2 MILILITRO (ML)', 'A260373', '2029-03-29', '2026-03-29', 100, 1.5, 1.5, 0, 0, 150, 150, true, 1, null),
      (2, 365, 1, 167, 'VIT 0052', 'Tramadol Clorhidrato 100 Mg/ 2ml Solución Inyectable - Caja X 100 - Ampolla -2 Mililitro (Ml) - AMPOLLA -2 MILILITRO (ML)', 'A260394', '2029-04-08', '2026-04-08', 100, 1.8, 1.8, 0, 0, 180, 180, true, 1, null),
      (2, 366, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 1343.75, 1343.75, 0, 0, 1343.75, 1343.75, false, null, null),
      (2, 367, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 5879.5, 5879.5, 0, 0, 5879.5, 5879.5, false, null, null),
      (2, 368, 1, 182, 'VIT 0061', 'Furosemida 20 Mg/2 Ml Solución Inyectable - Caja X 100 - Ampolla -2 Mililitro (Ml) - AMPOLLA -2 MILILITRO (ML)', 'A260574', '2029-04-29', '2026-04-29', 1, 1.5, 1.5, 0, 0, 1.5, 1.5, true, 1, null),
      (2, 368, 2, 29, 'VIT 0026', 'Lidocaina 1 % Solución Inyectable - Caja X 100 - Ampolla - AMPOLLA', 'A260047', '2029-01-12', '2026-01-12', 2, 1.7, 1.7, 0, 0, 3.4, 3.4, true, 1, null),
      (2, 369, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 735, 735, 0, 0, 735, 735, false, null, null),
      (2, 370, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 150, 150, 0, 0, 150, 150, false, null, null),
      (2, 371, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 90, 90, 0, 0, 90, 90, false, null, null),
      (2, 372, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3221.15, 3221.15, 0, 0, 3221.15, 3221.15, false, null, null),
      (2, 373, 1, 182, 'VIT 0061', 'Furosemida 20 Mg/2 Ml Solución Inyectable - Caja X 100 - Ampolla -2 Mililitro (Ml) - AMPOLLA -2 MILILITRO (ML)', 'A260574', '2029-04-29', '2026-04-29', 1, 1.5, 1.5, 0, 0, 1.5, 1.5, true, 1, null),
      (2, 374, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 682.1, 682.1, 0, 0, 682.1, 682.1, false, null, null),
      (2, 375, 1, 182, 'VIT 0061', 'Furosemida 20 Mg/2 Ml Solución Inyectable - Caja X 100 - Ampolla -2 Mililitro (Ml) - AMPOLLA -2 MILILITRO (ML)', 'A260621', '2029-06-08', '2026-06-08', 1, 1.5, 1.5, 0, 0, 1.5, 1.5, true, 1, null),
      (2, 375, 2, 168, 'VIT 0058', 'Ranitidina 50 Mg/2ml Solucion Inyectable - Caja X 100 - Ampolla - AMPOLLA', 'A260631', '2028-05-19', '2026-05-19', 1, 1.7, 1.7, 0, 0, 1.7, 1.7, true, 1, null),
      (2, 376, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 3820, 3820, 0, 0, 3820, 3820, false, null, null),
      (2, 377, 1, 172, 'VIT 0056', 'Piperacilina + Tazobactam 4 G / 0.5 G Polvo Para Uso Parenteral - Caja X 10 - Vial - VIAL', 'L260026', '2029-03-24', '2026-03-24', 2, 23, 23, 0, 0, 46, 46, true, 1, null),
      (2, 378, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 750, 750, 0, 0, 750, 750, false, null, null),
      (2, 379, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 300, 300, 0, 0, 300, 300, false, null, null),
      (2, 380, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 4908.7, 4908.7, 0, 0, 4908.7, 4908.7, false, null, null),
      (2, 381, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 62770.6, 62770.6, 0, 0, 62770.6, 62770.6, false, null, null),
      (2, 382, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 760, 760, 0, 0, 760, 760, false, null, null),
      (2, 383, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 150, 150, 0, 0, 150, 150, false, null, null)) as x(loc, nota, linea, producto, cod_prod, descripcion, lote, vence, fabrica, cantidad, precio, precio_mi, descu, descu_mi, total, total_mi, inv, bodega, registro) loop
    select n.id, n.localidad_id into v_id, v_loc from public.notas_compra n join public.localidades l on l.id = n.localidad_id
    where l.organizacion_id = v_org and l.correlativo = r.loc and n.nota_anterior = r.nota;
    if v_id is null then l_s := l_s + 1; continue; end if;
    insert into public.nota_compra_lineas (nota_id, linea, producto_id, descripcion, cantidad, precio, inventario, lote, registro_sanitario, fecha_vencimiento, fecha_fabricacion,
      bodega_id, origen_anterior, producto_anterior, codigo_producto_anterior, precio_mi_anterior, descuento_anterior, descuento_mi_anterior, valor_total_anterior, valor_total_mi_anterior)
    select v_id, r.linea, p.id, coalesce(r.descripcion, p.nombre, 'SIN DESCRIPCIÓN'), case when coalesce(r.cantidad, 0) > 0 then r.cantidad else 1 end,
           greatest(coalesce(r.precio, 0), 0), coalesce(r.inv, false) and p.id is not null, r.lote, r.registro, r.vence, r.fabrica,
           (select b.id from public.bodegas b where b.localidad_id = v_loc and b.codigo = r.bodega), 'MIGRADO', r.producto, r.cod_prod, r.precio_mi, r.descu, r.descu_mi, r.total, r.total_mi
    from (select 1) uno left join public.productos p on p.localidad_id = v_loc and p.codigo = r.producto
    on conflict (nota_id, linea) do update set producto_id = excluded.producto_id, descripcion = excluded.descripcion, cantidad = excluded.cantidad, precio = excluded.precio,
      inventario = excluded.inventario, lote = excluded.lote, registro_sanitario = excluded.registro_sanitario, fecha_vencimiento = excluded.fecha_vencimiento,
      fecha_fabricacion = excluded.fecha_fabricacion, bodega_id = excluded.bodega_id, origen_anterior = excluded.origen_anterior, producto_anterior = excluded.producto_anterior,
      codigo_producto_anterior = excluded.codigo_producto_anterior, precio_mi_anterior = excluded.precio_mi_anterior, descuento_anterior = excluded.descuento_anterior,
      descuento_mi_anterior = excluded.descuento_mi_anterior, valor_total_anterior = excluded.valor_total_anterior, valor_total_mi_anterior = excluded.valor_total_mi_anterior
    returning (xmax = 0) into v_nuevo;
    if v_nuevo then l_n := l_n + 1; else l_a := l_a + 1; end if;
  end loop;

  perform set_config('fin.nota', '', true);
  raise notice '%', format('Notas de compras de la organización 3: %s nuevas, %s actualizadas, %s con otro número (el suyo ya estaba ocupado), %s sin su compra en la base. Líneas: %s nuevas, %s actualizadas, %s sin nota.%s',
    n_n, n_a, n_otro, n_sin_compra, l_n, l_a, l_s, case when n_s > 0 then ' Omitidas por falta de proveedor:' || n_s_txt else '' end);
end;
$notas$;

notify pgrst, 'reload schema';
-- Script 246 · parte 5 de 5 · Organización 3 (Futura Farma - Mavisa), lote al 04-11-2026 (carpeta «Data Inventarios 2 Parte»): notas de crédito y débito de proveedores (Compras ›
--   Notas crédito compras), de ACT_NOTAS_COMPRAS.xls (23 notas de esta parte) y ACT_DET_NOTAS_COMPRAS.xls (23 líneas).
--   Misma lógica del script 243 (lote del 05 al 17-11-2026). Notas: 3-02 384 (VIGENTE), 3-02 385 (VIGENTE), 3-02 386 (VIGENTE), 3-02 387 (VIGENTE), 3-02 388 (OPERADA), 3-02 389 (OPERADA), 3-02 390 (VIGENTE), 3-02 391 (VIGENTE), 3-02 392 (VIGENTE), 3-02 393 (OPERADA), 3-02 394 (VIGENTE), 3-02 395 (VIGENTE), 3-02 396 (OPERADA), 3-02 397 (VIGENTE), 3-02 398 (VIGENTE), 3-02 399 (VIGENTE), 3-02 400 (VIGENTE), 3-02 401 (OPERADA), 3-02 402 (VIGENTE), 3-02 403 (OPERADA), 3-02 404 (VIGENTE), 3-02 405 (VIGENTE), 3-02 406 (VIGENTE).
--   1. Una nota se identifica por su localidad y su número NOTA (columna nueva nota_anterior) y conserva ese número; si ya lo usa una nota
--      hecha en este sistema, toma el siguiente libre. Las líneas, por su nota y LINEA. Si ya existen se actualizan.
--   2. Columnas nuevas (traen datos y no existían):
--      notas_compra: origen_anterior (marca MIGRADO), nota_anterior (NOTA), estado_anterior (ESTADO (I, O, A)), tipo_ajuste_anterior (TIPO_AJUSTE), clasificacion_nota_anterior (CLASIFICACION_NOTA), moneda_anterior (MONEDA), valor_mi (TOTAL_NOTA_MI), bodega_nombre_anterior (DESC_BODEGA), bodega_destino_anterior (BODEGA_DESTINO), compra_anterior (DOCUMENTO (compra)), serie_compra_anterior (SERIE_DOC), numero_compra_anterior (NUMERO_DOC), fecha_compra_anterior (FECHAHORA_EMISION_DOC), transaccion_anterior (TRANSACCION), usuario_ingresa_anterior (USUARIO_INGRESA), fecha_ingresa_anterior (FECHA_INGRESA), usuario_modifica_anterior (USUARIO_MODIFICA), fecha_modifica_anterior (FECHA_MODIFICA), observaciones (OBSERVACIONES).
--      nota_compra_lineas: origen_anterior (marca MIGRADO), producto_anterior (PRODUCTO), codigo_producto_anterior (CODIGO_PRODUCTO), precio_mi_anterior (VALOR_UNITARIO_MI), descuento_anterior (DESCUENTO), descuento_mi_anterior (DESCUENTO_MI), valor_total_anterior (VALOR_TOTAL), valor_total_mi_anterior (VALOR_TOTAL_MI).
--      Columnas vacías (no se migran): notas NUMERO_AUTORIZACION, TIPO_PRECIO, DIRECCION, OBSERVACIONES, NUMERO_AUTORIZACION_DOC, AÑO_POLIZA, MES_POLIZA, POLIZA, USUARIO_ANULA, FECHA_ANULA; líneas REGISTRO_SANITARIO, UNIDAD_MEDIDA, COSTO_UNITARIO, COSTO_UNITARIO_MI.
--   Equivalencias: TIPO_NOTA C = nota de crédito, D = de débito; SERIE y NUMERO = serie y documento del DTE; FECHAHORA_EMISION = fecha;
--   MONEDA 1 = quetzales, 2 = dólares, con VALOR_CAMBIO; TOTAL_NOTA = valor (en dólares, TOTAL_NOTA_MI); ESTADO I (ingresada) = VIGENTE,
--   O = OPERADA, A = ANULADA; TIPO_AJUSTE 1 = DEVOLUCIÓN, 2 = DESCUENTO; CLASIFICACION_NOTA M = manual; MOTIVO_AJUSTE = motivo.
--   Proveedor, bodega y producto por su código en la localidad (el NIT y el nombre se toman del proveedor). La factura de referencia es la
--   compra DOCUMENTO (de medicamentos o, si no hay, compra varia) si es del mismo proveedor; si no está en la base queda su número.
--   Las notas se cargan con su estado del sistema anterior, SIN generar póliza ni movimientos de inventario (el kardex migrado ya trae la
--   salida de las devoluciones: script 147). Una nota OPERADA rebaja el saldo de su compra (compras_saldo); una VIGENTE se puede descargar
--   o anular en Compras. Línea INVENTARIADA = S mueve inventario (sin producto queda como concepto). VALOR_TOTAL = cantidad × precio.
--   Fechas escritas con el año en dos cifras (29/04/0025, 28/04/0025, 5/05/0025, 6/06/0025): se toman del año 2000 en adelante.
--   Se ejecuta después del script 233. Se puede ejecutar de nuevo: actualiza.
set lock_timeout = '20s';
alter table public.notas_compra add column if not exists origen_anterior text;
alter table public.notas_compra add column if not exists nota_anterior integer;
alter table public.notas_compra add column if not exists estado_anterior text;
alter table public.notas_compra add column if not exists tipo_ajuste_anterior integer;
alter table public.notas_compra add column if not exists clasificacion_nota_anterior text;
alter table public.notas_compra add column if not exists moneda_anterior integer;
alter table public.notas_compra add column if not exists valor_mi numeric(18, 2);
alter table public.notas_compra add column if not exists bodega_nombre_anterior text;
alter table public.notas_compra add column if not exists bodega_destino_anterior integer;
alter table public.notas_compra add column if not exists compra_anterior integer;
alter table public.notas_compra add column if not exists serie_compra_anterior text;
alter table public.notas_compra add column if not exists numero_compra_anterior text;
alter table public.notas_compra add column if not exists fecha_compra_anterior date;
alter table public.notas_compra add column if not exists transaccion_anterior integer;
alter table public.notas_compra add column if not exists usuario_ingresa_anterior text;
alter table public.notas_compra add column if not exists fecha_ingresa_anterior timestamp;
alter table public.notas_compra add column if not exists usuario_modifica_anterior text;
alter table public.notas_compra add column if not exists fecha_modifica_anterior timestamp;
alter table public.notas_compra add column if not exists observaciones text;
alter table public.nota_compra_lineas add column if not exists origen_anterior text;
alter table public.nota_compra_lineas add column if not exists producto_anterior integer;
alter table public.nota_compra_lineas add column if not exists codigo_producto_anterior text;
alter table public.nota_compra_lineas add column if not exists precio_mi_anterior numeric(18, 4);
alter table public.nota_compra_lineas add column if not exists descuento_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists descuento_mi_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists valor_total_anterior numeric(18, 2);
alter table public.nota_compra_lineas add column if not exists valor_total_mi_anterior numeric(18, 2);
create unique index if not exists notas_compra_nota_anterior on public.notas_compra (localidad_id, nota_anterior) where nota_anterior is not null;

do $notas$
declare
  v_org bigint; v_gtq bigint; v_usd bigint; r record; v_loc bigint; v_prov record; v_compra bigint; v_bod bigint; v_id bigint; v_num int; v_mon bigint;
  n_n int := 0; n_a int := 0; n_s int := 0; n_s_txt text := ''; n_otro int := 0; n_sin_compra int := 0; l_n int := 0; l_a int := 0; l_s int := 0; v_nuevo boolean;
begin
  select id into v_org from public.organizaciones where codigo::text = '3';
  if v_org is null then raise exception 'No existe la organización 3.'; end if;
  select id into v_gtq from public.monedas where iso = 'GTQ';
  select id into v_usd from public.monedas where iso = 'USD';
  -- Carga del sistema anterior: conserva número, estado y usuario (preparar_nota_compra respeta fin.nota).
  perform set_config('fin.nota', 'si', true);

  for r in select * from (values
      (2::integer, 384::integer, 'NOTA DE CRÉDITO'::text, '947AE09A'::text, '2825538341'::text, null::text, '2026-09-17'::date, 1::integer, 1::numeric, 'VIGENTE'::text, 85::numeric, 85::numeric, 1::integer, 'MAVISA'::text, 1897::integer, 'VITALIS S.A.'::text, 2::integer, 'DESCUENTO'::text, 'Descuento en la factura: A6D155F7 - 188563862 por pronto pago'::text, 291::integer, 'A6D155F7'::text, '188563862'::text, '2026-09-16'::date, 0::integer, 'M'::text, 'AEV'::text, '2026-09-24 00:00:00'::timestamp, null::text, null::timestamp, 3::integer, null::text, null::timestamp, 'I'::text, null::text),
      (2, 385, 'NOTA DE CRÉDITO', '1EA37FC7', '2585018633', null, '2026-09-24', 1, 1, 'VIGENTE', 7798.5, 7798.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 9E72998C - 4030875753 por pronto pago', 292, '9E72998C', '4030875753', '2026-09-21', 0, 'M', 'AEV', '2026-09-28 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 386, 'NOTA DE CRÉDITO', 'FF16AF69', '1532906057', null, '2026-09-16', 1, 1, 'VIGENTE', 12, 12, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: AE8D4E24 - 713377912 1 unidad faltante de Omeprazol', 293, 'AE8D4E24', '713377912', '2026-09-21', 0, 'M', 'AEV', '2026-09-28 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 387, 'NOTA DE CRÉDITO', '68A070DA', '3232254203', null, '2026-09-24', 1, 1, 'VIGENTE', 2245, 2245, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: AE8D4E24 - 713377912 por pronto pago', 293, 'AE8D4E24', '713377912', '2026-09-21', 0, 'M', 'AEV', '2026-09-28 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 388, 'NOTA DE CRÉDITO', 'FE3A2A099', '2514242191', null, '2026-09-24', 1, 1, 'OPERADA', 660, 660, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 294, '0A21F246', '767576127', '2026-09-23', 0, 'M', 'AEV', '2026-09-28 00:00:00', 'AEV', '2026-09-28 00:00:00', 3, null, null, 'O', null),
      (2, 389, 'NOTA DE CRÉDITO', 'CA9A5E0D', '3749462341', null, '2026-09-25', 1, 1, 'OPERADA', 7, 7, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 294, '0A21F246', '767576127', '2026-09-23', 0, 'M', 'AEV', '2026-09-28 00:00:00', 'AEV', '2026-09-28 00:00:00', 3, null, null, 'O', null),
      (2, 390, 'NOTA DE CRÉDITO', 'B9FEA9FE', '1561412141', null, '2026-09-25', 1, 1, 'VIGENTE', 135, 135, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 0A21F246 - 767576127 por pronto pago', 294, '0A21F246', '767576127', '2026-09-23', 0, 'M', 'AEV', '2026-09-28 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 391, 'NOTA DE CRÉDITO', '5E1A9133', '2540586296', null, '2026-09-28', 1, 1, 'VIGENTE', 460, 460, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: E56ED2FD - 1275021359 por pronto pago', 295, 'E56ED2FD', '1275021359', '2026-09-23', 0, 'M', 'AEV', '2026-09-29 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 392, 'NOTA DE CRÉDITO', 'BD75021C', '272845055', null, '2026-10-07', 1, 1, 'VIGENTE', 555, 555, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B01202A1 - 3707650301 por pronto pago', 297, 'B01202A1', '3707650301', '2026-09-28', 0, 'M', 'AEV', '2026-10-07 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 393, 'NOTA DE CRÉDITO', '2A84773B', '558384472', null, '2026-10-07', 1, 1, 'OPERADA', 1.5, 1.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 298, '4E1847A0', '3508027766', '2026-10-01', 0, 'M', 'AEV', '2026-10-07 00:00:00', 'AEV', '2026-10-07 00:00:00', 3, null, null, 'O', null),
      (2, 394, 'NOTA DE CRÉDITO', '7D2DF641', '2398963518', null, '2026-10-07', 1, 1, 'VIGENTE', 2125, 2125, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 4E1847A0 - 3508027766 por pronto pago', 298, '4E1847A0', '3508027766', '2026-10-01', 0, 'M', 'AEV', '2026-10-07 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 395, 'NOTA DE CRÉDITO', 'C68B95DD', '3637068610', null, '2026-10-07', 1, 1, 'VIGENTE', 116.62, 116.62, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 5006D445 - 4196157809 5% adicional por 14 cajas de Ranitidina en mal estado', 299, '5006D445', '4196157809', '2026-10-07', 0, 'M', 'AEV', '2026-10-21 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 396, 'NOTA DE CRÉDITO', '636F790A', '2674214886', null, '2026-10-07', 1, 1, 'OPERADA', 47.6, 47.6, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRDUCTO QUEBRADO', 299, '5006D445', '4196157809', '2026-10-07', 0, 'M', 'AEV', '2026-10-21 00:00:00', 'AEV', '2026-10-21 00:00:00', 3, null, null, 'O', null),
      (2, 397, 'NOTA DE CRÉDITO', 'FB2C407A', '1728399756', null, '2026-10-12', 1, 1, 'VIGENTE', 375, 375, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 5006D445 - 4196157809 por pronto pago', 299, '5006D445', '4196157809', '2026-10-07', 0, 'M', 'AEV', '2026-10-21 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 398, 'NOTA DE CRÉDITO', '528518F1', '241716639', null, '2026-10-12', 1, 1, 'VIGENTE', 467.5, 467.5, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: E05D4DD3 - 1475101300 por pronto pago', 300, 'E05D4DD3', '1475101300', '2026-10-08', 0, 'M', 'AEV', '2026-10-21 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 399, 'NOTA DE CRÉDITO', '102672B4', '2533837530', null, '2026-10-12', 1, 1, 'VIGENTE', 125, 125, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: E062C9F7 - 1624787450 por pronto pago', 303, 'E062C9F7', '1624787450', '2026-10-08', 0, 'M', 'AEV', '2026-10-26 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 400, 'NOTA DE CRÉDITO', '5CD5D7B5', '3081849335', null, '2026-10-21', 1, 1, 'VIGENTE', 243, 243, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 16DED6D7 - 3791735109 por 27 cx100 de Tramadol', 302, '16DED6D7', '3791735109', '2026-10-15', 0, 'M', 'AEV', '2026-10-26 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 401, 'NOTA DE CRÉDITO', 'B6323D97', '1067859988', null, '2026-10-21', 1, 1, 'OPERADA', 54, 54, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 302, '16DED6D7', '3791735109', '2026-10-15', 0, 'M', 'AEV', '2026-10-26 00:00:00', 'AEV', '2026-10-26 00:00:00', 3, null, null, 'O', null),
      (2, 402, 'NOTA DE CRÉDITO', '3E6754E8', '663176318', null, '2026-10-22', 1, 1, 'VIGENTE', 805, 805, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 16DED6D7 - 3791735109 por pronto pago', 302, '16DED6D7', '3791735109', '2026-10-15', 0, 'M', 'AEV', '2026-10-26 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 403, 'NOTA DE CRÉDITO', '71F67D80', '616450287', null, '2026-10-12', 1, 1, 'OPERADA', 35.7, 35.7, 1, 'MAVISA', 1897, 'VITALIS S.A.', 1, 'DEVOLUCIÓN', 'PRODUCTO QUEBRADO', 301, 'B03CF68F', '402277795', '2026-10-14', 0, 'M', 'AEV', '2026-10-26 00:00:00', 'AEV', '2026-10-26 00:00:00', 3, null, null, 'O', null),
      (2, 404, 'NOTA DE CRÉDITO', '6E409D91', '243550598', null, '2026-10-12', 1, 1, 'VIGENTE', 85, 85, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B03CF68F - 402277795. 5% adicional por 10 cx100 Ranitidina', 301, 'B03CF68F', '402277795', '2026-10-14', 0, 'M', 'AEV', '2026-10-26 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 405, 'NOTA DE CRÉDITO', '85F21E9F', '490752540', null, '2026-10-21', 1, 1, 'VIGENTE', 2700, 2700, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: B03CF68F - 402277795 por pronto pago', 301, 'B03CF68F', '402277795', '2026-10-14', 0, 'M', 'AEV', '2026-10-26 00:00:00', null, null, 3, null, null, 'I', null),
      (2, 406, 'NOTA DE CRÉDITO', 'D2F0D326', '1295142007', null, '2026-10-26', 1, 1, 'VIGENTE', 600, 600, 1, 'MAVISA', 1897, 'VITALIS S.A.', 2, 'DESCUENTO', 'Descuento en la factura: 681E5079 - 1915307561 por pronto pago', 304, '681E5079', '1915307561', '2026-10-21', 0, 'M', 'AEV', '2026-10-27 00:00:00', null, null, 3, null, null, 'I', null)) as x(loc, nota, tipo, serie, documento, autorizacion, fecha, moneda, cambio, estado, total, total_mi, bodega, bodega_nombre, proveedor, proveedor_nombre,
       tipo_ajuste_ant, tipo_ajuste, motivo, compra, serie_doc, numero_doc, fecha_doc, transaccion, clasif, usr_ing, f_ing, usr_mod, f_mod, bodega_destino, usr_anula, f_anula,
       estado_ant, obs) order by loc, nota loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    select p.id, p.nit, p.nombre_comercial into v_prov from public.proveedores p where p.localidad_id = v_loc and p.codigo = r.proveedor;
    if v_prov.id is null then n_s := n_s + 1; n_s_txt := n_s_txt || format(' 3-0%s nota %s (proveedor %s);', r.loc, r.nota, r.proveedor); continue; end if;
    v_bod := (select b.id from public.bodegas b where b.localidad_id = v_loc and b.codigo = r.bodega);
    v_compra := coalesce((select c.id from public.compras c where c.localidad_id = v_loc and c.origen_anterior = 'MEDICAMENTOS' and c.compra_anterior = r.compra limit 1),
                         (select c.id from public.compras c where c.localidad_id = v_loc and ((c.origen_anterior = 'VARIAS' and c.compra_anterior = r.compra) or c.compra_varia_anterior = r.compra) limit 1));
    if v_compra is not null and not exists (select 1 from public.compras c where c.id = v_compra and c.proveedor_id = v_prov.id) then v_compra := null; end if;
    if v_compra is null then n_sin_compra := n_sin_compra + 1; end if;
    v_mon := case when r.moneda = 2 then coalesce(v_usd, v_gtq) else v_gtq end;
    select id into v_id from public.notas_compra where localidad_id = v_loc and nota_anterior = r.nota;
    if v_id is null then
      v_num := case when exists (select 1 from public.notas_compra where localidad_id = v_loc and numero = r.nota)
                    then (select coalesce(max(numero), 0) + 1 from public.notas_compra where localidad_id = v_loc) else r.nota end;
      if v_num <> r.nota then n_otro := n_otro + 1; end if;
      insert into public.notas_compra (organizacion_id, localidad_id, numero, tipo, documento, fecha, moneda_id, proveedor_id, nota_anterior, origen_anterior)
      values (v_org, v_loc, v_num, r.tipo, coalesce(r.documento, r.nota::text), r.fecha, v_mon, v_prov.id, r.nota, 'MIGRADO')
      returning id into v_id;
      n_n := n_n + 1;
    else
      n_a := n_a + 1;
    end if;
    update public.notas_compra set
      tipo = r.tipo, numero_autorizacion = r.autorizacion, serie = r.serie, documento = coalesce(r.documento, r.nota::text), fecha = r.fecha,
      moneda_id = v_mon, tipo_cambio = coalesce(nullif(r.cambio, 0), 1), valor = greatest(case when r.moneda = 2 then coalesce(r.total_mi, r.total) else r.total end, 0),
      proveedor_id = v_prov.id, proveedor_codigo = r.proveedor::text, proveedor_nombre = coalesce(r.proveedor_nombre, v_prov.nombre_comercial), nit = v_prov.nit,
      bodega_id = v_bod, compra_id = v_compra, motivo = r.motivo, tipo_ajuste = r.tipo_ajuste,
      tipo_nota = case when r.clasif = 'M' then 'MANUAL' else 'AUTOMÁTICA' end, estado = r.estado,
      usuario = coalesce(upper(r.usr_ing), 'SISTEMA ANTERIOR'),
      operado_por = case when r.estado = 'OPERADA' then upper(coalesce(r.usr_mod, r.usr_ing)) end,
      operado_en = case when r.estado = 'OPERADA' then coalesce(r.f_mod, r.f_ing)::timestamptz end,
      anulado_por = case when r.estado = 'ANULADA' then upper(coalesce(r.usr_anula, r.usr_mod)) end,
      anulado_en = case when r.estado = 'ANULADA' then coalesce(r.f_anula, r.f_mod)::timestamptz end,
      motivo_anulacion = case when r.estado = 'ANULADA' then 'ANULADA EN EL SISTEMA ANTERIOR' end,
      creado_por_nombre = coalesce(upper(r.usr_ing), 'MIGRACIÓN'), creado_en = r.f_ing::timestamptz,
      modificado_por_nombre = upper(r.usr_mod), modificado_en = r.f_mod::timestamptz,
      origen_anterior = 'MIGRADO', nota_anterior = r.nota, estado_anterior = r.estado_ant, tipo_ajuste_anterior = r.tipo_ajuste_ant, clasificacion_nota_anterior = r.clasif,
      moneda_anterior = r.moneda, valor_mi = r.total_mi, bodega_nombre_anterior = r.bodega_nombre, bodega_destino_anterior = r.bodega_destino, compra_anterior = r.compra,
      serie_compra_anterior = r.serie_doc, numero_compra_anterior = r.numero_doc, fecha_compra_anterior = r.fecha_doc, transaccion_anterior = r.transaccion,
      usuario_ingresa_anterior = r.usr_ing, fecha_ingresa_anterior = r.f_ing, usuario_modifica_anterior = r.usr_mod, fecha_modifica_anterior = r.f_mod, observaciones = r.obs
    where id = v_id;
  end loop;

  -- Líneas de las notas.
  for r in select * from (values
      (2::integer, 384::integer, 1::integer, null::integer, null::text, 'DESCUENTO PARA LAS FACTURAS'::text, null::text, null::date, null::date, 1::numeric, 85::numeric, 85::numeric, 0::numeric, 0::numeric, 85::numeric, 85::numeric, false::boolean, null::integer, null::text),
      (2, 385, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 7798.5, 7798.5, 0, 0, 7798.5, 7798.5, false, null, null),
      (2, 386, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 12, 12, 0, 0, 12, 12, false, null, null),
      (2, 387, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2245, 2245, 0, 0, 2245, 2245, false, null, null),
      (2, 388, 1, 158, 'VIT 0044', 'Dipirona 1g/2ml (Metamizol) - Caja X 100 - Ampolla - AMPOLLA', 'A260682', '2028-06-14', '2026-06-14', 300, 2.2, 2.2, 0, 0, 660, 660, true, 1, null),
      (2, 389, 1, 14, 'VIT 0011', 'Cefotaxima 1 G Polvo Para Solucion Inyectable - Caja X 10 - Vial - VIAL', 'F260074', '2029-06-18', '2026-06-18', 1, 7, 7, 0, 0, 7, 7, true, 1, null),
      (2, 390, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 135, 135, 0, 0, 135, 135, false, null, null),
      (2, 391, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 460, 460, 0, 0, 460, 460, false, null, null),
      (2, 392, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 555, 555, 0, 0, 555, 555, false, null, null),
      (2, 393, 1, 182, 'VIT 0061', 'Furosemida 20 Mg/2 Ml Solución Inyectable - Caja X 100 - Ampolla -2 Mililitro (Ml) - AMPOLLA -2 MILILITRO (ML)', 'A260720', '2029-06-25', '2026-06-25', 1, 1.5, 1.5, 0, 0, 1.5, 1.5, true, 1, null),
      (2, 394, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2125, 2125, 0, 0, 2125, 2125, false, null, null),
      (2, 395, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 116.62, 116.62, 0, 0, 116.62, 116.62, false, null, null),
      (2, 396, 1, 168, 'VIT 0058', 'Ranitidina 50 Mg/2ml Solucion Inyectable - Caja X 100 - Ampolla - AMPOLLA', 'A260784', '2028-07-12', '2026-07-12', 28, 1.7, 1.7, 0, 0, 47.6, 47.6, true, 1, null),
      (2, 397, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 375, 375, 0, 0, 375, 375, false, null, null),
      (2, 398, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 467.5, 467.5, 0, 0, 467.5, 467.5, false, null, null),
      (2, 399, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 125, 125, 0, 0, 125, 125, false, null, null),
      (2, 400, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 243, 243, 0, 0, 243, 243, false, null, null),
      (2, 401, 1, 167, 'VIT 0052', 'Tramadol Clorhidrato 100 Mg/ 2ml Solución Inyectable - Caja X 100 - Ampolla -2 Mililitro (Ml) - AMPOLLA -2 MILILITRO (ML)', 'A260737', '2029-07-03', '2026-07-03', 30, 1.8, 1.8, 0, 0, 54, 54, true, 1, null),
      (2, 402, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 805, 805, 0, 0, 805, 805, false, null, null),
      (2, 403, 1, 168, 'VIT 0058', 'Ranitidina 50 Mg/2ml Solucion Inyectable - Caja X 100 - Ampolla - AMPOLLA', 'A260784', '2028-07-12', '2026-07-12', 21, 1.7, 1.7, 0, 0, 35.7, 35.7, true, 1, null),
      (2, 404, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 85, 85, 0, 0, 85, 85, false, null, null),
      (2, 405, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 2700, 2700, 0, 0, 2700, 2700, false, null, null),
      (2, 406, 1, 1, null, 'DESCUENTO PARA LAS FACTURAS', null, null, null, 1, 600, 600, 0, 0, 600, 600, false, null, null)) as x(loc, nota, linea, producto, cod_prod, descripcion, lote, vence, fabrica, cantidad, precio, precio_mi, descu, descu_mi, total, total_mi, inv, bodega, registro) loop
    select n.id, n.localidad_id into v_id, v_loc from public.notas_compra n join public.localidades l on l.id = n.localidad_id
    where l.organizacion_id = v_org and l.correlativo = r.loc and n.nota_anterior = r.nota;
    if v_id is null then l_s := l_s + 1; continue; end if;
    insert into public.nota_compra_lineas (nota_id, linea, producto_id, descripcion, cantidad, precio, inventario, lote, registro_sanitario, fecha_vencimiento, fecha_fabricacion,
      bodega_id, origen_anterior, producto_anterior, codigo_producto_anterior, precio_mi_anterior, descuento_anterior, descuento_mi_anterior, valor_total_anterior, valor_total_mi_anterior)
    select v_id, r.linea, p.id, coalesce(r.descripcion, p.nombre, 'SIN DESCRIPCIÓN'), case when coalesce(r.cantidad, 0) > 0 then r.cantidad else 1 end,
           greatest(coalesce(r.precio, 0), 0), coalesce(r.inv, false) and p.id is not null, r.lote, r.registro, r.vence, r.fabrica,
           (select b.id from public.bodegas b where b.localidad_id = v_loc and b.codigo = r.bodega), 'MIGRADO', r.producto, r.cod_prod, r.precio_mi, r.descu, r.descu_mi, r.total, r.total_mi
    from (select 1) uno left join public.productos p on p.localidad_id = v_loc and p.codigo = r.producto
    on conflict (nota_id, linea) do update set producto_id = excluded.producto_id, descripcion = excluded.descripcion, cantidad = excluded.cantidad, precio = excluded.precio,
      inventario = excluded.inventario, lote = excluded.lote, registro_sanitario = excluded.registro_sanitario, fecha_vencimiento = excluded.fecha_vencimiento,
      fecha_fabricacion = excluded.fecha_fabricacion, bodega_id = excluded.bodega_id, origen_anterior = excluded.origen_anterior, producto_anterior = excluded.producto_anterior,
      codigo_producto_anterior = excluded.codigo_producto_anterior, precio_mi_anterior = excluded.precio_mi_anterior, descuento_anterior = excluded.descuento_anterior,
      descuento_mi_anterior = excluded.descuento_mi_anterior, valor_total_anterior = excluded.valor_total_anterior, valor_total_mi_anterior = excluded.valor_total_mi_anterior
    returning (xmax = 0) into v_nuevo;
    if v_nuevo then l_n := l_n + 1; else l_a := l_a + 1; end if;
  end loop;

  perform set_config('fin.nota', '', true);
  raise notice '%', format('Notas de compras de la organización 3: %s nuevas, %s actualizadas, %s con otro número (el suyo ya estaba ocupado), %s sin su compra en la base. Líneas: %s nuevas, %s actualizadas, %s sin nota.%s',
    n_n, n_a, n_otro, n_sin_compra, l_n, l_a, l_s, case when n_s > 0 then ' Omitidas por falta de proveedor:' || n_s_txt else '' end);
end;
$notas$;

notify pgrst, 'reload schema';
