-- 188 · Unifica las cajas chicas migradas de la organización 2: cajas y subcajas (script 184), documentos de subcaja (187) y el detalle
-- contable (184). Misma lógica del script 123 (organización 3). Se ejecuta después de los scripts 184 y 187, y puede ejecutarse de nuevo.
--   1. El MOVIMIENTO del detalle contable es el mismo MOVIMIENTO del documento: cada línea contable queda enlazada a su documento y su
--      concepto dice el documento y el proveedor, en lugar de «MOVIMIENTO n».
--   2. El IVA del documento queda igual al IVA que se contabilizó en el sistema anterior (cuenta 1010401001).
--   3. El documento sin cuenta de gasto toma la cuenta del gasto de su asiento.
--   4. Cada subcaja queda con su resumen del sistema anterior: documentos, documentos con asiento, total, debe, haber y si cuadra.
--   Al final informa lo que no se puede unificar con los archivos.

alter table public.caja_lineas add column if not exists documento_id bigint references public.caja_documentos(id) on delete set null;
create index if not exists caja_lineas_documento_idx on public.caja_lineas (documento_id);
alter table public.caja_periodos add column if not exists documentos_anterior integer;
alter table public.caja_periodos add column if not exists documentos_con_asiento integer;
alter table public.caja_periodos add column if not exists total_documentos_anterior numeric(18, 2);
alter table public.caja_periodos add column if not exists debe_anterior numeric(18, 2);
alter table public.caja_periodos add column if not exists haber_anterior numeric(18, 2);
alter table public.caja_periodos add column if not exists detalle_cuadra boolean;

do $unifica$
declare
  v_org bigint; v_enl int; v_iva int; v_cta int; v_sub int; v_lsd int; v_dsa int; v_desc int; v_prov int; v_lista text;
begin
  select id into v_org from public.organizaciones where codigo = 2;
  if v_org is null then raise exception 'No existe la organización 2.'; end if;
  -- Sin los disparadores: las subcajas liquidadas no aceptan cambios y el disparador recalcularía el IVA.
  alter table public.caja_documentos disable trigger caja_documentos_preparar;
  alter table public.caja_documentos disable trigger caja_documentos_auditar;
  alter table public.caja_lineas disable trigger user;

  -- 1. Línea contable ↔ documento, por subcaja y movimiento.
  update public.caja_lineas l set documento_id = d.id,
    concepto = left(format('MOV %s · %s %s · %s', d.movimiento_anterior,
      case d.tipo_documento when 'RECIBO' then 'REC' when 'FACTURA PEQUEÑO CONTRIBUYENTE' then 'FPC' when 'FACTURA ESPECIAL' then 'FESP' when 'OTRO' then 'DOC' else 'FACT' end,
      concat_ws('-', d.serie, d.documento), d.proveedor_nombre), 200)
  from public.caja_documentos d join public.caja_periodos p on p.id = d.periodo_id
  where p.organizacion_id = v_org and d.origen_anterior = 'MIGRADO' and l.periodo_id = d.periodo_id and l.movimiento_anterior = d.movimiento_anterior
    and (l.documento_id is distinct from d.id or l.concepto not like 'MOV %');
  get diagnostics v_enl = row_count;

  -- 2. IVA contabilizado en el sistema anterior.
  update public.caja_documentos d set iva = a.iva, base = d.total - d.exento - d.idp - d.inguat - d.timbre_prensa - d.no_deducible - a.iva
  from (select l.documento_id, sum(l.debe) iva from public.caja_lineas l where l.documento_id is not null and l.cuenta_codigo_anterior = '1010401001' group by 1) a
  where a.documento_id = d.id and abs(a.iva - d.iva) >= 0.01;
  get diagnostics v_iva = row_count;

  -- 3. Cuenta de gasto desde el asiento.
  update public.caja_documentos d set cuenta_gasto_id = a.cuenta_id
  from (select distinct on (l.documento_id) l.documento_id, l.cuenta_id
        from public.caja_lineas l join public.caja_periodos p on p.id = l.periodo_id join public.cajas_chicas c on c.id = p.caja_id
        where l.documento_id is not null and l.debe > 0 and l.cuenta_codigo_anterior <> '1010401001' and l.cuenta_id is distinct from c.cuenta_id
        order by l.documento_id, l.debe desc) a
  where a.documento_id = d.id and d.cuenta_gasto_id is null;
  get diagnostics v_cta = row_count;

  -- 4. Resumen del sistema anterior en cada subcaja.
  update public.caja_periodos p set documentos_anterior = s.docs, documentos_con_asiento = s.con_asiento, total_documentos_anterior = s.total,
    debe_anterior = s.debe, haber_anterior = s.haber, detalle_cuadra = case when s.debe is null then null else abs(s.debe - s.haber) < 0.01 end
  from (select p2.id,
          (select count(*) from public.caja_documentos d where d.periodo_id = p2.id) docs,
          (select count(*) from public.caja_documentos d where d.periodo_id = p2.id and exists (select 1 from public.caja_lineas l where l.documento_id = d.id)) con_asiento,
          (select sum(d.total) from public.caja_documentos d where d.periodo_id = p2.id) total,
          (select sum(l.debe) from public.caja_lineas l where l.periodo_id = p2.id) debe,
          (select sum(l.haber) from public.caja_lineas l where l.periodo_id = p2.id) haber
        from public.caja_periodos p2 where p2.organizacion_id = v_org and p2.origen_anterior = 'MIGRADO') s
  where s.id = p.id;
  get diagnostics v_sub = row_count;

  alter table public.caja_documentos enable trigger caja_documentos_preparar;
  alter table public.caja_documentos enable trigger caja_documentos_auditar;
  alter table public.caja_lineas enable trigger user;

  -- Lo que no se puede unificar con los archivos.
  select count(*) into v_lsd from public.caja_lineas l join public.caja_periodos p on p.id = l.periodo_id
  where p.organizacion_id = v_org and p.origen_anterior = 'MIGRADO' and l.documento_id is null;
  select count(*) into v_dsa from public.caja_documentos d join public.caja_periodos p on p.id = d.periodo_id
  where p.organizacion_id = v_org and d.origen_anterior = 'MIGRADO' and p.debe_anterior is not null and not exists (select 1 from public.caja_lineas l where l.documento_id = d.id);
  select count(*), string_agg(distinct format('2-0%s caja %s subcaja %s', lo.correlativo, c.codigo, p.numero), '; ') into v_desc, v_lista
  from (select l.documento_id from public.caja_lineas l where l.documento_id is not null group by 1 having abs(sum(l.debe) - sum(l.haber)) >= 0.01) x
  join public.caja_documentos d on d.id = x.documento_id join public.caja_periodos p on p.id = d.periodo_id
  join public.cajas_chicas c on c.id = p.caja_id join public.localidades lo on lo.id = c.localidad_id where p.organizacion_id = v_org;
  select count(*) into v_prov from public.caja_documentos d join public.caja_periodos p on p.id = d.periodo_id
  where p.organizacion_id = v_org and d.origen_anterior = 'MIGRADO' and d.proveedor_id is null;
  raise notice '%', format('Unificación: %s líneas contables enlazadas a su documento, %s documentos con el IVA contabilizado, %s documentos con la cuenta de gasto del asiento, %s subcajas con su resumen.', v_enl, v_iva, v_cta, v_sub);
  raise notice '%', format('Sin unificar: %s líneas contables sin documento; %s documentos sin asiento en subcajas que sí tienen detalle contable; %s asientos que no cuadran (%s); %s documentos sin proveedor migrado (llevan el nombre y NIT de ACT_PROVEEDORES; se ligan al migrar los proveedores).',
    v_lsd, v_dsa, v_desc, coalesce(v_lista, 'ninguno'), v_prov);
end;
$unifica$;

notify pgrst, 'reload schema';
