-- Lote del 05-11 al 17-11-2026 («Datos Tecnoasla - AAPOS del 05-11-2026 al 17-11-2026»): mismo proceso del script 229, solo con los registros de este lote.
-- Script 276 · parte 1 de 2 · Organización 4 (TECNOALSA): detalle de las compras varias (ACT_DETALLE_COMPRAS_VARIAS.xlsx), 26 líneas.
-- Se ejecuta después del script 229 (compras). Se puede ejecutar de nuevo: la segunda vez solo actualiza.
alter table public.compra_items add column if not exists cantidad_anterior numeric;
alter table public.compra_items add column if not exists costo_total_anterior numeric;
set lock_timeout = '20s';

do $items$
declare v_org bigint; v_n int := 0; v_a int := 0; v_sin int;
begin
  select id into v_org from public.organizaciones where codigo::text = '4';
  if v_org is null then raise exception 'No existe la organización 4.'; end if;
  -- La validación de la pantalla (no se cambia el detalle de una compra anulada) se suspende durante la carga.
  alter table public.compra_items disable trigger compra_items_validar;
  with m (loc, compra, linea, descripcion, cantidad, cantidad_ant, costo, costo_ant) as (values
      (1::integer, 1992::integer, 1::integer, 'COMPRAS VARIAS'::text, 1::numeric, null::numeric, 17068.78::numeric, null::numeric),
      (1, 1993, 1, 'COMPRAS VARIAS', 1, null, 1735.24, null),
      (1, 1994, 1, 'COMPRAS VARIAS', 1, null, 1900, null),
      (1, 1995, 1, 'COMPRAS VARIAS', 1, null, 17316.48, null),
      (1, 1996, 1, 'COMPRAS VARIAS', 1, null, 1066.95, null),
      (1, 1997, 1, 'COMPRAS VARIAS', 1, null, 2947.37, null),
      (1, 1998, 1, 'COMPRAS VARIAS', 1, null, 1750, null),
      (1, 1999, 1, 'COMPRAS VARIAS', 1, null, 4860, null),
      (1, 2000, 1, 'COMPRAS VARIAS', 1, null, 500, null),
      (1, 2001, 1, 'CONTROLADOR DIGITAL - TEMPERATURA/TIEMPO (INOVA-VERSION 2) LOC', 1, null, 2250, null),
      (1, 2002, 1, 'COMPRAS VARIAS', 1, null, 8434.43, null),
      (1, 2003, 1, 'COMPRAS VARIAS', 1, null, 1330, null),
      (1, 2004, 1, 'COMPRAS VARIAS', 1, null, 1496.32, null),
      (1, 2005, 1, 'COMPRAS VARIAS', 1, null, 1250, null),
      (1, 2006, 1, 'COMPRAS VARIAS', 1, null, 400, null),
      (1, 2007, 1, 'COMPRAS VARIAS', 1, null, 1200, null),
      (1, 2008, 1, 'COMPRAS VARIAS', 1, null, 1071.8, null),
      (1, 2009, 1, 'COMPRAS VARIAS', 1, null, 1544.28, null),
      (1, 2010, 1, 'COMPRAS VARIAS', 1, null, 1155, null),
      (1, 2011, 1, 'COMPRAS VARIAS', 1, null, 458.9, null),
      (1, 2012, 1, 'COMPRAS VARIAS', 1, null, 412.63, null),
      (1, 2013, 1, 'COMPRAS VARIAS', 1, null, 1544.28, null),
      (1, 2014, 1, 'CAMARA DE FERMENTACION DE LUEDO INOX, DE 40 BANDEJAS 46X66, ELECTRICA 5KW, DIGITAL DE 220V NO INCLUYE CARRO', 1, null, 40550, null),
      (1, 2015, 1, 'PALANCA EXPULSORA IZQUIERDA - LADO TRASERO', 1, null, 3503.12, null),
      (1, 2015, 2, 'PALANCA EXPULSORA DERECHA', 1, null, 3503.12, null),
      (1, 2016, 1, 'COMPRAS VARIAS', 1, null, 6423.58, null)),
  x as (
    insert into public.compra_items (compra_id, linea, descripcion, cantidad, costo_total, cantidad_anterior, costo_total_anterior)
    select c.id, m.linea, m.descripcion, m.cantidad, m.costo, m.cantidad_ant, m.costo_ant
    from m join public.localidades l on l.organizacion_id = v_org and l.correlativo = m.loc
    join public.compras c on c.localidad_id = l.id and c.origen_anterior = 'VARIAS' and c.compra_anterior = m.compra
    on conflict (compra_id, linea) do update set descripcion = excluded.descripcion, cantidad = excluded.cantidad, costo_total = excluded.costo_total,
      cantidad_anterior = excluded.cantidad_anterior, costo_total_anterior = excluded.costo_total_anterior
    returning (xmax = 0) as nueva)
  select count(*) filter (where nueva), count(*) filter (where not nueva), (select count(*) from m) - count(*) into v_n, v_a, v_sin from x;
  alter table public.compra_items enable trigger compra_items_validar;
  raise notice '%', format('Detalle de compras de la organización 4 (parte 1 de 2): %s líneas nuevas, %s actualizadas.%s', v_n, v_a,
    case when v_sin > 0 then format(' %s líneas de compras que no existen (omitidas: ejecuta antes el script 229).', v_sin) else '' end);
end;
$items$;
