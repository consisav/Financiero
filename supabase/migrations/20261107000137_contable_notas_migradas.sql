-- Detalle contable de las notas electrónicas migradas que no lo traían del sistema anterior (el archivo
-- «CAR_DETCON_NOTAS_ELECT.xls» solo tenía el de una nota). Se ejecuta después del script 136.
--   Modelo: el de la transacción 1007 «Devoluciones y rebajas sobre ventas» y el de la nota que sí trae contable:
--     nota de crédito o de abono: debe Venta de medicamentos (4010101001) el subtotal, debe IVA débito fiscal (2010201001)
--     el IVA (solo si la nota no es exenta) y haber Clientes medicamentos (1010201001) el total;
--     nota de débito: al revés.
--   Cuentas del catálogo versión 1 de la empresa (el de las facturas migradas); montos MI = monto / valor de cambio.
--   Las líneas generadas llevan el concepto «GENERADA EN LA MIGRACIÓN»: si el script se ejecuta de nuevo se rehacen
--   (solo actualiza); las notas con contable del sistema anterior o hecho en este sistema no se tocan.

do $$
declare v_borradas int; v_notas int; v_lineas int; v_sin text;
begin
  if to_regclass('public.notas_venta') is null then raise exception 'Falta ejecutar el script 134 (notas electrónicas).'; end if;

  delete from public.nota_venta_contable c using public.notas_venta n
  where c.nota_id = n.id and n.origen_anterior = 'MIGRADO' and c.concepto = 'GENERADA EN LA MIGRACIÓN';
  get diagnostics v_borradas = row_count;

  drop table if exists _n137;
  create temp table _n137 as
  select n.id, n.tipo, n.valor, coalesce(nullif(n.tipo_cambio, 0), 1) tc,
    case when n.exento_iva then 0 else round(n.valor * 12 / 112, 2) end iva,
    (select k.id from public.cuentas k join public.catalogos_cuentas g on g.id = k.catalogo_id where g.localidad_id = n.localidad_id and k.codigo = '4010101001' order by (g.version = 1) desc, g.activo desc, g.version limit 1) c_venta,
    (select k.id from public.cuentas k join public.catalogos_cuentas g on g.id = k.catalogo_id where g.localidad_id = n.localidad_id and k.codigo = '2010201001' order by (g.version = 1) desc, g.activo desc, g.version limit 1) c_iva,
    (select k.id from public.cuentas k join public.catalogos_cuentas g on g.id = k.catalogo_id where g.localidad_id = n.localidad_id and k.codigo = '1010201001' order by (g.version = 1) desc, g.activo desc, g.version limit 1) c_cliente
  from public.notas_venta n
  where n.origen_anterior = 'MIGRADO' and n.valor > 0 and not exists (select 1 from public.nota_venta_contable c where c.nota_id = n.id);

  select string_agg(id::text, ', ') into v_sin from _n137 where c_venta is null or c_cliente is null or (iva > 0 and c_iva is null);
  delete from _n137 where c_venta is null or c_cliente is null or (iva > 0 and c_iva is null);

  insert into public.nota_venta_contable (nota_id, linea, cuenta_id, concepto, debe, haber, debe_mi, haber_mi)
  select id, l.linea, l.cuenta, 'GENERADA EN LA MIGRACIÓN', l.debe, l.haber, round(l.debe / tc, 2), round(l.haber / tc, 2)
  from _n137 n
  cross join lateral (values
    (1, n.c_venta,   case when n.tipo = 'DÉBITO' then 0 else n.valor - n.iva end, case when n.tipo = 'DÉBITO' then n.valor - n.iva else 0 end),
    (2, n.c_iva,     case when n.tipo = 'DÉBITO' then 0 else n.iva end,           case when n.tipo = 'DÉBITO' then n.iva else 0 end),
    (3, n.c_cliente, case when n.tipo = 'DÉBITO' then n.valor else 0 end,         case when n.tipo = 'DÉBITO' then 0 else n.valor end)
  ) as l(linea, cuenta, debe, haber)
  where l.debe > 0 or l.haber > 0;
  get diagnostics v_lineas = row_count;
  select count(*) into v_notas from _n137;
  drop table _n137;

  raise notice '%', format('Detalle contable generado: %s notas, %s líneas (rehechas %s líneas de una ejecución anterior).', v_notas, v_lineas, v_borradas);
  if v_sin is not null then raise notice 'Notas sin las cuentas 4010101001, 2010201001 o 1010201001 en su catálogo (sin contable): %.', v_sin; end if;
end;
$$;
