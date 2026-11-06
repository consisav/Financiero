-- Usuarios de la organización 3, localidad 1 (3-01), replicados a las localidades 3-02 y 3-03.
--   Un usuario es una sola cuenta (un correo y una clave), por eso no se duplica: conserva sus
--   mismas características y datos (código, nombre, rol, estado, fechas del sistema anterior) y
--   recibe las localidades 3-02 y 3-03 como localidades adicionales.
--   Columna nueva localidades_adicionales (lista de localidades de la misma organización) en
--   perfiles y en usuarios_migrados; al crear la cuenta de un usuario por crear, sus localidades
--   adicionales pasan a su perfil.
--   Solo un administrador cambia las localidades adicionales de un usuario.
--   Puede ejecutarse de nuevo: no repite localidades.
-- Se ejecuta después del script 83.

alter table public.perfiles add column if not exists localidades_adicionales bigint[] not null default '{}';
alter table public.usuarios_migrados add column if not exists localidades_adicionales bigint[] not null default '{}';

-- Localidades adicionales: sin repetir, sin la principal, de la misma organización y solo las cambia
-- un administrador.
create or replace function public.validar_localidades_adicionales() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.localidades_adicionales := coalesce((
    select array_agg(distinct x order by x) from unnest(new.localidades_adicionales) x
    where x is distinct from new.localidad_id), '{}');
  if tg_table_name = 'perfiles' and tg_op = 'UPDATE'
     and new.localidades_adicionales is distinct from old.localidades_adicionales
     and (select auth.uid()) is not null and not public.es_admin() then
    raise exception 'Solo un administrador puede cambiar las localidades del usuario';
  end if;
  if exists (select 1 from unnest(new.localidades_adicionales) x
             where not exists (select 1 from public.localidades l where l.id = x and l.organizacion_id = new.organizacion_id)) then
    raise exception 'Las localidades adicionales deben ser de la organización del usuario.';
  end if;
  return new;
end;
$$;
drop trigger if exists perfiles_localidades_adicionales on public.perfiles;
create trigger perfiles_localidades_adicionales before insert or update of localidades_adicionales, localidad_id, organizacion_id
  on public.perfiles for each row execute function public.validar_localidades_adicionales();
drop trigger if exists usuarios_migrados_localidades_adicionales on public.usuarios_migrados;
create trigger usuarios_migrados_localidades_adicionales before insert or update of localidades_adicionales, localidad_id, organizacion_id
  on public.usuarios_migrados for each row execute function public.validar_localidades_adicionales();
revoke execute on function public.validar_localidades_adicionales() from public, anon, authenticated;

-- Crear la cuenta de un usuario por crear: igual que en el script 83, y además pasa sus localidades
-- adicionales al perfil.
create or replace function public.crear_usuario_migrado(p_migrado bigint, p_correo text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  m public.usuarios_migrados;
  v_correo text := lower(trim(p_correo));
  v_id uuid;
  v_clave text;
  v_usuario text;
begin
  if not public.es_admin() then raise exception 'Solo un administrador puede crear usuarios.'; end if;
  select * into m from public.usuarios_migrados where id = p_migrado;
  if m.id is null then raise exception 'El usuario por crear no existe.'; end if;
  if m.perfil_id is not null then raise exception 'El usuario % ya tiene su cuenta.', m.nombre; end if;
  if v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Escribe un correo válido.'; end if;

  select id into v_id from auth.users where lower(email) = v_correo;
  -- Una cuenta que ya existe solo se liga si aún no tiene empresa (se registró sola y espera asignación).
  if v_id is not null and exists (select 1 from public.perfiles where id = v_id and localidad_id is not null) then
    raise exception 'Ya existe un usuario con el correo %: usa otro correo.', v_correo;
  end if;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_correo,
            extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf', 10)), now(),
            '{"provider": "email", "providers": ["email"]}', jsonb_build_object('nombre', m.nombre), now(), now(),
            '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', v_correo, 'email_verified', true),
            'email', now(), now(), now());
    v_clave := public.generar_clave(v_id);
  end if;
  if not exists (select 1 from public.perfiles where id = v_id) then raise exception 'No se creó el perfil del usuario.'; end if;

  v_usuario := case when m.usuario_anterior ~ '^[A-Za-z0-9]{2,20}$'
                     and not exists (select 1 from public.perfiles where lower(usuario) = lower(m.usuario_anterior) and id <> v_id)
                    then m.usuario_anterior end;
  update public.perfiles set
    nombre = case when coalesce(nombre, '') = '' then m.nombre else nombre end,
    usuario = coalesce(usuario, v_usuario),
    organizacion_id = m.organizacion_id, localidad_id = m.localidad_id, activo = m.activo,
    localidades_adicionales = m.localidades_adicionales,
    usuario_anterior = m.usuario_anterior, fecha_creacion_anterior = m.fecha_creacion_anterior,
    fecha_clave_anterior = m.fecha_clave_anterior
  where id = v_id;
  update public.usuarios_migrados set perfil_id = v_id where id = m.id;
  return v_clave;
end;
$$;
revoke execute on function public.crear_usuario_migrado(bigint, text) from public, anon;
grant execute on function public.crear_usuario_migrado(bigint, text) to authenticated;

do $migra$
declare
  v_org bigint;
  v_origen bigint;
  v_destinos bigint[];
  v_pend integer;
  v_cuentas integer;
begin
  select id into v_org from public.organizaciones where codigo = 3;
  if v_org is null then raise exception 'No existe la organización 3.'; end if;
  select id into v_origen from public.localidades where organizacion_id = v_org and correlativo = 1;
  select array_agg(id order by correlativo) into v_destinos from public.localidades where organizacion_id = v_org and correlativo in (2, 3);
  if v_origen is null or v_destinos is null then raise exception 'Faltan las localidades 3-01, 3-02 o 3-03.'; end if;

  -- Usuarios del archivo migrado de 3-01 (por crear o ya ligados a su cuenta).
  update public.usuarios_migrados set localidades_adicionales = localidades_adicionales || v_destinos
  where organizacion_id = v_org and localidad_id = v_origen and not (localidades_adicionales @> v_destinos);
  get diagnostics v_pend = row_count;
  -- Usuarios con cuenta de 3-01.
  update public.perfiles set localidades_adicionales = localidades_adicionales || v_destinos
  where organizacion_id = v_org and localidad_id = v_origen and not (localidades_adicionales @> v_destinos);
  get diagnostics v_cuentas = row_count;

  raise notice '%', format('Usuarios de 3-01 replicados a 3-02 y 3-03: %s con cuenta y %s del archivo migrado (ya estaban replicados: %s).',
    v_cuentas, v_pend,
    (select count(*) from public.usuarios_migrados where organizacion_id = v_org and localidad_id = v_origen and localidades_adicionales @> v_destinos) +
    (select count(*) from public.perfiles where organizacion_id = v_org and localidad_id = v_origen and localidades_adicionales @> v_destinos)
    - v_pend - v_cuentas);
end;
$migra$;

notify pgrst, 'reload schema';
