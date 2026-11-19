-- Lote del 05-11 al 17-11-2026 («Datos Tecnoasla - AAPOS del 05-11-2026 al 17-11-2026»): mismo proceso del script 269, solo con los registros de este lote.
-- Script 293 · Organizaciones 4 (Tecnoalsa) y 7 (AAPOS): encabezados de los cierres contables del sistema anterior, de «CON_CIERRES.xlsx»
--   (2 cierres: 4 tipo 1: 1, 4 tipo 4: 1; organización 4 de 2026-11 a 2026-11, organización 7 de Infinity-NaN a -Infinity-NaN)
--   → cierres_contables_anteriores, con la lógica de los scripts 216 y 240: año, mes, tipo de cierre, resultado del ejercicio, fecha y usuario.
--   Todas sus columnas ya existen (script 215). Tipos de cierre usados: 1, 4 (catálogo común, script 224). Sus saldos los carga el script 267.
--   No se marcan meses cerrados en cierres_mes (igual que los scripts 215 y 240). Se puede ejecutar de nuevo: actualiza.
set lock_timeout = '20s';

do $tipos$
declare v_faltan text;
begin
  select string_agg(t::text, ', ') into v_faltan from unnest(array[1, 4]) t where not exists (select 1 from public.tipos_cierre x where x.codigo = t);
  if v_faltan is not null then raise exception 'Tipos de cierre que no existen (ejecuta antes el script 224): %.', v_faltan; end if;
end $tipos$;

insert into public.cierres_contables_anteriores (organizacion_id, localidad_id, anio, mes, tipo_cierre, resultado_ejercicio, fecha, usuario)
select l.organizacion_id, l.id, v.anio, v.mes, v.tipo, v.res, (v.f::timestamp at time zone 'America/Guatemala'), v.usr
from (values
  (1::integer, 2026::integer, 11::integer, 1::integer, 0::numeric, '2026-11-17 10:24:25'::text, 'SYS'::text),
  (1, 2026, 11, 4, 0, '2026-11-17 10:24:25', 'SYS')
) as v (loc, anio, mes, tipo, res, f, usr)
join public.organizaciones g on g.codigo::text = '4' join public.localidades l on l.organizacion_id = g.id and l.correlativo = v.loc
where exists (select 1 from public.tipos_cierre x where x.codigo = v.tipo)
on conflict (localidad_id, anio, mes, tipo_cierre) do update set resultado_ejercicio = excluded.resultado_ejercicio, fecha = excluded.fecha, usuario = excluded.usuario;

select o.codigo::text as organizacion, count(c.id) as cierres
from public.organizaciones o left join public.cierres_contables_anteriores c on c.organizacion_id = o.id
where o.codigo::text in ('4', '7') group by o.codigo order by 1;
