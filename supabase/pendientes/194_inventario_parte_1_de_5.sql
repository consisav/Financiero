-- Script 194 · parte 1 de 5: columnas y tablas nuevas; tipos de medida, tipos de precio, clasificaciones, motivos de ajuste,
--   tipos de movimiento, tipos de característica y presentaciones de la organización 2. Luego las partes 2 a 5 (tipos de producto). Se puede ejecutar de nuevo.
-- Columnas y tablas nuevas.
alter table public.tipos_medida add column if not exists codigo_anterior integer;
alter table public.tipos_precio add column if not exists codigo_anterior integer;
alter table public.tipos_precio add column if not exists factor_valor numeric(12, 4);
alter table public.clasificaciones_producto add column if not exists codigo_anterior integer;
alter table public.clasificaciones_producto add column if not exists utilizar_lote boolean not null default false;
alter table public.clasificaciones_producto add column if not exists cuenta_codigo_anterior text;
alter table public.clasificaciones_producto add column if not exists version_cuenta_anterior integer;
alter table public.clasificaciones_producto add column if not exists tipo_anterior text;
alter table public.clasificaciones_producto add column if not exists clasificacion_venta_anterior text;
alter table public.tipos_producto add column if not exists codigo_anterior integer;
alter table public.tipos_producto add column if not exists cuenta_inventarios_anterior text;
alter table public.tipos_producto add column if not exists cuenta_facturacion_anterior text;
alter table public.tipos_producto add column if not exists version_anterior integer;
alter table public.motivos_ajuste add column if not exists codigo_anterior integer;
alter table public.presentaciones_producto add column if not exists codigo_anterior integer;
create index if not exists tipos_producto_codigo_anterior_idx on public.tipos_producto (localidad_id, codigo_anterior);

-- Tipos de movimiento propios de cada organización (el sistema anterior de cada una tiene su propia lista).
create table if not exists public.tipos_movimiento_organizacion (
  organizacion_id bigint not null references public.organizaciones (id),
  codigo          integer not null,
  descripcion     text not null,
  siglas          text,
  tipo_operacion  integer not null default 0 check (tipo_operacion in (-1, 0, 1)),
  clasificacion   text,
  primary key (organizacion_id, codigo)
);
alter table public.tipos_movimiento_organizacion enable row level security;
drop policy if exists "tipos_movimiento_organizacion: leer" on public.tipos_movimiento_organizacion;
create policy "tipos_movimiento_organizacion: leer" on public.tipos_movimiento_organizacion for select to authenticated using (public.usuario_activo());
grant select on public.tipos_movimiento_organizacion to authenticated;

-- Tipos de característica de los productos (color, peso, tamaño…), por organización.
create table if not exists public.tipos_caracteristica (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  codigo          integer not null,
  nombre          text not null check (length(trim(nombre)) > 0),
  activo          boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (organizacion_id, codigo)
);
drop trigger if exists tipos_caracteristica_auditar on public.tipos_caracteristica;
create trigger tipos_caracteristica_auditar before insert or update on public.tipos_caracteristica for each row execute function public.auditar();
alter table public.tipos_caracteristica enable row level security;
drop policy if exists "tipos_caracteristica: leer" on public.tipos_caracteristica;
drop policy if exists "tipos_caracteristica: crear" on public.tipos_caracteristica;
drop policy if exists "tipos_caracteristica: modificar" on public.tipos_caracteristica;
create policy "tipos_caracteristica: leer" on public.tipos_caracteristica for select to authenticated using (public.usuario_activo());
create policy "tipos_caracteristica: crear" on public.tipos_caracteristica for insert to authenticated with check (public.puede_editar_catalogos());
create policy "tipos_caracteristica: modificar" on public.tipos_caracteristica for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());
grant select, insert, update on public.tipos_caracteristica to authenticated;

do $migra$
declare
  v_org bigint; r record; v_loc bigint; v_id bigint; v_cla bigint; v_cta bigint; v_cf bigint;
  m_n int := 0; m_a int := 0; p_n int := 0; p_a int := 0; c_n int := 0; c_a int := 0; t_n int := 0; t_a int := 0; t_s int := 0;
  a_n int := 0; a_a int := 0; v_n int := 0; k_n int := 0; k_a int := 0; e_n int := 0; e_a int := 0; v_l record;
begin
  select id into v_org from public.organizaciones where codigo = '2';
  if v_org is null then raise notice 'No existe la organización 2.'; return; end if;

  -- Tipos de medida
  for r in select * from (values
    (1, 1, 'UNIDADES'),
    (1, 2, 'CAJAS'),
    (1, 3, 'PAQUETES'),
    (1, 4, 'GRAMOS'),
    (1, 5, 'GALON'),
    (1, 6, 'BOLSAS'),
    (1, 7, 'GALONES'),
    (1, 8, 'MILILITROS'),
    (1, 9, 'LITROS'),
    (1, 10, 'CC'),
    (1, 11, 'CLINDRO'),
    (1, 12, 'PAR'),
    (3, 1, 'UNIDADES'),
    (3, 2, 'CAJAS'),
    (3, 3, 'PAQUETES'),
    (3, 4, 'GRAMOS'),
    (3, 5, 'GALON'),
    (3, 6, 'BOLSAS'),
    (3, 7, 'GALONES'),
    (3, 8, 'MILILITROS'),
    (3, 9, 'LITROS'),
    (3, 10, 'CC'),
    (3, 11, 'CLINDRO'),
    (3, 12, 'PAR')) as x(loc, codigo, nombre) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then raise notice 'No existe la localidad 2-0%.', r.loc; continue; end if;
    v_id := null;
    select id into v_id from public.tipos_medida where localidad_id = v_loc and codigo_anterior = r.codigo;
    if v_id is null then select id into v_id from public.tipos_medida where localidad_id = v_loc and upper(nombre) = upper(r.nombre) and codigo_anterior is null limit 1; end if;
    if v_id is null then
      insert into public.tipos_medida (organizacion_id, localidad_id, codigo, nombre, codigo_anterior)
      values (v_org, v_loc, case when exists (select 1 from public.tipos_medida where localidad_id = v_loc and codigo = r.codigo) then (select greatest(coalesce(max(codigo), 0), case r.loc when 1 then 12 when 3 then 12 else 0 end) + 1 from public.tipos_medida where localidad_id = v_loc) else r.codigo end,
        r.nombre, r.codigo)
      returning id into v_id;
      m_n := m_n + 1;
    else
      m_a := m_a + 1;
    end if;
    update public.tipos_medida set codigo_anterior = r.codigo,
      nombre = case when exists (select 1 from public.tipos_medida o where o.localidad_id = v_loc and upper(o.nombre) = upper(r.nombre) and o.id <> v_id) then nombre else r.nombre end
    where id = v_id;
  end loop;

  -- Tipos de precio (FACTOR 1 = Normal)
  for r in select * from (values
    (1, 1, 'SANATORIO', 0, 0, 1, true),
    (1, 2, 'E P S S', 0, 0, 1, true),
    (1, 5, 'SEGUROS', 0, 0, 1, true),
    (1, 7, 'PALIG', 0, 0, 1, true),
    (1, 8, 'ASEGURADORA GENERAL', 0, 0, 1, true),
    (1, 9, 'SEGUROS UNIVERSALES', 0, 0, 1, false),
    (1, 10, 'MAPFRE', 0, 0, 1, false),
    (1, 11, 'PANAMERICAN-LIFE', 0, 0, 1, false),
    (1, 12, 'BUPA', 0, 0, 1, false),
    (1, 13, 'IGS', 0, 0, 1, false),
    (1, 14, 'IMB', 0, 0, 1, false),
    (1, 15, 'EBS', 0, 0, 1, false),
    (1, 16, 'SEGURO ESCOLAR', 0, 0, 1, true),
    (1, 17, 'CLINICA VIDA', 0, 0, 1, true),
    (2, 1, 'SANATORIO', 0, 0, 1, true),
    (2, 2, 'E P S S', 0, 0, 1, true),
    (2, 5, 'SEGUROS', 0, 0, 1, true),
    (2, 7, 'PALIG', 0, 0, 1, true),
    (2, 8, 'ASEGURADORA GENERAL', 0, 0, 1, true),
    (2, 9, 'SEGUROS UNIVERSALES', 0, 0, 1, false),
    (3, 1, 'SANATORIO', 0, 0, 1, true),
    (3, 2, 'E P S S', 0, 0, 1, true),
    (3, 5, 'SEGUROS', 0, 0, 1, true),
    (3, 7, 'PALIG', 0, 0, 1, true),
    (3, 8, 'ASEGURADORA GENERAL', 0, 0, 1, true),
    (3, 16, 'SEGURO ESCOLAR', 0, 0, 1, true)) as x(loc, codigo, nombre, utilidad, descuento, factor, activo) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then raise notice 'No existe la localidad 2-0%.', r.loc; continue; end if;
    v_id := null;
    select id into v_id from public.tipos_precio where localidad_id = v_loc and codigo_anterior = r.codigo;
    if v_id is null then select id into v_id from public.tipos_precio where localidad_id = v_loc and upper(nombre) = upper(r.nombre) and codigo_anterior is null limit 1; end if;
    if v_id is null then
      insert into public.tipos_precio (organizacion_id, localidad_id, codigo, nombre, codigo_anterior, pct_utilidad, pct_descuento, factor, factor_valor, activo)
      values (v_org, v_loc, case when exists (select 1 from public.tipos_precio where localidad_id = v_loc and codigo = r.codigo) then (select greatest(coalesce(max(codigo), 0), case r.loc when 1 then 17 when 2 then 9 when 3 then 16 else 0 end) + 1 from public.tipos_precio where localidad_id = v_loc) else r.codigo end,
        r.nombre, r.codigo, r.utilidad, r.descuento, 'NORMAL', r.factor, r.activo)
      returning id into v_id;
      p_n := p_n + 1;
    else
      p_a := p_a + 1;
    end if;
    update public.tipos_precio set codigo_anterior = r.codigo,
      nombre = case when exists (select 1 from public.tipos_precio o where o.localidad_id = v_loc and upper(o.nombre) = upper(r.nombre) and o.id <> v_id) then nombre else r.nombre end, pct_utilidad = r.utilidad, pct_descuento = r.descuento, factor_valor = r.factor, activo = r.activo
    where id = v_id;
  end loop;

  -- Clasificaciones de productos (necesarias para los tipos de producto)
  for r in select * from (values
    (1, 1, 'BANCO DE SANGRE', 'SERVICIO', 'S', '4010102008', 1, false, 'INTERNO', false, 'S'),
    (1, 2, 'GASTOS EN EMERGENCIA', 'SERVICIO', 'S', '4010102011', 1, true, 'INTERNO', false, 'S'),
    (1, 3, 'HABITACIONES', 'SERVICIO', 'S', '4010102001', 1, false, 'INTERNO', false, 'S'),
    (1, 4, 'IMAGENES', 'SERVICIO', 'S', '4010102002', 1, false, 'INTERNO', false, 'S'),
    (1, 5, 'LABORATORIO', 'SERVICIO', 'L', '4010102003', 1, false, 'INTERNO', true, 'S'),
    (1, 6, 'HONORARIOS MEDICOS', 'SERVICIO', 'S', '4010102010', 1, false, 'EXTERNO', false, 'S'),
    (1, 7, 'RAYOS X', 'SERVICIO', 'S', '4010102002', 1, false, 'INTERNO', false, 'S'),
    (1, 8, 'SERVICIOS EXTERNOS', 'SERVICIO', 'S', '4010102008', 1, false, 'EXTERNO', false, 'S'),
    (1, 9, 'SERVICIOS ORTOPEDICOS', 'SERVICIO', 'S', '4010101003', null, false, 'INTERNO', false, 'S'),
    (1, 10, 'USO DE EQUIPO', 'SERVICIO', 'S', '4010102007', 1, false, 'INTERNO', false, 'S'),
    (1, 11, 'VACUNAS', 'PRODUCTO', 'P', '4010101003', null, false, 'INTERNO', false, 'S'),
    (1, 12, 'INSUMOS', 'PRODUCTO', 'P', '4010101002', 1, true, 'INTERNO', true, 'S'),
    (1, 13, 'MEDICAMENTOS', 'PRODUCTO', 'P', '4010101001', 1, true, 'INTERNO', false, 'S'),
    (1, 14, 'GASTOS SALA DE OPERACION', 'PRODUCTO', 'P', '4010102012', 1, true, 'INTERNO', false, 'S'),
    (1, 15, 'INSUMOS DE LIMPIEZA', 'PRODUCTO', 'P', null, null, false, 'INTERNO', false, 'S'),
    (1, 16, 'PAQUETES HOSPITALARIOS', 'SERVICIO', 'S', null, null, false, 'INTERNO', false, 'S'),
    (1, 17, 'OTROS SERVICIOS', 'SERVICIO', 'S', '4010101003', 1, false, 'INTERNO', false, 'S'),
    (1, 18, 'DAÑOS A LA HABITACION', 'SERVICIO', 'S', '4010101003', 1, false, 'INTERNO', false, 'S'),
    (1, 19, 'INSUMOS TECNOLÓGICOS', 'PRODUCTO', 'P', null, null, true, 'INTERNO', false, 'S'),
    (1, 20, 'PRODUCTOS MANTENIMIENTO', 'PRODUCTO', 'P', null, null, false, 'INTERNO', false, 'S'),
    (1, 21, 'PATOLOGIAS', 'SERVICIO', 'T', '4010102003', null, false, 'INTERNO', true, 'S'),
    (1, 22, 'TRAUMA', 'SERVICIO', 'S', null, null, false, 'INTERNO', false, 'S'),
    (1, 23, 'CIRUGÍA', 'SERVICIO', 'S', '4010102012', null, false, 'INTERNO', false, 'S'),
    (2, 1, 'BANCO DE SANGRE', 'SERVICIO', 'S', '4010102008', 1, false, 'INTERNO', false, 'S'),
    (2, 2, 'GASTOS EN EMERGENCIA', 'SERVICIO', 'S', '4010102011', 1, true, 'INTERNO', false, 'S'),
    (2, 3, 'HABITACIONES', 'SERVICIO', 'S', '4010102001', 1, false, 'INTERNO', false, 'S'),
    (2, 4, 'IMAGENES', 'SERVICIO', 'S', '4010102002', 1, false, 'INTERNO', false, 'S'),
    (2, 5, 'LABORATORIO', 'SERVICIO', 'L', '4010102003', 1, false, 'INTERNO', true, 'S'),
    (2, 6, 'HONORARIOS MEDICOS', 'SERVICIO', 'S', '4010102010', 1, false, 'EXTERNO', false, 'S'),
    (2, 7, 'RAYOS X', 'SERVICIO', 'S', '4010102002', 1, false, 'INTERNO', false, 'S'),
    (2, 8, 'SERVICIOS EXTERNOS', 'SERVICIO', 'S', '4010102008', 1, false, 'EXTERNO', false, 'S'),
    (2, 9, 'SERVICIOS ORTOPEDICOS', 'SERVICIO', 'S', null, null, false, 'INTERNO', false, 'S'),
    (2, 10, 'USO DE EQUIPO', 'SERVICIO', 'S', '4010102007', 1, false, 'INTERNO', false, 'S'),
    (2, 11, 'VACUNAS', 'PRODUCTO', 'P', null, null, false, 'INTERNO', false, 'S'),
    (2, 12, 'INSUMOS', 'PRODUCTO', 'P', '4010101002', 1, true, 'INTERNO', true, 'S'),
    (2, 13, 'MEDICAMENTOS', 'PRODUCTO', 'P', '4010101001', 1, true, 'INTERNO', true, 'S'),
    (2, 14, 'GASTOS SALA DE OPERACION', 'PRODUCTO', 'P', '4010102012', 1, true, 'INTERNO', false, 'S'),
    (2, 15, 'INSUMOS DE LIMPIEZA', 'PRODUCTO', 'P', null, null, false, 'INTERNO', false, 'S'),
    (2, 16, 'PAQUETES HOSPITALARIOS', 'SERVICIO', 'S', null, null, false, 'INTERNO', false, 'S'),
    (2, 17, 'OTROS SERVICIOS', 'SERVICIO', 'S', '4010101003', 1, false, 'INTERNO', false, 'S'),
    (2, 18, 'DAÑOS A LA HABITACION', 'SERVICIO', 'S', null, 1, false, 'INTERNO', false, 'S'),
    (3, 1, 'BANCO DE SANGRE', 'SERVICIO', 'S', '4010102008', 1, false, 'INTERNO', false, 'S'),
    (3, 2, 'GASTOS EN EMERGENCIA', 'SERVICIO', 'S', '4010102011', 1, true, 'INTERNO', false, 'S'),
    (3, 3, 'HABITACIONES', 'SERVICIO', 'S', '4010102001', 1, false, 'INTERNO', false, 'S'),
    (3, 4, 'IMAGENES', 'SERVICIO', 'S', '4010102002', 1, false, 'INTERNO', false, 'S'),
    (3, 5, 'LABORATORIO', 'SERVICIO', 'L', '4010102003', 1, false, 'INTERNO', true, 'S'),
    (3, 6, 'HONORARIOS MEDICOS', 'SERVICIO', 'S', '4010102010', 1, false, 'EXTERNO', false, 'S'),
    (3, 7, 'RAYOS X', 'SERVICIO', 'S', '4010102002', 1, false, 'INTERNO', false, 'S'),
    (3, 8, 'SERVICIOS EXTERNOS', 'SERVICIO', 'S', '4010102008', 1, false, 'EXTERNO', false, 'S'),
    (3, 9, 'SERVICIOS ORTOPEDICOS', 'SERVICIO', 'S', null, null, false, 'INTERNO', false, 'S'),
    (3, 10, 'USO DE EQUIPO', 'SERVICIO', 'S', '4010102007', 1, false, 'INTERNO', false, 'S'),
    (3, 11, 'VACUNAS', 'PRODUCTO', 'P', '4010101003', null, false, 'INTERNO', false, 'S'),
    (3, 12, 'INSUMOS', 'PRODUCTO', 'P', '4010101002', 1, true, 'INTERNO', true, 'B'),
    (3, 13, 'MEDICAMENTOS', 'PRODUCTO', 'P', '4010101001', 1, true, 'INTERNO', true, 'B'),
    (3, 14, 'GASTOS SALA DE OPERACION', 'PRODUCTO', 'P', '4010102012', 1, true, 'INTERNO', false, 'S'),
    (3, 15, 'INSUMOS DE LIMPIEZA', 'PRODUCTO', 'P', '4010101003', null, false, 'INTERNO', false, 'B'),
    (3, 16, 'PAQUETES HOSPITALARIOS', 'SERVICIO', 'S', '4010101003', null, false, 'INTERNO', false, 'S'),
    (3, 17, 'OTROS SERVICIOS', 'SERVICIO', 'S', '4010101003', 1, false, 'INTERNO', false, 'S'),
    (3, 18, 'DAÑOS A LA HABITACION', 'SERVICIO', 'S', '4010101003', 1, false, 'INTERNO', false, 'S'),
    (3, 19, 'INSUMOS TECNOLÓGICOS', 'PRODUCTO', 'P', '4010101003', null, false, 'INTERNO', false, 'B'),
    (3, 20, 'PRODUCTOS MANTENIMIENTO', 'PRODUCTO', 'P', '4010101003', null, false, 'INTERNO', false, 'B'),
    (3, 21, 'PATOLOGIAS', 'SERVICIO', 'T', '4010101003', null, false, 'INTERNO', false, 'S'),
    (3, 22, 'TRAUMA', 'SERVICIO', 'S', '4010101003', null, false, 'INTERNO', false, 'S'),
    (3, 23, 'CIRUGÍA', 'SERVICIO', 'S', '4010101003', null, false, 'INTERNO', false, 'S')) as x(loc, codigo, nombre, tipo, tipo_ant, cuenta, version, inventario, servicio, laboratorio, venta) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then raise notice 'No existe la localidad 2-0%.', r.loc; continue; end if;
    v_id := null;
    select id into v_id from public.clasificaciones_producto where localidad_id = v_loc and codigo_anterior = r.codigo;
    if v_id is null then select id into v_id from public.clasificaciones_producto where localidad_id = v_loc and upper(nombre) = upper(r.nombre) and codigo_anterior is null limit 1; end if;
    if v_id is null then
      insert into public.clasificaciones_producto (organizacion_id, localidad_id, codigo, nombre, codigo_anterior, tipo, tipo_servicio, inventario, laboratorio)
      values (v_org, v_loc, case when exists (select 1 from public.clasificaciones_producto where localidad_id = v_loc and codigo = r.codigo) then (select greatest(coalesce(max(codigo), 0), case r.loc when 1 then 23 when 2 then 18 when 3 then 23 else 0 end) + 1 from public.clasificaciones_producto where localidad_id = v_loc) else r.codigo end,
        r.nombre, r.codigo, r.tipo, r.servicio, coalesce(r.inventario, true), coalesce(r.laboratorio, false))
      returning id into v_id;
      c_n := c_n + 1;
    else
      c_a := c_a + 1;
    end if;
    update public.clasificaciones_producto set codigo_anterior = r.codigo,
      nombre = case when exists (select 1 from public.clasificaciones_producto o where o.localidad_id = v_loc and upper(o.nombre) = upper(r.nombre) and o.id <> v_id) then nombre else r.nombre end, tipo = r.tipo, tipo_servicio = r.servicio, inventario = coalesce(r.inventario, true), laboratorio = coalesce(r.laboratorio, false),
      tipo_anterior = r.tipo_ant, cuenta_codigo_anterior = r.cuenta, version_cuenta_anterior = r.version, clasificacion_venta_anterior = r.venta,
      cuenta_id = coalesce((select c.id from public.cuentas c where c.codigo = r.cuenta and public.cuenta_de_localidad(c.id, v_loc) limit 1), cuenta_id)
    where id = v_id;
  end loop;

  -- Presentaciones (el archivo no trae localidad: van en todas las empresas de la organización).
  for v_l in select id from public.localidades where organizacion_id = v_org loop
    for r in select * from (values
      (18, 'VENDA'),
      (22, 'GALON'),
      (24, 'CAJA'),
      (30, 'LITROS'),
      (31, 'BOTE'),
      (32, 'BOLSA'),
      (66, 'AMPOLLA'),
      (67, 'FRASCO'),
      (68, 'SOBRES'),
      (69, 'CAPSULAS'),
      (71, 'DESCARTABLE'),
      (72, 'TABLETA'),
      (73, 'ROLLO'),
      (74, 'BLISTER')) as x(codigo, nombre) loop
      v_id := null;
      select id into v_id from public.presentaciones_producto where localidad_id = v_l.id and codigo_anterior = r.codigo;
      if v_id is null then select id into v_id from public.presentaciones_producto where localidad_id = v_l.id and upper(nombre) = upper(r.nombre) and codigo_anterior is null limit 1; end if;
      if v_id is null then
        insert into public.presentaciones_producto (organizacion_id, localidad_id, codigo, nombre, codigo_anterior)
        values (v_org, v_l.id, case when exists (select 1 from public.presentaciones_producto where localidad_id = v_l.id and codigo = r.codigo)
          then (select greatest(coalesce(max(codigo), 0), 74) + 1 from public.presentaciones_producto where localidad_id = v_l.id) else r.codigo end, r.nombre, r.codigo);
        e_n := e_n + 1;
      else
        update public.presentaciones_producto set codigo_anterior = r.codigo where id = v_id; e_a := e_a + 1;
      end if;
    end loop;
  end loop;

  -- Motivos de ajuste (por organización).
  for r in select * from (values
    (1, 'FALTANTE EN BODEGA'),
    (2, 'PRODUCTO VENCIDO'),
    (3, 'PRODUCTO DAÑADO'),
    (4, 'SOBRANTE'),
    (5, 'TRASLADO INCORRECTO'),
    (6, 'CUADRE INVENTARIO')) as x(codigo, nombre) loop
    v_id := null;
    select id into v_id from public.motivos_ajuste where organizacion_id = v_org and codigo_anterior = r.codigo;
    if v_id is null then select id into v_id from public.motivos_ajuste where organizacion_id = v_org and upper(nombre) = upper(r.nombre) and codigo_anterior is null limit 1; end if;
    if v_id is null then
      insert into public.motivos_ajuste (organizacion_id, codigo, nombre, codigo_anterior)
      values (v_org, case when exists (select 1 from public.motivos_ajuste where organizacion_id = v_org and codigo = r.codigo)
        then (select greatest(coalesce(max(codigo), 0), 6) + 1 from public.motivos_ajuste where organizacion_id = v_org) else r.codigo end, r.nombre, r.codigo)
      returning id into v_id;
      a_n := a_n + 1;
    else
      update public.motivos_ajuste set codigo_anterior = r.codigo where id = v_id; a_a := a_a + 1;
    end if;
  end loop;

  -- Tipos de movimiento de la organización.
  insert into public.tipos_movimiento_organizacion (organizacion_id, codigo, descripcion, siglas, tipo_operacion, clasificacion)
  select v_org, x.* from (values
    (0, 'SIN MOVIMIENTO', 'SMO', 0, 'NUL'),
    (1, 'INGRESO', 'ING', 1, 'IN'),
    (2, 'DESPACHO', 'DES', -1, 'OUT'),
    (3, 'ENTRADA-TRASLADO', 'ETR', 1, 'IN'),
    (4, 'SALIDA-TRASLADO', 'STR', -1, 'OUT'),
    (5, 'ENTRADA-AJUSTE', 'EAJ', 1, 'IN'),
    (6, 'SALIDA-AJUSTE', 'SAJ', -1, 'OUT'),
    (7, 'ANULACION INGRESO', 'ANC', -1, 'OUT'),
    (8, 'ANULACION DESPACHO', 'AND', 1, 'IN'),
    (9, 'ANULACION ENTRADA TRASLADO', 'AET', -1, 'OUT'),
    (10, 'ANULACION SALIDA TRASLADO', 'AST', 1, 'IN'),
    (11, 'ANULACION ENTRADA AJUSTE', 'AEA', -1, 'OUT'),
    (12, 'ANULACION SALIDA AJUSTE', 'ASA', 1, 'IN'),
    (13, 'DEVOLUCIÓN SALIDA', 'SDE', -1, 'OUT'),
    (14, 'ANULACION SALIDA DEVOLUCIÓN', 'AND', 1, 'IN'),
    (15, 'DEVOLUCIÓN ENTRADA', 'EDE', 1, 'IN'),
    (16, 'ANULACION ENTRADA DEVOLUCIÓN', 'AED', -1, 'OUT'),
    (17, 'SALIDA ORDEN', 'SOR', -1, 'OUT'),
    (18, 'ANULACIÓN ORDEN', 'AOR', 1, 'IN'),
    (19, 'SALIDA - FACTURA', 'SFA', -1, 'OUT'),
    (20, 'ANULACION - FACTURA', 'AFA', 1, 'IN'),
    (21, 'CARGA CONSIGNACION', 'CCO', 1, 'IN'),
    (22, 'ANULACION CARGA CONSIGNACION', 'ACC', -1, 'OUT'),
    (23, 'CARGA, PEDIDO POR PACIENTE', 'PPP', 1, 'IN'),
    (24, 'ANULACION DE PEDIDO POR PACIENTE', 'APP', -1, 'OUT'),
    (25, 'DESCARGA, PEDIDO POR PACIENTE', 'DPP', -1, 'OUT')) as x(codigo, descripcion, siglas, tipo_operacion, clasificacion)
  on conflict (organizacion_id, codigo) do update set descripcion = excluded.descripcion, siglas = excluded.siglas, tipo_operacion = excluded.tipo_operacion, clasificacion = excluded.clasificacion;
  get diagnostics v_n = row_count;

  -- Tipos de característica.
  for r in select * from (values
    (1, 'COLOR'),
    (2, 'PESO'),
    (3, 'TAMAÑO')) as x(codigo, nombre) loop
    insert into public.tipos_caracteristica (organizacion_id, codigo, nombre) values (v_org, r.codigo, r.nombre)
    on conflict (organizacion_id, codigo) do update set nombre = excluded.nombre returning id into v_id;
    k_n := k_n + 1;
  end loop;

  raise notice '%', format('Tipos de medida: %s nuevos, %s ya existían. Tipos de precio: %s nuevos, %s ya existían. Clasificaciones: %s nuevas, %s ya existían. Motivos de ajuste: %s nuevos, %s ya existían. Tipos de movimiento: %s. Tipos de característica: %s. Presentaciones: %s nuevas, %s ya existían.',
    m_n, m_a, p_n, p_a, c_n, c_a, a_n, a_a, v_n, k_n, e_n, e_a);
end;
$migra$;

notify pgrst, 'reload schema';
