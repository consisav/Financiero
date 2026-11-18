-- Script 235 · Notas de crédito y débito de la organización 3 del 05-11-2026 al 17-11-2026 (misma lógica del script 112).
--   Este lote no trae CON_DETCON_NOTAS: el detalle contable de las notas no viene en los archivos.
-- Notas de crédito y débito de la organización 3 (Futura Farma - Mavisa) y su detalle contable, de los archivos
-- «CON_NOTAS_CREDITO_DEBITO.xls» (5 notas: 0 de crédito y 5 de débito; 5 de la 3-02) y «CON_DETCON_NOTAS.xls»
-- (0 líneas: ).
--   1. Una nota se identifica por su cuenta bancaria, su tipo (C = crédito, D = débito) y su número interno NOTA. Si ya
--      existe NO se crea: se actualiza. Igual las líneas del detalle (misma nota y número de línea).
--   2. Columnas nuevas (vienen con datos en el archivo y no estaban en la base de datos), en movimientos_bancarios:
--        nota_anterior: NOTA (número interno del sistema anterior: liga el detalle contable)
--        uso_nota: USO_NOTA
--        cliente_codigo_anterior: CLIENTE
--        recibo_anterior: RECIBO (recibo físico)
--        fecha_anterior: FECHA con su hora, tal como venía
--      Las demás columnas con datos usan las que ya existen (las del script 108 de cheques incluidas): NOTA_FISICA = número
--      de nota; PROCESADA, CONCILIADO, MONEDA_INTEGRACION, VALOR_CAMBIO, VALOR_MI, TRANSACCION, PROVEEDOR, VALOR y
--      CUENTA_BANCARIA tal como venían; CAJA_CHICA y CLIENTES_VARIOS (S/N); USUARIO y FECHA_OPERACION.
--      Columnas vacías en todas las filas (no se agregan): CUENTA, FECHA_CONCILIACION, MI_VALOR, TIPO_TRANSACCION, AÑO_POLIZA, MES_POLIZA, POLIZA, CIERRE, RUBRO_FE, AÑO_DESEMBOLSO, DESEMBOLSO, AÑO_FL, MES_FL, SEMANA, TIPO_RUBRO, RUBRO, SEMANA_RUBRO, AÑO_RUBRO, LINEA, CLIENTE, RECIBO; del detalle: ninguna.
--   Equivalencias: VALOR viene en quetzales: las notas en dólares (MONEDA_INTEGRACION 2) van en US$ (VALOR_MI) con su
--   valor de cambio; las demás en quetzales (cambio 1). CONCILIADO C = conciliada. Cliente o proveedor se ligan por su
--   código en la localidad (si el cliente aún no está migrado queda su código); la transacción por su número (la 0 =
--   sin transacción) y de ella sale el tipo de operación. El RECIBO se registra como recibo físico de la nota.
--   La cuenta bancaria se liga por su número en la localidad (sin el punto final que traen las de 3-03). Las cuentas
--   del detalle se buscan en la versión indicada (VERSION = 1) del catálogo de la localidad y, si ahí no existen, en su
--   otra versión activa. Una nota migrada puede tener valor 0 (la nota 2907 de débito viene así).
--   0 fechas venían con el año en dos cifras (): se toman del año 2000 en adelante.
--   Folio: las notas nuevas reciben el siguiente folio de su localidad y tipo (por fecha); las existentes conservan el suyo.
--   Puede ejecutarse de nuevo: la segunda vez solo actualiza.
-- Se ejecuta después del script 108.

alter table public.movimientos_bancarios add column if not exists nota_anterior integer;
alter table public.movimientos_bancarios add column if not exists uso_nota text;
alter table public.movimientos_bancarios add column if not exists cliente_codigo_anterior integer;
alter table public.movimientos_bancarios add column if not exists recibo_anterior text;
alter table public.movimientos_bancarios add column if not exists fecha_anterior timestamp;
alter table public.movimientos_bancarios add column if not exists origen_anterior text;
alter table public.movimientos_bancarios add column if not exists proveedor_codigo_anterior integer;
alter table public.movimientos_bancarios add column if not exists procesado boolean;
alter table public.movimientos_bancarios add column if not exists tipo_anterior text;
alter table public.movimientos_bancarios add column if not exists conciliado_anterior text;
alter table public.movimientos_bancarios add column if not exists moneda_integracion integer;
alter table public.movimientos_bancarios add column if not exists valor_cambio_anterior numeric(18, 6);
alter table public.movimientos_bancarios add column if not exists transaccion_anterior integer;
alter table public.movimientos_bancarios add column if not exists valor_mi numeric(18, 2);
alter table public.movimientos_bancarios add column if not exists valor_anterior numeric(18, 2);
alter table public.movimientos_bancarios add column if not exists cuenta_bancaria_anterior text;
alter table public.movimiento_lineas add column if not exists debe_mi numeric(18, 2);
alter table public.movimiento_lineas add column if not exists haber_mi numeric(18, 2);
alter table public.movimiento_lineas add column if not exists cuenta_codigo_anterior text;
alter table public.movimiento_lineas add column if not exists version_cuenta_anterior integer;
alter table public.movimiento_lineas add column if not exists tipo_int_centro text;
create index if not exists movimientos_bancarios_nota_anterior on public.movimientos_bancarios (cuenta_bancaria_id, tipo, nota_anterior) where nota_anterior is not null;
alter table public.movimientos_bancarios drop constraint if exists movimientos_bancarios_valor_check;
alter table public.movimientos_bancarios add constraint movimientos_bancarios_valor_check
  check (valor > 0 or (valor >= 0 and (estado = 'ANULADO' or origen_anterior = 'MIGRADO')));

do $migra$
declare
  v_org bigint; v_gtq bigint; v_usd bigint;
  r record; v_loc bigint; v_cb record; v_id bigint; v_folio integer; v_nom text; v_tr_id bigint; v_tr_op text; v_cta bigint; v_nuevo boolean;
  v_faltan text[] := '{}';
  c_n int := 0; c_a int := 0; c_s int := 0; l_n int := 0; l_a int := 0; l_s int := 0; l_c int := 0; d_n int := 0;
begin
  select id into v_org from public.organizaciones where codigo = '3';
  if v_org is null then raise notice 'No existe la organización 3.'; return; end if;
  select id into v_gtq from public.monedas where iso = 'GTQ';
  select id into v_usd from public.monedas where iso = 'USD';
  -- La carga trae fecha, usuario, estado y conciliación del sistema anterior: se suspenden los automatismos de la pantalla.
  alter table public.movimientos_bancarios disable trigger movimientos_bancarios_preparar;
  alter table public.movimiento_lineas disable trigger movimiento_lineas_validar;

  for r in select * from (values
    (2, '206-131947-7', 'NOTA_DEBITO', 3052, '27478541', '2026-11-02', 51528, 'GTQ', 1, 'CANCELACIÓN FACTURA NO. 848644167', 'AEV', '2026-11-06 13:57:01', true, 'I', null, 1, 1, 'N', 1012, 51528, 1897, false, null, null, false, 51528, '206-131947-7', 'D', '2026-11-02 00:00:00'),
    (2, '206-131947-7', 'NOTA_DEBITO', 3053, '27500184', '2026-11-03', 74394.5, 'GTQ', 1, 'CANCELACIÓN FACTURA NO. 2497529586', 'AEV', '2026-11-06 14:10:30', true, 'I', null, 1, 1, 'N', 1012, 74394.5, 1897, false, null, null, false, 74394.5, '206-131947-7', 'D', '2026-11-03 00:00:00'),
    (2, '206-131947-7', 'NOTA_DEBITO', 3054, '27572261', '2026-11-06', 57370.5, 'GTQ', 1, 'CANCELACIÓN FACTURA NO. 2281521372', 'AEV', '2026-11-06 16:18:58', true, 'I', null, 1, 1, 'N', 1012, 57370.5, 1897, false, null, null, false, 57370.5, '206-131947-7', 'D', '2026-11-06 00:00:00'),
    (2, '206-131947-7', 'NOTA_DEBITO', 3055, '27609328', '2026-11-09', 8787.5, 'GTQ', 1, 'CANCELACIÓN FACTURA NO. 4108534719', 'AEV', '2026-11-13 12:32:59', true, 'I', null, 1, 1, 'N', 1012, 8787.5, 1897, false, null, null, false, 8787.5, '206-131947-7', 'D', '2026-11-09 00:00:00'),
    (2, '206-131947-7', 'NOTA_DEBITO', 3056, '27609295', '2026-11-09', 33961.8, 'GTQ', 1, 'CANCELACIÓN FACTURA NO.. 4291251179', 'AEV', '2026-11-13 16:17:10', true, 'I', null, 1, 1, 'N', 1012, 33961.8, 1897, false, null, null, false, 33961.8, '206-131947-7', 'D', '2026-11-09 00:00:00')) as x(loc, cuenta, tipo, nota, fisica, fecha, valor, moneda, cambio, descripcion, usuario, f_oper, procesada, conciliado, f_concilia,
      moneda_int, cambio_ant, uso, transaccion, valor_mi, proveedor, varios, cliente, recibo, caja_chica, valor_ant, cuenta_ant, tipo_ant, fecha_ant)
    order by loc, fecha, nota loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    select cb.id, cb.moneda_id into v_cb from public.cuentas_bancarias cb where cb.localidad_id = v_loc and cb.numero = r.cuenta;
    if v_cb.id is null then c_s := c_s + 1; raise notice 'Nota % (3-0%): no existe la cuenta bancaria %.', r.nota, r.loc, r.cuenta; continue; end if;
    v_id := null;
    select id into v_id from public.movimientos_bancarios where cuenta_bancaria_id = v_cb.id and tipo = r.tipo and nota_anterior = r.nota;
    v_nom := case when r.proveedor is not null then (select nombre_comercial from public.proveedores where localidad_id = v_loc and codigo = r.proveedor::integer)
                  when r.cliente is not null then (select coalesce(nombre, razon_social) from public.clientes where localidad_id = v_loc and codigo::text = r.cliente::text limit 1) end;
    v_tr_id := null; v_tr_op := null;
    select id, tipo_operacion into v_tr_id, v_tr_op from public.transacciones_contables where localidad_id = v_loc and numero = r.transaccion::integer and r.transaccion::integer <> 0;
    if v_id is null then
      select coalesce(max(folio), 0) + 1 into v_folio from public.movimientos_bancarios where localidad_id = v_loc and tipo = r.tipo;
      insert into public.movimientos_bancarios (organizacion_id, localidad_id, cuenta_bancaria_id, tipo, folio, numero_documento, fecha, moneda_id, tipo_cambio,
        valor, valor_ml, valor_cuenta, estado, usuario, fecha_operacion, nota_anterior, origen_anterior)
      values (v_org, v_loc, v_cb.id, r.tipo, v_folio, coalesce(r.fisica::text, r.nota::text), r.fecha::date, v_gtq, 1, r.valor, r.valor, r.valor, 'ACTIVO',
        coalesce(upper(r.usuario::text), 'SISTEMA ANTERIOR'), coalesce(r.f_oper::timestamp, r.fecha::timestamp)::timestamptz, r.nota, 'MIGRADO')
      returning id into v_id;
      c_n := c_n + 1;
    else
      c_a := c_a + 1;
    end if;
    update public.movimientos_bancarios set numero_documento = coalesce(r.fisica::text, r.nota::text), fecha = r.fecha::date,
      moneda_id = case when r.moneda = 'USD' then v_usd else v_gtq end, tipo_cambio = r.cambio, valor = r.valor, valor_ml = round(r.valor * r.cambio, 2),
      valor_cuenta = case when (case when r.moneda = 'USD' then v_usd else v_gtq end) = v_cb.moneda_id then r.valor else round(r.valor * r.cambio, 2) end,
      descripcion = nullif(trim(r.descripcion::text), ''),
      tipo_tercero = case when r.proveedor is not null then 'PROVEEDOR PRODUCTOS' when coalesce(r.varios::boolean, false) then 'CLIENTES VARIOS' when r.cliente is not null then 'CLIENTE' end,
      tercero_codigo = coalesce(r.proveedor::text, r.cliente::text), tercero_nombre = v_nom,
      transaccion_id = coalesce(v_tr_id, transaccion_id), tipo_operacion = coalesce(v_tr_op, tipo_operacion),
      conciliado = upper(coalesce(r.conciliado::text, '')) = 'C', fecha_conciliado = r.f_concilia::date,
      caja_chica = coalesce(r.caja_chica::boolean, false), clientes_varios = coalesce(r.varios::boolean, false),
      origen_anterior = 'MIGRADO', nota_anterior = r.nota, procesado = r.procesada::boolean, conciliado_anterior = r.conciliado::text,
      moneda_integracion = r.moneda_int::integer, valor_cambio_anterior = r.cambio_ant::numeric, uso_nota = r.uso::text, transaccion_anterior = r.transaccion::integer,
      valor_mi = r.valor_mi::numeric, proveedor_codigo_anterior = r.proveedor::integer, cliente_codigo_anterior = r.cliente::integer, recibo_anterior = r.recibo::text,
      valor_anterior = r.valor_ant::numeric, cuenta_bancaria_anterior = r.cuenta_ant::text, tipo_anterior = r.tipo_ant::text, fecha_anterior = r.fecha_ant::timestamp
    where id = v_id;
    -- Recibo físico del cliente (pestaña «Recibos físicos»): uno por nota, por el valor de la nota.
    if r.recibo is not null then
      delete from public.movimiento_documentos where movimiento_id = v_id and tipo = 'RECIBO';
      insert into public.movimiento_documentos (movimiento_id, tipo, numero, tercero, nombre, valor, valor_ml, fecha, estado)
      values (v_id, 'RECIBO', r.recibo::text, r.cliente::text, v_nom, r.valor, round(r.valor * r.cambio, 2), r.fecha::date, 'ACTIVO');
      d_n := d_n + 1;
    end if;
  end loop;

  alter table public.movimientos_bancarios enable trigger movimientos_bancarios_preparar;
  alter table public.movimiento_lineas enable trigger movimiento_lineas_validar;

  raise notice '%', format('Notas: %s nuevas, %s actualizadas, %s sin cuenta bancaria; %s recibos físicos. Detalle contable: %s líneas nuevas, %s actualizadas, %s sin nota, %s sin cuenta.',
    c_n, c_a, c_s, d_n, l_n, l_a, l_s, l_c);
  if l_c > 0 then raise notice 'Cuentas que no existen en el catálogo de la localidad (líneas omitidas): %.', (select string_agg(distinct x, ', ') from unnest(v_faltan) x); end if;
end;
$migra$;

notify pgrst, 'reload schema';
