-- Caja y Bancos · Bancos · Consulta de Depósitos Monetarios (debajo de Depósitos multimoneda) y Consulta de Notas
-- (debajo de Notas de débito / transferencias): el mismo diseño de la Consulta de Cheques, para los depósitos y
-- para las notas de crédito y débito. Las pantallas leen movimientos_bancarios, movimiento_lineas,
-- movimiento_documentos y compra_documentos_banco: no crean tablas.
-- Cada rol recibe los permisos de ver e imprimir que ya tiene en Depósitos multimoneda y en Notas de crédito
-- (o de débito). Puede ejecutarse de nuevo.
-- Se ejecuta después del script 112.
do $$
declare
  o record;
  v_mod bigint; v_orden integer; v_id bigint;
begin
  for o in select * from (values
    ('depositos', 'consulta-de-depositos', 'Consulta de Depósitos Monetarios', array['depositos']),
    ('notas-debito', 'consulta-de-notas', 'Consulta de Notas', array['notas-credito', 'notas-debito'])) as x(despues, clave, nombre, permisos) loop
    v_mod := null;
    select modulo_id, orden into v_mod, v_orden from public.opciones_sistema where clave = o.despues and grupo = 'bancos' order by id limit 1;
    if v_mod is null then raise notice 'No existe la opción %.', o.despues; continue; end if;
    if exists (select 1 from public.opciones_sistema where modulo_id = v_mod and grupo = 'bancos' and clave = o.clave) then
      raise notice '% ya estaba instalada.', o.nombre; continue;
    end if;
    -- Va justo después de la opción de registro.
    update public.opciones_sistema set orden = orden + 1 where orden > v_orden;
    insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
    values (v_mod, 'bancos', 'Bancos', o.clave, o.nombre, v_orden + 1)
    returning id into v_id;
    insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
    select a.rol_id, v_id, bool_or(a.ver), false, false, false, bool_or(a.imprimir)
    from public.rol_accesos a join public.opciones_sistema s on s.id = a.opcion_id
    where s.modulo_id = v_mod and s.grupo = 'bancos' and s.clave = any (o.permisos)
    group by a.rol_id
    on conflict do nothing;
    raise notice '% instalada debajo de %.', o.nombre, o.despues;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
