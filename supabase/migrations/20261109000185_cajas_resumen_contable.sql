-- 185 · Resumen contable de las subcajas de caja chica: líneas del detalle contable, debe y haber de cada subcaja.
--   La pantalla Cajas lo usa para la síntesis de cajas y subcajas con información (documentos y detalle contable) y para abrir
--   directo en su detalle contable la subcaja migrada que no tiene documentos. Solo lectura; respeta los permisos de las tablas.
--   Se ejecuta después del script 54 (cajas chicas). Puede ejecutarse de nuevo.

create or replace view public.caja_periodos_contable with (security_invoker = true) as
select p.id, p.caja_id, p.localidad_id,
       count(l.id)::integer as lineas,
       coalesce(sum(l.debe), 0)::numeric(18, 2) as debe,
       coalesce(sum(l.haber), 0)::numeric(18, 2) as haber
from public.caja_periodos p
left join public.caja_lineas l on l.periodo_id = p.id
group by p.id, p.caja_id, p.localidad_id;

grant select on public.caja_periodos_contable to authenticated;

notify pgrst, 'reload schema';
