// Pool de conexiones a Oracle (node-oracledb en modo Thin: no requiere Instant Client).
const oracledb = require('oracledb');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];

const requeridas = ['ORACLE_USER', 'ORACLE_PASSWORD', 'ORACLE_CONNECT_STRING', 'ORACLE_SCHEMA'];

let pool;

async function iniciarPool() {
  const faltan = requeridas.filter((v) => !process.env[v]);
  if (faltan.length) {
    throw new Error(`Faltan variables en .env: ${faltan.join(', ')}`);
  }
  const esquema = process.env.ORACLE_SCHEMA.toUpperCase();
  if (!/^[A-Z][A-Z0-9_$#]{0,127}$/.test(esquema)) {
    throw new Error('ORACLE_SCHEMA no es un identificador válido');
  }
  pool = await oracledb.createPool({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
    poolMin: Number(process.env.ORACLE_POOL_MIN || 1),
    poolMax: Number(process.env.ORACLE_POOL_MAX || 5),
    // Cada sesión nueva trabaja sobre el esquema dueño, sin prefijar cada tabla.
    sessionCallback: (conn, _tag, cb) => {
      conn.execute(`ALTER SESSION SET CURRENT_SCHEMA = ${esquema}`).then(() => cb(), cb);
    },
  });
  return pool;
}

// Ejecuta fn(conn) con una conexión del pool y la libera siempre.
async function conConexion(fn) {
  const conn = await pool.getConnection();
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}

async function cerrarPool() {
  if (pool) await pool.close(10);
}

module.exports = { iniciarPool, conConexion, cerrarPool, oracledb };
