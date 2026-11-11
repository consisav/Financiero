-- Script 200 · parte 0 de 61 · Organización 2: columnas nuevas del detalle contable de compras. Se ejecuta UNA vez, antes de las partes 1 a 61.
-- Si la tabla está ocupada por otra consulta, falla a los 20 segundos: ejecuta antes 198_compras_revisar_bloqueos.sql.
set lock_timeout = '20s';
alter table public.compra_lineas add column if not exists cuenta_codigo_anterior text;
alter table public.compra_lineas add column if not exists version_cuenta_anterior integer;
alter table public.compra_lineas add column if not exists centro_costo_anterior text;
alter table public.compra_lineas add column if not exists debe_anterior numeric(18, 2);
alter table public.compra_lineas add column if not exists haber_anterior numeric(18, 2);
alter table public.compra_lineas add column if not exists reconstruida boolean not null default false;
notify pgrst, 'reload schema';
