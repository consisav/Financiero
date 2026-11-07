-- Eliminar cuentas contables (y centros de costo) solo si no tienen hijas ni ninguna referencia.
--   1. referencias_catalogo(tabla, id): cuántas filas de cada tabla apuntan al registro. Recorre TODAS las llaves
--      foráneas de la base de datos que llegan a la tabla (movimientos contables, partidas, cajas, compras, bancos,
--      presupuesto, objetos contables…, y la propia tabla: las sub-cuentas). Se calcula del catálogo de Postgres,
--      así que una tabla nueva que apunte a cuentas también se revisa sin cambiar este script.
--   2. eliminar_registro_catalogo(tabla, id): elimina la cuenta o el centro solo si no tiene ninguna referencia;
--      si tiene, no elimina y dice dónde se usa. Solo un administrador (puede_editar_catalogos).
--   Solo se aceptan las tablas «cuentas» y «centros_costo». Puede ejecutarse de nuevo.

create or replace function public.referencias_catalogo(p_tabla text, p_id bigint)
returns table (tabla text, columna text, filas bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  r record;
  n bigint;
begin
  if p_tabla not in ('cuentas', 'centros_costo') then raise exception 'Tabla no permitida: %', p_tabla; end if;
  if not public.usuario_activo() then raise exception 'Usuario sin acceso.'; end if;
  for r in
    select c.conrelid::regclass::text as t, a.attname::text as col,
           (c.conrelid = c.confrelid) as propia
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = format('public.%I', p_tabla)::regclass and cardinality(c.conkey) = 1
  loop
    execute format('select count(*) from %s where %I = $1', r.t, r.col) into n using p_id;
    if n > 0 then
      tabla := case when r.propia then case p_tabla when 'cuentas' then 'sub-cuentas' else 'sub-centros' end else replace(r.t, 'public.', '') end;
      columna := r.col; filas := n;
      return next;
    end if;
  end loop;
end;
$$;

create or replace function public.eliminar_registro_catalogo(p_tabla text, p_id bigint)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_usos text;
  v_codigo text;
begin
  if p_tabla not in ('cuentas', 'centros_costo') then raise exception 'Tabla no permitida: %', p_tabla; end if;
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador elimina registros del catálogo.'; end if;
  execute format('select codigo from public.%I where id = $1', p_tabla) into v_codigo using p_id;
  if v_codigo is null then raise exception 'El registro ya no existe.'; end if;
  select string_agg(format('%s (%s)', x.tabla, x.filas), ', ') into v_usos from public.referencias_catalogo(p_tabla, p_id) x;
  if v_usos is not null then
    raise exception 'No se puede eliminar % porque se usa en: %.', v_codigo, v_usos;
  end if;
  execute format('delete from public.%I where id = $1', p_tabla) using p_id;
  return v_codigo;
end;
$$;

revoke all on function public.referencias_catalogo(text, bigint) from public, anon;
revoke all on function public.eliminar_registro_catalogo(text, bigint) from public, anon;
grant execute on function public.referencias_catalogo(text, bigint) to authenticated;
grant execute on function public.eliminar_registro_catalogo(text, bigint) to authenticated;

notify pgrst, 'reload schema';
