// Prueba de conexión + CRUD básico sobre TERCEROS. Uso: npm run test:db
require('dotenv').config();
const { iniciarPool, conConexion, cerrarPool } = require('../src/db');

(async () => {
  await iniciarPool();
  try {
    await conConexion(async (c) => {
      const info = await c.execute(
        `SELECT SYS_CONTEXT('USERENV','SESSION_USER') AS USUARIO,
                SYS_CONTEXT('USERENV','CURRENT_SCHEMA') AS ESQUEMA,
                SYS_CONTEXT('USERENV','CON_NAME') AS PDB FROM DUAL`
      );
      console.log('Conectado:', info.rows[0], '| Oracle', c.oracleServerVersionString);

      const ins = await c.execute(
        `INSERT INTO TERCEROS (TIPO, NIT, NOMBRE) VALUES ('C', 'CF', 'Prueba de conexión')
         RETURNING ID_TERCERO INTO :id`,
        { id: { dir: require('oracledb').BIND_OUT, type: require('oracledb').NUMBER } }
      );
      const id = ins.outBinds.id[0];
      console.log('INSERT  -> ID_TERCERO', id);

      await c.execute(`UPDATE TERCEROS SET EMAIL = 'prueba@consisav.com' WHERE ID_TERCERO = :id`, { id });
      const sel = await c.execute(`SELECT ID_TERCERO, NOMBRE, EMAIL FROM TERCEROS WHERE ID_TERCERO = :id`, { id });
      console.log('SELECT  ->', sel.rows[0]);

      const del = await c.execute(`DELETE FROM TERCEROS WHERE ID_TERCERO = :id`, { id });
      console.log('DELETE  ->', del.rowsAffected, 'fila');

      await c.commit();
    });
    console.log('OK: conexión y CRUD funcionan.');
  } finally {
    await cerrarPool();
  }
})().catch((e) => {
  console.error('FALLÓ:', e.message);
  process.exit(1);
});
