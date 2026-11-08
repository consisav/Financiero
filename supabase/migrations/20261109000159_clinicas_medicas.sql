-- Clínicas médicas (consulta externa). Comparte con Hospital los pacientes, médicos, especialidades y aseguradoras.
-- Catálogos: consultorios, horarios de médicos, servicios y tarifas por aseguradora, diagnósticos CIE-10, vademécum,
-- plantillas clínicas por especialidad y paquetes. Registros: expediente clínico, agenda de citas, recepción y signos
-- vitales, consulta (SOAP) con diagnósticos, recetas, órdenes y resultados, constancias y referencias, cobros.
-- Procesos: lista de espera, venta y uso de paquetes, cierre de caja, liquidación de honorarios, reclamos a
-- aseguradoras e insumos con salida de inventario. La partida contable diaria usa con_generar_partida (script 158).

create or replace function public.cli_quien() returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA')
$$;

-- ============ Catálogos ============
create table if not exists public.cli_consultorios (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo integer not null, nombre text not null, sede text, especialidad_id bigint references public.hos_especialidades (id), equipo text, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.cli_horarios (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  medico_id bigint not null references public.hos_medicos (id) on delete cascade, consultorio_id bigint references public.cli_consultorios (id), dia_semana integer not null check (dia_semana between 1 and 7),
  hora_inicio time not null, hora_fin time not null, duracion_min integer not null default 20 check (duracion_min between 5 and 240), activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, check (hora_fin > hora_inicio)
);
create table if not exists public.cli_servicios (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo text not null, nombre text not null, tipo text not null check (tipo in ('CONSULTA', 'RECONSULTA', 'PROCEDIMIENTO', 'LABORATORIO', 'IMAGEN', 'CERTIFICADO', 'INSUMO', 'PAQUETE', 'OTRO')),
  especialidad_id bigint references public.hos_especialidades (id), precio numeric(12, 2) not null default 0, honorario boolean not null default true, producto_id bigint, cantidad_insumo numeric(12, 3) not null default 0,
  activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.cli_tarifas (
  id bigint generated always as identity primary key, aseguradora_id bigint not null references public.hos_aseguradoras (id) on delete cascade, servicio_id bigint not null references public.cli_servicios (id) on delete cascade,
  precio numeric(12, 2) not null, copago numeric(12, 2) not null default 0, unique (aseguradora_id, servicio_id)
);
create table if not exists public.cli_diagnosticos (
  id bigint generated always as identity primary key, codigo text not null unique, descripcion text not null, capitulo text, activo boolean not null default true
);
create table if not exists public.cli_medicamentos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  nombre text not null, presentacion text, concentracion text, via text not null default 'ORAL', dosis_habitual text, producto_id bigint, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.cli_plantillas (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  especialidad_id bigint references public.hos_especialidades (id), nombre text not null, historia text, examen_fisico text, plan text, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.cli_paquetes (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo integer not null, nombre text not null, servicio_id bigint references public.cli_servicios (id), sesiones integer not null check (sesiones > 0), precio numeric(12, 2) not null check (precio >= 0),
  vigencia_dias integer not null default 365, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);

-- ============ Registros ============
create table if not exists public.cli_expedientes (
  id bigint generated always as identity primary key, paciente_id bigint not null unique references public.hos_pacientes (id) on delete cascade,
  antecedentes_personales text, antecedentes_familiares text, quirurgicos text, gineco_obstetricos text, alergias text, medicamentos_cronicos text, vacunas text, habitos text, observaciones text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.cli_paquetes_vendidos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, paciente_id bigint not null references public.hos_pacientes (id), paquete_id bigint not null references public.cli_paquetes (id), fecha date not null default current_date, vence date,
  sesiones integer not null, usadas integer not null default 0, monto numeric(12, 2) not null, reconocido numeric(12, 2) not null default 0,
  estado text not null default 'ACTIVO' check (estado in ('ACTIVO', 'AGOTADO', 'VENCIDO', 'ANULADO')), cobro_id bigint, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.cli_citas (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  paciente_id bigint not null references public.hos_pacientes (id), medico_id bigint not null references public.hos_medicos (id), consultorio_id bigint references public.cli_consultorios (id),
  servicio_id bigint references public.cli_servicios (id), aseguradora_id bigint references public.hos_aseguradoras (id), paquete_vendido_id bigint references public.cli_paquetes_vendidos (id),
  fecha date not null, hora time not null, duracion_min integer not null default 20, motivo text, primera_vez boolean not null default false,
  estado text not null default 'PROGRAMADA' check (estado in ('PROGRAMADA', 'CONFIRMADA', 'EN ESPERA', 'EN CONSULTA', 'ATENDIDA', 'CANCELADA', 'NO ASISTIÓ')),
  confirmada_en timestamptz, llegada timestamptz, inicio_consulta timestamptz, fin_consulta timestamptz, motivo_cancelacion text, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create index if not exists cli_citas_fecha_idx on public.cli_citas (localidad_id, fecha, medico_id);
create table if not exists public.cli_lista_espera (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  paciente_id bigint not null references public.hos_pacientes (id), especialidad_id bigint references public.hos_especialidades (id), medico_id bigint references public.hos_medicos (id),
  preferencia text, prioridad text not null default 'NORMAL' check (prioridad in ('NORMAL', 'PREFERENTE', 'URGENTE')), estado text not null default 'EN ESPERA' check (estado in ('EN ESPERA', 'AGENDADO', 'DESCARTADO')),
  cita_id bigint references public.cli_citas (id), usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.cli_consultas (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, cita_id bigint references public.cli_citas (id), paciente_id bigint not null references public.hos_pacientes (id), medico_id bigint not null references public.hos_medicos (id),
  fecha timestamptz not null default now(), peso_kg numeric(6, 2), talla_cm numeric(6, 1), presion text, frecuencia_cardiaca integer, frecuencia_respiratoria integer, temperatura numeric(4, 1), saturacion integer, glucosa numeric(6, 1),
  motivo text, historia text, examen_fisico text, plan text, indicaciones text, proxima_cita date,
  estado text not null default 'ABIERTA' check (estado in ('ABIERTA', 'CERRADA', 'ANULADA')), usuario text, motivo_anulacion text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.cli_consulta_diagnosticos (
  id bigint generated always as identity primary key, consulta_id bigint not null references public.cli_consultas (id) on delete cascade,
  codigo text not null, descripcion text not null, tipo text not null default 'PRINCIPAL' check (tipo in ('PRINCIPAL', 'SECUNDARIO')), condicion text not null default 'NUEVO' check (condicion in ('NUEVO', 'SUBSECUENTE'))
);
create table if not exists public.cli_recetas (
  id bigint generated always as identity primary key, consulta_id bigint not null references public.cli_consultas (id) on delete cascade,
  medicamento text not null, presentacion text, dosis text, frecuencia text, duracion text, via text, cantidad text, indicaciones text
);
create table if not exists public.cli_ordenes (
  id bigint generated always as identity primary key, consulta_id bigint not null references public.cli_consultas (id) on delete cascade, servicio_id bigint references public.cli_servicios (id),
  tipo text not null check (tipo in ('LABORATORIO', 'IMAGEN', 'PROCEDIMIENTO', 'INTERCONSULTA')), descripcion text not null, indicaciones text,
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'REALIZADA', 'CON RESULTADO', 'CANCELADA')), resultado text, fecha_resultado date, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.cli_documentos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, consulta_id bigint references public.cli_consultas (id) on delete set null, paciente_id bigint not null references public.hos_pacientes (id), medico_id bigint references public.hos_medicos (id),
  tipo text not null check (tipo in ('CERTIFICADO MÉDICO', 'INCAPACIDAD', 'REFERENCIA', 'CONSTANCIA DE ASISTENCIA')), fecha date not null default current_date,
  dias integer, desde date, hasta date, destino text, texto text not null, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.cli_cierres_caja (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  fecha date not null, cajero text not null, efectivo numeric(14, 2) not null default 0, tarjeta numeric(14, 2) not null default 0, transferencia numeric(14, 2) not null default 0, cheque numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0, cobros integer not null default 0, efectivo_contado numeric(14, 2), diferencia numeric(14, 2), observaciones text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, fecha, cajero)
);
create table if not exists public.cli_honorarios (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, medico_id bigint not null references public.hos_medicos (id), desde date not null, hasta date not null, consultas integer not null default 0,
  bruto numeric(14, 2) not null default 0, participacion_clinica numeric(14, 2) not null default 0, retencion_isr numeric(14, 2) not null default 0, liquido numeric(14, 2) not null default 0,
  estado text not null default 'CALCULADA' check (estado in ('CALCULADA', 'PAGADA', 'ANULADA')), referencia_pago text, fecha_pago date, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.cli_reclamos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, aseguradora_id bigint not null references public.hos_aseguradoras (id), desde date not null, hasta date not null, fecha date not null default current_date,
  cobros integer not null default 0, monto numeric(14, 2) not null default 0, monto_aprobado numeric(14, 2), glosa numeric(14, 2) not null default 0, monto_pagado numeric(14, 2) not null default 0, fecha_pago date,
  estado text not null default 'PRESENTADO' check (estado in ('PRESENTADO', 'EN REVISIÓN', 'APROBADO', 'PAGADO', 'PARCIAL', 'RECHAZADO')), observaciones text, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.cli_cobros (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, fecha date not null default current_date, paciente_id bigint not null references public.hos_pacientes (id), cita_id bigint references public.cli_citas (id), consulta_id bigint references public.cli_consultas (id),
  aseguradora_id bigint references public.hos_aseguradoras (id), tipo text not null default 'SERVICIOS' check (tipo in ('SERVICIOS', 'PAQUETE')),
  total numeric(14, 2) not null default 0, parte_paciente numeric(14, 2) not null default 0, parte_aseguradora numeric(14, 2) not null default 0,
  forma text not null default 'EFECTIVO' check (forma in ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE', 'SIN COBRO')), referencia text, factura text, nit text, nombre_factura text,
  estado text not null default 'PAGADO' check (estado in ('PAGADO', 'ANULADO')), cajero text, cierre_id bigint references public.cli_cierres_caja (id), reclamo_id bigint references public.cli_reclamos (id), partida_id bigint,
  motivo_anulacion text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.cli_cobro_lineas (
  id bigint generated always as identity primary key, cobro_id bigint not null references public.cli_cobros (id) on delete cascade, servicio_id bigint references public.cli_servicios (id),
  tipo text not null default 'OTRO', descripcion text not null, medico_id bigint references public.hos_medicos (id), cantidad numeric(12, 3) not null default 1 check (cantidad > 0), precio numeric(12, 2) not null default 0,
  total numeric(14, 2) not null default 0, parte_paciente numeric(14, 2) not null default 0, parte_aseguradora numeric(14, 2) not null default 0,
  paquete_vendido_id bigint references public.cli_paquetes_vendidos (id), reconocido numeric(14, 2) not null default 0, producto_id bigint, movimiento_id bigint, honorario_liq_id bigint references public.cli_honorarios (id)
);

-- ============ Reglas ============
create or replace function public.cli_numerar() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(4813, new.localidad_id::integer);
  execute format('select coalesce(max(numero), 0) + 1 from public.%I where localidad_id = $1', tg_table_name) into new.numero using new.localidad_id;
  if tg_table_name <> 'cli_cobros' then new.usuario := public.cli_quien(); end if;
  return new;
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['cli_consultas', 'cli_documentos', 'cli_honorarios', 'cli_reclamos', 'cli_cobros', 'cli_paquetes_vendidos'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_numerar', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.cli_numerar()', t || '_numerar', t);
  end loop;
end;
$$;
-- Cita: el médico no tiene dos citas que se traslapen; usuario.
create or replace function public.cli_preparar_cita() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado not in ('CANCELADA', 'NO ASISTIÓ') and exists (
      select 1 from public.cli_citas c where c.medico_id = new.medico_id and c.fecha = new.fecha and c.id <> coalesce(new.id, 0) and c.estado not in ('CANCELADA', 'NO ASISTIÓ')
        and c.hora < new.hora + make_interval(mins => new.duracion_min) and new.hora < c.hora + make_interval(mins => c.duracion_min)) then
    raise exception 'El médico ya tiene una cita a esa hora (%).', to_char(new.hora, 'HH24:MI');
  end if;
  if tg_op = 'INSERT' then
    new.usuario := public.cli_quien();
    new.primera_vez := not exists (select 1 from public.cli_consultas x where x.paciente_id = new.paciente_id and x.estado <> 'ANULADA');
  end if;
  if new.estado = 'CONFIRMADA' and new.confirmada_en is null then new.confirmada_en := now(); end if;
  if new.estado = 'EN ESPERA' and new.llegada is null then new.llegada := now(); end if;
  if new.estado = 'EN CONSULTA' and new.inicio_consulta is null then new.inicio_consulta := now(); end if;
  if new.estado = 'ATENDIDA' and new.fin_consulta is null then new.fin_consulta := now(); end if;
  return new;
end;
$$;
drop trigger if exists cli_citas_preparar on public.cli_citas;
create trigger cli_citas_preparar before insert or update on public.cli_citas for each row execute function public.cli_preparar_cita();
-- Consulta cerrada o anulada: ya no se modifica.
create or replace function public.cli_proteger_consulta() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_estado text;
begin
  if tg_table_name = 'cli_consultas' then
    if tg_op = 'UPDATE' and old.estado <> 'ABIERTA' and current_setting('fin.clinica', true) is distinct from 'si' then raise exception 'La consulta % está %: ya no se modifica.', old.numero, lower(old.estado); end if;
    return new;
  end if;
  select estado into v_estado from public.cli_consultas where id = coalesce(new.consulta_id, old.consulta_id);
  if v_estado <> 'ABIERTA' and current_setting('fin.clinica', true) is distinct from 'si' then raise exception 'La consulta ya está %: no se modifica.', lower(v_estado); end if;
  return coalesce(new, old);
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['cli_consultas', 'cli_consulta_diagnosticos', 'cli_recetas'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_proteger', t);
    execute format('create trigger %I before update or delete %s on public.%I for each row execute function public.cli_proteger_consulta()', t || '_proteger', case when t = 'cli_consultas' then '' else 'or insert' end, t);
  end loop;
end;
$$;
-- Cobros: solo los procesos los cambian (se crean con cli_cobrar y se anulan con cli_anular_cobro).
create or replace function public.cli_proteger_cobro() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('fin.clinica', true) is distinct from 'si' then raise exception 'Los cobros se registran y anulan desde Cobro de consulta.'; end if;
  return coalesce(new, old);
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['cli_cobros', 'cli_cobro_lineas'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_proteger', t);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.cli_proteger_cobro()', t || '_proteger', t);
  end loop;
end;
$$;

-- Cobro: líneas [{servicio_id, descripcion, tipo, medico_id, cantidad, precio, producto_id, bodega_id, paquete_vendido_id}].
-- Con aseguradora: precio de su tarifa y el paciente paga el copago de la tarifa o el coaseguro de la aseguradora.
-- Con paquete: la sesión no se cobra; reconoce como ingreso la parte proporcional del paquete.
-- Insumos: salida de inventario al costo.
create or replace function public.cli_cobrar(p_loc bigint, p_paciente bigint, p_cita bigint, p_consulta bigint, p_aseguradora bigint, p_lineas jsonb,
  p_forma text, p_referencia text default null, p_factura text default null, p_nit text default null, p_nombre text default null)
 returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_org bigint := (select organizacion_id from public.localidades where id = p_loc);
  ag public.hos_aseguradoras; e jsonb; sv public.cli_servicios; t public.cli_tarifas; pv public.cli_paquetes_vendidos;
  v_id bigint; v_cant numeric; v_precio numeric; v_total numeric; v_pac numeric; v_ase numeric; v_rec numeric; v_mov bigint; v_pid bigint; v_costo numeric;
  v_tpac numeric := 0; v_tase numeric := 0; v_tt numeric := 0; v_n integer := 0;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para cobrar.'; end if;
  if v_org is null then raise exception 'La localidad no existe.'; end if;
  if p_aseguradora is not null then select * into ag from public.hos_aseguradoras where id = p_aseguradora; end if;
  perform set_config('fin.clinica', 'si', true);
  insert into public.cli_cobros (organizacion_id, localidad_id, numero, paciente_id, cita_id, consulta_id, aseguradora_id, forma, referencia, factura, nit, nombre_factura, cajero)
  values (v_org, p_loc, 0, p_paciente, p_cita, p_consulta, p_aseguradora, coalesce(p_forma, 'EFECTIVO'), nullif(trim(p_referencia), ''), nullif(trim(p_factura), ''), nullif(trim(p_nit), ''), nullif(trim(p_nombre), ''), public.cli_quien())
  returning id into v_id;
  for e in select * from jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) loop
    v_cant := coalesce((e->>'cantidad')::numeric, 1); sv := null; t := null; pv := null; v_rec := 0; v_mov := null;
    if e->>'servicio_id' is not null then select * into sv from public.cli_servicios where id = (e->>'servicio_id')::bigint; end if;
    v_precio := coalesce(nullif(e->>'precio', '')::numeric, sv.precio, 0);
    if p_aseguradora is not null and sv.id is not null then select * into t from public.cli_tarifas where aseguradora_id = p_aseguradora and servicio_id = sv.id; if t.id is not null then v_precio := t.precio; end if; end if;
    v_total := round(v_cant * v_precio, 2);
    if e->>'paquete_vendido_id' is not null then
      select * into pv from public.cli_paquetes_vendidos where id = (e->>'paquete_vendido_id')::bigint for update;
      if pv.estado <> 'ACTIVO' or pv.usadas >= pv.sesiones then raise exception 'El paquete % no tiene sesiones disponibles.', pv.numero; end if;
      if pv.vence is not null and pv.vence < current_date then raise exception 'El paquete % venció el %.', pv.numero, to_char(pv.vence, 'DD/MM/YYYY'); end if;
      v_rec := case when pv.usadas + 1 = pv.sesiones then pv.monto - pv.reconocido else round(pv.monto / pv.sesiones, 2) end;
      update public.cli_paquetes_vendidos set usadas = usadas + 1, reconocido = reconocido + v_rec, estado = case when usadas + 1 >= sesiones then 'AGOTADO' else estado end where id = pv.id;
      v_total := 0; v_pac := 0; v_ase := 0;
    elsif p_aseguradora is not null then
      v_pac := least(v_total, case when t.id is not null then t.copago * v_cant else round(v_total * coalesce(ag.coaseguro_pct, 0) / 100, 2) end);
      v_ase := v_total - v_pac;
    else v_pac := v_total; v_ase := 0; end if;
    v_pid := coalesce(nullif(e->>'producto_id', '')::bigint, case when sv.tipo = 'INSUMO' or coalesce(sv.cantidad_insumo, 0) > 0 then sv.producto_id end);
    if v_pid is not null and nullif(e->>'bodega_id', '') is not null then
      select precio_costo into v_costo from public.productos where id = v_pid;
      insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, lote, usuario, documento_fisico, observaciones)
      values (v_org, p_loc, v_pid, (e->>'bodega_id')::bigint, (now() at time zone 'America/Guatemala')::date, -(case when sv.tipo = 'INSUMO' or sv.id is null then v_cant else v_cant * sv.cantidad_insumo end), coalesce(v_costo, 0), 'DESPACHO', coalesce(e->>'lote', ''), public.cli_quien(), 'COBRO CLÍNICA ' || v_id, 'Insumo de consulta')
      returning id into v_mov;
    end if;
    insert into public.cli_cobro_lineas (cobro_id, servicio_id, tipo, descripcion, medico_id, cantidad, precio, total, parte_paciente, parte_aseguradora, paquete_vendido_id, reconocido, producto_id, movimiento_id)
    values (v_id, sv.id, coalesce(sv.tipo, e->>'tipo', 'OTRO'), coalesce(nullif(e->>'descripcion', ''), sv.nombre, 'SERVICIO'), nullif(e->>'medico_id', '')::bigint, v_cant, v_precio, v_total, v_pac, v_ase, pv.id, v_rec, v_pid, v_mov);
    v_tt := v_tt + v_total; v_tpac := v_tpac + v_pac; v_tase := v_tase + v_ase; v_n := v_n + 1;
  end loop;
  if v_n = 0 then raise exception 'Agrega al menos un servicio.'; end if;
  update public.cli_cobros set total = v_tt, parte_paciente = v_tpac, parte_aseguradora = v_tase, forma = case when v_tpac = 0 then 'SIN COBRO' else forma end where id = v_id;
  perform set_config('fin.clinica', '', true);
  return jsonb_build_object('id', v_id, 'numero', (select numero from public.cli_cobros where id = v_id), 'total', v_tt, 'paciente', v_tpac, 'aseguradora', v_tase);
end;
$$;

-- Venta de un paquete: se cobra completo y queda como ingreso diferido que se reconoce con cada sesión.
create or replace function public.cli_vender_paquete(p_loc bigint, p_paciente bigint, p_paquete bigint, p_forma text, p_referencia text default null, p_factura text default null)
 returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_org bigint := (select organizacion_id from public.localidades where id = p_loc); pq public.cli_paquetes; v_pv bigint; v_cobro bigint;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para vender paquetes.'; end if;
  select * into pq from public.cli_paquetes where id = p_paquete and localidad_id = p_loc;
  if pq.id is null or not pq.activo then raise exception 'El paquete no existe o no está activo.'; end if;
  perform set_config('fin.clinica', 'si', true);
  insert into public.cli_paquetes_vendidos (organizacion_id, localidad_id, numero, paciente_id, paquete_id, vence, sesiones, monto)
  values (v_org, p_loc, 0, p_paciente, pq.id, current_date + pq.vigencia_dias, pq.sesiones, pq.precio) returning id into v_pv;
  insert into public.cli_cobros (organizacion_id, localidad_id, numero, paciente_id, tipo, total, parte_paciente, forma, referencia, factura, cajero)
  values (v_org, p_loc, 0, p_paciente, 'PAQUETE', pq.precio, pq.precio, coalesce(p_forma, 'EFECTIVO'), nullif(trim(p_referencia), ''), nullif(trim(p_factura), ''), public.cli_quien()) returning id into v_cobro;
  insert into public.cli_cobro_lineas (cobro_id, servicio_id, tipo, descripcion, cantidad, precio, total, parte_paciente, paquete_vendido_id)
  values (v_cobro, pq.servicio_id, 'PAQUETE', 'PAQUETE ' || pq.nombre || ' (' || pq.sesiones || ' sesiones)', 1, pq.precio, pq.precio, pq.precio, v_pv);
  update public.cli_paquetes_vendidos set cobro_id = v_cobro where id = v_pv;
  perform set_config('fin.clinica', '', true);
  return jsonb_build_object('paquete', v_pv, 'cobro', v_cobro);
end;
$$;

-- Anulación de un cobro (antes del cierre de caja, del reclamo y de la liquidación de honorarios).
create or replace function public.cli_anular_cobro(p_id bigint, p_motivo text) returns void language plpgsql security definer set search_path = '' as $$
declare c public.cli_cobros; l record;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para anular cobros.'; end if;
  if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la anulación.'; end if;
  select * into c from public.cli_cobros where id = p_id for update;
  if c.estado = 'ANULADO' then raise exception 'El cobro ya está anulado.'; end if;
  if c.cierre_id is not null then raise exception 'El cobro ya está en un cierre de caja.'; end if;
  if c.reclamo_id is not null then raise exception 'El cobro ya está en un reclamo a la aseguradora.'; end if;
  if c.partida_id is not null then raise exception 'El cobro ya se contabilizó: anula primero la partida.'; end if;
  if exists (select 1 from public.cli_cobro_lineas where cobro_id = p_id and honorario_liq_id is not null) then raise exception 'Los honorarios del cobro ya se liquidaron.'; end if;
  if c.tipo = 'PAQUETE' and exists (select 1 from public.cli_paquetes_vendidos where cobro_id = p_id and usadas > 0) then raise exception 'El paquete ya tiene sesiones usadas.'; end if;
  perform set_config('fin.clinica', 'si', true);
  for l in select * from public.cli_cobro_lineas where cobro_id = p_id loop
    if l.paquete_vendido_id is not null and c.tipo = 'SERVICIOS' then
      update public.cli_paquetes_vendidos set usadas = usadas - 1, reconocido = reconocido - l.reconocido, estado = 'ACTIVO' where id = l.paquete_vendido_id;
    end if;
    if l.movimiento_id is not null then
      insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, lote, usuario, documento_fisico, observaciones)
      select m.organizacion_id, m.localidad_id, m.producto_id, m.bodega_id, (now() at time zone 'America/Guatemala')::date, -m.cantidad, m.costo_unitario, 'DEVOLUCIÓN', m.lote, public.cli_quien(), m.documento_fisico, 'Anulación de cobro de clínica'
      from public.inventario_movimientos m where m.id = l.movimiento_id;
    end if;
  end loop;
  if c.tipo = 'PAQUETE' then update public.cli_paquetes_vendidos set estado = 'ANULADO' where cobro_id = p_id; end if;
  update public.cli_cobros set estado = 'ANULADO', motivo_anulacion = trim(p_motivo) where id = p_id;
  perform set_config('fin.clinica', '', true);
end;
$$;

-- Cierre de consulta: la cita queda atendida.
create or replace function public.cli_cerrar_consulta(p_id bigint) returns void language plpgsql security definer set search_path = '' as $$
declare c public.cli_consultas;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para cerrar consultas.'; end if;
  select * into c from public.cli_consultas where id = p_id;
  if c.estado <> 'ABIERTA' then raise exception 'La consulta ya está %.', lower(c.estado); end if;
  if not exists (select 1 from public.cli_consulta_diagnosticos where consulta_id = p_id) then raise exception 'Registra al menos un diagnóstico (CIE-10) antes de cerrar la consulta.'; end if;
  perform set_config('fin.clinica', 'si', true);
  update public.cli_consultas set estado = 'CERRADA' where id = p_id;
  if c.cita_id is not null then update public.cli_citas set estado = 'ATENDIDA' where id = c.cita_id and estado not in ('CANCELADA', 'NO ASISTIÓ'); end if;
  perform set_config('fin.clinica', '', true);
end;
$$;

-- Cierre de caja del cajero en el día.
create or replace function public.cli_cerrar_caja(p_loc bigint, p_fecha date, p_contado numeric, p_observaciones text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_org bigint := (select organizacion_id from public.localidades where id = p_loc); v_caj text := public.cli_quien(); v_id bigint; r record;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para cerrar caja.'; end if;
  select count(*) n, coalesce(sum(parte_paciente) filter (where forma = 'EFECTIVO'), 0) ef, coalesce(sum(parte_paciente) filter (where forma = 'TARJETA'), 0) tj,
         coalesce(sum(parte_paciente) filter (where forma = 'TRANSFERENCIA'), 0) tr, coalesce(sum(parte_paciente) filter (where forma = 'CHEQUE'), 0) ch, coalesce(sum(parte_paciente), 0) tt
    into r from public.cli_cobros where localidad_id = p_loc and fecha = p_fecha and cajero = v_caj and estado = 'PAGADO' and cierre_id is null;
  if r.n = 0 then raise exception 'No tienes cobros pendientes de cierre el %.', to_char(p_fecha, 'DD/MM/YYYY'); end if;
  insert into public.cli_cierres_caja (organizacion_id, localidad_id, fecha, cajero, efectivo, tarjeta, transferencia, cheque, total, cobros, efectivo_contado, diferencia, observaciones)
  values (v_org, p_loc, p_fecha, v_caj, r.ef, r.tj, r.tr, r.ch, r.tt, r.n, p_contado, round(coalesce(p_contado, r.ef) - r.ef, 2), nullif(trim(p_observaciones), ''))
  on conflict (localidad_id, fecha, cajero) do update set efectivo = public.cli_cierres_caja.efectivo + excluded.efectivo, tarjeta = public.cli_cierres_caja.tarjeta + excluded.tarjeta,
    transferencia = public.cli_cierres_caja.transferencia + excluded.transferencia, cheque = public.cli_cierres_caja.cheque + excluded.cheque, total = public.cli_cierres_caja.total + excluded.total,
    cobros = public.cli_cierres_caja.cobros + excluded.cobros, efectivo_contado = excluded.efectivo_contado, diferencia = round(coalesce(excluded.efectivo_contado, public.cli_cierres_caja.efectivo + excluded.efectivo) - (public.cli_cierres_caja.efectivo + excluded.efectivo), 2)
  returning id into v_id;
  perform set_config('fin.clinica', 'si', true);
  update public.cli_cobros set cierre_id = v_id where localidad_id = p_loc and fecha = p_fecha and cajero = v_caj and estado = 'PAGADO' and cierre_id is null;
  perform set_config('fin.clinica', '', true);
  return jsonb_build_object('id', v_id, 'cobros', r.n, 'total', r.tt, 'efectivo', r.ef);
end;
$$;

-- Honorarios: servicios con honorario cobrados del médico en el rango, menos la participación de la clínica y la retención de ISR.
create or replace function public.cli_liquidar_honorarios(p_loc bigint, p_medico bigint, p_desde date, p_hasta date) returns bigint language plpgsql security definer set search_path = '' as $$
declare m public.hos_medicos; v_org bigint := (select organizacion_id from public.localidades where id = p_loc); v_bruto numeric; v_n integer; v_id bigint; v_part numeric; v_ret numeric;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para liquidar honorarios.'; end if;
  select * into m from public.hos_medicos where id = p_medico;
  select coalesce(sum(l.total + l.reconocido), 0), count(distinct c.id) into v_bruto, v_n
    from public.cli_cobro_lineas l join public.cli_cobros c on c.id = l.cobro_id left join public.cli_servicios s on s.id = l.servicio_id
   where c.localidad_id = p_loc and c.estado = 'PAGADO' and c.tipo = 'SERVICIOS' and l.medico_id = p_medico and l.honorario_liq_id is null and coalesce(s.honorario, true) and c.fecha between p_desde and p_hasta;
  if v_bruto <= 0 then raise exception 'El médico no tiene honorarios pendientes en el período.'; end if;
  v_part := round(v_bruto * m.pct_hospital / 100, 2); v_ret := round((v_bruto - v_part) * m.retencion_isr_pct / 100, 2);
  insert into public.cli_honorarios (organizacion_id, localidad_id, numero, medico_id, desde, hasta, consultas, bruto, participacion_clinica, retencion_isr, liquido)
  values (v_org, p_loc, 0, p_medico, p_desde, p_hasta, v_n, round(v_bruto, 2), v_part, v_ret, round(v_bruto - v_part - v_ret, 2)) returning id into v_id;
  perform set_config('fin.clinica', 'si', true);
  update public.cli_cobro_lineas l set honorario_liq_id = v_id from public.cli_cobros c
   where c.id = l.cobro_id and c.localidad_id = p_loc and c.estado = 'PAGADO' and c.tipo = 'SERVICIOS' and l.medico_id = p_medico and l.honorario_liq_id is null and c.fecha between p_desde and p_hasta
     and coalesce((select s.honorario from public.cli_servicios s where s.id = l.servicio_id), true);
  perform set_config('fin.clinica', '', true);
  return v_id;
end;
$$;

-- Reclamo: agrupa los cobros con parte de la aseguradora del período que aún no se han reclamado.
create or replace function public.cli_generar_reclamo(p_loc bigint, p_aseguradora bigint, p_desde date, p_hasta date) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_org bigint := (select organizacion_id from public.localidades where id = p_loc); v_n integer; v_m numeric; v_id bigint;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para generar reclamos.'; end if;
  select count(*), coalesce(sum(parte_aseguradora), 0) into v_n, v_m from public.cli_cobros
   where localidad_id = p_loc and aseguradora_id = p_aseguradora and estado = 'PAGADO' and parte_aseguradora > 0 and reclamo_id is null and fecha between p_desde and p_hasta;
  if v_n = 0 then raise exception 'No hay cobros por reclamar a la aseguradora en el período.'; end if;
  insert into public.cli_reclamos (organizacion_id, localidad_id, numero, aseguradora_id, desde, hasta, cobros, monto) values (v_org, p_loc, 0, p_aseguradora, p_desde, p_hasta, v_n, v_m) returning id into v_id;
  perform set_config('fin.clinica', 'si', true);
  update public.cli_cobros set reclamo_id = v_id where localidad_id = p_loc and aseguradora_id = p_aseguradora and estado = 'PAGADO' and parte_aseguradora > 0 and reclamo_id is null and fecha between p_desde and p_hasta;
  perform set_config('fin.clinica', '', true);
  return v_id;
end;
$$;

-- Catálogos por omisión de la clínica (y los de Hospital que comparte).
create or replace function public.cli_asegurar_catalogos(p_localidad bigint) returns void language plpgsql security definer set search_path = '' as $$
declare v_org bigint := (select organizacion_id from public.localidades where id = p_localidad);
begin
  perform public.hos_asegurar_catalogos(p_localidad);
  insert into public.cli_consultorios (organizacion_id, localidad_id, codigo, nombre, sede) select v_org, p_localidad, x.c, x.n, 'SEDE CENTRAL' from (values (1, 'CONSULTORIO 1'), (2, 'CONSULTORIO 2'), (3, 'CONSULTORIO 3'), (4, 'SALA DE PROCEDIMIENTOS')) x(c, n)
    on conflict (localidad_id, codigo) do nothing;
  insert into public.cli_servicios (organizacion_id, localidad_id, codigo, nombre, tipo, precio, honorario) select v_org, p_localidad, x.c, x.n, x.t, x.p, x.h from (values
    ('CEX-01', 'CONSULTA MEDICINA GENERAL', 'CONSULTA', 250, true), ('CEX-02', 'CONSULTA DE ESPECIALIDAD', 'CONSULTA', 450, true), ('CEX-03', 'RECONSULTA (MENOS DE 15 DÍAS)', 'RECONSULTA', 150, true),
    ('PRO-01', 'CURACIÓN', 'PROCEDIMIENTO', 150, true), ('PRO-02', 'SUTURA MENOR', 'PROCEDIMIENTO', 350, true), ('PRO-03', 'NEBULIZACIÓN', 'PROCEDIMIENTO', 100, false), ('PRO-04', 'INYECCIÓN INTRAMUSCULAR', 'PROCEDIMIENTO', 40, false),
    ('PRO-05', 'ELECTROCARDIOGRAMA', 'PROCEDIMIENTO', 250, true), ('LAB-01', 'HEMATOLOGÍA COMPLETA', 'LABORATORIO', 100, false), ('LAB-02', 'GLUCOSA EN AYUNAS', 'LABORATORIO', 40, false),
    ('LAB-03', 'PERFIL DE LÍPIDOS', 'LABORATORIO', 180, false), ('LAB-04', 'ORINA COMPLETA', 'LABORATORIO', 50, false), ('IMG-01', 'RAYOS X', 'IMAGEN', 300, false), ('IMG-02', 'ULTRASONIDO', 'IMAGEN', 450, true),
    ('CER-01', 'CERTIFICADO MÉDICO', 'CERTIFICADO', 100, true)) x(c, n, t, p, h) on conflict (localidad_id, codigo) do nothing;
end;
$$;

-- Diagnósticos CIE-10 más frecuentes en consulta externa.
insert into public.cli_diagnosticos (codigo, descripcion, capitulo) values
  ('A09', 'Diarrea y gastroenteritis de presunto origen infeccioso', 'I'), ('A15', 'Tuberculosis respiratoria', 'I'), ('B34.9', 'Infección viral, no especificada', 'I'), ('B82.9', 'Parasitosis intestinal, sin otra especificación', 'I'),
  ('D50.9', 'Anemia por deficiencia de hierro', 'III'), ('E03.9', 'Hipotiroidismo, no especificado', 'IV'), ('E11.9', 'Diabetes mellitus tipo 2 sin complicaciones', 'IV'), ('E66.9', 'Obesidad, no especificada', 'IV'), ('E78.5', 'Hiperlipidemia, no especificada', 'IV'),
  ('F32.9', 'Episodio depresivo, no especificado', 'V'), ('F41.1', 'Trastorno de ansiedad generalizada', 'V'), ('G43.9', 'Migraña, no especificada', 'VI'), ('G44.2', 'Cefalea tensional', 'VI'),
  ('H10.9', 'Conjuntivitis, no especificada', 'VII'), ('H66.9', 'Otitis media, no especificada', 'VIII'), ('I10', 'Hipertensión esencial (primaria)', 'IX'), ('I83.9', 'Várices de los miembros inferiores', 'IX'),
  ('J00', 'Rinofaringitis aguda (resfriado común)', 'X'), ('J01.9', 'Sinusitis aguda, no especificada', 'X'), ('J02.9', 'Faringitis aguda, no especificada', 'X'), ('J03.9', 'Amigdalitis aguda, no especificada', 'X'),
  ('J06.9', 'Infección aguda de las vías respiratorias superiores', 'X'), ('J18.9', 'Neumonía, no especificada', 'X'), ('J20.9', 'Bronquitis aguda, no especificada', 'X'), ('J30.4', 'Rinitis alérgica, no especificada', 'X'), ('J45.9', 'Asma, no especificada', 'X'),
  ('K02.9', 'Caries dental, no especificada', 'XI'), ('K21.9', 'Enfermedad por reflujo gastroesofágico', 'XI'), ('K29.7', 'Gastritis, no especificada', 'XI'), ('K30', 'Dispepsia', 'XI'), ('K59.0', 'Constipación', 'XI'),
  ('L02.9', 'Absceso cutáneo, furúnculo y carbunco', 'XII'), ('L20.9', 'Dermatitis atópica', 'XII'), ('L30.9', 'Dermatitis, no especificada', 'XII'), ('L70.0', 'Acné vulgar', 'XII'),
  ('M54.5', 'Lumbago no especificado', 'XIII'), ('M25.5', 'Dolor en articulación', 'XIII'), ('M79.1', 'Mialgia', 'XIII'), ('M17.9', 'Gonartrosis, no especificada', 'XIII'),
  ('N39.0', 'Infección de vías urinarias, sitio no especificado', 'XIV'), ('N76.0', 'Vaginitis aguda', 'XIV'), ('N94.6', 'Dismenorrea, no especificada', 'XIV'),
  ('O26.9', 'Complicación relacionada con el embarazo', 'XV'), ('R05', 'Tos', 'XVIII'), ('R10.4', 'Dolor abdominal, otro y el no especificado', 'XVIII'), ('R50.9', 'Fiebre, no especificada', 'XVIII'), ('R51', 'Cefalea', 'XVIII'),
  ('S93.4', 'Esguince y torcedura del tobillo', 'XIX'), ('T14.1', 'Herida de región no especificada del cuerpo', 'XIX'),
  ('Z00.0', 'Examen médico general', 'XXI'), ('Z00.1', 'Control de salud de rutina del niño', 'XXI'), ('Z01.4', 'Examen ginecológico (general) (de rutina)', 'XXI'), ('Z34.9', 'Supervisión de embarazo normal', 'XXI'), ('Z76.0', 'Consulta para repetición de receta', 'XXI')
on conflict (codigo) do nothing;

-- El proceso contable de la clínica (partida de ingresos del día) usa el control de partidas generadas.
alter table public.partidas_generadas drop constraint if exists partidas_generadas_origen_check;
alter table public.partidas_generadas add constraint partidas_generadas_origen_check check (origen in ('RECURRENTE', 'DIFERIDO', 'DIFERENCIAL', 'REVERSIÓN', 'CLÍNICA'));
create or replace function public.con_generar_partida(p_loc bigint, p_anio integer, p_mes integer, p_tipo text, p_descripcion text, p_lineas jsonb,
  p_origen text default null, p_ref bigint default null, p_monto numeric default null)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; p public.partidas;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede generar partidas automáticas.'; end if;
  if p_origen is not null and p_origen not in ('RECURRENTE', 'DIFERIDO', 'DIFERENCIAL', 'REVERSIÓN', 'CLÍNICA') then raise exception 'Origen no válido.'; end if;
  if p_tipo in ('PCR', 'PCE', 'PA') then raise exception 'Las partidas de cierre y apertura las genera el cierre anual.'; end if;
  v_id := public.con_generar_partida_int(p_loc, p_anio, p_mes, p_tipo, p_descripcion, p_lineas, p_origen, p_ref, p_monto, null, 'PARTIDA DEL MES', null, null);
  select * into p from public.partidas where id = v_id;
  -- Los cobros de la clínica del día quedan enlazados a su partida.
  if p_origen = 'CLÍNICA' then
    perform set_config('fin.clinica', 'si', true);
    update public.cli_cobros set partida_id = v_id where localidad_id = p_loc and estado = 'PAGADO' and partida_id is null and fecha = to_date(p_ref::text, 'YYYYMMDD');
    perform set_config('fin.clinica', '', true);
  end if;
  return jsonb_build_object('id', v_id, 'mes', p.mes, 'numero', p.numero, 'total', p.total_debe);
end;
$function$;

-- ============ Auditoría, permisos, módulo y menú ============
do $$
declare t text;
begin
  foreach t in array array['cli_consultorios', 'cli_horarios', 'cli_servicios', 'cli_medicamentos', 'cli_plantillas', 'cli_paquetes', 'cli_expedientes', 'cli_paquetes_vendidos', 'cli_citas', 'cli_lista_espera',
                           'cli_consultas', 'cli_ordenes', 'cli_documentos', 'cli_cierres_caja', 'cli_honorarios', 'cli_reclamos', 'cli_cobros'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.auditar()', t || '_auditar', t);
  end loop;
  foreach t in array array['cli_consultorios', 'cli_horarios', 'cli_servicios', 'cli_tarifas', 'cli_diagnosticos', 'cli_medicamentos', 'cli_plantillas', 'cli_paquetes', 'cli_expedientes', 'cli_paquetes_vendidos',
                           'cli_citas', 'cli_lista_espera', 'cli_consultas', 'cli_consulta_diagnosticos', 'cli_recetas', 'cli_ordenes', 'cli_documentos', 'cli_cierres_caja', 'cli_honorarios', 'cli_reclamos', 'cli_cobros', 'cli_cobro_lineas'] loop
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
revoke execute on function public.cli_numerar() from public, anon, authenticated;
revoke execute on function public.cli_preparar_cita() from public, anon, authenticated;
revoke execute on function public.cli_proteger_consulta() from public, anon, authenticated;
revoke execute on function public.cli_proteger_cobro() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['public.cli_cobrar(bigint, bigint, bigint, bigint, bigint, jsonb, text, text, text, text, text)', 'public.cli_vender_paquete(bigint, bigint, bigint, text, text, text)',
                           'public.cli_anular_cobro(bigint, text)', 'public.cli_cerrar_consulta(bigint)', 'public.cli_cerrar_caja(bigint, date, numeric, text)', 'public.cli_liquidar_honorarios(bigint, bigint, date, date)',
                           'public.cli_generar_reclamo(bigint, bigint, date, date)', 'public.cli_asegurar_catalogos(bigint)', 'public.cli_quien()',
                           'public.con_generar_partida(bigint, integer, integer, text, text, jsonb, text, bigint, numeric)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
-- Módulo Clínicas médicas y sus permisos por rol (los mismos que Hospital).
do $$
declare v_mod bigint; v_cod integer; v_id bigint; v_orden integer; o record;
begin
  select id into v_mod from public.modulos_sistema where siglas = 'CLI' limit 1;
  if v_mod is null then
    select coalesce(max(codigo), 0) + 1 into v_cod from public.modulos_sistema where modulo_mayor_id is null and codigo < 100;
    insert into public.modulos_sistema (codigo, siglas, descripcion, activo) values (v_cod, 'CLI', 'CLÍNICAS MÉDICAS', true) returning id into v_mod;
  end if;
  insert into public.rol_modulos (rol_id, modulo, puede_ver, puede_editar) select rol_id, 'clinicas', puede_ver, puede_editar from public.rol_modulos where modulo = 'hospital' on conflict (rol_id, modulo) do nothing;
  insert into public.rol_modulos (rol_id, modulo, puede_ver, puede_editar) select rol_id, 'odontologia', puede_ver, puede_editar from public.rol_modulos where modulo = 'hospital' on conflict (rol_id, modulo) do nothing;
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  for o in select * from (values
    (1, 'catalogos', 'Personal y pacientes', 'cli-medicos', 'Médicos, especialidades y horarios'), (2, 'catalogos', 'Clínica', 'cli-consultorios', 'Clínicas y consultorios'),
    (3, 'catalogos', 'Clínica', 'cli-servicios', 'Servicios, tarifas y paquetes'), (4, 'catalogos', 'Clínico', 'cli-diagnosticos', 'Diagnósticos CIE-10'), (5, 'catalogos', 'Clínico', 'cli-vademecum', 'Medicamentos y plantillas'),
    (6, 'registros', 'Atención', 'cli-expediente', 'Pacientes y expediente clínico'), (7, 'registros', 'Atención', 'cli-agenda', 'Agenda de citas'), (8, 'registros', 'Atención', 'cli-recepcion', 'Recepción y signos vitales'),
    (9, 'registros', 'Atención', 'cli-consulta', 'Consulta médica'), (10, 'registros', 'Atención', 'cli-ordenes', 'Órdenes y resultados'), (11, 'registros', 'Atención', 'cli-documentos', 'Constancias y referencias'),
    (12, 'registros', 'Caja', 'cli-cobro', 'Cobro de consulta'),
    (13, 'procesos', 'Clínica', 'cli-confirmacion', 'Confirmación de citas y lista de espera'), (14, 'procesos', 'Clínica', 'cli-paquetes', 'Paquetes y membresías'), (15, 'procesos', 'Clínica', 'cli-caja', 'Cierre de caja diario'),
    (16, 'procesos', 'Clínica', 'cli-honorarios', 'Liquidación de honorarios'), (17, 'procesos', 'Clínica', 'cli-reclamos', 'Reclamos a aseguradoras'), (18, 'procesos', 'Integración contable', 'cli-contabilidad', 'Integración contable'),
    (19, 'reportes', 'Reportes', 'cli-rep-productividad', 'Agenda y productividad por médico'), (20, 'reportes', 'Reportes', 'cli-rep-morbilidad', 'Morbilidad CIE-10'),
    (21, 'reportes', 'Reportes', 'cli-rep-ingresos', 'Ingresos por servicio, médico y forma de pago'), (22, 'reportes', 'Reportes', 'cli-rep-ocupacion', 'Ocupación de consultorios'),
    (23, 'reportes', 'Reportes', 'cli-rep-cartera', 'Cartera de aseguradoras y honorarios'), (24, 'reportes', 'Reportes', 'cli-rep-indicadores', 'Indicadores de la clínica')) as x(n, grupo, subgrupo, clave, nombre) loop
    select id into v_id from public.opciones_sistema where modulo_id = v_mod and clave = o.clave;
    if v_id is null then insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values (v_mod, o.grupo, o.subgrupo, o.clave, o.nombre, v_orden + o.n); end if;
  end loop;
end;
$$;
notify pgrst, 'reload schema';
select 'Clínicas médicas: consultorios, horarios, servicios, CIE-10, vademécum, expediente, agenda, consulta, recetas, órdenes, constancias, cobros, paquetes, caja, honorarios, reclamos e integración contable instalados.' as resultado;
