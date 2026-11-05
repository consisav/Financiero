-- Objetos contables de la organización 3 (archivo «5. CON_OBJETOS_CONTA.xls», Futura Farma - Mavisa):
-- 127 objetos de las localidades 1 (42), 2 (42) y 3 (43).
--   1. Si el objeto ya existe en la localidad (mismo número de objeto) NO se crea: se actualiza su
--      descripción y las columnas nuevas. Los que no existen se crean con el número del archivo.
--   2. Columnas nuevas en objetos_contables (vienen en el archivo y no estaban en la base de datos):
--        version_nomenclatura  versión del catálogo de cuentas del objeto (VERSION_NOMENCLATURA).
--        no_cuentas_anterior   número de cuentas que tenía el objeto en el sistema anterior
--                              (NO_CUENTAS; la pantalla sigue contando sus cuentas x objeto).
--   numerar_objeto_contable: durante esta migración (fin.migracion) respeta el número del archivo;
--   fuera de ella sigue numerando el siguiente correlativo.
--   Puede ejecutarse de nuevo: la segunda vez solo actualiza.
-- Se ejecuta después del script 77.

alter table public.objetos_contables add column if not exists version_nomenclatura integer;
alter table public.objetos_contables add column if not exists no_cuentas_anterior integer;

create or replace function public.numerar_objeto_contable() returns trigger
language plpgsql security definer set search_path = '' as $fn$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4805, new.localidad_id::integer);
    if tg_table_name = 'objetos_contables' then
      -- Migración: se conserva el número del sistema anterior.
      if not (current_setting('fin.migracion', true) = 'si' and new.numero is not null) then
        new.numero := coalesce((select max(numero) from public.objetos_contables where localidad_id = new.localidad_id), 0) + 1;
      end if;
    elsif new.numero is null then
      new.numero := coalesce((select max(numero) from public.transacciones_contables where localidad_id = new.localidad_id), 1000) + 1;
    end if;
  else
    new.organizacion_id := old.organizacion_id;
    new.localidad_id := old.localidad_id;
    if tg_table_name = 'objetos_contables' or new.numero is null then
      new.numero := old.numero;
    end if;
  end if;
  if tg_table_name = 'transacciones_contables' and exists (
       select 1 from public.transacciones_contables t
       where t.localidad_id = new.localidad_id and t.numero = new.numero and t.id is distinct from new.id) then
    raise exception 'Ya existe la transacción % en esta localidad: usa otro código.', new.numero;
  end if;
  new.descripcion := upper(trim(new.descripcion));
  return new;
end;
$fn$;

do $migra$
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
  perform set_config('fin.migracion', 'si', true);
  for r in
    select * from (values
      (1, 1, 'PROVEEDORES', 1, 5),
      (1, 2, 'CONTRATOS', 1, 7),
      (1, 3, 'COSTEO MEDICAMENTOS', 1, 2),
      (1, 4, 'PLANES', 1, 7),
      (1, 5, 'TIPOS DE CONTRATOS', 1, 1),
      (1, 6, 'COMPRAS', 1, 5),
      (1, 7, 'TRANSFERENCIAS - AUTORIZACIONES', 1, 2),
      (1, 8, 'FACTURAS', 1, 7),
      (1, 9, 'CHEQUES', 1, 2),
      (1, 10, 'CAJAS/LIQUIDACIONES', 1, 1),
      (1, 11, 'POLIZAS', 1, 10),
      (1, 12, 'DEPOSITOS BANCARIOS', 1, 2),
      (1, 13, 'NOTAS DE CREDITO', 1, 2),
      (1, 14, 'RECIBOS', 1, 2),
      (1, 15, 'ENTRADAS A BODEGA', 1, 2),
      (1, 16, 'TRASLADOS ENTRE BODEGAS', 1, 2),
      (1, 17, 'SALIDAS DE BODEGA', 1, 2),
      (1, 18, 'AJUSTES DE INVENTARIO', 1, 2),
      (1, 19, 'BODEGAS', 1, 1),
      (1, 20, 'NOTAS DE DEBITO', 1, 2),
      (1, 21, 'REVERSIÓN ENTRADAS A BODEGA', 1, 2),
      (1, 22, 'REVERSIÓN TRASLADOS ENTRE BODEGAS', 1, 2),
      (1, 23, 'REVERSIÓN SALIDAS DE BODEGA', 1, 2),
      (1, 24, 'REVERSIÓN AJUSTES DE INVENTARIO', 1, 2),
      (1, 25, 'CHEQUES ANULADOS', 1, 2),
      (1, 26, 'DEPRECIACIONES', 1, 2),
      (1, 27, 'NOTAS DE CREDITO SOBRE VENTAS', 1, 7),
      (1, 28, 'RETENCIONES IVA', 1, 2),
      (1, 29, 'EXENCIONES DE IVA', 1, 2),
      (1, 30, 'ALTAS ACTIVOS FIJOS', 1, 2),
      (1, 31, 'TRANSFERENCIAS - COMISIONES', 1, 9),
      (1, 32, 'DEVOLUCIONES', 1, 2),
      (1, 33, 'TRANSFERENCIA GASTOS OPERATIVOS', 1, 0),
      (1, 34, 'TRANSFERENCIA GASTOS FINANCIEROS', 1, 0),
      (1, 35, 'TRANSFERENCIA COSTOS ADMINISTRACION', 1, 0),
      (1, 36, 'TRANSFERENCIA - CLINICAS', 1, 0),
      (1, 37, 'LIQUIDACION AMBULANCIAS', 1, 0),
      (1, 38, 'CLASIFICACION PRODUCTOS', 1, 0),
      (1, 39, 'TRANSFERENCIA - AMBULANCIAS', 1, 0),
      (1, 40, 'REVERSION DE DEVOLUCIONES', 1, 0),
      (1, 41, 'PAGO DE SALARIOS', 1, 0),
      (1, 42, 'RETENCIONES ISR', 1, 0),
      (2, 1, 'PROVEEDORES', 1, 5),
      (2, 2, 'CONTRATOS', 1, 7),
      (2, 3, 'COSTEO MEDICAMENTOS', 1, 2),
      (2, 4, 'PLANES', 1, 7),
      (2, 5, 'TIPOS DE CONTRATOS', 1, 1),
      (2, 6, 'COMPRAS', 1, 5),
      (2, 7, 'TRANSFERENCIAS - AUTORIZACIONES', 1, 2),
      (2, 8, 'FACTURAS', 1, 7),
      (2, 9, 'CHEQUES', 1, 2),
      (2, 10, 'CAJAS/LIQUIDACIONES', 1, 1),
      (2, 11, 'POLIZAS', 1, 10),
      (2, 12, 'DEPOSITOS BANCARIOS', 1, 2),
      (2, 13, 'NOTAS DE CREDITO', 1, 2),
      (2, 14, 'RECIBOS', 1, 2),
      (2, 15, 'ENTRADAS A BODEGA', 1, 2),
      (2, 16, 'TRASLADOS ENTRE BODEGAS', 1, 2),
      (2, 17, 'SALIDAS DE BODEGA', 1, 2),
      (2, 18, 'AJUSTES DE INVENTARIO', 1, 2),
      (2, 19, 'BODEGAS', 1, 1),
      (2, 20, 'NOTAS DE DEBITO', 1, 2),
      (2, 21, 'REVERSIÓN ENTRADAS A BODEGA', 1, 2),
      (2, 22, 'REVERSIÓN TRASLADOS ENTRE BODEGAS', 1, 2),
      (2, 23, 'REVERSIÓN SALIDAS DE BODEGA', 1, 2),
      (2, 24, 'REVERSIÓN AJUSTES DE INVENTARIO', 1, 2),
      (2, 25, 'CHEQUES ANULADOS', 1, 2),
      (2, 26, 'DEPRECIACIONES', 1, 2),
      (2, 27, 'NOTAS DE CREDITO SOBRE VENTAS', 1, 7),
      (2, 28, 'RETENCIONES IVA', 1, 2),
      (2, 29, 'EXENCIONES DE IVA', 1, 2),
      (2, 30, 'ALTAS ACTIVOS FIJOS', 1, 2),
      (2, 31, 'TRANSFERENCIAS - COMISIONES', 1, 9),
      (2, 32, 'DEVOLUCIONES', 1, 2),
      (2, 33, 'TRANSFERENCIA GASTOS OPERATIVOS', 1, 0),
      (2, 34, 'TRANSFERENCIA GASTOS FINANCIEROS', 1, 0),
      (2, 35, 'TRANSFERENCIA COSTOS ADMINISTRACION', 1, 0),
      (2, 36, 'TRANSFERENCIA - CLINICAS', 1, 0),
      (2, 37, 'LIQUIDACION AMBULANCIAS', 1, 0),
      (2, 38, 'CLASIFICACION PRODUCTOS', 1, 0),
      (2, 39, 'TRANSFERENCIA - AMBULANCIAS', 1, 0),
      (2, 40, 'REVERSION DE DEVOLUCIONES', 1, 0),
      (2, 41, 'LIQUIDACION DE EMPLEADOS', 1, 0),
      (2, 42, 'RETENCIONES ISR', 1, 0),
      (3, 1, 'PROVEEDORES', 1, 5),
      (3, 2, 'CONTRATOS', 1, 7),
      (3, 3, 'COSTEO MEDICAMENTOS', 1, 2),
      (3, 4, 'PLANES', 1, 7),
      (3, 5, 'TIPOS DE CONTRATOS', 1, 1),
      (3, 6, 'COMPRAS', 1, 5),
      (3, 7, 'TRANSFERENCIAS - AUTORIZACIONES', 1, 2),
      (3, 8, 'FACTURAS', 1, 7),
      (3, 9, 'CHEQUES', 1, 2),
      (3, 10, 'CAJAS/LIQUIDACIONES', 1, 1),
      (3, 11, 'POLIZAS', 1, 10),
      (3, 12, 'DEPOSITOS BANCARIOS', 1, 2),
      (3, 13, 'NOTAS DE CREDITO', 1, 2),
      (3, 14, 'RECIBOS', 1, 2),
      (3, 15, 'ENTRADAS A BODEGA', 1, 2),
      (3, 16, 'TRASLADOS ENTRE BODEGAS', 1, 2),
      (3, 17, 'SALIDAS DE BODEGA', 1, 2),
      (3, 18, 'AJUSTES DE INVENTARIO', 1, 2),
      (3, 19, 'BODEGAS', 1, 1),
      (3, 20, 'NOTAS DE DEBITO', 1, 2),
      (3, 21, 'REVERSIÓN ENTRADAS A BODEGA', 1, 2),
      (3, 22, 'REVERSIÓN TRASLADOS ENTRE BODEGAS', 1, 2),
      (3, 23, 'REVERSIÓN SALIDAS DE BODEGA', 1, 2),
      (3, 24, 'REVERSIÓN AJUSTES DE INVENTARIO', 1, 2),
      (3, 25, 'CHEQUES ANULADOS', 1, 2),
      (3, 26, 'DEPRECIACIONES', 1, 2),
      (3, 27, 'NOTAS DE CREDITO SOBRE VENTAS', 1, 7),
      (3, 28, 'RETENCIONES IVA', 1, 2),
      (3, 29, 'EXENCIONES DE IVA', 1, 2),
      (3, 30, 'ALTAS ACTIVOS FIJOS', 1, 2),
      (3, 31, 'TRANSFERENCIAS - COMISIONES', 1, 9),
      (3, 32, 'DEVOLUCIONES', 1, 2),
      (3, 33, 'TRANSFERENCIA GASTOS OPERATIVOS', 1, 0),
      (3, 34, 'TRANSFERENCIA GASTOS FINANCIEROS', 1, 0),
      (3, 35, 'TRANSFERENCIA COSTOS ADMINISTRACION', 1, 0),
      (3, 36, 'TRANSFERENCIA - CLINICAS', 1, 0),
      (3, 37, 'LIQUIDACION AMBULANCIAS', 1, 0),
      (3, 38, 'CLASIFICACION PRODUCTOS', 1, 0),
      (3, 39, 'TRANSFERENCIA - AMBULANCIAS', 1, 0),
      (3, 40, 'REVERSION DE DEVOLUCIONES', 1, 0),
      (3, 41, 'LIQUIDACION DE EMPLEADOS', 1, 0),
      (3, 42, 'RETENCIONES ISR', 1, 0),
      (3, 44, 'GASTOS ANTICIPADOS', 1, 2)
    ) as x (localidad, objeto, descripcion, version_nomenclatura, no_cuentas)
    order by localidad, objeto
  loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.localidad;
    if v_loc is null then
      if position(format('3-%s', lpad(r.localidad::text, 2, '0')) in v_omitidas) = 0 then v_omitidas := v_omitidas || format(' 3-%s', lpad(r.localidad::text, 2, '0')); end if;
      continue;
    end if;
    if exists (select 1 from public.objetos_contables where localidad_id = v_loc and numero = r.objeto) then
      update public.objetos_contables set descripcion = r.descripcion, version_nomenclatura = r.version_nomenclatura, no_cuentas_anterior = r.no_cuentas
      where localidad_id = v_loc and numero = r.objeto;
      v_actualizados := v_actualizados + 1;
    else
      insert into public.objetos_contables (organizacion_id, localidad_id, numero, descripcion, activo, version_nomenclatura, no_cuentas_anterior)
      values (v_org, v_loc, r.objeto, r.descripcion, true, r.version_nomenclatura, r.no_cuentas);
      v_nuevos := v_nuevos + 1;
    end if;
  end loop;
  perform set_config('fin.migracion', '', true);
  raise notice '%', format('Objetos contables de la organización 3: %s nuevos, %s actualizados.%s', v_nuevos, v_actualizados,
    case when v_omitidas <> '' then ' Localidades que no existen (omitidas):' || v_omitidas else '' end);
end;
$migra$;

notify pgrst, 'reload schema';
