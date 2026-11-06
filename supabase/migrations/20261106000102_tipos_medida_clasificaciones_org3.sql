-- Tipos de medida y clasificaciones de productos de la organización 3 (Futura Farma - Mavisa), de los
-- archivos «ACT_TIPOS_MEDIDAS.xls» (86: 44 de la 3-01 y 42 de la 3-02) y «ACT_CLASIFICACION_PRODUCTOS.xls»
-- (3: 2 de la 3-01 y 1 de la 3-02).
--   1. Si ya existe en la localidad (mismo código) NO se crea: se actualiza.
--   2. Columnas nuevas (vienen en el archivo y no estaban en la base de datos):
--      clasificaciones_producto: utilizar_lote (UTILIZAR_LOTE, S/N; se ve en la pantalla como «Lote»),
--      cuenta_codigo_anterior y version_cuenta_anterior (CUENTA y VERSION; la cuenta se liga si existe en
--      el catálogo de la localidad), clasificacion_mayor (CLASIFICACION_MAYOR) y cuenta_directo_anterior
--      (CUENTA_DIRECTO).
--      tipos_medida: acepta el código 0 (SIN UNIDAD).
--   Equivalencias: TIPO P/S = PRODUCTO/SERVICIO; TIPO_SERVICIO I/E = INTERNO/EXTERNO; APLICA_INVENTARIO y
--   LABORATORIO S/N = sí/no. La localidad 1 y 2 del archivo son la 3-01 y la 3-02.
--   Descripciones repetidas en la misma localidad (la base exige que no se repitan): la segunda lleva
--   « (2)»: 3-02 21 TABLETAS, 3-02 29 FRASCO.
--   Puede ejecutarse de nuevo: la segunda vez solo actualiza.
-- Se ejecuta después del script 101.

alter table public.tipos_medida drop constraint if exists tipos_medida_codigo_check;
alter table public.tipos_medida add constraint tipos_medida_codigo_check check (codigo >= 0);
alter table public.clasificaciones_producto add column if not exists utilizar_lote boolean not null default false;
alter table public.clasificaciones_producto add column if not exists cuenta_codigo_anterior text;
alter table public.clasificaciones_producto add column if not exists version_cuenta_anterior integer;
alter table public.clasificaciones_producto add column if not exists clasificacion_mayor integer;
alter table public.clasificaciones_producto add column if not exists cuenta_directo_anterior text;

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
    -- Tipos de medida admite el código 0 (SIN UNIDAD, script 102); en las demás tablas 0 pide número automático.
    if new.codigo is null or new.codigo < 0 or (new.codigo = 0 and tg_table_name <> 'tipos_medida') then
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

do $migra$
declare
  v_org bigint;
  r record;
  v_loc bigint;
  v_cta bigint;
  v_nuevo boolean;
  m_n int := 0; m_a int := 0; c_n int := 0; c_a int := 0;
begin
  select id into v_org from public.organizaciones where codigo = '3';
  if v_org is null then raise notice 'No existe la organización 3.'; return; end if;

  for r in select * from (values
    (1, 0, 'SIN UNIDAD'),
    (1, 1, 'UNIDADES'),
    (1, 2, 'CAJA'),
    (1, 3, 'CAJA X 1'),
    (1, 4, 'CAJA X 10'),
    (1, 5, 'CAJA X 20'),
    (1, 6, 'CAJA X 30'),
    (1, 7, 'CAJA X 100'),
    (1, 8, 'BOLSAS'),
    (1, 9, 'FRASCO'),
    (1, 10, 'FRASCOS'),
    (1, 11, 'CAPSULAS'),
    (1, 12, 'GALON'),
    (1, 13, 'LITRO'),
    (1, 14, 'PAR'),
    (1, 15, 'TABLETAS'),
    (1, 16, 'TARROS'),
    (1, 17, 'ML'),
    (1, 18, 'MICROBOT'),
    (1, 19, 'VENDA 10X10CM'),
    (1, 20, '120 GR'),
    (1, 21, '300 GR'),
    (1, 22, 'AMP. BEB'),
    (1, 23, 'SACHET'),
    (1, 24, 'VIAL - 1 UNIDAD'),
    (1, 25, 'VIAL-20 MILILITRO (ML)'),
    (1, 26, 'AMPOLLA -1 MILILITRO (ML)'),
    (1, 27, 'AMPOLLA-2 MILILITRO (ML)'),
    (1, 28, 'VIAL-3 MILIGRAMOS (MG)'),
    (1, 29, 'AMPOLLA-20 MILILITRO (ML)'),
    (1, 30, 'VIAL - 2 MILILITRO(ML)'),
    (1, 31, 'UNIDAD'),
    (1, 32, 'TUBO'),
    (1, 33, 'VIAL'),
    (1, 34, 'AMPOLLA - 1 UNIDAD (ES)'),
    (1, 35, 'VIAL-3 MILILITRO (ML)'),
    (1, 36, 'AMPOLLA-4MILILITRO(ML)'),
    (1, 37, 'AMPOLLA 1 UNIDAD'),
    (1, 38, 'AMPOLLA'),
    (1, 39, 'CREMA'),
    (1, 40, 'AMPOLLA - 5 MILILITRO (ML)'),
    (1, 41, 'VIAL 5 ML'),
    (1, 42, 'UNIDAD-1 UNIDAD'),
    (1, 43, 'VIAL - 1 ML'),
    (2, 0, 'SIN UNIDAD'),
    (2, 1, '1 UNIDAD (ES)'),
    (2, 2, 'CAJA'),
    (2, 3, 'CAJA X 1'),
    (2, 4, 'CAJA X 10'),
    (2, 5, 'CAJA X 20'),
    (2, 6, 'CAJA X 30'),
    (2, 7, 'MILIGRAMOS'),
    (2, 8, 'BOLSAS'),
    (2, 9, 'FRASCO'),
    (2, 10, 'FRASCOS'),
    (2, 11, 'CAPSULAS'),
    (2, 12, 'GALON'),
    (2, 13, 'LITRO'),
    (2, 14, 'CREMA'),
    (2, 15, 'TABLETAS'),
    (2, 16, 'TARROS'),
    (2, 17, 'ML'),
    (2, 18, 'MICROBOT'),
    (2, 19, 'TABLETA'),
    (2, 20, 'MILILITROS'),
    (2, 21, 'TABLETAS (2)'),
    (2, 22, 'AMP. BEB'),
    (2, 23, 'JARABE'),
    (2, 24, 'VIAL - 1 UNIDAD (ES)'),
    (2, 25, 'VIAL - 20 MILILITRO (ML)'),
    (2, 26, 'VIAL/ FRASCO-100 MILILITRO'),
    (2, 27, 'VIAL- 500 MG'),
    (2, 28, 'AMPOLLA - 3 MILILITRO(ML)'),
    (2, 29, 'FRASCO (2)'),
    (2, 30, 'UI'),
    (2, 31, 'VIAL'),
    (2, 32, 'MICROGRAMOS'),
    (2, 33, 'GRAMOS'),
    (2, 34, 'CAPSULA'),
    (2, 35, 'DISPENSADOR'),
    (2, 36, 'GOTAS'),
    (2, 37, 'SUSPENSION'),
    (2, 38, 'AMPOLLA'),
    (2, 39, 'AMPOLLA- 1 UNIDAD'),
    (2, 40, 'AMPOLLA -2 MILILITRO (ML)'),
    (2, 41, 'AMPOLLA-1 MILILITRO(ML)')) as x(loc, codigo, nombre) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then raise notice 'No existe la localidad 3-0%.', r.loc; continue; end if;
    insert into public.tipos_medida (organizacion_id, localidad_id, codigo, nombre)
    values (v_org, v_loc, r.codigo, r.nombre)
    on conflict (localidad_id, codigo) do update set nombre = excluded.nombre
    returning (xmax = 0) into v_nuevo;
    if v_nuevo then m_n := m_n + 1; else m_a := m_a + 1; end if;
  end loop;

  for r in select * from (values
    (1, 1, 'PRODUCTOS', 'PRODUCTO', null, null, null, null, null, false, 'INTERNO', false),
    (1, 2, 'RY', 'PRODUCTO', null, null, null, null, null, false, 'INTERNO', false),
    (2, 1, 'PRODUCTOS', 'PRODUCTO', null, null, null, null, null, true, 'INTERNO', false)) as x(loc, codigo, nombre, tipo, lote, cuenta, version, mayor, directo, inventario, servicio, laboratorio) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then raise notice 'No existe la localidad 3-0%.', r.loc; continue; end if;
    v_cta := null;
    if r.cuenta is not null then
      select c.id into v_cta from public.cuentas c where c.codigo = r.cuenta::text and public.cuenta_de_localidad(c.id, v_loc) limit 1;
    end if;
    insert into public.clasificaciones_producto (organizacion_id, localidad_id, codigo, nombre, tipo, cuenta_id, tipo_servicio,
      inventario, laboratorio, utilizar_lote, cuenta_codigo_anterior, version_cuenta_anterior, clasificacion_mayor, cuenta_directo_anterior)
    values (v_org, v_loc, r.codigo, r.nombre, r.tipo, v_cta, r.servicio, coalesce(r.inventario::boolean, true), coalesce(r.laboratorio::boolean, false),
      coalesce(r.lote::boolean, false), r.cuenta::text, r.version::integer, r.mayor::integer, r.directo::text)
    on conflict (localidad_id, codigo) do update set
      nombre = excluded.nombre, tipo = excluded.tipo, tipo_servicio = excluded.tipo_servicio,
      inventario = excluded.inventario, laboratorio = excluded.laboratorio, utilizar_lote = excluded.utilizar_lote,
      cuenta_id = coalesce(excluded.cuenta_id, public.clasificaciones_producto.cuenta_id),
      cuenta_codigo_anterior = excluded.cuenta_codigo_anterior, version_cuenta_anterior = excluded.version_cuenta_anterior,
      clasificacion_mayor = excluded.clasificacion_mayor, cuenta_directo_anterior = excluded.cuenta_directo_anterior
    returning (xmax = 0) into v_nuevo;
    if v_nuevo then c_n := c_n + 1; else c_a := c_a + 1; end if;
  end loop;
  raise notice '%', format('Tipos de medida: %s nuevos, %s actualizados. Clasificaciones: %s nuevas, %s actualizadas.', m_n, m_a, c_n, c_a);
end;
$migra$;

notify pgrst, 'reload schema';
