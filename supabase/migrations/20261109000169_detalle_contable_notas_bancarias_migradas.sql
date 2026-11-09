-- 169 · Detalle contable de las notas de crédito y débito bancarias migradas que no lo traían.
--   El script 112 migró 3,860 notas de la organización 3 (CON_NOTAS_CREDITO_DEBITO.xls), pero el archivo del
--   detalle (CON_DETCON_NOTAS.xls) solo traía el de 399 notas (809 líneas). Este script arma el de las demás
--   con el mismo modelo que tienen las 399 notas que sí lo traen:
--     * nota de crédito: DEBE la cuenta contable del banco y HABER la contrapartida, por el valor en quetzales;
--     * nota de débito:  DEBE la contrapartida y HABER la cuenta contable del banco.
--   Cuenta del banco: la que usan las notas de la misma cuenta bancaria que traían detalle (las del grupo
--   1010 1 0x de bancos). Si la cuenta bancaria no tiene ninguna nota con detalle, la cuenta contable de la
--   cuenta bancaria, buscada por su código en el catálogo de las notas migradas de la empresa.
--   Contrapartida:
--     * con transacción: la que más usan las notas migradas de esa transacción que traían detalle; si ninguna
--       la trae, la cuenta de la transacción que no es de bancos;
--     * sin transacción: 1010201001 CLIENTES MEDICAMENTOS si la nota es de un cliente, 2010101001 PROVEEDORES
--       DE MEDICAMENTOS si es de un proveedor (código buscado en el catálogo de las notas migradas de la empresa).
--   Las notas sin cuenta de banco o sin contrapartida (por ejemplo, sin transacción ni cliente ni proveedor) se
--   dejan sin detalle y se listan en el aviso final.
--   Nota en dólares (tipo de cambio distinto de 1): el valor en dólares queda en debe_mi / haber_mi.
--   Solo se arman las notas migradas activas, sin partida y sin ninguna línea contable. Las líneas armadas llevan
--   usuario_ingresa_anterior = 'GENERADA EN LA MIGRACIÓN': si el script se ejecuta de nuevo se rehacen esas (solo
--   actualiza); el detalle del sistema anterior o hecho en este sistema no se toca.

do $migra$
declare
  v_borradas int; v_notas int; v_lineas int; v_sin text; v_nsin int;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'movimientos_bancarios' and column_name = 'nota_anterior') then
    raise exception 'Falta ejecutar el script 112 (notas de crédito y débito de la organización 3).';
  end if;
  perform set_config('fin.migracion', 'on', true);

  -- Se rehace lo generado antes por este script.
  delete from public.movimiento_lineas d using public.movimientos_bancarios n
   where d.movimiento_id = n.id and n.nota_anterior is not null and n.partida_id is null
     and d.usuario_ingresa_anterior = 'GENERADA EN LA MIGRACIÓN';
  get diagnostics v_borradas = row_count;

  -- Detalle que sí vino del sistema anterior: lado del banco y contrapartida.
  drop table if exists _d169;
  create temp table _d169 as
  select n.id, n.localidad_id, n.cuenta_bancaria_id, n.transaccion_id, n.tipo, d.cuenta_id, k.codigo, k.catalogo_id,
         ((n.tipo = 'NOTA_CREDITO' and d.debe > 0) or (n.tipo = 'NOTA_DEBITO' and d.haber > 0)) and k.codigo like '10101%' as banco
  from public.movimientos_bancarios n
  join public.movimiento_lineas d on d.movimiento_id = n.id
  join public.cuentas k on k.id = d.cuenta_id
  where n.nota_anterior is not null and coalesce(d.usuario_ingresa_anterior, '') <> 'GENERADA EN LA MIGRACIÓN';

  -- Catálogo de las notas migradas de cada empresa (para buscar cuentas por código).
  drop table if exists _cat169;
  create temp table _cat169 as
  select distinct on (localidad_id) localidad_id, catalogo_id from _d169 group by 1, 2 order by localidad_id, count(*) desc;

  drop table if exists _n169;
  create temp table _n169 as
  select n.id, n.tipo, n.valor_ml, n.tipo_cambio, n.valor_mi,
    coalesce(
      (select d.cuenta_id from _d169 d where d.cuenta_bancaria_id = n.cuenta_bancaria_id and d.banco group by 1 order by count(*) desc limit 1),
      (select k2.id from public.cuentas kb join public.cuentas k2 on k2.codigo = kb.codigo
         join _cat169 c on c.localidad_id = n.localidad_id and c.catalogo_id = k2.catalogo_id
        where kb.id = cb.cuenta_id and kb.codigo like '10101%' limit 1)) as c_banco,
    case when n.transaccion_id is not null then coalesce(
      (select d.cuenta_id from _d169 d where d.transaccion_id = n.transaccion_id and d.localidad_id = n.localidad_id and not d.banco
         and d.codigo not like '10101%' group by 1 order by count(*) desc limit 1),
      (select t.cuenta_id from public.transaccion_cuentas t join public.cuentas k on k.id = t.cuenta_id
        where t.transaccion_id = n.transaccion_id and k.codigo not like '10101%' order by t.linea limit 1))
    when n.tipo = 'NOTA_CREDITO' and n.tipo_tercero = 'CLIENTE' and n.tercero_codigo is not null then
      (select k.id from public.cuentas k join _cat169 c on c.catalogo_id = k.catalogo_id and c.localidad_id = n.localidad_id where k.codigo = '1010201001' limit 1)
    when n.tipo = 'NOTA_DEBITO' and n.tipo_tercero like 'PROVEEDOR%' and n.tercero_codigo is not null then
      (select k.id from public.cuentas k join _cat169 c on c.catalogo_id = k.catalogo_id and c.localidad_id = n.localidad_id where k.codigo = '2010101001' limit 1)
    end as c_contra
  from public.movimientos_bancarios n
  join public.cuentas_bancarias cb on cb.id = n.cuenta_bancaria_id
  where n.nota_anterior is not null and n.estado = 'ACTIVO' and n.partida_id is null and n.valor_ml > 0
    and n.tipo in ('NOTA_CREDITO', 'NOTA_DEBITO')
    and not exists (select 1 from public.movimiento_lineas d where d.movimiento_id = n.id);

  insert into public.movimiento_lineas (movimiento_id, linea, cuenta_id, debe, haber, debe_mi, haber_mi, usuario_ingresa_anterior)
  select x.id, l.linea, l.cuenta_id,
         case when l.debe then x.valor_ml else 0 end, case when l.debe then 0 else x.valor_ml end,
         case when l.debe and x.dolar then x.mi end, case when not l.debe and x.dolar then x.mi end,
         'GENERADA EN LA MIGRACIÓN'
  from (select n.*, coalesce(n.tipo_cambio, 1) <> 1 as dolar,
               coalesce(nullif(n.valor_mi, 0), round(n.valor_ml / nullif(n.tipo_cambio, 0), 2)) as mi
        from _n169 n where n.c_banco is not null and n.c_contra is not null) x
  cross join lateral (values
    (1, case when x.tipo = 'NOTA_CREDITO' then x.c_banco else x.c_contra end, true),
    (2, case when x.tipo = 'NOTA_CREDITO' then x.c_contra else x.c_banco end, false)) as l(linea, cuenta_id, debe);
  get diagnostics v_lineas = row_count;
  v_notas := v_lineas / 2;

  select count(*), string_agg(m.tipo || ' ' || m.folio || ' (' || l.codigo || case when s.c_banco is null then ', sin cuenta de banco' else ', sin contrapartida' end || ')', '; ')
    into v_nsin, v_sin
  from _n169 s join public.movimientos_bancarios m on m.id = s.id join public.localidades l on l.id = m.localidad_id
  where s.c_banco is null or s.c_contra is null;

  raise notice 'Notas con detalle armado: % (% líneas; % líneas generadas antes rehechas). Sin armar: %.', v_notas, v_lineas, v_borradas, v_nsin;
  if v_sin is not null then raise notice 'Sin armar: %', v_sin; end if;
end;
$migra$;
