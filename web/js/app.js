// Financiero: inicio de sesión con Supabase Auth y panel ejecutivo filtrado por rol.
// Rutas: #/ panel, #/<modulo> grupos del módulo, #/usuarios administración (solo administrador).
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const cfg = window.FIN_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) {
    document.body.innerHTML = '<p style="padding:24px">Falta configurar Supabase en js/config.js.</p>';
    return;
  }
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const urlSitio = location.origin + location.pathname;

  let perfil = null;      // fila de public.perfiles del usuario actual
  let permisos = {};      // modulo -> { puede_ver, puede_editar }
  let roles = [];

  // Lo que necesitan las pantallas de catálogos (js/geografia.js, js/organizaciones.js…)
  window.PANTALLAS = window.PANTALLAS || {};
  window.FIN = {
    sb,
    aviso: (t) => aviso(t),
    perfil: () => perfil,
    roles: () => roles,
    esAdmin: () => !!perfil && perfil.activo && perfil.rol_id === 'administrador',
    urlSitio,
    // Debe coincidir con public.puede_editar_catalogos() en Supabase
    puedeEditarCatalogos: () => !!perfil && perfil.activo && ['administrador', 'contador'].includes(perfil.rol_id)
  };

  // Indicadores del panel; se conectarán a sus tablas cuando existan.
  const INDICADORES = [
    { nombre: 'Ventas del mes', valor: 'Q 0.00', nota: 'Facturación y ventas', icono: 'ti-trending-up', color: 'verde' },
    { nombre: 'Cuentas por cobrar', valor: 'Q 0.00', nota: 'Saldo pendiente', icono: 'ti-cash', color: 'azul' },
    { nombre: 'DTE emitidos', valor: '0', nota: 'Integraciones SAT', icono: 'ti-file-certificate', color: 'violeta' },
    { nombre: 'Empleados activos', valor: '0', nota: 'Nóminas y planillas', icono: 'ti-users', color: 'coral' }
  ];

  // ---------- Avisos ----------
  let temporizador;
  function aviso(texto) {
    const t = $('aviso');
    t.textContent = texto;
    t.classList.add('visible');
    clearTimeout(temporizador);
    temporizador = setTimeout(() => t.classList.remove('visible'), 3000);
  }
  function mensaje(texto, error) {
    const m = $('mensaje');
    m.textContent = texto || '';
    m.classList.toggle('error', !!error);
  }
  function traducir(err) {
    const t = (err && err.message) || '';
    if (/invalid login/i.test(t)) return 'Correo o contraseña incorrectos.';
    if (/email not confirmed/i.test(t)) return 'Confirma tu correo con el enlace que te enviamos.';
    if (/already registered/i.test(t)) return 'Ese correo ya tiene una cuenta.';
    if (/password should be/i.test(t)) return 'La contraseña es muy corta.';
    if (/rate limit/i.test(t)) return 'Demasiados intentos. Espera un momento.';
    return t || 'Ocurrió un error. Intenta de nuevo.';
  }

  // ---------- Pantalla de acceso ----------
  function mostrarAcceso(paso) {
    $('app').hidden = true;
    $('acceso').hidden = false;
    document.querySelectorAll('.acceso-panel [data-paso]').forEach((f) => { f.hidden = f.dataset.paso !== paso; });
    if (paso !== 'pendiente') mensaje('');
  }

  document.querySelectorAll('[data-ir]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    mostrarAcceso(a.dataset.ir);
  }));

  function alEnviar(id, fn) {
    const f = $(id);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const boton = f.querySelector('button[type=submit]');
      boton.disabled = true;
      mensaje('');
      try { await fn(Object.fromEntries(new FormData(f))); }
      catch (err) { mensaje(traducir(err), true); }
      finally { boton.disabled = false; }
    });
  }

  alEnviar('f-entrar', async (d) => {
    const { error } = await sb.auth.signInWithPassword({ email: d.correo, password: d.clave });
    if (error) throw error;
  });

  alEnviar('f-registrar', async (d) => {
    const { data, error } = await sb.auth.signUp({
      email: d.correo,
      password: d.clave,
      options: { data: { nombre: d.nombre.trim() }, emailRedirectTo: urlSitio }
    });
    if (error) throw error;
    if (!data.session) {
      mostrarAcceso('entrar');
      mensaje('Cuenta creada. Revisa tu correo y confirma la cuenta para entrar.');
    }
  });

  alEnviar('f-recuperar', async (d) => {
    const { error } = await sb.auth.resetPasswordForEmail(d.correo, { redirectTo: urlSitio });
    if (error) throw error;
    mensaje('Si el correo existe, te llegará un enlace en unos minutos.');
  });

  alEnviar('f-nueva', async (d) => {
    const { error } = await sb.auth.updateUser({ password: d.clave });
    if (error) throw error;
    // Renueva el vencimiento de la clave (90 días); si la función aún no existe, se deja pasar esta vez.
    const r = await sb.rpc('renovar_vencimiento_clave');
    if (r.error) claveRenovada = true;
    aviso('Contraseña actualizada');
    history.replaceState(null, '', urlSitio);
    await cargarSesion();
  });

  document.querySelectorAll('[data-salir]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    recuperando = false;
    sb.auth.signOut();
  }));

  // ---------- Sesión ----------
  let recuperando = false;
  let claveRenovada = false;
  // Fecha local de hoy (yyyy-mm-dd) para comparar con perfiles.fecha_vence_clave.
  const hoyLocal = () => { const h = new Date(); return new Date(h - h.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const claveVencida = (p) => !!p.fecha_vence_clave && p.fecha_vence_clave <= hoyLocal();
  sb.auth.onAuthStateChange((evento, sesion) => {
    if (evento === 'PASSWORD_RECOVERY') { recuperando = true; mostrarAcceso('nueva'); return; }
    if (recuperando) return;
    if (evento === 'SIGNED_OUT' || !sesion) { perfil = null; mostrarAcceso('entrar'); return; }
    if (evento === 'SIGNED_IN' || evento === 'INITIAL_SESSION') setTimeout(cargarSesion, 0);
  });

  async function cargarSesion() {
    recuperando = false;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return mostrarAcceso('entrar');

    const { data: p, error } = await sb.from('perfiles').select('*').eq('id', user.id).maybeSingle();
    if (error || !p) {
      mostrarAcceso('entrar');
      return mensaje('No se encontró tu perfil. Verifica que la base de datos esté instalada.', true);
    }
    perfil = p;
    if (!perfil.activo) return mostrarAcceso('pendiente');
    if (claveVencida(perfil) && !claveRenovada) {
      recuperando = true;
      mostrarAcceso('nueva');
      return mensaje('Tu clave venció o es temporal. Crea una clave nueva para continuar.', true);
    }

    const [{ data: pm }, { data: rs }] = await Promise.all([
      sb.from('rol_modulos').select('modulo, puede_ver, puede_editar').eq('rol_id', perfil.rol_id),
      sb.from('roles').select('id, nombre').order('nombre')
    ]);
    permisos = Object.fromEntries((pm || []).map((x) => [x.modulo, x]));
    roles = rs || [];

    $('acceso').hidden = true;
    $('app').hidden = false;
    pintarLateral();
    rutear();
  }

  // ---------- Barra lateral ----------
  const visibles = () => MODULOS.filter((m) => permisos[m.id] && permisos[m.id].puede_ver);
  const nombreRol = () => (roles.find((r) => r.id === perfil.rol_id) || {}).nombre || perfil.rol_id;
  const primerNombre = () => (perfil.nombre || perfil.correo).split(/[\s@]/)[0];

  function pintarLateral() {
    $('nav-modulos').innerHTML = visibles().map((m) =>
      `<a href="#/${m.id}" data-ruta="${m.id}"><i class="ti ${m.icono}" aria-hidden="true"></i> ${esc(m.corto)}</a>`).join('');
    $('nav-admin').hidden = perfil.rol_id !== 'administrador';
    const nombre = perfil.nombre || perfil.correo;
    $('quien-nombre').textContent = nombre;
    $('quien-rol').textContent = nombreRol();
    $('avatar').textContent = nombre.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('');
    const hoy = new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('fecha').textContent = hoy.charAt(0).toUpperCase() + hoy.slice(1);
  }

  function marcarActivo(ruta) {
    document.querySelectorAll('.lateral-nav a').forEach((a) => a.classList.toggle('activo', a.dataset.ruta === ruta));
  }

  function menuMovil(abrir) {
    $('app').classList.toggle('menu-abierto', abrir);
    $('velo').hidden = !abrir;
  }
  $('abrir-menu').addEventListener('click', () => menuMovil(true));
  $('velo').addEventListener('click', () => menuMovil(false));
  $('lateral').addEventListener('click', (e) => { if (e.target.closest('a')) menuMovil(false); });

  // ---------- Vistas ----------
  const vista = $('vista');
  const migas = $('migas');
  const cuenta = (m) => Object.values(m.opciones).reduce((n, l) => n + l.length, 0);

  function saludo() {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  function inicio() {
    migas.innerHTML = '<span>Panel ejecutivo</span>';
    const lista = visibles();
    vista.innerHTML = `
      <div class="titulo">
        <div>
          <h1>${saludo()}, ${esc(primerNombre())}</h1>
          <p>Resumen general de la empresa y acceso a los módulos.</p>
        </div>
      </div>

      <div class="indicadores">
        ${INDICADORES.map((k) => `
          <div class="indicador" data-color="${k.color}">
            <div class="indicador-cab"><span>${esc(k.nombre)}</span><i class="ti ${k.icono}" aria-hidden="true"></i></div>
            <b>${esc(k.valor)}</b>
            <small>${esc(k.nota)}</small>
          </div>`).join('')}
      </div>

      <h2 class="seccion">Módulos</h2>
      ${lista.length ? '' : '<p>Tu rol no tiene módulos asignados. Pide acceso a un administrador.</p>'}
      <div class="tarjetas">
        ${lista.map((m) => `
          <a class="tarjeta" href="#/${m.id}" data-color="${m.color}">
            <span class="ficha-icono"><i class="ti ${m.icono}" aria-hidden="true"></i></span>
            <h2>${esc(m.nombre)}</h2>
            <p>${esc(m.descripcion)}</p>
            <div class="chips">${GRUPOS.slice(0, 5).map((g) => `<span class="chip">${esc(g.nombre)}</span>`).join('')}</div>
            <div class="tarjeta-pie">
              <span>${cuenta(m)} opciones · ${permisos[m.id].puede_editar ? 'Edición' : 'Solo lectura'}</span>
              <i class="ti ti-arrow-right" aria-hidden="true"></i>
            </div>
          </a>`).join('')}
      </div>`;
    marcarActivo('');
  }

  function modulo(m) {
    migas.innerHTML = `<a href="#/">Panel</a><i class="ti ti-chevron-right" aria-hidden="true"></i><span>${esc(m.nombre)}</span>`;
    vista.innerHTML = `
      <div class="titulo" data-color="${m.color}">
        <span class="ficha-icono"><i class="ti ${m.icono}" aria-hidden="true"></i></span>
        <div>
          <h1>${esc(m.nombre)}${permisos[m.id].puede_editar ? '' : '<span class="etiqueta">Solo lectura</span>'}</h1>
          <p>${esc(m.descripcion)}</p>
        </div>
      </div>
      <div class="grupos" data-color="${m.color}">
        ${GRUPOS.map((g) => `
          <section class="grupo">
            <h2><i class="ti ${g.icono}" aria-hidden="true"></i> ${esc(g.nombre)}</h2>
            ${subgruposDe(m, g.id).map((s) => `
              <details class="subgrupo">
                <summary class="subgrupo-titulo"><span><i class="ti ${s.icono}" aria-hidden="true"></i> ${esc(s.subgrupo)}</span><i class="ti ti-chevron-down flecha" aria-hidden="true"></i></summary>
                <ul>
                  ${s.pantallas.map((p) => `
                    <li><a class="opcion" href="#/${m.id}/${p.id}"><span><i class="ti ${p.icono}" aria-hidden="true"></i> ${esc(p.nombre)}</span><i class="ti ti-chevron-right" aria-hidden="true"></i></a></li>`).join('')}
                </ul>
              </details>`).join('')}
            <ul>
              ${(m.opciones[g.id] || []).map((o) => `
                <li><button type="button" data-opcion="${esc(o)}" data-grupo="${esc(g.nombre)}">${esc(o)}<i class="ti ti-chevron-right" aria-hidden="true"></i></button></li>`).join('')}
            </ul>
          </section>`).join('')}
      </div>`;
    marcarActivo(m.id);
  }

  vista.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-opcion]');
    if (b) aviso(`${b.dataset.grupo} › ${b.dataset.opcion}: en construcción.`);
  });

  // Subgrupos desplegables de un grupo: los comunes (solo en Catálogos) y los propios del módulo.
  function subgruposDe(m, grupo) {
    return [...(grupo === 'catalogos' ? CATALOGOS_COMUNES : []), ...((m.subgrupos || {})[grupo] || [])];
  }

  // Pantalla de un subgrupo dentro de un módulo: #/<modulo>/<pantalla>
  function pantalla(m, p, extra) {
    migas.innerHTML = `<a href="#/">Panel</a><i class="ti ti-chevron-right" aria-hidden="true"></i>
      <a href="#/${m.id}">${esc(m.corto)}</a><i class="ti ti-chevron-right" aria-hidden="true"></i>
      <span>Catálogos · ${esc(p.nombre)}</span>`;
    vista.innerHTML = `
      <div class="titulo" data-color="${m.color}">
        <span class="ficha-icono"><i class="ti ${p.icono}" aria-hidden="true"></i></span>
        <div><h1>${esc(p.nombre)}</h1><p>${esc(p.descripcion)}</p></div>
      </div>
      <div id="pantalla" data-color="${m.color}"></div>`;
    marcarActivo(p.id === 'usuarios' ? 'usuarios' : m.id);
    const fn = window.PANTALLAS[p.id];
    if (fn) fn($('pantalla'), m, extra);
  }

  function rutear() {
    if (!perfil || !perfil.activo) return;
    const [id, sub, extra] = location.hash.replace(/^#\/?/, '').split('/');
    // El enlace "Usuarios" de la barra lateral abre Catálogos · Iniciales · Usuarios del primer módulo.
    if (id === 'usuarios' && visibles().length) { location.replace(`#/${visibles()[0].id}/usuarios`); return; }
    {
      const m = visibles().find((x) => x.id === id);
      const p = m && sub && GRUPOS.flatMap((g) => subgruposDe(m, g.id)).flatMap((s) => s.pantallas).find((x) => x.id === sub);
      if (m && p) pantalla(m, p, extra);
      else if (m) modulo(m);
      else inicio();
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', rutear);
})();
