-- 168 · Reconstruye el detalle contable de las compras migradas que no lo traían.
--   En el sistema anterior solo 9 compras varias de 3-02 traían su detalle contable (ACT_DETCON_COMPRAS, 26
--   líneas). Las demás compras migradas (las 509 de 3-01, las de medicamentos de 3-02 y las compras varias
--   sin líneas) quedaron sin detalle contable. Su detalle (artículos o compras varias) sí se migró completo.
--   Este script arma el detalle contable de cada una igual que el botón «Contabilizar» de Ingreso de compras:
--     * Con su transacción contable, si la transacción tiene cuentas de SUBTOTAL (o TOTAL al débito) y de
--       TOTAL al crédito:  SUBTOTAL = total − IVA al débito, IMPUESTO = IVA al débito, TOTAL al crédito.
--     * Sin transacción, o si la transacción no tiene esas cuentas (por ejemplo «COMPRAS AL CRÉDITO
--       (EXTERIOR)» o «COMPRA DE MEDICAMENTOS LOCAL 2024», que no tienen cuentas): las cuentas de compra de
--       medicamentos 1010501001 INVENTARIO DE MEDICAMENTOS (débito), 1010401001 IVA CRÉDITO (débito) y
--       2010101001 PROVEEDORES DE MEDICAMENTOS (crédito).
--     * La retención va al crédito (cuenta RETENCIÓN de la transacción, o 2010201003 RETEN IVA DEBITO) y la
--       cuenta del proveedor queda con el total menos la retención. Cada compra queda cuadrada.
--     * Compra en dólares: los valores se convierten con su tipo de cambio y el valor en dólares queda en
--       debe_mi / haber_mi. Compra en quetzales: sin conversión (aunque traiga tipo de cambio).
--     * Las cuentas son las de la transacción, tal como están en ella; las cuentas por omisión se buscan por
--       código en el catálogo que usan las transacciones de la empresa (el mismo código puede ser otra cuenta
--       en otra versión del catálogo: en 3-02, 6010106002 es DEPRE. MOBILIARIO en la versión 1 y REP. Y MANT.
--       en la 2).
--   Solo se arman las compras migradas (con origen del sistema anterior) ACTIVAS, sin partida y sin ninguna
--   línea contable: lo que ya tiene detalle contable no se toca. Las líneas armadas quedan marcadas con
--   reconstruida = true (para identificarlas o quitarlas). Se puede ejecutar varias veces.

alter table public.compra_lineas add column if not exists reconstruida boolean not null default false;

do $migra$
declare
  c record;
  v_cat bigint;
  v_trans boolean;
  v_dolar boolean;
  v_tc numeric;
  v_total numeric; v_iva numeric; v_ret numeric; v_sub numeric;
  v_total_q numeric; v_iva_q numeric; v_ret_q numeric; v_sub_q numeric;
  v_cta_sub bigint; v_cta_iva bigint; v_cta_tot bigint; v_cta_ret bigint;
  v_centro_sub bigint;
  v_linea integer;
  v_compras integer := 0;
  v_lineas integer := 0;
  v_omitidas text := '';
begin
  perform set_config('fin.migracion', 'on', true);

  for c in
    select x.*, l.codigo as loc_codigo
    from public.compras x join public.localidades l on l.id = x.localidad_id
    where x.origen_anterior is not null and x.estado = 'ACTIVA' and x.partida_id is null and x.valor_total > 0
      and not exists (select 1 from public.compra_lineas y where y.compra_id = x.id)
    order by x.localidad_id, x.numero
  loop
    -- Catálogo de las cuentas por omisión: el que usan las transacciones de la empresa (el del sistema anterior);
    -- si no hay, la versión vigente más reciente.
    select k.id into v_cat from public.transaccion_cuentas t join public.transacciones_contables tt on tt.id = t.transaccion_id
      join public.cuentas o on o.id = t.cuenta_id join public.catalogos_cuentas k on k.id = o.catalogo_id
     where tt.localidad_id = c.localidad_id and k.localidad_id = c.localidad_id and k.activo
     group by k.id order by count(*) desc limit 1;
    if v_cat is null then
      select k.id into v_cat from public.catalogos_cuentas k
       where k.localidad_id = c.localidad_id and k.activo order by k.version desc limit 1;
    end if;
    if v_cat is null then v_omitidas := v_omitidas || format(' %s-%s (sin catálogo)', c.loc_codigo, c.numero); continue; end if;

    -- Cuentas de la transacción, tal como están en ella (el mismo código puede ser otra cuenta en otra versión).
    v_cta_sub := null; v_cta_iva := null; v_cta_tot := null; v_cta_ret := null; v_centro_sub := null;
    if c.transaccion_id is not null then
      select t.cuenta_id, t.centro_id into v_cta_sub, v_centro_sub
        from public.transaccion_cuentas t
       where t.transaccion_id = c.transaccion_id and t.cuenta_id is not null and t.naturaleza = 'D' and t.operacion in ('SUBTOTAL', 'TOTAL')
       order by (t.operacion = 'SUBTOTAL') desc, t.orden, t.linea limit 1;
      select t.cuenta_id into v_cta_iva
        from public.transaccion_cuentas t
       where t.transaccion_id = c.transaccion_id and t.cuenta_id is not null and t.operacion = 'IMPUESTO' order by t.orden, t.linea limit 1;
      select t.cuenta_id into v_cta_tot
        from public.transaccion_cuentas t
       where t.transaccion_id = c.transaccion_id and t.cuenta_id is not null and t.naturaleza = 'H' and t.operacion = 'TOTAL' order by t.orden, t.linea limit 1;
      select t.cuenta_id into v_cta_ret
        from public.transaccion_cuentas t
       where t.transaccion_id = c.transaccion_id and t.cuenta_id is not null and t.operacion = 'RETENCIÓN' order by t.orden, t.linea limit 1;
    end if;
    v_trans := v_cta_sub is not null and v_cta_tot is not null;
    if not v_trans then
      select id into v_cta_sub from public.cuentas where catalogo_id = v_cat and codigo = '1010501001';
      select id into v_cta_tot from public.cuentas where catalogo_id = v_cat and codigo = '2010101001';
      v_cta_iva := null; v_cta_ret := null; v_centro_sub := null;
    end if;
    if v_cta_iva is null then select id into v_cta_iva from public.cuentas where catalogo_id = v_cat and codigo = '1010401001'; end if;
    if v_cta_ret is null then select id into v_cta_ret from public.cuentas where catalogo_id = v_cat and codigo = '2010201003'; end if;
    if v_cta_sub is null or v_cta_tot is null then
      v_omitidas := v_omitidas || format(' %s-%s (sin cuentas)', c.loc_codigo, c.numero); continue;
    end if;

    -- Montos (en la moneda de la compra) y su conversión a quetzales.
    v_dolar := c.moneda_id is not null and c.moneda_id <> 1;
    v_tc := case when v_dolar and coalesce(c.tipo_cambio, 0) > 0 then c.tipo_cambio else 1 end;
    v_total := round(c.valor_total, 2);
    v_iva := round(least(greatest(coalesce(c.iva, 0), 0), v_total), 2);
    v_ret := round(least(greatest(coalesce(c.retencion_valor, 0), 0), v_total), 2);
    v_sub := v_total - v_iva;
    v_total_q := round(v_total * v_tc, 2);
    v_iva_q := round(v_iva * v_tc, 2);
    v_ret_q := round(v_ret * v_tc, 2);
    v_sub_q := v_total_q - v_iva_q;
    if v_iva_q > 0 and v_cta_iva is null then v_omitidas := v_omitidas || format(' %s-%s (sin cuenta de IVA)', c.loc_codigo, c.numero); continue; end if;
    if v_ret_q > 0 and v_cta_ret is null then v_ret := 0; v_ret_q := 0; end if;

    v_linea := 0;
    if v_sub_q > 0 then
      v_linea := v_linea + 1;
      insert into public.compra_lineas (compra_id, linea, cuenta_id, centro_id, debe, haber, debe_mi, haber_mi, reconstruida)
      values (c.id, v_linea, v_cta_sub, v_centro_sub, v_sub_q, 0, case when v_dolar then v_sub end, case when v_dolar then 0 end, true);
    end if;
    if v_iva_q > 0 then
      v_linea := v_linea + 1;
      insert into public.compra_lineas (compra_id, linea, cuenta_id, debe, haber, debe_mi, haber_mi, reconstruida)
      values (c.id, v_linea, v_cta_iva, v_iva_q, 0, case when v_dolar then v_iva end, case when v_dolar then 0 end, true);
    end if;
    if v_total_q - v_ret_q > 0 then
      v_linea := v_linea + 1;
      insert into public.compra_lineas (compra_id, linea, cuenta_id, debe, haber, debe_mi, haber_mi, reconstruida)
      values (c.id, v_linea, v_cta_tot, 0, v_total_q - v_ret_q, case when v_dolar then 0 end, case when v_dolar then v_total - v_ret end, true);
    end if;
    if v_ret_q > 0 then
      v_linea := v_linea + 1;
      insert into public.compra_lineas (compra_id, linea, cuenta_id, debe, haber, debe_mi, haber_mi, reconstruida)
      values (c.id, v_linea, v_cta_ret, 0, v_ret_q, case when v_dolar then 0 end, case when v_dolar then v_ret end, true);
    end if;
    v_compras := v_compras + 1;
    v_lineas := v_lineas + v_linea;
  end loop;

  raise notice 'Detalle contable reconstruido: % compras, % líneas.%', v_compras, v_lineas,
    case when v_omitidas <> '' then ' Omitidas:' || v_omitidas else '' end;
end $migra$;

-- Resumen por empresa: compras migradas activas, con detalle contable, reconstruidas y cuadre.
select l.codigo as empresa,
  count(*) as compras_activas,
  count(*) filter (where exists (select 1 from public.compra_lineas y where y.compra_id = c.id)) as con_detalle_contable,
  count(*) filter (where exists (select 1 from public.compra_lineas y where y.compra_id = c.id and y.reconstruida)) as reconstruidas,
  count(*) filter (where exists (select 1 from public.compra_lineas y where y.compra_id = c.id)
                     and (select sum(y.debe) - sum(y.haber) from public.compra_lineas y where y.compra_id = c.id) <> 0) as descuadradas,
  (select count(*) from public.compra_lineas y join public.compras z on z.id = y.compra_id where z.localidad_id = l.id and y.reconstruida) as lineas_reconstruidas
from public.compras c join public.localidades l on l.id = c.localidad_id
where c.origen_anterior is not null and c.estado = 'ACTIVA'
group by l.id, l.codigo order by l.codigo;
