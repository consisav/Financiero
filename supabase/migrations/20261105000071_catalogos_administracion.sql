-- Administración · Catálogos: Geografía y Organizaciones pasan al subgrupo Parámetros (el subgrupo
-- Geografía desaparece); así se agrupan también en Roles módulos. Se ejecuta después del script 70.
update public.opciones_sistema o set subgrupo = 'Parámetros'
from public.modulos_sistema m
where m.id = o.modulo_id and m.siglas = 'ADM' and m.modulo_mayor_id is null
  and o.clave in ('geografia', 'organizaciones');

notify pgrst, 'reload schema';
