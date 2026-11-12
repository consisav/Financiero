-- Script 208 · Menú: «Transacciones por módulo» pasa de Procesos › Generación de Cierres a Catálogos › Objetos contables,
--   debajo de «Transacciones». Conserva los accesos que ya tiene y suma los de «Transacciones» (objetos-transacciones).
--   Correrlo después del 206. Se puede ejecutar de nuevo.
do $$
declare v_id bigint; v_ref record;
begin
  select id into v_id from public.opciones_sistema where clave = 'con-transacciones-modulo' order by id limit 1;
  if v_id is null then raise notice 'Falta correr el script 206 (no existe la opción Transacciones por módulo).'; return; end if;
  select id, modulo_id, grupo, subgrupo, orden into v_ref from public.opciones_sistema where clave = 'objetos-transacciones' order by id limit 1;
  if v_ref.id is null then raise notice 'No existe la opción Objetos contables › Transacciones.'; return; end if;
  -- Hace lugar justo debajo de «Transacciones».
  update public.opciones_sistema set orden = orden + 1 where modulo_id = v_ref.modulo_id and orden > v_ref.orden and id <> v_id;
  update public.opciones_sistema set modulo_id = v_ref.modulo_id, grupo = v_ref.grupo, subgrupo = v_ref.subgrupo, orden = v_ref.orden + 1, activo = true
  where id = v_id;
  insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
  select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = v_ref.id
  on conflict do nothing;
end $$;

notify pgrst, 'reload schema';

select o.grupo, o.subgrupo, o.clave, o.nombre, o.orden, (select count(*) from public.rol_accesos a where a.opcion_id = o.id) as roles_con_acceso
from public.opciones_sistema o where o.clave in ('objetos-definicion', 'objetos-transacciones', 'con-transacciones-modulo') order by o.orden;
