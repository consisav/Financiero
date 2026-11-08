-- Menú: «Estado de cuenta proveedores» en Compras · Procesos · Cuentas x Pagar y «Estado de cuenta clientes» en
-- Facturación/Ventas · Procesos · Cuentas x Cobrar, con los mismos accesos de «CXP por periodo» y «CXC por periodo».
-- Solo agrega las opciones del menú y sus accesos: el reporte lee las compras, las ventas y sus pagos.
-- Se ejecuta después del script 141.
do $$
declare o record; v_ref record; v_orden integer; v_id bigint;
begin
  for o in select * from (values ('cxp-periodo', 'cxp-estado', 'Estado de cuenta proveedores', 'Cuentas x Pagar'),
                                 ('cxc-periodo', 'cxc-estado', 'Estado de cuenta clientes', 'Cuentas x Cobrar')) as x(ref, clave, nombre, subgrupo) loop
    select id, modulo_id, orden into v_ref from public.opciones_sistema where clave = o.ref order by id limit 1;
    if v_ref.id is null then raise notice 'No existe la opción %: ejecuta antes el script 141.', o.ref; continue; end if;
    if exists (select 1 from public.opciones_sistema where modulo_id = v_ref.modulo_id and clave = o.clave) then continue; end if;
    select coalesce(max(orden), 0) + 1 into v_orden from public.opciones_sistema where modulo_id = v_ref.modulo_id;
    insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
    values (v_ref.modulo_id, 'procesos', o.subgrupo, o.clave, o.nombre, v_orden) returning id into v_id;
    insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
    select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = v_ref.id on conflict do nothing;
  end loop;
  raise notice 'Estado de cuenta de proveedores y de clientes agregados al menú.';
end;
$$;
