// Tablero de tarjetas: #/ muestra los módulos, #/<modulo> sus 6 grupos de menú.
(function () {
  const vista = document.getElementById('vista');
  const migas = document.getElementById('migas');
  const estado = document.getElementById('estado-bd');

  const cfg = window.FIN_CONFIG || {};
  if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
    window.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    estado.textContent = 'Supabase conectado';
    estado.classList.add('ok');
  } else {
    estado.textContent = 'Supabase sin configurar';
  }

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cuenta = (m) => Object.values(m.opciones).reduce((n, l) => n + l.length, 0);

  function inicio() {
    migas.innerHTML = '<span>Inicio</span>';
    vista.innerHTML = `
      <h1>Módulos</h1>
      <p class="sub">Elige un módulo para ver sus grupos de operaciones.</p>
      <div class="tarjetas">
        ${MODULOS.map((m) => `
          <a class="tarjeta" href="#/${m.id}">
            <i class="ti ${m.icono}" aria-hidden="true"></i>
            <h2>${esc(m.nombre)}</h2>
            <p>${esc(m.descripcion)}</p>
            <span class="meta">${GRUPOS.length} grupos · ${cuenta(m)} opciones</span>
          </a>`).join('')}
      </div>`;
  }

  function modulo(m) {
    migas.innerHTML = `<a href="#/">Inicio</a><i class="ti ti-chevron-right" aria-hidden="true"></i><span>${esc(m.nombre)}</span>`;
    vista.innerHTML = `
      <h1><i class="ti ${m.icono}" aria-hidden="true"></i> ${esc(m.nombre)}</h1>
      <p class="sub">${esc(m.descripcion)}</p>
      <div class="grupos">
        ${GRUPOS.map((g) => `
          <section class="grupo">
            <h2><i class="ti ${g.icono}" aria-hidden="true"></i> ${esc(g.nombre)}</h2>
            <ul>
              ${(m.opciones[g.id] || []).map((o) => `
                <li><button type="button" data-opcion="${esc(o)}" data-grupo="${esc(g.nombre)}">${esc(o)}</button></li>`).join('')}
            </ul>
          </section>`).join('')}
      </div>`;
  }

  vista.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-opcion]');
    if (!b) return;
    aviso(`${b.dataset.grupo} › ${b.dataset.opcion}: en construcción.`);
  });

  let temporizador;
  function aviso(texto) {
    const t = document.getElementById('aviso');
    t.textContent = texto;
    t.classList.add('visible');
    clearTimeout(temporizador);
    temporizador = setTimeout(() => t.classList.remove('visible'), 2500);
  }

  function rutear() {
    const id = location.hash.replace(/^#\/?/, '');
    const m = MODULOS.find((x) => x.id === id);
    m ? modulo(m) : inicio();
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', rutear);
  rutear();
})();
