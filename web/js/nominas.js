// Nóminas (Guatemala, script 155). Cálculo de la planilla:
//   Salario ordinario proporcional a los días laborados (ausencias y suspensiones IGSS rebajan días).
//   Horas extra: valor hora = salario ÷ 30 ÷ horas de la jornada (diurna 8, mixta 7, nocturna 6) × 1.5 (Código de Trabajo art. 121).
//   Bonificación incentivo (Decreto 37-2001): no afecta IGSS ni prestaciones.
//   IGSS laboral 4.83 % y patronal 12.67 % (IGSS 10.67 + INTECAP 1 + IRTRA 1) sobre lo afecto.
//   ISR asalariados: renta anual proyectada − deducción personal (Q 48,000) − IGSS; 5 % hasta Q 300,000 y 7 % el excedente; retención mensual.
//   Bono 14 (1 julio – 30 junio) y aguinaldo (1 diciembre – 30 noviembre): un salario proporcional a los días; exentos.
//   Liquidación: salario pendiente, indemnización (despido injustificado: salario + 1/6 + 1/6 por año), aguinaldo, Bono 14 y vacaciones proporcionales.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const M3 = MES.map((m) => m.slice(0, 3));
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const q = (n) => `Q ${fmt.monto(n)}`;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const G = () => window.GRAFICAS;
  const empresaDe = (ctx) => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
  const faltaScript = (ctx, e) => { ctx.pDet.innerHTML = `<p class="vacio">${/nom_/.test(e?.message || '') ? 'Falta instalar el script 155 (Nóminas) en Supabase.' : esc(window.UI.traducirError(e))}</p>`; };
  const nombre = (e) => (e ? `${e.nombres} ${e.apellidos}` : '');
  const dias = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5) + 1;
  const maxF = (a, b) => (a > b ? a : b), minF = (a, b) => (a < b ? a : b);
  const ESTADO_CLS = { CALCULADA: 'pendiente', APROBADA: 'editando', PAGADA: 'aprobada', ANULADA: 'anulada', ACTIVO: 'aprobada', BAJA: 'anulada', SUSPENDIDO: 'pendiente', PAGADO: 'aprobada', ANULADO: 'anulada' };
  const marca = (e) => `<span class="pc-marca ${ESTADO_CLS[e] || ''}">${esc(e)}</span>`;
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
      <tbody>${c.filas.length ? c.filas.map((r) => (r.tipo === 'grupo' && r.combinar ? `<tr class="pr-g"><td colspan="${n}">${esc(r.valores[0])}</td></tr>` : `<tr class="${r.tipo === 'subtotal' ? 'pr-s' : r.tipo === 'total' ? 'pr-t' : ''}${r.resaltar === true ? ' pr-alerta' : ''}" ${r.attr || ''}>${c.columnas.map((x, i) => celda(r.valores[i], x)).join('')}</tr>`)).join('') : `<tr><td colspan="${n}" class="tk-vacio">${esc(c.vacio || 'Sin información con esos parámetros.')}</td></tr>`}</tbody></table>
      ${gs.length && c.filas.length ? `<section class="pr-graficas"><h3><i class="ti ti-chart-bar" aria-hidden="true"></i> Gráficas</h3>${gs.join('')}</section>` : ''}</div>`;
  }
  function exportar(c, formato, graficas = true) {
    if (!c || !c.filas.length) return window.FIN.aviso('No hay información con esos parámetros');
    const gs = graficas ? (c.graficas || []).filter(Boolean) : [];
    const s = { ...c, filas: c.filas.map((r) => ({ ...r, resaltar: r.resaltar === true ? 1 : undefined, valores: r.valores.map((v) => (typeof v === 'string' && v.startsWith('¤') ? v.slice(1) : v)) })) };
    if (formato === 'PDF') return window.CUENTAS_XLSX.pdf({ ...s, graficas: gs.join('') });
    Promise.all(gs.map((g) => G().png(g))).then((imagenes) => window.REPORTE_XLSX.generar({ ...s, imagenes })).catch((e) => window.FIN.aviso(e.message || 'No se pudo generar el Excel'));
  }

  // ---------- Motor de cálculo ----------
  const HORAS = { DIURNA: 8, MIXTA: 7, NOCTURNA: 6 };
  function isrPeriodo(par, afectoIsr, igss, factor) {
    const anual = (afectoIsr / factor) * 12, igssA = (igss / factor) * 12;
    const imp = Math.max(0, anual - num(par.isr_deduccion_personal) - igssA), lim = num(par.isr_limite_tramo);
    const impuesto = imp <= lim ? imp * num(par.isr_tasa_1) / 100 : lim * num(par.isr_tasa_1) / 100 + (imp - lim) * num(par.isr_tasa_2) / 100;
    return (impuesto / 12) * factor;
  }
  function calcularOrdinaria(e, par, novs, prest, conceptos, anio, mes, quincena) {
    const factor = quincena ? 0.5 : 1, perDias = quincena ? 15 : 30;
    const ini = quincena === 2 ? `${anio}-${String(mes).padStart(2, '0')}-16` : `${anio}-${String(mes).padStart(2, '0')}-01`;
    const fin = quincena === 1 ? `${anio}-${String(mes).padStart(2, '0')}-15` : new Date(anio, mes, 0).toLocaleDateString('en-CA');
    if (e.fecha_ingreso > fin || (e.fecha_baja && e.fecha_baja < ini)) return null;
    let dLab = perDias;
    if (e.fecha_ingreso > ini) dLab = Math.min(perDias, dias(e.fecha_ingreso, fin));
    if (e.fecha_baja && e.fecha_baja < fin) dLab = Math.min(dLab, dias(maxF(ini, e.fecha_ingreso), e.fecha_baja));
    const mias = novs.filter((n) => n.empleado_id === e.id);
    const aus = sum(mias.filter((n) => n.clase === 'AUSENCIA' || n.clase === 'SUSPENSIÓN IGSS').map((n) => n.cantidad));
    dLab = Math.max(0, dLab - aus);
    const base = num(e.salario_base);
    const salario = base * factor * dLab / perDias;
    const hx = sum(mias.filter((n) => n.clase === 'HORAS EXTRA').map((n) => n.cantidad));
    const extra = hx * (base / 30 / (HORAS[e.jornada] || 8)) * 1.5;
    const bono = num(e.bonificacion) * factor * dLab / perDias;
    const ingN = mias.filter((n) => n.clase === 'INGRESO'), desN = mias.filter((n) => n.clase === 'DESCUENTO');
    const con = (n) => conceptos.find((c) => c.id === n.concepto_id) || { afecto_igss: true, afecto_isr: true };
    const otros = sum(ingN.map((n) => n.monto));
    const afectoIgss = salario + extra + sum(ingN.filter((n) => con(n).afecto_igss).map((n) => n.monto));
    const afectoIsr = salario + extra + sum(ingN.filter((n) => con(n).afecto_isr).map((n) => n.monto));
    const igss = afectoIgss * num(par.igss_laboral) / 100, patronal = afectoIgss * num(par.igss_patronal) / 100;
    const isr = isrPeriodo(par, afectoIsr, igss, factor);
    const pres = sum(prest.filter((p) => p.empleado_id === e.id && p.estado === 'ACTIVO').map((p) => Math.min(num(p.cuota), num(p.saldo))));
    const otrosD = sum(desN.map((n) => n.monto));
    const ti = salario + extra + bono + otros, td = igss + isr + pres + otrosD;
    return { empleado_id: e.id, departamento_id: e.departamento_id, dias: r2(dLab), salario: r2(salario), horas_extra: r2(hx), monto_horas_extra: r2(extra), bonificacion: r2(bono), otros_ingresos: r2(otros), prestaciones: 0, total_ingresos: r2(ti), igss_laboral: r2(igss), isr: r2(isr), prestamos: r2(pres), otros_descuentos: r2(otrosD), total_descuentos: r2(td), liquido: r2(ti - td), igss_patronal: r2(patronal), detalle: { afecto_igss: r2(afectoIgss), afecto_isr: r2(afectoIsr), ausencias: aus } };
  }
  // Bono 14 y aguinaldo: un salario por año de servicio en el período legal, proporcional a los días.
  function calcularPrestacion(e, tipo, anio) {
    const [a, b] = tipo === 'BONO 14' ? [`${anio - 1}-07-01`, `${anio}-06-30`] : [`${anio - 1}-12-01`, `${anio}-11-30`];
    const desde = maxF(a, e.fecha_ingreso), hasta = minF(b, e.fecha_baja || b);
    if (desde > hasta) return null;
    const d = Math.min(365, dias(desde, hasta)), monto = num(e.salario_base) * d / 365;
    return { empleado_id: e.id, departamento_id: e.departamento_id, dias: d, salario: 0, horas_extra: 0, monto_horas_extra: 0, bonificacion: 0, otros_ingresos: 0, prestaciones: r2(monto), total_ingresos: r2(monto), igss_laboral: 0, isr: 0, prestamos: 0, otros_descuentos: 0, total_descuentos: 0, liquido: r2(monto), igss_patronal: 0, detalle: { periodo: `${a} al ${b}`, desde, hasta } };
  }
  function calcularLiquidacion(e, par, baja, motivo, gozadas, prest) {
    const base = num(e.salario_base), anios = dias(e.fecha_ingreso, baja) / 365;
    const iniMes = `${baja.slice(0, 7)}-01`, dMes = Math.min(30, dias(maxF(iniMes, e.fecha_ingreso), baja));
    const salario = base * dMes / 30, bono = num(e.bonificacion) * dMes / 30;
    const indem = motivo === 'DESPIDO INJUSTIFICADO' ? (base + base / 6 + base / 6) * anios : 0;
    const y = Number(baja.slice(0, 4)), m = Number(baja.slice(5, 7));
    const iniAg = m === 12 ? `${y}-12-01` : `${y - 1}-12-01`, iniB14 = m >= 7 ? `${y}-07-01` : `${y - 1}-07-01`;
    const aguin = base * Math.min(365, dias(maxF(iniAg, e.fecha_ingreso), baja)) / 365, b14 = base * Math.min(365, dias(maxF(iniB14, e.fecha_ingreso), baja)) / 365;
    const ganadas = 15 * anios, pend = Math.max(0, ganadas - gozadas), vac = (base / 30) * pend;
    const igss = salario * num(par.igss_laboral) / 100, patronal = salario * num(par.igss_patronal) / 100;
    const pres = sum(prest.filter((p) => p.empleado_id === e.id && p.estado === 'ACTIVO').map((p) => num(p.saldo)));
    const prestaciones = indem + aguin + b14 + vac, ti = salario + bono + prestaciones, td = igss + pres;
    return { linea: { empleado_id: e.id, departamento_id: e.departamento_id, dias: dMes, salario: r2(salario), horas_extra: 0, monto_horas_extra: 0, bonificacion: r2(bono), otros_ingresos: 0, prestaciones: r2(prestaciones), total_ingresos: r2(ti), igss_laboral: r2(igss), isr: 0, prestamos: r2(pres), otros_descuentos: 0, total_descuentos: r2(td), liquido: r2(ti - td), igss_patronal: r2(patronal),
      detalle: { motivo, baja, anios: r2(anios), indemnizacion: r2(indem), aguinaldo: r2(aguin), bono14: r2(b14), vacaciones_dias: r2(pend), vacaciones: r2(vac) } }, partes: [['Salario pendiente', salario, `${dMes} día(s) de ${MES[m - 1]}`], ['Bonificación incentivo pendiente', bono, ''], ['Indemnización', indem, motivo === 'DESPIDO INJUSTIFICADO' ? `${anios.toFixed(2)} año(s) × (salario + 1/6 aguinaldo + 1/6 Bono 14)` : 'No aplica por el motivo'], ['Aguinaldo proporcional', aguin, `desde ${fmt.fechaDia(maxF(iniAg, e.fecha_ingreso))}`], ['Bono 14 proporcional', b14, `desde ${fmt.fechaDia(maxF(iniB14, e.fecha_ingreso))}`], ['Vacaciones pendientes', vac, `${pend.toFixed(2)} día(s) (ganadas ${ganadas.toFixed(2)}, gozadas ${gozadas})`], ['(−) IGSS laboral sobre salario', -igss, ''], ['(−) Saldo de préstamos y anticipos', -pres, '']], liquido: r2(ti - td) };
  }

  // ---------- Base común: empleados, parámetros, conceptos ----------
  async function baseNomina(ctx) {
    const { sb } = ctx, loc = ctx.sel.loc;
    const [par, e, d, p, c] = await Promise.all([sb.from('nom_parametros').select('*').eq('localidad_id', loc).maybeSingle(), leerTodo(() => sb.from('nom_empleados').select('*').eq('localidad_id', loc).order('codigo')), sb.from('nom_departamentos').select('*').eq('localidad_id', loc).order('codigo'), sb.from('nom_puestos').select('*').eq('localidad_id', loc).order('codigo'), sb.from('nom_conceptos').select('*').eq('localidad_id', loc).order('codigo')]);
    if (par.error) throw par.error;
    let pr = par.data;
    if (!pr) { await sb.rpc('nom_asegurar_catalogos', { p_localidad: loc }); pr = (await sb.from('nom_parametros').select('*').eq('localidad_id', loc).maybeSingle()).data || {}; }
    return { par: pr, empleados: e, deptos: d.data || [], puestos: p.data || [], conceptos: c.data || [] };
  }
  const deptoTxt = (B, id) => { const d = B.deptos.find((x) => x.id === id); return d ? d.nombre : 'SIN DEPARTAMENTO'; };

  // ===================== Listas simples =====================
  function lista(cont, op) {
    const ctx = montar(cont, { titulo: op.titulo, icono: op.icono, clase: 'bk-movimientos bm-solo cx-rep pf-cat', grupo: 'Nóminas · Catálogos' });
    const { sb } = ctx;
    let filas = [], B = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', op.icono); return; }
      ctx.filtros('', `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>' : ''}${botonesExp}`);
      try { B = await baseNomina(ctx); } catch (e) { return faltaScript(ctx, e); }
      const { data } = await sb.from(op.tabla).select('*').eq('localidad_id', ctx.sel.loc).order('codigo');
      filas = data || []; pintar();
    }
    const opciones = (c) => (c.deptos ? [['', '—'], ...B.deptos.map((d) => [d.id, d.nombre])] : c.opciones.map((o) => [o, o]));
    function pintar() {
      const ed = ctx.admin;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> ${op.ayuda}</p><div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${op.campos.map((c) => `<th>${c.titulo}</th>`).join('')}<th></th></tr></thead>
        <tbody>${filas.map((f) => `<tr data-id="${f.id}">${op.campos.map((c) => `<td>${c.opciones || c.deptos ? `<select data-c="${c.k}" ${ed ? '' : 'disabled'}>${opciones(c).map(([v, t]) => `<option value="${v}" ${String(f[c.k] ?? '') === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : c.tipo === 'check' ? `<input type="checkbox" data-c="${c.k}" ${f[c.k] ? 'checked' : ''} ${ed ? '' : 'disabled'}>` : `<input data-c="${c.k}" value="${esc(String(f[c.k] ?? ''))}" ${c.tipo === 'numero' ? 'type="number" step="any"' : ''} ${ed ? '' : 'disabled'}>`}</td>`).join('')}<td>${ed ? '<button type="button" class="icono-boton rp-peligro" data-quitar title="Quitar"><i class="ti ti-trash" aria-hidden="true"></i></button>' : ''}</td></tr>`).join('') || `<tr><td colspan="${op.campos.length + 1}" class="tk-vacio">Sin registros.</td></tr>`}</tbody></table></div></div>`;
    }
    const cfg = () => ({ titulo: op.titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: op.titulo.slice(0, 30), archivo: op.tabla, parametros: [`Empresa: ${empresaDe(ctx)}`], columnas: op.campos.map((c) => col(c.titulo, 'texto', c.ancho || 18)), filas: filas.map((f) => ({ valores: op.campos.map((c) => (c.tipo === 'check' ? (f[c.k] ? 'Sí' : 'No') : c.deptos ? deptoTxt(B, f[c.k]) : String(f[c.k] ?? ''))) })) });
    cont.addEventListener('change', async (e) => {
      const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar();
      const tr = e.target.closest('tr[data-id]'); const k = e.target.dataset.c; if (!tr || !k) return;
      const c = op.campos.find((x) => x.k === k);
      const v = c.tipo === 'check' ? e.target.checked : c.tipo === 'numero' ? num(e.target.value) : c.deptos ? (Number(e.target.value) || null) : e.target.value.trim().toUpperCase();
      const { error } = await sb.from(op.tabla).update({ [k]: v }).eq('id', Number(tr.dataset.id));
      if (error) { window.FIN.aviso(window.UI.traducirError(error)); cargar(); }
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      if (e.target.closest('[data-accion="nuevo"]')) { const { error } = await sb.from(op.tabla).insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, ...op.nuevo(filas) }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); return cargar(); }
      if (e.target.closest('[data-quitar]')) { if (!confirm('¿Quitar el registro?')) return; const { error } = await sb.from(op.tabla).delete().eq('id', Number(e.target.closest('tr').dataset.id)); if (error) return window.FIN.aviso(/foreign|referen/i.test(error.message) ? 'Está en uso: márcalo inactivo' : window.UI.traducirError(error)); cargar(); }
    });
    iniciar();
  }
  const sigCod = (f) => Math.max(0, ...f.map((x) => Number(x.codigo) || 0)) + 1;
  window.PANTALLAS['nom-departamentos'] = (cont) => lista(cont, { titulo: 'Departamentos', icono: 'ti-sitemap', tabla: 'nom_departamentos', ayuda: 'Departamentos de la empresa: agrupan la planilla y el costo de personal.', campos: [{ k: 'codigo', titulo: 'Código', tipo: 'numero', ancho: 8 }, { k: 'nombre', titulo: 'Nombre', ancho: 40 }, { k: 'activo', titulo: 'Activo', tipo: 'check' }], nuevo: (f) => ({ codigo: sigCod(f), nombre: 'NUEVO DEPARTAMENTO' }) });
  window.PANTALLAS['nom-puestos'] = (cont) => lista(cont, { titulo: 'Puestos', icono: 'ti-briefcase', tabla: 'nom_puestos', ayuda: 'Puestos con su departamento y salario base de referencia (no menor al salario mínimo vigente).', campos: [{ k: 'codigo', titulo: 'Código', tipo: 'numero', ancho: 8 }, { k: 'nombre', titulo: 'Nombre', ancho: 36 }, { k: 'departamento_id', titulo: 'Departamento', deptos: true, ancho: 30 }, { k: 'salario_base', titulo: 'Salario base Q', tipo: 'numero', ancho: 14 }, { k: 'activo', titulo: 'Activo', tipo: 'check' }], nuevo: (f) => ({ codigo: sigCod(f), nombre: 'NUEVO PUESTO' }) });
  window.PANTALLAS['nom-conceptos'] = (cont) => lista(cont, { titulo: 'Conceptos de ingreso y descuento', icono: 'ti-list-details', tabla: 'nom_conceptos', ayuda: 'Ingresos (comisiones, bonos, viáticos) y descuentos (judiciales, seguros) que se registran como novedades. Indica si afectan IGSS, ISR y prestaciones.', campos: [{ k: 'codigo', titulo: 'Código', ancho: 8 }, { k: 'nombre', titulo: 'Nombre', ancho: 34 }, { k: 'tipo', titulo: 'Tipo', opciones: ['INGRESO', 'DESCUENTO'] }, { k: 'afecto_igss', titulo: 'Afecto IGSS', tipo: 'check' }, { k: 'afecto_isr', titulo: 'Afecto ISR', tipo: 'check' }, { k: 'afecto_prestaciones', titulo: 'Afecto prestaciones', tipo: 'check' }, { k: 'cuenta_codigo', titulo: 'Cuenta contable', ancho: 16 }, { k: 'activo', titulo: 'Activo', tipo: 'check' }], nuevo: (f) => ({ codigo: `C${f.length + 1}`, nombre: 'NUEVO CONCEPTO', tipo: 'INGRESO' }) });

  // ===================== Parámetros =====================
  window.PANTALLAS['nom-parametros'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Parámetros de nómina', icono: 'ti-adjustments', clase: 'bk-movimientos bm-solo cx-rep', grupo: 'Nóminas · Catálogos' });
    const { sb } = ctx;
    let B = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() { if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-adjustments'); return; } ctx.filtros('', ''); try { B = await baseNomina(ctx); } catch (e) { return faltaScript(ctx, e); } pintar(); }
    function pintar() {
      const p = B.par, dis = ctx.admin ? '' : 'disabled';
      const n = (k, t, step = '0.01') => `<label class="campo"><span>${t}</span><input type="number" step="${step}" name="${k}" value="${p[k] ?? ''}" ${dis}></label>`;
      const c = (k, t) => `<label class="campo"><span>${t}</span><input name="${k}" value="${esc(p[k] || '')}" list="nom-ctas" placeholder="Código de cuenta" ${dis}></label>`;
      ctx.pDet.innerHTML = `<form class="bm-form cx-form cl-clasico nom-par" novalidate><div class="cl-banda">Parámetros de nómina · ${esc(empresaDe(ctx))}</div>
        <div class="sat-g">${n('igss_laboral', 'IGSS laboral %', '0.001')}${n('igss_patronal', 'IGSS patronal % (IGSS + INTECAP + IRTRA)', '0.001')}${n('bonificacion_incentivo', 'Bonificación incentivo Q')}${n('salario_minimo', 'Salario mínimo mensual Q')}
          ${n('isr_deduccion_personal', 'ISR: deducción personal anual Q')}${n('isr_limite_tramo', 'ISR: límite del primer tramo Q')}${n('isr_tasa_1', 'ISR: tasa 1 %')}${n('isr_tasa_2', 'ISR: tasa 2 %')}
          <label class="campo"><span>Frecuencia de pago</span><select name="frecuencia" ${dis}>${['MENSUAL', 'QUINCENAL'].map((x) => `<option ${p.frecuencia === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
        <div class="cl-banda">Cuentas contables de la partida de planilla</div>
        <div class="sat-g">${c('cta_sueldos', 'Gasto sueldos y salarios')}${c('cta_bonificacion', 'Gasto bonificación incentivo')}${c('cta_bono14_aguinaldo', 'Gasto Bono 14, aguinaldo y vacaciones')}${c('cta_igss_patronal', 'Gasto cuota patronal')}
          ${c('cta_igss_por_pagar', 'IGSS por pagar')}${c('cta_isr_por_pagar', 'ISR asalariados por pagar')}${c('cta_prestamos', 'Préstamos y anticipos a empleados')}${c('cta_otros_descuentos', 'Otros descuentos por pagar')}${c('cta_sueldos_por_pagar', 'Sueldos por pagar')}</div>
        <datalist id="nom-ctas"></datalist>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Valores legales vigentes: IGSS laboral 4.83 %, patronal 10.67 % + INTECAP 1 % + IRTRA 1 % = 12.67 %, bonificación incentivo Q 250 (Decreto 37-2001), ISR asalariados 5 % hasta Q 300,000 de renta imponible y 7 % el excedente, deducción personal Q 48,000. Actualiza el salario mínimo cada año según el Acuerdo Gubernativo.</p>
        <p class="modal-error tk-error" role="alert"></p>${ctx.admin ? '<div class="pr-nueva-acc"><button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button></div>' : ''}</form>`;
      sb.from('catalogos_cuentas').select('id').eq('localidad_id', ctx.sel.loc).eq('activo', true).order('version', { ascending: false }).limit(1).then(async (r) => { if (!r.data?.[0]) return; const cs = await leerTodo(() => sb.from('cuentas').select('codigo, nombre').eq('catalogo_id', r.data[0].id).eq('integra', false).order('codigo')); const dl = ctx.pDet.querySelector('#nom-ctas'); if (dl) dl.innerHTML = cs.map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join(''); });
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') cargar(); });
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('.nom-par')) return; e.preventDefault();
      const el = e.target.elements, v = {};
      ['igss_laboral', 'igss_patronal', 'bonificacion_incentivo', 'salario_minimo', 'isr_deduccion_personal', 'isr_limite_tramo', 'isr_tasa_1', 'isr_tasa_2'].forEach((k) => { v[k] = num(el[k].value); });
      v.frecuencia = el.frecuencia.value;
      ['cta_sueldos', 'cta_bonificacion', 'cta_bono14_aguinaldo', 'cta_igss_patronal', 'cta_igss_por_pagar', 'cta_isr_por_pagar', 'cta_prestamos', 'cta_otros_descuentos', 'cta_sueldos_por_pagar'].forEach((k) => { v[k] = el[k].value.trim() || null; });
      const { error } = await sb.from('nom_parametros').update(v).eq('id', B.par.id);
      if (error) { e.target.querySelector('.modal-error').textContent = window.UI.traducirError(error); return; }
      window.FIN.aviso('Parámetros guardados'); cargar();
    });
    iniciar();
  };

  // ===================== Empleados =====================
  window.PANTALLAS['nom-empleados'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Empleados', icono: 'ti-users', clase: 'bk-movimientos bm-solo cx-rep nom-emp', grupo: 'Nóminas · Catálogos' });
    const { sb } = ctx;
    let B = null, actual = null, buscar = '', ver = 'ACTIVO';
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar(id = actual?.id) {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-users'); return; }
      try { B = await baseNomina(ctx); } catch (e) { return faltaScript(ctx, e); }
      actual = B.empleados.find((x) => x.id === id) || null;
      ctx.filtros(`<label class="campo"><span>Mostrar</span><select name="ver">${['ACTIVO', 'BAJA', 'TODOS'].map((x) => `<option ${ver === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar value="${esc(buscar)}" placeholder="Código, nombre, DPI…"></label>`,
        `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-user-plus" aria-hidden="true"></i> Nuevo empleado</button>' : ''}${botonesExp}`);
      pintar();
    }
    const lista0 = () => B.empleados.filter((e) => (ver === 'TODOS' || e.estado === ver) && (!buscar || `${e.codigo} ${nombre(e)} ${e.dpi || ''}`.toLowerCase().includes(buscar.toLowerCase())));
    function ficha(e) {
      const v = e || { codigo: sigCod(B.empleados), fecha_ingreso: fmt.hoy(), tipo_contrato: 'INDEFINIDO', jornada: 'DIURNA', salario_base: B.par.salario_minimo || 0, bonificacion: B.par.bonificacion_incentivo || 250, forma_pago: 'TRANSFERENCIA', estado: 'ACTIVO' };
      const dis = ctx.admin ? '' : 'disabled';
      const t = (k, l, x = '') => `<label class="campo ${x}"><span>${l}</span><input name="${k}" value="${esc(String(v[k] ?? ''))}" ${dis}></label>`;
      const d = (k, l) => `<label class="campo"><span>${l}</span><input type="date" name="${k}" value="${v[k] || ''}" ${dis}></label>`;
      const n = (k, l) => `<label class="campo"><span>${l}</span><input type="number" step="0.01" name="${k}" value="${v[k] ?? ''}" ${dis}></label>`;
      const s = (k, l, ops) => `<label class="campo"><span>${l}</span><select name="${k}" ${dis}>${ops.map(([a, b]) => `<option value="${a}" ${String(v[k] ?? '') === String(a) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></label>`;
      return `<form class="nom-ficha" novalidate><div class="cl-banda">${e ? `Empleado ${e.codigo} · ${esc(nombre(e))} ${marca(e.estado)}` : 'Nuevo empleado'}</div><div class="sat-g">
        ${n('codigo', 'Código')}${t('nombres', 'Nombres *')}${t('apellidos', 'Apellidos *')}${t('dpi', 'DPI (CUI)')}${t('nit', 'NIT')}${t('igss_afiliacion', 'Afiliación IGSS')}${d('fecha_nacimiento', 'Fecha de nacimiento')}${s('genero', 'Género', [['', '—'], ['M', 'Masculino'], ['F', 'Femenino']])}
        ${d('fecha_ingreso', 'Fecha de ingreso *')}${s('departamento_id', 'Departamento', [['', '—'], ...B.deptos.map((x) => [x.id, x.nombre])])}${s('puesto_id', 'Puesto', [['', '—'], ...B.puestos.map((x) => [x.id, x.nombre])])}${s('tipo_contrato', 'Contrato', [['INDEFINIDO', 'Indefinido'], ['PLAZO FIJO', 'Plazo fijo'], ['POR OBRA', 'Por obra']])}
        ${s('jornada', 'Jornada', [['DIURNA', 'Diurna (8 h)'], ['MIXTA', 'Mixta (7 h)'], ['NOCTURNA', 'Nocturna (6 h)']])}${n('salario_base', 'Salario base mensual Q *')}${n('bonificacion', 'Bonificación incentivo Q')}${s('forma_pago', 'Forma de pago', [['TRANSFERENCIA', 'Transferencia'], ['CHEQUE', 'Cheque'], ['EFECTIVO', 'Efectivo']])}
        ${t('banco', 'Banco')}${t('cuenta_bancaria', 'Cuenta bancaria')}${t('correo', 'Correo')}${t('telefono', 'Teléfono')}
        ${e ? `${s('estado', 'Estado', [['ACTIVO', 'Activo'], ['SUSPENDIDO', 'Suspendido'], ['BAJA', 'Baja']])}${d('fecha_baja', 'Fecha de baja')}${t('motivo_baja', 'Motivo de baja', 'sat-ancho')}` : ''}</div>
        ${num(v.salario_base) && num(B.par.salario_minimo) && num(v.salario_base) < num(B.par.salario_minimo) ? '<p class="pr-guia pc-rojo"><i class="ti ti-alert-triangle" aria-hidden="true"></i> El salario es menor al salario mínimo de los parámetros.</p>' : ''}
        <p class="modal-error tk-error" role="alert"></p>${ctx.admin ? `<div class="pr-nueva-acc">${e ? '' : '<button type="button" class="boton secundario-sm" data-accion="cancelar">Cancelar</button>'}<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button></div>` : ''}</form>`;
    }
    let nuevo = false;
    function pintar() {
      const ls = lista0();
      const act = B.empleados.filter((e) => e.estado === 'ACTIVO');
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">
        <div class="ec-kpis">${kpi('Empleados activos', act.length)}${kpi('Planilla base mensual', q(sum(act.map((e) => num(e.salario_base) + num(e.bonificacion)))))}${kpi('Salario promedio', q(act.length ? sum(act.map((e) => num(e.salario_base))) / act.length : 0))}${kpi('Departamentos', B.deptos.length)}</div>
        <div class="nom-split"><div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr><th class="num">Código</th><th>Nombre</th><th>Departamento</th><th class="num">Salario</th><th>Estado</th></tr></thead>
          <tbody>${ls.map((e) => `<tr data-e="${e.id}" class="${actual?.id === e.id ? 'actual' : ''}" style="cursor:pointer"><td class="num">${e.codigo}</td><td>${esc(nombre(e))}</td><td>${esc(deptoTxt(B, e.departamento_id))}</td><td class="num">${fmt.monto(e.salario_base)}</td><td>${marca(e.estado)}</td></tr>`).join('') || '<tr><td colspan="5" class="tk-vacio">Sin empleados. Agrega uno con «Nuevo empleado».</td></tr>'}</tbody></table></div>
          <div class="nom-ficha-c">${nuevo ? ficha(null) : actual ? ficha(actual) : '<p class="ck-elige"><i class="ti ti-user" aria-hidden="true"></i> Elige un empleado de la lista.</p>'}</div></div></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(null); if (e.target.name === 'ver' && e.target.closest('.bk-filtros')) { ver = e.target.value; pintar(); } });
    cont.addEventListener('input', (e) => { if (e.target.matches('[data-buscar]')) { buscar = e.target.value; pintar(); const i = ctx.pFil.querySelector('[data-buscar]'); i?.focus(); } });
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('.nom-ficha')) return; e.preventDefault();
      const el = e.target.elements, g = (k) => el[k]?.value?.trim?.() ?? '';
      const v = { codigo: Number(g('codigo')), nombres: g('nombres').toUpperCase(), apellidos: g('apellidos').toUpperCase(), dpi: g('dpi') || null, nit: g('nit') || null, igss_afiliacion: g('igss_afiliacion') || null, fecha_nacimiento: g('fecha_nacimiento') || null, genero: g('genero') || null, fecha_ingreso: g('fecha_ingreso'),
        departamento_id: Number(g('departamento_id')) || null, puesto_id: Number(g('puesto_id')) || null, tipo_contrato: g('tipo_contrato'), jornada: g('jornada'), salario_base: num(g('salario_base')), bonificacion: num(g('bonificacion')), forma_pago: g('forma_pago'), banco: g('banco') || null, cuenta_bancaria: g('cuenta_bancaria') || null, correo: g('correo') || null, telefono: g('telefono') || null };
      if (el.estado) Object.assign(v, { estado: g('estado'), fecha_baja: g('fecha_baja') || null, motivo_baja: g('motivo_baja') || null });
      if (!v.nombres || !v.apellidos || !v.fecha_ingreso) { e.target.querySelector('.modal-error').textContent = 'Nombres, apellidos y fecha de ingreso son obligatorios.'; return; }
      const r = nuevo ? await sb.from('nom_empleados').insert({ ...v, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single() : await sb.from('nom_empleados').update(v).eq('id', actual.id).select('id').single();
      if (r.error) { e.target.querySelector('.modal-error').textContent = /unique|duplicate/i.test(r.error.message) ? 'Ese código ya existe.' : window.UI.traducirError(r.error); return; }
      nuevo = false; window.FIN.aviso('Empleado guardado'); cargar(r.data.id);
    });
    cont.addEventListener('click', (e) => {
      const ex = e.target.closest('[data-exp]');
      if (ex) return exportar({ titulo: 'Empleados', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Empleados', archivo: 'empleados', parametros: [`Empresa: ${empresaDe(ctx)}`, `Mostrar: ${ver}`], columnas: [col('Código', 'texto', 8), col('Nombre', 'texto', 34), col('DPI', 'texto', 16), col('Afiliación IGSS', 'texto', 14), col('Departamento', 'texto', 24), col('Ingreso', 'texto', 11), col('Salario Q', 'monto', 13), col('Bonificación Q', 'monto', 12), col('Estado', 'texto', 10)], filas: lista0().map((x) => ({ valores: [String(x.codigo), nombre(x), x.dpi || '', x.igss_afiliacion || '', deptoTxt(B, x.departamento_id), fmt.fechaDia(x.fecha_ingreso), r2(x.salario_base), r2(x.bonificacion), x.estado] })) }, ex.dataset.exp, false);
      const tr = e.target.closest('tr[data-e]'); if (tr) { nuevo = false; actual = B.empleados.find((x) => String(x.id) === tr.dataset.e); return pintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'nuevo') { nuevo = true; actual = null; return pintar(); }
      if (a === 'cancelar') { nuevo = false; return pintar(); }
    });
    iniciar();
  };

  // ===================== Novedades, préstamos y vacaciones =====================
  const periodoFiltros = (f, quincenal) => `<label class="campo cx-anio"><span>Año</span><input type="number" name="anio" value="${f.anio}" min="2000" max="2999"></label><label class="campo"><span>Mes</span><select name="mes">${MES.map((m, i) => `<option value="${i + 1}" ${f.mes === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>${quincenal ? `<label class="campo"><span>Quincena</span><select name="quincena">${[[0, 'Mes completo'], [1, '1.ª quincena'], [2, '2.ª quincena']].map(([v, t]) => `<option value="${v}" ${f.quincena === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}`;
  window.PANTALLAS['nom-novedades'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Novedades del período', icono: 'ti-clock-plus', clase: 'bk-movimientos bm-solo cx-rep', grupo: 'Nóminas · Registros' });
    const { sb } = ctx;
    const h = new Date(); const f = { anio: h.getFullYear(), mes: h.getMonth() + 1, quincena: 0 };
    let B = null, novs = [];
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-clock-plus'); return; }
      try { B = await baseNomina(ctx); } catch (e) { return faltaScript(ctx, e); }
      ctx.filtros(periodoFiltros(f, B.par.frecuencia === 'QUINCENAL'), botonesExp);
      novs = (await sb.from('nom_novedades').select('*').eq('localidad_id', ctx.sel.loc).eq('anio', f.anio).eq('mes', f.mes).order('id')).data || [];
      pintar();
    }
    const emp = (id) => B.empleados.find((e) => e.id === id);
    const cfg = () => ({ titulo: `Novedades de ${MES[f.mes - 1]} ${f.anio}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Novedades', archivo: `novedades_${f.anio}_${f.mes}`, parametros: [`Empresa: ${empresaDe(ctx)}`],
      columnas: [col('Empleado', 'texto', 34), col('Clase', 'texto', 16), col('Concepto', 'texto', 24), col('Cantidad', 'numero', 10), col('Monto Q', 'monto', 13), col('Descripción', 'texto', 36), col('Estado', 'texto', 12)],
      filas: novs.map((n) => ({ valores: [`${emp(n.empleado_id)?.codigo ?? ''} · ${nombre(emp(n.empleado_id))}`, n.clase, B.conceptos.find((c) => c.id === n.concepto_id)?.nombre || '', num(n.cantidad), r2(n.monto), n.descripcion || '', n.planilla_id ? 'Aplicada' : 'Pendiente'], attr: `data-n="${n.id}"` })) });
    function pintar() {
      const c = cfg();
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">
        <div class="ec-kpis">${kpi('Novedades', novs.length)}${kpi('Horas extra', sum(novs.filter((n) => n.clase === 'HORAS EXTRA').map((n) => n.cantidad)))}${kpi('Días de ausencia', sum(novs.filter((n) => n.clase !== 'HORAS EXTRA' && n.clase !== 'INGRESO' && n.clase !== 'DESCUENTO').map((n) => n.cantidad)))}${kpi('Otros ingresos', q(sum(novs.filter((n) => n.clase === 'INGRESO').map((n) => n.monto))))}${kpi('Descuentos', q(sum(novs.filter((n) => n.clase === 'DESCUENTO').map((n) => n.monto))))}</div>
        ${ctx.admin ? `<form class="pf-modform nom-nov" novalidate><label class="campo"><span>Empleado</span><select name="empleado">${B.empleados.filter((e) => e.estado === 'ACTIVO').map((e) => `<option value="${e.id}">${e.codigo} · ${esc(nombre(e))}</option>`).join('')}</select></label>
          <label class="campo"><span>Clase</span><select name="clase">${['HORAS EXTRA', 'AUSENCIA', 'SUSPENSIÓN IGSS', 'INGRESO', 'DESCUENTO'].map((x) => `<option>${x}</option>`).join('')}</select></label>
          <label class="campo"><span>Concepto (ingreso o descuento)</span><select name="concepto"><option value="">—</option>${B.conceptos.filter((x) => x.activo).map((x) => `<option value="${x.id}">${esc(x.tipo)} · ${esc(x.nombre)}</option>`).join('')}</select></label>
          <label class="campo"><span>Horas o días</span><input type="number" name="cantidad" step="0.5" min="0" value="0"></label><label class="campo"><span>Monto Q</span><input type="number" name="monto" step="0.01" min="0" value="0"></label>
          <label class="campo pf-just"><span>Descripción</span><input name="descripcion" maxlength="200"></label><button type="submit" class="boton primario-sm"><i class="ti ti-plus" aria-hidden="true"></i> Agregar</button><p class="modal-error tk-error" role="alert"></p></form>` : ''}
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Horas extra: en horas (se pagan al 150 %). Ausencia y suspensión IGSS: en días (rebajan el salario). Ingresos y descuentos: monto con su concepto. Toca una novedad pendiente para quitarla.</p>
        ${tabla(c, false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); if (['anio', 'mes', 'quincena'].includes(e.target.name) && e.target.closest('.bk-filtros')) { f[e.target.name] = Number(e.target.value); return cargar(); } });
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('.nom-nov')) return; e.preventDefault();
      const el = e.target.elements, clase = el.clase.value;
      if (['INGRESO', 'DESCUENTO'].includes(clase) && (!el.concepto.value || !num(el.monto.value))) { e.target.querySelector('.modal-error').textContent = 'Elige el concepto y escribe el monto.'; return; }
      if (!['INGRESO', 'DESCUENTO'].includes(clase) && !num(el.cantidad.value)) { e.target.querySelector('.modal-error').textContent = 'Escribe las horas o los días.'; return; }
      const { error } = await sb.from('nom_novedades').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, empleado_id: Number(el.empleado.value), anio: f.anio, mes: f.mes, quincena: f.quincena, clase, concepto_id: Number(el.concepto.value) || null, cantidad: num(el.cantidad.value), monto: num(el.monto.value), descripcion: el.descripcion.value.trim() || null, usuario: (window.FIN.perfil()?.usuario || '').toUpperCase() });
      if (error) { e.target.querySelector('.modal-error').textContent = window.UI.traducirError(error); return; }
      cargar();
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      const tr = e.target.closest('tr[data-n]'); if (!tr || !ctx.admin) return;
      const n = novs.find((x) => String(x.id) === tr.dataset.n); if (n.planilla_id) return window.FIN.aviso('La novedad ya se aplicó en una planilla pagada');
      if (!confirm('¿Quitar la novedad?')) return; await sb.from('nom_novedades').delete().eq('id', n.id); cargar();
    });
    iniciar();
  };
  window.PANTALLAS['nom-prestamos'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Anticipos y préstamos', icono: 'ti-cash-banknote', clase: 'bk-movimientos bm-solo cx-rep', grupo: 'Nóminas · Registros' });
    const { sb } = ctx;
    let B = null, ps = [], ver = 'ACTIVO';
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-cash-banknote'); return; }
      try { B = await baseNomina(ctx); } catch (e) { return faltaScript(ctx, e); }
      ctx.filtros(`<label class="campo"><span>Estado</span><select name="ver">${['ACTIVO', 'PAGADO', 'ANULADO', 'TODOS'].map((x) => `<option ${ver === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`, botonesExp);
      ps = (await sb.from('nom_prestamos').select('*').eq('localidad_id', ctx.sel.loc).order('fecha', { ascending: false })).data || [];
      pintar();
    }
    const emp = (id) => B.empleados.find((e) => e.id === id);
    const cfg = () => { const ls = ps.filter((p) => ver === 'TODOS' || p.estado === ver); return { titulo: 'Anticipos y préstamos a empleados', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Prestamos', archivo: 'prestamos_empleados', parametros: [`Empresa: ${empresaDe(ctx)}`, `Estado: ${ver}`],
      columnas: [col('Fecha', 'texto', 11), col('Empleado', 'texto', 34), col('Tipo', 'texto', 11), col('Monto Q', 'monto', 13), col('Cuotas', 'entero', 8), col('Cuota Q', 'monto', 12), col('Saldo Q', 'monto', 13), col('Estado', 'texto', 11), col('Descripción', 'texto', 30)],
      filas: [...ls.map((p) => ({ valores: [fmt.fechaDia(p.fecha), nombre(emp(p.empleado_id)), p.tipo, r2(p.monto), p.cuotas, r2(p.cuota), r2(p.saldo), `¤${p.estado}`, p.descripcion || ''], attr: `data-p="${p.id}"` })), { valores: ['Total', '', '', r2(sum(ls.map((p) => p.monto))), '', '', r2(sum(ls.map((p) => p.saldo))), '', ''], tipo: 'total' }] }; };
    function pintar() {
      const act = ps.filter((p) => p.estado === 'ACTIVO');
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Préstamos activos', act.length)}${kpi('Saldo por cobrar', q(sum(act.map((p) => p.saldo))), 'ec-fin')}${kpi('Descuento por planilla', q(sum(act.map((p) => Math.min(num(p.cuota), num(p.saldo))))))}</div>
        ${ctx.admin ? `<form class="pf-modform nom-pres" novalidate><label class="campo"><span>Empleado</span><select name="empleado">${B.empleados.filter((e) => e.estado === 'ACTIVO').map((e) => `<option value="${e.id}">${e.codigo} · ${esc(nombre(e))}</option>`).join('')}</select></label><label class="campo"><span>Tipo</span><select name="tipo"><option>PRÉSTAMO</option><option>ANTICIPO</option></select></label><label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${fmt.hoy()}"></label><label class="campo"><span>Monto Q</span><input type="number" name="monto" step="0.01" min="0.01"></label><label class="campo"><span>Cuotas</span><input type="number" name="cuotas" min="1" value="1"></label><label class="campo pf-just"><span>Descripción</span><input name="descripcion" maxlength="200"></label><button type="submit" class="boton primario-sm"><i class="ti ti-plus" aria-hidden="true"></i> Registrar</button><p class="modal-error tk-error" role="alert"></p></form>` : ''}
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> La cuota se descuenta en cada planilla ordinaria hasta saldar; al pagar la planilla baja el saldo. Toca un préstamo activo para anularlo. El descuento no debe exceder lo que permite el Código de Trabajo (art. 99).</p>${tabla(cfg(), false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); if (e.target.name === 'ver' && e.target.closest('.bk-filtros')) { ver = e.target.value; pintar(); } });
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('.nom-pres')) return; e.preventDefault();
      const el = e.target.elements, monto = num(el.monto.value), cuotas = Math.max(1, Number(el.cuotas.value) || 1);
      if (!monto) { e.target.querySelector('.modal-error').textContent = 'Escribe el monto.'; return; }
      const { error } = await sb.from('nom_prestamos').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, empleado_id: Number(el.empleado.value), tipo: el.tipo.value, fecha: el.fecha.value, monto, cuotas, cuota: r2(monto / cuotas), saldo: monto, descripcion: el.descripcion.value.trim() || null });
      if (error) { e.target.querySelector('.modal-error').textContent = window.UI.traducirError(error); return; }
      cargar();
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      const tr = e.target.closest('tr[data-p]'); if (!tr || !ctx.admin) return;
      const p = ps.find((x) => String(x.id) === tr.dataset.p); if (p.estado !== 'ACTIVO') return;
      if (!confirm('¿Anular el préstamo?')) return; await sb.from('nom_prestamos').update({ estado: 'ANULADO' }).eq('id', p.id); cargar();
    });
    iniciar();
  };
  window.PANTALLAS['nom-vacaciones'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Vacaciones', icono: 'ti-beach', clase: 'bk-movimientos bm-solo cx-rep', grupo: 'Nóminas · Registros' });
    const { sb } = ctx;
    let B = null, vs = [];
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-beach'); return; }
      try { B = await baseNomina(ctx); } catch (e) { return faltaScript(ctx, e); }
      ctx.filtros('', botonesExp);
      vs = (await sb.from('nom_vacaciones').select('*').eq('localidad_id', ctx.sel.loc).order('desde', { ascending: false })).data || [];
      pintar();
    }
    const saldo = (e) => { const anios = dias(e.fecha_ingreso, e.fecha_baja || fmt.hoy()) / 365, gan = 15 * anios, goz = sum(vs.filter((v) => v.empleado_id === e.id).map((v) => v.dias)); return { anios, gan, goz, pend: gan - goz }; };
    const cfg = () => ({ titulo: 'Saldo de vacaciones', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Vacaciones', archivo: 'vacaciones', parametros: [`Empresa: ${empresaDe(ctx)}`, `Al ${fmt.fechaDia(fmt.hoy())}`, '15 días hábiles por año (Código de Trabajo art. 130)'],
      columnas: [col('Código', 'texto', 8), col('Empleado', 'texto', 34), col('Ingreso', 'texto', 11), col('Años', 'numero', 8), col('Días ganados', 'numero', 11), col('Días gozados', 'numero', 11), col('Días pendientes', 'numero', 12), col('Valor pendiente Q', 'monto', 14)],
      filas: B.empleados.filter((e) => e.estado === 'ACTIVO').map((e) => { const s = saldo(e); return { valores: [String(e.codigo), nombre(e), fmt.fechaDia(e.fecha_ingreso), r2(s.anios), r2(s.gan), r2(s.goz), r2(s.pend), r2((num(e.salario_base) / 30) * Math.max(0, s.pend))], resaltar: s.pend > 30 }; }) });
    function pintar() {
      const c = cfg();
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">
        ${ctx.admin ? `<form class="pf-modform nom-vac" novalidate><label class="campo"><span>Empleado</span><select name="empleado">${B.empleados.filter((e) => e.estado === 'ACTIVO').map((e) => `<option value="${e.id}">${e.codigo} · ${esc(nombre(e))}</option>`).join('')}</select></label><label class="campo"><span>Desde</span><input type="date" name="desde" value="${fmt.hoy()}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${fmt.hoy()}"></label><label class="campo"><span>Días hábiles</span><input type="number" name="dias" step="0.5" min="0.5" placeholder="Se calculan"></label><label class="campo"><span>Período</span><input name="periodo" placeholder="${new Date().getFullYear() - 1}-${new Date().getFullYear()}"></label><label class="campo pf-just"><span>Observaciones</span><input name="observaciones"></label><button type="submit" class="boton primario-sm"><i class="ti ti-plus" aria-hidden="true"></i> Registrar goce</button><p class="modal-error tk-error" role="alert"></p></form>` : ''}
        ${tabla(c, false)}
        <div class="cl-banda">Goces registrados</div>${tabla({ columnas: [col('Empleado', 'texto'), col('Desde', 'texto'), col('Hasta', 'texto'), col('Días', 'numero'), col('Período', 'texto'), col('Observaciones', 'texto')], filas: vs.slice(0, 200).map((v) => ({ valores: [nombre(B.empleados.find((e) => e.id === v.empleado_id)), fmt.fechaDia(v.desde), fmt.fechaDia(v.hasta), num(v.dias), v.periodo || '', v.observaciones || ''] })), vacio: 'Sin goces registrados.' }, false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') cargar(); });
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('.nom-vac')) return; e.preventDefault();
      const el = e.target.elements; let d = num(el.dias.value);
      if (!d) { const a = new Date(`${el.desde.value}T12:00:00`), b = new Date(`${el.hasta.value}T12:00:00`); for (let x = new Date(a); x <= b; x.setDate(x.getDate() + 1)) if (x.getDay() && x.getDay() !== 6) d++; }
      const { error } = await sb.from('nom_vacaciones').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, empleado_id: Number(el.empleado.value), desde: el.desde.value, hasta: el.hasta.value, dias: d, periodo: el.periodo.value.trim() || null, observaciones: el.observaciones.value.trim() || null });
      if (error) { e.target.querySelector('.modal-error').textContent = window.UI.traducirError(error); return; }
      cargar();
    });
    cont.addEventListener('click', (e) => { const ex = e.target.closest('[data-exp]'); if (ex) exportar(cfg(), ex.dataset.exp, false); });
    iniciar();
  };

  // ===================== Planillas =====================
  const COLS_PLANILLA = [col('Código', 'texto', 8), col('Empleado', 'texto', 30), col('Días', 'numero', 6), col('Salario', 'monto', 12), col('H. extra', 'numero', 7), col('Monto extra', 'monto', 11), col('Bonificación', 'monto', 11), col('Otros ingresos', 'monto', 11), col('Prestaciones', 'monto', 12), col('Total ingresos', 'monto', 13), col('IGSS', 'monto', 10), col('ISR', 'monto', 10), col('Préstamos', 'monto', 10), col('Otros desc.', 'monto', 10), col('Total desc.', 'monto', 12), col('Líquido', 'monto', 13), col('Patronal', 'monto', 11)];
  const K = ['dias', 'salario', 'horas_extra', 'monto_horas_extra', 'bonificacion', 'otros_ingresos', 'prestaciones', 'total_ingresos', 'igss_laboral', 'isr', 'prestamos', 'otros_descuentos', 'total_descuentos', 'liquido', 'igss_patronal'];
  function filasPlanilla(B, lineas) {
    const filas = [], porD = new Map();
    lineas.forEach((l) => { const k = l.departamento_id || 0; const a = porD.get(k) || []; a.push(l); porD.set(k, a); });
    [...porD.entries()].forEach(([d, ls]) => {
      filas.push({ valores: [deptoTxt(B, d)], tipo: 'grupo', combinar: true });
      ls.sort((a, b) => (B.empleados.find((e) => e.id === a.empleado_id)?.codigo || 0) - (B.empleados.find((e) => e.id === b.empleado_id)?.codigo || 0)).forEach((l) => { const e = B.empleados.find((x) => x.id === l.empleado_id); filas.push({ valores: [String(e?.codigo ?? ''), nombre(e), ...K.map((k) => num(l[k]))] }); });
      filas.push({ valores: [`Subtotal (${ls.length})`, '', ...K.map((k) => (k === 'dias' || k === 'horas_extra' ? '' : r2(sum(ls.map((l) => l[k])))))], tipo: 'subtotal' });
    });
    if (lineas.length) filas.push({ valores: [`Total (${lineas.length} empleados)`, '', ...K.map((k) => (k === 'dias' || k === 'horas_extra' ? '' : r2(sum(lineas.map((l) => l[k])))))], tipo: 'total' });
    return filas;
  }
  window.PANTALLAS['nom-planilla'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Planillas', icono: 'ti-file-dollar', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Nóminas · Procesos' });
    const { sb } = ctx;
    const h = new Date(); const f = { tipo: 'ORDINARIA', anio: h.getFullYear(), mes: h.getMonth() + 1, quincena: 0 };
    let B = null, plas = [], actual = null, lineas = [];
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar(id = actual?.id) {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-file-dollar'); return; }
      try { B = await baseNomina(ctx); } catch (e) { return faltaScript(ctx, e); }
      if (f.quincena && B.par.frecuencia !== 'QUINCENAL') f.quincena = 0;
      plas = (await sb.from('nom_planillas').select('*').eq('localidad_id', ctx.sel.loc).eq('anio', f.anio).order('numero', { ascending: false })).data || [];
      actual = plas.find((p) => p.id === id) || plas.find((p) => p.tipo === f.tipo && p.mes === f.mes && p.quincena === f.quincena && p.estado !== 'ANULADA') || null;
      lineas = actual ? (await sb.from('nom_planilla_lineas').select('*').eq('planilla_id', actual.id)).data || [] : [];
      ctx.filtros(`<label class="campo"><span>Tipo</span><select name="tipo">${['ORDINARIA', 'BONO 14', 'AGUINALDO', 'LIQUIDACIÓN'].map((x) => `<option ${f.tipo === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>${periodoFiltros(f, f.tipo === 'ORDINARIA' && B.par.frecuencia === 'QUINCENAL')}
        <label class="campo"><span>Planilla</span><select name="pla">${plas.map((p) => `<option value="${p.id}" ${actual?.id === p.id ? 'selected' : ''}>No. ${p.numero} · ${p.tipo} · ${M3[p.mes - 1]}${p.quincena ? ` Q${p.quincena}` : ''} · ${p.estado}</option>`).join('') || '<option value="">Sin planillas</option>'}</select></label>`,
        `${ctx.admin && f.tipo !== 'LIQUIDACIÓN' ? '<button type="button" class="boton primario-sm" data-accion="calcular"><i class="ti ti-calculator" aria-hidden="true"></i> Calcular planilla</button>' : ''}${botonesExp}`);
      pintar();
    }
    const cfg = () => ({ titulo: `Planilla ${actual?.tipo || f.tipo} No. ${actual?.numero || ''} · ${MES[(actual?.mes || f.mes) - 1]} ${actual?.anio || f.anio}${actual?.quincena ? ` · ${actual.quincena}.ª quincena` : ''}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Planilla', archivo: `planilla_${actual?.numero || ''}`,
      parametros: [`Empresa: ${empresaDe(ctx)}`, `Estado: ${actual?.estado || ''}`, `Elaboró: ${actual?.elaborado_por || ''}`, ...(actual?.aprobado_por ? [`Aprobó: ${actual.aprobado_por}`] : [])], firmas: ['Elaboró', 'Revisó', 'Autorizó'], columnas: COLS_PLANILLA, filas: filasPlanilla(B, lineas),
      graficas: [G().barras('Costo por departamento (ingresos + patronal, Q)', [...new Set(lineas.map((l) => l.departamento_id || 0))].map((d) => { const ls = lineas.filter((l) => (l.departamento_id || 0) === d); const v = sum(ls.map((l) => num(l.total_ingresos) + num(l.igss_patronal))); return { etiqueta: deptoTxt(B, d), valor: v, texto: q(v) }; }).sort((a, b) => b.valor - a.valor))] });
    function pintar() {
      const p = actual;
      if (!p) { ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="ck-elige"><i class="ti ti-file-dollar" aria-hidden="true"></i> No hay planilla ${f.tipo.toLowerCase()} de ${MES[f.mes - 1]} ${f.anio}. ${ctx.admin && f.tipo !== 'LIQUIDACIÓN' ? 'Registra las novedades y presiona «Calcular planilla».' : f.tipo === 'LIQUIDACIÓN' ? 'Las liquidaciones se calculan en Procesos › Liquidación laboral.' : ''}</p></div>`; return; }
      const yo = (window.FIN.perfil()?.usuario || '').toUpperCase();
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">
        <section class="pr-cab"><div class="pr-id"><small>Planilla ${esc(p.tipo.toLowerCase())}</small><b>No. ${p.numero}</b>${marca(p.estado)}</div>
          <div class="pr-datos"><span><small>Período</small>${MES[p.mes - 1]} ${p.anio}${p.quincena ? ` · ${p.quincena}.ª quincena` : ''}</span><span><small>Fecha de pago</small>${fmt.fechaDia(p.fecha_pago)}</span><span><small>Elaboró</small>${esc(p.elaborado_por || '')}</span>${p.aprobado_por ? `<span><small>Aprobó</small>${esc(p.aprobado_por)}</span>` : ''}${p.pagado_por ? `<span><small>Pagó</small>${esc(p.pagado_por)}</span>` : ''}${p.partida_id ? '<span><small>Partida</small>generada</span>' : ''}${p.motivo_anulacion ? `<span class="pc-rojo"><small>Anulada</small>${esc(p.motivo_anulacion)}</span>` : ''}</div>
          <div class="pr-acc">${ctx.admin && p.estado === 'CALCULADA' ? `<button type="button" class="boton primario-sm" data-accion="APROBAR" ${yo === p.elaborado_por && !window.FIN.esSuperAdmin() ? 'title="Quien calculó no puede aprobar"' : ''}><i class="ti ti-check" aria-hidden="true"></i> Aprobar</button>` : ''}${ctx.admin && p.estado === 'APROBADA' ? '<button type="button" class="boton primario-sm" data-accion="PAGAR"><i class="ti ti-cash" aria-hidden="true"></i> Registrar pago</button>' : ''}${ctx.admin && ['APROBADA', 'PAGADA'].includes(p.estado) && !p.partida_id ? '<button type="button" class="boton secundario-sm" data-accion="partida"><i class="ti ti-notebook" aria-hidden="true"></i> Generar partida</button>' : ''}${ctx.admin && ['CALCULADA', 'APROBADA'].includes(p.estado) ? '<button type="button" class="boton secundario-sm" data-accion="ANULAR"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>' : ''}</div></section>
        <ol class="pf-ciclo">${['Calcular', 'Aprobar', 'Pagar', 'Contabilizar'].map((t, i) => { const k = p.estado === 'CALCULADA' ? 0 : p.estado === 'APROBADA' ? 1 : p.partida_id ? 4 : p.estado === 'PAGADA' ? 3 : 0; return `<li class="${i < k ? 'hecho' : i === k ? 'actual' : ''}">${t}</li>`; }).join('')}</ol>
        <div class="ec-kpis">${kpi('Empleados', p.empleados)}${kpi('Total ingresos', q(p.total_ingresos))}${kpi('Descuentos', q(p.total_descuentos))}${kpi('Líquido a pagar', q(p.total_liquido), 'ec-fin')}${kpi('IGSS (lab. + patr.)', q(num(p.total_igss_laboral) + num(p.total_igss_patronal)))}${kpi('ISR retenido', q(p.total_isr))}</div>
        ${tabla(cfg())}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    async function calcular() {
      if (actual && actual.tipo === f.tipo && actual.estado === 'CALCULADA' && !confirm('¿Recalcular la planilla? Se reemplazan sus líneas con las novedades actuales.')) return;
      if (actual && actual.estado !== 'CALCULADA' && actual.tipo === f.tipo && actual.mes === f.mes && actual.quincena === f.quincena && actual.estado !== 'ANULADA') return window.FIN.aviso(`La planilla ${actual.numero} ya está ${actual.estado.toLowerCase()}: anúlala para recalcular`);
      const act = B.empleados.filter((e) => e.estado !== 'BAJA' || (e.fecha_baja && e.fecha_baja >= `${f.anio}-${String(f.mes).padStart(2, '0')}-01`));
      let ls;
      if (f.tipo === 'ORDINARIA') {
        const [n, p] = await Promise.all([sb.from('nom_novedades').select('*').eq('localidad_id', ctx.sel.loc).eq('anio', f.anio).eq('mes', f.mes).is('planilla_id', null), sb.from('nom_prestamos').select('*').eq('localidad_id', ctx.sel.loc).eq('estado', 'ACTIVO')]);
        const novs = (n.data || []).filter((x) => !f.quincena || !x.quincena || x.quincena === f.quincena);
        ls = act.map((e) => calcularOrdinaria(e, B.par, novs, p.data || [], B.conceptos, f.anio, f.mes, f.quincena)).filter(Boolean);
      } else ls = act.map((e) => calcularPrestacion(e, f.tipo, f.anio)).filter(Boolean);
      if (!ls.length) return window.FIN.aviso('No hay empleados para la planilla (revisa el catálogo de empleados)');
      let id = actual && actual.estado === 'CALCULADA' && actual.tipo === f.tipo && actual.mes === f.mes && actual.quincena === f.quincena ? actual.id : null;
      if (!id) { const r = await sb.from('nom_planillas').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, numero: 0, tipo: f.tipo, anio: f.anio, mes: f.mes, quincena: f.tipo === 'ORDINARIA' ? f.quincena : 0, fecha_pago: fmt.hoy() }).select('id').single(); if (r.error) return window.FIN.aviso(window.UI.traducirError(r.error)); id = r.data.id; }
      else await sb.from('nom_planilla_lineas').delete().eq('planilla_id', id);
      const { error } = await sb.from('nom_planilla_lineas').insert(ls.map((l) => ({ ...l, planilla_id: id })));
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      window.FIN.aviso(`Planilla calculada: ${ls.length} empleado(s)`); cargar(id);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(null); const n = e.target.name; if (!e.target.closest('.bk-filtros')) return; if (n === 'tipo') { f.tipo = e.target.value; if (f.tipo === 'BONO 14') f.mes = 7; if (f.tipo === 'AGUINALDO') f.mes = 12; return cargar(null); } if (['anio', 'mes', 'quincena'].includes(n)) { f[n] = Number(e.target.value); return cargar(null); } if (n === 'pla') return cargar(Number(e.target.value)); });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return actual ? exportar(cfg(), ex.dataset.exp) : null;
      const a = e.target.closest('[data-accion]')?.dataset.accion; if (!a) return;
      if (a === 'calcular') return calcular();
      if (a === 'partida') { const { error } = await sb.rpc('nom_generar_partida', { p_id: actual.id }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); window.FIN.aviso('Partida de planilla generada en Contabilidad'); return cargar(); }
      let motivo = null;
      if (a === 'ANULAR') { motivo = prompt('Motivo de la anulación:'); if (!motivo) return; } else if (!confirm({ APROBAR: '¿Aprobar la planilla?', PAGAR: '¿Registrar el pago de la planilla? Se descuentan las cuotas de préstamos y se cierran las novedades.' }[a])) return;
      const { error } = await sb.rpc('nom_cambiar_estado_planilla', { p_id: actual.id, p_accion: a, p_motivo: motivo });
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      cargar();
    });
    iniciar();
  };

  // ===================== Liquidación laboral =====================
  window.PANTALLAS['nom-liquidacion'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Liquidación laboral', icono: 'ti-user-minus', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Nóminas · Procesos' });
    const { sb } = ctx;
    const f = { empleado: '', baja: fmt.hoy(), motivo: 'RENUNCIA' };
    let B = null, vac = [], prest = [], R = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-user-minus'); return; }
      try { B = await baseNomina(ctx); } catch (e) { return faltaScript(ctx, e); }
      const [v, p] = await Promise.all([sb.from('nom_vacaciones').select('empleado_id, dias').eq('localidad_id', ctx.sel.loc), sb.from('nom_prestamos').select('*').eq('localidad_id', ctx.sel.loc).eq('estado', 'ACTIVO')]);
      vac = v.data || []; prest = p.data || [];
      const act = B.empleados.filter((e) => e.estado !== 'BAJA'); if (!act.some((e) => String(e.id) === String(f.empleado))) f.empleado = act[0]?.id || '';
      ctx.filtros(`<label class="campo"><span>Empleado</span><select name="empleado">${act.map((e) => `<option value="${e.id}" ${String(f.empleado) === String(e.id) ? 'selected' : ''}>${e.codigo} · ${esc(nombre(e))}</option>`).join('') || '<option value="">Sin empleados</option>'}</select></label>
        <label class="campo"><span>Fecha de baja</span><input type="date" name="baja" value="${f.baja}"></label><label class="campo"><span>Motivo</span><select name="motivo">${['RENUNCIA', 'DESPIDO INJUSTIFICADO', 'DESPIDO JUSTIFICADO', 'FIN DE CONTRATO', 'MUTUO ACUERDO'].map((x) => `<option ${f.motivo === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`,
        `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="guardar"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar liquidación</button>' : ''}${botonesExp}`);
      pintar();
    }
    const emp = () => B.empleados.find((e) => String(e.id) === String(f.empleado));
    function cfg() {
      const e = emp(); if (!e) return { columnas: [col('Concepto', 'texto')], filas: [], vacio: 'Elige un empleado.' };
      R = calcularLiquidacion(e, B.par, f.baja, f.motivo, sum(vac.filter((v) => v.empleado_id === e.id).map((v) => v.dias)), prest);
      return { titulo: `Liquidación laboral · ${nombre(e)}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Liquidacion', archivo: `liquidacion_${e.codigo}`, firmas: ['Trabajador (recibí conforme)', 'Patrono / Representante legal'],
        parametros: [`Empresa: ${empresaDe(ctx)}`, `Empleado ${e.codigo} · DPI ${e.dpi || '—'}`, `Ingreso ${fmt.fechaDia(e.fecha_ingreso)} · baja ${fmt.fechaDia(f.baja)}`, `Motivo: ${f.motivo}`, `Salario base ${q(e.salario_base)}`],
        columnas: [col('Concepto', 'texto', 40), col('Detalle', 'texto', 50), col('Monto Q', 'monto', 16)], filas: [...R.partes.map(([t, v, d]) => ({ valores: [t, d, r2(v)] })), { valores: ['LÍQUIDO A PAGAR', '', R.liquido], tipo: 'total' }] };
    }
    function pintar() {
      const c = cfg();
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">${R ? `<div class="ec-kpis">${kpi('Indemnización', q(R.linea.detalle.indemnizacion))}${kpi('Prestaciones (aguinaldo, Bono 14, vacaciones)', q(R.linea.detalle.aguinaldo + R.linea.detalle.bono14 + R.linea.detalle.vacaciones))}${kpi('Líquido a pagar', q(R.liquido), 'ec-fin')}</div>` : ''}
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Indemnización solo por despido injustificado (Código de Trabajo art. 82): un salario por año, más 1/6 de aguinaldo y 1/6 de Bono 14. Aguinaldo y Bono 14 proporcionales; vacaciones pendientes a razón de 15 días por año menos lo gozado. Al pagar la planilla de liquidación el empleado queda de baja.</p>${tabla(c, false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); if (['empleado', 'baja', 'motivo'].includes(e.target.name)) { f[e.target.name] = e.target.value; pintar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      if (!e.target.closest('[data-accion="guardar"]') || !R) return;
      if (!confirm(`¿Guardar la liquidación de ${nombre(emp())} por ${q(R.liquido)}? Queda como planilla de liquidación para aprobar y pagar.`)) return;
      await sb.from('nom_empleados').update({ fecha_baja: f.baja, motivo_baja: f.motivo }).eq('id', emp().id);
      const r = await sb.from('nom_planillas').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, numero: 0, tipo: 'LIQUIDACIÓN', anio: Number(f.baja.slice(0, 4)), mes: Number(f.baja.slice(5, 7)), fecha_pago: f.baja, descripcion: `LIQUIDACIÓN ${nombre(emp())} · ${f.motivo}` }).select('id').single();
      if (r.error) return window.FIN.aviso(window.UI.traducirError(r.error));
      const { error } = await sb.from('nom_planilla_lineas').insert({ ...R.linea, planilla_id: r.data.id });
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      window.FIN.aviso('Liquidación guardada: apruébala y págala en Procesos › Planillas (tipo Liquidación)');
    });
    iniciar();
  };

  // ===================== Reportes =====================
  const DEF = {
    'nom-reporte-planilla': 'Planilla del período', 'nom-boletas': 'Boletas de pago', 'nom-planilla-igss': 'Planilla del IGSS', 'nom-retenciones-isr': 'Retenciones de ISR',
    'nom-libro-salarios': 'Libro de salarios', 'nom-costo-personal': 'Costo de personal', 'nom-provision-prestaciones': 'Provisión de prestaciones'
  };
  function reporte(cont, id) {
    const ctx = montar(cont, { titulo: DEF[id], icono: 'ti-report', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Nóminas · Reportes' });
    const { sb } = ctx;
    const h = new Date(); const f = { anio: h.getFullYear(), mes: h.getMonth() + 1, pla: '', empleado: '', graficas: true };
    let B = null, plas = [], lineas = [], cfg = null;
    const anual = ['nom-retenciones-isr', 'nom-libro-salarios', 'nom-costo-personal'].includes(id), porPlanilla = ['nom-reporte-planilla', 'nom-boletas'].includes(id);
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-report'); return; }
      try { B = await baseNomina(ctx); } catch (e) { return faltaScript(ctx, e); }
      plas = (await sb.from('nom_planillas').select('*').eq('localidad_id', ctx.sel.loc).eq('anio', f.anio).in('estado', ['APROBADA', 'PAGADA']).order('numero', { ascending: false })).data || [];
      if (porPlanilla && !plas.some((p) => String(p.id) === String(f.pla))) f.pla = plas[0]?.id || '';
      const ids = porPlanilla ? (f.pla ? [Number(f.pla)] : []) : plas.filter((p) => anual || p.mes === f.mes).map((p) => p.id);
      lineas = ids.length ? await leerTodo(() => sb.from('nom_planilla_lineas').select('*').in('planilla_id', ids).order('id')) : [];
      ctx.filtros(`<label class="campo cx-anio"><span>Año</span><input type="number" name="anio" value="${f.anio}" min="2000" max="2999"></label>
        ${!anual && !porPlanilla && id !== 'nom-provision-prestaciones' ? `<label class="campo"><span>Mes</span><select name="mes">${MES.map((m, i) => `<option value="${i + 1}" ${f.mes === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>` : ''}
        ${id === 'nom-provision-prestaciones' ? `<label class="campo"><span>Mes</span><select name="mes">${MES.map((m, i) => `<option value="${i + 1}" ${f.mes === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>` : ''}
        ${porPlanilla ? `<label class="campo"><span>Planilla aprobada o pagada</span><select name="pla">${plas.map((p) => `<option value="${p.id}" ${String(f.pla) === String(p.id) ? 'selected' : ''}>No. ${p.numero} · ${p.tipo} · ${M3[p.mes - 1]}${p.quincena ? ` Q${p.quincena}` : ''}</option>`).join('') || '<option value="">Sin planillas</option>'}</select></label>` : ''}
        ${id === 'nom-libro-salarios' ? `<label class="campo"><span>Empleado</span><select name="empleado"><option value="">Todos</option>${B.empleados.map((e) => `<option value="${e.id}" ${String(f.empleado) === String(e.id) ? 'selected' : ''}>${e.codigo} · ${esc(nombre(e))}</option>`).join('')}</select></label>` : ''}
        <label class="pc-check"><input type="checkbox" name="graficas" ${f.graficas ? 'checked' : ''}> Gráficas</label>`, botonesExp);
      cfg = construir(); pintar();
    }
    const emp = (i) => B.empleados.find((e) => e.id === i);
    const pla = (i) => plas.find((p) => p.id === i);
    const base = (extra = []) => ({ titulo: DEF[id], orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: DEF[id].slice(0, 30), archivo: `${id}_${f.anio}`, parametros: [`Empresa: ${empresaDe(ctx)}`, ...extra] });
    function construir() {
      if (id === 'nom-reporte-planilla' || id === 'nom-boletas') {
        const p = pla(Number(f.pla));
        return { ...base([p ? `Planilla No. ${p.numero} · ${p.tipo} · ${MES[p.mes - 1]} ${p.anio}${p.quincena ? ` · ${p.quincena}.ª quincena` : ''}` : 'Sin planilla']), firmas: ['Elaboró', 'Revisó', 'Autorizó'], columnas: COLS_PLANILLA, filas: filasPlanilla(B, lineas), p, vacio: 'No hay planillas aprobadas o pagadas en el año.' };
      }
      if (id === 'nom-planilla-igss') {
        const porE = new Map(); lineas.forEach((l) => { const a = porE.get(l.empleado_id) || { sal: 0, lab: 0, pat: 0 }; a.sal += num(l.detalle?.afecto_igss ?? (num(l.salario) + num(l.monto_horas_extra))); a.lab += num(l.igss_laboral); a.pat += num(l.igss_patronal); porE.set(l.empleado_id, a); });
        const filas = [...porE.entries()].filter(([, a]) => a.lab || a.pat).map(([i, a]) => { const e = emp(i); return { valores: [e?.igss_afiliacion || 'SIN AFILIACIÓN', String(e?.codigo ?? ''), nombre(e), e?.dpi || '', r2(a.sal), r2(a.lab), r2(a.pat), r2(a.lab + a.pat)], resaltar: !e?.igss_afiliacion }; });
        filas.push({ valores: [`Total (${filas.length})`, '', '', '', r2(sum([...porE.values()].map((a) => a.sal))), r2(sum([...porE.values()].map((a) => a.lab))), r2(sum([...porE.values()].map((a) => a.pat))), r2(sum([...porE.values()].map((a) => a.lab + a.pat)))], tipo: 'total' });
        return { ...base([`Mes: ${MES[f.mes - 1]} ${f.anio}`, `Cuotas: laboral ${B.par.igss_laboral} % · patronal ${B.par.igss_patronal} %`]), columnas: [col('Afiliación IGSS', 'texto', 14), col('Código', 'texto', 8), col('Empleado', 'texto', 34), col('DPI', 'texto', 16), col('Salario afecto Q', 'monto', 15), col('Cuota laboral Q', 'monto', 13), col('Cuota patronal Q', 'monto', 13), col('Total a pagar Q', 'monto', 14)], filas, vacio: 'No hay planillas aprobadas o pagadas en el mes.' };
      }
      if (id === 'nom-retenciones-isr') {
        const porE = new Map(); lineas.forEach((l) => { const p = pla(l.planilla_id); const a = porE.get(l.empleado_id) || Array(12).fill(0); a[p.mes - 1] += num(l.isr); porE.set(l.empleado_id, a); });
        const filas = [...porE.entries()].filter(([, a]) => sum(a)).map(([i, a]) => { const e = emp(i); return { valores: [e?.nit || 'CF', nombre(e), ...a.map(r2), r2(sum(a))] }; });
        filas.push({ valores: ['Total', '', ...Array.from({ length: 12 }, (_, k) => r2(sum([...porE.values()].map((a) => a[k])))), r2(sum([...porE.values()].map(sum)))], tipo: 'total' });
        return { ...base([`Año ${f.anio}`, 'ISR retenido a asalariados (constancia anual de retenciones)']), columnas: [col('NIT', 'texto', 12), col('Empleado', 'texto', 30), ...M3.map((m) => col(m, 'monto', 10)), col('Total', 'monto', 13)], filas, vacio: 'No hay retenciones de ISR en el año.' };
      }
      if (id === 'nom-libro-salarios') {
        const ls = lineas.filter((l) => !f.empleado || String(l.empleado_id) === String(f.empleado));
        const porE = new Map(); ls.forEach((l) => { const a = porE.get(l.empleado_id) || []; a.push(l); porE.set(l.empleado_id, a); });
        const filas = [];
        [...porE.entries()].forEach(([i, xs]) => { const e = emp(i); filas.push({ valores: [`${e?.codigo} · ${nombre(e)} · DPI ${e?.dpi || '—'} · IGSS ${e?.igss_afiliacion || '—'} · ingreso ${fmt.fechaDia(e?.fecha_ingreso)}`], tipo: 'grupo', combinar: true });
          xs.sort((a, b) => pla(a.planilla_id).mes - pla(b.planilla_id).mes).forEach((l) => { const p = pla(l.planilla_id); filas.push({ valores: [`${M3[p.mes - 1]}${p.quincena ? ` Q${p.quincena}` : ''} · ${p.tipo}`, num(l.dias), r2(l.salario), r2(l.monto_horas_extra), r2(l.bonificacion), r2(num(l.otros_ingresos) + num(l.prestaciones)), r2(l.total_ingresos), r2(l.igss_laboral), r2(l.isr), r2(num(l.prestamos) + num(l.otros_descuentos)), r2(l.liquido)] }); });
          filas.push({ valores: ['Total del año', '', ...['salario', 'monto_horas_extra', 'bonificacion'].map((k) => r2(sum(xs.map((l) => l[k])))), r2(sum(xs.map((l) => num(l.otros_ingresos) + num(l.prestaciones)))), r2(sum(xs.map((l) => l.total_ingresos))), r2(sum(xs.map((l) => l.igss_laboral))), r2(sum(xs.map((l) => l.isr))), r2(sum(xs.map((l) => num(l.prestamos) + num(l.otros_descuentos)))), r2(sum(xs.map((l) => l.liquido)))], tipo: 'subtotal' }); });
        return { ...base([`Año ${f.anio}`, 'Código de Trabajo art. 102']), columnas: [col('Período', 'texto', 20), col('Días', 'numero', 6), col('Salario', 'monto', 12), col('Extras', 'monto', 11), col('Bonificación', 'monto', 11), col('Otros y prestaciones', 'monto', 13), col('Devengado', 'monto', 13), col('IGSS', 'monto', 10), col('ISR', 'monto', 10), col('Otros desc.', 'monto', 11), col('Líquido', 'monto', 13)], filas, vacio: 'No hay planillas aprobadas o pagadas en el año.' };
      }
      if (id === 'nom-costo-personal') {
        const porD = new Map(); lineas.forEach((l) => { const d = l.departamento_id || 0; const a = porD.get(d) || { sal: 0, bon: 0, pre: 0, pat: 0, n: new Set() }; a.sal += num(l.salario) + num(l.monto_horas_extra) + num(l.otros_ingresos); a.bon += num(l.bonificacion); a.pre += num(l.prestaciones); a.pat += num(l.igss_patronal); a.n.add(l.empleado_id); porD.set(d, a); });
        const tot = sum([...porD.values()].map((a) => a.sal + a.bon + a.pre + a.pat));
        const filas = [...porD.entries()].map(([d, a]) => ({ valores: [deptoTxt(B, d), a.n.size, r2(a.sal), r2(a.bon), r2(a.pre), r2(a.pat), r2(a.sal + a.bon + a.pre + a.pat), tot ? (a.sal + a.bon + a.pre + a.pat) / tot : 0] }));
        filas.push({ valores: ['Total', new Set(lineas.map((l) => l.empleado_id)).size, ...['sal', 'bon', 'pre', 'pat'].map((k) => r2(sum([...porD.values()].map((a) => a[k])))), r2(tot), tot ? 1 : 0], tipo: 'total' });
        const porM = Array.from({ length: 12 }, (_, k) => sum(lineas.filter((l) => pla(l.planilla_id).mes === k + 1).map((l) => num(l.total_ingresos) + num(l.igss_patronal))));
        return { ...base([`Año ${f.anio}`]), columnas: [col('Departamento', 'texto', 30), col('Empleados', 'entero', 10), col('Sueldos y extras', 'monto', 15), col('Bonificación', 'monto', 13), col('Prestaciones', 'monto', 13), col('Cuota patronal', 'monto', 13), col('Costo total', 'monto', 15), col('%', 'porcentaje', 8)], filas, vacio: 'No hay planillas aprobadas o pagadas en el año.',
          graficas: [G().columnas('Costo de personal por mes (Q)', M3, [{ nombre: 'Costo', color: G().COLORES.AZUL, valores: porM }]), G().barras('Costo por departamento (Q)', [...porD.entries()].map(([d, a]) => ({ etiqueta: deptoTxt(B, d), valor: a.sal + a.bon + a.pre + a.pat, texto: q(a.sal + a.bon + a.pre + a.pat) })).sort((a, b) => b.valor - a.valor))] };
      }
      // Provisión mensual de prestaciones: indemnización 9.72 %, aguinaldo 8.33 %, Bono 14 8.33 %, vacaciones 4.17 % del salario.
      const act = B.empleados.filter((e) => e.estado === 'ACTIVO' && e.fecha_ingreso <= new Date(f.anio, f.mes, 0).toLocaleDateString('en-CA'));
      const P = [['Indemnización', 0.0972], ['Aguinaldo', 0.0833], ['Bono 14', 0.0833], ['Vacaciones', 0.0417]];
      const filas = act.map((e) => { const s = num(e.salario_base); const v = P.map(([, t]) => s * t); return { valores: [String(e.codigo), nombre(e), deptoTxt(B, e.departamento_id), r2(s), ...v.map(r2), r2(sum(v))] }; });
      filas.push({ valores: [`Total (${act.length})`, '', '', r2(sum(act.map((e) => e.salario_base))), ...P.map(([, t]) => r2(sum(act.map((e) => num(e.salario_base) * t)))), r2(sum(act.map((e) => num(e.salario_base) * 0.3055)))], tipo: 'total' });
      return { ...base([`Mes: ${MES[f.mes - 1]} ${f.anio}`, 'Indemnización 9.72 % · aguinaldo 8.33 % · Bono 14 8.33 % · vacaciones 4.17 %']), columnas: [col('Código', 'texto', 8), col('Empleado', 'texto', 30), col('Departamento', 'texto', 22), col('Salario', 'monto', 12), ...P.map(([t]) => col(t, 'monto', 12)), col('Total provisión', 'monto', 14)], filas, vacio: 'No hay empleados activos.' };
    }
    function pintar() {
      const c = cfg;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="cl-banda">${esc(c.titulo)} · ${esc(c.parametros.join(' · '))}</div>
        ${id === 'nom-boletas' && c.p ? '<p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> «PDF» imprime una boleta por empleado (dos por hoja) con ingresos, descuentos, líquido y firma de recibido.</p>' : ''}${tabla(c, f.graficas)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    function boletas() {
      const p = cfg.p; if (!p || !lineas.length) return window.FIN.aviso('Elige una planilla con empleados');
      const fila = (t, v) => (num(v) ? `<tr><td>${esc(t)}</td><td class="n">${fmt.monto(v)}</td></tr>` : '');
      const html = lineas.map((l) => { const e = emp(l.empleado_id); return `<div class="boleta"><h3>Boleta de pago · ${esc(empresaDe(ctx))}</h3><p><b>${esc(nombre(e))}</b> · código ${e?.codigo} · ${esc(deptoTxt(B, l.departamento_id))}<br>Planilla ${p.numero} · ${p.tipo} · ${MES[p.mes - 1]} ${p.anio}${p.quincena ? ` · ${p.quincena}.ª quincena` : ''} · ${num(l.dias)} días · pago ${fmt.fechaDia(p.fecha_pago)}</p>
        <div class="cols"><table><tr><th colspan="2">Ingresos</th></tr>${fila('Salario ordinario', l.salario)}${fila(`Horas extra (${num(l.horas_extra)})`, l.monto_horas_extra)}${fila('Bonificación incentivo', l.bonificacion)}${fila('Otros ingresos', l.otros_ingresos)}${fila('Prestaciones', l.prestaciones)}<tr class="t"><td>Total ingresos</td><td class="n">${fmt.monto(l.total_ingresos)}</td></tr></table>
        <table><tr><th colspan="2">Descuentos</th></tr>${fila('IGSS laboral', l.igss_laboral)}${fila('ISR', l.isr)}${fila('Préstamos y anticipos', l.prestamos)}${fila('Otros descuentos', l.otros_descuentos)}<tr class="t"><td>Total descuentos</td><td class="n">${fmt.monto(l.total_descuentos)}</td></tr></table></div>
        <p class="liq">Líquido a recibir: <b>Q ${fmt.monto(l.liquido)}</b></p><div class="firmas"><div>Recibí conforme: ${esc(nombre(e))}</div><div>Autorizó</div></div></div>`; }).join('');
      imprimir(`Boletas de pago · planilla ${p.numero}`, `<style>.boleta{border:1px solid #999;border-radius:6px;padding:10px 14px;margin:0 0 10px;break-inside:avoid;font-size:11px}.boleta h3{margin:0 0 4px;font-size:13px}.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.boleta table{width:100%;border-collapse:collapse}.boleta td,.boleta th{border:1px solid #ccc;padding:2px 6px}.boleta .n{text-align:right}.boleta tr.t td{font-weight:bold}.liq{font-size:13px;text-align:right;margin:6px 0}.firmas{margin-top:26px}</style>${html}`, { orgId: ctx.sel.org, locId: ctx.sel.loc });
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); const n = e.target.name; if (!e.target.closest('.bk-filtros')) return; if (['anio', 'mes'].includes(n)) { f[n] = Number(e.target.value) || f[n]; return cargar(); } if (n === 'pla' || n === 'empleado') { f[n] = e.target.value; return cargar(); } if (n === 'graficas') { f.graficas = e.target.checked; pintar(); } });
    cont.addEventListener('click', (e) => { const ex = e.target.closest('[data-exp]'); if (!ex) return; if (id === 'nom-boletas' && ex.dataset.exp === 'PDF') return boletas(); exportar(cfg, ex.dataset.exp, f.graficas); });
    iniciar();
  }
  Object.keys(DEF).forEach((k) => { window.PANTALLAS[k] = (cont) => reporte(cont, k); });
})();
