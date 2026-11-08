-- Presupuesto y Flujo de efectivo (módulo PFE), según la práctica de las empresas financieras en Guatemala:
--   Catálogos: rubros de flujo (NIC 7: operación, inversión, financiamiento), escenarios (base, optimista,
--     conservador) y la vinculación de los rubros de presupuesto con las cuentas contables (para la ejecución).
--   Presupuesto: formulación mensualizada (m1..m12) con supuestos por rubro; aprobación por niveles con segregación
--     de funciones (quien elabora no aprueba); modificaciones presupuestarias (traslados, ampliaciones y reducciones)
--     con justificación; ejecución automática desde las partidas contables (e1..e12); cierre.
--   Flujo: proyecciones de 13 semanas o 12 meses con saldo inicial, carga automática de cobros (cuentas por cobrar
--     por fecha estimada de cobro) y pagos (cuentas por pagar por vencimiento) y líneas manuales por rubro.

-- ============ Catálogos ============
create table if not exists public.rubros_flujo (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id    bigint not null references public.localidades (id),
  codigo          integer not null check (codigo > 0),
  nombre          text not null,
  actividad       text not null check (actividad in ('OPERACIÓN', 'INVERSIÓN', 'FINANCIAMIENTO')),
  tipo            text not null check (tipo in ('ENTRADA', 'SALIDA')),
  origen          text not null default 'MANUAL' check (origen in ('MANUAL', 'COBROS', 'PAGOS')),
  activo          boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (localidad_id, codigo)
);
create table if not exists public.escenarios_presupuesto (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id    bigint not null references public.localidades (id),
  codigo          text not null,
  nombre          text not null,
  factor_ingresos numeric(8, 4) not null default 1 check (factor_ingresos > 0),
  factor_egresos  numeric(8, 4) not null default 1 check (factor_egresos > 0),
  descripcion     text,
  activo          boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (localidad_id, codigo)
);
create table if not exists public.presupuesto_rubro_cuentas (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id    bigint not null references public.localidades (id),
  rubro_id        bigint not null references public.rubros_presupuesto (id) on delete cascade,
  cuenta_codigo   text not null,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (localidad_id, rubro_id, cuenta_codigo)
);

-- ============ Presupuesto mensualizado ============
alter table public.presupuestos add column if not exists escenario text not null default 'BASE';
alter table public.presupuestos add column if not exists version integer not null default 1;
alter table public.presupuestos add column if not exists centro_id bigint;
alter table public.presupuestos add column if not exists enviado_por text;
alter table public.presupuestos add column if not exists enviado_en timestamptz;
alter table public.presupuestos add column if not exists revisado_por text;
alter table public.presupuestos add column if not exists revisado_en timestamptz;
alter table public.presupuestos add column if not exists motivo_devolucion text;
alter table public.presupuestos add column if not exists ejecucion_calculada_en timestamptz;
do $$
declare k int;
begin
  for k in 1..12 loop
    execute format('alter table public.presupuesto_lineas add column if not exists m%s numeric(18,2)', k);
    execute format('alter table public.presupuesto_lineas add column if not exists e%s numeric(18,2)', k);
  end loop;
end;
$$;
alter table public.presupuesto_lineas add column if not exists supuesto text;
alter table public.presupuesto_lineas add column if not exists centro_id bigint;
-- La ejecución de un rubro de ingresos puede ser menor que cero en un mes (devoluciones): se quita la restricción.
alter table public.presupuesto_lineas drop constraint if exists presupuesto_lineas_ejecutado_check;

-- Los meses dan el total; un presupuesto aprobado solo cambia con modificaciones o con el cálculo de la ejecución.
create or replace function public.mensualizar_linea_presupuesto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_estado text;
  v_libre boolean := current_setting('fin.presupuesto_mod', true) = 'si';
begin
  select estado into v_estado from public.presupuestos where id = new.presupuesto_id;
  if tg_op = 'UPDATE' and v_estado not in ('FORMULACIÓN') and not v_libre
     and (row(new.m1, new.m2, new.m3, new.m4, new.m5, new.m6, new.m7, new.m8, new.m9, new.m10, new.m11, new.m12, new.presupuestado)
          is distinct from row(old.m1, old.m2, old.m3, old.m4, old.m5, old.m6, old.m7, old.m8, old.m9, old.m10, old.m11, old.m12, old.presupuestado)) then
    raise exception 'El presupuesto está %: los montos solo cambian con una modificación presupuestaria.', lower(v_estado);
  end if;
  if tg_op = 'INSERT' and v_estado not in ('FORMULACIÓN') and not v_libre then
    raise exception 'El presupuesto está %: los rubros nuevos se agregan con una modificación presupuestaria.', lower(v_estado);
  end if;
  if coalesce(new.m1, new.m2, new.m3, new.m4, new.m5, new.m6, new.m7, new.m8, new.m9, new.m10, new.m11, new.m12) is not null then
    new.presupuestado := coalesce(new.m1, 0) + coalesce(new.m2, 0) + coalesce(new.m3, 0) + coalesce(new.m4, 0) + coalesce(new.m5, 0) + coalesce(new.m6, 0)
                       + coalesce(new.m7, 0) + coalesce(new.m8, 0) + coalesce(new.m9, 0) + coalesce(new.m10, 0) + coalesce(new.m11, 0) + coalesce(new.m12, 0);
  end if;
  if coalesce(new.e1, new.e2, new.e3, new.e4, new.e5, new.e6, new.e7, new.e8, new.e9, new.e10, new.e11, new.e12) is not null then
    new.ejecutado := coalesce(new.e1, 0) + coalesce(new.e2, 0) + coalesce(new.e3, 0) + coalesce(new.e4, 0) + coalesce(new.e5, 0) + coalesce(new.e6, 0)
                   + coalesce(new.e7, 0) + coalesce(new.e8, 0) + coalesce(new.e9, 0) + coalesce(new.e10, 0) + coalesce(new.e11, 0) + coalesce(new.e12, 0);
  end if;
  new.supuesto := nullif(trim(new.supuesto), '');
  return new;
end;
$$;
drop trigger if exists presupuesto_lineas_mensualizar on public.presupuesto_lineas;
create trigger presupuesto_lineas_mensualizar before insert or update on public.presupuesto_lineas for each row execute function public.mensualizar_linea_presupuesto();

-- Flujo de aprobación: ENVIAR (formulación → en revisión), DEVOLVER (con motivo), APROBAR (no puede aprobar quien
-- elaboró, salvo el Super Administrador), CERRAR, ANULAR (con motivo) y NUEVA_VERSION (copia en formulación).
create or replace function public.cambiar_estado_presupuesto(p_id bigint, p_accion text, p_motivo text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  p public.presupuestos;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_nuevo bigint;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para cambiar el estado del presupuesto.'; end if;
  select * into p from public.presupuestos where id = p_id for update;
  if p.id is null then raise exception 'El presupuesto no existe.'; end if;
  perform set_config('fin.presupuesto', 'si', true);
  case upper(p_accion)
    when 'ENVIAR' then
      if p.estado <> 'FORMULACIÓN' then raise exception 'Solo se envía a revisión un presupuesto en formulación.'; end if;
      if not exists (select 1 from public.presupuesto_lineas where presupuesto_id = p.id and presupuestado <> 0) then raise exception 'El presupuesto no tiene montos.'; end if;
      update public.presupuestos set estado = 'EN REVISIÓN', enviado_por = v_quien, enviado_en = now(), motivo_devolucion = null where id = p.id;
    when 'DEVOLVER' then
      if p.estado <> 'EN REVISIÓN' then raise exception 'Solo se devuelve un presupuesto en revisión.'; end if;
      if coalesce(trim(p_motivo), '') = '' then raise exception 'Escribe el motivo de la devolución.'; end if;
      update public.presupuestos set estado = 'FORMULACIÓN', revisado_por = v_quien, revisado_en = now(), motivo_devolucion = trim(p_motivo) where id = p.id;
    when 'APROBAR' then
      if p.estado <> 'EN REVISIÓN' then raise exception 'Solo se aprueba un presupuesto en revisión.'; end if;
      if v_quien = p.elaborado_por and not public.es_superadmin() then raise exception 'Segregación de funciones: quien elaboró el presupuesto no puede aprobarlo.'; end if;
      update public.presupuestos set estado = 'APROBADO', revisado_por = v_quien, revisado_en = now() where id = p.id;
    when 'CERRAR' then
      if p.estado not in ('APROBADO', 'EN EJECUCIÓN', 'MODIFICADO') then raise exception 'Solo se cierra un presupuesto aprobado o en ejecución.'; end if;
      update public.presupuestos set estado = 'CERRADO' where id = p.id;
    when 'ANULAR' then
      if p.estado in ('CERRADO', 'ANULADO') then raise exception 'El presupuesto ya está %.', lower(p.estado); end if;
      if coalesce(trim(p_motivo), '') = '' then raise exception 'Escribe el motivo de la anulación.'; end if;
      update public.presupuestos set estado = 'ANULADO', motivo_devolucion = trim(p_motivo) where id = p.id;
    when 'NUEVA_VERSION' then
      insert into public.presupuestos (organizacion_id, localidad_id, numero, fecha, tipo, anio, frecuencia, periodo, fecha_inicio, fecha_fin, estado, descripcion, escenario, version, centro_id)
      values (p.organizacion_id, p.localidad_id, 0, current_date, p.tipo, p.anio, p.frecuencia, p.periodo, p.fecha_inicio, p.fecha_fin, 'FORMULACIÓN',
              coalesce(p.descripcion, '') || ' (versión ' || (p.version + 1) || ')', p.escenario, p.version + 1, p.centro_id)
      returning id into v_nuevo;
      insert into public.presupuesto_lineas (presupuesto_id, rubro_id, presupuestado, observaciones, supuesto, centro_id, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12)
      select v_nuevo, rubro_id, presupuestado, observaciones, supuesto, centro_id, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12 from public.presupuesto_lineas where presupuesto_id = p.id;
      perform set_config('fin.presupuesto', '', true);
      return v_nuevo;
    else raise exception 'Acción desconocida: %.', p_accion;
  end case;
  perform set_config('fin.presupuesto', '', true);
  return p.id;
end;
$$;

-- Ejecución: suma de las partidas vigentes del año del presupuesto en las cuentas vinculadas a cada rubro (por
-- prefijo de código), mes por mes. Ingresos: haber − debe; egresos e inversiones: debe − haber.
create or replace function public.calcular_ejecucion_presupuesto(p_id bigint)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  p public.presupuestos;
  l record;
  v_n integer := 0;
  v record;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para calcular la ejecución.'; end if;
  select * into p from public.presupuestos where id = p_id;
  if p.id is null then raise exception 'El presupuesto no existe.'; end if;
  if p.estado in ('FORMULACIÓN', 'EN REVISIÓN', 'ANULADO') then raise exception 'La ejecución se calcula a un presupuesto aprobado.'; end if;
  perform set_config('fin.presupuesto_mod', 'si', true);
  for l in select pl.id, pl.rubro_id, r.naturaleza from public.presupuesto_lineas pl join public.rubros_presupuesto r on r.id = pl.rubro_id where pl.presupuesto_id = p.id loop
    select
      sum(x.v) filter (where x.mes = 1) e1, sum(x.v) filter (where x.mes = 2) e2, sum(x.v) filter (where x.mes = 3) e3, sum(x.v) filter (where x.mes = 4) e4,
      sum(x.v) filter (where x.mes = 5) e5, sum(x.v) filter (where x.mes = 6) e6, sum(x.v) filter (where x.mes = 7) e7, sum(x.v) filter (where x.mes = 8) e8,
      sum(x.v) filter (where x.mes = 9) e9, sum(x.v) filter (where x.mes = 10) e10, sum(x.v) filter (where x.mes = 11) e11, sum(x.v) filter (where x.mes = 12) e12
    into v
    from (
      select pa.mes, case when l.naturaleza = 'INGRESO' then li.haber - li.debe else li.debe - li.haber end as v
      from public.partida_lineas li
      join public.partidas pa on pa.id = li.partida_id
      join public.cuentas c on c.id = li.cuenta_id
      where pa.localidad_id = p.localidad_id and pa.estado = 'VIGENTE' and pa.anio = p.anio
        and exists (select 1 from public.presupuesto_rubro_cuentas rc where rc.localidad_id = p.localidad_id and rc.rubro_id = l.rubro_id and c.codigo like rc.cuenta_codigo || '%')
    ) x;
    update public.presupuesto_lineas set e1 = coalesce(v.e1, 0), e2 = coalesce(v.e2, 0), e3 = coalesce(v.e3, 0), e4 = coalesce(v.e4, 0), e5 = coalesce(v.e5, 0), e6 = coalesce(v.e6, 0),
      e7 = coalesce(v.e7, 0), e8 = coalesce(v.e8, 0), e9 = coalesce(v.e9, 0), e10 = coalesce(v.e10, 0), e11 = coalesce(v.e11, 0), e12 = coalesce(v.e12, 0) where id = l.id;
    v_n := v_n + 1;
  end loop;
  perform set_config('fin.presupuesto', 'si', true);
  update public.presupuestos set ejecucion_calculada_en = now(), estado = case when estado = 'APROBADO' then 'EN EJECUCIÓN' else estado end where id = p.id;
  perform set_config('fin.presupuesto', '', true);
  perform set_config('fin.presupuesto_mod', '', true);
  return v_n;
end;
$$;

-- ============ Modificaciones presupuestarias ============
create table if not exists public.presupuesto_modificaciones (
  id               bigint generated always as identity primary key,
  presupuesto_id   bigint not null references public.presupuestos (id) on delete cascade,
  numero           integer not null,
  fecha            date not null default current_date,
  tipo             text not null check (tipo in ('TRASLADO', 'AMPLIACIÓN', 'REDUCCIÓN')),
  rubro_origen_id  bigint references public.rubros_presupuesto (id),
  rubro_destino_id bigint references public.rubros_presupuesto (id),
  mes              integer not null check (mes between 1 and 12),
  monto            numeric(18, 2) not null check (monto > 0),
  justificacion    text not null check (length(trim(justificacion)) >= 10),
  estado           text not null default 'REGISTRADA' check (estado in ('REGISTRADA', 'APLICADA', 'ANULADA')),
  usuario          text,
  aplicada_por     text,
  aplicada_en      timestamptz,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (presupuesto_id, numero),
  check ((tipo = 'TRASLADO' and rubro_origen_id is not null and rubro_destino_id is not null and rubro_origen_id <> rubro_destino_id)
      or (tipo = 'AMPLIACIÓN' and rubro_destino_id is not null) or (tipo = 'REDUCCIÓN' and rubro_origen_id is not null))
);
create or replace function public.preparar_modificacion_presupuesto() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4807, new.presupuesto_id::integer);
    new.numero := coalesce((select max(numero) from public.presupuesto_modificaciones where presupuesto_id = new.presupuesto_id), 0) + 1;
    new.usuario := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
    new.estado := 'REGISTRADA';
  elsif old.estado <> 'REGISTRADA' and current_setting('fin.presupuesto_mod', true) is distinct from 'si' then
    raise exception 'La modificación % está %: ya no se cambia.', old.numero, lower(old.estado);
  end if;
  return new;
end;
$$;
drop trigger if exists presupuesto_modificaciones_preparar on public.presupuesto_modificaciones;
create trigger presupuesto_modificaciones_preparar before insert or update on public.presupuesto_modificaciones for each row execute function public.preparar_modificacion_presupuesto();

create or replace function public.aplicar_modificacion_presupuesto(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.presupuesto_modificaciones;
  v_estado text;
  v_disp numeric;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para aplicar modificaciones.'; end if;
  select * into m from public.presupuesto_modificaciones where id = p_id for update;
  if m.id is null then raise exception 'La modificación no existe.'; end if;
  if m.estado <> 'REGISTRADA' then raise exception 'La modificación ya está %.', lower(m.estado); end if;
  select estado into v_estado from public.presupuestos where id = m.presupuesto_id;
  if v_estado not in ('APROBADO', 'EN EJECUCIÓN', 'MODIFICADO') then raise exception 'Solo se modifica un presupuesto aprobado (está %).', lower(v_estado); end if;
  perform set_config('fin.presupuesto_mod', 'si', true);
  if m.rubro_origen_id is not null then
    execute format('select coalesce(m%s, 0) from public.presupuesto_lineas where presupuesto_id = $1 and rubro_id = $2', m.mes) into v_disp using m.presupuesto_id, m.rubro_origen_id;
    if coalesce(v_disp, 0) < m.monto then raise exception 'El rubro de origen solo tiene % disponible en el mes %.', coalesce(v_disp, 0), m.mes; end if;
    execute format('update public.presupuesto_lineas set m%s = coalesce(m%s, 0) - $3 where presupuesto_id = $1 and rubro_id = $2', m.mes, m.mes) using m.presupuesto_id, m.rubro_origen_id, m.monto;
  end if;
  if m.rubro_destino_id is not null then
    insert into public.presupuesto_lineas (presupuesto_id, rubro_id) values (m.presupuesto_id, m.rubro_destino_id) on conflict (presupuesto_id, rubro_id) do nothing;
    execute format('update public.presupuesto_lineas set m%s = coalesce(m%s, 0) + $3 where presupuesto_id = $1 and rubro_id = $2', m.mes, m.mes) using m.presupuesto_id, m.rubro_destino_id, m.monto;
  end if;
  update public.presupuesto_modificaciones set estado = 'APLICADA', aplicada_por = v_quien, aplicada_en = now() where id = m.id;
  perform set_config('fin.presupuesto', 'si', true);
  update public.presupuestos set estado = 'MODIFICADO' where id = m.presupuesto_id and estado <> 'MODIFICADO';
  perform set_config('fin.presupuesto', '', true);
  perform set_config('fin.presupuesto_mod', '', true);
end;
$$;

-- ============ Flujo de efectivo proyectado ============
create table if not exists public.flujo_proyecciones (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id    bigint not null references public.localidades (id),
  numero          integer not null,
  nombre          text not null,
  tipo            text not null default 'SEMANAL' check (tipo in ('SEMANAL', 'MENSUAL')),
  periodos        integer not null default 13 check (periodos between 1 and 24),
  fecha_inicio    date not null,
  escenario       text not null default 'BASE',
  saldo_inicial   numeric(18, 2) not null default 0,
  saldo_minimo    numeric(18, 2) not null default 0,
  estado          text not null default 'BORRADOR' check (estado in ('BORRADOR', 'APROBADA', 'ANULADA')),
  descripcion     text,
  usuario         text,
  cargado_en      timestamptz,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (localidad_id, numero)
);
create table if not exists public.flujo_lineas (
  id             bigint generated always as identity primary key,
  proyeccion_id  bigint not null references public.flujo_proyecciones (id) on delete cascade,
  rubro_flujo_id bigint not null references public.rubros_flujo (id),
  periodo        integer not null check (periodo between 1 and 24),
  monto          numeric(18, 2) not null default 0,
  automatico     boolean not null default false,
  unique (proyeccion_id, rubro_flujo_id, periodo)
);
create or replace function public.preparar_flujo_proyeccion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4808, new.localidad_id::integer);
    new.numero := coalesce((select max(numero) from public.flujo_proyecciones where localidad_id = new.localidad_id), 0) + 1;
    new.usuario := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
    new.periodos := case when new.tipo = 'SEMANAL' then least(greatest(new.periodos, 1), 24) else least(greatest(new.periodos, 1), 24) end;
  else
    new.localidad_id := old.localidad_id; new.numero := old.numero;
  end if;
  return new;
end;
$$;
drop trigger if exists flujo_proyecciones_preparar on public.flujo_proyecciones;
create trigger flujo_proyecciones_preparar before insert or update on public.flujo_proyecciones for each row execute function public.preparar_flujo_proyeccion();

-- Catálogos por omisión de la empresa (rubros de flujo NIC 7 y escenarios); no repite lo que ya existe.
create or replace function public.asegurar_catalogos_flujo(p_localidad bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org bigint;
begin
  select organizacion_id into v_org from public.localidades where id = p_localidad;
  if v_org is null then raise exception 'La empresa no existe.'; end if;
  insert into public.rubros_flujo (organizacion_id, localidad_id, codigo, nombre, actividad, tipo, origen)
  select v_org, p_localidad, x.c, x.n, x.a, x.t, x.o from (values
    (1, 'COBROS A CLIENTES', 'OPERACIÓN', 'ENTRADA', 'COBROS'),
    (2, 'OTROS INGRESOS DE OPERACIÓN', 'OPERACIÓN', 'ENTRADA', 'MANUAL'),
    (10, 'PAGOS A PROVEEDORES', 'OPERACIÓN', 'SALIDA', 'PAGOS'),
    (11, 'PLANILLA Y PRESTACIONES', 'OPERACIÓN', 'SALIDA', 'MANUAL'),
    (12, 'IMPUESTOS (IVA, ISR, ISO)', 'OPERACIÓN', 'SALIDA', 'MANUAL'),
    (13, 'GASTOS DE OPERACIÓN', 'OPERACIÓN', 'SALIDA', 'MANUAL'),
    (20, 'VENTA DE ACTIVOS', 'INVERSIÓN', 'ENTRADA', 'MANUAL'),
    (21, 'COMPRA DE ACTIVOS FIJOS', 'INVERSIÓN', 'SALIDA', 'MANUAL'),
    (30, 'PRÉSTAMOS RECIBIDOS', 'FINANCIAMIENTO', 'ENTRADA', 'MANUAL'),
    (31, 'PAGO DE PRÉSTAMOS E INTERESES', 'FINANCIAMIENTO', 'SALIDA', 'MANUAL'),
    (32, 'APORTES DE CAPITAL', 'FINANCIAMIENTO', 'ENTRADA', 'MANUAL'),
    (33, 'DIVIDENDOS PAGADOS', 'FINANCIAMIENTO', 'SALIDA', 'MANUAL')) as x(c, n, a, t, o)
  on conflict (localidad_id, codigo) do nothing;
  insert into public.escenarios_presupuesto (organizacion_id, localidad_id, codigo, nombre, factor_ingresos, factor_egresos, descripcion)
  select v_org, p_localidad, x.c, x.n, x.fi, x.fe, x.d from (values
    ('BASE', 'ESCENARIO BASE', 1.0, 1.0, 'Supuestos más probables.'),
    ('OPTIMISTA', 'ESCENARIO OPTIMISTA', 1.10, 0.95, 'Ingresos +10 %, egresos −5 %.'),
    ('CONSERVADOR', 'ESCENARIO CONSERVADOR', 0.90, 1.05, 'Ingresos −10 %, egresos +5 % (prueba de estrés de liquidez).')) as x(c, n, fi, fe, d)
  on conflict (localidad_id, codigo) do nothing;
end;
$$;

-- Carga automática: cobros (facturas con saldo por fecha estimada de cobro) y pagos (compras con saldo por
-- vencimiento) en los rubros de origen COBROS y PAGOS; lo vencido va al primer período. En quetzales.
create or replace function public.cargar_flujo_automatico(p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  f public.flujo_proyecciones;
  v_fin date;
  v_cob bigint; v_pag bigint;
  v_tc numeric; v_tp numeric;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para cargar el flujo.'; end if;
  select * into f from public.flujo_proyecciones where id = p_id;
  if f.id is null then raise exception 'La proyección no existe.'; end if;
  if f.estado <> 'BORRADOR' then raise exception 'La proyección está %: ya no se modifica.', lower(f.estado); end if;
  perform public.asegurar_catalogos_flujo(f.localidad_id);
  select id into v_cob from public.rubros_flujo where localidad_id = f.localidad_id and origen = 'COBROS' and activo order by codigo limit 1;
  select id into v_pag from public.rubros_flujo where localidad_id = f.localidad_id and origen = 'PAGOS' and activo order by codigo limit 1;
  v_fin := case when f.tipo = 'SEMANAL' then f.fecha_inicio + f.periodos * 7 - 1 else (f.fecha_inicio + make_interval(months => f.periodos))::date - 1 end;
  delete from public.flujo_lineas where proyeccion_id = f.id and automatico;
  with base as (
    select greatest(coalesce(v.fecha_cobro, (v.fecha_emision at time zone 'America/Guatemala')::date + coalesce(v.dias_credito, 0)), f.fecha_inicio) as fecha,
           v.saldo * case when m.iso is null or m.iso = 'GTQ' then 1 else coalesce(nullif(v.tipo_cambio, 0), 1) end as valor
    from public.facturas_venta v left join public.monedas m on m.id = v.moneda_id
    where v.localidad_id = f.localidad_id and v.estado <> 'ANULADA' and v.saldo > 0.004
  ), per as (
    select case when f.tipo = 'SEMANAL' then ((fecha - f.fecha_inicio) / 7) + 1 else (extract(year from age(date_trunc('month', fecha), date_trunc('month', f.fecha_inicio))) * 12 + extract(month from age(date_trunc('month', fecha), date_trunc('month', f.fecha_inicio))))::int + 1 end as periodo, valor
    from base where fecha <= v_fin
  )
  insert into public.flujo_lineas (proyeccion_id, rubro_flujo_id, periodo, monto, automatico)
  select f.id, v_cob, periodo, round(sum(valor), 2), true from per where v_cob is not null group by periodo
  on conflict (proyeccion_id, rubro_flujo_id, periodo) do update set monto = excluded.monto, automatico = true;
  with base as (
    select greatest(coalesce(c.fecha_vencimiento, c.fecha_documento), f.fecha_inicio) as fecha,
           c.pendiente * case when m.iso is null or m.iso = 'GTQ' then 1 else coalesce(nullif(c.tipo_cambio, 0), 1) end as valor
    from public.compras_saldo c left join public.monedas m on m.id = c.moneda_id
    where c.localidad_id = f.localidad_id and c.estado = 'ACTIVA' and c.pendiente > 0.004
  ), per as (
    select case when f.tipo = 'SEMANAL' then ((fecha - f.fecha_inicio) / 7) + 1 else (extract(year from age(date_trunc('month', fecha), date_trunc('month', f.fecha_inicio))) * 12 + extract(month from age(date_trunc('month', fecha), date_trunc('month', f.fecha_inicio))))::int + 1 end as periodo, valor
    from base where fecha <= v_fin
  )
  insert into public.flujo_lineas (proyeccion_id, rubro_flujo_id, periodo, monto, automatico)
  select f.id, v_pag, periodo, round(sum(valor), 2), true from per where v_pag is not null group by periodo
  on conflict (proyeccion_id, rubro_flujo_id, periodo) do update set monto = excluded.monto, automatico = true;
  update public.flujo_proyecciones set cargado_en = now() where id = f.id;
  select coalesce(sum(monto) filter (where rubro_flujo_id = v_cob), 0), coalesce(sum(monto) filter (where rubro_flujo_id = v_pag), 0) into v_tc, v_tp from public.flujo_lineas where proyeccion_id = f.id and automatico;
  return jsonb_build_object('cobros', v_tc, 'pagos', v_tp);
end;
$$;

-- ============ Auditoría, permisos y menú ============
do $$
declare t text;
begin
  foreach t in array array['rubros_flujo', 'escenarios_presupuesto', 'presupuesto_rubro_cuentas', 'presupuesto_modificaciones', 'flujo_proyecciones'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.auditar()', t || '_auditar', t);
  end loop;
  foreach t in array array['rubros_flujo', 'escenarios_presupuesto', 'presupuesto_rubro_cuentas', 'presupuesto_modificaciones', 'flujo_proyecciones', 'flujo_lineas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('drop policy if exists "%s: modificar" on public.%I', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
    execute format('drop policy if exists "%s: quitar" on public.%I', t, t);
    execute format('create policy "%s: quitar" on public.%I for delete to authenticated using (public.puede_editar_catalogos())', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;
revoke execute on function public.mensualizar_linea_presupuesto() from public, anon, authenticated;
revoke execute on function public.preparar_modificacion_presupuesto() from public, anon, authenticated;
revoke execute on function public.preparar_flujo_proyeccion() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['public.cambiar_estado_presupuesto(bigint, text, text)', 'public.calcular_ejecucion_presupuesto(bigint)', 'public.aplicar_modificacion_presupuesto(bigint)',
                           'public.asegurar_catalogos_flujo(bigint)', 'public.cargar_flujo_automatico(bigint)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- Opciones del módulo Presupuesto y Flujo de efectivo (PFE) con los accesos de Contabilidad › Presupuesto.
do $$
declare
  v_mod bigint; v_ref bigint; v_id bigint; v_orden integer; o record;
begin
  select id into v_mod from public.modulos_sistema where siglas = 'PFE' order by codigo limit 1;
  if v_mod is null then raise notice 'No existe el módulo PFE: se omite el menú.'; return; end if;
  select id into v_ref from public.opciones_sistema where clave = 'presupuesto' order by id limit 1;
  update public.opciones_sistema set activo = false where modulo_id = v_mod and clave not in
    ('rubros-de-flujo', 'escenarios-presupuesto', 'rubros-cuentas', 'rubros-presupuesto', 'formulacion-presupuesto', 'modificaciones-presupuestarias', 'proyeccion-de-flujo',
     'aprobacion-presupuesto', 'ejecucion-presupuestaria', 'presupuesto-vs-ejecutado-pf', 'estado-flujo-efectivo', 'flujo-proyectado-vs-real', 'indicadores-financieros');
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  for o in select * from (values
    (1, 'catalogos', 'Presupuesto', 'rubros-presupuesto', 'Rubros de presupuesto'),
    (2, 'catalogos', 'Presupuesto', 'rubros-cuentas', 'Rubros y cuentas contables'),
    (3, 'catalogos', 'Presupuesto', 'escenarios-presupuesto', 'Escenarios'),
    (4, 'catalogos', 'Flujo de efectivo', 'rubros-de-flujo', 'Rubros de flujo'),
    (5, 'registros', 'Presupuesto', 'formulacion-presupuesto', 'Formulación del presupuesto'),
    (6, 'registros', 'Presupuesto', 'modificaciones-presupuestarias', 'Modificaciones presupuestarias'),
    (7, 'registros', 'Flujo de efectivo', 'proyeccion-de-flujo', 'Proyección de flujo'),
    (8, 'procesos', 'Presupuesto', 'aprobacion-presupuesto', 'Aprobación de presupuestos'),
    (9, 'procesos', 'Presupuesto', 'ejecucion-presupuestaria', 'Ejecución presupuestaria'),
    (10, 'reportes', 'Reportes', 'presupuesto-vs-ejecutado-pf', 'Presupuesto vs. ejecutado'),
    (11, 'reportes', 'Reportes', 'estado-flujo-efectivo', 'Estado de flujo de efectivo'),
    (12, 'reportes', 'Reportes', 'flujo-proyectado-vs-real', 'Flujo proyectado vs. real'),
    (13, 'reportes', 'Reportes', 'indicadores-financieros', 'Indicadores financieros')) as x(n, grupo, subgrupo, clave, nombre) loop
    select id into v_id from public.opciones_sistema where modulo_id = v_mod and clave = o.clave;
    if v_id is null then
      insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values (v_mod, o.grupo, o.subgrupo, o.clave, o.nombre, v_orden + o.n) returning id into v_id;
    else
      update public.opciones_sistema set grupo = o.grupo, subgrupo = o.subgrupo, nombre = o.nombre, activo = true where id = v_id;
    end if;
    if v_ref is not null then
      insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
      select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = v_ref on conflict do nothing;
    end if;
  end loop;
end;
$$;
notify pgrst, 'reload schema';
select 'Presupuesto y Flujo: catálogos, formulación mensual, aprobación, modificaciones, ejecución y proyección de flujo instalados.' as resultado;
