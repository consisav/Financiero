// Inventarios · Registros · Entradas y Salidas.
//   Entradas: los productos que ingresan por compras (ingreso de compras) y los ajustes de compras (notas de
//   crédito y débito de proveedores: la devolución al proveedor resta).
//   Salidas: los productos que salen por ventas (facturas vigentes) y los ajustes de ventas (notas de crédito,
//   débito y abono: la devolución del cliente resta; los descuentos solo ajustan el valor).
// Parámetros: empresa (organización y localidad), fecha inicial y final, uno o todos los proveedores o clientes,
// uno o varios productos, bodega y tipo de documento. Vistas: detalle, por producto, por proveedor o cliente y por
// documento. Se imprime en PDF o Excel con esos parámetros.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const cant = (n) => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  const dia = (v) => (!v ? '' : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : new Date(v).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }));
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await hacer().range(i, i + 999);
      if (error) throw error;
      out.push(...(data || [])); if (!data || data.length < 1000) break;
    }
    return out;
  }

  const CONF = {
    entradas: {
      titulo: 'Entradas de inventario', icono: 'ti-package-import', tercero: 'Proveedor', plural: 'proveedores', archivo: 'entradas_inventario',
      tipos: [['', 'TODOS'], ['COMPRA', 'COMPRAS'], ['NOTA', 'AJUSTES DE COMPRAS (NOTAS)']], precio: 'Costo unit.',
      async terceros(sb, loc) { return (await leerTodo(() => sb.from('proveedores').select('id, codigo, nit, nombre_comercial').eq('localidad_id', loc).order('nombre_comercial').order('id'))).map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre_comercial, nit: p.nit || '' })); },
      async leer(sb, loc, desde, hasta, ctx) {
        const k = (m, tc) => (ctx.moneda(m)?.iso && ctx.moneda(m).iso !== 'GTQ' ? Number(tc) || 1 : 1);
        const [ca, nc] = await Promise.all([
          leerTodo(() => sb.from('compra_articulos').select('id, producto_id, producto_codigo, serie, cantidad, costo_total, fecha_vencimiento, compras!inner(id, numero, serie, documento, fecha_documento, proveedor_id, proveedor_codigo, proveedor_nombre, moneda_id, tipo_cambio, bodega_id, estado, localidad_id)')
            .eq('compras.localidad_id', loc).eq('compras.estado', 'ACTIVA').gte('compras.fecha_documento', desde).lte('compras.fecha_documento', hasta).not('producto_id', 'is', null).order('id')),
          leerTodo(() => sb.from('nota_compra_lineas').select('id, producto_id, lote, cantidad, total, fecha_vencimiento, bodega_id, notas_compra!inner(id, numero, tipo, serie, documento, fecha, proveedor_id, proveedor_codigo, proveedor_nombre, moneda_id, tipo_cambio, bodega_id, estado, localidad_id)')
            .eq('notas_compra.localidad_id', loc).eq('notas_compra.estado', 'OPERADA').gte('notas_compra.fecha', desde).lte('notas_compra.fecha', hasta).not('producto_id', 'is', null).order('id'))
        ]);
        return [
          ...ca.map((a) => { const c = a.compras, q = Number(a.cantidad), v = Number(a.costo_total) * k(c.moneda_id, c.tipo_cambio);
            return { clase: 'COMPRA', tipo: 'Compra', doc: `C${c.id}`, numero: c.numero, documento: [c.serie, c.documento].filter(Boolean).join('-'), fecha: c.fecha_documento, tercero_id: c.proveedor_id, tercero_codigo: c.proveedor_codigo || '', tercero: c.proveedor_nombre || '', bodega_id: c.bodega_id, producto_id: a.producto_id, codigo_alt: a.producto_codigo, lote: a.serie || '', vence: a.fecha_vencimiento || '', cantidad: q, valor: r2(v), unit: q ? v / q : 0 }; }),
          ...nc.map((l) => { const n = l.notas_compra, s = n.tipo === 'NOTA DE CRÉDITO' ? -1 : 1, q = Number(l.cantidad), v = Number(l.total) * k(n.moneda_id, n.tipo_cambio);
            return { clase: 'NOTA', tipo: n.tipo === 'NOTA DE CRÉDITO' ? 'N. crédito (devolución)' : 'N. débito', doc: `N${n.id}`, numero: n.numero, documento: [n.serie, n.documento].filter(Boolean).join('-'), fecha: n.fecha, tercero_id: n.proveedor_id, tercero_codigo: n.proveedor_codigo || '', tercero: n.proveedor_nombre || '', bodega_id: l.bodega_id || n.bodega_id, producto_id: l.producto_id, lote: l.lote || '', vence: l.fecha_vencimiento || '', cantidad: s * q, valor: r2(s * v), unit: q ? v / q : 0 }; })
        ];
      }
    },
    salidas: {
      titulo: 'Salidas de inventario', icono: 'ti-package-export', tercero: 'Cliente', plural: 'clientes', archivo: 'salidas_inventario',
      tipos: [['', 'TODOS'], ['FACTURA', 'VENTAS (FACTURAS)'], ['NOTA', 'AJUSTES DE VENTAS (NOTAS)']], precio: 'Precio unit.',
      async terceros(sb, loc) { return (await leerTodo(() => sb.from('clientes').select('id, codigo, documento, nombre').eq('localidad_id', loc).order('nombre').order('id'))).map((c) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre, nit: c.documento || '' })); },
      async leer(sb, loc, desde, hasta) {
        const ini = `${desde}T00:00:00-06:00`, fin = `${hasta}T23:59:59.999-06:00`;
        const [fl, nl] = await Promise.all([
          leerTodo(() => sb.from('factura_venta_lineas').select('id, producto_id, producto_codigo, descripcion, cantidad, total, lote, fecha_vencimiento, facturas_venta!inner(id, numero, no_interno, serie, numero_dte, fecha_emision, cliente_id, cliente_codigo, nombre, bodega_id, estado, localidad_id)')
            .eq('facturas_venta.localidad_id', loc).neq('facturas_venta.estado', 'ANULADA').gte('facturas_venta.fecha_emision', ini).lte('facturas_venta.fecha_emision', fin).not('producto_id', 'is', null).order('id')),
          leerTodo(() => sb.from('nota_venta_lineas').select('id, producto_id, producto_codigo, cantidad, total, lote, fecha_vencimiento, notas_venta!inner(id, numero, tipo, tipo_ajuste, serie, numero_dte, fecha_emision, cliente_id, cliente_codigo, nombre, bodega_id, estado, localidad_id)')
            .eq('notas_venta.localidad_id', loc).neq('notas_venta.estado', 'ANULADA').gte('notas_venta.fecha_emision', ini).lte('notas_venta.fecha_emision', fin).not('producto_id', 'is', null).order('id'))
        ]);
        return [
          ...fl.map((l) => { const f = l.facturas_venta, q = Number(l.cantidad), v = Number(l.total);
            return { clase: 'FACTURA', tipo: 'Factura', doc: `F${f.id}`, numero: f.no_interno || f.numero, documento: f.serie ? `${f.serie}-${f.numero_dte || ''}` : String(f.numero), fecha: dia(f.fecha_emision), tercero_id: f.cliente_id, tercero_codigo: f.cliente_codigo || '', tercero: f.nombre || '', bodega_id: f.bodega_id, producto_id: l.producto_id, codigo_alt: l.producto_codigo, lote: l.lote || '', vence: l.fecha_vencimiento || '', cantidad: q, valor: r2(v), unit: q ? v / q : 0 }; }),
          ...nl.map((l) => { const n = l.notas_venta, deb = n.tipo === 'DÉBITO', dev = n.tipo_ajuste === 'DEVOLUCIÓN', q = Number(l.cantidad), v = Number(l.total);
            return { clase: 'NOTA', tipo: `N. ${n.tipo.toLowerCase()}${n.tipo_ajuste ? ` (${n.tipo_ajuste.toLowerCase()})` : ''}`, doc: `N${n.id}`, numero: n.numero, documento: n.serie ? `${n.serie}-${n.numero_dte || ''}` : String(n.numero), fecha: dia(n.fecha_emision), tercero_id: n.cliente_id, tercero_codigo: n.cliente_codigo || '', tercero: n.nombre || '', bodega_id: n.bodega_id, producto_id: l.producto_id, codigo_alt: l.producto_codigo, lote: l.lote || '', vence: l.fecha_vencimiento || '',
              // La devolución regresa producto (resta a las salidas); el descuento o el débito solo cambian el valor.
              cantidad: dev && !deb ? -q : 0, valor: r2(deb ? v : -v), unit: q ? v / q : 0 }; })
        ];
      }
    }
  };
  const VISTAS = [['DETALLE', 'DETALLE (LÍNEAS)'], ['PRODUCTO', 'POR PRODUCTO'], ['TERCERO', ''], ['DOCUMENTO', 'POR DOCUMENTO']];

  function movimientos(cont, clave) {
    const C = CONF[clave];
    const ctx = montar(cont, { titulo: C.titulo, icono: C.icono, clase: `bk-movimientos bm-solo cx-rep iv-mov iv-${clave}`, grupo: 'Inventarios · Registros' });
    const { sb } = ctx;
    const hoy = fmt.hoy();
    const f = { desde: `${hoy.slice(0, 8)}01`, hasta: hoy, tercero: '', bodega: '', tipo: '', vista: 'DETALLE', productos: [] };
    let terceros = [], productos = [], bodegas = [], filas = [], leido = '', turno = 0;
    const prod = (id) => productos.find((p) => p.id === id);
    const prodTxt = (p) => `${p.nombre} — ${p.codigo_producto || p.codigo}`;
    const prodDe = (t0) => { const t = String(t0 || '').trim().toUpperCase(); if (!t) return null; const cod = t.includes(' — ') ? t.slice(t.lastIndexOf(' — ') + 3) : t; return productos.find((p) => prodTxt(p).toUpperCase() === t) || productos.find((p) => (p.codigo_producto || '').toUpperCase() === cod || String(p.codigo) === cod || (p.codigo_barras || '').toUpperCase() === cod) || null; };
    const terTxt = (x) => `${x.nombre} — ${x.codigo}`;
    const terDe = (t0) => { const t = String(t0 || '').trim().toUpperCase(); if (!t) return null; const cod = t.includes(' — ') ? t.slice(t.lastIndexOf(' — ') + 3) : t; return terceros.find((x) => String(x.codigo) === cod || (x.nit && x.nit.toUpperCase() === cod) || x.nombre.toUpperCase() === t) || null; };
    const bodega = (id) => bodegas.find((b) => b.id === id);
    const empresa = () => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
    const vistas = () => VISTAS.map(([k, t]) => [k, k === 'TERCERO' ? `POR ${C.tercero.toUpperCase()}` : t]);

    function pintarFiltros() {
      const t = terDe(f.tercero);
      const sl = (n, ops, val) => `<select name="${n}">${ops.map(([x, tx]) => `<option value="${esc(String(x))}" ${String(val) === String(x) ? 'selected' : ''}>${esc(tx)}</option>`).join('')}</select>`;
      ctx.filtros(`
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo cx-prov"><span>${C.tercero}</span><input list="iv-terceros" name="tercero" value="${esc(f.tercero)}" placeholder="TODOS" autocomplete="off"></label>
        <label class="campo"><span>Bodega</span>${sl('bodega', [['', 'TODAS'], ...bodegas.map((b) => [b.id, `${b.codigo} · ${b.nombre}`])], f.bodega)}</label>
        <label class="campo"><span>Tipo documento</span>${sl('tipo', C.tipos, f.tipo)}</label>
        <label class="campo"><span>Vista</span>${sl('vista', vistas(), f.vista)}</label>
        <label class="campo iv-prods"><span>Productos <small>(uno o varios; vacío = todos)</small></span>
          <div class="iv-chips">${f.productos.map((id) => { const p = prod(id); return `<span class="iv-chip" title="${esc(p?.nombre || '')}">${esc(p ? p.codigo_producto || String(p.codigo) : String(id))}<button type="button" data-quitar-prod="${id}" aria-label="Quitar ${esc(p?.nombre || '')}"><i class="ti ti-x" aria-hidden="true"></i></button></span>`; }).join('')}
            <input list="iv-productos" data-prod placeholder="${f.productos.length ? 'Agregar otro…' : 'TODOS · escribe código o nombre'}" autocomplete="off">
            ${f.productos.length ? '<button type="button" class="iv-limpiar" data-accion="limpiar-prod">Todos</button>' : ''}</div></label>
        <datalist id="iv-terceros">${terceros.map((x) => `<option value="${esc(terTxt(x))}"></option>`).join('')}</datalist>
        <datalist id="iv-productos">${productos.filter((p) => !f.productos.includes(p.id)).map((p) => `<option value="${esc(prodTxt(p))}"></option>`).join('')}</datalist>
        ${t || !f.tercero ? '' : `<small class="cx-aviso pc-rojo">${C.tercero} no encontrado</small>`}`,
        `<button type="button" class="boton primario-sm" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button>
         <button type="button" class="boton primario-sm" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>
         <button type="button" class="boton secundario-sm" data-accion="regresar"><i class="ti ti-arrow-left" aria-hidden="true"></i> Regresar</button>`);
    }
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargarLocalidad(); }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      if (!loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', C.icono); return; }
      const [t, p, b] = await Promise.all([
        C.terceros(sb, loc),
        leerTodo(() => sb.from('productos').select('id, codigo, codigo_producto, codigo_barras, nombre, estado').eq('localidad_id', loc).order('nombre').order('id')),
        sb.from('bodegas').select('id, codigo, nombre, estado').eq('localidad_id', loc).order('codigo')
      ]);
      terceros = t; productos = p; bodegas = b.data || [];
      f.productos = []; f.tercero = ''; f.bodega = ''; leido = '';
      pintarFiltros();
      await consultar();
    }
    async function consultar() {
      const n = ++turno, loc = ctx.sel.loc;
      ctx.pDet.innerHTML = '<p class="vacio">Consultando los documentos…</p>';
      try {
        const r = await C.leer(sb, loc, f.desde, f.hasta, ctx);
        if (n !== turno) return;
        filas = r.sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.numero).localeCompare(String(b.numero), 'es', { numeric: true }));
        leido = `${f.desde}|${f.hasta}`;
      } catch (e) { if (n === turno) ctx.pDet.innerHTML = `<p class="vacio">${esc(window.UI.traducirError(e))}</p>`; return; }
      pintar();
    }
    // Filas con los parámetros aplicados (los de fecha ya vienen en la consulta).
    function aplicadas() {
      const t = terDe(f.tercero), ps = new Set(f.productos);
      return filas.filter((x) => (!t || x.tercero_id === t.id) && (!ps.size || ps.has(x.producto_id)) && (!f.bodega || String(x.bodega_id) === String(f.bodega)) && (!f.tipo || x.clase === f.tipo))
        .map((x) => { const p = prod(x.producto_id); return { ...x, codigo: p ? p.codigo_producto || String(p.codigo) : x.codigo_alt || '', nombre: p?.nombre || '', bodega: bodega(x.bodega_id)?.nombre || '' }; });
    }
    const agrupar = (rows, k, base) => { const g = new Map(); rows.forEach((x) => { const key = k(x); const a = g.get(key) || { ...base(x), docs: new Set(), cantidad: 0, valor: 0, n: 0 }; a.docs.add(x.doc); a.cantidad += x.cantidad; a.valor += x.valor; a.n++; g.set(key, a); }); return [...g.values()]; };
    // Estructura común de la pantalla, el PDF y el Excel según la vista.
    function tabla(rows) {
      const T = C.tercero;
      if (f.vista === 'PRODUCTO') {
        const g = agrupar(rows, (x) => x.producto_id || x.codigo, (x) => ({ codigo: x.codigo, nombre: x.nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
        return { columnas: [['Código', 'texto', 14], ['Producto', 'texto', 50], ['Documentos', 'entero', 11], ['Cantidad', 'numero', 13], [C.precio.replace('unit.', 'promedio'), 'monto', 15], ['Valor Q', 'monto', 16]],
          filas: g.map((a) => ({ valores: [a.codigo, a.nombre, a.docs.size, r2(a.cantidad), a.cantidad ? r2(a.valor / a.cantidad) : '', r2(a.valor)] })), resumen: `${g.length} producto(s)` };
      }
      if (f.vista === 'TERCERO') {
        const g = agrupar(rows, (x) => x.tercero_id || x.tercero, (x) => ({ codigo: x.tercero_codigo, nombre: x.tercero })).sort((a, b) => a.nombre.localeCompare(b.nombre));
        return { columnas: [[T, 'texto', 10], [`Nombre ${T.toLowerCase()}`, 'texto', 46], ['Documentos', 'entero', 11], ['Líneas', 'entero', 9], ['Cantidad', 'numero', 13], ['Valor Q', 'monto', 16]],
          filas: g.map((a) => ({ valores: [String(a.codigo ?? ''), a.nombre, a.docs.size, a.n, r2(a.cantidad), r2(a.valor)] })), resumen: `${g.length} ${C.plural}` };
      }
      const cols = [['Fecha', 'texto', 11], ['Tipo', 'texto', 20], ['No.', 'texto', 9], ['Documento', 'texto', 18], [T, 'texto', 30], ['Código', 'texto', 13], ['Producto', 'texto', 40], ['Lote', 'texto', 12], ['Vence', 'texto', 11], ['Cantidad', 'numero', 11], [C.precio, 'monto', 13], ['Valor Q', 'monto', 15]];
      const linea = (x) => ({ valores: [fmt.fechaDia(x.fecha), x.tipo, String(x.numero ?? ''), x.documento, x.tercero, x.codigo, x.nombre, x.lote, fmt.fechaDia(x.vence), r2(x.cantidad), r2(x.unit), r2(x.valor)] });
      if (f.vista === 'DOCUMENTO') {
        const out = []; const g = new Map(); rows.forEach((x) => { if (!g.has(x.doc)) g.set(x.doc, []); g.get(x.doc).push(x); });
        g.forEach((ls) => { const x = ls[0];
          out.push({ valores: [`${fmt.fechaDia(x.fecha)} · ${x.tipo} No. ${x.numero} · ${x.documento} · ${x.tercero}${x.bodega_id ? ` · Bodega ${bodega(x.bodega_id)?.nombre || ''}` : ''}`], tipo: 'grupo', combinar: true });
          ls.forEach((l) => out.push(linea(l)));
          out.push({ valores: [`Subtotal (${ls.length} línea(s))`, '', '', '', '', '', '', '', '', r2(ls.reduce((t, l) => t + l.cantidad, 0)), '', r2(ls.reduce((t, l) => t + l.valor, 0))], tipo: 'subtotal' }); });
        return { columnas: cols, filas: out, resumen: `${g.size} documento(s)` };
      }
      return { columnas: cols, filas: rows.map(linea), resumen: `${rows.length} línea(s)` };
    }
    const totalFila = (t, rows) => { const n = t.columnas.length; const v = Array(n).fill(''); v[0] = `Total · ${t.resumen}`; const ic = t.columnas.findIndex(([x]) => x === 'Cantidad'); v[ic] = r2(rows.reduce((s, x) => s + x.cantidad, 0)); v[n - 1] = r2(rows.reduce((s, x) => s + x.valor, 0)); return { valores: v, tipo: 'total' }; };

    function pintar() {
      const rows = aplicadas();
      const docs = new Set(rows.map((x) => x.doc)).size, prods = new Set(rows.map((x) => x.producto_id)).size;
      const qty = rows.reduce((s, x) => s + x.cantidad, 0), val = rows.reduce((s, x) => s + x.valor, 0);
      const t = tabla(rows);
      const largas = new Set(['Producto', C.tercero, `Nombre ${C.tercero.toLowerCase()}`]);
      const celda = (v, tp, col) => (v === '' || v == null ? '<td></td>' : tp === 'monto' ? `<td class="num">${fmt.monto(v)}</td>` : tp === 'numero' ? `<td class="num ${v < 0 ? 'pc-rojo' : ''}">${cant(v)}</td>` : tp === 'entero' ? `<td class="num">${v}</td>`
        : largas.has(col) ? `<td class="iv-nom ${col === 'Producto' ? 'iv-prod' : ''}" title="${esc(String(v))}"><div>${esc(String(v))}</div></td>` : `<td>${esc(String(v))}</td>`);
      const kpi = (tx, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${tx}</small><b>${v}</b></div>`;
      const porTipo = C.tipos.slice(1).map(([k, tx]) => { const r = rows.filter((x) => x.clase === k); return kpi(tx.replace(/ \(.*\)/, ''), `${new Set(r.map((x) => x.doc)).size} · Q ${fmt.monto(r.reduce((s, x) => s + x.valor, 0))}`); }).join('');
      ctx.pDet.innerHTML = `
        <div class="bm-form cx-form cl-clasico">
          <div class="cl-banda">${esc(C.titulo)} · del ${esc(fmt.fechaDia(f.desde))} al ${esc(fmt.fechaDia(f.hasta))}</div>
          <div class="ec-kpis">${kpi('Documentos', docs)}${kpi('Productos', prods)}${kpi('Cantidad', cant(qty))}${kpi('Valor Q', fmt.monto(val), 'ec-fin')}${porTipo}</div>
          <div class="pc-lineas cx-tabla iv-tabla"><table>
            <thead><tr>${t.columnas.map(([n, tp]) => `<th class="${tp === 'texto' ? '' : 'num'}">${esc(n)}</th>`).join('')}</tr></thead>
            <tbody>${t.filas.map((r) => (r.tipo === 'grupo' ? `<tr class="ec-sec"><td colspan="${t.columnas.length}">${esc(r.valores[0])}</td></tr>`
              : `<tr class="${r.tipo === 'subtotal' ? 'ec-sub' : ''}">${t.columnas.map(([n, tp], i) => celda(r.valores[i], tp, n)).join('')}</tr>`)).join('')
              || `<tr><td colspan="${t.columnas.length}" class="tk-vacio"><i class="ti ${C.icono}" aria-hidden="true"></i>Sin ${clave} con esos parámetros.</td></tr>`}</tbody>
            <tfoot><tr>${(() => { const tf = totalFila(t, rows); return t.columnas.map(([, tp], i) => (i === 0 ? `<td>${esc(tf.valores[0])}</td>` : celda(tf.valores[i], tp))).join(''); })()}</tr></tfoot>
          </table></div>
        </div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }

    function parametros() {
      const t = terDe(f.tercero);
      const ps = f.productos.map((id) => prod(id)).filter(Boolean);
      return [`Empresa: ${empresa()}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, `${C.tercero}: ${t ? t.nombre : 'TODOS'}`, `Bodega: ${f.bodega ? bodega(Number(f.bodega))?.nombre || '' : 'TODAS'}`,
        `Tipo: ${C.tipos.find(([k]) => k === f.tipo)?.[1] || 'TODOS'}`, `Productos: ${ps.length ? ps.map((p) => p.codigo_producto || p.codigo).join(', ') : 'TODOS'}`, `Vista: ${vistas().find(([k]) => k === f.vista)[1]}`];
    }
    function exportar(formato) {
      const rows = aplicadas();
      if (!rows.length) return window.FIN.aviso(`No hay ${clave} con esos parámetros`);
      const t = tabla(rows);
      const columnas = t.columnas.map(([titulo, tipo, ancho]) => ({ titulo, tipo, ancho }));
      const cfg = { titulo: `${C.titulo} · ${vistas().find(([k]) => k === f.vista)[1].toLowerCase()}`, parametros: parametros(), orgId: ctx.sel.org, locId: ctx.sel.loc, columnas, filas: [...t.filas, totalFila(t, rows)] };
      if (formato === 'PDF') return window.CUENTAS_XLSX.pdf(cfg);
      return window.REPORTE_XLSX.generar({ ...cfg, hoja: C.titulo.slice(0, 30), archivo: `${C.archivo}_${f.desde}_${f.hasta}` }).catch((e) => window.FIN.aviso(e.message || 'No se pudo generar el Excel'));
    }

    function agregarProducto(txt) {
      const p = prodDe(txt);
      if (!p) { if (String(txt || '').trim()) window.FIN.aviso('Ese producto no está en el catálogo'); return; }
      if (!f.productos.includes(p.id)) f.productos.push(p.id);
      pintarFiltros(); pintar();
      ctx.pFil.querySelector('[data-prod]')?.focus();
    }
    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (e.target.matches('[data-prod]')) { const v = e.target.value; e.target.value = ''; return agregarProducto(v); }
      if (cambio !== 'otro') return;
      const n = e.target.name;
      if (!n || !(n in f)) return;
      f[n] = e.target.value;
      if (n === 'desde' && f.hasta < f.desde) f.hasta = f.desde;
      if (n === 'hasta' && f.desde > f.hasta) f.desde = f.hasta;
      pintarFiltros();
      return leido !== `${f.desde}|${f.hasta}` ? consultar() : pintar();
    });
    cont.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-prod]')) { e.preventDefault(); const v = e.target.value; e.target.value = ''; agregarProducto(v); } });
    cont.addEventListener('click', (e) => {
      const q = e.target.closest('[data-quitar-prod]');
      if (q) { f.productos = f.productos.filter((x) => x !== Number(q.dataset.quitarProd)); pintarFiltros(); return pintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'limpiar-prod') { f.productos = []; pintarFiltros(); return pintar(); }
      if (a === 'pdf') return exportar('PDF');
      if (a === 'excel') return exportar('EXCEL');
      if (a === 'regresar') return history.length > 1 ? history.back() : (location.hash = '#/inventarios');
    });
    iniciar();
  }
  window.PANTALLAS.entradas = (cont) => movimientos(cont, 'entradas');
  window.PANTALLAS.salidas = (cont) => movimientos(cont, 'salidas');
})();
