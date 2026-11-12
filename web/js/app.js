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
  let modulosEmpresa = null; // módulos habilitados a la empresa conectada (Acceso Sistemas); null = todos
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
    // Super Administrador Global (único, script 99): acceso total a todas las organizaciones.
    esGlobal: () => !!perfil && perfil.activo && perfil.rol_id === 'superadministrador' && !!perfil.es_global,
    urlSitio,
    // Empresas (localidades) a las que entra el usuario; null = todas.
    empresas: () => empresas,
    // Debe coincidir con public.puede_editar_catalogos() en Supabase
    puedeEditarCatalogos: () => !!perfil && perfil.activo && ['superadministrador', 'administrador'].includes(perfil.rol_id)
  };

  // Indicadores del panel: datos reales de la empresa conectada; se recalculan cada minuto mientras el panel está abierto.
  const INDICADORES = [
    { id: 'ventas', nombre: 'Ventas del mes', icono: 'ti-trending-up', color: 'verde' },
    { id: 'cobros', nombre: 'Cobros del mes', icono: 'ti-receipt-2', color: 'turquesa' },
    { id: 'cxc', nombre: 'Cuentas por cobrar', icono: 'ti-cash', color: 'azul' },
    { id: 'vencido', nombre: 'Saldo vencido', icono: 'ti-alert-triangle', color: 'ambar' },
    { id: 'dte', nombre: 'DTE emitidos del mes', icono: 'ti-file-certificate', color: 'violeta' },
    { id: 'empleados', nombre: 'Empleados activos', icono: 'ti-users', color: 'coral' }
  ];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const qtz = (n) => `Q ${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const entero = (n) => Number(n || 0).toLocaleString('es-GT');
  const pl = (n, uno, varios) => `${entero(n)} ${Number(n) === 1 ? uno : varios}`;
  const diaGT = (x) => (x ? new Date(new Date(x).getTime() - 6 * 3600000).toISOString().slice(0, 10) : ''); // fecha en Guatemala (UTC-6)
  const masDias = (d, n) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + (Number(n) || 0)); return t.toISOString().slice(0, 10); };
  // Lee todas las filas (de 1000 en 1000); si la tabla no existe o el rol no tiene acceso devuelve null.
  async function filas(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await hacer().range(i, i + 999);
      if (error) return null;
      out.push(...(data || []));
      if (!data || data.length < 1000) return out;
    }
  }
  let relojPanel = null, monedasPanel = null;
  async function cargarIndicadores() {
    const caja = vista.querySelector('[data-indicadores]');
    const loc = perfil && perfil.localidad_id;
    if (!caja || !loc) return;
    const hoy = diaGT(new Date()), ini = `${hoy.slice(0, 8)}01`;
    const desde = `${ini}T00:00:00-06:00`, hasta = `${hoy}T23:59:59.999-06:00`;
    if (!monedasPanel) { const m = await sb.from('monedas').select('id, iso'); monedasPanel = m.error ? [] : m.data || []; }
    const iso = (id) => (monedasPanel.find((m) => m.id === id) || {}).iso;
    const k = (d) => (d.moneda_id && iso(d.moneda_id) && iso(d.moneda_id) !== 'GTQ' ? Number(d.tipo_cambio) || 1 : 1);
    const suma = (ls, campo) => (ls || []).reduce((s, d) => s + (Number(d[campo]) || 0) * k(d), 0);
    const [fac, notas, rec, cxc, emp] = await Promise.all([
      filas(() => sb.from('facturas_venta').select('id, fecha_emision, total, moneda_id, tipo_cambio, autorizacion').eq('localidad_id', loc).neq('estado', 'ANULADA').gte('fecha_emision', desde).lte('fecha_emision', hasta).order('id')),
      filas(() => sb.from('notas_venta').select('id, autorizacion').eq('localidad_id', loc).neq('estado', 'ANULADA').gte('fecha_emision', desde).lte('fecha_emision', hasta).order('id')),
      filas(() => sb.from('recibos_venta').select('id, fecha, valor, clase, moneda_id, tipo_cambio').eq('localidad_id', loc).neq('estado', 'ANULADO').gte('fecha', ini).lte('fecha', hoy).order('id')),
      filas(() => sb.from('facturas_venta').select('id, saldo, fecha_emision, fecha_cobro, dias_credito, moneda_id, tipo_cambio').eq('localidad_id', loc).neq('estado', 'ANULADA').gt('saldo', 0).order('id')),
      sb.from('nom_empleados').select('id', { count: 'exact', head: true }).eq('localidad_id', loc).eq('estado', 'ACTIVO')
    ]);
    if (!caja.isConnected) return;
    const recibos = rec && rec.filter((r) => !r.clase || r.clase === 'RECIBO');
    const vencidas = cxc && cxc.filter((f) => (f.fecha_cobro || masDias(diaGT(f.fecha_emision), f.dias_credito)) < hoy);
    const dtes = fac && [...fac, ...(notas || [])];
    const pend = dtes ? dtes.filter((d) => !d.autorizacion).length : 0;
    const vHoy = fac ? suma(fac.filter((f) => diaGT(f.fecha_emision) === hoy), 'total') : 0;
    const mes = `${MESES[Number(hoy.slice(5, 7)) - 1]} ${hoy.slice(0, 4)}`;
    const v = {
      ventas: fac && [qtz(suma(fac, 'total')), `${pl(fac.length,"factura","facturas")} en ${mes} · hoy ${qtz(vHoy)}`],
      cobros: recibos && [qtz(suma(recibos, 'valor')), `${pl(recibos.length,"recibo","recibos")} en ${mes}`],
      cxc: cxc && [qtz(suma(cxc, 'saldo')), `${pl(cxc.length,"factura","facturas")} con saldo`],
      vencido: vencidas && [qtz(suma(vencidas, 'saldo')), vencidas.length ? `${pl(vencidas.length,"factura vencida","facturas vencidas")}` : 'Sin facturas vencidas'],
      dte: dtes && [entero(dtes.length - pend), pend ? `${pl(pend,"pendiente","pendientes")} de certificar` : 'Todos certificados'],
      empleados: !emp.error && [entero(emp.count), 'Nóminas y planillas']
    };
    INDICADORES.forEach((x) => {
      const el = caja.querySelector(`[data-ind="${x.id}"]`); if (!el) return;
      const r = v[x.id];
      el.querySelector('b').textContent = r ? r[0] : '—';
      el.querySelector('small').textContent = r ? r[1] : 'Sin acceso o sin datos';
      el.classList.remove('cargando');
      el.classList.toggle('alerta', x.id === 'vencido' && !!(vencidas && vencidas.length));
    });
    const pie = vista.querySelector('[data-ind-pie]');
    if (pie) pie.innerHTML = `<span class="ind-vivo"></span> En línea · actualizado a las ${new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`;
  }
  function vigilarIndicadores() {
    clearInterval(relojPanel);
    const ir = () => { if (!vista.querySelector('[data-indicadores]')) return clearInterval(relojPanel); if (!document.hidden) cargarIndicadores().catch(() => {}); };
    ir();
    relojPanel = setInterval(ir, 60000);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && vista.querySelector('[data-indicadores]')) cargarIndicadores().catch(() => {}); });

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

  // Cambiar mi clave: cualquier usuario escribe su clave nueva (dos veces) y se renueva su vencimiento.
  document.querySelectorAll('[data-mi-clave]').forEach((b) => b.addEventListener('click', () => {
    const errorClave = (c) => !c || c.length < 8 ? 'La clave debe tener al menos 8 caracteres.' : c.length > 72 ? 'La clave puede tener como máximo 72 caracteres.' : !/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(c) || !/[0-9]/.test(c) ? 'La clave debe tener letras y números.' : '';
    window.UI.formulario({
      titulo: 'Cambiar mi clave',
      campos: [
        { nombre: 'clave', etiqueta: 'Clave nueva', tipo: 'clave', requerido: true, placeholder: 'Mínimo 8, con letras y números', ancho: 'completo' },
        { nombre: 'repetir', etiqueta: 'Repite la clave nueva', tipo: 'clave', requerido: true, ancho: 'completo' }
      ],
      alGuardar: async (d) => {
        const malo = errorClave(d.clave) || (d.clave !== d.repetir ? 'Las dos claves no coinciden.' : '');
        if (malo) throw new Error(malo);
        const { error } = await sb.auth.updateUser({ password: d.clave });
        if (error) throw error;
        await sb.rpc('renovar_vencimiento_clave');
        aviso('Tu clave se cambió');
      }
    });
  }));

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
    if (perfil.rol_id === 'superadministrador' && !perfil.es_global && perfil.organizacion_id) {
      const desde = sb.__fromOriginal || sb.from.bind(sb);
      const l = await desde('localidades').select('id, codigo, nombre_comercial, organizacion_id, activo').eq('organizacion_id', perfil.organizacion_id).eq('activo', true).order('codigo');
      if (!l.error && l.data?.length) empresas = l.data.map((x) => ({ ...x, rol_id: 'superadministrador' }));
    }
    if (perfil.rol_id !== 'superadministrador') {
      const pe = await sb.from('perfil_empresas').select('rol_id, localidad_id, localidades(id, codigo, nombre_comercial, organizacion_id, activo)').eq('perfil_id', perfil.id).eq('activo', true);
      if (!pe.error && pe.data?.length) empresas = pe.data.filter((x) => x.localidades?.activo !== false).map((x) => ({ ...x.localidades, rol_id: x.rol_id })).sort((x, y) => x.codigo.localeCompare(y.codigo));
    }
    rolesCache = rs || [];
    if (await elegirEmpresa()) return;
    modulosEmpresa = null;
    if (perfil.localidad_id && !perfil.es_global) {
      const ma = await sb.rpc('modulos_permitidos', { p_localidad: perfil.localidad_id });
      if (!ma.error && Array.isArray(ma.data)) modulosEmpresa = ma.data;
    }
    aplicarAlcance();
    roles = (rs || []).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || a.nombre.localeCompare(b.nombre));

    $('acceso').hidden = true;
    $('app').hidden = false;
    pintarLateral();
    rutear();
    // Backups automáticos del servidor (script 109): al entrar un administrador, se copian a la carpeta de
    // destino de esta computadora si el navegador ya tiene permiso (si no, desde Backup › «Copiar a la carpeta»).
    if (window.FIN.esAdmin() && window.BACKUP_AUTO) setTimeout(() => { window.BACKUP_AUTO.copiarPendientes().then((n) => { if (n) aviso(n === 1 ? 'Se copió 1 backup automático a la carpeta de respaldos' : `Se copiaron ${n} backups automáticos a la carpeta de respaldos`); }).catch(() => {}); }, 5000);
  }

  // ---------- Barra lateral ----------
  // Además del rol, los módulos que la empresa conectada tiene habilitados (Acceso Sistemas, script 170);
  // Administración siempre, y el Super Administrador Global los ve todos.
  const visibles = () => MODULOS.filter((m) => permisos[m.id] && permisos[m.id].puede_ver &&
    (!modulosEmpresa || m.id === 'administracion' || modulosEmpresa.includes(m.id)));
  const nombreRol = () => perfil.es_global ? 'Super Administrador Global' : (roles.find((r) => r.id === perfil.rol_id) || {}).nombre || perfil.rol_id;
  const primerNombre = () => (perfil.nombre || perfil.correo).split(/[\s@]/)[0];

  function pintarLateral() {
    $('nav-modulos').innerHTML = visibles().map((m) =>
      `<a ${m.enlace ? `href="${esc(m.enlace)}" target="_blank" rel="noopener"` : `href="#/${m.id}"`} data-ruta="${m.id}"><i class="ti ${m.icono}" aria-hidden="true"></i> ${esc(m.corto)}${m.enlace ? ' <i class="ti ti-external-link" aria-hidden="true"></i>' : ''}</a>${m.separador ? '<hr class="nav-separador" aria-hidden="true">' : ''}`).join('');
    $('nav-admin').hidden = !window.FIN.esAdmin();
    const nombre = perfil.nombre || perfil.correo;
    $('quien-nombre').textContent = nombre;
    $('quien-rol').textContent = nombreRol();
    $('avatar').textContent = nombre.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('');
    const hoy = new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('fecha').textContent = hoy.charAt(0).toUpperCase() + hoy.slice(1);
    pintarMarca();
  }

  // Logo de la localidad con que el usuario está conectado (lo más grande que permite la barra
  // superior), después su eslogan y, a la par, el nombre de la localidad. Si la localidad no tiene
  // logo o eslogan (o la imagen no carga) se usan los de su organización; sin ninguno, las iniciales
  // y sin eslogan ese espacio no aparece.
  async function pintarMarca() {
    const caja = $('marca-empresa');
    const leerLoc = async () => {
      if (!perfil.localidad_id) return { data: null };
      const r = await sb.from('localidades').select('codigo, nombre_comercial, logo_ruta, eslogan_ruta').eq('id', perfil.localidad_id).maybeSingle();
      // Sin el script 114 la localidad aún no tiene logo: se lee sin esas columnas.
      return r.error ? sb.from('localidades').select('codigo, nombre_comercial').eq('id', perfil.localidad_id).maybeSingle() : r;
    };
    const [o, l] = await Promise.all([
      perfil.organizacion_id ? sb.from('organizaciones').select('codigo, nombre, logo_ruta, eslogan_ruta').eq('id', perfil.organizacion_id).maybeSingle() : { data: null },
      leerLoc()
    ]);
    const org = o.data;
    const loc = l.data;
    if (!org && !loc) { caja.hidden = true; return; }
    const nombre = loc ? loc.nombre_comercial : org.nombre;
    const base = org ? org.nombre : nombre;
    const palabras = base.split(/\s+/).filter((x) => x.length > 2);
    const iniciales = esc((palabras.length > 1 ? palabras.slice(0, 2).map((x) => x[0]).join('') : base.slice(0, 2)).toUpperCase());
    const url = (ruta) => ruta ? sb.storage.from('organizaciones').getPublicUrl(ruta).data.publicUrl : null;
    const logoOrg = url(org && org.logo_ruta);
    const esloganOrg = url(org && org.eslogan_ruta);
    const logo = url(loc && loc.logo_ruta) || logoOrg;
    const eslogan = url(loc && loc.eslogan_ruta) || esloganOrg;
    caja.innerHTML = `
      ${logo ? `<img class="marca-logo" src="${esc(logo)}" alt="Logo de ${esc(nombre)}">` : ''}
      <span class="marca-iniciales" ${logo ? 'hidden' : ''}>${iniciales}</span>
      ${eslogan ? `<img class="marca-eslogan" src="${esc(eslogan)}" alt="Eslogan de ${esc(nombre)}">` : ''}
      <span class="marca-texto">${await selectorEmpresa(nombre)}<small>${esc([loc && loc.codigo, org && org.nombre].filter(Boolean).join(' · '))}</small></span>`;
    conectarSelector(caja.querySelector('[data-empresa-activa]'));
    // Si la imagen de la localidad no carga, se prueba la de la organización; si tampoco, las iniciales.
    const img = caja.querySelector('.marca-logo');
    if (img) img.addEventListener('error', () => {
      if (logoOrg && img.src !== logoOrg) { img.src = logoOrg; return; }
      img.remove(); caja.querySelector('.marca-iniciales').hidden = false;
    });
    const esl = caja.querySelector('.marca-eslogan');
    if (esl) esl.addEventListener('error', () => { if (esloganOrg && esl.src !== esloganOrg) { esl.src = esloganOrg; return; } esl.remove(); });
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
    // Logo de cada empresa: el de la localidad o, si no tiene, el de su organización (como en el encabezado).
    const logos = new Map();
    try {
      const desde = sb.__fromOriginal || sb.from.bind(sb);
      const url = (ruta) => ruta ? sb.storage.from('organizaciones').getPublicUrl(ruta).data.publicUrl : null;
      const [ls, os] = await Promise.all([
        desde('localidades').select('id, logo_ruta').in('id', empresas.map((x) => x.id)),
        desde('organizaciones').select('id, logo_ruta').in('id', [...new Set(empresas.map((x) => x.organizacion_id).filter(Boolean))])
      ]);
      const deOrg = new Map((os.data || []).map((o) => [o.id, url(o.logo_ruta)]));
      const deLoc = new Map((ls.data || []).map((l) => [l.id, url(l.logo_ruta)]));
      empresas.forEach((x) => logos.set(x.id, { loc: deLoc.get(x.id), org: deOrg.get(x.organizacion_id) }));
    } catch (e) { /* sin logos: se muestran el código y el nombre */ }
    const icono = '<i class="ti ti-building" aria-hidden="true"></i>';
    const logoDe = (x) => { const g = logos.get(x.id) || {}; const src = g.loc || g.org; return src ? `<img src="${esc(src)}" alt="Logo de ${esc(x.nombre_comercial)}" data-org="${esc(g.org || '')}">` : icono; };
    const caja = document.querySelector('[data-empresas]');
    caja.innerHTML = empresas.map((x) => `<button type="button" class="emp-opcion ${x.id === perfil.localidad_id ? 'ultima' : ''}" data-empresa="${x.id}">
        <span class="emp-cod">${esc(x.codigo)}</span><span class="emp-logo">${logoDe(x)}</span><span class="emp-nom"><b>${esc(x.nombre_comercial)}</b><small>${esc(rolDe(x.rol_id))}${x.id === perfil.localidad_id ? ' · última usada' : ''}</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>`).join('');
    // Si el logo de la localidad no carga se prueba el de la organización; si tampoco, el ícono.
    caja.querySelectorAll('.emp-logo img').forEach((img) => img.addEventListener('error', () => {
      if (img.dataset.org && img.src !== img.dataset.org) { img.src = img.dataset.org; return; }
      img.outerHTML = icono;
    }));
    caja.onclick = (e) => { const b = e.target.closest('[data-empresa]'); if (b) { caja.querySelectorAll('button').forEach((x) => { x.disabled = true; }); activar(Number(b.dataset.empresa)); } };
    mostrarAcceso('empresa');
    return true;
  }

  // Regla principal: todo usuario trabaja solo con la empresa a la que está conectado (empresa activa):
  // las consultas de empresas (localidades) y organizaciones de todas las pantallas se limitan a ella.
  // Única excepción: el Super Administrador Global ve todas las organizaciones y empresas en todas las
  // pantallas (cada una empieza en la empresa conectada). En el módulo Administración, el Super
  // Administrador o administrador de una organización ve todas las empresas de su organización.
  function aplicarAlcance() {
    if (!sb.__fromOriginal) sb.__fromOriginal = sb.from.bind(sb);
    const original = sb.__fromOriginal;
    if (!perfil.localidad_id) { sb.from = original; return; }
    if (perfil.es_global && perfil.rol_id === 'superadministrador') { sb.from = original; return; }
    const limite = { localidades: perfil.localidad_id, organizaciones: perfil.organizacion_id };
    const enAdministracion = () => /^#\/administracion(\/|$)/.test(location.hash);
    const adminOrg = ['superadministrador', 'administrador'].includes(perfil.rol_id);
    sb.from = (tabla) => {
      const q = original(tabla);
      if (!(tabla in limite)) return q;
      const select = q.select.bind(q);
      if (enAdministracion() && adminOrg) {
        q.select = (...args) => select(...args).eq(tabla === 'localidades' ? 'organizacion_id' : 'id', perfil.organizacion_id);
        return q;
      }
      q.select = (...args) => select(...args).eq('id', limite[tabla]);
      return q;
    };
  }

  // Empresa activa: selector con las empresas del usuario y su rol (el Super Administrador, todas las
  // activas por organización). Con una sola empresa, solo su nombre.
  async function selectorEmpresa(nombre, donde = 'encabezado') {
    let lista = empresas;
    let grupos = null;
    if (!lista && perfil.rol_id === 'superadministrador' && perfil.es_global) {
      const desde = sb.__fromOriginal || sb.from.bind(sb);
      const [o, l] = await Promise.all([desde('organizaciones').select('id, codigo, nombre').eq('activo', true).order('codigo'),
        desde('localidades').select('id, codigo, nombre_comercial, organizacion_id').eq('activo', true).order('codigo')]);
      lista = l.data || [];
      grupos = (o.data || []).map((x) => ({ o: x, locs: lista.filter((y) => y.organizacion_id === x.id) })).filter((g) => g.locs.length);
    }
    if (!lista || lista.length < 2) return `<b title="${esc(nombre)}">${esc(nombre)}</b>`;
    const rolDe = (r) => (roles.find((x) => x.id === r) || {}).nombre || r;
    const opcion = (x) => `<option value="${x.id}" ${x.id === perfil.localidad_id ? 'selected' : ''}>${esc(x.nombre_comercial)} · ${esc(x.codigo)}${x.rol_id ? ` — ${esc(rolDe(x.rol_id))}` : ''}</option>`;
    return `<label class="empresa-activa" title="Empresa activa: al cambiarla se aplican tu rol y permisos en ella"><span class="oculto">Empresa activa</span>
      <select data-empresa-activa="${donde}" aria-label="Empresa activa">${grupos ? grupos.map((g) => `<optgroup label="${g.o.codigo} · ${esc(g.o.nombre)}">${g.locs.map(opcion).join('')}</optgroup>`).join('') : lista.map(opcion).join('')}</select></label>`;
  }

  // Cambiar la empresa conectada desde un selector (encabezado o Inicio): aplica su rol y recarga.
  function conectarSelector(selEmp) {
    if (!selEmp) return;
    selEmp.addEventListener('change', async () => {
      selEmp.disabled = true;
      const { error } = await sb.rpc('cambiar_empresa_activa', { p_localidad: Number(selEmp.value) });
      if (error) { selEmp.disabled = false; selEmp.value = String(perfil.localidad_id); return aviso(error.message); }
      try { sessionStorage.setItem(CLAVE_EMPRESA, selEmp.value); } catch (e) { /* sin almacenamiento */ }
      location.hash = '#/';
      location.reload();
    });
  }

  // Inicio: la empresa a la que está conectado el usuario, su rol y el cambio de empresa.
  async function pintarConexion() {
    const caja = vista.querySelector('[data-conexion]');
    if (!caja) return;
    const desde = sb.__fromOriginal || sb.from.bind(sb);
    const [l, o] = await Promise.all([
      perfil.localidad_id ? desde('localidades').select('codigo, nombre_comercial').eq('id', perfil.localidad_id).maybeSingle() : { data: null },
      perfil.organizacion_id ? desde('organizaciones').select('codigo, nombre').eq('id', perfil.organizacion_id).maybeSingle() : { data: null }
    ]);
    const loc = l.data;
    const org = o.data;
    if (!loc || !caja.isConnected) return;
    const selector = await selectorEmpresa(loc.nombre_comercial, 'inicio');
    const varias = selector.includes('data-empresa-activa');
    caja.innerHTML = `<span class="cx-icono"><i class="ti ti-building-community" aria-hidden="true"></i></span>
      <div class="cx-texto"><small>Conectado a la empresa</small>
        <b>${esc(loc.codigo)} · ${esc(loc.nombre_comercial)}</b>
        <span>${esc(org ? `${org.codigo} · ${org.nombre}` : '')} · Rol: <b>${esc(nombreRol())}</b>. ${perfil.es_global ? 'Como Super Administrador Global ves todas las organizaciones y empresas; cada pantalla empieza en esta.' : 'Todos los módulos y operaciones corresponden a esta empresa.'}</span></div>
      ${varias ? `<div class="cx-cambiar"><span>Cambiar de empresa</span>${selector}</div>` : ''}`;
    conectarSelector(caja.querySelector('[data-empresa-activa]'));
    caja.hidden = false;
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
    setTimeout(pintarConexion, 0); // después de pintar el panel
    setTimeout(vigilarIndicadores, 0);
    vista.innerHTML = `
      <div class="titulo">
        <div>
          <h1>${saludo()}, ${esc(primerNombre())}</h1>
          <p>Resumen general de la empresa y acceso a los módulos.</p>
        </div>
      </div>
      <section class="conexion" data-conexion hidden></section>

      <div class="indicadores" data-indicadores>
        ${INDICADORES.map((k) => `
          <div class="indicador cargando" data-color="${k.color}" data-ind="${k.id}">
            <div class="indicador-cab"><span>${esc(k.nombre)}</span><i class="ti ${k.icono}" aria-hidden="true"></i></div>
            <b>…</b>
            <small>Leyendo datos…</small>
          </div>`).join('')}
      </div>
      <p class="ind-pie" data-ind-pie></p>

      <h2 class="seccion">Módulos</h2>
      ${lista.length ? '' : '<p>Tu rol no tiene módulos asignados. Pide acceso a un administrador.</p>'}
      <div class="tarjetas">
        ${lista.map((m) => `
          <a class="tarjeta" ${m.enlace ? `href="${esc(m.enlace)}" target="_blank" rel="noopener"` : `href="#/${m.id}"`} data-color="${m.color}">
            <span class="ficha-icono"><i class="ti ${m.icono}" aria-hidden="true"></i></span>
            <h2>${esc(m.nombre)}</h2>
            <p>${esc(m.descripcion)}</p>
            ${m.enlace ? `<div class="chips"><span class="chip">${esc(m.sistema || m.corto)}</span></div>` : `<div class="chips">${gruposDe(m).slice(0, 5).map((g) => `<span class="chip">${esc(g.nombre)}</span>`).join('')}</div>`}
            <div class="tarjeta-pie">
              <span>${m.enlace ? 'Sistema externo · se abre en otra pestaña' : `${cuenta(m)} opciones · ${permisos[m.id].puede_editar ? 'Edición' : 'Solo lectura'}`}</span>
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
              ${subgruposDe(m, g.id).map((s) => s.plano ? `<div class="subgrupo-plano">${listaOpciones(m, s.pantallas, actual)}</div>` : `
                <details class="subgrupo" name="sub-${m.id}-${g.id}" ${contiene(s, actual) || (!subgruposDe(m, g.id).some((x) => contiene(x, actual)) && (subgruposDe(m, g.id).length === 1 || s.abierto)) ? 'open' : ''}>
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
    return `<ul>${pantallas.filter(permitida).map((p) => p.pantallas ? `
      <li>
        <details class="subgrupo anidado" ${contiene(p, actual) || p.abierto ? 'open' : ''}>
          <summary class="subgrupo-titulo"><span><i class="ti ${p.icono}" aria-hidden="true"></i> ${esc(p.subgrupo)}</span><i class="ti ti-chevron-down flecha" aria-hidden="true"></i></summary>
          ${listaOpciones(m, p.pantallas, actual)}
        </details>
      </li>${p.separador ? '<li class="separador" role="separator"></li>' : ''}` : `
      <li><a class="opcion ${p === actual ? 'actual' : ''}" href="#/${m.id}/${p.id}"><span><i class="ti ${p.icono}" aria-hidden="true"></i> ${esc(p.etiqueta || p.nombre)}</span><i class="ti ti-chevron-right" aria-hidden="true"></i></a></li>${p.separador ? '<li class="separador" role="separator"></li>' : ''}`).join('')}</ul>`;
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
    // Módulo que es otro sistema (p. ej. Odontología → Plus Dental): página con el acceso.
    if (m.enlace) {
      migas.innerHTML = `<a href="#/">Panel</a><i class="ti ti-chevron-right" aria-hidden="true"></i><span>${esc(m.nombre)}</span>`;
      vista.innerHTML = `<div class="titulo" data-color="${m.color}"><span class="ficha-icono"><i class="ti ${m.icono}" aria-hidden="true"></i></span><div><h1>${esc(m.nombre)}</h1><p>${esc(m.descripcion)}</p></div></div>
        <p><a class="boton" href="${esc(m.enlace)}" target="_blank" rel="noopener"><i class="ti ti-external-link" aria-hidden="true"></i> Abrir ${esc(m.sistema || m.corto)}</a></p>`;
      return;
    }
    migas.innerHTML = `<a href="#/">Panel</a><i class="ti ti-chevron-right" aria-hidden="true"></i><span>${esc(m.nombre)}</span>`;
    // Las pantallas «destacado» (p. ej. Ventas Inteligentes) van primero en los accesos directos.
    const accesos = gruposDe(m).flatMap((g) => subgruposDe(m, g.id).flatMap((s) => hojas(s).map(({ p, ruta }) => ({ g, ruta, p })))).sort((a, b) => (b.p.destacado ? 1 : 0) - (a.p.destacado ? 1 : 0));
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

  // Pantallas solo del Super Administrador Global («soloGlobal», p. ej. Acceso Sistemas): no aparecen ni se abren para los demás.
  const permitida = (p) => !p.soloGlobal || window.FIN.esGlobal();
  // Pantallas de un subgrupo con su ruta, también las de sus subgrupos anidados.
  function hojas(s, ruta = s.subgrupo) {
    return s.pantallas.filter(permitida).flatMap((p) => p.pantallas ? hojas(p, `${ruta} · ${p.subgrupo}`) : [{ p, ruta }]);
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
    // Una pantalla propia del módulo ("modulo/pantalla") tiene prioridad sobre la de mismo id de otro módulo.
    const fn = window.PANTALLAS[`${m.id}/${p.id}`] || window.PANTALLAS[p.id];
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
