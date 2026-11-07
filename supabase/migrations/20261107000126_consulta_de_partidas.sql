-- Contabilidad · Registros · Partidas · Consulta de Partidas (debajo de Partidas contables): el mismo diseño de la
-- Consulta de Cheques, para las partidas contables. La pantalla lee partidas, partida_lineas, movimientos_bancarios y
-- caja_periodos: no crea tablas.
-- Cada rol recibe los permisos de ver e imprimir que ya tiene en Partidas contables. Puede ejecutarse de nuevo.
do $$
declare
  v_mod bigint; v_orden integer; v_id bigint;
begin
  select modulo_id, orden into v_mod, v_orden from public.opciones_sistema where clave = 'partidas-contables' and grupo = 'registros' order by id limit 1;
  if v_mod is null then raise notice 'No existe la opción Partidas contables.'; return; end if;
  if exists (select 1 from public.opciones_sistema where modulo_id = v_mod and grupo = 'registros' and clave = 'consulta-de-partidas') then
    raise notice 'Consulta de Partidas ya estaba instalada.'; return;
  end if;
  -- Va justo después de Partidas contables.
  update public.opciones_sistema set orden = orden + 1 where orden > v_orden;
  insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
  values (v_mod, 'registros', 'Partidas', 'consulta-de-partidas', 'Consulta de Partidas', v_orden + 1)
  returning id into v_id;
  insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
  select a.rol_id, v_id, bool_or(a.ver), false, false, false, bool_or(a.imprimir)
  from public.rol_accesos a join public.opciones_sistema s on s.id = a.opcion_id
  where s.modulo_id = v_mod and s.grupo = 'registros' and s.clave = 'partidas-contables'
  group by a.rol_id
  on conflict do nothing;
  raise notice 'Consulta de Partidas instalada debajo de Partidas contables.';
end;
$$;

notify pgrst, 'reload schema';
