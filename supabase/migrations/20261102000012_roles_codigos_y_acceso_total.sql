-- Roles funcionales con códigos sucesivos desde 1:
--   1 Super Administrador del Sistema · 2 Administrador del Sistema · 3 Gerente General ·
--   4 Gerente · 5 Sub Gerente · 6 Auditor · 7 Contador · 8 Auxiliar Contable ·
--   9 Secretaria Administrativa · 10 Encargado de Inventarios · 11 Encargado de Nóminas ·
--   y a continuación los roles creados por los usuarios, en su orden anterior.
-- "acceso_total": el rol tiene todas las acciones en todas las pantallas, también en las que se
-- agreguen después (Super Administrador del Sistema y Gerente General).

alter table public.roles_funcionales add column acceso_total boolean not null default false;

insert into public.roles_funcionales (codigo, nombre, descripcion)
select v.codigo, v.nombre, v.descripcion
from (values
  (100001, 'SUPER ADMINISTRADOR DEL SISTEMA', 'Acceso total a todo el sistema'),
  (100002, 'ADMINISTRADOR DEL SISTEMA',       'Configuración del sistema; consulta en los módulos'),
  (100003, 'GERENTE GENERAL',                 'Acceso total a todo el sistema')
) as v (codigo, nombre, descripcion)
where not exists (select 1 from public.roles_funcionales r where upper(r.nombre) = v.nombre);

-- Renumeración en dos pasos para no chocar con la restricción de código único.
update public.roles_funcionales set codigo = codigo + 1000000;

with orden as (
  select r.id,
         row_number() over (order by coalesce(f.posicion, 1000), r.codigo) as nuevo
  from public.roles_funcionales r
  left join (values
    ('SUPER ADMINISTRADOR DEL SISTEMA', 1), ('ADMINISTRADOR DEL SISTEMA', 2), ('GERENTE GENERAL', 3),
    ('GERENTE', 4), ('SUB GERENTE', 5), ('AUDITOR', 6), ('CONTADOR', 7), ('AUXILIAR CONTABLE', 8),
    ('SECRETARIA ADMINISTRATIVA', 9), ('ENCARGADO DE INVENTARIOS', 10), ('ENCARGADO DE NÓMINAS', 11)
  ) as f (nombre, posicion) on f.nombre = upper(r.nombre)
)
update public.roles_funcionales r set codigo = o.nuevo from orden o where o.id = r.id;

update public.roles_funcionales set acceso_total = true, activo = true
where upper(nombre) in ('SUPER ADMINISTRADOR DEL SISTEMA', 'GERENTE GENERAL');

-- ---------- Accesos ----------
-- Acceso total: todas las acciones en todas las pantallas.
insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
select r.id, o.id, true, true, true, true, true
from public.roles_funcionales r cross join public.opciones_sistema o
where r.acceso_total
on conflict (rol_id, opcion_id) do update
  set ver = true, crear = true, modificar = true, anular = true, imprimir = true;

-- Administrador del Sistema: total en las pantallas comunes (Iniciales, Geografía…) y consulta en los módulos.
insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
select r.id, o.id, true, o.modulo_id is null, o.modulo_id is null, o.modulo_id is null, true
from public.roles_funcionales r cross join public.opciones_sistema o
where upper(r.nombre) = 'ADMINISTRADOR DEL SISTEMA'
on conflict (rol_id, opcion_id) do nothing;

-- Pantallas nuevas: los roles con acceso total las reciben completas automáticamente.
create function public.acceso_total_a_nueva_opcion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
  select r.id, new.id, true, true, true, true, true
  from public.roles_funcionales r where r.acceso_total
  on conflict (rol_id, opcion_id) do nothing;
  return null;
end;
$$;
create trigger opciones_sistema_acceso_total after insert on public.opciones_sistema
  for each row execute function public.acceso_total_a_nueva_opcion();

-- Al marcar un rol con acceso total, recibe todas las pantallas.
create function public.completar_acceso_total() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.acceso_total and not coalesce(old.acceso_total, false) then
    insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
    select new.id, o.id, true, true, true, true, true from public.opciones_sistema o
    on conflict (rol_id, opcion_id) do update
      set ver = true, crear = true, modificar = true, anular = true, imprimir = true;
  end if;
  return null;
end;
$$;
create trigger roles_funcionales_acceso_total after insert or update of acceso_total on public.roles_funcionales
  for each row execute function public.completar_acceso_total();

revoke execute on function public.acceso_total_a_nueva_opcion() from public, anon, authenticated;
revoke execute on function public.completar_acceso_total() from public, anon, authenticated;

-- Los usuarios con rol de sistema Super Administrador / Administrador quedan en su rol funcional.
insert into public.rol_usuarios (rol_id, perfil_id, fecha_inicio, estado)
select r.id, p.id, current_date, 'ACTIVO'
from public.perfiles p
join public.roles_funcionales r on upper(r.nombre) =
  case p.rol_id when 'superadministrador' then 'SUPER ADMINISTRADOR DEL SISTEMA' else 'ADMINISTRADOR DEL SISTEMA' end
where p.activo and p.rol_id in ('superadministrador', 'administrador')
on conflict (rol_id, perfil_id) do nothing;

notify pgrst, 'reload schema';
