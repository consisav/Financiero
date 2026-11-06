// Catálogos · Usuarios · Generar clave (solo administrador).
// Usuario = iniciales de los nombres + primer apellido completo: Oliver Asturias → Oasturias,
// Juan Carlos Tut → JCtut. La clave la genera Supabase (public.generar_clave), se muestra una
// sola vez y vence hoy, para que el usuario la cambie al entrar.
(function () {
  const { esc } = window.UI;
  const PARTICULAS = ['de', 'del', 'la', 'las', 'los', 'y', 'san', 'van', 'von', 'da', 'do', 'dos'];

  // Propone el código; con 4 o más palabras se asume "nombre nombre apellido apellido".
  function proponerUsuario(nombre, existentes) {
    const palabras = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
    // "de León" → "deleon": una partícula se une a la palabra siguiente.
    const partes = [];
    for (let i = 0; i < palabras.length; i++) {
      if (PARTICULAS.includes(palabras[i]) && i < palabras.length - 1 && partes.length) {
        let compuesta = palabras[i];
        while (PARTICULAS.includes(palabras[i + 1]) && i < palabras.length - 2) compuesta += palabras[++i];
        partes.push(compuesta + palabras[++i]);
      } else partes.push(palabras[i]);
    }
    if (!partes.length) return '';
    const n = partes.length;
    const iApellido = n >= 4 ? n - 2 : n - 1;
    const nombres = n === 1 ? [] : partes.slice(0, iApellido);
    const base = (nombres.map((p) => p[0].toUpperCase()).join('') + partes[iApellido]).slice(0, 20);
    const usados = new Set(existentes.map((x) => (x || '').toLowerCase()));
    if (!usados.has(base.toLowerCase())) return base;
    for (let k = 2; ; k++) {
      const c = base.slice(0, 20 - String(k).length) + k;
      if (!usados.has(c.toLowerCase())) return c;
    }
  }
  window.UI.proponerUsuario = proponerUsuario;

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['generar-usuario'] = async function (cont, m, preseleccion) {
    const sb = window.FIN.sb;
    if (!window.FIN.esAdmin()) {
      cont.innerHTML = '<p class="vacio">Solo un administrador puede generar usuarios y claves.</p>';
      return;
    }
    const estado = { filas: [], sel: null, buscar: '', clave: null, confirmar: false, nota: '' };
    const superAdmin = window.FIN.esSuperAdmin();
    const yo = window.FIN.perfil();
    const errorClave = (c) => !c || c.length < 8 ? 'La clave debe tener al menos 8 caracteres.' : c.length > 72 ? 'La clave puede tener como máximo 72 caracteres.' : !/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(c) || !/[0-9]/.test(c) ? 'La clave debe tener letras y números.' : '';

    async function cargar(id) {
      const { data, error } = await sb.from('perfiles').select('id, nombre, correo, usuario, activo, fecha_vence_clave').order('nombre');
      if (error) { cont.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      estado.filas = data;
      estado.sel = data.find((u) => u.id === id) || (estado.sel && data.find((u) => u.id === estado.sel.id)) || data[0] || null;
      pintar();
    }

    function pintar() {
      const q = estado.buscar.trim().toLowerCase();
      const lista = estado.filas.filter((x) => !q || [x.nombre, x.correo, x.usuario].some((t) => (t || '').toLowerCase().includes(q)));
      // Si la búsqueda oculta al usuario elegido, se elige el primero que coincide.
      if (lista.length && !lista.includes(estado.sel)) Object.assign(estado, { sel: lista[0], clave: null, confirmar: false, nota: '' });
      const u = lista.length ? estado.sel : null;
      const notaUsuario = estado.nota || (u && u.usuario ? 'El usuario ya tiene código de usuario. «Generar usuario» lo recalcula con la regla.' : 'Todavía no tiene código de usuario.');
      cont.innerHTML = `
        <section class="panel generar">
          <p class="sub">Crea el código de usuario y la clave con los que la persona entra al sistema. La clave solo se muestra al generarla.</p>
          <label class="campo"><span>Buscar usuario</span><input type="search" data-buscar placeholder="Nombre, correo o usuario" value="${esc(estado.buscar)}"></label>
          <label class="campo"><span>Usuario *</span><select data-sel>
            ${lista.map((x) => `<option value="${x.id}" ${u && x.id === u.id ? 'selected' : ''}>${esc(x.nombre || x.correo)}${x.usuario ? ` · ${esc(x.usuario)}` : ''}${x.activo ? '' : ' (inactivo)'}</option>`).join('') || '<option value="">Sin coincidencias</option>'}
          </select></label>
          ${u ? `
            <div class="paso">
              <span class="paso-num">1</span>
              <div class="paso-cuerpo">
                <h3>Usuario</h3>
                <div class="paso-fila">
                  <input type="text" class="codigo-usuario" value="${esc(u.usuario || '')}" placeholder="Sin usuario" readonly aria-label="Código de usuario">
                  <button type="button" class="boton secundario-sm" data-accion="generar-usuario">Generar usuario</button>
                </div>
                <small>${esc(notaUsuario)} Regla: iniciales de los nombres + primer apellido (Oliver Asturias → Oasturias).</small>
              </div>
            </div>
            <div class="paso">
              <span class="paso-num">2</span>
              <div class="paso-cuerpo">
                <h3>Clave</h3>
                <div class="paso-fila">
                  ${estado.clave
                    ? `<input type="text" class="codigo-usuario clave-visible" value="${esc(estado.clave)}" readonly aria-label="Clave generada"><button type="button" class="boton secundario-sm" data-accion="copiar"><i class="ti ti-copy" aria-hidden="true"></i> Copiar</button>`
                    : `<input type="password" class="codigo-usuario" value="••••••••••" readonly aria-label="Clave oculta" tabindex="-1">
                       <button type="button" class="boton primario-sm" data-accion="generar-clave">${estado.confirmar ? 'Confirmar: generar clave nueva' : 'Generar clave'}</button>`}
                </div>
                <small>${estado.clave
                  ? 'Anótala o cópiala ahora: no se vuelve a mostrar. Al entrar con ella, el sistema le pedirá crear una clave propia.'
                  : estado.confirmar
                    ? 'La clave actual dejará de funcionar. Pulsa de nuevo para confirmar.'
                    : 'La clave actual no se puede ver. «Generar clave» le pondrá una clave nueva.'}</small>
              </div>
            </div>
            ${superAdmin || u.id === yo.id ? `
            <div class="paso">
              <span class="paso-num">3</span>
              <div class="paso-cuerpo">
                <h3>Clave personalizada ${u.id === yo.id ? '(tu clave)' : ''}</h3>
                <form class="paso-fila clave-propia" data-clave-propia autocomplete="off">
                  <input type="password" name="clave" class="codigo-usuario" placeholder="Clave nueva" autocomplete="new-password" minlength="8" aria-label="Clave nueva">
                  <input type="password" name="repetir" class="codigo-usuario" placeholder="Repite la clave" autocomplete="new-password" aria-label="Repite la clave">
                  <button type="button" class="icono-boton" data-accion="ver-clave" title="Mostrar u ocultar" aria-label="Mostrar u ocultar la clave"><i class="ti ti-eye" aria-hidden="true"></i></button>
                  <button type="submit" class="boton primario-sm">Asignar clave</button>
                </form>
                ${u.id === yo.id ? '' : '<label class="pc-check clave-cambiar"><input type="checkbox" name="cambiar" checked> Pedir que la cambie al entrar</label>'}
                <small>Mínimo 8 caracteres, con letras y números. ${u.id === yo.id ? 'Se guarda como tu clave y vence en 90 días.' : 'Comunícasela al usuario en persona; si marcas «Pedir que la cambie al entrar», creará una propia al entrar.'}</small>
              </div>
            </div>` : ''}` : ''}
        </section>`;
    }

    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-buscar]')) return;
      estado.buscar = e.target.value;
      const pos = e.target.selectionStart;
      pintar();
      const b = cont.querySelector('[data-buscar]');
      b.focus();
      b.setSelectionRange(pos, pos);
    });
    cont.addEventListener('change', (e) => {
      if (!e.target.matches('[data-sel]') || !e.target.value) return;
      estado.sel = estado.filas.find((x) => x.id === e.target.value);
      Object.assign(estado, { clave: null, confirmar: false, nota: '' });
      pintar();
    });
    // Clave personalizada: para otro usuario la asigna el Super Administrador (asignar_clave, script 98);
    // la propia se cambia en Supabase Auth y renueva su vencimiento.
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('[data-clave-propia]')) return;
      e.preventDefault();
      const f = e.target;
      const u = estado.sel;
      const clave = f.elements.clave.value;
      const malo = errorClave(clave) || (clave !== f.elements.repetir.value ? 'Las dos claves no coinciden.' : '');
      if (malo) { window.FIN.aviso(malo); return; }
      const boton = f.querySelector('[type=submit]');
      boton.disabled = true;
      let error;
      if (u.id === yo.id) {
        ({ error } = await sb.auth.updateUser({ password: clave }));
        if (!error) await sb.rpc('renovar_vencimiento_clave');
      } else {
        const cambiar = cont.querySelector('.clave-cambiar input')?.checked ?? true;
        ({ error } = await sb.rpc('asignar_clave', { p_usuario: u.id, p_clave: clave, p_cambiar: cambiar }));
      }
      boton.disabled = false;
      if (error) { window.FIN.aviso(/asignar_clave/i.test(error.message) && /find|exist/i.test(error.message) ? 'Falta instalar el script 98 en Supabase.' : window.UI.traducirError(error)); return; }
      f.reset();
      window.FIN.aviso(u.id === yo.id ? 'Tu clave se cambió' : `Clave asignada a ${u.nombre || u.correo}`);
      await cargar(u.id);
    });
    cont.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-accion]');
      if (!a) return;
      const u = estado.sel;
      if (a.dataset.accion === 'generar-usuario') {
        const propuesta = proponerUsuario(u.nombre || '', estado.filas.filter((x) => x.id !== u.id).map((x) => x.usuario));
        if (!propuesta || propuesta.length < 2) { window.FIN.aviso('El usuario necesita un nombre completo para generar su código.'); return; }
        if (propuesta === u.usuario) { estado.nota = 'El usuario ya tiene el código que corresponde.'; return pintar(); }
        a.disabled = true;
        const { error } = await sb.from('perfiles').update({ usuario: propuesta }).eq('id', u.id);
        if (error) { a.disabled = false; window.FIN.aviso(/perfiles_usuario_check|unico|duplicate/i.test(error.message) ? 'Falta instalar el script 7 en Supabase o el código ya existe.' : window.UI.traducirError(error)); return; }
        estado.nota = `Se asignó el usuario ${propuesta}.`;
        window.FIN.aviso(`Usuario ${propuesta} asignado`);
        await cargar(u.id);
      }
      if (a.dataset.accion === 'generar-clave') {
        if (!estado.confirmar) { estado.confirmar = true; return pintar(); }
        a.disabled = true;
        const { data, error } = await sb.rpc('generar_clave', { p_usuario: u.id });
        if (error) {
          a.disabled = false;
          window.FIN.aviso(/generar_clave/i.test(error.message) && /find|exist/i.test(error.message) ? 'Falta instalar el script 7 en Supabase.' : window.UI.traducirError(error));
          return;
        }
        Object.assign(estado, { clave: data, confirmar: false });
        window.FIN.aviso('Clave generada');
        pintar();
      }
      if (a.dataset.accion === 'ver-clave') { cont.querySelectorAll('[data-clave-propia] input').forEach((x) => { x.type = x.type === 'password' ? 'text' : 'password'; }); return; }
      if (a.dataset.accion === 'copiar') {
        try { await navigator.clipboard.writeText(estado.clave); window.FIN.aviso('Clave copiada'); }
        catch { cont.querySelector('.clave-visible').select(); }
      }
    });

    cargar(preseleccion);
  };
})();
