-- Compras de la organización 3 · abonos desde los documentos de liquidación del sistema anterior
-- («ACT_DOCTOS_LIQUIDA.xls», ya migrado en el script 92: 741 documentos de 654 compras).
--   Hasta ahora eran solo historial; con este script alimentan la pestaña «Abonos» de Ingreso de compras, el
--   saldo (compras_saldo) y los reportes de cuentas por pagar (compra_abonos).
--   1. No se crean documentos nuevos: se actualizan los existentes. Puede ejecutarse de nuevo.
--   2. Columnas nuevas en compra_liquidaciones:
--      abono: el valor del documento en la moneda de la compra. En compras en quetzales es VALOR_LIQUIDADO;
--        en compras en dólares es VALOR_LIQUIDADO_MI (en esas compras VALOR_LIQUIDADO viene en quetzales);
--        si el documento no trae VALOR_LIQUIDADO_MI, su VALOR_LIQUIDADO ya está en dólares.
--      abono_aplicado: lo que se aplica al saldo, por orden de documento, sin pasar del neto de la compra
--        (menos lo ya pagado en el sistema). excedente: lo que pasaba del neto (el sistema anterior tiene
--        compras liquidadas de más, con documentos repetidos): queda registrado y no se aplica.
--      aplica_saldo: si el documento cuenta en el saldo (sí por omisión). Al migrar los cheques y notas a Caja
--        y Bancos y ligarlos a las compras, se pone en «no» para no contar dos veces el mismo pago.
-- Se ejecuta después del script 106.

alter table public.compra_liquidaciones add column if not exists abono numeric(18, 2);
alter table public.compra_liquidaciones add column if not exists abono_aplicado numeric(18, 2);
alter table public.compra_liquidaciones add column if not exists excedente numeric(18, 2);
alter table public.compra_liquidaciones add column if not exists aplica_saldo boolean not null default true;

create or replace view public.compra_abonos with (security_invoker = true) as
SELECT d.compra_id,
    m.fecha,
    d.abono_compra AS valor,
        CASE
            WHEN m.tipo = 'CHEQUE'::text THEN 'CHEQUE'::text
            ELSE 'TRANSFERENCIA'::text
        END AS origen,
    COALESCE(m.numero_documento, m.folio::text) AS documento,
    m.id AS movimiento_id,
    NULL::bigint AS regularizacion_id,
    NULL::bigint AS liquidacion_id
   FROM public.movimiento_documentos d
     JOIN public.movimientos_bancarios m ON m.id = d.movimiento_id AND m.estado = 'ACTIVO'::text
  WHERE d.compra_id IS NOT NULL AND d.abono_compra > 0::numeric
UNION ALL
 SELECT rd.compra_id,
    r.fecha_final AS fecha,
    rd.valor,
    'ANTICIPO'::text AS origen,
    'REG. '::text || r.numero AS documento,
    NULL::bigint AS movimiento_id,
    r.id AS regularizacion_id,
    NULL::bigint AS liquidacion_id
   FROM public.regularizacion_documentos rd
     JOIN public.regularizaciones_anticipo r ON r.id = rd.regularizacion_id AND r.estado = 'OPERADA'::text
UNION ALL
 SELECT lq.compra_id,
    lq.fecha::date AS fecha,
    lq.abono_aplicado AS valor,
    'LIQUIDACIÓN ANTERIOR'::text AS origen,
    COALESCE('CH '::text || lq.numero_cheque, 'NOTA '::text || lq.nota::text, 'DOCTO. '::text || lq.documento::text) AS documento,
    NULL::bigint AS movimiento_id,
    NULL::bigint AS regularizacion_id,
    lq.id AS liquidacion_id
   FROM public.compra_liquidaciones lq
  WHERE lq.aplica_saldo AND lq.abono_aplicado > 0::numeric;
grant select on public.compra_abonos to authenticated;

create or replace view public.compras_saldo with (security_invoker = true) as
SELECT c.id,
    c.organizacion_id,
    c.localidad_id,
    c.numero,
    c.tipo_documento,
    c.serie,
    c.documento,
    c.fecha_documento,
    c.fecha_ingreso,
    c.fecha_vencimiento,
    c.tipo_tercero,
    c.proveedor_codigo,
    c.proveedor_nombre,
    c.nit,
    c.beneficiario,
    c.transaccion_id,
    c.descripcion,
    c.moneda_id,
    c.tipo_cambio,
    c.valor_total,
    c.bonificaciones,
    c.notas_credito,
    c.descuentos_nd,
    c.forma_pago,
    c.cuenta_bancaria_id,
    c.banco_destino_id,
    c.cuenta_destino,
    c.cuenta_pagar_id,
    c.estado,
    c.anulado_por,
    c.anulado_en,
    c.motivo_anulacion,
    c.partida_id,
    c.usuario,
    c.creado_por,
    c.creado_por_nombre,
    c.creado_en,
    c.modificado_por,
    c.modificado_por_nombre,
    c.modificado_en,
    c.proveedor_id,
    c.tipo_dte,
    c.mes_presentacion,
    c.anio_presentacion,
    c.pago_inmediato,
    c.dias_credito,
    c.contrasena,
    c.contrasena_fecha,
    c.factura_original,
    c.regimen_isr_id,
    c.clasificacion,
    c.tipo_operacion,
    c.rubro_id,
    c.bodega_id,
    c.galones_super,
    c.galones_regular,
    c.galones_diesel,
    c.idp,
    c.exento,
    c.no_deducible,
    c.iva_especial,
    c.isr_especial,
    c.aplica_inguat,
    c.inguat,
    c.turismo_itp,
    c.iva_importacion,
    c.dai,
    c.valor_cuenta_ajena,
    c.retencion,
    c.retencion_formulario,
    c.retencion_valor,
    c.retencion_fecha,
    c.iva,
    c.base,
    c.compra_inventario,
    c.orden_compra,
    c.tipo_documento_id,
    c.clasificacion_id,
    c.contrasena_id,
    c.valor_total - c.bonificaciones - c.notas_credito - c.descuentos_nd - COALESCE(n.ajuste, 0::numeric) AS neto,
    COALESCE(p.pagado, 0::numeric) AS pagado,
    c.valor_total - c.bonificaciones - c.notas_credito - c.descuentos_nd - COALESCE(n.ajuste, 0::numeric) - COALESCE(p.pagado, 0::numeric) AS pendiente,
    COALESCE(p.pagos, 0::bigint) AS pagos,
    p.ultimo_pago
   FROM public.compras c
     LEFT JOIN LATERAL ( SELECT sum(x.valor) AS pagado,
            count(*) AS pagos,
            string_agg(x.txt, ', '::text ORDER BY x.fecha, x.orden) AS ultimo_pago
           FROM ( SELECT d.abono_compra AS valor,
                    m.fecha,
                    m.id AS orden,
                        CASE
                            WHEN m.tipo = 'CHEQUE'::text THEN 'CH '::text
                            ELSE 'TRF '::text
                        END || COALESCE(m.numero_documento, m.folio::text) AS txt
                   FROM public.movimiento_documentos d
                     JOIN public.movimientos_bancarios m ON m.id = d.movimiento_id AND m.estado = 'ACTIVO'::text
                  WHERE d.compra_id = c.id
                UNION ALL
                 SELECT rd.valor,
                    r.fecha_final,
                    r.id,
                    'ANT '::text || r.numero
                   FROM public.regularizacion_documentos rd
                     JOIN public.regularizaciones_anticipo r ON r.id = rd.regularizacion_id AND r.estado = 'OPERADA'::text
                  WHERE rd.compra_id = c.id
                UNION ALL
                 SELECT lq.abono_aplicado,
                    lq.fecha::date AS fecha,
                    lq.id,
                    'LIQ '::text || COALESCE('CH '::text || lq.numero_cheque, 'NOTA '::text || lq.nota::text, lq.documento::text)
                   FROM public.compra_liquidaciones lq
                  WHERE lq.compra_id = c.id AND lq.aplica_saldo AND lq.abono_aplicado > 0::numeric) x) p ON true
     LEFT JOIN LATERAL ( SELECT sum(
                CASE
                    WHEN nc.tipo = 'NOTA DE CRÉDITO'::text THEN nc.valor
                    ELSE - nc.valor
                END) AS ajuste
           FROM public.notas_compra nc
          WHERE nc.compra_id = c.id AND nc.estado = 'OPERADA'::text) n ON true;
grant select on public.compras_saldo to authenticated;

do $migra$
declare
  v_docs integer; v_compras integer; v_exc integer; v_monto numeric; v_exceso numeric;
begin
  -- Abono en la moneda de la compra.
  update public.compra_liquidaciones l
  set abono = case when coalesce(m.iso, 'GTQ') = 'GTQ' then l.valor
                   else coalesce(l.valor_mi, l.valor) end
  from public.compras c left join public.monedas m on m.id = c.moneda_id
  where c.id = l.compra_id;

  -- Aplicado: por orden de documento hasta el neto de la compra, menos los pagos del sistema (Caja y Bancos y anticipos).
  with base as (
    select l.id, l.compra_id, coalesce(l.abono, 0) as abono,
           greatest(s.neto - coalesce((select sum(a.valor) from public.compra_abonos a where a.compra_id = l.compra_id and a.liquidacion_id is null), 0), 0) as disponible,
           coalesce(sum(coalesce(l.abono, 0)) over (partition by l.compra_id order by l.documento, l.id rows between unbounded preceding and 1 preceding), 0) as antes
    from public.compra_liquidaciones l join public.compras_saldo s on s.id = l.compra_id
    where l.aplica_saldo
  )
  update public.compra_liquidaciones l
  set abono_aplicado = round(greatest(least(b.abono, b.disponible - b.antes), 0), 2),
      excedente = round(b.abono - greatest(least(b.abono, b.disponible - b.antes), 0), 2)
  from base b where b.id = l.id;
  update public.compra_liquidaciones set abono_aplicado = 0, excedente = 0 where not aplica_saldo;

  select count(*), count(distinct compra_id), count(*) filter (where excedente > 0.004), coalesce(sum(abono_aplicado), 0), coalesce(sum(excedente), 0)
  into v_docs, v_compras, v_exc, v_monto, v_exceso from public.compra_liquidaciones;
  raise notice '%', format('Abonos de liquidación: %s documentos de %s compras; aplicado %s; %s documentos con excedente (%s, no se aplica).',
    v_docs, v_compras, to_char(v_monto, 'FM999,999,999,990.00'), v_exc, to_char(v_exceso, 'FM999,999,999,990.00'));
end;
$migra$;

notify pgrst, 'reload schema';
