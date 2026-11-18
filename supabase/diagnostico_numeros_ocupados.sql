-- Diagnóstico (solo lee): facturas del sistema que ocupan los números de las facturas que no se pudieron migrar.
--   · Organización 2, localidad 2-02, números 13921 a 14443 (script 204 parte 68).
--   · Organización 3, localidad 3-01, número 5970 (scripts 238 y 249), DTE serie 7CBA875E número 812076526.
-- El SQL Editor muestra el resultado de la última consulta: primero va el detalle y al final el resumen.
-- A) Detalle de las primeras 20 (para ver si son las mismas facturas con otro número de referencia).
select format('%s-0%s', o.codigo, l.correlativo) as empresa, f.id, f.numero, f.factura_anterior, f.serie, f.numero_dte, f.autorizacion,
       f.fecha_emision::date as fecha, f.nombre, f.total, f.estado, f.origen_anterior, f.creado_por_nombre, f.creado_en::date as creada
from public.facturas_venta f
join public.localidades l on l.id = f.localidad_id
join public.organizaciones o on o.id = l.organizacion_id
where (o.codigo::text = '2' and l.correlativo = 2 and f.numero between 13921 and 14443)
   or (o.codigo::text = '3' and l.correlativo = 1 and f.numero = 5970)
order by o.codigo, f.numero
limit 20;

-- B) Resumen de lo que ocupa cada rango.
select format('%s-0%s', o.codigo, l.correlativo) as empresa,
       case when o.codigo::text = '2' then 'números 13921 a 14443' else 'número 5970' end as rango,
       count(*) as facturas_que_ocupan,
       count(*) filter (where f.factura_anterior is null) as sin_numero_anterior,
       count(*) filter (where f.origen_anterior = 'MIGRADO') as marcadas_migrado,
       string_agg(distinct coalesce(f.origen_anterior, '(sin origen)'), ', ') as origenes,
       string_agg(distinct f.estado, ', ') as estados,
       min(f.fecha_emision)::date as primera_fecha, max(f.fecha_emision)::date as ultima_fecha,
       min(f.creado_en)::date as creadas_desde, max(f.creado_en)::date as creadas_hasta,
       string_agg(distinct coalesce(f.creado_por_nombre, f.usuario, '?'), ', ') as quien_las_creo
from public.facturas_venta f
join public.localidades l on l.id = f.localidad_id
join public.organizaciones o on o.id = l.organizacion_id
where (o.codigo::text = '2' and l.correlativo = 2 and f.numero between 13921 and 14443)
   or (o.codigo::text = '3' and l.correlativo = 1 and f.numero = 5970)
group by o.codigo, l.correlativo;

