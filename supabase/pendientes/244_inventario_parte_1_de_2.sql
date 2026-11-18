-- Script 244 · parte 1 de 2 · Inventario de la organización 3, lote del 05-11-2026 al 17-11-2026: traslados y despachos de medicamentos, con la lógica del script 147.
-- Archivos: ACT_TRASLADOS y ACT_DETALLE_TRASLADOS; ACT_DESPACHOS_MED, ACT_DETALLE_DESPACHOS_MED y ACT_SUBDETALLE_DESPACHOS_MED (costo de cada lote). El lote no trae ajustes.
-- Al final, cada despacho nuevo queda también como envío (Ventas › Envíos), igual que el script 160, en quetzales (script 219).
-- Ajustes por producto (0), ajustes por lotes (0), traslados (2) y despachos de medicamentos (4) con sus 16 líneas.
-- Si el documento o la línea ya existen (empresa + tipo + número, y documento + línea), se actualizan.
-- Los documentos operados en el sistema anterior no generan movimientos aquí: su movimiento está en el kardex
-- histórico (partes 147_kardex). Se ejecuta después del script 146 y antes de las partes del kardex.
select set_config('fin.docinv', 'si', false);

-- Bodega 7 de Futura Farma (la usan ajustes por lotes y el kardex anterior), si no existe.
insert into public.bodegas (organizacion_id, localidad_id, codigo, nombre)
select l.organizacion_id, l.id, 7, 'BODEGA 7' from public.localidades l join public.organizaciones o on o.id = l.organizacion_id and o.codigo = 3
where l.correlativo = 1 and not exists (select 1 from public.bodegas b where b.localidad_id = l.id and b.codigo = 7);

insert into public.documentos_inventario (organizacion_id, localidad_id, tipo, numero, fecha, estado, bodega_id, bodega_destino_id, motivo_id, direccion, descripcion, usuario, usuario_nombre,
  operado_por, operado_en, anulado_por, anulado_en, origen_anterior, estado_anterior, fecha_conta, tipo_traslado, receptor, tipo_receptor, cliente_codigo, empleado_codigo, tipo_precio_codigo,
  pct_iva, fecha_entrega, tipo_despacho, efectivo, tarjeta, empresa_codigo, aplicar_desglose, direccion_entrega, nombre_repenvio, direccion_repenvio, valor_total)
select l.organizacion_id, l.id, v.tipo, v.numero, coalesce((v.fecha::timestamp at time zone 'America/Guatemala'), now()), v.estado, b.id, bd.id, m.id, v.direccion, v.descripcion, v.usuario, '',
  case when v.estado = 'OPERADO' then v.usuario end, case when v.estado = 'OPERADO' then (v.operado::timestamp at time zone 'America/Guatemala') end,
  case when v.estado = 'ANULADO' then v.usuario end, case when v.estado = 'ANULADO' then (v.anulado::timestamp at time zone 'America/Guatemala') end, 'MIGRADO', v.estado_ant, (v.conta::timestamp at time zone 'America/Guatemala'), v.tipo_traslado,
  v.receptor, v.tipo_receptor, v.cliente, v.empleado, v.tipo_precio, v.pct_iva, v.entrega::date, v.tipo_despacho, v.efectivo, v.tarjeta, v.empresa, v.desglose, v.dir_ent, v.nombre_rep, v.dir_rep, coalesce(v.valor, 0)
from (values
(1::integer, 'TRASLADO'::text, 142::integer, '2026-11-13 14:08:16'::text, 'OPERADO'::text, 4::integer, 2::integer, NULL::integer, NULL::text, 'HOSP NAC COATEPEQUE BC OC 124194'::text, 'KER'::text, '2026-11-13 14:09:38'::text, NULL::text, 'E'::text, '2026-11-13 14:09:38'::text, 'E'::text, NULL::text, NULL::text, NULL::numeric, NULL::numeric, NULL::text, NULL::numeric, NULL::text, NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::text, NULL::text, NULL::text, NULL::text, NULL::numeric),
(1, 'TRASLADO', 143, '2026-11-17 15:48:34', 'OPERADO', 5, 2, NULL, NULL, 'YARDEN', 'KER', '2026-11-17 15:49:20', NULL, 'E', '2026-11-17 15:49:20', 'E', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(1, 'DESPACHO', 41, '2026-11-11 13:02:28', 'OPERADO', 10, NULL, NULL, 'DISMINUIR', 'DESTRUCCION DE PRODUCTO ECO-TERMO', 'OLM', '2026-11-11 13:07:02', NULL, 'O', '2026-11-11 13:07:02', NULL, 'NO ASIGNADO', 'N', 0, 6, 'P', 12, '2026-11-11 00:00:00', 'O', 95573.47, 0, 1, 'S', NULL, NULL, NULL, 95573.47),
(1, 'DESPACHO', 42, '2026-11-12 12:40:30', 'OPERADO', 4, NULL, NULL, 'DISMINUIR', '2 FALTANTES EN IMPORTACION VI296091', 'OLM', '2026-11-12 12:41:26', NULL, 'O', '2026-11-12 12:41:26', NULL, 'NO ASIGNADO', 'N', 0, 6, 'P', 12, '2026-11-12 00:00:00', 'O', 24.66, 0, 1, 'S', NULL, NULL, NULL, 24.66),
(1, 'DESPACHO', 43, '2026-11-12 12:44:14', 'OPERADO', 4, NULL, NULL, 'DISMINUIR', '1 UNIDAD QUEBRADA VI296091', 'OLM', '2026-11-12 12:44:55', NULL, 'O', '2026-11-12 12:44:55', NULL, 'NO ASIGNADO', 'N', 0, 6, 'P', 12, '2026-11-12 00:00:00', 'O', 12.33, 0, 1, 'S', NULL, NULL, NULL, 12.33),
(1, 'DESPACHO', 44, '2026-11-12 12:47:19', 'OPERADO', 4, NULL, NULL, 'DISMINUIR', '1 MUESTRA PARA NOG 32346883', 'OLM', '2026-11-12 12:51:26', NULL, 'O', '2026-11-12 12:51:26', NULL, 'NO ASIGNADO', 'N', 0, 6, 'P', 12, '2026-11-12 00:00:00', 'O', 26.88, 0, 1, 'S', NULL, NULL, NULL, 26.88)
) as v(loc, tipo, numero, fecha, estado, bodega, destino, motivo, direccion, descripcion, usuario, operado, anulado, estado_ant, conta, tipo_traslado,
       receptor, tipo_receptor, cliente, empleado, tipo_precio, pct_iva, entrega, tipo_despacho, efectivo, tarjeta, empresa, desglose, dir_ent, nombre_rep, dir_rep, valor)
join public.localidades l on l.correlativo = v.loc join public.organizaciones o on o.id = l.organizacion_id and o.codigo = 3
join public.bodegas b on b.localidad_id = l.id and b.codigo = v.bodega
left join public.bodegas bd on bd.localidad_id = l.id and bd.codigo = v.destino
left join public.motivos_ajuste m on m.organizacion_id = l.organizacion_id and m.codigo = v.motivo
on conflict (localidad_id, tipo, numero) do update set fecha = excluded.fecha, estado = excluded.estado, bodega_id = excluded.bodega_id, bodega_destino_id = excluded.bodega_destino_id,
  motivo_id = excluded.motivo_id, direccion = excluded.direccion, descripcion = excluded.descripcion, usuario = excluded.usuario, operado_por = excluded.operado_por, operado_en = excluded.operado_en,
  anulado_por = excluded.anulado_por, anulado_en = excluded.anulado_en, estado_anterior = excluded.estado_anterior, fecha_conta = excluded.fecha_conta, tipo_traslado = excluded.tipo_traslado,
  receptor = excluded.receptor, tipo_receptor = excluded.tipo_receptor, cliente_codigo = excluded.cliente_codigo, empleado_codigo = excluded.empleado_codigo, tipo_precio_codigo = excluded.tipo_precio_codigo,
  pct_iva = excluded.pct_iva, fecha_entrega = excluded.fecha_entrega, tipo_despacho = excluded.tipo_despacho, efectivo = excluded.efectivo, tarjeta = excluded.tarjeta, empresa_codigo = excluded.empresa_codigo,
  aplicar_desglose = excluded.aplicar_desglose, direccion_entrega = excluded.direccion_entrega, nombre_repenvio = excluded.nombre_repenvio, direccion_repenvio = excluded.direccion_repenvio, valor_total = excluded.valor_total
  where documentos_inventario.origen_anterior = 'MIGRADO';

insert into public.documento_inventario_lineas (documento_id, linea, producto_id, lote, fecha_fabricacion, fecha_vencimiento, nuevo_lote, nueva_fabricacion, nuevo_vencimiento, cantidad, costo_unitario,
  precio_unitario, precio_total, tipo_precio_codigo, entregado, linea_anterior)
select d.id, v.linea, p.id, v.lote, v.fab::date, v.venc::date, v.nlote, v.nfab::date, v.nvenc::date, coalesce(v.cantidad, 0), coalesce(v.costo, 0), v.precio, v.ptotal, v.tprecio, v.entregado, v.lant
from (values
(1::integer, 'TRASLADO'::text, 142::integer, 1::integer, 136::integer, 'IP0C2264'::text, '2026-05-29 00:00:00'::text, '2028-03-29 00:00:00'::text, NULL::text, NULL::text, NULL::text, 500::numeric, 6.8::numeric, NULL::numeric, NULL::numeric, NULL::numeric, 'N'::text, 1::integer),
(1, 'TRASLADO', 143, 1, 140, 'TPS-030', '2025-10-31 00:00:00', '2027-10-31 00:00:00', NULL, NULL, NULL, 50, 7.28, NULL, NULL, NULL, 'N', 1),
(1, 'DESPACHO', 41, 1, 150, '202204N', NULL, '2025-03-31 00:00:00', NULL, NULL, NULL, 17, 336.36, 336.36, 5718.12, 6, NULL, 1),
(1, 'DESPACHO', 41, 2, 150, '202206Q', NULL, '2025-05-31 00:00:00', NULL, NULL, NULL, 18, 336.36, 336.36, 6054.48, 6, NULL, 2),
(1, 'DESPACHO', 41, 3, 149, '202206N', NULL, '2025-05-31 00:00:00', NULL, NULL, NULL, 26, 311.32, 311.32, 8094.32, 6, NULL, 3),
(1, 'DESPACHO', 41, 4, 144, 'L1811', NULL, '2025-11-30 00:00:00', NULL, NULL, NULL, 272, 52.75, 52.75, 14348, 6, NULL, 4),
(1, 'DESPACHO', 41, 5, 145, 'L1353', NULL, '2025-09-30 00:00:00', NULL, NULL, NULL, 222, 95.23, 95.23, 21141.06, 6, NULL, 5),
(1, 'DESPACHO', 41, 6, 146, 'M0704', NULL, '2026-03-31 00:00:00', NULL, NULL, NULL, 282, 46.74, 46.74, 13180.68, 6, NULL, 6),
(1, 'DESPACHO', 41, 7, 147, 'L1788', NULL, '2025-11-30 00:00:00', NULL, NULL, NULL, 64, 89.06, 89.06, 5699.84, 6, NULL, 7),
(1, 'DESPACHO', 41, 11, 140, 'TPS-026', '2024-11-30 00:00:00', '2026-10-30 00:00:00', NULL, NULL, NULL, 1, 9.05, 9.05, 9.05, 6, NULL, 11),
(1, 'DESPACHO', 41, 10, 151, '202304W', NULL, '2026-04-30 00:00:00', NULL, NULL, NULL, 19, 155.25, 155.25, 2949.75, 6, NULL, 10),
(1, 'DESPACHO', 41, 8, 147, 'M0707', NULL, '2026-03-31 00:00:00', NULL, NULL, NULL, 193, 89.06, 89.06, 17188.58, 6, NULL, 8),
(1, 'DESPACHO', 41, 9, 148, '202206V', NULL, '2025-05-31 00:00:00', NULL, NULL, NULL, 57, 20.87, 20.87, 1189.59, 6, NULL, 9),
(1, 'DESPACHO', 42, 1, 139, 'MP0B0265', '2026-05-29 00:00:00', '2028-02-28 00:00:00', NULL, NULL, NULL, 2, 12.33, 12.33, 24.66, 6, NULL, 1),
(1, 'DESPACHO', 43, 1, 139, 'MP0B0265', '2026-05-29 00:00:00', '2028-02-28 00:00:00', NULL, NULL, NULL, 1, 12.33, 12.33, 12.33, 6, NULL, 1),
(1, 'DESPACHO', 44, 1, 136, 'IP0C2265', '2026-05-29 00:00:00', '2028-03-29 00:00:00', NULL, NULL, NULL, 1, 26.88, 26.88, 26.88, 6, NULL, 1)
) as v(loc, tipo, numero, linea, producto, lote, fab, venc, nlote, nfab, nvenc, cantidad, costo, precio, ptotal, tprecio, entregado, lant)
join public.localidades l on l.correlativo = v.loc join public.organizaciones o on o.id = l.organizacion_id and o.codigo = 3
join public.documentos_inventario d on d.localidad_id = l.id and d.tipo = v.tipo and d.numero = v.numero and d.origen_anterior = 'MIGRADO'
join public.productos p on p.localidad_id = l.id and p.codigo = v.producto
on conflict (documento_id, linea) do update set producto_id = excluded.producto_id, lote = excluded.lote, fecha_fabricacion = excluded.fecha_fabricacion, fecha_vencimiento = excluded.fecha_vencimiento,
  nuevo_lote = excluded.nuevo_lote, nueva_fabricacion = excluded.nueva_fabricacion, nuevo_vencimiento = excluded.nuevo_vencimiento, cantidad = excluded.cantidad, costo_unitario = excluded.costo_unitario,
  precio_unitario = excluded.precio_unitario, precio_total = excluded.precio_total, tipo_precio_codigo = excluded.tipo_precio_codigo, entregado = excluded.entregado, linea_anterior = excluded.linea_anterior;

-- Total de los ajustes con su detalle.
update public.documentos_inventario d set valor_total = x.t
from (select documento_id, round(sum(costo_total), 2) as t from public.documento_inventario_lineas group by 1) x
where x.documento_id = d.id and d.origen_anterior = 'MIGRADO' and d.tipo <> 'DESPACHO';

select set_config('fin.docinv', '', false);
select tipo, count(*) as documentos, sum((select count(*) from public.documento_inventario_lineas l where l.documento_id = d.id)) as lineas
from public.documentos_inventario d where d.origen_anterior = 'MIGRADO' group by tipo order by tipo;

-- ===== Envíos desde los despachos de medicamentos (mismo SQL del script 160: solo crea los que faltan) =====
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


-- Moneda de los envíos nuevos (script 219).
update public.envios_venta e set moneda_id = (select m.id from public.monedas m where upper(m.iso) = 'GTQ' order by m.id limit 1) where e.moneda_id is null;

notify pgrst, 'reload schema';
