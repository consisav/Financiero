-- Administración · Reportes y gráficas: Organizaciones y localidades, Módulos y sub módulos, Roles
-- módulos y Listado de usuarios (subgrupo Reportes). Se ejecuta después del script 71.
insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
select m.id, 'reportes', 'Reportes', x.clave, x.nombre, coalesce((select max(orden) from public.opciones_sistema), 0) + x.n
from public.modulos_sistema m
cross join (values (1, 'reporte-organizaciones', 'Organizaciones y localidades'), (2, 'reporte-modulos', 'Módulos y sub módulos'),
                   (3, 'reporte-roles', 'Roles módulos'), (4, 'reporte-usuarios', 'Listado de usuarios')) as x (n, clave, nombre)
where m.siglas = 'ADM' and m.modulo_mayor_id is null
  and not exists (select 1 from public.opciones_sistema o where o.clave = x.clave and o.modulo_id = m.id);

notify pgrst, 'reload schema';
