-- Verificación de las migraciones del 19-11-2026 (scripts 296 a 320). SOLO LECTURA: no cambia nada, se puede ejecutar las veces que se quiera.
--   Muestra una fila por revisión con lo esperado, lo que hay en la base y si está completo (OK / FALTA / REVISAR).
--   Los scripts 296 a 316 son lotes: la tabla puede tener más filas que el lote (de lotes anteriores), por eso se pide "al menos".
with org as (
  select g.codigo, l.id as localidad_id, g.id as organizacion_id
  from public.organizaciones g join public.localidades l on l.organizacion_id = g.id
),
cuenta as (
  -- Cuenta las filas de una tabla para una organización, usando organizacion_id o, si la tabla no la tiene, localidad_id.
  select x.orden, x.script, x.tabla, x.codigo, x.esperado, x.modo,
    case
      when to_regclass('public.' || x.tabla) is null then null
      else (xpath('/row/n/text()', query_to_xml(format(
        'select count(*) as n from public.%I t where %s', x.tabla,
        case
          when exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = x.tabla and c.column_name = 'organizacion_id')
            then format('t.organizacion_id = (select id from public.organizaciones where codigo = %L)', x.codigo)
          when exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = x.tabla and c.column_name = 'localidad_id')
            then format('t.localidad_id in (select l.id from public.localidades l join public.organizaciones g on g.id = l.organizacion_id where g.codigo = %L)', x.codigo)
          else 'true'
        end), false, true, '')))[1]::text::bigint
    end as hay
  from (values
    (1,  '297', 'clasificaciones_compra',                   '2', 10,    'al menos'),
    (2,  '299', 'compra_lineas',                            '2', 635,   'al menos'),
    (3,  '301', 'compras_inventario_anteriores',            '2', 10105, 'al menos'),
    (4,  '301', 'compras_inventario_contable_anteriores',   '2', 4268,  'al menos'),
    (5,  '304', 'caja_lineas',                              '2', 581,   'al menos'),
    (6,  '314', 'saldos_cierre',                            '2', 2031,  'al menos'),
    (7,  '315', 'cierres_contables_anteriores',             '2', 11,    'al menos'),
    (8,  '318', 'sat_dte',                                  '2', 49572, 'igual'),
    (9,  '318', 'sat_dte_anulaciones',                      '2', 1498,  'igual'),
    (10, '318', 'sat_fel_ids',                              '2', 60059, 'igual'),
    (11, '319', 'factura_venta_comentarios',                '2', 98060, 'igual'),
    (12, '320', 'sat_dte',                                  '4', 1521,  'igual'),
    (13, '320', 'sat_dte_anulaciones',                      '4', 149,   'igual'),
    (14, '320', 'sat_fel_ids',                              '4', 20000, 'igual')
  ) as x(orden, script, tabla, codigo, esperado, modo)
),
hijos as (
  -- Tablas del FEL ligadas al DTE (no tienen organización propia).
  select o.orden, o.script, o.tabla, o.codigo, o.esperado, 'igual'::text as modo,
    case o.tabla
      when 'sat_dte_items'   then (select count(*) from public.sat_dte_items h   join public.sat_dte d on d.id = h.dte_id join org on org.localidad_id = d.localidad_id where org.codigo = o.codigo)
      when 'sat_dte_frases'  then (select count(*) from public.sat_dte_frases h  join public.sat_dte d on d.id = h.dte_id join org on org.localidad_id = d.localidad_id where org.codigo = o.codigo)
      when 'sat_dte_adendas' then (select count(*) from public.sat_dte_adendas h join public.sat_dte d on d.id = h.dte_id join org on org.localidad_id = d.localidad_id where org.codigo = o.codigo)
      when 'sat_dte_abonos'  then (select count(*) from public.sat_dte_abonos h  join public.sat_dte d on d.id = h.dte_id join org on org.localidad_id = d.localidad_id where org.codigo = o.codigo)
    end as hay
  from (values
    (20, '318', 'sat_dte_items',   '2', 90583),
    (21, '318', 'sat_dte_frases',  '2', 49564),
    (22, '318', 'sat_dte_adendas', '2', 48743),
    (23, '320', 'sat_dte_items',   '4', 6275),
    (24, '320', 'sat_dte_frases',  '4', 1532),
    (25, '320', 'sat_dte_adendas', '4', 1496),
    (26, '320', 'sat_dte_abonos',  '4', 1496)
  ) as o(orden, script, tabla, codigo, esperado)
),
emisores as (
  select 30 as orden, '318' as script, 'sat_emisores (NIT del emisor por localidad)' as tabla, '2' as codigo, 3::bigint as esperado, 'igual' as modo,
    (select count(*) from public.sat_emisores e join org on org.localidad_id = e.localidad_id where org.codigo = '2' and e.nit is not null) as hay
  union all
  select 31, '320', 'sat_emisores (NIT del emisor por localidad)', '4', 1, 'igual',
    (select count(*) from public.sat_emisores e join org on org.localidad_id = e.localidad_id where org.codigo = '4' and e.nit is not null)
)
select script, tabla, 'Org. ' || codigo as organizacion, modo || ' ' || esperado as esperado, coalesce(hay::text, 'NO EXISTE LA TABLA') as en_la_base,
  case
    when hay is null then 'FALTA'
    when hay = 0 then 'FALTA'
    when modo = 'igual' and hay = esperado then 'OK'
    when modo = 'al menos' and hay >= esperado then 'OK'
    when hay < esperado then 'FALTA'
    else 'REVISAR'
  end as estado
from (select * from cuenta union all select * from hijos union all select * from emisores) r
order by orden;
