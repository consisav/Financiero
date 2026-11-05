-- Usuarios de la organización 3 (Futura Farma - Mavisa), del archivo «2. GEN_USUARIOS_GENERALES.xls»
-- (13 usuarios de la localidad 1).
--   Cada usuario del sistema es una cuenta de acceso (correo y clave) y el archivo no trae correos,
--   por eso los usuarios se cargan como «por crear» en public.usuarios_migrados: en Administración ·
--   Usuarios el administrador escribe el correo de cada uno y pulsa «Crear»; la cuenta se crea con
--   el correo confirmado, una clave generada (se muestra una sola vez y vence hoy, para que el
--   usuario la cambie al entrar) y los datos del archivo.
--   1. Un usuario que ya existe (mismo nombre, sin distinguir mayúsculas) NO se crea: se actualizan
--      sus datos del sistema anterior (no cambian su rol, organización ni localidad). Un usuario «por
--      crear» que ya estaba cargado se actualiza.
--   2. Columnas nuevas de perfiles (vienen en el archivo y no estaban en la base de datos):
--      usuario_anterior (USUARIO), fecha_creacion_anterior (FECHA_CREACION) y fecha_clave_anterior
--      (FECHA_CLAVE). ESTADO A/I = activo/inactivo.
--   La columna CLAVE NO se migra: son claves legibles del sistema anterior y no se guardan; cada
--   usuario recibe una clave nueva generada.
--   Puede ejecutarse de nuevo: la segunda vez solo actualiza.
-- Se ejecuta después del script 82.

alter table public.perfiles add column if not exists usuario_anterior text;
alter table public.perfiles add column if not exists fecha_creacion_anterior date;
alter table public.perfiles add column if not exists fecha_clave_anterior date;

create table if not exists public.usuarios_migrados (
  id                      bigint generated always as identity primary key,
  organizacion_id         bigint not null references public.organizaciones (id),
  localidad_id            bigint not null,
  usuario_anterior        text not null,
  nombre                  text not null,
  activo                  boolean not null default true,
  fecha_creacion_anterior date,
  fecha_clave_anterior    date,
  perfil_id               uuid references public.perfiles (id) on delete set null,
  creado_en               timestamptz not null default now(),
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id)
);
create unique index if not exists usuarios_migrados_nombre_uk on public.usuarios_migrados (organizacion_id, upper(nombre));

alter table public.usuarios_migrados enable row level security;
drop policy if exists "usuarios_migrados: administrador" on public.usuarios_migrados;
create policy "usuarios_migrados: administrador" on public.usuarios_migrados for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Crea la cuenta de un usuario «por crear» con el correo indicado y devuelve su clave (una sola vez).
-- Si ya existe una cuenta con ese correo, solo se le ligan los datos del usuario migrado.
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
    -- El perfil lo crea el trigger de auth.users; la clave se genera aparte (vence hoy).
    v_clave := public.generar_clave(v_id);
  end if;
  if not exists (select 1 from public.perfiles where id = v_id) then raise exception 'No se creó el perfil del usuario.'; end if;

  -- Código: el del sistema anterior si está libre y cumple la regla.
  v_usuario := case when m.usuario_anterior ~ '^[A-Za-z0-9]{2,20}$'
                     and not exists (select 1 from public.perfiles where lower(usuario) = lower(m.usuario_anterior) and id <> v_id)
                    then m.usuario_anterior end;
  update public.perfiles set
    nombre = case when coalesce(nombre, '') = '' then m.nombre else nombre end,
    usuario = coalesce(usuario, v_usuario),
    organizacion_id = m.organizacion_id, localidad_id = m.localidad_id, activo = m.activo,
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
  v_loc bigint;
  v_perfil uuid;
  r record;
  v_por_crear integer := 0;
  v_existentes integer := 0;
  v_omitidas text := '';
begin
  select id into v_org from public.organizaciones where codigo = 3;
  if v_org is null then raise exception 'No existe la organización 3.'; end if;

  for r in
    select localidad::integer as localidad, usuario::text as usuario, nombre::text as nombre,
           fecha_creacion::integer as fecha_creacion, fecha_clave::integer as fecha_clave, estado::text as estado
    from (values
      (1, 'OLI', 'OLIVER ASTURIAS', 39026, 46427, 'A'),
      (1, 'JCC', 'JUAN CARLOS CAAL', 43866, 46022, 'A'),
      (1, 'FRA', 'FRANKI LIMA', 44350, 46317, 'A'),
      (1, 'AEV', 'ANA ELISA VILLATORO', 44452, 47549, 'A'),
      (1, 'KER', 'KARLA ESMERALDA RIOS GALICIA', 44452, 46314, 'A'),
      (1, 'OLM', 'OSCAR MARTINEZ', 44452, 47535, 'A'),
      (1, 'AJA', 'MARIA DEL CARMEN', 45887, 46321, 'A'),
      (1, 'LMI', 'CONTADOR GENERAL', 45819, 46225, 'A'),
      (1, 'KEG', 'KARLA RIOS GALICIA (EMPRESA 3)', 46167, 46265, 'A'),
      (1, 'VE1', 'JONATHAN VASQUEZ', 46238, 46307, 'A'),
      (1, 'VE2', 'PILAR CASTILLO', 46238, 46307, 'A'),
      (1, 'AVC', 'ANA VICTORIA  COLOMA', 45259, 46317, 'A'),
      (1, 'BOD', 'BODEGA', 45937, 46325, 'A')
    ) as x (localidad, usuario, nombre, fecha_creacion, fecha_clave, estado)
    order by localidad, usuario
  loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.localidad;
    if v_loc is null then
      if position(format('3-%s', lpad(r.localidad::text, 2, '0')) in v_omitidas) = 0 then v_omitidas := v_omitidas || format(' 3-%s', lpad(r.localidad::text, 2, '0')); end if;
      continue;
    end if;
    -- Usuario que ya existe (por nombre): se actualizan sus datos del sistema anterior.
    select id into v_perfil from public.perfiles
    where upper(regexp_replace(trim(nombre), '\s+', ' ', 'g')) = upper(regexp_replace(trim(r.nombre), '\s+', ' ', 'g'))
    order by creado_en limit 1;
    if v_perfil is not null then
      update public.perfiles set usuario_anterior = r.usuario,
        fecha_creacion_anterior = date '1899-12-30' + r.fecha_creacion,
        fecha_clave_anterior = date '1899-12-30' + r.fecha_clave
      where id = v_perfil;
      v_existentes := v_existentes + 1;
    end if;
    insert into public.usuarios_migrados (organizacion_id, localidad_id, usuario_anterior, nombre, activo,
           fecha_creacion_anterior, fecha_clave_anterior, perfil_id)
    values (v_org, v_loc, r.usuario, regexp_replace(trim(r.nombre), '\s+', ' ', 'g'), coalesce(r.estado, 'A') <> 'I',
            date '1899-12-30' + r.fecha_creacion, date '1899-12-30' + r.fecha_clave, v_perfil)
    on conflict (organizacion_id, upper(nombre)) do update set
      localidad_id = excluded.localidad_id, usuario_anterior = excluded.usuario_anterior, activo = excluded.activo,
      fecha_creacion_anterior = excluded.fecha_creacion_anterior, fecha_clave_anterior = excluded.fecha_clave_anterior,
      perfil_id = coalesce(public.usuarios_migrados.perfil_id, excluded.perfil_id);
    if v_perfil is null then v_por_crear := v_por_crear + 1; end if;
  end loop;

  raise notice '%', format('Usuarios de la organización 3: %s ya existían (actualizados), %s por crear (escribe su correo en Administración · Usuarios).%s',
    v_existentes,
    (select count(*) from public.usuarios_migrados where organizacion_id = v_org and perfil_id is null),
    case when v_omitidas <> '' then ' Localidades que no existen (omitidas):' || v_omitidas else '' end);
end;
$migra$;

notify pgrst, 'reload schema';
