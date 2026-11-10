-- 186 · Resumen contable de subcajas, rápido (reemplaza la vista del script 185).
--   La vista caja_periodos_contable sumaba todas las líneas de todas las organizaciones en cada consulta (con la seguridad por
--   fila, el filtro por caja no llegaba hasta las tablas) y, con muchas líneas migradas, trababa la base de datos.
--   La función caja_resumen_contable recibe las cajas que se ven en pantalla y suma solo sus subcajas por índice.
--   Puede ejecutarse de nuevo.

drop view if exists public.caja_periodos_contable;
create index if not exists caja_periodos_caja_id_idx on public.caja_periodos (caja_id);

create or replace function public.caja_resumen_contable(p_cajas bigint[])
returns table (id bigint, caja_id bigint, lineas integer, debe numeric, haber numeric)
language sql stable security definer set search_path = '' as $$
  select p.id, p.caja_id, coalesce(x.lineas, 0)::integer, coalesce(x.debe, 0)::numeric(18, 2), coalesce(x.haber, 0)::numeric(18, 2)
  from public.caja_periodos p
  left join lateral (select count(*) as lineas, sum(l.debe) as debe, sum(l.haber) as haber
                     from public.caja_lineas l where l.periodo_id = p.id) x on true
  where p.caja_id = any(p_cajas) and public.usuario_activo();
$$;
revoke execute on function public.caja_resumen_contable(bigint[]) from public, anon;
grant execute on function public.caja_resumen_contable(bigint[]) to authenticated;

notify pgrst, 'reload schema';
