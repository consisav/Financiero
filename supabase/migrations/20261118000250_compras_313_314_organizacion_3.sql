-- Script 250 · Organización 3, Mavisa (3-02): reconstruye las compras de medicamentos 313 y 314 del sistema anterior, que no venían en ningún
--   archivo de compras (la exportación al 04-11-2026 llega a la 312 y el lote del 05 al 17-11-2026 no trae ACT_COMPRAS_MED). Sin ellas no entraron
--   2 documentos de liquidación (script 236) y 2 notas de compras quedaron sin su factura (scripts 236 y 243).
--   Datos de los archivos del lote:
--   · Encabezado: la factura recibida de la SAT (CON_DETALLE_ARCHIVOS_FAC, archivo 62 de Mavisa):
--       313 = factura cambiaria serie 9D179685 número 4291251179 del 04-11-2026, VITALIS S.A., Q35,780.00 (autorización 9D179685-FFC7-4BEB-B3ED-8DCA93F35FD6).
--       314 = factura cambiaria serie A17F407E número 4108534719 del 06-11-2026, VITALIS S.A., Q9,250.00 (autorización A17F407E-F4E3-43BF-A22D-6F442E140731).
--   · Detalle: el ingreso al kardex de cada compra (ACT_INVENTARIO_MEDICAMENTOS, documento 313 y 314, bodega 1): productos, lotes, vencimientos,
--     cantidades y costos. Suman exactamente el total de la factura (313: 2,000 + 7,600 + 21,000 + 5,180 = 35,780; 314: 9,250).
--   · Proveedor 1897 (VITALIS), y lo demás (tipo de documento, transacción, clasificación, moneda, régimen, forma de pago y días de crédito)
--     igual que la compra 309 de Mavisa, del mismo proveedor y tipo de documento, que sí se migró (script 89).
--   Cada compra conserva su número (313 y 314; si ya lo usa otra compra, toma el siguiente libre), origen_anterior = 'MEDICAMENTOS' y la marca
--   reconstruida_al_migrar (columna nueva). NO mueve el inventario: el ingreso ya está en el kardex migrado (script 244).
--   Si una compra del sistema ya tiene el mismo proveedor, serie y documento (se ingresó en el sistema nuevo), NO se crea otra: se informa.
--   Después de este script hay que correr de nuevo el 236 (liquidaciones) y el 243 (notas de compras). Se puede ejecutar de nuevo: actualiza.
set lock_timeout = '20s';
alter table public.compras add column if not exists reconstruida_al_migrar boolean not null default false;

do $compras$
declare
  v_org bigint; v_loc bigint; v_base public.compras; v_prov bigint; r record; v_id bigint; v_num int; v_existe bigint;
  c_n int := 0; c_a int := 0; c_ya text := ''; a_n int := 0;
begin
  select id into v_org from public.organizaciones where codigo::text = '3';
  if v_org is null then raise exception 'No existe la organización 3.'; end if;
  select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = 2;
  select * into v_base from public.compras where localidad_id = v_loc and origen_anterior = 'MEDICAMENTOS' and compra_anterior = 309;
  if v_base.id is null then raise exception 'No está la compra 309 de Mavisa (modelo): ejecuta antes los scripts de compras de la organización 3.'; end if;
  select id into v_prov from public.proveedores where localidad_id = v_loc and codigo = 1897;
  if v_prov is null then raise exception 'No existe el proveedor 1897 (VITALIS) en Mavisa.'; end if;

  perform set_config('fin.migracion', 'on', true);
  alter table public.compras disable trigger compras_preparar;

  for r in select * from (values
      (313::integer, '9D179685'::text, '4291251179'::text, date '2026-11-04', date '2026-11-04', 35780.00::numeric, '9D179685-FFC7-4BEB-B3ED-8DCA93F35FD6'::text),
      (314, 'A17F407E', '4108534719', date '2026-11-06', date '2026-11-06', 9250.00, 'A17F407E-F4E3-43BF-A22D-6F442E140731')
    ) as x(compra, serie, documento, fecha_doc, fecha_ing, total, autorizacion) loop
    -- ¿Ya se ingresó en el sistema nuevo? (mismo proveedor, serie y documento, sin ser la compra migrada)
    select c.id into v_existe from public.compras c
    where c.localidad_id = v_loc and c.proveedor_id = v_prov and upper(coalesce(c.serie, '')) = r.serie and c.documento = r.documento
      and (c.origen_anterior is distinct from 'MEDICAMENTOS' or c.compra_anterior is distinct from r.compra) limit 1;
    if v_existe is not null then
      c_ya := c_ya || format(' compra %s (factura %s-%s) ya está en el sistema con id %s;', r.compra, r.serie, r.documento, v_existe);
      continue;
    end if;
    select id into v_id from public.compras where localidad_id = v_loc and origen_anterior = 'MEDICAMENTOS' and compra_anterior = r.compra;
    if v_id is null then
      v_num := case when exists (select 1 from public.compras where localidad_id = v_loc and numero = r.compra)
                    then (select coalesce(max(numero), 0) + 1 from public.compras where localidad_id = v_loc) else r.compra end;
      insert into public.compras (organizacion_id, localidad_id, numero, tipo_documento, tipo_documento_id, serie, documento, fecha_documento, fecha_ingreso,
             fecha_vencimiento, tipo_tercero, proveedor_id, proveedor_codigo, proveedor_nombre, nit, beneficiario, transaccion_id, descripcion, moneda_id,
             tipo_cambio, valor_total, bonificaciones, notas_credito, descuentos_nd, forma_pago, estado, usuario,
             mes_presentacion, anio_presentacion, pago_inmediato, dias_credito, regimen_isr_id, clasificacion_id, bodega_id,
             galones_super, galones_regular, galones_diesel, exento, iva_especial, isr_especial, aplica_inguat, retencion, retencion_valor,
             origen_anterior, compra_anterior, reconstruida_al_migrar)
      values (v_org, v_loc, v_num, v_base.tipo_documento, v_base.tipo_documento_id, r.serie, r.documento, r.fecha_doc, r.fecha_ing,
             r.fecha_doc + coalesce(v_base.dias_credito, 0), v_base.tipo_tercero, v_prov, '1897', v_base.proveedor_nombre, v_base.nit, v_base.beneficiario,
             v_base.transaccion_id, format('COMPRA %s RECONSTRUIDA AL MIGRAR (FACTURA SAT %s, KARDEX DEL SISTEMA ANTERIOR)', r.compra, r.autorizacion), v_base.moneda_id,
             1, r.total, 0, 0, 0, v_base.forma_pago, v_base.estado, 'MIGRACIÓN',
             extract(month from r.fecha_doc)::int, extract(year from r.fecha_doc)::int, v_base.pago_inmediato, coalesce(v_base.dias_credito, 0),
             v_base.regimen_isr_id, v_base.clasificacion_id, (select b.id from public.bodegas b where b.localidad_id = v_loc and b.codigo = 1),
             0, 0, 0, 0, 0, 0, false, false, 0,
             'MEDICAMENTOS', r.compra, true)
      returning id into v_id;
      c_n := c_n + 1;
    else
      update public.compras set serie = r.serie, documento = r.documento, fecha_documento = r.fecha_doc, fecha_ingreso = r.fecha_ing, valor_total = r.total,
        reconstruida_al_migrar = true where id = v_id;
      c_a := c_a + 1;
    end if;
  end loop;
  alter table public.compras enable trigger compras_preparar;

  -- Artículos (del kardex): línea, producto, lote, vencimiento, cantidad y costo unitario.
  alter table public.compra_articulos disable trigger compra_articulos_validar;
  with m (compra, linea, producto, lote, fabrica, vence, cantidad, costo) as (values
      (313::integer, 1::integer, 155::integer, 'L260068'::text, date '2026-08-06', date '2029-08-06', 3000::numeric, 7::numeric),
      (313, 2, 10, 'F260103', date '2026-08-24', date '2028-08-24', 100, 20),
      (313, 3, 13, 'F260080', date '2026-06-26', date '2029-06-26', 500, 15.2),
      (313, 4, 173, 'K260054', date '2026-08-12', date '2029-08-12', 140, 37),
      (314, 1, 27, 'A260117', date '2026-01-27', date '2028-01-27', 370, 25)),
  x as (
    insert into public.compra_articulos (compra_id, linea, producto_id, producto_codigo, producto_anterior, serie, cantidad, costo_unitario, descuento, costo_extra,
           inventario, exento, inventariado, fecha_fabricacion, fecha_vencimiento, control_fecha)
    select c.id, m.linea, p.id, p.codigo_producto, m.producto, m.lote, m.cantidad, m.costo, 0, 0, true, false, true, m.fabrica, m.vence, true
    from m
    join public.compras c on c.localidad_id = v_loc and c.origen_anterior = 'MEDICAMENTOS' and c.compra_anterior = m.compra and c.reconstruida_al_migrar
    left join public.productos p on p.localidad_id = v_loc and p.codigo = m.producto
    on conflict (compra_id, linea) do update set producto_id = excluded.producto_id, producto_codigo = excluded.producto_codigo, producto_anterior = excluded.producto_anterior,
      serie = excluded.serie, cantidad = excluded.cantidad, costo_unitario = excluded.costo_unitario, inventariado = excluded.inventariado,
      fecha_vencimiento = excluded.fecha_vencimiento, control_fecha = excluded.control_fecha
    returning 1)
  select count(*) into a_n from x;
  alter table public.compra_articulos enable trigger compra_articulos_validar;

  raise notice '%', format('Compras de Mavisa reconstruidas: %s nuevas, %s actualizadas; %s artículos.%s Ahora corre de nuevo los scripts 236 y 243.',
    c_n, c_a, a_n, case when c_ya <> '' then ' No se crean porque ya existen en el sistema:' || c_ya else '' end);
end;
$compras$;

notify pgrst, 'reload schema';
