-- Notas electrónicas de venta (crédito, débito y abono) y anulación de documentos DTE (Facturación/Ventas · Registros).
-- Se ejecuta después de los scripts 130 (facturas de venta), 132 (recibos) y 133.
--   notas_venta: la nota con su número interno (NC-n, uno solo por empresa para los tres tipos), datos FEL
--   (autorización, serie, DTE, emisión y certificación), cliente, vendedor, bodega destino, factura de referencia,
--   tipo de ajuste y motivo. nota_venta_lineas: sus productos (con lote, registro sanitario y fechas) y
--   nota_venta_contable: su detalle contable (con montos MI).
--   Efecto en la factura de referencia: las notas de crédito y de abono vigentes bajan su saldo; las de débito lo suben
--   (facturas_venta.notas_credito y notas_debito). Una devolución con «Inv.» regresa los productos a la bodega destino
--   (movimiento NOTA en el kardex).
--   anulaciones_dte: anulación de una factura o una nota (quién, cuándo, motivo) y la factura nueva si se duplicó.
--   Menú: Facturación electrónica, Notas de crédito, de débito y de abono electrónicas y Anulación de documentos DTE,
--   con los permisos de «Facturas Ventas».
-- Puede ejecutarse de nuevo.

do $$
begin
  if to_regclass('public.facturas_venta') is null then raise exception 'Falta ejecutar el script 130 (facturas de venta).'; end if;
end;
$$;

create table if not exists public.notas_venta (
  id                   bigint generated always as identity primary key,
  organizacion_id      bigint not null references public.organizaciones(id),
  localidad_id         bigint not null references public.localidades(id),
  numero               integer,
  tipo                 text not null check (tipo in ('CRÉDITO', 'DÉBITO', 'ABONO')),
  tipo_documento       text,
  autorizacion         text,
  serie                text,
  numero_dte           text,
  fecha_emision        timestamptz not null default now(),
  fecha_certificacion  timestamptz,
  estado               text not null default 'EMITIDA' check (estado in ('EMITIDA', 'CERTIFICADA', 'ANULADA')),
  moneda_id            bigint references public.monedas(id),
  tipo_cambio          numeric(12, 5) not null default 1,
  valor                numeric(18, 2) not null default 0,
  valor_mi             numeric(18, 2) not null default 0,
  cantidad_total       numeric(18, 4) not null default 0,
  cliente_id           bigint references public.clientes(id) on delete set null,
  cliente_codigo       text,
  nombre               text not null,
  nit                  text,
  nit_externo          text,
  contacto             text,
  telefono             text,
  correo               text,
  direccion            text,
  direccion_envio      text,
  vendedor_id          bigint references public.vendedores(id) on delete set null,
  bodega_id            bigint references public.bodegas(id) on delete set null,
  factura_id           bigint references public.facturas_venta(id) on delete set null,
  clasificacion        text not null default 'BIENES' check (clasificacion in ('BIENES', 'SERVICIOS', 'BIENES Y SERVICIOS')),
  exento_iva           boolean not null default false,
  tipo_ajuste          text not null default 'DESCUENTO' check (tipo_ajuste in ('DESCUENTO', 'DEVOLUCIÓN', 'BONIFICACIÓN', 'CORRECCIÓN DE PRECIO', 'INTERESES', 'OTRO')),
  asignar_saldo        boolean not null default false,
  motivo               text,
  usuario              text,
  anulada_por          text,
  anulada_en           timestamptz,
  motivo_anulacion     text,
  origen_anterior      text,
  creado_por           uuid default auth.uid(),
  creado_en            timestamptz not null default now(),
  modificado_por_nombre text,
  modificado_en        timestamptz
);
create unique index if not exists notas_venta_numero on public.notas_venta (localidad_id, numero) where numero is not null;
create index if not exists notas_venta_factura on public.notas_venta (factura_id);
create index if not exists notas_venta_fecha on public.notas_venta (localidad_id, fecha_emision);

create table if not exists public.nota_venta_lineas (
  id                 bigint generated always as identity primary key,
  nota_id            bigint not null references public.notas_venta(id) on delete cascade,
  linea              integer not null check (linea > 0),
  producto_id        bigint references public.productos(id) on delete set null,
  producto_codigo    text,
  descripcion        text not null,
  tipo               text not null default 'BIEN' check (tipo in ('BIEN', 'SERVICIO')),
  cantidad           numeric(18, 4) not null default 1 check (cantidad >= 0),
  precio             numeric(18, 6) not null default 0,
  total              numeric(18, 2) not null default 0,
  precio_mi          numeric(18, 6) not null default 0,
  total_mi           numeric(18, 2) not null default 0,
  inventario         boolean not null default false,
  unidad_medida      text,
  lote               text,
  registro_sanitario text,
  fecha_vencimiento  date,
  fecha_fabricacion  date,
  unique (nota_id, linea)
);
create table if not exists public.nota_venta_contable (
  id         bigint generated always as identity primary key,
  nota_id    bigint not null references public.notas_venta(id) on delete cascade,
  linea      integer not null check (linea > 0),
  cuenta_id  bigint not null references public.cuentas(id),
  centro_id  bigint references public.centros_costo(id),
  concepto   text,
  debe       numeric(18, 2) not null default 0 check (debe >= 0),
  haber      numeric(18, 2) not null default 0 check (haber >= 0),
  debe_mi    numeric(18, 2),
  haber_mi   numeric(18, 2),
  check (debe = 0 or haber = 0),
  unique (nota_id, linea)
);

create table if not exists public.anulaciones_dte (
  id                   bigint generated always as identity primary key,
  organizacion_id      bigint not null references public.organizaciones(id),
  localidad_id         bigint not null references public.localidades(id),
  numero               integer,
  documento            text not null check (documento in ('FACTURA', 'NOTA')),
  factura_id           bigint references public.facturas_venta(id) on delete set null,
  nota_id              bigint references public.notas_venta(id) on delete set null,
  tipo_documento       text,
  fecha_emision        timestamptz not null default now(),
  fecha_certificacion  timestamptz,
  estado               text not null default 'ANULADA' check (estado in ('ANULADA')),
  moneda_id            bigint references public.monedas(id),
  valor                numeric(18, 2) not null default 0,
  valor_mi             numeric(18, 2) not null default 0,
  cliente_id           bigint references public.clientes(id) on delete set null,
  cliente_codigo       text,
  nombre               text,
  nit                  text,
  correo               text,
  motivo               text not null,
  usuario              text,
  factura_nueva_id     bigint references public.facturas_venta(id) on delete set null,
  creado_en            timestamptz not null default now()
);
create unique index if not exists anulaciones_dte_numero on public.anulaciones_dte (localidad_id, numero) where numero is not null;

-- Efecto de las notas en la factura y movimiento NOTA del kardex para las devoluciones.
alter table public.facturas_venta add column if not exists notas_credito numeric(18, 2) not null default 0;
alter table public.facturas_venta add column if not exists notas_debito numeric(18, 2) not null default 0;
alter table public.inventario_movimientos add column if not exists nota_venta_linea_id bigint references public.nota_venta_lineas(id) on delete cascade;

-- Saldo de la factura = total − retenciones − pagos − notas de crédito y abono + notas de débito.
create or replace function public.recalcular_factura_venta(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  f public.facturas_venta;
  v_total numeric; v_mi numeric; v_cant numeric; v_pag numeric; v_iva numeric; v_nc numeric; v_nd numeric;
begin
  select * into f from public.facturas_venta where id = p_id;
  if f.id is null then return; end if;
  select coalesce(sum(valor), 0) into v_pag from public.factura_venta_pagos where factura_id = p_id;
  select coalesce(sum(valor) filter (where tipo in ('CRÉDITO', 'ABONO')), 0), coalesce(sum(valor) filter (where tipo = 'DÉBITO'), 0)
    into v_nc, v_nd from public.notas_venta where factura_id = p_id and estado <> 'ANULADA';
  perform set_config('fin.factura', 'si', true);
  if f.origen_anterior = 'MIGRADO' then
    update public.facturas_venta set pagado = v_pag, notas_credito = v_nc, notas_debito = v_nd,
      saldo = case when f.estado = 'ANULADA' then 0 else greatest(f.total + v_nd - coalesce(f.monto_retencion_iva, 0) - coalesce(f.monto_retencion_isr, 0) - v_pag - v_nc, 0) end
    where id = p_id;
    perform set_config('fin.factura', '', true);
    return;
  end if;
  select coalesce(sum(total), 0), coalesce(sum(total_mi), 0), coalesce(sum(cantidad), 0) into v_total, v_mi, v_cant from public.factura_venta_lineas where factura_id = p_id;
  v_iva := case when f.exento_iva then 0 else round(v_total * 12 / 112, 2) end;
  update public.facturas_venta set total = v_total, total_mi = v_mi, cantidad_total = v_cant, iva = v_iva, pagado = v_pag, notas_credito = v_nc, notas_debito = v_nd,
    monto_retencion_iva = case when f.agente_retenedor then round(v_iva * f.pct_retencion_iva / 100, 2) else 0 end,
    saldo = case when f.estado = 'ANULADA' then 0 else greatest(v_total + v_nd - (case when f.agente_retenedor then round(v_iva * f.pct_retencion_iva / 100, 2) else 0 end) - f.monto_retencion_isr - v_pag - v_nc, 0) end
  where id = p_id;
  perform set_config('fin.factura', '', true);
  delete from public.inventario_movimientos where factura_linea_id in (select id from public.factura_venta_lineas where factura_id = p_id);
  if f.estado = 'FACTURADA' and f.bodega_id is not null then
    insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, lote, fecha_vencimiento, usuario, factura_linea_id)
    select f.organizacion_id, f.localidad_id, l.producto_id, f.bodega_id, f.fecha_emision::date, -l.cantidad, coalesce(p.precio_costo, 0), 'VENTA', l.lote, l.fecha_vencimiento, f.usuario, l.id
    from public.factura_venta_lineas l join public.productos p on p.id = l.producto_id
    where l.factura_id = p_id and l.inventario and l.tipo = 'BIEN';
  end if;
end;
$$;

-- Total de la nota desde sus líneas, su kardex de devolución y el saldo de su factura.
create or replace function public.recalcular_nota_venta(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.notas_venta; v_total numeric; v_mi numeric; v_cant numeric;
begin
  select * into n from public.notas_venta where id = p_id;
  if n.id is null then return; end if;
  select coalesce(sum(total), 0), coalesce(sum(total_mi), 0), coalesce(sum(cantidad), 0) into v_total, v_mi, v_cant from public.nota_venta_lineas where nota_id = p_id;
  if exists (select 1 from public.nota_venta_lineas where nota_id = p_id) or n.origen_anterior is null then
    update public.notas_venta set valor = v_total, valor_mi = v_mi, cantidad_total = v_cant where id = p_id and (valor, valor_mi, cantidad_total) is distinct from (v_total, v_mi, v_cant);
  end if;
  delete from public.inventario_movimientos where nota_venta_linea_id in (select id from public.nota_venta_lineas where nota_id = p_id);
  if n.estado <> 'ANULADA' and n.tipo in ('CRÉDITO', 'ABONO') and n.tipo_ajuste = 'DEVOLUCIÓN' and n.bodega_id is not null and n.origen_anterior is distinct from 'MIGRADO' then
    insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, lote, fecha_vencimiento, usuario, nota_venta_linea_id)
    select n.organizacion_id, n.localidad_id, l.producto_id, n.bodega_id, n.fecha_emision::date, l.cantidad, coalesce(p.precio_costo, 0), 'NOTA', l.lote, l.fecha_vencimiento, n.usuario, l.id
    from public.nota_venta_lineas l join public.productos p on p.id = l.producto_id
    where l.nota_id = p_id and l.inventario and l.tipo = 'BIEN' and l.cantidad > 0;
  end if;
  if n.factura_id is not null then perform public.recalcular_factura_venta(n.factura_id); end if;
end;
$$;

create or replace function public.preparar_nota_venta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.numero is null then
    perform pg_advisory_xact_lock(hashtext('notas_venta'), new.localidad_id::int);
    select coalesce(max(numero), 0) + 1 into new.numero from public.notas_venta where localidad_id = new.localidad_id;
  end if;
  new.nombre := upper(trim(new.nombre));
  new.nit := nullif(upper(replace(trim(new.nit), ' ', '')), '');
  new.serie := nullif(upper(trim(new.serie)), '');
  new.estado := case when new.estado = 'ANULADA' then 'ANULADA' when nullif(trim(new.autorizacion), '') is not null then 'CERTIFICADA' else 'EMITIDA' end;
  return new;
end;
$$;
create or replace function public.preparar_linea_nota_venta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n public.notas_venta;
begin
  select * into n from public.notas_venta where id = new.nota_id;
  new.descripcion := upper(trim(new.descripcion));
  new.total := round(new.cantidad * new.precio, 2);
  new.precio_mi := case when coalesce(n.tipo_cambio, 1) > 0 then round(new.precio / n.tipo_cambio, 6) else new.precio end;
  new.total_mi := case when coalesce(n.tipo_cambio, 1) > 0 then round(new.total / n.tipo_cambio, 2) else new.total end;
  return new;
end;
$$;
create or replace function public.totalizar_nota_venta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'notas_venta' then
    if tg_op = 'DELETE' then
      if old.factura_id is not null then perform public.recalcular_factura_venta(old.factura_id); end if;
      return null;
    end if;
    if pg_trigger_depth() > 1 and tg_op = 'UPDATE' and new.factura_id is not distinct from old.factura_id and new.estado = old.estado then return null; end if;
    perform public.recalcular_nota_venta(new.id);
    if tg_op = 'UPDATE' and old.factura_id is distinct from new.factura_id and old.factura_id is not null then perform public.recalcular_factura_venta(old.factura_id); end if;
    return null;
  end if;
  perform public.recalcular_nota_venta(coalesce(new.nota_id, old.nota_id));
  return null;
end;
$$;

drop trigger if exists notas_venta_preparar on public.notas_venta;
create trigger notas_venta_preparar before insert or update on public.notas_venta for each row execute function public.preparar_nota_venta();
drop trigger if exists notas_venta_totalizar on public.notas_venta;
create trigger notas_venta_totalizar after insert or update or delete on public.notas_venta for each row execute function public.totalizar_nota_venta();
drop trigger if exists nota_venta_lineas_preparar on public.nota_venta_lineas;
create trigger nota_venta_lineas_preparar before insert or update on public.nota_venta_lineas for each row execute function public.preparar_linea_nota_venta();
drop trigger if exists nota_venta_lineas_totalizar on public.nota_venta_lineas;
create trigger nota_venta_lineas_totalizar after insert or update or delete on public.nota_venta_lineas for each row execute function public.totalizar_nota_venta();

create or replace function public.numerar_anulacion_dte() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.numero is null then
    perform pg_advisory_xact_lock(hashtext('anulaciones_dte'), new.localidad_id::int);
    select coalesce(max(numero), 0) + 1 into new.numero from public.anulaciones_dte where localidad_id = new.localidad_id;
  end if;
  return new;
end;
$$;
drop trigger if exists anulaciones_dte_numerar on public.anulaciones_dte;
create trigger anulaciones_dte_numerar before insert on public.anulaciones_dte for each row execute function public.numerar_anulacion_dte();

-- Seguridad: leer con usuario activo; crear, modificar y quitar, un administrador.
do $$
declare t text;
begin
  foreach t in array array['notas_venta', 'nota_venta_lineas', 'nota_venta_contable', 'anulaciones_dte'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('drop policy if exists "%s: modificar" on public.%I', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
    execute format('drop policy if exists "%s: quitar" on public.%I', t, t);
    execute format('create policy "%s: quitar" on public.%I for delete to authenticated using (public.puede_editar_catalogos())', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;
revoke all on function public.recalcular_nota_venta(bigint) from public, anon;
grant execute on function public.recalcular_nota_venta(bigint) to authenticated;

-- Menú: grupo «Notas electrónicas» debajo de Recibos, con los permisos de «Facturas Ventas».
do $$
declare v_mod bigint; v_fac bigint; v_orden integer; v_id bigint; o record;
begin
  select id, modulo_id into v_fac, v_mod from public.opciones_sistema where grupo = 'registros' and clave = 'facturas-ventas' order by id limit 1;
  if v_fac is null then raise notice 'No existe la opción Facturas Ventas.'; return; end if;
  select max(orden) into v_orden from public.opciones_sistema where modulo_id = v_mod and grupo = 'registros' and clave in ('facturas-ventas', 'consulta-de-facturas', 'recibos', 'consulta-de-recibos');
  for o in select * from (values (1, 'facturacion-electronica', 'Facturación electrónica'), (2, 'notas-de-credito-electronicas', 'Notas de crédito electrónicas'),
      (3, 'notas-de-debito-electronicas', 'Notas de débito electrónicas'), (4, 'notas-de-abono-electronicas', 'Notas de abono electrónicas'),
      (5, 'anulacion-de-documentos-dte', 'Anulación de documentos DTE')) as x(n, clave, nombre) loop
    if not exists (select 1 from public.opciones_sistema where modulo_id = v_mod and grupo = 'registros' and clave = o.clave) then
      update public.opciones_sistema set orden = orden + 1 where modulo_id = v_mod and orden > v_orden + o.n - 1;
      insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
      values (v_mod, 'registros', 'Notas electrónicas', o.clave, o.nombre, v_orden + o.n) returning id into v_id;
      insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
      select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = v_fac
      on conflict do nothing;
    end if;
  end loop;
  raise notice 'Notas electrónicas y Anulación de documentos DTE instaladas.';
end;
$$;

notify pgrst, 'reload schema';
