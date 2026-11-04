-- Caja y Bancos · Cheques · Emisión de cheques: el cheque es un documento bancario más
-- (movimientos_bancarios, tipo CHEQUE) con su detalle contable, facturas pagadas y partida.
--   Número: lo asigna la chequera de la cuenta bancaria (cheque inicial + utilizados) al
--   registrarlo, sube los utilizados y no se repite en la cuenta; ya no cambia, ni su cuenta.
--   Datos del cheque: a favor de (deposito_por), no negociable, cuenta por cobrar (CXC),
--   firmado, código del banco e impreso (quién y cuándo). Impreso, ya no cambia su valor ni
--   su beneficiario: se anula y se emite otro.
--   El cheque resta en el saldo de la cuenta como una nota de débito y se concilia igual.
-- Se ejecuta después del script 50.

alter table public.movimientos_bancarios drop constraint if exists movimientos_bancarios_tipo_check;
alter table public.movimientos_bancarios add constraint movimientos_bancarios_tipo_check
  check (tipo in ('DEPOSITO', 'NOTA_CREDITO', 'NOTA_DEBITO', 'CHEQUE'));

alter table public.movimientos_bancarios add column if not exists no_negociable boolean not null default false;
alter table public.movimientos_bancarios add column if not exists cxc boolean not null default false;
alter table public.movimientos_bancarios add column if not exists firmado boolean not null default false;
alter table public.movimientos_bancarios add column if not exists codigo_banco text;
alter table public.movimientos_bancarios add column if not exists impreso boolean not null default false;
alter table public.movimientos_bancarios add column if not exists impreso_por text;
alter table public.movimientos_bancarios add column if not exists impreso_en timestamptz;

create unique index if not exists movimientos_bancarios_cheque_numero on public.movimientos_bancarios (cuenta_bancaria_id, numero_documento) where tipo = 'CHEQUE';

-- ---------- Número de la chequera ----------
create or replace function public.asignar_cheque() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  cb public.cuentas_bancarias;
  v_numero bigint;
begin
  if new.tipo <> 'CHEQUE' then return new; end if;
  if tg_op = 'INSERT' then
    select * into cb from public.cuentas_bancarias where id = new.cuenta_bancaria_id for update;
    if cb.cheque_inicial is null or cb.cheque_final is null then
      raise exception 'La cuenta % no tiene chequera: define el cheque inicial y final en Bancos · Cuentas bancarias.', cb.numero;
    end if;
    v_numero := cb.cheque_inicial + cb.cheques_utilizados;
    if v_numero > cb.cheque_final then
      raise exception 'Se terminó la chequera de la cuenta % (cheques % al %): registra la nueva chequera.', cb.numero, cb.cheque_inicial, cb.cheque_final;
    end if;
    new.numero_documento := v_numero::text;
    update public.cuentas_bancarias set cheques_utilizados = cheques_utilizados + 1 where id = cb.id;
    new.impreso := false; new.impreso_por := null; new.impreso_en := null;
  else
    new.numero_documento := old.numero_documento;
    new.cuenta_bancaria_id := old.cuenta_bancaria_id;
    if current_setting('fin.banco', true) is distinct from 'si' then
      new.impreso := old.impreso; new.impreso_por := old.impreso_por; new.impreso_en := old.impreso_en;
      if old.impreso and (new.valor <> old.valor or new.moneda_id <> old.moneda_id or new.deposito_por is distinct from old.deposito_por) then
        raise exception 'El cheque % ya se imprimió: no cambia su valor ni su beneficiario. Anúlalo y emite otro.', old.numero_documento;
      end if;
    end if;
  end if;
  new.deposito_por := nullif(upper(trim(new.deposito_por)), '');
  new.codigo_banco := nullif(trim(new.codigo_banco), '');
  return new;
end;
$$;
drop trigger if exists movimientos_bancarios_cheque on public.movimientos_bancarios;
create trigger movimientos_bancarios_cheque before insert or update on public.movimientos_bancarios
  for each row execute function public.asignar_cheque();

-- ---------- Procesos: los de siempre más «IMPRESO» ----------
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
  v_nombre := case m.tipo when 'DEPOSITO' then 'Depósito' when 'NOTA_CREDITO' then 'Nota de crédito' when 'CHEQUE' then 'Cheque' else 'Nota de débito' end;
  perform set_config('fin.banco', 'si', true);

  if p_accion = 'ANULAR' then
    if m.estado = 'ANULADO' then raise exception '% % ya está anulado.', v_nombre, m.folio; end if;
    if m.partida_id is not null and exists (select 1 from public.partidas p where p.id = m.partida_id and p.estado = 'VIGENTE') then
      raise exception 'Primero anula la partida % del documento en Partidas contables.', (select p.mes || '-' || p.numero from public.partidas p where p.id = m.partida_id);
    end if;
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la anulación.'; end if;
    update public.movimientos_bancarios set estado = 'ANULADO', anulado_por = v_quien, anulado_en = now(), motivo_anulacion = trim(p_motivo), conciliado = false where id = m.id;

  elsif p_accion = 'IMPRESO' then
    if m.estado = 'ANULADO' then raise exception '% % está anulado.', v_nombre, m.folio; end if;
    update public.movimientos_bancarios set impreso = true, impreso_por = v_quien, impreso_en = now() where id = m.id;

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
            upper(v_nombre) || ' ' || coalesce(m.numero_documento, m.folio::text) || coalesce(' · ' || m.deposito_por, '') || coalesce(' · ' || m.descripcion, ''),
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
    if m.tipo = 'CHEQUE' then raise exception 'Un cheque no se elimina (su número es de la chequera): anúlalo.'; end if;
    delete from public.movimientos_bancarios where id = m.id;
  else
    raise exception 'Acción no válida.';
  end if;
  perform set_config('fin.banco', '', true);
  return jsonb_build_object('folio', m.folio);
end;
$$;

-- ---------- Saldo: el cheque resta como la nota de débito ----------
create or replace function public.saldo_cuenta_bancaria(p_cuenta bigint, p_hasta date) returns numeric
language sql stable security definer set search_path = '' as $$
  select cb.saldo_inicial + coalesce((
    select sum(case when m.tipo in ('NOTA_DEBITO', 'CHEQUE') then -m.valor_cuenta else m.valor_cuenta end)
    from public.movimientos_bancarios m
    where m.cuenta_bancaria_id = cb.id and m.estado = 'ACTIVO' and m.fecha >= cb.fecha_saldo_inicial and m.fecha <= p_hasta), 0)
  from public.cuentas_bancarias cb
  where cb.id = p_cuenta and public.usuario_activo();
$$;

revoke execute on function public.asignar_cheque() from public, anon, authenticated;

-- ---------- Menú: Caja y Bancos · Cheques · Emisión de cheques ----------
insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
select m.id, 'cheques', 'Cheques', 'emision-de-cheques', 'Emisión de cheques', coalesce((select max(orden) from public.opciones_sistema), 0) + 1
from public.modulos_sistema m
where m.siglas = 'CYB' and m.modulo_mayor_id is null
  and not exists (select 1 from public.opciones_sistema o where o.clave = 'emision-de-cheques' and o.modulo_id = m.id);

notify pgrst, 'reload schema';
