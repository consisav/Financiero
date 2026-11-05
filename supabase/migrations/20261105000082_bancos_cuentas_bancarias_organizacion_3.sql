-- Bancos y cuentas bancarias de la organización 3 (Futura Farma - Mavisa), de dos archivos:
--   «6. CON_BANCOS.xls»: 20 bancos con el código del sistema anterior.
--   «6.1 CON_CUENTAS_BANCARIAS.xls»: 9 cuentas bancarias de las localidades 1, 2 y 3.
--   1. El código del banco es propio de cada localidad (script 81): en cada localidad de la
--      organización 3 los bancos quedan con el código y nombre del archivo. Si el código ya existe
--      se actualiza (nombre y costo de transferencia; las siglas se conservan solo si siguen
--      correspondiendo al nombre); si no, se crea. Los demás bancos de la localidad se conservan.
--   2. Una cuenta bancaria que ya existe (localidad + banco + número) se actualiza; si no, se crea.
--   3. Columnas nuevas de cuentas_bancarias (vienen en el archivo y no estaban en la base de datos):
--      cuenta_codigo (CUENTA: código de la cuenta contable), saldo_mensual, saldo_actual_anterior
--      (SALDO_ACTUAL del sistema anterior), moneda_local (S/N), version (versión del catálogo),
--      cuenta_contable, moneda_integracion, principal (S/N), autoriza_cheque, revisa_cheque,
--      anio_actual y mes_actual.
--   Equivalencias: MONEDA_INTEGRACION = código de la moneda (1 QUETZALES, 2 DÓLARES); ACTIVA vacía
--   = activa; cheque inicial/final 0 = sin chequera. Al número de cuenta se le quita el punto final
--   que traen las de la localidad 3 (p. ej. «3659016341.»), igual que en el script 80.
--   La cuenta contable se busca por su código en la versión del archivo o, si no trae, en la versión
--   activa más reciente del catálogo de la localidad; solo se liga si es una cuenta de movimiento
--   (las demás quedan con su código en cuenta_codigo y se informan).
--   Puede ejecutarse de nuevo: la segunda vez solo actualiza.
-- Se ejecuta después del script 81.

alter table public.cuentas_bancarias add column if not exists cuenta_codigo text;
alter table public.cuentas_bancarias add column if not exists saldo_mensual numeric(18,2);
alter table public.cuentas_bancarias add column if not exists saldo_actual_anterior numeric(18,2);
alter table public.cuentas_bancarias add column if not exists moneda_local boolean;
alter table public.cuentas_bancarias add column if not exists version integer;
alter table public.cuentas_bancarias add column if not exists cuenta_contable text;
alter table public.cuentas_bancarias add column if not exists moneda_integracion integer;
alter table public.cuentas_bancarias add column if not exists principal boolean;
alter table public.cuentas_bancarias add column if not exists autoriza_cheque text;
alter table public.cuentas_bancarias add column if not exists revisa_cheque text;
alter table public.cuentas_bancarias add column if not exists anio_actual integer;
alter table public.cuentas_bancarias add column if not exists mes_actual integer;

do $migra$
declare
  v_org bigint;
  v_loc bigint;
  v_banco bigint;
  v_moneda bigint;
  v_cuenta bigint;
  v_cb bigint;
  v_numero text;
  l record;
  r record;
  v_b_nuevos integer := 0;
  v_b_act integer := 0;
  v_c_nuevas integer := 0;
  v_c_act integer := 0;
  v_sin_cuenta text := '';
  v_omitidas text := '';
begin
  select id into v_org from public.organizaciones where codigo = 3;
  if v_org is null then raise exception 'No existe la organización 3.'; end if;

  drop table if exists m_bancos;
  create temp table m_bancos (codigo integer, nombre text, costo numeric) on commit drop;
  insert into m_bancos (codigo, nombre, costo) values
      (1, 'BANRURAL', null),
      (2, 'INTERBANCO', null),
      (3, 'G & T CONTINENTAL', null),
      (4, 'BANTRAB', null),
      (5, 'BANEX, S.A.', null),
      (6, 'BAM', null),
      (7, 'REFORMADOR', null),
      (8, 'INTERNACIONAL', null),
      (9, 'BANQUETZAL', null),
      (10, 'OCCIDENTAL', null),
      (11, 'COMERCIO', null),
      (12, 'INMOBILIARIO', null),
      (13, 'CREDITO HIPOTECARIO', null),
      (14, 'CORPOBANCO', null),
      (15, 'LA REPUBLICA', null),
      (16, 'BANCO UNO (CITI)', null),
      (17, 'BANCA SOL', null),
      (18, 'BAC', null),
      (19, 'EFECTIVO', null),
      (20, 'INDUSTRIAL', null)
  ;

  -- ---------- Bancos: el mismo juego del archivo en cada localidad de la organización 3 ----------
  for l in select id from public.localidades where organizacion_id = v_org order by correlativo loop
    -- Nombre provisional a los bancos que se van a actualizar, para que el cambio de nombres entre
    -- códigos no choque con el nombre único por localidad.
    update public.bancos b set nombre = '~' || b.id
    where b.localidad_id = l.id and exists (select 1 from m_bancos m where m.codigo = b.codigo);
    for r in select * from m_bancos order by codigo loop
      select id into v_banco from public.bancos where localidad_id = l.id and codigo = r.codigo;
      if v_banco is not null then
        update public.bancos set nombre = r.nombre, costo_transferencia = r.costo,
          siglas = case when siglas is not null and position(upper(siglas) in upper(r.nombre)) > 0 then siglas end
        where id = v_banco;
        v_b_act := v_b_act + 1;
      else
        insert into public.bancos (codigo, nombre, costo_transferencia, activo, localidad_id)
        values (r.codigo, r.nombre, r.costo, true, l.id);
        v_b_nuevos := v_b_nuevos + 1;
      end if;
    end loop;
  end loop;

  -- ---------- Cuentas bancarias ----------
  for r in
    select localidad::integer as localidad, banco::integer as banco, numero::text as numero, nombre::text as nombre, cuenta::text as cuenta,
           saldo_mensual::numeric as saldo_mensual, saldo_actual::numeric as saldo_actual, cheque_inicial::integer as cheque_inicial,
           cheque_final::integer as cheque_final, reporte::text as reporte, saldo_minimo::numeric as saldo_minimo,
           minimo_cheques::integer as minimo_cheques, moneda_local::text as moneda_local, version::integer as version,
           cuenta_contable::text as cuenta_contable, moneda_integracion::integer as moneda_integracion, principal::text as principal,
           autoriza_cheque::text as autoriza_cheque, revisa_cheque::text as revisa_cheque, activa::text as activa,
           saldo_inicial::numeric as saldo_inicial, anio_actual::integer as anio_actual, mes_actual::integer as mes_actual
    from (values
      (1, 1, '3659016341', 'FUTURA FARMA S.A. BANRURAL', '1010102001', null, null, 2328, 2640, 'RO_CHEBRVOU', 0, 10, 'S', null, null, 1, 'S', 'GG', 'AEV', null, null, null, null),
      (1, 20, '206-134190-1', 'FUTURA FARMA, S.A. BI USD $', '1010103002', null, null, 0, 0, 'RO_CHEBIVOU', 0, 1, 'N', null, null, 2, 'N', null, null, null, null, null, null),
      (1, 20, '007-024094-0', 'FUTURA FARMA, S. A. BI', '1010102002', null, null, 308, 365, 'RO_CHEBIVOU', 0, 10, 'S', null, null, 1, 'N', 'GG', 'AEV', null, null, null, null),
      (2, 1, '3235100377', 'MAVISA PHARMACEUTICALS Q', '1010103001', null, null, 1, 15, null, 0, 5, 'S', null, null, 1, 'N', null, null, null, null, null, null),
      (2, 20, '206-131947-7', 'MAVISA PHARMACEUTICALS Q', '5010103003', null, null, 116, 165, 'RO_CHEBIVOU', 0, 10, 'S', null, null, 1, 'S', 'GG', 'AEV', null, null, null, null),
      (2, 20, '206-134189-3', 'MAVISA PHARMACEUTICALS $', '2', null, null, null, null, null, 0, null, 'S', null, null, 2, 'N', null, null, null, null, null, null),
      (3, 1, '3659016341.', 'FUTURA FARMA S.A. BANRURAL', '1010102001', null, null, 2328, 2640, 'RO_CHEBRVOU', 0, 10, 'S', null, null, 1, 'S', 'GG', 'AEV', null, null, null, null),
      (3, 20, '007-024094-0.', 'FUTURA FARMA, S. A. BI', '1010102002', null, null, 308, 365, 'RO_CHEBIVOU', 0, 10, 'S', null, null, 1, 'N', 'GG', 'AEV', null, null, null, null),
      (3, 20, '206-134190-1.', 'FUTURA FARMA, S.A. BI USD $', '1010103002', null, null, 0, 0, 'RO_CHEBIVOU', 0, 1, 'S', null, null, 2, 'N', null, null, null, null, null, null)
    ) as x (localidad, banco, numero, nombre, cuenta, saldo_mensual, saldo_actual, cheque_inicial, cheque_final, reporte,
            saldo_minimo, minimo_cheques, moneda_local, version, cuenta_contable, moneda_integracion, principal,
            autoriza_cheque, revisa_cheque, activa, saldo_inicial, anio_actual, mes_actual)
    order by localidad, banco, numero
  loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.localidad;
    if v_loc is null then
      if position(format('3-%s', lpad(r.localidad::text, 2, '0')) in v_omitidas) = 0 then v_omitidas := v_omitidas || format(' 3-%s', lpad(r.localidad::text, 2, '0')); end if;
      continue;
    end if;
    select id into v_banco from public.bancos where localidad_id = v_loc and codigo = r.banco;
    v_numero := regexp_replace(trim(r.numero), '\.+$', '');
    select id into v_moneda from public.monedas where codigo = coalesce(r.moneda_integracion, 1);
    if v_moneda is null then select id into v_moneda from public.monedas where iso = 'GTQ'; end if;
    -- Cuenta contable de movimiento (sin cuentas hijas y vigente) en la versión que corresponda.
    select c.id into v_cuenta
    from public.cuentas c join public.catalogos_cuentas k on k.id = c.catalogo_id
    where k.localidad_id = v_loc and c.codigo = r.cuenta and c.vigente
      and not exists (select 1 from public.cuentas h where h.cuenta_mayor_id = c.id)
      and (k.version = r.version or (r.version is null and k.activo))
    order by k.version desc limit 1;
    if v_cuenta is null and r.cuenta is not null then
      v_sin_cuenta := v_sin_cuenta || format(' 3-%s %s cuenta %s;', lpad(r.localidad::text, 2, '0'), v_numero, r.cuenta);
    end if;
    select id into v_cb from public.cuentas_bancarias where localidad_id = v_loc and banco_id = v_banco and numero = v_numero;
    if v_cb is not null then
      update public.cuentas_bancarias set
        nombre = r.nombre, moneda_id = v_moneda, saldo_minimo = coalesce(r.saldo_minimo, 0),
        cheque_inicial = nullif(r.cheque_inicial, 0), cheque_final = nullif(r.cheque_final, 0),
        minimo_cheques = coalesce(r.minimo_cheques, 0), reporte = r.reporte, cuenta_id = v_cuenta,
        activo = coalesce(r.activa, 'S') <> 'N',
        saldo_inicial = coalesce(r.saldo_inicial, saldo_inicial),
        cuenta_codigo = r.cuenta, saldo_mensual = r.saldo_mensual, saldo_actual_anterior = r.saldo_actual,
        moneda_local = case r.moneda_local when 'S' then true when 'N' then false end,
        version = r.version, cuenta_contable = r.cuenta_contable, moneda_integracion = r.moneda_integracion,
        principal = case r.principal when 'S' then true when 'N' then false end,
        autoriza_cheque = r.autoriza_cheque, revisa_cheque = r.revisa_cheque,
        anio_actual = r.anio_actual, mes_actual = r.mes_actual
      where id = v_cb;
      v_c_act := v_c_act + 1;
    else
      insert into public.cuentas_bancarias (organizacion_id, localidad_id, banco_id, numero, nombre, moneda_id, saldo_minimo,
             saldo_inicial, cheque_inicial, cheque_final, minimo_cheques, reporte, cuenta_id, activo,
             cuenta_codigo, saldo_mensual, saldo_actual_anterior, moneda_local, version, cuenta_contable,
             moneda_integracion, principal, autoriza_cheque, revisa_cheque, anio_actual, mes_actual)
      values (v_org, v_loc, v_banco, v_numero, r.nombre, v_moneda, coalesce(r.saldo_minimo, 0),
              coalesce(r.saldo_inicial, 0), nullif(r.cheque_inicial, 0), nullif(r.cheque_final, 0), coalesce(r.minimo_cheques, 0),
              r.reporte, v_cuenta, coalesce(r.activa, 'S') <> 'N',
              r.cuenta, r.saldo_mensual, r.saldo_actual, case r.moneda_local when 'S' then true when 'N' then false end,
              r.version, r.cuenta_contable, r.moneda_integracion, case r.principal when 'S' then true when 'N' then false end,
              r.autoriza_cheque, r.revisa_cheque, r.anio_actual, r.mes_actual);
      v_c_nuevas := v_c_nuevas + 1;
    end if;
  end loop;

  raise notice '%', format('Organización 3 · bancos: %s nuevos, %s actualizados; cuentas bancarias: %s nuevas, %s actualizadas.%s%s',
    v_b_nuevos, v_b_act, v_c_nuevas, v_c_act,
    case when v_sin_cuenta <> '' then ' Sin cuenta contable de movimiento (quedan con su código):' || v_sin_cuenta else '' end,
    case when v_omitidas <> '' then ' Localidades que no existen (omitidas):' || v_omitidas else '' end);
end;
$migra$;

notify pgrst, 'reload schema';
