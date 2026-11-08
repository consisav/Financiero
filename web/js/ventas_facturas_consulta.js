// Facturación/Ventas · Registros · Consulta de Facturas: el mismo diseño de Consultar Compras y la Consulta de Cheques.
//   Arriba los parámetros (empresa, cliente, vendedor, forma de pago, fechas —la inicial, por omisión, el primer día
//   del mes en curso—, orden y estado) y la lista con sus totales; abajo la factura elegida con sus productos, su
//   detalle contable y sus pagos. «Consultar» abre la factura en Facturas Ventas. Reportes en PDF y Excel, resumidos o
//   detallados.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const ORDENES = [['fecha:desc', 'Fecha ↓'], ['fecha:asc', 'Fecha ↑'], ['numero:desc', 'Número ↓'], ['numero:asc', 'Número ↑'], ['valor:desc', 'Valor ↓'], ['valor:asc', 'Valor ↑']];
  const ESTADOS = ['TODAS', 'FACTURADAS', 'ANULADAS', 'CON SALDO', 'PAGADAS', 'SIN CERTIFICAR', 'CERTIFICADAS'];

  window.PANTALLAS['consulta-de-facturas'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Consulta de Facturas', icono: 'ti-file-search', clase: 'bk-movimientos bk-consultar cb-apilado bk-consulta-cheques cqc-con-tipo vfc-consulta', grupo: 'Ventas · Registros' });
    const { sb } = ctx;
    const primeroDelMes = () => `${fmt.hoy().slice(0, 7)}-01`;
    const f = { cliente: '', vendedor: '', pago: '', desde: primeroDelMes(), hasta: fmt.hoy(), estado: 'TODAS', buscar: '', orden: 'fecha', dir: 'desc' };
    let facturas = [], vendedores = [], sel = null, consulta = 0, rango = null;
    let detalle = { lineas: [], conta: [], pagos: [] };

    const nombre = (x) => x.serie ? `${x.serie}-${x.numero_dte || ''}` : `Interna ${x.numero}`;
    const vendedor = (id) => vendedores.find((v) => v.id === id);
    const estadoDe = (x) => x.estado === 'ANULADA' ? ['anulada', 'Anulada'] : Number(x.saldo) > 0 ? ['pendiente', 'Con saldo'] : ['aprobada', 'Pagada'];

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo cq-prov"><span>Cliente</span><input name="cliente" value="${esc(f.cliente)}" placeholder="Todos (nombre, NIT o código)"></label>
        <label class="campo"><span>Vendedor</span><select name="vendedor"><option value="">Todos</option>${vendedores.map((v) => `<option value="${v.id}" ${String(f.vendedor) === String(v.id) ? 'selected' : ''}>${v.codigo} · ${esc(v.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Forma de pago</span><select name="pago"><option value="">Todas</option>${['CONTADO', 'CRÉDITO'].map((x) => `<option ${f.pago === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Ordenar por</span><select name="orden">${ORDENES.map(([k, t]) => `<option value="${k}" ${`${f.orden}:${f.dir}` === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado">${ESTADOS.map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>`,
        `<div class="bmc-reportes"><button type="button" class="boton secundario-sm bca-pdf" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i><span><b>Imprimir en PDF</b><small>Resumido o detallado</small></span></button>
         <button type="button" class="boton cqc-excel" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i><span><b>Generar Excel</b><small>Resumido o detallado</small></span></button></div>`);
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('facturas_venta').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/facturas_venta/.test(prueba.error.message) ? 'Falta instalar el script 130 (facturas de venta) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc || 0;
      const v = await sb.from('vendedores').select('id, codigo, nombre').eq('localidad_id', loc).order('codigo');
      vendedores = v.data || [];
      // Fecha inicial por omisión: el primer día del mes en curso (cada vez que se abre la pantalla o se cambia de empresa).
      f.desde = primeroDelMes(); f.hasta = fmt.hoy();
      f.vendedor = '';
      pintarFiltros();
      await consultar();
    }
    async function consultar(id = sel?.id) {
      const loc = ctx.sel.loc;
      if (!loc) { facturas = []; pintar(); return; }
      const yo = ++consulta;
      const lista = [];
      for (let p = 0; p < 20000; p += 1000) {
        let q = sb.from('facturas_venta').select('*').eq('localidad_id', loc).gte('fecha_emision', `${f.desde}T00:00:00`).lte('fecha_emision', `${f.hasta}T23:59:59.999`)
          .order('fecha_emision', { ascending: false }).order('numero', { ascending: false }).range(p, p + 999);
        if (f.vendedor) q = q.eq('vendedor_id', Number(f.vendedor));
        if (f.pago) q = q.eq('forma_pago', f.pago);
        const r = await q;
        if (yo !== consulta) return;
        if (r.error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(r.error.message)}</p>`; return; }
        lista.push(...(r.data || []));
        if ((r.data || []).length < 1000) break;
      }
      facturas = lista;
      rango = null;
      if (!lista.length) {
        const a = await sb.from('facturas_venta').select('fecha_emision', { count: 'exact' }).eq('localidad_id', loc).order('fecha_emision').limit(1);
        if (a.count) rango = { n: a.count, desde: String(a.data[0].fecha_emision).slice(0, 10) };
      }
      sel = facturas.find((x) => x.id === id) || null;
      pintar();
      if (!sel && visibles()[0]) await elegir(visibles()[0]);
    }
    const visibles = () => {
      const q = f.buscar.trim().toLowerCase();
      const c = f.cliente.trim().toLowerCase();
      return facturas.filter((x) => (f.estado === 'TODAS' || (f.estado === 'FACTURADAS' && x.estado === 'FACTURADA') || (f.estado === 'ANULADAS' && x.estado === 'ANULADA')
        || (f.estado === 'CON SALDO' && x.estado === 'FACTURADA' && Number(x.saldo) > 0) || (f.estado === 'PAGADAS' && x.estado === 'FACTURADA' && Number(x.saldo) === 0)
        || (f.estado === 'SIN CERTIFICAR' && x.estado === 'FACTURADA' && !x.autorizacion) || (f.estado === 'CERTIFICADAS' && !!x.autorizacion))
        && (!c || [x.nombre, x.nit, x.cliente_codigo].some((v) => String(v || '').toLowerCase().includes(c)))
        && (!q || [x.numero, x.serie, x.numero_dte, x.autorizacion, x.nombre, x.nit, x.observaciones].some((v) => String(v || '').toLowerCase().includes(q))))
        .sort((a, b) => {
          const va = f.orden === 'numero' ? a.numero : f.orden === 'valor' ? Number(a.total) : a.fecha_emision;
          const vb = f.orden === 'numero' ? b.numero : f.orden === 'valor' ? Number(b.total) : b.fecha_emision;
          const d = va < vb ? -1 : va > vb ? 1 : b.numero - a.numero;
          return f.dir === 'asc' ? d : -d;
        });
    };
    const ordenTh = (campo, texto, clase = '') => `<th class="${clase} cq-orden ${f.orden === campo ? 'activo' : ''}" data-ordenar="${campo}" title="Ordenar por ${texto.toLowerCase()}">${texto} <i class="ti ${f.orden === campo ? (f.dir === 'asc' ? 'ti-sort-ascending' : 'ti-sort-descending') : 'ti-arrows-sort'}" aria-hidden="true"></i></th>`;

    async function elegir(x) {
      sel = x;
      detalle = { lineas: [], conta: [], pagos: [] };
      if (x) {
        ctx.pDet.innerHTML = ctx.vacio('Cargando el detalle de la factura…', 'ti-loader-2');
        const [l, c, p] = await Promise.all([
          sb.from('factura_venta_lineas').select('*').eq('factura_id', x.id).order('linea'),
          sb.from('factura_venta_contable').select('linea, concepto, debe, haber, cuentas(codigo, nombre), centros_costo(codigo)').eq('factura_id', x.id).order('linea'),
          sb.from('factura_venta_pagos').select('*').eq('factura_id', x.id).order('fecha')
        ]);
        if (sel !== x) return;
        let pg = p.data || [];
        if (pg.length) { const pr = await sb.from('factura_venta_pagos').select('id, recibos_venta(id, numero, serie, recibo_fisico, estado)').eq('factura_id', x.id); if (!pr.error) { const rec = new Map((pr.data || []).map((y) => [y.id, y.recibos_venta])); pg = pg.map((y) => ({ ...y, recibo: rec.get(y.id) || null })); } }
        if (sel !== x) return;
        detalle = { lineas: l.data || [], conta: c.data || [], pagos: pg };
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-factura]').forEach((tr) => tr.classList.toggle('actual', !!x && tr.dataset.factura === String(x.id)));
    }
    function pintar() { pintarMaestro(); pintarDetalle(); }

    function pintarMaestro() {
      const filas = visibles();
      const vivas = filas.filter((x) => x.estado === 'FACTURADA');
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>Facturas <small>${filas.length}</small></h2>
          <div class="ta-totales pc-resumen">
            <span class="ta-total"><b>Q ${fmt.monto(vivas.reduce((t, x) => t + Number(x.total || 0), 0))}</b> facturadas (${vivas.length})</span>
            <span class="ta-total"><b>${filas.length - vivas.length}</b> anuladas</span>
            <span class="ta-total sin"><b>Q ${fmt.monto(vivas.reduce((t, x) => t + Number(x.saldo || 0), 0))}</b> saldo</span>
            <span class="ta-total"><b>${vivas.filter((x) => x.forma_pago === 'CRÉDITO').length}</b> al crédito</span>
            <span class="ta-total sin"><b>${vivas.filter((x) => !x.autorizacion).length}</b> sin certificar</span>
          </div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Número, serie, DTE, cliente…" value="${esc(f.buscar)}" aria-label="Buscar facturas"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table class="cqc-tabla vfc-tabla"><colgroup><col class="w-vf-num"><col class="w-fecha"><col><col class="w-vf-vend"><col class="w-vf-pago"><col class="w-valor"><col class="w-valor"><col class="w-estado"><col class="w-acc"></colgroup>
            <thead><tr>${ordenTh('numero', 'Factura', 'num')}${ordenTh('fecha', 'Fecha')}<th>Cliente · NIT</th><th>Vendedor</th><th>Pago</th>${ordenTh('valor', 'Valor', 'num')}<th class="num">Saldo</th><th>Estado</th><th aria-label="Consultar"></th></tr></thead>
            <tbody>${filas.map((x) => { const [cls, txt] = estadoDe(x); const v = vendedor(x.vendedor_id); return `<tr data-factura="${x.id}" class="${sel && sel.id === x.id ? 'actual' : ''} ${x.estado === 'ANULADA' ? 'pc-anulada' : ''}" tabindex="0">
              <td class="num fuerte">${esc(nombre(x))}<small class="cq-ant">interno ${x.numero}</small></td>
              <td>${esc(fmt.fechaDia(String(x.fecha_emision).slice(0, 10)))}</td>
              <td class="cqc-quien" title="${esc(x.nombre)}"><b>${esc(x.nombre)}</b><small>${esc(x.cliente_codigo ? `${x.cliente_codigo} · ` : '')}${esc(x.nit || '')}</small></td>
              <td class="cc-nombre">${esc(v ? v.nombre : '')}</td>
              <td>${esc(x.forma_pago === 'CRÉDITO' ? `Crédito ${x.dias_credito}` : 'Contado')}</td>
              <td class="num"><b>${fmt.monto(x.total)}</b></td>
              <td class="num ${Number(x.saldo) > 0 ? 'pc-rojo' : ''}">${fmt.monto(x.saldo)}</td>
              <td class="cqc-estado"><span class="pc-marca ${cls}">${txt}</span>${x.autorizacion ? ' <span class="pc-marca definitiva">FEL</span>' : ''}</td>
              <td class="cq-acc"><button type="button" class="boton secundario-sm cqc-ver" data-consultar="${x.id}" title="Consultar: abrir la factura en Facturas Ventas"><i class="ti ti-file-search" aria-hidden="true"></i> Consultar</button></td></tr>`; }).join('')
              || `<tr><td colspan="9" class="tk-vacio"><i class="ti ti-file-search" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : !facturas.length && rango ? `No hay facturas entre el ${esc(fmt.fechaDia(f.desde))} y el ${esc(fmt.fechaDia(f.hasta))}. La empresa tiene <b>${rango.n.toLocaleString('es-GT')}</b> facturas. <button type="button" class="boton primario-sm" data-ver-todos>Ver todas</button>` : 'No hay facturas con estos parámetros.'}</td></tr>`}</tbody></table>
        </div>`;
    }

    function pintarDetalle() {
      const x = sel;
      if (!x) { ctx.pDet.innerHTML = ctx.vacio(ctx.sel.loc ? 'Elige una factura para ver su detalle.' : 'Elige la empresa.', 'ti-file-search'); return; }
      const { lineas, conta, pagos } = detalle;
      const [cls, txt] = estadoDe(x);
      const debe = conta.reduce((t, l) => t + Number(l.debe || 0), 0), haber = conta.reduce((t, l) => t + Number(l.haber || 0), 0);
      ctx.pDet.innerHTML = `
        <div class="tk-form cq-ficha">
          <header class="tk-titulo cb-titulo">
            <span class="tk-icono"><i class="ti ti-file-invoice" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>Factura ${esc(nombre(x))} · interno ${x.numero} · ${esc(x.tipo_factura.toLowerCase())}${x.autorizacion ? ` · autorización ${esc(x.autorizacion)}` : ' · sin certificar'}</small><h2>${esc(x.nombre)}</h2></div>
            <dl class="cq-datos">
              <div><dt>Fecha</dt><dd>${esc(fmt.fechaDia(String(x.fecha_emision).slice(0, 10)))}</dd></div>
              <div><dt>Valor</dt><dd>Q ${fmt.monto(x.total)}</dd></div>
              <div><dt>Saldo</dt><dd>Q ${fmt.monto(x.saldo)}</dd></div>
              <div><dt>Estado</dt><dd><span class="pc-marca ${cls}">${txt}</span></dd></div>
              <div><dt>Usuario</dt><dd>${esc(x.usuario || '—')}</dd></div>
            </dl>
            <div class="tk-titulo-acciones"><a class="boton primario-sm" href="#/facturacion/facturas-ventas/${x.id}"><i class="ti ti-eye" aria-hidden="true"></i> Ver en Facturas Ventas</a></div>
          </header>
          ${x.estado === 'ANULADA' ? `<p class="cqc-concepto"><span class="pc-rojo">Anulada por ${esc(x.anulada_por || '')}: ${esc(x.motivo_anulacion || '')}</span></p>` : ''}
          <div class="cq-det vfc-det">
            <section class="cb-bloque cq-conta">
              <h3 class="ta-col-titulo"><i class="ti ti-list-details" aria-hidden="true"></i> Productos <small>${lineas.length}</small></h3>
              <div class="pc-lineas"><table><thead><tr><th class="pc-n">#</th><th>Producto</th><th>Descripción</th><th>Lote</th><th class="num">Cantidad</th><th class="num">Precio</th><th class="num">Total</th></tr></thead>
                <tbody>${lineas.map((l) => `<tr><td class="pc-n">${l.linea}</td><td class="fuerte">${esc(String(l.producto_codigo ?? ''))}</td><td class="cc-nombre">${esc(l.descripcion)}</td><td>${esc(l.lote || '')}</td><td class="num">${fmt.monto(l.cantidad)}</td><td class="num">${fmt.monto(l.precio)}</td><td class="num">${fmt.monto(l.total)}</td></tr>`).join('') || '<tr><td colspan="7" class="tk-vacio">Sin productos.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="6">Total (IVA ${fmt.monto(x.iva)})</td><td class="num">${fmt.monto(x.total)}</td></tr></tfoot></table></div>
            </section>
            <section class="cb-bloque cq-lineas">
              <h3 class="ta-col-titulo"><i class="ti ti-notebook" aria-hidden="true"></i> Detalle contable <small>${conta.length}</small>${conta.length ? (Math.abs(debe - haber) < 0.005 ? ' <span class="pc-marca aprobada">Cuadra</span>' : ' <span class="pc-marca anulada">No cuadra</span>') : ''}</h3>
              <div class="pc-lineas"><table><thead><tr><th>Cuenta</th><th>Nombre</th><th class="num">Debe</th><th class="num">Haber</th></tr></thead>
                <tbody>${conta.map((l) => `<tr><td class="fuerte">${esc(l.cuentas?.codigo || '')}</td><td class="cc-nombre">${esc(l.cuentas?.nombre || '')}</td><td class="num">${Number(l.debe) ? fmt.monto(l.debe) : ''}</td><td class="num">${Number(l.haber) ? fmt.monto(l.haber) : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="tk-vacio">Sin detalle contable.</td></tr>'}</tbody></table></div>
              <h3 class="ta-col-titulo vfc-pagos"><i class="ti ti-cash" aria-hidden="true"></i> Pagos <small>${pagos.length}</small></h3>
              <div class="pc-lineas"><table><thead><tr><th>Recibo</th><th>Fecha</th><th>Forma</th><th>Documento</th><th class="num">Valor</th></tr></thead>
                <tbody>${pagos.map((p) => `<tr><td>${p.recibo ? `<a class="vf-p-link" href="#/facturacion/recibos/${p.recibo.id}" title="Abrir el recibo en Recibos">${esc([p.recibo.serie, p.recibo.recibo_fisico].filter((y) => y != null && y !== '').join('-') || p.recibo.numero)}</a>${p.recibo.estado === 'ANULADO' ? ' <span class="pc-marca anulada">Anulado</span>' : ''}` : '<span class="tk-tenue">Manual</span>'}</td><td>${esc(fmt.fechaDia(p.fecha))}</td><td>${esc(p.forma)}</td><td>${esc(p.documento || '')}</td><td class="num">${fmt.monto(p.valor)}</td></tr>`).join('') || '<tr><td colspan="5" class="tk-vacio">Sin pagos.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="4">Pagado · saldo ${fmt.monto(x.saldo)}</td><td class="num">${fmt.monto(x.pagado)}</td></tr></tfoot></table></div>
            </section>
          </div>
        </div>`;
    }

    // ---------- Reportes ----------
    function parametros() {
      const emp = ctx.localidad(ctx.sel.loc);
      const v = vendedor(Number(f.vendedor));
      return [`Empresa: ${emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '—'}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, `Cliente: ${f.cliente.trim() || 'Todos'}`, `Vendedor: ${v ? v.nombre : 'Todos'}`,
        `Forma de pago: ${f.pago || 'Todas'}`, `Estado: ${f.estado}`, ...(f.buscar.trim() ? [`Búsqueda: ${f.buscar.trim()}`] : [])];
    }
    function dialogo(formato) {
      const filas = visibles();
      if (!filas.length) return window.FIN.aviso('No hay facturas con estos parámetros');
      let formRef = null;
      window.UI.formulario({
        titulo: `Reporte de facturas · ${formato === 'PDF' ? 'Imprimir en PDF' : 'Generar Excel'}`, campos: [],
        alPreparar: (form) => {
          formRef = form;
          form.querySelector('.modal-cuerpo').innerHTML = `
            <fieldset class="cqc-tipos"><legend>Tipo de reporte</legend>
              <label class="cqc-tipo"><input type="radio" name="tipo" value="RESUMIDO" checked><i class="ti ti-list" aria-hidden="true"></i><span><b>Resumido</b><small>El listado de las ${filas.length.toLocaleString('es-GT')} facturas.</small></span></label>
              <label class="cqc-tipo"><input type="radio" name="tipo" value="DETALLADO"><i class="ti ti-list-details" aria-hidden="true"></i><span><b>Detallado</b><small>Cada factura con sus productos.</small></span></label>
            </fieldset>
            <p class="bu-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> Con los filtros de la pantalla: ${esc(parametros().join(' · '))}.</p>`;
          form.querySelector('[type=submit]').innerHTML = formato === 'PDF' ? '<i class="ti ti-file-type-pdf" aria-hidden="true"></i> Imprimir en PDF' : '<i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Generar Excel';
        },
        alGuardar: async () => { await reporte(formato, formRef?.elements.tipo?.value || 'RESUMIDO', filas); }
      });
    }
    async function reporte(formato, modo, filas) {
      const lineasDe = new Map();
      if (modo === 'DETALLADO') {
        const ids = filas.map((x) => x.id);
        for (let i = 0; i < ids.length; i += 200) {
          const { data } = await sb.from('factura_venta_lineas').select('factura_id, linea, producto_codigo, descripcion, lote, cantidad, precio, total').in('factura_id', ids.slice(i, i + 200)).order('linea');
          (data || []).forEach((l) => { if (!lineasDe.has(l.factura_id)) lineasDe.set(l.factura_id, []); lineasDe.get(l.factura_id).push(l); });
        }
      }
      const vivas = filas.filter((x) => x.estado === 'FACTURADA');
      const total = vivas.reduce((t, x) => t + Number(x.total || 0), 0), saldo = vivas.reduce((t, x) => t + Number(x.saldo || 0), 0);
      if (formato === 'PDF') {
        window.BANCOS.imprimir('Consulta de Facturas', `<h1>Consulta de Facturas · ${modo === 'DETALLADO' ? 'detallado' : 'resumido'}</h1><h2>${esc(parametros().join(' · '))}</h2>
          <table><thead><tr><th>Factura</th><th>Interno</th><th>Fecha</th><th>Cliente</th><th>NIT</th><th>Pago</th><th class="n">Valor</th><th class="n">Saldo</th><th>Estado</th></tr></thead><tbody>
          ${filas.map((x) => `<tr class="${modo === 'DETALLADO' ? 's' : ''}"><td>${esc(nombre(x))}</td><td>${x.numero}</td><td>${esc(fmt.fechaDia(String(x.fecha_emision).slice(0, 10)))}</td><td>${esc(x.nombre)}</td><td>${esc(x.nit || '')}</td><td>${esc(x.forma_pago)}</td><td class="n">${fmt.monto(x.total)}</td><td class="n">${fmt.monto(x.saldo)}</td><td>${estadoDe(x)[1]}</td></tr>
            ${modo === 'DETALLADO' ? (lineasDe.get(x.id) || []).map((l) => `<tr><td></td><td>${l.linea}</td><td>${esc(String(l.producto_codigo ?? ''))}</td><td colspan="2">${esc(l.descripcion)}${l.lote ? ` · lote ${esc(l.lote)}` : ''}</td><td class="n">${fmt.monto(l.cantidad)}</td><td class="n">${fmt.monto(l.total)}</td><td colspan="2"></td></tr>`).join('') : ''}`).join('')}
          </tbody><tfoot><tr><td colspan="6">Total de ${vivas.length} facturas vigentes (de ${filas.length})</td><td class="n">${fmt.monto(total)}</td><td class="n">${fmt.monto(saldo)}</td><td></td></tr></tfoot></table>`, { locId: ctx.sel.loc, horizontal: true });
        return;
      }
      if (!window.REPORTE_XLSX) return;
      const datos = [];
      filas.forEach((x) => {
        datos.push({ resaltar: modo === 'DETALLADO' ? 1 : 0, tenue: x.estado === 'ANULADA', valores: [nombre(x), x.numero, fmt.fechaDia(String(x.fecha_emision).slice(0, 10)), x.nombre, x.nit || '', x.forma_pago, Number(x.total || 0), Number(x.saldo || 0), estadoDe(x)[1]] });
        if (modo === 'DETALLADO') (lineasDe.get(x.id) || []).forEach((l) => datos.push({ tipo: 'nota', valores: ['', l.linea, l.producto_codigo ?? '', l.descripcion, l.lote || '', Number(l.cantidad), Number(l.total), null, ''] }));
      });
      datos.push({ tipo: 'total', valores: ['', '', '', `Total de ${vivas.length} facturas vigentes (de ${filas.length})`, '', '', total, saldo, ''] });
      const emp = ctx.localidad(ctx.sel.loc);
      window.REPORTE_XLSX.generar({ titulo: `Consulta de Facturas · ${modo === 'DETALLADO' ? 'Detallado' : 'Resumido'}`, parametros: parametros(), orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Facturas',
        archivo: `facturas_${modo.toLowerCase()}_${emp?.codigo || ''}_${f.desde}_${f.hasta}`, autofiltro: modo !== 'DETALLADO',
        columnas: [{ titulo: 'Factura', ancho: 16 }, { titulo: modo === 'DETALLADO' ? 'Interno · línea' : 'Interno', ancho: 9 }, { titulo: modo === 'DETALLADO' ? 'Fecha · producto' : 'Fecha', ancho: 12 }, { titulo: modo === 'DETALLADO' ? 'Cliente · descripción' : 'Cliente', ancho: 44 },
          { titulo: modo === 'DETALLADO' ? 'NIT · lote' : 'NIT', ancho: 14 }, { titulo: modo === 'DETALLADO' ? 'Pago · cantidad' : 'Pago', ancho: 11 }, { titulo: 'Valor', ancho: 15, tipo: 'monto' }, { titulo: 'Saldo', ancho: 15, tipo: 'monto' }, { titulo: 'Estado', ancho: 12 }],
        filas: datos });
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { sel = null; return cargarLocalidad(); }
      if (cambio === 'otro') {
        const n = e.target.name;
        if (n === 'estado' || n === 'cliente') { f[n] = e.target.value; pintarMaestro(); return elegir(visibles().find((x) => x.id === sel?.id) || visibles()[0] || null); }
        if (n === 'orden') { [f.orden, f.dir] = e.target.value.split(':'); return pintarMaestro(); }
        if (['vendedor', 'pago', 'desde', 'hasta'].includes(n)) { f[n] = e.target.value; sel = null; return consultar(); }
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
      if (e.key === 'Enter' && e.target.matches('tr[data-factura]')) e.target.click();
    });
    cont.addEventListener('click', (e) => {
      const q = e.target.closest('[data-consultar]');
      if (q) { location.hash = `#/facturacion/facturas-ventas/${q.dataset.consultar}`; return; }
      if (e.target.closest('[data-ver-todos]') && rango) { f.desde = rango.desde; f.hasta = fmt.hoy(); sel = null; pintarFiltros(); return consultar(); }
      const th = e.target.closest('[data-ordenar]');
      if (th) { const campo = th.dataset.ordenar; f.dir = f.orden === campo && f.dir === 'desc' ? 'asc' : 'desc'; f.orden = campo; const o = ctx.pFil.querySelector('[name=orden]'); if (o) o.value = `${f.orden}:${f.dir}`; return pintarMaestro(); }
      const tr = e.target.closest('tr[data-factura]');
      if (tr && ctx.pMae.contains(tr)) return elegir(facturas.find((x) => String(x.id) === tr.dataset.factura));
      const ac = e.target.closest('[data-accion]');
      if (ac?.dataset.accion === 'excel') return dialogo('EXCEL');
      if (ac?.dataset.accion === 'pdf') return dialogo('PDF');
    });

    iniciar();
  };
})();
