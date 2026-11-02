-- =====================================================================
-- 01_usuarios.sql  -  Ejecutar como DBA (SYSTEM o SYS) CONECTADO A LA PDB
--   sqlplus system@//localhost:1521/ORCLPDB @sql/01_usuarios.sql
--
-- Crea:
--   FIN_OWNER     dueño de las tablas de Financiero (solo para correr scripts)
--   FIN_APP_ROLE  rol con SELECT/INSERT/UPDATE/DELETE sobre esas tablas
--   FIN_APP       usuario con el que se conecta la aplicación (mínimo privilegio)
--
-- No toca ningún esquema ni tabla existente (contabilidad / inventarios).
-- =====================================================================
SET VERIFY OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE

PROMPT Verificando que estamos en una PDB (no en CDB$ROOT)...
DECLARE
  v_con VARCHAR2(128) := SYS_CONTEXT('USERENV', 'CON_NAME');
BEGIN
  IF v_con = 'CDB$ROOT' THEN
    RAISE_APPLICATION_ERROR(-20001, 'Conéctese a la PDB (ej. ORCLPDB), no a CDB$ROOT');
  END IF;
END;
/

ACCEPT pwd_owner CHAR PROMPT 'Contraseña para FIN_OWNER: ' HIDE
ACCEPT pwd_app   CHAR PROMPT 'Contraseña para FIN_APP:   ' HIDE

-- Dueño del esquema
CREATE USER FIN_OWNER IDENTIFIED BY "&pwd_owner"
  DEFAULT TABLESPACE USERS
  TEMPORARY TABLESPACE TEMP
  QUOTA 1G ON USERS;

GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE, CREATE VIEW,
      CREATE PROCEDURE, CREATE TRIGGER TO FIN_OWNER;

-- Rol para la aplicación (los GRANT de objetos los da FIN_OWNER en 03_permisos.sql)
CREATE ROLE FIN_APP_ROLE;
GRANT FIN_APP_ROLE TO FIN_OWNER WITH ADMIN OPTION;

-- Usuario de la aplicación: solo puede conectarse y usar el rol
CREATE USER FIN_APP IDENTIFIED BY "&pwd_app"
  DEFAULT TABLESPACE USERS
  TEMPORARY TABLESPACE TEMP
  QUOTA 0 ON USERS;

GRANT CREATE SESSION TO FIN_APP;
GRANT FIN_APP_ROLE TO FIN_APP;
ALTER USER FIN_APP DEFAULT ROLE FIN_APP_ROLE;

UNDEFINE pwd_owner
UNDEFINE pwd_app

PROMPT Usuarios FIN_OWNER y FIN_APP creados.
