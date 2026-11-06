// Compras · Registros: Clasificación compras, Tipo documento y Contraseñas de pago.
//   Clasificación compras y Tipo documento: tablas generales que se editan en la misma lista
//   (número automático, descripción y sus marcas). Las usa Facturas de compra: la clasificación
//   dice si va al libro de compras y si aplica IVA; el tipo de documento, cómo se calcula el IVA y
//   si es recibo.
//   Contraseñas de pago (recepción de facturas): arriba las recepciones con sus filtros y abajo la
//   recepción elegida: número, fecha y usuario, proveedor, tipo de compra (inmediato o crédito),
//   fecha estimada de pago y estado, y el detalle de documentos recibidos (serie, número, fecha,
//   valor y la compra registrada). Se autoriza, se imprime la contraseña, se liquida cuando sus
//   compras ya están pagadas («Liquidar contraseñas» liquida todas las que ya lo están) y se anula.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;

  // ===================== Catálogos en lista editable =====================
  // cfg.local: el catálogo es de cada localidad (lleva el selector de empresa). cfg.grupo y
  // cfg.script: el texto de arriba del título y el script que lo instala.
  const seleccion = { loc: null };
  let localidades = null, organizaciones = [];
  function catalogo(cont, cfg) {
    const sb = window.FIN.sb;
    const ed = window.FIN.puedeEditarCatalogos();
    let filas = [];
    let buscar = '';
    cont.innerHTML = `<div class="cg-espacio"><section class="panel cg-panel cl-clasico"></section></div>`;
    const panel = cont.querySelector('.cg-panel');
    const loc = () => localidades?.find((l) => l.id === seleccion.loc);

    async function cargar() {
      if (cfg.local && !localidades) {
        const [o, l] = await Promise.all([sb.from('organizaciones').select('id, codigo, nombre').eq('activo', true).order('codigo'), sb.from('localidades').select('id, codigo, nombre_comercial, organizacion_id').eq('activo', true).order('organizacion_id').order('correlativo')]);
        organizaciones = o.data || []; localidades = l.data || [];
      }
      if (cfg.local && !loc()) seleccion.loc = (localidades.find((l) => l.id === window.FIN.perfil().localidad_id) || localidades[0])?.id || null;
      let q = sb.from(cfg.tabla).select('*').order('codigo');
      if (cfg.local) q = q.eq('localidad_id', seleccion.loc || 0);
      const { data, error } = await q;
      if (error) { panel.innerHTML = `<p class="vacio">${/does not exist|schema cache/.test(error.message) ? `Falta instalar el script ${cfg.script || '58 (clasificaciones, tipos de documento y contraseñas de pago)'} en Supabase.` : esc(error.message)}</p>`; return; }
      filas = (data || []).map((x) => ({ ...x, _orig: JSON.stringify(datos(x)) }));
      pintar();
    }
    const datos = (x) => Object.fromEntries([...cfg.columnas.map((c) => [c.k, x[c.k] ?? (c.tipo === 'check' ? false : '')]), ['activo', x.activo !== false]]);
    const cambiadas = () => filas.filter((x) => !x.id || JSON.stringify(datos(x)) !== x._orig);

    function pintar() {
      const q = buscar.trim().toLowerCase();
      const vis = filas.filter((x) => !q || [x.codigo, ...cfg.columnas.map((c) => x[c.k])].some((v) => String(v ?? '').toLowerCase().includes(q)));
      const n = cambiadas().length;
      panel.innerHTML = `
        <div class="cl-banda">${esc(cfg.titulo)}</div>
        <header class="cg-cab">
          <span class="tk-icono"><i class="ti ${cfg.icono}" aria-hidden="true"></i></span>
          <div class="cg-titulo"><small>${esc(cfg.grupo || 'Compras · Catálogos')} · ${filas.length} registros</small><p>${esc(cfg.descripcion)}</p></div>
          ${cfg.local ? `<label class="campo cg-empresa"><span>Empresa</span><select data-empresa>${organizaciones.map((o) => ({ o, ls: localidades.filter((l) => l.organizacion_id === o.id) })).filter((g) => g.ls.length).map((g) => `<optgroup label="${g.o.codigo} · ${esc(g.o.nombre)}">${g.ls.map((l) => `<option value="${l.id}" ${l.id === seleccion.loc ? 'selected' : ''}>${esc(l.codigo)} · ${esc(l.nombre_comercial)}</option>`).join('')}</optgroup>`).join('')}</select></label>` : ''}
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar…" value="${esc(buscar)}" aria-label="Buscar"></label>
          ${ed ? `<button type="button" class="boton secundario-sm" data-accion="agregar"><i class="ti ti-plus" aria-hidden="true"></i> Agregar</button>
            <button type="button" class="boton primario-sm" data-accion="guardar" ${n ? '' : 'disabled'}><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar cambios${n ? ` (${n})` : ''}</button>` : ''}
        </header>
        <p class="modal-error tk-error cg-error" role="alert"></p>
        <div class="pc-lineas cg-tabla"><table>
          <thead><tr><th class="cg-cod">${esc(cfg.codigo)}</th>${cfg.columnas.map((c) => `<th class="${c.tipo === 'check' ? 'cg-chk' : ''}" ${c.ancho ? `style="width:${c.ancho}"` : ''} title="${esc(c.ayuda || '')}">${esc(c.t)}${c.req ? ' *' : ''}</th>`).join('')}<th class="cg-chk">Activo</th></tr></thead>
          <tbody>${vis.map((x) => { const i = filas.indexOf(x); return `<tr data-fila="${i}" class="${!x.id ? 'cg-nueva' : JSON.stringify(datos(x)) !== x._orig ? 'cg-cambio' : ''} ${x.activo === false ? 'cg-inactiva' : ''}">
            <td class="cg-cod">${x.codigo ?? '<span class="tk-tenue">Nuevo</span>'}</td>
            ${cfg.columnas.map((c) => `<td class="${c.tipo === 'check' ? 'cg-chk' : ''}">${c.tipo === 'check' ? `<input type="checkbox" data-k="${c.k}" ${x[c.k] ? 'checked' : ''} ${ed ? '' : 'disabled'} aria-label="${esc(c.t)}">`
              : c.tipo === 'numero' ? `<input type="number" step="0.01" min="0" ${c.maximo ? `max="${c.maximo}"` : ''} data-k="${c.k}" value="${esc(String(x[c.k] ?? 0))}" class="cg-num" ${ed ? '' : 'disabled'} aria-label="${esc(c.t)}">`
              : c.tipo === 'select' ? `<select data-k="${c.k}" ${ed ? '' : 'disabled'} aria-label="${esc(c.t)}">${c.opciones.map(([v, t]) => `<option value="${v}" ${x[c.k] === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`
              : `<input data-k="${c.k}" value="${esc(x[c.k] ?? '')}" maxlength="${c.max || 120}" ${c.k === 'siglas' ? 'class="cg-siglas"' : ''} ${ed ? '' : 'disabled'} aria-label="${esc(c.t)}">`}</td>`).join('')}
            <td class="cg-chk"><input type="checkbox" data-k="activo" ${x.activo !== false ? 'checked' : ''} ${ed ? '' : 'disabled'} aria-label="Activo"></td></tr>`; }).join('')
            || `<tr><td colspan="${cfg.columnas.length + 2}" class="tk-vacio">${filas.length ? 'Nada coincide con la búsqueda.' : 'No hay registros.'}</td></tr>`}</tbody>
        </table></div>
        <footer class="cg-pie">${cfg.leyenda || ''}</footer>`;
    }

    async function guardar() {
      const error = panel.querySelector('.cg-error');
      const lista = cambiadas();
      for (const x of lista) {
        for (const c of cfg.columnas) if (c.req && !String(x[c.k] ?? '').trim()) { error.textContent = `Escribe ${c.t.toLowerCase()} en la fila ${x.codigo ?? 'nueva'}.`; return; }
        if (x.siglas && !/^[A-Za-z0-9]{1,6}$/.test(String(x.siglas).trim())) { error.textContent = `Las siglas de «${x.nombre}» deben ser de 1 a 6 letras o números.`; return; }
      }
      const nombres = filas.map((x) => String(x.nombre || '').trim().toUpperCase());
      const rep = nombres.find((n, i) => n && nombres.indexOf(n) !== i);
      if (rep) { error.textContent = `La descripción «${rep}» está repetida.`; return; }
      error.textContent = '';
      let siguiente = Math.max(0, ...filas.map((x) => x.codigo || 0));
      for (const x of lista) {
        const v = datos(x);
        cfg.columnas.forEach((c) => { if (c.tipo === 'numero') v[c.k] = Number(v[c.k]) || 0; else if (c.tipo !== 'check' && c.tipo !== 'select') v[c.k] = String(v[c.k] ?? '').trim() || null; });
        if (cfg.local && x.id) { delete v.organizacion_id; delete v.localidad_id; }
        const nueva = { ...v, codigo: ++siguiente, ...(cfg.local ? { organizacion_id: loc()?.organizacion_id, localidad_id: seleccion.loc } : {}) };
        const r = x.id ? await sb.from(cfg.tabla).update(v).eq('id', x.id) : await sb.from(cfg.tabla).insert(nueva);
        if (r.error) { error.textContent = window.UI.traducirError(r.error); return cargarConservando(); }
      }
      window.FIN.aviso(`${lista.length} cambio(s) guardado(s)`);
      await cargar();
    }
    async function cargarConservando() { const pend = filas.filter((x) => !x.id); await cargar(); filas.push(...pend); pintar(); }

    panel.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar]')) { buscar = e.target.value; const pos = e.target.selectionStart; pintar(); const b = panel.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos); return; }
      const tr = e.target.closest('tr[data-fila]');
      if (!tr || e.target.type === 'checkbox') return;
      filas[Number(tr.dataset.fila)][e.target.dataset.k] = e.target.value;
      const n = cambiadas().length;
      const b = panel.querySelector('[data-accion=guardar]');
      if (b) { b.disabled = !n; b.innerHTML = `<i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar cambios${n ? ` (${n})` : ''}`; }
      tr.classList.toggle('cg-cambio', !!filas[Number(tr.dataset.fila)].id);
    });
    panel.addEventListener('change', (e) => {
      if (e.target.matches('[data-empresa]')) {
        if (cambiadas().length && !confirm('Hay cambios sin guardar en esta empresa. ¿Cambiar de empresa y descartarlos?')) { e.target.value = String(seleccion.loc); return; }
        seleccion.loc = Number(e.target.value); buscar = ''; return cargar();
      }
      const tr = e.target.closest('tr[data-fila]');
      if (!tr) return;
      const x = filas[Number(tr.dataset.fila)];
      x[e.target.dataset.k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') pintar();
    });
    panel.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-buscar]')) e.preventDefault(); });
    panel.addEventListener('click', (e) => {
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'agregar') { buscar = ''; filas.push({ codigo: null, ...Object.fromEntries(cfg.columnas.map((c) => [c.k, c.defecto ?? (c.tipo === 'check' ? false : '')])), activo: true }); pintar(); const ins = panel.querySelectorAll('tr.cg-nueva [data-k=nombre]'); ins[ins.length - 1]?.focus(); }
      if (a === 'guardar') guardar();
    });
    cargar();
  }

  window.CATALOGO_GRID = catalogo;
  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['clasificaciones-compra'] = (cont) => catalogo(cont, {
    tabla: 'clasificaciones_compra', titulo: 'Clasificaciones compras', icono: 'ti-tags', codigo: 'Clasificación',
    descripcion: 'Clasificación fiscal de cada compra: si se incluye en el libro de compras, si aplica IVA y si aplica inventarios.',
    columnas: [
      { k: 'nombre', t: 'Descripción', req: true, max: 80 },
      { k: 'siglas', t: 'Siglas (migración doctos.)', ancho: '110px', max: 6, ayuda: 'Siglas con las que llegan los documentos en la migración' },
      { k: 'libro_compras', t: 'Incluir libro compras', tipo: 'check', defecto: true },
      { k: 'aplica_iva', t: 'Aplicar IVA', tipo: 'check', defecto: true },
      { k: 'aplica_inventario', t: 'Aplica inventarios', tipo: 'check', defecto: true, ayuda: 'Las compras de esta clasificación pueden cargar sus artículos al inventario' }
    ],
    leyenda: '<i class="ti ti-info-circle" aria-hidden="true"></i> Con «Aplicar IVA» desmarcado, la compra no lleva IVA aunque el documento sea factura (exentos, no deducibles, importaciones).'
  });
  window.PANTALLAS['tipos-documento-compra'] = (cont) => catalogo(cont, {
    tabla: 'tipos_documento_compra', titulo: 'Tipos de documento', icono: 'ti-file-description', codigo: 'Tipo documento',
    descripcion: 'Documentos con que se registran las compras y cómo se calcula su IVA.',
    columnas: [
      { k: 'nombre', t: 'Descripción', req: true, max: 80 },
      { k: 'calculo_iva', t: 'Cálculo del IVA', tipo: 'select', ancho: '190px', defecto: 'NORMAL', opciones: [['NORMAL', 'Normal (incluido)'], ['SIN IVA', 'Sin IVA'], ['IMPORTACIÓN', 'De importación']] },
      { k: 'es_recibo', t: 'Es recibo', tipo: 'check', ayuda: 'No es factura: en Generación cheques aparece como recibo' }
    ],
    leyenda: '<i class="ti ti-info-circle" aria-hidden="true"></i> Normal: el IVA va incluido en el total. De importación: el IVA es el de la póliza (IVA importación). Sin IVA: recibos, pequeño contribuyente, formularios.'
  });

  // ===================== Contraseñas de pago =====================
  const ESTADOS = ['PENDIENTE', 'AUTORIZADA', 'LIQUIDADA', 'ANULADA'];
  const CLASE = { PENDIENTE: 'pendiente', AUTORIZADA: 'aprobada', LIQUIDADA: 'definitiva', ANULADA: 'anulada' };
  const marca = (e) => `<span class="pc-marca ${CLASE[e]}">${e.charAt(0) + e.slice(1).toLowerCase()}</span>`;
  const sumaDias = (fecha, dias) => { const d = new Date(`${fecha}T12:00:00`); d.setDate(d.getDate() + Number(dias || 0)); return d.toISOString().slice(0, 10); };

  window.PANTALLAS['contrasenas-pago'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Contraseñas de pago', icono: 'ti-key', clase: 'bk-movimientos bk-contrasenas', grupo: 'Compras · Registros' });
    const { sb, yo } = ctx;
    const [anio, mes] = fmt.hoy().split('-');
    const f = { estado: 'TODAS', desde: `${anio}-${String(Number(mes) - 1 || 1).padStart(2, '0')}-01`, hasta: fmt.hoy() };
    let lista = [];
    let proveedores = [];
    let compras = [];     // compras vigentes de la localidad, para enlazar
    let actual = null;
    let docs = [];
    let editando = false;
    let pestana = 'DOCS';
    let buscar = '';
    const proveedor = (id) => proveedores.find((p) => p.id === id);
    const provTxt = (p) => `${p.codigo} · ${p.nombre_comercial}${p.nit ? ` · ${p.nit}` : ''}`;
    const proveedorDe = (t0) => { const t = String(t0 || '').trim().toUpperCase(); return t ? proveedores.find((p) => provTxt(p).toUpperCase() === t) || proveedores.find((p) => String(p.codigo) === t || (p.nit && p.nit === t) || p.nombre_comercial === t) || null : null; };
    const compra = (id) => compras.find((c) => c.id === id);
    const docTxt = (c) => `${c.serie ? `${c.serie}-` : ''}${c.documento}`;
    const total = () => fmt.redondear(docs.reduce((t, d) => t + Number(d.valor || 0), 0));

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Estado</span><select name="estado">${['TODAS', ...ESTADOS].map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label class="campo"><span>Recepción desde</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Recepción hasta</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>`,
        `<button type="button" class="boton secundario-sm" data-accion="lista"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir lista</button>
         ${ctx.admin ? `<button type="button" class="boton primario-sm" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva recepción</button>` : ''}`);
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('contrasenas_pago').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/contrasenas_pago/.test(prueba.error.message) ? 'Falta instalar el script 58 (clasificaciones, tipos de documento y contraseñas de pago) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      pintarFiltros();
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      const { data } = loc ? await sb.from('proveedores').select('id, codigo, nit, nombre_comercial, nombre_fiscal, dias_credito, estado').eq('localidad_id', loc).order('nombre_comercial') : { data: [] };
      proveedores = data || [];
      actual = null; editando = false;
      await consultar();
    }
    async function cargarCompras() {
      const { data } = ctx.sel.loc ? await sb.from('compras_saldo').select('id, numero, serie, documento, fecha_documento, neto, pendiente, proveedor_id, proveedor_nombre, nit, contrasena_id, estado, moneda_id').eq('localidad_id', ctx.sel.loc).eq('estado', 'ACTIVA').order('numero', { ascending: false }).limit(1000) : { data: [] };
      compras = data || [];
    }
    async function consultar(id = actual?.id) {
      if (!ctx.sel.loc) { lista = []; pintarLista(); return abrir(null); }
      let q = sb.from('contrasenas_pago').select('*, contrasena_documentos(valor, compra_id)').eq('localidad_id', ctx.sel.loc).order('numero', { ascending: false });
      if (f.estado !== 'TODAS') q = q.eq('estado', f.estado);
      if (f.estado === 'TODAS' || f.estado === 'LIQUIDADA' || f.estado === 'ANULADA') q = q.gte('fecha', `${f.desde}T00:00:00-06:00`).lte('fecha', `${f.hasta}T23:59:59-06:00`);
      const [{ data, error }] = await Promise.all([q, cargarCompras()]);
      if (error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      lista = (data || []).map((k) => ({ ...k, docs: k.contrasena_documentos.length, valor: k.contrasena_documentos.reduce((t, d) => t + Number(d.valor), 0), sinCompra: k.contrasena_documentos.filter((d) => !d.compra_id).length }));
      pintarLista();
      await abrir(lista.find((k) => k.id === id) || (id === null ? null : lista[0]) || null);
    }
    function pintarLista() {
      const q = buscar.trim().toLowerCase();
      const filas = lista.filter((k) => !q || [k.numero, k.proveedor_nombre, k.nit, k.proveedor_codigo].some((v) => String(v || '').toLowerCase().includes(q)));
      const vivas = lista.filter((k) => k.estado === 'PENDIENTE' || k.estado === 'AUTORIZADA');
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab tg-cab">
          <h2>Recepciones <small>${lista.length}</small></h2>
          <div class="ta-totales pc-resumen"><span class="ta-total sin"><b>${vivas.length}</b> vigentes</span><span class="ta-total"><b>Q ${fmt.monto(vivas.reduce((t, k) => t + k.valor, 0))}</b> por pagar</span></div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Número, proveedor o NIT…" value="${esc(buscar)}" aria-label="Buscar contraseñas"></label>
        </header>
        <div class="ta-tabla"><table>
          <thead><tr><th class="num">Recepción</th><th>Fecha</th><th>Proveedor</th><th>NIT</th><th>Tipo compra</th><th>Fecha estimada pago</th><th class="num">Docs.</th><th class="num">Valor</th><th>Estado</th><th>Usuario</th></tr></thead>
          <tbody>${filas.map((k) => `<tr data-id="${k.id}" class="${actual && actual.id === k.id ? 'actual' : ''} ${k.estado === 'ANULADA' ? 'pc-anulada' : ''}" tabindex="0">
            <td class="num fuerte">${k.numero}</td><td>${esc(fmt.fechaHora(k.fecha).slice(0, 16))}</td><td class="ta-desc" title="${esc(k.proveedor_nombre)}">${esc(k.proveedor_nombre)}</td><td>${esc(k.nit || '')}</td>
            <td>${k.tipo_compra === 'INMEDIATO' ? 'Inmediato' : `Crédito ${k.dias_credito} días`}</td><td class="${k.fecha_pago < fmt.hoy() && ['PENDIENTE', 'AUTORIZADA'].includes(k.estado) ? 'pc-rojo' : ''}">${esc(fmt.fechaDia(k.fecha_pago))}</td>
            <td class="num">${k.docs}${k.sinCompra ? ` <i class="ti ti-alert-triangle cp-revisar" title="${k.sinCompra} sin compra registrada" aria-label="${k.sinCompra} sin compra registrada"></i>` : ''}</td><td class="num">${fmt.monto(k.valor)}</td><td>${marca(k.estado)}</td><td>${esc(k.usuario || '')}</td></tr>`).join('')
            || `<tr><td colspan="10" class="tk-vacio"><i class="ti ti-key" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : lista.length ? 'Ninguna coincide con la búsqueda.' : 'No hay recepciones con esos filtros.'}</td></tr>`}</tbody>
        </table></div>`;
    }
    async function abrir(k, editar = false) {
      actual = k;
      editando = editar;
      docs = [];
      if (k) {
        const { data } = await sb.from('contrasena_documentos').select('*').eq('contrasena_id', k.id).order('linea');
        docs = (data || []).map((d) => ({ serie: d.serie, documento: d.documento, fecha: d.fecha, valor: Number(d.valor), compra_id: d.compra_id }));
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-id]').forEach((tr) => tr.classList.toggle('actual', !!k && tr.dataset.id === String(k.id)));
    }
    const editable = () => ctx.admin && (!actual ? true : editando && actual.estado === 'PENDIENTE');
    // Compras que se pueden recibir: del proveedor, vigentes, sin otra contraseña.
    const disponibles = (provId, mias = []) => compras.filter((c) => (!provId || c.proveedor_id === provId || !c.proveedor_id) && (!c.contrasena_id || c.contrasena_id === actual?.id || mias.includes(c.id)) && Number(c.pendiente) > 0);

    function pintarDetalle(v0) {
      const k = actual;
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-key'); return; }
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const sinRecepcion = !k && !ed;
      const tab = sinRecepcion ? 'LISTA' : pestana;
      const v = v0 || (k ? { ...k } : { proveedor_id: null, tipo_compra: 'CRÉDITO', dias_credito: 0, fecha_pago: fmt.hoy(), observaciones: '' });
      const p = proveedor(v.proveedor_id);
      const usadas = docs.map((d) => d.compra_id).filter(Boolean);
      const opciones = disponibles(v.proveedor_id, usadas);
      const sinCompra = docs.filter((d) => d.documento && !d.compra_id).length;
      const boton = (accion, icono, texto, clase = 'secundario-sm') => `<button type="button" class="boton ${clase}" data-accion="${accion}"><i class="ti ${icono}" aria-hidden="true"></i> ${texto}</button>`;
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form bm-form ck-form cl-clasico" novalidate>
          <div class="cl-banda cl-amarilla">Recepción de facturas</div>
          ${sinRecepcion ? `<p class="ck-elige"><i class="ti ti-hand-click" aria-hidden="true"></i> Elige una recepción del listado${ctx.admin ? ' o crea una con «Nueva recepción»' : ''}.</p>` : `
          <div class="ck-cab">
            <section class="ck-recepcion">
              <div class="ck-linea ck-l1">
                <div class="ck-par ck-num"><span>Recepción</span><b>${k ? k.numero : 'Nueva'}</b></div>
                <div class="ck-par"><span>Fecha</span><b>${k ? esc(fmt.fechaHora(k.fecha)) : esc(fmt.fechaHora(new Date()))}</b></div>
                <div class="ck-par"><span>Usr</span><b>${esc(k ? k.usuario || '' : (yo.usuario || '').toUpperCase())}</b></div>
                <div class="ck-par"><span>Estado</span>${marca(k ? k.estado : 'PENDIENTE')}</div>
              </div>
              <div class="ck-linea ck-l2">
                <label class="campo ck-prov"><span>Proveedor *</span><input list="ck-proveedores" name="proveedor" value="${esc(p ? provTxt(p) : v.proveedor_nombre || '')}" placeholder="Código, NIT o nombre del proveedor" ${dis}></label>
                <label class="campo"><span>Tipo compra</span><select name="tipo_compra" ${dis}>${[['INMEDIATO', 'Inmediato'], ['CRÉDITO', 'Crédito']].map(([x, t]) => `<option value="${x}" ${v.tipo_compra === x ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
                <label class="campo ck-dias"><span>Días</span><input type="number" min="0" max="365" name="dias_credito" value="${esc(String(v.dias_credito ?? 0))}" ${dis || (v.tipo_compra === 'INMEDIATO' ? 'disabled' : '')}></label>
                <label class="campo"><span>Fecha estimada pago</span><input type="date" name="fecha_pago" value="${esc(v.fecha_pago || '')}" ${dis}></label>
              </div>
              <label class="campo ck-obs"><span>Observaciones</span><input name="observaciones" value="${esc(v.observaciones || '')}" maxlength="200" ${dis}></label>
            </section>
            <div class="ck-acciones">
              ${!ed && ctx.admin && k?.estado === 'PENDIENTE' ? boton('modificar', 'ti-pencil', 'Modificar', 'primario-sm') : ''}
              ${ed ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${k ? 'Guardar' : 'Registrar recepción'}</button>${boton('cancelar', 'ti-x', 'Cancelar')}` : ''}
              ${k && !ed && k.estado !== 'ANULADA' ? boton('imprimir', 'ti-printer', 'Imprimir contraseña') : ''}
              ${!ed && ctx.admin ? `<button type="button" class="boton secundario-sm" data-accion="liquidar-todas" title="Liquida las contraseñas autorizadas cuyas compras ya están pagadas"><i class="ti ti-checks" aria-hidden="true"></i> Liquidar contraseñas</button>` : ''}
              ${k && !ed && ctx.admin ? `<div class="ck-estado">
                ${k.estado === 'PENDIENTE' ? boton('AUTORIZAR', 'ti-circle-check', 'Autorizar') : ''}
                ${k.estado === 'AUTORIZADA' ? boton('LIQUIDAR', 'ti-check', 'Liquidar esta') : ''}
                ${['AUTORIZADA', 'LIQUIDADA'].includes(k.estado) ? boton('REABRIR', 'ti-lock-open', 'Reabrir') : ''}
                ${['PENDIENTE', 'AUTORIZADA'].includes(k.estado) ? boton('ANULAR', 'ti-ban', 'Anular', 'secundario-sm rp-peligro') : ''}</div>` : ''}
            </div>
          </div>`}
          <p class="modal-error tk-error" role="alert"></p>
          ${k?.estado === 'ANULADA' ? `<p class="tk-aviso bm-anulado"><i class="ti ti-ban" aria-hidden="true"></i> Anulada por ${esc(k.anulado_por || '')} · ${esc(fmt.fechaHora(k.anulado_en))}: ${esc(k.motivo_anulacion || '')}</p>` : ''}
          ${k && (k.autorizado_por || k.liquidado_por) ? `<p class="cc-ingreso"><i class="ti ti-shield-check" aria-hidden="true"></i>${k.autorizado_por ? ` Autorizó ${esc(k.autorizado_por)} · ${esc(fmt.fechaHora(k.autorizado_en))}` : ''}${k.liquidado_por ? ` · Liquidó ${esc(k.liquidado_por)} · ${esc(fmt.fechaHora(k.liquidado_en))}` : ''}</p>` : ''}
          <section class="bm-pestanas ck-pestanas">
            <div class="bm-tabs-barra"><div class="rp-pestanas" role="tablist">
              ${sinRecepcion ? '' : `<button type="button" role="tab" data-pestana="DOCS" class="${tab === 'DOCS' ? 'activa' : ''}" aria-selected="${tab === 'DOCS'}"><i class="ti ti-files" aria-hidden="true"></i> Documentos recibidos${docs.length ? ` <b>${docs.length}</b>` : ''}</button>`}
              <button type="button" role="tab" data-pestana="LISTA" class="${tab === 'LISTA' ? 'activa' : ''}" aria-selected="${tab === 'LISTA'}"><i class="ti ti-list-search" aria-hidden="true"></i> Listado de recepciones${lista.length ? ` <b>${lista.length}</b>` : ''}</button>
            </div>
            ${ed && tab === 'DOCS' ? `<div class="ck-docs-acc"><button type="button" class="boton secundario-sm" data-accion="pendientes" ${v.proveedor_id ? '' : 'disabled'}><i class="ti ti-download" aria-hidden="true"></i> Traer compras pendientes del proveedor</button>${boton('linea', 'ti-plus', 'Documento')}</div>` : ''}</div>
            <div class="bm-panel ck-docs" data-panel="DOCS" ${tab === 'DOCS' ? '' : 'hidden'}>
              <h3 class="cl-subtitulo">Detalle de documentos recibidos</h3>
              ${sinCompra ? `<p class="ck-aviso"><span class="pc-marca pendiente"><i class="ti ti-alert-triangle" aria-hidden="true"></i> ${sinCompra} sin compra registrada: se enlazan solos al registrar la compra</span></p>` : ''}
              <div class="pc-lineas"><table>
                <thead><tr><th class="pc-n">#</th><th class="ck-serie">Serie docto.</th><th>No. docto.</th><th class="ck-fecha">Fecha</th><th class="num ck-valor">Valor</th><th>Compra</th><th></th></tr></thead>
                <tbody>${docs.map((d, i) => { const c = compra(d.compra_id); const fija = !!d.compra_id; return `<tr data-doc="${i}">
                  <td class="pc-n">${i + 1}</td>
                  <td class="ck-serie"><input data-d="serie" value="${esc(d.serie || '')}" maxlength="20" ${ed && !fija ? '' : 'disabled'} aria-label="Serie"></td>
                  <td><input data-d="documento" value="${esc(d.documento || '')}" maxlength="40" ${ed && !fija ? '' : 'disabled'} aria-label="Número de documento"></td>
                  <td class="ck-fecha"><input type="date" data-d="fecha" value="${esc(d.fecha || '')}" ${ed && !fija ? '' : 'disabled'} aria-label="Fecha"></td>
                  <td class="num ck-valor"><input type="number" step="0.01" min="0" data-d="valor" value="${d.valor || ''}" ${ed && !fija ? '' : 'disabled'} aria-label="Valor"></td>
                  <td class="ck-compra">${ed ? `<select data-d="compra_id" aria-label="Compra"><option value="">— Documento aún sin registrar —</option>${[...(c ? [c] : []), ...opciones.filter((o) => o.id !== d.compra_id && !usadas.includes(o.id))].map((o) => `<option value="${o.id}" ${o.id === d.compra_id ? 'selected' : ''}>Compra ${o.numero} · ${esc(docTxt(o))} · ${fmt.monto(o.neto)}</option>`).join('')}</select>`
                    : c ? `<a href="#/compras/facturas-compra" class="pc-tipo">Compra ${c.numero}</a> <span class="tk-tenue">${esc(docTxt(c))}</span>` : d.compra_id ? '<span class="pc-tipo">Registrada</span>' : '<span class="tk-tenue">Sin registrar</span>'}</td>
                  <td>${ed ? `<button type="button" class="icono-boton" data-quitar="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`; }).join('')
                  || `<tr><td colspan="7" class="tk-vacio">${ed ? 'Trae las compras pendientes del proveedor o agrega los documentos recibidos.' : 'Sin documentos.'}</td></tr>`}</tbody>
                <tfoot><tr><td colspan="4" class="num">Valor</td><td class="num ck-valor" data-total>${fmt.monto(total())}</td><td colspan="2"></td></tr></tfoot>
              </table></div>
            </div>
            <div class="bm-panel bm-listado" data-panel="LISTA" ${tab === 'LISTA' ? '' : 'hidden'}></div>
          </section>
          <datalist id="ck-proveedores">${proveedores.filter((x) => x.estado === 'ACTIVO').map((x) => `<option value="${esc(provTxt(x))}"></option>`).join('')}</datalist>
        </form>`;
      ctx.pDet.querySelector('[data-panel=LISTA]').appendChild(ctx.pMae);
    }

    function leerDocs() {
      ctx.pDet.querySelectorAll('tr[data-doc]').forEach((tr) => {
        const d = docs[Number(tr.dataset.doc)];
        tr.querySelectorAll('[data-d]').forEach((el) => { d[el.dataset.d] = el.dataset.d === 'compra_id' ? (el.value ? Number(el.value) : null) : el.dataset.d === 'valor' ? fmt.redondear(el.value) : el.value.trim(); });
      });
    }
    function leer(form) {
      const el = form.elements;
      const p = proveedorDe(el.proveedor.value);
      return { proveedor_id: p ? p.id : actual?.proveedor_id && el.proveedor.value === (actual.proveedor_nombre || '') ? actual.proveedor_id : null, proveedor_nombre: p ? p.nombre_fiscal || p.nombre_comercial : el.proveedor.value.trim(), _prov: el.proveedor.value.trim(),
        tipo_compra: el.tipo_compra.value, dias_credito: el.tipo_compra.value === 'INMEDIATO' ? 0 : Number(el.dias_credito.value) || 0, fecha_pago: el.fecha_pago.value || null, observaciones: el.observaciones.value.trim() || null };
    }
    function repintar(cambios = {}) { const form = ctx.pDet.querySelector('.ck-form'); leerDocs(); const v = { ...(actual || {}), ...leer(form), ...cambios }; delete v._prov; pintarDetalle(v); }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      leerDocs();
      const v = leer(form);
      if (!v.proveedor_id) { error.textContent = v._prov ? 'Ese proveedor no está en el catálogo: créalo en Compras › Catálogos › Proveedores.' : 'Elige el proveedor.'; return form.elements.proveedor.focus(); }
      const ds = docs.filter((d) => d.compra_id || d.documento);
      if (!ds.length) { error.textContent = 'Agrega al menos un documento recibido.'; return; }
      const sinValor = ds.find((d) => !d.compra_id && !(d.valor > 0));
      if (sinValor) { error.textContent = `Escribe el valor del documento ${sinValor.documento}.`; return; }
      const claves = ds.map((d) => d.compra_id ? `c${d.compra_id}` : `${(d.serie || '').toUpperCase()}|${d.documento.toUpperCase()}`);
      if (claves.some((x, i) => claves.indexOf(x) !== i)) { error.textContent = 'Hay un documento repetido en la recepción.'; return; }
      delete v._prov;
      error.textContent = '';
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      try {
        let id = actual?.id;
        if (actual) { const r = await sb.from('contrasenas_pago').update(v).eq('id', id); if (r.error) throw r.error; }
        else { const r = await sb.from('contrasenas_pago').insert({ ...v, numero: 0, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id, numero').single(); if (r.error) throw r.error; id = r.data.id; }
        const d = await sb.from('contrasena_documentos').delete().eq('contrasena_id', id);
        if (d.error) throw d.error;
        const r = await sb.from('contrasena_documentos').insert(ds.map((x, i) => ({ contrasena_id: id, linea: i + 1, serie: x.serie || null, documento: x.documento || compra(x.compra_id)?.documento || '-', fecha: x.fecha || null, valor: x.valor || 0, compra_id: x.compra_id || null })));
        if (r.error) throw r.error;
        window.FIN.aviso(actual ? 'Recepción guardada' : 'Recepción registrada');
        editando = false;
        if (f.estado !== 'TODAS' && f.estado !== 'PENDIENTE') { f.estado = 'TODAS'; pintarFiltros(); }
        actual = { id };
        await consultar(id);
      } catch (err) { error.textContent = window.UI.traducirError(err); }
      finally { boton.disabled = false; }
    }

    async function procesar(accion) {
      let motivo = null;
      if (accion === 'ANULAR') { motivo = prompt(`Motivo de la anulación de la contraseña ${actual.numero}:`); if (motivo === null) return; }
      const { error } = await sb.rpc('procesar_contrasena', { p_id: actual.id, p_accion: accion, p_motivo: motivo });
      if (error) { const e = ctx.pDet.querySelector('.modal-error'); if (e) e.textContent = window.UI.traducirError(error); return; }
      window.FIN.aviso({ AUTORIZAR: 'Contraseña autorizada', LIQUIDAR: 'Contraseña liquidada', REABRIR: 'Contraseña reabierta', ANULAR: 'Contraseña anulada' }[accion]);
      await consultar();
    }
    async function liquidarTodas() {
      if (!confirm('¿Liquidar todas las contraseñas autorizadas cuyas compras ya están pagadas?')) return;
      const { data, error } = await sb.rpc('liquidar_contrasenas', { p_loc: ctx.sel.loc });
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      window.FIN.aviso(data ? `${data} contraseña(s) liquidada(s)` : 'No hay contraseñas autorizadas con todas sus compras pagadas');
      await consultar();
    }

    function imprimirContrasena() {
      const k = actual;
      const emp = ctx.localidad(k.localidad_id);
      imprimir(`Contraseña ${k.numero}`, `
        <h1>Contraseña de pago No. ${k.numero}</h1>
        <h2>${esc(emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '')} · Recepción de facturas · ${esc(fmt.fechaHora(k.fecha))}</h2>
        <div class="cab">
          <div style="grid-column:span 2"><b>Proveedor</b>${esc([k.proveedor_codigo, k.proveedor_nombre].filter(Boolean).join(' · '))}</div><div><b>NIT</b>${esc(k.nit || '')}</div><div><b>Estado</b>${esc(k.estado)}</div>
          <div><b>Tipo de compra</b>${k.tipo_compra === 'INMEDIATO' ? 'Inmediato' : `Crédito ${k.dias_credito} días`}</div><div><b>Fecha estimada de pago</b>${esc(fmt.fechaDia(k.fecha_pago))}</div><div><b>Recibió</b>${esc(k.usuario || '')}</div><div><b>Valor</b>Q ${fmt.monto(total())}</div></div>
        <table><thead><tr><th>#</th><th>Serie</th><th>Documento</th><th>Fecha</th><th>Compra</th><th class="n">Valor</th></tr></thead>
          <tbody>${docs.map((d, i) => `<tr><td>${i + 1}</td><td>${esc(d.serie || '')}</td><td>${esc(d.documento)}</td><td>${esc(fmt.fechaDia(d.fecha))}</td><td>${compra(d.compra_id) ? compra(d.compra_id).numero : ''}</td><td class="n">${fmt.monto(d.valor)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="5">Total</td><td class="n">${fmt.monto(total())}</td></tr></tfoot></table>
        ${k.observaciones ? `<p>${esc(k.observaciones)}</p>` : ''}
        <p>Presente esta contraseña para recibir su pago a partir de la fecha estimada.</p>
        <div class="firmas"><div>Recibió</div><div>Proveedor</div><div>Sello</div></div>`);
    }
    function imprimirLista() {
      if (!lista.length) return window.FIN.aviso('No hay recepciones con esos filtros');
      const emp = ctx.localidad(ctx.sel.loc);
      imprimir('Contraseñas de pago', `<h1>Contraseñas de pago</h1><h2>${esc(emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '')} · ${esc(f.estado)} · ${lista.length} recepciones</h2>
        <table><thead><tr><th>Recepción</th><th>Fecha</th><th>Proveedor</th><th>NIT</th><th>Tipo</th><th>Fecha pago</th><th class="n">Docs.</th><th class="n">Valor</th><th>Estado</th></tr></thead>
        <tbody>${lista.map((k) => `<tr><td>${k.numero}</td><td>${esc(fmt.fechaDia(k.fecha))}</td><td>${esc(k.proveedor_nombre)}</td><td>${esc(k.nit || '')}</td><td>${esc(k.tipo_compra)}</td><td>${esc(fmt.fechaDia(k.fecha_pago))}</td><td class="n">${k.docs}</td><td class="n">${fmt.monto(k.valor)}</td><td>${esc(k.estado)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="7">Total</td><td class="n">${fmt.monto(lista.reduce((t, k) => t + k.valor, 0))}</td><td></td></tr></tfoot></table>`);
    }

    // ---------- Eventos ----------
    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { pintarFiltros(); return cargarLocalidad(); }
      if (cambio === 'otro') { f[e.target.name] = e.target.value; if (f.hasta < f.desde) { if (e.target.name === 'desde') f.hasta = f.desde; else f.desde = f.hasta; } pintarFiltros(); return consultar(); }
      const form = e.target.closest('.ck-form');
      if (!form) return;
      if (e.target.name === 'proveedor') {
        const p = proveedorDe(e.target.value);
        if (!p) { form.querySelector('.modal-error').textContent = e.target.value.trim() ? 'Ese proveedor no está en el catálogo.' : ''; return; }
        const dias = Number(p.dias_credito) || 0;
        leerDocs();
        docs = docs.filter((d) => !d.compra_id || compra(d.compra_id)?.proveedor_id === p.id);
        return repintar({ proveedor_id: p.id, proveedor_nombre: p.nombre_fiscal || p.nombre_comercial, tipo_compra: dias ? 'CRÉDITO' : 'INMEDIATO', dias_credito: dias, fecha_pago: sumaDias(actual ? String(actual.fecha).slice(0, 10) : fmt.hoy(), dias) });
      }
      if (e.target.name === 'tipo_compra' || e.target.name === 'dias_credito') {
        const v = leer(form);
        return repintar({ fecha_pago: sumaDias(actual ? String(actual.fecha).slice(0, 10) : fmt.hoy(), v.dias_credito) });
      }
      if (e.target.dataset.d === 'compra_id') {
        leerDocs();
        const d = docs[Number(e.target.closest('tr').dataset.doc)];
        const c = compra(d.compra_id);
        if (c) Object.assign(d, { serie: c.serie, documento: c.documento, fecha: c.fecha_documento, valor: Number(c.neto) });
        return repintar();
      }
      if (e.target.dataset.d) { leerDocs(); ctx.pDet.querySelector('[data-total]').textContent = fmt.monto(total()); }
    });
    cont.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar]')) { buscar = e.target.value; const pos = e.target.selectionStart; pintarLista(); const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos); return; }
      if (e.target.dataset.d === 'valor') { leerDocs(); ctx.pDet.querySelector('[data-total]').textContent = fmt.monto(total()); }
    });
    cont.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-buscar]')) e.preventDefault(); });
    cont.addEventListener('click', (e) => {
      const fila = e.target.closest('tr[data-id]');
      if (fila && ctx.pMae.contains(fila)) { pestana = 'DOCS'; return abrir(lista.find((k) => String(k.id) === fila.dataset.id)); }
      const tab = e.target.closest('[data-pestana]');
      if (tab) { pestana = tab.dataset.pestana; return ctx.pDet.querySelector('.ck-form [name=proveedor]') ? repintar() : pintarDetalle(); }
      const q = e.target.closest('[data-quitar]');
      if (q) { leerDocs(); docs.splice(Number(q.dataset.quitar), 1); return repintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (!a) return;
      if (a === 'nueva') { actual = null; editando = true; docs = []; pestana = 'DOCS'; ctx.pMae.querySelectorAll('tr.actual').forEach((tr) => tr.classList.remove('actual')); pintarDetalle(); return ctx.pDet.querySelector('[name=proveedor]')?.focus(); }
      if (a === 'modificar') { editando = true; return pintarDetalle(); }
      if (a === 'cancelar') return actual ? abrir(actual) : abrir(lista[0] || null);
      if (a === 'linea') { leerDocs(); docs.push({ serie: '', documento: '', fecha: fmt.hoy(), valor: 0, compra_id: null }); repintar(); const ins = ctx.pDet.querySelectorAll('[data-d=documento]'); return ins[ins.length - 1]?.focus(); }
      if (a === 'pendientes') {
        leerDocs();
        const v = leer(ctx.pDet.querySelector('.ck-form'));
        const usadas = docs.map((d) => d.compra_id).filter(Boolean);
        const nuevas = disponibles(v.proveedor_id, usadas).filter((c) => !usadas.includes(c.id) && c.proveedor_id === v.proveedor_id);
        if (!nuevas.length) return window.FIN.aviso('El proveedor no tiene compras pendientes sin contraseña');
        docs = docs.filter((d) => d.compra_id || d.documento).concat(nuevas.map((c) => ({ serie: c.serie, documento: c.documento, fecha: c.fecha_documento, valor: Number(c.neto), compra_id: c.id })));
        repintar();
        return window.FIN.aviso(`${nuevas.length} compra(s) agregada(s)`);
      }
      if (a === 'imprimir') return imprimirContrasena();
      if (a === 'lista') return imprimirLista();
      if (a === 'liquidar-todas') return liquidarTodas();
      if (['AUTORIZAR', 'LIQUIDAR', 'REABRIR', 'ANULAR'].includes(a)) return procesar(a);
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.ck-form')) { e.preventDefault(); guardar(e.target); } });

    iniciar();
  };
})();
