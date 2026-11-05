// Compras · Mantenimientos · Kardex de Productos: los movimientos de inventario de un producto en una
// bodega (o en todas), con el saldo inicial, entradas, salidas, saldo acumulado, costo y el
// documento de origen (ingreso de la orden, compra, nota o consignación). Sin producto elegido
// muestra el resumen de los productos con existencia o movimiento en el periodo.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const ORIGEN = { INGRESO: 'Ingreso orden', COMPRA: 'Compra', NOTA: 'Nota', 'CONSIGNACIÓN': 'Consignación', AJUSTE: 'Ajuste', DESPACHO: 'Despacho', TRASLADO: 'Traslado' };
  const cant = (n) => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  window.PANTALLAS['kardex-productos'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Kardex de Productos', icono: 'ti-list-numbers', clase: 'bk-movimientos kx-kardex', grupo: 'Compras · Mantenimientos' });
    const { sb } = ctx;
    const [y] = fmt.hoy().split('-');
    const f = { producto: '', bodega: '', desde: `${y}-01-01`, hasta: fmt.hoy(), formato: 'PDF' };
    let productos = [], bodegas = [], movs = [], inicial = 0, resumen = [];
    const prod = (id) => productos.find((p) => p.id === id);
    const prodTxt = (p) => `${p.codigo_producto || p.codigo} · ${p.nombre}`;
    const prodDe = (t0) => { const t = String(t0 || '').trim().toUpperCase(); return t ? productos.find((p) => prodTxt(p).toUpperCase() === t) || productos.find((p) => (p.codigo_producto || '').toUpperCase() === t || (p.codigo_barras || '').toUpperCase() === t || String(p.codigo) === t) || null : null; };
    const bodega = (id) => bodegas.find((b) => b.id === id);

    function pintarFiltros() {
      const p = prodDe(f.producto);
      ctx.filtros(`
        <label class="campo kx-prod"><span>Producto</span><input list="kx-productos" name="producto" value="${esc(f.producto)}" placeholder="Todos: resumen de existencias"></label>
        <label class="campo"><span>Bodega</span><select name="bodega"><option value="">TODAS</option>${bodegas.map((b) => `<option value="${b.id}" ${String(b.id) === f.bodega ? 'selected' : ''}>${b.codigo} · ${esc(b.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha desde</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha hasta</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Formato</span><select name="formato"><option ${f.formato === 'PDF' ? 'selected' : ''}>PDF</option><option ${f.formato === 'EXCEL' ? 'selected' : ''}>EXCEL</option></select></label>
        <datalist id="kx-productos">${productos.map((x) => `<option value="${esc(prodTxt(x))}">${esc(x.codigo_barras || '')}</option>`).join('')}</datalist>
        ${f.producto && !p ? '<small class="cx-aviso pc-rojo">Producto no encontrado</small>' : ''}`,
        `${p ? '<button type="button" class="boton secundario-sm" data-accion="todos"><i class="ti ti-list" aria-hidden="true"></i> Resumen</button>' : ''}<button type="button" class="boton primario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>`);
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      const vacio = { data: [] };
      const [p, b] = await Promise.all([
        loc ? sb.from('productos').select('id, codigo, codigo_producto, codigo_barras, nombre, estado, minimo, maximo, tipo_medida_id, tipos_medida(nombre)').eq('localidad_id', loc).order('nombre') : vacio,
        loc ? sb.from('bodegas').select('id, codigo, nombre, estado').eq('localidad_id', loc).order('codigo') : vacio
      ]);
      productos = p.data || []; bodegas = b.data || [];
      pintarFiltros();
      await consultar();
    }
    async function consultar() {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-list-numbers'); return; }
      const p = prodDe(f.producto);
      if (!p) return consultarResumen();
      let ant = sb.from('inventario_movimientos').select('cantidad').eq('localidad_id', ctx.sel.loc).eq('producto_id', p.id).lt('fecha', f.desde);
      let q = sb.from('inventario_movimientos').select(`id, fecha, cantidad, costo_unitario, origen, lote, fecha_vencimiento, usuario, bodega_id, creado_en,
          ingreso_lineas(ingresos_compra(numero, ordenes_compra(numero))), compra_articulos(compras(numero, serie, documento, proveedor_nombre)),
          nota_compra_lineas(notas_compra(numero, tipo, serie, documento, proveedor_nombre)), consignacion_lineas(consignaciones(numero, tipo_documento, documento, proveedor_nombre))`)
        .eq('localidad_id', ctx.sel.loc).eq('producto_id', p.id).gte('fecha', f.desde).lte('fecha', f.hasta).order('fecha').order('id');
      if (f.bodega) { ant = ant.eq('bodega_id', Number(f.bodega)); q = q.eq('bodega_id', Number(f.bodega)); }
      const [a, m] = await Promise.all([ant, q]);
      if (m.error) { ctx.pDet.innerHTML = `<p class="vacio">${esc(m.error.message)}</p>`; return; }
      inicial = (a.data || []).reduce((t, x) => t + Number(x.cantidad), 0);
      let saldo = inicial;
      movs = (m.data || []).map((x) => {
        const c = Number(x.cantidad);
        saldo += c;
        const ing = x.ingreso_lineas?.ingresos_compra, com = x.compra_articulos?.compras, nota = x.nota_compra_lineas?.notas_compra, con = x.consignacion_lineas?.consignaciones;
        const doc = ing ? `Ingreso ${ing.numero}${ing.ordenes_compra ? ` · OC ${ing.ordenes_compra.numero}` : ''}`
          : com ? `Compra ${com.numero} · ${[com.serie, com.documento].filter(Boolean).join('-')}`
          : nota ? `${nota.tipo === 'NOTA DE CRÉDITO' ? 'N. crédito' : 'N. débito'} ${nota.numero} · ${[nota.serie, nota.documento].filter(Boolean).join('-')}`
          : con ? `Consig. ${con.numero} · ${con.tipo_documento}${con.documento ? ` ${con.documento}` : ''}` : '';
        const tercero = com?.proveedor_nombre || nota?.proveedor_nombre || con?.proveedor_nombre || '';
        return { ...x, c, entrada: c > 0 ? c : 0, salida: c < 0 ? -c : 0, saldo, costo: Number(x.costo_unitario), doc, tercero };
      });
      pintarKardex(p);
    }
    async function consultarResumen() {
      let q = sb.from('inventario_movimientos').select('producto_id, bodega_id, fecha, cantidad, costo_unitario').eq('localidad_id', ctx.sel.loc).lte('fecha', f.hasta);
      if (f.bodega) q = q.eq('bodega_id', Number(f.bodega));
      const { data, error } = await q.limit(50000);
      if (error) { ctx.pDet.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      const g = new Map();
      (data || []).forEach((x) => {
        const r = g.get(x.producto_id) || { producto_id: x.producto_id, inicial: 0, entradas: 0, salidas: 0, valorEnt: 0, ultimo: null };
        const c = Number(x.cantidad);
        if (x.fecha < f.desde) r.inicial += c; else if (c > 0) { r.entradas += c; r.valorEnt += c * Number(x.costo_unitario); } else r.salidas -= c;
        if (!r.ultimo || x.fecha > r.ultimo) r.ultimo = x.fecha;
        g.set(x.producto_id, r);
      });
      resumen = [...g.values()].map((r) => ({ ...r, saldo: r.inicial + r.entradas - r.salidas, p: prod(r.producto_id) })).filter((r) => r.p).sort((a, b) => a.p.nombre.localeCompare(b.p.nombre));
      pintarResumen();
    }

    function banda(txt) { return `<div class="cl-banda">${txt}</div>`; }
    function pintarResumen() {
      const t = resumen.reduce((s, r) => ({ i: s.i + r.inicial, e: s.e + r.entradas, s: s.s + r.salidas, f: s.f + r.saldo }), { i: 0, e: 0, s: 0, f: 0 });
      const bajo = resumen.filter((r) => r.p.minimo && r.saldo < Number(r.p.minimo)).length;
      ctx.pDet.innerHTML = `
        <div class="bm-form kx-form cl-clasico">
          ${banda(`Kardex de productos · resumen del ${esc(fmt.fechaDia(f.desde))} al ${esc(fmt.fechaDia(f.hasta))}${f.bodega ? ` · ${esc(bodega(Number(f.bodega))?.nombre || '')}` : ''}`)}
          <div class="kx-tarjetas">
            <div><span>Productos con movimiento</span><b>${resumen.length}</b></div><div><span>Unidades en existencia</span><b>${cant(t.f)}</b></div>
            <div><span>Entradas del periodo</span><b>${cant(t.e)}</b></div><div><span>Salidas del periodo</span><b>${cant(t.s)}</b></div>
            <div class="${bajo ? 'kx-alerta' : ''}"><span>Bajo el mínimo</span><b>${bajo}</b></div>
          </div>
          <div class="pc-lineas cx-tabla"><table>
            <thead><tr><th>Código</th><th>Producto</th><th>Medida</th><th class="num">Saldo inicial</th><th class="num">Entradas</th><th class="num">Salidas</th><th class="num">Existencia</th><th class="num">Mínimo</th><th>Último mov.</th></tr></thead>
            <tbody>${resumen.map((r) => `<tr data-prod="${r.producto_id}" tabindex="0" title="Ver el kardex del producto">
              <td class="fuerte">${esc(r.p.codigo_producto || String(r.p.codigo))}</td><td class="cx-nombre">${esc(r.p.nombre)}</td><td>${esc(r.p.tipos_medida?.nombre || '')}</td>
              <td class="num">${cant(r.inicial)}</td><td class="num">${cant(r.entradas)}</td><td class="num">${cant(r.salidas)}</td>
              <td class="num fuerte ${r.p.minimo && r.saldo < Number(r.p.minimo) ? 'pc-rojo' : ''}">${cant(r.saldo)}</td><td class="num tk-tenue">${r.p.minimo ? cant(r.p.minimo) : ''}</td><td>${esc(fmt.fechaDia(r.ultimo))}</td></tr>`).join('')
              || '<tr><td colspan="9" class="tk-vacio"><i class="ti ti-packages" aria-hidden="true"></i>Sin movimientos de inventario hasta la fecha final.</td></tr>'}</tbody>
            <tfoot><tr><td colspan="3">${resumen.length} producto(s) · elige uno para ver su kardex</td><td class="num">${cant(t.i)}</td><td class="num">${cant(t.e)}</td><td class="num">${cant(t.s)}</td><td class="num">${cant(t.f)}</td><td colspan="2"></td></tr></tfoot>
          </table></div>
        </div>`;
    }
    function pintarKardex(p) {
      const ent = movs.reduce((t, m) => t + m.entrada, 0), sal = movs.reduce((t, m) => t + m.salida, 0);
      const fin = inicial + ent - sal;
      const valEnt = movs.reduce((t, m) => t + m.entrada * m.costo, 0);
      const prom = ent ? valEnt / ent : (movs.length ? movs[movs.length - 1].costo : 0);
      const todas = !f.bodega;
      ctx.pDet.innerHTML = `
        <div class="bm-form kx-form cl-clasico">
          ${banda(`Kardex · ${esc(p.codigo_producto || String(p.codigo))} · ${esc(p.nombre)}`)}
          <div class="kx-tarjetas">
            <div><span>Saldo inicial al ${esc(fmt.fechaDia(f.desde))}</span><b>${cant(inicial)}</b></div><div><span>Entradas</span><b class="kx-ent">${cant(ent)}</b></div>
            <div><span>Salidas</span><b class="kx-sal">${cant(sal)}</b></div><div><span>Saldo al ${esc(fmt.fechaDia(f.hasta))}</span><b>${cant(fin)}</b></div>
            <div><span>Costo promedio de entradas</span><b>Q ${fmt.monto(prom)}</b></div><div><span>Valor del saldo</span><b>Q ${fmt.monto(fin * prom)}</b></div>
          </div>
          <div class="pc-lineas cx-tabla"><table>
            <thead><tr><th>Fecha</th><th>Origen</th><th>Documento</th><th>Proveedor</th>${todas ? '<th>Bodega</th>' : ''}<th>Lote</th><th class="num">Entrada</th><th class="num">Salida</th><th class="num">Saldo</th><th class="num">Costo unit.</th><th class="num">Valor</th><th>Usuario</th></tr></thead>
            <tbody><tr class="kx-ini"><td>${esc(fmt.fechaDia(f.desde))}</td><td colspan="${todas ? 5 : 4}">Saldo inicial</td><td></td><td></td><td class="num fuerte">${cant(inicial)}</td><td colspan="3"></td></tr>
              ${movs.map((m) => `<tr><td>${esc(fmt.fechaDia(m.fecha))}</td><td><span class="kx-origen kx-${m.c > 0 ? 'e' : 's'}">${esc(ORIGEN[m.origen] || m.origen)}</span></td><td>${esc(m.doc)}</td><td class="cx-nombre" title="${esc(m.tercero)}">${esc(m.tercero)}</td>
                ${todas ? `<td>${esc(bodega(m.bodega_id)?.nombre || '')}</td>` : ''}<td>${esc(m.lote || '')}</td>
                <td class="num">${m.entrada ? cant(m.entrada) : ''}</td><td class="num pc-rojo">${m.salida ? cant(m.salida) : ''}</td><td class="num fuerte">${cant(m.saldo)}</td>
                <td class="num">${fmt.monto(m.costo)}</td><td class="num">${fmt.monto(m.c * m.costo)}</td><td>${esc(m.usuario || '')}</td></tr>`).join('')
              || `<tr><td colspan="${todas ? 12 : 11}" class="tk-vacio">Sin movimientos en el periodo.</td></tr>`}</tbody>
            <tfoot><tr><td colspan="${todas ? 6 : 5}">${movs.length} movimiento(s)</td><td class="num">${cant(ent)}</td><td class="num">${cant(sal)}</td><td class="num">${cant(fin)}</td><td colspan="3"></td></tr></tfoot>
          </table></div>
        </div>`;
    }

    function imprimirKardex() {
      const p = prodDe(f.producto);
      const e = ctx.localidad(ctx.sel.loc);
      const per = `del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)} · ${f.bodega ? bodega(Number(f.bodega))?.nombre : 'todas las bodegas'}`;
      if (!p) {
        if (!resumen.length) return window.FIN.aviso('No hay movimientos para imprimir');
        if (f.formato === 'EXCEL') return window.COMPRAS_CAT.descargarCsv(`kardex_resumen_${f.hasta}.csv`, [['Código', 'Producto', 'Saldo inicial', 'Entradas', 'Salidas', 'Existencia', 'Mínimo', 'Último movimiento'], ...resumen.map((r) => [r.p.codigo_producto || r.p.codigo, r.p.nombre, r.inicial, r.entradas, r.salidas, r.saldo, r.p.minimo || '', fmt.fechaDia(r.ultimo)])]);
        return imprimir('Kardex · resumen', `<h1>Kardex de productos · resumen</h1><h2>${esc(e ? `${e.codigo} · ${e.nombre_comercial}` : '')} · ${esc(per)}</h2>
          <table><thead><tr><th>Código</th><th>Producto</th><th class="n">Inicial</th><th class="n">Entradas</th><th class="n">Salidas</th><th class="n">Existencia</th><th>Último mov.</th></tr></thead>
          <tbody>${resumen.map((r) => `<tr><td>${esc(r.p.codigo_producto || String(r.p.codigo))}</td><td>${esc(r.p.nombre)}</td><td class="n">${cant(r.inicial)}</td><td class="n">${cant(r.entradas)}</td><td class="n">${cant(r.salidas)}</td><td class="n">${cant(r.saldo)}</td><td>${esc(fmt.fechaDia(r.ultimo))}</td></tr>`).join('')}</tbody></table>`);
      }
      if (f.formato === 'EXCEL') return window.COMPRAS_CAT.descargarCsv(`kardex_${p.codigo_producto || p.codigo}_${f.hasta}.csv`, [['Fecha', 'Origen', 'Documento', 'Proveedor', 'Bodega', 'Lote', 'Entrada', 'Salida', 'Saldo', 'Costo unitario', 'Valor', 'Usuario'], ['', 'SALDO INICIAL', '', '', '', '', '', '', inicial, '', '', ''], ...movs.map((m) => [fmt.fechaDia(m.fecha), ORIGEN[m.origen] || m.origen, m.doc, m.tercero, bodega(m.bodega_id)?.nombre || '', m.lote || '', m.entrada || '', m.salida || '', m.saldo, m.costo.toFixed(4), (m.c * m.costo).toFixed(2), m.usuario || ''])]);
      imprimir(`Kardex ${p.nombre}`, `<h1>Kardex · ${esc(p.codigo_producto || String(p.codigo))} · ${esc(p.nombre)}</h1><h2>${esc(e ? `${e.codigo} · ${e.nombre_comercial}` : '')} · ${esc(per)}</h2>
        <table><thead><tr><th>Fecha</th><th>Origen</th><th>Documento</th><th>Bodega</th><th>Lote</th><th class="n">Entrada</th><th class="n">Salida</th><th class="n">Saldo</th><th class="n">Costo</th><th class="n">Valor</th></tr></thead>
        <tbody><tr class="s"><td>${esc(fmt.fechaDia(f.desde))}</td><td colspan="6">Saldo inicial</td><td class="n">${cant(inicial)}</td><td colspan="2"></td></tr>${movs.map((m) => `<tr><td>${esc(fmt.fechaDia(m.fecha))}</td><td>${esc(ORIGEN[m.origen] || m.origen)}</td><td>${esc(m.doc)}</td><td>${esc(bodega(m.bodega_id)?.nombre || '')}</td><td>${esc(m.lote || '')}</td><td class="n">${m.entrada ? cant(m.entrada) : ''}</td><td class="n">${m.salida ? cant(m.salida) : ''}</td><td class="n">${cant(m.saldo)}</td><td class="n">${fmt.monto(m.costo)}</td><td class="n">${fmt.monto(m.c * m.costo)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="5">Totales</td><td class="n">${cant(movs.reduce((t, m) => t + m.entrada, 0))}</td><td class="n">${cant(movs.reduce((t, m) => t + m.salida, 0))}</td><td class="n">${cant(movs.length ? movs[movs.length - 1].saldo : inicial)}</td><td colspan="2"></td></tr></tfoot></table>`);
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { f.producto = ''; f.bodega = ''; return cargarLocalidad(); }
      if (cambio !== 'otro') return;
      f[e.target.name] = e.target.value;
      if (f.hasta < f.desde) { if (e.target.name === 'desde') f.hasta = f.desde; else f.desde = f.hasta; }
      pintarFiltros();
      if (e.target.name !== 'formato') consultar();
    });
    cont.addEventListener('click', (e) => {
      const fila = e.target.closest('tr[data-prod]');
      if (fila) { const p = prod(Number(fila.dataset.prod)); f.producto = prodTxt(p); pintarFiltros(); return consultar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'todos') { f.producto = ''; pintarFiltros(); return consultar(); }
      if (a === 'imprimir') return imprimirKardex();
    });
    cont.addEventListener('keydown', (e) => { const fila = e.target.closest?.('tr[data-prod]'); if (fila && e.key === 'Enter') fila.click(); });
    iniciar();
  };
})();
