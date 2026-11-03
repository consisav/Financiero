-- Tipos de cambio de compra y venta con referencia de Banco Industrial al 03-11-2026,
-- expresados en Quetzales (moneda de integración).
--   Dólar: cotización en agencia de Banco Industrial: compra Q7.42, venta Q7.82.
--   Euro y yen: Banco Industrial no publica su cotización en línea (se solicita por teléfono,
--   Bi en Línea o agencia). Se calculan aplicando el mismo margen del dólar de Banco Industrial
--   sobre el tipo de cambio de referencia del Banguat (Q7.64187): compra −2.904 %, venta +2.331 %,
--   sobre la cotización de mercado del euro (Q8.55) y del yen (Q0.05095). Verificarlos con el banco.
-- Puede ejecutarse de nuevo: no duplica la tasa si ya existe la misma para ese día.

insert into public.tipos_cambio (moneda_id, fecha, moneda_venta_id, valor_venta, moneda_compra_id, valor_compra)
select m.id, now(), q.id, t.venta, q.id, t.compra
from (values (2, 7.82::numeric, 7.42::numeric),
             (3, 8.749298, 8.301764),
             (4, 0.052138, 0.049471)) as t (codigo, venta, compra)
join public.monedas m on m.codigo = t.codigo
cross join (select id from public.monedas where codigo = 1) q
where not exists (
  select 1 from public.tipos_cambio x
  where x.moneda_id = m.id and x.valor_venta = t.venta and x.valor_compra = t.compra
    and (x.fecha at time zone 'America/Guatemala')::date = (now() at time zone 'America/Guatemala')::date);
