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
