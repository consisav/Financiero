-- Facturación/Ventas · Catálogos · Clientes de cada organización y localidad (empresa).
--   clientes: número (correlativo o el que se escriba), tipo de documento (NIT, CUI, pasaporte,
--   extranjero o consumidor final), documento, nombre, razón social, estado, tipo de cliente,
--   contacto, teléfono y correo, vendedor, tipo de precio, bodega y modo de entrega, la ubicación
--   (país, departamento, municipio, código postal y dirección), si se factura con detalle, el crédito
--   (forma de pago, días y monto máximo) y los datos de exportación (país, consignatario, dirección en
--   el exterior, código del comprador e incoterm).
--   El crédito solo cambia con cambiar_credito_cliente («Modificar crédito cliente»), que lo deja en
--   cliente_creditos con el usuario, la fecha y el motivo.
-- Escribir: administrador. Se ejecuta después del script 59.

create table if not exists public.clientes (
  id                   bigint generated always as identity primary key,
  organizacion_id      bigint not null references public.organizaciones (id),
  localidad_id         bigint not null,
  codigo               integer not null check (codigo > 0),
  tipo_documento       text not null default 'NIT' check (tipo_documento in ('NIT', 'CUI', 'PASAPORTE', 'EXTRANJERO', 'CF')),
  documento            text not null check (length(trim(documento)) > 0),
  nombre               text not null check (length(trim(nombre)) > 0),
  razon_social         text,
  estado               text not null default 'ACTIVO' check (estado in ('ACTIVO', 'INACTIVO', 'BLOQUEADO')),
  tipo_cliente         text not null default 'LOCAL' check (tipo_cliente in ('LOCAL', 'EXPORTACIÓN', 'GOBIERNO', 'RELACIONADO', 'EMPLEADO')),
  contacto             text,
  telefono             text,
  correo               text,
  vendedor_id          bigint references public.vendedores (id),
  tipo_precio_id       bigint references public.tipos_precio (id),
  bodega_id            bigint references public.bodegas (id),
  modo_entrega         text not null default 'OFICINA' check (modo_entrega in ('OFICINA', 'RUTA', 'MENSAJERÍA', 'GUATEX', 'CARGO EXPRESO', 'OTRO')),
  aplicar_detalle      boolean not null default true,
  pais_id              bigint references public.paises (id),
  departamento_id      bigint references public.departamentos (id),
  municipio_id         bigint references public.municipios (id),
  codigo_postal        text,
  direccion            text,
  forma_pago           text not null default 'CONTADO' check (forma_pago in ('CONTADO', 'CRÉDITO')),
  dias_credito         integer not null default 0 check (dias_credito between 0 and 365),
  monto_credito        numeric(18, 2) not null default 0 check (monto_credito >= 0),
  exp_pais_id          bigint references public.paises (id),
  exp_consignatario    text,
  exp_direccion        text,
  exp_codigo_comprador text,
  exp_incoterm         text check (exp_incoterm in ('EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP')),
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, codigo)
);
create unique index if not exists clientes_documento_key on public.clientes (localidad_id, tipo_documento, documento) where tipo_documento <> 'CF';
create index if not exists clientes_nombre_idx on public.clientes (localidad_id, nombre);

create table if not exists public.cliente_creditos (
  id                bigint generated always as identity primary key,
  cliente_id        bigint not null references public.clientes (id) on delete cascade,
  fecha             timestamptz not null default now(),
  usuario           text,
  forma_anterior    text, dias_anterior integer, monto_anterior numeric(18, 2),
  forma_pago        text not null, dias_credito integer not null, monto_credito numeric(18, 2) not null,
  motivo            text not null
);
create index if not exists cliente_creditos_cliente_idx on public.cliente_creditos (cliente_id, fecha desc);

create or replace function public.preparar_cliente() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.codigo is null or new.codigo <= 0 then
      perform pg_advisory_xact_lock(4817, new.localidad_id::integer);
      new.codigo := coalesce((select max(codigo) from public.clientes where localidad_id = new.localidad_id), 0) + 1;
    end if;
  else
    new.organizacion_id := old.organizacion_id; new.localidad_id := old.localidad_id;
    -- El crédito cambia solo con «Modificar crédito cliente».
    if current_setting('fin.credito', true) is distinct from 'si' then
      new.forma_pago := old.forma_pago; new.dias_credito := old.dias_credito; new.monto_credito := old.monto_credito;
    end if;
  end if;
  if new.forma_pago = 'CONTADO' then new.dias_credito := 0; new.monto_credito := 0; end if;
  if (new.vendedor_id is not null and not exists (select 1 from public.vendedores x where x.id = new.vendedor_id and x.localidad_id = new.localidad_id))
     or (new.tipo_precio_id is not null and not exists (select 1 from public.tipos_precio x where x.id = new.tipo_precio_id and x.localidad_id = new.localidad_id))
     or (new.bodega_id is not null and not exists (select 1 from public.bodegas x where x.id = new.bodega_id and x.localidad_id = new.localidad_id)) then
    raise exception 'El vendedor, el tipo de precio y la bodega del cliente deben ser de la localidad.';
  end if;
  if new.tipo_documento = 'CF' then new.documento := 'CF'; end if;
  new.documento := upper(replace(trim(new.documento), ' ', ''));
  new.nombre := upper(trim(new.nombre));
  new.razon_social := coalesce(nullif(upper(trim(new.razon_social)), ''), new.nombre);
  new.contacto := nullif(upper(trim(new.contacto)), '');
  new.correo := nullif(lower(trim(new.correo)), '');
  new.direccion := nullif(upper(trim(new.direccion)), '');
  new.codigo_postal := nullif(trim(new.codigo_postal), '');
  new.exp_consignatario := nullif(upper(trim(new.exp_consignatario)), '');
  new.exp_direccion := nullif(upper(trim(new.exp_direccion)), '');
  new.exp_codigo_comprador := nullif(upper(trim(new.exp_codigo_comprador)), '');
  return new;
end;
$$;
drop trigger if exists clientes_preparar on public.clientes;
create trigger clientes_preparar before insert or update on public.clientes for each row execute function public.preparar_cliente();
drop trigger if exists clientes_auditar on public.clientes;
create trigger clientes_auditar before insert or update on public.clientes for each row execute function public.auditar();

-- Modificar el crédito del cliente, con su motivo en el historial.
create or replace function public.cambiar_credito_cliente(p_id bigint, p_forma text, p_dias integer, p_monto numeric, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.clientes;
  v_quien text := coalesce((select upper(x.usuario) from public.perfiles x where x.id = (select auth.uid())), 'SISTEMA');
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede modificar el crédito de los clientes.'; end if;
  select * into c from public.clientes where id = p_id for update;
  if c.id is null then raise exception 'El cliente no existe.'; end if;
  if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo del cambio de crédito.'; end if;
  if p_forma not in ('CONTADO', 'CRÉDITO') then raise exception 'Forma de pago no válida.'; end if;
  if p_forma = 'CRÉDITO' and (coalesce(p_dias, 0) <= 0 or coalesce(p_monto, 0) <= 0) then raise exception 'Para dar crédito escribe los días y el monto máximo.'; end if;
  perform set_config('fin.credito', 'si', true);
  update public.clientes set forma_pago = p_forma, dias_credito = coalesce(p_dias, 0), monto_credito = coalesce(p_monto, 0) where id = c.id;
  perform set_config('fin.credito', '', true);
  insert into public.cliente_creditos (cliente_id, usuario, forma_anterior, dias_anterior, monto_anterior, forma_pago, dias_credito, monto_credito, motivo)
  select c.id, v_quien, c.forma_pago, c.dias_credito, c.monto_credito, x.forma_pago, x.dias_credito, x.monto_credito, trim(p_motivo) from public.clientes x where x.id = c.id;
  return jsonb_build_object('codigo', c.codigo);
end;
$$;

-- ---------- Seguridad ----------
alter table public.clientes enable row level security;
alter table public.cliente_creditos enable row level security;
drop policy if exists "clientes: leer" on public.clientes;
drop policy if exists "clientes: crear" on public.clientes;
drop policy if exists "clientes: modificar" on public.clientes;
drop policy if exists "cliente_creditos: leer" on public.cliente_creditos;
create policy "clientes: leer" on public.clientes for select to authenticated using (public.usuario_activo());
create policy "clientes: crear" on public.clientes for insert to authenticated with check (public.puede_editar_catalogos());
create policy "clientes: modificar" on public.clientes for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());
create policy "cliente_creditos: leer" on public.cliente_creditos for select to authenticated using (public.usuario_activo());
grant select, insert, update on public.clientes to authenticated;
grant select on public.cliente_creditos to authenticated;
revoke execute on function public.preparar_cliente() from public, anon, authenticated;
revoke execute on function public.cambiar_credito_cliente(bigint, text, integer, numeric, text) from public, anon;
grant execute on function public.cambiar_credito_cliente(bigint, text, integer, numeric, text) to authenticated;

-- ---------- Menú: Clientes pasa al subgrupo Ventas ----------
update public.opciones_sistema o set subgrupo = 'Ventas'
from public.modulos_sistema m
where m.id = o.modulo_id and m.siglas = 'FAC' and m.modulo_mayor_id is null and o.clave = 'clientes';

notify pgrst, 'reload schema';
