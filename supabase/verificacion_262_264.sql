-- Verificación de los scripts 262, 263 y 264 (facturas y catálogos de las organizaciones 4 y 7). SOLO LEE. Cada renglón dice OK o FALTA.
with o as (select codigo::text as cod, id from public.organizaciones where codigo::text in ('4', '7')),
c as (
  select o.cod,
    (select count(*) from public.facturas_venta f join public.localidades l on l.id = f.localidad_id where l.organizacion_id = o.id and f.factura_anterior is not null) as facturas,
    (select count(*) from public.sat_tipos_documento_fel t where t.organizacion_id = o.id) as fel,
    (select count(*) from public.cargas_sat s where s.organizacion_id = o.id and s.tipo_carga = 'COMPRAS' and s.archivo_anterior is not null) as cargas_c,
    (select count(*) from public.cargas_sat s where s.organizacion_id = o.id and s.tipo_carga = 'VENTAS' and s.archivo_anterior is not null) as cargas_v,
    (select count(*) from public.carga_sat_lineas d join public.cargas_sat s on s.id = d.carga_id where s.organizacion_id = o.id and s.archivo_anterior is not null and s.tipo_carga = 'COMPRAS') as det_c,
    (select count(*) from public.carga_sat_ventas_lineas d join public.cargas_sat s on s.id = d.carga_id where s.organizacion_id = o.id) as det_v
  from o
),
e(n, org, que, esperado, campo) as (values
  (1, '4', 'Facturas de venta (CAR_FACTURAS)', 1475, 'facturas'),
  (2, '4', 'Tipos de documento FEL', 16, 'fel'), (3, '7', 'Tipos de documento FEL', 16, 'fel'),
  (4, '4', 'Archivos SAT de compras', 436, 'cargas_c'), (5, '7', 'Archivos SAT de compras', 15, 'cargas_c'),
  (6, '4', 'Archivos SAT de ventas', 1, 'cargas_v'), (7, '7', 'Archivos SAT de ventas', 12, 'cargas_v'),
  (8, '4', 'Facturas de los archivos SAT de compras (264)', 3891, 'det_c'), (9, '7', 'Facturas de los archivos SAT de compras (264)', 213, 'det_c'),
  (10, '4', 'Facturas de los archivos SAT de ventas (264)', 1, 'det_v'), (11, '7', 'Facturas de los archivos SAT de ventas (264)', 416, 'det_v')
)
select e.n, 'Organización ' || e.org as organizacion, e.que, e.esperado, v.encontrado,
       case when v.encontrado >= e.esperado then 'OK' else 'FALTA' end as estado
from e join c on c.cod = e.org
cross join lateral (select case e.campo when 'facturas' then c.facturas when 'fel' then c.fel when 'cargas_c' then c.cargas_c when 'cargas_v' then c.cargas_v when 'det_c' then c.det_c else c.det_v end as encontrado) v
union all
select 12, 'Común', 'Tipos de documento de compras', 12, count(*), case when count(*) >= 12 then 'OK' else 'FALTA' end
from public.tipos_documento_compra where codigo between 1 and 12
order by 1;
