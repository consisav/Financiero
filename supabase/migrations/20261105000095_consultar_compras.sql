-- Compras · Mantenimientos · Consultar Compras (opción del menú, subgrupo Inventarios, antes del Kardex):
-- resumen de los ingresos de compras (maestro y detalle) por organización y localidad, proveedor y
-- rango de fechas; «Modificar» abre la compra en Registros · Ingreso de compras si no está contabilizada
-- y su mes no está cerrado. La pantalla lee compras, compras_saldo, sus detalles y cierres_mes.
-- Se ejecuta después del script 94.
do $$
declare
  v_mod bigint;
  v_orden integer;
begin
  select id into v_mod from public.modulos_sistema where siglas = 'COM' and modulo_mayor_id is null;
  if v_mod is null or exists (select 1 from public.opciones_sistema where modulo_id = v_mod and clave = 'consultar-compras') then return; end if;
  -- Va justo antes de Kardex de Productos.
  select orden into v_orden from public.opciones_sistema where modulo_id = v_mod and clave = 'kardex-productos';
  if v_orden is null then
    v_orden := coalesce((select max(orden) from public.opciones_sistema), 0) + 1;
  else
    update public.opciones_sistema set orden = orden + 1 where orden >= v_orden;
  end if;
  insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
  values (v_mod, 'mantenimientos', 'Inventarios', 'consultar-compras', 'Consultar Compras', v_orden);
end;
$$;

notify pgrst, 'reload schema';
