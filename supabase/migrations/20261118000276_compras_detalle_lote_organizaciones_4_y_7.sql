-- Lote del 05-11 al 17-11-2026 («Datos Tecnoasla - AAPOS del 05-11-2026 al 17-11-2026»): mismo proceso del script 229, solo con los registros de este lote.
-- Script 276 · Organizaciones 4 (Tecnoalsa) y 7 (AAPOS): 150 líneas de detalle de las compras varias (ACT_DETALLE_COMPRAS_VARIAS.xlsx).
--   Lógica del script 199. Se ejecuta después del script 229. Cada línea se liga a su compra por el número del sistema anterior; CORRELATIVO = línea.
--   APLICA_IVA_IMP viene en S en todas las líneas (no cambia nada). No se migran 0 líneas de las compras sin valor total.
--   Cantidad 0 o vacía (0 líneas): quedan con cantidad 1 y la del archivo en cantidad_anterior.
--   Costo negativo (queda 0 y el del archivo en costo_total_anterior): ninguna.
--   Para el SQL Editor de Supabase están por separado en supabase/pendientes/276_compras_detalle_parte_N_de_2.sql.

-- Script 276 · parte 1 de 2 · Organización 4 (TECNOALSA): detalle de las compras varias (ACT_DETALLE_COMPRAS_VARIAS.xlsx), 26 líneas.
-- Se ejecuta después del script 229 (compras). Se puede ejecutar de nuevo: la segunda vez solo actualiza.
alter table public.compra_items add column if not exists cantidad_anterior numeric;
alter table public.compra_items add column if not exists costo_total_anterior numeric;
set lock_timeout = '20s';

do $items$
declare v_org bigint; v_n int := 0; v_a int := 0; v_sin int;
begin
  select id into v_org from public.organizaciones where codigo::text = '4';
  if v_org is null then raise exception 'No existe la organización 4.'; end if;
  -- La validación de la pantalla (no se cambia el detalle de una compra anulada) se suspende durante la carga.
  alter table public.compra_items disable trigger compra_items_validar;
  with m (loc, compra, linea, descripcion, cantidad, cantidad_ant, costo, costo_ant) as (values
      (1::integer, 1992::integer, 1::integer, 'COMPRAS VARIAS'::text, 1::numeric, null::numeric, 17068.78::numeric, null::numeric),
      (1, 1993, 1, 'COMPRAS VARIAS', 1, null, 1735.24, null),
      (1, 1994, 1, 'COMPRAS VARIAS', 1, null, 1900, null),
      (1, 1995, 1, 'COMPRAS VARIAS', 1, null, 17316.48, null),
      (1, 1996, 1, 'COMPRAS VARIAS', 1, null, 1066.95, null),
      (1, 1997, 1, 'COMPRAS VARIAS', 1, null, 2947.37, null),
      (1, 1998, 1, 'COMPRAS VARIAS', 1, null, 1750, null),
      (1, 1999, 1, 'COMPRAS VARIAS', 1, null, 4860, null),
      (1, 2000, 1, 'COMPRAS VARIAS', 1, null, 500, null),
      (1, 2001, 1, 'CONTROLADOR DIGITAL - TEMPERATURA/TIEMPO (INOVA-VERSION 2) LOC', 1, null, 2250, null),
      (1, 2002, 1, 'COMPRAS VARIAS', 1, null, 8434.43, null),
      (1, 2003, 1, 'COMPRAS VARIAS', 1, null, 1330, null),
      (1, 2004, 1, 'COMPRAS VARIAS', 1, null, 1496.32, null),
      (1, 2005, 1, 'COMPRAS VARIAS', 1, null, 1250, null),
      (1, 2006, 1, 'COMPRAS VARIAS', 1, null, 400, null),
      (1, 2007, 1, 'COMPRAS VARIAS', 1, null, 1200, null),
      (1, 2008, 1, 'COMPRAS VARIAS', 1, null, 1071.8, null),
      (1, 2009, 1, 'COMPRAS VARIAS', 1, null, 1544.28, null),
      (1, 2010, 1, 'COMPRAS VARIAS', 1, null, 1155, null),
      (1, 2011, 1, 'COMPRAS VARIAS', 1, null, 458.9, null),
      (1, 2012, 1, 'COMPRAS VARIAS', 1, null, 412.63, null),
      (1, 2013, 1, 'COMPRAS VARIAS', 1, null, 1544.28, null),
      (1, 2014, 1, 'CAMARA DE FERMENTACION DE LUEDO INOX, DE 40 BANDEJAS 46X66, ELECTRICA 5KW, DIGITAL DE 220V NO INCLUYE CARRO', 1, null, 40550, null),
      (1, 2015, 1, 'PALANCA EXPULSORA IZQUIERDA - LADO TRASERO', 1, null, 3503.12, null),
      (1, 2015, 2, 'PALANCA EXPULSORA DERECHA', 1, null, 3503.12, null),
      (1, 2016, 1, 'COMPRAS VARIAS', 1, null, 6423.58, null)),
  x as (
    insert into public.compra_items (compra_id, linea, descripcion, cantidad, costo_total, cantidad_anterior, costo_total_anterior)
    select c.id, m.linea, m.descripcion, m.cantidad, m.costo, m.cantidad_ant, m.costo_ant
    from m join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc
    join public.compras c on c.localidad_id = l.id and c.origen_anterior = 'VARIAS' and c.compra_anterior = m.compra
    on conflict (compra_id, linea) do update set descripcion = excluded.descripcion, cantidad = excluded.cantidad, costo_total = excluded.costo_total,
      cantidad_anterior = excluded.cantidad_anterior, costo_total_anterior = excluded.costo_total_anterior
    returning (xmax = 0) as nueva)
  select count(*) filter (where nueva), count(*) filter (where not nueva), (select count(*) from m) - count(*) into v_n, v_a, v_sin from x;
  alter table public.compra_items enable trigger compra_items_validar;
  raise notice '%', format('Detalle de compras de la organización 4 (parte 1 de 2): %s líneas nuevas, %s actualizadas.%s', v_n, v_a,
    case when v_sin > 0 then format(' %s líneas de compras que no existen (omitidas: ejecuta antes el script 229).', v_sin) else '' end);
end;
$items$;

-- Script 276 · parte 2 de 2 · Organización 7 (AAPOS): detalle de las compras varias (ACT_DETALLE_COMPRAS_VARIAS.xlsx), 124 líneas.
-- Se ejecuta después del script 229 (compras). Se puede ejecutar de nuevo: la segunda vez solo actualiza.
alter table public.compra_items add column if not exists cantidad_anterior numeric;
alter table public.compra_items add column if not exists costo_total_anterior numeric;
set lock_timeout = '20s';

do $items$
declare v_org bigint; v_n int := 0; v_a int := 0; v_sin int;
begin
  select id into v_org from public.organizaciones where codigo::text = '7';
  if v_org is null then raise exception 'No existe la organización 7.'; end if;
  -- La validación de la pantalla (no se cambia el detalle de una compra anulada) se suspende durante la carga.
  alter table public.compra_items disable trigger compra_items_validar;
  with m (loc, compra, linea, descripcion, cantidad, cantidad_ant, costo, costo_ant) as (values
      (1::integer, 2051::integer, 1::integer, 'COMISIONES RIFA 2026'::text, 1::numeric, null::numeric, 7710::numeric, null::numeric),
      (1, 2052, 1, 'PLANILLA OCTUBRE 2026', 1, null, 323784.04, null),
      (1, 2053, 1, 'MANTA VINILICA 2.8X2.30 MTS CON OJETES', 1, null, 290, null),
      (1, 2053, 2, 'MANTAS VINILICAS 60X160 PARA CAMBIO DE ARAÑA', 6, null, 330, null),
      (1, 2053, 3, 'ENVIO DEL MATERIAL', 1, null, 35, null),
      (1, 2054, 1, 'RECONOCIMIENTO DE VIDRIO GRABADO', 7, null, 1365, null),
      (1, 2054, 2, 'RECONOCIMIENTO DE VIDRIO GRABADO FULL COLOR', 1, null, 579, null),
      (1, 2055, 1, 'AMENIZACION', 1, null, 1600, null),
      (1, 2056, 1, 'MATERIALES Y ACCESORIOS', 1, null, 6089.67, null),
      (1, 2057, 1, 'ARRENDAMEINTO NOVIEMBRE', 1, null, 14194.07, null),
      (1, 2058, 1, 'COMISIONES RIFA 2026', 1, null, 26437.5, null),
      (1, 2059, 1, 'ADORNO SAGRADA FAMILIA', 7, null, 364, null),
      (1, 2059, 2, 'BAILE DE GIGATNES DE MADERA EN PEQUEÑO', 1, null, 140, null),
      (1, 2060, 1, 'LLAVEROS', 5, null, 325, null),
      (1, 2060, 2, 'PAÑUELOS', 1, null, 200, null),
      (1, 2060, 3, 'PINES', 1, null, 55, null),
      (1, 2061, 1, 'POSTALES DE GUATEMALA', 29, null, 826.5, null),
      (1, 2062, 1, 'LIBROS', 2, null, 950, null),
      (1, 2063, 1, 'BUFFSS', 3, null, 195, null),
      (1, 2064, 1, 'PLAYERAS', 1, null, 200, null),
      (1, 2065, 1, 'LIBROS VARIOS', 1, null, 1200, null),
      (1, 2066, 1, 'LIBROS VARIOS', 1, null, 1036, null),
      (1, 2067, 1, 'LIBROS VARIOS', 1, null, 714, null),
      (1, 2068, 1, 'IMPRESIONES PEQUEÑAS', 15, null, 450, null),
      (1, 2068, 2, 'IMPRSIUONES MEDIANAS', 1, null, 50, null),
      (1, 2069, 1, 'ALMOHADA PEQUEÑA', 3, null, 870, null),
      (1, 2069, 2, 'COSMETIQUERA MINI', 1, null, 132, null),
      (1, 2069, 3, 'COSMETIQUERA CON PITAS', 5, null, 925, null),
      (1, 2069, 4, 'ENMARCADOS', 1, null, 185, null),
      (1, 2069, 5, 'MONEDEROS MINI', 7, null, 315, null),
      (1, 2070, 1, 'BILLETERA DE CUERO', 2, null, 200, null),
      (1, 2070, 2, 'CINCHO DE CUERO', 2, null, 400, null),
      (1, 2071, 1, 'POSTALES', 13, null, 390, null),
      (1, 2072, 1, 'LIBROS', 2, null, 530, null),
      (1, 2073, 1, 'BOSOS', 6, null, 630, null),
      (1, 2073, 2, 'BUFFSS', 23, null, 1725, null),
      (1, 2073, 3, 'GORRAS', 6, null, 720, null),
      (1, 2073, 4, 'LLAVEROS', 5, null, 105, null),
      (1, 2073, 5, 'PLAYERA CAPITAN', 6, null, 690, null),
      (1, 2073, 6, 'PLAYERA CAPITAL PARA ADULTO', 7, null, 896, null),
      (1, 2073, 7, 'PLAYERA VOLCAN CAPITAN', 16, null, 2400, null),
      (1, 2073, 8, 'STICKERS', 15, null, 270, null),
      (1, 2073, 9, 'SUDADEROS', 2, null, 400, null),
      (1, 2073, 10, 'VASOS', 8, null, 216, null),
      (1, 2074, 1, 'STICKER GRANDE', 14, null, 280, null),
      (1, 2074, 2, 'STICKER PEQUEÑO', 36, null, 540, null),
      (1, 2075, 1, 'PIN QUETZAL', 42, null, 3150, null),
      (1, 2075, 2, 'STICKER PACK', 31, null, 1023, null),
      (1, 2075, 3, 'PIN BUS', 15, null, 900, null),
      (1, 2075, 4, 'BOLSAS', 6, null, 480, null),
      (1, 2075, 5, 'PLAYERA QUETZAL', 4, null, 360, null),
      (1, 2075, 6, 'PLAYERA NIÑO', 2, null, 160, null),
      (1, 2076, 1, 'LIBRETAS', 3, null, 180, null),
      (1, 2076, 2, 'POSTALES', 17, null, 306, null),
      (1, 2076, 3, 'STICKERS', 3, null, 135, null),
      (1, 2077, 1, 'PIEZA DECORATIVA FRAGMENTOS', 1, null, 199, null),
      (1, 2077, 2, 'ARETE EN MADERA', 1, null, 65, null),
      (1, 2077, 3, 'LASCA CIRCULAR', 2, null, 170, null),
      (1, 2077, 4, 'PIEZA DECORATIVA VESTIGIOS', 1, null, 390, null),
      (1, 2077, 5, 'CUCAHCRITA DE MADERA', 1, null, 25, null),
      (1, 2078, 1, 'BLOCK DE NOTAS MINI', 1, null, 67, null),
      (1, 2078, 2, 'BLOCK DE NOTAS CHULA', 1, null, 39, null),
      (1, 2078, 3, 'POSTALES', 6, null, 120, null),
      (1, 2078, 4, 'STICKER NUEVO CHULA', 6, null, 90, null),
      (1, 2078, 5, 'STICKER PEQUEÑO CHULA', 9, null, 153, null),
      (1, 2078, 6, 'STICKER GRANDE CHULA', 49, null, 931, null),
      (1, 2078, 7, 'TAPE CHULA', 1, null, 30, null),
      (1, 2078, 8, 'TAZA CHULA', 3, null, 285, null),
      (1, 2079, 1, 'JABONES ARTESANALES', 3, null, 105, null),
      (1, 2080, 1, 'VASO OL U. COLECCION MAPA GUATE', 2, null, 36, null),
      (1, 2080, 2, 'VASO OL U. COLECCION MONTAÑAS GUATE', 5, null, 90, null),
      (1, 2080, 3, 'VASO OL 4 PACK COLECCION MASCARAS', 3, null, 252, null),
      (1, 2081, 1, 'TARJETA DE VENDEDORA', 13, null, 260, null),
      (1, 2081, 2, 'TARJETA DE HUIPIL', 14, null, 210, null),
      (1, 2081, 3, 'TARJETA DE CORTE', 6, null, 72, null),
      (1, 2082, 1, 'POPOL VUH HEROES GEMELOS', 7, null, 700, null),
      (1, 2082, 2, 'POPOL VUH LA CREACION', 4, null, 364, null),
      (1, 2083, 1, 'PAR DE ARETES', 2, null, 200, null),
      (1, 2084, 1, 'IMPRESIONES GUATEMALA 12X18 PULGADAS', 7, null, 1307.25, null),
      (1, 2084, 2, 'IMPRESIONES GUATEMALA 8X11 PULGADAS', 3, null, 393.63, null),
      (1, 2084, 3, 'POSTALES GUATEMALA 10X15', 18, null, 510.3, null),
      (1, 2085, 1, 'LIBROS', 1, null, 120, null),
      (1, 2085, 2, 'CALENDARIOS', 2, null, 150, null),
      (1, 2085, 3, 'MAGNETOS', 16, null, 320, null),
      (1, 2085, 4, 'SEPARADORES', 4, null, 12, null),
      (1, 2085, 5, 'ACUARELAS', 2, null, 160, null),
      (1, 2085, 6, 'POSTALES', 113, null, 339, null),
      (1, 2086, 1, 'ARETES', 7, null, 185, null),
      (1, 2086, 2, 'COLAS', 1, null, 35, null),
      (1, 2086, 3, 'MONEDERO MEDIANO', 1, null, 50, null),
      (1, 2087, 1, 'POSTALES', 5, null, 75, null),
      (1, 2087, 2, 'STICKER HOLOGRAFICO', 9, null, 270, null),
      (1, 2088, 1, 'IMANES', 7, null, 315, null),
      (1, 2088, 2, 'LIBRETAS', 2, null, 250, null),
      (1, 2088, 3, 'PINES', 11, null, 495, null),
      (1, 2088, 4, 'PORTAVASOS', 18, null, 810, null),
      (1, 2089, 1, 'BLOCK DE NOTAS DIVERSOS', 7, null, 168, null),
      (1, 2089, 2, 'BLOCK DE NOTS MAGNETICO', 1, null, 23, null),
      (1, 2089, 3, 'CUADERNOS', 8, null, 416.4, null),
      (1, 2089, 4, 'IMANES', 19, null, 331.55, null),
      (1, 2089, 5, 'EMPAQUE POSTALES', 12, null, 354, null),
      (1, 2089, 6, 'SEPARADORES DIVERSOS', 30, null, 574.5, null),
      (1, 2089, 7, 'STICKERS', 17, null, 391, null),
      (1, 2089, 8, 'FLASHCARDS', 1, null, 97.5, null),
      (1, 2090, 1, 'LIBRO GUATEMALA INMORTAL', 1, null, 790, null),
      (1, 2091, 1, 'MAZOS DE JUSTICIA DE MADERA', 2, null, 550, null),
      (1, 2092, 1, 'TRANSPORTE', 1, null, 1400, null),
      (1, 2093, 1, 'ROUTER', 1, null, 895, null),
      (1, 2094, 1, 'DONACION', 1, null, 7000, null),
      (1, 2095, 1, 'SERVICIOS DE AUDIO', 1, null, 1500, null),
      (1, 2096, 1, 'ALQUILER DE MOBILIARIO', 1, null, 1410, null),
      (1, 2097, 1, 'RADIOS', 4, null, 2316.04, null),
      (1, 2097, 2, 'MANOS LIBRES SILICON', 8, null, 1280, null),
      (1, 2098, 1, 'COMPRA DE PIZZAS', 1, null, 156, null),
      (1, 2099, 1, 'COMPRA DE PIZZAS', 1, null, 300, null),
      (1, 2100, 1, 'MATERIALES Y ACCESORIOS', 1, null, 503.5, null),
      (1, 2101, 1, 'COMPRA DE BOMBILLAS LED', 1, null, 1791.82, null),
      (1, 2102, 1, 'FLETE ZONA 10 A LA ANTIGUA', 1, null, 1400, null),
      (1, 2103, 1, 'FLETE DE OBRAS DE ARTE', 1, null, 900, null),
      (1, 2104, 1, 'ENCENDEDORES', 2, null, 24, null),
      (1, 2105, 1, 'RENTA DE BODEGA EN ZONA 4', 1, null, 1594, null),
      (1, 2106, 1, 'ARRENDAMIENTO BODEGA ZONA 4', 1, null, 1432, null),
      (1, 2107, 1, 'MOTOCICLETA ITALIKA 2027', 1, null, 8500, null),
      (1, 2108, 1, 'MOTOCICLETA ITALIKA 2027', 1, null, 8500, null)),
  x as (
    insert into public.compra_items (compra_id, linea, descripcion, cantidad, costo_total, cantidad_anterior, costo_total_anterior)
    select c.id, m.linea, m.descripcion, m.cantidad, m.costo, m.cantidad_ant, m.costo_ant
    from m join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc
    join public.compras c on c.localidad_id = l.id and c.origen_anterior = 'VARIAS' and c.compra_anterior = m.compra
    on conflict (compra_id, linea) do update set descripcion = excluded.descripcion, cantidad = excluded.cantidad, costo_total = excluded.costo_total,
      cantidad_anterior = excluded.cantidad_anterior, costo_total_anterior = excluded.costo_total_anterior
    returning (xmax = 0) as nueva)
  select count(*) filter (where nueva), count(*) filter (where not nueva), (select count(*) from m) - count(*) into v_n, v_a, v_sin from x;
  alter table public.compra_items enable trigger compra_items_validar;
  raise notice '%', format('Detalle de compras de la organización 7 (parte 2 de 2): %s líneas nuevas, %s actualizadas.%s', v_n, v_a,
    case when v_sin > 0 then format(' %s líneas de compras que no existen (omitidas: ejecuta antes el script 229).', v_sin) else '' end);
end;
$items$;

notify pgrst, 'reload schema';
