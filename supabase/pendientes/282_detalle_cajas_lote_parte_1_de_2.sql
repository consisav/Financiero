-- Lote del 05-11 al 17-11-2026 («Datos Tecnoasla - AAPOS del 05-11-2026 al 17-11-2026»): mismo proceso del script 255, solo con los registros de este lote.
-- Script 282 · Detalle contable de las cajas chicas de las organizaciones 4 (Tecnoalsa) y 7 (AAPOS), de «CON_DETCON_CAJAS.xlsx» (267 líneas: 4-01: 145, 7-01: 122).
--   Se ejecuta después de los scripts 254 (cajas y subcajas) y 255 (documentos), en orden. Se puede ejecutar de nuevo: actualiza.
--   Misma lógica del script 184: cada línea (MOVIMIENTO y LINEA del sistema anterior) queda en su subcaja con un número correlativo, en el orden del
--   movimiento; la cuenta se busca en el catálogo de la localidad (VERSION). Al final cada línea se liga a su documento (mismo MOVIMIENTO) y su
--   concepto dice el documento y el proveedor, como en los scripts 123 y 188.
--   Columnas nuevas en caja_lineas (traen datos y no existían): centro_costo_id y centro_costo_anterior (CENTRO_COSTO, ligado al catálogo de centros,
--   script 224) y documento_id (el documento de la subcaja). Las demás son las de los scripts 121 y 184 (movimiento, línea, cuenta, versión, debe y haber en dólares).
--   0 líneas traían un monto negativo y pasan al lado contrario en positivo: .
-- Parte 1 de 2 · Organización 4 (Tecnoalsa): 145 líneas.
set lock_timeout = '20s';
alter table public.caja_lineas add column if not exists movimiento_anterior integer;
alter table public.caja_lineas add column if not exists linea_anterior integer;
alter table public.caja_lineas add column if not exists cuenta_codigo_anterior text;
alter table public.caja_lineas add column if not exists version_cuenta_anterior integer;
alter table public.caja_lineas add column if not exists debe_mi numeric(18, 2);
alter table public.caja_lineas add column if not exists haber_mi numeric(18, 2);
alter table public.caja_lineas add column if not exists centro_costo_id bigint references public.centros_costo(id) on delete set null;
alter table public.caja_lineas add column if not exists centro_costo_anterior text;
alter table public.caja_lineas add column if not exists documento_id bigint references public.caja_documentos(id) on delete set null;
create index if not exists caja_lineas_documento_idx on public.caja_lineas (documento_id);

do $lineas$
declare
  v_org bigint; r record; v_loc bigint; v_per bigint; v_cta bigint; v_cc bigint; v_nuevo boolean; v_faltan text[] := '{}';
  l_n int := 0; l_a int := 0; l_s int := 0; l_c int := 0; l_doc int := 0;
begin
  select id into v_org from public.organizaciones where codigo::text = '4';
  if v_org is null then raise exception 'No existe la organización 4.'; end if;
  -- Como en el script 184: las líneas de subcajas liquidadas también se cargan.
  alter table public.caja_lineas disable trigger user;
  for r in select * from (values
    (1::integer, 4::integer, 104::integer, 1::integer, 1::integer, 1::integer, '2111030107'::text, 1::integer, null::text, 0::numeric, 40::numeric, null::numeric, 5.19::numeric),
    (1, 4, 104, 2, 1, 3, '6313', 1, null, 40, 0, 5.19, null),
    (1, 4, 104, 3, 2, 1, '2111030107', 1, null, 0, 70, null, 9.09),
    (1, 4, 104, 4, 2, 3, '6313', 1, null, 70, 0, 9.09, null),
    (1, 4, 104, 5, 3, 1, '2111030107', 1, null, 0, 30, null, 3.9),
    (1, 4, 104, 6, 3, 3, '6313', 1, null, 30, 0, 3.9, null),
    (1, 4, 104, 7, 4, 1, '2111030107', 1, null, 0, 70, null, 9.09),
    (1, 4, 104, 8, 4, 3, '6313', 1, null, 70, 0, 9.09, null),
    (1, 4, 104, 9, 5, 1, '2111030107', 1, null, 0, 30, null, 3.9),
    (1, 4, 104, 10, 5, 3, '6313', 1, null, 30, 0, 3.9, null),
    (1, 4, 104, 11, 6, 1, '2111030107', 1, null, 0, 90, null, 11.69),
    (1, 4, 104, 12, 6, 3, '6313', 1, null, 90, 0, 11.69, null),
    (1, 4, 104, 13, 7, 1, '2111030107', 1, null, 0, 90, null, 11.69),
    (1, 4, 104, 14, 7, 3, '6313', 1, null, 90, 0, 11.69, null),
    (1, 5, 96, 1, 1, 1, '2111030102', 1, null, 1.72, 0, 0.22, null),
    (1, 5, 96, 2, 1, 3, '6313', 1, null, 0, 1.72, null, 0.22),
    (1, 5, 96, 3, 2, 1, '2111030102', 1, null, 1.17, 0, 0.15, null),
    (1, 5, 96, 4, 2, 3, '6313', 1, null, 0, 1.17, null, 0.15),
    (1, 5, 96, 5, 3, 1, '2111030102', 1, null, 1.21, 0, 0.16, null),
    (1, 5, 96, 6, 3, 3, '6313', 1, null, 0, 1.21, null, 0.16),
    (1, 5, 96, 7, 4, 1, '2111030102', 1, null, 0, 200, null, 25.97),
    (1, 5, 96, 8, 4, 3, '6313', 1, null, 200, 0, 25.97, null),
    (1, 5, 96, 9, 5, 1, '2111030102', 1, null, 0, 18.75, null, 2.44),
    (1, 5, 96, 10, 5, 2, '11301', 1, null, 2.01, 0, 0.26, null),
    (1, 5, 96, 11, 5, 3, '6319', 1, null, 16.74, 0, 2.17, null),
    (1, 5, 96, 12, 6, 1, '2111030102', 1, null, 0, 18.75, null, 2.44),
    (1, 5, 96, 13, 6, 2, '11301', 1, null, 2.01, 0, 0.26, null),
    (1, 5, 96, 14, 6, 3, '6319', 1, null, 16.74, 0, 2.17, null),
    (1, 5, 96, 15, 7, 1, '2111030102', 1, null, 0, 18.75, null, 2.44),
    (1, 5, 96, 16, 7, 2, '11301', 1, null, 2.01, 0, 0.26, null),
    (1, 5, 96, 17, 7, 3, '6319', 1, null, 16.74, 0, 2.17, null),
    (1, 5, 96, 18, 8, 1, '2111030102', 1, null, 0, 200, null, 25.97),
    (1, 5, 96, 19, 8, 3, '6313', 1, null, 200, 0, 25.97, null),
    (1, 5, 96, 20, 9, 1, '2111030102', 1, null, 0, 365, null, 47.4),
    (1, 5, 96, 21, 9, 3, '6313', 1, null, 365, 0, 47.4, null),
    (1, 5, 96, 22, 10, 1, '2111030102', 1, null, 0, 64, null, 8.31),
    (1, 5, 96, 23, 10, 2, '11301', 1, null, 6.86, 0, 0.89, null),
    (1, 5, 96, 24, 10, 3, '6311', 1, null, 57.14, 0, 7.42, null),
    (1, 5, 96, 25, 11, 1, '2111030102', 1, null, 0, 138, null, 17.92),
    (1, 5, 96, 26, 11, 2, '11301', 1, null, 14.79, 0, 1.92, null),
    (1, 5, 96, 27, 11, 3, '6311', 1, null, 123.21, 0, 16, null),
    (1, 5, 96, 28, 12, 1, '2111030102', 1, null, 0, 49, null, 6.36),
    (1, 5, 96, 29, 12, 2, '11301', 1, null, 5.25, 0, 0.68, null),
    (1, 5, 96, 30, 12, 3, '6311', 1, null, 43.75, 0, 5.68, null),
    (1, 5, 96, 31, 13, 1, '2111030102', 1, null, 0, 200, null, 25.97),
    (1, 5, 96, 32, 13, 3, '6313', 1, null, 200, 0, 25.97, null),
    (1, 5, 96, 33, 14, 1, '2111030102', 1, null, 0, 300, null, 38.96),
    (1, 5, 96, 34, 14, 3, '6313', 1, null, 300, 0, 38.96, null),
    (1, 5, 96, 35, 15, 1, '2111030102', 1, null, 0, 74, null, 9.61),
    (1, 5, 96, 36, 15, 2, '11301', 1, null, 7.93, 0, 1.03, null),
    (1, 5, 96, 37, 15, 3, '6311', 1, null, 66.07, 0, 8.58, null),
    (1, 5, 96, 38, 16, 1, '2111030102', 1, null, 0, 134, null, 17.4),
    (1, 5, 96, 39, 16, 2, '11301', 1, null, 14.36, 0, 1.86, null),
    (1, 5, 96, 40, 16, 3, '6311', 1, null, 119.64, 0, 15.54, null),
    (1, 5, 96, 41, 17, 1, '2111030102', 1, null, 0, 200, null, 25.97),
    (1, 5, 96, 42, 17, 3, '6313', 1, null, 200, 0, 25.97, null),
    (1, 5, 96, 43, 18, 1, '2111030102', 1, null, 0, 71, null, 9.22),
    (1, 5, 96, 44, 18, 2, '11301', 1, null, 7.61, 0, 0.99, null),
    (1, 5, 96, 45, 18, 3, '6311', 1, null, 63.39, 0, 8.23, null),
    (1, 5, 96, 46, 19, 1, '2111030102', 1, null, 0, 200, null, 25.97),
    (1, 5, 96, 47, 19, 3, '6313', 1, null, 200, 0, 25.97, null),
    (1, 5, 96, 48, 20, 1, '2111030102', 1, null, 0, 200, null, 25.97),
    (1, 5, 96, 49, 20, 3, '6313', 1, null, 200, 0, 25.97, null),
    (1, 5, 96, 50, 21, 1, '2111030102', 1, null, 0, 200, null, 25.97),
    (1, 5, 96, 51, 21, 3, '6313', 1, null, 200, 0, 25.97, null),
    (1, 5, 96, 52, 22, 1, '2111030102', 1, null, 0, 200, null, 25.97),
    (1, 5, 96, 53, 22, 3, '6313', 1, null, 200, 0, 25.97, null),
    (1, 5, 96, 54, 23, 1, '2111030102', 1, null, 0, 200, null, 25.97),
    (1, 5, 96, 55, 23, 3, '6313', 1, null, 200, 0, 25.97, null),
    (1, 5, 96, 56, 24, 1, '2111030102', 1, null, 0, 122, null, 15.84),
    (1, 5, 96, 57, 24, 2, '11301', 1, null, 13.07, 0, 1.7, null),
    (1, 5, 96, 58, 24, 3, '6311', 1, null, 108.93, 0, 14.15, null),
    (1, 5, 97, 1, 1, 1, '2111030102', 1, null, 0, 100, null, 100),
    (1, 5, 97, 2, 1, 3, '6321', 1, null, 100, 0, 100, null),
    (1, 5, 97, 3, 2, 1, '2111030102', 1, null, 0, 150, null, 150),
    (1, 5, 97, 4, 2, 3, '6321', 1, null, 150, 0, 150, null),
    (1, 7, 44, 1, 1, 1, '2111030104', 1, null, 0, 27, null, 3.51),
    (1, 7, 44, 2, 1, 2, '11301', 1, null, 2.89, 0, 0.38, null),
    (1, 7, 44, 3, 1, 3, '6211', 1, null, 24.11, 0, 3.13, null),
    (1, 7, 44, 4, 2, 1, '2111030104', 1, null, 0, 13.75, null, 1.79),
    (1, 7, 44, 5, 2, 2, '11301', 1, null, 1.47, 0, 0.19, null),
    (1, 7, 44, 6, 2, 3, '6215', 1, null, 12.28, 0, 1.59, null),
    (1, 7, 44, 7, 3, 1, '2111030104', 1, null, 0, 13.75, null, 1.79),
    (1, 7, 44, 8, 3, 2, '11301', 1, null, 1.47, 0, 0.19, null),
    (1, 7, 44, 9, 3, 3, '6215', 1, null, 12.28, 0, 1.59, null),
    (1, 7, 44, 10, 4, 1, '2111030104', 1, null, 0, 15, null, 1.95),
    (1, 7, 44, 11, 4, 2, '11301', 1, null, 1.61, 0, 0.21, null),
    (1, 7, 44, 12, 4, 3, '1151', 1, null, 13.39, 0, 1.74, null),
    (1, 7, 44, 13, 5, 1, '2111030104', 1, null, 0, 70, null, 9.09),
    (1, 7, 44, 14, 5, 2, '11301', 1, null, 7.5, 0, 0.97, null),
    (1, 7, 44, 15, 5, 3, '6211', 1, null, 62.5, 0, 8.12, null),
    (1, 8, 33, 1, 1, 1, '21110302', 1, null, 0, 42, null, 5.45),
    (1, 8, 33, 2, 1, 2, '11301', 1, null, 4.5, 0, 0.58, null),
    (1, 8, 33, 3, 1, 3, '6243', 1, null, 37.5, 0, 4.87, null),
    (1, 8, 33, 4, 2, 1, '21110302', 1, null, 0, 8, null, 1.04),
    (1, 8, 33, 5, 2, 2, '11301', 1, null, 0.86, 0, 0.11, null),
    (1, 8, 33, 6, 2, 3, '6211', 1, null, 7.14, 0, 0.93, null),
    (1, 10, 20, 1, 1, 1, '2111030105', 1, null, 0, 19, null, 2.47),
    (1, 10, 20, 2, 1, 2, '11301', 1, null, 2.04, 0, 0.26, null),
    (1, 10, 20, 3, 1, 3, '6231', 1, null, 16.96, 0, 2.2, null),
    (1, 10, 20, 4, 2, 1, '2111030105', 1, null, 0, 20, null, 2.6),
    (1, 10, 20, 5, 2, 2, '11301', 1, null, 2.14, 0, 0.28, null),
    (1, 10, 20, 6, 2, 3, '6215', 1, null, 17.86, 0, 2.32, null),
    (1, 10, 20, 7, 3, 1, '2111030105', 1, null, 0, 20, null, 2.6),
    (1, 10, 20, 8, 3, 2, '11301', 1, null, 2.14, 0, 0.28, null),
    (1, 10, 20, 9, 3, 3, '6215', 1, null, 17.86, 0, 2.32, null),
    (1, 10, 20, 10, 4, 1, '2111030105', 1, null, 0, 30.4, null, 3.95),
    (1, 10, 20, 11, 4, 2, '11301', 1, null, 3.26, 0, 0.42, null),
    (1, 10, 20, 12, 4, 3, '51201', 1, null, 27.14, 0, 3.52, null),
    (1, 10, 20, 13, 5, 1, '2111030105', 1, null, 0, 19, null, 2.47),
    (1, 10, 20, 14, 5, 2, '11301', 1, null, 2.04, 0, 0.26, null),
    (1, 10, 20, 15, 5, 3, '6231', 1, null, 16.96, 0, 2.2, null),
    (1, 10, 20, 16, 6, 1, '2111030105', 1, null, 0, 40, null, 5.19),
    (1, 10, 20, 17, 6, 2, '11301', 1, null, 4.29, 0, 0.56, null),
    (1, 10, 20, 18, 6, 3, '6215', 1, null, 35.71, 0, 4.64, null),
    (1, 10, 20, 19, 7, 1, '2111030105', 1, null, 0, 15, null, 1.95),
    (1, 10, 20, 20, 7, 2, '11301', 1, null, 1.61, 0, 0.21, null),
    (1, 10, 20, 21, 7, 3, '1151', 1, null, 13.39, 0, 1.74, null),
    (1, 10, 20, 22, 8, 1, '2111030105', 1, null, 0, 60, null, 7.79),
    (1, 10, 20, 23, 8, 2, '11301', 1, null, 6.43, 0, 0.84, null),
    (1, 10, 20, 24, 8, 3, '51201', 1, null, 53.57, 0, 6.96, null),
    (1, 10, 20, 25, 9, 1, '2111030105', 1, null, 0, 38, null, 4.94),
    (1, 10, 20, 26, 9, 2, '11301', 1, null, 4.07, 0, 0.53, null),
    (1, 10, 20, 27, 9, 3, '6231', 1, null, 33.93, 0, 4.41, null),
    (1, 10, 20, 28, 10, 1, '2111030105', 1, null, 0, 69.4, null, 9.01),
    (1, 10, 20, 29, 10, 2, '11301', 1, null, 7.44, 0, 0.97, null),
    (1, 10, 20, 30, 10, 3, '51201', 1, null, 61.96, 0, 8.05, null),
    (1, 10, 20, 31, 11, 1, '2111030105', 1, null, 0, 54, null, 7.01),
    (1, 10, 20, 32, 11, 2, '11301', 1, null, 5.79, 0, 0.75, null),
    (1, 10, 20, 33, 11, 3, '6243', 1, null, 48.21, 0, 6.26, null),
    (1, 10, 20, 34, 12, 1, '2111030105', 1, null, 0, 232.96, null, 30.25),
    (1, 10, 20, 35, 12, 2, '11301', 1, null, 24.96, 0, 3.24, null),
    (1, 10, 20, 36, 12, 3, '1151', 1, null, 208, 0, 27.01, null),
    (1, 10, 20, 37, 13, 1, '2111030105', 1, null, 0, 22.5, null, 2.92),
    (1, 10, 20, 38, 13, 2, '11301', 1, null, 2.41, 0, 0.31, null),
    (1, 10, 20, 39, 13, 3, '51201', 1, null, 20.09, 0, 2.61, null),
    (1, 10, 20, 40, 14, 1, '2111030105', 1, null, 0, 5.2, null, 0.68),
    (1, 10, 20, 41, 14, 2, '11301', 1, null, 0.56, 0, 0.07, null),
    (1, 10, 20, 42, 14, 3, '51201', 1, null, 4.64, 0, 0.6, null),
    (1, 10, 20, 43, 15, 1, '2111030105', 1, null, 0, 19, null, 2.47),
    (1, 10, 20, 44, 15, 2, '11301', 1, null, 2.04, 0, 0.26, null),
    (1, 10, 20, 45, 15, 3, '6231', 1, null, 16.96, 0, 2.2, null),
    (1, 10, 20, 46, 16, 1, '2111030105', 1, null, 0, 30, null, 3.9),
    (1, 10, 20, 47, 16, 2, '11301', 1, null, 3.21, 0, 0.42, null),
    (1, 10, 20, 48, 16, 3, '1151', 1, null, 26.79, 0, 3.48, null)) as x(loc, caja, numero, linea, movimiento, linea_ant, codigo, version, centro, debe, haber, debe_mi, haber_mi) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    v_per := null;
    select p.id into v_per from public.caja_periodos p join public.cajas_chicas c on c.id = p.caja_id where c.localidad_id = v_loc and c.codigo = r.caja and p.numero = r.numero;
    if v_per is null then l_s := l_s + 1; continue; end if;
    v_cta := null; v_cc := null;
    select k.id into v_cta from public.cuentas k join public.catalogos_cuentas g on g.id = k.catalogo_id
    where g.localidad_id = v_loc and k.codigo = r.codigo order by (g.version = r.version) desc, g.activo desc, g.version desc limit 1;
    if v_cta is null then l_c := l_c + 1; v_faltan := array_append(v_faltan, format('4-0%s %s', r.loc, r.codigo)); continue; end if;
    if r.centro is not null then
      select x.id into v_cc from public.centros_costo x join public.catalogos_centros k on k.id = x.catalogo_id
      where k.localidad_id = v_loc and x.codigo = r.centro order by (k.version = r.version) desc, k.version desc limit 1;
    end if;
    insert into public.caja_lineas (periodo_id, linea, cuenta_id, concepto, debe, haber, movimiento_anterior, linea_anterior, cuenta_codigo_anterior, version_cuenta_anterior,
      debe_mi, haber_mi, centro_costo_id, centro_costo_anterior)
    values (v_per, r.linea, v_cta, 'MOVIMIENTO ' || r.movimiento, r.debe, r.haber, r.movimiento, r.linea_ant, r.codigo, r.version, r.debe_mi, r.haber_mi, v_cc, r.centro)
    on conflict (periodo_id, linea) do update set cuenta_id = excluded.cuenta_id, concepto = excluded.concepto, debe = excluded.debe, haber = excluded.haber,
      movimiento_anterior = excluded.movimiento_anterior, linea_anterior = excluded.linea_anterior, cuenta_codigo_anterior = excluded.cuenta_codigo_anterior,
      version_cuenta_anterior = excluded.version_cuenta_anterior, debe_mi = excluded.debe_mi, haber_mi = excluded.haber_mi,
      centro_costo_id = excluded.centro_costo_id, centro_costo_anterior = excluded.centro_costo_anterior
    returning (xmax = 0) into v_nuevo;
    if v_nuevo then l_n := l_n + 1; else l_a := l_a + 1; end if;
  end loop;

  -- Cada línea queda ligada a su documento de la subcaja (mismo MOVIMIENTO, script 255) y su concepto dice el documento y el proveedor.
  update public.caja_lineas l set documento_id = d.id,
    concepto = left(format('MOV %s · %s %s · %s', d.movimiento_anterior,
      case d.tipo_documento when 'RECIBO' then 'REC' when 'FACTURA PEQUEÑO CONTRIBUYENTE' then 'FPC' when 'FACTURA ESPECIAL' then 'FESP' when 'OTRO' then 'DOC' else 'FACT' end,
      concat_ws('-', d.serie, d.documento), d.proveedor_nombre), 200)
  from public.caja_documentos d, public.caja_periodos p
  where p.id = l.periodo_id and p.organizacion_id = v_org and d.periodo_id = l.periodo_id and d.movimiento_anterior = l.movimiento_anterior
    and l.movimiento_anterior is not null and l.documento_id is distinct from d.id;
  get diagnostics l_doc = row_count;
  alter table public.caja_lineas enable trigger user;

  raise notice '%', format('Detalle contable de cajas de la organización 4: %s líneas nuevas, %s actualizadas, %s ligadas a su documento, %s sin subcaja (ejecuta antes el 254), %s sin cuenta.',
    l_n, l_a, l_doc, l_s, l_c);
  if l_c > 0 then raise notice 'Cuentas que no existen en el catálogo de la localidad (líneas omitidas): %.', (select string_agg(distinct x, ', ') from unnest(v_faltan) x); end if;
end;
$lineas$;
