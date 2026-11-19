-- Lote del 05-11 al 17-11-2026 («Datos Tecnoasla - AAPOS del 05-11-2026 al 17-11-2026»): mismo proceso del script 229, solo con los registros de este lote.
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
