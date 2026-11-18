-- Script 228 · Productos y precios de la organización 4 (Tecnoalsa), de «ACT_PRODUCTOS.xlsx» (1301 productos: 1301 de la 4-01)
--   y «ACT_PRECIOS.xlsx» (5 precios). Lógica de los scripts 195 (productos) y 103 (precios).
--   1. Cada producto conserva su código del sistema anterior (también en codigo_anterior). Los productos que ya hubiera en la
--      empresa y no vienen del sistema anterior pasan a números después del último código del archivo.
--   2. Se crean (parte 1) las bodegas 4-01 1 si no existen y 1 tipo(s) de producto que usan los
--      productos y no vienen en ACT_TIPOS_PRODUCTOS (30), en la clasificación del producto.
--   3. Columnas de productos del sistema anterior (las del script 195 y, nuevas, es_generico_anterior y nombre_foto_anterior):
--      codigo_anterior: PRODUCTO (el producto conserva ese mismo código)
--      clasificacion_anterior: CLASIFICACION
--      tipo_producto_anterior: TIPO_PRODUCTO
--      tipo_medida_anterior: TIPO_MEDIDA
--      presentacion_anterior: PRESENTACION
--      bodega_codigo_anterior: BODEGA
--      proveedor_codigo_anterior: PROVEEDOR
--      estado_original: ESTADO (A o I)
--      codigo_producto_anterior: CODIGO_PRODUCTO tal como venía
--      origen_anterior: MIGRADO
--      codigo_proveedor_anterior: CODIGO_PROVEEDOR
--      codigo_visual: CODIGO_VISUAL
--      administracion_pm: ADMINISTRACION_PM (S/N)
--      correlativo_bodega: CORRELATIVO_BODEGA
--      covid: COVID (S/N)
--      clasificacion_lab: CLASIFICACION_LAB
--      revisado: REVISADO (S/N)
--      generico_anterior: GENERICO (texto del sistema anterior)
--      codigo_barras_anterior: CODIGO_BARRAS tal como venía
--      minimo_anterior: CANTIDAD_MINIMA
--      maximo_anterior: CANTIDAD_MAXIMA
--      es_generico_anterior: ES_GENERICO (SI/NO; nuevo)
--      nombre_foto_anterior: NOMBRE_FOTO (nuevo; la imagen no viene en los archivos)
--   Equivalencias: ESTADO A = ACTIVO, I = INACTIVO; ES_GENERICO SI = genérico; ADMINISTRACION_PM S = punto mínimo con CANTIDAD_MINIMA y
--   CANTIDAD_MAXIMA; TIPO_MEDIDA, PRESENTACION, CLASIFICACION y TIPO_PRODUCTO por su código anterior (script 227); PROVEEDOR por su código
--   en la empresa (script 225); código 0 = sin dato. 1 productos traen un tipo de otra clasificación y quedan sin tipo.
--   Código de producto repetido (lo conserva el primero; el otro queda en codigo_producto_anterior): 4-01 526 (70.00.029), 4-01 527 (5030206), 4-01 571 (07.FCTN1), 4-01 610 (16020035), 4-01 613 (13020066), 4-01 649 (PRC77), 4-01 683 (07.R.121), 4-01 684 (07.R.122), 4-01 685 (87.00.771S), 4-01 695 (13020085), 4-01 697 (5060037), 4-01 698 (5140240), 4-01 700 (5140234), 4-01 709 (65108840), 4-01 852 (113106), 4-01 913 (EX004-H20-A2/1-C-L-220), 4-01 928 (2186005), 4-01 929 (3801138), 4-01 1014 (5140240), 4-01 1015 (5393), 4-01 1016 (23527), 4-01 1025 (EX002-H20-A1/1-C-S7-220), 4-01 1026 (EX002-P10-A1/1-G-S5-220), 4-01 1028 (EX002-C-H20-A2/1-18), 4-01 1031 (8438), 4-01 1054 (35031SN0G), 4-01 1055 (40.00.606P), 4-01 1059 (74.00.235S), 4-01 1069 (EX002-C-H20-A1/1-18), 4-01 1070 (EX002-C-H20-A1/1-20), 4-01 1071 (EX002-C-H20-A2/1-18), 4-01 1074 (EX002-A6-A1/1-G-S5-220), 4-01 1075 (EX002-P10-A1/1-G-S5-220), 4-01 1088 (B10TR-25), 4-01 1094 (S02539), 4-01 1116 (SP100RK), 4-01 1136 (PRR7), 4-01 1145 (PRR34/1), 4-01 1164 (F-FAN86592), 4-01 1167 (5140240), 4-01 1171 (64670-0001-0), 4-01 1184 (65320905), 4-01 1189 (26670-0058-1), 4-01 1206 (DR2P80), 4-01 1209 (35031SN0G), 4-01 1218 (91301015), 4-01 1221 (124CE), 4-01 1227 (K101-001), 4-01 1239 (5130111), 4-01 1240 (5140502), 4-01 1241 (13010104), 4-01 1242 (25030014), 4-01 1243 (5030314), 4-01 1245 (13010004), 4-01 1261 (4452203000000), 4-01 1263 (CL220PSSG/60HZ), 4-01 1267 (200D2460), 4-01 1268 (01DA0900), 4-01 1276 (DR60-MWTS), 4-01 1277 (11713-1212-0), 4-01 1284 (26670-0058-1), 4-01 1287 (26100-0085-0), 4-01 1293 (EX003-H20-A2/1-C-S7-220), 4-01 1294 (EX002-H20-A1/1-C-S7-220), 4-01 1299 (S03525), 4-01 1314 (53632).
--   Código de barras repetido: ninguno. Punto mínimo con mínimo mayor que el máximo: 4-01 54, 4-01 68, 4-01 75, 4-01 86, 4-01 149, 4-01 153, 4-01 167, 4-01 229, 4-01 247, 4-01 259, 4-01 263, 4-01 288, 4-01 295, 4-01 324, 4-01 328, 4-01 334, 4-01 355, 4-01 359, 4-01 611, 4-01 659, 4-01 695, 4-01 709, 4-01 718.
--   Partes: la 1 (catálogos) y de la 2 a la 3 (productos; la última también los precios), en orden. Se ejecutan después de los scripts
--   225 y 227. Se pueden ejecutar de nuevo: la segunda vez solo actualizan.
-- Parte 1 de 3: columnas nuevas, productos que no vienen del sistema anterior renumerados y catálogos que faltaban.
set lock_timeout = '20s';
alter table public.productos add column if not exists codigo_anterior integer;
alter table public.productos add column if not exists clasificacion_anterior integer;
alter table public.productos add column if not exists tipo_producto_anterior integer;
alter table public.productos add column if not exists tipo_medida_anterior integer;
alter table public.productos add column if not exists presentacion_anterior integer;
alter table public.productos add column if not exists bodega_codigo_anterior integer;
alter table public.productos add column if not exists proveedor_codigo_anterior integer;
alter table public.productos add column if not exists estado_original text;
alter table public.productos add column if not exists codigo_producto_anterior text;
alter table public.productos add column if not exists origen_anterior text;
alter table public.productos add column if not exists codigo_proveedor_anterior text;
alter table public.productos add column if not exists codigo_visual integer;
alter table public.productos add column if not exists administracion_pm text;
alter table public.productos add column if not exists correlativo_bodega integer;
alter table public.productos add column if not exists covid boolean;
alter table public.productos add column if not exists clasificacion_lab text;
alter table public.productos add column if not exists revisado boolean;
alter table public.productos add column if not exists generico_anterior text;
alter table public.productos add column if not exists codigo_barras_anterior text;
alter table public.productos add column if not exists minimo_anterior numeric(14, 3);
alter table public.productos add column if not exists maximo_anterior numeric(14, 3);
alter table public.productos add column if not exists es_generico_anterior text;
alter table public.productos add column if not exists nombre_foto_anterior text;
create index if not exists productos_codigo_anterior_idx on public.productos (localidad_id, codigo_anterior);
alter table public.bodegas add column if not exists codigo_anterior integer;

do $cat$
declare
  v_org bigint; v_loc bigint; v_cla bigint; v_cod int; r record; v_l record;
  p_n int := 0; b_n int := 0; t_n int := 0; t_a int := 0;
begin
  select id into v_org from public.organizaciones where codigo::text = '4';
  if v_org is null then raise exception 'No existe la organización 4: ejecuta antes el script 221.'; end if;

  -- a) Productos que no vienen del sistema anterior (creados a mano o de muestra) pasan a números después del último código del
  --    archivo (4-01 hasta 1318), para que cada producto migrado conserve su código.
  alter table public.productos disable trigger user;
  for v_l in select l.id, x.maximo from (values (1, 1318)) as x(loc, maximo)
             join public.localidades l on l.organizacion_id = v_org and l.correlativo = x.loc loop
    update public.productos p set codigo = v_l.maximo + q.fila
    from (select id, row_number() over (order by codigo) as fila from public.productos
          where localidad_id = v_l.id and codigo_anterior is null and codigo <= v_l.maximo) q
    where p.id = q.id;
    get diagnostics v_cod = row_count; p_n := p_n + v_cod;
  end loop;
  alter table public.productos enable trigger user;

  -- b) Bodegas que usan los productos: se ligan por su código; si no existe, se crea.
  for r in select * from (values (1, 1)) as x(loc, codigo) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then continue; end if;
    if exists (select 1 from public.bodegas where localidad_id = v_loc and (codigo_anterior = r.codigo or (codigo_anterior is null and codigo = r.codigo))) then continue; end if;
    v_cod := case when exists (select 1 from public.bodegas where localidad_id = v_loc and codigo = r.codigo) then (select max(codigo) + 1 from public.bodegas where localidad_id = v_loc) else r.codigo end;
    insert into public.bodegas (organizacion_id, localidad_id, codigo, nombre, codigo_anterior)
    values (v_org, v_loc, v_cod, 'BODEGA ' || r.codigo || ' (CREADA AL MIGRAR PRODUCTOS)', r.codigo);
    b_n := b_n + 1;
  end loop;

  -- c) Tipos de producto que usan los productos y no vienen en ACT_TIPOS_PRODUCTOS: se crean en la clasificación del producto,
  --    con el nombre del primer producto que lo usa.
  for r in select * from (values
    (1::integer, 30::integer, 1::integer, 'MOLDE C.ALAMBRE FORMAS SURTIDAS Ø40 6 SALIDAS P=70 T5/2 + T6/2'::text)) as x(loc, codigo, clasificacion, nombre) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then continue; end if;
    if exists (select 1 from public.tipos_producto where localidad_id = v_loc and codigo_anterior = r.codigo) then t_a := t_a + 1; continue; end if;
    v_cla := null;
    select id into v_cla from public.clasificaciones_producto where localidad_id = v_loc and codigo_anterior = r.clasificacion;
    if v_cla is null then raise exception 'No existe la clasificación % en la 4-0%: ejecuta antes el script 227.', r.clasificacion, r.loc; end if;
    v_cod := case when exists (select 1 from public.tipos_producto where localidad_id = v_loc and codigo = r.codigo) then (select max(codigo) + 1 from public.tipos_producto where localidad_id = v_loc) else r.codigo end;
    insert into public.tipos_producto (clasificacion_id, organizacion_id, localidad_id, codigo, nombre, codigo_anterior)
    values (v_cla, v_org, v_loc, v_cod, r.nombre, r.codigo);
    t_n := t_n + 1;
  end loop;

  raise notice '%', format('Productos que no venían del sistema anterior renumerados: %s. Creados: %s bodegas y %s tipos de producto (%s ya existían). Sigue con la parte 2.',
    p_n, b_n, t_n, t_a);
end;
$cat$;

notify pgrst, 'reload schema';
