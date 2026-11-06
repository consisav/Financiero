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
