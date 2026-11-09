// Hospital y Clínicas médicas · etapa 3 (script 163): reportería e integración administrativa y financiera.
// Reportes clínicos (egresos, mortalidad, obstetricia, emergencia), quirúrgicos y de apoyo (cirugías, laboratorio e
// imagen, farmacia), financieros (rentabilidad por servicio, aseguradoras, retenciones de ISR a médicos, personal) y el
// tablero gerencial; integración contable diaria del hospital por centro de costo y depósito de cierres de caja.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const S = () => window.SALUD;
  const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
  const prom = (a) => (a.length ? sum(a) / a.length : 0);
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const q = (n) => `Q ${fmt.monto(n)}`;
  const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)} %` : '—');
  const G = () => window.GRAFICAS;
  const hoy = () => fmt.hoy();
  const errorTxt = (e) => window.UI.traducirError(e);
  const ini = (d) => `${d}T00:00:00-06:00`, fin = (d) => `${d}T23:59:59.999-06:00`;
  const dia = (v) => (v ? new Date(v).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }) : '');
  const horasEntre = (a, b) => (a && b ? (new Date(b) - new Date(a)) / 3600000 : null);
  const diasEntre = (a, b) => Math.max(0, Math.round((new Date(`${String(b).slice(0, 10)}T12:00:00`) - new Date(`${String(a).slice(0, 10)}T12:00:00`)) / 864e5));
  const meses = (f) => { const out = []; let d = f.desde.slice(0, 7); while (d <= f.hasta.slice(0, 7) && out.length < 36) { out.push(d); const [y, m] = d.split('-').map(Number); d = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; } return out; };
  const mesTxt = (ym) => MES[Number(ym.slice(5, 7)) - 1].slice(0, 3);
  const edadEn = (fn, al) => { if (!fn) return null; const a = new Date(`${fn}T12:00:00`), b = new Date(`${al}T12:00:00`); let e = b.getFullYear() - a.getFullYear(); if (b < new Date(b.getFullYear(), a.getMonth(), a.getDate())) e--; return e; };
  const falta = (ctx, e) => { ctx.pDet.innerHTML = `<p class="vacio">${/hos_|cli_|med_|lab_|img_|far_/.test(e?.message || '') ? 'Faltan los scripts de Hospital y clínicas (161 a 163) en Supabase.' : esc(errorTxt(e))}</p>`; };
  function tabla(c, graficas = true) {
    const n = c.columnas.length + (c.acciones ? 1 : 0);
    const gs = graficas ? (c.graficas || []).filter(Boolean) : [];
    return `<div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${c.columnas.map((x) => `<th class="${x.tipo === 'texto' ? '' : 'num'}">${esc(x.titulo)}</th>`).join('')}${c.acciones ? '<th></th>' : ''}</tr></thead><tbody>
      ${c.filas.length ? c.filas.map((r) => (r.tipo === 'grupo' ? `<tr class="pr-g"><td colspan="${n}">${esc(r.valores[0])}</td></tr>` : `<tr class="${r.tipo === 'total' ? 'pr-t' : r.tipo === 'subtotal' ? 'pr-s' : ''}${r.resaltar ? ' pr-alerta' : ''}">${c.columnas.map((x, i) => (x.tipo === 'porcentaje' && typeof r.valores[i] === 'number' ? `<td class="num">${(r.valores[i] * 100).toFixed(1)} %</td>` : S().celda(r.valores[i], x))).join('')}${c.acciones ? `<td class="cli-acc">${r.acciones || ''}</td>` : ''}</tr>`)).join('') : `<tr><td colspan="${n}" class="tk-vacio">${esc(c.vacio || 'Sin información en el período.')}</td></tr>`}</tbody></table>
      ${gs.length && c.filas.length ? `<section class="pr-graficas"><h3><i class="ti ti-chart-bar" aria-hidden="true"></i> Gráficas</h3>${gs.join('')}</section>` : ''}</div>`;
  }
  function exportar(c, formato, graficas) {
    if (!c || !c.filas.length) return window.FIN.aviso('No hay información para imprimir');
    const gs = graficas ? (c.graficas || []).filter(Boolean) : [];
    const s = { ...c, filas: c.filas.map((r) => (r.tipo === 'grupo' ? { valores: [r.valores[0]], tipo: 'grupo', combinar: true } : { ...r, resaltar: r.resaltar ? 1 : undefined, valores: r.valores.map((v) => (typeof v === 'string' && v.startsWith('¤') ? v.slice(1) : v)) })) };
    if (formato === 'PDF') return window.CUENTAS_XLSX.pdf({ ...s, graficas: gs.join('') });
    Promise.all(gs.map((g) => G().png(g))).then((imagenes) => window.REPORTE_XLSX.generar({ ...s, imagenes })).catch((e) => window.FIN.aviso(e.message || 'No se pudo generar el Excel'));
  }
  // Reporte con fechas, gráficas, KPIs, PDF y Excel.
  function reporte(cont, op) {
    const ctx = montar(cont, { titulo: op.titulo, icono: op.icono, clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: op.grupo || 'Hospital y clínicas · Reportes' });
    const f = { desde: `${hoy().slice(0, 4)}-01-01`, hasta: hoy(), graficas: true, ...(op.f || {}) }; let B = null, D = null, cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', op.icono); return; }
      ctx.filtros(`<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}" max="${hoy()}"></label>${op.filtros ? op.filtros(f) : ''}<label class="pc-check"><input type="checkbox" name="graficas" ${f.graficas ? 'checked' : ''}> Gráficas</label>`, S().botonesExp);
      ctx.pDet.innerHTML = '<p class="vacio">Leyendo la información…</p>';
      try { B = await S().base(ctx); D = await op.leer(ctx, f, B); } catch (e) { return falta(ctx, e); }
      pintar();
    }
    function pintar() {
      let c; try { c = op.construir(f, B, D, ctx); } catch (e) { ctx.pDet.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }
      cfg = { titulo: op.titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: op.titulo.slice(0, 30), archivo: `${op.archivo}_${f.hasta}`, parametros: [`Empresa: ${S().empresaDe(ctx)}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, ...(c.extra || [])], ...c };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="cl-banda">${esc(op.titulo)} · ${esc(cfg.parametros.slice(0, 2).join(' · '))}</div>${op.ayuda ? `<p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> ${op.ayuda}</p>` : ''}<div class="ec-kpis">${(c.kpis || []).map(([t, v, k]) => kpi(t, v, k)).join('')}</div>${tabla(cfg, f.graficas)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); const n = e.target.name; if (!n) return; if (n === 'graficas') { f.graficas = e.target.checked; return pintar(); } f[n] = e.target.value; if (op.repintar?.includes(n)) return pintar(); cargar(); });
    cont.addEventListener('click', (e) => { const ex = e.target.closest('[data-exp]'); if (ex) exportar(cfg, ex.dataset.exp, f.graficas); });
    iniciar();
  }
  const sb = (ctx) => ctx.sb;
  const egresosDe = (ctx, f) => S().leerTodo(() => sb(ctx).from('hos_admisiones').select('id, numero, paciente_id, medico_id, tipo, fecha_ingreso, fecha_egreso, tipo_egreso, diagnostico_egreso, diagnostico_ingreso, total_cargos, parte_paciente, parte_aseguradora, aseguradora_id, cama_id, estado').eq('localidad_id', ctx.sel.loc).neq('estado', 'ANULADA').gte('fecha_egreso', ini(f.desde)).lte('fecha_egreso', fin(f.hasta)).order('id'));
  const grupoEdad = (e) => (e == null ? 'Sin dato' : e < 1 ? '< 1' : e < 5 ? '1-4' : e < 15 ? '5-14' : e < 45 ? '15-44' : e < 65 ? '45-64' : '65+');
  const GE = ['< 1', '1-4', '5-14', '15-44', '45-64', '65+'];

  // ===================== Clínicos =====================
  window.PANTALLAS['med-rep-egresos'] = (cont) => reporte(cont, { titulo: 'Morbilidad de egresos y estancia', icono: 'ti-report-medical', archivo: 'morbilidad_egresos',
    ayuda: 'Egresos hospitalarios del período agrupados por diagnóstico de egreso (CIE-10 de la epicrisis o el diagnóstico registrado al egresar), con días de estancia, edad, sexo y condición de egreso.',
    leer: async (ctx, f) => { const eg = await egresosDe(ctx, f); const ids = eg.map((a) => a.id).concat([0]); const { data: ep } = await sb(ctx).from('hos_epicrisis').select('admision_id, diagnostico_codigo, diagnostico_egreso, condicion_egreso').in('admision_id', ids); return { eg, ep: ep || [] }; },
    construir: (f, B, D) => {
      const m = new Map();
      D.eg.forEach((a) => { const e = D.ep.find((x) => x.admision_id === a.id); const k = (e?.diagnostico_codigo ? `${e.diagnostico_codigo} · ${e.diagnostico_egreso || ''}` : (e?.diagnostico_egreso || a.diagnostico_egreso || a.diagnostico_ingreso || 'SIN DIAGNÓSTICO')).toUpperCase().slice(0, 70);
        const p = B.pacientes.find((x) => x.id === a.paciente_id); const x = m.get(k) || { n: 0, dias: [], M: 0, F: 0, fall: 0, g: {} }; x.n++; x.dias.push(Math.max(1, diasEntre(a.fecha_ingreso, a.fecha_egreso))); if (p?.genero) x[p.genero]++; if (a.tipo_egreso === 'DEFUNCIÓN' || e?.condicion_egreso === 'FALLECIDO') x.fall++; const ge = grupoEdad(edadEn(p?.fecha_nacimiento, String(a.fecha_egreso).slice(0, 10))); x.g[ge] = (x.g[ge] || 0) + 1; m.set(k, x); });
      const xs = [...m.entries()].sort((a, b) => b[1].n - a[1].n); const tot = D.eg.length, dTot = sum(D.eg.map((a) => Math.max(1, diasEntre(a.fecha_ingreso, a.fecha_egreso))));
      const filas = xs.map(([k, x], i) => ({ valores: [i + 1, k, x.n, tot ? x.n / tot : 0, r2(prom(x.dias)), Math.max(...x.dias), x.M, x.F, ...GE.map((g) => x.g[g] || 0), x.fall], resaltar: prom(x.dias) > 7 }));
      filas.push({ valores: ['', 'Total', tot, 1, tot ? r2(dTot / tot) : 0, '', sum(xs.map(([, x]) => x.M)), sum(xs.map(([, x]) => x.F)), ...GE.map((g) => sum(xs.map(([, x]) => x.g[g] || 0))), sum(xs.map(([, x]) => x.fall))], tipo: 'total' });
      return { kpis: [['Egresos', tot], ['Días de estancia', dTot], ['Estancia promedio', tot ? `${(dTot / tot).toFixed(1)} días` : '—'], ['Diagnósticos distintos', m.size]],
        columnas: [col('#', 'numero', 4), col('Diagnóstico de egreso', 'texto', 42), col('Egresos', 'numero', 7), col('%', 'porcentaje', 7), col('Estancia prom.', 'numero', 8), col('Máx.', 'numero', 6), col('H', 'numero', 5), col('M', 'numero', 5), ...GE.map((g) => col(g, 'numero', 6)), col('Fallecidos', 'numero', 8)], filas,
        graficas: [G().barras('Principales diagnósticos de egreso', xs.slice(0, 10).map(([k, x]) => ({ etiqueta: k.slice(0, 40), valor: x.n, texto: String(x.n) })))] };
    } });
  window.PANTALLAS['med-rep-mortalidad'] = (cont) => reporte(cont, { titulo: 'Mortalidad hospitalaria', icono: 'ti-heart-broken', archivo: 'mortalidad',
    ayuda: 'Tasa bruta (defunciones / egresos × 100) y tasa neta (defunciones después de 48 horas / egresos × 100), por mes y por causa básica (CIE-10).',
    leer: async (ctx, f) => { const [eg, df] = await Promise.all([egresosDe(ctx, f), sb(ctx).from('hos_defunciones').select('*').eq('localidad_id', ctx.sel.loc).gte('fecha_hora', ini(f.desde)).lte('fecha_hora', fin(f.hasta)).order('fecha_hora')]); if (df.error) throw df.error; return { eg, df: df.data || [] }; },
    construir: (f, B, D) => {
      const ms = meses(f), filas = [{ valores: ['Por mes'], tipo: 'grupo' }];
      ms.forEach((m) => { const e = D.eg.filter((a) => dia(a.fecha_egreso).startsWith(m)).length, d = D.df.filter((x) => dia(x.fecha_hora).startsWith(m)), n = d.filter((x) => !x.menos_48h).length; filas.push({ valores: [`${MES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`, e, d.length, n, e ? d.length / e : 0, e ? n / e : 0], resaltar: e && d.length / e > 0.04 }); });
      const E = D.eg.length, Dn = D.df.length, N = D.df.filter((x) => !x.menos_48h).length;
      filas.push({ valores: ['Total', E, Dn, N, E ? Dn / E : 0, E ? N / E : 0], tipo: 'total' });
      filas.push({ valores: ['Por causa básica'], tipo: 'grupo' });
      const c = new Map(); D.df.forEach((x) => { const k = `${x.causa_basica_codigo || ''} ${x.causa_basica || ''}`.trim(); c.set(k, (c.get(k) || 0) + 1); });
      [...c.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => filas.push({ valores: [k, '', n, '', Dn ? n / Dn : 0, ''] }));
      return { kpis: [['Egresos', E], ['Defunciones', Dn, Dn ? 'ec-alerta' : ''], ['Tasa bruta', pct(Dn, E)], ['Tasa neta (> 48 h)', pct(N, E)]],
        columnas: [col('Período / causa', 'texto', 34), col('Egresos', 'numero', 9), col('Defunciones', 'numero', 10), col('Después de 48 h', 'numero', 10), col('Tasa bruta', 'porcentaje', 10), col('Tasa neta', 'porcentaje', 10)], filas,
        graficas: [G().columnas('Defunciones por mes', ms.map(mesTxt), [{ nombre: 'Defunciones', color: G().COLORES.NARANJA, valores: ms.map((m) => D.df.filter((x) => dia(x.fecha_hora).startsWith(m)).length) }])] };
    } });
  window.PANTALLAS['med-rep-obstetricia'] = (cont) => reporte(cont, { titulo: 'Partos y cesáreas', icono: 'ti-baby-carriage', archivo: 'obstetricia',
    ayuda: 'Nacimientos por mes y tipo de parto con el porcentaje de cesáreas, recién nacidos de bajo peso (< 2,500 g), prematuros (< 37 semanas) y APGAR bajo a los 5 minutos (< 7).',
    leer: async (ctx, f) => { const { data, error } = await sb(ctx).from('hos_partos').select('*').eq('localidad_id', ctx.sel.loc).gte('fecha_hora', ini(f.desde)).lte('fecha_hora', fin(f.hasta)).order('fecha_hora'); if (error) throw error; return data || []; },
    construir: (f, B, P) => {
      const ms = meses(f); const fila = (t, xs, tipo) => ({ valores: [t, xs.length, xs.filter((x) => x.tipo === 'EUTÓCICO').length, xs.filter((x) => x.tipo === 'CESÁREA').length, xs.filter((x) => ['DISTÓCICO', 'INSTRUMENTADO'].includes(x.tipo)).length, xs.length ? xs.filter((x) => x.tipo === 'CESÁREA').length / xs.length : 0, xs.filter((x) => x.rn_peso_g != null && x.rn_peso_g < 2500).length, xs.filter((x) => x.semanas_gestacion != null && x.semanas_gestacion < 37).length, xs.filter((x) => x.apgar_5 != null && x.apgar_5 < 7).length, xs.filter((x) => x.rn_condicion !== 'VIVO').length], tipo });
      const filas = ms.map((m) => fila(`${MES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`, P.filter((x) => dia(x.fecha_hora).startsWith(m)))); filas.push(fila('Total', P, 'total'));
      const pesos = P.map((x) => x.rn_peso_g).filter((x) => x != null);
      return { kpis: [['Nacimientos', P.length], ['Cesáreas', pct(P.filter((x) => x.tipo === 'CESÁREA').length, P.length), P.length && P.filter((x) => x.tipo === 'CESÁREA').length / P.length > 0.3 ? 'ec-alerta' : ''], ['Peso promedio', pesos.length ? `${Math.round(prom(pesos))} g` : '—'], ['Bajo peso', P.filter((x) => x.rn_peso_g != null && x.rn_peso_g < 2500).length]],
        columnas: [col('Mes', 'texto', 18), col('Nacimientos', 'numero', 9), col('Eutócicos', 'numero', 9), col('Cesáreas', 'numero', 9), col('Distócicos / instr.', 'numero', 10), col('% cesárea', 'porcentaje', 9), col('Bajo peso', 'numero', 8), col('Prematuros', 'numero', 9), col('APGAR 5 < 7', 'numero', 9), col('No vivos', 'numero', 8)], filas,
        graficas: [G().columnas('Partos por mes', ms.map(mesTxt), [{ nombre: 'Eutócicos', color: G().COLORES.VERDE, valores: ms.map((m) => P.filter((x) => dia(x.fecha_hora).startsWith(m) && x.tipo === 'EUTÓCICO').length) }, { nombre: 'Cesáreas', color: G().COLORES.NARANJA, valores: ms.map((m) => P.filter((x) => dia(x.fecha_hora).startsWith(m) && x.tipo === 'CESÁREA').length) }])] };
    } });
  window.PANTALLAS['med-rep-emergencia'] = (cont) => reporte(cont, { titulo: 'Emergencia y triaje', icono: 'ti-ambulance', archivo: 'emergencia',
    ayuda: 'Pacientes de emergencia por prioridad con el tiempo de espera promedio frente a la meta de cada nivel, el porcentaje atendido dentro de la meta y el destino del paciente.',
    leer: async (ctx, f) => { const { data, error } = await sb(ctx).from('hos_triaje').select('*').eq('localidad_id', ctx.sel.loc).gte('llegada', ini(f.desde)).lte('llegada', fin(f.hasta)).order('llegada'); if (error) throw error; return data || []; },
    construir: (f, B, T) => {
      const META = { 1: 0, 2: 10, 3: 60, 4: 120, 5: 240 }, NOM = { 1: 'Rojo · resucitación', 2: 'Naranja · emergencia', 3: 'Amarillo · urgencia', 4: 'Verde · menos urgente', 5: 'Azul · no urgente' }, DEST = ['ALTA', 'OBSERVACIÓN', 'HOSPITALIZACIÓN', 'CIRUGÍA', 'REFERENCIA', 'FALLECIDO', 'FUGA'];
      const esp = (x) => (x.atencion ? (new Date(x.atencion) - new Date(x.llegada)) / 60000 : null);
      const filas = [1, 2, 3, 4, 5].map((p) => { const xs = T.filter((x) => x.prioridad === p), es = xs.map(esp).filter((v) => v != null); return { valores: [`${p} · ${NOM[p]}`, xs.length, META[p], es.length ? Math.round(prom(es)) : '', es.length ? es.filter((v) => v <= Math.max(META[p], 1)).length / es.length : 0, ...DEST.map((d) => xs.filter((x) => x.destino === d).length)], resaltar: es.length && prom(es) > Math.max(META[p], 1) }; });
      const es = T.map(esp).filter((v) => v != null);
      filas.push({ valores: ['Total', T.length, '', es.length ? Math.round(prom(es)) : '', es.length ? T.filter((x) => esp(x) != null && esp(x) <= Math.max(META[x.prioridad], 1)).length / es.length : 0, ...DEST.map((d) => T.filter((x) => x.destino === d).length)], tipo: 'total' });
      return { kpis: [['Pacientes', T.length], ['Espera promedio', es.length ? `${Math.round(prom(es))} min` : '—'], ['Hospitalizados', pct(T.filter((x) => x.destino === 'HOSPITALIZACIÓN').length, T.length)], ['Sin atender', T.filter((x) => !x.atencion).length, T.some((x) => !x.atencion) ? 'ec-alerta' : '']],
        columnas: [col('Prioridad', 'texto', 24), col('Pacientes', 'numero', 8), col('Meta (min)', 'numero', 8), col('Espera prom. (min)', 'numero', 9), col('Dentro de meta', 'porcentaje', 9), ...DEST.map((d) => col(d.charAt(0) + d.slice(1).toLowerCase(), 'numero', 8))], filas,
        graficas: [G().barras('Pacientes por prioridad', [1, 2, 3, 4, 5].map((p) => ({ etiqueta: NOM[p], valor: T.filter((x) => x.prioridad === p).length, texto: String(T.filter((x) => x.prioridad === p).length) })))] };
    } });

  // ===================== Quirúrgicos y de apoyo =====================
  window.PANTALLAS['med-rep-cirugias'] = (cont) => reporte(cont, { titulo: 'Cirugías y uso de salas', icono: 'ti-scalpel', archivo: 'cirugias', f: { por: 'CIRUJANO' }, repintar: ['por'],
    filtros: (f) => `<label class="campo"><span>Agrupar por</span><select name="por">${[['CIRUJANO', 'Cirujano'], ['PROCEDIMIENTO', 'Procedimiento'], ['SALA', 'Sala'], ['ANESTESIA', 'Tipo de anestesia']].map(([x, t]) => `<option value="${x}" ${f.por === x ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`,
    ayuda: 'Cirugías del período con duración (incisión a cierre), horas de sala (ingreso a salida), urgencias, complicaciones, suspendidas y cumplimiento completo de la lista de verificación de cirugía segura de la OMS.',
    leer: async (ctx, f) => { const { data, error } = await sb(ctx).from('hos_cirugias').select('*').eq('localidad_id', ctx.sel.loc).gte('fecha', f.desde).lte('fecha', f.hasta).order('fecha'); if (error) throw error; return data || []; },
    construir: (f, B, C) => {
      const TOT = 18; const key = (c) => (f.por === 'CIRUJANO' ? S().nomMed(B, c.cirujano_id) || 'Sin cirujano' : f.por === 'PROCEDIMIENTO' ? S().nom(B.procedimientos, c.procedimiento_id, 'descripcion') || c.procedimiento_texto || 'Sin procedimiento' : f.por === 'SALA' ? S().nom(B.salas, c.sala_id) || 'Sin sala' : c.tipo_anestesia || 'Sin dato');
      const m = new Map(); C.forEach((c) => { const k = key(c); const a = m.get(k) || []; a.push(c); m.set(k, a); });
      const fila = (k, xs, tipo) => { const dur = xs.map((c) => horasEntre(c.incision, c.cierre)).filter((v) => v != null).map((v) => v * 60), sala = xs.map((c) => horasEntre(c.ingreso_sala, c.salida_sala)).filter((v) => v != null); return { valores: [k, xs.length, xs.filter((c) => c.clasificacion !== 'ELECTIVA').length, dur.length ? Math.round(prom(dur)) : '', r2(sum(sala)), xs.filter((c) => c.complicaciones).length, xs.filter((c) => c.estado === 'SUSPENDIDA').length, xs.length ? xs.filter((c) => Object.keys(c.checklist || {}).length >= TOT).length / xs.length : 0], tipo }; };
      const filas = [...m.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, xs]) => fila(k, xs)); filas.push(fila('Total', C, 'total'));
      return { extra: [`Agrupado por ${f.por.toLowerCase()}`], kpis: [['Cirugías', C.length], ['Urgencias', pct(C.filter((c) => c.clasificacion !== 'ELECTIVA').length, C.length)], ['Lista OMS completa', pct(C.filter((c) => Object.keys(c.checklist || {}).length >= TOT).length, C.length)], ['Con complicaciones', C.filter((c) => c.complicaciones).length, C.some((c) => c.complicaciones) ? 'ec-alerta' : '']],
        columnas: [col(f.por === 'CIRUJANO' ? 'Cirujano' : f.por === 'PROCEDIMIENTO' ? 'Procedimiento' : f.por === 'SALA' ? 'Sala' : 'Anestesia', 'texto', 34), col('Cirugías', 'numero', 8), col('Urgencias', 'numero', 8), col('Duración prom. (min)', 'numero', 10), col('Horas de sala', 'numero', 9), col('Complicaciones', 'numero', 9), col('Suspendidas', 'numero', 9), col('Lista OMS completa', 'porcentaje', 10)], filas,
        graficas: [G().barras('Cirugías', [...m.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 10).map(([k, xs]) => ({ etiqueta: k.slice(0, 40), valor: xs.length, texto: String(xs.length) })))] };
    } });
  window.PANTALLAS['med-rep-apoyo'] = (cont) => reporte(cont, { titulo: 'Laboratorio e imagen', icono: 'ti-microscope', archivo: 'apoyo_diagnostico',
    ayuda: 'Volumen de pruebas de laboratorio por área y prueba con los resultados críticos y el tiempo promedio de entrega (toma a entrega), y estudios de imagen por modalidad con los pendientes de informe.',
    leer: async (ctx, f) => { const [r, l, i] = await Promise.all([sb(ctx).from('lab_resultados').select('id, origen, toma, entrega, estado').eq('localidad_id', ctx.sel.loc).neq('estado', 'ANULADO').gte('toma', ini(f.desde)).lte('toma', fin(f.hasta)), S().leerTodo(() => sb(ctx).from('lab_resultado_lineas').select('prueba_id, alerta, lab_resultados!inner(localidad_id, toma, estado)').eq('lab_resultados.localidad_id', ctx.sel.loc).neq('lab_resultados.estado', 'ANULADO').gte('lab_resultados.toma', ini(f.desde)).lte('lab_resultados.toma', fin(f.hasta)).order('id')), sb(ctx).from('img_informes').select('estudio_id, estado, fecha').eq('localidad_id', ctx.sel.loc).neq('estado', 'ANULADO').gte('fecha', ini(f.desde)).lte('fecha', fin(f.hasta))]); if (r.error) throw r.error; return { r: r.data || [], l, i: i.data || [] }; },
    construir: (f, B, D) => {
      const filas = [{ valores: ['Laboratorio'], tipo: 'grupo' }]; const m = new Map();
      D.l.forEach((x) => { const p = B.pruebas.find((y) => y.id === x.prueba_id); const k = `${p?.area || 'OTRA'}|${p?.nombre || ''}`; const a = m.get(k) || { n: 0, c: 0, fuera: 0 }; a.n++; if (x.alerta === 'CRÍTICO') a.c++; if (['ALTO', 'BAJO', 'CRÍTICO'].includes(x.alerta)) a.fuera++; m.set(k, a); });
      [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, a]) => filas.push({ valores: [k.split('|')[0], k.split('|')[1], a.n, a.fuera, a.c], resaltar: a.c > 0 }));
      filas.push({ valores: ['Total laboratorio', '', D.l.length, sum([...m.values()].map((a) => a.fuera)), sum([...m.values()].map((a) => a.c))], tipo: 'total' });
      filas.push({ valores: ['Imagen'], tipo: 'grupo' }); const mi = new Map();
      D.i.forEach((x) => { const e = B.estudios.find((y) => y.id === x.estudio_id); const k = `${e?.modalidad || 'OTRA'}|${e?.nombre || ''}`; const a = mi.get(k) || { n: 0, p: 0 }; a.n++; if (x.estado === 'PENDIENTE') a.p++; mi.set(k, a); });
      [...mi.entries()].sort().forEach(([k, a]) => filas.push({ valores: [k.split('|')[0], k.split('|')[1], a.n, '', a.p ? `${a.p} pendientes` : ''] }));
      filas.push({ valores: ['Total imagen', '', D.i.length, '', ''], tipo: 'total' });
      const tat = D.r.map((x) => horasEntre(x.toma, x.entrega)).filter((v) => v != null);
      return { kpis: [['Órdenes de laboratorio', D.r.length], ['Pruebas', D.l.length], ['Críticos', D.l.filter((x) => x.alerta === 'CRÍTICO').length, 'ec-alerta'], ['Entrega promedio', tat.length ? `${prom(tat).toFixed(1)} h` : '—'], ['Estudios de imagen', D.i.length]],
        columnas: [col('Área / modalidad', 'texto', 18), col('Prueba / estudio', 'texto', 38), col('Cantidad', 'numero', 9), col('Fuera de rango', 'numero', 9), col('Críticos / pendientes', 'texto', 12)], filas,
        graficas: [G().barras('Pruebas por área', [...new Set([...m.keys()].map((k) => k.split('|')[0]))].map((a) => ({ etiqueta: a, valor: sum([...m.entries()].filter(([k]) => k.startsWith(`${a}|`)).map(([, x]) => x.n)), texto: String(sum([...m.entries()].filter(([k]) => k.startsWith(`${a}|`)).map(([, x]) => x.n))) })))] };
    } });
  window.PANTALLAS['med-rep-farmacia'] = (cont) => reporte(cont, { titulo: 'Consumo de farmacia', icono: 'ti-pill', archivo: 'consumo_farmacia', f: { por: 'PRODUCTO' }, repintar: ['por'],
    filtros: (f) => `<label class="campo"><span>Agrupar por</span><select name="por">${[['PRODUCTO', 'Producto'], ['PACIENTE', 'Paciente'], ['MES', 'Mes']].map(([x, t]) => `<option value="${x}" ${f.por === x ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`,
    ayuda: 'Medicamentos e insumos despachados a pacientes (neto de devoluciones) con su valor de venta, su costo de inventario y el margen.',
    leer: async (ctx, f) => { const cg = await S().leerTodo(() => sb(ctx).from('hos_cargos').select('admision_id, producto_id, descripcion, cantidad, precio, total, fecha, movimiento_id, hos_admisiones!inner(localidad_id, paciente_id)').eq('hos_admisiones.localidad_id', ctx.sel.loc).eq('origen', 'FARMACIA').gte('fecha', f.desde).lte('fecha', f.hasta).order('id'));
      const ids = cg.map((c) => c.movimiento_id).filter(Boolean); const mv = []; for (let i = 0; i < ids.length; i += 300) mv.push(...((await sb(ctx).from('inventario_movimientos').select('id, cantidad, costo_unitario').in('id', ids.slice(i, i + 300))).data || [])); return { cg, mv: new Map(mv.map((m) => [m.id, m])) }; },
    construir: (f, B, D) => {
      const key = (c) => (f.por === 'PRODUCTO' ? String(c.descripcion).replace(/^DEVOLUCIÓN: /, '') : f.por === 'PACIENTE' ? S().nomPac(B, c.hos_admisiones.paciente_id) : `${MES[Number(c.fecha.slice(5, 7)) - 1]} ${c.fecha.slice(0, 4)}`);
      const m = new Map(); D.cg.forEach((c) => { const k = key(c); const a = m.get(k) || { q: 0, v: 0, c: 0 }; const mv = D.mv.get(c.movimiento_id); a.q += num(c.cantidad) * (num(c.precio) < 0 ? -1 : 1); a.v += num(c.total); a.c += mv ? -num(mv.cantidad) * num(mv.costo_unitario) : 0; m.set(k, a); });
      const xs = [...m.entries()].sort((a, b) => (f.por === 'MES' ? 0 : b[1].v - a[1].v));
      const filas = xs.map(([k, a]) => ({ valores: [k, r2(a.q), r2(a.v), r2(a.c), r2(a.v - a.c), a.v ? (a.v - a.c) / a.v : 0], resaltar: a.v > 0 && a.c > a.v }));
      const V = sum(xs.map(([, a]) => a.v)), C = sum(xs.map(([, a]) => a.c));
      filas.push({ valores: ['Total', r2(sum(xs.map(([, a]) => a.q))), r2(V), r2(C), r2(V - C), V ? (V - C) / V : 0], tipo: 'total' });
      return { extra: [`Agrupado por ${f.por.toLowerCase()}`], kpis: [['Venta de farmacia', q(V), 'ec-fin'], ['Costo', q(C)], ['Margen', q(V - C)], ['Margen %', pct(V - C, V)]],
        columnas: [col(f.por === 'PRODUCTO' ? 'Producto' : f.por === 'PACIENTE' ? 'Paciente' : 'Mes', 'texto', 44), col('Cantidad', 'numero', 9), col('Venta Q', 'monto', 13), col('Costo Q', 'monto', 13), col('Margen Q', 'monto', 13), col('Margen %', 'porcentaje', 9)], filas,
        graficas: [G().barras('Principales por venta (Q)', xs.slice(0, 10).map(([k, a]) => ({ etiqueta: k.slice(0, 40), valor: a.v, texto: q(a.v) })))] };
    } });

  // ===================== Financieros =====================
  const GRUPO = (t) => (['HABITACIÓN'].includes(t) ? 'Habitación (día-cama)' : ['MEDICAMENTO', 'INSUMO'].includes(t) ? 'Farmacia e insumos' : ['LABORATORIO', 'IMAGENOLOGÍA', 'IMAGEN'].includes(t) ? 'Laboratorio e imagen' : ['QUIRÓFANO', 'PROCEDIMIENTO'].includes(t) ? 'Procedimientos y quirófano' : t === 'HONORARIO' ? 'Honorarios médicos' : ['CONSULTA', 'RECONSULTA'].includes(t) ? 'Consultas' : 'Otros servicios');
  window.PANTALLAS['med-rep-rentabilidad'] = (cont) => reporte(cont, { titulo: 'Rentabilidad por servicio', icono: 'ti-chart-pie', archivo: 'rentabilidad_servicio',
    ayuda: 'Ingresos del hospital (cargos a cuentas) y de la clínica (cobros) por línea de servicio con su costo directo: costo de inventario de farmacia e insumos y los honorarios médicos que se trasladan al médico. El margen es la contribución de cada línea antes de gastos generales.',
    leer: async (ctx, f) => { const [hc, cl, hh, ch] = await Promise.all([S().leerTodo(() => sb(ctx).from('hos_cargos').select('tipo, total, movimiento_id, hos_admisiones!inner(localidad_id, estado)').eq('hos_admisiones.localidad_id', ctx.sel.loc).neq('hos_admisiones.estado', 'ANULADA').gte('fecha', f.desde).lte('fecha', f.hasta).order('id')),
        S().leerTodo(() => sb(ctx).from('cli_cobro_lineas').select('tipo, total, reconocido, movimiento_id, cli_cobros!inner(localidad_id, estado, fecha)').eq('cli_cobros.localidad_id', ctx.sel.loc).eq('cli_cobros.estado', 'PAGADO').gte('cli_cobros.fecha', f.desde).lte('cli_cobros.fecha', f.hasta).order('id')),
        sb(ctx).from('hos_honorarios').select('bruto, participacion_hospital, estado').eq('localidad_id', ctx.sel.loc).neq('estado', 'ANULADA').gte('hasta', f.desde).lte('hasta', f.hasta), sb(ctx).from('cli_honorarios').select('bruto, participacion_clinica, estado').eq('localidad_id', ctx.sel.loc).neq('estado', 'ANULADA').gte('hasta', f.desde).lte('hasta', f.hasta)]);
      const ids = [...hc, ...cl].map((c) => c.movimiento_id).filter(Boolean); const mv = []; for (let i = 0; i < ids.length; i += 300) mv.push(...((await sb(ctx).from('inventario_movimientos').select('id, cantidad, costo_unitario').in('id', ids.slice(i, i + 300))).data || []));
      return { hc, cl, hh: hh.data || [], ch: ch.data || [], mv: new Map(mv.map((m) => [m.id, m])) }; },
    construir: (f, B, D) => {
      const m = new Map(); const add = (origen, t, v, c) => { const k = `${origen}|${GRUPO(t)}`; const a = m.get(k) || { v: 0, c: 0 }; a.v += v; a.c += c; m.set(k, a); };
      const costo = (id) => { const x = D.mv.get(id); return x ? -num(x.cantidad) * num(x.costo_unitario) : 0; };
      D.hc.forEach((c) => add('Hospital', c.tipo, num(c.total), costo(c.movimiento_id) + (c.tipo === 'HONORARIO' ? num(c.total) : 0)));
      D.cl.filter((l) => l.tipo !== 'PAQUETE').forEach((l) => add('Clínica', l.tipo, num(l.total) + num(l.reconocido), costo(l.movimiento_id)));
      // Honorarios de la clínica: lo que se liquida al médico (bruto menos participación) es costo de las consultas.
      const honC = sum(D.ch.map((h) => num(h.bruto) - num(h.participacion_clinica))); if (honC) { const k = 'Clínica|Consultas'; const a = m.get(k) || { v: 0, c: 0 }; a.c += honC; m.set(k, a); }
      // En el hospital la participación sobre honorarios es ingreso propio.
      const partH = sum(D.hh.map((h) => h.participacion_hospital)); if (partH) { const k = 'Hospital|Honorarios médicos'; const a = m.get(k) || { v: 0, c: 0 }; a.c -= partH; m.set(k, a); }
      const filas = []; let org = null;
      [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, a]) => { const [o, g] = k.split('|'); if (o !== org) { filas.push({ valores: [o], tipo: 'grupo' }); org = o; } filas.push({ valores: [g, r2(a.v), r2(a.c), r2(a.v - a.c), a.v ? (a.v - a.c) / a.v : 0], resaltar: a.v - a.c < 0 }); });
      const V = sum([...m.values()].map((a) => a.v)), C = sum([...m.values()].map((a) => a.c));
      filas.push({ valores: ['Total', r2(V), r2(C), r2(V - C), V ? (V - C) / V : 0], tipo: 'total' });
      return { kpis: [['Ingresos', q(V), 'ec-fin'], ['Costo directo', q(C)], ['Contribución', q(V - C)], ['Margen', pct(V - C, V)]],
        columnas: [col('Línea de servicio', 'texto', 34), col('Ingresos Q', 'monto', 14), col('Costo directo Q', 'monto', 14), col('Contribución Q', 'monto', 14), col('Margen %', 'porcentaje', 9)], filas,
        graficas: [G().barras('Contribución por línea (Q)', [...m.entries()].map(([k, a]) => ({ etiqueta: k.replace('|', ' · '), valor: Math.max(0, a.v - a.c), texto: q(a.v - a.c) })).sort((a, b) => b.valor - a.valor), G().COLORES.VERDE)] };
    } });
  window.PANTALLAS['med-rep-aseguradoras'] = (cont) => reporte(cont, { titulo: 'Facturación y cartera por aseguradora', icono: 'ti-shield-heart', archivo: 'cartera_aseguradoras', f: { desde: `${Number(hoy().slice(0, 4)) - 1}-01-01` },
    ayuda: 'Por aseguradora: lo reclamado por el hospital y la clínica, lo aprobado, lo pagado, las glosas y el saldo pendiente, con la antigüedad del saldo y las facturas de crédito emitidas desde las cuentas.',
    leer: async (ctx, f) => { const L = ctx.sel.loc; const [hr, cr, gl, fa] = await Promise.all([sb(ctx).from('hos_reclamos').select('aseguradora_id, fecha, monto, monto_aprobado, monto_pagado, estado').eq('localidad_id', L).gte('fecha', f.desde).lte('fecha', f.hasta), sb(ctx).from('cli_reclamos').select('aseguradora_id, fecha, monto, monto_aprobado, monto_pagado, glosa, estado').eq('localidad_id', L).gte('fecha', f.desde).lte('fecha', f.hasta),
        sb(ctx).from('med_glosas').select('aseguradora_id, monto, monto_recuperado, estado').eq('localidad_id', L).gte('fecha', f.desde).lte('fecha', f.hasta), sb(ctx).from('hos_admisiones').select('aseguradora_id, factura_aseguradora_id, parte_aseguradora').eq('localidad_id', L).not('factura_aseguradora_id', 'is', null)]);
      if (gl.error) throw gl.error; return { hr: hr.data || [], cr: cr.data || [], gl: gl.data || [], fa: fa.data || [] }; },
    construir: (f, B, D) => {
      const ids = [...new Set([...D.hr, ...D.cr, ...D.gl].map((x) => x.aseguradora_id))];
      const filas = ids.map((id) => { const rs = [...D.hr.filter((x) => x.aseguradora_id === id).map((x) => ({ ...x, o: 'H' })), ...D.cr.filter((x) => x.aseguradora_id === id).map((x) => ({ ...x, o: 'C' }))];
        const recl = sum(rs.map((x) => x.monto)), apr = sum(rs.map((x) => x.monto_aprobado ?? x.monto)), pag = sum(rs.map((x) => x.monto_pagado)), glo = sum(D.gl.filter((g) => g.aseguradora_id === id).map((g) => g.monto)) + sum(D.cr.filter((x) => x.aseguradora_id === id).map((x) => x.glosa));
        const pend = rs.filter((x) => !['PAGADO', 'RECHAZADO'].includes(x.estado)), saldo = (x) => num(x.monto_aprobado ?? x.monto) - num(x.monto_pagado); const ant = (a, b) => sum(pend.filter((x) => diasEntre(x.fecha, hoy()) >= a && diasEntre(x.fecha, hoy()) <= b).map(saldo));
        return { valores: [S().nom(B.aseguradoras, id) || 'Sin aseguradora', rs.length, r2(recl), r2(apr), r2(pag), r2(glo), recl ? glo / recl : 0, r2(ant(0, 30)), r2(ant(31, 60)), r2(ant(61, 90)), r2(ant(91, 99999)), r2(sum(pend.map(saldo)))], resaltar: ant(91, 99999) > 0 }; }).sort((a, b) => b.valores[11] - a.valores[11]);
      const T = (i) => r2(sum(filas.map((r) => r.valores[i])));
      filas.push({ valores: ['Total', T(1), T(2), T(3), T(4), T(5), T(2) ? T(5) / T(2) : 0, T(7), T(8), T(9), T(10), T(11)], tipo: 'total' });
      return { kpis: [['Reclamado', q(T(2))], ['Pagado', q(T(4)), 'ec-fin'], ['Glosas', q(T(5)), T(5) ? 'ec-alerta' : ''], ['Saldo pendiente', q(T(11))], ['Facturas a aseguradoras', D.fa.length]],
        columnas: [col('Aseguradora', 'texto', 24), col('Reclamos', 'numero', 7), col('Reclamado', 'monto', 12), col('Aprobado', 'monto', 12), col('Pagado', 'monto', 12), col('Glosas', 'monto', 11), col('% glosa', 'porcentaje', 7), col('0-30', 'monto', 11), col('31-60', 'monto', 11), col('61-90', 'monto', 11), col('> 90', 'monto', 11), col('Saldo', 'monto', 12)], filas,
        graficas: [G().barras('Saldo pendiente por aseguradora (Q)', filas.slice(0, -1).map((r) => ({ etiqueta: r.valores[0], valor: r.valores[11], texto: q(r.valores[11]) })), G().COLORES.NARANJA)] };
    } });
  window.PANTALLAS['med-rep-retenciones'] = (cont) => reporte(cont, { titulo: 'Retenciones de ISR a médicos', icono: 'ti-receipt-tax', archivo: 'retenciones_isr_medicos', f: { desde: `${hoy().slice(0, 8)}01` },
    ayuda: 'Honorarios liquidados a cada médico (hospital y clínica) con la retención de ISR practicada, por NIT y mes: base para la declaración de retenciones y las constancias que se entregan al médico (Integraciones SAT).',
    leer: async (ctx, f) => { const [h, c] = await Promise.all([sb(ctx).from('hos_honorarios').select('numero, medico_id, desde, hasta, bruto, participacion_hospital, retencion_isr, liquido, estado').eq('localidad_id', ctx.sel.loc).neq('estado', 'ANULADA').gte('hasta', f.desde).lte('hasta', f.hasta), sb(ctx).from('cli_honorarios').select('numero, medico_id, desde, hasta, bruto, participacion_clinica, retencion_isr, liquido, estado').eq('localidad_id', ctx.sel.loc).neq('estado', 'ANULADA').gte('hasta', f.desde).lte('hasta', f.hasta)]); if (c.error) throw c.error; return [...(h.data || []).map((x) => ({ ...x, o: 'Hospital', part: x.participacion_hospital })), ...(c.data || []).map((x) => ({ ...x, o: 'Clínica', part: x.participacion_clinica }))]; },
    construir: (f, B, X) => {
      const m = new Map(); X.forEach((x) => { const a = m.get(x.medico_id) || { n: 0, bruto: 0, part: 0, base: 0, ret: 0, liq: 0 }; a.n++; a.bruto += num(x.bruto); a.part += num(x.part); a.base += num(x.bruto) - num(x.part); a.ret += num(x.retencion_isr); a.liq += num(x.liquido); m.set(x.medico_id, a); });
      const filas = [...m.entries()].map(([id, a]) => { const me = B.medicos.find((y) => y.id === id) || {}; return { valores: [me.nombre || 'Sin médico', me.nit || '', me.colegiado || '', a.n, r2(a.bruto), r2(a.part), r2(a.base), r2(a.ret), r2(a.liq)], resaltar: !me.nit }; }).sort((a, b) => b.valores[7] - a.valores[7]);
      const T = (i) => r2(sum(filas.map((r) => r.valores[i])));
      filas.push({ valores: ['Total', '', '', T(3), T(4), T(5), T(6), T(7), T(8)], tipo: 'total' });
      return { kpis: [['Médicos', m.size], ['Base de retención', q(T(6))], ['ISR retenido', q(T(7)), 'ec-fin'], ['Sin NIT', filas.filter((r) => r.resaltar).length, filas.some((r) => r.resaltar) ? 'ec-alerta' : '']],
        columnas: [col('Médico', 'texto', 28), col('NIT', 'texto', 12), col('Colegiado', 'texto', 10), col('Liquidaciones', 'numero', 9), col('Honorarios Q', 'monto', 13), col('Participación Q', 'monto', 13), col('Base Q', 'monto', 13), col('ISR retenido Q', 'monto', 13), col('Líquido Q', 'monto', 13)], filas, firmas: ['Contador', 'Agente de retención'] };
    } });
  window.PANTALLAS['hos-rep-personal'] = (cont) => reporte(cont, { titulo: 'Personal por área y turno', icono: 'ti-users-group', archivo: 'personal_hospital', f: { desde: hoy() },
    ayuda: 'Personal de enfermería y apoyo por área y turno con su cargo; los que están enlazados a Nóminas muestran su puesto y salario base para el costo de personal por servicio.',
    leer: async (ctx) => { const [p, e] = await Promise.all([sb(ctx).from('hos_personal').select('*').eq('localidad_id', ctx.sel.loc).eq('activo', true).order('nombre'), sb(ctx).from('nom_empleados').select('*').eq('localidad_id', ctx.sel.loc)]); if (p.error) throw p.error; return { p: p.data || [], e: e.data || [] }; },
    construir: (f, B, D) => {
      const TUR = ['MAÑANA', 'TARDE', 'NOCHE', 'ROTATIVO']; const filas = []; let ar = null;
      const xs = [...D.p].sort((a, b) => S().nom(B.areas, a.area_id).localeCompare(S().nom(B.areas, b.area_id)) || TUR.indexOf(a.turno) - TUR.indexOf(b.turno));
      xs.forEach((x) => { const a = S().nom(B.areas, x.area_id) || 'Sin área'; if (a !== ar) { filas.push({ valores: [a], tipo: 'grupo' }); ar = a; } const e = D.e.find((y) => y.id === x.empleado_id); filas.push({ valores: [x.nombre, x.cargo, x.turno, x.registro || '', e ? `Empleado ${e.codigo ?? e.id}` : '', e ? r2(e.salario_base ?? e.salario ?? 0) : ''] }); });
      const sal = sum(D.p.map((x) => { const e = D.e.find((y) => y.id === x.empleado_id); return e ? num(e.salario_base ?? e.salario) : 0; }));
      return { extra: ['Personal activo'], kpis: [['Personal', D.p.length], ...TUR.slice(0, 3).map((t) => [t.charAt(0) + t.slice(1).toLowerCase(), D.p.filter((x) => x.turno === t).length]), ['Salario base mensual', q(sal)]],
        columnas: [col('Nombre', 'texto', 30), col('Cargo', 'texto', 24), col('Turno', 'texto', 10), col('Registro', 'texto', 12), col('Nómina', 'texto', 20), col('Salario base Q', 'monto', 13)], filas, vacio: 'Registra el personal en Catálogos › Formulario, dietas, salas y personal.',
        graficas: [G().columnas('Personal por turno', TUR, [{ nombre: 'Personal', color: G().COLORES.AZUL, valores: TUR.map((t) => D.p.filter((x) => x.turno === t).length) }])] };
    } });

  // ===================== Tablero gerencial =====================
  window.PANTALLAS['med-tablero'] = (cont) => reporte(cont, { titulo: 'Tablero gerencial', icono: 'ti-gauge', archivo: 'tablero_salud',
    ayuda: 'Indicadores de gestión hospitalaria y de la clínica: ocupación, estancia, giro de cama, ingreso por paciente-día, consultas, ausentismo, productividad médica, cirugías y cartera de aseguradoras.',
    leer: async (ctx, f) => { const L = ctx.sel.loc; const [cam, eg, dc, cg, cs, ci, cx, cob, hr, crl] = await Promise.all([sb(ctx).from('hos_camas').select('id').eq('localidad_id', L).eq('activo', true), egresosDe(ctx, f),
        S().leerTodo(() => sb(ctx).from('hos_cargos').select('fecha, hos_admisiones!inner(localidad_id)').eq('hos_admisiones.localidad_id', L).eq('origen', 'DÍA-CAMA').gte('fecha', f.desde).lte('fecha', f.hasta).order('id')),
        S().leerTodo(() => sb(ctx).from('hos_cargos').select('fecha, total, hos_admisiones!inner(localidad_id, estado)').eq('hos_admisiones.localidad_id', L).neq('hos_admisiones.estado', 'ANULADA').gte('fecha', f.desde).lte('fecha', f.hasta).order('id')),
        S().leerTodo(() => sb(ctx).from('cli_consultas').select('id, fecha, medico_id').eq('localidad_id', L).neq('estado', 'ANULADA').gte('fecha', ini(f.desde)).lte('fecha', fin(f.hasta)).order('id')),
        S().leerTodo(() => sb(ctx).from('cli_citas').select('estado').eq('localidad_id', L).gte('fecha', f.desde).lte('fecha', f.hasta).order('id')),
        sb(ctx).from('hos_cirugias').select('id').eq('localidad_id', L).gte('fecha', f.desde).lte('fecha', f.hasta),
        S().leerTodo(() => sb(ctx).from('cli_cobros').select('fecha, total, tipo').eq('localidad_id', L).eq('estado', 'PAGADO').gte('fecha', f.desde).lte('fecha', f.hasta).order('id')),
        sb(ctx).from('hos_reclamos').select('monto, monto_aprobado, monto_pagado, estado').eq('localidad_id', L), sb(ctx).from('cli_reclamos').select('monto, monto_aprobado, monto_pagado, estado').eq('localidad_id', L)]);
      return { camas: (cam.data || []).length, eg, dc, cg, cs, ci, cx: (cx.data || []).length, cob: cob.filter((c) => c.tipo === 'SERVICIOS'), rec: [...(hr.data || []), ...(crl.data || [])] }; },
    construir: (f, B, D) => {
      const nDias = Math.max(1, diasEntre(f.desde, f.hasta) + 1), diasCama = D.dc.length, ingH = sum(D.cg.map((c) => c.total)), ingC = sum(D.cob.map((c) => c.total));
      const estancia = D.eg.length ? sum(D.eg.map((a) => Math.max(1, diasEntre(a.fecha_ingreso, a.fecha_egreso)))) / D.eg.length : 0;
      const noA = D.ci.filter((c) => c.estado === 'NO ASISTIÓ').length, medicos = new Set(D.cs.map((c) => c.medico_id)).size;
      const cartera = sum(D.rec.filter((r) => !['PAGADO', 'RECHAZADO'].includes(r.estado)).map((r) => num(r.monto_aprobado ?? r.monto) - num(r.monto_pagado)));
      const I = [['Hospital', 'Camas habilitadas', D.camas, ''], ['Hospital', 'Porcentaje de ocupación', D.camas ? diasCama / (D.camas * nDias) : 0, 'pct'], ['Hospital', 'Egresos', D.eg.length, ''], ['Hospital', 'Promedio de estancia (días)', r2(estancia), ''],
        ['Hospital', 'Giro de cama (egresos por cama)', D.camas ? r2(D.eg.length / D.camas) : 0, ''], ['Hospital', 'Intervalo de sustitución (días)', D.eg.length ? r2((D.camas * nDias - diasCama) / D.eg.length) : 0, ''], ['Hospital', 'Ingreso por paciente-día (Q)', diasCama ? r2(ingH / diasCama) : 0, 'q'],
        ['Hospital', 'Cirugías', D.cx, ''], ['Hospital', 'Ingresos del hospital (Q)', r2(ingH), 'q'], ['Clínica', 'Consultas', D.cs.length, ''], ['Clínica', 'Consultas por día', r2(D.cs.length / nDias), ''], ['Clínica', 'Consultas por médico', medicos ? r2(D.cs.length / medicos) : 0, ''],
        ['Clínica', 'Ausentismo a citas', D.ci.length ? noA / D.ci.length : 0, 'pct'], ['Clínica', 'Ingresos de la clínica (Q)', r2(ingC), 'q'], ['Clínica', 'Ingreso por consulta (Q)', D.cs.length ? r2(ingC / D.cs.length) : 0, 'q'], ['Finanzas', 'Ingresos totales (Q)', r2(ingH + ingC), 'q'], ['Finanzas', 'Cartera pendiente de aseguradoras (Q)', r2(cartera), 'q']];
      const filas = []; let g = null; I.forEach(([gr, t, v, tp]) => { if (gr !== g) { filas.push({ valores: [gr], tipo: 'grupo' }); g = gr; } filas.push({ valores: [t, tp === 'pct' ? `${(v * 100).toFixed(1)} %` : tp === 'q' ? q(v) : v] }); });
      const ms = meses(f);
      return { kpis: [['Ocupación', D.camas ? pct(diasCama, D.camas * nDias) : '—'], ['Estancia promedio', `${estancia.toFixed(1)} días`], ['Consultas', D.cs.length], ['Ingresos', q(ingH + ingC), 'ec-fin'], ['Cartera aseguradoras', q(cartera), cartera ? 'ec-alerta' : '']],
        columnas: [col('Indicador', 'texto', 40), col('Valor', 'texto', 18)], filas,
        graficas: [G().columnas('Ingresos por mes (Q)', ms.map(mesTxt), [{ nombre: 'Hospital', color: G().COLORES.AZUL, valores: ms.map((m) => sum(D.cg.filter((c) => c.fecha.startsWith(m)).map((c) => c.total))) }, { nombre: 'Clínica', color: G().COLORES.VERDE, valores: ms.map((m) => sum(D.cob.filter((c) => c.fecha.startsWith(m)).map((c) => c.total))) }], (v) => fmt.monto(v)),
          D.camas ? G().columnas('Ocupación por mes (%)', ms.map(mesTxt), [{ nombre: 'Ocupación', color: G().COLORES.NARANJA, valores: ms.map((m) => { const dd = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate(); return r2((D.dc.filter((c) => c.fecha.startsWith(m)).length / (D.camas * dd)) * 100); }) }]) : null] };
    } });

  // ===================== Integración contable del hospital =====================
  window.PANTALLAS['hos-contabilidad'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Integración contable del hospital', icono: 'ti-arrows-join', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Hospital · Procesos' });
    const { sb: cli } = ctx;
    const f = { fecha: S().sumarDias(hoy(), -1) }; let B = null, K = null, P = null, centros = [], gen = null, cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-arrows-join'); return; }
      ctx.filtros(`<label class="campo"><span>Día</span><input type="date" name="fecha" value="${f.fecha}" max="${hoy()}"></label>`, `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="generar"><i class="ti ti-player-play" aria-hidden="true"></i> Generar partida del día</button>' : ''}${S().botonesExp}`);
      ctx.pDet.innerHTML = '<p class="vacio">Preparando la partida del día…</p>';
      try {
        B = await S().base(ctx); K = await window.CONTA.cuentasClave(ctx);
        const { data: ce } = await cli.from('centros_costo').select('id, codigo, nombre').eq('organizacion_id', ctx.sel.org).order('codigo'); centros = ce || [];
        const { data: g } = await cli.from('partidas_generadas').select('partida_id, partidas!inner(numero, estado)').eq('localidad_id', ctx.sel.loc).eq('origen', 'HOSPITAL').eq('referencia_id', Number(f.fecha.replace(/-/g, ''))).eq('partidas.estado', 'VIGENTE').maybeSingle(); gen = g || null;
        P = await preparar();
      } catch (e) { return falta(ctx, e); }
      pintar();
    }
    async function preparar() {
      const L = ctx.sel.loc, D = f.fecha;
      const [cg, pg, hh, fa, camas] = await Promise.all([S().leerTodo(() => cli.from('hos_cargos').select('admision_id, tipo, total, movimiento_id, hos_admisiones!inner(localidad_id, estado, cama_id)').eq('hos_admisiones.localidad_id', L).neq('hos_admisiones.estado', 'ANULADA').eq('fecha', D).order('id')),
        cli.from('hos_pagos').select('forma, tipo, monto').eq('localidad_id', L).eq('fecha', D), cli.from('hos_honorarios').select('participacion_hospital, retencion_isr, estado, creado_en').eq('localidad_id', L).neq('estado', 'ANULADA').gte('creado_en', ini(D)).lte('creado_en', fin(D)),
        cli.from('hos_admisiones').select('parte_aseguradora, factura_aseguradora_id, facturas_venta!hos_admisiones_factura_aseguradora_id_fkey(fecha_emision)').eq('localidad_id', L).not('factura_aseguradora_id', 'is', null), cli.from('hos_camas').select('id, area_id').eq('localidad_id', L)]);
      const ids = cg.map((c) => c.movimiento_id).filter(Boolean); const mv = []; for (let i = 0; i < ids.length; i += 300) mv.push(...((await cli.from('inventario_movimientos').select('id, cantidad, costo_unitario').in('id', ids.slice(i, i + 300))).data || []));
      const L2 = [], add = (clave, concepto, d, h, centro) => { if (r2(d) || r2(h)) L2.push({ clave, cuenta: K.cuenta(clave), concepto, debe: r2(d), haber: r2(h), centro_id: centro || null }); };
      const centroDe = (camaId) => B.areas.find((a) => a.id === (camas.data || []).find((c) => c.id === camaId)?.area_id)?.centro_id || null;
      const clave = (t) => (t === 'HABITACIÓN' ? 'HOS_INGRESO_HABITACION' : ['MEDICAMENTO', 'INSUMO'].includes(t) ? 'HOS_INGRESO_FARMACIA' : ['LABORATORIO', 'IMAGENOLOGÍA'].includes(t) ? 'HOS_INGRESO_APOYO' : ['QUIRÓFANO', 'PROCEDIMIENTO'].includes(t) ? 'HOS_INGRESO_PROCEDIMIENTOS' : 'HOS_INGRESO_OTROS');
      const tot = sum(cg.map((c) => c.total)); add('HOS_CUENTAS_PACIENTES', 'Cargos del día a cuentas de pacientes', Math.max(tot, 0), Math.max(-tot, 0));
      const ing = new Map(); let iva = 0, hon = 0;
      cg.forEach((c) => { if (c.tipo === 'HONORARIO') { hon += num(c.total); return; } const k = `${clave(c.tipo)}|${centroDe(c.hos_admisiones.cama_id) || ''}`; ing.set(k, (ing.get(k) || 0) + num(c.total)); });
      ing.forEach((v, k) => { const [cl, ce] = k.split('|'); const n = r2(v / 1.12); iva += v - n; add(cl, `Ingresos ${cl.replace('HOS_INGRESO_', '').toLowerCase()}`, Math.max(-n, 0), Math.max(n, 0), Number(ce) || null); });
      add('IVA_DEBITO', 'IVA débito fiscal', Math.max(-iva, 0), Math.max(iva, 0));
      add('HONORARIOS_POR_PAGAR', 'Honorarios médicos cargados a cuentas', Math.max(-hon, 0), Math.max(hon, 0));
      const costo = sum(cg.map((c) => { const m = mv.find((x) => x.id === c.movimiento_id); return m ? -num(m.cantidad) * num(m.costo_unitario) : 0; }));
      add('HOS_COSTO_FARMACIA', 'Costo de medicamentos e insumos despachados', Math.max(costo, 0), Math.max(-costo, 0)); add('INVENTARIO', 'Salida de inventario de farmacia', Math.max(-costo, 0), Math.max(costo, 0));
      const pf = (fm) => sum((pg.data || []).filter((p) => p.forma === fm).map((p) => (p.tipo === 'DEVOLUCIÓN' ? -1 : 1) * num(p.monto)));
      const caja = pf('EFECTIVO') + pf('CHEQUE'), banco = pf('TARJETA') + pf('TRANSFERENCIA') + pf('DEPÓSITO');
      add('HOS_CAJA', 'Anticipos y pagos en efectivo y cheque', Math.max(caja, 0), Math.max(-caja, 0)); add('HOS_BANCOS', 'Pagos con tarjeta, transferencia y depósito', Math.max(banco, 0), Math.max(-banco, 0)); add('HOS_CUENTAS_PACIENTES', 'Pagos aplicados a cuentas de pacientes', Math.max(-(caja + banco), 0), Math.max(caja + banco, 0));
      const facA = sum((fa.data || []).filter((x) => dia(x.facturas_venta?.fecha_emision) === D).map((x) => x.parte_aseguradora));
      add('ASEGURADORAS_CXC', 'Facturas a aseguradoras del día', facA, 0); add('HOS_CUENTAS_PACIENTES', 'Traslado a cuentas por cobrar de aseguradoras', 0, facA);
      const part = sum((hh.data || []).map((h) => h.participacion_hospital)), ret = sum((hh.data || []).map((h) => h.retencion_isr));
      add('HONORARIOS_POR_PAGAR', 'Participación y retención de honorarios liquidados', part + ret, 0); add('HOS_INGRESO_PARTICIPACION', 'Participación del hospital sobre honorarios', 0, part); add('RET_ISR', 'Retención de ISR a médicos', 0, ret);
      // Neto por cuenta y centro, y redondeo al IVA.
      const neto = new Map(); L2.forEach((x) => { const k = `${x.clave}|${x.centro_id || ''}`; const a = neto.get(k) || { ...x, debe: 0, haber: 0, concepto: x.concepto }; a.debe += x.debe; a.haber += x.haber; neto.set(k, a); });
      const out = [...neto.values()].map((x) => { const v = r2(x.debe - x.haber); return { ...x, debe: v > 0 ? v : 0, haber: v < 0 ? -v : 0 }; }).filter((x) => x.debe || x.haber);
      const dif = r2(sum(out.map((x) => x.debe)) - sum(out.map((x) => x.haber))); const iv = out.find((x) => x.clave === 'IVA_DEBITO'); if (dif && iv) iv.haber = r2(iv.haber + dif);
      return { L: out, cargos: cg.length, total: tot, costo };
    }
    function pintar() {
      const faltan = [...new Set(P.L.filter((x) => !x.cuenta).map((x) => x.clave))], td = sum(P.L.map((x) => x.debe)), th = sum(P.L.map((x) => x.haber));
      cfg = { titulo: `Partida diaria del hospital del ${fmt.fechaDia(f.fecha)}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Partida hospital', archivo: `partida_hospital_${f.fecha}`, parametros: [`Empresa: ${S().empresaDe(ctx)}`, `Día ${fmt.fechaDia(f.fecha)}`, gen ? `Generada: partida PI-${gen.partidas.numero}` : 'Pendiente de generar'],
        columnas: [col('Concepto', 'texto', 40), col('Clave', 'texto', 26), col('Cuenta', 'texto', 14), col('Centro de costo', 'texto', 18), col('Debe', 'monto', 14), col('Haber', 'monto', 14)],
        filas: [...P.L.map((x) => ({ valores: [x.concepto, x.clave, x.cuenta || 'SIN CONFIGURAR', centros.find((c) => c.id === x.centro_id)?.nombre || '', x.debe || '', x.haber || ''], resaltar: !x.cuenta })), { valores: ['Totales', '', '', '', r2(td), r2(th)], tipo: 'total' }] };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Cargos del día', P.cargos)}${kpi('Facturado a cuentas', q(P.total))}${kpi('Costo de farmacia', q(P.costo))}${kpi('Estado', gen ? `PI-${gen.partidas.numero}` : 'Pendiente', gen ? 'ec-fin' : 'ec-alerta')}${kpi('Cuadre', Math.abs(td - th) < 0.01 ? 'Cuadra' : `Dif. Q ${fmt.monto(td - th)}`, Math.abs(td - th) < 0.01 ? 'ec-fin' : 'ec-alerta')}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Partida de ingresos del día (tipo PI): los cargos van a cuentas de pacientes en proceso contra los ingresos netos por línea de servicio y centro de costo (según el área de la cama), el IVA y los honorarios por pagar; el costo de farmacia contra inventario; los pagos de caja contra las cuentas de pacientes; las facturas a aseguradoras pasan a su cuenta por cobrar; y la liquidación de honorarios reconoce la participación del hospital y la retención de ISR.
        ${faltan.length ? `<br><b class="pc-rojo">Configura en Contabilidad › Cuentas de integración: ${esc(faltan.join(', '))}.</b>` : ''}</p>${tabla(cfg, false)}
        <h3 class="pr-sub"><i class="ti ti-hierarchy-2" aria-hidden="true"></i> Centro de costo de cada área</h3>
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr><th>Área</th><th>Centro de costo</th></tr></thead><tbody>${B.areas.map((a) => `<tr><td>${esc(a.nombre)}</td><td>${ctx.admin ? `<select data-area="${a.id}"><option value="">—</option>${centros.map((c) => `<option value="${c.id}" ${a.centro_id === c.id ? 'selected' : ''}>${esc(`${c.codigo} · ${c.nombre}`)}</option>`).join('')}</select>` : esc(centros.find((c) => c.id === a.centro_id)?.nombre || '')}</td></tr>`).join('')}</tbody></table></div></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', async (e) => {
      const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar();
      if (e.target.name === 'fecha') { f.fecha = e.target.value || hoy(); return cargar(); }
      const ar = e.target.dataset.area; if (ar) { const { error } = await cli.from('hos_areas').update({ centro_id: Number(e.target.value) || null }).eq('id', Number(ar)); if (error) window.FIN.aviso(errorTxt(error)); return cargar(); }
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp, false);
      if (!e.target.closest('[data-accion="generar"]')) return;
      if (gen) return window.FIN.aviso(`La partida del día ya se generó (PI-${gen.partidas.numero}): anúlala para generarla de nuevo`);
      if (!P.L.length) return window.FIN.aviso('No hay movimiento del hospital ese día');
      const faltan = [...new Set(P.L.filter((x) => !x.cuenta).map((x) => x.clave))]; if (faltan.length) return window.FIN.aviso(`Configura las cuentas: ${faltan.join(', ')}`);
      if (!confirm(`¿Generar la partida diaria del hospital del ${fmt.fechaDia(f.fecha)}?`)) return;
      const { data, error } = await cli.rpc('con_generar_partida', { p_loc: ctx.sel.loc, p_anio: Number(f.fecha.slice(0, 4)), p_mes: Number(f.fecha.slice(5, 7)), p_tipo: 'PI', p_descripcion: `Ingresos y costos del hospital del ${fmt.fechaDia(f.fecha)}`, p_lineas: P.L.map((x) => ({ cuenta: x.cuenta, concepto: x.concepto, debe: x.debe, haber: x.haber, centro_id: x.centro_id })), p_origen: 'HOSPITAL', p_ref: Number(f.fecha.replace(/-/g, '')), p_monto: P.total });
      if (error) return window.FIN.aviso(errorTxt(error)); window.FIN.aviso(`Partida PI-${data.numero} generada y aprobada`); cargar();
    });
    iniciar();
  };

  // ===================== Depósito de cierres de caja =====================
  window.PANTALLAS['med-depositos'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Depósito de cierres de caja', icono: 'ti-building-bank', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Procesos' });
    const { sb: cli } = ctx;
    const f = { origen: location.hash.includes('/clinicas/') ? 'CLÍNICA' : 'HOSPITAL' }; let cierres = [], cuentas = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-building-bank'); return; }
      ctx.filtros(`<label class="campo"><span>Caja</span><select name="origen">${['HOSPITAL', 'CLÍNICA'].map((x) => `<option ${f.origen === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`, S().botonesExp);
      try {
        const t = f.origen === 'HOSPITAL' ? 'hos_cierres_caja' : 'cli_cierres_caja';
        const [c, b] = await Promise.all([cli.from(t).select('*').eq('localidad_id', ctx.sel.loc).order('fecha', { ascending: false }).limit(200), cli.from('cuentas_bancarias').select('id, numero, nombre, moneda_id').eq('localidad_id', ctx.sel.loc).order('id')]);
        if (c.error) throw c.error; cierres = c.data || []; cuentas = b.data || [];
      } catch (e) { return falta(ctx, e); }
      pintar();
    }
    const aDepositar = (x) => (f.origen === 'HOSPITAL' ? num(x.efectivo) + num(x.cheque) : num(x.efectivo_contado ?? x.efectivo) + num(x.cheque));
    function pintar() {
      const pend = cierres.filter((x) => !x.movimiento_id && aDepositar(x) > 0);
      cfg = { titulo: `Cierres de caja · ${f.origen === 'HOSPITAL' ? 'hospital' : 'clínica'}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Depósitos', archivo: 'depositos_caja', parametros: [`Empresa: ${S().empresaDe(ctx)}`],
        columnas: [col('Fecha', 'texto', 10), col('Cajero', 'texto', 16), col('Efectivo', 'monto', 12), col('Cheques', 'monto', 12), col('Tarjeta / transferencia', 'monto', 14), col('A depositar', 'monto', 13), col('Depósito', 'texto', 14)],
        filas: cierres.map((x) => ({ valores: [fmt.fechaDia(x.fecha), x.cajero || x.usuario || '', r2(f.origen === 'HOSPITAL' ? x.efectivo : (x.efectivo_contado ?? x.efectivo)), r2(x.cheque), r2(num(x.tarjeta) + num(x.transferencia)), r2(aDepositar(x)), x.movimiento_id ? `Boleta ${x.movimiento_id}` : aDepositar(x) > 0 ? '¤PENDIENTE' : ''], resaltar: !x.movimiento_id && aDepositar(x) > 0, id: x.id })) };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Cierres pendientes de depósito', pend.length, pend.length ? 'ec-alerta' : 'ec-fin')}${kpi('Monto a depositar', q(sum(pend.map(aDepositar))))}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Marca los cierres de caja cuyo efectivo y cheques llevas al banco y registra la boleta: se crea el depósito en Caja y Bancos (donde se procesa su partida y se concilia con el estado de cuenta). Las tarjetas y transferencias entran directo al banco.</p>
        ${ctx.admin && pend.length ? `<div class="sat-g"><label class="campo sat-ancho"><span>Cuenta bancaria</span><select name="cuenta">${cuentas.map((c) => `<option value="${c.id}">${esc(`${c.numero} · ${c.nombre}`)}</option>`).join('')}</select></label><label class="campo"><span>Fecha del depósito</span><input type="date" name="fdep" value="${hoy()}"></label><label class="campo"><span>No. de boleta</span><input name="boleta"></label><button type="button" class="boton primario-sm" data-accion="depositar"><i class="ti ti-building-bank" aria-hidden="true"></i> Registrar depósito</button></div>` : ''}
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr><th></th>${cfg.columnas.map((c) => `<th class="${c.tipo === 'texto' ? '' : 'num'}">${esc(c.titulo)}</th>`).join('')}</tr></thead><tbody>
        ${cfg.filas.map((r) => `<tr class="${r.resaltar ? 'pr-alerta' : ''}"><td>${r.resaltar && ctx.admin ? `<input type="checkbox" data-sel="${r.id}" checked>` : ''}</td>${r.valores.map((v, i) => S().celda(v, cfg.columnas[i])).join('')}</tr>`).join('') || '<tr><td colspan="8" class="tk-vacio">Sin cierres de caja.</td></tr>'}</tbody></table></div></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); if (e.target.name === 'origen') { f.origen = e.target.value; cargar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp, false);
      if (!e.target.closest('[data-accion="depositar"]')) return;
      const ids = [...cont.querySelectorAll('[data-sel]:checked')].map((x) => Number(x.dataset.sel)); if (!ids.length) return window.FIN.aviso('Marca los cierres a depositar');
      const v = (n) => cont.querySelector(`[name=${n}]`)?.value;
      const { data, error } = await cli.rpc('med_depositar', { p_origen: f.origen, p_cierres: ids, p_cuenta_bancaria: Number(v('cuenta')), p_fecha: v('fdep') || hoy(), p_documento: v('boleta') || null });
      if (error) return window.FIN.aviso(errorTxt(error)); window.FIN.aviso(`Depósito de Q ${fmt.monto(data.total)} registrado en Caja y Bancos: procésalo allí para su partida`); cargar();
    });
    iniciar();
  };
})();
