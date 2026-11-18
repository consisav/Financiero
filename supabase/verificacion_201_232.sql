-- Verificación de los scripts 201 a 232 (solo lee: no cambia nada). Cada renglón cuenta en la base lo que cargó un script y lo compara
-- con el total que dice su encabezado. Las tablas que crea un script se cuentan con una consulta protegida: si la tabla no existe, sale 0.
-- «esperado» vacío = el encabezado no da un total exacto (solo se revisa que haya datos).
with o as (select codigo::text as cod, id from public.organizaciones),
r(n, script, que, encontrado, esperado) as (
  select 1, '201', 'Centros de costo org. 2 (versión 1)',
    (select count(*) from public.centros_costo x join public.catalogos_centros k on k.id = x.catalogo_id join public.localidades l on l.id = k.localidad_id
      where l.organizacion_id = (select id from o where cod = '2'))::numeric, 445::numeric
  union all select 2, '202', 'Vendedores org. 2',
    (select count(*) from public.vendedores v join public.localidades l on l.id = v.localidad_id where l.organizacion_id = (select id from o where cod = '2')), 1
  union all select 3, '203', 'Liquidaciones de compras org. 2 (17496 menos 12 que no se migran)',
    (case when to_regclass('public.compra_liquidaciones') is null then 0 else (select count(*) from public.compra_liquidaciones q join public.compras c on c.id = q.compra_id
      join public.localidades l on l.id = c.localidad_id where l.organizacion_id = (select id from o where cod = '2')) end), 17484
  union all select 4, '204', 'Facturas de venta org. 2 migradas',
    (select count(*) from public.facturas_venta f where f.organizacion_id = (select id from o where cod = '2') and f.factura_anterior is not null), 54230
  union all select 5, '205', 'Anulaciones FEL org. 3 (tabla nueva)',
    (case when to_regclass('public.sat_dte_anulaciones') is null then 0 else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.sat_dte_anulaciones', false, true, '')))[1]::text::numeric end), 924
  union all select 6, '205', 'ID FEL org. 3 (tabla nueva)',
    (case when to_regclass('public.sat_fel_ids') is null then 0 else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.sat_fel_ids', false, true, '')))[1]::text::numeric end), 20000
  union all select 7, '215', 'Cierres anteriores org. 2',
    (case when to_regclass('public.cierres_contables_anteriores') is null then 0 else (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.cierres_contables_anteriores where organizacion_id = %s', (select id from o where cod = '2')), false, true, '')))[1]::text::numeric end), 929
  union all select 8, '215', 'Saldos de cierre org. 2',
    (case when to_regclass('public.saldos_cierre') is null then 0 else (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.saldos_cierre where organizacion_id = %s', (select id from o where cod = '2')), false, true, '')))[1]::text::numeric end), 43167
  union all select 9, '215', 'Saldos de cierre por centro org. 2',
    (case when to_regclass('public.saldos_cierre_centros') is null then 0 else (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.saldos_cierre_centros where organizacion_id = %s', (select id from o where cod = '2')), false, true, '')))[1]::text::numeric end), 679
  union all select 10, '216 + 240', 'Cierres anteriores org. 3 (182 + 2)',
    (case when to_regclass('public.cierres_contables_anteriores') is null then 0 else (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.cierres_contables_anteriores where organizacion_id = %s', (select id from o where cod = '3')), false, true, '')))[1]::text::numeric end), 184
  union all select 11, '216 + 240', 'Saldos de cierre org. 3 (12918 + 69)',
    (case when to_regclass('public.saldos_cierre') is null then 0 else (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.saldos_cierre where organizacion_id = %s', (select id from o where cod = '3')), false, true, '')))[1]::text::numeric end), 12987
  union all select 12, '219', 'Envíos: columna de moneda',
    (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'envios_venta' and column_name in ('moneda_id', 'tipo_cambio', 'vendedor_id', 'responsable')), 4
  union all select 13, '220 + 241', 'Envíos org. 3 del archivo (64 + 2)',
    (select count(*) from public.envios_venta e where e.organizacion_id = (select id from o where cod = '3') and e.envio_anterior is not null), 66
  union all select 14, '221', 'Localidades org. 4 y 7',
    (select count(*) from public.localidades l where l.organizacion_id in (select id from o where cod in ('4', '7'))), null
  union all select 15, '222', 'Cuentas contables org. 4 y 7',
    (select count(*) from public.cuentas x join public.catalogos_cuentas k on k.id = x.catalogo_id join public.localidades l on l.id = k.localidad_id
      where l.organizacion_id in (select id from o where cod in ('4', '7'))), null
  union all select 16, '223', 'Cuentas bancarias org. 4 y 7',
    (select count(*) from public.cuentas_bancarias b join public.localidades l on l.id = b.localidad_id where l.organizacion_id in (select id from o where cod in ('4', '7'))), null
  union all select 17, '224', 'Centros de costo org. 4 y 7 (4 + 690)',
    (select count(*) from public.centros_costo x join public.catalogos_centros k on k.id = x.catalogo_id join public.localidades l on l.id = k.localidad_id
      where l.organizacion_id in (select id from o where cod in ('4', '7'))), 694
  union all select 18, '224', 'Centros por cuenta (tabla nueva)',
    (case when to_regclass('public.centros_cuentas') is null then 0 else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.centros_cuentas', false, true, '')))[1]::text::numeric end), 13
  union all select 19, '225', 'Proveedores org. 4 y 7 (1160 + 787)',
    (select count(*) from public.proveedores p where p.organizacion_id in (select id from o where cod in ('4', '7'))), 1947
  union all select 20, '226', 'Vendedores org. 4',
    (select count(*) from public.vendedores v join public.localidades l on l.id = v.localidad_id where l.organizacion_id = (select id from o where cod = '4')), 4
  union all select 21, '226', 'Clientes org. 4 y 7 (235 + 1)',
    (select count(*) from public.clientes c where c.organizacion_id in (select id from o where cod in ('4', '7'))), 236
  union all select 22, '228', 'Productos org. 4',
    (select count(*) from public.productos p where p.organizacion_id = (select id from o where cod = '4')), 1301
  union all select 23, '229', 'Compras org. 4 y 7 del sistema anterior',
    (select count(*) from public.compras c join public.localidades l on l.id = c.localidad_id
      where l.organizacion_id in (select id from o where cod in ('4', '7')) and c.origen_anterior = 'VARIAS'), 4420
  union all select 24, '230', 'Detalle de compras org. 4 y 7 (cargado por el 230)',
    (select count(*) from public.compra_items i join public.compras c on c.id = i.compra_id join public.localidades l on l.id = c.localidad_id
      where l.organizacion_id in (select id from o where cod in ('4', '7')) and c.origen_anterior = 'VARIAS'), 6059
  union all select 25, '231', 'Detalle contable de compras org. 4 y 7',
    (select count(*) from public.compra_lineas x join public.compras c on c.id = x.compra_id join public.localidades l on l.id = c.localidad_id
      where l.organizacion_id in (select id from o where cod in ('4', '7')) and c.origen_anterior = 'VARIAS'), 10037
  union all select 26, '232', 'Liquidaciones de compras org. 4 y 7',
    (case when to_regclass('public.compra_liquidaciones') is null then 0 else (select count(*) from public.compra_liquidaciones q join public.compras c on c.id = q.compra_id
      join public.localidades l on l.id = c.localidad_id where l.organizacion_id in (select id from o where cod in ('4', '7'))) end), 4026
)
select n, script, que, encontrado, esperado,
       case when esperado is null then case when encontrado > 0 then 'CON DATOS' else 'SIN DATOS' end
            when encontrado = esperado then 'COMPLETO' when encontrado > esperado then 'MÁS DE LO ESPERADO' else 'FALTA' end as estado
from r order by n;
