// Catálogos · Iniciales · Usuarios: cada usuario pertenece a una organización y una localidad,
// con su código, rol, estado, vencimiento de clave, empleado, extensión y firma.
// Administradores modifican; solo el Super Administrador cambia roles o modifica a otro Super
// Administrador. Los demás ven su propio usuario (RLS de perfiles).
// Usuarios por crear (migrados de otro sistema, sin correo): el administrador escribe el correo y
// «Crear» genera la cuenta con una clave que se muestra una sola vez (public.crear_usuario_migrado).
(function () {
  const { esc, fecha, fechaCorta, tabla, formulario, filtrar } = window.UI;
  const BUCKET = 'firmas';
  const hoy = () => new Date().toISOString().slice(0, 10);

  async function urlFirma(sb, ruta) {
    if (!ruta) return null;
    const { data } = await sb.storage.from(BUCKET).createSignedUrl(ruta, 3600);
    return data ? data.signedUrl : null;
  }

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS.usuarios = async function (cont, m) {
    const sb = window.FIN.sb;
    const admin = window.FIN.esAdmin();
    const superAdmin = window.FIN.esSuperAdmin();
    const yo = window.FIN.perfil();
    const roles = window.FIN.roles();
    const global = window.FIN.esGlobal ? window.FIN.esGlobal() : superAdmin;
    // El Super Administrador Global modifica a todos; los demás administradores, a los usuarios de su
    // organización que no son Super Administrador (y a sí mismos). Solo los Super Administradores cambian roles.
    const puedeModificar = (u) => admin && (global || ((u.rol_id !== 'superadministrador' || u.id === yo.id) && (!u.organizacion_id || u.organizacion_id === yo.organizacion_id)));
    const estado = { filas: [], sel: null, orgs: [], locs: [], filtroOrg: '', filtroLoc: '', buscar: '', firma: null, migrados: [], claveNueva: null };

    const [o, l] = await Promise.all([
      sb.from('organizaciones').select('id, codigo, nombre').order('codigo'),
      sb.from('localidades').select('id, organizacion_id, codigo, nombre_comercial').order('codigo')
    ]);
    if (o.error || l.error) { cont.innerHTML = `<p class="vacio">${esc((o.error || l.error).message)}</p>`; return; }
    estado.orgs = o.data;
    estado.locs = l.data;
    const org = (id) => estado.orgs.find((x) => x.id === id);
    const loc = (id) => estado.locs.find((x) => x.id === id);
    const rol = (id, x) => x?.es_global ? 'Super Administrador Global' : x && id === 'superadministrador' ? 'Super Administrador (organización)' : (roles.find((r) => r.id === id) || {}).nombre || id;

    cont.innerHTML = '<section class="panel" id="p-usuarios"></section>';
    const panel = cont.querySelector('#p-usuarios');

    async function cargar(seleccion) {
      const { data, error } = await sb.from('perfiles').select('*').order('usuario', { nullsFirst: false }).order('nombre');
      if (error) { panel.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      estado.filas = data;
      const pe = await sb.from('perfil_empresas').select('perfil_id, localidad_id, rol_id, activo');
      estado.pe = pe.error ? null : pe.data || [];
      if (admin) {
        const pm = await sb.from('usuarios_migrados').select('*').is('perfil_id', null).order('usuario_anterior');
        estado.migrados = pm.error ? [] : pm.data;
      }
      const previo = seleccion || (estado.sel && estado.sel.id);
      const vistos = visibles();
      estado.sel = vistos.find((u) => u.id === previo) || vistos[0] || null;
      estado.firma = estado.sel ? await urlFirma(sb, estado.sel.firma_ruta) : null;
      pintar();
    }

    const migradosVisibles = () => estado.migrados.filter((u) =>
      (!estado.filtroOrg || u.organizacion_id === Number(estado.filtroOrg)) &&
      (!estado.filtroLoc || u.localidad_id === Number(estado.filtroLoc) || (u.localidades_adicionales || []).includes(Number(estado.filtroLoc))));

    // Empresas a las que entra el usuario con su rol en cada una; sin el script 96, la empresa del
    // perfil y sus localidades adicionales con el mismo rol.
    const empresasDe = (u) => estado.pe
      ? estado.pe.filter((x) => x.perfil_id === u.id && x.activo).sort((a, b) => ((loc(a.localidad_id) || {}).codigo || '').localeCompare((loc(b.localidad_id) || {}).codigo || ''))
      : [u.localidad_id, ...(u.localidades_adicionales || [])].filter(Boolean).map((id) => ({ localidad_id: id, rol_id: u.rol_id }));
    const visibles = () => estado.filas.filter((u) => (global || !u.organizacion_id || u.organizacion_id === yo.organizacion_id) &&
      (!estado.filtroOrg || u.organizacion_id === Number(estado.filtroOrg)) &&
      (!estado.filtroLoc || u.localidad_id === Number(estado.filtroLoc) || empresasDe(u).some((x) => x.localidad_id === Number(estado.filtroLoc))));
    // «+N» con las otras empresas del usuario y su rol en cada una.
    const masEmpresas = (u) => {
      const otras = empresasDe(u).filter((x) => x.localidad_id !== u.localidad_id);
      return otras.length ? ` <span class="us-mas" title="También en ${esc(otras.map((x) => `${(loc(x.localidad_id) || {}).codigo} (${rol(x.rol_id)})`).join(', '))}">+${otras.length}</span>` : '';
    };

    const empresa = (idOrg, idLoc) => idLoc
      ? `<span class="codigo">${esc((loc(idLoc) || {}).codigo || '')}</span> ${esc((loc(idLoc) || {}).nombre_comercial || '')}`
      : '<span class="estado inactivo">Sin asignar</span>';

    // Localidades adicionales (el usuario también trabaja en ellas): «+N» con sus códigos.
    const adicionales = (lista) => (lista || []).map((id) => (loc(id) || {}).codigo).filter(Boolean);
    const mas = (lista) => { const a = adicionales(lista); return a.length ? ` <span class="us-mas" title="También en ${esc(a.join(', '))}">+${a.length}</span>` : ''; };

    // Una sola lista: usuarios con cuenta y, debajo, los migrados por crear (correo y «Crear» en su fila).
    function pintar() {
      const u = estado.sel;
      const lista = visibles();
      const pendientes = migradosVisibles();
      const locsFiltro = estado.locs.filter((x) => !estado.filtroOrg || x.organizacion_id === Number(estado.filtroOrg));
      const vencidas = lista.filter((x) => x.fecha_vence_clave && x.fecha_vence_clave < hoy()).length;
      const vencida = u && u.fecha_vence_clave && u.fecha_vence_clave < hoy();
      const c = estado.claveNueva;
      panel.innerHTML = `
        <div class="us-barra">
          <label class="us-filtro"><span>Organización</span><select data-filtro="org">
            <option value="">Todas</option>
            ${estado.orgs.map((x) => `<option value="${x.id}" ${String(x.id) === estado.filtroOrg ? 'selected' : ''}>${x.codigo} · ${esc(x.nombre)}</option>`).join('')}
          </select></label>
          <label class="us-filtro"><span>Localidad</span><select data-filtro="loc">
            <option value="">Todas</option>
            ${locsFiltro.map((x) => `<option value="${x.id}" ${String(x.id) === estado.filtroLoc ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre_comercial)}</option>`).join('')}
          </select></label>
          <div class="us-kpis">
            <span><b>${lista.length + pendientes.length}</b> usuarios</span>
            <span><b>${lista.filter((x) => x.activo).length}</b> activos</span>
            ${pendientes.length ? `<span class="us-pend"><b>${pendientes.length}</b> por crear</span>` : ''}
            ${vencidas ? `<span class="us-venc"><b>${vencidas}</b> clave vencida</span>` : ''}
          </div>
          <label class="us-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar usuario, nombre o correo" value="${esc(estado.buscar)}" aria-label="Buscar usuarios"></label>
        </div>
        ${c ? `<div class="um-clave" role="status"><i class="ti ti-key" aria-hidden="true"></i><span>Cuenta creada para <b>${esc(c.nombre)}</b> (${esc(c.correo)}).${c.clave ? ` Clave: <code data-clave>${esc(c.clave)}</code> <button type="button" class="boton secundario-sm" data-accion="copiar-clave"><i class="ti ti-copy" aria-hidden="true"></i> Copiar</button> Se muestra una sola vez y vence hoy: el usuario la cambia al entrar.` : ' Se ligó a la cuenta que ya tenía ese correo.'} Asígnale su rol con «Modificar».</span><button type="button" class="icono-boton" data-accion="cerrar-clave" aria-label="Cerrar"><i class="ti ti-x" aria-hidden="true"></i></button></div>` : ''}
        <div class="tabla-desplazable us-tabla">
          <table class="tabla catalogo" data-tabla="usuarios">
            <thead><tr><th class="angosta">Usuario</th><th>Nombre</th><th>Correo</th><th>Empresa</th><th>Rol</th><th>Estado</th><th class="acciones"></th></tr></thead>
            <tbody>
              ${lista.map((f) => `
                <tr data-id="${f.id}" class="${u && f.id === u.id ? 'seleccionada' : ''} ${f.activo === false ? 'apagada' : ''}" tabindex="0">
                  <td class="angosta"><span class="codigo">${esc(f.usuario) || '—'}</span></td>
                  <td class="fuerte">${esc(f.nombre) || '—'}</td>
                  <td>${esc(f.correo)}</td>
                  <td>${empresa(f.organizacion_id, f.localidad_id)}${masEmpresas(f)}</td>
                  <td>${esc(rol(f.rol_id, f))}</td>
                  <td>${window.UI.estado(f.activo)}${f.fecha_vence_clave && f.fecha_vence_clave < hoy() ? ' <span class="estado vencida">Clave vencida</span>' : ''}</td>
                  <td class="acciones">${puedeModificar(f) ? `<button type="button" class="icono-editar" data-editar="${f.id}" aria-label="Modificar"><i class="ti ti-pencil" aria-hidden="true"></i></button>` : ''}</td>
                </tr>`).join('')}
              ${pendientes.map((x) => `
                <tr data-id="m${x.id}" data-migrado="${x.id}" class="us-por-crear">
                  <td class="angosta"><span class="codigo">${esc(x.usuario_anterior)}</span></td>
                  <td class="fuerte">${esc(x.nombre)}</td>
                  <td><input type="email" class="um-correo" data-correo placeholder="correo@empresa.com" aria-label="Correo de ${esc(x.nombre)}"></td>
                  <td>${empresa(x.organizacion_id, x.localidad_id)}${mas(x.localidades_adicionales)}</td>
                  <td class="tk-tenue" title="Creado en el sistema anterior">Desde ${fechaCorta(x.fecha_creacion_anterior) || '—'}</td>
                  <td><span class="estado us-estado-pend">Por crear</span></td>
                  <td class="acciones"><button type="button" class="boton primario-sm" data-accion="crear-migrado">Crear</button></td>
                </tr>`).join('')}
              ${!lista.length && !pendientes.length ? '<tr><td colspan="7" class="vacio">No hay usuarios con estos filtros.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
        ${u ? `
          <div class="us-ficha">
            <div class="us-ficha-id">
              <span class="us-avatar">${esc((u.usuario || u.nombre || '?').slice(0, 2).toUpperCase())}</span>
              <div><b>${esc(u.nombre) || '—'}</b><small><span class="codigo">${esc(u.usuario) || '—'}</span> · ${esc(u.correo)}</small></div>
            </div>
            <dl class="us-ficha-datos">
              <div><dt>Empresa activa · rol</dt><dd>${u.organizacion_id ? `${(org(u.organizacion_id) || {}).codigo || ""} · ` : ''}${empresa(u.organizacion_id, u.localidad_id)} · ${esc(rol(u.rol_id, u))}</dd></div>
              ${empresasDe(u).length > 1 ? `<div><dt>Empresas y roles</dt><dd class="us-roles">${empresasDe(u).map((x) => `<span class="${x.localidad_id === u.localidad_principal_id ? 'principal' : ''}" title="${x.localidad_id === u.localidad_principal_id ? 'Empresa principal' : ''}">${esc((loc(x.localidad_id) || {}).codigo || '')} ${esc(rol(x.rol_id))}</span>`).join('')}</dd></div>` : ''}
              <div><dt>Creado</dt><dd>${u.creado_en ? new Date(u.creado_en).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '—'}</dd></div>
              <div><dt>Vence clave</dt><dd class="${vencida ? 'pc-rojo' : ''}">${fechaCorta(u.fecha_vence_clave) || '—'}</dd></div>
              <div><dt>Empleado</dt><dd>${esc(u.empleado) || '—'}</dd></div>
              <div><dt>Extensión</dt><dd>${esc(u.extension) || '—'}</dd></div>
              <div><dt>Teléfono</dt><dd>${esc(u.telefono) || '—'}</dd></div>
              <div><dt>Correo reportes</dt><dd>${esc(u.correo_reportes || u.correo) || '—'}</dd></div>
              ${u.usuario_anterior ? `<div><dt>Sist. anterior</dt><dd><span class="codigo">${esc(u.usuario_anterior)}</span>${u.fecha_creacion_anterior ? ` · ${fechaCorta(u.fecha_creacion_anterior)}` : ''}</dd></div>` : ''}
              <div><dt>Firma</dt><dd>${estado.firma ? `<a href="${esc(estado.firma)}" target="_blank" rel="noopener"><img class="us-firma" src="${esc(estado.firma)}" alt="Firma de ${esc(u.nombre)}"></a>` : 'Sin firma'}</dd></div>
            </dl>
            <div class="us-ficha-acciones">
              ${puedeModificar(u) ? '<button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}
              ${puedeModificar(u) ? '<button type="button" class="boton secundario-sm" data-accion="generar"><i class="ti ti-key" aria-hidden="true"></i> Generar usuario</button>' : ''}
              ${puedeModificar(u) ? '<button type="button" class="boton secundario-sm" data-accion="clave"><i class="ti ti-mail" aria-hidden="true"></i> Enviar cambio de clave</button>' : ''}
              <button type="button" class="icono-boton" data-accion="actualizar" title="Actualizar" aria-label="Actualizar"><i class="ti ti-refresh" aria-hidden="true"></i></button>
            </div>
          </div>` : ''}`;
      ajustarAlto();
      filtrar(panel, estado.buscar);
    }

    // La lista ocupa el alto libre de la ventana (sin desplazar la página).
    function ajustarAlto() {
      const t = panel.querySelector('.us-tabla');
      if (!t || !t.isConnected) return;
      const ficha = panel.querySelector('.us-ficha');
      const libre = window.innerHeight - t.getBoundingClientRect().top - (ficha ? ficha.offsetHeight + 12 : 0) - 40;
      t.style.maxHeight = `${Math.max(220, libre)}px`;
      const sobra = document.documentElement.scrollHeight - window.innerHeight;
      if (sobra > 0) t.style.maxHeight = `${Math.max(220, t.offsetHeight - sobra)}px`;
    }
    window.addEventListener('resize', function alto() { if (!panel.isConnected) return window.removeEventListener('resize', alto); ajustarAlto(); });

    let formRef = null; // formulario abierto de Modificar usuario (para leer su tabla de empresas)
    function formUsuario(u) {
      if (!puedeModificar(u)) { window.FIN.aviso('Solo el Super Administrador puede modificar a un Super Administrador.'); return; }
      const propio = u.id === yo.id;
      // Roles activos más los que el usuario ya tiene en alguna empresa (aunque se hayan desactivado).
      const usados = new Set([u.rol_id, ...empresasDe(u).map((x) => x.rol_id)]);
      const rolesActivos = roles.filter((r) => r.activo !== false || usados.has(r.id));
      const firmaActual = estado.sel && estado.sel.id === u.id ? estado.firma : null;
      formulario({
        titulo: `Modificar usuario · ${u.nombre || u.correo}`,
        valores: { ...u, localidad_principal_id: u.localidad_principal_id || u.localidad_id, super_org: u.rol_id === 'superadministrador', firma: firmaActual },
        campos: [
          { nombre: 'usuario', etiqueta: 'Usuario (código)', patron: '[A-Za-z0-9]{2,20}', max: 20,
            placeholder: window.UI.proponerUsuario ? window.UI.proponerUsuario(u.nombre || '', []) || 'Oasturias' : 'Oasturias' },
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
          { nombre: 'organizacion_id', etiqueta: 'Organización', tipo: 'select-numero', requerido: true,
            opciones: estado.orgs.map((x) => ({ valor: x.id, texto: `${x.codigo} · ${x.nombre}` })) },
          { nombre: 'localidad_principal_id', etiqueta: 'Empresa principal', tipo: 'select-numero', requerido: true, opciones: [] },
          // El rol de cada empresa va en la tabla de empresas; el Super Administrador lo es en todas y su
          // rol se cambia aquí (la base de datos impide quitarle el rol al último Super Administrador).
          ...(global && !u.es_global ? [{ nombre: 'super_org', etiqueta: 'Super Administrador de la organización', tipo: 'casilla' }] : []),
          ...(propio ? [] : [{ nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla' }]),
          { nombre: 'fecha_vence_clave', etiqueta: 'Fecha vence clave', tipo: 'fecha' },
          { nombre: 'empleado', etiqueta: 'Empleado' },
          { nombre: 'extension', etiqueta: 'Extensión telefónica' },
          // Destinos por omisión del usuario en los Reportes gerenciales (script 173).
          { nombre: 'telefono', etiqueta: 'Teléfono (WhatsApp)', placeholder: '5555 1234', max: 30 },
          { nombre: 'correo_reportes', etiqueta: 'Correo para reportes', placeholder: u.correo || 'correo@empresa.com', max: 120 },
          { nombre: 'firma', etiqueta: 'Firma', tipo: 'imagen' }
        ],
        alPreparar: (form) => {
          formRef = form;
          const selOrg = form.elements.organizacion_id;
          const selLoc = form.elements.localidad_principal_id;
          const llenar = (idOrg, valor) => {
            const lista = estado.locs.filter((x) => x.organizacion_id === Number(idOrg));
            selLoc.innerHTML = '<option value="">Seleccionar…</option>' + lista.map((x) =>
              `<option value="${x.id}" ${x.id === valor ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre_comercial)}</option>`).join('');
          };
          // Tabla: empresas de la organización, acceso y rol en cada una (el Super Administrador, todas).
          const caja = document.createElement('div');
          caja.className = 'campo completo us-empresas';
          selLoc.closest('label, .campo').after(caja);
          const actuales = new Map(empresasDe(u).map((x) => [x.localidad_id, x.rol_id]));
          const opcionesRol = (val) => rolesActivos.filter((r) => r.id !== 'superadministrador').map((r) => `<option value="${r.id}" ${r.id === val ? 'selected' : ''}>${esc(r.nombre)}</option>`).join('');
          // Un solo Super Administrador por organización (script 100): si ya hay otro, la casilla se bloquea.
          const casSuper = form.elements.super_org;
          const notaSuper = document.createElement('small');
          notaSuper.className = 'us-nota-super';
          if (casSuper) casSuper.closest('label, .campo').append(notaSuper);
          const revisarSuper = (idOrg) => {
            if (!casSuper) return;
            const otro = estado.filas.find((x) => x.id !== u.id && !x.es_global && x.activo && x.rol_id === 'superadministrador' && x.organizacion_id === Number(idOrg));
            casSuper.disabled = !!otro && !casSuper.checked;
            notaSuper.textContent = otro ? `Ya es Super Administrador de esta organización: ${otro.nombre || otro.usuario || otro.correo}. Solo puede haber uno.` : '';
          };
          const tabla = (idOrg) => {
            revisarSuper(idOrg);
            const lista = estado.locs.filter((x) => x.organizacion_id === Number(idOrg));
            const principal = Number(selLoc.value) || null;
            const esSuper = u.es_global || (form.elements.super_org ? form.elements.super_org.checked : u.rol_id === 'superadministrador');
            if (esSuper) { caja.innerHTML = `<span>Empresas</span><p class="us-nota"><i class="ti ti-shield-check" aria-hidden="true"></i> ${u.es_global ? 'Super Administrador Global: acceso total a todas las organizaciones y empresas.' : 'Super Administrador de la organización: entra a todas sus empresas con todos los permisos.'}</p>`; return; }
            caja.innerHTML = `<span>Empresas y rol en cada una</span>
              <div class="us-emp-tabla"><table><thead><tr><th>Acceso</th><th>Empresa</th><th>Rol en la empresa</th></tr></thead>
                <tbody>${lista.map((x) => { const tiene = actuales.has(x.id) || x.id === principal; return `<tr data-emp="${x.id}">
                  <td><input type="checkbox" data-acceso ${tiene ? 'checked' : ''} ${x.id === principal ? 'disabled title="La empresa principal siempre tiene acceso"' : ''} aria-label="Acceso a ${esc(x.codigo)}"></td>
                  <td>${esc(x.codigo)} · ${esc(x.nombre_comercial)}${x.id === principal ? ' <span class="us-mas">principal</span>' : ''}${x.id === u.localidad_id ? ' <span class="us-mas">activa</span>' : ''}</td>
                  <td><select data-rol ${superAdmin ? '' : 'disabled title="Solo el Super Administrador cambia roles"'} ${tiene ? '' : 'hidden'} aria-label="Rol en ${esc(x.codigo)}">${opcionesRol(actuales.get(x.id) || u.rol_id)}</select></td></tr>`; }).join('') || '<tr><td colspan="3" class="vacio">La organización no tiene empresas.</td></tr>'}</tbody></table></div>
              <div class="us-emp-acc"><button type="button" class="boton secundario-sm" data-todas>Todas las empresas</button>${superAdmin ? '<button type="button" class="boton secundario-sm" data-mismo-rol>Mismo rol en todas</button>' : ''}</div>`;
          };
          llenar(u.organizacion_id, u.localidad_principal_id || u.localidad_id);
          tabla(u.organizacion_id);
          selOrg.addEventListener('change', () => { actuales.clear(); llenar(selOrg.value); tabla(selOrg.value); });
          if (form.elements.super_org) form.elements.super_org.addEventListener('change', () => tabla(selOrg.value));
          selLoc.addEventListener('change', () => { caja.querySelectorAll('tr[data-emp]').forEach((tr) => { if (tr.querySelector('[data-acceso]').checked) actuales.set(Number(tr.dataset.emp), tr.querySelector('[data-rol]').value); }); tabla(selOrg.value); });
          caja.addEventListener('change', (e) => { if (e.target.matches('[data-acceso]')) e.target.closest('tr').querySelector('[data-rol]').hidden = !e.target.checked; });
          caja.addEventListener('click', (e) => {
            if (e.target.closest('[data-todas]')) caja.querySelectorAll('tr[data-emp]').forEach((tr) => { tr.querySelector('[data-acceso]').checked = true; tr.querySelector('[data-rol]').hidden = false; });
            if (e.target.closest('[data-mismo-rol]')) { const p = caja.querySelector(`tr[data-emp="${selLoc.value}"] [data-rol]`) || caja.querySelector('[data-rol]'); caja.querySelectorAll('[data-rol]').forEach((x) => { x.value = p.value; }); }
          });
        },
        alGuardar: async (d) => {
          const firma = d.firma;
          delete d.firma;
          // Empresas marcadas en la tabla con su rol.
          // Super Administrador de la organización (lo decide el Global) o rol por empresa.
          const seraSuper = u.es_global || ('super_org' in d ? !!d.super_org : u.rol_id === 'superadministrador');
          delete d.super_org;
          const elegidas = seraSuper ? [] : [...formRef.querySelectorAll('.us-empresas tr[data-emp]')]
            .filter((tr) => tr.querySelector('[data-acceso]').checked || Number(tr.dataset.emp) === d.localidad_principal_id)
            .map((tr) => ({ localidad_id: Number(tr.dataset.emp), rol_id: tr.querySelector('[data-rol]').value }));
          if (!seraSuper && !elegidas.length) throw new Error('Marca al menos una empresa para el usuario.');
          if (seraSuper && u.rol_id !== 'superadministrador') d.rol_id = 'superadministrador';
          if (!seraSuper && u.rol_id === 'superadministrador') d.rol_id = (elegidas.find((x) => x.localidad_id === d.localidad_principal_id) || elegidas[0]).rol_id;
          if (elegidas.some((x) => !x.rol_id)) throw new Error('Elige el rol de cada empresa marcada.');
          const cambiaOrg = d.organizacion_id !== u.organizacion_id;
          // La empresa activa sigue si aún tiene acceso; si no (o cambió la organización), pasa a la principal.
          if (cambiaOrg || (!seraSuper && !elegidas.some((x) => x.localidad_id === u.localidad_id))) d.localidad_id = d.localidad_principal_id;
          if (cambiaOrg) d.localidades_adicionales = [];
          d.telefono = String(d.telefono || '').trim() || null;
          d.correo_reportes = String(d.correo_reportes || '').trim().toLowerCase() || null;
          if (d.correo_reportes && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.correo_reportes)) throw new Error('El correo para reportes no es válido.');
          if (!('telefono' in u)) { if (d.telefono || d.correo_reportes) throw new Error('Falta ejecutar en Supabase el script 173 (teléfono y correo de los usuarios).'); delete d.telefono; delete d.correo_reportes; }
          const { error } = await sb.from('perfiles').update(d).eq('id', u.id);
          if (error) {
            if (/perfiles_usuario_key|perfiles_usuario_unico|duplicate/i.test(error.message)) throw new Error(`Ya existe otro usuario con el código ${d.usuario}.`);
            if (/perfiles_usuario_check/i.test(error.message)) throw new Error('El código solo admite letras y números (2 a 20).');
            if (/Super Administrador/i.test(error.message)) throw new Error(error.message.replace(/\.?$/, '.'));
            if (/perfiles_activo_con_localidad/i.test(error.message)) throw new Error('Un usuario activo debe tener organización y localidad.');
            if (/perfiles_localidad_fkey/i.test(error.message)) throw new Error('La localidad no pertenece a la organización elegida.');
            throw error;
          }
          // Empresas del usuario: se quitan las desmarcadas, se agregan las nuevas y se cambia el rol
          // (solo el Super Administrador) de las que ya tenía.
          if (estado.pe && !seraSuper) {
            const { data: antes } = await sb.from('perfil_empresas').select('localidad_id, rol_id').eq('perfil_id', u.id);
            const previas = new Map((antes || []).map((x) => [x.localidad_id, x.rol_id]));
            // Solo se quitan empresas que se ven en la tabla (un usuario limitado a su empresa no toca las demás).
            const enTabla = new Set(estado.locs.map((x) => x.id));
            const quitar = [...previas.keys()].filter((id) => enTabla.has(id) && !elegidas.some((x) => x.localidad_id === id));
            if (quitar.length) { const r = await sb.from('perfil_empresas').delete().eq('perfil_id', u.id).in('localidad_id', quitar); if (r.error) throw r.error; }
            const nuevas = elegidas.filter((x) => !previas.has(x.localidad_id));
            if (nuevas.length) { const r = await sb.from('perfil_empresas').insert(nuevas.map((x) => ({ perfil_id: u.id, localidad_id: x.localidad_id, rol_id: superAdmin ? x.rol_id : (d.rol_id || u.rol_id) }))); if (r.error) throw r.error; }
            if (superAdmin) {
              for (const x of elegidas.filter((y) => previas.has(y.localidad_id) && previas.get(y.localidad_id) !== y.rol_id)) {
                const r = await sb.from('perfil_empresas').update({ rol_id: x.rol_id }).eq('perfil_id', u.id).eq('localidad_id', x.localidad_id);
                if (r.error) throw r.error;
              }
            }
          }
          let fallo = null;
          if (firma && (firma.archivo || firma.quitar)) {
            try {
              let ruta = null;
              if (firma.archivo) {
                const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[firma.archivo.type];
                ruta = `${u.id}/firma-${Date.now()}.${ext}`;
                const up = await sb.storage.from(BUCKET).upload(ruta, firma.archivo, { contentType: firma.archivo.type });
                if (up.error) throw new Error(up.error.message || 'error del almacenamiento');
              }
              const r = await sb.from('perfiles').update({ firma_ruta: ruta }).eq('id', u.id);
              if (r.error) throw r.error;
              if (u.firma_ruta) await sb.storage.from(BUCKET).remove([u.firma_ruta]);
            } catch (err) { fallo = err; }
          }
          window.FIN.aviso(fallo ? `Usuario guardado, pero no se pudo guardar la firma: ${fallo.message}` : 'Usuario guardado');
          // Si cambió su propio rol o su empresa, se recarga para aplicar los nuevos permisos.
          if (propio) { const { data: yoAhora } = await sb.from('perfiles').select('rol_id, localidad_id').eq('id', u.id).maybeSingle(); if (yoAhora && (yoAhora.rol_id !== u.rol_id || yoAhora.localidad_id !== u.localidad_id)) { location.reload(); return; } }
          await cargar(u.id);
        }
      });
    }

    cont.addEventListener('click', async (e) => {
      const accion = e.target.closest('[data-accion]');
      if (accion) {
        const a = accion.dataset.accion;
        if (a === 'modificar') formUsuario(estado.sel);
        if (a === 'actualizar') { await cargar(); window.FIN.aviso('Datos actualizados'); }
        if (a === 'cerrar-clave') { estado.claveNueva = null; pintar(); }
        if (a === 'copiar-clave') { try { await navigator.clipboard.writeText(estado.claveNueva.clave); window.FIN.aviso('Clave copiada'); } catch { window.FIN.aviso('Selecciona la clave y cópiala'); } }
        if (a === 'crear-migrado') {
          const tr = accion.closest('tr[data-migrado]');
          const x = estado.migrados.find((y) => String(y.id) === tr.dataset.migrado);
          const correo = tr.querySelector('[data-correo]').value.trim();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) { window.FIN.aviso('Escribe un correo válido.'); tr.querySelector('[data-correo]').focus(); return; }
          accion.disabled = true;
          const { data, error } = await sb.rpc('crear_usuario_migrado', { p_migrado: x.id, p_correo: correo });
          if (error) { accion.disabled = false; window.FIN.aviso(window.UI.traducirError(error)); return; }
          estado.claveNueva = { nombre: x.nombre, correo, clave: data };
          const nuevo = await sb.from('perfiles').select('id').eq('correo', correo.toLowerCase()).maybeSingle();
          await cargar(nuevo.data?.id);
          return;
        }
        if (a === 'generar') location.hash = `#/${m.id}/generar-usuario/${estado.sel.id}`;
        if (a === 'clave') {
          const { error } = await sb.auth.resetPasswordForEmail(estado.sel.correo, { redirectTo: window.FIN.urlSitio });
          window.FIN.aviso(error ? window.UI.traducirError(error) : `Se envió a ${estado.sel.correo} el enlace para cambiar la clave`);
        }
        return;
      }
      const ed = e.target.closest('[data-editar]');
      if (ed) return formUsuario(estado.filas.find((x) => x.id === ed.dataset.editar));
      const tr = e.target.closest('table[data-tabla=usuarios] tr[data-id]');
      if (tr && !tr.dataset.migrado && (!estado.sel || tr.dataset.id !== estado.sel.id)) {
        estado.sel = estado.filas.find((x) => x.id === tr.dataset.id);
        estado.firma = await urlFirma(sb, estado.sel.firma_ruta);
        pintar();
      }
    });
    cont.addEventListener('change', (e) => {
      const f = e.target.dataset.filtro;
      if (!f) return;
      if (f === 'org') { estado.filtroOrg = e.target.value; estado.filtroLoc = ''; }
      else estado.filtroLoc = e.target.value;
      pintar();
    });
    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-buscar]')) return;
      estado.buscar = e.target.value;
      filtrar(panel, estado.buscar);
    });
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('tr[data-id]')) e.target.click();
    });

    cargar();
  };
})();
