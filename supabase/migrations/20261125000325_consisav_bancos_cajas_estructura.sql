-- Script 325 · Consisav (organizaciones 13 a 17 = CONSISAV-8 a 12): bancos, cuentas bancarias, cheques y su detalle contable, cajas chicas y subcajas.
-- Parte 0 de 1: estructura. Todas las columnas con datos de los archivos ya tienen lugar en la base de datos (scripts 82, 179, 184 y 254);
--   esta parte solo asegura las que usa la carga, por si esos scripts no se ejecutaron. No crea columnas nuevas.
-- Se ejecuta después del script 324 (catálogo contable de Consisav). Puede ejecutarse de nuevo.

set lock_timeout = '20s';
alter table public.cuentas_bancarias add column if not exists cuenta_codigo text;
alter table public.cuentas_bancarias add column if not exists saldo_mensual numeric(18,2);
alter table public.cuentas_bancarias add column if not exists saldo_actual_anterior numeric(18,2);
alter table public.cuentas_bancarias add column if not exists moneda_local boolean;
alter table public.movimientos_bancarios add column if not exists origen_anterior text;
alter table public.movimientos_bancarios add column if not exists procesado boolean;
alter table public.movimientos_bancarios add column if not exists tipo_anterior text;
alter table public.movimientos_bancarios add column if not exists conciliado_anterior text;
alter table public.movimientos_bancarios add column if not exists moneda_integracion integer;
alter table public.movimientos_bancarios add column if not exists valor_cambio_anterior numeric(18, 6);
alter table public.movimientos_bancarios add column if not exists valor_anterior numeric(18, 2);
alter table public.movimientos_bancarios add column if not exists cuenta_bancaria_anterior text;
alter table public.movimientos_bancarios add column if not exists tipo_transaccion_anterior integer;
alter table public.movimiento_lineas add column if not exists cuenta_codigo_anterior text;
alter table public.cajas_chicas add column if not exists origen_anterior text;
alter table public.cajas_chicas add column if not exists usuario_anterior text;
alter table public.cajas_chicas add column if not exists cuenta_caja_id bigint references public.cuentas(id);
alter table public.caja_periodos add column if not exists origen_anterior text;
alter table public.caja_periodos add column if not exists fecha_creacion_anterior timestamp;
alter table public.caja_periodos add column if not exists estado_anterior text;
alter table public.caja_periodos add column if not exists archivo_anterior integer;

notify pgrst, 'reload schema';
