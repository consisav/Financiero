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
  let rolesCache = [];
  const CLAVE_EMPRESA = 'fin.empresa_elegida'; // en esta pestaña ya se eligió la empresa de la sesión
  let empresas = null;    // empresas del usuario [{ id, codigo, nombre_comercial, organizacion_id, rol_id }]; null = todas (Super Administrador o sin script 96)

  // Lo que necesitan las pantallas de catálogos (js/geografia.js, js/organizaciones.js…)
  window.PANTALLAS = window.PANTALLAS || {};
  window.FIN = {
    sb,
    aviso: (t) => aviso(t),
    perfil: () => perfil,
    roles: () => roles,
    // Deben coincidir con public.es_admin() / public.es_superadmin() en Supabase
    esAdmin: () => !!perfil && perfil.activo && ['superadministrador', 'administrador'].includes(perfil.rol_id),
    esSuperAdmin: () => !!perfil && perfil.activo && perfil.rol_id === 'superadministrador',
    urlSitio,
    // Empresas (localidades) a las que entra el usuario; null = todas.
    empresas: () => empresas,
    // Debe coincidir con public.puede_editar_catalogos() en Supabase
    puedeEditarCatalogos: () => !!perfil && perfil.activo && ['superadministrador', 'administrador'].includes(perfil.rol_id)
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
    let correo = String(d.correo || '').trim();
    // Sin «@» es el código de usuario: se busca el correo de su cuenta (script 97).
    if (!correo.includes('@')) {
      const r = await sb.rpc('correo_para_ingresar', { p_usuario: correo });
      if (r.error && !/correo_para_ingresar/.test(r.error.message || '')) throw r.error;
      if (!r.data) throw new Error('Invalid login credentials');
      correo = r.data;
    }
    // Al iniciar sesión se vuelve a preguntar la empresa (si el usuario tiene varias).
    try { sessionStorage.removeItem(CLAVE_EMPRESA); } catch (e) { /* sin almacenamiento */ }
    const { error } = await sb.auth.signInWithPassword({ email: correo, password: d.clave });
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
      sb.from('roles').select('*')
    ]);
    permisos = Object.fromEntries((pm || []).map((x) => [x.modulo, x]));
    // Un módulo nuevo sin permisos propios todavía (falta su script) usa los del módulo que indica "hereda".
    MODULOS.forEach((m) => { if (m.hereda && !permisos[m.id] && permisos[m.hereda]) permisos[m.id] = permisos[m.hereda]; });
    // Empresas del usuario con su rol (script 96). El Super Administrador entra a todas.
    empresas = null;
    if (perfil.rol_id !== 'superadministrador') {
      const pe = await sb.from('perfil_empresas').select('rol_id, localidad_id, localidades(id, codigo, nombre_comercial, organizacion_id, activo)').eq('perfil_id', perfil.id).eq('activo', true);
      if (!pe.error && pe.data?.length) empresas = pe.data.filter((x) => x.localidades?.activo !== false).map((x) => ({ ...x.localidades, rol_id: x.rol_id })).sort((x, y) => x.codigo.localeCompare(y.codigo));
    }
    rolesCache = rs || [];
    if (await elegirEmpresa()) return;
    aplicarAlcance();
    roles = (rs || []).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || a.nombre.localeCompare(b.nombre));

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
    $('nav-admin').hidden = !window.FIN.esAdmin();
    const nombre = perfil.nombre || perfil.correo;
    $('quien-nombre').textContent = nombre;
    $('quien-rol').textContent = nombreRol();
    $('avatar').textContent = nombre.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('');
    const hoy = new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('fecha').textContent = hoy.charAt(0).toUpperCase() + hoy.slice(1);
    pintarMarca();
  }

  // Logo de la organización del usuario (lo más grande que permite la barra superior), después su
  // eslogan y, a la par, el nombre de su localidad. Sin logo, o si la imagen no carga, se muestran
  // las iniciales; sin eslogan, ese espacio no aparece.
  async function pintarMarca() {
    const caja = $('marca-empresa');
    const [o, l] = await Promise.all([
      perfil.organizacion_id ? sb.from('organizaciones').select('codigo, nombre, logo_ruta, eslogan_ruta').eq('id', perfil.organizacion_id).maybeSingle() : { data: null },
      perfil.localidad_id ? sb.from('localidades').select('codigo, nombre_comercial').eq('id', perfil.localidad_id).maybeSingle() : { data: null }
    ]);
    const org = o.data;
    const loc = l.data;
    if (!org && !loc) { caja.hidden = true; return; }
    const nombre = loc ? loc.nombre_comercial : org.nombre;
    const base = org ? org.nombre : nombre;
    const palabras = base.split(/\s+/).filter((x) => x.length > 2);
    const iniciales = esc((palabras.length > 1 ? palabras.slice(0, 2).map((x) => x[0]).join('') : base.slice(0, 2)).toUpperCase());
    const url = (ruta) => ruta ? sb.storage.from('organizaciones').getPublicUrl(ruta).data.publicUrl : null;
    const logo = url(org && org.logo_ruta);
    const eslogan = url(org && org.eslogan_ruta);
    caja.innerHTML = `
      ${logo ? `<img class="marca-logo" src="${esc(logo)}" alt="Logo de ${esc(org.nombre)}">` : ''}
      <span class="marca-iniciales" ${logo ? 'hidden' : ''}>${iniciales}</span>
      ${eslogan ? `<img class="marca-eslogan" src="${esc(eslogan)}" alt="Eslogan de ${esc(org.nombre)}">` : ''}
      <span class="marca-texto">${await selectorEmpresa(nombre)}<small>${esc([loc && loc.codigo, org && org.nombre].filter(Boolean).join(' · '))}</small></span>`;
    const selEmp = caja.querySelector('[data-empresa-activa]');
    if (selEmp) selEmp.addEventListener('change', async () => {
      selEmp.disabled = true;
      const { error } = await sb.rpc('cambiar_empresa_activa', { p_localidad: Number(selEmp.value) });
      if (error) { selEmp.disabled = false; selEmp.value = String(perfil.localidad_id); return aviso(error.message); }
      try { sessionStorage.setItem(CLAVE_EMPRESA, selEmp.value); } catch (e) { /* sin almacenamiento */ }
      location.reload();
    });
    const img = caja.querySelector('.marca-logo');
    if (img) img.addEventListener('error', () => { img.remove(); caja.querySelector('.marca-iniciales').hidden = false; });
    const esl = caja.querySelector('.marca-eslogan');
    if (esl) esl.addEventListener('error', () => esl.remove());
    caja.hidden = false;
  }

  // Varias empresas: al iniciar sesión se pregunta a cuál se conecta (el Super Administrador entra a
  // todas sin preguntar). Con una sola, se activa esa. Devuelve true mientras espera la elección.
  async function elegirEmpresa() {
    if (!empresas || perfil.rol_id === 'superadministrador') return false;
    let elegida = null;
    try { elegida = sessionStorage.getItem(CLAVE_EMPRESA); } catch (e) { /* sin almacenamiento */ }
    const activar = async (id) => {
      const { error } = await sb.rpc('cambiar_empresa_activa', { p_localidad: id });
      if (error) { mensaje(traducir(error), true); return; }
      try { sessionStorage.setItem(CLAVE_EMPRESA, String(id)); } catch (e) { /* sin almacenamiento */ }
      location.reload();
    };
    if (empresas.length === 1) {
      if (empresas[0].id !== perfil.localidad_id) { await activar(empresas[0].id); return true; }
      return false;
    }
    if (elegida && empresas.some((x) => String(x.id) === elegida && x.id === perfil.localidad_id)) return false;
    const rolDe = (r) => ((roles.length ? roles : rolesCache).find((x) => x.id === r) || {}).nombre || r;
    const caja = document.querySelector('[data-empresas]');
    caja.innerHTML = empresas.map((x) => `<button type="button" class="emp-opcion ${x.id === perfil.localidad_id ? 'ultima' : ''}" data-empresa="${x.id}">
        <span class="emp-cod">${esc(x.codigo)}</span><span class="emp-nom"><b>${esc(x.nombre_comercial)}</b><small>${esc(rolDe(x.rol_id))}${x.id === perfil.localidad_id ? ' · última usada' : ''}</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>`).join('');
    caja.onclick = (e) => { const b = e.target.closest('[data-empresa]'); if (b) { caja.querySelectorAll('button').forEach((x) => { x.disabled = true; }); activar(Number(b.dataset.empresa)); } };
    mostrarAcceso('empresa');
    return true;
  }

  // Usuario que no es Super Administrador: ve y trabaja solo con la información de su empresa activa.
  // Las consultas de empresas (localidades) y organizaciones de todas las pantallas se limitan a ellas.
  function aplicarAlcance() {
    if (!sb.__fromOriginal) sb.__fromOriginal = sb.from.bind(sb);
    const original = sb.__fromOriginal;
    if (perfil.rol_id === 'superadministrador' || !perfil.localidad_id || !empresas) { sb.from = original; return; }
    const limite = { localidades: perfil.localidad_id, organizaciones: perfil.organizacion_id };
    sb.from = (tabla) => {
      const q = original(tabla);
      if (!(tabla in limite)) return q;
      const select = q.select.bind(q);
      q.select = (...args) => select(...args).eq('id', limite[tabla]);
      return q;
    };
  }

  // Empresa activa: selector con las empresas del usuario y su rol (el Super Administrador, todas las
  // activas por organización). Con una sola empresa, solo su nombre.
  async function selectorEmpresa(nombre) {
    let lista = empresas;
    let grupos = null;
    if (!lista && perfil.rol_id === 'superadministrador') {
      const [o, l] = await Promise.all([sb.from('organizaciones').select('id, codigo, nombre').eq('activo', true).order('codigo'),
        sb.from('localidades').select('id, codigo, nombre_comercial, organizacion_id').eq('activo', true).order('codigo')]);
      lista = l.data || [];
      grupos = (o.data || []).map((x) => ({ o: x, locs: lista.filter((y) => y.organizacion_id === x.id) })).filter((g) => g.locs.length);
    }
    if (!lista || lista.length < 2) return `<b title="${esc(nombre)}">${esc(nombre)}</b>`;
    const rolDe = (r) => (roles.find((x) => x.id === r) || {}).nombre || r;
    const opcion = (x) => `<option value="${x.id}" ${x.id === perfil.localidad_id ? 'selected' : ''}>${esc(x.nombre_comercial)} · ${esc(x.codigo)}${x.rol_id ? ` — ${esc(rolDe(x.rol_id))}` : ''}</option>`;
    return `<label class="empresa-activa" title="Empresa activa: al cambiarla se aplican tu rol y permisos en ella"><span class="oculto">Empresa activa</span>
      <select data-empresa-activa aria-label="Empresa activa">${grupos ? grupos.map((g) => `<optgroup label="${g.o.codigo} · ${esc(g.o.nombre)}">${g.locs.map(opcion).join('')}</optgroup>`).join('') : lista.map(opcion).join('')}</select></label>`;
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
            <div class="chips">${gruposDe(m).slice(0, 5).map((g) => `<span class="chip">${esc(g.nombre)}</span>`).join('')}</div>
            <div class="tarjeta-pie">
              <span>${cuenta(m)} opciones · ${permisos[m.id].puede_editar ? 'Edición' : 'Solo lectura'}</span>
              <i class="ti ti-arrow-right" aria-hidden="true"></i>
            </div>
          </a>`).join('')}
      </div>`;
    marcarActivo('');
  }

  // Barra fija con los grupos del módulo; cada grupo despliega sus subgrupos y opciones al tocarlo.
  // "actual" es la pantalla abierta: se marca su grupo y se abre su subgrupo dentro del desplegable.
  function menuModulo(m, actual) {
    const grupoDe = (g) => subgruposDe(m, g.id).some((s) => contiene(s, actual));
    return `
      <nav class="menu-modulo" data-color="${m.color}" data-modulo="${m.id}" aria-label="Menú de ${esc(m.corto)}">
        ${gruposDe(m).map((g) => `
          <div class="menu-item">
            <button type="button" class="menu-boton ${actual && grupoDe(g) ? 'actual' : ''}" data-menu="${g.id}" aria-expanded="false" aria-haspopup="true">
              <span class="menu-icono"><i class="ti ${g.icono}" aria-hidden="true"></i></span>${esc(g.nombre)}<i class="ti ti-chevron-down flecha" aria-hidden="true"></i>
            </button>
            <div class="menu-panel" data-panel="${g.id}" hidden>
              ${subgruposDe(m, g.id).map((s) => `
                <details class="subgrupo" name="sub-${m.id}-${g.id}" ${contiene(s, actual) || subgruposDe(m, g.id).length === 1 ? 'open' : ''}>
                  <summary class="subgrupo-titulo"><span><i class="ti ${s.icono}" aria-hidden="true"></i> ${esc(s.subgrupo)}</span><i class="ti ti-chevron-down flecha" aria-hidden="true"></i></summary>
                  ${listaOpciones(m, s.pantallas, actual)}
                </details>`).join('')}
              <ul class="menu-opciones">
                ${(m.opciones[g.id] || []).map((o) => `
                  <li><button type="button" data-opcion="${esc(o)}" data-grupo="${esc(g.nombre)}">${esc(o)}<i class="ti ti-chevron-right" aria-hidden="true"></i></button></li>`).join('')}
              </ul>
            </div>
          </div>`).join('')}
      </nav>`;
  }

  // Opciones de un subgrupo; una opción con "pantallas" es un subgrupo anidado (p. ej. Replicación).
  function listaOpciones(m, pantallas, actual) {
    return `<ul>${pantallas.map((p) => p.pantallas ? `
      <li>
        <details class="subgrupo anidado" ${contiene(p, actual) ? 'open' : ''}>
          <summary class="subgrupo-titulo"><span><i class="ti ${p.icono}" aria-hidden="true"></i> ${esc(p.subgrupo)}</span><i class="ti ti-chevron-down flecha" aria-hidden="true"></i></summary>
          ${listaOpciones(m, p.pantallas, actual)}
        </details>
      </li>${p.separador ? '<li class="separador" role="separator"></li>' : ''}` : `
      <li><a class="opcion ${p === actual ? 'actual' : ''}" href="#/${m.id}/${p.id}"><span><i class="ti ${p.icono}" aria-hidden="true"></i> ${esc(p.nombre)}</span><i class="ti ti-chevron-right" aria-hidden="true"></i></a></li>${p.separador ? '<li class="separador" role="separator"></li>' : ''}`).join('')}</ul>`;
  }

  function cerrarMenus(excepto) {
    vista.querySelectorAll('.menu-panel').forEach((p) => {
      if (p.dataset.panel === excepto) return;
      p.hidden = true;
      const b = vista.querySelector(`[data-menu="${p.dataset.panel}"]`);
      if (b) { b.setAttribute('aria-expanded', 'false'); b.classList.remove('abierto'); }
    });
  }

  function modulo(m) {
    migas.innerHTML = `<a href="#/">Panel</a><i class="ti ti-chevron-right" aria-hidden="true"></i><span>${esc(m.nombre)}</span>`;
    const accesos = gruposDe(m).flatMap((g) => subgruposDe(m, g.id).flatMap((s) => hojas(s).map(({ p, ruta }) => ({ g, ruta, p }))));
    vista.innerHTML = `
      ${menuModulo(m, null)}
      <div class="titulo" data-color="${m.color}">
        <span class="ficha-icono"><i class="ti ${m.icono}" aria-hidden="true"></i></span>
        <div>
          <h1>${esc(m.nombre)}${permisos[m.id].puede_editar ? '' : '<span class="etiqueta">Solo lectura</span>'}</h1>
          <p>${esc(m.descripcion)} Elige un grupo en el menú de arriba.</p>
        </div>
      </div>
      <h2 class="seccion">Accesos directos</h2>
      <div class="accesos" data-color="${m.color}">
        ${accesos.map(({ g, ruta, p }) => `
          <a class="acceso-directo" href="#/${m.id}/${p.id}">
            <span class="ficha-icono"><i class="ti ${p.icono}" aria-hidden="true"></i></span>
            <span><b>${esc(p.nombre)}</b><small>${esc(g.nombre)} · ${esc(ruta)}</small></span>
          </a>`).join('')}
      </div>`;
    marcarActivo(m.id);
  }

  vista.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-menu]');
    if (boton) {
      const panel = vista.querySelector(`[data-panel="${boton.dataset.menu}"]`);
      const abrir = panel.hidden;
      cerrarMenus(abrir ? boton.dataset.menu : null);
      panel.hidden = !abrir;
      boton.setAttribute('aria-expanded', String(abrir));
      boton.classList.toggle('abierto', abrir);
      return;
    }
    if (e.target.closest('.menu-panel a.opcion')) cerrarMenus();
    const b = e.target.closest('button[data-opcion]');
    if (b && b.dataset.opcion === 'Manual del módulo' && window.MANUAL) {
      // Manual del módulo: presentación con la estructura del menú (y con IA si se generó).
      cerrarMenus();
      const m = MODULOS.find((x) => x.id === b.closest('.menu-modulo')?.dataset.modulo);
      if (m) window.MANUAL.abrir(m, estructuraModulo(m));
      return;
    }
    if (b) { cerrarMenus(); aviso(`${b.dataset.grupo} › ${b.dataset.opcion}: en construcción.`); }
  });
  // Se cierran al tocar fuera del menú o con Escape.
  document.addEventListener('click', (e) => { if (!e.target.closest('.menu-modulo')) cerrarMenus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarMenus(); });

  // Grupos del menú: los propios del módulo (p. ej. Caja y Bancos) o los 6 generales.
  const gruposDe = (m) => m.grupos || GRUPOS;

  // Subgrupos desplegables de un grupo: los comunes (solo en Catálogos del módulo con «comunes»,
  // Administración) y los propios del módulo.
  function subgruposDe(m, grupo) {
    return [...(grupo === 'catalogos' && m.comunes ? CATALOGOS_COMUNES : []), ...((m.subgrupos || {})[grupo] || [])];
  }
  const pantallasDe = (m) => gruposDe(m).flatMap((g) => subgruposDe(m, g.id)).flatMap((s) => hojas(s).map((h) => h.p));

  // Pantallas de un subgrupo con su ruta, también las de sus subgrupos anidados.
  function hojas(s, ruta = s.subgrupo) {
    return s.pantallas.flatMap((p) => p.pantallas ? hojas(p, `${ruta} · ${p.subgrupo}`) : [{ p, ruta }]);
  }
  const contiene = (s, actual) => !!actual && hojas(s).some((h) => h.p === actual);
  // Grupos, subgrupos y pantallas del módulo con su descripción (para el manual del módulo).
  const estructuraModulo = (m) => gruposDe(m).filter((g) => g.id !== 'ayuda').map((g) => ({
    id: g.id, grupo: g.nombre, opciones: (m.opciones || {})[g.id] || [],
    subgrupos: subgruposDe(m, g.id).map((s) => ({ subgrupo: s.subgrupo, pantallas: hojas(s).map((h) => ({ id: h.p.id, nombre: h.p.nombre, descripcion: h.p.descripcion || '', ruta: h.ruta })) }))
  })).filter((g) => g.subgrupos.length || g.opciones.length);

  // Pantalla de un subgrupo dentro de un módulo: #/<modulo>/<pantalla>
  function pantalla(m, p, extra) {
    migas.innerHTML = `<a href="#/">Panel</a><i class="ti ti-chevron-right" aria-hidden="true"></i>
      <a href="#/${m.id}">${esc(m.corto)}</a><i class="ti ti-chevron-right" aria-hidden="true"></i>
      <span>${esc((gruposDe(m).find((g) => subgruposDe(m, g.id).some((sg) => contiene(sg, p))) || gruposDe(m)[0]).nombre)} · ${esc(p.nombre)}</span>`;
    // Las pantallas de catálogos no llevan título: el nombre ya está en la ruta de arriba.
    vista.innerHTML = `
      ${menuModulo(m, p)}
      <div id="pantalla" data-color="${m.color}"></div>`;
    marcarActivo(p.id === 'usuarios' ? 'usuarios' : m.id);
    const fn = window.PANTALLAS[p.id];
    if (fn) fn($('pantalla'), m, extra);
    else $('pantalla').innerHTML = `<section class="panel"><p class="vacio">${esc(p.nombre)}: en construcción.</p></section>`;
  }

  function rutear() {
    if (!perfil || !perfil.activo) return;
    const [id, sub, extra] = location.hash.replace(/^#\/?/, '').split('/');
    // El enlace "Usuarios" de la barra lateral abre Catálogos · Usuarios del módulo que lo tiene (Administración).
    if (id === 'usuarios' && visibles().length) {
      const con = visibles().find((x) => pantallasDe(x).some((q) => q.id === 'usuarios')) || visibles()[0];
      location.replace(`#/${con.id}/usuarios`);
      return;
    }
    {
      const m = visibles().find((x) => x.id === id);
      const p = m && sub && pantallasDe(m).find((x) => x.id === sub);
      // Una pantalla que cambió de módulo (p. ej. Bancos a Caja y Bancos, Tickets y Usuarios a
      // Administración) se abre en el nuevo.
      const otro = m && sub && !p && visibles().find((x) => pantallasDe(x).some((q) => q.id === sub));
      if (otro) { location.replace(`#/${otro.id}/${sub}${extra ? `/${extra}` : ''}`); return; }
      if (m && p) pantalla(m, p, extra);
      else if (m) modulo(m);
      else inicio();
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', rutear);
})();
