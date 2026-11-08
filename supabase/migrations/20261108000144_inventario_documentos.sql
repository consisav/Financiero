-- Inventarios · Registros: Traslados entre bodegas, Ajustes al inventario por lotes y Ajustes al inventario por
-- producto (por bodega). Las Entradas (compras y notas de compras) y las Salidas (facturas y notas de ventas) son
-- consultas de los documentos que ya existen: no necesitan tablas nuevas.
--   · documentos_inventario: encabezado de los tres documentos (tipo TRASLADO, AJUSTE LOTE o AJUSTE PRODUCTO),
--     con su número por empresa y tipo, fecha, estado (REGISTRADO, OPERADO, ANULADO), bodegas, motivo, dirección
--     (AÑADIR o DISMINUIR, en el ajuste por producto), descripción y usuario.
--   · documento_inventario_lineas: productos con lote, fabricación y vencimiento (y el nuevo lote en el ajuste por
--     lotes), cantidad y costo.
--   · motivos_ajuste: catálogo de motivos de los ajustes (por organización).
--   · procesar_documento_inventario(id, acción, motivo, forzar): OPERAR (mueve el inventario), REVERTIR (deshace
--     el movimiento) o ANULAR. Revisa la existencia por lote; si no alcanza avisa y solo sigue con «forzar».
-- Se ejecuta después del script 143.

-- ---------- Motivos de ajuste ----------
create table if not exists public.motivos_ajuste (
  id               bigint generated always as identity primary key,
  organizacion_id  bigint not null references public.organizaciones (id),
  codigo           integer not null,
  nombre           text not null,
  activo           boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (organizacion_id, codigo)
);
create or replace function public.preparar_motivo_ajuste() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.nombre := upper(trim(new.nombre));
  if new.nombre = '' then raise exception 'Escribe el nombre del motivo.'; end if;
  if tg_op = 'INSERT' and coalesce(new.codigo, 0) = 0 then
    perform pg_advisory_xact_lock(hashtext('motivo_ajuste'), new.organizacion_id::integer);
    new.codigo := coalesce((select max(codigo) from public.motivos_ajuste where organizacion_id = new.organizacion_id), 0) + 1;
  end if;
  return new;
end;
$$;
drop trigger if exists motivos_ajuste_preparar on public.motivos_ajuste;
create trigger motivos_ajuste_preparar before insert or update on public.motivos_ajuste for each row execute function public.preparar_motivo_ajuste();
drop trigger if exists motivos_ajuste_auditar on public.motivos_ajuste;
create trigger motivos_ajuste_auditar before insert or update on public.motivos_ajuste for each row execute function public.auditar();

-- Motivos iniciales en cada organización.
insert into public.motivos_ajuste (organizacion_id, codigo, nombre)
select o.id, m.codigo, m.nombre from public.organizaciones o
cross join (values (1, 'FALTANTE EN BODEGA'), (2, 'SOBRANTE EN BODEGA'), (3, 'PRODUCTO VENCIDO'), (4, 'PRODUCTO DAÑADO'),
                   (5, 'TOMA FÍSICA'), (6, 'MUESTRA MÉDICA'), (10, 'AJUSTE DE LOTES'),
                   (20, 'DEVOLUCIÓN POR VENCIMIENTO'), (21, 'DEVOLUCIÓN POR PRODUCTO DAÑADO'), (22, 'DEVOLUCIÓN AL PROVEEDOR'),
                   (23, 'REINGRESO POR DEVOLUCIÓN DE CLIENTE'), (24, 'REINGRESO DE DESPACHO')) as m(codigo, nombre)
on conflict (organizacion_id, codigo) do nothing;

-- ---------- Documentos ----------
create table if not exists public.documentos_inventario (
  id                    bigint generated always as identity primary key,
  organizacion_id       bigint not null references public.organizaciones (id),
  localidad_id          bigint not null references public.localidades (id),
  tipo                  text not null,
  numero                integer not null,
  fecha                 timestamptz not null default now(),
  estado                text not null default 'REGISTRADO' check (estado in ('REGISTRADO', 'OPERADO', 'ANULADO')),
  bodega_id             bigint not null references public.bodegas (id),
  bodega_destino_id     bigint references public.bodegas (id),
  motivo_id             bigint references public.motivos_ajuste (id),
  direccion             text check (direccion in ('AÑADIR', 'DISMINUIR')),
  descripcion           text,
  aplica_conta          boolean not null default false,
  valor_total           numeric(18, 2) not null default 0,
  usuario               text,
  usuario_nombre        text,
  operado_por           text,
  operado_en            timestamptz,
  anulado_por           text,
  anulado_en            timestamptz,
  motivo_anulacion      text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (localidad_id, tipo, numero)
);
-- Tipos: traslado, ajustes por lote y por producto, y notas por devolución o reingreso (con su compra de ingreso
-- y las referencias de la nota de débito, la devolución o el despacho).
alter table public.documentos_inventario add column if not exists compra_id bigint references public.compras (id) on delete set null;
alter table public.documentos_inventario add column if not exists referencia text;
alter table public.documentos_inventario drop constraint if exists documentos_inventario_tipo_check;
alter table public.documentos_inventario add constraint documentos_inventario_tipo_check check (tipo in ('TRASLADO', 'AJUSTE LOTE', 'AJUSTE PRODUCTO', 'DEVOLUCIÓN'));
create index if not exists documentos_inventario_fecha_idx on public.documentos_inventario (localidad_id, tipo, fecha);

create table if not exists public.documento_inventario_lineas (
  id                  bigint generated always as identity primary key,
  documento_id        bigint not null references public.documentos_inventario (id) on delete cascade,
  linea               integer not null,
  producto_id         bigint not null references public.productos (id),
  lote                text,
  fecha_fabricacion   date,
  fecha_vencimiento   date,
  nuevo_lote          text,
  nueva_fabricacion   date,
  nuevo_vencimiento   date,
  cantidad            numeric(14, 4) not null check (cantidad > 0),
  costo_unitario      numeric(18, 4) not null default 0 check (costo_unitario >= 0),
  costo_total         numeric(18, 2) generated always as (round(cantidad * costo_unitario, 2)) stored,
  unique (documento_id, linea)
);

alter table public.inventario_movimientos add column if not exists documento_linea_id bigint references public.documento_inventario_lineas (id) on delete cascade;
create index if not exists inventario_movimientos_doc_linea_idx on public.inventario_movimientos (documento_linea_id);

create or replace function public.preparar_documento_inventario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_u text; v_n text;
begin
  if current_setting('fin.docinv', true) is distinct from 'si' then
    select upper(x.usuario), x.nombre into v_u, v_n from public.perfiles x where x.id = (select auth.uid());
    if tg_op = 'INSERT' then
      perform pg_advisory_xact_lock(hashtext('docinv' || new.tipo), new.localidad_id::integer);
      new.numero := coalesce((select max(numero) from public.documentos_inventario where localidad_id = new.localidad_id and tipo = new.tipo), 0) + 1;
      new.estado := 'REGISTRADO'; new.operado_por := null; new.operado_en := null;
      new.anulado_por := null; new.anulado_en := null; new.motivo_anulacion := null;
      new.usuario := coalesce(v_u, 'SISTEMA'); new.usuario_nombre := coalesce(v_n, '');
      new.organizacion_id := (select l.organizacion_id from public.localidades l where l.id = new.localidad_id);
    else
      if old.estado <> 'REGISTRADO' then raise exception 'El documento % está %: ya no se modifica.', old.numero, lower(old.estado); end if;
      new.numero := old.numero; new.estado := old.estado; new.tipo := old.tipo; new.usuario := old.usuario; new.usuario_nombre := old.usuario_nombre;
      new.localidad_id := old.localidad_id; new.organizacion_id := old.organizacion_id;
    end if;
  end if;
  if not exists (select 1 from public.bodegas b where b.id = new.bodega_id and b.localidad_id = new.localidad_id) then raise exception 'La bodega no es de la empresa.'; end if;
  if new.tipo = 'TRASLADO' then
    if new.bodega_destino_id is null then raise exception 'Elige la bodega destino.'; end if;
    if new.bodega_destino_id = new.bodega_id then raise exception 'La bodega destino debe ser distinta de la de origen.'; end if;
    if not exists (select 1 from public.bodegas b where b.id = new.bodega_destino_id and b.localidad_id = new.localidad_id) then raise exception 'La bodega destino no es de la empresa.'; end if;
    new.motivo_id := null; new.direccion := null;
  else
    new.bodega_destino_id := null;
    if new.motivo_id is null then raise exception 'Elige el motivo del ajuste.'; end if;
    if new.tipo = 'AJUSTE PRODUCTO' then new.direccion := coalesce(new.direccion, 'AÑADIR');
    elsif new.tipo = 'DEVOLUCIÓN' then new.direccion := coalesce(new.direccion, 'DISMINUIR');
    else new.direccion := null; end if;
    if new.compra_id is not null and not exists (select 1 from public.compras c where c.id = new.compra_id and c.localidad_id = new.localidad_id) then raise exception 'La compra de ingreso no es de la empresa.'; end if;
  end if;
  new.descripcion := nullif(upper(trim(new.descripcion)), '');
  new.referencia := nullif(upper(trim(new.referencia)), '');
  if new.tipo <> 'DEVOLUCIÓN' then new.compra_id := null; new.referencia := null; end if;
  return new;
end;
$$;
drop trigger if exists documentos_inventario_preparar on public.documentos_inventario;
create trigger documentos_inventario_preparar before insert or update on public.documentos_inventario for each row execute function public.preparar_documento_inventario();
drop trigger if exists documentos_inventario_auditar on public.documentos_inventario;
create trigger documentos_inventario_auditar before insert or update on public.documentos_inventario for each row execute function public.auditar();

create or replace function public.validar_documento_inventario_linea() returns trigger
language plpgsql security definer set search_path = '' as $$
declare d public.documentos_inventario;
begin
  select * into d from public.documentos_inventario where id = coalesce(new.documento_id, old.documento_id);
  if d.estado <> 'REGISTRADO' and current_setting('fin.docinv', true) is distinct from 'si' then
    raise exception 'El documento % está %: su detalle ya no se modifica.', d.numero, lower(d.estado);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if not exists (select 1 from public.productos p where p.id = new.producto_id and p.localidad_id = d.localidad_id) then
    raise exception 'El producto de la línea % no es de la empresa.', new.linea;
  end if;
  new.lote := nullif(upper(trim(new.lote)), '');
  new.nuevo_lote := nullif(upper(trim(new.nuevo_lote)), '');
  if d.tipo = 'AJUSTE LOTE' and new.nuevo_lote is null then raise exception 'Escribe el nuevo lote de la línea %.', new.linea; end if;
  return new;
end;
$$;
drop trigger if exists documento_inventario_lineas_validar on public.documento_inventario_lineas;
create trigger documento_inventario_lineas_validar before insert or update or delete on public.documento_inventario_lineas for each row execute function public.validar_documento_inventario_linea();

-- OPERAR: mueve el inventario. TRASLADO: sale de la bodega origen y entra a la destino (mismo lote).
-- AJUSTE LOTE: sale el lote inicial y entra el nuevo lote, en la misma bodega. AJUSTE PRODUCTO: entra (AÑADIR)
-- o sale (DISMINUIR). Si alguna salida deja el lote sin existencia suficiente, avisa (EXISTENCIA: …) y solo sigue
-- cuando se confirma con p_forzar.
create or replace function public.procesar_documento_inventario(p_id bigint, p_accion text, p_motivo text default null, p_forzar boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.documentos_inventario;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_n integer := 0; v_mal text; v_fecha date; v_sale boolean;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para procesar documentos de inventario.'; end if;
  select * into d from public.documentos_inventario where id = p_id for update;
  if d.id is null then raise exception 'El documento no existe.'; end if;
  perform set_config('fin.docinv', 'si', true);
  v_fecha := (d.fecha at time zone 'America/Guatemala')::date;
  v_sale := d.tipo in ('TRASLADO', 'AJUSTE LOTE') or d.direccion = 'DISMINUIR';
  if p_accion = 'OPERAR' then
    if d.estado <> 'REGISTRADO' then raise exception 'El documento % está %.', d.numero, lower(d.estado); end if;
    if not exists (select 1 from public.documento_inventario_lineas where documento_id = d.id) then raise exception 'Agrega los productos del documento %.', d.numero; end if;
    if v_sale and not coalesce(p_forzar, false) then
      select string_agg(p.nombre || coalesce(' · lote ' || x.lote, '') || ' (existencia ' || trim(to_char(coalesce(e.ex, 0), 'FM999G999G990D####')) || ', se requiere ' || trim(to_char(x.cant, 'FM999G999G990D####')) || ')', '; ') into v_mal
      from (select producto_id, lote, sum(cantidad) as cant from public.documento_inventario_lineas where documento_id = d.id group by 1, 2) x
      join public.productos p on p.id = x.producto_id
      left join lateral (select sum(m.cantidad) as ex from public.inventario_movimientos m
                         where m.producto_id = x.producto_id and m.bodega_id = d.bodega_id and coalesce(m.lote, '') = coalesce(x.lote, '')) e on true
      where x.cant > coalesce(e.ex, 0);
      if v_mal is not null then raise exception 'EXISTENCIA: No hay existencia suficiente en la bodega para: %.', v_mal; end if;
    end if;
    if d.tipo = 'TRASLADO' then
      insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, lote, fecha_vencimiento, usuario, documento_linea_id)
      select d.organizacion_id, d.localidad_id, l.producto_id, d.bodega_id, v_fecha, -l.cantidad, l.costo_unitario, 'TRASLADO', l.lote, l.fecha_vencimiento, v_quien, l.id
      from public.documento_inventario_lineas l where l.documento_id = d.id
      union all
      select d.organizacion_id, d.localidad_id, l.producto_id, d.bodega_destino_id, v_fecha, l.cantidad, l.costo_unitario, 'TRASLADO', l.lote, l.fecha_vencimiento, v_quien, l.id
      from public.documento_inventario_lineas l where l.documento_id = d.id;
    elsif d.tipo = 'AJUSTE LOTE' then
      insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, lote, fecha_vencimiento, usuario, documento_linea_id)
      select d.organizacion_id, d.localidad_id, l.producto_id, d.bodega_id, v_fecha, -l.cantidad, l.costo_unitario, 'AJUSTE', l.lote, l.fecha_vencimiento, v_quien, l.id
      from public.documento_inventario_lineas l where l.documento_id = d.id
      union all
      select d.organizacion_id, d.localidad_id, l.producto_id, d.bodega_id, v_fecha, l.cantidad, l.costo_unitario, 'AJUSTE', l.nuevo_lote, l.nuevo_vencimiento, v_quien, l.id
      from public.documento_inventario_lineas l where l.documento_id = d.id;
    else
      insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, lote, fecha_vencimiento, usuario, documento_linea_id)
      select d.organizacion_id, d.localidad_id, l.producto_id, d.bodega_id, v_fecha, case when d.direccion = 'DISMINUIR' then -l.cantidad else l.cantidad end,
             l.costo_unitario, 'AJUSTE', l.lote, l.fecha_vencimiento, v_quien, l.id
      from public.documento_inventario_lineas l where l.documento_id = d.id;
    end if;
    get diagnostics v_n = row_count;
    update public.documentos_inventario set estado = 'OPERADO', operado_por = v_quien, operado_en = now() where id = d.id;
  elsif p_accion = 'REVERTIR' then
    if d.estado <> 'OPERADO' then raise exception 'El documento % no está operado.', d.numero; end if;
    delete from public.inventario_movimientos where documento_linea_id in (select id from public.documento_inventario_lineas where documento_id = d.id);
    get diagnostics v_n = row_count;
    update public.documentos_inventario set estado = 'REGISTRADO', operado_por = null, operado_en = null where id = d.id;
  elsif p_accion = 'ANULAR' then
    if d.estado <> 'REGISTRADO' then raise exception 'Solo se anula un documento registrado (revierte primero el movimiento).'; end if;
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la anulación.'; end if;
    update public.documentos_inventario set estado = 'ANULADO', anulado_por = v_quien, anulado_en = now(), motivo_anulacion = upper(trim(p_motivo)) where id = d.id;
  else
    raise exception 'Acción no válida.';
  end if;
  perform set_config('fin.docinv', '', true);
  return jsonb_build_object('numero', d.numero, 'movimientos', v_n);
end;
$$;

-- ---------- Seguridad ----------
do $$
declare t text;
begin
  foreach t in array array['motivos_ajuste', 'documentos_inventario', 'documento_inventario_lineas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format('drop policy if exists "%s: modificar" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end;
$$;
drop policy if exists "documento_inventario_lineas: quitar" on public.documento_inventario_lineas;
create policy "documento_inventario_lineas: quitar" on public.documento_inventario_lineas for delete to authenticated using (public.puede_editar_catalogos());
grant delete on public.documento_inventario_lineas to authenticated;
revoke execute on function public.preparar_motivo_ajuste() from public, anon, authenticated;
revoke execute on function public.preparar_documento_inventario() from public, anon, authenticated;
revoke execute on function public.validar_documento_inventario_linea() from public, anon, authenticated;
revoke execute on function public.procesar_documento_inventario(bigint, text, text, boolean) from public, anon;
grant execute on function public.procesar_documento_inventario(bigint, text, text, boolean) to authenticated;

-- ---------- Menú: Inventarios › Registros ----------
-- «Entradas», «Salidas» y «Traslados entre bodegas» ya existen; «Ajustes» se divide en dos opciones.
do $$
declare v_inv bigint; v_ref bigint; v_id bigint; v_orden integer; o record;
begin
  select id into v_inv from public.modulos_sistema where siglas = 'INV' order by codigo limit 1;
  if v_inv is null then raise notice 'No existe el módulo Inventarios (INV).'; return; end if;
  update public.opciones_sistema set subgrupo = 'Movimientos' where modulo_id = v_inv and grupo = 'registros' and clave in ('entradas', 'salidas');
  update public.opciones_sistema set subgrupo = 'Traslados y ajustes' where modulo_id = v_inv and grupo = 'registros' and clave = 'traslados-entre-bodegas';
  update public.opciones_sistema set activo = false where modulo_id = v_inv and grupo = 'registros' and clave = 'ajustes';
  select id into v_ref from public.opciones_sistema where modulo_id = v_inv and grupo = 'registros' and clave = 'traslados-entre-bodegas';
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  for o in select * from (values (1, 'ajustes-por-lotes', 'Ajustes al inventario por lotes'), (2, 'ajustes-por-producto', 'Ajustes al inventario por producto'), (3, 'devoluciones-reingresos', 'Devoluciones y reingresos')) as x(n, clave, nombre) loop
    select id into v_id from public.opciones_sistema where modulo_id = v_inv and grupo = 'registros' and clave = o.clave;
    if v_id is null then
      insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
      values (v_inv, 'registros', 'Traslados y ajustes', o.clave, o.nombre, v_orden + o.n) returning id into v_id;
    end if;
    if v_ref is not null then
      insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
      select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = v_ref on conflict do nothing;
    end if;
  end loop;
  raise notice 'Inventarios: entradas, salidas, traslados entre bodegas y ajustes por lotes y por producto.';
end;
$$;

-- Inventarios › Mantenimientos: Kardex sin costos y Kardex con costos (primeros del grupo), con los accesos de
-- «Mínimos y máximos». Facturación/Ventas e Inventarios › Catálogos › Productos: Precios de venta, con los
-- accesos de «Productos y servicios» de cada módulo. Inventarios › Registros: Vencimiento de productos.
do $$
declare v_inv bigint; v_fac bigint; v_ref bigint; v_id bigint; v_orden integer; o record;
begin
  select id into v_inv from public.modulos_sistema where siglas = 'INV' order by codigo limit 1;
  select id into v_fac from public.modulos_sistema where siglas = 'FAC' order by codigo limit 1;
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  for o in select * from (values
      (1, v_inv, 'mantenimientos', 'Kardex', 'kardex-sin-costos', 'Kardex sin costos', 'minimos-y-maximos'),
      (2, v_inv, 'mantenimientos', 'Kardex', 'kardex-con-costos', 'Kardex con costos', 'minimos-y-maximos'),
      (3, v_fac, 'catalogos', 'Productos', 'precios-de-venta', 'Precios de venta', 'productos-y-servicios'),
      (4, v_inv, 'catalogos', 'Productos', 'precios-de-venta', 'Precios de venta', 'productos-y-servicios'),
      (5, v_inv, 'registros', 'Movimientos', 'vencimiento-productos', 'Vencimiento de productos', 'entradas')
    ) as x(n, modulo, grupo, subgrupo, clave, nombre, ref) loop
    if o.modulo is null then continue; end if;
    select id into v_ref from public.opciones_sistema where modulo_id = o.modulo and grupo = o.grupo and clave = o.ref order by id limit 1;
    select id into v_id from public.opciones_sistema where modulo_id = o.modulo and grupo = o.grupo and clave = o.clave;
    if v_id is null then
      insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
      values (o.modulo, o.grupo, o.subgrupo, o.clave, o.nombre, v_orden + o.n) returning id into v_id;
    end if;
    if v_ref is not null then
      insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
      select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = v_ref on conflict do nothing;
    end if;
  end loop;
  raise notice 'Kardex sin y con costos, y Precios de venta en el menú.';
end;
$$;

notify pgrst, 'reload schema';
