-- Compras · Registros: Clasificación compras, Tipo documento y Contraseñas de pago.
--   clasificaciones_compra: clasificación (número), descripción, siglas (migración de documentos),
--   si se incluye en el libro de compras y si aplica IVA.
--   tipos_documento_compra: tipo de documento (número) y descripción, con su cálculo de IVA
--   (normal, sin IVA o de importación) y si es recibo (no es factura).
--   compras: clasificacion_id y tipo_documento_id. calcular_compra toma de los catálogos el nombre,
--   si es factura o recibo y el IVA: de importación según el tipo, cero si el tipo es sin IVA o la
--   clasificación no aplica IVA, y si no el IVA incluido en el afecto.
--   contrasenas_pago: la recepción de documentos de un proveedor (número correlativo por localidad,
--   fecha y hora, usuario, tipo de compra inmediato o crédito, fecha estimada de pago y estado
--   pendiente, autorizada, liquidada o anulada). contrasena_documentos: los documentos recibidos
--   (serie, número, fecha, valor y la compra registrada). Una compra está en una sola contraseña
--   vigente; al registrar la compra después, se enlaza sola con el documento recibido.
--   procesar_contrasena (AUTORIZAR, LIQUIDAR, ANULAR, REABRIR) y liquidar_contrasenas (liquida las
--   autorizadas cuyas compras ya están pagadas).
-- Escribir: administrador. Se ejecuta después del script 57.

-- ---------- Clasificación compras ----------
create table if not exists public.clasificaciones_compra (
  id             bigint generated always as identity primary key,
  codigo         integer not null unique check (codigo > 0),
  nombre         text not null unique check (length(trim(nombre)) > 0),
  siglas         text check (siglas ~ '^[A-Z0-9]{1,6}$'),
  libro_compras  boolean not null default true,
  aplica_iva     boolean not null default true,
  activo         boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
insert into public.clasificaciones_compra (codigo, nombre, siglas, libro_compras, aplica_iva) values
  (1, 'NO IVA - NO LC', null, false, false), (2, 'SERVICIOS', 'SER', true, true), (3, 'BIENES EXENTOS', 'EXE', true, false),
  (4, 'BIENES', 'COM', true, true), (5, 'COMBUSTIBLES', 'GAS', true, true), (6, 'SERVICIOS EXENTOS', 'EXE', true, false),
  (7, 'COMPRAS MÉDICAS', 'CME', true, true), (8, 'GASTO NO DEDUCIBLE', 'GND', true, false), (9, 'IMPORTACIONES', 'IMP', true, false),
  (10, 'PEQUEÑO CONTRIBUYENTE', 'FPQ', true, false), (11, 'EXENTOS IMPORTACIÓN', 'IMPE', true, false)
on conflict do nothing;

-- ---------- Tipo documento ----------
create table if not exists public.tipos_documento_compra (
  id          bigint generated always as identity primary key,
  codigo      integer not null unique check (codigo > 0),
  nombre      text not null unique check (length(trim(nombre)) > 0),
  calculo_iva text not null default 'NORMAL' check (calculo_iva in ('NORMAL', 'SIN IVA', 'IMPORTACIÓN')),
  es_recibo   boolean not null default false,
  activo      boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
insert into public.tipos_documento_compra (codigo, nombre, calculo_iva, es_recibo) values
  (1, 'DECLARACIÓN ADUANERA', 'IMPORTACIÓN', false), (2, 'FAUCA', 'IMPORTACIÓN', false), (3, 'FACTURA', 'NORMAL', false),
  (4, 'FACTURA ELECTRÓNICA', 'NORMAL', false), (5, 'FACTURA ESPECIAL', 'NORMAL', false), (6, 'FORMULARIO SAT', 'SIN IVA', false),
  (7, 'NOTA DE CRÉDITO', 'NORMAL', false), (8, 'NOTA DE DÉBITO', 'NORMAL', false), (9, 'FACTURA PEQUEÑO CONTRIBUYENTE', 'SIN IVA', false),
  (10, 'OTROS', 'SIN IVA', false), (11, 'RECIBO', 'SIN IVA', true), (12, 'NOTAS DE ABONO', 'SIN IVA', false)
on conflict do nothing;

do $$
declare t text;
begin
  foreach t in array array['clasificaciones_compra', 'tipos_documento_compra'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.auditar()', t || '_auditar', t);
  end loop;
end;
$$;
create or replace function public.preparar_catalogo_compra() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.nombre := upper(trim(new.nombre));
  if tg_table_name = 'clasificaciones_compra' then new.siglas := nullif(upper(trim(new.siglas)), ''); end if;
  return new;
end;
$$;
drop trigger if exists clasificaciones_compra_preparar on public.clasificaciones_compra;
create trigger clasificaciones_compra_preparar before insert or update on public.clasificaciones_compra for each row execute function public.preparar_catalogo_compra();
drop trigger if exists tipos_documento_compra_preparar on public.tipos_documento_compra;
create trigger tipos_documento_compra_preparar before insert or update on public.tipos_documento_compra for each row execute function public.preparar_catalogo_compra();

-- ---------- Compras: con los catálogos ----------
alter table public.compras drop constraint if exists compras_tipo_dte_check;
alter table public.compras drop constraint if exists compras_clasificacion_check;
alter table public.compras
  add column if not exists tipo_documento_id bigint references public.tipos_documento_compra (id),
  add column if not exists clasificacion_id  bigint references public.clasificaciones_compra (id),
  add column if not exists contrasena_id     bigint;
drop index if exists public.compras_contrasena_key;

-- El tipo y la clasificación de las compras ya registradas.
set session_replication_role = replica;
update public.compras c set tipo_documento_id = t.id
from public.tipos_documento_compra t
where c.tipo_documento_id is null
  and t.nombre = case coalesce(c.tipo_dte, case when c.tipo_documento = 'RECIBO' then 'RECIBO' else 'FACTURA ELECTRÓNICA' end)
                   when 'DUCA (IMPORTACIÓN)' then 'DECLARACIÓN ADUANERA' when 'FACTURA CAMBIARIA' then 'FACTURA'
                   else coalesce(c.tipo_dte, case when c.tipo_documento = 'RECIBO' then 'RECIBO' else 'FACTURA ELECTRÓNICA' end) end;
update public.compras c set clasificacion_id = k.id
from public.clasificaciones_compra k
where c.clasificacion_id is null
  and k.nombre = case c.clasificacion when 'COMBUSTIBLE' then 'COMBUSTIBLES' when 'IMPORTACIÓN' then 'IMPORTACIONES' when 'SERVICIOS' then 'SERVICIOS' else 'BIENES' end;
update public.compras c set tipo_dte = t.nombre from public.tipos_documento_compra t where t.id = c.tipo_documento_id;
update public.compras c set clasificacion = k.nombre from public.clasificaciones_compra k where k.id = c.clasificacion_id;
set session_replication_role = origin;

create or replace function public.calcular_compra() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  g public.parametros_generales;
  t public.tipos_documento_compra;
  k public.clasificaciones_compra;
  v_afecto numeric;
  v_pct numeric;
begin
  -- Tipo de documento: del catálogo; si no viene (pantalla de Cheques), sale de factura o recibo.
  if new.tipo_documento_id is null or (tg_op = 'UPDATE' and new.tipo_documento is distinct from old.tipo_documento and new.tipo_documento_id is not distinct from old.tipo_documento_id) then
    select * into t from public.tipos_documento_compra
    where nombre = case when new.tipo_documento = 'RECIBO' then 'RECIBO' else coalesce(nullif(new.tipo_dte, 'RECIBO'), 'FACTURA ELECTRÓNICA') end;
    if t.id is null then select * into t from public.tipos_documento_compra where es_recibo = (new.tipo_documento = 'RECIBO') order by codigo limit 1; end if;
    new.tipo_documento_id := t.id;
  else
    select * into t from public.tipos_documento_compra where id = new.tipo_documento_id;
  end if;
  if t.id is not null then
    new.tipo_dte := t.nombre;
    new.tipo_documento := case when t.es_recibo then 'RECIBO' else 'FACTURA' end;
  end if;
  if new.clasificacion_id is null then
    select * into k from public.clasificaciones_compra where nombre = coalesce(new.clasificacion, 'BIENES');
    if k.id is null then select * into k from public.clasificaciones_compra where nombre = 'BIENES'; end if;
    new.clasificacion_id := k.id;
  else
    select * into k from public.clasificaciones_compra where id = new.clasificacion_id;
  end if;
  if k.id is not null then new.clasificacion := k.nombre; end if;

  if new.proveedor_id is not null and not exists (select 1 from public.proveedores p where p.id = new.proveedor_id and p.localidad_id = new.localidad_id) then
    raise exception 'El proveedor no es de la localidad de la compra.';
  end if;
  if new.bodega_id is not null and not exists (select 1 from public.bodegas b where b.id = new.bodega_id and b.localidad_id = new.localidad_id) then
    raise exception 'La bodega no es de la localidad de la compra.';
  end if;
  select * into g from public.parametros_generales where localidad_id = new.localidad_id order by id limit 1;
  new.idp := round(new.galones_super * coalesce(g.idp_super, 0) + new.galones_regular * coalesce(g.idp_regular, 0) + new.galones_diesel * coalesce(g.idp_diesel, 0), 2);
  if not new.aplica_inguat then new.inguat := 0; end if;
  if not new.retencion then new.retencion_valor := 0; new.retencion_formulario := null; new.retencion_fecha := null; end if;
  if new.pago_inmediato then new.dias_credito := 0; end if;
  v_pct := coalesce(g.impuesto1, 12);
  v_afecto := new.valor_total - new.exento - new.idp - new.inguat - new.turismo_itp - new.no_deducible - new.dai - new.valor_cuenta_ajena - new.iva_importacion;
  if v_afecto < 0 then raise exception 'El exento, IDP, INGUAT, ITP, no deducibles, DAI, IVA de importación y cuenta ajena pasan del valor total.'; end if;
  if coalesce(t.calculo_iva, 'NORMAL') = 'IMPORTACIÓN' then
    new.iva := new.iva_importacion; new.base := v_afecto;
  elsif coalesce(t.calculo_iva, 'NORMAL') = 'SIN IVA' or not coalesce(k.aplica_iva, true) then
    new.iva := 0; new.base := v_afecto;
  else
    new.iva := round(v_afecto * v_pct / (100 + v_pct), 2); new.base := v_afecto - new.iva;
  end if;
  new.retencion_formulario := nullif(trim(new.retencion_formulario), '');
  new.compra_inventario := nullif(trim(new.compra_inventario), '');
  new.orden_compra := nullif(upper(trim(new.orden_compra)), '');
  return new;
end;
$$;

-- ---------- Contraseñas de pago ----------
create table if not exists public.contrasenas_pago (
  id               bigint generated always as identity primary key,
  organizacion_id  bigint not null references public.organizaciones (id),
  localidad_id     bigint not null,
  numero           integer not null,
  fecha            timestamptz not null default now(),
  usuario          text,
  proveedor_id     bigint references public.proveedores (id),
  proveedor_codigo text,
  proveedor_nombre text not null check (length(trim(proveedor_nombre)) > 0),
  nit              text,
  tipo_compra      text not null default 'CRÉDITO' check (tipo_compra in ('INMEDIATO', 'CRÉDITO')),
  dias_credito     integer not null default 0 check (dias_credito >= 0),
  fecha_pago       date,
  estado           text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'AUTORIZADA', 'LIQUIDADA', 'ANULADA')),
  observaciones    text,
  autorizado_por   text, autorizado_en timestamptz,
  liquidado_por    text, liquidado_en timestamptz,
  anulado_por      text, anulado_en timestamptz, motivo_anulacion text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, numero)
);
create index if not exists contrasenas_pago_fecha_idx on public.contrasenas_pago (localidad_id, fecha desc);
do $$ begin
  alter table public.compras add constraint compras_contrasena_fkey foreign key (contrasena_id) references public.contrasenas_pago (id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.contrasena_documentos (
  id            bigint generated always as identity primary key,
  contrasena_id bigint not null references public.contrasenas_pago (id) on delete cascade,
  linea         integer not null,
  serie         text,
  documento     text not null check (length(trim(documento)) > 0),
  fecha         date,
  valor         numeric(18, 2) not null default 0 check (valor >= 0),
  compra_id     bigint references public.compras (id),
  unique (contrasena_id, linea)
);
create index if not exists contrasena_documentos_compra_idx on public.contrasena_documentos (compra_id) where compra_id is not null;

create or replace function public.preparar_contrasena() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_proceso boolean := current_setting('fin.contrasena', true) = 'si';
  p public.proveedores;
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4813, new.localidad_id::integer);
    new.numero := greatest(coalesce((select max(numero) from public.contrasenas_pago where localidad_id = new.localidad_id), 0),
                           coalesce((select max(contrasena) from public.compras where localidad_id = new.localidad_id), 0)) + 1;
    new.usuario := v_quien; new.fecha := now();
    if not v_proceso then new.estado := 'PENDIENTE'; end if;
  else
    new.organizacion_id := old.organizacion_id; new.localidad_id := old.localidad_id; new.numero := old.numero;
    new.usuario := old.usuario; new.fecha := old.fecha;
    if not v_proceso then
      if old.estado <> 'PENDIENTE' then raise exception 'La contraseña % está %: ya no se modifica.', old.numero, lower(old.estado); end if;
      new.estado := old.estado;
    end if;
  end if;
  if new.proveedor_id is not null then
    select * into p from public.proveedores where id = new.proveedor_id;
    if p.localidad_id <> new.localidad_id then raise exception 'El proveedor no es de la localidad de la contraseña.'; end if;
    new.proveedor_codigo := p.codigo::text; new.proveedor_nombre := coalesce(p.nombre_fiscal, p.nombre_comercial); new.nit := p.nit;
  end if;
  new.proveedor_nombre := upper(trim(new.proveedor_nombre));
  if new.tipo_compra = 'INMEDIATO' then new.dias_credito := 0; end if;
  new.fecha_pago := coalesce(new.fecha_pago, (new.fecha at time zone 'America/Guatemala')::date + new.dias_credito);
  new.observaciones := nullif(trim(new.observaciones), '');
  return new;
end;
$$;
drop trigger if exists contrasenas_pago_preparar on public.contrasenas_pago;
create trigger contrasenas_pago_preparar before insert or update on public.contrasenas_pago for each row execute function public.preparar_contrasena();
drop trigger if exists contrasenas_pago_auditar on public.contrasenas_pago;
create trigger contrasenas_pago_auditar before insert or update on public.contrasenas_pago for each row execute function public.auditar();

-- Documento recibido: si es una compra registrada, trae sus datos y la deja en la contraseña.
create or replace function public.preparar_contrasena_documento() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  k public.contrasenas_pago;
  c public.compras_saldo;
  v_otra integer;
begin
  select * into k from public.contrasenas_pago where id = coalesce(new.contrasena_id, old.contrasena_id);
  if current_setting('fin.contrasena', true) is distinct from 'si' and k.estado <> 'PENDIENTE' then
    raise exception 'La contraseña % está %: sus documentos no cambian.', k.numero, lower(k.estado);
  end if;
  if tg_op = 'DELETE' then
    update public.compras set contrasena_id = null, contrasena = null, contrasena_fecha = null where id = old.compra_id and contrasena_id = old.contrasena_id;
    return old;
  end if;
  if new.compra_id is not null then
    select * into c from public.compras_saldo where id = new.compra_id;
    if c.localidad_id <> k.localidad_id then raise exception 'La compra no es de la localidad de la contraseña.'; end if;
    if c.estado = 'ANULADA' then raise exception 'La compra % está anulada.', c.numero; end if;
    if k.proveedor_id is not null and c.proveedor_id is not null and c.proveedor_id <> k.proveedor_id then
      raise exception 'La compra % es de otro proveedor.', c.numero;
    end if;
    select x.numero into v_otra from public.contrasena_documentos d join public.contrasenas_pago x on x.id = d.contrasena_id
    where d.compra_id = new.compra_id and x.estado <> 'ANULADA' and d.id is distinct from new.id limit 1;
    if v_otra is not null then raise exception 'La compra % ya está en la contraseña %.', c.numero, v_otra; end if;
    new.serie := c.serie; new.documento := c.documento; new.fecha := c.fecha_documento; new.valor := c.neto;
  end if;
  new.serie := nullif(upper(trim(new.serie)), '');
  new.documento := upper(trim(new.documento));
  return new;
end;
$$;
drop trigger if exists contrasena_documentos_preparar on public.contrasena_documentos;
create trigger contrasena_documentos_preparar before insert or update or delete on public.contrasena_documentos for each row execute function public.preparar_contrasena_documento();

create or replace function public.enlazar_contrasena_documento() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k public.contrasenas_pago;
begin
  select * into k from public.contrasenas_pago where id = new.contrasena_id;
  if tg_op = 'UPDATE' and old.compra_id is not null and old.compra_id is distinct from new.compra_id then
    update public.compras set contrasena_id = null, contrasena = null, contrasena_fecha = null where id = old.compra_id and contrasena_id = new.contrasena_id;
  end if;
  if new.compra_id is not null then
    update public.compras set contrasena_id = k.id, contrasena = k.numero, contrasena_fecha = (k.fecha at time zone 'America/Guatemala')::date where id = new.compra_id;
  end if;
  return null;
end;
$$;
drop trigger if exists contrasena_documentos_enlazar on public.contrasena_documentos;
create trigger contrasena_documentos_enlazar after insert or update on public.contrasena_documentos for each row execute function public.enlazar_contrasena_documento();

-- Al registrar una compra que ya se recibió en una contraseña, se enlaza sola.
create or replace function public.enlazar_compra_contrasena() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- También en contraseñas ya autorizadas: solo se completa el enlace del documento recibido.
  perform set_config('fin.contrasena', 'si', true);
  update public.contrasena_documentos d set compra_id = new.id
  from public.contrasenas_pago k
  where k.id = d.contrasena_id and k.localidad_id = new.localidad_id and k.estado in ('PENDIENTE', 'AUTORIZADA')
    and d.compra_id is null and d.documento = new.documento and coalesce(d.serie, '') = coalesce(new.serie, '')
    and (k.proveedor_id = new.proveedor_id or (k.nit is not null and k.nit = new.nit))
    and d.id = (select min(d2.id) from public.contrasena_documentos d2 join public.contrasenas_pago k2 on k2.id = d2.contrasena_id
                where k2.localidad_id = new.localidad_id and k2.estado in ('PENDIENTE', 'AUTORIZADA') and d2.compra_id is null
                  and d2.documento = new.documento and coalesce(d2.serie, '') = coalesce(new.serie, '')
                  and (k2.proveedor_id = new.proveedor_id or (k2.nit is not null and k2.nit = new.nit)));
  perform set_config('fin.contrasena', '', true);
  return null;
end;
$$;
drop trigger if exists compras_enlazar_contrasena on public.compras;
create trigger compras_enlazar_contrasena after insert on public.compras for each row execute function public.enlazar_compra_contrasena();

create or replace function public.procesar_contrasena(p_id bigint, p_accion text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k public.contrasenas_pago;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v_docs integer; v_pend integer;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede procesar contraseñas de pago.'; end if;
  select * into k from public.contrasenas_pago where id = p_id for update;
  if k.id is null then raise exception 'La contraseña no existe.'; end if;
  perform set_config('fin.contrasena', 'si', true);
  select count(*), count(*) filter (where d.compra_id is null or s.pendiente > 0) into v_docs, v_pend
  from public.contrasena_documentos d left join public.compras_saldo s on s.id = d.compra_id where d.contrasena_id = k.id;
  if p_accion = 'AUTORIZAR' then
    if k.estado <> 'PENDIENTE' then raise exception 'Solo se autoriza una contraseña pendiente.'; end if;
    if v_docs = 0 then raise exception 'La contraseña % no tiene documentos.', k.numero; end if;
    update public.contrasenas_pago set estado = 'AUTORIZADA', autorizado_por = v_quien, autorizado_en = now() where id = k.id;
  elsif p_accion = 'LIQUIDAR' then
    if k.estado <> 'AUTORIZADA' then raise exception 'Solo se liquida una contraseña autorizada.'; end if;
    if v_pend > 0 then raise exception 'La contraseña % tiene % documento(s) sin registrar o sin pagar.', k.numero, v_pend; end if;
    update public.contrasenas_pago set estado = 'LIQUIDADA', liquidado_por = v_quien, liquidado_en = now() where id = k.id;
  elsif p_accion = 'REABRIR' then
    if k.estado not in ('AUTORIZADA', 'LIQUIDADA') then raise exception 'Solo se reabre una contraseña autorizada o liquidada.'; end if;
    update public.contrasenas_pago set estado = 'PENDIENTE', autorizado_por = null, autorizado_en = null, liquidado_por = null, liquidado_en = null where id = k.id;
  elsif p_accion = 'ANULAR' then
    if k.estado = 'ANULADA' then raise exception 'La contraseña % ya está anulada.', k.numero; end if;
    if k.estado = 'LIQUIDADA' then raise exception 'La contraseña % ya está liquidada.', k.numero; end if;
    if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo de la anulación.'; end if;
    update public.contrasenas_pago set estado = 'ANULADA', anulado_por = v_quien, anulado_en = now(), motivo_anulacion = trim(p_motivo) where id = k.id;
    update public.compras set contrasena_id = null, contrasena = null, contrasena_fecha = null where contrasena_id = k.id;
  else
    raise exception 'Acción no válida.';
  end if;
  perform set_config('fin.contrasena', '', true);
  return jsonb_build_object('numero', k.numero);
end;
$$;

create or replace function public.liquidar_contrasenas(p_loc bigint) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
  v integer;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede liquidar contraseñas de pago.'; end if;
  perform set_config('fin.contrasena', 'si', true);
  update public.contrasenas_pago k set estado = 'LIQUIDADA', liquidado_por = v_quien, liquidado_en = now()
  where k.localidad_id = p_loc and k.estado = 'AUTORIZADA'
    and exists (select 1 from public.contrasena_documentos d where d.contrasena_id = k.id)
    and not exists (select 1 from public.contrasena_documentos d left join public.compras_saldo s on s.id = d.compra_id
                    where d.contrasena_id = k.id and (d.compra_id is null or s.pendiente > 0));
  get diagnostics v = row_count;
  perform set_config('fin.contrasena', '', true);
  return v;
end;
$$;

-- «Crear» contraseña desde Facturas de compra: una contraseña con esa sola compra.
create or replace function public.crear_contrasena_compra(p_id bigint) returns integer
language plpgsql security definer set search_path = '' as $$
declare c public.compras; v_id bigint;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede crear contraseñas de pago.'; end if;
  select * into c from public.compras where id = p_id for update;
  if c.id is null then raise exception 'La compra no existe.'; end if;
  if c.contrasena is not null then return c.contrasena; end if;
  if c.estado = 'ANULADA' then raise exception 'La compra % está anulada.', c.numero; end if;
  insert into public.contrasenas_pago (organizacion_id, localidad_id, numero, proveedor_id, proveedor_codigo, proveedor_nombre, nit, tipo_compra, dias_credito, fecha_pago)
  values (c.organizacion_id, c.localidad_id, 0, c.proveedor_id, c.proveedor_codigo, c.proveedor_nombre, c.nit,
          case when c.pago_inmediato or c.dias_credito = 0 then 'INMEDIATO' else 'CRÉDITO' end, c.dias_credito, c.fecha_vencimiento)
  returning id into v_id;
  insert into public.contrasena_documentos (contrasena_id, linea, documento, compra_id) values (v_id, 1, c.documento, c.id);
  return (select numero from public.contrasenas_pago where id = v_id);
end;
$$;

-- Las contraseñas que ya se crearon por compra (script 57) pasan a ser contraseñas de pago.
do $$
declare c record; v_id bigint;
begin
  for c in select * from public.compras where contrasena is not null and contrasena_id is null order by localidad_id, contrasena loop
    if not exists (select 1 from public.contrasenas_pago where localidad_id = c.localidad_id and numero = c.contrasena) then
      perform set_config('fin.contrasena', 'si', true);
      set local session_replication_role = replica;
      insert into public.contrasenas_pago (organizacion_id, localidad_id, numero, fecha, usuario, proveedor_id, proveedor_codigo, proveedor_nombre, nit, tipo_compra, dias_credito, fecha_pago, estado)
      values (c.organizacion_id, c.localidad_id, c.contrasena, (coalesce(c.contrasena_fecha, current_date)::timestamp + interval '12 hours') at time zone 'America/Guatemala', c.usuario, c.proveedor_id, c.proveedor_codigo, c.proveedor_nombre, c.nit,
              case when c.dias_credito = 0 then 'INMEDIATO' else 'CRÉDITO' end, c.dias_credito, c.fecha_vencimiento, 'PENDIENTE')
      returning id into v_id;
      insert into public.contrasena_documentos (contrasena_id, linea, serie, documento, fecha, valor, compra_id)
      values (v_id, 1, c.serie, c.documento, c.fecha_documento, c.valor_total - c.bonificaciones - c.notas_credito - c.descuentos_nd, c.id);
      update public.compras set contrasena_id = v_id where id = c.id;
      set local session_replication_role = origin;
      perform set_config('fin.contrasena', '', true);
    end if;
  end loop;
end;
$$;

-- La vista del saldo se vuelve a crear para incluir las columnas nuevas de compras.
drop view if exists public.compras_saldo;
create view public.compras_saldo with (security_invoker = true) as
  select c.*,
         c.valor_total - c.bonificaciones - c.notas_credito - c.descuentos_nd as neto,
         coalesce(p.pagado, 0) as pagado,
         c.valor_total - c.bonificaciones - c.notas_credito - c.descuentos_nd - coalesce(p.pagado, 0) as pendiente,
         coalesce(p.pagos, 0) as pagos,
         p.ultimo_pago
  from public.compras c
  left join lateral (
    select sum(d.abono_compra) as pagado, count(*) as pagos,
           string_agg(case when m.tipo = 'CHEQUE' then 'CH ' else 'TRF ' end || coalesce(m.numero_documento, m.folio::text), ', ' order by m.fecha, m.id) as ultimo_pago
    from public.movimiento_documentos d join public.movimientos_bancarios m on m.id = d.movimiento_id and m.estado = 'ACTIVO'
    where d.compra_id = c.id) p on true;
grant select on public.compras_saldo to authenticated;

-- ---------- Seguridad ----------
do $$
declare t text;
begin
  foreach t in array array['clasificaciones_compra', 'tipos_documento_compra', 'contrasenas_pago', 'contrasena_documentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format('drop policy if exists "%s: modificar" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end;
$$;
drop policy if exists "contrasena_documentos: quitar" on public.contrasena_documentos;
create policy "contrasena_documentos: quitar" on public.contrasena_documentos for delete to authenticated using (public.puede_editar_catalogos());
grant delete on public.contrasena_documentos to authenticated;

revoke execute on function public.preparar_catalogo_compra() from public, anon, authenticated;
revoke execute on function public.preparar_contrasena() from public, anon, authenticated;
revoke execute on function public.preparar_contrasena_documento() from public, anon, authenticated;
revoke execute on function public.enlazar_contrasena_documento() from public, anon, authenticated;
revoke execute on function public.enlazar_compra_contrasena() from public, anon, authenticated;
revoke execute on function public.procesar_contrasena(bigint, text, text) from public, anon;
revoke execute on function public.liquidar_contrasenas(bigint) from public, anon;
grant execute on function public.procesar_contrasena(bigint, text, text) to authenticated;
grant execute on function public.liquidar_contrasenas(bigint) to authenticated;

-- ---------- Menú: Compras · Registros ----------
insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
select m.id, 'registros', 'Compras', x.clave, x.nombre, coalesce((select max(orden) from public.opciones_sistema), 0) + x.n
from public.modulos_sistema m
cross join (values (1, 'clasificaciones-compra', 'Clasificación compras'), (2, 'tipos-documento-compra', 'Tipo documento'),
                   (3, 'contrasenas-pago', 'Contraseñas de pago')) as x (n, clave, nombre)
where m.siglas = 'COM' and m.modulo_mayor_id is null
  and not exists (select 1 from public.opciones_sistema o where o.clave = x.clave and o.modulo_id = m.id);

notify pgrst, 'reload schema';
