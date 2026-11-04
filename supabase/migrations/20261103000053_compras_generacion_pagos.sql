-- Caja y Bancos · Cheques: facturas de compra por pagar y generación automática de pagos.
--   compras: facturas y recibos de compra (por pagar) de cada localidad: número de compra
--   (correlativo), documento (factura o recibo, serie y número), fechas (documento, ingreso y
--   vencimiento), proveedor (tipo, código, nombre, NIT y beneficiario del pago), transacción,
--   moneda y cambio, valor total, bonificaciones, notas de crédito y descuentos por nota de débito,
--   forma de pago preferida (cheque o transferencia), cuenta bancaria de pago, banco y cuenta del
--   proveedor (transferencias) y cuenta por pagar. compra_lineas: su detalle contable.
--   compras_saldo (vista): neto = total − bonificaciones − notas de crédito − descuentos ND;
--   pagado = abonos de los cheques y transferencias activos; pendiente = neto − pagado.
--   movimiento_documentos.compra_id: la factura que paga un cheque o transferencia, con su abono
--   en la moneda de la compra (abono_compra); al anular el pago la compra vuelve a quedar pendiente.
--   generar_pagos_compras: con las compras elegidas genera los cheques (numerados por la chequera)
--   o las transferencias (notas de débito «TRANSFERENCIA»), uno por proveedor o uno por factura,
--   con sus facturas pagadas, su detalle contable (cuenta por pagar contra la cuenta del banco) y,
--   si se pide, su partida.
-- Escribir: administrador. Se ejecuta después del script 52.

-- ---------- Compras ----------
create table if not exists public.compras (
  id                 bigint generated always as identity primary key,
  organizacion_id    bigint not null references public.organizaciones (id),
  localidad_id       bigint not null,
  numero             integer not null,
  tipo_documento     text not null default 'FACTURA' check (tipo_documento in ('FACTURA', 'RECIBO')),
  serie              text,
  documento          text not null check (length(trim(documento)) > 0),
  fecha_documento    date not null default current_date,
  fecha_ingreso      date not null default current_date,
  fecha_vencimiento  date,
  tipo_tercero       text not null default 'PROVEEDOR PRODUCTOS' check (tipo_tercero in ('PROVEEDOR PRODUCTOS', 'PROVEEDOR SERVICIOS')),
  proveedor_codigo   text,
  proveedor_nombre   text not null check (length(trim(proveedor_nombre)) > 0),
  nit                text,
  beneficiario       text,
  transaccion_id     bigint references public.transacciones_contables (id) on delete set null,
  descripcion        text,
  moneda_id          bigint not null references public.monedas (id),
  tipo_cambio        numeric(18, 6) not null default 1 check (tipo_cambio > 0),
  valor_total        numeric(18, 2) not null check (valor_total > 0),
  bonificaciones     numeric(18, 2) not null default 0 check (bonificaciones >= 0),
  notas_credito      numeric(18, 2) not null default 0 check (notas_credito >= 0),
  descuentos_nd      numeric(18, 2) not null default 0 check (descuentos_nd >= 0),
  forma_pago         text not null default 'CHEQUE' check (forma_pago in ('CHEQUE', 'TRANSFERENCIA')),
  cuenta_bancaria_id bigint references public.cuentas_bancarias (id),
  banco_destino_id   bigint references public.bancos (id),
  cuenta_destino     text,
  cuenta_pagar_id    bigint references public.cuentas (id),
  estado             text not null default 'ACTIVA' check (estado in ('ACTIVA', 'ANULADA')),
  anulado_por        text,
  anulado_en         timestamptz,
  motivo_anulacion   text,
  partida_id         bigint references public.partidas (id) on delete set null,
  usuario            text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, numero),
  check (valor_total - bonificaciones - notas_credito - descuentos_nd >= 0)
);
create index if not exists compras_ingreso_idx on public.compras (localidad_id, fecha_ingreso desc);
create unique index if not exists compras_documento_key on public.compras
  (localidad_id, tipo_documento, upper(coalesce(proveedor_codigo, proveedor_nombre)), upper(coalesce(serie, '')), upper(documento)) where estado = 'ACTIVA';

create table if not exists public.compra_lineas (
  id        bigint generated always as identity primary key,
  compra_id bigint not null references public.compras (id) on delete cascade,
  linea     integer not null,
  cuenta_id bigint not null references public.cuentas (id),
  debe      numeric(18, 2) not null default 0 check (debe >= 0),
  haber     numeric(18, 2) not null default 0 check (haber >= 0),
  centro_id bigint references public.centros_costo (id),
  check (debe = 0 or haber = 0),
  unique (compra_id, linea)
);

alter table public.movimiento_documentos add column if not exists compra_id bigint references public.compras (id);
alter table public.movimiento_documentos add column if not exists abono_compra numeric(18, 2);
create index if not exists movimiento_documentos_compra_idx on public.movimiento_documentos (compra_id) where compra_id is not null;

-- Pagado de una compra (en su moneda) sin contar un documento.
create or replace function public.compra_pagado(p_compra bigint, p_sin bigint default null) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(d.abono_compra), 0)
  from public.movimiento_documentos d join public.movimientos_bancarios m on m.id = d.movimiento_id and m.estado = 'ACTIVO'
  where d.compra_id = p_compra and d.id is distinct from p_sin;
$$;

create or replace function public.preparar_compra() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_quien text := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
  v_proceso boolean := current_setting('fin.compra', true) = 'si';
  v_pagado numeric;
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4809, new.localidad_id::integer);
    new.numero := coalesce((select max(numero) from public.compras where localidad_id = new.localidad_id), 0) + 1;
    new.usuario := v_quien;
    new.estado := 'ACTIVA'; new.anulado_por := null; new.anulado_en := null; new.motivo_anulacion := null;
    new.partida_id := null;
  else
    new.organizacion_id := old.organizacion_id; new.localidad_id := old.localidad_id;
    new.numero := old.numero; new.usuario := old.usuario;
    if not v_proceso then
      if old.estado = 'ANULADA' then raise exception 'La compra % está anulada y ya no se modifica.', old.numero; end if;
      new.estado := old.estado; new.anulado_por := old.anulado_por; new.anulado_en := old.anulado_en; new.motivo_anulacion := old.motivo_anulacion;
      new.partida_id := old.partida_id;
      v_pagado := public.compra_pagado(old.id);
      if v_pagado > 0 and (new.moneda_id <> old.moneda_id or new.tipo_cambio <> old.tipo_cambio) then
        raise exception 'La compra % ya tiene pagos: no cambia su moneda ni su cambio.', old.numero;
      end if;
      if new.valor_total - new.bonificaciones - new.notas_credito - new.descuentos_nd < v_pagado then
        raise exception 'La compra % ya tiene pagado %: el neto no puede quedar debajo de lo pagado.', old.numero, v_pagado;
      end if;
      if old.partida_id is not null and (new.valor_total <> old.valor_total or new.fecha_ingreso <> old.fecha_ingreso) then
        raise exception 'La compra % ya generó su partida: no cambian su valor ni su fecha de ingreso.', old.numero;
      end if;
    end if;
  end if;
  if new.cuenta_bancaria_id is not null and not exists (select 1 from public.cuentas_bancarias where id = new.cuenta_bancaria_id and localidad_id = new.localidad_id) then
    raise exception 'La cuenta bancaria no es de la localidad de la compra.';
  end if;
  if new.transaccion_id is not null and not exists (select 1 from public.transacciones_contables where id = new.transaccion_id and localidad_id = new.localidad_id) then
    raise exception 'La transacción no es de la localidad de la compra.';
  end if;
  if new.cuenta_pagar_id is not null and not exists (
       select 1 from public.cuentas c join public.catalogos_cuentas k on k.id = c.catalogo_id
       where c.id = new.cuenta_pagar_id and k.localidad_id = new.localidad_id) then
    raise exception 'La cuenta por pagar no es del catálogo de la localidad.';
  end if;
  new.documento := upper(trim(new.documento));
  new.serie := nullif(upper(trim(new.serie)), '');
  new.proveedor_codigo := nullif(upper(trim(new.proveedor_codigo)), '');
  new.proveedor_nombre := upper(trim(new.proveedor_nombre));
  new.nit := nullif(upper(trim(new.nit)), '');
  new.beneficiario := coalesce(nullif(upper(trim(new.beneficiario)), ''), new.proveedor_nombre);
  new.descripcion := nullif(trim(new.descripcion), '');
  new.cuenta_destino := nullif(trim(new.cuenta_destino), '');
  return new;
end;
$$;
drop trigger if exists compras_preparar on public.compras;
create trigger compras_preparar before insert or update on public.compras for each row execute function public.preparar_compra();
drop trigger if exists compras_auditar on public.compras;
create trigger compras_auditar before insert or update on public.compras for each row execute function public.auditar();

create or replace function public.validar_compra_linea() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c public.compras;
begin
  select * into c from public.compras where id = coalesce(new.compra_id, old.compra_id);
  if c.estado = 'ANULADA' then raise exception 'La compra % está anulada.', c.numero; end if;
  if c.partida_id is not null then raise exception 'La compra % ya generó su partida: su detalle contable no cambia.', c.numero; end if;
  if tg_op = 'DELETE' then return old; end if;
  if not exists (select 1 from public.cuentas x join public.catalogos_cuentas k on k.id = x.catalogo_id
                 where x.id = new.cuenta_id and k.localidad_id = c.localidad_id) then
    raise exception 'La cuenta de la línea % no es del catálogo de la localidad.', new.linea;
  end if;
  if new.centro_id is not null and not exists (
       select 1 from public.centros_costo x join public.catalogos_centros k on k.id = x.catalogo_id
       where x.id = new.centro_id and k.localidad_id = c.localidad_id) then
    raise exception 'El centro de costo de la línea % no es de la localidad.', new.linea;
  end if;
  return new;
end;
$$;
drop trigger if exists compra_lineas_validar on public.compra_lineas;
create trigger compra_lineas_validar before insert or update or delete on public.compra_lineas for each row execute function public.validar_compra_linea();

-- Abono a una compra desde un cheque o transferencia: misma localidad, compra activa y sin pasar
-- su pendiente. El abono en la moneda de la compra sale del abono del documento.
create or replace function public.validar_abono_compra() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c public.compras;
  m public.movimientos_bancarios;
  v_resta numeric;
begin
  if new.compra_id is null then new.abono_compra := null; return new; end if;
  select * into c from public.compras where id = new.compra_id;
  select * into m from public.movimientos_bancarios where id = new.movimiento_id;
  if c.localidad_id is distinct from m.localidad_id then raise exception 'La compra no es de la localidad del documento bancario.'; end if;
  if c.estado <> 'ACTIVA' then raise exception 'La compra % está anulada.', c.numero; end if;
  if m.tipo not in ('CHEQUE', 'NOTA_DEBITO') then raise exception 'Una compra se paga con un cheque o una transferencia (nota de débito).'; end if;
  v_resta := c.valor_total - c.bonificaciones - c.notas_credito - c.descuentos_nd - public.compra_pagado(c.id, new.id);
  if c.moneda_id = m.moneda_id then
    new.abono_compra := new.abono;
  elsif (select iso from public.monedas where id = m.moneda_id) = 'GTQ' then
    new.abono_compra := round(new.abono / c.tipo_cambio, 2);
    if abs(new.abono_compra - v_resta) <= 0.01 then new.abono_compra := v_resta; end if;
  else
    raise exception 'La compra % es en otra moneda que la cuenta bancaria: págala desde una cuenta en quetzales o en su misma moneda.', c.numero;
  end if;
  if new.abono_compra <= 0 then raise exception 'El abono a la compra % debe ser mayor que cero.', c.numero; end if;
  if new.abono_compra > v_resta then
    raise exception 'El abono a la compra % (%) pasa de su pendiente (%).', c.numero, new.abono_compra, v_resta;
  end if;
  return new;
end;
$$;
drop trigger if exists movimiento_documentos_compra on public.movimiento_documentos;
create trigger movimiento_documentos_compra before insert or update on public.movimiento_documentos for each row execute function public.validar_abono_compra();

-- ---------- Saldo de las compras ----------
create or replace view public.compras_saldo with (security_invoker = true) as
  select c.*,
         c.valor_total - c.bonificaciones - c.notas_credito - c.descuentos_nd as neto,
         coalesce(p.pagado, 0) as pagado,
         c.valor_total - c.bonificaciones - c.notas_credito - c.descuentos_nd - coalesce(p.pagado, 0) as pendiente,
         coalesce(p.pagos, 0) as pagos,
         p.ultimo_pago
  from public.compras c
  left join lateral (
    select sum(d.abono_compra) as pagado, count(*) as pagos,
           string_agg(case when m.tipo = 'CHEQUE' then 'CH ' else 'TRF ' end || coalesce(m.numero_documento, m.folio::text), ', ' order by m.fecha, m.id) as ultimo_pago
    from public.movimiento_documentos d join public.movimientos_bancarios m on m.id = d.movimiento_id and m.estado = 'ACTIVO'
    where d.compra_id = c.id) p on true;

-- ---------- Anular y generar la partida de compras ----------
create or replace function public.procesar_compra(p_id bigint, p_accion text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.compras;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_debe numeric; v_haber numeric; v_lineas integer;
  v_partida bigint; v_tipo bigint;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede procesar compras.'; end if;
  select * into c from public.compras where id = p_id for update;
  if c.id is null then raise exception 'La compra no existe.'; end if;
  if c.estado = 'ANULADA' then raise exception 'La compra % está anulada.', c.numero; end if;
  perform set_config('fin.compra', 'si', true);
  if p_accion = 'ANULAR' then
    if public.compra_pagado(c.id) > 0 then raise exception 'La compra % tiene pagos activos: anula primero sus cheques o transferencias.', c.numero; end if;
    if c.partida_id is not null and exists (select 1 from public.partidas p where p.id = c.partida_id and p.estado = 'VIGENTE') then
      raise exception 'Primero anula la partida % de la compra en Partidas contables.', (select p.mes || '-' || p.numero from public.partidas p where p.id = c.partida_id);
    end if;
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la anulación.'; end if;
    update public.compras set estado = 'ANULADA', anulado_por = v_quien, anulado_en = now(), motivo_anulacion = trim(p_motivo) where id = c.id;
  elsif p_accion = 'PARTIDA' then
    if c.partida_id is not null then raise exception 'La compra % ya generó su partida.', c.numero; end if;
    select count(*), coalesce(sum(debe), 0), coalesce(sum(haber), 0) into v_lineas, v_debe, v_haber from public.compra_lineas where compra_id = c.id;
    if v_lineas < 2 then raise exception 'Contabiliza la compra: necesita al menos dos líneas en el detalle contable.'; end if;
    if v_debe <> v_haber then raise exception 'El detalle contable no cuadra: debe % y haber %.', v_debe, v_haber; end if;
    select id into v_tipo from public.tipos_partida where siglas = 'PC';
    if v_tipo is null then select id into v_tipo from public.tipos_partida order by codigo limit 1; end if;
    insert into public.partidas (organizacion_id, localidad_id, anio, mes, tipo_partida_id, descripcion, moneda_id, tipo_cambio, justificacion)
    values (c.organizacion_id, c.localidad_id, extract(year from c.fecha_ingreso), extract(month from c.fecha_ingreso), v_tipo,
            'COMPRA ' || c.numero || ' · ' || c.tipo_documento || ' ' || coalesce(c.serie || '-', '') || c.documento || ' · ' || c.proveedor_nombre,
            coalesce((select x.id from public.monedas x where x.iso = 'GTQ'), c.moneda_id), 1,
            'Generada desde Facturas de compra · compra ' || c.numero)
    returning id into v_partida;
    insert into public.partida_lineas (partida_id, linea, cuenta_id, concepto, debe, haber, centro_id)
    select v_partida, l.linea, l.cuenta_id, left(coalesce(c.descripcion, c.proveedor_nombre), 200), l.debe, l.haber, l.centro_id
    from public.compra_lineas l where l.compra_id = c.id order by l.linea;
    update public.compras set partida_id = v_partida where id = c.id;
    perform set_config('fin.compra', '', true);
    return jsonb_build_object('numero', c.numero, 'partida', (select p.mes || '-' || p.numero from public.partidas p where p.id = v_partida));
  else
    raise exception 'Acción no válida.';
  end if;
  perform set_config('fin.compra', '', true);
  return jsonb_build_object('numero', c.numero);
end;
$$;

-- ---------- Generación de cheques y transferencias ----------
-- p_forma: CHEQUE o TRANSFERENCIA. p_agrupar: un pago por proveedor (y beneficiario) o uno por
-- compra. p_tipo_cambio: el cambio del pago cuando la cuenta bancaria no es en quetzales.
-- Devuelve los pagos generados: [{ id, folio, numero, beneficiario, valor, compras, partida }].
create or replace function public.generar_pagos_compras(
  p_compras bigint[], p_forma text, p_cuenta bigint, p_fecha date, p_agrupar boolean default true,
  p_transaccion bigint default null, p_descripcion text default null, p_partida boolean default false,
  p_tipo_cambio numeric default null, p_referencia text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  cb public.cuentas_bancarias;
  v_iso text;
  v_tc numeric;
  g record;
  c record;
  v_mov bigint;
  v_valor numeric; v_linea integer; v_debe numeric;
  v_res jsonb := '[]'::jsonb;
  v_num text; v_folio integer; v_partida jsonb;
  v_n integer := 0;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede generar cheques y transferencias.'; end if;
  if p_forma not in ('CHEQUE', 'TRANSFERENCIA') then raise exception 'Forma de pago no válida.'; end if;
  if coalesce(array_length(p_compras, 1), 0) = 0 then raise exception 'Marca las compras que vas a pagar.'; end if;
  select * into cb from public.cuentas_bancarias where id = p_cuenta;
  if cb.id is null then raise exception 'Elige la cuenta bancaria.'; end if;
  if not cb.activo then raise exception 'La cuenta bancaria % está inactiva.', cb.numero; end if;
  if p_fecha is null then raise exception 'Escribe la fecha del pago.'; end if;
  select iso into v_iso from public.monedas where id = cb.moneda_id;
  v_tc := case when v_iso = 'GTQ' then 1 else coalesce(p_tipo_cambio, 0) end;
  if v_tc <= 0 then raise exception 'Escribe el tipo de cambio del pago (la cuenta % no es en quetzales).', cb.numero; end if;
  if p_transaccion is not null and not exists (select 1 from public.transacciones_contables where id = p_transaccion and localidad_id = cb.localidad_id) then
    raise exception 'La transacción no es de la localidad de la cuenta bancaria.';
  end if;

  -- Las compras elegidas, bloqueadas y validadas.
  perform 1 from public.compras where id = any (p_compras) for update;
  for c in select s.* from public.compras_saldo s where s.id = any (p_compras) loop
    if c.localidad_id <> cb.localidad_id then raise exception 'La compra % no es de la localidad de la cuenta bancaria.', c.numero; end if;
    if c.estado <> 'ACTIVA' then raise exception 'La compra % está anulada.', c.numero; end if;
    if c.pendiente <= 0 then raise exception 'La compra % ya está pagada.', c.numero; end if;
    if c.moneda_id <> cb.moneda_id and v_iso <> 'GTQ' then
      raise exception 'La compra % es en otra moneda que la cuenta %: págala desde una cuenta en quetzales o en su misma moneda.', c.numero, cb.numero;
    end if;
    if p_forma = 'TRANSFERENCIA' and c.cuenta_destino is null then
      raise exception 'La compra % (%) no tiene la cuenta bancaria del proveedor para transferirle.', c.numero, c.proveedor_nombre;
    end if;
  end loop;
  if (select count(*) from public.compras where id = any (p_compras)) <> (select count(distinct x) from unnest(p_compras) x) then
    raise exception 'Alguna de las compras elegidas ya no existe.';
  end if;

  perform set_config('fin.banco', 'si', true);
  for g in
    select case when p_agrupar then upper(coalesce(s.proveedor_codigo, s.proveedor_nombre)) || '|' || s.beneficiario || '|' || coalesce(s.cuenta_destino, '') else s.id::text end as clave,
           min(s.proveedor_codigo) as proveedor_codigo, min(s.proveedor_nombre) as proveedor_nombre, min(s.beneficiario) as beneficiario,
           min(s.tipo_tercero) as tipo_tercero, min(s.banco_destino_id) as banco_destino_id, min(s.cuenta_destino) as cuenta_destino,
           array_agg(s.id order by s.fecha_ingreso, s.numero) as ids,
           string_agg(s.tipo_documento || ' ' || coalesce(s.serie || '-', '') || s.documento, ', ' order by s.fecha_ingreso, s.numero) as docs
    from public.compras_saldo s where s.id = any (p_compras)
    group by 1 order by min(s.proveedor_nombre), 1
  loop
    -- Valor del pago en la moneda de la cuenta.
    select sum(case when s.moneda_id = cb.moneda_id then s.pendiente else round(s.pendiente * s.tipo_cambio, 2) end) into v_valor
    from public.compras_saldo s where s.id = any (g.ids);
    insert into public.movimientos_bancarios (organizacion_id, localidad_id, cuenta_bancaria_id, tipo, fecha, moneda_id, tipo_cambio, valor,
                                              descripcion, tipo_tercero, tercero_codigo, tercero_nombre, tipo_operacion, deposito_por, transaccion_id, no_negociable)
    values (cb.organizacion_id, cb.localidad_id, cb.id, case when p_forma = 'CHEQUE' then 'CHEQUE' else 'NOTA_DEBITO' end, p_fecha, cb.moneda_id, v_tc, v_valor,
            left(coalesce(nullif(trim(p_descripcion), '') || ' · ', '') || 'PAGO ' || g.docs, 300),
            g.tipo_tercero, g.proveedor_codigo, g.proveedor_nombre, case when p_forma = 'CHEQUE' then 'PAGO A PROVEEDORES' else 'TRANSFERENCIA' end,
            g.beneficiario, p_transaccion, p_forma = 'CHEQUE')
    returning id, folio, numero_documento into v_mov, v_folio, v_num;
    if p_forma = 'TRANSFERENCIA' then
      v_num := coalesce(nullif(trim(p_referencia), '') || '-', 'TRF-') || lpad(v_folio::text, 5, '0');
      update public.movimientos_bancarios set numero_documento = v_num,
             descripcion = left(descripcion || ' · A ' || coalesce((select b.siglas from public.bancos b where b.id = g.banco_destino_id), '') || ' ' || g.cuenta_destino, 300)
      where id = v_mov;
    end if;
    -- Facturas pagadas.
    insert into public.movimiento_documentos (movimiento_id, tipo, serie, numero, tercero, nombre, valor, valor_ml, abono, abono_ml, fecha, estado, compra_id)
    select v_mov, s.tipo_documento, s.serie, s.documento, s.proveedor_codigo, s.proveedor_nombre,
           case when s.moneda_id = cb.moneda_id then s.neto else round(s.neto * s.tipo_cambio, 2) end,
           round((case when s.moneda_id = cb.moneda_id then s.neto else round(s.neto * s.tipo_cambio, 2) end) * v_tc, 2),
           case when s.moneda_id = cb.moneda_id then s.pendiente else round(s.pendiente * s.tipo_cambio, 2) end,
           round((case when s.moneda_id = cb.moneda_id then s.pendiente else round(s.pendiente * s.tipo_cambio, 2) end) * v_tc, 2),
           s.fecha_documento, 'APLICADO', s.id
    from public.compras_saldo s where s.id = any (g.ids) order by s.fecha_ingreso, s.numero;
    -- Detalle contable: cuentas por pagar al debe y la cuenta del banco al haber (en quetzales).
    if cb.cuenta_id is not null and not exists (select 1 from public.compras where id = any (g.ids) and cuenta_pagar_id is null) then
      v_linea := 0;
      for c in select x.cuenta_pagar_id, sum(d.abono_ml) as ml from public.movimiento_documentos d join public.compras x on x.id = d.compra_id
               where d.movimiento_id = v_mov group by x.cuenta_pagar_id order by min(d.id) loop
        v_linea := v_linea + 1;
        insert into public.movimiento_lineas (movimiento_id, linea, cuenta_id, debe, haber) values (v_mov, v_linea, c.cuenta_pagar_id, c.ml, 0);
      end loop;
      select sum(debe) into v_debe from public.movimiento_lineas where movimiento_id = v_mov;
      insert into public.movimiento_lineas (movimiento_id, linea, cuenta_id, debe, haber) values (v_mov, v_linea + 1, cb.cuenta_id, 0, v_debe);
      if p_partida then
        v_partida := public.procesar_movimiento_bancario(v_mov, 'PARTIDA');
        perform set_config('fin.banco', 'si', true);
      end if;
    end if;
    select numero_documento into v_num from public.movimientos_bancarios where id = v_mov;
    v_n := v_n + 1;
    v_res := v_res || jsonb_build_object('id', v_mov, 'folio', v_folio, 'numero', v_num, 'beneficiario', g.beneficiario, 'valor', v_valor,
                                         'compras', to_jsonb(g.ids), 'documentos', g.docs, 'banco_destino_id', g.banco_destino_id, 'cuenta_destino', g.cuenta_destino,
                                         'contabilizado', cb.cuenta_id is not null and not exists (select 1 from public.compras where id = any (g.ids) and cuenta_pagar_id is null),
                                         'partida', case when p_partida then v_partida ->> 'partida' end);
    v_partida := null;
  end loop;
  perform set_config('fin.banco', '', true);
  return v_res;
end;
$$;

-- ---------- Seguridad ----------
do $$
declare t text;
begin
  foreach t in array array['compras', 'compra_lineas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format('drop policy if exists "%s: modificar" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
  end loop;
end;
$$;
drop policy if exists "compra_lineas: quitar" on public.compra_lineas;
create policy "compra_lineas: quitar" on public.compra_lineas for delete to authenticated using (public.puede_editar_catalogos());
grant select, insert, update on public.compras to authenticated;
grant select, insert, update, delete on public.compra_lineas to authenticated;
grant select on public.compras_saldo to authenticated;

revoke execute on function public.preparar_compra() from public, anon, authenticated;
revoke execute on function public.validar_compra_linea() from public, anon, authenticated;
revoke execute on function public.validar_abono_compra() from public, anon, authenticated;
revoke execute on function public.compra_pagado(bigint, bigint) from public, anon, authenticated;
revoke execute on function public.procesar_compra(bigint, text, text) from public, anon;
revoke execute on function public.generar_pagos_compras(bigint[], text, bigint, date, boolean, bigint, text, boolean, numeric, text) from public, anon;
grant execute on function public.procesar_compra(bigint, text, text) to authenticated;
grant execute on function public.generar_pagos_compras(bigint[], text, bigint, date, boolean, bigint, text, boolean, numeric, text) to authenticated;

-- ---------- Menú: Caja y Bancos · Cheques (debajo de Emisión de cheques) ----------
do $$
declare
  v_m bigint := (select id from public.modulos_sistema where siglas = 'CYB' and modulo_mayor_id is null);
  v_orden integer := (select orden from public.opciones_sistema where clave = 'emision-de-cheques' and modulo_id = v_m);
begin
  if v_m is null then return; end if;
  if v_orden is null then v_orden := coalesce((select max(orden) from public.opciones_sistema), 0); end if;
  if not exists (select 1 from public.opciones_sistema where clave = 'generacion-cheques' and modulo_id = v_m) then
    update public.opciones_sistema set orden = orden + 3 where orden > v_orden;
    insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values
      (v_m, 'cheques', 'Cheques', 'generacion-cheques', 'Generación cheques', v_orden + 1),
      (v_m, 'cheques', 'Cheques', 'generacion-transferencias', 'Generación transferencias', v_orden + 2),
      (v_m, 'cheques', 'Cheques', 'facturas-de-compra', 'Facturas de compra por pagar', v_orden + 3);
  end if;
end;
$$;

notify pgrst, 'reload schema';
