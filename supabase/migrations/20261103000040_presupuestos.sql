-- Presupuestos.
--   Catálogos · Cuentas y CC · Rubros de presupuesto: rubros que normalmente se presupuestan en
--   las empresas financieras y administrativas de Guatemala, por grupo (ingresos, gastos de
--   personal, financieros, administrativos, impuestos e inversiones).
--   Registros · Presupuesto (maestro - detalle), por organización y localidad:
--     Maestro: número (correlativo por localidad), fecha, tipo de presupuesto, año, frecuencia
--       (semanal, mensual, trimestral, semestral o anual) y período (fechas calculadas), estado,
--       descripción; elaboró y aprobó (automáticos).
--     Detalle: rubros con lo presupuestado y lo ejecutado del período; la variación y el
--       porcentaje de ejecución se calculan.
--   Estados: FORMULACIÓN → EN REVISIÓN → APROBADO → EN EJECUCIÓN (→ MODIFICADO) → CERRADO, o ANULADO.
--   Cerrado o anulado, ya no se modifica. Escribir: administrador.
-- Puede ejecutarse de nuevo.

-- ---------- Rubros ----------
create table if not exists public.rubros_presupuesto (
  id         bigint generated always as identity primary key,
  codigo     integer not null unique check (codigo > 0),
  nombre     text not null,
  grupo      text not null check (grupo in ('INGRESOS', 'GASTOS DE PERSONAL', 'GASTOS FINANCIEROS', 'GASTOS ADMINISTRATIVOS', 'IMPUESTOS', 'INVERSIONES')),
  naturaleza text not null default 'EGRESO' check (naturaleza in ('INGRESO', 'EGRESO', 'INVERSIÓN')),
  activo     boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create unique index if not exists rubros_presupuesto_nombre_key on public.rubros_presupuesto (lower(nombre));
drop trigger if exists rubros_presupuesto_auditar on public.rubros_presupuesto;
create trigger rubros_presupuesto_auditar before insert or update on public.rubros_presupuesto for each row execute function public.auditar();

insert into public.rubros_presupuesto (codigo, nombre, grupo, naturaleza) values
  (101, 'INTERESES SOBRE CARTERA DE CRÉDITOS',           'INGRESOS', 'INGRESO'),
  (102, 'COMISIONES Y SERVICIOS',                        'INGRESOS', 'INGRESO'),
  (103, 'PRODUCTOS DE INVERSIONES',                      'INGRESOS', 'INGRESO'),
  (104, 'VENTAS DE BIENES Y SERVICIOS',                  'INGRESOS', 'INGRESO'),
  (105, 'DIFERENCIAL CAMBIARIO',                         'INGRESOS', 'INGRESO'),
  (106, 'OTROS INGRESOS DE OPERACIÓN',                   'INGRESOS', 'INGRESO'),
  (107, 'INGRESOS EXTRAORDINARIOS',                      'INGRESOS', 'INGRESO'),
  (201, 'SUELDOS Y SALARIOS',                            'GASTOS DE PERSONAL', 'EGRESO'),
  (202, 'BONIFICACIÓN INCENTIVO (DECRETO 37-2001)',      'GASTOS DE PERSONAL', 'EGRESO'),
  (203, 'HORAS EXTRAORDINARIAS',                         'GASTOS DE PERSONAL', 'EGRESO'),
  (204, 'AGUINALDO',                                     'GASTOS DE PERSONAL', 'EGRESO'),
  (205, 'BONO 14',                                       'GASTOS DE PERSONAL', 'EGRESO'),
  (206, 'VACACIONES',                                    'GASTOS DE PERSONAL', 'EGRESO'),
  (207, 'INDEMNIZACIONES',                               'GASTOS DE PERSONAL', 'EGRESO'),
  (208, 'CUOTA PATRONAL IGSS, IRTRA E INTECAP',          'GASTOS DE PERSONAL', 'EGRESO'),
  (209, 'CAPACITACIÓN Y DESARROLLO',                     'GASTOS DE PERSONAL', 'EGRESO'),
  (210, 'VIÁTICOS Y GASTOS DE VIAJE',                    'GASTOS DE PERSONAL', 'EGRESO'),
  (301, 'INTERESES SOBRE CAPTACIONES (DEPÓSITOS)',       'GASTOS FINANCIEROS', 'EGRESO'),
  (302, 'INTERESES SOBRE PRÉSTAMOS RECIBIDOS',           'GASTOS FINANCIEROS', 'EGRESO'),
  (303, 'COMISIONES Y GASTOS BANCARIOS',                 'GASTOS FINANCIEROS', 'EGRESO'),
  (304, 'ESTIMACIONES POR INCOBRABILIDAD (RESERVAS)',    'GASTOS FINANCIEROS', 'EGRESO'),
  (305, 'CUOTAS A LA SUPERINTENDENCIA DE BANCOS',        'GASTOS FINANCIEROS', 'EGRESO'),
  (401, 'ARRENDAMIENTOS',                                'GASTOS ADMINISTRATIVOS', 'EGRESO'),
  (402, 'ENERGÍA ELÉCTRICA',                             'GASTOS ADMINISTRATIVOS', 'EGRESO'),
  (403, 'AGUA',                                          'GASTOS ADMINISTRATIVOS', 'EGRESO'),
  (404, 'TELEFONÍA E INTERNET',                          'GASTOS ADMINISTRATIVOS', 'EGRESO'),
  (405, 'PAPELERÍA Y ÚTILES DE OFICINA',                 'GASTOS ADMINISTRATIVOS', 'EGRESO'),
  (406, 'MANTENIMIENTO Y REPARACIONES',                  'GASTOS ADMINISTRATIVOS', 'EGRESO'),
  (407, 'SEGUROS Y FIANZAS',                             'GASTOS ADMINISTRATIVOS', 'EGRESO'),
  (408, 'HONORARIOS PROFESIONALES',                      'GASTOS ADMINISTRATIVOS', 'EGRESO'),
  (409, 'SERVICIOS DE SEGURIDAD Y VIGILANCIA',           'GASTOS ADMINISTRATIVOS', 'EGRESO'),
  (410, 'LIMPIEZA',                                      'GASTOS ADMINISTRATIVOS', 'EGRESO'),
  (411, 'PUBLICIDAD Y MERCADEO',                         'GASTOS ADMINISTRATIVOS', 'EGRESO'),
  (412, 'COMBUSTIBLES Y LUBRICANTES',                    'GASTOS ADMINISTRATIVOS', 'EGRESO'),
  (413, 'TECNOLOGÍA Y LICENCIAS DE SOFTWARE',            'GASTOS ADMINISTRATIVOS', 'EGRESO'),
  (414, 'DEPRECIACIONES Y AMORTIZACIONES',               'GASTOS ADMINISTRATIVOS', 'EGRESO'),
  (415, 'TRANSPORTE Y MENSAJERÍA',                       'GASTOS ADMINISTRATIVOS', 'EGRESO'),
  (416, 'OTROS GASTOS DE ADMINISTRACIÓN',                'GASTOS ADMINISTRATIVOS', 'EGRESO'),
  (501, 'IMPUESTO SOBRE LA RENTA (ISR)',                 'IMPUESTOS', 'EGRESO'),
  (502, 'IMPUESTO DE SOLIDARIDAD (ISO)',                 'IMPUESTOS', 'EGRESO'),
  (503, 'IUSI, TIMBRES Y OTROS IMPUESTOS',               'IMPUESTOS', 'EGRESO'),
  (601, 'MOBILIARIO Y EQUIPO',                           'INVERSIONES', 'INVERSIÓN'),
  (602, 'EQUIPO DE CÓMPUTO',                             'INVERSIONES', 'INVERSIÓN'),
  (603, 'VEHÍCULOS',                                     'INVERSIONES', 'INVERSIÓN'),
  (604, 'INMUEBLES Y MEJORAS',                           'INVERSIONES', 'INVERSIÓN'),
  (605, 'SOFTWARE Y DESARROLLOS',                        'INVERSIONES', 'INVERSIÓN')
on conflict (codigo) do nothing;

-- ---------- Presupuestos ----------
create table if not exists public.presupuestos (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id    bigint not null,
  numero          integer not null,
  fecha           date not null default current_date,
  tipo            text not null check (tipo in ('PRESUPUESTO MAESTRO', 'PRESUPUESTO DE INGRESOS', 'PRESUPUESTO DE GASTOS DE OPERACIÓN',
                    'PRESUPUESTO DE PERSONAL (PLANILLA)', 'PRESUPUESTO DE INVERSIÓN (CAPITAL)', 'PRESUPUESTO DE CAJA (FLUJO DE EFECTIVO)',
                    'PRESUPUESTO FINANCIERO', 'PRESUPUESTO DE CARTERA DE CRÉDITOS', 'PRESUPUESTO DE CAPTACIONES', 'PRESUPUESTO DE COMPRAS', 'PRESUPUESTO DE VENTAS')),
  anio            integer not null check (anio between 1900 and 2999),
  frecuencia      text not null default 'MENSUAL' check (frecuencia in ('SEMANAL', 'MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL')),
  periodo         integer not null default 1 check (periodo > 0),
  fecha_inicio    date,
  fecha_fin       date,
  estado          text not null default 'FORMULACIÓN' check (estado in ('FORMULACIÓN', 'EN REVISIÓN', 'APROBADO', 'EN EJECUCIÓN', 'MODIFICADO', 'CERRADO', 'ANULADO')),
  descripcion     text,
  elaborado_por   text,
  aprobado_por    text,
  aprobado_en     timestamptz,
  total_presupuestado numeric(18, 2) not null default 0,
  total_ejecutado     numeric(18, 2) not null default 0,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, numero)
);
create index if not exists presupuestos_periodo_idx on public.presupuestos (organizacion_id, localidad_id, anio);

create table if not exists public.presupuesto_lineas (
  id             bigint generated always as identity primary key,
  presupuesto_id bigint not null references public.presupuestos (id) on delete cascade,
  rubro_id       bigint not null references public.rubros_presupuesto (id),
  presupuestado  numeric(18, 2) not null default 0 check (presupuestado >= 0),
  ejecutado      numeric(18, 2) not null default 0 check (ejecutado >= 0),
  observaciones  text,
  unique (presupuesto_id, rubro_id)
);

-- Número, período (fechas), quién elaboró y aprobó; cerrado o anulado ya no cambia.
create or replace function public.preparar_presupuesto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_quien text := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
  v_max integer;
  v_base date;
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4806, new.localidad_id::integer);
    new.numero := coalesce((select max(numero) from public.presupuestos where localidad_id = new.localidad_id), 0) + 1;
    new.elaborado_por := v_quien;
    new.aprobado_por := null; new.aprobado_en := null;
    new.total_presupuestado := 0; new.total_ejecutado := 0;
  else
    new.organizacion_id := old.organizacion_id;
    new.localidad_id := old.localidad_id;
    new.numero := old.numero;
    new.elaborado_por := old.elaborado_por;
    if old.estado in ('CERRADO', 'ANULADO') and current_setting('fin.presupuesto', true) is distinct from 'si' then
      raise exception 'El presupuesto % está %: ya no se modifica.', old.numero, lower(old.estado);
    end if;
    if current_setting('fin.presupuesto', true) is distinct from 'si' then
      new.total_presupuestado := old.total_presupuestado;
      new.total_ejecutado := old.total_ejecutado;
    end if;
    if new.estado = 'APROBADO' and old.estado <> 'APROBADO' then
      new.aprobado_por := v_quien; new.aprobado_en := now();
    elsif new.estado in ('FORMULACIÓN', 'EN REVISIÓN') then
      new.aprobado_por := null; new.aprobado_en := null;
    else
      new.aprobado_por := old.aprobado_por; new.aprobado_en := old.aprobado_en;
    end if;
  end if;
  if tg_op = 'INSERT' and new.estado = 'APROBADO' then new.aprobado_por := v_quien; new.aprobado_en := now(); end if;

  v_max := case new.frecuencia when 'SEMANAL' then 53 when 'MENSUAL' then 12 when 'TRIMESTRAL' then 4 when 'SEMESTRAL' then 2 else 1 end;
  if new.periodo > v_max then
    raise exception 'El período % no existe en la frecuencia % (máximo %).', new.periodo, lower(new.frecuencia), v_max;
  end if;
  if new.frecuencia = 'SEMANAL' then
    -- Semana ISO: la semana 1 es la que contiene el 4 de enero.
    v_base := make_date(new.anio, 1, 4);
    new.fecha_inicio := v_base - (extract(isodow from v_base)::integer - 1) + (new.periodo - 1) * 7;
    new.fecha_fin := new.fecha_inicio + 6;
  else
    new.fecha_inicio := make_date(new.anio, case new.frecuencia when 'MENSUAL' then new.periodo when 'TRIMESTRAL' then (new.periodo - 1) * 3 + 1 when 'SEMESTRAL' then (new.periodo - 1) * 6 + 1 else 1 end, 1);
    new.fecha_fin := (new.fecha_inicio + (case new.frecuencia when 'MENSUAL' then interval '1 month' when 'TRIMESTRAL' then interval '3 months' when 'SEMESTRAL' then interval '6 months' else interval '1 year' end))::date - 1;
  end if;
  new.descripcion := nullif(trim(new.descripcion), '');
  return new;
end;
$$;
drop trigger if exists presupuestos_preparar on public.presupuestos;
create trigger presupuestos_preparar before insert or update on public.presupuestos for each row execute function public.preparar_presupuesto();
drop trigger if exists presupuestos_auditar on public.presupuestos;
create trigger presupuestos_auditar before insert or update on public.presupuestos for each row execute function public.auditar();

-- Líneas: solo en presupuestos abiertos; los totales se calculan.
create or replace function public.validar_linea_presupuesto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_estado text;
begin
  select estado into v_estado from public.presupuestos where id = coalesce(new.presupuesto_id, old.presupuesto_id);
  if v_estado in ('CERRADO', 'ANULADO') then
    raise exception 'El presupuesto está %: ya no se modifica.', lower(v_estado);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.observaciones := nullif(trim(new.observaciones), '');
  return new;
end;
$$;
drop trigger if exists presupuesto_lineas_validar on public.presupuesto_lineas;
create trigger presupuesto_lineas_validar before insert or update or delete on public.presupuesto_lineas for each row execute function public.validar_linea_presupuesto();

create or replace function public.totalizar_presupuesto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint := coalesce(new.presupuesto_id, old.presupuesto_id);
begin
  perform set_config('fin.presupuesto', 'si', true);
  update public.presupuestos p
  set total_presupuestado = coalesce((select sum(l.presupuestado) from public.presupuesto_lineas l where l.presupuesto_id = v_id), 0),
      total_ejecutado = coalesce((select sum(l.ejecutado) from public.presupuesto_lineas l where l.presupuesto_id = v_id), 0)
  where p.id = v_id;
  perform set_config('fin.presupuesto', '', true);
  return null;
end;
$$;
drop trigger if exists presupuesto_lineas_totalizar on public.presupuesto_lineas;
create trigger presupuesto_lineas_totalizar after insert or update or delete on public.presupuesto_lineas for each row execute function public.totalizar_presupuesto();

do $$
declare t text;
begin
  foreach t in array array['rubros_presupuesto', 'presupuestos', 'presupuesto_lineas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format('drop policy if exists "%s: modificar" on public.%I', t, t);
    execute format('drop policy if exists "%s: quitar" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
  end loop;
end;
$$;
create policy "presupuesto_lineas: quitar" on public.presupuesto_lineas for delete to authenticated using (public.puede_editar_catalogos());
create policy "presupuestos: quitar" on public.presupuestos for delete to authenticated using (public.es_superadmin() and estado in ('FORMULACIÓN', 'ANULADO'));

revoke execute on function public.preparar_presupuesto() from public, anon, authenticated;
revoke execute on function public.validar_linea_presupuesto() from public, anon, authenticated;
revoke execute on function public.totalizar_presupuesto() from public, anon, authenticated;

-- ---------- Menú y Roles módulos ----------
do $$
declare
  v_con bigint := (select id from public.modulos_sistema where siglas = 'CON' and modulo_mayor_id is null);
  v_orden integer := (select orden from public.opciones_sistema where clave = 'tipos-de-partida' and modulo_id = v_con);
begin
  -- "Presupuesto anual" pasa a llamarse "Presupuesto" y es una pantalla del subgrupo Presupuestos.
  update public.opciones_sistema set clave = 'presupuesto', nombre = 'Presupuesto', subgrupo = 'Presupuestos'
  where clave = 'presupuesto-anual' and modulo_id = v_con;
  if v_orden is not null and not exists (select 1 from public.opciones_sistema where clave = 'rubros-presupuesto') then
    update public.opciones_sistema set orden = orden + 1 where orden > v_orden;
    insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
    values (v_con, 'catalogos', 'Cuentas y CC', 'rubros-presupuesto', 'Rubros de presupuesto', v_orden + 1);
  end if;
end;
$$;

notify pgrst, 'reload schema';
