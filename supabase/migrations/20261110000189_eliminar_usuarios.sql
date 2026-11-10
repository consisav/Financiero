-- 189 · Eliminar usuarios (solo el Super Administrador Global)
-- Catálogos › Usuarios: el Super Administrador Global puede eliminar una cuenta de usuario o un usuario migrado «por crear».
--   · No se puede eliminar a sí mismo ni a otro Super Administrador Global.
--   · Si el usuario ya tiene movimientos (tickets, partidas, firmas, etc.) no se elimina: la función lo indica y se desactiva en su lugar
--     desde «Modificar» (Activo), para conservar la historia.
--   · Al eliminar la cuenta se borran su perfil, sus empresas y roles (en cascada). Si venía del sistema anterior, su registro migrado
--     vuelve a «por crear».
-- Se puede ejecutar más de una vez.

create or replace function public.eliminar_usuario(p_usuario uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.perfiles;
  usos text;
begin
  if not public.es_superadmin_global() then
    raise exception 'Solo el Super Administrador Global puede eliminar usuarios.';
  end if;
  select * into v from public.perfiles where id = p_usuario;
  if not found then raise exception 'El usuario ya no existe.'; end if;
  if v.id = (select auth.uid()) then raise exception 'No puedes eliminar tu propio usuario.'; end if;
  if v.es_global then raise exception 'No se puede eliminar a un Super Administrador Global.'; end if;

  -- Movimientos que impiden borrar (referencias sin borrado en cascada).
  select string_agg(t, ', ') into usos from (
    select 'tickets' as t where exists (select 1 from public.tickets where perfil_id = p_usuario or recurso_id = p_usuario)
    union all select 'seguimientos de tickets' where exists (select 1 from public.ticket_seguimientos where perfil_id = p_usuario)
    union all select 'asignaciones de tickets' where exists (select 1 from public.ticket_asignaciones where asignado_por_id = p_usuario or recurso_id = p_usuario)
    union all select 'cierres de tickets' where exists (select 1 from public.ticket_cierres where cerrado_por_id = p_usuario or entrega_id = p_usuario or recibe_id = p_usuario)
    union all select 'movimientos de tickets' where exists (select 1 from public.ticket_movimientos where recurso_id = p_usuario)
    union all select 'procesos de tickets' where exists (select 1 from public.ticket_procesos where responsable_id = p_usuario)
    union all select 'partidas contables' where exists (select 1 from public.partidas where perfil_id = p_usuario)
    union all select 'firmantes' where exists (select 1 from public.parametros_firmantes where perfil_id = p_usuario)
  ) x;
  if usos is not null then
    raise exception 'No se puede eliminar a % porque tiene %. Desactívalo con «Modificar» para conservar la historia.', coalesce(v.nombre, v.correo), usos;
  end if;

  -- Borra la cuenta; el perfil, sus empresas, roles y reportes se van en cascada.
  delete from auth.users where id = p_usuario;
  if not found then delete from public.perfiles where id = p_usuario; end if;
  return coalesce(v.nombre, v.correo);
end;
$$;

create or replace function public.eliminar_usuario_migrado(p_migrado bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare n text;
begin
  if not public.es_superadmin_global() then
    raise exception 'Solo el Super Administrador Global puede eliminar usuarios.';
  end if;
  delete from public.usuarios_migrados where id = p_migrado and perfil_id is null returning nombre into n;
  if n is null then raise exception 'El usuario por crear ya no existe o ya tiene cuenta.'; end if;
  return n;
end;
$$;

revoke all on function public.eliminar_usuario(uuid) from public, anon;
revoke all on function public.eliminar_usuario_migrado(bigint) from public, anon;
grant execute on function public.eliminar_usuario(uuid) to authenticated;
grant execute on function public.eliminar_usuario_migrado(bigint) to authenticated;

notify pgrst, 'reload schema';
