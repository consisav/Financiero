-- Compras: «Consultar Compras» pasa de Mantenimientos › Inventarios a Registros › Procesar Compras, justo
-- debajo de «Ingreso de compras». Los permisos de cada rol no cambian (son de la misma opción).
-- Puede ejecutarse de nuevo. Se ejecuta después del script 114.
do $$
declare
  v_mod bigint; v_orden integer; v_id bigint;
begin
  select modulo_id, orden into v_mod, v_orden from public.opciones_sistema where clave = 'facturas-compra' and grupo = 'registros' order by id limit 1;
  select id into v_id from public.opciones_sistema where clave = 'consultar-compras' and modulo_id = v_mod order by id limit 1;
  if v_mod is null or v_id is null then raise notice 'No existen Ingreso de compras o Consultar Compras.'; return; end if;
  if exists (select 1 from public.opciones_sistema where id = v_id and grupo = 'registros' and orden = v_orden + 1) then
    raise notice 'Consultar Compras ya estaba debajo de Ingreso de compras.'; return;
  end if;
  update public.opciones_sistema set orden = orden + 1 where orden > v_orden and id <> v_id;
  update public.opciones_sistema set grupo = 'registros', subgrupo = 'Procesar Compras', orden = v_orden + 1 where id = v_id;
  raise notice 'Consultar Compras quedó debajo de Ingreso de compras.';
end;
$$;

notify pgrst, 'reload schema';
