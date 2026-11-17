-- Script 218 · Integración de movimientos contables: documento de origen de cada línea.
--   con_int_lineas devuelve además el origen (BANCO, COMPRA, NOTA_COMPRA, VENTA, CAJA, NOMINA, COBRO; vacío si es una póliza
--   sin documento) y el id del documento; con_integracion_movimientos los entrega en cada fila ('o' y 'oi') para que la
--   pantalla abra el documento que integra el movimiento (nota, cheque, compra, factura…). Requiere el script 217.
--   Cambia el tipo de retorno: se borra y se vuelve a crear con_int_lineas. Se puede ejecutar de nuevo.

drop function if exists public.con_int_lineas(bigint, date, date, text, text);
create or replace function public.con_int_lineas(p_loc bigint, p_desde date, p_hasta date, p_cuenta text default null, p_centro text default null)
 returns table (partida_id bigint, anio integer, mes integer, siglas text, numero integer, fecha date, partida_desc text,
                cuenta text, cuenta_nombre text, centro text, centro_nombre text, debe numeric, haber numeric, concepto text,
                tipo_doc text, documento text, fecha_doc date, doc_desc text, transaccion integer, origen text, doc_id bigint)
 language sql stable security definer set search_path to '' as $function$
  with p as (
    select x.id, x.anio, x.mes, x.numero, least(greatest((x.fecha at time zone 'America/Guatemala')::date, make_date(x.anio, x.mes, 1)), (make_date(x.anio, x.mes, 1) + interval '1 month - 1 day')::date) as fecha, x.descripcion, t.siglas, coalesce(tc.numero, x.transaccion_anterior) as transaccion
      from public.partidas x left join public.tipos_partida t on t.id = x.tipo_partida_id left join public.transacciones_contables tc on tc.id = x.transaccion_id
     where x.localidad_id = p_loc and x.estado = 'VIGENTE'
       and least(greatest((x.fecha at time zone 'America/Guatemala')::date, make_date(x.anio, x.mes, 1)), (make_date(x.anio, x.mes, 1) + interval '1 month - 1 day')::date) between p_desde and p_hasta),
  -- Pólizas del Cierre Preliminar: se abren en los documentos que juntaron.
  pre as (select c.id as cierre_id, c.partida_id, c.transaccion_id from public.cierres_preliminares c join p on p.id = c.partida_id where c.estado = 'GENERADO'),
  -- Documento ligado directamente a la partida (uno por partida).
  docs as (
    select distinct on (d.partida_id) d.partida_id, d.tipo_doc, d.documento, d.fecha_doc, d.doc_desc, d.transaccion, d.origen, d.doc_id from (
      select m.partida_id, case m.tipo when 'CHEQUE' then 'CHQ' when 'DEPOSITO' then 'DEP' when 'NOTA_CREDITO' then 'NCB' else 'NDB' end as tipo_doc,
             cb.numero || ' - ' || coalesce(nullif(trim(m.numero_documento), ''), m.folio::text) as documento, m.fecha as fecha_doc,
             coalesce(nullif(trim(m.descripcion), ''), m.tercero_nombre) as doc_desc, m.transaccion_anterior as transaccion, 'BANCO' as origen, m.id as doc_id
        from public.movimientos_bancarios m join public.cuentas_bancarias cb on cb.id = m.cuenta_bancaria_id
       where m.localidad_id = p_loc and m.partida_id is not null and m.estado = 'ACTIVO'
      union all
      select c.partida_id, 'COM', concat_ws('-', nullif(trim(c.serie), ''), c.documento), c.fecha_documento, c.proveedor_nombre || coalesce(' · ' || nullif(trim(c.descripcion), ''), ''), c.transaccion_anterior, 'COMPRA', c.id
        from public.compras c where c.localidad_id = p_loc and c.partida_id is not null and c.estado = 'ACTIVA'
      union all
      select n.partida_id, case when n.tipo = 'NOTA DE DÉBITO' then 'NDP' else 'NCP' end, concat_ws('-', nullif(trim(n.serie), ''), n.documento), n.fecha, n.proveedor_nombre, null::integer, 'NOTA_COMPRA', n.id
        from public.notas_compra n where n.localidad_id = p_loc and n.partida_id is not null
      union all
      select f.partida_id, 'FAC', coalesce(concat_ws('-', nullif(trim(f.serie), ''), nullif(trim(f.numero_dte), '')), f.numero::text),
             (f.fecha_emision at time zone 'America/Guatemala')::date, f.nombre, null::integer, 'VENTA', f.id
        from public.facturas_venta f where f.localidad_id = p_loc and f.partida_id is not null and f.estado = 'FACTURADA'
      union all
      select k.partida_id, 'CAJ', 'Liquidación ' || k.numero, make_date(k.anio, k.mes, 1), 'Caja chica', null::integer, 'CAJA', k.id
        from public.caja_periodos k where k.localidad_id = p_loc and k.partida_id is not null
      union all
      select n.partida_id, 'NOM', 'Planilla ' || n.numero, n.fecha_pago, coalesce(n.descripcion, 'Planilla ' || lower(n.tipo)), null::integer, 'NOMINA', n.id
        from public.nom_planillas n where n.localidad_id = p_loc and n.partida_id is not null
      union all
      select r.partida_id, 'REC', 'Recibo ' || r.numero, r.fecha, 'Cobro ' || lower(r.forma), null::integer, 'COBRO', r.id
        from public.cli_cobros r where r.localidad_id = p_loc and r.partida_id is not null and r.estado = 'PAGADO'
    ) d join p on p.id = d.partida_id order by d.partida_id, d.tipo_doc),
  -- Detalle de los documentos de las pólizas del Cierre Preliminar.
  pre_lin as (
    select x.partida_id, l.cuenta_id, l.centro_id, coalesce(l.debe, 0) as debe, coalesce(l.haber, 0) as haber, 'COM' as tipo_doc,
           concat_ws('-', nullif(trim(c.serie), ''), c.documento) as documento, c.fecha_documento as fecha_doc, c.proveedor_nombre as doc_desc, c.transaccion_anterior as transaccion, 'COMPRA' as origen, c.id as doc_id
      from pre x join public.cierre_preliminar_documentos d on d.cierre_id = x.cierre_id and d.origen = 'COMPRA'
      join public.compras c on c.id = d.documento_id join public.compra_lineas l on l.compra_id = c.id
    union all
    select x.partida_id, l.cuenta_id, l.centro_id, coalesce(l.debe, 0), coalesce(l.haber, 0),
           case m.tipo when 'CHEQUE' then 'CHQ' when 'DEPOSITO' then 'DEP' when 'NOTA_CREDITO' then 'NCB' else 'NDB' end,
           cb.numero || ' - ' || coalesce(nullif(trim(m.numero_documento), ''), m.folio::text), m.fecha, coalesce(nullif(trim(m.descripcion), ''), m.tercero_nombre), m.transaccion_anterior, 'BANCO', m.id
      from pre x join public.cierre_preliminar_documentos d on d.cierre_id = x.cierre_id and d.origen = 'BANCO'
      join public.movimientos_bancarios m on m.id = d.documento_id join public.cuentas_bancarias cb on cb.id = m.cuenta_bancaria_id
      join public.movimiento_lineas l on l.movimiento_id = m.id
    union all
    select x.partida_id, l.cuenta_id, l.centro_id, l.debe, l.haber, 'FAC',
           coalesce(concat_ws('-', nullif(trim(f.serie), ''), nullif(trim(f.numero_dte), '')), f.numero::text), (f.fecha_emision at time zone 'America/Guatemala')::date, f.nombre, null::integer, 'VENTA', f.id
      from pre x join public.cierre_preliminar_documentos d on d.cierre_id = x.cierre_id and d.origen = 'VENTA'
      join public.facturas_venta f on f.id = d.documento_id join public.factura_venta_contable l on l.factura_id = f.id
    union all
    -- Facturas sin detalle contable: la plantilla de la transacción (como al generar la póliza).
    select x.partida_id, t.cuenta_id, t.centro_id,
           case when t.naturaleza = 'D' then v.monto else 0 end, case when t.naturaleza = 'H' then v.monto else 0 end, 'FAC',
           coalesce(concat_ws('-', nullif(trim(f.serie), ''), nullif(trim(f.numero_dte), '')), f.numero::text), (f.fecha_emision at time zone 'America/Guatemala')::date, f.nombre, null::integer, 'VENTA', f.id
      from pre x join public.cierre_preliminar_documentos d on d.cierre_id = x.cierre_id and d.origen = 'VENTA'
      join public.facturas_venta f on f.id = d.documento_id
      join public.transaccion_cuentas t on t.transaccion_id = x.transaccion_id
      cross join lateral (select round(case when coalesce((select y.iso from public.monedas y where y.id = f.moneda_id), 'GTQ') = 'GTQ' then 1 else f.tipo_cambio end
                                       * case t.operacion when 'TOTAL' then f.total when 'SUBTOTAL' then f.total - f.iva when 'IMPUESTO' then f.iva
                                                          when 'RETENCIÓN' then f.monto_retencion_iva + f.monto_retencion_isr else 0 end, 2) as monto) v
     where not exists (select 1 from public.factura_venta_contable l where l.factura_id = f.id)),
  lin as (
    select l.partida_id, l.cuenta_id, l.centro_id, l.debe, l.haber, l.concepto, d.tipo_doc, d.documento, d.fecha_doc, d.doc_desc, d.transaccion, d.origen, d.doc_id
      from p join public.partida_lineas l on l.partida_id = p.id left join docs d on d.partida_id = p.id
     where not exists (select 1 from pre x where x.partida_id = p.id)
    union all
    select y.partida_id, y.cuenta_id, y.centro_id, y.debe, y.haber, null, y.tipo_doc, y.documento, y.fecha_doc, y.doc_desc, y.transaccion, y.origen, y.doc_id
      from pre_lin y where y.debe <> 0 or y.haber <> 0)
  select p.id, p.anio, p.mes, p.siglas, p.numero, p.fecha, p.descripcion,
         k.codigo, k.nombre, cc.codigo, cc.nombre, l.debe, l.haber, l.concepto,
         coalesce(l.tipo_doc, 'POL'), coalesce(l.documento, coalesce(p.siglas, 'PD') || ' ' || p.mes || '-' || p.numero), coalesce(l.fecha_doc, p.fecha),
         coalesce(nullif(trim(l.concepto), ''), l.doc_desc, p.descripcion), coalesce(l.transaccion, p.transaccion), l.origen, l.doc_id
    from lin l join p on p.id = l.partida_id
    join public.cuentas k on k.id = l.cuenta_id
    left join public.centros_costo cc on cc.id = l.centro_id
   where (p_cuenta is null or k.codigo like p_cuenta || '%')
     and (p_centro is null or (p_centro = '*' and cc.codigo is not null) or cc.codigo like p_centro || '%');
$function$;

create or replace function public.con_integracion_movimientos(p_loc bigint, p_desde date, p_hasta date, p_cuenta text default null, p_centro text default null)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_saldos jsonb; v_filas jsonb; v_total integer; v_cuenta text := nullif(trim(p_cuenta), ''); v_centro text := nullif(trim(p_centro), '');
  v_nc text; v_ncc text; v_codigos text[];
begin
  if not public.usuario_activo() then raise exception 'Usuario no autorizado.'; end if;
  if p_desde > p_hasta then raise exception 'La fecha inicial es posterior a la final.'; end if;
  if v_cuenta is not null then
    select k.nombre into v_nc from public.cuentas k join public.catalogos_cuentas c on c.id = k.catalogo_id
     where c.localidad_id = p_loc and k.codigo = v_cuenta order by c.activo desc, c.version desc limit 1;
  end if;
  if v_centro is not null and v_centro <> '*' then
    select x.nombre into v_ncc from public.centros_costo x join public.catalogos_centros c on c.id = x.catalogo_id
     where c.localidad_id = p_loc and x.codigo = v_centro order by c.activo desc, c.version desc limit 1;
  end if;
  -- Saldo anterior: por cuenta; en la integración por centro de costo, por centro y cuenta («centro|cuenta»).
  if v_centro is null then
    select coalesce(jsonb_object_agg(s.cuenta, s.saldo), '{}'::jsonb) into v_saldos from public.con_int_saldos(p_loc, p_desde, v_cuenta, null) s;
  else
    select coalesce(jsonb_object_agg(s.centro || '|' || s.cuenta, s.saldo), '{}'::jsonb) into v_saldos from public.con_int_saldos_centro(p_loc, p_desde, v_cuenta, v_centro) s;
  end if;
  with l as (select * from public.con_int_lineas(p_loc, p_desde, p_hasta, v_cuenta, v_centro))
  select count(*)::integer,
         coalesce((select jsonb_agg(jsonb_build_object('p', z.partida_id, 'pt', coalesce(z.siglas, 'PD') || ' ' || z.mes || '-' || z.numero,
                    'c', z.cuenta, 'cn', z.cuenta_nombre, 'cc', z.centro, 'ccn', z.centro_nombre, 't', z.tipo_doc, 'doc', z.documento,
                    'f', z.fecha, 'fd', z.fecha_doc, 'd', z.debe, 'h', z.haber, 'desc', z.doc_desc, 'tr', z.transaccion, 'o', z.origen, 'oi', z.doc_id)
                    order by case when v_centro is null then '' else z.centro end, z.cuenta, z.fecha, z.anio, z.mes, z.numero, z.fecha_doc, z.documento)
                   from (select * from l order by case when v_centro is null then '' else l.centro end, l.cuenta, l.fecha, l.anio, l.mes, l.numero, l.fecha_doc, l.documento limit 20000) z), '[]'::jsonb)
    into v_total, v_filas from l;
  v_codigos := array(select distinct x ->> 'c' from jsonb_array_elements(v_filas) x
                     union select split_part(k, '|', 2) from jsonb_object_keys(v_saldos) k where k like '%|%'
                     union select k from jsonb_object_keys(v_saldos) k where k not like '%|%'
                     union select v_cuenta);
  return jsonb_build_object('cuenta', v_cuenta, 'cuenta_nombre', v_nc, 'centro', v_centro, 'centro_nombre', v_ncc,
                            'saldos', v_saldos, 'total', v_total, 'filas', v_filas, 'nat', public.con_int_naturalezas(p_loc, v_codigos));
end;
$function$;

revoke execute on function public.con_int_lineas(bigint, date, date, text, text) from public, anon, authenticated;
grant execute on function public.con_integracion_movimientos(bigint, date, date, text, text) to authenticated;
notify pgrst, 'reload schema';
select count(*) as funciones_218 from pg_proc where proname in ('con_int_lineas', 'con_integracion_movimientos') and pronamespace = 'public'::regnamespace;
