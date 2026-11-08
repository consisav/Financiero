-- Inventarios › Mantenimientos: grupo «Kardex» con «Movimiento de Kardex» (Kardex con y sin costos) y «Análisis de
-- Costos» (Análisis de costos local y Análisis costo importación); grupo «Control de inventario» con «Mínimos y
-- máximos» y «Costos» (ya existían como opciones del módulo). Solo menú y accesos: las pantallas leen las compras, los
-- productos y las existencias. Las opciones nuevas toman los accesos de «Mínimos y máximos».
-- Se ejecuta después del script 144.
do $$
declare v_inv bigint; v_ref bigint; v_id bigint; v_orden integer; o record;
begin
  select id into v_inv from public.modulos_sistema where siglas = 'INV' order by codigo limit 1;
  if v_inv is null then raise notice 'No existe el módulo Inventarios (INV).'; return; end if;
  update public.opciones_sistema set subgrupo = 'Movimiento de Kardex' where modulo_id = v_inv and grupo = 'mantenimientos' and clave in ('kardex-con-costos', 'kardex-sin-costos');
  update public.opciones_sistema set subgrupo = 'Control de inventario', activo = true where modulo_id = v_inv and grupo = 'mantenimientos' and clave in ('minimos-y-maximos', 'costos');
  select id into v_ref from public.opciones_sistema where modulo_id = v_inv and grupo = 'mantenimientos' and clave = 'minimos-y-maximos';
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  for o in select * from (values (1, 'analisis-costos-local', 'Análisis de costos local'), (2, 'analisis-costo-importacion', 'Análisis costo importación')) as x(n, clave, nombre) loop
    select id into v_id from public.opciones_sistema where modulo_id = v_inv and grupo = 'mantenimientos' and clave = o.clave;
    if v_id is null then
      insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
      values (v_inv, 'mantenimientos', 'Análisis de Costos', o.clave, o.nombre, v_orden + o.n) returning id into v_id;
    end if;
    if v_ref is not null then
      insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
      select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = v_ref on conflict do nothing;
    end if;
  end loop;
  raise notice 'Inventarios › Mantenimientos: Movimiento de Kardex, Análisis de Costos y Control de inventario.';
end;
$$;
