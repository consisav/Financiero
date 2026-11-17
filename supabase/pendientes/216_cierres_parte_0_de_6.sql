-- Script 216 · Organización 3 (Futura Farma-Mavisa): cierres contables del sistema anterior, de la carpeta «Data Cierres».
--   · CON_TIPOS_CIERRES (20): mismo catálogo que cargó el script 215; solo se agregan los que falten (no se sobrescriben).
--     Única diferencia: el tipo 11 (CIERRE CENTROS 4) aquí es clasificación E y en el Hospital C; Futura Farma no lo usa.
--     El tipo 4 lo usan 57 cierres de Futura Farma pero no viene en CON_TIPOS_CIERRES: se crea en el catálogo
--     como cierre por centros (clasificación E), porque sus saldos vienen en CON_SALDOS_CIERRE_CC.
--   · CON_CIERRES (182) → cierres_contables_anteriores, localidades 3-01 y 3-02, años 2023-2026.
--   · CON_SALDOS_CIERRE (31720 filas) → saldos_cierre: solo las 12918 con algún monto; las 18802 en cero no traen información.
--     Cada fila se liga a su cuenta (código y VERSION del catálogo de la localidad); si no existe queda el código.
--   · CON_SALDOS_CIERRE_CC (10556 filas) → saldos_cierre_centros: todas vienen en cero: no hay nada que migrar.
--   · Crea las tablas si aún no existen (igual que la parte 0 del 215), así que puede correrse antes o después del 215.
--   · Localidad del sistema anterior = correlativo de la localidad de la organización 3 (1 → 3-01, 2 → 3-02).
--   Partes: supabase/pendientes/216_cierres_parte_0 (estructura y cierres) y 216_cierres_parte_1..N (saldos). Se pueden ejecutar de nuevo: actualizan.

-- Script 216 · parte 0: estructura, tipos de cierre y cierres. Se ejecuta antes de las demás partes.
create table if not exists public.tipos_cierre (
  codigo integer primary key, descripcion text not null, tipo_cuenta integer, mostrar_lista text, definitivo boolean not null default false,
  frecuencia text, clasificacion text
);
comment on table public.tipos_cierre is 'CON_TIPOS_CIERRES del sistema anterior. frecuencia M mensual / A anual; clasificacion C contable / E por centros; mostrar_lista S, N o C.';
create table if not exists public.cierres_contables_anteriores (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  anio integer not null, mes integer not null, tipo_cierre integer not null references public.tipos_cierre (codigo),
  resultado_ejercicio numeric(18, 2) not null default 0, fecha timestamptz, usuario text, unique (localidad_id, anio, mes, tipo_cierre)
);
create table if not exists public.saldos_cierre (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  anio integer not null, mes integer not null, tipo_cierre integer not null references public.tipos_cierre (codigo),
  cuenta_codigo text not null, version integer not null default 1, cuenta_id bigint references public.cuentas (id) on delete set null,
  saldo_anterior numeric(18, 2) not null default 0, debitos numeric(18, 2) not null default 0, creditos numeric(18, 2) not null default 0, saldo_actual numeric(18, 2) not null default 0,
  saldo_anterior_mi numeric(18, 2) not null default 0, debitos_mi numeric(18, 2) not null default 0, creditos_mi numeric(18, 2) not null default 0, saldo_actual_mi numeric(18, 2) not null default 0,
  mostrar_reporte boolean not null default true, unique (localidad_id, anio, mes, tipo_cierre, cuenta_codigo, version)
);
create index if not exists saldos_cierre_cuenta_idx on public.saldos_cierre (cuenta_id);
create table if not exists public.saldos_cierre_centros (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  anio integer not null, mes integer not null, tipo_cierre integer not null references public.tipos_cierre (codigo),
  centro_codigo text not null, centro_id bigint references public.centros_costo (id) on delete set null,
  saldo_anterior numeric(18, 2) not null default 0, debitos numeric(18, 2) not null default 0, creditos numeric(18, 2) not null default 0, saldo_actual numeric(18, 2) not null default 0,
  saldo_mensual numeric(18, 2) not null default 0, saldo_anterior_mi numeric(18, 2) not null default 0, debitos_mi numeric(18, 2) not null default 0, creditos_mi numeric(18, 2) not null default 0,
  saldo_actual_mi numeric(18, 2) not null default 0, saldo_mensual_mi numeric(18, 2) not null default 0, unique (localidad_id, anio, mes, tipo_cierre, centro_codigo)
);
create index if not exists saldos_cierre_centros_centro_idx on public.saldos_cierre_centros (centro_id);
-- RLS explícito (el editor de Supabase avisa si una tabla nueva no lo tiene en el mismo script).
alter table public.tipos_cierre enable row level security;
alter table public.cierres_contables_anteriores enable row level security;
alter table public.saldos_cierre enable row level security;
alter table public.saldos_cierre_centros enable row level security;
do $$
declare t text;
begin
  foreach t in array array['tipos_cierre', 'cierres_contables_anteriores', 'saldos_cierre', 'saldos_cierre_centros'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': leer') then
      execute format('create policy %I on public.%I for select to authenticated using (public.usuario_activo())', t || ': leer', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': escribir') then
      execute format('create policy %I on public.%I for all to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t || ': escribir', t);
    end if;
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

insert into public.tipos_cierre (codigo, descripcion, tipo_cuenta, mostrar_lista, definitivo, frecuencia, clasificacion) values
  (1, 'PREVIO', null, 'S', false, 'M', 'C'),
  (2, 'DEFINITIVO', null, 'S', true, 'M', 'C'),
  (3, 'ANUAL', null, 'S', true, 'A', 'C'),
  (10, 'BALANCE GENERAL', null, 'N', false, 'M', 'C'),
  (11, 'CIERRE CENTROS 4', 4, 'S', false, 'M', 'E'),
  (12, 'CIERRE CENTROS 5', 5, 'S', false, 'M', 'E'),
  (13, 'CIERRE CENTROS 4 RES OPERACIONES', 4, 'N', false, 'M', 'E'),
  (21, 'CIERRE CENTROS 4 (DEFINITIVO)', 4, 'N', true, 'M', 'E'),
  (22, 'CIERRE CENTROS 5 (DEFINITIVO)', 5, 'N', true, 'M', 'E'),
  (14, 'CIERRE CENTROS 5 RES X CENTRO Y CUENTA', 5, 'N', false, 'M', 'E'),
  (15, 'CIERRE CENTROS 6', 6, 'S', false, 'M', 'E'),
  (16, 'CIERRE CENTROS 7', 7, 'S', false, 'M', 'E'),
  (17, 'CIERRE CENTROS 8', 8, 'C', false, 'M', 'E'),
  (25, 'CIERRE CENTROS 6 (DEFINITIVO)', 6, 'N', true, 'M', 'E'),
  (26, 'CIERRE CENTROS 7 (DEFINITIVO)', 7, 'N', true, 'M', 'E'),
  (27, 'CIERRE CENTROS 8 (DEFINITIVO)', 8, 'N', true, 'M', 'E'),
  (31, 'CIERRE SIN CUENTAS RESULTADO', null, 'N', false, 'M', 'C'),
  (35, 'CIERRE CENTROS 1', 1, 'S', false, 'M', 'E'),
  (36, 'CIERRE CENTROS 2', 2, 'S', false, 'M', 'E'),
  (4, 'CIERRE CENTROS (TIPO 4, SIN DESCRIPCION EN EL SISTEMA ANTERIOR)', null, 'S', false, 'M', 'E')
on conflict (codigo) do nothing;

insert into public.cierres_contables_anteriores (organizacion_id, localidad_id, anio, mes, tipo_cierre, resultado_ejercicio, fecha, usuario)
select l.organizacion_id, l.id, v.anio, v.mes, v.tipo, v.res, (v.f::timestamp at time zone 'America/Guatemala'), v.usr
from (values
  (1, 2023, 10, 10, 0, '2023-11-10 09:53:51', 'SYS'),
  (1, 2023, 11, 1, 0, '2023-11-30 08:59:55', 'ATZ'),
  (1, 2023, 11, 10, 0, '2023-11-14 07:46:34', 'SYS'),
  (1, 2023, 12, 1, 0, '2026-08-06 17:38:01', 'SYS'),
  (1, 2023, 12, 2, 0, '2026-08-07 12:26:53', 'FRA'),
  (1, 2023, 12, 4, 0, '2026-08-07 12:26:54', 'SYS'),
  (1, 2023, 12, 10, 0, '2024-01-03 13:43:34', 'SYS'),
  (1, 2024, 1, 1, 0, '2026-08-06 18:12:57', 'SYS'),
  (1, 2024, 1, 2, 0, '2026-08-07 12:27:02', 'FRA'),
  (1, 2024, 1, 4, 0, '2026-08-07 12:27:03', 'SYS'),
  (1, 2024, 1, 10, 0, '2026-08-05 16:29:23', 'SYS'),
  (1, 2024, 2, 1, 0, '2026-08-06 18:13:00', 'SYS'),
  (1, 2024, 2, 2, 0, '2026-08-07 12:27:06', 'FRA'),
  (1, 2024, 2, 4, 0, '2026-08-07 12:27:08', 'SYS'),
  (1, 2024, 3, 1, 0, '2026-08-06 18:13:04', 'SYS'),
  (1, 2024, 3, 2, 0, '2026-08-07 12:27:12', 'FRA'),
  (1, 2024, 3, 4, 0, '2026-08-07 12:27:13', 'SYS'),
  (1, 2024, 4, 1, 0, '2026-08-06 18:13:06', 'SYS'),
  (1, 2024, 4, 2, 0, '2026-08-07 12:27:17', 'FRA'),
  (1, 2024, 4, 4, 0, '2026-08-07 12:27:19', 'SYS'),
  (1, 2024, 5, 1, 0, '2026-08-06 18:13:09', 'SYS'),
  (1, 2024, 5, 2, 0, '2026-08-07 12:27:22', 'FRA'),
  (1, 2024, 5, 4, 0, '2026-08-07 12:27:23', 'SYS'),
  (1, 2024, 6, 1, 0, '2026-08-06 18:13:12', 'SYS'),
  (1, 2024, 6, 2, 0, '2026-08-07 12:27:28', 'FRA'),
  (1, 2024, 6, 4, 0, '2026-08-07 12:27:30', 'SYS'),
  (1, 2024, 7, 1, 0, '2026-08-06 18:13:14', 'SYS'),
  (1, 2024, 7, 2, 0, '2026-08-07 12:27:34', 'FRA'),
  (1, 2024, 7, 4, 0, '2026-08-07 12:27:36', 'SYS'),
  (1, 2024, 8, 1, 0, '2026-08-06 18:13:17', 'SYS'),
  (1, 2024, 8, 2, 0, '2026-08-07 12:27:43', 'FRA'),
  (1, 2024, 8, 4, 0, '2026-08-07 12:27:44', 'SYS'),
  (1, 2024, 9, 1, 0, '2026-08-06 18:13:19', 'SYS'),
  (1, 2024, 9, 2, 0, '2026-08-07 12:27:47', 'FRA'),
  (1, 2024, 9, 4, 0, '2026-08-07 12:27:49', 'SYS'),
  (1, 2024, 10, 1, 0, '2026-08-06 18:13:23', 'SYS'),
  (1, 2024, 10, 2, 0, '2026-08-07 12:27:52', 'FRA'),
  (1, 2024, 10, 4, 0, '2026-08-07 12:27:53', 'SYS'),
  (1, 2024, 11, 1, 0, '2026-08-06 18:13:26', 'SYS'),
  (1, 2024, 11, 2, 0, '2026-08-07 12:27:56', 'FRA'),
  (1, 2024, 11, 4, 0, '2026-08-07 12:27:57', 'SYS'),
  (1, 2024, 12, 1, 0, '2026-08-06 18:13:29', 'SYS'),
  (1, 2024, 12, 2, 0, '2026-08-07 12:28:11', 'FRA'),
  (1, 2024, 12, 4, 0, '2026-08-07 12:28:12', 'SYS'),
  (1, 2024, 12, 10, 0, '2025-08-18 13:05:45', 'SYS'),
  (1, 2025, 1, 1, 0, '2026-08-07 10:35:33', 'SYS'),
  (1, 2025, 1, 2, 0, '2026-08-07 12:29:11', 'FRA'),
  (1, 2025, 1, 4, 0, '2026-08-07 12:29:12', 'SYS'),
  (1, 2025, 2, 1, 0, '2026-08-07 10:35:35', 'SYS'),
  (1, 2025, 2, 2, 0, '2026-08-07 12:29:14', 'FRA'),
  (1, 2025, 2, 4, 0, '2026-08-07 12:29:16', 'SYS'),
  (1, 2025, 3, 1, 0, '2026-08-07 10:35:38', 'SYS'),
  (1, 2025, 3, 2, 0, '2026-08-07 12:29:18', 'FRA'),
  (1, 2025, 3, 4, 0, '2026-08-07 12:29:19', 'SYS'),
  (1, 2025, 4, 1, 0, '2026-08-07 10:35:41', 'SYS'),
  (1, 2025, 4, 2, 0, '2026-08-07 12:29:22', 'FRA'),
  (1, 2025, 4, 4, 0, '2026-08-07 12:29:23', 'SYS'),
  (1, 2025, 5, 1, 0, '2026-08-07 10:35:45', 'SYS'),
  (1, 2025, 5, 2, 0, '2026-08-07 12:29:27', 'FRA'),
  (1, 2025, 5, 4, 0, '2026-08-07 12:29:28', 'SYS'),
  (1, 2025, 6, 1, 0, '2026-08-07 10:35:47', 'SYS'),
  (1, 2025, 6, 2, 0, '2026-08-07 12:29:30', 'FRA'),
  (1, 2025, 6, 4, 0, '2026-08-07 12:29:32', 'SYS'),
  (1, 2025, 6, 10, 0, '2025-06-11 11:16:05', 'SYS'),
  (1, 2025, 7, 1, 0, '2026-08-07 10:35:50', 'SYS'),
  (1, 2025, 7, 2, 0, '2026-08-07 12:29:35', 'FRA'),
  (1, 2025, 7, 4, 0, '2026-08-07 12:29:36', 'SYS'),
  (1, 2025, 8, 1, 0, '2026-08-07 10:35:53', 'SYS'),
  (1, 2025, 8, 2, 0, '2026-08-07 12:29:38', 'FRA'),
  (1, 2025, 8, 4, 0, '2026-08-07 12:29:40', 'SYS'),
  (1, 2025, 9, 1, 0, '2026-08-07 10:35:56', 'SYS'),
  (1, 2025, 9, 2, 0, '2026-08-07 12:29:42', 'FRA'),
  (1, 2025, 9, 4, 0, '2026-08-07 12:29:44', 'SYS'),
  (1, 2025, 10, 1, 0, '2026-08-07 10:36:00', 'SYS'),
  (1, 2025, 10, 2, 0, '2026-08-07 12:29:47', 'FRA'),
  (1, 2025, 10, 4, 0, '2026-08-07 12:29:49', 'SYS'),
  (1, 2025, 11, 1, 0, '2026-08-07 10:36:03', 'SYS'),
  (1, 2025, 11, 2, 0, '2026-08-07 12:29:51', 'FRA'),
  (1, 2025, 11, 4, 0, '2026-08-07 12:29:52', 'SYS'),
  (1, 2025, 12, 1, 0, '2026-08-07 10:36:05', 'SYS'),
  (1, 2025, 12, 2, 0, '2026-08-07 12:30:09', 'FRA'),
  (1, 2025, 12, 4, 0, '2026-08-07 12:30:11', 'SYS'),
  (1, 2026, 1, 1, 0, '2026-03-09 16:28:22', 'SYS'),
  (1, 2026, 2, 1, 0, '2026-02-26 17:40:04', 'SYS'),
  (1, 2026, 3, 1, 0, '2026-03-27 00:00:27', 'SYS'),
  (1, 2026, 3, 4, 0, '2026-03-27 00:00:28', 'SYS'),
  (1, 2026, 3, 10, 0, '2026-03-27 00:07:30', 'SYS'),
  (1, 2026, 6, 1, 0, '2026-06-04 11:31:21', 'SYS'),
  (1, 2026, 6, 4, 0, '2026-06-04 11:31:21', 'SYS'),
  (1, 2026, 8, 1, 0, '2026-08-07 10:17:12', 'SYS'),
  (1, 2026, 8, 4, 0, '2026-08-07 10:17:12', 'SYS'),
  (2, 2023, 1, 4, 0, '2025-09-26 10:31:45', 'SYS'),
  (2, 2023, 12, 1, 0, '2025-10-09 15:33:39', 'SYS'),
  (2, 2023, 12, 2, 0, '2025-10-09 15:29:56', 'FRA'),
  (2, 2023, 12, 4, 0, '2025-10-09 15:33:39', 'SYS'),
  (2, 2023, 12, 10, 0, '2025-09-26 10:28:32', 'SYS'),
  (2, 2024, 1, 1, 0, '2026-08-06 15:18:50', 'SYS'),
  (2, 2024, 1, 2, 0, '2026-08-06 15:33:25', 'FRA'),
  (2, 2024, 1, 4, 0, '2026-08-06 15:33:26', 'SYS'),
  (2, 2024, 1, 10, 0, '2025-10-15 10:53:22', 'SYS'),
  (2, 2024, 2, 1, 0, '2026-08-06 15:18:51', 'SYS'),
  (2, 2024, 2, 2, 0, '2026-08-06 15:33:30', 'FRA'),
  (2, 2024, 2, 4, 0, '2026-08-06 15:33:32', 'SYS'),
  (2, 2024, 3, 1, 0, '2026-08-06 15:18:53', 'SYS'),
  (2, 2024, 3, 2, 0, '2026-08-06 15:33:36', 'FRA'),
  (2, 2024, 3, 4, 0, '2026-08-06 15:33:37', 'SYS'),
  (2, 2024, 4, 1, 0, '2026-08-06 15:18:53', 'SYS'),
  (2, 2024, 4, 2, 0, '2026-08-06 15:33:42', 'FRA'),
  (2, 2024, 4, 4, 0, '2026-08-06 15:33:43', 'SYS'),
  (2, 2024, 5, 1, 0, '2026-08-06 15:18:54', 'SYS'),
  (2, 2024, 5, 2, 0, '2026-08-06 15:33:50', 'FRA'),
  (2, 2024, 5, 4, 0, '2026-08-06 15:33:51', 'SYS'),
  (2, 2024, 6, 1, 0, '2026-08-06 15:18:55', 'SYS'),
  (2, 2024, 6, 2, 0, '2026-08-06 15:33:55', 'FRA'),
  (2, 2024, 6, 4, 0, '2026-08-06 15:33:56', 'SYS'),
  (2, 2024, 7, 1, 0, '2026-08-06 15:18:56', 'SYS'),
  (2, 2024, 7, 2, 0, '2026-08-06 15:34:01', 'FRA'),
  (2, 2024, 7, 4, 0, '2026-08-06 15:34:03', 'SYS'),
  (2, 2024, 8, 1, 0, '2026-08-06 15:18:57', 'SYS'),
  (2, 2024, 8, 2, 0, '2026-08-06 15:34:05', 'FRA'),
  (2, 2024, 8, 4, 0, '2026-08-06 15:34:06', 'SYS'),
  (2, 2024, 9, 1, 0, '2026-08-06 15:18:58', 'SYS'),
  (2, 2024, 9, 2, 0, '2026-08-06 15:34:09', 'FRA'),
  (2, 2024, 9, 4, 0, '2026-08-06 15:34:10', 'SYS'),
  (2, 2024, 10, 1, 0, '2026-08-06 15:18:59', 'SYS'),
  (2, 2024, 10, 2, 0, '2026-08-06 15:34:13', 'FRA'),
  (2, 2024, 10, 4, 0, '2026-08-06 15:34:14', 'SYS'),
  (2, 2024, 11, 1, 0, '2026-08-06 15:19:00', 'SYS'),
  (2, 2024, 11, 2, 0, '2026-08-06 15:34:16', 'FRA'),
  (2, 2024, 11, 4, 0, '2026-08-06 15:34:17', 'SYS'),
  (2, 2024, 12, 1, 0, '2026-08-06 15:19:01', 'SYS'),
  (2, 2024, 12, 2, 0, '2026-08-06 17:03:45', 'FRA'),
  (2, 2024, 12, 4, 0, '2026-08-06 17:03:47', 'SYS'),
  (2, 2024, 12, 10, 0, '2025-10-13 17:25:27', 'SYS'),
  (2, 2025, 1, 1, 0, '2026-08-06 17:05:10', 'SYS'),
  (2, 2025, 1, 2, 0, '2026-08-06 17:19:23', 'FRA'),
  (2, 2025, 1, 4, 0, '2026-08-06 17:19:24', 'SYS'),
  (2, 2025, 1, 10, 0, '2026-01-15 13:32:28', 'SYS'),
  (2, 2025, 2, 1, 0, '2026-08-06 17:05:06', 'SYS'),
  (2, 2025, 2, 2, 0, '2026-08-06 17:19:32', 'FRA'),
  (2, 2025, 2, 4, 0, '2026-08-06 17:19:34', 'SYS'),
  (2, 2025, 3, 1, 0, '2026-08-06 17:05:09', 'SYS'),
  (2, 2025, 3, 2, 0, '2026-08-06 17:19:37', 'FRA'),
  (2, 2025, 3, 4, 0, '2026-08-06 17:19:39', 'SYS'),
  (2, 2025, 4, 1, 0, '2026-08-06 17:05:11', 'SYS'),
  (2, 2025, 4, 2, 0, '2026-08-06 17:19:42', 'FRA'),
  (2, 2025, 4, 4, 0, '2026-08-06 17:19:43', 'SYS'),
  (2, 2025, 5, 1, 0, '2026-08-06 17:05:15', 'SYS'),
  (2, 2025, 5, 2, 0, '2026-08-06 17:19:45', 'FRA'),
  (2, 2025, 5, 4, 0, '2026-08-06 17:19:46', 'SYS'),
  (2, 2025, 6, 1, 0, '2026-08-06 17:05:18', 'SYS'),
  (2, 2025, 6, 2, 0, '2026-08-06 17:19:49', 'FRA'),
  (2, 2025, 6, 4, 0, '2026-08-06 17:19:50', 'SYS'),
  (2, 2025, 7, 1, 0, '2026-08-06 17:05:21', 'SYS'),
  (2, 2025, 7, 2, 0, '2026-08-06 17:19:52', 'FRA'),
  (2, 2025, 7, 4, 0, '2026-08-06 17:19:54', 'SYS'),
  (2, 2025, 8, 1, 0, '2026-08-06 17:05:23', 'SYS'),
  (2, 2025, 8, 2, 0, '2026-08-06 17:19:56', 'FRA'),
  (2, 2025, 8, 4, 0, '2026-08-06 17:19:58', 'SYS'),
  (2, 2025, 9, 1, 0, '2026-08-06 17:05:25', 'SYS'),
  (2, 2025, 9, 2, 0, '2026-08-06 17:20:01', 'FRA'),
  (2, 2025, 9, 4, 0, '2026-08-06 17:20:02', 'SYS'),
  (2, 2025, 9, 10, 0, '2025-09-26 10:38:08', 'SYS'),
  (2, 2025, 10, 1, 0, '2026-08-06 17:05:28', 'SYS'),
  (2, 2025, 10, 2, 0, '2026-08-06 17:20:04', 'FRA'),
  (2, 2025, 10, 4, 0, '2026-08-06 17:20:06', 'SYS'),
  (2, 2025, 10, 10, 0, '2025-10-15 10:53:12', 'SYS'),
  (2, 2025, 11, 1, 0, '2026-08-06 17:05:30', 'SYS'),
  (2, 2025, 11, 2, 0, '2026-08-06 17:20:08', 'FRA'),
  (2, 2025, 11, 4, 0, '2026-08-06 17:20:10', 'SYS'),
  (2, 2025, 11, 10, 0, '2025-11-07 16:42:42', 'SYS'),
  (2, 2025, 12, 1, 0, '2026-08-06 17:05:33', 'SYS'),
  (2, 2025, 12, 2, 0, '2026-08-06 17:20:30', 'FRA'),
  (2, 2025, 12, 4, 0, '2026-08-06 17:20:32', 'SYS'),
  (2, 2025, 12, 10, 0, '2026-10-13 12:06:51', 'SYS'),
  (2, 2026, 6, 1, 0, '2026-06-25 12:41:28', 'SYS'),
  (2, 2026, 6, 4, 0, '2026-06-25 12:41:29', 'SYS'),
  (2, 2026, 7, 1, 0, '2026-07-31 18:50:04', 'SYS'),
  (2, 2026, 7, 4, 0, '2026-07-31 18:50:04', 'SYS'),
  (2, 2026, 8, 1, 0, '2026-08-06 16:22:59', 'SYS'),
  (2, 2026, 8, 4, 0, '2026-08-06 16:23:00', 'SYS'),
  (2, 2026, 10, 10, 0, '2026-10-13 12:06:08', 'SYS')
) as v (loc, anio, mes, tipo, res, f, usr)
join public.organizaciones g on g.codigo = '3' join public.localidades l on l.organizacion_id = g.id and l.correlativo = v.loc
on conflict (localidad_id, anio, mes, tipo_cierre) do update set resultado_ejercicio = excluded.resultado_ejercicio, fecha = excluded.fecha, usuario = excluded.usuario;

notify pgrst, 'reload schema';
select (select count(*) from public.tipos_cierre) as tipos_cierre, (select count(*) from public.cierres_contables_anteriores) as cierres;
