-- Contabilidad · Cuentas y centros de costos:
--   tipos_cuenta       Activo, Pasivo, Patrimonio… con su naturaleza (debe-haber / haber-debe)
--   catalogos_cuentas  versión del catálogo de cuentas de una organización (vigencia del / al)
--   cuentas            cuentas contables jerárquicas: cuenta → subcuenta → …
--   centros_costo      centros de costo jerárquicos de una organización
-- En las jerarquías el nivel y el tipo se heredan de la cuenta mayor, y el código de una
-- subcuenta debe comenzar con el código de su cuenta mayor (1 → 101 → 10101).
-- Lectura: usuarios activos. Escritura: administrador o contador. No se borra: se desactiva.

create table public.tipos_cuenta (
  id                   bigint generated always as identity primary key,
  codigo               integer not null unique,
  descripcion          text not null,
  tipo_operacion       text not null check (tipo_operacion in ('DEBE-HABER', 'HABER-DEBE')),
  operacion_resultado  text not null default 'NINGUNA' check (operacion_resultado in ('NINGUNA', 'SUMAR', 'RESTAR')),
  incluye_centro_costo boolean not null default false,
  activo               boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz
);

create table public.catalogos_cuentas (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  version         integer not null,
  fecha_del       date not null,
  fecha_al        date,
  activo          boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (organizacion_id, version),
  check (fecha_al is null or fecha_al >= fecha_del)
);

create table public.cuentas (
  id              bigint generated always as identity primary key,
  catalogo_id     bigint not null references public.catalogos_cuentas (id),
  codigo          text not null check (codigo ~ '^[0-9]+$'),
  nombre          text not null,
  cuenta_mayor_id bigint references public.cuentas (id),
  tipo_cuenta_id  bigint references public.tipos_cuenta (id),
  integra         boolean not null default true,
  nivel           integer not null default 1,
  cuenta_anterior text,
  vigente         boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (catalogo_id, codigo)
);

create table public.centros_costo (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  codigo          text not null check (codigo ~ '^[0-9]+$'),
  nombre          text not null,
  centro_mayor_id bigint references public.centros_costo (id),
  integra         boolean not null default false,
  nivel           integer not null default 1,
  vigente         boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  unique (organizacion_id, codigo)
);

create index on public.catalogos_cuentas (organizacion_id);
create index on public.cuentas (catalogo_id);
create index on public.cuentas (cuenta_mayor_id);
create index on public.cuentas (tipo_cuenta_id);
create index on public.centros_costo (organizacion_id);
create index on public.centros_costo (centro_mayor_id);

-- ---------- Reglas de la jerarquía ----------
create function public.jerarquia_cuenta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  mayor public.cuentas;
begin
  if tg_op = 'UPDATE' then
    -- La posición en el árbol y el código no cambian después de creada la cuenta.
    new.catalogo_id := old.catalogo_id;
    new.cuenta_mayor_id := old.cuenta_mayor_id;
    new.codigo := old.codigo;
  end if;

  if new.cuenta_mayor_id is null then
    new.nivel := 1;
    if new.tipo_cuenta_id is null then
      raise exception 'Selecciona el tipo de cuenta.';
    end if;
  else
    select * into mayor from public.cuentas where id = new.cuenta_mayor_id;
    if mayor.catalogo_id <> new.catalogo_id then
      raise exception 'La cuenta mayor pertenece a otra versión del catálogo.';
    end if;
    if tg_op = 'INSERT' and (left(new.codigo, length(mayor.codigo)) <> mayor.codigo or length(new.codigo) <= length(mayor.codigo)) then
      raise exception 'El código de la subcuenta debe comenzar con %, el código de su cuenta mayor.', mayor.codigo;
    end if;
    new.nivel := mayor.nivel + 1;
    new.tipo_cuenta_id := mayor.tipo_cuenta_id;
  end if;
  return new;
end;
$$;

-- Si cambia el tipo de una cuenta, sus subcuentas lo heredan (en cadena).
create function public.heredar_tipo_cuenta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.cuentas set tipo_cuenta_id = new.tipo_cuenta_id
  where cuenta_mayor_id = new.id and tipo_cuenta_id is distinct from new.tipo_cuenta_id;
  return null;
end;
$$;

create function public.jerarquia_centro() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  mayor public.centros_costo;
begin
  if tg_op = 'UPDATE' then
    new.organizacion_id := old.organizacion_id;
    new.centro_mayor_id := old.centro_mayor_id;
    new.codigo := old.codigo;
  end if;

  if new.centro_mayor_id is null then
    new.nivel := 1;
  else
    select * into mayor from public.centros_costo where id = new.centro_mayor_id;
    if mayor.organizacion_id <> new.organizacion_id then
      raise exception 'El centro mayor pertenece a otra organización.';
    end if;
    if tg_op = 'INSERT' and (left(new.codigo, length(mayor.codigo)) <> mayor.codigo or length(new.codigo) <= length(mayor.codigo)) then
      raise exception 'El código del centro debe comenzar con %, el código de su centro mayor.', mayor.codigo;
    end if;
    new.nivel := mayor.nivel + 1;
  end if;
  return new;
end;
$$;

create trigger cuentas_jerarquia before insert or update on public.cuentas
  for each row execute function public.jerarquia_cuenta();
create trigger cuentas_heredar_tipo after update of tipo_cuenta_id on public.cuentas
  for each row execute function public.heredar_tipo_cuenta();
create trigger centros_costo_jerarquia before insert or update on public.centros_costo
  for each row execute function public.jerarquia_centro();

create trigger tipos_cuenta_auditar before insert or update on public.tipos_cuenta for each row execute function public.auditar();
create trigger catalogos_cuentas_auditar before insert or update on public.catalogos_cuentas for each row execute function public.auditar();
create trigger cuentas_auditar before insert or update on public.cuentas for each row execute function public.auditar();
create trigger centros_costo_auditar before insert or update on public.centros_costo for each row execute function public.auditar();

-- ---------- Seguridad a nivel de fila ----------
do $$
declare t text;
begin
  foreach t in array array['tipos_cuenta', 'catalogos_cuentas', 'cuentas', 'centros_costo'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
  end loop;
end;
$$;

revoke execute on function public.jerarquia_cuenta() from public, anon, authenticated;
revoke execute on function public.heredar_tipo_cuenta() from public, anon, authenticated;
revoke execute on function public.jerarquia_centro() from public, anon, authenticated;

-- ---------- Tipos de cuenta iniciales ----------
insert into public.tipos_cuenta (codigo, descripcion, tipo_operacion, operacion_resultado) values
  (1, 'ACTIVO',             'DEBE-HABER', 'NINGUNA'),
  (2, 'PASIVO',             'HABER-DEBE', 'NINGUNA'),
  (3, 'PATRIMONIO',         'HABER-DEBE', 'NINGUNA'),
  (4, 'INGRESOS',           'HABER-DEBE', 'SUMAR'),
  (5, 'COSTO DE VENTAS',    'DEBE-HABER', 'RESTAR'),
  (6, 'GASTOS DE OPERACIÓN','DEBE-HABER', 'RESTAR'),
  (7, 'OTROS INGRESOS',     'HABER-DEBE', 'SUMAR'),
  (8, 'OTROS GASTOS',       'DEBE-HABER', 'RESTAR'),
  (9, 'EGRESOS CUENTA AJENA','DEBE-HABER', 'RESTAR');

notify pgrst, 'reload schema';
