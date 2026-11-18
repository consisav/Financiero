-- Script 270 · Organización 7 (AAPOS): subcaja que falta para 2 documentos de liquidación de caja chica (script 268).
--   CON_LIQUIDACION_CAJA_CHICA trae 2 documentos de la caja 3, subcaja 35 (depósito 88 por 4.11, reintegro; cheque 1011 por 2,000.00, liquidación),
--   pero CON_SUBCAJAS solo trae hasta la subcaja 34 de esa caja (ni CON_MOVIMIENTOS_SUBCAJAS ni CON_DETCON_CAJAS traen la 35).
--   Igual que el script 248: se crea la subcaja 35 ABIERTA en la caja 3 (que ya existe), con el año y mes de la exportación (2026-11), el fondo de la
--   caja y la marca creada_al_migrar; el concepto lo dice. Luego se ligan a ella los 2 documentos de liquidación.
--   Si el sistema anterior trae después esa subcaja, el script 254 la actualiza con sus datos. Se puede ejecutar de nuevo: no duplica.
set lock_timeout = '20s';
alter table public.caja_periodos add column if not exists creada_al_migrar boolean not null default false;

do $sub$
declare v_org bigint; v_loc bigint; v_caja bigint; v_per bigint; v_nueva boolean := false; v_lig int;
begin
  select id into v_org from public.organizaciones where codigo::text = '7';
  if v_org is null then raise exception 'No existe la organización 7.'; end if;
  select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = 1;
  select id into v_caja from public.cajas_chicas where localidad_id = v_loc and codigo = 3;
  if v_caja is null then raise exception 'No existe la caja 3 de la 7-01 (ejecuta antes el script 254).'; end if;
  select id into v_per from public.caja_periodos where caja_id = v_caja and numero = 35;
  if v_per is null then
    alter table public.caja_periodos disable trigger caja_periodos_preparar;
    insert into public.caja_periodos (caja_id, organizacion_id, localidad_id, numero, anio, mes, estado, tipo_cambio, valor, anticipo_valor, adelanto_valor, liquidacion_valor,
      origen_anterior, concepto, creada_al_migrar)
    values (v_caja, v_org, v_loc, 35, 2026, 11, 'ABIERTA', 1, (select monto_fondo from public.cajas_chicas where id = v_caja), 0, 0, 0,
      'MIGRADO', 'SUBCAJA 35 CREADA AL MIGRAR: NO VENÍA EN CON_SUBCAJAS (2 DOCUMENTOS EN CON_LIQUIDACION_CAJA_CHICA)', true)
    returning id into v_per;
    alter table public.caja_periodos enable trigger caja_periodos_preparar;
    v_nueva := true;
  end if;
  update public.caja_liquidacion_documentos set caja_id = v_caja, caja_periodo_id = v_per
  where localidad_id = v_loc and caja_anterior = 3 and subcaja_anterior = 35 and caja_periodo_id is distinct from v_per;
  get diagnostics v_lig = row_count;
  raise notice '%', format('Subcaja 7-01 caja 3 subcaja 35: %s. Documentos de liquidación ligados: %s.', case when v_nueva then 'creada' else 'ya existía' end, v_lig);
end;
$sub$;

select count(*) as liquidaciones_sin_subcaja_org_7
from public.caja_liquidacion_documentos d join public.organizaciones o on o.id = d.organizacion_id
where o.codigo::text = '7' and d.caja_periodo_id is null and d.subcaja_anterior <> 0;
