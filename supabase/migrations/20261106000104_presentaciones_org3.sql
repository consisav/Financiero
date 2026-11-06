-- Presentaciones de productos de la organización 3 (Futura Farma - Mavisa), del archivo
-- «ACT_PRESENTACIONES.xls» (35 presentaciones, códigos 1 y del 19 al 52).
--   El archivo no trae organización ni localidad (es una sola lista): las mismas presentaciones se cargan
--   en TODAS las empresas (localidades) de la organización 3.
--   1. Si ya existe en la localidad (mismo código) NO se crea: se actualiza.
--   2. El archivo no trae columnas que no estén en la base de datos (PRESENTACION = código, DESCRIPCION).
--   Descripciones repetidas (la base exige que no se repitan en la localidad): se conserva cada código y la
--   repetición lleva « (2)», « (3)»…: 21 CAJA X 10 (2), 24 CAJA X 10 (3), 26 CAJA X 1 (2), 27 CAJA X 100 (2), 28 CAJA X 10 (4), 32 CAJA X 50 (2), 34 CAJA X 30 (2), 38 CAJA X 1 (3), 41 CAJA X 1 (4), 42 CAJA X 15 (2), 43 CAJA X 50 (3).
--   Puede ejecutarse de nuevo: la segunda vez solo actualiza.
-- Se ejecuta después del script 103.

do $migra$
declare
  v_org bigint;
  v_loc record;
  r record;
  v_nuevo boolean;
  v_n int := 0; v_a int := 0; v_emp text := '';
begin
  select id into v_org from public.organizaciones where codigo = '3';
  if v_org is null then raise notice 'No existe la organización 3.'; return; end if;
  for v_loc in select id, codigo from public.localidades where organizacion_id = v_org order by correlativo loop
    for r in select * from (values
    (1, 'SIN PRESENTACION'),
    (19, 'CAJA X 1'),
    (20, 'CAJA X 10'),
    (21, 'CAJA X 10 (2)'),
    (22, 'CAJA X 5'),
    (23, 'CAJA X 100'),
    (24, 'CAJA X 10 (3)'),
    (25, 'CAJA X 50'),
    (26, 'CAJA X 1 (2)'),
    (27, 'CAJA X 100 (2)'),
    (28, 'CAJA X 10 (4)'),
    (29, 'CAJA X 20'),
    (30, 'CAJA X 30'),
    (31, 'CAJA X 2'),
    (32, 'CAJA X 50 (2)'),
    (33, 'DUO PACK FRASCO'),
    (34, 'CAJA X 30 (2)'),
    (35, 'CAJA X 25'),
    (36, 'FRASCO'),
    (37, 'DUO CAJA X 10'),
    (38, 'CAJA X 1 (3)'),
    (39, 'CAJA X 60'),
    (40, 'CAJA X 15'),
    (41, 'CAJA X 1 (4)'),
    (42, 'CAJA X 15 (2)'),
    (43, 'CAJA X 50 (3)'),
    (44, 'CAJA X 3'),
    (45, 'AMPOLLA - 5 MILILITROS (ML)'),
    (46, 'BOLSA'),
    (47, '60 ML'),
    (48, '100 ML'),
    (49, '250 ML'),
    (50, '500 ML'),
    (51, '1000 ML'),
    (52, 'B X 50 UND')) as x(codigo, nombre) loop
      insert into public.presentaciones_producto (organizacion_id, localidad_id, codigo, nombre)
      values (v_org, v_loc.id, r.codigo, r.nombre)
      on conflict (localidad_id, codigo) do update set nombre = excluded.nombre
      returning (xmax = 0) into v_nuevo;
      if v_nuevo then v_n := v_n + 1; else v_a := v_a + 1; end if;
    end loop;
    v_emp := v_emp || case when v_emp = '' then '' else ', ' end || v_loc.codigo;
  end loop;
  raise notice '%', format('Presentaciones: %s nuevas, %s actualizadas (en %s).', v_n, v_a, v_emp);
end;
$migra$;

notify pgrst, 'reload schema';
