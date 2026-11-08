-- Inventarios › Catálogos: acceso a los grupos «Generales» y «Proveedores» de Compras y al grupo «Productos» de
-- Facturación/Ventas. Son las mismas pantallas y tablas; aquí solo se registran las opciones del módulo
-- Inventarios (para Roles y accesos) con los mismos accesos que tienen en Compras o en Facturación/Ventas.
--   · Las opciones de productos que están en los dos grupos (medidas, clasificaciones, presentaciones, tipos de
--     precio y productos) se registran una sola vez, en «Productos».
--   · «Bodegas» y «Proveedores» de Inventarios (que ya existían) pasan al subgrupo «Proveedores».
--   · Las opciones de ejemplo «Productos», «Categorías» y «Unidades de medida» quedan inactivas: las sustituyen
--     las pantallas reales.
-- Se ejecuta después del script 142.
do $$
declare v_inv bigint; o record; v_ref bigint; v_id bigint; v_orden integer;
begin
  select id into v_inv from public.modulos_sistema where siglas = 'INV' order by codigo limit 1;
  if v_inv is null then raise notice 'No existe el módulo Inventarios (INV).'; return; end if;

  update public.opciones_sistema set activo = false
  where modulo_id = v_inv and grupo = 'catalogos' and clave in ('productos', 'categorias', 'unidades-de-medida');

  select coalesce(max(orden), 0) into v_orden from public.opciones_sistema;
  for o in select * from (values
      (1, 'Generales', 'clasificaciones-compra', 'Clasificación compras', 'COM'),
      (2, 'Generales', 'tipos-documento-compra', 'Tipo documento', 'COM'),
      (3, 'Generales', 'parametros-compras', 'Parámetros módulo', 'COM'),
      (4, 'Proveedores', 'proveedores', 'Proveedores', 'COM'),
      (5, 'Proveedores', 'bodegas', 'Bodegas', 'COM'),
      (6, 'Productos', 'clasificaciones-y-tipos', 'Clasificaciones y tipos', 'FAC'),
      (7, 'Productos', 'tipos-de-medida', 'Tipos de medida', 'FAC'),
      (8, 'Productos', 'tipos-de-precio', 'Tipos de precio', 'FAC'),
      (9, 'Productos', 'presentaciones-productos', 'Presentación productos', 'FAC'),
      (10, 'Productos', 'productos-y-servicios', 'Productos y servicios', 'FAC')
    ) as x(n, subgrupo, clave, nombre, origen) loop
    -- Opción de referencia (la de Compras o la de Facturación/Ventas) para copiar sus accesos.
    select s.id into v_ref from public.opciones_sistema s join public.modulos_sistema m on m.id = s.modulo_id
    where m.siglas = o.origen and s.grupo = 'catalogos' and s.clave = o.clave order by m.codigo, s.id limit 1;

    select id into v_id from public.opciones_sistema where modulo_id = v_inv and grupo = 'catalogos' and clave = o.clave;
    if v_id is null then
      insert into public.opciones_sistema (modulo_id, grupo, subgrupo, clave, nombre, orden)
      values (v_inv, 'catalogos', o.subgrupo, o.clave, o.nombre, v_orden + o.n) returning id into v_id;
    else
      update public.opciones_sistema set subgrupo = o.subgrupo, nombre = o.nombre, activo = true where id = v_id;
    end if;
    if v_ref is not null then
      insert into public.rol_accesos (rol_id, opcion_id, ver, crear, modificar, anular, imprimir)
      select a.rol_id, v_id, a.ver, a.crear, a.modificar, a.anular, a.imprimir from public.rol_accesos a where a.opcion_id = v_ref
      on conflict do nothing;
    end if;
  end loop;
  raise notice 'Inventarios › Catálogos: Generales, Proveedores y Productos.';
end;
$$;
