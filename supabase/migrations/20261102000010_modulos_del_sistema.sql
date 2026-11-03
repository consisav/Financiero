-- Iniciales · Módulos: catálogo maestro-detalle de los módulos del sistema y sus sub-módulos.
--   Módulo principal: sin módulo mayor (Contabilidad, Facturación y ventas, Inventarios…).
--   Sub-módulo: depende de un módulo principal (Contabilidad → Caja y bancos, Presupuesto…).
-- Código único en todo el catálogo; siglas únicas dentro del mismo módulo mayor.
-- Lectura: usuarios activos. Escritura: Super Administrador o Administrador. No se borra: se desactiva.

create table public.modulos_sistema (
  id               bigint generated always as identity primary key,
  codigo           integer not null unique check (codigo > 0),
  siglas           text not null check (siglas ~ '^[A-Z0-9]{2,6}$'),
  descripcion      text not null,
  modulo_mayor_id  bigint references public.modulos_sistema (id),
  activo           boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  check (modulo_mayor_id is distinct from id)
);

create unique index modulos_sistema_siglas on public.modulos_sistema (coalesce(modulo_mayor_id, 0), siglas);
create index on public.modulos_sistema (modulo_mayor_id);

-- Solo dos niveles: un sub-módulo no puede tener sub-módulos, y el módulo mayor no cambia.
create function public.validar_modulo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.modulo_mayor_id := old.modulo_mayor_id;
  end if;
  if new.modulo_mayor_id is not null and exists (
       select 1 from public.modulos_sistema where id = new.modulo_mayor_id and modulo_mayor_id is not null) then
    raise exception 'Un sub-módulo solo puede depender de un módulo principal';
  end if;
  new.siglas := upper(new.siglas);
  return new;
end;
$$;

create trigger modulos_sistema_validar before insert or update on public.modulos_sistema
  for each row execute function public.validar_modulo();
create trigger modulos_sistema_auditar before insert or update on public.modulos_sistema
  for each row execute function public.auditar();

alter table public.modulos_sistema enable row level security;
create policy "modulos_sistema: leer" on public.modulos_sistema for select to authenticated using (public.usuario_activo());
create policy "modulos_sistema: crear" on public.modulos_sistema for insert to authenticated with check (public.puede_editar_catalogos());
create policy "modulos_sistema: modificar" on public.modulos_sistema for update to authenticated
  using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());

revoke execute on function public.validar_modulo() from public, anon, authenticated;

-- ---------- Datos iniciales ----------
insert into public.modulos_sistema (codigo, siglas, descripcion) values
  (1, 'CON', 'CONTABILIDAD'),
  (2, 'FAC', 'FACTURACIÓN Y VENTAS'),
  (3, 'INV', 'INVENTARIOS'),
  (4, 'NOM', 'NÓMINAS'),
  (5, 'ACT', 'ACTIVOS'),
  (6, 'IMP', 'IMPORTACIONES Y EXPORTACIONES'),
  (7, 'SAT', 'INTEGRACIONES SAT'),
  (8, 'CAR', 'CARTERA');

insert into public.modulos_sistema (codigo, siglas, descripcion, modulo_mayor_id)
select s.codigo, s.siglas, s.descripcion, m.id
from public.modulos_sistema m
join (values
  (101, 'CYB', 'CAJA Y BANCOS'),
  (102, 'CYV', 'COMPRAS Y VENTAS'),
  (103, 'FLU', 'FLUJO DE EFECTIVO'),
  (104, 'PRE', 'PRESUPUESTO'),
  (105, 'SAT', 'INTEGRACIONES SAT')
) as s (codigo, siglas, descripcion) on true
where m.codigo = 1;

notify pgrst, 'reload schema';
