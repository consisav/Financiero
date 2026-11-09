-- 174 · Ventas Inteligentes: las ventas generadas en Facturación/Ventas › Procesos › Ventas Inteligentes › Generar Ventas,
--   con su estado y sus productos, para consultarlas en Consulta de Ventas.
--   Estados: GENERADA (guardada) → CONFIRMADA → FACTURA PRELIMINAR → FACTURADA (al guardar la factura real, con su
--   factura_id); ELIMINADA (se conserva, con su motivo).
--   numero: correlativo por localidad, lo asigna la base de datos.
-- Se ejecuta después del script 130 (facturas de venta).

create table if not exists public.ventas_inteligentes (
  id bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones(id),
  localidad_id bigint not null references public.localidades(id),
  numero integer not null default 0,
  fecha date not null default current_date,
  cliente_id bigint references public.clientes(id),
  cliente_codigo text,
  nombre text not null,
  nit text,
  vendedor_id bigint,
  estado text not null default 'GENERADA' check (estado in ('GENERADA', 'CONFIRMADA', 'FACTURA PRELIMINAR', 'FACTURADA', 'ELIMINADA')),
  total numeric(14, 2) not null default 0,
  factura_id bigint references public.facturas_venta(id) on delete set null,
  origen text not null default 'PANTALLA' check (origen in ('PANTALLA', 'VOZ')),
  observaciones text,
  motivo_eliminacion text,
  confirmada_en timestamptz, preliminar_en timestamptz, facturada_en timestamptz, eliminada_en timestamptz,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create index if not exists ventas_inteligentes_loc on public.ventas_inteligentes (localidad_id, fecha desc);
create unique index if not exists ventas_inteligentes_numero on public.ventas_inteligentes (localidad_id, numero);

create table if not exists public.venta_inteligente_lineas (
  id bigint generated always as identity primary key,
  venta_id bigint not null references public.ventas_inteligentes(id) on delete cascade,
  linea integer not null,
  producto_id bigint references public.productos(id),
  producto_codigo text,
  descripcion text not null,
  cantidad numeric(14, 4) not null check (cantidad > 0),
  precio numeric(14, 4) not null default 0,
  total numeric(14, 2) generated always as (round(cantidad * precio, 2)) stored
);
create index if not exists venta_inteligente_lineas_venta on public.venta_inteligente_lineas (venta_id, linea);

-- Correlativo por localidad y fechas de cada estado.
create or replace function public.preparar_venta_inteligente() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and coalesce(new.numero, 0) = 0 then
    perform pg_advisory_xact_lock(hashtext('ventas_inteligentes'), new.localidad_id::int);
    select coalesce(max(numero), 0) + 1 into new.numero from public.ventas_inteligentes where localidad_id = new.localidad_id;
  end if;
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    if new.estado = 'CONFIRMADA' then new.confirmada_en := now();
    elsif new.estado = 'FACTURA PRELIMINAR' then new.preliminar_en := now();
    elsif new.estado = 'FACTURADA' then new.facturada_en := now();
    elsif new.estado = 'ELIMINADA' then new.eliminada_en := now();
    end if;
  end if;
  if tg_op = 'UPDATE' and old.estado in ('FACTURADA', 'ELIMINADA') and new.estado is distinct from old.estado then
    raise exception 'La venta % ya está %: no cambia de estado.', old.numero, lower(old.estado);
  end if;
  return new;
end;
$$;
drop trigger if exists ventas_inteligentes_preparar on public.ventas_inteligentes;
create trigger ventas_inteligentes_preparar before insert or update on public.ventas_inteligentes for each row execute function public.preparar_venta_inteligente();
drop trigger if exists ventas_inteligentes_auditar on public.ventas_inteligentes;
create trigger ventas_inteligentes_auditar before insert or update on public.ventas_inteligentes for each row execute function public.auditar();

alter table public.ventas_inteligentes enable row level security;
alter table public.venta_inteligente_lineas enable row level security;
do $$
declare t text;
begin
  foreach t in array array['ventas_inteligentes', 'venta_inteligente_lineas'] loop
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('drop policy if exists "%s: escribir" on public.%I', t, t);
    execute format('create policy "%s: escribir" on public.%I for all to authenticated using (public.usuario_activo()) with check (public.usuario_activo())', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
