-- El catálogo de cuentas contables pertenece a una organización y a una de sus localidades:
-- cada localidad tiene sus propias versiones del catálogo (versión 1, 2…).

-- Para exigir que la localidad sea de la misma organización (llave foránea compuesta).
alter table public.localidades
  add constraint localidades_id_organizacion_key unique (id, organizacion_id);

alter table public.catalogos_cuentas add column localidad_id bigint;

-- Versiones creadas antes de este cambio: se asignan a la primera localidad de su organización.
update public.catalogos_cuentas c
set localidad_id = (
  select l.id from public.localidades l
  where l.organizacion_id = c.organizacion_id
  order by l.activo desc, l.correlativo
  limit 1)
where c.localidad_id is null;

do $$
begin
  if exists (select 1 from public.catalogos_cuentas where localidad_id is null) then
    raise exception 'Hay versiones del catálogo de cuentas en organizaciones sin localidades. Crea al menos una localidad en esas organizaciones y vuelve a ejecutar este script.';
  end if;
end;
$$;

alter table public.catalogos_cuentas
  alter column localidad_id set not null,
  add constraint catalogos_cuentas_localidad_fkey
    foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  drop constraint catalogos_cuentas_organizacion_id_version_key,
  add constraint catalogos_cuentas_localidad_version_key unique (localidad_id, version);

create index on public.catalogos_cuentas (localidad_id);

-- La organización y la localidad de una versión no cambian después de creada.
create function public.fijar_catalogo_cuentas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.organizacion_id := old.organizacion_id;
  new.localidad_id := old.localidad_id;
  return new;
end;
$$;

create trigger catalogos_cuentas_fijar before update on public.catalogos_cuentas
  for each row execute function public.fijar_catalogo_cuentas();

revoke execute on function public.fijar_catalogo_cuentas() from public, anon, authenticated;

notify pgrst, 'reload schema';
