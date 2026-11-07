-- Caja y Bancos · Cajas: Definición de Cajas y Liquidación de Cajas Chicas.
--   1. Definición de la caja (cajas_chicas): transacción, usuario que liquida y la vinculación de cuentas para la
--      contabilización por carga masiva (carga masiva, verifica liquidación, cuenta de caja, cuenta de anticipo y
--      cuenta de migración). El tipo de movimiento es el tipo de caja, la cuenta principal es la cuenta de la caja y
--      el monto asignado es el fondo (columnas que ya existen).
--   2. caja_tipos_gasto: cada caja con sus tipos de gasto y la cuenta contable de cada uno («Cargar cuentas» los
--      toma de las cuentas de gasto usadas en sus documentos).
--   3. Subcajas: fecha de presentación y fecha de la liquidación.
--   4. liquidar_cajas(subcajas, cuenta bancaria, NOTA o CHEQUE, número, fecha): registra la liquidación (nota o
--      cheque, cuenta y valor = gastos − anticipo − adelanto) de cada subcaja marcada y la liquida con su póliza
--      (procesar_caja_periodo). Si una falla, no se liquida ninguna.
--   5. Opciones del menú: «Definición de Cajas» (antes de Cajas chicas) y «Liquidación de Cajas Chicas» (después),
--      con los permisos que cada rol ya tiene en Cajas chicas.
-- Puede ejecutarse de nuevo. Se ejecuta después del script 119.

alter table public.cajas_chicas add column if not exists transaccion_id bigint references public.transacciones_contables(id) on delete set null;
alter table public.cajas_chicas add column if not exists usuario_liquida text;
alter table public.cajas_chicas add column if not exists carga_masiva boolean not null default false;
alter table public.cajas_chicas add column if not exists verifica_liquidacion boolean not null default false;
alter table public.cajas_chicas add column if not exists cuenta_caja_id bigint references public.cuentas(id);
alter table public.cajas_chicas add column if not exists cuenta_anticipo_id bigint references public.cuentas(id);
alter table public.cajas_chicas add column if not exists cuenta_migracion text;

alter table public.caja_periodos add column if not exists fecha_presentacion date;
alter table public.caja_periodos add column if not exists liquidacion_fecha date;

create table if not exists public.caja_tipos_gasto (
  id bigint generated always as identity primary key,
  caja_id bigint not null references public.cajas_chicas(id) on delete cascade,
  orden integer not null default 0,
  tipo_gasto text not null check (length(trim(tipo_gasto)) > 0),
  cuenta_id bigint references public.cuentas(id),
  unique (caja_id, tipo_gasto)
);
alter table public.caja_tipos_gasto enable row level security;
drop policy if exists "caja_tipos_gasto: leer" on public.caja_tipos_gasto;
create policy "caja_tipos_gasto: leer" on public.caja_tipos_gasto for select to authenticated using (public.usuario_activo());
drop policy if exists "caja_tipos_gasto: crear" on public.caja_tipos_gasto;
create policy "caja_tipos_gasto: crear" on public.caja_tipos_gasto for insert to authenticated with check (public.puede_editar_catalogos());
drop policy if exists "caja_tipos_gasto: modificar" on public.caja_tipos_gasto;
create policy "caja_tipos_gasto: modificar" on public.caja_tipos_gasto for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());
drop policy if exists "caja_tipos_gasto: eliminar" on public.caja_tipos_gasto;
create policy "caja_tipos_gasto: eliminar" on public.caja_tipos_gasto for delete to authenticated using (public.puede_editar_catalogos());
grant select, insert, update, delete on public.caja_tipos_gasto to authenticated;

-- La vista del resumen toma las columnas nuevas de la subcaja.
drop view if exists public.caja_periodos_resumen;
create view public.caja_periodos_resumen with (security_invoker = true) as
  select p.*,
         coalesce(d.documentos, 0) as documentos,
         coalesce(d.liquidado, 0) as liquidado,
         coalesce(d.iva, 0) as total_iva,
         p.anticipo_valor + p.adelanto_valor - coalesce(d.liquidado, 0) as disponible
  from public.caja_periodos p
  left join lateral (
    select count(*) as documentos, sum(x.total) as liquidado, sum(x.iva) as iva
    from public.caja_documentos x where x.periodo_id = p.id) d on true;
grant select on public.caja_periodos_resumen to authenticated;

create or replace function public.liquidar_cajas(p_ids bigint[], p_cuenta bigint, p_tipo text, p_documento text, p_fecha date, p_partida boolean default true)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint; p record; v_valor numeric; v_total numeric := 0; n int := 0; r jsonb; v_polizas text[] := '{}';
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede liquidar las cajas chicas.'; end if;
  if p_ids is null or array_length(p_ids, 1) is null then raise exception 'Marca las subcajas que vas a liquidar.'; end if;
  if p_tipo not in ('NOTA', 'CHEQUE') then raise exception 'Indica si la liquidación es con nota o con cheque.'; end if;
  foreach v_id in array p_ids loop
    select * into p from public.caja_periodos_resumen where id = v_id;
    if p.id is null then raise exception 'La subcaja % no existe.', v_id; end if;
    if p.estado = 'LIQUIDADA' then raise exception 'La subcaja % ya está liquidada.', p.numero; end if;
    v_valor := greatest(p.liquidado - p.anticipo_valor - p.adelanto_valor, 0);
    perform set_config('fin.caja', 'si', true);
    update public.caja_periodos set
      liquidacion_cuenta_id = coalesce(p_cuenta, liquidacion_cuenta_id),
      liquidacion_nota = case when p_tipo = 'NOTA' then coalesce(nullif(trim(p_documento), ''), liquidacion_nota) else liquidacion_nota end,
      liquidacion_cheque = case when p_tipo = 'CHEQUE' then coalesce(nullif(trim(p_documento), ''), liquidacion_cheque) else liquidacion_cheque end,
      liquidacion_valor = v_valor, liquidacion_fecha = coalesce(p_fecha, current_date)
    where id = p.id;
    perform set_config('fin.caja', '', true);
    r := public.procesar_caja_periodo(p.id, 'LIQUIDAR', p_partida);
    if r ->> 'partida' is not null then v_polizas := array_append(v_polizas, r ->> 'partida'); end if;
    v_total := v_total + v_valor; n := n + 1;
  end loop;
  return jsonb_build_object('subcajas', n, 'total', v_total, 'polizas', to_jsonb(v_polizas));
end;
$$;
revoke all on function public.liquidar_cajas(bigint[], bigint, text, text, date, boolean) from public;
grant execute on function public.liquidar_cajas(bigint[], bigint, text, text, date, boolean) to authenticated;

-- Opciones del menú.
do $$
declare
  o record; v_mod bigint; v_orden integer; v_id bigint; v_grupo text; v_sub text;
begin
  for o in select * from (values ('definicion-cajas', 'Definición de Cajas', true), ('liquidacion-cajas-chicas', 'Liquidación de Cajas Chicas', false)) as x(clave, nombre, antes) loop
    v_mod := null;
    select modulo_id, orden, grupo, subgrupo into v_mod, v_orden, v_grupo, v_sub from public.opciones_sistema where clave = 'cajas-chicas' order by id limit 1;
    if v_mod is null then raise notice 'No existe la opción Cajas chicas.'; return; end if;
    if exists (select 1 from public.opciones_sistema where modulo_id = v_mod and clave = o.clave) then raise notice '% ya estaba instalada.', o.nombre; continue; end if;
    if o.antes then
      update public.opciones_sistema set orden = orden + 1 where orden >= v_orden;
      insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values (v_mod, v_grupo, v_sub, o.clave, o.nombre, v_orden) returning id into v_id;
    else
      update public.opciones_sistema set orden = orden + 1 where orden > v_orden;
      insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values (v_mod, v_grupo, v_sub, o.clave, o.nombre, v_orden + 1) returning id into v_id;
    end if;
    insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
    select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir
    from public.rol_accesos a join public.opciones_sistema s on s.id = a.opcion_id
    where s.modulo_id = v_mod and s.clave = 'cajas-chicas'
    on conflict do nothing;
    raise notice '% instalada.', o.nombre;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
