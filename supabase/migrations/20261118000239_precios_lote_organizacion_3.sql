-- Script 239 · Organización 3 (Futura Farma - Mavisa), lote del 05-11-2026 al 17-11-2026: precios de los productos (ACT_PRECIOS.xls, 27 precios
--   de 27 productos: 27 de la 3-02), con la lógica del script 103.
--   Un precio se identifica por su localidad, código de producto y tipo de precio: si ya existe se actualiza (precio, fecha, descuentos,
--   utilidad, precio base, estado y usuarios). Si el producto aún no existe queda con su código y se liga al crearlo (disparador del script 103).
--   Columnas con datos: todas ya existen en producto_precios (script 103). Columnas vacías (no se migran): PRECIO_ALTERNO, USR_MODIFICA, FECHA_MODIFICA.
--   Se puede ejecutar de nuevo.
set lock_timeout = '20s';

do $precios$
declare v_org bigint; v_n int; v_a int; v_l int; v_s int; v_s_txt text;
begin
  select id into v_org from public.organizaciones where codigo::text = '3';
  if v_org is null then raise exception 'No existe la organización 3.'; end if;
  with m (loc, producto, tipo, fecha, precio, alterno, descuento, estado, usr_ing, f_ing, usr_mod, f_mod, aplicado, utilidad, base) as (values
      (2::integer, 209::integer, 3::integer, '2026-11-13 15:46:20'::timestamp, 28::numeric, null::numeric, 0::numeric, 'ACTIVO'::text, 'OLM'::text, '2026-11-13 15:46:20'::timestamp, null::text, null::timestamp, 0::numeric, 45::numeric, 0::numeric),
      (2, 210, 3, '2026-11-13 16:05:57', 50, null, 0, 'ACTIVO', 'OLM', '2026-11-13 16:05:57', null, null, 0, 45, 0),
      (2, 211, 3, '2026-11-13 15:48:17', 254.5, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:48:17', null, null, 0, 45, 0),
      (2, 212, 3, '2026-11-13 15:48:52', 254.5, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:48:52', null, null, 0, 45, 0),
      (2, 213, 3, '2026-11-13 15:49:21', 254.5, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:49:21', null, null, 0, 45, 0),
      (2, 214, 3, '2026-11-13 15:49:34', 254.5, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:49:34', null, null, 0, 45, 0),
      (2, 215, 3, '2026-11-13 15:51:23', 290, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:51:23', null, null, 0, 45, 0),
      (2, 216, 3, '2026-11-13 15:51:50', 60, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:51:50', null, null, 0, 45, 0),
      (2, 217, 3, '2026-11-13 15:52:07', 60, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:52:07', null, null, 0, 45, 0),
      (2, 218, 3, '2026-11-13 15:52:17', 98, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:52:17', null, null, 0, 45, 0),
      (2, 219, 3, '2026-11-13 15:52:48', 98, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:52:48', null, null, 0, 45, 0),
      (2, 220, 3, '2026-11-13 15:52:57', 61, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:52:57', null, null, 0, 45, 0),
      (2, 221, 3, '2026-11-13 15:53:20', 61, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:53:20', null, null, 0, 45, 0),
      (2, 222, 3, '2026-11-13 15:53:38', 63.5, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:53:38', null, null, 0, 45, 0),
      (2, 223, 3, '2026-11-13 15:54:12', 63.5, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:54:12', null, null, 0, 45, 0),
      (2, 224, 3, '2026-11-13 15:54:23', 88, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:54:23', null, null, 0, 45, 0),
      (2, 225, 3, '2026-11-13 15:57:15', 100, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:57:15', null, null, 0, 45, 0),
      (2, 226, 3, '2026-11-13 15:57:37', 60, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:57:37', null, null, 0, 45, 0),
      (2, 227, 3, '2026-11-13 15:58:01', 1.65, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:58:01', null, null, 0, 45, 0),
      (2, 228, 3, '2026-11-13 15:59:09', 1.65, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:59:09', null, null, 0, 45, 0),
      (2, 229, 3, '2026-11-13 15:59:19', 358, null, 0, 'ACTIVO', 'OLM', '2026-11-13 15:59:19', null, null, 0, 45, 0),
      (2, 230, 3, '2026-11-13 16:00:32', 12, null, 0, 'ACTIVO', 'OLM', '2026-11-13 16:00:32', null, null, 0, 45, 0),
      (2, 231, 3, '2026-11-13 16:01:01', 8.25, null, 0, 'ACTIVO', 'OLM', '2026-11-13 16:01:01', null, null, 0, 45, 0),
      (2, 232, 3, '2026-11-13 16:02:42', 9.45, null, 0, 'ACTIVO', 'OLM', '2026-11-13 16:02:42', null, null, 0, 45, 0),
      (2, 233, 3, '2026-11-13 16:03:22', 10.2, null, 0, 'ACTIVO', 'OLM', '2026-11-13 16:03:22', null, null, 0, 45, 0),
      (2, 234, 3, '2026-11-13 16:03:43', 14.35, null, 0, 'ACTIVO', 'OLM', '2026-11-13 16:03:43', null, null, 0, 45, 0),
      (2, 235, 3, '2026-11-13 16:04:20', 145, null, 0, 'ACTIVO', 'OLM', '2026-11-13 16:04:20', null, null, 0, 45, 0)),
  mc as (select m.*, l.id as loc_id, (select tp.id from public.tipos_precio tp where tp.localidad_id = l.id and tp.codigo = m.tipo) as tp_id,
                (select p.id from public.productos p where p.localidad_id = l.id and p.codigo = m.producto) as prod_id
         from m join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc),
  x as (
    insert into public.producto_precios (producto_id, tipo_precio_id, precio, localidad_id, producto_codigo, fecha, precio_alterno, pct_descuento, estado,
      usuario_ingresa, fecha_ingresa, usuario_modifica, fecha_modifica, descuento_aplicado, pct_utilidad, precio_base)
    select prod_id, tp_id, precio, loc_id, producto, fecha::timestamptz, alterno, descuento, estado, usr_ing, f_ing::timestamptz, usr_mod, f_mod::timestamptz,
           aplicado, utilidad, base
    from mc where tp_id is not null
    on conflict (localidad_id, producto_codigo, tipo_precio_id) where producto_codigo is not null do update set
      producto_id = coalesce(public.producto_precios.producto_id, excluded.producto_id), precio = excluded.precio, fecha = excluded.fecha,
      precio_alterno = excluded.precio_alterno, pct_descuento = excluded.pct_descuento, estado = excluded.estado,
      usuario_ingresa = excluded.usuario_ingresa, fecha_ingresa = excluded.fecha_ingresa, usuario_modifica = excluded.usuario_modifica,
      fecha_modifica = excluded.fecha_modifica, descuento_aplicado = excluded.descuento_aplicado, pct_utilidad = excluded.pct_utilidad,
      precio_base = excluded.precio_base
    returning (xmax = 0) as nuevo, producto_id is not null as ligado)
  select count(*) filter (where nuevo), count(*) filter (where not nuevo), count(*) filter (where ligado),
         (select count(*) from mc where tp_id is null), (select string_agg(format('3-0%s producto %s tipo %s', loc, producto, tipo), ', ') from mc where tp_id is null)
    into v_n, v_a, v_l, v_s, v_s_txt from x;
  raise notice '%', format('Precios de la organización 3: %s nuevos, %s actualizados (%s con su producto).%s', v_n, v_a, v_l,
    case when v_s > 0 then format(' %s sin tipo de precio (omitidos): %s.', v_s, v_s_txt) else '' end);
end;
$precios$;
