// Extrae los textos visibles en español de archivos JS/HTML del sistema Financiero.
// Uso: node herramientas/i18n/extraer.js <salida.json> <archivo>...   → { "texto": ["archivo", ...] } sin los ya traducidos
const fs = require('fs');
const path = require('path');
const [salida, ...archivos] = process.argv.slice(2);
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const ESP = /[áéíóúñ¿¡]|\b(de|del|la|el|los|las|con|para|que|por|en|un|una|sin|al|se|no|su|sus|es|y|o)\b/i;
function candidato(x) {
  x = norm(x.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
  x = x.replace(/^[\s·:|,;—–-]+|[\s·|,;—–-]+$/g, '');
  if (x.length < 2 || x.length > 400) return null;
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]{2}/.test(x)) return null;
  if (/^(ti|ti-[\w-]+)( |$)/.test(x)) return null;
  if (/^[a-z0-9_.\-/]+$/.test(x) && !ESP.test(x)) return null; // ids, clases, rutas
  if (/^[a-z_]+(, ?[a-z_*()!.:]+)+$/i.test(x)) return null; // listas de columnas
  if (!/s/.test(x) && /^[a-z0-9]+(-[a-z0-9]+)+$/.test(x)) return null; // ids con guiones
  if (/^[A-Z]+$/.test(x) && /^(CODE|PRE|INPUT|SCRIPT|STYLE|TEXTAREA|NOSCRIPT|NFD|NFC|GTQ|USD)$/.test(x)) return null;
  if (/^(https?:|mailto:|data:|#|\.|\[|\/)/.test(x)) return null;
  if (/[{}=]|=>|\bfunction\b|\bconst\b|\breturn\b|\$\(|document\.|window\./.test(x.replace(/\{\*\}/g, ''))) return null;
  if (/^[A-Z0-9_]+$/.test(x) && x.length > 1 && !/^[A-ZÁÉÍÓÚÑ]{3,}$/.test(x)) return null;
  if (/^(px|em|rem|%|\d)/.test(x) && !ESP.test(x)) return null;
  if (/^[a-z-]+:\s*[^ ]+;?$/.test(x)) return null; // css
  if (/^(select|insert|update|delete|order|eq|neq|in|is|like|ilike)$/i.test(x)) return null;
  // Debe parecer español: palabra con mayúscula inicial, acento o palabra frecuente.
  if (!(ESP.test(x) || /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/.test(x) || /^[A-ZÁÉÍÓÚÑ]{3,}/.test(x))) return null;
  if (/^[a-z]+[A-Z]\w*$/.test(x)) return null; // camelCase
  return x;
}
function trozos(lit) {
  // Reemplaza ${...} (con anidación) por {*}, luego parte por etiquetas HTML.
  let s = '', i = 0;
  while (i < lit.length) {
    if (lit[i] === '$' && lit[i + 1] === '{') {
      let d = 1, j = i + 2;
      while (j < lit.length && d) { if (lit[j] === '{') d++; else if (lit[j] === '}') d--; j++; }
      s += '\u0001'; i = j;
    } else s += lit[i++];
  }
  const out = [];
  // atributos visibles
  for (const m of s.matchAll(/\b(placeholder|title|aria-label|data-titulo)="([^"]*)"/g)) out.push(m[2]);
  const sinEtiquetas = s.replace(/<[^>]*>/g, '\u0002');
  for (const p of sinEtiquetas.split('\u0002')) out.push(p);
  return out.map((p) => p.replace(/\u0001/g, '{*}')).map((p) => p.replace(/^(\s*\{\*\}\s*)+|(\s*\{\*\}\s*)+$/g, (z) => z)).filter(Boolean);
}
function literales(src) {
  const r = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; if (i < 2) break; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') { s += src[j + 1] === 'n' ? '\n' : src[j + 1]; j += 2; continue; }
        if (c === '`' && src[j] === '$' && src[j + 1] === '{') {
          let d = 1, k = j + 2;
          while (k < src.length && d) {
            if (src[k] === '`') { // plantilla anidada
              let q = k + 1; while (q < src.length && src[q] !== '`') { if (src[q] === '\\') q++; q++; }
              r.push(src.slice(k + 1, q)); k = q + 1; continue;
            }
            if (src[k] === '\'' || src[k] === '"') { const qq = src[k]; let q = k + 1; while (q < src.length && src[q] !== qq) { if (src[q] === '\\') q++; q++; } r.push(src.slice(k + 1, q)); k = q + 1; continue; }
            if (src[k] === '{') d++; else if (src[k] === '}') d--; k++;
          }
          s += '${' + '}'; j = k; continue;
        }
        if (c !== '`' && src[j] === '\n') break;
        s += src[j++];
      }
      r.push(s); i = j + 1; continue;
    }
    // regex literal: saltar de forma simple
    if (c === '/' && /[=(,:!&|?{};\n]\s*$/.test(src.slice(Math.max(0, i - 3), i))) {
      let j = i + 1, clase = false;
      while (j < src.length && src[j] !== '\n') { if (src[j] === '\\') { j += 2; continue; } if (src[j] === '[') clase = true; else if (src[j] === ']') clase = false; else if (src[j] === '/' && !clase) break; j++; }
      i = j + 1; continue;
    }
    i++;
  }
  return r;
}
// Textos ya traducidos: los diccionarios web/i18n/*.json.
const dirDic = path.join(__dirname, '../../web/i18n');
const yaEn = {};
for (const f of fs.readdirSync(dirDic).filter((x) => x.endsWith('.json'))) Object.assign(yaEn, JSON.parse(fs.readFileSync(path.join(dirDic, f), 'utf8')));
const res = {};
for (const a of archivos) {
  let src = fs.readFileSync(a, 'utf8');
  let lits;
  if (a.endsWith('.html')) { src = src.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ''); lits = [src]; } else lits = literales(src);
  for (const l of lits) for (const t of trozos(l)) {
    // un «{*}» suelto separa textos independientes cuando hay mucho alrededor
    const c = candidato(t.replace(/\s*\{\*\}\s*/g, (z) => (z.trim() === z ? z : z.replace(/\s+/g, ' '))));
    if (!c || c === '{*}' || /^\{\*\}( \{\*\})*$/.test(c)) continue;
    if (yaEn[c] != null) continue;
    (res[c] = res[c] || new Set()).add(path.basename(a));
  }
}
const obj = {};
for (const k of Object.keys(res).sort()) obj[k] = [...res[k]];
fs.writeFileSync(salida, JSON.stringify(obj, null, 1));
console.log('textos', Object.keys(obj).length, 'palabras', Object.keys(obj).reduce((n, k) => n + k.split(' ').length, 0));
