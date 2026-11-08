-- Lectura de los movimientos de inventario para todos los usuarios de la aplicación, sin borrar nada:
-- solo se AGREGA una regla de lectura (las reglas de lectura se suman: con esta basta para ver los movimientos).
create policy "inventario_movimientos: leer todos" on public.inventario_movimientos for select to authenticated using (true);
grant select on public.inventario_movimientos to authenticated;
grant select on public.existencias to authenticated;
select policyname as regla, cmd as tipo, permissive as clase, qual as condicion from pg_policies where tablename = 'inventario_movimientos';
