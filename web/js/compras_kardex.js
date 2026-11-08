// Compras · Mantenimientos · Kardex de Productos. El diseño depende de lo que vende la empresa
// (localidades.tipo_venta):
//   Productos no perecederos: «Productos en bodega» con la existencia por serie.
//   Medicamentos y perecederos (o sin definir): «Movimientos de productos en bodega» con lote,
//   fabricación, vencimiento, existencia por lote y costo promedio, entre fechas.
// Arriba el catálogo de productos (subir / bajar para recorrerlo) y abajo sus entradas y salidas,
// de la más reciente a la más antigua, con su documento interno y físico.
// Compras · Mantenimientos · Análisis de Costos: compras de cada producto, promedio, descuentos,
// bonificaciones, notas de crédito y costo neto.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const cant = (n) => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const fechaHora = (d, t) => `${fmt.fechaDia(d)}${t ? ` ${new Date(t).toLocaleTimeString('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit', hour12: false })}` : ''}`;
  // Tipo de movimiento: código y nombre, según su origen y documento.
  function tipoMov(m) {
    if (m.origen === 'INGRESO') return [1, 'INGRESO - ORDEN DE COMPRA'];
    if (m.origen === 'COMPRA') return [2, 'INGRESO - COMPRA'];
    if (m.origen === 'NOTA' && m.nota_venta_lineas) return [10, 'INGRESO - DEVOLUCIÓN CLIENTE'];
    if (m.origen === 'NOTA') return m.c < 0 ? [3, 'SALIDA - NOTA DE CRÉDITO'] : [4, 'INGRESO - NOTA DE DÉBITO'];
    if (m.origen === 'VENTA') return [8, 'SALIDA - FACTURA'];
    if (m.origen === 'CONSIGNACIÓN') return m.c > 0 ? [5, 'INGRESO - CONSIGNACIÓN'] : [6, 'SALIDA - DEVOLUCIÓN CONSIGNACIÓN'];
    if (m.origen === 'DESPACHO') return [8, 'SALIDA - FACTURA'];
    if (m.origen === 'TRASLADO') return [9, m.c > 0 ? 'INGRESO - TRASLADO' : 'SALIDA - TRASLADO'];
    if (m.doc?.tipo === 'DEVOLUCIÓN') return [12, m.c > 0 ? 'INGRESO - REINGRESO' : 'SALIDA - DEVOLUCIÓN'];
    if (m.doc?.tipo === 'AJUSTE LOTE') return [11, m.c > 0 ? 'INGRESO - AJUSTE DE LOTE' : 'SALIDA - AJUSTE DE LOTE'];
    return [7, m.c > 0 ? 'INGRESO - AJUSTE' : 'SALIDA - AJUSTE'];
  }

  // op: { titulo, grupo, costos } · costos false: Kardex sin costos (solo cantidades por lote y existencias).
  function kardex(cont, op = {}) {
    const conCostos = op.costos !== false;
    const ctx = montar(cont, { titulo: op.titulo || 'Kardex de Productos', icono: 'ti-list-numbers', clase: `bk-movimientos kx-kardex ${conCostos ? 'kx-costos' : 'kx-sin-costos'}`, grupo: op.grupo || 'Compras · Mantenimientos' });
    const { sb } = ctx;
    const f = { bodega: '', todas: false, desde: '', hasta: fmt.hoy(), formato: 'PDF', inactivos: false, buscar: '' };
    let tipoVenta = null, productos = [], bodegas = [], existencias = new Map();
    let sel = null, movs = [], inicial = 0;
    const noPerecedero = () => tipoVenta === 'NO PERECEDEROS';
    const prod = (id) => productos.find((p) => p.id === id);
    const bodega = (id) => bodegas.find((b) => b.id === id);
    const visibles = () => {
      const q = f.buscar.trim().toLowerCase();
      return productos.filter((p) => (f.inactivos || p.estado === 'ACTIVO') && (!q || [p.codigo, p.codigo_producto, p.codigo_barras, p.nombre, p.principio_activo].some((v) => String(v || '').toLowerCase().includes(q))));
    };
    const existencia = (id) => {
      if (f.todas || !f.bodega) return bodegas.reduce((t, b) => t + (existencias.get(`${id}|${b.id}`) || 0), 0);
      return existencias.get(`${id}|${f.bodega}`) || 0;
    };

    function pintarFiltros() { ctx.filtros(''); }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      pintarFiltros();
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      if (!loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-list-numbers'); return; }
      const [l, p, b, ex] = await Promise.all([
        sb.from('localidades').select('tipo_venta').eq('id', loc).maybeSingle(),
        sb.from('productos').select('*, clasificaciones_producto(nombre), tipos_producto(nombre), tipos_medida(nombre)').eq('localidad_id', loc).order('codigo'),
        sb.from('bodegas').select('id, codigo, nombre, estado, tipo, bodega_mayor_id').eq('localidad_id', loc).order('codigo'),
        sb.from('existencias').select('producto_id, bodega_id, existencia').eq('localidad_id', loc)
      ]);
      tipoVenta = l.error ? null : l.data?.tipo_venta || null;
      productos = p.data || [];
      bodegas = (b.data || []).filter((x) => x.estado === 'ACTIVO');
      existencias = new Map((ex.data || []).map((x) => [`${x.producto_id}|${x.bodega_id}`, Number(x.existencia)]));
      // La bodega principal: la que se llama «principal» o la general sin bodega mayor.
      f.bodega = String((bodegas.find((x) => /PRINCIPAL/i.test(x.nombre)) || bodegas.find((x) => x.tipo !== 'SUB-BODEGA' && !x.bodega_mayor_id) || bodegas[0])?.id || '');
      const conMov = productos.find((x) => existencia(x.id) || bodegas.some((bb) => existencias.has(`${x.id}|${bb.id}`)));
      sel = (conMov || visibles()[0])?.id || null;
      pintar();
      await consultar();
    }
    async function consultar() {
      movs = []; inicial = 0;
      if (!sel) return pintarMovs();
      let q = sb.from('inventario_movimientos').select(`id, fecha, creado_en, cantidad, costo_unitario, origen, lote, fecha_vencimiento, usuario, bodega_id,
          ingreso_lineas(fecha_fabricacion, ingresos_compra(numero, serie, documento, ordenes_compra(numero))), compra_articulos(compras(numero, serie, documento, proveedor_nombre)),
          nota_compra_lineas(fecha_fabricacion, notas_compra(numero, tipo, serie, documento, proveedor_nombre)), consignacion_lineas(consignaciones(numero, tipo_documento, serie, documento, proveedor_nombre)),
          factura_venta_lineas(fecha_fabricacion, facturas_venta(numero, serie, numero_dte, nombre)), nota_venta_lineas(fecha_fabricacion, notas_venta(numero, serie, numero_dte, nombre)),
          documento_inventario_lineas(fecha_fabricacion, nueva_fabricacion, documentos_inventario(numero, tipo, descripcion))`)
        .eq('localidad_id', ctx.sel.loc).eq('producto_id', sel).order('fecha').order('id');
      if (!f.todas && f.bodega) q = q.eq('bodega_id', Number(f.bodega));
      if (!noPerecedero() && f.hasta) q = q.lte('fecha', f.hasta);
      const { data, error } = await q.limit(20000);
      if (error) { ctx.pDet.querySelector('[data-movs]').innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      // Saldos en orden cronológico: total, por lote o serie y costo promedio ponderado.
      let total = 0, valor = 0, prom = 0;
      const lotes = new Map();
      const todos = (data || []).map((x) => {
        const c = Number(x.cantidad), costo = Number(x.costo_unitario);
        if (c > 0) { valor += c * costo; total += c; prom = total ? valor / total : costo; }
        else { total += c; valor = total * prom; }
        const lote = x.lote || '';
        lotes.set(lote, (lotes.get(lote) || 0) + c);
        const ing = x.ingreso_lineas?.ingresos_compra, com = x.compra_articulos?.compras, nota = x.nota_compra_lineas?.notas_compra, con = x.consignacion_lineas?.consignaciones;
        const fv = x.factura_venta_lineas?.facturas_venta, nv = x.nota_venta_lineas?.notas_venta, di = x.documento_inventario_lineas?.documentos_inventario;
        const venta = fv || nv ? { numero: (fv || nv).numero, serie: (fv || nv).serie, documento: (fv || nv).numero_dte } : null;
        const d = ing || com || nota || con || venta || (di ? { numero: di.numero, serie: di.tipo === 'TRASLADO' ? 'TRASLADO' : 'AJUSTE' } : null) || {};
        const m = { ...x, c, costo, total, exLote: lotes.get(lote), prom, valorTotal: total * prom, lote,
          interno: d.numero ?? '', fisico: [d.serie, d.documento].filter(Boolean).join('-'), tercero: com?.proveedor_nombre || nota?.proveedor_nombre || con?.proveedor_nombre || fv?.nombre || nv?.nombre || '', doc: di || null,
          fabricacion: x.ingreso_lineas?.fecha_fabricacion || x.nota_compra_lineas?.fecha_fabricacion || x.factura_venta_lineas?.fecha_fabricacion || x.nota_venta_lineas?.fecha_fabricacion
            || (di?.tipo === 'AJUSTE LOTE' && c > 0 ? x.documento_inventario_lineas?.nueva_fabricacion : x.documento_inventario_lineas?.fecha_fabricacion) || null, orden: ing?.ordenes_compra?.numero || '' };
        [m.tipo, m.nombre] = tipoMov(m);
        return m;
      });
      const desde = !noPerecedero() && f.desde ? f.desde : '';
      inicial = desde ? todos.filter((m) => m.fecha < desde).reduce((t, m) => t + m.c, 0) : 0;
      movs = todos.filter((m) => !desde || m.fecha >= desde).reverse();
      pintarMovs();
    }

    // ---------- Pintar ----------
    function pintar() {
      const np = noPerecedero();
      const p = prod(sel);
      ctx.pDet.innerHTML = `
        <div class="bm-form kx-form cl-clasico ${np ? 'kx-np' : 'kx-pe'}">
          <div class="cl-banda kx-banda"><span>${np ? 'Productos en bodega (Kardex)' : `Movimientos de productos en bodega (Kardex${conCostos ? ' con costos' : ''})`}</span>
            <small>${esc({ MEDICAMENTOS: 'Medicamentos', PERECEDEROS: 'Productos perecederos', 'NO PERECEDEROS': 'Productos no perecederos' }[tipoVenta] || 'Venta de productos sin definir en la empresa')}</small></div>
          ${np ? '' : barraES()}
          <section class="kx-cat">
            <div class="kx-cat-cab">
              <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Código, código de barras, nombre o principio activo…" value="${esc(f.buscar)}" aria-label="Buscar producto"></label>
              ${np ? `<button type="button" class="boton primario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>`
                : `<label class="pc-check kx-inact"><input type="checkbox" data-inactivos ${f.inactivos ? 'checked' : ''}> Incluir inactivos</label>`}
            </div>
            <div class="pc-lineas kx-productos"><table>
              <thead><tr><th class="num">${np ? 'ID' : 'Código'}</th><th>Código producto</th><th>Nombre</th>${np ? '<th>Clasificación</th><th>Línea / principio activo</th>' : '<th>Principio activo</th><th>Estado</th>'}<th class="num">Existencia</th></tr></thead>
              <tbody data-productos>${filasProductos()}</tbody>
            </table></div>
          </section>
          ${np ? barraES() : ''}
          <section class="kx-movs" data-movs></section>
        </div>`;
      if (p) ctx.pDet.querySelector(`tr[data-prod="${p.id}"]`)?.scrollIntoView({ block: 'nearest' });
    }
    function filasProductos() {
      const np = noPerecedero();
      return visibles().map((p) => `<tr data-prod="${p.id}" class="${p.id === sel ? 'actual' : ''}" tabindex="0">
          <td class="num fuerte">${p.codigo}</td><td>${esc(p.codigo_producto || '')}</td><td class="cx-nombre" title="${esc(p.nombre)}">${esc(p.nombre)}</td>
          ${np ? `<td class="tk-tenue">${esc(p.clasificaciones_producto?.nombre || '')}</td><td>${esc(p.principio_activo || p.tipos_producto?.nombre || '')}</td>`
            : `<td class="cx-nombre" title="${esc(p.principio_activo || '')}">${esc(p.principio_activo || '')}</td><td><span class="pc-marca ${p.estado === 'ACTIVO' ? 'aprobada' : 'anulada'}">${esc(p.estado.charAt(0) + p.estado.slice(1).toLowerCase())}</span></td>`}
          <td class="num ${existencia(p.id) ? 'fuerte' : 'tk-tenue'}">${cant(existencia(p.id))}</td></tr>`).join('')
        || '<tr><td colspan="6" class="tk-vacio">Ningún producto coincide.</td></tr>';
    }
    function barraES() {
      const np = noPerecedero();
      return `<section class="kx-es">
          <b class="kx-es-tit">Entradas y salidas</b>
          <div class="kx-nav"><button type="button" class="boton secundario-sm" data-mover="-1" title="Producto anterior"><i class="ti ti-chevron-up" aria-hidden="true"></i> Subir</button><button type="button" class="boton secundario-sm" data-mover="1" title="Producto siguiente"><i class="ti ti-chevron-down" aria-hidden="true"></i> Bajar</button></div>
          <label class="campo kx-bod"><span>Bodega</span><select data-bodega ${f.todas ? 'disabled' : ''}>${bodegas.map((b) => `<option value="${b.id}" ${String(b.id) === f.bodega ? 'selected' : ''}>${b.codigo} · ${esc(b.nombre)}</option>`).join('')}</select></label>
          ${np ? '' : `
          <div class="kx-radios"><label><input type="radio" name="kx-todas" value="0" ${f.todas ? '' : 'checked'}> Bodega seleccionada</label><label><input type="radio" name="kx-todas" value="1" ${f.todas ? 'checked' : ''}> Todas las bodegas</label></div>
          <label class="campo"><span>Fecha inicial</span><input type="date" data-f="desde" value="${f.desde}" max="${f.hasta}"></label>
          <label class="campo"><span>Fecha final</span><input type="date" data-f="hasta" value="${f.hasta}" min="${f.desde}"></label>
          <div class="kx-imp"><select data-formato aria-label="Formato"><option ${f.formato === 'PDF' ? 'selected' : ''}>PDF</option><option ${f.formato === 'EXCEL' ? 'selected' : ''}>EXCEL</option></select><button type="button" class="boton primario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button></div>`}
        </section>`;
    }
    function pintarMovs() {
      const caja = ctx.pDet.querySelector('[data-movs]');
      if (!caja) return;
      const np = noPerecedero();
      const p = prod(sel);
      const todas = f.todas || !f.bodega;
      const ent = movs.reduce((t, m) => t + (m.c > 0 ? m.c : 0), 0), sal = movs.reduce((t, m) => t + (m.c < 0 ? -m.c : 0), 0);
      const ult = movs[0];
      const n = movs.length;
      caja.innerHTML = `
        <div class="kx-resumen">${p ? `<b>${esc(p.codigo_producto || String(p.codigo))} · ${esc(p.nombre)}</b>
          <span>Entradas <b class="kx-ent">${cant(ent)}</b></span><span>Salidas <b class="kx-sal">${cant(sal)}</b></span><span>Existencia <b>${cant(ult ? ult.total : inicial)}</b></span>
          ${np || !conCostos ? '' : `<span>Costo promedio <b>Q ${fmt.monto(ult?.prom || 0)}</b></span><span>Costo total <b>Q ${fmt.monto(ult?.valorTotal || 0)}</b></span>`}
          <span class="tk-tenue">${todas ? 'Todas las bodegas' : esc(bodega(Number(f.bodega))?.nombre || '')}</span>` : '<span class="tk-tenue">Elige un producto.</span>'}</div>
        <div class="pc-lineas kx-tabla"><table>
          ${np ? `<thead><tr><th class="pc-n">#</th><th class="num">Mov.</th><th>Movimiento</th><th class="num"># Interno dcto.</th><th>Docto. físico</th><th>Fecha movto.</th>${todas ? '<th>Bodega</th>' : ''}<th>Serie</th><th class="num">Cantidad</th><th class="num">Existencia serie</th><th class="num">Exist. total</th></tr></thead>
            <tbody>${movs.map((m, i) => `<tr><td class="pc-n">${n - i}</td><td class="num tk-tenue">${m.tipo}</td><td><span class="kx-origen kx-${m.c > 0 ? 'e' : 's'}">${esc(m.nombre)}</span></td><td class="num">${m.interno}</td><td>${esc(m.fisico)}</td><td>${esc(fechaHora(m.fecha, m.creado_en))}</td>
              ${todas ? `<td>${esc(bodega(m.bodega_id)?.nombre || '')}</td>` : ''}<td>${esc(m.lote)}</td><td class="num ${m.c < 0 ? 'pc-rojo' : ''}">${cant(m.c)}</td><td class="num kx-col-lote">${cant(m.exLote)}</td><td class="num kx-col-total">${cant(m.total)}</td></tr>`).join('')
              || `<tr><td colspan="11" class="tk-vacio">${p ? 'El producto no tiene entradas ni salidas.' : ''}</td></tr>`}</tbody>
            <tfoot><tr><td colspan="${todas ? 8 : 7}">${n} movimiento(s)</td><td class="num">${cant(ent - sal)}</td><td></td><td class="num">${cant(ult ? ult.total : 0)}</td></tr></tfoot>`
          : `<thead><tr><th class="pc-n">#</th><th class="num">Mov.</th><th>Movimiento</th><th class="num">Docto. interno</th><th>Fecha movto.</th><th>Docto. físico</th>${todas ? '<th>Bodega</th>' : ''}<th>Fabricación</th><th>Vencimiento</th><th>Lote</th><th class="num">Cant. ingreso</th><th class="num">Cant. salida</th><th class="num">Exist. lote</th><th class="num">Exist. producto</th>${conCostos ? '<th class="num">Costo unitario</th><th class="num">Costo movimiento</th><th class="num">Costo promedio</th><th class="num">Costo total</th>' : ''}</tr></thead>
            <tbody>${movs.map((m, i) => `<tr><td class="pc-n">${n - i}</td><td class="num tk-tenue">${m.tipo}</td><td><span class="kx-origen kx-${m.c > 0 ? 'e' : 's'}">${esc(m.nombre)}</span></td><td class="num">${m.interno}</td><td>${esc(fechaHora(m.fecha, m.creado_en))}</td><td class="kx-fis" title="${esc(m.fisico)}">${esc(m.fisico)}</td>
              ${todas ? `<td>${esc(bodega(m.bodega_id)?.nombre || '')}</td>` : ''}<td>${esc(fmt.fechaDia(m.fabricacion))}</td><td class="${m.fecha_vencimiento && m.fecha_vencimiento < fmt.hoy() ? 'pc-rojo' : ''}">${esc(fmt.fechaDia(m.fecha_vencimiento))}</td><td>${esc(m.lote)}</td>
              <td class="num kx-col-ent">${m.c > 0 ? cant(m.c) : ''}</td><td class="num kx-col-ent pc-rojo">${m.c < 0 ? cant(m.c) : ''}</td><td class="num">${cant(m.exLote)}</td><td class="num kx-col-total">${cant(m.total)}</td>
              ${conCostos ? `<td class="num kx-col-costo">${fmt.monto(m.costo)}</td><td class="num kx-col-costo">${fmt.monto(m.c * m.costo)}</td><td class="num kx-col-costo">${fmt.monto(m.prom)}</td><td class="num kx-col-costo">${fmt.monto(m.valorTotal)}</td>` : ''}</tr>`).join('')}
              ${f.desde && p ? `<tr class="kx-ini"><td colspan="${todas ? 13 : 12}">Saldo al ${esc(fmt.fechaDia(f.desde))} (antes de la fecha inicial)</td><td class="num">${cant(inicial)}</td>${conCostos ? '<td colspan="4"></td>' : ''}</tr>` : ''}
              ${!movs.length ? `<tr><td colspan="18" class="tk-vacio">${p ? 'Sin entradas ni salidas en el periodo.' : ''}</td></tr>` : ''}</tbody>
            <tfoot><tr><td colspan="${todas ? 10 : 9}">${n} movimiento(s)</td><td class="num">${cant(ent)}</td><td class="num">${cant(-sal)}</td><td></td><td class="num">${cant(ult ? ult.total : inicial)}</td>${conCostos ? `<td colspan="2"></td><td class="num">${fmt.monto(ult?.prom || 0)}</td><td class="num">${fmt.monto(ult?.valorTotal || 0)}</td>` : ''}</tr></tfoot>`}
        </table></div>`;
    }

    // ---------- Imprimir ----------
    function imprimirKardex() {
      const p = prod(sel);
      if (!p) return window.FIN.aviso('Elige un producto');
      const np = noPerecedero();
      const e = ctx.localidad(ctx.sel.loc);
      const bod = f.todas || !f.bodega ? 'Todas las bodegas' : bodega(Number(f.bodega))?.nombre || '';
      const per = np ? '' : ` · ${f.desde ? `del ${fmt.fechaDia(f.desde)} ` : ''}al ${fmt.fechaDia(f.hasta)}`;
      const cab = np ? ['#', 'Movimiento', '# Interno', 'Docto. físico', 'Fecha', 'Serie', 'Cantidad', 'Exist. serie', 'Exist. total']
        : ['#', 'Movimiento', 'Docto. interno', 'Fecha', 'Docto. físico', 'Fabricación', 'Vencimiento', 'Lote', 'Ingreso', 'Salida', 'Exist. lote', 'Exist. producto', 'Costo unitario', 'Costo movimiento', 'Costo promedio', 'Costo total'];
      const n = movs.length;
      const sinC = !np && !conCostos;
      if (sinC) cab.splice(-4, 4);
      const filas0 = movs.map((m, i) => np ? [n - i, m.nombre, m.interno, m.fisico, fechaHora(m.fecha, m.creado_en), m.lote, cant(m.c), cant(m.exLote), cant(m.total)]
        : [n - i, m.nombre, m.interno, fechaHora(m.fecha, m.creado_en), m.fisico, fmt.fechaDia(m.fabricacion), fmt.fechaDia(m.fecha_vencimiento), m.lote, m.c > 0 ? cant(m.c) : '', m.c < 0 ? cant(m.c) : '', cant(m.exLote), cant(m.total), fmt.monto(m.costo), fmt.monto(m.c * m.costo), fmt.monto(m.prom), fmt.monto(m.valorTotal)]);
      const filas = sinC ? filas0.map((r) => r.slice(0, -4)) : filas0;
      if (!np && f.formato === 'EXCEL') return window.COMPRAS_CAT.descargarCsv(`kardex_${p.codigo_producto || p.codigo}_${f.hasta}.csv`, [cab, ...filas]);
      const num = np ? [6, 7, 8] : sinC ? [8, 9, 10, 11] : [8, 9, 10, 11, 12, 13, 14, 15];
      imprimir(`Kardex ${p.nombre}`, `<h1>${np ? 'Productos en bodega' : 'Movimientos de productos en bodega'} (Kardex${!np && conCostos ? ' con costos' : ''})</h1><h2>${esc(e ? `${e.codigo} · ${e.nombre_comercial}` : '')} · ${esc(bod)}${esc(per)}</h2>
        <div class="cab"><div><b>Código</b>${p.codigo}</div><div><b>Código producto</b>${esc(p.codigo_producto || '')}</div><div style="grid-column:span 2"><b>Nombre</b>${esc(p.nombre)}</div>
          <div style="grid-column:span 2"><b>${np ? 'Línea / principio activo' : 'Principio activo'}</b>${esc(p.principio_activo || p.tipos_producto?.nombre || '')}</div><div><b>Existencia</b>${cant(movs[0]?.total ?? inicial)}</div><div><b>${np || sinC ? 'Clasificación' : 'Costo promedio'}</b>${np || sinC ? esc(p.clasificaciones_producto?.nombre || '') : `Q ${fmt.monto(movs[0]?.prom || 0)}`}</div></div>
        <table><thead><tr>${cab.map((c, i) => `<th class="${num.includes(i) ? 'n' : ''}">${c}</th>`).join('')}</tr></thead>
        <tbody>${filas.map((r) => `<tr>${r.map((c, i) => `<td class="${num.includes(i) ? 'n' : ''}">${esc(String(c ?? ''))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cab.length}">Sin movimientos.</td></tr>`}</tbody></table>`);
    }

    // ---------- Eventos ----------
    function elegir(id) {
      sel = id;
      ctx.pDet.querySelectorAll('tr[data-prod]').forEach((tr) => tr.classList.toggle('actual', Number(tr.dataset.prod) === id));
      ctx.pDet.querySelector(`tr[data-prod="${id}"]`)?.scrollIntoView({ block: 'nearest' });
      consultar();
    }
    function refrescarProductos() { const tb = ctx.pDet.querySelector('[data-productos]'); if (tb) tb.innerHTML = filasProductos(); }
    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (e.target.matches('[data-bodega]')) { f.bodega = e.target.value; refrescarProductos(); return consultar(); }
      if (e.target.name === 'kx-todas') { f.todas = e.target.value === '1'; ctx.pDet.querySelector('[data-bodega]').disabled = f.todas; refrescarProductos(); return consultar(); }
      if (e.target.matches('[data-inactivos]')) { f.inactivos = e.target.checked; return refrescarProductos(); }
      if (e.target.matches('[data-formato]')) { f.formato = e.target.value; return; }
      if (e.target.dataset.f) {
        f[e.target.dataset.f] = e.target.value;
        if (f.desde && f.hasta && f.hasta < f.desde) { if (e.target.dataset.f === 'desde') f.hasta = f.desde; else f.desde = f.hasta; }
        ctx.pDet.querySelector('[data-f=desde]').value = f.desde; ctx.pDet.querySelector('[data-f=hasta]').value = f.hasta;
        return consultar();
      }
    });
    cont.addEventListener('input', (e) => { if (e.target.matches('[data-buscar]')) { f.buscar = e.target.value; refrescarProductos(); } });
    cont.addEventListener('click', (e) => {
      const fila = e.target.closest('tr[data-prod]');
      if (fila) return elegir(Number(fila.dataset.prod));
      const mv = e.target.closest('[data-mover]');
      if (mv) { const v = visibles(); const i = v.findIndex((p) => p.id === sel); const nx = v[Math.max(0, Math.min(v.length - 1, i + Number(mv.dataset.mover)))]; if (nx && nx.id !== sel) elegir(nx.id); return; }
      if (e.target.closest('[data-accion=imprimir]')) return imprimirKardex();
    });
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-buscar]')) { e.preventDefault(); const v = visibles(); if (v[0]) elegir(v[0].id); return; }
      const fila = e.target.closest?.('tr[data-prod]');
      if (fila && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); const v = visibles(); const i = v.findIndex((p) => p.id === Number(fila.dataset.prod)); const nx = v[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (nx) { elegir(nx.id); ctx.pDet.querySelector(`tr[data-prod="${nx.id}"]`)?.focus(); } }
      else if (fila && e.key === 'Enter') elegir(Number(fila.dataset.prod));
    });
    iniciar();
  }
  window.PANTALLAS['kardex-productos'] = (cont) => kardex(cont);
  window.PANTALLAS['kardex-sin-costos'] = (cont) => kardex(cont, { titulo: 'Movimiento de productos (Kardex)', grupo: 'Inventarios · Mantenimientos', costos: false });
  window.PANTALLAS['kardex-con-costos'] = (cont) => kardex(cont, { titulo: 'Movimiento de productos (Kardex con costos)', grupo: 'Inventarios · Mantenimientos', costos: true });
  // ===================== Análisis de Costos =====================
  // Por producto: sus compras (artículos de compras vigentes) con el costo unitario de cada una, los
  // descuentos de línea, las bonificaciones de la compra prorrateadas y las notas de crédito
  // operadas; el promedio ponderado de compras, el costo neto, el último, el mínimo, el máximo y la
  // diferencia contra el precio de costo del catálogo.
  window.PANTALLAS['analisis-costos'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Análisis de Costos', icono: 'ti-chart-line', clase: 'bk-movimientos kx-kardex ac-costos', grupo: 'Compras · Mantenimientos' });
    const { sb } = ctx;
    const [y] = fmt.hoy().split('-');
    const f = { desde: `${y}-01-01`, hasta: fmt.hoy(), buscar: '', inactivos: false };
    let productos = [], resumen = new Map(), sel = null, compras = [], notas = 0;
    const prod = (id) => productos.find((p) => p.id === id);
    const aBase = (c) => (ctx.moneda(c.moneda_id)?.iso === 'GTQ' ? 1 : Number(c.tipo_cambio) || 1);
    const visibles = () => {
      const q = f.buscar.trim().toLowerCase();
      return productos.filter((p) => (f.inactivos || p.estado === 'ACTIVO') && (!q || [p.codigo, p.codigo_producto, p.nombre, p.principio_activo].some((v) => String(v || '').toLowerCase().includes(q))));
    };

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Compras desde</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Compras hasta</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>`,
        '<button type="button" class="boton primario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>');
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      pintarFiltros();
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      if (!loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-chart-line'); return; }
      const { data } = await sb.from('productos').select('*, clasificaciones_producto(nombre), tipos_producto(nombre), tipos_medida(nombre), presentaciones_producto(nombre)').eq('localidad_id', loc).order('codigo');
      productos = data || [];
      await consultarResumen();
      sel = (productos.find((p) => resumen.has(p.id)) || visibles()[0])?.id || null;
      pintar();
      await consultar();
    }
    // Compras por producto en el periodo (para marcar qué productos tienen compras y su promedio).
    async function consultarResumen() {
      const { data } = await sb.from('compra_articulos').select('producto_id, cantidad, costo_total, compras!inner(estado, fecha_documento, localidad_id, moneda_id, tipo_cambio)')
        .eq('compras.localidad_id', ctx.sel.loc).eq('compras.estado', 'ACTIVA').gte('compras.fecha_documento', f.desde).lte('compras.fecha_documento', f.hasta).limit(20000);
      resumen = new Map();
      (data || []).forEach((a) => { const r = resumen.get(a.producto_id) || { cant: 0, total: 0, n: 0 }; r.cant += Number(a.cantidad); r.total += Number(a.costo_total) * aBase(a.compras); r.n++; resumen.set(a.producto_id, r); });
    }
    async function consultar() {
      compras = []; notas = 0;
      if (!sel) return pintarCompras();
      const [a, n] = await Promise.all([
        sb.from('compra_articulos').select('id, cantidad, costo_unitario, descuento, costo_extra, costo_total, compras!inner(id, numero, serie, documento, fecha_documento, proveedor_id, proveedor_codigo, proveedor_nombre, moneda_id, tipo_cambio, valor_total, bonificaciones, estado, localidad_id)')
          .eq('producto_id', sel).eq('compras.localidad_id', ctx.sel.loc).eq('compras.estado', 'ACTIVA').gte('compras.fecha_documento', f.desde).lte('compras.fecha_documento', f.hasta),
        sb.from('nota_compra_lineas').select('total, notas_compra!inner(tipo, estado, fecha, moneda_id, tipo_cambio, localidad_id)').eq('producto_id', sel)
          .eq('notas_compra.localidad_id', ctx.sel.loc).eq('notas_compra.estado', 'OPERADA').eq('notas_compra.tipo', 'NOTA DE CRÉDITO').gte('notas_compra.fecha', f.desde).lte('notas_compra.fecha', f.hasta)
      ]);
      compras = (a.data || []).map((x) => {
        const c = x.compras, k = aBase(c);
        const total = Number(x.costo_total) * k;
        // Bonificación de la compra prorrateada por el peso del artículo en el total.
        const bruto = Number(c.valor_total) + Number(c.bonificaciones);
        const bonif = bruto > 0 ? Number(c.bonificaciones) * k * (Number(x.costo_total) / bruto) : 0;
        return { ...x, c, k, cant: Number(x.cantidad), total, unit: total / Number(x.cantidad), desc: Number(x.descuento) * k, bonif };
      }).sort((p, q) => q.c.fecha_documento.localeCompare(p.c.fecha_documento) || q.c.numero - p.c.numero);
      notas = (n.data || []).reduce((t, l) => t + Number(l.total) * (ctx.moneda(l.notas_compra.moneda_id)?.iso === 'GTQ' ? 1 : Number(l.notas_compra.tipo_cambio) || 1), 0);
      pintarCompras();
    }

    function pintar() {
      ctx.pDet.innerHTML = `
        <div class="bm-form kx-form cl-clasico">
          <div class="cl-banda kx-banda"><span>Análisis de costos</span><small>${esc(ctx.localidad(ctx.sel.loc)?.nombre_comercial || '')} · compras del ${esc(fmt.fechaDia(f.desde))} al ${esc(fmt.fechaDia(f.hasta))}</small></div>
          <section class="kx-cat">
            <div class="kx-cat-cab">
              <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Código, nombre o principio activo…" value="${esc(f.buscar)}" aria-label="Buscar producto"></label>
              <label class="pc-check kx-inact"><input type="checkbox" data-inactivos ${f.inactivos ? 'checked' : ''}> Incluir inactivos</label>
            </div>
            <div class="pc-lineas kx-productos"><table>
              <thead><tr><th class="num">Código</th><th>Nombre</th><th>Presentación</th><th>Clasificación</th><th>Unidad de med. compra</th><th>Principio activo / tipo</th><th class="num">Compras</th><th class="num">Costo promedio</th></tr></thead>
              <tbody data-productos>${filasProductos()}</tbody>
            </table></div>
          </section>
          <section class="ac-cuerpo" data-compras></section>
        </div>`;
    }
    function filasProductos() {
      return visibles().map((p) => { const r = resumen.get(p.id); return `<tr data-prod="${p.id}" class="${p.id === sel ? 'actual' : ''}" tabindex="0">
          <td class="num fuerte">${p.codigo}</td><td class="cx-nombre" title="${esc(p.nombre)}">${esc(p.nombre)}</td><td class="tk-tenue">${esc(p.presentaciones_producto?.nombre || '')}</td>
          <td class="tk-tenue">${esc(p.clasificaciones_producto?.nombre || '')}</td><td class="tk-tenue">${esc(p.tipos_medida?.nombre || '')}</td><td>${esc(p.principio_activo || p.tipos_producto?.nombre || '')}</td>
          <td class="num">${r ? r.n : ''}</td><td class="num ${r ? 'fuerte' : 'tk-tenue'}">${r ? fmt.monto(r.total / r.cant) : '—'}</td></tr>`; }).join('')
        || '<tr><td colspan="8" class="tk-vacio">Ningún producto coincide.</td></tr>';
    }
    function calculo() {
      const cant = compras.reduce((t, x) => t + x.cant, 0);
      const total = compras.reduce((t, x) => t + x.total, 0);
      const desc = compras.reduce((t, x) => t + x.desc, 0);
      const bonif = compras.reduce((t, x) => t + x.bonif, 0);
      const unit = compras.map((x) => x.unit);
      return { cant, total, desc, bonif, prom: cant ? total / cant : 0, neto: cant ? (total - bonif - notas) / cant : 0,
        ultimo: compras[0]?.unit || 0, min: unit.length ? Math.min(...unit) : 0, max: unit.length ? Math.max(...unit) : 0 };
    }
    function pintarCompras() {
      const caja = ctx.pDet.querySelector('[data-compras]');
      if (!caja) return;
      const p = prod(sel);
      const k = calculo();
      const cat = Number(p?.precio_costo || 0);
      const dif = cat && k.prom ? (k.prom - cat) / cat * 100 : null;
      // Barra entre el mínimo y el máximo: se ven las diferencias de precio entre compras.
      const barra = (v) => (k.max === k.min ? 100 : Math.round(25 + 75 * (v - k.min) / (k.max - k.min)));
      caja.innerHTML = `
        <div class="ac-compras">
          <div class="kx-resumen">${p ? `<b>${esc(p.codigo_producto || String(p.codigo))} · ${esc(p.nombre)}</b><span>${compras.length} compra(s)</span><span>Cantidad <b>${cant(k.cant)}</b></span><span>Comprado <b>Q ${fmt.monto(k.total)}</b></span>` : '<span class="tk-tenue">Elige un producto.</span>'}</div>
          <div class="pc-lineas kx-tabla"><table>
            <thead><tr><th class="num">Compra</th><th>Documento</th><th>Fecha docto.</th><th class="num">Prov.</th><th>Proveedor</th><th class="num">Cantidad</th><th class="num">Descuento</th><th class="num">Costo unitario</th><th class="ac-graf">Comparativo</th></tr></thead>
            <tbody>${compras.map((x) => `<tr><td class="num fuerte">${x.c.numero}</td><td>${esc([x.c.serie, x.c.documento].filter(Boolean).join('-'))}</td><td>${esc(fmt.fechaDia(x.c.fecha_documento))}</td><td class="num">${esc(x.c.proveedor_codigo || '')}</td>
              <td class="cx-nombre" title="${esc(x.c.proveedor_nombre || '')}">${esc(x.c.proveedor_nombre || '')}</td><td class="num">${cant(x.cant)}</td><td class="num tk-tenue">${x.desc ? fmt.monto(x.desc) : ''}</td>
              <td class="num fuerte ${x.unit === k.min && compras.length > 1 ? 'kx-ent' : x.unit === k.max && compras.length > 1 ? 'kx-sal' : ''}">${fmt.monto(x.unit)}</td>
              <td class="ac-graf"><span class="ac-barra" style="width:${barra(x.unit)}%"></span></td></tr>`).join('')
              || `<tr><td colspan="9" class="tk-vacio"><i class="ti ti-shopping-cart" aria-hidden="true"></i>${p ? 'El producto no tiene compras en el periodo.' : ''}</td></tr>`}</tbody>
            <tfoot><tr><td colspan="5" class="num">Promedio compras</td><td class="num">${cant(k.cant)}</td><td class="num">${fmt.monto(k.desc)}</td><td class="num">${fmt.monto(k.prom)}</td><td></td></tr></tfoot>
          </table></div>
        </div>
        <aside class="ac-lado">
          <div class="ac-dato"><span>Descuentos</span><b>${fmt.monto(k.desc)}</b></div>
          <div class="ac-dato"><span>Bonificaciones</span><b>${fmt.monto(k.bonif)}</b><small>de la compra, en proporción</small></div>
          <div class="ac-dato"><span>Notas crédito</span><b>${fmt.monto(notas)}</b><small>operadas en el periodo</small></div>
          <div class="ac-dato ac-prom"><span>Promedio compras</span><b>Q ${fmt.monto(k.prom)}</b></div>
          <div class="ac-dato"><span>Costo neto promedio</span><b>Q ${fmt.monto(k.neto)}</b><small>menos bonificaciones y notas</small></div>
          <div class="ac-mini"><div><span>Último</span><b>${fmt.monto(k.ultimo)}</b></div><div><span>Mínimo</span><b class="kx-ent">${fmt.monto(k.min)}</b></div><div><span>Máximo</span><b class="kx-sal">${fmt.monto(k.max)}</b></div></div>
          <div class="ac-dato"><span>Precio costo catálogo</span><b>${cat ? `Q ${fmt.monto(cat)}` : '—'}</b>${dif !== null ? `<small class="${Math.abs(dif) > 5 ? 'pc-rojo' : ''}">Promedio ${dif >= 0 ? '+' : ''}${dif.toFixed(1)} % vs. catálogo</small>` : ''}</div>
        </aside>`;
    }

    function imprimirCostos() {
      const p = prod(sel);
      if (!p) return window.FIN.aviso('Elige un producto');
      const k = calculo(), e = ctx.localidad(ctx.sel.loc);
      imprimir(`Análisis de costos ${p.nombre}`, `<h1>Análisis de costos · ${esc(p.codigo_producto || String(p.codigo))} · ${esc(p.nombre)}</h1><h2>${esc(e ? `${e.codigo} · ${e.nombre_comercial}` : '')} · compras del ${esc(fmt.fechaDia(f.desde))} al ${esc(fmt.fechaDia(f.hasta))}</h2>
        <div class="cab"><div><b>Clasificación</b>${esc(p.clasificaciones_producto?.nombre || '')}</div><div><b>Unidad de medida</b>${esc(p.tipos_medida?.nombre || '')}</div><div><b>Principio activo / tipo</b>${esc(p.principio_activo || p.tipos_producto?.nombre || '')}</div><div><b>Precio costo catálogo</b>Q ${fmt.monto(p.precio_costo)}</div>
          <div><b>Descuentos</b>Q ${fmt.monto(k.desc)}</div><div><b>Bonificaciones</b>Q ${fmt.monto(k.bonif)}</div><div><b>Notas crédito</b>Q ${fmt.monto(notas)}</div><div><b>Costo neto promedio</b>Q ${fmt.monto(k.neto)}</div></div>
        <table><thead><tr><th>Compra</th><th>Documento</th><th>Fecha</th><th>Prov.</th><th>Proveedor</th><th class="n">Cantidad</th><th class="n">Descuento</th><th class="n">Costo unitario</th></tr></thead>
        <tbody>${compras.map((x) => `<tr><td>${x.c.numero}</td><td>${esc([x.c.serie, x.c.documento].filter(Boolean).join('-'))}</td><td>${esc(fmt.fechaDia(x.c.fecha_documento))}</td><td>${esc(x.c.proveedor_codigo || '')}</td><td>${esc(x.c.proveedor_nombre || '')}</td><td class="n">${cant(x.cant)}</td><td class="n">${fmt.monto(x.desc)}</td><td class="n">${fmt.monto(x.unit)}</td></tr>`).join('') || '<tr><td colspan="8">Sin compras en el periodo.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="5">Promedio compras</td><td class="n">${cant(k.cant)}</td><td class="n">${fmt.monto(k.desc)}</td><td class="n">${fmt.monto(k.prom)}</td></tr></tfoot></table>`);
    }

    function elegir(id) {
      sel = id;
      ctx.pDet.querySelectorAll('tr[data-prod]').forEach((tr) => tr.classList.toggle('actual', Number(tr.dataset.prod) === id));
      consultar();
    }
    function refrescar() { const tb = ctx.pDet.querySelector('[data-productos]'); if (tb) tb.innerHTML = filasProductos(); }
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (cambio === 'otro') { f[e.target.name] = e.target.value; if (f.hasta < f.desde) { if (e.target.name === 'desde') f.hasta = f.desde; else f.desde = f.hasta; } pintarFiltros(); await consultarResumen(); pintar(); return consultar(); }
      if (e.target.matches('[data-inactivos]')) { f.inactivos = e.target.checked; refrescar(); }
    });
    cont.addEventListener('input', (e) => { if (e.target.matches('[data-buscar]')) { f.buscar = e.target.value; refrescar(); } });
    cont.addEventListener('click', (e) => {
      const fila = e.target.closest('tr[data-prod]');
      if (fila) return elegir(Number(fila.dataset.prod));
      if (e.target.closest('[data-accion=imprimir]')) return imprimirCostos();
    });
    cont.addEventListener('keydown', (e) => {
      const fila = e.target.closest?.('tr[data-prod]');
      if (fila && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); const v = visibles(); const i = v.findIndex((p) => p.id === Number(fila.dataset.prod)); const nx = v[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (nx) { elegir(nx.id); ctx.pDet.querySelector(`tr[data-prod="${nx.id}"]`)?.focus(); } }
      else if (fila && e.key === 'Enter') elegir(Number(fila.dataset.prod));
    });
    iniciar();
  };
})();
