-- Fecha del saldo inicial de las cuentas bancarias de la organización 3 (Futura Farma - Mavisa).
-- Las cuentas se crearon con «Saldo inicial al 05/11/2026» y todos sus movimientos migrados (cheques, notas
-- y depósitos de 2004 a 2026) son anteriores, por eso el sistema no los contaba: el saldo, la disponibilidad
-- y el «saldo en el sistema» de la conciliación salían en 0.
--   Cada cuenta pasa a tener como fecha del saldo inicial el día anterior a su primer movimiento. El saldo
--   inicial se conserva (hoy 0 en todas): si se conoce el saldo real de apertura, se escribe después en
--   Bancos · Cuentas bancarias (campo «Saldo inicial»).
--   Solo cambia las cuentas cuyo primer movimiento es anterior a su fecha actual. Puede ejecutarse de nuevo.
-- Se ejecuta después del script 117.
do $$
declare
  r record; n int := 0;
begin
  for r in
    select cb.id, l.codigo, cb.numero, cb.fecha_saldo_inicial as antes, cb.saldo_inicial, (min(m.fecha) - 1) as nueva, count(m.id) as movs
    from public.cuentas_bancarias cb
    join public.localidades l on l.id = cb.localidad_id
    join public.organizaciones o on o.id = cb.organizacion_id
    join public.movimientos_bancarios m on m.cuenta_bancaria_id = cb.id
    where o.codigo = '3'
    group by cb.id, l.codigo, cb.numero, cb.fecha_saldo_inicial, cb.saldo_inicial
    having min(m.fecha) <= cb.fecha_saldo_inicial
    order by l.codigo, cb.numero
  loop
    update public.cuentas_bancarias set fecha_saldo_inicial = r.nueva where id = r.id;
    n := n + 1;
    raise notice '%', format('%s %s: saldo inicial al %s (antes %s), saldo inicial %s, %s movimientos.', r.codigo, r.numero, to_char(r.nueva, 'DD/MM/YYYY'), to_char(r.antes, 'DD/MM/YYYY'), r.saldo_inicial, r.movs);
  end loop;
  raise notice 'Cuentas ajustadas: %.', n;
end;
$$;

notify pgrst, 'reload schema';
