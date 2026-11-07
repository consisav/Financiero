// Caja y Bancos · Cheques · Facturas de compra por pagar: las facturas y recibos de compra que se
// pagan con Generación cheques y Generación transferencias.
//   Encabezado en tarjetas: documento (factura o recibo, serie, número, fechas y número de compra);
//   proveedor (tipo, código, nombre, NIT y a favor de quién se paga); importe (moneda, cambio,
//   valor total, bonificaciones, notas de crédito, descuentos ND, neto, pagado y pendiente);
//   pago (forma, cuenta bancaria, banco y cuenta del proveedor) y control.
//   Pestañas: Detalle contable (desde la transacción o a mano, con la cuenta por pagar), Pagos
//   (cheques y transferencias que la pagaron) y Listado de compras.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  const IVA = 0.12;
  const ESTADO_PAGO = (c) => c.estado === 'ANULADA' ? 'ANULADA' : Number(c.pendiente) <= 0 ? 'PAGADA' : Number(c.pagado) > 0 ? 'PARCIAL' : 'PENDIENTE';
  const CLASE = { PENDIENTE: 'pendiente', PARCIAL: 'aprobada', PAGADA: 'definitiva', ANULADA: 'anulada' };
  const marca = (e) => `<span class="pc-marca ${CLASE[e]}">${{ PENDIENTE: 'Pendiente de pago', PARCIAL: 'Pago parcial', PAGADA: 'Pagada', ANULADA: 'Anulada' }[e]}</span>`;

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['facturas-de-compra'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Facturas de compra por pagar', icono: 'ti-file-invoice', clase: 'bk-movimientos bk-compras', grupo: 'Cheques' });
    const { sb, yo } = ctx;
    const [anio, mes] = fmt.hoy().split('-');
    const f = { estado: 'POR PAGAR', desde: `${anio}-${String(Number(mes) - 1 || 1).padStart(2, '0')}-01`, hasta: fmt.hoy() };
    let compras = [];
    let cuentas = [];
    let contables = [];
    let centros = [];
    let transacciones = [];
    let actual = null;
    let lineas = [];
    let pagos = [];
    let modificando = false;
    let pestana = 'CONTABLE';
    let buscar = '';

    const editable = () => ctx.admin && (!actual || (modificando && actual.estado === 'ACTIVA'));
    const contable = (id) => contables.find((x) => x.id === id);
    const docTxt = (c) => `${c.tipo_documento === 'RECIBO' ? 'Recibo' : 'Factura'} ${c.serie ? `${c.serie}-` : ''}${c.documento}`;
    const simbolo = (id) => ctx.moneda(id)?.simbolo || 'Q';

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Estado</span><select name="estado">${['POR PAGAR', 'PAGADAS', 'ANULADAS', 'TODAS'].map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label class="campo"><span>Ingreso desde</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Ingreso hasta</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>`);
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
      actual = null;
      const loc = ctx.sel.loc;
      [cuentas, contables, centros] = await Promise.all([ctx.cuentasBancarias(), ctx.cuentasContables(), centrosLocalidad()]);
      const { data } = loc ? await sb.from('transacciones_contables').select('id, numero, descripcion').eq('localidad_id', loc).eq('estado', 'ACTIVO').order('numero') : { data: [] };
      transacciones = data || [];
      await consultar();
    }
    async function centrosLocalidad() {
      if (!ctx.sel.loc) return [];
      const { data: k } = await sb.from('catalogos_centros').select('id').eq('localidad_id', ctx.sel.loc).eq('activo', true).order('version', { ascending: false }).limit(1);
      if (!k?.[0]) return [];
      const { data } = await sb.from('centros_costo').select('id, codigo, nombre, centro_mayor_id, vigente').eq('catalogo_id', k[0].id).order('codigo');
      const padres = new Set((data || []).map((c) => c.centro_mayor_id).filter(Boolean));
      return (data || []).map((c) => ({ ...c, movimiento: !padres.has(c.id) && c.vigente }));
    }

    async function consultar() {
      if (!ctx.sel.loc) { compras = []; pintarMaestro(); return abrir(null); }
      let q = sb.from('compras_saldo').select('*').eq('localidad_id', ctx.sel.loc).order('numero', { ascending: false });
      // Las que están por pagar se ven todas, sin importar la fecha.
      if (f.estado === 'POR PAGAR') q = q.eq('estado', 'ACTIVA').gt('pendiente', 0);
      else {
        q = q.gte('fecha_ingreso', f.desde).lte('fecha_ingreso', f.hasta);
        if (f.estado === 'PAGADAS') q = q.eq('estado', 'ACTIVA').lte('pendiente', 0);
        if (f.estado === 'ANULADAS') q = q.eq('estado', 'ANULADA');
      }
      const { data, error } = await q;
      if (error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      compras = data;
      pintarMaestro();
      await abrir(actual ? compras.find((c) => c.id === actual.id) || null : compras[0] || null);
    }

    function pintarMaestro() {
      const q = buscar.trim().toLowerCase();
      const filas = compras.filter((c) => !q || [c.numero, c.documento, c.serie, c.proveedor_codigo, c.proveedor_nombre, c.nit, c.descripcion].some((v) => String(v || '').toLowerCase().includes(q)));
      const vivas = compras.filter((c) => c.estado === 'ACTIVA');
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab tg-cab">
          <h2>Compras <small>${compras.length}</small></h2>
          <div class="ta-totales pc-resumen"><span class="ta-total sin"><b>${vivas.filter((c) => Number(c.pendiente) > 0).length}</b> por pagar</span><span class="ta-total"><b>Q ${fmt.monto(vivas.reduce((t, c) => t + Number(c.pendiente) * Number(c.tipo_cambio), 0))}</b> pendiente</span></div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar factura, proveedor, NIT…" value="${esc(buscar)}" aria-label="Buscar compras"></label>
        </header>
        <div class="ta-tabla">
          <table>
            <thead><tr><th>Compra</th><th>Documento</th><th>Ingreso</th><th>Vence</th><th>Proveedor</th><th>Forma de pago</th><th class="num">Valor total</th><th class="num">Neto</th><th class="num">Pagado</th><th class="num">Pendiente</th><th>Estado</th><th>Pagos</th></tr></thead>
            <tbody>
              ${filas.map((c) => `<tr class="${actual && actual.id === c.id ? 'actual' : ''} ${c.estado === 'ANULADA' ? 'pc-anulada' : ''}" data-compra="${c.id}" tabindex="0">
                <td class="fuerte">${c.numero}</td><td>${esc(docTxt(c))}</td><td>${esc(fmt.fechaDia(c.fecha_ingreso))}</td>
                <td class="${c.fecha_vencimiento && c.fecha_vencimiento < fmt.hoy() && Number(c.pendiente) > 0 ? 'pc-rojo' : ''}">${esc(fmt.fechaDia(c.fecha_vencimiento))}</td>
                <td class="ta-desc" title="${esc(c.proveedor_nombre)}">${esc(c.proveedor_nombre)}</td><td>${c.forma_pago === 'CHEQUE' ? 'Cheque' : 'Transferencia'}</td>
                <td class="num">${esc(simbolo(c.moneda_id))} ${fmt.monto(c.valor_total)}</td><td class="num">${fmt.monto(c.neto)}</td><td class="num">${fmt.monto(c.pagado)}</td><td class="num fuerte">${fmt.monto(c.pendiente)}</td>
                <td>${marca(ESTADO_PAGO(c))}</td><td>${c.ultimo_pago ? `<span class="pc-tipo">${esc(c.ultimo_pago)}</span>` : '<span class="tk-tenue">—</span>'}</td></tr>`).join('')
                || `<tr><td colspan="12" class="tk-vacio"><i class="ti ti-file-invoice" aria-hidden="true"></i>${compras.length ? 'Ninguna compra coincide con la búsqueda.' : 'No hay compras con esos filtros.'}</td></tr>`}
            </tbody>
          </table>
        </div>`;
    }

    async function abrir(c, editar = false) {
      actual = c;
      modificando = !!c && editar && c.estado === 'ACTIVA' && ctx.admin;
      lineas = []; pagos = [];
      if (c) {
        const [l, d] = await Promise.all([
          sb.from('compra_lineas').select('*').eq('compra_id', c.id).order('linea'),
          sb.from('movimiento_documentos').select('abono, abono_compra, movimiento_id, movimientos_bancarios(tipo, numero_documento, folio, fecha, estado, valor, moneda_id, cuenta_bancaria_id, deposito_por)').eq('compra_id', c.id)
        ]);
        lineas = (l.data || []).map((x) => ({ cuenta_id: x.cuenta_id, codigo: contable(x.cuenta_id)?.codigo || '', centro_id: x.centro_id, debe: Number(x.debe), haber: Number(x.haber) }));
        pagos = d.data || [];
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-compra]').forEach((tr) => tr.classList.toggle('actual', !!c && tr.dataset.compra === String(c.id)));
    }

    const pestanas = () => [
      { id: 'CONTABLE', texto: 'Detalle contable', icono: 'ti-list-details', n: lineas.length },
      { id: 'PAGOS', texto: 'Pagos', icono: 'ti-cash', n: pagos.length },
      { id: 'LISTADO', texto: 'Listado de compras', icono: 'ti-list-search', n: compras.length }
    ];

    function pintarDetalle(v0) {
      const c = actual;
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-file-invoice'); return; }
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const base = ctx.monedaBase();
      const v = v0 || (c ? { ...c } : { tipo_documento: 'FACTURA', serie: '', documento: '', fecha_documento: fmt.hoy(), fecha_ingreso: fmt.hoy(), fecha_vencimiento: '', tipo_tercero: 'PROVEEDOR PRODUCTOS', proveedor_codigo: '', proveedor_nombre: '', nit: '', beneficiario: '', transaccion_id: null, descripcion: '', moneda_id: base?.id, tipo_cambio: base?.cambio || 1, valor_total: '', bonificaciones: 0, notas_credito: 0, descuentos_nd: 0, forma_pago: 'CHEQUE', cuenta_bancaria_id: null, banco_destino_id: null, cuenta_destino: '', cuenta_pagar_id: null });
      const neto = fmt.redondear(Number(v.valor_total || 0) - Number(v.bonificaciones || 0) - Number(v.notas_credito || 0) - Number(v.descuentos_nd || 0));
      const pagado = c ? Number(c.pagado) : 0;
      const estado = c ? ESTADO_PAGO(c) : 'PENDIENTE';
      const consulta = c && !modificando;
      const sim = simbolo(v.moneda_id);
      const dato = (etq, val, extra = '') => `<div class="bm-dato ${extra}"><dt>${etq}</dt><dd>${val || '<span class="tk-tenue">—</span>'}</dd></div>`;
      const cxp = contable(v.cuenta_pagar_id);
      const disC = ed && !c?.partida_id ? '' : 'disabled';
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form bm-form bc-form" novalidate>
          <header class="tk-titulo bm-titulo">
            <div class="tk-titulo-texto"><small>Facturas de compra por pagar</small><h2>${c ? `Compra ${c.numero} <span class="pc-anual">${esc(docTxt(c))}</span>` : 'Nueva factura de compra'}</h2></div>
            <div class="tk-marcas">${marca(estado)}${c?.partida_id ? '<span class="pc-marca definitiva"><i class="ti ti-check" aria-hidden="true"></i> Contabilizada</span>' : ''}${modificando ? '<span class="pc-marca pendiente"><i class="ti ti-pencil" aria-hidden="true"></i> Modificando</span>' : ''}</div>
            <div class="tk-titulo-acciones">
              ${consulta && ctx.admin ? '<button type="button" class="boton secundario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nueva</button>' : ''}
              ${consulta ? '<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>' : ''}
              ${consulta && ctx.admin && c.estado === 'ACTIVA' && !pagado ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="anular"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>' : ''}
              ${consulta && ctx.admin && c.estado === 'ACTIVA' && !c.partida_id ? '<button type="button" class="boton secundario-sm" data-accion="partida"><i class="ti ti-file-check" aria-hidden="true"></i> Generar partida</button>' : ''}
              ${consulta && ctx.admin && c.estado === 'ACTIVA' && Number(c.pendiente) > 0 ? `<a class="boton secundario-sm" href="#/caja-bancos/${c.forma_pago === 'CHEQUE' ? 'generacion-cheques' : 'generacion-transferencias'}"><i class="ti ${c.forma_pago === 'CHEQUE' ? 'ti-files' : 'ti-arrows-exchange'}" aria-hidden="true"></i> Pagar</a>` : ''}
              ${consulta && ctx.admin && c.estado === 'ACTIVA' ? '<button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}
              ${modificando ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}
              ${ed ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${c ? 'Guardar cambios' : 'Registrar compra'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          ${c?.estado === 'ANULADA' ? `<p class="tk-aviso bm-anulado"><i class="ti ti-ban" aria-hidden="true"></i> Anulada por ${esc(c.anulado_por || '')} · ${esc(fmt.fechaHora(c.anulado_en))}: ${esc(c.motivo_anulacion || '')}</p>` : ''}

          <div class="bc-cabecera">
            <section class="bs-tipo bc-doc">
              <div class="bc-doc-campos">
                <label class="campo"><span>Documento</span><select name="tipo_documento" ${dis}>${['FACTURA', 'RECIBO'].map((t) => `<option ${v.tipo_documento === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
                <label class="campo"><span>Serie</span><input name="serie" value="${esc(v.serie || '')}" maxlength="20" ${dis}></label>
                <label class="campo bm-c2"><span>Número *</span><input name="documento" value="${esc(v.documento || '')}" maxlength="40" ${dis}></label>
                <label class="campo"><span>Fecha documento</span><input type="date" name="fecha_documento" value="${esc(v.fecha_documento || '')}" ${dis}></label>
                <label class="campo"><span>Fecha ingreso</span><input type="date" name="fecha_ingreso" value="${esc(v.fecha_ingreso || '')}" ${dis}></label>
                <label class="campo"><span>Vencimiento</span><input type="date" name="fecha_vencimiento" value="${esc(v.fecha_vencimiento || '')}" ${dis}></label>
                <div class="bs-req-num"><span>No. compra</span><b>${c ? c.numero : 'Automático'}</b></div>
              </div>
            </section>
            <section class="bm-bloque bc-prov">
              <h3 class="ta-col-titulo"><i class="ti ti-truck" aria-hidden="true"></i> Proveedor</h3>
              <div class="bs-campos">
                <label class="campo bs-c2"><span>Tipo</span><select name="tipo_tercero" ${dis}>${[['PROVEEDOR PRODUCTOS', 'Proveedor de productos'], ['PROVEEDOR SERVICIOS', 'Proveedor de servicios']].map(([k, t]) => `<option value="${k}" ${v.tipo_tercero === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
                <label class="campo"><span>Código</span><input name="proveedor_codigo" value="${esc(v.proveedor_codigo || '')}" maxlength="20" ${dis}></label>
                <label class="campo"><span>NIT</span><input name="nit" value="${esc(v.nit || '')}" maxlength="20" ${dis}></label>
                <label class="campo bs-c4"><span>Nombre del proveedor *</span><input name="proveedor_nombre" value="${esc(v.proveedor_nombre || '')}" maxlength="150" ${dis}></label>
                <label class="campo bs-c4"><span>A favor de (beneficiario)</span><input name="beneficiario" value="${esc(v.beneficiario || '')}" maxlength="150" placeholder="Si se deja vacío, el nombre del proveedor" ${dis}></label>
              </div>
            </section>
            <section class="bm-importe bc-importe">
              <label class="campo"><span>Moneda</span><select name="moneda_id" ${dis}>${ctx.monedas.map((m) => `<option value="${m.id}" ${v.moneda_id === m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
              <label class="campo"><span>Valor cambio</span><input type="number" step="any" min="0" name="tipo_cambio" value="${esc(String(v.tipo_cambio ?? 1))}" ${dis}></label>
              <label class="campo bc-total"><span>Valor total *</span><input type="number" step="0.01" min="0" name="valor_total" value="${esc(String(v.valor_total ?? ''))}" ${dis}></label>
              <label class="campo bc-bonif"><span>Bonificaciones</span><input type="number" step="0.01" min="0" name="bonificaciones" value="${esc(String(v.bonificaciones ?? 0))}" ${dis}></label>
              <label class="campo"><span>Notas de crédito</span><input type="number" step="0.01" min="0" name="notas_credito" value="${esc(String(v.notas_credito ?? 0))}" ${dis}></label>
              <label class="campo"><span>Descuentos ND</span><input type="number" step="0.01" min="0" name="descuentos_nd" value="${esc(String(v.descuentos_nd ?? 0))}" ${dis}></label>
              <div class="bc-saldos">
                <div><span>Neto</span><b data-neto>${esc(sim)} ${fmt.monto(neto)}</b></div>
                <div><span>Pagado</span><b>${esc(sim)} ${fmt.monto(pagado)}</b></div>
                <div class="bc-pend"><span>Pendiente liq.</span><b data-pendiente>${esc(sim)} ${fmt.monto(neto - pagado)}</b></div>
              </div>
            </section>
            <section class="bm-bloque bc-pago">
              <h3 class="ta-col-titulo"><i class="ti ti-building-bank" aria-hidden="true"></i> Pago</h3>
              <div class="bs-campos">
                <div class="campo bs-c4 bm-radios"><span>Forma de pago</span><div class="bc-formas">${[['CHEQUE', 'Cheque', 'ti-writing'], ['TRANSFERENCIA', 'Transferencia', 'ti-arrows-exchange']].map(([k, t, i]) => `<label class="pc-check"><input type="radio" name="forma_pago" value="${k}" ${v.forma_pago === k ? 'checked' : ''} ${dis}><i class="ti ${i}" aria-hidden="true"></i> ${t}</label>`).join('')}</div></div>
                <label class="campo bs-c4"><span>Cuenta bancaria de pago</span><select name="cuenta_bancaria_id" ${dis}><option value="">La que se elija al generar</option>${cuentas.filter((x) => x.activo || x.id === v.cuenta_bancaria_id).map((x) => `<option value="${x.id}" ${x.id === v.cuenta_bancaria_id ? 'selected' : ''}>${esc(ctx.nombreCuentaBancaria(x))}</option>`).join('')}</select></label>
                <label class="campo bs-c2"><span>Banco del proveedor</span><select name="banco_destino_id" ${dis}><option value="">—</option>${ctx.bancosLoc().filter((b) => b.activo || b.id === v.banco_destino_id).map((b) => `<option value="${b.id}" ${b.id === v.banco_destino_id ? 'selected' : ''}>${esc(b.siglas || b.nombre)}</option>`).join('')}</select></label>
                <label class="campo bs-c2"><span>Cuenta del proveedor</span><input name="cuenta_destino" value="${esc(v.cuenta_destino || '')}" maxlength="40" placeholder="Para transferencias" ${dis}></label>
              </div>
            </section>
            <section class="bm-bloque bm-control bc-control">
              <h3 class="ta-col-titulo"><i class="ti ti-shield-check" aria-hidden="true"></i> Control</h3>
              <dl>
                ${dato('Ingreso', c ? `${esc(c.usuario || '')} <small>${esc(fmt.fechaHora(c.creado_en))}</small>` : `${esc((yo.usuario || '').toUpperCase())}`, 'bm-c2')}
                ${dato('Modificó', c?.modificado_en && c.modificado_en !== c.creado_en ? `${esc(c.modificado_por_nombre || '')} <small>${esc(fmt.fechaHora(c.modificado_en))}</small>` : '', 'bm-c2')}
                ${dato('Pagos', c?.ultimo_pago ? esc(c.ultimo_pago) : '', 'bm-c2')}
              </dl>
            </section>
          </div>

          <section class="bm-pestanas">
            <div class="bm-tabs-barra">
              <div class="rp-pestanas" role="tablist">${pestanas().map((t) => `<button type="button" role="tab" data-pestana="${t.id}" class="${pestana === t.id ? 'activa' : ''}" aria-selected="${pestana === t.id}"><i class="ti ${t.icono}" aria-hidden="true"></i> ${esc(t.texto)}${t.n ? ` <b>${t.n}</b>` : ''}</button>`).join('')}</div>
              <span data-cuadre></span>
            </div>
            <div class="bm-panel" data-panel="CONTABLE" ${pestana === 'CONTABLE' ? '' : 'hidden'}>
              <div class="bm-transaccion bc-transaccion">
                <label class="campo"><span>Transacción</span><select name="transaccion_id" ${dis}><option value="">Sin transacción</option>${transacciones.slice().sort((a, b) => String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es')).map((t) => `<option value="${t.id}" ${t.id === v.transaccion_id ? 'selected' : ''}>${esc(t.descripcion || '')} · ${t.numero}</option>`).join('')}</select></label>
                <label class="campo"><span>Cuenta por pagar (proveedor)</span><input list="bc-cuentas" name="cuenta_pagar" value="${esc(cxp ? cxp.codigo : '')}" placeholder="Si se deja vacía, la cuenta al haber" ${dis}><small class="bc-cxp" data-cxp>${cxp ? esc(cxp.nombre) : ''}</small></label>
                <label class="campo bc-desc"><span>Descripción</span><input name="descripcion" value="${esc(v.descripcion || '')}" maxlength="200" ${dis}></label>
                ${!disC ? '<button type="button" class="boton secundario-sm" data-accion="contabilizar"><i class="ti ti-calculator" aria-hidden="true"></i> Contabilizar</button><button type="button" class="boton secundario-sm" data-accion="linea"><i class="ti ti-plus" aria-hidden="true"></i> Línea</button>' : ''}
              </div>
              <div class="pc-lineas"><table><thead><tr><th class="pc-n">Línea</th><th class="pc-cta">Cuenta</th><th>Nombre de la cuenta</th><th class="num">Debe</th><th class="num">Haber</th><th class="bm-centro">Centro</th><th>Nombre del centro</th><th></th></tr></thead>
                <tbody data-tabla="lineas">${lineas.map((l, i) => filaLinea(l, i, disC)).join('') || '<tr><td colspan="8" class="tk-vacio">Elige la transacción y presiona «Contabilizar», o agrega las líneas.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="3">Totales</td><td class="num" data-total="debe"></td><td class="num" data-total="haber"></td><td colspan="3"></td></tr></tfoot></table></div>
            </div>
            <div class="bm-panel" data-panel="PAGOS" ${pestana === 'PAGOS' ? '' : 'hidden'}>
              <div class="pc-lineas"><table><thead><tr><th>Tipo</th><th>Número</th><th>Fecha</th><th>Cuenta</th><th>A favor de</th><th>Estado</th><th class="num">Abono</th><th class="num">Abono en la compra</th></tr></thead>
                <tbody>${pagos.map((d) => { const m = d.movimientos_bancarios || {}; const cb = cuentas.find((x) => x.id === m.cuenta_bancaria_id); return `<tr class="${m.estado === 'ANULADO' ? 'pc-anulada' : ''}"><td>${m.tipo === 'CHEQUE' ? 'Cheque' : 'Transferencia'}</td><td class="fuerte">${esc(m.numero_documento || m.folio)}</td><td>${esc(fmt.fechaDia(m.fecha))}</td><td>${esc(cb ? cb.numero : '')}</td><td>${esc(m.deposito_por || '')}</td><td>${esc(m.estado || '')}</td><td class="num">${esc(simbolo(m.moneda_id))} ${fmt.monto(d.abono)}</td><td class="num">${esc(sim)} ${fmt.monto(d.abono_compra)}</td></tr>`; }).join('')
                  || '<tr><td colspan="8" class="tk-vacio">Todavía no tiene pagos: se paga con Generación cheques o Generación transferencias.</td></tr>'}</tbody></table></div>
            </div>
            <div class="bm-panel bm-listado" data-panel="LISTADO" ${pestana === 'LISTADO' ? '' : 'hidden'}></div>
          </section>
          <datalist id="bc-cuentas">${contables.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('')}</datalist>
          <datalist id="bc-centros">${centros.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('')}</datalist>
        </form>`;
      ctx.pDet.querySelector('[data-panel=LISTADO]').appendChild(ctx.pMae);
      totalizar();
    }

    function filaLinea(l, i, dis) {
      const k = contable(l.cuenta_id);
      const cc = centros.find((x) => x.id === l.centro_id);
      return `<tr data-linea="${i}">
        <td class="pc-n">${i + 1}</td>
        <td class="pc-cta"><input list="bc-cuentas" data-campo="cuenta" value="${esc(k ? k.codigo : l.codigo || '')}" ${dis} aria-label="Cuenta"></td>
        <td class="pc-nombre" data-nombre>${k ? esc(k.nombre) : l.codigo ? '<span class="oc-pendiente">Cuenta pendiente: no existe en el catálogo</span>' : ''}</td>
        <td class="num"><input type="number" step="0.01" min="0" data-campo="debe" value="${l.debe || ''}" ${dis} aria-label="Debe"></td>
        <td class="num"><input type="number" step="0.01" min="0" data-campo="haber" value="${l.haber || ''}" ${dis} aria-label="Haber"></td>
        <td class="bm-centro"><input list="bc-centros" data-campo="centro" value="${esc(cc ? cc.codigo : l.centro_codigo || '')}" ${dis} aria-label="Centro de costo"></td>
        <td class="pc-nombre" data-nombre-centro>${cc ? esc(cc.nombre) : ''}</td>
        <td>${dis ? '' : `<button type="button" class="icono-boton" data-quitar-linea="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>`}</td></tr>`;
    }

    function leerFilas() {
      ctx.pDet.querySelectorAll('tr[data-linea]').forEach((tr) => {
        const l = lineas[Number(tr.dataset.linea)];
        const cod = tr.querySelector('[data-campo=cuenta]').value.trim();
        const k = contables.find((x) => x.codigo === cod && x.movimiento);
        l.cuenta_id = k ? k.id : null; l.codigo = cod;
        tr.querySelector('[data-nombre]').innerHTML = k ? esc(k.nombre) : cod ? '<span class="pc-error">No es una cuenta de movimiento de la localidad</span>' : '';
        const codC = tr.querySelector('[data-campo=centro]').value.trim();
        const cc = centros.find((x) => x.codigo === codC && x.movimiento);
        l.centro_id = cc ? cc.id : null; l.centro_codigo = codC;
        tr.querySelector('[data-nombre-centro]').innerHTML = cc ? esc(cc.nombre) : codC ? '<span class="pc-error">No es un centro de movimiento</span>' : '';
        l.debe = fmt.redondear(tr.querySelector('[data-campo=debe]').value);
        l.haber = fmt.redondear(tr.querySelector('[data-campo=haber]').value);
      });
    }
    function totalizar() {
      const d = fmt.redondear(lineas.reduce((s, l) => s + Number(l.debe || 0), 0));
      const h = fmt.redondear(lineas.reduce((s, l) => s + Number(l.haber || 0), 0));
      const td = ctx.pDet.querySelector('[data-total=debe]');
      if (!td) return;
      td.textContent = fmt.monto(d);
      ctx.pDet.querySelector('[data-total=haber]').textContent = fmt.monto(h);
      ctx.pDet.querySelector('[data-cuadre]').innerHTML = !lineas.length ? '' : d === h && d > 0 ? '<span class="pc-cuadre ok"><i class="ti ti-circle-check" aria-hidden="true"></i> Cuadra</span>' : `<span class="pc-cuadre no"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Diferencia ${fmt.monto(Math.abs(d - h))}</span>`;
    }

    function leer(form) {
      const el = form.elements;
      const t = (n) => el[n].value.trim() || null;
      const num = (n) => fmt.redondear(el[n].value);
      const cxp = contables.find((x) => x.codigo === el.cuenta_pagar.value.trim() && x.movimiento);
      return {
        tipo_documento: el.tipo_documento.value, serie: t('serie'), documento: el.documento.value.trim(),
        fecha_documento: el.fecha_documento.value, fecha_ingreso: el.fecha_ingreso.value, fecha_vencimiento: el.fecha_vencimiento.value || null,
        tipo_tercero: el.tipo_tercero.value, proveedor_codigo: t('proveedor_codigo'), proveedor_nombre: el.proveedor_nombre.value.trim(), nit: t('nit'), beneficiario: t('beneficiario'),
        transaccion_id: el.transaccion_id.value ? Number(el.transaccion_id.value) : null, descripcion: t('descripcion'),
        moneda_id: Number(el.moneda_id.value), tipo_cambio: Number(el.tipo_cambio.value) || 1,
        valor_total: num('valor_total'), bonificaciones: num('bonificaciones'), notas_credito: num('notas_credito'), descuentos_nd: num('descuentos_nd'),
        forma_pago: form.querySelector('[name=forma_pago]:checked')?.value || 'CHEQUE',
        cuenta_bancaria_id: el.cuenta_bancaria_id.value ? Number(el.cuenta_bancaria_id.value) : null,
        banco_destino_id: el.banco_destino_id.value ? Number(el.banco_destino_id.value) : null, cuenta_destino: t('cuenta_destino'),
        cuenta_pagar_id: cxp ? cxp.id : null, _cxp: el.cuenta_pagar.value.trim()
      };
    }

    function actualizarImporte(form) {
      const v = leer(form);
      const neto = fmt.redondear(v.valor_total - v.bonificaciones - v.notas_credito - v.descuentos_nd);
      const sim = simbolo(v.moneda_id);
      form.querySelector('[data-neto]').textContent = `${sim} ${fmt.monto(neto)}`;
      form.querySelector('[data-pendiente]').textContent = `${sim} ${fmt.monto(neto - (actual ? Number(actual.pagado) : 0))}`;
    }

    // Detalle contable desde la transacción, sobre el valor total en quetzales.
    async function contabilizar() {
      const form = ctx.pDet.querySelector('.bc-form');
      const v = leer(form);
      const error = form.querySelector('.modal-error');
      if (!v.transaccion_id) { error.textContent = 'Elige la transacción con la que se contabiliza la compra.'; return; }
      if (!v.valor_total) { error.textContent = 'Escribe el valor total de la compra.'; return; }
      const { data } = await sb.from('transaccion_cuentas').select('*').eq('transaccion_id', v.transaccion_id).order('orden').order('linea');
      if (!data?.length) { error.textContent = 'La transacción no tiene cuentas: defínelas en Objetos contables · Transacciones.'; return; }
      const total = fmt.redondear(v.valor_total * v.tipo_cambio);
      const subtotal = fmt.redondear(total / (1 + IVA));
      const monto = (op) => op === 'TOTAL' ? total : op === 'SUBTOTAL' ? subtotal : op === 'IMPUESTO' ? fmt.redondear(total - subtotal) : 0;
      leerFilas();
      lineas = data.map((t) => {
        const k = contables.find((x) => x.id === t.cuenta_id);
        const m = monto(t.operacion);
        return { cuenta_id: k && k.movimiento ? k.id : null, codigo: k ? k.codigo : '', centro_id: t.centro_id || null, debe: t.naturaleza === 'D' ? m : 0, haber: t.naturaleza === 'H' ? m : 0 };
      });
      pestana = 'CONTABLE';
      pintarDetalle({ ...(actual || {}), ...v });
      window.FIN.aviso('Detalle contable armado con la transacción');
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      leerFilas();
      const v = leer(form);
      const foco = (n, txt) => { error.textContent = txt; form.elements[n]?.focus(); };
      if (!v.documento) return foco('documento', 'Escribe el número del documento.');
      if (!v.proveedor_nombre) return foco('proveedor_nombre', 'Escribe el nombre del proveedor.');
      if (!(v.valor_total > 0)) return foco('valor_total', 'Escribe el valor total de la compra.');
      if (v.valor_total - v.bonificaciones - v.notas_credito - v.descuentos_nd < 0) return foco('bonificaciones', 'Las bonificaciones, notas y descuentos pasan del valor total.');
      if (!v.fecha_ingreso) return foco('fecha_ingreso', 'Escribe la fecha de ingreso.');
      if (v._cxp && !v.cuenta_pagar_id) { pestana = 'CONTABLE'; return foco('cuenta_pagar', 'La cuenta por pagar no es una cuenta de movimiento de la localidad.'); }
      if (v.forma_pago === 'TRANSFERENCIA' && !v.cuenta_destino) return foco('cuenta_destino', 'Para pagar por transferencia escribe la cuenta bancaria del proveedor.');
      if (lineas.some((l) => (l.debe || l.haber || l.codigo) && !l.cuenta_id)) { error.textContent = 'Hay líneas con una cuenta que no es de movimiento: corrígelas o quítalas.'; return; }
      const ls = lineas.filter((l) => l.cuenta_id && (l.debe || l.haber));
      // La cuenta por pagar, si no se escribió, es la cuenta al haber del detalle contable.
      if (!v.cuenta_pagar_id) v.cuenta_pagar_id = ls.find((l) => l.haber)?.cuenta_id || null;
      delete v._cxp;
      error.textContent = '';
      const boton = form.querySelector('[type=submit]');
      if (boton) boton.disabled = true;
      try {
        let id = actual?.id;
        if (actual) {
          const r = await sb.from('compras').update(v).eq('id', id);
          if (r.error) throw r.error;
        } else {
          const r = await sb.from('compras').insert({ ...v, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id, numero').single();
          if (r.error) throw r.error;
          id = r.data.id;
          if (f.estado !== 'POR PAGAR' && f.estado !== 'TODAS') { f.estado = 'POR PAGAR'; pintarFiltros(); }
        }
        if (!actual?.partida_id) {
          const d = await sb.from('compra_lineas').delete().eq('compra_id', id);
          if (d.error) throw d.error;
          if (ls.length) { const r = await sb.from('compra_lineas').insert(ls.map((l, i) => ({ compra_id: id, linea: i + 1, cuenta_id: l.cuenta_id, centro_id: l.centro_id || null, debe: l.debe || 0, haber: l.haber || 0 }))); if (r.error) throw r.error; }
        }
        window.FIN.aviso(actual ? 'Compra guardada' : 'Compra registrada');
        actual = { id };
        modificando = false;
        await consultar();
      } catch (err) {
        error.textContent = /compras_documento_key/.test(err.message || '') ? 'Ese documento ya está registrado para el proveedor.' : window.UI.traducirError(err);
      } finally {
        if (boton) boton.disabled = false;
      }
    }

    async function procesar(accion) {
      let motivo = null;
      if (accion === 'ANULAR') { motivo = prompt(`Motivo de la anulación de la compra ${actual.numero}:`); if (motivo === null) return; }
      if (accion === 'PARTIDA' && !confirm(`¿Generar la partida de compras de la compra ${actual.numero}?`)) return;
      const { data, error } = await sb.rpc('procesar_compra', { p_id: actual.id, p_accion: accion, p_motivo: motivo });
      if (error) { const e = ctx.pDet.querySelector('.modal-error'); if (e) e.textContent = window.UI.traducirError(error); return; }
      window.FIN.aviso(accion === 'ANULAR' ? 'Compra anulada' : `Partida ${data?.partida || ''} generada`);
      await consultar();
    }

    function imprimirCompra() {
      const c = actual;
      const sim = simbolo(c.moneda_id);
      const emp = ctx.localidad(c.localidad_id);
      imprimir(`Compra ${c.numero}`, `
        <h1>Compra ${c.numero} · ${esc(docTxt(c))}</h1>
        <h2>${esc(emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '')} · ${esc(ESTADO_PAGO(c))}</h2>
        <div class="cab">
          <div><b>Proveedor</b>${esc([c.proveedor_codigo, c.proveedor_nombre].filter(Boolean).join(' · '))}</div><div><b>NIT</b>${esc(c.nit || '')}</div><div><b>Fecha documento</b>${esc(fmt.fechaDia(c.fecha_documento))}</div><div><b>Fecha ingreso</b>${esc(fmt.fechaDia(c.fecha_ingreso))}</div>
          <div><b>Valor total</b>${esc(sim)} ${fmt.monto(c.valor_total)}</div><div><b>Bonificaciones</b>${fmt.monto(c.bonificaciones)}</div><div><b>Notas de crédito</b>${fmt.monto(c.notas_credito)}</div><div><b>Descuentos ND</b>${fmt.monto(c.descuentos_nd)}</div>
          <div><b>Neto</b>${esc(sim)} ${fmt.monto(c.neto)}</div><div><b>Pagado</b>${fmt.monto(c.pagado)}</div><div><b>Pendiente</b>${fmt.monto(c.pendiente)}</div><div><b>Forma de pago</b>${esc(c.forma_pago)}</div>
          <div style="grid-column:1/-1"><b>Descripción</b>${esc(c.descripcion || '')}</div></div>
        ${lineas.length ? `<h3>Detalle contable</h3><table><thead><tr><th>Cuenta</th><th>Nombre</th><th class="n">Debe</th><th class="n">Haber</th></tr></thead><tbody>${lineas.map((l) => { const k = contable(l.cuenta_id); return `<tr><td>${esc(k?.codigo || '')}</td><td>${esc(k?.nombre || '')}</td><td class="n">${l.debe ? fmt.monto(l.debe) : ''}</td><td class="n">${l.haber ? fmt.monto(l.haber) : ''}</td></tr>`; }).join('')}</tbody></table>` : ''}
        <div class="firmas"><div>Elaboró</div><div>Revisó</div><div>Autorizó</div></div>`);
    }

    // ---------- Eventos ----------
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { pintarFiltros(); return cargarLocalidad(); }
      if (cambio === 'otro') {
        f[e.target.name] = e.target.value;
        if (f.hasta < f.desde) { if (e.target.name === 'desde') f.hasta = f.desde; else f.desde = f.hasta; }
        pintarFiltros(); actual = null;
        return consultar();
      }
      const form = e.target.closest('.bc-form');
      if (!form) return;
      if (e.target.name === 'moneda_id') form.elements.tipo_cambio.value = ctx.moneda(Number(e.target.value))?.cambio || 1;
      if (['moneda_id', 'tipo_cambio', 'valor_total', 'bonificaciones', 'notas_credito', 'descuentos_nd'].includes(e.target.name)) actualizarImporte(form);
      if (e.target.name === 'cuenta_pagar') {
        const k = contables.find((x) => x.codigo === e.target.value.trim() && x.movimiento);
        form.querySelector('[data-cxp]').innerHTML = k ? esc(k.nombre) : e.target.value.trim() ? '<span class="pc-error">No es una cuenta de movimiento</span>' : '';
      }
      if (e.target.closest('tr[data-linea]')) { leerFilas(); totalizar(); }
    });
    cont.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar]')) {
        buscar = e.target.value;
        const pos = e.target.selectionStart;
        pintarMaestro();
        const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
        return;
      }
      const form = e.target.closest('.bc-form');
      if (form && ['valor_total', 'bonificaciones', 'notas_credito', 'descuentos_nd', 'tipo_cambio'].includes(e.target.name)) actualizarImporte(form);
      if (e.target.closest('tr[data-linea]') && e.target.type === 'number') { leerFilas(); totalizar(); }
    });
    cont.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-buscar]')) e.preventDefault(); });
    cont.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-pestana]');
      if (tab) {
        pestana = tab.dataset.pestana;
        ctx.pDet.querySelectorAll('[data-pestana]').forEach((b) => { b.classList.toggle('activa', b === tab); b.setAttribute('aria-selected', b === tab); });
        ctx.pDet.querySelectorAll('[data-panel]').forEach((x) => { x.hidden = x.dataset.panel !== pestana; });
        return;
      }
      const fila = e.target.closest('tr[data-compra]');
      if (fila) { pestana = 'CONTABLE'; return abrir(compras.find((c) => String(c.id) === fila.dataset.compra)); }
      const ql = e.target.closest('[data-quitar-linea]');
      if (ql) { leerFilas(); lineas.splice(Number(ql.dataset.quitarLinea), 1); return repintar(); }
      const ac = e.target.closest('[data-accion]');
      if (!ac) return;
      const a = ac.dataset.accion;
      if (a === 'nuevo') { actual = null; modificando = false; lineas = []; pagos = []; pestana = 'CONTABLE'; pintarDetalle(); return ctx.pDet.querySelector('[name=documento]')?.focus(); }
      if (a === 'modificar') { modificando = true; return repintar(); }
      if (a === 'cancelar') return abrir(actual);
      if (a === 'imprimir') return imprimirCompra();
      if (a === 'contabilizar') return contabilizar();
      if (a === 'linea') { leerFilas(); lineas.push({ cuenta_id: null, codigo: '', centro_id: null, debe: 0, haber: 0 }); return repintar(); }
      if (a === 'anular') return procesar('ANULAR');
      if (a === 'partida') return procesar('PARTIDA');
    });
    function repintar() {
      const form = ctx.pDet.querySelector('.bc-form');
      if (!form) return;
      leerFilas();
      const v = leer(form);
      delete v._cxp;
      pintarDetalle({ ...(actual || {}), ...v });
    }
    cont.addEventListener('submit', (e) => { if (e.target.matches('.bc-form')) { e.preventDefault(); guardar(e.target); } });

    iniciar();
  };
})();
