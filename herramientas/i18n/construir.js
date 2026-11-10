// Une los diccionarios web/i18n/*.json en web/js/i18n_en.js (window.I18N_EN), que carga js/idioma.js en inglés.
// Uso: node herramientas/i18n/construir.js
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '../../web/i18n');
const dic = {};
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) Object.assign(dic, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const limpio = Object.fromEntries(Object.entries(dic).filter(([k, v]) => typeof v === 'string' && v && k !== v));
fs.writeFileSync(path.join(dir, '../js/i18n_en.js'), `// Generado por herramientas/i18n/construir.js desde web/i18n/*.json: no editar a mano.\nwindow.I18N_EN = ${JSON.stringify(limpio)};\n`);
console.log('textos', Object.keys(limpio).length);
