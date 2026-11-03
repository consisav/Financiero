// Registros · Bancos · Disponibilidad bancaria y Disponibilidad integrada.
//   Disponibilidad bancaria (localidad): por cuenta bancaria, saldo inicial, ingresos (depósitos
//   y notas de crédito), egresos (notas de débito) y saldo final en un rango de fechas; abajo, el
//   movimiento de la cuenta elegida con su disponible acumulado.
//   Disponibilidad integrada (organización): todas las cuentas de todas las localidades a una
//   fecha, en su moneda y en quetzales, con su saldo mínimo, el disponible sobre el mínimo y los
//   totales por moneda y por localidad.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  const TIPOS = { DEPOSITO: 'Depósito', NOTA_CREDITO: 'Nota de crédito', NOTA_DEBITO: 'Nota de débito' };
  const signo = (m) => m.tipo === 'NOTA_DEBITO' ? -Number(m.valor_cuenta) : Number(m.valor_cuenta);
  const diaAntes = (d) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };

  window.PANTALLAS = window.PANTALLAS || {};

  // ===================== Disponibilidad bancaria =====================
  window.PANTALLAS['disponibilidad-bancaria'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Disponibilidad bancaria', icono: 'ti-chart-line', clase: 'bk-disponibilidad' });
    const { sb } = ctx;
    const [a0, m0] = fmt.hoy().split('-');
    const f = { cuenta: '', desde: `${a0}-${m0}-01`, hasta: fmt.hoy() };
    let cuentas = [];
    let filas = [];         // { cb, inicial, ingresos, egresos, final, movs }
    let actual = null;

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Cuenta bancaria</span><select name="cuenta"><option value="">Todas</option>${cuentas.map((c) => `<option value="${c.id}" ${String(f.cuenta) === String(c.id) ? 'selected' : ''}>${esc(ctx.nombreCuentaBancaria(c))}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>`,
      `<button type="button" class="boton secundario-sm" data-imprimir="resumen"><i class="ti ti-printer" aria-hidden="true"></i> Resumen</button><button type="button" class="boton secundario-sm" data-imprimir="detalle"><i class="ti ti-printer" aria-hidden="true"></i> Detalle</button>`);
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      cuentas = await ctx.cuentasBancarias();
      pintarFiltros();
      await consultar();
    }

    async function consultar() {
      const lista = cuentas.filter((c) => !f.cuenta || String(c.id) === String(f.cuenta));
      filas = await Promise.all(lista.map(async (cb) => {
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
      if (!actual || !filas.some((r) => r.cb.id === actual.cb.id)) actual = filas[0] || null;
      else actual = filas.find((r) => r.cb.id === actual.cb.id);
      pintarMaestro();
      pintarDetalle();
    }

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
                || '<tr><td colspan="9" class="tk-vacio"><i class="ti ti-building-bank" aria-hidden="true"></i>La localidad no tiene cuentas bancarias.</td></tr>'}
            </tbody>
          </table>
        </div>`;
    }

    function pintarDetalle() {
      const r = actual;
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la organización y la localidad.'); return; }
      if (!r) { ctx.pDet.innerHTML = ctx.vacio('La localidad no tiene cuentas bancarias.'); return; }
      let disp = r.inicial;
      ctx.pDet.innerHTML = `
        <div class="tk-form ta-form">
          <header class="tk-titulo">
            <span class="tk-icono"><i class="ti ti-chart-line" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>${esc(ctx.banco(r.cb.banco_id)?.nombre || '')} · ${esc(ctx.moneda(r.cb.moneda_id)?.nombre || '')}</small><h2>Movimiento ${esc(r.cb.numero)} · ${esc(r.cb.nombre)}</h2></div>
          </header>
          <div class="ts-tiempos bd-saldos">
            <div><span>Saldo inicial</span><b>${fmt.monto(r.inicial)}</b><small>Al ${esc(fmt.fechaDia(diaAntes(f.desde)))}</small></div>
            <div><span>Ingresos</span><b class="bd-ingreso">${fmt.monto(r.ingresos)}</b><small>Depósitos y notas de crédito</small></div>
            <div><span>Egresos</span><b class="bd-egreso">${fmt.monto(r.egresos)}</b><small>Notas de débito</small></div>
            <div class="${r.final < Number(r.cb.saldo_minimo) ? 'ts-alerta' : ''}"><span>Saldo final (disponible)</span><b>${fmt.monto(r.final)}</b><small>Mínimo ${fmt.monto(r.cb.saldo_minimo)}</small></div>
          </div>
          <div class="pc-lineas bd-movs">
            <table>
              <thead><tr><th>No.</th><th>Tipo documento</th><th>Documento</th><th>Fecha</th><th class="num">Valor documento</th><th class="num">Disponible</th><th>Aplicado</th><th>Observaciones</th></tr></thead>
              <tbody>
                <tr class="pp-grupo"><td colspan="5">Saldo inicial</td><td class="num">${fmt.monto(r.inicial)}</td><td colspan="2"></td></tr>
                ${r.movs.map((m) => { disp += signo(m); return `<tr><td>${m.folio}</td><td>${esc(TIPOS[m.tipo])}</td><td>${esc(m.numero_documento || '')}</td><td>${esc(fmt.fechaDia(m.fecha))}</td>
                  <td class="num ${m.tipo === 'NOTA_DEBITO' ? 'bd-egreso' : 'bd-ingreso'}">${m.tipo === 'NOTA_DEBITO' ? '−' : ''}${fmt.monto(m.valor_cuenta)}</td><td class="num">${fmt.monto(disp)}</td>
                  <td>${m.conciliado ? '<span class="pc-marca aprobada">Conciliado</span>' : m.partida_id ? '<span class="pc-marca pendiente">Contabilizado</span>' : '<span class="tk-tenue">Pendiente</span>'}</td><td class="ta-desc">${esc(m.descripcion || m.tercero_nombre || '')}</td></tr>`; }).join('')
                  || '<tr><td colspan="8" class="tk-vacio">Sin movimientos en el rango.</td></tr>'}
              </tbody>
              <tfoot><tr><td colspan="4" class="pc-totales-lbl">Total</td><td class="num">${fmt.monto(r.ingresos - r.egresos)}</td><td class="num">${fmt.monto(r.final)}</td><td colspan="2"></td></tr></tfoot>
            </table>
          </div>
        </div>`;
    }

    function reporte(modo) {
      const loc = ctx.localidad(ctx.sel.loc);
      const resumen = `<table><thead><tr><th>Cuenta</th><th>Banco</th><th>Moneda</th><th class="n">Saldo inicial</th><th class="n">Ingresos</th><th class="n">Egresos</th><th class="n">Saldo final</th></tr></thead><tbody>${filas.map((r) => `<tr><td>${esc(r.cb.numero)} · ${esc(r.cb.nombre)}</td><td>${esc(ctx.banco(r.cb.banco_id)?.nombre || '')}</td><td>${esc(ctx.moneda(r.cb.moneda_id)?.nombre || '')}</td><td class="n">${fmt.monto(r.inicial)}</td><td class="n">${fmt.monto(r.ingresos)}</td><td class="n">${fmt.monto(r.egresos)}</td><td class="n">${fmt.monto(r.final)}</td></tr>`).join('')}</tbody></table>`;
      const detalle = modo === 'detalle' ? filas.map((r) => { let d = r.inicial; return `<h3>${esc(r.cb.numero)} · ${esc(r.cb.nombre)}</h3><table><thead><tr><th>No.</th><th>Tipo</th><th>Documento</th><th>Fecha</th><th class="n">Valor</th><th class="n">Disponible</th></tr></thead><tbody><tr class="s"><td colspan="5">Saldo inicial</td><td class="n">${fmt.monto(r.inicial)}</td></tr>${r.movs.map((m) => { d += signo(m); return `<tr><td>${m.folio}</td><td>${esc(TIPOS[m.tipo])}</td><td>${esc(m.numero_documento || '')}</td><td>${esc(fmt.fechaDia(m.fecha))}</td><td class="n">${m.tipo === 'NOTA_DEBITO' ? '−' : ''}${fmt.monto(m.valor_cuenta)}</td><td class="n">${fmt.monto(d)}</td></tr>`; }).join('')}</tbody></table>`; }).join('') : '';
      imprimir('Disponibilidad bancaria', `<h1>${esc(loc ? `${loc.codigo} ${loc.nombre_comercial}` : '')}</h1><h2>Movimiento y disponibilidad de bancos · ${esc(fmt.fechaDia(f.desde))} al ${esc(fmt.fechaDia(f.hasta))}</h2>${resumen}${detalle}`);
    }

    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { f.cuenta = ''; actual = null; cuentas = await ctx.cuentasBancarias(); pintarFiltros(); return consultar(); }
      if (cambio === 'otro') {
        f[e.target.name] = e.target.value;
        if (f.desde && f.hasta && f.hasta < f.desde) { if (e.target.name === 'desde') f.hasta = f.desde; else f.desde = f.hasta; }
        pintarFiltros();
        return consultar();
      }
    });
    cont.addEventListener('click', (e) => {
      const im = e.target.closest('[data-imprimir]');
      if (im) return reporte(im.dataset.imprimir);
      const tr = e.target.closest('tr[data-cuenta]');
      if (tr) { actual = filas.find((r) => String(r.cb.id) === tr.dataset.cuenta); pintarMaestro(); pintarDetalle(); }
    });

    iniciar();
  };

  // ===================== Disponibilidad integrada =====================
  window.PANTALLAS['disponibilidad-integrada'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Disponibilidad integrada', icono: 'ti-chart-pie', clase: 'bk-integrada' });
    const { sb } = ctx;
    const f = { hasta: fmt.hoy() };
    let filas = [];         // { cb, loc, saldo, saldoQ, minimo, cambio }

    function pintarFiltros() {
      // En la integrada la localidad no filtra: se consolidan todas las de la organización.
      ctx.filtros(`<label class="campo"><span>Saldos al</span><input type="date" name="hasta" value="${f.hasta}"></label>`,
        '<button type="button" class="boton secundario-sm" data-imprimir><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>');
      const loc = ctx.pFil.querySelector('[name=loc]');
      if (loc) { loc.closest('.campo').querySelector('span').textContent = 'Localidad (todas se consolidan)'; loc.disabled = true; }
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
        return { cb, loc: ctx.localidad(cb.localidad_id), saldo, saldoQ: fmt.redondear(saldo * cambio), minimo: Number(cb.saldo_minimo), cambio };
      }));
      pintar();
    }

    function pintar() {
      const totalQ = filas.reduce((s, r) => s + r.saldoQ, 0);
      const porMoneda = {};
      filas.forEach((r) => { const m = ctx.moneda(r.cb.moneda_id); const k = m?.nombre || '—'; porMoneda[k] = porMoneda[k] || { simbolo: m?.simbolo || '', saldo: 0, q: 0 }; porMoneda[k].saldo += r.saldo; porMoneda[k].q += r.saldoQ; });
      const porLoc = {};
      filas.forEach((r) => { const k = r.loc ? `${r.loc.codigo} · ${r.loc.nombre_comercial}` : '—'; porLoc[k] = (porLoc[k] || 0) + r.saldoQ; });
      const bajo = filas.filter((r) => r.saldo < r.minimo);
      const max = Math.max(1, ...Object.values(porLoc).map(Math.abs));
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab tg-cab"><h2>Disponibilidad consolidada <small>${esc(ctx.organizaciones.find((o) => o.id === ctx.sel.org)?.nombre || '')} · al ${esc(fmt.fechaDia(f.hasta))}</small></h2></header>
        <div class="bi-resumen">
          <div class="bi-total"><span>Disponible total</span><b>Q ${fmt.monto(totalQ)}</b><small>${filas.length} cuentas activas</small></div>
          ${Object.entries(porMoneda).map(([n, x]) => `<div><span>${esc(n)}</span><b>${esc(x.simbolo)} ${fmt.monto(x.saldo)}</b><small>Q ${fmt.monto(x.q)}</small></div>`).join('')}
          <div class="${bajo.length ? 'ts-alerta' : ''}"><span>Bajo su saldo mínimo</span><b>${bajo.length}</b><small>${bajo.length ? esc(bajo.map((r) => r.cb.numero).join(', ')) : 'Todas en su mínimo'}</small></div>
        </div>
        <div class="bi-localidades">${Object.entries(porLoc).map(([n, q]) => `<div class="bi-barra"><span>${esc(n)}</span><i style="width:${Math.max(2, Math.abs(q) / max * 100)}%" class="${q < 0 ? 'neg' : ''}"></i><b>Q ${fmt.monto(q)}</b></div>`).join('') || '<p class="tk-tenue">Sin cuentas bancarias en la organización.</p>'}</div>`;
      ctx.pDet.innerHTML = `
        <div class="tk-form ta-form">
          <h3 class="ta-col-titulo"><i class="ti ti-table" aria-hidden="true"></i> Cuentas bancarias de la organización</h3>
          <div class="pc-lineas">
            <table>
              <thead><tr><th>Localidad</th><th>Banco</th><th>Cuenta</th><th>Nombre</th><th>Moneda</th><th class="num">Saldo</th><th class="num">Cambio</th><th class="num">Saldo Q</th><th class="num">Saldo mínimo</th><th class="num">Disponible sobre el mínimo</th></tr></thead>
              <tbody>${filas.map((r) => `<tr><td>${esc(r.loc?.codigo || '')}</td><td>${esc(ctx.banco(r.cb.banco_id)?.nombre || '')}</td><td class="fuerte">${esc(r.cb.numero)}</td><td>${esc(r.cb.nombre)}</td><td>${esc(ctx.moneda(r.cb.moneda_id)?.nombre || '')}</td>
                <td class="num">${esc(ctx.moneda(r.cb.moneda_id)?.simbolo || '')} ${fmt.monto(r.saldo)}</td><td class="num">${r.cambio}</td><td class="num fuerte">${fmt.monto(r.saldoQ)}</td><td class="num">${fmt.monto(r.minimo)}</td>
                <td class="num ${r.saldo < r.minimo ? 'pc-rojo' : 'bd-ingreso'}">${fmt.monto(r.saldo - r.minimo)}</td></tr>`).join('') || '<tr><td colspan="10" class="tk-vacio">Sin cuentas bancarias.</td></tr>'}</tbody>
              <tfoot><tr><td colspan="7" class="pc-totales-lbl">Total en quetzales</td><td class="num">${fmt.monto(totalQ)}</td><td colspan="2"></td></tr></tfoot>
            </table>
          </div>
        </div>`;
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org') { pintarFiltros(); return consultar(); }
      if (cambio === 'otro') { f.hasta = e.target.value || fmt.hoy(); return consultar(); }
    });
    cont.addEventListener('click', (e) => {
      if (!e.target.closest('[data-imprimir]')) return;
      const totalQ = filas.reduce((s, r) => s + r.saldoQ, 0);
      imprimir('Disponibilidad integrada', `<h1>${esc(ctx.organizaciones.find((o) => o.id === ctx.sel.org)?.nombre || '')}</h1><h2>Disponibilidad integrada al ${esc(fmt.fechaDia(f.hasta))}</h2>
        <table><thead><tr><th>Localidad</th><th>Banco</th><th>Cuenta</th><th>Moneda</th><th class="n">Saldo</th><th class="n">Cambio</th><th class="n">Saldo Q</th><th class="n">Mínimo</th></tr></thead><tbody>${filas.map((r) => `<tr><td>${esc(r.loc?.codigo || '')}</td><td>${esc(ctx.banco(r.cb.banco_id)?.nombre || '')}</td><td>${esc(r.cb.numero)} · ${esc(r.cb.nombre)}</td><td>${esc(ctx.moneda(r.cb.moneda_id)?.nombre || '')}</td><td class="n">${fmt.monto(r.saldo)}</td><td class="n">${r.cambio}</td><td class="n">${fmt.monto(r.saldoQ)}</td><td class="n">${fmt.monto(r.minimo)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="6">Total en quetzales</td><td class="n">${fmt.monto(totalQ)}</td><td></td></tr></tfoot></table>`);
    });

    iniciar();
  };
})();
