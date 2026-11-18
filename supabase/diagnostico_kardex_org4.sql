-- Diagnóstico del kardex de la organización 4 (script 272, partes 2 a 6). SOLO LEE.
-- Dice si las partes del kardex ya se ejecutaron y, si no entró nada, qué le falta (productos, bodegas o tipos de movimiento).
with o as (select o.id as org, l.id as loc from public.organizaciones o join public.localidades l on l.organizacion_id = o.id and l.correlativo = 1 where o.codigo::text = '4')
select 1 as n, 'Movimientos de kardex de la 4-01 (cualquier origen)' as que, (select count(*) from public.inventario_movimientos m, o where m.localidad_id = o.loc)::text as valor
union all select 2, 'Movimientos migrados de la 4-01 (origen_anterior = MIGRADO)', (select count(*) from public.inventario_movimientos m, o where m.localidad_id = o.loc and m.origen_anterior = 'MIGRADO')::text
union all select 3, 'Movimientos migrados de toda la organización 4', (select count(*) from public.inventario_movimientos m, o where m.organizacion_id = o.org and m.origen_anterior = 'MIGRADO')::text
union all select 4, 'Productos de la 4-01', (select count(*) from public.productos p, o where p.localidad_id = o.loc)::text
union all select 5, 'Productos 1, 3 y 263 (los usa el kardex)', (select string_agg(p.codigo::text, ', ' order by p.codigo) from public.productos p, o where p.localidad_id = o.loc and p.codigo in (1, 3, 263))
union all select 6, 'Bodegas de la 4-01 (código / código anterior)', (select string_agg(b.codigo || ' / ' || coalesce(b.codigo_anterior::text, '-'), ', ' order by b.codigo) from public.bodegas b, o where b.localidad_id = o.loc)
union all select 7, 'Tipos de movimiento que usa el kardex (1, 2, 3, 4, 5, 6, 7, 8, 19, 20, 25) en la tabla general', (select count(*) from public.tipos_movimiento_inventario t where t.codigo in (1, 2, 3, 4, 5, 6, 7, 8, 19, 20, 25))::text
union all select 8, 'Documentos de inventario migrados (parte 1)', (select count(*) from public.documentos_inventario d, o where d.organizacion_id = o.org and d.origen_anterior = 'MIGRADO')::text
order by 1;
