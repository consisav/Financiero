-- Bancos · Imagen del comprobante de cada depósito o nota (boleta escaneada, foto o PDF).
--   movimientos_bancarios: ruta, nombre y tipo del archivo.
--   Bucket privado «bancos» (10 MB, imágenes y PDF). La ruta es <localidad>/<movimiento>/<archivo>;
--   la ven los usuarios activos y la suben o quitan quienes pueden editar.
-- Se ejecuta después del script 44.

alter table public.movimientos_bancarios add column if not exists comprobante_ruta text;
alter table public.movimientos_bancarios add column if not exists comprobante_nombre text;
alter table public.movimientos_bancarios add column if not exists comprobante_tipo text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bancos', 'bancos', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "bancos: ver comprobantes" on storage.objects;
drop policy if exists "bancos: subir comprobantes" on storage.objects;
drop policy if exists "bancos: quitar comprobantes" on storage.objects;
create policy "bancos: ver comprobantes" on storage.objects
  for select to authenticated
  using (bucket_id = 'bancos' and public.usuario_activo());
create policy "bancos: subir comprobantes" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bancos' and public.puede_editar_catalogos());
create policy "bancos: quitar comprobantes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'bancos' and public.puede_editar_catalogos());

notify pgrst, 'reload schema';
