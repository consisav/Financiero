// Reportes de Facturación/Ventas y de Compras (mismo diseño que los de Inventarios):
//   Ventas por período · Ventas por cliente · Cuentas por cobrar · Gráfica de ventas
//   Compras por período · Compras por proveedor · Cuentas por pagar · Gráfica de compras
// Parámetros: organización, localidad, fecha (hoy por defecto; los de período también «desde», el 1 de enero),
// un producto o todos, contenido resumido o detallado y gráficas. Vista previa en pantalla y PDF o Excel con
// las gráficas al final. Montos en quetzales (los documentos en otra moneda se pasan con su tipo de cambio).
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const r4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;
  const cant = (n) => Number(n || 0).toLocaleString('es-GT', { maximumFractionDigits: 4 });
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const diaLocal = (v) => (!v ? '' : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : new Date(v).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }));
  const sumarDias = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + Number(n || 0)); return x.toLocaleDateString('en-CA'); };
  const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5);
  const G = () => window.GRAFICAS;
  const MAX_VISTA = 1500;
  const BANDAS = [['No vencido', (d) => d <= 0], ['1 a 30', (d) => d > 0 && d <= 30], ['31 a 60', (d) => d > 30 && d <= 60], ['61 a 90', (d) => d > 60 && d <= 90], ['Más de 90', (d) => d > 90]];
  const ini = (x) => `${x}T00:00:00-06:00`, fin = (x) => `${x}T23:59:59.999-06:00`;

  // Lado de cada módulo: de dónde se leen los documentos y cómo se llaman las cosas.
  const LADOS = {
    VENTAS: {
      grupo: 'Facturación/Ventas · Reportes', conIva: false, tercero: 'Cliente', terceros: 'Clientes', doc: 'Facturas', verbo: 'Ventas', cxx: 'Cuentas por cobrar',
      camposDoc: 'id, numero, no_interno, serie, numero_dte, fecha_emision, fecha_cobro, dias_credito, cliente_id, cliente_codigo, nombre, nit, moneda_id, tipo_cambio, total, iva, saldo, estado',
      docs: (sb, loc, desde, hasta) => sb.from('facturas_venta').select(LADOS.VENTAS.camposDoc).eq('localidad_id', loc).neq('estado', 'ANULADA').gte('fecha_emision', ini(desde)).lte('fecha_emision', fin(hasta)).order('fecha_emision').order('id'),
      lineas: (sb, loc, desde, hasta, pid) => { let q = sb.from('factura_venta_lineas').select(`id, producto_id, descripcion, cantidad, precio, total, facturas_venta!inner(${LADOS.VENTAS.camposDoc})`).eq('facturas_venta.localidad_id', loc).neq('facturas_venta.estado', 'ANULADA').gte('facturas_venta.fecha_emision', ini(desde)).lte('facturas_venta.fecha_emision', fin(hasta)).order('id'); if (pid) q = q.eq('producto_id', pid); return q; },
      deLinea: (l) => l.facturas_venta,
      norm: (d, k) => ({ id: d.id, fecha: diaLocal(d.fecha_emision), doc: [d.serie, d.numero_dte].filter(Boolean).join('-') || d.no_interno || String(d.numero), tId: d.cliente_id || d.nit || d.nombre, tCod: d.cliente_codigo ?? '', tNom: d.nombre || '', nit: d.nit || '', valor: Number(d.total) * k, iva: Number(d.iva || 0) * k, vence: d.fecha_cobro || sumarDias(diaLocal(d.fecha_emision), d.dias_credito || 0) })
    },
    COMPRAS: {
      grupo: 'Compras · Reportes', conIva: true, tercero: 'Proveedor', terceros: 'Proveedores', doc: 'Compras', verbo: 'Compras', cxx: 'Cuentas por pagar',
      camposDoc: 'id, numero, serie, documento, fecha_documento, fecha_vencimiento, proveedor_id, proveedor_codigo, proveedor_nombre, nit, moneda_id, tipo_cambio, valor_total, iva, estado',
      docs: (sb, loc, desde, hasta) => sb.from('compras').select(LADOS.COMPRAS.camposDoc).eq('localidad_id', loc).eq('estado', 'ACTIVA').gte('fecha_documento', desde).lte('fecha_documento', hasta).order('fecha_documento').order('id'),
      lineas: (sb, loc, desde, hasta, pid) => { let q = sb.from('compra_articulos').select(`id, producto_id, cantidad, costo_unitario, costo_total, compras!inner(${LADOS.COMPRAS.camposDoc})`).eq('compras.localidad_id', loc).eq('compras.estado', 'ACTIVA').gte('compras.fecha_documento', desde).lte('compras.fecha_documento', hasta).order('id'); if (pid) q = q.eq('producto_id', pid); return q; },
      deLinea: (l) => l.compras,
      norm: (d, k) => ({ id: d.id, fecha: d.fecha_documento, doc: [d.serie, d.documento].filter(Boolean).join('-') || String(d.numero), tId: d.proveedor_id || d.nit || d.proveedor_nombre, tCod: d.proveedor_codigo ?? '', tNom: d.proveedor_nombre || '', nit: d.nit || '', valor: Number(d.valor_total) * k, iva: Number(d.iva || 0) * k, vence: d.fecha_vencimiento || d.fecha_documento })
    }
  };

  const REPORTES = {
    'ventas-por-periodo': { lado: 'VENTAS', tipo: 'PERIODO', titulo: 'Ventas por período', icono: 'ti-calendar-stats' },
    'ventas-por-cliente': { lado: 'VENTAS', tipo: 'TERCERO', titulo: 'Ventas por cliente', icono: 'ti-users' },
    'reporte-cuentas-por-cobrar': { lado: 'VENTAS', tipo: 'SALDOS', titulo: 'Cuentas por cobrar', icono: 'ti-cash' },
    'grafica-de-ventas': { lado: 'VENTAS', tipo: 'GRAFICA', titulo: 'Gráfica de ventas', icono: 'ti-chart-histogram' },
    'compras-por-periodo': { lado: 'COMPRAS', tipo: 'PERIODO', titulo: 'Compras por período', icono: 'ti-calendar-stats' },
    'compras-por-proveedor': { lado: 'COMPRAS', tipo: 'TERCERO', titulo: 'Compras por proveedor', icono: 'ti-truck' },
    'reporte-cuentas-por-pagar': { lado: 'COMPRAS', tipo: 'SALDOS', titulo: 'Cuentas por pagar', icono: 'ti-receipt-2' },
    'grafica-de-compras': { lado: 'COMPRAS', tipo: 'GRAFICA', titulo: 'Gráfica de compras', icono: 'ti-chart-histogram' }
  };

  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) { const { data, error } = await hacer().range(i, i + 999); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; }
    return out;
  }

  function reporte(cont, id) {
    const R = REPORTES[id], L = LADOS[R.lado];
    const ctx = montar(cont, { titulo: R.titulo, icono: R.icono, clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: L.grupo });
    const { sb } = ctx;
    const hoy = fmt.hoy();
    const f = { desde: `${hoy.slice(0, 4)}-01-01`, fecha: hoy, producto: '', contenido: R.tipo === 'SALDOS' || R.tipo === 'TERCERO' ? 'RESUMIDO' : 'RESUMIDO', graficas: true };
    let productos = [], datos = null, cargado = '', cfg = null;
    const prod = (pid) => productos.find((p) => p.id === pid);
    const etiqueta = (p) => `${p.nombre} — ${p.codigo_producto || p.codigo}`;
    const empresa = () => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
    const k = (d) => (ctx.moneda(d.moneda_id)?.iso && ctx.moneda(d.moneda_id).iso !== 'GTQ' ? Number(d.tipo_cambio) || 1 : 1);
    const conPeriodo = R.tipo !== 'SALDOS';

    function pintarFiltros() {
      const p = f.producto ? prod(Number(f.producto)) : null;
      ctx.filtros(`${conPeriodo ? `<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}" max="${f.fecha}"></label>` : ''}
        <label class="campo"><span>${conPeriodo ? 'Al' : 'Saldo al'}</span><input type="date" name="fecha" value="${f.fecha}" max="${hoy}"></label>
        <label class="campo cx-prov pr-prod"><span>Producto</span><input name="producto" list="rc-prods" value="${esc(p ? etiqueta(p) : '')}" placeholder="Todos los productos" autocomplete="off"></label>
        ${R.tipo !== 'GRAFICA' ? `<label class="campo"><span>Contenido</span><select name="contenido">${[['RESUMIDO', 'Resumido'], ['DETALLADO', 'Detallado']].map(([x, t]) => `<option value="${x}" ${f.contenido === x ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
        <label class="pc-check"><input type="checkbox" name="graficas" ${f.graficas ? 'checked' : ''}> Gráficas</label>
        <datalist id="rc-prods">${productos.map((x) => `<option value="${esc(etiqueta(x))}"></option>`).join('')}</datalist>`,
        `<button type="button" class="boton secundario-sm" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button>
         <button type="button" class="boton secundario-sm" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>`);
    }
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargarLocalidad(); }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc; f.producto = ''; cargado = '';
      if (!loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', R.icono); return; }
      productos = await leerTodo(() => sb.from('productos').select('id, codigo, codigo_producto, nombre').eq('localidad_id', loc).order('nombre')).catch(() => []);
      pintarFiltros(); await consultar();
    }

    // Documentos del período (o con el producto: sus líneas) normalizados.
    async function consultar() {
      const clave = `${ctx.sel.loc}|${f.desde}|${f.fecha}|${f.producto}`;
      if (clave !== cargado) {
        ctx.pDet.innerHTML = `<p class="vacio">Leyendo ${R.tipo === 'SALDOS' ? 'los saldos' : 'los documentos'}…</p>`;
        try { datos = R.tipo === 'SALDOS' ? await leerSaldos() : await leerPeriodo(); cargado = clave; }
        catch (e) { ctx.pDet.innerHTML = `<p class="vacio">${esc(window.UI.traducirError(e))}</p>`; return; }
      }
      cfg = construir(); pintar();
    }
    async function leerPeriodo() {
      const loc = ctx.sel.loc, pid = f.producto ? Number(f.producto) : null;
      const out = { regs: [], lineas: [] };
      if (pid || R.tipo === 'GRAFICA') {
        const ls = await leerTodo(() => L.lineas(sb, loc, f.desde, f.fecha, pid));
        out.lineas = ls.map((l) => { const d = L.deLinea(l); const kk = k(d); const cantidad = Number(l.cantidad) || 0; const valor = Number(l.total ?? l.costo_total) * kk;
          return { ...L.norm(d, kk), producto_id: l.producto_id, nomProd: prod(l.producto_id)?.nombre || l.descripcion || `Producto ${l.producto_id ?? ''}`, cantidad, valor, iva: 0, precio: cantidad ? valor / cantidad : 0 }; });
      }
      if (pid) out.regs = out.lineas;
      else out.regs = (await leerTodo(() => L.docs(sb, loc, f.desde, f.fecha))).map((d) => ({ ...L.norm(d, k(d)), cantidad: null }));
      return out;
    }
    // Saldo a la fecha = saldo actual + lo cobrado/pagado después de la fecha (y notas posteriores en ventas).
    async function leerSaldos() {
      const loc = ctx.sel.loc, al = f.fecha;
      let docs, despues = new Map();
      const sumar = (id, v) => despues.set(id, (despues.get(id) || 0) + v);
      if (R.lado === 'VENTAS') {
        const [fs, pg, nt] = await Promise.all([
          leerTodo(() => sb.from('facturas_venta').select(L.camposDoc).eq('localidad_id', loc).neq('estado', 'ANULADA').lte('fecha_emision', fin(al)).order('fecha_emision').order('id')),
          leerTodo(() => sb.from('factura_venta_pagos').select('id, factura_id, valor, facturas_venta!inner(localidad_id)').eq('facturas_venta.localidad_id', loc).gt('fecha', fin(al)).order('id')),
          leerTodo(() => sb.from('notas_venta').select('id, factura_id, tipo, valor').eq('localidad_id', loc).neq('estado', 'ANULADA').not('factura_id', 'is', null).gt('fecha_emision', fin(al)).order('id'))
        ]);
        pg.forEach((x) => sumar(x.factura_id, Number(x.valor)));
        nt.forEach((x) => sumar(x.factura_id, x.tipo === 'DÉBITO' ? -Number(x.valor) : Number(x.valor)));
        docs = fs.map((d) => ({ d, saldo: Math.max(0, r2(Number(d.saldo || 0) + (despues.get(d.id) || 0))) }));
      } else {
        const cs = await leerTodo(() => sb.from('compras_saldo').select(`${L.camposDoc}, neto, pendiente`).eq('localidad_id', loc).eq('estado', 'ACTIVA').lte('fecha_documento', al).order('fecha_documento').order('id'));
        const ids = cs.map((x) => x.id);
        for (let i = 0; i < ids.length; i += 300) {
          const ab = await leerTodo(() => sb.from('compra_abonos').select('compra_id, valor').in('compra_id', ids.slice(i, i + 300)).gt('fecha', al).order('compra_id'));
          ab.forEach((x) => sumar(x.compra_id, Number(x.valor)));
        }
        docs = cs.map((d) => ({ d, saldo: Math.max(0, r2(Number(d.pendiente || 0) + (despues.get(d.id) || 0))) }));
      }
      let ids = null;
      if (f.producto) ids = new Set((await leerTodo(() => L.lineas(sb, loc, '2000-01-01', al, Number(f.producto)))).map((l) => L.deLinea(l).id));
      return { regs: docs.filter((x) => x.saldo > 0.004 && (!ids || ids.has(x.d.id))).map(({ d, saldo }) => { const kk = k(d); const n = L.norm(d, kk); const dias = n.vence ? diasEntre(n.vence, al) : 0; return { ...n, saldo: saldo * kk, dias }; }) };
    }

    const parametros = (extra = []) => [`Empresa: ${empresa()}`, conPeriodo ? `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.fecha)}` : `Saldo al ${fmt.fechaDia(f.fecha)}`,
      `Producto: ${f.producto ? etiqueta(prod(Number(f.producto))) : 'Todos'}`, ...extra];
    const agrupar = (xs, key) => { const m = new Map(); xs.forEach((x) => { const kk = key(x); const a = m.get(kk) || []; a.push(x); m.set(kk, a); }); return m; };
    const suma = (xs, c) => xs.reduce((t, x) => t + (Number(x[c]) || 0), 0);
    const mesDe = (x) => x.fecha.slice(0, 7);
    const mesTxt = (ym) => `${MES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
    const top = (xs, n = 10) => [...xs].sort((a, b) => b.valor - a.valor).slice(0, n);
    const meses = () => { const out = []; let d = f.desde.slice(0, 7); const h = f.fecha.slice(0, 7); while (d <= h && out.length < 60) { out.push(d); const [y, m] = d.split('-').map(Number); d = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; } return out; };

    function construir() {
      const regs = datos.regs, conProd = !!f.producto, det = f.contenido === 'DETALLADO';
      const base = { titulo: R.titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: R.titulo.slice(0, 30), archivo: `${id}_${f.fecha}` };
      const total = suma(regs, 'valor'), nDocs = new Set(regs.map((x) => x.id)).size;
      const colsDet = [col('Fecha', 'texto', 11), col('Documento', 'texto', 20), col(L.tercero, 'texto', 40), col('NIT', 'texto', 13), ...(conProd ? [col('Cantidad', 'numero', 11), col('Precio prom.', 'monto', 13)] : L.conIva ? [col('IVA Q', 'monto', 13)] : []), col('Valor Q', 'monto', 15)];
      const filaDet = (x) => ({ valores: [fmt.fechaDia(x.fecha), x.doc, x.tNom, x.nit, ...(conProd ? [r4(x.cantidad), r2(x.precio)] : L.conIva ? [r2(x.iva)] : []), r2(x.valor)] });
      const subDet = (t, xs) => ({ valores: [t, '', '', '', ...(conProd ? [r4(suma(xs, 'cantidad')), ''] : L.conIva ? [r2(suma(xs, 'iva'))] : []), r2(suma(xs, 'valor'))], tipo: 'subtotal' });
      const kpisBase = [[L.doc, nDocs], [`Total ${L.verbo.toLowerCase()}`, `Q ${fmt.monto(total)}`, 'ec-fin'], ...(conProd ? [['Cantidad', cant(suma(regs, 'cantidad'))]] : L.conIva ? [['IVA', `Q ${fmt.monto(suma(regs, 'iva'))}`]] : []), ['Promedio por documento', `Q ${fmt.monto(nDocs ? total / nDocs : 0)}`]];
      const porMes = agrupar(regs, mesDe), ms = meses();
      const grafMeses = () => G().columnas(`${L.verbo} por mes (Q)`, ms.map((m) => MES[Number(m.slice(5, 7)) - 1].slice(0, 3) + (ms.length > 12 ? ` ${m.slice(2, 4)}` : '')), [{ nombre: L.verbo, color: G().COLORES.AZUL, valores: ms.map((m) => suma(porMes.get(m) || [], 'valor')) }], (v) => fmt.monto(v).replace(/\.00$/, ''));
      const porTer = [...agrupar(regs, (x) => x.tId)].map(([, xs]) => ({ cod: xs[0].tCod, nom: xs[0].tNom, nit: xs[0].nit, xs, valor: suma(xs, 'valor') })).sort((a, b) => b.valor - a.valor);
      const grafTer = () => G().barras(`${L.terceros} principales (10)`, porTer.slice(0, 10).map((t) => ({ etiqueta: t.nom, valor: t.valor, texto: `Q ${fmt.monto(t.valor)} · ${total ? ((t.valor / total) * 100).toFixed(1) : 0} %` })));

      if (R.tipo === 'PERIODO') {
        if (det) {
          const filas = [];
          ms.forEach((m) => { const xs = porMes.get(m); if (!xs) return; filas.push({ valores: [mesTxt(m)], tipo: 'grupo', combinar: true }); xs.forEach((x) => filas.push(filaDet(x))); filas.push(subDet(`Total ${mesTxt(m)} (${xs.length})`, xs)); });
          filas.push({ ...subDet(`Total del período (${regs.length})`, regs), tipo: 'total' });
          return { ...base, parametros: parametros(['Detallado']), columnas: colsDet, filas, n: regs.length, kpis: kpisBase, graficas: [grafMeses()] };
        }
        const filas = ms.map((m) => { const xs = porMes.get(m) || []; const v = suma(xs, 'valor');
          return { valores: [mesTxt(m), new Set(xs.map((x) => x.id)).size, ...(conProd ? [r4(suma(xs, 'cantidad'))] : L.conIva ? [r2(suma(xs, 'iva'))] : []), r2(v), total ? v / total : 0] }; });
        filas.push({ valores: ['Total del período', nDocs, ...(conProd ? [r4(suma(regs, 'cantidad'))] : L.conIva ? [r2(suma(regs, 'iva'))] : []), r2(total), total ? 1 : 0], tipo: 'total' });
        return { ...base, parametros: parametros(['Resumido por mes']), n: regs.length, kpis: kpisBase, graficas: [grafMeses()], filas,
          columnas: [col('Mes', 'texto', 20), col(L.doc, 'entero', 11), ...(conProd ? [col('Cantidad', 'numero', 12)] : L.conIva ? [col('IVA Q', 'monto', 14)] : []), col('Valor Q', 'monto', 16), col('% del total', 'porcentaje', 11)] };
      }
      if (R.tipo === 'TERCERO') {
        if (det) {
          const filas = [];
          porTer.forEach((t) => { filas.push({ valores: [`${t.cod ? `${t.cod} · ` : ''}${t.nom}${t.nit ? ` · NIT ${t.nit}` : ''}`], tipo: 'grupo', combinar: true }); t.xs.forEach((x) => filas.push(filaDet(x))); filas.push(subDet(`Total ${L.tercero.toLowerCase()} (${t.xs.length})`, t.xs)); });
          filas.push({ ...subDet(`Total general (${regs.length})`, regs), tipo: 'total' });
          return { ...base, parametros: parametros(['Detallado']), columnas: colsDet, filas, n: regs.length, kpis: [[L.terceros, porTer.length], ...kpisBase], graficas: [grafTer()] };
        }
        const filas = porTer.map((t) => ({ valores: [String(t.cod ?? ''), t.nom, t.nit, new Set(t.xs.map((x) => x.id)).size, ...(conProd ? [r4(suma(t.xs, 'cantidad'))] : []), r2(t.valor), total ? t.valor / total : 0] }));
        filas.push({ valores: [`Total (${porTer.length} ${L.terceros.toLowerCase()})`, '', '', nDocs, ...(conProd ? [r4(suma(regs, 'cantidad'))] : []), r2(total), total ? 1 : 0], tipo: 'total' });
        return { ...base, parametros: parametros(['Resumido por ' + L.tercero.toLowerCase()]), n: regs.length, kpis: [[L.terceros, porTer.length], ...kpisBase], graficas: [grafTer()], filas,
          columnas: [col('Código', 'texto', 10), col(L.tercero, 'texto', 44), col('NIT', 'texto', 13), col(L.doc, 'entero', 10), ...(conProd ? [col('Cantidad', 'numero', 12)] : []), col('Valor Q', 'monto', 16), col('% del total', 'porcentaje', 11)] };
      }
      if (R.tipo === 'SALDOS') {
        const tot = suma(regs, 'saldo');
        const bandas = BANDAS.map(([t, en]) => ({ t, v: suma(regs.filter((x) => en(x.dias)), 'saldo') }));
        const ters = [...agrupar(regs, (x) => x.tId)].map(([, xs]) => ({ cod: xs[0].tCod, nom: xs[0].tNom, nit: xs[0].nit, xs, saldo: suma(xs, 'saldo'), mora: Math.max(...xs.map((x) => x.dias)) })).sort((a, b) => b.saldo - a.saldo);
        const graficas = [G().barras('Antigüedad de saldos (Q)', bandas.map((b) => ({ etiqueta: b.t, valor: b.v, texto: `Q ${fmt.monto(b.v)} · ${tot ? ((b.v / tot) * 100).toFixed(1) : 0} %` }))),
          G().barras(`${L.terceros} con mayor saldo (10)`, ters.slice(0, 10).map((t) => ({ etiqueta: t.nom, valor: t.saldo, texto: `Q ${fmt.monto(t.saldo)}` })), G().COLORES.NARANJA)];
        const kpis = [[L.terceros, ters.length], [L.doc + ' con saldo', regs.length], ['Saldo total', `Q ${fmt.monto(tot)}`, 'ec-fin'], ['Vencido', `Q ${fmt.monto(tot - bandas[0].v)}`, tot - bandas[0].v > 0 ? 'ec-alerta' : ''], ['Más de 90 días', `Q ${fmt.monto(bandas[4].v)}`, bandas[4].v > 0 ? 'ec-alerta' : '']];
        if (det) {
          const filas = [];
          ters.forEach((t) => { filas.push({ valores: [`${t.cod ? `${t.cod} · ` : ''}${t.nom}${t.nit ? ` · NIT ${t.nit}` : ''}`], tipo: 'grupo', combinar: true });
            [...t.xs].sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach((x) => filas.push({ valores: [x.doc, fmt.fechaDia(x.fecha), fmt.fechaDia(x.vence), x.dias > 0 ? x.dias : 0, r2(x.valor), r2(x.saldo)], resaltar: x.dias > 90 }));
            filas.push({ valores: [`Total ${L.tercero.toLowerCase()} (${t.xs.length})`, '', '', '', r2(suma(t.xs, 'valor')), r2(t.saldo)], tipo: 'subtotal' }); });
          filas.push({ valores: [`Total general (${regs.length})`, '', '', '', r2(suma(regs, 'valor')), r2(tot)], tipo: 'total' });
          return { ...base, parametros: parametros(['Detallado', 'Días de mora desde el vencimiento']), n: regs.length, kpis, graficas, filas,
            columnas: [col('Documento', 'texto', 20), col('Fecha', 'texto', 11), col('Vence', 'texto', 11), col('Días mora', 'entero', 10), col('Valor Q', 'monto', 15), col('Saldo Q', 'monto', 15)] };
        }
        const filas = ters.map((t) => ({ valores: [String(t.cod ?? ''), t.nom, t.xs.length, ...BANDAS.map(([, en]) => r2(suma(t.xs.filter((x) => en(x.dias)), 'saldo')) || ''), r2(t.saldo)], resaltar: t.mora > 90 }));
        filas.push({ valores: [`Total (${ters.length})`, '', regs.length, ...bandas.map((b) => r2(b.v)), r2(tot)], tipo: 'total' });
        return { ...base, parametros: parametros(['Resumido · antigüedad de saldos']), n: regs.length, kpis, graficas, filas,
          columnas: [col('Código', 'texto', 10), col(L.tercero, 'texto', 40), col(L.doc, 'entero', 9), ...BANDAS.map(([t]) => col(t, 'monto', 13)), col('Saldo Q', 'monto', 15)] };
      }
      // Gráfica: datos por mes y las gráficas de meses, terceros y productos.
      const lin = datos.lineas;
      const porProd = [...agrupar(lin, (x) => x.producto_id || x.nomProd)].map(([, xs]) => ({ etiqueta: xs[0].nomProd, valor: suma(xs, 'valor'), cantidad: suma(xs, 'cantidad') })).sort((a, b) => b.valor - a.valor);
      const filas = ms.map((m) => { const xs = porMes.get(m) || []; const v = suma(xs, 'valor'); return { valores: [mesTxt(m), new Set(xs.map((x) => x.id)).size, r2(v), total ? v / total : 0] }; });
      filas.push({ valores: ['Total', nDocs, r2(total), total ? 1 : 0], tipo: 'total' });
      return { ...base, parametros: parametros(), n: regs.length, kpis: kpisBase, filas,
        columnas: [col('Mes', 'texto', 20), col(L.doc, 'entero', 11), col('Valor Q', 'monto', 16), col('% del total', 'porcentaje', 11)],
        graficas: [grafMeses(), grafTer(), ...(conProd ? [] : [G().barras('Productos principales (10)', porProd.slice(0, 10).map((p) => ({ ...p, texto: `Q ${fmt.monto(p.valor)} · ${cant(p.cantidad)} u.` })), G().COLORES.VERDE)])] };
    }

    const graficasDe = (c) => (c.graficas || []).filter(Boolean);
    function celda(v, c) {
      if (v === '' || v == null) return '<td></td>';
      if (typeof v === 'number') return `<td class="num">${c.tipo === 'monto' ? fmt.monto(v) : c.tipo === 'porcentaje' ? `${(v * 100).toFixed(1)} %` : c.tipo === 'entero' ? v.toLocaleString('es-GT') : cant(v)}</td>`;
      return `<td>${esc(String(v))}</td>`;
    }
    function pintar() {
      const c = cfg, n = c.columnas.length, vista = c.filas.slice(0, MAX_VISTA);
      const gs = f.graficas ? graficasDe(c) : [];
      ctx.pDet.innerHTML = `
        <div class="bm-form cx-form cl-clasico">
          <div class="cl-banda">${esc(R.titulo)} · ${esc(c.parametros.slice(0, 3).join(' · '))}</div>
          <div class="ec-kpis">${c.kpis.map(([t, v, cls]) => kpi(t, v, cls)).join('')}</div>
          <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table>
            <thead><tr>${c.columnas.map((x) => `<th class="${x.tipo === 'texto' ? '' : 'num'}">${esc(x.titulo)}</th>`).join('')}</tr></thead>
            <tbody>${c.n ? vista.map((r) => (r.tipo === 'grupo' ? `<tr class="pr-g"><td colspan="${n}">${esc(r.valores[0])}</td></tr>`
              : `<tr class="${r.tipo === 'subtotal' ? 'pr-s' : r.tipo === 'total' ? 'pr-t' : ''}${r.resaltar ? ' pr-alerta' : ''}">${c.columnas.map((x, i) => celda(r.valores[i], x)).join('')}</tr>`)).join('')
              : `<tr><td colspan="${n}" class="tk-vacio">No hay ${R.tipo === 'SALDOS' ? 'saldos' : 'documentos'} con esos parámetros.</td></tr>`}
              ${c.filas.length > MAX_VISTA ? `<tr><td colspan="${n}" class="tk-vacio">Vista previa de ${MAX_VISTA} de ${c.filas.length} renglones: el PDF y el Excel llevan el reporte completo.</td></tr>` : ''}</tbody>
          </table>${gs.length && c.n ? `<section class="pr-graficas"><h3><i class="ti ti-chart-bar" aria-hidden="true"></i> Gráficas</h3>${gs.join('')}</section>` : ''}</div>
        </div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    function exportar(formato) {
      if (!cfg || !cfg.n) return window.FIN.aviso('No hay información con esos parámetros');
      const gs = f.graficas ? graficasDe(cfg) : [];
      if (formato === 'PDF') return window.CUENTAS_XLSX.pdf({ ...cfg, graficas: gs.join('') });
      Promise.all(gs.map((g) => G().png(g))).then((imagenes) => window.REPORTE_XLSX.generar({ ...cfg, imagenes })).catch((e) => window.FIN.aviso(e.message || 'No se pudo generar el Excel'));
    }
    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      const n = e.target.name;
      if (n === 'desde' || n === 'fecha') { f[n] = e.target.value || (n === 'fecha' ? hoy : f.desde); if (f.desde > f.fecha) f.desde = `${f.fecha.slice(0, 4)}-01-01`; pintarFiltros(); return consultar(); }
      if (n === 'contenido') { f.contenido = e.target.value; cfg = construir(); return pintar(); }
      if (n === 'graficas') { f.graficas = e.target.checked; return pintar(); }
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
  window.REPORTES_COMERCIALES = REPORTES;
})();
