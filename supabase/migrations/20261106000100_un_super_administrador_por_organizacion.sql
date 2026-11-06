-- Un solo Super Administrador por organización (además del Super Administrador Global, que no cuenta).
--   * Regla (trigger en perfiles): no se puede tener un segundo Super Administrador activo en la misma
--     organización; el mensaje indica quién lo es.
--   * Organización 3: su Super Administrador es OSCAR MARTINEZ (usuario OLM). Si otro usuario era
--     Super Administrador de esa organización, pasa a Administrador. Si Oscar aún no tiene cuenta
--     (está en «Usuarios por crear»), queda marcado y al crearlo será Super Administrador
--     (solo el Super Administrador Global puede crearlo).
--   * En otras organizaciones con más de uno, se listan para resolverlos (no se cambian).
-- Se ejecuta después del script 99.

alter table public.usuarios_migrados add column if not exists rol_id text references public.roles (id);

-- Regla: un Super Administrador activo por organización.
create or replace function public.un_super_por_organizacion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_otro text;
begin
  if new.rol_id = 'superadministrador' and new.activo and not new.es_global and new.organizacion_id is not null then
    select coalesce(nullif(trim(nombre), ''), usuario, correo) into v_otro from public.perfiles
    where organizacion_id = new.organizacion_id and rol_id = 'superadministrador' and activo and not es_global and id <> new.id
    limit 1;
    if v_otro is not null then
      raise exception 'La organización ya tiene Super Administrador: %. Solo puede existir uno por organización.', v_otro;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists perfiles_un_super_por_organizacion on public.perfiles;
create trigger perfiles_un_super_por_organizacion
  before insert or update of rol_id, organizacion_id, activo, es_global on public.perfiles
  for each row execute function public.un_super_por_organizacion();

-- Organización 3: OSCAR MARTINEZ.
do $migra$
declare
  v_org bigint;
  v_oscar uuid;
  r record;
begin
  select id into v_org from public.organizaciones where codigo = '3';
  if v_org is null then raise notice 'No existe la organización 3.'; return; end if;
  select id into v_oscar from public.perfiles
  where organizacion_id = v_org and (upper(usuario) = 'OLM' or upper(regexp_replace(trim(nombre), '\s+', ' ', 'g')) = 'OSCAR MARTINEZ')
  order by (upper(usuario) = 'OLM') desc nulls last limit 1;
  if v_oscar is not null then
    for r in select id, nombre from public.perfiles
             where organizacion_id = v_org and rol_id = 'superadministrador' and not es_global and id <> v_oscar loop
      update public.perfiles set rol_id = 'administrador' where id = r.id;
      raise notice '%', format('%s deja de ser Super Administrador de la organización 3 (ahora Administrador).', r.nombre);
    end loop;
    update public.perfiles set rol_id = 'superadministrador', activo = true where id = v_oscar and rol_id is distinct from 'superadministrador';
    raise notice 'OSCAR MARTINEZ es el Super Administrador de la organización 3.';
  else
    update public.usuarios_migrados set rol_id = 'superadministrador'
    where organizacion_id = v_org and perfil_id is null
      and (upper(usuario_anterior) = 'OLM' or upper(regexp_replace(trim(nombre), '\s+', ' ', 'g')) = 'OSCAR MARTINEZ');
    if found then
      raise notice 'OSCAR MARTINEZ aún no tiene cuenta: al crearlo en «Usuarios por crear» será el Super Administrador de la organización 3.';
    else
      raise notice 'No se encontró a OSCAR MARTINEZ en la organización 3.';
    end if;
  end if;
  -- Otras organizaciones con más de un Super Administrador: se listan.
  for r in select o.codigo, o.nombre, string_agg(coalesce(p.nombre, p.usuario), ', ') as quienes
           from public.perfiles p join public.organizaciones o on o.id = p.organizacion_id
           where p.rol_id = 'superadministrador' and p.activo and not p.es_global
           group by o.codigo, o.nombre having count(*) > 1 loop
    raise notice '%', format('Organización %s (%s) tiene más de un Super Administrador: %s. Deja solo uno.', r.codigo, r.nombre, r.quienes);
  end loop;
end;
$migra$;

-- Crear un usuario migrado (script 83): aplica el rol marcado (Super Administrador de la organización).
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
  if m.rol_id = 'superadministrador' and not public.es_superadmin_global() then
    raise exception '% será el Super Administrador de su organización: solo el Super Administrador Global puede crearlo.', m.nombre;
  end if;
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
  if m.rol_id is not null then
    update public.perfiles set rol_id = m.rol_id where id = v_id;
  end if;
  update public.usuarios_migrados set perfil_id = v_id where id = m.id;
  return v_clave;
end;
$$;

notify pgrst, 'reload schema';
