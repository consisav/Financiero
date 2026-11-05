-- Contabilidad · Catálogos · Tipos de cuentas por organización y localidad (empresa).
--   Los tipos de cuenta que eran comunes se copian a cada localidad existente; las cuentas pasan a
--   usar el tipo de su propia localidad (mismo código) y los comunes se eliminan.
--   Cada localidad nueva recibe los tipos de otra localidad de su organización (o de la primera).
--   Una cuenta que llega con el tipo de otra localidad (réplicas, plantillas) toma el del mismo
--   código de su localidad; si no existe, se crea copiándolo.
--   copiar_tipos_cuenta: copia a una localidad los tipos que le faltan de otra.
-- Escribir: administrador. Se ejecuta después del script 74.

alter table public.tipos_cuenta add column if not exists organizacion_id bigint references public.organizaciones (id);
alter table public.tipos_cuenta add column if not exists localidad_id bigint references public.localidades (id);
alter table public.tipos_cuenta drop constraint if exists tipos_cuenta_codigo_key;

-- ---------- Datos: un juego de tipos por localidad ----------
do $$
declare v_comunes integer;
begin
  select count(*) into v_comunes from public.tipos_cuenta where localidad_id is null;
  if v_comunes > 0 then
    insert into public.tipos_cuenta (codigo, descripcion, tipo_operacion, operacion_resultado, incluye_centro_costo, activo, organizacion_id, localidad_id)
    select t.codigo, t.descripcion, t.tipo_operacion, t.operacion_resultado, t.incluye_centro_costo, t.activo, l.organizacion_id, l.id
    from public.tipos_cuenta t cross join public.localidades l
    where t.localidad_id is null
      and not exists (select 1 from public.tipos_cuenta x where x.localidad_id = l.id and x.codigo = t.codigo);
    -- Cada cuenta usa el tipo (mismo código) de la localidad de su catálogo.
    update public.cuentas c set tipo_cuenta_id = n.id
    from public.tipos_cuenta v, public.catalogos_cuentas k, public.tipos_cuenta n
    where v.id = c.tipo_cuenta_id and v.localidad_id is null
      and k.id = c.catalogo_id and n.localidad_id = k.localidad_id and n.codigo = v.codigo;
    delete from public.tipos_cuenta t where t.localidad_id is null
      and not exists (select 1 from public.cuentas c where c.tipo_cuenta_id = t.id);
  end if;
end;
$$;

-- Si quedara algún tipo común en uso, se conserva hasta reasignarlo; los demás ya son por localidad.
create unique index if not exists tipos_cuenta_localidad_codigo_uk on public.tipos_cuenta (localidad_id, codigo);
create index if not exists tipos_cuenta_organizacion_idx on public.tipos_cuenta (organizacion_id);

create or replace function public.preparar_tipo_cuenta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.organizacion_id := old.organizacion_id;
    new.localidad_id := old.localidad_id;
  end if;
  if new.localidad_id is null then raise exception 'Elige la empresa (localidad) del tipo de cuenta.'; end if;
  select l.organizacion_id into new.organizacion_id from public.localidades l where l.id = new.localidad_id;
  if new.organizacion_id is null then raise exception 'La localidad no existe.'; end if;
  new.descripcion := upper(trim(new.descripcion));
  return new;
end;
$$;
drop trigger if exists tipos_cuenta_preparar on public.tipos_cuenta;
create trigger tipos_cuenta_preparar before insert or update on public.tipos_cuenta for each row execute function public.preparar_tipo_cuenta();

-- Copia a una localidad los tipos que le faltan de otra (mismo código).
create or replace function public.copiar_tipos_cuenta(p_origen bigint, p_destino bigint) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if not public.puede_editar_catalogos() then raise exception 'Solo un administrador puede copiar tipos de cuenta.'; end if;
  if p_origen = p_destino then raise exception 'Elige una empresa distinta a la de destino.'; end if;
  insert into public.tipos_cuenta (codigo, descripcion, tipo_operacion, operacion_resultado, incluye_centro_costo, activo, localidad_id)
  select t.codigo, t.descripcion, t.tipo_operacion, t.operacion_resultado, t.incluye_centro_costo, t.activo, p_destino
  from public.tipos_cuenta t
  where t.localidad_id = p_origen and not exists (select 1 from public.tipos_cuenta x where x.localidad_id = p_destino and x.codigo = t.codigo);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Tipo de una cuenta: siempre el de la localidad de su catálogo (mismo código; se crea si falta).
create or replace function public.ajustar_tipo_cuenta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_loc bigint; t public.tipos_cuenta; v_id bigint;
begin
  if new.tipo_cuenta_id is null then return new; end if;
  select k.localidad_id into v_loc from public.catalogos_cuentas k where k.id = new.catalogo_id;
  select * into t from public.tipos_cuenta where id = new.tipo_cuenta_id;
  if v_loc is null or t.id is null or t.localidad_id is not distinct from v_loc then return new; end if;
  select id into v_id from public.tipos_cuenta where localidad_id = v_loc and codigo = t.codigo;
  if v_id is null then
    insert into public.tipos_cuenta (codigo, descripcion, tipo_operacion, operacion_resultado, incluye_centro_costo, activo, localidad_id)
    values (t.codigo, t.descripcion, t.tipo_operacion, t.operacion_resultado, t.incluye_centro_costo, t.activo, v_loc)
    returning id into v_id;
  end if;
  new.tipo_cuenta_id := v_id;
  return new;
end;
$$;
drop trigger if exists cuentas_ajustar_tipo on public.cuentas;
create trigger cuentas_ajustar_tipo before insert or update of tipo_cuenta_id, catalogo_id on public.cuentas for each row execute function public.ajustar_tipo_cuenta();

-- Localidad nueva: recibe los tipos de otra localidad de su organización (o de la primera que tenga).
create or replace function public.sembrar_tipos_cuenta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_origen bigint;
begin
  select t.localidad_id into v_origen from public.tipos_cuenta t join public.localidades l on l.id = t.localidad_id
  where t.localidad_id <> new.id order by (l.organizacion_id = new.organizacion_id) desc, l.id limit 1;
  if v_origen is not null then
    insert into public.tipos_cuenta (codigo, descripcion, tipo_operacion, operacion_resultado, incluye_centro_costo, activo, localidad_id)
    select t.codigo, t.descripcion, t.tipo_operacion, t.operacion_resultado, t.incluye_centro_costo, t.activo, new.id
    from public.tipos_cuenta t where t.localidad_id = v_origen
      and not exists (select 1 from public.tipos_cuenta x where x.localidad_id = new.id and x.codigo = t.codigo);
  end if;
  return new;
end;
$$;
drop trigger if exists localidades_sembrar_tipos_cuenta on public.localidades;
create trigger localidades_sembrar_tipos_cuenta after insert on public.localidades for each row execute function public.sembrar_tipos_cuenta();

revoke execute on function public.preparar_tipo_cuenta() from public, anon, authenticated;
revoke execute on function public.ajustar_tipo_cuenta() from public, anon, authenticated;
revoke execute on function public.sembrar_tipos_cuenta() from public, anon, authenticated;
revoke execute on function public.copiar_tipos_cuenta(bigint, bigint) from public, anon;
grant execute on function public.copiar_tipos_cuenta(bigint, bigint) to authenticated;

notify pgrst, 'reload schema';
