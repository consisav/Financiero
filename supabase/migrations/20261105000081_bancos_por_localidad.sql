-- Caja y Bancos · Bancos por organización y localidad (empresa).
--   El catálogo de bancos era común; ahora cada localidad tiene el suyo y el código del banco es
--   propio de cada localidad. Los bancos comunes se copian a cada localidad existente y las cuentas
--   bancarias, proveedores y compras pasan a usar el banco (mismo código) de su localidad; los
--   comunes que queden sin uso se eliminan.
--   Cada localidad nueva recibe los bancos de otra localidad de su organización (o de la primera).
--   Un registro que llega con el banco de otra localidad toma el del mismo código de la suya (si no
--   existe, se crea copiándolo).
-- Escribir: administrador. Se ejecuta después del script 80.

alter table public.bancos add column if not exists organizacion_id bigint references public.organizaciones (id);
alter table public.bancos add column if not exists localidad_id bigint references public.localidades (id);
alter table public.bancos drop constraint if exists bancos_codigo_key;
drop index if exists public.bancos_nombre_key;

-- ---------- Datos: un juego de bancos por localidad ----------
do $$
declare v_comunes integer;
begin
  select count(*) into v_comunes from public.bancos where localidad_id is null;
  if v_comunes > 0 then
    insert into public.bancos (codigo, nombre, siglas, costo_transferencia, activo, organizacion_id, localidad_id)
    select b.codigo, b.nombre, b.siglas, b.costo_transferencia, b.activo, l.organizacion_id, l.id
    from public.bancos b cross join public.localidades l
    where b.localidad_id is null
      and not exists (select 1 from public.bancos x where x.localidad_id = l.id and x.codigo = b.codigo);
    -- Cada registro usa el banco (mismo código) de su localidad.
    perform set_config('fin.compra', 'si', true);
    update public.cuentas_bancarias r set banco_id = n.id
    from public.bancos v, public.bancos n
    where v.id = r.banco_id and v.localidad_id is null and n.localidad_id = r.localidad_id and n.codigo = v.codigo;
    update public.proveedores r set banco_id = n.id
    from public.bancos v, public.bancos n
    where v.id = r.banco_id and v.localidad_id is null and n.localidad_id = r.localidad_id and n.codigo = v.codigo;
    update public.compras r set banco_destino_id = n.id
    from public.bancos v, public.bancos n
    where v.id = r.banco_destino_id and v.localidad_id is null and n.localidad_id = r.localidad_id and n.codigo = v.codigo;
    perform set_config('fin.compra', '', true);
    delete from public.bancos b where b.localidad_id is null
      and not exists (select 1 from public.cuentas_bancarias r where r.banco_id = b.id)
      and not exists (select 1 from public.proveedores r where r.banco_id = b.id)
      and not exists (select 1 from public.compras r where r.banco_destino_id = b.id);
  end if;
end;
$$;

create unique index if not exists bancos_localidad_codigo_uk on public.bancos (localidad_id, codigo);
create unique index if not exists bancos_localidad_nombre_uk on public.bancos (localidad_id, lower(nombre));
create index if not exists bancos_organizacion_idx on public.bancos (organizacion_id);

create or replace function public.preparar_banco() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.organizacion_id := old.organizacion_id;
    new.localidad_id := old.localidad_id;
  end if;
  if new.localidad_id is null then raise exception 'Elige la empresa (localidad) del banco.'; end if;
  select l.organizacion_id into new.organizacion_id from public.localidades l where l.id = new.localidad_id;
  if new.organizacion_id is null then raise exception 'La localidad no existe.'; end if;
  new.nombre := upper(trim(new.nombre));
  new.siglas := nullif(upper(trim(new.siglas)), '');
  return new;
end;
$$;
drop trigger if exists bancos_preparar on public.bancos;
create trigger bancos_preparar before insert or update on public.bancos for each row execute function public.preparar_banco();

-- Banco de un registro: siempre el de su localidad (mismo código; se crea si falta).
create or replace function public.ajustar_banco_localidad() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_banco bigint; b public.bancos; v_id bigint;
begin
  if tg_table_name = 'compras' then v_banco := new.banco_destino_id; else v_banco := new.banco_id; end if;
  if v_banco is null or new.localidad_id is null then return new; end if;
  select * into b from public.bancos where id = v_banco;
  if b.id is null or b.localidad_id is not distinct from new.localidad_id then return new; end if;
  select id into v_id from public.bancos where localidad_id = new.localidad_id and codigo = b.codigo;
  if v_id is null then
    insert into public.bancos (codigo, nombre, siglas, costo_transferencia, activo, localidad_id)
    values (b.codigo, b.nombre, b.siglas, b.costo_transferencia, b.activo, new.localidad_id)
    on conflict do nothing
    returning id into v_id;
    if v_id is null then raise exception 'La localidad ya tiene otro banco con el nombre %: elige ese banco.', b.nombre; end if;
  end if;
  if tg_table_name = 'compras' then new.banco_destino_id := v_id; else new.banco_id := v_id; end if;
  return new;
end;
$$;
drop trigger if exists cuentas_bancarias_ajustar_banco on public.cuentas_bancarias;
create trigger cuentas_bancarias_ajustar_banco before insert or update of banco_id on public.cuentas_bancarias for each row execute function public.ajustar_banco_localidad();
drop trigger if exists proveedores_ajustar_banco on public.proveedores;
create trigger proveedores_ajustar_banco before insert or update of banco_id on public.proveedores for each row execute function public.ajustar_banco_localidad();
drop trigger if exists compras_ajustar_banco on public.compras;
create trigger compras_ajustar_banco before insert or update of banco_destino_id on public.compras for each row execute function public.ajustar_banco_localidad();

-- Localidad nueva: recibe los bancos de otra localidad de su organización (o de la primera que tenga).
create or replace function public.sembrar_bancos() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_origen bigint;
begin
  select b.localidad_id into v_origen from public.bancos b join public.localidades l on l.id = b.localidad_id
  where b.localidad_id <> new.id order by (l.organizacion_id = new.organizacion_id) desc, l.id limit 1;
  if v_origen is not null then
    insert into public.bancos (codigo, nombre, siglas, costo_transferencia, activo, localidad_id)
    select b.codigo, b.nombre, b.siglas, b.costo_transferencia, b.activo, new.id
    from public.bancos b where b.localidad_id = v_origen
      and not exists (select 1 from public.bancos x where x.localidad_id = new.id and x.codigo = b.codigo);
  end if;
  return new;
end;
$$;
drop trigger if exists localidades_sembrar_bancos on public.localidades;
create trigger localidades_sembrar_bancos after insert on public.localidades for each row execute function public.sembrar_bancos();

revoke execute on function public.preparar_banco() from public, anon, authenticated;
revoke execute on function public.ajustar_banco_localidad() from public, anon, authenticated;
revoke execute on function public.sembrar_bancos() from public, anon, authenticated;

notify pgrst, 'reload schema';
