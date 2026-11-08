// Presupuesto y Flujo de efectivo (script 153), según la práctica profesional en Guatemala:
//   Catálogos: Rubros y cuentas contables, Escenarios, Rubros de flujo (NIC 7).
//   Registros: Formulación del presupuesto (12 meses por rubro con supuestos), Modificaciones presupuestarias,
//     Proyección de flujo (13 semanas o 12 meses, cobros y pagos automáticos).
//   Procesos: Aprobación de presupuestos (segregación de funciones), Ejecución presupuestaria (desde las partidas).
//   Reportes: Presupuesto vs. ejecutado (mes y acumulado, semáforo), Estado de flujo de efectivo (NIC 7, método
//     indirecto), Flujo proyectado vs. real e Indicadores financieros. Todo con PDF, Excel y gráficas.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const M3 = MES.map((m) => m.slice(0, 3));
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const q = (n) => `Q ${fmt.monto(n)}`;
  const num = (v) => { const x = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(x) ? x : 0; };
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const G = () => window.GRAFICAS;
  const GRUPOS = ['INGRESOS', 'GASTOS DE PERSONAL', 'GASTOS FINANCIEROS', 'GASTOS ADMINISTRATIVOS', 'IMPUESTOS', 'INVERSIONES'];
  const ESTADOS = { 'FORMULACIÓN': 'pendiente', 'EN REVISIÓN': 'editando', APROBADO: 'aprobada', 'EN EJECUCIÓN': 'aprobada', MODIFICADO: 'aprobada', CERRADO: 'definitiva', ANULADO: 'anulada' };
  const marca = (e) => `<span class="pc-marca ${ESTADOS[e] || ''}">${esc(e)}</span>`;
  const faltaScript = (ctx, e) => { ctx.pDet.innerHTML = `<p class="vacio">${/rubros_flujo|escenarios_presupuesto|presupuesto_rubro_cuentas|flujo_proyecciones|presupuesto_modificaciones|m1|cambiar_estado_presupuesto/.test(e?.message || '') ? 'Falta instalar el script 153 (Presupuesto y Flujo) en Supabase.' : esc(window.UI.traducirError(e))}</p>`; };
  const empresaDe = (ctx) => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) { const { data, error } = await hacer().range(i, i + 999); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; }
    return out;
  }
  const meses = (l) => Array.from({ length: 12 }, (_, k) => num(l[`m${k + 1}`]));
  const ejec = (l) => Array.from({ length: 12 }, (_, k) => num(l[`e${k + 1}`]));
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  // Semáforo: en ingresos se busca llegar (≥ 95 % verde, ≥ 80 % ámbar); en egresos no pasarse (≤ 100 % verde, ≤ 110 % ámbar).
  const semaforo = (nat, pct) => (pct == null ? '' : nat === 'INGRESO' ? (pct >= 0.95 ? 'verde' : pct >= 0.8 ? 'ambar' : 'rojo') : (pct <= 1 ? 'verde' : pct <= 1.1 ? 'ambar' : 'rojo'));
  const luz = (s) => (s ? `<span class="pf-luz pf-${s}" title="${{ verde: 'En meta', ambar: 'Atención', rojo: 'Fuera de meta' }[s]}"></span>` : '');

  // Tabla de reporte + PDF/Excel (mismo formato que los demás reportes).
  function tablaReporte(c, graficas = true) {
    const n = c.columnas.length;
    const celda = (v, x) => (v === '' || v == null ? '<td></td>' : typeof v === 'number' ? `<td class="num${v < 0 ? ' pc-rojo' : ''}">${x.tipo === 'monto' ? fmt.monto(v) : x.tipo === 'porcentaje' ? `${(v * 100).toFixed(1)} %` : v.toLocaleString('es-GT')}</td>` : `<td>${String(v).startsWith('§') ? luz(String(v).slice(1)) : esc(String(v))}</td>`);
    const gs = graficas ? (c.graficas || []).filter(Boolean) : [];
    return `<div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table>
      <thead><tr>${c.columnas.map((x) => `<th class="${x.tipo === 'texto' ? '' : 'num'}">${esc(x.titulo)}</th>`).join('')}</tr></thead>
      <tbody>${c.filas.length ? c.filas.map((r) => (r.tipo === 'grupo' && r.combinar ? `<tr class="pr-g"><td colspan="${n}">${esc(r.valores[0])}</td></tr>` : `<tr class="${r.tipo === 'subtotal' ? 'pr-s' : r.tipo === 'total' ? 'pr-t' : r.tipo === 'grupo' ? 'pr-g' : ''}${r.resaltar === true ? ' pr-alerta' : ''}">${c.columnas.map((x, i) => celda(r.valores[i], x)).join('')}</tr>`)).join('') : `<tr><td colspan="${n}" class="tk-vacio">${esc(c.vacio || 'Sin información con esos parámetros.')}</td></tr>`}</tbody>
    </table>${gs.length && c.filas.length ? `<section class="pr-graficas"><h3><i class="ti ti-chart-bar" aria-hidden="true"></i> Gráficas</h3>${gs.join('')}</section>` : ''}</div>`;
  }
  function exportar(c, formato, graficas = true) {
    if (!c || !c.filas.length) return window.FIN.aviso('No hay información con esos parámetros');
    const gs = graficas ? (c.graficas || []).filter(Boolean) : [];
    const salida = { ...c, filas: c.filas.map((r) => ({ ...r, resaltar: r.resaltar === true ? 1 : undefined, valores: r.valores.map((v) => (typeof v === 'string' && v.startsWith('§') ? ({ verde: 'En meta', ambar: 'Atención', rojo: 'Fuera de meta' }[v.slice(1)] || '') : v)) })) };
    if (formato === 'PDF') return window.CUENTAS_XLSX.pdf({ ...salida, graficas: gs.join('') });
    Promise.all(gs.map((g) => G().png(g))).then((imagenes) => window.REPORTE_XLSX.generar({ ...salida, imagenes })).catch((e) => window.FIN.aviso(e.message || 'No se pudo generar el Excel'));
  }
  const botonesExp = '<button type="button" class="boton secundario-sm" data-exp="PDF"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button><button type="button" class="boton secundario-sm" data-exp="EXCEL"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>';

  // Contabilidad: saldos por código de cuenta (con su jerarquía) para el flujo NIC 7, el real y los indicadores.
  // Fecha contable de la partida: el día en que se registró si cae en su período (año y mes); si se registró después
  // (partidas migradas o atrasadas) cuenta el último día de su período.
  const fechaContable = (p) => { const d = new Date(p.fecha).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }); const per = `${p.anio}-${String(p.mes).padStart(2, '0')}`; if (d.slice(0, 7) === per) return d; return d < `${per}-01` ? `${per}-01` : new Date(Date.UTC(p.anio, p.mes, 0)).toISOString().slice(0, 10); };
  async function leerConta(sb, loc, hasta) {
    const lineas = await leerTodo(() => sb.from('partida_lineas').select('cuenta_id, debe, haber, partidas!inner(localidad_id, fecha, anio, mes, estado, catalogo_id, cierre_ejercicio)').eq('partidas.localidad_id', loc).eq('partidas.estado', 'VIGENTE').lte('partidas.anio', Number(hasta.slice(0, 4))).order('id')).then((ls) => ls.map((l) => ({ ...l, partidas: { ...l.partidas, fecha: fechaContable(l.partidas) } })).filter((l) => l.partidas.fecha <= hasta && !['PCE', 'PA'].includes(l.partidas.cierre_ejercicio)));
    const cats = [...new Set(lineas.map((l) => l.partidas.catalogo_id).filter(Boolean))];
    const [cuentas, tipos] = await Promise.all([
      cats.length ? leerTodo(() => sb.from('cuentas').select('id, codigo, nombre, cuenta_mayor_id, tipo_cuenta_id, nivel').in('catalogo_id', cats).order('id')) : [],
      leerTodo(() => sb.from('tipos_cuenta').select('id, tipo_operacion, reporte_financiero, descripcion').eq('localidad_id', loc).order('id'))
    ]);
    const porId = new Map(cuentas.map((c) => [c.id, c])), tipo = new Map(tipos.map((t) => [t.id, t]));
    const porCodigo = new Map();
    cuentas.forEach((c) => { if (porCodigo.has(c.codigo)) return; const t = tipo.get(c.tipo_cuenta_id); porCodigo.set(c.codigo, { codigo: c.codigo, nombre: c.nombre, nivel: c.nivel || 1, mayor: porId.get(c.cuenta_mayor_id)?.codigo || null, nat: t?.tipo_operacion === 'HABER-DEBE' ? -1 : 1, reporte: t?.reporte_financiero || '', tipoDesc: t?.descripcion || '' }); });
    const ls = lineas.map((l) => ({ fecha: l.partidas.fecha, codigo: porId.get(l.cuenta_id)?.codigo, d: Number(l.debe) || 0, h: Number(l.haber) || 0 })).filter((l) => l.codigo);
    // Saldo (debe − haber) acumulado por código y sus mayores, hasta una fecha (o en un rango).
    const saldos = (pred) => { const s = new Map(); ls.forEach((l) => { if (!pred(l)) return; let c = porCodigo.get(l.codigo); const vis = new Set(); while (c && !vis.has(c.codigo)) { vis.add(c.codigo); s.set(c.codigo, (s.get(c.codigo) || 0) + l.d - l.h); c = c.mayor ? porCodigo.get(c.mayor) : null; } }); return s; };
    const hijos = (cod) => [...porCodigo.values()].filter((c) => c.mayor === cod);
    const clase = (pred) => [...porCodigo.values()].find((c) => c.nivel === 1 && pred(c));
    const activo = clase((c) => c.reporte === 'B' && c.nat === 1), pasivo = clase((c) => c.reporte === 'B' && /PASIVO/i.test(c.nombre + c.tipoDesc)), patrimonio = clase((c) => c.reporte === 'B' && /PATRIMONIO|CAPITAL/i.test(c.nombre + c.tipoDesc));
    const corriente = (cl) => cl && hijos(cl.codigo).find((c) => /CORRIENTE|CIRCULANTE/i.test(c.nombre) && !/NO CORRIENTE/i.test(c.nombre));
    const acCorr = corriente(activo), paCorr = corriente(pasivo);
    const efectivo = [...porCodigo.values()].filter((c) => activo && c.codigo.startsWith(activo.codigo) && c.nivel === 3 && /CAJA|BANCO|EFECTIVO|DISPONIB/i.test(c.nombre));
    const inventario = [...porCodigo.values()].filter((c) => acCorr && c.codigo.startsWith(acCorr.codigo) && c.nivel === 3 && /INVENTARIO/i.test(c.nombre));
    const resultadoCods = [...porCodigo.values()].filter((c) => c.nivel === 1 && c.reporte === 'E').map((c) => c.codigo);
    return { ls, porCodigo, saldos, hijos, activo, pasivo, patrimonio, acCorr, paCorr, efectivo, inventario, resultadoCods };
  }

  // Editor de lista (catálogos de una tabla por empresa).
  function catalogoLista(cont, op) {
    const ctx = montar(cont, { titulo: op.titulo, icono: op.icono, clase: 'bk-movimientos bm-solo cx-rep pf-cat', grupo: 'Presupuesto y Flujo · Catálogos' });
    const { sb } = ctx;
    let filas = [];
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', op.icono); return; }
      ctx.filtros('', `${ctx.admin ? '<button type="button" class="boton secundario-sm" data-accion="omision"><i class="ti ti-wand" aria-hidden="true"></i> Cargar los de la norma</button><button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>' : ''}${botonesExp}`);
      const { data, error } = await sb.from(op.tabla).select('*').eq('localidad_id', ctx.sel.loc).order(op.orden);
      if (error) return faltaScript(ctx, error);
      filas = data || []; pintar();
    }
    function pintar() {
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> ${op.ayuda}</p>
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${op.campos.map((c) => `<th class="${c.tipo === 'numero' ? 'num' : ''}">${c.titulo}</th>`).join('')}<th></th></tr></thead>
        <tbody>${filas.map((f) => `<tr data-id="${f.id}">${op.campos.map((c) => `<td class="${c.tipo === 'numero' ? 'num' : ''}">${c.opciones ? `<select data-c="${c.k}" ${ctx.admin ? '' : 'disabled'}>${c.opciones.map((o) => `<option ${f[c.k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>` : c.tipo === 'check' ? `<input type="checkbox" data-c="${c.k}" ${f[c.k] ? 'checked' : ''} ${ctx.admin ? '' : 'disabled'}>` : `<input data-c="${c.k}" value="${esc(String(f[c.k] ?? ''))}" ${c.tipo === 'numero' ? 'type="number" step="any"' : ''} ${ctx.admin ? '' : 'disabled'}>`}</td>`).join('')}<td>${ctx.admin ? '<button type="button" class="icono-boton rp-peligro" data-quitar title="Quitar"><i class="ti ti-trash" aria-hidden="true"></i></button>' : ''}</td></tr>`).join('') || `<tr><td colspan="${op.campos.length + 1}" class="tk-vacio">Sin registros: usa «Cargar los de la norma» o «Nuevo».</td></tr>`}</tbody></table></div></div>`;
    }
    const cfg = () => ({ titulo: op.titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: op.titulo.slice(0, 30), archivo: op.tabla, parametros: [`Empresa: ${empresaDe(ctx)}`], columnas: op.campos.map((c) => col(c.titulo, c.tipo === 'numero' ? 'numero' : 'texto', c.ancho || 18)), filas: filas.map((f) => ({ valores: op.campos.map((c) => (c.tipo === 'check' ? (f[c.k] ? 'Sí' : 'No') : c.tipo === 'numero' ? Number(f[c.k]) : String(f[c.k] ?? ''))) })) });
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e); if (cambio === 'org' || cambio === 'loc') return cargar();
      const tr = e.target.closest('tr[data-id]'); if (!tr || !e.target.dataset.c) return;
      const k = e.target.dataset.c, c = op.campos.find((x) => x.k === k);
      const v = c.tipo === 'check' ? e.target.checked : c.tipo === 'numero' ? num(e.target.value) : e.target.value.trim().toUpperCase();
      const { error } = await sb.from(op.tabla).update({ [k]: v }).eq('id', Number(tr.dataset.id));
      if (error) { window.FIN.aviso(window.UI.traducirError(error)); return cargar(); }
      Object.assign(filas.find((f) => String(f.id) === tr.dataset.id), { [k]: v });
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'omision') { const { error } = await sb.rpc('asegurar_catalogos_flujo', { p_localidad: ctx.sel.loc }); if (error) return faltaScript(ctx, error); window.FIN.aviso('Catálogos cargados'); return cargar(); }
      if (a === 'nuevo') { const { error } = await sb.from(op.tabla).insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, ...op.nuevo(filas) }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); return cargar(); }
      if (e.target.closest('[data-quitar]')) { const tr = e.target.closest('tr[data-id]'); if (!confirm('¿Quitar el registro?')) return; const { error } = await sb.from(op.tabla).delete().eq('id', Number(tr.dataset.id)); if (error) return window.FIN.aviso(/foreign|referen/i.test(error.message) ? 'Está en uso: márcalo inactivo' : window.UI.traducirError(error)); return cargar(); }
    });
    iniciar();
  }
  window.PANTALLAS['rubros-de-flujo'] = (cont) => catalogoLista(cont, { titulo: 'Rubros de flujo', icono: 'ti-arrows-exchange', tabla: 'rubros_flujo', orden: 'codigo',
    ayuda: 'Rubros del flujo de efectivo por actividad (NIC 7): operación, inversión y financiamiento. Los de origen COBROS y PAGOS se llenan solos con las cuentas por cobrar y por pagar.',
    campos: [{ k: 'codigo', titulo: 'Código', tipo: 'numero', ancho: 8 }, { k: 'nombre', titulo: 'Nombre', ancho: 40 }, { k: 'actividad', titulo: 'Actividad', opciones: ['OPERACIÓN', 'INVERSIÓN', 'FINANCIAMIENTO'] }, { k: 'tipo', titulo: 'Tipo', opciones: ['ENTRADA', 'SALIDA'] }, { k: 'origen', titulo: 'Origen', opciones: ['MANUAL', 'COBROS', 'PAGOS'] }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
    nuevo: (f) => ({ codigo: Math.max(0, ...f.map((x) => x.codigo)) + 1, nombre: 'NUEVO RUBRO', actividad: 'OPERACIÓN', tipo: 'SALIDA' }) });
  window.PANTALLAS['escenarios-presupuesto'] = (cont) => catalogoLista(cont, { titulo: 'Escenarios', icono: 'ti-adjustments', tabla: 'escenarios_presupuesto', orden: 'codigo',
    ayuda: 'Escenarios de la proyección: el factor multiplica los ingresos y los egresos (por ejemplo, el conservador prueba la liquidez con ingresos −10 % y egresos +5 %).',
    campos: [{ k: 'codigo', titulo: 'Código', ancho: 14 }, { k: 'nombre', titulo: 'Nombre', ancho: 30 }, { k: 'factor_ingresos', titulo: 'Factor ingresos', tipo: 'numero' }, { k: 'factor_egresos', titulo: 'Factor egresos', tipo: 'numero' }, { k: 'descripcion', titulo: 'Descripción', ancho: 44 }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
    nuevo: (f) => ({ codigo: `ESCENARIO${f.length + 1}`, nombre: 'NUEVO ESCENARIO' }) });

  // ===================== Rubros y cuentas contables =====================
  window.PANTALLAS['rubros-cuentas'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Rubros y cuentas contables', icono: 'ti-link', clase: 'bk-movimientos bm-solo cx-rep pf-cat', grupo: 'Presupuesto y Flujo · Catálogos' });
    const { sb } = ctx;
    let rubros = [], vinc = [], cuentas = [];
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-link'); return; }
      ctx.filtros('', botonesExp);
      const [r, v, cat] = await Promise.all([leerTodo(() => sb.from('rubros_presupuesto').select('id, codigo, nombre, grupo, naturaleza').eq('activo', true).order('codigo')), sb.from('presupuesto_rubro_cuentas').select('*').eq('localidad_id', ctx.sel.loc).order('cuenta_codigo'), sb.from('catalogos_cuentas').select('id').eq('localidad_id', ctx.sel.loc).eq('activo', true).order('version', { ascending: false }).limit(1)]);
      if (v.error) return faltaScript(ctx, v.error);
      rubros = r; vinc = v.data || [];
      cuentas = cat.data?.[0] ? await leerTodo(() => sb.from('cuentas').select('codigo, nombre, nivel').eq('catalogo_id', cat.data[0].id).order('codigo')) : [];
      pintar();
    }
    const nombreCta = (cod) => cuentas.find((c) => c.codigo === cod)?.nombre || '';
    function pintar() {
      const sinVinc = rubros.filter((r) => !vinc.some((v) => v.rubro_id === r.id)).length;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">
        <div class="ec-kpis">${kpi('Rubros', rubros.length)}${kpi('Con cuentas', rubros.length - sinVinc, 'ec-fin')}${kpi('Sin cuentas', sinVinc, sinVinc ? 'ec-alerta' : '')}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Cada rubro toma su ejecución de las cuentas contables que le vincules. Escribe el código de una cuenta (o de una cuenta mayor: incluye todas sus subcuentas). Ejemplo: el rubro de ventas con la cuenta 4 (ingresos).</p>
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr><th>Rubro</th><th>Nombre</th><th>Grupo</th><th>Cuentas vinculadas</th>${ctx.admin ? '<th>Agregar cuenta</th>' : ''}</tr></thead>
        <tbody>${GRUPOS.map((g) => { const rs = rubros.filter((r) => r.grupo === g); return rs.length ? `<tr class="pr-g"><td colspan="5">${g}</td></tr>${rs.map((r) => `<tr data-r="${r.id}"><td class="fuerte">${r.codigo}</td><td>${esc(r.nombre)}</td><td class="tk-tenue">${esc(r.naturaleza)}</td>
          <td class="pf-chips">${vinc.filter((v) => v.rubro_id === r.id).map((v) => `<span class="pf-chip" title="${esc(nombreCta(v.cuenta_codigo))}">${esc(v.cuenta_codigo)} ${esc(nombreCta(v.cuenta_codigo).slice(0, 28))}${ctx.admin ? ` <button type="button" data-quitar="${v.id}" aria-label="Quitar">×</button>` : ''}</span>`).join('') || '<span class="tk-tenue">—</span>'}</td>
          ${ctx.admin ? `<td><input list="pf-ctas" data-agregar placeholder="Código de cuenta" autocomplete="off"></td>` : ''}</tr>`).join('')}` : ''; }).join('')}</tbody></table></div>
        <datalist id="pf-ctas">${cuentas.filter((c) => c.nivel <= 4).map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist></div>`;
    }
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e); if (cambio === 'org' || cambio === 'loc') return cargar();
      if (!e.target.matches('[data-agregar]')) return;
      const cod = e.target.value.trim(); if (!cod) return;
      if (cuentas.length && !cuentas.some((c) => c.codigo === cod)) return window.FIN.aviso('Ese código no está en el catálogo de cuentas');
      const { error } = await sb.from('presupuesto_rubro_cuentas').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, rubro_id: Number(e.target.closest('tr').dataset.r), cuenta_codigo: cod });
      if (error) return window.FIN.aviso(/duplicate|unique/i.test(error.message) ? 'Ya está vinculada' : window.UI.traducirError(error));
      cargar();
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]');
      if (ex) return exportar({ titulo: 'Rubros de presupuesto y cuentas contables', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Rubros y cuentas', archivo: 'rubros_cuentas', parametros: [`Empresa: ${empresaDe(ctx)}`], columnas: [col('Rubro', 'texto', 8), col('Nombre', 'texto', 40), col('Grupo', 'texto', 22), col('Cuentas', 'texto', 50)], filas: rubros.map((r) => ({ valores: [String(r.codigo), r.nombre, r.grupo, vinc.filter((v) => v.rubro_id === r.id).map((v) => `${v.cuenta_codigo} ${nombreCta(v.cuenta_codigo)}`).join('; ')] })) }, ex.dataset.exp, false);
      const qd = e.target.closest('[data-quitar]'); if (qd) { await sb.from('presupuesto_rubro_cuentas').delete().eq('id', Number(qd.dataset.quitar)); cargar(); }
    });
    iniciar();
  };

  // ===================== Formulación del presupuesto =====================
  window.PANTALLAS['formulacion-presupuesto'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Formulación del presupuesto', icono: 'ti-table-plus', clase: 'bk-movimientos bm-solo cx-rep pf-form', grupo: 'Presupuesto y Flujo · Registros' });
    const { sb } = ctx;
    const f = { anio: new Date().getFullYear() + (new Date().getMonth() >= 9 ? 1 : 0) };
    let lista = [], actual = null, lineas = [], rubros = [], escenarios = [], nuevo = false;
    const TIPOS = ['PRESUPUESTO MAESTRO', 'PRESUPUESTO DE INGRESOS', 'PRESUPUESTO DE GASTOS DE OPERACIÓN', 'PRESUPUESTO DE PERSONAL (PLANILLA)', 'PRESUPUESTO DE INVERSIÓN (CAPITAL)', 'PRESUPUESTO DE CAJA (FLUJO DE EFECTIVO)', 'PRESUPUESTO FINANCIERO', 'PRESUPUESTO DE COMPRAS', 'PRESUPUESTO DE VENTAS'];
    const rubro = (id) => rubros.find((r) => r.id === id);
    function pintarFiltros() {
      ctx.filtros(`<label class="campo cx-anio"><span>Año</span><input type="number" name="anio" min="2000" max="2999" value="${f.anio}"></label>
        <label class="campo"><span>Presupuesto</span><select name="ppto">${lista.map((p) => `<option value="${p.id}" ${actual?.id === p.id ? 'selected' : ''}>No. ${p.numero} v${p.version} · ${esc(p.tipo.replace('PRESUPUESTO ', ''))} · ${p.estado}</option>`).join('') || '<option value="">Sin presupuestos</option>'}</select></label>`,
        `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo presupuesto</button>' : ''}${botonesExp}`);
    }
    async function iniciar() { if (!(await ctx.cargarBase())) return; const r = await leerTodo(() => sb.from('rubros_presupuesto').select('id, codigo, nombre, grupo, naturaleza').eq('activo', true).order('codigo')); rubros = r; await cargar(); }
    async function cargar(id = actual?.id) {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-table-plus'); return; }
      const [p, e] = await Promise.all([sb.from('presupuestos').select('*').eq('localidad_id', ctx.sel.loc).eq('anio', f.anio).order('numero', { ascending: false }), sb.from('escenarios_presupuesto').select('codigo, nombre').eq('localidad_id', ctx.sel.loc).eq('activo', true).order('codigo')]);
      if (e.error) return faltaScript(ctx, e.error);
      lista = p.data || []; escenarios = e.data || [];
      actual = lista.find((x) => x.id === id) || lista[0] || null; nuevo = false;
      lineas = actual ? (await sb.from('presupuesto_lineas').select('*').eq('presupuesto_id', actual.id)).data || [] : [];
      pintarFiltros(); pintar();
    }
    const editable = () => ctx.admin && actual?.estado === 'FORMULACIÓN';
    function pintar() {
      if (nuevo) return pintarNuevo();
      const p = actual;
      if (!p) { ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="ck-elige"><i class="ti ti-table-plus" aria-hidden="true"></i> No hay presupuestos de ${f.anio}. ${ctx.admin ? 'Crea uno con «Nuevo presupuesto».' : ''}</p></div>`; return; }
      const ed = editable();
      const ing = lineas.filter((l) => rubro(l.rubro_id)?.naturaleza === 'INGRESO'), egr = lineas.filter((l) => rubro(l.rubro_id)?.naturaleza !== 'INGRESO');
      const tIng = sum(ing.map((l) => num(l.presupuestado))), tEgr = sum(egr.map((l) => num(l.presupuestado)));
      const pasos = ['FORMULACIÓN', 'EN REVISIÓN', 'APROBADO', 'EN EJECUCIÓN', 'CERRADO'];
      const k = p.estado === 'MODIFICADO' ? 3 : pasos.indexOf(p.estado);
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">
        <section class="pr-cab">
          <div class="pr-id"><small>Presupuesto ${p.anio}</small><b>No. ${p.numero} · v${p.version}</b>${marca(p.estado)}</div>
          <div class="pr-datos">
            <span><small>Tipo</small>${esc(p.tipo)}</span><span><small>Escenario</small>${esc(p.escenario)}</span>
            <span class="pr-desc"><small>Descripción</small>${esc(p.descripcion || '—')}</span>
            <span><small>Elaboró</small>${esc(p.elaborado_por || '')}</span>${p.enviado_por ? `<span><small>Envió a revisión</small>${esc(p.enviado_por)}</span>` : ''}${p.aprobado_por ? `<span><small>Aprobó</small>${esc(p.aprobado_por)} · ${esc(fmt.fechaDia(String(p.aprobado_en).slice(0, 10)))}</span>` : ''}
            ${p.motivo_devolucion ? `<span class="pc-rojo"><small>Observación</small>${esc(p.motivo_devolucion)}</span>` : ''}
          </div>
          <div class="pr-acc">${ed ? '<button type="button" class="boton primario-sm" data-accion="enviar"><i class="ti ti-send" aria-hidden="true"></i> Enviar a revisión</button>' : ''}
            ${ctx.admin && p.estado !== 'FORMULACIÓN' ? '<button type="button" class="boton secundario-sm" data-accion="version"><i class="ti ti-copy" aria-hidden="true"></i> Nueva versión</button>' : ''}</div>
        </section>
        <ol class="pf-ciclo">${['Formular', 'Revisar', 'Aprobar', 'Ejecutar', 'Cerrar'].map((t, i) => `<li class="${i < k ? 'hecho' : i === k ? 'actual' : ''}">${t}</li>`).join('')}</ol>
        <div class="ec-kpis">${kpi('Ingresos presupuestados', q(tIng))}${kpi('Egresos e inversiones', q(tEgr))}${kpi('Resultado presupuestado', q(tIng - tEgr), tIng - tEgr >= 0 ? 'ec-fin' : 'ec-alerta')}${kpi('Rubros', lineas.length)}</div>
        ${ed ? `<div class="pr-barra"><span class="pr-agregar"><select data-nuevo-rubro><option value="">Agregar rubro…</option>${GRUPOS.map((g) => `<optgroup label="${g}">${rubros.filter((r) => r.grupo === g && !lineas.some((l) => l.rubro_id === r.id)).map((r) => `<option value="${r.id}">${r.codigo} · ${esc(r.nombre)}</option>`).join('')}</optgroup>`).join('')}</select></span>
          <span class="tk-tenue">Escribe el total anual en «Anual» para repartirlo en 12 meses iguales, o cada mes por separado. Se guarda al salir de la celda.</span></div>` : ''}
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla pf-grid"><table><thead><tr><th>Rubro</th><th>Nombre</th>${ed ? '<th class="num">Anual</th>' : ''}${M3.map((m) => `<th class="num">${m}</th>`).join('')}<th class="num">Total</th><th>Supuesto</th>${ed ? '<th></th>' : ''}</tr></thead>
        <tbody>${GRUPOS.map((g) => { const ls = lineas.filter((l) => rubro(l.rubro_id)?.grupo === g).sort((a, b) => rubro(a.rubro_id).codigo - rubro(b.rubro_id).codigo); if (!ls.length) return '';
          const tot = Array.from({ length: 12 }, (_, i) => sum(ls.map((l) => meses(l)[i])));
          return `<tr class="pr-g"><td colspan="${ed ? 18 : 16}">${g}</td></tr>${ls.map((l) => { const r = rubro(l.rubro_id), m = meses(l); return `<tr data-l="${l.id}"><td class="fuerte">${r.codigo}</td><td class="iv-nom" title="${esc(r.nombre)}"><div>${esc(r.nombre)}</div></td>
            ${ed ? '<td class="num"><input type="number" step="0.01" min="0" data-anual placeholder="Anual"></td>' : ''}
            ${m.map((v, i) => `<td class="num">${ed ? `<input type="number" step="0.01" min="0" data-m="${i + 1}" value="${l[`m${i + 1}`] ?? ''}">` : fmt.monto(v)}</td>`).join('')}
            <td class="num fuerte">${fmt.monto(l.presupuestado)}</td><td>${ed ? `<input data-supuesto value="${esc(l.supuesto || '')}" placeholder="Base del cálculo">` : esc(l.supuesto || '')}</td>${ed ? '<td><button type="button" class="icono-boton rp-peligro" data-quitar title="Quitar rubro"><i class="ti ti-trash" aria-hidden="true"></i></button></td>' : ''}</tr>`; }).join('')}
            <tr class="pr-s"><td colspan="${ed ? 3 : 2}">Total ${g.toLowerCase()}</td>${tot.map((v) => `<td class="num">${fmt.monto(v)}</td>`).join('')}<td class="num">${fmt.monto(sum(tot))}</td><td colspan="${ed ? 2 : 1}"></td></tr>`; }).join('') || `<tr><td colspan="18" class="tk-vacio">${ed ? 'Agrega los rubros con «Agregar rubro…».' : 'Sin rubros.'}</td></tr>`}</tbody></table></div></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    function pintarNuevo() {
      ctx.pDet.innerHTML = `<form class="bm-form cx-form cl-clasico pr-nueva pf-nuevo" novalidate><div class="cl-banda">Nuevo presupuesto ${f.anio}</div><div class="pr-nueva-c">
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> El presupuesto se formula por rubro y mes con sus supuestos; luego se envía a revisión y lo aprueba alguien distinto de quien lo elaboró (segregación de funciones).</p>
        <label class="campo"><span>Tipo *</span><select name="tipo">${TIPOS.map((t) => `<option>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Escenario</span><select name="escenario">${(escenarios.length ? escenarios : [{ codigo: 'BASE', nombre: 'BASE' }]).map((x) => `<option value="${x.codigo}">${esc(x.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${fmt.hoy()}"></label>
        <label class="campo pr-desc"><span>Descripción</span><input name="descripcion" maxlength="200" placeholder="Ej.: Presupuesto anual de operación ${f.anio}"></label>
        <label class="pc-check"><input type="checkbox" name="copiar" ${lista.length ? '' : 'disabled'}> Copiar los rubros y montos del presupuesto elegido (con % de ajuste)</label>
        <label class="campo"><span>% de ajuste al copiar</span><input type="number" name="ajuste" value="0" step="0.1"></label>
        <p class="modal-error tk-error" role="alert"></p>
        <div class="pr-nueva-acc"><button type="button" class="boton secundario-sm" data-accion="cancelar">Cancelar</button><button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Crear presupuesto</button></div></div></form>`;
    }
    async function guardarLinea(tr, datos) {
      const { data, error } = await sb.from('presupuesto_lineas').update(datos).eq('id', Number(tr.dataset.l)).select('*').single();
      if (error) { window.FIN.aviso(window.UI.traducirError(error)); return cargar(); }
      Object.assign(lineas.find((l) => l.id === data.id), data); pintar();
    }
    function cfgExport() {
      const filas = [];
      GRUPOS.forEach((g) => { const ls = lineas.filter((l) => rubro(l.rubro_id)?.grupo === g); if (!ls.length) return; filas.push({ valores: [g], tipo: 'grupo', combinar: true });
        ls.forEach((l) => filas.push({ valores: [String(rubro(l.rubro_id).codigo), rubro(l.rubro_id).nombre, ...meses(l).map(r2), r2(l.presupuestado), l.supuesto || ''] }));
        const tot = Array.from({ length: 12 }, (_, i) => sum(ls.map((l) => meses(l)[i]))); filas.push({ valores: [`Total ${g.toLowerCase()}`, '', ...tot.map(r2), r2(sum(tot)), ''], tipo: 'subtotal' }); });
      return { titulo: `Presupuesto ${actual.anio} No. ${actual.numero} v${actual.version}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Presupuesto', archivo: `presupuesto_${actual.anio}_${actual.numero}`, firmas: ['Elaboró', 'Revisó', 'Aprobó'],
        parametros: [`Empresa: ${empresaDe(ctx)}`, `Tipo: ${actual.tipo}`, `Escenario: ${actual.escenario}`, `Estado: ${actual.estado}`], columnas: [col('Rubro', 'texto', 7), col('Nombre', 'texto', 34), ...M3.map((m) => col(m, 'monto', 12)), col('Total', 'monto', 14), col('Supuesto', 'texto', 30)], filas,
        graficas: [G().columnas('Presupuesto mensual: ingresos y egresos (Q)', M3, [{ nombre: 'Ingresos', color: G().COLORES.VERDE, valores: Array.from({ length: 12 }, (_, i) => sum(lineas.filter((l) => rubro(l.rubro_id)?.naturaleza === 'INGRESO').map((l) => meses(l)[i]))) }, { nombre: 'Egresos', color: G().COLORES.NARANJA, valores: Array.from({ length: 12 }, (_, i) => sum(lineas.filter((l) => rubro(l.rubro_id)?.naturaleza !== 'INGRESO').map((l) => meses(l)[i]))) }])] };
    }
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e); if (cambio === 'org' || cambio === 'loc') return cargar(null);
      if (e.target.name === 'anio') { f.anio = Number(e.target.value) || f.anio; return cargar(null); }
      if (e.target.name === 'ppto') return cargar(Number(e.target.value));
      if (e.target.matches('[data-nuevo-rubro]') && e.target.value) { const { error } = await sb.from('presupuesto_lineas').insert({ presupuesto_id: actual.id, rubro_id: Number(e.target.value) }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); return cargar(); }
      const tr = e.target.closest('tr[data-l]'); if (!tr) return;
      if (e.target.dataset.m) return guardarLinea(tr, { [`m${e.target.dataset.m}`]: e.target.value === '' ? null : num(e.target.value) });
      if (e.target.matches('[data-anual]')) { const t = num(e.target.value); const base = Math.floor((t / 12) * 100) / 100; const d = {}; for (let i = 1; i <= 12; i++) d[`m${i}`] = i < 12 ? base : r2(t - base * 11); return guardarLinea(tr, d); }
      if (e.target.matches('[data-supuesto]')) return guardarLinea(tr, { supuesto: e.target.value });
    });
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('.pf-nuevo')) return; e.preventDefault();
      const el = e.target.elements;
      const { data, error } = await sb.from('presupuestos').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, numero: 0, tipo: el.tipo.value, anio: f.anio, fecha: el.fecha.value, descripcion: el.descripcion.value.trim() || null, escenario: el.escenario.value, frecuencia: 'ANUAL', periodo: 1 }).select('id').single();
      if (error) { e.target.querySelector('.modal-error').textContent = window.UI.traducirError(error); return; }
      if (el.copiar.checked && actual) { const k = 1 + num(el.ajuste.value) / 100; const ls = lineas.map((l) => { const o = { presupuesto_id: data.id, rubro_id: l.rubro_id, supuesto: l.supuesto }; meses(l).forEach((v, i) => { o[`m${i + 1}`] = r2(v * k); }); return o; }); if (ls.length) await sb.from('presupuesto_lineas').insert(ls); }
      window.FIN.aviso('Presupuesto creado: agrega sus rubros'); cargar(data.id);
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return actual ? exportar(cfgExport(), ex.dataset.exp) : null;
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'nuevo') { nuevo = true; return pintar(); }
      if (a === 'cancelar') { nuevo = false; return pintar(); }
      if (a === 'enviar' || a === 'version') { if (!confirm(a === 'enviar' ? '¿Enviar el presupuesto a revisión? Ya no se podrá modificar hasta que lo devuelvan.' : '¿Crear una nueva versión en formulación con los mismos rubros y montos?')) return; const { data, error } = await sb.rpc('cambiar_estado_presupuesto', { p_id: actual.id, p_accion: a === 'enviar' ? 'ENVIAR' : 'NUEVA_VERSION', p_motivo: null }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); window.FIN.aviso(a === 'enviar' ? 'Enviado a revisión' : 'Nueva versión creada'); return cargar(data); }
      if (e.target.closest('[data-quitar]')) { if (!confirm('¿Quitar el rubro del presupuesto?')) return; await sb.from('presupuesto_lineas').delete().eq('id', Number(e.target.closest('tr').dataset.l)); return cargar(); }
    });
    iniciar();
  };

  // ===================== Aprobación de presupuestos =====================
  window.PANTALLAS['aprobacion-presupuesto'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Aprobación de presupuestos', icono: 'ti-checks', clase: 'bk-movimientos bm-solo cx-rep pf-aprob', grupo: 'Presupuesto y Flujo · Procesos' });
    const { sb } = ctx;
    const f = { estado: 'EN REVISIÓN' };
    let lista = [], actual = null, lineas = [], rubros = [];
    async function iniciar() { if (!(await ctx.cargarBase())) return; rubros = await leerTodo(() => sb.from('rubros_presupuesto').select('id, codigo, nombre, grupo, naturaleza').order('codigo')); await cargar(); }
    async function cargar(id = actual?.id) {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-checks'); return; }
      let qy = sb.from('presupuestos').select('*').eq('localidad_id', ctx.sel.loc).order('anio', { ascending: false }).order('numero', { ascending: false });
      if (f.estado !== 'TODOS') qy = qy.eq('estado', f.estado);
      const { data } = await qy; lista = data || [];
      actual = lista.find((x) => x.id === id) || lista[0] || null;
      lineas = actual ? (await sb.from('presupuesto_lineas').select('*').eq('presupuesto_id', actual.id)).data || [] : [];
      ctx.filtros(`<label class="campo"><span>Estado</span><select name="estado">${['EN REVISIÓN', 'APROBADO', 'EN EJECUCIÓN', 'MODIFICADO', 'FORMULACIÓN', 'CERRADO', 'TODOS'].map((x) => `<option ${f.estado === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="campo"><span>Presupuesto</span><select name="ppto">${lista.map((p) => `<option value="${p.id}" ${actual?.id === p.id ? 'selected' : ''}>${p.anio} · No. ${p.numero} v${p.version} · ${esc(p.tipo.replace('PRESUPUESTO ', ''))}</option>`).join('') || '<option value="">Ninguno</option>'}</select></label>`, '');
      pintar();
    }
    function pintar() {
      const p = actual;
      if (!p) { ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="ck-elige"><i class="ti ti-checks" aria-hidden="true"></i> No hay presupuestos ${f.estado === 'TODOS' ? '' : `en estado ${f.estado.toLowerCase()}`}.</p></div>`; return; }
      const rub = (id) => rubros.find((r) => r.id === id);
      const porG = GRUPOS.map((g) => { const ls = lineas.filter((l) => rub(l.rubro_id)?.grupo === g); const m = Array.from({ length: 12 }, (_, i) => sum(ls.map((l) => meses(l)[i]))); return { g, n: ls.length, tri: [0, 1, 2, 3].map((t) => sum(m.slice(t * 3, t * 3 + 3))), total: sum(m) }; }).filter((x) => x.n);
      const ing = porG.filter((x) => x.g === 'INGRESOS').reduce((s, x) => s + x.total, 0), egr = porG.filter((x) => x.g !== 'INGRESOS').reduce((s, x) => s + x.total, 0);
      const yo = (window.FIN.perfil()?.usuario || '').toUpperCase();
      const mismo = yo && yo === p.elaborado_por;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">
        <section class="pr-cab"><div class="pr-id"><small>Presupuesto ${p.anio}</small><b>No. ${p.numero} · v${p.version}</b>${marca(p.estado)}</div>
          <div class="pr-datos"><span><small>Tipo</small>${esc(p.tipo)}</span><span><small>Escenario</small>${esc(p.escenario)}</span><span><small>Elaboró</small>${esc(p.elaborado_por || '')}</span><span><small>Envió</small>${esc(p.enviado_por || '—')} ${p.enviado_en ? esc(fmt.fechaDia(String(p.enviado_en).slice(0, 10))) : ''}</span>${p.aprobado_por ? `<span><small>Aprobó</small>${esc(p.aprobado_por)}</span>` : ''}<span class="pr-desc"><small>Descripción</small>${esc(p.descripcion || '—')}</span></div>
          <div class="pr-acc">${ctx.admin && p.estado === 'EN REVISIÓN' ? `<button type="button" class="boton primario-sm" data-accion="APROBAR" ${mismo && !window.FIN.esSuperAdmin() ? 'title="Quien elaboró no puede aprobar"' : ''}><i class="ti ti-check" aria-hidden="true"></i> Aprobar</button><button type="button" class="boton secundario-sm" data-accion="DEVOLVER"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Devolver</button>` : ''}
            ${ctx.admin && ['APROBADO', 'EN EJECUCIÓN', 'MODIFICADO'].includes(p.estado) ? '<button type="button" class="boton secundario-sm" data-accion="CERRAR"><i class="ti ti-lock" aria-hidden="true"></i> Cerrar</button>' : ''}
            ${ctx.admin && !['CERRADO', 'ANULADO'].includes(p.estado) ? '<button type="button" class="boton secundario-sm" data-accion="ANULAR"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>' : ''}</div></section>
        ${mismo && p.estado === 'EN REVISIÓN' ? '<p class="pr-guia pc-rojo"><i class="ti ti-shield-lock" aria-hidden="true"></i> Segregación de funciones: tú elaboraste este presupuesto; debe aprobarlo otra persona (salvo el Super Administrador).</p>' : ''}
        <div class="ec-kpis">${kpi('Ingresos', q(ing))}${kpi('Egresos e inversiones', q(egr))}${kpi('Resultado presupuestado', q(ing - egr), ing - egr >= 0 ? 'ec-fin' : 'ec-alerta')}${kpi('Margen', ing ? `${(((ing - egr) / ing) * 100).toFixed(1)} %` : '—')}</div>
        ${tablaReporte({ columnas: [col('Grupo', 'texto'), col('Rubros', 'entero'), col('Trimestre 1', 'monto'), col('Trimestre 2', 'monto'), col('Trimestre 3', 'monto'), col('Trimestre 4', 'monto'), col('Total anual', 'monto'), col('% del total', 'porcentaje')],
          filas: [...porG.map((x) => ({ valores: [x.g, x.n, ...x.tri.map(r2), r2(x.total), (x.g === 'INGRESOS' ? ing : egr) ? x.total / (x.g === 'INGRESOS' ? ing : egr) : 0] })), { valores: ['Resultado (ingresos − egresos)', '', '', '', '', '', r2(ing - egr), ''], tipo: 'total' }],
          graficas: [G().barras('Egresos por grupo (Q)', porG.filter((x) => x.g !== 'INGRESOS').map((x) => ({ etiqueta: x.g, valor: x.total, texto: q(x.total) })), G().COLORES.NARANJA)] })}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(null); if (e.target.name === 'estado') { f.estado = e.target.value; return cargar(null); } if (e.target.name === 'ppto') return cargar(Number(e.target.value)); });
    cont.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-accion]')?.dataset.accion; if (!a) return;
      let motivo = null;
      if (a === 'DEVOLVER' || a === 'ANULAR') { motivo = prompt(a === 'DEVOLVER' ? 'Observaciones para corregir el presupuesto:' : 'Motivo de la anulación:'); if (!motivo) return; }
      else if (!confirm({ APROBAR: '¿Aprobar el presupuesto? Desde ahora solo cambia con modificaciones presupuestarias.', CERRAR: '¿Cerrar el presupuesto? Ya no se modifica ni se recalcula.' }[a])) return;
      const { error } = await sb.rpc('cambiar_estado_presupuesto', { p_id: actual.id, p_accion: a, p_motivo: motivo });
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      window.FIN.aviso({ APROBAR: 'Presupuesto aprobado', DEVOLVER: 'Devuelto a formulación', CERRAR: 'Presupuesto cerrado', ANULAR: 'Presupuesto anulado' }[a]);
      cargar(actual.id);
    });
    iniciar();
  };

  // ===================== Modificaciones presupuestarias =====================
  window.PANTALLAS['modificaciones-presupuestarias'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Modificaciones presupuestarias', icono: 'ti-arrows-shuffle', clase: 'bk-movimientos bm-solo cx-rep pf-mod', grupo: 'Presupuesto y Flujo · Registros' });
    const { sb } = ctx;
    let ppts = [], actual = null, mods = [], lineas = [], rubros = [];
    async function iniciar() { if (!(await ctx.cargarBase())) return; rubros = await leerTodo(() => sb.from('rubros_presupuesto').select('id, codigo, nombre, grupo').order('codigo')); await cargar(); }
    async function cargar(id = actual?.id) {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-arrows-shuffle'); return; }
      const { data } = await sb.from('presupuestos').select('*').eq('localidad_id', ctx.sel.loc).in('estado', ['APROBADO', 'EN EJECUCIÓN', 'MODIFICADO', 'CERRADO']).order('anio', { ascending: false }).order('numero', { ascending: false });
      ppts = data || []; actual = ppts.find((p) => p.id === id) || ppts[0] || null;
      if (actual) { const [m, l] = await Promise.all([sb.from('presupuesto_modificaciones').select('*').eq('presupuesto_id', actual.id).order('numero', { ascending: false }), sb.from('presupuesto_lineas').select('*').eq('presupuesto_id', actual.id)]); if (m.error) return faltaScript(ctx, m.error); mods = m.data || []; lineas = l.data || []; } else { mods = []; lineas = []; }
      ctx.filtros(`<label class="campo"><span>Presupuesto aprobado</span><select name="ppto">${ppts.map((p) => `<option value="${p.id}" ${actual?.id === p.id ? 'selected' : ''}>${p.anio} · No. ${p.numero} v${p.version} · ${esc(p.tipo.replace('PRESUPUESTO ', ''))} · ${p.estado}</option>`).join('') || '<option value="">Sin presupuestos aprobados</option>'}</select></label>`, botonesExp);
      pintar();
    }
    const rub = (id) => rubros.find((r) => r.id === id);
    const rTxt = (id) => (id ? `${rub(id)?.codigo} · ${rub(id)?.nombre}` : '—');
    function pintar() {
      if (!actual) { ctx.pDet.innerHTML = '<div class="bm-form cx-form cl-clasico"><p class="ck-elige"><i class="ti ti-arrows-shuffle" aria-hidden="true"></i> Las modificaciones se hacen a un presupuesto aprobado (Procesos › Aprobación de presupuestos).</p></div>'; return; }
      const ed = ctx.admin && ['APROBADO', 'EN EJECUCIÓN', 'MODIFICADO'].includes(actual.estado);
      const opR = (lst) => GRUPOS.map((g) => `<optgroup label="${g}">${lst.filter((r) => r.grupo === g).map((r) => `<option value="${r.id}">${r.codigo} · ${esc(r.nombre)}</option>`).join('')}</optgroup>`).join('');
      const enPpto = rubros.filter((r) => lineas.some((l) => l.rubro_id === r.id));
      const ap = mods.filter((m) => m.estado === 'APLICADA');
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">
        <div class="ec-kpis">${kpi('Presupuesto vigente', q(actual.total_presupuestado))}${kpi('Modificaciones aplicadas', ap.length)}${kpi('Ampliaciones', q(sum(ap.filter((m) => m.tipo === 'AMPLIACIÓN').map((m) => num(m.monto)))))}${kpi('Reducciones', q(sum(ap.filter((m) => m.tipo === 'REDUCCIÓN').map((m) => num(m.monto)))))}${kpi('Traslados', q(sum(ap.filter((m) => m.tipo === 'TRASLADO').map((m) => num(m.monto)))))}</div>
        ${ed ? `<form class="pf-modform" novalidate><label class="campo"><span>Tipo</span><select name="tipo"><option>TRASLADO</option><option>AMPLIACIÓN</option><option>REDUCCIÓN</option></select></label>
          <label class="campo" data-origen><span>Rubro de origen (rebaja)</span><select name="origen"><option value="">—</option>${opR(enPpto)}</select></label>
          <label class="campo" data-destino><span>Rubro de destino (aumenta)</span><select name="destino"><option value="">—</option>${opR(rubros)}</select></label>
          <label class="campo"><span>Mes</span><select name="mes">${MES.map((m, i) => `<option value="${i + 1}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
          <label class="campo"><span>Monto Q</span><input type="number" name="monto" min="0.01" step="0.01"></label>
          <label class="campo pf-just"><span>Justificación (mínimo 10 caracteres)</span><input name="justificacion" maxlength="300" placeholder="Causa y respaldo de la modificación"></label>
          <button type="submit" class="boton primario-sm"><i class="ti ti-plus" aria-hidden="true"></i> Registrar</button><p class="modal-error tk-error" role="alert"></p></form>` : ''}
        ${tablaReporte({ columnas: [col('No.', 'entero'), col('Fecha', 'texto'), col('Tipo', 'texto'), col('Origen', 'texto'), col('Destino', 'texto'), col('Mes', 'texto'), col('Monto', 'monto'), col('Justificación', 'texto'), col('Estado', 'texto'), col('', 'texto')],
          filas: mods.map((m) => ({ valores: [m.numero, fmt.fechaDia(m.fecha), m.tipo, rTxt(m.rubro_origen_id), rTxt(m.rubro_destino_id), MES[m.mes - 1], r2(m.monto), m.justificacion, `${m.estado}${m.aplicada_por ? ` · ${m.aplicada_por}` : ''}`, `@${m.id}`] })), vacio: 'Sin modificaciones.' }, false)
          .replace(/<td>@(\d+)<\/td><\/tr>/g, (x, id) => { const m = mods.find((y) => String(y.id) === id); return `<td>${ed && m?.estado === 'REGISTRADA' ? `<button type="button" class="boton primario-sm" data-aplicar="${id}">Aplicar</button> <button type="button" class="boton secundario-sm" data-anular="${id}">Anular</button>` : ''}</td></tr>`; })}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(null); if (e.target.name === 'ppto') return cargar(Number(e.target.value)); });
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('.pf-modform')) return; e.preventDefault();
      const el = e.target.elements, t = el.tipo.value;
      const v = { presupuesto_id: actual.id, numero: 0, tipo: t, rubro_origen_id: t !== 'AMPLIACIÓN' ? Number(el.origen.value) || null : null, rubro_destino_id: t !== 'REDUCCIÓN' ? Number(el.destino.value) || null : null, mes: Number(el.mes.value), monto: num(el.monto.value), justificacion: el.justificacion.value.trim() };
      const { error } = await sb.from('presupuesto_modificaciones').insert(v);
      if (error) { e.target.querySelector('.modal-error').textContent = /check/i.test(error.message) ? 'Revisa los rubros (origen y destino según el tipo), el monto y la justificación (mínimo 10 caracteres).' : window.UI.traducirError(error); return; }
      window.FIN.aviso('Modificación registrada: aplícala para que afecte el presupuesto'); cargar();
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]');
      if (ex) return exportar({ titulo: `Modificaciones presupuestarias · Presupuesto ${actual?.anio} No. ${actual?.numero}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Modificaciones', archivo: 'modificaciones_presupuesto', parametros: [`Empresa: ${empresaDe(ctx)}`], firmas: ['Solicitó', 'Aprobó'], columnas: [col('No.', 'entero', 6), col('Fecha', 'texto', 11), col('Tipo', 'texto', 12), col('Origen', 'texto', 30), col('Destino', 'texto', 30), col('Mes', 'texto', 11), col('Monto', 'monto', 14), col('Justificación', 'texto', 40), col('Estado', 'texto', 18)], filas: mods.map((m) => ({ valores: [m.numero, fmt.fechaDia(m.fecha), m.tipo, rTxt(m.rubro_origen_id), rTxt(m.rubro_destino_id), MES[m.mes - 1], r2(m.monto), m.justificacion, m.estado] })) }, ex.dataset.exp, false);
      const ap = e.target.closest('[data-aplicar]');
      if (ap) { if (!confirm('¿Aplicar la modificación al presupuesto?')) return; const { error } = await sb.rpc('aplicar_modificacion_presupuesto', { p_id: Number(ap.dataset.aplicar) }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); window.FIN.aviso('Modificación aplicada'); return cargar(); }
      const an = e.target.closest('[data-anular]');
      if (an) { if (!confirm('¿Anular la modificación?')) return; const { error } = await sb.from('presupuesto_modificaciones').update({ estado: 'ANULADA' }).eq('id', Number(an.dataset.anular)); if (error) return window.FIN.aviso(window.UI.traducirError(error)); return cargar(); }
    });
    iniciar();
  };

  // ===================== Ejecución presupuestaria y Presupuesto vs. ejecutado =====================
  function ejecucion(cont, reporte) {
    const ctx = montar(cont, { titulo: reporte ? 'Presupuesto vs. ejecutado' : 'Ejecución presupuestaria', icono: reporte ? 'ti-target-arrow' : 'ti-player-play', clase: 'bk-movimientos bm-solo cx-rep pr-rep pf-ejec', grupo: `Presupuesto y Flujo · ${reporte ? 'Reportes' : 'Procesos'}` });
    const { sb } = ctx;
    const hoy = new Date();
    const f = { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1, ppto: '', vista: 'ACUMULADO', graficas: true };
    let ppts = [], actual = null, lineas = [], rubros = [], vinc = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; rubros = await leerTodo(() => sb.from('rubros_presupuesto').select('id, codigo, nombre, grupo, naturaleza').order('codigo')); await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-target-arrow'); return; }
      const { data } = await sb.from('presupuestos').select('*').eq('localidad_id', ctx.sel.loc).eq('anio', f.anio).in('estado', ['APROBADO', 'EN EJECUCIÓN', 'MODIFICADO', 'CERRADO']).order('numero', { ascending: false });
      ppts = data || []; actual = ppts.find((p) => String(p.id) === String(f.ppto)) || ppts[0] || null; f.ppto = actual?.id || '';
      const [l, v] = await Promise.all([actual ? sb.from('presupuesto_lineas').select('*').eq('presupuesto_id', actual.id) : { data: [] }, sb.from('presupuesto_rubro_cuentas').select('rubro_id').eq('localidad_id', ctx.sel.loc)]);
      lineas = l.data || []; vinc = v.data || [];
      ctx.filtros(`<label class="campo cx-anio"><span>Año</span><input type="number" name="anio" min="2000" max="2999" value="${f.anio}"></label>
        <label class="campo"><span>Presupuesto</span><select name="ppto">${ppts.map((p) => `<option value="${p.id}" ${actual?.id === p.id ? 'selected' : ''}>No. ${p.numero} v${p.version} · ${esc(p.tipo.replace('PRESUPUESTO ', ''))} · ${p.estado}</option>`).join('') || '<option value="">Sin presupuestos aprobados</option>'}</select></label>
        <label class="campo"><span>Mes de corte</span><select name="mes">${MES.map((m, i) => `<option value="${i + 1}" ${f.mes === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        ${reporte ? `<label class="campo"><span>Vista</span><select name="vista"><option value="ACUMULADO" ${f.vista === 'ACUMULADO' ? 'selected' : ''}>Mes y acumulado</option><option value="MENSUAL" ${f.vista === 'MENSUAL' ? 'selected' : ''}>Ejecutado por mes</option></select></label><label class="pc-check"><input type="checkbox" name="graficas" ${f.graficas ? 'checked' : ''}> Gráficas</label>` : ''}`,
        `${!reporte && ctx.admin && actual && actual.estado !== 'CERRADO' ? '<button type="button" class="boton primario-sm" data-accion="calcular"><i class="ti ti-calculator" aria-hidden="true"></i> Calcular ejecución</button>' : ''}${botonesExp}`);
      cfg = construir(); pintar();
    }
    const rub = (id) => rubros.find((r) => r.id === id);
    function construir() {
      const p = actual, k = f.mes;
      const base = { titulo: `Presupuesto vs. ejecutado ${f.anio}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Ppto vs ejecutado', archivo: `presupuesto_vs_ejecutado_${f.anio}_${String(k).padStart(2, '0')}`, firmas: ['Elaboró', 'Revisó'],
        parametros: [`Empresa: ${empresaDe(ctx)}`, p ? `Presupuesto No. ${p.numero} v${p.version} (${p.estado})` : 'Sin presupuesto', `Corte: ${MES[k - 1]} ${f.anio}`, p?.ejecucion_calculada_en ? `Ejecución calculada: ${new Date(p.ejecucion_calculada_en).toLocaleString('es-GT')}` : 'Ejecución sin calcular'] };
      if (!p) return { ...base, columnas: [col('Rubro', 'texto')], filas: [], kpis: [], vacio: `No hay presupuestos aprobados de ${f.anio}.` };
      const filas = []; let T = { pm: 0, em: 0, pa: 0, ea: 0, an: 0 };
      const mensual = reporte && f.vista === 'MENSUAL';
      GRUPOS.forEach((g) => {
        const ls = lineas.filter((l) => rub(l.rubro_id)?.grupo === g).sort((a, b) => rub(a.rubro_id).codigo - rub(b.rubro_id).codigo); if (!ls.length) return;
        filas.push({ valores: [g], tipo: 'grupo', combinar: true });
        let S = { pm: 0, em: 0, pa: 0, ea: 0, an: 0 };
        ls.forEach((l) => {
          const r = rub(l.rubro_id), m = meses(l), e = ejec(l);
          const v = { pm: m[k - 1], em: e[k - 1], pa: sum(m.slice(0, k)), ea: sum(e.slice(0, k)), an: num(l.presupuestado) };
          Object.keys(S).forEach((x) => { S[x] += v[x]; });
          const pct = v.pa ? v.ea / v.pa : null;
          filas.push({ valores: mensual ? [String(r.codigo), r.nombre, ...e.slice(0, k).map(r2), r2(v.ea), r2(v.pa), pct ?? '', `§${semaforo(r.naturaleza, pct)}`]
            : [String(r.codigo), r.nombre, r2(v.pm), r2(v.em), r2(v.em - v.pm), v.pm ? v.em / v.pm : '', r2(v.pa), r2(v.ea), r2(v.ea - v.pa), pct ?? '', `§${semaforo(r.naturaleza, pct)}`, r2(v.an), v.an ? v.ea / v.an : ''], resaltar: semaforo(r.naturaleza, pct) === 'rojo' });
        });
        const nat = g === 'INGRESOS' ? 'INGRESO' : 'EGRESO';
        filas.push({ valores: mensual ? [`Total ${g.toLowerCase()}`, '', ...Array.from({ length: k }, (_, i) => r2(sum(ls.map((l) => ejec(l)[i])))), r2(S.ea), r2(S.pa), S.pa ? S.ea / S.pa : '', `§${semaforo(nat, S.pa ? S.ea / S.pa : null)}`]
          : [`Total ${g.toLowerCase()}`, '', r2(S.pm), r2(S.em), r2(S.em - S.pm), S.pm ? S.em / S.pm : '', r2(S.pa), r2(S.ea), r2(S.ea - S.pa), S.pa ? S.ea / S.pa : '', `§${semaforo(nat, S.pa ? S.ea / S.pa : null)}`, r2(S.an), S.an ? S.ea / S.an : ''], tipo: 'subtotal' });
        const sg = g === 'INGRESOS' ? 1 : -1; Object.keys(T).forEach((x) => { T[x] += sg * S[x]; });
      });
      if (filas.length) filas.push({ valores: mensual ? ['RESULTADO (ingresos − egresos)', '', ...Array(k).fill(''), r2(T.ea), r2(T.pa), '', ''] : ['RESULTADO (ingresos − egresos)', '', r2(T.pm), r2(T.em), r2(T.em - T.pm), '', r2(T.pa), r2(T.ea), r2(T.ea - T.pa), '', '', r2(T.an), ''], tipo: 'total' });
      const ingP = sum(lineas.filter((l) => rub(l.rubro_id)?.naturaleza === 'INGRESO').map((l) => sum(meses(l).slice(0, k)))), ingE = sum(lineas.filter((l) => rub(l.rubro_id)?.naturaleza === 'INGRESO').map((l) => sum(ejec(l).slice(0, k))));
      const egP = sum(lineas.filter((l) => rub(l.rubro_id)?.naturaleza !== 'INGRESO').map((l) => sum(meses(l).slice(0, k)))), egE = sum(lineas.filter((l) => rub(l.rubro_id)?.naturaleza !== 'INGRESO').map((l) => sum(ejec(l).slice(0, k))));
      const sinV = lineas.filter((l) => !vinc.some((v) => v.rubro_id === l.rubro_id)).length;
      const kpis = [['Ingresos: ejecución acumulada', ingP ? `${((ingE / ingP) * 100).toFixed(1)} %` : '—', semaforo('INGRESO', ingP ? ingE / ingP : null) === 'rojo' ? 'ec-alerta' : 'ec-fin'], ['Egresos: ejecución acumulada', egP ? `${((egE / egP) * 100).toFixed(1)} %` : '—', semaforo('EGRESO', egP ? egE / egP : null) === 'rojo' ? 'ec-alerta' : 'ec-fin'], ['Resultado ejecutado', q(T.ea)], ['Resultado presupuestado', q(T.pa)], ...(sinV ? [['Rubros sin cuentas vinculadas', sinV, 'ec-alerta']] : [])];
      const columnas = mensual ? [col('Rubro', 'texto', 7), col('Nombre', 'texto', 30), ...M3.slice(0, k).map((m) => col(m, 'monto', 12)), col('Ejecutado acum.', 'monto', 14), col('Presupuesto acum.', 'monto', 14), col('% ejec.', 'porcentaje', 9), col('', 'texto', 4)]
        : [col('Rubro', 'texto', 7), col('Nombre', 'texto', 30), col(`Ppto ${M3[k - 1]}`, 'monto', 13), col(`Ejec. ${M3[k - 1]}`, 'monto', 13), col('Variación', 'monto', 13), col('%', 'porcentaje', 8), col('Ppto acumulado', 'monto', 14), col('Ejec. acumulado', 'monto', 14), col('Variación acum.', 'monto', 14), col('% acum.', 'porcentaje', 9), col('', 'texto', 4), col('Ppto anual', 'monto', 14), col('% anual', 'porcentaje', 9)];
      const graficas = [G().columnas(`Presupuestado vs. ejecutado por grupo a ${MES[k - 1]} (Q)`, GRUPOS.filter((g) => lineas.some((l) => rub(l.rubro_id)?.grupo === g)).map((g) => g.replace('GASTOS ', 'G. ').slice(0, 14)), [{ nombre: 'Presupuestado', color: G().COLORES.AZUL, valores: GRUPOS.filter((g) => lineas.some((l) => rub(l.rubro_id)?.grupo === g)).map((g) => sum(lineas.filter((l) => rub(l.rubro_id)?.grupo === g).map((l) => sum(meses(l).slice(0, k))))) }, { nombre: 'Ejecutado', color: G().COLORES.NARANJA, valores: GRUPOS.filter((g) => lineas.some((l) => rub(l.rubro_id)?.grupo === g)).map((g) => sum(lineas.filter((l) => rub(l.rubro_id)?.grupo === g).map((l) => sum(ejec(l).slice(0, k))))) }]),
        G().columnas('Ingresos presupuestados vs. ejecutados por mes (Q)', M3.slice(0, k), [{ nombre: 'Presupuestado', color: G().COLORES.AZUL, valores: Array.from({ length: k }, (_, i) => sum(lineas.filter((l) => rub(l.rubro_id)?.naturaleza === 'INGRESO').map((l) => meses(l)[i]))) }, { nombre: 'Ejecutado', color: G().COLORES.VERDE, valores: Array.from({ length: k }, (_, i) => sum(lineas.filter((l) => rub(l.rubro_id)?.naturaleza === 'INGRESO').map((l) => ejec(l)[i]))) }])];
      return { ...base, columnas, filas, kpis, graficas, vacio: 'El presupuesto no tiene rubros.' };
    }
    function pintar() {
      const c = cfg;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">
        <div class="cl-banda">${esc(c.titulo)} · ${esc(c.parametros.slice(0, 3).join(' · '))}</div>
        ${c.kpis.length ? `<div class="ec-kpis">${c.kpis.map(([t, v, cls]) => kpi(t, v, cls)).join('')}</div>` : ''}
        ${reporte ? '' : '<p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> «Calcular ejecución» toma las partidas contables vigentes del año en las cuentas vinculadas a cada rubro (Catálogos › Rubros y cuentas contables). Semáforo: ingresos verde ≥ 95 %, ámbar ≥ 80 %; egresos verde ≤ 100 %, ámbar ≤ 110 %.</p>'}
        ${tablaReporte(c, reporte ? f.graficas : false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => {
      const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') { f.ppto = ''; return cargar(); }
      const n = e.target.name;
      if (n === 'anio') { f.anio = Number(e.target.value) || f.anio; f.ppto = ''; return cargar(); }
      if (n === 'ppto') { f.ppto = e.target.value; return cargar(); }
      if (n === 'mes' || n === 'vista') { f[n] = n === 'mes' ? Number(e.target.value) : e.target.value; cfg = construir(); return pintar(); }
      if (n === 'graficas') { f.graficas = e.target.checked; return pintar(); }
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp, reporte ? f.graficas : true);
      if (e.target.closest('[data-accion="calcular"]')) { const { data, error } = await sb.rpc('calcular_ejecucion_presupuesto', { p_id: actual.id }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); window.FIN.aviso(`Ejecución calculada en ${data} rubro(s)`); return cargar(); }
    });
    iniciar();
  }
  window.PANTALLAS['ejecucion-presupuestaria'] = (cont) => ejecucion(cont, false);
  window.PANTALLAS['presupuesto-vs-ejecutado-pf'] = (cont) => ejecucion(cont, true);

  // ===================== Proyección de flujo =====================
  const lunes = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d.toLocaleDateString('en-CA'); };
  const etiquetaPeriodo = (p, i) => { if (p.tipo === 'SEMANAL') { const d = new Date(`${p.fecha_inicio}T12:00:00`); d.setDate(d.getDate() + i * 7); return `S${i + 1} ${d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit' })}`; } const d = new Date(`${p.fecha_inicio}T12:00:00`); d.setMonth(d.getMonth() + i); return `${M3[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`; };
  const rangoPeriodo = (p, i) => { const a = new Date(`${p.fecha_inicio}T12:00:00`); const b = new Date(a); if (p.tipo === 'SEMANAL') { a.setDate(a.getDate() + i * 7); b.setDate(a.getDate() + 6); } else { a.setMonth(a.getMonth() + i); a.setDate(1); if (i === 0) a.setDate(new Date(`${p.fecha_inicio}T12:00:00`).getDate()); b.setFullYear(a.getFullYear(), a.getMonth() + 1, 0); } return [a.toLocaleDateString('en-CA'), b.toLocaleDateString('en-CA')]; };
  function calcularFlujo(p, rubros, lineas, esc0) {
    const fi = Number(esc0?.factor_ingresos) || 1, fe = Number(esc0?.factor_egresos) || 1;
    const per = Array.from({ length: p.periodos }, (_, i) => i + 1);
    const val = (r, k) => num(lineas.find((l) => l.rubro_flujo_id === r.id && l.periodo === k)?.monto);
    const ent = per.map((k) => sum(rubros.filter((r) => r.tipo === 'ENTRADA').map((r) => val(r, k))) * fi);
    const sal = per.map((k) => sum(rubros.filter((r) => r.tipo === 'SALIDA').map((r) => val(r, k))) * fe);
    let s = num(p.saldo_inicial); const ini = [], fin = [];
    per.forEach((k, i) => { ini.push(s); s += ent[i] - sal[i]; fin.push(s); });
    return { per, val, ent, sal, ini, fin, fi, fe };
  }
  window.PANTALLAS['proyeccion-de-flujo'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Proyección de flujo de efectivo', icono: 'ti-timeline', clase: 'bk-movimientos bm-solo cx-rep pr-rep pf-flujo', grupo: 'Presupuesto y Flujo · Registros' });
    const { sb } = ctx;
    let lista = [], actual = null, rubros = [], lineas = [], escenarios = [], nuevo = false, graficas = true;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar(id = actual?.id) {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-timeline'); return; }
      const [p, r, e] = await Promise.all([sb.from('flujo_proyecciones').select('*').eq('localidad_id', ctx.sel.loc).neq('estado', 'ANULADA').order('numero', { ascending: false }), sb.from('rubros_flujo').select('*').eq('localidad_id', ctx.sel.loc).eq('activo', true).order('codigo'), sb.from('escenarios_presupuesto').select('*').eq('localidad_id', ctx.sel.loc).eq('activo', true).order('codigo')]);
      if (p.error) return faltaScript(ctx, p.error);
      lista = p.data || []; rubros = r.data || []; escenarios = e.data || [];
      actual = lista.find((x) => x.id === id) || lista[0] || null; nuevo = false;
      lineas = actual ? await leerTodo(() => sb.from('flujo_lineas').select('*').eq('proyeccion_id', actual.id).order('id')) : [];
      ctx.filtros(`<label class="campo"><span>Proyección</span><select name="proy">${lista.map((x) => `<option value="${x.id}" ${actual?.id === x.id ? 'selected' : ''}>No. ${x.numero} · ${esc(x.nombre)} · ${x.estado}</option>`).join('') || '<option value="">Sin proyecciones</option>'}</select></label><label class="pc-check"><input type="checkbox" name="graficas" ${graficas ? 'checked' : ''}> Gráficas</label>`,
        `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva proyección</button>' : ''}${botonesExp}`);
      pintar();
    }
    function cfgFlujo() {
      const p = actual, esc0 = escenarios.find((x) => x.codigo === p.escenario), F = calcularFlujo(p, rubros, lineas, esc0);
      const filas = [];
      ['OPERACIÓN', 'INVERSIÓN', 'FINANCIAMIENTO'].forEach((a) => { const rs = rubros.filter((r) => r.actividad === a); if (!rs.length) return; filas.push({ valores: [`Actividades de ${a.toLowerCase()}`], tipo: 'grupo', combinar: true });
        rs.forEach((r) => filas.push({ valores: [`${r.tipo === 'ENTRADA' ? '(+)' : '(−)'} ${r.nombre}${r.origen !== 'MANUAL' ? ' · automático' : ''}`, ...F.per.map((k) => r2(F.val(r, k))), r2(sum(F.per.map((k) => F.val(r, k))))], rubro: r.id })); });
      filas.push({ valores: ['Saldo inicial', ...F.ini.map(r2), r2(F.ini[0])], tipo: 'subtotal' });
      filas.push({ valores: [`Total entradas${F.fi !== 1 ? ` (× ${F.fi})` : ''}`, ...F.ent.map(r2), r2(sum(F.ent))], tipo: 'subtotal' });
      filas.push({ valores: [`Total salidas${F.fe !== 1 ? ` (× ${F.fe})` : ''}`, ...F.sal.map(r2), r2(sum(F.sal))], tipo: 'subtotal' });
      filas.push({ valores: ['Flujo neto', ...F.per.map((k, i) => r2(F.ent[i] - F.sal[i])), r2(sum(F.ent) - sum(F.sal))], tipo: 'subtotal' });
      filas.push({ valores: ['SALDO FINAL PROYECTADO', ...F.fin.map(r2), r2(F.fin[F.fin.length - 1])], tipo: 'total' });
      const bajo = F.fin.map((v, i) => (v < num(p.saldo_minimo) ? i : -1)).filter((i) => i >= 0);
      return { F, bajo, titulo: `Flujo de efectivo proyectado · ${p.nombre}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Flujo proyectado', archivo: `flujo_proyectado_${p.numero}`, firmas: ['Elaboró', 'Revisó (Tesorería)', 'Aprobó'],
        parametros: [`Empresa: ${empresaDe(ctx)}`, `${p.periodos} ${p.tipo === 'SEMANAL' ? 'semanas' : 'meses'} desde ${fmt.fechaDia(p.fecha_inicio)}`, `Escenario: ${p.escenario}`, `Saldo mínimo: ${q(p.saldo_minimo)}`, `Estado: ${p.estado}`],
        columnas: [col('Concepto', 'texto', 34), ...F.per.map((k, i) => col(etiquetaPeriodo(p, i), 'monto', 12)), col('Total', 'monto', 14)], filas,
        graficas: [G().linea('Saldo final proyectado (Q)', F.fin.map((v, i) => ({ x: etiquetaPeriodo(p, i), y: v }))), G().columnas('Entradas y salidas por período (Q)', F.per.map((k, i) => etiquetaPeriodo(p, i)), [{ nombre: 'Entradas', color: G().COLORES.VERDE, valores: F.ent }, { nombre: 'Salidas', color: G().COLORES.NARANJA, valores: F.sal }])] };
    }
    function pintar() {
      if (nuevo) return pintarNueva();
      const p = actual;
      if (!p) { ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="ck-elige"><i class="ti ti-timeline" aria-hidden="true"></i> No hay proyecciones. ${ctx.admin ? 'Crea una con «Nueva proyección» (13 semanas es la práctica de tesorería).' : ''}</p></div>`; return; }
      if (!rubros.length) { ctx.pDet.innerHTML = '<div class="bm-form cx-form cl-clasico"><p class="ck-elige">Faltan los rubros de flujo: ve a Catálogos › Rubros de flujo y presiona «Cargar los de la norma».</p></div>'; return; }
      const c = cfgFlujo(), F = c.F, ed = ctx.admin && p.estado === 'BORRADOR';
      const minimo = Math.min(...F.fin);
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">
        <section class="pr-cab"><div class="pr-id"><small>Proyección</small><b>No. ${p.numero}</b>${marca(p.estado === 'APROBADA' ? 'APROBADO' : 'FORMULACIÓN').replace(/>[^<]+</, `>${p.estado}<`)}</div>
          <div class="pr-datos"><span><small>Nombre</small>${esc(p.nombre)}</span><span><small>Horizonte</small>${p.periodos} ${p.tipo === 'SEMANAL' ? 'semanas' : 'meses'} desde ${esc(fmt.fechaDia(p.fecha_inicio))}</span><span><small>Escenario</small>${esc(p.escenario)}</span>
            <span><small>Saldo inicial</small>${ed ? `<input type="number" step="0.01" data-p="saldo_inicial" value="${p.saldo_inicial}">` : q(p.saldo_inicial)}</span><span><small>Saldo mínimo</small>${ed ? `<input type="number" step="0.01" data-p="saldo_minimo" value="${p.saldo_minimo}">` : q(p.saldo_minimo)}</span>
            <span><small>Cobros y pagos</small>${p.cargado_en ? `cargados ${esc(new Date(p.cargado_en).toLocaleString('es-GT'))}` : 'sin cargar'}</span></div>
          <div class="pr-acc">${ed ? '<button type="button" class="boton secundario-sm" data-accion="cargar"><i class="ti ti-download" aria-hidden="true"></i> Cargar cobros y pagos</button><button type="button" class="boton secundario-sm" data-accion="saldo"><i class="ti ti-building-bank" aria-hidden="true"></i> Saldo de bancos</button><button type="button" class="boton primario-sm" data-accion="aprobar"><i class="ti ti-check" aria-hidden="true"></i> Aprobar</button>' : ''}${ctx.admin && p.estado !== 'ANULADA' ? '<button type="button" class="boton secundario-sm" data-accion="anular"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>' : ''}</div></section>
        <div class="ec-kpis">${kpi('Entradas', q(sum(F.ent)))}${kpi('Salidas', q(sum(F.sal)))}${kpi('Flujo neto', q(sum(F.ent) - sum(F.sal)), sum(F.ent) >= sum(F.sal) ? 'ec-fin' : 'ec-alerta')}${kpi('Saldo final', q(F.fin[F.fin.length - 1]))}${kpi('Saldo más bajo', q(minimo), c.bajo.length ? 'ec-alerta' : 'ec-fin')}</div>
        ${c.bajo.length ? `<p class="pr-guia pc-rojo"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Déficit de liquidez: el saldo queda bajo el mínimo en ${c.bajo.map((i) => etiquetaPeriodo(p, i)).join(', ')}. Prevé financiamiento, adelanta cobros o reprograma pagos.</p>` : ''}
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla pf-grid"><table><thead><tr>${c.columnas.map((x) => `<th class="${x.tipo === 'texto' ? '' : 'num'}">${esc(x.titulo)}</th>`).join('')}</tr></thead><tbody>
          ${c.filas.map((r) => (r.tipo === 'grupo' ? `<tr class="pr-g"><td colspan="${c.columnas.length}">${esc(r.valores[0])}</td></tr>` : `<tr class="${r.tipo === 'subtotal' ? 'pr-s' : r.tipo === 'total' ? 'pr-t' : ''}" ${r.rubro ? `data-r="${r.rubro}"` : ''}><td>${esc(r.valores[0])}</td>${r.valores.slice(1).map((v, i) => (r.rubro && ed && i < F.per.length ? `<td class="num"><input type="number" step="0.01" data-k="${i + 1}" value="${v || ''}"></td>` : `<td class="num${(r.tipo === 'total' && c.bajo.includes(i)) || v < 0 ? ' pc-rojo' : ''}">${fmt.monto(v)}</td>`)).join('')}</tr>`)).join('')}
        </tbody></table>${graficas ? `<section class="pr-graficas"><h3><i class="ti ti-chart-bar" aria-hidden="true"></i> Gráficas</h3>${c.graficas.join('')}</section>` : ''}</div></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    function pintarNueva() {
      ctx.pDet.innerHTML = `<form class="bm-form cx-form cl-clasico pr-nueva pf-nueva" novalidate><div class="cl-banda">Nueva proyección de flujo</div><div class="pr-nueva-c">
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> La práctica de tesorería es proyectar 13 semanas (un trimestre) para la liquidez inmediata y 12 meses para el plan anual. Los cobros y pagos se cargan de las cuentas por cobrar y por pagar.</p>
        <label class="campo pr-desc"><span>Nombre *</span><input name="nombre" maxlength="120" value="Flujo 13 semanas desde ${fmt.fechaDia(lunes())}"></label>
        <label class="campo"><span>Tipo</span><select name="tipo"><option value="SEMANAL">Semanal (13 semanas)</option><option value="MENSUAL">Mensual (12 meses)</option></select></label>
        <label class="campo"><span>Fecha de inicio</span><input type="date" name="fecha" value="${lunes()}"></label>
        <label class="campo"><span>Escenario</span><select name="escenario">${(escenarios.length ? escenarios : [{ codigo: 'BASE', nombre: 'ESCENARIO BASE' }]).map((x) => `<option value="${x.codigo}">${esc(x.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Saldo mínimo de caja Q</span><input type="number" name="minimo" value="0" step="0.01"></label>
        <p class="modal-error tk-error" role="alert"></p>
        <div class="pr-nueva-acc"><button type="button" class="boton secundario-sm" data-accion="cancelar">Cancelar</button><button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Crear proyección</button></div></div></form>`;
    }
    // Saldo de caja y bancos según la contabilidad al día anterior al inicio.
    async function saldoBancos() {
      const d = new Date(`${actual.fecha_inicio}T12:00:00`); d.setDate(d.getDate() - 1);
      const C = await leerConta(sb, ctx.sel.loc, d.toLocaleDateString('en-CA'));
      const s = C.saldos(() => true);
      return r2(sum(C.efectivo.map((c) => s.get(c.codigo) || 0)));
    }
    cont.addEventListener('change', async (e) => {
      const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(null);
      if (e.target.name === 'proy') return cargar(Number(e.target.value));
      if (e.target.name === 'graficas') { graficas = e.target.checked; return pintar(); }
      if (e.target.dataset.p) { const { error } = await sb.from('flujo_proyecciones').update({ [e.target.dataset.p]: num(e.target.value) }).eq('id', actual.id); if (error) return window.FIN.aviso(window.UI.traducirError(error)); actual[e.target.dataset.p] = num(e.target.value); return pintar(); }
      if (e.target.dataset.k) {
        const r = Number(e.target.closest('tr').dataset.r), k = Number(e.target.dataset.k);
        const { error } = await sb.from('flujo_lineas').upsert({ proyeccion_id: actual.id, rubro_flujo_id: r, periodo: k, monto: num(e.target.value), automatico: false }, { onConflict: 'proyeccion_id,rubro_flujo_id,periodo' });
        if (error) return window.FIN.aviso(window.UI.traducirError(error));
        const l = lineas.find((x) => x.rubro_flujo_id === r && x.periodo === k); if (l) l.monto = num(e.target.value); else lineas.push({ rubro_flujo_id: r, periodo: k, monto: num(e.target.value) });
        pintar();
      }
    });
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('.pf-nueva')) return; e.preventDefault();
      const el = e.target.elements;
      await sb.rpc('asegurar_catalogos_flujo', { p_localidad: ctx.sel.loc });
      const { data, error } = await sb.from('flujo_proyecciones').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, numero: 0, nombre: el.nombre.value.trim() || 'Proyección', tipo: el.tipo.value, periodos: el.tipo.value === 'SEMANAL' ? 13 : 12, fecha_inicio: el.fecha.value, escenario: el.escenario.value, saldo_minimo: num(el.minimo.value) }).select('id').single();
      if (error) { e.target.querySelector('.modal-error').textContent = window.UI.traducirError(error); return; }
      actual = { id: data.id, fecha_inicio: el.fecha.value };
      try { const s = await saldoBancos(); await sb.from('flujo_proyecciones').update({ saldo_inicial: s }).eq('id', data.id); } catch { /* sin contabilidad */ }
      await sb.rpc('cargar_flujo_automatico', { p_id: data.id });
      window.FIN.aviso('Proyección creada con el saldo de bancos, los cobros y los pagos'); cargar(data.id);
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return actual ? exportar(cfgFlujo(), ex.dataset.exp, graficas) : null;
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'nueva') { nuevo = true; return pintar(); }
      if (a === 'cancelar') { nuevo = false; return pintar(); }
      if (a === 'cargar') { const { data, error } = await sb.rpc('cargar_flujo_automatico', { p_id: actual.id }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); window.FIN.aviso(`Cobros ${q(data.cobros)} · pagos ${q(data.pagos)}`); return cargar(); }
      if (a === 'saldo') { try { const s = await saldoBancos(); if (!confirm(`Saldo de caja y bancos según la contabilidad: ${q(s)}. ¿Usarlo como saldo inicial?`)) return; await sb.from('flujo_proyecciones').update({ saldo_inicial: s }).eq('id', actual.id); return cargar(); } catch (err) { return window.FIN.aviso(window.UI.traducirError(err)); } }
      if (a === 'aprobar' || a === 'anular') { if (!confirm(a === 'aprobar' ? '¿Aprobar la proyección? Ya no se modifica.' : '¿Anular la proyección?')) return; const { error } = await sb.from('flujo_proyecciones').update({ estado: a === 'aprobar' ? 'APROBADA' : 'ANULADA' }).eq('id', actual.id); if (error) return window.FIN.aviso(window.UI.traducirError(error)); return cargar(a === 'aprobar' ? actual.id : null); }
    });
    iniciar();
  };

  // ===================== Reportes contables del módulo =====================
  function reporteConta(cont, id) {
    const T = { 'estado-flujo-efectivo': ['Estado de flujo de efectivo', 'ti-arrows-exchange-2'], 'flujo-proyectado-vs-real': ['Flujo proyectado vs. real', 'ti-chart-arrows'], 'indicadores-financieros': ['Indicadores financieros', 'ti-gauge'] }[id];
    const ctx = montar(cont, { titulo: T[0], icono: T[1], clase: 'bk-movimientos bm-solo cx-rep pr-rep cr-conta pf-rep', grupo: 'Presupuesto y Flujo · Reportes' });
    const { sb } = ctx;
    const hoy = fmt.hoy();
    const f = { desde: `${hoy.slice(0, 4)}-01-01`, fecha: hoy, proy: '', graficas: true };
    let C = null, cargado = '', cfg = null, proys = [];
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', T[1]); return; }
      if (id === 'flujo-proyectado-vs-real') { const { data, error } = await sb.from('flujo_proyecciones').select('*').eq('localidad_id', ctx.sel.loc).neq('estado', 'ANULADA').order('numero', { ascending: false }); if (error) return faltaScript(ctx, error); proys = data || []; if (!proys.some((p) => String(p.id) === String(f.proy))) f.proy = proys[0]?.id || ''; }
      ctx.filtros(`${id === 'flujo-proyectado-vs-real' ? `<label class="campo"><span>Proyección</span><select name="proy">${proys.map((p) => `<option value="${p.id}" ${String(f.proy) === String(p.id) ? 'selected' : ''}>No. ${p.numero} · ${esc(p.nombre)}</option>`).join('') || '<option value="">Sin proyecciones</option>'}</select></label>` : ''}
        ${id === 'estado-flujo-efectivo' ? `<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}" max="${f.fecha}"></label>` : ''}
        ${id !== 'flujo-proyectado-vs-real' ? `<label class="campo"><span>${id === 'indicadores-financieros' ? 'Al (fecha de corte)' : 'Al'}</span><input type="date" name="fecha" value="${f.fecha}" max="${hoy}"></label>` : ''}
        <label class="pc-check"><input type="checkbox" name="graficas" ${f.graficas ? 'checked' : ''}> Gráficas</label>`, botonesExp);
      await consultar();
    }
    async function consultar() {
      const p = proys.find((x) => String(x.id) === String(f.proy));
      const hasta = id === 'flujo-proyectado-vs-real' && p ? rangoPeriodo(p, p.periodos - 1)[1] : f.fecha;
      const clave = `${ctx.sel.loc}|${hasta}`;
      if (clave !== cargado) { ctx.pDet.innerHTML = '<p class="vacio">Leyendo la contabilidad…</p>'; try { C = await leerConta(sb, ctx.sel.loc, hasta); cargado = clave; } catch (e) { ctx.pDet.innerHTML = `<p class="vacio">${esc(window.UI.traducirError(e))}</p>`; return; } }
      try { cfg = id === 'estado-flujo-efectivo' ? flujoNIC7() : id === 'indicadores-financieros' ? indicadores() : await proyVsReal(p); } catch (e) { ctx.pDet.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }
      pintar();
    }
    const base = (extra) => ({ titulo: T[0], orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: T[0].slice(0, 30), archivo: `${id}_${f.fecha}`, parametros: [`Empresa: ${empresaDe(ctx)}`, ...extra] });
    // NIC 7, método indirecto: resultado del período + variaciones del balance (sin efectivo) clasificadas por actividad.
    function flujoNIC7() {
      if (!C.activo) throw new Error('No hay movimientos contables (o el catálogo no tiene los tipos de cuenta de balance).');
      const antes = C.saldos((l) => l.fecha < f.desde), fin = C.saldos((l) => l.fecha <= f.fecha), per = C.saldos((l) => l.fecha >= f.desde && l.fecha <= f.fecha);
      const resultado = -sum(C.resultadoCods.map((k) => per.get(k) || 0));
      const efe = new Set(C.efectivo.map((c) => c.codigo));
      const nivel3 = (cl) => (cl ? [...C.porCodigo.values()].filter((c) => c.nivel === 3 && c.codigo.startsWith(cl.codigo) && !efe.has(c.codigo)) : []);
      const varCaja = (c) => -((fin.get(c.codigo) || 0) - (antes.get(c.codigo) || 0)); // aumento de activo = salida; aumento de pasivo = entrada
      const enCorr = (cl, c) => cl && c.codigo.startsWith(cl.codigo);
      const op = [], inv = [], fin2 = [];
      nivel3(C.activo).forEach((c) => (enCorr(C.acCorr, c) ? op : inv).push(c));
      nivel3(C.pasivo).forEach((c) => (enCorr(C.paCorr, c) ? op : fin2).push(c));
      nivel3(C.patrimonio).forEach((c) => fin2.push(c));
      const filas = []; const fila = (c) => ({ valores: [c.codigo, `   ${c.nombre}`, r2(varCaja(c))] });
      const bloque = (t, cs, extra = []) => { filas.push({ valores: [t], tipo: 'grupo', combinar: true }); extra.forEach((x) => filas.push(x)); const vs = cs.filter((c) => Math.abs(varCaja(c)) >= 0.005); vs.forEach((c) => filas.push(fila(c))); const tot = sum(extra.map((x) => x.valores[2])) + sum(vs.map(varCaja)); filas.push({ valores: [`Efectivo neto de actividades de ${t.split(' de ').pop().toLowerCase()}`, '', r2(tot)], tipo: 'subtotal' }); return tot; };
      const tOp = bloque('ACTIVIDADES DE OPERACIÓN', op, [{ valores: ['', 'Resultado del período', r2(resultado)] }]);
      const tInv = bloque('ACTIVIDADES DE INVERSIÓN', inv);
      const tFin = bloque('ACTIVIDADES DE FINANCIAMIENTO', fin2);
      const neto = tOp + tInv + tFin;
      const ei = sum(C.efectivo.map((c) => antes.get(c.codigo) || 0)), ef = sum(C.efectivo.map((c) => fin.get(c.codigo) || 0));
      filas.push({ valores: ['AUMENTO (DISMINUCIÓN) NETO DEL EFECTIVO', '', r2(neto)], tipo: 'total' });
      filas.push({ valores: ['', 'Efectivo al inicio del período', r2(ei)] });
      filas.push({ valores: ['EFECTIVO AL FINAL DEL PERÍODO', '', r2(ei + neto)], tipo: 'total' });
      const dif = r2(ef - (ei + neto));
      return { ...base([`Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.fecha)}`, 'NIC 7 · método indirecto']), firmas: ['Representante legal', 'Contador general'], filas,
        columnas: [col('Cuenta', 'texto', 12), col('Concepto', 'texto', 56), col('Q', 'monto', 18)],
        kpis: [['Operación', q(tOp), tOp >= 0 ? 'ec-fin' : 'ec-alerta'], ['Inversión', q(tInv)], ['Financiamiento', q(tFin)], ['Variación del efectivo', q(neto)], ['Comprobación con bancos', Math.abs(dif) < 0.01 ? 'Cuadra' : `Dif. ${q(dif)}`, Math.abs(dif) < 0.01 ? 'ec-fin' : 'ec-alerta']],
        graficas: [G().barras('Flujo por actividad (Q)', [['Operación', tOp], ['Inversión', tInv], ['Financiamiento', tFin]].map(([t, v]) => ({ etiqueta: t, valor: Math.abs(v), texto: q(v) })))] };
    }
    function indicadores() {
      if (!C.activo) throw new Error('No hay movimientos contables para calcular indicadores.');
      const s = C.saldos(() => true), ini = `${f.fecha.slice(0, 4)}-01-01`, per = C.saldos((l) => l.fecha >= ini);
      const v = (cl, signo = 1) => (cl ? signo * (s.get(cl.codigo) || 0) : 0);
      const A = v(C.activo), P = v(C.pasivo, -1), Pt = v(C.patrimonio, -1), AC = v(C.acCorr), PC = v(C.paCorr, -1);
      const inv = sum(C.inventario.map((c) => s.get(c.codigo) || 0)), efe = sum(C.efectivo.map((c) => s.get(c.codigo) || 0));
      const res = -sum(C.resultadoCods.map((k) => per.get(k) || 0));
      const PtT = Pt - sum(C.resultadoCods.map((k) => s.get(k) || 0)); // patrimonio con los resultados acumulados (cuadra con activo − pasivo)
      const ventas = (() => { const ing = [...C.porCodigo.values()].filter((c) => c.nivel === 1 && c.reporte === 'E' && c.nat === -1).sort((x, y) => x.codigo.localeCompare(y.codigo))[0]; return ing ? -(per.get(ing.codigo) || 0) : 0; })();
      const cxc = sum([...C.porCodigo.values()].filter((c) => C.acCorr && c.nivel === 3 && c.codigo.startsWith(C.acCorr.codigo) && /COBRAR|CLIENTE/i.test(c.nombre)).map((c) => s.get(c.codigo) || 0));
      const dias = Math.max(1, Math.round((new Date(`${f.fecha}T12:00:00`) - new Date(`${ini}T12:00:00`)) / 864e5) + 1);
      const I = [
        ['Liquidez corriente', 'Activo corriente ÷ pasivo corriente', PC ? AC / PC : null, 'veces', (x) => (x >= 1.5 ? 'verde' : x >= 1 ? 'ambar' : 'rojo'), '≥ 1.5'],
        ['Prueba ácida', '(Activo corriente − inventarios) ÷ pasivo corriente', PC ? (AC - inv) / PC : null, 'veces', (x) => (x >= 1 ? 'verde' : x >= 0.7 ? 'ambar' : 'rojo'), '≥ 1.0'],
        ['Liquidez inmediata', 'Efectivo ÷ pasivo corriente', PC ? efe / PC : null, 'veces', (x) => (x >= 0.2 ? 'verde' : x >= 0.1 ? 'ambar' : 'rojo'), '≥ 0.2'],
        ['Capital de trabajo', 'Activo corriente − pasivo corriente', AC - PC, 'Q', (x) => (x > 0 ? 'verde' : 'rojo'), '> 0'],
        ['Endeudamiento', 'Pasivo ÷ activo', A ? P / A : null, '%', (x) => (x <= 0.6 ? 'verde' : x <= 0.75 ? 'ambar' : 'rojo'), '≤ 60 %'],
        ['Autonomía (solvencia)', 'Patrimonio ÷ activo', A ? PtT / A : null, '%', (x) => (x >= 0.4 ? 'verde' : x >= 0.25 ? 'ambar' : 'rojo'), '≥ 40 %'],
        ['Margen neto', 'Resultado del ejercicio ÷ ingresos', ventas ? res / ventas : null, '%', (x) => (x >= 0.1 ? 'verde' : x >= 0 ? 'ambar' : 'rojo'), '≥ 10 %'],
        ['Rentabilidad sobre activos (ROA)', 'Resultado ÷ activo', A ? res / A : null, '%', (x) => (x >= 0.05 ? 'verde' : x >= 0 ? 'ambar' : 'rojo'), '≥ 5 %'],
        ['Rentabilidad sobre patrimonio (ROE)', 'Resultado ÷ patrimonio', PtT ? res / PtT : null, '%', (x) => (x >= 0.12 ? 'verde' : x >= 0 ? 'ambar' : 'rojo'), '≥ 12 %'],
        ['Días de cobro', 'Cuentas por cobrar ÷ ingresos × días', ventas ? (cxc / ventas) * dias : null, 'días', (x) => (x <= 45 ? 'verde' : x <= 75 ? 'ambar' : 'rojo'), '≤ 45 días']];
      const txt = (x, u) => (x == null ? '—' : u === '%' ? `${(x * 100).toFixed(1)} %` : u === 'Q' ? q(x) : u === 'días' ? `${Math.round(x)} días` : `${x.toFixed(2)} veces`);
      const filas = I.map(([n, fml, x, u, sem, ref]) => ({ valores: [n, fml, txt(x, u), ref, `§${x == null ? '' : sem(x)}`], resaltar: x != null && sem(x) === 'rojo' }));
      return { ...base([`Al ${fmt.fechaDia(f.fecha)}`, `Resultado del ${fmt.fechaDia(ini)} al ${fmt.fechaDia(f.fecha)}`]), filas, firmas: ['Contador general', 'Gerencia financiera'],
        columnas: [col('Indicador', 'texto', 30), col('Fórmula', 'texto', 44), col('Resultado', 'texto', 16), col('Referencia', 'texto', 12), col('Estado', 'texto', 8)],
        kpis: [['Activo', q(A)], ['Pasivo', q(P)], ['Patrimonio (con resultados)', q(PtT)], ['Capital de trabajo', q(AC - PC), AC - PC > 0 ? 'ec-fin' : 'ec-alerta']],
        graficas: [G().barras('Estructura: activo corriente, pasivo corriente y efectivo (Q)', [['Activo corriente', AC], ['Pasivo corriente', PC], ['Efectivo', efe], ['Inventarios', inv]].map(([t, x]) => ({ etiqueta: t, valor: Math.abs(x), texto: q(x) })))] };
    }
    async function proyVsReal(p) {
      if (!p) return { ...base([]), filas: [], columnas: [col('Período', 'texto')], kpis: [], vacio: 'No hay proyecciones de flujo (Registros › Proyección de flujo).' };
      const [r, l, e] = await Promise.all([sb.from('rubros_flujo').select('*').eq('localidad_id', ctx.sel.loc).order('codigo'), leerTodo(() => sb.from('flujo_lineas').select('*').eq('proyeccion_id', p.id).order('id')), sb.from('escenarios_presupuesto').select('*').eq('localidad_id', ctx.sel.loc)]);
      const F = calcularFlujo(p, r.data || [], l, (e.data || []).find((x) => x.codigo === p.escenario));
      const efe = new Set(C.efectivo.map((c) => c.codigo));
      const filas = []; let rs = num(p.saldo_inicial), te = [0, 0, 0, 0];
      const realE = [], realS = [];
      F.per.forEach((k, i) => {
        const [a, b] = rangoPeriodo(p, i);
        const mv = C.ls.filter((x) => efe.has(x.codigo) && x.fecha >= a && x.fecha <= b);
        const en = sum(mv.map((x) => x.d)), sa = sum(mv.map((x) => x.h)); realE.push(en); realS.push(sa);
        rs += en - sa; te = [te[0] + F.ent[i], te[1] + en, te[2] + F.sal[i], te[3] + sa];
        const pe = F.ent[i] ? en / F.ent[i] : null;
        filas.push({ valores: [etiquetaPeriodo(p, i), r2(F.ent[i]), r2(en), r2(en - F.ent[i]), r2(F.sal[i]), r2(sa), r2(sa - F.sal[i]), r2(F.fin[i]), r2(rs), `§${b > f.fecha ? '' : semaforo('INGRESO', pe)}`] });
      });
      filas.push({ valores: ['Total', r2(te[0]), r2(te[1]), r2(te[1] - te[0]), r2(te[2]), r2(te[3]), r2(te[3] - te[2]), '', '', ''], tipo: 'total' });
      return { ...base([`Proyección No. ${p.numero} · ${p.nombre}`, `Escenario ${p.escenario}`, 'Real: movimientos de las cuentas de caja y bancos']), filas,
        columnas: [col('Período', 'texto', 14), col('Entradas proyectadas', 'monto', 15), col('Entradas reales', 'monto', 15), col('Variación', 'monto', 13), col('Salidas proyectadas', 'monto', 15), col('Salidas reales', 'monto', 15), col('Variación', 'monto', 13), col('Saldo proyectado', 'monto', 15), col('Saldo real', 'monto', 15), col('', 'texto', 4)],
        kpis: [['Entradas: real / proyectado', te[0] ? `${((te[1] / te[0]) * 100).toFixed(1)} %` : '—'], ['Salidas: real / proyectado', te[2] ? `${((te[3] / te[2]) * 100).toFixed(1)} %` : '—'], ['Saldo final proyectado', q(F.fin[F.fin.length - 1])], ['Saldo real', q(rs)]],
        graficas: [G().columnas('Entradas proyectadas vs. reales (Q)', F.per.map((k, i) => etiquetaPeriodo(p, i)), [{ nombre: 'Proyectado', color: G().COLORES.AZUL, valores: F.ent }, { nombre: 'Real', color: G().COLORES.VERDE, valores: realE }]), G().columnas('Salidas proyectadas vs. reales (Q)', F.per.map((k, i) => etiquetaPeriodo(p, i)), [{ nombre: 'Proyectado', color: G().COLORES.AZUL, valores: F.sal }, { nombre: 'Real', color: G().COLORES.NARANJA, valores: realS }])] };
    }
    function pintar() {
      const c = cfg;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="cl-banda">${esc(c.titulo)} · ${esc(c.parametros.slice(0, 3).join(' · '))}</div>
        ${c.kpis?.length ? `<div class="ec-kpis">${c.kpis.map(([t, v, cls]) => kpi(t, v, cls)).join('')}</div>` : ''}
        ${id === 'estado-flujo-efectivo' ? '<p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Método indirecto (NIC 7): parte del resultado del período y suma las variaciones del balance; operación = capital de trabajo, inversión = activo no corriente, financiamiento = pasivo no corriente y patrimonio. El efectivo final se compara con el saldo de caja y bancos.</p>' : ''}
        ${tablaReporte(c, f.graficas)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => {
      const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') { cargado = ''; return cargar(); }
      const n = e.target.name;
      if (n === 'desde' || n === 'fecha') { f[n] = e.target.value || (n === 'fecha' ? hoy : f.desde); if (f.desde > f.fecha) f.desde = `${f.fecha.slice(0, 4)}-01-01`; return consultar(); }
      if (n === 'proy') { f.proy = e.target.value; return consultar(); }
      if (n === 'graficas') { f.graficas = e.target.checked; return pintar(); }
    });
    cont.addEventListener('click', (e) => { const ex = e.target.closest('[data-exp]'); if (ex) exportar(cfg, ex.dataset.exp, f.graficas); });
    iniciar();
  }
  ['estado-flujo-efectivo', 'flujo-proyectado-vs-real', 'indicadores-financieros'].forEach((k) => { window.PANTALLAS[k] = (cont) => reporteConta(cont, k); });
})();
