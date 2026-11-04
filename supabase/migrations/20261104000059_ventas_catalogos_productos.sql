-- Facturación/Ventas · Catálogos, cada uno de su organización y localidad (empresa).
--   vendedores: número (correlativo o el que se escriba), nombre, correo, celular, teléfono,
--   comisiones (general, crédito y contado), siglas y el usuario del sistema.
--   clasificaciones_producto: descripción, tipo (producto o servicio), cuenta contable, tipo de
--   servicio (interno o externo), si maneja inventario y si es de laboratorio.
--   tipos_producto: los tipos de cada clasificación: siglas, descripción, cuenta de inventarios y
--   cuenta de facturación.
--   tipos_medida, presentaciones_producto: número y descripción.
--   tipos_precio: descripción, % de utilidad, % de descuento, factor (normal: sobre el costo;
--   precio fijo: el que se escribe en el producto) y estado.
--   productos: artículo (correlativo), nombre, código de producto, clasificación y tipo, estado,
--   marca, proveedor principal, código de barras, presentación, unidad de medida, genérico, punto
--   mínimo (mínimo y máximo), precio costo, ubicación (estante, fila y bloque), bodega e imagen.
--   producto_proveedores (otros proveedores) y producto_precios (precio por tipo de precio).
--   Bucket privado «productos» para las imágenes.
-- Escribir: administrador. Se ejecuta después del script 58 (usa cuenta_de_localidad del 54).

-- ---------- Vendedores ----------
create table if not exists public.vendedores (
  id                   bigint generated always as identity primary key,
  organizacion_id      bigint not null references public.organizaciones (id),
  localidad_id         bigint not null,
  codigo               integer not null check (codigo > 0),
  nombre               text not null check (length(trim(nombre)) > 0),
  correo               text,
  celular              text,
  telefono             text,
  pct_comision_general numeric(6, 2) not null default 0 check (pct_comision_general between 0 and 100),
  pct_comision_credito numeric(6, 2) not null default 0 check (pct_comision_credito between 0 and 100),
  pct_comision_contado numeric(6, 2) not null default 0 check (pct_comision_contado between 0 and 100),
  siglas               text check (siglas ~ '^[A-Z0-9]{1,6}$'),
  perfil_id            uuid references public.perfiles (id) on delete set null,
  activo               boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, codigo)
);

-- ---------- Clasificaciones y tipos de productos ----------
create table if not exists public.clasificaciones_producto (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id    bigint not null,
  codigo          integer not null check (codigo > 0),
  nombre          text not null check (length(trim(nombre)) > 0),
  tipo            text not null default 'PRODUCTO' check (tipo in ('PRODUCTO', 'SERVICIO')),
  cuenta_id       bigint references public.cuentas (id),
  tipo_servicio   text not null default 'INTERNO' check (tipo_servicio in ('INTERNO', 'EXTERNO')),
  inventario      boolean not null default true,
  laboratorio     boolean not null default false,
  activo          boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, codigo)
);
create unique index if not exists clasificaciones_producto_nombre_key on public.clasificaciones_producto (localidad_id, upper(nombre));

create table if not exists public.tipos_producto (
  id                    bigint generated always as identity primary key,
  clasificacion_id      bigint not null references public.clasificaciones_producto (id),
  organizacion_id       bigint not null,
  localidad_id          bigint not null,
  codigo                integer not null check (codigo > 0),
  siglas                text check (siglas ~ '^[A-Z0-9]{1,6}$'),
  nombre                text not null check (length(trim(nombre)) > 0),
  cuenta_inventario_id  bigint references public.cuentas (id),
  cuenta_facturacion_id bigint references public.cuentas (id),
  activo                boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (localidad_id, codigo)
);
create index if not exists tipos_producto_clasificacion_idx on public.tipos_producto (clasificacion_id);

-- ---------- Tipos de medida, presentaciones y tipos de precio ----------
create table if not exists public.tipos_medida (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id    bigint not null,
  codigo          integer not null check (codigo > 0),
  nombre          text not null check (length(trim(nombre)) > 0),
  activo          boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, codigo)
);
create table if not exists public.presentaciones_producto (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id    bigint not null,
  codigo          integer not null check (codigo > 0),
  nombre          text not null check (length(trim(nombre)) > 0),
  activo          boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, codigo)
);
create table if not exists public.tipos_precio (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id    bigint not null,
  codigo          integer not null check (codigo > 0),
  nombre          text not null check (length(trim(nombre)) > 0),
  pct_utilidad    numeric(7, 2) not null default 0 check (pct_utilidad >= 0),
  pct_descuento   numeric(6, 2) not null default 0 check (pct_descuento between 0 and 100),
  factor          text not null default 'NORMAL' check (factor in ('NORMAL', 'PRECIO FIJO')),
  activo          boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, codigo)
);
do $$
declare t text;
begin
  foreach t in array array['tipos_medida', 'presentaciones_producto', 'tipos_precio'] loop
    execute format('create unique index if not exists %I on public.%I (localidad_id, upper(nombre))', t || '_nombre_key', t);
  end loop;
end;
$$;

-- ---------- Productos y servicios ----------
create table if not exists public.productos (
  id               bigint generated always as identity primary key,
  organizacion_id  bigint not null references public.organizaciones (id),
  localidad_id     bigint not null,
  codigo           integer not null check (codigo > 0),
  nombre           text not null check (length(trim(nombre)) > 0),
  codigo_producto  text,
  clasificacion_id bigint references public.clasificaciones_producto (id),
  tipo_producto_id bigint references public.tipos_producto (id),
  estado           text not null default 'ACTIVO' check (estado in ('ACTIVO', 'INACTIVO', 'DESCONTINUADO')),
  marca            text,
  proveedor_id     bigint references public.proveedores (id),
  codigo_barras    text,
  presentacion_id  bigint references public.presentaciones_producto (id),
  tipo_medida_id   bigint references public.tipos_medida (id),
  generico         boolean not null default false,
  punto_minimo     boolean not null default false,
  minimo           numeric(14, 3) not null default 0 check (minimo >= 0),
  maximo           numeric(14, 3) not null default 0 check (maximo >= 0),
  precio_costo     numeric(18, 4) not null default 0 check (precio_costo >= 0),
  estante          text,
  fila             text,
  bloque           text,
  bodega_id        bigint references public.bodegas (id),
  descripcion      text,
  imagen_ruta      text,
  imagen_nombre    text,
  imagen_tipo      text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, codigo),
  check (not punto_minimo or maximo >= minimo)
);
create unique index if not exists productos_codigo_producto_key on public.productos (localidad_id, upper(codigo_producto)) where codigo_producto is not null;
create unique index if not exists productos_codigo_barras_key on public.productos (localidad_id, codigo_barras) where codigo_barras is not null;
create index if not exists productos_nombre_idx on public.productos (localidad_id, nombre);

create table if not exists public.producto_proveedores (
  id               bigint generated always as identity primary key,
  producto_id      bigint not null references public.productos (id) on delete cascade,
  proveedor_id     bigint not null references public.proveedores (id),
  codigo_proveedor text,
  ultimo_costo     numeric(18, 4) check (ultimo_costo is null or ultimo_costo >= 0),
  unique (producto_id, proveedor_id)
);
create table if not exists public.producto_precios (
  id             bigint generated always as identity primary key,
  producto_id    bigint not null references public.productos (id) on delete cascade,
  tipo_precio_id bigint not null references public.tipos_precio (id),
  precio         numeric(18, 4) not null check (precio >= 0),
  unique (producto_id, tipo_precio_id)
);

-- ---------- Reglas comunes: número correlativo, mayúsculas y que todo sea de la localidad ----------
create or replace function public.preparar_catalogo_ventas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k public.clasificaciones_producto;
begin
  if tg_table_name = 'tipos_producto' then
    select * into k from public.clasificaciones_producto where id = new.clasificacion_id;
    if k.id is null then raise exception 'La clasificación no existe.'; end if;
    if tg_op = 'UPDATE' and k.localidad_id <> old.localidad_id then raise exception 'La clasificación es de otra localidad.'; end if;
    new.organizacion_id := k.organizacion_id; new.localidad_id := k.localidad_id;
  end if;
  if tg_op = 'INSERT' then
    if new.codigo is null or new.codigo <= 0 then
      perform pg_advisory_xact_lock(hashtext(tg_table_name), new.localidad_id::integer);
      execute format('select coalesce(max(codigo), 0) + 1 from public.%I where localidad_id = $1', tg_table_name) into new.codigo using new.localidad_id;
    end if;
  else
    new.organizacion_id := old.organizacion_id; new.localidad_id := old.localidad_id;
  end if;
  new.nombre := upper(trim(new.nombre));
  if tg_table_name in ('vendedores', 'tipos_producto') then new.siglas := nullif(upper(trim(new.siglas)), ''); end if;
  if tg_table_name = 'vendedores' then
    new.correo := nullif(lower(trim(new.correo)), '');
    if new.perfil_id is not null and not exists (select 1 from public.perfiles p where p.id = new.perfil_id and p.organizacion_id = new.organizacion_id) then
      raise exception 'El usuario del vendedor no es de la organización.';
    end if;
  end if;
  -- Cada tabla tiene sus columnas: la condición va adentro para no leer campos que no existen.
  if tg_table_name = 'clasificaciones_producto' then
    if not public.cuenta_de_localidad(new.cuenta_id, new.localidad_id) then
      raise exception 'La cuenta de la clasificación no es del catálogo de la localidad.';
    end if;
  end if;
  if tg_table_name = 'tipos_producto' then
    if not (public.cuenta_de_localidad(new.cuenta_inventario_id, new.localidad_id) and public.cuenta_de_localidad(new.cuenta_facturacion_id, new.localidad_id)) then
      raise exception 'Las cuentas del tipo de producto deben ser del catálogo de la localidad.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.preparar_producto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t public.tipos_producto;
begin
  if tg_op = 'INSERT' then
    if new.codigo is null or new.codigo <= 0 then
      perform pg_advisory_xact_lock(4816, new.localidad_id::integer);
      new.codigo := coalesce((select max(codigo) from public.productos where localidad_id = new.localidad_id), 0) + 1;
    end if;
  else
    new.organizacion_id := old.organizacion_id; new.localidad_id := old.localidad_id;
  end if;
  if new.tipo_producto_id is not null then
    select * into t from public.tipos_producto where id = new.tipo_producto_id;
    if new.clasificacion_id is null then new.clasificacion_id := t.clasificacion_id; end if;
    if t.clasificacion_id <> new.clasificacion_id then raise exception 'El tipo de producto no es de la clasificación elegida.'; end if;
  end if;
  if (new.clasificacion_id is not null and not exists (select 1 from public.clasificaciones_producto x where x.id = new.clasificacion_id and x.localidad_id = new.localidad_id))
     or (new.presentacion_id is not null and not exists (select 1 from public.presentaciones_producto x where x.id = new.presentacion_id and x.localidad_id = new.localidad_id))
     or (new.tipo_medida_id is not null and not exists (select 1 from public.tipos_medida x where x.id = new.tipo_medida_id and x.localidad_id = new.localidad_id))
     or (new.proveedor_id is not null and not exists (select 1 from public.proveedores x where x.id = new.proveedor_id and x.localidad_id = new.localidad_id))
     or (new.bodega_id is not null and not exists (select 1 from public.bodegas x where x.id = new.bodega_id and x.localidad_id = new.localidad_id)) then
    raise exception 'La clasificación, presentación, medida, proveedor y bodega del producto deben ser de la localidad.';
  end if;
  if not new.punto_minimo then new.minimo := 0; new.maximo := 0; end if;
  new.nombre := upper(trim(new.nombre));
  new.codigo_producto := nullif(upper(trim(new.codigo_producto)), '');
  new.codigo_barras := nullif(trim(new.codigo_barras), '');
  new.marca := nullif(upper(trim(new.marca)), '');
  new.estante := nullif(upper(trim(new.estante)), ''); new.fila := nullif(upper(trim(new.fila)), ''); new.bloque := nullif(upper(trim(new.bloque)), '');
  new.descripcion := nullif(trim(new.descripcion), '');
  return new;
end;
$$;

create or replace function public.validar_producto_detalle() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_loc bigint := (select localidad_id from public.productos where id = new.producto_id);
begin
  if tg_table_name = 'producto_proveedores' then
    if not exists (select 1 from public.proveedores p where p.id = new.proveedor_id and p.localidad_id = v_loc) then raise exception 'El proveedor no es de la localidad del producto.'; end if;
    new.codigo_proveedor := nullif(upper(trim(new.codigo_proveedor)), '');
  else
    if not exists (select 1 from public.tipos_precio t where t.id = new.tipo_precio_id and t.localidad_id = v_loc) then raise exception 'El tipo de precio no es de la localidad del producto.'; end if;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['vendedores', 'clasificaciones_producto', 'tipos_producto', 'tipos_medida', 'presentaciones_producto', 'tipos_precio'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_preparar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.preparar_catalogo_ventas()', t || '_preparar', t);
  end loop;
  foreach t in array array['vendedores', 'clasificaciones_producto', 'tipos_producto', 'tipos_medida', 'presentaciones_producto', 'tipos_precio', 'productos'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.auditar()', t || '_auditar', t);
  end loop;
  foreach t in array array['producto_proveedores', 'producto_precios'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_validar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.validar_producto_detalle()', t || '_validar', t);
  end loop;
end;
$$;
drop trigger if exists productos_preparar on public.productos;
create trigger productos_preparar before insert or update on public.productos for each row execute function public.preparar_producto();

-- ---------- Seguridad ----------
do $$
declare t text;
begin
  foreach t in array array['vendedores', 'clasificaciones_producto', 'tipos_producto', 'tipos_medida', 'presentaciones_producto', 'tipos_precio', 'productos', 'producto_proveedores', 'producto_precios'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format('drop policy if exists "%s: modificar" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
  foreach t in array array['producto_proveedores', 'producto_precios'] loop
    execute format('drop policy if exists "%s: quitar" on public.%I', t, t);
    execute format('create policy "%s: quitar" on public.%I for delete to authenticated using (public.puede_editar_catalogos())', t, t);
    execute format('grant delete on public.%I to authenticated', t);
  end loop;
end;
$$;
revoke execute on function public.preparar_catalogo_ventas() from public, anon, authenticated;
revoke execute on function public.preparar_producto() from public, anon, authenticated;
revoke execute on function public.validar_producto_detalle() from public, anon, authenticated;

-- ---------- Imágenes de los productos (bucket privado) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "productos: ver imagenes" on storage.objects;
drop policy if exists "productos: subir imagenes" on storage.objects;
drop policy if exists "productos: reemplazar imagenes" on storage.objects;
drop policy if exists "productos: quitar imagenes" on storage.objects;
create policy "productos: ver imagenes" on storage.objects for select to authenticated using (bucket_id = 'productos' and public.usuario_activo());
create policy "productos: subir imagenes" on storage.objects for insert to authenticated with check (bucket_id = 'productos' and public.puede_editar_catalogos());
create policy "productos: reemplazar imagenes" on storage.objects for update to authenticated
  using (bucket_id = 'productos' and public.puede_editar_catalogos()) with check (bucket_id = 'productos' and public.puede_editar_catalogos());
create policy "productos: quitar imagenes" on storage.objects for delete to authenticated using (bucket_id = 'productos' and public.puede_editar_catalogos());

-- ---------- Menú: Facturación/Ventas · Catálogos ----------
insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
select m.id, 'catalogos', 'Productos', x.clave, x.nombre, coalesce((select max(orden) from public.opciones_sistema), 0) + x.n
from public.modulos_sistema m
cross join (values (1, 'clasificaciones-y-tipos', 'Clasificaciones y tipos'), (2, 'tipos-de-medida', 'Tipos de medida'),
                   (3, 'tipos-de-precio', 'Tipos de precio'), (4, 'presentaciones-productos', 'Presentación productos')) as x (n, clave, nombre)
where m.siglas = 'FAC' and m.modulo_mayor_id is null
  and not exists (select 1 from public.opciones_sistema o where o.clave = x.clave and o.modulo_id = m.id);
update public.opciones_sistema o set subgrupo = case when o.clave = 'vendedores' then 'Ventas' else 'Productos' end
from public.modulos_sistema m
where m.id = o.modulo_id and m.siglas = 'FAC' and m.modulo_mayor_id is null and o.clave in ('vendedores', 'productos-y-servicios');

notify pgrst, 'reload schema';
