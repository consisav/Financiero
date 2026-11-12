-- Diagnóstico de bloqueos: muestra qué conexiones tienen tomada (o esperan) una tabla.
-- Úselo cuando un script falle con "lock timeout" o "tiempo de espera de la conexión".
-- Cambie 'centros_costo' por la tabla que indique el error. No modifica nada.
select a.pid,
       l.mode                                   as tipo_bloqueo,
       case when l.granted then 'LA TIENE' else 'ESPERANDO' end as situacion,
       a.state                                  as estado,
       date_trunc('second', now() - a.xact_start) as tiempo_abierta,
       a.application_name                       as aplicacion,
       pg_blocking_pids(a.pid)                  as bloqueada_por,
       left(regexp_replace(a.query, '\s+', ' ', 'g'), 150) as consulta
from pg_locks l
join pg_stat_activity a on a.pid = l.pid
where l.relation = 'public.centros_costo'::regclass
  and a.pid <> pg_backend_pid()
order by l.granted desc, a.xact_start;
