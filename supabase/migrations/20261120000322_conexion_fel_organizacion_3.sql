-- Script 322 · Organización 3 (Futura Farma y Mavisa): actualización de la conexión del certificador desde los registros reales de
--   CAR_DATOS_FEL.xls (20-11-2026; 6 filas: 3 tipos de conexión por localidad: 1 CERTIFICACION, 2 ANULACION, 3 VALIDACION).
--   Mismo mapeo del script 213: localidad 1 del sistema anterior = 3-01, localidad 2 = 3-02; transaccion = TRANSACCION (tipo 1);
--   dato_certificar = IDENTIFICADOR (tipo 1); dato_anular = IDENTIFICADOR (tipo 2); transaccion_consulta = TRANSACCION (tipo 3);
--   dato_consulta = IDENTIFICADOR (tipo 3); url_anterior = URL del sistema anterior.
--   · Si la conexión de la empresa ya existe, se actualiza (no se tocan url, ambiente ni activo, que se llenan en Integraciones SAT); si no existe, se crea inactiva.
--   · REQUESTOR, USUARIO y CONTRASEÑA NO se migran (credenciales): van como secretos de la función fel-cofidi. Van por empresa y ambiente
--     (PRUEBAS y PRODUCCION), p. ej. COFIDI_REQUESTOR_PRUEBAS_3_01. Nombres exactos de todas las empresas: script 323.
--   Se puede ejecutar de nuevo: actualiza.
alter table public.sat_fel_conexiones add column if not exists dato_consulta text;
alter table public.sat_fel_conexiones add column if not exists url_anterior text;

do $$
declare r record; v_n int := 0; v_a int := 0;
begin
  for r in select l.organizacion_id, l.id as localidad_id, v.*
             from (values (1, 'http://localhost/ws_comunica_cofidi/Servicio.asmx?WSDL', 'SYSTEM_REQUEST', 'POST_DOCUMENT_SAT', 'VOID_DOCUMENT', 'LOOKUP_ISSUED_INTERNAL_ID', 'LOOKUP_ISSUED_INTERNAL_ID'),
                          (2, 'http://localhost/ws_comunica_cofidi/Servicio.asmx?WSDL', 'SYSTEM_REQUEST', 'POST_DOCUMENT_SAT', 'VOID_DOCUMENT', 'LOOKUP_ISSUED_INTERNAL_ID', 'LOOKUP_ISSUED_INTERNAL_ID'))
                  as v(loc, url_ant, transaccion, certificar, anular, trans_consulta, dato_consulta)
             join public.organizaciones g on g.codigo::text = '3'
             join public.localidades l on l.organizacion_id = g.id and l.correlativo = v.loc loop
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
  if v_n + v_a = 0 then raise exception 'No existen las empresas 3-01 y 3-02 de la organización 3.'; end if;
  raise notice 'Conexiones del certificador de la organización 3: % nuevas, % actualizadas.', v_n, v_a;
end $$;

notify pgrst, 'reload schema';

-- Conexiones y nombre de los secretos que debe tener cada empresa en Edge Functions › Secrets (los valores salen de CAR_DATOS_FEL: REQUESTOR y USUARIO de esa empresa).
select l.codigo as empresa, c.ambiente, c.activo, c.url, c.transaccion, c.dato_certificar, c.dato_anular, c.transaccion_consulta, c.dato_consulta,
       coalesce(nullif(c.secreto, ''), 'COFIDI') || '_REQUESTOR_' || c.ambiente || '_' || replace(l.codigo, '-', '_') as secreto_requestor,
       coalesce(nullif(c.secreto, ''), 'COFIDI') || '_USUARIO_' || c.ambiente || '_' || replace(l.codigo, '-', '_') as secreto_usuario
  from public.sat_fel_conexiones c
  join public.localidades l on l.id = c.localidad_id
  join public.organizaciones g on g.id = l.organizacion_id and g.codigo::text = '3'
 order by l.codigo;
