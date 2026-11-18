-- Verificación de los scripts 271 a 273 (inventario de la organización 4, Tecnoalsa). SOLO LEE. Muestra solo lo que no está OK:
-- si no devuelve renglones, todo está completo.
with o as (select id from public.organizaciones where codigo::text = '4'),
v(n, script, que, esperado, encontrado) as (values
  (1, 271, 'Clasificación 1 «EQUIPO DE PANADERIA» con sus datos', 1::bigint,
     (select count(*) from public.clasificaciones_producto c join public.localidades l on l.id = c.localidad_id where l.organizacion_id = (select id from o) and c.codigo_anterior = 1 and not c.creada_al_migrar)),
  (2, 271, 'Motivos de ajuste (ACT_MOTIVOS_AJUSTES)', 10, (select count(*) from public.motivos_ajuste m where m.organizacion_id = (select id from o) and m.codigo_anterior is not null)),
  (3, 271, 'Tipos de movimiento de la organización', 34, (select count(*) from public.tipos_movimiento_organizacion t where t.organizacion_id = (select id from o))),
  (4, 272, 'Documentos de inventario (ajustes, ajustes por lotes, traslados y despachos)', 82,
     (select count(*) from public.documentos_inventario d where d.organizacion_id = (select id from o) and d.origen_anterior = 'MIGRADO')),
  (5, 272, 'Líneas de los documentos de inventario', 319,
     (select count(*) from public.documento_inventario_lineas x join public.documentos_inventario d on d.id = x.documento_id where d.organizacion_id = (select id from o) and d.origen_anterior = 'MIGRADO')),
  (6, 272, 'Movimientos del kardex (ACT_INVENTARIO_MEDICAMENTOS, sin las 2 filas del producto 0)', 3376,
     (select count(*) from public.inventario_movimientos m where m.organizacion_id = (select id from o) and m.origen_anterior = 'MIGRADO')),
  (7, 273, 'Envíos (CAR_ENVIOS)', 609, (select count(*) from public.envios_venta e where e.organizacion_id = (select id from o) and e.envio_anterior is not null)),
  (8, 273, 'Líneas de envíos (CAR_DETALLE_ENVIO, sin la línea vacía)', 1872,
     (select count(*) from public.envio_venta_lineas x join public.envios_venta e on e.id = x.envio_id where e.organizacion_id = (select id from o) and e.envio_anterior is not null))
)
select n, script, que, esperado, encontrado, 'FALTA' as estado from v where encontrado < esperado order by n;
