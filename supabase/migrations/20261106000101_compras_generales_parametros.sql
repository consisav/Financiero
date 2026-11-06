-- Compras · Catálogos · Generales (antes de Proveedores):
--   * Clasificación compras y Tipo documento pasan de Registros › Compras a Catálogos › Generales.
--   * Tipos de medida, Clasificación de productos (clasificaciones y tipos), Presentaciones y Tipos de
--     precios: son las mismas pantallas y tablas de Facturación › Catálogos › Productos (un solo
--     catálogo para compras y ventas). Cada rol recibe en Compras los permisos que ya tiene en Facturación.
--   * Parámetros módulo (nueva): por empresa, los encargados de compras, pedidos y facturación (con su
--     usuario), quién recibe los traslados, la transacción principal de ventas y los correos de aviso de
--     orden cotizada y autorizada. Sus permisos se copian de Clasificación compras.
-- Se ejecuta después del script 100. Se puede ejecutar de nuevo.

create table if not exists public.parametros_compras (
  id                     bigint generated always as identity primary key,
  organizacion_id        bigint not null references public.organizaciones (id),
  localidad_id           bigint not null unique,
  encargado_compras      text,
  usuario_compras_id     uuid references public.perfiles (id) on delete set null,
  encargado_pedidos      text,
  usuario_pedidos_id     uuid references public.perfiles (id) on delete set null,
  encargado_facturacion  text,
  usuario_facturacion_id uuid references public.perfiles (id) on delete set null,
  recibe_traslados       text,
  transaccion_ventas_id  bigint references public.transacciones_contables (id) on delete set null,
  avisos_cotizado        text,
  avisos_autorizado      text,
  creado_por uuid, creado_por_nombre text, creado_en timestamptz,
  modificado_por uuid, modificado_por_nombre text, modificado_en timestamptz,
  foreign key (localidad_id, organizacion_id) references public.localidades (id, organizacion_id)
);

create or replace function public.preparar_parametros_compras() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then new.organizacion_id := old.organizacion_id; new.localidad_id := old.localidad_id; end if;
  select organizacion_id into new.organizacion_id from public.localidades where id = new.localidad_id;
  if new.organizacion_id is null then raise exception 'La empresa no existe.'; end if;
  new.encargado_compras := nullif(upper(trim(new.encargado_compras)), '');
  new.encargado_pedidos := nullif(upper(trim(new.encargado_pedidos)), '');
  new.encargado_facturacion := nullif(upper(trim(new.encargado_facturacion)), '');
  new.recibe_traslados := nullif(upper(trim(new.recibe_traslados)), '');
  if exists (select 1 from unnest(array[new.usuario_compras_id, new.usuario_pedidos_id, new.usuario_facturacion_id]) u
             where u is not null and not exists (select 1 from public.perfiles p where p.id = u and p.organizacion_id = new.organizacion_id)) then
    raise exception 'Los usuarios encargados deben ser de la organización de la empresa.';
  end if;
  if new.transaccion_ventas_id is not null and not exists (
       select 1 from public.transacciones_contables where id = new.transaccion_ventas_id and localidad_id = new.localidad_id) then
    raise exception 'La transacción de ventas debe ser de la misma empresa.';
  end if;
  -- Avisos: correos separados por coma.
  new.avisos_cotizado := nullif(regexp_replace(lower(trim(coalesce(new.avisos_cotizado, ''))), '\s*[,;]\s*', ', ', 'g'), '');
  new.avisos_autorizado := nullif(regexp_replace(lower(trim(coalesce(new.avisos_autorizado, ''))), '\s*[,;]\s*', ', ', 'g'), '');
  if exists (select 1 from unnest(string_to_array(coalesce(new.avisos_cotizado, '') || ', ' || coalesce(new.avisos_autorizado, ''), ', ')) c
             where c <> '' and c !~ '^[^@\s,]+@[^@\s,]+\.[^@\s,]+$') then
    raise exception 'Los avisos deben ser correos válidos, separados por coma.';
  end if;
  return new;
end;
$$;
drop trigger if exists parametros_compras_preparar on public.parametros_compras;
create trigger parametros_compras_preparar before insert or update on public.parametros_compras
  for each row execute function public.preparar_parametros_compras();
drop trigger if exists parametros_compras_auditar on public.parametros_compras;
create trigger parametros_compras_auditar before insert or update on public.parametros_compras
  for each row execute function public.auditar();

alter table public.parametros_compras enable row level security;
drop policy if exists "parametros_compras: leer" on public.parametros_compras;
drop policy if exists "parametros_compras: crear" on public.parametros_compras;
drop policy if exists "parametros_compras: modificar" on public.parametros_compras;
create policy "parametros_compras: leer" on public.parametros_compras for select to authenticated using (public.usuario_activo());
create policy "parametros_compras: crear" on public.parametros_compras for insert to authenticated with check (public.puede_editar_catalogos());
create policy "parametros_compras: modificar" on public.parametros_compras for update to authenticated
  using (public.puede_editar_catalogos()) with check (public.puede_editar_catalogos());
grant select, insert, update on public.parametros_compras to authenticated;

-- Menú y matriz de accesos (Roles módulos). Cada opción se agrega solo si falta, así el script se puede
-- ejecutar de nuevo (y agrega Productos y servicios donde ya se había ejecutado).
do $migra$
declare
  v_com bigint;
  v_fac bigint;
  v_ini integer;
  v_ya integer;
  r record;
  v_id bigint;
  v_n integer := 0;
begin
  select id into v_com from public.modulos_sistema where siglas = 'COM' and modulo_mayor_id is null;
  select id into v_fac from public.modulos_sistema where siglas = 'FAC' and modulo_mayor_id is null;
  if v_com is null then raise notice 'No existe el módulo de Compras.'; return; end if;
  create temp table t_generales (pos integer, clave text, nombre text, origen text) on commit drop;
  insert into t_generales values
    (0, 'clasificaciones-compra', 'Clasificación compras', 'x'),
    (1, 'tipos-documento-compra', 'Tipo documento', 'x'),
    (2, 'tipos-de-medida', 'Tipos de medida', 'tipos-de-medida'),
    (3, 'clasificaciones-y-tipos', 'Clasificación de productos', 'clasificaciones-y-tipos'),
    (4, 'presentaciones-productos', 'Presentaciones', 'presentaciones-productos'),
    (5, 'tipos-de-precio', 'Tipos de precios', 'tipos-de-precio'),
    (6, 'productos-y-servicios', 'Productos y servicios', 'productos-y-servicios'),
    (7, 'parametros-compras', 'Parámetros módulo', null);

  -- Generales va antes de Proveedores: se abren los lugares que falten en el orden.
  select min(orden) into v_ini from public.opciones_sistema where modulo_id = v_com and grupo = 'catalogos';
  if v_ini is null then v_ini := coalesce((select max(orden) from public.opciones_sistema), 0) + 1; end if;
  select count(*) into v_ya from public.opciones_sistema where modulo_id = v_com and grupo = 'catalogos' and subgrupo = 'Generales';
  update public.opciones_sistema o set orden = orden + (8 - v_ya)
  where o.orden >= v_ini and not (o.modulo_id = v_com and o.grupo = 'catalogos' and o.subgrupo = 'Generales')
    and not (o.modulo_id = v_com and o.clave in ('clasificaciones-compra', 'tipos-documento-compra'));

  -- Clasificación compras y Tipo documento pasan de Registros a Catálogos › Generales.
  update public.opciones_sistema o set grupo = 'catalogos', subgrupo = 'Generales', orden = v_ini + t.pos
  from t_generales t where o.modulo_id = v_com and o.clave = t.clave and t.origen = 'x';

  for r in select * from t_generales where origen is distinct from 'x' order by pos loop
    select id into v_id from public.opciones_sistema where modulo_id = v_com and grupo = 'catalogos' and clave = r.clave;
    if v_id is not null then
      update public.opciones_sistema set subgrupo = 'Generales', orden = v_ini + r.pos where id = v_id;
      continue;
    end if;
    insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
    values (v_com, 'catalogos', 'Generales', r.clave, r.nombre, v_ini + r.pos)
    returning id into v_id;
    -- Permisos: los mismos que el rol tiene en la pantalla de Facturación (o en Clasificación compras).
    insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
    select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir
    from public.rol_accesos a join public.opciones_sistema o on o.id = a.opcion_id
    where (r.origen is not null and o.modulo_id = v_fac and o.clave = r.origen)
       or (r.origen is null and o.modulo_id = v_com and o.clave = 'clasificaciones-compra')
    on conflict do nothing;
    v_n := v_n + 1;
  end loop;
  raise notice '%', format('Compras › Catálogos › Generales: %s opciones nuevas (8 en total).', v_n);
end;
$migra$;

notify pgrst, 'reload schema';
