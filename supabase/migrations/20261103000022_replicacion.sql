-- Cuentas y CC · Replicación (subgrupo dentro de Cuentas y CC): Empresa y parámetros,
-- Nomenclatura y Centros de costos. Se registran las pantallas para que aparezcan en la matriz
-- de accesos de Roles módulos, debajo de Tipos de partida. Puede ejecutarse de nuevo.

do $$
declare
  v_con bigint := (select id from public.modulos_sistema where siglas = 'CON' and modulo_mayor_id is null);
  v_orden integer := (select orden from public.opciones_sistema where clave = 'tipos-de-partida' and modulo_id = v_con);
begin
  if not exists (select 1 from public.opciones_sistema where clave = 'replicacion-empresa') then
    update public.opciones_sistema set orden = orden + 3 where orden > v_orden;
  end if;

  insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
  values (v_con, 'catalogos', 'Cuentas y CC · Replicación', 'replicacion-empresa',      'Empresa y parámetros', v_orden + 1),
         (v_con, 'catalogos', 'Cuentas y CC · Replicación', 'replicacion-nomenclatura', 'Nomenclatura',         v_orden + 2),
         (v_con, 'catalogos', 'Cuentas y CC · Replicación', 'replicacion-centros',      'Centros de costos',    v_orden + 3)
  on conflict do nothing;
end;
$$;
