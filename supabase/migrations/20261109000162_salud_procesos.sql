-- Hospital y Clínicas médicas · etapa 2: procesos.
-- Glosas y apelaciones de aseguradoras, cargo de kits y paquetes quirúrgicos a la cuenta (con salida de inventario),
-- devoluciones de farmacia, esterilización (CEYE), mantenimiento de equipo médico, cuentas incobrables y facturación de
-- la cuenta del paciente o de la aseguradora en Facturación/Ventas (la factura queda lista para certificar el DTE).

-- ============ Columnas de enlace ============
alter table public.hos_admisiones add column if not exists paquete_id bigint references public.hos_paquetes_qx (id);
alter table public.hos_admisiones add column if not exists factura_paciente_id bigint references public.facturas_venta (id);
alter table public.hos_admisiones add column if not exists factura_aseguradora_id bigint references public.facturas_venta (id);
alter table public.cli_cobros add column if not exists factura_id bigint references public.facturas_venta (id);

-- ============ Tablas ============
create table if not exists public.med_glosas (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, origen text not null default 'HOSPITAL' check (origen in ('HOSPITAL', 'CLÍNICA')), reclamo_id bigint, aseguradora_id bigint not null references public.hos_aseguradoras (id),
  paciente_id bigint references public.hos_pacientes (id), fecha date not null default current_date, concepto text not null, motivo text not null default 'NO CUBIERTO POR LA PÓLIZA'
    check (motivo in ('NO CUBIERTO POR LA PÓLIZA', 'SIN PREAUTORIZACIÓN', 'TARIFA EXCEDIDA', 'FALTA DE SOPORTE', 'CARGO DUPLICADO', 'NO PERTINENTE', 'EXCLUSIÓN', 'OTRO')),
  monto numeric(14, 2) not null check (monto > 0), estado text not null default 'RECIBIDA' check (estado in ('RECIBIDA', 'APELADA', 'ACEPTADA', 'RECUPERADA', 'COBRADA AL PACIENTE')),
  fecha_apelacion date, argumento text, monto_recuperado numeric(14, 2) not null default 0, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.far_devoluciones (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  admision_id bigint not null references public.hos_admisiones (id), cargo_id bigint not null references public.hos_cargos (id), cantidad numeric(12, 3) not null check (cantidad > 0),
  motivo text, movimiento_id bigint, cargo_devolucion_id bigint, usuario text, fecha timestamptz not null default now()
);
create table if not exists public.ceye_paquetes (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  codigo integer not null, nombre text not null, contenido text, metodo text not null default 'VAPOR' check (metodo in ('VAPOR', 'ÓXIDO DE ETILENO', 'PLASMA', 'CALOR SECO')), vigencia_dias integer not null default 30, activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, codigo)
);
create table if not exists public.ceye_ciclos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, fecha timestamptz not null default now(), equipo text not null default 'AUTOCLAVE 1', metodo text not null default 'VAPOR' check (metodo in ('VAPOR', 'ÓXIDO DE ETILENO', 'PLASMA', 'CALOR SECO')),
  temperatura numeric(6, 1), presion text, minutos integer, indicador_quimico text check (indicador_quimico in ('VIRÓ', 'NO VIRÓ')), indicador_biologico text check (indicador_biologico in ('NEGATIVO', 'POSITIVO', 'PENDIENTE')),
  operador text, estado text not null default 'EN PROCESO' check (estado in ('EN PROCESO', 'LIBERADO', 'RECHAZADO')), observaciones text, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.ceye_ciclo_items (
  id bigint generated always as identity primary key, ciclo_id bigint not null references public.ceye_ciclos (id) on delete cascade, paquete_id bigint not null references public.ceye_paquetes (id),
  cantidad integer not null default 1 check (cantidad > 0), lote text, vence date, destino text
);
create table if not exists public.med_mantenimientos (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, equipo text not null, activo_codigo text, area_id bigint references public.hos_areas (id), tipo text not null default 'PREVENTIVO' check (tipo in ('PREVENTIVO', 'CORRECTIVO', 'CALIBRACIÓN', 'VERIFICACIÓN')),
  programado date not null default current_date, realizado date, proveedor text, tecnico text, costo numeric(14, 2) not null default 0, falla text, trabajo text,
  estado text not null default 'PROGRAMADO' check (estado in ('PROGRAMADO', 'EN PROCESO', 'REALIZADO', 'CANCELADO')), fuera_de_servicio boolean not null default false, proximo date, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);
create table if not exists public.med_incobrables (
  id bigint generated always as identity primary key, organizacion_id bigint not null references public.organizaciones (id), localidad_id bigint not null references public.localidades (id),
  numero integer not null, origen text not null check (origen in ('CUENTA HOSPITALARIA', 'RECLAMO HOSPITAL', 'RECLAMO CLÍNICA', 'COBRO CLÍNICA')), referencia_id bigint not null, deudor text not null,
  fecha date not null default current_date, saldo numeric(14, 2) not null check (saldo > 0), dias integer, tipo text not null default 'ESTIMACIÓN' check (tipo in ('ESTIMACIÓN', 'CASTIGO')),
  motivo text, partida_id bigint, usuario text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz, unique (localidad_id, numero)
);

do $$
declare t text;
begin
  foreach t in array array['med_glosas', 'ceye_ciclos', 'med_mantenimientos', 'med_incobrables'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_numerar', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.med_numerar()', t || '_numerar', t);
  end loop;
end;
$$;
-- CEYE: el vencimiento del paquete esterilizado es la fecha del ciclo más su vigencia.
create or replace function public.ceye_vence() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.vence is null then
    new.vence := ((select fecha from public.ceye_ciclos where id = new.ciclo_id) at time zone 'America/Guatemala')::date + coalesce((select vigencia_dias from public.ceye_paquetes where id = new.paquete_id), 30);
  end if;
  return new;
end;
$$;
drop trigger if exists ceye_ciclo_items_vence on public.ceye_ciclo_items;
create trigger ceye_ciclo_items_vence before insert on public.ceye_ciclo_items for each row execute function public.ceye_vence();

-- ============ Cargo de kits y paquetes ============
create or replace function public.hos_cargar_kit(p_admision bigint, p_kit bigint, p_bodega bigint) returns integer language plpgsql security definer set search_path = '' as $$
declare ad public.hos_admisiones; k public.med_kits; it record; v_n integer := 0; v_precio numeric;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para cargar kits.'; end if;
  select * into ad from public.hos_admisiones where id = p_admision;
  if ad.estado is distinct from 'ABIERTA' then raise exception 'La admisión no está abierta.'; end if;
  select * into k from public.med_kits where id = p_kit and localidad_id = ad.localidad_id;
  if k.id is null then raise exception 'El kit no existe en la empresa.'; end if;
  for it in select * from public.med_kit_items where kit_id = k.id order by id loop
    v_precio := case when it.cobrable then coalesce((select pp.precio from public.producto_precios pp where pp.producto_id = it.producto_id and coalesce(pp.estado, 'A') <> 'I' order by pp.tipo_precio_id limit 1), 0) else 0 end;
    if it.producto_id is not null and p_bodega is not null then
      perform public.hos_despachar(ad.id, it.producto_id, it.cantidad, p_bodega, null, v_precio, null);
    else
      insert into public.hos_cargos (admision_id, tipo, descripcion, cantidad, precio, origen) values (ad.id, 'INSUMO', 'KIT ' || k.nombre || ': ' || it.descripcion, it.cantidad, v_precio, 'MANUAL');
    end if;
    v_n := v_n + 1;
  end loop;
  if v_n = 0 then raise exception 'El kit no tiene artículos.'; end if;
  return v_n;
end;
$$;
-- Paquete quirúrgico: un cargo por el precio del paquete sin honorarios y los honorarios del cirujano y del anestesiólogo
-- (para su liquidación). Lo que no cubre el paquete se sigue cargando aparte.
create or replace function public.hos_aplicar_paquete(p_admision bigint, p_paquete bigint, p_cirujano bigint default null, p_anestesiologo bigint default null) returns numeric language plpgsql security definer set search_path = '' as $$
declare ad public.hos_admisiones; pq public.hos_paquetes_qx;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para aplicar paquetes.'; end if;
  select * into ad from public.hos_admisiones where id = p_admision;
  if ad.estado is distinct from 'ABIERTA' then raise exception 'La admisión no está abierta.'; end if;
  if ad.paquete_id is not null then raise exception 'La admisión ya tiene un paquete aplicado.'; end if;
  select * into pq from public.hos_paquetes_qx where id = p_paquete and localidad_id = ad.localidad_id and activo;
  if pq.id is null then raise exception 'El paquete no existe o no está activo.'; end if;
  insert into public.hos_cargos (admision_id, tipo, descripcion, cantidad, precio, origen)
  values (ad.id, 'PROCEDIMIENTO', 'PAQUETE ' || pq.nombre || ' (' || pq.dias_estancia || ' días, cama ' || lower(pq.tipo_cama) || ')', 1, pq.precio - pq.honorario_cirujano - pq.honorario_anestesia, 'MANUAL');
  if pq.honorario_cirujano > 0 then insert into public.hos_cargos (admision_id, tipo, descripcion, medico_id, cantidad, precio, origen) values (ad.id, 'HONORARIO', 'HONORARIO DE CIRUJANO (PAQUETE ' || pq.nombre || ')', p_cirujano, 1, pq.honorario_cirujano, 'MANUAL'); end if;
  if pq.honorario_anestesia > 0 then insert into public.hos_cargos (admision_id, tipo, descripcion, medico_id, cantidad, precio, origen) values (ad.id, 'HONORARIO', 'HONORARIO DE ANESTESIÓLOGO (PAQUETE ' || pq.nombre || ')', p_anestesiologo, 1, pq.honorario_anestesia, 'MANUAL'); end if;
  perform set_config('fin.hospital', 'si', true);
  update public.hos_admisiones set paquete_id = pq.id where id = ad.id;
  perform set_config('fin.hospital', '', true);
  return pq.precio;
end;
$$;
-- Devolución de farmacia: regresa el producto a la bodega y descuenta el cargo de la cuenta.
create or replace function public.hos_devolver(p_cargo bigint, p_cantidad numeric, p_motivo text default null) returns bigint language plpgsql security definer set search_path = '' as $$
declare c public.hos_cargos; ad public.hos_admisiones; m public.inventario_movimientos; v_dev numeric; v_mov bigint; v_cargo bigint; v_id bigint;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para devoluciones.'; end if;
  select * into c from public.hos_cargos where id = p_cargo;
  if c.origen <> 'FARMACIA' or c.movimiento_id is null then raise exception 'Solo se devuelven cargos despachados por farmacia.'; end if;
  select * into ad from public.hos_admisiones where id = c.admision_id;
  if ad.estado <> 'ABIERTA' then raise exception 'La cuenta del paciente ya está cerrada.'; end if;
  select coalesce(sum(cantidad), 0) into v_dev from public.far_devoluciones where cargo_id = c.id;
  if coalesce(p_cantidad, 0) <= 0 or p_cantidad > c.cantidad - v_dev then raise exception 'Se pueden devolver como máximo % unidades.', c.cantidad - v_dev; end if;
  select * into m from public.inventario_movimientos where id = c.movimiento_id;
  insert into public.inventario_movimientos (organizacion_id, localidad_id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, lote, usuario, documento_fisico, observaciones)
  values (m.organizacion_id, m.localidad_id, m.producto_id, m.bodega_id, (now() at time zone 'America/Guatemala')::date, p_cantidad, m.costo_unitario, 'DEVOLUCIÓN', m.lote, public.hos_quien(), 'ADMISIÓN ' || ad.numero, 'Devolución de farmacia') returning id into v_mov;
  insert into public.hos_cargos (admision_id, tipo, descripcion, cantidad, precio, origen, producto_id, movimiento_id)
  values (ad.id, c.tipo, 'DEVOLUCIÓN: ' || c.descripcion, p_cantidad, -c.precio, 'FARMACIA', c.producto_id, v_mov) returning id into v_cargo;
  insert into public.far_devoluciones (organizacion_id, localidad_id, admision_id, cargo_id, cantidad, motivo, movimiento_id, cargo_devolucion_id, usuario)
  values (ad.organizacion_id, ad.localidad_id, ad.id, c.id, p_cantidad, nullif(trim(p_motivo), ''), v_mov, v_cargo, public.hos_quien()) returning id into v_id;
  return v_id;
end;
$$;

-- ============ Facturación de la cuenta ============
-- Crea la factura en Facturación/Ventas (sin DTE: se certifica allí) con el detalle de la cuenta en la proporción del
-- destinatario. Hospital: admisión egresada (paciente o aseguradora). Clínica: cobro (paciente o aseguradora).
create or replace function public.med_facturar(p_origen text, p_id bigint, p_destino text, p_nit text default null, p_nombre text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_loc bigint; v_org bigint; v_total numeric; v_parte numeric; v_ase bigint; v_pac bigint; v_fac bigint; v_credito boolean; v_dias integer := 0; ag public.hos_aseguradoras; p public.hos_pacientes;
  v_mon bigint := (select id from public.monedas where iso = 'GTQ' order by id limit 1); l record; v_n integer := 0; v_factor numeric;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para facturar.'; end if;
  if p_destino not in ('PACIENTE', 'ASEGURADORA') then raise exception 'Destino no válido.'; end if;
  if p_origen = 'HOSPITAL' then
    select localidad_id, organizacion_id, total_cargos, case when p_destino = 'PACIENTE' then parte_paciente else parte_aseguradora end, aseguradora_id, paciente_id
      into v_loc, v_org, v_total, v_parte, v_ase, v_pac from public.hos_admisiones where id = p_id and estado in ('EGRESADA', 'FACTURADA');
    if v_loc is null then raise exception 'Egresa primero al paciente para facturar su cuenta.'; end if;
    if exists (select 1 from public.hos_admisiones where id = p_id and (case when p_destino = 'PACIENTE' then factura_paciente_id else factura_aseguradora_id end) is not null) then raise exception 'Esa parte de la cuenta ya está facturada.'; end if;
  elsif p_origen = 'CLÍNICA' then
    select localidad_id, organizacion_id, total, case when p_destino = 'PACIENTE' then parte_paciente else parte_aseguradora end, aseguradora_id, paciente_id
      into v_loc, v_org, v_total, v_parte, v_ase, v_pac from public.cli_cobros where id = p_id and estado = 'PAGADO' and tipo = 'SERVICIOS';
    if v_loc is null then raise exception 'El cobro no existe o está anulado.'; end if;
    if p_destino = 'PACIENTE' and exists (select 1 from public.cli_cobros where id = p_id and factura_id is not null) then raise exception 'El cobro ya está facturado.'; end if;
  else raise exception 'Origen no válido.'; end if;
  if coalesce(v_parte, 0) <= 0 then raise exception 'No hay monto que facturar a %.', lower(p_destino); end if;
  v_factor := case when coalesce(v_total, 0) > 0 then v_parte / v_total else 1 end;
  select * into p from public.hos_pacientes where id = v_pac;
  if p_destino = 'ASEGURADORA' then select * into ag from public.hos_aseguradoras where id = v_ase; v_credito := true; v_dias := least(coalesce(ag.dias_credito, 30), 365); else v_credito := false; end if;
  insert into public.facturas_venta (organizacion_id, localidad_id, numero, tipo_factura, tipo_dte, fecha_emision, estado, moneda_id, tipo_cambio, nombre, nit, consumidor_final, forma_pago, dias_credito, clasificacion, observaciones, direccion)
  values (v_org, v_loc, 0, 'FACTURA NORMAL', 'FACT', now(), 'FACTURADA', v_mon, 1,
    coalesce(nullif(trim(p_nombre), ''), case when p_destino = 'ASEGURADORA' then ag.nombre else p.nombres || ' ' || p.apellidos end),
    coalesce(nullif(trim(p_nit), ''), case when p_destino = 'ASEGURADORA' then ag.nit else p.nit end, 'CF'),
    coalesce(nullif(trim(p_nit), ''), case when p_destino = 'ASEGURADORA' then ag.nit else p.nit end) is null,
    case when v_credito then 'CRÉDITO' else 'CONTADO' end, v_dias, 'BIENES Y SERVICIOS',
    case when p_origen = 'HOSPITAL' then 'Cuenta hospitalaria ' else 'Cobro de clínica ' end || p_id || ' · paciente ' || p.nombres || ' ' || p.apellidos || ' · exp. ' || p.expediente,
    case when p_destino = 'PACIENTE' then p.direccion else 'CIUDAD' end)
  returning id into v_fac;
  for l in (select tipo, descripcion, sum(cantidad) cantidad, sum(total) total from (
              select c.tipo, regexp_replace(c.descripcion, '^DEVOLUCIÓN: ', '') descripcion, c.cantidad, c.total from public.hos_cargos c where p_origen = 'HOSPITAL' and c.admision_id = p_id
              union all select cl.tipo, cl.descripcion, cl.cantidad, case when p_destino = 'PACIENTE' then cl.parte_paciente else cl.parte_aseguradora end / nullif(v_factor, 0) from public.cli_cobro_lineas cl where p_origen = 'CLÍNICA' and cl.cobro_id = p_id) x
            group by tipo, descripcion having sum(total) > 0 order by 1, 2) loop
    v_n := v_n + 1;
    insert into public.factura_venta_lineas (factura_id, linea, descripcion, tipo, cantidad, precio, inventario)
    values (v_fac, v_n, left(l.descripcion, 250), case when l.tipo in ('MEDICAMENTO', 'INSUMO') then 'BIEN' else 'SERVICIO' end, 1, round(l.total * v_factor, 2), false);
  end loop;
  -- Ajuste de centavos para que la factura sume exactamente la parte del destinatario.
  update public.factura_venta_lineas set precio = precio + (v_parte - (select sum(precio) from public.factura_venta_lineas where factura_id = v_fac))
   where id = (select id from public.factura_venta_lineas where factura_id = v_fac order by precio desc limit 1);
  update public.facturas_venta set saldo = case when v_credito then total else 0 end, pagado = case when v_credito then 0 else total end where id = v_fac;
  perform set_config('fin.hospital', 'si', true); perform set_config('fin.clinica', 'si', true);
  if p_origen = 'HOSPITAL' then
    update public.hos_admisiones set factura_paciente_id = case when p_destino = 'PACIENTE' then v_fac else factura_paciente_id end, factura_aseguradora_id = case when p_destino = 'ASEGURADORA' then v_fac else factura_aseguradora_id end,
      factura_paciente = case when p_destino = 'PACIENTE' then 'Interna ' || (select numero from public.facturas_venta where id = v_fac) else factura_paciente end,
      factura_aseguradora = case when p_destino = 'ASEGURADORA' then 'Interna ' || (select numero from public.facturas_venta where id = v_fac) else factura_aseguradora end where id = p_id;
  elsif p_destino = 'PACIENTE' then
    update public.cli_cobros set factura_id = v_fac, factura = coalesce(factura, 'Interna ' || (select numero from public.facturas_venta where id = v_fac)) where id = p_id;
  end if;
  perform set_config('fin.hospital', '', true); perform set_config('fin.clinica', '', true);
  return jsonb_build_object('factura', v_fac, 'numero', (select numero from public.facturas_venta where id = v_fac), 'total', (select total from public.facturas_venta where id = v_fac));
end;
$$;

-- Catálogo inicial de paquetes de esterilización.
create or replace function public.ceye_asegurar(p_localidad bigint) returns void language plpgsql security definer set search_path = '' as $$
declare v_org bigint := (select organizacion_id from public.localidades where id = p_localidad);
begin
  insert into public.ceye_paquetes (organizacion_id, localidad_id, codigo, nombre, contenido, metodo, vigencia_dias) select v_org, p_localidad, x.* from (values
    (1, 'EQUIPO DE CIRUGÍA MAYOR', 'Instrumental de cirugía general', 'VAPOR', 30), (2, 'EQUIPO DE CIRUGÍA MENOR', 'Pinzas, tijeras, porta agujas, mango de bisturí', 'VAPOR', 30),
    (3, 'EQUIPO DE PARTO', 'Pinzas, tijeras de episiotomía, cinta umbilical', 'VAPOR', 30), (4, 'EQUIPO DE CESÁREA', 'Instrumental obstétrico', 'VAPOR', 30),
    (5, 'BULTO DE ROPA QUIRÚRGICA', 'Batas, campos y compresas', 'VAPOR', 30), (6, 'EQUIPO DE CURACIÓN', 'Pinzas, gasas, riñonera', 'VAPOR', 30),
    (7, 'EQUIPO DE LAPAROSCOPÍA', 'Ópticas y trocares termosensibles', 'PLASMA', 180)) x on conflict (localidad_id, codigo) do nothing;
end;
$$;

-- ============ Auditoría, permisos y menú ============
do $$
declare t text;
begin
  foreach t in array array['med_glosas', 'ceye_paquetes', 'ceye_ciclos', 'med_mantenimientos', 'med_incobrables'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.auditar()', t || '_auditar', t);
  end loop;
  foreach t in array array['med_glosas', 'far_devoluciones', 'ceye_paquetes', 'ceye_ciclos', 'ceye_ciclo_items', 'med_mantenimientos', 'med_incobrables'] loop
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
revoke execute on function public.ceye_vence() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['public.hos_cargar_kit(bigint, bigint, bigint)', 'public.hos_aplicar_paquete(bigint, bigint, bigint, bigint)', 'public.hos_devolver(bigint, numeric, text)',
                           'public.med_facturar(text, bigint, text, text, text)', 'public.ceye_asegurar(bigint)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
do $$
declare v_mod bigint; v_id bigint; v_orden integer; o record;
begin
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  for o in select * from (values
    ('HOS', 1, 'Cuenta del paciente', 'hos-kits-paquetes', 'Kits, paquetes y devoluciones'), ('HOS', 2, 'Cuenta del paciente', 'hos-auditoria-cuenta', 'Auditoría de cuenta médica'), ('HOS', 3, 'Cuenta del paciente', 'med-facturacion', 'Facturación de cuentas'),
    ('HOS', 4, 'Aseguradoras y cartera', 'med-glosas', 'Preautorizaciones y glosas'), ('HOS', 5, 'Aseguradoras y cartera', 'med-incobrables', 'Cuentas incobrables'),
    ('HOS', 6, 'Farmacia y servicios', 'far-botiquines', 'Botiquines de piso'), ('HOS', 7, 'Farmacia y servicios', 'far-controlados', 'Libro de medicamentos controlados'),
    ('HOS', 8, 'Farmacia y servicios', 'ceye-esterilizacion', 'Esterilización (CEYE)'), ('HOS', 9, 'Farmacia y servicios', 'med-mantenimiento', 'Mantenimiento de equipo médico'),
    ('CLI', 1, 'Caja y cartera', 'med-facturacion', 'Facturación de cuentas'), ('CLI', 2, 'Caja y cartera', 'med-glosas', 'Preautorizaciones y glosas'), ('CLI', 3, 'Caja y cartera', 'med-incobrables', 'Cuentas incobrables'),
    ('CLI', 4, 'Clínica', 'med-mantenimiento', 'Mantenimiento de equipo médico')) as x(m, n, subgrupo, clave, nombre) loop
    select id into v_mod from public.modulos_sistema where siglas = o.m limit 1;
    if v_mod is null then continue; end if;
    select id into v_id from public.opciones_sistema where modulo_id = v_mod and clave = o.clave;
    if v_id is null then insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values (v_mod, 'procesos', o.subgrupo, o.clave, o.nombre, v_orden + o.n + case when o.m = 'CLI' then 100 else 0 end); end if;
  end loop;
end;
$$;
notify pgrst, 'reload schema';
select 'Hospital y clínicas (etapa 2): glosas, kits y paquetes, devoluciones, CEYE, mantenimiento, incobrables y facturación de cuentas instalados.' as resultado;
