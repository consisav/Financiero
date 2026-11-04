-- Caja y Bancos pasa a ser un módulo principal (debajo de Contabilidad en el menú) con sus
-- sub-módulos Bancos, Cheques y Cajas. Las opciones del grupo Bancos salen de
-- Contabilidad · Registros y quedan en Caja y Bancos · Bancos, con sus accesos por rol.
-- Cada rol recibe en Caja y Bancos los mismos permisos que tiene en Contabilidad.
-- Se ejecuta después del script 43.

-- Los grupos de menú propios del módulo.
alter table public.opciones_sistema drop constraint if exists opciones_sistema_grupo_check;
alter table public.opciones_sistema add constraint opciones_sistema_grupo_check
  check (grupo in ('catalogos', 'registros', 'mantenimientos', 'procesos', 'reportes', 'ayuda', 'bancos', 'cheques', 'cajas'));

do $$
declare
  v_con bigint := (select id from public.modulos_sistema where siglas = 'CON' and modulo_mayor_id is null);
  v_cyb bigint;
  v_viejo bigint;
begin
  -- Caja y Bancos era sub-módulo de Contabilidad (101). El módulo mayor no se cambia, así que se
  -- crea como módulo principal y el sub-módulo anterior se elimina (o se desactiva si ya se usa).
  select id into v_cyb from public.modulos_sistema where siglas = 'CYB' and modulo_mayor_id is null;
  if v_cyb is null then
    insert into public.modulos_sistema (codigo, siglas, descripcion)
    values ((select min(n) from generate_series(9, 99) n where not exists (select 1 from public.modulos_sistema where codigo = n)), 'CYB', 'CAJA Y BANCOS')
    returning id into v_cyb;
  end if;
  select id into v_viejo from public.modulos_sistema where siglas = 'CYB' and modulo_mayor_id = v_con;
  if v_viejo is not null then
    begin
      delete from public.modulos_sistema where id = v_viejo;
    exception when foreign_key_violation then
      update public.modulos_sistema set activo = false, descripcion = 'CAJA Y BANCOS (MOVIDO A MÓDULO PRINCIPAL)' where id = v_viejo;
    end;
  end if;

  -- Sub-módulos.
  insert into public.modulos_sistema (codigo, siglas, descripcion, modulo_mayor_id)
  select s.codigo, s.siglas, s.descripcion, v_cyb
  from (values (901, 'BAN', 'BANCOS'), (902, 'CHE', 'CHEQUES'), (903, 'CAJ', 'CAJAS')) as s (codigo, siglas, descripcion)
  where not exists (select 1 from public.modulos_sistema x where x.modulo_mayor_id = v_cyb and x.siglas = s.siglas)
    and not exists (select 1 from public.modulos_sistema x where x.codigo = s.codigo);

  -- Las opciones de Bancos pasan al módulo (los accesos por rol se conservan: es la misma opción).
  update public.opciones_sistema
     set modulo_id = v_cyb, grupo = 'bancos', subgrupo = 'Bancos'
   where modulo_id = v_con and subgrupo = 'Bancos'
     and clave in ('cuentas-bancarias', 'depositos', 'notas-credito', 'notas-debito', 'conciliacion-bancaria', 'disponibilidad-bancaria', 'disponibilidad-integrada');
end $$;

-- Permisos del módulo por rol, iguales a los de Contabilidad.
insert into public.rol_modulos (rol_id, modulo, puede_ver, puede_editar)
select rol_id, 'caja-bancos', puede_ver, puede_editar
from public.rol_modulos
where modulo = 'contabilidad'
on conflict (rol_id, modulo) do nothing;

notify pgrst, 'reload schema';
