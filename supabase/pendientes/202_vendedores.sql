-- Script 202 · Organización 2 (Hospital Miraflores): vendedores del sistema anterior (VEN_VENDEDORES.xls), 1 vendedor(es).
--   VENDEDOR = código; NOMBRE_VENDEDOR = nombre; ESTADO (A = activo) = activo; TIPO_VENDEDOR va a la columna nueva tipo_vendedor
--   (O en el sistema anterior). FECHA_INGRESO viene vacía. Se puede ejecutar de nuevo: la segunda vez solo actualiza.
set lock_timeout = '20s';
alter table public.vendedores add column if not exists tipo_vendedor text;
alter table public.vendedores add column if not exists estado_anterior text;

do $vendedores$
declare v_org bigint; v_n int := 0; v_a int := 0; v_sin int;
begin
  select id into v_org from public.organizaciones where codigo = '2';
  if v_org is null then raise notice 'No existe la organización 2.'; return; end if;
  with m (loc, codigo, nombre, tipo, activo, estado) as (values
      (1::integer, 1::integer, 'MIRAFLORES PLUS'::text, 'O'::text, true, 'A'::text)),
  x as (
    insert into public.vendedores (organizacion_id, localidad_id, codigo, nombre, tipo_vendedor, activo, estado_anterior)
    select v_org, l.id, m.codigo, m.nombre, m.tipo, m.activo, m.estado
    from m join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc
    on conflict (localidad_id, codigo) do update set nombre = excluded.nombre, tipo_vendedor = excluded.tipo_vendedor, activo = excluded.activo,
      estado_anterior = excluded.estado_anterior
    returning (xmax = 0) as nuevo)
  select count(*) filter (where nuevo), count(*) filter (where not nuevo), (select count(*) from m) - count(*) into v_n, v_a, v_sin from x;
  raise notice '%', format('Vendedores de la organización 2: %s nuevos, %s actualizados.%s', v_n, v_a,
    case when v_sin > 0 then format(' %s de localidades que no existen (omitidos).', v_sin) else '' end);
end;
$vendedores$;

notify pgrst, 'reload schema';
