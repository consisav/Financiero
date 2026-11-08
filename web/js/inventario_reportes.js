// Inventarios · Reportes: Existencias, Kardex por producto, Valuación de inventario y Rotación.
// Parámetros comunes: organización, localidad, fecha de corte (hoy por defecto) y un producto o todos.
// Todo se calcula de los movimientos de inventario hasta la fecha de corte; el costo es el promedio ponderado
// perpetuo de la empresa (los traslados entre bodegas y los cambios de lote no lo mueven). Vista previa en
// pantalla y salida en PDF o Excel con el mismo contenido.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const NEUTROS = new Set([3, 4, 9, 10, 40, 41, 43, 44, 45, 46]);
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const r4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;
  const cant = (n) => Number(n || 0).toLocaleString('es-GT', { maximumFractionDigits: 4 });
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const MAX_VISTA = 1500;
  const G = () => window.GRAFICAS;
  const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const top = (xs, n = 10) => [...xs].sort((a, b) => b.valor - a.valor).slice(0, n);

  function tipoDe(m) {
    if (m.tipos_movimiento_inventario?.descripcion) return m.tipos_movimiento_inventario.descripcion;
    const c = Number(m.cantidad), dt = m.documento_inventario_lineas?.documentos_inventario?.tipo;
    switch (m.origen) {
      case 'INGRESO': return 'INGRESO - ORDEN DE COMPRA';
      case 'COMPRA': return 'INGRESO - COMPRA';
      case 'VENTA': case 'DESPACHO': return 'SALIDA - FACTURA';
      case 'NOTA': return c < 0 ? 'SALIDA - NOTA DE CRÉDITO' : 'INGRESO - NOTA';
      case 'CONSIGNACIÓN': return c > 0 ? 'INGRESO - CONSIGNACIÓN' : 'SALIDA - DEVOLUCIÓN CONSIGNACIÓN';
      case 'TRASLADO': return c > 0 ? 'INGRESO - TRASLADO' : 'SALIDA - TRASLADO';
    }
    if (dt === 'DEVOLUCIÓN') return c > 0 ? 'INGRESO - REINGRESO' : 'SALIDA - DEVOLUCIÓN';
    if (dt === 'AJUSTE LOTE') return c > 0 ? 'INGRESO - AJUSTE DE LOTE' : 'SALIDA - AJUSTE DE LOTE';
    return c > 0 ? 'INGRESO - AJUSTE' : 'SALIDA - AJUSTE';
  }
  function documentoDe(m) {
    const com = m.compra_articulos?.compras, fv = m.factura_venta_lineas?.facturas_venta, nv = m.nota_venta_lineas?.notas_venta, di = m.documento_inventario_lineas?.documentos_inventario;
    if (com) return [com.serie, com.documento].filter(Boolean).join('-') || String(com.numero ?? '');
    if (fv || nv) return [(fv || nv).serie, (fv || nv).numero_dte].filter(Boolean).join('-') || String((fv || nv).numero ?? '');
    if (di) return `${di.tipo} ${di.numero}`;
    return m.documento_fisico || (m.no_doc_anterior != null ? String(m.no_doc_anterior) : '');
  }
  const neutro = (m) => m.origen === 'TRASLADO' || NEUTROS.has(m.tipo_movimiento) || m.documento_inventario_lineas?.documentos_inventario?.tipo === 'AJUSTE LOTE';

  const REPORTES = {
    'existencias-inventario': { titulo: 'Existencias', icono: 'ti-packages', archivo: 'existencias' },
    'kardex-por-producto': { titulo: 'Kardex por producto', icono: 'ti-list-details', archivo: 'kardex', detalle: true },
    'valuacion-de-inventario': { titulo: 'Valuación de inventario', icono: 'ti-report-money', archivo: 'valuacion_inventario' },
    'rotacion-de-inventario': { titulo: 'Rotación de inventario', icono: 'ti-refresh', archivo: 'rotacion_inventario' }
  };

  function reporte(cont, id) {
    const R = REPORTES[id];
    const ctx = montar(cont, { titulo: R.titulo, icono: R.icono, clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Inventarios · Reportes' });
    const { sb } = ctx;
    const f = { fecha: fmt.hoy(), producto: '', ceros: false, graficas: true };
    let productos = [], bodegas = new Map(), movs = [], cargado = '', cfg = null;
    const prod = (pid) => productos.find((p) => p.id === pid);
    const etiqueta = (p) => `${p.nombre} — ${p.codigo_producto || p.codigo}`;
    const empresa = () => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
    const anio = () => f.fecha.slice(0, 4);
    const inicio = () => `${anio()}-01-01`;

    function pintarFiltros() {
      const p = f.producto ? prod(Number(f.producto)) : null;
      ctx.filtros(`<label class="campo"><span>A la fecha</span><input type="date" name="fecha" value="${f.fecha}" max="${fmt.hoy()}"></label>
        <label class="campo cx-prov pr-prod"><span>Producto</span><input name="producto" list="rp-prods" value="${esc(p ? etiqueta(p) : '')}" placeholder="Todos los productos" autocomplete="off"></label>
        ${id === 'existencias-inventario' ? `<label class="pc-check"><input type="checkbox" name="ceros" ${f.ceros ? 'checked' : ''}> Incluir en cero</label>` : ''}
        <label class="pc-check"><input type="checkbox" name="graficas" ${f.graficas ? 'checked' : ''}> Gráficas</label>
        <datalist id="rp-prods">${productos.map((x) => `<option value="${esc(etiqueta(x))}"></option>`).join('')}</datalist>`,
        `<button type="button" class="boton secundario-sm" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button>
         <button type="button" class="boton secundario-sm" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>`);
    }
    async function leerTodo(hacer) {
      const out = [];
      for (let i = 0; ; i += 1000) { const { data, error } = await hacer().range(i, i + 999); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; }
      return out;
    }
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargarLocalidad(); }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc; f.producto = ''; cargado = '';
      if (!loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', R.icono); return; }
      const [p, b] = await Promise.all([leerTodo(() => sb.from('productos').select('id, codigo, codigo_producto, nombre, precio_costo').eq('localidad_id', loc).order('nombre')),
        sb.from('bodegas').select('id, codigo, nombre').eq('localidad_id', loc)]);
      productos = p; bodegas = new Map((b.data || []).map((x) => [x.id, x]));
      pintarFiltros(); await consultar();
    }
    async function consultar() {
      const clave = `${ctx.sel.loc}|${f.fecha}|${f.producto}`;
      if (clave !== cargado) {
        ctx.pDet.innerHTML = '<p class="vacio">Leyendo los movimientos de inventario…</p>';
        try {
          movs = await leerTodo(() => {
            let q = sb.from('inventario_movimientos').select(`id, producto_id, bodega_id, fecha, cantidad, costo_unitario, origen, tipo_movimiento, lote, fecha_vencimiento${R.detalle ? `, documento_fisico, no_doc_anterior, observaciones, tipos_movimiento_inventario(descripcion),
              compra_articulos(compras(numero, serie, documento)), factura_venta_lineas(facturas_venta(numero, serie, numero_dte)), nota_venta_lineas(notas_venta(numero, serie, numero_dte))` : ''}, documento_inventario_lineas(documentos_inventario(numero, tipo))`)
              .eq('localidad_id', ctx.sel.loc).lte('fecha', f.fecha).order('fecha').order('id');
            if (f.producto) q = q.eq('producto_id', Number(f.producto));
            return q;
          });
          cargado = clave;
        } catch (e) { ctx.pDet.innerHTML = `<p class="vacio">${esc(window.UI.traducirError(e))}</p>`; return; }
      }
      cfg = construir(); pintar();
    }
    // Recorre los movimientos de cada producto en orden: existencia, costo promedio y lo que pida cada reporte.
    function recorrer(alMov) {
      const est = new Map();
      movs.forEach((m) => {
        let a = est.get(m.producto_id);
        if (!a) { a = { q: 0, v: 0, prom: Number(prod(m.producto_id)?.precio_costo) || 0, ubic: new Map(), ini: null, ent: 0, sal: 0, costoSal: 0, ultSal: null }; est.set(m.producto_id, a); }
        if (a.ini === null && m.fecha >= inicio()) a.ini = { q: a.q, v: a.q * a.prom };
        const c = Number(m.cantidad), cu = Number(m.costo_unitario) || 0, n = neutro(m);
        const costo = c > 0 && !n && cu > 0 ? cu : a.prom;
        if (c > 0) { if (!n) { a.v = Math.max(a.q, 0) * a.prom + c * costo; a.q += c; a.prom = a.q > 0 ? a.v / a.q : costo; } else a.q += c; }
        else a.q += c;
        a.v = a.q * a.prom;
        const k = `${m.bodega_id}|${m.lote || ''}`; const u = a.ubic.get(k) || { bodega: m.bodega_id, lote: m.lote || '', vence: m.fecha_vencimiento, q: 0 };
        u.q += c; if (m.fecha_vencimiento) u.vence = m.fecha_vencimiento; a.ubic.set(k, u);
        if (m.fecha >= inicio() && !n) { if (c > 0) a.ent += c; else if (c < 0) { a.sal -= c; a.costoSal -= c * a.prom; a.ultSal = m.fecha; } }
        if (alMov) alMov(m, a, c, costo, n);
      });
      est.forEach((a) => { if (a.ini === null) a.ini = { q: a.q, v: a.q * a.prom }; });
      return est;
    }
    const nombreProd = (pid) => prod(pid)?.nombre || `Producto ${pid}`;
    const ordenNombre = (a, b) => nombreProd(a).localeCompare(nombreProd(b));
    const parametros = (extra = []) => [`Empresa: ${empresa()}`, `${R.detalle || id === 'rotacion-de-inventario' ? `Del ${fmt.fechaDia(inicio())} al` : 'A la fecha:'} ${fmt.fechaDia(f.fecha)}`,
      `Producto: ${f.producto ? etiqueta(prod(Number(f.producto))) : 'Todos'}`, ...extra];

    function construir() {
      const base = { titulo: R.titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: R.titulo.slice(0, 30), archivo: `${R.archivo}_${f.fecha}` };
      if (id === 'existencias-inventario') {
        const est = recorrer(); const g = new Map();
        est.forEach((a, pid) => a.ubic.forEach((u) => { if (!f.ceros && Math.abs(u.q) < 0.00005) return; const l = g.get(u.bodega) || []; l.push({ pid, ...u }); g.set(u.bodega, l); }));
        const filas = []; let tot = 0, n = 0;
        [...g.entries()].sort((a, b) => (bodegas.get(a[0])?.codigo || 0) - (bodegas.get(b[0])?.codigo || 0)).forEach(([bid, xs]) => {
          const b = bodegas.get(bid); filas.push({ valores: [`Bodega ${b ? `${b.codigo} · ${b.nombre}` : bid}`], tipo: 'grupo', combinar: true });
          xs.sort((a, b2) => ordenNombre(a.pid, b2.pid) || a.lote.localeCompare(b2.lote)).forEach((x) => { const p = prod(x.pid);
            filas.push({ valores: [p?.codigo_producto || String(p?.codigo ?? ''), nombreProd(x.pid), x.lote, fmt.fechaDia(x.vence), r4(x.q)], resaltar: x.q < 0 }); });
          const s = xs.reduce((t, x) => t + x.q, 0); tot += s; n += xs.length;
          filas.push({ valores: [`Subtotal bodega (${xs.length})`, '', '', '', r4(s)], tipo: 'subtotal' });
        });
        filas.push({ valores: [`Total general (${n})`, '', '', '', r4(tot)], tipo: 'total' });
        const porProd = new Map(); [...g.values()].flat().forEach((x) => porProd.set(x.pid, (porProd.get(x.pid) || 0) + x.q));
        const graficas = [G().barras('Existencia por bodega', [...g.entries()].map(([bid, xs]) => ({ etiqueta: bodegas.get(bid) ? `${bodegas.get(bid).codigo} · ${bodegas.get(bid).nombre}` : String(bid), valor: xs.reduce((t, x) => t + x.q, 0) })).sort((a, b) => b.valor - a.valor)),
          ...(f.producto ? [] : [G().barras('Productos con mayor existencia (10)', top([...porProd].map(([pid, q]) => ({ etiqueta: nombreProd(pid), valor: q }))))])];
        return { ...base, parametros: parametros([f.ceros ? 'Incluye existencias en cero' : 'Solo con existencia']), filas, n, graficas,
          columnas: [col('Código', 'texto', 13), col('Producto', 'texto', 48), col('Lote', 'texto', 14), col('Vence', 'texto', 11), col('Existencia', 'numero', 13)],
          kpis: [['Productos', new Set([...g.values()].flat().map((x) => x.pid)).size], ['Bodegas', g.size], ['Líneas (producto · lote)', n], ['Existencia total', cant(tot)]] };
      }
      if (id === 'kardex-por-producto') {
        const lin = new Map();
        const est = recorrer((m, a, c, costo) => { if (m.fecha < inicio()) return; const l = lin.get(m.producto_id) || []; l.push({ m, c, costo, q: a.q, prom: a.prom, v: a.v }); lin.set(m.producto_id, l); });
        const filas = []; let n = 0;
        [...est.keys()].filter((pid) => lin.has(pid) || Math.abs(est.get(pid).ini.q) > 0.00005).sort(ordenNombre).forEach((pid) => {
          const a = est.get(pid), p = prod(pid), xs = lin.get(pid) || [];
          filas.push({ valores: [`${p?.codigo_producto || p?.codigo || ''} · ${nombreProd(pid)}`], tipo: 'grupo', combinar: true });
          filas.push({ valores: [fmt.fechaDia(inicio()), 'SALDO INICIAL', '', '', '', '', '', r4(a.ini.q), a.ini.q ? r4(a.ini.v / a.ini.q) : '', r2(a.ini.v)], tipo: 'nota' });
          let e = 0, s = 0;
          xs.forEach((x) => { n++; if (x.c > 0) e += x.c; else s -= x.c;
            filas.push({ valores: [fmt.fechaDia(x.m.fecha), tipoDe(x.m), documentoDe(x.m), bodegas.get(x.m.bodega_id)?.codigo ?? '', x.m.lote || '', x.c > 0 ? r4(x.c) : '', x.c < 0 ? r4(-x.c) : '', r4(x.q), r4(x.c > 0 ? x.costo : x.prom), r2(x.v)] }); });
          filas.push({ valores: [`Totales (${xs.length} movimiento(s))`, '', '', '', '', r4(e), r4(s), r4(a.q), r4(a.prom), r2(a.v)], tipo: 'subtotal' });
        });
        const me = Array(12).fill(0), ms = Array(12).fill(0); const hasta = Number(f.fecha.slice(5, 7));
        lin.forEach((xs) => xs.forEach((x) => { const k = Number(x.m.fecha.slice(5, 7)) - 1; if (x.c > 0) me[k] += x.c; else ms[k] -= x.c; }));
        const graficas = [G().columnas('Entradas y salidas por mes (unidades)', MES.slice(0, hasta), [{ nombre: 'Entradas', color: G().COLORES.VERDE, valores: me.slice(0, hasta) }, { nombre: 'Salidas', color: G().COLORES.NARANJA, valores: ms.slice(0, hasta) }])];
        if (f.producto) { const xs = lin.get(Number(f.producto)) || []; const a = est.get(Number(f.producto));
          if (a) graficas.push(G().linea('Saldo del producto (unidades)', [{ x: fmt.fechaDia(inicio()), y: a.ini.q }, ...xs.map((x) => ({ x: fmt.fechaDia(x.m.fecha), y: x.q }))])); }
        return { ...base, parametros: parametros(['Costo: promedio ponderado']), filas, n, graficas,
          columnas: [col('Fecha', 'texto', 11), col('Tipo de movimiento', 'texto', 30), col('Documento', 'texto', 18), col('Bodega', 'texto', 8), col('Lote', 'texto', 13), col('Entrada', 'numero', 11), col('Salida', 'numero', 11), col('Saldo', 'numero', 12), col('Costo unitario', 'monto', 13), col('Valor saldo', 'monto', 15)],
          kpis: [['Productos', [...lin.keys()].length], ['Movimientos del período', n]] };
      }
      if (id === 'valuacion-de-inventario') {
        const est = recorrer();
        const xs = [...est.entries()].filter(([, a]) => a.q > 0.00005).sort((a, b) => ordenNombre(a[0], b[0]));
        const tot = xs.reduce((t, [, a]) => t + a.q * a.prom, 0);
        const filas = xs.map(([pid, a]) => { const p = prod(pid); return { valores: [p?.codigo_producto || String(p?.codigo ?? ''), nombreProd(pid), r4(a.q), r4(a.prom), r2(a.q * a.prom), tot ? (a.q * a.prom) / tot : 0] }; });
        filas.push({ valores: [`Total del inventario (${xs.length} producto(s))`, '', r4(xs.reduce((t, [, a]) => t + a.q, 0)), '', r2(tot), tot ? 1 : 0], tipo: 'total' });
        const neg = [...est.values()].filter((a) => a.q < -0.00005).length;
        // Clasificación ABC: A hasta el 80 % del valor, B hasta el 95 %, C el resto.
        const abc = { A: [0, 0], B: [0, 0], C: [0, 0] }; let acum = 0;
        [...xs].sort((a, b) => b[1].q * b[1].prom - a[1].q * a[1].prom).forEach(([, a]) => { const v = a.q * a.prom; const k = acum / (tot || 1) < 0.8 ? 'A' : acum / (tot || 1) < 0.95 ? 'B' : 'C'; acum += v; abc[k][0]++; abc[k][1] += v; });
        const graficas = [G().barras('Productos de mayor valor (10)', top(xs.map(([pid, a]) => ({ etiqueta: nombreProd(pid), valor: a.q * a.prom }))).map((i) => ({ ...i, texto: `Q ${fmt.monto(i.valor)} · ${tot ? ((i.valor / tot) * 100).toFixed(1) : 0} %` }))),
          G().barras('Clasificación ABC del valor del inventario', Object.entries(abc).map(([k, [n2, v]]) => ({ etiqueta: `${k} · ${n2} producto(s)`, valor: v, texto: `Q ${fmt.monto(v)} · ${tot ? ((v / tot) * 100).toFixed(1) : 0} %` })))];
        return { ...base, parametros: parametros(['Método: costo promedio ponderado (Decreto 10-2012, art. 55)']), filas, n: xs.length, graficas,
          columnas: [col('Código', 'texto', 13), col('Producto', 'texto', 48), col('Existencia', 'numero', 13), col('Costo promedio', 'monto', 14), col('Valor Q', 'monto', 16), col('% del total', 'porcentaje', 10)],
          kpis: [['Productos con existencia', xs.length], ['Valor del inventario', `Q ${fmt.monto(tot)}`, 'ec-fin'], ...(neg ? [['Con existencia negativa (no valuados)', neg, 'ec-alerta']] : [])] };
      }
      // Rotación: del 1 de enero a la fecha de corte.
      const est = recorrer();
      const dias = Math.round((new Date(`${f.fecha}T00:00:00`) - new Date(`${inicio()}T00:00:00`)) / 864e5) + 1;
      const xs = [...est.entries()].filter(([, a]) => a.ini.q > 0.00005 || a.q > 0.00005 || a.sal > 0).map(([pid, a]) => {
        const vf = Math.max(a.q, 0) * a.prom, vi = Math.max(a.ini.v, 0), vp = (vi + vf) / 2;
        const rot = vp > 0 ? a.costoSal / vp : (a.costoSal > 0 ? null : 0);
        const d = rot ? dias / rot : null;
        const clase = !a.sal ? 'SIN MOVIMIENTO' : d === null ? 'ALTA' : d <= 30 ? 'ALTA' : d <= 90 ? 'MEDIA' : 'BAJA';
        return { pid, a, vi, vf, vp, rot, d, clase };
      }).sort((x, y) => (y.rot ?? 1e9) - (x.rot ?? 1e9) || ordenNombre(x.pid, y.pid));
      const filas = xs.map((x) => { const p = prod(x.pid); return { valores: [p?.codigo_producto || String(p?.codigo ?? ''), nombreProd(x.pid), r4(x.a.ini.q), r4(x.a.ent), r4(x.a.sal), r4(x.a.q), r2(x.a.costoSal), r2(x.vp), x.rot === null ? '' : r2(x.rot), x.d === null ? '' : Math.round(x.d), x.clase, fmt.fechaDia(x.a.ultSal)], resaltar: x.clase === 'SIN MOVIMIENTO' || x.clase === 'BAJA' }; });
      const cs = xs.reduce((t, x) => t + x.a.costoSal, 0), vp = xs.reduce((t, x) => t + x.vp, 0), rg = vp ? cs / vp : 0;
      filas.push({ valores: [`Total (${xs.length} producto(s))`, '', '', '', '', '', r2(cs), r2(vp), r2(rg), rg ? Math.round(dias / rg) : '', '', ''], tipo: 'total' });
      const cuenta = (c) => xs.filter((x) => x.clase === c).length;
      const graficas = [G().barras('Productos por clasificación de rotación', ['ALTA', 'MEDIA', 'BAJA', 'SIN MOVIMIENTO'].map((c) => ({ etiqueta: c, valor: cuenta(c) }))),
        G().barras('Productos de mayor rotación (10)', top(xs.filter((x) => x.rot).map((x) => ({ etiqueta: nombreProd(x.pid), valor: x.rot, texto: `${r2(x.rot)} veces · ${Math.round(x.d)} días` })))),
        G().barras('Valor inmovilizado: sin movimiento o rotación baja (10)', top(xs.filter((x) => x.clase === 'SIN MOVIMIENTO' || x.clase === 'BAJA').map((x) => ({ etiqueta: nombreProd(x.pid), valor: x.vf, texto: `Q ${fmt.monto(x.vf)}` }))), G().COLORES.NARANJA)];
      return { ...base, graficas, parametros: parametros([`Período: ${dias} día(s)`, 'Rotación = costo de salidas / inventario promedio', 'Alta ≤ 30 días · Media ≤ 90 · Baja > 90']), filas, n: xs.length,
        columnas: [col('Código', 'texto', 12), col('Producto', 'texto', 40), col('Inv. inicial', 'numero', 11), col('Entradas', 'numero', 11), col('Salidas', 'numero', 11), col('Inv. final', 'numero', 11), col('Costo salidas', 'monto', 14), col('Inv. promedio', 'monto', 14), col('Rotación', 'numero', 9), col('Días inv.', 'entero', 9), col('Clasificación', 'texto', 15), col('Última salida', 'texto', 12)],
        kpis: [['Rotación general', `${r2(rg)} veces`, 'ec-fin'], ['Días de inventario', rg ? Math.round(dias / rg) : '—'], ['Alta', cuenta('ALTA')], ['Media', cuenta('MEDIA')], ['Baja', cuenta('BAJA'), cuenta('BAJA') ? 'ec-alerta' : ''], ['Sin movimiento', cuenta('SIN MOVIMIENTO'), cuenta('SIN MOVIMIENTO') ? 'ec-alerta' : '']] };
    }

    function celda(v, c) {
      if (v === '' || v == null) return '<td></td>';
      if (typeof v === 'number') return `<td class="num">${c.tipo === 'monto' ? fmt.monto(v) : c.tipo === 'porcentaje' ? `${(v * 100).toFixed(1)} %` : c.tipo === 'entero' ? v.toLocaleString('es-GT') : cant(v)}</td>`;
      return `<td>${esc(String(v))}</td>`;
    }
    const graficasDe = (c) => (c.graficas || []).filter(Boolean);
    function pintar() {
      const c = cfg, n = c.columnas.length;
      const vista = c.filas.slice(0, MAX_VISTA);
      ctx.pDet.innerHTML = `
        <div class="bm-form cx-form cl-clasico">
          <div class="cl-banda">${esc(R.titulo)} · ${esc(c.parametros.slice(0, 3).join(' · '))}</div>
          <div class="ec-kpis">${c.kpis.map(([t, v, cls]) => kpi(t, v, cls)).join('')}</div>
          <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table>
            <thead><tr>${c.columnas.map((x) => `<th class="${x.tipo === 'texto' ? '' : 'num'}">${esc(x.titulo)}</th>`).join('')}</tr></thead>
            <tbody>${vista.map((r) => (r.tipo === 'grupo' ? `<tr class="pr-g"><td colspan="${n}">${esc(r.valores[0])}</td></tr>`
              : `<tr class="${r.tipo === 'subtotal' ? 'pr-s' : r.tipo === 'total' ? 'pr-t' : r.tipo === 'nota' ? 'pr-n' : ''}${r.resaltar ? ' pr-alerta' : ''}">${c.columnas.map((x, i) => celda(r.valores[i], x)).join('')}</tr>`)).join('')
              || `<tr><td colspan="${n}" class="tk-vacio">No hay información con esos parámetros.</td></tr>`}
              ${c.filas.length > MAX_VISTA ? `<tr><td colspan="${n}" class="tk-vacio">Vista previa de ${MAX_VISTA} de ${c.filas.length} renglones: el PDF y el Excel llevan el reporte completo.</td></tr>` : ''}</tbody>
          </table>${f.graficas && graficasDe(c).length ? `<section class="pr-graficas"><h3><i class="ti ti-chart-bar" aria-hidden="true"></i> Gráficas</h3>${graficasDe(c).join('')}</section>` : ''}</div>
        </div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    function exportar(formato) {
      if (!cfg || cfg.n === 0) return window.FIN.aviso('No hay información con esos parámetros');
      const salida = { ...cfg, filas: cfg.filas.map((r) => (r.tipo === 'nota' ? { ...r, tipo: undefined, tenue: true } : r)) };
      const gs = f.graficas ? graficasDe(cfg) : [];
      if (formato === 'PDF') return window.CUENTAS_XLSX.pdf({ ...salida, graficas: gs.join('') });
      Promise.all(gs.map((g) => G().png(g))).then((imagenes) => window.REPORTE_XLSX.generar({ ...salida, imagenes }))
        .catch((e) => window.FIN.aviso(e.message || 'No se pudo generar el Excel'));
    }
    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      const n = e.target.name;
      if (n === 'fecha') { f.fecha = e.target.value || fmt.hoy(); return consultar(); }
      if (n === 'graficas') { f.graficas = e.target.checked; return pintar(); }
      if (n === 'ceros') { f.ceros = e.target.checked; cfg = construir(); return pintar(); }
      if (n === 'producto') {
        const t = e.target.value.trim().toUpperCase();
        const p = t ? productos.find((x) => etiqueta(x).toUpperCase() === t || (x.codigo_producto || '').toUpperCase() === t || String(x.codigo) === t) : null;
        if (t && !p) { window.FIN.aviso('Ese producto no está en el catálogo'); e.target.value = ''; }
        f.producto = p ? String(p.id) : ''; if (p) e.target.value = etiqueta(p);
        return consultar();
      }
    });
    cont.addEventListener('click', (e) => { const a = e.target.closest('[data-accion]')?.dataset.accion; if (a === 'pdf') exportar('PDF'); if (a === 'excel') exportar('EXCEL'); });
    iniciar();
  }
  Object.keys(REPORTES).forEach((id) => { window.PANTALLAS[id] = (cont) => reporte(cont, id); });
})();
