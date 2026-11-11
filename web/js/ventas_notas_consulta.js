// Facturación/Ventas · Registros · Consulta de Notas: el mismo diseño de la Consulta de Facturas.
//   Arriba los parámetros (empresa, tipo de nota —todas, crédito, débito o abono—, fechas, fechas
//   —la inicial, por omisión, el primer día del mes en curso—, orden y estado) y la lista con sus totales; abajo la
//   nota elegida con sus productos, su detalle contable y su factura de referencia. «Consultar» abre la nota en su
//   pantalla. Reportes en PDF y Excel, resumidos o detallados.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  // Fecha (día) en la hora de Guatemala de un instante guardado en UTC.
  const diaLocal = (t) => t ? new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }) : '';

  const TIPOS = [['CRÉDITO', 'Notas de Crédito', 'notas-de-credito-electronicas'], ['DÉBITO', 'Notas de Débito', 'notas-de-debito-electronicas'], ['ABONO', 'Notas de Abono', 'notas-de-abono-electronicas']];
  const AJUSTES = ['DESCUENTO', 'DEVOLUCIÓN', 'BONIFICACIÓN', 'CORRECCIÓN DE PRECIO', 'INTERESES', 'OTRO'];
  const ORDENES = [['fecha:desc', 'Fecha ↓'], ['fecha:asc', 'Fecha ↑'], ['numero:desc', 'Número ↓'], ['numero:asc', 'Número ↑'], ['valor:desc', 'Valor ↓'], ['valor:asc', 'Valor ↑']];
  const ESTADOS = ['TODAS', 'VIGENTES', 'EMITIDAS', 'CERTIFICADAS', 'ANULADAS'];

  // Con el módulo en la clave: Caja y Bancos tiene su propia Consulta de Notas (bancarias) con el mismo id.
  window.PANTALLAS['facturacion/consulta-de-notas'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Consulta de Notas', icono: 'ti-file-search', clase: 'bk-movimientos bk-consultar cb-apilado bk-consulta-cheques cqc-con-tipo vfc-consulta vnc-consulta cq-fila', grupo: 'Ventas · Registros' });
    const { sb } = ctx;
    ctx.pFil.closest('.bk-espacio').style.setProperty('--cq-n', 6);
    // Fecha inicial por omisión: el primer día del mes en curso; en la organización 2, el de dos meses atrás (hoy, el 1 de septiembre).
    const primeroDelMes = () => {
      const org = ctx.organizaciones.find((o) => o.id === (ctx.localidad(ctx.sel.loc)?.organizacion_id ?? ctx.sel.org));
      const [y, m] = fmt.hoy().split('-').map(Number); const k = y * 12 + (m - 1) - (String(org?.codigo) === '2' ? 2 : 0);
      return `${Math.floor(k / 12)}-${String(k % 12 + 1).padStart(2, '0')}-01`;
    };
    const f = { tipo: 'CRÉDITO', cliente: '', vendedor: '', ajuste: '', desde: primeroDelMes(), hasta: fmt.hoy(), estado: 'TODAS', buscar: '', orden: 'fecha', dir: 'desc' };
    let notas = [], vendedores = [], facturas = new Map(), sel = null, consulta = 0, rango = null;
    let detalle = { lineas: [], conta: [] };

    const tipoDe = (t) => TIPOS.find((x) => x[0] === t) || TIPOS[0];
    // Tipo elegido en los parámetros («Todas» = las de crédito, débito y abono).
    const tipoF = () => f.tipo === 'TODAS' ? ['TODAS', 'Notas', ''] : tipoDe(f.tipo);
    const tiposF = () => f.tipo === 'TODAS' ? TIPOS.map((x) => x[0]) : [f.tipo];
    const nombre = (x) => `${{ 'DÉBITO': 'ND', ABONO: 'NA' }[x.tipo] || 'NC'}-${x.numero}`;
    const nombreFac = (v) => v ? (v.serie ? `${v.serie}-${v.numero_dte || ''}` : `Interna ${v.numero}`) : '';
    const vendedor = (id) => vendedores.find((v) => v.id === id);
    const estadoDe = (x) => x.estado === 'ANULADA' ? ['anulada', 'Anulada'] : x.estado === 'CERTIFICADA' ? ['definitiva', 'Certificada'] : ['aprobada', 'Emitida'];

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo vnc-tipo"><span>Tipo de nota</span><select name="tipo"><option value="TODAS" ${f.tipo === 'TODAS' ? 'selected' : ''}>Todas</option>${TIPOS.map(([k, t]) => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Ordenar por</span><select name="orden">${ORDENES.map(([k, t]) => `<option value="${k}" ${`${f.orden}:${f.dir}` === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado">${ESTADOS.map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>`,
        `<div class="bmc-reportes"><button type="button" class="boton secundario-sm bca-pdf" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i><span><b>Imprimir en PDF</b><small>Resumido o detallado</small></span></button>
         <button type="button" class="boton cqc-excel" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i><span><b>Generar Excel</b><small>Resumido o detallado</small></span></button></div>`);
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('notas_venta').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/notas_venta/.test(prueba.error.message) ? 'Falta instalar el script 134 (notas electrónicas) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const v = await sb.from('vendedores').select('id, codigo, nombre').eq('localidad_id', ctx.sel.loc || 0).order('codigo');
      vendedores = v.data || [];
      f.desde = primeroDelMes(); f.hasta = fmt.hoy(); f.vendedor = '';
      pintarFiltros();
      await consultar();
    }
    async function consultar(id = sel?.id) {
      const loc = ctx.sel.loc;
      if (!loc) { notas = []; pintar(); return; }
      const yo = ++consulta;
      const lista = [];
      for (let p = 0; p < 20000; p += 1000) {
        let q = sb.from('notas_venta').select('*').eq('localidad_id', loc).in('tipo', tiposF()).gte('fecha_emision', `${f.desde}T00:00:00-06:00`).lte('fecha_emision', `${f.hasta}T23:59:59.999-06:00`)
          .order('fecha_emision', { ascending: false }).order('numero', { ascending: false }).range(p, p + 999);
        if (f.vendedor) q = q.eq('vendedor_id', Number(f.vendedor));
        if (f.ajuste) q = q.eq('tipo_ajuste', f.ajuste);
        const r = await q;
        if (yo !== consulta) return;
        if (r.error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(r.error.message)}</p>`; return; }
        lista.push(...(r.data || []));
        if ((r.data || []).length < 1000) break;
      }
      // Facturas de referencia de la lista (número y serie).
      const ids = [...new Set(lista.map((x) => x.factura_id).filter(Boolean))]; const fm = new Map();
      for (let i = 0; i < ids.length; i += 300) {
        const { data } = await sb.from('facturas_venta').select('id, numero, serie, numero_dte, total, saldo, estado').in('id', ids.slice(i, i + 300));
        (data || []).forEach((x) => fm.set(x.id, x));
        if (yo !== consulta) return;
      }
      notas = lista; facturas = fm;
      rango = null;
      if (!lista.length) {
        const a = await sb.from('notas_venta').select('fecha_emision', { count: 'exact' }).eq('localidad_id', loc).in('tipo', tiposF()).order('fecha_emision').limit(1);
        if (a.count) rango = { n: a.count, desde: diaLocal(a.data[0].fecha_emision) };
      }
      sel = notas.find((x) => x.id === id) || null;
      pintar();
      if (!sel && visibles()[0]) await elegir(visibles()[0]);
    }
    const visibles = () => {
      const q = f.buscar.trim().toLowerCase();
      const c = f.cliente.trim().toLowerCase();
      return notas.filter((x) => (f.estado === 'TODAS' || (f.estado === 'VIGENTES' && x.estado !== 'ANULADA') || (f.estado === 'EMITIDAS' && x.estado === 'EMITIDA')
        || (f.estado === 'CERTIFICADAS' && x.estado === 'CERTIFICADA') || (f.estado === 'ANULADAS' && x.estado === 'ANULADA'))
        && (!c || [x.nombre, x.nit, x.cliente_codigo].some((v) => String(v ?? '').toLowerCase().includes(c)))
        && (!q || [x.numero, x.serie, x.numero_dte, x.autorizacion, x.nombre, x.nit, x.motivo, nombreFac(facturas.get(x.factura_id))].some((v) => String(v ?? '').toLowerCase().includes(q))))
        .sort((a, b) => {
          const va = f.orden === 'numero' ? a.numero : f.orden === 'valor' ? Number(a.valor) : a.fecha_emision;
          const vb = f.orden === 'numero' ? b.numero : f.orden === 'valor' ? Number(b.valor) : b.fecha_emision;
          const d = va < vb ? -1 : va > vb ? 1 : b.numero - a.numero;
          return f.dir === 'asc' ? d : -d;
        });
    };
    const ordenTh = (campo, texto, clase = '') => `<th class="${clase} cq-orden ${f.orden === campo ? 'activo' : ''}" data-ordenar="${campo}" title="Ordenar por ${texto.toLowerCase()}">${texto} <i class="ti ${f.orden === campo ? (f.dir === 'asc' ? 'ti-sort-ascending' : 'ti-sort-descending') : 'ti-arrows-sort'}" aria-hidden="true"></i></th>`;

    async function elegir(x) {
      sel = x;
      detalle = { lineas: [], conta: [] };
      if (x) {
        ctx.pDet.innerHTML = ctx.vacio('Cargando el detalle de la nota…', 'ti-loader-2');
        const [l, c] = await Promise.all([
          sb.from('nota_venta_lineas').select('*').eq('nota_id', x.id).order('linea'),
          sb.from('nota_venta_contable').select('linea, debe, haber, cuentas(codigo, nombre), centros_costo(codigo, nombre)').eq('nota_id', x.id).order('linea')
        ]);
        if (sel !== x) return;
        detalle = { lineas: l.data || [], conta: c.data || [] };
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-nota]').forEach((tr) => tr.classList.toggle('actual', !!x && tr.dataset.nota === String(x.id)));
    }
    function pintar() { pintarMaestro(); pintarDetalle(); }

    function pintarMaestro() {
      const filas = visibles();
      const vivas = filas.filter((x) => x.estado !== 'ANULADA');
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>${esc(tipoF()[1])} <small>${filas.length}</small></h2>
          <div class="ta-totales pc-resumen">
            <span class="ta-total"><b>Q ${fmt.monto(vivas.reduce((t, x) => t + Number(x.valor || 0), 0))}</b> vigentes (${vivas.length})</span>
            <span class="ta-total"><b>${filas.length - vivas.length}</b> anuladas</span>
            <span class="ta-total"><b>${vivas.filter((x) => x.tipo_ajuste === 'DEVOLUCIÓN').length}</b> devoluciones</span>
            <span class="ta-total sin"><b>${vivas.filter((x) => x.estado === 'EMITIDA').length}</b> sin certificar</span>
          </div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Número, serie, DTE, cliente, factura…" value="${esc(f.buscar)}" aria-label="Buscar notas"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table class="cqc-tabla vfc-tabla vnc-tabla"><colgroup><col class="w-vf-num"><col class="w-fecha"><col><col class="w-vf-num"><col class="w-vf-pago"><col class="w-valor"><col class="w-valor"><col class="w-estado"><col class="w-acc"></colgroup>
            <thead><tr>${ordenTh('numero', 'Nota', 'num')}${ordenTh('fecha', 'Fecha')}<th>Cliente · NIT</th><th>Factura</th><th>Ajuste</th>${ordenTh('valor', 'Valor', 'num')}<th class="num">Valor MI</th><th>Estado</th><th aria-label="Consultar"></th></tr></thead>
            <tbody>${filas.map((x) => { const [cls, txt] = estadoDe(x); const fa = facturas.get(x.factura_id); return `<tr data-nota="${x.id}" class="${sel && sel.id === x.id ? 'actual' : ''} ${x.estado === 'ANULADA' ? 'pc-anulada' : ''}" tabindex="0">
              <td class="num fuerte">${esc(nombre(x))}<small class="cq-ant">${esc([x.serie, x.numero_dte].filter(Boolean).join('-') || 'sin DTE')}</small></td>
              <td>${esc(fmt.fechaDia(diaLocal(x.fecha_emision)))}</td>
              <td class="cqc-quien" title="${esc(x.nombre)}"><b>${esc(x.nombre)}</b><small>${esc(x.cliente_codigo ? `${x.cliente_codigo} · ` : '')}${esc(x.nit || '')}</small></td>
              <td>${fa ? `${esc(nombreFac(fa))}<small class="cq-ant">interno ${fa.numero}</small>` : '—'}</td>
              <td>${esc(x.tipo_ajuste || '')}</td>
              <td class="num"><b>${fmt.monto(x.valor)}</b></td>
              <td class="num tk-tenue">${fmt.monto(x.valor_mi)}</td>
              <td class="cqc-estado"><span class="pc-marca ${cls}">${txt}</span></td>
              <td class="cq-acc"><button type="button" class="boton secundario-sm cqc-ver" data-consultar="${x.id}" title="Consultar: abrir la nota"><i class="ti ti-file-search" aria-hidden="true"></i> Consultar</button></td></tr>`; }).join('')
              || `<tr><td colspan="9" class="tk-vacio"><i class="ti ti-file-search" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : !notas.length && rango ? `No hay ${esc(tipoF()[1].toLowerCase())} entre el ${esc(fmt.fechaDia(f.desde))} y el ${esc(fmt.fechaDia(f.hasta))}. La empresa tiene <b>${rango.n.toLocaleString('es-GT')}</b>. <button type="button" class="boton primario-sm" data-ver-todos>Ver todas</button>` : `No hay ${esc(tipoF()[1].toLowerCase())} con estos parámetros.`}</td></tr>`}</tbody></table>
        </div>`;
    }

    function pintarDetalle() {
      const x = sel;
      if (!x) { ctx.pDet.innerHTML = ctx.vacio(ctx.sel.loc ? 'Elige una nota para ver su detalle.' : 'Elige la empresa.', 'ti-file-search'); return; }
      const { lineas, conta } = detalle;
      const [cls, txt] = estadoDe(x);
      const fa = facturas.get(x.factura_id);
      const debe = conta.reduce((t, l) => t + Number(l.debe || 0), 0), haber = conta.reduce((t, l) => t + Number(l.haber || 0), 0);
      ctx.pDet.innerHTML = `
        <div class="tk-form cq-ficha">
          <header class="tk-titulo cb-titulo">
            <span class="tk-icono"><i class="ti ti-file-certificate" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>${esc(tipoDe(x.tipo)[1].replace('Notas', 'Nota'))} ${esc(nombre(x))} · ${esc(x.tipo_ajuste.toLowerCase())}${x.autorizacion ? ` · autorización ${esc(x.autorizacion)}` : ' · sin certificar'}</small><h2>${esc(x.nombre)}</h2></div>
            <dl class="cq-datos">
              <div><dt>Fecha</dt><dd>${esc(fmt.fechaDia(diaLocal(x.fecha_emision)))}</dd></div>
              <div><dt>Valor</dt><dd>Q ${fmt.monto(x.valor)}</dd></div>
              <div><dt>Factura</dt><dd>${fa ? `<a class="vf-p-link" href="#/facturacion/facturas-ventas/${fa.id}">${esc(nombreFac(fa))}</a>` : '—'}</dd></div>
              <div><dt>Saldo factura</dt><dd>${fa ? `Q ${fmt.monto(fa.saldo)}` : '—'}</dd></div>
              <div><dt>Estado</dt><dd><span class="pc-marca ${cls}">${txt}</span></dd></div>
            </dl>
            <div class="tk-titulo-acciones"><a class="boton primario-sm" href="#/facturacion/${tipoDe(x.tipo)[2]}/${x.id}"><i class="ti ti-eye" aria-hidden="true"></i> Ver la nota</a></div>
          </header>
          ${x.estado === 'ANULADA' ? `<p class="cqc-concepto"><span class="pc-rojo">Anulada por ${esc(x.anulada_por || '')}: ${esc(x.motivo_anulacion || '')}</span></p>` : x.motivo ? `<p class="cqc-concepto">${esc(x.motivo)}</p>` : ''}
          <div class="cq-det vfc-det">
            <section class="cb-bloque cq-conta">
              <h3 class="ta-col-titulo"><i class="ti ti-list-details" aria-hidden="true"></i> Productos <small>${lineas.length}</small></h3>
              <div class="pc-lineas"><table><thead><tr><th class="pc-n">#</th><th>Producto</th><th>Descripción</th><th>Lote</th><th class="num">Cantidad</th><th class="num">Precio</th><th class="num">Total</th><th>Inv.</th></tr></thead>
                <tbody>${lineas.map((l) => `<tr><td class="pc-n">${l.linea}</td><td class="fuerte">${esc(String(l.producto_codigo ?? ''))}</td><td class="cc-nombre">${esc(l.descripcion)}</td><td>${esc(l.lote || '')}</td><td class="num">${fmt.monto(l.cantidad)}</td><td class="num">${fmt.monto(l.precio)}</td><td class="num">${fmt.monto(l.total)}</td><td>${l.inventario ? '<i class="ti ti-check" aria-label="Sí"></i>' : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="tk-vacio">Sin productos.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="6">Total</td><td class="num">${fmt.monto(x.valor)}</td><td></td></tr></tfoot></table></div>
            </section>
            <section class="cb-bloque cq-lineas">
              <h3 class="ta-col-titulo"><i class="ti ti-notebook" aria-hidden="true"></i> Detalle contable <small>${conta.length}</small>${conta.length ? (Math.abs(debe - haber) < 0.005 ? ' <span class="pc-marca aprobada">Cuadra</span>' : ' <span class="pc-marca anulada">No cuadra</span>') : ''}</h3>
              <div class="pc-lineas"><table><thead><tr><th>Cuenta</th><th>Nombre</th><th>Centro de costo</th><th class="num">Debe</th><th class="num">Haber</th></tr></thead>
                <tbody>${conta.map((l) => `<tr><td class="fuerte">${esc(l.cuentas?.codigo || '')}</td><td class="cc-nombre">${esc(l.cuentas?.nombre || '')}</td><td>${esc(l.centros_costo ? `${l.centros_costo.codigo} · ${l.centros_costo.nombre}` : '')}</td><td class="num">${Number(l.debe) ? fmt.monto(l.debe) : ''}</td><td class="num">${Number(l.haber) ? fmt.monto(l.haber) : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="tk-vacio">Sin detalle contable.</td></tr>'}</tbody></table></div>
            </section>
          </div>
        </div>`;
    }

    // ---------- Reportes ----------
    function parametros() {
      const emp = ctx.localidad(ctx.sel.loc);
      return [`Empresa: ${emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '—'}`, `Tipo: ${tipoF()[1]}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`,
        `Estado: ${f.estado}`, ...(f.buscar.trim() ? [`Búsqueda: ${f.buscar.trim()}`] : [])];
    }
    function dialogo(formato) {
      const filas = visibles();
      if (!filas.length) return window.FIN.aviso('No hay notas con estos parámetros');
      let formRef = null;
      window.UI.formulario({
        titulo: `Reporte de ${tipoF()[1].toLowerCase()} · ${formato === 'PDF' ? 'Imprimir en PDF' : 'Generar Excel'}`, campos: [],
        alPreparar: (form) => {
          formRef = form;
          form.querySelector('.modal-cuerpo').innerHTML = `
            <fieldset class="cqc-tipos"><legend>Tipo de reporte</legend>
              <label class="cqc-tipo"><input type="radio" name="tipo" value="RESUMIDO" checked><i class="ti ti-list" aria-hidden="true"></i><span><b>Resumido</b><small>El listado de las ${filas.length.toLocaleString('es-GT')} notas.</small></span></label>
              <label class="cqc-tipo"><input type="radio" name="tipo" value="DETALLADO"><i class="ti ti-list-details" aria-hidden="true"></i><span><b>Detallado</b><small>Cada nota con sus productos.</small></span></label>
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
          const { data } = await sb.from('nota_venta_lineas').select('nota_id, linea, producto_codigo, descripcion, lote, cantidad, precio, total').in('nota_id', ids.slice(i, i + 200)).order('linea');
          (data || []).forEach((l) => { if (!lineasDe.has(l.nota_id)) lineasDe.set(l.nota_id, []); lineasDe.get(l.nota_id).push(l); });
        }
      }
      const vivas = filas.filter((x) => x.estado !== 'ANULADA');
      const total = vivas.reduce((t, x) => t + Number(x.valor || 0), 0);
      const titulo = `Consulta de ${tipoF()[1]}`;
      if (formato === 'PDF') {
        window.BANCOS.imprimir(titulo, `<h1>${esc(titulo)} · ${modo === 'DETALLADO' ? 'detallado' : 'resumido'}</h1><h2>${esc(parametros().join(' · '))}</h2>
          <table><thead><tr><th>Nota</th><th>Fecha</th><th>Cliente</th><th>NIT</th><th>Factura</th><th>Ajuste</th><th class="n">Valor</th><th>Estado</th></tr></thead><tbody>
          ${filas.map((x) => `<tr class="${modo === 'DETALLADO' ? 's' : ''}"><td>${esc(nombre(x))}</td><td>${esc(fmt.fechaDia(diaLocal(x.fecha_emision)))}</td><td>${esc(x.nombre)}</td><td>${esc(x.nit || '')}</td><td>${esc(nombreFac(facturas.get(x.factura_id)))}</td><td>${esc(x.tipo_ajuste)}</td><td class="n">${fmt.monto(x.valor)}</td><td>${estadoDe(x)[1]}</td></tr>
            ${modo === 'DETALLADO' ? (lineasDe.get(x.id) || []).map((l) => `<tr><td></td><td>${l.linea}</td><td colspan="3">${esc(String(l.producto_codigo ?? ''))} · ${esc(l.descripcion)}${l.lote ? ` · lote ${esc(l.lote)}` : ''}</td><td class="n">${fmt.monto(l.cantidad)}</td><td class="n">${fmt.monto(l.total)}</td><td></td></tr>`).join('') : ''}`).join('')}
          </tbody><tfoot><tr><td colspan="6">Total de ${vivas.length} notas vigentes (de ${filas.length})</td><td class="n">${fmt.monto(total)}</td><td></td></tr></tfoot></table>`, { locId: ctx.sel.loc, horizontal: true });
        return;
      }
      if (!window.REPORTE_XLSX) return;
      const datos = [];
      filas.forEach((x) => {
        datos.push({ resaltar: modo === 'DETALLADO' ? 1 : 0, tenue: x.estado === 'ANULADA', valores: [nombre(x), fmt.fechaDia(diaLocal(x.fecha_emision)), x.nombre, x.nit || '', nombreFac(facturas.get(x.factura_id)), x.tipo_ajuste, Number(x.valor || 0), estadoDe(x)[1]] });
        if (modo === 'DETALLADO') (lineasDe.get(x.id) || []).forEach((l) => datos.push({ tipo: 'nota', valores: ['', l.linea, `${l.producto_codigo ?? ''} · ${l.descripcion}`, l.lote || '', '', Number(l.cantidad), Number(l.total), ''] }));
      });
      datos.push({ tipo: 'total', valores: ['', '', `Total de ${vivas.length} notas vigentes (de ${filas.length})`, '', '', '', total, ''] });
      const emp = ctx.localidad(ctx.sel.loc);
      window.REPORTE_XLSX.generar({ titulo: `${titulo} · ${modo === 'DETALLADO' ? 'Detallado' : 'Resumido'}`, parametros: parametros(), orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Notas',
        archivo: `notas_${f.tipo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}_${modo.toLowerCase()}_${emp?.codigo || ''}_${f.desde}_${f.hasta}`, autofiltro: modo !== 'DETALLADO',
        columnas: [{ titulo: 'Nota', ancho: 11 }, { titulo: modo === 'DETALLADO' ? 'Fecha · línea' : 'Fecha', ancho: 12 }, { titulo: modo === 'DETALLADO' ? 'Cliente · producto' : 'Cliente', ancho: 46 }, { titulo: modo === 'DETALLADO' ? 'NIT · lote' : 'NIT', ancho: 14 },
          { titulo: 'Factura', ancho: 16 }, { titulo: modo === 'DETALLADO' ? 'Ajuste · cantidad' : 'Ajuste', ancho: 16 }, { titulo: 'Valor', ancho: 15, tipo: 'monto' }, { titulo: 'Estado', ancho: 12 }],
        filas: datos });
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { sel = null; return cargarLocalidad(); }
      if (cambio === 'otro') {
        const n = e.target.name;
        if (n === 'estado' || n === 'cliente') { f[n] = e.target.value; pintarMaestro(); return elegir(visibles().find((x) => x.id === sel?.id) || visibles()[0] || null); }
        if (n === 'orden') { [f.orden, f.dir] = e.target.value.split(':'); return pintarMaestro(); }
        if (['tipo', 'vendedor', 'ajuste', 'desde', 'hasta'].includes(n)) { f[n] = e.target.value; sel = null; return consultar(); }
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
      if (e.key === 'Enter' && e.target.matches('tr[data-nota]')) e.target.click();
    });
    cont.addEventListener('click', (e) => {
      const q = e.target.closest('[data-consultar]');
      if (q) { const x = notas.find((y) => String(y.id) === q.dataset.consultar); if (x) location.hash = `#/facturacion/${tipoDe(x.tipo)[2]}/${x.id}`; return; }
      if (e.target.closest('[data-ver-todos]') && rango) { f.desde = rango.desde; f.hasta = fmt.hoy(); sel = null; pintarFiltros(); return consultar(); }
      const th = e.target.closest('[data-ordenar]');
      if (th) { const campo = th.dataset.ordenar; f.dir = f.orden === campo && f.dir === 'desc' ? 'asc' : 'desc'; f.orden = campo; const o = ctx.pFil.querySelector('[name=orden]'); if (o) o.value = `${f.orden}:${f.dir}`; return pintarMaestro(); }
      const tr = e.target.closest('tr[data-nota]');
      if (tr && ctx.pMae.contains(tr)) return elegir(notas.find((x) => String(x.id) === tr.dataset.nota));
      const ac = e.target.closest('[data-accion]');
      if (ac?.dataset.accion === 'excel') return dialogo('EXCEL');
      if (ac?.dataset.accion === 'pdf') return dialogo('PDF');
    });

    iniciar();
  };
})();
