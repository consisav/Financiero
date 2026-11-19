-- Organización 2 (Hospital Miraflores), lote del 05-11 al 17-11-2026 («Datos HM del 05-11-2026 al 17-11-2026»): mismo proceso de los scripts 216 y 293, solo con los registros de este lote.
-- Script 315 · Organización 2 (Hospital Miraflores): encabezados de los cierres contables del sistema anterior, de «CON_CIERRES.xls»
--   (11 cierres: 2 tipo 10: 11; organización 4 de Infinity-NaN a -Infinity-NaN, organización 7 de Infinity-NaN a -Infinity-NaN)
--   → cierres_contables_anteriores, con la lógica de los scripts 216 y 240: año, mes, tipo de cierre, resultado del ejercicio, fecha y usuario.
--   Todas sus columnas ya existen (script 215). Tipos de cierre usados: 10 (catálogo común, script 224). Sus saldos los carga el script 267.
--   No se marcan meses cerrados en cierres_mes (igual que los scripts 215 y 240). Se puede ejecutar de nuevo: actualiza.
set lock_timeout = '20s';

do $tipos$
declare v_faltan text;
begin
  select string_agg(t::text, ', ') into v_faltan from unnest(array[10]) t where not exists (select 1 from public.tipos_cierre x where x.codigo = t);
  if v_faltan is not null then raise exception 'Tipos de cierre que no existen (ejecuta antes el script 224): %.', v_faltan; end if;
end $tipos$;

insert into public.cierres_contables_anteriores (organizacion_id, localidad_id, anio, mes, tipo_cierre, resultado_ejercicio, fecha, usuario)
select l.organizacion_id, l.id, v.anio, v.mes, v.tipo, v.res, (v.f::timestamp at time zone 'America/Guatemala'), v.usr
from (values
  (1::integer, 2022::integer, 1::integer, 10::integer, 0::numeric, '2026-11-11 08:25:29'::text, 'SYS'::text),
  (1, 2022, 2, 10, 0, '2026-11-11 08:25:30', 'SYS'),
  (1, 2022, 3, 10, 0, '2026-11-11 08:25:30', 'SYS'),
  (1, 2022, 4, 10, 0, '2026-11-11 08:25:31', 'SYS'),
  (1, 2022, 5, 10, 0, '2026-11-11 08:25:31', 'SYS'),
  (1, 2022, 6, 10, 0, '2026-11-11 08:25:31', 'SYS'),
  (1, 2022, 7, 10, 0, '2026-11-11 08:25:32', 'SYS'),
  (1, 2022, 8, 10, 0, '2026-11-11 08:25:32', 'SYS'),
  (1, 2022, 9, 10, 0, '2026-11-11 08:25:33', 'SYS'),
  (1, 2022, 10, 10, 0, '2026-11-11 08:25:33', 'SYS'),
  (1, 2022, 11, 10, 0, '2026-11-11 08:25:33', 'SYS')
) as v (loc, anio, mes, tipo, res, f, usr)
join public.organizaciones g on g.codigo::text = '2' join public.localidades l on l.organizacion_id = g.id and l.correlativo = v.loc
where exists (select 1 from public.tipos_cierre x where x.codigo = v.tipo)
on conflict (localidad_id, anio, mes, tipo_cierre) do update set resultado_ejercicio = excluded.resultado_ejercicio, fecha = excluded.fecha, usuario = excluded.usuario;

select o.codigo::text as organizacion, count(c.id) as cierres
from public.organizaciones o left join public.cierres_contables_anteriores c on c.organizacion_id = o.id
where o.codigo::text in ('2') group by o.codigo order by 1;
