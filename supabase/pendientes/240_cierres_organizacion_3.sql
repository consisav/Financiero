-- Script 240 · Organización 3 (Futura Farma - Mavisa), lote del 05-11-2026 al 17-11-2026: cierres contables del sistema anterior, con la lógica del script 216.
--   · CON_CIERRES (2: 3-01 2026-01 tipo 2; 3-01 2026-01 tipo 4) → cierres_contables_anteriores. Tipos de cierre usados: 2, 4 (ya existen: scripts 215 y 216;
--     si faltara alguno se avisa y el cierre no se carga).
--   · CON_SALDOS_CIERRE (256 filas: 3-01 2026-01 tipo 2) → saldos_cierre: solo las 69 con algún monto; las 187 en cero no traen información.
--     Cada fila se liga a su cuenta (código y VERSION del catálogo de la localidad); si no existe queda el código.
--   · CON_SALDOS_CIERRE_CC (377 filas: 3-01 2026-01 tipo 4) → saldos_cierre_centros: todas vienen en cero: no hay nada que migrar.
--   No se marcan meses cerrados en cierres_mes (igual que el script 215). Se ejecuta después del script 216. Se puede ejecutar de nuevo: actualiza.
set lock_timeout = '20s';

do $tipos$
declare v_faltan text;
begin
  select string_agg(t::text, ', ') into v_faltan from unnest(array[2, 4]) t where not exists (select 1 from public.tipos_cierre x where x.codigo = t);
  if v_faltan is not null then raise notice 'Tipos de cierre que no existen (ejecuta antes el script 216): %.', v_faltan; end if;
end $tipos$;

insert into public.cierres_contables_anteriores (organizacion_id, localidad_id, anio, mes, tipo_cierre, resultado_ejercicio, fecha, usuario)
select l.organizacion_id, l.id, v.anio, v.mes, v.tipo, v.res, (v.f::timestamp at time zone 'America/Guatemala'), v.usr
from (values
  (1::integer, 2026::integer, 1::integer, 2::integer, 0::numeric, '2026-11-11 23:59:04'::text, 'OLI'::text),
  (1, 2026, 1, 4, 0, '2026-11-11 23:59:04', 'SYS')
) as v (loc, anio, mes, tipo, res, f, usr)
join public.organizaciones g on g.codigo::text = '3' join public.localidades l on l.organizacion_id = g.id and l.correlativo = v.loc
where exists (select 1 from public.tipos_cierre x where x.codigo = v.tipo)
on conflict (localidad_id, anio, mes, tipo_cierre) do update set resultado_ejercicio = excluded.resultado_ejercicio, fecha = excluded.fecha, usuario = excluded.usuario;

insert into public.saldos_cierre (organizacion_id, localidad_id, anio, mes, tipo_cierre, cuenta_codigo, version, cuenta_id, saldo_anterior, debitos, creditos, saldo_actual,
  saldo_anterior_mi, debitos_mi, creditos_mi, saldo_actual_mi, mostrar_reporte)
select l.organizacion_id, l.id, v.anio, v.mes, v.tipo, v.cta, v.ver,
  coalesce((select c.id from public.cuentas c join public.catalogos_cuentas k on k.id = c.catalogo_id where k.localidad_id = l.id and k.version = v.ver and c.codigo = v.cta limit 1),
           (select c.id from public.cuentas c join public.catalogos_cuentas k on k.id = c.catalogo_id where k.localidad_id = l.id and c.codigo = v.cta order by k.version desc limit 1)),
  v.sa, v.de, v.cr, v.sx, v.sami, v.demi, v.crmi, v.sxmi, v.mr
from (values
  (1::integer, 2026::integer, 1::integer, 2::integer, '1'::text, 1::integer, 4296012.92::numeric, 0::numeric, 0::numeric, 4296012.92::numeric, 557923.86::numeric, 0::numeric, 0::numeric, 557923.86::numeric, true::boolean),
  (1, 2026, 1, 2, '101', 1, 4277428.71, 0, 0, 4277428.71, 555510.34, 0, 0, 555510.34, true),
  (1, 2026, 1, 2, '10101', 1, 741444.1, 0, 0, 741444.1, 96291.54, 0, 0, 96291.54, true),
  (1, 2026, 1, 2, '1010102', 1, 616891.98, 0, 0, 616891.98, 80115.94, 0, 0, 80115.94, true),
  (1, 2026, 1, 2, '1010102001', 1, 319311.39, 0, 0, 319311.39, 41468.95, 0, 0, 41468.95, true),
  (1, 2026, 1, 2, '1010102002', 1, 297580.59, 0, 0, 297580.59, 38646.99, 0, 0, 38646.99, true),
  (1, 2026, 1, 2, '1010103', 1, 124552.12, 0, 0, 124552.12, 16175.6, 0, 0, 16175.6, true),
  (1, 2026, 1, 2, '1010103002', 1, 124552.12, 0, 0, 124552.12, 16175.6, 0, 0, 16175.6, true),
  (1, 2026, 1, 2, '10102', 1, 283915.22, 0, 0, 283915.22, 36872.1, 0, 0, 36872.1, true),
  (1, 2026, 1, 2, '1010201', 1, 283915.22, 0, 0, 283915.22, 36872.1, 0, 0, 36872.1, true),
  (1, 2026, 1, 2, '1010201001', 1, 283915.22, 0, 0, 283915.22, 36872.1, 0, 0, 36872.1, true),
  (1, 2026, 1, 2, '10103', 1, 1106018.39, 0, 0, 1106018.39, 143638.73, 0, 0, 143638.73, true),
  (1, 2026, 1, 2, '1010302', 1, 506018.39, 0, 0, 506018.39, 65716.67, 0, 0, 65716.67, true),
  (1, 2026, 1, 2, '1010302001', 1, 7629.81, 0, 0, 7629.81, 990.88, 0, 0, 990.88, true),
  (1, 2026, 1, 2, '1010302002', 1, 171345.13, 0, 0, 171345.13, 22252.61, 0, 0, 22252.61, true),
  (1, 2026, 1, 2, '1010302003', 1, 120744.37, 0, 0, 120744.37, 15681.09, 0, 0, 15681.09, true),
  (1, 2026, 1, 2, '1010302004', 1, 206299.08, 0, 0, 206299.08, 26792.09, 0, 0, 26792.09, true),
  (1, 2026, 1, 2, '1010304', 1, 600000, 0, 0, 600000, 77922.06, 0, 0, 77922.06, true),
  (1, 2026, 1, 2, '1010304001', 1, 600000, 0, 0, 600000, 77922.06, 0, 0, 77922.06, true),
  (1, 2026, 1, 2, '10104', 1, 1537693.47, 0, 0, 1537693.47, 199700.48, 0, 0, 199700.48, true),
  (1, 2026, 1, 2, '1010401', 1, 1353404.57, 0, 0, 1353404.57, 175766.84, 0, 0, 175766.84, true),
  (1, 2026, 1, 2, '1010401001', 1, 1339275.89, 0, 0, 1339275.89, 173931.95, 0, 0, 173931.95, true),
  (1, 2026, 1, 2, '1010401002', 1, 14128.68, 0, 0, 14128.68, 1834.89, 0, 0, 1834.89, true),
  (1, 2026, 1, 2, '1010402', 1, 184288.9, 0, 0, 184288.9, 23933.64, 0, 0, 23933.64, true),
  (1, 2026, 1, 2, '1010402001', 1, 159329.42, 0, 0, 159329.42, 20692.14, 0, 0, 20692.14, true),
  (1, 2026, 1, 2, '1010402002', 1, 24959.48, 0, 0, 24959.48, 3241.5, 0, 0, 3241.5, true),
  (1, 2026, 1, 2, '10105', 1, 608357.53, 0, 0, 608357.53, 79007.49, 0, 0, 79007.49, true),
  (1, 2026, 1, 2, '1010501', 1, 608357.53, 0, 0, 608357.53, 79007.49, 0, 0, 79007.49, true),
  (1, 2026, 1, 2, '1010501001', 1, 608357.53, 0, 0, 608357.53, 79007.49, 0, 0, 79007.49, true),
  (1, 2026, 1, 2, '102', 1, 18584.21, 0, 0, 18584.21, 2413.52, 0, 0, 2413.52, true),
  (1, 2026, 1, 2, '10201', 1, 18584.21, 0, 0, 18584.21, 2413.52, 0, 0, 2413.52, true),
  (1, 2026, 1, 2, '1020102', 1, 18584.21, 0, 0, 18584.21, 2413.52, 0, 0, 2413.52, true),
  (1, 2026, 1, 2, '1020102001', 1, 75169.25, 0, 0, 75169.25, 9762.23, 0, 0, 9762.23, true),
  (1, 2026, 1, 2, '1020102999', 1, -56585.04, 0, 0, -56585.04, -7348.71, 0, 0, -7348.71, true),
  (1, 2026, 1, 2, '1020105001', 1, 40036.75, 0, 0, 40036.75, 5199.58, 0, 0, 5199.58, true),
  (1, 2026, 1, 2, '1020105999', 1, -40036.75, 0, 0, -40036.75, -5199.58, 0, 0, -5199.58, true),
  (1, 2026, 1, 2, '1020201001', 1, 3660, 0, 0, 3660, 475.32, 0, 0, 475.32, true),
  (1, 2026, 1, 2, '1020201999', 1, -3660, 0, 0, -3660, -475.32, 0, 0, -475.32, true),
  (1, 2026, 1, 2, '2', 1, 793354.92, 0, 0, 793354.92, 103033.07, 0, 0, 103033.07, true),
  (1, 2026, 1, 2, '201', 1, 793354.92, 0, 0, 793354.92, 103033.07, 0, 0, 103033.07, true),
  (1, 2026, 1, 2, '20101', 1, 651855.41, 0, 0, 651855.41, 84656.53, 0, 0, 84656.53, true),
  (1, 2026, 1, 2, '2010101', 1, 651492.41, 0, 0, 651492.41, 84609.38, 0, 0, 84609.38, true),
  (1, 2026, 1, 2, '2010101001', 1, 651492.41, 0, 0, 651492.41, 84609.38, 0, 0, 84609.38, true),
  (1, 2026, 1, 2, '2010103', 1, 363, 0, 0, 363, 47.15, 0, 0, 47.15, true),
  (1, 2026, 1, 2, '2010103001', 1, 363, 0, 0, 363, 47.15, 0, 0, 47.15, true),
  (1, 2026, 1, 2, '20102', 1, 123.15, 0, 0, 123.15, 15.98, 0, 0, 15.98, true),
  (1, 2026, 1, 2, '2010202', 1, 123.15, 0, 0, 123.15, 15.98, 0, 0, 15.98, true),
  (1, 2026, 1, 2, '2010202006', 1, 123.15, 0, 0, 123.15, 15.98, 0, 0, 15.98, true),
  (1, 2026, 1, 2, '20103', 1, 141376.36, 0, 0, 141376.36, 18360.56, 0, 0, 18360.56, true),
  (1, 2026, 1, 2, '2010302', 1, 20734.68, 0, 0, 20734.68, 2692.76, 0, 0, 2692.76, true),
  (1, 2026, 1, 2, '2010302001', 1, 4445.31, 0, 0, 4445.31, 577.28, 0, 0, 577.28, true),
  (1, 2026, 1, 2, '2010302002', 1, 9267.61, 0, 0, 9267.61, 1203.56, 0, 0, 1203.56, true),
  (1, 2026, 1, 2, '2010302004', 1, 7021.76, 0, 0, 7021.76, 911.92, 0, 0, 911.92, true),
  (1, 2026, 1, 2, '2010303', 1, 3666.94, 0, 0, 3666.94, 476.25, 0, 0, 476.25, true),
  (1, 2026, 1, 2, '2010303001', 1, 2653.94, 0, 0, 2653.94, 344.68, 0, 0, 344.68, true),
  (1, 2026, 1, 2, '2010303003', 1, 1013, 0, 0, 1013, 131.57, 0, 0, 131.57, true),
  (1, 2026, 1, 2, '2010305', 1, 116974.74, 0, 0, 116974.74, 15191.55, 0, 0, 15191.55, true),
  (1, 2026, 1, 2, '2010305002', 1, 114368.6, 0, 0, 114368.6, 14853.09, 0, 0, 14853.09, true),
  (1, 2026, 1, 2, '2010305003', 1, 2606.14, 0, 0, 2606.14, 338.46, 0, 0, 338.46, true),
  (1, 2026, 1, 2, '3', 1, 3502658, 0, 0, 3502658, 444985.71, 0, 0, 444985.71, true),
  (1, 2026, 1, 2, '301', 1, 5000, 0, 0, 5000, 649.35, 0, 0, 649.35, true),
  (1, 2026, 1, 2, '30101', 1, 5000, 0, 0, 5000, 649.35, 0, 0, 649.35, true),
  (1, 2026, 1, 2, '3010101', 1, 5000, 0, 0, 5000, 649.35, 0, 0, 649.35, true),
  (1, 2026, 1, 2, '3010101002', 1, 5000, 0, 0, 5000, 649.35, 0, 0, 649.35, true),
  (1, 2026, 1, 2, '304', 1, 3497658, 0, 0, 3497658, 444336.36, 0, 0, 444336.36, true),
  (1, 2026, 1, 2, '30401', 1, 3497658, 0, 0, 3497658, 444336.36, 0, 0, 444336.36, true),
  (1, 2026, 1, 2, '3040102', 1, 3497658, 0, 0, 3497658, 444336.36, 0, 0, 444336.36, true),
  (1, 2026, 1, 2, '3040102001', 1, 3969318.37, 0, 0, 3969318.37, 444336.36, 0, 0, 444336.36, true),
  (1, 2026, 1, 2, '3040102002', 1, -471660.37, 0, 0, -471660.37, 0, 0, 0, 0, true)
) as v (loc, anio, mes, tipo, cta, ver, sa, de, cr, sx, sami, demi, crmi, sxmi, mr)
join public.organizaciones g on g.codigo::text = '3' join public.localidades l on l.organizacion_id = g.id and l.correlativo = v.loc
where exists (select 1 from public.tipos_cierre x where x.codigo = v.tipo)
on conflict (localidad_id, anio, mes, tipo_cierre, cuenta_codigo, version) do update set cuenta_id = excluded.cuenta_id, saldo_anterior = excluded.saldo_anterior, debitos = excluded.debitos,
  creditos = excluded.creditos, saldo_actual = excluded.saldo_actual, saldo_anterior_mi = excluded.saldo_anterior_mi, debitos_mi = excluded.debitos_mi, creditos_mi = excluded.creditos_mi,
  saldo_actual_mi = excluded.saldo_actual_mi, mostrar_reporte = excluded.mostrar_reporte;

select (select count(*) from public.cierres_contables_anteriores c join public.organizaciones o on o.id = c.organizacion_id where o.codigo::text = '3') as cierres_org_3,
       (select count(*) from public.saldos_cierre s join public.organizaciones o on o.id = s.organizacion_id where o.codigo::text = '3') as saldos_org_3;
