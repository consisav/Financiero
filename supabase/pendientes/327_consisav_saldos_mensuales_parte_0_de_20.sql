-- Script 327 · Saldos mensuales por cuenta del servidor Consisav: organizaciones 13 a 17 (CONSISAV-8 a CONSISAV-12 del sistema anterior),
--   de los 10 archivos CON_SALDOS_MENSUALES de «Datos Contables Servidor Consisav al 04-11-2026».
--   Los archivos traen 614444 filas; 282663 son copias idénticas de otra fila (se toman una vez) y de las 331781 restantes solo
--   90019 tienen algún monto (CONSISAV-9: 76862, CONSISAV-11: 12369, CONSISAV-12: 788); las que vienen en cero no traen información.
--   No existía dónde guardarlos: se crea la tabla saldos_mensuales_anteriores (saldo anterior, débitos, créditos y saldo actual de cada
--   cuenta por mes, en moneda local y extranjera: SALDO_ANTERIOR, DEBITOS_MES, CREDITOS_MES, SALDO_ACTUAL y MI_*). Cada fila se liga a su cuenta
--   (catálogo versión 1 de la empresa); si la cuenta no existe queda el código. Columnas vacías (no se guardan): EMPRESA_CONSOLIDA, TIPO_CAMBIO.
--   Cada empresa se busca por su organización (organizacion_anterior = CONSISAV-n) y su correlativo (= LOCALIDAD del sistema anterior).
--   Ejecutar después del script 324. Orden: esta parte 0 (estructura) y luego las partes de datos en cualquier orden. Se puede ejecutar de nuevo: actualiza.

create table if not exists public.saldos_mensuales_anteriores (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  anio integer not null, mes integer not null check (mes between 1 and 12), cuenta_codigo text not null, cuenta_id bigint references public.cuentas (id) on delete set null,
  saldo_anterior numeric(18, 2) not null default 0, debitos numeric(18, 2) not null default 0, creditos numeric(18, 2) not null default 0, saldo_actual numeric(18, 2) not null default 0,
  saldo_anterior_mi numeric(18, 2) not null default 0, debitos_mi numeric(18, 2) not null default 0, creditos_mi numeric(18, 2) not null default 0, saldo_actual_mi numeric(18, 2) not null default 0,
  unique (localidad_id, anio, mes, cuenta_codigo)
);
comment on table public.saldos_mensuales_anteriores is 'CON_SALDOS_MENSUALES del sistema anterior: saldos por cuenta y mes (moneda local y _mi = moneda extranjera).';
create index if not exists saldos_mensuales_anteriores_cuenta_idx on public.saldos_mensuales_anteriores (cuenta_id);
create index if not exists saldos_mensuales_anteriores_org_idx on public.saldos_mensuales_anteriores (organizacion_id);
alter table public.saldos_mensuales_anteriores enable row level security;
drop policy if exists "saldos_mensuales_anteriores: leer" on public.saldos_mensuales_anteriores;
create policy "saldos_mensuales_anteriores: leer" on public.saldos_mensuales_anteriores for select to authenticated using (public.usuario_activo());
drop policy if exists "saldos_mensuales_anteriores: escribir" on public.saldos_mensuales_anteriores;
create policy "saldos_mensuales_anteriores: escribir" on public.saldos_mensuales_anteriores for all to authenticated
  using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());
grant select, insert, update, delete on public.saldos_mensuales_anteriores to authenticated;

notify pgrst, 'reload schema';
