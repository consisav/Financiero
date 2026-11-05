-- Productos: principio activo (sustancia activa de los medicamentos o línea del producto); lo muestra el
-- Kardex de Productos. Se ejecuta después del script 67.
alter table public.productos add column if not exists principio_activo text;

notify pgrst, 'reload schema';
