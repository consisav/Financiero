-- Script 198 · revisar bloqueos: cierra las ejecuciones de los scripts 198, 199 y 200 que quedaron corriendo en la base después
-- de que el SQL Editor se cortó (siguen ocupando las tablas de compras y hacen que los siguientes intentos se queden esperando).
-- Solo cierra consultas en curso de esos scripts; no toca ninguna otra. Se puede ejecutar las veces que haga falta.

-- 1) Cierra las ejecuciones en curso de los scripts 198, 199 y 200.
select pid, now() - query_start as tiempo, state as estado, pg_terminate_backend(pid) as cerrada
from pg_stat_activity
where datname = current_database() and pid <> pg_backend_pid() and state <> 'idle'
  and (query ilike '%Script 198 %' or query ilike '%Script 199 %' or query ilike '%Script 200 %');

-- 2) Lo que sigue usando las tablas de compras (debe salir vacío; si sale algo, cópialo y envíalo).
select a.pid, now() - a.query_start as tiempo, a.state as estado, l.relation::regclass as tabla, l.mode as bloqueo, l.granted as concedido,
       left(regexp_replace(a.query, '\s+', ' ', 'g'), 150) as consulta
from pg_locks l join pg_stat_activity a on a.pid = l.pid
where l.relation in ('public.compras'::regclass, 'public.compra_items'::regclass, 'public.compra_lineas'::regclass) and a.pid <> pg_backend_pid()
order by a.query_start;
