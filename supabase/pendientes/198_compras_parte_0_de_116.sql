-- Script 198 · parte 0 de 116 · Organización 2: columnas nuevas de compras. Se ejecuta UNA vez, antes de las partes 1 a 116.
-- Si la tabla de compras está ocupada por otra consulta, falla a los 20 segundos: ejecuta antes 198_compras_revisar_bloqueos.sql.
set lock_timeout = '20s';
-- Columnas del sistema anterior (las del script 89 y las que trae este archivo).
alter table public.compras add column if not exists modulo_factura integer;
alter table public.compras add column if not exists numero_cheque text;
alter table public.compras add column if not exists usuario_modifica_anterior text;
alter table public.compras add column if not exists fecha_modifica_anterior date;
alter table public.compras add column if not exists tipo_compra_anterior text;
alter table public.compras add column if not exists poliza_anio integer;
alter table public.compras add column if not exists poliza_mes integer;
alter table public.compras add column if not exists poliza_numero integer;
alter table public.compras add column if not exists pct_iva numeric;
alter table public.compras add column if not exists pct_retencion numeric;
alter table public.compras add column if not exists propina numeric;
alter table public.compras add column if not exists fecha_transferencia date;
alter table public.compras add column if not exists clasificacion_pago integer;
alter table public.compras add column if not exists usuario_autoriza text;
alter table public.compras add column if not exists tipo_periodo_compra text;
alter table public.compras add column if not exists transaccion_retencion integer;
alter table public.compras add column if not exists valor_cambio_anterior numeric;
alter table public.compras add column if not exists origen_anterior text;
alter table public.compras add column if not exists compra_anterior integer;
alter table public.compras add column if not exists documento_anterior text;
alter table public.compras add column if not exists proveedor_anterior integer;
alter table public.compras add column if not exists transaccion_anterior integer;
alter table public.compras add column if not exists regimen_isr_anterior integer;
alter table public.compras add column if not exists fecha_ingreso_anterior timestamp;
alter table public.compras add column if not exists usuario_anula_anterior text;
alter table public.compras add column if not exists fecha_anula_anterior timestamp;
alter table public.compras add column if not exists cuenta_bancaria_anterior text;
alter table public.compras add column if not exists transferencia_anterior text;
alter table public.compras add column if not exists banco_anterior integer;
alter table public.compras add column if not exists contrasena_anterior text;
alter table public.compras add column if not exists exento_anterior numeric;
alter table public.compras add column if not exists anio_presentacion_anterior integer;
alter table public.compras add column if not exists retencion_valor_anterior numeric;
alter table public.compras add column if not exists fecha_documento_anterior text;
alter table public.compras add column if not exists fecha_vencimiento_anterior text;
create unique index if not exists compras_origen_anterior_uk on public.compras (localidad_id, origen_anterior, compra_anterior) where origen_anterior is not null;

notify pgrst, 'reload schema';
