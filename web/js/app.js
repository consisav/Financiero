// Financiero: inicio de sesión con Supabase Auth y tablero de módulos filtrado por rol.
// Rutas: #/ módulos, #/<modulo> grupos del módulo, #/usuarios administración (solo administrador).
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
    aviso('Contraseña actualizada');
    history.replaceState(null, '', urlSitio);
    await cargarSesion();
  });

  document.querySelectorAll('[data-salir]').forEach((b) => b.addEventListener('click', () => sb.auth.signOut()));

  // ---------- Sesión ----------
  let recuperando = false;
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

    const [{ data: pm }, { data: rs }] = await Promise.all([
      sb.from('rol_modulos').select('modulo, puede_ver, puede_editar').eq('rol_id', perfil.rol_id),
      sb.from('roles').select('id, nombre').order('nombre')
    ]);
    permisos = Object.fromEntries((pm || []).map((x) => [x.modulo, x]));
    roles = rs || [];

    $('acceso').hidden = true;
    $('app').hidden = false;
    const rol = roles.find((r) => r.id === perfil.rol_id);
    $('quien').textContent = `${perfil.nombre || perfil.correo} · ${rol ? rol.nombre : perfil.rol_id}`;
    $('ir-usuarios').hidden = perfil.rol_id !== 'administrador';
    rutear();
  }

  // ---------- Tablero ----------
  const vista = $('vista');
  const migas = $('migas');
  const visibles = () => MODULOS.filter((m) => permisos[m.id] && permisos[m.id].puede_ver);
  const cuenta = (m) => Object.values(m.opciones).reduce((n, l) => n + l.length, 0);

  function inicio() {
    migas.innerHTML = '<span>Inicio</span>';
    const lista = visibles();
    vista.innerHTML = `
      <h1>Módulos</h1>
      <p class="sub">Elige un módulo para ver sus grupos de operaciones.</p>
      ${lista.length ? '' : '<p>Tu rol no tiene módulos asignados. Pide acceso a un administrador.</p>'}
      <div class="tarjetas">
        ${lista.map((m) => `
          <a class="tarjeta" href="#/${m.id}">
            <i class="ti ${m.icono}" aria-hidden="true"></i>
            <h2>${esc(m.nombre)}</h2>
            <p>${esc(m.descripcion)}</p>
            <span class="meta">${GRUPOS.length} grupos · ${cuenta(m)} opciones · ${permisos[m.id].puede_editar ? 'edición' : 'solo lectura'}</span>
          </a>`).join('')}
      </div>`;
  }

  function modulo(m) {
    migas.innerHTML = `<a href="#/">Inicio</a><i class="ti ti-chevron-right" aria-hidden="true"></i><span>${esc(m.nombre)}</span>`;
    vista.innerHTML = `
      <h1><i class="ti ${m.icono}" aria-hidden="true"></i> ${esc(m.nombre)}</h1>
      <p class="sub">${esc(m.descripcion)}${permisos[m.id].puede_editar ? '' : ' · Solo lectura'}</p>
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

  // ---------- Usuarios (administrador) ----------
  async function usuarios() {
    migas.innerHTML = '<a href="#/">Inicio</a><i class="ti ti-chevron-right" aria-hidden="true"></i><span>Usuarios</span>';
    vista.innerHTML = '<h1><i class="ti ti-user-cog" aria-hidden="true"></i> Usuarios</h1><p class="sub">Cargando…</p>';
    const { data, error } = await sb.from('perfiles').select('*').order('creado_en');
    if (error) { vista.querySelector('.sub').textContent = traducir(error); return; }
    vista.innerHTML = `
      <h1><i class="ti ti-user-cog" aria-hidden="true"></i> Usuarios</h1>
      <p class="sub">Activa las cuentas nuevas y asigna su rol.</p>
      <div class="tabla-envoltura">
        <table class="tabla">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Activo</th></tr></thead>
          <tbody>
            ${data.map((u) => `
              <tr data-id="${u.id}">
                <td>${esc(u.nombre) || '—'}</td>
                <td>${esc(u.correo)}</td>
                <td><select data-campo="rol_id" ${u.id === perfil.id ? 'disabled' : ''}>
                  ${roles.map((r) => `<option value="${r.id}" ${r.id === u.rol_id ? 'selected' : ''}>${esc(r.nombre)}</option>`).join('')}
                </select></td>
                <td><input type="checkbox" data-campo="activo" ${u.activo ? 'checked' : ''} ${u.id === perfil.id ? 'disabled' : ''} aria-label="Activo"></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  vista.addEventListener('change', async (e) => {
    const campo = e.target.dataset.campo;
    if (!campo) return;
    const id = e.target.closest('tr').dataset.id;
    const valor = campo === 'activo' ? e.target.checked : e.target.value;
    const { error } = await sb.from('perfiles').update({ [campo]: valor }).eq('id', id);
    if (error) { aviso(traducir(error)); usuarios(); } else aviso('Cambio guardado');
  });

  vista.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-opcion]');
    if (b) aviso(`${b.dataset.grupo} › ${b.dataset.opcion}: en construcción.`);
  });

  function rutear() {
    if (!perfil || !perfil.activo) return;
    const id = location.hash.replace(/^#\/?/, '');
    if (id === 'usuarios' && perfil.rol_id === 'administrador') usuarios();
    else {
      const m = visibles().find((x) => x.id === id);
      m ? modulo(m) : inicio();
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', rutear);
})();
