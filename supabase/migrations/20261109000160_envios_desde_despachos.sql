-- Envíos de la organización 3 desde los despachos de medicamentos migrados del sistema anterior (script 147).
-- En el sistema anterior el «despacho de medicamentos» era el envío de producto a un cliente sin factura: receptor,
-- dirección de entrega, tipo de precio y valor. Cada despacho queda como un envío (Ventas › Envíos) con sus productos,
-- lote y fechas; el documento de inventario sigue siendo el que movió el kardex. Se puede ejecutar más de una vez.

alter table public.envios_venta add column if not exists documento_inventario_id bigint references public.documentos_inventario (id) on delete set null;
create unique index if not exists envios_venta_documento_idx on public.envios_venta (documento_inventario_id) where documento_inventario_id is not null;

insert into public.envios_venta (organizacion_id, localidad_id, numero, fecha, estado, bodega_id, cliente_id, cliente_codigo, nombre, nit, telefono, direccion, forma_pago, dias_credito,
  tipo_precio_id, total, observaciones, usuario, anulado_por, anulado_en, creado_en, documento_inventario_id)
select d.organizacion_id, d.localidad_id,
       case when exists (select 1 from public.envios_venta x where x.localidad_id = d.localidad_id and x.numero = d.numero) then null else d.numero end,
       (d.fecha at time zone 'America/Guatemala')::date,
       case when d.estado = 'ANULADO' then 'ANULADO' else 'EMITIDO' end,
       d.bodega_id, c.id, coalesce(c.codigo::text, d.cliente_codigo::text),
       coalesce(nullif(trim(c.nombre), ''), nullif(trim(d.receptor), ''), nullif(trim(d.nombre_repenvio), ''), 'CLIENTE'),
       c.documento, c.telefono,
       coalesce(nullif(trim(d.direccion_entrega), ''), nullif(trim(d.direccion_repenvio), ''), nullif(trim(d.direccion), ''), c.direccion),
       'CONTADO', 0, tp.id, coalesce(d.valor_total, 0),
       concat_ws(' · ', nullif(trim(d.descripcion), ''), 'Despacho de medicamentos No. ' || d.numero || ' del sistema anterior', case when nullif(trim(d.nombre_repenvio), '') is not null then 'Reporte de envío: ' || trim(d.nombre_repenvio) end),
       coalesce(d.usuario, 'MIGRADO'), d.anulado_por, d.anulado_en, d.fecha, d.id
from public.documentos_inventario d
left join public.clientes c on c.localidad_id = d.localidad_id and c.codigo::text = d.cliente_codigo::text
left join public.tipos_precio tp on tp.localidad_id = d.localidad_id and tp.codigo::text = d.tipo_precio_codigo::text
where d.tipo = 'DESPACHO'
  and not exists (select 1 from public.envios_venta e where e.documento_inventario_id = d.id);

insert into public.envio_venta_lineas (envio_id, linea, producto_id, producto_codigo, descripcion, cantidad, precio, total, lote, fecha_vencimiento, fecha_fabricacion)
select e.id, row_number() over (partition by e.id order by l.linea, l.id), l.producto_id, p.codigo::text, coalesce(p.nombre, 'PRODUCTO'),
       abs(l.cantidad), coalesce(l.precio_unitario, 0), coalesce(l.precio_total, abs(l.cantidad) * coalesce(l.precio_unitario, 0)), nullif(trim(l.lote), ''), l.fecha_vencimiento, l.fecha_fabricacion
from public.envios_venta e
join public.documento_inventario_lineas l on l.documento_id = e.documento_inventario_id
left join public.productos p on p.id = l.producto_id
where not exists (select 1 from public.envio_venta_lineas x where x.envio_id = e.id);

-- Total del envío según sus líneas cuando el documento no traía valor.
update public.envios_venta e set total = s.t
from (select envio_id, sum(total) t from public.envio_venta_lineas group by envio_id) s
where s.envio_id = e.id and e.documento_inventario_id is not null and coalesce(e.total, 0) = 0;

notify pgrst, 'reload schema';
select count(*) || ' envíos desde despachos de medicamentos (' || (select count(*) from public.envio_venta_lineas l join public.envios_venta e on e.id = l.envio_id where e.documento_inventario_id is not null) || ' líneas).' as resultado
from public.envios_venta where documento_inventario_id is not null;
