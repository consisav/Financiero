-- Compras de la organización 3 · 3 de 4: detalle contable de las compras, del archivo
--   «ACT_DETCON_COMPRAS.xls» (26 líneas de 9 compras varias de 3-02).
--   1. Una línea que ya existe en la compra (mismo número de línea) se actualiza; si no, se crea.
--   2. Todas las columnas del archivo ya existen (CUENTA, DEBITO y CREDITO; VERSION es la versión del
--      catálogo donde se busca la cuenta): no se agregan columnas.
--   Las líneas se ligan a la compra varia por su número del sistema anterior (script 89), también cuando
--   la compra varia se fusionó con su compra de medicamentos (compra_varia_anterior); una línea cuya
--   cuenta no existe en el catálogo se omite y se informa.
--   Puede ejecutarse de nuevo: la segunda vez solo actualiza.
-- Se ejecuta después del script 90.

do $migra$
declare
  v_org bigint;
  v_nuevas integer := 0;
  v_act integer := 0;
  v_sin_cuenta text;
  v_sin_compra integer;
begin
  select id into v_org from public.organizaciones where codigo = 3;
  if v_org is null then raise exception 'No existe la organización 3.'; end if;

  drop table if exists m_lineas;
  create temp table m_lineas (loc integer, compra integer, linea integer, cuenta text, version integer, debe numeric, haber numeric);
  insert into m_lineas values
      (2, 130, 1, '6010103006', 1, 1785.71, 0),
      (2, 130, 2, '1010401001', 1, 214.29, 0),
      (2, 130, 3, '2010101002', 1, 0, 2000),
      (2, 131, 1, '6010103021', 1, 768.75, 0),
      (2, 131, 2, '1010401001', 1, 92.25, 0),
      (2, 131, 3, '2010101002', 1, 0, 861),
      (2, 132, 1, '6010103021', 1, 36.61, 0),
      (2, 132, 2, '1010401001', 1, 4.39, 0),
      (2, 132, 3, '2010101002', 1, 0, 41),
      (2, 133, 1, '6010103011', 1, 1272.32, 0),
      (2, 133, 2, '1010401001', 1, 152.68, 0),
      (2, 133, 3, '2010101002', 1, 0, 1425),
      (2, 134, 1, '6010103007', 1, 22321.43, 0),
      (2, 134, 2, '1010401001', 1, 2678.57, 0),
      (2, 134, 3, '2010101002', 1, 0, 23883.93),
      (2, 134, 4, '2010202006', 1, 0, 1116.07),
      (2, 135, 1, '6010103012', 1, 13574.96, 0),
      (2, 135, 2, '2010101002', 1, 0, 13574.96),
      (2, 136, 1, '6010103008', 1, 263.39, 0),
      (2, 136, 2, '1010401001', 1, 31.61, 0),
      (2, 136, 3, '2010101002', 1, 0, 295),
      (2, 137, 1, '6010103006', 1, 1785.71, 0),
      (2, 137, 2, '1010401001', 1, 214.29, 0),
      (2, 137, 3, '2010101002', 1, 0, 2000),
      (2, 138, 1, '6010103037', 1, 1250, 0),
      (2, 138, 2, '2010101002', 1, 0, 1250);

  select count(*) into v_sin_compra from m_lineas m join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc
  where not exists (select 1 from public.compras c where c.localidad_id = l.id and ((c.origen_anterior = 'VARIAS' and c.compra_anterior = m.compra) or c.compra_varia_anterior = m.compra));
  select string_agg(distinct m.cuenta, ', ') into v_sin_cuenta from m_lineas m join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc
  where not exists (select 1 from public.cuentas k join public.catalogos_cuentas g on g.id = k.catalogo_id
                    where g.localidad_id = l.id and k.codigo = m.cuenta and (g.version = m.version or (m.version is null and g.activo)));

  -- Las validaciones de la pantalla (compra anulada o con partida) se suspenden durante la carga.
  alter table public.compra_lineas disable trigger compra_lineas_validar;
  with x as (
    insert into public.compra_lineas (compra_id, linea, cuenta_id, debe, haber)
    select c.id, m.linea, k.id, m.debe, m.haber
    from m_lineas m
    join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc
    join public.compras c on c.localidad_id = l.id and ((c.origen_anterior = 'VARIAS' and c.compra_anterior = m.compra) or c.compra_varia_anterior = m.compra)
    join lateral (select k.id from public.cuentas k join public.catalogos_cuentas g on g.id = k.catalogo_id
                  where g.localidad_id = l.id and k.codigo = m.cuenta and (g.version = m.version or (m.version is null and g.activo))
                  order by g.version desc limit 1) k on true
    on conflict (compra_id, linea) do update set cuenta_id = excluded.cuenta_id, debe = excluded.debe, haber = excluded.haber
    returning (xmax = 0) as nueva)
  select count(*) filter (where nueva), count(*) filter (where not nueva) into v_nuevas, v_act from x;
  alter table public.compra_lineas enable trigger compra_lineas_validar;

  raise notice '%', format('Detalle contable de compras de la organización 3: %s líneas nuevas, %s actualizadas.%s%s',
    v_nuevas, v_act,
    case when v_sin_compra > 0 then format(' %s líneas de compras que no existen (omitidas).', v_sin_compra) else '' end,
    case when v_sin_cuenta is not null then ' Cuentas que no existen en el catálogo (omitidas): ' || v_sin_cuenta || '.' else '' end);
  drop table m_lineas;
end;
$migra$;

notify pgrst, 'reload schema';
