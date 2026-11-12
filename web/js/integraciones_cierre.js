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
  // Primer día del mes anterior.
  const mesAnterior = () => { const [a, m] = hoy().split('-').map(Number); return m === 1 ? `${a - 1}-12-01` : `${a}-${String(m - 1).padStart(2, '0')}-01`; };
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
      // Diseño compacto: una sola barra con el título, los indicadores y el botón de módulos; la ayuda queda en el ícono (i).
      const agrupado = op.tipos && (op.centros || !f.cuenta);
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico ci-compacto ${agrupado ? 'ci-agrupado' : ''}">
        <div class="ci-barra">
          <div class="ci-tit"><b>${esc(cfg.titulo)}</b> <span>${esc(cfg.parametros.slice(1, 3).join(' · '))}</span>${op.ayuda ? ` <i class="ti ti-info-circle" title="${esc(op.ayuda)}" aria-label="${esc(op.ayuda)}"></i>` : ''}</div>
          <div class="ci-kpis">${(cfg.kpis || []).map(([t, v, c]) => `<span class="ci-k ${c || ''}"><small>${esc(t)}</small> <b>${esc(String(v))}</b></span>`).join('')}</div>
          ${op.tipos ? `<button type="button" class="ci-modbtn ${f.mods ? 'abierto' : ''}" data-mods aria-expanded="${!!f.mods}"><i class="ti ti-filter" aria-hidden="true"></i> Módulos <b>${f.tipos.size}/${TODOS.length}</b> <i class="ti ti-chevron-down" aria-hidden="true"></i></button>` : ''}
        </div>
        ${cfg.aviso ? `<p class="cp-aviso cp-error"><i class="ti ti-alert-triangle" aria-hidden="true"></i> ${esc(cfg.aviso)}</p>` : ''}
        ${op.tipos && f.mods ? panelTipos(f, datos) : ''}
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
      if (e.target.closest('[data-mods]')) { f.mods = !f.mods; return consultar(); }
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
  const campoCentro = (f, centros) => `<label class="campo cx-prov pr-prod"><span>Centro de costo</span><input name="centro" list="ci-centros" value="${esc(f.centro)}" placeholder="Todos los centros" autocomplete="off"></label>
    <datalist id="ci-centros">${centros.map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>`;
  const nombreDe = (lista, cod) => lista.find((c) => c.codigo === cod)?.nombre || '';

  // Casillas de los tipos de documento a desglosar, con cuántos movimientos hay de cada uno.
  function panelTipos(f, D) {
    const n = new Map(); (D?.filas || []).forEach((x) => n.set(x.t, (n.get(x.t) || 0) + 1));
    return `<fieldset class="ci-tipos"><legend>Módulos a desglosar
        <button type="button" class="ci-mini" data-tipos="todos">Todos</button><button type="button" class="ci-mini" data-tipos="ninguno">Ninguno</button></legend>
      ${TIPOS.map(([g, ts]) => `<div class="ci-grupo"><button type="button" class="ci-gtit" data-tipos="${esc(g)}" title="Marcar o desmarcar ${esc(g.toLowerCase())}">${esc(g)}</button>
        ${ts.map(([k, t]) => `<label class="pc-check ${n.get(k) ? '' : 'ci-cero'}"><input type="checkbox" name="tipo" value="${k}" ${f.tipos.has(k) ? 'checked' : ''}> ${esc(t)} <b class="cp-num ${n.get(k) ? '' : 'cp-cero'}">${n.get(k) || 0}</b></label>`).join('')}</div>`).join('')}
    </fieldset>`;
  }

  // Filas de movimientos con saldo corrido (por la naturaleza de la cuenta) y resumen por tipo de documento.
  //   modo 'cuenta': una sola cuenta, sin agrupar; 'cuentas': agrupado por cuenta; 'centros': por centro de costo y, dentro, por cuenta.
  //   Solo se muestran las cuentas con movimientos en el período (con los módulos marcados).
  function movimientos(D, f, modo) {
    const nat = (c) => num(D.nat?.[c]) || 1;
    const visibles = D.filas.filter((x) => f.tipos.has(x.t));
    const filas = []; let n = 0, tD = 0, tH = 0;
    const fila = (x, ant, s) => [n, x.c, x.t, x.doc, fmt.fechaDia(x.fd), x.pt, x.cc || '', r2(ant), num(x.d) ? r2(x.d) : '', num(x.h) ? r2(x.h) : '', r2(s), x.desc || ''];
    const v = (x) => (x === '' ? '' : r2(x));
    const pie = (txt, ini, d, h, s, tipo) => filas.push({ valores: ['', '', '', '', txt, '', '', v(ini), v(d), v(h), v(s), ''], tipo });
    // Un bloque de movimientos de una cuenta (o de la cuenta elegida) con su saldo anterior.
    const bloque = (xs, ini, titulo) => {
      let s = ini, d = 0, h = 0;
      if (titulo) filas.push({ valores: [titulo], tipo: 'grupo', combinar: true });
      filas.push({ valores: ['', '', '', '', 'Saldo anterior', '', '', '', '', '', r2(ini), ''], tipo: 'nota' });
      xs.forEach((x) => { const ant = s; s += (num(x.d) - num(x.h)) * nat(x.c); d += num(x.d); h += num(x.h); n++; filas.push({ valores: fila(x, ant, s) }); });
      tD += d; tH += h;
      return { ini, d, h, s };
    };
    if (modo === 'cuenta') {
      const ini = Object.entries(D.saldos || {}).reduce((t, [k, v]) => t + num(v) * nat(k), 0);
      const b = bloque(visibles, ini, '');
      return { filas, n, tD, tH, tIni: b.ini, tFin: b.s, visibles, grupos: 1 };
    }
    const porCuenta = (xs, saldo, sangria = '') => {
      const cs = [...new Set(xs.map((x) => x.c))].sort();
      cs.forEach((c) => {
        const ys = xs.filter((x) => x.c === c);
        const b = bloque(ys, num(saldo(c)) * nat(c), `${sangria}Cuenta ${c} · ${ys[0].cn || ''}`);
        pie(`Total cuenta ${c}`, b.ini, b.d, b.h, b.s, 'subtotal');
      });
      return cs.length;
    };
    if (modo === 'cuentas') {
      const g = porCuenta(visibles, (c) => D.saldos?.[c]);
      return { filas, n, tD, tH, visibles, grupos: g };
    }
    // Por centro de costo y cuenta.
    const centros = [...new Set(visibles.map((x) => x.cc || ''))].sort();
    let cuentas = 0;
    centros.forEach((cc) => {
      const xs = visibles.filter((x) => (x.cc || '') === cc);
      filas.push({ valores: [`Centro de costo ${cc || 'sin centro'} · ${xs[0].ccn || ''}`], tipo: 'grupo', combinar: true });
      const d0 = tD, h0 = tH;
      cuentas += porCuenta(xs, (c) => D.saldos?.[`${cc}|${c}`], '   ');
      pie(`Total centro ${cc}`, '', tD - d0, tH - h0, '', 'subtotal');
    });
    return { filas, n, tD, tH, visibles, grupos: centros.length, cuentas };
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
    ayuda: 'Partidas vigentes del período donde aparece la cuenta (o la cuenta mayor y sus subcuentas); sin cuenta, todas las cuentas agrupadas, cada una con su saldo anterior (acumulado antes de la fecha inicial) y su total.',
    f: () => ({ cuenta: '', desde: mesAnterior(), al: hoy() }),
    filtros: (f, L) => `${campoCuenta(f, L.cuentas, true)}${fecha('desde', 'Fecha inicial', f.desde)}${fecha('al', 'Fecha final', f.al)}`,
    falta: (f) => (f.desde > f.al ? 'La fecha inicial es posterior a la final.' : ''),
    clave: (f) => `${f.cuenta}|${f.desde}|${f.al}`,
    args: (f, ctx) => ({ p_loc: ctx.sel.loc, p_cuenta: f.cuenta || null, p_desde: f.desde, p_hasta: f.al }),
    construir: (ctx, f, D) => {
      const nat = (c) => num(D.cuenta ? D.nat : D.nats?.[c]) || 1;
      const filas = []; let td = 0, th = 0, tIni = 0, tFin = 0;
      // Un bloque por cuenta (o uno solo con la cuenta elegida): saldo anterior, partidas y total.
      const cuentas = D.cuenta ? [D.cuenta] : [...new Set(D.filas.map((x) => x.c))].sort();
      cuentas.forEach((c) => {
        const xs = D.cuenta ? D.filas : D.filas.filter((x) => x.c === c);
        const ini = (D.cuenta ? num(D.saldo_inicial) : num(D.saldos?.[c])) * nat(c);
        let s = ini, d = 0, h = 0;
        if (!D.cuenta) filas.push({ valores: [`Cuenta ${c} · ${xs[0]?.cn || ''}`], tipo: 'grupo', combinar: true });
        filas.push({ valores: ['', '', '', '', `Saldo al ${fmt.fechaDia(f.desde)}`, '', '', '', r2(ini)], tipo: 'nota' });
        xs.forEach((x) => {
          const ant = s; s += (num(x.debe) - num(x.haber)) * nat(c); d += num(x.debe); h += num(x.haber);
          filas.push({ valores: [String(x.anio), String(x.mes).padStart(2, '0'), `${x.tipo || 'PD'} ${x.numero}`, fmt.fechaDia(x.fecha), x.descripcion, r2(ant), r2(x.debe), r2(x.haber), r2(s)] });
        });
        if (!D.cuenta) filas.push({ valores: ['', '', '', '', `Total cuenta ${c}`, r2(ini), r2(d), r2(h), r2(s)], tipo: 'subtotal' });
        td += d; th += h; tIni += ini; tFin += s;
      });
      if (D.cuenta) filas.push({ valores: ['', '', '', '', 'Totales del período', r2(tIni), r2(td), r2(th), r2(tFin)], tipo: 'total' });
      else filas.push({ valores: ['', '', '', '', 'Total de las cuentas', '', r2(td), r2(th), ''], tipo: 'total' });
      const partidas = new Set(D.filas.map((x) => x.id)).size;
      return { titulo: 'Integración por cuenta',
        parametros: [`Empresa: ${empresaDe(ctx)}`, D.cuenta ? `Cuenta: ${D.cuenta} · ${D.nombre || 'no encontrada'}` : 'Cuenta: todas', `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.al)}`, ...(D.cuenta ? [`Saldo ${nat(D.cuenta) === -1 ? 'acreedor' : 'deudor'}`] : [])],
        aviso: D.total > D.filas.length ? `Hay ${D.total.toLocaleString('es-GT')} filas; se muestran las primeras ${D.filas.length.toLocaleString('es-GT')}. Acorta el período o elige una cuenta para verlas todas.` : '',
        kpis: D.cuenta ? [['Saldo anterior', q(tIni)], ['Debe', q(td)], ['Haber', q(th)], ['Saldo actual', q(tFin), 'ec-fin'], ['Partidas', partidas]]
          : [['Cuentas', cuentas.length], ['Debe', q(td)], ['Haber', q(th)], ['Partidas', partidas]],
        columnas: [col('Año', 'texto', 7), col('Mes', 'texto', 6), col('Póliza', 'texto', 10), col('Fecha', 'texto', 11), col('Descripción', 'texto', 46), col('Saldo anterior', 'monto', 16), col('Debe', 'monto', 15), col('Haber', 'monto', 15), col('Saldo actual', 'monto', 16)],
        filas, firmas: ['Elaborado por', 'Revisado por', 'Contador general'] };
    },
    archivo: (f) => `integracion_cuenta_${f.cuenta || 'todas'}_${f.al}` });

  // ===================== b) Movimientos contables =====================
  window.PANTALLAS['con-int-movimientos'] = (cont) => pantalla(cont, {
    titulo: 'Integración de movimientos contables', icono: 'ti-list-details', rpc: 'con_integracion_movimientos', tipos: true,
    ayuda: 'Detalle por documento de los movimientos de la cuenta (o de todas, agrupadas por cuenta): el tipo y número salen del documento que generó la partida; las pólizas del Cierre Preliminar se abren en cada documento y las partidas sin documento salen como POL. El saldo corre con los módulos marcados.',
    f: () => ({ cuenta: '', desde: mesAnterior(), al: hoy(), tipos: new Set(TODOS) }),
    filtros: (f, L) => `${campoCuenta(f, L.cuentas, true)}${fecha('desde', 'Fecha inicial', f.desde)}${fecha('al', 'Fecha final', f.al)}`,
    falta: (f) => (f.desde > f.al ? 'La fecha inicial es posterior a la final.' : ''),
    clave: (f) => `${f.cuenta}|${f.desde}|${f.al}`,
    args: (f, ctx) => ({ p_loc: ctx.sel.loc, p_desde: f.desde, p_hasta: f.al, p_cuenta: f.cuenta || null, p_centro: null }),
    construir: (ctx, f, D) => construirMov(ctx, f, D, false),
    archivo: (f) => `movimientos_${f.cuenta || 'todas'}_${f.al}` });

  // ===================== c) Movimientos por centro de costo =====================
  window.PANTALLAS['con-int-centro'] = (cont) => pantalla(cont, {
    titulo: 'Integración de movimientos por centro de costo', icono: 'ti-sitemap', rpc: 'con_integracion_movimientos', tipos: true, centros: true,
    ayuda: 'Detalle por documento de los movimientos del centro de costo y sus subcentros (o de todos los centros), agrupado por centro y cuenta con su saldo anterior y su total. Si eliges una cuenta, solo esa cuenta y sus subcuentas.',
    f: () => ({ centro: '', cuenta: '', desde: mesAnterior(), al: hoy(), tipos: new Set(TODOS) }),
    filtros: (f, L) => `${campoCentro(f, L.centros)}${campoCuenta(f, L.cuentas, true)}${fecha('desde', 'Fecha inicial', f.desde)}${fecha('al', 'Fecha final', f.al)}`,
    falta: (f) => (f.desde > f.al ? 'La fecha inicial es posterior a la final.' : ''),
    clave: (f) => `${f.centro}|${f.cuenta}|${f.desde}|${f.al}`,
    args: (f, ctx) => ({ p_loc: ctx.sel.loc, p_desde: f.desde, p_hasta: f.al, p_cuenta: f.cuenta || null, p_centro: f.centro || '*' }),
    construir: (ctx, f, D) => construirMov(ctx, f, D, true),
    archivo: (f) => `movimientos_centro_${f.centro || 'todos'}_${f.al}` });

  function construirMov(ctx, f, D, porCentro) {
    const modo = porCentro ? 'centros' : f.cuenta ? 'cuenta' : 'cuentas';
    const M = movimientos(D, f, modo);
    const filas = [...M.filas];
    if (modo === 'cuenta') filas.push({ valores: ['', '', '', '', 'Totales del período', '', '', r2(M.tIni), r2(M.tD), r2(M.tH), r2(M.tFin), ''], tipo: 'total' });
    else filas.push({ valores: ['', '', '', '', porCentro ? 'Total de los centros de costo' : 'Total de las cuentas', '', '', '', r2(M.tD), r2(M.tH), '', ''], tipo: 'total' });
    const res = resumenTipos(M.visibles);
    if (res.length) {
      filas.push({ valores: ['Resumen por tipo de documento'], tipo: 'grupo', combinar: true });
      res.forEach((r) => filas.push({ valores: ['', '', r.k, `${NOMBRE_TIPO.get(r.k) || r.k}`, `${r.n} mov.`, '', '', '', r2(r.d), r2(r.h), '', ''] }));
    }
    const ocultos = TODOS.length - f.tipos.size;
    const cuenta = D.cuenta ? `Cuenta: ${D.cuenta} · ${D.cuenta_nombre || 'no encontrada'}` : 'Cuenta: todas';
    const centro = D.centro && D.centro !== '*' ? `Centro: ${D.centro} · ${D.centro_nombre || 'no encontrado'}` : 'Centro: todos';
    const movs = ['Movimientos', `${M.n}${M.n !== D.filas.length ? ` de ${D.filas.length}` : ''}`];
    return {
      titulo: porCentro ? 'Movimientos por centro de costo' : 'Movimientos contables',
      parametros: [`Empresa: ${empresaDe(ctx)}`, porCentro ? centro : cuenta, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.al)}`, ...(porCentro ? [cuenta] : []), ocultos ? `Módulos: ${f.tipos.size} de ${TODOS.length}` : 'Módulos: todos', 'Moneda: quetzales'],
      aviso: D.total > D.filas.length ? `Hay ${D.total.toLocaleString('es-GT')} movimientos; se muestran los primeros ${D.filas.length.toLocaleString('es-GT')}. Acorta el período o elige una cuenta para verlos todos.` : '',
      kpis: modo === 'cuenta'
        ? [['Saldo anterior', q(M.tIni)], ['Debe', q(M.tD)], ['Haber', q(M.tH)], ['Saldo actual', q(M.tFin), 'ec-fin'], movs]
        : [[porCentro ? 'Centros de costo' : 'Cuentas', M.grupos], ...(porCentro ? [['Cuentas', M.cuentas]] : []), ['Debe', q(M.tD)], ['Haber', q(M.tH)], movs],
      columnas: COLS_MOV, filas, firmas: ['Elaborado por', 'Revisado por', 'Contador general'] };
  }
})();
