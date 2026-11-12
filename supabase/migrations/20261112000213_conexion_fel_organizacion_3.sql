-- Script 213 · Organización 3 (Futura Farma y Mavisa): conexión del certificador desde CAR_DATOS_FEL.xls (6 filas: 3 tipos de conexión
--   por localidad: 1 CERTIFICACION, 2 ANULACION, 3 VALIDACION). Localidad 1 del sistema anterior = 3-01, localidad 2 = 3-02.
--   · transaccion = TRANSACCION (tipo 1); dato_certificar = IDENTIFICADOR (tipo 1); dato_anular = IDENTIFICADOR (tipo 2);
--     transaccion_consulta = TRANSACCION (tipo 3).
--   · Columnas nuevas en sat_fel_conexiones (vienen con datos y no estaban): dato_consulta (IDENTIFICADOR del tipo 3, VALIDACION) y
--     url_anterior (URL del sistema anterior: un servicio puente en el servidor local, http://localhost/ws_comunica_cofidi/...).
--     La URL del anterior NO se pone como url: «localhost» no se alcanza desde Supabase; la url del web service de COFIDI se llena al
--     tener su manual. Por eso la conexión queda inactiva.
--   · REQUESTOR, USUARIO y CONTRASEÑA no se migran (credenciales): van como secretos del servidor.
--   Se puede ejecutar de nuevo: actualiza solo los datos del sistema anterior y no toca url, ambiente ni activo si ya se llenaron.
alter table public.sat_fel_conexiones add column if not exists dato_consulta text;
alter table public.sat_fel_conexiones add column if not exists url_anterior text;
comment on column public.sat_fel_conexiones.dato_consulta is 'CAR_DATOS_FEL.IDENTIFICADOR del tipo de conexión 3 (VALIDACION).';
comment on column public.sat_fel_conexiones.url_anterior is 'CAR_DATOS_FEL.URL del sistema anterior (servicio puente local; no se usa para conectar).';

do $$
declare r record; v_n int := 0; v_a int := 0;
begin
  for r in select l.organizacion_id, l.id as localidad_id, v.*
             from (values ('3-01', 'http://localhost/ws_comunica_cofidi/Servicio.asmx?WSDL', 'SYSTEM_REQUEST', 'POST_DOCUMENT_SAT', 'VOID_DOCUMENT', 'LOOKUP_ISSUED_INTERNAL_ID', 'LOOKUP_ISSUED_INTERNAL_ID'),
                          ('3-02', 'http://localhost/ws_comunica_cofidi/Servicio.asmx?WSDL', 'SYSTEM_REQUEST', 'POST_DOCUMENT_SAT', 'VOID_DOCUMENT', 'LOOKUP_ISSUED_INTERNAL_ID', 'LOOKUP_ISSUED_INTERNAL_ID'))
                  as v(loc, url_ant, transaccion, certificar, anular, trans_consulta, dato_consulta)
             join public.localidades l on l.codigo = v.loc
             join public.organizaciones g on g.id = l.organizacion_id and g.codigo = '3' loop
    if exists (select 1 from public.sat_fel_conexiones c where c.localidad_id = r.localidad_id) then
      update public.sat_fel_conexiones set transaccion = r.transaccion, dato_certificar = r.certificar, dato_anular = r.anular,
             transaccion_consulta = r.trans_consulta, dato_consulta = r.dato_consulta, url_anterior = r.url_ant, modificado_en = now()
       where localidad_id = r.localidad_id;
      v_a := v_a + 1;
    else
      insert into public.sat_fel_conexiones (organizacion_id, localidad_id, ambiente, url, transaccion, dato_certificar, dato_anular, transaccion_consulta,
                                             dato_consulta, url_anterior, secreto, activo)
      values (r.organizacion_id, r.localidad_id, 'PRODUCCION', null, r.transaccion, r.certificar, r.anular, r.trans_consulta, r.dato_consulta, r.url_ant, 'COFIDI', false);
      v_n := v_n + 1;
    end if;
  end loop;
  raise notice 'Conexiones del certificador de la organización 3: % nuevas, % actualizadas.', v_n, v_a;
end $$;

notify pgrst, 'reload schema';

select l.codigo as empresa, c.ambiente, c.transaccion, c.dato_certificar, c.dato_anular, c.transaccion_consulta, c.dato_consulta, c.url_anterior, c.activo
  from public.sat_fel_conexiones c join public.localidades l on l.id = c.localidad_id order by l.codigo;
