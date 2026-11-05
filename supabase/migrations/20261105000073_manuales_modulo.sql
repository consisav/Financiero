-- Ayuda · Manual del módulo: el manual generado con IA (Edge Function «manual-modulo», Claude) de cada
-- módulo, como presentación en JSON; mientras no exista se muestra el manual automático.
-- Leer: usuarios activos. Escribir: administrador. Se ejecuta después del script 72.
create table if not exists public.manuales_modulo (
  modulo       text primary key,
  contenido    jsonb not null,
  modelo       text,
  generado_por text,
  generado_en  timestamptz not null default now()
);
create or replace function public.preparar_manual_modulo() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.generado_en := now();
  return new;
end;
$$;
drop trigger if exists manuales_modulo_preparar on public.manuales_modulo;
create trigger manuales_modulo_preparar before insert or update on public.manuales_modulo for each row execute function public.preparar_manual_modulo();

alter table public.manuales_modulo enable row level security;
drop policy if exists "manuales_modulo: leer" on public.manuales_modulo;
drop policy if exists "manuales_modulo: crear" on public.manuales_modulo;
drop policy if exists "manuales_modulo: modificar" on public.manuales_modulo;
create policy "manuales_modulo: leer" on public.manuales_modulo for select to authenticated using (public.usuario_activo());
create policy "manuales_modulo: crear" on public.manuales_modulo for insert to authenticated with check (public.puede_editar_catalogos());
create policy "manuales_modulo: modificar" on public.manuales_modulo for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());
grant select, insert, update on public.manuales_modulo to authenticated;
revoke execute on function public.preparar_manual_modulo() from public, anon, authenticated;

notify pgrst, 'reload schema';
