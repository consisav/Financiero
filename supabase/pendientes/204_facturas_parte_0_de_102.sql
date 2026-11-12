-- Script 204 · parte 0 de 102 · Organización 2: columnas nuevas de las facturas de venta (CAR_FACTURAS.xls). Se ejecuta UNA vez, antes de las partes 1 a 102.
--   No contiene datos de clientes. Solo agrega las columnas que falten (si ya existen, no bloquea la tabla).
set lock_timeout = '20s';
do $col$
declare r record; v_n int := 0;
begin
  for r in select * from (values
    ('factura_anterior', 'integer'),
    ('serie_fisica_anterior', 'text'),
    ('factura_fisica_anterior', 'text'),
    ('fecha_anterior', 'date'),
    ('id_anterior', 'integer'),
    ('no_interno_anterior', 'text'),
    ('moneda_anterior', 'integer'),
    ('estado_anterior', 'text'),
    ('total_anterior', 'numeric(18, 2)'),
    ('bodega_anterior', 'integer'),
    ('persona_anterior', 'text'),
    ('tipo_documento_anterior', 'text'),
    ('tipo_factura_anterior', 'text'),
    ('forma_pago_anterior', 'integer'),
    ('clasificacion_anterior', 'integer'),
    ('clasificacion_doc_anterior', 'text'),
    ('dias_credito_anterior', 'integer'),
    ('transaccion_anterior', 'integer'),
    ('usuario_ingresa_anterior', 'text'),
    ('fecha_ingresa_anterior', 'timestamp'),
    ('usuario_modifica_anterior', 'text'),
    ('fecha_modifica_anterior', 'timestamp'),
    ('codigo_documento_anterior', 'integer'),
    ('origen_anterior', 'text'),
    ('nombre_cliente_anterior', 'text'),
    ('nit_anterior', 'text'),
    ('pct_iva_anterior', 'numeric(6, 2)'),
    ('tipo_transaccion_anterior', 'integer'),
    ('tipo_cliente_anterior', 'text'),
    ('poliza_anio', 'integer'),
    ('poliza_mes', 'integer'),
    ('poliza_numero', 'integer'),
    ('no_contrato_general_anterior', 'text'),
    ('total_copago', 'numeric(18, 2)'),
    ('agente_retenedor_anterior', 'text'),
    ('pct_retencion_anterior', 'numeric(6, 2)'),
    ('valor_retencion_anterior', 'numeric(18, 2)'),
    ('exento_iva_anterior', 'text'),
    ('pago_efectivo', 'numeric(18, 2)'),
    ('pago_tarjeta', 'numeric(18, 2)'),
    ('pago_cheque', 'numeric(18, 2)'),
    ('pago_transferencia', 'numeric(18, 2)'),
    ('clasificacion_venta_anterior', 'integer'),
    ('orden_anterior', 'integer'),
    ('valor_cambio_anterior', 'numeric(18, 8)'),
    ('total_mi_anterior', 'numeric(18, 2)'),
    ('fecha_estimada_pago_anterior', 'date'),
    ('descuento_orden', 'numeric(18, 2)'),
    ('expediente_anterior', 'text'),
    ('corte_caja_anterior', 'text'),
    ('serie_electronica_anterior', 'text'),
    ('numero_dte_anterior', 'text'),
    ('fecha_emision_anterior', 'timestamp'),
    ('fecha_certificacion_anterior', 'timestamp'),
    ('tipo_documento_electronico_anterior', 'text'),
    ('usuario_anula_anterior', 'text'),
    ('fecha_anula_anterior', 'timestamp'),
    ('factura_especial_anterior', 'text'),
    ('zona_anterior', 'integer'),
    ('transaccion_inv_anterior', 'integer'),
    ('revisada_migracion_anterior', 'text'),
    ('revisada_anterior', 'text'),
    ('validada_fe_anterior', 'text'),
    ('registrada_fe_anterior', 'text'),
    ('anulada_fe_anterior', 'text'),
    ('emisor_tarjeta_anterior', 'text')
  ) as x(col, tipo) loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'facturas_venta' and column_name = r.col) then
      execute format('alter table public.facturas_venta add column %I %s', r.col, r.tipo);
      v_n := v_n + 1;
    end if;
  end loop;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'facturas_venta_factura_anterior') then
    create unique index facturas_venta_factura_anterior on public.facturas_venta (localidad_id, factura_anterior) where factura_anterior is not null;
  end if;
  raise notice '%', format('Facturas de venta: %s columnas nuevas (las demás ya existían).', v_n);
end;
$col$;
analyze public.facturas_venta;
notify pgrst, 'reload schema';
