require('dotenv').config();
const path = require('path');
const express = require('express');
const { iniciarPool, conConexion, cerrarPool } = require('./db');
const recursos = require('./recursos');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/salud', async (_req, res) => {
  try {
    const r = await conConexion((c) =>
      c.execute(`SELECT SYS_CONTEXT('USERENV','CURRENT_SCHEMA') AS ESQUEMA, SYSDATE AS FECHA FROM DUAL`)
    );
    res.json({ ok: true, oracle: r.rows[0] });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

app.get('/api/recursos', (_req, res) => res.json(Object.keys(recursos)));
app.use('/api', require('./routes/crud'));

// Errores: ORA-00001 (duplicado) y ORA-02291/02292 (llave foránea) se devuelven como 409.
app.use((err, _req, res, _next) => {
  const conflicto = [1, 2291, 2292].includes(err.errorNum);
  const status = err.status || (conflicto ? 409 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Error interno' : err.message });
});

const PORT = Number(process.env.PORT || 3000);

// La interfaz se sirve aunque Oracle no esté disponible; /api/salud informa el estado.
iniciarPool().catch((e) => console.error('No se pudo conectar a Oracle:', e.message));

const server = app.listen(PORT, () => console.log(`Financiero escuchando en http://localhost:${PORT}`));
const salir = async () => {
  server.close();
  await cerrarPool();
  process.exit(0);
};
process.on('SIGINT', salir);
process.on('SIGTERM', salir);
