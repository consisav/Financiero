-- Bodegas de la organización 3 (Futura Farma - Mavisa), del archivo «ACT_BODEGAS.xls»
-- (22 bodegas: 11 de la localidad 3-01 y 11 de la 3-02).
--   1. Si la bodega ya existe en la localidad (mismo código) NO se crea: se actualiza.
--   2. Columnas nuevas de bodegas (vienen en el archivo y no estaban en la base de datos):
--      escoger_serie, calcular_desg_despacho, aplica_conta, bodega_covid (S/N), secuencia_orden,
--      cuenta_pt_codigo y version_pt (CUENTA_PT y VERSION_PT), cuenta_pt_sumi, tipo_precio_anterior
--      (TIPO_PRECIO_DFLT) y los códigos de transacción que la pantalla no maneja:
--      trx_despachos_pro (TIPO_TRANS_DESPAC_PRO), trx_nota_dev, rev_nota_dev y trx_salida_maquila;
--      transacciones_anteriores guarda los números de todas las transacciones del archivo (aunque no
--      existan en la localidad).
--   Equivalencias: TIPO G/S = GENERAL/SUB-BODEGA (BODEGA_MAYOR = código de su bodega general; en
--   una general apunta a sí misma y no se usa); TIPO_BODEGA N/C/A = NORMAL/CONSIGNACIÓN/CUENTA
--   AJENA; ESTADO A/I = ACTIVO/INACTIVO; S/N = sí/no; TIPO_PRECIO_DFLT 1 a 5 = PÚBLICO, MAYORISTA,
--   DISTRIBUIDOR, INSTITUCIONAL, COSTO (sin valor = DISTRIBUIDOR).
--   Transacciones (por su número en la localidad): TRASLADO, AJUSTE_POS, AJUSTE_NEG, DESPAC_MED
--   (despachos) y ENTRAD_MED (entradas); reversiones TRAS_ANU, AJUS_ANU, DESP_ANU y ENTR_ANU. La cuenta
--   PT se liga si existe en el catálogo de la localidad; su código queda siempre en cuenta_pt_codigo.
--   Puede ejecutarse de nuevo: la segunda vez solo actualiza.
-- Se ejecuta después del script 86.

alter table public.bodegas add column if not exists escoger_serie boolean;
alter table public.bodegas add column if not exists calcular_desg_despacho boolean;
alter table public.bodegas add column if not exists aplica_conta boolean;
alter table public.bodegas add column if not exists bodega_covid boolean;
alter table public.bodegas add column if not exists secuencia_orden integer;
alter table public.bodegas add column if not exists cuenta_pt_codigo text;
alter table public.bodegas add column if not exists version_pt integer;
alter table public.bodegas add column if not exists cuenta_pt_sumi text;
alter table public.bodegas add column if not exists tipo_precio_anterior integer;
alter table public.bodegas add column if not exists trx_despachos_pro integer;
alter table public.bodegas add column if not exists trx_nota_dev integer;
alter table public.bodegas add column if not exists rev_nota_dev integer;
alter table public.bodegas add column if not exists trx_salida_maquila integer;
alter table public.bodegas add column if not exists transacciones_anteriores text;

do $migra$
declare
  v_org bigint;
  v_loc bigint;
  v_id bigint;
  v_mayor bigint;
  v_cuenta bigint;
  r jsonb;
  v_nuevas integer := 0;
  v_act integer := 0;
  v_sin_trx text := '';
  v_sin_cuenta text := '';
  v_omitidas text := '';
  c text;
begin
  select id into v_org from public.organizaciones where codigo = 3;
  if v_org is null then raise exception 'No existe la organización 3.'; end if;

  -- Primero las bodegas generales, para que cada sub-bodega encuentre a su bodega mayor.
  for r in select x from jsonb_array_elements($j$[
  {"ORGANIZACION":3,"LOCALIDAD":1,"BODEGA":1,"NOMBRE":"VITALIS S. A.","DIRECCION":"OFICINAS CENTRALES","PERMITIR_CARGA_DIRECTA":"N","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":1012,"TIPO_TRANS_AJUSTE_POS":1014,"TIPO_TRANS_AJUSTE_NEG":1014,"TIPO_TRANS_DESPAC_PRO":51,"TIPO_TRANS_DESPAC_MED":1013,"TIPO_TRANS_ENTRAD_MED":1011,"ESTADO":"I","CUENTA_PT":115155301,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":1072,"TIPO_TRANS_AJUS_ANU":1074,"TIPO_TRANS_DESP_ANU":1073,"TIPO_TRANS_ENTR_ANU":1071,"TIPO_PRECIO_DFLT":4,"TIPO_TRANS_NOTA_DEV":1107,"TIPO_TRANS_NDEV_ANU":1107,"CUENTA_PT_SUMI":115155331,"ENCARGADO":327,"NOMBRE_ENCARGADO":"JOSE ADOLFO CHICOJ MUÑOZ","SIGLAS":"FF","CALCULAR_DESG_DESPACHO":"S","TIPO":"S","BODEGA_MAYOR":2,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"N"},
  {"ORGANIZACION":3,"LOCALIDAD":1,"BODEGA":2,"NOMBRE":"PRIVADO FUTURA FARMA","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"S","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":4,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":327,"NOMBRE_ENCARGADO":"JOSE ADOLFO CHICOJ MUÑOZ","SIGLAS":"FF","CALCULAR_DESG_DESPACHO":"S","TIPO":"G","BODEGA_MAYOR":2,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"S","PERMITIR_VENDER":"S"},
  {"ORGANIZACION":3,"LOCALIDAD":1,"BODEGA":3,"NOMBRE":"ADS PHARMACEUTICAL","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"S","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":null,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":327,"NOMBRE_ENCARGADO":"JOSE ADOLFO CHICOJ MUÑOZ","SIGLAS":"FF","CALCULAR_DESG_DESPACHO":"S","TIPO":"S","BODEGA_MAYOR":13,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"S"},
  {"ORGANIZACION":3,"LOCALIDAD":1,"BODEGA":4,"NOMBRE":"VICAR FARMACEUTICA S. A.","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"S","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":null,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":327,"NOMBRE_ENCARGADO":"JOSE ADOLFO CHICOJ MUÑOZ","SIGLAS":"FF","CALCULAR_DESG_DESPACHO":"S","TIPO":"S","BODEGA_MAYOR":13,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"S"},
  {"ORGANIZACION":3,"LOCALIDAD":1,"BODEGA":5,"NOMBRE":"RYAN","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"S","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":null,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":327,"NOMBRE_ENCARGADO":"JOSE ADOLFO CHICOJ MUÑOZ","SIGLAS":"FF","CALCULAR_DESG_DESPACHO":"S","TIPO":"S","BODEGA_MAYOR":13,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"S"},
  {"ORGANIZACION":3,"LOCALIDAD":1,"BODEGA":8,"NOMBRE":"FINAO BIOTECH","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"S","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":4,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":327,"NOMBRE_ENCARGADO":"JOSE ADOLFO CHICOJ MUÑOZ","SIGLAS":"FF","CALCULAR_DESG_DESPACHO":"S","TIPO":"S","BODEGA_MAYOR":2,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"S"},
  {"ORGANIZACION":3,"LOCALIDAD":1,"BODEGA":9,"NOMBRE":"VENCIDOS BIAL-FF","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"N","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":4,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":327,"NOMBRE_ENCARGADO":"JOSE ADOLFO CHICOJ MUÑOZ","SIGLAS":"FF","CALCULAR_DESG_DESPACHO":"S","TIPO":"S","BODEGA_MAYOR":13,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"N"},
  {"ORGANIZACION":3,"LOCALIDAD":1,"BODEGA":10,"NOMBRE":"VENCIDOS - FF","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"N","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":4,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":327,"NOMBRE_ENCARGADO":"JOSE ADOLFO CHICOJ MUÑOZ","SIGLAS":"FF","CALCULAR_DESG_DESPACHO":"S","TIPO":"S","BODEGA_MAYOR":2,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"N"},
  {"ORGANIZACION":3,"LOCALIDAD":1,"BODEGA":13,"NOMBRE":"BIAL- FUTURA FARMA","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"N","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":null,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":null,"NOMBRE_ENCARGADO":null,"SIGLAS":null,"CALCULAR_DESG_DESPACHO":"S","TIPO":"G","BODEGA_MAYOR":13,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"N"},
  {"ORGANIZACION":3,"LOCALIDAD":1,"BODEGA":14,"NOMBRE":"CONSIGNACION","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"N","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":3,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":327,"NOMBRE_ENCARGADO":"JOSE ADOLFO CHICOJ MUÑOZ","SIGLAS":null,"CALCULAR_DESG_DESPACHO":"S","TIPO":"G","BODEGA_MAYOR":2,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"C","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"S"},
  {"ORGANIZACION":3,"LOCALIDAD":1,"BODEGA":15,"NOMBRE":"PISA","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"S","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":4,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":null,"NOMBRE_ENCARGADO":"FACTOR ALVAREZ","SIGLAS":null,"CALCULAR_DESG_DESPACHO":"S","TIPO":"G","BODEGA_MAYOR":null,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"S"},
  {"ORGANIZACION":3,"LOCALIDAD":2,"BODEGA":1,"NOMBRE":"VITALIS PRIVADO","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"S","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":2,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":null,"NOMBRE_ENCARGADO":"FACTOR ALVAREZ","SIGLAS":"VIT","CALCULAR_DESG_DESPACHO":"S","TIPO":"S","BODEGA_MAYOR":10,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"S"},
  {"ORGANIZACION":3,"LOCALIDAD":2,"BODEGA":2,"NOMBRE":"VENCIDOS Y/O QUEBRADOS","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"N","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":2,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":null,"NOMBRE_ENCARGADO":"FACTOR ALVAREZ","SIGLAS":"VYQ","CALCULAR_DESG_DESPACHO":"S","TIPO":"G","BODEGA_MAYOR":null,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"N"},
  {"ORGANIZACION":3,"LOCALIDAD":2,"BODEGA":3,"NOMBRE":"CUENTA AJENA VITALIS","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"N","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":2,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":null,"NOMBRE_ENCARGADO":"FACTOR ALVAREZ","SIGLAS":"CAV","CALCULAR_DESG_DESPACHO":"S","TIPO":"G","BODEGA_MAYOR":10,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"A","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"N"},
  {"ORGANIZACION":3,"LOCALIDAD":2,"BODEGA":6,"NOMBRE":"LICITACIONES","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"S","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":2,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":null,"NOMBRE_ENCARGADO":"FACTOR ALVAREZ","SIGLAS":"VIT","CALCULAR_DESG_DESPACHO":"S","TIPO":"S","BODEGA_MAYOR":10,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"S","PERMITIR_VENDER":"S"},
  {"ORGANIZACION":3,"LOCALIDAD":2,"BODEGA":7,"NOMBRE":"CONSIGNACION","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"N","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":2,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":null,"NOMBRE_ENCARGADO":"FACTOR ALVAREZ","SIGLAS":"CON","CALCULAR_DESG_DESPACHO":"S","TIPO":"G","BODEGA_MAYOR":null,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"C","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"S"},
  {"ORGANIZACION":3,"LOCALIDAD":2,"BODEGA":8,"NOMBRE":"CHEMILCO","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"S","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":2,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":null,"NOMBRE_ENCARGADO":"FACTOR ALVAREZ","SIGLAS":"CHE","CALCULAR_DESG_DESPACHO":"S","TIPO":"G","BODEGA_MAYOR":null,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"S"},
  {"ORGANIZACION":3,"LOCALIDAD":2,"BODEGA":9,"NOMBRE":"LOTUS","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"S","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":2,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":null,"NOMBRE_ENCARGADO":"FACTOR ALVAREZ","SIGLAS":"LOT","CALCULAR_DESG_DESPACHO":"S","TIPO":"G","BODEGA_MAYOR":null,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"S"},
  {"ORGANIZACION":3,"LOCALIDAD":2,"BODEGA":10,"NOMBRE":"VITALIS","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"N","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":null,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":null,"NOMBRE_ENCARGADO":"FACTOR ALVAREZ","SIGLAS":"VIT","CALCULAR_DESG_DESPACHO":"S","TIPO":"G","BODEGA_MAYOR":null,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"N"},
  {"ORGANIZACION":3,"LOCALIDAD":2,"BODEGA":11,"NOMBRE":"TRADE","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"S","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"I","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":null,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":null,"NOMBRE_ENCARGADO":"FACTOR ALVAREZ","SIGLAS":"VIT","CALCULAR_DESG_DESPACHO":"S","TIPO":"S","BODEGA_MAYOR":10,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"S"},
  {"ORGANIZACION":3,"LOCALIDAD":2,"BODEGA":12,"NOMBRE":"BALAXI","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"S","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":2,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":null,"NOMBRE_ENCARGADO":"FACTOR ALVAREZ","SIGLAS":"BAL","CALCULAR_DESG_DESPACHO":"S","TIPO":"G","BODEGA_MAYOR":null,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"S"},
  {"ORGANIZACION":3,"LOCALIDAD":2,"BODEGA":13,"NOMBRE":"DESCARTABLE","DIRECCION":null,"PERMITIR_CARGA_DIRECTA":"S","ESCOGER_SERIE":"N","TIPO_TRANS_TRASLADO":null,"TIPO_TRANS_AJUSTE_POS":null,"TIPO_TRANS_AJUSTE_NEG":null,"TIPO_TRANS_DESPAC_PRO":null,"TIPO_TRANS_DESPAC_MED":null,"TIPO_TRANS_ENTRAD_MED":null,"ESTADO":"A","CUENTA_PT":null,"VERSION_PT":null,"TIPO_TRANS_TRAS_ANU":null,"TIPO_TRANS_AJUS_ANU":null,"TIPO_TRANS_DESP_ANU":null,"TIPO_TRANS_ENTR_ANU":null,"TIPO_PRECIO_DFLT":2,"TIPO_TRANS_NOTA_DEV":null,"TIPO_TRANS_NDEV_ANU":null,"CUENTA_PT_SUMI":null,"ENCARGADO":null,"NOMBRE_ENCARGADO":"FACTOR ALVAREZ","SIGLAS":"DES","CALCULAR_DESG_DESPACHO":"S","TIPO":"G","BODEGA_MAYOR":null,"SECUENCIA_ORDEN":null,"TIPO_BODEGA":"N","TIPO_TRANS_SAL_MAQ":null,"APLICA_CONTA":null,"BODEGA_CONSIGNACION":"N","BODEGA_COVID":"N","BODEGA_LICITACION":"N","PERMITIR_VENDER":"S"}
]$j$::jsonb) x
    order by (x->>'LOCALIDAD')::integer, (x->>'TIPO') = 'S', (x->>'BODEGA')::integer
  loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = (r->>'LOCALIDAD')::integer;
    if v_loc is null then
      if position(format('3-%s', lpad(r->>'LOCALIDAD', 2, '0')) in v_omitidas) = 0 then v_omitidas := v_omitidas || format(' 3-%s', lpad(r->>'LOCALIDAD', 2, '0')); end if;
      continue;
    end if;
    -- Transacciones del archivo que no existen en la localidad (quedan sin ligar).
    foreach c in array array['TIPO_TRANS_TRASLADO', 'TIPO_TRANS_AJUSTE_POS', 'TIPO_TRANS_AJUSTE_NEG', 'TIPO_TRANS_DESPAC_MED', 'TIPO_TRANS_ENTRAD_MED',
                             'TIPO_TRANS_TRAS_ANU', 'TIPO_TRANS_AJUS_ANU', 'TIPO_TRANS_DESP_ANU', 'TIPO_TRANS_ENTR_ANU'] loop
      if nullif(r->>c, '') is not null and not exists (select 1 from public.transacciones_contables t where t.localidad_id = v_loc and t.numero = (r->>c)::integer)
         and position(format(' %s;', r->>c) in v_sin_trx) = 0 then
        v_sin_trx := v_sin_trx || format(' %s;', r->>c);
      end if;
    end loop;
    v_mayor := case when r->>'TIPO' = 'S' then
      (select b.id from public.bodegas b where b.localidad_id = v_loc and b.codigo = (r->>'BODEGA_MAYOR')::integer and b.tipo = 'GENERAL') end;
    select k.id into v_cuenta from public.cuentas k join public.catalogos_cuentas g on g.id = k.catalogo_id
    where g.localidad_id = v_loc and k.codigo = nullif(r->>'CUENTA_PT', '')
      and (g.version = nullif(r->>'VERSION_PT', '')::integer or (nullif(r->>'VERSION_PT', '') is null and g.activo))
    order by g.version desc limit 1;
    if nullif(r->>'CUENTA_PT', '') is not null and v_cuenta is null then
      v_sin_cuenta := v_sin_cuenta || format(' 3-%s bodega %s cuenta %s;', lpad(r->>'LOCALIDAD', 2, '0'), r->>'BODEGA', r->>'CUENTA_PT');
    end if;
    if exists (select 1 from public.bodegas where localidad_id = v_loc and codigo = (r->>'BODEGA')::integer) then v_act := v_act + 1; else v_nuevas := v_nuevas + 1; end if;

    insert into public.bodegas (organizacion_id, localidad_id, codigo, nombre, tipo, bodega_mayor_id, direccion, siglas,
           carga_directa, consignacion, licitacion, permite_ventas, modalidad, encargado_codigo, encargado_nombre,
           trx_entradas_id, trx_ajuste_mas_id, trx_ajuste_menos_id, trx_despachos_id, trx_traslados_id,
           rev_traslados_id, rev_ajustes_id, rev_despachos_id, rev_entradas_id, cuenta_pt_id, tipo_precio, estado,
           escoger_serie, calcular_desg_despacho, aplica_conta, bodega_covid, secuencia_orden, cuenta_pt_codigo, version_pt,
           cuenta_pt_sumi, tipo_precio_anterior, trx_despachos_pro, trx_nota_dev, rev_nota_dev, trx_salida_maquila, transacciones_anteriores)
    select v_org, v_loc, (r->>'BODEGA')::integer, trim(r->>'NOMBRE'),
           case when r->>'TIPO' = 'S' and v_mayor is not null then 'SUB-BODEGA' else 'GENERAL' end, v_mayor,
           nullif(trim(r->>'DIRECCION'), ''),
           case when upper(trim(r->>'SIGLAS')) ~ '^[A-Z0-9]{1,6}$' then upper(trim(r->>'SIGLAS')) end,
           r->>'PERMITIR_CARGA_DIRECTA' = 'S', r->>'BODEGA_CONSIGNACION' = 'S', r->>'BODEGA_LICITACION' = 'S', r->>'PERMITIR_VENDER' = 'S',
           case r->>'TIPO_BODEGA' when 'C' then 'CONSIGNACIÓN' when 'A' then 'CUENTA AJENA' else 'NORMAL' end,
           nullif(trim(r->>'ENCARGADO'), ''), nullif(trim(r->>'NOMBRE_ENCARGADO'), ''),
           (select tc.id from public.transacciones_contables tc where tc.localidad_id = v_loc and tc.numero = nullif(r->>'TIPO_TRANS_ENTRAD_MED', '')::integer), (select tc.id from public.transacciones_contables tc where tc.localidad_id = v_loc and tc.numero = nullif(r->>'TIPO_TRANS_AJUSTE_POS', '')::integer), (select tc.id from public.transacciones_contables tc where tc.localidad_id = v_loc and tc.numero = nullif(r->>'TIPO_TRANS_AJUSTE_NEG', '')::integer), (select tc.id from public.transacciones_contables tc where tc.localidad_id = v_loc and tc.numero = nullif(r->>'TIPO_TRANS_DESPAC_MED', '')::integer), (select tc.id from public.transacciones_contables tc where tc.localidad_id = v_loc and tc.numero = nullif(r->>'TIPO_TRANS_TRASLADO', '')::integer),
           (select tc.id from public.transacciones_contables tc where tc.localidad_id = v_loc and tc.numero = nullif(r->>'TIPO_TRANS_TRAS_ANU', '')::integer), (select tc.id from public.transacciones_contables tc where tc.localidad_id = v_loc and tc.numero = nullif(r->>'TIPO_TRANS_AJUS_ANU', '')::integer), (select tc.id from public.transacciones_contables tc where tc.localidad_id = v_loc and tc.numero = nullif(r->>'TIPO_TRANS_DESP_ANU', '')::integer), (select tc.id from public.transacciones_contables tc where tc.localidad_id = v_loc and tc.numero = nullif(r->>'TIPO_TRANS_ENTR_ANU', '')::integer), v_cuenta,
           (array['PÚBLICO', 'MAYORISTA', 'DISTRIBUIDOR', 'INSTITUCIONAL', 'COSTO'])[coalesce(nullif(r->>'TIPO_PRECIO_DFLT', '')::integer, 3)],
           case when r->>'ESTADO' = 'I' then 'INACTIVO' else 'ACTIVO' end,
           case r->>'ESCOGER_SERIE' when 'S' then true when 'N' then false end,
           case r->>'CALCULAR_DESG_DESPACHO' when 'S' then true when 'N' then false end,
           case r->>'APLICA_CONTA' when 'S' then true when 'N' then false end,
           case r->>'BODEGA_COVID' when 'S' then true when 'N' then false end,
           nullif(r->>'SECUENCIA_ORDEN', '')::integer, nullif(r->>'CUENTA_PT', ''), nullif(r->>'VERSION_PT', '')::integer,
           nullif(r->>'CUENTA_PT_SUMI', ''), nullif(r->>'TIPO_PRECIO_DFLT', '')::integer,
           nullif(r->>'TIPO_TRANS_DESPAC_PRO', '')::integer, nullif(r->>'TIPO_TRANS_NOTA_DEV', '')::integer,
           nullif(r->>'TIPO_TRANS_NDEV_ANU', '')::integer, nullif(r->>'TIPO_TRANS_SAL_MAQ', '')::integer,
           nullif(concat_ws(' · ',
             'Traslado ' || (r->>'TIPO_TRANS_TRASLADO'), 'Ajuste + ' || (r->>'TIPO_TRANS_AJUSTE_POS'), 'Ajuste - ' || (r->>'TIPO_TRANS_AJUSTE_NEG'),
             'Despacho ' || (r->>'TIPO_TRANS_DESPAC_MED'), 'Entrada ' || (r->>'TIPO_TRANS_ENTRAD_MED'),
             'Rev. traslado ' || (r->>'TIPO_TRANS_TRAS_ANU'), 'Rev. ajuste ' || (r->>'TIPO_TRANS_AJUS_ANU'),
             'Rev. despacho ' || (r->>'TIPO_TRANS_DESP_ANU'), 'Rev. entrada ' || (r->>'TIPO_TRANS_ENTR_ANU')), '')
    on conflict (localidad_id, codigo) do update set
      nombre = excluded.nombre, tipo = excluded.tipo, bodega_mayor_id = excluded.bodega_mayor_id, direccion = excluded.direccion,
      siglas = excluded.siglas, carga_directa = excluded.carga_directa, consignacion = excluded.consignacion, licitacion = excluded.licitacion,
      permite_ventas = excluded.permite_ventas, modalidad = excluded.modalidad, encargado_codigo = excluded.encargado_codigo,
      encargado_nombre = excluded.encargado_nombre, trx_entradas_id = excluded.trx_entradas_id, trx_ajuste_mas_id = excluded.trx_ajuste_mas_id,
      trx_ajuste_menos_id = excluded.trx_ajuste_menos_id, trx_despachos_id = excluded.trx_despachos_id, trx_traslados_id = excluded.trx_traslados_id,
      rev_traslados_id = excluded.rev_traslados_id, rev_ajustes_id = excluded.rev_ajustes_id, rev_despachos_id = excluded.rev_despachos_id,
      rev_entradas_id = excluded.rev_entradas_id, cuenta_pt_id = excluded.cuenta_pt_id, tipo_precio = excluded.tipo_precio, estado = excluded.estado,
      escoger_serie = excluded.escoger_serie, calcular_desg_despacho = excluded.calcular_desg_despacho, aplica_conta = excluded.aplica_conta,
      bodega_covid = excluded.bodega_covid, secuencia_orden = excluded.secuencia_orden, cuenta_pt_codigo = excluded.cuenta_pt_codigo,
      version_pt = excluded.version_pt, cuenta_pt_sumi = excluded.cuenta_pt_sumi, tipo_precio_anterior = excluded.tipo_precio_anterior,
      trx_despachos_pro = excluded.trx_despachos_pro, trx_nota_dev = excluded.trx_nota_dev, rev_nota_dev = excluded.rev_nota_dev,
      trx_salida_maquila = excluded.trx_salida_maquila, transacciones_anteriores = excluded.transacciones_anteriores;
  end loop;

  raise notice '%', format('Bodegas de la organización 3: %s nuevas, %s actualizadas.%s%s%s',
    v_nuevas, v_act,
    case when v_sin_trx <> '' then ' Transacciones que no existen en la localidad (quedan sin ligar):' || v_sin_trx else '' end,
    case when v_sin_cuenta <> '' then ' Cuenta PT que no existe en el catálogo (queda su código):' || v_sin_cuenta else '' end,
    case when v_omitidas <> '' then ' Localidades que no existen (omitidas):' || v_omitidas else '' end);
end;
$migra$;

notify pgrst, 'reload schema';
