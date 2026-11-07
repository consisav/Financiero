// Caja y Bancos · Cajas · Liquidación de Cajas Chicas (script 120): las subcajas de una caja o de todas, con su
// mes, total de gastos, anticipo y adelanto (cuenta, cheque, nota y valor) y lo que falta por liquidar. Se marcan
// las que se van a liquidar y abajo se ejecuta la liquidación con una nota o un cheque (cuenta bancaria, número,
// fecha y total): cada subcaja queda liquidada con su póliza (liquidar_cajas). PDF y Excel del listado.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  window.PANTALLAS = window.PANTALLAS || {};

  window.PANTALLAS['liquidacion-cajas-chicas'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Liquidación de Cajas Chicas', icono: 'ti-file-check', clase: 'bk-movimientos lq-cajas', grupo: 'Cajas' });
    const { sb } = ctx;
    const f = { caja: '', estado: 'PENDIENTES', buscar: '' };
    const ej = { tipo: 'NOTA', cuenta: '', numero: '', fecha: fmt.hoy() };
    let cajas = [], subcajas = [], cuentas = [], contables = [], transacciones = [], marcadas = new Set(), sel = null;

    const caja = (id) => cajas.find((c) => c.id === id);
    const cuentaB = (id) => cuentas.find((c) => c.id === id);
    const contable = (id) => contables.find((c) => c.id === id);
    const porLiquidar = (p) => fmt.redondear(Number(p.liquidado) - Number(p.anticipo_valor) - Number(p.adelanto_valor));
    const mes = (p) => `${MESES[p.mes - 1]} ${p.anio}`;
    const simbolo = (c) => ctx.moneda(c?.moneda_id)?.simbolo || 'Q';

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo lq-caja"><span>Caja</span><select name="caja"><option value="">Todas las cajas</option>${cajas.map((c) => `<option value="${c.id}" ${String(c.id) === f.caja ? 'selected' : ''}>${c.codigo} · ${esc(c.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Subcajas</span><select name="estado">${[['PENDIENTES', 'Por liquidar'], ['LIQUIDADAS', 'Liquidadas'], ['TODAS', 'Todas']].map(([k, t]) => `<option value="${k}" ${f.estado === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`,
        `<div class="bmc-reportes"><button type="button" class="boton secundario-sm bca-pdf" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i><span><b>Imprimir en PDF</b><small>Subcajas</small></span></button>
         <button type="button" class="boton cqc-excel" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i><span><b>Generar Excel</b><small>Subcajas</small></span></button>
         <button type="button" class="boton primario-sm" data-accion="consultar"><i class="ti ti-search" aria-hidden="true"></i> Consultar</button></div>`);
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      const [c, cb, k, t] = await Promise.all([
        loc ? sb.from('cajas_chicas').select('*').eq('localidad_id', loc).order('codigo') : { data: [] },
        ctx.cuentasBancarias(), ctx.cuentasContables(),
        loc ? sb.from('transacciones_contables').select('id, numero, descripcion').eq('localidad_id', loc) : { data: [] }
      ]);
      if (c.error) { pintarFiltros(); ctx.pMae.innerHTML = ctx.vacio(/cajas_chicas/.test(c.error.message) ? 'Falta instalar el script 54 (cajas chicas) en Supabase.' : esc(c.error.message), 'ti-alert-triangle'); return; }
      cajas = c.data || []; cuentas = cb; contables = k; transacciones = t.data || [];
      if (f.caja && !caja(Number(f.caja))) f.caja = '';
      pintarFiltros();
      await consultar();
    }
    async function consultar() {
      marcadas = new Set();
      const ids = (f.caja ? cajas.filter((c) => String(c.id) === f.caja) : cajas).map((c) => c.id);
      if (!ids.length) { subcajas = []; sel = null; return pintar(); }
      let q = sb.from('caja_periodos_resumen').select('*').in('caja_id', ids).order('anio', { ascending: false }).order('mes', { ascending: false }).order('numero', { ascending: false }).limit(2000);
      if (f.estado === 'PENDIENTES') q = q.eq('estado', 'ABIERTA');
      if (f.estado === 'LIQUIDADAS') q = q.eq('estado', 'LIQUIDADA');
      const { data, error } = await q;
      if (error) { ctx.pMae.innerHTML = ctx.vacio(esc(error.message), 'ti-alert-triangle'); return; }
      subcajas = data || [];
      sel = subcajas.find((p) => p.id === sel?.id) || subcajas[0] || null;
      pintar();
    }
    const visibles = () => { const q = f.buscar.trim().toLowerCase(); return subcajas.filter((p) => !q || [caja(p.caja_id)?.nombre, caja(p.caja_id)?.codigo, p.numero, mes(p), p.anticipo_cheque, p.anticipo_nota].some((v) => String(v || '').toLowerCase().includes(q))); };

    function pintar() { pintarLista(); pintarEjecutar(); }
    function pintarLista() {
      const filas = visibles();
      const pend = filas.filter((p) => p.estado === 'ABIERTA');
      const tot = (ls, fn) => ls.reduce((t, p) => t + fn(p), 0);
      const fondo = (p, k) => `${esc(cuentaB(p[`${k}_cuenta_id`])?.numero || '')}<small>${p[`${k}_cheque`] ? `ch. ${esc(p[`${k}_cheque`])}` : ''}${p[`${k}_nota`] ? ` nota ${esc(p[`${k}_nota`])}` : ''}</small>`;
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab tg-cab">
          <h2>Subcajas <small>${filas.length}</small></h2>
          <div class="ta-totales pc-resumen"><span class="ta-total"><b>${pend.length}</b> por liquidar</span><span class="ta-total"><b>Q ${fmt.monto(tot(pend, (p) => Number(p.liquidado)))}</b> en gastos</span><span class="ta-total sin"><b>Q ${fmt.monto(tot(pend, (p) => Math.max(0, porLiquidar(p))))}</b> por reembolsar</span><span class="ta-total"><b>${marcadas.size}</b> marcadas</span></div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Caja, mes, cheque o nota…" value="${esc(f.buscar)}" aria-label="Buscar subcajas"></label>
        </header>
        <div class="ta-tabla"><table class="bmc-tabla lq-tabla"><colgroup><col style="width:22%"><col style="width:70px"><col style="width:120px"><col style="width:112px"><col><col style="width:110px"><col><col style="width:110px"><col style="width:120px"><col style="width:112px"></colgroup>
          <thead><tr><th>Caja</th><th class="num">Subcaja</th><th>Mes</th><th class="num">Total gastos</th><th>Anticipo · cuenta</th><th class="num">Anticipo</th><th>Adelanto · cuenta</th><th class="num">Adelanto</th><th class="num">Por liquidar</th><th class="lq-ck">${f.estado !== 'LIQUIDADAS' && ctx.admin ? '<label class="pc-check"><input type="checkbox" data-marcar-todas aria-label="Marcar todas"> Liquidar</label>' : 'Estado'}</th></tr></thead>
          <tbody>${filas.map((p) => { const c = caja(p.caja_id); const pl = porLiquidar(p); return `<tr data-sub="${p.id}" class="${sel && sel.id === p.id ? 'actual' : ''} ${marcadas.has(p.id) ? 'lq-marcada' : ''}" tabindex="0">
            <td title="${esc(c?.nombre || '')}"><b>${c?.codigo ?? ''} · ${esc(c?.nombre || '')}</b><small>${esc(c?.responsable || '')}</small></td>
            <td class="num fuerte">${p.numero}</td><td>${esc(mes(p))}<small>${p.documentos} doc.</small></td>
            <td class="num fuerte">${esc(simbolo(c))} ${fmt.monto(p.liquidado)}</td>
            <td>${fondo(p, 'anticipo')}</td><td class="num">${fmt.monto(p.anticipo_valor)}</td>
            <td>${fondo(p, 'adelanto')}</td><td class="num">${fmt.monto(p.adelanto_valor)}</td>
            <td class="num ${pl > 0 ? 'pc-rojo fuerte' : ''}">${fmt.monto(pl)}<small>${pl > 0 ? 'por reembolsar' : pl < 0 ? 'fondo sin usar' : 'cuadra'}</small></td>
            <td class="lq-ck">${p.estado === 'LIQUIDADA' ? `<span class="pc-marca definitiva">Liquidada</span>` : ctx.admin ? `<input type="checkbox" data-marcar="${p.id}" ${marcadas.has(p.id) ? 'checked' : ''} ${p.documentos ? '' : 'disabled title="Sin documentos"'} aria-label="Liquidar la subcaja ${p.numero}">` : '<span class="pc-marca pendiente">Abierta</span>'}</td></tr>`; }).join('')
            || `<tr><td colspan="10" class="tk-vacio"><i class="ti ti-file-check" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : !cajas.length ? 'La empresa no tiene cajas.' : 'No hay subcajas con estos parámetros.'}</td></tr>`}</tbody>
        </table></div>`;
    }

    function pintarEjecutar() {
      const p = sel;
      const c = p ? caja(p.caja_id) : null;
      const k = c ? contable(c.cuenta_id) : null;
      const tr = c ? transacciones.find((t) => t.id === c.transaccion_id) : null;
      const ms = subcajas.filter((x) => marcadas.has(x.id));
      const total = ms.reduce((t, x) => t + Math.max(0, porLiquidar(x)), 0);
      const gastos = ms.reduce((t, x) => t + Number(x.liquidado), 0);
      if (ej.cuenta === '' && c?.cuenta_bancaria_id) ej.cuenta = String(c.cuenta_bancaria_id);
      ctx.pDet.innerHTML = `
        <div class="lq-abajo">
          <section class="bm-bloque lq-caja-info">
            <h3 class="ta-col-titulo"><i class="ti ti-cash-register" aria-hidden="true"></i> Caja elegida</h3>
            ${c ? `<dl>
              <div class="bm-dato"><dt>Caja</dt><dd>${c.codigo} · ${esc(c.nombre)}</dd></div>
              <div class="bm-dato"><dt>Responsable</dt><dd>${esc(c.responsable || '—')}</dd></div>
              <div class="bm-dato"><dt>Cuenta</dt><dd>${esc(k ? `${k.codigo} · ${k.nombre}` : '—')}</dd></div>
              <div class="bm-dato"><dt>Transacción</dt><dd>${esc(tr ? `${tr.numero} · ${tr.descripcion}` : '—')}</dd></div>
              <div class="bm-dato"><dt>Subcaja</dt><dd>${p.numero} · ${esc(mes(p).toLowerCase())}</dd></div>
              <div class="bm-dato"><dt>Creación</dt><dd>${esc(p.usuario || '')} <small>${esc(fmt.fechaHora(p.creado_en))}</small></dd></div>
              ${p.estado === 'LIQUIDADA' ? `<div class="bm-dato"><dt>Liquidó</dt><dd>${esc(p.liquidado_por || '')} <small>${esc(fmt.fechaHora(p.liquidado_en))}</small></dd></div><div class="bm-dato"><dt>Liquidación</dt><dd>${p.liquidacion_nota ? `Nota ${esc(p.liquidacion_nota)}` : p.liquidacion_cheque ? `Cheque ${esc(p.liquidacion_cheque)}` : '—'} · ${fmt.monto(p.liquidacion_valor)}</dd></div>` : ''}
            </dl>
            <a class="boton secundario-sm" href="#/caja-bancos/cajas-chicas" data-abrir-caja="${c.id}"><i class="ti ti-arrow-right" aria-hidden="true"></i> Abrir en Cajas chicas</a>` : ctx.vacio('Elige una subcaja.', 'ti-cash-register')}
          </section>
          <section class="bm-bloque lq-ejecutar">
            <h3 class="ta-col-titulo"><i class="ti ti-player-play" aria-hidden="true"></i> Ejecutar la liquidación de las subcajas marcadas <small>${ms.length}</small></h3>
            ${ctx.admin ? `<div class="lq-tipo" role="radiogroup" aria-label="Documento de la liquidación">${[['NOTA', 'ti-file-invoice', 'Nota de liquidación'], ['CHEQUE', 'ti-writing', 'Cheque de liquidación']].map(([x, ic, t]) => `<button type="button" role="radio" aria-checked="${ej.tipo === x}" class="${ej.tipo === x ? 'activo' : ''}" data-tipo-liq="${x}"><i class="ti ${ic}" aria-hidden="true"></i> ${t}</button>`).join('')}</div>
            <div class="lq-campos">
              <label class="campo lq-c2"><span>Cuenta bancaria</span><select name="ej_cuenta"><option value="">—</option>${cuentas.filter((x) => x.activo).map((x) => `<option value="${x.id}" ${String(x.id) === ej.cuenta ? 'selected' : ''}>${esc(ctx.nombreCuentaBancaria(x))}</option>`).join('')}</select></label>
              <label class="campo"><span>${ej.tipo === 'NOTA' ? 'Nota física' : 'No. cheque'}</span><input name="ej_numero" value="${esc(ej.numero)}" maxlength="20"></label>
              <label class="campo"><span>Fecha</span><input type="date" name="ej_fecha" value="${esc(ej.fecha)}"></label>
              <div class="lq-total"><span>Total gastos</span><b>Q ${fmt.monto(gastos)}</b></div>
              <div class="lq-total principal"><span>Total a liquidar (reembolso)</span><b>Q ${fmt.monto(total)}</b></div>
            </div>
            <div class="lq-pie"><p class="modal-error tk-error" role="alert"></p>
              <button type="button" class="boton primario-sm" data-accion="liquidar" ${ms.length ? '' : 'disabled'}><i class="ti ti-file-check" aria-hidden="true"></i> Liquidar ${ms.length} subcaja${ms.length === 1 ? '' : 's'} y generar pólizas</button></div>` : '<p class="tk-tenue">Solo un administrador liquida las cajas chicas.</p>'}
          </section>
        </div>`;
    }

    async function liquidar() {
      const ms = subcajas.filter((x) => marcadas.has(x.id));
      const err = ctx.pDet.querySelector('.lq-ejecutar .modal-error');
      if (!ms.length) return;
      if (!ej.numero.trim()) { err.textContent = `Escribe el número de ${ej.tipo === 'NOTA' ? 'la nota' : 'el cheque'} de la liquidación.`; return; }
      const total = ms.reduce((t, x) => t + Math.max(0, porLiquidar(x)), 0);
      if (!confirm(`¿Liquidar ${ms.length} subcaja(s) con ${ej.tipo === 'NOTA' ? 'la nota' : 'el cheque'} ${ej.numero} por Q ${fmt.monto(total)} y generar sus pólizas?\n\nLas subcajas y sus documentos ya no se podrán modificar.`)) return;
      const { data, error } = await sb.rpc('liquidar_cajas', { p_ids: ms.map((x) => x.id), p_cuenta: ej.cuenta ? Number(ej.cuenta) : null, p_tipo: ej.tipo, p_documento: ej.numero.trim(), p_fecha: ej.fecha || null, p_partida: true });
      if (error) { err.textContent = /liquidar_cajas/.test(error.message) ? 'Falta ejecutar en Supabase el script 20261106000120_definicion_y_liquidacion_cajas.sql.' : window.UI.traducirError(error); return; }
      window.FIN.aviso(`${data.subcajas} subcaja(s) liquidada(s) · Q ${fmt.monto(data.total)}${data.polizas?.length ? ` · pólizas ${data.polizas.join(', ')}` : ''}`);
      ej.numero = '';
      await consultar();
    }

    // ---------- Reportes del listado ----------
    function reporte(formato) {
      const filas = visibles();
      if (!filas.length) return window.FIN.aviso('No hay subcajas con estos parámetros');
      const l = ctx.localidad(ctx.sel.loc);
      const c0 = f.caja ? caja(Number(f.caja)) : null;
      const params = [`Empresa: ${l ? `${l.codigo} · ${l.nombre_comercial}` : ''}`, `Caja: ${c0 ? `${c0.codigo} · ${c0.nombre}` : 'Todas'}`, `Subcajas: ${{ PENDIENTES: 'Por liquidar', LIQUIDADAS: 'Liquidadas', TODAS: 'Todas' }[f.estado]}`, ...(f.buscar.trim() ? [`Búsqueda: ${f.buscar.trim()}`] : [])];
      const fila = (p) => { const c = caja(p.caja_id); return [`${c?.codigo ?? ''} · ${c?.nombre || ''}`, p.numero, mes(p), p.documentos, Number(p.liquidado), Number(p.anticipo_valor), [p.anticipo_cheque && `ch. ${p.anticipo_cheque}`, p.anticipo_nota && `nota ${p.anticipo_nota}`].filter(Boolean).join(' '), Number(p.adelanto_valor), porLiquidar(p), p.estado === 'LIQUIDADA' ? `Liquidada ${p.liquidacion_nota ? `nota ${p.liquidacion_nota}` : p.liquidacion_cheque ? `ch. ${p.liquidacion_cheque}` : ''}` : 'Por liquidar']; };
      const tot = (i) => filas.reduce((t, p) => t + Number(fila(p)[i] || 0), 0);
      if (formato === 'PDF') {
        return imprimir('Liquidación de Cajas Chicas', `<h1>Liquidación de Cajas Chicas</h1><h2>${esc(params.join(' · '))}</h2>
          <table><thead><tr><th>Caja</th><th class="n">Subcaja</th><th>Mes</th><th class="n">Doc.</th><th class="n">Total gastos</th><th class="n">Anticipo</th><th>Cheque / nota</th><th class="n">Adelanto</th><th class="n">Por liquidar</th><th>Estado</th></tr></thead><tbody>
          ${filas.map((p) => { const r = fila(p); return `<tr><td>${esc(r[0])}</td><td class="n">${r[1]}</td><td>${esc(r[2])}</td><td class="n">${r[3]}</td><td class="n">${fmt.monto(r[4])}</td><td class="n">${fmt.monto(r[5])}</td><td>${esc(r[6])}</td><td class="n">${fmt.monto(r[7])}</td><td class="n">${fmt.monto(r[8])}</td><td>${esc(r[9])}</td></tr>`; }).join('')}
          </tbody><tfoot><tr><td colspan="4">${filas.length} subcajas</td><td class="n">${fmt.monto(tot(4))}</td><td class="n">${fmt.monto(tot(5))}</td><td></td><td class="n">${fmt.monto(tot(7))}</td><td class="n">${fmt.monto(tot(8))}</td><td></td></tr></tfoot></table>`, { locId: ctx.sel.loc });
      }
      window.REPORTE_XLSX.generar({
        titulo: 'Liquidación de Cajas Chicas', parametros: params, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Liquidación', archivo: `liquidacion_cajas_${l?.codigo || ''}`, autofiltro: true,
        columnas: [{ titulo: 'Caja', ancho: 38 }, { titulo: 'Subcaja', ancho: 9, tipo: 'numero' }, { titulo: 'Mes', ancho: 16 }, { titulo: 'Documentos', ancho: 11, tipo: 'numero' }, { titulo: 'Total gastos', ancho: 14, tipo: 'monto' }, { titulo: 'Anticipo', ancho: 14, tipo: 'monto' },
          { titulo: 'Cheque / nota', ancho: 18 }, { titulo: 'Adelanto', ancho: 14, tipo: 'monto' }, { titulo: 'Por liquidar', ancho: 14, tipo: 'monto' }, { titulo: 'Estado', ancho: 22 }],
        filas: [...filas.map((p) => ({ valores: fila(p) })), { tipo: 'total', valores: [`${filas.length} subcajas`, null, '', null, tot(4), tot(5), '', tot(7), tot(8), ''] }]
      });
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { f.caja = ''; ej.cuenta = ''; return cargarLocalidad(); }
      if (cambio === 'otro' && (e.target.name === 'caja' || e.target.name === 'estado')) { f[e.target.name] = e.target.value; return consultar(); }
      const m = e.target.closest('[data-marcar]');
      if (m) { const id = Number(m.dataset.marcar); if (m.checked) marcadas.add(id); else marcadas.delete(id); m.closest('tr').classList.toggle('lq-marcada', m.checked); pintarLista(); return pintarEjecutar(); }
      if (e.target.matches('[data-marcar-todas]')) { visibles().filter((p) => p.estado === 'ABIERTA' && p.documentos).forEach((p) => { if (e.target.checked) marcadas.add(p.id); else marcadas.delete(p.id); }); pintarLista(); return pintarEjecutar(); }
      if (e.target.name === 'ej_cuenta') ej.cuenta = e.target.value;
      if (e.target.name === 'ej_fecha') ej.fecha = e.target.value;
    });
    cont.addEventListener('input', (e) => {
      if (e.target.name === 'ej_numero') { ej.numero = e.target.value; return; }
      if (!e.target.matches('[data-buscar]')) return;
      f.buscar = e.target.value; const pos = e.target.selectionStart; pintarLista();
      const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
    });
    cont.addEventListener('click', (e) => {
      if (e.target.closest('[data-marcar], [data-marcar-todas]')) return;
      const ab = e.target.closest('[data-abrir-caja]');
      if (ab) { try { sessionStorage.setItem('fin.caja', ab.dataset.abrirCaja); } catch { /* sin almacenamiento */ } return; }
      const tr = e.target.closest('tr[data-sub]');
      if (tr && ctx.pMae.contains(tr)) { sel = subcajas.find((p) => String(p.id) === tr.dataset.sub); ctx.pMae.querySelectorAll('tr[data-sub]').forEach((x) => x.classList.toggle('actual', x === tr)); return pintarEjecutar(); }
      const tl = e.target.closest('[data-tipo-liq]');
      if (tl) { ej.tipo = tl.dataset.tipoLiq; return pintarEjecutar(); }
      const ac = e.target.closest('[data-accion]');
      if (!ac) return;
      if (ac.dataset.accion === 'consultar') return consultar();
      if (ac.dataset.accion === 'liquidar') return liquidar();
      if (ac.dataset.accion === 'pdf') return reporte('PDF');
      if (ac.dataset.accion === 'excel') return reporte('EXCEL');
    });

    iniciar();
  };
})();
