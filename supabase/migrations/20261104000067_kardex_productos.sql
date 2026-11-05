-- Compras · Mantenimientos · Kardex de Productos (opción del menú, subgrupo Inventarios; la pantalla
-- lee inventario_movimientos y sus documentos de origen) y localidades.tipo_venta (qué vende la
-- empresa: medicamentos, productos perecederos o no perecederos). Se ejecuta después del script 66.
insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
select m.id, 'mantenimientos', 'Inventarios', 'kardex-productos', 'Kardex de Productos', coalesce((select max(orden) from public.opciones_sistema), 0) + 1
from public.modulos_sistema m
where m.siglas = 'COM' and m.modulo_mayor_id is null
  and not exists (select 1 from public.opciones_sistema o where o.clave = 'kardex-productos' and o.modulo_id = m.id);

-- Localidades (empresas): qué venden (medicamentos, productos perecederos o no perecederos).
alter table public.localidades add column if not exists tipo_venta text;
alter table public.localidades drop constraint if exists localidades_tipo_venta_check;
alter table public.localidades add constraint localidades_tipo_venta_check check (tipo_venta in ('MEDICAMENTOS', 'PERECEDEROS', 'NO PERECEDEROS'));

notify pgrst, 'reload schema';
