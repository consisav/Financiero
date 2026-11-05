-- Administración · Tickets · Visualización General: la opción del menú (al final del grupo Tickets).
-- La pantalla lee los tickets con su asignación y movimientos. Se ejecuta después del script 73.
insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
select m.id, 'tickets', 'Tickets', 'tickets-visualizacion', 'Visualización General', coalesce((select max(orden) from public.opciones_sistema), 0) + 1
from public.modulos_sistema m
where m.siglas = 'ADM' and m.modulo_mayor_id is null
  and not exists (select 1 from public.opciones_sistema o where o.clave = 'tickets-visualizacion' and o.modulo_id = m.id);

notify pgrst, 'reload schema';
