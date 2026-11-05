-- Compras · Registros · Regularización de anticipos y Cuentas x Pagar.
--   regularizaciones_anticipo: liquida anticipos a proveedores (cheques o notas de débito cargados a
--   la cuenta de anticipos) contra compras por pagar. Al procesarla genera la póliza contable
--   (debe cuenta a operar · haber cuenta de anticipo) con la fecha final, y sus valores cuentan como
--   abonos de las compras. Reversar anula la póliza y la deja de nuevo editable.
--   anticipos_disponibles: los documentos bancarios con cargo a la cuenta de anticipo en el rango,
--   con lo ya regularizado y lo disponible.
--   clasificaciones_compra.aplica_inventario: si la clasificación aplica inventarios (todas sí).
--   compras_saldo: el pagado incluye las regularizaciones operadas.
--   compra_abonos: cada abono de una compra (pagos bancarios y regularizaciones) con su fecha; lo usan
--   los reportes de Cuentas x Pagar (saldo a una fecha y estado de cuenta).
-- Escribir: administrador. Se ejecuta después del script 63.

-- Clasificaciones de compra: si aplican inventarios (todas sí por defecto).
alter table public.clasificaciones_compra add column if not exists aplica_inventario boolean not null default true;

create table if not exists public.regularizaciones_anticipo (
  id                    bigint generated always as identity primary key,
  organizacion_id       bigint not null references public.organizaciones (id),
  localidad_id          bigint not null references public.localidades (id),
  numero                integer not null,
  fecha_inicial         date not null,
  fecha_final           date not null,
  tipo                  text not null default 'CTA POR PAGAR' check (tipo in ('CTA POR PAGAR')),
  cuenta_anticipo_id    bigint not null references public.cuentas (id),
  cuenta_operar_id      bigint not null references public.cuentas (id),
  observaciones         text,
  estado                text not null default 'VIGENTE' check (estado in ('VIGENTE', 'OPERADA', 'ANULADA')),
  partida_id            bigint references public.partidas (id) on delete set null,
  usuario               text,
  operado_por           text,
  operado_en            timestamptz,
  reversado_por         text,
  reversado_en          timestamptz,
  creado_por            uuid,
  creado_por_nombre     text,
  creado_en             timestamptz,
  modificado_por        uuid,
  modificado_por_nombre text,
  modificado_en         timestamptz,
  unique (localidad_id, numero),
  check (fecha_final >= fecha_inicial),
  check (cuenta_anticipo_id <> cuenta_operar_id)
);
create table if not exists public.regularizacion_anticipos (
  id                bigint generated always as identity primary key,
  regularizacion_id bigint not null references public.regularizaciones_anticipo (id) on delete cascade,
  linea             integer not null,
  movimiento_id     bigint not null references public.movimientos_bancarios (id),
  valor             numeric(18, 2) not null check (valor > 0),
  descripcion       text,
  unique (regularizacion_id, linea),
  unique (regularizacion_id, movimiento_id)
);
create table if not exists public.regularizacion_documentos (
  id                bigint generated always as identity primary key,
  regularizacion_id bigint not null references public.regularizaciones_anticipo (id) on delete cascade,
  linea             integer not null,
  tipo              text not null default 'COMPRA' check (tipo in ('COMPRA')),
  compra_id         bigint not null references public.compras (id),
  valor             numeric(18, 2) not null check (valor > 0),
  descripcion       text,
  unique (regularizacion_id, linea),
  unique (regularizacion_id, compra_id)
);
create index if not exists regularizacion_anticipos_mov_idx on public.regularizacion_anticipos (movimiento_id);
create index if not exists regularizacion_documentos_compra_idx on public.regularizacion_documentos (compra_id);

-- Número correlativo por localidad; el estado y la póliza solo cambian con procesar_regularizacion.
create or replace function public.preparar_regularizacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('fin.regularizacion', true) is distinct from 'si' then
    if tg_op = 'INSERT' then
      perform pg_advisory_xact_lock(hashtext('regularizacion_anticipo'), new.localidad_id::integer);
      new.numero := coalesce((select max(numero) from public.regularizaciones_anticipo where localidad_id = new.localidad_id), 0) + 1;
      new.estado := 'VIGENTE'; new.partida_id := null; new.operado_por := null; new.operado_en := null;
      new.usuario := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
    else
      if old.estado <> 'VIGENTE' then raise exception 'La regularización % está %: ya no se modifica.', old.numero, lower(old.estado); end if;
      new.numero := old.numero; new.estado := old.estado; new.partida_id := old.partida_id; new.usuario := old.usuario;
      new.localidad_id := old.localidad_id; new.organizacion_id := old.organizacion_id;
    end if;
  end if;
  if not exists (select 1 from public.localidades l where l.id = new.localidad_id and l.organizacion_id = new.organizacion_id) then
    raise exception 'La localidad no es de la organización.';
  end if;
  return new;
end;
$$;
drop trigger if exists regularizaciones_anticipo_preparar on public.regularizaciones_anticipo;
create trigger regularizaciones_anticipo_preparar before insert or update on public.regularizaciones_anticipo for each row execute function public.preparar_regularizacion();
drop trigger if exists regularizaciones_anticipo_auditar on public.regularizaciones_anticipo;
create trigger regularizaciones_anticipo_auditar before insert or update on public.regularizaciones_anticipo for each row execute function public.auditar();

-- El detalle solo cambia mientras la regularización está vigente.
create or replace function public.validar_detalle_regularizacion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.regularizaciones_anticipo;
begin
  select * into r from public.regularizaciones_anticipo where id = coalesce(new.regularizacion_id, old.regularizacion_id);
  if r.estado <> 'VIGENTE' and current_setting('fin.regularizacion', true) is distinct from 'si' then
    raise exception 'La regularización % está %: su detalle ya no se modifica.', r.numero, lower(r.estado);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_table_name = 'regularizacion_anticipos' then
    if not exists (select 1 from public.movimientos_bancarios m where m.id = new.movimiento_id and m.localidad_id = r.localidad_id and m.estado = 'ACTIVO') then
      raise exception 'El documento bancario de la línea % no es de la empresa o está anulado.', new.linea;
    end if;
  elsif not exists (select 1 from public.compras c where c.id = new.compra_id and c.localidad_id = r.localidad_id) then
    raise exception 'La compra de la línea % no es de la empresa.', new.linea;
  end if;
  new.descripcion := nullif(upper(trim(new.descripcion)), '');
  return new;
end;
$$;
drop trigger if exists regularizacion_anticipos_validar on public.regularizacion_anticipos;
create trigger regularizacion_anticipos_validar before insert or update or delete on public.regularizacion_anticipos for each row execute function public.validar_detalle_regularizacion();
drop trigger if exists regularizacion_documentos_validar on public.regularizacion_documentos;
create trigger regularizacion_documentos_validar before insert or update or delete on public.regularizacion_documentos for each row execute function public.validar_detalle_regularizacion();

-- Pagado de las compras: pagos bancarios y regularizaciones de anticipos operadas.
create or replace view public.compras_saldo with (security_invoker = true) as
  select c.*,
         c.valor_total - c.bonificaciones - c.notas_credito - c.descuentos_nd as neto,
         coalesce(p.pagado, 0) as pagado,
         c.valor_total - c.bonificaciones - c.notas_credito - c.descuentos_nd - coalesce(p.pagado, 0) as pendiente,
         coalesce(p.pagos, 0) as pagos,
         p.ultimo_pago
  from public.compras c
  left join lateral (
    select sum(x.valor) as pagado, count(*) as pagos, string_agg(x.txt, ', ' order by x.fecha, x.orden) as ultimo_pago
    from (select d.abono_compra as valor, m.fecha, m.id as orden, case when m.tipo = 'CHEQUE' then 'CH ' else 'TRF ' end || coalesce(m.numero_documento, m.folio::text) as txt
          from public.movimiento_documentos d join public.movimientos_bancarios m on m.id = d.movimiento_id and m.estado = 'ACTIVO'
          where d.compra_id = c.id
          union all
          select rd.valor, r.fecha_final, r.id, 'ANT ' || r.numero
          from public.regularizacion_documentos rd join public.regularizaciones_anticipo r on r.id = rd.regularizacion_id and r.estado = 'OPERADA'
          where rd.compra_id = c.id) x) p on true;
grant select on public.compras_saldo to authenticated;

-- Cada abono de una compra con su fecha.
create or replace view public.compra_abonos with (security_invoker = true) as
  select d.compra_id, m.fecha, d.abono_compra as valor, case when m.tipo = 'CHEQUE' then 'CHEQUE' else 'TRANSFERENCIA' end as origen,
         coalesce(m.numero_documento, m.folio::text) as documento, m.id as movimiento_id, null::bigint as regularizacion_id
  from public.movimiento_documentos d join public.movimientos_bancarios m on m.id = d.movimiento_id and m.estado = 'ACTIVO'
  where d.compra_id is not null and d.abono_compra > 0
  union all
  select rd.compra_id, r.fecha_final, rd.valor, 'ANTICIPO', 'REG. ' || r.numero, null, r.id
  from public.regularizacion_documentos rd join public.regularizaciones_anticipo r on r.id = rd.regularizacion_id and r.estado = 'OPERADA';
grant select on public.compra_abonos to authenticated;

-- Documentos bancarios con cargo a la cuenta de anticipo, con lo ya regularizado en otras regularizaciones operadas.
create or replace function public.anticipos_disponibles(p_loc bigint, p_cuenta bigint, p_desde date, p_hasta date, p_regularizacion bigint default null)
returns table (movimiento_id bigint, cuenta_bancaria_id bigint, tipo text, numero_documento text, fecha date, descripcion text, tercero_nombre text, valor numeric, regularizado numeric, disponible numeric)
language sql stable security invoker set search_path = '' as $$
  select m.id, m.cuenta_bancaria_id, m.tipo, coalesce(m.numero_documento, m.folio::text), m.fecha, m.descripcion, m.tercero_nombre, a.valor,
         coalesce(g.valor, 0), a.valor - coalesce(g.valor, 0)
  from public.movimientos_bancarios m
  join lateral (select sum(l.debe) as valor from public.movimiento_lineas l where l.movimiento_id = m.id and l.cuenta_id = p_cuenta) a on a.valor > 0
  left join lateral (select sum(ra.valor) as valor from public.regularizacion_anticipos ra join public.regularizaciones_anticipo r on r.id = ra.regularizacion_id
                     where ra.movimiento_id = m.id and r.estado = 'OPERADA' and r.id is distinct from p_regularizacion) g on true
  where m.localidad_id = p_loc and m.estado = 'ACTIVO' and m.tipo in ('CHEQUE', 'NOTA_DEBITO') and m.fecha between p_desde and p_hasta
  order by m.fecha, m.id;
$$;

-- PROCESAR (genera la póliza), REVERSAR (anula la póliza y vuelve a vigente), ANULAR (una vigente).
create or replace function public.procesar_regularizacion(p_id bigint, p_accion text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.regularizaciones_anticipo;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_gtq bigint := (select x.id from public.monedas x where x.iso = 'GTQ');
  v_ant numeric; v_doc numeric; v_mal text;
  v_partida bigint; v_tipo bigint; v_n integer;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede procesar las regularizaciones de anticipos.'; end if;
  select * into r from public.regularizaciones_anticipo where id = p_id for update;
  if r.id is null then raise exception 'La regularización no existe.'; end if;
  perform set_config('fin.regularizacion', 'si', true);

  if p_accion = 'PROCESAR' then
    if r.estado <> 'VIGENTE' then raise exception 'La regularización % está %.', r.numero, lower(r.estado); end if;
    select coalesce(sum(valor), 0) into v_ant from public.regularizacion_anticipos where regularizacion_id = r.id;
    select coalesce(sum(valor), 0) into v_doc from public.regularizacion_documentos where regularizacion_id = r.id;
    if v_ant = 0 then raise exception 'Agrega los documentos de anticipo a regularizar.'; end if;
    if v_doc = 0 then raise exception 'Agrega los documentos a liquidar.'; end if;
    if v_ant <> v_doc then raise exception 'Los anticipos (Q%) y los documentos a liquidar (Q%) no cuadran.', v_ant, v_doc; end if;
    select string_agg(coalesce(d.numero_documento, '') || ' (disponible ' || coalesce(d.disponible, 0) || ')', ', ') into v_mal
    from public.regularizacion_anticipos ra
    left join public.anticipos_disponibles(r.localidad_id, r.cuenta_anticipo_id, '1900-01-01', '2999-12-31', r.id) d on d.movimiento_id = ra.movimiento_id
    where ra.regularizacion_id = r.id and ra.valor > coalesce(d.disponible, 0);
    if v_mal is not null then raise exception 'Se regulariza más de lo disponible del anticipo en: %.', v_mal; end if;
    select string_agg(c.numero || ' (pendiente ' || c.pendiente || ')', ', ') into v_mal
    from public.regularizacion_documentos rd join public.compras_saldo c on c.id = rd.compra_id
    where rd.regularizacion_id = r.id and (rd.valor > c.pendiente or c.estado <> 'ACTIVA');
    if v_mal is not null then raise exception 'Se liquida más de lo pendiente (o la compra está anulada) en las compras: %.', v_mal; end if;
    if exists (select 1 from public.regularizacion_documentos rd join public.compras c on c.id = rd.compra_id where rd.regularizacion_id = r.id and c.moneda_id is distinct from v_gtq) then
      raise exception 'Solo se liquidan compras en quetzales.';
    end if;
    select id into v_tipo from public.tipos_partida where siglas = 'PD';
    if v_tipo is null then select id into v_tipo from public.tipos_partida order by codigo limit 1; end if;
    insert into public.partidas (organizacion_id, localidad_id, anio, mes, tipo_partida_id, descripcion, moneda_id, tipo_cambio, justificacion)
    values (r.organizacion_id, r.localidad_id, extract(year from r.fecha_final)::integer, extract(month from r.fecha_final)::integer, v_tipo,
            left('REGULARIZACIÓN DE ANTICIPOS ' || r.numero || ' DEL ' || to_char(r.fecha_inicial, 'DD/MM/YYYY') || ' AL ' || to_char(r.fecha_final, 'DD/MM/YYYY')
                 || coalesce(' · ' || r.observaciones, ''), 300),
            v_gtq, 1, 'Generada desde Compras · Regularización de anticipos ' || r.numero)
    returning id into v_partida;
    insert into public.partida_lineas (partida_id, linea, cuenta_id, concepto, debe, haber)
    select v_partida, row_number() over (order by x.o, x.linea), x.cuenta, left(x.concepto, 200), x.debe, x.haber
    from (select 1 as o, rd.linea, r.cuenta_operar_id as cuenta,
                 'COMPRA ' || c.numero || ' · ' || coalesce(c.serie || '-', '') || c.documento || ' · ' || coalesce(c.proveedor_nombre, '') as concepto, rd.valor as debe, 0::numeric as haber
          from public.regularizacion_documentos rd join public.compras c on c.id = rd.compra_id where rd.regularizacion_id = r.id
          union all
          select 2, ra.linea, r.cuenta_anticipo_id,
                 'ANTICIPO ' || case when m.tipo = 'CHEQUE' then 'CH ' else 'ND ' end || coalesce(m.numero_documento, m.folio::text) || coalesce(' · ' || ra.descripcion, ''), 0, ra.valor
          from public.regularizacion_anticipos ra join public.movimientos_bancarios m on m.id = ra.movimiento_id where ra.regularizacion_id = r.id) x;
    update public.regularizaciones_anticipo set estado = 'OPERADA', partida_id = v_partida, operado_por = v_quien, operado_en = now(), reversado_por = null, reversado_en = null where id = r.id;

  elsif p_accion = 'REVERSAR' then
    if r.estado <> 'OPERADA' then raise exception 'La regularización % no está operada.', r.numero; end if;
    if r.partida_id is not null and exists (select 1 from public.partidas x where x.id = r.partida_id and x.estado = 'VIGENTE') then
      perform public.cambiar_estado_partida(r.partida_id, 'ANULAR', coalesce(nullif(trim(p_motivo), ''), 'REVERSIÓN DE LA REGULARIZACIÓN DE ANTICIPOS ' || r.numero));
    end if;
    update public.regularizaciones_anticipo set estado = 'VIGENTE', partida_id = null, operado_por = null, operado_en = null, reversado_por = v_quien, reversado_en = now() where id = r.id;

  elsif p_accion = 'ANULAR' then
    if r.estado <> 'VIGENTE' then raise exception 'Solo se anula una regularización vigente (reversa primero la operada).'; end if;
    update public.regularizaciones_anticipo set estado = 'ANULADA' where id = r.id;
  else
    raise exception 'Acción no válida.';
  end if;
  perform set_config('fin.regularizacion', '', true);
  select count(*) into v_n from public.regularizacion_documentos where regularizacion_id = r.id;
  return jsonb_build_object('numero', r.numero, 'documentos', v_n,
                            'partida', (select x.mes || '-' || x.numero from public.partidas x where x.id = v_partida));
end;
$$;

-- ---------- Seguridad ----------
do $$
declare t text;
begin
  foreach t in array array['regularizaciones_anticipo', 'regularizacion_anticipos', 'regularizacion_documentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format('drop policy if exists "%s: modificar" on public.%I', t, t);
    execute format('drop policy if exists "%s: quitar" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end;
$$;
create policy "regularizacion_anticipos: quitar" on public.regularizacion_anticipos for delete to authenticated using (public.puede_editar_catalogos());
create policy "regularizacion_documentos: quitar" on public.regularizacion_documentos for delete to authenticated using (public.puede_editar_catalogos());
grant delete on public.regularizacion_anticipos, public.regularizacion_documentos to authenticated;
revoke execute on function public.preparar_regularizacion() from public, anon, authenticated;
revoke execute on function public.validar_detalle_regularizacion() from public, anon, authenticated;
revoke execute on function public.procesar_regularizacion(bigint, text, text) from public, anon;
grant execute on function public.procesar_regularizacion(bigint, text, text) to authenticated;
revoke execute on function public.anticipos_disponibles(bigint, bigint, date, date, bigint) from public, anon;
grant execute on function public.anticipos_disponibles(bigint, bigint, date, date, bigint) to authenticated;

-- ---------- Menú: Regularización anticipos y el grupo Cuentas x Pagar ----------
insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
select m.id, 'registros', x.subgrupo, x.clave, x.nombre, coalesce((select max(orden) from public.opciones_sistema), 0) + x.n
from public.modulos_sistema m
cross join (values (1, 'Compras', 'regularizacion-anticipos', 'Regularización anticipos'),
                   (2, 'Cuentas x Pagar', 'cxp-mensual', 'Consolidado CXP mensual'),
                   (3, 'Cuentas x Pagar', 'cxp-general', 'Consolidado general'),
                   (4, 'Cuentas x Pagar', 'cxp-periodo', 'CXP por periodo')) as x (n, subgrupo, clave, nombre)
where m.siglas = 'COM' and m.modulo_mayor_id is null
  and not exists (select 1 from public.opciones_sistema o where o.clave = x.clave and o.modulo_id = m.id);

notify pgrst, 'reload schema';
