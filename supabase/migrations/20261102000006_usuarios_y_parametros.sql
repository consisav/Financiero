-- Iniciales: cada usuario pertenece a una organización y a una localidad, con datos de
-- usuario (código, empleado, extensión, vencimiento de clave y firma), y cada localidad tiene
-- sus Parámetros generales (tiempo, impuestos, monedas, firmantes…).
-- Requiere la migración 5 (localidades_id_organizacion_key); si falta, se crea aquí.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'localidades_id_organizacion_key') then
    alter table public.localidades add constraint localidades_id_organizacion_key unique (id, organizacion_id);
  end if;
end;
$$;

-- ---------- Usuarios ----------
alter table public.perfiles
  add column usuario           text unique check (usuario ~ '^[A-Z0-9]{2,10}$'),
  add column organizacion_id   bigint references public.organizaciones (id),
  add column localidad_id      bigint,
  add column empleado          text,
  add column extension         text,
  add column fecha_vence_clave date,
  add column firma_ruta        text,
  add constraint perfiles_localidad_fkey
    foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id);

create index on public.perfiles (organizacion_id);
create index on public.perfiles (localidad_id);

-- Usuarios activos existentes: se asignan a la primera organización y localidad activas.
update public.perfiles p
set organizacion_id = l.organizacion_id, localidad_id = l.id
from (
  select l.id, l.organizacion_id from public.localidades l
  join public.organizaciones o on o.id = l.organizacion_id
  where l.activo and o.activo
  order by o.codigo, l.correlativo
  limit 1) l
where p.organizacion_id is null and p.activo;

-- Un usuario activo debe tener organización y localidad (se exige al crear o modificar).
alter table public.perfiles
  add constraint perfiles_activo_con_localidad
  check (not activo or (organizacion_id is not null and localidad_id is not null)) not valid;

-- Solo un administrador cambia rol, estado, organización, localidad, código, vencimiento y firma.
-- (Sin usuario de la app, como en el SQL Editor de Supabase, no se restringe.)
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.es_admin() and (
       new.rol_id is distinct from old.rol_id or new.activo is distinct from old.activo
    or new.organizacion_id is distinct from old.organizacion_id or new.localidad_id is distinct from old.localidad_id
    or new.usuario is distinct from old.usuario or new.fecha_vence_clave is distinct from old.fecha_vence_clave
    or new.firma_ruta is distinct from old.firma_ruta or new.correo is distinct from old.correo) then
    raise exception 'Solo un administrador puede cambiar estos datos del usuario';
  end if;
  return new;
end;
$$;

-- Firmas: bucket privado; las ven los usuarios activos y solo el administrador las sube o quita.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('firmas', 'firmas', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "firmas: ver" on storage.objects for select to authenticated
  using (bucket_id = 'firmas' and public.usuario_activo());
create policy "firmas: subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'firmas' and public.es_admin());
create policy "firmas: reemplazar" on storage.objects for update to authenticated
  using (bucket_id = 'firmas' and public.es_admin()) with check (bucket_id = 'firmas' and public.es_admin());
create policy "firmas: quitar" on storage.objects for delete to authenticated
  using (bucket_id = 'firmas' and public.es_admin());

-- ---------- Parámetros generales (uno por localidad) ----------
create table public.parametros_generales (
  id                         bigint generated always as identity primary key,
  organizacion_id            bigint not null,
  localidad_id               bigint not null unique,
  -- Parámetros de tiempo
  anio_actual                integer check (anio_actual between 1900 and 2999),
  mes_actual                 integer check (mes_actual between 1 and 12),
  proximo_cierre             date,
  ultimo_cierre              date,
  inicio_periodo_actual      date,
  fin_periodo_actual         date,
  inicio_periodo_fiscal      date,
  fin_periodo_fiscal         date,
  -- Uso de pantallas
  aplicar_iva                boolean not null default true,
  incluir_centros_costo      boolean not null default false,
  migracion_bancos           text not null default 'MANUAL' check (migracion_bancos in ('MANUAL', 'AUTOMATICA')),
  -- Impuestos básicos (%)
  impuesto1                  numeric(6, 2), nombre_impuesto1 text not null default 'IVA',
  impuesto2                  numeric(6, 2), nombre_impuesto2 text not null default 'ISR',
  impuesto3                  numeric(6, 2), nombre_impuesto3 text not null default 'OTRO',
  impuesto4                  numeric(6, 2), nombre_impuesto4 text not null default 'INGUAT',
  -- Impuesto a la distribución de petróleo (IDP), por galón
  idp_super                  numeric(8, 2),
  idp_regular                numeric(8, 2),
  idp_diesel                 numeric(8, 2),
  -- Otros
  valor_cheques_autorizacion numeric(14, 2),
  moneda_integracion         text default 'Quetzales',
  moneda_ingreso             text default 'Quetzales',
  nit                        text,
  primer_mes_contable        integer not null default 1 check (primer_mes_contable between 1 and 12),
  ultimo_mes_contable        integer not null default 12 check (ultimo_mes_contable between 1 and 12),
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  check (fin_periodo_actual is null or inicio_periodo_actual is null or fin_periodo_actual >= inicio_periodo_actual),
  check (fin_periodo_fiscal is null or inicio_periodo_fiscal is null or fin_periodo_fiscal >= inicio_periodo_fiscal)
);

-- Autorizaciones: personas que firman (contador general, representante legal…)
create table public.parametros_firmantes (
  id            bigint generated always as identity primary key,
  parametros_id bigint not null references public.parametros_generales (id) on delete cascade,
  orden         integer not null,
  tipo          text not null,
  nombre        text,
  cargo         text,
  registro      text,
  perfil_id     uuid references public.perfiles (id),
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (parametros_id, orden)
);

create index on public.parametros_generales (organizacion_id);
create index on public.parametros_firmantes (perfil_id);

create trigger parametros_generales_auditar before insert or update on public.parametros_generales for each row execute function public.auditar();
create trigger parametros_firmantes_auditar before insert or update on public.parametros_firmantes for each row execute function public.auditar();

do $$
declare t text;
begin
  foreach t in array array['parametros_generales', 'parametros_firmantes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
  end loop;
end;
$$;
create policy "parametros_firmantes: quitar" on public.parametros_firmantes
  for delete to authenticated using (public.puede_editar_catalogos());

-- Para elegir el usuario de un firmante, los usuarios activos ven código y nombre de los demás.
create function public.usuarios_resumen()
returns table (id uuid, usuario text, nombre text, organizacion_id bigint, localidad_id bigint)
language sql stable security definer set search_path = '' as $$
  select p.id, p.usuario, p.nombre, p.organizacion_id, p.localidad_id
  from public.perfiles p
  where public.usuario_activo() and p.activo
  order by p.usuario nulls last, p.nombre;
$$;
revoke execute on function public.usuarios_resumen() from public, anon;
grant execute on function public.usuarios_resumen() to authenticated;

notify pgrst, 'reload schema';
