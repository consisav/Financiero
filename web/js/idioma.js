// Idioma del sistema: Español (bandera de Guatemala) o English (bandera de Estados Unidos).
// El sistema está escrito en español; en inglés, esta capa reemplaza en pantalla cada texto, atributo
// (placeholder, title, aria-label) y mensaje (confirm/alert) con su traducción del diccionario
// js/i18n_en.js. Los datos que registran los usuarios (nombres, descripciones) no están en el diccionario
// y se quedan como se escribieron. Los textos con partes variables usan plantillas con {*}
// («{*} usuarios», «Se envió a {*} el enlace…»). La preferencia se guarda en el navegador; al cambiarla
// se recarga la página.
(function () {
  const CLAVE = 'fin-idioma';
  let idioma = 'es';
  try { idioma = localStorage.getItem(CLAVE) === 'en' ? 'en' : 'es'; } catch { /* sin almacenamiento */ }
  const en = idioma === 'en';
  document.documentElement.lang = idioma;
  // El traductor del navegador (Edge, Chrome) no debe traducir encima de esta capa: los dos se peleaban el
  // mismo texto sin fin y la página dejaba de responder.
  document.documentElement.setAttribute('translate', 'no');
  document.documentElement.classList.add('notranslate');
  // El diccionario solo se descarga en inglés (este archivo se carga en <head>, antes del resto).
  // Misma carpeta y versión que este archivo («js/idioma.js?v=…» → «js/i18n_en.js?v=…»).
  if (en) document.write(`<script src="${(document.currentScript?.src || 'js/idioma.js').replace(/idioma\.js/, 'i18n_en.js')}"><\/script>`);

  const BANDERA_GT = '<svg viewBox="0 0 3 2" width="22" height="15" aria-hidden="true"><rect width="1" height="2" fill="#4997D0"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#4997D0"/><circle cx="1.5" cy="1" r=".2" fill="#6C9A3B"/></svg>';
  const BANDERA_US = '<svg viewBox="0 0 19 10" width="22" height="15" aria-hidden="true"><rect width="19" height="10" fill="#B22234"/><g fill="#fff"><rect y=".77" width="19" height=".77"/><rect y="2.31" width="19" height=".77"/><rect y="3.85" width="19" height=".77"/><rect y="5.39" width="19" height=".77"/><rect y="6.93" width="19" height=".77"/><rect y="8.47" width="19" height=".77"/></g><rect width="7.6" height="5.39" fill="#3C3B6E"/></svg>';
  const selector = () => `<div class="idiomas notranslate" role="group" aria-label="Idioma / Language">
      <button type="button" data-idioma="es" class="${en ? '' : 'actual'}" aria-pressed="${!en}" title="Ver el sistema en español">${BANDERA_GT}<span>Español</span></button>
      <button type="button" data-idioma="en" class="${en ? 'actual' : ''}" aria-pressed="${en}" title="View the system in English">${BANDERA_US}<span>English</span></button>
    </div>`;
  function cambiar(nuevo) {
    if (nuevo === idioma) return;
    try { localStorage.setItem(CLAVE, nuevo); } catch { /* sin almacenamiento */ }
    location.reload();
  }

  // ---------- Traducción ----------
  const dic = () => window.I18N_EN || {};
  const tiene = (d, k) => Object.prototype.hasOwnProperty.call(d, k);
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const DIAS = { lunes: 'Monday', martes: 'Tuesday', 'miércoles': 'Wednesday', jueves: 'Thursday', viernes: 'Friday', 'sábado': 'Saturday', domingo: 'Sunday' };
  const MESES = { enero: 'January', febrero: 'February', marzo: 'March', abril: 'April', mayo: 'May', junio: 'June', julio: 'July', agosto: 'August', septiembre: 'September', setiembre: 'September', octubre: 'October', noviembre: 'November', diciembre: 'December' };
  function fecha(k) {
    // «Martes, 10 de noviembre de 2026» · «10 de noviembre de 2026» · «noviembre 2026»
    let m = k.match(/^(?:([A-Za-zÁÉÍÓÚáéíóú]+),\s*)?(\d{1,2}) de ([a-záéíóú]+) de (\d{4})$/i);
    if (m && MESES[m[3].toLowerCase()]) {
      const d = m[1] ? DIAS[m[1].toLowerCase()] : null;
      if (m[1] && !d) return null;
      return `${d ? `${d}, ` : ''}${MESES[m[3].toLowerCase()]} ${m[2]}, ${m[4]}`;
    }
    m = k.match(/^([a-záéíóú]+)(?: de)? (\d{4})$/i);
    if (m && MESES[m[1].toLowerCase()]) return `${MESES[m[1].toLowerCase()]} ${m[2]}`;
    return null;
  }

  // Plantillas con partes variables «{*}»: se indexan por su primera palabra fija (o la última, si empiezan con
  // «{*}») para no probarlas todas en cada texto.
  let indice = null;
  const escRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`);
  function prepararIndice() {
    indice = { ini: new Map(), fin: new Map() };
    for (const [k, v] of Object.entries(dic())) {
      if (!k.includes('{*}')) continue;
      const partes = k.split('{*}');
      const ini = partes[0].trim(), fin = partes[partes.length - 1].trim();
      if (!ini && !fin) continue;
      const x = { re: new RegExp(`^${partes.map(escRe).join('(.+?)')}$`), v, fijo: partes.join('').length };
      const mapa = ini ? indice.ini : indice.fin;
      const w = ini ? ini.split(' ')[0] : fin.split(' ').pop();
      if (!mapa.has(w)) mapa.set(w, []);
      mapa.get(w).push(x);
    }
    // La plantilla con más texto fijo (la más específica) se prueba primero.
    for (const m of [indice.ini, indice.fin]) for (const l of m.values()) l.sort((a, b) => b.fijo - a.fijo);
  }
  function plantilla(k) {
    if (!indice) prepararIndice();
    const cand = [...(indice.ini.get(k.split(' ')[0]) || []), ...(indice.fin.get(k.split(' ').pop()) || [])].sort((a, b) => b.fijo - a.fijo);
    for (const { re, v } of cand) {
      const m = k.match(re);
      if (!m) continue;
      let i = 1;
      return v.replace(/\{\*\}/g, () => { const x = m[i++] ?? ''; const t = traducir(x); return t ?? x; });
    }
    return null;
  }
  const memo = new Map();
  function traducir(texto) {
    const k = norm(String(texto ?? ''));
    if (!k || !/[A-Za-zÁÉÍÓÚáéíóúÑñ]{2}/.test(k)) return null;
    if (memo.has(k)) return memo.get(k);
    const r = buscar(k);
    if (memo.size > 20000) memo.clear();
    memo.set(k, r);
    return r;
  }
  function buscar(k) {
    const d = dic();
    if (tiene(d, k)) return d[k];
    // Puntuación final («Nombre:», «Organización *», «Guardando…»).
    let m = k.match(/^(.*?)(\s*[:*.…?!]+)$/);
    if (m && tiene(d, m[1])) return d[m[1]] + m[2];
    // Fechas largas.
    if (/\d/.test(k)) { const f = fecha(k); if (f) return f; }
    // Partes separadas por «·» («Panel · Administración»), cada una por su lado.
    if (k.includes(' · ')) {
      const partes = k.split(' · ');
      const tr = partes.map((p) => traducir(p));
      if (tr.some((x) => x != null)) return partes.map((p, i) => tr[i] ?? p).join(' · ');
    }
    return plantilla(k);
  }
  const conEspacios = (orig, nuevo) => orig.match(/^\s*/)[0] + nuevo + orig.match(/\s*$/)[0];

  const SALTAR = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT', 'svg']);
  const ATRIBUTOS = ['placeholder', 'title', 'aria-label', 'data-titulo'];
  const hechos = new WeakSet();
  // Freno contra ciclos: el texto que puso esta capa no se vuelve a procesar, y un nodo que otro programa
  // cambia una y otra vez se deja de traducir después de unas cuantas veces.
  const puesto = new WeakMap(), veces = new WeakMap();
  const MAX_VECES = 4;
  const excluido = (e) => SALTAR.has(e.tagName) || e.isContentEditable || e.classList?.contains('notranslate') || e.hasAttribute?.('data-no-traducir');
  function saltar(el) {
    for (let e = el; e && e !== document.body; e = e.parentElement) if (excluido(e)) return true;
    return false;
  }
  function textoNodo(n, revisar = true) {
    if (hechos.has(n) || !n.nodeValue || !n.parentElement || (revisar && saltar(n.parentElement))) return;
    if (puesto.get(n) === n.nodeValue) return;
    const k = (veces.get(n) || 0) + 1;
    if (k > MAX_VECES) return;
    const t = traducir(n.nodeValue);
    if (t != null && t !== norm(n.nodeValue)) {
      veces.set(n, k);
      hechos.add(n);
      n.nodeValue = conEspacios(n.nodeValue, t);
      puesto.set(n, n.nodeValue);
    }
  }
  function atributos(el, revisar = true) {
    if (revisar && saltar(el)) return;
    for (const a of ATRIBUTOS) {
      const v = el.getAttribute(a);
      if (!v || el[`_tr_${a}`] === v) continue;
      const t = traducir(v);
      if (t != null) { el[`_tr_${a}`] = t; el.setAttribute(a, t); }
    }
    if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && el.value) { const t = traducir(el.value); if (t != null) el.value = t; }
  }
  function recorrer(raiz) {
    if (raiz.nodeType === 3) return textoNodo(raiz);
    if (raiz.nodeType !== 1 || saltar(raiz)) return;
    atributos(raiz, false);
    // Los elementos que no se traducen se saltan con todo su contenido.
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeType === 1 && excluido(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) textoNodo(n, false); else atributos(n, false); }
  }
  function iniciar() {
    recorrer(document.body);
    if (document.title) { const t = traducir(document.title); if (t) document.title = t; }
    new MutationObserver((cambios) => {
      for (const c of cambios) {
        if (c.type === 'childList') c.addedNodes.forEach(recorrer);
        else if (c.type === 'characterData') { if (puesto.get(c.target) === c.target.nodeValue) continue; hechos.delete(c.target); textoNodo(c.target); }
        else if (c.type === 'attributes') atributos(c.target);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
  }

  // Mensajes del navegador (confirmaciones y alertas): cada línea por separado.
  // Primero el mensaje completo (el diccionario guarda los mensajes de varias líneas unidos); si no, línea por línea.
  const lineas = (s) => traducir(s) ?? String(s ?? '').split('\n').map((l) => { const t = traducir(l); return t != null ? conEspacios(l, t) : l; }).join('\n');
  if (en) {
    const c = window.confirm.bind(window), a = window.alert.bind(window), p = window.prompt.bind(window);
    window.confirm = (s) => c(lineas(s));
    window.alert = (s) => a(lineas(s));
    window.prompt = (s, v) => p(lineas(s), v);
    // Lectura en voz (reportes gerenciales, asistente): se traduce el texto y se lee con una voz en inglés.
    if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
      const hablar = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = (u) => {
        try {
          const t = lineas(u.text);
          if (t) u.text = t;
          u.lang = 'en-US';
          const voz = speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang));
          u.voice = voz || null;
        } catch { /* se lee como venga */ }
        return hablar(u);
      };
    }
  }

  // Botones de idioma: arriba del inicio de sesión y en la barra superior, a la par de la fecha.
  function ponerSelectores() {
    const panel = document.querySelector('.acceso-panel');
    if (panel && !panel.querySelector('.idiomas')) panel.insertAdjacentHTML('afterbegin', selector().replace('class="idiomas', 'class="idiomas idiomas-acceso'));
    const f = document.getElementById('fecha');
    if (f && !f.parentElement.querySelector('.idiomas')) f.insertAdjacentHTML('afterend', selector());
    document.addEventListener('click', (e) => { const b = e.target.closest('[data-idioma]'); if (b) cambiar(b.dataset.idioma); });
  }
  document.addEventListener('DOMContentLoaded', () => { ponerSelectores(); if (en) iniciar(); });

  window.IDIOMA = { actual: () => idioma, ingles: en, cambiar, t: (s) => (en ? (traducir(s) ?? s) : s) };
})();
