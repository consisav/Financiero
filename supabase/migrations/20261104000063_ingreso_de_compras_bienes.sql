-- Compras · Registros · Ingreso de compras (antes «Facturas de compra»): detalle de bienes.
--   compra_articulos: los artículos de una compra de bienes (producto, serie, cantidad, costo
--   unitario, descuento, costos extra prorrateados, costo total, si va a inventario y si es exento),
--   con su enlace a la línea del ingreso de la orden cuando la compra viene de ahí.
--   cargar_inventario_compra (CARGAR, REVERTIR): los artículos de la compra entran o salen de la
--   bodega (los que vienen de un ingreso ya están en inventario).
--   vincular_ingreso_compra: enlaza a la compra un ingreso aplicado que todavía no se convirtió en
--   compra (la lista de valores de «Compra inventario»).
--   procesar_ingreso: al aplicar un ingreso, la compra que genera lleva sus artículos.
-- Escribir: administrador. Se ejecuta después del script 62.

create table if not exists public.compra_articulos (
  id               bigint generated always as identity primary key,
  compra_id        bigint not null references public.compras (id) on delete cascade,
  linea            integer not null,
  producto_id      bigint not null references public.productos (id),
  serie            text,
  cantidad         numeric(14, 4) not null check (cantidad > 0),
  costo_unitario   numeric(18, 4) not null default 0 check (costo_unitario >= 0),
  descuento        numeric(18, 4) not null default 0 check (descuento >= 0),
  costo_extra      numeric(18, 4) not null default 0 check (costo_extra >= 0),
  costo_total      numeric(18, 4) generated always as (round(cantidad * costo_unitario - descuento + costo_extra, 4)) stored,
  inventario       boolean not null default true,
  exento           boolean not null default false,
  inventariado     boolean not null default false,
  ingreso_linea_id bigint references public.ingreso_lineas (id),
  unique (compra_id, linea),
  check (cantidad * costo_unitario - descuento >= 0)
);
create index if not exists compra_articulos_producto_idx on public.compra_articulos (producto_id);

alter table public.inventario_movimientos add column if not exists compra_articulo_id bigint references public.compra_articulos (id) on delete cascade;
alter table public.inventario_movimientos drop constraint if exists inventario_movimientos_origen_check;
alter table public.inventario_movimientos add constraint inventario_movimientos_origen_check check (origen in ('INGRESO', 'COMPRA', 'AJUSTE', 'DESPACHO', 'TRASLADO'));

create or replace function public.validar_compra_articulo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.compras; il public.ingreso_lineas;
begin
  select * into c from public.compras where id = coalesce(new.compra_id, old.compra_id);
  if current_setting('fin.inventario', true) is distinct from 'si' then
    if c.estado = 'ANULADA' then raise exception 'La compra % está anulada.', c.numero; end if;
    if tg_op = 'DELETE' then
      if old.inventariado and old.ingreso_linea_id is null then raise exception 'El artículo de la línea % ya está en inventario: revierte la carga primero.', old.linea; end if;
      return old;
    end if;
    if tg_op = 'UPDATE' and old.inventariado and (new.producto_id <> old.producto_id or new.cantidad <> old.cantidad) then
      raise exception 'El artículo de la línea % ya está en inventario: revierte la carga para cambiarlo.', old.linea;
    end if;
    if tg_op = 'INSERT' then
      new.inventariado := false;
      if new.ingreso_linea_id is not null then
        select * into il from public.ingreso_lineas where id = new.ingreso_linea_id;
        new.producto_id := il.producto_id;
        new.inventariado := il.inventariado;
      end if;
    end if;
  elsif tg_op = 'DELETE' then
    return old;
  end if;
  if not exists (select 1 from public.productos p where p.id = new.producto_id and p.localidad_id = c.localidad_id) then
    raise exception 'El producto de la línea % no es de la localidad de la compra.', new.linea;
  end if;
  new.serie := nullif(upper(trim(new.serie)), '');
  return new;
end;
$$;
drop trigger if exists compra_articulos_validar on public.compra_articulos;
create trigger compra_articulos_validar before insert or update or delete on public.compra_articulos for each row execute function public.validar_compra_articulo();

-- Tipo de cambio a la moneda base (quetzales): en la moneda base el «valor cambio» es solo de referencia.
create or replace function public.cambio_a_base(p_moneda bigint, p_cambio numeric) returns numeric
language sql stable security definer set search_path = '' as $$
  select case when (select m.iso from public.monedas m where m.id = p_moneda) = 'GTQ' then 1 else coalesce(nullif(p_cambio, 0), 1) end;
$$;

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
    insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, compra_articulo_id, lote, usuario)
    select c.organizacion_id, c.localidad_id, a.producto_id, c.bodega_id, c.fecha_ingreso, a.cantidad, round(a.costo_total / a.cantidad * public.cambio_a_base(c.moneda_id, c.tipo_cambio), 4), 'COMPRA', a.id, a.serie, v_quien
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

-- Enlaza a la compra un ingreso aplicado que todavía no tiene compra.
create or replace function public.vincular_ingreso_compra(p_ingreso bigint, p_compra bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i public.ingresos_compra; c public.compras;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede enlazar ingresos a las compras.'; end if;
  select * into i from public.ingresos_compra where id = p_ingreso for update;
  select * into c from public.compras where id = p_compra;
  if i.id is null or c.id is null then raise exception 'El ingreso o la compra no existen.'; end if;
  if i.localidad_id <> c.localidad_id then raise exception 'El ingreso no es de la localidad de la compra.'; end if;
  if i.estado <> 'APLICADO' then raise exception 'El ingreso % no está aplicado al inventario.', i.numero; end if;
  if i.compra_id is not null and i.compra_id <> c.id then raise exception 'El ingreso % ya se convirtió en otra compra.', i.numero; end if;
  perform set_config('fin.ingreso', 'si', true);
  update public.ingresos_compra set compra_id = c.id where id = i.id;
  perform set_config('fin.ingreso', '', true);
  return jsonb_build_object('ingreso', i.numero, 'compra', c.numero);
end;
$$;

-- Al aplicar un ingreso, la compra que se genera lleva sus artículos.
create or replace function public.procesar_ingreso(p_id bigint, p_accion text, p_generar_compra boolean default true, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  i public.ingresos_compra;
  o public.ordenes_compra;
  pv public.proveedores;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_mal text;
  v_total numeric;
  v_compra bigint;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede procesar ingresos de compra.'; end if;
  select * into i from public.ingresos_compra where id = p_id for update;
  if i.id is null then raise exception 'El ingreso no existe.'; end if;
  select * into o from public.ordenes_compra where id = i.orden_id for update;
  perform set_config('fin.ingreso', 'si', true);

  if p_accion = 'APLICAR' then
    if i.estado <> 'VIGENTE' then raise exception 'El ingreso % ya está %.', i.numero, lower(i.estado); end if;
    if not exists (select 1 from public.ingreso_lineas where ingreso_id = i.id) then raise exception 'El ingreso % no tiene productos.', i.numero; end if;
    select string_agg(p.nombre, ', ') into v_mal
    from (select il.orden_linea_id, sum(il.cantidad) as cant from public.ingreso_lineas il where il.ingreso_id = i.id group by il.orden_linea_id) x
    join public.orden_lineas_saldo s on s.id = x.orden_linea_id join public.productos p on p.id = s.producto_id
    where x.cant > s.saldo;
    if v_mal is not null then raise exception 'Se recibe más de lo pendiente de la orden en: %.', v_mal; end if;
    insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, ingreso_linea_id, lote, fecha_vencimiento, usuario)
    select i.organizacion_id, i.localidad_id, il.producto_id, i.bodega_id, i.fecha_ingreso, il.cantidad, round(il.costo_unitario * public.cambio_a_base(i.moneda_id, i.tipo_cambio), 4), 'INGRESO', il.id, il.lote, il.fecha_vencimiento, v_quien
    from public.ingreso_lineas il where il.ingreso_id = i.id;
    update public.ingreso_lineas set inventariado = true where ingreso_id = i.id;
    -- La factura de compra del ingreso (si hay documento del proveedor).
    if p_generar_compra and i.documento is not null then
      select * into pv from public.proveedores where id = i.proveedor_id;
      select round(sum(il.cantidad * il.costo_unitario), 2) - i.valor_descuento into v_total from public.ingreso_lineas il where il.ingreso_id = i.id;
      insert into public.compras (organizacion_id, localidad_id, numero, tipo_documento, serie, documento, fecha_documento, fecha_ingreso, fecha_vencimiento,
                                  proveedor_id, proveedor_codigo, proveedor_nombre, nit, transaccion_id, descripcion, moneda_id, tipo_cambio, valor_total,
                                  forma_pago, banco_destino_id, cuenta_destino, pago_inmediato, dias_credito, bodega_id, compra_inventario, regimen_isr_id)
      values (i.organizacion_id, i.localidad_id, 0, 'FACTURA', i.serie, i.documento, coalesce(i.fecha_documento, i.fecha_ingreso), i.fecha_ingreso,
              coalesce(i.fecha_documento, i.fecha_ingreso) + i.dias_credito, pv.id, pv.codigo::text, coalesce(pv.nombre_fiscal, pv.nombre_comercial), pv.nit, i.transaccion_id,
              'COMPRA GENERADA AUTOMÁTICAMENTE PARA EL INGRESO ' || i.numero || ' DE LA ORDEN ' || o.numero, i.moneda_id, public.cambio_a_base(i.moneda_id, i.tipo_cambio), v_total,
              pv.forma_pago, pv.banco_id, pv.cuenta_bancaria, i.forma_pago = 'CONTADO', i.dias_credito, i.bodega_id, i.numero::text, pv.regimen_isr_id)
      returning id into v_compra;
      -- La compra lleva los artículos del ingreso (ya están en inventario por el ingreso).
      insert into public.compra_articulos (compra_id, linea, producto_id, serie, cantidad, costo_unitario, inventario, ingreso_linea_id)
      select v_compra, row_number() over (order by il.linea), il.producto_id, il.lote, il.cantidad, il.costo_unitario, true, il.id
      from public.ingreso_lineas il where il.ingreso_id = i.id;
    end if;
    update public.ingresos_compra set estado = 'APLICADO', aplicado_por = v_quien, aplicado_en = now(), compra_id = v_compra where id = i.id;
    perform public.recalcular_orden(o.id);
  elsif p_accion = 'REVERTIR' then
    if i.estado <> 'APLICADO' then raise exception 'Solo se revierte un ingreso aplicado.'; end if;
    if i.compra_id is not null then
      if exists (select 1 from public.compras_saldo s where s.id = i.compra_id and s.pagado > 0) then raise exception 'La compra del ingreso ya tiene pagos: anúlalos primero.'; end if;
      if exists (select 1 from public.compras c join public.partidas p on p.id = c.partida_id and p.estado = 'VIGENTE' where c.id = i.compra_id) then raise exception 'La compra del ingreso ya tiene partida: anúlala primero.'; end if;
      perform set_config('fin.compra', 'si', true);
      update public.compras set estado = 'ANULADA', anulado_por = v_quien, anulado_en = now(), motivo_anulacion = 'Reversión del ingreso ' || i.numero where id = i.compra_id;
      perform set_config('fin.compra', '', true);
    end if;
    delete from public.inventario_movimientos where ingreso_linea_id in (select id from public.ingreso_lineas where ingreso_id = i.id);
    update public.ingreso_lineas set inventariado = false where ingreso_id = i.id;
    update public.ingresos_compra set estado = 'VIGENTE', aplicado_por = null, aplicado_en = null, compra_id = null where id = i.id;
    perform public.recalcular_orden(o.id);
  elsif p_accion = 'ANULAR' then
    if i.estado <> 'VIGENTE' then raise exception 'Solo se anula un ingreso vigente (revierte primero el inventario).'; end if;
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la anulación.'; end if;
    update public.ingresos_compra set estado = 'ANULADO', anulado_por = v_quien, anulado_en = now(), motivo_anulacion = trim(p_motivo) where id = i.id;
  else
    raise exception 'Acción no válida.';
  end if;
  perform set_config('fin.ingreso', '', true);
  return jsonb_build_object('numero', i.numero, 'compra', (select c.numero from public.compras c where c.id = v_compra));
end;
$$;


-- ---------- Seguridad ----------
alter table public.compra_articulos enable row level security;
drop policy if exists "compra_articulos: leer" on public.compra_articulos;
drop policy if exists "compra_articulos: crear" on public.compra_articulos;
drop policy if exists "compra_articulos: modificar" on public.compra_articulos;
drop policy if exists "compra_articulos: quitar" on public.compra_articulos;
create policy "compra_articulos: leer" on public.compra_articulos for select to authenticated using (public.usuario_activo());
create policy "compra_articulos: crear" on public.compra_articulos for insert to authenticated with check (public.puede_editar_catalogos());
create policy "compra_articulos: modificar" on public.compra_articulos for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());
create policy "compra_articulos: quitar" on public.compra_articulos for delete to authenticated using (public.puede_editar_catalogos());
grant select, insert, update, delete on public.compra_articulos to authenticated;
revoke execute on function public.validar_compra_articulo() from public, anon, authenticated;
revoke execute on function public.cargar_inventario_compra(bigint, text) from public, anon;
revoke execute on function public.vincular_ingreso_compra(bigint, bigint) from public, anon;
grant execute on function public.cargar_inventario_compra(bigint, text) to authenticated;
grant execute on function public.cambio_a_base(bigint, numeric) to authenticated;
grant execute on function public.vincular_ingreso_compra(bigint, bigint) to authenticated;

-- ---------- Menú: «Facturas de compra» pasa a «Ingreso de compras» ----------
update public.opciones_sistema o set nombre = 'Ingreso de compras'
from public.modulos_sistema m
where m.id = o.modulo_id and m.siglas = 'COM' and m.modulo_mayor_id is null and o.clave = 'facturas-compra';

notify pgrst, 'reload schema';
