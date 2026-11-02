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
        tr.n1 td { font-weight: 700; } tr.inactiva td { color: #8a94a6; }
      </style></head><body>
      <h1>${esc(titulo)}</h1><p>${esc(subtitulo)} · ${orden.length} registros · Impreso el ${new Date().toLocaleString('es-GT')}</p>
      <table><thead><tr><th>Código</th><th>Nombre</th><th>Nivel</th>${columnas.map((c) => `<th>${esc(c.titulo)}</th>`).join('')}<th>Vigente</th></tr></thead><tbody>
      ${orden.map((f) => `<tr class="n${f.nivel} ${f.vigente ? '' : 'inactiva'}"><td>${esc(f.codigo)}</td><td style="padding-left:${8 + (f.nivel - 1) * 16}px">${esc(f.nombre)}</td><td>${f.nivel}</td>${columnas.map((c) => `<td>${c.valor(f)}</td>`).join('')}<td>${f.vigente ? 'Sí' : 'No'}</td></tr>`).join('')}
      </tbody></table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  const titulosCuentas = ['Cuenta principal', 'Subcuenta', ...Array.from({ length: 8 }, (_, i) => `Subcuenta de nivel ${i + 3}`)];
  const titulosCentros = ['Primer nivel', 'Segundo nivel', 'Tercer nivel', 'Cuarto nivel', 'Quinto nivel', 'Sexto nivel', 'Séptimo nivel', 'Octavo nivel'];

  window.PANTALLAS = window.PANTALLAS || {};

  // ---------- Cuentas contables ----------
  window.PANTALLAS.cuentas = async function (cont, m) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    const estado = { orgs: [], org: null, versiones: [], version: null, tipos: [], arbol: null };

    try {
      const [orgs, tipos] = await Promise.all([organizaciones(sb), sb.from('tipos_cuenta').select('id, codigo, descripcion, activo').order('codigo')]);
      if (tipos.error) throw tipos.error;
      estado.orgs = orgs;
      estado.tipos = tipos.data;
    } catch (err) { cont.innerHTML = `<p class="vacio">${esc(err.message)}</p>`; return; }
    if (!estado.orgs.length) { cont.innerHTML = sinOrganizaciones(m); return; }
    estado.org = estado.orgs[0].id;

    cont.innerHTML = '<section class="panel" id="p-versiones"></section><div id="arbol"></div>';
    const pVer = cont.querySelector('#p-versiones');
    const tipoDe = (id) => estado.tipos.find((t) => t.id === id);

    async function cargarVersiones(seleccion) {
      const { data, error } = await sb.from('catalogos_cuentas').select('*').eq('organizacion_id', estado.org).order('version', { ascending: false });
      if (error) { pVer.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      estado.versiones = data;
      const previo = seleccion || (estado.version && estado.version.id);
      estado.version = data.find((v) => v.id === previo) || data.find((v) => v.activo) || data[0] || null;
      pintarVersiones();
      montarArbol();
    }

    function pintarVersiones() {
      const org = estado.orgs.find((o) => o.id === estado.org);
      pVer.innerHTML = `
        <div class="panel-cab">
          <h2>Catálogo de cuentas</h2>
          <div class="panel-acciones">
            <label class="selector-org">Empresa <select data-org>${opcionesOrg(estado.orgs, estado.org)}</select></label>
            ${estado.version ? '<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>' : ''}
            ${editable ? '<button type="button" class="boton primario-sm" data-accion="nueva-version">+ Versión</button>' : ''}
          </div>
        </div>
        ${tabla({
          id: 'versiones', editable, seleccionado: estado.version && estado.version.id,
          vacio: `${org.nombre} todavía no tiene un catálogo de cuentas. Crea la versión 1.`,
          columnas: [
            { titulo: 'Versión', valor: (f) => f.version, clase: 'angosta' },
            { titulo: 'Del', valor: (f) => fechaCorta(f.fecha_del) },
            { titulo: 'Al', valor: (f) => fechaCorta(f.fecha_al) || 'Vigente' },
            { titulo: 'Empresa', valor: () => esc(org.nombre), clase: 'fuerte' },
            { titulo: 'Estado', valor: (f) => window.UI.estado(f.activo) }
          ],
          filas: estado.versiones
        })}`;
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
          d.organizacion_id = estado.org;
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
        titulos: titulosCuentas, etiquetaCodigo: 'Cuenta', etiquetaMayor: 'Cuenta mayor', editable,
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
      if (!e.target.matches('[data-org]')) return;
      estado.org = Number(e.target.value);
      estado.version = null;
      cargarVersiones();
    });
    pVer.addEventListener('click', (e) => {
      const accion = e.target.closest('[data-accion]');
      if (accion && accion.dataset.accion === 'nueva-version') return formVersion();
      if (accion && accion.dataset.accion === 'imprimir') {
        const org = estado.orgs.find((o) => o.id === estado.org);
        const v = estado.version;
        return imprimir(`Catálogo de cuentas · ${org.nombre}`, `Versión ${v.version}, del ${fechaCorta(v.fecha_del)} al ${fechaCorta(v.fecha_al) || 'vigente'}`,
          estado.arbol.filas(), 'cuenta_mayor_id',
          [{ titulo: 'Tipo cuenta', valor: (f) => esc((tipoDe(f.tipo_cuenta_id) || {}).descripcion || '') },
           { titulo: 'Integración', valor: (f) => f.integra ? 'Sí' : 'No' },
           { titulo: 'Cta. anterior', valor: (f) => esc(f.cuenta_anterior || '') }]);
      }
      const ed = e.target.closest('[data-editar]');
      if (ed) return formVersion(estado.versiones.find((v) => String(v.id) === ed.dataset.editar));
      const tr = e.target.closest('tr[data-id]');
      if (tr && Number(tr.dataset.id) !== (estado.version && estado.version.id)) {
        estado.version = estado.versiones.find((v) => String(v.id) === tr.dataset.id);
        pintarVersiones();
        montarArbol();
      }
    });

    cargarVersiones();
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

    cont.innerHTML = `
      <section class="panel">
        <div class="panel-cab">
          <h2>Administración de centros de costo</h2>
          <div class="panel-acciones">
            <label class="selector-org">Empresa <select data-org>${opcionesOrg(orgs, org)}</select></label>
            <button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>
          </div>
        </div>
      </section>
      <div id="arbol"></div>`;

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
        antesDeGuardar: (d) => { d.nombre = d.nombre.toUpperCase(); }
      });
    }

    cont.addEventListener('change', (e) => {
      if (!e.target.matches('[data-org]')) return;
      org = Number(e.target.value);
      montar();
    });
    cont.querySelector('[data-accion=imprimir]').addEventListener('click', () => {
      const o = orgs.find((x) => x.id === org);
      imprimir(`Centros de costo · ${o.nombre}`, 'Administración de centros de costo', arbol.filas(), 'centro_mayor_id',
        [{ titulo: 'Integra', valor: (f) => f.integra ? 'Sí' : 'No' }]);
    });

    montar();
  };
})();
