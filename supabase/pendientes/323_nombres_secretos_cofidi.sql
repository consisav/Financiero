-- Script 323 · Solo consulta (no modifica nada). Nombre exacto de los 4 secretos de COFIDI que debe tener cada localidad/empresa
--   de cada organización en Supabase › Edge Functions › Secrets, independientes por ambiente:
--     <prefijo>_REQUESTOR_PRUEBAS_<empresa>     <prefijo>_USUARIO_PRUEBAS_<empresa>
--     <prefijo>_REQUESTOR_PRODUCCION_<empresa>  <prefijo>_USUARIO_PRODUCCION_<empresa>
--   <empresa> es el código de la localidad con el guion como _ (3-01 → 3_01). El prefijo es sat_fel_conexiones.secreto (COFIDI si está vacío).
--   La función fel-cofidi usa los del ambiente que tenga la conexión de la empresa en Integraciones SAT.
--   Lista todas las empresas; la columna conexion_fel indica si ya tiene conexión con el certificador.
select g.codigo as organizacion, l.codigo as empresa, l.nombre_comercial,
       case when c.localidad_id is null then 'SIN CONEXIÓN' else c.ambiente || case when c.activo then ' (activa)' else ' (inactiva)' end end as conexion_fel,
       p.pref || '_REQUESTOR_PRUEBAS_'    || replace(l.codigo, '-', '_') as requestor_pruebas,
       p.pref || '_USUARIO_PRUEBAS_'      || replace(l.codigo, '-', '_') as usuario_pruebas,
       p.pref || '_REQUESTOR_PRODUCCION_' || replace(l.codigo, '-', '_') as requestor_produccion,
       p.pref || '_USUARIO_PRODUCCION_'   || replace(l.codigo, '-', '_') as usuario_produccion
  from public.localidades l
  join public.organizaciones g on g.id = l.organizacion_id
  left join public.sat_fel_conexiones c on c.localidad_id = l.id
 cross join lateral (select coalesce(nullif(c.secreto, ''), 'COFIDI') as pref) p
 order by g.codigo, l.codigo;
