// Catálogo común Organizaciones: organizaciones y sus localidades, con detalle y auditoría.
(function () {
  const { esc, bandera, auditoria, formulario, cascadaUbicacion } = window.UI;
  // Qué vende la localidad (empresa): define controles como lote, vencimiento y registro sanitario.
  const VENTA = { MEDICAMENTOS: 'Medicamentos', PERECEDEROS: 'Productos perecederos', 'NO PERECEDEROS': 'Productos no perecederos' };

  const EMBEBIDO = '*, pais:paises(nombre, iso2), departamento:departamentos(nombre), municipio:municipios(nombre)';

  const dato = (etiqueta, valor, completo) =>
    `<div class="dato${completo ? ' completo' : ''}"><span>${esc(etiqueta)}</span><b>${valor || '—'}</b></div>`;

  // Logo y eslogan: imágenes en el bucket público "organizaciones" de Supabase Storage.
  const BUCKET = 'organizaciones';
  const IMAGENES = [
    { campo: 'logo', columna: 'logo_ruta', etiqueta: 'Logo' },
    { campo: 'eslogan', columna: 'eslogan_ruta', etiqueta: 'Eslogan' }
  ];
  const urlImagen = (ruta) => ruta ? window.FIN.sb.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl : null;
  const imagen = (ruta, clase) => ruta ? `<img class="${clase}" src="${esc(urlImagen(ruta))}" alt="">` : '';

  // Sube, reemplaza o quita las imágenes de una organización (o de una localidad) ya guardada.
  // Las de la localidad van en la carpeta de su organización: <org>/localidad-<id>/.
  async function guardarImagenes(sb, id, anterior, datos, tabla = 'organizaciones', carpeta = String(id)) {
    const cambios = {};
    const viejas = [];
    for (const im of IMAGENES) {
      const v = datos[im.campo];
      if (!v || (!v.archivo && !v.quitar)) continue;
      if (anterior && anterior[im.columna]) viejas.push(anterior[im.columna]);
      if (v.archivo) {
        const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[v.archivo.type];
        const ruta = `${carpeta}/${im.campo}-${Date.now()}.${ext}`;
        const { error } = await sb.storage.from(BUCKET).upload(ruta, v.archivo, { contentType: v.archivo.type, cacheControl: '31536000' });
        if (error) throw new Error(`No se pudo subir el ${im.etiqueta.toLowerCase()}: ${error.message || error.error || 'error del almacenamiento'}.`);
        cambios[im.columna] = ruta;
      } else cambios[im.columna] = null;
    }
    if (!Object.keys(cambios).length) return;
    const { error } = await sb.from(tabla).update(cambios).eq('id', id);
    if (error) throw error;
    if (viejas.length) await sb.storage.from(BUCKET).remove(viejas);
  }

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

    // Tres columnas (opción A): a la izquierda la lista de organizaciones y, debajo, sus localidades; al centro
    // el detalle de la organización elegida y a la derecha el de la localidad elegida. Ocupan el alto de la ventana.
    cont.innerHTML = '<div class="og-a"><section class="panel og-col og-listas" id="p-lista"></section><section class="panel og-col" id="p-orgs"></section><section class="panel og-col" id="p-locs"></section></div>';
    const pLista = cont.querySelector('#p-lista');
    const pOrgs = cont.querySelector('#p-orgs');
    const pLocs = cont.querySelector('#p-locs');
    const rejilla = cont.querySelector('.og-a');
    const ajustar = () => {
      if (!rejilla.isConnected) { window.removeEventListener('resize', ajustar); return; }
      let alto = Math.max(520, window.innerHeight - rejilla.getBoundingClientRect().top - 18);
      rejilla.style.height = `${alto}px`;
      // Si el relleno inferior de la página aún deja desplazamiento, se descuenta.
      const sobra = document.scrollingElement.scrollHeight - window.innerHeight;
      if (sobra > 0 && alto - sobra >= 520) { alto -= sobra; rejilla.style.height = `${alto}px`; }
    };
    window.addEventListener('resize', ajustar);
    requestAnimationFrame(ajustar);

    const logoDe = (ruta, icono) => imagen(ruta, 'logo-mini') || `<span class="logo-mini vacio-logo"><i class="ti ${icono}" aria-hidden="true"></i></span>`;
    const imagenes = (fila, heredar) => `
      <div class="imagenes-org">
        ${IMAGENES.map((im) => `
          <figure class="imagen-org">
            <figcaption>${im.etiqueta}</figcaption>
            <div class="imagen-marco">${imagen(fila[im.columna], '') || (heredar && heredar[im.columna]
              ? `${imagen(heredar[im.columna], 'imagen-heredada')}<span class="imagen-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> Se usa el de la organización</span>`
              : `<span class="sin-imagen"><i class="ti ti-photo" aria-hidden="true"></i> Sin ${im.etiqueta.toLowerCase()}</span>`)}</div>
          </figure>`).join('')}
      </div>`;

    // Columna izquierda: organizaciones y localidades de la organización elegida.
    function pintarLista() {
      const o = estado.org, l = estado.loc;
      const fila = (tipo, f, act, titulo, sub, logo) => `
        <li class="og-item ${act ? 'actual' : ''} ${f.activo ? '' : 'inactivo'}" data-${tipo}="${f.id}" tabindex="0" data-texto="${esc(`${titulo} ${sub}`.toLowerCase())}">
          ${logo}<span class="og-txt"><b>${titulo}</b><small>${sub}</small></span>
          ${f.activo ? '' : '<span class="og-inactivo">Inactiva</span>'}
          ${editable ? `<button type="button" class="og-editar" data-editar-${tipo}="${f.id}" title="Modificar" aria-label="Modificar"><i class="ti ti-pencil" aria-hidden="true"></i></button>` : ''}
        </li>`;
      pLista.innerHTML = `
        <div class="og-bloque og-b-orgs">
          <div class="panel-cab"><h2>Organizaciones <small>${estado.orgs.length}</small></h2>${editable ? '<button type="button" class="boton primario-sm" data-accion="nueva-org">+ Organización</button>' : ''}</div>
          ${estado.orgs.length > 6 ? `<input type="search" class="buscar" data-buscar="orgs" placeholder="Buscar organización" value="${esc(estado.buscar.orgs || '')}">` : ''}
          <ul class="og-ul" data-lista="orgs">${estado.orgs.map((f) => fila('org', f, o && o.id === f.id, `${f.codigo} · ${esc(f.nombre)}`, esc([f.representante_legal, f.municipio && f.municipio.nombre].filter(Boolean).join(' · ') || '—'), logoDe(f.logo_ruta, 'ti-building'))).join('') || '<li class="og-vacio">Todavía no hay organizaciones. Crea la primera.</li>'}</ul>
        </div>
        ${o ? `<div class="og-bloque og-b-locs">
          <div class="panel-cab"><h2>Localidades de ${o.codigo} <small>${estado.locs.length}</small></h2>${editable ? '<button type="button" class="boton primario-sm" data-accion="nueva-loc">+ Localidad</button>' : ''}</div>
          ${estado.locs.length > 6 ? `<input type="search" class="buscar" data-buscar="locs" placeholder="Buscar localidad" value="${esc(estado.buscar.locs || '')}">` : ''}
          <ul class="og-ul" data-lista="locs">${estado.locs.map((f) => fila('loc', f, l && l.id === f.id, `${esc(f.codigo)} · ${esc(f.nombre_comercial)}`, esc([f.nit && `NIT ${f.nit}`, f.municipio && f.municipio.nombre].filter(Boolean).join(' · ') || '—'), logoDe(f.logo_ruta || o.logo_ruta, 'ti-building-store'))).join('') || '<li class="og-vacio">Esta organización todavía no tiene localidades.</li>'}</ul>
        </div>` : ''}`;
      ['orgs', 'locs'].forEach((k) => filtrarLista(k, estado.buscar[k] || ''));
    }
    function filtrarLista(clave, texto) {
      const q = texto.trim().toLowerCase();
      pLista.querySelectorAll(`[data-lista="${clave}"] li[data-texto]`).forEach((li) => { li.hidden = !!q && !li.dataset.texto.includes(q); });
    }

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
      pintarLista();
      const o = estado.org;
      pOrgs.innerHTML = o ? `
        <header class="og-cab"><span class="og-logo-cab">${logoDe(o.logo_ruta, 'ti-building')}</span><div><small>Organización</small><h2>${o.codigo} · ${esc(o.nombre)}</h2></div></header>
        ${auditoria(o, editable, 'org')}
        <div class="datos">
          ${dato('Representante legal', esc(o.representante_legal))}
          ${dato('Organización anterior', esc(o.organizacion_anterior))}
          ${dato('Teléfonos', esc(o.telefonos))}
          ${dato('Correos', esc(o.correos))}
          ${dato('Dirección', esc(o.direccion), true)}
          ${dato('País', o.pais && `${bandera(o.pais.iso2)} ${esc(o.pais.nombre)}`)}
          ${dato('Estado / departamento', o.departamento && esc(o.departamento.nombre))}
          ${dato('Ciudad / municipio', o.municipio && esc(o.municipio.nombre))}
        </div>
        ${imagenes(o)}` : '<p class="vacio">Elige o crea una organización.</p>';
    }

    function formOrg(fila) {
      const valores = fila
        ? { ...fila, logo: urlImagen(fila.logo_ruta), eslogan: urlImagen(fila.eslogan_ruta) }
        : { activo: true, pais_id: (estado.orgs[0] || {}).pais_id };
      formulario({
        titulo: fila ? `Modificar organización · ${fila.codigo}` : 'Nueva organización',
        valores,
        campos: [
          { nombre: 'nombre', etiqueta: 'Organización', requerido: true, ancho: 'completo' },
          { nombre: 'organizacion_anterior', etiqueta: 'Organización anterior', placeholder: 'Código en el sistema anterior (migración)' },
          { nombre: 'representante_legal', etiqueta: 'Representante legal' },
          { nombre: 'telefonos', etiqueta: 'Teléfonos', placeholder: '2219-3093' },
          { nombre: 'correos', etiqueta: 'Correos', placeholder: 'contacto@empresa.com', ancho: 'completo' },
          { nombre: 'direccion', etiqueta: 'Dirección', tipo: 'area', ancho: 'completo' },
          ...camposUbicacion,
          { nombre: 'activo', etiqueta: 'Activa', tipo: 'casilla' },
          { nombre: 'logo', etiqueta: 'Logo', tipo: 'imagen' },
          { nombre: 'eslogan', etiqueta: 'Eslogan', tipo: 'imagen' }
        ],
        alPreparar: (form) => cascadaUbicacion(form, valores),
        alGuardar: async (d) => {
          const imagenes = { logo: d.logo, eslogan: d.eslogan };
          delete d.logo;
          delete d.eslogan;
          const r = fila ? await sb.from('organizaciones').update(d).eq('id', fila.id).select('id').single()
                         : await sb.from('organizaciones').insert(d).select('id').single();
          if (r.error) throw r.error;
          // Los datos ya quedaron guardados: si falla una imagen se avisa, sin dejar el formulario abierto.
          let fallo = null;
          try { await guardarImagenes(sb, r.data.id, fila, imagenes); } catch (err) { fallo = err; }
          window.FIN.aviso(fallo ? `Organización guardada, pero ${fallo.message.charAt(0).toLowerCase()}${fallo.message.slice(1)}` : 'Organización guardada');
          estado.loc = null;
          await cargarOrgs(r.data.id);
        }
      });
    }

    // ---------- Localidades ----------
    async function cargarLocs(seleccion) {
      if (!estado.org) { estado.locs = []; estado.loc = null; pintarLocs(); return; }
      const { data, error } = await sb.from('localidades').select(EMBEBIDO).eq('organizacion_id', estado.org.id).order('correlativo');
      if (error) { pLocs.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      estado.locs = data;
      const previo = seleccion || (estado.loc && estado.loc.id);
      estado.loc = data.find((x) => x.id === previo) || data[0] || null;
      pintarLocs();
    }

    function pintarLocs() {
      pintarLista();
      const l = estado.loc;
      pLocs.innerHTML = l ? `
        <header class="og-cab"><span class="og-logo-cab">${logoDe(l.logo_ruta || estado.org.logo_ruta, 'ti-building-store')}</span><div><small>Localidad de ${estado.org.codigo} · ${esc(estado.org.nombre)}</small><h2>${esc(l.codigo)} · ${esc(l.nombre_comercial)}</h2></div></header>
        ${auditoria(l, editable, 'loc')}
        <div class="datos">
          ${dato('Razón social', esc(l.razon_social), true)}
          ${dato('NIT', esc(l.nit))}
          ${dato('Empresa anterior', esc(l.empresa_anterior))}
          ${dato('Venta de productos', esc(VENTA[l.tipo_venta] || ''))}
          ${dato('Teléfonos', esc(l.telefonos))}
          ${dato('Correos', esc(l.correos), true)}
          ${dato('Dirección', esc(l.direccion), true)}
          ${dato('País', l.pais && `${bandera(l.pais.iso2)} ${esc(l.pais.nombre)}`)}
          ${dato('Estado / departamento', l.departamento && esc(l.departamento.nombre))}
          ${dato('Ciudad / municipio', l.municipio && esc(l.municipio.nombre))}
        </div>
        ${imagenes(l, estado.org)}` : `<p class="vacio">${estado.org ? 'Esta organización todavía no tiene localidades.' : ''}</p>`;
    }

    function formLoc(fila) {
      const o = estado.org;
      const valores = fila ? { ...fila, logo: urlImagen(fila.logo_ruta), eslogan: urlImagen(fila.eslogan_ruta) }
        : { activo: true, pais_id: o.pais_id, departamento_id: o.departamento_id, municipio_id: o.municipio_id };
      formulario({
        titulo: fila ? `Modificar localidad · ${fila.codigo}` : `Nueva localidad de ${o.codigo} · ${o.nombre}`,
        valores,
        campos: [
          { nombre: 'nombre_comercial', etiqueta: 'Nombre comercial', requerido: true, ancho: 'completo' },
          { nombre: 'razon_social', etiqueta: 'Razón social', ancho: 'completo' },
          { nombre: 'empresa_anterior', etiqueta: 'Empresa anterior', placeholder: 'Código en el sistema anterior (migración)' },
          { nombre: 'nit', etiqueta: 'NIT', placeholder: '1234567-8' },
          { nombre: 'tipo_venta', etiqueta: 'Venta de productos', tipo: 'select', vacio: 'Sin definir', opciones: Object.entries(VENTA).map(([valor, texto]) => ({ valor, texto })) },
          { nombre: 'telefonos', etiqueta: 'Teléfonos' },
          { nombre: 'correos', etiqueta: 'Correos', ancho: 'completo' },
          { nombre: 'direccion', etiqueta: 'Dirección', tipo: 'area', ancho: 'completo' },
          ...camposUbicacion,
          { nombre: 'activo', etiqueta: 'Activa', tipo: 'casilla' },
          { nombre: 'logo', etiqueta: 'Logo de la localidad (sin logo se usa el de la organización)', tipo: 'imagen' },
          { nombre: 'eslogan', etiqueta: 'Eslogan de la localidad (sin eslogan se usa el de la organización)', tipo: 'imagen' }
        ],
        alPreparar: (form) => cascadaUbicacion(form, valores),
        alGuardar: async (d) => {
          const imagenes = { logo: d.logo, eslogan: d.eslogan };
          delete d.logo;
          delete d.eslogan;
          d.organizacion_id = o.id;
          d.tipo_venta = d.tipo_venta || null;
          const r = fila ? await sb.from('localidades').update(d).eq('id', fila.id).select('id').single()
                         : await sb.from('localidades').insert(d).select('id').single();
          if (r.error) throw r.error;
          let fallo = null;
          try { await guardarImagenes(sb, r.data.id, fila, imagenes, 'localidades', `${o.id}/localidad-${r.data.id}`); } catch (err) { fallo = err; }
          window.FIN.aviso(fallo ? `Localidad guardada, pero ${fallo.message.charAt(0).toLowerCase()}${fallo.message.slice(1)}` : 'Localidad guardada');
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
      const eo = e.target.closest('[data-editar-org]');
      if (eo) return formOrg(estado.orgs.find((x) => String(x.id) === eo.dataset.editarOrg));
      const el = e.target.closest('[data-editar-loc]');
      if (el) return formLoc(estado.locs.find((x) => String(x.id) === el.dataset.editarLoc));
      const io = e.target.closest('li[data-org]');
      if (io) { const f = estado.orgs.find((x) => String(x.id) === io.dataset.org); if (f && f !== estado.org) { estado.org = f; estado.loc = null; pintarOrgs(); await cargarLocs(); } return; }
      const il = e.target.closest('li[data-loc]');
      if (il) { const f = estado.locs.find((x) => String(x.id) === il.dataset.loc); if (f && f !== estado.loc) { estado.loc = f; pintarLocs(); } }
    });

    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('li[data-org], li[data-loc]')) e.target.click();
    });

    cont.addEventListener('input', (e) => {
      const clave = e.target.dataset.buscar;
      if (!clave) return;
      estado.buscar[clave] = e.target.value;
      filtrarLista(clave, e.target.value);
    });

    cargarOrgs();
  };
})();
