-- Script 321 · parte 0 de 3 · Servidor Consisav (organizaciones 8 a 12 del sistema anterior): columnas nuevas. Sin datos de empresas ni de personas.
--   Se ejecuta UNA vez, antes de las partes 1 a 3. Solo agrega las columnas que falten.
--   localidades (GEN_LOCALIDADES): nombre_anterior (NOMBRE), zona, nombre_lider, fax, empresa_visual, nivel_consolidado, codigo_integracion, grupo,
--     codigo_establecimiento, codigo_postal, pagina_web y logo_anterior (LOGO, imagen del sistema anterior).
--   parametros_generales (CON_PARAMETROS_GENERALES): cuenta_cuadre, cuenta_iva, cuenta_proveedores, cuenta_gasto, cuenta_iva_por_pagar, cuenta_exento,
--     transaccion_compras y transaccion_ventas.
set lock_timeout = '20s';
alter table public.localidades add column if not exists nombre_anterior text;
alter table public.localidades add column if not exists zona integer;
alter table public.localidades add column if not exists nombre_lider text;
alter table public.localidades add column if not exists fax text;
alter table public.localidades add column if not exists empresa_visual integer;
alter table public.localidades add column if not exists nivel_consolidado integer;
alter table public.localidades add column if not exists codigo_integracion integer;
alter table public.localidades add column if not exists grupo integer;
alter table public.localidades add column if not exists codigo_establecimiento integer;
alter table public.localidades add column if not exists codigo_postal text;
alter table public.localidades add column if not exists pagina_web text;
alter table public.localidades add column if not exists logo_anterior bytea;
alter table public.parametros_generales add column if not exists cuenta_cuadre text;
alter table public.parametros_generales add column if not exists cuenta_iva text;
alter table public.parametros_generales add column if not exists cuenta_proveedores text;
alter table public.parametros_generales add column if not exists cuenta_gasto text;
alter table public.parametros_generales add column if not exists cuenta_iva_por_pagar text;
alter table public.parametros_generales add column if not exists cuenta_exento text;
alter table public.parametros_generales add column if not exists transaccion_compras integer;
alter table public.parametros_generales add column if not exists transaccion_ventas integer;
notify pgrst, 'reload schema';
