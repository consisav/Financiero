// Inventarios · Registros · Vencimiento de productos: productos vencidos y por vencer (3, 6, 12 o 18 meses) por
// bodega, con su lote, vencimiento, fabricación, días para vencer, existencia del lote, costo unitario y valor.
// La existencia por lote sale de los movimientos de inventario (compras, ventas, notas, traslados y ajustes).
// Se imprime en PDF o Excel con la bodega, el horizonte y la búsqueda elegidos.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};


  // Cuando no hay datos, se dice qué se pudo leer de la base de datos con la sesión del usuario (para ubicar la causa).
  async function sondeoInventario(sb, loc, productoId) {
    const cuenta = async (q) => { const r = await q; return r.error ? `error: ${r.error.message}` : r.count ?? 0; };
    const base = () => sb.from('inventario_movimientos').select('id', { count: 'exact', head: true });
    const [total, empresa, migr, prod] = await Promise.all([cuenta(base()), cuenta(base().eq('localidad_id', loc)), cuenta(base().eq('origen_anterior', 'MIGRADO')), productoId ? cuenta(base().eq('producto_id', productoId)) : '—']);
    // Otras tablas con la misma regla de lectura (para saber si el bloqueo es solo de los movimientos).
    const otra = (t) => cuenta(sb.from(t).select('*', { count: 'exact', head: true }));
    const [act, prods, tipos, docs, exis] = await Promise.all([sb.rpc('usuario_activo').then((r) => (r.error ? `error: ${r.error.message}` : String(r.data))), otra('productos'), otra('tipos_movimiento_inventario'), otra('documentos_inventario'), otra('existencias')]);
    return `Lectura de la base de datos: ${total} movimiento(s) visibles en total · ${empresa} de esta empresa · ${migr} migrados${productoId ? ` · ${prod} de este producto (todas las bodegas)` : ''}. Usuario activo: ${act} · productos ${prods} · tipos de movimiento ${tipos} · documentos de inventario ${docs} · existencias ${exis}.`;
  }

  const cant = (n) => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const masMeses = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setMonth(x.getMonth() + n); return x.toLocaleDateString('en-CA'); };
  const dias = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
  const PESTANAS = [['VENCIDOS', 'Vencidos', 0], ['M3', 'Por vencer 3 meses', 3], ['M6', 'Por vencer 6 meses', 6], ['M12', 'Por vencer 12 meses', 12], ['M18', 'Por vencer 18 meses', 18]];
  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await hacer().range(i, i + 999);
      if (error) throw error;
      out.push(...(data || [])); if (!data || data.length < 1000) break;
    }
    return out;
  }

  window.PANTALLAS['vencimiento-productos'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Vencimiento de productos', icono: 'ti-calendar-exclamation', clase: 'bk-movimientos bm-solo cx-rep iv-mov iv-venc', grupo: 'Inventarios · Registros' });
    const { sb } = ctx;
    const hoy = fmt.hoy();
    const f = { bodega: '', pestana: 'VENCIDOS', buscar: '', ceros: false };
    let bodegas = [], productos = new Map(), lotes = [], sondeo = '';

    // Bodega con el número de lotes de la pestaña elegida (las que tienen lotes primero).
    function pintarFiltros() {
      const n = (id) => enPestana(lotes.filter((a) => (f.ceros || a.ex > 0.00001) && (!id || a.bodega_id === id)), f.pestana).length;
      const ops = bodegas.map((x) => ({ x, c: n(x.id) })).sort((a, b) => (b.c > 0) - (a.c > 0) || a.x.codigo - b.x.codigo);
      ctx.filtros(`
        <label class="campo ivv-bod"><span>Bodega</span><select name="bodega"><option value="">TODAS (${n(null)} lote(s))</option>${ops.map(({ x, c }) => `<option value="${x.id}" ${String(f.bodega) === String(x.id) ? 'selected' : ''}>${x.codigo} · ${esc(x.nombre)} (${c})</option>`).join('')}</select></label>
        <label class="campo cx-prov"><span>Buscar</span><input type="search" name="buscar" value="${esc(f.buscar)}" placeholder="Código, nombre o lote" autocomplete="off"></label>
        <label class="pc-check iv-ceros"><input type="checkbox" name="ceros" ${f.ceros ? 'checked' : ''}> Incluir lotes sin existencia</label>`,
        `<button type="button" class="boton primario-sm" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button>
         <button type="button" class="boton primario-sm" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>
         <button type="button" class="boton secundario-sm" data-accion="regresar"><i class="ti ti-arrow-left" aria-hidden="true"></i> Regresar</button>`);
    }
    async function iniciar() { if (!(await ctx.cargarBase())) return; ctx.filtros(''); await cargarLocalidad(); }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      if (!loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-calendar-exclamation'); return; }
      f.bodega = '';
      ctx.pDet.innerHTML = '<p class="vacio">Consultando los lotes…</p>';
      try {
        const [b, p, mv] = await Promise.all([
          sb.from('bodegas').select('id, codigo, nombre, estado').eq('localidad_id', loc).order('codigo'),
          leerTodo(() => sb.from('productos').select('id, codigo, codigo_producto, nombre, precio_costo').eq('localidad_id', loc).order('id')),
          leerTodo(() => sb.from('inventario_movimientos').select('producto_id, bodega_id, lote, fecha_vencimiento, cantidad, costo_unitario, ingreso_lineas(fecha_fabricacion), compra_articulos(fecha_fabricacion), nota_compra_lineas(fecha_fabricacion), factura_venta_lineas(fecha_fabricacion), documento_inventario_lineas(fecha_fabricacion, nueva_fabricacion), fecha_fabricacion').eq('localidad_id', loc).order('id'))
        ]);
        bodegas = (b.data || []).filter((x) => x.estado === 'ACTIVO'); productos = new Map(p.map((x) => [x.id, x]));
        const g = new Map();
        mv.forEach((x) => {
          const k = `${x.producto_id}|${x.bodega_id}|${(x.lote || '').toUpperCase()}`;
          const a = g.get(k) || { producto_id: x.producto_id, bodega_id: x.bodega_id, lote: (x.lote || '').toUpperCase(), ex: 0, vence: null, fab: null, costo: 0 };
          a.ex += Number(x.cantidad);
          // El vencimiento del lote es el de sus entradas (una salida puede traer otra fecha).
          if (x.fecha_vencimiento && (Number(x.cantidad) > 0 || !a.vence)) a.vence = x.fecha_vencimiento;
          const fab = x.ingreso_lineas?.fecha_fabricacion || x.compra_articulos?.fecha_fabricacion || x.nota_compra_lineas?.fecha_fabricacion || x.factura_venta_lineas?.fecha_fabricacion || x.documento_inventario_lineas?.nueva_fabricacion || x.documento_inventario_lineas?.fecha_fabricacion || x.fecha_fabricacion;
          if (fab) a.fab = fab;
          if (Number(x.cantidad) > 0 && Number(x.costo_unitario)) a.costo = Number(x.costo_unitario);
          g.set(k, a);
        });
        sondeo = `${mv.length} movimiento(s) leídos de esta empresa · ${g.size} lote(s) · ${[...g.values()].filter((a) => a.vence).length} con vencimiento · ${[...g.values()].filter((a) => a.vence && a.ex > 0.00001).length} con existencia.`;
        if (!mv.length) sondeo += ' ' + await sondeoInventario(sb, loc, null);
        lotes = [...g.values()].filter((a) => a.vence).map((a) => { const pp = productos.get(a.producto_id); return { ...a, costo: a.costo || Number(pp?.precio_costo) || 0, codigo: pp?.codigo ?? '', codigo_producto: pp?.codigo_producto || '', nombre: pp?.nombre || '', dias: dias(hoy, a.vence) }; });
      } catch (e) { ctx.pDet.innerHTML = `<p class="vacio">${esc(window.UI.traducirError(e))}</p>`; return; }
      pintarFiltros();
      pintar();
    }
    // Lotes con los parámetros: bodega, búsqueda, con o sin existencia; y por pestaña (vencidos o por vencer en N meses).
    const base = () => { const q = f.buscar.trim().toLowerCase(); return lotes.filter((a) => (f.ceros || a.ex > 0.00001) && (!f.bodega || String(a.bodega_id) === String(f.bodega)) && (!q || [a.codigo, a.codigo_producto, a.nombre, a.lote].some((v) => String(v || '').toLowerCase().includes(q)))); };
    const enPestana = (rows, p) => { const [k, , n] = PESTANAS.find((x) => x[0] === p); return rows.filter((a) => (k === 'VENCIDOS' ? a.vence < hoy : a.vence >= hoy && a.vence <= masMeses(hoy, n))).sort((a, b) => a.vence.localeCompare(b.vence) || a.nombre.localeCompare(b.nombre)); };

    function pintar() {
      const b0 = base(), rows = enPestana(b0, f.pestana);
      const todas = !f.bodega;
      const uds = rows.reduce((t, a) => t + a.ex, 0), val = rows.reduce((t, a) => t + a.ex * a.costo, 0);
      const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
      const venc = f.pestana === 'VENCIDOS';
      ctx.pDet.innerHTML = `
        <div class="bm-form cx-form cl-clasico">
          <div class="cl-banda">Productos vencidos y por vencer · al ${esc(fmt.fechaDia(hoy))} · ${esc(todas ? 'todas las bodegas' : bodegas.find((x) => String(x.id) === String(f.bodega))?.nombre || '')}</div>
          <div class="rp-pestanas ivv-tabs" role="tablist">${PESTANAS.map(([k, t]) => `<button type="button" role="tab" data-pestana="${k}" class="${f.pestana === k ? 'activa' : ''} ${k === 'VENCIDOS' ? 'ivv-rojo' : ''}"><i class="ti ${k === 'VENCIDOS' ? 'ti-alert-octagon' : 'ti-hourglass'}" aria-hidden="true"></i> ${t} <b>${enPestana(b0, k).length}</b></button>`).join('')}</div>
          <div class="ec-kpis">${kpi('Lotes', rows.length)}${kpi('Productos', new Set(rows.map((a) => a.producto_id)).size)}${kpi('Unidades', cant(uds))}${kpi('Valor al costo Q', fmt.monto(val), venc && val > 0 ? 'ec-alerta' : 'ec-fin')}</div>
          <div class="pc-lineas cx-tabla iv-tabla"><table>
            <thead><tr><th class="num">Producto</th><th>Código</th><th>Nombre producto</th>${todas ? '<th>Bodega</th>' : ''}<th>Lote</th><th>Vencimiento</th><th>Fabricación</th><th class="num">${venc ? 'Vencido hace' : 'Vence en'}</th><th class="num">Existencia lote</th><th class="num">Costo unitario</th><th class="num">Valor</th></tr></thead>
            <tbody>${rows.map((a) => `<tr><td class="num fuerte">${a.codigo}</td><td>${esc(a.codigo_producto)}</td><td class="cx-nombre" title="${esc(a.nombre)}"><div>${esc(a.nombre)}</div></td>${todas ? `<td>${esc(bodegas.find((x) => x.id === a.bodega_id)?.nombre || '')}</td>` : ''}
              <td class="fuerte">${esc(a.lote || '—')}</td><td class="${venc ? 'pc-rojo' : a.dias <= 90 ? 'ivv-pronto' : ''}">${esc(fmt.fechaDia(a.vence))}</td><td class="tk-tenue">${esc(fmt.fechaDia(a.fab))}</td>
              <td class="num ${venc ? 'pc-rojo' : a.dias <= 90 ? 'ivv-pronto' : ''}">${Math.abs(a.dias)} día(s)</td><td class="num ${a.ex > 0 ? 'fuerte' : 'tk-tenue'}">${cant(a.ex)}</td><td class="num">${fmt.monto(a.costo)}</td><td class="num">${fmt.monto(a.ex * a.costo)}</td></tr>`).join('')
              || `<tr><td colspan="11" class="tk-vacio"><i class="ti ti-calendar-check" aria-hidden="true"></i>${venc ? 'No hay lotes vencidos' : 'No hay lotes por vencer en ese plazo'}${f.ceros ? '' : ' con existencia'}.<br><small class="tk-tenue">${esc(sondeo)}</small></td></tr>`}</tbody>
            <tfoot><tr><td colspan="${todas ? 8 : 7}">${rows.length} lote(s)</td><td class="num">${cant(uds)}</td><td></td><td class="num">${fmt.monto(val)}</td></tr></tfoot>
          </table></div>
        </div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }

    function exportar(formato) {
      const rows = enPestana(base(), f.pestana);
      if (!rows.length) return window.FIN.aviso('No hay lotes con esos parámetros');
      const e = ctx.localidad(ctx.sel.loc), venc = f.pestana === 'VENCIDOS', pest = PESTANAS.find((x) => x[0] === f.pestana)[1];
      const columnas = [['Producto', 'texto', 9], ['Código', 'texto', 13], ['Nombre producto', 'texto', 46], ['Bodega', 'texto', 22], ['Lote', 'texto', 14], ['Vencimiento', 'texto', 12], ['Fabricación', 'texto', 12], [venc ? 'Días vencido' : 'Días para vencer', 'entero', 11], ['Existencia', 'numero', 12], ['Costo unit.', 'monto', 13], ['Valor Q', 'monto', 15]].map(([titulo, tipo, ancho]) => ({ titulo, tipo, ancho }));
      const filas = rows.map((a) => ({ valores: [String(a.codigo), a.codigo_producto, a.nombre, bodegas.find((x) => x.id === a.bodega_id)?.nombre || '', a.lote, fmt.fechaDia(a.vence), fmt.fechaDia(a.fab), Math.abs(a.dias), r2(a.ex), r2(a.costo), r2(a.ex * a.costo)] }));
      filas.push({ valores: [`Total · ${rows.length} lote(s)`, '', '', '', '', '', '', '', r2(rows.reduce((t, a) => t + a.ex, 0)), '', r2(rows.reduce((t, a) => t + a.ex * a.costo, 0))], tipo: 'total' });
      const cfg = { titulo: `Productos ${venc ? 'vencidos' : 'por vencer'}`, parametros: [`Empresa: ${e ? `${e.codigo} · ${e.nombre_comercial}` : ''}`, `Al ${fmt.fechaDia(hoy)}`, `Plazo: ${pest}`, `Bodega: ${f.bodega ? bodegas.find((x) => String(x.id) === String(f.bodega))?.nombre || '' : 'TODAS'}`, `Lotes: ${f.ceros ? 'con y sin existencia' : 'con existencia'}`, ...(f.buscar ? [`Búsqueda: ${f.buscar}`] : [])], orgId: ctx.sel.org, locId: ctx.sel.loc, columnas, filas };
      if (formato === 'PDF') return window.CUENTAS_XLSX.pdf(cfg);
      return window.REPORTE_XLSX.generar({ ...cfg, hoja: venc ? 'Vencidos' : 'Por vencer', archivo: `vencimientos_${f.pestana.toLowerCase()}_${hoy}` });
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (e.target.name === 'ceros') { f.ceros = e.target.checked; pintarFiltros(); return pintar(); }
      if (e.target.name === 'bodega') { f.bodega = e.target.value; return pintar(); }
    });
    cont.addEventListener('input', (e) => { if (e.target.name === 'buscar') { f.buscar = e.target.value; pintar(); ctx.pFil.querySelector('[name=buscar]')?.focus(); } });
    cont.addEventListener('click', (e) => {
      const t = e.target.closest('[data-pestana]');
      if (t) { f.pestana = t.dataset.pestana; pintarFiltros(); return pintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'pdf') return exportar('PDF');
      if (a === 'excel') return exportar('EXCEL');
      if (a === 'regresar') return history.length > 1 ? history.back() : (location.hash = '#/inventarios');
    });
    iniciar();
  };
})();
