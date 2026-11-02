// Pantalla inicial de Financiero: menú lateral por módulos y grupos, con rutas en el hash (#/modulo/grupo/opcion).
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function api(url, opts = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || r.statusText);
  return d;
}

// ---------- Menú lateral ----------
function pintarMenu() {
  $('#menu').innerHTML = MODULOS.map((m) => `
    <details class="modulo" data-modulo="${m.id}">
      <summary><i class="ti ${m.icono}" aria-hidden="true"></i>${esc(m.nombre)}<i class="ti ti-chevron-right flecha" aria-hidden="true"></i></summary>
      ${GRUPOS.map((g) => `
        <details class="grupo" data-grupo="${g.id}">
          <summary><i class="ti ${g.icono}" aria-hidden="true"></i>${esc(g.nombre)}<i class="ti ti-chevron-right flecha" aria-hidden="true"></i></summary>
          <ul class="opciones">
            ${m.opciones[g.id].map((o) => `<li><a href="#/${m.id}/${g.id}/${o.id}" data-ruta="${m.id}/${g.id}/${o.id}">${esc(o.nombre)}</a></li>`).join('')}
          </ul>
        </details>`).join('')}
    </details>`).join('');
}

function marcarMenu(mod, grp, opc) {
  document.querySelectorAll('.modulo').forEach((d) => {
    const activo = d.dataset.modulo === mod;
    d.classList.toggle('activo', activo);
    if (activo) d.open = true;
  });
  if (mod && grp) {
    const g = document.querySelector(`.modulo[data-modulo="${mod}"] .grupo[data-grupo="${grp}"]`);
    if (g) g.open = true;
  }
  document.querySelectorAll('.opciones a').forEach((a) => a.classList.toggle('activa', a.dataset.ruta === `${mod}/${grp}/${opc}`));
}

// ---------- Vistas ----------
function vistaInicio() {
  $('#contenido').innerHTML = `
    <h2>Bienvenido a Financiero</h2>
    <div class="tarjetas">
      ${MODULOS.map((m) => `
        <a class="tarjeta" href="#/${m.id}">
          <i class="ti ${m.icono}" aria-hidden="true"></i>
          <h3>${esc(m.nombre)}</h3>
          <div class="grupos-mini">${GRUPOS.map((g) => `<span>${esc(g.nombre)}</span>`).join('')}</div>
        </a>`).join('')}
    </div>`;
}

function vistaModulo(m) {
  $('#contenido').innerHTML = `
    <div class="ruta">Inicio / ${esc(m.nombre)}</div>
    <h2>${esc(m.nombre)}</h2>
    <div class="tarjetas">
      ${GRUPOS.map((g) => `
        <div class="tarjeta">
          <i class="ti ${g.icono}" aria-hidden="true"></i>
          <h3>${esc(g.nombre)}</h3>
          <p>${m.opciones[g.id].map((o) => `<a href="#/${m.id}/${g.id}/${o.id}">${esc(o.nombre)}</a>`).join(' · ')}</p>
        </div>`).join('')}
    </div>`;
}

function vistaOpcion(m, g, o) {
  const encabezado = `<div class="ruta">Inicio / ${esc(m.nombre)} / ${esc(g.nombre)}</div><h2>${esc(o.nombre)}</h2>`;
  if (o.vista && VISTAS[o.vista]) return VISTAS[o.vista](encabezado);
  $('#contenido').innerHTML = `${encabezado}
    <div class="vacio"><i class="ti ti-hammer" aria-hidden="true"></i>Esta pantalla está en construcción.</div>`;
}

const VISTAS = {
  // Catálogo de clientes y proveedores (tabla TERCEROS)
  terceros(encabezado) {
    $('#contenido').innerHTML = `${encabezado}
      <form class="form" id="form-terceros">
        <select name="TIPO"><option value="C">Cliente</option><option value="P">Proveedor</option><option value="A">Ambos</option></select>
        <input name="NIT" placeholder="NIT">
        <input name="NOMBRE" placeholder="Nombre" required>
        <input name="EMAIL" type="email" placeholder="correo@empresa.com">
        <button class="btn primario">Guardar</button>
      </form>
      <table class="tabla">
        <thead><tr><th>ID</th><th>Tipo</th><th>NIT</th><th>Nombre</th><th>Email</th><th></th></tr></thead>
        <tbody id="filas"><tr><td colspan="6">Cargando…</td></tr></tbody>
      </table>`;

    const cargar = async () => {
      try {
        const filas = await api('/api/terceros');
        $('#filas').innerHTML = filas.length
          ? filas.map((t) => `<tr>
              <td>${esc(t.ID_TERCERO)}</td><td>${esc(t.TIPO)}</td><td>${esc(t.NIT)}</td>
              <td>${esc(t.NOMBRE)}</td><td>${esc(t.EMAIL)}</td>
              <td><button class="btn" data-id="${esc(t.ID_TERCERO)}">Eliminar</button></td></tr>`).join('')
          : '<tr><td colspan="6">Sin registros.</td></tr>';
      } catch (e) {
        $('#filas').innerHTML = `<tr><td colspan="6">No se pudo cargar: ${esc(e.message)}</td></tr>`;
      }
    };

    $('#form-terceros').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/terceros', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
        e.target.reset();
        cargar();
      } catch (err) { alert(err.message); }
    });

    $('#filas').addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      if (!id || !confirm('¿Eliminar este registro?')) return;
      try { await api(`/api/terceros/${id}`, { method: 'DELETE' }); cargar(); } catch (err) { alert(err.message); }
    });

    cargar();
  },
};

// ---------- Rutas ----------
function enrutar() {
  const [modId, grpId, opcId] = location.hash.replace(/^#\/?/, '').split('/');
  const m = MODULOS.find((x) => x.id === modId);
  const g = m && GRUPOS.find((x) => x.id === grpId);
  const o = g && m.opciones[g.id].find((x) => x.id === opcId);

  if (o) vistaOpcion(m, g, o);
  else if (m) vistaModulo(m);
  else vistaInicio();

  marcarMenu(m?.id, g?.id, o?.id);
  document.body.classList.remove('menu-abierto');
  window.scrollTo(0, 0);
}

// ---------- Estado de la conexión ----------
function verificarConexion() {
  const el = $('#conexion');
  api('/api/salud')
    .then((d) => { el.className = 'conexion ok'; el.textContent = `Oracle conectado · ${d.oracle.ESQUEMA}`; })
    .catch(() => { el.className = 'conexion error'; el.textContent = 'Sin conexión a Oracle'; });
}

$('#btn-menu').addEventListener('click', () => document.body.classList.toggle('menu-abierto'));
window.addEventListener('hashchange', enrutar);
pintarMenu();
enrutar();
verificarConexion();
