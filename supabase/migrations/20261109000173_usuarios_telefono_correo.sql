-- 173 · Usuarios: teléfono (WhatsApp) y correo para reportes.
--   telefono:        número del usuario (8 dígitos de Guatemala o con su código de país).
--   correo_reportes: correo donde recibe los reportes; si está vacío se usa el correo con el que entra al sistema.
--   Los Reportes gerenciales los toman por omisión como destinos (WhatsApp y correo) de los usuarios marcados.
-- Se ejecuta después del script 172.

alter table public.perfiles add column if not exists telefono text;
alter table public.perfiles add column if not exists correo_reportes text;
alter table public.perfiles drop constraint if exists perfiles_correo_reportes_check;
alter table public.perfiles add constraint perfiles_correo_reportes_check
  check (correo_reportes is null or correo_reportes = '' or correo_reportes ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
