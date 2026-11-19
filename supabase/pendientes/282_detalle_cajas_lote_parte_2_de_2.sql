-- Lote del 05-11 al 17-11-2026 («Datos Tecnoasla - AAPOS del 05-11-2026 al 17-11-2026»): mismo proceso del script 255, solo con los registros de este lote.
-- Script 282 · Detalle contable de las cajas chicas de las organizaciones 4 (Tecnoalsa) y 7 (AAPOS), de «CON_DETCON_CAJAS.xlsx» (267 líneas: 4-01: 145, 7-01: 122).
--   Se ejecuta después de los scripts 254 (cajas y subcajas) y 255 (documentos), en orden. Se puede ejecutar de nuevo: actualiza.
--   Misma lógica del script 184: cada línea (MOVIMIENTO y LINEA del sistema anterior) queda en su subcaja con un número correlativo, en el orden del
--   movimiento; la cuenta se busca en el catálogo de la localidad (VERSION). Al final cada línea se liga a su documento (mismo MOVIMIENTO) y su
--   concepto dice el documento y el proveedor, como en los scripts 123 y 188.
--   Columnas nuevas en caja_lineas (traen datos y no existían): centro_costo_id y centro_costo_anterior (CENTRO_COSTO, ligado al catálogo de centros,
--   script 224) y documento_id (el documento de la subcaja). Las demás son las de los scripts 121 y 184 (movimiento, línea, cuenta, versión, debe y haber en dólares).
--   0 líneas traían un monto negativo y pasan al lado contrario en positivo: .
-- Parte 2 de 2 · Organización 7 (AAPOS): 122 líneas.
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
  select id into v_org from public.organizaciones where codigo::text = '7';
  if v_org is null then raise exception 'No existe la organización 7.'; end if;
  -- Como en el script 184: las líneas de subcajas liquidadas también se cargan.
  alter table public.caja_lineas disable trigger user;
  for r in select * from (values
    (1::integer, 1::integer, 57::integer, 1::integer, 1::integer, 1::integer, '11101001'::text, 1::integer, '1110100101'::text, 0::numeric, 450::numeric, null::numeric, 450::numeric),
    (1, 1, 57, 2, 1, 3, '5201', 1, '52010127', 450, 0, 450, null),
    (1, 1, 57, 3, 2, 1, '11101001', 1, '1110100101', 0, 800, null, 800),
    (1, 1, 57, 4, 2, 3, '5201', 1, '52010127', 800, 0, 800, null),
    (1, 1, 57, 5, 3, 1, '11101001', 1, '1110100101', 0, 1100, null, 1100),
    (1, 1, 57, 6, 3, 3, '5201', 1, '52010127', 1100, 0, 1100, null),
    (1, 1, 57, 7, 4, 1, '11101001', 1, '1110100101', 0, 1100, null, 1100),
    (1, 1, 57, 8, 4, 3, '5201', 1, '52010127', 1100, 0, 1100, null),
    (1, 1, 57, 9, 5, 1, '11101001', 1, '1110100101', 0, 800, null, 800),
    (1, 1, 57, 10, 5, 3, '5201', 1, '52010140', 800, 0, 800, null),
    (1, 1, 57, 11, 6, 1, '11101001', 1, '1110100101', 0, 800, null, 800),
    (1, 1, 57, 12, 6, 3, '5201', 1, '52010140', 800, 0, 800, null),
    (1, 1, 57, 13, 7, 1, '11101001', 1, '1110100101', 0, 400, null, 400),
    (1, 1, 57, 14, 7, 3, '5201', 1, '52010123', 400, 0, 400, null),
    (1, 1, 57, 15, 8, 1, '11101001', 1, '1110100101', 0, 300, null, 300),
    (1, 1, 57, 16, 8, 3, '5201', 1, '52010123', 300, 0, 300, null),
    (1, 1, 57, 17, 9, 1, '11101001', 1, '1110100101', 0, 82, null, 82),
    (1, 1, 57, 18, 9, 3, '5201', 1, '52010127', 82, 0, 82, null),
    (1, 1, 57, 19, 10, 1, '11101001', 1, '1110100101', 0, 586.65, null, 586.65),
    (1, 1, 57, 20, 10, 3, '5201', 1, '52010127', 586.65, 0, 586.65, null),
    (1, 1, 57, 21, 11, 1, '11101001', 1, '1110100101', 0, 263, null, 263),
    (1, 1, 57, 22, 11, 3, '5201', 1, '52010127', 263, 0, 263, null),
    (1, 1, 57, 23, 12, 1, '11101001', 1, '1110100101', 0, 137, null, 137),
    (1, 1, 57, 24, 12, 3, '5201', 1, '52010117', 137, 0, 137, null),
    (1, 1, 57, 25, 13, 1, '11101001', 1, '1110100101', 0, 82, null, 82),
    (1, 1, 57, 26, 13, 3, '5201', 1, '52010127', 82, 0, 82, null),
    (1, 1, 57, 27, 14, 1, '11101001', 1, '1110100101', 0, 120, null, 120),
    (1, 1, 57, 28, 14, 3, '5201', 1, '52010127', 120, 0, 120, null),
    (1, 1, 57, 29, 15, 1, '11101001', 1, '1110100101', 0, 40.5, null, 40.5),
    (1, 1, 57, 30, 15, 3, '5201', 1, '52010127', 40.5, 0, 40.5, null),
    (1, 1, 57, 31, 16, 1, '11101001', 1, '1110100101', 0, 20, null, 20),
    (1, 1, 57, 32, 16, 3, '5201', 1, '52010127', 20, 0, 20, null),
    (1, 1, 57, 33, 17, 1, '11101001', 1, '1110100101', 0, 98, null, 98),
    (1, 1, 57, 34, 17, 3, '5201', 1, '52010127', 98, 0, 98, null),
    (1, 1, 57, 35, 18, 1, '11101001', 1, '1110100101', 0, 199, null, 199),
    (1, 1, 57, 36, 18, 3, '5201', 1, '52010127', 199, 0, 199, null),
    (1, 1, 57, 37, 19, 1, '11101001', 1, '1110100101', 0, 66, null, 66),
    (1, 1, 57, 38, 19, 3, '5201', 1, '52010127', 66, 0, 66, null),
    (1, 1, 57, 39, 20, 1, '11101001', 1, '1110100101', 0, 163.5, null, 163.5),
    (1, 1, 57, 40, 20, 3, '5201', 1, '52010127', 163.5, 0, 163.5, null),
    (1, 1, 57, 41, 21, 1, '11101001', 1, '1110100101', 0, 200, null, 200),
    (1, 1, 57, 42, 21, 3, '5201', 1, '52010117', 200, 0, 200, null),
    (1, 1, 57, 43, 22, 1, '11101001', 1, '1110100101', 0, 862.63, null, 862.63),
    (1, 1, 57, 44, 22, 3, '5201', 1, '52010127', 862.63, 0, 862.63, null),
    (1, 1, 57, 45, 23, 1, '11101001', 1, '1110100101', 0, 144, null, 144),
    (1, 1, 57, 46, 23, 3, '5201', 1, '52010127', 144, 0, 144, null),
    (1, 1, 57, 47, 24, 1, '11101001', 1, '1110100101', 0, 10, null, 10),
    (1, 1, 57, 48, 24, 3, '5201', 1, '52010127', 10, 0, 10, null),
    (1, 1, 57, 49, 25, 1, '11101001', 1, '1110100101', 0, 65, null, 65),
    (1, 1, 57, 50, 25, 3, '5201', 1, '52010127', 65, 0, 65, null),
    (1, 1, 57, 51, 26, 1, '11101001', 1, '1110100101', 0, 180, null, 180),
    (1, 1, 57, 52, 26, 3, '5201', 1, '52010114', 180, 0, 180, null),
    (1, 1, 57, 53, 27, 1, '11101001', 1, '1110100101', 0, 294, null, 294),
    (1, 1, 57, 54, 27, 3, '5201', 1, '52010127', 294, 0, 294, null),
    (1, 1, 57, 55, 28, 1, '11101001', 1, '1110100101', 0, 18, null, 18),
    (1, 1, 57, 56, 28, 3, '5201', 1, '52010127', 18, 0, 18, null),
    (1, 1, 57, 57, 29, 1, '11101001', 1, '1110100101', 0, 540, null, 540),
    (1, 1, 57, 58, 29, 3, '5201', 1, '52010127', 540, 0, 540, null),
    (1, 1, 57, 59, 30, 1, '11101001', 1, '1110100101', 0, 67, null, 67),
    (1, 1, 57, 60, 30, 3, '5201', 1, '52010127', 67, 0, 67, null),
    (1, 3, 35, 1, 1, 1, '11101001', 1, '1110100102', 0, 140.25, null, 140.25),
    (1, 3, 35, 2, 1, 3, '5201', 1, '52010342', 140.25, 0, 140.25, null),
    (1, 3, 35, 3, 2, 1, '11101001', 1, '1110100102', 0, 140.25, null, 140.25),
    (1, 3, 35, 4, 2, 3, '5201', 1, '52010342', 140.25, 0, 140.25, null),
    (1, 3, 35, 5, 3, 1, '11101001', 1, '1110100102', 0, 175, null, 175),
    (1, 3, 35, 6, 3, 3, '5201', 1, '52010327', 175, 0, 175, null),
    (1, 3, 35, 7, 4, 1, '11101001', 1, '1110100102', 0, 46.99, null, 46.99),
    (1, 3, 35, 8, 4, 3, '5201', 1, '52010327', 46.99, 0, 46.99, null),
    (1, 3, 35, 9, 5, 1, '11101001', 1, '1110100102', 0, 227.75, null, 227.75),
    (1, 3, 35, 10, 5, 3, '5201', 1, '52010327', 227.75, 0, 227.75, null),
    (1, 3, 35, 11, 6, 1, '11101001', 1, '1110100102', 0, 140.25, null, 140.25),
    (1, 3, 35, 12, 6, 3, '5201', 1, '52010342', 140.25, 0, 140.25, null),
    (1, 3, 35, 13, 7, 1, '11101001', 1, '1110100102', 0, 30, null, 30),
    (1, 3, 35, 14, 7, 3, '5201', 1, '52010327', 30, 0, 30, null),
    (1, 3, 35, 15, 8, 1, '11101001', 1, '1110100102', 0, 150, null, 150),
    (1, 3, 35, 16, 8, 3, '5201', 1, '52010327', 150, 0, 150, null),
    (1, 3, 35, 17, 9, 1, '11101001', 1, '1110100102', 0, 138, null, 138),
    (1, 3, 35, 18, 9, 3, '5201', 1, '52010327', 138, 0, 138, null),
    (1, 3, 35, 19, 10, 1, '11101001', 1, '1110100102', 0, 272.4, null, 272.4),
    (1, 3, 35, 20, 10, 3, '5201', 1, '52010327', 272.4, 0, 272.4, null),
    (1, 3, 35, 21, 11, 1, '11101001', 1, '1110100102', 0, 35, null, 35),
    (1, 3, 35, 22, 11, 3, '5201', 1, '52010327', 35, 0, 35, null),
    (1, 3, 35, 23, 12, 1, '11101001', 1, '1110100102', 0, 350, null, 350),
    (1, 3, 35, 24, 12, 3, '5201', 1, '52010342', 350, 0, 350, null),
    (1, 3, 35, 25, 13, 1, '11101001', 1, '1110100102', 0, 150, null, 150),
    (1, 3, 35, 26, 13, 3, '5201', 1, '52010342', 150, 0, 150, null),
    (1, 4, 1, 1, 1, 1, '11101001', 1, '1110100106', 0, 121, null, 121),
    (1, 4, 1, 2, 1, 3, '5201', 1, '52010127', 121, 0, 121, null),
    (1, 4, 1, 3, 2, 1, '11101001', 1, '1110100106', 0, 158, null, 158),
    (1, 4, 1, 4, 2, 3, '5201', 1, '52010127', 158, 0, 158, null),
    (1, 4, 1, 5, 3, 1, '11101001', 1, '1110100106', 0, 1485, null, 1485),
    (1, 4, 1, 6, 3, 3, '5201', 1, '52010127', 1485, 0, 1485, null),
    (1, 4, 1, 7, 4, 1, '11101001', 1, '1110100106', 0, 130, null, 130),
    (1, 4, 1, 8, 4, 3, '5201', 1, '52010127', 130, 0, 130, null),
    (1, 4, 1, 9, 5, 1, '11101001', 1, '1110100106', 0, 94, null, 94),
    (1, 4, 1, 10, 5, 3, '5201', 1, '52010127', 94, 0, 94, null),
    (1, 4, 2, 1, 1, 1, '11101001', 1, '1110100106', 0, 196, null, 196),
    (1, 4, 2, 2, 1, 3, '5201', 1, '52010127', 196, 0, 196, null),
    (1, 4, 2, 3, 2, 1, '11101001', 1, '1110100106', 0, 48, null, 48),
    (1, 4, 2, 4, 2, 3, '5201', 1, '52010127', 48, 0, 48, null),
    (1, 4, 2, 5, 3, 1, '11101001', 1, '1110100106', 0, 65, null, 65),
    (1, 4, 2, 6, 3, 3, '5201', 1, '52010127', 65, 0, 65, null),
    (1, 4, 2, 7, 4, 1, '11101001', 1, '1110100106', 0, 69, null, 69),
    (1, 4, 2, 8, 4, 3, '5201', 1, '52010127', 69, 0, 69, null),
    (1, 4, 2, 9, 5, 1, '11101001', 1, '1110100106', 0, 225, null, 225),
    (1, 4, 2, 10, 5, 3, '5201', 1, '52010127', 225, 0, 225, null),
    (1, 4, 2, 11, 6, 1, '11101001', 1, '1110100106', 0, 75.4, null, 75.4),
    (1, 4, 2, 12, 6, 3, '5201', 1, '52010127', 75.4, 0, 75.4, null),
    (1, 4, 2, 13, 7, 1, '11101001', 1, '1110100106', 0, 53, null, 53),
    (1, 4, 2, 14, 7, 3, '5201', 1, '52010127', 53, 0, 53, null),
    (1, 4, 2, 15, 8, 1, '11101001', 1, '1110100106', 0, 150.5, null, 150.5),
    (1, 4, 2, 16, 8, 3, '5201', 1, '52010127', 150.5, 0, 150.5, null),
    (1, 4, 2, 17, 9, 1, '11101001', 1, '1110100106', 0, 117, null, 117),
    (1, 4, 2, 18, 9, 3, '5201', 1, '52010127', 117, 0, 117, null),
    (1, 8, 2, 1, 1, 1, '11101001', 1, '1110100107', 0, 70, null, 70),
    (1, 8, 2, 2, 1, 3, '5201', 1, '52010826', 70, 0, 70, null),
    (1, 8, 2, 3, 2, 1, '11101001', 1, '1110100107', 0, 400, null, 400),
    (1, 8, 2, 4, 2, 3, '5201', 1, '52010140', 400, 0, 400, null),
    (1, 8, 2, 5, 3, 1, '11101001', 1, '1110100107', 0, 215, null, 215),
    (1, 8, 2, 6, 3, 3, '5201', 1, '52010826', 215, 0, 215, null),
    (1, 8, 2, 7, 4, 1, '11101001', 1, '1110100107', 0, 315, null, 315),
    (1, 8, 2, 8, 4, 3, '5201', 1, '52010127', 315, 0, 315, null)) as x(loc, caja, numero, linea, movimiento, linea_ant, codigo, version, centro, debe, haber, debe_mi, haber_mi) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    v_per := null;
    select p.id into v_per from public.caja_periodos p join public.cajas_chicas c on c.id = p.caja_id where c.localidad_id = v_loc and c.codigo = r.caja and p.numero = r.numero;
    if v_per is null then l_s := l_s + 1; continue; end if;
    v_cta := null; v_cc := null;
    select k.id into v_cta from public.cuentas k join public.catalogos_cuentas g on g.id = k.catalogo_id
    where g.localidad_id = v_loc and k.codigo = r.codigo order by (g.version = r.version) desc, g.activo desc, g.version desc limit 1;
    if v_cta is null then l_c := l_c + 1; v_faltan := array_append(v_faltan, format('7-0%s %s', r.loc, r.codigo)); continue; end if;
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

  raise notice '%', format('Detalle contable de cajas de la organización 7: %s líneas nuevas, %s actualizadas, %s ligadas a su documento, %s sin subcaja (ejecuta antes el 254), %s sin cuenta.',
    l_n, l_a, l_doc, l_s, l_c);
  if l_c > 0 then raise notice 'Cuentas que no existen en el catálogo de la localidad (líneas omitidas): %.', (select string_agg(distinct x, ', ') from unnest(v_faltan) x); end if;
end;
$lineas$;

notify pgrst, 'reload schema';
