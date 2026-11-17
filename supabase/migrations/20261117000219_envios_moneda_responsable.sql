-- Script 219 · Facturación › Registros › Envíos de productos: moneda, valor de cambio y responsable del envío.
--   envios_venta: moneda_id (quetzales o dólares), tipo_cambio (valor de cambio, 1 en quetzales), vendedor_id (responsable,
--   del catálogo de vendedores) y responsable (nombre, para los envíos migrados sin vendedor en el catálogo).
--   El estado que muestra la pantalla: VIGENTE (emitido sin factura), OPERADO (ya tiene factura) y ANULADO.
--   Los envíos existentes quedan en quetzales con valor de cambio 1. Se puede ejecutar de nuevo.

alter table public.envios_venta add column if not exists moneda_id bigint references public.monedas (id) on delete set null;
alter table public.envios_venta add column if not exists tipo_cambio numeric(18, 6) not null default 1;
alter table public.envios_venta add column if not exists vendedor_id bigint references public.vendedores (id) on delete set null;
alter table public.envios_venta add column if not exists responsable text;
create index if not exists envios_venta_fecha_idx on public.envios_venta (localidad_id, fecha);

update public.envios_venta e set moneda_id = (select m.id from public.monedas m where upper(m.iso) = 'GTQ' order by m.id limit 1)
 where e.moneda_id is null;

notify pgrst, 'reload schema';
select count(*) as envios, count(moneda_id) as con_moneda, count(vendedor_id) as con_responsable from public.envios_venta;
