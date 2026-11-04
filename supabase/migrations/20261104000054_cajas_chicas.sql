-- Caja y Bancos · Cajas · Cajas chicas: definición de las cajas y su administración por subcaja.
--   cajas_chicas: las cajas de cada localidad (selección de caja a operar): número (correlativo),
--   nombre, responsable, tipo de caja, modalidad (normal o liquidación), centro de costo y centro
--   alterno, moneda, fondo asignado, cuenta contable de la caja, cuenta del IVA por cobrar, cuenta de
--   retenciones y la cuenta bancaria con que se reintegra.
--   caja_periodos: las subcajas (una por mes, con su número correlativo por caja): año y mes, tasa
--   de cambio, el anticipo, el adelanto y la liquidación (cuenta bancaria, cheque, nota y valor),
--   estado (abierta o liquidada), usuario y fecha de creación y de liquidación, y su póliza.
--   caja_documentos: las facturas y recibos que se liquidan en la subcaja: serie, número, tipo,
--   fecha, NIT y proveedor, fecha de presentación, moneda, clasificación, total, exento, galones de
--   combustible (súper, regular y diésel: el IDP se calcula con las tasas de Parámetros generales),
--   INGUAT, timbre de prensa, gastos no deducibles, retención, % de IVA, IVA y base (calculados),
--   justificación, cuenta de gasto, cuenta de no deducibles, centro de costo y si entra al detalle
--   contable.
--   caja_lineas: el detalle contable de la subcaja (lo arma procesar_caja_periodo: gasto, IVA y no
--   deducibles al debe; retenciones y la cuenta de la caja al haber).
--   procesar_caja_periodo: RECONSTRUIR el detalle contable, LIQUIDAR (con su partida de egresos si
--   se pide) y REABRIR una subcaja liquidada (si su partida ya se anuló).
-- Escribir: administrador. Se ejecuta después del script 53.

-- ---------- Cajas ----------
create table if not exists public.cajas_chicas (
  id                  bigint generated always as identity primary key,
  organizacion_id     bigint not null references public.organizaciones (id),
  localidad_id        bigint not null,
  codigo              integer not null check (codigo > 0),
  nombre              text not null check (length(trim(nombre)) > 0),
  responsable         text,
  tipo_caja           text not null default 'CAJA CHICA' check (tipo_caja in ('CAJA CHICA', 'CORTE CAJA', 'FONDO ROTATIVO', 'LIQUIDACIÓN DE GASTOS')),
  modalidad           text not null default 'NORMAL' check (modalidad in ('NORMAL', 'LIQUIDACION')),
  centro_costo_id     bigint references public.centros_costo (id),
  centro_alterno_id   bigint references public.centros_costo (id),
  moneda_id           bigint not null references public.monedas (id),
  monto_fondo         numeric(18, 2) not null default 0 check (monto_fondo >= 0),
  cuenta_id           bigint references public.cuentas (id),
  cuenta_iva_id       bigint references public.cuentas (id),
  cuenta_retencion_id bigint references public.cuentas (id),
  cuenta_bancaria_id  bigint references public.cuentas_bancarias (id),
  activa              boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, codigo)
);

-- La cuenta es del catálogo de la localidad.
create or replace function public.cuenta_de_localidad(p_cuenta bigint, p_loc bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_cuenta is null or exists (select 1 from public.cuentas c join public.catalogos_cuentas k on k.id = c.catalogo_id where c.id = p_cuenta and k.localidad_id = p_loc);
$$;
create or replace function public.centro_de_localidad(p_centro bigint, p_loc bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_centro is null or exists (select 1 from public.centros_costo c join public.catalogos_centros k on k.id = c.catalogo_id where c.id = p_centro and k.localidad_id = p_loc);
$$;

create or replace function public.preparar_caja_chica() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.codigo is null then
      perform pg_advisory_xact_lock(4810, new.localidad_id::integer);
      new.codigo := coalesce((select max(codigo) from public.cajas_chicas where localidad_id = new.localidad_id), 0) + 1;
    end if;
  else
    new.organizacion_id := old.organizacion_id; new.localidad_id := old.localidad_id;
  end if;
  if not public.cuenta_de_localidad(new.cuenta_id, new.localidad_id) or not public.cuenta_de_localidad(new.cuenta_iva_id, new.localidad_id)
     or not public.cuenta_de_localidad(new.cuenta_retencion_id, new.localidad_id) then
    raise exception 'Las cuentas contables de la caja deben ser del catálogo de la localidad.';
  end if;
  if not public.centro_de_localidad(new.centro_costo_id, new.localidad_id) or not public.centro_de_localidad(new.centro_alterno_id, new.localidad_id) then
    raise exception 'Los centros de costo de la caja deben ser del catálogo de la localidad.';
  end if;
  if new.cuenta_bancaria_id is not null and not exists (select 1 from public.cuentas_bancarias where id = new.cuenta_bancaria_id and localidad_id = new.localidad_id) then
    raise exception 'La cuenta bancaria no es de la localidad de la caja.';
  end if;
  new.nombre := upper(trim(new.nombre));
  new.responsable := nullif(upper(trim(new.responsable)), '');
  return new;
end;
$$;
drop trigger if exists cajas_chicas_preparar on public.cajas_chicas;
create trigger cajas_chicas_preparar before insert or update on public.cajas_chicas for each row execute function public.preparar_caja_chica();
drop trigger if exists cajas_chicas_auditar on public.cajas_chicas;
create trigger cajas_chicas_auditar before insert or update on public.cajas_chicas for each row execute function public.auditar();

-- ---------- Subcajas ----------
create table if not exists public.caja_periodos (
  id                        bigint generated always as identity primary key,
  caja_id                   bigint not null references public.cajas_chicas (id),
  organizacion_id           bigint not null,
  localidad_id              bigint not null,
  numero                    integer not null,
  anio                      integer not null check (anio between 1900 and 2999),
  mes                       integer not null check (mes between 1 and 12),
  estado                    text not null default 'ABIERTA' check (estado in ('ABIERTA', 'LIQUIDADA')),
  tipo_cambio               numeric(18, 6) not null default 1 check (tipo_cambio > 0),
  valor                     numeric(18, 2) not null default 0 check (valor >= 0),
  anticipo_cuenta_id        bigint references public.cuentas_bancarias (id),
  anticipo_cheque           text,
  anticipo_nota             text,
  anticipo_valor            numeric(18, 2) not null default 0 check (anticipo_valor >= 0),
  adelanto_cuenta_id        bigint references public.cuentas_bancarias (id),
  adelanto_cheque           text,
  adelanto_nota             text,
  adelanto_valor            numeric(18, 2) not null default 0 check (adelanto_valor >= 0),
  liquidacion_cuenta_id     bigint references public.cuentas_bancarias (id),
  liquidacion_cheque        text,
  liquidacion_nota          text,
  liquidacion_valor         numeric(18, 2) not null default 0 check (liquidacion_valor >= 0),
  partida_id                bigint references public.partidas (id) on delete set null,
  usuario                   text,
  liquidado_por             text,
  liquidado_en              timestamptz,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (caja_id, numero)
);
create index if not exists caja_periodos_caja_idx on public.caja_periodos (caja_id, anio desc, mes desc);

create or replace function public.preparar_caja_periodo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  k public.cajas_chicas;
  v_proceso boolean := current_setting('fin.caja', true) = 'si';
begin
  if tg_op = 'INSERT' then
    select * into k from public.cajas_chicas where id = new.caja_id;
    if k.id is null then raise exception 'La caja no existe.'; end if;
    if not k.activa then raise exception 'La caja % está inactiva.', k.codigo; end if;
    perform pg_advisory_xact_lock(4811, new.caja_id::integer);
    new.numero := coalesce((select max(numero) from public.caja_periodos where caja_id = new.caja_id), 0) + 1;
    new.organizacion_id := k.organizacion_id; new.localidad_id := k.localidad_id;
    new.usuario := coalesce((select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())), 'SISTEMA');
    new.estado := 'ABIERTA'; new.partida_id := null; new.liquidado_por := null; new.liquidado_en := null;
  else
    new.caja_id := old.caja_id; new.organizacion_id := old.organizacion_id; new.localidad_id := old.localidad_id;
    new.numero := old.numero; new.usuario := old.usuario;
    if not v_proceso then
      if old.estado = 'LIQUIDADA' then raise exception 'La subcaja % ya está liquidada: reábrela para modificarla.', old.numero; end if;
      new.estado := old.estado; new.partida_id := old.partida_id; new.liquidado_por := old.liquidado_por; new.liquidado_en := old.liquidado_en;
    end if;
  end if;
  if exists (select 1 from unnest(array[new.anticipo_cuenta_id, new.adelanto_cuenta_id, new.liquidacion_cuenta_id]) x (id)
             where x.id is not null and not exists (select 1 from public.cuentas_bancarias b where b.id = x.id and b.localidad_id = new.localidad_id)) then
    raise exception 'Las cuentas bancarias de la subcaja deben ser de la localidad.';
  end if;
  new.anticipo_cheque := nullif(trim(new.anticipo_cheque), ''); new.anticipo_nota := nullif(trim(new.anticipo_nota), '');
  new.adelanto_cheque := nullif(trim(new.adelanto_cheque), ''); new.adelanto_nota := nullif(trim(new.adelanto_nota), '');
  new.liquidacion_cheque := nullif(trim(new.liquidacion_cheque), ''); new.liquidacion_nota := nullif(trim(new.liquidacion_nota), '');
  return new;
end;
$$;
drop trigger if exists caja_periodos_preparar on public.caja_periodos;
create trigger caja_periodos_preparar before insert or update on public.caja_periodos for each row execute function public.preparar_caja_periodo();
drop trigger if exists caja_periodos_auditar on public.caja_periodos;
create trigger caja_periodos_auditar before insert or update on public.caja_periodos for each row execute function public.auditar();

-- ---------- Documentos de la subcaja ----------
create table if not exists public.caja_documentos (
  id                     bigint generated always as identity primary key,
  periodo_id             bigint not null references public.caja_periodos (id) on delete cascade,
  linea                  integer not null,
  serie                  text,
  documento              text not null check (length(trim(documento)) > 0),
  tipo_documento         text not null default 'FACTURA ELECTRÓNICA' check (tipo_documento in ('FACTURA ELECTRÓNICA', 'FACTURA ESPECIAL', 'FACTURA PEQUEÑO CONTRIBUYENTE', 'RECIBO', 'OTRO')),
  fecha                  date not null default current_date,
  nit                    text,
  proveedor_codigo       text,
  proveedor_nombre       text not null check (length(trim(proveedor_nombre)) > 0),
  fecha_presentacion     date,
  moneda_id              bigint not null references public.monedas (id),
  clasificacion          text not null default 'BIENES' check (clasificacion in ('BIENES', 'SERVICIOS', 'COMBUSTIBLE', 'IMPORTACIÓN', 'OTROS')),
  total                  numeric(18, 2) not null check (total > 0),
  exento                 numeric(18, 2) not null default 0 check (exento >= 0),
  galones_super          numeric(12, 3) not null default 0 check (galones_super >= 0),
  galones_regular        numeric(12, 3) not null default 0 check (galones_regular >= 0),
  galones_diesel         numeric(12, 3) not null default 0 check (galones_diesel >= 0),
  idp                    numeric(18, 2) not null default 0,
  inguat                 numeric(18, 2) not null default 0 check (inguat >= 0),
  timbre_prensa          numeric(18, 2) not null default 0 check (timbre_prensa >= 0),
  no_deducible           numeric(18, 2) not null default 0 check (no_deducible >= 0),
  retencion              boolean not null default false,
  valor_retencion        numeric(18, 2) not null default 0 check (valor_retencion >= 0),
  porcentaje_iva         numeric(6, 2) not null default 12 check (porcentaje_iva >= 0),
  iva                    numeric(18, 2) not null default 0,
  base                   numeric(18, 2) not null default 0,
  justificacion          text,
  cuenta_gasto_id        bigint references public.cuentas (id),
  cuenta_no_deducible_id bigint references public.cuentas (id),
  centro_costo_id        bigint references public.centros_costo (id),
  contable               boolean not null default true,
  usuario                text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (periodo_id, linea)
);
create index if not exists caja_documentos_nit_idx on public.caja_documentos (nit);

create or replace function public.preparar_caja_documento() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p public.caja_periodos;
  g public.parametros_generales;
  v_afecto numeric;
begin
  select * into p from public.caja_periodos where id = coalesce(new.periodo_id, old.periodo_id);
  if p.estado = 'LIQUIDADA' then raise exception 'La subcaja % ya está liquidada: sus documentos no cambian.', p.numero; end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4812, new.periodo_id::integer);
    new.linea := coalesce((select max(linea) from public.caja_documentos where periodo_id = new.periodo_id), 0) + 1;
    new.usuario := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  else
    new.periodo_id := old.periodo_id; new.linea := old.linea; new.usuario := old.usuario;
  end if;
  if not public.cuenta_de_localidad(new.cuenta_gasto_id, p.localidad_id) or not public.cuenta_de_localidad(new.cuenta_no_deducible_id, p.localidad_id) then
    raise exception 'Las cuentas del documento deben ser del catálogo de la localidad.';
  end if;
  if not public.centro_de_localidad(new.centro_costo_id, p.localidad_id) then
    raise exception 'El centro de costo del documento no es del catálogo de la localidad.';
  end if;
  -- IDP: galones por la tasa de cada combustible (Parámetros generales de la localidad).
  select * into g from public.parametros_generales where localidad_id = p.localidad_id order by id limit 1;
  new.idp := round(new.galones_super * coalesce(g.idp_super, 0) + new.galones_regular * coalesce(g.idp_regular, 0) + new.galones_diesel * coalesce(g.idp_diesel, 0), 2);
  if not new.retencion then new.valor_retencion := 0; end if;
  if new.valor_retencion > new.total then raise exception 'La retención del documento % pasa de su total.', new.documento; end if;
  v_afecto := new.total - new.exento - new.idp - new.inguat - new.timbre_prensa - new.no_deducible;
  if v_afecto < 0 then raise exception 'El exento, el IDP, el INGUAT, el timbre y los no deducibles del documento % pasan de su total.', new.documento; end if;
  new.iva := case when new.tipo_documento in ('FACTURA PEQUEÑO CONTRIBUYENTE', 'RECIBO', 'OTRO') then 0
                  else round(v_afecto * new.porcentaje_iva / (100 + new.porcentaje_iva), 2) end;
  new.base := v_afecto - new.iva;
  new.documento := upper(trim(new.documento));
  new.serie := nullif(upper(trim(new.serie)), '');
  new.nit := nullif(upper(replace(trim(new.nit), '-', '')), '');
  new.proveedor_codigo := nullif(upper(trim(new.proveedor_codigo)), '');
  new.proveedor_nombre := upper(trim(new.proveedor_nombre));
  new.justificacion := nullif(trim(new.justificacion), '');
  return new;
end;
$$;
drop trigger if exists caja_documentos_preparar on public.caja_documentos;
create trigger caja_documentos_preparar before insert or update or delete on public.caja_documentos for each row execute function public.preparar_caja_documento();
drop trigger if exists caja_documentos_auditar on public.caja_documentos;
create trigger caja_documentos_auditar before insert or update on public.caja_documentos for each row execute function public.auditar();

-- ---------- Detalle contable de la subcaja ----------
create table if not exists public.caja_lineas (
  id         bigint generated always as identity primary key,
  periodo_id bigint not null references public.caja_periodos (id) on delete cascade,
  linea      integer not null,
  cuenta_id  bigint not null references public.cuentas (id),
  concepto   text,
  debe       numeric(18, 2) not null default 0 check (debe >= 0),
  haber      numeric(18, 2) not null default 0 check (haber >= 0),
  centro_id  bigint references public.centros_costo (id),
  check (debe = 0 or haber = 0),
  unique (periodo_id, linea)
);

-- ---------- Totales por subcaja ----------
create or replace view public.caja_periodos_resumen with (security_invoker = true) as
  select p.*,
         coalesce(d.documentos, 0) as documentos,
         coalesce(d.liquidado, 0) as liquidado,
         coalesce(d.iva, 0) as total_iva,
         p.anticipo_valor + p.adelanto_valor - coalesce(d.liquidado, 0) as disponible
  from public.caja_periodos p
  left join lateral (
    select count(*) as documentos, sum(x.total) as liquidado, sum(x.iva) as iva
    from public.caja_documentos x where x.periodo_id = p.id) d on true;

-- ---------- Reconstruir, liquidar y reabrir ----------
create or replace function public.procesar_caja_periodo(p_id bigint, p_accion text, p_partida boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.caja_periodos;
  k public.cajas_chicas;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_gtq bigint := (select x.id from public.monedas x where x.iso = 'GTQ');
  v_falta text;
  v_lineas integer; v_debe numeric; v_haber numeric;
  v_partida bigint; v_tipo bigint;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede procesar las cajas chicas.'; end if;
  select * into p from public.caja_periodos where id = p_id for update;
  if p.id is null then raise exception 'La subcaja no existe.'; end if;
  select * into k from public.cajas_chicas where id = p.caja_id;
  perform set_config('fin.caja', 'si', true);

  if p_accion = 'REABRIR' then
    if p.estado <> 'LIQUIDADA' then raise exception 'La subcaja % no está liquidada.', p.numero; end if;
    if p.partida_id is not null and exists (select 1 from public.partidas x where x.id = p.partida_id and x.estado = 'VIGENTE') then
      raise exception 'Primero anula la póliza % de la subcaja en Partidas contables.', (select x.mes || '-' || x.numero from public.partidas x where x.id = p.partida_id);
    end if;
    update public.caja_periodos set estado = 'ABIERTA', liquidado_por = null, liquidado_en = null, partida_id = null where id = p.id;
    perform set_config('fin.caja', '', true);
    return jsonb_build_object('numero', p.numero);
  end if;
  if p_accion not in ('RECONSTRUIR', 'LIQUIDAR') then raise exception 'Acción no válida.'; end if;
  if p.estado = 'LIQUIDADA' then raise exception 'La subcaja % ya está liquidada.', p.numero; end if;

  -- Detalle contable, en quetzales: gasto (base + exento + IDP + INGUAT + timbre), IVA y no
  -- deducibles al debe; retenciones y la cuenta de la caja (total − retención) al haber.
  if k.cuenta_id is null then raise exception 'Define la cuenta contable de la caja % en la selección de cajas.', k.codigo; end if;
  select string_agg(coalesce(nullif(x.serie, '') || '-', '') || x.documento, ', ' order by x.linea) into v_falta
  from public.caja_documentos x where x.periodo_id = p.id and x.contable and x.cuenta_gasto_id is null;
  if v_falta is not null then raise exception 'Escribe la cuenta de gasto de: %.', v_falta; end if;
  if k.cuenta_iva_id is null and exists (select 1 from public.caja_documentos x where x.periodo_id = p.id and x.contable and x.iva > 0) then
    raise exception 'Define la cuenta del IVA por cobrar de la caja % en la selección de cajas.', k.codigo;
  end if;
  if k.cuenta_retencion_id is null and exists (select 1 from public.caja_documentos x where x.periodo_id = p.id and x.contable and x.valor_retencion > 0) then
    raise exception 'Define la cuenta de retenciones de la caja % en la selección de cajas.', k.codigo;
  end if;

  delete from public.caja_lineas where periodo_id = p.id;
  with d as (
    select x.*, case when x.moneda_id = v_gtq then 1 else p.tipo_cambio end as f,
           coalesce(x.centro_costo_id, k.centro_costo_id) as centro
    from public.caja_documentos x where x.periodo_id = p.id and x.contable),
  m as (
    select 1 as orden, cuenta_gasto_id as cuenta_id, centro, 'GASTOS CAJA CHICA' as concepto, round(sum((base + exento + idp + inguat + timbre_prensa) * f), 2) as debe, 0::numeric as haber from d group by cuenta_gasto_id, centro
    union all
    select 2, coalesce(cuenta_no_deducible_id, cuenta_gasto_id), centro, 'GASTOS NO DEDUCIBLES', round(sum(no_deducible * f), 2), 0 from d group by coalesce(cuenta_no_deducible_id, cuenta_gasto_id), centro
    union all
    select 3, k.cuenta_iva_id, null, 'IVA POR COBRAR', round(sum(iva * f), 2), 0 from d
    union all
    select 4, k.cuenta_retencion_id, null, 'RETENCIONES', 0, round(sum(valor_retencion * f), 2) from d
    union all
    select 5, k.cuenta_id, null, 'CAJA ' || k.codigo || ' · ' || k.nombre, 0, round(sum((total - valor_retencion) * f), 2) from d)
  insert into public.caja_lineas (periodo_id, linea, cuenta_id, concepto, debe, haber, centro_id)
  select p.id, row_number() over (order by orden, cuenta_id, centro), cuenta_id, concepto, debe, haber, centro
  from m where cuenta_id is not null and (debe > 0 or haber > 0);

  -- Ajuste del redondeo a la cuenta de la caja.
  select count(*), coalesce(sum(debe), 0), coalesce(sum(haber), 0) into v_lineas, v_debe, v_haber from public.caja_lineas where periodo_id = p.id;
  if v_lineas > 0 and v_debe <> v_haber and abs(v_debe - v_haber) <= 0.05 then
    update public.caja_lineas set haber = haber + (v_debe - v_haber) where periodo_id = p.id and cuenta_id = k.cuenta_id and haber > 0;
    v_haber := v_debe;
  end if;

  if p_accion = 'RECONSTRUIR' then
    perform set_config('fin.caja', '', true);
    return jsonb_build_object('numero', p.numero, 'lineas', v_lineas, 'debe', v_debe, 'haber', v_haber);
  end if;

  if v_lineas < 2 then raise exception 'La subcaja % no tiene documentos con detalle contable para liquidar.', p.numero; end if;
  if v_debe <> v_haber then raise exception 'El detalle contable no cuadra: debe % y haber %.', v_debe, v_haber; end if;
  if p_partida then
    select id into v_tipo from public.tipos_partida where siglas = 'PE';
    if v_tipo is null then select id into v_tipo from public.tipos_partida order by codigo limit 1; end if;
    insert into public.partidas (organizacion_id, localidad_id, anio, mes, tipo_partida_id, descripcion, moneda_id, tipo_cambio, justificacion)
    values (p.organizacion_id, p.localidad_id, p.anio, p.mes, v_tipo,
            'LIQUIDACIÓN CAJA CHICA ' || k.codigo || ' · ' || k.nombre || ' · SUBCAJA ' || p.numero || ' · ' || lpad(p.mes::text, 2, '0') || '/' || p.anio,
            coalesce(v_gtq, k.moneda_id), 1, 'Generada desde Cajas chicas · caja ' || k.codigo || ' subcaja ' || p.numero)
    returning id into v_partida;
    insert into public.partida_lineas (partida_id, linea, cuenta_id, concepto, debe, haber, centro_id)
    select v_partida, l.linea, l.cuenta_id, left(l.concepto, 200), l.debe, l.haber, l.centro_id
    from public.caja_lineas l where l.periodo_id = p.id order by l.linea;
  end if;
  update public.caja_periodos set estado = 'LIQUIDADA', liquidado_por = v_quien, liquidado_en = now(), partida_id = v_partida where id = p.id;
  perform set_config('fin.caja', '', true);
  return jsonb_build_object('numero', p.numero, 'total', v_debe,
                            'partida', (select x.mes || '-' || x.numero from public.partidas x where x.id = v_partida));
end;
$$;

-- ---------- Seguridad ----------
do $$
declare t text;
begin
  foreach t in array array['cajas_chicas', 'caja_periodos', 'caja_documentos', 'caja_lineas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
  end loop;
  foreach t in array array['cajas_chicas', 'caja_periodos', 'caja_documentos'] loop
    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format('drop policy if exists "%s: modificar" on public.%I', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
  end loop;
end;
$$;
drop policy if exists "caja_documentos: quitar" on public.caja_documentos;
create policy "caja_documentos: quitar" on public.caja_documentos for delete to authenticated using (public.puede_editar_catalogos());
grant select, insert, update on public.cajas_chicas to authenticated;
grant select, insert, update on public.caja_periodos to authenticated;
grant select, insert, update, delete on public.caja_documentos to authenticated;
grant select on public.caja_lineas to authenticated;
grant select on public.caja_periodos_resumen to authenticated;

revoke execute on function public.preparar_caja_chica() from public, anon, authenticated;
revoke execute on function public.preparar_caja_periodo() from public, anon, authenticated;
revoke execute on function public.preparar_caja_documento() from public, anon, authenticated;
revoke execute on function public.cuenta_de_localidad(bigint, bigint) from public, anon, authenticated;
revoke execute on function public.centro_de_localidad(bigint, bigint) from public, anon, authenticated;
revoke execute on function public.procesar_caja_periodo(bigint, text, boolean) from public, anon;
grant execute on function public.procesar_caja_periodo(bigint, text, boolean) to authenticated;

-- ---------- Menú: Caja y Bancos · Cajas · Cajas chicas ----------
insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
select m.id, 'cajas', 'Cajas', 'cajas-chicas', 'Cajas chicas', coalesce((select max(orden) from public.opciones_sistema), 0) + 1
from public.modulos_sistema m
where m.siglas = 'CYB' and m.modulo_mayor_id is null
  and not exists (select 1 from public.opciones_sistema o where o.clave = 'cajas-chicas' and o.modulo_id = m.id);

notify pgrst, 'reload schema';
