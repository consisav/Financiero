-- Disponibilidad bancaria: síntesis de toda la organización en cada generación.
--   Al generar la disponibilidad de una empresa, también se calcula y guarda, a la misma fecha de corte, la
--   disponibilidad de todas las empresas (localidades) de su organización, por empresa y banco
--   (disponibilidad_organizacion). Con los mismos parámetros: el banco elegido se busca por su código en las
--   demás empresas (cada empresa tiene su catálogo de bancos con los mismos códigos); si se eligió una sola
--   cuenta, la síntesis usa su banco. Solo cuentas activas.
--   Queda como fotografía: no cambia aunque después se registren o concilien documentos. Las generaciones
--   anteriores a este script no tienen síntesis.
-- Puede ejecutarse de nuevo. Se ejecuta después del script 118.

create table if not exists public.disponibilidad_organizacion (
  id bigint generated always as identity primary key,
  generacion_id bigint not null references public.disponibilidad_generaciones(id) on delete cascade,
  localidad_id bigint references public.localidades(id),
  localidad_codigo text,
  localidad_nombre text,
  banco_codigo integer,
  banco_nombre text,
  cuentas integer not null default 0,
  saldo_ml numeric(18, 2) not null default 0,
  circulacion_ml numeric(18, 2) not null default 0,
  estimado_ml numeric(18, 2) not null default 0,
  minimo_ml numeric(18, 2) not null default 0,
  bajo_minimo integer not null default 0
);
create index if not exists disponibilidad_organizacion_gen on public.disponibilidad_organizacion (generacion_id);
alter table public.disponibilidad_organizacion enable row level security;
drop policy if exists "disponibilidad_organizacion: leer" on public.disponibilidad_organizacion;
create policy "disponibilidad_organizacion: leer" on public.disponibilidad_organizacion for select to authenticated using (public.usuario_activo());
grant select on public.disponibilidad_organizacion to authenticated;

alter table public.disponibilidad_generaciones add column if not exists org_saldo_ml numeric(18, 2);
alter table public.disponibilidad_generaciones add column if not exists org_circulacion_ml numeric(18, 2);
alter table public.disponibilidad_generaciones add column if not exists org_estimado_ml numeric(18, 2);
alter table public.disponibilidad_generaciones add column if not exists org_cuentas integer;
alter table public.disponibilidad_generaciones add column if not exists org_bajo_minimo integer;
alter table public.disponibilidad_generaciones add column if not exists org_empresas integer;

-- Síntesis de la organización de una generación ya guardada (la usa generar_disponibilidad).
create or replace function public.sintetizar_disponibilidad(p_gen bigint)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  g record; v_banco integer;
begin
  select * into g from public.disponibilidad_generaciones where id = p_gen;
  if g.id is null then return; end if;
  v_banco := coalesce((select b.codigo from public.bancos b where b.id = g.banco_id),
                      (select b.codigo from public.cuentas_bancarias cb join public.bancos b on b.id = cb.banco_id where cb.id = g.cuenta_bancaria_id));
  delete from public.disponibilidad_organizacion where generacion_id = p_gen;
  insert into public.disponibilidad_organizacion (generacion_id, localidad_id, localidad_codigo, localidad_nombre, banco_codigo, banco_nombre, cuentas, saldo_ml, circulacion_ml, estimado_ml, minimo_ml, bajo_minimo)
  select p_gen, x.loc, x.loc_codigo, x.loc_nombre, x.b_codigo, x.b_nombre, count(*),
         coalesce(sum(round(x.saldo * x.tc, 2)), 0), coalesce(sum(round((x.ci - x.ce) * x.tc, 2)), 0), coalesce(sum(round((x.saldo + x.ce - x.ci) * x.tc, 2)), 0),
         coalesce(sum(round(x.minimo * x.tc, 2)), 0), count(*) filter (where x.saldo < x.minimo)
  from (
    select l.id as loc, l.codigo as loc_codigo, l.nombre_comercial as loc_nombre, b.codigo as b_codigo, b.nombre as b_nombre, coalesce(cb.saldo_minimo, 0) as minimo,
           case when m.iso = 'GTQ' then 1 else coalesce((select t.valor_venta from public.tipos_cambio t where t.moneda_id = m.id and t.fecha <= g.fecha_corte order by t.fecha desc limit 1), 1) end as tc,
           cb.saldo_inicial + coalesce(mv.ing, 0) - coalesce(mv.egr, 0) as saldo, coalesce(mv.ci, 0) as ci, coalesce(mv.ce, 0) as ce
    from public.cuentas_bancarias cb
    join public.localidades l on l.id = cb.localidad_id
    join public.bancos b on b.id = cb.banco_id
    join public.monedas m on m.id = cb.moneda_id
    left join lateral (
      select sum(valor_cuenta) filter (where tipo in ('DEPOSITO', 'NOTA_CREDITO')) as ing, sum(valor_cuenta) filter (where tipo in ('NOTA_DEBITO', 'CHEQUE')) as egr,
             sum(valor_cuenta) filter (where tipo in ('DEPOSITO', 'NOTA_CREDITO') and not conciliado) as ci, sum(valor_cuenta) filter (where tipo in ('NOTA_DEBITO', 'CHEQUE') and not conciliado) as ce
      from public.movimientos_bancarios mb
      where mb.cuenta_bancaria_id = cb.id and mb.estado = 'ACTIVO' and mb.fecha >= cb.fecha_saldo_inicial and mb.fecha <= g.fecha_corte
    ) mv on true
    where l.organizacion_id = g.organizacion_id and cb.activo and (v_banco is null or b.codigo = v_banco)
  ) x
  group by x.loc, x.loc_codigo, x.loc_nombre, x.b_codigo, x.b_nombre;
  update public.disponibilidad_generaciones s set
    org_saldo_ml = y.s, org_circulacion_ml = y.c, org_estimado_ml = y.e, org_cuentas = y.n, org_bajo_minimo = y.bajo, org_empresas = y.emp
  from (select coalesce(sum(saldo_ml), 0) s, coalesce(sum(circulacion_ml), 0) c, coalesce(sum(estimado_ml), 0) e, coalesce(sum(cuentas), 0) n,
               coalesce(sum(bajo_minimo), 0) bajo, count(distinct localidad_id) emp
        from public.disponibilidad_organizacion where generacion_id = p_gen) y
  where s.id = p_gen;
end;
$$;
revoke all on function public.sintetizar_disponibilidad(bigint) from public;

-- generar_disponibilidad (script 117) ahora agrega la síntesis de la organización.
do $$
declare v_src text;
begin
  select pg_get_functiondef('public.generar_disponibilidad(bigint, bigint, bigint, date)'::regprocedure) into v_src;
  if position('sintetizar_disponibilidad' in v_src) > 0 then raise notice 'generar_disponibilidad ya incluía la síntesis.'; return; end if;
  v_src := replace(v_src, '  return jsonb_build_object(''id'', v_id, ''correlativo'', v_corr);',
                          '  perform public.sintetizar_disponibilidad(v_id);' || chr(10) || '  return jsonb_build_object(''id'', v_id, ''correlativo'', v_corr);');
  if position('sintetizar_disponibilidad' in v_src) = 0 then raise exception 'No se pudo agregar la síntesis a generar_disponibilidad: ejecuta antes el script 117.'; end if;
  execute v_src;
  raise notice 'generar_disponibilidad agrega la síntesis de la organización.';
end;
$$;
grant execute on function public.generar_disponibilidad(bigint, bigint, bigint, date) to authenticated;

notify pgrst, 'reload schema';
