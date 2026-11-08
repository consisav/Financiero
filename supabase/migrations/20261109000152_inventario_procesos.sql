-- Inventarios › Procesos: Toma física, Recalcular costo promedio y Cierre de inventario, como se manejan en las
-- empresas en Guatemala (inventario valuado al costo promedio ponderado, ajustes documentados y libro de inventarios
-- con cortes que ya no se modifican):
--   · Toma física: fotografía de la existencia del sistema por producto y lote en una bodega a una fecha de corte;
--     conteo (ciego si se quiere), diferencias valuadas al costo y, al cerrarla, ajustes de entrada (sobrantes) y de
--     salida (faltantes) operados con el motivo «TOMA FÍSICA». Se imprime el acta con las firmas.
--   · Costo promedio: se recalcula el promedio ponderado de cada producto y se aplica al costo del catálogo, con el
--     historial de cada cambio.
--   · Cierre de inventario: cierre mensual con la fotografía de saldos por producto y bodega (libro de inventarios);
--     ningún movimiento con fecha dentro de un mes cerrado se registra, cambia ni borra. Se reabre con motivo.
-- Se ejecuta después del script 151.

-- ===================== Toma física =====================
create table if not exists public.tomas_fisicas (
  id                    bigint generated always as identity primary key,
  organizacion_id       bigint not null references public.organizaciones (id),
  localidad_id          bigint not null references public.localidades (id),
  numero                integer not null,
  fecha_corte           date not null,
  bodega_id             bigint not null references public.bodegas (id),
  estado                text not null default 'EN CONTEO' check (estado in ('EN CONTEO', 'CERRADA', 'ANULADA')),
  conteo_ciego          boolean not null default true,
  descripcion           text,
  responsable           text,
  usuario               text,
  cerrado_por           text,
  cerrado_en            timestamptz,
  ajuste_entrada_id     bigint references public.documentos_inventario (id) on delete set null,
  ajuste_salida_id      bigint references public.documentos_inventario (id) on delete set null,
  anulado_por           text,
  anulado_en            timestamptz,
  motivo_anulacion      text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (localidad_id, numero)
);
create table if not exists public.toma_fisica_lineas (
  id                  bigint generated always as identity primary key,
  toma_id             bigint not null references public.tomas_fisicas (id) on delete cascade,
  producto_id         bigint not null references public.productos (id),
  lote                text not null default '',
  fecha_vencimiento   date,
  existencia_sistema  numeric(14, 4) not null default 0,
  conteo              numeric(14, 4) check (conteo >= 0),
  costo_unitario      numeric(18, 4) not null default 0,
  diferencia          numeric(14, 4) generated always as (coalesce(conteo, existencia_sistema) - existencia_sistema) stored,
  valor_diferencia    numeric(18, 2) generated always as (round((coalesce(conteo, existencia_sistema) - existencia_sistema) * costo_unitario, 2)) stored,
  observaciones       text,
  agregada            boolean not null default false,
  unique (toma_id, producto_id, lote)
);
drop trigger if exists tomas_fisicas_auditar on public.tomas_fisicas;
create trigger tomas_fisicas_auditar before insert or update on public.tomas_fisicas for each row execute function public.auditar();

-- Solo se cuenta mientras la toma está en conteo.
create or replace function public.validar_toma_fisica_linea() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t public.tomas_fisicas;
begin
  select * into t from public.tomas_fisicas where id = coalesce(new.toma_id, old.toma_id);
  if t.estado <> 'EN CONTEO' and current_setting('fin.toma', true) is distinct from 'si' then
    raise exception 'La toma física % está %: ya no se modifica.', t.numero, lower(t.estado);
  end if;
  if tg_op = 'DELETE' then
    if not old.agregada then raise exception 'Solo se quitan los productos agregados durante el conteo.'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    new.producto_id := old.producto_id; new.lote := old.lote; new.existencia_sistema := old.existencia_sistema; new.agregada := old.agregada;
    if not old.agregada then new.costo_unitario := old.costo_unitario; end if;
  else
    if not exists (select 1 from public.productos p where p.id = new.producto_id and p.localidad_id = t.localidad_id) then raise exception 'El producto no es de la empresa.'; end if;
    new.lote := upper(trim(coalesce(new.lote, '')));
  end if;
  new.observaciones := nullif(upper(trim(new.observaciones)), '');
  return new;
end;
$$;
drop trigger if exists toma_fisica_lineas_validar on public.toma_fisica_lineas;
create trigger toma_fisica_lineas_validar before insert or update or delete on public.toma_fisica_lineas for each row execute function public.validar_toma_fisica_linea();

-- Abre la toma: la existencia del sistema por producto y lote en la bodega a la fecha de corte, con su costo
-- (el del catálogo o, si no tiene, el último de entrada del lote).
create or replace function public.crear_toma_fisica(p_bodega bigint, p_fecha date, p_descripcion text default null, p_ciego boolean default true, p_responsable text default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  b public.bodegas; v_id bigint; v_num integer;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para abrir tomas físicas.'; end if;
  select * into b from public.bodegas where id = p_bodega;
  if b.id is null then raise exception 'Elige la bodega.'; end if;
  if p_fecha is null or p_fecha > current_date then raise exception 'La fecha de corte no puede ser futura.'; end if;
  if exists (select 1 from public.tomas_fisicas where bodega_id = p_bodega and estado = 'EN CONTEO') then
    raise exception 'La bodega ya tiene una toma física en conteo: ciérrala o anúlala antes de abrir otra.';
  end if;
  perform pg_advisory_xact_lock(hashtext('toma_fisica'), b.localidad_id::integer);
  v_num := coalesce((select max(numero) from public.tomas_fisicas where localidad_id = b.localidad_id), 0) + 1;
  insert into public.tomas_fisicas (organizacion_id, localidad_id, numero, fecha_corte, bodega_id, conteo_ciego, descripcion, responsable, usuario)
  values (b.organizacion_id, b.localidad_id, v_num, p_fecha, p_bodega, coalesce(p_ciego, true), nullif(upper(trim(p_descripcion)), ''), nullif(upper(trim(p_responsable)), ''), v_quien)
  returning id into v_id;
  insert into public.toma_fisica_lineas (toma_id, producto_id, lote, fecha_vencimiento, existencia_sistema, costo_unitario)
  select v_id, m.producto_id, upper(coalesce(m.lote, '')), max(m.fecha_vencimiento) filter (where m.cantidad > 0), round(sum(m.cantidad), 4),
         coalesce(nullif(max(p.precio_costo), 0), (array_agg(m.costo_unitario order by m.fecha desc, m.id desc) filter (where m.cantidad > 0 and m.costo_unitario > 0))[1], 0)
  from public.inventario_movimientos m join public.productos p on p.id = m.producto_id
  where m.bodega_id = p_bodega and m.fecha <= p_fecha
  group by m.producto_id, upper(coalesce(m.lote, ''))
  having round(sum(m.cantidad), 4) <> 0;
  return v_id;
end;
$$;

-- Cierra la toma: los productos sin contar se toman como iguales al sistema (si se confirma); con las diferencias
-- se generan y operan los ajustes de entrada (sobrantes) y de salida (faltantes) con fecha de corte.
create or replace function public.cerrar_toma_fisica(p_id bigint, p_sin_contar_iguales boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.tomas_fisicas; v_motivo bigint; v_ent bigint; v_sal bigint; v_pend integer; v_n_ent integer := 0; v_n_sal integer := 0;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para cerrar tomas físicas.'; end if;
  select * into t from public.tomas_fisicas where id = p_id for update;
  if t.id is null then raise exception 'La toma física no existe.'; end if;
  if t.estado <> 'EN CONTEO' then raise exception 'La toma física % está %.', t.numero, lower(t.estado); end if;
  select count(*) into v_pend from public.toma_fisica_lineas where toma_id = t.id and conteo is null;
  if v_pend > 0 and not coalesce(p_sin_contar_iguales, false) then
    raise exception 'PENDIENTES: Faltan % producto(s) por contar.', v_pend;
  end if;
  -- Motivo «TOMA FÍSICA» de la organización (se crea si no existe).
  select id into v_motivo from public.motivos_ajuste where organizacion_id = t.organizacion_id and upper(nombre) like 'TOMA F%' order by codigo limit 1;
  if v_motivo is null then
    insert into public.motivos_ajuste (organizacion_id, codigo, nombre) values (t.organizacion_id, 0, 'TOMA FÍSICA') returning id into v_motivo;
  end if;
  perform set_config('fin.toma', 'si', true);
  -- Lo no contado queda igual al sistema; una existencia negativa (imposible físicamente) se corrige a cero.
  update public.toma_fisica_lineas set conteo = greatest(existencia_sistema, 0) where toma_id = t.id and conteo is null;
  -- Sobrantes (entrada) y faltantes (salida).
  if exists (select 1 from public.toma_fisica_lineas where toma_id = t.id and diferencia > 0) then
    insert into public.documentos_inventario (organizacion_id, localidad_id, tipo, numero, fecha, bodega_id, motivo_id, direccion, descripcion)
    values (t.organizacion_id, t.localidad_id, 'AJUSTE PRODUCTO', 0, (t.fecha_corte + time '12:00') at time zone 'America/Guatemala', t.bodega_id, v_motivo, 'AÑADIR', 'TOMA FÍSICA ' || t.numero || ': SOBRANTES')
    returning id into v_ent;
    insert into public.documento_inventario_lineas (documento_id, linea, producto_id, lote, fecha_vencimiento, cantidad, costo_unitario)
    select v_ent, row_number() over (order by l.id), l.producto_id, nullif(l.lote, ''), l.fecha_vencimiento, l.diferencia, l.costo_unitario
    from public.toma_fisica_lineas l where l.toma_id = t.id and l.diferencia > 0;
    perform public.procesar_documento_inventario(v_ent, 'OPERAR', null, true);
    select count(*) into v_n_ent from public.documento_inventario_lineas where documento_id = v_ent;
  end if;
  if exists (select 1 from public.toma_fisica_lineas where toma_id = t.id and diferencia < 0) then
    insert into public.documentos_inventario (organizacion_id, localidad_id, tipo, numero, fecha, bodega_id, motivo_id, direccion, descripcion)
    values (t.organizacion_id, t.localidad_id, 'AJUSTE PRODUCTO', 0, (t.fecha_corte + time '12:00') at time zone 'America/Guatemala', t.bodega_id, v_motivo, 'DISMINUIR', 'TOMA FÍSICA ' || t.numero || ': FALTANTES')
    returning id into v_sal;
    insert into public.documento_inventario_lineas (documento_id, linea, producto_id, lote, fecha_vencimiento, cantidad, costo_unitario)
    select v_sal, row_number() over (order by l.id), l.producto_id, nullif(l.lote, ''), l.fecha_vencimiento, -l.diferencia, l.costo_unitario
    from public.toma_fisica_lineas l where l.toma_id = t.id and l.diferencia < 0;
    perform public.procesar_documento_inventario(v_sal, 'OPERAR', null, true);
    select count(*) into v_n_sal from public.documento_inventario_lineas where documento_id = v_sal;
  end if;
  update public.tomas_fisicas set estado = 'CERRADA', cerrado_por = v_quien, cerrado_en = now(), ajuste_entrada_id = v_ent, ajuste_salida_id = v_sal where id = t.id;
  perform set_config('fin.toma', '', true);
  return jsonb_build_object('numero', t.numero, 'sobrantes', v_n_ent, 'faltantes', v_n_sal);
end;
$$;

create or replace function public.anular_toma_fisica(p_id bigint, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.tomas_fisicas;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para anular tomas físicas.'; end if;
  select * into t from public.tomas_fisicas where id = p_id for update;
  if t.estado <> 'EN CONTEO' then raise exception 'Solo se anula una toma física en conteo.'; end if;
  if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la anulación.'; end if;
  update public.tomas_fisicas set estado = 'ANULADA', anulado_por = coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA'),
    anulado_en = now(), motivo_anulacion = upper(trim(p_motivo)) where id = t.id;
end;
$$;

-- ===================== Costo promedio =====================
create table if not exists public.historial_costo_promedio (
  id              bigint generated always as identity primary key,
  localidad_id    bigint not null references public.localidades (id),
  producto_id     bigint not null references public.productos (id),
  fecha_corte     date not null,
  costo_anterior  numeric(18, 4),
  costo_nuevo     numeric(18, 4) not null,
  existencia      numeric(14, 4),
  valor           numeric(18, 2),
  usuario         text,
  creado_en       timestamptz not null default now()
);
create index if not exists historial_costo_promedio_idx on public.historial_costo_promedio (localidad_id, producto_id, creado_en desc);

-- Aplica el costo promedio recalculado al costo del catálogo y deja el historial.
-- p_datos: [{ "producto_id": 1, "costo": 12.5, "existencia": 100, "valor": 1250 }, …]
create or replace function public.aplicar_costo_promedio(p_localidad bigint, p_fecha date, p_datos jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_n integer; v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para actualizar costos.'; end if;
  insert into public.historial_costo_promedio (localidad_id, producto_id, fecha_corte, costo_anterior, costo_nuevo, existencia, valor, usuario)
  select p_localidad, p.id, p_fecha, p.precio_costo, round((d->>'costo')::numeric, 4), (d->>'existencia')::numeric, (d->>'valor')::numeric, v_quien
  from jsonb_array_elements(p_datos) d join public.productos p on p.id = (d->>'producto_id')::bigint and p.localidad_id = p_localidad
  where (d->>'costo')::numeric >= 0;
  update public.productos p set precio_costo = round((d->>'costo')::numeric, 4)
  from jsonb_array_elements(p_datos) d where p.id = (d->>'producto_id')::bigint and p.localidad_id = p_localidad and (d->>'costo')::numeric >= 0;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ===================== Cierre de inventario =====================
create table if not exists public.cierres_inventario (
  id                bigint generated always as identity primary key,
  organizacion_id   bigint not null references public.organizaciones (id),
  localidad_id      bigint not null references public.localidades (id),
  anio              integer not null,
  mes               integer not null check (mes between 1 and 12),
  fecha_cierre      date not null,
  estado            text not null default 'CERRADO' check (estado in ('CERRADO', 'REABIERTO')),
  productos         integer not null default 0,
  existencia_total  numeric(18, 4) not null default 0,
  valor_total       numeric(18, 2) not null default 0,
  cerrado_por       text,
  cerrado_en        timestamptz,
  reabierto_por     text,
  reabierto_en      timestamptz,
  motivo_reapertura text,
  unique (localidad_id, anio, mes)
);
create table if not exists public.cierre_inventario_saldos (
  id               bigint generated always as identity primary key,
  cierre_id        bigint not null references public.cierres_inventario (id) on delete cascade,
  producto_id      bigint not null references public.productos (id),
  bodega_id        bigint not null references public.bodegas (id),
  existencia       numeric(14, 4) not null,
  costo_promedio   numeric(18, 4) not null default 0,
  valor            numeric(18, 2) not null default 0
);
create index if not exists cierre_inventario_saldos_idx on public.cierre_inventario_saldos (cierre_id);

-- Cierra el mes: fotografía de saldos por producto y bodega al último día del mes, valuados al costo del catálogo
-- (se recomienda recalcular el costo promedio antes). Si ya estaba cerrado y se reabrió, se vuelve a cerrar.
create or replace function public.cerrar_inventario(p_localidad bigint, p_anio integer, p_mes integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  l public.localidades; v_fecha date; v_id bigint; c public.cierres_inventario;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para cerrar el inventario.'; end if;
  select * into l from public.localidades where id = p_localidad;
  v_fecha := (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date;
  if v_fecha >= current_date then raise exception 'El mes todavía no termina: no se puede cerrar.'; end if;
  select * into c from public.cierres_inventario where localidad_id = p_localidad and anio = p_anio and mes = p_mes for update;
  if c.estado = 'CERRADO' then raise exception 'El inventario de %/% ya está cerrado.', p_mes, p_anio; end if;
  if c.id is null then
    insert into public.cierres_inventario (organizacion_id, localidad_id, anio, mes, fecha_cierre, cerrado_por, cerrado_en)
    values (l.organizacion_id, p_localidad, p_anio, p_mes, v_fecha, v_quien, now()) returning id into v_id;
  else
    v_id := c.id;
    delete from public.cierre_inventario_saldos where cierre_id = v_id;
    update public.cierres_inventario set estado = 'CERRADO', cerrado_por = v_quien, cerrado_en = now() where id = v_id;
  end if;
  insert into public.cierre_inventario_saldos (cierre_id, producto_id, bodega_id, existencia, costo_promedio, valor)
  select v_id, m.producto_id, m.bodega_id, round(sum(m.cantidad), 4), coalesce(max(p.precio_costo), 0), round(sum(m.cantidad) * coalesce(max(p.precio_costo), 0), 2)
  from public.inventario_movimientos m join public.productos p on p.id = m.producto_id
  where m.localidad_id = p_localidad and m.fecha <= v_fecha
  group by m.producto_id, m.bodega_id having round(sum(m.cantidad), 4) <> 0;
  update public.cierres_inventario c2 set productos = x.n, existencia_total = x.e, valor_total = x.v
  from (select count(distinct producto_id) as n, coalesce(sum(existencia), 0) as e, coalesce(sum(valor), 0) as v from public.cierre_inventario_saldos where cierre_id = v_id) x
  where c2.id = v_id;
  return (select jsonb_build_object('productos', productos, 'existencia', existencia_total, 'valor', valor_total) from public.cierres_inventario where id = v_id);
end;
$$;

create or replace function public.reabrir_inventario(p_id bigint, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.cierres_inventario;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para reabrir el inventario.'; end if;
  select * into c from public.cierres_inventario where id = p_id for update;
  if c.estado <> 'CERRADO' then raise exception 'El mes no está cerrado.'; end if;
  if exists (select 1 from public.cierres_inventario where localidad_id = c.localidad_id and estado = 'CERRADO' and fecha_cierre > c.fecha_cierre) then
    raise exception 'Reabre primero los meses posteriores que están cerrados.';
  end if;
  if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la reapertura.'; end if;
  update public.cierres_inventario set estado = 'REABIERTO', reabierto_por = coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA'),
    reabierto_en = now(), motivo_reapertura = upper(trim(p_motivo)) where id = c.id;
end;
$$;

-- Ningún movimiento con fecha dentro de un mes cerrado se registra, cambia ni borra.
create or replace function public.proteger_inventario_cerrado() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_loc bigint; v_fecha date; v_cierre date;
begin
  if current_setting('fin.migracion', true) = 'si' then return coalesce(new, old); end if;
  if tg_op in ('UPDATE', 'DELETE') then
    select max(fecha_cierre) into v_cierre from public.cierres_inventario where localidad_id = old.localidad_id and estado = 'CERRADO';
    if v_cierre is not null and old.fecha <= v_cierre then
      raise exception 'El inventario está cerrado al %: no se modifican movimientos de esa fecha (%).', to_char(v_cierre, 'DD/MM/YYYY'), to_char(old.fecha, 'DD/MM/YYYY');
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select max(fecha_cierre) into v_cierre from public.cierres_inventario where localidad_id = new.localidad_id and estado = 'CERRADO';
    if v_cierre is not null and new.fecha <= v_cierre then
      raise exception 'El inventario está cerrado al %: no se registran movimientos con fecha %.', to_char(v_cierre, 'DD/MM/YYYY'), to_char(new.fecha, 'DD/MM/YYYY');
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists inventario_movimientos_cierre on public.inventario_movimientos;
create trigger inventario_movimientos_cierre before insert or update or delete on public.inventario_movimientos for each row execute function public.proteger_inventario_cerrado();

-- ===================== Seguridad =====================
do $$
declare t text;
begin
  foreach t in array array['tomas_fisicas', 'toma_fisica_lineas', 'historial_costo_promedio', 'cierres_inventario', 'cierre_inventario_saldos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (true)', t, t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end;
$$;
-- El conteo se escribe en las líneas de la toma (el trigger solo deja contar mientras está en conteo).
drop policy if exists "toma_fisica_lineas: contar" on public.toma_fisica_lineas;
create policy "toma_fisica_lineas: contar" on public.toma_fisica_lineas for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());
drop policy if exists "toma_fisica_lineas: agregar" on public.toma_fisica_lineas;
create policy "toma_fisica_lineas: agregar" on public.toma_fisica_lineas for insert to authenticated with check (public.puede_editar_catalogos());
drop policy if exists "toma_fisica_lineas: quitar" on public.toma_fisica_lineas;
create policy "toma_fisica_lineas: quitar" on public.toma_fisica_lineas for delete to authenticated using (public.puede_editar_catalogos());
grant insert, update, delete on public.toma_fisica_lineas to authenticated;
revoke execute on function public.validar_toma_fisica_linea() from public, anon, authenticated;
revoke execute on function public.proteger_inventario_cerrado() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['public.crear_toma_fisica(bigint, date, text, boolean, text)', 'public.cerrar_toma_fisica(bigint, boolean)', 'public.anular_toma_fisica(bigint, text)',
                           'public.aplicar_costo_promedio(bigint, date, jsonb)', 'public.cerrar_inventario(bigint, integer, integer)', 'public.reabrir_inventario(bigint, text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- ===================== Menú =====================
do $$
declare v_inv bigint;
begin
  select id into v_inv from public.modulos_sistema where siglas = 'INV' order by codigo limit 1;
  update public.opciones_sistema set subgrupo = 'Procesos de inventario', activo = true
  where modulo_id = v_inv and grupo = 'procesos' and clave in ('toma-fisica', 'recalcular-costo-promedio', 'cierre-de-inventario');
end;
$$;

notify pgrst, 'reload schema';
select 'Inventarios: toma física, costo promedio y cierre de inventario instalados.' as resultado;
