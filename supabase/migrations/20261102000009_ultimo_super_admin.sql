-- El Super Administrador puede cambiar también su propio rol, pero siempre debe quedar al menos
-- un Super Administrador activo: no se le puede quitar el rol ni desactivar al último.

create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  renovando boolean := coalesce(current_setting('fin.renovando_clave', true), '') = 'si';
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
