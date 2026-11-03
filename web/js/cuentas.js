// Contabilidad · Cuentas contables (por organización y versión del catálogo) y Centros de costos
// (por organización). Ambos usan el árbol de tres bloques de js/jerarquia.js.
(function () {
  const { esc, fechaCorta, tabla, formulario } = window.UI;

  const siNo = (v) => `<span class="estado ${v ? 'activo' : 'inactivo'}">${v ? 'Sí' : 'No'}</span>`;
  const fichaDato = (etiqueta, valor) => `<div class="ficha-dato"><span>${esc(etiqueta)}</span><b>${valor || '—'}</b></div>`;

  // Selector de organización (empresa) compartido por ambas pantallas.
  async function organizaciones(sb) {
    const { data, error } = await sb.from('organizaciones').select('id, codigo, nombre').eq('activo', true).order('codigo');
    if (error) throw error;
    return data;
  }
  const opcionesOrg = (orgs, id) => orgs.map((o) => `<option value="${o.id}" ${o.id === id ? 'selected' : ''}>${o.codigo} · ${esc(o.nombre)}</option>`).join('');
  const sinOrganizaciones = (m) => `<p class="vacio">Primero crea una organización en <a href="#/${m.id}/organizaciones">Catálogos · Organizaciones</a>.</p>`;

  // Listado imprimible del árbol completo, en orden jerárquico.
  function imprimir(titulo, subtitulo, filas, padre, columnas) {
    const hijos = (id) => filas.filter((f) => (f[padre] ?? null) === id).sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
    const orden = [];
    (function recorrer(id) { for (const f of hijos(id)) { orden.push(f); recorrer(f.id); } })(null);
    const w = window.open('', '_blank');
    if (!w) { window.FIN.aviso('Permite las ventanas emergentes para imprimir.'); return; }
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
      <style>
        body { font-family: Inter, system-ui, sans-serif; font-size: 12px; color: #0f1b2d; margin: 24px; }
        h1 { font-size: 18px; margin: 0; } p { margin: 4px 0 16px; color: #5a6678; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #e3e8ef; }
        th { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #5a6678; }
        tr.integra td { font-weight: 700; background: #e8eef7; }
        tr.n1 td { font-weight: 800; background: #d6e2f3; }
        tr.inactiva td { color: #8a94a6; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style></head><body>
      <h1>${esc(titulo)}</h1><p>${esc(subtitulo)} · ${orden.length} registros · Impreso el ${new Date().toLocaleString('es-GT')}</p>
      <table><thead><tr><th>Código</th><th>Nombre</th><th>Nivel</th>${columnas.map((c) => `<th>${esc(c.titulo)}</th>`).join('')}<th>Vigente</th></tr></thead><tbody>
      ${orden.map((f) => `<tr class="n${f.nivel} ${f.integra ? 'integra' : ''} ${f.vigente ? '' : 'inactiva'}"><td>${esc(f.codigo)}</td><td style="padding-left:${8 + (f.nivel - 1) * 16}px">${esc(f.nombre)}</td><td>${f.nivel}</td>${columnas.map((c) => `<td>${c.valor(f)}</td>`).join('')}<td>${f.vigente ? 'Sí' : 'No'}</td></tr>`).join('')}
      </tbody></table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  const titulosCuentas = ['Cuenta principal', 'Sub-cuenta', 'Sub-sub-cuenta', ...Array.from({ length: 7 }, (_, i) => `Sub-cuenta de nivel ${i + 4}`)];
  const titulosCentros = ['Primer nivel', 'Segundo nivel', 'Tercer nivel', 'Cuarto nivel', 'Quinto nivel', 'Sexto nivel', 'Séptimo nivel', 'Octavo nivel'];

  window.PANTALLAS = window.PANTALLAS || {};

  // ---------- Cuentas contables (organización → localidad → versión → árbol) ----------
  window.PANTALLAS.cuentas = async function (cont, m) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    const estado = { orgs: [], org: null, locs: [], loc: null, versiones: [], version: null, tipos: [], arbol: null, contexto: false };

    try {
      const [orgs, tipos] = await Promise.all([organizaciones(sb), sb.from('tipos_cuenta').select('id, codigo, descripcion, activo').order('codigo')]);
      if (tipos.error) throw tipos.error;
      estado.orgs = orgs;
      estado.tipos = tipos.data;
    } catch (err) { cont.innerHTML = `<p class="vacio">${esc(err.message)}</p>`; return; }
    if (!estado.orgs.length) { cont.innerHTML = sinOrganizaciones(m); return; }
    estado.org = estado.orgs[0].id;

    cont.innerHTML = '<section class="panel cc-encabezado" id="p-versiones"></section><div id="arbol"></div>';
    const pVer = cont.querySelector('#p-versiones');
    const tipoDe = (id) => estado.tipos.find((t) => t.id === id);

    async function cargarLocalidades() {
      const { data, error } = await sb.from('localidades').select('id, codigo, nombre_comercial').eq('organizacion_id', estado.org).eq('activo', true).order('correlativo');
      if (error) { pVer.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      estado.locs = data;
      estado.loc = data.length ? data[0].id : null;
      estado.version = null;
      await cargarVersiones();
    }

    async function cargarVersiones(seleccion) {
      if (!estado.loc) { estado.versiones = []; estado.version = null; pintarVersiones(); montarArbol(); return; }
      const { data, error } = await sb.from('catalogos_cuentas').select('*').eq('localidad_id', estado.loc).order('version', { ascending: false });
      if (error) {
        pVer.innerHTML = error.code === '42703'
          ? '<p class="vacio">Falta instalar en Supabase el script <b>20261102000005_cuentas_por_localidad.sql</b>, que asigna el catálogo de cuentas a cada localidad. Ejecútalo en el SQL Editor y recarga esta página.</p>'
          : `<p class="vacio">${esc(error.message)}</p>`;
        return;
      }
      estado.versiones = data;
      const previo = seleccion || (estado.version && estado.version.id);
      estado.version = data.find((v) => v.id === previo) || data.find((v) => v.activo) || data[0] || null;
      pintarVersiones();
      montarArbol();
    }

    const locActual = () => estado.locs.find((l) => l.id === estado.loc);

    const textoVersion = (v) => `Versión ${v.version} · ${fechaCorta(v.fecha_del)} al ${fechaCorta(v.fecha_al) || "vigente"}${v.activo ? "" : " (inactiva)"}`;

    // Encabezado de una línea: empresa, localidad, versión, cifras del catálogo y acciones.
    function pintarVersiones() {
      const org = estado.orgs.find((o) => o.id === estado.org);
      const loc = locActual();
      const v = estado.version;
      // Empresa, localidad y versión quedan ocultas tras el botón de contexto; a la vista solo Imprimir.
      const abierto = estado.contexto || !loc || !v;
      pVer.innerHTML = `
        <div class="cc-barra">
          <button type="button" class="cc-contexto ${abierto ? 'abierto' : ''}" data-accion="contexto" aria-expanded="${abierto}" title="Cambiar empresa, localidad o versión">
            <i class="ti ti-building" aria-hidden="true"></i>
            <span><b>${esc(org.nombre)}</b>${loc ? ` · ${esc(loc.codigo)} ${esc(loc.nombre_comercial)}` : ''}${v ? ` · Versión ${v.version}` : ''}<span id="cc-resumen"></span></span>
            <i class="ti ti-chevron-down flecha" aria-hidden="true"></i>
          </button>
          <span class="cc-espacio"></span>
          ${v ? '<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>' : ''}
        </div>
        <div class="cc-panel" ${abierto ? '' : 'hidden'}>
          <label class="selector-org">Empresa <select data-org>${opcionesOrg(estado.orgs, estado.org)}</select></label>
          <label class="selector-org">Localidad <select data-loc ${estado.locs.length ? '' : 'disabled'}>
            ${estado.locs.length ? estado.locs.map((l) => `<option value="${l.id}" ${l.id === estado.loc ? 'selected' : ''}>${esc(l.codigo)} · ${esc(l.nombre_comercial)}</option>`).join('') : '<option>Sin localidades</option>'}
          </select></label>
          <label class="selector-org">Versión <select data-version ${estado.versiones.length ? '' : 'disabled'}>
            ${estado.versiones.length ? estado.versiones.map((x) => `<option value="${x.id}" ${v && x.id === v.id ? 'selected' : ''}>${esc(textoVersion(x))}</option>`).join('') : '<option>Sin versiones</option>'}
          </select></label>
          ${editable && v ? `<button type="button" class="icono-editar" data-editar-version="${v.id}" aria-label="Modificar versión" title="Modificar versión"><i class="ti ti-pencil" aria-hidden="true"></i></button>` : ''}
          ${editable && loc ? '<button type="button" class="boton secundario-sm" data-accion="nueva-version">+ Versión</button>' : ''}
          <span class="cc-espacio"></span>
          <span id="cc-cifras"></span>
        </div>
        <div id="cc-plantilla"></div>
        ${!loc ? `<p class="vacio">${esc(org.nombre)} todavía no tiene localidades. Las cuentas contables pertenecen a una localidad: crea una en <a href="#/${m.id}/organizaciones">Catálogos · Organizaciones</a>.</p>`
          : !v ? `<p class="vacio">${esc(loc.codigo)} · ${esc(loc.nombre_comercial)} todavía no tiene un catálogo de cuentas.${editable ? " Crea la versión 1 con «+ Versión»." : ""}</p>` : ""}`;
    }

    function pintarCifras(filas) {
      const caja = pVer.querySelector("#cc-cifras");
      if (!caja) return;
      // Versión vacía: ofrecer el catálogo estándar de Guatemala.
      const aviso = pVer.querySelector("#cc-plantilla");
      if (aviso) aviso.innerHTML = !filas.length && editable ? `
        <div class="cc-plantilla">
          <i class="ti ti-book-2" aria-hidden="true"></i>
          <div><b>Esta versión todavía no tiene cuentas.</b>
            <p>Puedes empezar con el catálogo estándar de Guatemala: 200 cuentas en 4 niveles basadas en NIIF, con IVA, ISR, ISO, IGSS, IRTRA, INTECAP, prestaciones laborales y reserva legal. Después lo ajustas a tu empresa.</p></div>
          <button type="button" class="boton primario-sm" data-accion="cargar-estandar">Cargar catálogo estándar</button>
        </div>` : "";
      const niveles = filas.reduce((n, f) => Math.max(n, f.nivel), 0);
      const vigentes = filas.filter((f) => f.vigente).length;
      const resumen = pVer.querySelector('#cc-resumen');
      if (resumen) resumen.textContent = ` · ${filas.length} cuentas`;
      caja.innerHTML = `
        <span class="rm-stats" role="list" aria-label="Resumen del catálogo">
          <span class="rm-stat" role="listitem"><i class="ti ti-list-tree" aria-hidden="true"></i><b>${filas.length}</b> cuentas</span>
          <span class="rm-stat" role="listitem"><i class="ti ti-stack-2" aria-hidden="true"></i><b>${niveles}</b> nivel${niveles === 1 ? "" : "es"}</span>
          <span class="rm-stat ${filas.length - vigentes ? "aviso" : ""}" role="listitem"><i class="ti ti-circle-check" aria-hidden="true"></i><b>${vigentes}</b> vigentes</span>
        </span>`;
    }

    function formVersion(fila) {
      formulario({
        titulo: fila ? `Modificar versión ${fila.version}` : 'Nueva versión del catálogo',
        valores: fila || { version: Math.max(0, ...estado.versiones.map((v) => v.version)) + 1, fecha_del: new Date().toISOString().slice(0, 10), activo: true },
        campos: [
          { nombre: 'version', etiqueta: 'Versión', tipo: 'numero', requerido: true },
          { nombre: 'fecha_del', etiqueta: 'Vigente del', tipo: 'fecha', requerido: true },
          { nombre: 'fecha_al', etiqueta: 'Vigente al', tipo: 'fecha' },
          { nombre: 'activo', etiqueta: 'Activa', tipo: 'casilla' }
        ],
        alGuardar: async (d) => {
          if (!fila) Object.assign(d, { organizacion_id: estado.org, localidad_id: estado.loc });
          const r = fila ? await sb.from('catalogos_cuentas').update(d).eq('id', fila.id).select('id').single()
                         : await sb.from('catalogos_cuentas').insert(d).select('id').single();
          if (r.error) {
            if (/check constraint/i.test(r.error.message)) throw new Error('La fecha "al" no puede ser anterior a la fecha "del".');
            throw r.error;
          }
          window.FIN.aviso('Versión guardada');
          await cargarVersiones(r.data.id);
        }
      });
    }

    function montarArbol() {
      const destino = cont.querySelector('#arbol');
      destino.replaceChildren();
      if (!estado.version) return;
      const div = document.createElement('div');
      destino.appendChild(div);
      const tiposActivos = estado.tipos.filter((t) => t.activo).map((t) => ({ valor: t.id, texto: `${t.codigo} · ${t.descripcion}` }));
      estado.arbol = window.Jerarquia(div, {
        tabla: 'cuentas', padre: 'cuenta_mayor_id', filtro: { catalogo_id: estado.version.id },
        titulos: titulosCuentas, etiquetaCodigo: 'Cuenta', etiquetaMayor: 'Cuenta mayor', etiquetaHijos: 'Sub-cuentas', editable,
        fichaUnica: true, alCargar: pintarCifras,
        columnas: [
          { titulo: 'Tipo cuenta', valor: (f) => esc((tipoDe(f.tipo_cuenta_id) || {}).descripcion || '') },
          { titulo: 'Integración', valor: (f) => siNo(f.integra) }
        ],
        ficha: (f) => fichaDato('Tipo cuenta', esc((tipoDe(f.tipo_cuenta_id) || {}).descripcion)) +
          fichaDato('Integración', siNo(f.integra)) + fichaDato('Cta. anterior', esc(f.cuenta_anterior)),
        valores: (mayor, hermanos) => ({ codigo: window.Jerarquia.siguienteCodigo(mayor, hermanos), integra: true, vigente: true }),
        campos: (fila, mayor) => [
          { nombre: 'codigo', etiqueta: 'Cuenta', requerido: true, soloLectura: !!fila, patron: '[0-9]+',
            placeholder: mayor ? `Debe comenzar con ${mayor.codigo}` : '1' },
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
          ...(!mayor ? [{ nombre: 'tipo_cuenta_id', etiqueta: 'Tipo cuenta', tipo: 'select-numero', opciones: tiposActivos, requerido: true }] : []),
          { nombre: 'cuenta_anterior', etiqueta: 'Cta. anterior' },
          { nombre: 'integra', etiqueta: 'Integración', tipo: 'casilla' },
          { nombre: 'vigente', etiqueta: 'Vigente', tipo: 'casilla' }
        ],
        antesDeGuardar: (d) => { d.nombre = d.nombre.toUpperCase(); }
      });
    }

    cont.addEventListener('change', (e) => {
      if (e.target.matches('[data-org]')) {
        estado.org = Number(e.target.value);
        cargarLocalidades();
      } else if (e.target.matches('[data-version]')) {
        estado.version = estado.versiones.find((v) => String(v.id) === e.target.value);
        pintarVersiones();
        montarArbol();
      } else if (e.target.matches('[data-loc]')) {
        estado.loc = Number(e.target.value);
        estado.version = null;
        cargarVersiones();
      }
    });
    pVer.addEventListener('click', (e) => {
      const accion = e.target.closest('[data-accion]');
      if (accion && accion.dataset.accion === 'contexto') {
        estado.contexto = accion.getAttribute('aria-expanded') !== 'true';
        accion.setAttribute('aria-expanded', String(estado.contexto));
        accion.classList.toggle('abierto', estado.contexto);
        pVer.querySelector('.cc-panel').hidden = !estado.contexto;
        return;
      }
      if (accion && accion.dataset.accion === 'nueva-version') return formVersion();
      if (accion && accion.dataset.accion === 'cargar-estandar') {
        accion.disabled = true;
        accion.textContent = 'Cargando…';
        sb.rpc('cargar_plantilla_cuentas', { p_catalogo: estado.version.id }).then(({ data, error }) => {
          if (error) {
            accion.disabled = false;
            accion.textContent = 'Cargar catálogo estándar';
            window.FIN.aviso(/cargar_plantilla_cuentas/.test(error.message) ? 'Falta instalar en Supabase el script 20261102000013_catalogo_estandar_guatemala.sql.' : window.UI.traducirError(error));
            return;
          }
          window.FIN.aviso(`Catálogo estándar cargado: ${data} cuentas`);
          montarArbol();
        });
        return;
      }
      if (accion && accion.dataset.accion === 'imprimir') {
        const org = estado.orgs.find((o) => o.id === estado.org);
        const loc = locActual();
        const v = estado.version;
        return imprimir(`Catálogo de cuentas · ${org.nombre}`, `Localidad ${loc.codigo} · ${loc.nombre_comercial} · Versión ${v.version}, del ${fechaCorta(v.fecha_del)} al ${fechaCorta(v.fecha_al) || 'vigente'}`,
          estado.arbol.filas(), 'cuenta_mayor_id',
          [{ titulo: 'Tipo cuenta', valor: (f) => esc((tipoDe(f.tipo_cuenta_id) || {}).descripcion || '') },
           { titulo: 'Integración', valor: (f) => f.integra ? 'Sí' : 'No' },
           { titulo: 'Cta. anterior', valor: (f) => esc(f.cuenta_anterior || '') }]);
      }
      const ed = e.target.closest('[data-editar-version]');
      if (ed) return formVersion(estado.versiones.find((v) => String(v.id) === ed.dataset.editarVersion));
    });

    cargarLocalidades();
  };

  // ---------- Centros de costos ----------
  window.PANTALLAS['centros-costo'] = async function (cont, m) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    let orgs;
    try { orgs = await organizaciones(sb); } catch (err) { cont.innerHTML = `<p class="vacio">${esc(err.message)}</p>`; return; }
    if (!orgs.length) { cont.innerHTML = sinOrganizaciones(m); return; }
    let org = orgs[0].id;
    let arbol = null;

    cont.innerHTML = '<section class="panel cc-encabezado" id="cc-centros"></section><div id="arbol"></div>';
    const pCab = cont.querySelector('#cc-centros');

    // Empresa plegable tras el botón de resumen; a la vista solo Imprimir.
    function pintarCabecera() {
      const o = orgs.find((x) => x.id === org);
      pCab.innerHTML = window.UI.barraContexto({
        clave: 'centros-costo',
        resumen: `<b>${esc(o.nombre)}</b> · centros de costo<span id="cc-centros-total"></span>`,
        panel: `<label class="selector-org">Empresa <select data-org>${opcionesOrg(orgs, org)}</select></label>`,
        derecha: '<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>'
      });
    }

    function montar() {
      const destino = cont.querySelector('#arbol');
      destino.replaceChildren();
      const div = document.createElement('div');
      destino.appendChild(div);
      arbol = window.Jerarquia(div, {
        tabla: 'centros_costo', padre: 'centro_mayor_id', filtro: { organizacion_id: org },
        titulos: titulosCentros, etiquetaCodigo: 'Centro', etiquetaMayor: 'Centro mayor', editable,
        columnas: [{ titulo: 'Integra', valor: (f) => siNo(f.integra) }],
        ficha: (f) => fichaDato('Integra', siNo(f.integra)),
        valores: (mayor, hermanos) => ({ codigo: window.Jerarquia.siguienteCodigo(mayor, hermanos), integra: false, vigente: true }),
        campos: (fila, mayor) => [
          { nombre: 'codigo', etiqueta: 'Centro', requerido: true, soloLectura: !!fila, patron: '[0-9]+',
            placeholder: mayor ? `Debe comenzar con ${mayor.codigo}` : '503101' },
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
          { nombre: 'integra', etiqueta: 'Integra', tipo: 'casilla' },
          { nombre: 'vigente', etiqueta: 'Vigente', tipo: 'casilla' }
        ],
        antesDeGuardar: (d) => { d.nombre = d.nombre.toUpperCase(); },
        alCargar: (filas) => { const t = pCab.querySelector('#cc-centros-total'); if (t) t.textContent = ` · ${filas.length}`; }
      });
    }

    cont.addEventListener('change', (e) => {
      if (!e.target.matches('[data-org]')) return;
      org = Number(e.target.value);
      pintarCabecera();
      montar();
    });
    pCab.addEventListener('click', (e) => {
      if (!e.target.closest('[data-accion=imprimir]')) return;
      const o = orgs.find((x) => x.id === org);
      imprimir(`Centros de costo · ${o.nombre}`, 'Administración de centros de costo', arbol.filas(), 'centro_mayor_id',
        [{ titulo: 'Integra', valor: (f) => f.integra ? 'Sí' : 'No' }]);
    });

    pintarCabecera();
    montar();
  };
})();
