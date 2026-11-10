-- 182 · Datos Personas (Administración › Registros › Datos Personas): la ficha general de datos de una persona, por
--   organización, que se referencia desde otras pantallas (clientes, empleados, pacientes, proveedores, médicos).
--   personas_catalogos: tipo de persona, escolaridad y profesión de cada organización (con su código).
--   personas: código correlativo por organización, nombres y apellidos (y cada uno por separado), datos generales,
--     identificación (DPI con su departamento y municipio de extensión), dirección de casa, teléfonos (lista), información
--     laboral, cuenta contable, días y límite de crédito, contactos (lista) y si se muestra en el reporte «Entre compañías».
--   El DPI y el NIT no se repiten dentro de una organización (salvo CF).
-- Se ejecuta después del script 176.

create table if not exists public.personas_catalogos (
  id bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones(id),
  tipo text not null check (tipo in ('TIPO', 'ESCOLARIDAD', 'PROFESION')),
  codigo integer not null,
  nombre text not null,
  activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (organizacion_id, tipo, codigo)
);
create unique index if not exists personas_catalogos_nombre on public.personas_catalogos (organizacion_id, tipo, upper(nombre));

create table if not exists public.personas (
  id bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones(id),
  localidad_id bigint references public.localidades(id),
  codigo integer not null default 0,
  tipo_id bigint references public.personas_catalogos(id),
  centro_costo text,
  nombres text not null,
  apellidos text,
  primer_nombre text, segundo_nombre text, primer_apellido text, segundo_apellido text, apellido_casada text,
  -- Datos generales
  facturar_a text,
  vendedor text,
  zona_venta text,
  direccion_facturacion text,
  direccion_cobro text,
  zona integer,
  fecha_nacimiento date,
  nacionalidad text default 'GUATEMALTECA',
  escolaridad_id bigint references public.personas_catalogos(id),
  profesion_id bigint references public.personas_catalogos(id),
  nit text,
  estado_civil text check (estado_civil in ('SOLTERO', 'CASADO', 'UNIDO', 'DIVORCIADO', 'VIUDO')),
  sexo text check (sexo in ('MASCULINO', 'FEMENINO')),
  correo text,
  -- Documento de identificación
  dpi text,
  dpi_departamento_id bigint references public.departamentos(id),
  dpi_municipio_id bigint references public.municipios(id),
  -- Dirección de casa y teléfonos ([{numero, tipo, ext, area}])
  pais_id bigint references public.paises(id),
  departamento_id bigint references public.departamentos(id),
  municipio_id bigint references public.municipios(id),
  aldea text,
  direccion text,
  telefonos jsonb not null default '[]'::jsonb,
  -- Información laboral
  empresa_labora text,
  tiempo_laborar integer,
  direccion_laboral text,
  ingresos numeric(14, 2),
  otros_ingresos numeric(14, 2),
  puesto text,
  concepto_otros_ingresos text,
  mostrar_entre_companias boolean not null default false,
  -- Contable y crédito
  cuenta_id bigint references public.cuentas(id),
  cuenta_codigo text,
  dias_credito integer,
  limite_credito numeric(14, 2),
  observaciones text,
  contactos jsonb not null default '[]'::jsonb,
  activo boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz, modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);
create unique index if not exists personas_codigo on public.personas (organizacion_id, codigo);
create unique index if not exists personas_dpi on public.personas (organizacion_id, dpi) where dpi is not null;
create unique index if not exists personas_nit on public.personas (organizacion_id, upper(nit)) where nit is not null and upper(nit) not in ('CF', 'C/F');
create index if not exists personas_nombre on public.personas (organizacion_id, upper(nombres || ' ' || coalesce(apellidos, '')));

-- Código correlativo por organización; nombres en mayúsculas y sin espacios de más; «Facturar a» por omisión el nombre completo.
create or replace function public.preparar_persona() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and coalesce(new.codigo, 0) = 0 then
    perform pg_advisory_xact_lock(hashtext('personas'), new.organizacion_id::int);
    select coalesce(max(codigo), 0) + 1 into new.codigo from public.personas where organizacion_id = new.organizacion_id;
  end if;
  if tg_op = 'UPDATE' then new.organizacion_id := old.organizacion_id; new.codigo := old.codigo; end if;
  new.nombres := upper(regexp_replace(trim(new.nombres), '\s+', ' ', 'g'));
  new.apellidos := nullif(upper(regexp_replace(trim(coalesce(new.apellidos, '')), '\s+', ' ', 'g')), '');
  new.dpi := nullif(regexp_replace(coalesce(new.dpi, ''), '\D', '', 'g'), '');
  new.nit := nullif(upper(regexp_replace(coalesce(new.nit, ''), '[\s-]', '', 'g')), '');
  new.correo := nullif(lower(trim(coalesce(new.correo, ''))), '');
  new.facturar_a := coalesce(nullif(trim(coalesce(new.facturar_a, '')), ''), trim(new.nombres || ' ' || coalesce(new.apellidos, '')));
  return new;
end;
$$;
drop trigger if exists personas_preparar on public.personas;
create trigger personas_preparar before insert or update on public.personas for each row execute function public.preparar_persona();
drop trigger if exists personas_auditar on public.personas;
create trigger personas_auditar before insert or update on public.personas for each row execute function public.auditar();
drop trigger if exists personas_catalogos_auditar on public.personas_catalogos;
create trigger personas_catalogos_auditar before insert or update on public.personas_catalogos for each row execute function public.auditar();

alter table public.personas enable row level security;
alter table public.personas_catalogos enable row level security;
do $$
declare t text;
begin
  foreach t in array array['personas', 'personas_catalogos'] loop
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('drop policy if exists "%s: escribir" on public.%I', t, t);
    execute format('create policy "%s: escribir" on public.%I for all to authenticated using (public.usuario_activo()) with check (public.usuario_activo())', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Catálogos iniciales en cada organización (no se duplican si ya existen).
insert into public.personas_catalogos (organizacion_id, tipo, codigo, nombre)
select o.id, x.tipo, x.codigo, x.nombre
from public.organizaciones o cross join (values
  ('TIPO', 1, 'EMPLEADO'), ('TIPO', 2, 'CLIENTE'), ('TIPO', 3, 'PROVEEDOR'), ('TIPO', 4, 'PACIENTE'), ('TIPO', 5, 'MÉDICO'),
  ('TIPO', 6, 'ACCIONISTA'), ('TIPO', 7, 'CONTACTO'), ('TIPO', 8, 'OTRO'),
  ('ESCOLARIDAD', 1, 'NINGUNA'), ('ESCOLARIDAD', 2, 'PRIMARIA'), ('ESCOLARIDAD', 3, 'BÁSICOS'), ('ESCOLARIDAD', 4, 'DIVERSIFICADO'),
  ('ESCOLARIDAD', 5, 'TÉCNICO'), ('ESCOLARIDAD', 6, 'PROFESIONAL'), ('ESCOLARIDAD', 7, 'MAESTRÍA'), ('ESCOLARIDAD', 8, 'DOCTORADO'),
  ('PROFESION', 1, 'ADMINISTRADOR (A)'), ('PROFESION', 2, 'CONTADOR (A)'), ('PROFESION', 3, 'INGENIERO (A)'), ('PROFESION', 4, 'LICENCIADO (A)'),
  ('PROFESION', 5, 'MÉDICO (A)'), ('PROFESION', 6, 'ENFERMERO (A)'), ('PROFESION', 7, 'ABOGADO (A)'), ('PROFESION', 8, 'ARQUITECTO (A)'),
  ('PROFESION', 9, 'MAESTRO (A)'), ('PROFESION', 10, 'PERITO CONTADOR'), ('PROFESION', 11, 'TÉCNICO (A)'), ('PROFESION', 12, 'ESTUDIANTE'),
  ('PROFESION', 13, 'COMERCIANTE'), ('PROFESION', 14, 'OTRA')
) as x(tipo, codigo, nombre)
where not exists (select 1 from public.personas_catalogos c where c.organizacion_id = o.id and c.tipo = x.tipo and (c.codigo = x.codigo or upper(c.nombre) = x.nombre));

notify pgrst, 'reload schema';
