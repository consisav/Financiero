-- Clave personalizada: el Super Administrador escribe la clave de un usuario (en lugar de generarla).
--   asignar_clave(usuario, clave, cambiar_al_entrar): solo el Super Administrador; la clave debe tener
--   al menos 8 caracteres con letras y números. Si cambiar_al_entrar, vence hoy (el usuario crea una
--   propia al entrar); si no, vence en 90 días como cualquier clave nueva.
--   Cada usuario cambia su propia clave desde «Cambiar mi clave» (Supabase Auth); no usa esta función.
-- Se ejecuta después del script 97.
create or replace function public.asignar_clave(p_usuario uuid, p_clave text, p_cambiar boolean default true) returns date
language plpgsql volatile security definer set search_path = '' as $$
declare v_vence date := case when p_cambiar then current_date else current_date + 90 end;
begin
  if not public.es_superadmin() then raise exception 'Solo el Super Administrador puede asignar una clave personalizada.'; end if;
  if not exists (select 1 from auth.users where id = p_usuario) then raise exception 'El usuario no existe.'; end if;
  if p_clave is null or length(p_clave) < 8 then raise exception 'La clave debe tener al menos 8 caracteres.'; end if;
  if length(p_clave) > 72 then raise exception 'La clave puede tener como máximo 72 caracteres.'; end if;
  if p_clave !~ '[A-Za-zÁÉÍÓÚÑáéíóúñ]' or p_clave !~ '[0-9]' then raise exception 'La clave debe tener letras y números.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_clave, extensions.gen_salt('bf', 10)), updated_at = now() where id = p_usuario;
  update public.perfiles set fecha_vence_clave = v_vence where id = p_usuario;
  return v_vence;
end;
$$;
revoke execute on function public.asignar_clave(uuid, text, boolean) from public, anon;
grant execute on function public.asignar_clave(uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';
