-- Integraciones SAT (Guatemala): datos del emisor y sus regímenes, establecimientos, tipos de DTE, frases y
-- escenarios FEL, períodos fiscales mensuales con la liquidación de IVA (débito, crédito, retenciones y remanente),
-- ISR e ISO, cierre del período (bloquea los documentos fiscales del mes) y control de obligaciones presentadas.
-- Las credenciales del certificador NO se guardan aquí (viven en los secretos del servidor).

-- ============ Catálogos ============
create table if not exists public.sat_emisores (
  id                   bigint generated always as identity primary key,
  organizacion_id      bigint not null references public.organizaciones (id),
  localidad_id         bigint not null unique references public.localidades (id),
  nit                  text not null,
  nombre_emisor        text not null,
  nombre_comercial     text,
  regimen_iva          text not null default 'GENERAL' check (regimen_iva in ('GENERAL', 'PEQUEÑO CONTRIBUYENTE', 'EXENTO')),
  regimen_isr          text not null default 'UTILIDADES' check (regimen_isr in ('UTILIDADES', 'SIMPLIFICADO')),
  agente_retencion_iva boolean not null default false,
  agente_retencion_isr boolean not null default true,
  contribuyente_especial boolean not null default false,
  certificador         text not null default 'COFIDI',
  nit_certificador     text,
  usuario_certificador text,
  correo_notificaciones text,
  porcentaje_iva       numeric(5, 2) not null default 12,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create table if not exists public.sat_establecimientos (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id    bigint not null references public.localidades (id),
  codigo          integer not null check (codigo > 0),
  nombre          text not null,
  direccion       text,
  municipio       text,
  departamento    text,
  activo          boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (localidad_id, codigo)
);
create table if not exists public.sat_tipos_dte (
  codigo      text primary key,
  nombre      text not null,
  uso         text not null check (uso in ('VENTA', 'NOTA', 'OTRO')),
  efecto_iva  integer not null default 1 check (efecto_iva in (-1, 0, 1)),
  descripcion text,
  activo      boolean not null default true
);
insert into public.sat_tipos_dte (codigo, nombre, uso, efecto_iva, descripcion) values
  ('FACT', 'FACTURA', 'VENTA', 1, 'Factura del régimen general.'),
  ('FCAM', 'FACTURA CAMBIARIA', 'VENTA', 1, 'Factura con título de crédito para ventas al crédito.'),
  ('FPEQ', 'FACTURA PEQUEÑO CONTRIBUYENTE', 'VENTA', 0, 'Factura del régimen de pequeño contribuyente (5 % sobre ingresos, sin crédito fiscal).'),
  ('FCAP', 'FACTURA CAMBIARIA PEQUEÑO CONTRIBUYENTE', 'VENTA', 0, 'Cambiaria del pequeño contribuyente.'),
  ('FESP', 'FACTURA ESPECIAL', 'OTRO', 1, 'La emite el comprador por compras a personas sin facturas; retiene IVA e ISR.'),
  ('NABN', 'NOTA DE ABONO', 'NOTA', -1, 'Rebaja sin devolución de mercadería.'),
  ('NCRE', 'NOTA DE CRÉDITO', 'NOTA', -1, 'Rebaja o devolución sobre una factura.'),
  ('NDEB', 'NOTA DE DÉBITO', 'NOTA', 1, 'Cargo adicional sobre una factura.'),
  ('RECI', 'RECIBO', 'OTRO', 0, 'Recibo sin efecto en IVA.'),
  ('RDON', 'RECIBO POR DONACIÓN', 'OTRO', 0, 'Donaciones a entidades autorizadas.'),
  ('FACA', 'FACTURA CONTRIBUYENTE AGROPECUARIO', 'VENTA', 1, 'Régimen especial agropecuario.')
on conflict (codigo) do nothing;
create table if not exists public.sat_frases (
  id          bigint generated always as identity primary key,
  tipo        integer not null,
  escenario   integer not null,
  descripcion text not null,
  texto       text,
  unique (tipo, escenario)
);
insert into public.sat_frases (tipo, escenario, descripcion, texto) values
  (1, 1, 'ISR: sujeto a pagos trimestrales', 'Sujeto a pagos trimestrales ISR'),
  (1, 2, 'ISR: sujeto a retención definitiva', 'Sujeto a retención definitiva ISR'),
  (1, 3, 'ISR: pago directo (régimen opcional simplificado)', 'Sujeto a pago directo ISR'),
  (2, 1, 'Agente de retención del IVA', 'Agente de Retención del IVA'),
  (3, 1, 'No genera derecho a crédito fiscal (pequeño contribuyente)', 'No genera derecho a crédito fiscal'),
  (4, 1, 'Exenta del IVA (art. 7 Ley del IVA)', 'Exenta del IVA (art. 7 num. 2 Ley del IVA)'),
  (4, 2, 'Exenta del IVA (art. 7 num. 4)', 'Exenta del IVA (art. 7 num. 4 Ley del IVA)'),
  (5, 1, 'Factura especial', 'Se retuvo el IVA y el ISR'),
  (7, 1, 'Exportación', 'Exportación de bienes')
on conflict (tipo, escenario) do nothing;
create table if not exists public.sat_emisor_frases (
  id           bigint generated always as identity primary key,
  localidad_id bigint not null references public.localidades (id),
  frase_id     bigint not null references public.sat_frases (id) on delete cascade,
  unique (localidad_id, frase_id)
);

-- ============ Períodos fiscales (liquidación mensual) ============
create table if not exists public.sat_periodos_fiscales (
  id                   bigint generated always as identity primary key,
  organizacion_id      bigint not null references public.organizaciones (id),
  localidad_id         bigint not null references public.localidades (id),
  anio                 integer not null check (anio between 2000 and 2999),
  mes                  integer not null check (mes between 1 and 12),
  estado               text not null default 'CERRADO' check (estado in ('CERRADO', 'REABIERTO')),
  ventas_gravadas      numeric(18, 2) not null default 0,
  ventas_exentas       numeric(18, 2) not null default 0,
  debito_fiscal        numeric(18, 2) not null default 0,
  compras_gravadas     numeric(18, 2) not null default 0,
  credito_fiscal       numeric(18, 2) not null default 0,
  retenciones_iva      numeric(18, 2) not null default 0,
  remanente_anterior   numeric(18, 2) not null default 0,
  iva_a_pagar          numeric(18, 2) not null default 0,
  remanente_siguiente  numeric(18, 2) not null default 0,
  isr_estimado         numeric(18, 2) not null default 0,
  iso_estimado         numeric(18, 2) not null default 0,
  detalle              jsonb,
  cerrado_por          text,
  cerrado_en           timestamptz,
  reabierto_por        text,
  reabierto_en         timestamptz,
  motivo_reapertura    text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (localidad_id, anio, mes)
);
create table if not exists public.sat_obligaciones_presentadas (
  id                bigint generated always as identity primary key,
  organizacion_id   bigint not null references public.organizaciones (id),
  localidad_id      bigint not null references public.localidades (id),
  obligacion        text not null,
  anio              integer not null,
  periodo           integer not null,
  fecha_presentacion date not null default current_date,
  formulario        text,
  numero_acceso     text,
  monto             numeric(18, 2) not null default 0,
  observaciones     text,
  usuario           text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (localidad_id, obligacion, anio, periodo)
);

-- Cierra el período: guarda la liquidación calculada (p_datos) y bloquea los documentos fiscales del mes.
create or replace function public.cerrar_periodo_fiscal(p_localidad bigint, p_anio integer, p_mes integer, p_datos jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_org bigint; v_id bigint;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  n numeric;
begin
  if not public.puede_editar_catalogos() then raise exception 'No tienes permiso para cerrar el período fiscal.'; end if;
  if make_date(p_anio, p_mes, 1) + interval '1 month' > (now() at time zone 'America/Guatemala')::date + 1 then raise exception 'El mes aún no ha terminado.'; end if;
  if exists (select 1 from public.sat_periodos_fiscales where localidad_id = p_localidad and anio = p_anio and mes = p_mes and estado = 'CERRADO') then raise exception 'El período ya está cerrado.'; end if;
  select organizacion_id into v_org from public.localidades where id = p_localidad;
  insert into public.sat_periodos_fiscales (organizacion_id, localidad_id, anio, mes, estado, ventas_gravadas, ventas_exentas, debito_fiscal, compras_gravadas, credito_fiscal, retenciones_iva,
    remanente_anterior, iva_a_pagar, remanente_siguiente, isr_estimado, iso_estimado, detalle, cerrado_por, cerrado_en)
  values (v_org, p_localidad, p_anio, p_mes, 'CERRADO', coalesce((p_datos->>'ventas_gravadas')::numeric, 0), coalesce((p_datos->>'ventas_exentas')::numeric, 0), coalesce((p_datos->>'debito_fiscal')::numeric, 0),
    coalesce((p_datos->>'compras_gravadas')::numeric, 0), coalesce((p_datos->>'credito_fiscal')::numeric, 0), coalesce((p_datos->>'retenciones_iva')::numeric, 0), coalesce((p_datos->>'remanente_anterior')::numeric, 0),
    coalesce((p_datos->>'iva_a_pagar')::numeric, 0), coalesce((p_datos->>'remanente_siguiente')::numeric, 0), coalesce((p_datos->>'isr_estimado')::numeric, 0), coalesce((p_datos->>'iso_estimado')::numeric, 0), p_datos, v_quien, now())
  on conflict (localidad_id, anio, mes) do update set estado = 'CERRADO', ventas_gravadas = excluded.ventas_gravadas, ventas_exentas = excluded.ventas_exentas, debito_fiscal = excluded.debito_fiscal,
    compras_gravadas = excluded.compras_gravadas, credito_fiscal = excluded.credito_fiscal, retenciones_iva = excluded.retenciones_iva, remanente_anterior = excluded.remanente_anterior,
    iva_a_pagar = excluded.iva_a_pagar, remanente_siguiente = excluded.remanente_siguiente, isr_estimado = excluded.isr_estimado, iso_estimado = excluded.iso_estimado, detalle = excluded.detalle,
    cerrado_por = excluded.cerrado_por, cerrado_en = excluded.cerrado_en
  returning id into v_id;
  return v_id;
end;
$$;
create or replace function public.reabrir_periodo_fiscal(p_id bigint, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.sat_periodos_fiscales;
begin
  if not public.es_superadmin() then raise exception 'Solo el Super Administrador reabre un período fiscal.'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escribe el motivo de la reapertura.'; end if;
  select * into p from public.sat_periodos_fiscales where id = p_id for update;
  if p.id is null or p.estado <> 'CERRADO' then raise exception 'El período no está cerrado.'; end if;
  if exists (select 1 from public.sat_periodos_fiscales x where x.localidad_id = p.localidad_id and x.estado = 'CERRADO' and (x.anio * 12 + x.mes) > (p.anio * 12 + p.mes)) then
    raise exception 'Reabre primero los meses posteriores.';
  end if;
  update public.sat_periodos_fiscales set estado = 'REABIERTO', reabierto_por = coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA'), reabierto_en = now(), motivo_reapertura = trim(p_motivo) where id = p.id;
end;
$$;

-- Con el período fiscal cerrado no se registran, cambian (en sus datos fiscales) ni borran facturas, notas o compras del mes.
create or replace function public.periodo_fiscal_cerrado(p_localidad bigint, p_fecha date)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_fecha is not null and exists (select 1 from public.sat_periodos_fiscales where localidad_id = p_localidad and estado = 'CERRADO' and anio = extract(year from p_fecha)::int and mes = extract(month from p_fecha)::int)
$$;
create or replace function public.proteger_periodo_fiscal() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_loc bigint := coalesce(new.localidad_id, old.localidad_id);
  v_nuevo date; v_viejo date;
begin
  if current_setting('fin.migracion', true) = 'si' or current_setting('fin.sat', true) = 'si' then return coalesce(new, old); end if;
  if tg_table_name = 'compras' then
    if tg_op <> 'DELETE' then v_nuevo := case when new.anio_presentacion is not null and new.mes_presentacion is not null then make_date(new.anio_presentacion, new.mes_presentacion, 1) else new.fecha_documento end; end if;
    if tg_op <> 'INSERT' then v_viejo := case when old.anio_presentacion is not null and old.mes_presentacion is not null then make_date(old.anio_presentacion, old.mes_presentacion, 1) else old.fecha_documento end; end if;
    if tg_op = 'UPDATE' and row(new.valor_total, new.iva, new.base, new.exento, new.estado, new.anio_presentacion, new.mes_presentacion, new.fecha_documento, new.nit, new.serie, new.documento)
       is not distinct from row(old.valor_total, old.iva, old.base, old.exento, old.estado, old.anio_presentacion, old.mes_presentacion, old.fecha_documento, old.nit, old.serie, old.documento) then return new; end if;
  elsif tg_table_name = 'facturas_venta' then
    if tg_op <> 'DELETE' then v_nuevo := (new.fecha_emision at time zone 'America/Guatemala')::date; end if;
    if tg_op <> 'INSERT' then v_viejo := (old.fecha_emision at time zone 'America/Guatemala')::date; end if;
    if tg_op = 'UPDATE' and row(new.total, new.iva, new.estado, new.fecha_emision, new.nit, new.autorizacion) is not distinct from row(old.total, old.iva, old.estado, old.fecha_emision, old.nit, old.autorizacion) then return new; end if;
  else
    if tg_op <> 'DELETE' then v_nuevo := (new.fecha_emision at time zone 'America/Guatemala')::date; end if;
    if tg_op <> 'INSERT' then v_viejo := (old.fecha_emision at time zone 'America/Guatemala')::date; end if;
    if tg_op = 'UPDATE' and row(new.valor, new.estado, new.fecha_emision, new.autorizacion) is not distinct from row(old.valor, old.estado, old.fecha_emision, old.autorizacion) then return new; end if;
  end if;
  if public.periodo_fiscal_cerrado(v_loc, v_nuevo) or public.periodo_fiscal_cerrado(v_loc, v_viejo) then
    raise exception 'El período fiscal % está cerrado en Integraciones SAT: no se modifican sus documentos.', to_char(coalesce(v_viejo, v_nuevo), 'MM/YYYY');
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists compras_periodo_fiscal on public.compras;
create trigger compras_periodo_fiscal before insert or update or delete on public.compras for each row execute function public.proteger_periodo_fiscal();
drop trigger if exists facturas_venta_periodo_fiscal on public.facturas_venta;
create trigger facturas_venta_periodo_fiscal before insert or update or delete on public.facturas_venta for each row execute function public.proteger_periodo_fiscal();
drop trigger if exists notas_venta_periodo_fiscal on public.notas_venta;
create trigger notas_venta_periodo_fiscal before insert or update or delete on public.notas_venta for each row execute function public.proteger_periodo_fiscal();

-- ============ Auditoría, permisos y menú ============
do $$
declare t text;
begin
  foreach t in array array['sat_emisores', 'sat_establecimientos', 'sat_periodos_fiscales', 'sat_obligaciones_presentadas'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.auditar()', t || '_auditar', t);
  end loop;
  foreach t in array array['sat_emisores', 'sat_establecimientos', 'sat_tipos_dte', 'sat_frases', 'sat_emisor_frases', 'sat_periodos_fiscales', 'sat_obligaciones_presentadas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format('drop policy if exists "%s: modificar" on public.%I', t, t);
    execute format('drop policy if exists "%s: quitar" on public.%I', t, t);
    if t <> 'sat_periodos_fiscales' then
      execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
      execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
      execute format('create policy "%s: quitar" on public.%I for delete to authenticated using (public.puede_editar_catalogos())', t, t);
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    else
      execute format('grant select on public.%I to authenticated', t);
    end if;
  end loop;
end;
$$;
revoke execute on function public.proteger_periodo_fiscal() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['public.cerrar_periodo_fiscal(bigint, integer, integer, jsonb)', 'public.reabrir_periodo_fiscal(bigint, text)', 'public.periodo_fiscal_cerrado(bigint, date)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
do $$
declare v_mod bigint; v_ref bigint; v_id bigint; v_orden integer; o record;
begin
  select id into v_mod from public.modulos_sistema where siglas = 'SAT' and modulo_mayor_id is null order by codigo limit 1;
  if v_mod is null then raise notice 'No existe el módulo SAT: se omite el menú.'; return; end if;
  select id into v_ref from public.opciones_sistema where clave = 'carga-facturas-sat' order by id limit 1;
  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  for o in select * from (values
    (1, 'catalogos', 'Emisor', 'sat-emisor', 'Datos del emisor'), (2, 'catalogos', 'Emisor', 'sat-establecimientos', 'Establecimientos'),
    (3, 'catalogos', 'FEL', 'sat-tipos-dte', 'Tipos de DTE'), (4, 'catalogos', 'FEL', 'sat-frases', 'Frases y escenarios'),
    (5, 'registros', 'Documentos', 'dte-emitidos', 'DTE emitidos'), (6, 'registros', 'Documentos', 'dte-recibidos', 'DTE recibidos'), (7, 'registros', 'Documentos', 'constancias-retencion', 'Constancias de retención'),
    (8, 'procesos', 'Impuestos', 'conciliacion-fiscal', 'Conciliación fiscal'), (9, 'procesos', 'Impuestos', 'liquidacion-impuestos', 'Liquidación de impuestos'), (10, 'procesos', 'Impuestos', 'calendario-fiscal', 'Calendario fiscal'),
    (11, 'reportes', 'Libros', 'libro-ventas', 'Libro de ventas'), (12, 'reportes', 'Libros', 'libro-compras', 'Libro de compras'),
    (13, 'reportes', 'Análisis', 'resumen-iva', 'Resumen de IVA'), (14, 'reportes', 'Análisis', 'dte-por-estado', 'DTE por estado')) as x(n, grupo, subgrupo, clave, nombre) loop
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
select 'Integraciones SAT: emisor, establecimientos, tipos de DTE, frases, períodos fiscales y obligaciones instalados.' as resultado;
