-- Compras · Mantenimientos · Análisis de Costos: la opción del menú (subgrupo Inventarios, debajo del
-- Kardex). La pantalla lee los artículos de las compras y las notas de crédito. Se ejecuta después
-- del script 69.
insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
select m.id, 'mantenimientos', 'Inventarios', 'analisis-costos', 'Análisis de Costos', coalesce((select max(orden) from public.opciones_sistema), 0) + 1
from public.modulos_sistema m
where m.siglas = 'COM' and m.modulo_mayor_id is null
  and not exists (select 1 from public.opciones_sistema o where o.clave = 'analisis-costos' and o.modulo_id = m.id);

notify pgrst, 'reload schema';
