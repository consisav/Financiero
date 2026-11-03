// Catálogos · Iniciales · Usuarios: cada usuario pertenece a una organización y una localidad,
// con su código, rol, estado, vencimiento de clave, empleado, extensión y firma.
// Solo el administrador modifica; los demás ven su propio usuario (RLS de perfiles).
(function () {
  const { esc, fecha, fechaCorta, tabla, formulario, filtrar } = window.UI;
  const BUCKET = 'firmas';
  const hoy = () => new Date().toISOString().slice(0, 10);

  const dato = (etiqueta, valor, completo) =>
    `<div class="dato${completo ? ' completo' : ''}"><span>${esc(etiqueta)}</span><b>${valor || '—'}</b></div>`;

  async function urlFirma(sb, ruta) {
    if (!ruta) return null;
    const { data } = await sb.storage.from(BUCKET).createSignedUrl(ruta, 3600);
    return data ? data.signedUrl : null;
  }

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS.usuarios = async function (cont, m) {
    const sb = window.FIN.sb;
    const admin = window.FIN.esAdmin();
    const yo = window.FIN.perfil();
    const roles = window.FIN.roles();
    const estado = { filas: [], sel: null, orgs: [], locs: [], filtroOrg: '', filtroLoc: '', buscar: '', firma: null };

    const [o, l] = await Promise.all([
      sb.from('organizaciones').select('id, codigo, nombre').order('codigo'),
      sb.from('localidades').select('id, organizacion_id, codigo, nombre_comercial').order('codigo')
    ]);
    if (o.error || l.error) { cont.innerHTML = `<p class="vacio">${esc((o.error || l.error).message)}</p>`; return; }
    estado.orgs = o.data;
    estado.locs = l.data;
    const org = (id) => estado.orgs.find((x) => x.id === id);
    const loc = (id) => estado.locs.find((x) => x.id === id);
    const rol = (id) => (roles.find((r) => r.id === id) || {}).nombre || id;

    cont.innerHTML = '<section class="panel" id="p-usuarios"></section>';
    const panel = cont.querySelector('#p-usuarios');

    async function cargar(seleccion) {
      const { data, error } = await sb.from('perfiles').select('*').order('usuario', { nullsFirst: false }).order('nombre');
      if (error) { panel.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      estado.filas = data;
      const previo = seleccion || (estado.sel && estado.sel.id);
      estado.sel = data.find((u) => u.id === previo) || data[0] || null;
      estado.firma = estado.sel ? await urlFirma(sb, estado.sel.firma_ruta) : null;
      pintar();
    }

    const visibles = () => estado.filas.filter((u) =>
      (!estado.filtroOrg || u.organizacion_id === Number(estado.filtroOrg)) &&
      (!estado.filtroLoc || u.localidad_id === Number(estado.filtroLoc)));

    function pintar() {
      const u = estado.sel;
      const locsFiltro = estado.locs.filter((x) => !estado.filtroOrg || x.organizacion_id === Number(estado.filtroOrg));
      const vencida = u && u.fecha_vence_clave && u.fecha_vence_clave < hoy();
      panel.innerHTML = `
        <div class="panel-cab">
          <h2>Usuarios generales</h2>
          <div class="panel-acciones">
            <label class="selector-org">Organización <select data-filtro="org">
              <option value="">Todas</option>
              ${estado.orgs.map((x) => `<option value="${x.id}" ${String(x.id) === estado.filtroOrg ? 'selected' : ''}>${x.codigo} · ${esc(x.nombre)}</option>`).join('')}
            </select></label>
            <label class="selector-org">Localidad <select data-filtro="loc">
              <option value="">Todas</option>
              ${locsFiltro.map((x) => `<option value="${x.id}" ${String(x.id) === estado.filtroLoc ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre_comercial)}</option>`).join('')}
            </select></label>
          </div>
        </div>
        <input type="search" class="buscar" data-buscar placeholder="Buscar usuario, nombre o correo" value="${esc(estado.buscar)}">
        ${tabla({
          id: 'usuarios', editable: admin, seleccionado: u && u.id, vacio: 'No hay usuarios con estos filtros.',
          columnas: [
            { titulo: 'Usuario', valor: (f) => `<span class="codigo">${esc(f.usuario) || '—'}</span>`, clase: 'angosta' },
            { titulo: 'Nombre', valor: (f) => esc(f.nombre) || '—', clase: 'fuerte' },
            { titulo: 'Correo', valor: (f) => esc(f.correo) },
            { titulo: 'Organización · localidad', valor: (f) => f.localidad_id
                ? `${esc((org(f.organizacion_id) || {}).nombre)} · <span class="codigo">${esc((loc(f.localidad_id) || {}).codigo)}</span>`
                : '<span class="estado inactivo">Sin asignar</span>' },
            { titulo: 'Rol', valor: (f) => esc(rol(f.rol_id)) },
            { titulo: 'Estado', valor: (f) => window.UI.estado(f.activo) }
          ],
          filas: visibles()
        })}
        ${u ? `
          <div class="detalle">
            <div class="auditoria">
              ${window.UI.estado(u.activo)}
              <span>Creado el <b>${fecha(u.creado_en)}</b></span>
              ${vencida ? '<span class="estado vencida">Clave vencida</span>' : ''}
              <span class="auditoria-acciones">
                ${admin ? '<button type="button" class="boton secundario-sm" data-accion="clave"><i class="ti ti-key" aria-hidden="true"></i> Enviar cambio de clave</button>' : ''}
                ${admin ? '<button type="button" class="boton primario-sm" data-accion="modificar">Modificar</button>' : ''}
                <button type="button" class="boton secundario-sm" data-accion="actualizar">Actualizar</button>
                ${admin ? '<button type="button" class="boton secundario-sm" data-accion="generar"><i class="ti ti-key" aria-hidden="true"></i> Generar usuario</button>' : ''}
              </span>
            </div>
            <div class="datos-con-firma">
              <div class="datos">
                ${dato('Usuario', `<span class="codigo">${esc(u.usuario) || '—'}</span>`)}
                ${dato('Nombre', esc(u.nombre))}
                ${dato('Correo', esc(u.correo))}
                ${dato('Rol', esc(rol(u.rol_id)))}
                ${dato('Organización', u.organizacion_id && `${org(u.organizacion_id).codigo} · ${esc(org(u.organizacion_id).nombre)}`)}
                ${dato('Localidad', u.localidad_id && `${esc(loc(u.localidad_id).codigo)} · ${esc(loc(u.localidad_id).nombre_comercial)}`)}
                ${dato('Fecha creación', u.creado_en && new Date(u.creado_en).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-'))}
                ${dato('Fecha vence clave', fechaCorta(u.fecha_vence_clave))}
                ${dato('Empleado', esc(u.empleado))}
                ${dato('Estado', u.activo ? 'ACTIVO' : 'INACTIVO')}
                ${dato('Extensión telefónica', esc(u.extension))}
              </div>
              <figure class="imagen-org firma">
                <figcaption>Firma</figcaption>
                <div class="imagen-marco">${estado.firma ? `<img src="${esc(estado.firma)}" alt="Firma de ${esc(u.nombre)}">` : '<span class="sin-imagen"><i class="ti ti-signature" aria-hidden="true"></i> Sin firma</span>'}</div>
              </figure>
            </div>
          </div>` : ''}`;
      filtrar(panel, estado.buscar);
    }

    function formUsuario(u) {
      const propio = u.id === yo.id;
      const firmaActual = estado.sel && estado.sel.id === u.id ? estado.firma : null;
      formulario({
        titulo: `Modificar usuario · ${u.nombre || u.correo}`,
        valores: { ...u, firma: firmaActual },
        campos: [
          { nombre: 'usuario', etiqueta: 'Usuario (código)', requerido: true, patron: '[A-Za-z0-9]{2,20}', max: 20,
            placeholder: window.UI.proponerUsuario ? window.UI.proponerUsuario(u.nombre || '', []) || 'Oasturias' : 'Oasturias' },
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
          { nombre: 'organizacion_id', etiqueta: 'Organización', tipo: 'select-numero', requerido: true,
            opciones: estado.orgs.map((x) => ({ valor: x.id, texto: `${x.codigo} · ${x.nombre}` })) },
          { nombre: 'localidad_id', etiqueta: 'Localidad', tipo: 'select-numero', requerido: true, opciones: [] },
          ...(propio ? [] : [
            { nombre: 'rol_id', etiqueta: 'Rol', tipo: 'select', requerido: true, opciones: roles.map((r) => ({ valor: r.id, texto: r.nombre })) },
            { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla' }
          ]),
          { nombre: 'fecha_vence_clave', etiqueta: 'Fecha vence clave', tipo: 'fecha' },
          { nombre: 'empleado', etiqueta: 'Empleado' },
          { nombre: 'extension', etiqueta: 'Extensión telefónica' },
          { nombre: 'firma', etiqueta: 'Firma', tipo: 'imagen' }
        ],
        alPreparar: (form) => {
          const selOrg = form.elements.organizacion_id;
          const selLoc = form.elements.localidad_id;
          const llenar = (idOrg, valor) => {
            const lista = estado.locs.filter((x) => x.organizacion_id === Number(idOrg));
            selLoc.innerHTML = '<option value="">Seleccionar…</option>' + lista.map((x) =>
              `<option value="${x.id}" ${x.id === valor ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre_comercial)}</option>`).join('');
          };
          llenar(u.organizacion_id, u.localidad_id);
          selOrg.addEventListener('change', () => llenar(selOrg.value));
        },
        alGuardar: async (d) => {
          const firma = d.firma;
          delete d.firma;
          const { error } = await sb.from('perfiles').update(d).eq('id', u.id);
          if (error) {
            if (/perfiles_usuario_key|perfiles_usuario_unico|duplicate/i.test(error.message)) throw new Error(`Ya existe otro usuario con el código ${d.usuario}.`);
            if (/perfiles_usuario_check/i.test(error.message)) throw new Error('El código solo admite letras y números (2 a 20).');
            if (/perfiles_activo_con_localidad/i.test(error.message)) throw new Error('Un usuario activo debe tener organización y localidad.');
            if (/perfiles_localidad_fkey/i.test(error.message)) throw new Error('La localidad no pertenece a la organización elegida.');
            throw error;
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
      if (tr && (!estado.sel || tr.dataset.id !== estado.sel.id)) {
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
