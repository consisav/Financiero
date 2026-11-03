-- Catálogos iniciales · Monedas y tipos de cambio (maestro - detalle).
-- Maestro: cada moneda con su código, nombre, símbolo y lugar geográfico.
-- Detalle: historial de tipos de cambio de la moneda (fecha, hora y usuario que lo grabó) con la
-- tasa de venta y la de compra; "cambio" es la moneda contra la que se expresa el valor, que por
-- defecto es la moneda de integración de Parámetros generales (Quetzales).

create table public.monedas (
  id               bigint generated always as identity primary key,
  codigo           integer not null unique check (codigo > 0),
  nombre           text not null,
  simbolo          text not null,
  lugar_geografico text,
  activo           boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create unique index monedas_nombre_key on public.monedas (lower(nombre));

create table public.tipos_cambio (
  id               bigint generated always as identity primary key,
  moneda_id        bigint not null references public.monedas (id),
  fecha            timestamptz not null default now(),
  usuario          text,
  moneda_venta_id  bigint not null references public.monedas (id),
  valor_venta      numeric(18, 6) not null check (valor_venta > 0),
  moneda_compra_id bigint not null references public.monedas (id),
  valor_compra     numeric(18, 6) not null check (valor_compra > 0),
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create index on public.tipos_cambio (moneda_id, fecha desc);

create trigger monedas_auditar before insert or update on public.monedas
  for each row execute function public.auditar();
create trigger tipos_cambio_auditar before insert or update on public.tipos_cambio
  for each row execute function public.auditar();

-- El usuario que graba el tipo de cambio (código de usuario del perfil) no se puede alterar.
create function public.usuario_tipo_cambio() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.usuario := old.usuario;
    new.moneda_id := old.moneda_id;
  else
    new.usuario := coalesce(
      (select upper(p.usuario) from public.perfiles p where p.id = (select auth.uid())),
      'SISTEMA');
  end if;
  return new;
end;
$$;
create trigger tipos_cambio_usuario before insert or update on public.tipos_cambio
  for each row execute function public.usuario_tipo_cambio();
revoke execute on function public.usuario_tipo_cambio() from public, anon, authenticated;

alter table public.monedas enable row level security;
alter table public.tipos_cambio enable row level security;
create policy "monedas: leer" on public.monedas for select to authenticated using (public.usuario_activo());
create policy "monedas: crear" on public.monedas for insert to authenticated with check (public.puede_editar_catalogos());
create policy "monedas: modificar" on public.monedas for update to authenticated
  using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());
create policy "tipos_cambio: leer" on public.tipos_cambio for select to authenticated using (public.usuario_activo());
create policy "tipos_cambio: crear" on public.tipos_cambio for insert to authenticated with check (public.puede_editar_catalogos());
create policy "tipos_cambio: modificar" on public.tipos_cambio for update to authenticated
  using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());

-- ---------- Datos iniciales ----------
insert into public.monedas (codigo, nombre, simbolo, lugar_geografico) values
  (1, 'QUETZALES', 'Q', 'GUATEMALA'),
  (2, 'DÓLARES',   '$', 'E.E.U.U.'),
  (3, 'EUROS',     '€', 'EUROPA'),
  (4, 'YENES',     '¥', 'JAPÓN');

-- Tipos de cambio al 02-11-2026 expresados en la moneda de integración (Quetzales):
--   Dólar: tipo de cambio de referencia del Banco de Guatemala, Q7.64187.
--   Euro: cotización de mercado del 01-11-2026, Q8.57282.
--   Yen: aproximado a partir del dólar (≈ 150 yenes por dólar), Q0.05095. Verificarlo.
--   Quetzal: 1, por ser la moneda de integración.
insert into public.tipos_cambio (moneda_id, fecha, moneda_venta_id, valor_venta, moneda_compra_id, valor_compra)
select m.id, timestamptz '2026-11-02 06:00:00-06', q.id, t.valor, q.id, t.valor
from (values (1, 1.0::numeric), (2, 7.64187), (3, 8.57282), (4, 0.05095)) as t (codigo, valor)
join public.monedas m on m.codigo = t.codigo
cross join (select id from public.monedas where codigo = 1) q;

notify pgrst, 'reload schema';
