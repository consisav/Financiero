-- Compras · Registros · Notas crédito compras y Productos en consignación.
--   Notas: notas de crédito (y de débito) de los proveedores.
--   notas_compra: encabezado (autorización, serie y número del DTE, fecha, moneda, proveedor, bodega
--   destino, factura de referencia, motivo y tipo de ajuste, tipo de nota y póliza).
--   nota_compra_lineas: productos o conceptos de la nota (cantidad, precio, si mueve inventario, lote,
--   registro sanitario, vencimiento, fabricación y bodega).
--   nota_compra_contable: el detalle contable que se vuelve póliza al descargar.
--   procesar_nota_compra: DESCARGAR (saca del inventario las devoluciones, genera la póliza y la nota
--   rebaja la compra), REVERSAR (lo deshace y anula la póliza) y ANULAR (una vigente).
--   compras_saldo: el neto de la compra resta las notas de crédito y suma las de débito operadas.
--   consignaciones: Productos en consignación (partes de depósito de envío o devolución) con
--   procesar_consignacion (CARGAR al inventario, REVERTIR la carga, ANULAR).
-- Escribir: administrador. Se ejecuta después del script 64.

create table if not exists public.notas_compra (
  id                    bigint generated always as identity primary key,
  organizacion_id       bigint not null references public.organizaciones (id),
  localidad_id          bigint not null references public.localidades (id),
  numero                integer not null,
  tipo                  text not null default 'NOTA DE CRÉDITO' check (tipo in ('NOTA DE CRÉDITO', 'NOTA DE DÉBITO')),
  numero_autorizacion   text,
  serie                 text,
  documento             text not null,
  fecha                 date not null default current_date,
  moneda_id             bigint not null references public.monedas (id),
  tipo_cambio           numeric(18, 8) not null default 1 check (tipo_cambio > 0),
  valor                 numeric(18, 2) not null default 0 check (valor >= 0),
  proveedor_id          bigint not null references public.proveedores (id),
  proveedor_codigo      text,
  proveedor_nombre      text,
  nit                   text,
  bodega_id             bigint references public.bodegas (id),
  compra_id             bigint references public.compras (id),
  motivo                text,
  tipo_ajuste           text not null default 'DEVOLUCIÓN' check (tipo_ajuste in ('DEVOLUCIÓN', 'DESCUENTO', 'BONIFICACIÓN', 'AJUSTE DE PRECIO', 'OTRO')),
  tipo_nota             text not null default 'MANUAL' check (tipo_nota in ('MANUAL', 'AUTOMÁTICA')),
  estado                text not null default 'VIGENTE' check (estado in ('VIGENTE', 'OPERADA', 'ANULADA')),
  partida_id            bigint references public.partidas (id) on delete set null,
  usuario               text,
  operado_por           text,
  operado_en            timestamptz,
  anulado_por           text,
  anulado_en            timestamptz,
  motivo_anulacion      text,
  creado_por            uuid,
  creado_por_nombre     text,
  creado_en             timestamptz,
  modificado_por        uuid,
  modificado_por_nombre text,
  modificado_en         timestamptz,
  unique (localidad_id, numero)
);
create index if not exists notas_compra_compra_idx on public.notas_compra (compra_id);
create index if not exists notas_compra_proveedor_idx on public.notas_compra (proveedor_id);

create table if not exists public.nota_compra_lineas (
  id                 bigint generated always as identity primary key,
  nota_id            bigint not null references public.notas_compra (id) on delete cascade,
  linea              integer not null,
  producto_id        bigint references public.productos (id),
  descripcion        text,
  cantidad           numeric(14, 4) not null default 1 check (cantidad > 0),
  precio             numeric(18, 4) not null default 0 check (precio >= 0),
  total              numeric(18, 2) generated always as (round(cantidad * precio, 2)) stored,
  inventario         boolean not null default false,
  tipo_medida_id     bigint references public.tipos_medida (id),
  lote               text,
  registro_sanitario text,
  fecha_vencimiento  date,
  fecha_fabricacion  date,
  bodega_id          bigint references public.bodegas (id),
  unique (nota_id, linea),
  check (producto_id is not null or nullif(trim(descripcion), '') is not null),
  check (not inventario or producto_id is not null)
);
create table if not exists public.nota_compra_contable (
  id        bigint generated always as identity primary key,
  nota_id   bigint not null references public.notas_compra (id) on delete cascade,
  linea     integer not null,
  cuenta_id bigint not null references public.cuentas (id),
  concepto  text,
  debe      numeric(18, 2) not null default 0 check (debe >= 0),
  haber     numeric(18, 2) not null default 0 check (haber >= 0),
  centro_id bigint references public.centros_costo (id),
  unique (nota_id, linea)
);

alter table public.inventario_movimientos add column if not exists nota_linea_id bigint references public.nota_compra_lineas (id) on delete cascade;
alter table public.inventario_movimientos drop constraint if exists inventario_movimientos_origen_check;
alter table public.inventario_movimientos add constraint inventario_movimientos_origen_check check (origen in ('INGRESO', 'COMPRA', 'NOTA', 'AJUSTE', 'DESPACHO', 'TRASLADO'));

-- Número correlativo por localidad; el estado y la póliza solo cambian con procesar_nota_compra.
create or replace function public.preparar_nota_compra() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.compras;
begin
  if current_setting('fin.nota', true) is distinct from 'si' then
    if tg_op = 'INSERT' then
      perform pg_advisory_xact_lock(hashtext('nota_compra'), new.localidad_id::integer);
      new.numero := coalesce((select max(numero) from public.notas_compra where localidad_id = new.localidad_id), 0) + 1;
      new.estado := 'VIGENTE'; new.partida_id := null; new.operado_por := null; new.operado_en := null;
      new.anulado_por := null; new.anulado_en := null; new.motivo_anulacion := null;
      new.usuario := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
    else
      if old.estado <> 'VIGENTE' then raise exception 'La nota % está %: ya no se modifica.', old.numero, lower(old.estado); end if;
      new.numero := old.numero; new.estado := old.estado; new.partida_id := old.partida_id; new.usuario := old.usuario;
      new.localidad_id := old.localidad_id; new.organizacion_id := old.organizacion_id;
    end if;
  end if;
  if not exists (select 1 from public.localidades l where l.id = new.localidad_id and l.organizacion_id = new.organizacion_id) then
    raise exception 'La localidad no es de la organización.';
  end if;
  if not exists (select 1 from public.proveedores p where p.id = new.proveedor_id and p.localidad_id = new.localidad_id) then
    raise exception 'El proveedor no es de la empresa.';
  end if;
  if new.compra_id is not null then
    select * into c from public.compras where id = new.compra_id;
    if c.localidad_id <> new.localidad_id then raise exception 'La factura de referencia no es de la empresa.'; end if;
    if c.proveedor_id is distinct from new.proveedor_id then raise exception 'La factura de referencia es de otro proveedor.'; end if;
  end if;
  new.serie := nullif(upper(trim(new.serie)), '');
  new.documento := upper(trim(new.documento));
  new.numero_autorizacion := nullif(upper(trim(new.numero_autorizacion)), '');
  new.motivo := nullif(upper(trim(new.motivo)), '');
  return new;
end;
$$;
drop trigger if exists notas_compra_preparar on public.notas_compra;
create trigger notas_compra_preparar before insert or update on public.notas_compra for each row execute function public.preparar_nota_compra();
drop trigger if exists notas_compra_auditar on public.notas_compra;
create trigger notas_compra_auditar before insert or update on public.notas_compra for each row execute function public.auditar();

-- El detalle solo cambia mientras la nota está vigente.
create or replace function public.validar_detalle_nota_compra() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n public.notas_compra;
begin
  select * into n from public.notas_compra where id = coalesce(new.nota_id, old.nota_id);
  if n.estado <> 'VIGENTE' and current_setting('fin.nota', true) is distinct from 'si' then
    raise exception 'La nota % está %: su detalle ya no se modifica.', n.numero, lower(n.estado);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_table_name = 'nota_compra_lineas' then
    if new.producto_id is not null and not exists (select 1 from public.productos p where p.id = new.producto_id and p.localidad_id = n.localidad_id) then
      raise exception 'El producto de la línea % no es de la empresa.', new.linea;
    end if;
    new.descripcion := nullif(upper(trim(new.descripcion)), '');
    new.lote := nullif(upper(trim(new.lote)), '');
    new.registro_sanitario := nullif(upper(trim(new.registro_sanitario)), '');
  else
    new.concepto := nullif(upper(trim(new.concepto)), '');
  end if;
  return new;
end;
$$;
drop trigger if exists nota_compra_lineas_validar on public.nota_compra_lineas;
create trigger nota_compra_lineas_validar before insert or update or delete on public.nota_compra_lineas for each row execute function public.validar_detalle_nota_compra();
drop trigger if exists nota_compra_contable_validar on public.nota_compra_contable;
create trigger nota_compra_contable_validar before insert or update or delete on public.nota_compra_contable for each row execute function public.validar_detalle_nota_compra();

-- Neto de las compras: rebajado por las notas de crédito y aumentado por las de débito operadas.
create or replace view public.compras_saldo with (security_invoker = true) as
  select c.*,
         c.valor_total - c.bonificaciones - c.notas_credito - c.descuentos_nd - coalesce(n.ajuste, 0) as neto,
         coalesce(p.pagado, 0) as pagado,
         c.valor_total - c.bonificaciones - c.notas_credito - c.descuentos_nd - coalesce(n.ajuste, 0) - coalesce(p.pagado, 0) as pendiente,
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
          where rd.compra_id = c.id) x) p on true
  left join lateral (
    select sum(case when nc.tipo = 'NOTA DE CRÉDITO' then nc.valor else -nc.valor end) as ajuste
    from public.notas_compra nc where nc.compra_id = c.id and nc.estado = 'OPERADA') n on true;
grant select on public.compras_saldo to authenticated;

create or replace function public.procesar_nota_compra(p_id bigint, p_accion text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n public.notas_compra;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_gtq bigint := (select x.id from public.monedas x where x.iso = 'GTQ');
  v_total numeric; v_debe numeric; v_haber numeric; v_lineas integer; v_mal text; v_pend numeric;
  v_partida bigint; v_tipo bigint; v_signo integer;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede procesar las notas de compras.'; end if;
  select * into n from public.notas_compra where id = p_id for update;
  if n.id is null then raise exception 'La nota no existe.'; end if;
  perform set_config('fin.nota', 'si', true);
  v_signo := case when n.tipo = 'NOTA DE CRÉDITO' then -1 else 1 end;

  if p_accion = 'DESCARGAR' then
    if n.estado <> 'VIGENTE' then raise exception 'La nota % está %.', n.numero, lower(n.estado); end if;
    select coalesce(sum(total), 0), count(*) into v_total, v_lineas from public.nota_compra_lineas where nota_id = n.id;
    if v_lineas = 0 then raise exception 'Agrega el detalle de la nota %.', n.numero; end if;
    if v_total <> n.valor then raise exception 'El valor de la nota (%) no es la suma de su detalle (%).', n.valor, v_total; end if;
    if n.compra_id is not null then
      if exists (select 1 from public.compras c where c.id = n.compra_id and (c.estado <> 'ACTIVA' or c.moneda_id <> n.moneda_id)) then
        raise exception 'La factura de referencia está anulada o es de otra moneda.';
      end if;
      if n.tipo = 'NOTA DE CRÉDITO' then
        select pendiente into v_pend from public.compras_saldo where id = n.compra_id;
        if n.valor > v_pend then raise exception 'La nota (%) pasa del saldo pendiente de la factura de referencia (%).', n.valor, v_pend; end if;
      end if;
    end if;
    -- Inventario: la nota de crédito saca de la bodega lo devuelto; la de débito lo ingresa.
    if exists (select 1 from public.nota_compra_lineas l where l.nota_id = n.id and l.inventario and coalesce(l.bodega_id, n.bodega_id) is null) then
      raise exception 'Elige la bodega de los productos que mueven inventario.';
    end if;
    if v_signo < 0 then
      select string_agg(p.nombre || ' (existencia ' || coalesce(e.existencia, 0) || ')', ', ') into v_mal
      from (select l.producto_id, coalesce(l.bodega_id, n.bodega_id) as bodega_id, sum(l.cantidad) as cant
            from public.nota_compra_lineas l where l.nota_id = n.id and l.inventario group by 1, 2) x
      join public.productos p on p.id = x.producto_id
      left join public.existencias e on e.producto_id = x.producto_id and e.bodega_id = x.bodega_id
      where x.cant > coalesce(e.existencia, 0);
      if v_mal is not null then raise exception 'No hay existencia suficiente para devolver: %.', v_mal; end if;
    end if;
    insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, nota_linea_id, lote, fecha_vencimiento, usuario)
    select n.organizacion_id, n.localidad_id, l.producto_id, coalesce(l.bodega_id, n.bodega_id), n.fecha, v_signo * l.cantidad,
           round(l.precio * public.cambio_a_base(n.moneda_id, n.tipo_cambio), 4), 'NOTA', l.id, l.lote, l.fecha_vencimiento, v_quien
    from public.nota_compra_lineas l where l.nota_id = n.id and l.inventario;
    -- Póliza con el detalle contable (si lo tiene).
    select coalesce(sum(debe), 0), coalesce(sum(haber), 0), count(*) into v_debe, v_haber, v_lineas from public.nota_compra_contable where nota_id = n.id;
    if v_lineas > 0 then
      if v_debe <> v_haber or v_debe = 0 then raise exception 'El detalle contable no cuadra: debe % y haber %.', v_debe, v_haber; end if;
      select id into v_tipo from public.tipos_partida where siglas = 'PC';
      if v_tipo is null then select id into v_tipo from public.tipos_partida order by codigo limit 1; end if;
      insert into public.partidas (organizacion_id, localidad_id, anio, mes, tipo_partida_id, descripcion, moneda_id, tipo_cambio, justificacion)
      values (n.organizacion_id, n.localidad_id, extract(year from n.fecha)::integer, extract(month from n.fecha)::integer, v_tipo,
              left(n.tipo || ' ' || coalesce(n.serie || '-', '') || n.documento || ' · ' || coalesce(n.proveedor_nombre, '') || coalesce(' · ' || n.motivo, ''), 300),
              v_gtq, 1, 'Generada desde Compras · Notas crédito compras ' || n.numero)
      returning id into v_partida;
      insert into public.partida_lineas (partida_id, linea, cuenta_id, concepto, debe, haber, centro_id)
      select v_partida, row_number() over (order by k.linea), k.cuenta_id, left(coalesce(k.concepto, n.tipo || ' ' || n.documento), 200), k.debe, k.haber, k.centro_id
      from public.nota_compra_contable k where k.nota_id = n.id;
    end if;
    update public.notas_compra set estado = 'OPERADA', partida_id = v_partida, operado_por = v_quien, operado_en = now() where id = n.id;

  elsif p_accion = 'REVERSAR' then
    if n.estado <> 'OPERADA' then raise exception 'La nota % no está operada.', n.numero; end if;
    if n.partida_id is not null and exists (select 1 from public.partidas x where x.id = n.partida_id and x.estado = 'VIGENTE') then
      perform public.cambiar_estado_partida(n.partida_id, 'ANULAR', coalesce(nullif(trim(p_motivo), ''), 'REVERSIÓN DE LA NOTA DE COMPRA ' || n.numero));
    end if;
    delete from public.inventario_movimientos where nota_linea_id in (select id from public.nota_compra_lineas where nota_id = n.id);
    update public.notas_compra set estado = 'VIGENTE', partida_id = null, operado_por = null, operado_en = null where id = n.id;

  elsif p_accion = 'ANULAR' then
    if n.estado <> 'VIGENTE' then raise exception 'Solo se anula una nota vigente (reversa primero la operada).'; end if;
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la anulación.'; end if;
    update public.notas_compra set estado = 'ANULADA', anulado_por = v_quien, anulado_en = now(), motivo_anulacion = upper(trim(p_motivo)) where id = n.id;
  else
    raise exception 'Acción no válida.';
  end if;
  perform set_config('fin.nota', '', true);
  return jsonb_build_object('numero', n.numero, 'partida', (select x.mes || '-' || x.numero from public.partidas x where x.id = v_partida));
end;
$$;

-- ---------- Seguridad ----------
do $$
declare t text;
begin
  foreach t in array array['notas_compra', 'nota_compra_lineas', 'nota_compra_contable'] loop
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
create policy "nota_compra_lineas: quitar" on public.nota_compra_lineas for delete to authenticated using (public.puede_editar_catalogos());
create policy "nota_compra_contable: quitar" on public.nota_compra_contable for delete to authenticated using (public.puede_editar_catalogos());
grant delete on public.nota_compra_lineas, public.nota_compra_contable to authenticated;
revoke execute on function public.preparar_nota_compra() from public, anon, authenticated;
revoke execute on function public.validar_detalle_nota_compra() from public, anon, authenticated;
revoke execute on function public.procesar_nota_compra(bigint, text, text) from public, anon;
grant execute on function public.procesar_nota_compra(bigint, text, text) to authenticated;

-- ===================== Productos en consignación =====================
-- Partes de depósito del proveedor: ENVÍO (la mercadería entra a la bodega sin ser compra) o
-- DEVOLUCIÓN (sale de la bodega de regreso al proveedor). CARGAR mueve el inventario, REVERTIR lo
-- deshace y ANULAR anula uno vigente.
create table if not exists public.consignaciones (
  id                    bigint generated always as identity primary key,
  organizacion_id       bigint not null references public.organizaciones (id),
  localidad_id          bigint not null references public.localidades (id),
  numero                integer not null,
  tipo_documento        text not null default 'ENVÍO' check (tipo_documento in ('ENVÍO', 'DEVOLUCIÓN')),
  serie                 text,
  documento             text,
  fecha_documento       date not null default current_date,
  proveedor_id          bigint not null references public.proveedores (id),
  proveedor_nombre      text,
  bodega_id             bigint not null references public.bodegas (id),
  transaccion_id        bigint references public.transacciones_contables (id) on delete set null,
  descripcion           text,
  valor_total           numeric(18, 2) not null default 0 check (valor_total >= 0),
  estado                text not null default 'VIGENTE' check (estado in ('VIGENTE', 'CARGADA', 'ANULADA')),
  usuario               text,
  cargado_por           text,
  cargado_en            timestamptz,
  anulado_por           text,
  anulado_en            timestamptz,
  motivo_anulacion      text,
  creado_por            uuid,
  creado_por_nombre     text,
  creado_en             timestamptz,
  modificado_por        uuid,
  modificado_por_nombre text,
  modificado_en         timestamptz,
  unique (localidad_id, numero)
);
create table if not exists public.consignacion_lineas (
  id              bigint generated always as identity primary key,
  consignacion_id bigint not null references public.consignaciones (id) on delete cascade,
  linea           integer not null,
  producto_id     bigint not null references public.productos (id),
  cantidad        numeric(14, 4) not null check (cantidad > 0),
  costo_total     numeric(18, 2) not null default 0 check (costo_total >= 0),
  costo_unitario  numeric(18, 4) generated always as (round(costo_total / cantidad, 4)) stored,
  inventario      boolean not null default true,
  unique (consignacion_id, linea)
);
alter table public.inventario_movimientos add column if not exists consignacion_linea_id bigint references public.consignacion_lineas (id) on delete cascade;
alter table public.inventario_movimientos drop constraint if exists inventario_movimientos_origen_check;
alter table public.inventario_movimientos add constraint inventario_movimientos_origen_check check (origen in ('INGRESO', 'COMPRA', 'NOTA', 'CONSIGNACIÓN', 'AJUSTE', 'DESPACHO', 'TRASLADO'));

create or replace function public.preparar_consignacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('fin.consignacion', true) is distinct from 'si' then
    if tg_op = 'INSERT' then
      perform pg_advisory_xact_lock(hashtext('consignacion'), new.localidad_id::integer);
      new.numero := coalesce((select max(numero) from public.consignaciones where localidad_id = new.localidad_id), 0) + 1;
      new.estado := 'VIGENTE'; new.cargado_por := null; new.cargado_en := null; new.anulado_por := null; new.anulado_en := null; new.motivo_anulacion := null;
      new.usuario := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
    else
      if old.estado <> 'VIGENTE' then raise exception 'El parte de depósito % está %: ya no se modifica.', old.numero, lower(old.estado); end if;
      new.numero := old.numero; new.estado := old.estado; new.usuario := old.usuario;
      new.localidad_id := old.localidad_id; new.organizacion_id := old.organizacion_id;
    end if;
  end if;
  if not exists (select 1 from public.proveedores p where p.id = new.proveedor_id and p.localidad_id = new.localidad_id) then raise exception 'El proveedor no es de la empresa.'; end if;
  if not exists (select 1 from public.bodegas b where b.id = new.bodega_id and b.localidad_id = new.localidad_id) then raise exception 'La bodega no es de la empresa.'; end if;
  new.serie := nullif(upper(trim(new.serie)), '');
  new.documento := nullif(upper(trim(new.documento)), '');
  new.descripcion := nullif(upper(trim(new.descripcion)), '');
  return new;
end;
$$;
drop trigger if exists consignaciones_preparar on public.consignaciones;
create trigger consignaciones_preparar before insert or update on public.consignaciones for each row execute function public.preparar_consignacion();
drop trigger if exists consignaciones_auditar on public.consignaciones;
create trigger consignaciones_auditar before insert or update on public.consignaciones for each row execute function public.auditar();

create or replace function public.validar_consignacion_linea() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k public.consignaciones;
begin
  select * into k from public.consignaciones where id = coalesce(new.consignacion_id, old.consignacion_id);
  if k.estado <> 'VIGENTE' and current_setting('fin.consignacion', true) is distinct from 'si' then
    raise exception 'El parte de depósito % está %: su detalle ya no se modifica.', k.numero, lower(k.estado);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if not exists (select 1 from public.productos p where p.id = new.producto_id and p.localidad_id = k.localidad_id) then
    raise exception 'El producto de la línea % no es de la empresa.', new.linea;
  end if;
  return new;
end;
$$;
drop trigger if exists consignacion_lineas_validar on public.consignacion_lineas;
create trigger consignacion_lineas_validar before insert or update or delete on public.consignacion_lineas for each row execute function public.validar_consignacion_linea();

create or replace function public.procesar_consignacion(p_id bigint, p_accion text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k public.consignaciones;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_n integer; v_total numeric; v_mal text; v_signo integer;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede procesar los productos en consignación.'; end if;
  select * into k from public.consignaciones where id = p_id for update;
  if k.id is null then raise exception 'El parte de depósito no existe.'; end if;
  perform set_config('fin.consignacion', 'si', true);
  v_signo := case when k.tipo_documento = 'ENVÍO' then 1 else -1 end;
  if p_accion = 'CARGAR' then
    if k.estado <> 'VIGENTE' then raise exception 'El parte de depósito % está %.', k.numero, lower(k.estado); end if;
    select count(*), coalesce(sum(costo_total), 0) into v_n, v_total from public.consignacion_lineas where consignacion_id = k.id;
    if v_n = 0 then raise exception 'Agrega los productos del parte de depósito %.', k.numero; end if;
    if v_total <> k.valor_total then raise exception 'El valor total (%) no es la suma del detalle (%).', k.valor_total, v_total; end if;
    if v_signo < 0 then
      select string_agg(p.nombre || ' (existencia ' || coalesce(e.existencia, 0) || ')', ', ') into v_mal
      from (select producto_id, sum(cantidad) as cant from public.consignacion_lineas where consignacion_id = k.id and inventario group by 1) x
      join public.productos p on p.id = x.producto_id
      left join public.existencias e on e.producto_id = x.producto_id and e.bodega_id = k.bodega_id
      where x.cant > coalesce(e.existencia, 0);
      if v_mal is not null then raise exception 'No hay existencia suficiente para devolver: %.', v_mal; end if;
    end if;
    insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, consignacion_linea_id, usuario)
    select k.organizacion_id, k.localidad_id, l.producto_id, k.bodega_id, k.fecha_documento, v_signo * l.cantidad, l.costo_unitario, 'CONSIGNACIÓN', l.id, v_quien
    from public.consignacion_lineas l where l.consignacion_id = k.id and l.inventario;
    get diagnostics v_n = row_count;
    update public.consignaciones set estado = 'CARGADA', cargado_por = v_quien, cargado_en = now() where id = k.id;
  elsif p_accion = 'REVERTIR' then
    if k.estado <> 'CARGADA' then raise exception 'El parte de depósito % no está cargado.', k.numero; end if;
    delete from public.inventario_movimientos where consignacion_linea_id in (select id from public.consignacion_lineas where consignacion_id = k.id);
    get diagnostics v_n = row_count;
    update public.consignaciones set estado = 'VIGENTE', cargado_por = null, cargado_en = null where id = k.id;
  elsif p_accion = 'ANULAR' then
    if k.estado <> 'VIGENTE' then raise exception 'Solo se anula un parte vigente (revierte primero la carga).'; end if;
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la anulación.'; end if;
    update public.consignaciones set estado = 'ANULADA', anulado_por = v_quien, anulado_en = now(), motivo_anulacion = upper(trim(p_motivo)) where id = k.id;
    v_n := 0;
  else
    raise exception 'Acción no válida.';
  end if;
  perform set_config('fin.consignacion', '', true);
  return jsonb_build_object('numero', k.numero, 'movimientos', v_n);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['consignaciones', 'consignacion_lineas'] loop
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
create policy "consignacion_lineas: quitar" on public.consignacion_lineas for delete to authenticated using (public.puede_editar_catalogos());
grant delete on public.consignacion_lineas to authenticated;
revoke execute on function public.preparar_consignacion() from public, anon, authenticated;
revoke execute on function public.validar_consignacion_linea() from public, anon, authenticated;
revoke execute on function public.procesar_consignacion(bigint, text, text) from public, anon;
grant execute on function public.procesar_consignacion(bigint, text, text) to authenticated;

-- ---------- Menú ----------
insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
select m.id, 'registros', 'Compras', x.clave, x.nombre, coalesce((select max(orden) from public.opciones_sistema), 0) + x.n
from public.modulos_sistema m
cross join (values (1, 'notas-credito-compras', 'Notas crédito compras'), (2, 'productos-consignacion', 'Productos en consignación')) as x (n, clave, nombre)
where m.siglas = 'COM' and m.modulo_mayor_id is null
  and not exists (select 1 from public.opciones_sistema o where o.clave = x.clave and o.modulo_id = m.id);

notify pgrst, 'reload schema';
