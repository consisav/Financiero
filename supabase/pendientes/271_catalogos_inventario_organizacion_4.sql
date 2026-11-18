-- Script 271 · Organización 4 (Tecnoalsa): catálogos de inventario que no venían en el lote del script 227, con la lógica del script 194.
--   · ACT_CLASIFICACION_PRODUCTOS (1: 4-01 1 «EQUIPO DE PANADERIA»): el script 227 la había creado como «CLASIFICACIÓN 1»
--     (la usan los tipos de producto y los productos); ahora toma su nombre y sus datos: TIPO P = producto, APLICA_INVENTARIO, TIPO_SERVICIO I = interno,
--     LABORATORIO y CUENTA (ligada si existe en el catálogo de la empresa; el código queda en cuenta_codigo_anterior). Deja de estar marcada creada_al_migrar.
--   · ACT_MOTIVOS_AJUSTES (10): motivos de ajuste de la organización 4 (los usan los ajustes del script 272), con su código anterior.
--   · ACT_TIPOS_MOVIMIENTOS (34): lista de tipos de movimiento de la organización 4 (tabla tipos_movimiento_organizacion, script 194).
--     Todos tienen el mismo signo que la tabla general del kardex (script 146). Con otro nombre: 33 «REVERSAR DESPACHO» (en la tabla general es «INGRESO CUENA AJENA»); el kardex de Tecnoalsa no lo usa.
--   Las columnas ya existen (scripts 194 y 227; se repiten con «if not exists»). Se ejecuta después del script 227. Se puede ejecutar de nuevo: actualiza.
set lock_timeout = '20s';
alter table public.clasificaciones_producto add column if not exists codigo_anterior integer;
alter table public.clasificaciones_producto add column if not exists creada_al_migrar boolean not null default false;
alter table public.clasificaciones_producto add column if not exists cuenta_codigo_anterior text;
alter table public.clasificaciones_producto add column if not exists version_cuenta_anterior integer;
alter table public.clasificaciones_producto add column if not exists tipo_anterior text;
alter table public.clasificaciones_producto add column if not exists clasificacion_venta_anterior text;
alter table public.motivos_ajuste add column if not exists codigo_anterior integer;
create table if not exists public.tipos_movimiento_organizacion (
  organizacion_id bigint not null references public.organizaciones (id),
  codigo          integer not null,
  descripcion     text not null,
  siglas          text,
  tipo_operacion  integer not null default 0 check (tipo_operacion in (-1, 0, 1)),
  clasificacion   text,
  primary key (organizacion_id, codigo)
);

do $migra$
declare v_org bigint; v_loc bigint; v_id bigint; r record; c_n int := 0; c_a int := 0; a_n int := 0; a_a int := 0; v_n int := 0;
begin
  select id into v_org from public.organizaciones where codigo::text = '4';
  if v_org is null then raise exception 'No existe la organización 4.'; end if;

  -- Clasificaciones de producto.
  for r in select * from (values
    (1::integer, 1::integer, 'EQUIPO DE PANADERIA'::text, 'PRODUCTO'::text, 'P'::text, '11110201'::text, null::integer, true::boolean, 'INTERNO'::text, false::boolean, null::text)) as x(loc, codigo, nombre, tipo, tipo_ant, cuenta, version, inventario, servicio, laboratorio, venta) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then raise exception 'No existe la localidad 4-0%.', r.loc; end if;
    v_id := null;
    select id into v_id from public.clasificaciones_producto where localidad_id = v_loc and codigo_anterior = r.codigo;
    if v_id is null then select id into v_id from public.clasificaciones_producto where localidad_id = v_loc and upper(nombre) = upper(r.nombre) and codigo_anterior is null limit 1; end if;
    if v_id is null then
      insert into public.clasificaciones_producto (organizacion_id, localidad_id, codigo, nombre, codigo_anterior, tipo, tipo_servicio, inventario, laboratorio)
      values (v_org, v_loc, case when r.codigo <= 0 or exists (select 1 from public.clasificaciones_producto where localidad_id = v_loc and codigo = r.codigo)
        then (select coalesce(max(codigo), 0) + 1 from public.clasificaciones_producto where localidad_id = v_loc) else r.codigo end,
        r.nombre, r.codigo, r.tipo, r.servicio, coalesce(r.inventario, true), coalesce(r.laboratorio, false))
      returning id into v_id;
      c_n := c_n + 1;
    else
      c_a := c_a + 1;
    end if;
    update public.clasificaciones_producto set codigo_anterior = r.codigo,
      nombre = case when exists (select 1 from public.clasificaciones_producto o where o.localidad_id = v_loc and upper(o.nombre) = upper(r.nombre) and o.id <> v_id) then nombre else r.nombre end,
      tipo = r.tipo, tipo_servicio = r.servicio, inventario = coalesce(r.inventario, true), laboratorio = coalesce(r.laboratorio, false), creada_al_migrar = false,
      tipo_anterior = r.tipo_ant, cuenta_codigo_anterior = r.cuenta, version_cuenta_anterior = r.version, clasificacion_venta_anterior = r.venta,
      cuenta_id = coalesce((select c.id from public.cuentas c where c.codigo = r.cuenta and public.cuenta_de_localidad(c.id, v_loc) limit 1), cuenta_id)
    where id = v_id;
  end loop;

  -- Motivos de ajuste (por organización).
  for r in select * from (values
    (1::integer, 'FALTANTE EN BODEGA'::text),
    (2, 'PRODUCTO VENCIDO'),
    (3, 'PRODUCTO DAÑADO'),
    (4, 'SOBRANTE'),
    (5, 'TRASLADO INCORRECTO'),
    (6, 'CUADRE INVENTARIO'),
    (7, 'TRITURACION'),
    (8, 'INCINERACION'),
    (9, 'REGALIAS'),
    (10, 'CRUCE DE CODIGOS')) as x(codigo, nombre) loop
    v_id := null;
    select id into v_id from public.motivos_ajuste where organizacion_id = v_org and codigo_anterior = r.codigo;
    if v_id is null then select id into v_id from public.motivos_ajuste where organizacion_id = v_org and upper(nombre) = upper(r.nombre) and codigo_anterior is null limit 1; end if;
    if v_id is null then
      insert into public.motivos_ajuste (organizacion_id, codigo, nombre, codigo_anterior)
      values (v_org, case when exists (select 1 from public.motivos_ajuste where organizacion_id = v_org and codigo = r.codigo)
        then (select greatest(coalesce(max(codigo), 0), 10) + 1 from public.motivos_ajuste where organizacion_id = v_org) else r.codigo end, r.nombre, r.codigo)
      returning id into v_id;
      a_n := a_n + 1;
    else
      update public.motivos_ajuste set codigo_anterior = r.codigo where id = v_id; a_a := a_a + 1;
    end if;
  end loop;

  -- Tipos de movimiento de la organización.
  insert into public.tipos_movimiento_organizacion (organizacion_id, codigo, descripcion, siglas, tipo_operacion, clasificacion)
  select v_org, x.* from (values
    (0::integer, 'SIN MOVIMIENTO'::text, 'SMO'::text, 0::integer, 'NUL'::text),
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
    (25, 'ENTRADA - NCRE ELECTRÓNICA', 'ENE', 1, 'IN'),
    (26, 'ANULACION - NCRE ELECTRÓNICA', 'ANE', -1, 'OUT'),
    (27, 'SALIDA - NOTA CREDITO COMPRA', 'SNC', -1, 'OUT'),
    (28, 'ANULACION - NOTA CRÉDITO COMPRA', 'ANC', 1, 'IN'),
    (29, 'INGRESO - NOTA CRÉDITO VENTA', 'INV', 1, 'IN'),
    (30, 'ANULACION - NOTA CRÉDITO VENTA', 'ANV', -1, 'OUT'),
    (31, 'ENTRADA - NABN ELECTRÓNICA', 'EAE', 1, 'IN'),
    (32, 'ANULACION - NABN ELECTRÓNICA', 'AAE', -1, 'OUT'),
    (33, 'REVERSAR DESPACHO', 'RDES', 1, 'IN')) as x(codigo, descripcion, siglas, tipo_operacion, clasificacion)
  on conflict (organizacion_id, codigo) do update set descripcion = excluded.descripcion, siglas = excluded.siglas, tipo_operacion = excluded.tipo_operacion, clasificacion = excluded.clasificacion;
  get diagnostics v_n = row_count;

  raise notice '%', format('Clasificaciones: %s nuevas, %s actualizadas. Motivos de ajuste: %s nuevos, %s ya existían. Tipos de movimiento de la organización: %s.', c_n, c_a, a_n, a_a, v_n);
end;
$migra$;

notify pgrst, 'reload schema';
