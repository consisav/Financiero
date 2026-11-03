// Contabilidad · Cuentas contables y Centros de costos. Las dos pantallas comparten la misma
// estructura: organización → localidad → versión del catálogo → árbol de tres bloques con ficha
// única (js/jerarquia.js). Cada una se define con una configuración (ver CATALOGOS más abajo).
(function () {
  const { esc, fechaCorta, formulario } = window.UI;

  const siNo = (v) => `<span class="estado ${v ? 'activo' : 'inactivo'}">${v ? 'Sí' : 'No'}</span>`;
  const fichaDato = (etiqueta, valor) => `<div class="ficha-dato"><span>${esc(etiqueta)}</span><b>${valor || '—'}</b></div>`;

  async function organizaciones(sb) {
    const { data, error } = await sb.from('organizaciones').select('id, codigo, nombre').eq('activo', true).order('codigo');
    if (error) throw error;
    return data;
  }
  const opcionesOrg = (orgs, id) => orgs.map((o) => `<option value="${o.id}" ${o.id === id ? 'selected' : ''}>${o.codigo} · ${esc(o.nombre)}</option>`).join('');
  const sinOrganizaciones = (m) => `<p class="vacio">Primero crea una organización en <a href="#/${m.id}/organizaciones">Catálogos · Organizaciones</a>.</p>`;

  // Listado imprimible del árbol completo, en orden jerárquico; las filas que integran van resaltadas.
  function imprimir(titulo, subtitulo, filas, padre, columnas) {
    const hijos = (id) => filas.filter((f) => (f[padre] ?? null) === id).sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
    // Sangría de unos tres espacios por nivel, en el código y en el nombre.
    const sangria = (nivel) => `calc(8px + ${((nivel - 1) * 1.1).toFixed(1)}em)`;
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
      ${orden.map((f) => `<tr class="n${f.nivel} ${f.integra ? 'integra' : ''} ${f.vigente ? '' : 'inactiva'}"><td style="padding-left:${sangria(f.nivel)}">${esc(f.codigo)}</td><td style="padding-left:${sangria(f.nivel)}">${esc(f.nombre)}</td><td>${f.nivel}</td>${columnas.map((c) => `<td>${c.valor(f)}</td>`).join('')}<td>${f.vigente ? 'Sí' : 'No'}</td></tr>`).join('')}
      </tbody></table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  const titulos = (principal, sub) => [`${principal} principal`, `Sub-${sub}`, `Sub-sub-${sub}`, ...Array.from({ length: 7 }, (_, i) => `Sub-${sub} de nivel ${i + 4}`)];

  // ---------- Pantalla de catálogo jerárquico por organización, localidad y versión ----------
  async function pantallaCatalogo(cont, m, cfg) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    const estado = { orgs: [], org: null, locs: [], loc: null, versiones: [], version: null, arbol: null, contexto: false, ctx: {} };

    try {
      estado.orgs = await organizaciones(sb);
      estado.ctx = cfg.preparar ? await cfg.preparar(sb) : {};
    } catch (err) { cont.innerHTML = `<p class="vacio">${esc(err.message)}</p>`; return; }
    if (!estado.orgs.length) { cont.innerHTML = sinOrganizaciones(m); return; }
    estado.org = estado.orgs[0].id;

    cont.innerHTML = '<section class="panel cc-encabezado" id="p-versiones"></section><div id="arbol"></div>';
    const pVer = cont.querySelector('#p-versiones');

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
      const { data, error } = await sb.from(cfg.tablaVersiones).select('*').eq('localidad_id', estado.loc).order('version', { ascending: false });
      if (error) {
        pVer.innerHTML = error.code === '42703' || error.code === 'PGRST205' || /does not exist|schema cache/.test(error.message)
          ? `<p class="vacio">Falta instalar en Supabase el script <b>${cfg.script}</b>. Ejecútalo en el SQL Editor y recarga esta página.</p>`
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
    const textoVersion = (v) => `Versión ${v.version} · ${fechaCorta(v.fecha_del)} al ${fechaCorta(v.fecha_al) || 'vigente'}${v.activo ? '' : ' (inactiva)'}`;

    // Empresa, localidad y versión quedan ocultas tras el botón de contexto; a la vista solo Imprimir.
    function pintarVersiones() {
      const org = estado.orgs.find((o) => o.id === estado.org);
      const loc = locActual();
      const v = estado.version;
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
        ${!loc ? `<p class="vacio">${esc(org.nombre)} todavía no tiene localidades. ${esc(cfg.nombreCatalogo.charAt(0).toUpperCase() + cfg.nombreCatalogo.slice(1))} pertenece a una localidad: crea una en <a href="#/${m.id}/organizaciones">Catálogos · Organizaciones</a>.</p>`
          : !v ? `<p class="vacio">${esc(loc.codigo)} · ${esc(loc.nombre_comercial)} todavía no tiene ${esc(cfg.nombreCatalogo)}.${editable ? ' Crea la versión 1 con «+ Versión».' : ''}</p>` : ''}`;
    }

    function pintarCifras(filas) {
      const caja = pVer.querySelector('#cc-cifras');
      if (!caja) return;
      const aviso = pVer.querySelector('#cc-plantilla');
      if (aviso) aviso.innerHTML = !filas.length && editable && cfg.plantilla ? cfg.plantilla.aviso : '';
      const niveles = filas.reduce((n, f) => Math.max(n, f.nivel), 0);
      const vigentes = filas.filter((f) => f.vigente).length;
      const resumen = pVer.querySelector('#cc-resumen');
      if (resumen) resumen.textContent = ` · ${filas.length} ${cfg.unidad}`;
      caja.innerHTML = `
        <span class="rm-stats" role="list" aria-label="Resumen del catálogo">
          <span class="rm-stat" role="listitem"><i class="ti ${cfg.icono}" aria-hidden="true"></i><b>${filas.length}</b> ${cfg.unidad}</span>
          <span class="rm-stat" role="listitem"><i class="ti ti-stack-2" aria-hidden="true"></i><b>${niveles}</b> nivel${niveles === 1 ? '' : 'es'}</span>
          <span class="rm-stat ${filas.length - vigentes ? 'aviso' : ''}" role="listitem"><i class="ti ti-circle-check" aria-hidden="true"></i><b>${vigentes}</b> vigentes</span>
        </span>`;
    }

    function formVersion(fila) {
      formulario({
        titulo: fila ? `Modificar versión ${fila.version}` : `Nueva versión del ${cfg.nombreCatalogo}`,
        valores: fila || { version: Math.max(0, ...estado.versiones.map((v) => v.version)) + 1, fecha_del: new Date().toISOString().slice(0, 10), activo: true },
        campos: [
          { nombre: 'version', etiqueta: 'Versión', tipo: 'numero', requerido: true },
          { nombre: 'fecha_del', etiqueta: 'Vigente del', tipo: 'fecha', requerido: true },
          { nombre: 'fecha_al', etiqueta: 'Vigente al', tipo: 'fecha' },
          { nombre: 'activo', etiqueta: 'Activa', tipo: 'casilla' }
        ],
        alGuardar: async (d) => {
          if (!fila) Object.assign(d, { organizacion_id: estado.org, localidad_id: estado.loc });
          const r = fila ? await sb.from(cfg.tablaVersiones).update(d).eq('id', fila.id).select('id').single()
                         : await sb.from(cfg.tablaVersiones).insert(d).select('id').single();
          if (r.error) {
            if (/check constraint/i.test(r.error.message)) throw new Error('La fecha "al" no puede ser anterior a la fecha "del".');
            if (/duplicate|unique/i.test(r.error.message)) throw new Error(`Ya existe la versión ${d.version} en esta localidad.`);
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
      estado.arbol = window.Jerarquia(div, {
        ...cfg.arbol(estado.ctx),
        filtro: { catalogo_id: estado.version.id },
        editable, fichaUnica: true, alCargar: pintarCifras,
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
      const a = accion && accion.dataset.accion;
      if (a === 'contexto') {
        estado.contexto = accion.getAttribute('aria-expanded') !== 'true';
        accion.setAttribute('aria-expanded', String(estado.contexto));
        accion.classList.toggle('abierto', estado.contexto);
        pVer.querySelector('.cc-panel').hidden = !estado.contexto;
        return;
      }
      if (a === 'nueva-version') return formVersion();
      if (a === 'cargar-estandar' && cfg.plantilla) {
        accion.disabled = true;
        accion.textContent = 'Cargando…';
        cfg.plantilla.cargar(sb, estado.version.id).then(({ data, error }) => {
          if (error) {
            accion.disabled = false;
            accion.textContent = 'Cargar catálogo estándar';
            window.FIN.aviso(cfg.plantilla.error(error));
            return;
          }
          window.FIN.aviso(`Catálogo estándar cargado: ${data} ${cfg.unidad}`);
          montarArbol();
        });
        return;
      }
      if (a === 'imprimir') {
        const org = estado.orgs.find((o) => o.id === estado.org);
        const loc = locActual();
        const v = estado.version;
        return imprimir(`${cfg.tituloImpresion} · ${org.nombre}`, `Localidad ${loc.codigo} · ${loc.nombre_comercial} · Versión ${v.version}, del ${fechaCorta(v.fecha_del)} al ${fechaCorta(v.fecha_al) || 'vigente'}`,
          estado.arbol.filas(), cfg.arbol(estado.ctx).padre, cfg.columnasImpresion(estado.ctx));
      }
      const ed = e.target.closest('[data-editar-version]');
      if (ed) return formVersion(estado.versiones.find((v) => String(v.id) === ed.dataset.editarVersion));
    });

    cargarLocalidades();
  }

  // ---------- Configuración de cada catálogo ----------
  const CATALOGOS = {
    cuentas: {
      tablaVersiones: 'catalogos_cuentas', nombreCatalogo: 'catálogo de cuentas', unidad: 'cuentas', icono: 'ti-list-tree',
      tituloImpresion: 'Catálogo de cuentas', script: '20261102000005_cuentas_por_localidad.sql',
      preparar: async (sb) => {
        const { data, error } = await sb.from('tipos_cuenta').select('id, codigo, descripcion, activo').order('codigo');
        if (error) throw error;
        return { tipos: data };
      },
      arbol: ({ tipos }) => {
        const tipoDe = (id) => (tipos.find((t) => t.id === id) || {}).descripcion || '';
        const tiposActivos = tipos.filter((t) => t.activo).map((t) => ({ valor: t.id, texto: `${t.codigo} · ${t.descripcion}` }));
        return {
          tabla: 'cuentas', padre: 'cuenta_mayor_id',
          titulos: titulos('Cuenta', 'cuenta'), etiquetaCodigo: 'Cuenta', etiquetaMayor: 'Cuenta mayor', etiquetaHijos: 'Sub-cuentas',
          columnas: [
            { titulo: 'Tipo cuenta', valor: (f) => esc(tipoDe(f.tipo_cuenta_id)) },
            { titulo: 'Integración', valor: (f) => siNo(f.integra) }
          ],
          ficha: (f) => fichaDato('Tipo cuenta', esc(tipoDe(f.tipo_cuenta_id))) + fichaDato('Integración', siNo(f.integra)) + fichaDato('Cta. anterior', esc(f.cuenta_anterior)),
          valores: (mayor, hermanos) => ({ codigo: window.Jerarquia.siguienteCodigo(mayor, hermanos), integra: true, vigente: true }),
          campos: (fila, mayor) => [
            { nombre: 'codigo', etiqueta: 'Cuenta', requerido: true, soloLectura: !!fila, patron: '[0-9]+', placeholder: mayor ? `Debe comenzar con ${mayor.codigo}` : '1' },
            { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
            ...(!mayor ? [{ nombre: 'tipo_cuenta_id', etiqueta: 'Tipo cuenta', tipo: 'select-numero', opciones: tiposActivos, requerido: true }] : []),
            { nombre: 'cuenta_anterior', etiqueta: 'Cta. anterior' },
            { nombre: 'integra', etiqueta: 'Integración', tipo: 'casilla' },
            { nombre: 'vigente', etiqueta: 'Vigente', tipo: 'casilla' }
          ]
        };
      },
      columnasImpresion: ({ tipos }) => [
        { titulo: 'Tipo cuenta', valor: (f) => esc((tipos.find((t) => t.id === f.tipo_cuenta_id) || {}).descripcion || '') },
        { titulo: 'Integración', valor: (f) => f.integra ? 'Sí' : 'No' },
        { titulo: 'Cta. anterior', valor: (f) => esc(f.cuenta_anterior || '') }
      ],
      plantilla: {
        aviso: `
          <div class="cc-plantilla">
            <i class="ti ti-book-2" aria-hidden="true"></i>
            <div><b>Esta versión todavía no tiene cuentas.</b>
              <p>Puedes empezar con el catálogo estándar de Guatemala: 200 cuentas en 4 niveles basadas en NIIF, con IVA, ISR, ISO, IGSS, IRTRA, INTECAP, prestaciones laborales y reserva legal. Después lo ajustas a tu empresa.</p></div>
            <button type="button" class="boton primario-sm" data-accion="cargar-estandar">Cargar catálogo estándar</button>
          </div>`,
        cargar: (sb, catalogo) => sb.rpc('cargar_plantilla_cuentas', { p_catalogo: catalogo }),
        error: (e) => /cargar_plantilla_cuentas/.test(e.message) ? 'Falta instalar en Supabase el script 20261102000013_catalogo_estandar_guatemala.sql.' : window.UI.traducirError(e)
      }
    },

    'centros-costo': {
      tablaVersiones: 'catalogos_centros', nombreCatalogo: 'catálogo de centros de costo', unidad: 'centros', icono: 'ti-hierarchy-2',
      tituloImpresion: 'Centros de costo', script: '20261102000014_centros_por_localidad_y_version.sql',
      arbol: () => ({
        tabla: 'centros_costo', padre: 'centro_mayor_id',
        titulos: titulos('Centro', 'centro'), etiquetaCodigo: 'Centro', etiquetaMayor: 'Centro mayor', etiquetaHijos: 'Sub-centros',
        columnas: [{ titulo: 'Integración', valor: (f) => siNo(f.integra) }],
        ficha: (f) => fichaDato('Integración', siNo(f.integra)) + fichaDato('Centro anterior', esc(f.centro_anterior)),
        valores: (mayor, hermanos) => ({ codigo: window.Jerarquia.siguienteCodigo(mayor, hermanos), integra: true, vigente: true }),
        campos: (fila, mayor) => [
          { nombre: 'codigo', etiqueta: 'Centro', requerido: true, soloLectura: !!fila, patron: '[0-9]+', placeholder: mayor ? `Debe comenzar con ${mayor.codigo}` : '1' },
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
          { nombre: 'centro_anterior', etiqueta: 'Centro anterior' },
          { nombre: 'integra', etiqueta: 'Integración', tipo: 'casilla' },
          { nombre: 'vigente', etiqueta: 'Vigente', tipo: 'casilla' }
        ]
      }),
      columnasImpresion: () => [
        { titulo: 'Integración', valor: (f) => f.integra ? 'Sí' : 'No' },
        { titulo: 'Centro anterior', valor: (f) => esc(f.centro_anterior || '') }
      ]
    }
  };

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS.cuentas = (cont, m) => pantallaCatalogo(cont, m, CATALOGOS.cuentas);
  window.PANTALLAS['centros-costo'] = (cont, m) => pantallaCatalogo(cont, m, CATALOGOS['centros-costo']);
})();
