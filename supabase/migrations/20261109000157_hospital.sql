-- Hospital: pacientes (expediente), médicos y especialidades, áreas y camas, servicios y tarifas, aseguradoras y sus
-- tarifas; citas, admisiones con cama, cuenta del paciente (cargos manuales, día-cama y farmacia con salida de
-- inventario), órdenes médicas, quirófanos, pagos; egreso con distribución entre paciente y aseguradora (deducible y
-- coaseguro), reclamos a aseguradoras, liquidación de honorarios médicos con retención de ISR y cierre de caja.

create or replace function public.hos_quien() returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA')
$$;

-- ============ Catálogos ============
create table if not exists public.hos_aseguradoras (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo integer not null, nombre text not null, nit text, telefono text, contacto text, correo text, dias_credito integer not null default 30,
  deducible numeric(12, 2) not null default 0, coaseguro_pct numeric(6, 2) not null default 0, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.hos_pacientes (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  expediente integer not null, nombres text not null, apellidos text not null, dpi text, nit text, fecha_nacimiento date, genero text check (genero in ('M', 'F')),
  telefono text, correo text, direccion text, tipo_sangre text, alergias text, contacto_emergencia text, telefono_emergencia text,
  aseguradora_id bigint references public.hos_aseguradoras (id), poliza_seguro text, estado text not null default 'ACTIVO' check (estado in ('ACTIVO', 'INACTIVO', 'FALLECIDO')),
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, expediente)
);
create table if not exists public.hos_especialidades (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo integer not null, nombre text not null, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.hos_medicos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo integer not null, nombre text not null, colegiado text, especialidad_id bigint references public.hos_especialidades (id), nit text, telefono text, correo text,
  tipo text not null default 'EXTERNO' check (tipo in ('STAFF', 'EXTERNO', 'RESIDENTE')), pct_hospital numeric(6, 2) not null default 0, retencion_isr_pct numeric(6, 2) not null default 5, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.hos_areas (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo integer not null, nombre text not null, tipo text not null default 'ENCAMAMIENTO' check (tipo in ('EMERGENCIA', 'ENCAMAMIENTO', 'INTENSIVO', 'QUIRÓFANO', 'CONSULTA', 'MATERNIDAD', 'PEDIATRÍA')), activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.hos_camas (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  area_id bigint references public.hos_areas (id), codigo text not null, habitacion text, tipo text not null default 'PRIVADA' check (tipo in ('PRIVADA', 'SEMIPRIVADA', 'GENERAL', 'INTENSIVO', 'OBSERVACIÓN')),
  tarifa_diaria numeric(12, 2) not null default 0, estado text not null default 'DISPONIBLE' check (estado in ('DISPONIBLE', 'OCUPADA', 'LIMPIEZA', 'MANTENIMIENTO')), activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.hos_servicios (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo text not null, nombre text not null, tipo text not null check (tipo in ('HABITACIÓN', 'PROCEDIMIENTO', 'LABORATORIO', 'IMAGENOLOGÍA', 'HONORARIO', 'MEDICAMENTO', 'INSUMO', 'QUIRÓFANO', 'OTRO')),
  precio numeric(12, 2) not null default 0, producto_id bigint, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.hos_tarifas (
  id bigint generated always as identity primary key, aseguradora_id bigint not null references public.hos_aseguradoras (id) on delete cascade, servicio_id bigint not null references public.hos_servicios (id) on delete cascade,
  precio numeric(12, 2) not null, unique (aseguradora_id, servicio_id)
);

-- ============ Registros ============
create table if not exists public.hos_citas (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  paciente_id bigint not null references public.hos_pacientes (id), medico_id bigint references public.hos_medicos (id), fecha date not null, hora time not null, duracion_min integer not null default 30,
  motivo text, estado text not null default 'PROGRAMADA' check (estado in ('PROGRAMADA', 'CONFIRMADA', 'ATENDIDA', 'CANCELADA', 'NO ASISTIÓ')), observaciones text, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.hos_admisiones (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, paciente_id bigint not null references public.hos_pacientes (id), tipo text not null default 'HOSPITALIZACIÓN' check (tipo in ('EMERGENCIA', 'CONSULTA EXTERNA', 'HOSPITALIZACIÓN', 'CIRUGÍA AMBULATORIA')),
  fecha_ingreso timestamptz not null default now(), medico_id bigint references public.hos_medicos (id), cama_id bigint references public.hos_camas (id), diagnostico_ingreso text, aseguradora_id bigint references public.hos_aseguradoras (id), poliza_seguro text,
  estado text not null default 'ABIERTA' check (estado in ('ABIERTA', 'EGRESADA', 'FACTURADA', 'ANULADA')), fecha_egreso timestamptz, diagnostico_egreso text, tipo_egreso text check (tipo_egreso in ('ALTA MÉDICA', 'ALTA VOLUNTARIA', 'TRASLADO', 'DEFUNCIÓN')),
  ultimo_dia_cama date, total_cargos numeric(14, 2) not null default 0, total_pagos numeric(14, 2) not null default 0, parte_aseguradora numeric(14, 2) not null default 0, parte_paciente numeric(14, 2) not null default 0,
  factura_paciente text, factura_aseguradora text, usuario text, motivo_anulacion text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.hos_cargos (
  id bigint generated always as identity primary key, admision_id bigint not null references public.hos_admisiones (id) on delete cascade, fecha date not null default current_date,
  servicio_id bigint references public.hos_servicios (id), tipo text not null default 'OTRO', descripcion text not null, medico_id bigint references public.hos_medicos (id),
  cantidad numeric(12, 3) not null default 1 check (cantidad > 0), precio numeric(12, 2) not null default 0, total numeric(14, 2) not null default 0,
  origen text not null default 'MANUAL' check (origen in ('MANUAL', 'DÍA-CAMA', 'FARMACIA', 'QUIRÓFANO')), producto_id bigint, movimiento_id bigint, honorario_liq_id bigint, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.hos_ordenes (
  id bigint generated always as identity primary key, admision_id bigint not null references public.hos_admisiones (id) on delete cascade, fecha timestamptz not null default now(), medico_id bigint references public.hos_medicos (id),
  tipo text not null check (tipo in ('MEDICAMENTO', 'INSUMO', 'LABORATORIO', 'IMAGENOLOGÍA', 'PROCEDIMIENTO', 'DIETA', 'CUIDADOS')), descripcion text not null, producto_id bigint, servicio_id bigint references public.hos_servicios (id),
  cantidad numeric(12, 3) not null default 1, indicaciones text, estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'DESPACHADA', 'REALIZADA', 'CANCELADA')),
  atendida_por text, atendida_en timestamptz, cargo_id bigint, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.hos_quirofanos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  sala text not null, fecha date not null, hora time not null, duracion_min integer not null default 60, paciente_id bigint not null references public.hos_pacientes (id), admision_id bigint references public.hos_admisiones (id),
  cirujano_id bigint references public.hos_medicos (id), anestesiologo_id bigint references public.hos_medicos (id), procedimiento text not null, tipo_anestesia text,
  estado text not null default 'PROGRAMADA' check (estado in ('PROGRAMADA', 'EN CURSO', 'REALIZADA', 'CANCELADA')), observaciones text, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.hos_pagos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  admision_id bigint not null references public.hos_admisiones (id), fecha date not null default current_date, tipo text not null default 'ANTICIPO' check (tipo in ('ANTICIPO', 'ABONO', 'PAGO FINAL', 'DEVOLUCIÓN')),
  forma text not null default 'EFECTIVO' check (forma in ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE', 'DEPÓSITO')), monto numeric(14, 2) not null, referencia text, usuario text, cierre_id bigint,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.hos_reclamos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, aseguradora_id bigint not null references public.hos_aseguradoras (id), admision_id bigint not null references public.hos_admisiones (id), fecha date not null default current_date,
  monto numeric(14, 2) not null, monto_aprobado numeric(14, 2), monto_pagado numeric(14, 2) not null default 0, fecha_pago date,
  estado text not null default 'PRESENTADO' check (estado in ('PRESENTADO', 'EN REVISIÓN', 'APROBADO', 'PAGADO', 'RECHAZADO', 'PARCIAL')), observaciones text, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.hos_honorarios (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, medico_id bigint not null references public.hos_medicos (id), desde date not null, hasta date not null,
  bruto numeric(14, 2) not null default 0, participacion_hospital numeric(14, 2) not null default 0, retencion_isr numeric(14, 2) not null default 0, liquido numeric(14, 2) not null default 0,
  estado text not null default 'CALCULADA' check (estado in ('CALCULADA', 'PAGADA', 'ANULADA')), referencia_pago text, usuario text, detalle jsonb,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.hos_cierres_caja (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  fecha date not null, usuario text, efectivo numeric(14, 2) not null default 0, tarjeta numeric(14, 2) not null default 0, transferencia numeric(14, 2) not null default 0, cheque numeric(14, 2) not null default 0, deposito numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0, efectivo_contado numeric(14, 2), diferencia numeric(14, 2), observaciones text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, fecha)
);

-- ============ Reglas ============
-- Números correlativos por empresa.
create or replace function public.hos_numerar() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(4812, new.localidad_id::integer);
  if tg_table_name = 'hos_pacientes' then new.expediente := coalesce(nullif(new.expediente, 0), coalesce((select max(expediente) from public.hos_pacientes where localidad_id = new.localidad_id), 0) + 1);
  elsif tg_table_name = 'hos_admisiones' then new.numero := coalesce((select max(numero) from public.hos_admisiones where localidad_id = new.localidad_id), 0) + 1; new.usuario := public.hos_quien();
  elsif tg_table_name = 'hos_reclamos' then new.numero := coalesce((select max(numero) from public.hos_reclamos where localidad_id = new.localidad_id), 0) + 1; new.usuario := public.hos_quien();
  elsif tg_table_name = 'hos_honorarios' then new.numero := coalesce((select max(numero) from public.hos_honorarios where localidad_id = new.localidad_id), 0) + 1; new.usuario := public.hos_quien();
  end if;
  return new;
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['hos_pacientes', 'hos_admisiones', 'hos_reclamos', 'hos_honorarios'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_numerar', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.hos_numerar()', t || '_numerar', t);
  end loop;
end;
$$;
-- Admisión: ocupa la cama; un paciente no tiene dos admisiones abiertas; la cama debe estar disponible.
create or replace function public.hos_preparar_admision() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.cama_id is distinct from old.cama_id then
    if new.estado = 'ABIERTA' and new.cama_id is not null and exists (select 1 from public.hos_camas where id = new.cama_id and estado <> 'DISPONIBLE') then raise exception 'La cama no está disponible.'; end if;
    if tg_op = 'UPDATE' and old.cama_id is not null then update public.hos_camas set estado = 'LIMPIEZA' where id = old.cama_id; end if;
    if new.estado = 'ABIERTA' and new.cama_id is not null then update public.hos_camas set estado = 'OCUPADA' where id = new.cama_id; end if;
  end if;
  if tg_op = 'INSERT' then
    if exists (select 1 from public.hos_admisiones where paciente_id = new.paciente_id and estado = 'ABIERTA') then raise exception 'El paciente ya tiene una admisión abierta.'; end if;
    new.ultimo_dia_cama := (new.fecha_ingreso at time zone 'America/Guatemala')::date - 1;
  elsif old.estado <> 'ABIERTA' and current_setting('fin.hospital', true) is distinct from 'si' then
    raise exception 'La admisión % está %: ya no se modifica.', old.numero, lower(old.estado);
  end if;
  return new;
end;
$$;
drop trigger if exists hos_admisiones_preparar on public.hos_admisiones;
create trigger hos_admisiones_preparar before insert or update on public.hos_admisiones for each row execute function public.hos_preparar_admision();
-- Cargos: total = cantidad × precio; solo en admisiones abiertas; recalcula el total de la cuenta.
create or replace function public.hos_preparar_cargo() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_estado text;
begin
  select estado into v_estado from public.hos_admisiones where id = coalesce(new.admision_id, old.admision_id);
  if v_estado <> 'ABIERTA' and current_setting('fin.hospital', true) is distinct from 'si' then raise exception 'La cuenta del paciente ya está cerrada (%).', lower(v_estado); end if;
  if tg_op = 'DELETE' then
    if old.movimiento_id is not null then raise exception 'Un cargo de farmacia se revierte con una devolución, no se borra.'; end if;
    if old.honorario_liq_id is not null then raise exception 'El honorario ya se liquidó al médico.'; end if;
    return old;
  end if;
  new.total := round(new.cantidad * new.precio, 2);
  if tg_op = 'INSERT' then new.usuario := public.hos_quien(); end if;
  return new;
end;
$$;
drop trigger if exists hos_cargos_preparar on public.hos_cargos;
create trigger hos_cargos_preparar before insert or update or delete on public.hos_cargos for each row execute function public.hos_preparar_cargo();
create or replace function public.hos_totalizar() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id bigint := coalesce(new.admision_id, old.admision_id);
begin
  perform set_config('fin.hospital', 'si', true);
  update public.hos_admisiones set total_cargos = coalesce((select sum(total) from public.hos_cargos where admision_id = v_id), 0),
    total_pagos = coalesce((select sum(case when tipo = 'DEVOLUCIÓN' then -monto else monto end) from public.hos_pagos where admision_id = v_id), 0) where id = v_id;
  perform set_config('fin.hospital', '', true);
  return null;
end;
$$;
drop trigger if exists hos_cargos_totalizar on public.hos_cargos;
create trigger hos_cargos_totalizar after insert or update or delete on public.hos_cargos for each row execute function public.hos_totalizar();
drop trigger if exists hos_pagos_totalizar on public.hos_pagos;
create trigger hos_pagos_totalizar after insert or update or delete on public.hos_pagos for each row execute function public.hos_totalizar();

-- Censo diario: carga el día-cama de cada admisión abierta con cama, día por día hasta la fecha.
create or replace function public.hos_cargar_dias_cama(p_localidad bigint, p_fecha date) returns integer language plpgsql security definer set search_path = '' as $$
declare a record; d date; v_n integer := 0;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para cargar días-cama.'; end if;
  for a in select ad.id, ad.ultimo_dia_cama, c.codigo, c.tipo, c.tarifa_diaria, (ad.fecha_ingreso at time zone 'America/Guatemala')::date as ingreso
           from public.hos_admisiones ad join public.hos_camas c on c.id = ad.cama_id where ad.localidad_id = p_localidad and ad.estado = 'ABIERTA' loop
    d := greatest(coalesce(a.ultimo_dia_cama, a.ingreso - 1) + 1, a.ingreso);
    while d <= p_fecha loop
      insert into public.hos_cargos (admision_id, fecha, tipo, descripcion, cantidad, precio, origen) values (a.id, d, 'HABITACIÓN', 'DÍA-CAMA ' || a.codigo || ' (' || a.tipo || ') ' || to_char(d, 'DD/MM/YYYY'), 1, a.tarifa_diaria, 'DÍA-CAMA');
      v_n := v_n + 1; d := d + 1;
    end loop;
    perform set_config('fin.hospital', 'si', true);
    update public.hos_admisiones set ultimo_dia_cama = greatest(coalesce(ultimo_dia_cama, p_fecha), p_fecha) where id = a.id;
    perform set_config('fin.hospital', '', true);
  end loop;
  return v_n;
end;
$$;
-- Farmacia: despacha un medicamento o insumo a la cuenta del paciente (salida de inventario al costo y cargo al precio).
create or replace function public.hos_despachar(p_admision bigint, p_producto bigint, p_cantidad numeric, p_bodega bigint, p_lote text, p_precio numeric, p_orden bigint default null) returns bigint language plpgsql security definer set search_path = '' as $$
declare ad public.hos_admisiones; pr record; v_mov bigint; v_cargo bigint;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para despachar.'; end if;
  select * into ad from public.hos_admisiones where id = p_admision;
  if ad.estado <> 'ABIERTA' then raise exception 'La admisión no está abierta.'; end if;
  if coalesce(p_cantidad, 0) <= 0 then raise exception 'Indica la cantidad.'; end if;
  select id, nombre, codigo_producto, precio_costo into pr from public.productos where id = p_producto;
  insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, lote, usuario, documento_fisico, observaciones)
  values (ad.organizacion_id, ad.localidad_id, p_producto, p_bodega, (now() at time zone 'America/Guatemala')::date, -p_cantidad, coalesce(pr.precio_costo, 0), 'DESPACHO', coalesce(p_lote, ''), public.hos_quien(), 'ADMISIÓN ' || ad.numero, 'Despacho de farmacia a paciente')
  returning id into v_mov;
  insert into public.hos_cargos (admision_id, tipo, descripcion, cantidad, precio, origen, producto_id, movimiento_id)
  values (ad.id, 'MEDICAMENTO', pr.nombre || coalesce(' · ' || pr.codigo_producto, '') || case when coalesce(p_lote, '') <> '' then ' · lote ' || p_lote else '' end, p_cantidad, coalesce(p_precio, 0), 'FARMACIA', p_producto, v_mov)
  returning id into v_cargo;
  if p_orden is not null then update public.hos_ordenes set estado = 'DESPACHADA', atendida_por = public.hos_quien(), atendida_en = now(), cargo_id = v_cargo where id = p_orden; end if;
  return v_cargo;
end;
$$;
-- Egreso: cierra la cuenta, libera la cama y distribuye entre aseguradora y paciente (deducible + coaseguro).
create or replace function public.hos_egresar(p_id bigint, p_fecha timestamptz, p_tipo text, p_diagnostico text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare ad public.hos_admisiones; ag public.hos_aseguradoras; v_pac numeric; v_ase numeric;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para egresar pacientes.'; end if;
  select * into ad from public.hos_admisiones where id = p_id for update;
  if ad.estado <> 'ABIERTA' then raise exception 'La admisión % ya está %.', ad.numero, lower(ad.estado); end if;
  perform public.hos_cargar_dias_cama(ad.localidad_id, ((coalesce(p_fecha, now()) at time zone 'America/Guatemala')::date) - 1);
  select * into ad from public.hos_admisiones where id = p_id;
  if ad.aseguradora_id is not null then
    select * into ag from public.hos_aseguradoras where id = ad.aseguradora_id;
    v_pac := least(ad.total_cargos, ag.deducible + greatest(0, ad.total_cargos - ag.deducible) * ag.coaseguro_pct / 100);
  else v_pac := ad.total_cargos; end if;
  v_ase := ad.total_cargos - v_pac;
  perform set_config('fin.hospital', 'si', true);
  update public.hos_admisiones set estado = 'EGRESADA', fecha_egreso = coalesce(p_fecha, now()), tipo_egreso = p_tipo, diagnostico_egreso = nullif(trim(p_diagnostico), ''), parte_paciente = round(v_pac, 2), parte_aseguradora = round(v_ase, 2) where id = p_id;
  if ad.cama_id is not null then update public.hos_camas set estado = 'LIMPIEZA' where id = ad.cama_id; end if;
  if v_ase > 0 then
    insert into public.hos_reclamos (organizacion_id, localidad_id, numero, aseguradora_id, admision_id, monto, observaciones) values (ad.organizacion_id, ad.localidad_id, 0, ad.aseguradora_id, ad.id, round(v_ase, 2), 'Generado al egreso de la admisión ' || ad.numero);
  end if;
  perform set_config('fin.hospital', '', true);
  return jsonb_build_object('total', ad.total_cargos, 'paciente', round(v_pac, 2), 'aseguradora', round(v_ase, 2), 'pagado', ad.total_pagos, 'saldo_paciente', round(v_pac - ad.total_pagos, 2));
end;
$$;
create or replace function public.hos_facturar(p_id bigint, p_factura_paciente text, p_factura_aseguradora text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para facturar.'; end if;
  if not exists (select 1 from public.hos_admisiones where id = p_id and estado = 'EGRESADA') then raise exception 'Primero egresa al paciente.'; end if;
  perform set_config('fin.hospital', 'si', true);
  update public.hos_admisiones set estado = 'FACTURADA', factura_paciente = nullif(trim(p_factura_paciente), ''), factura_aseguradora = nullif(trim(p_factura_aseguradora), '') where id = p_id;
  perform set_config('fin.hospital', '', true);
end;
$$;
-- Honorarios: liquida los cargos de honorarios del médico en el rango (menos la participación del hospital y la retención de ISR).
create or replace function public.hos_liquidar_honorarios(p_localidad bigint, p_medico bigint, p_desde date, p_hasta date) returns bigint language plpgsql security definer set search_path = '' as $$
declare m public.hos_medicos; v_bruto numeric; v_id bigint; v_org bigint;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para liquidar honorarios.'; end if;
  select * into m from public.hos_medicos where id = p_medico;
  select organizacion_id into v_org from public.localidades where id = p_localidad;
  select coalesce(sum(c.total), 0) into v_bruto from public.hos_cargos c join public.hos_admisiones a on a.id = c.admision_id
  where a.localidad_id = p_localidad and c.medico_id = p_medico and c.tipo = 'HONORARIO' and c.honorario_liq_id is null and c.fecha between p_desde and p_hasta and a.estado <> 'ANULADA';
  if v_bruto <= 0 then raise exception 'El médico no tiene honorarios pendientes en el período.'; end if;
  insert into public.hos_honorarios (organizacion_id, localidad_id, numero, medico_id, desde, hasta, bruto, participacion_hospital, retencion_isr, liquido)
  values (v_org, p_localidad, 0, p_medico, p_desde, p_hasta, round(v_bruto, 2), round(v_bruto * m.pct_hospital / 100, 2), round((v_bruto - v_bruto * m.pct_hospital / 100) * m.retencion_isr_pct / 100, 2),
          round(v_bruto - v_bruto * m.pct_hospital / 100 - (v_bruto - v_bruto * m.pct_hospital / 100) * m.retencion_isr_pct / 100, 2)) returning id into v_id;
  perform set_config('fin.hospital', 'si', true);
  update public.hos_cargos c set honorario_liq_id = v_id from public.hos_admisiones a
  where a.id = c.admision_id and a.localidad_id = p_localidad and c.medico_id = p_medico and c.tipo = 'HONORARIO' and c.honorario_liq_id is null and c.fecha between p_desde and p_hasta and a.estado <> 'ANULADA';
  perform set_config('fin.hospital', '', true);
  return v_id;
end;
$$;
-- Catálogos por omisión.
create or replace function public.hos_asegurar_catalogos(p_localidad bigint) returns void language plpgsql security definer set search_path = '' as $$
declare v_org bigint;
begin
  select organizacion_id into v_org from public.localidades where id = p_localidad;
  insert into public.hos_especialidades (organizacion_id, localidad_id, codigo, nombre) select v_org, p_localidad, x.c, x.n from (values (1, 'MEDICINA GENERAL'), (2, 'MEDICINA INTERNA'), (3, 'CIRUGÍA GENERAL'), (4, 'PEDIATRÍA'), (5, 'GINECOLOGÍA Y OBSTETRICIA'), (6, 'TRAUMATOLOGÍA Y ORTOPEDIA'), (7, 'CARDIOLOGÍA'), (8, 'ANESTESIOLOGÍA'), (9, 'INTENSIVISTA'), (10, 'EMERGENCIOLOGÍA')) x(c, n) on conflict (localidad_id, codigo) do nothing;
  insert into public.hos_areas (organizacion_id, localidad_id, codigo, nombre, tipo) select v_org, p_localidad, x.c, x.n, x.t from (values (1, 'EMERGENCIA', 'EMERGENCIA'), (2, 'ENCAMAMIENTO', 'ENCAMAMIENTO'), (3, 'INTENSIVO', 'INTENSIVO'), (4, 'SALA DE OPERACIONES', 'QUIRÓFANO'), (5, 'CONSULTA EXTERNA', 'CONSULTA')) x(c, n, t) on conflict (localidad_id, codigo) do nothing;
  insert into public.hos_servicios (organizacion_id, localidad_id, codigo, nombre, tipo, precio) select v_org, p_localidad, x.c, x.n, x.t, x.p from (values
    ('CON-01', 'CONSULTA MÉDICA GENERAL', 'HONORARIO', 300), ('CON-02', 'CONSULTA DE ESPECIALIDAD', 'HONORARIO', 500), ('EME-01', 'ATENCIÓN DE EMERGENCIA', 'PROCEDIMIENTO', 450),
    ('LAB-01', 'HEMATOLOGÍA COMPLETA', 'LABORATORIO', 120), ('LAB-02', 'QUÍMICA SANGUÍNEA', 'LABORATORIO', 250), ('LAB-03', 'ORINA COMPLETA', 'LABORATORIO', 60),
    ('IMG-01', 'RAYOS X', 'IMAGENOLOGÍA', 350), ('IMG-02', 'ULTRASONIDO', 'IMAGENOLOGÍA', 500), ('IMG-03', 'TOMOGRAFÍA', 'IMAGENOLOGÍA', 2500),
    ('QX-01', 'USO DE SALA DE OPERACIONES (HORA)', 'QUIRÓFANO', 2000), ('QX-02', 'HONORARIO DE CIRUJANO', 'HONORARIO', 5000), ('QX-03', 'HONORARIO DE ANESTESIÓLOGO', 'HONORARIO', 2500),
    ('ENF-01', 'CUIDADOS DE ENFERMERÍA (DÍA)', 'PROCEDIMIENTO', 300), ('OXI-01', 'OXÍGENO (HORA)', 'INSUMO', 40)) x(c, n, t, p) on conflict (localidad_id, codigo) do nothing;
end;
$$;

-- ============ Auditoría, permisos, módulo y menú ============
do $$
declare t text;
begin
  foreach t in array array['hos_aseguradoras', 'hos_pacientes', 'hos_especialidades', 'hos_medicos', 'hos_areas', 'hos_camas', 'hos_servicios', 'hos_citas', 'hos_admisiones', 'hos_cargos', 'hos_ordenes', 'hos_quirofanos', 'hos_pagos', 'hos_reclamos', 'hos_honorarios', 'hos_cierres_caja'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.auditar()', t || '_auditar', t);
  end loop;
  foreach t in array array['hos_aseguradoras', 'hos_pacientes', 'hos_especialidades', 'hos_medicos', 'hos_areas', 'hos_camas', 'hos_servicios', 'hos_tarifas', 'hos_citas', 'hos_admisiones', 'hos_cargos', 'hos_ordenes', 'hos_quirofanos', 'hos_pagos', 'hos_reclamos', 'hos_honorarios', 'hos_cierres_caja'] loop
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
revoke execute on function public.hos_numerar() from public, anon, authenticated;
revoke execute on function public.hos_preparar_admision() from public, anon, authenticated;
revoke execute on function public.hos_preparar_cargo() from public, anon, authenticated;
revoke execute on function public.hos_totalizar() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['public.hos_cargar_dias_cama(bigint, date)', 'public.hos_despachar(bigint, bigint, numeric, bigint, text, numeric, bigint)', 'public.hos_egresar(bigint, timestamptz, text, text)',
                           'public.hos_facturar(bigint, text, text)', 'public.hos_liquidar_honorarios(bigint, bigint, date, date)', 'public.hos_asegurar_catalogos(bigint)', 'public.hos_quien()'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
-- Módulo Hospital y sus permisos por rol (los mismos que Importaciones y exportaciones).
do $$
declare v_mod bigint; v_cod integer; v_id bigint; v_orden integer; o record;
begin
  select id into v_mod from public.modulos_sistema where siglas = 'HOS' limit 1;
  if v_mod is null then
    select coalesce(max(codigo), 0) + 1 into v_cod from public.modulos_sistema where modulo_mayor_id is null and codigo < 100;
    insert into public.modulos_sistema (codigo, siglas, descripcion, activo) values (v_cod, 'HOS', 'HOSPITAL', true) returning id into v_mod;
  end if;
  insert into public.rol_modulos (rol_id, modulo, puede_ver, puede_editar) select rol_id, 'hospital', puede_ver, puede_editar from public.rol_modulos where modulo = 'comercio' on conflict (rol_id, modulo) do nothing;
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  for o in select * from (values
    (1, 'catalogos', 'Pacientes y médicos', 'hos-pacientes', 'Pacientes'), (2, 'catalogos', 'Pacientes y médicos', 'hos-medicos', 'Médicos y especialidades'), (3, 'catalogos', 'Instalaciones y tarifas', 'hos-camas', 'Áreas, habitaciones y camas'),
    (4, 'catalogos', 'Instalaciones y tarifas', 'hos-servicios', 'Servicios y tarifas'), (5, 'catalogos', 'Instalaciones y tarifas', 'hos-aseguradoras', 'Aseguradoras y convenios'),
    (6, 'registros', 'Atención', 'hos-admision', 'Admisión'), (7, 'registros', 'Atención', 'hos-citas', 'Citas y agenda médica'), (8, 'registros', 'Atención', 'hos-cuenta', 'Cuenta del paciente'),
    (9, 'registros', 'Atención', 'hos-ordenes', 'Órdenes médicas y farmacia'), (10, 'registros', 'Atención', 'hos-quirofanos', 'Programación de quirófanos'),
    (11, 'procesos', 'Hospital', 'hos-censo', 'Censo diario y día-cama'), (12, 'procesos', 'Hospital', 'hos-egreso', 'Egreso y facturación'), (13, 'procesos', 'Hospital', 'hos-honorarios', 'Liquidación de honorarios'),
    (14, 'procesos', 'Hospital', 'hos-reclamos', 'Reclamos a aseguradoras'), (15, 'procesos', 'Hospital', 'hos-caja', 'Cierre de caja hospitalaria'),
    (16, 'reportes', 'Reportes', 'hos-rep-ocupacion', 'Censo y ocupación'), (17, 'reportes', 'Reportes', 'hos-rep-ingresos', 'Ingresos por servicio y médico'), (18, 'reportes', 'Reportes', 'hos-rep-cuentas', 'Cuentas abiertas de pacientes'),
    (19, 'reportes', 'Reportes', 'hos-rep-cartera', 'Cartera de aseguradoras'), (20, 'reportes', 'Reportes', 'hos-rep-indicadores', 'Indicadores hospitalarios')) as x(n, grupo, subgrupo, clave, nombre) loop
    select id into v_id from public.opciones_sistema where modulo_id = v_mod and clave = o.clave;
    if v_id is null then insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values (v_mod, o.grupo, o.subgrupo, o.clave, o.nombre, v_orden + o.n); end if;
  end loop;
end;
$$;
notify pgrst, 'reload schema';
select 'Hospital: pacientes, médicos, camas, servicios, aseguradoras, admisiones, cuenta, farmacia, quirófanos, egreso, reclamos, honorarios y caja instalados.' as resultado;
