-- Parámetros generales de la organización 3 (Futura Farma - Mavisa), del archivo
-- «4. CON_PARAMETROS_GENERALES.xls»: un registro por localidad (3-01, 3-02 y 3-03).
--   1. Si la localidad ya tiene parámetros NO se crean otros: se actualizan con los del archivo.
--   2. Columnas nuevas de parametros_generales (vienen en el archivo y no estaban en la base de datos):
--      pct_igss, cuota_patronal, pct_irtra, pct_indemnizacion, pct_aguinaldo, pct_bono14,
--      pct_vacaciones, nombre_planillas, nombre_caja_chica, path_archivos, path_backup_bdd,
--      path_backup_apl, cuenta_principal_ingresos, cuenta_principal_egresos,
--      cuenta_resultado_ejercicio, cuenta_principal_perdida, cuenta_principal_ganancia,
--      cuenta_dummy, cuenta_dif_cambiario, cuenta_idp, cta_iva_retenido, cta_iva_factura_especial,
--      cta_isr_factura_especial, cta_isr_retenido, version_actual_nomenclatura, fecha_version,
--      cheque_inicial, cheque_final, pct_retencion, pct_retencion_agente, no_ini_retencion,
--      no_fin_retencion, fecha_ini_anticipos, descripcion_poliza_resultados,
--      descripcion_poliza_balance, descripcion_poliza_distrib, descripcion_poliza_apertura,
--      path_retenciones, path_retenciones_net, path_retenciones_envio, correo_retenciones,
--      correo_copia_o_ret, correo_aviso_nocuadre, nombre_envio, puesto_envio, prefijo_archivo,
--      sufijo_archivo, no_establecimiento, meses_max_presenta_compras, registro_contador.
--   Equivalencias: PRIMER/SEGUNDO/TERCER_IMPUESTO = impuestos 1 a 3 (IVA, ISR, OTRO), PCT_INGUAT =
--   impuesto 4; APLICA_IVA y UTILIZA_CENTROS S/N; MIG_ESTADO_CTA M/A = manual/automática; MONEDA y
--   MONEDA_INGRESO = código de la moneda; fechas en número de serie de Excel.
--   Personas que firman (PERSONA_FIRMA, CARGO y USUARIO 1 a 3) = Autorizaciones de la pantalla
--   (parametros_firmantes), por orden: «Firma como» sale del cargo (CONTADOR = Contador general,
--   REPRESENTANTE LEGAL = Representante legal); el contador lleva REGISTRO_CONTADOR; el usuario se liga
--   si ya tiene cuenta (por su código del sistema anterior) y su código queda en usuario_anterior.
--   PASSWORD_RETENCIONES NO se migra (clave legible del sistema anterior).
--   Puede ejecutarse de nuevo: la segunda vez solo actualiza.
-- Se ejecuta después del script 84.

alter table public.parametros_generales add column if not exists pct_igss numeric(6,2);
alter table public.parametros_generales add column if not exists cuota_patronal numeric(6,2);
alter table public.parametros_generales add column if not exists pct_irtra numeric(6,2);
alter table public.parametros_generales add column if not exists pct_indemnizacion numeric(6,2);
alter table public.parametros_generales add column if not exists pct_aguinaldo numeric(6,2);
alter table public.parametros_generales add column if not exists pct_bono14 numeric(6,2);
alter table public.parametros_generales add column if not exists pct_vacaciones numeric(6,2);
alter table public.parametros_generales add column if not exists nombre_planillas text;
alter table public.parametros_generales add column if not exists nombre_caja_chica text;
alter table public.parametros_generales add column if not exists path_archivos text;
alter table public.parametros_generales add column if not exists path_backup_bdd text;
alter table public.parametros_generales add column if not exists path_backup_apl text;
alter table public.parametros_generales add column if not exists cuenta_principal_ingresos text;
alter table public.parametros_generales add column if not exists cuenta_principal_egresos text;
alter table public.parametros_generales add column if not exists cuenta_resultado_ejercicio text;
alter table public.parametros_generales add column if not exists cuenta_principal_perdida text;
alter table public.parametros_generales add column if not exists cuenta_principal_ganancia text;
alter table public.parametros_generales add column if not exists cuenta_dummy text;
alter table public.parametros_generales add column if not exists cuenta_dif_cambiario text;
alter table public.parametros_generales add column if not exists cuenta_idp text;
alter table public.parametros_generales add column if not exists cta_iva_retenido text;
alter table public.parametros_generales add column if not exists cta_iva_factura_especial text;
alter table public.parametros_generales add column if not exists cta_isr_factura_especial text;
alter table public.parametros_generales add column if not exists cta_isr_retenido text;
alter table public.parametros_generales add column if not exists version_actual_nomenclatura integer;
alter table public.parametros_generales add column if not exists fecha_version date;
alter table public.parametros_generales add column if not exists cheque_inicial integer;
alter table public.parametros_generales add column if not exists cheque_final integer;
alter table public.parametros_generales add column if not exists pct_retencion numeric(6,2);
alter table public.parametros_generales add column if not exists pct_retencion_agente numeric(6,2);
alter table public.parametros_generales add column if not exists no_ini_retencion integer;
alter table public.parametros_generales add column if not exists no_fin_retencion integer;
alter table public.parametros_generales add column if not exists fecha_ini_anticipos date;
alter table public.parametros_generales add column if not exists descripcion_poliza_resultados text;
alter table public.parametros_generales add column if not exists descripcion_poliza_balance text;
alter table public.parametros_generales add column if not exists descripcion_poliza_distrib text;
alter table public.parametros_generales add column if not exists descripcion_poliza_apertura text;
alter table public.parametros_generales add column if not exists path_retenciones text;
alter table public.parametros_generales add column if not exists path_retenciones_net text;
alter table public.parametros_generales add column if not exists path_retenciones_envio text;
alter table public.parametros_generales add column if not exists correo_retenciones text;
alter table public.parametros_generales add column if not exists correo_copia_o_ret text;
alter table public.parametros_generales add column if not exists correo_aviso_nocuadre text;
alter table public.parametros_generales add column if not exists nombre_envio text;
alter table public.parametros_generales add column if not exists puesto_envio text;
alter table public.parametros_generales add column if not exists prefijo_archivo text;
alter table public.parametros_generales add column if not exists sufijo_archivo text;
alter table public.parametros_generales add column if not exists no_establecimiento integer;
alter table public.parametros_generales add column if not exists meses_max_presenta_compras integer;
alter table public.parametros_generales add column if not exists registro_contador text;
alter table public.parametros_firmantes add column if not exists usuario_anterior text;

-- Cuando un usuario recibe su código del sistema anterior (al crear su cuenta desde «Usuarios por
-- crear»), se liga a las firmas de su organización que tenían ese código.
create or replace function public.ligar_firmantes_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.usuario_anterior is not null and new.usuario_anterior is distinct from old.usuario_anterior then
    update public.parametros_firmantes f set perfil_id = new.id
    from public.parametros_generales p
    where p.id = f.parametros_id and f.perfil_id is null and upper(f.usuario_anterior) = upper(new.usuario_anterior)
      and p.organizacion_id = new.organizacion_id;
  end if;
  return new;
end;
$$;
drop trigger if exists perfiles_ligar_firmantes on public.perfiles;
create trigger perfiles_ligar_firmantes after update of usuario_anterior on public.perfiles
  for each row execute function public.ligar_firmantes_usuario();
revoke execute on function public.ligar_firmantes_usuario() from public, anon, authenticated;

do $migra$
declare
  v_org bigint;
  v_loc bigint;
  v_param bigint;
  r jsonb;
  k integer;
  v_nombre text;
  v_cargo text;
  v_usuario text;
  v_nuevos integer := 0;
  v_act integer := 0;
  v_firmantes integer := 0;
  v_omitidas text := '';
begin
  select id into v_org from public.organizaciones where codigo = 3;
  if v_org is null then raise exception 'No existe la organización 3.'; end if;

  for r in select x from jsonb_array_elements($j$[
  {"ORGANIZACION":3,"LOCALIDAD":1,"NIT":"8136624-8","AÑO_ACTUAL":2025,"MES_ACTUAL":12,"ULTIMO_CIERRE":46022,"PROXIMO_CIERRE":46053,"PRIMER_IMPUESTO":12,"SEGUNDO_IMPUESTO":5,"TERCER_IMPUESTO":0,"PCT_IGSS":4.83,"CUOTA_PATRONAL":10.67,"PCT_IRTRA":1,"PCT_INDEMNIZACION":9.72,"PCT_AGUINALDO":8.33,"PCT_BONO14":8.33,"PCT_VACACIONES":4.16,"INICIO_PERIODO_ACTUAL":42736,"FIN_PERIODO_ACTUAL":43100,"INICIO_PERIODO_FISCAL":42736,"FIN_PERIODO_FISCAL":43100,"PRIMER_MES_CONTABLE":1,"ULTIMO_MES_CONTABLE":12,"PERSONA_FIRMA1":"OSCAR MARTINEZ","PERSONA_FIRMA2":null,"PERSONA_FIRMA3":null,"CARGO1":"CONTADOR","CARGO2":null,"CARGO3":null,"NOMBRE_PLANILLAS":null,"NOMBRE_CAJA_CHICA":null,"PATH_ARCHIVOS":null,"MONEDA":1,"PATH_BACKUP_BDD":null,"PATH_BACKUP_APL":null,"USUARIO_1":"OLM","USUARIO_2":null,"USUARIO_3":null,"CUENTA_PRINCIPAL_INGRESOS":4,"CUENTA_PRINCIPAL_EGRESOS":5,"CUENTA_RESULTADO_EJERCICIO":3040101001,"CUENTA_PRINCIPAL_PERDIDA":3040102002,"CUENTA_PRINCIPAL_GANANCIA":3040102001,"VERSION_ACTUAL_NOMENCLATURA":1,"CHEQUE_INICIAL":null,"CHEQUE_FINAL":null,"MONEDA_INGRESO":1,"PCT_RETENCION":5,"PCT_RETENCION_AGENTE":15,"NO_INI_RETENCION":null,"NO_FIN_RETENCION":null,"FECHA_INI_ANTICIPOS":41640,"CUENTA_DUMMY":3040101001,"FECHA_VERSION":41640,"DESCRIPCION_POLIZA_RESULTADOS":null,"DESCRIPCION_POLIZA_BALANCE":null,"DESCRIPCION_POLIZA_DISTRIB":null,"DESCRIPCION_POLIZA_APERTURA":null,"PATH_RETENCIONES":"D:\\Documentos\\Contabilidad\\Retenciones\\","CORREO_RETENCIONES":null,"NOMBRE_ENVIO":"RETENCIONES","PUESTO_ENVIO":"SANATORIO MIRAFLORES","PATH_RETENCIONES_NET":null,"CORREO_COPIA_O_RET":null,"PCT_IDP_SUPER":4.7,"PCT_IDP_REGULAR":4.6,"PCT_IDP_DIESEL":1.3,"PREFIJO_ARCHIVO":"Constancia","SUFIJO_ARCHIVO":"RO","NO_ESTABLECIMIENTO":1,"CORREO_AVISO_NOCUADRE":null,"PATH_RETENCIONES_ENVIO":"\\\\10.20.10.5\\Retenciones\\SEMEDASA\\","VALOR_AUTORIZA_CHEQUES":null,"MESES_MAX_PRESENTA_COMPRAS":null,"REGISTRO_CONTADOR":null,"CUENTA_DIF_CAMBIARIO":null,"CTA_IVA_RETENIDO":null,"CTA_IVA_FACTURA_ESPECIAL":null,"CTA_ISR_FACTURA_ESPECIAL":null,"CTA_ISR_RETENIDO":null,"PCT_INGUAT":10,"APLICA_IVA":"S","UTILIZA_CENTROS":"N","MIG_ESTADO_CTA":"M","CUENTA_IDP":6010103031},
  {"ORGANIZACION":3,"LOCALIDAD":2,"NIT":"108877566","AÑO_ACTUAL":2025,"MES_ACTUAL":12,"ULTIMO_CIERRE":46022,"PROXIMO_CIERRE":46053,"PRIMER_IMPUESTO":12,"SEGUNDO_IMPUESTO":5,"TERCER_IMPUESTO":0,"PCT_IGSS":4.83,"CUOTA_PATRONAL":10.67,"PCT_IRTRA":1,"PCT_INDEMNIZACION":9.72,"PCT_AGUINALDO":8.33,"PCT_BONO14":8.33,"PCT_VACACIONES":4.16,"INICIO_PERIODO_ACTUAL":43831,"FIN_PERIODO_ACTUAL":47848,"INICIO_PERIODO_FISCAL":43831,"FIN_PERIODO_FISCAL":44196,"PRIMER_MES_CONTABLE":1,"ULTIMO_MES_CONTABLE":12,"PERSONA_FIRMA1":"RODELBI FUENTES","PERSONA_FIRMA2":"ANA ELISA VILLATORO","PERSONA_FIRMA3":null,"CARGO1":"CONTADOR","CARGO2":"REPRESENTANTE LEGAL","CARGO3":null,"NOMBRE_PLANILLAS":null,"NOMBRE_CAJA_CHICA":null,"PATH_ARCHIVOS":null,"MONEDA":1,"PATH_BACKUP_BDD":null,"PATH_BACKUP_APL":null,"USUARIO_1":"LMI","USUARIO_2":"AEV","USUARIO_3":null,"CUENTA_PRINCIPAL_INGRESOS":4,"CUENTA_PRINCIPAL_EGRESOS":5,"CUENTA_RESULTADO_EJERCICIO":3040101001,"CUENTA_PRINCIPAL_PERDIDA":3040102002,"CUENTA_PRINCIPAL_GANANCIA":3040102001,"VERSION_ACTUAL_NOMENCLATURA":1,"CHEQUE_INICIAL":null,"CHEQUE_FINAL":null,"MONEDA_INGRESO":1,"PCT_RETENCION":5,"PCT_RETENCION_AGENTE":15,"NO_INI_RETENCION":null,"NO_FIN_RETENCION":null,"FECHA_INI_ANTICIPOS":41640,"CUENTA_DUMMY":3040101001,"FECHA_VERSION":41640,"DESCRIPCION_POLIZA_RESULTADOS":null,"DESCRIPCION_POLIZA_BALANCE":null,"DESCRIPCION_POLIZA_DISTRIB":null,"DESCRIPCION_POLIZA_APERTURA":null,"PATH_RETENCIONES":"D:\\Documentos\\Contabilidad\\Retenciones\\","CORREO_RETENCIONES":null,"NOMBRE_ENVIO":"RETENCIONES","PUESTO_ENVIO":"SANATORIO MIRAFLORES","PATH_RETENCIONES_NET":null,"CORREO_COPIA_O_RET":null,"PCT_IDP_SUPER":4.7,"PCT_IDP_REGULAR":4.6,"PCT_IDP_DIESEL":1.3,"PREFIJO_ARCHIVO":"Constancia","SUFIJO_ARCHIVO":"RO","NO_ESTABLECIMIENTO":1,"CORREO_AVISO_NOCUADRE":null,"PATH_RETENCIONES_ENVIO":"\\\\10.20.10.5\\Retenciones\\SEMEDASA\\","VALOR_AUTORIZA_CHEQUES":null,"MESES_MAX_PRESENTA_COMPRAS":null,"REGISTRO_CONTADOR":"4607370-1","CUENTA_DIF_CAMBIARIO":null,"CTA_IVA_RETENIDO":null,"CTA_IVA_FACTURA_ESPECIAL":null,"CTA_ISR_FACTURA_ESPECIAL":null,"CTA_ISR_RETENIDO":null,"PCT_INGUAT":10,"APLICA_IVA":"S","UTILIZA_CENTROS":"S","MIG_ESTADO_CTA":"M","CUENTA_IDP":6010103031},
  {"ORGANIZACION":3,"LOCALIDAD":3,"NIT":"8136624-8","AÑO_ACTUAL":2018,"MES_ACTUAL":3,"ULTIMO_CIERRE":43101,"PROXIMO_CIERRE":43465,"PRIMER_IMPUESTO":12,"SEGUNDO_IMPUESTO":5,"TERCER_IMPUESTO":0,"PCT_IGSS":4.83,"CUOTA_PATRONAL":10.67,"PCT_IRTRA":1,"PCT_INDEMNIZACION":9.72,"PCT_AGUINALDO":8.33,"PCT_BONO14":8.33,"PCT_VACACIONES":4.16,"INICIO_PERIODO_ACTUAL":42736,"FIN_PERIODO_ACTUAL":43100,"INICIO_PERIODO_FISCAL":42736,"FIN_PERIODO_FISCAL":43100,"PRIMER_MES_CONTABLE":1,"ULTIMO_MES_CONTABLE":12,"PERSONA_FIRMA1":"OSCAR MARTINEZ","PERSONA_FIRMA2":null,"PERSONA_FIRMA3":null,"CARGO1":"CONTADOR","CARGO2":null,"CARGO3":null,"NOMBRE_PLANILLAS":null,"NOMBRE_CAJA_CHICA":null,"PATH_ARCHIVOS":null,"MONEDA":1,"PATH_BACKUP_BDD":null,"PATH_BACKUP_APL":null,"USUARIO_1":"OLM","USUARIO_2":null,"USUARIO_3":null,"CUENTA_PRINCIPAL_INGRESOS":null,"CUENTA_PRINCIPAL_EGRESOS":null,"CUENTA_RESULTADO_EJERCICIO":null,"CUENTA_PRINCIPAL_PERDIDA":null,"CUENTA_PRINCIPAL_GANANCIA":null,"VERSION_ACTUAL_NOMENCLATURA":1,"CHEQUE_INICIAL":null,"CHEQUE_FINAL":null,"MONEDA_INGRESO":1,"PCT_RETENCION":5,"PCT_RETENCION_AGENTE":15,"NO_INI_RETENCION":null,"NO_FIN_RETENCION":null,"FECHA_INI_ANTICIPOS":41640,"CUENTA_DUMMY":911001001,"FECHA_VERSION":41640,"DESCRIPCION_POLIZA_RESULTADOS":null,"DESCRIPCION_POLIZA_BALANCE":null,"DESCRIPCION_POLIZA_DISTRIB":null,"DESCRIPCION_POLIZA_APERTURA":null,"PATH_RETENCIONES":"D:\\Documentos\\Contabilidad\\Retenciones\\","CORREO_RETENCIONES":null,"NOMBRE_ENVIO":"RETENCIONES","PUESTO_ENVIO":"SANATORIO MIRAFLORES","PATH_RETENCIONES_NET":null,"CORREO_COPIA_O_RET":null,"PCT_IDP_SUPER":4.7,"PCT_IDP_REGULAR":4.6,"PCT_IDP_DIESEL":1.3,"PREFIJO_ARCHIVO":"Constancia","SUFIJO_ARCHIVO":"RO","NO_ESTABLECIMIENTO":1,"CORREO_AVISO_NOCUADRE":null,"PATH_RETENCIONES_ENVIO":"\\\\10.20.10.5\\Retenciones\\SEMEDASA\\","VALOR_AUTORIZA_CHEQUES":null,"MESES_MAX_PRESENTA_COMPRAS":null,"REGISTRO_CONTADOR":null,"CUENTA_DIF_CAMBIARIO":null,"CTA_IVA_RETENIDO":null,"CTA_IVA_FACTURA_ESPECIAL":null,"CTA_ISR_FACTURA_ESPECIAL":null,"CTA_ISR_RETENIDO":null,"PCT_INGUAT":10,"APLICA_IVA":"S","UTILIZA_CENTROS":"N","MIG_ESTADO_CTA":"M","CUENTA_IDP":null}
]$j$::jsonb) x
  loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = (r->>'LOCALIDAD')::integer;
    if v_loc is null then
      v_omitidas := v_omitidas || format(' 3-%s', lpad(r->>'LOCALIDAD', 2, '0'));
      continue;
    end if;
    if exists (select 1 from public.parametros_generales where localidad_id = v_loc) then v_act := v_act + 1; else v_nuevos := v_nuevos + 1; end if;
    insert into public.parametros_generales (organizacion_id, localidad_id, anio_actual, mes_actual, proximo_cierre, ultimo_cierre, inicio_periodo_actual, fin_periodo_actual, inicio_periodo_fiscal, fin_periodo_fiscal, aplicar_iva, incluir_centros_costo, migracion_bancos, impuesto1, impuesto2, impuesto3, impuesto4, idp_super, idp_regular, idp_diesel, valor_cheques_autorizacion, moneda_integracion, moneda_ingreso, nit, primer_mes_contable, ultimo_mes_contable, pct_igss, cuota_patronal, pct_irtra, pct_indemnizacion, pct_aguinaldo, pct_bono14, pct_vacaciones, nombre_planillas, nombre_caja_chica, path_archivos, path_backup_bdd, path_backup_apl, cuenta_principal_ingresos, cuenta_principal_egresos, cuenta_resultado_ejercicio, cuenta_principal_perdida, cuenta_principal_ganancia, cuenta_dummy, cuenta_dif_cambiario, cuenta_idp, cta_iva_retenido, cta_iva_factura_especial, cta_isr_factura_especial, cta_isr_retenido, version_actual_nomenclatura, fecha_version, cheque_inicial, cheque_final, pct_retencion, pct_retencion_agente, no_ini_retencion, no_fin_retencion, fecha_ini_anticipos, descripcion_poliza_resultados, descripcion_poliza_balance, descripcion_poliza_distrib, descripcion_poliza_apertura, path_retenciones, path_retenciones_net, path_retenciones_envio, correo_retenciones, correo_copia_o_ret, correo_aviso_nocuadre, nombre_envio, puesto_envio, prefijo_archivo, sufijo_archivo, no_establecimiento, meses_max_presenta_compras, registro_contador)
    values (v_org, v_loc,
      nullif(r->>'AÑO_ACTUAL', '')::integer,
      nullif(r->>'MES_ACTUAL', '')::integer,
      case when nullif(r->>'PROXIMO_CIERRE', '') is not null then date '1899-12-30' + (r->>'PROXIMO_CIERRE')::integer end,
      case when nullif(r->>'ULTIMO_CIERRE', '') is not null then date '1899-12-30' + (r->>'ULTIMO_CIERRE')::integer end,
      case when nullif(r->>'INICIO_PERIODO_ACTUAL', '') is not null then date '1899-12-30' + (r->>'INICIO_PERIODO_ACTUAL')::integer end,
      case when nullif(r->>'FIN_PERIODO_ACTUAL', '') is not null then date '1899-12-30' + (r->>'FIN_PERIODO_ACTUAL')::integer end,
      case when nullif(r->>'INICIO_PERIODO_FISCAL', '') is not null then date '1899-12-30' + (r->>'INICIO_PERIODO_FISCAL')::integer end,
      case when nullif(r->>'FIN_PERIODO_FISCAL', '') is not null then date '1899-12-30' + (r->>'FIN_PERIODO_FISCAL')::integer end,
      coalesce(case r->>'APLICA_IVA' when 'S' then true when 'N' then false end, true),
      coalesce(case r->>'UTILIZA_CENTROS' when 'S' then true when 'N' then false end, false),
      case when r->>'MIG_ESTADO_CTA' = 'A' then 'AUTOMATICA' else 'MANUAL' end,
      nullif(r->>'PRIMER_IMPUESTO', '')::numeric,
      nullif(r->>'SEGUNDO_IMPUESTO', '')::numeric,
      nullif(r->>'TERCER_IMPUESTO', '')::numeric,
      nullif(r->>'PCT_INGUAT', '')::numeric,
      nullif(r->>'PCT_IDP_SUPER', '')::numeric,
      nullif(r->>'PCT_IDP_REGULAR', '')::numeric,
      nullif(r->>'PCT_IDP_DIESEL', '')::numeric,
      nullif(r->>'VALOR_AUTORIZA_CHEQUES', '')::numeric,
      coalesce((select initcap(m.nombre) from public.monedas m where m.codigo = nullif(r->>'MONEDA', '')::integer), 'Quetzales'),
      coalesce((select initcap(m.nombre) from public.monedas m where m.codigo = nullif(r->>'MONEDA_INGRESO', '')::integer), 'Quetzales'),
      nullif(trim(r->>'NIT'), ''),
      coalesce(nullif(r->>'PRIMER_MES_CONTABLE', '')::integer, 1),
      coalesce(nullif(r->>'ULTIMO_MES_CONTABLE', '')::integer, 12),
      nullif(r->>'PCT_IGSS', '')::numeric,
      nullif(r->>'CUOTA_PATRONAL', '')::numeric,
      nullif(r->>'PCT_IRTRA', '')::numeric,
      nullif(r->>'PCT_INDEMNIZACION', '')::numeric,
      nullif(r->>'PCT_AGUINALDO', '')::numeric,
      nullif(r->>'PCT_BONO14', '')::numeric,
      nullif(r->>'PCT_VACACIONES', '')::numeric,
      nullif(trim(r->>'NOMBRE_PLANILLAS'), ''),
      nullif(trim(r->>'NOMBRE_CAJA_CHICA'), ''),
      nullif(trim(r->>'PATH_ARCHIVOS'), ''),
      nullif(trim(r->>'PATH_BACKUP_BDD'), ''),
      nullif(trim(r->>'PATH_BACKUP_APL'), ''),
      nullif(trim(r->>'CUENTA_PRINCIPAL_INGRESOS'), ''),
      nullif(trim(r->>'CUENTA_PRINCIPAL_EGRESOS'), ''),
      nullif(trim(r->>'CUENTA_RESULTADO_EJERCICIO'), ''),
      nullif(trim(r->>'CUENTA_PRINCIPAL_PERDIDA'), ''),
      nullif(trim(r->>'CUENTA_PRINCIPAL_GANANCIA'), ''),
      nullif(trim(r->>'CUENTA_DUMMY'), ''),
      nullif(trim(r->>'CUENTA_DIF_CAMBIARIO'), ''),
      nullif(trim(r->>'CUENTA_IDP'), ''),
      nullif(trim(r->>'CTA_IVA_RETENIDO'), ''),
      nullif(trim(r->>'CTA_IVA_FACTURA_ESPECIAL'), ''),
      nullif(trim(r->>'CTA_ISR_FACTURA_ESPECIAL'), ''),
      nullif(trim(r->>'CTA_ISR_RETENIDO'), ''),
      nullif(r->>'VERSION_ACTUAL_NOMENCLATURA', '')::integer,
      case when nullif(r->>'FECHA_VERSION', '') is not null then date '1899-12-30' + (r->>'FECHA_VERSION')::integer end,
      nullif(r->>'CHEQUE_INICIAL', '')::integer,
      nullif(r->>'CHEQUE_FINAL', '')::integer,
      nullif(r->>'PCT_RETENCION', '')::numeric,
      nullif(r->>'PCT_RETENCION_AGENTE', '')::numeric,
      nullif(r->>'NO_INI_RETENCION', '')::integer,
      nullif(r->>'NO_FIN_RETENCION', '')::integer,
      case when nullif(r->>'FECHA_INI_ANTICIPOS', '') is not null then date '1899-12-30' + (r->>'FECHA_INI_ANTICIPOS')::integer end,
      nullif(trim(r->>'DESCRIPCION_POLIZA_RESULTADOS'), ''),
      nullif(trim(r->>'DESCRIPCION_POLIZA_BALANCE'), ''),
      nullif(trim(r->>'DESCRIPCION_POLIZA_DISTRIB'), ''),
      nullif(trim(r->>'DESCRIPCION_POLIZA_APERTURA'), ''),
      nullif(trim(r->>'PATH_RETENCIONES'), ''),
      nullif(trim(r->>'PATH_RETENCIONES_NET'), ''),
      nullif(trim(r->>'PATH_RETENCIONES_ENVIO'), ''),
      nullif(trim(r->>'CORREO_RETENCIONES'), ''),
      nullif(trim(r->>'CORREO_COPIA_O_RET'), ''),
      nullif(trim(r->>'CORREO_AVISO_NOCUADRE'), ''),
      nullif(trim(r->>'NOMBRE_ENVIO'), ''),
      nullif(trim(r->>'PUESTO_ENVIO'), ''),
      nullif(trim(r->>'PREFIJO_ARCHIVO'), ''),
      nullif(trim(r->>'SUFIJO_ARCHIVO'), ''),
      nullif(r->>'NO_ESTABLECIMIENTO', '')::integer,
      nullif(r->>'MESES_MAX_PRESENTA_COMPRAS', '')::integer,
      nullif(trim(r->>'REGISTRO_CONTADOR'), ''))
    on conflict (localidad_id) do update set
      anio_actual = excluded.anio_actual,
      mes_actual = excluded.mes_actual,
      proximo_cierre = excluded.proximo_cierre,
      ultimo_cierre = excluded.ultimo_cierre,
      inicio_periodo_actual = excluded.inicio_periodo_actual,
      fin_periodo_actual = excluded.fin_periodo_actual,
      inicio_periodo_fiscal = excluded.inicio_periodo_fiscal,
      fin_periodo_fiscal = excluded.fin_periodo_fiscal,
      aplicar_iva = excluded.aplicar_iva,
      incluir_centros_costo = excluded.incluir_centros_costo,
      migracion_bancos = excluded.migracion_bancos,
      impuesto1 = excluded.impuesto1,
      impuesto2 = excluded.impuesto2,
      impuesto3 = excluded.impuesto3,
      impuesto4 = excluded.impuesto4,
      idp_super = excluded.idp_super,
      idp_regular = excluded.idp_regular,
      idp_diesel = excluded.idp_diesel,
      valor_cheques_autorizacion = excluded.valor_cheques_autorizacion,
      moneda_integracion = excluded.moneda_integracion,
      moneda_ingreso = excluded.moneda_ingreso,
      nit = excluded.nit,
      primer_mes_contable = excluded.primer_mes_contable,
      ultimo_mes_contable = excluded.ultimo_mes_contable,
      pct_igss = excluded.pct_igss,
      cuota_patronal = excluded.cuota_patronal,
      pct_irtra = excluded.pct_irtra,
      pct_indemnizacion = excluded.pct_indemnizacion,
      pct_aguinaldo = excluded.pct_aguinaldo,
      pct_bono14 = excluded.pct_bono14,
      pct_vacaciones = excluded.pct_vacaciones,
      nombre_planillas = excluded.nombre_planillas,
      nombre_caja_chica = excluded.nombre_caja_chica,
      path_archivos = excluded.path_archivos,
      path_backup_bdd = excluded.path_backup_bdd,
      path_backup_apl = excluded.path_backup_apl,
      cuenta_principal_ingresos = excluded.cuenta_principal_ingresos,
      cuenta_principal_egresos = excluded.cuenta_principal_egresos,
      cuenta_resultado_ejercicio = excluded.cuenta_resultado_ejercicio,
      cuenta_principal_perdida = excluded.cuenta_principal_perdida,
      cuenta_principal_ganancia = excluded.cuenta_principal_ganancia,
      cuenta_dummy = excluded.cuenta_dummy,
      cuenta_dif_cambiario = excluded.cuenta_dif_cambiario,
      cuenta_idp = excluded.cuenta_idp,
      cta_iva_retenido = excluded.cta_iva_retenido,
      cta_iva_factura_especial = excluded.cta_iva_factura_especial,
      cta_isr_factura_especial = excluded.cta_isr_factura_especial,
      cta_isr_retenido = excluded.cta_isr_retenido,
      version_actual_nomenclatura = excluded.version_actual_nomenclatura,
      fecha_version = excluded.fecha_version,
      cheque_inicial = excluded.cheque_inicial,
      cheque_final = excluded.cheque_final,
      pct_retencion = excluded.pct_retencion,
      pct_retencion_agente = excluded.pct_retencion_agente,
      no_ini_retencion = excluded.no_ini_retencion,
      no_fin_retencion = excluded.no_fin_retencion,
      fecha_ini_anticipos = excluded.fecha_ini_anticipos,
      descripcion_poliza_resultados = excluded.descripcion_poliza_resultados,
      descripcion_poliza_balance = excluded.descripcion_poliza_balance,
      descripcion_poliza_distrib = excluded.descripcion_poliza_distrib,
      descripcion_poliza_apertura = excluded.descripcion_poliza_apertura,
      path_retenciones = excluded.path_retenciones,
      path_retenciones_net = excluded.path_retenciones_net,
      path_retenciones_envio = excluded.path_retenciones_envio,
      correo_retenciones = excluded.correo_retenciones,
      correo_copia_o_ret = excluded.correo_copia_o_ret,
      correo_aviso_nocuadre = excluded.correo_aviso_nocuadre,
      nombre_envio = excluded.nombre_envio,
      puesto_envio = excluded.puesto_envio,
      prefijo_archivo = excluded.prefijo_archivo,
      sufijo_archivo = excluded.sufijo_archivo,
      no_establecimiento = excluded.no_establecimiento,
      meses_max_presenta_compras = excluded.meses_max_presenta_compras,
      registro_contador = excluded.registro_contador
    returning id into v_param;

    -- Personas que firman, por orden (se actualizan las de ese orden; las demás se conservan).
    for k in 1..3 loop
      v_nombre := nullif(trim(r->>('PERSONA_FIRMA' || k)), '');
      v_cargo := nullif(trim(r->>('CARGO' || k)), '');
      v_usuario := nullif(trim(r->>('USUARIO_' || k)), '');
      continue when v_nombre is null and v_cargo is null and v_usuario is null;
      insert into public.parametros_firmantes (parametros_id, orden, tipo, nombre, cargo, registro, perfil_id, usuario_anterior)
      values (v_param, k,
        case upper(coalesce(v_cargo, '')) when 'CONTADOR' then 'Contador general' when 'REPRESENTANTE LEGAL' then 'Representante legal' else 'Otro' end,
        upper(v_nombre), upper(v_cargo),
        case when upper(coalesce(v_cargo, '')) = 'CONTADOR' then nullif(trim(r->>'REGISTRO_CONTADOR'), '') end,
        (select p.id from public.perfiles p where v_usuario is not null and (upper(p.usuario_anterior) = upper(v_usuario) or upper(p.usuario) = upper(v_usuario)) order by (upper(p.usuario_anterior) = upper(v_usuario)) desc limit 1),
        v_usuario)
      on conflict (parametros_id, orden) do update set
        tipo = excluded.tipo, nombre = excluded.nombre, cargo = excluded.cargo, registro = excluded.registro,
        perfil_id = coalesce(excluded.perfil_id, public.parametros_firmantes.perfil_id), usuario_anterior = excluded.usuario_anterior;
      v_firmantes := v_firmantes + 1;
    end loop;
  end loop;

  raise notice '%', format('Parámetros generales de la organización 3: %s nuevos, %s actualizados; %s personas que firman.%s',
    v_nuevos, v_act, v_firmantes,
    case when v_omitidas <> '' then ' Localidades que no existen (omitidas):' || v_omitidas else '' end);
end;
$migra$;

notify pgrst, 'reload schema';
