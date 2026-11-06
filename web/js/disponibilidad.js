// Caja y Bancos · Bancos · Disponibilidad bancaria (proceso) y Consulta de Disponibilidad (histórico).
//   Disponibilidad bancaria (opción A): parámetros en una barra (empresa, banco o todos, cuenta o todas y
//   fecha de corte) y el botón «Generar disponibilidad». Cada generación se guarda en el histórico con su
//   correlativo SIGLAS-AÑO-MES-NÚMERO, el usuario y la fecha y hora (script 117), y se muestra en un
//   tablero: indicadores, cuentas agrupadas por banco con sus subtotales y el resumen por banco.
//   Consulta de Disponibilidad: las generaciones guardadas de la empresa (fecha inicial = la primera),
//   con el mismo tablero de la generación elegida tal como quedó.
//   Las dos imprimen en PDF y generan Excel (encabezado común de los reportes).
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  // Fecha y hora con segundos (dd/mm/aaaa hh:mm:ss), hora de Guatemala.
  const fhs = (t) => t ? new Date(t).toLocaleString('es-GT', { timeZone: 'America/Guatemala', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '') : '';
  const m = (n) => fmt.monto(n);
  const sinTabla = (e) => e && /disponibilidad_|generar_disponibilidad|schema cache/.test(e.message || '');
  const AVISO_SCRIPT = 'Falta ejecutar en Supabase el script 20261106000117_disponibilidad_historico.sql.';

  // Agrupa el detalle por banco con sus subtotales en quetzales.
  function porBanco(det) {
    const g = new Map();
    det.forEach((d) => {
      const k = d.banco_id || 0;
      if (!g.has(k)) g.set(k, { codigo: d.banco_codigo, nombre: d.banco_nombre, filas: [], saldo: 0, circ: 0, estimado: 0, minimo: 0 });
      const x = g.get(k);
      x.filas.push(d);
      x.saldo += Number(d.saldo_ml);
      x.circ += (Number(d.circ_ingresos) - Number(d.circ_egresos)) * Number(d.tipo_cambio);
      x.estimado += estimado(d) * Number(d.tipo_cambio);
      x.minimo += Number(d.saldo_minimo) * Number(d.tipo_cambio);
    });
    return [...g.values()];
  }
  // Saldo estimado en el banco: lo que aún no cobran (egresos en circulación) sigue en el banco; lo que aún no
  // llega (ingresos en circulación) todavía no.
  const estimado = (d) => Number(d.saldo) + Number(d.circ_egresos) - Number(d.circ_ingresos);
  const local = (d) => d.moneda_iso === 'GTQ';

  // Tablero de una generación (proceso y consulta).
  function tablero(gen, det, { acciones = true } = {}) {
    if (!gen) return '';
    const grupos = porBanco(det);
    const totEst = grupos.reduce((s, g) => s + g.estimado, 0);
    const maxB = Math.max(1, ...grupos.map((g) => Math.abs(g.saldo)));
    const parametros = `${gen.banco_nombre ? esc(gen.banco_nombre) : 'Todos los bancos'} · ${gen.cuenta_numero ? `cuenta ${esc(gen.cuenta_numero)}` : 'todas las cuentas'} · al ${esc(fmt.fechaDia(gen.fecha_corte))}`;
    return `
      <div class="dsp-tablero">
        <div class="dsp-fila1">
          <section class="dsp-gen">
            <span class="tk-icono"><i class="ti ti-chart-line" aria-hidden="true"></i></span>
            <div><small>Generación</small><b class="dsp-corr">${esc(gen.correlativo)}</b><small class="dsp-par">${parametros}</small></div>
            <dl>
              <div><dt>Generó</dt><dd>${esc(gen.usuario || '')}${gen.usuario_nombre ? `<small>${esc(gen.usuario_nombre)}</small>` : ''}</dd></div>
              <div><dt>Fecha y hora</dt><dd>${esc(fhs(gen.generado_en))}</dd></div>
            </dl>
          </section>
          <div class="dsp-kpi principal"><span>Disponible Q</span><b>${m(gen.total_saldo_ml)}</b><small>Saldo en libros de ${gen.cuentas} cuenta${gen.cuentas === 1 ? '' : 's'}</small></div>
          <div class="dsp-kpi"><span>En circulación Q</span><b class="${Number(gen.total_circulacion_ml) < 0 ? 'pc-rojo' : ''}">${m(gen.total_circulacion_ml)}</b><small>Ingresos − egresos sin conciliar</small></div>
          <div class="dsp-kpi"><span>Estimado en bancos Q</span><b>${m(totEst)}</b><small>Libros + lo que aún no cobran</small></div>
          <div class="dsp-kpi ${gen.bajo_minimo ? 'alerta' : 'ok'}"><span>Bajo su mínimo</span><b>${gen.bajo_minimo}</b><small>${gen.bajo_minimo ? 'Revisar las cuentas en rojo' : 'Todas sobre su mínimo'}</small></div>
          ${acciones ? `<div class="dsp-acciones">
            <button type="button" class="boton secundario-sm bca-pdf" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i><span><b>Imprimir en PDF</b><small>Disponibilidad</small></span></button>
            <button type="button" class="boton cqc-excel" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i><span><b>Generar Excel</b><small>Cuentas y bancos</small></span></button>
          </div>` : ''}
        </div>
        <div class="dsp-fila2">
          <section class="dsp-cuentas pc-lineas">
            <table><thead><tr><th>Cuenta bancaria</th><th>Moneda</th><th class="num">Saldo inicial</th><th class="num">Ingresos</th><th class="num">Egresos</th><th class="num">Saldo (libros)</th><th class="num" title="Ingresos menos egresos sin conciliar">En circulación</th><th class="num">Estimado en banco</th><th class="num">Mínimo</th><th class="num">Disponible Q</th></tr></thead>
              <tbody>${grupos.map((g) => `<tr class="dsp-banco"><td colspan="10"><span class="bk-cod">${g.codigo ?? ''}</span> ${esc(g.nombre || '')} <small>${g.filas.length} cuenta${g.filas.length === 1 ? '' : 's'}</small></td></tr>
                ${g.filas.map((d) => `<tr class="${d.bajo_minimo ? 'dsp-bajo' : ''}">
                  <td><b>${esc(d.cuenta_numero)}</b><small>${esc(d.cuenta_nombre || '')}</small></td>
                  <td>${esc(d.moneda_simbolo || d.moneda_iso || '')}${local(d) ? '' : `<small>TC ${Number(d.tipo_cambio)}</small>`}</td>
                  <td class="num">${m(d.saldo_inicial)}</td><td class="num">${m(d.ingresos)}</td><td class="num">${m(d.egresos)}</td>
                  <td class="num fuerte">${m(d.saldo)}</td>
                  <td class="num ${Number(d.circ_ingresos) - Number(d.circ_egresos) < 0 ? 'pc-rojo' : ''}">${m(Number(d.circ_ingresos) - Number(d.circ_egresos))}<small>${d.circ_documentos} doc.</small></td>
                  <td class="num">${m(estimado(d))}</td>
                  <td class="num">${m(d.saldo_minimo)}${d.bajo_minimo ? '<small class="pc-rojo">bajo el mínimo</small>' : ''}</td>
                  <td class="num fuerte">${m(d.saldo_ml)}</td></tr>`).join('')}
                <tr class="dsp-sub"><td colspan="5">Total ${esc(g.nombre || '')}</td><td></td><td class="num">${m(g.circ)}</td><td class="num">${m(g.estimado)}</td><td class="num">${m(g.minimo)}</td><td class="num">${m(g.saldo)}</td></tr>`).join('')
                || '<tr><td colspan="10" class="tk-vacio">La generación no tiene cuentas (no hay cuentas activas con esos parámetros).</td></tr>'}</tbody>
              <tfoot><tr><td colspan="6">Total general en quetzales</td><td class="num">${m(gen.total_circulacion_ml)}</td><td class="num">${m(totEst)}</td><td></td><td class="num">${m(gen.total_saldo_ml)}</td></tr></tfoot>
            </table>
          </section>
          <section class="dsp-bancos">
            <h3 class="ta-col-titulo"><i class="ti ti-building-bank" aria-hidden="true"></i> Por banco</h3>
            ${grupos.map((g) => `<div class="dsp-barra"><div><b>${esc(g.nombre || '')}</b><span>Q ${m(g.saldo)}</span></div><i style="--p:${Math.max(2, Math.round(Math.abs(g.saldo) / maxB * 100))}%" class="${g.saldo < 0 ? 'neg' : ''}"></i><small>${Number(gen.total_saldo_ml) ? Math.round(g.saldo / Number(gen.total_saldo_ml) * 1000) / 10 : 0}% del disponible</small></div>`).join('') || '<p class="tk-vacio">Sin bancos.</p>'}
          </section>
        </div>
      </div>`;
  }

  // PDF (ventana de impresión) y Excel de una generación.
  function pdf(gen, det, empresa) {
    const grupos = porBanco(det);
    imprimir(`Disponibilidad ${gen.correlativo}`, `
      <h1>Disponibilidad bancaria · ${esc(gen.correlativo)}</h1>
      <h2>${esc(empresa)} · ${gen.banco_nombre ? esc(gen.banco_nombre) : 'Todos los bancos'} · ${gen.cuenta_numero ? `cuenta ${esc(gen.cuenta_numero)}` : 'todas las cuentas'} · al ${esc(fmt.fechaDia(gen.fecha_corte))}</h2>
      <div class="cab"><div><b>Disponible Q</b>${m(gen.total_saldo_ml)}</div><div><b>En circulación Q</b>${m(gen.total_circulacion_ml)}</div><div><b>Bajo su mínimo</b>${gen.bajo_minimo}</div><div><b>Cuentas</b>${gen.cuentas}</div>
        <div><b>Generó</b>${esc(gen.usuario || '')} ${esc(gen.usuario_nombre || '')}</div><div><b>Fecha y hora</b>${esc(fhs(gen.generado_en))}</div><div><b>Fecha de corte</b>${esc(fmt.fechaDia(gen.fecha_corte))}</div><div><b>Correlativo</b>${esc(gen.correlativo)}</div></div>
      <table><thead><tr><th>Cuenta</th><th>Moneda</th><th class="n">Saldo inicial</th><th class="n">Ingresos</th><th class="n">Egresos</th><th class="n">Saldo</th><th class="n">En circulación</th><th class="n">Estimado banco</th><th class="n">Mínimo</th><th class="n">Disponible Q</th></tr></thead><tbody>
        ${grupos.map((g) => `<tr class="s"><td colspan="10">${esc(g.nombre || '')}</td></tr>${g.filas.map((d) => `<tr><td>${esc(d.cuenta_numero)} ${esc(d.cuenta_nombre || '')}</td><td>${esc(d.moneda_simbolo || '')}${local(d) ? '' : ` TC ${Number(d.tipo_cambio)}`}</td><td class="n">${m(d.saldo_inicial)}</td><td class="n">${m(d.ingresos)}</td><td class="n">${m(d.egresos)}</td><td class="n">${m(d.saldo)}</td><td class="n">${m(Number(d.circ_ingresos) - Number(d.circ_egresos))}</td><td class="n">${m(estimado(d))}</td><td class="n">${m(d.saldo_minimo)}${d.bajo_minimo ? ' ⚠' : ''}</td><td class="n">${m(d.saldo_ml)}</td></tr>`).join('')}
          <tr class="s"><td colspan="6">Total ${esc(g.nombre || '')}</td><td class="n">${m(g.circ)}</td><td class="n">${m(g.estimado)}</td><td class="n">${m(g.minimo)}</td><td class="n">${m(g.saldo)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="6">Total general en quetzales</td><td class="n">${m(gen.total_circulacion_ml)}</td><td class="n">${m(grupos.reduce((s, g) => s + g.estimado, 0))}</td><td></td><td class="n">${m(gen.total_saldo_ml)}</td></tr></tfoot></table>
      <div class="firmas"><div>Elaboró: ${esc(gen.usuario || '')}</div><div>Revisó</div><div>Autorizó</div></div>`);
  }

  function excel(gen, det, empresa) {
    if (!window.REPORTE_XLSX) return;
    const grupos = porBanco(det);
    const filas = [];
    grupos.forEach((g) => {
      filas.push({ tipo: 'grupo', valores: [`${g.codigo ?? ''} · ${g.nombre || ''}`] });
      g.filas.forEach((d) => filas.push({ resaltar: 0, tenue: false, valores: [d.cuenta_numero, d.cuenta_nombre || '', local(d) ? (d.moneda_simbolo || 'Q') : `${d.moneda_simbolo || d.moneda_iso} · TC ${Number(d.tipo_cambio)}`,
        Number(d.saldo_inicial), Number(d.ingresos), Number(d.egresos), Number(d.saldo), Number(d.circ_ingresos) - Number(d.circ_egresos), estimado(d), Number(d.saldo_minimo), Number(d.saldo_ml), d.bajo_minimo ? 'Bajo el mínimo' : ''] }));
      filas.push({ tipo: 'subtotal', valores: [`Total ${g.nombre || ''}`, '', '', null, null, null, null, g.circ, g.estimado, g.minimo, g.saldo, ''] });
    });
    filas.push({ tipo: 'total', valores: ['Total general en quetzales', '', '', null, null, null, null, Number(gen.total_circulacion_ml), grupos.reduce((s, g) => s + g.estimado, 0), null, Number(gen.total_saldo_ml), `${gen.bajo_minimo} bajo su mínimo`] });
    window.REPORTE_XLSX.generar({
      titulo: `Disponibilidad bancaria · ${gen.correlativo}`,
      parametros: [`Empresa: ${empresa}`, `Banco: ${gen.banco_nombre || 'Todos'}`, `Cuenta: ${gen.cuenta_numero || 'Todas'}`, `Fecha de corte: ${fmt.fechaDia(gen.fecha_corte)}`,
        `Generó: ${gen.usuario || ''}${gen.usuario_nombre ? ` · ${gen.usuario_nombre}` : ''}`, `Generado: ${fhs(gen.generado_en)}`],
      orgId: gen.organizacion_id, locId: gen.localidad_id, hoja: gen.correlativo, archivo: `disponibilidad_${gen.correlativo}`,
      columnas: [{ titulo: 'Cuenta bancaria', ancho: 16 }, { titulo: 'Nombre', ancho: 34 }, { titulo: 'Moneda', ancho: 14 }, { titulo: 'Saldo inicial', ancho: 15, tipo: 'monto' }, { titulo: 'Ingresos', ancho: 15, tipo: 'monto' },
        { titulo: 'Egresos', ancho: 15, tipo: 'monto' }, { titulo: 'Saldo (libros)', ancho: 16, tipo: 'monto' }, { titulo: 'En circulación', ancho: 15, tipo: 'monto' }, { titulo: 'Estimado en banco', ancho: 16, tipo: 'monto' },
        { titulo: 'Mínimo', ancho: 13, tipo: 'monto' }, { titulo: 'Disponible Q', ancho: 16, tipo: 'monto' }, { titulo: 'Observación', ancho: 16 }],
      filas
    });
  }

  async function leerGeneracion(sb, id) {
    const [g, d] = await Promise.all([
      sb.from('disponibilidad_generaciones').select('*').eq('id', id).maybeSingle(),
      sb.from('disponibilidad_detalle').select('*').eq('generacion_id', id).order('orden')
    ]);
    return { gen: g.data, det: d.data || [], error: g.error || d.error };
  }

  // ===================== Disponibilidad bancaria (proceso) =====================
  window.PANTALLAS['disponibilidad-bancaria'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Disponibilidad bancaria', icono: 'ti-chart-line', clase: 'bk-movimientos dsp-proceso' });
    const { sb } = ctx;
    const f = { banco: '', cuenta: '', fecha: fmt.hoy() };
    let cuentas = [];
    let actual = null; // { gen, det }
    const empresa = () => { const l = ctx.localidad(ctx.sel.loc); return l ? `${l.codigo} · ${l.nombre_comercial}` : ''; };
    const bancosConCuenta = () => (ctx.bancosLoc ? ctx.bancosLoc() : ctx.bancos || []).filter((b) => cuentas.some((c) => c.banco_id === b.id));

    function pintarFiltros() {
      const cs = cuentas.filter((c) => !f.banco || String(c.banco_id) === f.banco);
      ctx.filtros(`
        <label class="campo"><span>Banco</span><select name="banco"><option value="">Todos los bancos</option>${bancosConCuenta().map((b) => `<option value="${b.id}" ${f.banco === String(b.id) ? 'selected' : ''}>${b.codigo} · ${esc(b.nombre)}</option>`).join('')}</select></label>
        <label class="campo dsp-cta"><span>Cuenta bancaria</span><select name="cuenta"><option value="">Todas las cuentas</option>${cs.map((c) => `<option value="${c.id}" ${f.cuenta === String(c.id) ? 'selected' : ''}>${esc(c.numero)} · ${esc(c.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Disponibilidad al</span><input type="date" name="fecha" value="${f.fecha}" max="${fmt.hoy()}"></label>`,
        `<button type="button" class="boton primario dsp-generar" data-accion="generar"><i class="ti ti-player-play" aria-hidden="true"></i><span><b>Generar disponibilidad</b><small>Se guarda en el histórico</small></span></button>`);
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      cuentas = await ctx.cuentasBancarias();
      if (f.cuenta && !cuentas.some((c) => String(c.id) === f.cuenta)) f.cuenta = '';
      pintarFiltros();
      // Al abrir se muestra la última generación de la empresa.
      actual = null;
      if (ctx.sel.loc) {
        const { data, error } = await sb.from('disponibilidad_generaciones').select('id').eq('localidad_id', ctx.sel.loc).order('generado_en', { ascending: false }).limit(1);
        if (error && sinTabla(error)) { ctx.pDet.innerHTML = ctx.vacio(AVISO_SCRIPT, 'ti-alert-triangle'); return; }
        if (data?.[0]) actual = await leerGeneracion(sb, data[0].id);
      }
      pintar();
    }

    function pintar() {
      ctx.pMae.innerHTML = '';
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.'); return; }
      ctx.pDet.innerHTML = actual?.gen ? `${tablero(actual.gen, actual.det)}`
        : `<div class="dsp-vacio">${ctx.vacio('Elige el banco, la cuenta y la fecha, y presiona «Generar disponibilidad». Cada generación queda guardada en la Consulta de Disponibilidad.', 'ti-chart-line')}</div>`;
    }

    async function generar(boton) {
      if (!ctx.sel.loc) return window.FIN.aviso('Elige la empresa');
      boton.disabled = true;
      const { data, error } = await sb.rpc('generar_disponibilidad', { p_loc: ctx.sel.loc, p_banco: f.banco ? Number(f.banco) : null, p_cuenta: f.cuenta ? Number(f.cuenta) : null, p_fecha: f.fecha });
      boton.disabled = false;
      if (error) return window.FIN.aviso(sinTabla(error) ? AVISO_SCRIPT : window.UI.traducirError(error));
      actual = await leerGeneracion(sb, data.id);
      window.FIN.aviso(`Disponibilidad ${data.correlativo} generada y guardada`);
      pintar();
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { f.banco = ''; f.cuenta = ''; return cargarLocalidad(); }
      if (cambio === 'otro') {
        const n = e.target.name;
        if (n === 'banco') { f.banco = e.target.value; f.cuenta = ''; return pintarFiltros(); }
        if (n === 'cuenta' || n === 'fecha') f[n] = e.target.value;
      }
    });
    cont.addEventListener('click', (e) => {
      const ac = e.target.closest('[data-accion]');
      if (!ac) return;
      if (ac.dataset.accion === 'generar') return generar(ac);
      if (ac.dataset.accion === 'pdf' && actual?.gen) return pdf(actual.gen, actual.det, empresa());
      if (ac.dataset.accion === 'excel' && actual?.gen) return excel(actual.gen, actual.det, empresa());
    });
    iniciar();
  };

  // ===================== Consulta de Disponibilidad (histórico) =====================
  window.PANTALLAS['consulta-de-disponibilidad'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Consulta de Disponibilidad', icono: 'ti-file-search', clase: 'bk-movimientos bk-consultar cb-apilado bk-consulta-cheques dsp-consulta' });
    const { sb } = ctx;
    const [anio] = fmt.hoy().split('-');
    const f = { desde: `${anio}-01-01`, hasta: fmt.hoy(), banco: '', usuario: '', buscar: '' };
    let lista = [], sel = null, actual = null, consulta = 0;
    const empresa = () => { const l = ctx.localidad(ctx.sel.loc); return l ? `${l.codigo} · ${l.nombre_comercial}` : ''; };

    function pintarFiltros() {
      const usuarios = [...new Set(lista.map((g) => g.usuario).filter(Boolean))].sort();
      ctx.filtros(`
        <label class="campo"><span>Banco</span><select name="banco"><option value="">Todos</option>${(ctx.bancosLoc ? ctx.bancosLoc() : []).map((b) => `<option value="${b.id}" ${f.banco === String(b.id) ? 'selected' : ''}>${b.codigo} · ${esc(b.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Generó</span><select name="usuario"><option value="">Todos los usuarios</option>${usuarios.map((u) => `<option ${f.usuario === u ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></label>
        <label class="campo"><span>Generadas desde</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>`,
        '<button type="button" class="boton cqc-excel" data-accion="excel-lista" title="Listado de generaciones en Excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i><span><b>Generar Excel</b><small>Listado del histórico</small></span></button>');
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      // Fecha inicial por omisión: la de la primera generación de la empresa.
      const pr = ctx.sel.loc ? await sb.from('disponibilidad_generaciones').select('generado_en').eq('localidad_id', ctx.sel.loc).order('generado_en').limit(1) : { data: [] };
      if (pr.error && sinTabla(pr.error)) { pintarFiltros(); ctx.pMae.innerHTML = ctx.vacio(AVISO_SCRIPT, 'ti-alert-triangle'); ctx.pDet.innerHTML = ''; return; }
      f.desde = pr.data?.[0] ? String(new Date(pr.data[0].generado_en).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' })) : `${anio}-01-01`;
      if (f.hasta < f.desde) f.hasta = fmt.hoy();
      await consultar();
    }
    async function consultar(id = sel?.id) {
      const loc = ctx.sel.loc;
      if (!loc) { lista = []; pintarFiltros(); pintar(); return; }
      const yo = ++consulta;
      const fin = new Date(`${f.hasta}T23:59:59-06:00`).toISOString();
      const ini = new Date(`${f.desde}T00:00:00-06:00`).toISOString();
      let q = sb.from('disponibilidad_generaciones').select('*').eq('localidad_id', loc).gte('generado_en', ini).lte('generado_en', fin).order('generado_en', { ascending: false }).limit(1000);
      if (f.banco) q = q.eq('banco_id', Number(f.banco));
      const { data, error } = await q;
      if (yo !== consulta) return;
      if (error) { ctx.pMae.innerHTML = ctx.vacio(sinTabla(error) ? AVISO_SCRIPT : error.message, 'ti-alert-triangle'); return; }
      lista = data || [];
      pintarFiltros();
      sel = visibles().find((g) => g.id === id) || visibles()[0] || null;
      pintarMaestro();
      await elegir(sel);
    }
    const visibles = () => {
      const q = f.buscar.trim().toLowerCase();
      return lista.filter((g) => (!f.usuario || g.usuario === f.usuario) && (!q || [g.correlativo, g.usuario, g.usuario_nombre, g.banco_nombre, g.cuenta_numero].some((v) => String(v || '').toLowerCase().includes(q))));
    };

    function pintarMaestro() {
      const filas = visibles();
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>Generaciones <small>${filas.length}</small></h2>
          <div class="ta-totales pc-resumen">
            <span class="ta-total"><b>${new Set(filas.map((g) => g.usuario)).size}</b> usuarios</span>
            ${filas[0] ? `<span class="ta-total"><b>${esc(filas[0].correlativo)}</b> la más reciente</span>` : ''}
          </div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Correlativo, usuario, banco o cuenta…" value="${esc(f.buscar)}" aria-label="Buscar generaciones"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table class="dsp-lista"><thead><tr><th>Correlativo</th><th>Generada</th><th>Disponibilidad al</th><th>Banco · cuenta</th><th class="num">Cuentas</th><th class="num">Disponible Q</th><th class="num">En circulación Q</th><th>Bajo mínimo</th><th>Generó</th></tr></thead>
            <tbody>${filas.map((g) => `<tr data-gen="${g.id}" class="${sel && sel.id === g.id ? 'actual' : ''}" tabindex="0">
              <td class="fuerte">${esc(g.correlativo)}</td><td>${esc(fhs(g.generado_en))}</td><td>${esc(fmt.fechaDia(g.fecha_corte))}</td>
              <td>${esc(g.banco_nombre || 'Todos los bancos')}<small>${esc(g.cuenta_numero || 'Todas las cuentas')}</small></td>
              <td class="num">${g.cuentas}</td><td class="num fuerte">${m(g.total_saldo_ml)}</td><td class="num ${Number(g.total_circulacion_ml) < 0 ? 'pc-rojo' : ''}">${m(g.total_circulacion_ml)}</td>
              <td>${g.bajo_minimo ? `<span class="pc-marca anulada">${g.bajo_minimo}</span>` : '<span class="pc-marca aprobada">Ninguna</span>'}</td>
              <td>${esc(g.usuario || '')}<small>${esc(g.usuario_nombre || '')}</small></td></tr>`).join('')
              || `<tr><td colspan="9" class="tk-vacio"><i class="ti ti-file-search" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : 'No hay generaciones con estos parámetros. Genera una en Bancos · Disponibilidad bancaria.'}</td></tr>`}</tbody></table>
        </div>`;
    }
    async function elegir(g) {
      sel = g;
      actual = null;
      ctx.pMae.querySelectorAll('tr[data-gen]').forEach((tr) => tr.classList.toggle('actual', !!g && tr.dataset.gen === String(g.id)));
      if (!g) { ctx.pDet.innerHTML = ctx.vacio(ctx.sel.loc ? 'Elige una generación para ver su detalle.' : 'Elige la empresa.', 'ti-file-search'); return; }
      ctx.pDet.innerHTML = ctx.vacio('Cargando la generación…', 'ti-loader-2');
      const r = await leerGeneracion(sb, g.id);
      if (sel !== g) return;
      actual = r;
      ctx.pDet.innerHTML = tablero(r.gen, r.det);
    }
    function pintar() { pintarMaestro(); elegir(sel); }

    function excelLista() {
      const filas = visibles();
      if (!filas.length) return window.FIN.aviso('No hay generaciones con estos parámetros');
      window.REPORTE_XLSX.generar({
        titulo: 'Consulta de Disponibilidad',
        parametros: [`Empresa: ${empresa()}`, `Generadas del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, `Banco: ${f.banco ? (ctx.banco(Number(f.banco))?.nombre || '') : 'Todos'}`, `Generó: ${f.usuario || 'Todos'}`],
        orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Disponibilidad', archivo: `consulta_disponibilidad_${f.desde}_${f.hasta}`, autofiltro: true,
        columnas: [{ titulo: 'Correlativo', ancho: 18 }, { titulo: 'Generada', ancho: 20 }, { titulo: 'Disponibilidad al', ancho: 14 }, { titulo: 'Banco', ancho: 24 }, { titulo: 'Cuenta', ancho: 16 },
          { titulo: 'Cuentas', ancho: 9, tipo: 'numero' }, { titulo: 'Disponible Q', ancho: 16, tipo: 'monto' }, { titulo: 'En circulación Q', ancho: 16, tipo: 'monto' }, { titulo: 'Bajo mínimo', ancho: 11, tipo: 'numero' }, { titulo: 'Generó', ancho: 20 }],
        filas: filas.map((g) => ({ valores: [g.correlativo, fhs(g.generado_en), fmt.fechaDia(g.fecha_corte), g.banco_nombre || 'Todos', g.cuenta_numero || 'Todas', g.cuentas, Number(g.total_saldo_ml), Number(g.total_circulacion_ml), g.bajo_minimo, `${g.usuario || ''}${g.usuario_nombre ? ` · ${g.usuario_nombre}` : ''}`] }))
      });
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { sel = null; f.banco = ''; f.usuario = ''; return cargarLocalidad(); }
      if (cambio === 'otro') {
        const n = e.target.name;
        if (n === 'usuario') { f.usuario = e.target.value; pintarMaestro(); return elegir(visibles().find((g) => g.id === sel?.id) || visibles()[0] || null); }
        if (n === 'banco' || n === 'desde' || n === 'hasta') { f[n] = e.target.value; sel = null; return consultar(); }
      }
    });
    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-buscar]')) return;
      f.buscar = e.target.value;
      const pos = e.target.selectionStart;
      pintarMaestro();
      const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
    });
    cont.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('tr[data-gen]')) e.target.click(); });
    cont.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-gen]');
      if (tr && ctx.pMae.contains(tr)) return elegir(lista.find((g) => String(g.id) === tr.dataset.gen));
      const ac = e.target.closest('[data-accion]');
      if (!ac) return;
      if (ac.dataset.accion === 'excel-lista') return excelLista();
      if (ac.dataset.accion === 'pdf' && actual?.gen) return pdf(actual.gen, actual.det, empresa());
      if (ac.dataset.accion === 'excel' && actual?.gen) return excel(actual.gen, actual.det, empresa());
    });
    iniciar();
  };
})();
