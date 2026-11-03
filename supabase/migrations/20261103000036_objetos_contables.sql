-- Catálogos · Objetos contables (por organización y localidad).
--   Definición de objetos: objetos contables (proveedores, créditos, costeo de proyectos,
--   impuestos…) con sus cuentas (cuentas x objeto) y sus transacciones (transacciones x
--   objeto, con la cuenta bancaria).
--   Transacciones: plantillas de partida (pólizas generales, depósitos, notas de crédito…) con
--   estado, si aplica a póliza, tipo de operación para la migración de documentos y sus cuentas
--   (cuenta, debe o haber, orden, operación, centro de costo y columna para nóminas).
-- Los números (objeto 1, 2…; transacción 1001, 1002…) son correlativos por localidad. Las cuentas
-- y centros deben ser de la misma localidad. Escribir: administrador.
-- Requiere los scripts 5 y 14. Puede ejecutarse de nuevo.

create table if not exists public.objetos_contables (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id    bigint not null,
  numero          integer not null,
  descripcion     text not null check (length(trim(descripcion)) > 0),
  activo          boolean not null default true,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, numero)
);

create table if not exists public.transacciones_contables (
  id              bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones (id),
  localidad_id    bigint not null,
  numero          integer not null,
  descripcion     text not null check (length(trim(descripcion)) > 0),
  estado          text not null default 'ACTIVO' check (estado in ('ACTIVO', 'INACTIVO')),
  aplica_poliza   boolean not null default true,
  tipo_operacion  text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id),
  unique (localidad_id, numero)
);

create table if not exists public.objeto_cuentas (
  id        bigint generated always as identity primary key,
  objeto_id bigint not null references public.objetos_contables (id) on delete cascade,
  cuenta_id bigint not null references public.cuentas (id),
  linea     text,
  unique (objeto_id, cuenta_id)
);

create table if not exists public.objeto_transacciones (
  id              bigint generated always as identity primary key,
  objeto_id       bigint not null references public.objetos_contables (id) on delete cascade,
  transaccion_id  bigint not null references public.transacciones_contables (id) on delete cascade,
  cuenta_bancaria text,
  unique (objeto_id, transaccion_id)
);

create table if not exists public.transaccion_cuentas (
  id             bigint generated always as identity primary key,
  transaccion_id bigint not null references public.transacciones_contables (id) on delete cascade,
  linea          integer not null check (linea > 0),
  cuenta_id      bigint not null references public.cuentas (id),
  naturaleza     text not null default 'D' check (naturaleza in ('D', 'H')),
  orden          integer,
  operacion      text not null default 'TOTAL' check (operacion in ('TOTAL', 'SUBTOTAL', 'IMPUESTO', 'RETENCIÓN', 'DESCUENTO', 'OTRO')),
  centro_id      bigint references public.centros_costo (id),
  columna_nomina text,
  unique (transaccion_id, linea)
);

-- Correlativos por localidad.
create or replace function public.numerar_objeto_contable() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4805, new.localidad_id::integer);
    if tg_table_name = 'objetos_contables' then
      new.numero := coalesce((select max(numero) from public.objetos_contables where localidad_id = new.localidad_id), 0) + 1;
    else
      new.numero := coalesce((select max(numero) from public.transacciones_contables where localidad_id = new.localidad_id), 1000) + 1;
    end if;
  else
    new.organizacion_id := old.organizacion_id;
    new.localidad_id := old.localidad_id;
    new.numero := old.numero;
  end if;
  new.descripcion := upper(trim(new.descripcion));
  return new;
end;
$$;
drop trigger if exists objetos_contables_numerar on public.objetos_contables;
create trigger objetos_contables_numerar before insert or update on public.objetos_contables
  for each row execute function public.numerar_objeto_contable();
drop trigger if exists transacciones_contables_numerar on public.transacciones_contables;
create trigger transacciones_contables_numerar before insert or update on public.transacciones_contables
  for each row execute function public.numerar_objeto_contable();
drop trigger if exists objetos_contables_auditar on public.objetos_contables;
create trigger objetos_contables_auditar before insert or update on public.objetos_contables for each row execute function public.auditar();
drop trigger if exists transacciones_contables_auditar on public.transacciones_contables;
create trigger transacciones_contables_auditar before insert or update on public.transacciones_contables for each row execute function public.auditar();

-- Cuentas, centros y transacciones deben ser de la misma localidad.
create or replace function public.validar_detalle_objeto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_loc bigint;
begin
  if tg_table_name = 'transaccion_cuentas' then
    select localidad_id into v_loc from public.transacciones_contables where id = new.transaccion_id;
  else
    select localidad_id into v_loc from public.objetos_contables where id = new.objeto_id;
  end if;
  -- Cada tabla tiene sus propias columnas: se valida por separado.
  if tg_table_name in ('objeto_cuentas', 'transaccion_cuentas') then
    if not exists (select 1 from public.cuentas c join public.catalogos_cuentas k on k.id = c.catalogo_id
                   where c.id = new.cuenta_id and k.localidad_id = v_loc) then
      raise exception 'La cuenta no es del catálogo de cuentas de la localidad.';
    end if;
  end if;
  if tg_table_name = 'transaccion_cuentas' then
    if new.centro_id is not null and not exists (
         select 1 from public.centros_costo x join public.catalogos_centros k on k.id = x.catalogo_id
         where x.id = new.centro_id and k.localidad_id = v_loc) then
      raise exception 'El centro de costo no es de la localidad.';
    end if;
  end if;
  if tg_table_name = 'objeto_transacciones' then
    if not exists (select 1 from public.transacciones_contables t where t.id = new.transaccion_id and t.localidad_id = v_loc) then
      raise exception 'La transacción no es de la localidad del objeto.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists objeto_cuentas_validar on public.objeto_cuentas;
create trigger objeto_cuentas_validar before insert or update on public.objeto_cuentas for each row execute function public.validar_detalle_objeto();
drop trigger if exists objeto_transacciones_validar on public.objeto_transacciones;
create trigger objeto_transacciones_validar before insert or update on public.objeto_transacciones for each row execute function public.validar_detalle_objeto();
drop trigger if exists transaccion_cuentas_validar on public.transaccion_cuentas;
create trigger transaccion_cuentas_validar before insert or update on public.transaccion_cuentas for each row execute function public.validar_detalle_objeto();

do $$
declare t text;
begin
  foreach t in array array['objetos_contables', 'transacciones_contables', 'objeto_cuentas', 'objeto_transacciones', 'transaccion_cuentas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: leer" on public.%I', t, t);
    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format('drop policy if exists "%s: modificar" on public.%I', t, t);
    execute format('drop policy if exists "%s: quitar" on public.%I', t, t);
    execute format('create policy "%s: leer" on public.%I for select to authenticated using (public.usuario_activo())', t, t);
    execute format('create policy "%s: crear" on public.%I for insert to authenticated with check (public.puede_editar_catalogos())', t, t);
    execute format('create policy "%s: modificar" on public.%I for update to authenticated using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos())', t, t);
    execute format('create policy "%s: quitar" on public.%I for delete to authenticated using (public.puede_editar_catalogos())', t, t);
  end loop;
end;
$$;

revoke execute on function public.numerar_objeto_contable() from public, anon, authenticated;
revoke execute on function public.validar_detalle_objeto() from public, anon, authenticated;

-- Pantallas en Roles módulos: grupo Objetos contables, debajo de Cuentas y CC.
do $$
declare
  v_con bigint := (select id from public.modulos_sistema where siglas = 'CON' and modulo_mayor_id is null);
  v_orden integer := (select orden from public.opciones_sistema where clave = 'tipos-de-partida' and modulo_id = v_con);
begin
  if v_orden is not null and not exists (select 1 from public.opciones_sistema where clave = 'objetos-definicion') then
    update public.opciones_sistema set orden = orden + 2 where orden > v_orden;
    insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
    values (v_con, 'catalogos', 'Objetos contables', 'objetos-definicion', 'Definición de objetos', v_orden + 1),
           (v_con, 'catalogos', 'Objetos contables', 'objetos-transacciones', 'Transacciones', v_orden + 2);
  end if;
end;
$$;

notify pgrst, 'reload schema';
