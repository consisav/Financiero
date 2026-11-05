-- Compras · Registros: el grupo «Procesar Compras» (debajo de Órdenes de compra) reúne Ingreso de
-- compras, Regularización anticipos, Notas crédito compras, Productos en consignación y
-- Contraseñas de pago; así se agrupan también en Roles módulos. Se ejecuta después del script 65.
update public.opciones_sistema o set subgrupo = 'Procesar Compras'
from public.modulos_sistema m
where m.id = o.modulo_id and m.siglas = 'COM' and m.modulo_mayor_id is null
  and o.clave in ('facturas-compra', 'regularizacion-anticipos', 'notas-credito-compras', 'productos-consignacion', 'contrasenas-pago');

notify pgrst, 'reload schema';
