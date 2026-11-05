-- Tipos de cuenta de la organización 3 (archivo «3. CON_TIPOS_CUENTAS.xls», Futura Farma - Mavisa):
-- 9 tipos para cada una de sus localidades 1, 2 y 3 (27 filas).
--   Columnas nuevas en tipos_cuenta (vienen en el archivo y no estaban en la base de datos):
--     version             versión del catálogo de cuentas a la que pertenecía el tipo (VERSION).
--     reporte_financiero  B = balance general, E = estado de resultados (REPORTE_FIN).
--     operacion_balance   operación en el balance: 0 o 1, vacío si no aplica (OPERACION_BALANCE).
--     presupuesto         si el tipo se presupuesta (PRESUPUESTO S/N).
--   Equivalencias: TIPO_OPERACION 1 = DEBE-HABER, 2 = HABER-DEBE; OPERACION_RESULTADO 0 = NINGUNA,
--   1 = SUMAR, -1 = RESTAR; CENTRO_COSTO S/N = incluye centro de costo.
--   Cada fila se carga en la localidad del mismo correlativo de la organización 3: si el tipo ya
--   existe (mismo código) se actualiza con los datos del archivo; si no, se crea. Una localidad que
--   no exista se informa y se omite. Puede ejecutarse de nuevo.
-- Se ejecuta después del script 75 (tipos de cuenta por organización y localidad).

alter table public.tipos_cuenta add column if not exists version integer not null default 1;
alter table public.tipos_cuenta add column if not exists reporte_financiero text;
alter table public.tipos_cuenta add column if not exists operacion_balance integer;
alter table public.tipos_cuenta add column if not exists presupuesto boolean not null default false;
alter table public.tipos_cuenta drop constraint if exists tipos_cuenta_reporte_financiero_check;
alter table public.tipos_cuenta add constraint tipos_cuenta_reporte_financiero_check check (reporte_financiero in ('B', 'E'));

-- Los tipos existentes toman el reporte según su naturaleza (activo, pasivo y patrimonio al balance).
update public.tipos_cuenta set reporte_financiero = case when codigo <= 3 then 'B' else 'E' end where reporte_financiero is null;

do $$
declare
  v_org bigint;
  v_loc bigint;
  r record;
  v_nuevos integer := 0;
  v_actualizados integer := 0;
  v_omitidas text := '';
begin
  select id into v_org from public.organizaciones where codigo = 3;
  if v_org is null then raise exception 'No existe la organización 3.'; end if;
  for r in
    select * from (values
  (3, 1, 1, 1, 'ACTIVO', 1, 0, 'N', 'B', 0, 'N'),
  (3, 1, 1, 2, 'PASIVO', 2, 0, 'N', 'B', 1, 'N'),
  (3, 1, 1, 3, 'PATRIMONIO', 2, 0, 'N', 'B', 1, 'N'),
  (3, 1, 1, 4, 'INGRESOS', 2, 1, 'N', 'E', 0, 'N'),
  (3, 1, 1, 5, 'COSTO DE VENTAS', 1, -1, 'N', 'E', 0, 'N'),
  (3, 1, 1, 6, 'GASTOS DE OPERACIÓN', 1, -1, 'N', 'E', 0, 'N'),
  (3, 1, 1, 7, 'OTROS INGRESOS', 2, 1, 'N', 'E', null, 'N'),
  (3, 1, 1, 8, 'OTROS GASTOS', 1, -1, 'N', 'E', null, 'N'),
  (3, 1, 1, 9, 'EGRESOS CUENTA AJENA', 1, -1, 'N', 'E', null, 'N'),
  (3, 2, 1, 1, 'ACTIVO', 1, 0, 'N', 'B', 0, 'N'),
  (3, 2, 1, 2, 'PASIVO', 2, 0, 'N', 'B', 1, 'N'),
  (3, 2, 1, 3, 'PATRIMONIO', 2, 0, 'N', 'B', 1, 'N'),
  (3, 2, 1, 4, 'INGRESOS', 2, 1, 'N', 'E', 0, 'N'),
  (3, 2, 1, 5, 'COSTO DE VENTAS', 1, -1, 'N', 'E', 0, 'N'),
  (3, 2, 1, 6, 'GASTOS DE OPERACIÓN', 1, -1, 'N', 'E', 0, 'N'),
  (3, 2, 1, 7, 'OTROS INGRESOS', 2, 1, 'N', 'E', null, 'N'),
  (3, 2, 1, 8, 'OTROS GASTOS', 1, -1, 'N', 'E', null, 'N'),
  (3, 2, 1, 9, 'EGRESOS CUENTA AJENA', 1, -1, 'S', 'E', null, 'N'),
  (3, 3, 1, 1, 'ACTIVO', 1, 0, 'N', 'B', 0, 'N'),
  (3, 3, 1, 2, 'PASIVO', 2, 0, 'N', 'B', 1, 'N'),
  (3, 3, 1, 3, 'PATRIMONIO', 2, 0, 'N', 'B', 1, 'N'),
  (3, 3, 1, 4, 'INGRESOS', 2, 1, 'N', 'E', 0, 'N'),
  (3, 3, 1, 5, 'COSTO DE VENTAS', 1, -1, 'N', 'E', 0, 'N'),
  (3, 3, 1, 6, 'GASTOS DE OPERACIÓN', 1, -1, 'N', 'E', 0, 'N'),
  (3, 3, 1, 7, 'OTROS GASTOS Y PRODUCTOS', 2, 1, 'N', 'E', null, 'N'),
  (3, 3, 1, 8, 'INGRESOS CUENTA AJENA', 1, 1, 'N', 'E', null, 'N'),
  (3, 3, 1, 9, 'EGRESOS CUENTA AJENA', 1, -1, 'N', 'E', null, 'N')
    ) as x (organizacion, localidad, version, tipo, descripcion, tipo_operacion, operacion_resultado, centro_costo, reporte_fin, operacion_balance, presupuesto)
  loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.localidad;
    if v_loc is null then
      if position(format('3-%s', lpad(r.localidad::text, 2, '0')) in v_omitidas) = 0 then v_omitidas := v_omitidas || format(' 3-%s', lpad(r.localidad::text, 2, '0')); end if;
      continue;
    end if;
    if exists (select 1 from public.tipos_cuenta where localidad_id = v_loc and codigo = r.tipo) then
      update public.tipos_cuenta set
        descripcion = upper(trim(r.descripcion)),
        tipo_operacion = case r.tipo_operacion when 1 then 'DEBE-HABER' else 'HABER-DEBE' end,
        operacion_resultado = case r.operacion_resultado when 1 then 'SUMAR' when -1 then 'RESTAR' else 'NINGUNA' end,
        incluye_centro_costo = r.centro_costo = 'S',
        version = r.version, reporte_financiero = r.reporte_fin, operacion_balance = r.operacion_balance, presupuesto = r.presupuesto = 'S'
      where localidad_id = v_loc and codigo = r.tipo;
      v_actualizados := v_actualizados + 1;
    else
      insert into public.tipos_cuenta (organizacion_id, localidad_id, codigo, descripcion, tipo_operacion, operacion_resultado, incluye_centro_costo, activo, version, reporte_financiero, operacion_balance, presupuesto)
      values (v_org, v_loc, r.tipo, upper(trim(r.descripcion)),
              case r.tipo_operacion when 1 then 'DEBE-HABER' else 'HABER-DEBE' end,
              case r.operacion_resultado when 1 then 'SUMAR' when -1 then 'RESTAR' else 'NINGUNA' end,
              r.centro_costo = 'S', true, r.version, r.reporte_fin, r.operacion_balance, r.presupuesto = 'S');
      v_nuevos := v_nuevos + 1;
    end if;
  end loop;
  raise notice 'Tipos de cuenta de la organización 3: % nuevos, % actualizados.%', v_nuevos, v_actualizados,
    case when v_omitidas <> '' then ' Localidades que no existen (omitidas):' || v_omitidas else '' end;
end;
$$;

notify pgrst, 'reload schema';
