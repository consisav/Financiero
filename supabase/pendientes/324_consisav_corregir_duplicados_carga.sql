-- Script 324 · corrección: quita las filas repetidas de las tablas de carga mig324_* (quedan así cuando una parte de datos, 1 a 30,
--   se ejecuta dos veces) y que hacen fallar las partes 31 a 37 con «duplicate key value violates unique constraint cuentas_catalogo_id_codigo_key».
--   Solo toca las tablas de carga (no las cuentas ni otros datos). Después vuelve a ejecutar la parte en que falló y las siguientes
--   (las partes 31 a 37 se pueden ejecutar de nuevo: actualizan). Se puede ejecutar de nuevo.
create temp table t324_corr (tabla text, repetidas_quitadas int, filas_que_quedan bigint);
do $$
declare t text; v_n int; v_q bigint;
begin
  foreach t in array array['mig324_cuentas', 'mig324_saldos', 'mig324_trans', 'mig324_plantillas', 'mig324_detpl', 'mig324_reportes', 'mig324_grupos',
                           'mig324_detrep', 'mig324_datos'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('delete from public.%I where ctid in (select ctid from (select ctid, row_number() over (partition by x::text order by ctid) as rn from public.%I x) y where rn > 1)', t, t);
    get diagnostics v_n = row_count;
    execute format('select count(*) from public.%I', t) into v_q;
    insert into t324_corr values (t, v_n, v_q);
  end loop;
end;
$$;
-- Filas esperadas: mig324_cuentas 123856 (en las tablas de carga, sin repetir).
select * from t324_corr;
drop table t324_corr;
