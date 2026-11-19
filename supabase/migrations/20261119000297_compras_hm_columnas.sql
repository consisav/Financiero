-- Organización 2 (Hospital Miraflores), lote del 05-11 al 17-11-2026 («Datos HM del 05-11-2026 al 17-11-2026»): mismo proceso de los scripts 198 y 275, solo con los registros de este lote.
-- Script 297 · parte 0 de 2: columnas nuevas de compras y clasificaciones de compras (ACT_CLASIFICACIONES_COMPRAS.xls, 10).
-- Se ejecuta UNA vez, antes de las partes 1 a 2. Si la tabla de compras está ocupada por otra consulta, falla a los 20 segundos.
set lock_timeout = '20s';
-- Columnas del sistema anterior (las de los scripts 89 y 198 y, nuevas, las de este archivo).
alter table public.compras add column if not exists modulo_factura integer;
alter table public.compras add column if not exists numero_cheque text;
alter table public.compras add column if not exists usuario_modifica_anterior text;
alter table public.compras add column if not exists fecha_modifica_anterior date;
alter table public.compras add column if not exists tipo_compra_anterior text;
alter table public.compras add column if not exists poliza_anio integer;
alter table public.compras add column if not exists poliza_mes integer;
alter table public.compras add column if not exists poliza_numero integer;
alter table public.compras add column if not exists pct_iva numeric;
alter table public.compras add column if not exists pct_retencion numeric;
alter table public.compras add column if not exists propina numeric;
alter table public.compras add column if not exists fecha_transferencia date;
alter table public.compras add column if not exists clasificacion_pago integer;
alter table public.compras add column if not exists usuario_autoriza text;
alter table public.compras add column if not exists tipo_periodo_compra text;
alter table public.compras add column if not exists transaccion_retencion integer;
alter table public.compras add column if not exists valor_cambio_anterior numeric;
alter table public.compras add column if not exists origen_anterior text;
alter table public.compras add column if not exists compra_anterior integer;
alter table public.compras add column if not exists documento_anterior text;
alter table public.compras add column if not exists proveedor_anterior integer;
alter table public.compras add column if not exists transaccion_anterior integer;
alter table public.compras add column if not exists regimen_isr_anterior integer;
alter table public.compras add column if not exists fecha_ingreso_anterior timestamp;
alter table public.compras add column if not exists usuario_anula_anterior text;
alter table public.compras add column if not exists fecha_anula_anterior timestamp;
alter table public.compras add column if not exists cuenta_bancaria_anterior text;
alter table public.compras add column if not exists transferencia_anterior text;
alter table public.compras add column if not exists banco_anterior integer;
alter table public.compras add column if not exists contrasena_anterior text;
alter table public.compras add column if not exists exento_anterior numeric;
alter table public.compras add column if not exists anio_presentacion_anterior integer;
alter table public.compras add column if not exists retencion_valor_anterior numeric;
alter table public.compras add column if not exists fecha_documento_anterior text;
alter table public.compras add column if not exists fecha_vencimiento_anterior text;
alter table public.compras add column if not exists descuentos_anterior numeric;
alter table public.compras add column if not exists subtotal_anterior numeric;
alter table public.compras add column if not exists proyecto_anterior integer;
alter table public.compras add column if not exists tipo_operacion_anterior integer;
alter table public.compras add column if not exists rubro_anterior integer;
alter table public.compras add column if not exists tipo_rubro_anterior text;
alter table public.compras add column if not exists cuenta_contable_anterior text;
alter table public.compras add column if not exists centro_costo_anterior text;
alter table public.compras add column if not exists estado_conta_anterior text;
alter table public.compras add column if not exists banco_proveedor_anterior integer;
alter table public.compras add column if not exists penalizacion_vencimiento_anterior numeric;
create unique index if not exists compras_origen_anterior_uk on public.compras (localidad_id, origen_anterior, compra_anterior) where origen_anterior is not null;

-- Clasificaciones de compras: catálogo común a todas las organizaciones (script 93). Se completan tipo, columna, reporte de facturas y
-- siglas donde no tengan; «libro de compras» y «aplica IVA» no se cambian (los usan las demás organizaciones): si difieren se informa.
alter table public.clasificaciones_compra add column if not exists tipo text;
alter table public.clasificaciones_compra add column if not exists columna text;
alter table public.clasificaciones_compra add column if not exists incluir_reporte_facturas boolean;
do $clasif$
declare v_n int := 0; v_dif text;
begin
  with m (codigo, nombre, libro, aplica_iva, tipo, columna, reporte, siglas) as (values
    (1::integer, 'NO IVA - NO LC'::text, false::boolean, false::boolean, 'N'::text, 'N'::text, false::boolean, null::text),
    (2, 'SERVICIOS', true, true, 'S', 'S', true, 'SER'),
    (3, 'BIENES EXENTOS', true, false, 'X', 'X', true, null),
    (4, 'BIENES', true, true, 'B', 'B', true, 'COM'),
    (5, 'COMBUSTIBLES', true, true, 'C', 'C', true, 'GAS'),
    (6, 'SERVICIOS EXENTOS', true, false, 'E', 'E', true, null),
    (7, 'COMPRAS MEDICAS', true, true, 'M', 'M', true, null),
    (8, 'GASTO NO DEDUCIBLE', false, false, 'N', 'N', false, null),
    (9, 'IMPORTACIONES', true, true, 'I', 'I', true, 'IMP'),
    (10, 'PEQUEÑO CONTRIBUYENTE', true, false, 'P', 'P', true, 'FPQ')),
  nuevos as (
    insert into public.clasificaciones_compra (codigo, nombre, siglas, libro_compras, aplica_iva, tipo, columna, incluir_reporte_facturas)
    select m.codigo, m.nombre, case when upper(m.siglas) ~ '^[A-Z0-9]{1,6}$' then upper(m.siglas) end, coalesce(m.libro, true), coalesce(m.aplica_iva, true), m.tipo, m.columna, m.reporte
    from m where not exists (select 1 from public.clasificaciones_compra k where k.codigo = m.codigo)
      and not exists (select 1 from public.clasificaciones_compra k where upper(k.nombre) = upper(m.nombre))
    returning 1)
  select count(*) into v_n from nuevos;
  update public.clasificaciones_compra k set tipo = coalesce(k.tipo, m.tipo), columna = coalesce(k.columna, m.columna),
    incluir_reporte_facturas = coalesce(k.incluir_reporte_facturas, m.reporte),
    siglas = coalesce(k.siglas, case when upper(m.siglas) ~ '^[A-Z0-9]{1,6}$' then upper(m.siglas) end)
  from (values
    (1::integer, 'N'::text, 'N'::text, false::boolean, null::text),
    (2, 'S', 'S', true, 'SER'),
    (3, 'X', 'X', true, null),
    (4, 'B', 'B', true, 'COM'),
    (5, 'C', 'C', true, 'GAS'),
    (6, 'E', 'E', true, null),
    (7, 'M', 'M', true, null),
    (8, 'N', 'N', false, null),
    (9, 'I', 'I', true, 'IMP'),
    (10, 'P', 'P', true, 'FPQ')) as m (codigo, tipo, columna, reporte, siglas)
  where k.codigo = m.codigo;
  select string_agg(format('%s %s (libro %s, IVA %s)', k.codigo, k.nombre, case when m.libro then 'S' else 'N' end, case when m.aplica_iva then 'S' else 'N' end), '; ') into v_dif
  from public.clasificaciones_compra k join (values
    (1::integer, false::boolean, false::boolean),
    (2, true, true),
    (3, true, false),
    (4, true, true),
    (5, true, true),
    (6, true, false),
    (7, true, true),
    (8, false, false),
    (9, true, true),
    (10, true, false)) as m (codigo, libro, aplica_iva) on m.codigo = k.codigo
  where k.libro_compras is distinct from m.libro or k.aplica_iva is distinct from m.aplica_iva;
  raise notice '%', format('Clasificaciones de compras: %s nuevas.%s', v_n,
    case when v_dif is not null then ' En el sistema de Hospital Miraflores estas tienen otro «libro de compras» o «aplica IVA» (no se cambian; revísalas en Compras · Catálogos): ' || v_dif || '.' else '' end);
end;
$clasif$;
notify pgrst, 'reload schema';
