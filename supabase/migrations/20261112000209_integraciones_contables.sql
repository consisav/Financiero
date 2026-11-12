-- Script 209 · Contabilidad › Procesos › Generación de Cierres › Integraciones.
--   a) Por cuenta: las partidas del período donde aparece una cuenta (o una cuenta mayor y sus subcuentas), una fila por partida,
--      con el saldo anterior a la fecha inicial.
--   b) Movimientos contables: el detalle por documento (cheque, depósito, nota bancaria, compra, nota de compra, factura, recibo,
--      caja chica, planilla, póliza…) de una cuenta en el período, con el saldo anterior.
--   c) Movimientos por centro de costo: el mismo detalle de un centro de costo (y sus subcentros), por cuenta.
--   Fuente: las partidas vigentes (aprobadas o no; no las anuladas) y sus líneas. El tipo y número de documento salen del documento
--   que generó la partida; las pólizas del Cierre Preliminar (que juntan varios documentos) se abren en el detalle de cada documento.
--   Partidas sin documento ligado (manuales o migradas): tipo POL. Fecha contable de una partida: su fecha (hora de Guatemala) si cae en su mes; si no, el último día de su mes
--   (o el primero, si se registró antes de su mes).
--   Menú: Generación de Cierres se divide en «Cierres» (Preliminar, Mensual, Anual Fiscal) e «Integraciones» (estas tres opciones,
--   con los accesos de Cierre Mensual). Se puede ejecutar de nuevo.

-- Líneas contables del período con su documento de origen. Filtros opcionales por cuenta y centro (código o prefijo: incluye subcuentas).
create or replace function public.con_int_lineas(p_loc bigint, p_desde date, p_hasta date, p_cuenta text default null, p_centro text default null)
 returns table (partida_id bigint, anio integer, mes integer, siglas text, numero integer, fecha date, partida_desc text,
                cuenta text, cuenta_nombre text, centro text, centro_nombre text, debe numeric, haber numeric, concepto text,
                tipo_doc text, documento text, fecha_doc date, doc_desc text)
 language sql stable security definer set search_path to '' as $function$
  with p as (
    select x.id, x.anio, x.mes, x.numero, least(greatest((x.fecha at time zone 'America/Guatemala')::date, make_date(x.anio, x.mes, 1)), (make_date(x.anio, x.mes, 1) + interval '1 month - 1 day')::date) as fecha, x.descripcion, t.siglas
      from public.partidas x left join public.tipos_partida t on t.id = x.tipo_partida_id
     where x.localidad_id = p_loc and x.estado = 'VIGENTE'
       and least(greatest((x.fecha at time zone 'America/Guatemala')::date, make_date(x.anio, x.mes, 1)), (make_date(x.anio, x.mes, 1) + interval '1 month - 1 day')::date) between p_desde and p_hasta),
  -- Pólizas del Cierre Preliminar: se abren en los documentos que juntaron.
  pre as (select c.id as cierre_id, c.partida_id, c.transaccion_id from public.cierres_preliminares c join p on p.id = c.partida_id where c.estado = 'GENERADO'),
  -- Documento ligado directamente a la partida (uno por partida).
  docs as (
    select distinct on (d.partida_id) d.partida_id, d.tipo_doc, d.documento, d.fecha_doc, d.doc_desc from (
      select m.partida_id, case m.tipo when 'CHEQUE' then 'CHQ' when 'DEPOSITO' then 'DEP' when 'NOTA_CREDITO' then 'NCB' else 'NDB' end as tipo_doc,
             cb.numero || ' - ' || coalesce(nullif(trim(m.numero_documento), ''), m.folio::text) as documento, m.fecha as fecha_doc,
             coalesce(nullif(trim(m.descripcion), ''), m.tercero_nombre) as doc_desc
        from public.movimientos_bancarios m join public.cuentas_bancarias cb on cb.id = m.cuenta_bancaria_id
       where m.localidad_id = p_loc and m.partida_id is not null and m.estado = 'ACTIVO'
      union all
      select c.partida_id, 'COM', concat_ws('-', nullif(trim(c.serie), ''), c.documento), c.fecha_documento, c.proveedor_nombre || coalesce(' · ' || nullif(trim(c.descripcion), ''), '')
        from public.compras c where c.localidad_id = p_loc and c.partida_id is not null and c.estado = 'ACTIVA'
      union all
      select n.partida_id, case when n.tipo = 'NOTA DE DÉBITO' then 'NDP' else 'NCP' end, concat_ws('-', nullif(trim(n.serie), ''), n.documento), n.fecha, n.proveedor_nombre
        from public.notas_compra n where n.localidad_id = p_loc and n.partida_id is not null
      union all
      select f.partida_id, 'FAC', coalesce(concat_ws('-', nullif(trim(f.serie), ''), nullif(trim(f.numero_dte), '')), f.numero::text),
             (f.fecha_emision at time zone 'America/Guatemala')::date, f.nombre
        from public.facturas_venta f where f.localidad_id = p_loc and f.partida_id is not null and f.estado = 'FACTURADA'
      union all
      select k.partida_id, 'CAJ', 'Liquidación ' || k.numero, make_date(k.anio, k.mes, 1), 'Caja chica'
        from public.caja_periodos k where k.localidad_id = p_loc and k.partida_id is not null
      union all
      select n.partida_id, 'NOM', 'Planilla ' || n.numero, n.fecha_pago, coalesce(n.descripcion, 'Planilla ' || lower(n.tipo))
        from public.nom_planillas n where n.localidad_id = p_loc and n.partida_id is not null
      union all
      select r.partida_id, 'REC', 'Recibo ' || r.numero, r.fecha, 'Cobro ' || lower(r.forma)
        from public.cli_cobros r where r.localidad_id = p_loc and r.partida_id is not null and r.estado = 'PAGADO'
    ) d join p on p.id = d.partida_id order by d.partida_id, d.tipo_doc),
  -- Detalle de los documentos de las pólizas del Cierre Preliminar.
  pre_lin as (
    select x.partida_id, l.cuenta_id, l.centro_id, coalesce(l.debe, 0) as debe, coalesce(l.haber, 0) as haber, 'COM' as tipo_doc,
           concat_ws('-', nullif(trim(c.serie), ''), c.documento) as documento, c.fecha_documento as fecha_doc, c.proveedor_nombre as doc_desc
      from pre x join public.cierre_preliminar_documentos d on d.cierre_id = x.cierre_id and d.origen = 'COMPRA'
      join public.compras c on c.id = d.documento_id join public.compra_lineas l on l.compra_id = c.id
    union all
    select x.partida_id, l.cuenta_id, l.centro_id, coalesce(l.debe, 0), coalesce(l.haber, 0),
           case m.tipo when 'CHEQUE' then 'CHQ' when 'DEPOSITO' then 'DEP' when 'NOTA_CREDITO' then 'NCB' else 'NDB' end,
           cb.numero || ' - ' || coalesce(nullif(trim(m.numero_documento), ''), m.folio::text), m.fecha, coalesce(nullif(trim(m.descripcion), ''), m.tercero_nombre)
      from pre x join public.cierre_preliminar_documentos d on d.cierre_id = x.cierre_id and d.origen = 'BANCO'
      join public.movimientos_bancarios m on m.id = d.documento_id join public.cuentas_bancarias cb on cb.id = m.cuenta_bancaria_id
      join public.movimiento_lineas l on l.movimiento_id = m.id
    union all
    select x.partida_id, l.cuenta_id, l.centro_id, l.debe, l.haber, 'FAC',
           coalesce(concat_ws('-', nullif(trim(f.serie), ''), nullif(trim(f.numero_dte), '')), f.numero::text), (f.fecha_emision at time zone 'America/Guatemala')::date, f.nombre
      from pre x join public.cierre_preliminar_documentos d on d.cierre_id = x.cierre_id and d.origen = 'VENTA'
      join public.facturas_venta f on f.id = d.documento_id join public.factura_venta_contable l on l.factura_id = f.id
    union all
    -- Facturas sin detalle contable: la plantilla de la transacción (como al generar la póliza).
    select x.partida_id, t.cuenta_id, t.centro_id,
           case when t.naturaleza = 'D' then v.monto else 0 end, case when t.naturaleza = 'H' then v.monto else 0 end, 'FAC',
           coalesce(concat_ws('-', nullif(trim(f.serie), ''), nullif(trim(f.numero_dte), '')), f.numero::text), (f.fecha_emision at time zone 'America/Guatemala')::date, f.nombre
      from pre x join public.cierre_preliminar_documentos d on d.cierre_id = x.cierre_id and d.origen = 'VENTA'
      join public.facturas_venta f on f.id = d.documento_id
      join public.transaccion_cuentas t on t.transaccion_id = x.transaccion_id
      cross join lateral (select round(case when coalesce((select y.iso from public.monedas y where y.id = f.moneda_id), 'GTQ') = 'GTQ' then 1 else f.tipo_cambio end
                                       * case t.operacion when 'TOTAL' then f.total when 'SUBTOTAL' then f.total - f.iva when 'IMPUESTO' then f.iva
                                                          when 'RETENCIÓN' then f.monto_retencion_iva + f.monto_retencion_isr else 0 end, 2) as monto) v
     where not exists (select 1 from public.factura_venta_contable l where l.factura_id = f.id)),
  lin as (
    select l.partida_id, l.cuenta_id, l.centro_id, l.debe, l.haber, l.concepto, d.tipo_doc, d.documento, d.fecha_doc, d.doc_desc
      from p join public.partida_lineas l on l.partida_id = p.id left join docs d on d.partida_id = p.id
     where not exists (select 1 from pre x where x.partida_id = p.id)
    union all
    select y.partida_id, y.cuenta_id, y.centro_id, y.debe, y.haber, null, y.tipo_doc, y.documento, y.fecha_doc, y.doc_desc
      from pre_lin y where y.debe <> 0 or y.haber <> 0)
  select p.id, p.anio, p.mes, p.siglas, p.numero, p.fecha, p.descripcion,
         k.codigo, k.nombre, cc.codigo, cc.nombre, l.debe, l.haber, l.concepto,
         coalesce(l.tipo_doc, 'POL'), coalesce(l.documento, coalesce(p.siglas, 'PD') || ' ' || p.mes || '-' || p.numero), coalesce(l.fecha_doc, p.fecha),
         coalesce(nullif(trim(l.concepto), ''), l.doc_desc, p.descripcion)
    from lin l join p on p.id = l.partida_id
    join public.cuentas k on k.id = l.cuenta_id
    left join public.centros_costo cc on cc.id = l.centro_id
   where (p_cuenta is null or k.codigo like p_cuenta || '%')
     and (p_centro is null or cc.codigo like p_centro || '%');
$function$;

-- Saldo de cada cuenta antes de una fecha (debe − haber de las partidas vigentes), con los mismos filtros.
create or replace function public.con_int_saldos(p_loc bigint, p_antes date, p_cuenta text default null, p_centro text default null)
 returns table (cuenta text, saldo numeric)
 language sql stable security definer set search_path to '' as $function$
  select k.codigo, sum(l.debe - l.haber)
    from public.partidas x join public.partida_lineas l on l.partida_id = x.id
    join public.cuentas k on k.id = l.cuenta_id
    left join public.centros_costo cc on cc.id = l.centro_id
   where x.localidad_id = p_loc and x.estado = 'VIGENTE' and least(greatest((x.fecha at time zone 'America/Guatemala')::date, make_date(x.anio, x.mes, 1)), (make_date(x.anio, x.mes, 1) + interval '1 month - 1 day')::date) < p_antes
     and (p_cuenta is null or k.codigo like p_cuenta || '%')
     and (p_centro is null or cc.codigo like p_centro || '%')
   group by k.codigo having sum(l.debe - l.haber) <> 0;
$function$;

-- Naturaleza de las cuentas (1 deudora, -1 acreedora: tipo de cuenta HABER-DEBE) por código, en la localidad.
create or replace function public.con_int_naturalezas(p_loc bigint, p_codigos text[])
 returns jsonb language sql stable security definer set search_path to '' as $function$
  select coalesce(jsonb_object_agg(z.codigo, z.nat), '{}'::jsonb) from (
    select distinct on (k.codigo) k.codigo, case when t.tipo_operacion = 'HABER-DEBE' then -1 else 1 end as nat
      from public.cuentas k join public.catalogos_cuentas c on c.id = k.catalogo_id left join public.tipos_cuenta t on t.id = k.tipo_cuenta_id
     where c.localidad_id = p_loc and k.codigo = any (p_codigos)
     order by k.codigo, c.activo desc, c.version desc) z;
$function$;

-- a) Integración por cuenta: una fila por partida.
create or replace function public.con_integracion_cuenta(p_loc bigint, p_cuenta text, p_desde date, p_hasta date)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_saldo numeric; v_filas jsonb; v_nombre text;
begin
  if not public.usuario_activo() then raise exception 'Usuario no autorizado.'; end if;
  if coalesce(trim(p_cuenta), '') = '' then raise exception 'Indica la cuenta.'; end if;
  if p_desde > p_hasta then raise exception 'La fecha inicial es posterior a la final.'; end if;
  select k.nombre into v_nombre from public.cuentas k join public.catalogos_cuentas c on c.id = k.catalogo_id
   where c.localidad_id = p_loc and k.codigo = trim(p_cuenta) order by c.activo desc, c.version desc limit 1;
  select coalesce(sum(s.saldo), 0) into v_saldo from public.con_int_saldos(p_loc, p_desde, trim(p_cuenta)) s;
  select coalesce(jsonb_agg(jsonb_build_object('id', g.partida_id, 'anio', g.anio, 'mes', g.mes, 'tipo', g.siglas, 'numero', g.numero,
           'fecha', g.fecha, 'descripcion', g.partida_desc, 'debe', g.debe, 'haber', g.haber) order by g.fecha, g.anio, g.mes, g.numero), '[]'::jsonb)
    into v_filas
    from (select l.partida_id, l.anio, l.mes, l.siglas, l.numero, l.fecha, l.partida_desc, sum(l.debe) as debe, sum(l.haber) as haber
            from public.con_int_lineas(p_loc, p_desde, p_hasta, trim(p_cuenta)) l
           group by 1, 2, 3, 4, 5, 6, 7) g;
  return jsonb_build_object('cuenta', trim(p_cuenta), 'nombre', v_nombre, 'saldo_inicial', v_saldo, 'filas', v_filas,
                            'nat', coalesce((public.con_int_naturalezas(p_loc, array[trim(p_cuenta)]) ->> trim(p_cuenta))::integer, 1));
end;
$function$;

-- b) y c) Movimientos contables por documento, de una cuenta o de un centro de costo. Hasta 20,000 movimientos.
create or replace function public.con_integracion_movimientos(p_loc bigint, p_desde date, p_hasta date, p_cuenta text default null, p_centro text default null)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_saldos jsonb; v_filas jsonb; v_total integer; v_cuenta text := nullif(trim(p_cuenta), ''); v_centro text := nullif(trim(p_centro), '');
  v_nc text; v_ncc text;
begin
  if not public.usuario_activo() then raise exception 'Usuario no autorizado.'; end if;
  if v_cuenta is null and v_centro is null then raise exception 'Indica la cuenta o el centro de costo.'; end if;
  if p_desde > p_hasta then raise exception 'La fecha inicial es posterior a la final.'; end if;
  if v_cuenta is not null then
    select k.nombre into v_nc from public.cuentas k join public.catalogos_cuentas c on c.id = k.catalogo_id
     where c.localidad_id = p_loc and k.codigo = v_cuenta order by c.activo desc, c.version desc limit 1;
  end if;
  if v_centro is not null then
    select x.nombre into v_ncc from public.centros_costo x join public.catalogos_centros c on c.id = x.catalogo_id
     where c.localidad_id = p_loc and x.codigo = v_centro order by c.activo desc, c.version desc limit 1;
  end if;
  select coalesce(jsonb_object_agg(s.cuenta, s.saldo), '{}'::jsonb) into v_saldos from public.con_int_saldos(p_loc, p_desde, v_cuenta, v_centro) s;
  with l as (select * from public.con_int_lineas(p_loc, p_desde, p_hasta, v_cuenta, v_centro))
  select count(*)::integer,
         coalesce((select jsonb_agg(jsonb_build_object('p', z.partida_id, 'pt', coalesce(z.siglas, 'PD') || ' ' || z.mes || '-' || z.numero,
                    'c', z.cuenta, 'cn', z.cuenta_nombre, 'cc', z.centro, 'ccn', z.centro_nombre, 't', z.tipo_doc, 'doc', z.documento,
                    'f', z.fecha, 'fd', z.fecha_doc, 'd', z.debe, 'h', z.haber, 'desc', z.doc_desc)
                    order by z.cuenta, z.fecha, z.anio, z.mes, z.numero, z.fecha_doc, z.documento)
                   from (select * from l order by l.cuenta, l.fecha, l.anio, l.mes, l.numero, l.fecha_doc, l.documento limit 20000) z), '[]'::jsonb)
    into v_total, v_filas from l;
  return jsonb_build_object('cuenta', v_cuenta, 'cuenta_nombre', v_nc, 'centro', v_centro, 'centro_nombre', v_ncc,
                            'saldos', v_saldos, 'total', v_total, 'filas', v_filas,
                            'nat', public.con_int_naturalezas(p_loc, array(select distinct x ->> 'c' from jsonb_array_elements(v_filas) x union select jsonb_object_keys(v_saldos) union select v_cuenta)));
end;
$function$;

revoke execute on function public.con_int_lineas(bigint, date, date, text, text) from public, anon, authenticated;
revoke execute on function public.con_int_saldos(bigint, date, text, text) from public, anon, authenticated;
revoke execute on function public.con_int_naturalezas(bigint, text[]) from public, anon, authenticated;
revoke execute on function public.con_integracion_cuenta(bigint, text, date, date) from public, anon;
revoke execute on function public.con_integracion_movimientos(bigint, date, date, text, text) from public, anon;
grant execute on function public.con_integracion_cuenta(bigint, text, date, date) to authenticated;
grant execute on function public.con_integracion_movimientos(bigint, date, date, text, text) to authenticated;

-- ============ Opciones del menú y accesos ============
-- Generación de Cierres › Cierres (Preliminar, Mensual, Anual Fiscal) e Integraciones (las tres nuevas, con los accesos de Cierre Mensual).
do $$
declare v_mod bigint; v_id bigint; v_ref bigint; v_orden integer; o record;
begin
  select id into v_mod from public.modulos_sistema where siglas = 'CON' and modulo_mayor_id is null limit 1;
  if v_mod is null then return; end if;
  select id into v_ref from public.opciones_sistema where clave = 'cierre-de-mes' order by id limit 1;
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  update public.opciones_sistema set subgrupo = 'Generación de Cierres · Cierres'
   where clave in ('con-cierre-preliminar', 'cierre-de-mes', 'con-cierre-anual') and subgrupo is distinct from 'Generación de Cierres · Cierres';
  for o in select * from (values (1, 'con-int-cuenta', 'Integración por cuenta'), (2, 'con-int-movimientos', 'Integración de movimientos contables'),
                                 (3, 'con-int-centro', 'Integración de movimientos por centro de costo')) as x(n, clave, nombre) loop
    select id into v_id from public.opciones_sistema where clave = o.clave order by id limit 1;
    if v_id is null then
      insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
      values (v_mod, 'procesos', 'Generación de Cierres · Integraciones', o.clave, o.nombre, v_orden + o.n) returning id into v_id;
    else
      update public.opciones_sistema set nombre = o.nombre, activo = true where id = v_id;
    end if;
    if v_ref is not null then
      insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
      select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = v_ref on conflict do nothing;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

select o.subgrupo, o.clave, o.nombre, (select count(*) from public.rol_accesos a where a.opcion_id = o.id) as roles_con_acceso
from public.opciones_sistema o where o.subgrupo like 'Generación de Cierres%' order by o.subgrupo, o.orden;
