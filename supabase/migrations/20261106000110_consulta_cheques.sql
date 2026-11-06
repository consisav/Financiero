-- Caja y Bancos · Cheques · Consulta de Cheques (opción del menú, justo debajo de Emisión de cheques):
-- resumen de los cheques de la empresa por cuenta bancaria, beneficiario, fechas y estado, con el detalle
-- contable y las compras que liquidó cada cheque. La pantalla lee movimientos_bancarios, movimiento_lineas,
-- compra_documentos_banco y movimiento_documentos: no crea tablas.
-- Cada rol recibe los permisos que ya tiene en Emisión de cheques. Puede ejecutarse de nuevo.
-- Se ejecuta después del script 109.
do $$
declare
  v_mod bigint;
  v_orden integer;
  v_id bigint;
begin
  select modulo_id, orden into v_mod, v_orden from public.opciones_sistema where clave = 'emision-de-cheques' and grupo = 'cheques' order by id limit 1;
  if v_mod is null then raise notice 'No existe la opción Emisión de cheques.'; return; end if;
  if exists (select 1 from public.opciones_sistema where modulo_id = v_mod and grupo = 'cheques' and clave = 'consulta-de-cheques') then
    raise notice 'Consulta de Cheques ya estaba instalada.'; return;
  end if;
  -- Va justo después de Emisión de cheques.
  update public.opciones_sistema set orden = orden + 1 where orden > v_orden;
  insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
  values (v_mod, 'cheques', 'Cheques', 'consulta-de-cheques', 'Consulta de Cheques', v_orden + 1)
  returning id into v_id;
  insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
  select a.rol_id, v_id, a.ver, false, false, false, a.imprimir
  from public.rol_accesos a join public.opciones_sistema o on o.id = a.opcion_id
  where o.modulo_id = v_mod and o.clave = 'emision-de-cheques'
  on conflict do nothing;
  raise notice 'Consulta de Cheques instalada debajo de Emisión de cheques.';
end;
$$;

notify pgrst, 'reload schema';
