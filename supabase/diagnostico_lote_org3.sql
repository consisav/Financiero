-- Diagnóstico del lote del 05 al 17-11-2026 de la organización 3 (solo lee).
-- 1) Facturas de CAR_FACTURAS que no quedaron migradas y la factura del sistema que ya usa ese número.
select 'FACTURA NO MIGRADA' as tipo, format('3-0%s factura %s', v.loc, v.fac) as registro,
       (select format('ya existe la factura número %s hecha en este sistema (id %s, %s, total %s, estado %s)', f.numero, f.id, to_char(f.fecha_emision, 'DD/MM/YYYY'), f.total, f.estado)
          from public.facturas_venta f where f.localidad_id = l.id and f.numero = v.fac limit 1) as detalle
from (values (1, 5970), (1, 5971), (1, 5972), (1, 5973), (1, 5974), (1, 5975), (1, 5976), (2, 7340), (2, 7341), (2, 7342), (2, 7343), (2, 7344), (2, 7345), (2, 7346), (2, 7347), (2, 7348), (2, 7349), (2, 7350), (2, 7351), (2, 7352), (2, 7353), (2, 7354), (2, 7355), (2, 7356), (2, 7357), (2, 7358), (2, 7359), (2, 7360), (2, 7361), (2, 7362), (2, 7363), (2, 7364), (2, 7365), (2, 7366), (2, 7367), (2, 7368), (2, 7369), (2, 7370), (2, 7371), (2, 7372), (2, 7373), (2, 7374), (2, 7375), (2, 7376), (2, 7377), (2, 7378), (2, 7379), (2, 7380), (2, 7381), (2, 7382), (2, 7383), (2, 7384), (2, 7385), (2, 7386), (2, 7387), (2, 7388), (2, 7389), (2, 7390), (2, 7391), (2, 7392), (2, 7393), (2, 7394), (2, 7395), (2, 7396), (2, 7397), (2, 7398), (2, 7399), (2, 7400)) v(loc, fac)
join public.localidades l on l.organizacion_id = (select id from public.organizaciones where codigo::text = '3') and l.correlativo = v.loc
where not exists (select 1 from public.facturas_venta f where f.localidad_id = l.id and f.factura_anterior = v.fac)
union all
-- 2) Compras de los documentos de liquidación (ACT_DOCTOS_LIQUIDA) que no están en la base.
select 'COMPRA QUE NO ESTÁ', format('3-0%s compra %s', v.loc, v.compra), 'el lote no trae ACT_COMPRAS ni ACT_COMPRAS_MED; la compra tampoco se ingresó en este sistema con ese número'
from (values (2, 305), (2, 307), (2, 309), (2, 313), (2, 314)) v(loc, compra)
join public.localidades l on l.organizacion_id = (select id from public.organizaciones where codigo::text = '3') and l.correlativo = v.loc
where not exists (select 1 from public.compras c where c.localidad_id = l.id and (c.compra_anterior = v.compra or c.compra_varia_anterior = v.compra));
