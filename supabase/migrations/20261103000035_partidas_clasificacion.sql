-- Partidas contables: clasificación de la partida (como en Administración de pólizas):
-- PARTIDA DEL MES (por defecto), DE APERTURA, DE AJUSTE o DE CIERRE.
-- Requiere el script 34. Puede ejecutarse de nuevo.

alter table public.partidas add column if not exists clasificacion text not null default 'PARTIDA DEL MES';
alter table public.partidas drop constraint if exists partidas_clasificacion_check;
alter table public.partidas add constraint partidas_clasificacion_check
  check (clasificacion in ('PARTIDA DEL MES', 'PARTIDA DE APERTURA', 'PARTIDA DE AJUSTE', 'PARTIDA DE CIERRE'));

notify pgrst, 'reload schema';
