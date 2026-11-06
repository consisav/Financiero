-- Caja y Bancos · Bancos · Disponibilidad bancaria como proceso con histórico, y Consulta de Disponibilidad.
--   1. Siglas de cada localidad (empresa): se usan en el correlativo. Se llenan con las iniciales del nombre
--      comercial (MAVISA, S. A. = MSA; una sola palabra: sus tres primeras letras) y se corrigen en
--      Catálogos · Organizaciones.
--   2. disponibilidad_generaciones: cada vez que se presiona «Generar disponibilidad» queda un registro con
--      su correlativo SIGLAS-AÑO-MES-NÚMERO (p. ej. MSA-2026-11-0003; el número empieza en 1 cada mes y por
--      empresa), los parámetros (banco, cuenta, fecha de corte), los totales y el usuario que la generó con
--      la fecha y hora. disponibilidad_detalle guarda cada cuenta tal como quedó: no cambia aunque después
--      se registren o concilien documentos.
--   3. generar_disponibilidad(empresa, banco, cuenta, fecha): calcula y guarda la generación (banco y cuenta
--      nulos = todos). Por cuenta: saldo inicial, ingresos y egresos hasta la fecha, saldo en su moneda y en
--      quetzales (tipo de cambio de venta a la fecha), lo que está en circulación sin conciliar y el saldo
--      mínimo. Disponible = saldo en libros (ya descuenta lo emitido); la pantalla muestra además el saldo
--      estimado en el banco (saldo + egresos en circulación − ingresos en circulación) y lo que queda sobre el mínimo.
--   4. Opción «Consulta de Disponibilidad» debajo de «Disponibilidad bancaria», con los permisos de ver e
--      imprimir que cada rol ya tiene en esa opción.
-- Puede ejecutarse de nuevo. Se ejecuta después del script 116.

-- 1. Siglas de la localidad.
alter table public.localidades add column if not exists siglas text;
update public.localidades l set siglas = x.s
from (
  select id, case when array_length(p, 1) > 1 then upper(array_to_string(array(select left(w, 1) from unnest(p) w), ''))
                  else upper(left(coalesce(p[1], codigo), 3)) end as s
  from (select id, codigo, array_remove(regexp_split_to_array(regexp_replace(upper(nombre_comercial), '[^A-ZÁÉÍÓÚÑ0-9 ]', ' ', 'g'), '\s+'), '') as p from public.localidades) q
) x
where x.id = l.id and (l.siglas is null or l.siglas = '');
comment on column public.localidades.siglas is 'Siglas de la empresa para los correlativos (p. ej. MSA en MSA-2026-11-0003).';

-- 2. Histórico.
create table if not exists public.disponibilidad_generaciones (
  id bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones(id),
  localidad_id bigint not null references public.localidades(id),
  correlativo text not null unique,
  anio integer not null,
  mes integer not null check (mes between 1 and 12),
  numero integer not null,
  fecha_corte date not null,
  banco_id bigint references public.bancos(id),
  cuenta_bancaria_id bigint references public.cuentas_bancarias(id),
  banco_nombre text,
  cuenta_numero text,
  cuentas integer not null default 0,
  bajo_minimo integer not null default 0,
  total_saldo_ml numeric(18, 2) not null default 0,
  total_circulacion_ml numeric(18, 2) not null default 0,
  total_disponible_ml numeric(18, 2) not null default 0,
  observaciones text,
  generado_por uuid,
  usuario text,
  usuario_nombre text,
  generado_en timestamptz not null default now(),
  unique (localidad_id, anio, mes, numero)
);
create index if not exists disponibilidad_generaciones_loc on public.disponibilidad_generaciones (localidad_id, generado_en desc);

create table if not exists public.disponibilidad_detalle (
  id bigint generated always as identity primary key,
  generacion_id bigint not null references public.disponibilidad_generaciones(id) on delete cascade,
  orden integer not null default 0,
  cuenta_bancaria_id bigint references public.cuentas_bancarias(id),
  banco_id bigint,
  banco_codigo integer,
  banco_nombre text,
  cuenta_numero text,
  cuenta_nombre text,
  moneda_id bigint,
  moneda_iso text,
  moneda_simbolo text,
  tipo_cambio numeric(18, 6) not null default 1,
  saldo_inicial numeric(18, 2) not null default 0,
  ingresos numeric(18, 2) not null default 0,
  egresos numeric(18, 2) not null default 0,
  saldo numeric(18, 2) not null default 0,
  saldo_ml numeric(18, 2) not null default 0,
  circ_ingresos numeric(18, 2) not null default 0,
  circ_egresos numeric(18, 2) not null default 0,
  circ_documentos integer not null default 0,
  disponible numeric(18, 2) not null default 0,
  disponible_ml numeric(18, 2) not null default 0,
  saldo_minimo numeric(18, 2) not null default 0,
  bajo_minimo boolean not null default false
);
create index if not exists disponibilidad_detalle_gen on public.disponibilidad_detalle (generacion_id, orden);

alter table public.disponibilidad_generaciones enable row level security;
alter table public.disponibilidad_detalle enable row level security;
drop policy if exists "disponibilidad_generaciones: leer" on public.disponibilidad_generaciones;
create policy "disponibilidad_generaciones: leer" on public.disponibilidad_generaciones for select to authenticated using (public.usuario_activo());
drop policy if exists "disponibilidad_detalle: leer" on public.disponibilidad_detalle;
create policy "disponibilidad_detalle: leer" on public.disponibilidad_detalle for select to authenticated using (public.usuario_activo());
grant select on public.disponibilidad_generaciones, public.disponibilidad_detalle to authenticated;

-- 3. Generar (calcula y guarda). Solo inserta: el histórico no se modifica.
create or replace function public.generar_disponibilidad(p_loc bigint, p_banco bigint, p_cuenta bigint, p_fecha date)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_yo record;
  v_loc record;
  v_ahora timestamp := (now() at time zone 'America/Guatemala');
  v_anio integer := extract(year from v_ahora)::integer;
  v_mes integer := extract(month from v_ahora)::integer;
  v_num integer;
  v_id bigint;
  v_corr text;
  c record;
  v_orden integer := 0;
  v_tc numeric; v_ing numeric; v_egr numeric; v_ci numeric; v_ce numeric; v_cn integer; v_saldo numeric; v_disp numeric;
begin
  if not public.usuario_activo() then raise exception 'Usuario no autorizado.'; end if;
  select p.usuario, p.nombre into v_yo from public.perfiles p where p.id = (select auth.uid());
  select l.id, l.organizacion_id, l.codigo, coalesce(nullif(l.siglas, ''), l.codigo) as siglas into v_loc from public.localidades l where l.id = p_loc;
  if v_loc.id is null then raise exception 'No existe la empresa.'; end if;
  if p_fecha is null then raise exception 'Indica la fecha de corte.'; end if;
  perform pg_advisory_xact_lock(4817, p_loc::integer);
  select coalesce(max(numero), 0) + 1 into v_num from public.disponibilidad_generaciones where localidad_id = p_loc and anio = v_anio and mes = v_mes;
  v_corr := format('%s-%s-%s-%s', upper(v_loc.siglas), v_anio, lpad(v_mes::text, 2, '0'), lpad(v_num::text, 4, '0'));
  insert into public.disponibilidad_generaciones (organizacion_id, localidad_id, correlativo, anio, mes, numero, fecha_corte, banco_id, cuenta_bancaria_id, banco_nombre, cuenta_numero,
    generado_por, usuario, usuario_nombre, generado_en)
  values (v_loc.organizacion_id, p_loc, v_corr, v_anio, v_mes, v_num, p_fecha, p_banco, p_cuenta,
    (select b.nombre from public.bancos b where b.id = p_banco), (select cb.numero from public.cuentas_bancarias cb where cb.id = p_cuenta),
    (select auth.uid()), upper(coalesce(v_yo.usuario, 'SISTEMA')), v_yo.nombre, now())
  returning id into v_id;

  for c in
    select cb.*, b.codigo as b_codigo, b.nombre as b_nombre, m.iso, m.simbolo
    from public.cuentas_bancarias cb
    join public.bancos b on b.id = cb.banco_id
    join public.monedas m on m.id = cb.moneda_id
    where cb.localidad_id = p_loc and cb.activo
      and (p_banco is null or cb.banco_id = p_banco) and (p_cuenta is null or cb.id = p_cuenta)
    order by b.codigo, cb.numero
  loop
    v_orden := v_orden + 1;
    v_tc := case when c.iso = 'GTQ' then 1 else coalesce((select t.valor_venta from public.tipos_cambio t where t.moneda_id = c.moneda_id and t.fecha <= p_fecha order by t.fecha desc limit 1), 1) end;
    select coalesce(sum(valor_cuenta) filter (where tipo in ('DEPOSITO', 'NOTA_CREDITO')), 0), coalesce(sum(valor_cuenta) filter (where tipo in ('NOTA_DEBITO', 'CHEQUE')), 0),
           coalesce(sum(valor_cuenta) filter (where tipo in ('DEPOSITO', 'NOTA_CREDITO') and not conciliado), 0), coalesce(sum(valor_cuenta) filter (where tipo in ('NOTA_DEBITO', 'CHEQUE') and not conciliado), 0),
           count(*) filter (where not conciliado)
      into v_ing, v_egr, v_ci, v_ce, v_cn
    from public.movimientos_bancarios
    where cuenta_bancaria_id = c.id and estado = 'ACTIVO' and fecha >= c.fecha_saldo_inicial and fecha <= p_fecha;
    v_saldo := c.saldo_inicial + v_ing - v_egr;
    -- Disponible: el saldo en libros (los cheques y notas emitidos ya están descontados).
    v_disp := v_saldo;
    insert into public.disponibilidad_detalle (generacion_id, orden, cuenta_bancaria_id, banco_id, banco_codigo, banco_nombre, cuenta_numero, cuenta_nombre, moneda_id, moneda_iso, moneda_simbolo,
      tipo_cambio, saldo_inicial, ingresos, egresos, saldo, saldo_ml, circ_ingresos, circ_egresos, circ_documentos, disponible, disponible_ml, saldo_minimo, bajo_minimo)
    values (v_id, v_orden, c.id, c.banco_id, c.b_codigo, c.b_nombre, c.numero, c.nombre, c.moneda_id, c.iso, c.simbolo,
      v_tc, c.saldo_inicial, v_ing, v_egr, v_saldo, round(v_saldo * v_tc, 2), v_ci, v_ce, v_cn, v_disp, round(v_disp * v_tc, 2), coalesce(c.saldo_minimo, 0), v_disp < coalesce(c.saldo_minimo, 0));
  end loop;

  update public.disponibilidad_generaciones g set
    cuentas = x.n, bajo_minimo = x.bajo, total_saldo_ml = x.s, total_circulacion_ml = x.circ, total_disponible_ml = x.d
  from (select count(*) n, count(*) filter (where bajo_minimo) bajo, coalesce(sum(saldo_ml), 0) s,
          coalesce(sum(round((circ_ingresos - circ_egresos) * tipo_cambio, 2)), 0) circ, coalesce(sum(disponible_ml), 0) d
        from public.disponibilidad_detalle where generacion_id = v_id) x
  where g.id = v_id;
  return jsonb_build_object('id', v_id, 'correlativo', v_corr);
end;
$$;
revoke all on function public.generar_disponibilidad(bigint, bigint, bigint, date) from public;
grant execute on function public.generar_disponibilidad(bigint, bigint, bigint, date) to authenticated;

-- 4. Opción del menú.
do $$
declare
  v_mod bigint; v_orden integer; v_id bigint;
begin
  select modulo_id, orden into v_mod, v_orden from public.opciones_sistema where clave = 'disponibilidad-bancaria' and grupo = 'bancos' order by id limit 1;
  if v_mod is null then raise notice 'No existe la opción Disponibilidad bancaria.'; return; end if;
  if exists (select 1 from public.opciones_sistema where modulo_id = v_mod and grupo = 'bancos' and clave = 'consulta-de-disponibilidad') then
    raise notice 'Consulta de Disponibilidad ya estaba instalada.'; return;
  end if;
  update public.opciones_sistema set orden = orden + 1 where orden > v_orden;
  insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
  values (v_mod, 'bancos', 'Bancos', 'consulta-de-disponibilidad', 'Consulta de Disponibilidad', v_orden + 1)
  returning id into v_id;
  insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
  select a.rol_id, v_id, a.ver, false, false, false, a.imprimir
  from public.rol_accesos a join public.opciones_sistema s on s.id = a.opcion_id
  where s.modulo_id = v_mod and s.clave = 'disponibilidad-bancaria'
  on conflict do nothing;
  raise notice 'Consulta de Disponibilidad instalada debajo de Disponibilidad bancaria.';
end;
$$;

notify pgrst, 'reload schema';
