-- Usuarios y roles del Sistema Financiero.
-- Cada usuario de auth.users tiene un perfil con un rol; cada rol tiene permisos por módulo.
-- El primer usuario que se registra queda como administrador activo; los siguientes
-- quedan inactivos con rol "consulta" hasta que un administrador los active.

create table public.roles (
  id          text primary key,
  nombre      text not null,
  descripcion text
);

create table public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null default '',
  correo     text not null,
  rol_id     text not null default 'consulta' references public.roles (id),
  activo     boolean not null default false,
  creado_en  timestamptz not null default now()
);

-- modulo: contabilidad, facturacion, inventarios, sat, nominas, comercio (ver web/js/menu.js)
create table public.rol_modulos (
  rol_id       text not null references public.roles (id) on delete cascade,
  modulo       text not null,
  puede_ver    boolean not null default true,
  puede_editar boolean not null default false,
  primary key (rol_id, modulo)
);

insert into public.roles (id, nombre, descripcion) values
  ('administrador', 'Administrador', 'Acceso total y gestión de usuarios'),
  ('contador',      'Contador',      'Contabilidad, SAT y nóminas'),
  ('facturador',    'Facturador',    'Facturación, ventas e inventarios'),
  ('consulta',      'Consulta',      'Solo lectura');

insert into public.rol_modulos (rol_id, modulo, puede_ver, puede_editar)
select r.id, m.modulo, true,
       case r.id
         when 'administrador' then true
         when 'contador'   then m.modulo in ('contabilidad', 'sat', 'nominas')
         when 'facturador' then m.modulo in ('facturacion', 'inventarios', 'comercio')
         else false
       end
from public.roles r
cross join (values ('contabilidad'), ('facturacion'), ('inventarios'), ('sat'), ('nominas'), ('comercio')) as m (modulo);

-- Funciones auxiliares (security definer para que las políticas no se llamen a sí mismas)
create function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and rol_id = 'administrador' and activo
  );
$$;

create function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  primero boolean := not exists (select 1 from public.perfiles);
begin
  insert into public.perfiles (id, nombre, correo, rol_id, activo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    new.email,
    case when primero then 'administrador' else 'consulta' end,
    primero
  );
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- Un usuario no puede cambiarse a sí mismo el rol ni activarse; solo un administrador.
create function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.rol_id is distinct from old.rol_id or new.activo is distinct from old.activo)
     and not public.es_admin() then
    raise exception 'Solo un administrador puede cambiar el rol o el estado';
  end if;
  return new;
end;
$$;

create trigger antes_de_editar_perfil
  before update on public.perfiles
  for each row execute function public.proteger_perfil();

-- Seguridad a nivel de fila
alter table public.roles       enable row level security;
alter table public.perfiles    enable row level security;
alter table public.rol_modulos enable row level security;

create policy "roles: leer" on public.roles
  for select to authenticated using (true);
create policy "roles: admin escribe" on public.roles
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

create policy "rol_modulos: leer" on public.rol_modulos
  for select to authenticated using (true);
create policy "rol_modulos: admin escribe" on public.rol_modulos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

create policy "perfiles: ver el propio o admin" on public.perfiles
  for select to authenticated using (id = (select auth.uid()) or public.es_admin());
create policy "perfiles: editar el propio o admin" on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()) or public.es_admin())
  with check (id = (select auth.uid()) or public.es_admin());

revoke execute on function public.crear_perfil() from public, anon, authenticated;
revoke execute on function public.proteger_perfil() from public, anon, authenticated;
