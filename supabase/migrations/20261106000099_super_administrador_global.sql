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
