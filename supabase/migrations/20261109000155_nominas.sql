-- Nóminas (Guatemala): parámetros legales (IGSS laboral 4.83 %, patronal 12.67 % = IGSS 10.67 + INTECAP 1 + IRTRA 1,
-- bonificación incentivo Decreto 37-2001, ISR de asalariados), departamentos, puestos, empleados, conceptos de ingreso
-- y descuento, novedades del período, anticipos y préstamos, vacaciones, planillas (ordinaria, Bono 14, aguinaldo y
-- liquidación laboral) con aprobación por segregación de funciones, pago y partida contable.

create table if not exists public.nom_parametros (
  id                    bigint generated always as identity primary key,
  organizacion_id       bigint not null references public.organizaciones (id),
  localidad_id          bigint not null unique references public.localidades (id),
  igss_laboral          numeric(6, 3) not null default 4.83,
  igss_patronal         numeric(6, 3) not null default 12.67,
  bonificacion_incentivo numeric(12, 2) not null default 250,
  salario_minimo        numeric(12, 2) not null default 0,
  isr_deduccion_personal numeric(14, 2) not null default 48000,
  isr_limite_tramo      numeric(14, 2) not null default 300000,
  isr_tasa_1            numeric(5, 2) not null default 5,
  isr_tasa_2            numeric(5, 2) not null default 7,
  frecuencia            text not null default 'MENSUAL' check (frecuencia in ('MENSUAL', 'QUINCENAL')),
  cta_sueldos           text, cta_bonificacion text, cta_igss_patronal text, cta_bono14_aguinaldo text, cta_indemnizacion text,
  cta_igss_por_pagar    text, cta_isr_por_pagar text, cta_prestamos text, cta_otros_descuentos text, cta_sueldos_por_pagar text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.nom_departamentos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo integer not null, nombre text not null, centro_id bigint, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.nom_puestos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo integer not null, nombre text not null, departamento_id bigint references public.nom_departamentos (id), salario_base numeric(12, 2) not null default 0, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.nom_empleados (
  id                bigint generated always as identity primary key,
  organizacion_id   bigint not null references public.organizaciones (id),
  localidad_id      bigint not null references public.localidades (id),
  codigo            integer not null,
  nombres           text not null,
  apellidos         text not null,
  dpi               text,
  nit               text,
  igss_afiliacion   text,
  fecha_nacimiento  date,
  genero            text check (genero in ('M', 'F')),
  fecha_ingreso     date not null,
  fecha_baja        date,
  motivo_baja       text,
  departamento_id   bigint references public.nom_departamentos (id),
  puesto_id         bigint references public.nom_puestos (id),
  tipo_contrato     text not null default 'INDEFINIDO' check (tipo_contrato in ('INDEFINIDO', 'PLAZO FIJO', 'POR OBRA')),
  jornada           text not null default 'DIURNA' check (jornada in ('DIURNA', 'MIXTA', 'NOCTURNA')),
  salario_base      numeric(12, 2) not null check (salario_base >= 0),
  bonificacion      numeric(12, 2) not null default 250 check (bonificacion >= 0),
  forma_pago        text not null default 'TRANSFERENCIA' check (forma_pago in ('TRANSFERENCIA', 'CHEQUE', 'EFECTIVO')),
  banco             text,
  cuenta_bancaria   text,
  correo            text,
  telefono          text,
  estado            text not null default 'ACTIVO' check (estado in ('ACTIVO', 'BAJA', 'SUSPENDIDO')),
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (localidad_id, codigo)
);
create table if not exists public.nom_conceptos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo text not null, nombre text not null, tipo text not null check (tipo in ('INGRESO', 'DESCUENTO')),
  afecto_igss boolean not null default true, afecto_isr boolean not null default true, afecto_prestaciones boolean not null default true, cuenta_codigo text, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.nom_novedades (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  empleado_id bigint not null references public.nom_empleados (id) on delete cascade, anio integer not null, mes integer not null check (mes between 1 and 12), quincena integer not null default 0 check (quincena in (0, 1, 2)),
  clase text not null check (clase in ('HORAS EXTRA', 'AUSENCIA', 'SUSPENSIÓN IGSS', 'INGRESO', 'DESCUENTO')),
  concepto_id bigint references public.nom_conceptos (id), cantidad numeric(10, 2) not null default 0, monto numeric(12, 2) not null default 0, descripcion text,
  planilla_id bigint, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.nom_prestamos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  empleado_id bigint not null references public.nom_empleados (id) on delete cascade, tipo text not null default 'PRÉSTAMO' check (tipo in ('ANTICIPO', 'PRÉSTAMO')),
  fecha date not null default current_date, monto numeric(12, 2) not null check (monto > 0), cuotas integer not null default 1 check (cuotas > 0), cuota numeric(12, 2) not null,
  saldo numeric(12, 2) not null, estado text not null default 'ACTIVO' check (estado in ('ACTIVO', 'PAGADO', 'ANULADO')), descripcion text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.nom_vacaciones (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  empleado_id bigint not null references public.nom_empleados (id) on delete cascade, desde date not null, hasta date not null, dias numeric(6, 2) not null check (dias > 0),
  periodo text, observaciones text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, check (hasta >= desde)
);
create table if not exists public.nom_planillas (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, tipo text not null default 'ORDINARIA' check (tipo in ('ORDINARIA', 'BONO 14', 'AGUINALDO', 'LIQUIDACIÓN')),
  anio integer not null, mes integer not null check (mes between 1 and 12), quincena integer not null default 0 check (quincena in (0, 1, 2)),
  fecha_pago date not null default current_date, descripcion text,
  estado text not null default 'CALCULADA' check (estado in ('CALCULADA', 'APROBADA', 'PAGADA', 'ANULADA')),
  total_ingresos numeric(14, 2) not null default 0, total_descuentos numeric(14, 2) not null default 0, total_liquido numeric(14, 2) not null default 0,
  total_igss_laboral numeric(14, 2) not null default 0, total_igss_patronal numeric(14, 2) not null default 0, total_isr numeric(14, 2) not null default 0, empleados integer not null default 0,
  elaborado_por text, aprobado_por text, aprobado_en timestamptz, pagado_por text, pagado_en timestamptz, anulado_por text, motivo_anulacion text, partida_id bigint,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.nom_planilla_lineas (
  id bigint generated always as identity primary key, planilla_id bigint not null references public.nom_planillas (id) on delete cascade,
  empleado_id bigint not null references public.nom_empleados (id), departamento_id bigint, dias numeric(6, 2) not null default 30,
  salario numeric(12, 2) not null default 0, horas_extra numeric(8, 2) not null default 0, monto_horas_extra numeric(12, 2) not null default 0,
  bonificacion numeric(12, 2) not null default 0, otros_ingresos numeric(12, 2) not null default 0, prestaciones numeric(12, 2) not null default 0, total_ingresos numeric(12, 2) not null default 0,
  igss_laboral numeric(12, 2) not null default 0, isr numeric(12, 2) not null default 0, prestamos numeric(12, 2) not null default 0, otros_descuentos numeric(12, 2) not null default 0,
  total_descuentos numeric(12, 2) not null default 0, liquido numeric(12, 2) not null default 0, igss_patronal numeric(12, 2) not null default 0, detalle jsonb,
  unique (planilla_id, empleado_id)
);

-- Numeración, totales y protección de la planilla.
create or replace function public.nom_preparar_planilla() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4809, new.localidad_id::integer);
    new.numero := coalesce((select max(numero) from public.nom_planillas where localidad_id = new.localidad_id), 0) + 1;
    new.elaborado_por := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
    new.estado := 'CALCULADA';
  elsif current_setting('fin.nomina', true) is distinct from 'si' then
    if old.estado <> 'CALCULADA' then raise exception 'La planilla % está %: ya no se modifica.', old.numero, lower(old.estado); end if;
    new.estado := old.estado; new.numero := old.numero; new.elaborado_por := old.elaborado_por;
  end if;
  return new;
end;
$$;
drop trigger if exists nom_planillas_preparar on public.nom_planillas;
create trigger nom_planillas_preparar before insert or update on public.nom_planillas for each row execute function public.nom_preparar_planilla();
create or replace function public.nom_validar_linea() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_estado text;
begin
  select estado into v_estado from public.nom_planillas where id = coalesce(new.planilla_id, old.planilla_id);
  if v_estado <> 'CALCULADA' and current_setting('fin.nomina', true) is distinct from 'si' then raise exception 'La planilla está %: no se cambian sus líneas.', lower(v_estado); end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists nom_planilla_lineas_validar on public.nom_planilla_lineas;
create trigger nom_planilla_lineas_validar before insert or update or delete on public.nom_planilla_lineas for each row execute function public.nom_validar_linea();
create or replace function public.nom_totalizar() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id bigint := coalesce(new.planilla_id, old.planilla_id);
begin
  perform set_config('fin.nomina', 'si', true);
  update public.nom_planillas p set total_ingresos = coalesce(s.i, 0), total_descuentos = coalesce(s.d, 0), total_liquido = coalesce(s.l, 0), total_igss_laboral = coalesce(s.il, 0), total_igss_patronal = coalesce(s.ip, 0), total_isr = coalesce(s.isr, 0), empleados = coalesce(s.n, 0)
  from (select sum(total_ingresos) i, sum(total_descuentos) d, sum(liquido) l, sum(igss_laboral) il, sum(igss_patronal) ip, sum(isr) isr, count(*) n from public.nom_planilla_lineas where planilla_id = v_id) s where p.id = v_id;
  perform set_config('fin.nomina', '', true);
  return null;
end;
$$;
drop trigger if exists nom_planilla_lineas_totalizar on public.nom_planilla_lineas;
create trigger nom_planilla_lineas_totalizar after insert or update or delete on public.nom_planilla_lineas for each row execute function public.nom_totalizar();

-- Catálogos por omisión (parámetros legales y conceptos).
create or replace function public.nom_asegurar_catalogos(p_localidad bigint) returns void language plpgsql security definer set search_path = '' as $$
declare v_org bigint;
begin
  select organizacion_id into v_org from public.localidades where id = p_localidad;
  if v_org is null then raise exception 'La empresa no existe.'; end if;
  insert into public.nom_parametros (organizacion_id, localidad_id) values (v_org, p_localidad) on conflict (localidad_id) do nothing;
  insert into public.nom_conceptos (organizacion_id, localidad_id, codigo, nombre, tipo, afecto_igss, afecto_isr, afecto_prestaciones)
  select v_org, p_localidad, x.c, x.n, x.t, x.ig, x.isr, x.pr from (values
    ('COM', 'COMISIONES', 'INGRESO', true, true, true), ('BON', 'OTROS BONOS', 'INGRESO', true, true, false), ('VIA', 'VIÁTICOS (NO AFECTOS)', 'INGRESO', false, false, false),
    ('DES', 'OTROS DESCUENTOS', 'DESCUENTO', false, false, false), ('JUD', 'DESCUENTO JUDICIAL', 'DESCUENTO', false, false, false), ('SEG', 'SEGURO MÉDICO', 'DESCUENTO', false, false, false)) as x(c, n, t, ig, isr, pr)
  on conflict (localidad_id, codigo) do nothing;
end;
$$;

-- Flujo de la planilla: APROBAR (quien elaboró no aprueba, salvo el Super Administrador), PAGAR (descuenta las cuotas de
-- préstamos, marca las novedades y da de baja al empleado liquidado), ANULAR (con motivo, antes de pagar).
create or replace function public.nom_cambiar_estado_planilla(p_id bigint, p_accion text, p_motivo text default null) returns void language plpgsql security definer set search_path = '' as $$
declare
  p public.nom_planillas;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  l record;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para operar planillas.'; end if;
  select * into p from public.nom_planillas where id = p_id for update;
  if p.id is null then raise exception 'La planilla no existe.'; end if;
  perform set_config('fin.nomina', 'si', true);
  if upper(p_accion) = 'APROBAR' then
    if p.estado <> 'CALCULADA' then raise exception 'Solo se aprueba una planilla calculada.'; end if;
    if p.empleados = 0 then raise exception 'La planilla no tiene empleados.'; end if;
    if v_quien = p.elaborado_por and not public.es_superadmin() then raise exception 'Segregación de funciones: quien calculó la planilla no puede aprobarla.'; end if;
    update public.nom_planillas set estado = 'APROBADA', aprobado_por = v_quien, aprobado_en = now() where id = p.id;
  elsif upper(p_accion) = 'PAGAR' then
    if p.estado <> 'APROBADA' then raise exception 'Solo se paga una planilla aprobada.'; end if;
    for l in select empleado_id, prestamos from public.nom_planilla_lineas where planilla_id = p.id and prestamos > 0 loop
      update public.nom_prestamos x set saldo = greatest(0, x.saldo - least(x.cuota, x.saldo)), estado = case when x.saldo - least(x.cuota, x.saldo) <= 0.004 then 'PAGADO' else 'ACTIVO' end
      where x.empleado_id = l.empleado_id and x.estado = 'ACTIVO';
    end loop;
    update public.nom_novedades set planilla_id = p.id where localidad_id = p.localidad_id and anio = p.anio and mes = p.mes and planilla_id is null and (quincena = 0 or quincena = p.quincena) and p.tipo = 'ORDINARIA'
      and empleado_id in (select empleado_id from public.nom_planilla_lineas where planilla_id = p.id);
    if p.tipo = 'LIQUIDACIÓN' then
      update public.nom_empleados e set estado = 'BAJA', fecha_baja = coalesce(e.fecha_baja, p.fecha_pago) where e.id in (select empleado_id from public.nom_planilla_lineas where planilla_id = p.id);
    end if;
    update public.nom_planillas set estado = 'PAGADA', pagado_por = v_quien, pagado_en = now() where id = p.id;
  elsif upper(p_accion) = 'ANULAR' then
    if p.estado not in ('CALCULADA', 'APROBADA') then raise exception 'Una planilla pagada no se anula (revierte su partida y registra una planilla de ajuste).'; end if;
    if coalesce(trim(p_motivo), '') = '' then raise exception 'Escribe el motivo de la anulación.'; end if;
    update public.nom_planillas set estado = 'ANULADA', anulado_por = v_quien, motivo_anulacion = trim(p_motivo) where id = p.id;
  else raise exception 'Acción desconocida: %.', p_accion;
  end if;
  perform set_config('fin.nomina', '', true);
end;
$$;

-- Partida contable de la planilla con las cuentas de los parámetros (deben existir en el catálogo de la empresa).
create or replace function public.nom_generar_partida(p_id bigint) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  p public.nom_planillas; pr public.nom_parametros;
  v_partida bigint; v_cat bigint; v_tipo bigint; v_gtq bigint; v_falta text;
  s record;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para contabilizar planillas.'; end if;
  select * into p from public.nom_planillas where id = p_id for update;
  if p.estado not in ('APROBADA', 'PAGADA') then raise exception 'Se contabiliza una planilla aprobada o pagada.'; end if;
  if p.partida_id is not null and exists (select 1 from public.partidas where id = p.partida_id and estado = 'VIGENTE') then raise exception 'La planilla ya tiene su partida vigente.'; end if;
  select * into pr from public.nom_parametros where localidad_id = p.localidad_id;
  select sum(salario + monto_horas_extra + otros_ingresos) sueldos, sum(bonificacion) bono, sum(prestaciones) prest, sum(igss_patronal) patr, sum(igss_laboral) lab, sum(isr) isr, sum(prestamos) pres, sum(otros_descuentos) otros, sum(liquido) liq
  into s from public.nom_planilla_lineas where planilla_id = p.id;
  select id into v_tipo from public.tipos_partida where siglas = 'PN'; if v_tipo is null then select id into v_tipo from public.tipos_partida order by codigo limit 1; end if;
  select id into v_gtq from public.monedas where iso = 'GTQ' limit 1;
  insert into public.partidas (organizacion_id, localidad_id, anio, mes, tipo_partida_id, descripcion, moneda_id, tipo_cambio, justificacion)
  values (p.organizacion_id, p.localidad_id, p.anio, p.mes, v_tipo, left(format('PLANILLA %s No. %s · %s/%s%s', p.tipo, p.numero, lpad(p.mes::text, 2, '0'), p.anio, case when p.quincena > 0 then ' Q' || p.quincena else '' end), 300), v_gtq, 1, 'Generada desde Nóminas · planilla ' || p.numero)
  returning id, catalogo_id into v_partida, v_cat;
  with x(o, cod, concepto, debe, haber) as (values
    (1, pr.cta_sueldos, 'SUELDOS, HORAS EXTRA Y OTROS INGRESOS', coalesce(s.sueldos, 0), 0::numeric),
    (2, pr.cta_bonificacion, 'BONIFICACIÓN INCENTIVO', coalesce(s.bono, 0), 0),
    (3, coalesce(pr.cta_bono14_aguinaldo, pr.cta_sueldos), 'BONO 14, AGUINALDO, VACACIONES E INDEMNIZACIÓN', coalesce(s.prest, 0), 0),
    (4, pr.cta_igss_patronal, 'CUOTA PATRONAL IGSS, INTECAP E IRTRA', coalesce(s.patr, 0), 0),
    (5, pr.cta_igss_por_pagar, 'IGSS POR PAGAR (LABORAL Y PATRONAL)', 0, coalesce(s.lab, 0) + coalesce(s.patr, 0)),
    (6, pr.cta_isr_por_pagar, 'ISR ASALARIADOS POR PAGAR', 0, coalesce(s.isr, 0)),
    (7, pr.cta_prestamos, 'ANTICIPOS Y PRÉSTAMOS A EMPLEADOS', 0, coalesce(s.pres, 0)),
    (8, coalesce(pr.cta_otros_descuentos, pr.cta_sueldos_por_pagar), 'OTROS DESCUENTOS', 0, coalesce(s.otros, 0)),
    (9, pr.cta_sueldos_por_pagar, 'SUELDOS POR PAGAR (LÍQUIDO)', 0, coalesce(s.liq, 0)))
  select string_agg(x.concepto, ', ') into v_falta from x where (x.debe <> 0 or x.haber <> 0) and (x.cod is null or not exists (select 1 from public.cuentas c where c.catalogo_id = v_cat and c.codigo = x.cod));
  if v_falta is not null then raise exception 'Configura en Nóminas › Parámetros cuentas de movimiento válidas para: %.', v_falta; end if;
  insert into public.partida_lineas (partida_id, linea, cuenta_id, concepto, debe, haber)
  select v_partida, row_number() over (order by x.o), (select c.id from public.cuentas c where c.catalogo_id = v_cat and c.codigo = x.cod), x.concepto, x.debe, x.haber
  from (values
    (1, pr.cta_sueldos, 'SUELDOS, HORAS EXTRA Y OTROS INGRESOS', coalesce(s.sueldos, 0), 0::numeric),
    (2, pr.cta_bonificacion, 'BONIFICACIÓN INCENTIVO', coalesce(s.bono, 0), 0),
    (3, coalesce(pr.cta_bono14_aguinaldo, pr.cta_sueldos), 'BONO 14, AGUINALDO, VACACIONES E INDEMNIZACIÓN', coalesce(s.prest, 0), 0),
    (4, pr.cta_igss_patronal, 'CUOTA PATRONAL IGSS, INTECAP E IRTRA', coalesce(s.patr, 0), 0),
    (5, pr.cta_igss_por_pagar, 'IGSS POR PAGAR (LABORAL Y PATRONAL)', 0, coalesce(s.lab, 0) + coalesce(s.patr, 0)),
    (6, pr.cta_isr_por_pagar, 'ISR ASALARIADOS POR PAGAR', 0, coalesce(s.isr, 0)),
    (7, pr.cta_prestamos, 'ANTICIPOS Y PRÉSTAMOS A EMPLEADOS', 0, coalesce(s.pres, 0)),
    (8, coalesce(pr.cta_otros_descuentos, pr.cta_sueldos_por_pagar), 'OTROS DESCUENTOS', 0, coalesce(s.otros, 0)),
    (9, pr.cta_sueldos_por_pagar, 'SUELDOS POR PAGAR (LÍQUIDO)', 0, coalesce(s.liq, 0))) as x(o, cod, concepto, debe, haber)
  where x.debe <> 0 or x.haber <> 0;
  perform set_config('fin.nomina', 'si', true);
  update public.nom_planillas set partida_id = v_partida where id = p.id;
  perform set_config('fin.nomina', '', true);
  return v_partida;
end;
$$;

-- ============ Auditoría, permisos y menú ============
do $$
declare t text;
begin
  foreach t in array array['nom_parametros', 'nom_departamentos', 'nom_puestos', 'nom_empleados', 'nom_conceptos', 'nom_novedades', 'nom_prestamos', 'nom_vacaciones', 'nom_planillas'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.auditar()', t || '_auditar', t);
  end loop;
  foreach t in array array['nom_parametros', 'nom_departamentos', 'nom_puestos', 'nom_empleados', 'nom_conceptos', 'nom_novedades', 'nom_prestamos', 'nom_vacaciones', 'nom_planillas', 'nom_planilla_lineas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
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
revoke execute on function public.nom_preparar_planilla() from public, anon, authenticated;
revoke execute on function public.nom_validar_linea() from public, anon, authenticated;
revoke execute on function public.nom_totalizar() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['public.nom_asegurar_catalogos(bigint)', 'public.nom_cambiar_estado_planilla(bigint, text, text)', 'public.nom_generar_partida(bigint)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
do $$
declare v_mod bigint; v_ref bigint; v_id bigint; v_orden integer; o record;
begin
  select id into v_mod from public.modulos_sistema where siglas = 'NOM' order by codigo limit 1;
  if v_mod is null then raise notice 'No existe el módulo NOM: se omite el menú.'; return; end if;
  select id into v_ref from public.opciones_sistema where clave = 'presupuesto' order by id limit 1;
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  for o in select * from (values
    (1, 'catalogos', 'Personal', 'nom-empleados', 'Empleados'), (2, 'catalogos', 'Personal', 'nom-departamentos', 'Departamentos'), (3, 'catalogos', 'Personal', 'nom-puestos', 'Puestos'),
    (4, 'catalogos', 'Configuración', 'nom-conceptos', 'Conceptos de ingreso y descuento'), (5, 'catalogos', 'Configuración', 'nom-parametros', 'Parámetros de nómina'),
    (6, 'registros', 'Novedades', 'nom-novedades', 'Novedades del período'), (7, 'registros', 'Novedades', 'nom-prestamos', 'Anticipos y préstamos'), (8, 'registros', 'Novedades', 'nom-vacaciones', 'Vacaciones'),
    (9, 'procesos', 'Planillas', 'nom-planilla', 'Planillas'), (10, 'procesos', 'Planillas', 'nom-liquidacion', 'Liquidación laboral'),
    (11, 'reportes', 'Reportes', 'nom-reporte-planilla', 'Planilla del período'), (12, 'reportes', 'Reportes', 'nom-boletas', 'Boletas de pago'), (13, 'reportes', 'Reportes', 'nom-planilla-igss', 'Planilla del IGSS'),
    (14, 'reportes', 'Reportes', 'nom-retenciones-isr', 'Retenciones de ISR'), (15, 'reportes', 'Reportes', 'nom-libro-salarios', 'Libro de salarios'), (16, 'reportes', 'Reportes', 'nom-costo-personal', 'Costo de personal'),
    (17, 'reportes', 'Reportes', 'nom-provision-prestaciones', 'Provisión de prestaciones')) as x(n, grupo, subgrupo, clave, nombre) loop
    select id into v_id from public.opciones_sistema where modulo_id = v_mod and clave = o.clave;
    if v_id is null then insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values (v_mod, o.grupo, o.subgrupo, o.clave, o.nombre, v_orden + o.n) returning id into v_id;
    else update public.opciones_sistema set grupo = o.grupo, subgrupo = o.subgrupo, nombre = o.nombre, activo = true where id = v_id; end if;
    if v_ref is not null then
      insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
      select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = v_ref on conflict do nothing;
    end if;
  end loop;
end;
$$;
notify pgrst, 'reload schema';
select 'Nóminas: parámetros, personal, conceptos, novedades, préstamos, vacaciones, planillas y partida contable instalados.' as resultado;
