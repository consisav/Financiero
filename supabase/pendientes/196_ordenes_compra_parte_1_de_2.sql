-- Script 196 · parte 1 de 2 · Organización 2: catálogos que faltan y las 35 órdenes de compra (ACT_ORDENES_COMPRA.xls).
-- Se ejecuta después del script 195 (productos). Se puede ejecutar de nuevo: actualiza lo migrado.
-- Columnas del sistema anterior que no existían en las órdenes de compra.
alter table public.ordenes_compra add column if not exists orden_anterior integer;
alter table public.ordenes_compra add column if not exists codigo_orden_anterior text;
alter table public.ordenes_compra add column if not exists orden_mes_anterior integer;
alter table public.ordenes_compra add column if not exists orden_original_anterior integer;
alter table public.ordenes_compra add column if not exists orden_original_id bigint references public.ordenes_compra (id) on delete set null;
alter table public.ordenes_compra add column if not exists estado_anterior text;
alter table public.ordenes_compra add column if not exists proceso_anterior integer;
alter table public.ordenes_compra add column if not exists bodega_anterior integer;
alter table public.ordenes_compra add column if not exists proveedor_anterior integer;
alter table public.ordenes_compra add column if not exists forma_pago_anterior text;
alter table public.ordenes_compra add column if not exists usuario_ingresa_anterior text;
alter table public.ordenes_compra add column if not exists fecha_ingresa_anterior timestamp;
alter table public.ordenes_compra add column if not exists usuario_aprueba_anterior text;
alter table public.ordenes_compra add column if not exists fecha_aprueba_anterior timestamp;
alter table public.ordenes_compra add column if not exists usuario_modifica_anterior text;
alter table public.ordenes_compra add column if not exists fecha_modifica_anterior timestamp;
alter table public.ordenes_compra add column if not exists documento_anterior text;
alter table public.ordenes_compra add column if not exists serie_documento_anterior text;
alter table public.ordenes_compra add column if not exists tipo_documento_anterior integer;
alter table public.ordenes_compra add column if not exists fecha_documento_anterior date;
alter table public.ordenes_compra add column if not exists valor_total_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists total_nc_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists descuentos_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists descuentos_nd_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists bonificaciones_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists total_sin_descuentos_anterior numeric(18, 2);
alter table public.ordenes_compra add column if not exists tipo_transaccion_anterior integer;
alter table public.ordenes_compra add column if not exists tipo_compra_anterior text;
alter table public.ordenes_compra add column if not exists clasificacion_anterior integer;
alter table public.ordenes_compra add column if not exists bodega_ingreso_anterior integer;
alter table public.ordenes_compra add column if not exists compra_ingreso_anterior integer;
alter table public.ordenes_compra add column if not exists aviso_enviado boolean;
alter table public.ordenes_compra add column if not exists fecha_aviso timestamp;
alter table public.ordenes_compra add column if not exists origen_anterior text;
create unique index if not exists ordenes_compra_orden_anterior_key on public.ordenes_compra (localidad_id, orden_anterior) where orden_anterior is not null;
alter table public.orden_compra_lineas add column if not exists producto_anterior integer;
alter table public.orden_compra_lineas add column if not exists cantidad_anterior numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists cantidad_solicitada_anterior numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists aprobado_anterior text;
alter table public.orden_compra_lineas add column if not exists usuario_aprueba_anterior text;
alter table public.orden_compra_lineas add column if not exists fecha_aprueba_anterior timestamp;
alter table public.orden_compra_lineas add column if not exists usuario_modifica_anterior text;
alter table public.orden_compra_lineas add column if not exists fecha_modifica_anterior timestamp;
alter table public.orden_compra_lineas add column if not exists ultimo_proveedor_anterior integer;
alter table public.orden_compra_lineas add column if not exists proveedor_asignado_anterior integer;
alter table public.orden_compra_lineas add column if not exists existencia_bc numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists existencia_anterior numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists minimo_actual numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists maximo_actual numeric(14, 3);
alter table public.orden_compra_lineas add column if not exists valor_total_anterior numeric(18, 2);
alter table public.orden_compra_lineas add column if not exists forma_pago_anterior text;
alter table public.orden_compra_lineas add column if not exists dias_credito_anterior integer;
alter table public.orden_compra_lineas add column if not exists costo_unitario_compra numeric(18, 4);
alter table public.orden_compra_lineas add column if not exists costo_total_pre numeric(18, 2);
alter table public.orden_compra_lineas add column if not exists costo_total_anterior numeric(18, 2);
alter table public.orden_compra_lineas add column if not exists exento_iva boolean;
alter table public.orden_compra_lineas add column if not exists ingreso_anterior boolean;
alter table public.bodegas add column if not exists codigo_anterior integer;

do $oc$
declare
  v_org bigint; v_loc bigint; v_gtq bigint; v_id bigint; v_prov bigint; v_bod bigint; v_cod int; r record; v_l record;
  f_n int := 0; p_n int := 0; b_n int := 0; o_n int := 0; o_a int := 0;
begin
  select id into v_org from public.organizaciones where codigo = '2';
  if v_org is null then raise notice 'No existe la organización 2.'; return; end if;
  select id into v_gtq from public.monedas where iso = 'GTQ';
  if v_gtq is null then raise exception 'No existe la moneda GTQ.'; end if;

  -- a) Las órdenes que no vienen del sistema anterior pasan a folios después del último número del archivo
  --    (2-01 hasta 23, 2-03 hasta 12), para que cada orden migrada conserve su número.
  alter table public.ordenes_compra disable trigger user;
  for v_l in select l.id, x.maximo from (values (1, 23), (3, 12)) as x(loc, maximo)
             join public.localidades l on l.organizacion_id = v_org and l.correlativo = x.loc loop
    update public.ordenes_compra o set folio = greatest((select coalesce(max(folio), 0) from public.ordenes_compra where localidad_id = v_l.id), v_l.maximo) + q.fila
    from (select id, row_number() over (order by folio) as fila from public.ordenes_compra
          where localidad_id = v_l.id and orden_anterior is null and folio <= v_l.maximo) q
    where o.id = q.id;
    get diagnostics v_cod = row_count; f_n := f_n + v_cod;
  end loop;
  alter table public.ordenes_compra enable trigger user;

  -- b) Proveedores de las órdenes: se ligan por su código; si no existe (los proveedores aún no se migran), se crea con
  --    «PROVEEDOR n (CREADO AL MIGRAR ÓRDENES DE COMPRA)» para revisar. Las órdenes sin proveedor (0 o vacío) llevan
  --    «PROVEEDOR NO DEFINIDO (ÓRDENES DE COMPRA MIGRADAS)», código 999999.
  for r in select * from (values (1, 109), (1, 231), (1, 999999), (3, 2030), (3, 2452), (3, 999999)) as x(loc, codigo) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then continue; end if;
    if exists (select 1 from public.proveedores where localidad_id = v_loc and codigo = r.codigo) then continue; end if;
    insert into public.proveedores (organizacion_id, localidad_id, codigo, nombre_comercial, concepto_gastos, pendiente_revisar)
    values (v_org, v_loc, r.codigo, case when r.codigo = 999999 then 'PROVEEDOR NO DEFINIDO (ÓRDENES DE COMPRA MIGRADAS)'
                                         else 'PROVEEDOR ' || r.codigo || ' (CREADO AL MIGRAR ÓRDENES DE COMPRA)' end, 'POR DEFINIR', true);
    p_n := p_n + 1;
  end loop;

  -- c) Bodegas de las órdenes: se ligan por su código; si no existe, se crea.
  for r in select * from (values (1, 1), (1, 5), (1, 7), (1, 14), (3, 1), (3, 12)) as x(loc, codigo) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then continue; end if;
    if exists (select 1 from public.bodegas where localidad_id = v_loc and (codigo_anterior = r.codigo or (codigo_anterior is null and codigo = r.codigo))) then continue; end if;
    v_cod := case when exists (select 1 from public.bodegas where localidad_id = v_loc and codigo = r.codigo) then (select max(codigo) + 1 from public.bodegas where localidad_id = v_loc) else r.codigo end;
    insert into public.bodegas (organizacion_id, localidad_id, codigo, nombre, codigo_anterior)
    values (v_org, v_loc, v_cod, 'BODEGA ' || r.codigo || ' (CREADA AL MIGRAR ÓRDENES DE COMPRA)', r.codigo);
    b_n := b_n + 1;
  end loop;

  -- d) Las órdenes: estado COT y ECT (cotización) → INGRESADA, EAU → EN AUTORIZACIÓN, AUT → AUTORIZADA; forma de pago R → CRÉDITO, C → CONTADO.
  --    El número de la orden (COD_ORDEN) y el folio (ORDEN) se conservan; los datos del sistema anterior quedan en las columnas *_anterior.
  alter table public.ordenes_compra disable trigger user;
  for r in select * from (values
    (1::int, 1::int, '2022-01-31'::date, '001-01--2022'::text, 'INGRESADA'::text, 109::int, 1::int, null::int, 'CRÉDITO'::text, 1::int, 'COT'::text, 'REQUISICIÓN DE TINTA NEGRA PARA IMPRESORA EPSON 3110 PARA RECEPCIÓN ZONA 10'::text, null::text, 'R'::text, 'OLI'::text, '2022-01-31 09:24:55'::timestamp, null::text, null::timestamp, 'OLI'::text, '2022-02-14 15:21:51'::timestamp, null::text, null::text, 3::int, null::date, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::int, null::text, null::int, null::int, null::int, 3::int, true::boolean, '2022-01-31 09:32:46'::timestamp, null::text, null::int, 109::int),
    (1, 2, '2022-01-31', '001-01--A-2022', 'AUTORIZADA', 109, 1, 30, 'CRÉDITO', 1, 'AUT', null, null, 'R', 'OLI', '2022-01-31 09:32:42', 'OLI', '2022-01-31 11:50:12', 'OLI', '2022-01-31 11:50:12', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4, false, null, null, 1, 109),
    (1, 3, '2022-01-31', '002-01--2022', 'INGRESADA', 109, 14, null, 'CRÉDITO', 2, 'COT', 'TINTAS IMPRESORA 3110 CAJA ZONA 10', null, 'R', 'OLI', '2022-01-31 11:52:36', null, null, 'OLI', '2022-01-31 11:55:49', null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 3, true, '2022-01-31 11:55:49', null, null, 109),
    (1, 4, '2022-01-31', '002-01--A-2022', 'AUTORIZADA', 109, 14, 10, 'CRÉDITO', 2, 'AUT', null, null, 'R', 'OLI', '2022-01-31 11:55:41', 'OLI', '2022-01-31 11:56:32', 'OLI', '2022-01-31 11:56:32', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4, false, null, null, 3, 109),
    (1, 5, '2022-01-31', '003-01--2022', 'INGRESADA', 109, 7, null, 'CRÉDITO', 3, 'COT', 'MATERIALES PARA NUEVO PUNTO DE RED', null, 'R', 'OLI', '2022-01-31 13:38:52', null, null, 'OLI', '2022-01-31 13:44:51', null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 3, true, '2022-01-31 13:44:51', null, null, 109),
    (1, 6, '2022-01-31', '003-01--A-2022', 'AUTORIZADA', 109, 7, 30, 'CRÉDITO', 3, 'AUT', 'MATERIALES PARA NUEVO PUNTO DE RED', null, 'R', 'OLI', '2022-01-31 13:44:48', 'OLI', '2022-01-31 13:46:14', 'OLI', '2022-01-31 13:46:14', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4, false, null, null, 5, 109),
    (1, 7, '2022-01-31', '004-01--2022', 'INGRESADA', 109, 5, null, 'CRÉDITO', 4, 'COT', 'KIT DE TINTAS PARA IMPRESORA EPSON 3110.  NEGRO, MAGENTA, AZUL Y AMARILLO.  PARA LABORATORIO ZONA 10', 'UR', 'R', 'OLI', '2022-01-31 15:27:00', null, null, 'OLI', '2022-01-31 15:31:01', null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 3, true, '2022-01-31 15:31:01', null, null, 109),
    (1, 8, '2022-01-31', '004-01--A-2022', 'AUTORIZADA', 109, 5, 30, 'CRÉDITO', 4, 'AUT', 'KIT DE TINTAS PARA IMPRESORA EPSON 3110.  NEGRO, MAGENTA, AZUL Y AMARILLO.  PARA LABORATORIO ZONA 10', null, 'R', 'OLI', '2022-01-31 15:30:59', 'OLI', '2022-01-31 15:31:36', 'OLI', '2022-01-31 15:31:36', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4, false, null, null, 7, 109),
    (1, 9, '2022-02-01', '001-02--2022', 'INGRESADA', 109, 7, null, 'CRÉDITO', 1, 'COT', 'CABLEADO DE TELEFONO DE CAJA', null, 'R', 'MAR', '2022-02-01 09:28:57', null, null, 'MAR', '2022-02-01 09:36:24', null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 3, true, '2022-02-01 09:36:24', null, null, 109),
    (1, 10, '2022-02-01', '001-02--A-2022', 'EN AUTORIZACIÓN', 109, 7, 30, 'CRÉDITO', 1, 'EAU', 'CABLEADO DE TELEFONO DE CAJA', null, 'R', 'MAR', '2022-02-01 09:36:22', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, false, null, null, 9, 109),
    (1, 11, '2022-02-14', '002-02--2022', 'INGRESADA', 109, 7, null, 'CRÉDITO', 2, 'ECT', 'TINTAS PARA IMPRESORA EPSON EN ZONA 10, SOLICITADAS POR BRAYAN EL 31 DE ENERO 2022. SOLICITUD INICIAL APOBADA POR BRENDA', null, 'R', 'OLI', '2022-02-14 15:10:23', null, null, 'OLI', '2022-02-14 15:12:09', null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 1, false, null, null, null, 109),
    (1, 12, '2022-02-17', '003-02--2022', 'INGRESADA', 109, 7, null, 'CRÉDITO', 3, 'COT', 'NUEVO PUNTO DE RED PARA RAYOS X.', 'LA DISTANCIA ES DE 25 METROS DEL SWITCH PRINCIPAL HACIA LA MÁQUINA DE RAYOS X', 'R', 'LDM', '2022-02-17 16:23:34', null, null, 'LDM', '2022-02-17 16:29:30', null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 3, true, '2022-02-17 16:29:30', null, null, 109),
    (1, 13, '2022-02-17', '003-02--A-2022', 'EN AUTORIZACIÓN', 109, 7, 30, 'CRÉDITO', 3, 'EAU', 'NUEVO PUNTO DE RED PARA RAYOS X.', null, 'R', 'LDM', '2022-02-17 16:29:29', null, null, 'LDM', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, false, null, null, 12, 109),
    (1, 14, '2022-02-21', '004-02--2022', 'INGRESADA', 109, 7, null, 'CRÉDITO', 4, 'COT', 'PATCH CORD CLINICA 2 Y SWITCH PARA HABILITACIÓN DE PUNTOS DE RED DE CLINICAS', null, 'R', 'LDM', '2022-02-21 08:34:53', null, null, 'LDM', '2022-02-21 08:39:52', null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 3, true, '2022-02-21 08:39:52', null, null, 109),
    (1, 15, '2022-02-21', '005-02--2022', 'INGRESADA', 109, 7, null, 'CRÉDITO', 5, 'COT', 'TRANSFORMADOR DE CORRIENTE PARA ALIMENTAR CAMARAS ZONA 10', null, 'R', 'LDM', '2022-02-21 10:37:42', null, null, 'LDM', '2022-02-21 10:44:50', null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 3, true, '2022-02-21 10:44:50', null, null, 109),
    (1, 16, '2022-02-21', '005-02--A-2022', 'EN AUTORIZACIÓN', 109, 7, 30, 'CRÉDITO', 5, 'EAU', 'TRANSFORMADOR DE CORRIENTE PARA ALIMENTAR CAMARAS ZONA 10', null, 'R', 'LDM', '2022-02-21 10:44:49', null, null, 'LDM', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, false, null, null, 15, 109),
    (1, 17, '2022-03-10', '001-03--2022', 'INGRESADA', null, 7, null, 'CRÉDITO', 1, 'COT', null, null, 'R', 'HJU', '2022-03-10 09:15:16', null, null, 'MAR', '2022-03-10 15:03:36', null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 3, true, '2022-03-10 15:03:36', null, null, 0),
    (1, 18, '2022-03-10', '001-03--A-2022', 'EN AUTORIZACIÓN', null, 7, null, 'CONTADO', 1, 'EAU', null, null, 'C', 'MAR', '2022-03-10 15:03:33', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, false, null, null, 17, 0),
    (1, 19, '2022-03-16', '002-03--2022', 'INGRESADA', 109, 7, null, 'CRÉDITO', 2, 'COT', 'NUEVO CABLEADO TELEFÓNICO PARA COCINA Y QUIROFANOS', null, 'R', 'OLI', '2022-03-16 15:27:10', null, null, 'OLI', '2022-03-16 15:32:51', null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 3, true, '2022-03-16 15:32:51', null, null, 109),
    (1, 20, '2022-03-16', '002-03--A-2022', 'AUTORIZADA', 109, 7, 30, 'CRÉDITO', 2, 'AUT', 'NUEVO CABLEADO TELEFÓNICO PARA COCINA Y QUIROFANOS', null, 'R', 'OLI', '2022-03-16 15:32:49', 'OLI', '2022-03-16 15:33:12', 'OLI', '2022-03-16 15:33:12', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4, false, null, null, 19, 109),
    (1, 21, '2022-08-29', '001-08--2022', 'INGRESADA', 109, 7, null, 'CRÉDITO', 1, 'COT', 'CABLE ESPECIAL PARA EL DISPOSITIVO EXTERNO DE BAKCUP 6TB', null, 'R', 'OLI', '2022-08-29 15:50:06', null, null, 'OLI', '2022-08-29 15:55:11', null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 3, true, '2022-08-29 15:55:11', null, null, 109),
    (1, 22, '2022-08-29', '001-08--A-2022', 'EN AUTORIZACIÓN', 109, 7, 30, 'CRÉDITO', 1, 'EAU', 'CABLE ESPECIAL PARA EL DISPOSITIVO EXTERNO DE BAKCUP 6TB', null, 'R', 'OLI', '2022-08-29 15:55:09', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, false, null, null, 21, 109),
    (1, 23, '2023-06-19', '001-06--2023', 'AUTORIZADA', 231, 1, null, 'CRÉDITO', 1, 'AUT', 'CANULAS RAM', null, 'R', 'BLA', '2023-06-19 12:50:54', 'BLA', '2023-06-19 12:57:43', 'BLA', '2023-06-19 12:57:43', null, null, 3, null, 5625, null, null, null, null, null, null, null, null, null, null, 4, false, null, null, null, 231),
    (3, 1, '2022-04-22', '001-04--2022', 'INGRESADA', 2030, 12, null, 'CRÉDITO', 1, 'COT', null, null, 'R', 'LIS', '2022-04-22 13:38:21', null, null, 'LIS', '2022-04-22 13:39:51', null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 3, false, null, null, null, 2030),
    (3, 2, '2022-04-22', '001-04--A-2022', 'EN AUTORIZACIÓN', 2030, 12, 0, 'CONTADO', 1, 'EAU', null, null, null, 'LIS', '2022-04-22 13:39:46', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, false, null, null, 1, 2030),
    (3, 3, '2022-04-22', '001-04--A-2022', 'EN AUTORIZACIÓN', 2030, 12, 0, 'CRÉDITO', 1, 'EAU', null, null, 'R', 'LIS', '2022-04-22 13:39:51', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, false, null, null, 1, 2030),
    (3, 4, '2023-06-22', '001-06--2023', 'INGRESADA', null, 1, null, 'CRÉDITO', 1, 'ECT', null, null, 'R', 'WEP', '2023-06-22 08:51:49', null, null, null, null, '0', null, 3, '2023-06-22', 0, 0, 0, 0, 0, 0, 1013, 'A', 2, 1, 1159, 8, false, null, null, null, null),
    (3, 5, '2023-06-22', '002-06--2023', 'INGRESADA', null, 1, null, 'CRÉDITO', 2, 'ECT', 'PRUEBAS', null, 'R', '999', '2023-06-22 09:09:07', null, null, null, null, null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 1, false, null, null, null, null),
    (3, 6, '2023-06-22', '003-06--2023', 'INGRESADA', null, 1, null, 'CRÉDITO', 3, 'ECT', null, null, 'R', '999', '2023-06-22 09:32:42', null, null, null, null, null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 1, false, null, null, null, null),
    (3, 7, '2023-06-22', '004-06--2023', 'INGRESADA', 2452, 1, null, 'CRÉDITO', 4, 'COT', null, null, 'R', 'JRA', '2023-06-22 10:44:02', null, null, 'JRA', '2023-06-22 10:47:25', null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 3, true, '2023-06-22 10:47:25', null, null, 2452),
    (3, 8, '2023-06-22', '004-06--A-2023', 'AUTORIZADA', 2452, 1, 0, 'CONTADO', 4, 'AUT', null, null, 'C', 'WEP', '2023-06-22 10:47:24', 'WEP', '2023-06-22 10:48:22', 'WEP', '2023-06-22 10:48:22', null, null, null, null, 3750, null, null, null, null, null, null, null, null, null, null, 4, false, null, null, 7, 2452),
    (3, 9, '2023-06-28', '005-06--2023', 'INGRESADA', 2452, 1, null, 'CRÉDITO', 5, 'COT', null, null, 'R', 'WEP', '2023-06-28 13:22:43', null, null, 'WEP', '2023-06-28 13:24:35', null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 3, true, '2023-06-28 13:24:35', null, null, 2452),
    (3, 10, '2023-06-28', '005-06--A-2023', 'EN AUTORIZACIÓN', 2452, 1, 0, 'CONTADO', 5, 'EAU', null, null, 'C', 'WEP', '2023-06-28 13:24:34', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, false, null, null, 9, 2452),
    (3, 11, '2023-06-28', '006-06--2023', 'INGRESADA', 2452, 1, null, 'CRÉDITO', 6, 'COT', null, null, 'R', 'WEP', '2023-06-28 13:32:34', null, null, 'WEP', '2023-06-28 13:34:43', null, null, 3, null, null, null, null, null, null, null, null, null, null, null, null, 3, true, '2023-06-28 13:34:43', null, null, 2452),
    (3, 12, '2023-06-28', '006-06--A-2023', 'AUTORIZADA', 2452, 1, 0, 'CONTADO', 6, 'AUT', null, null, 'C', 'WEP', '2023-06-28 13:34:42', 'JRA', '2023-06-29 09:36:18', 'JRA', '2023-06-29 09:36:18', '2', '0', null, '2023-06-29', 3000, null, null, null, null, null, null, null, null, null, null, 4, false, null, null, 11, 2452)) as x(loc, orden, fecha, numero, estado, proveedor, bodega, dias, forma_pago, orden_mes, estado_ant, obs, obs_prov, fp_ant, usr_ing, f_ing, usr_apr, f_apr, usr_mod, f_mod,
       documento, serie, tipo_doc, fecha_doc, valor_total, total_nc, descuentos, descuentos_nd, bonificaciones, total_sin_desc, tipo_trans, tipo_compra, clasificacion, bodega_ingreso, compra_ingreso,
       proceso, aviso, f_aviso, nada, orden_original, proveedor_ant) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then continue; end if;
    select id into v_prov from public.proveedores where localidad_id = v_loc and codigo = coalesce(r.proveedor, 999999);
    select id into v_bod from public.bodegas where localidad_id = v_loc and (codigo_anterior = r.bodega or (codigo_anterior is null and codigo = r.bodega))
      order by (codigo_anterior = r.bodega) desc nulls last limit 1;
    if v_prov is null or v_bod is null then raise exception 'Orden 2-0% %: falta su proveedor o su bodega.', r.loc, r.orden; end if;
    v_id := null;
    select id into v_id from public.ordenes_compra where localidad_id = v_loc and orden_anterior = r.orden;
    if v_id is null then
      if exists (select 1 from public.ordenes_compra where localidad_id = v_loc and folio = r.orden) then
        raise exception 'El folio % de la empresa 2-0% ya está ocupado: ejecuta de nuevo esta parte desde el inicio.', r.orden, r.loc;
      end if;
      insert into public.ordenes_compra (organizacion_id, localidad_id, folio, fecha, proveedor_id, moneda_id, bodega_id, orden_anterior)
      values (v_org, v_loc, r.orden, r.fecha, v_prov, v_gtq, v_bod, r.orden) returning id into v_id;
      o_n := o_n + 1;
    else
      o_a := o_a + 1;
    end if;
    update public.ordenes_compra set
      numero = r.numero, fecha = r.fecha, estado = r.estado, proveedor_id = v_prov, bodega_id = v_bod, moneda_id = v_gtq, tipo_cambio = 1,
      tipo_proveedor_id = (select p.tipo_proveedor_id from public.proveedores p where p.id = v_prov),
      forma_pago = r.forma_pago, dias_credito = case when r.forma_pago = 'CRÉDITO' then coalesce(r.dias, 0) else 0 end,
      observaciones_internas = r.obs, observaciones_proveedor = r.obs_prov,
      usuario = r.usr_ing, aprobado_por = r.usr_apr, aprobado_en = r.f_apr at time zone 'America/Guatemala',
      creado_por_nombre = r.usr_ing, creado_en = r.f_ing at time zone 'America/Guatemala',
      modificado_por_nombre = r.usr_mod, modificado_en = r.f_mod at time zone 'America/Guatemala',
      codigo_orden_anterior = r.numero, orden_mes_anterior = r.orden_mes, orden_original_anterior = r.orden_original, estado_anterior = r.estado_ant,
      proceso_anterior = r.proceso, bodega_anterior = r.bodega, proveedor_anterior = r.proveedor_ant, forma_pago_anterior = r.fp_ant,
      usuario_ingresa_anterior = r.usr_ing, fecha_ingresa_anterior = r.f_ing, usuario_aprueba_anterior = r.usr_apr, fecha_aprueba_anterior = r.f_apr,
      usuario_modifica_anterior = r.usr_mod, fecha_modifica_anterior = r.f_mod, documento_anterior = r.documento, serie_documento_anterior = r.serie,
      tipo_documento_anterior = r.tipo_doc, fecha_documento_anterior = r.fecha_doc, valor_total_anterior = r.valor_total, total_nc_anterior = r.total_nc,
      descuentos_anterior = r.descuentos, descuentos_nd_anterior = r.descuentos_nd, bonificaciones_anterior = r.bonificaciones, total_sin_descuentos_anterior = r.total_sin_desc,
      tipo_transaccion_anterior = r.tipo_trans, tipo_compra_anterior = r.tipo_compra, clasificacion_anterior = r.clasificacion, bodega_ingreso_anterior = r.bodega_ingreso,
      compra_ingreso_anterior = r.compra_ingreso, aviso_enviado = r.aviso, fecha_aviso = r.f_aviso, origen_anterior = 'MIGRADO'
    where id = v_id;
  end loop;
  -- La orden original (la cotización de la que salió cada orden «-A-»).
  update public.ordenes_compra o set orden_original_id = x.id
  from public.ordenes_compra x
  where o.organizacion_id = v_org and o.orden_original_anterior is not null and x.localidad_id = o.localidad_id and x.orden_anterior = o.orden_original_anterior;
  alter table public.ordenes_compra enable trigger user;

  raise notice '%', format('Órdenes renumeradas: %s. Creados: %s proveedores y %s bodegas. Órdenes nuevas: %s; actualizadas: %s. Sigue con la parte 2.', f_n, p_n, b_n, o_n, o_a);
end;
$oc$;
