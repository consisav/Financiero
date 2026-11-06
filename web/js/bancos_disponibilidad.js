// Caja y Bancos · Bancos · Disponibilidad integrada (la Disponibilidad bancaria pasó a disponibilidad.js), con el diseño de
// los depósitos (encabezado en tarjetas y pestañas). Son consultas: no se modifican.
//   Disponibilidad bancaria (empresa): la cuenta elegida con su saldo inicial, ingresos (depósitos
//   y notas de crédito), egresos (notas de débito y cheques) y saldo final en un rango de fechas; pestañas
//   con su movimiento y disponible acumulado, el resumen de todas las cuentas y los totales por
//   tipo de documento.
//   Disponibilidad integrada (organización de la empresa elegida): todas las cuentas de todas sus
//   localidades a una fecha, en su moneda y en quetzales, con su saldo mínimo; pestañas por cuenta,
//   por localidad y por banco.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir, pestanas: barraPestanas, activarPestana } = window.BANCOS;
  const TIPOS = { DEPOSITO: 'Depósito', NOTA_CREDITO: 'Nota de crédito', NOTA_DEBITO: 'Nota de débito', CHEQUE: 'Cheque' };
  const esEgreso = (t) => t === 'NOTA_DEBITO' || t === 'CHEQUE';
  const signo = (m) => esEgreso(m.tipo) ? -Number(m.valor_cuenta) : Number(m.valor_cuenta);
  const diaAntes = (d) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };
  const dato = (etq, val) => `<div class="bm-dato"><dt>${etq}</dt><dd>${val === '' || val == null ? '<span class="tk-tenue">—</span>' : val}</dd></div>`;

  window.PANTALLAS = window.PANTALLAS || {};

  // La Disponibilidad bancaria (proceso con histórico) está en disponibilidad.js.

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
