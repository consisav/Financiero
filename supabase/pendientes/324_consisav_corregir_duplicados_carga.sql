-- Script 324 · corrección: quita las filas repetidas de las tablas de carga mig324_* (quedan así cuando una parte de datos, 1 a 30,
--   se ejecuta dos veces) y que hacen fallar las partes 31 a 37 con «duplicate key value violates unique constraint cuentas_catalogo_id_codigo_key».
--   Solo toca las tablas de carga (no las cuentas ni otros datos). Después vuelve a ejecutar la parte en que falló y las siguientes
--   (las partes 31 a 37 se pueden ejecutar de nuevo: actualizan). Es una sola instrucción; se puede ejecutar de nuevo.
--   Filas esperadas en mig324_cuentas después de corregir: 123856.
with
c  as (delete from public.mig324_cuentas    where ctid in (select ctid from (select ctid, row_number() over (partition by x::text order by ctid) rn from public.mig324_cuentas x) y    where rn > 1) returning 1),
s  as (delete from public.mig324_saldos     where ctid in (select ctid from (select ctid, row_number() over (partition by x::text order by ctid) rn from public.mig324_saldos x) y     where rn > 1) returning 1),
t  as (delete from public.mig324_trans      where ctid in (select ctid from (select ctid, row_number() over (partition by x::text order by ctid) rn from public.mig324_trans x) y      where rn > 1) returning 1),
p  as (delete from public.mig324_plantillas where ctid in (select ctid from (select ctid, row_number() over (partition by x::text order by ctid) rn from public.mig324_plantillas x) y where rn > 1) returning 1),
dp as (delete from public.mig324_detpl      where ctid in (select ctid from (select ctid, row_number() over (partition by x::text order by ctid) rn from public.mig324_detpl x) y      where rn > 1) returning 1),
r  as (delete from public.mig324_reportes   where ctid in (select ctid from (select ctid, row_number() over (partition by x::text order by ctid) rn from public.mig324_reportes x) y   where rn > 1) returning 1),
g  as (delete from public.mig324_grupos     where ctid in (select ctid from (select ctid, row_number() over (partition by x::text order by ctid) rn from public.mig324_grupos x) y     where rn > 1) returning 1),
dr as (delete from public.mig324_detrep     where ctid in (select ctid from (select ctid, row_number() over (partition by x::text order by ctid) rn from public.mig324_detrep x) y     where rn > 1) returning 1),
dd as (delete from public.mig324_datos      where ctid in (select ctid from (select ctid, row_number() over (partition by x::text order by ctid) rn from public.mig324_datos x) y      where rn > 1) returning 1)
select v.tabla, v.repetidas_quitadas, v.antes - v.repetidas_quitadas as filas_que_quedan
from (values
  ('mig324_cuentas',    (select count(*) from c),  (select count(*) from public.mig324_cuentas)),
  ('mig324_saldos',     (select count(*) from s),  (select count(*) from public.mig324_saldos)),
  ('mig324_trans',      (select count(*) from t),  (select count(*) from public.mig324_trans)),
  ('mig324_plantillas', (select count(*) from p),  (select count(*) from public.mig324_plantillas)),
  ('mig324_detpl',      (select count(*) from dp), (select count(*) from public.mig324_detpl)),
  ('mig324_reportes',   (select count(*) from r),  (select count(*) from public.mig324_reportes)),
  ('mig324_grupos',     (select count(*) from g),  (select count(*) from public.mig324_grupos)),
  ('mig324_detrep',     (select count(*) from dr), (select count(*) from public.mig324_detrep)),
  ('mig324_datos',      (select count(*) from dd), (select count(*) from public.mig324_datos))
) as v (tabla, repetidas_quitadas, antes);
