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
analyze public.compras;
analyze public.compra_lineas;
notify pgrst, 'reload schema';
