-- Scripts 96 a 100 juntos, en orden (se pueden ejecutar de nuevo sin dañar datos).

-- ===== 20261106000096_usuarios_rol_por_empresa.sql =====
-- Usuarios: un usuario por organización con un rol en cada empresa (localidad) y una empresa activa.
--   perfil_empresas: las empresas de la organización a las que entra el usuario y su rol en cada una.
--   perfiles.localidad_id y perfiles.rol_id pasan a ser la empresa ACTIVA y el rol en ella (así los
--   permisos de siempre, es_admin(), rol_modulos… aplican el rol de la empresa en que se trabaja);
--   perfiles.localidad_principal_id es la empresa en que abre por defecto.
--   cambiar_empresa_activa(localidad): el usuario cambia de empresa (entre las suyas) y toma su rol.
--   El Super Administrador es Super Administrador en todas las empresas y puede activar cualquiera.
--   Solo el Super Administrador cambia roles; un administrador da o quita acceso a empresas (con el
--   rol que el usuario ya tiene).
--   Se llena con lo que hay: la empresa de cada usuario y sus localidades adicionales (script 84), con
--   su rol actual.
-- Se ejecuta después del script 95.

alter table public.perfiles add column if not exists localidad_principal_id bigint references public.localidades (id);

create table if not exists public.perfil_empresas (
  id               bigint generated always as identity primary key,
  perfil_id        uuid not null references public.perfiles (id) on delete cascade,
  organizacion_id  bigint not null references public.organizaciones (id),
  localidad_id     bigint not null,
  rol_id           text not null references public.roles (id),
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  unique (perfil_id, localidad_id),
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id) on delete cascade
);
create index if not exists perfil_empresas_localidad_idx on public.perfil_empresas (localidad_id);

alter table public.perfil_empresas enable row level security;
drop policy if exists "perfil_empresas: leer" on public.perfil_empresas;
create policy "perfil_empresas: leer" on public.perfil_empresas for select to authenticated
  using (perfil_id = (select auth.uid()) or public.es_admin());
drop policy if exists "perfil_empresas: escribir" on public.perfil_empresas;
create policy "perfil_empresas: escribir" on public.perfil_empresas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Empresa y rol: la empresa es de la organización del usuario; solo el Super Administrador asigna o
-- cambia roles (un administrador da acceso con el rol que el usuario ya tiene).
create or replace function public.validar_perfil_empresa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.perfiles;
begin
  select * into p from public.perfiles where id = new.perfil_id;
  select l.organizacion_id into new.organizacion_id from public.localidades l where l.id = new.localidad_id;
  if new.organizacion_id is null then raise exception 'La empresa no existe.'; end if;
  if p.organizacion_id is not null and new.organizacion_id <> p.organizacion_id and p.rol_id <> 'superadministrador' then
    raise exception 'La empresa debe ser de la organización del usuario.';
  end if;
  if p.rol_id = 'superadministrador' then new.rol_id := 'superadministrador'; end if;
  if (select auth.uid()) is not null and not public.es_superadmin()
     and coalesce(current_setting('fin.sync_empresa', true), '') <> 'si' then
    if tg_op = 'UPDATE' and new.rol_id is distinct from old.rol_id then
      raise exception 'Solo el Super Administrador puede cambiar el rol de un usuario';
    end if;
    if tg_op = 'INSERT' and new.rol_id is distinct from p.rol_id then
      raise exception 'Solo el Super Administrador puede dar un rol distinto en otra empresa';
    end if;
  end if;
  if new.rol_id = 'superadministrador' and p.rol_id <> 'superadministrador' then
    raise exception 'El rol Super Administrador se asigna en el usuario, no por empresa.';
  end if;
  return new;
end;
$$;
drop trigger if exists perfil_empresas_validar on public.perfil_empresas;
create trigger perfil_empresas_validar before insert or update on public.perfil_empresas for each row execute function public.validar_perfil_empresa();

-- Cambió una empresa del usuario: si es la activa, su rol pasa al perfil; si perdió el acceso a la
-- activa, pasa a su empresa principal (o a otra de las suyas).
create or replace function public.sincronizar_perfil_empresa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.perfiles; e public.perfil_empresas;
begin
  if coalesce(current_setting('fin.sync_empresa', true), '') = 'si' then return null; end if;
  select * into p from public.perfiles where id = coalesce(new.perfil_id, old.perfil_id);
  if p.id is null or p.rol_id = 'superadministrador' then return null; end if;
  select * into e from public.perfil_empresas where perfil_id = p.id and localidad_id = p.localidad_id and activo;
  if e.id is null then
    select * into e from public.perfil_empresas where perfil_id = p.id and activo
    order by (localidad_id = p.localidad_principal_id) desc, localidad_id limit 1;
  end if;
  if e.id is null then return null; end if;
  if e.localidad_id is distinct from p.localidad_id or e.rol_id is distinct from p.rol_id then
    perform set_config('fin.sync_empresa', 'si', true);
    perform set_config('fin.cambio_empresa', 'si', true);
    update public.perfiles set localidad_id = e.localidad_id, organizacion_id = e.organizacion_id, rol_id = e.rol_id where id = p.id;
    perform set_config('fin.cambio_empresa', '', true);
    perform set_config('fin.sync_empresa', '', true);
  end if;
  return null;
end;
$$;
drop trigger if exists perfil_empresas_sincronizar on public.perfil_empresas;
create trigger perfil_empresas_sincronizar after insert or update or delete on public.perfil_empresas for each row execute function public.sincronizar_perfil_empresa();

-- El perfil cambió por la vía de siempre (Modificar usuario, crear usuario migrado, SQL): su empresa
-- activa queda en perfil_empresas con su rol, y también sus localidades adicionales.
create or replace function public.empresas_desde_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('fin.sync_empresa', true), '') = 'si' or new.localidad_id is null then return null; end if;
  perform set_config('fin.sync_empresa', 'si', true);
  if tg_op = 'UPDATE' and new.organizacion_id is distinct from old.organizacion_id and new.rol_id <> 'superadministrador' then
    delete from public.perfil_empresas where perfil_id = new.id and organizacion_id <> new.organizacion_id;
  end if;
  insert into public.perfil_empresas (perfil_id, organizacion_id, localidad_id, rol_id)
  values (new.id, new.organizacion_id, new.localidad_id, new.rol_id)
  on conflict (perfil_id, localidad_id) do update set rol_id = excluded.rol_id, activo = true;
  insert into public.perfil_empresas (perfil_id, organizacion_id, localidad_id, rol_id)
  select new.id, l.organizacion_id, l.id, new.rol_id
  from unnest(coalesce(new.localidades_adicionales, '{}')) x join public.localidades l on l.id = x
  where l.organizacion_id = new.organizacion_id
  on conflict (perfil_id, localidad_id) do nothing;
  perform set_config('fin.sync_empresa', '', true);
  return null;
end;
$$;
drop trigger if exists perfiles_empresas on public.perfiles;
create trigger perfiles_empresas after insert or update of localidad_id, rol_id, organizacion_id, localidades_adicionales on public.perfiles
  for each row execute function public.empresas_desde_perfil();

-- Empresa principal: por defecto la activa; siempre de la organización del usuario.
create or replace function public.preparar_principal_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.localidad_principal_id is null
     or not exists (select 1 from public.localidades l where l.id = new.localidad_principal_id and l.organizacion_id = new.organizacion_id) then
    new.localidad_principal_id := new.localidad_id;
  end if;
  return new;
end;
$$;
drop trigger if exists perfiles_principal on public.perfiles;
create trigger perfiles_principal before insert or update of localidad_id, organizacion_id, localidad_principal_id on public.perfiles
  for each row execute function public.preparar_principal_perfil();

-- Protección del perfil (script 9) con el cambio de empresa activa: cambiar_empresa_activa y la
-- sincronización de roles por empresa sí cambian la empresa y el rol vigentes.
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  renovando boolean := coalesce(current_setting('fin.renovando_clave', true), '') = 'si';
  cambiando boolean := coalesce(current_setting('fin.cambio_empresa', true), '') = 'si';
begin
  -- Siempre queda al menos un Super Administrador activo (también desde el SQL Editor).
  if old.rol_id = 'superadministrador' and old.activo
     and (new.rol_id is distinct from 'superadministrador' or not new.activo)
     and not exists (
       select 1 from public.perfiles
       where rol_id = 'superadministrador' and activo and id <> old.id) then
    raise exception 'Debe quedar al menos un Super Administrador activo';
  end if;

  -- Sin usuario de la app (SQL Editor de Supabase) no se aplican las demás restricciones.
  if (select auth.uid()) is null then
    return new;
  end if;
  -- Cambio de empresa activa (o su rol en ella): solo cambian la empresa y el rol vigentes.
  if cambiando then
    if new.activo is distinct from old.activo or new.usuario is distinct from old.usuario or new.correo is distinct from old.correo
       or new.firma_ruta is distinct from old.firma_ruta or new.fecha_vence_clave is distinct from old.fecha_vence_clave then
      raise exception 'Solo un administrador puede cambiar estos datos del usuario';
    end if;
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
    or new.localidad_principal_id is distinct from old.localidad_principal_id
    or new.usuario is distinct from old.usuario
    or (new.fecha_vence_clave is distinct from old.fecha_vence_clave and not renovando)
    or new.firma_ruta is distinct from old.firma_ruta or new.correo is distinct from old.correo) then
    raise exception 'Solo un administrador puede cambiar estos datos del usuario';
  end if;
  return new;
end;
$$;

-- El usuario cambia su empresa activa (una de las suyas) y toma el rol que tiene en ella.
create or replace function public.cambiar_empresa_activa(p_localidad bigint) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  p public.perfiles;
  v_org bigint;
  v_rol text;
begin
  select * into p from public.perfiles where id = (select auth.uid());
  if p.id is null or not p.activo then raise exception 'Tu usuario no está activo.'; end if;
  select organizacion_id into v_org from public.localidades where id = p_localidad and activo;
  if v_org is null then raise exception 'La empresa no existe o está inactiva.'; end if;
  if p.rol_id = 'superadministrador' then
    v_rol := 'superadministrador';
  else
    select rol_id into v_rol from public.perfil_empresas where perfil_id = p.id and localidad_id = p_localidad and activo;
    if v_rol is null then raise exception 'No tienes acceso a esa empresa.'; end if;
  end if;
  perform set_config('fin.sync_empresa', 'si', true);
  perform set_config('fin.cambio_empresa', 'si', true);
  update public.perfiles set localidad_id = p_localidad, organizacion_id = v_org, rol_id = v_rol where id = p.id;
  perform set_config('fin.cambio_empresa', '', true);
  perform set_config('fin.sync_empresa', '', true);
  return v_rol;
end;
$$;
revoke execute on function public.cambiar_empresa_activa(bigint) from public, anon;
grant execute on function public.cambiar_empresa_activa(bigint) to authenticated;
revoke execute on function public.validar_perfil_empresa() from public, anon, authenticated;
revoke execute on function public.sincronizar_perfil_empresa() from public, anon, authenticated;
revoke execute on function public.empresas_desde_perfil() from public, anon, authenticated;
revoke execute on function public.preparar_principal_perfil() from public, anon, authenticated;

-- Datos: la empresa actual de cada usuario (principal) y sus localidades adicionales, con su rol.
do $$
declare v_n integer;
begin
  perform set_config('fin.sync_empresa', 'si', true);
  update public.perfiles set localidad_principal_id = localidad_id where localidad_principal_id is null and localidad_id is not null;
  insert into public.perfil_empresas (perfil_id, organizacion_id, localidad_id, rol_id)
  select p.id, p.organizacion_id, p.localidad_id, p.rol_id from public.perfiles p where p.localidad_id is not null
  on conflict (perfil_id, localidad_id) do nothing;
  insert into public.perfil_empresas (perfil_id, organizacion_id, localidad_id, rol_id)
  select p.id, l.organizacion_id, l.id, p.rol_id
  from public.perfiles p cross join lateral unnest(coalesce(p.localidades_adicionales, '{}')) x join public.localidades l on l.id = x
  where l.organizacion_id = p.organizacion_id
  on conflict (perfil_id, localidad_id) do nothing;
  perform set_config('fin.sync_empresa', '', true);
  select count(*) into v_n from public.perfil_empresas;
  raise notice '%', format('Empresas por usuario: %s accesos (empresa y rol) de %s usuarios.', v_n, (select count(distinct perfil_id) from public.perfil_empresas));
end;
$$;

notify pgrst, 'reload schema';


-- ===== 20261106000097_ingresar_con_usuario.sql =====
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


-- ===== 20261106000098_clave_personalizada.sql =====
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


-- ===== 20261106000099_super_administrador_global.sql =====
-- Super Administrador Global y Super Administrador por organización.
--   perfiles.es_global: el Super Administrador Global, uno solo (Oliver Asturias): acceso total a todas
--   las organizaciones y empresas. Solo se define en la base de datos (SQL Editor), no desde la app, y no
--   puede perder su rol ni desactivarse.
--   El rol superadministrador sin es_global es el Super Administrador de UNA organización: todo en su
--   organización y sus empresas, nada en las demás. Solo el Super Administrador Global asigna o quita el
--   rol Super Administrador y modifica a un Super Administrador.
--   Quien no es el Global administra solo usuarios de su propia organización.
--   es_superadmin_global(): el usuario actual es el Global. mi_organizacion(): su organización.
-- Se ejecuta después del script 98.

alter table public.perfiles add column if not exists es_global boolean not null default false;
create unique index if not exists perfiles_un_global on public.perfiles ((es_global)) where es_global;

create or replace function public.es_superadmin_global() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where id = (select auth.uid()) and activo and rol_id = 'superadministrador' and es_global);
$$;
create or replace function public.mi_organizacion() returns bigint
language sql stable security definer set search_path = '' as $$
  select organizacion_id from public.perfiles where id = (select auth.uid());
$$;
revoke execute on function public.es_superadmin_global() from public, anon;
grant execute on function public.es_superadmin_global() to authenticated;
revoke execute on function public.mi_organizacion() from public, anon;
grant execute on function public.mi_organizacion() to authenticated;

-- El Global: Oliver Asturias (Super Administrador); si no se encuentra por nombre, el Super Administrador más antiguo.
do $$
declare v uuid; v_nombre text;
begin
  if not exists (select 1 from public.perfiles where es_global) then
    select id into v from public.perfiles
    where rol_id = 'superadministrador' and upper(regexp_replace(trim(nombre), '\s+', ' ', 'g')) = 'OLIVER ASTURIAS'
    order by creado_en limit 1;
    if v is null then select id into v from public.perfiles where rol_id = 'superadministrador' order by creado_en limit 1; end if;
    update public.perfiles set es_global = true where id = v;
  end if;
  select nombre into v_nombre from public.perfiles where es_global;
  raise notice '%', format('Super Administrador Global: %s.', coalesce(v_nombre, '(ninguno: no hay Super Administrador)'));
end;
$$;

-- Protección del perfil (scripts 9 y 96) con el Global y el alcance por organización.
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  renovando boolean := coalesce(current_setting('fin.renovando_clave', true), '') = 'si';
  cambiando boolean := coalesce(current_setting('fin.cambio_empresa', true), '') = 'si';
  v_global boolean;
  v_org bigint;
begin
  -- Siempre queda al menos un Super Administrador activo (también desde el SQL Editor).
  if old.rol_id = 'superadministrador' and old.activo
     and (new.rol_id is distinct from 'superadministrador' or not new.activo)
     and not exists (
       select 1 from public.perfiles
       where rol_id = 'superadministrador' and activo and id <> old.id) then
    raise exception 'Debe quedar al menos un Super Administrador activo';
  end if;
  -- El Super Administrador Global no pierde su rol ni se desactiva.
  if old.es_global and new.es_global and (new.rol_id is distinct from 'superadministrador' or not new.activo) then
    raise exception 'El Super Administrador Global no puede perder su rol ni desactivarse';
  end if;

  -- Sin usuario de la app (SQL Editor de Supabase) no se aplican las demás restricciones.
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.es_global is distinct from old.es_global then
    raise exception 'El Super Administrador Global solo se define en la base de datos';
  end if;
  -- Cambio de empresa activa (o su rol en ella): solo cambian la empresa y el rol vigentes.
  if cambiando then
    if new.activo is distinct from old.activo or new.usuario is distinct from old.usuario or new.correo is distinct from old.correo
       or new.firma_ruta is distinct from old.firma_ruta or new.fecha_vence_clave is distinct from old.fecha_vence_clave then
      raise exception 'Solo un administrador puede cambiar estos datos del usuario';
    end if;
    return new;
  end if;
  v_global := public.es_superadmin_global();
  v_org := public.mi_organizacion();
  if (new.rol_id = 'superadministrador') is distinct from (old.rol_id = 'superadministrador') and not v_global then
    raise exception 'Solo el Super Administrador Global asigna o quita el rol Super Administrador';
  end if;
  if new.rol_id is distinct from old.rol_id and not public.es_superadmin() then
    raise exception 'Solo el Super Administrador puede cambiar el rol de un usuario';
  end if;
  if old.rol_id = 'superadministrador' and old.id <> (select auth.uid()) and not v_global then
    raise exception 'Solo el Super Administrador Global puede modificar a un Super Administrador';
  end if;
  -- Quien no es el Global administra solo usuarios de su organización.
  if not v_global and old.id <> (select auth.uid())
     and ((old.organizacion_id is not null and old.organizacion_id is distinct from v_org) or new.organizacion_id is distinct from v_org) then
    raise exception 'Solo puedes administrar usuarios de tu organización';
  end if;
  if not public.es_admin() and (
       new.activo is distinct from old.activo
    or new.organizacion_id is distinct from old.organizacion_id or new.localidad_id is distinct from old.localidad_id
    or new.localidad_principal_id is distinct from old.localidad_principal_id
    or new.usuario is distinct from old.usuario
    or (new.fecha_vence_clave is distinct from old.fecha_vence_clave and not renovando)
    or new.firma_ruta is distinct from old.firma_ruta or new.correo is distinct from old.correo) then
    raise exception 'Solo un administrador puede cambiar estos datos del usuario';
  end if;
  return new;
end;
$$;

-- Empresas por usuario (script 96): el Super Administrador de una organización solo en su organización;
-- quien no es el Global da acceso solo a empresas de su organización.
create or replace function public.validar_perfil_empresa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.perfiles;
begin
  select * into p from public.perfiles where id = new.perfil_id;
  select l.organizacion_id into new.organizacion_id from public.localidades l where l.id = new.localidad_id;
  if new.organizacion_id is null then raise exception 'La empresa no existe.'; end if;
  if p.organizacion_id is not null and new.organizacion_id <> p.organizacion_id and not p.es_global then
    raise exception 'La empresa debe ser de la organización del usuario.';
  end if;
  if p.rol_id = 'superadministrador' then new.rol_id := 'superadministrador'; end if;
  if (select auth.uid()) is not null and coalesce(current_setting('fin.sync_empresa', true), '') <> 'si' then
    if not public.es_superadmin_global() and new.organizacion_id is distinct from public.mi_organizacion() then
      raise exception 'Solo puedes dar acceso a empresas de tu organización';
    end if;
    if not public.es_superadmin() then
      if tg_op = 'UPDATE' and new.rol_id is distinct from old.rol_id then
        raise exception 'Solo el Super Administrador puede cambiar el rol de un usuario';
      end if;
      if tg_op = 'INSERT' and new.rol_id is distinct from p.rol_id then
        raise exception 'Solo el Super Administrador puede dar un rol distinto en otra empresa';
      end if;
    end if;
  end if;
  if new.rol_id = 'superadministrador' and p.rol_id <> 'superadministrador' then
    raise exception 'El rol Super Administrador se asigna en el usuario, no por empresa.';
  end if;
  return new;
end;
$$;

-- Cambiar de empresa: el Global a cualquiera; el Super Administrador de una organización, a las de su
-- organización; los demás, a las suyas (perfil_empresas).
create or replace function public.cambiar_empresa_activa(p_localidad bigint) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  p public.perfiles;
  v_org bigint;
  v_rol text;
begin
  select * into p from public.perfiles where id = (select auth.uid());
  if p.id is null or not p.activo then raise exception 'Tu usuario no está activo.'; end if;
  select organizacion_id into v_org from public.localidades where id = p_localidad and activo;
  if v_org is null then raise exception 'La empresa no existe o está inactiva.'; end if;
  if p.rol_id = 'superadministrador' then
    if not p.es_global and v_org is distinct from p.organizacion_id then raise exception 'No tienes acceso a esa empresa.'; end if;
    v_rol := 'superadministrador';
  else
    select rol_id into v_rol from public.perfil_empresas where perfil_id = p.id and localidad_id = p_localidad and activo;
    if v_rol is null then raise exception 'No tienes acceso a esa empresa.'; end if;
  end if;
  perform set_config('fin.sync_empresa', 'si', true);
  perform set_config('fin.cambio_empresa', 'si', true);
  update public.perfiles set localidad_id = p_localidad, organizacion_id = v_org, rol_id = v_rol where id = p.id;
  perform set_config('fin.cambio_empresa', '', true);
  perform set_config('fin.sync_empresa', '', true);
  return v_rol;
end;
$$;

-- Clave personalizada (script 98): el Global para cualquiera; el Super Administrador de una
-- organización, solo para usuarios de su organización.
create or replace function public.asignar_clave(p_usuario uuid, p_clave text, p_cambiar boolean default true) returns date
language plpgsql volatile security definer set search_path = '' as $$
declare v_vence date := case when p_cambiar then current_date else current_date + 90 end;
begin
  if not public.es_superadmin() then raise exception 'Solo el Super Administrador puede asignar una clave personalizada.'; end if;
  if not exists (select 1 from auth.users where id = p_usuario) then raise exception 'El usuario no existe.'; end if;
  if not public.es_superadmin_global() and exists (select 1 from public.perfiles where id = p_usuario
       and ((organizacion_id is not null and organizacion_id is distinct from public.mi_organizacion()) or rol_id = 'superadministrador') and id <> (select auth.uid())) then
    raise exception 'Solo puedes asignar claves a usuarios de tu organización.';
  end if;
  if p_clave is null or length(p_clave) < 8 then raise exception 'La clave debe tener al menos 8 caracteres.'; end if;
  if length(p_clave) > 72 then raise exception 'La clave puede tener como máximo 72 caracteres.'; end if;
  if p_clave !~ '[A-Za-zÁÉÍÓÚÑáéíóúñ]' or p_clave !~ '[0-9]' then raise exception 'La clave debe tener letras y números.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_clave, extensions.gen_salt('bf', 10)), updated_at = now() where id = p_usuario;
  update public.perfiles set fecha_vence_clave = v_vence where id = p_usuario;
  return v_vence;
end;
$$;

notify pgrst, 'reload schema';


-- ===== 20261106000100_un_super_administrador_por_organizacion.sql =====
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

