-- Diagnóstico desde la sesión de la aplicación (no cambia datos): con qué rol, usuario y base de datos lee la
-- aplicación, y cuántos movimientos de inventario ve desde ahí (con sus permisos) y en total (sin restricciones).
create or replace function public.diagnostico_inventario_total() returns bigint
language sql stable security definer set search_path = '' as $$ select count(*) from public.inventario_movimientos $$;
create or replace function public.diagnostico_inventario() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'rol', current_user,
    'usuario', (select auth.uid()),
    'base', current_database(),
    'movimientos_que_ve', (select count(*) from public.inventario_movimientos),
    'documentos_que_ve', (select count(*) from public.documentos_inventario),
    'movimientos_total', public.diagnostico_inventario_total(),
    'tablas', (select string_agg(n.nspname || '.' || c.relname || ' (' || c.relkind::text || ', rls ' || c.relrowsecurity::text || ', forzado ' || c.relforcerowsecurity::text || ')', '; ')
               from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relname = 'inventario_movimientos'),
    'reglas', (select string_agg(policyname || ' ' || permissive || ' ' || cmd || ' ' || array_to_string(roles, ',') || ': ' || coalesce(qual, ''), ' | ') from pg_policies where tablename = 'inventario_movimientos')
  );
$$;
grant execute on function public.diagnostico_inventario() to authenticated;
grant execute on function public.diagnostico_inventario_total() to authenticated;
notify pgrst, 'reload schema';
select public.diagnostico_inventario() as resultado_como_administrador;
