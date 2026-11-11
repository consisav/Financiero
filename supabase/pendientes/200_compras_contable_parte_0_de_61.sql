-- Script 200 · parte 0 de 61 · Organización 2: columnas nuevas del detalle contable de compras. Se ejecuta UNA vez, antes de las partes 1 a 61.
-- Si la tabla está ocupada por otra consulta, falla a los 20 segundos: ejecuta antes 198_compras_revisar_bloqueos.sql.
set lock_timeout = '20s';
do $col$
declare r record; v_n int := 0;
begin
  for r in select * from (values ('cuenta_codigo_anterior', 'text'), ('version_cuenta_anterior', 'integer'), ('centro_costo_anterior', 'text'),
                                 ('debe_anterior', 'numeric(18, 2)'), ('haber_anterior', 'numeric(18, 2)'), ('reconstruida', 'boolean not null default false')) as x(col, tipo)
  loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'compra_lineas' and column_name = r.col) then
      execute format('alter table public.compra_lineas add column %I %s', r.col, r.tipo);
      v_n := v_n + 1;
    end if;
  end loop;
  raise notice '%', format('Detalle contable de compras: %s columnas nuevas (las demás ya existían).', v_n);
end;
$col$;
-- Las líneas que el script 168 reconstruyó en las compras de la organización 2 se reemplazan por las del sistema anterior:
-- se borran aquí, una sola vez, para que las partes 1 a 61 no borren nada. No se tocan las 22 compras que no traen detalle contable.
do $rec$
declare v_org bigint; v_rec int;
begin
  select id into v_org from public.organizaciones where codigo = '2';
  if v_org is null then raise notice 'No existe la organización 2.'; return; end if;
  alter table public.compra_lineas disable trigger compra_lineas_validar;
  delete from public.compra_lineas cl
  using public.compras c join public.localidades l on l.id = c.localidad_id and l.organizacion_id = v_org
  where cl.compra_id = c.id and cl.reconstruida and c.origen_anterior = 'VARIAS'
    and (l.correlativo, c.compra_anterior) not in (values (1, 1408), (1, 1415), (1, 2295), (1, 2296), (1, 3409), (1, 6297), (1, 6444), (1, 6905), (1, 6996), (1, 9473), (1, 9558), (1, 9889), (1, 11822), (1, 13757), (2, 1178), (2, 1555), (2, 2291), (2, 2293), (3, 655), (3, 940), (3, 1490), (3, 4022));
  get diagnostics v_rec = row_count;
  alter table public.compra_lineas enable trigger compra_lineas_validar;
  raise notice '%', format('Líneas reconstruidas por el script 168 que se reemplazarán: %s.', v_rec);
end;
$rec$;
analyze public.compras;
analyze public.compra_lineas;
notify pgrst, 'reload schema';
