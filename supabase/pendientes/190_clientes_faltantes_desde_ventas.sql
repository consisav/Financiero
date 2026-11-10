-- 190 · Clientes que aparecen en las ventas (facturas y recibos) pero no están en el catálogo de Clientes
--   de su empresa (localidad). Por eso no salían en las listas de valores del cliente (Recibos, Consulta de
--   Recibos, Facturas, Ventas Inteligentes…), aunque sí en los reportes, que toman el código y el nombre
--   guardados en cada factura (p. ej. 402 INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL -IGSS-, 415 HOSPITAL YARDEN).
--
--   PASO 1 (solo lectura): diagnóstico. Ejecuta solo este bloque y revisa el resultado.
--   PASO 2: crea en el catálogo los clientes que faltan (con el código, NIT y nombre de su factura más
--           reciente) y liga a ellos las facturas y recibos que quedaron sin cliente_id.
--   Se puede ejecutar varias veces: solo agrega lo que falta.
--   ¿Ya se procesó? Si el PASO 1 no devuelve filas y el resultado final da 0 facturas sin cliente, ya está aplicado.
--   Si el PASO 2 falla, no queda nada a medias (todo va en una transacción): corrige y vuelve a ejecutarlo.
--   Versión 2: un solo cliente por NIT (corrige «duplicate key value violates unique constraint clientes_documento_key»).

-- =====================  PASO 1 · DIAGNÓSTICO  =====================
with ventas as (
  select f.localidad_id, f.cliente_codigo, max(f.nombre) as nombre, count(*) as facturas,
         count(*) filter (where f.cliente_id is null) as sin_cliente_id
  from public.facturas_venta f
  where f.cliente_codigo is not null
  group by f.localidad_id, f.cliente_codigo
)
select l.codigo as empresa, v.cliente_codigo, v.nombre, v.facturas, v.sin_cliente_id,
       (select string_agg(l2.codigo, ', ') from public.clientes c2 join public.localidades l2 on l2.id = c2.localidad_id
         where c2.codigo = v.cliente_codigo and c2.localidad_id <> v.localidad_id) as existe_en_otra_empresa
from ventas v
join public.localidades l on l.id = v.localidad_id
where not exists (select 1 from public.clientes c where c.localidad_id = v.localidad_id and c.codigo = v.cliente_codigo)
order by l.codigo, v.cliente_codigo;

-- =====================  PASO 2 · CORRECCIÓN  =====================
-- (Selecciona desde aquí hasta el final y ejecútalo después de revisar el paso 1.)
begin;

-- 2.1 Clientes faltantes, con los datos de su factura más reciente.
--     Varios códigos con el mismo NIT: se crea solo el de código menor (el catálogo no admite dos clientes con el
--     mismo NIT en una empresa); las facturas de los demás códigos se ligan a él por NIT en 2.2.
--     El NIT se compara sin guiones ni espacios («234285-5» = «2342855»), también contra los clientes que ya existen.
with ult as (
  select distinct on (f.localidad_id, f.cliente_codigo)
         f.organizacion_id, f.localidad_id, f.cliente_codigo,
         upper(trim(coalesce(f.nit, ''))) as nit,
         upper(regexp_replace(coalesce(f.nit, ''), '[^0-9A-Za-z]', '', 'g')) as nitn,
         trim(f.nombre) as nombre
  from public.facturas_venta f
  where f.cliente_codigo is not null and f.cliente_codigo > 0 and coalesce(trim(f.nombre), '') <> ''
  order by f.localidad_id, f.cliente_codigo, f.fecha_emision desc, f.id desc
), nuevos as (
  select u.*, case when u.nitn in ('', 'CF') then 'CF' else 'NIT' end as tipo_doc,
         case when u.nitn in ('', 'CF') then 'CF' else u.nit end as doc
  from ult u
  where not exists (select 1 from public.clientes c where c.localidad_id = u.localidad_id and c.codigo = u.cliente_codigo)
), unicos as (
  select distinct on (n.localidad_id, case when n.tipo_doc = 'CF' then 'CF#' || n.cliente_codigo else n.nitn end) n.*
  from nuevos n
  order by n.localidad_id, case when n.tipo_doc = 'CF' then 'CF#' || n.cliente_codigo else n.nitn end, n.cliente_codigo
)
insert into public.clientes (organizacion_id, localidad_id, codigo, tipo_documento, documento, nombre, estado)
select n.organizacion_id, n.localidad_id, n.cliente_codigo, n.tipo_doc, n.doc, n.nombre, 'ACTIVO'
from unicos n
where n.tipo_doc = 'CF'
   or not exists (select 1 from public.clientes c
                  where c.localidad_id = n.localidad_id and c.tipo_documento <> 'CF'
                    and upper(regexp_replace(coalesce(c.documento, ''), '[^0-9A-Za-z]', '', 'g')) = n.nitn)
on conflict do nothing;

-- 2.2 Facturas sin cliente_id: por código y, si no, por NIT (sin guiones ni espacios).
update public.facturas_venta f set cliente_id = c.id
from public.clientes c
where f.cliente_id is null and c.localidad_id = f.localidad_id and c.codigo = f.cliente_codigo;

update public.facturas_venta f set cliente_id = x.id
from (
  select distinct on (c.localidad_id, upper(regexp_replace(coalesce(c.documento, ''), '[^0-9A-Za-z]', '', 'g')))
         c.id, c.localidad_id, upper(regexp_replace(coalesce(c.documento, ''), '[^0-9A-Za-z]', '', 'g')) as nitn
  from public.clientes c
  where c.tipo_documento <> 'CF'
  order by c.localidad_id, upper(regexp_replace(coalesce(c.documento, ''), '[^0-9A-Za-z]', '', 'g')), c.codigo
) x
where f.cliente_id is null and x.localidad_id = f.localidad_id
  and x.nitn <> '' and x.nitn = upper(regexp_replace(coalesce(f.nit, ''), '[^0-9A-Za-z]', '', 'g'));

-- 2.3 Recibos sin cliente_id: el cliente de las facturas que pagaron (si es uno solo).
update public.recibos_venta r set cliente_id = x.cliente_id
from (
  select p.recibo_id, min(f.cliente_id) as cliente_id
  from public.factura_venta_pagos p join public.facturas_venta f on f.id = p.factura_id
  where f.cliente_id is not null
  group by p.recibo_id
  having count(distinct f.cliente_id) = 1
) x
where r.id = x.recibo_id and r.cliente_id is null;

commit;

-- Resultado: lo que todavía quedó sin cliente (debería ser poco o nada).
select 'facturas sin cliente' as que, count(*) from public.facturas_venta where cliente_id is null
union all
select 'recibos sin cliente', count(*) from public.recibos_venta where cliente_id is null;
