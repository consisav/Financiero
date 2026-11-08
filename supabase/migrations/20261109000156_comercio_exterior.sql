-- Importaciones y exportaciones (Guatemala): agentes aduanales, aduanas, Incoterms 2020, partidas arancelarias (SAC) con
-- su DAI, navieras y transportistas; pólizas de importación (DUCA-D / DUCA-F) con valor FOB, flete y seguro (CIF),
-- DAI, IVA de importación y gastos locales prorrateados al costo de cada producto; liquidación e ingreso a la bodega;
-- exportaciones y seguimiento de embarques.

-- ============ Catálogos ============
create table if not exists public.com_aduanas (
  id bigint generated always as identity primary key, codigo text not null unique, nombre text not null,
  tipo text not null check (tipo in ('MARÍTIMA', 'TERRESTRE', 'AÉREA', 'EXPRESS', 'INTERNA')), ubicacion text, activo boolean not null default true
);
insert into public.com_aduanas (codigo, nombre, tipo, ubicacion) values
  ('01', 'CENTRAL DE AGUAS', 'INTERNA', 'Guatemala'), ('02', 'PUERTO QUETZAL', 'MARÍTIMA', 'Escuintla'), ('03', 'SANTO TOMÁS DE CASTILLA', 'MARÍTIMA', 'Izabal'),
  ('04', 'PUERTO BARRIOS', 'MARÍTIMA', 'Izabal'), ('05', 'TECÚN UMÁN', 'TERRESTRE', 'San Marcos'), ('06', 'PEDRO DE ALVARADO', 'TERRESTRE', 'Jutiapa'),
  ('07', 'VALLE NUEVO', 'TERRESTRE', 'Jutiapa'), ('08', 'SAN CRISTÓBAL', 'TERRESTRE', 'Jutiapa'), ('09', 'AGUA CALIENTE', 'TERRESTRE', 'Chiquimula'),
  ('10', 'EL FLORIDO', 'TERRESTRE', 'Chiquimula'), ('11', 'LA MESILLA', 'TERRESTRE', 'Huehuetenango'), ('12', 'MELCHOR DE MENCOS', 'TERRESTRE', 'Petén'),
  ('13', 'EXPRESS AÉREO (LA AURORA)', 'AÉREA', 'Guatemala'), ('14', 'FARDOS POSTALES', 'EXPRESS', 'Guatemala'), ('15', 'TIKAL FUTURA (ALMACÉN FISCAL)', 'INTERNA', 'Guatemala')
on conflict (codigo) do nothing;
create table if not exists public.com_incoterms (
  codigo text primary key, nombre text not null, grupo text not null, flete_comprador boolean not null, seguro_comprador boolean not null, descripcion text
);
insert into public.com_incoterms (codigo, nombre, grupo, flete_comprador, seguro_comprador, descripcion) values
  ('EXW', 'En fábrica', 'E', true, true, 'El comprador asume todo desde la fábrica del vendedor.'),
  ('FCA', 'Franco transportista', 'F', true, true, 'El vendedor entrega al transportista del comprador.'),
  ('FAS', 'Franco al costado del buque', 'F', true, true, 'Entrega al costado del buque en el puerto de embarque.'),
  ('FOB', 'Franco a bordo', 'F', true, true, 'Entrega a bordo del buque; flete y seguro por cuenta del comprador.'),
  ('CFR', 'Costo y flete', 'C', false, true, 'El vendedor paga el flete; el seguro es del comprador.'),
  ('CIF', 'Costo, seguro y flete', 'C', false, false, 'El vendedor paga flete y seguro hasta el puerto de destino.'),
  ('CPT', 'Transporte pagado hasta', 'C', false, true, 'El vendedor paga el transporte hasta el destino convenido.'),
  ('CIP', 'Transporte y seguro pagados hasta', 'C', false, false, 'El vendedor paga transporte y seguro hasta el destino.'),
  ('DAP', 'Entregada en lugar', 'D', false, false, 'Entregada en el lugar convenido, sin descargar ni nacionalizar.'),
  ('DPU', 'Entregada en lugar descargada', 'D', false, false, 'Entregada y descargada en el lugar convenido.'),
  ('DDP', 'Entregada con derechos pagados', 'D', false, false, 'El vendedor asume todo, incluso los impuestos de importación.')
on conflict (codigo) do nothing;
create table if not exists public.com_agentes (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo integer not null, nombre text not null, nit text, licencia text, telefono text, correo text, honorario_pct numeric(6, 3) not null default 0, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.com_partidas (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo text not null, descripcion text not null, dai numeric(6, 2) not null default 0 check (dai >= 0), iva numeric(6, 2) not null default 12, observaciones text, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.com_transportistas (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo integer not null, nombre text not null, tipo text not null default 'NAVIERA' check (tipo in ('NAVIERA', 'AÉREA', 'TERRESTRE', 'COURIER')), contacto text, telefono text, correo text, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);

-- ============ Pólizas de importación ============
create table if not exists public.com_polizas (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, tipo_duca text not null default 'DUCA-D' check (tipo_duca in ('DUCA-D', 'DUCA-F', 'DUCA-T')), duca text, fecha date not null default current_date,
  aduana_id bigint references public.com_aduanas (id), agente_id bigint references public.com_agentes (id), transportista_id bigint references public.com_transportistas (id),
  proveedor_id bigint, proveedor_nombre text not null, factura_exterior text, pais_origen text, incoterm text references public.com_incoterms (codigo),
  moneda_id bigint, tipo_cambio numeric(12, 6) not null default 1 check (tipo_cambio > 0), documento_transporte text, contenedor text, fecha_llegada date,
  bodega_id bigint, metodo_prorrateo text not null default 'VALOR' check (metodo_prorrateo in ('VALOR', 'PESO', 'CANTIDAD')),
  fob_moneda numeric(16, 2) not null default 0, flete_moneda numeric(16, 2) not null default 0, seguro_moneda numeric(16, 2) not null default 0,
  cif_q numeric(16, 2) not null default 0, dai_q numeric(16, 2) not null default 0, iva_q numeric(16, 2) not null default 0, gastos_q numeric(16, 2) not null default 0, costo_total_q numeric(16, 2) not null default 0,
  estado text not null default 'REGISTRADA' check (estado in ('REGISTRADA', 'LIQUIDADA', 'INGRESADA', 'ANULADA')),
  observaciones text, usuario text, liquidada_por text, liquidada_en timestamptz, ingresada_por text, ingresada_en timestamptz, anulada_por text, motivo_anulacion text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.com_poliza_lineas (
  id bigint generated always as identity primary key, poliza_id bigint not null references public.com_polizas (id) on delete cascade,
  linea integer not null, producto_id bigint, descripcion text not null, partida_id bigint references public.com_partidas (id),
  cantidad numeric(14, 3) not null check (cantidad > 0), peso numeric(14, 3) not null default 0, fob_moneda numeric(16, 2) not null default 0,
  lote text, fecha_vencimiento date,
  fob_q numeric(16, 2) not null default 0, flete_q numeric(16, 2) not null default 0, seguro_q numeric(16, 2) not null default 0, cif_q numeric(16, 2) not null default 0,
  dai_pct numeric(6, 2) not null default 0, dai_q numeric(16, 2) not null default 0, iva_q numeric(16, 2) not null default 0, gastos_q numeric(16, 2) not null default 0,
  costo_total_q numeric(16, 2) not null default 0, costo_unitario_q numeric(16, 4) not null default 0
);
create table if not exists public.com_gastos (
  id bigint generated always as identity primary key, poliza_id bigint not null references public.com_polizas (id) on delete cascade,
  tipo text not null check (tipo in ('AGENTE ADUANAL', 'ALMACENAJE', 'TRANSPORTE INTERNO', 'MANEJO Y ESTIBA', 'FLETE LOCAL', 'SEGURO LOCAL', 'TRÁMITES', 'OTROS')),
  proveedor text, documento text, fecha date, monto_q numeric(14, 2) not null check (monto_q >= 0), iva_q numeric(14, 2) not null default 0, al_costo boolean not null default true
);
-- Numeración y protección: una póliza liquidada o ingresada ya no se modifica.
create or replace function public.com_preparar_poliza() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4810, new.localidad_id::integer);
    new.numero := coalesce((select max(numero) from public.com_polizas where localidad_id = new.localidad_id), 0) + 1;
    new.usuario := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
    new.estado := 'REGISTRADA';
  elsif current_setting('fin.comercio', true) is distinct from 'si' then
    if old.estado <> 'REGISTRADA' then raise exception 'La póliza % está %: ya no se modifica.', old.numero, lower(old.estado); end if;
    new.estado := old.estado; new.numero := old.numero;
  end if;
  return new;
end;
$$;
drop trigger if exists com_polizas_preparar on public.com_polizas;
create trigger com_polizas_preparar before insert or update on public.com_polizas for each row execute function public.com_preparar_poliza();
create or replace function public.com_validar_detalle() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_estado text;
begin
  select estado into v_estado from public.com_polizas where id = coalesce(new.poliza_id, old.poliza_id);
  if v_estado <> 'REGISTRADA' and current_setting('fin.comercio', true) is distinct from 'si' then raise exception 'La póliza está %: no se cambia su detalle.', lower(v_estado); end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists com_poliza_lineas_validar on public.com_poliza_lineas;
create trigger com_poliza_lineas_validar before insert or update or delete on public.com_poliza_lineas for each row execute function public.com_validar_detalle();
drop trigger if exists com_gastos_validar on public.com_gastos;
create trigger com_gastos_validar before insert or update or delete on public.com_gastos for each row execute function public.com_validar_detalle();

-- Liquidación: el costo de cada línea (calculado en la pantalla con el prorrateo) se guarda y la póliza queda LIQUIDADA.
create or replace function public.com_liquidar_poliza(p_id bigint, p_lineas jsonb, p_totales jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare p public.com_polizas; x jsonb;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para liquidar pólizas.'; end if;
  select * into p from public.com_polizas where id = p_id for update;
  if p.estado <> 'REGISTRADA' then raise exception 'La póliza % ya está %.', p.numero, lower(p.estado); end if;
  if not exists (select 1 from public.com_poliza_lineas where poliza_id = p.id) then raise exception 'La póliza no tiene productos.'; end if;
  perform set_config('fin.comercio', 'si', true);
  for x in select * from jsonb_array_elements(p_lineas) loop
    update public.com_poliza_lineas set fob_q = (x->>'fob_q')::numeric, flete_q = (x->>'flete_q')::numeric, seguro_q = (x->>'seguro_q')::numeric, cif_q = (x->>'cif_q')::numeric,
      dai_pct = (x->>'dai_pct')::numeric, dai_q = (x->>'dai_q')::numeric, iva_q = (x->>'iva_q')::numeric, gastos_q = (x->>'gastos_q')::numeric,
      costo_total_q = (x->>'costo_total_q')::numeric, costo_unitario_q = (x->>'costo_unitario_q')::numeric
    where id = (x->>'id')::bigint and poliza_id = p.id;
  end loop;
  update public.com_polizas set cif_q = (p_totales->>'cif_q')::numeric, dai_q = (p_totales->>'dai_q')::numeric, iva_q = (p_totales->>'iva_q')::numeric, gastos_q = (p_totales->>'gastos_q')::numeric,
    costo_total_q = (p_totales->>'costo_total_q')::numeric, estado = 'LIQUIDADA', liquidada_por = coalesce((select upper(u.usuario) from public.perfiles u where u.id = (select auth.uid())), 'SISTEMA'), liquidada_en = now()
  where id = p.id;
  perform set_config('fin.comercio', '', true);
end;
$$;
-- Ingreso a inventario: cada línea con producto entra a la bodega de la póliza al costo unitario liquidado (con lote y vencimiento).
alter table public.inventario_movimientos drop constraint if exists inventario_movimientos_origen_check;
alter table public.inventario_movimientos add constraint inventario_movimientos_origen_check check (origen = any (array['INGRESO', 'COMPRA', 'NOTA', 'CONSIGNACIÓN', 'AJUSTE', 'DESPACHO', 'TRASLADO', 'VENTA', 'DEVOLUCIÓN', 'CAMBIO', 'CUENTA AJENA', 'PEDIDO', 'ORDEN', 'IMPORTACIÓN']));
alter table public.inventario_movimientos add column if not exists importacion_linea_id bigint;
create or replace function public.com_ingresar_inventario(p_id bigint) returns integer language plpgsql security definer set search_path = '' as $$
declare p public.com_polizas; v_n integer; v_quien text := coalesce((select upper(u.usuario) from public.perfiles u where u.id = (select auth.uid())), 'SISTEMA');
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para ingresar inventario.'; end if;
  select * into p from public.com_polizas where id = p_id for update;
  if p.estado <> 'LIQUIDADA' then raise exception 'Primero liquida la póliza (está %).', lower(p.estado); end if;
  if p.bodega_id is null then raise exception 'Elige la bodega de ingreso en la póliza.'; end if;
  insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, lote, fecha_vencimiento, usuario, importacion_linea_id, documento_fisico, observaciones)
  select p.organizacion_id, p.localidad_id, l.producto_id, p.bodega_id, coalesce(p.fecha_llegada, p.fecha), l.cantidad, l.costo_unitario_q, 'IMPORTACIÓN', coalesce(l.lote, ''), l.fecha_vencimiento, v_quien, l.id,
         coalesce(p.duca, 'PÓLIZA ' || p.numero), 'IMPORTACIÓN ' || p.numero || ' · ' || p.proveedor_nombre
  from public.com_poliza_lineas l where l.poliza_id = p.id and l.producto_id is not null;
  get diagnostics v_n = row_count;
  perform set_config('fin.comercio', 'si', true);
  update public.com_polizas set estado = 'INGRESADA', ingresada_por = v_quien, ingresada_en = now() where id = p.id;
  perform set_config('fin.comercio', '', true);
  return v_n;
end;
$$;
create or replace function public.com_anular_poliza(p_id bigint, p_motivo text) returns void language plpgsql security definer set search_path = '' as $$
declare p public.com_polizas;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para anular pólizas.'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escribe el motivo de la anulación.'; end if;
  select * into p from public.com_polizas where id = p_id for update;
  if p.estado = 'INGRESADA' then raise exception 'La póliza ya entró al inventario: registra un ajuste de salida antes de anularla.'; end if;
  perform set_config('fin.comercio', 'si', true);
  update public.com_polizas set estado = 'ANULADA', anulada_por = coalesce((select upper(u.usuario) from public.perfiles u where u.id = (select auth.uid())), 'SISTEMA'), motivo_anulacion = trim(p_motivo) where id = p.id;
  perform set_config('fin.comercio', '', true);
end;
$$;

-- ============ Exportaciones y embarques ============
create table if not exists public.com_exportaciones (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, duca text, fecha date not null default current_date, aduana_id bigint references public.com_aduanas (id), agente_id bigint references public.com_agentes (id),
  transportista_id bigint references public.com_transportistas (id), cliente_nombre text not null, pais_destino text not null, incoterm text references public.com_incoterms (codigo),
  moneda_id bigint, tipo_cambio numeric(12, 6) not null default 1, factura text, documento_transporte text,
  valor_fob numeric(16, 2) not null default 0, flete numeric(16, 2) not null default 0, seguro numeric(16, 2) not null default 0, valor_total numeric(16, 2) not null default 0, valor_q numeric(16, 2) not null default 0,
  estado text not null default 'REGISTRADA' check (estado in ('REGISTRADA', 'DESPACHADA', 'ANULADA')), observaciones text, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.com_exportacion_lineas (
  id bigint generated always as identity primary key, exportacion_id bigint not null references public.com_exportaciones (id) on delete cascade,
  linea integer not null, producto_id bigint, descripcion text not null, partida_id bigint references public.com_partidas (id), cantidad numeric(14, 3) not null check (cantidad > 0), peso numeric(14, 3) not null default 0, valor numeric(16, 2) not null default 0
);
create table if not exists public.com_embarques (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, tipo text not null check (tipo in ('IMPORTACIÓN', 'EXPORTACIÓN')), poliza_id bigint references public.com_polizas (id), exportacion_id bigint references public.com_exportaciones (id),
  transportista_id bigint references public.com_transportistas (id), documento_transporte text, contenedor text, puerto_origen text, puerto_destino text,
  fecha_embarque date, eta date, fecha_llegada date, estado text not null default 'EN TRÁNSITO' check (estado in ('PROGRAMADO', 'EN TRÁNSITO', 'EN PUERTO', 'EN ADUANA', 'LIBERADO', 'ENTREGADO')),
  bitacora jsonb not null default '[]', observaciones text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create or replace function public.com_numerar() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(4811, new.localidad_id::integer);
  if tg_table_name = 'com_exportaciones' then new.numero := coalesce((select max(numero) from public.com_exportaciones where localidad_id = new.localidad_id), 0) + 1; new.usuario := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  else new.numero := coalesce((select max(numero) from public.com_embarques where localidad_id = new.localidad_id), 0) + 1; end if;
  return new;
end;
$$;
drop trigger if exists com_exportaciones_numerar on public.com_exportaciones;
create trigger com_exportaciones_numerar before insert on public.com_exportaciones for each row execute function public.com_numerar();
drop trigger if exists com_embarques_numerar on public.com_embarques;
create trigger com_embarques_numerar before insert on public.com_embarques for each row execute function public.com_numerar();

-- Catálogos por omisión de la empresa (partidas frecuentes y transportistas).
create or replace function public.com_asegurar_catalogos(p_localidad bigint) returns void language plpgsql security definer set search_path = '' as $$
declare v_org bigint;
begin
  select organizacion_id into v_org from public.localidades where id = p_localidad;
  insert into public.com_partidas (organizacion_id, localidad_id, codigo, descripcion, dai, observaciones)
  select v_org, p_localidad, x.c, x.d, x.dai, x.o from (values
    ('3004.90.00', 'MEDICAMENTOS DOSIFICADOS PARA USO HUMANO', 0, 'Verificar el DAI vigente en el arancel SAC'), ('3002.15.00', 'PRODUCTOS INMUNOLÓGICOS DOSIFICADOS', 0, null),
    ('3005.90.00', 'GASAS, VENDAS Y ARTÍCULOS ANÁLOGOS', 5, null), ('9018.31.00', 'JERINGAS', 0, null), ('9018.39.00', 'AGUJAS, CATÉTERES Y CÁNULAS', 0, null),
    ('3926.20.00', 'GUANTES Y PRENDAS DE PLÁSTICO', 10, null), ('4015.19.00', 'GUANTES DE CAUCHO', 5, null), ('8471.30.00', 'COMPUTADORAS PORTÁTILES', 0, null)) as x(c, d, dai, o)
  on conflict (localidad_id, codigo) do nothing;
end;
$$;

-- ============ Auditoría, permisos y menú ============
do $$
declare t text;
begin
  foreach t in array array['com_agentes', 'com_partidas', 'com_transportistas', 'com_polizas', 'com_exportaciones', 'com_embarques'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.auditar()', t || '_auditar', t);
  end loop;
  foreach t in array array['com_aduanas', 'com_incoterms', 'com_agentes', 'com_partidas', 'com_transportistas', 'com_polizas', 'com_poliza_lineas', 'com_gastos', 'com_exportaciones', 'com_exportacion_lineas', 'com_embarques'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (true)', t, t);
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
revoke execute on function public.com_preparar_poliza() from public, anon, authenticated;
revoke execute on function public.com_validar_detalle() from public, anon, authenticated;
revoke execute on function public.com_numerar() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['public.com_liquidar_poliza(bigint, jsonb, jsonb)', 'public.com_ingresar_inventario(bigint)', 'public.com_anular_poliza(bigint, text)', 'public.com_asegurar_catalogos(bigint)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
do $$
declare v_mod bigint; v_ref bigint; v_id bigint; v_orden integer; o record;
begin
  select id into v_mod from public.modulos_sistema where siglas = 'IMP' order by codigo limit 1;
  if v_mod is null then raise notice 'No existe el módulo IMP: se omite el menú.'; return; end if;
  select id into v_ref from public.opciones_sistema where clave = 'facturas-compra' order by id limit 1;
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  for o in select * from (values
    (1, 'catalogos', 'Aduanas', 'com-agentes', 'Agentes aduanales'), (2, 'catalogos', 'Aduanas', 'com-aduanas', 'Aduanas'), (3, 'catalogos', 'Aduanas', 'com-incoterms', 'Incoterms'),
    (4, 'catalogos', 'Aranceles', 'com-partidas', 'Partidas arancelarias'), (5, 'catalogos', 'Aranceles', 'com-transportistas', 'Navieras y transportistas'),
    (6, 'registros', 'Comercio exterior', 'com-polizas', 'Pólizas de importación'), (7, 'registros', 'Comercio exterior', 'com-exportaciones', 'Exportaciones'), (8, 'registros', 'Comercio exterior', 'com-embarques', 'Embarques'),
    (9, 'procesos', 'Importaciones', 'com-liquidacion', 'Liquidación de pólizas'),
    (10, 'reportes', 'Reportes', 'com-importaciones-periodo', 'Importaciones por período'), (11, 'reportes', 'Reportes', 'com-costo-poliza', 'Costo por póliza'), (12, 'reportes', 'Reportes', 'com-exportaciones-destino', 'Exportaciones por destino'), (13, 'reportes', 'Reportes', 'com-tributos-aduana', 'Tributos de aduana')) as x(n, grupo, subgrupo, clave, nombre) loop
    select id into v_id from public.opciones_sistema where modulo_id = v_mod and clave = o.clave;
    if v_id is null then insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values (v_mod, o.grupo, o.subgrupo, o.clave, o.nombre, v_orden + o.n) returning id into v_id;
    else update public.opciones_sistema set grupo = o.grupo, subgrupo = o.subgrupo, nombre = o.nombre, activo = true where id = v_id; end if;
    if v_ref is not null then
      insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
      select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = v_ref on conflict do nothing;
    end if;
  end loop;
end;
$$;
notify pgrst, 'reload schema';
select 'Importaciones y exportaciones: catálogos, pólizas con costeo, liquidación, ingreso a inventario, exportaciones y embarques instalados.' as resultado;
