-- Parámetros generales y Tipos de cambio pasan de Administración · Catálogos · Parámetros a
-- Contabilidad · Catálogos, en su propio subgrupo «Parámetros» (antes de Cuentas y CC).
-- Se mueven las mismas opciones, así se conservan los accesos de roles y usuarios.
-- Se ejecuta después del script 85.
update public.opciones_sistema o set
  modulo_id = (select c.id from public.modulos_sistema c where c.siglas = 'CON' and c.modulo_mayor_id is null),
  subgrupo = 'Parámetros',
  orden = case o.clave when 'parametros' then 7 else 8 end
from public.modulos_sistema m
where m.id = o.modulo_id and m.siglas = 'ADM' and m.modulo_mayor_id is null
  and o.grupo = 'catalogos' and o.clave in ('parametros', 'monedas-y-tipos-de-cambio');

notify pgrst, 'reload schema';
