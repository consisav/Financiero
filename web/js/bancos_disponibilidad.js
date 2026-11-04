// Caja y Bancos · Bancos · Disponibilidad bancaria y Disponibilidad integrada, con el diseño de
// los depósitos (encabezado en tarjetas y pestañas). Son consultas: no se modifican.
//   Disponibilidad bancaria (empresa): la cuenta elegida con su saldo inicial, ingresos (depósitos
//   y notas de crédito), egresos (notas de débito) y saldo final en un rango de fechas; pestañas
//   con su movimiento y disponible acumulado, el resumen de todas las cuentas y los totales por
//   tipo de documento.
//   Disponibilidad integrada (organización de la empresa elegida): todas las cuentas de todas sus
//   localidades a una fecha, en su moneda y en quetzales, con su saldo mínimo; pestañas por cuenta,
//   por localidad y por banco.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir, pestanas: barraPestanas, activarPestana } = window.BANCOS;
  const TIPOS = { DEPOSITO: 'Depósito', NOTA_CREDITO: 'Nota de crédito', NOTA_DEBITO: 'Nota de débito' };
  const signo = (m) => m.tipo === 'NOTA_DEBITO' ? -Number(m.valor_cuenta) : Number(m.valor_cuenta);
  const diaAntes = (d) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };
  const dato = (etq, val) => `<div class="bm-dato"><dt>${etq}</dt><dd>${val === '' || val == null ? '<span class="tk-tenue">—</span>' : val}</dd></div>`;

  window.PANTALLAS = window.PANTALLAS || {};

  // ===================== Disponibilidad bancaria =====================
  window.PANTALLAS['disponibilidad-bancaria'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Disponibilidad bancaria', icono: 'ti-chart-line', clase: 'bk-movimientos bk-disp' });
    const { sb } = ctx;
    const [a0, m0] = fmt.hoy().split('-');
    const f = { desde: `${a0}-${m0}-01`, hasta: fmt.hoy() };
    let cuentas = [];
    let filas = [];         // { cb, inicial, ingresos, egresos, final, movs }
    let actual = null;
    let pestana = 'MOVIMIENTO';

    const empresa = () => { const l = ctx.localidad(ctx.sel.loc); return l ? `${l.codigo} · ${l.nombre_comercial}` : ''; };

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>`);
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      cuentas = await ctx.cuentasBancarias();
      pintarFiltros();
      await consultar();
    }

    async function consultar() {
      filas = await Promise.all(cuentas.map(async (cb) => {
        const [ini, m] = await Promise.all([
          sb.rpc('saldo_cuenta_bancaria', { p_cuenta: cb.id, p_hasta: diaAntes(f.desde) }),
          sb.from('movimientos_bancarios').select('*').eq('cuenta_bancaria_id', cb.id).eq('estado', 'ACTIVO').gte('fecha', f.desde).lte('fecha', f.hasta).order('fecha').order('folio')
        ]);
        // Los movimientos antes del saldo inicial de la cuenta no cuentan.
        const movs = (m.data || []).filter((x) => x.fecha >= cb.fecha_saldo_inicial);
        const inicial = f.desde <= cb.fecha_saldo_inicial ? Number(cb.saldo_inicial) : Number(ini.data || 0);
        const ingresos = movs.filter((x) => x.tipo !== 'NOTA_DEBITO').reduce((s, x) => s + Number(x.valor_cuenta), 0);
        const egresos = movs.filter((x) => x.tipo === 'NOTA_DEBITO').reduce((s, x) => s + Number(x.valor_cuenta), 0);
        return { cb, inicial, ingresos, egresos, final: inicial + ingresos - egresos, movs };
      }));
      actual = filas.find((r) => r.cb.id === actual?.cb.id) || filas[0] || null;
      pintarMaestro();
      pintarDetalle();
    }

    // Resumen de todas las cuentas de la empresa (pestaña «Resumen de cuentas»).
    function pintarMaestro() {
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab tg-cab"><h2>Movimiento de bancos <small>${esc(fmt.fechaDia(f.desde))} al ${esc(fmt.fechaDia(f.hasta))}</small></h2></header>
        <div class="ta-tabla">
          <table>
            <thead><tr><th>Cuenta bancaria</th><th>Banco</th><th>Nombre</th><th>Moneda</th><th class="num">Saldo inicial</th><th class="num">Ingresos</th><th class="num">Egresos</th><th class="num">Saldo final</th><th class="num">Saldo mínimo</th></tr></thead>
            <tbody>
              ${filas.map((r) => `<tr class="${actual && actual.cb.id === r.cb.id ? 'actual' : ''}" data-cuenta="${r.cb.id}" tabindex="0">
                <td class="fuerte">${esc(r.cb.numero)}</td><td>${esc(ctx.banco(r.cb.banco_id)?.nombre || '')}</td><td>${esc(r.cb.nombre)}</td><td>${esc(ctx.moneda(r.cb.moneda_id)?.nombre || '')}</td>
                <td class="num">${fmt.monto(r.inicial)}</td><td class="num bd-ingreso">${fmt.monto(r.ingresos)}</td><td class="num bd-egreso">${fmt.monto(r.egresos)}</td>
                <td class="num fuerte ${r.final < Number(r.cb.saldo_minimo) ? 'pc-rojo' : ''}">${fmt.monto(r.final)}</td><td class="num">${fmt.monto(r.cb.saldo_minimo)}</td></tr>`).join('')
                || '<tr><td colspan="9" class="tk-vacio"><i class="ti ti-building-bank" aria-hidden="true"></i>La empresa no tiene cuentas bancarias.</td></tr>'}
            </tbody>
          </table>
        </div>`;
    }

    function pintarDetalle() {
      const r = actual;
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.'); return; }
      if (!r) { ctx.pDet.innerHTML = ctx.vacio('La empresa no tiene cuentas bancarias: créalas en Bancos · Cuentas bancarias.'); return; }
      const banco = ctx.banco(r.cb.banco_id);
      const mon = ctx.moneda(r.cb.moneda_id);
      const minimo = Number(r.cb.saldo_minimo);
      const bajo = r.final < minimo;
      const totalQ = filas.reduce((s, x) => s + x.final * (ctx.moneda(x.cb.moneda_id)?.cambio || 1), 0);
      const porTipo = Object.keys(TIPOS).map((t) => { const ls = r.movs.filter((m) => m.tipo === t); return { t, n: ls.length, valor: ls.reduce((s, m) => s + Number(m.valor_cuenta), 0), q: ls.reduce((s, m) => s + Number(m.valor_ml), 0), conc: ls.filter((m) => m.conciliado).length }; });
      let disp = r.inicial;
      ctx.pDet.innerHTML = `
        <div class="tk-form ta-form bm-form">
          <header class="tk-titulo bm-titulo">
            <div class="tk-titulo-texto"><small>Disponibilidad bancaria · ${esc(empresa())}</small><h2>Disponibilidad ${esc(r.cb.numero)} · ${esc(r.cb.nombre)}</h2></div>
            <div class="tk-marcas">${bajo ? '<span class="pc-marca anulada"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Bajo su saldo mínimo</span>' : '<span class="pc-marca aprobada">Sobre su mínimo</span>'}</div>
            <div class="tk-titulo-acciones">
              <button type="button" class="boton secundario-sm" data-imprimir="resumen"><i class="ti ti-printer" aria-hidden="true"></i> Resumen</button>
              <button type="button" class="boton secundario-sm" data-imprimir="detalle"><i class="ti ti-printer" aria-hidden="true"></i> Detalle</button>
            </div>
          </header>

          <div class="bm-cabecera consulta">
            <section class="bm-banco">
              <div class="bm-banco-id"><span class="bk-cod">${banco?.codigo ?? ''}</span><div><small>Banco</small><b title="${esc(banco?.nombre || '')}">${esc(banco?.nombre || '')}</b></div></div>
              <label class="campo bm-cta"><span>Cuenta bancaria</span><select name="cuenta">${filas.map((x) => `<option value="${x.cb.id}" ${x.cb.id === r.cb.id ? 'selected' : ''}>${esc(x.cb.numero)} · ${esc(x.cb.nombre)}</option>`).join('')}</select></label>
              <div class="bm-periodo"><small>Período</small><b>${esc(fmt.fechaDia(f.desde))} al ${esc(fmt.fechaDia(f.hasta))}</b></div>
            </section>
            <section class="bm-importe">
              <div class="bm-ml bd-final ${bajo ? 'bajo' : ''}"><span>Saldo final (disponible)</span><b>${esc(mon?.simbolo || '')} ${fmt.monto(r.final)}</b></div>
              <div class="bm-ml"><span>Sobre el mínimo</span><b class="${bajo ? 'bd-egreso' : ''}">${fmt.monto(r.final - minimo)}</b></div>
            </section>

            <section class="bm-bloque bm-control">
              <h3 class="ta-col-titulo"><i class="ti ti-building-bank" aria-hidden="true"></i> Bancos de la empresa</h3>
              <dl>
                ${dato('Cuentas', `<b>${filas.length}</b>`)}
                ${dato('Bajo el mínimo', `<b class="${filas.some((x) => x.final < Number(x.cb.saldo_minimo)) ? 'bd-egreso' : ''}">${filas.filter((x) => x.final < Number(x.cb.saldo_minimo)).length}</b>`)}
                ${dato('Moneda', esc(mon?.nombre || ''))}
                ${dato('Disponible total', `<b>Q ${fmt.monto(totalQ)}</b><small>Todas las cuentas, al cambio del día</small>`)}
                ${dato('Saldo mínimo', fmt.monto(minimo))}
                ${dato('Movimientos', r.movs.length)}
              </dl>
            </section>

            <section class="bm-bloque bc-saldos">
              <h3 class="ta-col-titulo"><i class="ti ti-chart-line" aria-hidden="true"></i> Movimiento del período</h3>
              <div class="bk-kpis bc-kpis">
                <div><span>Saldo inicial</span><b>${fmt.monto(r.inicial)}</b><small>Al ${esc(fmt.fechaDia(diaAntes(f.desde)))}</small></div>
                <div><span>Ingresos</span><b class="bd-ingreso">${fmt.monto(r.ingresos)}</b><small>Depósitos y notas de crédito</small></div>
                <div><span>Egresos</span><b class="bd-egreso">${fmt.monto(r.egresos)}</b><small>Notas de débito</small></div>
                <div><span>Variación</span><b>${fmt.monto(r.ingresos - r.egresos)}</b><small>Ingresos − egresos</small></div>
                <div><span>Conciliados</span><b>${r.movs.filter((m) => m.conciliado).length} de ${r.movs.length}</b><small>${r.movs.filter((m) => !m.partida_id).length} sin partida</small></div>
              </div>
            </section>
          </div>

          <section class="bm-pestanas">
            <div class="bm-tabs-barra">
              ${barraPestanas([
                { id: 'MOVIMIENTO', texto: 'Movimiento de la cuenta', icono: 'ti-list-details', n: r.movs.length },
                { id: 'TIPOS', texto: 'Por tipo de documento', icono: 'ti-chart-bar' },
                { id: 'CUENTAS', texto: 'Resumen de cuentas', icono: 'ti-list-search', n: filas.length }
              ], pestana)}
            </div>
            <div class="bm-panel" data-panel="MOVIMIENTO" ${pestana === 'MOVIMIENTO' ? '' : 'hidden'}>
              <div class="pc-lineas"><table>
                <thead><tr><th>No.</th><th>Tipo documento</th><th>Documento</th><th>Fecha</th><th>Cliente / proveedor</th><th class="num">Valor documento</th><th class="num">Disponible</th><th>Aplicado</th><th>Observaciones</th></tr></thead>
                <tbody>
                  <tr class="pp-grupo"><td colspan="6">Saldo inicial</td><td class="num">${fmt.monto(r.inicial)}</td><td colspan="2"></td></tr>
                  ${r.movs.map((m) => { disp += signo(m); return `<tr><td>${m.folio}</td><td>${esc(TIPOS[m.tipo])}</td><td>${esc(m.numero_documento || '')}</td><td>${esc(fmt.fechaDia(m.fecha))}</td><td>${esc(m.tercero_nombre || m.deposito_por || '')}</td>
                    <td class="num ${m.tipo === 'NOTA_DEBITO' ? 'bd-egreso' : 'bd-ingreso'}">${m.tipo === 'NOTA_DEBITO' ? '−' : ''}${fmt.monto(m.valor_cuenta)}</td><td class="num">${fmt.monto(disp)}</td>
                    <td>${m.conciliado ? '<span class="pc-marca aprobada">Conciliado</span>' : m.partida_id ? '<span class="pc-marca pendiente">Contabilizado</span>' : '<span class="tk-tenue">Pendiente</span>'}</td><td class="ta-desc">${esc(m.descripcion || '')}</td></tr>`; }).join('')
                    || '<tr><td colspan="9" class="tk-vacio">Sin movimientos en el rango.</td></tr>'}
                </tbody>
                <tfoot><tr><td colspan="5" class="pc-totales-lbl">Total</td><td class="num">${fmt.monto(r.ingresos - r.egresos)}</td><td class="num">${fmt.monto(r.final)}</td><td colspan="2"></td></tr></tfoot>
              </table></div>
            </div>
            <div class="bm-panel" data-panel="TIPOS" ${pestana === 'TIPOS' ? '' : 'hidden'}>
              <div class="pc-lineas"><table><thead><tr><th>Tipo de documento</th><th class="num">Cantidad</th><th class="num">Valor ${esc(mon?.simbolo || '')}</th><th class="num">Valor Q</th><th class="num">Conciliados</th><th class="num">En circulación</th></tr></thead>
                <tbody>${porTipo.map((x) => `<tr><td>${esc(TIPOS[x.t])}</td><td class="num">${x.n}</td><td class="num ${x.t === 'NOTA_DEBITO' ? 'bd-egreso' : 'bd-ingreso'}">${fmt.monto(x.valor)}</td><td class="num">${fmt.monto(x.q)}</td><td class="num">${x.conc}</td><td class="num">${x.n - x.conc}</td></tr>`).join('')}
                <tr><td class="tk-tenue">Cheques</td><td class="num tk-tenue" colspan="5">Se agregan con el módulo de cheques</td></tr></tbody>
                <tfoot><tr><td class="pc-totales-lbl">Total</td><td class="num">${r.movs.length}</td><td class="num">${fmt.monto(r.ingresos - r.egresos)}</td><td colspan="3"></td></tr></tfoot></table></div>
            </div>
            <div class="bm-panel bm-listado" data-panel="CUENTAS" ${pestana === 'CUENTAS' ? '' : 'hidden'}></div>
          </section>
        </div>`;
      ctx.pDet.querySelector('[data-panel=CUENTAS]').appendChild(ctx.pMae);
    }

    function reporte(modo) {
      const resumen = `<table><thead><tr><th>Cuenta</th><th>Banco</th><th>Moneda</th><th class="n">Saldo inicial</th><th class="n">Ingresos</th><th class="n">Egresos</th><th class="n">Saldo final</th></tr></thead><tbody>${filas.map((r) => `<tr><td>${esc(r.cb.numero)} · ${esc(r.cb.nombre)}</td><td>${esc(ctx.banco(r.cb.banco_id)?.nombre || '')}</td><td>${esc(ctx.moneda(r.cb.moneda_id)?.nombre || '')}</td><td class="n">${fmt.monto(r.inicial)}</td><td class="n">${fmt.monto(r.ingresos)}</td><td class="n">${fmt.monto(r.egresos)}</td><td class="n">${fmt.monto(r.final)}</td></tr>`).join('')}</tbody></table>`;
      const detalle = modo === 'detalle' ? filas.map((r) => { let d = r.inicial; return `<h3>${esc(r.cb.numero)} · ${esc(r.cb.nombre)}</h3><table><thead><tr><th>No.</th><th>Tipo</th><th>Documento</th><th>Fecha</th><th class="n">Valor</th><th class="n">Disponible</th></tr></thead><tbody><tr class="s"><td colspan="5">Saldo inicial</td><td class="n">${fmt.monto(r.inicial)}</td></tr>${r.movs.map((m) => { d += signo(m); return `<tr><td>${m.folio}</td><td>${esc(TIPOS[m.tipo])}</td><td>${esc(m.numero_documento || '')}</td><td>${esc(fmt.fechaDia(m.fecha))}</td><td class="n">${m.tipo === 'NOTA_DEBITO' ? '−' : ''}${fmt.monto(m.valor_cuenta)}</td><td class="n">${fmt.monto(d)}</td></tr>`; }).join('')}</tbody></table>`; }).join('') : '';
      imprimir('Disponibilidad bancaria', `<h1>Disponibilidad bancaria</h1><h2>${esc(empresa())} · movimiento y disponibilidad de bancos · ${esc(fmt.fechaDia(f.desde))} al ${esc(fmt.fechaDia(f.hasta))}</h2>${resumen}${detalle}`);
    }

    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { actual = null; cuentas = await ctx.cuentasBancarias(); pintarFiltros(); return consultar(); }
      if (cambio === 'otro') {
        f[e.target.name] = e.target.value;
        if (f.desde && f.hasta && f.hasta < f.desde) { if (e.target.name === 'desde') f.hasta = f.desde; else f.desde = f.hasta; }
        pintarFiltros();
        return consultar();
      }
      if (e.target.matches('.bm-form [name=cuenta]')) { actual = filas.find((r) => String(r.cb.id) === e.target.value); pintarMaestro(); pintarDetalle(); }
    });
    cont.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-pestana]');
      if (tab) { pestana = tab.dataset.pestana; return activarPestana(ctx.pDet, pestana); }
      const im = e.target.closest('[data-imprimir]');
      if (im) return reporte(im.dataset.imprimir);
      const tr = e.target.closest('tr[data-cuenta]');
      if (tr) { actual = filas.find((r) => String(r.cb.id) === tr.dataset.cuenta); pestana = 'MOVIMIENTO'; pintarMaestro(); pintarDetalle(); }
    });

    iniciar();
  };

  // ===================== Disponibilidad integrada =====================
  window.PANTALLAS['disponibilidad-integrada'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Disponibilidad integrada', icono: 'ti-chart-pie', clase: 'bk-movimientos bk-integ' });
    const { sb } = ctx;
    const f = { hasta: fmt.hoy() };
    let filas = [];         // { cb, loc, saldo, saldoQ, minimo, cambio }
    let pestana = 'CUENTAS';

    const org = () => ctx.organizaciones.find((o) => o.id === ctx.sel.org);

    function pintarFiltros() {
      ctx.filtros(`<label class="campo"><span>Saldos al</span><input type="date" name="hasta" value="${f.hasta}"></label>`);
      // Se consolidan todas las localidades de la organización de la empresa elegida.
      const loc = ctx.pFil.querySelector('[name=loc]');
      if (loc) loc.closest('.campo').querySelector('span').textContent = 'Empresa (se consolida su organización)';
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      pintarFiltros();
      await consultar();
    }

    async function consultar() {
      const locs = ctx.localidades.filter((l) => l.organizacion_id === ctx.sel.org);
      const { data } = locs.length ? await sb.from('cuentas_bancarias').select('*').in('localidad_id', locs.map((l) => l.id)).eq('activo', true).order('localidad_id').order('banco_id') : { data: [] };
      filas = await Promise.all((data || []).map(async (cb) => {
        const { data: s } = await sb.rpc('saldo_cuenta_bancaria', { p_cuenta: cb.id, p_hasta: f.hasta });
        const cambio = ctx.moneda(cb.moneda_id)?.cambio || 1;
        const saldo = Number(s || 0);
        return { cb, loc: ctx.localidad(cb.localidad_id), saldo, saldoQ: fmt.redondear(saldo * cambio), minimo: Number(cb.saldo_minimo), minimoQ: fmt.redondear(Number(cb.saldo_minimo) * cambio), cambio };
      }));
      pintar();
    }

    function agrupar(clave) {
      const g = {};
      filas.forEach((r) => { const k = clave(r); g[k] = g[k] || { n: 0, q: 0, bajo: 0 }; g[k].n++; g[k].q += r.saldoQ; if (r.saldo < r.minimo) g[k].bajo++; });
      return Object.entries(g).sort((a, b) => b[1].q - a[1].q);
    }

    function pintar() {
      const o = org();
      const totalQ = filas.reduce((s, r) => s + r.saldoQ, 0);
      const minimoQ = filas.reduce((s, r) => s + r.minimoQ, 0);
      const porMoneda = {};
      filas.forEach((r) => { const m = ctx.moneda(r.cb.moneda_id); const k = m?.nombre || '—'; porMoneda[k] = porMoneda[k] || { simbolo: m?.simbolo || '', saldo: 0, q: 0, n: 0 }; porMoneda[k].saldo += r.saldo; porMoneda[k].q += r.saldoQ; porMoneda[k].n++; });
      const porLoc = agrupar((r) => r.loc ? `${r.loc.codigo} · ${r.loc.nombre_comercial}` : '—');
      const porBanco = agrupar((r) => ctx.banco(r.cb.banco_id)?.nombre || '—');
      const bajo = filas.filter((r) => r.saldo < r.minimo);
      const max = Math.max(1, ...porLoc.map(([, x]) => Math.abs(x.q)));
      const locs = new Set(filas.map((r) => r.cb.localidad_id)).size;
      ctx.pMae.remove();   // la integrada no tiene maestro: todo va en las pestañas
      ctx.pDet.innerHTML = `
        <div class="tk-form ta-form bm-form">
          <header class="tk-titulo bm-titulo">
            <div class="tk-titulo-texto"><small>Disponibilidad integrada · ${esc(o ? `${o.codigo} · ${o.nombre}` : '')}</small><h2>Disponibilidad al ${esc(fmt.fechaDia(f.hasta))}</h2></div>
            <div class="tk-marcas">${bajo.length ? `<span class="pc-marca anulada"><i class="ti ti-alert-triangle" aria-hidden="true"></i> ${bajo.length} bajo su mínimo</span>` : '<span class="pc-marca aprobada">Todas sobre su mínimo</span>'}</div>
            <div class="tk-titulo-acciones"><button type="button" class="boton secundario-sm" data-imprimir><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button></div>
          </header>

          <div class="bm-cabecera consulta">
            <section class="bm-banco">
              <div class="bm-banco-id"><span class="bk-cod">${o?.codigo ?? ''}</span><div><small>Organización</small><b title="${esc(o?.nombre || '')}">${esc(o?.nombre || '')}</b></div></div>
              <div class="bm-periodo"><small>Localidades con bancos</small><b>${locs}</b></div>
              <div class="bm-periodo"><small>Cuentas activas</small><b>${filas.length}</b></div>
            </section>
            <section class="bm-importe">
              <div class="bm-ml bd-final"><span>Disponible total</span><b>Q ${fmt.monto(totalQ)}</b></div>
              <div class="bm-ml"><span>Sobre los mínimos</span><b class="${totalQ < minimoQ ? 'bd-egreso' : ''}">Q ${fmt.monto(totalQ - minimoQ)}</b></div>
            </section>

            <section class="bm-bloque bm-control">
              <h3 class="ta-col-titulo"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Alertas</h3>
              <dl>
                ${dato('Bajo el mínimo', `<b class="${bajo.length ? 'bd-egreso' : ''}">${bajo.length}</b>`)}
                ${dato('Monedas', Object.keys(porMoneda).length)}
                ${dato('Bancos', porBanco.length)}
                ${dato('Mayor saldo', porLoc[0] ? `${esc(porLoc[0][0])}<small>Q ${fmt.monto(porLoc[0][1].q)}</small>` : '')}
                ${dato('Cuentas bajo el mínimo', bajo.length ? esc(bajo.map((r) => r.cb.numero).join(', ')) : 'Ninguna')}
              </dl>
            </section>

            <section class="bm-bloque bc-saldos">
              <h3 class="ta-col-titulo"><i class="ti ti-coins" aria-hidden="true"></i> Saldos por moneda</h3>
              <div class="bk-kpis bc-kpis">
                ${Object.entries(porMoneda).map(([n, x]) => `<div><span>${esc(n)} · ${x.n} cuenta${x.n === 1 ? '' : 's'}</span><b>${esc(x.simbolo)} ${fmt.monto(x.saldo)}</b><small>Q ${fmt.monto(x.q)}</small></div>`).join('') || '<div><span>Sin cuentas</span><b>—</b><small>La organización no tiene cuentas bancarias</small></div>'}
              </div>
            </section>
          </div>

          <section class="bm-pestanas">
            <div class="bm-tabs-barra">
              ${barraPestanas([
                { id: 'CUENTAS', texto: 'Cuentas bancarias', icono: 'ti-table', n: filas.length },
                { id: 'LOCALIDADES', texto: 'Por localidad', icono: 'ti-building', n: porLoc.length },
                { id: 'BANCOS', texto: 'Por banco', icono: 'ti-building-bank', n: porBanco.length }
              ], pestana)}
            </div>
            <div class="bm-panel" data-panel="CUENTAS" ${pestana === 'CUENTAS' ? '' : 'hidden'}>
              <div class="pc-lineas"><table>
                <thead><tr><th>Localidad</th><th>Banco</th><th>Cuenta</th><th>Nombre</th><th>Moneda</th><th class="num">Saldo</th><th class="num">Cambio</th><th class="num">Saldo Q</th><th class="num">Saldo mínimo</th><th class="num">Disponible sobre el mínimo</th></tr></thead>
                <tbody>${filas.map((r) => `<tr><td>${esc(r.loc?.codigo || '')}</td><td>${esc(ctx.banco(r.cb.banco_id)?.nombre || '')}</td><td class="fuerte">${esc(r.cb.numero)}</td><td>${esc(r.cb.nombre)}</td><td>${esc(ctx.moneda(r.cb.moneda_id)?.nombre || '')}</td>
                  <td class="num">${esc(ctx.moneda(r.cb.moneda_id)?.simbolo || '')} ${fmt.monto(r.saldo)}</td><td class="num">${r.cambio}</td><td class="num fuerte">${fmt.monto(r.saldoQ)}</td><td class="num">${fmt.monto(r.minimo)}</td>
                  <td class="num ${r.saldo < r.minimo ? 'pc-rojo' : 'bd-ingreso'}">${fmt.monto(r.saldo - r.minimo)}</td></tr>`).join('') || '<tr><td colspan="10" class="tk-vacio">Sin cuentas bancarias.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="7" class="pc-totales-lbl">Total en quetzales</td><td class="num">${fmt.monto(totalQ)}</td><td colspan="2"></td></tr></tfoot>
              </table></div>
            </div>
            <div class="bm-panel" data-panel="LOCALIDADES" ${pestana === 'LOCALIDADES' ? '' : 'hidden'}>
              <div class="bi-localidades">${porLoc.map(([n, x]) => `<div class="bi-barra"><span>${esc(n)} <small class="tk-tenue">· ${x.n} cuenta${x.n === 1 ? '' : 's'}${x.bajo ? ` · ${x.bajo} bajo el mínimo` : ''}</small></span><i style="width:${Math.max(2, Math.abs(x.q) / max * 100)}%" class="${x.q < 0 ? 'neg' : ''}"></i><b>Q ${fmt.monto(x.q)}</b></div>`).join('') || '<p class="tk-tenue">Sin cuentas bancarias en la organización.</p>'}</div>
            </div>
            <div class="bm-panel" data-panel="BANCOS" ${pestana === 'BANCOS' ? '' : 'hidden'}>
              <div class="pc-lineas"><table><thead><tr><th>Banco</th><th class="num">Cuentas</th><th class="num">Bajo el mínimo</th><th class="num">Saldo Q</th><th class="num">Participación</th></tr></thead>
                <tbody>${porBanco.map(([n, x]) => `<tr><td class="fuerte">${esc(n)}</td><td class="num">${x.n}</td><td class="num ${x.bajo ? 'pc-rojo' : ''}">${x.bajo}</td><td class="num">${fmt.monto(x.q)}</td><td class="num">${totalQ ? fmt.monto(x.q / totalQ * 100) : '0.00'} %</td></tr>`).join('') || '<tr><td colspan="5" class="tk-vacio">Sin cuentas bancarias.</td></tr>'}</tbody>
                <tfoot><tr><td class="pc-totales-lbl">Total</td><td class="num">${filas.length}</td><td class="num">${bajo.length}</td><td class="num">${fmt.monto(totalQ)}</td><td class="num">100.00 %</td></tr></tfoot></table></div>
            </div>
          </section>
        </div>`;
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { pintarFiltros(); return consultar(); }
      if (cambio === 'otro') { f.hasta = e.target.value || fmt.hoy(); return consultar(); }
    });
    cont.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-pestana]');
      if (tab) { pestana = tab.dataset.pestana; return activarPestana(ctx.pDet, pestana); }
      if (!e.target.closest('[data-imprimir]')) return;
      const totalQ = filas.reduce((s, r) => s + r.saldoQ, 0);
      imprimir('Disponibilidad integrada', `<h1>Disponibilidad integrada</h1><h2>${esc(org()?.nombre || '')} · saldos al ${esc(fmt.fechaDia(f.hasta))}</h2>
        <table><thead><tr><th>Localidad</th><th>Banco</th><th>Cuenta</th><th>Moneda</th><th class="n">Saldo</th><th class="n">Cambio</th><th class="n">Saldo Q</th><th class="n">Mínimo</th></tr></thead><tbody>${filas.map((r) => `<tr><td>${esc(r.loc?.codigo || '')}</td><td>${esc(ctx.banco(r.cb.banco_id)?.nombre || '')}</td><td>${esc(r.cb.numero)} · ${esc(r.cb.nombre)}</td><td>${esc(ctx.moneda(r.cb.moneda_id)?.nombre || '')}</td><td class="n">${fmt.monto(r.saldo)}</td><td class="n">${r.cambio}</td><td class="n">${fmt.monto(r.saldoQ)}</td><td class="n">${fmt.monto(r.minimo)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="6">Total en quetzales</td><td class="n">${fmt.monto(totalQ)}</td><td></td></tr></tfoot></table>`);
    });

    iniciar();
  };
})();
