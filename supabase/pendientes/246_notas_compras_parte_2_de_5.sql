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
