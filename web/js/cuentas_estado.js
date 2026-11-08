// Estado de cuenta de clientes (Facturación/Ventas · Procesos · Cuentas x Cobrar) y de proveedores
// (Compras · Procesos · Cuentas x Pagar), de uno o de todos, en un rango de fechas:
//   saldo anterior a la fecha inicial, movimientos del periodo (facturas, notas, retenciones y cobros; o compras y
//   pagos) con saldo acumulado, saldo final, lo vencido y la antigüedad del saldo a la fecha final.
// Se imprime siempre en PDF o en Excel, detallado (movimientos) o resumido (un renglón por cliente o proveedor).
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
  // Fechas: las columnas «date» se usan tal cual; las de fecha y hora, en la hora de Guatemala.
  const dia = (v) => (!v ? '' : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : new Date(v).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }));
  const sumar = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + Number(n || 0)); return x.toLocaleDateString('en-CA'); };
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const cero = (n) => Math.abs(n) < 0.005;
  const ANT = [['Por vencer', -Infinity, 0], ['1 a 30', 1, 30], ['31 a 60', 31, 60], ['61 a 90', 61, 90], ['Más de 90', 91, Infinity]];

  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await hacer().range(i, i + 999);
      if (error) throw error;
      out.push(...(data || [])); if (!data || data.length < 1000) break;
    }
    return out;
  }
  async function porPartes(ids, leer) { const out = []; for (let i = 0; i < ids.length; i += 300) out.push(...(await leer(ids.slice(i, i + 300)))); return out; }
  const titulo1 = (s) => String(s || '').toLowerCase().replace(/^./, (c) => c.toUpperCase());

  // Cada fuente devuelve los clientes o proveedores y sus movimientos hasta la fecha final:
  //   { tercero, doc, fecha, tipo, documento, detalle, vence, cargo, abono }  (doc agrupa la antigüedad por documento).
  const FUENTES = {
    CXC: {
      titulo: 'Estado de cuenta clientes', tercero: 'Cliente', plural: 'clientes', grupo: 'Ventas · Procesos', volver: '#/facturacion', archivo: 'estado_cuenta_clientes',
      async terceros(sb, loc) {
        const rows = await leerTodo(() => sb.from('clientes').select('id, codigo, documento, nombre, tipo_cliente, dias_credito').eq('localidad_id', loc).order('nombre'));
        return rows.map((c) => ({ key: `C${c.id}`, codigo: c.codigo, nombre: c.nombre, nit: c.documento || '', tipo: c.tipo_cliente || '', dias: c.dias_credito }));
      },
      async movimientos(sb, loc, hasta) {
        const fin = `${hasta}T23:59:59.999-06:00`;
        const fac = await leerTodo(() => sb.from('facturas_venta').select('id, numero, no_interno, serie, numero_dte, fecha_emision, fecha_cobro, dias_credito, cliente_id, nombre, nit, total, monto_retencion_iva, monto_retencion_isr, contrasena')
          .eq('localidad_id', loc).neq('estado', 'ANULADA').lte('fecha_emision', fin).order('fecha_emision').order('numero'));
        const ids = fac.map((x) => x.id);
        const [pagos, notas] = await Promise.all([
          porPartes(ids, (p) => leerTodo(() => sb.from('factura_venta_pagos').select('factura_id, fecha, forma, documento, valor, recibos_venta(serie, numero)').in('factura_id', p).lte('fecha', hasta))),
          porPartes(ids, (p) => leerTodo(() => sb.from('notas_venta').select('factura_id, tipo, serie, numero_dte, numero, fecha_emision, valor').in('factura_id', p).neq('estado', 'ANULADA').lte('fecha_emision', fin)))
        ]);
        const doc = (x) => x.no_interno || (x.serie ? `${x.serie}-${x.numero_dte || ''}` : `Interna ${x.numero}`);
        const porId = new Map(fac.map((x) => [x.id, x]));
        const key = (x) => (x.cliente_id ? `C${x.cliente_id}` : `N${(x.nit || 'CF').toUpperCase()}`);
        const extra = new Map();
        const movs = [];
        fac.forEach((x) => {
          if (!x.cliente_id) extra.set(key(x), { key: key(x), codigo: '', nombre: x.nombre || 'CONSUMIDOR FINAL', nit: x.nit || 'CF', tipo: '', dias: null });
          const f = dia(x.fecha_emision), v = x.fecha_cobro || sumar(f, x.dias_credito || 0);
          movs.push({ tercero: key(x), doc: x.id, fecha: f, tipo: 'Factura', documento: doc(x), detalle: x.contrasena ? `Contraseña ${x.contrasena}` : '', vence: v, cargo: Number(x.total), abono: 0 });
          const ret = Number(x.monto_retencion_iva || 0) + Number(x.monto_retencion_isr || 0);
          if (ret > 0.004) movs.push({ tercero: key(x), doc: x.id, fecha: f, tipo: 'Retención', documento: doc(x), detalle: [Number(x.monto_retencion_iva) ? `IVA ${fmt.monto(x.monto_retencion_iva)}` : '', Number(x.monto_retencion_isr) ? `ISR ${fmt.monto(x.monto_retencion_isr)}` : ''].filter(Boolean).join(' · '), vence: '', cargo: 0, abono: ret });
        });
        notas.forEach((n) => { const x = porId.get(n.factura_id); if (!x) return; const deb = n.tipo === 'DÉBITO'; movs.push({ tercero: key(x), doc: x.id, fecha: dia(n.fecha_emision), tipo: deb ? 'Nota de débito' : 'Nota de crédito', documento: n.serie ? `${n.serie}-${n.numero_dte || ''}` : String(n.numero ?? ''), detalle: `Factura ${doc(x)}`, vence: '', cargo: deb ? Number(n.valor) : 0, abono: deb ? 0 : Number(n.valor) }); });
        pagos.forEach((p) => { const x = porId.get(p.factura_id); if (!x) return; movs.push({ tercero: key(x), doc: x.id, fecha: dia(p.fecha), tipo: p.recibos_venta ? 'Recibo' : 'Cobro', documento: p.recibos_venta ? `${p.recibos_venta.serie || ''}-${p.recibos_venta.numero || ''}` : `${titulo1(p.forma)} ${p.documento || ''}`.trim(), detalle: `Factura ${doc(x)}${p.recibos_venta && p.forma ? ` · ${titulo1(p.forma)} ${p.documento || ''}` : ''}`.trim(), vence: '', cargo: 0, abono: Number(p.valor) }); });
        return { movs, extra: [...extra.values()] };
      }
    },
    CXP: {
      titulo: 'Estado de cuenta proveedores', tercero: 'Proveedor', plural: 'proveedores', grupo: 'Compras · Procesos', volver: '#/compras', archivo: 'estado_cuenta_proveedores',
      async terceros(sb, loc) {
        const [rows, t] = await Promise.all([
          leerTodo(() => sb.from('proveedores').select('id, codigo, nit, nombre_comercial, tipo_proveedor_id, dias_credito').eq('localidad_id', loc).order('nombre_comercial')),
          sb.from('tipos_proveedor').select('id, nombre')
        ]);
        const tipo = new Map((t.data || []).map((x) => [x.id, x.nombre]));
        return rows.map((p) => ({ key: `P${p.id}`, codigo: p.codigo, nombre: p.nombre_comercial, nit: p.nit || '', tipo: tipo.get(p.tipo_proveedor_id) || '', dias: p.dias_credito }));
      },
      async movimientos(sb, loc, hasta, ctx) {
        const cs = await leerTodo(() => sb.from('compras_saldo').select('id, numero, serie, documento, fecha_documento, fecha_vencimiento, proveedor_id, proveedor_nombre, nit, moneda_id, tipo_cambio, neto')
          .eq('localidad_id', loc).eq('estado', 'ACTIVA').lte('fecha_documento', hasta).order('fecha_documento').order('numero'));
        const ab = await porPartes(cs.map((c) => c.id), (p) => leerTodo(() => sb.from('compra_abonos').select('compra_id, fecha, valor, origen, documento').in('compra_id', p).lte('fecha', hasta)));
        const k = (c) => (ctx.moneda(c.moneda_id)?.iso && ctx.moneda(c.moneda_id).iso !== 'GTQ' ? Number(c.tipo_cambio) || 1 : 1);
        const doc = (c) => [c.serie, c.documento].filter(Boolean).join('-') || `Compra ${c.numero}`;
        const porId = new Map(cs.map((c) => [c.id, c]));
        const extra = new Map();
        const movs = [];
        cs.forEach((c) => {
          const key = c.proveedor_id ? `P${c.proveedor_id}` : `N${(c.nit || '').toUpperCase()}`;
          if (!c.proveedor_id) extra.set(key, { key, codigo: '', nombre: c.proveedor_nombre || 'SIN PROVEEDOR', nit: c.nit || '', tipo: '', dias: null });
          movs.push({ tercero: key, doc: c.id, fecha: c.fecha_documento, tipo: 'Compra', documento: doc(c), detalle: `Compra No. ${c.numero}`, vence: c.fecha_vencimiento || c.fecha_documento, cargo: Number(c.neto) * k(c), abono: 0 });
        });
        ab.forEach((a) => { const c = porId.get(a.compra_id); if (!c) return; movs.push({ tercero: c.proveedor_id ? `P${c.proveedor_id}` : `N${(c.nit || '').toUpperCase()}`, doc: c.id, fecha: a.fecha, tipo: titulo1(a.origen || 'Pago'), documento: a.documento || '', detalle: `Compra No. ${c.numero} · ${doc(c)}`, vence: '', cargo: 0, abono: Number(a.valor) * k(c) }); });
        return { movs, extra: [...extra.values()] };
      }
    }
  };

  // directo: { ctx, f } para generar el PDF o el Excel sin la pantalla (desde los reportes de CXP y CXC).
  function estadoCuenta(cont, clave, extra) {
    const directo = extra && extra.ctx ? extra : null;
    const F = FUENTES[clave];
    const ctx = directo ? directo.ctx : montar(cont, { titulo: F.titulo, icono: 'ti-file-invoice', clase: 'bk-movimientos bm-solo cx-rep cx-estado', grupo: F.grupo });
    const { sb } = ctx;
    const hoy = fmt.hoy();
    const f = { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy, tercero: '', terceroKey: '', tipo: '', mostrar: 'CON SALDO', orden: 'NOMBRE', contenido: 'DETALLADO', ...(directo?.f || {}) };
    let terceros = [], movs = [], cargadoHasta = '', datos = null, abiertos = new Set(), turno = 0;
    const tDe = (txt) => { const s = String(txt || '').trim().toUpperCase(); if (!s) return null; const cod = s.includes(' — ') ? s.slice(s.lastIndexOf(' — ') + 3).trim() : s; return terceros.find((t) => (t.codigo !== '' && String(t.codigo) === cod) || (t.nit && t.nit.toUpperCase() === cod) || t.nombre.toUpperCase() === s) || null; };
    const selT = () => (f.terceroKey ? terceros.find((t) => t.key === f.terceroKey) || null : tDe(f.tercero));
    const empresa = () => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
    const tipos = () => [...new Set(terceros.map((t) => t.tipo).filter(Boolean))].sort();
    const periodo = () => `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`;
    const parametros = () => [`Empresa: ${empresa()}`, periodo(), `${F.tercero}: ${selT()?.nombre || 'TODOS'}`, `Tipo ${F.tercero.toLowerCase()}: ${f.tipo || 'TODOS'}`, `Mostrar: ${f.mostrar}`, `Orden: ${f.orden}`];

    function pintarFiltros() {
      const t = tDe(f.tercero);
      const sl = (n, ops, val) => `<select name="${n}">${ops.map(([x, tx]) => `<option value="${esc(x)}" ${String(val) === String(x) ? 'selected' : ''}>${esc(tx)}</option>`).join('')}</select>`;
      ctx.filtros(`
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo cx-prov"><span>${F.tercero}</span><input list="ec-terceros" name="tercero" autocomplete="off" value="${esc(f.tercero)}" placeholder="TODOS"></label>
        <label class="campo"><span>Tipo ${F.tercero.toLowerCase()}</span>${sl('tipo', [['', 'TODOS'], ...tipos().map((x) => [x, x])], f.tipo)}</label>
        <label class="campo"><span>Mostrar</span>${sl('mostrar', [['CON SALDO', 'CON SALDO'], ['CON MOVIMIENTO', 'CON MOVIMIENTO O SALDO'], ['VENCIDOS', 'CON SALDO VENCIDO'], ['TODOS', 'TODOS']], f.mostrar)}</label>
        <label class="campo"><span>Ordenar ${F.plural}</span>${sl('orden', [['NOMBRE', 'NOMBRE'], ['CÓDIGO', 'CÓDIGO'], ['SALDO', 'MAYOR SALDO'], ['VENCIDO', 'MAYOR VENCIDO'], ['MORA', 'MAYOR MORA']], f.orden)}</label>
        <label class="campo"><span>Contenido</span>${sl('contenido', [['DETALLADO', 'DETALLADO (MOVIMIENTOS)'], ['RESUMIDO', 'RESUMIDO (SALDOS)']], f.contenido)}</label>
        <datalist id="ec-terceros">${terceros.map((x) => `<option value="${esc(x.nombre)}${x.codigo !== '' ? ` — ${esc(String(x.codigo))}` : ''}"></option>`).join('')}</datalist>
        ${t || !f.tercero ? '' : `<small class="cx-aviso pc-rojo">${F.tercero} no encontrado</small>`}`,
        `<button type="button" class="boton primario-sm" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button>
         <button type="button" class="boton primario-sm ec-xls" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>
         <button type="button" class="boton secundario-sm" data-accion="regresar"><i class="ti ti-arrow-left" aria-hidden="true"></i> Regresar</button>`);
    }

    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargarLocalidad(); }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      terceros = loc ? await F.terceros(sb, loc) : [];
      cargadoHasta = ''; abiertos = new Set();
      pintarFiltros();
      await consultar();
    }
    // Lee los movimientos hasta la fecha final (las fechas anteriores salen del mismo juego: el saldo anterior).
    async function consultar() {
      const t = ++turno, loc = ctx.sel.loc;
      if (!loc) { movs = []; return pintar(); }
      ctx.pDet.innerHTML = `<p class="vacio">Consultando los movimientos de los ${F.plural}…</p>`;
      try {
        const r = await F.movimientos(sb, loc, f.hasta, ctx);
        if (t !== turno) return;
        movs = r.movs.sort((a, b) => a.fecha.localeCompare(b.fecha) || b.cargo - a.cargo);
        const ya = new Set(terceros.map((x) => x.key));
        r.extra.forEach((x) => { if (!ya.has(x.key)) terceros.push(x); });
        cargadoHasta = f.hasta;
      } catch (e) { if (t === turno) ctx.pDet.innerHTML = `<p class="vacio">${esc(window.UI.traducirError(e))}</p>`; return; }
      pintar();
    }

    function calcular() {
      const sel = selT();
      const g = new Map();
      const de = (k) => { if (!g.has(k)) g.set(k, { t: terceros.find((x) => x.key === k) || { key: k, codigo: '', nombre: k, nit: '', tipo: '' }, ant: 0, cargos: 0, abonos: 0, movs: [], prev: [], docs: new Map(), vence: new Map() }); return g.get(k); };
      movs.forEach((m) => {
        if (m.fecha > f.hasta) return;
        if (sel && m.tercero !== sel.key) return;
        const a = de(m.tercero);
        if (f.tipo && a.t.tipo !== f.tipo) return;
        if (m.fecha < f.desde) { a.ant += m.cargo - m.abono; a.prev.push(m); } else { a.cargos += m.cargo; a.abonos += m.abono; a.movs.push(m); }
        a.docs.set(m.doc, (a.docs.get(m.doc) || 0) + m.cargo - m.abono);
        if (m.vence) a.vence.set(m.doc, m.vence);
      });
      if (sel && !g.has(sel.key)) de(sel.key);
      let lista = [...g.values()].filter((a) => !f.tipo || a.t.tipo === f.tipo).map((a) => {
        a.fin = r2(a.ant + a.cargos - a.abonos); a.ant = r2(a.ant);
        a.aging = ANT.map(() => 0); a.mora = 0;
        a.docs.forEach((s, d) => { if (cero(s)) return; const v = a.vence.get(d); const mora = s > 0 && v && v < f.hasta ? diasEntre(v, f.hasta) : 0; a.mora = Math.max(a.mora, mora); a.aging[ANT.findIndex(([, x, y]) => mora >= x && mora <= y)] += s; });
        a.aging = a.aging.map(r2); a.vencido = r2(a.aging.slice(1).reduce((s, x) => s + x, 0));
        let s = a.ant; a.movs = a.movs.map((m) => { s += m.cargo - m.abono; return { ...m, saldo: r2(s) }; });
        // Documentos pendientes al inicio del periodo: cada factura (o compra) con saldo, con todos sus movimientos
        // anteriores (notas, retenciones, cobros o pagos) en orden; su saldo acumulado llega al saldo anterior.
        const antDoc = new Map(), ini = new Map();
        a.prev.forEach((m) => { antDoc.set(m.doc, (antDoc.get(m.doc) || 0) + m.cargo - m.abono); if (!ini.has(m.doc) || m.fecha < ini.get(m.doc)) ini.set(m.doc, m.fecha); });
        let p = 0;
        a.pend = a.prev.filter((m) => !cero(antDoc.get(m.doc)))
          .sort((x, y) => ini.get(x.doc).localeCompare(ini.get(y.doc)) || String(x.doc).localeCompare(String(y.doc)) || x.fecha.localeCompare(y.fecha) || y.cargo - x.cargo)
          .map((m) => { p += m.cargo - m.abono; return { ...m, saldo: r2(p) }; });
        a.pendDocs = [...antDoc.values()].filter((x) => !cero(x)).length;
        a.pendC = r2(a.pend.reduce((t, m) => t + m.cargo, 0)); a.pendA = r2(a.pend.reduce((t, m) => t + m.abono, 0));
        delete a.prev;
        return a;
      });
      if (!sel) lista = lista.filter((a) => (f.mostrar === 'TODOS' ? true : f.mostrar === 'CON MOVIMIENTO' ? a.movs.length || !cero(a.fin) : f.mostrar === 'VENCIDOS' ? a.vencido > 0.004 : !cero(a.fin)));
      const cmp = { NOMBRE: (a, b) => a.t.nombre.localeCompare(b.t.nombre), 'CÓDIGO': (a, b) => String(a.t.codigo).localeCompare(String(b.t.codigo), 'es', { numeric: true }), SALDO: (a, b) => b.fin - a.fin, VENCIDO: (a, b) => b.vencido - a.vencido, MORA: (a, b) => b.mora - a.mora };
      lista.sort((a, b) => cmp[f.orden](a, b) || a.t.nombre.localeCompare(b.t.nombre));
      const tot = { ant: 0, cargos: 0, abonos: 0, fin: 0, vencido: 0, aging: ANT.map(() => 0), movs: 0 };
      lista.forEach((a) => { tot.ant += a.ant; tot.cargos += a.cargos; tot.abonos += a.abonos; tot.fin += a.fin; tot.vencido += a.vencido; a.aging.forEach((x, i) => { tot.aging[i] += x; }); tot.movs += a.movs.length; });
      return { lista, tot, uno: sel };
    }

    // Detalle de un cliente o proveedor: documentos pendientes al inicio (saldo anterior), movimientos del periodo
    // y su resumen. Cada renglón: { sec } título de sección, { mov } movimiento, { sub, c, a, s } subtotal.
    const detalle = (a) => {
      const out = [];
      const corte = fmt.fechaDia(sumar(f.desde, -1));
      out.push({ sec: `Documentos pendientes al ${corte}${a.pendDocs ? ` · ${a.pendDocs} documento(s)` : ''}` });
      if (a.pend.length) a.pend.forEach((x) => out.push({ mov: x }));
      else out.push({ nada: 'Sin documentos pendientes.' });
      out.push({ sub: `Saldo anterior al ${corte}`, c: a.pendC, a: a.pendA, s: a.ant });
      out.push({ sec: `Movimientos del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}` });
      if (a.movs.length) a.movs.forEach((x) => out.push({ mov: x }));
      else out.push({ nada: 'Sin movimientos en el periodo.' });
      out.push({ sub: 'Movimientos del periodo', c: a.cargos, a: a.abonos, s: a.fin });
      return out;
    };

    // ---------- Pantalla ----------
    const m = (n) => fmt.monto(n);
    const tablaMovs = (a) => `
      <table class="ec-movs"><thead><tr><th>Fecha</th><th>Tipo</th><th>Documento</th><th>Detalle</th><th>Vence</th><th class="num">Cargos</th><th class="num">Abonos</th><th class="num">Saldo</th></tr></thead>
      <tbody>${detalle(a).map((r) => r.sec ? `<tr class="ec-sec"><td colspan="8">${esc(r.sec)}</td></tr>`
        : r.nada ? `<tr><td colspan="8" class="ec-sin">${esc(r.nada)}</td></tr>`
        : r.sub ? `<tr class="ec-sub"><td colspan="5">${esc(r.sub)}</td><td class="num">${m(r.c)}</td><td class="num">${m(r.a)}</td><td class="num">${m(r.s)}</td></tr>`
        : (({ mov: x }) => `<tr><td>${esc(fmt.fechaDia(x.fecha))}</td><td><span class="ec-tipo ec-${x.cargo ? 'c' : 'a'}">${esc(x.tipo)}</span></td><td>${esc(x.documento)}</td><td class="ec-det">${esc(x.detalle)}</td><td>${esc(fmt.fechaDia(x.vence || ''))}</td><td class="num">${x.cargo ? m(x.cargo) : ''}</td><td class="num">${x.abono ? m(x.abono) : ''}</td><td class="num fuerte">${m(x.saldo)}</td></tr>`)(r)).join('')}</tbody></table>
      ${resumenDe(a)}`;
    // Resumen de cada cliente o proveedor, al final de su detalle.
    const resumenDe = (a) => `<div class="ec-resumen"><b class="ec-resumen-t"><i class="ti ti-report-analytics" aria-hidden="true"></i> Resumen</b>
      <div class="ec-res-k"><span><small>Saldo anterior</small>${m(a.ant)}</span><span><small>(+) Cargos</small>${m(a.cargos)}</span><span><small>(−) Abonos</small>${m(a.abonos)}</span><span class="ec-fin"><small>Saldo al ${fmt.fechaDia(f.hasta)}</small>${m(a.fin)}</span><span class="${a.vencido > 0.004 ? 'ec-venc' : ''}"><small>Vencido</small>${m(a.vencido)}</span><span><small>Mayor mora</small>${a.mora} días</span></div>
      ${antiguedad(a.aging, a.fin)}</div>`;
    const antiguedad = (ag, fin) => `<div class="ec-ant-bar">${ANT.map(([t], i) => `<div class="${i && ag[i] > 0.004 ? 'ec-venc' : ''}"><small>${t}${i ? ' días' : ''}</small><b>${m(ag[i])}</b>${fin > 0.004 ? `<i style="width:${Math.max(0, Math.min(100, (ag[i] / fin) * 100)).toFixed(1)}%"></i>` : ''}</div>`).join('')}</div>`;

    function pintar() {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-file-invoice'); return; }
      datos = calcular();
      const { lista, tot, uno } = datos;
      const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
      const pct = tot.fin > 0.004 ? ` · ${Math.round((tot.vencido / tot.fin) * 100)}%` : '';
      const kpis = `<div class="ec-kpis">${kpi(uno ? F.tercero : titulo1(F.plural), uno ? esc(`${uno.codigo !== '' ? `${uno.codigo} · ` : ''}${uno.nombre}`) : lista.length, uno ? 'ec-quien' : '')}${kpi('Saldo anterior', m(tot.ant))}${kpi('Cargos', m(tot.cargos))}${kpi('Abonos', m(tot.abonos))}${kpi(`Saldo al ${fmt.fechaDia(f.hasta)}`, m(tot.fin), 'ec-fin')}${kpi(`Vencido${pct}`, m(tot.vencido), tot.vencido > 0.004 ? 'ec-alerta' : '')}</div>`;
      let cuerpo;
      if (uno) {
        const a = lista[0];
        cuerpo = `<div class="ec-ficha"><span><b>NIT</b> ${esc(uno.nit || '—')}</span><span><b>Tipo</b> ${esc(uno.tipo || '—')}</span><span><b>Días crédito</b> ${uno.dias ?? '—'}</span><span><b>Mayor mora</b> <em class="${a?.mora ? 'pc-rojo' : ''}">${a?.mora || 0} días</em></span></div>
          <div class="pc-lineas cx-tabla ec-tabla">${a ? tablaMovs(a) : '<p class="vacio">Sin movimientos.</p>'}</div>`;
      } else {
        cuerpo = `<div class="pc-lineas cx-tabla ec-tabla"><table class="ec-res">
          <thead><tr><th class="ec-chev"></th><th class="num">${F.tercero === 'Cliente' ? 'Cliente' : 'Prov.'}</th><th>Nombre</th><th>NIT</th><th class="num">Saldo anterior</th><th class="num">Cargos</th><th class="num">Abonos</th><th class="num">Saldo final</th><th class="num">Vencido</th><th class="num">Mayor mora</th></tr></thead>
          <tbody>${lista.map((a) => { const ab = abiertos.has(a.t.key); return `<tr class="ec-fila ${ab ? 'abierto' : ''}" data-t="${esc(a.t.key)}" tabindex="0"><td class="ec-chev"><i class="ti ti-chevron-${ab ? 'down' : 'right'}" aria-hidden="true"></i></td><td class="num">${esc(String(a.t.codigo ?? ''))}</td><td class="cx-nombre" title="${esc(a.t.nombre)}"><div>${esc(a.t.nombre)}</div></td><td>${esc(a.t.nit || '')}</td><td class="num">${m(a.ant)}</td><td class="num">${m(a.cargos)}</td><td class="num">${m(a.abonos)}</td><td class="num fuerte">${m(a.fin)}</td><td class="num ${a.vencido > 0.004 ? 'pc-rojo' : ''}">${m(a.vencido)}</td><td class="num ${a.mora ? 'pc-rojo' : ''}">${a.mora}</td></tr>
            ${ab ? `<tr class="ec-detalle"><td></td><td colspan="9">${tablaMovs(a)}</td></tr>` : ''}`; }).join('') || `<tr><td colspan="10" class="tk-vacio"><i class="ti ti-file-invoice" aria-hidden="true"></i>Sin ${F.plural} con esos parámetros.</td></tr>`}</tbody>
          <tfoot><tr><td colspan="4">${lista.length} ${F.plural} · ${tot.movs} movimiento(s)</td><td class="num">${m(tot.ant)}</td><td class="num">${m(tot.cargos)}</td><td class="num">${m(tot.abonos)}</td><td class="num">${m(tot.fin)}</td><td class="num">${m(tot.vencido)}</td><td></td></tr></tfoot></table></div>`;
      }
      ctx.pDet.innerHTML = `
        <div class="bm-form cx-form cl-clasico">
          <div class="cl-banda">${esc(F.titulo)} · ${esc(periodo().toLowerCase())}${lista.length > 1 ? `<span class="ec-acc"><button type="button" class="boton secundario-sm" data-accion="abrir-todo">${abiertos.size ? 'Contraer todo' : 'Expandir todo'}</button></span>` : ''}</div>
          ${kpis}
          ${uno ? '' : antiguedad(tot.aging, tot.fin)}
          ${cuerpo}
        </div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }

    // ---------- PDF ----------
    function pdf() {
      const { lista, tot } = datos || calcular();
      if (!lista.length) return window.FIN.aviso(`No hay ${F.plural} con esos parámetros`);
      const est = `<style>
        .ec-t{margin:14px 0 4px;padding:6px 10px;background:#1f3a5f;color:#fff;display:flex;justify-content:space-between;gap:12px;font-size:12px;break-after:avoid}
        .ec-t b{font-size:13px}.ec-t span{opacity:.9}
        .ec-k{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:8px 0 12px}.ec-k div{border:1px solid #c9d4e3;padding:5px 8px;border-radius:4px}.ec-k small{display:block;font-size:9.5px;color:#666;text-transform:uppercase}.ec-k b{font-size:13px}
        .ec-k .r b{color:#b42318}
        table.m td,table.m th{font-size:10.5px;padding:3px 5px}tr.a td{background:#f4f6fa;font-style:italic}
        .ag{display:grid;grid-template-columns:repeat(5,1fr);border:1px solid #c9d4e3;margin:-4px 0 10px;font-size:10px}.ag div{padding:3px 6px;border-right:1px solid #e3e8f0}.ag div:last-child{border:0}.ag b{display:block;font-size:11px}.ag .r b{color:#b42318}
        .blq{break-inside:avoid}tr.sec td{background:#dfe7f2;color:#1f3a5f;font-weight:bold;font-size:10.5px}tr.s td{font-weight:bold;background:#f1f4f9}td.a{font-style:italic;color:#666}
        .rs{border:1px solid #c9d4e3;border-radius:4px;padding:6px 8px 2px;margin:-4px 0 14px;break-inside:avoid}.rs>b{font-size:11px;color:#1f3a5f;text-transform:uppercase}.rs .ec-k{margin:4px 0 6px}.rs .ag{margin:0 0 6px}
      </style>`;
      const k = `<div class="ec-k"><div><small>Saldo anterior</small><b>${m(tot.ant)}</b></div><div><small>Cargos</small><b>${m(tot.cargos)}</b></div><div><small>Abonos</small><b>${m(tot.abonos)}</b></div><div><small>Saldo al ${fmt.fechaDia(f.hasta)}</small><b>${m(tot.fin)}</b></div><div class="${tot.vencido > 0.004 ? 'r' : ''}"><small>Vencido</small><b>${m(tot.vencido)}</b></div></div>`;
      const ag = (x) => `<div class="ag">${ANT.map(([t], i) => `<div class="${i && x[i] > 0.004 ? 'r' : ''}">${t}${i ? ' días' : ''}<b>${m(x[i])}</b></div>`).join('')}</div>`;
      const res = `<table><thead><tr><th>${F.tercero}</th><th>Nombre</th><th>NIT</th><th class="n">Saldo anterior</th><th class="n">Cargos</th><th class="n">Abonos</th><th class="n">Saldo final</th>${ANT.map(([t], i) => `<th class="n">${t}${i ? ' d' : ''}</th>`).join('')}<th class="n">Mora</th></tr></thead>
        <tbody>${lista.map((a) => `<tr><td>${esc(String(a.t.codigo ?? ''))}</td><td>${esc(a.t.nombre)}</td><td>${esc(a.t.nit || '')}</td><td class="n">${m(a.ant)}</td><td class="n">${m(a.cargos)}</td><td class="n">${m(a.abonos)}</td><td class="n"><b>${m(a.fin)}</b></td>${a.aging.map((x) => `<td class="n">${cero(x) ? '' : m(x)}</td>`).join('')}<td class="n">${a.mora || ''}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">${lista.length} ${F.plural}</td><td class="n">${m(tot.ant)}</td><td class="n">${m(tot.cargos)}</td><td class="n">${m(tot.abonos)}</td><td class="n">${m(tot.fin)}</td>${tot.aging.map((x) => `<td class="n">${m(x)}</td>`).join('')}<td></td></tr></tfoot></table>`;
      let cuerpo;
      if (f.contenido === 'RESUMIDO') cuerpo = k + ag(tot.aging) + res;
      else {
        cuerpo = (lista.length > 1 ? k + ag(tot.aging) : '') + lista.map((a) => `<div class="${a.movs.length + a.pend.length < 25 ? 'blq' : ''}">
          <div class="ec-t"><b>${esc(`${a.t.codigo !== '' ? `${a.t.codigo} · ` : ''}${a.t.nombre}`)}</b><span>NIT ${esc(a.t.nit || '—')}${a.t.tipo ? ` · ${esc(a.t.tipo)}` : ''}${a.t.dias != null ? ` · Crédito ${a.t.dias} días` : ''}${a.mora ? ` · Mayor mora ${a.mora} días` : ''}</span></div>
          <table class="m"><thead><tr><th>Fecha</th><th>Tipo</th><th>Documento</th><th>Detalle</th><th>Vence</th><th class="n">Cargos</th><th class="n">Abonos</th><th class="n">Saldo</th></tr></thead>
          <tbody>${detalle(a).map((r) => r.sec ? `<tr class="sec"><td colspan="8">${esc(r.sec)}</td></tr>`
            : r.nada ? `<tr><td colspan="8" class="a">${esc(r.nada)}</td></tr>`
            : r.sub ? `<tr class="s"><td colspan="5">${esc(r.sub)}</td><td class="n">${m(r.c)}</td><td class="n">${m(r.a)}</td><td class="n">${m(r.s)}</td></tr>`
            : (({ mov: x }) => `<tr><td>${esc(fmt.fechaDia(x.fecha))}</td><td>${esc(x.tipo)}</td><td>${esc(x.documento)}</td><td>${esc(x.detalle)}</td><td>${esc(fmt.fechaDia(x.vence || ''))}</td><td class="n">${x.cargo ? m(x.cargo) : ''}</td><td class="n">${x.abono ? m(x.abono) : ''}</td><td class="n">${m(x.saldo)}</td></tr>`)(r)).join('')}</tbody></table>
          <div class="rs"><b>Resumen</b><div class="ec-k"><div><small>Saldo anterior</small><b>${m(a.ant)}</b></div><div><small>(+) Cargos</small><b>${m(a.cargos)}</b></div><div><small>(−) Abonos</small><b>${m(a.abonos)}</b></div><div><small>Saldo al ${fmt.fechaDia(f.hasta)}</small><b>${m(a.fin)}</b></div><div class="${a.vencido > 0.004 ? 'r' : ''}"><small>Vencido</small><b>${m(a.vencido)}</b></div></div>${ag(a.aging)}</div></div>`).join('')
          + (lista.length > 1 ? `<h3>Resumen por ${F.tercero.toLowerCase()}</h3>${res}` : '');
      }
      imprimir(F.titulo, `${est}<h1>${esc(F.titulo)}${f.contenido === 'RESUMIDO' ? ' · Resumido' : ''}</h1><h2>${esc(parametros().join(' · '))}</h2>${cuerpo}`, { orgId: ctx.sel.org, locId: ctx.sel.loc, horizontal: f.contenido === 'RESUMIDO' });
    }

    // ---------- Excel ----------
    function excel() {
      const { lista, tot } = datos || calcular();
      if (!lista.length) return window.FIN.aviso(`No hay ${F.plural} con esos parámetros`);
      const base = { titulo: `${F.titulo} · ${f.contenido === 'RESUMIDO' ? 'Resumido' : 'Detallado'}`, parametros: parametros(), orgId: ctx.sel.org, locId: ctx.sel.loc, archivo: `${F.archivo}_${f.contenido.toLowerCase()}_${f.hasta}` };
      const agTxt = (x) => `Antigüedad del saldo al ${fmt.fechaDia(f.hasta)}:   ${ANT.map(([t], i) => `${t}${i ? ' días' : ''} Q ${m(x[i])}`).join('   ·   ')}`;
      let cfg;
      if (f.contenido === 'RESUMIDO') {
        cfg = { ...base, hoja: 'Resumido', columnas: [{ titulo: F.tercero, ancho: 10, tipo: 'texto' }, { titulo: 'Nombre', ancho: 42, tipo: 'texto' }, { titulo: 'NIT', ancho: 14, tipo: 'texto' }, { titulo: 'Saldo anterior', ancho: 15, tipo: 'monto' }, { titulo: 'Cargos', ancho: 15, tipo: 'monto' }, { titulo: 'Abonos', ancho: 15, tipo: 'monto' }, { titulo: 'Saldo final', ancho: 15, tipo: 'monto' }, ...ANT.map(([t], i) => ({ titulo: `${t}${i ? ' días' : ''}`, ancho: 14, tipo: 'monto' })), { titulo: 'Mayor mora', ancho: 11, tipo: 'entero' }],
          filas: [...lista.map((a) => ({ valores: [String(a.t.codigo ?? ''), a.t.nombre, a.t.nit || '', a.ant, a.cargos, a.abonos, a.fin, ...a.aging, a.mora] })), { valores: [`${lista.length} ${F.plural}`, '', '', r2(tot.ant), r2(tot.cargos), r2(tot.abonos), r2(tot.fin), ...tot.aging.map(r2), ''], tipo: 'total' }] };
      } else {
        const filas = [];
        lista.forEach((a) => {
          filas.push({ valores: [`${a.t.codigo !== '' ? `${a.t.codigo} · ` : ''}${a.t.nombre}   ·   NIT ${a.t.nit || '—'}${a.t.tipo ? `   ·   ${a.t.tipo}` : ''}${a.t.dias != null ? `   ·   Crédito ${a.t.dias} días` : ''}${a.mora ? `   ·   Mayor mora ${a.mora} días` : ''}`], tipo: 'grupo', combinar: true });
          detalle(a).forEach((r) => {
            if (r.sec) filas.push({ valores: [r.sec], combinar: true, tipo: 'subtotal' });
            else if (r.nada) filas.push({ valores: ['', r.nada], tenue: true });
            else if (r.sub) filas.push({ valores: [r.sub, '', '', '', '', r2(r.c), r2(r.a), r2(r.s)], tipo: 'subtotal' });
            else { const x = r.mov; filas.push({ valores: [fmt.fechaDia(x.fecha), x.tipo, x.documento, x.detalle, fmt.fechaDia(x.vence || ''), x.cargo || '', x.abono || '', x.saldo] }); }
          });
          filas.push({ valores: ['Resumen', '', '', `Saldo anterior Q ${m(a.ant)}   ·   Vencido Q ${m(a.vencido)}${a.mora ? `   ·   Mayor mora ${a.mora} días` : ''}`, '', r2(a.cargos), r2(a.abonos), a.fin], resaltar: 2 });
          filas.push({ valores: [agTxt(a.aging)], tipo: 'nota', combinar: true });
          filas.push({ valores: [''] });
        });
        filas.push({ valores: [`Total · ${lista.length} ${F.plural}`, '', '', '', '', r2(tot.cargos), r2(tot.abonos), r2(tot.fin)], tipo: 'total' });
        if (lista.length > 1) {
          filas.push({ valores: [`Saldo anterior total Q ${m(tot.ant)}   ·   Vencido Q ${m(tot.vencido)}   ·   ${agTxt(tot.aging)}`], tipo: 'nota', combinar: true });
          filas.push({ valores: [''] });
          filas.push({ valores: [`RESUMEN POR ${F.tercero.toUpperCase()}`], tipo: 'grupo', combinar: true });
          filas.push({ valores: ['Código', 'NIT', 'Mayor mora', 'Nombre', 'Saldo anterior', 'Cargos', 'Abonos', 'Saldo final'], resaltar: 2 });
          lista.forEach((a) => filas.push({ valores: [String(a.t.codigo ?? ''), a.t.nit || '', a.mora, a.t.nombre, a.ant, r2(a.cargos), r2(a.abonos), a.fin], formatos: { 2: 'entero', 4: 'monto' } }));
          filas.push({ valores: [`${lista.length} ${F.plural}`, '', '', '', r2(tot.ant), r2(tot.cargos), r2(tot.abonos), r2(tot.fin)], tipo: 'total', formatos: { 4: 'monto' } });
        }
        cfg = { ...base, hoja: 'Detallado', columnas: [{ titulo: 'Fecha', ancho: 12, tipo: 'texto' }, { titulo: 'Tipo', ancho: 16, tipo: 'texto' }, { titulo: 'Documento', ancho: 20, tipo: 'texto' }, { titulo: 'Detalle', ancho: 40, tipo: 'texto' }, { titulo: 'Vence', ancho: 15, tipo: 'texto' }, { titulo: 'Cargos', ancho: 15, tipo: 'monto' }, { titulo: 'Abonos', ancho: 15, tipo: 'monto' }, { titulo: 'Saldo', ancho: 16, tipo: 'monto' }], filas };
      }
      return window.REPORTE_XLSX.generar(cfg).catch((e) => window.FIN.aviso(e.message || 'No se pudo generar el Excel'));
    }

    // Sin pantalla: lee los datos y genera el PDF o el Excel de uno o de todos los clientes o proveedores.
    if (directo) return {
      async generar(formato) {
        try {
          window.FIN.aviso('Generando el estado de cuenta…');
          terceros = await F.terceros(sb, ctx.sel.loc);
          const r = await F.movimientos(sb, ctx.sel.loc, f.hasta, ctx);
          movs = r.movs.sort((a, b) => a.fecha.localeCompare(b.fecha) || b.cargo - a.cargo);
          const ya = new Set(terceros.map((x) => x.key));
          r.extra.forEach((x) => { if (!ya.has(x.key)) terceros.push(x); });
          datos = calcular();
          if (!datos.lista.length) return window.FIN.aviso(`No hay ${F.plural} con esos parámetros`);
          return formato === 'PDF' ? pdf() : excel();
        } catch (e) { window.FIN.aviso(window.UI.traducirError(e)); }
      }
    };

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (cambio !== 'otro') return;
      const n = e.target.name;
      if (!n || !(n in f)) return;
      f[n] = e.target.value;
      if (n === 'desde' && f.hasta < f.desde) f.hasta = f.desde;
      if (n === 'hasta' && f.desde > f.hasta) f.desde = f.hasta;
      if (n === 'tercero' && tDe(f.tercero)) abiertos = new Set();
      pintarFiltros();
      // Más allá de lo leído hay que volver a consultar; hacia atrás basta con recalcular.
      return n === 'hasta' && f.hasta > cargadoHasta ? consultar() : pintar();
    });
    const alternar = (k) => { if (abiertos.has(k)) abiertos.delete(k); else abiertos.add(k); pintar(); ctx.pDet.querySelector(`tr[data-t="${CSS.escape(k)}"]`)?.focus(); };
    cont.addEventListener('click', (e) => {
      const fila = e.target.closest('tr.ec-fila');
      if (fila) return alternar(fila.dataset.t);
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'pdf' || a === 'excel') {
        // Antes de imprimir se confirma si es resumido o detallado (y PDF o Excel).
        return window.ESTADO_CUENTA.elegir({ tercero: selT()?.nombre || `Todos los ${F.plural}`, tipo: F.tercero, todos: !selT(), periodo: periodo(), contenido: f.contenido, formato: a === 'pdf' ? 'PDF' : 'EXCEL' }).then((op) => {
          if (!op) return;
          if (op.contenido !== f.contenido) { f.contenido = op.contenido; pintarFiltros(); }
          return op.formato === 'PDF' ? pdf() : excel();
        });
      }
      if (a === 'abrir-todo') { abiertos = abiertos.size ? new Set() : new Set((datos?.lista || []).map((x) => x.t.key)); return pintar(); }
      if (a === 'regresar') return history.length > 1 ? history.back() : (location.hash = F.volver);
    });
    cont.addEventListener('keydown', (e) => { const fila = e.target.closest?.('tr.ec-fila'); if (fila && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); alternar(fila.dataset.t); } });
    iniciar();
  }
  window.PANTALLAS['cxc-estado'] = (cont, m, directo) => estadoCuenta(cont, 'CXC', directo);
  window.PANTALLAS['cxp-estado'] = (cont, m, directo) => estadoCuenta(cont, 'CXP', directo);
})();

// Estado de cuenta desde los reportes de CXP y CXC (botón «Est. cuenta»), de uno o de todos, en PDF o Excel:
// window.ESTADO_CUENTA.generar('CXP' | 'CXC', ctx, { desde, hasta, terceroKey, tipo, mostrar, contenido }, 'PDF' | 'EXCEL')
// window.ESTADO_CUENTA.elegir({ tercero, contenido, formato }): antes de imprimir se confirma si el estado de cuenta es
// resumido o detallado, y si sale en PDF o en Excel. Devuelve { contenido, formato } o null si se cancela.
window.ESTADO_CUENTA = {
  generar(clave, ctx, f, formato) { return window.PANTALLAS[`${clave.toLowerCase()}-estado`](null, null, { ctx, f }).generar(formato); },
  // o: { tercero, tipo: 'Cliente' | 'Proveedor', todos, periodo, contenido, formato }
  elegir({ tercero = '', tipo = '', todos = false, periodo = '', contenido = 'DETALLADO', formato = 'PDF' } = {}) {
    const esc = window.UI.esc;
    const plural = tipo === 'Cliente' ? 'clientes' : tipo === 'Proveedor' ? 'proveedores' : '';
    return new Promise((listo) => {
      const velo = document.createElement('div');
      velo.className = 'modal-velo';
      const op = (n, v, ic, t, d, sel) => `
        <label class="ece-op">
          <input type="radio" name="${n}" value="${v}" ${sel ? 'checked' : ''}>
          <span class="ece-tarjeta"><span class="ece-ic"><i class="ti ${ic}" aria-hidden="true"></i></span><span class="ece-tx"><b>${t}</b><small>${d}</small></span><i class="ti ti-circle-check-filled ece-ok" aria-hidden="true"></i></span>
        </label>`;
      velo.innerHTML = `
        <form class="modal ece" role="dialog" aria-modal="true" aria-labelledby="ece-titulo">
          <header class="ece-cab">
            <span class="ece-cab-ic"><i class="ti ti-file-invoice" aria-hidden="true"></i></span>
            <div><h2 id="ece-titulo">Imprimir estado de cuenta</h2><p>Elige el contenido y el formato del reporte</p></div>
            <button type="button" class="icono-boton" data-cerrar aria-label="Cerrar"><i class="ti ti-x" aria-hidden="true"></i></button>
          </header>
          <div class="ece-cuerpo">
            <div class="ece-quien">
              <span class="ece-avatar"><i class="ti ${todos ? 'ti-users-group' : tipo === 'Proveedor' ? 'ti-truck' : 'ti-user'}" aria-hidden="true"></i></span>
              <div><small>${todos ? `Todos los ${plural || 'registros'}` : esc(tipo || 'Estado de cuenta de')}</small><b>${esc(tercero)}</b></div>
              ${periodo ? `<span class="ece-periodo"><i class="ti ti-calendar" aria-hidden="true"></i> ${esc(periodo)}</span>` : ''}
            </div>
            <fieldset><legend>Contenido</legend><div class="ece-ops">
              ${op('contenido', 'RESUMIDO', 'ti-list-numbers', 'Resumido', `Un renglón por ${tipo ? tipo.toLowerCase() : 'cliente o proveedor'}: saldos y antigüedad`, contenido === 'RESUMIDO')}
              ${op('contenido', 'DETALLADO', 'ti-list-details', 'Detallado', 'Cada movimiento con su saldo acumulado', contenido !== 'RESUMIDO')}
            </div></fieldset>
            <fieldset><legend>Formato</legend><div class="ece-ops">
              ${op('formato', 'PDF', 'ti-file-type-pdf', 'PDF', 'Imprimir o guardar como PDF', formato === 'PDF')}
              ${op('formato', 'EXCEL', 'ti-file-spreadsheet', 'Excel', 'Descargar el archivo .xlsx', formato !== 'PDF')}
            </div></fieldset>
          </div>
          <footer class="ece-pie">
            <p class="ece-resumen" aria-live="polite"></p>
            <button type="button" class="boton secundario-sm" data-cerrar>Cancelar</button>
            <button type="submit" class="boton primario-sm ece-generar"></button>
          </footer>
        </form>`;
      document.body.appendChild(velo);
      const form = velo.querySelector('form');
      const resumen = () => {
        const c = form.elements.contenido.value, fm = form.elements.formato.value;
        form.querySelector('.ece-resumen').innerHTML = `<i class="ti ti-info-circle" aria-hidden="true"></i> Estado de cuenta <b>${c === 'RESUMIDO' ? 'resumido' : 'detallado'}</b> en <b>${fm === 'PDF' ? 'PDF' : 'Excel'}</b>`;
        form.querySelector('.ece-generar').innerHTML = fm === 'PDF' ? '<i class="ti ti-printer" aria-hidden="true"></i> Generar PDF' : '<i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Generar Excel';
      };
      resumen();
      form.addEventListener('change', resumen);
      const fin = (v) => { velo.remove(); listo(v); };
      velo.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', () => fin(null)));
      velo.addEventListener('click', (e) => { if (e.target === velo) fin(null); });
      velo.addEventListener('keydown', (e) => { if (e.key === 'Escape') fin(null); });
      form.addEventListener('submit', (e) => { e.preventDefault(); fin({ contenido: form.elements.contenido.value, formato: form.elements.formato.value }); });
      form.querySelector('.ece-generar').focus();
    });
  }
};
