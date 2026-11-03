-- Centros de costo con la misma estructura que el catálogo de cuentas: cada organización y
-- localidad tiene versiones del catálogo de centros (vigencia del / al), y cada centro pertenece a
-- una versión. Se agrega "centro anterior" (equivalente a la cuenta anterior).
-- Los centros existentes pasan a la versión 1 de la primera localidad de su organización.

create table public.catalogos_centros (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id    bigint not null,
  version         integer not null,
  fecha_del       date not null,
  fecha_al        date,
  activo          boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, version),
  check (fecha_al is null or fecha_al >= fecha_del)
);
create index on public.catalogos_centros (organizacion_id);

create trigger catalogos_centros_auditar before insert or update on public.catalogos_centros
  for each row execute function public.auditar();
-- La organización y la localidad de una versión no cambian (misma regla que en cuentas).
create trigger catalogos_centros_fijar before update on public.catalogos_centros
  for each row execute function public.fijar_catalogo_cuentas();

alter table public.catalogos_centros enable row level security;
create policy "catalogos_centros: leer" on public.catalogos_centros for select to authenticated using (public.usuario_activo());
create policy "catalogos_centros: crear" on public.catalogos_centros for insert to authenticated with check (public.puede_editar_catalogos());
create policy "catalogos_centros: modificar" on public.catalogos_centros for update to authenticated
  using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());

alter table public.centros_costo
  add column catalogo_id bigint references public.catalogos_centros (id),
  add column centro_anterior text;
create index on public.centros_costo (catalogo_id);

-- ---------- Centros existentes ----------
-- Organizaciones con centros pero sin localidades: se les crea una con el nombre de la organización.
insert into public.localidades (organizacion_id, nombre_comercial, razon_social, pais_id, departamento_id, municipio_id)
select o.id, o.nombre, o.nombre, o.pais_id, o.departamento_id, o.municipio_id
from public.organizaciones o
where exists (select 1 from public.centros_costo c where c.organizacion_id = o.id)
  and not exists (select 1 from public.localidades l where l.organizacion_id = o.id);

-- Versión 1 en la primera localidad de cada organización que ya tiene centros.
insert into public.catalogos_centros (organizacion_id, localidad_id, version, fecha_del)
select o.id,
       (select l.id from public.localidades l where l.organizacion_id = o.id order by l.activo desc, l.correlativo limit 1),
       1,
       coalesce((select min(c.creado_en)::date from public.centros_costo c where c.organizacion_id = o.id), current_date)
from public.organizaciones o
where exists (select 1 from public.centros_costo c where c.organizacion_id = o.id);

-- Se desactiva la regla de jerarquía mientras se asigna la versión (no cambia el árbol).
alter table public.centros_costo disable trigger centros_costo_jerarquia;
update public.centros_costo c
set catalogo_id = (select k.id from public.catalogos_centros k where k.organizacion_id = c.organizacion_id and k.version = 1 order by k.id limit 1)
where c.catalogo_id is null;
alter table public.centros_costo enable trigger centros_costo_jerarquia;

alter table public.centros_costo
  alter column catalogo_id set not null,
  drop constraint centros_costo_organizacion_id_codigo_key,
  add constraint centros_costo_catalogo_codigo_key unique (catalogo_id, codigo);

-- ---------- Reglas de la jerarquía, ahora por versión del catálogo ----------
create or replace function public.jerarquia_centro() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  mayor public.centros_costo;
begin
  if tg_op = 'UPDATE' then
    new.catalogo_id := old.catalogo_id;
    new.centro_mayor_id := old.centro_mayor_id;
    new.codigo := old.codigo;
  end if;
  -- La organización se toma de la versión del catálogo.
  select k.organizacion_id into new.organizacion_id from public.catalogos_centros k where k.id = new.catalogo_id;

  if new.centro_mayor_id is null then
    new.nivel := 1;
  else
    select * into mayor from public.centros_costo where id = new.centro_mayor_id;
    if mayor.catalogo_id <> new.catalogo_id then
      raise exception 'El centro mayor pertenece a otra versión del catálogo.';
    end if;
    if tg_op = 'INSERT' and (left(new.codigo, length(mayor.codigo)) <> mayor.codigo or length(new.codigo) <= length(mayor.codigo)) then
      raise exception 'El código del centro debe comenzar con %, el código de su centro mayor.', mayor.codigo;
    end if;
    new.nivel := mayor.nivel + 1;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
