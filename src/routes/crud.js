// API CRUD genérica: /api/:recurso[/:id] sobre las tablas declaradas en recursos.js.
// Todo valor del usuario va como bind variable; nombres de tabla/columna solo salen de la lista blanca.
const express = require('express');
const { conConexion, oracledb } = require('../db');
const recursos = require('../recursos');

const router = express.Router();
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function recurso(req, res, next) {
  const r = recursos[req.params.recurso];
  if (!r) return res.status(404).json({ error: 'Recurso no existe' });
  req.r = r;
  next();
}

// Toma del body solo columnas permitidas; convierte 'YYYY-MM-DD' en Date.
function datos(r, body) {
  const out = {};
  for (const col of r.columnas) {
    const v = body[col] ?? body[col.toLowerCase()];
    if (v === undefined) continue;
    out[col] = typeof v === 'string' && FECHA.test(v) ? new Date(`${v}T00:00:00`) : v;
  }
  return out;
}

function id(req) {
  const n = Number(req.params.id);
  if (!Number.isInteger(n) || n <= 0) throw Object.assign(new Error('ID inválido'), { status: 400 });
  return n;
}

const listaCols = (r) => [r.pk, ...r.columnas, 'CREADO_EN'].join(', ');

router.get('/:recurso', recurso, async (req, res, next) => {
  try {
    const limite = Math.min(Number(req.query.limite) || 100, 1000);
    const filas = await conConexion((c) =>
      c.execute(
        `SELECT ${listaCols(req.r)} FROM ${req.r.tabla} ORDER BY ${req.r.pk} DESC FETCH FIRST :limite ROWS ONLY`,
        { limite }
      )
    );
    res.json(filas.rows);
  } catch (e) { next(e); }
});

router.get('/:recurso/:id', recurso, async (req, res, next) => {
  try {
    const r = await conConexion((c) =>
      c.execute(`SELECT ${listaCols(req.r)} FROM ${req.r.tabla} WHERE ${req.r.pk} = :id`, { id: id(req) })
    );
    if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

router.post('/:recurso', recurso, async (req, res, next) => {
  try {
    const d = datos(req.r, req.body || {});
    const cols = Object.keys(d);
    if (!cols.length) return res.status(400).json({ error: 'Sin datos' });
    const nuevoId = await conConexion(async (c) => {
      const r = await c.execute(
        `INSERT INTO ${req.r.tabla} (${cols.join(', ')}) VALUES (${cols.map((k) => ':' + k).join(', ')})
         RETURNING ${req.r.pk} INTO :nuevo_id`,
        { ...d, nuevo_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
        { autoCommit: true }
      );
      return r.outBinds.nuevo_id[0];
    });
    res.status(201).json({ [req.r.pk]: nuevoId });
  } catch (e) { next(e); }
});

router.put('/:recurso/:id', recurso, async (req, res, next) => {
  try {
    const d = datos(req.r, req.body || {});
    const cols = Object.keys(d);
    if (!cols.length) return res.status(400).json({ error: 'Sin datos' });
    const r = await conConexion((c) =>
      c.execute(
        `UPDATE ${req.r.tabla} SET ${cols.map((k) => `${k} = :${k}`).join(', ')} WHERE ${req.r.pk} = :pk_id`,
        { ...d, pk_id: id(req) },
        { autoCommit: true }
      )
    );
    if (!r.rowsAffected) return res.status(404).json({ error: 'No encontrado' });
    res.json({ actualizados: r.rowsAffected });
  } catch (e) { next(e); }
});

router.delete('/:recurso/:id', recurso, async (req, res, next) => {
  try {
    const r = await conConexion((c) =>
      c.execute(`DELETE FROM ${req.r.tabla} WHERE ${req.r.pk} = :id`, { id: id(req) }, { autoCommit: true })
    );
    if (!r.rowsAffected) return res.status(404).json({ error: 'No encontrado' });
    res.json({ eliminados: r.rowsAffected });
  } catch (e) { next(e); }
});

module.exports = router;
