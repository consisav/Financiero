-- Lote del 05-11 al 17-11-2026 («Datos Tecnoasla - AAPOS del 05-11-2026 al 17-11-2026»): mismo proceso del script 229, solo con los registros de este lote.
-- Script 277 · parte 2 de 2 · Organización 7 (AAPOS): detalle contable de las compras (ACT_DETCON_COMPRAS.xlsx), 116 líneas.
-- Se ejecuta después del script 229 (compras) y de la parte 0 del 231. Se puede ejecutar de nuevo: la segunda vez solo actualiza.
set lock_timeout = '20s';
-- Estadísticas al día: sin esto Postgres cree que la tabla de compras está casi vacía y la búsqueda de cada parte se vuelve muy lenta.
analyze public.compras;
analyze public.compra_lineas;

do $detcon$
declare
  v_org bigint; v_loc bigint; v_kc bigint; v_may bigint; r record; v_n int := 0; v_a int := 0; v_cen int := 0; v_sin_compra int; v_sin_cuenta text;
begin
  select id into v_org from public.organizaciones where codigo::text = '7';
  if v_org is null then raise exception 'No existe la organización 7.'; end if;

  -- a) Centros de costo de las líneas que no existen en el catálogo de centros de la localidad: se crean (el 0 es «sin centro»).
  for r in select * from (values (1, '211011101'), (1, '52010126'), (1, '211011106'), (1, '52010729'), (1, '211011103'), (1, '52010408'), (1, '52010412'), (1, '52010414'), (1, '52010116'), (1, '211011102'), (1, '52010342'), (1, '52010427'), (1, '52010413'), (1, '52010420'), (1, '52010127')) as x(loc, codigo) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then continue; end if;
    v_kc := null;
    select id into v_kc from public.catalogos_centros where localidad_id = v_loc order by (version = 1) desc, activo desc, version limit 1;
    if v_kc is null then
      insert into public.catalogos_centros (organizacion_id, localidad_id, version, fecha_del) values (v_org, v_loc, 1, date '2018-01-01') returning id into v_kc;
    end if;
    if exists (select 1 from public.centros_costo where catalogo_id = v_kc and codigo = r.codigo) then continue; end if;
    v_may := null;
    select id into v_may from public.centros_costo where catalogo_id = v_kc and length(codigo) < length(r.codigo) and left(r.codigo, length(codigo)) = codigo order by length(codigo) desc limit 1;
    insert into public.centros_costo (organizacion_id, catalogo_id, codigo, nombre, centro_mayor_id, integra, centro_anterior)
    values (v_org, v_kc, r.codigo, 'CENTRO DE COSTO ' || r.codigo || ' (CREADO AL MIGRAR COMPRAS)', v_may, true, r.codigo);
    v_cen := v_cen + 1;
  end loop;

  -- b) Las líneas. Las validaciones de la pantalla (compra anulada o con partida) se suspenden durante la carga.
  alter table public.compra_lineas disable trigger compra_lineas_validar;
  with m (loc, compra, linea, cuenta, version, centro, debe, haber, debe_ant, haber_ant) as (values
      (1::integer, 2051::integer, 1::integer, '2110111'::text, 1::integer, '211011101'::text, 0::numeric, 7710::numeric, null::numeric, null::numeric),
      (1, 2051, 2, '5201', 1, '52010126', 7710, 0, null, null),
      (1, 2052, 1, '2110111', 1, '211011106', 0, 323784.04, null, null),
      (1, 2052, 2, '5201', 1, '52010729', 323784.04, 0, null, null),
      (1, 2053, 1, '2110111', 1, '211011103', 0, 655, null, null),
      (1, 2053, 2, '5201', 1, '52010408', 655, 0, null, null),
      (1, 2054, 1, '2110111', 1, '211011103', 0, 1944, null, null),
      (1, 2054, 2, '5201', 1, '52010412', 1944, 0, null, null),
      (1, 2055, 1, '2110111', 1, '211011103', 0, 1600, null, null),
      (1, 2055, 2, '5201', 1, '52010414', 1600, 0, null, null),
      (1, 2056, 1, '2110111', 1, '211011103', 0, 6089.67, null, null),
      (1, 2056, 2, '5201', 1, '52010414', 6089.67, 0, null, null),
      (1, 2057, 1, '2110111', 1, '211011101', 0, 14194.07, null, null),
      (1, 2057, 2, '5201', 1, '52010116', 14194.07, 0, null, null),
      (1, 2058, 1, '2110111', 1, '211011101', 0, 26437.5, null, null),
      (1, 2058, 2, '5201', 1, '52010126', 26437.5, 0, null, null),
      (1, 2059, 1, '2110111', 1, '211011102', 0, 504, null, null),
      (1, 2059, 2, '5201', 1, '52010342', 504, 0, null, null),
      (1, 2060, 1, '2110111', 1, '211011102', 0, 580, null, null),
      (1, 2060, 2, '5201', 1, '52010342', 580, 0, null, null),
      (1, 2061, 1, '2110111', 1, '211011102', 0, 826.5, null, null),
      (1, 2061, 2, '5201', 1, '52010342', 826.5, 0, null, null),
      (1, 2062, 1, '2110111', 1, '211011102', 0, 950, null, null),
      (1, 2062, 2, '5201', 1, '52010342', 950, 0, null, null),
      (1, 2063, 1, '2110111', 1, '211011102', 0, 195, null, null),
      (1, 2063, 2, '5201', 1, '52010342', 195, 0, null, null),
      (1, 2064, 1, '2110111', 1, '211011102', 0, 200, null, null),
      (1, 2064, 2, '5201', 1, '52010342', 200, 0, null, null),
      (1, 2065, 1, '2110111', 1, '211011102', 0, 1200, null, null),
      (1, 2065, 2, '5201', 1, '52010342', 1200, 0, null, null),
      (1, 2066, 1, '2110111', 1, '211011102', 0, 1036, null, null),
      (1, 2066, 2, '5201', 1, '52010342', 1036, 0, null, null),
      (1, 2067, 1, '2110111', 1, '211011102', 0, 714, null, null),
      (1, 2067, 2, '5201', 1, '52010342', 714, 0, null, null),
      (1, 2068, 1, '2110111', 1, '211011102', 0, 500, null, null),
      (1, 2068, 2, '5201', 1, '52010342', 500, 0, null, null),
      (1, 2069, 1, '2110111', 1, '211011102', 0, 2427, null, null),
      (1, 2069, 2, '5201', 1, '52010342', 2427, 0, null, null),
      (1, 2070, 1, '2110111', 1, '211011102', 0, 600, null, null),
      (1, 2070, 2, '5201', 1, '52010342', 600, 0, null, null),
      (1, 2071, 1, '2110111', 1, '211011102', 0, 390, null, null),
      (1, 2071, 2, '5201', 1, '52010342', 390, 0, null, null),
      (1, 2072, 1, '2110111', 1, '211011102', 0, 530, null, null),
      (1, 2072, 2, '5201', 1, '52010342', 530, 0, null, null),
      (1, 2073, 1, '2110111', 1, '211011102', 0, 8052, null, null),
      (1, 2073, 2, '5201', 1, '52010342', 8052, 0, null, null),
      (1, 2074, 1, '2110111', 1, '211011102', 0, 820, null, null),
      (1, 2074, 2, '5201', 1, '52010342', 820, 0, null, null),
      (1, 2075, 1, '2110111', 1, '211011102', 0, 6073, null, null),
      (1, 2075, 2, '5201', 1, '52010342', 6073, 0, null, null),
      (1, 2076, 1, '2110111', 1, '211011102', 0, 621, null, null),
      (1, 2076, 2, '5201', 1, '52010342', 621, 0, null, null),
      (1, 2077, 1, '2110111', 1, '211011102', 0, 849, null, null),
      (1, 2077, 2, '5201', 1, '52010342', 849, 0, null, null),
      (1, 2078, 1, '2110111', 1, '211011102', 0, 1715, null, null),
      (1, 2078, 2, '5201', 1, '52010342', 1715, 0, null, null),
      (1, 2079, 1, '2110111', 1, '211011102', 0, 105, null, null),
      (1, 2079, 2, '5201', 1, '52010342', 105, 0, null, null),
      (1, 2080, 1, '2110111', 1, '211011102', 0, 378, null, null),
      (1, 2080, 2, '5201', 1, '52010342', 378, 0, null, null),
      (1, 2081, 1, '2110111', 1, '211011102', 0, 542, null, null),
      (1, 2081, 2, '5201', 1, '52010342', 542, 0, null, null),
      (1, 2082, 1, '2110111', 1, '211011102', 0, 1064, null, null),
      (1, 2082, 2, '5201', 1, '52010342', 1064, 0, null, null),
      (1, 2083, 1, '2110111', 1, '211011102', 0, 200, null, null),
      (1, 2083, 2, '5201', 1, '52010342', 200, 0, null, null),
      (1, 2084, 1, '2110111', 1, '211011102', 0, 2211.18, null, null),
      (1, 2084, 2, '5201', 1, '52010342', 2211.18, 0, null, null),
      (1, 2085, 1, '2110111', 1, '211011102', 0, 1101, null, null),
      (1, 2085, 2, '5201', 1, '52010342', 1101, 0, null, null),
      (1, 2086, 1, '2110111', 1, '211011102', 0, 270, null, null),
      (1, 2086, 2, '5201', 1, '52010342', 270, 0, null, null),
      (1, 2087, 1, '2110111', 1, '211011102', 0, 345, null, null),
      (1, 2087, 2, '5201', 1, '52010342', 345, 0, null, null),
      (1, 2088, 1, '2110111', 1, '211011102', 0, 1870, null, null),
      (1, 2088, 2, '5201', 1, '52010342', 1870, 0, null, null),
      (1, 2089, 1, '2110111', 1, '211011102', 0, 2355.95, null, null),
      (1, 2089, 2, '5201', 1, '52010342', 2355.95, 0, null, null),
      (1, 2090, 1, '2110111', 1, '211011102', 0, 790, null, null),
      (1, 2090, 2, '5201', 1, '52010342', 790, 0, null, null),
      (1, 2091, 1, '2110111', 1, '211011103', 0, 550, null, null),
      (1, 2091, 2, '5201', 1, '52010427', 550, 0, null, null),
      (1, 2092, 1, '2110111', 1, '211011103', 0, 1400, null, null),
      (1, 2092, 2, '5201', 1, '52010413', 1400, 0, null, null),
      (1, 2093, 1, '2110111', 1, '211011103', 0, 895, null, null),
      (1, 2093, 2, '5201', 1, '52010420', 895, 0, null, null),
      (1, 2094, 1, '2110111', 1, '211011103', 0, 7000, null, null),
      (1, 2094, 2, '5201', 1, '52010414', 7000, 0, null, null),
      (1, 2095, 1, '2110111', 1, '211011103', 0, 1500, null, null),
      (1, 2095, 2, '5201', 1, '52010414', 1500, 0, null, null),
      (1, 2096, 1, '2110111', 1, '211011103', 0, 1410, null, null),
      (1, 2096, 2, '5201', 1, '52010414', 1410, 0, null, null),
      (1, 2097, 1, '2110111', 1, '211011103', 0, 3596.04, null, null),
      (1, 2097, 2, '5201', 1, '52010427', 3596.04, 0, null, null),
      (1, 2098, 1, '2110111', 1, '211011103', 0, 156, null, null),
      (1, 2098, 2, '5201', 1, '52010427', 156, 0, null, null),
      (1, 2099, 1, '2110111', 1, '211011103', 0, 300, null, null),
      (1, 2099, 2, '5201', 1, '52010427', 300, 0, null, null),
      (1, 2100, 1, '2110111', 1, '211011103', 0, 503.5, null, null),
      (1, 2100, 2, '5201', 1, '52010414', 503.5, 0, null, null),
      (1, 2101, 1, '2110111', 1, '211011103', 0, 1791.82, null, null),
      (1, 2101, 2, '5201', 1, '52010414', 1791.82, 0, null, null),
      (1, 2102, 1, '2110111', 1, '211011103', 0, 1400, null, null),
      (1, 2102, 2, '5201', 1, '52010413', 1400, 0, null, null),
      (1, 2103, 1, '2110111', 1, '211011103', 0, 900, null, null),
      (1, 2103, 2, '5201', 1, '52010413', 900, 0, null, null),
      (1, 2104, 1, '2110111', 1, '211011102', 0, 24, null, null),
      (1, 2104, 2, '5201', 1, '52010342', 24, 0, null, null),
      (1, 2105, 1, '2110111', 1, '211011101', 0, 1594, null, null),
      (1, 2105, 2, '5201', 1, '52010127', 1594, 0, null, null),
      (1, 2106, 1, '2110111', 1, '211011101', 0, 1432, null, null),
      (1, 2106, 2, '5201', 1, '52010127', 1432, 0, null, null),
      (1, 2107, 1, '2110111', 1, '211011101', 0, 8500, null, null),
      (1, 2107, 2, '5201', 1, '52010126', 8500, 0, null, null),
      (1, 2108, 1, '2110111', 1, '211011101', 0, 8500, null, null),
      (1, 2108, 2, '5201', 1, '52010126', 8500, 0, null, null)),
  cc as (
    select distinct on (kc.localidad_id, z.codigo) kc.localidad_id, z.codigo, z.id
    from public.centros_costo z join public.catalogos_centros kc on kc.id = z.catalogo_id
    where kc.organizacion_id = v_org and z.codigo in (select distinct m.centro from m where m.centro is not null)
    order by kc.localidad_id, z.codigo, (kc.version = 1) desc, kc.activo desc),
  x as (
    insert into public.compra_lineas (compra_id, linea, cuenta_id, debe, haber, centro_id, cuenta_codigo_anterior, version_cuenta_anterior, centro_costo_anterior, debe_anterior, haber_anterior)
    select c.id, m.linea, k.id, m.debe, m.haber, cc.id, m.cuenta, m.version, m.centro, m.debe_ant, m.haber_ant
    from m
    join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc
    join public.compras c on c.localidad_id = l.id and c.origen_anterior = 'VARIAS' and c.compra_anterior = m.compra
    left join cc on cc.localidad_id = l.id and cc.codigo = m.centro
    join lateral (select k.id from public.cuentas k join public.catalogos_cuentas g on g.id = k.catalogo_id
                  where g.localidad_id = l.id and k.codigo = m.cuenta and (g.version = m.version or m.version is null)
                  order by g.version desc limit 1) k on true
    on conflict (compra_id, linea) do update set cuenta_id = excluded.cuenta_id, debe = excluded.debe, haber = excluded.haber, centro_id = excluded.centro_id,
      cuenta_codigo_anterior = excluded.cuenta_codigo_anterior, version_cuenta_anterior = excluded.version_cuenta_anterior,
      centro_costo_anterior = excluded.centro_costo_anterior, debe_anterior = excluded.debe_anterior, haber_anterior = excluded.haber_anterior, reconstruida = false
    returning (xmax = 0) as nueva)
  select count(*) filter (where nueva), count(*) filter (where not nueva), (select count(*) from m) - count(*),
         (select string_agg(distinct format('7-0%s %s', m.loc, m.cuenta), ', ') from m join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc
          where not exists (select 1 from public.cuentas k join public.catalogos_cuentas g on g.id = k.catalogo_id
                            where g.localidad_id = l.id and k.codigo = m.cuenta and (g.version = m.version or m.version is null)))
    into v_n, v_a, v_sin_compra, v_sin_cuenta from x;
  alter table public.compra_lineas enable trigger compra_lineas_validar;

  raise notice '%', format('Detalle contable de compras de la organización 7 (parte 2 de 2): %s líneas nuevas, %s actualizadas.%s%s%s',
    v_n, v_a,
    case when v_cen > 0 then format(' %s centros de costo creados.', v_cen) else '' end,
    case when v_sin_compra > 0 then format(' %s líneas omitidas (su compra no existe o su cuenta no está en el catálogo).', v_sin_compra) else '' end,
    case when v_sin_cuenta is not null then ' Cuentas que no existen en el catálogo (líneas omitidas): ' || v_sin_cuenta || '.' else '' end);
end;
$detcon$;

notify pgrst, 'reload schema';
