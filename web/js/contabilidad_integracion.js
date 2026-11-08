// Contabilidad · Integraciones contables (auxiliares) y reportes de cierre (script 158).
// Integraciones: saldo contable de cada cuenta de control contra su auxiliar (bancos, cuentas por cobrar y por pagar,
// inventario, IVA débito y crédito del mes, sueldos por pagar), resumido o detallado por cuenta; análisis de cuenta.
// Reportes: estado de cambios en el patrimonio, estados comparativos, resultados por centro de costo, libro de
// inventarios y balances y bitácora de cierres. Usa window.CONTA (contabilidad_cierre.js).
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const C = () => window.CONTA;
  const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const q = (n) => `Q ${fmt.monto(n)}`;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const G = () => window.GRAFICAS;
  const sang = (n) => ' '.repeat(Math.max(0, n) * 3);
  const ini = (x) => `${x}T00:00:00-06:00`, fin = (x) => `${x}T23:59:59.999-06:00`;
  const empresaDe = (ctx) => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
  const NEUTROS = new Set([3, 4, 9, 10, 40, 41, 43, 44, 45, 46]);
  // La fecha contable (l.dia) la pone window.CONTA.leer.
  function conDia(base) { return base; }
  const leer = async (ctx, op) => conDia(await C().leer(ctx, op));

  // Pantalla de reporte con filtros, KPIs, tabla, gráficas y exportación.
  function reporte(cont, op) {
    const ctx = montar(cont, { titulo: op.titulo, icono: op.icono, clase: 'bk-movimientos bm-solo cx-rep pr-rep cr-conta', grupo: op.grupo });
    const f = { ...op.f(), graficas: true };
    let cfg = null, datos = null, cargado = '';
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', op.icono); return; }
      ctx.filtros(`${op.filtros(f, ctx, datos)}<label class="pc-check"><input type="checkbox" name="graficas" ${f.graficas ? 'checked' : ''}> Gráficas</label>`, C().botonesExp);
      await consultar();
    }
    async function consultar(forzar = false) {
      const clave = op.clave(f, ctx);
      if (forzar || clave !== cargado) {
        ctx.pDet.innerHTML = `<p class="vacio">${op.leyendo || 'Leyendo la contabilidad…'}</p>`;
        try { datos = await op.leer(ctx, f); cargado = clave; } catch (e) { return C().falta(ctx, e); }
        if (op.refiltrar) ctx.filtros(`${op.filtros(f, ctx, datos)}<label class="pc-check"><input type="checkbox" name="graficas" ${f.graficas ? 'checked' : ''}> Gráficas</label>`, C().botonesExp);
      }
      try { cfg = op.construir(ctx, f, datos); } catch (e) { ctx.pDet.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }
      cfg = { orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: op.titulo.slice(0, 30), archivo: op.archivo(f), titulo: op.titulo, ...cfg };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="cl-banda">${esc(cfg.titulo)} · ${esc(cfg.parametros.slice(0, 2).join(' · '))}</div>
        ${op.ayuda ? `<p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> ${op.ayuda}</p>` : ''}<div class="ec-kpis">${(cfg.kpis || []).map(([t, v, c]) => kpi(t, v, c)).join('')}</div>${C().tabla(cfg, f.graficas)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => {
      const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') { datos = null; return cargar(); }
      const n = e.target.name; if (!n) return;
      if (n === 'graficas') { f.graficas = e.target.checked; return consultar(); }
      f[n] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? (Number(e.target.value) || f[n]) : e.target.value;
      if (op.alCambiar) op.alCambiar(f, n);
      consultar();
    });
    cont.addEventListener('click', (e) => { const ex = e.target.closest('[data-exp]'); if (ex) C().exportar(cfg, ex.dataset.exp, f.graficas); });
    iniciar();
  }
  const selector = (n, lbl, opciones, v) => `<label class="campo"><span>${lbl}</span><select name="${n}">${opciones.map(([x, t]) => `<option value="${x}" ${String(v) === String(x) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  const fecha = (n, lbl, v) => `<label class="campo"><span>${lbl}</span><input type="date" name="${n}" value="${v}" max="${fmt.hoy()}"></label>`;

  // ===================== Integraciones contables =====================
  const INTEG = [['TODAS', 'Todas'], ['BANCOS', 'Bancos'], ['CXC', 'Cuentas por cobrar'], ['CXP', 'Cuentas por pagar'], ['INVENTARIO', 'Inventarios'], ['IVA_DEBITO', 'IVA débito fiscal (mes)'], ['IVA_CREDITO', 'IVA crédito fiscal (mes)'], ['NOMINA_POR_PAGAR', 'Sueldos por pagar']];
  async function leerIntegraciones(ctx, f) {
    const { sb } = ctx, loc = ctx.sel.loc, al = f.al, quiere = (k) => f.cual === 'TODAS' || f.cual === k;
    const K = await C().cuentasClave(ctx);
    const base = await leer(ctx, { locs: [loc], hasta: al });
    const k = (d) => (ctx.moneda(d.moneda_id)?.iso && ctx.moneda(d.moneda_id).iso !== 'GTQ' ? num(d.tipo_cambio) || 1 : 1);
    const contDe = (cod, filtro) => {
      const nat = base.porCodigo.get(cod)?.nat || 1, m = new Map();
      base.lineas.filter((l) => l.c && l.c.codigo.startsWith(cod) && (!filtro || filtro(l))).forEach((l) => { const a = m.get(l.c.codigo) || { codigo: l.c.codigo, nombre: l.c.nombre, valor: 0 }; a.valor += (num(l.debe) - num(l.haber)) * nat; m.set(l.c.codigo, a); });
      return [...m.values()].map((x) => ({ ...x, valor: r2(x.valor) })).filter((x) => Math.abs(x.valor) >= 0.005).sort((a, b) => a.codigo.localeCompare(b.codigo));
    };
    const out = [];
    const push = (clave, titulo, cuenta, aux, detAux, detCont, nota) => { const contable = r2(sum(detCont.map((x) => x.valor))); out.push({ clave, titulo, cuenta, contable, auxiliar: r2(aux), diferencia: r2(contable - aux), detAux, detCont, nota, estado: !cuenta ? 'SIN CUENTA' : Math.abs(contable - aux) < 0.01 ? 'CUADRA' : 'DIFERENCIA' }); };
    if (quiere('BANCOS')) {
      const { data: cbs } = await sb.from('cuentas_bancarias').select('id, numero, nombre, moneda_id, cuenta_id, cuentas(codigo, nombre)').eq('localidad_id', loc).order('id');
      const con = (cbs || []).filter((c) => c.cuentas?.codigo);
      const det = [];
      for (const c of con) { const { data: s } = await sb.rpc('saldo_cuenta_bancaria', { p_cuenta: c.id, p_hasta: al }); const tc = num(ctx.moneda(c.moneda_id)?.cambio) || 1; det.push({ codigo: c.cuentas.codigo, nombre: `${c.numero} · ${c.nombre}${tc !== 1 ? ` (${ctx.moneda(c.moneda_id)?.iso} × ${tc})` : ''}`, valor: r2(num(s) * tc) }); }
      const cods = [...new Set(con.map((c) => c.cuentas.codigo))];
      const detCont = cods.flatMap((cod) => contDe(cod, (l) => l.c.codigo === cod));
      push('BANCOS', 'Bancos', cods.join(', '), sum(det.map((x) => x.valor)), det, detCont, `${con.length} cuenta(s) bancaria(s) con cuenta contable; ${(cbs || []).length - con.length} sin enlazar`);
    }
    if (quiere('CXC')) {
      const cod = K.cuenta('CXC'); let det = [];
      const [fs, pg, nt] = await Promise.all([
        C().leerTodo(() => sb.from('facturas_venta').select('id, cliente_codigo, nombre, nit, moneda_id, tipo_cambio, saldo, estado').eq('localidad_id', loc).neq('estado', 'ANULADA').lte('fecha_emision', fin(al)).order('id')),
        C().leerTodo(() => sb.from('factura_venta_pagos').select('id, factura_id, valor, facturas_venta!inner(localidad_id)').eq('facturas_venta.localidad_id', loc).gt('fecha', fin(al)).order('id')),
        C().leerTodo(() => sb.from('notas_venta').select('id, factura_id, tipo, valor').eq('localidad_id', loc).neq('estado', 'ANULADA').not('factura_id', 'is', null).gt('fecha_emision', fin(al)).order('id'))]);
      const des = new Map(); const sm = (id, v) => des.set(id, (des.get(id) || 0) + v);
      pg.forEach((x) => sm(x.factura_id, num(x.valor))); nt.forEach((x) => sm(x.factura_id, x.tipo === 'DÉBITO' ? -num(x.valor) : num(x.valor)));
      const porCli = new Map();
      fs.forEach((d) => { const s = Math.max(0, r2(num(d.saldo) + (des.get(d.id) || 0))) * k(d); if (s < 0.005) return; const key = d.nit || d.nombre; const a = porCli.get(key) || { codigo: d.cliente_codigo ?? '', nombre: `${d.nombre || ''} · NIT ${d.nit || 'CF'}`, valor: 0, n: 0 }; a.valor += s; a.n++; porCli.set(key, a); });
      det = [...porCli.values()].map((x) => ({ ...x, valor: r2(x.valor), nombre: `${x.nombre} (${x.n} fact.)` })).sort((a, b) => b.valor - a.valor);
      push('CXC', 'Cuentas por cobrar clientes', cod, sum(det.map((x) => x.valor)), det, cod ? contDe(cod) : [], 'Saldo de facturas a la fecha (saldo actual + cobros y notas posteriores)');
    }
    if (quiere('CXP')) {
      const cod = K.cuenta('CXP');
      const cs = await C().leerTodo(() => sb.from('compras_saldo').select('id, proveedor_codigo, proveedor_nombre, nit, moneda_id, tipo_cambio, pendiente, estado').eq('localidad_id', loc).eq('estado', 'ACTIVA').lte('fecha_documento', al).order('id'));
      const des = new Map(); const ids = cs.map((x) => x.id);
      for (let i = 0; i < ids.length; i += 300) { const ab = await C().leerTodo(() => sb.from('compra_abonos').select('compra_id, valor').in('compra_id', ids.slice(i, i + 300)).gt('fecha', al).order('compra_id')); ab.forEach((x) => des.set(x.compra_id, (des.get(x.compra_id) || 0) + num(x.valor))); }
      const porP = new Map();
      cs.forEach((d) => { const s = Math.max(0, r2(num(d.pendiente) + (des.get(d.id) || 0))) * k(d); if (s < 0.005) return; const key = d.nit || d.proveedor_nombre; const a = porP.get(key) || { codigo: d.proveedor_codigo ?? '', nombre: `${d.proveedor_nombre || ''} · NIT ${d.nit || ''}`, valor: 0, n: 0 }; a.valor += s; a.n++; porP.set(key, a); });
      const det = [...porP.values()].map((x) => ({ ...x, valor: r2(x.valor), nombre: `${x.nombre} (${x.n} doc.)` })).sort((a, b) => b.valor - a.valor);
      push('CXP', 'Cuentas por pagar proveedores', cod, sum(det.map((x) => x.valor)), det, cod ? contDe(cod) : [], 'Saldo pendiente de compras a la fecha (pendiente actual + abonos posteriores)');
    }
    if (quiere('INVENTARIO')) {
      const cod = K.cuenta('INVENTARIO');
      const [ps, movs] = await Promise.all([C().leerTodo(() => sb.from('productos').select('id, codigo, codigo_producto, nombre, precio_costo').eq('localidad_id', loc).order('id')),
        C().leerTodo(() => sb.from('inventario_movimientos').select('id, producto_id, fecha, cantidad, costo_unitario, origen, tipo_movimiento, documento_inventario_lineas(documentos_inventario(tipo))').eq('localidad_id', loc).lte('fecha', al).order('fecha').order('id'))]);
      const prod = new Map(ps.map((p) => [p.id, p])), est = new Map();
      movs.forEach((m) => {
        let a = est.get(m.producto_id); if (!a) { a = { q: 0, prom: num(prod.get(m.producto_id)?.precio_costo) }; est.set(m.producto_id, a); }
        const c = num(m.cantidad), cu = num(m.costo_unitario), n = m.origen === 'TRASLADO' || NEUTROS.has(m.tipo_movimiento) || m.documento_inventario_lineas?.documentos_inventario?.tipo === 'AJUSTE LOTE';
        if (c > 0 && !n) { const costo = cu > 0 ? cu : a.prom; const v = Math.max(a.q, 0) * a.prom + c * costo; a.q += c; a.prom = a.q > 0 ? v / a.q : costo; } else a.q += c;
      });
      const det = [...est.entries()].map(([id, a]) => ({ codigo: prod.get(id)?.codigo_producto || prod.get(id)?.codigo || id, nombre: prod.get(id)?.nombre || `Producto ${id}`, valor: r2(Math.max(a.q, 0) * a.prom) })).filter((x) => x.valor >= 0.005).sort((a, b) => b.valor - a.valor);
      push('INVENTARIO', 'Inventarios', cod, sum(det.map((x) => x.valor)), det, cod ? contDe(cod) : [], 'Existencia por costo promedio ponderado a la fecha');
    }
    if ((quiere('IVA_DEBITO') || quiere('IVA_CREDITO')) && window.SAT_DATOS) {
      const desde = `${al.slice(0, 7)}-01`; const D = await window.SAT_DATOS(ctx, desde, al, { retenciones: false });
      const enMes = (l) => l.dia >= desde && l.dia <= al;
      if (quiere('IVA_DEBITO')) {
        const cod = K.cuenta('IVA_DEBITO'); const docs = [...D.ventas, ...D.notas];
        const det = [{ codigo: '', nombre: `Facturas y notas de ${MES[Number(al.slice(5, 7)) - 1]} (${docs.length})`, valor: r2(sum(docs.map((d) => d.iva))) }];
        const nat = base.porCodigo.get(cod)?.nat || -1;
        const detCont = cod ? contDe(cod, enMes).map((x) => ({ ...x, valor: r2(x.valor * (nat === -1 ? 1 : -1)) })) : [];
        push('IVA_DEBITO', 'IVA débito fiscal del mes', cod, det[0].valor, det, detCont, 'Movimiento del mes: IVA de ventas contra el haber de la cuenta');
      }
      if (quiere('IVA_CREDITO')) {
        const cod = K.cuenta('IVA_CREDITO');
        const det = [{ codigo: '', nombre: `Compras con período de ${MES[Number(al.slice(5, 7)) - 1]} (${D.compras.length})`, valor: r2(sum(D.compras.map((c) => c.iva))) }];
        const detCont = cod ? base.lineas.filter((l) => l.c && l.c.codigo.startsWith(cod) && enMes(l)).reduce((m, l) => { const a = m.get(l.c.codigo) || { codigo: l.c.codigo, nombre: l.c.nombre, valor: 0 }; a.valor += num(l.debe); m.set(l.c.codigo, a); return m; }, new Map()) : new Map();
        push('IVA_CREDITO', 'IVA crédito fiscal del mes', cod, det[0].valor, det, [...detCont.values()].map((x) => ({ ...x, valor: r2(x.valor) })), 'Movimiento del mes: IVA de compras contra el debe de la cuenta');
      }
    }
    if (quiere('NOMINA_POR_PAGAR')) {
      const cod = K.cuenta('NOMINA_POR_PAGAR');
      const { data: pl } = await sb.from('nom_planillas').select('id, numero, tipo, anio, mes, descripcion, total_liquido, estado, fecha_pago').eq('localidad_id', loc).eq('estado', 'APROBADA').order('numero');
      const det = (pl || []).filter((p) => !p.fecha_pago || p.fecha_pago <= al).map((p) => ({ codigo: String(p.numero), nombre: `${p.tipo} ${String(p.mes || '').padStart(2, '0')}/${p.anio} ${p.descripcion || ''}`, valor: r2(p.total_liquido) }));
      push('NOMINA_POR_PAGAR', 'Sueldos por pagar', cod, sum(det.map((x) => x.valor)), det, cod ? contDe(cod) : [], 'Planillas aprobadas pendientes de pago');
    }
    return { out, K };
  }
  function construirIntegraciones(ctx, f, D) {
    const { out } = D, det = f.contenido === 'DETALLADO';
    const filas = [];
    if (!det) out.forEach((x) => filas.push({ valores: [x.titulo, x.cuenta || '—', x.contable, x.auxiliar, x.diferencia, `¤${x.estado}`, x.nota], resaltar: x.estado === 'DIFERENCIA' }));
    else out.forEach((x) => {
      filas.push({ valores: [`${x.titulo} · cuenta ${x.cuenta || 'sin configurar'} · ${x.nota}`], tipo: 'grupo', combinar: true });
      filas.push({ valores: ['', 'Saldo contable por cuenta', '', '', '', ''], tipo: 'nota' });
      x.detCont.forEach((c) => filas.push({ valores: [c.codigo, `${sang(1)}${c.nombre}`, c.valor, '', '', ''] }));
      filas.push({ valores: ['', 'Total contable', x.contable, '', '', ''], tipo: 'subtotal' });
      filas.push({ valores: ['', 'Auxiliar del módulo', '', '', '', ''], tipo: 'nota' });
      x.detAux.forEach((a) => filas.push({ valores: [String(a.codigo ?? ''), `${sang(1)}${a.nombre}`, '', a.valor, '', ''] }));
      filas.push({ valores: ['', 'Total auxiliar', '', x.auxiliar, '', ''], tipo: 'subtotal' });
      filas.push({ valores: ['', `Diferencia ${x.titulo.toLowerCase()}`, x.contable, x.auxiliar, x.diferencia, `¤${x.estado}`], tipo: 'total', resaltar: x.estado === 'DIFERENCIA' });
    });
    const dif = out.filter((x) => x.estado === 'DIFERENCIA');
    return { titulo: f.titulo, parametros: [`Empresa: ${empresaDe(ctx)}`, `Al ${fmt.fechaDia(f.al)}`, `Integración: ${INTEG.find((x) => x[0] === f.cual)?.[1]}`, det ? 'Detallado por cuenta' : 'Resumido'],
      kpis: [['Integraciones', out.length], ['Cuadran', out.filter((x) => x.estado === 'CUADRA').length, 'ec-fin'], ['Con diferencia', dif.length, dif.length ? 'ec-alerta' : ''], ['Sin cuenta', out.filter((x) => x.estado === 'SIN CUENTA').length]],
      columnas: det ? [col('Código', 'texto', 14), col('Cuenta / auxiliar', 'texto', 48), col('Contable Q', 'monto', 16), col('Auxiliar Q', 'monto', 16), col('Diferencia Q', 'monto', 15), col('Estado', 'texto', 11)]
        : [col('Integración', 'texto', 28), col('Cuenta de control', 'texto', 16), col('Saldo contable Q', 'monto', 16), col('Saldo auxiliar Q', 'monto', 16), col('Diferencia Q', 'monto', 15), col('Estado', 'texto', 11), col('Base del auxiliar', 'texto', 40)],
      filas, firmas: ['Elaborado por', 'Contador general'],
      graficas: [G().columnas('Saldo contable vs. auxiliar (Q)', out.map((x) => x.titulo.slice(0, 14)), [{ nombre: 'Contable', color: G().COLORES.AZUL, valores: out.map((x) => Math.abs(x.contable)) }, { nombre: 'Auxiliar', color: G().COLORES.NARANJA, valores: out.map((x) => Math.abs(x.auxiliar)) }], (v) => fmt.monto(v))] };
  }
  const opInteg = (titulo, grupo) => ({ titulo, icono: 'ti-arrows-join', grupo, leyendo: 'Integrando saldos contables y auxiliares…',
    ayuda: 'Compara el saldo de cada cuenta de control (Catálogos › Cuentas de integración) con el auxiliar del módulo. Bancos usa la cuenta contable de cada cuenta bancaria; el IVA compara el movimiento del mes de la fecha.',
    f: () => ({ al: fmt.hoy(), cual: 'TODAS', contenido: 'RESUMIDO', titulo }),
    filtros: (f) => `${fecha('al', 'Al', f.al)}${selector('cual', 'Integración', INTEG, f.cual)}${selector('contenido', 'Contenido', [['RESUMIDO', 'Resumido'], ['DETALLADO', 'Detallado por cuenta']], f.contenido)}`,
    clave: (f, ctx) => `${ctx.sel.loc}|${f.al}|${f.cual}`, leer: leerIntegraciones, construir: construirIntegraciones, archivo: (f) => `integraciones_${f.al}` });
  window.PANTALLAS['con-integraciones'] = (cont) => reporte(cont, opInteg('Integraciones contables', 'Contabilidad · Procesos'));
  window.PANTALLAS['rep-integraciones'] = (cont) => reporte(cont, opInteg('Integraciones contables', 'Contabilidad · Reportes'));

  // ===================== Análisis de cuenta =====================
  window.PANTALLAS['con-analisis-cuenta'] = (cont) => reporte(cont, { titulo: 'Análisis de cuenta', icono: 'ti-zoom-money', grupo: 'Contabilidad · Procesos', refiltrar: true,
    ayuda: 'Integración analítica de una cuenta (o de una cuenta mayor con todas sus subcuentas): saldo inicial, movimientos agrupados y saldo final.',
    f: () => { const h = fmt.hoy(); return { cuenta: '', desde: `${h.slice(0, 4)}-01-01`, al: h, agrupar: 'MES', contenido: 'RESUMIDO' }; },
    filtros: (f, ctx, D) => `<label class="campo cx-prov pr-prod"><span>Cuenta</span><input name="cuenta" list="ac-cuentas" value="${esc(f.cuenta)}" placeholder="Código de la cuenta" autocomplete="off"></label><datalist id="ac-cuentas">${(D?.cs || []).map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>
      ${fecha('desde', 'Desde', f.desde)}${fecha('al', 'Al', f.al)}${selector('agrupar', 'Agrupar por', [['MES', 'Mes'], ['CENTRO', 'Centro de costo'], ['TIPO', 'Tipo de partida'], ['SUBCUENTA', 'Subcuenta'], ['CONCEPTO', 'Concepto']], f.agrupar)}${selector('contenido', 'Contenido', [['RESUMIDO', 'Resumido'], ['DETALLADO', 'Detallado']], f.contenido)}`,
    clave: (f, ctx) => `${ctx.sel.loc}|${f.al}`,
    leer: async (ctx, f) => { const [base, cs] = await Promise.all([leer(ctx, { locs: [ctx.sel.loc], hasta: f.al }), C().cuentasEmpresa(ctx)]); const ids = [...new Set(base.lineas.map((l) => l.centro_id).filter(Boolean))]; const { data: ce } = ids.length ? await ctx.sb.from('centros_costo').select('id, codigo, nombre').in('id', ids) : { data: [] }; return { base, cs, centros: new Map((ce || []).map((c) => [c.id, c])) }; },
    construir: (ctx, f, D) => {
      const cod = (f.cuenta || '').split(' ')[0].trim();
      if (!cod) return { parametros: [`Empresa: ${empresaDe(ctx)}`, 'Elige la cuenta'], filas: [], columnas: [col('Cuenta', 'texto', 30)], vacio: 'Escribe o elige el código de la cuenta a analizar.' };
      const cta = D.base.porCodigo.get(cod) || D.cs.find((c) => c.codigo === cod); const nat = D.base.porCodigo.get(cod)?.nat || 1;
      const ls = D.base.lineas.filter((l) => l.c && l.c.codigo.startsWith(cod)).sort((a, b) => a.dia.localeCompare(b.dia) || a.p.numero - b.p.numero);
      const ant = ls.filter((l) => l.dia < f.desde), per = ls.filter((l) => l.dia >= f.desde && l.dia <= f.al);
      const sIni = sum(ant.map((l) => (num(l.debe) - num(l.haber)) * nat));
      const grupoDe = (l) => (f.agrupar === 'MES' ? l.dia.slice(0, 7) : f.agrupar === 'CENTRO' ? (D.centros.get(l.centro_id) ? `${D.centros.get(l.centro_id).codigo} · ${D.centros.get(l.centro_id).nombre}` : 'Sin centro de costo') : f.agrupar === 'TIPO' ? (l.siglas || 'P') : f.agrupar === 'SUBCUENTA' ? `${l.c.codigo} · ${l.c.nombre}` : (l.concepto || l.p.descripcion || '').toUpperCase().slice(0, 60));
      const etiqueta = (g) => (f.agrupar === 'MES' ? `${MES[Number(g.slice(5, 7)) - 1]} ${g.slice(0, 4)}` : g);
      const gs = new Map(); per.forEach((l) => { const g = grupoDe(l); const a = gs.get(g) || []; a.push(l); gs.set(g, a); });
      const filas = [{ valores: ['', 'SALDO INICIAL', '', '', r2(sIni)], tipo: 'nota' }]; let s = sIni;
      [...gs.keys()].sort().forEach((g) => {
        const xs = gs.get(g), d = sum(xs.map((l) => l.debe)), h = sum(xs.map((l) => l.haber));
        if (f.contenido === 'DETALLADO') { filas.push({ valores: [etiqueta(g)], tipo: 'grupo', combinar: true }); xs.forEach((l) => { s += (num(l.debe) - num(l.haber)) * nat; filas.push({ valores: [`${fmt.fechaDia(l.dia)} ${C().docPart(l)}`, l.concepto || l.p.descripcion || '', num(l.debe) ? r2(l.debe) : '', num(l.haber) ? r2(l.haber) : '', r2(s)] }); }); filas.push({ valores: ['', `Total ${etiqueta(g)}`, r2(d), r2(h), r2(s)], tipo: 'subtotal' }); }
        else { s += (d - h) * nat; filas.push({ valores: [etiqueta(g), `${xs.length} movimiento(s)`, r2(d), r2(h), r2(s)] }); }
      });
      const td = sum(per.map((l) => l.debe)), th = sum(per.map((l) => l.haber));
      filas.push({ valores: ['SALDO FINAL', '', r2(td), r2(th), r2(s)], tipo: 'total' });
      const top = [...gs.entries()].map(([g, xs]) => ({ etiqueta: etiqueta(g), valor: sum(xs.map((l) => num(l.debe) + num(l.haber))), texto: q(sum(xs.map((l) => num(l.debe) + num(l.haber)))) })).sort((a, b) => b.valor - a.valor).slice(0, 12);
      return { titulo: `Análisis de cuenta ${cod}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `${cod} · ${cta?.nombre || 'cuenta no encontrada'}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.al)}`, `Agrupado por ${f.agrupar.toLowerCase()}`],
        kpis: [['Saldo inicial', q(sIni)], ['Debe', q(td)], ['Haber', q(th)], ['Saldo final', q(s), 'ec-fin']], filas,
        columnas: [col(f.contenido === 'DETALLADO' ? 'Fecha · partida' : 'Grupo', 'texto', 30), col('Concepto', 'texto', 46), col('Debe', 'monto', 15), col('Haber', 'monto', 15), col('Saldo', 'monto', 16)],
        graficas: [G().barras('Movimiento por grupo (debe + haber)', top)] };
    }, archivo: (f) => `analisis_${(f.cuenta || '').split(' ')[0]}_${f.al}` });

  // Balance a una fecha: valores por código de las cuentas de balance más los resultados no cerrados.
  function balanceAl(base, al) {
    const ini0 = `${al.slice(0, 4)}-01-01`;
    const todo = C().saldos(base, (l) => l.dia <= al);
    const res = (pred) => sum(base.lineas.filter((l) => l.c && pred(l) && base.porCodigo.get(l.c.codigo)?.reporte === 'E').map((l) => num(l.haber) - num(l.debe)));
    return { todo, rEj: res((l) => l.dia >= ini0 && l.dia <= al), rAnt: res((l) => l.dia < ini0) };
  }
  const valor = (base, mapa, cod) => { const c = base.porCodigo.get(cod), x = mapa.get(cod); return x ? (x.d - x.h) * (c?.nat || 1) : 0; };
  const esPatrimonio = (c) => c.nat === -1 && /PATRIMONIO|CAPITAL/i.test(`${c.nombre} ${c.tipoDesc}`);

  // ===================== Estados financieros comparativos =====================
  window.PANTALLAS['estados-comparativos'] = (cont) => reporte(cont, { titulo: 'Estados financieros comparativos', icono: 'ti-arrows-diff', grupo: 'Contabilidad · Reportes',
      ayuda: 'Balance general o estado de resultados de dos fechas lado a lado con la variación absoluta y relativa. El estado de resultados compara del 1 de enero a cada fecha, sin la partida de cierre.',
      f: () => { const h = fmt.hoy(); return { estado: 'BALANCE', a: h, b: `${Number(h.slice(0, 4)) - 1}${h.slice(4)}`, nivel: 3, alcance: 'EMPRESA' }; },
      filtros: (f) => `${selector('estado', 'Estado', [['BALANCE', 'Balance general'], ['RESULTADOS', 'Estado de resultados']], f.estado)}${selector('alcance', 'Alcance', [['EMPRESA', 'Empresa'], ['CONSOLIDADO', 'Consolidado organización']], f.alcance)}${fecha('a', 'Período actual al', f.a)}${fecha('b', 'Comparar con', f.b)}${selector('nivel', 'Nivel', [1, 2, 3, 4, 5].map((n) => [n, n]), f.nivel)}`,
      alCambiar: (f, n) => { if (n === 'nivel') f.nivel = Number(f.nivel); },
      clave: (f, ctx) => `${ctx.sel.loc}|${f.alcance}|${f.a > f.b ? f.a : f.b}`,
      leer: (ctx, f) => leer(ctx, { locs: f.alcance === 'CONSOLIDADO' ? ctx.localidades.filter((l) => l.organizacion_id === ctx.sel.org).map((l) => l.id) : [ctx.sel.loc], hasta: f.a > f.b ? f.a : f.b }),
      construir: (ctx, f, base) => {
        const A = f.a, B = f.b, nivel = Number(f.nivel), filas = [];
        const fila = (c, va, vb, tipo) => ({ valores: [c.codigo || '', `${sang((c.nivel || 1) - 1)}${c.nombre}`, r2(va), r2(vb), r2(va - vb), vb ? (va - vb) / Math.abs(vb) : 0], tipo: tipo || (c.nivel === 1 ? 'grupo' : c.nivel === 2 ? 'subtotal' : undefined) });
        const visibles = (pred) => [...base.porCodigo.values()].filter((c) => c.nivel <= nivel && pred(c)).sort((x, y) => x.codigo.localeCompare(y.codigo));
        let kpis = [];
        if (f.estado === 'BALANCE') {
          const ba = balanceAl(base, A), bb = balanceAl(base, B);
          const clases = visibles((c) => c.nivel === 1 && c.reporte === 'B');
          let act = [0, 0], pp = [0, 0];
          clases.forEach((cl) => {
            visibles((c) => c.codigo.startsWith(cl.codigo) && c.reporte === 'B').forEach((c) => { const va = valor(base, ba.todo, c.codigo), vb = valor(base, bb.todo, c.codigo); if (Math.abs(va) >= 0.005 || Math.abs(vb) >= 0.005) filas.push(fila(c, va, vb)); });
            let ta = valor(base, ba.todo, cl.codigo), tb = valor(base, bb.todo, cl.codigo);
            if (esPatrimonio(cl)) { filas.push(fila({ nombre: 'Resultados de ejercicios anteriores no cerrados', nivel: 2 }, ba.rAnt, bb.rAnt, '')); filas.push(fila({ nombre: 'Resultado del ejercicio', nivel: 2 }, ba.rEj, bb.rEj, '')); ta += ba.rAnt + ba.rEj; tb += bb.rAnt + bb.rEj; }
            filas.push(fila({ nombre: `TOTAL ${cl.nombre}`, nivel: 1 }, ta, tb, 'total'));
            if (cl.nat === 1) { act[0] += ta; act[1] += tb; } else { pp[0] += ta; pp[1] += tb; }
          });
          filas.push(fila({ nombre: 'TOTAL PASIVO Y PATRIMONIO', nivel: 1 }, pp[0], pp[1], 'total'));
          kpis = [['Activo actual', q(act[0])], ['Activo anterior', q(act[1])], ['Variación', q(act[0] - act[1]), act[0] >= act[1] ? 'ec-fin' : 'ec-alerta'], ['Cuadre', Math.abs(act[0] - pp[0]) < 0.01 && Math.abs(act[1] - pp[1]) < 0.01 ? 'Cuadra' : 'Revisar', Math.abs(act[0] - pp[0]) < 0.01 ? 'ec-fin' : 'ec-alerta']];
        } else {
          const per = (al) => { const d0 = `${al.slice(0, 4)}-01-01`; return C().saldos(base, (l) => l.dia >= d0 && l.dia <= al && l.siglas !== 'PCR'); };
          const pa = per(A), pb = per(B), v = (m, cod) => { const x = m.get(cod); return x ? x.h - x.d : 0; };
          const secs = visibles((c) => c.nivel === 1 && c.reporte === 'E'); let ra = 0, rb = 0;
          secs.forEach((s) => {
            const sg = s.nat === -1 ? 1 : -1;
            visibles((c) => c.codigo.startsWith(s.codigo) && c.reporte === 'E').forEach((c) => { const va = sg * v(pa, c.codigo), vb = sg * v(pb, c.codigo); if (Math.abs(va) >= 0.005 || Math.abs(vb) >= 0.005) filas.push(fila(c, va, vb)); });
            ra += v(pa, s.codigo); rb += v(pb, s.codigo);
          });
          filas.push(fila({ nombre: 'UTILIDAD (PÉRDIDA) NETA', nivel: 1 }, ra, rb, 'total'));
          kpis = [['Resultado actual', q(ra), ra >= 0 ? 'ec-fin' : 'ec-alerta'], ['Resultado anterior', q(rb)], ['Variación', q(ra - rb)], ['Variación %', rb ? `${(((ra - rb) / Math.abs(rb)) * 100).toFixed(1)} %` : '—']];
        }
        const n1 = filas.filter((r) => r.tipo === 'total');
        return { titulo: f.estado === 'BALANCE' ? 'Balance general comparativo' : 'Estado de resultados comparativo', parametros: [f.alcance === 'CONSOLIDADO' ? 'Consolidado de la organización' : `Empresa: ${empresaDe(ctx)}`, f.estado === 'BALANCE' ? `Al ${fmt.fechaDia(A)} y al ${fmt.fechaDia(B)}` : `Del 01/01 al ${fmt.fechaDia(A)} y del 01/01 al ${fmt.fechaDia(B)}`, `Nivel ${nivel}`],
          kpis, filas, firmas: ['Representante legal', 'Contador general'],
          columnas: [col('Cuenta', 'texto', 13), col('Nombre de la cuenta', 'texto', 44), col(fmt.fechaDia(A), 'monto', 16), col(fmt.fechaDia(B), 'monto', 16), col('Variación Q', 'monto', 15), col('Var. %', 'porcentaje', 9)],
          graficas: [G().columnas('Totales comparados (Q)', n1.map((r) => String(r.valores[1]).trim().replace('TOTAL ', '').slice(0, 14)), [{ nombre: fmt.fechaDia(A), color: G().COLORES.AZUL, valores: n1.map((r) => Math.abs(r.valores[2])) }, { nombre: fmt.fechaDia(B), color: G().COLORES.NARANJA, valores: n1.map((r) => Math.abs(r.valores[3])) }], (x) => fmt.monto(x))] };
      }, archivo: (f) => `comparativo_${f.estado.toLowerCase()}_${f.a}` });

  // ===================== Estado de cambios en el patrimonio =====================
  window.PANTALLAS['estado-cambios-patrimonio'] = (cont) => reporte(cont, { titulo: 'Estado de cambios en el patrimonio', icono: 'ti-building-bank', grupo: 'Contabilidad · Reportes',
    ayuda: 'Movimiento de cada cuenta del patrimonio en el período: saldo inicial, resultado del período, cierre de resultados, reserva legal y traslados, y otros movimientos (aportes, dividendos, ajustes).',
    f: () => { const h = fmt.hoy(); return { desde: `${h.slice(0, 4)}-01-01`, al: h }; },
    filtros: (f) => `${fecha('desde', 'Desde', f.desde)}${fecha('al', 'Al', f.al)}`,
    clave: (f, ctx) => `${ctx.sel.loc}|${f.al}`, leer: (ctx, f) => leer(ctx, { locs: [ctx.sel.loc], hasta: f.al }),
    construir: (ctx, f, base) => {
      const cls = [...base.porCodigo.values()].filter((c) => c.nivel === 1 && esPatrimonio(c));
      const cols = [...base.porCodigo.values()].filter((c) => c.nivel === 2 && cls.some((k) => c.codigo.startsWith(k.codigo))).sort((a, b) => a.codigo.localeCompare(b.codigo));
      const colDe = (l) => { if (!l.c) return null; if (base.porCodigo.get(l.c.codigo)?.reporte === 'E') return 'E'; const c = cols.find((x) => l.c.codigo.startsWith(x.codigo)); return c ? c.codigo : null; };
      const keys = [...cols.map((c) => c.codigo), 'E'];
      const vacio = () => Object.fromEntries(keys.map((k) => [k, 0]));
      const ini0 = vacio(); base.lineas.filter((l) => l.dia < f.desde).forEach((l) => { const k = colDe(l); if (k) ini0[k] += num(l.haber) - num(l.debe); });
      const CATS = ['Resultado del período', 'Cierre de resultados del ejercicio', 'Reserva legal y traslado de resultados', 'Aportes, dividendos y otros movimientos'];
      const mov = CATS.map(() => vacio());
      base.lineas.filter((l) => l.dia >= f.desde && l.dia <= f.al).forEach((l) => { const k = colDe(l); if (!k) return; const i = l.siglas === 'PCR' ? 1 : l.p.cierre_ejercicio === 'DIST' ? 2 : k === 'E' ? 0 : 3; mov[i][k] += num(l.haber) - num(l.debe); });
      const finl = vacio(); keys.forEach((k) => { finl[k] = ini0[k] + sum(mov.map((m) => m[k])); });
      const fila = (t, o, tipo) => ({ valores: [t, ...keys.map((k) => r2(o[k])), r2(sum(keys.map((k) => o[k])))], tipo });
      const filas = [fila(`Saldo al ${fmt.fechaDia(f.desde)}`, ini0, 'subtotal'), ...CATS.map((t, i) => fila(t, mov[i])).filter((r) => r.valores.slice(1).some((v) => Math.abs(v) >= 0.005)), fila(`Saldo al ${fmt.fechaDia(f.al)}`, finl, 'total')];
      const tot = sum(keys.map((k) => finl[k]));
      return { parametros: [`Empresa: ${empresaDe(ctx)}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.al)}`, 'Cifras en quetzales'],
        kpis: [['Patrimonio inicial', q(sum(keys.map((k) => ini0[k])))], ['Resultado del período', q(sum(keys.map((k) => mov[0][k]))), sum(keys.map((k) => mov[0][k])) >= 0 ? 'ec-fin' : 'ec-alerta'], ['Otros movimientos', q(sum(keys.map((k) => mov[3][k])))], ['Patrimonio final', q(tot), 'ec-fin']],
        columnas: [col('Concepto', 'texto', 34), ...cols.map((c) => col(c.nombre.slice(0, 22), 'monto', 15)), col('Resultado no cerrado', 'monto', 15), col('Total patrimonio', 'monto', 16)], filas, firmas: ['Representante legal', 'Contador general'],
        graficas: [G().barras('Patrimonio final por componente (Q)', [...cols.map((c) => ({ etiqueta: c.nombre, valor: Math.abs(finl[c.codigo]), texto: q(finl[c.codigo]) })), { etiqueta: 'Resultado no cerrado', valor: Math.abs(finl.E), texto: q(finl.E) }].filter((x) => x.valor >= 0.005), G().COLORES.VERDE)] };
    }, archivo: (f) => `cambios_patrimonio_${f.al}` });

  // ===================== Resultados por centro de costo =====================
  window.PANTALLAS['resultados-centro-costo'] = (cont) => reporte(cont, { titulo: 'Resultados por centro de costo', icono: 'ti-hierarchy-2', grupo: 'Contabilidad · Reportes',
    ayuda: 'Estado de resultados con una columna por centro de costo principal (las líneas sin centro van aparte). Sin la partida de cierre de resultados.',
    f: () => { const h = fmt.hoy(); return { desde: `${h.slice(0, 4)}-01-01`, al: h, nivel: 2 }; },
    filtros: (f) => `${fecha('desde', 'Desde', f.desde)}${fecha('al', 'Al', f.al)}${selector('nivel', 'Nivel', [1, 2, 3, 4, 5].map((n) => [n, n]), f.nivel)}`,
    clave: (f, ctx) => `${ctx.sel.loc}|${f.desde}|${f.al}`,
    leer: async (ctx, f) => { const base = await leer(ctx, { locs: [ctx.sel.loc], hasta: f.al, desde: f.desde }); const { data: ce } = await ctx.sb.from('centros_costo').select('id, codigo, nombre, centro_mayor_id, nivel').eq('organizacion_id', ctx.sel.org); return { base, centros: new Map((ce || []).map((c) => [c.id, c])) }; },
    construir: (ctx, f, D) => {
      const { base, centros } = D, nivel = Number(f.nivel);
      const raiz = (id) => { let c = centros.get(id); const seen = new Set(); while (c && c.centro_mayor_id && centros.get(c.centro_mayor_id) && !seen.has(c.id)) { seen.add(c.id); c = centros.get(c.centro_mayor_id); } return c; };
      const ls = base.lineas.filter((l) => l.c && base.porCodigo.get(l.c.codigo)?.reporte === 'E' && l.siglas !== 'PCR');
      const vol = new Map(); ls.forEach((l) => { const r = raiz(l.centro_id); const k = r ? r.id : 0; vol.set(k, (vol.get(k) || 0) + num(l.debe) + num(l.haber)); });
      let ks = [...vol.keys()].filter((k) => k).sort((a, b) => vol.get(b) - vol.get(a)); const otros = ks.slice(7); ks = ks.slice(0, 7);
      const colK = (l) => { const r = raiz(l.centro_id); const k = r ? r.id : 0; return !k ? 'SIN' : ks.includes(k) ? k : 'OTROS'; };
      const claves = [...ks, ...(otros.length ? ['OTROS'] : []), ...(vol.has(0) ? ['SIN'] : [])];
      const porK = new Map(claves.map((k) => [k, C().saldos({ ...base, lineas: ls.filter((l) => colK(l) === k) })]));
      const tot = C().saldos({ ...base, lineas: ls });
      const v = (m, cod) => { const x = m.get(cod); return x ? x.h - x.d : 0; };
      const cs = [...tot.keys()].map((k) => base.porCodigo.get(k)).filter((c) => c && c.nivel <= nivel).sort((a, b) => a.codigo.localeCompare(b.codigo));
      const filas = [];
      cs.forEach((c) => { const sg = c.nat === -1 ? 1 : -1; filas.push({ valores: [c.codigo, `${sang(c.nivel - 1)}${c.nombre}`, ...claves.map((k) => r2(sg * v(porK.get(k), c.codigo))), r2(sg * v(tot, c.codigo))], tipo: c.nivel === 1 ? 'grupo' : undefined }); });
      const res = (m) => sum(cs.filter((c) => c.nivel === 1).map((c) => v(m, c.codigo)));
      filas.push({ valores: ['', 'UTILIDAD (PÉRDIDA) DEL PERÍODO', ...claves.map((k) => r2(res(porK.get(k)))), r2(res(tot))], tipo: 'total' });
      const nom = (k) => (k === 'SIN' ? 'Sin centro' : k === 'OTROS' ? 'Otros centros' : `${centros.get(k)?.codigo || ''} ${centros.get(k)?.nombre || ''}`.trim());
      return { parametros: [`Empresa: ${empresaDe(ctx)}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.al)}`, `Nivel ${nivel}`],
        kpis: [['Centros', ks.length + otros.length], ['Resultado total', q(res(tot)), res(tot) >= 0 ? 'ec-fin' : 'ec-alerta'], ['Sin centro', q(vol.has(0) ? res(porK.get('SIN')) : 0)]],
        columnas: [col('Cuenta', 'texto', 12), col('Nombre', 'texto', 34), ...claves.map((k) => col(nom(k).slice(0, 18), 'monto', 14)), col('Total', 'monto', 15)], filas,
        graficas: [G().barras('Resultado por centro de costo (Q)', claves.map((k) => ({ etiqueta: nom(k), valor: Math.abs(res(porK.get(k))), texto: q(res(porK.get(k))) })))] };
    }, archivo: (f) => `resultados_centro_${f.al}` });

  // ===================== Libro de inventarios y balances =====================
  window.PANTALLAS['libro-inventarios-balances'] = (cont) => reporte(cont, { titulo: 'Libro de inventarios y balances', icono: 'ti-book', grupo: 'Contabilidad · Reportes', refiltrar: true,
    ayuda: 'Inventario de todas las cuentas de balance con su saldo al cierre y el resumen del estado de resultados del ejercicio, listo para transcribir o imprimir en las hojas autorizadas por la SAT (Código de Comercio, art. 368). El folio inicial se toma del libro autorizado.',
    f: () => ({ anio: Number(fmt.hoy().slice(0, 4)) - 1, folio: '' }),
    filtros: (f, ctx, D) => `<label class="campo cx-anio"><span>Ejercicio</span><input type="number" name="anio" min="2000" max="2999" value="${f.anio}"></label><label class="campo"><span>Folio inicial</span><input type="number" name="folio" min="1" value="${f.folio || D?.folio || 1}"></label>`,
    clave: (f, ctx) => `${ctx.sel.loc}|${f.anio}`,
    leer: async (ctx, f) => { const al = `${f.anio}-12-31`; const [base, lb] = await Promise.all([leer(ctx, { locs: [ctx.sel.loc], hasta: al > fmt.hoy() ? fmt.hoy() : al }), ctx.sb.from('libros_autorizados').select('*').eq('localidad_id', ctx.sel.loc).eq('libro', 'INVENTARIOS Y BALANCES').eq('activo', true).limit(1)]); const l = lb.data?.[0]; return { base, libro: l, folio: l ? Math.max(l.folio_usado + 1, l.folio_inicial) : 1 }; },
    construir: (ctx, f, D) => {
      const { base } = D, al = `${f.anio}-12-31` > fmt.hoy() ? fmt.hoy() : `${f.anio}-12-31`;
      const b = balanceAl(base, al), filas = [];
      const clases = [...b.todo.keys()].map((k) => base.porCodigo.get(k)).filter((c) => c && c.nivel === 1 && c.reporte === 'B').sort((x, y) => x.codigo.localeCompare(y.codigo));
      filas.push({ valores: ['INVENTARIO DE CUENTAS DE BALANCE'], tipo: 'grupo', combinar: true });
      let act = 0, pp = 0;
      clases.forEach((cl) => {
        [...b.todo.keys()].map((k) => base.porCodigo.get(k)).filter((c) => c && c.codigo.startsWith(cl.codigo)).sort((x, y) => x.codigo.localeCompare(y.codigo)).forEach((c) => { const vv = valor(base, b.todo, c.codigo); if (Math.abs(vv) >= 0.005) filas.push({ valores: [c.codigo, `${sang(c.nivel - 1)}${c.nombre}`, c.integra ? '' : r2(vv), c.integra ? r2(vv) : ''], tipo: c.nivel === 1 ? 'subtotal' : undefined }); });
        let t = valor(base, b.todo, cl.codigo);
        if (esPatrimonio(cl)) { if (Math.abs(b.rAnt) >= 0.005) filas.push({ valores: ['', `${sang(1)}Resultados de ejercicios anteriores no cerrados`, r2(b.rAnt), ''] }); filas.push({ valores: ['', `${sang(1)}Resultado del ejercicio ${f.anio} no trasladado`, r2(b.rEj), ''] }); t += b.rAnt + b.rEj; }
        filas.push({ valores: [`TOTAL ${cl.nombre}`, '', '', r2(t)], tipo: 'total' });
        if (cl.nat === 1) act += t; else pp += t;
      });
      filas.push({ valores: ['TOTAL PASIVO Y PATRIMONIO', '', '', r2(pp)], tipo: 'total' });
      const per = C().saldos(base, (l) => l.dia >= `${f.anio}-01-01` && l.dia <= al && l.siglas !== 'PCR');
      const secs = [...per.keys()].map((k) => base.porCodigo.get(k)).filter((c) => c && c.reporte === 'E' && c.nivel <= 2).sort((x, y) => x.codigo.localeCompare(y.codigo));
      filas.push({ valores: [`ESTADO DE RESULTADOS DEL 01/01/${f.anio} AL ${fmt.fechaDia(al)}`], tipo: 'grupo', combinar: true });
      let r = 0; secs.forEach((c) => { const x = per.get(c.codigo), vv = x ? x.h - x.d : 0; if (c.nivel === 1) r += vv; filas.push({ valores: [c.codigo, `${sang(c.nivel - 1)}${c.nombre}`, c.nivel === 2 ? r2(Math.abs(vv)) : '', c.nivel === 1 ? r2(Math.abs(vv)) : ''], tipo: c.nivel === 1 ? 'subtotal' : undefined }); });
      filas.push({ valores: ['UTILIDAD (PÉRDIDA) NETA DEL EJERCICIO', '', '', r2(r)], tipo: 'total' });
      const folio = Number(f.folio) || D.folio;
      return { parametros: [`Empresa: ${empresaDe(ctx)}`, `Al ${fmt.fechaDia(al)}`, D.libro ? `Libro autorizado: resolución ${D.libro.resolucion || '—'} · folio inicial ${folio}` : `Folio inicial ${folio} (registra el libro en Catálogos › Libros autorizados SAT)`],
        kpis: [['Activo', q(act)], ['Pasivo + patrimonio', q(pp)], ['Cuadre', Math.abs(act - pp) < 0.01 ? 'Cuadra' : `Dif. Q ${fmt.monto(act - pp)}`, Math.abs(act - pp) < 0.01 ? 'ec-fin' : 'ec-alerta'], [`Resultado ${f.anio}`, q(r), r >= 0 ? 'ec-fin' : 'ec-alerta']],
        columnas: [col('Cuenta', 'texto', 14), col('Nombre de la cuenta', 'texto', 52), col('Parcial Q', 'monto', 16), col('Total Q', 'monto', 16)], filas, firmas: ['Representante legal', 'Contador general'], graficas: [] };
    }, archivo: (f) => `libro_inventarios_${f.anio}` });

  // ===================== Bitácora de cierres =====================
  window.PANTALLAS['bitacora-cierres'] = (cont) => reporte(cont, { titulo: 'Bitácora de cierres', icono: 'ti-history', grupo: 'Contabilidad · Reportes',
    ayuda: 'Quién cerró y reabrió cada mes y ejercicio, cuándo y por qué, y las partidas que generaron los procesos automáticos.',
    f: () => ({ anio: Number(fmt.hoy().slice(0, 4)) }),
    filtros: (f) => `<label class="campo cx-anio"><span>Año</span><input type="number" name="anio" min="2000" max="2999" value="${f.anio}"></label>`,
    clave: (f, ctx) => `${ctx.sel.loc}|${f.anio}`,
    leer: async (ctx, f) => {
      const { sb } = ctx, loc = ctx.sel.loc;
      const [cm, ej, gen] = await Promise.all([sb.from('cierres_mes').select('*').eq('localidad_id', loc).eq('anio', f.anio), sb.from('ejercicios_contables').select('*').eq('localidad_id', loc).eq('anio', f.anio),
        sb.from('partidas_generadas').select('origen, anio, mes, monto, usuario, creado_en, partidas!inner(numero, estado, descripcion)').eq('localidad_id', loc).eq('anio', f.anio).order('creado_en')]);
      if (ej.error) throw ej.error;
      const ev = [];
      (cm.data || []).forEach((c) => { if (c.cerrado_en) ev.push({ f: c.cerrado_en, per: `${MES[c.mes - 1]} ${c.anio}`, ev: 'Cierre de mes', u: c.cerrado_por, d: c.cerrado ? 'Vigente' : 'Reabierto después' }); if (c.reabierto_en) ev.push({ f: c.reabierto_en, per: `${MES[c.mes - 1]} ${c.anio}`, ev: 'Reapertura de mes', u: c.reabierto_por, d: c.motivo_reapertura || '' }); });
      (ej.data || []).forEach((e) => { if (e.cerrado_en) ev.push({ f: e.cerrado_en, per: `Ejercicio ${e.anio}`, ev: 'Cierre del ejercicio', u: e.cerrado_por, d: `Resultado Q ${fmt.monto(e.resultado)} · reserva Q ${fmt.monto(e.reserva_legal)}${e.estado === 'CERRADO' ? '' : ' (reabierto)'}` }); if (e.reabierto_en) ev.push({ f: e.reabierto_en, per: `Ejercicio ${e.anio}`, ev: 'Reapertura del ejercicio', u: e.reabierto_por, d: e.motivo_reapertura || '' }); });
      (gen.data || []).forEach((g) => ev.push({ f: g.creado_en, per: `${MES[g.mes - 1]} ${g.anio}`, ev: `Partida automática (${g.origen.toLowerCase()})`, u: g.usuario, d: `No. ${g.partidas.numero} · Q ${fmt.monto(g.monto)} · ${g.partidas.descripcion}${g.partidas.estado === 'ANULADA' ? ' (anulada)' : ''}` }));
      return ev.sort((a, b) => String(b.f).localeCompare(String(a.f)));
    },
    construir: (ctx, f, ev) => {
      const porTipo = new Map(); ev.forEach((e) => porTipo.set(e.ev, (porTipo.get(e.ev) || 0) + 1));
      return { parametros: [`Empresa: ${empresaDe(ctx)}`, `Año ${f.anio}`, `${ev.length} evento(s)`],
        kpis: [['Eventos', ev.length], ['Cierres de mes', porTipo.get('Cierre de mes') || 0, 'ec-fin'], ['Reaperturas', (porTipo.get('Reapertura de mes') || 0) + (porTipo.get('Reapertura del ejercicio') || 0), (porTipo.get('Reapertura de mes') || porTipo.get('Reapertura del ejercicio')) ? 'ec-alerta' : ''], ['Partidas automáticas', ev.filter((e) => e.ev.startsWith('Partida')).length]],
        columnas: [col('Fecha y hora', 'texto', 17), col('Período', 'texto', 16), col('Evento', 'texto', 26), col('Usuario', 'texto', 18), col('Detalle', 'texto', 50)],
        filas: ev.map((e) => ({ valores: [new Date(e.f).toLocaleString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', ''), e.per, e.ev, e.u || '', e.d], resaltar: /Reapertura/.test(e.ev) })),
        vacio: 'Sin cierres ni procesos registrados en el año.', graficas: [G().barras('Eventos por tipo', [...porTipo.entries()].map(([t, n]) => ({ etiqueta: t, valor: n, texto: String(n) })))] };
    }, archivo: (f) => `bitacora_cierres_${f.anio}` });
})();
