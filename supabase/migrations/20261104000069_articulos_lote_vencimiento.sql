-- Ingreso de compras · artículos con lote, fecha de fabricación y de vencimiento (empresas que venden
-- medicamentos o productos perecederos) y si controlan la fecha de vencimiento. Al cargar el
-- inventario la fecha de vencimiento pasa al movimiento (Kardex). Se ejecuta después del script 68.
alter table public.compra_articulos add column if not exists fecha_fabricacion date;
alter table public.compra_articulos add column if not exists fecha_vencimiento date;
alter table public.compra_articulos add column if not exists control_fecha boolean not null default false;
alter table public.compra_articulos drop constraint if exists compra_articulos_fechas_check;
alter table public.compra_articulos add constraint compra_articulos_fechas_check check (fecha_vencimiento is null or fecha_fabricacion is null or fecha_vencimiento >= fecha_fabricacion);
alter table public.compra_articulos drop constraint if exists compra_articulos_control_fecha_check;
alter table public.compra_articulos add constraint compra_articulos_control_fecha_check check (not control_fecha or fecha_vencimiento is not null);

create or replace function public.cargar_inventario_compra(p_compra bigint, p_accion text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.compras;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_n integer;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede cargar el inventario de las compras.'; end if;
  select * into c from public.compras where id = p_compra for update;
  if c.id is null then raise exception 'La compra no existe.'; end if;
  perform set_config('fin.inventario', 'si', true);
  if p_accion = 'CARGAR' then
    if c.estado = 'ANULADA' then raise exception 'La compra % está anulada.', c.numero; end if;
    if c.bodega_id is null then raise exception 'Elige la bodega de la compra para cargar el inventario.'; end if;
    insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, compra_articulo_id, lote, fecha_vencimiento, usuario)
    select c.organizacion_id, c.localidad_id, a.producto_id, c.bodega_id, c.fecha_ingreso, a.cantidad, round(a.costo_total / a.cantidad * public.cambio_a_base(c.moneda_id, c.tipo_cambio), 4), 'COMPRA', a.id, a.serie, a.fecha_vencimiento, v_quien
    from public.compra_articulos a where a.compra_id = c.id and a.inventario and not a.inventariado and a.ingreso_linea_id is null;
    get diagnostics v_n = row_count;
    if v_n = 0 then raise exception 'La compra % no tiene artículos pendientes de cargar al inventario.', c.numero; end if;
    update public.compra_articulos set inventariado = true where compra_id = c.id and inventario and not inventariado and ingreso_linea_id is null;
  elsif p_accion = 'REVERTIR' then
    delete from public.inventario_movimientos where compra_articulo_id in (select id from public.compra_articulos where compra_id = c.id and ingreso_linea_id is null);
    get diagnostics v_n = row_count;
    if v_n = 0 then raise exception 'La compra % no tiene artículos cargados al inventario (los del ingreso de la orden se revierten en Órdenes de compra).', c.numero; end if;
    update public.compra_articulos set inventariado = false where compra_id = c.id and ingreso_linea_id is null;
  else
    raise exception 'Acción no válida.';
  end if;
  perform set_config('fin.inventario', '', true);
  return jsonb_build_object('numero', c.numero, 'articulos', v_n);
end;
$$;

notify pgrst, 'reload schema';
