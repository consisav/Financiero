-- Script 264 · Organizaciones 4 (Tecnoalsa) y 7 (AAPOS): detalle de los archivos de facturas SAT cargados en el sistema anterior
--   (los encabezados los carga el script 263, que se ejecuta antes).
--   · CON_DETALLE_ARCHIVOS_FAC.xlsx (4158 facturas recibidas: 4-01: 3944, 7-01: 214) → carga_sat_lineas (tabla del script 140, la de Compras ›
--     Carga Facturas SAT). La clasificación (CLASIFICACION) y la cuenta (CUENTA) se ligan solas a su catálogo, como al cargar un archivo en pantalla.
--     Quedan sin generar: al generar, si la compra o el documento de caja ya existe (migrados), solo se enlaza.
--   · CON_DETALLE_ARCHIVOS_VEN.xlsx (417 facturas emitidas: 4-01: 1, 7-01: 416) → carga_sat_ventas_lineas, tabla nueva con las mismas columnas:
--     47 facturas emitidas por AAPOS venían también en una carga de compras (archivo 6), y una factura solo puede estar
--     una vez en las cargas de compras de la empresa; por eso las de ventas van en su propia tabla.
--   Columnas nuevas (traen datos y no existían): centro_costo_anterior (CENTRO_COSTO), orden_excel_anterior (ORDEN_EXCEL), fecha_emision_anterior
--   (la fecha tal como venía cuando no es una fecha: 2 facturas, p. ej. «0») y otras_cargas_anterior (en qué otros archivos venía la factura).
--   Datos ajustados:
--     · 54 facturas recibidas venían repetidas en dos o más archivos (el sistema anterior las marcaba «DOCUMENTO DUPLICADO»): se guardan una
--       vez, en el primer archivo, con la lista de los demás en otras_cargas_anterior; si el primero no traía clasificación o cuenta, se toman del otro.
--     · 59 recibos sin número de autorización (no son FEL): su autorización queda como «SIN AUTORIZACION tipo serie-número NIT nit».
--     · Fechas: se aceptan los formatos ISO (con - o /) y día/mes/año; sin zona horaria se toma la hora de Guatemala. FECHA_ANULADA viene en 0.
--   CONTIENE NOMBRES Y NIT DE EMISORES Y RECEPTORES: las partes con datos no se suben al repositorio (la parte 1, solo estructura, sí).
--   Ejecutar las 13 partes en orden en el SQL Editor de Supabase. Se puede ejecutar de nuevo: actualiza.
-- Parte 1 de 13: estructura.
set lock_timeout = '20s';

alter table public.carga_sat_lineas add column if not exists centro_costo_anterior text;
alter table public.carga_sat_lineas add column if not exists orden_excel_anterior integer;
alter table public.carga_sat_lineas add column if not exists fecha_emision_anterior text;
alter table public.carga_sat_lineas add column if not exists otras_cargas_anterior text;

-- Facturas emitidas (ventas) de los archivos SAT: mismas columnas que carga_sat_lineas.
create table if not exists public.carga_sat_ventas_lineas (like public.carga_sat_lineas including defaults including identity including constraints);
alter table public.carga_sat_ventas_lineas add column if not exists centro_costo_anterior text;
alter table public.carga_sat_ventas_lineas add column if not exists orden_excel_anterior integer;
alter table public.carga_sat_ventas_lineas add column if not exists fecha_emision_anterior text;
alter table public.carga_sat_ventas_lineas add column if not exists otras_cargas_anterior text;
do $pk$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.carga_sat_ventas_lineas'::regclass and contype = 'p') then
    alter table public.carga_sat_ventas_lineas add primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'carga_sat_ventas_lineas_carga_fk') then
    alter table public.carga_sat_ventas_lineas add constraint carga_sat_ventas_lineas_carga_fk foreign key (carga_id) references public.cargas_sat(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'carga_sat_ventas_lineas_localidad_fk') then
    alter table public.carga_sat_ventas_lineas add constraint carga_sat_ventas_lineas_localidad_fk foreign key (localidad_id) references public.localidades(id);
  end if;
end;
$pk$;
create unique index if not exists carga_sat_ventas_lineas_autorizacion on public.carga_sat_ventas_lineas (localidad_id, numero_autorizacion);
create index if not exists carga_sat_ventas_lineas_carga on public.carga_sat_ventas_lineas (carga_id, linea);
drop trigger if exists carga_sat_ventas_lineas_auditar on public.carga_sat_ventas_lineas;
create trigger carga_sat_ventas_lineas_auditar before insert or update on public.carga_sat_ventas_lineas for each row execute function public.auditar();

alter table public.carga_sat_ventas_lineas enable row level security;
drop policy if exists "carga_sat_ventas_lineas: leer" on public.carga_sat_ventas_lineas;
create policy "carga_sat_ventas_lineas: leer" on public.carga_sat_ventas_lineas for select to authenticated using (public.usuario_activo());
drop policy if exists "carga_sat_ventas_lineas: crear" on public.carga_sat_ventas_lineas;
create policy "carga_sat_ventas_lineas: crear" on public.carga_sat_ventas_lineas for insert to authenticated with check (public.puede_editar_catalogos());
drop policy if exists "carga_sat_ventas_lineas: modificar" on public.carga_sat_ventas_lineas;
create policy "carga_sat_ventas_lineas: modificar" on public.carga_sat_ventas_lineas for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());
drop policy if exists "carga_sat_ventas_lineas: quitar" on public.carga_sat_ventas_lineas;
create policy "carga_sat_ventas_lineas: quitar" on public.carga_sat_ventas_lineas for delete to authenticated using (public.puede_editar_catalogos());
grant select, insert, update, delete on public.carga_sat_ventas_lineas to authenticated;

notify pgrst, 'reload schema';
