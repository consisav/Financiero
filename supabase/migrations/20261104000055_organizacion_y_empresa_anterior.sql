-- Administración · Organizaciones y localidades: el código de la organización y de la empresa
-- (localidad) en el sistema anterior, para la migración de datos. No se repiten: cada código
-- anterior corresponde a una sola organización y, dentro de ella, a una sola empresa.
-- Se ejecuta después del script 54.

alter table public.organizaciones add column if not exists organizacion_anterior text;
alter table public.localidades add column if not exists empresa_anterior text;

create unique index if not exists organizaciones_anterior_key on public.organizaciones (upper(organizacion_anterior))
  where organizacion_anterior is not null;
create unique index if not exists localidades_anterior_key on public.localidades (organizacion_id, upper(empresa_anterior))
  where empresa_anterior is not null;

notify pgrst, 'reload schema';
