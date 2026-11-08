-- Inventarios: la aplicación no podía leer los movimientos de inventario (el kardex y los vencimientos salían
-- vacíos aunque los 30,261 movimientos migrados están en la base). Se dejan las reglas de lectura como las define
-- el sistema: cualquier usuario activo lee los movimientos y los documentos de inventario. Los movimientos solo se
-- crean, cambian o borran desde las funciones del sistema (operar documentos, compras, facturas), que no dependen
-- de estas reglas.
-- Se ejecuta después del script 147. Al final muestra las reglas que quedaron, si OASTURIAS está activo y los movimientos.

-- Movimientos de inventario: se quitan todas sus reglas y queda solo la de lectura.
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'inventario_movimientos' loop
    execute format('drop policy %I on public.inventario_movimientos', r.policyname);
  end loop;
end;
$$;
alter table public.inventario_movimientos enable row level security;
create policy "inventario_movimientos: leer" on public.inventario_movimientos for select to authenticated using (public.usuario_activo());
grant select on public.inventario_movimientos to authenticated;

-- Catálogo de tipos de movimiento y documentos de inventario: lectura para usuarios activos.
do $$
declare t text;
begin
  foreach t in array array['tipos_movimiento_inventario', 'documentos_inventario', 'documento_inventario_lineas', 'motivos_ajuste'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end;
$$;

-- Existencias (vista sobre los movimientos).
grant select on public.existencias to authenticated;

notify pgrst, 'reload schema';

-- Comprobación: reglas que quedaron en la tabla y si el usuario OASTURIAS está activo.
select (select string_agg(policyname || ' [' || cmd || ']', ', ') from pg_policies where tablename = 'inventario_movimientos') as reglas,
       (select activo::text from public.perfiles where upper(usuario) = 'OASTURIAS' limit 1) as oasturias_activo,
       (select count(*) from public.inventario_movimientos) as movimientos_en_la_base;
