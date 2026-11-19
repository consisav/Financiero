-- Lote del 05-11 al 17-11-2026 («Datos Tecnoasla - AAPOS del 05-11-2026 al 17-11-2026»): mismo proceso del script 229, solo con los registros de este lote.
-- Script 277 · parte 1 de 2 · Organización 4 (TECNOALSA): detalle contable de las compras (ACT_DETCON_COMPRAS.xlsx), 77 líneas.
-- Se ejecuta después del script 229 (compras) y de la parte 0 del 231. Se puede ejecutar de nuevo: la segunda vez solo actualiza.
set lock_timeout = '20s';
-- Estadísticas al día: sin esto Postgres cree que la tabla de compras está casi vacía y la búsqueda de cada parte se vuelve muy lenta.
analyze public.compras;
analyze public.compra_lineas;

do $detcon$
declare
  v_org bigint; v_loc bigint; v_kc bigint; v_may bigint; r record; v_n int := 0; v_a int := 0; v_cen int := 0; v_sin_compra int; v_sin_cuenta text;
begin
  select id into v_org from public.organizaciones where codigo::text = '4';
  if v_org is null then raise exception 'No existe la organización 4.'; end if;

  -- b) Las líneas. Las validaciones de la pantalla (compra anulada o con partida) se suspenden durante la carga.
  alter table public.compra_lineas disable trigger compra_lineas_validar;
  with m (loc, compra, linea, cuenta, version, centro, debe, haber, debe_ant, haber_ant) as (values
      (1::integer, 1992::integer, 1::integer, '1151'::text, 1::integer, null::text, 17967.11::numeric, 0::numeric, null::numeric, null::numeric),
      (1, 1992, 2, '21110102', 1, null, 0, 17068.78, null, null),
      (1, 1992, 3, '2111050204', 1, null, 0, 898.33, null, null),
      (1, 1993, 1, '70203', 1, null, 1549.32, 0, null, null),
      (1, 1993, 2, '11301', 1, null, 185.92, 0, null, null),
      (1, 1993, 3, '21110102', 1, null, 0, 1735.24, null, null),
      (1, 1994, 1, '6248', 1, null, 1900, 0, null, null),
      (1, 1994, 2, '21110102', 1, null, 0, 1900, null, null),
      (1, 1995, 1, '6230', 1, null, 15461.14, 0, null, null),
      (1, 1995, 2, '11301', 1, null, 1855.34, 0, null, null),
      (1, 1995, 3, '2111050202', 1, null, 0, 773.06, null, null),
      (1, 1995, 4, '21110102', 1, null, 0, 16543.42, null, null),
      (1, 1996, 1, '6243', 1, null, 952.63, 0, null, null),
      (1, 1996, 2, '11301', 1, null, 114.32, 0, null, null),
      (1, 1996, 3, '21110102', 1, null, 0, 905, null, null),
      (1, 1996, 4, '2111050103', 1, null, 0, 114.32, null, null),
      (1, 1996, 5, '2111050203', 1, null, 0, 47.63, null, null),
      (1, 1997, 1, '6221', 1, null, 2631.58, 0, null, null),
      (1, 1997, 2, '11301', 1, null, 315.79, 0, null, null),
      (1, 1997, 3, '21110102', 1, null, 0, 2500, null, null),
      (1, 1997, 4, '2111050103', 1, null, 0, 315.79, null, null),
      (1, 1997, 5, '2111050203', 1, null, 0, 131.58, null, null),
      (1, 1998, 1, '6221', 1, null, 1562.5, 0, null, null),
      (1, 1998, 2, '11301', 1, null, 187.5, 0, null, null),
      (1, 1998, 3, '21110102', 1, null, 0, 1750, null, null),
      (1, 1999, 1, '6221', 1, null, 4860, 0, null, null),
      (1, 1999, 2, '21110102', 1, null, 0, 4860, null, null),
      (1, 2000, 1, '6218', 1, null, 446.43, 0, null, null),
      (1, 2000, 2, '11301', 1, null, 53.57, 0, null, null),
      (1, 2000, 3, '21110102', 1, null, 0, 500, null, null),
      (1, 2001, 1, '1141', 1, null, 2008.93, 0, null, null),
      (1, 2001, 2, '11301', 1, null, 241.07, 0, null, null),
      (1, 2001, 3, '21110101', 1, null, 0, 2250, null, null),
      (1, 2002, 1, '1151', 1, null, 8912.99, 0, null, null),
      (1, 2002, 2, '21110102', 1, null, 0, 8434.43, null, null),
      (1, 2002, 3, '2111050204', 1, null, 0, 478.56, null, null),
      (1, 2003, 1, '6218', 1, null, 1187.5, 0, null, null),
      (1, 2003, 2, '11301', 1, null, 142.5, 0, null, null),
      (1, 2003, 3, '21110102', 1, null, 0, 1330, null, null),
      (1, 2004, 1, '6226', 1, null, 1336, 0, null, null),
      (1, 2004, 2, '11301', 1, null, 160.32, 0, null, null),
      (1, 2004, 3, '21110102', 1, null, 0, 1496.32, null, null),
      (1, 2005, 1, '1151', 1, null, 1116.07, 0, null, null),
      (1, 2005, 2, '11301', 1, null, 133.93, 0, null, null),
      (1, 2005, 3, '21110102', 1, null, 0, 1250, null, null),
      (1, 2006, 1, '6248', 1, null, 400, 0, null, null),
      (1, 2006, 2, '21110102', 1, null, 0, 400, null, null),
      (1, 2007, 1, '6221', 1, null, 1200, 0, null, null),
      (1, 2007, 2, '21110102', 1, null, 0, 1200, null, null),
      (1, 2008, 1, '6211', 1, null, 956.96, 0, null, null),
      (1, 2008, 2, '11301', 1, null, 114.84, 0, null, null),
      (1, 2008, 3, '21110101', 1, null, 0, 1071.8, null, null),
      (1, 2009, 1, '6226', 1, null, 1378.82, 0, null, null),
      (1, 2009, 2, '11301', 1, null, 165.46, 0, null, null),
      (1, 2009, 3, '21110102', 1, null, 0, 1544.28, null, null),
      (1, 2010, 1, '51201', 1, null, 1031.25, 0, null, null),
      (1, 2010, 2, '11301', 1, null, 123.75, 0, null, null),
      (1, 2010, 3, '21110101', 1, null, 0, 1155, null, null),
      (1, 2011, 1, '1151', 1, null, 409.73, 0, null, null),
      (1, 2011, 2, '11301', 1, null, 49.17, 0, null, null),
      (1, 2011, 3, '21110102', 1, null, 0, 458.9, null, null),
      (1, 2012, 1, '6221', 1, null, 368.42, 0, null, null),
      (1, 2012, 2, '11301', 1, null, 44.21, 0, null, null),
      (1, 2012, 3, '21110102', 1, null, 0, 350, null, null),
      (1, 2012, 4, '2111050103', 1, null, 0, 44.21, null, null),
      (1, 2012, 5, '2111050203', 1, null, 0, 18.42, null, null),
      (1, 2013, 1, '6226', 1, null, 0, 1378.82, null, null),
      (1, 2013, 2, '11301', 1, null, 0, 165.46, null, null),
      (1, 2013, 3, '21110102', 1, null, 1544.28, 0, null, null),
      (1, 2014, 1, '1141', 1, null, 36205.36, 0, null, null),
      (1, 2014, 2, '11301', 1, null, 4344.64, 0, null, null),
      (1, 2014, 3, '21110101', 1, null, 0, 40550, null, null),
      (1, 2015, 1, '1141', 1, null, 7977.81, 0, null, null),
      (1, 2015, 2, '1151', 1, null, 0, 971.57, null, null),
      (1, 2015, 3, '11230307', 1, null, 0, 7006.24, null, null),
      (1, 2016, 1, '6254', 1, null, 6423.58, 0, null, null),
      (1, 2016, 2, '21110102', 1, null, 0, 6423.58, null, null)),
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
         (select string_agg(distinct format('4-0%s %s', m.loc, m.cuenta), ', ') from m join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc
          where not exists (select 1 from public.cuentas k join public.catalogos_cuentas g on g.id = k.catalogo_id
                            where g.localidad_id = l.id and k.codigo = m.cuenta and (g.version = m.version or m.version is null)))
    into v_n, v_a, v_sin_compra, v_sin_cuenta from x;
  alter table public.compra_lineas enable trigger compra_lineas_validar;

  raise notice '%', format('Detalle contable de compras de la organización 4 (parte 1 de 2): %s líneas nuevas, %s actualizadas.%s%s%s',
    v_n, v_a,
    case when v_cen > 0 then format(' %s centros de costo creados.', v_cen) else '' end,
    case when v_sin_compra > 0 then format(' %s líneas omitidas (su compra no existe o su cuenta no está en el catálogo).', v_sin_compra) else '' end,
    case when v_sin_cuenta is not null then ' Cuentas que no existen en el catálogo (líneas omitidas): ' || v_sin_cuenta || '.' else '' end);
end;
$detcon$;
