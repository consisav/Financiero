-- Facturación/Ventas · Registros · Facturas Ventas (antes «Facturas») y Consulta de Facturas.
--   facturas_venta: encabezado de la factura (documento electrónico FEL, cliente, venta y crédito, impuestos y cobro).
--   factura_venta_lineas: productos o servicios con cantidad, precio, totales en quetzales y en la moneda de integración,
--     unidad, lote, registro sanitario y fechas de vencimiento y fabricación; «inventario» indica si descarga el kardex.
--   factura_venta_contable: detalle contable de la factura (cuenta, centro, concepto, debe y haber).
--   factura_venta_pagos: pagos aplicados a la factura (forma, documento, banco y valor).
--   Totales, IVA y saldo se calculan solos (recalcular_factura_venta). Una factura FACTURADA descarga del inventario las
--   líneas marcadas (movimiento VENTA con cantidad negativa en la bodega de la factura); al anularla, el movimiento se quita.
--   El número interno es correlativo por empresa. La certificación FEL (número de autorización) queda registrada a mano
--   hasta conectar el certificador autorizado.
-- Puede ejecutarse de nuevo.

create table if not exists public.facturas_venta (
  id                 bigint generated always as identity primary key,
  organizacion_id    bigint not null references public.organizaciones(id),
  localidad_id       bigint not null,
  numero             integer not null,
  tipo_factura       text not null default 'FACTURA NORMAL' check (tipo_factura in ('FACTURA NORMAL', 'FACTURA CAMBIARIA', 'FACTURA ESPECIAL', 'FACTURA DE EXPORTACIÓN', 'FACTURA PEQUEÑO CONTRIBUYENTE')),
  tipo_dte           text not null default 'FACT' check (tipo_dte in ('FACT', 'FCAM', 'FESP', 'FPEQ', 'FEXP')),
  tipo_documento     text,
  serie              text,
  numero_dte         text,
  autorizacion       text,
  fecha_emision      timestamptz not null default now(),
  fecha_certificacion timestamptz,
  estado             text not null default 'FACTURADA' check (estado in ('FACTURADA', 'ANULADA')),
  moneda_id          bigint not null references public.monedas(id),
  tipo_cambio        numeric(18, 8) not null default 1 check (tipo_cambio > 0),
  cliente_id         bigint references public.clientes(id) on delete set null,
  cliente_codigo     integer,
  nombre             text not null check (length(trim(nombre)) > 0),
  nit                text,
  consumidor_final   boolean not null default false,
  nit_externo        text,
  contacto           text,
  telefono           text,
  correo             text,
  direccion          text,
  direccion_envio    text,
  lab_fab            text,
  generico           boolean not null default false,
  vendedor_id        bigint references public.vendedores(id) on delete set null,
  tipo_precio_id     bigint references public.tipos_precio(id) on delete set null,
  bodega_id          bigint references public.bodegas(id) on delete set null,
  forma_pago         text not null default 'CONTADO' check (forma_pago in ('CONTADO', 'CRÉDITO')),
  dias_credito       integer not null default 0 check (dias_credito between 0 and 365),
  contrasena         text,
  fecha_cobro        date,
  modo_entrega       text,
  unificar_productos boolean not null default false,
  exento_iva         boolean not null default false,
  agente_retenedor   boolean not null default false,
  pct_retencion_iva  numeric(6, 2) not null default 0 check (pct_retencion_iva between 0 and 100),
  monto_retencion_iva numeric(18, 2) not null default 0,
  retencion_isr      boolean not null default false,
  monto_retencion_isr numeric(18, 2) not null default 0,
  clasificacion      text not null default 'BIENES' check (clasificacion in ('BIENES', 'SERVICIOS', 'BIENES Y SERVICIOS')),
  cuenta_por_cobrar  text not null default 'C X C',
  incoterm           text,
  observaciones      text,
  total              numeric(18, 2) not null default 0,
  total_mi           numeric(18, 2) not null default 0,
  iva                numeric(18, 2) not null default 0,
  pagado             numeric(18, 2) not null default 0,
  saldo              numeric(18, 2) not null default 0,
  cantidad_total     numeric(18, 4) not null default 0,
  usuario            text,
  anulada_por        text,
  anulada_en         timestamptz,
  motivo_anulacion   text,
  partida_id         bigint references public.partidas(id) on delete set null,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades(id, organizacion_id),
  unique (localidad_id, numero)
);
create index if not exists facturas_venta_fecha_idx on public.facturas_venta (localidad_id, fecha_emision);
create index if not exists facturas_venta_cliente_idx on public.facturas_venta (cliente_id);

create table if not exists public.factura_venta_lineas (
  id                 bigint generated always as identity primary key,
  factura_id         bigint not null references public.facturas_venta(id) on delete cascade,
  linea              integer not null check (linea > 0),
  producto_id        bigint references public.productos(id) on delete set null,
  producto_codigo    integer,
  descripcion        text not null check (length(trim(descripcion)) > 0),
  tipo               text not null default 'BIEN' check (tipo in ('BIEN', 'SERVICIO')),
  cantidad           numeric(18, 4) not null check (cantidad > 0),
  precio             numeric(18, 6) not null default 0 check (precio >= 0),
  total              numeric(18, 2) not null default 0,
  precio_mi          numeric(18, 6) not null default 0,
  total_mi           numeric(18, 2) not null default 0,
  inventario         boolean not null default true,
  cpa                boolean not null default false,
  fecha_compromiso   date,
  unidad_medida      text,
  lote               text,
  registro_sanitario text,
  fecha_vencimiento  date,
  fecha_fabricacion  date,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (factura_id, linea)
);
create table if not exists public.factura_venta_contable (
  id          bigint generated always as identity primary key,
  factura_id  bigint not null references public.facturas_venta(id) on delete cascade,
  linea       integer not null check (linea > 0),
  cuenta_id   bigint not null references public.cuentas(id),
  centro_id   bigint references public.centros_costo(id),
  concepto    text,
  debe        numeric(18, 2) not null default 0 check (debe >= 0),
  haber       numeric(18, 2) not null default 0 check (haber >= 0),
  check (debe = 0 or haber = 0),
  unique (factura_id, linea)
);
create table if not exists public.factura_venta_pagos (
  id          bigint generated always as identity primary key,
  factura_id  bigint not null references public.facturas_venta(id) on delete cascade,
  fecha       date not null default current_date,
  forma       text not null default 'EFECTIVO' check (forma in ('EFECTIVO', 'CHEQUE', 'DEPÓSITO', 'TRANSFERENCIA', 'TARJETA', 'NOTA DE CRÉDITO')),
  documento   text,
  banco       text,
  valor       numeric(18, 2) not null check (valor > 0),
  usuario     text,
  creado_en   timestamptz not null default now()
);

-- Venta en el kardex: salida con cantidad negativa ligada a la línea de la factura.
alter table public.inventario_movimientos add column if not exists factura_linea_id bigint references public.factura_venta_lineas(id) on delete cascade;
alter table public.inventario_movimientos drop constraint if exists inventario_movimientos_origen_check;
alter table public.inventario_movimientos add constraint inventario_movimientos_origen_check
  check (origen in ('INGRESO', 'COMPRA', 'NOTA', 'CONSIGNACIÓN', 'AJUSTE', 'DESPACHO', 'TRASLADO', 'VENTA'));

-- Número interno correlativo por empresa, mayúsculas y usuario.
create or replace function public.preparar_factura_venta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.numero is null or new.numero <= 0 then
      perform pg_advisory_xact_lock(4823, new.localidad_id::integer);
      new.numero := coalesce((select max(numero) from public.facturas_venta where localidad_id = new.localidad_id), 0) + 1;
    end if;
    new.usuario := coalesce(new.usuario, (select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  else
    new.organizacion_id := old.organizacion_id; new.localidad_id := old.localidad_id; new.numero := old.numero; new.usuario := old.usuario;
    if old.estado = 'ANULADA' and new.estado = 'ANULADA' and current_setting('fin.factura', true) is distinct from 'si' then
      raise exception 'La factura % está anulada: ya no se modifica.', old.numero;
    end if;
  end if;
  if new.forma_pago = 'CONTADO' then new.dias_credito := 0; end if;
  new.nombre := upper(trim(new.nombre));
  new.nit := case when new.consumidor_final then 'CF' else nullif(upper(replace(trim(new.nit), ' ', '')), '') end;
  new.serie := nullif(upper(trim(new.serie)), '');
  return new;
end;
$$;

-- Totales, IVA, retenciones, pagos y saldo; y el inventario de las líneas marcadas.
create or replace function public.recalcular_factura_venta(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  f public.facturas_venta;
  v_total numeric; v_mi numeric; v_cant numeric; v_pag numeric; v_iva numeric;
begin
  select * into f from public.facturas_venta where id = p_id;
  if f.id is null then return; end if;
  select coalesce(sum(total), 0), coalesce(sum(total_mi), 0), coalesce(sum(cantidad), 0) into v_total, v_mi, v_cant from public.factura_venta_lineas where factura_id = p_id;
  select coalesce(sum(valor), 0) into v_pag from public.factura_venta_pagos where factura_id = p_id;
  v_iva := case when f.exento_iva then 0 else round(v_total * 12 / 112, 2) end;
  perform set_config('fin.factura', 'si', true);
  update public.facturas_venta set total = v_total, total_mi = v_mi, cantidad_total = v_cant, iva = v_iva, pagado = v_pag,
    monto_retencion_iva = case when f.agente_retenedor then round(v_iva * f.pct_retencion_iva / 100, 2) else 0 end,
    saldo = case when f.estado = 'ANULADA' then 0 else greatest(v_total - (case when f.agente_retenedor then round(v_iva * f.pct_retencion_iva / 100, 2) else 0 end) - f.monto_retencion_isr - v_pag, 0) end
  where id = p_id;
  perform set_config('fin.factura', '', true);
  -- Inventario: se rehace la salida de cada línea marcada mientras la factura esté facturada.
  delete from public.inventario_movimientos where factura_linea_id in (select id from public.factura_venta_lineas where factura_id = p_id);
  if f.estado = 'FACTURADA' and f.bodega_id is not null then
    insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, lote, fecha_vencimiento, usuario, factura_linea_id)
    select f.organizacion_id, f.localidad_id, l.producto_id, f.bodega_id, f.fecha_emision::date, -l.cantidad, coalesce(p.precio_costo, 0), 'VENTA', l.lote, l.fecha_vencimiento, f.usuario, l.id
    from public.factura_venta_lineas l join public.productos p on p.id = l.producto_id
    where l.factura_id = p_id and l.inventario and l.tipo = 'BIEN';
  end if;
end;
$$;

create or replace function public.totalizar_factura_venta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'facturas_venta' then
    if tg_op = 'INSERT' or new.exento_iva is distinct from old.exento_iva or new.agente_retenedor is distinct from old.agente_retenedor
       or new.pct_retencion_iva is distinct from old.pct_retencion_iva or new.monto_retencion_isr is distinct from old.monto_retencion_isr
       or new.estado is distinct from old.estado or new.bodega_id is distinct from old.bodega_id or new.fecha_emision is distinct from old.fecha_emision then
      perform public.recalcular_factura_venta(new.id);
    end if;
    return null;
  end if;
  perform public.recalcular_factura_venta(coalesce(new.factura_id, old.factura_id));
  return null;
end;
$$;

-- Línea: total en quetzales y en la moneda de integración.
create or replace function public.preparar_linea_factura_venta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare f public.facturas_venta;
begin
  select * into f from public.facturas_venta where id = new.factura_id;
  if f.estado = 'ANULADA' then raise exception 'La factura % está anulada: sus líneas no cambian.', f.numero; end if;
  new.descripcion := upper(trim(new.descripcion));
  new.total := round(new.cantidad * new.precio, 2);
  new.precio_mi := case when coalesce(f.tipo_cambio, 1) > 0 then round(new.precio / f.tipo_cambio, 6) else new.precio end;
  new.total_mi := case when coalesce(f.tipo_cambio, 1) > 0 then round(new.total / f.tipo_cambio, 2) else new.total end;
  return new;
end;
$$;

drop trigger if exists facturas_venta_preparar on public.facturas_venta;
create trigger facturas_venta_preparar before insert or update on public.facturas_venta for each row execute function public.preparar_factura_venta();
drop trigger if exists facturas_venta_auditar on public.facturas_venta;
create trigger facturas_venta_auditar before insert or update on public.facturas_venta for each row execute function public.auditar();
drop trigger if exists facturas_venta_totalizar on public.facturas_venta;
create trigger facturas_venta_totalizar after insert or update on public.facturas_venta for each row execute function public.totalizar_factura_venta();
drop trigger if exists factura_venta_lineas_preparar on public.factura_venta_lineas;
create trigger factura_venta_lineas_preparar before insert or update on public.factura_venta_lineas for each row execute function public.preparar_linea_factura_venta();
drop trigger if exists factura_venta_lineas_auditar on public.factura_venta_lineas;
create trigger factura_venta_lineas_auditar before insert or update on public.factura_venta_lineas for each row execute function public.auditar();
drop trigger if exists factura_venta_lineas_totalizar on public.factura_venta_lineas;
create trigger factura_venta_lineas_totalizar after insert or update or delete on public.factura_venta_lineas for each row execute function public.totalizar_factura_venta();
drop trigger if exists factura_venta_pagos_totalizar on public.factura_venta_pagos;
create trigger factura_venta_pagos_totalizar after insert or update or delete on public.factura_venta_pagos for each row execute function public.totalizar_factura_venta();

-- Seguridad: leer con usuario activo; crear, modificar y quitar, un administrador.
do $$
declare t text;
begin
  foreach t in array array['facturas_venta', 'factura_venta_lineas', 'factura_venta_contable', 'factura_venta_pagos'] loop
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
revoke all on function public.recalcular_factura_venta(bigint) from public, anon;
grant execute on function public.recalcular_factura_venta(bigint) to authenticated;

-- Menú: «Facturas» pasa a «Facturas Ventas» y debajo va «Consulta de Facturas» (con los permisos de ver e imprimir).
do $$
declare v_mod bigint; v_orden integer; v_id bigint; v_fac bigint;
begin
  select id, modulo_id, orden into v_fac, v_mod, v_orden from public.opciones_sistema where grupo = 'registros' and clave in ('facturas', 'facturas-ventas') order by id limit 1;
  if v_fac is null then raise notice 'No existe la opción Facturas.'; return; end if;
  update public.opciones_sistema set clave = 'facturas-ventas', nombre = 'Facturas Ventas', subgrupo = 'Ventas' where id = v_fac;
  if not exists (select 1 from public.opciones_sistema where modulo_id = v_mod and grupo = 'registros' and clave = 'consulta-de-facturas') then
    update public.opciones_sistema set orden = orden + 1 where orden > v_orden;
    insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
    values (v_mod, 'registros', 'Ventas', 'consulta-de-facturas', 'Consulta de Facturas', v_orden + 1) returning id into v_id;
    insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
    select a.rol_id, v_id, a.ver, false, false, false, a.imprimir from public.rol_accesos a where a.opcion_id = v_fac
    on conflict do nothing;
  end if;
  raise notice 'Facturas Ventas y Consulta de Facturas instaladas.';
end;
$$;

notify pgrst, 'reload schema';
