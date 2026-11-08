-- Menú: «Cuentas x Pagar» de Compras pasa de Registros a Procesos, y Facturación/Ventas recibe en Procesos el grupo
-- «Cuentas x Cobrar» (Consolidado CXC mensual, Consolidado general y CXC por periodo), asociado a todas las ventas.
-- Solo cambia el menú y los accesos: los reportes leen las facturas de venta, sus cobros y sus notas.
-- Se ejecuta después del script 140.
do $$
declare v_mod bigint; v_ref bigint; v_orden integer; v_id bigint; o record;
begin
  -- Compras: Cuentas x Pagar a Procesos (después de Carga Facturas SAT).
  update public.opciones_sistema set grupo = 'procesos', subgrupo = 'Cuentas x Pagar'
  where clave in ('cxp-mensual', 'cxp-general', 'cxp-periodo') and grupo <> 'procesos';

  -- Facturación/Ventas: Cuentas x Cobrar en Procesos, con los accesos de Facturas Ventas.
  select id, modulo_id into v_ref, v_mod from public.opciones_sistema where grupo = 'registros' and clave = 'facturas-ventas' order by id limit 1;
  if v_ref is null then raise notice 'No existe la opción Facturas Ventas.'; return; end if;
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema where modulo_id = v_mod;
  for o in select * from (values (1, 'cxc-mensual', 'Consolidado CXC mensual'), (2, 'cxc-general', 'Consolidado general'), (3, 'cxc-periodo', 'CXC por periodo')) as x(n, clave, nombre) loop
    if not exists (select 1 from public.opciones_sistema where modulo_id = v_mod and clave = o.clave) then
      insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
      values (v_mod, 'procesos', 'Cuentas x Cobrar', o.clave, o.nombre, v_orden + o.n) returning id into v_id;
      insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
      select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = v_ref on conflict do nothing;
    end if;
  end loop;
  raise notice 'Cuentas x Pagar en Procesos de Compras y Cuentas x Cobrar en Procesos de Facturación/Ventas.';
end;
$$;
