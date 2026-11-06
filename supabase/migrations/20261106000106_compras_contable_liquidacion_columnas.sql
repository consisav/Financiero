-- Compras de la organización 3 · columnas pendientes de «ACT_DETCON_COMPRAS.xls» y «ACT_DOCTOS_LIQUIDA.xls».
--   Los datos de los dos archivos ya se migraron: el detalle contable en el script 91 (26 líneas de 9
--   compras varias de 3-02) y los documentos de liquidación en el script 92 (741 documentos de 654
--   compras). Este script agrega las columnas de los archivos que no estaban en la base de datos:
--   * compra_lineas: debe_mi y haber_mi (DEBITO_MI y CREDITO_MI, moneda internacional), y
--     cuenta_codigo_anterior y version_cuenta_anterior (CUENTA y VERSION tal como venían). CENTRO ya
--     existía (centro_id).
--   * compra_liquidaciones: observaciones (OBSERVACIONES), anio_poliza, mes_poliza y poliza (AÑO_POLIZA,
--     MES_POLIZA y POLIZA).
--   En los archivos esas columnas vienen vacías en todas las filas (no hay valores que cargar); el código y
--   la versión de la cuenta se llenan desde la cuenta ya ligada a cada línea migrada.
--   1. No se crean líneas ni documentos: los existentes se actualizan. Puede ejecutarse de nuevo.
-- Se ejecuta después del script 105.

alter table public.compra_lineas add column if not exists debe_mi numeric(18, 2);
alter table public.compra_lineas add column if not exists haber_mi numeric(18, 2);
alter table public.compra_lineas add column if not exists cuenta_codigo_anterior text;
alter table public.compra_lineas add column if not exists version_cuenta_anterior integer;
alter table public.compra_liquidaciones add column if not exists observaciones text;
alter table public.compra_liquidaciones add column if not exists anio_poliza integer;
alter table public.compra_liquidaciones add column if not exists mes_poliza integer;
alter table public.compra_liquidaciones add column if not exists poliza integer;

do $migra$
declare
  v_org bigint;
  v_lineas integer;
  v_liq integer;
begin
  select id into v_org from public.organizaciones where codigo = '3';
  if v_org is null then raise notice 'No existe la organización 3.'; return; end if;
  -- Líneas contables migradas (compras varias del sistema anterior): código y versión de su cuenta.
  alter table public.compra_lineas disable trigger compra_lineas_validar;
  update public.compra_lineas cl set cuenta_codigo_anterior = k.codigo, version_cuenta_anterior = g.version
  from public.compras c, public.cuentas k, public.catalogos_cuentas g
  where c.id = cl.compra_id and c.organizacion_id = v_org and c.origen_anterior is not null
    and k.id = cl.cuenta_id and g.id = k.catalogo_id
    and (cl.cuenta_codigo_anterior is distinct from k.codigo or cl.version_cuenta_anterior is distinct from g.version);
  get diagnostics v_lineas = row_count;
  alter table public.compra_lineas enable trigger compra_lineas_validar;
  select count(*) into v_liq from public.compra_liquidaciones l join public.compras c on c.id = l.compra_id where c.organizacion_id = v_org;
  raise notice '%', format('Detalle contable: %s líneas con su cuenta anterior. Documentos de liquidación de la organización 3: %s (columnas nuevas agregadas; vienen vacías en el archivo).',
    v_lineas, v_liq);
end;
$migra$;

notify pgrst, 'reload schema';
