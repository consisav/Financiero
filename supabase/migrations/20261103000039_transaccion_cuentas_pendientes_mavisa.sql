-- Cuentas x transacción con cuenta pendiente, y carga de las cuentas de las transacciones de
-- Mavisa (archivo CON_CUENTAS_TRANSACCIONES_MAVISA, 105 líneas) en la organización 3 · localidad 2.
--   Una línea guarda el código de su cuenta (cuenta_codigo). Si la cuenta existe en el catálogo
--   activo de la localidad, queda ligada (cuenta_id); si todavía no existe, la línea se guarda
--   como pendiente y se muestra con aviso en la pantalla.
--   Cuando se crea una cuenta con ese código en el catálogo de la localidad (por ejemplo, al
--   cargar la nomenclatura de Mavisa), las líneas pendientes se ligan solas.
-- Puede ejecutarse de nuevo: no duplica líneas. Requiere los scripts 36, 37 y 38.

alter table public.transaccion_cuentas add column if not exists cuenta_codigo text;
alter table public.transaccion_cuentas alter column cuenta_id drop not null;
update public.transaccion_cuentas l set cuenta_codigo = c.codigo from public.cuentas c where c.id = l.cuenta_id and l.cuenta_codigo is null;
alter table public.transaccion_cuentas drop constraint if exists transaccion_cuentas_cuenta_check;
alter table public.transaccion_cuentas add constraint transaccion_cuentas_cuenta_check check (cuenta_id is not null or nullif(trim(cuenta_codigo), '') is not null);

-- Validación por tabla; en las líneas de transacción, el código pendiente se liga si la cuenta existe.
create or replace function public.validar_detalle_objeto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_loc bigint;
begin
  if tg_table_name = 'transaccion_cuentas' then
    select localidad_id into v_loc from public.transacciones_contables where id = new.transaccion_id;
  else
    select localidad_id into v_loc from public.objetos_contables where id = new.objeto_id;
  end if;
  -- Cada tabla tiene sus propias columnas: se valida en bloques separados.
  if tg_table_name = 'objeto_cuentas' then
    if not exists (select 1 from public.cuentas c join public.catalogos_cuentas k on k.id = c.catalogo_id
                   where c.id = new.cuenta_id and k.localidad_id = v_loc) then
      raise exception 'La cuenta no es del catálogo de cuentas de la localidad.';
    end if;
  end if;
  if tg_table_name = 'transaccion_cuentas' then
    new.cuenta_codigo := nullif(trim(new.cuenta_codigo), '');
    if new.cuenta_id is null and new.cuenta_codigo is not null then
      select c.id into new.cuenta_id
      from public.cuentas c join public.catalogos_cuentas k on k.id = c.catalogo_id
      where k.localidad_id = v_loc and k.activo and c.codigo = new.cuenta_codigo
      order by k.version desc limit 1;
    end if;
    if new.cuenta_id is not null then
      if not exists (select 1 from public.cuentas c join public.catalogos_cuentas k on k.id = c.catalogo_id
                     where c.id = new.cuenta_id and k.localidad_id = v_loc) then
        raise exception 'La cuenta no es del catálogo de cuentas de la localidad.';
      end if;
      new.cuenta_codigo := (select c.codigo from public.cuentas c where c.id = new.cuenta_id);
    end if;
    if new.centro_id is not null and not exists (
         select 1 from public.centros_costo x join public.catalogos_centros k on k.id = x.catalogo_id
         where x.id = new.centro_id and k.localidad_id = v_loc) then
      raise exception 'El centro de costo no es de la localidad.';
    end if;
  end if;
  if tg_table_name = 'objeto_transacciones' then
    if not exists (select 1 from public.transacciones_contables t where t.id = new.transaccion_id and t.localidad_id = v_loc) then
      raise exception 'La transacción no es de la localidad del objeto.';
    end if;
  end if;
  return new;
end;
$$;

-- Al crear una cuenta, se ligan las líneas pendientes con su código en la misma localidad.
create or replace function public.ligar_cuentas_pendientes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.transaccion_cuentas l
  set cuenta_id = new.id
  from public.transacciones_contables t, public.catalogos_cuentas k
  where l.transaccion_id = t.id and k.id = new.catalogo_id and t.localidad_id = k.localidad_id
    and l.cuenta_id is null and l.cuenta_codigo = new.codigo;
  return null;
end;
$$;
drop trigger if exists cuentas_ligar_pendientes on public.cuentas;
create trigger cuentas_ligar_pendientes after insert on public.cuentas
  for each row execute function public.ligar_cuentas_pendientes();
revoke execute on function public.ligar_cuentas_pendientes() from public, anon, authenticated;

-- ---------- Líneas de Mavisa ----------
do $$
declare
  v_loc bigint;
  v_nuevas integer;
  v_ligadas integer;
  v_pend integer;
begin
  select l.id into v_loc from public.localidades l join public.organizaciones o on o.id = l.organizacion_id
  where o.codigo = 3 and l.correlativo = 2;
  if v_loc is null then raise exception 'No existe la localidad 3-02 (organización 3, localidad 2).'; end if;
  if not exists (select 1 from public.transacciones_contables where localidad_id = v_loc and numero = 1001) then
    raise exception 'Primero ejecuta el script 38 (objetos y transacciones de Mavisa).';
  end if;

  create temporary table m_lineas (transaccion integer, linea integer, cuenta text, naturaleza text, orden integer, operacion text) on commit drop;
  insert into m_lineas (transaccion, linea, cuenta, naturaleza, orden, operacion) values
    (1001, 1, '1010201001', 'D', 1, 'TOTAL'),
    (1001, 3, '4010101001', 'H', 2, 'TOTAL'),
    (1002, 1, '1010201001', 'D', 1, 'TOTAL'),
    (1002, 2, '2010201001', 'H', 2, 'IMPUESTO'),
    (1002, 3, '4010101002', 'H', 3, 'SUBTOTAL'),
    (1003, 1, '1010201001', 'D', 1, 'TOTAL'),
    (1003, 2, '4010101001', 'H', 2, 'TOTAL'),
    (1004, 1, '1010201001', 'D', 1, 'TOTAL'),
    (1004, 2, '4010101002', 'H', 2, 'SUBTOTAL'),
    (1004, 3, '2010201001', 'H', 3, 'IMPUESTO'),
    (1005, 1, '1010501001', 'H', 1, 'SUBTOTAL'),
    (1005, 3, '5010101001', 'D', 3, 'SUBTOTAL'),
    (1006, 1, '1010102001', 'H', 1, 'TOTAL'),
    (1006, 2, '1010301001', 'D', 2, 'TOTAL'),
    (1007, 1, '1010102001', 'H', 1, 'TOTAL'),
    (1007, 2, '2010101001', 'D', 2, 'TOTAL'),
    (1007, 3, '2010101002', 'D', 3, 'TOTAL'),
    (1008, 1, '1010102001', 'D', 1, 'TOTAL'),
    (1008, 2, '1010201001', 'H', 2, 'TOTAL'),
    (1009, 1, '1010102001', 'D', 1, 'TOTAL'),
    (1009, 2, '1010201001', 'H', 2, 'TOTAL'),
    (1012, 1, '1010102001', 'H', 1, 'TOTAL'),
    (1012, 2, '2010101001', 'D', 2, 'TOTAL'),
    (1013, 1, '1010103001', 'H', 1, 'TOTAL'),
    (1013, 2, '2010101001', 'D', 2, 'TOTAL'),
    (1014, 1, '1010301001', 'H', 1, 'TOTAL'),
    (1014, 2, '1010103001', 'D', 2, 'TOTAL'),
    (1015, 1, '1010102001', 'D', 2, 'TOTAL'),
    (1015, 2, '1010201001', 'H', 1, 'OTRO'),
    (1016, 1, '1010101001', 'D', 1, 'TOTAL'),
    (1016, 2, '3010101001', 'H', 2, 'TOTAL'),
    (1019, 1, '1010401002', 'D', 1, 'TOTAL'),
    (1019, 2, '1010201001', 'H', 2, 'TOTAL'),
    (1020, 1, '2010101002', 'H', 1, 'TOTAL'),
    (1020, 2, '1010401001', 'D', 2, 'IMPUESTO'),
    (1020, 3, '6010103022', 'D', 3, 'SUBTOTAL'),
    (1020, 4, '6010103031', 'D', 4, 'OTRO'),
    (1020, 5, '6010105001', 'D', 5, 'OTRO'),
    (1021, 1, '2010101002', 'H', 1, 'TOTAL'),
    (1021, 2, '2010201001', 'D', 2, 'IMPUESTO'),
    (1021, 3, '6010103021', 'D', 3, 'SUBTOTAL'),
    (1023, 1, '6010106002', 'D', 1, 'SUBTOTAL'),
    (1023, 2, '1010401001', 'D', 2, 'IMPUESTO'),
    (1023, 3, '2010101002', 'H', 3, 'TOTAL'),
    (1023, 4, '2010202006', 'H', 4, 'RETENCIÓN'),
    (1025, 1, '1010102002', 'D', 1, 'TOTAL'),
    (1025, 2, '1010201001', 'H', 2, 'TOTAL'),
    (1026, 1, '1010103001', 'D', 1, 'TOTAL'),
    (1026, 2, '1010201001', 'H', 2, 'TOTAL'),
    (1027, 1, '1010102001', 'H', 1, 'TOTAL'),
    (1027, 2, '2010101002', 'D', 2, 'TOTAL'),
    (1028, 1, '1010102001', 'H', 1, 'TOTAL'),
    (1028, 2, '2010101002', 'D', 2, 'TOTAL'),
    (1029, 1, '1010102002', 'D', 1, 'TOTAL'),
    (1029, 2, '1010201001', 'H', 2, 'TOTAL'),
    (1030, 1, '1010102002', 'H', 1, 'TOTAL'),
    (1030, 2, '2010101001', 'D', 2, 'TOTAL'),
    (1031, 1, '1010102002', 'H', 1, 'TOTAL'),
    (1031, 2, '1010104001', 'D', 2, 'TOTAL'),
    (1032, 1, '1010102001', 'H', 1, 'TOTAL'),
    (1032, 2, '1010104001', 'D', 2, 'TOTAL'),
    (1033, 1, '1010103001', 'H', 1, 'TOTAL'),
    (1033, 2, '1010104001', 'D', 2, 'TOTAL'),
    (1034, 1, '1010102002', 'D', 1, 'TOTAL'),
    (1034, 2, '1010104001', 'H', 2, 'TOTAL'),
    (1035, 1, '1010102001', 'D', 1, 'TOTAL'),
    (1035, 2, '1010104001', 'H', 2, 'TOTAL'),
    (1036, 1, '1010103001', 'D', 1, 'TOTAL'),
    (1036, 2, '1010104001', 'H', 2, 'TOTAL'),
    (1037, 1, '6010101001', 'D', 1, 'TOTAL'),
    (1037, 2, '6010101003', 'D', 2, 'TOTAL'),
    (1037, 3, '6010102002', 'D', 3, 'TOTAL'),
    (1037, 4, '6010102003', 'D', 4, 'TOTAL'),
    (1037, 5, '6010102005', 'D', 5, 'TOTAL'),
    (1037, 6, '6010102006', 'D', 6, 'TOTAL'),
    (1037, 7, '1010303001', 'H', 7, 'TOTAL'),
    (1037, 8, '2010202004', 'H', 8, 'TOTAL'),
    (1037, 9, '2010301001', 'H', 9, 'TOTAL'),
    (1037, 10, '2010302001', 'H', 10, 'TOTAL'),
    (1037, 11, '2010302002', 'H', 11, 'TOTAL'),
    (1037, 12, '2010303001', 'H', 12, 'TOTAL'),
    (1037, 13, '2010303002', 'H', 13, 'TOTAL'),
    (1037, 14, '2010303003', 'H', 14, 'TOTAL'),
    (1038, 1, '1010102001', 'H', 1, 'TOTAL'),
    (1038, 2, '1010303001', 'D', 2, 'TOTAL'),
    (1039, 1, '1010102001', 'H', 1, 'TOTAL'),
    (1039, 2, '2010301001', 'D', 2, 'TOTAL'),
    (1040, 1, '1010102001', 'H', 1, 'TOTAL'),
    (1040, 2, '2010202004', 'D', 2, 'TOTAL'),
    (1041, 1, '1010102002', 'H', 1, 'TOTAL'),
    (1041, 2, '2010202004', 'D', 2, 'TOTAL'),
    (1042, 1, '2010101002', 'D', 1, 'TOTAL'),
    (1042, 2, '2010202006', 'H', 2, 'TOTAL'),
    (1043, 1, '6010103007', 'D', 1, 'SUBTOTAL'),
    (1043, 2, '1010401001', 'D', 2, 'IMPUESTO'),
    (1043, 3, '2010101002', 'H', 3, 'TOTAL'),
    (1043, 4, '2010202006', 'H', 4, 'RETENCIÓN'),
    (1044, 1, '6010103006', 'D', 1, 'TOTAL'),
    (1044, 2, '2010101002', 'H', 2, 'TOTAL'),
    (1045, 1, '1010102001', 'H', 1, 'TOTAL'),
    (1045, 2, '2010303003', 'D', 2, 'TOTAL'),
    (1045, 3, '2010303001', 'D', 3, 'TOTAL'),
    (1045, 4, '2010303002', 'D', 4, 'TOTAL'),
    (1046, 1, '1010102001', 'D', 1, 'TOTAL'),
    (1046, 2, '2010104001', 'H', 2, 'TOTAL');

  -- Las líneas ya cargadas por el script 38 (con su cuenta ligada) se conservan.
  insert into public.transaccion_cuentas (transaccion_id, linea, cuenta_codigo, naturaleza, orden, operacion)
  select x.id, l.linea, l.cuenta, l.naturaleza, l.orden, l.operacion
  from m_lineas l
  join public.transacciones_contables x on x.localidad_id = v_loc and x.numero = l.transaccion
  on conflict (transaccion_id, linea) do nothing;
  get diagnostics v_nuevas = row_count;

  select count(*) filter (where c.cuenta_id is not null), count(*) filter (where c.cuenta_id is null) into v_ligadas, v_pend
  from public.transaccion_cuentas c join public.transacciones_contables x on x.id = c.transaccion_id
  where x.localidad_id = v_loc and x.numero between 1001 and 1046;

  raise notice 'Mavisa 3-02: % líneas agregadas · % con su cuenta del catálogo · % con cuenta pendiente (el código no existe todavía en el catálogo de la localidad).', v_nuevas, v_ligadas, v_pend;
end;
$$;

notify pgrst, 'reload schema';
