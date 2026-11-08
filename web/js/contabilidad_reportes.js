// Contabilidad · Reportes y gráficas: Libro diario, Libro mayor, Balanza de comprobación, Balance general,
// Estado de resultados y Presupuesto vs. ejecutado.
// Parámetros: organización y localidad; alcance (la empresa o consolidado de todas las localidades de la
// organización); fechas (desde el 1 de enero y al día de hoy, o «al» para el balance); nivel de cuentas; contenido
// (detallado o resumido); partidas (todas las vigentes o solo aprobadas). Vista previa estructurada, PDF y Excel con
// gráficas al final. Saldos según la naturaleza del tipo de cuenta (DEBE-HABER o HABER-DEBE); el balance incluye el
// resultado del ejercicio y el de ejercicios anteriores no cerrados, con la comprobación de cuadre.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const G = () => window.GRAFICAS;
  const sang = (n) => ' '.repeat(Math.max(0, n) * 3);
  const MAX_VISTA = 2000;

  const REPORTES = {
    'libro-diario': { titulo: 'Libro diario', icono: 'ti-notebook', periodo: true, contenido: true },
    'libro-mayor': { titulo: 'Libro mayor', icono: 'ti-book-2', periodo: true, contenido: true, cuenta: true },
    'balanza-de-comprobacion': { titulo: 'Balanza de comprobación', icono: 'ti-scale', periodo: true, nivel: true },
    'balance-general': { titulo: 'Balance general', icono: 'ti-building-bank', periodo: false, nivel: true },
    'estado-de-resultados': { titulo: 'Estado de resultados', icono: 'ti-chart-line', periodo: true, nivel: true, mensual: true },
    'presupuesto-vs-ejecutado': { titulo: 'Presupuesto vs. ejecutado', icono: 'ti-target-arrow', presupuesto: true }
  };

  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) { const { data, error } = await hacer().range(i, i + 999); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; }
    return out;
  }

  function reporte(cont, id) {
    const R = REPORTES[id];
    const ctx = montar(cont, { titulo: R.titulo, icono: R.icono, clase: 'bk-movimientos bm-solo cx-rep pr-rep cr-conta', grupo: 'Contabilidad · Reportes' });
    const { sb } = ctx;
    const hoy = fmt.hoy();
    const f = { alcance: 'EMPRESA', desde: `${hoy.slice(0, 4)}-01-01`, fecha: hoy, nivel: R.nivel ? 3 : 5, contenido: 'DETALLADO', aprobadas: false, cuenta: '', vista: 'PERIODO', anio: Number(hoy.slice(0, 4)), presupuesto: '', graficas: true };
    let base = null, cargado = '', cfg = null, presupuestos = [];
    const empresa = () => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
    const organizacion = () => ctx.organizaciones.find((o) => o.id === ctx.sel.org);
    const locs = () => (f.alcance === 'CONSOLIDADO' ? ctx.localidades.filter((l) => l.organizacion_id === ctx.sel.org).map((l) => l.id) : [ctx.sel.loc]);
    const alcanceTxt = () => (f.alcance === 'CONSOLIDADO' ? `Consolidado: ${organizacion()?.nombre || ''} (${locs().length} localidades)` : `Empresa: ${empresa()}`);

    function pintarFiltros() {
      const cuentasOpc = base ? [...base.porCodigo.values()].filter((c) => !c.integra).sort((a, b) => a.codigo.localeCompare(b.codigo)) : [];
      ctx.filtros(`${R.presupuesto ? '' : `<label class="campo"><span>Alcance</span><select name="alcance"><option value="EMPRESA" ${f.alcance === 'EMPRESA' ? 'selected' : ''}>Empresa</option><option value="CONSOLIDADO" ${f.alcance === 'CONSOLIDADO' ? 'selected' : ''}>Consolidado organización</option></select></label>`}
        ${R.presupuesto ? `<label class="campo cx-anio"><span>Año</span><input type="number" name="anio" min="2000" max="2999" value="${f.anio}"></label>
          <label class="campo"><span>Presupuesto</span><select name="presupuesto"><option value="">Todos los del año</option>${presupuestos.map((p) => `<option value="${p.id}" ${String(f.presupuesto) === String(p.id) ? 'selected' : ''}>No. ${p.numero} · ${esc(p.tipo || '')} ${esc(p.periodo || '')}</option>`).join('')}</select></label>` : ''}
        ${R.periodo ? `<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}" max="${f.fecha}"></label>` : ''}
        ${R.presupuesto ? '' : `<label class="campo"><span>${R.periodo ? 'Al' : 'Al (fecha de corte)'}</span><input type="date" name="fecha" value="${f.fecha}" max="${hoy}"></label>`}
        ${R.nivel ? `<label class="campo"><span>Nivel</span><select name="nivel">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${f.nivel === n ? 'selected' : ''}>${n}${n === 5 ? ' (detalle)' : ''}</option>`).join('')}</select></label>` : ''}
        ${R.cuenta ? `<label class="campo cx-prov pr-prod"><span>Cuenta</span><input name="cuenta" list="cr-cuentas" value="${esc(f.cuenta)}" placeholder="Todas las cuentas" autocomplete="off"></label><datalist id="cr-cuentas">${cuentasOpc.map((c) => `<option value="${esc(`${c.codigo} · ${c.nombre}`)}"></option>`).join('')}</datalist>` : ''}
        ${R.contenido ? `<label class="campo"><span>Contenido</span><select name="contenido">${[['DETALLADO', 'Detallado'], ['RESUMIDO', 'Resumido']].map(([x, t]) => `<option value="${x}" ${f.contenido === x ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
        ${R.mensual ? `<label class="campo"><span>Columnas</span><select name="vista"><option value="PERIODO" ${f.vista === 'PERIODO' ? 'selected' : ''}>Período</option><option value="MENSUAL" ${f.vista === 'MENSUAL' ? 'selected' : ''}>Por mes</option></select></label>` : ''}
        ${R.presupuesto ? '' : `<label class="pc-check"><input type="checkbox" name="aprobadas" ${f.aprobadas ? 'checked' : ''}> Solo aprobadas</label>`}
        <label class="pc-check"><input type="checkbox" name="graficas" ${f.graficas ? 'checked' : ''}> Gráficas</label>`,
        `<button type="button" class="boton secundario-sm" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button>
         <button type="button" class="boton secundario-sm" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>`);
    }
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargarLocalidad(); }
    async function cargarLocalidad() {
      cargado = ''; base = null;
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', R.icono); return; }
      if (R.presupuesto) await leerPresupuestos();
      pintarFiltros(); await consultar();
    }
    async function leerPresupuestos() {
      const { data } = await sb.from('presupuestos').select('*').eq('localidad_id', ctx.sel.loc).eq('anio', f.anio).order('numero');
      presupuestos = data || [];
      if (f.presupuesto && !presupuestos.some((p) => String(p.id) === String(f.presupuesto))) f.presupuesto = '';
    }

    // Movimientos contables (partidas vigentes) hasta la fecha, con sus cuentas, la jerarquía y los tipos.
    async function leerContable() {
      const ls = locs();
      const lineas = await leerTodo(() => {
        let q = sb.from('partida_lineas').select('id, linea, cuenta_id, centro_id, concepto, debe, haber, partidas!inner(id, localidad_id, fecha, anio, mes, numero, numero_anual, tipo_partida_id, descripcion, catalogo_id, estado, aprobada)')
          .in('partidas.localidad_id', ls).eq('partidas.estado', 'VIGENTE').lte('partidas.fecha', f.fecha);
        if (R.id === 'libro-diario') q = q.gte('partidas.fecha', f.desde);
        if (f.aprobadas) q = q.eq('partidas.aprobada', true);
        return q.order('id');
      });
      const catalogos = [...new Set(lineas.map((l) => l.partidas.catalogo_id).filter(Boolean))];
      const [cuentas, tipos, tiposPart] = await Promise.all([
        catalogos.length ? leerTodo(() => sb.from('cuentas').select('id, catalogo_id, codigo, nombre, cuenta_mayor_id, tipo_cuenta_id, integra, nivel').in('catalogo_id', catalogos).order('id')) : [],
        leerTodo(() => sb.from('tipos_cuenta').select('id, codigo, descripcion, tipo_operacion, operacion_resultado, reporte_financiero, localidad_id').in('localidad_id', ls).order('id')),
        sb.from('tipos_partida').select('id, siglas, nombre').then((r) => r.data || [])
      ]);
      const porId = new Map(cuentas.map((c) => [c.id, c]));
      const tipo = new Map(tipos.map((t) => [t.id, t]));
      // Por código (así se consolida entre localidades con su propio catálogo).
      const porCodigo = new Map();
      cuentas.forEach((c) => {
        const t = tipo.get(c.tipo_cuenta_id);
        const mayor = porId.get(c.cuenta_mayor_id);
        if (!porCodigo.has(c.codigo)) porCodigo.set(c.codigo, { codigo: c.codigo, nombre: c.nombre, nivel: c.nivel || 1, integra: c.integra, mayor: mayor?.codigo || null, tipoCod: t?.codigo, tipoDesc: t?.descripcion || '', nat: t?.tipo_operacion === 'HABER-DEBE' ? -1 : 1, reporte: t?.reporte_financiero || '', resultado: t?.operacion_resultado || '' });
      });
      return { lineas: lineas.map((l) => ({ ...l, p: l.partidas, c: porId.get(l.cuenta_id) })), porCodigo, tiposPart: new Map(tiposPart.map((t) => [t.id, t])), locs: new Map(ctx.localidades.map((x) => [x.id, x])) };
    }
    async function consultar() {
      const clave = `${id}|${locs().join(',')}|${f.desde}|${f.fecha}|${f.aprobadas}|${f.anio}|${f.presupuesto}`;
      if (clave !== cargado) {
        ctx.pDet.innerHTML = '<p class="vacio">Leyendo la contabilidad…</p>';
        try {
          if (R.presupuesto) base = await leerPresupuesto();
          else { base = await leerContable(); pintarFiltros(); }
          cargado = clave;
        } catch (e) { ctx.pDet.innerHTML = `<p class="vacio">${esc(window.UI.traducirError(e))}</p>`; return; }
      }
      try { cfg = construir(); } catch (e) { ctx.pDet.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }
      pintar();
    }
    async function leerPresupuesto() {
      const ps = f.presupuesto ? presupuestos.filter((p) => String(p.id) === String(f.presupuesto)) : presupuestos;
      if (!ps.length) return { ps: [], lineas: [], rubros: new Map() };
      const [ls, rs] = await Promise.all([
        leerTodo(() => sb.from('presupuesto_lineas').select('*').in('presupuesto_id', ps.map((p) => p.id)).order('id')),
        leerTodo(() => sb.from('rubros_presupuesto').select('id, codigo, nombre, grupo, naturaleza').order('id'))
      ]);
      return { ps, lineas: ls, rubros: new Map(rs.map((r) => [r.id, r])) };
    }

    // Saldos por código de cuenta de detalle, sumados hacia sus cuentas mayores.
    function saldos(filtro) {
      const s = new Map();
      base.lineas.forEach((l) => { if (!l.c || !filtro(l)) return; const k = l.c.codigo; const x = s.get(k) || { d: 0, h: 0 }; x.d += Number(l.debe) || 0; x.h += Number(l.haber) || 0; s.set(k, x); });
      const total = new Map();
      s.forEach((x, k) => { let c = base.porCodigo.get(k); const seen = new Set(); while (c && !seen.has(c.codigo)) { seen.add(c.codigo); const t = total.get(c.codigo) || { d: 0, h: 0 }; t.d += x.d; t.h += x.h; total.set(c.codigo, t); c = c.mayor ? base.porCodigo.get(c.mayor) : null; } });
      return total;
    }
    const valor = (cod, mapa) => { const c = base.porCodigo.get(cod), x = mapa.get(cod); return x ? (x.d - x.h) * (c?.nat || 1) : 0; };
    const visibles = (mapa, pred) => [...mapa.keys()].map((k) => base.porCodigo.get(k)).filter((c) => c && c.nivel <= f.nivel && pred(c)).sort((a, b) => a.codigo.localeCompare(b.codigo));
    const fechaTxt = () => (R.periodo ? `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.fecha)}` : `Al ${fmt.fechaDia(f.fecha)}`);
    const parametros = (extra = []) => [alcanceTxt(), fechaTxt(), ...(R.nivel ? [`Nivel ${f.nivel}`] : []), f.aprobadas ? 'Solo partidas aprobadas' : 'Partidas vigentes', ...extra];
    const docPart = (p) => `${base.tiposPart.get(p.tipo_partida_id)?.siglas || 'P'}-${p.numero}${p.anio ? `/${String(p.mes).padStart(2, '0')}-${p.anio}` : ''}`;
    const filaCuenta = (c, valores, tipo) => ({ valores: [c.codigo, `${sang(c.nivel - 1)}${c.nombre}`, ...valores], tipo: tipo || (c.nivel === 1 ? 'grupo' : undefined), resaltar: c.nivel === 1 ? false : c.nivel === 2 ? 2 : undefined });

    function construir() {
      const b0 = { titulo: R.titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: R.titulo.slice(0, 30), archivo: `${id}_${f.fecha}` };
      if (R.presupuesto) return construirPresupuesto(b0);
      const enPeriodo = (l) => l.p.fecha >= f.desde && l.p.fecha <= f.fecha;

      if (id === 'libro-diario') {
        const ps = new Map();
        base.lineas.filter(enPeriodo).forEach((l) => { const a = ps.get(l.p.id) || { p: l.p, ls: [] }; a.ls.push(l); ps.set(l.p.id, a); });
        const lista = [...ps.values()].sort((a, b) => a.p.fecha.localeCompare(b.p.fecha) || a.p.localidad_id - b.p.localidad_id || a.p.numero - b.p.numero);
        const td = lista.reduce((t, x) => t + x.ls.reduce((s, l) => s + Number(l.debe), 0), 0), th = lista.reduce((t, x) => t + x.ls.reduce((s, l) => s + Number(l.haber), 0), 0);
        const loc = (p) => (f.alcance === 'CONSOLIDADO' ? `${base.locs.get(p.localidad_id)?.codigo || ''} · ` : '');
        const porMes = new Map(); lista.forEach((x) => { const k = x.p.fecha.slice(0, 7); porMes.set(k, (porMes.get(k) || 0) + x.ls.reduce((s, l) => s + Number(l.debe), 0)); });
        const graficas = [G().columnas('Movimiento del libro diario por mes (debe, Q)', [...porMes.keys()].sort().map((k) => MES[Number(k.slice(5, 7)) - 1].slice(0, 3)), [{ nombre: 'Debe', color: G().COLORES.AZUL, valores: [...porMes.keys()].sort().map((k) => porMes.get(k)) }])];
        const kpis = [['Partidas', lista.length], ['Total debe', `Q ${fmt.monto(td)}`], ['Total haber', `Q ${fmt.monto(th)}`], ['Cuadre', Math.abs(td - th) < 0.01 ? 'Cuadra' : `Dif. Q ${fmt.monto(td - th)}`, Math.abs(td - th) < 0.01 ? 'ec-fin' : 'ec-alerta']];
        if (f.contenido === 'RESUMIDO') {
          const filas = lista.map((x) => { const d = x.ls.reduce((s, l) => s + Number(l.debe), 0), h = x.ls.reduce((s, l) => s + Number(l.haber), 0); return { valores: [fmt.fechaDia(x.p.fecha), `${loc(x.p)}${docPart(x.p)}`, x.p.descripcion || '', x.p.aprobada ? 'Sí' : 'No', r2(d), r2(h)], resaltar: Math.abs(d - h) > 0.004 }; });
          filas.push({ valores: [`Total (${lista.length} partidas)`, '', '', '', r2(td), r2(th)], tipo: 'total' });
          return { ...b0, parametros: parametros(['Resumido']), n: lista.length, kpis, graficas, filas, columnas: [col('Fecha', 'texto', 11), col('Partida', 'texto', 18), col('Descripción', 'texto', 56), col('Aprobada', 'texto', 9), col('Debe', 'monto', 16), col('Haber', 'monto', 16)] };
        }
        const filas = [];
        lista.forEach((x) => {
          filas.push({ valores: [`${fmt.fechaDia(x.p.fecha)} · ${loc(x.p)}${docPart(x.p)} · ${x.p.descripcion || ''}${x.p.aprobada ? '' : ' (por aprobar)'}`], tipo: 'grupo', combinar: true });
          x.ls.sort((a, b) => a.linea - b.linea).forEach((l) => filas.push({ valores: [l.c?.codigo || '', l.c?.nombre || '', l.concepto || '', Number(l.debe) ? r2(l.debe) : '', Number(l.haber) ? r2(l.haber) : ''] }));
          filas.push({ valores: ['Suma de la partida', '', '', r2(x.ls.reduce((s, l) => s + Number(l.debe), 0)), r2(x.ls.reduce((s, l) => s + Number(l.haber), 0))], tipo: 'subtotal' });
        });
        filas.push({ valores: [`Total del libro diario (${lista.length} partidas)`, '', '', r2(td), r2(th)], tipo: 'total' });
        return { ...b0, parametros: parametros(['Detallado']), n: lista.length, kpis, graficas, filas, columnas: [col('Cuenta', 'texto', 14), col('Nombre de la cuenta', 'texto', 40), col('Concepto', 'texto', 44), col('Debe', 'monto', 16), col('Haber', 'monto', 16)] };
      }

      if (id === 'libro-mayor') {
        const cod = f.cuenta ? f.cuenta.split(' · ')[0].trim() : '';
        const det = base.lineas.filter((l) => l.c && (!cod || l.c.codigo === cod || l.c.codigo.startsWith(cod)));
        const cuentas = new Map(); det.forEach((l) => { const a = cuentas.get(l.c.codigo) || []; a.push(l); cuentas.set(l.c.codigo, a); });
        const orden = [...cuentas.keys()].sort();
        const filas = []; let n = 0, tD = 0, tH = 0;
        const resumen = [];
        orden.forEach((k) => {
          const c = base.porCodigo.get(k), ls = cuentas.get(k).sort((a, b) => a.p.fecha.localeCompare(b.p.fecha) || a.p.numero - b.p.numero || a.linea - b.linea);
          const ini = ls.filter((l) => l.p.fecha < f.desde).reduce((s, l) => s + (Number(l.debe) - Number(l.haber)) * (c?.nat || 1), 0);
          const per = ls.filter(enPeriodo);
          const d = per.reduce((s, l) => s + Number(l.debe), 0), h = per.reduce((s, l) => s + Number(l.haber), 0);
          const fin = ini + (d - h) * (c?.nat || 1);
          if (!per.length && Math.abs(ini) < 0.005) return;
          tD += d; tH += h; resumen.push({ c, ini, d, h, fin });
          if (f.contenido === 'RESUMIDO') { filas.push({ valores: [k, c?.nombre || '', r2(ini), r2(d), r2(h), r2(fin)] }); return; }
          filas.push({ valores: [`${k} · ${c?.nombre || ''} (${c?.nat === -1 ? 'naturaleza acreedora' : 'naturaleza deudora'})`], tipo: 'grupo', combinar: true });
          filas.push({ valores: [fmt.fechaDia(f.desde), '', 'SALDO INICIAL', '', '', r2(ini)], tipo: 'nota' });
          let s = ini;
          per.forEach((l) => { n++; s += (Number(l.debe) - Number(l.haber)) * (c?.nat || 1); filas.push({ valores: [fmt.fechaDia(l.p.fecha), docPart(l.p), l.concepto || l.p.descripcion || '', Number(l.debe) ? r2(l.debe) : '', Number(l.haber) ? r2(l.haber) : '', r2(s)] }); });
          filas.push({ valores: [`Saldo final (${per.length} movimiento(s))`, '', '', r2(d), r2(h), r2(fin)], tipo: 'subtotal' });
        });
        filas.push({ valores: [`Total (${resumen.length} cuentas)`, '', ...(f.contenido === 'RESUMIDO' ? ['', r2(tD), r2(tH), ''] : ['', r2(tD), r2(tH), ''])], tipo: 'total' });
        const graficas = [G().barras('Cuentas con mayor movimiento en el período (debe + haber)', resumen.map((x) => ({ etiqueta: `${x.c?.codigo} ${x.c?.nombre || ''}`, valor: x.d + x.h, texto: `Q ${fmt.monto(x.d + x.h)}` })).sort((a, b) => b.valor - a.valor).slice(0, 10))];
        const kpis = [['Cuentas', resumen.length], ['Movimientos', n || det.filter(enPeriodo).length], ['Total debe', `Q ${fmt.monto(tD)}`], ['Total haber', `Q ${fmt.monto(tH)}`]];
        return { ...b0, parametros: parametros([f.contenido === 'RESUMIDO' ? 'Resumido' : 'Detallado', `Cuenta: ${f.cuenta || 'Todas'}`]), n: resumen.length, kpis, graficas, filas,
          columnas: f.contenido === 'RESUMIDO' ? [col('Cuenta', 'texto', 14), col('Nombre de la cuenta', 'texto', 48), col('Saldo inicial', 'monto', 16), col('Debe', 'monto', 16), col('Haber', 'monto', 16), col('Saldo final', 'monto', 16)]
            : [col('Fecha', 'texto', 11), col('Partida', 'texto', 16), col('Concepto', 'texto', 52), col('Debe', 'monto', 15), col('Haber', 'monto', 15), col('Saldo', 'monto', 16)] };
      }

      if (id === 'balanza-de-comprobacion') {
        const ant = saldos((l) => l.p.fecha < f.desde), per = saldos(enPeriodo);
        const cods = new Set([...ant.keys(), ...per.keys()]);
        const mapa = new Map([...cods].map((k) => [k, true]));
        const cs = visibles(mapa, () => true);
        const sIni = (k) => { const x = ant.get(k); return x ? x.d - x.h : 0; };
        const filas = []; let t = [0, 0, 0, 0];
        cs.forEach((c) => {
          const ini = sIni(c.codigo), p = per.get(c.codigo) || { d: 0, h: 0 }, fin = ini + p.d - p.h;
          if (Math.abs(ini) < 0.005 && !p.d && !p.h) return;
          const v = [ini > 0 ? r2(ini) : '', ini < 0 ? r2(-ini) : '', r2(p.d), r2(p.h), fin > 0 ? r2(fin) : '', fin < 0 ? r2(-fin) : ''];
          filas.push(filaCuenta(c, v));
          if (c.nivel === Math.min(...cs.map((x) => x.nivel))) { t[0] += ini; t[1] += p.d; t[2] += p.h; t[3] += fin; }
        });
        const td = [...per.values()].length ? [...cs].filter((c) => c.nivel === 1).reduce((s, c) => s + (per.get(c.codigo)?.d || 0), 0) : 0;
        const th = [...cs].filter((c) => c.nivel === 1).reduce((s, c) => s + (per.get(c.codigo)?.h || 0), 0);
        const sd = cs.filter((c) => c.nivel === 1).reduce((s, c) => { const v = sIni(c.codigo) + (per.get(c.codigo)?.d || 0) - (per.get(c.codigo)?.h || 0); return s + (v > 0 ? v : 0); }, 0);
        const sa = cs.filter((c) => c.nivel === 1).reduce((s, c) => { const v = sIni(c.codigo) + (per.get(c.codigo)?.d || 0) - (per.get(c.codigo)?.h || 0); return s + (v < 0 ? -v : 0); }, 0);
        filas.push({ valores: ['Totales', '', '', '', r2(td), r2(th), r2(sd), r2(sa)], tipo: 'total' });
        const kpis = [['Cuentas', filas.length - 1], ['Movimiento debe', `Q ${fmt.monto(td)}`], ['Movimiento haber', `Q ${fmt.monto(th)}`], ['Cuadre de saldos', Math.abs(sd - sa) < 0.01 ? 'Cuadra' : `Dif. Q ${fmt.monto(sd - sa)}`, Math.abs(sd - sa) < 0.01 ? 'ec-fin' : 'ec-alerta']];
        const graficas = [G().columnas('Movimiento del período por clase de cuenta (Q)', cs.filter((c) => c.nivel === 1).map((c) => c.nombre.slice(0, 14)), [{ nombre: 'Debe', color: G().COLORES.VERDE, valores: cs.filter((c) => c.nivel === 1).map((c) => per.get(c.codigo)?.d || 0) }, { nombre: 'Haber', color: G().COLORES.NARANJA, valores: cs.filter((c) => c.nivel === 1).map((c) => per.get(c.codigo)?.h || 0) }])];
        return { ...b0, parametros: parametros(), n: filas.length - 1, kpis, graficas, filas,
          columnas: [col('Cuenta', 'texto', 14), col('Nombre de la cuenta', 'texto', 44), col('Saldo inicial deudor', 'monto', 15), col('Saldo inicial acreedor', 'monto', 15), col('Debe', 'monto', 15), col('Haber', 'monto', 15), col('Saldo final deudor', 'monto', 15), col('Saldo final acreedor', 'monto', 15)] };
      }

      if (id === 'balance-general') {
        const inicioFiscal = `${f.fecha.slice(0, 4)}-01-01`;
        const todo = saldos(() => true);
        const resEj = saldos((l) => l.p.fecha >= inicioFiscal);
        const resAnt = saldos((l) => l.p.fecha < inicioFiscal);
        const clases = [...todo.keys()].map((k) => base.porCodigo.get(k)).filter((c) => c && c.nivel === 1 && c.reporte === 'B').sort((a, b) => a.codigo.localeCompare(b.codigo));
        const resultadoDe = (mapa) => [...mapa.keys()].map((k) => base.porCodigo.get(k)).filter((c) => c && c.nivel === 1 && c.reporte === 'E').reduce((s, c) => s + (mapa.get(c.codigo).h - mapa.get(c.codigo).d), 0);
        const rEj = resultadoDe(resEj), rAnt = resultadoDe(resAnt);
        const filas = [], tot = {};
        clases.forEach((cl) => {
          filas.push({ valores: [cl.codigo, cl.nombre, ''], tipo: 'grupo' });
          visibles(todo, (c) => c.codigo !== cl.codigo && c.codigo.startsWith(cl.codigo) && c.nivel > 1).forEach((c) => { const v = valor(c.codigo, todo); if (Math.abs(v) >= 0.005) filas.push(filaCuenta(c, [r2(v)], c.nivel === 2 ? 'subtotal' : undefined)); });
          let t = valor(cl.codigo, todo);
          if (cl.nat === -1 && /PATRIMONIO|CAPITAL/i.test(cl.nombre + cl.tipoDesc)) {
            if (Math.abs(rAnt) >= 0.005) filas.push({ valores: ['', `${sang(1)}Resultados de ejercicios anteriores (no cerrados)`, r2(rAnt)] });
            filas.push({ valores: ['', `${sang(1)}Resultado del ejercicio ${f.fecha.slice(0, 4)}`, r2(rEj)], resaltar: 2 });
            t += rEj + rAnt;
          }
          tot[cl.tipoDesc || cl.nombre] = t;
          filas.push({ valores: [`TOTAL ${cl.nombre}`, '', r2(t)], tipo: 'total' });
        });
        const activo = clases.filter((c) => c.nat === 1).reduce((s, c) => s + tot[c.tipoDesc || c.nombre], 0);
        const pasPat = clases.filter((c) => c.nat === -1).reduce((s, c) => s + tot[c.tipoDesc || c.nombre], 0);
        filas.push({ valores: ['TOTAL PASIVO Y PATRIMONIO', '', r2(pasPat)], tipo: 'total' });
        const cuadra = Math.abs(activo - pasPat) < 0.01;
        const kpis = [['Activo', `Q ${fmt.monto(activo)}`], ['Pasivo + patrimonio', `Q ${fmt.monto(pasPat)}`], [`Resultado ${f.fecha.slice(0, 4)}`, `Q ${fmt.monto(rEj)}`, rEj >= 0 ? 'ec-fin' : 'ec-alerta'], ['Cuadre', cuadra ? 'Cuadra' : `Dif. Q ${fmt.monto(activo - pasPat)}`, cuadra ? 'ec-fin' : 'ec-alerta']];
        const graficas = [G().barras('Estructura financiera (Q)', clases.map((c) => ({ etiqueta: c.nombre, valor: Math.abs(tot[c.tipoDesc || c.nombre]), texto: `Q ${fmt.monto(tot[c.tipoDesc || c.nombre])} · ${activo ? ((tot[c.tipoDesc || c.nombre] / activo) * 100).toFixed(1) : 0} %` }))),
          G().barras('Principales rubros (nivel 2)', visibles(todo, (c) => c.nivel === 2 && c.reporte === 'B').map((c) => ({ etiqueta: `${c.codigo} ${c.nombre}`, valor: Math.abs(valor(c.codigo, todo)), texto: `Q ${fmt.monto(valor(c.codigo, todo))}` })).sort((a, b) => b.valor - a.valor).slice(0, 10), G().COLORES.VERDE)];
        return { ...b0, parametros: parametros(['Incluye el resultado del ejercicio']), n: filas.length, kpis, graficas, filas, firmas: ['Representante legal', 'Contador general'],
          columnas: [col('Cuenta', 'texto', 14), col('Nombre de la cuenta', 'texto', 56), col('Saldo Q', 'monto', 18)] };
      }

      // Estado de resultados: secciones por tipo de cuenta (ingresos suman; costos y gastos restan) con utilidades intermedias.
      const per = base.lineas.filter(enPeriodo);
      const meses = []; for (let d = f.desde.slice(0, 7); d <= f.fecha.slice(0, 7) && meses.length < 24;) { meses.push(d); const [y, m] = d.split('-').map(Number); d = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; }
      const mensual = f.vista === 'MENSUAL';
      const sPer = saldos(enPeriodo);
      const sMes = mensual ? meses.map((m) => saldos((l) => enPeriodo(l) && l.p.fecha.startsWith(m))) : [];
      const val = (cod, mapa) => { const x = mapa.get(cod); return x ? x.h - x.d : 0; }; // positivo = ingreso / utilidad
      const secciones = [...sPer.keys()].map((k) => base.porCodigo.get(k)).filter((c) => c && c.nivel === 1 && c.reporte === 'E').sort((a, b) => (a.tipoCod || 0) - (b.tipoCod || 0) || a.codigo.localeCompare(b.codigo));
      const columnas = [col('Cuenta', 'texto', 14), col('Nombre de la cuenta', 'texto', mensual ? 34 : 52), ...(mensual ? meses.map((m) => col(MES[Number(m.slice(5, 7)) - 1].slice(0, 3), 'monto', 13)) : []), col('Total período', 'monto', 16), col('% de ventas', 'porcentaje', 11)];
      const ingresos = secciones.filter((c) => c.resultado === 'SUMAR' || c.nat === -1).reduce((s, c) => s + val(c.codigo, sPer), 0);
      // Porcentajes sobre las ventas netas (la primera sección de ingresos), como se presenta el estado de resultados.
      const ventas = secciones.length && secciones[0].nat === -1 ? val(secciones[0].codigo, sPer) : ingresos;
      const cifras = (cod, signo = 1) => [...(mensual ? sMes.map((mp) => r2(signo * val(cod, mp))) : []), r2(signo * val(cod, sPer)), ventas ? (signo * val(cod, sPer)) / ventas : 0];
      const filas = []; let acum = 0, acumMes = meses.map(() => 0);
      const etiqueta = (c, ult) => (ult ? 'UTILIDAD (PÉRDIDA) NETA DEL PERÍODO' : /COSTO/i.test(c.tipoDesc + c.nombre) ? 'UTILIDAD BRUTA' : /OPERACI/i.test(c.tipoDesc + c.nombre) ? 'UTILIDAD DE OPERACIÓN' : `RESULTADO DESPUÉS DE ${c.nombre}`);
      secciones.forEach((sec, i) => {
        const signo = sec.nat === -1 ? 1 : -1; // mostrar costos y gastos en positivo
        filas.push({ valores: [sec.codigo, sec.nombre], tipo: 'grupo', combinar: true });
        visibles(sPer, (c) => c.codigo !== sec.codigo && c.codigo.startsWith(sec.codigo) && c.nivel > 1).forEach((c) => { if (Math.abs(val(c.codigo, sPer)) >= 0.005) filas.push(filaCuenta(c, cifras(c.codigo, signo), c.nivel === 2 ? 'subtotal' : undefined)); });
        filas.push({ valores: [`TOTAL ${sec.nombre}`, '', ...cifras(sec.codigo, signo)], tipo: 'subtotal' });
        acum += val(sec.codigo, sPer); acumMes = acumMes.map((v, k) => v + val(sec.codigo, sMes[k] || new Map()));
        if (sec.nat === 1 || i === secciones.length - 1) filas.push({ valores: [etiqueta(sec, i === secciones.length - 1), '', ...(mensual ? acumMes.map(r2) : []), r2(acum), ventas ? acum / ventas : 0], tipo: 'total' });
      });
      const kpis = [['Ingresos', `Q ${fmt.monto(ingresos)}`], ['Costos y gastos', `Q ${fmt.monto(ingresos - acum)}`], ['Resultado neto', `Q ${fmt.monto(acum)}`, acum >= 0 ? 'ec-fin' : 'ec-alerta'], ['Margen neto', ingresos ? `${((acum / ingresos) * 100).toFixed(1)} %` : '—']];
      const porMes = meses.map((m) => saldos((l) => enPeriodo(l) && l.p.fecha.startsWith(m)));
      const ing = porMes.map((mp) => secciones.filter((c) => c.nat === -1).reduce((s, c) => s + val(c.codigo, mp), 0));
      const gas = porMes.map((mp) => secciones.filter((c) => c.nat === 1).reduce((s, c) => s - val(c.codigo, mp), 0));
      const graficas = [G().columnas('Ingresos y gastos por mes (Q)', meses.map((m) => MES[Number(m.slice(5, 7)) - 1].slice(0, 3)), [{ nombre: 'Ingresos', color: G().COLORES.VERDE, valores: ing }, { nombre: 'Costos y gastos', color: G().COLORES.NARANJA, valores: gas }]),
        G().barras('Composición de costos y gastos', secciones.filter((c) => c.nat === 1).map((c) => ({ etiqueta: c.nombre, valor: -val(c.codigo, sPer), texto: `Q ${fmt.monto(-val(c.codigo, sPer))}` })), G().COLORES.NARANJA)];
      return { ...b0, parametros: parametros([mensual ? 'Columnas por mes' : 'Período']), n: filas.length, kpis, graficas, filas, columnas, firmas: ['Representante legal', 'Contador general'] };
    }

    function construirPresupuesto(b0) {
      const { ps, lineas, rubros } = base;
      const grupos = new Map();
      lineas.forEach((l) => { const r = rubros.get(l.rubro_id); const g = r?.grupo || 'SIN GRUPO'; const a = grupos.get(g) || []; a.push({ l, r }); grupos.set(g, a); });
      const filas = []; let tp = 0, te = 0;
      const fila = (cod, nom, p, e, tipo) => ({ valores: [cod, nom, r2(p), r2(e), r2(e - p), p ? e / p : 0], tipo, resaltar: tipo ? undefined : p && e / p > 1.05 });
      [...grupos.entries()].forEach(([g, xs]) => {
        filas.push({ valores: [g], tipo: 'grupo', combinar: true });
        const agr = new Map(); xs.forEach(({ l, r }) => { const k = r?.id || l.rubro_id; const a = agr.get(k) || { r, p: 0, e: 0 }; a.p += Number(l.presupuestado) || 0; a.e += Number(l.ejecutado) || 0; agr.set(k, a); });
        let gp = 0, ge = 0;
        [...agr.values()].sort((a, b) => String(a.r?.codigo).localeCompare(String(b.r?.codigo))).forEach((a) => { gp += a.p; ge += a.e; filas.push(fila(String(a.r?.codigo ?? ''), a.r?.nombre || '', a.p, a.e)); });
        tp += gp; te += ge; filas.push(fila(`Total ${g}`, '', gp, ge, 'subtotal'));
      });
      filas.push(fila('TOTAL GENERAL', '', tp, te, 'total'));
      const kpis = [['Presupuestos', ps.length], ['Presupuestado', `Q ${fmt.monto(tp)}`], ['Ejecutado', `Q ${fmt.monto(te)}`], ['Ejecución', tp ? `${((te / tp) * 100).toFixed(1)} %` : '—', tp && te / tp > 1 ? 'ec-alerta' : 'ec-fin']];
      const gs = [...grupos.keys()];
      const graficas = gs.length ? [G().columnas('Presupuestado vs. ejecutado por grupo (Q)', gs.map((g) => g.slice(0, 14)), [{ nombre: 'Presupuestado', color: G().COLORES.AZUL, valores: gs.map((g) => grupos.get(g).reduce((s, x) => s + Number(x.l.presupuestado || 0), 0)) }, { nombre: 'Ejecutado', color: G().COLORES.NARANJA, valores: gs.map((g) => grupos.get(g).reduce((s, x) => s + Number(x.l.ejecutado || 0), 0)) }])] : [];
      return { ...b0, parametros: [`Empresa: ${empresa()}`, `Año ${f.anio}`, `Presupuesto: ${f.presupuesto ? `No. ${ps[0]?.numero}` : 'todos los del año'}`], n: lineas.length, kpis, graficas, filas,
        columnas: [col('Rubro', 'texto', 12), col('Nombre', 'texto', 44), col('Presupuestado', 'monto', 16), col('Ejecutado', 'monto', 16), col('Variación', 'monto', 16), col('% ejecución', 'porcentaje', 12)] };
    }

    const graficasDe = (c) => (c.graficas || []).filter(Boolean);
    function celda(v, c) {
      if (v === '' || v == null) return '<td></td>';
      if (typeof v === 'number') return `<td class="num${v < 0 ? ' pc-rojo' : ''}">${c.tipo === 'monto' ? fmt.monto(v) : c.tipo === 'porcentaje' ? `${(v * 100).toFixed(1)} %` : v.toLocaleString('es-GT')}</td>`;
      return `<td>${esc(String(v))}</td>`;
    }
    function pintar() {
      const c = cfg, n = c.columnas.length, vista = c.filas.slice(0, MAX_VISTA), gs = f.graficas ? graficasDe(c) : [];
      const vacio = R.presupuesto ? (presupuestos.length ? 'El presupuesto no tiene rubros.' : `No hay presupuestos de ${f.anio} en esta empresa (Contabilidad › Registros › Presupuesto).`) : 'No hay movimientos contables con esos parámetros.';
      ctx.pDet.innerHTML = `
        <div class="bm-form cx-form cl-clasico">
          <div class="cl-banda">${esc(R.titulo)} · ${esc(c.parametros.slice(0, 2).join(' · '))}</div>
          <div class="ec-kpis">${c.kpis.map(([t, v, cls]) => kpi(t, v, cls)).join('')}</div>
          <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table>
            <thead><tr>${c.columnas.map((x) => `<th class="${x.tipo === 'texto' ? '' : 'num'}">${esc(x.titulo)}</th>`).join('')}</tr></thead>
            <tbody>${c.n ? vista.map((r) => (r.tipo === 'grupo' && r.combinar ? `<tr class="pr-g"><td colspan="${n}">${esc(r.valores.filter(Boolean).join(' · '))}</td></tr>`
              : `<tr class="${r.tipo === 'grupo' ? 'pr-g' : r.tipo === 'subtotal' ? 'pr-s' : r.tipo === 'total' ? 'pr-t cr-total' : r.tipo === 'nota' ? 'pr-n' : ''}${r.resaltar === true ? ' pr-alerta' : r.resaltar === 2 ? ' cr-n2' : ''}">${c.columnas.map((x, i) => celda(r.valores[i], x)).join('')}</tr>`)).join('')
              : `<tr><td colspan="${n}" class="tk-vacio">${vacio}</td></tr>`}
              ${c.filas.length > MAX_VISTA ? `<tr><td colspan="${n}" class="tk-vacio">Vista previa de ${MAX_VISTA} de ${c.filas.length} renglones: el PDF y el Excel llevan el reporte completo.</td></tr>` : ''}</tbody>
          </table>${gs.length && c.n ? `<section class="pr-graficas"><h3><i class="ti ti-chart-bar" aria-hidden="true"></i> Gráficas</h3>${gs.join('')}</section>` : ''}</div>
        </div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    function exportar(formato) {
      if (!cfg || !cfg.n) return window.FIN.aviso('No hay información con esos parámetros');
      const gs = f.graficas ? graficasDe(cfg) : [];
      const salida = { ...cfg, filas: cfg.filas.map((r) => ({ ...r, resaltar: r.resaltar === true ? 1 : r.resaltar === 2 ? undefined : r.resaltar, ...(r.tipo === 'nota' ? { tipo: undefined, tenue: true } : {}) })) };
      if (formato === 'PDF') return window.CUENTAS_XLSX.pdf({ ...salida, graficas: gs.join('') });
      salida.filas = salida.filas.map((r) => ({ ...r, valores: r.valores.map((v) => (typeof v === 'string' ? v.replace(/^ +/, (m) => m) : v)) }));
      Promise.all(gs.map((g) => G().png(g))).then((imagenes) => window.REPORTE_XLSX.generar({ ...salida, imagenes })).catch((e) => window.FIN.aviso(e.message || 'No se pudo generar el Excel'));
    }
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      const n = e.target.name;
      if (['desde', 'fecha'].includes(n)) { f[n] = e.target.value || (n === 'fecha' ? hoy : f.desde); if (f.desde > f.fecha) f.desde = `${f.fecha.slice(0, 4)}-01-01`; return consultar(); }
      if (n === 'alcance') { f.alcance = e.target.value; return consultar(); }
      if (n === 'aprobadas') { f.aprobadas = e.target.checked; return consultar(); }
      if (n === 'anio') { f.anio = Number(e.target.value) || f.anio; await leerPresupuestos(); pintarFiltros(); return consultar(); }
      if (n === 'presupuesto') { f.presupuesto = e.target.value; return consultar(); }
      if (n === 'nivel') { f.nivel = Number(e.target.value); cfg = construir(); return pintar(); }
      if (n === 'contenido' || n === 'vista') { f[n] = e.target.value; cfg = construir(); return pintar(); }
      if (n === 'cuenta') { f.cuenta = e.target.value.trim(); cfg = construir(); return pintar(); }
      if (n === 'graficas') { f.graficas = e.target.checked; return pintar(); }
    });
    cont.addEventListener('click', (e) => { const a = e.target.closest('[data-accion]')?.dataset.accion; if (a === 'pdf') exportar('PDF'); if (a === 'excel') exportar('EXCEL'); });
    iniciar();
  }
  Object.keys(REPORTES).forEach((k) => { REPORTES[k].id = k; window.PANTALLAS[k] = (cont) => reporte(cont, k); });
})();
