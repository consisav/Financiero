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
-- Script 244 · parte 2 de 2 · Kardex del sistema anterior del 05-11-2026 al 17-11-2026 (ACT_INVENTARIO_MEDICAMENTOS.xls, 187 movimientos), con la lógica del script 147.
-- Organización 3: Futura Farma (1) y Mavisa (2). Continúa el kardex del script 147: cada movimiento se identifica por empresa, bodega, producto y REGISTRO.
-- Las facturas (238) y notas de compras (243) migradas no mueven inventario: su salida o entrada es la de este kardex.
-- Un movimiento de un producto que no existe en la empresa no se carga (en este lote: el producto 236 de la 3-02, que no está en el catálogo migrado).
-- Se ejecuta después del script 147 (documentos). Si el movimiento ya existe (empresa + bodega + producto + registro), se actualiza.
-- La cantidad lleva el signo de su tipo de movimiento (+ entrada / − salida).
-- Al final van 0 saldos iniciales (registro 0) para que la existencia sea la del sistema anterior.
insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, lote, fecha_vencimiento, usuario, creado_en,
  tipo_movimiento, registro_anterior, no_doc_anterior, linea_anterior, documento_fisico, observaciones, existencias_anterior, existencia_acumulada, existencia_lote, costo_total, costo_movimiento,
  costo_promedio, estado_anterior, fecha_movimiento, fecha_fabricacion, origen_anterior)
select l.organizacion_id, l.id, p.id, b.id, v.fdoc::date, t.tipo_operacion * coalesce(v.cant, 0), coalesce(v.cu, 0), public.origen_tipo_movimiento(v.tipo), nullif(trim(v.lote), ''), v.fvenc::date, v.usr,
  coalesce((v.fmov::timestamp at time zone 'America/Guatemala'), now()), v.tipo, v.reg, v.nodoc, v.linea, trim(v.docf), v.obs, v.exi, v.exa, v.exl, v.ct, v.cmov, v.cprom, v.est, (v.fmov::timestamp at time zone 'America/Guatemala'), v.ffab::date, 'MIGRADO'
from (values
(1::integer, 2::integer, 136::integer, 7::integer, 3::integer, 142::integer, 1::integer, '2026-11-13 14:08:16'::text, 500::numeric, 0::numeric, 'MOVIMIENTO AUTOMATICO DE: INGRESO'::text, 'KER'::text, 24.4916::numeric, 12245.8::numeric, 'IP0C2264'::text, '2028-03-29 00:00:00'::text, '142'::text, 500::numeric, 500::numeric, 12245.8::numeric, 24.4916::numeric, 'V'::text, '2026-11-13 14:09:38'::text, '2026-05-29 00:00:00'::text),
(1,2,136,8,19,5976,1,'2026-11-13 00:00:00',500,500,'MOVIMIENTO AUTOMATICO DE: EGRESO','KER',24.4916,0,'IP0C2264','2028-03-29 00:00:00','FE-2962',0,0,12245.8,24.4916,'V','2026-11-13 14:17:52','2026-05-29 00:00:00'),
(1,2,140,100,3,143,1,'2026-11-17 15:48:34',50,105,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',50.9502,7897.281,'TPS-030','2027-10-31 00:00:00','143',155,55,2547.51,50.9502,'V','2026-11-17 15:49:20','2025-10-31 00:00:00'),
(1,2,140,99,19,5973,1,'2026-11-11 00:00:00',100,205,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',50.9502,5349.771,'TPS-032','2028-02-25 00:00:00','FE-2959',105,100,5095.02,50.9502,'V','2026-11-11 11:07:01','2026-02-25 00:00:00'),
(1,2,152,74,19,5972,1,'2026-11-10 00:00:00',234,403,'MOVIMIENTO AUTOMATICO DE: EGRESO','KER',210.08,35503.52,'ET0I2261','2028-09-23 00:00:00','FE-2958',169,154,49158.72,210.08,'V','2026-11-10 08:18:10','2026-09-23 00:00:00'),
(1,2,152,75,1,511,1,'2026-11-12 00:00:00',300,169,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',236.08,106327.52,'ET0I2261','2028-09-23 00:00:00','1175736187',469,454,70824,226.7111,'V','2026-11-12 10:48:39','2026-09-23 00:00:00'),
(1,2,152,72,19,5970,1,'2026-11-06 00:00:00',5,768,'MOVIMIENTO AUTOMATICO DE: EGRESO','KER',210.08,160291.04,'ET0B1267','2028-02-27 00:00:00','FE-2956',763,15,1050.4,210.08,'V','2026-11-06 12:40:15','2026-03-27 00:00:00'),
(1,2,152,73,19,5971,1,'2026-11-06 00:00:00',360,763,'MOVIMIENTO AUTOMATICO DE: EGRESO','KER',210.08,84662.24,'ET0I2261','2028-09-23 00:00:00','FE-2957',403,388,75628.8,210.08,'V','2026-11-06 13:58:50','2026-09-23 00:00:00'),
(1,2,152,76,1,512,1,'2026-11-12 00:00:00',300,469,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',236.08,177151.5059,'ET0I2261','2028-09-23 00:00:00','1335642054',769,754,70824,230.3661,'V','2026-11-12 10:50:27','2026-09-23 00:00:00'),
(1,2,152,77,19,5974,1,'2026-11-12 00:00:00',300,769,'MOVIMIENTO AUTOMATICO DE: EGRESO','KER',230.3661,108041.7009,'ET0I2261','2028-09-23 00:00:00','FE-2960',469,454,69109.83,230.3661,'V','2026-11-12 10:59:41','2026-09-23 00:00:00'),
(1,2,152,78,19,5975,1,'2026-11-12 00:00:00',300,469,'MOVIMIENTO AUTOMATICO DE: EGRESO','KER',230.3661,38931.8709,'ET0I2261','2028-09-23 00:00:00','FE-2961',169,154,69109.83,230.3661,'V','2026-11-12 11:12:34','2026-09-23 00:00:00'),
(1,4,136,125,2,44,1,'2026-11-12 00:00:00',1,17758,'MOVIMIENTO AUTOMATICO DE: EGRESO','OLM',6.8,120747.6,'IP0C2265','2028-03-29 00:00:00','44',17757,8088,6.8,6.8,'V','2026-11-12 12:51:26','2026-05-29 00:00:00'),
(1,4,136,126,4,142,1,'2026-11-13 14:08:16',500,17757,'MOVIMIENTO AUTOMATICO DE: EGRESO','KER',6.8,117347.6,'IP0C2264','2028-03-29 00:00:00','142',17257,1349,3400,6.8,'V','2026-11-13 14:09:38','2026-05-29 00:00:00'),
(1,4,139,111,2,42,1,'2026-11-12 00:00:00',2,38590,'MOVIMIENTO AUTOMATICO DE: EGRESO','OLM',4.8,185222.4,'MP0B0265','2028-02-28 00:00:00','42',38588,38588,9.6,4.8,'V','2026-11-12 12:41:26','2026-05-29 00:00:00'),
(1,4,139,112,2,43,1,'2026-11-12 00:00:00',1,38588,'MOVIMIENTO AUTOMATICO DE: EGRESO','OLM',4.8,185217.6,'MP0B0265','2028-02-28 00:00:00','43',38587,38587,4.8,4.8,'V','2026-11-12 12:44:55','2026-05-29 00:00:00'),
(1,5,140,339,4,143,1,'2026-11-17 15:48:34',50,774,'MOVIMIENTO AUTOMATICO DE: EGRESO','KER',7.28,5270.72,'TPS-030','2027-10-31 00:00:00','143',724,724,364,7.28,'V','2026-11-17 15:49:20','2025-10-31 00:00:00'),
(1,10,140,2,2,41,11,'2026-11-11 00:00:00',1,1,'MOVIMIENTO AUTOMATICO DE: EGRESO','OLM',7.28,0,'TPS-026','2026-10-30 00:00:00','41',0,0,7.28,7.28,'V','2026-11-11 13:07:02','2024-11-30 00:00:00'),
(1,10,144,4,2,41,4,'2026-11-11 00:00:00',272,272,'MOVIMIENTO AUTOMATICO DE: EGRESO','OLM',50.56,0,'L1811','2025-11-30 00:00:00','41',0,0,13752.32,50.56,'V','2026-11-11 13:07:02',NULL),
(1,10,145,4,2,41,5,'2026-11-11 00:00:00',222,222,'MOVIMIENTO AUTOMATICO DE: EGRESO','OLM',91.28,0,'L1353','2025-09-30 00:00:00','41',0,0,20264.16,91.28,'V','2026-11-11 13:07:02',NULL),
(1,10,146,2,2,41,6,'2026-11-11 00:00:00',282,282,'MOVIMIENTO AUTOMATICO DE: EGRESO','OLM',44.8,0,'M0704','2026-03-31 00:00:00','41',0,0,12633.6,44.8,'V','2026-11-11 13:07:02',NULL),
(1,10,147,5,2,41,7,'2026-11-11 00:00:00',64,257,'MOVIMIENTO AUTOMATICO DE: EGRESO','OLM',85.36,16474.48,'L1788','2025-11-30 00:00:00','41',193,0,5463.04,85.36,'V','2026-11-11 13:07:02',NULL),
(1,10,147,6,2,41,8,'2026-11-11 00:00:00',193,193,'MOVIMIENTO AUTOMATICO DE: EGRESO','OLM',85.36,0,'M0707','2026-03-31 00:00:00','41',0,0,16474.48,85.36,'V','2026-11-11 13:07:02',NULL),
(1,10,148,2,2,41,9,'2026-11-11 00:00:00',57,57,'MOVIMIENTO AUTOMATICO DE: EGRESO','OLM',20,0,'202206V','2025-05-31 00:00:00','41',0,0,1140,20,'V','2026-11-11 13:07:02',NULL),
(1,10,149,2,2,41,3,'2026-11-11 00:00:00',26,26,'MOVIMIENTO AUTOMATICO DE: EGRESO','OLM',298.4,0,'202206N','2025-05-31 00:00:00','41',0,0,7758.4,298.4,'V','2026-11-11 13:07:02',NULL),
(1,10,150,4,2,41,2,'2026-11-11 00:00:00',18,18,'MOVIMIENTO AUTOMATICO DE: EGRESO','OLM',322.4,0,'202206Q','2025-05-31 00:00:00','41',0,0,5803.2,322.4,'V','2026-11-11 13:07:02',NULL),
(1,10,150,3,2,41,1,'2026-11-11 00:00:00',17,35,'MOVIMIENTO AUTOMATICO DE: EGRESO','OLM',322.4,5803.2,'202204N','2025-03-31 00:00:00','41',18,0,5480.8,322.4,'V','2026-11-11 13:07:02',NULL),
(1,10,151,2,2,41,10,'2026-11-11 00:00:00',19,19,'MOVIMIENTO AUTOMATICO DE: EGRESO','OLM',148.8,0,'202304W','2026-04-30 00:00:00','41',0,0,2827.2,148.8,'V','2026-11-11 13:07:02',NULL),
(2,1,10,96,1,313,2,'2026-11-04 00:00:00',100,0,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',20,2000,'F260103','2028-08-24 00:00:00','4291251179',100,100,2000,20,'V','2026-11-05 09:55:38','2026-08-24 00:00:00'),
(2,1,12,147,19,7345,3,'2026-11-05 00:00:00',10,345,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',5.9972,2009.062,'C250024','2028-02-05 00:00:00','FE-7310',335,335,59.972,5.9972,'V','2026-11-05 13:56:25','2025-02-05 00:00:00'),
(2,1,12,148,19,7399,3,'2026-11-17 00:00:00',20,335,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',5.9972,1889.118,'C250024','2028-02-05 00:00:00','FE-7364',315,315,119.944,5.9972,'V','2026-11-17 13:02:57','2025-02-05 00:00:00'),
(2,1,13,453,1,317,3,'2026-11-16 00:00:00',600,690,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',15.2,19607.862,'F250013','2028-10-20 00:00:00','1874347937',1290,600,9120,15.1999,'V','2026-11-17 09:25:25','2025-10-20 00:00:00'),
(2,1,13,452,19,7382,1,'2026-11-12 00:00:00',50,740,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',15.1998,10487.862,'F260078','2029-06-23 00:00:00','FE-7347',690,160,759.99,15.1998,'V','2026-11-12 10:59:05','2026-06-23 00:00:00'),
(2,1,13,451,19,7358,1,'2026-11-09 00:00:00',50,790,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',15.1998,11247.852,'F260078','2029-06-23 00:00:00','FE-7323',740,210,759.99,15.1998,'V','2026-11-09 11:24:55','2026-06-23 00:00:00'),
(2,1,13,450,19,7353,1,'2026-11-06 00:00:00',20,810,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',15.1998,12007.842,'F260078','2029-06-23 00:00:00','FE-7318',790,260,303.996,15.1998,'V','2026-11-06 12:28:41','2026-06-23 00:00:00'),
(2,1,13,449,1,313,3,'2026-11-04 00:00:00',500,310,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',15.2,12311.876,'F260080','2029-06-26 00:00:00','4291251179',810,500,7600,15.1998,'V','2026-11-05 09:55:38','2026-06-26 00:00:00'),
(2,1,14,411,19,7398,1,'2026-11-17 00:00:00',10,3284,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',6.8041,22276.6234,'F260021','2029-02-18 00:00:00','FE-7363',3274,1525,68.041,6.8041,'V','2026-11-17 12:50:46','2026-02-18 00:00:00'),
(2,1,14,410,19,7345,4,'2026-11-05 00:00:00',80,3364,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',6.8041,22344.6644,'F260021','2029-02-18 00:00:00','FE-7310',3284,1535,544.328,6.8041,'V','2026-11-05 13:56:25','2026-02-18 00:00:00'),
(2,1,15,257,19,7383,1,'2026-11-12 00:00:00',100,869,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',9.4993,7304.9617,'C240204','2027-11-20 00:00:00','FE-7348',769,20,949.93,9.4993,'V','2026-11-12 11:35:08','2024-11-20 00:00:00'),
(2,1,16,839,19,7361,2,'2026-11-09 00:00:00',20,7961,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',5.1998,41291.6118,'F260001','2029-01-02 00:00:00','FE-7326',7941,7930,103.996,5.1998,'V','2026-11-09 14:32:36','2026-01-02 00:00:00'),
(2,1,16,842,1,317,4,'2026-11-16 00:00:00',1020,7803,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',5.2,45878.0394,'F260031','2029-03-06 00:00:00','1874347937',8823,1020,5304,5.1998,'V','2026-11-17 09:25:25','2026-03-06 00:00:00'),
(2,1,16,840,19,7376,2,'2026-11-11 00:00:00',38,7941,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',5.1998,41094.0194,'F260001','2029-01-02 00:00:00','FE-7341',7903,7892,197.5924,5.1998,'V','2026-11-11 09:28:23','2026-01-02 00:00:00'),
(2,1,16,844,1,317,6,'2026-11-16 00:00:00',3780,9023,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',5.2,66573.7954,'F260001','2029-01-02 00:00:00','1874347937',12803,11572,19656,5.1999,'V','2026-11-17 09:25:25','2026-01-02 00:00:00'),
(2,1,16,843,1,317,5,'2026-11-16 00:00:00',200,8823,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',5.2,46917.8354,'F250038','2028-12-18 00:00:00','1874347937',9023,200,1040,5.1998,'V','2026-11-17 09:25:25','2025-12-18 00:00:00'),
(2,1,16,838,19,7345,22,'2026-11-05 00:00:00',2050,10011,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',5.1998,41395.6078,'F260001','2029-01-02 00:00:00','FE-7310',7961,7950,10659.59,5.1998,'V','2026-11-05 13:56:25','2026-01-02 00:00:00'),
(2,1,16,841,19,7377,2,'2026-11-11 00:00:00',100,7903,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',5.1998,40574.0394,'F260001','2029-01-02 00:00:00','FE-7342',7803,7792,519.98,5.1998,'V','2026-11-11 11:11:58','2026-01-02 00:00:00'),
(2,1,21,259,19,7345,9,'2026-11-05 00:00:00',30,709,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',25,16975,'N250915','2028-11-11 00:00:00','FE-7310',679,679,750,25,'V','2026-11-05 13:56:25','2025-11-11 00:00:00'),
(2,1,21,261,19,7399,5,'2026-11-17 00:00:00',30,579,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',25,13725,'N250915','2028-11-11 00:00:00','FE-7364',549,549,750,25,'V','2026-11-17 13:02:57','2025-11-11 00:00:00'),
(2,1,21,260,19,7378,5,'2026-11-11 00:00:00',100,679,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',25,14475,'N250915','2028-11-11 00:00:00','FE-7343',579,579,2500,25,'V','2026-11-11 11:38:36','2025-11-11 00:00:00'),
(2,1,22,643,19,7399,6,'2026-11-17 00:00:00',15,1680,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',25,41625,'S250050','2027-04-06 00:00:00','FE-7364',1665,394,375,25,'V','2026-11-17 13:02:57','2025-04-06 00:00:00'),
(2,1,22,641,19,7377,1,'2026-11-11 00:00:00',10,1790,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',25,44500,'S250050','2027-04-06 00:00:00','FE-7342',1780,409,250,25,'V','2026-11-11 11:11:58','2025-04-06 00:00:00'),
(2,1,22,642,19,7378,1,'2026-11-11 00:00:00',100,1780,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',25,42000,'S260485','2028-04-06 00:00:00','FE-7343',1680,271,2500,25,'V','2026-11-11 11:38:36','2026-04-06 00:00:00'),
(2,1,22,640,19,7345,10,'2026-11-05 00:00:00',15,1805,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',25,44750,'S250050','2027-04-06 00:00:00','FE-7310',1790,419,375,25,'V','2026-11-05 13:56:25','2025-04-06 00:00:00'),
(2,1,24,41,1,317,8,'2026-11-16 00:00:00',50,11,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',85,5445.9651,'N260123','2028-01-27 00:00:00','1874347937',61,61,4250,89.2781,'V','2026-11-17 09:25:25','2026-01-27 00:00:00'),
(2,1,24,40,19,7390,1,'2026-11-16 00:00:00',9,20,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',108.7241,1195.9651,'N260123','2028-01-27 00:00:00','FE-7355',11,11,978.5169,108.7241,'V','2026-11-16 09:28:05','2026-01-27 00:00:00'),
(2,1,24,39,19,7369,1,'2026-11-10 00:00:00',1,21,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',108.7241,2174.482,'N260123','2028-01-27 00:00:00','FE-7334',20,20,108.7241,108.7241,'V','2026-11-10 12:02:46','2026-01-27 00:00:00'),
(2,1,24,38,19,7364,1,'2026-11-10 00:00:00',10,31,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',108.7241,2283.2061,'N260123','2028-01-27 00:00:00','FE-7329',21,21,1087.241,108.7241,'V','2026-11-10 08:55:09','2026-01-27 00:00:00'),
(2,1,25,314,19,7346,3,'2026-11-05 00:00:00',17,17,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',13.3974,0,'K260009','2028-02-10 00:00:00','FE-7311',0,0,227.7558,13.3974,'V','2026-11-05 14:00:30','2026-02-10 00:00:00'),
(2,1,25,315,1,317,9,'2026-11-16 00:00:00',1000,0,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',14,14000,'K260061','2028-08-28 00:00:00','1874347937',1000,1000,14000,14,'V','2026-11-17 09:25:25','2026-08-28 00:00:00'),
(2,1,25,313,19,7345,12,'2026-11-05 00:00:00',50,67,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',13.3974,227.7558,'K260009','2028-02-10 00:00:00','FE-7310',17,17,669.87,13.3974,'V','2026-11-05 13:56:25','2026-02-10 00:00:00'),
(2,1,26,103,19,7346,2,'2026-11-05 00:00:00',50,80,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',15,450,'K260007','2029-02-05 00:00:00','FE-7311',30,30,750,15,'V','2026-11-05 14:00:30','2026-02-05 00:00:00'),
(2,1,26,104,19,7349,1,'2026-11-06 00:00:00',20,30,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',15,150,'K260007','2029-02-05 00:00:00','FE-7314',10,10,300,15,'V','2026-11-06 12:07:07','2026-02-05 00:00:00'),
(2,1,26,105,20,7349,1,'2026-11-06 00:00:00',20,10,'MOVIMIENTO AUTOMATICO DE: INGRESO','AVC',15,450,'K260007','2029-02-05 00:00:00','FE-7314',30,30,300,15,'V','2026-11-06 12:27:27','2026-02-05 00:00:00'),
(2,1,26,106,19,7378,2,'2026-11-11 00:00:00',30,30,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',15,0,'K260007','2029-02-05 00:00:00','FE-7343',0,0,450,15,'V','2026-11-11 11:38:36','2026-02-05 00:00:00'),
(2,1,27,511,19,7399,8,'2026-11-17 00:00:00',200,2879,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',24.9404,66815.3316,'A260117','2028-01-27 00:00:00','FE-7364',2679,144,4988.08,24.9404,'V','2026-11-17 13:02:57','2026-01-27 00:00:00'),
(2,1,27,509,20,7365,1,'2026-11-10 00:00:00',10,2899,'MOVIMIENTO AUTOMATICO DE: INGRESO','AVC',24.9404,72551.6236,'A260117','2028-01-27 00:00:00','FE-7330',2909,374,249.404,24.9404,'V','2026-11-10 10:25:46','2026-01-27 00:00:00'),
(2,1,27,505,19,7361,3,'2026-11-09 00:00:00',10,2919,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',24.9404,72551.6236,'A260117','2028-01-27 00:00:00','FE-7326',2909,374,249.404,24.9404,'V','2026-11-09 14:32:36','2026-01-27 00:00:00'),
(2,1,27,504,1,314,1,'2026-11-06 00:00:00',370,2549,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',25,72801.1582,'A260117','2028-01-27 00:00:00','4108534719',2919,384,9250,24.9404,'V','2026-11-06 13:00:29','2026-01-27 00:00:00'),
(2,1,27,508,20,7366,1,'2026-11-10 00:00:00',10,2889,'MOVIMIENTO AUTOMATICO DE: INGRESO','AVC',24.9404,72302.2196,'A260117','2028-01-27 00:00:00','FE-7331',2899,364,249.404,24.9404,'V','2026-11-10 10:25:14','2026-01-27 00:00:00'),
(2,1,27,510,19,7367,1,'2026-11-10 00:00:00',30,2909,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',24.9404,71803.4116,'A260117','2028-01-27 00:00:00','FE-7332',2879,344,748.212,24.9404,'V','2026-11-10 10:26:39','2026-01-27 00:00:00'),
(2,1,27,507,19,7366,1,'2026-11-10 00:00:00',10,2899,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',24.9404,72052.8156,'A260117','2028-01-27 00:00:00','FE-7331',2889,354,249.404,24.9404,'V','2026-11-10 10:23:18','2026-01-27 00:00:00'),
(2,1,27,506,19,7365,1,'2026-11-10 00:00:00',10,2909,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',24.9404,72302.2196,'A260117','2028-01-27 00:00:00','FE-7330',2899,364,249.404,24.9404,'V','2026-11-10 10:00:45','2026-01-27 00:00:00'),
(2,1,27,503,19,7345,13,'2026-11-05 00:00:00',200,2749,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',24.9318,63551.1582,'A260577','2028-05-15 00:00:00','FE-7310',2549,2535,4986.36,24.9318,'V','2026-11-05 13:56:25','2026-05-15 00:00:00'),
(2,1,28,421,19,7345,14,'2026-11-05 00:00:00',10,19082,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',22.8786,436340.6592,'C240141','2027-07-31 00:00:00','FE-7310',19072,7935,228.786,22.8786,'V','2026-11-05 13:56:25','2024-07-31 00:00:00'),
(2,1,28,422,19,7359,1,'2026-11-09 00:00:00',80,19072,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',22.8786,434510.3712,'C240141','2027-07-31 00:00:00','FE-7324',18992,7855,1830.288,22.8786,'V','2026-11-09 12:40:44','2024-07-31 00:00:00'),
(2,1,29,335,19,7399,9,'2026-11-17 00:00:00',200,7705,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',2.6947,20223.7235,'A260047','2029-01-12 00:00:00','FE-7364',7505,7458,538.94,2.6947,'V','2026-11-17 13:02:57','2026-01-12 00:00:00'),
(2,1,29,334,19,7374,3,'2026-11-11 00:00:00',20,7725,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',2.6947,20762.6635,'A260047','2029-01-12 00:00:00','FE-7339',7705,7658,53.894,2.6947,'V','2026-11-11 07:46:27','2026-01-12 00:00:00'),
(2,1,29,332,19,7345,15,'2026-11-05 00:00:00',200,8125,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',2.6947,21355.4975,'A260047','2029-01-12 00:00:00','FE-7310',7925,7878,538.94,2.6947,'V','2026-11-05 13:56:25','2026-01-12 00:00:00'),
(2,1,29,333,19,7370,1,'2026-11-10 00:00:00',200,7925,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',2.6947,20816.5575,'A260047','2029-01-12 00:00:00','FE-7335',7725,7678,538.94,2.6947,'V','2026-11-10 14:18:38','2026-01-12 00:00:00'),
(2,1,30,695,19,7400,1,'2026-11-17 00:00:00',100,9386,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',12.5276,116331.2936,'C250098','2028-05-30 00:00:00','FE-7365',9286,4786,1252.76,12.5276,'V','2026-11-17 14:52:27','2025-05-30 00:00:00'),
(2,1,30,694,19,7399,12,'2026-11-17 00:00:00',4,9390,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',12.5276,117584.0536,'C250098','2028-05-30 00:00:00','FE-7364',9386,4886,50.1104,12.5276,'V','2026-11-17 13:02:57','2025-05-30 00:00:00'),
(2,1,35,257,19,7396,1,'2026-11-17 00:00:00',40,2000,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',6,11760,'L250176','2028-09-30 00:00:00','FE-7361',1960,1960,240,6,'V','2026-11-17 10:40:00','2025-09-30 00:00:00'),
(2,1,35,256,19,7361,5,'2026-11-09 00:00:00',10,2010,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',6,12000,'L250176','2028-09-30 00:00:00','FE-7326',2000,2000,60,6,'V','2026-11-09 14:32:36','2025-09-30 00:00:00'),
(2,1,36,145,19,7350,1,'2026-11-06 00:00:00',200,805,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',4,2420,'L250131','2028-07-31 00:00:00','FE-7315',605,605,800,4,'V','2026-11-06 12:10:06','2025-07-31 00:00:00'),
(2,1,40,931,19,7356,2,'2026-11-09 00:00:00',40,4225,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',8.9994,37662.489,'K260064','2029-09-03 00:00:00','FE-7321',4185,4180,359.976,8.9994,'V','2026-11-09 09:56:49','2026-09-03 00:00:00'),
(2,1,40,930,19,7354,1,'2026-11-06 00:00:00',20,4245,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',8.9994,38022.465,'K260064','2029-09-03 00:00:00','FE-7319',4225,4220,179.988,8.9994,'V','2026-11-06 12:37:02','2026-09-03 00:00:00'),
(2,1,40,929,19,7345,20,'2026-11-05 00:00:00',500,4745,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',8.9994,38202.453,'K260064','2029-09-03 00:00:00','FE-7310',4245,4240,4499.7,8.9994,'V','2026-11-05 13:56:25','2026-09-03 00:00:00'),
(2,1,40,933,19,7365,2,'2026-11-10 00:00:00',30,4085,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',8.9994,36492.567,'K260064','2029-09-03 00:00:00','FE-7330',4055,4050,269.982,8.9994,'V','2026-11-10 10:00:45','2026-09-03 00:00:00'),
(2,1,40,932,19,7358,2,'2026-11-09 00:00:00',100,4185,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',8.9994,36762.549,'K260064','2029-09-03 00:00:00','FE-7323',4085,4080,899.94,8.9994,'V','2026-11-09 11:24:55','2026-09-03 00:00:00'),
(2,1,40,934,20,7365,2,'2026-11-10 00:00:00',30,4055,'MOVIMIENTO AUTOMATICO DE: INGRESO','AVC',8.9994,36762.549,'K260064','2029-09-03 00:00:00','FE-7330',4085,4080,269.982,8.9994,'V','2026-11-10 10:25:46','2026-09-03 00:00:00'),
(2,1,40,935,19,7367,2,'2026-11-10 00:00:00',30,4085,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',8.9994,36492.567,'K260064','2029-09-03 00:00:00','FE-7332',4055,4050,269.982,8.9994,'V','2026-11-10 10:26:39','2026-09-03 00:00:00'),
(2,1,40,938,19,7392,1,'2026-11-16 00:00:00',10,3885,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',8.9994,34872.675,'K260064','2029-09-03 00:00:00','FE-7357',3875,3870,89.994,8.9994,'V','2026-11-16 14:03:39','2026-09-03 00:00:00'),
(2,1,40,937,19,7391,1,'2026-11-16 00:00:00',70,3955,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',8.9994,34962.669,'K260064','2029-09-03 00:00:00','FE-7356',3885,3880,629.958,8.9994,'V','2026-11-16 13:32:50','2026-09-03 00:00:00'),
(2,1,40,936,19,7378,3,'2026-11-11 00:00:00',100,4055,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',8.9994,35592.627,'K260064','2029-09-03 00:00:00','FE-7343',3955,3950,899.94,8.9994,'V','2026-11-11 11:38:36','2026-09-03 00:00:00'),
(2,1,40,928,19,7344,1,'2026-11-05 00:00:00',100,4845,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',8.9994,42702.153,'K260064','2029-09-03 00:00:00','FE-7309',4745,4740,899.94,8.9994,'V','2026-11-05 10:22:22','2026-09-03 00:00:00'),
(2,1,41,212,19,7380,1,'2026-11-12 00:00:00',30,2251,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',10.7,23764.7,'N250970','2028-11-18 00:00:00','FE-7345',2221,2221,321,10.7,'V','2026-11-12 09:27:57','2025-11-18 00:00:00'),
(2,1,51,319,19,7385,1,'2026-11-13 00:00:00',50,4815,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',5.05,24063.25,'F260002','2029-01-04 00:00:00','FE-7350',4765,4750,252.5,5.05,'V','2026-11-13 09:53:17','2026-01-04 00:00:00'),
(2,1,51,318,19,7376,1,'2026-11-11 00:00:00',12,4827,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',5.05,24315.75,'F250002','2028-09-11 00:00:00','FE-7341',4815,0,60.6,5.05,'V','2026-11-11 09:28:23','2025-09-11 00:00:00'),
(2,1,51,320,19,7393,1,'2026-11-17 00:00:00',400,4765,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',5.05,22043.25,'F260002','2029-01-04 00:00:00','FE-7358',4365,4350,2020,5.05,'V','2026-11-17 09:45:00','2026-01-04 00:00:00'),
(2,1,51,321,19,7394,1,'2026-11-17 00:00:00',300,4365,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',5.05,20528.25,'F260002','2029-01-04 00:00:00','FE-7359',4065,4050,1515,5.05,'V','2026-11-17 10:23:46','2026-01-04 00:00:00'),
(2,1,51,315,19,7345,21,'2026-11-05 00:00:00',950,5987,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',5.05,25436.85,'F250002','2028-09-11 00:00:00','FE-7310',5037,22,4797.5,5.05,'V','2026-11-05 13:56:25','2025-09-11 00:00:00'),
(2,1,51,316,19,7355,1,'2026-11-09 00:00:00',10,5037,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',5.05,25386.35,'F250002','2028-09-11 00:00:00','FE-7320',5027,12,50.5,5.05,'V','2026-11-09 09:01:59','2025-09-11 00:00:00'),
(2,1,51,317,19,7363,1,'2026-11-09 00:00:00',200,5027,'MOVIMIENTO AUTOMATICO DE: EGRESO','KER',5.05,24376.35,'F260002','2029-01-04 00:00:00','FE-7328',4827,4800,1010,5.05,'V','2026-11-09 14:49:55','2026-01-04 00:00:00'),
(2,1,155,404,1,317,1,'2026-11-16 00:00:00',1500,7179,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',7,59200.9002,'L260068','2029-08-06 00:00:00','1874347937',8679,4500,10500,6.8212,'V','2026-11-17 09:25:25','2026-08-06 00:00:00'),
(2,1,155,405,19,7399,2,'2026-11-17 00:00:00',100,8679,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',6.8212,58519.0748,'L260063','2029-07-02 00:00:00','FE-7364',8579,1179,682.12,6.8212,'V','2026-11-17 13:02:57','2026-07-02 00:00:00'),
(2,1,155,397,1,313,1,'2026-11-04 00:00:00',3000,4939,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',7,53856.6975,'L260068','2029-08-06 00:00:00','4291251179',7939,3000,21000,6.7838,'V','2026-11-05 09:55:38','2026-08-06 00:00:00'),
(2,1,155,398,19,7345,2,'2026-11-05 00:00:00',250,7939,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',6.7838,52160.6382,'L260063','2029-07-02 00:00:00','FE-7310',7689,1789,1695.95,6.7838,'V','2026-11-05 13:56:25','2026-07-02 00:00:00'),
(2,1,155,400,19,7355,5,'2026-11-09 00:00:00',10,7589,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',6.7838,51414.4202,'L260063','2029-07-02 00:00:00','FE-7320',7579,1679,67.838,6.7838,'V','2026-11-09 09:01:59','2026-07-02 00:00:00'),
(2,1,155,399,19,7352,1,'2026-11-06 00:00:00',100,7689,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',6.7838,51482.2582,'L260063','2029-07-02 00:00:00','FE-7317',7589,1689,678.38,6.7838,'V','2026-11-06 12:15:06','2026-07-02 00:00:00'),
(2,1,155,402,19,7381,2,'2026-11-12 00:00:00',100,7379,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',6.7838,49379.2802,'L260063','2029-07-02 00:00:00','FE-7346',7279,1379,678.38,6.7838,'V','2026-11-12 09:29:49','2026-07-02 00:00:00'),
(2,1,155,401,19,7378,4,'2026-11-11 00:00:00',200,7579,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',6.7838,50057.6602,'L260063','2029-07-02 00:00:00','FE-7343',7379,1479,1356.76,6.7838,'V','2026-11-11 11:38:36','2026-07-02 00:00:00'),
(2,1,155,403,19,7384,2,'2026-11-12 00:00:00',100,7279,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',6.7838,48700.9002,'L260063','2029-07-02 00:00:00','FE-7349',7179,1279,678.38,6.7838,'V','2026-11-12 12:15:07','2026-07-02 00:00:00'),
(2,1,158,253,19,7345,8,'2026-11-05 00:00:00',400,12099,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',2.1997,25734.2903,'A260531','2028-05-18 00:00:00','FE-7310',11699,2999,879.88,2.1997,'V','2026-11-05 13:56:25','2026-05-18 00:00:00'),
(2,1,158,256,19,7375,2,'2026-11-11 00:00:00',100,11099,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',2.1997,24194.5003,'A260531','2028-05-18 00:00:00','FE-7340',10999,2299,219.97,2.1997,'V','2026-11-11 09:26:32','2026-05-18 00:00:00'),
(2,1,158,257,27,412,1,'2026-11-06 00:00:00',1,10999,'MOVIMIENTO AUTOMATICO DE: EGRESO','AEV',2.1997,24192.3006,'A260682','2028-06-14 00:00:00','412',10998,8699,2.1997,2.1997,'V','2026-11-13 16:14:55','2026-06-14 00:00:00'),
(2,1,158,255,19,7374,2,'2026-11-11 00:00:00',300,11399,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',2.1997,24414.4703,'A260531','2028-05-18 00:00:00','FE-7339',11099,2399,659.91,2.1997,'V','2026-11-11 07:46:27','2026-05-18 00:00:00'),
(2,1,158,254,19,7370,2,'2026-11-10 00:00:00',300,11699,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',2.1997,25074.3803,'A260531','2028-05-18 00:00:00','FE-7335',11399,2699,659.91,2.1997,'V','2026-11-10 14:18:38','2026-05-18 00:00:00'),
(2,1,161,409,19,7345,7,'2026-11-05 00:00:00',300,22524,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.4938,33198.2112,'A260418','2028-04-21 00:00:00','FE-7310',22224,1521,448.14,1.4938,'V','2026-11-05 13:56:25','2026-04-21 00:00:00'),
(2,1,161,410,19,7375,1,'2026-11-11 00:00:00',100,22224,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.4938,33048.8312,'A260418','2028-04-21 00:00:00','FE-7340',22124,1421,149.38,1.4938,'V','2026-11-11 09:26:32','2026-04-21 00:00:00'),
(2,1,161,411,19,7395,1,'2026-11-17 00:00:00',500,22124,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.4938,32301.9312,'A260418','2028-04-21 00:00:00','FE-7360',21624,921,746.9,1.4938,'V','2026-11-17 10:37:30','2026-04-21 00:00:00'),
(2,1,161,412,19,7399,4,'2026-11-17 00:00:00',500,21624,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.4938,31555.0312,'A260418','2028-04-21 00:00:00','FE-7364',21124,421,746.9,1.4938,'V','2026-11-17 13:02:57','2026-04-21 00:00:00'),
(2,1,161,413,19,7400,3,'2026-11-17 00:00:00',300,21124,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.4938,31106.8912,'A260418','2028-04-21 00:00:00','FE-7365',20824,121,448.14,1.4938,'V','2026-11-17 14:52:27','2026-04-21 00:00:00'),
(2,1,162,268,19,7346,1,'2026-11-05 00:00:00',30,599,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',19.5286,11111.7734,'N260235','2029-02-15 00:00:00','FE-7311',569,569,585.858,19.5286,'V','2026-11-05 14:00:30','2026-02-15 00:00:00'),
(2,1,162,269,1,317,7,'2026-11-16 00:00:00',2500,569,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',20,61111.7734,'N260811','2029-07-16 00:00:00','1874347937',3069,2500,50000,19.9126,'V','2026-11-17 09:25:25','2026-07-16 00:00:00'),
(2,1,163,359,19,7374,1,'2026-11-11 00:00:00',100,7118,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',4,28072,'A250853','2027-04-29 00:00:00','FE-7339',7018,7015,400,4,'V','2026-11-11 07:46:27','2025-10-29 00:00:00'),
(2,1,164,185,19,7377,3,'2026-11-11 00:00:00',50,4939,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',3.4,16622.6,'A250751','2028-10-24 00:00:00','FE-7342',4889,2188,170,3.4,'V','2026-11-11 11:11:58','2025-10-24 00:00:00'),
(2,1,164,186,19,7399,1,'2026-11-17 00:00:00',100,4889,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',3.4,16282.6,'A250751','2028-10-24 00:00:00','FE-7364',4789,2088,340,3.4,'V','2026-11-17 13:02:57','2025-10-24 00:00:00'),
(2,1,164,184,19,7345,1,'2026-11-05 00:00:00',200,5139,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',3.4,16792.6,'A250751','2028-10-24 00:00:00','FE-7310',4939,2238,680,3.4,'V','2026-11-05 13:56:25','2025-10-24 00:00:00'),
(2,1,165,160,19,7345,5,'2026-11-05 00:00:00',300,3856,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.6371,5821.5276,'A260250','2029-02-24 00:00:00','FE-7310',3556,1450,491.13,1.6371,'V','2026-11-05 13:56:25','2026-02-24 00:00:00'),
(2,1,165,162,20,7348,1,'2026-11-06 00:00:00',100,3456,'MOVIMIENTO AUTOMATICO DE: INGRESO','AVC',1.6371,5821.5276,'A260250','2029-02-24 00:00:00','FE-7313',3556,1450,163.71,1.6371,'V','2026-11-06 12:12:10','2026-02-24 00:00:00'),
(2,1,165,163,19,7351,1,'2026-11-06 00:00:00',100,3556,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.6371,5657.8176,'A260250','2029-02-24 00:00:00','FE-7316',3456,1350,163.71,1.6371,'V','2026-11-06 12:12:35','2026-02-24 00:00:00'),
(2,1,165,165,19,7400,5,'2026-11-17 00:00:00',300,3156,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.6371,4675.5576,'A260250','2029-02-24 00:00:00','FE-7365',2856,750,491.13,1.6371,'V','2026-11-17 14:52:27','2026-02-24 00:00:00'),
(2,1,165,161,19,7348,1,'2026-11-06 00:00:00',100,3556,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.6371,5657.8176,'A260250','2029-02-24 00:00:00','FE-7313',3456,1350,163.71,1.6371,'V','2026-11-06 08:29:50','2026-02-24 00:00:00'),
(2,1,165,164,19,7395,2,'2026-11-17 00:00:00',300,3456,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.6371,5166.6876,'A260250','2029-02-24 00:00:00','FE-7360',3156,1050,491.13,1.6371,'V','2026-11-17 10:37:30','2026-02-24 00:00:00'),
(2,1,167,392,19,7340,3,'2026-11-05 00:00:00',343,22084,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.8,39133.8,'A260737','2029-07-03 00:00:00','FE-7305',21741,13127,617.4,1.8,'V','2026-11-05 08:43:42','2026-07-03 00:00:00'),
(2,1,167,396,19,7396,2,'2026-11-17 00:00:00',200,41341,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.8,74053.8,'A260737','2029-07-03 00:00:00','FE-7361',41141,12527,360,1.8,'V','2026-11-17 10:40:00','2026-07-03 00:00:00'),
(2,1,167,394,1,317,10,'2026-11-16 00:00:00',20000,21541,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',1.8,74773.8,'A260393','2029-04-08 00:00:00','1874347937',41541,20000,36000,1.8,'V','2026-11-17 09:25:25','2026-04-08 00:00:00'),
(2,1,167,390,19,7340,1,'2026-11-05 00:00:00',257,23341,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.8,41551.2,'A260534','2029-05-06 00:00:00','FE-7305',23084,0,462.6,1.8,'V','2026-11-05 08:43:42','2026-05-06 00:00:00'),
(2,1,167,395,19,7395,3,'2026-11-17 00:00:00',200,41541,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.8,74413.8,'A260737','2029-07-03 00:00:00','FE-7360',41341,12727,360,1.8,'V','2026-11-17 10:37:30','2026-07-03 00:00:00'),
(2,1,167,391,19,7340,2,'2026-11-05 00:00:00',1000,23084,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.8,39751.2,'A260624','2029-06-03 00:00:00','FE-7305',22084,0,1800,1.8,'V','2026-11-05 08:43:42','2026-06-03 00:00:00'),
(2,1,167,393,19,7343,1,'2026-11-05 00:00:00',200,21741,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.8,38773.8,'A260737','2029-07-03 00:00:00','FE-7308',21541,12927,360,1.8,'V','2026-11-05 10:01:10','2026-07-03 00:00:00'),
(2,1,168,160,19,7361,4,'2026-11-09 00:00:00',20,18751,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.7,31842.7,'A260784','2028-07-12 00:00:00','FE-7326',18731,18731,34,1.7,'V','2026-11-09 14:32:36','2026-07-12 00:00:00'),
(2,1,168,163,19,7400,4,'2026-11-17 00:00:00',300,17331,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.7,28952.7,'A260784','2028-07-12 00:00:00','FE-7365',17031,17031,510,1.7,'V','2026-11-17 14:52:27','2026-07-12 00:00:00'),
(2,1,168,162,19,7399,15,'2026-11-17 00:00:00',1000,18331,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.7,29462.7,'A260784','2028-07-12 00:00:00','FE-7364',17331,17331,1700,1.7,'V','2026-11-17 13:02:57','2026-07-12 00:00:00'),
(2,1,168,161,19,7371,2,'2026-11-10 00:00:00',400,18731,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.7,31162.7,'A260784','2028-07-12 00:00:00','FE-7336',18331,18331,680,1.7,'V','2026-11-10 14:35:32','2026-07-12 00:00:00'),
(2,1,170,173,19,7388,1,'2026-11-13 00:00:00',300,8825,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.3,11082.5,'A260093','2028-01-24 00:00:00','FE-7353',8525,8525,390,1.3,'V','2026-11-13 14:16:09','2026-01-24 00:00:00'),
(2,1,170,172,19,7355,4,'2026-11-09 00:00:00',10,8835,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.3,11472.5,'A260093','2028-01-24 00:00:00','FE-7320',8825,8825,13,1.3,'V','2026-11-09 09:01:59','2026-01-24 00:00:00'),
(2,1,170,171,19,7345,18,'2026-11-05 00:00:00',200,9035,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.3,11485.5,'A260093','2028-01-24 00:00:00','FE-7310',8835,8835,260,1.3,'V','2026-11-05 13:56:25','2026-01-24 00:00:00'),
(2,1,170,174,19,7399,13,'2026-11-17 00:00:00',100,8525,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.3,10952.5,'A260093','2028-01-24 00:00:00','FE-7364',8425,8425,130,1.3,'V','2026-11-17 13:02:57','2026-01-24 00:00:00'),
(2,1,172,181,19,7345,19,'2026-11-05 00:00:00',200,1505,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',22.9134,29901.987,'L260026','2029-03-24 00:00:00','FE-7310',1305,205,4582.68,22.9134,'V','2026-11-05 13:56:25','2026-03-24 00:00:00'),
(2,1,173,200,19,7342,1,'2026-11-05 00:00:00',30,120,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',37,3330,'K260054','2029-08-12 00:00:00','FE-7307',90,90,1110,37,'V','2026-11-05 09:59:00','2026-08-12 00:00:00'),
(2,1,173,201,19,7344,2,'2026-11-05 00:00:00',10,90,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',37,2960,'K260054','2029-08-12 00:00:00','FE-7309',80,80,370,37,'V','2026-11-05 10:22:22','2026-08-12 00:00:00'),
(2,1,173,198,1,313,4,'2026-11-04 00:00:00',140,0,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',37,5180,'K260054','2029-08-12 00:00:00','4291251179',140,140,5180,37,'V','2026-11-05 09:55:38','2026-08-12 00:00:00'),
(2,1,173,199,19,7341,1,'2026-11-05 00:00:00',20,140,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',37,4440,'K260054','2029-08-12 00:00:00','FE-7306',120,120,740,37,'V','2026-11-05 09:57:08','2026-08-12 00:00:00'),
(2,1,173,202,19,7345,17,'2026-11-05 00:00:00',80,80,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',37,0,'K260054','2029-08-12 00:00:00','FE-7310',0,0,2960,37,'V','2026-11-05 13:56:25','2026-08-12 00:00:00'),
(2,1,179,54,19,7399,11,'2026-11-17 00:00:00',496,5498,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',9.15,45768.3,'C250097','2028-05-29 00:00:00','FE-7364',5002,2,4538.4,9.15,'V','2026-11-17 13:02:57','2025-05-29 00:00:00'),
(2,1,182,172,19,7370,3,'2026-11-10 00:00:00',300,21835,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.4967,32231.4345,'A260373','2029-03-29 00:00:00','FE-7335',21535,1039,449.01,1.4967,'V','2026-11-10 14:18:38','2026-03-29 00:00:00'),
(2,1,182,173,19,7389,1,'2026-11-16 00:00:00',200,21535,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.4967,31932.0945,'A260373','2029-03-29 00:00:00','FE-7354',21335,839,299.34,1.4967,'V','2026-11-16 09:26:50','2026-03-29 00:00:00'),
(2,1,182,174,19,7399,7,'2026-11-17 00:00:00',100,21335,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.4967,31782.4245,'A260373','2029-03-29 00:00:00','FE-7364',21235,739,149.67,1.4967,'V','2026-11-17 13:02:57','2026-03-29 00:00:00'),
(2,1,182,171,19,7345,11,'2026-11-05 00:00:00',100,21935,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.4967,32680.4445,'A260373','2029-03-29 00:00:00','FE-7310',21835,1339,149.67,1.4967,'V','2026-11-05 13:56:25','2026-03-29 00:00:00'),
(2,1,197,11,1,317,2,'2026-11-16 00:00:00',100,20,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',10,1200,'F250023','2027-11-12 00:00:00','1874347937',120,100,1000,10,'V','2026-11-17 09:25:25','2025-11-12 00:00:00'),
(2,1,197,10,19,7379,1,'2026-11-11 00:00:00',100,120,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',10,200,'F260050','2028-04-16 00:00:00','FE-7344',20,20,1000,10,'V','2026-11-11 13:53:18','2026-04-16 00:00:00'),
(2,1,197,9,19,7356,1,'2026-11-09 00:00:00',30,150,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',10,1200,'F260050','2028-04-16 00:00:00','FE-7321',120,120,300,10,'V','2026-11-09 09:56:49','2026-04-16 00:00:00'),
(2,1,198,53,19,7387,2,'2026-11-13 00:00:00',50,815,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',25,19125,'T260038','2028-03-14 00:00:00','FE-7352',765,590,1250,25,'V','2026-11-13 12:20:51','2026-03-14 00:00:00'),
(2,1,198,51,19,7345,16,'2026-11-05 00:00:00',10,845,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',25,20875,'T260038','2028-03-14 00:00:00','FE-7310',835,660,250,25,'V','2026-11-05 13:56:25','2026-03-14 00:00:00'),
(2,1,198,52,19,7381,1,'2026-11-12 00:00:00',20,835,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',25,20375,'T260038','2028-03-14 00:00:00','FE-7346',815,640,500,25,'V','2026-11-12 09:29:49','2026-03-14 00:00:00'),
(2,1,198,54,19,7399,10,'2026-11-17 00:00:00',50,765,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',25,17875,'T260038','2028-03-14 00:00:00','FE-7364',715,540,1250,25,'V','2026-11-17 13:02:57','2026-03-14 00:00:00'),
(2,1,203,4,19,7355,3,'2026-11-09 00:00:00',20,70,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',2.5,125,'A250558','2028-08-26 00:00:00','FE-7320',50,50,50,2.5,'V','2026-11-09 09:01:59','2025-08-26 00:00:00'),
(2,1,203,3,19,7345,6,'2026-11-05 00:00:00',700,770,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',2.5,175,'A250558','2028-08-26 00:00:00','FE-7310',70,70,1750,2.5,'V','2026-11-05 13:56:25','2025-08-26 00:00:00'),
(2,1,207,16,19,7399,14,'2026-11-17 00:00:00',300,4743,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',12,53316,'N250911','2028-11-06 00:00:00','FE-7364',4443,3094,3600,12,'V','2026-11-17 13:02:57','2025-11-06 00:00:00'),
(2,1,207,12,19,7357,1,'2026-11-09 00:00:00',100,5213,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',12,61356,'N250911','2028-11-06 00:00:00','FE-7322',5113,3764,1200,12,'V','2026-11-09 10:46:22','2025-11-06 00:00:00'),
(2,1,207,13,19,7361,1,'2026-11-09 00:00:00',20,5113,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',12,61116,'N250911','2028-11-06 00:00:00','FE-7326',5093,3744,240,12,'V','2026-11-09 14:32:36','2025-11-06 00:00:00'),
(2,1,207,14,19,7371,1,'2026-11-10 00:00:00',100,5093,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',12,59916,'N250911','2028-11-06 00:00:00','FE-7336',4993,3644,1200,12,'V','2026-11-10 14:35:32','2025-11-06 00:00:00'),
(2,1,207,17,19,7400,2,'2026-11-17 00:00:00',100,4443,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',12,52116,'N250911','2028-11-06 00:00:00','FE-7365',4343,2994,1200,12,'V','2026-11-17 14:52:27','2025-11-06 00:00:00'),
(2,1,207,11,19,7355,2,'2026-11-09 00:00:00',10,5223,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',12,62556,'N250911','2028-11-06 00:00:00','FE-7320',5213,3864,120,12,'V','2026-11-09 09:01:59','2025-11-06 00:00:00'),
(2,1,207,15,19,7384,1,'2026-11-12 00:00:00',250,4993,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',12,56916,'N250911','2028-11-06 00:00:00','FE-7349',4743,3394,3000,12,'V','2026-11-12 12:15:07','2025-11-06 00:00:00'),
(2,1,207,10,19,7347,1,'2026-11-05 00:00:00',100,5323,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',12,62676,'N250911','2028-11-06 00:00:00','FE-7312',5223,3874,1200,12,'V','2026-11-06 07:28:33','2025-11-06 00:00:00'),
(2,1,208,5,19,7387,1,'2026-11-13 00:00:00',100,250,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',7,1050,'L250180','2027-10-07 00:00:00','FE-7352',150,150,700,7,'V','2026-11-13 12:20:51','2025-10-07 00:00:00'),
(2,3,158,8,35,412,1,'2026-11-06 00:00:00',1,705,'MOVIMIENTO AUTOMATICO DE: INGRESO','AEV',2,1412,'A260682','2028-06-14 00:00:00','412',706,301,2,2,'V','2026-11-13 16:14:55','2026-06-14 00:00:00'),
(2,9,174,170,19,7397,1,'2026-11-17 00:00:00',10,1905,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',4.3,8148.5,'260102','2028-12-31 00:00:00','FE-7362',1895,1895,43,4.3,'V','2026-11-17 10:41:00','2026-01-31 00:00:00'),
(2,9,175,38,19,7368,1,'2026-11-10 00:00:00',44,233,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',22,4158,'YN50I2501','2027-02-28 00:00:00','FE-7333',189,12,968,22,'V','2026-11-10 10:35:14','2025-03-01 00:00:00'),
(2,9,175,39,1,316,1,'2026-11-13 00:00:00',38,189,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',20,4918,'YN50I2501','2027-02-28 00:00:00','2567718069',227,50,760,21.6652,'V','2026-11-13 12:15:59','2025-03-28 00:00:00'),
(2,9,175,40,19,7386,1,'2026-11-13 00:00:00',50,227,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',21.6652,3834.7404,'YN50I2501','2027-02-28 00:00:00','FE-7351',177,0,1083.26,21.6652,'V','2026-11-13 12:18:52','2025-03-28 00:00:00'),
(2,9,181,41,19,7362,1,'2026-11-09 00:00:00',30,1255,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',1.1309,1385.3525,'250212','2028-02-28 00:00:00','FE-7327',1225,725,33.927,1.1309,'V','2026-11-09 14:33:39','2025-02-28 00:00:00'),
(2,9,190,61,19,7372,1,'2026-11-10 00:00:00',200,10600,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',2.0359,21173.36,'9225I02','2027-08-31 00:00:00','FE-7337',10400,400,407.18,2.0359,'V','2026-11-10 14:34:31','2025-09-01 00:00:00'),
(2,9,193,29,19,7373,1,'2026-11-10 00:00:00',200,769,'MOVIMIENTO AUTOMATICO DE: EGRESO','AVC',6,3414,'VN50I2407','2027-07-31 00:00:00','FE-7338',569,69,1200,6,'V','2026-11-10 15:34:39','2024-08-30 00:00:00'),
(2,14,236,2,19,7360,1,'2026-11-09 00:00:00',290,290,'MOVIMIENTO AUTOMATICO DE: EGRESO','KER',65,0,'GN8936','2029-05-01 00:00:00','FE-7325',0,0,18850,65,'V','2026-11-09 14:09:59','2026-06-30 00:00:00'),
(2,14,236,1,1,315,1,'2026-11-09 00:00:00',290,0,'MOVIMIENTO AUTOMATICO DE: INGRESO','KER',65,18850,'GN8936','2029-05-01 00:00:00','1179992562',290,290,18850,65,'V','2026-11-09 14:06:44','2026-06-30 00:00:00')
) as v(loc, bod, prod, reg, tipo, nodoc, linea, fdoc, cant, exi, obs, usr, cu, ct, lote, fvenc, docf, exa, exl, cmov, cprom, est, fmov, ffab)
join public.localidades l on l.correlativo = v.loc join public.organizaciones o on o.id = l.organizacion_id and o.codigo = 3
join public.bodegas b on b.localidad_id = l.id and b.codigo = v.bod
join public.productos p on p.localidad_id = l.id and p.codigo = v.prod
join public.tipos_movimiento_inventario t on t.codigo = v.tipo
on conflict (localidad_id, bodega_id, producto_id, registro_anterior) where registro_anterior is not null do update set
  fecha = excluded.fecha, cantidad = excluded.cantidad, costo_unitario = excluded.costo_unitario, origen = excluded.origen, lote = excluded.lote, fecha_vencimiento = excluded.fecha_vencimiento,
  usuario = excluded.usuario, tipo_movimiento = excluded.tipo_movimiento, no_doc_anterior = excluded.no_doc_anterior, linea_anterior = excluded.linea_anterior, documento_fisico = excluded.documento_fisico,
  observaciones = excluded.observaciones, existencias_anterior = excluded.existencias_anterior, existencia_acumulada = excluded.existencia_acumulada, existencia_lote = excluded.existencia_lote,
  costo_total = excluded.costo_total, costo_movimiento = excluded.costo_movimiento, costo_promedio = excluded.costo_promedio, estado_anterior = excluded.estado_anterior,
  fecha_movimiento = excluded.fecha_movimiento, fecha_fabricacion = excluded.fecha_fabricacion, origen_anterior = excluded.origen_anterior;

select count(*) as movimientos_migrados from public.inventario_movimientos where origen_anterior = 'MIGRADO';
