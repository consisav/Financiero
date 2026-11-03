-- Registros · Bancos (antes «Movimientos bancarios»):
--   Bancos del sistema bancario de Guatemala (catálogo común) y cuentas bancarias de cada
--   organización y localidad (moneda, saldo mínimo, saldo inicial, chequera y cuenta contable).
--   Movimientos bancarios: depósitos (multimoneda), notas de crédito y notas de débito /
--   transferencias, con sus documentos aplicados (facturas, recibos, notas), su detalle contable
--   (generado desde una transacción de Objetos contables) y la partida que se genera.
--   Conciliaciones mensuales por cuenta bancaria con sus diferencias.
-- Escribir: administrador. Eliminar movimientos: Super Administrador, si no están contabilizados.
-- Requiere los scripts 15, 34 y 36. Puede ejecutarse de nuevo.

-- ---------- Bancos ----------
create table if not exists public.bancos (
  id                  bigint generated always as identity primary key,
  codigo              integer not null unique check (codigo > 0),
  nombre              text not null,
  siglas              text,
  costo_transferencia numeric(12, 2),
  activo              boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create unique index if not exists bancos_nombre_key on public.bancos (lower(nombre));
drop trigger if exists bancos_auditar on public.bancos;
create trigger bancos_auditar before insert or update on public.bancos for each row execute function public.auditar();

-- Bancos del sistema bancario de Guatemala (verificar el listado vigente con la SIB).
insert into public.bancos (codigo, nombre, siglas) values
  (1,  'BANRURAL (BANCO DE DESARROLLO RURAL)',      'BANRURAL'),
  (2,  'INTERBANCO (BANCO INTERNACIONAL)',          'INTERBANCO'),
  (3,  'BANCO G&T CONTINENTAL',                     'G&T'),
  (4,  'BANTRAB (BANCO DE LOS TRABAJADORES)',       'BANTRAB'),
  (5,  'BAM (BANCO AGROMERCANTIL DE GUATEMALA)',    'BAM'),
  (6,  'BANCO PROMERICA',                           'PROMERICA'),
  (7,  'BAC CREDOMATIC (BANCO DE AMÉRICA CENTRAL)', 'BAC'),
  (8,  'BANCO DE ANTIGUA',                          'ANTIGUA'),
  (9,  'BANCO FICOHSA GUATEMALA',                   'FICOHSA'),
  (10, 'BANCO INMOBILIARIO',                        'INMOBILIARIO'),
  (11, 'CRÉDITO HIPOTECARIO NACIONAL',              'CHN'),
  (12, 'BANCO AZTECA DE GUATEMALA',                 'AZTECA'),
  (13, 'VIVIBANCO',                                 'VIVIBANCO'),
  (14, 'BANCO INV',                                 'INV'),
  (15, 'BANCO CUSCATLÁN GUATEMALA',                 'CUSCATLÁN'),
  (20, 'BANCO INDUSTRIAL',                          'BI')
on conflict (codigo) do nothing;

-- ---------- Cuentas bancarias ----------
create table if not exists public.cuentas_bancarias (
  id                  bigint generated always as identity primary key,
  organizacion_id     bigint not null references public.organizaciones (id),
  localidad_id        bigint not null,
  banco_id            bigint not null references public.bancos (id),
  numero              text not null check (length(trim(numero)) > 0),
  nombre              text not null,
  moneda_id           bigint not null references public.monedas (id),
  saldo_minimo        numeric(18, 2) not null default 0,
  saldo_inicial       numeric(18, 2) not null default 0,
  fecha_saldo_inicial date not null default current_date,
  cheque_inicial      integer,
  cheque_final        integer,
  cheques_utilizados  integer not null default 0,
  minimo_cheques      integer not null default 0,
  reporte             text,
  cuenta_id           bigint references public.cuentas (id),
  activo              boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, banco_id, numero),
  check (cheque_final is null or cheque_inicial is null or cheque_final >= cheque_inicial)
);

create or replace function public.validar_cuenta_bancaria() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.organizacion_id := old.organizacion_id;
    new.localidad_id := old.localidad_id;
  end if;
  if new.cuenta_id is not null and not exists (
       select 1 from public.cuentas c join public.catalogos_cuentas k on k.id = c.catalogo_id
       where c.id = new.cuenta_id and k.localidad_id = new.localidad_id) then
    raise exception 'La cuenta contable no es del catálogo de cuentas de la localidad.';
  end if;
  new.numero := trim(new.numero);
  new.nombre := upper(trim(new.nombre));
  return new;
end;
$$;
drop trigger if exists cuentas_bancarias_validar on public.cuentas_bancarias;
create trigger cuentas_bancarias_validar before insert or update on public.cuentas_bancarias for each row execute function public.validar_cuenta_bancaria();
drop trigger if exists cuentas_bancarias_auditar on public.cuentas_bancarias;
create trigger cuentas_bancarias_auditar before insert or update on public.cuentas_bancarias for each row execute function public.auditar();

-- ---------- Movimientos bancarios ----------
create table if not exists public.movimientos_bancarios (
  id                 bigint generated always as identity primary key,
  organizacion_id    bigint not null references public.organizaciones (id),
  localidad_id       bigint not null,
  cuenta_bancaria_id bigint not null references public.cuentas_bancarias (id),
  tipo               text not null check (tipo in ('DEPOSITO', 'NOTA_CREDITO', 'NOTA_DEBITO')),
  folio              integer not null,
  numero_documento   text,
  fecha              date not null default current_date,
  moneda_id          bigint not null references public.monedas (id),
  tipo_cambio        numeric(18, 6) not null default 1 check (tipo_cambio > 0),
  valor              numeric(18, 2) not null check (valor > 0),
  valor_ml           numeric(18, 2),
  valor_cuenta       numeric(18, 2),
  descripcion        text,
  tipo_tercero       text check (tipo_tercero in ('CLIENTE', 'CLIENTES VARIOS', 'PROVEEDOR PRODUCTOS', 'PROVEEDOR SERVICIOS', 'OTRO')),
  tercero_codigo     text,
  tercero_nombre     text,
  tipo_operacion     text,
  estado             text not null default 'ACTIVO' check (estado in ('ACTIVO', 'ANULADO')),
  anulado_por        text,
  anulado_en         timestamptz,
  motivo_anulacion   text,
  usuario            text,
  fecha_operacion    timestamptz not null default now(),
  transaccion_id     bigint references public.transacciones_contables (id) on delete set null,
  partida_id         bigint references public.partidas (id) on delete set null,
  conciliado         boolean not null default false,
  fecha_conciliado   date,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, tipo, folio)
);
create index if not exists movimientos_bancarios_cuenta_idx on public.movimientos_bancarios (cuenta_bancaria_id, fecha);

create table if not exists public.movimiento_documentos (
  id            bigint generated always as identity primary key,
  movimiento_id bigint not null references public.movimientos_bancarios (id) on delete cascade,
  tipo          text not null default 'FACTURA' check (tipo in ('FACTURA', 'RECIBO', 'NOTA', 'OTRO')),
  numero        text not null,
  tercero       text,
  nombre        text,
  valor         numeric(18, 2) not null default 0,
  fecha         date,
  estado        text
);

create table if not exists public.movimiento_lineas (
  id            bigint generated always as identity primary key,
  movimiento_id bigint not null references public.movimientos_bancarios (id) on delete cascade,
  linea         integer not null,
  cuenta_id     bigint not null references public.cuentas (id),
  debe          numeric(18, 2) not null default 0 check (debe >= 0),
  haber         numeric(18, 2) not null default 0 check (haber >= 0),
  check (debe = 0 or haber = 0),
  unique (movimiento_id, linea)
);

create or replace function public.preparar_movimiento_bancario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  cb public.cuentas_bancarias;
  v_quien text := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
  v_proceso boolean := current_setting('fin.banco', true) = 'si';
begin
  select * into cb from public.cuentas_bancarias where id = new.cuenta_bancaria_id;
  if cb.localidad_id is distinct from new.localidad_id then
    raise exception 'La cuenta bancaria no es de la localidad del documento.';
  end if;
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4807, new.localidad_id::integer);
    new.folio := coalesce((select max(folio) from public.movimientos_bancarios where localidad_id = new.localidad_id and tipo = new.tipo), 0) + 1;
    new.usuario := v_quien;
    new.fecha_operacion := now();
    new.estado := 'ACTIVO';
    new.partida_id := null;
    new.conciliado := false; new.fecha_conciliado := null;
    if new.moneda_id is null then new.moneda_id := cb.moneda_id; end if;
  else
    new.organizacion_id := old.organizacion_id;
    new.localidad_id := old.localidad_id;
    new.tipo := old.tipo;
    new.folio := old.folio;
    new.usuario := old.usuario;
    new.fecha_operacion := old.fecha_operacion;
    if not v_proceso then
      if old.estado = 'ANULADO' then raise exception 'El documento % está anulado y ya no se modifica.', old.folio; end if;
      new.estado := old.estado; new.anulado_por := old.anulado_por; new.anulado_en := old.anulado_en; new.motivo_anulacion := old.motivo_anulacion;
      new.partida_id := old.partida_id;
      if old.partida_id is not null and (new.valor <> old.valor or new.cuenta_bancaria_id <> old.cuenta_bancaria_id or new.fecha <> old.fecha) then
        raise exception 'El documento % ya generó su partida: no se cambian su valor, cuenta ni fecha.', old.folio;
      end if;
    end if;
  end if;
  new.valor_ml := round(new.valor * new.tipo_cambio, 2);
  -- Valor en la moneda de la cuenta: una cuenta en quetzales recibe cualquier moneda al cambio;
  -- una cuenta en otra moneda solo recibe documentos en su misma moneda.
  if new.moneda_id = cb.moneda_id then
    new.valor_cuenta := new.valor;
  elsif (select iso from public.monedas where id = cb.moneda_id) = 'GTQ' then
    new.valor_cuenta := new.valor_ml;
  else
    raise exception 'La cuenta % es en %: el documento debe ir en esa misma moneda.', cb.numero, (select nombre from public.monedas where id = cb.moneda_id);
  end if;
  new.descripcion := nullif(trim(new.descripcion), '');
  return new;
end;
$$;
drop trigger if exists movimientos_bancarios_preparar on public.movimientos_bancarios;
create trigger movimientos_bancarios_preparar before insert or update on public.movimientos_bancarios for each row execute function public.preparar_movimiento_bancario();
drop trigger if exists movimientos_bancarios_auditar on public.movimientos_bancarios;
create trigger movimientos_bancarios_auditar before insert or update on public.movimientos_bancarios for each row execute function public.auditar();

-- Las líneas contables y los documentos de un movimiento anulado o contabilizado no cambian.
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
  end if;
  return new;
end;
$$;
drop trigger if exists movimiento_lineas_validar on public.movimiento_lineas;
create trigger movimiento_lineas_validar before insert or update or delete on public.movimiento_lineas for each row execute function public.validar_detalle_movimiento();
drop trigger if exists movimiento_documentos_validar on public.movimiento_documentos;
create trigger movimiento_documentos_validar before insert or update or delete on public.movimiento_documentos for each row execute function public.validar_detalle_movimiento();

-- Anular, generar la partida (en quetzales: el detalle contable va en la moneda de integración),
-- conciliar y eliminar.
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
    insert into public.partida_lineas (partida_id, linea, cuenta_id, concepto, debe, haber)
    select v_partida, l.linea, l.cuenta_id, left(coalesce(m.descripcion, v_nombre), 200), l.debe, l.haber
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

-- ---------- Saldos ----------
-- Saldo según el banco (registrado en el sistema) de una cuenta bancaria a una fecha:
-- saldo inicial + depósitos + notas de crédito − notas de débito activos hasta esa fecha.
create or replace function public.saldo_cuenta_bancaria(p_cuenta bigint, p_hasta date) returns numeric
language sql stable security definer set search_path = '' as $$
  select cb.saldo_inicial + coalesce((
    select sum(case when m.tipo = 'NOTA_DEBITO' then -m.valor_cuenta else m.valor_cuenta end)
    from public.movimientos_bancarios m
    where m.cuenta_bancaria_id = cb.id and m.estado = 'ACTIVO' and m.fecha >= cb.fecha_saldo_inicial and m.fecha <= p_hasta), 0)
  from public.cuentas_bancarias cb
  where cb.id = p_cuenta and public.usuario_activo();
$$;

-- Saldo contable de la cuenta contable de una cuenta bancaria hasta un mes (partidas vigentes).
create or replace function public.saldo_contable_cuenta_bancaria(p_cuenta bigint, p_anio integer, p_mes integer) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(l.debe - l.haber), 0)
  from public.cuentas_bancarias cb
  join public.partida_lineas l on l.cuenta_id = cb.cuenta_id
  join public.partidas p on p.id = l.partida_id and p.estado = 'VIGENTE'
  where cb.id = p_cuenta and public.usuario_activo() and (p.anio < p_anio or (p.anio = p_anio and p.mes <= p_mes));
$$;

-- ---------- Conciliaciones ----------
create table if not exists public.conciliaciones (
  id                 bigint generated always as identity primary key,
  organizacion_id    bigint not null references public.organizaciones (id),
  localidad_id       bigint not null,
  cuenta_bancaria_id bigint not null references public.cuentas_bancarias (id),
  anio               integer not null,
  mes                integer not null check (mes between 1 and 12),
  fecha              date not null default current_date,
  usuario            text,
  saldo_banco        numeric(18, 2) not null default 0,
  saldo_banco_ml     numeric(18, 2) not null default 0,
  saldo_contable     numeric(18, 2) not null default 0,
  saldo_contable_ml  numeric(18, 2) not null default 0,
  observaciones      text,
  estado             text not null default 'ABIERTA' check (estado in ('ABIERTA', 'CERRADA')),
  cerrada_por        text,
  fecha_cierre       timestamptz,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (cuenta_bancaria_id, anio, mes)
);
create table if not exists public.conciliacion_diferencias (
  id              bigint generated always as identity primary key,
  conciliacion_id bigint not null references public.conciliaciones (id) on delete cascade,
  descripcion     text not null,
  valor_real      numeric(18, 2) not null default 0,
  valor_conta     numeric(18, 2) not null default 0
);

create or replace function public.preparar_conciliacion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_quien text := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
begin
  if tg_op = 'INSERT' then
    new.usuario := v_quien; new.estado := 'ABIERTA'; new.cerrada_por := null; new.fecha_cierre := null;
  else
    new.cuenta_bancaria_id := old.cuenta_bancaria_id; new.anio := old.anio; new.mes := old.mes; new.usuario := old.usuario;
    if current_setting('fin.banco', true) is distinct from 'si' then
      if old.estado = 'CERRADA' then raise exception 'La conciliación de %/% está cerrada: reversa el cierre para modificarla.', old.mes, old.anio; end if;
      new.estado := old.estado; new.cerrada_por := old.cerrada_por; new.fecha_cierre := old.fecha_cierre;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists conciliaciones_preparar on public.conciliaciones;
create trigger conciliaciones_preparar before insert or update on public.conciliaciones for each row execute function public.preparar_conciliacion();
drop trigger if exists conciliaciones_auditar on public.conciliaciones;
create trigger conciliaciones_auditar before insert or update on public.conciliaciones for each row execute function public.auditar();

create or replace function public.cerrar_conciliacion(p_id bigint, p_cerrar boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede cerrar o reversar conciliaciones.'; end if;
  perform set_config('fin.banco', 'si', true);
  update public.conciliaciones
  set estado = case when p_cerrar then 'CERRADA' else 'ABIERTA' end,
      cerrada_por = case when p_cerrar then v_quien end,
      fecha_cierre = case when p_cerrar then now() end
  where id = p_id;
  perform set_config('fin.banco', '', true);
  return jsonb_build_object('id', p_id, 'cerrada', p_cerrar);
end;
$$;

-- ---------- Seguridad ----------
do $$
declare t text;
begin
  foreach t in array array['bancos', 'cuentas_bancarias', 'movimientos_bancarios', 'movimiento_documentos', 'movimiento_lineas', 'conciliaciones', 'conciliacion_diferencias'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format('drop policy if exists "%s: modificar" on public.%I', t, t);
    execute format('drop policy if exists "%s: quitar" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
  end loop;
  foreach t in array array['movimiento_documentos', 'movimiento_lineas', 'conciliacion_diferencias', 'cuentas_bancarias'] loop
    execute format('create policy "%s: quitar" on public.%I for delete to authenticated using (public.puede_editar_catalogos())', t, t);
  end loop;
end;
$$;

revoke execute on function public.validar_cuenta_bancaria() from public, anon, authenticated;
revoke execute on function public.preparar_movimiento_bancario() from public, anon, authenticated;
revoke execute on function public.validar_detalle_movimiento() from public, anon, authenticated;
revoke execute on function public.preparar_conciliacion() from public, anon, authenticated;
revoke execute on function public.procesar_movimiento_bancario(bigint, text, text) from public, anon;
revoke execute on function public.saldo_cuenta_bancaria(bigint, date) from public, anon;
revoke execute on function public.saldo_contable_cuenta_bancaria(bigint, integer, integer) from public, anon;
revoke execute on function public.cerrar_conciliacion(bigint, boolean) from public, anon;
grant execute on function public.procesar_movimiento_bancario(bigint, text, text) to authenticated;
grant execute on function public.saldo_cuenta_bancaria(bigint, date) to authenticated;
grant execute on function public.saldo_contable_cuenta_bancaria(bigint, integer, integer) to authenticated;
grant execute on function public.cerrar_conciliacion(bigint, boolean) to authenticated;

-- ---------- Menú y Roles módulos ----------
do $$
declare
  v_con bigint := (select id from public.modulos_sistema where siglas = 'CON' and modulo_mayor_id is null);
  v_orden integer;
begin
  select orden into v_orden from public.opciones_sistema where clave = 'movimientos-bancarios' and modulo_id = v_con;
  if v_orden is not null then
    update public.opciones_sistema set orden = orden + 6 where orden > v_orden;
    update public.opciones_sistema set clave = 'cuentas-bancarias', nombre = 'Cuentas bancarias', subgrupo = 'Bancos' where clave = 'movimientos-bancarios' and modulo_id = v_con;
    insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values
      (v_con, 'registros', 'Bancos', 'depositos', 'Depósitos multimoneda', v_orden + 1),
      (v_con, 'registros', 'Bancos', 'notas-credito', 'Notas de crédito / transferencias', v_orden + 2),
      (v_con, 'registros', 'Bancos', 'notas-debito', 'Notas de débito / transferencias', v_orden + 3),
      (v_con, 'registros', 'Bancos', 'conciliacion-bancaria', 'Conciliación bancaria', v_orden + 4),
      (v_con, 'registros', 'Bancos', 'disponibilidad-bancaria', 'Disponibilidad bancaria', v_orden + 5),
      (v_con, 'registros', 'Bancos', 'disponibilidad-integrada', 'Disponibilidad integrada', v_orden + 6)
    on conflict do nothing;
  end if;
end;
$$;

notify pgrst, 'reload schema';
