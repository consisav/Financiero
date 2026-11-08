-- Menú del grupo «Notas electrónicas»: sin «Facturación electrónica» (ya está en Facturas Ventas), nombres sin
-- «electrónicas» (Notas de Crédito, Notas de Débito, Notas de Abono) y «Consulta de Notas» debajo de Notas de Abono,
-- con los permisos de «Facturas Ventas». Se ejecuta después del script 134. Puede ejecutarse de nuevo.

do $$
declare v_mod bigint; v_fac bigint; v_abono integer; v_id bigint;
begin
  select id, modulo_id into v_fac, v_mod from public.opciones_sistema where grupo = 'registros' and clave = 'facturas-ventas' order by id limit 1;
  if v_fac is null then raise notice 'No existe la opción Facturas Ventas.'; return; end if;

  delete from public.rol_accesos where opcion_id in (select id from public.opciones_sistema where modulo_id = v_mod and clave = 'facturacion-electronica');
  delete from public.opciones_sistema where modulo_id = v_mod and clave = 'facturacion-electronica';

  update public.opciones_sistema set nombre = 'Notas de Crédito' where modulo_id = v_mod and clave = 'notas-de-credito-electronicas';
  update public.opciones_sistema set nombre = 'Notas de Débito' where modulo_id = v_mod and clave = 'notas-de-debito-electronicas';
  update public.opciones_sistema set nombre = 'Notas de Abono' where modulo_id = v_mod and clave = 'notas-de-abono-electronicas';
  update public.opciones_sistema set nombre = 'Anulación de Documentos DTE' where modulo_id = v_mod and clave = 'anulacion-de-documentos-dte';

  if not exists (select 1 from public.opciones_sistema where modulo_id = v_mod and grupo = 'registros' and clave = 'consulta-de-notas') then
    select orden into v_abono from public.opciones_sistema where modulo_id = v_mod and clave = 'notas-de-abono-electronicas';
    if v_abono is null then raise notice 'Falta ejecutar el script 134 (notas electrónicas).'; return; end if;
    update public.opciones_sistema set orden = orden + 1 where modulo_id = v_mod and orden > v_abono;
    insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
    values (v_mod, 'registros', 'Notas electrónicas', 'consulta-de-notas', 'Consulta de Notas', v_abono + 1) returning id into v_id;
    insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
    select a.rol_id, v_id, a.ver, false, false, false, a.imprimir from public.rol_accesos a where a.opcion_id = v_fac
    on conflict do nothing;
  end if;
  raise notice 'Menú de Notas electrónicas actualizado.';
end;
$$;
