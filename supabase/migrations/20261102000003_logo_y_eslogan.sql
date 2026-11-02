-- Logo y eslogan (imágenes) de cada organización, guardados en Supabase Storage.
-- Bucket público "organizaciones": cualquiera con el enlace puede ver la imagen (se usa en
-- facturas y reportes); solo administrador o contador pueden subir, reemplazar o quitar.

alter table public.organizaciones
  add column logo_ruta    text,
  add column eslogan_ruta text;

comment on column public.organizaciones.logo_ruta is 'Ruta en el bucket organizaciones, p. ej. 1/logo-1730000000000.png';
comment on column public.organizaciones.eslogan_ruta is 'Ruta en el bucket organizaciones, p. ej. 1/eslogan-1730000000000.png';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('organizaciones', 'organizaciones', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Necesaria para que la API pueda quitar la imagen anterior al reemplazarla.
create policy "organizaciones: ver imagenes" on storage.objects
  for select to authenticated
  using (bucket_id = 'organizaciones' and public.usuario_activo());

create policy "organizaciones: subir imagenes" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'organizaciones' and public.puede_editar_catalogos());

create policy "organizaciones: reemplazar imagenes" on storage.objects
  for update to authenticated
  using (bucket_id = 'organizaciones' and public.puede_editar_catalogos())
  with check (bucket_id = 'organizaciones' and public.puede_editar_catalogos());

create policy "organizaciones: quitar imagenes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'organizaciones' and public.puede_editar_catalogos());

notify pgrst, 'reload schema';
