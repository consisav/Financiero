-- Generar usuario y clave:
--   * El código de usuario sigue la regla "iniciales de los nombres + primer apellido completo"
--     (Oliver Asturias → Oasturias, Juan Carlos Tut → JCtut): letras y números, 2 a 20, único
--     sin distinguir mayúsculas.
--   * generar_clave(id): el administrador genera una clave nueva para un usuario. Se devuelve una
--     sola vez (no se guarda legible) y vence hoy, para que el usuario la cambie al entrar.
--   * renovar_vencimiento_clave(): tras cambiar su clave, el usuario renueva su vencimiento (90 días).

alter table public.perfiles drop constraint if exists perfiles_usuario_check;
alter table public.perfiles drop constraint if exists perfiles_usuario_key;
alter table public.perfiles add constraint perfiles_usuario_check check (usuario ~ '^[A-Za-z0-9]{2,20}$');
create unique index perfiles_usuario_unico on public.perfiles (lower(usuario));

-- El trigger permite el cambio de vencimiento solo cuando viene de renovar_vencimiento_clave().
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  renovando boolean := coalesce(current_setting('fin.renovando_clave', true), '') = 'si';
begin
  if (select auth.uid()) is not null and not public.es_admin() and (
       new.rol_id is distinct from old.rol_id or new.activo is distinct from old.activo
    or new.organizacion_id is distinct from old.organizacion_id or new.localidad_id is distinct from old.localidad_id
    or new.usuario is distinct from old.usuario
    or (new.fecha_vence_clave is distinct from old.fecha_vence_clave and not renovando)
    or new.firma_ruta is distinct from old.firma_ruta or new.correo is distinct from old.correo) then
    raise exception 'Solo un administrador puede cambiar estos datos del usuario';
  end if;
  return new;
end;
$$;

create function public.generar_clave(p_usuario uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  -- Sin caracteres que se confunden (0/O, 1/l/I).
  letras constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  numeros constant text := '23456789';
  simbolos constant text := '#$%&*+-=?@';
  todos constant text := letras || numeros || simbolos;
  bytes bytea := extensions.gen_random_bytes(12);
  clave text := '';
  i integer;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede generar claves';
  end if;
  if not exists (select 1 from auth.users where id = p_usuario) then
    raise exception 'El usuario no existe';
  end if;
  -- Garantiza al menos una mayúscula, una minúscula, un número y un símbolo.
  clave := substr(letras, 1 + get_byte(bytes, 0) % 24, 1)
        || substr(letras, 25 + get_byte(bytes, 1) % 25, 1)
        || substr(numeros, 1 + get_byte(bytes, 2) % length(numeros), 1)
        || substr(simbolos, 1 + get_byte(bytes, 3) % length(simbolos), 1);
  for i in 4..11 loop
    clave := clave || substr(todos, 1 + get_byte(bytes, i) % length(todos), 1);
  end loop;

  update auth.users
  set encrypted_password = extensions.crypt(clave, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where id = p_usuario;

  update public.perfiles set fecha_vence_clave = current_date where id = p_usuario;
  return clave;
end;
$$;

create function public.renovar_vencimiento_clave() returns date
language plpgsql volatile security definer set search_path = '' as $$
declare
  nueva date := current_date + 90;
begin
  perform set_config('fin.renovando_clave', 'si', true);
  update public.perfiles set fecha_vence_clave = nueva where id = (select auth.uid());
  perform set_config('fin.renovando_clave', '', true);
  return nueva;
end;
$$;

revoke execute on function public.generar_clave(uuid) from public, anon;
grant execute on function public.generar_clave(uuid) to authenticated;
revoke execute on function public.renovar_vencimiento_clave() from public, anon;
grant execute on function public.renovar_vencimiento_clave() to authenticated;

notify pgrst, 'reload schema';
