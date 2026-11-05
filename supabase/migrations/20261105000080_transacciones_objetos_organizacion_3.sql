-- Transacciones x objeto contable de la organización 3 (Futura Farma - Mavisa), del archivo
-- «5.1 CON_TRANSACCIONES_OBJETOS.xls»: 150 filas de las localidades 1, 2 y 3.
--   1. Si la transacción ya está ligada al objeto NO se vuelve a crear: se actualiza su cuenta
--      bancaria (las que el objeto ya tenía y no vienen en el archivo se conservan).
--   2. Todas las columnas del archivo ya existen en la base de datos (OBJETO, TIPO_TRANSACCION y
--      CUENTA_BANCARIA); no se agregan columnas.
--   A la cuenta bancaria se le quita el punto final que traen algunas filas (p. ej. «3659016341.»).
--   Objetos o transacciones que no existan en la localidad se omiten y se informan.
--   Puede ejecutarse de nuevo: la segunda vez solo actualiza.
-- Se ejecuta después de los scripts 78 y 79.

do $migra$
declare
  v_org bigint;
  v_loc bigint;
  v_obj bigint;
  v_trx bigint;
  v_banco text;
  r record;
  v_nuevas integer := 0;
  v_act integer := 0;
  v_faltan text := '';
  v_omitidas text := '';
begin
  select id into v_org from public.organizaciones where codigo = 3;
  if v_org is null then raise exception 'No existe la organización 3.'; end if;

  for r in
    select * from (values
      (1, 6, 1011, null),
      (1, 6, 1012, null),
      (1, 6, 1013, null),
      (1, 6, 1014, null),
      (1, 6, 1015, null),
      (1, 6, 1016, null),
      (1, 6, 1043, null),
      (1, 6, 1059, null),
      (1, 6, 1060, null),
      (1, 8, 1001, null),
      (1, 8, 1002, null),
      (1, 8, 1003, null),
      (1, 8, 1004, null),
      (1, 8, 1005, null),
      (1, 8, 1006, null),
      (1, 8, 1007, null),
      (1, 8, 1008, null),
      (1, 8, 1010, null),
      (1, 9, 1021, '3659016341'),
      (1, 9, 1022, '007-024094-0'),
      (1, 9, 1030, '3659016341'),
      (1, 9, 1033, '3659016341'),
      (1, 9, 1034, '3659016341'),
      (1, 9, 1035, '3659016341'),
      (1, 9, 1036, '3659016341'),
      (1, 9, 1037, '007-024094-0'),
      (1, 9, 1038, '007-024094-0'),
      (1, 9, 1039, '007-024094-0'),
      (1, 9, 1040, '007-024094-0'),
      (1, 9, 1041, '3659016341'),
      (1, 9, 1042, '3659016341'),
      (1, 9, 1048, '007-024094-0'),
      (1, 10, 1044, null),
      (1, 11, 1045, null),
      (1, 11, 1056, null),
      (1, 12, 1023, '3659016341'),
      (1, 12, 1024, '007-024094-0'),
      (1, 13, 1025, '3659016341'),
      (1, 13, 1026, '007-024094-0'),
      (1, 13, 1047, '206-134190-1'),
      (1, 13, 1053, '3659016341'),
      (1, 13, 1054, '007-024094-0'),
      (1, 13, 1055, '206-134190-1'),
      (1, 13, 1062, null),
      (1, 14, 1029, null),
      (1, 18, 1017, null),
      (1, 18, 1018, null),
      (1, 18, 1019, null),
      (1, 20, 1027, '3659016341'),
      (1, 20, 1028, '007-024094-0'),
      (1, 20, 1046, '206-134190-1'),
      (1, 20, 1050, '3659016341'),
      (1, 20, 1051, '007-024094-0'),
      (1, 20, 1052, '206-134190-1'),
      (1, 20, 1057, '007-024094-0'),
      (1, 20, 1058, '007-024094-0'),
      (1, 20, 1061, null),
      (1, 28, 1049, null),
      (1, 41, 1031, null),
      (2, 6, 1017, null),
      (2, 6, 1023, null),
      (2, 6, 1042, null),
      (2, 6, 1043, null),
      (2, 6, 1044, null),
      (2, 8, 1001, null),
      (2, 8, 1002, null),
      (2, 8, 1003, null),
      (2, 8, 1004, null),
      (2, 8, 1005, null),
      (2, 9, 1006, '206-131947-7'),
      (2, 9, 1007, '206-131947-7'),
      (2, 9, 1010, null),
      (2, 9, 1011, null),
      (2, 10, 1020, null),
      (2, 10, 1021, null),
      (2, 11, 1016, null),
      (2, 11, 1022, null),
      (2, 11, 1037, null),
      (2, 12, 1008, '206-131947-7'),
      (2, 12, 1025, '3235100377'),
      (2, 12, 1026, '206-134189-3'),
      (2, 13, 1009, '206-131947-7'),
      (2, 13, 1014, '206-134189-3'),
      (2, 13, 1029, '3235100377'),
      (2, 13, 1034, '3235100377'),
      (2, 13, 1035, '206-131947-7'),
      (2, 13, 1036, '206-134189-3'),
      (2, 13, 1046, '206-131947-7'),
      (2, 20, 1012, '206-131947-7'),
      (2, 20, 1013, '206-134189-3'),
      (2, 20, 1027, '206-131947-7'),
      (2, 20, 1028, '206-131947-7'),
      (2, 20, 1030, '3235100377'),
      (2, 20, 1031, '3235100377'),
      (2, 20, 1032, '206-131947-7'),
      (2, 20, 1033, '206-134189-3'),
      (2, 20, 1038, '206-131947-7'),
      (2, 20, 1039, '206-131947-7'),
      (2, 20, 1040, '206-131947-7'),
      (2, 20, 1041, '3235100377'),
      (2, 20, 1045, '206-131947-7'),
      (2, 28, 1019, null),
      (3, 6, 1011, null),
      (3, 6, 1012, null),
      (3, 6, 1013, null),
      (3, 6, 1014, null),
      (3, 6, 1015, null),
      (3, 6, 1016, null),
      (3, 6, 1043, null),
      (3, 8, 1001, null),
      (3, 8, 1002, null),
      (3, 8, 1003, null),
      (3, 8, 1004, null),
      (3, 8, 1005, null),
      (3, 8, 1006, null),
      (3, 8, 1007, null),
      (3, 8, 1008, null),
      (3, 8, 1010, null),
      (3, 9, 1021, '3659016341.'),
      (3, 9, 1022, '007-024094-0.'),
      (3, 9, 1030, '3659016341.'),
      (3, 9, 1033, '3659016341.'),
      (3, 9, 1034, '3659016341.'),
      (3, 9, 1035, '3659016341.'),
      (3, 9, 1036, '3659016341.'),
      (3, 9, 1037, '007-024094-0.'),
      (3, 9, 1038, '007-024094-0.'),
      (3, 9, 1039, '007-024094-0.'),
      (3, 9, 1040, '007-024094-0.'),
      (3, 9, 1041, '3659016341.'),
      (3, 9, 1042, '3659016341.'),
      (3, 9, 1048, '007-024094-0.'),
      (3, 10, 1044, null),
      (3, 11, 1045, null),
      (3, 12, 1023, '3659016341.'),
      (3, 12, 1024, '007-024094-0.'),
      (3, 13, 1025, '3659016341.'),
      (3, 13, 1026, '007-024094-0.'),
      (3, 13, 1047, '206-134190-1.'),
      (3, 14, 1029, null),
      (3, 18, 1017, null),
      (3, 18, 1018, null),
      (3, 18, 1019, null),
      (3, 20, 1027, '3659016341.'),
      (3, 20, 1028, '007-024094-0.'),
      (3, 20, 1046, '206-134190-1.'),
      (3, 28, 1049, null),
      (3, 41, 1031, null),
      (3, 43, 1025, '3659016341'),
      (3, 43, 1026, '007-024094-0')
    ) as x (localidad, objeto, transaccion, cuenta_bancaria)
    order by localidad, objeto, transaccion
  loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.localidad;
    if v_loc is null then
      if position(format('3-%s', lpad(r.localidad::text, 2, '0')) in v_omitidas) = 0 then v_omitidas := v_omitidas || format(' 3-%s', lpad(r.localidad::text, 2, '0')); end if;
      continue;
    end if;
    select id into v_obj from public.objetos_contables where localidad_id = v_loc and numero = r.objeto;
    select id into v_trx from public.transacciones_contables where localidad_id = v_loc and numero = r.transaccion;
    if v_obj is null or v_trx is null then
      v_faltan := v_faltan || format(' 3-%s objeto %s / transacción %s;', lpad(r.localidad::text, 2, '0'), r.objeto, r.transaccion);
      continue;
    end if;
    v_banco := nullif(regexp_replace(trim(r.cuenta_bancaria), '\.+$', ''), '');
    if exists (select 1 from public.objeto_transacciones where objeto_id = v_obj and transaccion_id = v_trx) then
      update public.objeto_transacciones set cuenta_bancaria = v_banco where objeto_id = v_obj and transaccion_id = v_trx;
      v_act := v_act + 1;
    else
      insert into public.objeto_transacciones (objeto_id, transaccion_id, cuenta_bancaria) values (v_obj, v_trx, v_banco);
      v_nuevas := v_nuevas + 1;
    end if;
  end loop;

  raise notice '%', format('Transacciones x objeto de la organización 3: %s nuevas, %s actualizadas.%s%s',
    v_nuevas, v_act,
    case when v_faltan <> '' then ' Omitidas (no existe el objeto o la transacción):' || v_faltan else '' end,
    case when v_omitidas <> '' then ' Localidades que no existen (omitidas):' || v_omitidas else '' end);
end;
$migra$;
