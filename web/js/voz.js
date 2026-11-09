// Conversación por voz reutilizable: pregunta en voz alta, escucha la respuesta con el reconocimiento de voz del navegador
// (Chrome o Edge) o la toma escrita o de los botones de sugerencia. La usa Ventas Inteligentes (nueva venta por voz).
//   const c = window.VOZ.conversacion({ titulo, subtitulo });
//   const v = await c.preguntar('¿Para qué cliente?', (dicho) => valor | undefined, ['sugerencia', …]);
//   c.decir('texto'); await c.hablar('texto'); c.cerrar();
// preguntar() repite la pregunta mientras «interpretar» devuelva undefined, y lanza Error('cancelado') si se cierra o se
// dice «cancelar».
(function () {
  const esc = (t) => window.UI.esc(t);
  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ\s/.,-]/g, ' ').replace(/\s+/g, ' ').trim();
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const UNIDADES = { un: 1, uno: 1, una: 1, primero: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
    dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
    veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300, quinientos: 500, mil: 1000 };
  // Número dicho: «12», «12.5», «doce», «treinta y dos», «media docena», «una docena».
  function numero(t) {
    const s = norm(t);
    const d = s.match(/\d+(?:[.,]\d+)?/);
    if (d) return Number(d[0].replace(',', '.'));
    if (/media docena/.test(s)) return 6;
    if (/docena/.test(s)) return 12 * (UNIDADES[s.split(' ')[0]] || 1);
    let total = 0, alguno = false;
    s.split(/\s+/).forEach((p) => { if (p in UNIDADES) { alguno = true; total = UNIDADES[p] === 1000 ? (total || 1) * 1000 : total + UNIDADES[p]; } });
    return alguno ? total : null;
  }
  // Parecido entre lo dicho y un nombre: proporción de palabras del nombre que se dijeron.
  function parecido(dicho, nombre) {
    const d = new Set(norm(dicho).split(' ')), ps = norm(nombre).split(' ').filter((x) => x.length > 2 || /\d/.test(x));
    if (!ps.length) return 0;
    return ps.filter((x) => d.has(x) || [...d].some((y) => y.length > 3 && (x.startsWith(y) || y.startsWith(x)))).length / ps.length;
  }
  // El más parecido; también acepta que lo dicho esté contenido en el nombre (p. ej. «omeprazol» → «OMEPRAZOL 40 MG …»).
  function mejor(dicho, items, nombreDe, minimo = 0.5) {
    const d = norm(dicho);
    let m = null, s = 0;
    items.forEach((x) => { const n = norm(nombreDe(x)); let v = parecido(d, n); if (d.length >= 4 && n.includes(d)) v = Math.max(v, 0.75 + d.length / (n.length * 4)); if (v > s) { s = v; m = x; } });
    return s >= minimo ? m : null;
  }
  const dd = (n) => String(n).padStart(2, '0');
  function fechaDicha(t, hoy) {
    const s = norm(t);
    const d = (base, n) => { const x = new Date(`${base}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    if (/\bhoy\b/.test(s)) return hoy;
    if (/\bayer\b/.test(s)) return d(hoy, -1);
    if (/\bmanana\b/.test(s)) return d(hoy, 1);
    let m = s.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
    if (m) { const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : hoy.slice(0, 4); return `${y}-${dd(m[2])}-${dd(m[1])}`; }
    m = s.match(/(\d{1,2}|[a-z]+) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?: de(?:l)? (\d{4}))?/);
    if (m) { const dia = /^\d+$/.test(m[1]) ? Number(m[1]) : UNIDADES[m[1]]; const mes = m[2] === 'setiembre' ? 9 : MESES.indexOf(m[2]) + 1; if (dia && mes) return `${m[3] || hoy.slice(0, 4)}-${dd(mes)}-${dd(dia)}`; }
    return null;
  }
  const si = (t) => (/\b(si|claro|dale|correcto|adelante|ok|otro|agrega|agregar|mas)\b/.test(norm(t)) ? true : /\b(no|ninguno|terminar|listo|ya)\b/.test(norm(t)) ? false : undefined);

  function conversacion({ titulo = 'Asistente por voz', subtitulo = '' } = {}) {
    const Reco = window.SpeechRecognition || window.webkitSpeechRecognition;
    const velo = document.createElement('div');
    velo.className = 'modal-velo';
    velo.innerHTML = `<div class="modal rgv" role="dialog" aria-modal="true" aria-labelledby="voz-t">
        <header class="modal-cab"><h2 id="voz-t"><i class="ti ti-microphone" aria-hidden="true"></i> ${esc(titulo)} <small>${esc(subtitulo)}</small></h2>
          <button type="button" class="icono-boton" data-cerrar aria-label="Cerrar"><i class="ti ti-x" aria-hidden="true"></i></button></header>
        <div class="rgv-chat" aria-live="polite"></div>
        <div class="rgv-sug"></div>
        <form class="rgv-pie">
          <button type="button" class="rgv-mic" data-mic title="Hablar" aria-label="Hablar"><i class="ti ti-microphone" aria-hidden="true"></i></button>
          <input class="rgv-txt" placeholder="${Reco ? 'Hable o escriba su respuesta' : 'Escriba su respuesta (este navegador no reconoce la voz)'}" autocomplete="off">
          <button type="submit" class="boton primario-sm"><i class="ti ti-send" aria-hidden="true"></i> Responder</button>
        </form>
        <p class="rgv-estado"></p>
      </div>`;
    document.body.appendChild(velo);
    const chat = velo.querySelector('.rgv-chat'), sug = velo.querySelector('.rgv-sug'), txt = velo.querySelector('.rgv-txt'), estado = velo.querySelector('.rgv-estado'), mic = velo.querySelector('[data-mic]');
    let cerrado = false, responder = null, reco = null;
    const decir = (t, quien = 'yo') => { chat.insertAdjacentHTML('beforeend', `<div class="rgv-m ${quien}"><i class="ti ${quien === 'yo' ? 'ti-robot' : 'ti-user'}" aria-hidden="true"></i><p>${esc(t)}</p></div>`); chat.scrollTop = chat.scrollHeight; };
    const hablar = (t) => new Promise((ok) => {
      if (!('speechSynthesis' in window) || cerrado) return ok();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t); u.lang = 'es-GT';
      const v = speechSynthesis.getVoices().find((x) => /^es/i.test(x.lang)); if (v) u.voice = v;
      u.onend = ok; u.onerror = ok; speechSynthesis.speak(u);
      setTimeout(ok, Math.min(15000, 900 + t.length * 70));
    });
    function escuchar() {
      if (!Reco || cerrado) return;
      try { reco?.abort(); } catch { /* nada */ }
      reco = new Reco(); reco.lang = 'es-GT'; reco.interimResults = true; reco.maxAlternatives = 1;
      mic.classList.add('activo'); estado.textContent = 'Escuchando…';
      reco.onresult = (e) => { const r = e.results[e.results.length - 1]; txt.value = r[0].transcript; if (r.isFinal) { estado.textContent = ''; enviar(); } };
      reco.onerror = (e) => { estado.textContent = e.error === 'not-allowed' ? 'Permita el micrófono en el navegador o escriba la respuesta.' : e.error === 'no-speech' ? 'No le escuché: toque el micrófono para repetir o escriba.' : ''; };
      reco.onend = () => mic.classList.remove('activo');
      try { reco.start(); } catch { /* ya escuchando */ }
    }
    function enviar() { const v = txt.value.trim(); if (!v || !responder) return; txt.value = ''; decir(v, 'tu'); const r = responder; responder = null; sug.innerHTML = ''; r(v); }
    async function preguntar(texto, interpretar, sugerencias = []) {
      for (;;) {
        if (cerrado) throw new Error('cancelado');
        decir(texto);
        sug.innerHTML = sugerencias.map((s) => `<button type="button" class="rgv-chip">${esc(s)}</button>`).join('');
        const resp = new Promise((ok) => { responder = ok; });
        await hablar(texto);
        escuchar();
        const dicho = await resp;
        if (cerrado || /\b(cancelar|salir)\b/.test(norm(dicho))) throw new Error('cancelado');
        const v = await interpretar(dicho);
        if (v !== undefined) return v;
        texto = `No le entendí. ${texto.replace(/^No le entendí\. /, '')}`;
      }
    }
    const cerrar = () => { if (cerrado) return; cerrado = true; try { reco?.abort(); } catch { /* nada */ } if ('speechSynthesis' in window) speechSynthesis.cancel(); velo.remove(); if (responder) responder('cancelar'); };
    velo.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); enviar(); });
    sug.addEventListener('click', (e) => { const b = e.target.closest('.rgv-chip'); if (b) { txt.value = b.textContent; enviar(); } });
    mic.addEventListener('click', escuchar);
    velo.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrar));
    velo.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
    return { preguntar, decir, hablar, cerrar, get cerrado() { return cerrado; } };
  }

  window.VOZ = { conversacion, norm, mejor, parecido, numero, fechaDicha, si };
})();
