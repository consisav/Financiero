-- Administración concentra lo general del sistema:
--   Tickets (Generación · Asignación · Seguimiento · Cierre) sale de Contabilidad · Catálogos y
--   queda como grupo propio de Administración, después de Catálogos y antes de Registros.
--   Los catálogos comunes (Usuarios, Módulos, Parámetros, Geografía), que aparecían en todos los
--   módulos, quedan solo en Administración.
-- Los accesos por rol se conservan: son las mismas opciones. Se ejecuta después del script 47.

alter table public.opciones_sistema drop constraint if exists opciones_sistema_grupo_check;
alter table public.opciones_sistema add constraint opciones_sistema_grupo_check
  check (grupo in ('catalogos', 'tickets', 'registros', 'mantenimientos', 'procesos', 'reportes', 'ayuda', 'bancos', 'cheques', 'cajas'));

do $$
declare
  v_adm bigint := (select id from public.modulos_sistema where siglas = 'ADM' and modulo_mayor_id is null);
begin
  if v_adm is null then
    raise exception 'Falta el módulo Administración: ejecuta primero el script 47.';
  end if;

  update public.opciones_sistema
     set modulo_id = v_adm, grupo = 'tickets', subgrupo = 'Tickets'
   where clave in ('tickets-generacion', 'tickets-asignacion', 'tickets-seguimiento', 'tickets-cierre');

  -- Las opciones comunes (sin módulo) pasan a Administración.
  update public.opciones_sistema
     set modulo_id = v_adm
   where modulo_id is null and grupo = 'catalogos';
end $$;

notify pgrst, 'reload schema';
