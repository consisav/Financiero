-- Roles: Super Administrador, Administrador y Cliente.
--   * Solo el Super Administrador cambia el rol de un usuario y modifica a otro Super Administrador.
--   * Super Administrador y Administrador gestionan usuarios, claves y catálogos.
--   * Cliente: solo lectura en todos los módulos.
-- Los roles anteriores (Contador, Facturador, Consulta) quedan inactivos y sus usuarios pasan a Cliente.
-- El administrador más antiguo (el primer usuario del sistema) pasa a Super Administrador.

alter table public.roles
  add column activo boolean not null default true,
  add column orden  integer not null default 99;

insert into public.roles (id, nombre, descripcion, orden) values
  ('superadministrador', 'Super Administrador', 'Acceso total; único que asigna roles', 1),
  ('cliente',            'Cliente',             'Solo lectura', 3)
on conflict (id) do update set nombre = excluded.nombre, descripcion = excluded.descripcion, orden = excluded.orden, activo = true;

update public.roles set orden = 2, descripcion = 'Gestión de usuarios, claves y catálogos' where id = 'administrador';
update public.roles set activo = false where id in ('contador', 'facturador', 'consulta');

insert into public.rol_modulos (rol_id, modulo, puede_ver, puede_editar)
select r.rol, m.modulo, true, r.rol = 'superadministrador'
from (values ('superadministrador'), ('cliente')) as r (rol)
cross join (values ('contabilidad'), ('facturacion'), ('inventarios'), ('sat'), ('nominas'), ('comercio')) as m (modulo)
on conflict (rol_id, modulo) do nothing;

-- ---------- Funciones de permisos ----------
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and activo and rol_id in ('superadministrador', 'administrador')
  );
$$;

create function public.es_superadmin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and activo and rol_id = 'superadministrador'
  );
$$;

create or replace function public.puede_editar_catalogos() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and activo and rol_id in ('superadministrador', 'administrador')
  );
$$;

-- Usuarios nuevos: el primero es Super Administrador; los demás, Cliente inactivo.
alter table public.perfiles alter column rol_id set default 'cliente';

create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  primero boolean := not exists (select 1 from public.perfiles);
begin
  insert into public.perfiles (id, nombre, correo, rol_id, activo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    new.email,
    case when primero then 'superadministrador' else 'cliente' end,
    primero
  );
  return new;
end;
$$;

-- ---------- Protección de los datos del usuario ----------
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  renovando boolean := coalesce(current_setting('fin.renovando_clave', true), '') = 'si';
begin
  -- Sin usuario de la app (SQL Editor de Supabase) no se restringe.
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.rol_id is distinct from old.rol_id and not public.es_superadmin() then
    raise exception 'Solo el Super Administrador puede cambiar el rol de un usuario';
  end if;
  if old.rol_id = 'superadministrador' and old.id <> (select auth.uid()) and not public.es_superadmin() then
    raise exception 'Solo el Super Administrador puede modificar a otro Super Administrador';
  end if;
  if not public.es_admin() and (
       new.activo is distinct from old.activo
    or new.organizacion_id is distinct from old.organizacion_id or new.localidad_id is distinct from old.localidad_id
    or new.usuario is distinct from old.usuario
    or (new.fecha_vence_clave is distinct from old.fecha_vence_clave and not renovando)
    or new.firma_ruta is distinct from old.firma_ruta or new.correo is distinct from old.correo) then
    raise exception 'Solo un administrador puede cambiar estos datos del usuario';
  end if;
  return new;
end;
$$;

-- Un administrador no puede cambiar la clave de un Super Administrador.
create or replace function public.generar_clave(p_usuario uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
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
  if exists (select 1 from public.perfiles where id = p_usuario and rol_id = 'superadministrador')
     and not public.es_superadmin() then
    raise exception 'Solo el Super Administrador puede generar la clave de un Super Administrador';
  end if;
  clave := substr(letras, 1 + get_byte(bytes, 0) % 24, 1)
        || substr(letras, 25 + get_byte(bytes, 1) % 25, 1)
        || substr(numeros, 1 + get_byte(bytes, 2) % length(numeros), 1)
        || substr(simbolos, 1 + get_byte(bytes, 3) % length(simbolos), 1);
  for i in 4..11 loop
    clave := clave || substr(todos, 1 + get_byte(bytes, i) % length(todos), 1);
  end loop;
  update auth.users
  set encrypted_password = extensions.crypt(clave, extensions.gen_salt('bf', 10)), updated_at = now()
  where id = p_usuario;
  update public.perfiles set fecha_vence_clave = current_date where id = p_usuario;
  return clave;
end;
$$;

revoke execute on function public.es_superadmin() from public, anon;
grant execute on function public.es_superadmin() to authenticated;

-- ---------- Usuarios existentes ----------
update public.perfiles set rol_id = 'cliente' where rol_id in ('contador', 'facturador', 'consulta');

update public.perfiles set rol_id = 'superadministrador'
where id = (
  select id from public.perfiles
  where rol_id = 'administrador' and activo
  order by creado_en
  limit 1)
and not exists (select 1 from public.perfiles where rol_id = 'superadministrador');

notify pgrst, 'reload schema';
