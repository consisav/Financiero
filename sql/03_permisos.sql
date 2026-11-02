-- =====================================================================
-- 03_permisos.sql  -  Ejecutar como FIN_OWNER, después de 02_esquema.sql
-- (y de nuevo cada vez que se agreguen tablas o secuencias)
--
-- Da al rol FIN_APP_ROLE solo DML sobre las tablas y SELECT sobre las
-- secuencias (necesario para los DEFAULT ...NEXTVAL al insertar).
-- =====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE

BEGIN
  FOR t IN (SELECT table_name FROM user_tables) LOOP
    EXECUTE IMMEDIATE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ' || t.table_name || ' TO FIN_APP_ROLE';
  END LOOP;
  FOR s IN (SELECT sequence_name FROM user_sequences) LOOP
    EXECUTE IMMEDIATE 'GRANT SELECT ON ' || s.sequence_name || ' TO FIN_APP_ROLE';
  END LOOP;
END;
/

PROMPT Permisos otorgados a FIN_APP_ROLE.
