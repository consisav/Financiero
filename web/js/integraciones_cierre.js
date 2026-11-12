// Contabilidad · Procesos · Generación de Cierres · Integraciones (script 209).
//   Por cuenta: las partidas del período donde aparece la cuenta, con saldo anterior, debe, haber y saldo actual.
//   Movimientos contables: el detalle por documento (cheques, depósitos, notas bancarias, compras, facturas, recibos, cajas,
//   planillas, pólizas…) de una cuenta, con los tipos de documento que se quieran desglosar.
//   Movimientos por centro de costo: el mismo detalle de un centro de costo, agrupado por cuenta.
//   Todas se imprimen en PDF y Excel. Usa window.CONTA (contabilidad_cierre.js).
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const C = () => window.CONTA;
  const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const q = (n) => `Q ${fmt.monto(n)}`;
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const GRUPO = 'Contabilidad · Generación de Cierres · Integraciones';

  // Tipos de documento que se pueden desglosar, agrupados por módulo.
  const TIPOS = [
    ['Caja y bancos', [['CAJ', 'Cajas'], ['CHQ', 'Cheques'], ['DEP', 'Depósitos'], ['NCB', 'Notas de crédito bancarias'], ['NDB', 'Notas de débito bancarias']]],
    ['Compras', [['COM', 'Compras'], ['NCP', 'Notas de crédito de compras'], ['NDP', 'Notas de débito de compras'], ['RET', 'Retenciones']]],
    ['Ventas', [['FAC', 'Facturas'], ['NCV', 'Notas de crédito'], ['NDV', 'Notas de débito'], ['EXE', 'Exenciones'], ['REC', 'Recibos']]],
    ['Inventarios', [['IBO', 'Ingresos a bodega'], ['DBO', 'Despachos de bodega'], ['FPR', 'Facturas prorrateos']]],
    ['Contabilidad', [['NOM', 'Planillas'], ['POL', 'Pólizas']]]
  ];
  const NOMBRE_TIPO = new Map(TIPOS.flatMap(([, ts]) => ts));
  const TODOS = TIPOS.flatMap(([, ts]) => ts.map(([k]) => k));

  const hoy = () => fmt.hoy();
  const inicioAnio = () => `${hoy().slice(0, 4)}-01-01`;
  const empresaDe = (ctx) => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
  const fecha = (n, lbl, v) => `<label class="campo"><span>${lbl}</span><input type="date" name="${n}" value="${v}"></label>`;
  const codigo = (v) => String(v || '').split(' ')[0].trim();
  const error = (ctx, e) => {
    const m = e?.message || '';
    ctx.pDet.innerHTML = `<p class="vacio">${/con_integracion|con_int_/.test(m) ? 'Falta instalar el script 209 (Integraciones) en Supabase.' : esc(window.UI.traducirError ? window.UI.traducirError(e) : m)}</p>`;
  };

  async function centrosEmpresa(ctx) {
    const { data: ks } = await ctx.sb.from('catalogos_centros').select('id').eq('localidad_id', ctx.sel.loc);
    const ids = (ks || []).map((k) => k.id);
    if (!ids.length) return [];
    const cs = await C().leerTodo(() => ctx.sb.from('centros_costo').select('id, catalogo_id, codigo, nombre').in('catalogo_id', ids).order('codigo'));
    const m = new Map(); cs.forEach((c) => { const a = m.get(c.codigo); if (!a || c.catalogo_id > a.catalogo_id) m.set(c.codigo, c); });
    return [...m.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }

  // Pantalla base: filtros, KPIs, tabla y exportación a PDF y Excel.
  function pantalla(cont, op) {
    const ctx = montar(cont, { titulo: op.titulo, icono: op.icono, clase: 'bk-movimientos bm-solo cx-rep pr-rep cr-conta ci-integ', grupo: GRUPO });
    const f = op.f();
    let listas = { cuentas: [], centros: [] }, datos = null, clave = '', cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', op.icono); return; }
      const [cuentas, centros] = await Promise.all([C().cuentasEmpresa(ctx).catch(() => []), op.centros ? centrosEmpresa(ctx).catch(() => []) : []]);
      listas = { cuentas, centros };
      datos = null; clave = '';
      ctx.filtros(op.filtros(f, listas), C().botonesExp);
      await consultar();
    }
    async function consultar() {
      const falta = op.falta(f);
      if (falta) { cfg = null; ctx.pDet.innerHTML = ctx.vacio(falta, op.icono); return; }
      const k = `${ctx.sel.loc}|${op.clave(f)}`;
      if (k !== clave) {
        ctx.pDet.innerHTML = '<p class="vacio">Integrando los movimientos contables…</p>';
        const { data, error: e } = await ctx.sb.rpc(op.rpc, op.args(f, ctx));
        if (e) { cfg = null; return error(ctx, e); }
        datos = data; clave = k;
      }
      try { cfg = op.construir(ctx, f, datos); } catch (e) { ctx.pDet.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }
      cfg = { orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: op.titulo.slice(0, 30), archivo: op.archivo(f), titulo: op.titulo, ...cfg };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="cl-banda">${esc(cfg.titulo)} · ${esc(cfg.parametros.slice(1, 3).join(' · '))}</div>
        ${op.ayuda ? `<p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> ${op.ayuda}</p>` : ''}
        ${cfg.aviso ? `<p class="cp-aviso cp-error"><i class="ti ti-alert-triangle" aria-hidden="true"></i> ${esc(cfg.aviso)}</p>` : ''}
        <div class="ec-kpis">${(cfg.kpis || []).map(([t, v, c]) => kpi(t, v, c)).join('')}</div>
        ${op.tipos ? panelTipos(f, datos) : ''}
        ${C().tabla(cfg, false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => {
      const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar();
      const n = e.target.name; if (!n) return;
      if (n === 'tipo') { if (e.target.checked) f.tipos.add(e.target.value); else f.tipos.delete(e.target.value); return consultar(); }
      f[n] = n === 'cuenta' || n === 'centro' ? codigo(e.target.value) : e.target.value;
      if (n === 'cuenta' || n === 'centro') e.target.value = f[n];
      consultar();
    });
    cont.addEventListener('click', (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return C().exportar(cfg, ex.dataset.exp, false);
      const t = e.target.closest('[data-tipos]'); if (!t) return;
      if (t.dataset.tipos === 'todos') TODOS.forEach((k) => f.tipos.add(k));
      else if (t.dataset.tipos === 'ninguno') f.tipos.clear();
      else { const g = TIPOS.find(([n]) => n === t.dataset.tipos); if (g) { const todos = g[1].every(([k]) => f.tipos.has(k)); g[1].forEach(([k]) => (todos ? f.tipos.delete(k) : f.tipos.add(k))); } }
      consultar();
    });
    iniciar();
  }

  const campoCuenta = (f, cuentas, opcional = false) => `<label class="campo cx-prov pr-prod"><span>Cuenta${opcional ? ' (opcional)' : ''}</span><input name="cuenta" list="ci-cuentas" value="${esc(f.cuenta)}" placeholder="${opcional ? 'Todas las cuentas' : 'Código de la cuenta'}" autocomplete="off"></label>
    <datalist id="ci-cuentas">${cuentas.map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>`;
  const campoCentro = (f, centros) => `<label class="campo cx-prov pr-prod"><span>Centro de costo</span><input name="centro" list="ci-centros" value="${esc(f.centro)}" placeholder="Código del centro" autocomplete="off"></label>
    <datalist id="ci-centros">${centros.map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>`;
  const nombreDe = (lista, cod) => lista.find((c) => c.codigo === cod)?.nombre || '';

  // Casillas de los tipos de documento a desglosar, con cuántos movimientos hay de cada uno.
  function panelTipos(f, D) {
    const n = new Map(); (D?.filas || []).forEach((x) => n.set(x.t, (n.get(x.t) || 0) + 1));
    return `<fieldset class="ci-tipos"><legend><i class="ti ti-filter" aria-hidden="true"></i> Módulos a desglosar <span>${[...f.tipos].length} de ${TODOS.length}</span>
        <button type="button" class="ci-mini" data-tipos="todos">Todos</button><button type="button" class="ci-mini" data-tipos="ninguno">Ninguno</button></legend>
      ${TIPOS.map(([g, ts]) => `<div class="ci-grupo"><button type="button" class="ci-gtit" data-tipos="${esc(g)}" title="Marcar o desmarcar ${esc(g.toLowerCase())}">${esc(g)}</button>
        ${ts.map(([k, t]) => `<label class="pc-check ${n.get(k) ? '' : 'ci-cero'}"><input type="checkbox" name="tipo" value="${k}" ${f.tipos.has(k) ? 'checked' : ''}> ${esc(t)} <b class="cp-num ${n.get(k) ? '' : 'cp-cero'}">${n.get(k) || 0}</b></label>`).join('')}</div>`).join('')}
    </fieldset>`;
  }

  // Filas de movimientos con saldo corrido (por la naturaleza de la cuenta) y resumen por tipo de documento.
  function movimientos(D, f, porCuenta) {
    const nat = (c) => num(D.nat?.[c]) || 1;
    const visibles = D.filas.filter((x) => f.tipos.has(x.t));
    const filas = []; let n = 0;
    const cuentas = porCuenta ? [...new Set([...Object.keys(D.saldos || {}), ...visibles.map((x) => x.c)])].sort() : [null];
    let tIni = 0, tD = 0, tH = 0, tFin = 0;
    cuentas.forEach((c) => {
      const xs = c ? visibles.filter((x) => x.c === c) : visibles;
      const ini = c ? num(D.saldos?.[c]) * nat(c) : Object.entries(D.saldos || {}).reduce((s, [k, v]) => s + num(v) * nat(k), 0);
      if (c && !xs.length && Math.abs(ini) < 0.005) return;
      let s = ini;
      const nom = c ? (xs[0]?.cn || D.filas.find((x) => x.c === c)?.cn || '') : '';
      if (c) filas.push({ valores: [`${c} · ${nom}`], tipo: 'grupo', combinar: true });
      filas.push({ valores: ['', '', '', '', 'Saldo anterior', '', '', '', '', '', r2(ini), ''], tipo: 'nota' });
      let d = 0, h = 0;
      xs.forEach((x) => {
        const ant = s; s += (num(x.d) - num(x.h)) * nat(x.c); d += num(x.d); h += num(x.h); n++;
        filas.push({ valores: [n, x.c, x.t, x.doc, fmt.fechaDia(x.fd), x.pt, x.cc || '', r2(ant), num(x.d) ? r2(x.d) : '', num(x.h) ? r2(x.h) : '', r2(s), x.desc || ''] });
      });
      if (c) filas.push({ valores: ['', '', '', '', `Total ${c}`, '', '', r2(ini), r2(d), r2(h), r2(s), ''], tipo: 'subtotal' });
      tIni += ini; tD += d; tH += h; tFin += s;
    });
    return { filas, n, tIni, tD, tH, tFin, visibles };
  }
  function resumenTipos(visibles) {
    const m = new Map(); visibles.forEach((x) => { const a = m.get(x.t) || { n: 0, d: 0, h: 0 }; a.n++; a.d += num(x.d); a.h += num(x.h); m.set(x.t, a); });
    return TODOS.filter((k) => m.has(k)).map((k) => ({ k, ...m.get(k) }));
  }
  const COLS_MOV = [col('#', 'numero', 6), col('Cuenta', 'texto', 12), col('Tipo', 'texto', 6), col('Documento', 'texto', 22), col('Fecha doc.', 'texto', 11), col('Póliza', 'texto', 11),
    col('Centro', 'texto', 9), col('Saldo anterior', 'monto', 15), col('Debe', 'monto', 14), col('Haber', 'monto', 14), col('Saldo actual', 'monto', 15), col('Descripción', 'texto', 40)];

  // ===================== a) Por cuenta =====================
  window.PANTALLAS['con-int-cuenta'] = (cont) => pantalla(cont, {
    titulo: 'Integración por cuenta', icono: 'ti-list-numbers', rpc: 'con_integracion_cuenta',
    ayuda: 'Todas las partidas vigentes del período donde aparece la cuenta (o la cuenta mayor y sus subcuentas). El saldo anterior es el acumulado antes de la fecha inicial.',
    f: () => ({ cuenta: '', desde: inicioAnio(), al: hoy() }),
    filtros: (f, L) => `${campoCuenta(f, L.cuentas)}${fecha('desde', 'Fecha inicial', f.desde)}${fecha('al', 'Fecha final', f.al)}`,
    falta: (f) => (!f.cuenta ? 'Escribe o elige la cuenta a integrar.' : f.desde > f.al ? 'La fecha inicial es posterior a la final.' : ''),
    clave: (f) => `${f.cuenta}|${f.desde}|${f.al}`,
    args: (f, ctx) => ({ p_loc: ctx.sel.loc, p_cuenta: f.cuenta, p_desde: f.desde, p_hasta: f.al }),
    construir: (ctx, f, D) => {
      const nat = num(D.nat) || 1; let s = num(D.saldo_inicial) * nat; const ini = s; let td = 0, th = 0;
      const filas = [{ valores: ['', '', '', '', `Saldo al ${fmt.fechaDia(f.desde)}`, '', '', '', r2(ini)], tipo: 'nota' }];
      D.filas.forEach((x) => {
        const ant = s; s += (num(x.debe) - num(x.haber)) * nat; td += num(x.debe); th += num(x.haber);
        filas.push({ valores: [String(x.anio), String(x.mes).padStart(2, '0'), `${x.tipo || 'PD'} ${x.numero}`, fmt.fechaDia(x.fecha), x.descripcion, r2(ant), r2(x.debe), r2(x.haber), r2(s)] });
      });
      filas.push({ valores: ['', '', '', '', 'Totales del período', r2(ini), r2(td), r2(th), r2(s)], tipo: 'total' });
      return { titulo: 'Integración por cuenta', parametros: [`Empresa: ${empresaDe(ctx)}`, `Cuenta: ${D.cuenta} · ${D.nombre || 'no encontrada'}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.al)}`, `Saldo ${nat === -1 ? 'acreedor' : 'deudor'}`],
        kpis: [['Saldo anterior', q(ini)], ['Debe', q(td)], ['Haber', q(th)], ['Saldo actual', q(s), 'ec-fin'], ['Partidas', D.filas.length]],
        columnas: [col('Año', 'texto', 7), col('Mes', 'texto', 6), col('Póliza', 'texto', 10), col('Fecha', 'texto', 11), col('Descripción', 'texto', 46), col('Saldo anterior', 'monto', 16), col('Debe', 'monto', 15), col('Haber', 'monto', 15), col('Saldo actual', 'monto', 16)],
        filas, firmas: ['Elaborado por', 'Revisado por', 'Contador general'] };
    },
    archivo: (f) => `integracion_cuenta_${f.cuenta}_${f.al}` });

  // ===================== b) Movimientos contables =====================
  window.PANTALLAS['con-int-movimientos'] = (cont) => pantalla(cont, {
    titulo: 'Integración de movimientos contables', icono: 'ti-list-details', rpc: 'con_integracion_movimientos', tipos: true,
    ayuda: 'Detalle por documento de los movimientos de la cuenta: el tipo y número salen del documento que generó la partida; las pólizas del Cierre Preliminar se abren en cada documento y las partidas sin documento salen como POL. El saldo corre con los módulos marcados.',
    f: () => ({ cuenta: '', desde: inicioAnio(), al: hoy(), tipos: new Set(TODOS) }),
    filtros: (f, L) => `${campoCuenta(f, L.cuentas)}${fecha('desde', 'Fecha inicial', f.desde)}${fecha('al', 'Fecha final', f.al)}`,
    falta: (f) => (!f.cuenta ? 'Escribe o elige la cuenta a integrar.' : f.desde > f.al ? 'La fecha inicial es posterior a la final.' : ''),
    clave: (f) => `${f.cuenta}|${f.desde}|${f.al}`,
    args: (f, ctx) => ({ p_loc: ctx.sel.loc, p_desde: f.desde, p_hasta: f.al, p_cuenta: f.cuenta, p_centro: null }),
    construir: (ctx, f, D) => construirMov(ctx, f, D, false),
    archivo: (f) => `movimientos_${f.cuenta}_${f.al}` });

  // ===================== c) Movimientos por centro de costo =====================
  window.PANTALLAS['con-int-centro'] = (cont) => pantalla(cont, {
    titulo: 'Integración de movimientos por centro de costo', icono: 'ti-sitemap', rpc: 'con_integracion_movimientos', tipos: true, centros: true,
    ayuda: 'Detalle por documento de los movimientos del centro de costo (y sus subcentros), agrupado por cuenta con su saldo anterior y su total. Si eliges una cuenta, solo esa cuenta y sus subcuentas.',
    f: () => ({ centro: '', cuenta: '', desde: inicioAnio(), al: hoy(), tipos: new Set(TODOS) }),
    filtros: (f, L) => `${campoCentro(f, L.centros)}${campoCuenta(f, L.cuentas, true)}${fecha('desde', 'Fecha inicial', f.desde)}${fecha('al', 'Fecha final', f.al)}`,
    falta: (f) => (!f.centro ? 'Escribe o elige el centro de costo a integrar.' : f.desde > f.al ? 'La fecha inicial es posterior a la final.' : ''),
    clave: (f) => `${f.centro}|${f.cuenta}|${f.desde}|${f.al}`,
    args: (f, ctx) => ({ p_loc: ctx.sel.loc, p_desde: f.desde, p_hasta: f.al, p_cuenta: f.cuenta || null, p_centro: f.centro }),
    construir: (ctx, f, D) => construirMov(ctx, f, D, true),
    archivo: (f) => `movimientos_centro_${f.centro}_${f.al}` });

  function construirMov(ctx, f, D, porCentro) {
    const M = movimientos(D, f, porCentro);
    const filas = [...M.filas];
    filas.push({ valores: ['', '', '', '', porCentro ? 'Total del centro de costo' : 'Totales del período', '', '', r2(M.tIni), r2(M.tD), r2(M.tH), r2(M.tFin), ''], tipo: 'total' });
    const res = resumenTipos(M.visibles);
    if (res.length) {
      filas.push({ valores: ['Resumen por tipo de documento'], tipo: 'grupo', combinar: true });
      res.forEach((r) => filas.push({ valores: ['', '', r.k, `${NOMBRE_TIPO.get(r.k) || r.k}`, `${r.n} mov.`, '', '', '', r2(r.d), r2(r.h), '', ''] }));
    }
    const ocultos = TODOS.length - f.tipos.size;
    const sujeto = porCentro ? `Centro: ${D.centro} · ${D.centro_nombre || 'no encontrado'}` : `Cuenta: ${D.cuenta} · ${D.cuenta_nombre || 'no encontrada'}`;
    return {
      titulo: porCentro ? 'Movimientos por centro de costo' : 'Movimientos contables',
      parametros: [`Empresa: ${empresaDe(ctx)}`, sujeto, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.al)}`, ...(porCentro && D.cuenta ? [`Cuenta: ${D.cuenta}`] : []), ocultos ? `Módulos: ${f.tipos.size} de ${TODOS.length}` : 'Módulos: todos', 'Moneda: quetzales'],
      aviso: D.total > D.filas.length ? `Hay ${D.total.toLocaleString('es-GT')} movimientos; se muestran los primeros ${D.filas.length.toLocaleString('es-GT')}. Acorta el período para verlos todos.` : '',
      kpis: [['Saldo anterior', q(M.tIni)], ['Debe', q(M.tD)], ['Haber', q(M.tH)], ['Saldo actual', q(M.tFin), 'ec-fin'], ['Movimientos', `${M.n}${M.n !== D.filas.length ? ` de ${D.filas.length}` : ''}`]],
      columnas: COLS_MOV, filas, firmas: ['Elaborado por', 'Revisado por', 'Contador general'] };
  }
})();
