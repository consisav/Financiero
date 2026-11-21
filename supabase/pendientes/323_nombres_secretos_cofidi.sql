-- Script 323 · Solo consulta (no modifica nada). Nombre exacto de los secretos de COFIDI que debe tener cada organización en
--   Supabase › Edge Functions › Secrets, uno por ambiente (PRUEBAS y PRODUCCION), independientes entre sí.
--   · Por organización (obligatorio): <prefijo>_REQUESTOR_<AMBIENTE>_ORG<código> y <prefijo>_USUARIO_<AMBIENTE>_ORG<código>.
--   · Por empresa (opcional, solo si esa empresa tiene REQUESTOR o USUARIO distintos al de su organización):
--     <prefijo>_REQUESTOR_<AMBIENTE>_<empresa> (el guion de la empresa va como _, p. ej. 3_02). Si existe, tiene prioridad.
--   El prefijo es sat_fel_conexiones.secreto (COFIDI si está vacío). La función fel-cofidi usa el ambiente que tenga la conexión.
select g.codigo as organizacion, l.codigo as empresa, l.nombre_comercial, c.ambiente as ambiente_actual, c.activo,
       a.ambiente,
       coalesce(nullif(c.secreto, ''), 'COFIDI') || '_REQUESTOR_' || a.ambiente || '_ORG' || g.codigo as secreto_requestor_organizacion,
       coalesce(nullif(c.secreto, ''), 'COFIDI') || '_USUARIO_'   || a.ambiente || '_ORG' || g.codigo as secreto_usuario_organizacion,
       coalesce(nullif(c.secreto, ''), 'COFIDI') || '_REQUESTOR_' || a.ambiente || '_' || replace(l.codigo, '-', '_') as secreto_requestor_empresa_opcional,
       coalesce(nullif(c.secreto, ''), 'COFIDI') || '_USUARIO_'   || a.ambiente || '_' || replace(l.codigo, '-', '_') as secreto_usuario_empresa_opcional
  from public.sat_fel_conexiones c
  join public.localidades l on l.id = c.localidad_id
  join public.organizaciones g on g.id = l.organizacion_id
 cross join (values ('PRUEBAS'), ('PRODUCCION')) as a(ambiente)
 order by g.codigo, l.codigo, a.ambiente desc;
