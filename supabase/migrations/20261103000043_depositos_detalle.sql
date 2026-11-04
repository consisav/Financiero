-- Bancos · Depósitos: detalle de facturas de liquidación, recibos físicos y centro de costo.
--   movimientos_bancarios: caja chica, clientes varios y quién depositó.
--   movimiento_documentos: serie (recibos), valor en quetzales, abono y abono en quetzales,
--   contrato (facturas).
--   movimiento_lineas: centro de costo, que pasa a la partida contable.
-- Se ejecuta después del script 42.

alter table public.movimientos_bancarios add column if not exists caja_chica boolean not null default false;
alter table public.movimientos_bancarios add column if not exists clientes_varios boolean not null default false;
alter table public.movimientos_bancarios add column if not exists deposito_por text;

alter table public.movimiento_documentos add column if not exists serie text;
alter table public.movimiento_documentos add column if not exists valor_ml numeric(18, 2) not null default 0;
alter table public.movimiento_documentos add column if not exists abono numeric(18, 2) not null default 0;
alter table public.movimiento_documentos add column if not exists abono_ml numeric(18, 2) not null default 0;
alter table public.movimiento_documentos add column if not exists contrato text;

alter table public.movimiento_lineas add column if not exists centro_id bigint references public.centros_costo (id);
create index if not exists movimiento_lineas_centro_idx on public.movimiento_lineas (centro_id);

-- El centro de costo de una línea debe ser del catálogo de centros de la localidad.
create or replace function public.validar_detalle_movimiento() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m public.movimientos_bancarios;
begin
  select * into m from public.movimientos_bancarios where id = coalesce(new.movimiento_id, old.movimiento_id);
  if m.estado = 'ANULADO' then raise exception 'El documento % está anulado.', m.folio; end if;
  if tg_table_name = 'movimiento_lineas' and m.partida_id is not null then
    raise exception 'El documento % ya generó su partida: su detalle contable no cambia.', m.folio;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_table_name = 'movimiento_lineas' then
    if not exists (select 1 from public.cuentas c join public.catalogos_cuentas k on k.id = c.catalogo_id
                   where c.id = new.cuenta_id and k.localidad_id = m.localidad_id) then
      raise exception 'La cuenta de la línea % no es del catálogo de la localidad.', new.linea;
    end if;
    if new.centro_id is not null and not exists (
         select 1 from public.centros_costo x join public.catalogos_centros k on k.id = x.catalogo_id
         where x.id = new.centro_id and k.localidad_id = m.localidad_id) then
      raise exception 'El centro de costo de la línea % no es de la localidad.', new.linea;
    end if;
  end if;
  return new;
end;
$$;

-- La partida generada lleva el centro de costo de cada línea.
create or replace function public.procesar_movimiento_bancario(p_id bigint, p_accion text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.movimientos_bancarios;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_debe numeric; v_haber numeric; v_lineas integer;
  v_partida bigint;
  v_anio integer; v_mes integer;
  v_tipo bigint;
  v_nombre text;
begin
  if p_accion = 'ELIMINAR' then
    if not public.es_superadmin() then raise exception 'Solo el Super Administrador puede eliminar documentos bancarios.'; end if;
  elsif not public.puede_editar_catalogos() then
    raise exception 'Solo un administrador puede procesar documentos bancarios.';
  end if;
  select * into m from public.movimientos_bancarios where id = p_id for update;
  if m.id is null then raise exception 'El documento no existe.'; end if;
  v_nombre := case m.tipo when 'DEPOSITO' then 'Depósito' when 'NOTA_CREDITO' then 'Nota de crédito' else 'Nota de débito' end;
  perform set_config('fin.banco', 'si', true);

  if p_accion = 'ANULAR' then
    if m.estado = 'ANULADO' then raise exception '% % ya está anulado.', v_nombre, m.folio; end if;
    if m.partida_id is not null and exists (select 1 from public.partidas p where p.id = m.partida_id and p.estado = 'VIGENTE') then
      raise exception 'Primero anula la partida % del documento en Partidas contables.', (select p.mes || '-' || p.numero from public.partidas p where p.id = m.partida_id);
    end if;
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la anulación.'; end if;
    update public.movimientos_bancarios set estado = 'ANULADO', anulado_por = v_quien, anulado_en = now(), motivo_anulacion = trim(p_motivo), conciliado = false where id = m.id;

  elsif p_accion = 'PARTIDA' then
    if m.estado = 'ANULADO' then raise exception '% % está anulado.', v_nombre, m.folio; end if;
    if m.partida_id is not null then raise exception '% % ya generó su partida.', v_nombre, m.folio; end if;
    select count(*), coalesce(sum(debe), 0), coalesce(sum(haber), 0) into v_lineas, v_debe, v_haber from public.movimiento_lineas where movimiento_id = m.id;
    if v_lineas < 2 then raise exception 'Contabiliza el documento: necesita al menos dos líneas en el detalle contable.'; end if;
    if v_debe <> v_haber then raise exception 'El detalle contable no cuadra: debe % y haber %.', v_debe, v_haber; end if;
    v_anio := extract(year from m.fecha); v_mes := extract(month from m.fecha);
    select id into v_tipo from public.tipos_partida where siglas = 'PB';
    if v_tipo is null then select id into v_tipo from public.tipos_partida order by codigo limit 1; end if;
    insert into public.partidas (organizacion_id, localidad_id, anio, mes, tipo_partida_id, descripcion, moneda_id, tipo_cambio, justificacion)
    values (m.organizacion_id, m.localidad_id, v_anio, v_mes, v_tipo,
            upper(v_nombre) || ' ' || coalesce(m.numero_documento, m.folio::text) || coalesce(' · ' || m.descripcion, ''),
            coalesce((select x.id from public.monedas x where x.iso = 'GTQ'), m.moneda_id), 1,
            'Generada desde Bancos · ' || v_nombre || ' folio ' || m.folio || case when m.tipo_cambio <> 1 then ' · valor ' || m.valor || ' al cambio ' || m.tipo_cambio else '' end)
    returning id into v_partida;
    insert into public.partida_lineas (partida_id, linea, cuenta_id, concepto, debe, haber, centro_id)
    select v_partida, l.linea, l.cuenta_id, left(coalesce(m.descripcion, v_nombre), 200), l.debe, l.haber, l.centro_id
    from public.movimiento_lineas l where l.movimiento_id = m.id order by l.linea;
    update public.movimientos_bancarios set partida_id = v_partida where id = m.id;
    return jsonb_build_object('folio', m.folio, 'partida', (select p.mes || '-' || p.numero from public.partidas p where p.id = v_partida));

  elsif p_accion in ('CONCILIAR', 'DESCONCILIAR') then
    if m.estado = 'ANULADO' then raise exception '% % está anulado.', v_nombre, m.folio; end if;
    update public.movimientos_bancarios set conciliado = (p_accion = 'CONCILIAR'), fecha_conciliado = case when p_accion = 'CONCILIAR' then current_date end where id = m.id;

  elsif p_accion = 'ELIMINAR' then
    if m.partida_id is not null then raise exception '% % ya generó su partida: anúlalo en lugar de eliminarlo.', v_nombre, m.folio; end if;
    delete from public.movimientos_bancarios where id = m.id;
  else
    raise exception 'Acción no válida.';
  end if;
  perform set_config('fin.banco', '', true);
  return jsonb_build_object('folio', m.folio);
end;
$$;

notify pgrst, 'reload schema';
