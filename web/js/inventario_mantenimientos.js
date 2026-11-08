// Inventarios · Mantenimientos:
//   Análisis de costos › Análisis costo importación: compras (por defecto en dólares) con sus gastos extras de
//     importación prorrateados por valor: costo unitario, total, gasto por unidad, costo con gastos en quetzales y
//     en dólares. Reportes detallado (líneas), resumido (por producto) y consolidado (todas las compras).
//   Control de inventario › Mínimos y máximos: existencia contra mínimo y máximo por producto, con estado, cantidad
//     a pedir y valor; los mínimos y máximos se editan en la tabla.
//   Control de inventario › Costos: costo del catálogo contra el último costo y el promedio ponderado de compras,
//     con la diferencia; el costo del catálogo se actualiza (a mano, con el último o con el promedio).
// Parámetros: empresa (organización y localidad), proveedor, producto, clasificación, bodega, fechas… en PDF y Excel.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const cant = (n) => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const r4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;
  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await hacer().range(i, i + 999);
      if (error) throw error;
      out.push(...(data || [])); if (!data || data.length < 1000) break;
    }
    return out;
  }
  const sl = (n, ops, val) => `<select name="${n}">${ops.map(([x, t]) => `<option value="${esc(String(x))}" ${String(val) === String(x) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const empresaDe = (ctx) => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
  // Salida común: PDF o Excel con la estructura de REPORTE_XLSX.
  function salida(formato, cfg) {
    if (formato === 'PDF') return window.CUENTAS_XLSX.pdf(cfg);
    return window.REPORTE_XLSX.generar(cfg).catch((e) => window.FIN.aviso(e.message || 'No se pudo generar el Excel'));
  }
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  // Proveedores y clasificaciones de la localidad (datalist «nombre — código»).
  async function catalogos(sb, loc) {
    const [p, c] = await Promise.all([
      leerTodo(() => sb.from('proveedores').select('id, codigo, nombre_comercial, nit').eq('localidad_id', loc).order('nombre_comercial').order('id')),
      sb.from('clasificaciones_producto').select('id, nombre').eq('localidad_id', loc).order('nombre')
    ]);
    return { proveedores: p, clasificaciones: c.error ? [] : c.data || [] };
  }
  const provDe = (lista, t0) => { const t = String(t0 || '').trim().toUpperCase(); if (!t) return null; const cod = t.includes(' — ') ? t.slice(t.lastIndexOf(' — ') + 3) : t; return lista.find((p) => String(p.codigo) === cod || (p.nit && p.nit.toUpperCase() === cod) || p.nombre_comercial.toUpperCase() === t) || null; };

  // ===================== Análisis costo importación =====================
  window.PANTALLAS['analisis-costo-importacion'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Análisis costo importación', icono: 'ti-world-dollar', clase: 'bk-movimientos bm-solo cx-rep im-costos', grupo: 'Inventarios · Mantenimientos' });
    const { sb } = ctx;
    const hoy = fmt.hoy();
    const f = { desde: `${Number(hoy.slice(0, 4)) - 1}${hoy.slice(4)}`, hasta: hoy, moneda: 'USD', proveedor: '', buscar: '', formato: 'PDF', monedaRep: 'QUETZALES', gastosRep: true };
    let compras = [], lineas = [], prods = new Map(), cat = { proveedores: [] }, sel = null;
    const gastos = new Map(); // compra → gastos extras en quetzales (se proponen con el costo extra de sus líneas)
    const usd = () => ctx.monedas.find((m) => m.iso === 'USD');

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Compras en</span>${sl('moneda', [['USD', 'DÓLARES (IMPORTACIONES)'], ['', 'TODAS LAS MONEDAS']], f.moneda)}</label>
        <label class="campo cx-prov"><span>Proveedor</span><input list="im-prov" name="proveedor" value="${esc(f.proveedor)}" placeholder="TODOS" autocomplete="off"></label>
        <label class="campo cx-prov"><span>Documento o producto</span><input type="search" name="buscar" value="${esc(f.buscar)}" placeholder="Documento, descripción, código o nombre" autocomplete="off"></label>
        <datalist id="im-prov">${cat.proveedores.map((p) => `<option value="${esc(`${p.nombre_comercial} — ${p.codigo}`)}"></option>`).join('')}</datalist>`,
        `<div class="im-rep"><b>Reportes</b>${sl('formato', [['PDF', 'PDF'], ['EXCEL', 'EXCEL']], f.formato)}${sl('monedaRep', [['QUETZALES', 'QUETZALES'], ['DOLARES', 'DÓLARES']], f.monedaRep)}
          <label class="pc-check"><input type="checkbox" name="gastosRep" ${f.gastosRep ? 'checked' : ''}> Incluir gastos</label>
          <button type="button" class="boton primario-sm" data-accion="detallado">Detallado</button><button type="button" class="boton secundario-sm" data-accion="resumido">Resumido</button><button type="button" class="boton secundario-sm" data-accion="consolidado">Consolidado</button></div>`);
    }
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargarLocalidad(); }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      if (!loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-world-dollar'); return; }
      cat = await catalogos(sb, loc);
      const p = await leerTodo(() => sb.from('productos').select('id, codigo, codigo_producto, nombre').eq('localidad_id', loc).order('id'));
      prods = new Map(p.map((x) => [x.id, x]));
      pintarFiltros();
      await consultar();
    }
    async function consultar() {
      ctx.pDet.innerHTML = '<p class="vacio">Consultando las compras…</p>';
      let q = () => { let x = sb.from('compras').select('id, numero, serie, documento, descripcion, fecha_documento, proveedor_id, proveedor_codigo, proveedor_nombre, moneda_id, tipo_cambio, valor_total').eq('localidad_id', ctx.sel.loc).eq('estado', 'ACTIVA').gte('fecha_documento', f.desde).lte('fecha_documento', f.hasta).order('fecha_documento', { ascending: false }).order('id'); if (f.moneda === 'USD' && usd()) x = x.eq('moneda_id', usd().id); return x; };
      try {
        compras = await leerTodo(q);
        const ids = compras.map((c) => c.id); lineas = [];
        for (let i = 0; i < ids.length; i += 300) lineas.push(...await leerTodo(() => sb.from('compra_articulos').select('id, compra_id, linea, producto_id, serie, fecha_vencimiento, cantidad, costo_unitario, costo_total, costo_extra').in('compra_id', ids.slice(i, i + 300)).order('id')));
      } catch (e) { ctx.pDet.innerHTML = `<p class="vacio">${esc(window.UI.traducirError(e))}</p>`; return; }
      if (!compras.some((c) => c.id === sel)) sel = compras[0]?.id || null;
      pintar();
    }
    const esUsd = (c) => ctx.moneda(c.moneda_id)?.iso === 'USD';
    const tcDe = (c) => Number(c.tipo_cambio) || usd()?.cambio || 1;
    // Líneas de una compra en quetzales y dólares, con el gasto prorrateado por el valor de cada línea.
    function calculo(c) {
      const tc = tcDe(c), u = esUsd(c);
      const ls = lineas.filter((l) => l.compra_id === c.id).map((l) => { const tot = Number(l.costo_total); return { ...l, q: Number(l.cantidad), totQ: u ? tot * tc : tot, totU: u ? tot : tot / tc, extraQ: Number(l.costo_extra || 0) * (u ? tc : 1) }; });
      const totQ = ls.reduce((t, l) => t + l.totQ, 0);
      if (!gastos.has(c.id)) gastos.set(c.id, r2(ls.reduce((t, l) => t + l.extraQ, 0)));
      const gQ = gastos.get(c.id), gU = gQ / tc;
      const filas = ls.map((l) => { const pq = totQ ? l.totQ / totQ : 0; const gl = gQ * pq; const p = prods.get(l.producto_id);
        return { ...l, prod: p, nombre: p?.nombre || '', codigo: p ? p.codigo_producto || String(p.codigo) : '', cuQ: l.q ? l.totQ / l.q : 0, cuU: l.q ? l.totU / l.q : 0, gxuQ: l.q ? gl / l.q : 0, gxuU: l.q ? gl / tc / l.q : 0,
          cucgQ: l.q ? (l.totQ + gl) / l.q : 0, cucgU: l.q ? (l.totU + gl / tc) / l.q : 0, tcgQ: l.totQ + gl, tcgU: l.totU + gl / tc }; });
      return { c, tc, filas, totQ, totU: totQ / tc, gQ, gU, pct: totQ ? (gQ / totQ) * 100 : 0, porProd: filas.length ? gQ / filas.length : 0 };
    }
    const visibles = () => { const p = provDe(cat.proveedores, f.proveedor), q = f.buscar.trim().toLowerCase();
      return compras.filter((c) => (!p || c.proveedor_id === p.id) && (!q || [c.documento, c.serie, c.descripcion, c.numero].some((v) => String(v || '').toLowerCase().includes(q))
        || lineas.some((l) => l.compra_id === c.id && [prods.get(l.producto_id)?.nombre, prods.get(l.producto_id)?.codigo_producto].some((v) => String(v || '').toLowerCase().includes(q))))); };

    function pintar() {
      const vs = visibles();
      const c = compras.find((x) => x.id === sel && vs.includes(x)) || vs[0] || null;
      sel = c?.id || null;
      const k = c ? calculo(c) : null;
      const m4 = (n) => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
      ctx.pDet.innerHTML = `
        <div class="bm-form cx-form cl-clasico im-form">
          <div class="cl-banda">Análisis costos de importaciones · del ${esc(fmt.fechaDia(f.desde))} al ${esc(fmt.fechaDia(f.hasta))}</div>
          <div class="pc-lineas im-compras"><table>
            <thead><tr><th class="num">Compra</th><th>Documento</th><th>Fecha docto.</th><th>Proveedor</th><th>Descripción</th><th>Moneda</th><th class="num">T. cambio</th><th class="num">Valor Q</th><th class="num">Gastos Q</th><th class="num">% gasto</th></tr></thead>
            <tbody>${vs.map((x) => { const kk = calculo(x); return `<tr data-compra="${x.id}" class="${x.id === sel ? 'actual' : ''}" tabindex="0"><td class="num fuerte">${x.numero}</td><td>${esc([x.serie, x.documento].filter(Boolean).join('-'))}</td><td>${esc(fmt.fechaDia(x.fecha_documento))}</td><td class="iv-nom"><div>${esc(x.proveedor_nombre || '')}</div></td><td class="iv-nom tk-tenue"><div>${esc(x.descripcion || '')}</div></td><td>${esc(ctx.moneda(x.moneda_id)?.iso || '')}</td><td class="num">${m4(kk.tc)}</td><td class="num">${fmt.monto(kk.totQ)}</td><td class="num">${kk.gQ ? fmt.monto(kk.gQ) : ''}</td><td class="num">${kk.gQ ? `${kk.pct.toFixed(2)} %` : ''}</td></tr>`; }).join('')
              || `<tr><td colspan="10" class="tk-vacio"><i class="ti ti-world-dollar" aria-hidden="true"></i>No hay compras${f.moneda === 'USD' ? ' en dólares' : ''} con esos parámetros.</td></tr>`}</tbody>
          </table></div>
          ${k ? `
          <section class="im-cab">
            <div class="im-doc"><small>Compra</small><b>${c.numero}</b><span>${esc([c.serie, c.documento].filter(Boolean).join('-'))} · ${esc(fmt.fechaDia(c.fecha_documento))} · ${esc(c.proveedor_nombre || '')}</span><span class="tk-tenue">T. cambio ${m4(k.tc)} · ${k.filas.length} línea(s)</span></div>
            <div class="im-gq"><b>Quetzales</b><label class="campo"><span>Gastos extras GTQ</span><input type="number" step="0.01" min="0" data-gasto="Q" value="${r2(k.gQ)}"></label><div class="campo"><span>Gasto por producto</span><b>${fmt.monto(k.porProd)}</b></div><div class="campo"><span>% gasto</span><b>${k.pct.toFixed(2)} %</b></div></div>
            <div class="im-gu"><b>Dólares</b><label class="campo"><span>Gastos extras USD</span><input type="number" step="0.01" min="0" data-gasto="U" value="${r2(k.gU)}"></label><div class="campo"><span>Gasto por producto</span><b>${fmt.monto(k.porProd / k.tc)}</b></div><div class="campo"><span>% gasto</span><b>${k.pct.toFixed(2)} %</b></div></div>
          </section>
          <div class="pc-lineas im-lineas"><table>
            <thead><tr class="im-grupos"><th colspan="4"></th><th colspan="5" class="im-q">Quetzales</th><th colspan="5" class="im-u">Dólares</th></tr>
              <tr><th>Nombre producto</th><th>Lote</th><th>Vence</th><th class="num">Cantidad</th><th class="num im-q">C/U GTQ</th><th class="num im-q">Total GTQ</th><th class="num im-g">Gasto x unidad</th><th class="num im-c">C/U con gasto</th><th class="num im-c">Total con gastos</th>
              <th class="num im-q">C/U USD</th><th class="num im-q">Total USD</th><th class="num im-g">Gasto x unidad</th><th class="num im-c">C/U con gasto</th><th class="num im-c">Total con gastos</th></tr></thead>
            <tbody>${k.filas.map((l) => `<tr><td class="iv-nom" title="${esc(l.nombre)}"><div><b>${esc(l.codigo)}</b> · ${esc(l.nombre)}</div></td><td>${esc(l.serie || '')}</td><td>${esc(fmt.fechaDia(l.fecha_vencimiento))}</td><td class="num">${cant(l.q)}</td>
              <td class="num im-q">${m4(l.cuQ)}</td><td class="num im-q">${fmt.monto(l.totQ)}</td><td class="num im-g">${m4(l.gxuQ)}</td><td class="num im-c">${m4(l.cucgQ)}</td><td class="num im-c fuerte">${fmt.monto(l.tcgQ)}</td>
              <td class="num im-q">${m4(l.cuU)}</td><td class="num im-q">${fmt.monto(l.totU)}</td><td class="num im-g">${m4(l.gxuU)}</td><td class="num im-c">${m4(l.cucgU)}</td><td class="num im-c fuerte">${fmt.monto(l.tcgU)}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="3">Total</td><td class="num">${cant(k.filas.reduce((t, l) => t + l.q, 0))}</td><td></td><td class="num">${fmt.monto(k.totQ)}</td><td></td><td></td><td class="num">${fmt.monto(k.totQ + k.gQ)}</td><td></td><td class="num">${fmt.monto(k.totU)}</td><td></td><td></td><td class="num">${fmt.monto(k.totU + k.gU)}</td></tr></tfoot>
          </table></div>` : ''}
        </div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }

    function reporte(tipo) {
      const dol = f.monedaRep === 'DOLARES', g = f.gastosRep, mon = dol ? 'USD' : 'Q';
      const par = [`Empresa: ${empresaDe(ctx)}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, `Moneda: ${dol ? 'DÓLARES' : 'QUETZALES'}`, `Gastos: ${g ? 'INCLUIDOS' : 'SIN GASTOS'}`, `Proveedor: ${provDe(cat.proveedores, f.proveedor)?.nombre_comercial || 'TODOS'}`];
      const base = { orgId: ctx.sel.org, locId: ctx.sel.loc };
      if (tipo === 'consolidado') {
        const vs = visibles(); if (!vs.length) return window.FIN.aviso('No hay compras con esos parámetros');
        const ks = vs.map(calculo);
        const v = (k) => (dol ? k.totU : k.totQ), gg = (k) => (dol ? k.gU : k.gQ);
        return salida(f.formato, { ...base, titulo: 'Análisis costos de importaciones · Consolidado', parametros: par, hoja: 'Consolidado', archivo: `importaciones_consolidado_${f.hasta}`,
          columnas: [col('Compra', 'texto', 9), col('Documento', 'texto', 18), col('Fecha', 'texto', 11), col('Proveedor', 'texto', 34), col('T. cambio', 'numero', 10), col(`Valor ${mon}`, 'monto', 15), ...(g ? [col(`Gastos ${mon}`, 'monto', 14), col('% gasto', 'numero', 9), col(`Total con gastos ${mon}`, 'monto', 17)] : [])],
          filas: [...ks.map((k) => ({ valores: [String(k.c.numero), [k.c.serie, k.c.documento].filter(Boolean).join('-'), fmt.fechaDia(k.c.fecha_documento), k.c.proveedor_nombre || '', r4(k.tc), r2(v(k)), ...(g ? [r2(gg(k)), r2(k.pct), r2(v(k) + gg(k))] : [])] })),
            { valores: [`Total · ${ks.length} compra(s)`, '', '', '', '', r2(ks.reduce((t, k) => t + v(k), 0)), ...(g ? [r2(ks.reduce((t, k) => t + gg(k), 0)), '', r2(ks.reduce((t, k) => t + v(k) + gg(k), 0))] : [])], tipo: 'total' }] });
      }
      const c = compras.find((x) => x.id === sel); if (!c) return window.FIN.aviso('Elige una compra');
      const k = calculo(c);
      const pc = [...par.slice(0, 4), `Compra: ${c.numero} · ${[c.serie, c.documento].filter(Boolean).join('-')} · ${c.proveedor_nombre || ''}`, `T. cambio: ${r4(k.tc)}`, ...(g ? [`Gastos extras: ${mon} ${fmt.monto(dol ? k.gU : k.gQ)} (${k.pct.toFixed(2)} %)`] : [])];
      const cu = (l) => (dol ? l.cuU : l.cuQ), tot = (l) => (dol ? l.totU : l.totQ), gx = (l) => (dol ? l.gxuU : l.gxuQ), cg = (l) => (dol ? l.cucgU : l.cucgQ), tg = (l) => (dol ? l.tcgU : l.tcgQ);
      if (tipo === 'resumido') {
        const gm = new Map(); k.filas.forEach((l) => { const a = gm.get(l.producto_id) || { codigo: l.codigo, nombre: l.nombre, q: 0, t: 0, tg: 0 }; a.q += l.q; a.t += tot(l); a.tg += tg(l); gm.set(l.producto_id, a); });
        const rs = [...gm.values()];
        return salida(f.formato, { ...base, titulo: `Análisis costo importación · Compra ${c.numero} · Resumido`, parametros: pc, hoja: 'Resumido', archivo: `importacion_${c.numero}_resumido`,
          columnas: [col('Código', 'texto', 13), col('Producto', 'texto', 46), col('Cantidad', 'numero', 11), col(`C/U ${mon}`, 'numero', 12), col(`Total ${mon}`, 'monto', 15), ...(g ? [col(`C/U con gasto ${mon}`, 'numero', 14), col(`Total con gastos ${mon}`, 'monto', 17)] : [])],
          filas: [...rs.map((a) => ({ valores: [a.codigo, a.nombre, r4(a.q), a.q ? r4(a.t / a.q) : '', r2(a.t), ...(g ? [a.q ? r4(a.tg / a.q) : '', r2(a.tg)] : [])] })),
            { valores: ['Total', '', r4(rs.reduce((t, a) => t + a.q, 0)), '', r2(rs.reduce((t, a) => t + a.t, 0)), ...(g ? ['', r2(rs.reduce((t, a) => t + a.tg, 0))] : [])], tipo: 'total' }] });
      }
      return salida(f.formato, { ...base, titulo: `Análisis costo importación · Compra ${c.numero} · Detallado`, parametros: pc, hoja: 'Detallado', archivo: `importacion_${c.numero}_detallado`,
        columnas: [col('Código', 'texto', 12), col('Producto', 'texto', 40), col('Lote', 'texto', 12), col('Vence', 'texto', 11), col('Cantidad', 'numero', 10), col(`C/U ${mon}`, 'numero', 11), col(`Total ${mon}`, 'monto', 14), ...(g ? [col('Gasto x unidad', 'numero', 12), col('C/U con gasto', 'numero', 12), col(`Total con gastos ${mon}`, 'monto', 16)] : [])],
        filas: [...k.filas.map((l) => ({ valores: [l.codigo, l.nombre, l.serie || '', fmt.fechaDia(l.fecha_vencimiento), r4(l.q), r4(cu(l)), r2(tot(l)), ...(g ? [r4(gx(l)), r4(cg(l)), r2(tg(l))] : [])] })),
          { valores: ['Total', '', '', '', r4(k.filas.reduce((t, l) => t + l.q, 0)), '', r2(dol ? k.totU : k.totQ), ...(g ? ['', '', r2((dol ? k.totU + k.gU : k.totQ + k.gQ))] : [])], tipo: 'total' }] });
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (e.target.dataset.gasto) {
        const c = compras.find((x) => x.id === sel); if (!c) return;
        const v = Math.max(0, Number(e.target.value) || 0);
        gastos.set(c.id, r2(e.target.dataset.gasto === 'Q' ? v : v * tcDe(c)));
        return pintar();
      }
      if (cambio !== 'otro') return;
      const n = e.target.name;
      if (!n || !(n in f)) return;
      f[n] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      if (['desde', 'hasta', 'moneda'].includes(n)) return consultar();
      if (['proveedor', 'buscar'].includes(n)) return pintar();
    });
    cont.addEventListener('input', (e) => { if (e.target.name === 'buscar') { f.buscar = e.target.value; pintar(); } });
    cont.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-compra]');
      if (tr) { sel = Number(tr.dataset.compra); return pintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (['detallado', 'resumido', 'consolidado'].includes(a)) return reporte(a);
    });
    iniciar();
  };

  // ===================== Mínimos y máximos =====================
  window.PANTALLAS['minimos-y-maximos'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Mínimos y máximos', icono: 'ti-arrows-vertical', clase: 'bk-movimientos bm-solo cx-rep mm-minmax', grupo: 'Inventarios · Mantenimientos' });
    const { sb } = ctx;
    const f = { bodega: '', proveedor: '', clasificacion: '', estado: '', buscar: '', inactivos: false };
    let productos = [], bodegas = [], exist = [], cat = { proveedores: [], clasificaciones: [] }, cambios = new Map();
    const ESTADOS = { BAJO: ['Bajo mínimo', 'anulada'], SIN: ['Sin existencia', 'anulada'], SOBRE: ['Sobre máximo', 'pendiente'], NORMAL: ['Normal', 'aprobada'], NODEF: ['Sin definir', ''] };

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Bodega</span>${sl('bodega', [['', 'TODAS'], ...bodegas.map((b) => [b.id, `${b.codigo} · ${b.nombre}`])], f.bodega)}</label>
        <label class="campo cx-prov"><span>Proveedor</span><input list="mm-prov" name="proveedor" value="${esc(f.proveedor)}" placeholder="TODOS" autocomplete="off"></label>
        <label class="campo"><span>Clasificación</span>${sl('clasificacion', [['', 'TODAS'], ...cat.clasificaciones.map((c) => [c.id, c.nombre])], f.clasificacion)}</label>
        <label class="campo"><span>Estado</span>${sl('estado', [['', 'TODOS'], ['BAJO', 'BAJO MÍNIMO'], ['SIN', 'SIN EXISTENCIA'], ['SOBRE', 'SOBRE MÁXIMO'], ['NORMAL', 'NORMAL'], ['NODEF', 'SIN DEFINIR']], f.estado)}</label>
        <label class="campo cx-prov"><span>Producto</span><input type="search" name="buscar" value="${esc(f.buscar)}" placeholder="Código, código de barras o nombre" autocomplete="off"></label>
        <label class="pc-check iv-ceros"><input type="checkbox" name="inactivos" ${f.inactivos ? 'checked' : ''}> Incluir inactivos</label>
        <datalist id="mm-prov">${cat.proveedores.map((p) => `<option value="${esc(`${p.nombre_comercial} — ${p.codigo}`)}"></option>`).join('')}</datalist>`,
        `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="guardar"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button>' : ''}
         <button type="button" class="boton secundario-sm" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button>
         <button type="button" class="boton secundario-sm" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>`);
    }
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargarLocalidad(); }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      if (!loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-arrows-vertical'); return; }
      ctx.pDet.innerHTML = '<p class="vacio">Consultando los productos…</p>';
      const [c, p, b, ex] = await Promise.all([
        catalogos(sb, loc),
        leerTodo(() => sb.from('productos').select('id, codigo, codigo_producto, codigo_barras, nombre, estado, minimo, maximo, punto_minimo, precio_costo, proveedor_id, clasificacion_id').eq('localidad_id', loc).order('nombre').order('id')),
        sb.from('bodegas').select('id, codigo, nombre, estado').eq('localidad_id', loc).order('codigo'),
        leerTodo(() => sb.from('existencias').select('producto_id, bodega_id, existencia').eq('localidad_id', loc))
      ]);
      cat = c; productos = p; bodegas = (b.data || []).filter((x) => x.estado === 'ACTIVO'); exist = ex; cambios = new Map();
      pintarFiltros(); pintar();
    }
    const valores = (p) => ({ min: cambios.get(p.id)?.min ?? Number(p.minimo || 0), max: cambios.get(p.id)?.max ?? Number(p.maximo || 0) });
    function filas() {
      const pv = provDe(cat.proveedores, f.proveedor), q = f.buscar.trim().toLowerCase();
      const ex = new Map(); exist.forEach((x) => { if (!f.bodega || String(x.bodega_id) === String(f.bodega)) ex.set(x.producto_id, (ex.get(x.producto_id) || 0) + Number(x.existencia)); });
      return productos.filter((p) => (f.inactivos || p.estado === 'ACTIVO') && (!pv || p.proveedor_id === pv.id) && (!f.clasificacion || String(p.clasificacion_id) === String(f.clasificacion))
          && (!q || [p.codigo, p.codigo_producto, p.codigo_barras, p.nombre].some((v) => String(v || '').toLowerCase().includes(q))))
        .map((p) => { const { min, max } = valores(p); const e = ex.get(p.id) || 0;
          const est = !min && !max ? 'NODEF' : e <= 0 ? 'SIN' : min && e < min ? 'BAJO' : max && e > max ? 'SOBRE' : 'NORMAL';
          const pedir = (est === 'BAJO' || est === 'SIN') ? Math.max(0, (max || min) - e) : 0;
          return { p, min, max, ex: e, est, pedir, costo: Number(p.precio_costo || 0), prov: cat.proveedores.find((x) => x.id === p.proveedor_id)?.nombre_comercial || '', clas: cat.clasificaciones.find((x) => x.id === p.clasificacion_id)?.nombre || '' }; })
        .filter((r) => !f.estado || r.est === f.estado);
    }
    function pintar() {
      const rs = filas();
      const n = (k) => rs.filter((r) => r.est === k).length;
      const ed = ctx.admin ? '' : 'disabled';
      ctx.pDet.innerHTML = `
        <div class="bm-form cx-form cl-clasico">
          <div class="cl-banda">Puntos mínimos y máximos · ${esc(f.bodega ? bodegas.find((b) => String(b.id) === String(f.bodega))?.nombre || '' : 'todas las bodegas')}</div>
          <div class="ec-kpis">${kpi('Productos', rs.length)}${kpi('Bajo mínimo', n('BAJO'), n('BAJO') ? 'ec-alerta' : '')}${kpi('Sin existencia', n('SIN'), n('SIN') ? 'ec-alerta' : '')}${kpi('Sobre máximo', n('SOBRE'))}${kpi('Sin definir', n('NODEF'))}${kpi('Valor a pedir Q', fmt.monto(rs.reduce((t, r) => t + r.pedir * r.costo, 0)), 'ec-fin')}</div>
          <div class="pc-lineas cx-tabla iv-tabla mm-tabla"><table>
            <thead><tr><th class="num">ID</th><th>Código</th><th>Producto</th><th>Proveedor</th><th>Clasificación</th><th class="num">Existencia</th><th class="num">Mínimo</th><th class="num">Máximo</th><th>Estado</th><th class="num">A pedir</th><th class="num">Costo</th><th class="num">Valor a pedir</th></tr></thead>
            <tbody>${rs.map((r) => `<tr data-p="${r.p.id}" class="${cambios.has(r.p.id) ? 'mm-cambio' : ''}"><td class="num">${r.p.codigo}</td><td class="fuerte">${esc(r.p.codigo_producto || '')}</td><td class="iv-nom iv-prod" title="${esc(r.p.nombre)}"><div>${esc(r.p.nombre)}</div></td><td class="iv-nom"><div>${esc(r.prov)}</div></td><td class="iv-nom tk-tenue"><div>${esc(r.clas)}</div></td>
              <td class="num fuerte ${r.ex <= 0 ? 'pc-rojo' : ''}">${cant(r.ex)}</td><td class="num"><input type="number" min="0" step="1" data-m="min" value="${r.min || ''}" ${ed} aria-label="Mínimo"></td><td class="num"><input type="number" min="0" step="1" data-m="max" value="${r.max || ''}" ${ed} aria-label="Máximo"></td>
              <td><span class="pc-marca ${ESTADOS[r.est][1]}">${ESTADOS[r.est][0]}</span></td><td class="num ${r.pedir ? 'fuerte' : 'tk-tenue'}">${r.pedir ? cant(r.pedir) : '—'}</td><td class="num">${fmt.monto(r.costo)}</td><td class="num">${r.pedir ? fmt.monto(r.pedir * r.costo) : ''}</td></tr>`).join('')
              || '<tr><td colspan="12" class="tk-vacio">Ningún producto con esos parámetros.</td></tr>'}</tbody>
            <tfoot><tr><td colspan="9">${rs.length} producto(s)${cambios.size ? ` · <b class="pc-rojo">${cambios.size} cambio(s) sin guardar</b>` : ''}</td><td class="num">${cant(rs.reduce((t, r) => t + r.pedir, 0))}</td><td></td><td class="num">${fmt.monto(rs.reduce((t, r) => t + r.pedir * r.costo, 0))}</td></tr></tfoot>
          </table></div>
        </div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    async function guardar() {
      if (!cambios.size) return window.FIN.aviso('No hay cambios que guardar');
      const mal = [...cambios.entries()].find(([, v]) => v.max && v.min > v.max);
      if (mal) return window.FIN.aviso(`El mínimo de ${productos.find((p) => p.id === mal[0])?.nombre || 'un producto'} es mayor que el máximo`);
      for (const [id, v] of cambios) {
        const r = await sb.from('productos').update({ minimo: v.min || 0, maximo: v.max || 0, punto_minimo: (v.min || 0) > 0 }).eq('id', id);
        if (r.error) return window.FIN.aviso(window.UI.traducirError(r.error));
        const p = productos.find((x) => x.id === id); if (p) { p.minimo = v.min; p.maximo = v.max; }
      }
      window.FIN.aviso(`${cambios.size} producto(s) actualizado(s)`);
      cambios = new Map(); pintar();
    }
    function exportar(formato) {
      const rs = filas(); if (!rs.length) return window.FIN.aviso('No hay productos con esos parámetros');
      salida(formato, { titulo: 'Puntos mínimos y máximos', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Minimos y maximos', archivo: `minimos_maximos_${fmt.hoy()}`,
        parametros: [`Empresa: ${empresaDe(ctx)}`, `Bodega: ${f.bodega ? bodegas.find((b) => String(b.id) === String(f.bodega))?.nombre || '' : 'TODAS'}`, `Proveedor: ${provDe(cat.proveedores, f.proveedor)?.nombre_comercial || 'TODOS'}`, `Clasificación: ${cat.clasificaciones.find((c) => String(c.id) === String(f.clasificacion))?.nombre || 'TODAS'}`, `Estado: ${f.estado ? ESTADOS[f.estado][0].toUpperCase() : 'TODOS'}`, ...(f.buscar ? [`Producto: ${f.buscar}`] : [])],
        columnas: [col('ID', 'texto', 7), col('Código', 'texto', 12), col('Producto', 'texto', 42), col('Proveedor', 'texto', 26), col('Existencia', 'numero', 11), col('Mínimo', 'numero', 9), col('Máximo', 'numero', 9), col('Estado', 'texto', 14), col('A pedir', 'numero', 10), col('Costo', 'monto', 12), col('Valor a pedir', 'monto', 14)],
        filas: [...rs.map((r) => ({ valores: [String(r.p.codigo), r.p.codigo_producto || '', r.p.nombre, r.prov, r4(r.ex), r.min, r.max, ESTADOS[r.est][0], r4(r.pedir), r2(r.costo), r2(r.pedir * r.costo)] })),
          { valores: [`Total · ${rs.length} producto(s)`, '', '', '', '', '', '', '', r4(rs.reduce((t, r) => t + r.pedir, 0)), '', r2(rs.reduce((t, r) => t + r.pedir * r.costo, 0))], tipo: 'total' }] });
    }
    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (e.target.dataset.m) { const id = Number(e.target.closest('tr[data-p]').dataset.p); const p = productos.find((x) => x.id === id); const v = { ...valores(p) }; v[e.target.dataset.m] = Math.max(0, Number(e.target.value) || 0); if (v.min === Number(p.minimo || 0) && v.max === Number(p.maximo || 0)) cambios.delete(id); else cambios.set(id, v); return pintar(); }
      if (cambio !== 'otro') return;
      const n = e.target.name; if (!n || !(n in f)) return;
      f[n] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; pintar();
    });
    cont.addEventListener('input', (e) => { if (e.target.name === 'buscar') { f.buscar = e.target.value; pintar(); ctx.pFil.querySelector('[name=buscar]')?.focus(); } });
    cont.addEventListener('click', (e) => { const a = e.target.closest('[data-accion]')?.dataset.accion; if (a === 'guardar') return guardar(); if (a === 'pdf') return exportar('PDF'); if (a === 'excel') return exportar('EXCEL'); });
    iniciar();
  };

  // ===================== Costos =====================
  window.PANTALLAS.costos = function (cont) {
    const ctx = montar(cont, { titulo: 'Costos de productos', icono: 'ti-coin', clase: 'bk-movimientos bm-solo cx-rep mm-costos', grupo: 'Inventarios · Mantenimientos' });
    const { sb } = ctx;
    const hoy = fmt.hoy();
    const f = { desde: `${Number(hoy.slice(0, 4)) - 1}${hoy.slice(4)}`, hasta: hoy, proveedor: '', clasificacion: '', dif: '', buscar: '', inactivos: false };
    let productos = [], compras = new Map(), cat = { proveedores: [], clasificaciones: [] }, cambios = new Map();

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Compras desde</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Compras hasta</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo cx-prov"><span>Proveedor</span><input list="mc-prov" name="proveedor" value="${esc(f.proveedor)}" placeholder="TODOS" autocomplete="off"></label>
        <label class="campo"><span>Clasificación</span>${sl('clasificacion', [['', 'TODAS'], ...cat.clasificaciones.map((c) => [c.id, c.nombre])], f.clasificacion)}</label>
        <label class="campo"><span>Mostrar</span>${sl('dif', [['', 'TODOS'], ['DIF', 'DIFERENCIA MAYOR A 5 %'], ['SIN', 'SIN COSTO EN CATÁLOGO'], ['COMPRAS', 'CON COMPRAS EN EL PERIODO']], f.dif)}</label>
        <label class="campo cx-prov"><span>Producto</span><input type="search" name="buscar" value="${esc(f.buscar)}" placeholder="Código o nombre" autocomplete="off"></label>
        <datalist id="mc-prov">${cat.proveedores.map((p) => `<option value="${esc(`${p.nombre_comercial} — ${p.codigo}`)}"></option>`).join('')}</datalist>`,
        `${ctx.admin ? `<span class="mc-masivo"><select data-masivo aria-label="Actualizar costo con"><option value="ULTIMO">Último costo</option><option value="PROMEDIO">Costo promedio</option></select><button type="button" class="boton secundario-sm" data-accion="aplicar" title="Pone ese costo en todos los productos visibles que tienen compras">Aplicar a los visibles</button>
          <button type="button" class="boton primario-sm" data-accion="guardar"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button></span>` : ''}
         <button type="button" class="boton secundario-sm" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button>
         <button type="button" class="boton secundario-sm" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>`);
    }
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargarLocalidad(); }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      if (!loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-coin'); return; }
      const [c, p] = await Promise.all([catalogos(sb, loc), leerTodo(() => sb.from('productos').select('id, codigo, codigo_producto, nombre, estado, precio_costo, proveedor_id, clasificacion_id').eq('localidad_id', loc).order('nombre').order('id'))]);
      cat = c; productos = p; cambios = new Map();
      pintarFiltros();
      await consultar();
    }
    async function consultar() {
      ctx.pDet.innerHTML = '<p class="vacio">Consultando las compras…</p>';
      let a;
      try {
        a = await leerTodo(() => sb.from('compra_articulos').select('producto_id, cantidad, costo_total, compras!inner(fecha_documento, proveedor_id, moneda_id, tipo_cambio, estado, localidad_id)')
          .eq('compras.localidad_id', ctx.sel.loc).eq('compras.estado', 'ACTIVA').gte('compras.fecha_documento', f.desde).lte('compras.fecha_documento', f.hasta).not('producto_id', 'is', null).order('id'));
      } catch (e) { ctx.pDet.innerHTML = `<p class="vacio">${esc(window.UI.traducirError(e))}</p>`; return; }
      compras = new Map();
      a.forEach((x) => { const c = x.compras, k = ctx.moneda(c.moneda_id)?.iso && ctx.moneda(c.moneda_id).iso !== 'GTQ' ? Number(c.tipo_cambio) || 1 : 1; const q = Number(x.cantidad), t = Number(x.costo_total) * k; if (!q) return;
        const r = compras.get(x.producto_id) || { n: 0, q: 0, t: 0, ult: null, fult: '', min: Infinity, max: 0 }; const u = t / q;
        r.n++; r.q += q; r.t += t; r.min = Math.min(r.min, u); r.max = Math.max(r.max, u); if (c.fecha_documento >= r.fult) { r.fult = c.fecha_documento; r.ult = u; } compras.set(x.producto_id, r); });
      pintar();
    }
    const costoDe = (p) => cambios.get(p.id) ?? Number(p.precio_costo || 0);
    function filas() {
      const pv = provDe(cat.proveedores, f.proveedor), q = f.buscar.trim().toLowerCase();
      return productos.filter((p) => (f.inactivos || p.estado === 'ACTIVO') && (!pv || p.proveedor_id === pv.id) && (!f.clasificacion || String(p.clasificacion_id) === String(f.clasificacion)) && (!q || [p.codigo, p.codigo_producto, p.nombre].some((v) => String(v || '').toLowerCase().includes(q))))
        .map((p) => { const r = compras.get(p.id); const prom = r ? r.t / r.q : 0, costo = costoDe(p); return { p, r, prom, costo, dif: costo && prom ? ((prom - costo) / costo) * 100 : null, prov: cat.proveedores.find((x) => x.id === p.proveedor_id)?.nombre_comercial || '' }; })
        .filter((x) => !f.dif || (f.dif === 'DIF' ? x.dif !== null && Math.abs(x.dif) > 5 : f.dif === 'SIN' ? !x.costo : !!x.r));
    }
    function pintar() {
      const rs = filas(), ed = ctx.admin ? '' : 'disabled';
      const conDif = rs.filter((x) => x.dif !== null && Math.abs(x.dif) > 5).length;
      ctx.pDet.innerHTML = `
        <div class="bm-form cx-form cl-clasico">
          <div class="cl-banda">Costos de productos · compras del ${esc(fmt.fechaDia(f.desde))} al ${esc(fmt.fechaDia(f.hasta))}</div>
          <div class="ec-kpis">${kpi('Productos', rs.length)}${kpi('Con compras', rs.filter((x) => x.r).length)}${kpi('Diferencia > 5 %', conDif, conDif ? 'ec-alerta' : '')}${kpi('Sin costo', rs.filter((x) => !x.costo).length)}${kpi('Cambios sin guardar', cambios.size, cambios.size ? 'ec-fin' : '')}</div>
          <div class="pc-lineas cx-tabla iv-tabla mm-tabla"><table>
            <thead><tr><th class="num">ID</th><th>Código</th><th>Producto</th><th>Proveedor</th><th class="num">Costo catálogo</th><th class="num">Último costo</th><th>Fecha</th><th class="num">Costo promedio</th><th class="num">Mínimo</th><th class="num">Máximo</th><th class="num">Compras</th><th class="num">Diferencia</th><th></th></tr></thead>
            <tbody>${rs.map((x) => `<tr data-p="${x.p.id}" class="${cambios.has(x.p.id) ? 'mm-cambio' : ''}"><td class="num">${x.p.codigo}</td><td class="fuerte">${esc(x.p.codigo_producto || '')}</td><td class="iv-nom iv-prod" title="${esc(x.p.nombre)}"><div>${esc(x.p.nombre)}</div></td><td class="iv-nom"><div>${esc(x.prov)}</div></td>
              <td class="num"><input type="number" step="0.0001" min="0" data-costo value="${x.costo || ''}" ${ed} aria-label="Costo del catálogo"></td>
              <td class="num">${x.r ? fmt.monto(x.r.ult) : '<span class="tk-tenue">—</span>'}</td><td class="tk-tenue">${esc(fmt.fechaDia(x.r?.fult || ''))}</td><td class="num fuerte">${x.r ? fmt.monto(x.prom) : '<span class="tk-tenue">—</span>'}</td>
              <td class="num tk-tenue">${x.r ? fmt.monto(x.r.min) : ''}</td><td class="num tk-tenue">${x.r ? fmt.monto(x.r.max) : ''}</td><td class="num">${x.r ? x.r.n : ''}</td>
              <td class="num ${x.dif === null ? 'tk-tenue' : Math.abs(x.dif) > 5 ? 'pc-rojo' : 'kx-ent'}">${x.dif === null ? '—' : `${x.dif >= 0 ? '+' : ''}${x.dif.toFixed(1)} %`}</td>
              <td class="mc-usar">${x.r && ctx.admin ? `<button type="button" data-usar="ult" title="Usar el último costo">Últ.</button><button type="button" data-usar="prom" title="Usar el costo promedio">Prom.</button>` : ''}</td></tr>`).join('')
              || '<tr><td colspan="13" class="tk-vacio">Ningún producto con esos parámetros.</td></tr>'}</tbody>
            <tfoot><tr><td colspan="13">${rs.length} producto(s) · la diferencia compara el costo promedio de compras del periodo contra el costo del catálogo</td></tr></tfoot>
          </table></div>
        </div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    function marcar(id, v) { const p = productos.find((x) => x.id === id); const n = r4(Math.max(0, Number(v) || 0)); if (n === Number(p.precio_costo || 0)) cambios.delete(id); else cambios.set(id, n); }
    async function guardar() {
      if (!cambios.size) return window.FIN.aviso('No hay cambios que guardar');
      if (!confirm(`¿Actualizar el costo del catálogo de ${cambios.size} producto(s)?`)) return;
      for (const [id, v] of cambios) {
        const r = await sb.from('productos').update({ precio_costo: v }).eq('id', id);
        if (r.error) return window.FIN.aviso(window.UI.traducirError(r.error));
        const p = productos.find((x) => x.id === id); if (p) p.precio_costo = v;
      }
      window.FIN.aviso(`${cambios.size} costo(s) actualizado(s)`);
      cambios = new Map(); pintar();
    }
    function exportar(formato) {
      const rs = filas(); if (!rs.length) return window.FIN.aviso('No hay productos con esos parámetros');
      salida(formato, { titulo: 'Costos de productos', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Costos', archivo: `costos_productos_${f.hasta}`,
        parametros: [`Empresa: ${empresaDe(ctx)}`, `Compras del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, `Proveedor: ${provDe(cat.proveedores, f.proveedor)?.nombre_comercial || 'TODOS'}`, `Clasificación: ${cat.clasificaciones.find((c) => String(c.id) === String(f.clasificacion))?.nombre || 'TODAS'}`, ...(f.buscar ? [`Producto: ${f.buscar}`] : [])],
        columnas: [col('ID', 'texto', 7), col('Código', 'texto', 12), col('Producto', 'texto', 42), col('Proveedor', 'texto', 26), col('Costo catálogo', 'monto', 14), col('Último costo', 'monto', 13), col('Fecha', 'texto', 11), col('Costo promedio', 'monto', 14), col('Mínimo', 'monto', 12), col('Máximo', 'monto', 12), col('Compras', 'entero', 9), col('Diferencia %', 'numero', 12)],
        filas: rs.map((x) => ({ valores: [String(x.p.codigo), x.p.codigo_producto || '', x.p.nombre, x.prov, r4(x.costo), x.r ? r4(x.r.ult) : '', fmt.fechaDia(x.r?.fult || ''), x.r ? r4(x.prom) : '', x.r ? r4(x.r.min) : '', x.r ? r4(x.r.max) : '', x.r ? x.r.n : '', x.dif === null ? '' : r2(x.dif)] })) });
    }
    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (e.target.matches('[data-costo]')) { marcar(Number(e.target.closest('tr[data-p]').dataset.p), e.target.value); return pintar(); }
      if (e.target.matches('[data-masivo]')) return;
      if (cambio !== 'otro') return;
      const n = e.target.name; if (!n || !(n in f)) return;
      f[n] = e.target.value;
      return ['desde', 'hasta'].includes(n) ? consultar() : pintar();
    });
    cont.addEventListener('input', (e) => { if (e.target.name === 'buscar') { f.buscar = e.target.value; pintar(); ctx.pFil.querySelector('[name=buscar]')?.focus(); } });
    cont.addEventListener('click', (e) => {
      const u = e.target.closest('[data-usar]');
      if (u) { const id = Number(u.closest('tr[data-p]').dataset.p); const r = compras.get(id); marcar(id, u.dataset.usar === 'ult' ? r.ult : r.t / r.q); return pintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'aplicar') { const m = ctx.pFil.querySelector('[data-masivo]').value; let n = 0; filas().forEach((x) => { if (x.r) { marcar(x.p.id, m === 'ULTIMO' ? x.r.ult : x.prom); n++; } }); window.FIN.aviso(`${n} producto(s) con el ${m === 'ULTIMO' ? 'último costo' : 'costo promedio'}: revisa y guarda`); return pintar(); }
      if (a === 'guardar') return guardar();
      if (a === 'pdf') return exportar('PDF');
      if (a === 'excel') return exportar('EXCEL');
    });
    iniciar();
  };
  // Análisis de costos local: la misma pantalla de Compras (compras por producto, promedio, descuentos y bonificaciones).
  window.PANTALLAS['analisis-costos-local'] = (cont, m) => window.PANTALLAS['analisis-costos'](cont, m || { id: 'inventarios' });
})();
