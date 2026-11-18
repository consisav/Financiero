-- Verificación de los scripts 265 a 269 (partidas, cierres, saldos de cierre y liquidación de caja chica de las organizaciones 4 y 7). SOLO LEE. Cada renglón dice OK o FALTA.
with o as (select codigo::text as cod, id from public.organizaciones where codigo::text in ('4', '7')),
c as (
  select o.cod,
    (select count(*) from public.partidas p where p.organizacion_id = o.id and p.origen_anterior = 'MIGRADO') as partidas,
    (select count(*) from public.partida_lineas l join public.partidas p on p.id = l.partida_id where p.organizacion_id = o.id and l.origen_anterior = 'MIGRADO') as lineas,
    (select count(*) from public.saldos_cierre s where s.organizacion_id = o.id) as saldos,
    (select count(*) from public.saldos_cierre_centros s where s.organizacion_id = o.id) as saldos_cc,
    (select count(*) from public.caja_liquidacion_documentos d where d.organizacion_id = o.id) as liquidaciones,
    (select count(*) from public.cierres_contables_anteriores x where x.organizacion_id = o.id) as cierres
  from o
),
e(n, org, que, esperado, campo) as (values
  (1, '4', 'Partidas (CON_POLIZAS_N)', 2324, 'partidas'), (2, '7', 'Partidas (CON_POLIZAS_N)', 458, 'partidas'),
  (3, '4', 'Líneas de partidas (sin las que quedan en cero)', 10598, 'lineas'), (4, '7', 'Líneas de partidas (sin las que quedan en cero)', 2339, 'lineas'),
  (5, '4', 'Saldos de cierre por cuenta (con monto)', 17325, 'saldos'), (6, '7', 'Saldos de cierre por cuenta (con monto)', 1464, 'saldos'),
  (7, '7', 'Saldos de cierre por centro de costo (con monto)', 2673, 'saldos_cc'),
  (8, '4', 'Documentos de liquidación de caja chica', 1177, 'liquidaciones'), (9, '7', 'Documentos de liquidación de caja chica', 183, 'liquidaciones'),
  (10, '4', 'Encabezados de cierre (CON_CIERRES)', 89, 'cierres'), (11, '7', 'Encabezados de cierre (CON_CIERRES)', 72, 'cierres')
)
select e.n, 'Organización ' || e.org as organizacion, e.que, e.esperado, v.encontrado,
       case when v.encontrado >= e.esperado then 'OK' else 'FALTA' end as estado
from e join c on c.cod = e.org
cross join lateral (select case e.campo when 'partidas' then c.partidas when 'lineas' then c.lineas when 'saldos' then c.saldos
  when 'saldos_cc' then c.saldos_cc when 'cierres' then c.cierres else c.liquidaciones end as encontrado) v
order by e.n;
