// Facturación/Ventas · Procesos · Cuentas x Cobrar · Antigüedad de Saldos de clientes.
//   Saldo de cada factura a una fecha de corte (saldo actual + cobros y notas de crédito posteriores − notas de débito
//   posteriores), repartido por días de mora: Vigente, 1-30, 31-60, 61-90 y 91 o más.
//   Parámetros: saldo al, cliente, tipo de cliente, tipo de fecha (vence: estimada de cobro o emisión), período de
//   vencimiento, contenido (detallado o resumido) y orden. Vista en pantalla, PDF y Excel con el formato del reporte
//   clásico: por cliente (código, nombre, correo y días de crédito), sus facturas y el total del cliente.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const BANDAS = [['VIGENTE', 'Vigente'], ['B30', '1 - 30'], ['B60', '31 - 60'], ['B90', '61 - 90'], ['B91', '91 o más']];
  const PERIODOS = [['TODOS', 'TODOS'], ['VENCIDO', 'TODO LO VENCIDO'], ['VIGENTE', 'VIGENTE (sin mora)'], ['B30', '1 - 30 DÍAS'], ['B60', '31 - 60 DÍAS'], ['B90', '61 - 90 DÍAS'], ['B91', '91 O MÁS DÍAS']];
  const ORDENES = [['codigo', 'CÓDIGO'], ['nombre', 'NOMBRE'], ['saldo', 'SALDO'], ['mora', 'MAYOR MORA']];
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const diaLocal = (v) => (!v ? '' : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : new Date(v).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }));
  const sumar = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + Number(n || 0)); return x.toLocaleDateString('en-CA'); };
  const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
  const banda = (mora) => (mora <= 0 ? 'VIGENTE' : mora <= 30 ? 'B30' : mora <= 60 ? 'B60' : mora <= 90 ? 'B90' : 'B91');
  const docTxt = (x) => (x.serie && x.numero_dte ? `${x.serie}-${x.numero_dte}` : x.no_interno || `FE-${x.numero}`);

  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await hacer().range(i, i + 999);
      if (error) throw error;
      out.push(...(data || [])); if (!data || data.length < 1000) break;
    }
    return out;
  }

  window.PANTALLAS['cxc-antiguedad'] = function (cont, m, directo) {
    const sinPantalla = !cont && directo && directo.ctx;
    const ctx = sinPantalla ? directo.ctx : montar(cont, { titulo: 'Antigüedad de Saldos', icono: 'ti-hourglass', clase: 'bk-movimientos bm-solo cx-rep cx-antiguedad', grupo: 'Ventas · Procesos' });
    const { sb } = ctx;
    const hoy = fmt.hoy();
    const f = { corte: hoy, cliente: '', terceroKey: '', tipo: '', fecha: 'ESTIMADA', periodo: 'TODOS', contenido: 'DETALLADO', orden: 'codigo', dir: 'ASC', ...((sinPantalla && directo.f) || {}) };
    const mostrar = (html) => { if (!sinPantalla) ctx.pDet.innerHTML = html; };
    let clientes = [], tipos = [], facturas = [], despues = new Map(), cargado = '', turno = 0;
    const cli = (id) => clientes.find((c) => c.id === id);
    const etiquetaCli = (c) => (c.codigo !== '' && c.codigo != null ? `${c.codigo} · ${c.nombre}` : c.nombre);
    const cliDe = () => clientes.find((c) => etiquetaCli(c) === f.cliente.trim()) || null;
    const empresaTxt = () => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
    const enQ = (x) => (ctx.moneda(x.moneda_id)?.iso && ctx.moneda(x.moneda_id).iso !== 'GTQ' ? Number(x.tipo_cambio) || 1 : 1);
    const txt = (lista, v) => (lista.find(([k]) => k === v) || ['', v])[1];

    function pintarFiltros() {
      const sl = (n, ops, val) => `<select name="${n}">${ops.map(([x, t]) => `<option value="${esc(x)}" ${String(val) === String(x) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
      ctx.filtros(`
        <label class="campo"><span>Saldo al</span><input type="date" name="corte" value="${f.corte}" max="${hoy}"></label>
        <label class="campo cx-prov"><span>Cliente</span><input type="search" name="cliente" autocomplete="off" value="${esc(f.cliente)}" placeholder="TODOS · escribe o elige (${clientes.length.toLocaleString('es-GT')})"></label>
        <label class="campo"><span>Tipo cliente</span>${sl('tipo', [['', 'TODOS'], ...tipos.map((t) => [t, t])], f.tipo)}</label>
        <label class="campo"><span>Vence según</span>${sl('fecha', [['ESTIMADA', 'ESTIMADA COBRO'], ['EMISION', 'EMISIÓN']], f.fecha)}</label>
        <label class="campo"><span>Período de vencimiento</span>${sl('periodo', PERIODOS, f.periodo)}</label>
        <label class="campo"><span>Contenido</span>${sl('contenido', [['DETALLADO', 'DETALLADO'], ['RESUMIDO', 'RESUMIDO']], f.contenido)}</label>
        <label class="campo"><span>Ordenar por</span>${sl('orden', ORDENES, f.orden)}</label>
        <label class="campo"><span>Orden</span>${sl('dir', [['ASC', 'ASCENDENTE'], ['DESC', 'DESCENDENTE']], f.dir)}</label>`,
        `<button type="button" class="boton secundario-sm bca-pdf" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button>
         <button type="button" class="boton cqc-excel" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>`);
      window.UI.autocompletar(ctx.pFil.querySelector('[name=cliente]'), () => clientes.map((c) => ({ valor: etiquetaCli(c), texto: etiquetaCli(c), detalle: [c.documento ? `NIT ${c.documento}` : '', c.tipo_cliente || ''].filter(Boolean).join(' · ') })));
    }

    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargarLocalidad(); }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      f.cliente = ''; f.tipo = ''; cargado = '';
      clientes = loc ? await window.UI.clientesConVentas(sb, loc, 'id, codigo, nombre, documento, correo, dias_credito, tipo_cliente').catch(() => []) : [];
      tipos = [...new Set(clientes.map((c) => c.tipo_cliente).filter(Boolean))].sort();
      pintarFiltros();
      await consultar();
    }

    // Facturas emitidas hasta el corte con saldo hoy o con cobros/notas después del corte.
    async function consultar() {
      const loc = ctx.sel.loc;
      if (!loc) { mostrar(ctx.vacio ? ctx.vacio('Elige la empresa.', 'ti-hourglass') : ''); return; }
      const clave = `${loc}|${f.corte}`;
      if (clave === cargado) return sinPantalla ? null : pintar();
      const t = ++turno;
      mostrar('<p class="vacio">Calculando la antigüedad de saldos…</p>');
      try {
        const fin = `${f.corte}T23:59:59.999-06:00`;
        const m = new Map();
        const suma = (id, v) => m.set(id, (m.get(id) || 0) + v);
        if (f.corte < hoy) {
          const [pg, nt] = await Promise.all([
            leerTodo(() => sb.from('factura_venta_pagos').select('id, factura_id, valor, facturas_venta!inner(localidad_id)').eq('facturas_venta.localidad_id', loc).gt('fecha', fin).order('id')),
            leerTodo(() => sb.from('notas_venta').select('id, factura_id, tipo, valor').eq('localidad_id', loc).neq('estado', 'ANULADA').not('factura_id', 'is', null).gt('fecha_emision', fin).order('id'))
          ]);
          pg.forEach((p) => suma(p.factura_id, Number(p.valor || 0)));
          nt.forEach((n) => suma(n.factura_id, n.tipo === 'DÉBITO' ? -Number(n.valor || 0) : Number(n.valor || 0)));
        }
        const campos = 'id, numero, no_interno, serie, numero_dte, fecha_emision, fecha_cobro, dias_credito, cliente_id, cliente_codigo, nombre, nit, moneda_id, tipo_cambio, total, saldo';
        const conSaldo = await leerTodo(() => sb.from('facturas_venta').select(campos).eq('localidad_id', loc).neq('estado', 'ANULADA').lte('fecha_emision', fin).gt('saldo', 0).order('id'));
        const faltan = [...m.keys()].filter((id) => !conSaldo.some((x) => x.id === id));
        const extra = [];
        for (let i = 0; i < faltan.length; i += 300) extra.push(...await leerTodo(() => sb.from('facturas_venta').select(campos).in('id', faltan.slice(i, i + 300)).neq('estado', 'ANULADA').lte('fecha_emision', fin).order('id')));
        if (t !== turno) return;
        facturas = [...conSaldo, ...extra]; despues = m; cargado = clave;
      } catch (e) { if (sinPantalla) throw e; if (t === turno) mostrar(`<p class="vacio">${esc(window.UI.traducirError(e))}</p>`); return; }
      if (!sinPantalla) pintar();
    }

    // Documentos con saldo al corte, su mora y su banda; agrupados por cliente.
    function calcular() {
      const c = f.terceroKey ? (f.terceroKey.startsWith('C') ? cli(Number(f.terceroKey.slice(1))) || null : null) : cliDe();
      const nitKey = f.terceroKey && f.terceroKey.startsWith('N') ? f.terceroKey.slice(1) : '';
      const docs = facturas.map((x) => {
        const cl = cli(x.cliente_id) || (x.cliente_codigo != null ? clientes.find((k) => k.id && String(k.codigo) === String(x.cliente_codigo)) : null);
        const saldo = r2((Number(x.saldo || 0) + (despues.get(x.id) || 0)) * enQ(x));
        const emision = diaLocal(x.fecha_emision);
        const vence = f.fecha === 'EMISION' ? emision : x.fecha_cobro || sumar(emision, x.dias_credito ?? cl?.dias_credito ?? 0);
        const mora = Math.max(0, diasEntre(vence, f.corte));
        return { id: x.id, doc: docTxt(x), emision, vence, mora, banda: banda(mora), saldo, cliente_id: x.cliente_id || cl?.id || null, codigo: cl?.codigo ?? x.cliente_codigo ?? '', nombre: cl?.nombre || x.nombre || '', correo: cl?.correo || '', dias: cl?.dias_credito ?? x.dias_credito ?? 0, tipo: cl?.tipo_cliente || '', nit: cl?.documento || x.nit || '' };
      }).filter((d) => d.saldo > 0.004
        && (!nitKey || (!d.cliente_id && String(d.nit || 'CF').toUpperCase() === nitKey))
        && (!f.terceroKey || nitKey || !c || window.UI.esDelCliente(c, { cliente_id: d.cliente_id, cliente_codigo: d.codigo, nombre: d.nombre }))
        && (f.terceroKey || !f.cliente.trim() || (c ? window.UI.esDelCliente(c, { cliente_id: d.cliente_id, cliente_codigo: d.codigo, nombre: d.nombre }) : `${d.codigo} ${d.nombre}`.toLowerCase().includes(f.cliente.trim().toLowerCase())))
        && (!f.tipo || d.tipo === f.tipo)
        && (f.periodo === 'TODOS' || (f.periodo === 'VENCIDO' ? d.mora > 0 : d.banda === f.periodo)));
      const g = new Map();
      docs.forEach((d) => { const k = d.cliente_id || `N${d.codigo}|${d.nombre}`; const a = g.get(k) || { codigo: d.codigo, nombre: d.nombre, correo: d.correo, dias: d.dias, nit: d.nit, docs: [], b: { VIGENTE: 0, B30: 0, B60: 0, B90: 0, B91: 0 }, total: 0, mora: 0 }; a.docs.push(d); a.b[d.banda] += d.saldo; a.total += d.saldo; a.mora = Math.max(a.mora, d.mora); g.set(k, a); });
      const s = f.dir === 'DESC' ? -1 : 1;
      const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? Infinity : Number(v));
      const grupos = [...g.values()].sort((a, b) => s * (f.orden === 'nombre' ? a.nombre.localeCompare(b.nombre, 'es') : f.orden === 'saldo' ? a.total - b.total : f.orden === 'mora' ? a.mora - b.mora : num(a.codigo) - num(b.codigo)) || a.nombre.localeCompare(b.nombre, 'es'));
      grupos.forEach((x) => x.docs.sort((a, b) => a.emision.localeCompare(b.emision) || String(a.doc).localeCompare(String(b.doc))));
      const tot = { VIGENTE: 0, B30: 0, B60: 0, B90: 0, B91: 0 };
      docs.forEach((d) => { tot[d.banda] += d.saldo; });
      return { grupos, docs, tot, total: docs.reduce((t, d) => t + d.saldo, 0) };
    }
    const celdasBandas = (b) => BANDAS.map(([k]) => `<td class="num">${fmt.monto(b[k])}</td>`).join('');
    const bandasDoc = (d) => BANDAS.map(([k]) => (d.banda === k ? d.saldo : 0));
    const parametros = () => [`Empresa: ${empresaTxt()}`, `Saldo al ${fmt.fechaDia(f.corte)}`, `Cliente: ${f.terceroKey ? (f.terceroNombre || f.terceroKey) : f.cliente.trim() || 'TODOS'}`, `Tipo cliente: ${f.tipo || 'TODOS'}`, `Vence según: ${f.fecha === 'EMISION' ? 'EMISIÓN' : 'ESTIMADA COBRO'}`, `Vencimiento: ${txt(PERIODOS, f.periodo)}`, `Orden: ${txt(ORDENES, f.orden)} ${f.dir === 'DESC' ? '↓' : '↑'}`];
    const tituloRep = () => `Antigüedad de saldos de clientes (${f.contenido === 'RESUMIDO' ? 'Resumido' : 'Detallado'})`;

    function pintar() {
      const R = calcular(), det = f.contenido === 'DETALLADO';
      const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${esc(t)}</small><b>${esc(v)}</b></div>`;
      const cab = det ? '<th>Documento</th><th>Fecha</th><th>Vence</th><th class="num">Días mora</th>' : '<th>Código</th><th>Cliente</th><th class="num">Docs.</th><th class="num">Mayor mora</th>';
      const cuerpo = R.grupos.map((g) => det
        ? `<tr class="pr-g"><td colspan="10">${esc(String(g.codigo))} · ${esc(g.nombre)}${g.correo ? ` · ${esc(g.correo)}` : ''} · Días crédito: ${g.dias}</td></tr>
           ${g.docs.map((d) => `<tr class="${d.mora > 90 ? 'pr-alerta' : ''}"><td><a href="#/facturacion/facturas-ventas/${d.id}">${esc(d.doc)}</a></td><td>${esc(fmt.fechaDia(d.emision))}</td><td>${esc(fmt.fechaDia(d.vence))}</td><td class="num">${d.mora}</td>${bandasDoc(d).map((v) => `<td class="num">${fmt.monto(v)}</td>`).join('')}<td class="num fuerte">${fmt.monto(d.saldo)}</td></tr>`).join('')}
           <tr class="pr-s"><td colspan="4">Total cliente (${g.docs.length})</td>${celdasBandas(g.b)}<td class="num">${fmt.monto(g.total)}</td></tr>`
        : `<tr><td>${esc(String(g.codigo))}</td><td>${esc(g.nombre)}</td><td class="num">${g.docs.length}</td><td class="num ${g.mora > 90 ? 'pc-rojo' : ''}">${g.mora}</td>${celdasBandas(g.b)}<td class="num fuerte">${fmt.monto(g.total)}</td></tr>`).join('');
      ctx.pDet.innerHTML = `
        <div class="bm-form cx-form cl-clasico">
          <div class="cl-banda">${esc(tituloRep())} · ${esc(empresaTxt())} · saldo al ${esc(fmt.fechaDia(f.corte))}</div>
          <div class="ec-kpis">${kpi('Clientes', R.grupos.length.toLocaleString('es-GT'))}${BANDAS.map(([k, t]) => kpi(t, `Q ${fmt.monto(R.tot[k])}`, k === 'B91' && R.tot[k] > 0 ? 'ec-alerta' : '')).join('')}${kpi('Total', `Q ${fmt.monto(R.total)}`, 'ec-fin')}</div>
          <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table>
            <thead><tr>${cab}${BANDAS.map(([, t]) => `<th class="num">${t}</th>`).join('')}<th class="num">Total</th></tr></thead>
            <tbody>${cuerpo || '<tr><td colspan="10" class="tk-vacio">No hay saldos con esos parámetros.</td></tr>'}
              ${R.grupos.length ? `<tr class="pr-t"><td colspan="4">Total general · ${R.grupos.length} cliente(s) · ${R.docs.length} documento(s)</td>${celdasBandas(R.tot)}<td class="num">${fmt.monto(R.total)}</td></tr>` : ''}</tbody>
          </table></div>
        </div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }

    function pdf() {
      const R = calcular(), det = f.contenido === 'DETALLADO';
      if (!R.docs.length) return window.FIN.aviso('No hay saldos con esos parámetros');
      const n = (v) => `<td class="n">${fmt.monto(v)}</td>`;
      const cab = det ? '<th>Documento</th><th>Fecha</th><th>Vence</th><th class="n">Días mora</th>' : '<th>Código</th><th>Cliente</th><th class="n">Docs.</th><th class="n">Mayor mora</th>';
      const filas = R.grupos.map((g) => (det
        ? `<tr class="ag-g"><td><b>${esc(String(g.codigo))}</b></td><td colspan="5"><b>${esc(g.nombre)}</b></td><td colspan="3">${esc(g.correo || '')}</td><td class="n"><b>Días crédito: ${g.dias}</b></td></tr>
           ${g.docs.map((d) => `<tr><td>${esc(d.doc)}</td><td>${esc(fmt.fechaDia(d.emision))}</td><td>${esc(fmt.fechaDia(d.vence))}</td><td class="n">${d.mora}</td>${bandasDoc(d).map(n).join('')}${n(d.saldo)}</tr>`).join('')}
           <tr class="s"><td></td><td colspan="3">Total cliente…</td>${BANDAS.map(([k]) => n(g.b[k])).join('')}${n(g.total)}</tr>`
        : `<tr><td>${esc(String(g.codigo))}</td><td>${esc(g.nombre)}</td><td class="n">${g.docs.length}</td><td class="n">${g.mora}</td>${BANDAS.map(([k]) => n(g.b[k])).join('')}${n(g.total)}</tr>`)).join('');
      imprimir(tituloRep(), `<style>tr.ag-g td{padding-top:10px;border-bottom:0}tr.s td{border-top:1px solid #333}</style>
        <h1>${esc(tituloRep())}</h1><h2>${esc(parametros().join(' · '))}</h2>
        <table><thead><tr>${cab}${BANDAS.map(([, t]) => `<th class="n">${t}</th>`).join('')}<th class="n">Total</th></tr></thead><tbody>${filas}</tbody>
        <tfoot><tr><td colspan="4">Total general · ${R.grupos.length} cliente(s) · ${R.docs.length} documento(s)</td>${BANDAS.map(([k]) => n(R.tot[k])).join('')}${n(R.total)}</tr></tfoot></table>`, { locId: ctx.sel.loc, horizontal: true });
    }

    function tabla(R) {
      const det = f.contenido === 'DETALLADO';
      const bandasCol = BANDAS.map(([, t]) => ({ titulo: t, ancho: 14, tipo: 'monto' }));
      const columnas = det
        ? [{ titulo: 'Documento', ancho: 26 }, { titulo: 'Fecha', ancho: 12 }, { titulo: 'Vence', ancho: 12 }, { titulo: 'Días mora', ancho: 10, tipo: 'entero' }, ...bandasCol, { titulo: 'Total', ancho: 15, tipo: 'monto' }]
        : [{ titulo: 'Código', ancho: 10 }, { titulo: 'Cliente', ancho: 46 }, { titulo: 'Documentos', ancho: 11, tipo: 'entero' }, { titulo: 'Mayor mora', ancho: 11, tipo: 'entero' }, ...bandasCol, { titulo: 'Total', ancho: 15, tipo: 'monto' }];
      const vacios = (k) => Array(k).fill('');
      const filas = [];
      R.grupos.forEach((g) => {
        if (det) {
          filas.push({ tipo: 'grupo', valores: [`${g.codigo} · ${g.nombre}${g.correo ? ` · ${g.correo}` : ''} · Días crédito: ${g.dias}`, ...vacios(columnas.length - 1)] });
          g.docs.forEach((d) => filas.push({ valores: [d.doc, fmt.fechaDia(d.emision), fmt.fechaDia(d.vence), d.mora, ...bandasDoc(d).map(r2), r2(d.saldo)], resaltar: d.mora > 90 ? 1 : 0 }));
          filas.push({ tipo: 'subtotal', valores: [`Total cliente (${g.docs.length})`, '', '', '', ...BANDAS.map(([k]) => r2(g.b[k])), r2(g.total)] });
        } else filas.push({ valores: [String(g.codigo), g.nombre, g.docs.length, g.mora, ...BANDAS.map(([k]) => r2(g.b[k])), r2(g.total)] });
      });
      filas.push({ tipo: 'total', valores: [`Total general · ${R.grupos.length} cliente(s) · ${R.docs.length} documento(s)`, '', '', '', ...BANDAS.map(([k]) => r2(R.tot[k])), r2(R.total)] });
      return { columnas, filas };
    }
    function excel() {
      const R = calcular(), det = f.contenido === 'DETALLADO';
      if (!R.docs.length) return window.FIN.aviso('No hay saldos con esos parámetros');
      if (!window.REPORTE_XLSX) return window.FIN.aviso('No se pudo generar el Excel');
      const { columnas, filas } = tabla(R);
      const e = ctx.localidad(ctx.sel.loc);
      return Promise.resolve(window.REPORTE_XLSX.generar({ titulo: tituloRep(), parametros: parametros(), orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Antigüedad de saldos', autofiltro: !det,
        archivo: `antiguedad_saldos_${f.contenido.toLowerCase()}_${e?.codigo || ''}_${f.corte}`, columnas, filas })).catch((er) => window.FIN.aviso(er.message || 'No se pudo generar el Excel'));
    }

    // Reporte gerencial: lee los clientes y los saldos de la empresa del reporte y devuelve el contenido (PDF / Excel / voz).
    if (sinPantalla) {
      return {
        async cfg() {
          clientes = await window.UI.clientesConVentas(sb, ctx.sel.loc, 'id, codigo, nombre, documento, correo, dias_credito, tipo_cliente').catch(() => []);
          if (f.terceroKey && f.terceroKey.startsWith('C')) { const c = cli(Number(f.terceroKey.slice(1))); if (c) f.terceroNombre = etiquetaCli(c); }
          await consultar();
          const R = calcular(), { columnas, filas } = tabla(R), e = ctx.localidad(ctx.sel.loc);
          return { titulo: tituloRep(), parametros: parametros(), columnas, filas, n: R.docs.length, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Antigüedad de saldos', autofiltro: f.contenido !== 'DETALLADO',
            archivo: `antiguedad_saldos_${f.contenido.toLowerCase()}_${e?.codigo || ''}_${f.corte}`,
            kpis: [['Clientes', R.grupos.length], ...BANDAS.map(([k, t]) => [t, `Q ${fmt.monto(R.tot[k])}`, k === 'B91' && R.tot[k] > 0 ? 'ec-alerta' : '']), ['Total por cobrar', `Q ${fmt.monto(R.total)}`, 'ec-fin']], graficas: [] };
        }
      };
    }
    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (cambio !== 'otro') return;
      const n = e.target.name;
      if (!n || !(n in f)) return;
      f[n] = e.target.value;
      if (n === 'corte') { if (!f.corte || f.corte > hoy) f.corte = hoy; pintarFiltros(); return consultar(); }
      return pintar();
    });
    cont.addEventListener('click', (e) => {
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'pdf') return pdf();
      if (a === 'excel') return excel();
    });
    iniciar();
  };
})();
