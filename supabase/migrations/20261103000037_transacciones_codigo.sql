-- Objetos contables · Transacciones: el código de la transacción lo define el usuario y se puede
-- modificar (único por localidad). Si se deja vacío, se asigna el siguiente (1001, 1002…).
-- Los objetos contables siguen con su número automático. Requiere el script 36.

alter table public.transacciones_contables drop constraint if exists transacciones_contables_numero_check;
alter table public.transacciones_contables add constraint transacciones_contables_numero_check check (numero > 0);

create or replace function public.numerar_objeto_contable() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(4805, new.localidad_id::integer);
    if tg_table_name = 'objetos_contables' then
      new.numero := coalesce((select max(numero) from public.objetos_contables where localidad_id = new.localidad_id), 0) + 1;
    elsif new.numero is null then
      new.numero := coalesce((select max(numero) from public.transacciones_contables where localidad_id = new.localidad_id), 1000) + 1;
    end if;
  else
    new.organizacion_id := old.organizacion_id;
    new.localidad_id := old.localidad_id;
    if tg_table_name = 'objetos_contables' or new.numero is null then
      new.numero := old.numero;
    end if;
  end if;
  if tg_table_name = 'transacciones_contables' and exists (
       select 1 from public.transacciones_contables t
       where t.localidad_id = new.localidad_id and t.numero = new.numero and t.id is distinct from new.id) then
    raise exception 'Ya existe la transacción % en esta localidad: usa otro código.', new.numero;
  end if;
  new.descripcion := upper(trim(new.descripcion));
  return new;
end;
$$;

notify pgrst, 'reload schema';
