// Contabilidad · Cierre contable (script 158).
// Catálogos: ejercicios y períodos contables, cuentas de integración, cuentas de cierre y libros autorizados por la SAT.
// Registros: partidas recurrentes, provisiones y diferidos, cuentas intercompañía.
// Procesos: revisión previa al cierre, mayorización y validación, recurrentes y amortizaciones del mes, diferencial
// cambiario, reversión de provisiones y cierre anual (PCR, reserva legal y traslado, PCE y PA) con su reapertura.
// window.CONTA reúne la lectura contable que usan también las integraciones y los reportes de cierre.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const q = (n) => `Q ${fmt.monto(n)}`;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const G = () => window.GRAFICAS;
  const ini = (x) => `${x}T00:00:00-06:00`, fin = (x) => `${x}T23:59:59.999-06:00`;
  const finMes = (a, m) => { const d = new Date(Date.UTC(a, m, 0)); return d.toISOString().slice(0, 10); };
  const iniMes = (a, m) => `${a}-${String(m).padStart(2, '0')}-01`;
  const empresaDe = (ctx) => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
  const CLS = { CERRADO: 'aprobada', ABIERTO: 'editando', OK: 'aprobada', CUADRA: 'aprobada', ALERTA: 'anulada', DIFERENCIA: 'anulada', PENDIENTE: 'pendiente', GENERADA: 'aprobada', 'SIN CUENTA': 'definitiva', 'SIN DATOS': 'definitiva', INFORMATIVO: 'definitiva', REVERTIDA: 'aprobada' };
  const marca = (e) => `<span class="pc-marca ${CLS[e] || ''}">${esc(e)}</span>`;
  const falta = (ctx, e) => { ctx.pDet.innerHTML = `<p class="vacio">${/cierre_ejercicio|ejercicios_contables|cuentas_integracion|libros_autorizados|partidas_recurrentes|diferidos|intercompania|partidas_generadas|con_/.test(e?.message || '') ? 'Falta instalar el script 158 (Cierre contable) en Supabase.' : esc(window.UI.traducirError(e))}</p>`; };
  const errorTxt = (e) => window.UI.traducirError(e);
  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) { const { data, error } = await hacer().range(i, i + 999); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; }
    return out;
  }
  const botonesExp = '<button type="button" class="boton secundario-sm" data-exp="PDF"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button><button type="button" class="boton secundario-sm" data-exp="EXCEL"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>';
  function tabla(c, graficas = true) {
    const n = c.columnas.length;
    const celda = (v, x) => (v === '' || v == null ? '<td></td>' : typeof v === 'number' ? `<td class="num${v < 0 ? ' pc-rojo' : ''}">${x.tipo === 'monto' ? fmt.monto(v) : x.tipo === 'porcentaje' ? `${(v * 100).toFixed(1)} %` : v.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</td>` : String(v).startsWith('¤') ? `<td>${marca(String(v).slice(1))}</td>` : `<td>${esc(String(v))}</td>`);
    const gs = graficas ? (c.graficas || []).filter(Boolean) : [];
    return `<div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${c.columnas.map((x) => `<th class="${x.tipo === 'texto' ? '' : 'num'}">${esc(x.titulo)}</th>`).join('')}</tr></thead>
      <tbody>${c.filas.length ? c.filas.map((r) => (r.tipo === 'grupo' && r.combinar ? `<tr class="pr-g"><td colspan="${n}">${esc(r.valores[0])}</td></tr>` : `<tr class="${r.tipo === 'grupo' ? 'pr-g' : r.tipo === 'subtotal' ? 'pr-s' : r.tipo === 'total' ? 'pr-t' : r.tipo === 'nota' ? 'pr-n' : ''}${r.resaltar ? ' pr-alerta' : ''}" ${r.attr || ''}>${c.columnas.map((x, i) => celda(r.valores[i], x)).join('')}</tr>`)).join('') : `<tr><td colspan="${n}" class="tk-vacio">${esc(c.vacio || 'Sin información.')}</td></tr>`}</tbody></table>
      ${gs.length && c.filas.length ? `<section class="pr-graficas"><h3><i class="ti ti-chart-bar" aria-hidden="true"></i> Gráficas</h3>${gs.join('')}</section>` : ''}</div>`;
  }
  function exportar(c, formato, graficas = true) {
    if (!c || !c.filas.length) return window.FIN.aviso('No hay información para imprimir');
    const gs = graficas ? (c.graficas || []).filter(Boolean) : [];
    const s = { ...c, filas: c.filas.map((r) => ({ ...r, resaltar: r.resaltar ? 1 : undefined, ...(r.tipo === 'nota' ? { tipo: undefined, tenue: true } : {}), valores: r.valores.map((v) => (typeof v === 'string' && v.startsWith('¤') ? v.slice(1) : v)) })) };
    if (formato === 'PDF') return window.CUENTAS_XLSX.pdf({ ...s, graficas: gs.join('') });
    Promise.all(gs.map((g) => G().png(g))).then((imagenes) => window.REPORTE_XLSX.generar({ ...s, imagenes })).catch((e) => window.FIN.aviso(e.message || 'No se pudo generar el Excel'));
  }
  const opt = (lst, sel, val, txt, vacio = '—') => `${vacio != null ? `<option value="">${vacio}</option>` : ''}${lst.map((x) => `<option value="${esc(String(x[val]))}" ${String(sel ?? '') === String(x[val]) ? 'selected' : ''}>${esc(txt(x))}</option>`).join('')}`;

  // ===================== Lectura contable compartida =====================
  // Fecha contable de la partida: el día en que se registró si cae en su período (año y mes); si se registró después
  // (partidas migradas o atrasadas) cuenta el último día de su período.
  const fechaContable = (p) => { const d = new Date(p.fecha).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }); const per = `${p.anio}-${String(p.mes).padStart(2, '0')}`; if (d.slice(0, 7) === per) return d; return d < `${per}-01` ? `${per}-01` : new Date(Date.UTC(p.anio, p.mes, 0)).toISOString().slice(0, 10); };
  // Líneas vigentes de las localidades hasta una fecha, con la cuenta (por código, para consolidar entre versiones del
  // catálogo), su naturaleza y tipo. Las partidas de registro del cierre anual (PCE y PA) se excluyen salvo que se pidan.
  async function leer(ctx, { locs, hasta, desde = null, memoria = false, cuentasDe = null }) {
    const { sb } = ctx;
    const lineas = (await leerTodo(() => {
      let x = sb.from('partida_lineas').select('id, linea, cuenta_id, centro_id, concepto, debe, haber, partidas!inner(id, localidad_id, fecha, anio, mes, numero, numero_anual, tipo_partida_id, descripcion, catalogo_id, estado, aprobada, cierre_ejercicio, origen)')
        .in('partidas.localidad_id', locs).eq('partidas.estado', 'VIGENTE').lte('partidas.anio', Number(hasta.slice(0, 4)));
      if (desde) x = x.gte('partidas.anio', Number(desde.slice(0, 4)));
      return x.order('id');
    })).map((l) => { l.dia = fechaContable(l.partidas); return l; }).filter((l) => l.dia <= hasta && (!desde || l.dia >= desde) && (memoria || !['PCE', 'PA'].includes(l.partidas.cierre_ejercicio)));
    const catalogos = [...new Set([...lineas.map((l) => l.partidas.catalogo_id), ...(cuentasDe || [])].filter(Boolean))];
    const [cuentas, tipos, tiposPart] = await Promise.all([
      catalogos.length ? leerTodo(() => sb.from('cuentas').select('id, catalogo_id, codigo, nombre, cuenta_mayor_id, tipo_cuenta_id, integra, nivel').in('catalogo_id', catalogos).order('id')) : [],
      leerTodo(() => sb.from('tipos_cuenta').select('id, codigo, descripcion, tipo_operacion, operacion_resultado, reporte_financiero, localidad_id').in('localidad_id', locs).order('id')),
      sb.from('tipos_partida').select('id, siglas, nombre').then((r) => r.data || [])
    ]);
    const porId = new Map(cuentas.map((c) => [c.id, c]));
    const tipo = new Map(tipos.map((t) => [t.id, t]));
    const porCodigo = new Map();
    cuentas.forEach((c) => {
      const t = tipo.get(c.tipo_cuenta_id), mayor = porId.get(c.cuenta_mayor_id);
      if (!porCodigo.has(c.codigo)) porCodigo.set(c.codigo, { codigo: c.codigo, nombre: c.nombre, nivel: c.nivel || 1, integra: c.integra, mayor: mayor?.codigo || null, tipoDesc: t?.descripcion || '', tipoCod: t?.codigo, nat: t?.tipo_operacion === 'HABER-DEBE' ? -1 : 1, reporte: t?.reporte_financiero || '' });
    });
    const tp = new Map(tiposPart.map((t) => [t.id, t]));
    return { lineas: lineas.map((l) => ({ ...l, p: l.partidas, c: porId.get(l.cuenta_id), siglas: tp.get(l.partidas.tipo_partida_id)?.siglas || '' })), porCodigo, tiposPart: tp, porId };
  }
  // Saldos {d, h} por código, acumulados hacia las cuentas mayores.
  function saldos(base, filtro = () => true) {
    const s = new Map();
    base.lineas.forEach((l) => { if (!l.c || !filtro(l)) return; const k = l.c.codigo; const x = s.get(k) || { d: 0, h: 0 }; x.d += num(l.debe); x.h += num(l.haber); s.set(k, x); });
    const total = new Map();
    s.forEach((x, k) => { let c = base.porCodigo.get(k); const seen = new Set(); while (c && !seen.has(c.codigo)) { seen.add(c.codigo); const t = total.get(c.codigo) || { d: 0, h: 0 }; t.d += x.d; t.h += x.h; total.set(c.codigo, t); c = c.mayor ? base.porCodigo.get(c.mayor) : null; } });
    return total;
  }
  // Saldo de un código (o de todas sus subcuentas por prefijo) según su naturaleza.
  const saldoCod = (base, cod, filtro = () => true) => { if (!cod) return 0; const c = base.porCodigo.get(cod); const nat = c?.nat || 1; return sum(base.lineas.filter((l) => l.c && l.c.codigo.startsWith(cod) && filtro(l)).map((l) => (num(l.debe) - num(l.haber)) * nat)); };
  const docPart = (l) => `${l.siglas || 'P'}-${l.p.numero}/${String(l.p.mes).padStart(2, '0')}-${l.p.anio}`;
  // Cuentas de un catálogo de la empresa (para elegir por código).
  async function cuentasEmpresa(ctx, loc = ctx.sel.loc) {
    const { data: ks } = await ctx.sb.from('catalogos_cuentas').select('id, version, activo').eq('localidad_id', loc).order('version');
    const ids = (ks || []).map((k) => k.id);
    if (!ids.length) return [];
    const cs = await leerTodo(() => ctx.sb.from('cuentas').select('id, catalogo_id, codigo, nombre, integra, nivel, vigente').in('catalogo_id', ids).order('codigo'));
    const m = new Map(); cs.forEach((c) => { const a = m.get(c.codigo); if (!a || c.catalogo_id > a.catalogo_id) m.set(c.codigo, c); });
    return [...m.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }
  const listaCuentas = (id, cs, soloMov = false) => `<datalist id="${id}">${cs.filter((c) => !soloMov || !c.integra).map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>`;

  // Claves de cuentas de integración y de cierre.
  const CLAVES_INTEGRACION = [
    ['CXC', 'Cuentas por cobrar clientes', 'Facturas de venta con saldo', /CUENTAS? POR COBRAR|CLIENTES/],
    ['CXP', 'Cuentas por pagar proveedores', 'Compras con saldo pendiente', /CUENTAS? POR PAGAR|PROVEEDORES/],
    ['INVENTARIO', 'Inventarios', 'Valuación a costo promedio', /INVENTARIO/],
    ['IVA_DEBITO', 'IVA débito fiscal / por pagar', 'IVA de las ventas del mes', /IVA.*(D[EÉ]BITO|POR PAGAR)/],
    ['IVA_CREDITO', 'IVA crédito fiscal', 'IVA de las compras del mes', /IVA.*CR[EÉ]DITO|IVA POR COBRAR/],
    ['RET_ISR', 'Retenciones de ISR por pagar', 'Retenciones practicadas', /RETENCI.*ISR|ISR RETENIDO/],
    ['RET_IVA', 'Retenciones de IVA por pagar', 'Retenciones practicadas', /RETENCI.*IVA|IVA RETENIDO/],
    ['ISR_POR_PAGAR', 'ISR por pagar', 'Liquidación de impuestos', /ISR POR PAGAR|IMPUESTO SOBRE LA RENTA POR PAGAR/],
    ['NOMINA_POR_PAGAR', 'Sueldos por pagar', 'Planillas aprobadas sin pagar', /SUELDOS? POR PAGAR|SALARIOS POR PAGAR|PLANILLAS? POR PAGAR/],
    ['IGSS_POR_PAGAR', 'Cuotas IGSS por pagar', 'Cuotas de planillas', /IGSS/],
    ['ACTIVOS_FIJOS', 'Propiedad, planta y equipo', 'Registro de activos', /PROPIEDAD|ACTIVOS? FIJOS?|MOBILIARIO/],
    ['DEPRECIACION_ACUM', 'Depreciación acumulada', 'Registro de activos', /DEPRECIACI[OÓ]N ACUMULADA/],
    ['ANTICIPOS_PROVEEDORES', 'Anticipos a proveedores', 'Anticipos pendientes de liquidar', /ANTICIPOS? A PROVEEDORES/],
    ['ANTICIPOS_CLIENTES', 'Anticipos de clientes', 'Anticipos recibidos', /ANTICIPOS? DE CLIENTES/],
    ['DIF_CAMBIARIO_INGRESO', 'Diferencial cambiario (ganancia)', 'Revaluación de moneda extranjera', /DIFERENCIAL CAMBIARIO|GANANCIA CAMBIARIA/],
    ['DIF_CAMBIARIO_GASTO', 'Diferencial cambiario (pérdida)', 'Revaluación de moneda extranjera', /DIFERENCIAL CAMBIARIO|P[EÉ]RDIDA CAMBIARIA/]
  ];
  const CLAVES_CIERRE = [
    ['RESULTADO_EJERCICIO', 'Resultado del ejercicio', 'Recibe el cierre de ingresos, costos y gastos (PCR)', /RESULTADO DEL (EJERCICIO|PERIODO)/],
    ['UTILIDADES_ACUMULADAS', 'Utilidades acumuladas (superávit)', 'Recibe la utilidad trasladada', /SUPERAVIT|SUPERÁVIT|UTILIDADES ACUMULADAS|UTILIDADES RETENIDAS/],
    ['PERDIDAS_ACUMULADAS', 'Pérdidas acumuladas', 'Recibe la pérdida trasladada', /P[EÉ]RDIDAS? ACUMULADAS?/],
    ['RESERVA_LEGAL', 'Reserva legal (5 %)', 'Código de Comercio, art. 36', /RESERVA LEGAL/]
  ];
  async function cuentasClave(ctx, loc = ctx.sel.loc) {
    const [ci, pg] = await Promise.all([ctx.sb.from('cuentas_integracion').select('*').eq('localidad_id', loc), ctx.sb.from('parametros_generales').select('cuenta_resultado_ejercicio, cuenta_principal_ganancia, cuenta_principal_perdida, cuenta_dif_cambiario').eq('localidad_id', loc).maybeSingle()]);
    if (ci.error) throw ci.error;
    const p = pg.data || {};
    const resp = { RESULTADO_EJERCICIO: p.cuenta_resultado_ejercicio, UTILIDADES_ACUMULADAS: p.cuenta_principal_ganancia, PERDIDAS_ACUMULADAS: p.cuenta_principal_perdida, DIF_CAMBIARIO_INGRESO: p.cuenta_dif_cambiario, DIF_CAMBIARIO_GASTO: p.cuenta_dif_cambiario };
    const filas = new Map((ci.data || []).map((x) => [x.clave, x]));
    const cuenta = (k) => (filas.get(k)?.cuenta_codigo || '').trim() || (resp[k] || '').trim() || '';
    return { filas, resp, cuenta };
  }
  window.CONTA = { leer, saldos, saldoCod, cuentasEmpresa, cuentasClave, CLAVES_INTEGRACION, CLAVES_CIERRE, tabla, exportar, botonesExp, marca, leerTodo, docPart, finMes, iniMes, MES, falta };

  // ===================== Ejercicios y períodos contables =====================
  window.PANTALLAS['con-ejercicios'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Ejercicios y períodos contables', icono: 'ti-calendar-stats', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Contabilidad · Catálogos' });
    const { sb } = ctx;
    let cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-calendar-stats'); return; }
      ctx.filtros('', `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="abrir"><i class="ti ti-calendar-plus" aria-hidden="true"></i> Abrir ejercicio</button>' : ''}${botonesExp}`);
      ctx.pDet.innerHTML = '<p class="vacio">Leyendo los ejercicios…</p>';
      try {
        const [ej, cm, ps] = await Promise.all([sb.from('ejercicios_contables').select('*').eq('localidad_id', ctx.sel.loc).order('anio'), sb.from('cierres_mes').select('anio, mes, cerrado, cerrado_por, cerrado_en').eq('localidad_id', ctx.sel.loc),
          leerTodo(() => sb.from('partidas').select('id, anio, mes, estado, aprobada, total_debe, total_haber').eq('localidad_id', ctx.sel.loc).order('id'))]);
        if (ej.error) throw ej.error;
        const anios = [...new Set([...(ej.data || []).map((x) => x.anio), ...ps.map((p) => p.anio)])].sort();
        const cerrado = (a, m) => (ej.data || []).some((x) => x.anio === a && x.estado === 'CERRADO') || (cm.data || []).some((x) => x.anio === a && x.mes === m && x.cerrado);
        const filas = anios.map((a) => {
          const e = (ej.data || []).find((x) => x.anio === a);
          const meses = Array.from({ length: 12 }, (_, i) => { const n = ps.filter((p) => p.anio === a && p.mes === i + 1 && p.estado === 'VIGENTE').length; return cerrado(a, i + 1) ? `✓ ${n || ''}`.trim() : n ? String(n) : '·'; });
          return { valores: [String(a), `¤${e?.estado || 'ABIERTO'}`, ...meses, ps.filter((p) => p.anio === a && p.estado === 'VIGENTE').length, e ? r2(e.resultado) : '', e?.cerrado_por ? `${e.cerrado_por} ${fmt.fechaDia(String(e.cerrado_en).slice(0, 10))}` : ''] };
        });
        const nCerr = (ej.data || []).filter((x) => x.estado === 'CERRADO').length;
        cfg = { titulo: 'Ejercicios y períodos contables', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Ejercicios', archivo: 'ejercicios_contables', parametros: [`Empresa: ${empresaDe(ctx)}`, '✓ = mes cerrado · número = partidas vigentes · = sin partidas'],
          columnas: [col('Año', 'texto', 7), col('Ejercicio', 'texto', 11), ...MES.map((m) => col(m.slice(0, 3), 'texto', 6)), col('Partidas', 'numero', 9), col('Resultado Q', 'monto', 15), col('Cerrado por', 'texto', 22)], filas, vacio: 'La empresa aún no tiene partidas.' };
        ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Cada ejercicio con sus doce meses: <b>✓</b> mes cerrado y el número de partidas vigentes. Los meses se cierran en Procesos › Cierre de mes y el ejercicio en Procesos › Cierre del ejercicio; con el ejercicio cerrado sus doce meses quedan cerrados.</p>
          <div class="ec-kpis">${kpi('Ejercicios', anios.length)}${kpi('Cerrados', nCerr, 'ec-fin')}${kpi('Abiertos', anios.length - nCerr)}${kpi('Meses cerrados', (cm.data || []).filter((x) => x.cerrado).length)}</div>${tabla(cfg)}</div>`;
        window.CUENTAS_XLSX.ajustarAlto(cont);
      } catch (e) { falta(ctx, e); }
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') cargar(); });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp);
      if (e.target.closest('[data-accion="abrir"]')) {
        const anio = Number(prompt('Año del ejercicio que se abre:', String(new Date().getFullYear() + 1)));
        if (!anio) return;
        const { error } = await sb.from('ejercicios_contables').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, anio, estado: 'ABIERTO' });
        if (error) return window.FIN.aviso(/duplicate|unique/i.test(error.message) ? `El ejercicio ${anio} ya existe` : errorTxt(error));
        window.FIN.aviso(`Ejercicio ${anio} abierto`); cargar();
      }
    });
    iniciar();
  };

  // ===================== Cuentas de integración y de cierre =====================
  function pantallaClaves(cont, op) {
    const ctx = montar(cont, { titulo: op.titulo, icono: op.icono, clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Contabilidad · Catálogos' });
    const { sb } = ctx;
    let cs = [], K = null, cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', op.icono); return; }
      ctx.filtros('', `${ctx.admin ? '<button type="button" class="boton secundario-sm" data-accion="sugerir"><i class="ti ti-wand" aria-hidden="true"></i> Sugerir cuentas</button>' : ''}${botonesExp}`);
      try { [cs, K] = await Promise.all([cuentasEmpresa(ctx), cuentasClave(ctx)]); } catch (e) { return falta(ctx, e); }
      pintar();
    }
    const nombre = (cod) => cs.find((c) => c.codigo === cod)?.nombre || '';
    function pintar() {
      const ed = ctx.admin;
      const filas = op.claves.map(([k, t, uso]) => {
        const cod = K.cuenta(k), propia = (K.filas.get(k)?.cuenta_codigo || '').trim(), c = cs.find((x) => x.codigo === cod);
        const estado = !cod ? 'PENDIENTE' : !c ? 'ALERTA' : op.soloMov && c.integra ? 'ALERTA' : 'OK';
        return { k, t, uso, cod, propia, c, estado, nota: K.filas.get(k)?.nota || '', fuente: propia ? 'Configurada' : cod ? 'Parámetros generales' : '' };
      });
      cfg = { titulo: op.titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: op.titulo.slice(0, 30), archivo: op.archivo, parametros: [`Empresa: ${empresaDe(ctx)}`],
        columnas: [col('Concepto', 'texto', 30), col('Uso', 'texto', 30), col('Cuenta', 'texto', 14), col('Nombre de la cuenta', 'texto', 34), col('Origen', 'texto', 16), col('Estado', 'texto', 10)],
        filas: filas.map((x) => ({ valores: [x.t, x.uso, x.cod, x.c?.nombre || (x.cod ? 'No existe en el catálogo' : ''), x.fuente, `¤${x.estado}`] })) };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> ${op.ayuda}</p>
        <div class="ec-kpis">${kpi('Conceptos', filas.length)}${kpi('Configuradas', filas.filter((x) => x.estado === 'OK').length, 'ec-fin')}${kpi('Pendientes', filas.filter((x) => x.estado === 'PENDIENTE').length)}${kpi('Con error', filas.filter((x) => x.estado === 'ALERTA').length, filas.some((x) => x.estado === 'ALERTA') ? 'ec-alerta' : '')}</div>
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr><th>Concepto</th><th>Uso</th><th>Cuenta contable</th><th>Nombre</th><th>Nota</th><th>Estado</th></tr></thead><tbody>
        ${filas.map((x) => `<tr data-clave="${x.k}"><td><b>${esc(x.t)}</b></td><td>${esc(x.uso)}</td>
          <td>${ed ? `<input data-c="cuenta_codigo" list="cc-cuentas" value="${esc(x.propia)}" placeholder="${esc(x.cod && !x.propia ? `${x.cod} (parámetros)` : 'Código')}">` : esc(x.cod)}</td>
          <td>${esc(x.c?.nombre || (x.cod ? 'No existe en el catálogo' : ''))}${x.c && op.soloMov && x.c.integra ? ' <small class="pc-rojo">(agrupa: usa una de movimiento)</small>' : ''}</td>
          <td>${ed ? `<input data-c="nota" value="${esc(x.nota)}">` : esc(x.nota)}</td><td>${marca(x.estado)}</td></tr>`).join('')}</tbody></table></div>${listaCuentas('cc-cuentas', cs, op.soloMov)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    async function guardar(clave, cambio) {
      const actual = K.filas.get(clave);
      const datos = { organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, clave, cuenta_codigo: actual?.cuenta_codigo || '', nota: actual?.nota || null, ...cambio };
      if (!datos.cuenta_codigo) { if (actual) await sb.from('cuentas_integracion').delete().eq('id', actual.id); K = await cuentasClave(ctx); return pintar(); }
      const { error } = await sb.from('cuentas_integracion').upsert(datos, { onConflict: 'localidad_id,clave' });
      if (error) return window.FIN.aviso(errorTxt(error));
      K = await cuentasClave(ctx); pintar();
    }
    cont.addEventListener('change', (e) => {
      const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar();
      const tr = e.target.closest('tr[data-clave]'); const k = e.target.dataset.c; if (!tr || !k) return;
      guardar(tr.dataset.clave, { [k]: k === 'cuenta_codigo' ? e.target.value.trim().split(' ')[0] : e.target.value.trim() || null });
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp);
      if (e.target.closest('[data-accion="sugerir"]')) {
        let n = 0;
        for (const [k, , , re] of op.claves) {
          if (K.cuenta(k)) continue;
          const cand = cs.filter((c) => re.test(c.nombre.toUpperCase()) && (op.soloMov ? !c.integra : true)).sort((a, b) => (op.soloMov ? b.nivel - a.nivel : a.nivel - b.nivel) || a.codigo.localeCompare(b.codigo))[0];
          if (!cand) continue;
          const { error } = await sb.from('cuentas_integracion').upsert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, clave: k, cuenta_codigo: cand.codigo, nota: 'Sugerida por nombre' }, { onConflict: 'localidad_id,clave' });
          if (!error) n++;
        }
        window.FIN.aviso(n ? `${n} cuenta(s) sugerida(s) por su nombre: revísalas` : 'No se encontraron cuentas por sugerir'); K = await cuentasClave(ctx); pintar();
      }
    });
    iniciar();
  }
  window.PANTALLAS['con-cuentas-integracion'] = (cont) => pantallaClaves(cont, { titulo: 'Cuentas de integración', icono: 'ti-plug-connected', archivo: 'cuentas_integracion', claves: CLAVES_INTEGRACION, soloMov: false,
    ayuda: 'Cuenta de control de cada auxiliar. Puede ser una cuenta mayor: la integración suma todas sus subcuentas. Los bancos usan la cuenta contable de cada cuenta bancaria. «Sugerir cuentas» busca por nombre en el catálogo las que falten.' });
  window.PANTALLAS['con-cuentas-cierre'] = (cont) => pantallaClaves(cont, { titulo: 'Cuentas de cierre', icono: 'ti-lock-square', archivo: 'cuentas_cierre', claves: CLAVES_CIERRE, soloMov: true,
    ayuda: 'Cuentas de movimiento que usa el cierre anual. Si no se configuran se usan las de Parámetros generales (resultado del ejercicio, ganancia y pérdida acumuladas). La reserva legal es el 5 % de la utilidad neta de cada ejercicio (Código de Comercio, art. 36).' });

  // ===================== Lista editable genérica =====================
  function lista(cont, op) {
    const ctx = montar(cont, { titulo: op.titulo, icono: op.icono, clase: 'bk-movimientos bm-solo cx-rep pf-cat', grupo: op.grupo });
    const { sb } = ctx;
    let filas = [], extra = {}, cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', op.icono); return; }
      ctx.filtros(op.filtros ? op.filtros(extra) : '', `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>' : ''}${botonesExp}`);
      try {
        let x = sb.from(op.tabla).select('*');
        x = op.porOrg ? x.eq('organizacion_id', ctx.sel.org) : x.eq('localidad_id', ctx.sel.loc);
        const { data, error } = await x.order(op.orden || 'id'); if (error) throw error;
        filas = data || [];
        if (op.cargarExtra) await op.cargarExtra(ctx, filas, extra);
      } catch (e) { return falta(ctx, e); }
      pintar();
    }
    const opciones = (c) => (c.ref ? [['', '—'], ...c.ref(ctx, extra)] : c.opciones.map((o) => [o, o]));
    const valorTxt = (c, f) => (c.calc ? c.calc(f, extra) : c.tipo === 'check' ? (f[c.k] ? 'Sí' : 'No') : c.ref ? (c.ref(ctx, extra).find(([v]) => String(v) === String(f[c.k]))?.[1] || '') : c.tipo === 'fecha' ? (f[c.k] ? fmt.fechaDia(f[c.k]) : '') : f[c.k] ?? '');
    function pintar() {
      const ed = ctx.admin;
      cfg = { titulo: op.titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: op.titulo.slice(0, 30), archivo: op.tabla, parametros: [`Empresa: ${empresaDe(ctx)}`], columnas: op.campos.map((c) => col(c.titulo, c.tipo === 'numero' || c.tipo === 'monto' ? c.tipo : 'texto', c.ancho || 14)),
        filas: filas.map((f) => ({ valores: op.campos.map((c) => { const v = valorTxt(c, f); return c.tipo === 'monto' || c.tipo === 'numero' ? num(v) : String(v); }) })) };
      const celda = (c, f) => {
        if (c.calc || !ed) { const v = valorTxt(c, f); return `<td class="${c.tipo === 'monto' || c.tipo === 'numero' ? 'num' : ''}">${c.marca ? marca(String(v)) : esc(c.tipo === 'monto' ? fmt.monto(v) : String(v))}</td>`; }
        if (c.opciones || c.ref) return `<td><select data-c="${c.k}">${opciones(c).map(([v, t]) => `<option value="${esc(String(v))}" ${String(f[c.k] ?? '') === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></td>`;
        if (c.tipo === 'check') return `<td><input type="checkbox" data-c="${c.k}" ${f[c.k] ? 'checked' : ''}></td>`;
        return `<td><input data-c="${c.k}" value="${esc(String(f[c.k] ?? ''))}" ${c.tipo === 'numero' || c.tipo === 'monto' ? 'type="number" step="any"' : c.tipo === 'fecha' ? 'type="date"' : ''} ${c.lista ? `list="${c.lista}"` : ''}></td>`;
      };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> ${op.ayuda}</p>${op.kpis ? `<div class="ec-kpis">${op.kpis(filas, extra).map(([t, v, c]) => kpi(t, v, c)).join('')}</div>` : ''}
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${op.campos.map((c) => `<th class="${c.tipo === 'monto' || c.tipo === 'numero' ? 'num' : ''}">${c.titulo}</th>`).join('')}${ed ? '<th></th>' : ''}</tr></thead>
        <tbody>${filas.map((f) => `<tr data-id="${f.id}">${op.campos.map((c) => celda(c, f)).join('')}${ed ? '<td><button type="button" class="icono-boton rp-peligro" data-quitar title="Quitar"><i class="ti ti-trash" aria-hidden="true"></i></button></td>' : ''}</tr>`).join('') || `<tr><td colspan="${op.campos.length + 1}" class="tk-vacio">Sin registros. Usa «Nuevo».</td></tr>`}</tbody></table></div>
        ${op.listas ? op.listas(extra) : ''}${op.despues ? op.despues(filas, extra, ctx) : ''}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', async (e) => {
      const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar();
      if (e.target.closest('.bk-filtros') && op.alFiltrar) { await op.alFiltrar(e, extra, ctx, filas); return pintar(); }
      const tr = e.target.closest('tr[data-id]'); const k = e.target.dataset.c; if (!tr || !k) return;
      const c = op.campos.find((x) => x.k === k);
      const v = c.tipo === 'check' ? e.target.checked : c.tipo === 'numero' || c.tipo === 'monto' ? num(e.target.value) : c.ref ? (Number(e.target.value) || null) : c.tipo === 'fecha' ? (e.target.value || null) : c.mayus === false ? e.target.value.trim() : e.target.value.trim().toUpperCase();
      const { error } = await sb.from(op.tabla).update({ [k]: v }).eq('id', Number(tr.dataset.id));
      if (error) { window.FIN.aviso(errorTxt(error)); return cargar(); }
      Object.assign(filas.find((f) => String(f.id) === tr.dataset.id), { [k]: v }); pintar();
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(op.exportar ? op.exportar(cfg, filas, extra) : cfg, ex.dataset.exp);
      if (e.target.closest('[data-accion="nuevo"]')) {
        const base = op.porOrg ? { organizacion_id: ctx.sel.org } : { organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc };
        const { error } = await sb.from(op.tabla).insert({ ...base, ...op.nuevo(filas, ctx, extra) }); if (error) return window.FIN.aviso(errorTxt(error)); return cargar();
      }
      if (e.target.closest('[data-quitar]')) { if (!confirm('¿Quitar el registro?')) return; const { error } = await sb.from(op.tabla).delete().eq('id', Number(e.target.closest('tr').dataset.id)); if (error) return window.FIN.aviso(errorTxt(error)); cargar(); }
      if (op.alClic) op.alClic(e, ctx, filas, extra, cargar);
    });
    iniciar();
  }
  const sig = (f) => Math.max(0, ...f.map((x) => Number(x.codigo) || 0)) + 1;

  // ===================== Libros autorizados SAT =====================
  const LIBROS = ['DIARIO', 'MAYOR', 'INVENTARIOS Y BALANCES', 'ESTADOS FINANCIEROS', 'COMPRAS Y SERVICIOS RECIBIDOS', 'VENTAS Y SERVICIOS PRESTADOS', 'ACTAS DE ASAMBLEA', 'SALARIOS', 'OTRO'];
  window.PANTALLAS['con-libros-sat'] = (cont) => lista(cont, { titulo: 'Libros autorizados SAT', icono: 'ti-books', grupo: 'Contabilidad · Catálogos', tabla: 'libros_autorizados',
    ayuda: 'Libros contables habilitados por la SAT con su resolución, forma (hojas móviles, empastado o electrónico) y folios autorizados. El sistema avisa cuando quedan menos del 10 % de folios: solicita la habilitación de más hojas a tiempo.',
    kpis: (f) => { const disp = f.filter((x) => x.activo).map((x) => x.folio_final - x.folio_usado); return [['Libros', f.length], ['Activos', f.filter((x) => x.activo).length, 'ec-fin'], ['Folios disponibles', sum(disp)], ['Por agotarse', f.filter((x) => x.activo && (x.folio_final - x.folio_usado) < 0.1 * (x.folio_final - x.folio_inicial + 1)).length, f.some((x) => x.activo && (x.folio_final - x.folio_usado) < 0.1 * (x.folio_final - x.folio_inicial + 1)) ? 'ec-alerta' : '']]; },
    campos: [{ k: 'libro', titulo: 'Libro', opciones: LIBROS, ancho: 26 }, { k: 'resolucion', titulo: 'Resolución SAT', ancho: 18 }, { k: 'fecha_autorizacion', titulo: 'Autorizado', tipo: 'fecha', ancho: 12 }, { k: 'forma', titulo: 'Forma', opciones: ['HOJAS MÓVILES', 'LIBRO EMPASTADO', 'ELECTRÓNICO'] },
      { k: 'folio_inicial', titulo: 'Folio inicial', tipo: 'numero', ancho: 9 }, { k: 'folio_final', titulo: 'Folio final', tipo: 'numero', ancho: 9 }, { k: 'folio_usado', titulo: 'Último usado', tipo: 'numero', ancho: 9 },
      { k: 'disp', titulo: 'Disponibles', tipo: 'numero', calc: (f) => Math.max(0, f.folio_final - Math.max(f.folio_usado, f.folio_inicial - 1)), ancho: 9 }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
    nuevo: () => ({ libro: 'DIARIO', folio_inicial: 1, folio_final: 500, folio_usado: 0 }) });

  // ===================== Provisiones y diferidos =====================
  window.PANTALLAS['con-diferidos'] = (cont) => lista(cont, { titulo: 'Provisiones y diferidos', icono: 'ti-hourglass', grupo: 'Contabilidad · Registros', tabla: 'diferidos', orden: 'codigo',
    ayuda: 'Gastos pagados por anticipado (seguros, alquileres), provisiones (aguinaldo, bono 14, indemnización), ingresos diferidos y amortizaciones con su monto total y número de cuotas. La cuota de cada mes se genera en Procesos › Recurrentes y amortizaciones.',
    cargarExtra: async (ctx, filas, x) => { x.cs = await cuentasEmpresa(ctx); const { data } = await ctx.sb.from('partidas_generadas').select('referencia_id, monto, partidas!inner(estado)').eq('localidad_id', ctx.sel.loc).eq('origen', 'DIFERIDO').eq('partidas.estado', 'VIGENTE'); x.ap = new Map(); (data || []).forEach((g) => { const a = x.ap.get(g.referencia_id) || { n: 0, m: 0 }; a.n++; a.m += num(g.monto); x.ap.set(g.referencia_id, a); }); },
    listas: (x) => listaCuentas('df-cuentas', x.cs || [], true),
    kpis: (f, x) => [['Registros', f.length], ['Monto total', q(sum(f.map((d) => d.monto_total)))], ['Aplicado', q(sum(f.map((d) => x.ap?.get(d.id)?.m || 0))), 'ec-fin'], ['Por aplicar', q(sum(f.map((d) => d.monto_total - (x.ap?.get(d.id)?.m || 0))))]],
    campos: [{ k: 'codigo', titulo: 'No.', tipo: 'numero', ancho: 6 }, { k: 'descripcion', titulo: 'Descripción', ancho: 30 }, { k: 'tipo', titulo: 'Tipo', opciones: ['GASTO DIFERIDO', 'PROVISIÓN', 'INGRESO DIFERIDO', 'AMORTIZACIÓN'] },
      { k: 'cuenta_debe', titulo: 'Cuenta al debe', lista: 'df-cuentas', ancho: 13 }, { k: 'cuenta_haber', titulo: 'Cuenta al haber', lista: 'df-cuentas', ancho: 13 }, { k: 'monto_total', titulo: 'Monto Q', tipo: 'monto' }, { k: 'cuotas', titulo: 'Cuotas', tipo: 'numero', ancho: 7 },
      { k: 'anio_inicio', titulo: 'Año inicio', tipo: 'numero', ancho: 8 }, { k: 'mes_inicio', titulo: 'Mes inicio', tipo: 'numero', ancho: 7 }, { k: 'cuota', titulo: 'Cuota Q', tipo: 'monto', calc: (f) => r2(f.monto_total / Math.max(1, f.cuotas)) },
      { k: 'apl', titulo: 'Aplicadas', tipo: 'numero', calc: (f, x) => x.ap?.get(f.id)?.n || 0 }, { k: 'saldo', titulo: 'Saldo Q', tipo: 'monto', calc: (f, x) => r2(f.monto_total - (x.ap?.get(f.id)?.m || 0)) }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
    nuevo: (f) => { const h = new Date(); return { codigo: sig(f), descripcion: 'SEGURO PAGADO POR ANTICIPADO', tipo: 'GASTO DIFERIDO', cuenta_debe: '', cuenta_haber: '', monto_total: 12000, cuotas: 12, anio_inicio: h.getFullYear(), mes_inicio: h.getMonth() + 1 }; } });

  // ===================== Cuentas intercompañía =====================
  window.PANTALLAS['con-intercompania'] = (cont) => lista(cont, { titulo: 'Cuentas intercompañía', icono: 'ti-arrows-left-right', grupo: 'Contabilidad · Registros', tabla: 'cuentas_intercompania', porOrg: true,
    ayuda: 'Pares de cuentas recíprocas entre localidades de la organización (por cobrar en una, por pagar en la otra). Al consolidar se eliminan; la conciliación de abajo muestra si sus saldos se compensan a la fecha.',
    filtros: (x) => `<label class="campo"><span>Conciliar al</span><input type="date" name="al" value="${x.al || fmt.hoy()}" max="${fmt.hoy()}"></label>`,
    alFiltrar: async (e, x, ctx, filas) => { if (e.target.name === 'al') { x.al = e.target.value || fmt.hoy(); await conciliar(ctx, filas, x); } },
    cargarExtra: async (ctx, filas, x) => { x.al = x.al || fmt.hoy(); x.cs = await cuentasEmpresa(ctx); await conciliar(ctx, filas, x); },
    listas: (x) => listaCuentas('ic-cuentas', x.cs || [], false),
    campos: [{ k: 'descripcion', titulo: 'Descripción', ancho: 30 }, { k: 'localidad_a_id', titulo: 'Localidad A', ref: (ctx) => ctx.localidades.filter((l) => l.organizacion_id === ctx.sel.org).map((l) => [l.id, `${l.codigo} · ${l.nombre_comercial}`]) }, { k: 'cuenta_a', titulo: 'Cuenta A', lista: 'ic-cuentas', ancho: 13 },
      { k: 'localidad_b_id', titulo: 'Localidad B', ref: (ctx) => ctx.localidades.filter((l) => l.organizacion_id === ctx.sel.org).map((l) => [l.id, `${l.codigo} · ${l.nombre_comercial}`]) }, { k: 'cuenta_b', titulo: 'Cuenta B', lista: 'ic-cuentas', ancho: 13 }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
    nuevo: (f, ctx) => { const ls = ctx.localidades.filter((l) => l.organizacion_id === ctx.sel.org); return { descripcion: 'CUENTA ENTRE COMPAÑÍAS', localidad_a_id: ls[0]?.id, cuenta_a: '', localidad_b_id: (ls[1] || ls[0])?.id, cuenta_b: '' }; },
    despues: (filas, x) => { if (!x.conc?.length) return ''; return `<h3 class="pr-sub"><i class="ti ti-scale" aria-hidden="true"></i> Conciliación al ${fmt.fechaDia(x.al)}</h3>${tabla(x.cfgConc, false)}`; },
    exportar: (cfg, filas, x) => (x.cfgConc?.filas.length ? x.cfgConc : cfg) });
  async function conciliar(ctx, filas, x) {
    const act = filas.filter((f) => f.activo && f.cuenta_a && f.cuenta_b);
    if (!act.length) { x.conc = []; return; }
    const locs = [...new Set(act.flatMap((f) => [f.localidad_a_id, f.localidad_b_id]))];
    const base = await leer(ctx, { locs, hasta: x.al });
    const sd = (loc, cod) => sum(base.lineas.filter((l) => l.p.localidad_id === loc && l.c && l.c.codigo.startsWith(cod)).map((l) => num(l.debe) - num(l.haber)));
    const nom = (id) => ctx.localidad(id)?.codigo || id;
    x.conc = act.map((f) => { const a = sd(f.localidad_a_id, f.cuenta_a), b = sd(f.localidad_b_id, f.cuenta_b); return { f, a, b, d: r2(a + b) }; });
    x.cfgConc = { titulo: 'Conciliación intercompañía', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Intercompañía', archivo: `intercompania_${x.al}`, parametros: [`Organización: ${ctx.organizaciones.find((o) => o.id === ctx.sel.org)?.nombre || ''}`, `Al ${fmt.fechaDia(x.al)}`, 'Saldo deudor positivo, acreedor negativo: la suma debe ser cero'],
      columnas: [col('Descripción', 'texto', 30), col('Localidad A · cuenta', 'texto', 22), col('Saldo A Q', 'monto', 15), col('Localidad B · cuenta', 'texto', 22), col('Saldo B Q', 'monto', 15), col('Diferencia Q', 'monto', 15), col('Estado', 'texto', 11)],
      filas: x.conc.map((c) => ({ valores: [c.f.descripcion, `${nom(c.f.localidad_a_id)} · ${c.f.cuenta_a}`, r2(c.a), `${nom(c.f.localidad_b_id)} · ${c.f.cuenta_b}`, r2(c.b), c.d, Math.abs(c.d) < 0.01 ? '¤CUADRA' : '¤DIFERENCIA'], resaltar: Math.abs(c.d) >= 0.01 })) };
  }

  // ===================== Partidas recurrentes =====================
  window.PANTALLAS['con-recurrentes'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Partidas recurrentes', icono: 'ti-repeat', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Contabilidad · Registros' });
    const { sb } = ctx;
    let rs = [], ls = [], tipos = [], cs = [], actual = null, cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar(id = actual?.id) {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-repeat'); return; }
      ctx.filtros('', `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nueva plantilla</button>' : ''}${botonesExp}`);
      try {
        const [a, t] = await Promise.all([sb.from('partidas_recurrentes').select('*').eq('localidad_id', ctx.sel.loc).order('codigo'), sb.from('tipos_partida').select('id, siglas, nombre').order('id')]);
        if (a.error) throw a.error;
        rs = a.data || []; tipos = (t.data || []).filter((x) => !['PA', 'PCR', 'PCE'].includes(x.siglas));
        const { data: l } = rs.length ? await sb.from('partida_recurrente_lineas').select('*').in('recurrente_id', rs.map((r) => r.id)).order('linea') : { data: [] };
        ls = l || []; if (!cs.length) cs = await cuentasEmpresa(ctx);
      } catch (e) { return falta(ctx, e); }
      actual = rs.find((r) => r.id === id) || rs[0] || null;
      pintar();
    }
    const lineasDe = (r) => ls.filter((l) => l.recurrente_id === r.id);
    const periodo = (r) => `${String(r.mes_desde).padStart(2, '0')}/${r.anio_desde}${r.anio_hasta ? ` a ${String(r.mes_hasta || 12).padStart(2, '0')}/${r.anio_hasta}` : ' en adelante'}`;
    function pintar() {
      const ed = ctx.admin, r = actual;
      cfg = { titulo: 'Partidas recurrentes', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Recurrentes', archivo: 'partidas_recurrentes', parametros: [`Empresa: ${empresaDe(ctx)}`],
        columnas: [col('No.', 'texto', 7), col('Cuenta', 'texto', 14), col('Nombre', 'texto', 34), col('Concepto', 'texto', 34), col('Debe', 'monto', 15), col('Haber', 'monto', 15)],
        filas: rs.flatMap((x) => [{ valores: [`${x.codigo} · ${x.descripcion} · ${tipos.find((t) => t.id === x.tipo_partida_id)?.siglas || ''} · ${periodo(x)}${x.activa ? '' : ' (inactiva)'}`], tipo: 'grupo', combinar: true },
          ...lineasDe(x).map((l) => ({ valores: [l.linea, l.cuenta_codigo, cs.find((c) => c.codigo === l.cuenta_codigo)?.nombre || '', l.concepto || '', r2(l.debe) || '', r2(l.haber) || ''] })),
          { valores: ['', 'Total', '', '', r2(sum(lineasDe(x).map((l) => l.debe))), r2(sum(lineasDe(x).map((l) => l.haber)))], tipo: 'subtotal' }]) };
      const d = r ? sum(lineasDe(r).map((l) => l.debe)) : 0, h = r ? sum(lineasDe(r).map((l) => l.haber)) : 0;
      const dis = ed ? '' : 'disabled';
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Plantillas de partidas que se repiten cada mes (alquileres, cuotas, servicios, amortizaciones fijas). Se generan aprobadas en Procesos › Recurrentes y amortizaciones, una sola vez por mes.</p>
        <div class="ec-kpis">${kpi('Plantillas', rs.length)}${kpi('Activas', rs.filter((x) => x.activa).length, 'ec-fin')}${kpi('Monto mensual', q(sum(rs.filter((x) => x.activa).map((x) => sum(lineasDe(x).map((l) => l.debe))))))}</div>
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr><th>No.</th><th>Descripción</th><th>Tipo</th><th>Vigencia</th><th class="num">Monto Q</th><th>Estado</th></tr></thead><tbody>
          ${rs.map((x) => `<tr data-rec="${x.id}" class="${x === r ? 'cr-n2' : ''}" style="cursor:pointer"><td>${x.codigo}</td><td>${esc(x.descripcion)}</td><td>${esc(tipos.find((t) => t.id === x.tipo_partida_id)?.siglas || '')}</td><td>${periodo(x)}</td><td class="num">${fmt.monto(sum(lineasDe(x).map((l) => l.debe)))}</td><td>${marca(x.activa ? 'OK' : 'PENDIENTE').replace('>OK<', '>ACTIVA<').replace('>PENDIENTE<', '>INACTIVA<')}</td></tr>`).join('') || '<tr><td colspan="6" class="tk-vacio">Sin plantillas. Usa «Nueva plantilla».</td></tr>'}</tbody></table></div>
        ${r ? `<form class="cr-rec" novalidate><div class="cl-banda">Plantilla ${r.codigo} · ${esc(r.descripcion)}</div><div class="sat-g">
          <label class="campo sat-ancho"><span>Descripción</span><input name="descripcion" value="${esc(r.descripcion)}" ${dis}></label>
          <label class="campo"><span>Tipo de partida</span><select name="tipo_partida_id" ${dis}>${opt(tipos, r.tipo_partida_id, 'id', (t) => `${t.siglas} · ${t.nombre}`, null)}</select></label>
          <label class="campo"><span>Desde (año)</span><input type="number" name="anio_desde" value="${r.anio_desde}" ${dis}></label><label class="campo"><span>Desde (mes)</span><input type="number" min="1" max="12" name="mes_desde" value="${r.mes_desde}" ${dis}></label>
          <label class="campo"><span>Hasta (año)</span><input type="number" name="anio_hasta" value="${r.anio_hasta ?? ''}" placeholder="Sin fin" ${dis}></label><label class="campo"><span>Hasta (mes)</span><input type="number" min="1" max="12" name="mes_hasta" value="${r.mes_hasta ?? ''}" ${dis}></label>
          <label class="pc-check"><input type="checkbox" name="activa" ${r.activa ? 'checked' : ''} ${dis}> Activa</label></div>
          <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr><th>#</th><th>Cuenta</th><th>Nombre</th><th>Concepto</th><th class="num">Debe</th><th class="num">Haber</th>${ed ? '<th></th>' : ''}</tr></thead><tbody>
          ${lineasDe(r).map((l) => `<tr data-lin="${l.id}"><td>${l.linea}</td><td>${ed ? `<input data-l="cuenta_codigo" list="rc-cuentas" value="${esc(l.cuenta_codigo)}">` : esc(l.cuenta_codigo)}</td><td>${esc(cs.find((c) => c.codigo === l.cuenta_codigo)?.nombre || 'No existe en el catálogo')}</td>
            <td>${ed ? `<input data-l="concepto" value="${esc(l.concepto || '')}">` : esc(l.concepto || '')}</td><td class="num">${ed ? `<input data-l="debe" type="number" step="0.01" value="${l.debe}">` : fmt.monto(l.debe)}</td><td class="num">${ed ? `<input data-l="haber" type="number" step="0.01" value="${l.haber}">` : fmt.monto(l.haber)}</td>
            ${ed ? '<td><button type="button" class="icono-boton rp-peligro" data-quitar-lin title="Quitar línea"><i class="ti ti-trash" aria-hidden="true"></i></button></td>' : ''}</tr>`).join('')}
          <tr class="pr-t"><td></td><td colspan="3">${Math.abs(d - h) < 0.005 && d > 0 ? marca('CUADRA') : marca('DIFERENCIA')} Diferencia Q ${fmt.monto(d - h)}</td><td class="num">${fmt.monto(d)}</td><td class="num">${fmt.monto(h)}</td>${ed ? '<td></td>' : ''}</tr></tbody></table></div>
          ${ed ? `<p class="acciones-form"><button type="button" class="boton secundario-sm" data-accion="linea"><i class="ti ti-row-insert-bottom" aria-hidden="true"></i> Agregar línea</button> <button type="button" class="boton secundario-sm rp-peligro" data-accion="borrar"><i class="ti ti-trash" aria-hidden="true"></i> Eliminar plantilla</button></p>` : ''}</form>${listaCuentas('rc-cuentas', cs, true)}` : ''}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', async (e) => {
      const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar();
      if (!actual || !ctx.admin) return;
      const lin = e.target.closest('tr[data-lin]');
      if (lin && e.target.dataset.l) {
        const k = e.target.dataset.l, v = ['debe', 'haber'].includes(k) ? r2(e.target.value) : k === 'cuenta_codigo' ? e.target.value.trim().split(' ')[0] : e.target.value.trim();
        const { error } = await sb.from('partida_recurrente_lineas').update({ [k]: v }).eq('id', Number(lin.dataset.lin)); if (error) window.FIN.aviso(errorTxt(error)); return cargar();
      }
      const n = e.target.name; if (!e.target.closest('form.cr-rec') || !n) return;
      const v = n === 'activa' ? e.target.checked : ['anio_desde', 'mes_desde', 'anio_hasta', 'mes_hasta', 'tipo_partida_id'].includes(n) ? (Number(e.target.value) || null) : e.target.value.trim().toUpperCase();
      const { error } = await sb.from('partidas_recurrentes').update({ [n]: v }).eq('id', actual.id); if (error) window.FIN.aviso(errorTxt(error)); cargar();
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp);
      const tr = e.target.closest('tr[data-rec]'); if (tr) { actual = rs.find((r) => String(r.id) === tr.dataset.rec); return pintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'nuevo') {
        const h = new Date(), td = tipos.find((t) => t.siglas === 'PD') || tipos[0];
        const { data, error } = await sb.from('partidas_recurrentes').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, codigo: sig(rs), descripcion: 'ALQUILER MENSUAL DE OFICINAS', tipo_partida_id: td.id, anio_desde: h.getFullYear(), mes_desde: h.getMonth() + 1 }).select().single();
        if (error) return window.FIN.aviso(errorTxt(error));
        await sb.from('partida_recurrente_lineas').insert([{ recurrente_id: data.id, linea: 1, cuenta_codigo: '', concepto: 'Gasto', debe: 0, haber: 0 }, { recurrente_id: data.id, linea: 2, cuenta_codigo: '', concepto: 'Cuenta por pagar o banco', debe: 0, haber: 0 }]);
        return cargar(data.id);
      }
      if (a === 'linea' && actual) { await sb.from('partida_recurrente_lineas').insert({ recurrente_id: actual.id, linea: Math.max(0, ...lineasDe(actual).map((l) => l.linea)) + 1, cuenta_codigo: '', debe: 0, haber: 0 }); return cargar(); }
      if (a === 'borrar' && actual) { if (!confirm(`¿Eliminar la plantilla ${actual.codigo}? Las partidas ya generadas no se tocan.`)) return; const { error } = await sb.from('partidas_recurrentes').delete().eq('id', actual.id); if (error) return window.FIN.aviso(errorTxt(error)); actual = null; return cargar(null); }
      if (e.target.closest('[data-quitar-lin]')) { await sb.from('partida_recurrente_lineas').delete().eq('id', Number(e.target.closest('tr').dataset.lin)); return cargar(); }
    });
    iniciar();
  };

  // ===================== Filtro año / mes compartido por los procesos =====================
  function filtroPeriodo(f, conMes = true) {
    return `<label class="campo cx-anio"><span>Año</span><input type="number" name="anio" min="2000" max="2999" value="${f.anio}"></label>${conMes ? `<label class="campo"><span>Mes</span><select name="mes">${MES.map((m, i) => `<option value="${i + 1}" ${f.mes === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>` : ''}`;
  }
  const hoyAM = () => { const h = fmt.hoy(); return { anio: Number(h.slice(0, 4)), mes: Number(h.slice(5, 7)) }; };

  // ===================== Revisión previa al cierre =====================
  window.PANTALLAS['con-revision-cierre'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Revisión previa al cierre', icono: 'ti-checklist', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Contabilidad · Procesos' });
    const { sb } = ctx;
    const f = hoyAM(); let cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-checklist'); return; }
      ctx.filtros(filtroPeriodo(f), `<a class="boton secundario-sm" href="#/contabilidad/cierre-de-mes"><i class="ti ti-calendar-check" aria-hidden="true"></i> Ir a Cierre de mes</a>${botonesExp}`);
      ctx.pDet.innerHTML = '<p class="vacio">Revisando el mes…</p>';
      try { await revisar(); } catch (e) { falta(ctx, e); }
    }
    async function revisar() {
      const loc = ctx.sel.loc, a = f.anio, m = f.mes, desde = iniMes(a, m), hasta = finMes(a, m);
      const pa = m === 1 ? { a: a - 1, m: 12 } : { a, m: m - 1 };
      const [ps, cm, ej, movs, comp, fac, nom, recs, difs, gen, ppr] = await Promise.all([
        leerTodo(() => sb.from('partidas').select('id, numero, mes, descripcion, aprobada, total_debe, total_haber, tipo_partida_id').eq('localidad_id', loc).eq('anio', a).eq('mes', m).eq('estado', 'VIGENTE').order('numero')),
        sb.from('cierres_mes').select('anio, mes, cerrado').eq('localidad_id', loc).in('anio', [a, pa.a]),
        sb.from('ejercicios_contables').select('anio, estado').eq('localidad_id', loc),
        sb.from('movimientos_bancarios').select('id', { count: 'exact', head: true }).eq('localidad_id', loc).neq('estado', 'ANULADO').is('partida_id', null).gte('fecha', desde).lte('fecha', hasta),
        sb.from('compras').select('id', { count: 'exact', head: true }).eq('localidad_id', loc).eq('estado', 'ACTIVA').is('partida_id', null).gte('fecha_documento', desde).lte('fecha_documento', hasta),
        sb.from('facturas_venta').select('id', { count: 'exact', head: true }).eq('localidad_id', loc).neq('estado', 'ANULADA').is('partida_id', null).gte('fecha_emision', ini(desde)).lte('fecha_emision', fin(hasta)),
        sb.from('nom_planillas').select('id', { count: 'exact', head: true }).eq('localidad_id', loc).in('estado', ['APROBADA', 'PAGADA']).is('partida_id', null).eq('anio', a).eq('mes', m),
        sb.from('partidas_recurrentes').select('id, anio_desde, mes_desde, anio_hasta, mes_hasta, activa').eq('localidad_id', loc).eq('activa', true),
        sb.from('diferidos').select('id, cuotas, anio_inicio, mes_inicio, activo').eq('localidad_id', loc).eq('activo', true),
        sb.from('partidas_generadas').select('origen, referencia_id, anio, mes, partidas!inner(estado)').eq('localidad_id', loc).eq('partidas.estado', 'VIGENTE'),
        sb.from('partidas').select('id, tipos_partida!inner(siglas)').eq('localidad_id', loc).eq('anio', pa.a).eq('mes', pa.m).eq('estado', 'VIGENTE').eq('tipos_partida.siglas', 'PPR')
      ]);
      if (recs.error) throw recs.error;
      const ids = ps.map((p) => p.id);
      let lineas = [];
      for (let i = 0; i < ids.length; i += 200) lineas.push(...(await leerTodo(() => sb.from('partida_lineas').select('partida_id, cuenta_id, cuentas(codigo, nombre, integra)').in('partida_id', ids.slice(i, i + 200)).order('id'))));
      const cerrado = (aa, mm) => (ej.data || []).some((x) => x.anio === aa && x.estado === 'CERRADO') || (cm.data || []).some((x) => x.anio === aa && x.mes === mm && x.cerrado);
      const vig = (r) => r.activa && (r.anio_desde * 12 + r.mes_desde) <= a * 12 + m && (!r.anio_hasta || (r.anio_hasta * 12 + (r.mes_hasta || 12)) >= a * 12 + m);
      const genDe = (o, id) => (gen.data || []).some((g) => g.origen === o && g.referencia_id === id && g.anio === a && g.mes === m);
      const recPend = (recs.data || []).filter(vig).filter((r) => !genDe('RECURRENTE', r.id)).length;
      const k = a * 12 + m;
      const difPend = (difs.data || []).filter((d) => k >= d.anio_inicio * 12 + d.mes_inicio && k < d.anio_inicio * 12 + d.mes_inicio + d.cuotas && !genDe('DIFERIDO', d.id)).length;
      const revPend = (ppr.data || []).filter((p) => !(gen.data || []).some((g) => g.origen === 'REVERSIÓN' && g.referencia_id === p.id)).length;
      const desc = ps.filter((p) => num(p.total_debe) !== num(p.total_haber)), sinAp = ps.filter((p) => !p.aprobada);
      const enMayor = [...new Set(lineas.filter((l) => l.cuentas?.integra).map((l) => l.cuentas.codigo))];
      const cortas = ps.filter((p) => lineas.filter((l) => l.partida_id === p.id).length < 2);
      const nums = (xs) => xs.slice(0, 12).map((p) => `${m}-${p.numero}`).join(', ') + (xs.length > 12 ? '…' : '');
      const C = [
        ['Período', 'Mes anterior cerrado', cerrado(pa.a, pa.m) ? 'OK' : 'PENDIENTE', `${MES[pa.m - 1]} ${pa.a}${cerrado(pa.a, pa.m) ? ' está cerrado' : ' sigue abierto: ciérralo primero'}`, 'cierre-de-mes'],
        ['Período', 'Estado del mes', cerrado(a, m) ? 'OK' : 'PENDIENTE', cerrado(a, m) ? 'El mes ya está cerrado' : 'Abierto', 'cierre-de-mes'],
        ['Partidas', 'Partidas descuadradas', desc.length ? 'ALERTA' : 'OK', desc.length ? `${desc.length}: ${nums(desc)}` : 'Todas cuadran', 'consulta-de-partidas'],
        ['Partidas', 'Partidas sin aprobar', sinAp.length ? 'ALERTA' : 'OK', sinAp.length ? `${sinAp.length}: ${nums(sinAp)}` : 'Todas aprobadas', 'partidas-contables'],
        ['Partidas', 'Partidas con menos de dos líneas', cortas.length ? 'ALERTA' : 'OK', cortas.length ? `${cortas.length}: ${nums(cortas)}` : 'Ninguna', 'partidas-contables'],
        ['Partidas', 'Movimiento en cuentas que agrupan', enMayor.length ? 'ALERTA' : 'OK', enMayor.length ? enMayor.slice(0, 8).join(', ') : 'Solo cuentas de movimiento', 'con-mayorizacion'],
        ['Módulos', 'Movimientos bancarios sin partida', movs.count ? 'PENDIENTE' : 'OK', `${movs.count || 0} documento(s)`, 'movimientos-bancarios'],
        ['Módulos', 'Compras sin partida', comp.count ? 'PENDIENTE' : 'OK', `${comp.count || 0} documento(s)`, 'facturas-compra'],
        ['Módulos', 'Facturas de venta sin partida', fac.count ? 'INFORMATIVO' : 'OK', `${fac.count || 0} factura(s)${fac.count ? ': revisa si la venta se contabiliza por resumen' : ''}`, 'facturas-venta'],
        ['Módulos', 'Planillas sin partida', nom.count ? 'PENDIENTE' : 'OK', `${nom.count || 0} planilla(s)`, 'nom-planillas'],
        ['Automáticas', 'Partidas recurrentes del mes', recPend ? 'PENDIENTE' : 'OK', recPend ? `${recPend} por generar` : 'Generadas o sin plantillas', 'con-automaticas'],
        ['Automáticas', 'Cuotas de provisiones y diferidos', difPend ? 'PENDIENTE' : 'OK', difPend ? `${difPend} por generar` : 'Generadas o sin registros', 'con-automaticas'],
        ['Automáticas', 'Reversión de provisiones del mes anterior', revPend ? 'PENDIENTE' : 'OK', revPend ? `${revPend} provisión(es) de ${MES[pa.m - 1]} por revertir` : 'Sin pendientes', 'con-reversion'],
        ['Integraciones', 'Integraciones contables', 'INFORMATIVO', 'Compara saldos contables contra auxiliares antes de cerrar', 'con-integraciones']
      ];
      const ok = C.filter((c) => c[2] === 'OK').length, al = C.filter((c) => c[2] === 'ALERTA').length, pe = C.filter((c) => c[2] === 'PENDIENTE').length;
      cfg = { titulo: 'Revisión previa al cierre', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Revisión', archivo: `revision_cierre_${a}_${m}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `${MES[m - 1]} ${a}`, `${ps.length} partidas vigentes`],
        columnas: [col('Área', 'texto', 12), col('Verificación', 'texto', 34), col('Estado', 'texto', 12), col('Detalle', 'texto', 52)],
        filas: C.map((c) => ({ valores: [c[0], c[1], `¤${c[2]}`, c[3]], resaltar: c[2] === 'ALERTA', attr: `data-ir="${c[4]}" style="cursor:pointer" title="Abrir la pantalla"` })), firmas: ['Contador', 'Revisado por'] };
      const listo = !al && !C.slice(0, 1).some((c) => c[2] !== 'OK');
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="cl-banda">Revisión de ${MES[m - 1]} ${a} · ${esc(empresaDe(ctx))}</div>
        <div class="ec-kpis">${kpi('Verificaciones', C.length)}${kpi('Correctas', ok, 'ec-fin')}${kpi('Pendientes', pe)}${kpi('Alertas', al, al ? 'ec-alerta' : '')}${kpi('Listo para cerrar', listo ? 'Sí' : 'No', listo ? 'ec-fin' : 'ec-alerta')}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Las alertas impiden el cierre del mes; las pendientes conviene resolverlas antes. Toca un renglón para abrir la pantalla que lo resuelve.</p>${tabla(cfg)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); const n = e.target.name; if (n === 'anio' || n === 'mes') { f[n] = Number(e.target.value) || f[n]; cargar(); } });
    cont.addEventListener('click', (e) => { const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp); const tr = e.target.closest('tr[data-ir]'); if (tr) location.hash = `#/contabilidad/${tr.dataset.ir}`; });
    iniciar();
  };

  // ===================== Mayorización y validación =====================
  window.PANTALLAS['con-mayorizacion'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Mayorización y validación', icono: 'ti-scale', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Contabilidad · Procesos' });
    const { sb } = ctx;
    const f = hoyAM(); let cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-scale'); return; }
      ctx.filtros(filtroPeriodo(f, false), `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="mayorizar"><i class="ti ti-refresh" aria-hidden="true"></i> Mayorizar</button>' : ''}${botonesExp}`);
      ctx.pDet.innerHTML = '<p class="vacio">Validando el año…</p>';
      try {
        const ps = await leerTodo(() => sb.from('partidas').select('id, mes, numero, catalogo_id, total_debe, total_haber, aprobada').eq('localidad_id', ctx.sel.loc).eq('anio', f.anio).eq('estado', 'VIGENTE').order('id'));
        const ls = await leerTodo(() => sb.from('partida_lineas').select('partida_id, debe, haber, cuentas(catalogo_id, integra, codigo), partidas!inner(localidad_id, anio, estado)').eq('partidas.localidad_id', ctx.sel.loc).eq('partidas.anio', f.anio).eq('partidas.estado', 'VIGENTE').order('id'));
        const porP = new Map(); ls.forEach((l) => { const a = porP.get(l.partida_id) || { d: 0, h: 0, n: 0, mayor: 0, otro: 0 }; a.d += num(l.debe); a.h += num(l.haber); a.n++; if (l.cuentas?.integra) a.mayor++; porP.set(l.partida_id, a); });
        ls.forEach((l) => { const p = ps.find((x) => x.id === l.partida_id); if (p && l.cuentas && l.cuentas.catalogo_id !== p.catalogo_id) porP.get(l.partida_id).otro++; });
        const filas = []; const tot = { n: 0, d: 0, h: 0, desc: 0, tot: 0, may: 0, otro: 0, sinAp: 0 };
        for (let m = 1; m <= 12; m++) {
          const xs = ps.filter((p) => p.mes === m); if (!xs.length) continue;
          const st = xs.map((p) => ({ p, l: porP.get(p.id) || { d: 0, h: 0, n: 0, mayor: 0, otro: 0 } }));
          const r = { n: xs.length, d: sum(st.map((x) => x.l.d)), h: sum(st.map((x) => x.l.h)), desc: st.filter((x) => Math.abs(x.l.d - x.l.h) >= 0.005).length, tot: st.filter((x) => Math.abs(x.l.d - num(x.p.total_debe)) >= 0.005 || Math.abs(x.l.h - num(x.p.total_haber)) >= 0.005).length, may: sum(st.map((x) => x.l.mayor)), otro: sum(st.map((x) => x.l.otro)), sinAp: xs.filter((p) => !p.aprobada).length };
          Object.keys(tot).forEach((k) => { tot[k] += r[k]; });
          const est = r.desc || r.tot || r.may || r.otro ? 'ALERTA' : r.sinAp ? 'PENDIENTE' : 'OK';
          filas.push({ valores: [MES[m - 1], r.n, r2(r.d), r2(r.h), r2(r.d - r.h), r.desc, r.tot, r.may, r.otro, r.sinAp, `¤${est}`], resaltar: est === 'ALERTA' });
        }
        filas.push({ valores: ['Total del año', tot.n, r2(tot.d), r2(tot.h), r2(tot.d - tot.h), tot.desc, tot.tot, tot.may, tot.otro, tot.sinAp, ''], tipo: 'total' });
        cfg = { titulo: 'Mayorización y validación', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Mayorización', archivo: `mayorizacion_${f.anio}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `Ejercicio ${f.anio}`],
          columnas: [col('Mes', 'texto', 12), col('Partidas', 'numero', 9), col('Debe (líneas)', 'monto', 16), col('Haber (líneas)', 'monto', 16), col('Diferencia', 'monto', 13), col('Descuadradas', 'numero', 10), col('Totales distintos', 'numero', 10), col('Líneas en mayores', 'numero', 10), col('Otro catálogo', 'numero', 10), col('Sin aprobar', 'numero', 9), col('Estado', 'texto', 11)],
          filas, graficas: [G().columnas('Movimiento por mes (Q)', filas.slice(0, -1).map((x) => String(x.valores[0]).slice(0, 3)), [{ nombre: 'Debe', color: G().COLORES.AZUL, valores: filas.slice(0, -1).map((x) => x.valores[2]) }])] };
        ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Recorre todas las partidas vigentes del año: cuadre de cada una, totales del encabezado contra la suma de sus líneas, movimiento en cuentas que agrupan y cuentas de otra versión del catálogo. «Mayorizar» recalcula los totales de las partidas de los meses abiertos.</p>
          <div class="ec-kpis">${kpi('Partidas', tot.n)}${kpi('Debe = haber', Math.abs(tot.d - tot.h) < 0.01 ? 'Cuadra' : `Dif. Q ${fmt.monto(tot.d - tot.h)}`, Math.abs(tot.d - tot.h) < 0.01 ? 'ec-fin' : 'ec-alerta')}${kpi('Descuadradas', tot.desc, tot.desc ? 'ec-alerta' : '')}${kpi('Totales por recalcular', tot.tot, tot.tot ? 'ec-alerta' : '')}</div>${tabla(cfg)}</div>`;
        window.CUENTAS_XLSX.ajustarAlto(cont);
      } catch (e) { falta(ctx, e); }
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); if (e.target.name === 'anio') { f.anio = Number(e.target.value) || f.anio; cargar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp);
      if (e.target.closest('[data-accion="mayorizar"]')) { const { data, error } = await sb.rpc('con_mayorizar', { p_loc: ctx.sel.loc, p_anio: f.anio }); if (error) return window.FIN.aviso(errorTxt(error)); window.FIN.aviso(data ? `${data} partida(s) con totales recalculados` : 'Los totales ya estaban correctos'); cargar(); }
    });
    iniciar();
  };

  // ===================== Recurrentes y amortizaciones del mes =====================
  window.PANTALLAS['con-automaticas'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Recurrentes y amortizaciones', icono: 'ti-repeat', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Contabilidad · Procesos' });
    const { sb } = ctx;
    const f = hoyAM(); let items = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-repeat'); return; }
      ctx.filtros(filtroPeriodo(f), `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="generar"><i class="ti ti-player-play" aria-hidden="true"></i> Generar seleccionadas</button>' : ''}${botonesExp}`);
      ctx.pDet.innerHTML = '<p class="vacio">Leyendo plantillas y diferidos…</p>';
      try {
        const loc = ctx.sel.loc, k = f.anio * 12 + f.mes;
        const [rs, ds, gs, tp] = await Promise.all([sb.from('partidas_recurrentes').select('*').eq('localidad_id', loc).eq('activa', true).order('codigo'), sb.from('diferidos').select('*').eq('localidad_id', loc).eq('activo', true).order('codigo'),
          sb.from('partidas_generadas').select('origen, referencia_id, anio, mes, monto, partidas!inner(estado, numero, mes)').eq('localidad_id', loc).in('origen', ['RECURRENTE', 'DIFERIDO']).eq('partidas.estado', 'VIGENTE'), sb.from('tipos_partida').select('id, siglas')]);
        if (rs.error) throw rs.error;
        const { data: ls } = (rs.data || []).length ? await sb.from('partida_recurrente_lineas').select('*').in('recurrente_id', rs.data.map((r) => r.id)).order('linea') : { data: [] };
        const gen = (o, id) => (gs.data || []).find((g) => g.origen === o && g.referencia_id === id && g.anio === f.anio && g.mes === f.mes);
        const sig2 = (id) => (tp.data || []).find((t) => t.id === id)?.siglas || 'PD';
        items = [];
        (rs.data || []).filter((r) => r.anio_desde * 12 + r.mes_desde <= k && (!r.anio_hasta || r.anio_hasta * 12 + (r.mes_hasta || 12) >= k)).forEach((r) => {
          const lin = (ls || []).filter((l) => l.recurrente_id === r.id), g = gen('RECURRENTE', r.id);
          items.push({ origen: 'RECURRENTE', id: r.id, nombre: `${r.codigo} · ${r.descripcion}`, tipo: sig2(r.tipo_partida_id), cuota: '', monto: sum(lin.map((l) => l.debe)), g, lineas: lin.map((l) => ({ cuenta: l.cuenta_codigo, concepto: l.concepto || r.descripcion, debe: num(l.debe), haber: num(l.haber) })), desc: `${r.descripcion} · ${MES[f.mes - 1]} ${f.anio}` });
        });
        (ds.data || []).forEach((d) => {
          const i0 = d.anio_inicio * 12 + d.mes_inicio; if (k < i0 || k >= i0 + d.cuotas) return;
          const nCuota = k - i0 + 1, aplicado = sum((gs.data || []).filter((g) => g.origen === 'DIFERIDO' && g.referencia_id === d.id && !(g.anio === f.anio && g.mes === f.mes)).map((g) => g.monto));
          const cuota = nCuota === d.cuotas ? r2(d.monto_total - aplicado) : r2(d.monto_total / d.cuotas);
          const g = gen('DIFERIDO', d.id), tipo = d.tipo === 'PROVISIÓN' ? 'PPR' : d.tipo === 'INGRESO DIFERIDO' ? 'PD' : 'PDA';
          items.push({ origen: 'DIFERIDO', id: d.id, nombre: `${d.codigo} · ${d.descripcion}`, tipo, cuota: `${nCuota} de ${d.cuotas}`, monto: cuota, g, lineas: [{ cuenta: d.cuenta_debe, concepto: `${d.descripcion} cuota ${nCuota}/${d.cuotas}`, debe: cuota, haber: 0 }, { cuenta: d.cuenta_haber, concepto: `${d.descripcion} cuota ${nCuota}/${d.cuotas}`, debe: 0, haber: cuota }], desc: `${d.tipo === 'PROVISIÓN' ? 'Provisión' : 'Amortización'} ${d.descripcion} cuota ${nCuota}/${d.cuotas}` });
        });
        pintar();
      } catch (e) { falta(ctx, e); }
    }
    function pintar() {
      cfg = { titulo: 'Recurrentes y amortizaciones', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Automáticas', archivo: `automaticas_${f.anio}_${f.mes}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `${MES[f.mes - 1]} ${f.anio}`],
        columnas: [col('Origen', 'texto', 12), col('Descripción', 'texto', 40), col('Tipo', 'texto', 7), col('Cuota', 'texto', 10), col('Monto Q', 'monto', 15), col('Estado', 'texto', 12), col('Partida', 'texto', 12)],
        filas: items.map((x) => ({ valores: [x.origen === 'RECURRENTE' ? 'Recurrente' : 'Diferido', x.nombre, x.tipo, x.cuota, r2(x.monto), x.g ? '¤GENERADA' : '¤PENDIENTE', x.g ? `${x.tipo}-${x.g.partidas.numero}/${String(x.g.partidas.mes).padStart(2, '0')}` : ''] })) };
      const pend = items.filter((x) => !x.g);
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Partidas que corresponden a ${MES[f.mes - 1]} ${f.anio}: plantillas recurrentes vigentes y la cuota del mes de cada provisión o diferido (la última cuota ajusta el redondeo). Cada una se genera aprobada y una sola vez por mes.</p>
        <div class="ec-kpis">${kpi('Del mes', items.length)}${kpi('Generadas', items.length - pend.length, 'ec-fin')}${kpi('Pendientes', pend.length, pend.length ? 'ec-alerta' : '')}${kpi('Monto pendiente', q(sum(pend.map((x) => x.monto))))}</div>
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr><th></th><th>Origen</th><th>Descripción</th><th>Tipo</th><th>Cuota</th><th class="num">Monto Q</th><th>Estado</th><th>Partida</th></tr></thead><tbody>
        ${items.map((x, i) => `<tr><td>${x.g ? '' : `<input type="checkbox" data-sel="${i}" checked>`}</td><td>${x.origen === 'RECURRENTE' ? 'Recurrente' : 'Diferido'}</td><td>${esc(x.nombre)}</td><td>${x.tipo}</td><td>${x.cuota}</td><td class="num">${fmt.monto(x.monto)}</td><td>${marca(x.g ? 'GENERADA' : 'PENDIENTE')}</td><td>${x.g ? `${x.tipo}-${x.g.partidas.numero}` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="tk-vacio">No hay plantillas ni diferidos para este mes (Contabilidad › Registros).</td></tr>'}</tbody></table></div></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); const n = e.target.name; if (n === 'anio' || n === 'mes') { f[n] = Number(e.target.value) || f[n]; cargar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp);
      if (!e.target.closest('[data-accion="generar"]')) return;
      const sel = [...cont.querySelectorAll('[data-sel]:checked')].map((x) => items[Number(x.dataset.sel)]);
      if (!sel.length) return window.FIN.aviso('No hay partidas pendientes seleccionadas');
      if (!confirm(`¿Generar ${sel.length} partida(s) de ${MES[f.mes - 1]} ${f.anio}?`)) return;
      let ok = 0; const errores = [];
      for (const x of sel) {
        const { error } = await sb.rpc('con_generar_partida', { p_loc: ctx.sel.loc, p_anio: f.anio, p_mes: f.mes, p_tipo: x.tipo, p_descripcion: x.desc, p_lineas: x.lineas, p_origen: x.origen, p_ref: x.id, p_monto: x.monto });
        if (error) errores.push(`${x.nombre}: ${errorTxt(error)}`); else ok++;
      }
      window.FIN.aviso(errores.length ? `${ok} generada(s). ${errores.join(' · ')}` : `${ok} partida(s) generada(s) y aprobada(s)`); cargar();
    });
    iniciar();
  };

  // ===================== Diferencial cambiario =====================
  window.PANTALLAS['con-diferencial'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Diferencial cambiario', icono: 'ti-currency-dollar', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Contabilidad · Procesos' });
    const { sb } = ctx;
    const f = hoyAM(); let filas = [], tc = {}, K = null, cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-currency-dollar'); return; }
      const fecha = finMes(f.anio, f.mes) > fmt.hoy() ? fmt.hoy() : finMes(f.anio, f.mes);
      ctx.pDet.innerHTML = '<p class="vacio">Revaluando las cuentas en moneda extranjera…</p>';
      try {
        K = await cuentasClave(ctx);
        const { data: cbs } = await sb.from('cuentas_bancarias').select('id, numero, nombre, moneda_id, cuenta_id, cuentas(codigo, nombre)').eq('localidad_id', ctx.sel.loc).not('cuenta_id', 'is', null);
        const ext = (cbs || []).filter((c) => ctx.moneda(c.moneda_id)?.iso && ctx.moneda(c.moneda_id).iso !== 'GTQ');
        for (const m of [...new Set(ext.map((c) => c.moneda_id))]) {
          if (tc[m]) continue;
          const { data: t } = await sb.from('tipos_cambio').select('valor_compra, valor_venta, fecha').eq('moneda_id', m).lte('fecha', fecha).order('fecha', { ascending: false }).limit(1);
          tc[m] = num(t?.[0]?.valor_compra || t?.[0]?.valor_venta) || num(ctx.moneda(m)?.cambio) || 1;
        }
        const base = ext.length ? await leer(ctx, { locs: [ctx.sel.loc], hasta: fecha }) : null;
        filas = [];
        for (const c of ext) {
          const { data: s } = await sb.rpc('saldo_cuenta_bancaria', { p_cuenta: c.id, p_hasta: fecha });
          const me = num(s), cod = c.cuentas?.codigo, cont2 = sum(base.lineas.filter((l) => l.c && l.c.codigo === cod).map((l) => num(l.debe) - num(l.haber)));
          filas.push({ c, me, cod, cont: r2(cont2) });
        }
        ctx.filtros(`${filtroPeriodo(f)}${[...new Set(filas.map((x) => x.c.moneda_id))].map((m) => `<label class="campo"><span>Tipo de cambio ${esc(ctx.moneda(m)?.iso || '')}</span><input type="number" step="0.00001" name="tc-${m}" value="${tc[m]}"></label>`).join('')}`,
          `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="generar"><i class="ti ti-player-play" aria-hidden="true"></i> Generar partida PDC</button>' : ''}${botonesExp}`);
        pintar(fecha);
      } catch (e) { falta(ctx, e); }
    }
    const calc = (x) => { const rev = r2(x.me * (tc[x.c.moneda_id] || 1)); return { rev, dif: r2(rev - x.cont) }; };
    function pintar(fecha) {
      const ing = K.cuenta('DIF_CAMBIARIO_INGRESO'), gas = K.cuenta('DIF_CAMBIARIO_GASTO');
      const total = sum(filas.map((x) => calc(x).dif));
      cfg = { titulo: 'Diferencial cambiario', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Diferencial', archivo: `diferencial_${f.anio}_${f.mes}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `Al ${fmt.fechaDia(fecha)}`, ...[...new Set(filas.map((x) => x.c.moneda_id))].map((m) => `TC ${ctx.moneda(m)?.iso}: ${tc[m]}`)],
        columnas: [col('Cuenta bancaria', 'texto', 30), col('Moneda', 'texto', 7), col('Saldo en moneda', 'monto', 15), col('Tipo de cambio', 'numero', 11), col('Saldo revaluado Q', 'monto', 16), col('Cuenta contable', 'texto', 13), col('Saldo contable Q', 'monto', 16), col('Diferencial Q', 'monto', 15)],
        filas: [...filas.map((x) => { const r = calc(x); return { valores: [`${x.c.numero} · ${x.c.nombre}`, ctx.moneda(x.c.moneda_id)?.iso || '', r2(x.me), tc[x.c.moneda_id], r.rev, x.cod, x.cont, r.dif], resaltar: Math.abs(r.dif) >= 0.01 }; }),
          { valores: ['Total diferencial', '', '', '', '', '', '', r2(total)], tipo: 'total' }], vacio: 'La empresa no tiene cuentas bancarias en moneda extranjera con cuenta contable.' };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Revalúa al tipo de cambio de cierre el saldo de cada cuenta bancaria en moneda extranjera y lo compara con su saldo contable en quetzales. La diferencia se registra en una partida PDC contra el diferencial cambiario (cuentas de integración): ganancia <b>${esc(ing || 'sin configurar')}</b>, pérdida <b>${esc(gas || 'sin configurar')}</b>.</p>
        <div class="ec-kpis">${kpi('Cuentas', filas.length)}${kpi('Ganancia', q(sum(filas.map((x) => Math.max(0, calc(x).dif)))), 'ec-fin')}${kpi('Pérdida', q(sum(filas.map((x) => Math.max(0, -calc(x).dif)))))}${kpi('Neto', q(total), total < 0 ? 'ec-alerta' : 'ec-fin')}</div>${tabla(cfg, false)}</div>`;
      cfg.fecha = fecha;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => {
      const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar();
      const n = e.target.name; if (n === 'anio' || n === 'mes') { f[n] = Number(e.target.value) || f[n]; return cargar(); }
      if (n?.startsWith('tc-')) { tc[Number(n.slice(3))] = num(e.target.value) || 1; pintar(cfg.fecha); }
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp, false);
      if (!e.target.closest('[data-accion="generar"]')) return;
      const ing = K.cuenta('DIF_CAMBIARIO_INGRESO'), gas = K.cuenta('DIF_CAMBIARIO_GASTO');
      const xs = filas.map((x) => ({ x, d: calc(x).dif })).filter((y) => Math.abs(y.d) >= 0.01);
      if (!xs.length) return window.FIN.aviso('No hay diferencial que registrar');
      if (!ing || !gas) return window.FIN.aviso('Configura las cuentas de diferencial cambiario en Catálogos › Cuentas de integración');
      const lineas = [];
      xs.forEach(({ x, d }) => { lineas.push({ cuenta: x.cod, concepto: `Diferencial ${x.c.numero} TC ${tc[x.c.moneda_id]}`, debe: Math.max(0, d), haber: Math.max(0, -d) }); });
      const gan = sum(xs.filter((y) => y.d > 0).map((y) => y.d)), per = sum(xs.filter((y) => y.d < 0).map((y) => -y.d));
      if (gan) lineas.push({ cuenta: ing, concepto: 'Ganancia cambiaria', debe: 0, haber: r2(gan) });
      if (per) lineas.push({ cuenta: gas, concepto: 'Pérdida cambiaria', debe: r2(per), haber: 0 });
      if (!confirm(`¿Generar la partida de diferencial cambiario de ${MES[f.mes - 1]} ${f.anio} por Q ${fmt.monto(gan - per)} neto?`)) return;
      const { data, error } = await sb.rpc('con_generar_partida', { p_loc: ctx.sel.loc, p_anio: f.anio, p_mes: f.mes, p_tipo: 'PDC', p_descripcion: `Diferencial cambiario al ${fmt.fechaDia(cfg.fecha)}`, p_lineas: lineas, p_origen: 'DIFERENCIAL', p_ref: 0, p_monto: r2(gan + per) });
      if (error) return window.FIN.aviso(errorTxt(error));
      window.FIN.aviso(`Partida PDC-${data.numero} generada y aprobada`); cargar();
    });
    iniciar();
  };

  // ===================== Reversión de provisiones =====================
  window.PANTALLAS['con-reversion'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Reversión de provisiones', icono: 'ti-arrow-back-up', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Contabilidad · Procesos' });
    const { sb } = ctx;
    const h = hoyAM(); const f = h.mes === 1 ? { anio: h.anio - 1, mes: 12 } : { anio: h.anio, mes: h.mes - 1 };
    let ps = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-arrow-back-up'); return; }
      ctx.filtros(filtroPeriodo(f), `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="revertir"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Revertir seleccionadas</button>' : ''}${botonesExp}`);
      try {
        const [p, g] = await Promise.all([sb.from('partidas').select('id, numero, mes, anio, descripcion, total_debe, tipos_partida!inner(siglas), partida_lineas(linea, debe, haber, concepto, cuentas(codigo))').eq('localidad_id', ctx.sel.loc).eq('anio', f.anio).eq('mes', f.mes).eq('estado', 'VIGENTE').in('tipos_partida.siglas', ['PPR', 'PEV']).order('numero'),
          sb.from('partidas_generadas').select('referencia_id, partidas!inner(estado, numero, mes, anio)').eq('localidad_id', ctx.sel.loc).eq('origen', 'REVERSIÓN').eq('partidas.estado', 'VIGENTE')]);
        if (g.error) throw g.error;
        ps = (p.data || []).map((x) => ({ ...x, rev: (g.data || []).find((y) => y.referencia_id === x.id) }));
      } catch (e) { return falta(ctx, e); }
      const sigM = f.mes === 12 ? { a: f.anio + 1, m: 1 } : { a: f.anio, m: f.mes + 1 };
      cfg = { titulo: 'Reversión de provisiones', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Reversiones', archivo: `reversiones_${f.anio}_${f.mes}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `Provisiones de ${MES[f.mes - 1]} ${f.anio}`, `Se revierten en ${MES[sigM.m - 1]} ${sigM.a}`],
        columnas: [col('Partida', 'texto', 14), col('Descripción', 'texto', 50), col('Monto Q', 'monto', 15), col('Estado', 'texto', 12), col('Reversión', 'texto', 16)],
        filas: ps.map((x) => ({ valores: [`${x.tipos_partida.siglas}-${x.numero}`, x.descripcion, r2(x.total_debe), x.rev ? '¤REVERTIDA' : '¤PENDIENTE', x.rev ? `PRV-${x.rev.partidas.numero}/${String(x.rev.partidas.mes).padStart(2, '0')}-${x.rev.partidas.anio}` : ''] })), vacio: 'No hay partidas de provisión (PPR) ni de estimación (PEV) en el mes.' };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Las provisiones y estimaciones del mes (PPR y PEV) se revierten el primer día del mes siguiente con una partida PRV de signo contrario, para registrar después el gasto real sin duplicarlo.</p>
        <div class="ec-kpis">${kpi('Provisiones', ps.length)}${kpi('Revertidas', ps.filter((x) => x.rev).length, 'ec-fin')}${kpi('Pendientes', ps.filter((x) => !x.rev).length)}${kpi('Monto pendiente', q(sum(ps.filter((x) => !x.rev).map((x) => x.total_debe))))}</div>
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr><th></th>${cfg.columnas.map((c) => `<th class="${c.tipo === 'texto' ? '' : 'num'}">${c.titulo}</th>`).join('')}</tr></thead><tbody>
        ${ps.map((x, i) => `<tr><td>${x.rev ? '' : `<input type="checkbox" data-sel="${i}" checked>`}</td><td>${x.tipos_partida.siglas}-${x.numero}</td><td>${esc(x.descripcion)}</td><td class="num">${fmt.monto(x.total_debe)}</td><td>${marca(x.rev ? 'REVERTIDA' : 'PENDIENTE')}</td><td>${esc(cfg.filas[i].valores[4])}</td></tr>`).join('') || `<tr><td colspan="6" class="tk-vacio">${cfg.vacio}</td></tr>`}</tbody></table></div></div>`;
      cfg.sig = sigM;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); const n = e.target.name; if (n === 'anio' || n === 'mes') { f[n] = Number(e.target.value) || f[n]; cargar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp);
      if (!e.target.closest('[data-accion="revertir"]')) return;
      const sel = [...cont.querySelectorAll('[data-sel]:checked')].map((x) => ps[Number(x.dataset.sel)]);
      if (!sel.length) return window.FIN.aviso('No hay provisiones pendientes seleccionadas');
      if (!confirm(`¿Revertir ${sel.length} partida(s) en ${MES[cfg.sig.m - 1]} ${cfg.sig.a}?`)) return;
      let ok = 0; const err = [];
      for (const x of sel) {
        const lineas = (x.partida_lineas || []).sort((a, b) => a.linea - b.linea).map((l) => ({ cuenta: l.cuentas?.codigo, concepto: `Reversión: ${l.concepto || x.descripcion}`, debe: num(l.haber), haber: num(l.debe) }));
        const { error } = await sb.rpc('con_generar_partida', { p_loc: ctx.sel.loc, p_anio: cfg.sig.a, p_mes: cfg.sig.m, p_tipo: 'PRV', p_descripcion: `Reversión de ${x.tipos_partida.siglas}-${x.numero}/${String(x.mes).padStart(2, '0')}-${x.anio}: ${x.descripcion}`, p_lineas: lineas, p_origen: 'REVERSIÓN', p_ref: x.id, p_monto: x.total_debe });
        if (error) err.push(`${x.numero}: ${errorTxt(error)}`); else ok++;
      }
      window.FIN.aviso(err.length ? `${ok} revertida(s). ${err.join(' · ')}` : `${ok} partida(s) de reversión generada(s)`); cargar();
    });
    iniciar();
  };

  // ===================== Cierre del ejercicio =====================
  window.PANTALLAS['con-cierre-anual'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Cierre del ejercicio', icono: 'ti-lock-check', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Contabilidad · Procesos' });
    const { sb } = ctx;
    const f = { anio: hoyAM().anio - 1, reserva: true, pce: true };
    let D = null, cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-lock-check'); return; }
      ctx.filtros(`${filtroPeriodo(f, false)}<label class="pc-check"><input type="checkbox" name="reserva" ${f.reserva ? 'checked' : ''}> Reserva legal 5 %</label><label class="pc-check"><input type="checkbox" name="pce" ${f.pce ? 'checked' : ''}> Partidas de cierre (PCE) y apertura (PA)</label>`, botonesExp);
      ctx.pDet.innerHTML = '<p class="vacio">Preparando el cierre del ejercicio…</p>';
      try { D = await preparar(); pintar(); } catch (e) { falta(ctx, e); }
    }
    async function preparar() {
      const loc = ctx.sel.loc, a = f.anio;
      const [ej, cm, ps, K] = await Promise.all([sb.from('ejercicios_contables').select('*').eq('localidad_id', loc).in('anio', [a - 1, a]), sb.from('cierres_mes').select('anio, mes, cerrado').eq('localidad_id', loc).eq('anio', a),
        leerTodo(() => sb.from('partidas').select('id, mes, numero, aprobada, total_debe, total_haber, cierre_ejercicio, descripcion, tipo_partida_id, estado').eq('localidad_id', loc).eq('anio', a).order('id')), cuentasClave(ctx)]);
      if (ej.error) throw ej.error;
      const e = (ej.data || []).find((x) => x.anio === a), ant = (ej.data || []).find((x) => x.anio === a - 1);
      const base = await leer(ctx, { locs: [loc], hasta: `${a}-12-31`, memoria: true });
      const delAnio = base.lineas.filter((l) => l.p.anio === a);
      const eco = sum(delAnio.filter((l) => l.c && base.porCodigo.get(l.c.codigo)?.reporte === 'E' && l.siglas !== 'PCR' && !l.p.cierre_ejercicio).map((l) => num(l.haber) - num(l.debe)));
      const resto = new Map(); delAnio.filter((l) => l.c && base.porCodigo.get(l.c.codigo)?.reporte === 'E' && !['PCE', 'PA'].includes(l.p.cierre_ejercicio)).forEach((l) => resto.set(l.c.codigo, (resto.get(l.c.codigo) || 0) + num(l.debe) - num(l.haber)));
      const pcr = [...resto.entries()].filter(([, b]) => Math.abs(b) >= 0.01).sort((x, y) => x[0].localeCompare(y[0]));
      const res = K.cuenta('RESULTADO_EJERCICIO');
      const saldoRes = sum(base.lineas.filter((l) => l.c && l.c.codigo === res && l.p.anio <= a && !['PCE', 'PA'].includes(l.p.cierre_ejercicio)).map((l) => num(l.haber) - num(l.debe)));
      const vig = ps.filter((p) => p.estado === 'VIGENTE');
      const meses = Array.from({ length: 12 }, (_, i) => ({ m: i + 1, n: vig.filter((p) => p.mes === i + 1).length, cerrado: e?.estado === 'CERRADO' || (cm.data || []).some((x) => x.mes === i + 1 && x.cerrado) }));
      const dic = vig.filter((p) => p.mes === 12);
      return { e, ant, K, eco, pcr, saldoRes, meses, dic, base, cierre: vig.filter((p) => p.cierre_ejercicio), tp: base.tiposPart };
    }
    function pintar() {
      const { e, ant, K, eco, pcr, saldoRes, meses, dic } = D, a = f.anio, cerrado = e?.estado === 'CERRADO';
      const Rtot = r2(saldoRes - sum(pcr.map(([, b]) => b)));
      const reserva = f.reserva && Rtot > 0 ? r2(Math.min(Rtot, Math.max(eco, 0)) * 0.05) : 0;
      const abiertos = meses.filter((x) => x.m < 12 && x.n && !x.cerrado), sinAp = dic.filter((p) => !p.aprobada).length, desc = dic.filter((p) => num(p.total_debe) !== num(p.total_haber)).length;
      const ctas = CLAVES_CIERRE.map(([k, t]) => ({ k, t, cod: K.cuenta(k) }));
      const faltan = ctas.filter((c) => !c.cod && (c.k !== 'RESERVA_LEGAL' || f.reserva) && c.k !== 'PERDIDAS_ACUMULADAS');
      const req = [
        ['Meses de enero a noviembre cerrados', abiertos.length ? 'ALERTA' : 'OK', abiertos.length ? `Abiertos: ${abiertos.map((x) => MES[x.m - 1]).join(', ')}` : 'Cerrados'],
        ['Diciembre sin partidas por aprobar ni descuadradas', sinAp || desc ? 'ALERTA' : 'OK', sinAp || desc ? `${sinAp} sin aprobar · ${desc} descuadradas` : `${dic.length} partidas en orden`],
        ['Cuentas de cierre configuradas', faltan.length ? 'ALERTA' : 'OK', faltan.length ? `Faltan: ${faltan.map((c) => c.t).join(', ')}` : ctas.filter((c) => c.cod).map((c) => `${c.t}: ${c.cod}`).join(' · ')],
        [`Ejercicio ${a - 1}`, ant?.estado === 'CERRADO' ? 'OK' : 'INFORMATIVO', ant?.estado === 'CERRADO' ? 'Cerrado' : 'No se ha cerrado con este proceso (puede tener cierre migrado)']
      ];
      const listo = !cerrado && req.every((r) => r[1] !== 'ALERTA');
      const filas = [];
      filas.push({ valores: ['Requisitos del cierre'], tipo: 'grupo', combinar: true });
      req.forEach((r) => filas.push({ valores: [r[0], '', `¤${r[1]}`, r[2]], resaltar: r[1] === 'ALERTA' }));
      filas.push({ valores: [`1. Cierre de resultados (PCR) al 31/12/${a}`], tipo: 'grupo', combinar: true });
      if (pcr.length) pcr.forEach(([cod, b]) => filas.push({ valores: [cod, D.base.porCodigo.get(cod)?.nombre || '', b < 0 ? r2(-b) : '', b > 0 ? r2(b) : ''] }));
      else filas.push({ valores: ['Las cuentas de resultados del año ya están saldadas (cierre registrado antes).', '', '', ''], tipo: 'nota' });
      const neto = sum(pcr.map(([, b]) => b));
      if (pcr.length) filas.push({ valores: [K.cuenta('RESULTADO_EJERCICIO'), 'Resultado del ejercicio', neto > 0 ? r2(neto) : '', neto < 0 ? r2(-neto) : ''], tipo: 'subtotal' });
      filas.push({ valores: ['2. Reserva legal y traslado del resultado'], tipo: 'grupo', combinar: true });
      if (Rtot >= 0.01) {
        filas.push({ valores: [K.cuenta('RESULTADO_EJERCICIO'), 'Resultado del ejercicio', r2(Rtot), ''] });
        if (reserva) filas.push({ valores: [K.cuenta('RESERVA_LEGAL') || '—', 'Reserva legal 5 %', '', reserva] });
        filas.push({ valores: [K.cuenta('UTILIDADES_ACUMULADAS') || '—', 'Utilidades acumuladas', '', r2(Rtot - reserva)] });
      } else if (Rtot <= -0.01) {
        filas.push({ valores: [K.cuenta('PERDIDAS_ACUMULADAS') || K.cuenta('UTILIDADES_ACUMULADAS'), 'Pérdidas acumuladas', r2(-Rtot), ''] });
        filas.push({ valores: [K.cuenta('RESULTADO_EJERCICIO'), 'Resultado del ejercicio', '', r2(-Rtot)] });
      } else filas.push({ valores: ['El resultado del ejercicio no tiene saldo que trasladar.', '', '', ''], tipo: 'nota' });
      filas.push({ valores: [`3. Cierre del ejercicio (PCE) y apertura ${a + 1} (PA)`], tipo: 'grupo', combinar: true });
      filas.push({ valores: [f.pce ? `Se salda cada cuenta de balance al 31/12/${a} y se reabre con el mismo saldo el 01/01/${a + 1}. Son partidas de registro: se ven en el libro diario y no alteran los saldos.` : 'No se generan (opción desmarcada).', '', '', ''], tipo: 'nota' });
      if (cerrado) {
        filas.push({ valores: ['Partidas del cierre registradas'], tipo: 'grupo', combinar: true });
        D.cierre.forEach((p) => filas.push({ valores: [`${D.tp.get(p.tipo_partida_id)?.siglas || ''}-${p.numero}`, p.descripcion, r2(p.total_debe), r2(p.total_haber)] }));
      }
      cfg = { titulo: `Cierre del ejercicio ${a}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: `Cierre ${a}`, archivo: `cierre_ejercicio_${a}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `Ejercicio del 01/01/${a} al 31/12/${a}`, `Estado: ${cerrado ? 'CERRADO' : 'ABIERTO'}`, `Resultado del ejercicio: Q ${fmt.monto(eco)}`],
        columnas: [col('Cuenta / requisito', 'texto', 30), col('Nombre', 'texto', 40), col('Debe / estado', 'monto', 16), col('Haber / detalle', 'monto', 30)], filas, firmas: ['Contador general', 'Representante legal'] };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="cl-banda">Ejercicio ${a} · ${esc(empresaDe(ctx))} · ${marca(cerrado ? 'CERRADO' : 'ABIERTO')}</div>
        <div class="ec-kpis">${kpi(`Resultado ${a}`, q(eco), eco >= 0 ? 'ec-fin' : 'ec-alerta')}${kpi('Reserva legal', q(reserva))}${kpi('A trasladar', q(Rtot - (Rtot > 0 ? reserva : 0)))}${kpi('Meses cerrados', `${meses.filter((x) => x.cerrado).length} de 12`)}</div>
        <div class="cr-meses">${meses.map((x) => `<span class="pc-marca ${x.cerrado ? 'aprobada' : x.n ? 'pendiente' : ''}" title="${x.n} partidas">${MES[x.m - 1].slice(0, 3)}${x.cerrado ? ' ✓' : ''}</span>`).join(' ')}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> El cierre registra el 31 de diciembre la partida de cierre de resultados, la reserva legal y el traslado a utilidades o pérdidas acumuladas, y la partida de cierre y la de apertura del año siguiente. Luego cierra diciembre y el ejercicio completo. Solo el Super Administrador puede reabrirlo, con motivo, y eso anula esas partidas.</p>
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr><th>Cuenta / requisito</th><th>Nombre</th><th class="num">Debe</th><th class="num">Haber</th></tr></thead><tbody>
        ${filas.map((r) => (r.tipo === 'grupo' ? `<tr class="pr-g"><td colspan="4">${esc(r.valores[0])}</td></tr>` : r.tipo === 'nota' ? `<tr class="pr-n"><td colspan="4">${esc(r.valores[0])}</td></tr>` : String(r.valores[2]).startsWith('¤') ? `<tr class="${r.resaltar ? 'pr-alerta' : ''}"><td colspan="2">${esc(r.valores[0])}</td><td>${marca(r.valores[2].slice(1))}</td><td>${esc(r.valores[3])}</td></tr>`
          : `<tr class="${r.tipo === 'subtotal' ? 'pr-s' : ''}"><td>${esc(String(r.valores[0]))}</td><td>${esc(String(r.valores[1]))}</td><td class="num">${r.valores[2] === '' ? '' : fmt.monto(r.valores[2])}</td><td class="num">${r.valores[3] === '' ? '' : fmt.monto(r.valores[3])}</td></tr>`)).join('')}</tbody></table></div>
        <p class="acciones-form">${cerrado ? (window.FIN.esSuperAdmin() ? `<button type="button" class="boton secundario-sm rp-peligro" data-accion="reabrir"><i class="ti ti-lock-open" aria-hidden="true"></i> Reabrir el ejercicio ${a}</button>` : `<span class="pr-guia">Cerrado por ${esc(e.cerrado_por || '')} el ${fmt.fechaDia(String(e.cerrado_en).slice(0, 10))}.</span>`)
          : ctx.admin ? `<button type="button" class="boton primario" data-accion="cerrar" ${listo ? '' : 'title="Resuelve los requisitos marcados en rojo"'}><i class="ti ti-lock" aria-hidden="true"></i> Cerrar el ejercicio ${a}</button>` : ''}</p></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => {
      const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar();
      const n = e.target.name; if (n === 'anio') { f.anio = Number(e.target.value) || f.anio; return cargar(); }
      if (n === 'reserva' || n === 'pce') { f[n] = e.target.checked; pintar(); }
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp, false);
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'cerrar') {
        if (!confirm(`¿Cerrar el ejercicio ${f.anio}? Se registran las partidas de cierre${f.pce ? ' y la apertura de ' + (f.anio + 1) : ''}, y los doce meses quedan cerrados.`)) return;
        const { data, error } = await sb.rpc('con_cierre_anual', { p_loc: ctx.sel.loc, p_anio: f.anio, p_accion: 'CERRAR', p_opciones: { reserva: f.reserva, pce: f.pce } });
        if (error) return window.FIN.aviso(errorTxt(error));
        window.FIN.aviso(`Ejercicio ${f.anio} cerrado · resultado Q ${fmt.monto(data.resultado)} · reserva Q ${fmt.monto(data.reserva)}`); cargar();
      }
      if (a === 'reabrir') {
        const motivo = prompt(`Motivo de la reapertura del ejercicio ${f.anio}:`); if (!motivo || !motivo.trim()) return;
        const { error } = await sb.rpc('con_cierre_anual', { p_loc: ctx.sel.loc, p_anio: f.anio, p_accion: 'REABRIR', p_opciones: {}, p_motivo: motivo.trim() });
        if (error) return window.FIN.aviso(errorTxt(error));
        window.FIN.aviso(`Ejercicio ${f.anio} reabierto: sus partidas de cierre quedaron anuladas`); cargar();
      }
    });
    iniciar();
  };
})();
