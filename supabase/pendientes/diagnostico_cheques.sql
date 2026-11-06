-- Diagnóstico de los cheques migrados de la organización 3 (solo consulta: no cambia nada).
-- Pegar en el SQL Editor de Supabase y ejecutar: el resultado es una tabla con lo que hay cargado.
select orden, dato, valor from (
  select 1 as orden, 'Scripts: columna origen_anterior en movimientos_bancarios (script 108)' as dato,
         case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'movimientos_bancarios' and column_name = 'origen_anterior') then 'SÍ' else 'NO: falta ejecutar el script 108' end as valor
  union all
  select 2, 'Cuentas bancarias de la organización 3',
         coalesce((select string_agg(l.codigo || ' ' || cb.numero, ', ' order by l.codigo, cb.numero) from public.cuentas_bancarias cb join public.localidades l on l.id = cb.localidad_id join public.organizaciones o on o.id = l.organizacion_id where o.codigo = '3'), 'NINGUNA: falta el script 82')
  union all
  select 3, 'Correlativos de las empresas de la organización 3',
         coalesce((select string_agg(l.codigo || ' = correlativo ' || l.correlativo, ', ' order by l.codigo) from public.localidades l join public.organizaciones o on o.id = l.organizacion_id where o.codigo = '3'), 'NINGUNA')
  union all
  select 10 + row_number() over (order by l.codigo), 'Cheques en ' || l.codigo || ' · ' || l.nombre_comercial,
         count(m.id) || ' cheques (' || count(m.id) filter (where m.estado = 'ANULADO') || ' anulados), del ' ||
         coalesce(to_char(min(m.fecha), 'DD/MM/YYYY'), '—') || ' al ' || coalesce(to_char(max(m.fecha), 'DD/MM/YYYY'), '—')
  from public.localidades l join public.organizaciones o on o.id = l.organizacion_id
  left join public.movimientos_bancarios m on m.localidad_id = l.id and m.tipo = 'CHEQUE'
  where o.codigo = '3' group by l.id, l.codigo, l.nombre_comercial
  union all
  select 20, 'Líneas contables de cheques de la organización 3',
         (select count(*) from public.movimiento_lineas ml join public.movimientos_bancarios m on m.id = ml.movimiento_id join public.organizaciones o on o.id = m.organizacion_id where o.codigo = '3' and m.tipo = 'CHEQUE')::text
  union all
  select 21, 'Cheques de compras ligados a su cheque (compra_documentos_banco)',
         (select count(movimiento_id) || ' de ' || count(*) from public.compra_documentos_banco d join public.compras c on c.id = d.compra_id join public.organizaciones o on o.id = c.organizacion_id where o.codigo = '3' and d.tipo = 'CHEQUE')
  union all
  select 30, 'Opción Consulta de Cheques en el menú (script 110)',
         case when exists (select 1 from public.opciones_sistema where clave = 'consulta-de-cheques') then 'SÍ' else 'NO: falta ejecutar el script 110' end
) x order by orden;
