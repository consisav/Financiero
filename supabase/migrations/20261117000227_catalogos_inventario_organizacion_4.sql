-- Script 227 · Catálogos de inventarios de la organización 4 (Tecnoalsa), de los archivos del sistema anterior
--   («Datos Inventario Tecnoalsa al 04-11-2026»): ACT_TIPOS_MEDIDAS (15: 15 de la 4-01), ACT_TIPOS_PRECIOS (3: 3 de la 4-01),
--   ACT_TIPOS_PRODUCTOS (3: 3 de la 4-01), ACT_TIPOS_CARACTERISTICAS (4) y ACT_PRESENTACIONES (9, sin localidad:
--   van en todas las empresas de la organización 4). Misma lógica del script 194 (organización 2).
--   a) Cada registro se busca por su código anterior y luego por su nombre; si no existe se crea con su código (si ese código ya lo usa
--      otro registro, o es 0, con el siguiente libre). El código del sistema anterior queda en codigo_anterior: así se ligan los productos.
--   b) Clasificaciones de producto: no viene ACT_CLASIFICACION_PRODUCTOS; se crean las que usan los tipos de producto y los productos
--      (4-01 1, 4-01 4), como «CLASIFICACIÓN n», tipo producto, con inventario (creada_al_migrar = true).
--   c) Columnas nuevas: siglas_anterior en tipos_producto (SIGLAS; también va a siglas) y creada_al_migrar en clasificaciones_producto;
--      además las de los scripts 103 y 194 (codigo_anterior, factor_valor, cuentas del sistema anterior) y la tabla tipos_caracteristica.
--   Equivalencias: ESTADO A/I = activo/inactivo; FACTOR 1 = Normal; CUENTA_INVENTARIOS y CUENTA_FACTURACION se ligan si existen en el
--   catálogo de cuentas de la localidad (script 222).
--   Se ejecuta después de los scripts 221 y 222. Puede ejecutarse de nuevo: la segunda vez solo actualiza.
set lock_timeout = '20s';
-- Columnas y tablas nuevas (las de los scripts 103 y 194, y las de este archivo).
alter table public.tipos_medida add column if not exists codigo_anterior integer;
alter table public.tipos_precio add column if not exists codigo_anterior integer;
alter table public.tipos_precio add column if not exists factor_valor numeric(12, 4);
alter table public.clasificaciones_producto add column if not exists codigo_anterior integer;
alter table public.clasificaciones_producto add column if not exists creada_al_migrar boolean not null default false;
alter table public.tipos_producto add column if not exists codigo_anterior integer;
alter table public.tipos_producto add column if not exists cuenta_inventarios_anterior text;
alter table public.tipos_producto add column if not exists cuenta_facturacion_anterior text;
alter table public.tipos_producto add column if not exists version_anterior integer;
alter table public.tipos_producto add column if not exists siglas_anterior text;
alter table public.presentaciones_producto add column if not exists codigo_anterior integer;
create index if not exists tipos_producto_codigo_anterior_idx on public.tipos_producto (localidad_id, codigo_anterior);

-- Tipos de característica de los productos (color, peso, tamaño…), por organización (script 194).
create table if not exists public.tipos_caracteristica (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  codigo          integer not null,
  nombre          text not null check (length(trim(nombre)) > 0),
  activo          boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (organizacion_id, codigo)
);
alter table public.tipos_caracteristica enable row level security;
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'tipos_caracteristica_auditar') then
    create trigger tipos_caracteristica_auditar before insert or update on public.tipos_caracteristica for each row execute function public.auditar();
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tipos_caracteristica' and policyname = 'tipos_caracteristica: leer') then
    create policy "tipos_caracteristica: leer" on public.tipos_caracteristica for select to authenticated using (public.usuario_activo());
    create policy "tipos_caracteristica: crear" on public.tipos_caracteristica for insert to authenticated with check (public.puede_editar_catalogos());
    create policy "tipos_caracteristica: modificar" on public.tipos_caracteristica for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());
  end if;
end $$;
grant select, insert, update on public.tipos_caracteristica to authenticated;

do $migra$
declare
  v_org bigint; r record; v_loc bigint; v_id bigint; v_cla bigint; v_cta bigint; v_cf bigint; v_l record;
  m_n int := 0; m_a int := 0; p_n int := 0; p_a int := 0; c_n int := 0; c_a int := 0; t_n int := 0; t_a int := 0; t_s int := 0;
  k_n int := 0; e_n int := 0; e_a int := 0;
begin
  select id into v_org from public.organizaciones where codigo::text = '4';
  if v_org is null then raise exception 'No existe la organización 4: ejecuta antes el script 221.'; end if;

  -- Tipos de medida (SIN UNIDAD es el código 0: se guarda con el siguiente libre)
  for r in select * from (values
    (1::integer, 0::integer, 'SIN UNIDAD'::text),
    (1, 1, 'CAJA'),
    (1, 2, 'UNIDAD'),
    (1, 3, 'PAQUETES'),
    (1, 4, 'GRAMOS'),
    (1, 5, 'GALON'),
    (1, 6, 'BOLSAS'),
    (1, 7, 'GALONES'),
    (1, 8, 'MILILITROS'),
    (1, 9, 'LITROS'),
    (1, 10, 'CC'),
    (1, 11, 'CILINDROS'),
    (1, 12, 'PAR'),
    (1, 13, 'PZ'),
    (1, 14, 'MT')) as x(loc, codigo, nombre) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then raise notice 'No existe la localidad 4-0%.', r.loc; continue; end if;
    v_id := null;
    select id into v_id from public.tipos_medida where localidad_id = v_loc and codigo_anterior = r.codigo;
    if v_id is null then select id into v_id from public.tipos_medida where localidad_id = v_loc and upper(nombre) = upper(r.nombre) and codigo_anterior is null limit 1; end if;
    if v_id is null then
      insert into public.tipos_medida (organizacion_id, localidad_id, codigo, nombre, codigo_anterior)
      values (v_org, v_loc, case when r.codigo <= 0 or exists (select 1 from public.tipos_medida where localidad_id = v_loc and codigo = r.codigo) then (select greatest(coalesce(max(codigo), 0), case r.loc when 1 then 14 else 0 end) + 1 from public.tipos_medida where localidad_id = v_loc) else r.codigo end,
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
    (1::integer, 1::integer, 'NORMAL'::text, 0::numeric, 0::numeric, 1::numeric, true::boolean),
    (1, 2, 'PRECIO OFERTA', 0, 0, 1, true),
    (1, 3, 'PREFERENCIAL', 0, 0, 1, true)) as x(loc, codigo, nombre, utilidad, descuento, factor, activo) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then raise notice 'No existe la localidad 4-0%.', r.loc; continue; end if;
    v_id := null;
    select id into v_id from public.tipos_precio where localidad_id = v_loc and codigo_anterior = r.codigo;
    if v_id is null then select id into v_id from public.tipos_precio where localidad_id = v_loc and upper(nombre) = upper(r.nombre) and codigo_anterior is null limit 1; end if;
    if v_id is null then
      insert into public.tipos_precio (organizacion_id, localidad_id, codigo, nombre, codigo_anterior, pct_utilidad, pct_descuento, factor, factor_valor, activo)
      values (v_org, v_loc, case when r.codigo <= 0 or exists (select 1 from public.tipos_precio where localidad_id = v_loc and codigo = r.codigo) then (select greatest(coalesce(max(codigo), 0), case r.loc when 1 then 3 else 0 end) + 1 from public.tipos_precio where localidad_id = v_loc) else r.codigo end,
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

  -- Clasificaciones de productos (se crean las que se usan)
  for r in select * from (values
    (1::integer, 1::integer, 'CLASIFICACIÓN 1'::text),
    (1, 4, 'CLASIFICACIÓN 4')) as x(loc, codigo, nombre) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then raise notice 'No existe la localidad 4-0%.', r.loc; continue; end if;
    v_id := null;
    select id into v_id from public.clasificaciones_producto where localidad_id = v_loc and codigo_anterior = r.codigo;
    if v_id is null then select id into v_id from public.clasificaciones_producto where localidad_id = v_loc and upper(nombre) = upper(r.nombre) and codigo_anterior is null limit 1; end if;
    if v_id is null then
      insert into public.clasificaciones_producto (organizacion_id, localidad_id, codigo, nombre, codigo_anterior, tipo, tipo_servicio, inventario, laboratorio, creada_al_migrar)
      values (v_org, v_loc, case when r.codigo <= 0 or exists (select 1 from public.clasificaciones_producto where localidad_id = v_loc and codigo = r.codigo) then (select greatest(coalesce(max(codigo), 0), case r.loc when 1 then 4 else 0 end) + 1 from public.clasificaciones_producto where localidad_id = v_loc) else r.codigo end,
        r.nombre, r.codigo, 'PRODUCTO', 'INTERNO', true, false, true)
      returning id into v_id;
      c_n := c_n + 1;
    else
      c_a := c_a + 1;
    end if;
    update public.clasificaciones_producto set codigo_anterior = r.codigo,
      nombre = case when exists (select 1 from public.clasificaciones_producto o where o.localidad_id = v_loc and upper(o.nombre) = upper(r.nombre) and o.id <> v_id) then nombre else r.nombre end
    where id = v_id;
  end loop;

  -- Presentaciones (el archivo no trae localidad: van en todas las empresas de la organización).
  for v_l in select id from public.localidades where organizacion_id = v_org loop
    for r in select * from (values
      (1::integer, 'SIN PRESENTACION'::text),
      (2, 'CAJA'),
      (3, 'BOLSA'),
      (4, 'UNIDAD'),
      (5, 'ROLLO'),
      (6, 'PLIEGO'),
      (7, 'SPRAY'),
      (8, 'LIBRA'),
      (9, 'FARDO')) as x(codigo, nombre) loop
      v_id := null;
      select id into v_id from public.presentaciones_producto where localidad_id = v_l.id and codigo_anterior = r.codigo;
      if v_id is null then select id into v_id from public.presentaciones_producto where localidad_id = v_l.id and upper(nombre) = upper(r.nombre) and codigo_anterior is null limit 1; end if;
      if v_id is null then
        insert into public.presentaciones_producto (organizacion_id, localidad_id, codigo, nombre, codigo_anterior)
        values (v_org, v_l.id, case when exists (select 1 from public.presentaciones_producto where localidad_id = v_l.id and codigo = r.codigo)
          then (select greatest(coalesce(max(codigo), 0), 9) + 1 from public.presentaciones_producto where localidad_id = v_l.id) else r.codigo end, r.nombre, r.codigo);
        e_n := e_n + 1;
      else
        update public.presentaciones_producto set codigo_anterior = r.codigo where id = v_id; e_a := e_a + 1;
      end if;
    end loop;
  end loop;

  -- Tipos de característica.
  for r in select * from (values
    (1::integer, 'COLOR'::text),
    (2, 'PESO'),
    (3, 'TAMAÑO'),
    (4, 'MEDIDA')) as x(codigo, nombre) loop
    insert into public.tipos_caracteristica (organizacion_id, codigo, nombre) values (v_org, r.codigo, r.nombre)
    on conflict (organizacion_id, codigo) do update set nombre = excluded.nombre;
    k_n := k_n + 1;
  end loop;

  -- Tipos de producto (en su clasificación, por el código anterior de la clasificación).
  for r in select * from (values
    (1::integer, 1::integer, 'LINEA 101'::text, 1::integer, '11510202'::text, null::text, 1::integer, '101'::text),
    (1, 2, 'LINEA 102', 1, '11510202', null, 1, '102'),
    (1, 3, 'LINEA 103', 1, '11510202', null, 1, '103')) as x(loc, codigo, nombre, clasificacion, c_inv, c_fac, ver, siglas) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then continue; end if;
    v_cla := null;
    select id into v_cla from public.clasificaciones_producto where localidad_id = v_loc and codigo_anterior = r.clasificacion;
    if v_cla is null then t_s := t_s + 1; continue; end if;
    v_cta := null; v_cf := null;
    if r.c_inv is not null then select c.id into v_cta from public.cuentas c where c.codigo = r.c_inv and public.cuenta_de_localidad(c.id, v_loc) limit 1; end if;
    if r.c_fac is not null then select c.id into v_cf from public.cuentas c where c.codigo = r.c_fac and public.cuenta_de_localidad(c.id, v_loc) limit 1; end if;
    v_id := null;
    select id into v_id from public.tipos_producto where localidad_id = v_loc and codigo_anterior = r.codigo;
    if v_id is null then
      insert into public.tipos_producto (clasificacion_id, organizacion_id, localidad_id, codigo, nombre, codigo_anterior)
      values (v_cla, v_org, v_loc, case when exists (select 1 from public.tipos_producto where localidad_id = v_loc and codigo = r.codigo)
        then (select greatest(coalesce(max(codigo), 0), case r.loc when 1 then 30 else 0 end) + 1 from public.tipos_producto where localidad_id = v_loc) else r.codigo end, r.nombre, r.codigo)
      returning id into v_id;
      t_n := t_n + 1;
    else
      t_a := t_a + 1;
    end if;
    update public.tipos_producto set clasificacion_id = v_cla, nombre = r.nombre, codigo_anterior = r.codigo,
      siglas = case when upper(r.siglas) ~ '^[A-Z0-9]{1,6}$' then upper(r.siglas) else siglas end, siglas_anterior = r.siglas,
      cuenta_inventario_id = coalesce(v_cta, cuenta_inventario_id), cuenta_facturacion_id = coalesce(v_cf, cuenta_facturacion_id),
      cuenta_inventarios_anterior = r.c_inv, cuenta_facturacion_anterior = r.c_fac, version_anterior = r.ver
    where id = v_id;
  end loop;

  raise notice '%', format('Organización 4 · Tipos de medida: %s nuevos, %s ya existían. Tipos de precio: %s nuevos, %s ya existían. Clasificaciones: %s nuevas, %s ya existían. Presentaciones: %s nuevas, %s ya existían. Tipos de característica: %s. Tipos de producto: %s nuevos, %s actualizados, %s sin clasificación.',
    m_n, m_a, p_n, p_a, c_n, c_a, e_n, e_a, k_n, t_n, t_a, t_s);
end;
$migra$;

notify pgrst, 'reload schema';
