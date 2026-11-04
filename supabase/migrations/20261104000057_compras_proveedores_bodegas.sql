-- Compras · Catálogos y registros.
--   tipos_proveedor y regimenes_isr: catálogos generales (con valores iniciales).
--   bodegas: las bodegas de cada localidad (número correlativo, nombre, tipo general o sub-bodega,
--   bodega mayor, dirección, siglas, carga directa, consignación, licitación, ventas, modalidad
--   normal / consignación / cuenta ajena, encargado, tipo de precio, estado y sus definiciones
--   contables: las transacciones de entradas, ajustes, despachos y traslados, sus reversiones y la
--   cuenta de producto terminado).
--   proveedores: los proveedores de cada localidad (código correlativo, NIT, nombre comercial,
--   fiscal y de emisión, dirección, concepto de gastos, teléfonos, contacto, nacional, servicio
--   crítico, pendiente de revisar, tipo, régimen ISR, bodega y estado), sus datos contables (días de
--   crédito, retención, cuenta de gastos, varias cuentas, dónde se visualiza, transacción y
--   transacción de exenciones) y sus datos de pago (forma, banco, cuenta, tipo y titular,
--   beneficiario y correo). proveedor_cuentas: sus cuentas cuando son varias.
--   compras (Facturas de compra): el proveedor del catálogo, tipo de documento (DTE), mes y año de
--   presentación, pago inmediato y días de crédito, contraseña de pago, factura original, régimen
--   ISR, clasificación, tipo de operación, rubro, bodega, combustibles (IDP), exento, gastos no
--   deducibles, IVA e ISR especial, INGUAT, turismo ITP, IVA de importación, DAI, valor por cuenta
--   ajena, retención (formulario, valor y fecha), IVA y base calculados, compra de inventario y
--   orden de compra. compra_items: el detalle de la compra (descripción, cantidad y costo).
--   Son las mismas compras que se pagan en Generación cheques y Generación transferencias.
-- Escribir: administrador. Se ejecuta después del script 56 (usa cuenta_de_localidad del 54).

-- ---------- Catálogos generales ----------
create table if not exists public.tipos_proveedor (
  id     bigint generated always as identity primary key,
  codigo integer not null unique check (codigo > 0),
  nombre text not null unique check (length(trim(nombre)) > 0),
  activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.regimenes_isr (
  id     bigint generated always as identity primary key,
  codigo integer not null unique check (codigo > 0),
  nombre text not null unique check (length(trim(nombre)) > 0),
  activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
insert into public.tipos_proveedor (codigo, nombre) values
  (1, 'PROVEEDOR LOCAL'), (2, 'PROVEEDOR DEL EXTERIOR'), (3, 'PROVEEDOR DE SERVICIOS'), (4, 'ACREEDOR'), (5, 'EMPLEADO')
on conflict do nothing;
insert into public.regimenes_isr (codigo, nombre) values
  (1, 'PEQUEÑO CONTRIBUYENTE'), (2, 'OPCIONAL SIMPLIFICADO (SUJETO A RETENCIÓN)'), (3, 'SUJETO A PAGOS TRIMESTRALES'),
  (4, 'EXENTO'), (5, 'NO DOMICILIADO'), (6, 'IMPORTACIONES')
on conflict do nothing;
drop trigger if exists tipos_proveedor_auditar on public.tipos_proveedor;
create trigger tipos_proveedor_auditar before insert or update on public.tipos_proveedor for each row execute function public.auditar();
drop trigger if exists regimenes_isr_auditar on public.regimenes_isr;
create trigger regimenes_isr_auditar before insert or update on public.regimenes_isr for each row execute function public.auditar();

-- La transacción es de la localidad.
create or replace function public.transaccion_de_localidad(p_trx bigint, p_loc bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_trx is null or exists (select 1 from public.transacciones_contables t where t.id = p_trx and t.localidad_id = p_loc);
$$;

-- ---------- Bodegas ----------
create table if not exists public.bodegas (
  id                  bigint generated always as identity primary key,
  organizacion_id     bigint not null references public.organizaciones (id),
  localidad_id        bigint not null,
  codigo              integer not null check (codigo > 0),
  nombre              text not null check (length(trim(nombre)) > 0),
  tipo                text not null default 'GENERAL' check (tipo in ('GENERAL', 'SUB-BODEGA')),
  bodega_mayor_id     bigint references public.bodegas (id),
  direccion           text,
  siglas              text check (siglas ~ '^[A-Z0-9]{1,6}$'),
  carga_directa       boolean not null default false,
  consignacion        boolean not null default false,
  licitacion          boolean not null default false,
  permite_ventas      boolean not null default false,
  modalidad           text not null default 'NORMAL' check (modalidad in ('NORMAL', 'CONSIGNACIÓN', 'CUENTA AJENA')),
  encargado_codigo    text,
  encargado_nombre    text,
  trx_entradas_id     bigint references public.transacciones_contables (id) on delete set null,
  trx_ajuste_mas_id   bigint references public.transacciones_contables (id) on delete set null,
  trx_ajuste_menos_id bigint references public.transacciones_contables (id) on delete set null,
  trx_despachos_id    bigint references public.transacciones_contables (id) on delete set null,
  trx_traslados_id    bigint references public.transacciones_contables (id) on delete set null,
  rev_traslados_id    bigint references public.transacciones_contables (id) on delete set null,
  rev_ajustes_id      bigint references public.transacciones_contables (id) on delete set null,
  rev_despachos_id    bigint references public.transacciones_contables (id) on delete set null,
  rev_entradas_id     bigint references public.transacciones_contables (id) on delete set null,
  cuenta_pt_id        bigint references public.cuentas (id),
  tipo_precio         text not null default 'DISTRIBUIDOR' check (tipo_precio in ('PÚBLICO', 'MAYORISTA', 'DISTRIBUIDOR', 'INSTITUCIONAL', 'COSTO')),
  estado              text not null default 'ACTIVO' check (estado in ('ACTIVO', 'INACTIVO')),
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, codigo)
);

create or replace function public.preparar_bodega() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m public.bodegas;
begin
  if tg_op = 'INSERT' then
    if new.codigo is null then
      perform pg_advisory_xact_lock(4815, new.localidad_id::integer);
      new.codigo := coalesce((select max(codigo) from public.bodegas where localidad_id = new.localidad_id), 0) + 1;
    end if;
  else
    new.organizacion_id := old.organizacion_id; new.localidad_id := old.localidad_id;
  end if;
  if new.bodega_mayor_id is not null then
    select * into m from public.bodegas where id = new.bodega_mayor_id;
    if m.localidad_id <> new.localidad_id then raise exception 'La bodega mayor debe ser de la misma localidad.'; end if;
    if new.tipo = 'SUB-BODEGA' and (m.id = new.id or m.tipo <> 'GENERAL') then raise exception 'La bodega mayor de una sub-bodega debe ser una bodega general.'; end if;
  elsif new.tipo = 'SUB-BODEGA' then
    raise exception 'Elige la bodega mayor de la sub-bodega.';
  end if;
  if not (public.transaccion_de_localidad(new.trx_entradas_id, new.localidad_id) and public.transaccion_de_localidad(new.trx_ajuste_mas_id, new.localidad_id)
      and public.transaccion_de_localidad(new.trx_ajuste_menos_id, new.localidad_id) and public.transaccion_de_localidad(new.trx_despachos_id, new.localidad_id)
      and public.transaccion_de_localidad(new.trx_traslados_id, new.localidad_id) and public.transaccion_de_localidad(new.rev_traslados_id, new.localidad_id)
      and public.transaccion_de_localidad(new.rev_ajustes_id, new.localidad_id) and public.transaccion_de_localidad(new.rev_despachos_id, new.localidad_id)
      and public.transaccion_de_localidad(new.rev_entradas_id, new.localidad_id)) then
    raise exception 'Las transacciones de la bodega deben ser de la localidad.';
  end if;
  if not public.cuenta_de_localidad(new.cuenta_pt_id, new.localidad_id) then raise exception 'La cuenta PT no es del catálogo de la localidad.'; end if;
  new.nombre := upper(trim(new.nombre));
  new.siglas := nullif(upper(trim(new.siglas)), '');
  new.direccion := nullif(upper(trim(new.direccion)), '');
  new.encargado_codigo := nullif(upper(trim(new.encargado_codigo)), '');
  new.encargado_nombre := nullif(upper(trim(new.encargado_nombre)), '');
  new.consignacion := new.consignacion or new.modalidad = 'CONSIGNACIÓN';
  return new;
end;
$$;
drop trigger if exists bodegas_preparar on public.bodegas;
create trigger bodegas_preparar before insert or update on public.bodegas for each row execute function public.preparar_bodega();
drop trigger if exists bodegas_auditar on public.bodegas;
create trigger bodegas_auditar before insert or update on public.bodegas for each row execute function public.auditar();

-- ---------- Proveedores ----------
create table if not exists public.proveedores (
  id                      bigint generated always as identity primary key,
  organizacion_id         bigint not null references public.organizaciones (id),
  localidad_id            bigint not null,
  codigo                  integer not null check (codigo > 0),
  nit                     text,
  nombre_comercial        text not null check (length(trim(nombre_comercial)) > 0),
  nombre_fiscal           text,
  nombre_emision          text,
  direccion               text,
  concepto_gastos         text not null check (length(trim(concepto_gastos)) > 0),
  telefonos               text,
  extension               text,
  contacto                text,
  correo                  text,
  nacional                boolean not null default true,
  servicio_critico        boolean not null default false,
  pendiente_revisar       boolean not null default false,
  tipo_proveedor_id       bigint references public.tipos_proveedor (id),
  regimen_isr_id          bigint references public.regimenes_isr (id),
  bodega_id               bigint references public.bodegas (id),
  estado                  text not null default 'ACTIVO' check (estado in ('ACTIVO', 'INACTIVO', 'BLOQUEADO')),
  dias_credito            integer not null default 0 check (dias_credito >= 0),
  efectuar_retencion      boolean not null default false,
  cuenta_gasto_id         bigint references public.cuentas (id),
  varias_cuentas          boolean not null default false,
  visualizar_en           text not null default 'AMBAS' check (visualizar_en in ('COMPRAS INVENTARIO', 'COMPRAS VARIAS', 'AMBAS')),
  transaccion_id          bigint references public.transacciones_contables (id) on delete set null,
  transaccion_exencion_id bigint references public.transacciones_contables (id) on delete set null,
  forma_pago              text not null default 'CHEQUE' check (forma_pago in ('CHEQUE', 'TRANSFERENCIA')),
  moneda_id               bigint references public.monedas (id),
  banco_id                bigint references public.bancos (id),
  cuenta_bancaria         text,
  tipo_cuenta             text check (tipo_cuenta in ('MONETARIA', 'AHORRO')),
  titular_cuenta          text,
  beneficiario            text,
  correo_pagos            text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, codigo)
);
create unique index if not exists proveedores_nit_key on public.proveedores (localidad_id, nit)
  where nit is not null and nit not in ('CF', 'C/F');
create index if not exists proveedores_nombre_idx on public.proveedores (localidad_id, nombre_comercial);

create table if not exists public.proveedor_cuentas (
  id           bigint generated always as identity primary key,
  proveedor_id bigint not null references public.proveedores (id) on delete cascade,
  linea        integer not null,
  cuenta_id    bigint not null references public.cuentas (id),
  centro_id    bigint references public.centros_costo (id),
  porcentaje   numeric(6, 2) check (porcentaje is null or porcentaje between 0 and 100),
  descripcion  text,
  unique (proveedor_id, linea)
);

create or replace function public.preparar_proveedor() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.codigo is null then
      perform pg_advisory_xact_lock(4814, new.localidad_id::integer);
      new.codigo := coalesce((select max(codigo) from public.proveedores where localidad_id = new.localidad_id), 0) + 1;
    end if;
  else
    new.organizacion_id := old.organizacion_id; new.localidad_id := old.localidad_id;
  end if;
  if not public.cuenta_de_localidad(new.cuenta_gasto_id, new.localidad_id) then raise exception 'La cuenta de gastos no es del catálogo de la localidad.'; end if;
  if not public.transaccion_de_localidad(new.transaccion_id, new.localidad_id) or not public.transaccion_de_localidad(new.transaccion_exencion_id, new.localidad_id) then
    raise exception 'Las transacciones del proveedor deben ser de la localidad.';
  end if;
  if new.bodega_id is not null and not exists (select 1 from public.bodegas b where b.id = new.bodega_id and b.localidad_id = new.localidad_id) then
    raise exception 'La bodega no es de la localidad del proveedor.';
  end if;
  new.nit := nullif(upper(replace(trim(new.nit), ' ', '')), '');
  new.nombre_comercial := upper(trim(new.nombre_comercial));
  new.nombre_fiscal := coalesce(nullif(upper(trim(new.nombre_fiscal)), ''), new.nombre_comercial);
  new.nombre_emision := coalesce(nullif(upper(trim(new.nombre_emision)), ''), new.nombre_fiscal);
  new.direccion := nullif(upper(trim(new.direccion)), '');
  new.concepto_gastos := upper(trim(new.concepto_gastos));
  new.contacto := nullif(upper(trim(new.contacto)), '');
  new.correo := nullif(lower(trim(new.correo)), '');
  new.correo_pagos := nullif(lower(trim(new.correo_pagos)), '');
  new.cuenta_bancaria := nullif(trim(new.cuenta_bancaria), '');
  new.titular_cuenta := nullif(upper(trim(new.titular_cuenta)), '');
  new.beneficiario := coalesce(nullif(upper(trim(new.beneficiario)), ''), new.nombre_fiscal);
  return new;
end;
$$;
drop trigger if exists proveedores_preparar on public.proveedores;
create trigger proveedores_preparar before insert or update on public.proveedores for each row execute function public.preparar_proveedor();
drop trigger if exists proveedores_auditar on public.proveedores;
create trigger proveedores_auditar before insert or update on public.proveedores for each row execute function public.auditar();

create or replace function public.validar_proveedor_cuenta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_loc bigint := (select localidad_id from public.proveedores where id = new.proveedor_id);
begin
  if not public.cuenta_de_localidad(new.cuenta_id, v_loc) then raise exception 'La cuenta de la línea % no es del catálogo de la localidad.', new.linea; end if;
  if not public.centro_de_localidad(new.centro_id, v_loc) then raise exception 'El centro de la línea % no es del catálogo de la localidad.', new.linea; end if;
  return new;
end;
$$;
drop trigger if exists proveedor_cuentas_validar on public.proveedor_cuentas;
create trigger proveedor_cuentas_validar before insert or update on public.proveedor_cuentas for each row execute function public.validar_proveedor_cuenta();

-- ---------- Facturas de compra: datos fiscales y de control ----------
alter table public.compras
  add column if not exists proveedor_id       bigint references public.proveedores (id),
  add column if not exists tipo_dte           text check (tipo_dte in ('FACTURA ELECTRÓNICA', 'FACTURA CAMBIARIA', 'FACTURA ESPECIAL', 'FACTURA PEQUEÑO CONTRIBUYENTE', 'NOTA DE DÉBITO', 'DUCA (IMPORTACIÓN)', 'RECIBO')),
  add column if not exists mes_presentacion   integer check (mes_presentacion between 1 and 12),
  add column if not exists anio_presentacion  integer check (anio_presentacion between 1900 and 2999),
  add column if not exists pago_inmediato     boolean not null default false,
  add column if not exists dias_credito       integer not null default 0 check (dias_credito >= 0),
  add column if not exists contrasena         integer,
  add column if not exists contrasena_fecha   date,
  add column if not exists factura_original   boolean not null default true,
  add column if not exists regimen_isr_id     bigint references public.regimenes_isr (id),
  add column if not exists clasificacion      text not null default 'BIENES' check (clasificacion in ('BIENES', 'SERVICIOS', 'COMBUSTIBLE', 'IMPORTACIÓN', 'ACTIVOS FIJOS', 'OTROS')),
  add column if not exists tipo_operacion     text not null default 'NO DEFINIDO' check (tipo_operacion in ('NO DEFINIDO', 'COMPRA LOCAL', 'IMPORTACIÓN', 'SERVICIO LOCAL', 'SERVICIO DEL EXTERIOR', 'CUENTA AJENA')),
  add column if not exists rubro_id           bigint references public.rubros_presupuesto (id),
  add column if not exists bodega_id          bigint references public.bodegas (id),
  add column if not exists galones_super      numeric(12, 3) not null default 0 check (galones_super >= 0),
  add column if not exists galones_regular    numeric(12, 3) not null default 0 check (galones_regular >= 0),
  add column if not exists galones_diesel     numeric(12, 3) not null default 0 check (galones_diesel >= 0),
  add column if not exists idp                numeric(18, 2) not null default 0,
  add column if not exists exento             numeric(18, 2) not null default 0 check (exento >= 0),
  add column if not exists no_deducible       numeric(18, 2) not null default 0 check (no_deducible >= 0),
  add column if not exists iva_especial       numeric(18, 2) not null default 0 check (iva_especial >= 0),
  add column if not exists isr_especial       numeric(18, 2) not null default 0 check (isr_especial >= 0),
  add column if not exists aplica_inguat      boolean not null default false,
  add column if not exists inguat             numeric(18, 2) not null default 0 check (inguat >= 0),
  add column if not exists turismo_itp        numeric(18, 2) not null default 0 check (turismo_itp >= 0),
  add column if not exists iva_importacion    numeric(18, 2) not null default 0 check (iva_importacion >= 0),
  add column if not exists dai                numeric(18, 2) not null default 0 check (dai >= 0),
  add column if not exists valor_cuenta_ajena numeric(18, 2) not null default 0 check (valor_cuenta_ajena >= 0),
  add column if not exists retencion          boolean not null default false,
  add column if not exists retencion_formulario text,
  add column if not exists retencion_valor    numeric(18, 2) not null default 0 check (retencion_valor >= 0),
  add column if not exists retencion_fecha    date,
  add column if not exists iva                numeric(18, 2) not null default 0,
  add column if not exists base               numeric(18, 2) not null default 0,
  add column if not exists compra_inventario  text,
  add column if not exists orden_compra       text;
create index if not exists compras_proveedor_idx on public.compras (proveedor_id) where proveedor_id is not null;
create unique index if not exists compras_contrasena_key on public.compras (localidad_id, contrasena) where contrasena is not null;

create table if not exists public.compra_items (
  id          bigint generated always as identity primary key,
  compra_id   bigint not null references public.compras (id) on delete cascade,
  linea       integer not null,
  descripcion text not null check (length(trim(descripcion)) > 0),
  cantidad    numeric(14, 3) not null default 1 check (cantidad > 0),
  costo_total numeric(18, 2) not null default 0 check (costo_total >= 0),
  unique (compra_id, linea)
);

-- Tipo de documento (DTE ↔ factura o recibo), IDP, IVA y base. Corre antes de preparar_compra.
create or replace function public.calcular_compra() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  g public.parametros_generales;
  v_afecto numeric;
  v_pct numeric;
begin
  if new.tipo_dte is null then
    new.tipo_dte := case when new.tipo_documento = 'RECIBO' then 'RECIBO' else 'FACTURA ELECTRÓNICA' end;
  elsif tg_op = 'INSERT' or new.tipo_dte is distinct from old.tipo_dte then
    new.tipo_documento := case when new.tipo_dte = 'RECIBO' then 'RECIBO' else 'FACTURA' end;
  elsif new.tipo_documento is distinct from old.tipo_documento then
    new.tipo_dte := case when new.tipo_documento = 'RECIBO' then 'RECIBO' else 'FACTURA ELECTRÓNICA' end;
  end if;
  if new.proveedor_id is not null and not exists (select 1 from public.proveedores p where p.id = new.proveedor_id and p.localidad_id = new.localidad_id) then
    raise exception 'El proveedor no es de la localidad de la compra.';
  end if;
  if new.bodega_id is not null and not exists (select 1 from public.bodegas b where b.id = new.bodega_id and b.localidad_id = new.localidad_id) then
    raise exception 'La bodega no es de la localidad de la compra.';
  end if;
  select * into g from public.parametros_generales where localidad_id = new.localidad_id order by id limit 1;
  new.idp := round(new.galones_super * coalesce(g.idp_super, 0) + new.galones_regular * coalesce(g.idp_regular, 0) + new.galones_diesel * coalesce(g.idp_diesel, 0), 2);
  if not new.aplica_inguat then new.inguat := 0; end if;
  if not new.retencion then new.retencion_valor := 0; new.retencion_formulario := null; new.retencion_fecha := null; end if;
  if new.pago_inmediato then new.dias_credito := 0; end if;
  v_pct := coalesce(g.impuesto1, 12);
  v_afecto := new.valor_total - new.exento - new.idp - new.inguat - new.turismo_itp - new.no_deducible - new.dai - new.valor_cuenta_ajena - new.iva_importacion;
  if v_afecto < 0 then raise exception 'El exento, IDP, INGUAT, ITP, no deducibles, DAI, IVA de importación y cuenta ajena pasan del valor total.'; end if;
  new.iva := case when new.tipo_dte in ('RECIBO', 'FACTURA PEQUEÑO CONTRIBUYENTE') then 0
                  when new.tipo_dte = 'DUCA (IMPORTACIÓN)' then new.iva_importacion
                  else round(v_afecto * v_pct / (100 + v_pct), 2) end;
  new.base := case when new.tipo_dte = 'DUCA (IMPORTACIÓN)' then v_afecto else v_afecto - new.iva end;
  new.retencion_formulario := nullif(trim(new.retencion_formulario), '');
  new.compra_inventario := nullif(trim(new.compra_inventario), '');
  new.orden_compra := nullif(upper(trim(new.orden_compra)), '');
  return new;
end;
$$;
drop trigger if exists compras_calcular on public.compras;
create trigger compras_calcular before insert or update on public.compras for each row execute function public.calcular_compra();

create or replace function public.validar_compra_item() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.compras;
begin
  select * into c from public.compras where id = coalesce(new.compra_id, old.compra_id);
  if c.estado = 'ANULADA' then raise exception 'La compra % está anulada.', c.numero; end if;
  if tg_op = 'DELETE' then return old; end if;
  new.descripcion := upper(trim(new.descripcion));
  return new;
end;
$$;
drop trigger if exists compra_items_validar on public.compra_items;
create trigger compra_items_validar before insert or update or delete on public.compra_items for each row execute function public.validar_compra_item();

-- Contraseña de pago: correlativo por localidad.
create or replace function public.crear_contrasena_compra(p_id bigint) returns integer
language plpgsql security definer set search_path = '' as $$
declare c public.compras; v integer;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede crear contraseñas de pago.'; end if;
  select * into c from public.compras where id = p_id for update;
  if c.id is null then raise exception 'La compra no existe.'; end if;
  if c.contrasena is not null then return c.contrasena; end if;
  if c.estado = 'ANULADA' then raise exception 'La compra % está anulada.', c.numero; end if;
  perform pg_advisory_xact_lock(4813, c.localidad_id::integer);
  v := coalesce((select max(contrasena) from public.compras where localidad_id = c.localidad_id), 0) + 1;
  update public.compras set contrasena = v, contrasena_fecha = current_date where id = c.id;
  return v;
end;
$$;

-- La vista del saldo se vuelve a crear para incluir las columnas nuevas de compras.
drop view if exists public.compras_saldo;
create view public.compras_saldo with (security_invoker = true) as
  select c.*,
         c.valor_total - c.bonificaciones - c.notas_credito - c.descuentos_nd as neto,
         coalesce(p.pagado, 0) as pagado,
         c.valor_total - c.bonificaciones - c.notas_credito - c.descuentos_nd - coalesce(p.pagado, 0) as pendiente,
         coalesce(p.pagos, 0) as pagos,
         p.ultimo_pago
  from public.compras c
  left join lateral (
    select sum(d.abono_compra) as pagado, count(*) as pagos,
           string_agg(case when m.tipo = 'CHEQUE' then 'CH ' else 'TRF ' end || coalesce(m.numero_documento, m.folio::text), ', ' order by m.fecha, m.id) as ultimo_pago
    from public.movimiento_documentos d join public.movimientos_bancarios m on m.id = d.movimiento_id and m.estado = 'ACTIVO'
    where d.compra_id = c.id) p on true;
grant select on public.compras_saldo to authenticated;

-- ---------- Seguridad ----------
do $$
declare t text;
begin
  foreach t in array array['tipos_proveedor', 'regimenes_isr', 'bodegas', 'proveedores', 'proveedor_cuentas', 'compra_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format('drop policy if exists "%s: modificar" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
  foreach t in array array['proveedor_cuentas', 'compra_items'] loop
    execute format('drop policy if exists "%s: quitar" on public.%I', t, t);
    execute format('create policy "%s: quitar" on public.%I for delete to authenticated using (public.puede_editar_catalogos())', t, t);
    execute format('grant delete on public.%I to authenticated', t);
  end loop;
end;
$$;
revoke execute on function public.preparar_bodega() from public, anon, authenticated;
revoke execute on function public.preparar_proveedor() from public, anon, authenticated;
revoke execute on function public.validar_proveedor_cuenta() from public, anon, authenticated;
revoke execute on function public.calcular_compra() from public, anon, authenticated;
revoke execute on function public.validar_compra_item() from public, anon, authenticated;
revoke execute on function public.transaccion_de_localidad(bigint, bigint) from public, anon, authenticated;
revoke execute on function public.crear_contrasena_compra(bigint) from public, anon;
grant execute on function public.crear_contrasena_compra(bigint) to authenticated;

-- ---------- Menú: Compras · Catálogos (Proveedores, Bodegas) y Registros (Facturas de compra) ----------
insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
select m.id, x.grupo, x.subgrupo, x.clave, x.nombre, coalesce((select max(orden) from public.opciones_sistema), 0) + x.n
from public.modulos_sistema m
cross join (values (1, 'catalogos', 'Proveedores', 'proveedores', 'Proveedores'),
                   (2, 'catalogos', 'Proveedores', 'bodegas', 'Bodegas'),
                   (3, 'registros', 'Compras', 'facturas-compra', 'Facturas de compra')) as x (n, grupo, subgrupo, clave, nombre)
where m.siglas = 'COM' and m.modulo_mayor_id is null
  and not exists (select 1 from public.opciones_sistema o where o.clave = x.clave and o.modulo_id = m.id);

notify pgrst, 'reload schema';
