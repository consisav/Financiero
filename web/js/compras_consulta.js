// Compras · Mantenimientos · Consultar Compras: resumen de los ingresos de compras de una empresa
// (organización y localidad), un proveedor y un rango de fechas: arriba el maestro de compras con sus
// totales y abajo el detalle de la compra elegida (artículos o compras varias y su detalle contable).
// Fecha inicial por omisión: la de la primera compra de la empresa.
// Filtros: clasificación y orden (compra, fecha o total, ascendente o descendente; también con clic en
// el encabezado de esas columnas). «Consultar» abre la compra en Ingreso de compras; «Modificar ingreso de compra» abre la compra en Registros · Ingreso de compras para
// modificarla si su mes está abierto y no generó partida en el sistema (lo contabilizado en el sistema
// anterior se muestra como dato, no impide modificarla).
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const cant = (n) => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  const ORDENES = [['fecha:desc', 'Fecha ↓'], ['fecha:asc', 'Fecha ↑'], ['numero:desc', 'Compra ↓'], ['numero:asc', 'Compra ↑'], ['total:desc', 'Total ↓'], ['total:asc', 'Total ↑']];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  window.PANTALLAS['consultar-compras'] = function (cont) {
    // Mismo diseño de encabezado que las consultas de cheques, depósitos y notas (bk-consulta-cheques).
    const ctx = montar(cont, { titulo: 'Consultar Compras', icono: 'ti-file-search', clase: 'bk-movimientos bk-consultar cb-apilado bk-consulta-cheques cqc-compras', grupo: 'Compras · Procesar Compras' });
    const { sb } = ctx;
    const [anio] = fmt.hoy().split('-');
    const f = { proveedor: '', clasificacion: '', desde: `${anio}-01-01`, hasta: fmt.hoy(), estado: 'TODAS', buscar: '', orden: 'fecha', dir: 'desc' };
    let proveedores = [], clasificaciones = [], compras = [], cerrados = new Set(), sel = null;
    let consulta = 0; // número de la última consulta: las respuestas de consultas anteriores se descartan
    let detalle = { articulos: [], items: [], lineas: [] };

    const proveedor = (id) => proveedores.find((p) => p.id === id);
    const provTxt = (p) => `${p.codigo} · ${p.nombre_comercial}${p.nit ? ` · ${p.nit}` : ''}`;
    const docTxt = (c) => `${c.serie ? `${c.serie}-` : ''}${c.documento}`;
    const mesDe = (c) => (c.fecha_documento || '').slice(0, 7);
    const contabilizada = (c) => !!(c.partida_id || c.fecha_contabilizacion || c.poliza_numero);
    const cerrado = (c) => cerrados.has(mesDe(c));
    // Por qué no se puede modificar (vacío = se puede).
    const bloqueo = (c) => c.estado === 'ANULADA' ? 'La compra está anulada.'
      : cerrado(c) ? `El mes de ${MESES[Number(mesDe(c).slice(5, 7)) - 1]} ${mesDe(c).slice(0, 4)} está cerrado.`
        : c.partida_id ? 'La compra ya generó su partida contable.' : '';

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo cq-prov"><span>Proveedor</span><input list="cq-proveedores" name="proveedor" value="${esc(f.proveedor)}" placeholder="Todos (código, NIT o nombre)"></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Clasificación</span><select name="clasificacion"><option value="">Todas</option>${clasificaciones.filter((k) => k.activo || String(k.id) === f.clasificacion).map((k) => `<option value="${k.id}" ${String(k.id) === f.clasificacion ? 'selected' : ''}>${k.codigo} · ${esc(k.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Ordenar por</span><select name="orden">${ORDENES.map(([k, t]) => `<option value="${k}" ${`${f.orden}:${f.dir}` === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado">${['TODAS', 'MODIFICABLES', 'CONTABILIZADAS', 'MES CERRADO', 'ANULADAS'].map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <datalist id="cq-proveedores">${proveedores.map((p) => `<option value="${esc(provTxt(p))}"></option>`).join('')}</datalist>`,
        '<button type="button" class="boton cqc-excel" data-accion="excel" title="Reporte en Excel (.xlsx): resumido o detallado (artículos, contable o ambos), con el encabezado de la empresa"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i><span><b>Generar Excel</b><small>Resumido o detallado</small></span></button>');
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      if (!clasificaciones.length) { const r = await sb.from('clasificaciones_compra').select('id, codigo, nombre, activo').order('codigo'); clasificaciones = r.data || []; }
      const [p, k] = await Promise.all([
        loc ? window.UI.todo(sb.from('proveedores').select('id, codigo, nit, nombre_comercial').eq('localidad_id', loc).order('nombre_comercial').order('id')) : { data: [] },
        loc ? sb.from('cierres_mes').select('anio, mes, cerrado').eq('localidad_id', loc).eq('cerrado', true) : { data: [] }
      ]);
      proveedores = p.data || [];
      // Fecha inicial por omisión: la de la primera compra de la empresa (sin compras, el 1 de enero).
      const pr = loc ? await sb.from('compras').select('fecha_documento').eq('localidad_id', loc).order('fecha_documento').limit(1) : { data: [] };
      f.desde = pr.data?.[0]?.fecha_documento || `${anio}-01-01`;
      if (f.hasta < f.desde) f.hasta = fmt.hoy();
      cerrados = new Set((k.error ? [] : k.data || []).map((x) => `${x.anio}-${String(x.mes).padStart(2, '0')}`));
      pintarFiltros();
      await consultar();
    }

    // Proveedor elegido en el filtro: por su texto de la lista, su código, NIT o nombre.
    function proveedorFiltro() {
      const t = f.proveedor.trim().toUpperCase();
      if (!t) return null;
      return proveedores.find((p) => provTxt(p).toUpperCase() === t) || proveedores.find((p) => String(p.codigo) === t || (p.nit || '').toUpperCase() === t)
        || proveedores.find((p) => p.nombre_comercial.toUpperCase().includes(t)) || { id: -1 };
    }

    async function consultar(id = sel?.id) {
      const loc = ctx.sel.loc;
      if (!loc) { compras = []; pintar(); return; }
      const pv = proveedorFiltro();
      let q = sb.from('compras').select('id, numero, tipo_documento, tipo_dte, serie, documento, fecha_documento, fecha_ingreso, proveedor_id, proveedor_codigo, proveedor_nombre, nit, clasificacion, moneda_id, tipo_cambio, valor_total, iva, base, estado, partida_id, usuario, origen_anterior, compra_anterior, compra_varia_anterior, fecha_contabilizacion, poliza_numero, bodega_id')
        .eq('localidad_id', loc).gte('fecha_documento', f.desde).lte('fecha_documento', f.hasta).order('fecha_documento', { ascending: false }).order('numero', { ascending: false }).limit(5000);
      if (pv) q = q.eq('proveedor_id', pv.id);
      if (f.clasificacion) q = q.eq('clasificacion_id', Number(f.clasificacion));
      const yo = ++consulta;
      let r = await q;
      // Sin las columnas de la migración (script 89) se consulta lo básico.
      if (r.error && /origen_anterior|fecha_contabilizacion|poliza_numero|compra_varia/.test(r.error.message)) {
        let q2 = sb.from('compras').select('id, numero, tipo_documento, tipo_dte, serie, documento, fecha_documento, fecha_ingreso, proveedor_id, proveedor_codigo, proveedor_nombre, nit, clasificacion, moneda_id, tipo_cambio, valor_total, iva, base, estado, partida_id, usuario, bodega_id')
          .eq('localidad_id', loc).gte('fecha_documento', f.desde).lte('fecha_documento', f.hasta).order('fecha_documento', { ascending: false }).order('numero', { ascending: false }).limit(5000);
        if (pv) q2 = q2.eq('proveedor_id', pv.id);
        if (f.clasificacion) q2 = q2.eq('clasificacion_id', Number(f.clasificacion));
        r = await q2;
      }
      if (yo !== consulta) return;
      if (r.error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(r.error.message)}</p>`; return; }
      const lista = r.data || [];
      // Saldo de cada compra (vista compras_saldo), por partes para no alargar la consulta.
      const saldos = new Map();
      for (let i = 0; i < lista.length; i += 300) {
        const { data } = await sb.from('compras_saldo').select('id, pagado, pendiente').in('id', lista.slice(i, i + 300).map((c) => c.id));
        (data || []).forEach((x) => saldos.set(x.id, x));
      }
      if (yo !== consulta) return;
      compras = lista;
      compras.forEach((c) => { const s = saldos.get(c.id); c.pagado = Number(s?.pagado || 0); c.pendiente = Number(s?.pendiente ?? c.valor_total); });
      sel = compras.find((c) => c.id === id) || null;
      pintar();
      if (!sel && visibles()[0]) await elegir(visibles()[0]);
    }

    const visibles = () => {
      const q = f.buscar.trim().toLowerCase();
      return compras.filter((c) => (f.estado === 'TODAS' || (f.estado === 'MODIFICABLES' && !bloqueo(c)) || (f.estado === 'CONTABILIZADAS' && contabilizada(c))
        || (f.estado === 'MES CERRADO' && cerrado(c)) || (f.estado === 'ANULADAS' && c.estado === 'ANULADA'))
        && (!q || [c.numero, c.documento, c.serie, c.proveedor_codigo, c.proveedor_nombre, c.nit, c.compra_anterior].some((v) => String(v || '').toLowerCase().includes(q))))
        .sort((a, b) => {
          const va = f.orden === 'numero' ? a.numero : f.orden === 'total' ? enQ(a, 'valor_total') : a.fecha_documento;
          const vb = f.orden === 'numero' ? b.numero : f.orden === 'total' ? enQ(b, 'valor_total') : b.fecha_documento;
          const d = va < vb ? -1 : va > vb ? 1 : b.numero - a.numero;
          return f.dir === 'asc' ? d : -d;
        });
    };
    // Encabezado que ordena: clic alterna ascendente / descendente.
    const ordenTh = (campo, texto, clase = '') => `<th class="${clase} cq-orden ${f.orden === campo ? 'activo' : ''}" data-ordenar="${campo}" title="Ordenar por ${texto.toLowerCase()}">${texto} <i class="ti ${f.orden === campo ? (f.dir === 'asc' ? 'ti-sort-ascending' : 'ti-sort-descending') : 'ti-arrows-sort'}" aria-hidden="true"></i></th>`;
    const enQ = (c, campo) => Number(c[campo] || 0) * (c.moneda_id === ctx.monedaBase()?.id ? 1 : Number(c.tipo_cambio || 1));

    async function elegir(c) {
      sel = c;
      detalle = { articulos: [], items: [], lineas: [] };
      if (c) ctx.pDet.innerHTML = ctx.vacio('Cargando el detalle de la compra…', 'ti-loader-2');
      if (c) {
        const [a, i, l] = await Promise.all([
          sb.from('compra_articulos').select('*, productos(codigo, codigo_producto, nombre)').eq('compra_id', c.id).order('linea'),
          sb.from('compra_items').select('*').eq('compra_id', c.id).order('linea'),
          sb.from('compra_lineas').select('linea, debe, haber, cuentas(codigo, nombre)').eq('compra_id', c.id).order('linea')
        ]);
        if (sel !== c) return;
        detalle = { articulos: a.error ? [] : a.data || [], items: i.data || [], lineas: l.data || [] };
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-compra]').forEach((tr) => tr.classList.toggle('actual', !!c && tr.dataset.compra === String(c.id)));
    }

    function pintar() { pintarMaestro(); pintarDetalle(); }

    function pintarMaestro() {
      const filas = visibles();
      const vivas = filas.filter((c) => c.estado === 'ACTIVA');
      const tot = (campo) => vivas.reduce((t, c) => t + enQ(c, campo), 0);
      const mod = filas.filter((c) => !bloqueo(c)).length;
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>Compras <small>${filas.length}</small></h2>
          <div class="ta-totales pc-resumen">
            <span class="ta-total"><b>Q ${fmt.monto(tot('valor_total'))}</b> total</span>
            <span class="ta-total"><b>Q ${fmt.monto(tot('iva'))}</b> IVA</span>
            <span class="ta-total sin"><b>Q ${fmt.monto(tot('pendiente'))}</b> saldo</span>
            <span class="ta-total"><b>${mod}</b> modificables</span>
            <span class="ta-total"><b>${filas.filter(contabilizada).length}</b> contabilizadas</span>
          </div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Compra, documento, proveedor, NIT…" value="${esc(f.buscar)}" aria-label="Buscar compras"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table class="ccq-tabla"><colgroup><col class="w-num"><col class="w-fecha"><col class="w-doc"><col><col class="w-clas"><col class="w-total"><col class="w-saldo"><col class="w-estado"><col class="w-acc"></colgroup>
            <thead><tr>${ordenTh('numero', 'Compra', 'num')}${ordenTh('fecha', 'Fecha')}<th>Documento</th><th>Proveedor · NIT</th><th>Clasificación</th>${ordenTh('total', 'Total · IVA', 'num')}<th class="num">Saldo</th><th>Estado</th><th aria-label="Consultar"></th></tr></thead>
            <tbody>${filas.map((c) => { const b = bloqueo(c); const sim = ctx.moneda(c.moneda_id)?.simbolo || 'Q'; const tipo = (c.tipo_dte || c.tipo_documento || '').replace('FACTURA ', 'F. '); return `<tr data-compra="${c.id}" class="${sel && sel.id === c.id ? 'actual' : ''} ${c.estado === 'ANULADA' ? 'pc-anulada' : ''}" tabindex="0">
              <td class="num fuerte">${c.numero}${c.origen_anterior ? `<small class="cq-ant" title="Compra ${c.origen_anterior === 'VARIAS' ? 'varia' : 'de medicamentos'} ${c.compra_anterior} del sistema anterior${c.compra_varia_anterior ? ` · compra varia ${c.compra_varia_anterior}` : ''}">ant. ${c.compra_anterior}</small>` : ''}</td>
              <td>${esc(fmt.fechaDia(c.fecha_documento))}</td>
              <td title="${esc(`${tipo} ${docTxt(c)}`)}"><b class="ccq-doc">${esc(docTxt(c))}</b><small>${esc(tipo)}</small></td>
              <td class="cc-nombre" title="${esc(c.proveedor_nombre)}"><b>${esc(c.proveedor_nombre)}</b><small>${esc([c.proveedor_codigo && `Cód. ${c.proveedor_codigo}`, c.nit && `NIT ${c.nit}`].filter(Boolean).join(' · '))}</small></td>
              <td title="${esc(c.clasificacion || '')}">${esc(c.clasificacion || '')}</td>
              <td class="num"><b>${esc(sim)} ${fmt.monto(c.valor_total)}</b><small>IVA ${fmt.monto(c.iva)}</small></td>
              <td class="num ${c.pendiente > 0 && c.estado === 'ACTIVA' ? 'cq-saldo' : ''}">${c.estado === 'ACTIVA' ? fmt.monto(c.pendiente) : '—'}</td>
              <td class="ccq-estado"><span class="pc-marca ${c.estado === 'ANULADA' ? 'anulada' : c.pendiente <= 0 ? 'definitiva' : 'pendiente'}">${c.estado === 'ANULADA' ? 'Anulada' : c.pendiente <= 0 ? 'Pagada' : 'Por pagar'}</span>${cerrado(c) ? ' <span class="pc-marca anulada" title="Mes cerrado">Cerrado</span>' : ''}
                <small title="${contabilizada(c) ? (c.partida_id ? 'Partida generada en el sistema' : 'Contabilizada en el sistema anterior') : 'Sin contabilizar'}">${contabilizada(c) ? (c.partida_id ? 'Con partida' : 'Contab. sistema anterior') : 'Sin contabilizar'}</small></td>
              <td class="cq-acc">${ctx.admin ? `<button type="button" class="boton secundario-sm ccq-ver" data-consultar="${c.id}" title="${esc(b ? `Abrir en Ingreso de compras para consultarla (no se puede modificar: ${b})` : 'Abrir en Ingreso de compras para consultarla')}"><i class="ti ti-eye" aria-hidden="true"></i> Consultar</button>` : ''}</td></tr>`; }).join('')
              || `<tr><td colspan="9" class="tk-vacio"><i class="ti ti-file-search" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : 'No hay compras con estos parámetros.'}</td></tr>`}</tbody></table>
        </div>`;
    }

    function pintarDetalle() {
      const c = sel;
      if (!c) { ctx.pDet.innerHTML = ctx.vacio(ctx.sel.loc ? 'Elige una compra para ver su detalle.' : 'Elige la empresa.', 'ti-file-search'); return; }
      const { articulos, items, lineas } = detalle;
      const b = bloqueo(c);
      const sim = ctx.moneda(c.moneda_id)?.simbolo || 'Q';
      const totArt = articulos.reduce((t, a) => t + Number(a.costo_total ?? (Number(a.cantidad) * Number(a.costo_unitario) - Number(a.descuento || 0))), 0);
      ctx.pDet.innerHTML = `
        <div class="tk-form cq-ficha">
          <header class="tk-titulo cb-titulo">
            <span class="tk-icono"><i class="ti ti-file-invoice" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>Compra ${c.numero}${c.origen_anterior ? ` · ${c.origen_anterior === 'VARIAS' ? 'compra varia' : 'compra de medicamentos'} ${c.compra_anterior} del sistema anterior` : ''}</small><h2>${esc(c.proveedor_nombre)} · ${esc(docTxt(c))}</h2></div>
            <dl class="cq-datos">
              <div><dt>Fecha</dt><dd>${esc(fmt.fechaDia(c.fecha_documento))}</dd></div>
              <div><dt>Total</dt><dd>${esc(sim)} ${fmt.monto(c.valor_total)}</dd></div>
              <div><dt>Base · IVA</dt><dd>${fmt.monto(c.base)} · ${fmt.monto(c.iva)}</dd></div>
              <div><dt>Saldo</dt><dd>${c.estado === 'ACTIVA' ? `${esc(sim)} ${fmt.monto(c.pendiente)}` : 'Anulada'}</dd></div>
              <div><dt>Ingresó</dt><dd>${esc(c.usuario || '—')}</dd></div>
            </dl>
            <div class="tk-titulo-acciones">
              ${b ? `<span class="cq-bloqueo"><i class="ti ti-lock" aria-hidden="true"></i> ${esc(b)}</span>` : ''}
              <a class="boton secundario-sm" href="#/compras/facturas-compra/${c.id}"><i class="ti ti-eye" aria-hidden="true"></i> Ver ingreso</a>
              ${ctx.admin ? `<button type="button" class="boton primario-sm" data-modificar="${c.id}" ${b ? 'disabled' : ''}><i class="ti ti-pencil" aria-hidden="true"></i> Modificar ingreso de compra</button>` : ''}
            </div>
          </header>
          <div class="cq-det">
            <section class="cb-bloque cq-lineas">
              <h3 class="ta-col-titulo"><i class="ti ${articulos.length ? 'ti-package' : 'ti-list'}" aria-hidden="true"></i> ${articulos.length ? `Artículos <small>${articulos.length}</small>` : `Compras varias <small>${items.length}</small>`}</h3>
              <div class="pc-lineas"><table>
                ${articulos.length ? `<thead><tr><th class="pc-n">Línea</th><th>Código</th><th>Producto</th><th>Lote / serie</th><th>Vence</th><th class="num">Cantidad</th><th class="num">Costo unitario</th><th class="num">Descuento</th><th class="num">Total</th><th>Inv.</th></tr></thead>
                <tbody>${articulos.map((a) => `<tr><td class="pc-n">${a.linea}</td><td class="fuerte">${esc(a.productos?.codigo_producto || String(a.productos?.codigo || '') || a.producto_codigo || '')}</td>
                  <td class="cc-nombre">${a.productos ? esc(a.productos.nombre) : '<span class="cf-sin-prod">Producto por migrar</span>'}</td><td>${esc(a.serie || '')}</td><td>${esc(fmt.fechaDia(a.fecha_vencimiento))}</td>
                  <td class="num">${cant(a.cantidad)}</td><td class="num">${fmt.monto(a.costo_unitario)}</td><td class="num">${Number(a.descuento) ? fmt.monto(a.descuento) : ''}</td>
                  <td class="num fuerte">${fmt.monto(a.costo_total ?? Number(a.cantidad) * Number(a.costo_unitario) - Number(a.descuento || 0))}</td><td>${a.inventariado ? '<i class="ti ti-check cb-si" aria-label="Inventariado"></i>' : ''}</td></tr>`).join('')}</tbody>
                <tfoot><tr><td colspan="8">Total del detalle</td><td class="num">${esc(sim)} ${fmt.monto(totArt)}</td><td></td></tr></tfoot>`
                : `<thead><tr><th class="pc-n">Línea</th><th>Descripción</th><th class="num">Cantidad</th><th class="num">Costo total</th></tr></thead>
                <tbody>${items.map((x) => `<tr><td class="pc-n">${x.linea}</td><td>${esc(x.descripcion)}</td><td class="num">${cant(x.cantidad)}</td><td class="num">${fmt.monto(x.costo_total)}</td></tr>`).join('') || '<tr><td colspan="4" class="tk-vacio">La compra no tiene detalle.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="3">Total del detalle</td><td class="num">${esc(sim)} ${fmt.monto(items.reduce((t, x) => t + Number(x.costo_total || 0), 0))}</td></tr></tfoot>`}
              </table></div>
            </section>
            <section class="cb-bloque cq-conta">
              <h3 class="ta-col-titulo"><i class="ti ti-list-details" aria-hidden="true"></i> Detalle contable <small>${lineas.length}</small></h3>
              <div class="pc-lineas"><table><thead><tr><th>Cuenta</th><th>Nombre</th><th class="num">Debe</th><th class="num">Haber</th></tr></thead>
                <tbody>${lineas.map((l) => `<tr><td class="fuerte">${esc(l.cuentas?.codigo || '')}</td><td class="cc-nombre">${esc(l.cuentas?.nombre || '')}</td><td class="num">${Number(l.debe) ? fmt.monto(l.debe) : ''}</td><td class="num">${Number(l.haber) ? fmt.monto(l.haber) : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="tk-vacio">Sin detalle contable.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="2">Totales</td><td class="num">${fmt.monto(lineas.reduce((t, l) => t + Number(l.debe || 0), 0))}</td><td class="num">${fmt.monto(lineas.reduce((t, l) => t + Number(l.haber || 0), 0))}</td></tr></tfoot></table></div>
            </section>
          </div>
        </div>`;
    }

    // ---------- Reporte en Excel ----------
    // Como en la Consulta de Cheques: antes de generarlo se elige el tipo de reporte y el archivo (.xlsx, con
    // ExcelJS) lleva el encabezado de la empresa: a la izquierda el logo y el nombre, al centro el título y
    // los parámetros, a la derecha la fecha y hora con el usuario; una línea de separación y los datos.
    //   1. Resumido: el listado de las compras.
    //   2. Detallado con artículos: cada compra con sus artículos (o su detalle de compras varias).
    //   3. Detallado contable: cada compra con su detalle contable.
    //   4. Detallado con artículos y contable: las dos cosas.
    // Si la librería no carga, se descarga el CSV de siempre.
    const TIPOS_REPORTE = [
      ['RESUMIDO', 'ti-list', 'Resumido', 'Solo el listado general de las compras.'],
      ['ARTICULOS', 'ti-package', 'Detallado con artículos', 'Cada compra con sus artículos (o su detalle de compras varias).'],
      ['CONTABLE', 'ti-list-details', 'Detallado contable', 'Cada compra con el detalle de su contabilización.'],
      ['AMBOS', 'ti-layout-list', 'Detallado con artículos y contable', 'Cada compra con sus artículos y su detalle contable.']
    ];
    function excel() {
      const filas = visibles();
      if (!filas.length) return window.FIN.aviso('No hay compras con estos parámetros');
      let formRef = null;
      window.UI.formulario({
        titulo: 'Reporte de compras en Excel',
        campos: [],
        alPreparar: (form) => {
          formRef = form;
          form.querySelector('.modal-cuerpo').innerHTML = `
            <fieldset class="cqc-tipos"><legend>Tipo de reporte</legend>
              ${TIPOS_REPORTE.map(([v, ic, t, d], i) => `<label class="cqc-tipo"><input type="radio" name="tipo" value="${v}" ${i ? '' : 'checked'}><i class="ti ${ic}" aria-hidden="true"></i><span><b>${i + 1}. ${t}</b><small>${i ? d : `Solo el listado general de las ${filas.length.toLocaleString('es-GT')} compras.`}</small></span></label>`).join('')}
            </fieldset>
            <p class="bu-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> Con los filtros de la pantalla: ${esc(parametros().join(' · '))}.</p>`;
          form.querySelector('[type=submit]').innerHTML = '<i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Generar Excel';
        },
        alGuardar: async () => { await generarExcel(filas, formRef?.elements.tipo?.value || 'RESUMIDO'); }
      });
    }

    function parametros() {
      const emp = ctx.localidad(ctx.sel.loc);
      const k = clasificaciones.find((x) => String(x.id) === f.clasificacion);
      const orden = ORDENES.find(([x]) => x === `${f.orden}:${f.dir}`)?.[1] || '';
      return [`Empresa: ${emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '—'}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`,
        `Proveedor: ${f.proveedor.trim() || 'Todos'}`, `Clasificación: ${k ? `${k.codigo} · ${k.nombre}` : 'Todas'}`, `Estado: ${f.estado}`, `Orden: ${orden}`,
        ...(f.buscar.trim() ? [`Búsqueda: ${f.buscar.trim()}`] : [])];
    }

    const cargarExcelJS = () => window.ExcelJS ? Promise.resolve(window.ExcelJS) : new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
      s.onload = () => window.ExcelJS ? ok(window.ExcelJS) : mal(new Error('ExcelJS'));
      s.onerror = () => mal(new Error('No se pudo cargar la librería de Excel'));
      document.head.appendChild(s);
    });

    // Logo de la localidad (o, si no tiene, el de la organización), como base64 para incrustarlo.
    async function logoEmpresa(orgId) {
      try {
        const { data: o } = await sb.from('organizaciones').select('codigo, nombre, logo_ruta').eq('id', orgId).maybeSingle();
        const { data: l, error: el } = await sb.from('localidades').select('logo_ruta').eq('id', ctx.sel.loc).maybeSingle();
        const ruta = (!el && l?.logo_ruta) || o?.logo_ruta;
        if (!ruta) return { org: o, logo: null };
        const blob = await (await fetch(sb.storage.from('organizaciones').getPublicUrl(ruta).data.publicUrl)).blob();
        const ext = /png/.test(blob.type) ? 'png' : /jpe?g/.test(blob.type) ? 'jpeg' : /gif/.test(blob.type) ? 'gif' : null;
        if (!ext) return { org: o, logo: null };
        const b64 = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
        const dim = await new Promise((ok) => { const i = new Image(); i.onload = () => ok({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => ok({ w: 160, h: 80 }); i.src = URL.createObjectURL(blob); });
        return { org: o, logo: { base64: b64, extension: ext, ...dim } };
      } catch { return { org: null, logo: null }; }
    }

    // Detalle de todas las compras del reporte, por partes.
    async function detallesDe(ids, conArticulos, conContable) {
      const art = new Map(), its = new Map(), lin = new Map();
      const agrupar = (m, data) => (data || []).forEach((x) => { if (!m.has(x.compra_id)) m.set(x.compra_id, []); m.get(x.compra_id).push(x); });
      for (let i = 0; i < ids.length; i += 150) {
        const parte = ids.slice(i, i + 150);
        const [a, b, c] = await Promise.all([
          conArticulos ? sb.from('compra_articulos').select('compra_id, linea, cantidad, costo_unitario, descuento, costo_total, serie, fecha_vencimiento, producto_codigo, productos(codigo, codigo_producto, nombre)').in('compra_id', parte).order('linea').limit(10000) : { data: [] },
          conArticulos ? sb.from('compra_items').select('compra_id, linea, descripcion, cantidad, costo_total').in('compra_id', parte).order('linea').limit(10000) : { data: [] },
          conContable ? sb.from('compra_lineas').select('compra_id, linea, debe, haber, cuentas(codigo, nombre)').in('compra_id', parte).order('linea').limit(10000) : { data: [] }
        ]);
        agrupar(art, a.data); agrupar(its, b.data); agrupar(lin, c.data);
      }
      return { art, its, lin };
    }

    async function generarExcel(filas, tipo) {
      const emp = ctx.localidad(ctx.sel.loc);
      let ExcelJS;
      try { ExcelJS = await cargarExcelJS(); } catch (err) { window.FIN.aviso(`${err.message}: se descarga en CSV`); return excelCsv(filas); }
      window.FIN.aviso('Generando el reporte…');
      const conArt = tipo === 'ARTICULOS' || tipo === 'AMBOS';
      const conCon = tipo === 'CONTABLE' || tipo === 'AMBOS';
      const det = conArt || conCon ? await detallesDe(filas.map((c) => c.id), conArt, conCon) : null;
      const { org, logo } = await logoEmpresa(emp?.organizacion_id);
      const yo = window.FIN.perfil();
      const ahora = new Date().toLocaleString('es-GT', { timeZone: 'America/Guatemala', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '');
      const nombreTipo = TIPOS_REPORTE.find(([v]) => v === tipo)[2];

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Financiero CONSISAV';
      const ws = wb.addWorksheet(tipo === 'RESUMIDO' ? 'Compras' : 'Compras detallado', { views: [{ state: 'frozen', ySplit: 7, showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
      const COLS = [['Compra', 9], ['Fecha', 11], ['Tipo · documento', 20], ['Proveedor', 40], ['NIT', 12], ['Clasificación', 16], ['Moneda', 10], ['Total', 14], ['IVA', 13], ['Saldo', 14], ['Estado', 11], ['Contabilizada', 13], ['Mes', 10], ['Compra anterior', 13]];
      ws.columns = COLS.map(([, w]) => ({ width: w }));
      const ultima = COLS.length;
      const azul = 'FF1F3A5F';
      // a) Izquierda: logo y nombre de la empresa (columnas 1 a 4).
      if (logo) {
        const id = wb.addImage({ base64: logo.base64, extension: logo.extension });
        const alto = 64; const ancho = Math.round(alto * (logo.w / (logo.h || 1)));
        ws.addImage(id, { tl: { col: 0.1, row: 0.15 }, ext: { width: Math.min(ancho, 150), height: alto } });
      }
      const izq = logo ? 3 : 1;
      ws.mergeCells(1, izq, 1, 4); ws.getCell(1, izq).value = org?.nombre || '';
      ws.getCell(1, izq).font = { bold: true, size: 13, color: { argb: azul } };
      ws.mergeCells(2, izq, 2, 4); ws.getCell(2, izq).value = emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '';
      ws.getCell(2, izq).font = { size: 10, color: { argb: 'FF555555' } };
      // b) Centro: título y parámetros (columnas 5 a 10).
      const par = parametros();
      ws.mergeCells(1, 5, 1, 10); ws.getCell(1, 5).value = `Consultar Compras · ${nombreTipo}`;
      ws.getCell(1, 5).font = { bold: true, size: 14, color: { argb: azul } };
      [par.slice(0, 2).join('   ·   '), par.slice(2, 4).join('   ·   '), par.slice(4).join('   ·   ')].forEach((t, i) => {
        ws.mergeCells(2 + i, 5, 2 + i, 10); ws.getCell(2 + i, 5).value = t; ws.getCell(2 + i, 5).font = { size: 9.5, color: { argb: 'FF444444' } };
      });
      for (let r = 1; r <= 4; r += 1) ws.getCell(r, 5).alignment = { horizontal: 'center', vertical: 'middle' };
      // c) Derecha: fecha y hora de generación, y el usuario (columnas 11 a la última).
      ws.mergeCells(1, 11, 1, ultima); ws.getCell(1, 11).value = `Fecha: ${ahora}`;
      ws.mergeCells(2, 11, 2, ultima); ws.getCell(2, 11).value = `Usuario: ${(yo.usuario || '').toUpperCase()}${yo.nombre ? ` · ${yo.nombre}` : ''}`;
      [1, 2].forEach((r) => { ws.getCell(r, 11).alignment = { horizontal: 'right' }; ws.getCell(r, 11).font = { size: 9.5, color: { argb: 'FF444444' } }; });
      ws.getRow(1).height = 22; [2, 3, 4].forEach((r) => { ws.getRow(r).height = 15; });
      for (let c = 1; c <= ultima; c += 1) ws.getCell(5, c).border = { bottom: { style: 'medium', color: { argb: azul } } };
      ws.getRow(5).height = 6;
      const cab = ws.getRow(7);
      COLS.forEach(([t], i) => { const c = cab.getCell(i + 1); c.value = t; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: azul } }; c.alignment = { vertical: 'middle', horizontal: i >= 7 && i <= 9 ? 'right' : 'left' }; });
      cab.height = 18;

      const monto = '#,##0.00';
      const cantidad = '#,##0.####';
      const sub = (valores, nf = {}) => {
        const r = ws.getRow(fila); r.values = valores; r.font = { size: 9.5 };
        Object.entries(nf).forEach(([c, f0]) => { r.getCell(Number(c)).numFmt = f0; });
        fila += 1; return r;
      };
      const titulo = (t) => { const r = sub(['', t]); r.font = { italic: true, bold: true, size: 9, color: { argb: 'FF1F3A5F' } }; };
      const cabeza = (valores) => { const r = sub(valores); r.font = { italic: true, size: 9, color: { argb: 'FF666666' } }; };
      let fila = 8;
      let total = 0;
      for (const c of filas) {
        const sim = ctx.moneda(c.moneda_id)?.simbolo || 'Q';
        const r = ws.getRow(fila);
        r.values = [c.numero, fmt.fechaDia(c.fecha_documento), `${(c.tipo_dte || c.tipo_documento || '').replace('FACTURA ', 'F. ')} ${docTxt(c)}`.trim(), `${c.proveedor_codigo ? `${c.proveedor_codigo} · ` : ''}${c.proveedor_nombre || ''}`,
          c.nit || '', c.clasificacion || '', sim, Number(c.valor_total || 0), Number(c.iva || 0), c.estado === 'ACTIVA' ? Number(c.pendiente || 0) : 0,
          c.estado === 'ANULADA' ? 'Anulada' : c.pendiente <= 0 ? 'Pagada' : 'Por pagar', contabilizada(c) ? (c.partida_id ? 'Partida' : 'Sist. anterior') : 'No', cerrado(c) ? 'Cerrado' : 'Abierto', c.compra_anterior || ''];
        [8, 9, 10].forEach((k) => { r.getCell(k).numFmt = monto; });
        if (c.estado === 'ANULADA') r.font = { color: { argb: 'FF999999' }, strike: true };
        if (det) { r.font = { ...(r.font || {}), bold: true }; r.eachCell((x) => { x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF0F7' } }; }); }
        if (c.estado === 'ACTIVA') total += enQ(c, 'valor_total');
        fila += 1;
        if (conArt) {
          const arts = det.art.get(c.id) || [];
          const its = det.its.get(c.id) || [];
          if (arts.length) {
            titulo(`Artículos (${arts.length})`);
            cabeza(['', 'Línea', 'Código', 'Producto', 'Lote / serie', 'Vence', 'Cantidad', 'Costo unitario', 'Descuento', 'Total']);
            let t = 0;
            for (const a of arts) {
              const tot = Number(a.costo_total ?? (Number(a.cantidad) * Number(a.costo_unitario) - Number(a.descuento || 0)));
              t += tot;
              sub(['', a.linea, a.productos?.codigo_producto || String(a.productos?.codigo || '') || a.producto_codigo || '', a.productos?.nombre || 'Producto por migrar', a.serie || '', a.fecha_vencimiento ? fmt.fechaDia(a.fecha_vencimiento) : '',
                Number(a.cantidad || 0), Number(a.costo_unitario || 0), Number(a.descuento) || null, tot], { 7: cantidad, 8: monto, 9: monto, 10: monto });
            }
            const rt = sub(['', '', '', 'Total de artículos', '', '', '', '', '', t], { 10: monto }); rt.font = { bold: true, size: 9.5 }; rt.getCell(10).border = { top: { style: 'thin' } };
          } else if (its.length) {
            titulo(`Compras varias (${its.length})`);
            cabeza(['', 'Línea', '', 'Descripción', '', '', 'Cantidad', '', '', 'Costo total']);
            for (const x of its) sub(['', x.linea, '', x.descripcion || '', '', '', Number(x.cantidad || 0), '', '', Number(x.costo_total || 0)], { 7: cantidad, 10: monto });
            const rt = sub(['', '', '', 'Total del detalle', '', '', '', '', '', its.reduce((s0, x) => s0 + Number(x.costo_total || 0), 0)], { 10: monto }); rt.font = { bold: true, size: 9.5 }; rt.getCell(10).border = { top: { style: 'thin' } };
          } else { const rv = sub(['', '', '', 'Sin artículos ni detalle']); rv.font = { italic: true, size: 9, color: { argb: 'FF999999' } }; }
        }
        if (conCon) {
          const ls = det.lin.get(c.id) || [];
          if (ls.length) {
            titulo(`Detalle contable (${ls.length})`);
            cabeza(['', 'Línea', 'Cuenta', 'Nombre de la cuenta', '', '', '', 'Debe', 'Haber']);
            let d0 = 0, h0 = 0;
            for (const l of ls) { d0 += Number(l.debe || 0); h0 += Number(l.haber || 0); sub(['', l.linea, l.cuentas?.codigo || '', l.cuentas?.nombre || '', '', '', '', Number(l.debe) || null, Number(l.haber) || null], { 8: monto, 9: monto }); }
            const rt = sub(['', '', '', Math.abs(d0 - h0) < 0.005 ? 'Totales · cuadra' : 'Totales · NO CUADRA', '', '', '', d0, h0], { 8: monto, 9: monto });
            rt.font = { bold: true, size: 9.5 }; [8, 9].forEach((k) => { rt.getCell(k).border = { top: { style: 'thin' } }; });
          } else { const rv = sub(['', '', '', 'Sin detalle contable']); rv.font = { italic: true, size: 9, color: { argb: 'FF999999' } }; }
        }
        if (det) fila += 1;
      }
      const tg = ws.getRow(fila + (det ? 0 : 1));
      tg.getCell(4).value = `Total de ${filas.filter((c) => c.estado === 'ACTIVA').length} compras activas (de ${filas.length}), en quetzales`;
      tg.getCell(8).value = Math.round(total * 100) / 100; tg.getCell(8).numFmt = monto; tg.font = { bold: true };
      for (let c = 1; c <= ultima; c += 1) tg.getCell(c).border = { top: { style: 'medium', color: { argb: azul } } };
      if (!det) ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: ultima } };

      const buf = await wb.xlsx.writeBuffer();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = `compras_${tipo.toLowerCase()}_${emp?.codigo || ''}_${f.desde}_${f.hasta}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      window.FIN.aviso(`Reporte ${nombreTipo.toLowerCase()} generado: ${filas.length.toLocaleString('es-GT')} compras`);
    }

    // CSV de respaldo (si la librería de Excel no carga).
    function excelCsv(filas) {
      const emp = ctx.localidad(ctx.sel.loc);
      const cab = ['Compra', 'Compra anterior', 'Tipo', 'Serie', 'Documento', 'Fecha', 'Proveedor', 'Nombre', 'NIT', 'Clasificación', 'Total', 'IVA', 'Saldo', 'Estado', 'Contabilizada', 'Mes cerrado'];
      const datos = filas.map((c) => [c.numero, c.compra_anterior || '', c.tipo_dte || c.tipo_documento, c.serie || '', c.documento, c.fecha_documento, c.proveedor_codigo || '', c.proveedor_nombre, c.nit || '', c.clasificacion || '',
        c.valor_total, c.iva, c.estado === 'ACTIVA' ? c.pendiente : 0, c.estado, contabilizada(c) ? 'SÍ' : 'NO', cerrado(c) ? 'SÍ' : 'NO']);
      window.COMPRAS_CAT.descargarCsv(`consulta_compras_${emp?.codigo || ''}_${f.desde}_${f.hasta}.csv`, [cab, ...datos]);
    }

    function modificar(id) {
      const c = compras.find((x) => String(x.id) === String(id));
      if (!c) return;
      const b = bloqueo(c);
      if (b) return window.FIN.aviso(b);
      location.hash = `#/compras/facturas-compra/${c.id}:modificar`;
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { sel = null; return cargarLocalidad(); }
      if (cambio === 'otro') {
        const n = e.target.name;
        if (n === 'estado') { f.estado = e.target.value; pintarMaestro(); return elegir(visibles().find((c) => c.id === sel?.id) || visibles()[0] || null); }
        if (n === 'orden') { [f.orden, f.dir] = e.target.value.split(':'); return pintarMaestro(); }
        if (n === 'proveedor' || n === 'desde' || n === 'hasta' || n === 'clasificacion') { f[n] = e.target.value; sel = null; return consultar(); }
      }
    });
    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-buscar]')) return;
      f.buscar = e.target.value;
      const pos = e.target.selectionStart;
      pintarMaestro();
      const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
    });
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-buscar]')) e.preventDefault();
      if (e.key === 'Enter' && e.target.matches('tr[data-compra]')) e.target.click();
    });
    cont.addEventListener('click', (e) => {
      const q = e.target.closest('[data-consultar]');
      if (q) { location.hash = `#/compras/facturas-compra/${q.dataset.consultar}`; return; }
      const m = e.target.closest('[data-modificar]');
      if (m) return modificar(m.dataset.modificar);
      const th = e.target.closest('[data-ordenar]');
      if (th) { const campo = th.dataset.ordenar; f.dir = f.orden === campo && f.dir === 'desc' ? 'asc' : 'desc'; f.orden = campo; const o = ctx.pFil.querySelector('[name=orden]'); if (o) o.value = `${f.orden}:${f.dir}`; return pintarMaestro(); }
      const tr = e.target.closest('tr[data-compra]');
      if (tr && ctx.pMae.contains(tr)) return elegir(compras.find((c) => String(c.id) === tr.dataset.compra));
      const ac = e.target.closest('[data-accion]');
      if (ac?.dataset.accion === 'excel') return excel();
    });

    iniciar();
  };
})();
