-- Script 193 · Organización 2 (Hospital Miraflores): centros de costo que usa el detalle contable de las notas de crédito y
-- débito (CON_DETCON_NOTAS.xls, script 181) y no estaban en el catálogo de centros: 2-01 101, 306, 10601 y 2010201.
--   a) Se crean en la versión 1 del catálogo de centros de la localidad (si la localidad no tiene catálogo de centros, se crea),
--      con el nombre «CENTRO DE COSTO código (CREADO AL MIGRAR NOTAS)»; su centro mayor es el de código más largo que lo contenga.
--   b) Las líneas de notas ya migradas que traen ese centro (centro_costo_anterior) y quedaron sin centro se ligan a él.
--   Se puede ejecutar antes o después del script 181, y de nuevo: no duplica nada.

do $cen$
declare
  v_org bigint; v_loc bigint; v_kc bigint; v_may bigint; v_nom text; r record; z_n int := 0; k_n int := 0; l_n int := 0; v_cen text[] := '{}';
begin
  select id into v_org from public.organizaciones where codigo = '2';
  if v_org is null then raise notice 'No existe la organización 2.'; return; end if;

  for r in select * from (values (1, '101'), (1, '306'), (1, '10601'), (1, '2010201')) as x(loc, codigo) order by loc, length(codigo), codigo loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    if v_loc is null then continue; end if;
    v_kc := null;
    select id into v_kc from public.catalogos_centros where localidad_id = v_loc order by (version = 1) desc, activo desc, version limit 1;
    if v_kc is null then
      insert into public.catalogos_centros (organizacion_id, localidad_id, version, fecha_del) values (v_org, v_loc, 1, date '2018-01-01') returning id into v_kc;
      k_n := k_n + 1;
    end if;
    if exists (select 1 from public.centros_costo where catalogo_id = v_kc and codigo = r.codigo) then continue; end if;
    v_may := null; v_nom := null;
    select id into v_may from public.centros_costo where catalogo_id = v_kc and length(codigo) < length(r.codigo) and left(r.codigo, length(codigo)) = codigo order by length(codigo) desc limit 1;
    select c.nombre into v_nom from public.centros_costo c where c.organizacion_id = v_org and c.codigo = r.codigo limit 1;
    insert into public.centros_costo (organizacion_id, catalogo_id, codigo, nombre, centro_mayor_id, integra, centro_anterior)
    values (v_org, v_kc, r.codigo, coalesce(v_nom, 'CENTRO DE COSTO ' || r.codigo || ' (CREADO AL MIGRAR NOTAS)'), v_may, true, r.codigo);
    z_n := z_n + 1; v_cen := array_append(v_cen, format('2-0%s %s', r.loc, r.codigo));
  end loop;

  -- Líneas de notas migradas sin centro que traen uno del sistema anterior (solo se completa centro_id).
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'movimiento_lineas' and column_name = 'centro_costo_anterior') then
    alter table public.movimiento_lineas disable trigger user;
    update public.movimiento_lineas l set centro_id = c.id
    from public.movimientos_bancarios m, public.catalogos_centros k, public.centros_costo c
    where m.id = l.movimiento_id and m.organizacion_id = v_org and l.centro_id is null and l.centro_costo_anterior is not null
      and k.localidad_id = m.localidad_id and c.catalogo_id = k.id and c.codigo = l.centro_costo_anterior;
    get diagnostics l_n = row_count;
    alter table public.movimiento_lineas enable trigger user;
  end if;

  raise notice '%', format('Catálogos de centros creados: %s. Centros creados: %s %s. Líneas de notas ligadas a su centro: %s.',
    k_n, z_n, coalesce(array_to_string(v_cen, ', '), ''), l_n);
end;
$cen$;

notify pgrst, 'reload schema';
