// Facturación/Ventas · Procesos · Cuentas x Cobrar: Consolidado CXC mensual, Consolidado general y CXC por periodo
// (saldo a una fecha), con resumen por cliente, estado de cuenta e impresión en PDF o Excel. Igual que Cuentas x Pagar
// de Compras, pero asociado directamente a todas las ventas: cada factura vigente con su total, notas de débito y de
// crédito, retenciones y cobros (pagos de recibos).
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const TITULOS = { MENSUAL: ['Consolidado CXC mensual', 'ti-calendar-month'], GENERAL: ['Consolidado general', 'ti-report-money'], PERIODO: ['CXC por periodo', 'ti-calendar-dollar'] };
  const empresaTxt = (ctx) => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
  const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
  const diaLocal = (v) => v ? new Date(v).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }) : '';
  const sumar = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + Number(n || 0)); return x.toLocaleDateString('en-CA'); };
  const docTxt = (x) => x.no_interno || (x.serie ? `${x.serie}-${x.numero_dte || ''}` : `Interna ${x.numero}`);
  const CAMPOS = 'id, numero, no_interno, serie, numero_dte, fecha_emision, fecha_cobro, dias_credito, cliente_id, cliente_codigo, nombre, nit, moneda_id, tipo_cambio, total, notas_debito, notas_credito, monto_retencion_iva, monto_retencion_isr, pagado, saldo, contrasena, estado';

  // Lee todo lo que devuelve la consulta, de mil en mil.
  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await hacer().range(i, i + 999);
      if (error) throw error;
      out.push(...(data || [])); if (!data || data.length < 1000) break;
    }
    return out;
  }

  function reporteCxc(cont, modo) {
    const ctx = montar(cont, { titulo: TITULOS[modo][0], icono: TITULOS[modo][1], clase: `bk-movimientos bm-solo cx-rep cx-${modo.toLowerCase()}`, grupo: 'Ventas · Procesos' });
    const { sb } = ctx;
    const hoy = fmt.hoy();
    const [y, m] = hoy.split('-').map(Number);
    const f = { anio: y, mes: m, desde: `${y}-01-01`, hasta: hoy, fecha: modo === 'MENSUAL' ? 'ESTIMADA' : 'EMISION', saldo: modo === 'MENSUAL' ? 'CON SALDO' : 'TODAS', tipo: '', cliente: '', formato: 'PDF', orden: '', dir: 'ASC' };
    const X = window.CUENTAS_XLSX;
    const ord = () => ({ campo: f.orden, dir: f.dir });
    const GET = { fdoc: (x) => x.emision, fpago: (x) => x.fc, mora: (x) => x.mora, valor: (x) => x.valor, saldo: (x) => x.saldoQ };
    const GET_RES = { mora: (x) => x.mora, valor: (x) => x.valor, saldo: (x) => x.saldo };
    let clientes = [], tipos = [], facturas = [], movs = new Map(), filas = [], resumen = false, sel = null, turno = 0, primera = true, saltoTxt = '';
    const cli = (id) => clientes.find((c) => c.id === id);
    const cliDe = (t) => { const s = String(t || '').trim().toUpperCase(); if (!s) return null; const cod = s.includes(' — ') ? s.slice(s.lastIndexOf(' — ') + 3).trim() : s; return clientes.find((c) => String(c.codigo) === cod || (c.documento && c.documento.toUpperCase() === cod) || c.nombre.toUpperCase() === s) || null; };
    const estimada = (x) => x.fecha_cobro || sumar(diaLocal(x.fecha_emision), x.dias_credito || 0);
    const fechaDe = (x) => (f.fecha === 'ESTIMADA' ? estimada(x) : diaLocal(x.fecha_emision));
    const enQ = (x) => (ctx.moneda(x.moneda_id)?.iso && ctx.moneda(x.moneda_id).iso !== 'GTQ' ? Number(x.tipo_cambio) || 1 : 1);

    function pintarFiltros() {
      const c = cliDe(f.cliente);
      const sl = (n, ops, val) => `<select name="${n}">${ops.map(([x, t]) => `<option value="${x}" ${String(val) === String(x) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
      ctx.filtros(`
        ${modo === 'GENERAL' ? `<label class="campo"><span>Fecha inicio</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label><label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>` : ''}
        ${modo === 'PERIODO' ? `<label class="campo cx-anio"><span>Año venta</span><input type="number" name="anio" min="2000" max="2999" value="${f.anio}"></label><label class="campo"><span>Saldo al</span><input type="date" name="hasta" value="${f.hasta}"></label>` : ''}
        <label class="campo cx-prov"><span>Cliente</span><input list="cx-clientes" name="cliente" value="${esc(f.cliente)}" placeholder="TODOS"></label>
        ${modo !== 'PERIODO' ? `<label class="campo"><span>Tipo fecha</span>${sl('fecha', [['ESTIMADA', 'ESTIMADA COBRO'], ['EMISION', 'EMISIÓN']], f.fecha)}</label>` : ''}
        <label class="campo"><span>Saldo?</span>${sl('saldo', [['CON SALDO', 'CON SALDO'], ['SIN SALDO', 'SIN SALDO'], ['TODAS', 'TODAS']], f.saldo)}</label>
        <label class="campo"><span>Tipo cliente</span>${sl('tipo', [['', 'TODOS'], ...tipos.map((t) => [t, t])], f.tipo)}</label>
        <label class="campo cx-orden"><span>Ordenar por</span>${sl('orden', X.opcionesOrden('FECHA COBRO'), f.orden)}</label>
        <label class="campo cx-dir"><span>Orden</span>${sl('dir', [['ASC', 'ASCENDENTE'], ['DESC', 'DESCENDENTE']], f.dir)}</label>
        <label class="campo cx-formato"><span>Formato</span>${sl('formato', window.CUENTAS_XLSX.OPCIONES, f.formato)}</label>
        <datalist id="cx-clientes">${clientes.map((x) => `<option value="${esc(x.nombre)} — ${x.codigo}"></option>`).join('')}</datalist>
        ${c || !f.cliente ? '' : '<small class="cx-aviso pc-rojo">Cliente no encontrado</small>'}`,
        `<button type="button" class="boton primario-sm" data-accion="imprimir">${f.formato === 'PDF' ? '<i class="ti ti-printer" aria-hidden="true"></i> Imprimir' : '<i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Generar Excel'}</button>
         ${modo === 'PERIODO' ? `<button type="button" class="boton secundario-sm ${resumen ? 'activo' : ''}" data-accion="resumen" aria-pressed="${resumen}"><i class="ti ti-list-numbers" aria-hidden="true"></i> Resumen</button>` : ''}
         <button type="button" class="boton secundario-sm" data-accion="estado-cuenta" title="Estado de cuenta del cliente elegido (o de la fila seleccionada)"><i class="ti ti-file-text" aria-hidden="true"></i> Est. cuenta</button>
         <button type="button" class="boton secundario-sm" data-accion="regresar"><i class="ti ti-arrow-left" aria-hidden="true"></i> Regresar</button>`);
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      clientes = loc ? await leerTodo(() => sb.from('clientes').select('id, codigo, documento, nombre, tipo_cliente, dias_credito').eq('localidad_id', loc).order('nombre')) : [];
      tipos = [...new Set(clientes.map((c) => c.tipo_cliente).filter(Boolean))].sort();
      primera = true;
      pintarFiltros();
      await consultar();
    }
    async function consultar() {
      const t = ++turno;
      const loc = ctx.sel.loc;
      if (!loc) { facturas = []; return pintar(); }
      ctx.pDet.innerHTML = '<p class="vacio">Consultando las ventas…</p>';
      try {
        const lista = await leerTodo(() => {
          let q = sb.from('facturas_venta').select(CAMPOS).eq('localidad_id', loc).neq('estado', 'ANULADA');
          if (modo === 'PERIODO') q = q.gte('fecha_emision', `${f.anio}-01-01T00:00:00-06:00`).lte('fecha_emision', `${f.hasta < `${f.anio}-12-31` ? f.hasta : `${f.anio}-12-31`}T23:59:59.999-06:00`);
          return q.order('fecha_emision').order('numero');
        });
        // Saldo a la fecha: cobros y notas hasta ese día.
        const m2 = new Map();
        if (modo === 'PERIODO' && lista.length) {
          const ids = lista.map((x) => x.id);
          for (let i = 0; i < ids.length; i += 300) {
            const parte = ids.slice(i, i + 300);
            const [pg, nt] = await Promise.all([
              leerTodo(() => sb.from('factura_venta_pagos').select('factura_id, valor').in('factura_id', parte).lte('fecha', `${f.hasta}T23:59:59.999-06:00`)),
              leerTodo(() => sb.from('notas_venta').select('factura_id, tipo, valor').in('factura_id', parte).neq('estado', 'ANULADA').lte('fecha_emision', `${f.hasta}T23:59:59.999-06:00`))
            ]);
            pg.forEach((a) => { const x = m2.get(a.factura_id) || { pag: 0, nc: 0, nd: 0 }; x.pag += Number(a.valor); m2.set(a.factura_id, x); });
            nt.forEach((a) => { const x = m2.get(a.factura_id) || { pag: 0, nc: 0, nd: 0 }; if (a.tipo === 'DÉBITO') x.nd += Number(a.valor); else x.nc += Number(a.valor); m2.set(a.factura_id, x); });
          }
        }
        if (t !== turno) return;
        facturas = lista; movs = m2;
      } catch (e) { if (t === turno) ctx.pDet.innerHTML = `<p class="vacio">${esc(window.UI.traducirError(e))}</p>`; return; }
      // Primera vista: si el periodo propuesto no tiene facturas, se salta al más cercano que sí tiene.
      if (primera && modo === 'PERIODO' && !facturas.length) {
        const { data: u } = await sb.from('facturas_venta').select('fecha_emision').eq('localidad_id', loc).neq('estado', 'ANULADA').order('fecha_emision', { ascending: false }).limit(1);
        const anio = u?.[0] ? Number(diaLocal(u[0].fecha_emision).slice(0, 4)) : null;
        if (anio && anio !== f.anio) { primera = false; f.anio = anio; f.hasta = `${anio}-12-31` < hoy ? `${anio}-12-31` : hoy; saltoTxt = `No hay ventas en el año propuesto: se muestra ${anio}, el último con ventas.`; pintarFiltros(); return consultar(); }
      }
      if (primera && modo !== 'PERIODO') { const s = sugerencia(); if (s && !calcular().length) { s.aplicar(); saltoTxt = `${s.vacio}: se muestra ${s.txt}, el periodo más cercano con facturas.`; pintarFiltros(); } }
      primera = false;
      pintar();
    }
    // Neto de la factura: total + notas de débito − retenciones − notas de crédito.
    const neto = (x, nd = Number(x.notas_debito || 0), nc = Number(x.notas_credito || 0)) => fmt.redondear(Number(x.total) + nd - Number(x.monto_retencion_iva || 0) - Number(x.monto_retencion_isr || 0) - nc);
    // Periodo más cercano con facturas (con los demás filtros), para cuando el elegido sale vacío.
    function sugerencia() {
      const fechas = calcular(false).map(fechaDe).filter(Boolean).sort();
      if (!fechas.length) return null;
      if (modo === 'MENSUAL') {
        const actual = `${f.anio}-${String(f.mes).padStart(2, '0')}`;
        const meses = [...new Set(fechas.map((d) => d.slice(0, 7)))];
        const mm = meses.filter((x) => x <= actual).pop() || meses[0];
        if (mm === actual) return null;
        const [a, b] = mm.split('-').map(Number);
        return { vacio: `No hay facturas en ${MESES[f.mes - 1]} ${f.anio}`, txt: `${MESES[b - 1]} ${a}`, n: fechas.filter((d) => d.startsWith(mm)).length, aplicar: () => { f.anio = a; f.mes = b; } };
      }
      const antes = fechas.filter((d) => d <= f.hasta);
      if (!antes.length) return null;
      const desde = `${antes[antes.length - 1].slice(0, 4)}-01-01`;
      if (desde >= f.desde) return null;
      return { vacio: `No hay facturas del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, txt: `del ${fmt.fechaDia(desde)} al ${fmt.fechaDia(f.hasta)}`, n: antes.filter((d) => d >= desde).length, aplicar: () => { f.desde = desde; } };
    }
    function avisoVacio() {
      if (saltoTxt) { const t = saltoTxt; saltoTxt = ''; return `<div class="cx-vacio-sug"><i class="ti ti-info-circle" aria-hidden="true"></i> ${esc(t)}</div>`; }
      if (!facturas.length) return `<div class="cx-vacio-sug"><i class="ti ti-info-circle" aria-hidden="true"></i> ${esc(empresaTxt(ctx))} no tiene facturas de venta registradas${modo === 'PERIODO' ? ` en ${f.anio}` : ''}. Elige otra empresa en «Empresa».</div>`;
      if (filas.length || modo === 'PERIODO') return '';
      const s = sugerencia();
      return s ? `<div class="cx-vacio-sug"><i class="ti ti-info-circle" aria-hidden="true"></i> ${esc(s.vacio)} con esos filtros. <button type="button" class="boton secundario-sm" data-accion="sugerencia">Ver ${esc(s.txt)} (${s.n})</button></div>` : '';
    }
    function calcular(conFecha = true) {
      const c = cliDe(f.cliente);
      const ini = modo === 'MENSUAL' ? `${f.anio}-${String(f.mes).padStart(2, '0')}-01` : f.desde;
      const fin = modo === 'MENSUAL' ? new Date(f.anio, f.mes, 0).toLocaleDateString('en-CA') : f.hasta;
      return facturas.map((x) => {
        const k = enQ(x);
        const mv = movs.get(x.id) || { pag: 0, nc: 0, nd: 0 };
        const saldo = modo === 'PERIODO' ? Math.max(fmt.redondear(neto(x, mv.nd, mv.nc) - mv.pag), 0) : Number(x.saldo);
        const fc = estimada(x);
        const corte = modo === 'PERIODO' ? f.hasta : hoy;
        const mora = saldo > 0.004 && fc && fc < corte ? diasEntre(fc, corte) : 0;
        const cl = cli(x.cliente_id);
        return { ...x, k, saldo, valor: Number(x.total), saldoQ: saldo, mora, fc, emision: diaLocal(x.fecha_emision), codigo: cl?.codigo ?? x.cliente_codigo, nombreCli: x.nombre || cl?.nombre || '', tipoCli: cl?.tipo_cliente || '' };
      }).filter((x) => {
        if (c && x.cliente_id !== c.id) return false;
        if (f.tipo && x.tipoCli !== f.tipo) return false;
        if (f.saldo === 'CON SALDO' && !(x.saldo > 0.004)) return false;
        if (f.saldo === 'SIN SALDO' && x.saldo > 0.004) return false;
        if (modo !== 'PERIODO' && conFecha) { const d = fechaDe(x); if (!d || d < ini || d > fin) return false; }
        return true;
      }).sort((a, b) => (fechaDe(a) || '').localeCompare(fechaDe(b) || '') || a.numero - b.numero);
    }
    const agrupar = (rows) => {
      const g = new Map();
      rows.forEach((x) => { const k = x.cliente_id || `N${x.nit}`; const a = g.get(k) || { id: x.cliente_id, codigo: x.codigo, nombre: x.nombreCli, nit: x.nit, docs: 0, valor: 0, saldo: 0, mora: 0 }; a.docs++; a.valor += x.valor; a.saldo += x.saldoQ; a.mora = Math.max(a.mora, x.mora); g.set(k, a); });
      const o = ['mora', 'valor', 'saldo'].includes(f.orden) ? ord() : { campo: 'saldo', dir: 'DESC' };
      return X.ordenar([...g.values()], o, GET_RES);
    };

    function pintar() {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-report-money'); return; }
      filas = X.ordenar(calcular(), ord(), GET);
      const o = ord(), th = X.th;
      const tot = filas.reduce((t, x) => ({ v: t.v + x.valor, s: t.s + x.saldoQ, m: t.m + (x.mora > 0 ? x.saldoQ : 0) }), { v: 0, s: 0, m: 0 });
      const meses = modo === 'MENSUAL' ? `<div class="cx-meses">
          <button type="button" class="boton secundario-sm" data-anio="-1" aria-label="Año anterior">−</button><b class="cx-anio-n">${f.anio}</b><button type="button" class="boton secundario-sm" data-anio="1" aria-label="Año siguiente">+</button>
          ${MESES.map((n, i) => `<button type="button" class="cx-mes ${f.mes === i + 1 ? 'activo' : ''}" data-mes="${i + 1}">${n}</button>`).join('')}</div>` : '';
      const cuerpo = resumen ? (() => { const g = agrupar(filas); return `
          <thead><tr><th class="num">Cliente</th><th>Nombre cliente</th><th>NIT</th><th class="num">Facturas</th>${th('mora', 'Mayor mora', o, 'num')}${th('valor', 'Valor total Q', o, 'num')}${th('saldo', 'Saldo Q', o, 'num')}</tr></thead>
          <tbody>${g.map((x) => `<tr data-cliente="${x.id || ''}"><td class="num">${x.codigo ?? ''}</td><td class="cx-nombre"><div>${esc(x.nombre)}</div></td><td>${esc(x.nit || '')}</td><td class="num">${x.docs}</td><td class="num ${x.mora ? 'pc-rojo' : ''}">${x.mora}</td><td class="num">${fmt.monto(x.valor)}</td><td class="num fuerte">${fmt.monto(x.saldo)}</td></tr>`).join('') || '<tr><td colspan="7" class="tk-vacio">Sin facturas con esos filtros.</td></tr>'}</tbody>
          <tfoot><tr><td colspan="3">${g.length} cliente(s)</td><td class="num">${filas.length}</td><td></td><td class="num">${fmt.monto(tot.v)}</td><td class="num">${fmt.monto(tot.s)}</td></tr></tfoot>`; })() : `
          <thead><tr><th class="num">Factura</th><th>Serie</th><th>Número DTE</th>${th('fdoc', 'Emisión', o)}${th('fpago', 'Se estima cobro', o)}${th('mora', 'Días mora', o, 'num')}<th class="num">Cliente</th><th>Nombre cliente</th>${th('valor', 'Valor total', o, 'num')}${th('saldo', 'Saldo', o, 'num')}</tr></thead>
          <tbody>${filas.map((x) => `<tr data-fila="${x.id}" class="${sel === x.id ? 'actual' : ''}" tabindex="0">
            <td class="num fuerte"><a href="#/facturacion/facturas-ventas/${x.id}" title="Abrir la factura">${esc(x.no_interno || String(x.numero))}</a></td><td>${esc(x.serie || '')}</td><td>${esc(x.numero_dte || '')}</td><td>${esc(fmt.fechaDia(x.emision))}</td><td>${esc(fmt.fechaDia(x.fc))}</td>
            <td class="num ${x.mora ? 'pc-rojo' : ''}">${x.mora}</td><td class="num">${x.codigo ?? ''}</td><td class="cx-nombre" title="${esc(x.nombreCli)}${x.contrasena ? ` · Contraseña ${esc(x.contrasena)}` : ''}"><div>${esc(x.nombreCli)}</div></td>
            <td class="num">${fmt.monto(x.valor)}</td><td class="num fuerte">${fmt.monto(x.saldoQ)}</td></tr>`).join('')
            || '<tr><td colspan="10" class="tk-vacio"><i class="ti ti-report-money" aria-hidden="true"></i>Sin facturas con esos filtros.</td></tr>'}</tbody>
          <tfoot><tr><td colspan="8">${filas.length} factura(s) · Total</td><td class="num">${fmt.monto(tot.v)}</td><td class="num">${fmt.monto(tot.s)}</td></tr></tfoot>`;
      ctx.pDet.innerHTML = `
        <div class="bm-form cx-form cl-clasico">
          <div class="cl-banda">${esc(TITULOS[modo][0])} · todas las ventas${modo === 'PERIODO' ? ` · saldo al ${esc(fmt.fechaDia(f.hasta))}` : modo === 'GENERAL' ? ` · ${esc(fmt.fechaDia(f.desde))} al ${esc(fmt.fechaDia(f.hasta))}` : ` · ${MESES[f.mes - 1]} ${f.anio}`}</div>
          ${meses}
          ${avisoVacio()}
          <div class="pc-lineas cx-tabla"><table>${cuerpo}</table></div>
        </div>`;
      X.ajustarAlto(cont);
    }

    function titulo() { return `${TITULOS[modo][0]} · ${modo === 'MENSUAL' ? `${MESES[f.mes - 1]} ${f.anio}` : modo === 'GENERAL' ? `${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}` : `saldo al ${fmt.fechaDia(f.hasta)}`}`; }
    // Excel: resumido, detallado o por periodo (según el parámetro del encabezado).
    function excelRep() {
      const periodo = modo === 'MENSUAL' ? `Mes: ${MESES[f.mes - 1]} ${f.anio}` : modo === 'GENERAL' ? `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}` : `Saldo al ${fmt.fechaDia(f.hasta)}`;
      return window.CUENTAS_XLSX.generar({
        tipo: f.formato, modo, orden: ord(), titulo: TITULOS[modo][0], tercero: 'Cliente', orgId: ctx.sel.org, locId: ctx.sel.loc, corte: modo === 'PERIODO' ? f.hasta : hoy,
        archivo: `cxc_${modo.toLowerCase()}_${modo === 'MENSUAL' ? `${f.anio}_${String(f.mes).padStart(2, '0')}` : f.hasta}`,
        parametros: [`Empresa: ${empresaTxt(ctx)}`, periodo, `Cliente: ${cliDe(f.cliente)?.nombre || 'TODOS'}`, `Saldo: ${f.saldo}`, `Tipo cliente: ${f.tipo || 'TODOS'}`, ...(modo !== 'PERIODO' ? [`Tipo fecha: ${f.fecha === 'ESTIMADA' ? 'ESTIMADA COBRO' : 'EMISIÓN'}`] : []), X.textoOrden(ord(), 'FECHA COBRO')],
        filas: filas.map((x) => ({ tercero_id: x.cliente_id, codigo: x.codigo, nombre: x.nombreCli, nit: x.nit, numero: x.no_interno || x.numero, serie: x.serie, documento: x.numero_dte, fecha: modo === 'PERIODO' ? x.emision : fechaDe(x), fecha_doc: x.emision, estimada: x.fc, mora: x.mora, valor: x.valor, saldo: x.saldoQ }))
      }).catch((e) => window.FIN.aviso(e.message || 'No se pudo generar el Excel'));
    }
    function imprimirRep() {
      if (!filas.length) return window.FIN.aviso('No hay facturas con esos filtros');
      if (f.formato !== 'PDF') return excelRep();
      const filtros = `Cliente: ${cliDe(f.cliente)?.nombre || 'TODOS'} · Saldo: ${f.saldo} · Tipo cliente: ${f.tipo || 'TODOS'}${modo !== 'PERIODO' ? ` · Tipo fecha: ${f.fecha === 'ESTIMADA' ? 'ESTIMADA COBRO' : 'EMISIÓN'}` : ''} · ${X.textoOrden(ord(), 'FECHA COBRO')}`;
      const csv = (n, filasCsv) => (window.COMPRAS_CAT?.descargarCsv ? window.COMPRAS_CAT.descargarCsv(n, filasCsv) : window.FIN.aviso('No se pudo generar el Excel'));
      if (resumen) {
        const g = agrupar(filas);
        if (f.formato === 'EXCEL') return csv(`cxc_resumen_${f.hasta}.csv`, [['Cliente', 'Nombre cliente', 'NIT', 'Facturas', 'Mayor mora', 'Valor total Q', 'Saldo Q'], ...g.map((x) => [x.codigo ?? '', x.nombre, x.nit || '', x.docs, x.mora, x.valor.toFixed(2), x.saldo.toFixed(2)])]);
        return imprimir(titulo(), `<h1>${esc(titulo())} · Resumen por cliente</h1><h2>${esc(empresaTxt(ctx))} · ${esc(filtros)}</h2><table><thead><tr><th>Cliente</th><th>Nombre</th><th>NIT</th><th class="n">Facturas</th><th class="n">Mora</th><th class="n">Valor Q</th><th class="n">Saldo Q</th></tr></thead>
          <tbody>${g.map((x) => `<tr><td>${x.codigo ?? ''}</td><td>${esc(x.nombre)}</td><td>${esc(x.nit || '')}</td><td class="n">${x.docs}</td><td class="n">${x.mora}</td><td class="n">${fmt.monto(x.valor)}</td><td class="n">${fmt.monto(x.saldo)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="5">Total</td><td class="n">${fmt.monto(g.reduce((t, x) => t + x.valor, 0))}</td><td class="n">${fmt.monto(g.reduce((t, x) => t + x.saldo, 0))}</td></tr></tfoot></table>`);
      }
      const cab = ['Factura', 'Serie', 'Número DTE', 'Emisión', 'Se estima cobro', 'Días mora', 'Contraseña', 'Cliente', 'Nombre cliente', 'Valor total', 'Saldo'];
      if (f.formato === 'EXCEL') return csv(`cxc_${modo.toLowerCase()}_${f.hasta}.csv`, [cab, ...filas.map((x) => [x.no_interno || x.numero, x.serie || '', x.numero_dte || '', fmt.fechaDia(x.emision), fmt.fechaDia(x.fc), x.mora, x.contrasena || '', x.codigo ?? '', x.nombreCli, x.valor.toFixed(2), x.saldoQ.toFixed(2)])]);
      imprimir(titulo(), `<h1>${esc(titulo())}</h1><h2>${esc(empresaTxt(ctx))} · ${esc(filtros)}</h2>
        <table><thead><tr>${cab.map((x, i) => `<th class="${i === 5 || i > 8 ? 'n' : ''}">${x}</th>`).join('')}</tr></thead>
        <tbody>${filas.map((x) => `<tr><td>${esc(x.no_interno || String(x.numero))}</td><td>${esc(x.serie || '')}</td><td>${esc(x.numero_dte || '')}</td><td>${esc(fmt.fechaDia(x.emision))}</td><td>${esc(fmt.fechaDia(x.fc))}</td><td class="n">${x.mora}</td><td>${esc(x.contrasena || '')}</td><td>${x.codigo ?? ''}</td><td>${esc(x.nombreCli)}</td><td class="n">${fmt.monto(x.valor)}</td><td class="n">${fmt.monto(x.saldoQ)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="9">${filas.length} facturas · Total</td><td class="n">${fmt.monto(filas.reduce((t, x) => t + x.valor, 0))}</td><td class="n">${fmt.monto(filas.reduce((t, x) => t + x.saldoQ, 0))}</td></tr></tfoot></table>`, { horizontal: true });
    }
    // Estado de cuenta: las facturas del cliente con sus cobros y notas, y el saldo acumulado.
    async function estadoCuenta(clienteId) {
      const c = cli(clienteId) || cliDe(f.cliente) || cli(facturas.find((x) => x.id === sel)?.cliente_id);
      if (!c) return window.FIN.aviso('Elige el cliente o selecciona una fila del reporte');
      const corte = modo === 'PERIODO' ? f.hasta : hoy;
      const fin = `${corte}T23:59:59.999-06:00`;
      const lista = await leerTodo(() => sb.from('facturas_venta').select(CAMPOS).eq('localidad_id', ctx.sel.loc).neq('estado', 'ANULADA').eq('cliente_id', c.id).lte('fecha_emision', fin).order('fecha_emision').order('numero'));
      const ids = lista.map((x) => x.id);
      const pagos = [], notas = [];
      for (let i = 0; i < ids.length; i += 300) {
        const parte = ids.slice(i, i + 300);
        const [pg, nt] = await Promise.all([
          leerTodo(() => sb.from('factura_venta_pagos').select('factura_id, fecha, forma, documento, valor, recibos_venta(serie, numero)').in('factura_id', parte).lte('fecha', fin)),
          leerTodo(() => sb.from('notas_venta').select('factura_id, tipo, serie, numero_dte, numero, fecha_emision, valor').in('factura_id', parte).neq('estado', 'ANULADA').lte('fecha_emision', fin))
        ]);
        pagos.push(...pg); notas.push(...nt);
      }
      const fac = (id) => lista.find((x) => x.id === id);
      const mov = [
        ...lista.map((x) => ({ fecha: diaLocal(x.fecha_emision), txt: `Factura ${docTxt(x)}`, vence: estimada(x), cargo: Number(x.total), abono: Number(x.monto_retencion_iva || 0) + Number(x.monto_retencion_isr || 0) })),
        ...notas.map((n) => ({ fecha: diaLocal(n.fecha_emision), txt: `Nota de ${n.tipo.toLowerCase()} ${n.serie ? `${n.serie}-${n.numero_dte || ''}` : n.numero} · factura ${docTxt(fac(n.factura_id) || {})}`, cargo: n.tipo === 'DÉBITO' ? Number(n.valor) : 0, abono: n.tipo === 'DÉBITO' ? 0 : Number(n.valor) })),
        ...pagos.map((p) => ({ fecha: diaLocal(p.fecha), txt: `${p.recibos_venta ? `Recibo ${p.recibos_venta.serie || ''}-${p.recibos_venta.numero || ''}` : `Cobro ${p.forma || ''} ${p.documento || ''}`} · factura ${docTxt(fac(p.factura_id) || {})}`, cargo: 0, abono: Number(p.valor) }))
      ].sort((a, b) => a.fecha.localeCompare(b.fecha) || b.cargo - a.cargo);
      let s = 0;
      const filasEc = mov.map((x) => { s += x.cargo - x.abono; return `<tr><td>${esc(fmt.fechaDia(x.fecha))}</td><td>${esc(x.txt)}</td><td>${esc(fmt.fechaDia(x.vence || ''))}</td><td class="n">${x.cargo ? fmt.monto(x.cargo) : ''}</td><td class="n">${x.abono ? fmt.monto(x.abono) : ''}</td><td class="n">${fmt.monto(s)}</td></tr>`; }).join('');
      imprimir(`Estado de cuenta ${c.nombre}`, `<h1>Estado de cuenta · ${esc(String(c.codigo))} · ${esc(c.nombre)}</h1><h2>${esc(empresaTxt(ctx))} · NIT ${esc(c.documento || '')} · al ${esc(fmt.fechaDia(corte))}</h2>
        <table><thead><tr><th>Fecha</th><th>Documento</th><th>Se estima cobro</th><th class="n">Cargos Q</th><th class="n">Abonos Q</th><th class="n">Saldo Q</th></tr></thead><tbody>${filasEc || '<tr><td colspan="6">Sin movimientos.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="3">Saldo al ${esc(fmt.fechaDia(corte))}</td><td class="n">${fmt.monto(mov.reduce((t, x) => t + x.cargo, 0))}</td><td class="n">${fmt.monto(mov.reduce((t, x) => t + x.abono, 0))}</td><td class="n">${fmt.monto(s)}</td></tr></tfoot></table>`);
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (cambio !== 'otro') return;
      const n = e.target.name;
      if (!n) return;
      f[n] = n === 'anio' ? Number(e.target.value) || f.anio : e.target.value;
      if (n === 'desde' && f.hasta < f.desde) f.hasta = f.desde;
      if (n === 'hasta' && f.desde > f.hasta) f.desde = f.hasta;
      if (n === 'anio' && modo === 'PERIODO' && !f.hasta.startsWith(String(f.anio))) f.hasta = `${f.anio}-12-31` < hoy ? `${f.anio}-12-31` : hoy;
      pintarFiltros();
      if (n === 'formato') return;
      return modo === 'PERIODO' && ['hasta', 'anio'].includes(n) ? consultar() : pintar();
    });
    cont.addEventListener('click', (e) => {
      const mes = e.target.closest('[data-mes]');
      if (mes) { f.mes = Number(mes.dataset.mes); return pintar(); }
      const an = e.target.closest('[data-anio]');
      if (an) { f.anio += Number(an.dataset.anio); return pintar(); }
      if (e.target.closest('a[href]')) return;
      const fila = e.target.closest('tr[data-fila]');
      if (fila) { sel = Number(fila.dataset.fila); ctx.pDet.querySelectorAll('tr[data-fila]').forEach((tr) => tr.classList.toggle('actual', tr === fila)); return; }
      const col = e.target.closest('th[data-orden]');
      if (col) return ordenarCol(col.dataset.orden);
      const rc = e.target.closest('tr[data-cliente]');
      if (rc && rc.dataset.cliente) return estadoCuenta(Number(rc.dataset.cliente));
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'imprimir') return imprimirRep();
      if (a === 'resumen') { resumen = !resumen; pintarFiltros(); return pintar(); }
      if (a === 'sugerencia') { const s = sugerencia(); if (s) { s.aplicar(); pintarFiltros(); } return pintar(); }
      if (a === 'estado-cuenta') return estadoCuenta();
      if (a === 'regresar') return history.length > 1 ? history.back() : (location.hash = '#/facturacion');
    });
    // Clic (o Enter) en el encabezado: ordena por esa columna y alterna ascendente / descendente.
    function ordenarCol(campo) { const o = ord(); X.alternar(o, campo); f.orden = o.campo; f.dir = o.dir; pintarFiltros(); pintar(); ctx.pDet.querySelector(`th[data-orden="${campo}"]`)?.focus(); }
    cont.addEventListener('keydown', (e) => { const col = e.target.closest?.('th[data-orden]'); if (col && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ordenarCol(col.dataset.orden); } });
    iniciar();
  }
  window.PANTALLAS['cxc-mensual'] = (cont) => reporteCxc(cont, 'MENSUAL');
  window.PANTALLAS['cxc-general'] = (cont) => reporteCxc(cont, 'GENERAL');
  window.PANTALLAS['cxc-periodo'] = (cont) => reporteCxc(cont, 'PERIODO');
})();
