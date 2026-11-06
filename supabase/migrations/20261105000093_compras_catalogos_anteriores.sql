-- Compras · catálogos del sistema anterior: «ACT_TIPOS_DOCUMENTOS_COMPRAS.xls» (11 tipos de documento) y
--   «ACT_CLASIFICACIONES_COMPRAS.xls» (9 clasificaciones).
--   Estos catálogos son comunes a todas las organizaciones y ya existen con los mismos códigos: no se crean
--   otros, se actualizan por código solo en lo que no cambia el cálculo de las demás organizaciones.
--   1. Tipos de documento: columnas nuevas siglas, incluye_libro_compras, aplica_iva (S/N) y nit.
--   2. Clasificaciones: columnas nuevas tipo, columna e incluir_reporte_facturas; las siglas se llenan
--      donde no tenían. «Libro de compras» y «aplica IVA» NO se cambian (los usan las demás
--      organizaciones): si el archivo trae otro valor se informa para revisarlo en Compras · Catálogos.
--   Un código del archivo que no exista se crea con sus datos.
--   Puede ejecutarse de nuevo.
-- Se ejecuta después del script 92.

alter table public.tipos_documento_compra add column if not exists siglas text;
alter table public.tipos_documento_compra add column if not exists incluye_libro_compras boolean;
alter table public.tipos_documento_compra add column if not exists aplica_iva boolean;
alter table public.tipos_documento_compra add column if not exists nit text;
alter table public.clasificaciones_compra add column if not exists tipo text;
alter table public.clasificaciones_compra add column if not exists columna text;
alter table public.clasificaciones_compra add column if not exists incluir_reporte_facturas boolean;

do $migra$
declare
  v_t_act integer := 0;
  v_t_nuevos integer := 0;
  v_c_act integer := 0;
  v_c_nuevas integer := 0;
  v_dif text;
begin
  drop table if exists m_tipos;
  create temp table m_tipos (codigo integer, nombre text, siglas text, libro boolean, aplica_iva boolean, nit text);
  insert into m_tipos values
      (1, 'DECLARACION ADUANERA', 'DA', true, true, '0'),
      (2, 'FAUCA', 'FA', true, false, '0'),
      (3, 'FACTURA', 'FC', true, true, '0'),
      (4, 'FACTURA ELECTRONICA', 'FACE', true, true, '0'),
      (5, 'FACTURA ESPECIAL', 'FE', true, true, '0'),
      (6, 'FORMULARIO SAT', 'FO', true, false, '0'),
      (7, 'NOTA DE CREDITO', 'NC', true, true, '0'),
      (8, 'NOTA DE DEBITO', 'ND', true, false, '0'),
      (9, 'FAC PEQUEÑO CONT', 'FCPC', true, false, '0'),
      (10, 'OTROS', 'O', false, false, '0'),
      (11, 'RECIBO', 'R', false, false, '0');
  drop table if exists m_clasif;
  create temp table m_clasif (codigo integer, nombre text, siglas text, libro boolean, aplica_iva boolean, tipo text, columna text, reporte boolean);
  insert into m_clasif values
      (1, 'NO IVA - NO LC', null, false, false, 'N', 'N', false),
      (2, 'SERVICIOS', 'SER', true, true, 'S', 'S', true),
      (3, 'BIENES EXENTOS', null, true, false, 'X', 'X', true),
      (4, 'BIENES', 'COM', true, true, 'B', 'B', true),
      (5, 'COMBUSTIBLES', 'GAS', true, true, 'C', 'C', true),
      (6, 'SERVICIOS EXENTOS', 'EXE', true, false, 'E', 'E', true),
      (7, 'COMPRAS MEDICAS', null, true, true, 'M', 'M', true),
      (8, 'GASTO NO DEDUCIBLE', null, false, false, 'N', 'N', false),
      (9, 'IMPORTACIONES', 'IMP', true, true, 'I', 'I', true);

  update public.tipos_documento_compra t set siglas = m.siglas, incluye_libro_compras = m.libro, aplica_iva = m.aplica_iva, nit = m.nit
  from m_tipos m where m.codigo = t.codigo;
  get diagnostics v_t_act = row_count;
  insert into public.tipos_documento_compra (codigo, nombre, calculo_iva, es_recibo, activo, siglas, incluye_libro_compras, aplica_iva, nit)
  select m.codigo, upper(m.nombre), case when m.aplica_iva then 'NORMAL' else 'SIN IVA' end, false, true, m.siglas, m.libro, m.aplica_iva, m.nit
  from m_tipos m where not exists (select 1 from public.tipos_documento_compra t where t.codigo = m.codigo);
  get diagnostics v_t_nuevos = row_count;

  select string_agg(format('%s %s (libro de compras: sistema %s / archivo %s; aplica IVA: sistema %s / archivo %s)', c.codigo, c.nombre,
           case when c.libro_compras then 'sí' else 'no' end, case when m.libro then 'sí' else 'no' end,
           case when c.aplica_iva then 'sí' else 'no' end, case when m.aplica_iva then 'sí' else 'no' end), '; ' order by c.codigo) into v_dif
  from public.clasificaciones_compra c join m_clasif m on m.codigo = c.codigo
  where c.libro_compras is distinct from m.libro or c.aplica_iva is distinct from m.aplica_iva;
  update public.clasificaciones_compra c set tipo = m.tipo, columna = m.columna, incluir_reporte_facturas = m.reporte,
         siglas = coalesce(c.siglas, m.siglas)
  from m_clasif m where m.codigo = c.codigo;
  get diagnostics v_c_act = row_count;
  insert into public.clasificaciones_compra (codigo, nombre, siglas, libro_compras, aplica_iva, activo, aplica_inventario, tipo, columna, incluir_reporte_facturas)
  select m.codigo, upper(m.nombre), m.siglas, coalesce(m.libro, true), coalesce(m.aplica_iva, true), true, true, m.tipo, m.columna, m.reporte
  from m_clasif m where not exists (select 1 from public.clasificaciones_compra c where c.codigo = m.codigo);
  get diagnostics v_c_nuevas = row_count;

  raise notice '%', format('Catálogos de compras: tipos de documento %s actualizados y %s nuevos; clasificaciones %s actualizadas y %s nuevas.%s',
    v_t_act, v_t_nuevos, v_c_act, v_c_nuevas,
    case when v_dif is not null then ' Clasificaciones con otro valor en el archivo (no se cambiaron): ' || v_dif || '.' else '' end);
  drop table m_tipos;
  drop table m_clasif;
end;
$migra$;

notify pgrst, 'reload schema';
