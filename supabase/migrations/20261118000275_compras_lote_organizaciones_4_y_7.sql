-- Lote del 05-11 al 17-11-2026 («Datos Tecnoasla - AAPOS del 05-11-2026 al 17-11-2026»): mismo proceso del script 229, solo con los registros de este lote.
-- Script 275 · Organizaciones 4 (Tecnoalsa) y 7 (AAPOS): 83 compras del sistema anterior (ACT_COMPRAS.xlsx, compras varias):
--   4-01: 25, 7-01: 58. Se ejecuta después de los scripts 221, 222 y 225.
--   Lógica del script 198 (organización 2). Cada compra conserva su número (COMPRA); origen_anterior = 'VARIAS' y compra_anterior = COMPRA.
--   Las compras registradas en el sistema que usen esos números pasan después del último. Una compra que ya existe se actualiza.
--   Sin valor total (no se migran, el sistema exige valor mayor que 0; 0): .
--   Documentos repetidos en el archivo (al segundo se le agrega « (2)»; el original queda en documento_anterior; 0): ninguna.
--   Exento mayor que el valor total (queda el valor total; el del archivo en exento_anterior): ninguna.
--   Año de presentación fuera de rango (queda vacío; el del archivo en anio_presentacion_anterior): ninguna.
--   Fecha del documento inválida (queda la fecha de ingreso; la del archivo en fecha_documento_anterior): ninguna.
--   Proveedores que no vienen en ACT_PROVEEDORES (se crean para revisarlos): ninguna.
--   Columnas que ya existían y ahora se llenan: iva_especial, isr_especial, iva_importacion, turismo_itp (ITP), dai, valor_cuenta_ajena y descuentos_anterior.
--   Columnas nuevas: subtotal_anterior (SUBTOTAL), proyecto_anterior (PROYECTO), tipo_operacion_anterior (TIPO_OPERACION), rubro_anterior y
--   tipo_rubro_anterior (RUBRO, TIPO_RUBRO), cuenta_contable_anterior (CUENTA_CONTABLE), centro_costo_anterior (CENTRO_COSTO),
--   estado_conta_anterior (ESTADO_CONTA), banco_proveedor_anterior (BANCO_PROVEEDOR) y penalizacion_vencimiento_anterior (PENALIZACION_VENCIMIENTO);
--   más las de los scripts 89 y 198. TOTAL_NC, BONIFICACIONES, DESCUENTOS_ND, INGUAT, IVA/ISR retenido, propina y galones vienen en 0.
--   Para el SQL Editor de Supabase están por separado en supabase/pendientes/275_compras_parte_N_de_2.sql (primero la parte 0).

-- Script 275 · parte 0 de 2: columnas nuevas de compras y clasificaciones de compras (ACT_CLASIFICACIONES_COMPRAS.xlsx, 11).
-- Se ejecuta UNA vez, antes de las partes 1 a 2. Si la tabla de compras está ocupada por otra consulta, falla a los 20 segundos.
set lock_timeout = '20s';
-- Columnas del sistema anterior (las de los scripts 89 y 198 y, nuevas, las de este archivo).
alter table public.compras add column if not exists modulo_factura integer;
alter table public.compras add column if not exists numero_cheque text;
alter table public.compras add column if not exists usuario_modifica_anterior text;
alter table public.compras add column if not exists fecha_modifica_anterior date;
alter table public.compras add column if not exists tipo_compra_anterior text;
alter table public.compras add column if not exists poliza_anio integer;
alter table public.compras add column if not exists poliza_mes integer;
alter table public.compras add column if not exists poliza_numero integer;
alter table public.compras add column if not exists pct_iva numeric;
alter table public.compras add column if not exists pct_retencion numeric;
alter table public.compras add column if not exists propina numeric;
alter table public.compras add column if not exists fecha_transferencia date;
alter table public.compras add column if not exists clasificacion_pago integer;
alter table public.compras add column if not exists usuario_autoriza text;
alter table public.compras add column if not exists tipo_periodo_compra text;
alter table public.compras add column if not exists transaccion_retencion integer;
alter table public.compras add column if not exists valor_cambio_anterior numeric;
alter table public.compras add column if not exists origen_anterior text;
alter table public.compras add column if not exists compra_anterior integer;
alter table public.compras add column if not exists documento_anterior text;
alter table public.compras add column if not exists proveedor_anterior integer;
alter table public.compras add column if not exists transaccion_anterior integer;
alter table public.compras add column if not exists regimen_isr_anterior integer;
alter table public.compras add column if not exists fecha_ingreso_anterior timestamp;
alter table public.compras add column if not exists usuario_anula_anterior text;
alter table public.compras add column if not exists fecha_anula_anterior timestamp;
alter table public.compras add column if not exists cuenta_bancaria_anterior text;
alter table public.compras add column if not exists transferencia_anterior text;
alter table public.compras add column if not exists banco_anterior integer;
alter table public.compras add column if not exists contrasena_anterior text;
alter table public.compras add column if not exists exento_anterior numeric;
alter table public.compras add column if not exists anio_presentacion_anterior integer;
alter table public.compras add column if not exists retencion_valor_anterior numeric;
alter table public.compras add column if not exists fecha_documento_anterior text;
alter table public.compras add column if not exists fecha_vencimiento_anterior text;
alter table public.compras add column if not exists descuentos_anterior numeric;
alter table public.compras add column if not exists subtotal_anterior numeric;
alter table public.compras add column if not exists proyecto_anterior integer;
alter table public.compras add column if not exists tipo_operacion_anterior integer;
alter table public.compras add column if not exists rubro_anterior integer;
alter table public.compras add column if not exists tipo_rubro_anterior text;
alter table public.compras add column if not exists cuenta_contable_anterior text;
alter table public.compras add column if not exists centro_costo_anterior text;
alter table public.compras add column if not exists estado_conta_anterior text;
alter table public.compras add column if not exists banco_proveedor_anterior integer;
alter table public.compras add column if not exists penalizacion_vencimiento_anterior numeric;
create unique index if not exists compras_origen_anterior_uk on public.compras (localidad_id, origen_anterior, compra_anterior) where origen_anterior is not null;

-- Clasificaciones de compras: catálogo común a todas las organizaciones (script 93). Se completan tipo, columna, reporte de facturas y
-- siglas donde no tengan; «libro de compras» y «aplica IVA» no se cambian (los usan las demás organizaciones): si difieren se informa.
alter table public.clasificaciones_compra add column if not exists tipo text;
alter table public.clasificaciones_compra add column if not exists columna text;
alter table public.clasificaciones_compra add column if not exists incluir_reporte_facturas boolean;
do $clasif$
declare v_n int := 0; v_dif text;
begin
  with m (codigo, nombre, libro, aplica_iva, tipo, columna, reporte, siglas) as (values
    (1::integer, 'NO IVA - NO LC'::text, false::boolean, false::boolean, 'N'::text, 'N'::text, false::boolean, null::text),
    (2, 'SERVICIOS', true, true, 'S', 'S', true, 'SER'),
    (3, 'BIENES EXENTOS', true, false, 'X', 'X', true, 'EXE'),
    (4, 'BIENES', true, true, 'B', 'B', true, 'COM'),
    (5, 'COMBUSTIBLES', true, true, 'C', 'C', true, 'GAS'),
    (6, 'SERVICIOS EXENTOS', true, false, 'E', 'E', true, 'EXE'),
    (7, 'COMPRAS MEDICAS', true, true, 'M', 'M', true, 'CME'),
    (8, 'GASTO NO DEDUCIBLE', true, false, 'N', 'N', false, 'GND'),
    (9, 'IMPORTACIONES', true, false, 'I', 'I', true, 'IMP'),
    (10, 'PEQUEÑO CONTRIBUYENTE', true, false, 'P', 'P', true, 'FPQ'),
    (11, 'EXENTOS IMPORTACION', true, false, 'B', null, false, 'IMPE')),
  nuevos as (
    insert into public.clasificaciones_compra (codigo, nombre, siglas, libro_compras, aplica_iva, tipo, columna, incluir_reporte_facturas)
    select m.codigo, m.nombre, case when upper(m.siglas) ~ '^[A-Z0-9]{1,6}$' then upper(m.siglas) end, coalesce(m.libro, true), coalesce(m.aplica_iva, true), m.tipo, m.columna, m.reporte
    from m where not exists (select 1 from public.clasificaciones_compra k where k.codigo = m.codigo)
      and not exists (select 1 from public.clasificaciones_compra k where upper(k.nombre) = upper(m.nombre))
    returning 1)
  select count(*) into v_n from nuevos;
  update public.clasificaciones_compra k set tipo = coalesce(k.tipo, m.tipo), columna = coalesce(k.columna, m.columna),
    incluir_reporte_facturas = coalesce(k.incluir_reporte_facturas, m.reporte),
    siglas = coalesce(k.siglas, case when upper(m.siglas) ~ '^[A-Z0-9]{1,6}$' then upper(m.siglas) end)
  from (values
    (1::integer, 'N'::text, 'N'::text, false::boolean, null::text),
    (2, 'S', 'S', true, 'SER'),
    (3, 'X', 'X', true, 'EXE'),
    (4, 'B', 'B', true, 'COM'),
    (5, 'C', 'C', true, 'GAS'),
    (6, 'E', 'E', true, 'EXE'),
    (7, 'M', 'M', true, 'CME'),
    (8, 'N', 'N', false, 'GND'),
    (9, 'I', 'I', true, 'IMP'),
    (10, 'P', 'P', true, 'FPQ'),
    (11, 'B', null, false, 'IMPE')) as m (codigo, tipo, columna, reporte, siglas)
  where k.codigo = m.codigo;
  select string_agg(format('%s %s (libro %s, IVA %s)', k.codigo, k.nombre, case when m.libro then 'S' else 'N' end, case when m.aplica_iva then 'S' else 'N' end), '; ') into v_dif
  from public.clasificaciones_compra k join (values
    (1::integer, false::boolean, false::boolean),
    (2, true, true),
    (3, true, false),
    (4, true, true),
    (5, true, true),
    (6, true, false),
    (7, true, true),
    (8, true, false),
    (9, true, false),
    (10, true, false),
    (11, true, false)) as m (codigo, libro, aplica_iva) on m.codigo = k.codigo
  where k.libro_compras is distinct from m.libro or k.aplica_iva is distinct from m.aplica_iva;
  raise notice '%', format('Clasificaciones de compras: %s nuevas.%s', v_n,
    case when v_dif is not null then ' En el sistema de Tecnoalsa/AAPOS estas tienen otro «libro de compras» o «aplica IVA» (no se cambian; revísalas en Compras · Catálogos): ' || v_dif || '.' else '' end);
end;
$clasif$;
notify pgrst, 'reload schema';

-- Script 275 · parte 1 de 2 · Organización 4 (TECNOALSA): compras (ACT_COMPRAS.xlsx), 25 compras (de 4-01 1992 a 4-01 2016).
-- Se ejecuta después de la parte 0 y del script 225 (proveedores). Se puede ejecutar de nuevo: la segunda vez solo actualiza.
-- Si la tabla de compras está ocupada por otra consulta, falla a los 20 segundos en vez de quedarse esperando.
set lock_timeout = '20s';

do $compras$
declare
  v_org bigint; v_gtq bigint; v_l record; v_n int := 0; v_a int := 0; v_ren int := 0; v_k int; v_prov int := 0; v_reg int := 0; v_doc int := 0;
begin
  select id into v_org from public.organizaciones where codigo::text = '4';
  if v_org is null then raise exception 'No existe la organización 4: ejecuta antes el script 221.'; end if;
  select id into v_gtq from public.monedas where iso = 'GTQ';
  -- Carga de datos históricos: los períodos fiscales cerrados no la bloquean.
  perform set_config('fin.migracion', 'si', true);
  -- La numeración y el estado vienen del archivo: el trigger que los asigna se suspende durante la carga.
  alter table public.compras disable trigger compras_preparar;

  -- a) Las compras que no vienen del sistema anterior pasan a números después del último del archivo
  --    (4-01 hasta 2016), para que cada compra migrada conserve su número.
  for v_l in select l.id, x.maximo from (values (1, 2016)) as x(loc, maximo)
             join public.localidades l on l.organizacion_id = v_org and l.correlativo = x.loc loop
    update public.compras c set numero = greatest((select coalesce(max(numero), 0) from public.compras where localidad_id = v_l.id), v_l.maximo) + q.fila
    from (select id, row_number() over (order by numero) as fila from public.compras
          where localidad_id = v_l.id and (origen_anterior is null or origen_anterior <> 'VARIAS') and numero <= v_l.maximo) q
    where c.id = q.id;
    get diagnostics v_k = row_count; v_ren := v_ren + v_k;
  end loop;

  -- b) Regímenes ISR y proveedores que usan las compras y no existen: se crean (el proveedor, para revisarlo).
  insert into public.regimenes_isr (codigo, nombre)
  select x.c, 'RÉGIMEN ISR ' || x.c || ' (CREADO AL MIGRAR PROVEEDORES)' from unnest(array[1, 3, 4, 6, 8, 9]) as x(c)
  where not exists (select 1 from public.regimenes_isr g where g.codigo = x.c);
  get diagnostics v_reg = row_count;
  insert into public.proveedores (organizacion_id, localidad_id, codigo, nombre_comercial, concepto_gastos, pendiente_revisar)
  select v_org, l.id, x.codigo, case when x.codigo = 999999 then 'SIN PROVEEDOR ASIGNADO' else 'PROVEEDOR ' || x.codigo || ' (CREADO AL MIGRAR COMPRAS)' end, 'POR DEFINIR', true
  from (values (1, 50), (1, 81), (1, 1324), (1, 1579), (1, 1279), (1, 1766), (1, 635), (1, 339), (1, 1595), (1, 558), (1, 562), (1, 1547), (1, 436), (1, 1743), (1, 1767), (1, 1594), (1, 36), (1, 598), (1, 624), (1, 1781)) as x(loc, codigo)
  join public.localidades l on l.organizacion_id = v_org and l.correlativo = x.loc
  where not exists (select 1 from public.proveedores p where p.localidad_id = l.id and p.codigo = x.codigo);
  get diagnostics v_prov = row_count;

  -- c) Las compras. ESTADO V/A = ACTIVA/ANULADA; TIPO_COMPRA M/V = proveedor de productos/servicios; quetzales con cambio 1
  --    (VALOR_CAMBIO queda en valor_cambio_anterior); FECHA_ESTIMADA_PAGO = fecha de vencimiento; CALCULAR_RETENCION S/N.
  --    IVA_ESPECIAL, ISR_ESPECIAL, IVA_IMPORTACION, ITP (turismo), DAI y VALOR_CTA_AJENA van a sus columnas.
  --    Documento que ya tiene otra compra vigente registrada en el sistema (p. ej. cargada de la SAT): se le agrega « (MIGRADA)».
  with m (loc, compra, tipo_doc, serie, documento, documento_ant, fecha_documento, fecha_ingreso, fecha_venc, proveedor, proveedor_ant, descripcion, transaccion, valor_total, valor_cambio, estado, usuario, usr_anula, f_anula, usr_mod, f_mod, tipo_compra, poliza_anio, poliza_mes, poliza_numero, pct_iva, pct_retencion, valor_retencion, retencion, formulario, exento, exento_ant, propina, transferencia, fecha_transf, banco, clasif_pago, original, contrasena, cuenta_bancaria, numero_cheque, regimen, anio_pres, anio_pres_ant, mes_pres, gal_super, gal_regular, gal_diesel, trans_ret, fecha_ret, orden_compra, usr_autoriza, tipo_periodo, pago_inmediato, modulo, clasif, fecha_doc_ant, fecha_venc_ant, iva_esp, isr_esp, iva_imp, itp, dai, cta_ajena, subtotal, proyecto, tipo_oper, rubro, tipo_rubro, cuenta_cont, centro, estado_conta, descuentos, banco_prov, penalizacion) as (values
      (1::integer, 1992::integer, 4::integer, 'AP230926'::text, 'EC997-6596'::text, null::text, '2026-10-26'::date, '2026-11-08 13:49:38'::timestamp, '2026-10-26'::date, 50::integer, 50::integer, 'FLETE AEREO, GASTOS ECWORKS, SEGUROS Y COLLECT FEE DESDE EL ECUADOR'::text, 1006::integer, 17068.78::numeric, 1::numeric, 'V'::text, 'JES'::text, null::text, null::timestamp, 'JES'::text, '2026-11-08 00:00:00'::timestamp, 'V'::text, null::integer, null::integer, null::integer, 12::numeric, 5::numeric, 0::numeric, false::boolean, null::text, 17068.78::numeric, null::numeric, null::numeric, null::text, null::date, null::integer, 0::integer, true::boolean, null::text, null::text, null::text, 3::integer, 2026::integer, null::integer, 10::integer, 0::numeric, 0::numeric, 0::numeric, null::integer, null::date, null::text, null::text, 'C'::text, true::boolean, 10::integer, 11::integer, null::text, null::text, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::integer, 0::integer, null::integer, null::text, null::text, null::text, 'N'::text, 0::numeric, null::integer, null::numeric),
      (1, 1993, 4, 'EBD48069', '2597865194', null, '2026-10-31', '2026-11-08 14:15:53', '2026-10-31', 81, 81, 'COMISION SOBRE LIQUIDACION DE COMERCIO', 1011, 1735.24, 1, 'V', 'JES', null, null, 'JES', '2026-11-08 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 1994, 9, '144DE289', '2882751295', null, '2026-10-30', '2026-11-08 16:18:41', '2026-10-30', 1324, 1324, 'SERVICIOS PROFECIONALES DE CARACTER JURIDICOS', 1011, 1900, 1, 'V', 'JES', null, null, 'JES', '2026-11-08 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 1995, 4, '2F0FA699', '2431796020', null, '2026-11-01', '2026-11-10 07:10:21', '2026-11-01', 1579, 1579, 'SERVICIO DE ARRENDAMIENTO OFIBODEGA 206', 1011, 17316.48, 1, 'V', 'JES', null, null, 'JES', '2026-11-10 00:00:00', 'V', null, null, null, 12, 5, 773.06, true, null, 0, null, null, null, null, null, 0, true, null, null, null, 9, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 1996, 5, '1FBBCF8F', '3348056365', null, '2026-11-02', '2026-11-10 07:15:07', '2026-11-02', 1279, 1279, 'SERVICI DE MENSAJERIA', 1011, 1066.95, 1, 'V', 'JES', null, null, 'JES', '2026-11-10 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 1, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 114.32, 47.63, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 1997, 5, '87B3FA47', '1293960841', null, '2026-11-02', '2026-11-10 08:25:07', '2026-11-02', 1766, 1766, 'SERVICIOS PROFECIONALES EXTRAORDINARIOS', 1011, 2947.37, 1, 'V', 'JES', null, null, 'JES', '2026-11-10 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 1, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 315.79, 131.58, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 1998, 4, '1E3A4041', '3605481714', null, '2026-11-02', '2026-11-10 08:42:48', '2026-11-02', 635, 635, 'HOSTING WEB FIREWALL Y SOPORTE TECNICO EN WEB', 1011, 1750, 1, 'V', 'JES', null, null, 'JES', '2026-11-10 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 1999, 9, '9CDEFF9D', '2757904243', null, '2026-11-04', '2026-11-10 08:45:41', '2026-11-04', 339, 339, 'CONSULTORIA GERENCIA Y FINANCIERA', 1011, 4860, 1, 'V', 'JES', null, null, 'JES', '2026-11-10 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2000, 4, '2570D712', '1823165853', null, '2026-11-05', '2026-11-10 08:49:32', '2026-11-05', 1595, 1595, 'SERVICIO DE INTERNET A LA OFIBODEGA 206', 1011, 500, 1, 'V', 'JES', null, null, 'JES', '2026-11-10 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2001, 4, '941ECF64', '1139623470', null, '2026-11-06', '2026-11-10 09:48:06', '2026-11-21', 558, 558, 'compra generada automaticamente para Ingreso 260', 1008, 2250, 1, 'V', 'VNR', null, null, 'VNR', '2026-11-10 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 11, 0, 0, 0, null, null, '260', null, null, null, 40, 4, null, null, 0, 0, 0, 0, 0, 0, 2008.93, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2002, 4, 'CTM2576/26', '1864/EST', null, '2026-10-14', '2026-11-10 15:37:55', '2026-10-14', 50, 50, 'FLETE AEREO CON GASTOS DESDE ALMACEN TODO INCLUIDO Y SERVICIOS DE SEGURO CON UN VALOR DE 920.00 EUROS EQUIVALENTES A $1.104.00 CON UNA TC AL EURO DE 1.20', 1006, 8434.43, 1, 'V', 'JES', null, null, 'JES', '2026-11-10 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 8434.43, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2003, 4, '716C948D', '3923985510', null, '2026-10-04', '2026-11-12 19:32:38', '2026-10-04', 562, 562, 'SERVICIOS CONTRATADOS DE TELEFONIA', 1011, 1330, 1, 'V', 'JES', null, null, 'JES', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2004, 4, 'DB222940', '147672877', null, '2026-10-06', '2026-11-12 19:41:21', '2026-10-06', 1547, 1547, 'SERVICIO DE MTTO MECANIA REALIZADO AL VEHICULO NISSAN PLACA PO484LHF', 1011, 1496.32, 1, 'V', 'JES', null, null, 'JES', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2005, 4, 'D29ECD2D', '309281541', null, '2026-10-08', '2026-11-12 19:53:15', '2026-10-08', 436, 436, 'SERVICIOS PRESTADOS DURANTE LOS PROCESOS DE IMPORTACION DE LA IDEAL', 1006, 1250, 1, 'V', 'JES', null, null, 'JES', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2006, 9, 'D682F5DD', '4052304807', null, '2026-10-13', '2026-11-12 20:05:11', '2026-10-13', 1324, 1324, 'SERVICIOS PROFECIONALES DE CARACTER JURIDICO', 1011, 400, 1, 'V', 'JES', null, null, 'JES', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2007, 9, '6F83A7F1', '1768636719', null, '2026-10-17', '2026-11-12 20:09:09', '2026-10-17', 1743, 1743, 'SERVICIO DEREPARACION DE ESTANTERIA', 1011, 1200, 1, 'V', 'JES', null, null, 'JES', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2008, 4, 'DA851EE2', '1186612014', null, '2026-10-23', '2026-11-12 21:06:19', '2026-10-23', 1767, 1767, 'SERVICIO DE ALIMENTACION', 1014, 1071.8, 1, 'V', 'JES', null, null, 'JES', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2009, 4, '07DF6B4C', '232407422', null, '2026-10-05', '2026-11-12 21:19:49', '2026-10-05', 1547, 1547, 'SERVICIO DE MTTO MECANICA REALIZADA AL NISAN PO484LHF', 1011, 1544.28, 1, 'V', 'JES', null, null, 'JES', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2010, 4, '256B6318', '4002172127', null, '2026-10-27', '2026-11-12 21:25:34', '2026-10-27', 1594, 1594, 'VALVULA DE USO GENERAL DE 1/2 EN BOBINA DE 24 VAC', 1014, 1155, 1, 'V', 'JES', null, null, 'JES', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2011, 4, '1830925259', '1072382783', null, '2026-10-29', '2026-11-12 21:32:44', '2026-10-29', 36, 36, 'SEGURIDAD, ALMACENAJE, MANEJO Y SERVICIOS ADUANERO', 1006, 458.9, 1, 'V', 'JES', null, null, 'JES', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2012, 5, '8858703E', '16466091', null, '2026-10-26', '2026-11-12 21:58:37', '2026-10-26', 598, 598, 'TRABAJOS DE MTTO EN OFIBODEGA 206', 1011, 412.63, 1, 'V', 'JES', null, null, 'JES', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 1, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 44.21, 18.42, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2013, 7, 'E4A87B93', '2077574456', null, '2026-10-05', '2026-11-13 09:46:06', '2026-10-05', 1547, 1547, 'NOTA DE CREDITO DE LA FACT. SERIE 7DF6B4C Y DTE 232407422 CON ID - 2009 DEL 05/10/2026', 1011, 1544.28, 1, 'V', 'JES', null, null, 'JES', '2026-11-13 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2014, 4, 'D8D91F18', '3008709768', null, '2026-11-14', '2026-11-16 09:18:22', '2026-11-29', 558, 558, 'compra generada automaticamente para Ingreso 261', 1008, 40550, 1, 'V', 'VNR', null, null, 'VNR', '2026-11-16 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 11, 0, 0, 0, null, null, '261', null, null, null, 40, 4, null, null, 0, 0, 0, 0, 0, 0, 36205.36, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2015, 4, 'IMP', '26-1003', null, '2026-11-13', '2026-11-17 16:50:07', '2026-11-13', 624, 624, 'compra generada automaticamente para Ingreso 262', 1070, 7006.24, 1, 'V', 'JES', null, null, 'JES', '2026-11-17 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 6, 2026, null, 11, 0, 0, 0, null, null, '262', null, null, null, 40, 9, null, null, 0, 0, 0, 0, 0, 0, 7977.81, 0, 0, null, null, null, null, 'N', 0, null, null),
      (1, 2016, 11, '418941', '588697', null, '2026-10-05', '2026-11-17 17:37:38', '2026-10-05', 1781, 1781, 'SERVICIOS DE CAPACITACION EN LA UNIVERSIDAD POR VALOR DE 821.43 DOLARES ON UNA TC- 7.82', 1011, 6423.58, 1, 'V', 'JES', null, null, 'JES', '2026-11-17 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 6423.58, null, null, null, null, null, 0, true, null, null, null, 8, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, null, null, 'N', 0, null, null)),
  x as (
    insert into public.compras (organizacion_id, localidad_id, numero, tipo_documento, tipo_documento_id, serie, documento, fecha_documento, fecha_ingreso, fecha_vencimiento,
           tipo_tercero, proveedor_id, proveedor_codigo, proveedor_nombre, nit, beneficiario, transaccion_id, descripcion, moneda_id, tipo_cambio, valor_total,
           forma_pago, estado, anulado_por, anulado_en, motivo_anulacion, usuario, mes_presentacion, anio_presentacion, pago_inmediato, dias_credito, factura_original,
           regimen_isr_id, clasificacion_id, galones_super, galones_regular, galones_diesel, exento, retencion, retencion_valor, retencion_formulario, retencion_fecha, orden_compra,
           iva_especial, isr_especial, iva_importacion, turismo_itp, dai, valor_cuenta_ajena,
           origen_anterior, compra_anterior, modulo_factura, numero_cheque, usuario_modifica_anterior, fecha_modifica_anterior, tipo_compra_anterior, poliza_anio, poliza_mes, poliza_numero,
           pct_iva, pct_retencion, propina, fecha_transferencia, clasificacion_pago, usuario_autoriza, tipo_periodo_compra, transaccion_retencion, valor_cambio_anterior,
           documento_anterior, proveedor_anterior, transaccion_anterior, regimen_isr_anterior, fecha_ingreso_anterior, usuario_anula_anterior, fecha_anula_anterior,
           cuenta_bancaria_anterior, transferencia_anterior, banco_anterior, contrasena_anterior, exento_anterior, anio_presentacion_anterior, retencion_valor_anterior, fecha_documento_anterior, fecha_vencimiento_anterior,
           subtotal_anterior, proyecto_anterior, tipo_operacion_anterior, rubro_anterior, tipo_rubro_anterior, cuenta_contable_anterior, centro_costo_anterior, estado_conta_anterior,
           descuentos_anterior, banco_proveedor_anterior, penalizacion_vencimiento_anterior)
    select v_org, l.id, m.compra, case when t.es_recibo then 'RECIBO' else 'FACTURA' end, t.id, m.serie,
           case when m.estado = 'V' and exists (select 1 from public.compras c where c.localidad_id = l.id and c.origen_anterior is null and c.estado = 'ACTIVA'
             and c.tipo_documento = case when t.es_recibo then 'RECIBO' else 'FACTURA' end and upper(coalesce(c.proveedor_codigo, c.proveedor_nombre)) = m.proveedor::text
             and upper(coalesce(c.serie, '')) = coalesce(m.serie, '') and upper(c.documento) = m.documento) then m.documento || ' (MIGRADA)' else m.documento end,
           coalesce(m.fecha_documento, m.fecha_ingreso::date), coalesce(m.fecha_ingreso::date, m.fecha_documento), m.fecha_venc,
           case when m.tipo_compra = 'M' then 'PROVEEDOR PRODUCTOS' else 'PROVEEDOR SERVICIOS' end, p.id, m.proveedor::text,
           upper(coalesce(p.nombre_comercial, 'PROVEEDOR ' || m.proveedor)), p.nit, coalesce(p.beneficiario, upper(p.nombre_comercial)),
           (select x.id from public.transacciones_contables x where x.localidad_id = l.id and x.numero = m.transaccion), m.descripcion, v_gtq, 1, m.valor_total,
           'CHEQUE', case when m.estado = 'A' then 'ANULADA' else 'ACTIVA' end, case when m.estado = 'A' then coalesce(m.usr_anula, 'SISTEMA ANTERIOR') end,
           case when m.estado = 'A' then coalesce(m.f_anula, m.fecha_ingreso) at time zone 'America/Guatemala' end, case when m.estado = 'A' then 'ANULADA EN EL SISTEMA ANTERIOR' end,
           m.usuario, m.mes_pres, m.anio_pres, coalesce(m.pago_inmediato, false),
           case when coalesce(m.pago_inmediato, false) or m.fecha_venc is null then 0 else greatest(m.fecha_venc - coalesce(m.fecha_documento, m.fecha_ingreso::date), 0) end, coalesce(m.original, true),
           (select g.id from public.regimenes_isr g where g.codigo = m.regimen), (select k.id from public.clasificaciones_compra k where k.codigo = m.clasif),
           m.gal_super, m.gal_regular, m.gal_diesel, m.exento, coalesce(m.retencion, false), case when m.retencion then coalesce(m.valor_retencion, 0) else 0 end,
           case when m.retencion then m.formulario end, case when m.retencion then m.fecha_ret end, m.orden_compra,
           m.iva_esp, m.isr_esp, m.iva_imp, m.itp, m.dai, m.cta_ajena,
           'VARIAS', m.compra, m.modulo, m.numero_cheque, m.usr_mod, m.f_mod::date, m.tipo_compra, m.poliza_anio, m.poliza_mes, m.poliza_numero,
           m.pct_iva, m.pct_retencion, m.propina, m.fecha_transf, m.clasif_pago, m.usr_autoriza, m.tipo_periodo, m.trans_ret, m.valor_cambio,
           m.documento_ant, m.proveedor_ant, m.transaccion, m.regimen, m.fecha_ingreso, m.usr_anula, m.f_anula,
           m.cuenta_bancaria, m.transferencia, m.banco, m.contrasena, m.exento_ant, m.anio_pres_ant, m.valor_retencion, m.fecha_doc_ant, m.fecha_venc_ant,
           m.subtotal, m.proyecto, m.tipo_oper, m.rubro, m.tipo_rubro, m.cuenta_cont, m.centro, m.estado_conta, m.descuentos, m.banco_prov, m.penalizacion
    from m
    join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc
    left join public.proveedores p on p.localidad_id = l.id and p.codigo = m.proveedor
    left join public.tipos_documento_compra t on t.codigo = m.tipo_doc
    on conflict (localidad_id, origen_anterior, compra_anterior) where origen_anterior is not null do update set
      tipo_documento = excluded.tipo_documento, tipo_documento_id = excluded.tipo_documento_id, serie = excluded.serie, documento = excluded.documento,
      fecha_documento = excluded.fecha_documento, fecha_ingreso = excluded.fecha_ingreso, fecha_vencimiento = excluded.fecha_vencimiento, tipo_tercero = excluded.tipo_tercero,
      proveedor_id = excluded.proveedor_id, proveedor_codigo = excluded.proveedor_codigo, proveedor_nombre = excluded.proveedor_nombre, nit = excluded.nit, beneficiario = excluded.beneficiario,
      transaccion_id = excluded.transaccion_id, descripcion = excluded.descripcion, valor_total = excluded.valor_total, estado = excluded.estado, anulado_por = excluded.anulado_por,
      anulado_en = excluded.anulado_en, motivo_anulacion = excluded.motivo_anulacion, usuario = excluded.usuario, mes_presentacion = excluded.mes_presentacion,
      anio_presentacion = excluded.anio_presentacion, pago_inmediato = excluded.pago_inmediato, dias_credito = excluded.dias_credito, factura_original = excluded.factura_original,
      regimen_isr_id = excluded.regimen_isr_id, clasificacion_id = excluded.clasificacion_id, exento = excluded.exento, retencion = excluded.retencion, retencion_valor = excluded.retencion_valor,
      retencion_formulario = excluded.retencion_formulario, retencion_fecha = excluded.retencion_fecha, orden_compra = excluded.orden_compra,
      iva_especial = excluded.iva_especial, isr_especial = excluded.isr_especial, iva_importacion = excluded.iva_importacion, turismo_itp = excluded.turismo_itp,
      dai = excluded.dai, valor_cuenta_ajena = excluded.valor_cuenta_ajena, modulo_factura = excluded.modulo_factura,
      numero_cheque = excluded.numero_cheque, usuario_modifica_anterior = excluded.usuario_modifica_anterior, fecha_modifica_anterior = excluded.fecha_modifica_anterior,
      tipo_compra_anterior = excluded.tipo_compra_anterior, poliza_anio = excluded.poliza_anio, poliza_mes = excluded.poliza_mes, poliza_numero = excluded.poliza_numero,
      pct_iva = excluded.pct_iva, pct_retencion = excluded.pct_retencion, propina = excluded.propina, fecha_transferencia = excluded.fecha_transferencia,
      clasificacion_pago = excluded.clasificacion_pago, usuario_autoriza = excluded.usuario_autoriza, tipo_periodo_compra = excluded.tipo_periodo_compra,
      transaccion_retencion = excluded.transaccion_retencion, valor_cambio_anterior = excluded.valor_cambio_anterior, documento_anterior = excluded.documento_anterior,
      proveedor_anterior = excluded.proveedor_anterior, transaccion_anterior = excluded.transaccion_anterior, regimen_isr_anterior = excluded.regimen_isr_anterior,
      fecha_ingreso_anterior = excluded.fecha_ingreso_anterior, usuario_anula_anterior = excluded.usuario_anula_anterior, fecha_anula_anterior = excluded.fecha_anula_anterior,
      cuenta_bancaria_anterior = excluded.cuenta_bancaria_anterior, transferencia_anterior = excluded.transferencia_anterior, banco_anterior = excluded.banco_anterior,
      contrasena_anterior = excluded.contrasena_anterior, exento_anterior = excluded.exento_anterior, anio_presentacion_anterior = excluded.anio_presentacion_anterior,
      retencion_valor_anterior = excluded.retencion_valor_anterior, fecha_documento_anterior = excluded.fecha_documento_anterior,
      fecha_vencimiento_anterior = excluded.fecha_vencimiento_anterior, subtotal_anterior = excluded.subtotal_anterior, proyecto_anterior = excluded.proyecto_anterior,
      tipo_operacion_anterior = excluded.tipo_operacion_anterior, rubro_anterior = excluded.rubro_anterior, tipo_rubro_anterior = excluded.tipo_rubro_anterior,
      cuenta_contable_anterior = excluded.cuenta_contable_anterior, centro_costo_anterior = excluded.centro_costo_anterior, estado_conta_anterior = excluded.estado_conta_anterior,
      descuentos_anterior = excluded.descuentos_anterior, banco_proveedor_anterior = excluded.banco_proveedor_anterior,
      penalizacion_vencimiento_anterior = excluded.penalizacion_vencimiento_anterior
    returning (xmax = 0) as nueva, documento like '% (MIGRADA)' as migrada)
  select count(*) filter (where nueva), count(*) filter (where not nueva), count(*) filter (where migrada) into v_n, v_a, v_doc from x;
  alter table public.compras enable trigger compras_preparar;
  perform set_config('fin.migracion', '', true);

  raise notice '%', format('Compras de la organización 4 (parte 1 de 2): %s nuevas, %s actualizadas.%s%s%s%s',
    v_n, v_a,
    case when v_ren > 0 then format(' %s compras registradas en el sistema pasaron a números después de las migradas.', v_ren) else '' end,
    case when v_prov > 0 then format(' %s proveedores creados (no venían en ACT_PROVEEDORES).', v_prov) else '' end,
    case when v_reg > 0 then format(' %s regímenes ISR creados.', v_reg) else '' end,
    case when v_doc > 0 then format(' %s documentos ya registrados en el sistema llevan « (MIGRADA)».', v_doc) else '' end);
end;
$compras$;

-- Script 275 · parte 2 de 2 · Organización 7 (AAPOS): compras (ACT_COMPRAS.xlsx), 58 compras (de 7-01 2051 a 7-01 2108).
-- Se ejecuta después de la parte 0 y del script 225 (proveedores). Se puede ejecutar de nuevo: la segunda vez solo actualiza.
-- Si la tabla de compras está ocupada por otra consulta, falla a los 20 segundos en vez de quedarse esperando.
set lock_timeout = '20s';

do $compras$
declare
  v_org bigint; v_gtq bigint; v_l record; v_n int := 0; v_a int := 0; v_ren int := 0; v_k int; v_prov int := 0; v_reg int := 0; v_doc int := 0;
begin
  select id into v_org from public.organizaciones where codigo::text = '7';
  if v_org is null then raise exception 'No existe la organización 7: ejecuta antes el script 221.'; end if;
  select id into v_gtq from public.monedas where iso = 'GTQ';
  -- Carga de datos históricos: los períodos fiscales cerrados no la bloquean.
  perform set_config('fin.migracion', 'si', true);
  -- La numeración y el estado vienen del archivo: el trigger que los asigna se suspende durante la carga.
  alter table public.compras disable trigger compras_preparar;

  -- a) Las compras que no vienen del sistema anterior pasan a números después del último del archivo
  --    (7-01 hasta 2108), para que cada compra migrada conserve su número.
  for v_l in select l.id, x.maximo from (values (1, 2108)) as x(loc, maximo)
             join public.localidades l on l.organizacion_id = v_org and l.correlativo = x.loc loop
    update public.compras c set numero = greatest((select coalesce(max(numero), 0) from public.compras where localidad_id = v_l.id), v_l.maximo) + q.fila
    from (select id, row_number() over (order by numero) as fila from public.compras
          where localidad_id = v_l.id and (origen_anterior is null or origen_anterior <> 'VARIAS') and numero <= v_l.maximo) q
    where c.id = q.id;
    get diagnostics v_k = row_count; v_ren := v_ren + v_k;
  end loop;

  -- b) Regímenes ISR y proveedores que usan las compras y no existen: se crean (el proveedor, para revisarlo).
  insert into public.regimenes_isr (codigo, nombre)
  select x.c, 'RÉGIMEN ISR ' || x.c || ' (CREADO AL MIGRAR PROVEEDORES)' from unnest(array[1, 3, 4, 8, 9]) as x(c)
  where not exists (select 1 from public.regimenes_isr g where g.codigo = x.c);
  get diagnostics v_reg = row_count;
  insert into public.proveedores (organizacion_id, localidad_id, codigo, nombre_comercial, concepto_gastos, pendiente_revisar)
  select v_org, l.id, x.codigo, case when x.codigo = 999999 then 'SIN PROVEEDOR ASIGNADO' else 'PROVEEDOR ' || x.codigo || ' (CREADO AL MIGRAR COMPRAS)' end, 'POR DEFINIR', true
  from (values (1, 35), (1, 172), (1, 770), (1, 792), (1, 793), (1, 794), (1, 53), (1, 250), (1, 619), (1, 51), (1, 661), (1, 577), (1, 362), (1, 74), (1, 621), (1, 719), (1, 3), (1, 412), (1, 517), (1, 363), (1, 384), (1, 720), (1, 721), (1, 743), (1, 618), (1, 40), (1, 600), (1, 469), (1, 361), (1, 512), (1, 396), (1, 81), (1, 44), (1, 73), (1, 189), (1, 270), (1, 511), (1, 127), (1, 799), (1, 66), (1, 256), (1, 800), (1, 801), (1, 802), (1, 437), (1, 345), (1, 632), (1, 576), (1, 65), (1, 183), (1, 803)) as x(loc, codigo)
  join public.localidades l on l.organizacion_id = v_org and l.correlativo = x.loc
  where not exists (select 1 from public.proveedores p where p.localidad_id = l.id and p.codigo = x.codigo);
  get diagnostics v_prov = row_count;

  -- c) Las compras. ESTADO V/A = ACTIVA/ANULADA; TIPO_COMPRA M/V = proveedor de productos/servicios; quetzales con cambio 1
  --    (VALOR_CAMBIO queda en valor_cambio_anterior); FECHA_ESTIMADA_PAGO = fecha de vencimiento; CALCULAR_RETENCION S/N.
  --    IVA_ESPECIAL, ISR_ESPECIAL, IVA_IMPORTACION, ITP (turismo), DAI y VALOR_CTA_AJENA van a sus columnas.
  --    Documento que ya tiene otra compra vigente registrada en el sistema (p. ej. cargada de la SAT): se le agrega « (MIGRADA)».
  with m (loc, compra, tipo_doc, serie, documento, documento_ant, fecha_documento, fecha_ingreso, fecha_venc, proveedor, proveedor_ant, descripcion, transaccion, valor_total, valor_cambio, estado, usuario, usr_anula, f_anula, usr_mod, f_mod, tipo_compra, poliza_anio, poliza_mes, poliza_numero, pct_iva, pct_retencion, valor_retencion, retencion, formulario, exento, exento_ant, propina, transferencia, fecha_transf, banco, clasif_pago, original, contrasena, cuenta_bancaria, numero_cheque, regimen, anio_pres, anio_pres_ant, mes_pres, gal_super, gal_regular, gal_diesel, trans_ret, fecha_ret, orden_compra, usr_autoriza, tipo_periodo, pago_inmediato, modulo, clasif, fecha_doc_ant, fecha_venc_ant, iva_esp, isr_esp, iva_imp, itp, dai, cta_ajena, subtotal, proyecto, tipo_oper, rubro, tipo_rubro, cuenta_cont, centro, estado_conta, descuentos, banco_prov, penalizacion) as (values
      (1::integer, 2051::integer, 4::integer, '5551AE71'::text, '4139535625'::text, null::text, '2026-11-04'::date, '2026-11-09 11:44:06'::timestamp, '2026-11-04'::date, 35::integer, 35::integer, 'POR LA VENTA DE 102.8 TALONARIOS RIFA UN MILLON DE AMIGOS 2026 SUPER 24'::text, 1103::integer, 7710::numeric, 1::numeric, 'V'::text, 'HEM'::text, null::text, null::timestamp, 'HEM'::text, '2026-11-09 00:00:00'::timestamp, 'V'::text, null::integer, null::integer, null::integer, 12::numeric, 5::numeric, 0::numeric, false::boolean, null::text, 0::numeric, null::numeric, null::numeric, null::text, null::date, null::integer, 0::integer, true::boolean, null::text, null::text, null::text, 4::integer, 2026::integer, null::integer, 11::integer, 0::numeric, 0::numeric, 0::numeric, null::integer, null::date, null::text, null::text, 'C'::text, true::boolean, 10::integer, 2::integer, null::text, null::text, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 1::integer, 2::integer, 22401::integer, 'E'::text, '5201'::text, '52010126'::text, 'N'::text, 0::numeric, null::integer, null::numeric),
      (1, 2052, 11, '88F472BF', '65424519', null, '2026-10-31', '2026-11-10 09:00:58', '2026-10-31', 172, 172, 'PLANILLA DE PROYECTO CALIDAD DE VIDA III CORRESPONDIENTE A MES DE OCTUBRE 2026', 1103, 323784.04, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-10 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 6, null, null, 0, 0, 0, 0, 0, 0, 0, 4, 9, 22401, 'E', null, null, 'N', 0, null, null),
      (1, 2053, 4, 'D50FD7B7', '1268926420', null, '2026-10-30', '2026-11-10 14:25:58', '2026-10-30', 770, 770, 'ELABORACION DE MANTAS VINILICAS PARA EL EVENTO SUBASTA 2026 EN CASA DEL RON', 1103, 655, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-10 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 9, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 2, null, null, null, null, 'N', 0, null, null),
      (1, 2054, 4, 'E230C48A', '1089228158', null, '2026-10-27', '2026-11-10 14:39:57', '2026-10-27', 792, 792, 'ELABORACION DE RECONOCIMIENTOS PARA ENTREGA EN EL EVENTO SUBASTA 2026 EN CASA DEL RON', 1103, 1944, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-10 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 9, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 2, null, null, null, null, 'N', 0, null, null),
      (1, 2055, 4, 'AC4BB340', '2527611889', null, '2026-10-27', '2026-11-10 14:48:22', '2026-10-27', 793, 793, 'AMENIZACION CON SAXOFON EN VIVO 1 HORA EVENTO SUBASTA 2026 EN CASA DEL RON', 1103, 1600, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-10 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 2, null, null, null, null, 'N', 0, null, null),
      (1, 2056, 4, 'BA62E56A', '3238150816', null, '2026-10-30', '2026-11-10 15:07:27', '2026-10-30', 794, 794, 'COMPRA DE ACCESORIOS PARA EL MONTAJE DE EXPOSICIÓN DE OBRAS DE ARTE PARA SUBASTA 2026 EN CASA DEL RON', 1103, 6089.67, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-10 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 2, null, null, null, null, 'N', 0, null, null),
      (1, 2057, 4, '42F4AA06', '1402618658', null, '2026-11-10', '2026-11-12 08:39:57', '2026-11-10', 53, 53, 'ARRENDAMIENTO DE OF. 2-2 Y PARQUEOS 50,51,28 Y 44 POR EL MES DE NOVIEMBRE 2026 DLS. 1,858.24 T.C. Q. 7.63846', 1103, 14194.07, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 1, 2, 21401, 'E', '5201', '52010116', 'N', 0, null, null),
      (1, 2058, 4, '80F13F18', '2883797945', null, '2026-11-10', '2026-11-12 09:05:58', '2026-11-10', 250, 250, 'BONIFICACION RIFA 1 MILLON DE AMIGOS 2026 POR LA VENTA DE TICKETS', 1103, 26437.5, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-18 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 1, 2, 22401, 'E', '5201', '52010126', 'N', 0, null, null),
      (1, 2059, 4, '7C9002C4', '1872839302', null, '2026-11-05', '2026-11-12 09:49:10', '2026-11-05', 619, 619, 'POR LA VENTA DE ARTESANIAS EN EL MES DE OCTUBRE 2026', 1103, 504, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20667, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2060, 4, '9FA02BB5', '1686849141', null, '2026-11-06', '2026-11-12 09:55:01', '2026-11-06', 51, 51, 'POR LA VENTA DE LLAVEROS, PAÑUELOS Y PINES EN EL MES DE OCTUBRE 2026', 1103, 580, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 1, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20658, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2061, 9, '9DF1C598', '934167023', null, '2026-11-04', '2026-11-12 09:59:49', '2026-11-04', 661, 661, 'POR LA VENTA DE POSTALES DE GUATEMALA EN EL MES DE OCTUBRE 2026', 1103, 826.5, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20625, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2062, 11, 'F6BF9C60', '964576996', null, '2026-11-05', '2026-11-12 10:03:47', '2026-11-05', 577, 577, 'POR LA VENTA DE LIBROS EN EL MES DE OCTUBRE 2026', 1103, 950, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 8, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 3, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20641, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2063, 9, '6CC6FDFF', '938296339', null, '2026-11-04', '2026-11-12 10:08:00', '2026-11-04', 362, 362, 'POR LA VENTA DE BUFFSS EN EL MES DE OCTUBRE 2026', 1103, 195, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20656, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2064, 4, 'F6E96481', '1937588761', null, '2026-11-09', '2026-11-12 10:10:09', '2026-11-09', 74, 74, 'POR LA VENTA DE PLAYERAS EN EL MES DE OCTUBRE 2026', 1103, 200, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 1, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20601, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2065, 11, '63-A2', '01112026', null, '2026-11-09', '2026-11-12 10:13:10', '2026-11-09', 621, 621, 'POR LA VENTA DE LIBROS EN LOS MESES DE SEPTIEMBRE Y OCTUBRE 2026', 1103, 1200, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 8, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 3, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20641, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2066, 4, '63-A2', '02112026', null, '2026-11-09', '2026-11-12 10:17:52', '2026-11-09', 621, 621, 'POR LA VENTA DE LIBROS EN LOS MESES DE SEPTIEMBRE Y OCTUBRE 2026', 1103, 1036, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 8, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 3, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20641, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2067, 11, '63-A2', '03112026', null, '2026-11-09', '2026-11-12 10:19:39', '2026-11-09', 621, 621, 'POR LA VENTA DE LIBROS EN LOS MESES DE SEPTIEMBRE Y OCTUBRE 2026', 1103, 714, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 8, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 3, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20641, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2068, 9, '5F98A795', '1076973187', null, '2026-11-04', '2026-11-12 10:22:09', '2026-11-04', 719, 719, 'POR LA VENTA DE IMPRESIONES VARIOS TAMAÑOS EN EL MES DE OCTUBRE 2026', 1103, 500, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20648, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2069, 9, '247E8D7C', '1254573802', null, '2026-11-10', '2026-11-12 10:24:48', '2026-11-10', 3, 3, 'POR LA VENTA DE ALMOHADAS, COSMETIQUERAS, ENMARCADOS Y MONEDEROS EN EL MES DE OCTUBRE 2026', 1103, 2427, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20658, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2070, 9, '2409E6F3', '3352316198', null, '2026-11-06', '2026-11-12 10:28:23', '2026-11-06', 412, 412, 'POR LA VENTA DE BILLETERAS Y CINCHOS DE CUERO EN EL MES DE OCTUBRE 2026', 1103, 600, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20658, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2071, 4, 'AA42BAE2', '4232791892', null, '2026-11-04', '2026-11-12 10:33:33', '2026-11-04', 517, 517, 'POR LA VENTA DE POSTALES EN EL MES DE OCTUBRE 2026', 1103, 390, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 9, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20625, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2072, 4, '70152049', '3363260351', null, '2026-11-10', '2026-11-12 10:35:21', '2026-11-10', 363, 363, 'POR LA VENTA DE LIBROS EN EL MES DE OCTUBRE 2026', 1103, 530, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 9, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20641, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2073, 9, '7CF529B6', '989417033', null, '2026-11-06', '2026-11-12 10:46:48', '2026-11-06', 384, 384, 'POR LA VENTA DE BOLSAS, BUFFS, GORRAS, LLAVEROS, PLAYERAS, STICKERS, SUDADEROS Y VASOS EN EL MES DE OCTUBRE 2026', 1103, 8052, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20658, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2074, 9, 'B1158024', '1676234140', null, '2026-11-05', '2026-11-12 10:51:22', '2026-11-05', 720, 720, 'POR LA VENTA DE STICKERS GRANDES Y PEQUEÑOS EN EL MES DE OCTUBRE 2026', 1103, 820, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20628, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2075, 9, 'CA7E0030', '297814869', null, '2026-11-06', '2026-11-12 10:55:45', '2026-11-06', 721, 721, 'POR LA VENTA DE PINES, STICKERS, BOLSAS Y PLAYERAS EN EL MES DE OCTUBRE 2026', 1103, 6073, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20658, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2076, 9, '992C8045', '3419750831', null, '2026-11-05', '2026-11-12 11:08:02', '2026-11-05', 743, 743, 'POR LA VENTA DE LIBRETAS, POSTALES Y STICKERS EN EL MES DE OCTUBRE 2026', 1103, 621, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20658, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2077, 9, '1391E1E0', '587942869', null, '2026-11-05', '2026-11-12 12:37:51', '2026-11-05', 618, 618, 'POR LA VENTA DE ARTE REALIZADA EN MADERA EN EL MES DE OCTUBRE 2026', 1103, 849, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20666, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2078, 9, '3A0F36E2', '2673756109', null, '2026-11-08', '2026-11-12 12:40:44', '2026-11-08', 40, 40, 'POR LA VENTA DE BLOCK DE NOTAS, POSTALES, STICKERS, TAPE Y TAZAS EN EL MES DE OCTUBRE 2026', 1103, 1715, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20658, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2079, 9, '17DD477E', '691554666', null, '2026-11-05', '2026-11-12 14:13:43', '2026-11-05', 600, 600, 'POR LA VENTA DE JABONES ARTESANALES EN EL MES DE OCTUBRE 2026', 1103, 105, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20639, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2080, 4, 'D686E316', '259148976', null, '2026-11-05', '2026-11-12 14:15:54', '2026-11-05', 469, 469, 'POR LA VENTAS DE VASOS POR UNIDAD Y 4 PACK CON SERIGRAFIA EN EL MES DE OCTUBRE 2026', 1103, 378, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20670, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2081, 4, '4057D381', '2286111524', null, '2026-11-06', '2026-11-12 14:20:02', '2026-11-06', 361, 361, 'POR LA VENTA DE TARJETAS TIPICAS EN EL MES DE OCTUBRE 2026', 1103, 542, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 9, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20660, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2082, 4, '72369439', '1885817382', null, '2026-11-06', '2026-11-12 14:22:46', '2026-11-06', 512, 512, 'POR LA VENTA DE LIBROS POPOL VUH INFANTILES EN EL MES DE OCTUBRE 2026', 1103, 1064, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 9, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20641, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2083, 9, 'D37BD27A', '1093944371', null, '2026-11-10', '2026-11-12 14:25:21', '2026-11-10', 396, 396, 'POR LA VENTA DE ARETES EN MATERIAL RECICLADO EN EL MES DE OCTUBRE 2026', 1103, 200, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20647, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2084, 4, '867E0DE6', '510152215', null, '2026-11-06', '2026-11-12 14:27:27', '2026-11-06', 81, 81, 'POR LA VENTA DE IMPRESIONES Y POSTALES EN EL MES DE OCTUBRE 2026', 1103, 2211.18, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 9, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20648, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2085, 4, 'BF3BD6F4', '2028028723', null, '2026-11-07', '2026-11-12 14:30:09', '2026-11-07', 44, 44, 'POR LA VENTA DE LIBROS, CALENDARIOS, MAGNETOS, SEPARADORES, ACUARELAS Y POSTALES EN EL MES DE OCTUBRE 2026', 1103, 1101, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 1, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20658, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2086, 9, '26FEDF33', '1251363194', null, '2026-11-10', '2026-11-12 14:34:36', '2026-11-10', 73, 73, 'POR LA VENTA DE ARETES, COLAS Y MONEDEROS EN EL MES DE OCTUBRE 2026', 1103, 270, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20658, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2087, 9, 'AB14D701', '1402947313', null, '2026-11-05', '2026-11-12 14:52:15', '2026-11-05', 189, 189, 'POR LA VENTA DE POSTALES Y STICKERS HOLOGRAFICOS EN EL MES DE OCTUBRE 2026', 1103, 345, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20658, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2088, 9, '45CA27D6', '1755070537', null, '2026-11-09', '2026-11-12 14:54:37', '2026-11-09', 270, 270, 'POR LA VENTA DE IMANES, LIBRETAS, PINES Y PORTAVASOS EN EL MES DE OCTUBRE 2026', 1103, 1870, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20658, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2089, 4, '5D0DC2BF', '663109727', null, '2026-11-06', '2026-11-12 14:57:28', '2026-11-06', 511, 511, 'POR LA VENTA DE BLCK DE NOTAS, CUADERNOS, IMANES, EMPAQUE, SEPRADORES, STICKERS Y FLASCARDS EN EL MES DE OCTUBRE 2026', 1103, 2355.95, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 9, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20658, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2090, 11, '0C6A5304', '1402552731', null, '2026-11-06', '2026-11-12 15:11:37', '2026-11-06', 127, 127, 'POR LA VENTA DE LIBRO GUATEMALA INMORATAL EN EL MES DE OCTUBRE 2026.', 1103, 790, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-12 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 8, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 3, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20641, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2091, 9, 'EA032B55', '4107551662', null, '2026-11-05', '2026-11-13 10:13:22', '2026-11-05', 799, 799, 'COMPRA DE MAZOS DE JUSTICIA DE MADERA PARA USO EN SUBASTA 2026', 1103, 550, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-13 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 2, null, null, null, null, 'N', 0, null, null),
      (1, 2092, 9, 'A3AD3930', '3780331852', null, '2026-11-03', '2026-11-13 10:17:44', '2026-11-03', 66, 66, 'SERVICIO DE TRANSPORTE DE PANELES DE MADERA DE ANTIGUA GUATEMALA A CASA DEL RON ZONA 10 GASTOS DE SUBASTA 2026', 1103, 1400, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-13 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 2, null, null, null, null, 'N', 0, null, null),
      (1, 2093, 4, '645FE689', '3687860521', null, '2026-11-03', '2026-11-13 10:28:58', '2026-11-03', 256, 256, 'COMPRA DE ROUTER M7000-TP-LINK CON BATERIA PARA 8 HORAS USO CHIP TIGO CONECTAR POS EN USO SUBASTE 2026', 1103, 895, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-13 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 2, null, null, null, null, 'N', 0, null, null),
      (1, 2094, 11, '89510372', '2213628802', null, '2026-11-10', '2026-11-13 10:45:31', '2026-11-10', 800, 800, 'DONACION POR EL MONTAJE Y DESMONTAJE DEL EVENTO SUBASTA 2026 EN CASA DEL RON', 1103, 7000, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-13 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 8, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 6, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 9, null, null, null, null, 'N', 0, null, null),
      (1, 2095, 4, 'E0BC2471', '2103070263', null, '2026-11-09', '2026-11-13 11:16:45', '2026-11-09', 801, 801, 'SERVICIO DE AMPLIFICACION DE AUDIO EN EL EVENTO SUBASTA 2026 EN CASA DEL RON', 1103, 1500, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-13 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 9, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 2, null, null, null, null, 'N', 0, null, null),
      (1, 2096, 4, '1195C940', '2859617868', null, '2026-11-09', '2026-11-13 11:29:49', '2026-11-09', 802, 802, 'ALQUILER DE MOBILIARIO EN EL EVENTO SUBASTA 2026 EN CASA DEL RON', 1103, 1410, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-13 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 9, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 2, null, null, null, null, 'N', 0, null, null),
      (1, 2097, 4, '5C37F084', '1825065816', null, '2026-11-02', '2026-11-13 11:42:18', '2026-11-02', 437, 437, 'REINTEGRO DE GASTOS: COMPRA DE 4 RADIOS Y 8 MANOS LIBRES SILICON USO EN SUBASTA 2026 RELIZADO EN CASA DEL RON', 1103, 3596.04, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-13 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 2, null, null, null, null, 'N', 0, null, null),
      (1, 2098, 4, '21C53FB7', '3500625030', null, '2026-11-02', '2026-11-13 11:47:57', '2026-11-02', 345, 345, 'COMPRA DE COMIDA PERSONAL DEL MONTAJE DEL EVENTO SUBASTA 2026 EN CASA DEL RON', 1103, 156, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-13 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 2, null, null, null, null, 'N', 0, null, null),
      (1, 2099, 4, '23AC54CC', '2274315551', null, '2026-11-02', '2026-11-13 11:54:06', '2026-11-02', 345, 345, 'COMPRA DE COMIDA PERSONAL DEL MONTAJE DEL EVENTO SUBASTA 2026 EN CASA DEL RON', 1103, 300, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-13 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 2, null, null, null, null, 'N', 0, null, null),
      (1, 2100, 4, '122IEB67', '42481859', null, '2026-11-02', '2026-11-13 11:55:45', '2026-11-02', 632, 632, 'COMPRA DE ACCESORIOS Y MATERIALES EN MONTAJE DEL EVENTO SUBASTA 2026 EN CASA DEL RON', 1103, 503.5, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-13 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 2, null, null, null, null, 'N', 0, null, null),
      (1, 2101, 4, '575C981F', '4010098992', null, '2026-11-02', '2026-11-13 12:02:27', '2026-11-02', 576, 576, 'COMPRA DE COMIDA PERSONAL DEL MONTAJE DEL EVENTO SUBASTA 2026 EN CASA DEL RON', 1103, 1791.82, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-13 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 2, null, null, null, null, 'N', 0, null, null),
      (1, 2102, 9, '5577D841', '912805119', null, '2026-11-10', '2026-11-13 13:14:17', '2026-11-10', 66, 66, 'SERVICIO DE TRANSPORTE DE PANELES DE MADERA DE CASA DEL RON ZONA 10 PARA LA ANTIGUA GUATEMALA FINALIZACION EVENTO SUBASTA 2026', 1103, 1400, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-13 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 2, null, null, null, null, 'N', 0, null, null),
      (1, 2103, 9, '742DA307', '326455133', null, '2026-11-09', '2026-11-13 13:19:21', '2026-11-09', 66, 66, 'SERVICIO DE TRANSPORTE DE OBRAS DE ARTE DE LA CASA DEL RON ZONA 10 PARA LA CAÑADA ZONA 14 FINALIZACION EVENTO SUBASTA 2026', 1103, 900, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-13 00:00:00', 'V', null, null, null, 0, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 10, null, null, 0, 0, 0, 0, 0, 0, 0, 10, 2, null, null, null, null, 'N', 0, null, null),
      (1, 2104, 4, '1E382384', '3217769245', null, '2026-11-12', '2026-11-16 08:26:41', '2026-11-12', 65, 65, 'POR LA VENTA DE ENCENDEDORES VARIAS PRESENTACIONES EN EL MES DE OCTUBRE 2026', 1103, 24, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-16 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 4, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 3, 2, 20658, 'E', '5201', '52010342', 'N', 0, null, null),
      (1, 2105, 4, '33848637', '2149994475', null, '2026-10-22', '2026-11-16 09:19:05', '2026-10-22', 183, 183, 'ARRENDAMIENTO DE BODEGA Z04081 DEL 22/10/2026 AL 21/11/2026', 1103, 1594, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-16 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 1, 2, 21401, 'E', '5201', '52010116', 'N', 0, null, null),
      (1, 2106, 4, 'A4AF6043', '349849168', null, '2026-10-06', '2026-11-16 09:26:31', '2026-10-06', 183, 183, 'ARRENDAMIENTO DE BODEGA Z04126 DEL 06/10/2026 AL 05/11/2026', 1103, 1432, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-16 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 2, null, null, 0, 0, 0, 0, 0, 0, 0, 1, 2, 21401, 'E', '5201', '52010116', 'N', 0, null, null),
      (1, 2107, 4, '3D70B521', '1759726752', null, '2026-10-23', '2026-11-16 09:54:44', '2026-10-23', 803, 803, 'COMPRA MOTO ITALIKA CHASIS LLCLP1CC2VE100124 MODELO 2027 BONIFICACIONES BANCO INDUSTRIAL 2026', 1103, 8500, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-16 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 10, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 1, 2, 22201, 'E', '5201', '52010127', 'N', 0, null, null),
      (1, 2108, 4, 'AFF4FD31', '379470078', null, '2026-10-23', '2026-11-16 10:00:29', '2026-10-23', 803, 803, 'COMPRA MOTO ITALIKA CHASIS LLCLP1CC9VE100251 MODELO 2027 BONIFICACIONES BANCO INDUSTRIAL 2026', 1103, 8500, 1, 'V', 'HEM', null, null, 'HEM', '2026-11-16 00:00:00', 'V', null, null, null, 12, 5, 0, false, null, 0, null, null, null, null, null, 0, true, null, null, null, 3, 2026, null, 11, 0, 0, 0, null, null, null, null, 'C', true, 10, 4, null, null, 0, 0, 0, 0, 0, 0, 0, 1, 2, 22201, 'E', '5201', '52010127', 'N', 0, null, null)),
  x as (
    insert into public.compras (organizacion_id, localidad_id, numero, tipo_documento, tipo_documento_id, serie, documento, fecha_documento, fecha_ingreso, fecha_vencimiento,
           tipo_tercero, proveedor_id, proveedor_codigo, proveedor_nombre, nit, beneficiario, transaccion_id, descripcion, moneda_id, tipo_cambio, valor_total,
           forma_pago, estado, anulado_por, anulado_en, motivo_anulacion, usuario, mes_presentacion, anio_presentacion, pago_inmediato, dias_credito, factura_original,
           regimen_isr_id, clasificacion_id, galones_super, galones_regular, galones_diesel, exento, retencion, retencion_valor, retencion_formulario, retencion_fecha, orden_compra,
           iva_especial, isr_especial, iva_importacion, turismo_itp, dai, valor_cuenta_ajena,
           origen_anterior, compra_anterior, modulo_factura, numero_cheque, usuario_modifica_anterior, fecha_modifica_anterior, tipo_compra_anterior, poliza_anio, poliza_mes, poliza_numero,
           pct_iva, pct_retencion, propina, fecha_transferencia, clasificacion_pago, usuario_autoriza, tipo_periodo_compra, transaccion_retencion, valor_cambio_anterior,
           documento_anterior, proveedor_anterior, transaccion_anterior, regimen_isr_anterior, fecha_ingreso_anterior, usuario_anula_anterior, fecha_anula_anterior,
           cuenta_bancaria_anterior, transferencia_anterior, banco_anterior, contrasena_anterior, exento_anterior, anio_presentacion_anterior, retencion_valor_anterior, fecha_documento_anterior, fecha_vencimiento_anterior,
           subtotal_anterior, proyecto_anterior, tipo_operacion_anterior, rubro_anterior, tipo_rubro_anterior, cuenta_contable_anterior, centro_costo_anterior, estado_conta_anterior,
           descuentos_anterior, banco_proveedor_anterior, penalizacion_vencimiento_anterior)
    select v_org, l.id, m.compra, case when t.es_recibo then 'RECIBO' else 'FACTURA' end, t.id, m.serie,
           case when m.estado = 'V' and exists (select 1 from public.compras c where c.localidad_id = l.id and c.origen_anterior is null and c.estado = 'ACTIVA'
             and c.tipo_documento = case when t.es_recibo then 'RECIBO' else 'FACTURA' end and upper(coalesce(c.proveedor_codigo, c.proveedor_nombre)) = m.proveedor::text
             and upper(coalesce(c.serie, '')) = coalesce(m.serie, '') and upper(c.documento) = m.documento) then m.documento || ' (MIGRADA)' else m.documento end,
           coalesce(m.fecha_documento, m.fecha_ingreso::date), coalesce(m.fecha_ingreso::date, m.fecha_documento), m.fecha_venc,
           case when m.tipo_compra = 'M' then 'PROVEEDOR PRODUCTOS' else 'PROVEEDOR SERVICIOS' end, p.id, m.proveedor::text,
           upper(coalesce(p.nombre_comercial, 'PROVEEDOR ' || m.proveedor)), p.nit, coalesce(p.beneficiario, upper(p.nombre_comercial)),
           (select x.id from public.transacciones_contables x where x.localidad_id = l.id and x.numero = m.transaccion), m.descripcion, v_gtq, 1, m.valor_total,
           'CHEQUE', case when m.estado = 'A' then 'ANULADA' else 'ACTIVA' end, case when m.estado = 'A' then coalesce(m.usr_anula, 'SISTEMA ANTERIOR') end,
           case when m.estado = 'A' then coalesce(m.f_anula, m.fecha_ingreso) at time zone 'America/Guatemala' end, case when m.estado = 'A' then 'ANULADA EN EL SISTEMA ANTERIOR' end,
           m.usuario, m.mes_pres, m.anio_pres, coalesce(m.pago_inmediato, false),
           case when coalesce(m.pago_inmediato, false) or m.fecha_venc is null then 0 else greatest(m.fecha_venc - coalesce(m.fecha_documento, m.fecha_ingreso::date), 0) end, coalesce(m.original, true),
           (select g.id from public.regimenes_isr g where g.codigo = m.regimen), (select k.id from public.clasificaciones_compra k where k.codigo = m.clasif),
           m.gal_super, m.gal_regular, m.gal_diesel, m.exento, coalesce(m.retencion, false), case when m.retencion then coalesce(m.valor_retencion, 0) else 0 end,
           case when m.retencion then m.formulario end, case when m.retencion then m.fecha_ret end, m.orden_compra,
           m.iva_esp, m.isr_esp, m.iva_imp, m.itp, m.dai, m.cta_ajena,
           'VARIAS', m.compra, m.modulo, m.numero_cheque, m.usr_mod, m.f_mod::date, m.tipo_compra, m.poliza_anio, m.poliza_mes, m.poliza_numero,
           m.pct_iva, m.pct_retencion, m.propina, m.fecha_transf, m.clasif_pago, m.usr_autoriza, m.tipo_periodo, m.trans_ret, m.valor_cambio,
           m.documento_ant, m.proveedor_ant, m.transaccion, m.regimen, m.fecha_ingreso, m.usr_anula, m.f_anula,
           m.cuenta_bancaria, m.transferencia, m.banco, m.contrasena, m.exento_ant, m.anio_pres_ant, m.valor_retencion, m.fecha_doc_ant, m.fecha_venc_ant,
           m.subtotal, m.proyecto, m.tipo_oper, m.rubro, m.tipo_rubro, m.cuenta_cont, m.centro, m.estado_conta, m.descuentos, m.banco_prov, m.penalizacion
    from m
    join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc
    left join public.proveedores p on p.localidad_id = l.id and p.codigo = m.proveedor
    left join public.tipos_documento_compra t on t.codigo = m.tipo_doc
    on conflict (localidad_id, origen_anterior, compra_anterior) where origen_anterior is not null do update set
      tipo_documento = excluded.tipo_documento, tipo_documento_id = excluded.tipo_documento_id, serie = excluded.serie, documento = excluded.documento,
      fecha_documento = excluded.fecha_documento, fecha_ingreso = excluded.fecha_ingreso, fecha_vencimiento = excluded.fecha_vencimiento, tipo_tercero = excluded.tipo_tercero,
      proveedor_id = excluded.proveedor_id, proveedor_codigo = excluded.proveedor_codigo, proveedor_nombre = excluded.proveedor_nombre, nit = excluded.nit, beneficiario = excluded.beneficiario,
      transaccion_id = excluded.transaccion_id, descripcion = excluded.descripcion, valor_total = excluded.valor_total, estado = excluded.estado, anulado_por = excluded.anulado_por,
      anulado_en = excluded.anulado_en, motivo_anulacion = excluded.motivo_anulacion, usuario = excluded.usuario, mes_presentacion = excluded.mes_presentacion,
      anio_presentacion = excluded.anio_presentacion, pago_inmediato = excluded.pago_inmediato, dias_credito = excluded.dias_credito, factura_original = excluded.factura_original,
      regimen_isr_id = excluded.regimen_isr_id, clasificacion_id = excluded.clasificacion_id, exento = excluded.exento, retencion = excluded.retencion, retencion_valor = excluded.retencion_valor,
      retencion_formulario = excluded.retencion_formulario, retencion_fecha = excluded.retencion_fecha, orden_compra = excluded.orden_compra,
      iva_especial = excluded.iva_especial, isr_especial = excluded.isr_especial, iva_importacion = excluded.iva_importacion, turismo_itp = excluded.turismo_itp,
      dai = excluded.dai, valor_cuenta_ajena = excluded.valor_cuenta_ajena, modulo_factura = excluded.modulo_factura,
      numero_cheque = excluded.numero_cheque, usuario_modifica_anterior = excluded.usuario_modifica_anterior, fecha_modifica_anterior = excluded.fecha_modifica_anterior,
      tipo_compra_anterior = excluded.tipo_compra_anterior, poliza_anio = excluded.poliza_anio, poliza_mes = excluded.poliza_mes, poliza_numero = excluded.poliza_numero,
      pct_iva = excluded.pct_iva, pct_retencion = excluded.pct_retencion, propina = excluded.propina, fecha_transferencia = excluded.fecha_transferencia,
      clasificacion_pago = excluded.clasificacion_pago, usuario_autoriza = excluded.usuario_autoriza, tipo_periodo_compra = excluded.tipo_periodo_compra,
      transaccion_retencion = excluded.transaccion_retencion, valor_cambio_anterior = excluded.valor_cambio_anterior, documento_anterior = excluded.documento_anterior,
      proveedor_anterior = excluded.proveedor_anterior, transaccion_anterior = excluded.transaccion_anterior, regimen_isr_anterior = excluded.regimen_isr_anterior,
      fecha_ingreso_anterior = excluded.fecha_ingreso_anterior, usuario_anula_anterior = excluded.usuario_anula_anterior, fecha_anula_anterior = excluded.fecha_anula_anterior,
      cuenta_bancaria_anterior = excluded.cuenta_bancaria_anterior, transferencia_anterior = excluded.transferencia_anterior, banco_anterior = excluded.banco_anterior,
      contrasena_anterior = excluded.contrasena_anterior, exento_anterior = excluded.exento_anterior, anio_presentacion_anterior = excluded.anio_presentacion_anterior,
      retencion_valor_anterior = excluded.retencion_valor_anterior, fecha_documento_anterior = excluded.fecha_documento_anterior,
      fecha_vencimiento_anterior = excluded.fecha_vencimiento_anterior, subtotal_anterior = excluded.subtotal_anterior, proyecto_anterior = excluded.proyecto_anterior,
      tipo_operacion_anterior = excluded.tipo_operacion_anterior, rubro_anterior = excluded.rubro_anterior, tipo_rubro_anterior = excluded.tipo_rubro_anterior,
      cuenta_contable_anterior = excluded.cuenta_contable_anterior, centro_costo_anterior = excluded.centro_costo_anterior, estado_conta_anterior = excluded.estado_conta_anterior,
      descuentos_anterior = excluded.descuentos_anterior, banco_proveedor_anterior = excluded.banco_proveedor_anterior,
      penalizacion_vencimiento_anterior = excluded.penalizacion_vencimiento_anterior
    returning (xmax = 0) as nueva, documento like '% (MIGRADA)' as migrada)
  select count(*) filter (where nueva), count(*) filter (where not nueva), count(*) filter (where migrada) into v_n, v_a, v_doc from x;
  alter table public.compras enable trigger compras_preparar;
  perform set_config('fin.migracion', '', true);

  raise notice '%', format('Compras de la organización 7 (parte 2 de 2): %s nuevas, %s actualizadas.%s%s%s%s',
    v_n, v_a,
    case when v_ren > 0 then format(' %s compras registradas en el sistema pasaron a números después de las migradas.', v_ren) else '' end,
    case when v_prov > 0 then format(' %s proveedores creados (no venían en ACT_PROVEEDORES).', v_prov) else '' end,
    case when v_reg > 0 then format(' %s regímenes ISR creados.', v_reg) else '' end,
    case when v_doc > 0 then format(' %s documentos ya registrados en el sistema llevan « (MIGRADA)».', v_doc) else '' end);
end;
$compras$;

notify pgrst, 'reload schema';
