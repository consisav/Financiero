-- Logo y eslogan (imágenes) de cada localidad, como los de la organización (script 3). Se guardan en el mismo
-- bucket público "organizaciones" de Supabase Storage, en la carpeta de su organización:
-- <organización>/localidad-<id>/logo-<fecha>.png. La barra superior muestra el logo y el eslogan de la
-- localidad con que el usuario está conectado; si la localidad no tiene, los de su organización.
-- Puede ejecutarse de nuevo. Se ejecuta después del script 113.
alter table public.localidades add column if not exists logo_ruta text;
alter table public.localidades add column if not exists eslogan_ruta text;
comment on column public.localidades.logo_ruta is 'Ruta en el bucket organizaciones, p. ej. 3/localidad-7/logo-1730000000000.png. Sin logo se usa el de la organización.';
comment on column public.localidades.eslogan_ruta is 'Ruta en el bucket organizaciones, p. ej. 3/localidad-7/eslogan-1730000000000.png. Sin eslogan se usa el de la organización.';

notify pgrst, 'reload schema';
