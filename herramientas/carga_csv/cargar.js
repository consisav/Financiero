// Carga un script de migración con archivos CSV (328, 329 o 330) directo a la base de Supabase:
//   1) ejecuta la parte 0, 2) copia cada CSV de la carpeta NNN_csv a su tabla de carga (COPY), 3) ejecuta las partes 1 en adelante en orden.
// Muestra el resultado de cada parte. Se detiene en el primer error. Se puede ejecutar de nuevo (los scripts actualizan, no duplican).
//
// Uso (PowerShell), desde esta carpeta:
//   $env:SUPABASE_DB_URL = "postgresql://..."      ← la cadena de Supabase › Connect › Session pooler, con la contraseña de la base
//   node cargar.js 328
// La cadena de conexión NO se guarda en ningún archivo ni se muestra.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { from: copyFrom } = require('pg-copy-streams');

const PEND = path.resolve(__dirname, '../../supabase/pendientes');
const TABLAS = {
  328: { 1: 'mig328_proveedores', 2: 'mig328_compras', 3: 'mig328_detalle', 4: 'mig328_movimientos' },
  329: { 1: 'mig329_ventas', 2: 'mig329_documentos', 3: 'mig329_contable' },
  330: { 1: 'mig330_archivos', 2: 'mig330_lineas' },
};

(async () => {
  const num = process.argv[2];
  if (!TABLAS[num]) { console.log('Uso: node cargar.js 328 | 329 | 330'); process.exit(1); }
  const url = process.env.SUPABASE_DB_URL;
  if (!url) { console.log('Falta la variable SUPABASE_DB_URL (ver instrucciones al inicio de este archivo).'); process.exit(1); }
  const n = (f) => Number(f.match(/_parte_(\d+)_de_/)[1]);
  const partes = fs.readdirSync(PEND).filter((f) => f.startsWith(num + '_') && f.endsWith('.sql') && /_parte_\d+_de_/.test(f)).sort((a, b) => n(a) - n(b));
  const csvDir = path.join(PEND, num + '_csv');
  if (!partes.length || n(partes[0]) !== 0) { console.log('No encuentro la parte 0 del script ' + num + ' en ' + PEND); process.exit(1); }
  if (!fs.existsSync(csvDir)) { console.log('No encuentro la carpeta ' + csvDir); process.exit(1); }
  const csvs = fs.readdirSync(csvDir).filter((f) => f.endsWith('.csv')).sort();

  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 0 });
  await db.connect();
  const mostrar = (r) => { for (const x of [].concat(r)) if (x && x.rows && x.rows.length) console.log('   ', JSON.stringify(x.rows).slice(0, 3000)); };
  const correr = async (f) => {
    const t0 = Date.now();
    try { const r = await db.query(fs.readFileSync(path.join(PEND, f), 'utf8')); console.log(`OK ${f} (${Math.round((Date.now() - t0) / 1000)} s)`); mostrar(r); }
    catch (e) { console.log(`ERROR en ${f}: ${e.message}${e.detail ? ' · ' + e.detail : ''}${e.where ? ' · ' + e.where : ''}`); await db.end(); process.exit(1); }
  };

  console.log(`Script ${num}: ${partes.length} partes y ${csvs.length} archivos CSV.`);
  await correr(partes[0]);
  for (const t of Object.values(TABLAS[num])) await db.query(`truncate public.${t}`); // tablas de carga vacías antes de copiar
  for (const f of csvs) {
    const tabla = TABLAS[num][f.split('_')[1]];
    if (!tabla) { console.log('No sé a qué tabla va ' + f); process.exit(1); }
    const cols = fs.readFileSync(path.join(csvDir, f), 'utf8').split('\n', 1)[0].trim();
    const t0 = Date.now();
    await new Promise((ok, mal) => {
      const s = db.query(copyFrom(`copy public.${tabla} (${cols}) from stdin with (format csv, header true)`));
      const r = fs.createReadStream(path.join(csvDir, f));
      r.on('error', mal); s.on('error', mal); s.on('finish', ok);
      r.pipe(s);
    }).catch(async (e) => { console.log(`ERROR al copiar ${f}: ${e.message}`); await db.end(); process.exit(1); });
    console.log(`CSV ${f} → ${tabla} (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  for (const f of partes.slice(1)) await correr(f);
  await db.end();
  console.log(`Script ${num} terminado.`);
})().catch((e) => { console.log('ERROR: ' + e.message); process.exit(1); });
