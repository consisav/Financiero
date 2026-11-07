// Caja y Bancos · Cheques · Generación cheques y Generación transferencias: pago automático de las
// facturas y recibos de compra pendientes (Facturas de compra por pagar).
//   Arriba: las compras con saldo pendiente (factura, compra, proveedor, transacción, fecha de
//   ingreso, valor total, bonificaciones, pendiente de liquidar, cuenta bancaria y el cheque o la
//   cuenta del proveedor), con su casilla «Generar» y el resumen de lo marcado.
//   Abajo: la compra elegida (transacción, notas de crédito, descuentos ND, proveedor, usuario y su
//   detalle contable) y el panel de generación: cuenta bancaria, fecha, transacción, uno por
//   proveedor o por factura, partida contable y los mensajes del proceso.
//   Los cheques toman el número de la chequera; las transferencias son notas de débito con la
//   referencia del lote, que se descarga para el banco.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;

  const CONFIG = {
    'generacion-cheques': {
      forma: 'CHEQUE', titulo: 'Generación de cheques por facturas', icono: 'ti-files', clase: 'bg-cheques',
      pago: 'cheque', pagos: 'cheques', Pago: 'Cheque', boton: 'Generar cheques', botonIcono: 'ti-writing',
      fecha: 'Fecha del cheque', ver: '#/caja-bancos/emision-de-cheques', verTexto: 'Abrir Emisión de cheques'
    },
    'generacion-transferencias': {
      forma: 'TRANSFERENCIA', titulo: 'Generación de transferencias por facturas', icono: 'ti-arrows-exchange', clase: 'bg-transferencias',
      pago: 'transferencia', pagos: 'transferencias', Pago: 'Transferencia', boton: 'Generar transferencias', botonIcono: 'ti-send',
      fecha: 'Fecha de la transferencia', ver: '#/caja-bancos/notas-debito', verTexto: 'Abrir Notas de débito'
    }
  };

  function pantalla(clave) {
    return function (cont) {
      const cfg = CONFIG[clave];
      const ctx = montar(cont, { titulo: cfg.titulo, icono: cfg.icono, clase: `bk-movimientos bk-generacion ${cfg.clase}`, grupo: 'Cheques' });
      const { sb, yo } = ctx;
      const f = { proveedor: '', documento: '', desde: '', hasta: '', forma: cfg.forma };
      const DOCUMENTOS = [['', 'Ambos'], ['FACTURA', 'Facturas'], ['RECIBO', 'Recibos']];
      const p = { cuenta: null, fecha: fmt.hoy(), transaccion: '', descripcion: '', agrupar: true, partida: true, referencia: '', cambio: '' };
      let compras = [];
      let cuentas = [];
      let transacciones = [];
      let contables = [];
      const marcadas = new Set();
      let actual = null;
      let lineas = [];
      let saldo = null;
      let mensajes = [];
      let generados = [];
      let trabajando = false;

      const cuentaPago = () => cuentas.find((c) => c.id === p.cuenta) || null;
      const iso = (id) => ctx.moneda(id)?.iso || 'GTQ';
      const simbolo = (id) => ctx.moneda(id)?.simbolo || 'Q';
      const docTxt = (c) => `${c.tipo_documento === 'RECIBO' ? 'REC' : 'FAC'} ${c.serie ? `${c.serie}-` : ''}${c.documento}`;
      const banco = (id) => ctx.banco(id);
      const contable = (id) => contables.find((x) => x.id === id);

      // Valor del pago de una compra en la moneda de la cuenta (null si no se puede pagar desde ella).
      function enCuenta(c, cb = cuentaPago()) {
        if (!cb) return Number(c.pendiente);
        if (c.moneda_id === cb.moneda_id) return Number(c.pendiente);
        if (iso(cb.moneda_id) === 'GTQ') return fmt.redondear(Number(c.pendiente) * Number(c.tipo_cambio));
        return null;
      }
      // Motivo por el que una compra no se puede marcar.
      function bloqueo(c) {
        if (enCuenta(c) === null) return `Es en ${ctx.moneda(c.moneda_id)?.nombre || 'otra moneda'}: págala desde una cuenta en quetzales o en su moneda`;
        if (cfg.forma === 'TRANSFERENCIA' && !c.cuenta_destino) return 'Sin la cuenta bancaria del proveedor: regístrala en Facturas de compra por pagar';
        return '';
      }

      // Pagos que se generarán con lo marcado, en el orden en que los numera el proceso.
      function grupos() {
        const elegidas = compras.filter((c) => marcadas.has(c.id));
        const mapa = new Map();
        elegidas.forEach((c) => {
          const k = p.agrupar ? `${(c.proveedor_codigo || c.proveedor_nombre).toUpperCase()}|${c.beneficiario}|${c.cuenta_destino || ''}` : String(c.id);
          if (!mapa.has(k)) mapa.set(k, { clave: k, proveedor: c.proveedor_nombre, beneficiario: c.beneficiario, banco: c.banco_destino_id, destino: c.cuenta_destino, compras: [], valor: 0 });
          const g = mapa.get(k);
          g.compras.push(c);
          g.valor = fmt.redondear(g.valor + (enCuenta(c) || 0));
        });
        return [...mapa.values()].sort((a, b) => a.proveedor.localeCompare(b.proveedor, 'es') || (a.clave < b.clave ? -1 : 1));
      }
      function chequera(cb = cuentaPago()) {
        if (!cb || cb.cheque_inicial == null || cb.cheque_final == null) return null;
        const siguiente = Number(cb.cheque_inicial) + Number(cb.cheques_utilizados || 0);
        return { siguiente, disponibles: Math.max(0, Number(cb.cheque_final) - siguiente + 1) };
      }
      // Número propuesto de cada compra marcada (cheque) o «Lote» (transferencia).
      function propuestos() {
        const m = new Map();
        const ch = chequera();
        grupos().forEach((g, i) => g.compras.forEach((c) => m.set(c.id, cfg.forma === 'CHEQUE' ? (ch ? String(ch.siguiente + i) : '—') : `${p.referencia || 'TRF'} · ${i + 1}`)));
        return m;
      }

      function pintarFiltros() {
        ctx.filtros(`
          <label class="campo"><span>Documento</span><select name="documento">${DOCUMENTOS.map(([v, t]) => `<option value="${v}" ${f.documento === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="campo"><span>Proveedor</span><input type="search" name="proveedor" value="${esc(f.proveedor)}" placeholder="Código o nombre"></label>
          <label class="campo"><span>Ingreso desde</span><input type="date" name="desde" value="${f.desde}" ${f.hasta ? `max="${f.hasta}"` : ''}></label>
          <label class="campo"><span>Ingreso hasta</span><input type="date" name="hasta" value="${f.hasta}" ${f.desde ? `min="${f.desde}"` : ''}></label>
          <label class="campo"><span>Forma de pago</span><select name="forma">
            <option value="${cfg.forma}" ${f.forma === cfg.forma ? 'selected' : ''}>${cfg.forma === 'CHEQUE' ? 'Pago con cheque' : 'Pago por transferencia'}</option>
            <option value="" ${f.forma ? '' : 'selected'}>Todas las formas</option></select></label>`,
          `<button type="button" class="boton secundario-sm" data-accion="consultar"><i class="ti ti-search" aria-hidden="true"></i> Consultar</button>
           <button type="button" class="boton secundario-sm" data-accion="marcar"><i class="ti ti-checks" aria-hidden="true"></i> Marcar</button>`);
      }

      async function iniciar() {
        if (!(await ctx.cargarBase())) return;
        const prueba = await sb.from('compras_saldo').select('id').limit(1);
        if (prueba.error) {
          ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/compras/.test(prueba.error.message) ? 'Falta instalar el script 53 (facturas de compra y generación de pagos) en Supabase.' : esc(prueba.error.message)}</p></section>`;
          return;
        }
        pintarFiltros();
        await cargarLocalidad();
      }

      async function cargarLocalidad() {
        marcadas.clear(); actual = null; mensajes = []; generados = [];
        const loc = ctx.sel.loc;
        [cuentas, contables] = await Promise.all([ctx.cuentasBancarias(), ctx.cuentasContables()]);
        cuentas = cuentas.filter((c) => c.activo);
        const { data } = loc ? await sb.from('transacciones_contables').select('id, numero, descripcion').eq('localidad_id', loc).eq('estado', 'ACTIVO').order('numero') : { data: [] };
        transacciones = data || [];
        // Cuenta de pago: la que tenga chequera (cheques) o la primera en quetzales.
        const quetzales = cuentas.filter((c) => iso(c.moneda_id) === 'GTQ');
        const preferida = cfg.forma === 'CHEQUE' ? cuentas.find((c) => chequera(c)?.disponibles) : null;
        p.cuenta = (preferida || quetzales[0] || cuentas[0])?.id || null;
        await consultar();
      }

      async function consultar() {
        if (!ctx.sel.loc) { compras = []; return pintar(); }
        let q = sb.from('compras_saldo').select('*').eq('localidad_id', ctx.sel.loc).eq('estado', 'ACTIVA').gt('pendiente', 0).order('fecha_ingreso').order('numero');
        if (f.desde) q = q.gte('fecha_ingreso', f.desde);
        if (f.hasta) q = q.lte('fecha_ingreso', f.hasta);
        if (f.forma) q = q.eq('forma_pago', f.forma);
        if (f.documento) q = q.eq('tipo_documento', f.documento);
        const { data, error } = await q;
        if (error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
        const t = f.proveedor.trim().toLowerCase();
        compras = (data || []).filter((c) => !t || [c.proveedor_codigo, c.proveedor_nombre, c.nit].some((v) => String(v || '').toLowerCase().includes(t)));
        [...marcadas].forEach((id) => { if (!compras.some((c) => c.id === id)) marcadas.delete(id); });
        if (actual && !compras.some((c) => c.id === actual.id)) actual = null;
        if (!actual && compras[0]) await elegir(compras[0], false);
        await cargarSaldo();
        pintar();
      }

      async function cargarSaldo() {
        saldo = null;
        if (!p.cuenta) return;
        const { data, error } = await sb.rpc('saldo_cuenta_bancaria', { p_cuenta: p.cuenta, p_hasta: p.fecha || fmt.hoy() });
        if (!error) saldo = Number(data);
      }

      async function elegir(c, repintar = true) {
        actual = c;
        lineas = [];
        if (c) {
          const { data } = await sb.from('compra_lineas').select('*').eq('compra_id', c.id).order('linea');
          lineas = data || [];
        }
        if (repintar) { pintarMaestro(); pintarDetalle(); }
      }

      function pintar() { pintarMaestro(); pintarDetalle(); }

      function pintarMaestro() {
        const cb = cuentaPago();
        const num = propuestos();
        const elegibles = compras.filter((c) => !bloqueo(c));
        const todas = elegibles.length && elegibles.every((c) => marcadas.has(c.id));
        const totalPend = compras.reduce((t, c) => t + (enCuenta(c, cb) ?? 0), 0);
        const gs = grupos();
        const aPagar = gs.reduce((t, g) => t + g.valor, 0);
        const ch = chequera();
        const simCta = cb ? simbolo(cb.moneda_id) : 'Q';
        const despues = saldo === null ? null : fmt.redondear(saldo - aPagar);
        const corto = despues !== null && cb && despues < Number(cb.saldo_minimo || 0);
        const destino = (c) => `${esc(banco(c.banco_destino_id)?.siglas || banco(c.banco_destino_id)?.nombre || '')}`;
        ctx.pMae.innerHTML = `
          <header class="tk-bandeja-cab bg-cab">
            <h2>${f.documento === 'RECIBO' ? 'Recibos' : f.documento === 'FACTURA' ? 'Facturas' : 'Facturas y recibos'} pendientes de pago <small>${compras.length}</small></h2>
            <div class="bg-kpis">
              <span><small>Pendiente</small><b>${simCta} ${fmt.monto(totalPend)}</b></span>
              <span class="${marcadas.size ? 'activo' : ''}"><small>Marcadas</small><b>${marcadas.size}</b></span>
              <span class="${marcadas.size ? 'activo' : ''}"><small>A pagar</small><b>${simCta} ${fmt.monto(aPagar)}</b></span>
              <span><small>${cfg.Pago === 'Cheque' ? 'Cheques' : 'Transferencias'}</small><b>${gs.length}</b></span>
              ${cfg.forma === 'CHEQUE' ? `<span class="${ch && gs.length > ch.disponibles ? 'mal' : ''}"><small>Disponibles</small><b>${ch ? ch.disponibles : '—'}</b></span>` : ''}
              <span class="${corto ? 'mal' : ''}" title="Saldo de la cuenta bancaria a la fecha del pago"><small>Saldo después</small><b>${despues === null ? '—' : `${simCta} ${fmt.monto(despues)}`}</b></span>
            </div>
          </header>
          <div class="ta-tabla bg-tabla">
            <table>
              <thead><tr>
                <th class="bg-marca"><input type="checkbox" data-todas ${todas ? 'checked' : ''} ${elegibles.length ? '' : 'disabled'} aria-label="Marcar todas"></th>
                <th>Documento</th><th>Tipo</th><th>Compra</th><th>Proveedor</th><th>Transacción</th><th>Fecha ingreso</th><th>Vence</th>
                <th class="num">Valor total</th><th class="num bg-bonif">Bonificaciones</th><th class="num bg-pend">Pendiente liq.</th>
                ${cfg.forma === 'CHEQUE' ? '<th>Cuenta bancaria</th><th>Cheque</th>' : '<th>Banco destino</th><th>Cuenta destino</th><th>Lote</th>'}
              </tr></thead>
              <tbody>
                ${compras.map((c) => {
                  const b = bloqueo(c);
                  const marcada = marcadas.has(c.id);
                  const pref = cuentas.find((x) => x.id === c.cuenta_bancaria_id);
                  const vence = c.fecha_vencimiento && c.fecha_vencimiento < fmt.hoy();
                  const ml = c.moneda_id !== (cb?.moneda_id) && enCuenta(c) !== null ? `<small class="bg-ml">≈ ${simCta} ${fmt.monto(enCuenta(c))}</small>` : '';
                  return `<tr data-compra="${c.id}" class="${actual && actual.id === c.id ? 'actual' : ''} ${marcada ? 'marcada' : ''} ${b ? 'bloqueada' : ''}" tabindex="0">
                    <td class="bg-marca"><input type="checkbox" data-marca="${c.id}" ${marcada ? 'checked' : ''} ${b ? 'disabled' : ''} title="${esc(b || 'Generar')}" aria-label="Generar ${esc(docTxt(c))}"></td>
                    <td class="fuerte">${esc(`${c.serie ? `${c.serie}-` : ''}${c.documento}`)}</td><td><span class="pc-tipo bg-tipo-${c.tipo_documento === 'RECIBO' ? 'rec' : 'fac'}">${c.tipo_documento === 'RECIBO' ? 'Recibo' : 'Factura'}</span></td><td>${c.numero}</td>
                    <td class="bg-prov" title="${esc(c.proveedor_nombre)}">${c.proveedor_codigo ? `<span class="tk-tenue">${esc(c.proveedor_codigo)}</span> ` : ''}${esc(c.proveedor_nombre)}</td>
                    <td>${c.transaccion_id ? esc(String(transacciones.find((t) => t.id === c.transaccion_id)?.numero || '')) : '<span class="tk-tenue">—</span>'}</td>
                    <td>${esc(fmt.fechaDia(c.fecha_ingreso))}</td>
                    <td class="${vence ? 'pc-rojo' : ''}">${c.fecha_vencimiento ? esc(fmt.fechaDia(c.fecha_vencimiento)) : '<span class="tk-tenue">—</span>'}</td>
                    <td class="num">${esc(simbolo(c.moneda_id))} ${fmt.monto(c.valor_total)}</td>
                    <td class="num bg-bonif">${Number(c.bonificaciones) ? fmt.monto(c.bonificaciones) : '<span class="tk-tenue">—</span>'}</td>
                    <td class="num bg-pend"><b>${esc(simbolo(c.moneda_id))} ${fmt.monto(c.pendiente)}</b>${ml}</td>
                    ${cfg.forma === 'CHEQUE'
                      ? `<td>${pref ? esc(pref.numero) : '<span class="tk-tenue">—</span>'}</td><td>${marcada ? `<span class="pc-tipo bg-num">${esc(num.get(c.id) || '')}</span>` : b ? `<span class="bg-aviso" title="${esc(b)}"><i class="ti ti-alert-triangle" aria-hidden="true"></i></span>` : '<span class="tk-tenue">—</span>'}</td>`
                      : `<td>${destino(c) || '<span class="tk-tenue">—</span>'}</td><td>${c.cuenta_destino ? esc(c.cuenta_destino) : `<span class="bg-aviso" title="${esc(b)}"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Sin cuenta</span>`}</td><td>${marcada ? `<span class="pc-tipo bg-num">${esc(num.get(c.id) || '')}</span>` : '<span class="tk-tenue">—</span>'}</td>`}
                  </tr>`;
                }).join('') || `<tr><td colspan="${cfg.forma === 'CHEQUE' ? 13 : 14}" class="tk-vacio"><i class="ti ti-file-check" aria-hidden="true"></i>${ctx.sel.loc ? `No hay ${f.documento === 'RECIBO' ? 'recibos' : f.documento === 'FACTURA' ? 'facturas' : 'facturas ni recibos'} pendientes de pago con esos filtros.` : 'Elige la empresa.'}</td></tr>`}
              </tbody>
            </table>
          </div>`;
      }

      function pintarDetalle() {
        const c = actual;
        const cb = cuentaPago();
        const ch = chequera();
        const gs = grupos();
        const dato = (etq, val, extra = '') => `<div class="bm-dato ${extra}"><dt>${etq}</dt><dd>${val || '<span class="tk-tenue">—</span>'}</dd></div>`;
        const tr = c?.transaccion_id ? transacciones.find((t) => t.id === c.transaccion_id) : null;
        const sim = c ? simbolo(c.moneda_id) : 'Q';
        const extranjera = cb && iso(cb.moneda_id) !== 'GTQ';
        const totD = lineas.reduce((t, l) => t + Number(l.debe), 0);
        const totH = lineas.reduce((t, l) => t + Number(l.haber), 0);
        ctx.pDet.innerHTML = `
          <div class="bg-abajo">
            <section class="bm-bloque bg-compra">
              <h3 class="ta-col-titulo"><i class="ti ti-file-invoice" aria-hidden="true"></i> ${c ? `Compra ${c.numero} · ${esc(docTxt(c))}` : 'Compra'}</h3>
              ${c ? `<dl class="bg-datos">
                ${dato('Transacción', tr ? `${tr.numero} <small>${esc(tr.descripcion || '')}</small>` : '')}
                ${dato('Notas de crédito', Number(c.notas_credito) ? `${sim} ${fmt.monto(c.notas_credito)}` : '')}
                ${dato('Descuentos ND', Number(c.descuentos_nd) ? `${sim} ${fmt.monto(c.descuentos_nd)}` : '')}
                ${dato('Proveedor', `${c.proveedor_codigo ? `<b>${esc(c.proveedor_codigo)}</b> ` : ''}${esc(c.proveedor_nombre)}`, 'bm-c2')}
                ${dato('Usuario', esc(c.usuario || ''))}
                ${dato('A favor de', esc(c.beneficiario || ''), 'bm-c2')}
                ${dato('Neto · pagado', `${sim} ${fmt.monto(c.neto)} <small>pagado ${fmt.monto(c.pagado)}${c.ultimo_pago ? ` · ${esc(c.ultimo_pago)}` : ''}</small>`)}
              </dl>` : ctx.vacio('Elige una factura de la lista.', 'ti-file-invoice')}
            </section>
            <section class="bm-bloque bg-contable">
              <h3 class="ta-col-titulo"><i class="ti ti-list-details" aria-hidden="true"></i> Detalle contable de la compra</h3>
              <div class="pc-lineas"><table>
                <thead><tr><th>Cuenta</th><th>Nombre</th><th class="num">Débito</th><th class="num">Crédito</th></tr></thead>
                <tbody>${lineas.map((l) => { const k = contable(l.cuenta_id); return `<tr><td>${esc(k?.codigo || '')}</td><td>${esc(k?.nombre || '')}</td><td class="num">${Number(l.debe) ? fmt.monto(l.debe) : ''}</td><td class="num">${Number(l.haber) ? fmt.monto(l.haber) : ''}</td></tr>`; }).join('')
                  || `<tr><td colspan="4" class="tk-vacio">${c ? 'La compra no tiene detalle contable.' : '—'}</td></tr>`}</tbody>
                ${lineas.length ? `<tfoot><tr><td colspan="2">Totales</td><td class="num">${fmt.monto(totD)}</td><td class="num">${fmt.monto(totH)}</td></tr></tfoot>` : ''}
              </table></div>
            </section>
            <form class="bm-bloque bg-generar" novalidate>
              <h3 class="ta-col-titulo"><i class="ti ${cfg.botonIcono}" aria-hidden="true"></i> ${esc(cfg.boton)}</h3>
              <div class="bg-campos">
                <label class="campo bg-c2"><span>${cfg.forma === 'CHEQUE' ? 'Cuenta bancaria' : 'Cuenta de origen'}</span><select name="cuenta">${cuentas.map((x) => `<option value="${x.id}" ${x.id === p.cuenta ? 'selected' : ''}>${esc(ctx.nombreCuentaBancaria(x))} · ${esc(simbolo(x.moneda_id))}</option>`).join('') || '<option value="">Sin cuentas bancarias</option>'}</select></label>
                <label class="campo"><span>${esc(cfg.fecha)}</span><input type="date" name="fecha" value="${esc(p.fecha)}"></label>
                ${cfg.forma === 'CHEQUE'
                  ? `<div class="bg-chequera"><small>Chequera</small><b>${ch ? `Sig. ${ch.siguiente}` : 'Sin chequera'}</b><small>${ch ? `${ch.disponibles} disponibles` : 'Defínela en Cuentas bancarias'}</small></div>`
                  : `<label class="campo"><span>Referencia del lote</span><input name="referencia" value="${esc(p.referencia)}" maxlength="12" placeholder="Ej. LOTE1104"></label>`}
                <label class="campo bg-c2"><span>Transacción</span><select name="transaccion"><option value="">Sin transacción</option>${transacciones.slice().sort((a, b) => String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es')).map((t) => `<option value="${t.id}" ${String(t.id) === p.transaccion ? 'selected' : ''}>${esc(t.descripcion || '')} · ${t.numero}</option>`).join('')}</select></label>
                ${extranjera ? `<label class="campo"><span>Tipo de cambio</span><input type="number" step="any" min="0" name="cambio" value="${esc(p.cambio || ctx.moneda(cb.moneda_id)?.cambio || '')}"></label>` : '<span></span>'}
                <label class="campo bg-c3"><span>Descripción</span><input name="descripcion" value="${esc(p.descripcion)}" maxlength="120" placeholder="Se agrega antes de «PAGO FACTURA …»"></label>
                <div class="bg-opciones bg-c3">
                  <label class="pc-check"><input type="checkbox" name="agrupar" ${p.agrupar ? 'checked' : ''}> Un ${esc(cfg.pago)} por proveedor</label>
                  <label class="pc-check"><input type="checkbox" name="partida" ${p.partida ? 'checked' : ''}> Generar partida contable</label>
                </div>
              </div>
              <div class="bg-accion">
                <div class="bg-benef"><small>Beneficiario</small><b>${gs.length === 1 ? esc(gs[0].beneficiario) : gs.length ? `${gs.length} beneficiarios` : 'Según cada proveedor'}</b></div>
                <button type="submit" class="boton primario-sm bg-boton" ${!ctx.admin || !gs.length || trabajando ? 'disabled' : ''} title="${ctx.admin ? '' : 'Solo un administrador genera pagos'}"><i class="ti ${cfg.botonIcono}" aria-hidden="true"></i> ${esc(cfg.boton)} <i class="ti ti-arrow-right" aria-hidden="true"></i></button>
              </div>
              <p class="modal-error tk-error" role="alert"></p>
              <div class="bg-mensajes" aria-live="polite">
                <span class="bg-mensajes-tit">Mensajes</span>
                ${mensajes.length ? `<ul>${mensajes.map((m) => `<li class="${m.tipo}"><i class="ti ${m.tipo === 'ok' ? 'ti-circle-check' : m.tipo === 'mal' ? 'ti-alert-triangle' : 'ti-info-circle'}" aria-hidden="true"></i><span>${m.html}</span></li>`).join('')}</ul>` : `<p>${gs.length ? `Listo para generar <b>${gs.length}</b> ${gs.length === 1 ? esc(cfg.pago) : esc(cfg.pagos)} por <b>${esc(cb ? simbolo(cb.moneda_id) : 'Q')} ${fmt.monto(gs.reduce((t, g) => t + g.valor, 0))}</b>.` : 'Marca las facturas a pagar en la columna «Generar».'}</p>`}
                ${generados.length ? `<div class="bg-despues">
                  <a class="boton secundario-sm" href="${cfg.ver}"><i class="ti ti-external-link" aria-hidden="true"></i> ${esc(cfg.verTexto)}</a>
                  <button type="button" class="boton secundario-sm" data-accion="imprimir-lote"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir relación</button>
                  ${cfg.forma === 'TRANSFERENCIA' ? '<button type="button" class="boton secundario-sm" data-accion="lote"><i class="ti ti-file-download" aria-hidden="true"></i> Descargar lote (CSV)</button>' : ''}
                </div>` : ''}
              </div>
            </form>
          </div>`;
      }

      async function generar(form) {
        const error = form.querySelector('.modal-error');
        const cb = cuentaPago();
        const gs = grupos();
        error.textContent = '';
        if (!cb) { error.textContent = 'Elige la cuenta bancaria.'; return; }
        if (!gs.length) { error.textContent = 'Marca las facturas que vas a pagar.'; return; }
        if (!p.fecha) { error.textContent = `Escribe la ${cfg.fecha.toLowerCase()}.`; return; }
        const ch = chequera();
        if (cfg.forma === 'CHEQUE' && !ch) { error.textContent = `La cuenta ${cb.numero} no tiene chequera: defínela en Bancos · Cuentas bancarias.`; return; }
        if (cfg.forma === 'CHEQUE' && gs.length > ch.disponibles) { error.textContent = `La chequera solo tiene ${ch.disponibles} cheques disponibles y se necesitan ${gs.length}.`; return; }
        const extranjera = iso(cb.moneda_id) !== 'GTQ';
        const cambio = extranjera ? Number(form.elements.cambio?.value || 0) : 1;
        if (extranjera && !(cambio > 0)) { error.textContent = 'Escribe el tipo de cambio del pago.'; return; }
        const total = gs.reduce((t, g) => t + g.valor, 0);
        const sim = simbolo(cb.moneda_id);
        const despues = saldo === null ? null : fmt.redondear(saldo - total);
        const aviso = despues !== null && despues < Number(cb.saldo_minimo || 0) ? `\n\nAtención: el saldo de la cuenta quedaría en ${sim} ${fmt.monto(despues)}, debajo del saldo mínimo.` : '';
        if (!confirm(`¿Generar ${gs.length} ${gs.length === 1 ? cfg.pago : cfg.pagos} por ${sim} ${fmt.monto(total)} desde la cuenta ${cb.numero}?${aviso}`)) return;
        trabajando = true;
        pintarDetalle();
        const { data, error: e } = await sb.rpc('generar_pagos_compras', {
          p_compras: [...marcadas], p_forma: cfg.forma, p_cuenta: cb.id, p_fecha: p.fecha, p_agrupar: p.agrupar,
          p_transaccion: p.transaccion ? Number(p.transaccion) : null, p_descripcion: p.descripcion || null, p_partida: p.partida,
          p_tipo_cambio: extranjera ? cambio : null, p_referencia: p.referencia || null
        });
        trabajando = false;
        if (e) {
          mensajes = [{ tipo: 'mal', html: esc(window.UI.traducirError(e)) }];
          return pintarDetalle();
        }
        generados = (data || []).map((g) => ({ ...g, cuenta: cb, fecha: p.fecha, sim }));
        mensajes = [
          { tipo: 'ok', html: `Se ${generados.length === 1 ? 'generó' : 'generaron'} <b>${generados.length}</b> ${generados.length === 1 ? esc(cfg.pago) : esc(cfg.pagos)} por <b>${esc(sim)} ${fmt.monto(generados.reduce((t, g) => t + Number(g.valor), 0))}</b>.` },
          ...generados.map((g) => ({ tipo: g.contabilizado ? 'ok' : 'info', html: `${esc(cfg.Pago)} <b>${esc(g.numero || g.folio)}</b> · ${esc(g.beneficiario)} · ${esc(sim)} ${fmt.monto(g.valor)} · ${esc(g.documentos)}${g.partida ? ` · partida ${esc(g.partida)}` : g.contabilizado ? '' : ' · <i>sin detalle contable: falta la cuenta por pagar o la cuenta contable del banco</i>'}` }))
        ];
        window.FIN.aviso(`${generados.length} ${generados.length === 1 ? cfg.pago : cfg.pagos} ${generados.length === 1 ? 'generado' : 'generados'}`);
        marcadas.clear();
        cuentas = (await ctx.cuentasBancarias()).filter((x) => x.activo);
        await consultar();
      }

      function imprimirLote() {
        const cb = generados[0]?.cuenta;
        const emp = ctx.localidad(ctx.sel.loc);
        const total = generados.reduce((t, g) => t + Number(g.valor), 0);
        imprimir(`Relación de ${cfg.pagos}`, `
          <h1>Relación de ${esc(cfg.pagos)} generados</h1>
          <h2>${esc(emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '')} · cuenta ${esc(cb ? ctx.nombreCuentaBancaria(cb) : '')} · ${esc(fmt.fechaDia(generados[0]?.fecha))} · ${esc((yo.usuario || '').toUpperCase())}</h2>
          <table><thead><tr><th>${esc(cfg.Pago)}</th><th>Beneficiario</th>${cfg.forma === 'TRANSFERENCIA' ? '<th>Banco destino</th><th>Cuenta destino</th>' : ''}<th>Facturas pagadas</th><th>Partida</th><th class="n">Valor</th></tr></thead>
          <tbody>${generados.map((g) => `<tr><td>${esc(g.numero || g.folio)}</td><td>${esc(g.beneficiario)}</td>${cfg.forma === 'TRANSFERENCIA' ? `<td>${esc(banco(g.banco_destino_id)?.nombre || '')}</td><td>${esc(g.cuenta_destino || '')}</td>` : ''}<td>${esc(g.documentos)}</td><td>${esc(g.partida || '')}</td><td class="n">${fmt.monto(g.valor)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="${cfg.forma === 'TRANSFERENCIA' ? 6 : 4}">Total · ${generados.length} ${esc(cfg.pagos)}</td><td class="n">${esc(generados[0]?.sim || 'Q')} ${fmt.monto(total)}</td></tr></tfoot></table>
          <div class="firmas"><div>Elaboró</div><div>Revisó</div><div>Autorizó</div></div>`);
      }

      // Lote para la banca en línea: una línea por transferencia.
      function descargarLote() {
        const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const filas = [['Referencia', 'Fecha', 'Cuenta origen', 'Banco destino', 'Cuenta destino', 'Beneficiario', 'Moneda', 'Monto', 'Concepto']]
          .concat(generados.map((g) => [g.numero, g.fecha, g.cuenta.numero, banco(g.banco_destino_id)?.nombre || '', g.cuenta_destino || '', g.beneficiario, ctx.moneda(g.cuenta.moneda_id)?.iso || '', Number(g.valor).toFixed(2), `PAGO ${g.documentos}`]));
        const blob = new Blob([`﻿${filas.map((r) => r.map(csv).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `lote_transferencias_${(p.referencia || 'TRF').replace(/[^\w-]+/g, '')}_${String(generados[0]?.fecha || fmt.hoy()).replace(/-/g, '')}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      }

      // ---------- Eventos ----------
      cont.addEventListener('change', async (e) => {
        const cambio = ctx.cambioOrgLoc(e);
        if (cambio === 'org' || cambio === 'loc') { pintarFiltros(); return cargarLocalidad(); }
        if (cambio === 'otro') {
          f[e.target.name] = e.target.value;
          if (f.desde && f.hasta && f.hasta < f.desde) { if (e.target.name === 'desde') f.hasta = f.desde; else f.desde = f.hasta; }
          pintarFiltros();
          return consultar();
        }
        if (e.target.matches('[data-marca]')) {
          const id = Number(e.target.dataset.marca);
          if (e.target.checked) marcadas.add(id); else marcadas.delete(id);
          mensajes = []; generados = [];
          return pintar();
        }
        if (e.target.matches('[data-todas]')) {
          compras.filter((c) => !bloqueo(c)).forEach((c) => { if (e.target.checked) marcadas.add(c.id); else marcadas.delete(c.id); });
          mensajes = []; generados = [];
          return pintar();
        }
        const form = e.target.closest('.bg-generar');
        if (!form) return;
        const n = e.target.name;
        if (n === 'agrupar' || n === 'partida') p[n] = e.target.checked;
        else if (n === 'cuenta') {
          p.cuenta = Number(e.target.value) || null; p.cambio = '';
          // Las compras que ya no se pueden pagar desde la cuenta nueva se desmarcan.
          compras.forEach((c) => { if (bloqueo(c)) marcadas.delete(c.id); });
          await cargarSaldo();
        } else if (n === 'fecha') { p.fecha = e.target.value; await cargarSaldo(); } else p[n] = e.target.value.trim();
        mensajes = []; generados = [];
        pintar();
      });
      cont.addEventListener('input', (e) => {
        const form = e.target.closest('.bg-generar');
        if (form && ['descripcion', 'referencia', 'cambio'].includes(e.target.name)) {
          p[e.target.name] = e.target.value.trim();
          if (e.target.name === 'referencia') pintarMaestro();
        }
      });
      cont.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.name === 'proveedor') { e.preventDefault(); f.proveedor = e.target.value; consultar(); }
        const fila = e.target.closest?.('tr[data-compra]');
        if (fila && (e.key === 'Enter' || e.key === ' ') && e.target === fila) {
          e.preventDefault();
          const box = fila.querySelector('[data-marca]');
          if (e.key === ' ' && box && !box.disabled) { box.checked = !box.checked; box.dispatchEvent(new Event('change', { bubbles: true })); } else elegir(compras.find((c) => String(c.id) === fila.dataset.compra));
        }
      });
      cont.addEventListener('click', (e) => {
        const ac = e.target.closest('[data-accion]');
        if (ac) {
          const a = ac.dataset.accion;
          if (a === 'consultar') { f.proveedor = ctx.pFil.querySelector('[name=proveedor]')?.value || ''; return consultar(); }
          if (a === 'marcar') {
            const elegibles = compras.filter((c) => !bloqueo(c));
            const todas = elegibles.length && elegibles.every((c) => marcadas.has(c.id));
            elegibles.forEach((c) => { if (todas) marcadas.delete(c.id); else marcadas.add(c.id); });
            mensajes = []; generados = [];
            return pintar();
          }
          if (a === 'imprimir-lote') return imprimirLote();
          if (a === 'lote') return descargarLote();
          return;
        }
        if (e.target.closest('[data-marca], [data-todas]')) return;
        const fila = e.target.closest('tr[data-compra]');
        if (fila) elegir(compras.find((c) => String(c.id) === fila.dataset.compra));
      });
      cont.addEventListener('submit', (e) => { if (e.target.matches('.bg-generar')) { e.preventDefault(); generar(e.target); } });

      iniciar();
    };
  }

  window.PANTALLAS = window.PANTALLAS || {};
  Object.keys(CONFIG).forEach((k) => { window.PANTALLAS[k] = pantalla(k); });
})();
