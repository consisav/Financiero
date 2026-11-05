-- Compras · Registros · Órdenes de compra: nombres nuevos de dos opciones del menú.
--   «Autorizaciones de compras» pasa a «Autorizaciones compras» y «Autorizar órdenes» a
--   «Aprobación órdenes». Las claves (y los accesos por rol) no cambian.
-- Se ejecuta después del script 61.

update public.opciones_sistema o set nombre = x.nombre
from public.modulos_sistema m,
     (values ('autorizaciones-de-compras', 'Autorizaciones compras'), ('autorizar-ordenes', 'Aprobación órdenes')) as x (clave, nombre)
where m.id = o.modulo_id and m.siglas = 'COM' and m.modulo_mayor_id is null and o.clave = x.clave;

notify pgrst, 'reload schema';
