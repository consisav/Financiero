-- Iniciar sesión con el usuario (código) o con el correo.
--   correo_para_ingresar(usuario): el correo de la cuenta de ese usuario (sin distinguir mayúsculas),
--   solo si está activo; la pantalla de acceso lo usa para iniciar sesión cuando se escribe el código en
--   lugar del correo. Si no existe o no está activo devuelve nulo (la pantalla responde lo mismo que con
--   una clave incorrecta). La clave se sigue validando en Supabase Auth.
-- Se ejecuta después del script 96.
create or replace function public.correo_para_ingresar(p_usuario text) returns text
language sql stable security definer set search_path = '' as $$
  select p.correo from public.perfiles p
  where lower(p.usuario) = lower(trim(p_usuario)) and p.activo
  limit 1;
$$;
revoke execute on function public.correo_para_ingresar(text) from public;
grant execute on function public.correo_para_ingresar(text) to anon, authenticated;

notify pgrst, 'reload schema';
