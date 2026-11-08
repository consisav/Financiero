-- Corrección: todo usuario que entra a la aplicación (sin importar su rol) puede LEER los movimientos de inventario
-- y la existencia. Crear, cambiar o borrar movimientos sigue siendo solo desde las funciones del sistema.
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'inventario_movimientos' loop
    execute format('drop policy %I on public.inventario_movimientos', r.policyname);
  end loop;
end;
$$;
create policy "inventario_movimientos: leer" on public.inventario_movimientos for select to authenticated using (true);
grant select on public.inventario_movimientos to authenticated;
grant select on public.existencias to authenticated;
notify pgrst, 'reload schema';
-- Resultado esperado: una sola regla «inventario_movimientos: leer», SELECT, condición true; y 30,261 o más movimientos.
select policyname as regla, cmd as tipo, qual as condicion, (select count(*) from public.inventario_movimientos) as movimientos
from pg_policies where tablename = 'inventario_movimientos';
