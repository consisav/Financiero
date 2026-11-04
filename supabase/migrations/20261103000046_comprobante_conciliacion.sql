-- Bancos · Imagen del estado de cuenta de cada conciliación bancaria (imagen o PDF), en el mismo
-- bucket privado «bancos» del script 45, en la carpeta <localidad>/conciliaciones/<conciliación>/.
-- Se ejecuta después del script 45.

alter table public.conciliaciones add column if not exists comprobante_ruta text;
alter table public.conciliaciones add column if not exists comprobante_nombre text;
alter table public.conciliaciones add column if not exists comprobante_tipo text;

notify pgrst, 'reload schema';
