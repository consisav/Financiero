-- Facturación/Ventas: catálogos «Series Recibos» y «Correlativo - DTE»; mantenimientos «Envíos», «Administración de
-- Contraseñas Cobros», «Despachos», «Retenciones» y «Exenciones». Se ejecuta después de los scripts 133 y 134.
--   series_recibo: series de los recibos (recibo inicial, principal, tipo RECIBO / RETENCIÓN / EXENCIÓN, si se muestra
--   en la lista). Se llenan con las series que ya tienen los recibos de cada empresa.
--   correlativos_dte: correlativo interno de las facturas (FE) y de las notas de crédito (NC) de cada empresa. Una
--   factura nueva toma FE-(correlativo + 1) como número interno (facturas_venta.no_interno) y una nota nueva, NC-(n + 1).
--   Se inicia con el último FE de las facturas migradas y el último NC de las notas.
--   recibos_venta.clase: RECIBO, RETENCIÓN (serie RET) o EXENCIÓN (serie EXE): Retenciones y Exenciones usan la misma
--   pantalla de Recibos.
--   envios_venta y envio_venta_lineas: envíos de productos a un cliente.
--   contrasenas_cobro y contrasena_cobro_lineas: recepción de facturas por el cliente (contraseña de cobro); al
--   guardarla, cada factura toma la contraseña y la fecha estimada de cobro.
--   Despachos: estado de despacho de la factura (PENDIENTE, DESPACHADO, ENTREGADO), quién imprimió, despachó y entregó,
--   mensajero y datos del envío. Las migradas toman los del sistema anterior (P = pendiente, E = entregado, I = despachado).
-- Puede ejecutarse de nuevo.

do $$
begin
  if to_regclass('public.recibos_venta') is null or to_regclass('public.notas_venta') is null then
    raise exception 'Faltan los scripts 132 a 134 (recibos y notas electrónicas).';
  end if;
end;
$$;

-- ---------- Series de recibos ----------
create table if not exists public.series_recibo (
  id               bigint generated always as identity primary key,
  organizacion_id  bigint not null references public.organizaciones(id),
  localidad_id     bigint not null references public.localidades(id),
  serie            text not null,
  recibo_inicial   bigint not null default 1,
  principal        boolean not null default false,
  tipo             text not null default 'RECIBO' check (tipo in ('RECIBO', 'RETENCIÓN', 'EXENCIÓN')),
  mostrar          boolean not null default true,
  unique (localidad_id, serie)
);
insert into public.series_recibo (organizacion_id, localidad_id, serie, tipo, principal)
select r.organizacion_id, r.localidad_id, upper(trim(r.serie)),
  case when upper(trim(r.serie)) = 'RET' then 'RETENCIÓN' when upper(trim(r.serie)) = 'EXE' then 'EXENCIÓN' else 'RECIBO' end, upper(trim(r.serie)) = 'DIG'
from public.recibos_venta r where r.serie ~ '[A-Za-z0-9]'
group by r.organizacion_id, r.localidad_id, upper(trim(r.serie))
on conflict (localidad_id, serie) do nothing;
insert into public.series_recibo (organizacion_id, localidad_id, serie, tipo)
select l.organizacion_id, l.id, x.serie, x.tipo from public.localidades l
cross join (values ('RET', 'RETENCIÓN'), ('EXE', 'EXENCIÓN')) as x(serie, tipo)
where exists (select 1 from public.recibos_venta r where r.localidad_id = l.id)
on conflict (localidad_id, serie) do nothing;

-- ---------- Correlativo interno de los DTE ----------
create table if not exists public.correlativos_dte (
  id               bigint generated always as identity primary key,
  organizacion_id  bigint not null references public.organizaciones(id),
  localidad_id     bigint not null references public.localidades(id),
  documento        integer not null check (documento > 0),
  descripcion      text not null,
  serie            text not null,
  correlativo      bigint not null default 0,
  unique (localidad_id, documento)
);
alter table public.facturas_venta add column if not exists no_interno text;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'facturas_venta' and column_name = 'no_interno_anterior') then
    alter table public.facturas_venta disable trigger user;
    -- Si dos facturas traen el mismo número interno, solo la primera lo toma.
    update public.facturas_venta f set no_interno = x.ni from (
      select id, upper(trim(no_interno_anterior)) ni, row_number() over (partition by localidad_id, upper(trim(no_interno_anterior)) order by id) k
      from public.facturas_venta where no_interno is null and no_interno_anterior ~* '^[a-z]+-\d+$') x
    where f.id = x.id and x.k = 1 and not exists (select 1 from public.facturas_venta y where y.localidad_id = f.localidad_id and y.no_interno = x.ni);
    alter table public.facturas_venta enable trigger user;
  end if;
end;
$$;
insert into public.correlativos_dte (organizacion_id, localidad_id, documento, descripcion, serie, correlativo)
select l.organizacion_id, l.id, 1, 'FACTURAS', 'FE',
  coalesce((select max(nullif(regexp_replace(f.no_interno, '\D', '', 'g'), '')::bigint) from public.facturas_venta f where f.localidad_id = l.id and f.no_interno like 'FE-%'), 0)
from public.localidades l where exists (select 1 from public.facturas_venta f where f.localidad_id = l.id)
on conflict (localidad_id, documento) do nothing;
insert into public.correlativos_dte (organizacion_id, localidad_id, documento, descripcion, serie, correlativo)
select l.organizacion_id, l.id, 2, 'NOTAS DE CREDITO', 'NC', coalesce((select max(n.numero) from public.notas_venta n where n.localidad_id = l.id), 0)
from public.localidades l where exists (select 1 from public.facturas_venta f where f.localidad_id = l.id)
on conflict (localidad_id, documento) do nothing;
create unique index if not exists facturas_venta_no_interno on public.facturas_venta (localidad_id, no_interno) where no_interno is not null;

-- Factura nueva: número interno FE-n del correlativo de su empresa.
create or replace function public.asignar_no_interno_factura() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_serie text; v_n bigint;
begin
  if new.no_interno is null and new.origen_anterior is null then
    update public.correlativos_dte set correlativo = correlativo + 1 where localidad_id = new.localidad_id and documento = 1 returning serie, correlativo into v_serie, v_n;
    if v_n is not null then
      while exists (select 1 from public.facturas_venta where localidad_id = new.localidad_id and no_interno = v_serie || '-' || v_n) loop
        v_n := v_n + 1;
        update public.correlativos_dte set correlativo = v_n where localidad_id = new.localidad_id and documento = 1;
      end loop;
      new.no_interno := v_serie || '-' || v_n;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists facturas_venta_no_interno on public.facturas_venta;
create trigger facturas_venta_no_interno before insert on public.facturas_venta for each row execute function public.asignar_no_interno_factura();

-- Nota nueva: NC-n del correlativo de su empresa (sin chocar con las existentes).
create or replace function public.preparar_nota_venta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_n bigint;
begin
  if tg_op = 'INSERT' and new.numero is null then
    perform pg_advisory_xact_lock(hashtext('notas_venta'), new.localidad_id::int);
    select greatest(coalesce((select correlativo from public.correlativos_dte where localidad_id = new.localidad_id and documento = 2), 0),
                    coalesce((select max(numero) from public.notas_venta where localidad_id = new.localidad_id), 0)) + 1 into v_n;
    new.numero := v_n;
    update public.correlativos_dte set correlativo = v_n where localidad_id = new.localidad_id and documento = 2;
  end if;
  new.nombre := upper(trim(new.nombre));
  new.nit := nullif(upper(replace(trim(new.nit), ' ', '')), '');
  new.serie := nullif(upper(trim(new.serie)), '');
  new.estado := case when new.estado = 'ANULADA' then 'ANULADA' when nullif(trim(new.autorizacion), '') is not null then 'CERTIFICADA' else 'EMITIDA' end;
  return new;
end;
$$;

-- ---------- Retenciones y exenciones (clase del recibo) ----------
alter table public.recibos_venta add column if not exists clase text not null default 'RECIBO';
alter table public.recibos_venta drop constraint if exists recibos_venta_clase_check;
alter table public.recibos_venta add constraint recibos_venta_clase_check check (clase in ('RECIBO', 'RETENCIÓN', 'EXENCIÓN'));
update public.recibos_venta set clase = case upper(trim(serie)) when 'RET' then 'RETENCIÓN' when 'EXE' then 'EXENCIÓN' else 'RECIBO' end
where clase = 'RECIBO' and upper(trim(serie)) in ('RET', 'EXE');

-- ---------- Despachos ----------
alter table public.facturas_venta add column if not exists estado_despacho text not null default 'PENDIENTE';
alter table public.facturas_venta drop constraint if exists facturas_venta_estado_despacho_check;
alter table public.facturas_venta add constraint facturas_venta_estado_despacho_check check (estado_despacho in ('PENDIENTE', 'DESPACHADO', 'ENTREGADO'));
alter table public.facturas_venta add column if not exists despacho_impreso_por text;
alter table public.facturas_venta add column if not exists despacho_impreso_en timestamptz;
alter table public.facturas_venta add column if not exists despachado_por text;
alter table public.facturas_venta add column if not exists despachado_en timestamptz;
alter table public.facturas_venta add column if not exists entregado_por text;
alter table public.facturas_venta add column if not exists entregado_en timestamptz;
alter table public.facturas_venta add column if not exists mensajero_nombre text;
alter table public.facturas_venta add column if not exists mensajero_dpi text;
alter table public.facturas_venta add column if not exists envio_nombre text;
alter table public.facturas_venta add column if not exists envio_direccion text;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'facturas_venta' and column_name = 'estado_despacho_anterior') then
    perform set_config('fin.factura', 'si', true);
    alter table public.facturas_venta disable trigger user;
    update public.facturas_venta set
      estado_despacho = case estado_despacho_anterior when 'E' then 'ENTREGADO' when 'I' then 'DESPACHADO' else 'PENDIENTE' end,
      mensajero_nombre = coalesce(mensajero_nombre, mensajero_nombre_anterior), mensajero_dpi = coalesce(mensajero_dpi, mensajero_dpi_anterior),
      envio_nombre = coalesce(envio_nombre, repenvio_nombre_anterior), envio_direccion = coalesce(envio_direccion, repenvio_direccion_anterior),
      despacho_impreso_por = coalesce(despacho_impreso_por, usuario_imprime_anterior), despacho_impreso_en = coalesce(despacho_impreso_en, fecha_imprime_anterior at time zone 'America/Guatemala')
    where origen_anterior = 'MIGRADO' and estado_despacho = 'PENDIENTE' and despachado_en is null and entregado_en is null;
    alter table public.facturas_venta enable trigger user;
    perform set_config('fin.factura', '', true);
  end if;
end;
$$;
create index if not exists facturas_venta_despacho on public.facturas_venta (localidad_id, estado_despacho, fecha_emision);

-- ---------- Envíos ----------
create table if not exists public.envios_venta (
  id               bigint generated always as identity primary key,
  organizacion_id  bigint not null references public.organizaciones(id),
  localidad_id     bigint not null references public.localidades(id),
  numero           integer,
  fecha            date not null default current_date,
  estado           text not null default 'EMITIDO' check (estado in ('EMITIDO', 'ANULADO')),
  bodega_id        bigint references public.bodegas(id) on delete set null,
  cliente_id       bigint references public.clientes(id) on delete set null,
  cliente_codigo   text,
  nombre           text not null,
  nit              text,
  telefono         text,
  contacto         text,
  direccion        text,
  forma_pago       text not null default 'CONTADO' check (forma_pago in ('CONTADO', 'CRÉDITO')),
  dias_credito     integer not null default 0,
  tipo_precio_id   bigint references public.tipos_precio(id) on delete set null,
  fecha_cobro      date,
  factura_id       bigint references public.facturas_venta(id) on delete set null,
  total            numeric(18, 2) not null default 0,
  observaciones    text,
  usuario          text,
  anulado_por      text,
  anulado_en       timestamptz,
  creado_en        timestamptz not null default now()
);
create unique index if not exists envios_venta_numero on public.envios_venta (localidad_id, numero) where numero is not null;
create table if not exists public.envio_venta_lineas (
  id                 bigint generated always as identity primary key,
  envio_id           bigint not null references public.envios_venta(id) on delete cascade,
  linea              integer not null check (linea > 0),
  producto_id        bigint references public.productos(id) on delete set null,
  producto_codigo    text,
  descripcion        text not null,
  cantidad           numeric(18, 4) not null default 1 check (cantidad > 0),
  precio             numeric(18, 6) not null default 0,
  total              numeric(18, 2) not null default 0,
  unidad_medida      text,
  lote               text,
  registro_sanitario text,
  fecha_vencimiento  date,
  fecha_fabricacion  date,
  unique (envio_id, linea)
);

-- ---------- Contraseñas de cobro ----------
create table if not exists public.contrasenas_cobro (
  id               bigint generated always as identity primary key,
  organizacion_id  bigint not null references public.organizaciones(id),
  localidad_id     bigint not null references public.localidades(id),
  numero           integer,
  fecha            timestamptz not null default now(),
  estado           text not null default 'EMITIDA' check (estado in ('EMITIDA', 'AUTORIZADA', 'ANULADA')),
  cliente_id       bigint references public.clientes(id) on delete set null,
  cliente_codigo   text,
  nombre           text not null,
  dias_credito     integer not null default 0,
  fecha_cobro      date,
  valor            numeric(18, 2) not null default 0,
  observaciones    text,
  usuario          text,
  autorizada_por   text,
  autorizada_en    timestamptz,
  creado_en        timestamptz not null default now()
);
create unique index if not exists contrasenas_cobro_numero on public.contrasenas_cobro (localidad_id, numero) where numero is not null;
create table if not exists public.contrasena_cobro_lineas (
  id              bigint generated always as identity primary key,
  contrasena_id   bigint not null references public.contrasenas_cobro(id) on delete cascade,
  linea           integer not null check (linea > 0),
  factura_id      bigint not null references public.facturas_venta(id) on delete cascade,
  valor           numeric(18, 2) not null default 0,
  observaciones   text,
  unique (contrasena_id, factura_id)
);

-- Número siguiente de la empresa y total de envíos y contraseñas.
create or replace function public.numerar_documento_venta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.numero is null then
    perform pg_advisory_xact_lock(hashtext(tg_table_name), new.localidad_id::int);
    execute format('select coalesce(max(numero), 0) + 1 from public.%I where localidad_id = $1', tg_table_name) into new.numero using new.localidad_id;
  end if;
  new.nombre := upper(trim(new.nombre));
  return new;
end;
$$;
drop trigger if exists envios_venta_numerar on public.envios_venta;
create trigger envios_venta_numerar before insert or update on public.envios_venta for each row execute function public.numerar_documento_venta();
drop trigger if exists contrasenas_cobro_numerar on public.contrasenas_cobro;
create trigger contrasenas_cobro_numerar before insert or update on public.contrasenas_cobro for each row execute function public.numerar_documento_venta();

create or replace function public.totalizar_documento_venta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if tg_table_name = 'envio_venta_lineas' then
    if tg_op <> 'DELETE' then new.total := round(new.cantidad * new.precio, 2); new.descripcion := upper(trim(new.descripcion)); end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  return null;
end;
$$;
drop trigger if exists envio_venta_lineas_preparar on public.envio_venta_lineas;
create trigger envio_venta_lineas_preparar before insert or update on public.envio_venta_lineas for each row execute function public.totalizar_documento_venta();
create or replace function public.sumar_envio_venta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id bigint := coalesce(new.envio_id, old.envio_id);
begin
  update public.envios_venta set total = (select coalesce(sum(total), 0) from public.envio_venta_lineas where envio_id = v_id) where id = v_id;
  return null;
end;
$$;
drop trigger if exists envio_venta_lineas_sumar on public.envio_venta_lineas;
create trigger envio_venta_lineas_sumar after insert or update or delete on public.envio_venta_lineas for each row execute function public.sumar_envio_venta();

-- Seguridad: leer con usuario activo; crear, modificar y quitar, un administrador.
do $$
declare t text;
begin
  foreach t in array array['series_recibo', 'correlativos_dte', 'envios_venta', 'envio_venta_lineas', 'contrasenas_cobro', 'contrasena_cobro_lineas'] loop
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

-- ---------- Menú ----------
do $$
declare v_mod bigint; v_fac bigint; v_cli bigint; v_orden integer; v_id bigint; o record;
begin
  select id, modulo_id into v_fac, v_mod from public.opciones_sistema where grupo = 'registros' and clave = 'facturas-ventas' order by id limit 1;
  if v_fac is null then raise notice 'No existe la opción Facturas Ventas.'; return; end if;
  select id into v_cli from public.opciones_sistema where modulo_id = v_mod and clave = 'clientes';
  -- Catálogos (subgrupo Ventas): después de Vendedores.
  for o in select * from (values (1, 'series-recibos', 'Series Recibos'), (2, 'correlativo-dte', 'Correlativo - DTE')) as x(n, clave, nombre) loop
    if not exists (select 1 from public.opciones_sistema where modulo_id = v_mod and clave = o.clave) then
      select orden into v_orden from public.opciones_sistema where modulo_id = v_mod and clave = case o.n when 1 then 'vendedores' else 'series-recibos' end;
      update public.opciones_sistema set orden = orden + 1 where modulo_id = v_mod and orden > v_orden;
      insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values (v_mod, 'catalogos', 'Ventas', o.clave, o.nombre, v_orden + 1) returning id into v_id;
      insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
      select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = coalesce(v_cli, v_fac) on conflict do nothing;
    end if;
  end loop;
  -- Mantenimientos: «Series de documentos» pasa a ser el catálogo Series Recibos.
  delete from public.rol_accesos where opcion_id in (select id from public.opciones_sistema where modulo_id = v_mod and clave = 'series-de-documentos');
  delete from public.opciones_sistema where modulo_id = v_mod and clave = 'series-de-documentos';
  select coalesce(min(orden), (select max(orden) from public.opciones_sistema where modulo_id = v_mod)) - 1 into v_orden from public.opciones_sistema where modulo_id = v_mod and grupo = 'mantenimientos';
  for o in select * from (values (1, 'envios', 'Envíos'), (2, 'contrasenas-cobros', 'Administración de Contraseñas Cobros'), (3, 'despachos', 'Despachos'),
      (4, 'retenciones', 'Retenciones'), (5, 'exenciones', 'Exenciones')) as x(n, clave, nombre) loop
    if not exists (select 1 from public.opciones_sistema where modulo_id = v_mod and clave = o.clave) then
      update public.opciones_sistema set orden = orden + 1 where modulo_id = v_mod and orden > v_orden + o.n - 1;
      insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden) values (v_mod, 'mantenimientos', 'Ventas', o.clave, o.nombre, v_orden + o.n) returning id into v_id;
      insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
      select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = v_fac on conflict do nothing;
    end if;
  end loop;
  raise notice 'Series, correlativos, envíos, contraseñas de cobro, despachos, retenciones y exenciones instalados.';
end;
$$;

notify pgrst, 'reload schema';
