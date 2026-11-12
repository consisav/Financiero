-- Pausa el backup automático (trabajo de pg_cron «financiero-backup-programado») mientras se corren las migraciones,
--   y cancela el backup que esté corriendo en este momento, para liberar las tablas.
--   El backup genera el respaldo de toda la base en una sola transacción y mantiene tomadas todas las tablas mientras dura;
--   con los datos migrados tarda varios minutos y no deja que los scripts agreguen columnas (lock timeout).
--   Para reactivarlo al terminar las migraciones, corra el bloque «Reactivar» del final.

-- 1) Pausar el trabajo (no lo borra; queda con su horario).
select cron.alter_job(jobid, active := false) from cron.job where jobname = 'financiero-backup-programado';

-- 2) Cancelar el backup que esté corriendo ahora (lo que hacía se deshace; no afecta datos).
select pid, pg_terminate_backend(pid) as cancelado, left(query, 80) as consulta
from pg_stat_activity
where query ilike '%ejecutar_backup_programado%' and pid <> pg_backend_pid();

-- 3) Estado: el trabajo debe quedar inactivo; abajo, las últimas ejecuciones y cuánto tardaron.
select j.jobname, j.schedule, j.active from cron.job j where j.jobname = 'financiero-backup-programado';
select d.status, d.start_time at time zone 'America/Guatemala' as inicio,
       date_trunc('second', d.end_time - d.start_time) as duracion, left(d.return_message, 120) as mensaje
from cron.job_run_details d join cron.job j on j.jobid = d.jobid
where j.jobname = 'financiero-backup-programado'
  and (d.status <> 'succeeded' or d.end_time is null or d.end_time - d.start_time > interval '5 seconds')
order by d.start_time desc limit 10;

-- Reactivar (cuando terminen las migraciones):
-- select cron.alter_job(jobid, active := true) from cron.job where jobname = 'financiero-backup-programado';
