-- Script 248 · Organización 3 (Futura Farma - Mavisa), lote del 05-11-2026 al 17-11-2026: subcajas que faltan para los documentos de subcajas.
--   CON_MOVIMIENTOS_SUBCAJAS trae 110 documentos de 4 subcajas que no vienen en CON_SUBCAJAS (ni en el lote al 04-11-2026):
--   3-02 caja 1 subcaja 34 (13 documentos); 3-02 caja 1 subcaja 35 (46 documentos); 3-02 caja 4 subcaja 25 (32 documentos); 3-02 caja 5 subcaja 47 (19 documentos).
--   Por eso el script 237 parte 2 no pudo cargarlos. Este script crea esas subcajas ABIERTAS en su caja (que ya existe), con el año y mes de su primer
--   documento, el fondo de la caja y la marca creada_al_migrar (columna nueva); el concepto lo dice. Después hay que correr de nuevo el script 237
--   parte 2 (solo actualiza lo que ya está y agrega lo que falta). Si el sistema anterior trae después esas subcajas, se actualizan con sus datos.
--   Se puede ejecutar de nuevo: no duplica.
set lock_timeout = '20s';
alter table public.caja_periodos add column if not exists creada_al_migrar boolean not null default false;

do $sub$
declare v_org bigint; r record; v_loc bigint; v_caja bigint; v_n int := 0; v_ya int := 0; v_sin text := '';
begin
  select id into v_org from public.organizaciones where codigo::text = '3';
  if v_org is null then raise exception 'No existe la organización 3.'; end if;
  alter table public.caja_periodos disable trigger caja_periodos_preparar;
  for r in select * from (values
      (2::integer, 1::integer, 34::integer, 2026::integer, 11::integer, 'KER'::text, 13::integer),
      (2, 1, 35, 2026, 11, 'KER', 46),
      (2, 4, 25, 2026, 11, 'AEV', 32),
      (2, 5, 47, 2026, 11, 'AJA', 19)) as x(loc, caja, numero, anio, mes, usuario, documentos) loop
    select id into v_loc from public.localidades where organizacion_id = v_org and correlativo = r.loc;
    select id into v_caja from public.cajas_chicas where localidad_id = v_loc and codigo = r.caja;
    if v_caja is null then v_sin := v_sin || format(' 3-0%s caja %s;', r.loc, r.caja); continue; end if;
    if exists (select 1 from public.caja_periodos where caja_id = v_caja and numero = r.numero) then v_ya := v_ya + 1; continue; end if;
    insert into public.caja_periodos (caja_id, organizacion_id, localidad_id, numero, anio, mes, estado, tipo_cambio, valor, anticipo_valor, adelanto_valor, liquidacion_valor,
      usuario, origen_anterior, concepto, creada_al_migrar)
    values (v_caja, v_org, v_loc, r.numero, r.anio, r.mes, 'ABIERTA', 1, (select monto_fondo from public.cajas_chicas where id = v_caja), 0, 0, 0,
      upper(r.usuario), 'MIGRADO', format('SUBCAJA %s CREADA AL MIGRAR: NO VENÍA EN CON_SUBCAJAS (%s DOCUMENTOS EN EL LOTE DEL 05 AL 17-11-2026)', r.numero, r.documentos), true);
    v_n := v_n + 1;
  end loop;
  alter table public.caja_periodos enable trigger caja_periodos_preparar;
  raise notice '%', format('Subcajas creadas: %s; ya existían: %s.%s Ahora corre de nuevo el script 237 parte 2.', v_n, v_ya,
    case when v_sin <> '' then ' Cajas que no existen:' || v_sin else '' end);
end;
$sub$;
