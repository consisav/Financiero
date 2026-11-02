// Catálogo común Organizaciones: organizaciones y sus localidades, con detalle y auditoría.
(function () {
  const { esc, bandera, estado: estadoHtml, auditoria, tabla, formulario, cascadaUbicacion, filtrar } = window.UI;

  const EMBEBIDO = '*, pais:paises(nombre, iso2), departamento:departamentos(nombre), municipio:municipios(nombre)';

  const ubicacion = (f) => [f.municipio && esc(f.municipio.nombre), f.departamento && esc(f.departamento.nombre),
    f.pais && `${bandera(f.pais.iso2)} ${esc(f.pais.nombre)}`].filter(Boolean).join(', ') || '—';

  const dato = (etiqueta, valor, completo) =>
    `<div class="dato${completo ? ' completo' : ''}"><span>${esc(etiqueta)}</span><b>${valor || '—'}</b></div>`;

  const camposUbicacion = [
    { nombre: 'pais_id', etiqueta: 'País', tipo: 'select-numero' },
    { nombre: 'departamento_id', etiqueta: 'Estado / departamento', tipo: 'select-numero' },
    { nombre: 'municipio_id', etiqueta: 'Ciudad / municipio', tipo: 'select-numero' }
  ];

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS.organizaciones = function (cont) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    const estado = { orgs: [], org: null, locs: [], loc: null, buscar: {} };

    cont.innerHTML = '<section class="panel" id="p-orgs"></section><section class="panel" id="p-locs"></section>';
    const pOrgs = cont.querySelector('#p-orgs');
    const pLocs = cont.querySelector('#p-locs');

    // ---------- Organizaciones ----------
    async function cargarOrgs(seleccion) {
      const { data, error } = await sb.from('organizaciones').select(EMBEBIDO).order('codigo');
      if (error) { pOrgs.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      estado.orgs = data;
      const previo = seleccion || (estado.org && estado.org.id);
      estado.org = data.find((x) => x.id === previo) || data[0] || null;
      pintarOrgs();
      await cargarLocs();
    }

    function pintarOrgs() {
      const o = estado.org;
      pOrgs.innerHTML = `
        <div class="panel-cab">
          <h2>Organización</h2>
          <div class="panel-acciones">${editable ? '<button type="button" class="boton primario-sm" data-accion="nueva-org">+ Organización</button>' : ''}</div>
        </div>
        ${estado.orgs.length > 6 ? `<input type="search" class="buscar" data-buscar="orgs" placeholder="Buscar organización" value="${esc(estado.buscar.orgs || '')}">` : ''}
        ${tabla({
          id: 'orgs', editable, seleccionado: o && o.id, vacio: 'Todavía no hay organizaciones. Crea la primera.',
          columnas: [
            { titulo: 'Cód.', valor: (f) => f.codigo, clase: 'angosta' },
            { titulo: 'Organización', valor: (f) => esc(f.nombre), clase: 'fuerte' },
            { titulo: 'Representante legal', valor: (f) => esc(f.representante_legal) || '—' },
            { titulo: 'Teléfonos', valor: (f) => esc(f.telefonos) || '—' },
            { titulo: 'Ubicación', valor: ubicacion },
            { titulo: 'Estado', valor: (f) => estadoHtml(f.activo) }
          ],
          filas: estado.orgs
        })}
        ${o ? `
          <div class="detalle">
            ${auditoria(o, editable, 'org')}
            <div class="datos">
              ${dato('Organización', `${o.codigo} · ${esc(o.nombre)}`)}
              ${dato('Representante legal', esc(o.representante_legal))}
              ${dato('Teléfonos', esc(o.telefonos))}
              ${dato('Correos', esc(o.correos))}
              ${dato('Dirección', esc(o.direccion), true)}
              ${dato('País', o.pais && esc(o.pais.nombre))}
              ${dato('Estado / departamento', o.departamento && esc(o.departamento.nombre))}
              ${dato('Ciudad / municipio', o.municipio && esc(o.municipio.nombre))}
            </div>
          </div>` : ''}`;
      filtrar(pOrgs, estado.buscar.orgs || '');
    }

    function formOrg(fila) {
      const valores = fila || { activo: true, pais_id: (estado.orgs[0] || {}).pais_id };
      formulario({
        titulo: fila ? `Modificar organización · ${fila.codigo}` : 'Nueva organización',
        valores,
        campos: [
          { nombre: 'nombre', etiqueta: 'Organización', requerido: true, ancho: 'completo' },
          { nombre: 'representante_legal', etiqueta: 'Representante legal' },
          { nombre: 'telefonos', etiqueta: 'Teléfonos', placeholder: '2219-3093' },
          { nombre: 'correos', etiqueta: 'Correos', placeholder: 'contacto@empresa.com', ancho: 'completo' },
          { nombre: 'direccion', etiqueta: 'Dirección', tipo: 'area', ancho: 'completo' },
          ...camposUbicacion,
          { nombre: 'activo', etiqueta: 'Activa', tipo: 'casilla' }
        ],
        alPreparar: (form) => cascadaUbicacion(form, valores),
        alGuardar: async (d) => {
          const r = fila ? await sb.from('organizaciones').update(d).eq('id', fila.id).select('id').single()
                         : await sb.from('organizaciones').insert(d).select('id').single();
          if (r.error) throw r.error;
          window.FIN.aviso('Organización guardada');
          estado.loc = null;
          await cargarOrgs(r.data.id);
        }
      });
    }

    // ---------- Localidades ----------
    async function cargarLocs(seleccion) {
      if (!estado.org) { pLocs.innerHTML = ''; return; }
      const { data, error } = await sb.from('localidades').select(EMBEBIDO).eq('organizacion_id', estado.org.id).order('correlativo');
      if (error) { pLocs.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      estado.locs = data;
      const previo = seleccion || (estado.loc && estado.loc.id);
      estado.loc = data.find((x) => x.id === previo) || data[0] || null;
      pintarLocs();
    }

    function pintarLocs() {
      const l = estado.loc;
      pLocs.innerHTML = `
        <div class="panel-cab">
          <h2>Localidades de ${estado.org.codigo} · ${esc(estado.org.nombre)}</h2>
          <div class="panel-acciones">${editable ? '<button type="button" class="boton primario-sm" data-accion="nueva-loc">+ Localidad</button>' : ''}</div>
        </div>
        ${estado.locs.length > 6 ? `<input type="search" class="buscar" data-buscar="locs" placeholder="Buscar localidad" value="${esc(estado.buscar.locs || '')}">` : ''}
        ${tabla({
          id: 'locs', editable, seleccionado: l && l.id, vacio: 'Esta organización todavía no tiene localidades.',
          columnas: [
            { titulo: 'Código', valor: (f) => `<span class="codigo">${esc(f.codigo)}</span>`, clase: 'angosta' },
            { titulo: 'Nombre comercial', valor: (f) => esc(f.nombre_comercial), clase: 'fuerte' },
            { titulo: 'Razón social', valor: (f) => esc(f.razon_social) || '—' },
            { titulo: 'NIT', valor: (f) => esc(f.nit) || '—' },
            { titulo: 'Municipio', valor: (f) => (f.municipio ? esc(f.municipio.nombre) : '—') },
            { titulo: 'Estado', valor: (f) => estadoHtml(f.activo) }
          ],
          filas: estado.locs
        })}
        ${l ? `
          <div class="detalle">
            ${auditoria(l, editable, 'loc')}
            <div class="datos">
              ${dato('Localidad', `${esc(l.codigo)} · ${esc(l.nombre_comercial)}`)}
              ${dato('Razón social', esc(l.razon_social))}
              ${dato('NIT', esc(l.nit))}
              ${dato('Teléfonos', esc(l.telefonos))}
              ${dato('Correos', esc(l.correos))}
              ${dato('Dirección', esc(l.direccion), true)}
              ${dato('País', l.pais && esc(l.pais.nombre))}
              ${dato('Estado / departamento', l.departamento && esc(l.departamento.nombre))}
              ${dato('Ciudad / municipio', l.municipio && esc(l.municipio.nombre))}
            </div>
          </div>` : ''}`;
      filtrar(pLocs, estado.buscar.locs || '');
    }

    function formLoc(fila) {
      const o = estado.org;
      const valores = fila || { activo: true, pais_id: o.pais_id, departamento_id: o.departamento_id, municipio_id: o.municipio_id };
      formulario({
        titulo: fila ? `Modificar localidad · ${fila.codigo}` : `Nueva localidad de ${o.codigo} · ${o.nombre}`,
        valores,
        campos: [
          { nombre: 'nombre_comercial', etiqueta: 'Nombre comercial', requerido: true, ancho: 'completo' },
          { nombre: 'razon_social', etiqueta: 'Razón social', ancho: 'completo' },
          { nombre: 'nit', etiqueta: 'NIT', placeholder: '1234567-8' },
          { nombre: 'telefonos', etiqueta: 'Teléfonos' },
          { nombre: 'correos', etiqueta: 'Correos', ancho: 'completo' },
          { nombre: 'direccion', etiqueta: 'Dirección', tipo: 'area', ancho: 'completo' },
          ...camposUbicacion,
          { nombre: 'activo', etiqueta: 'Activa', tipo: 'casilla' }
        ],
        alPreparar: (form) => cascadaUbicacion(form, valores),
        alGuardar: async (d) => {
          d.organizacion_id = o.id;
          const r = fila ? await sb.from('localidades').update(d).eq('id', fila.id).select('id').single()
                         : await sb.from('localidades').insert(d).select('id').single();
          if (r.error) throw r.error;
          window.FIN.aviso('Localidad guardada');
          await cargarLocs(r.data.id);
        }
      });
    }

    // ---------- Eventos ----------
    cont.addEventListener('click', async (e) => {
      const accion = e.target.closest('[data-accion]');
      if (accion) {
        const a = accion.dataset.accion;
        if (a === 'nueva-org') formOrg();
        if (a === 'org-modificar') formOrg(estado.org);
        if (a === 'org-actualizar') { await cargarOrgs(); window.FIN.aviso('Datos actualizados'); }
        if (a === 'nueva-loc') formLoc();
        if (a === 'loc-modificar') formLoc(estado.loc);
        if (a === 'loc-actualizar') { await cargarLocs(); window.FIN.aviso('Datos actualizados'); }
        return;
      }
      const t = e.target.closest('table[data-tabla]');
      if (!t) return;
      const lista = t.dataset.tabla === 'orgs' ? estado.orgs : estado.locs;
      const ed = e.target.closest('[data-editar]');
      if (ed) {
        const fila = lista.find((x) => String(x.id) === ed.dataset.editar);
        t.dataset.tabla === 'orgs' ? formOrg(fila) : formLoc(fila);
        return;
      }
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const fila = lista.find((x) => String(x.id) === tr.dataset.id);
      if (t.dataset.tabla === 'orgs' && fila !== estado.org) { estado.org = fila; estado.loc = null; pintarOrgs(); await cargarLocs(); }
      if (t.dataset.tabla === 'locs' && fila !== estado.loc) { estado.loc = fila; pintarLocs(); }
    });

    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('tr[data-id]')) e.target.click();
    });

    cont.addEventListener('input', (e) => {
      const clave = e.target.dataset.buscar;
      if (!clave) return;
      estado.buscar[clave] = e.target.value;
      filtrar(e.target.closest('.panel'), e.target.value);
    });

    cargarOrgs();
  };
})();
