-- Script 198 · revisar bloqueos: cierra las ejecuciones del script 198 que quedaron corriendo en la base después de que el
-- SQL Editor se cortó (siguen ocupando la tabla de compras y hacen que los siguientes intentos se queden esperando).
-- Solo cierra consultas del script 198 (las que empiezan con «-- Script 198»); no toca ninguna otra.
-- Se puede ejecutar las veces que haga falta.

-- 1) Cierra las ejecuciones del script 198 que siguen abiertas.
select pid, now() - query_start as tiempo, state as estado, pg_terminate_backend(pid) as cerrada
from pg_stat_activity
where datname = current_database() and pid <> pg_backend_pid()
  and (query ilike '%Script 198%' or query ilike '%create temp table m_c%' or query ilike '%alter table public.compras add column if not exists%');

-- 2) Lo que sigue usando la tabla de compras (debe salir vacío; si sale algo, cópialo y envíalo).
select a.pid, now() - a.query_start as tiempo, a.state as estado, l.mode as bloqueo, l.granted as concedido,
       left(regexp_replace(a.query, '\s+', ' ', 'g'), 150) as consulta
from pg_locks l join pg_stat_activity a on a.pid = l.pid
where l.relation = 'public.compras'::regclass and a.pid <> pg_backend_pid()
order by a.query_start;
