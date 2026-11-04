-- Módulos nuevos en el menú: Administración (antes de Contabilidad), Presupuesto y flujo de
-- efectivo (debajo de Facturación) y Activos fijos (debajo de Inventarios).
--   modulos_sistema: ADM Administración y PFE Presupuesto y flujo de efectivo como módulos
--   principales; Activos (ACT) ya existe y pasa a llamarse ACTIVOS FIJOS.
--   rol_modulos: cada rol recibe en los tres módulos los permisos que tiene en Contabilidad.
-- Se ejecuta después del script 46.

do $$
declare
  v_codigo integer;
begin
  if not exists (select 1 from public.modulos_sistema where siglas = 'ADM' and modulo_mayor_id is null) then
    select min(n) into v_codigo from generate_series(9, 99) n where not exists (select 1 from public.modulos_sistema where codigo = n);
    insert into public.modulos_sistema (codigo, siglas, descripcion) values (v_codigo, 'ADM', 'ADMINISTRACIÓN');
  end if;
  if not exists (select 1 from public.modulos_sistema where siglas = 'PFE' and modulo_mayor_id is null) then
    select min(n) into v_codigo from generate_series(9, 99) n where not exists (select 1 from public.modulos_sistema where codigo = n);
    insert into public.modulos_sistema (codigo, siglas, descripcion) values (v_codigo, 'PFE', 'PRESUPUESTO Y FLUJO DE EFECTIVO');
  end if;
  if exists (select 1 from public.modulos_sistema where siglas = 'ACT' and modulo_mayor_id is null) then
    update public.modulos_sistema set descripcion = 'ACTIVOS FIJOS' where siglas = 'ACT' and modulo_mayor_id is null;
  else
    select min(n) into v_codigo from generate_series(9, 99) n where not exists (select 1 from public.modulos_sistema where codigo = n);
    insert into public.modulos_sistema (codigo, siglas, descripcion) values (v_codigo, 'ACT', 'ACTIVOS FIJOS');
  end if;
end $$;

insert into public.rol_modulos (rol_id, modulo, puede_ver, puede_editar)
select r.rol_id, m.modulo, r.puede_ver, r.puede_editar
from public.rol_modulos r
cross join (values ('administracion'), ('presupuesto-flujo'), ('activos-fijos')) as m (modulo)
where r.modulo = 'contabilidad'
on conflict (rol_id, modulo) do nothing;

notify pgrst, 'reload schema';
