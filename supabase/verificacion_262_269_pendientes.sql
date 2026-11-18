-- Verificación 262 a 269: muestra SOLO lo que no está OK. Si no devuelve renglones, todo está completo. SOLO LEE.
select * from (
with o as (select codigo::text as cod, id from public.organizaciones where codigo::text in ('4', '7')),
c as (
  select o.cod,
    (select count(*) from public.facturas_venta f join public.localidades l on l.id = f.localidad_id where l.organizacion_id = o.id and f.factura_anterior is not null) as facturas,
    (select count(*) from public.sat_tipos_documento_fel t where t.organizacion_id = o.id) as fel,
    (select count(*) from public.cargas_sat s where s.organizacion_id = o.id and s.tipo_carga = 'COMPRAS' and s.archivo_anterior is not null) as cargas_c,
    (select count(*) from public.cargas_sat s where s.organizacion_id = o.id and s.tipo_carga = 'VENTAS' and s.archivo_anterior is not null) as cargas_v,
    (select count(*) from public.carga_sat_lineas d join public.cargas_sat s on s.id = d.carga_id where s.organizacion_id = o.id and s.tipo_carga = 'COMPRAS' and s.archivo_anterior is not null) as det_c,
    (select count(*) from public.carga_sat_ventas_lineas d join public.cargas_sat s on s.id = d.carga_id where s.organizacion_id = o.id) as det_v,
    (select count(*) from public.partidas p where p.organizacion_id = o.id and p.origen_anterior = 'MIGRADO') as partidas,
    (select count(*) from public.partida_lineas l join public.partidas p on p.id = l.partida_id where p.organizacion_id = o.id and l.origen_anterior = 'MIGRADO') as lineas,
    (select count(*) from public.partidas p where p.organizacion_id = o.id and p.origen_anterior = 'MIGRADO'
       and not exists (select 1 from public.partida_lineas l where l.partida_id = p.id)) as partidas_sin_lineas,
    (select count(*) from public.saldos_cierre s where s.organizacion_id = o.id) as saldos,
    (select count(*) from public.saldos_cierre_centros s where s.organizacion_id = o.id) as saldos_cc,
    (select count(*) from public.cierres_contables_anteriores x where x.organizacion_id = o.id) as cierres,
    (select count(*) from public.caja_liquidacion_documentos d where d.organizacion_id = o.id) as liquidaciones,
    (select count(*) from public.caja_liquidacion_documentos d where d.organizacion_id = o.id and d.caja_periodo_id is null and d.subcaja_anterior <> 0) as liq_sin_subcaja
  from o
),
e(n, org, script, que, esperado, campo) as (values
  (1, '4', 262, 'Facturas de venta (CAR_FACTURAS)', 1475, 'facturas'),
  (2, '4', 263, 'Tipos de documento FEL', 16, 'fel'), (3, '7', 263, 'Tipos de documento FEL', 16, 'fel'),
  (4, '4', 263, 'Archivos SAT de compras', 436, 'cargas_c'), (5, '7', 263, 'Archivos SAT de compras', 15, 'cargas_c'),
  (6, '4', 263, 'Archivos SAT de ventas', 1, 'cargas_v'), (7, '7', 263, 'Archivos SAT de ventas', 12, 'cargas_v'),
  (8, '4', 264, 'Facturas de los archivos SAT de compras', 3891, 'det_c'), (9, '7', 264, 'Facturas de los archivos SAT de compras', 213, 'det_c'),
  (10, '4', 264, 'Facturas de los archivos SAT de ventas', 1, 'det_v'), (11, '7', 264, 'Facturas de los archivos SAT de ventas', 416, 'det_v'),
  (12, '4', 266, 'Partidas (CON_POLIZAS_N)', 2324, 'partidas'), (13, '7', 266, 'Partidas (CON_POLIZAS_N)', 458, 'partidas'),
  (14, '4', 266, 'Líneas de partidas (sin las que quedan en cero)', 10598, 'lineas'), (15, '7', 266, 'Líneas de partidas (sin las que quedan en cero)', 2339, 'lineas'),
  (16, '4', 266, 'Partidas migradas sin ninguna línea (debe ser 0)', 0, 'partidas_sin_lineas'), (17, '7', 266, 'Partidas migradas sin ninguna línea (debe ser 0)', 0, 'partidas_sin_lineas'),
  (18, '4', 267, 'Saldos de cierre por cuenta (con monto)', 17325, 'saldos'), (19, '7', 267, 'Saldos de cierre por cuenta (con monto)', 1464, 'saldos'),
  (20, '7', 267, 'Saldos de cierre por centro de costo (con monto)', 2673, 'saldos_cc'),
  (21, '4', 268, 'Documentos de liquidación de caja chica', 1177, 'liquidaciones'), (22, '7', 268, 'Documentos de liquidación de caja chica', 183, 'liquidaciones'),
  (23, '4', 268, 'Liquidaciones cuya subcaja no se encontró (debe ser 0)', 0, 'liq_sin_subcaja'), (24, '7', 268, 'Liquidaciones cuya subcaja no se encontró (debe ser 0)', 0, 'liq_sin_subcaja'),
  (25, '4', 269, 'Encabezados de cierre (CON_CIERRES)', 89, 'cierres'), (26, '7', 269, 'Encabezados de cierre (CON_CIERRES)', 72, 'cierres')
)
select e.n, e.script, 'Organización ' || e.org as organizacion, e.que, e.esperado, v.encontrado,
       case when e.campo in ('partidas_sin_lineas', 'liq_sin_subcaja') then case when v.encontrado = 0 then 'OK' else 'REVISAR' end
            when v.encontrado >= e.esperado then 'OK' else 'FALTA' end as estado
from e join c on c.cod = e.org
cross join lateral (select case e.campo
  when 'facturas' then c.facturas when 'fel' then c.fel when 'cargas_c' then c.cargas_c when 'cargas_v' then c.cargas_v when 'det_c' then c.det_c when 'det_v' then c.det_v
  when 'partidas' then c.partidas when 'lineas' then c.lineas when 'partidas_sin_lineas' then c.partidas_sin_lineas when 'saldos' then c.saldos when 'saldos_cc' then c.saldos_cc
  when 'cierres' then c.cierres when 'liquidaciones' then c.liquidaciones else c.liq_sin_subcaja end as encontrado) v
union all
select 27, 263, 'Común', 'Tipos de documento de compras (1 a 12)', 12, count(*), case when count(*) >= 12 then 'OK' else 'FALTA' end
from public.tipos_documento_compra where codigo between 1 and 12

) v where estado <> 'OK' order by n;
