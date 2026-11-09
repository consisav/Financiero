-- 171 · Reportes gerenciales: qué reportes de un módulo genera cada usuario, en qué salidas (PDF, Excel, voz,
--   WhatsApp, correo) y cuándo (manual o automático con su frecuencia).
--   Una configuración por localidad (empresa), módulo y usuario. El usuario es quien tiene acceso al módulo en
--   esa empresa y para quien se generan: en automático, la sesión de ese usuario los genera al llegar la hora.
--   reportes:   { "<id del reporte>": { "pdf": true, "excel": false, "voz": true, "whatsapp": false, "correo": true } }
--   parametros: { "periodo": "MES", "contenido": "RESUMIDO", "graficas": true }
--   frecuencia: CADA_HORA | DIARIA | SEMANAL | QUINCENAL | MENSUAL; hora (hh:mi), dia_semana (1 = lunes … 7),
--   dia_mes (1-31; si el mes es más corto, su último día). proxima_ejecucion la calcula la aplicación.
-- Se ejecuta después del script 99.

create table if not exists public.reportes_gerenciales (
  id bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones(id) on delete cascade,
  localidad_id bigint not null references public.localidades(id) on delete cascade,
  modulo text not null,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  reportes jsonb not null default '{}',
  parametros jsonb not null default '{}',
  whatsapp text,
  correos text,
  modo text not null default 'MANUAL' check (modo in ('MANUAL', 'AUTOMATICO')),
  frecuencia text not null default 'DIARIA' check (frecuencia in ('CADA_HORA', 'DIARIA', 'SEMANAL', 'QUINCENAL', 'MENSUAL')),
  hora time not null default '07:00',
  dia_semana smallint not null default 1 check (dia_semana between 1 and 7),
  dia_mes smallint not null default 1 check (dia_mes between 1 and 31),
  activo boolean not null default true,
  ultima_ejecucion timestamptz,
  proxima_ejecucion timestamptz,
  creado_en timestamptz not null default now(),
  modificado_en timestamptz,
  modificado_por text,
  unique (localidad_id, modulo, perfil_id)
);
create index if not exists reportes_gerenciales_prox on public.reportes_gerenciales (perfil_id, proxima_ejecucion) where modo = 'AUTOMATICO' and activo;

alter table public.reportes_gerenciales enable row level security;
drop policy if exists "reportes_gerenciales: leer" on public.reportes_gerenciales;
drop policy if exists "reportes_gerenciales: escribir" on public.reportes_gerenciales;
-- Los administradores ven y definen las de todos; cada usuario, las suyas.
create policy "reportes_gerenciales: leer" on public.reportes_gerenciales for select to authenticated
  using (public.usuario_activo() and (perfil_id = (select auth.uid()) or public.puede_editar_catalogos()));
create policy "reportes_gerenciales: escribir" on public.reportes_gerenciales for all to authenticated
  using (public.usuario_activo() and (perfil_id = (select auth.uid()) or public.puede_editar_catalogos()))
  with check (public.usuario_activo() and (perfil_id = (select auth.uid()) or public.puede_editar_catalogos()));
grant select, insert, update, delete on public.reportes_gerenciales to authenticated;
