// Facturación/Ventas · Registros · Recibos: el recibo de cobro de un cliente (diseño del sistema anterior).
//   Encabezado: serie y recibo físico, fecha, estado (EMITIDO, LIQUIDADO o ANULADO), moneda y valor de cambio, valor
//   y valor MI, saldo disponible; cliente, descripción, observaciones y vendedor; forma y tipo de pago, cuenta, banco,
//   documento y su valor; quién lo ingresó. Acciones: modificar, anular, eliminar e imprimir (original o copia, con
//   firma y sello digital).
//   Pestañas: «Facturas» (asignar las facturas con saldo del cliente, abono de cada una, retención, liquidar,
//   gastos administrativos, notas de crédito aplicadas y recibo asociado) y «Recibos» (los recibos del cliente).
//   Cada factura pagada es una fila de factura_venta_pagos ligada al recibo: el saldo de la factura baja al guardar.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const FORMAS = ['EFECTIVO', 'CHEQUE', 'DEPÓSITO', 'TRANSFERENCIA', 'TARJETA', 'NOTA DE CRÉDITO'];
  const TIPOS_PAGO = ['CANCELACIÓN', 'ABONO', 'ANTICIPO'];
  const PESTANAS = [['FACTURAS', 'Facturas', 'ti-file-invoice'], ['RECIBOS', 'Recibos', 'ti-receipt-2']];

  // Recibos, Retenciones y Exenciones: la misma pantalla con su clase, su serie y sus textos.
  const CLASES = {
    recibos: { clase: 'RECIBO', titulo: 'Recibos', nombre: 'Recibo', nuevo: 'Nuevo recibo', fisico: 'Recibo físico', serie: 'DIG', icono: 'ti-receipt-2' },
    retenciones: { clase: 'RETENCIÓN', titulo: 'Retenciones', nombre: 'Retención', nuevo: 'Nueva retención', fisico: 'Retención física', serie: 'RET', icono: 'ti-receipt-tax', retencion: true },
    exenciones: { clase: 'EXENCIÓN', titulo: 'Exenciones', nombre: 'Exención', nuevo: 'Nueva exención', fisico: 'Exención física', serie: 'EXE', icono: 'ti-shield-check' }
  };
  const RUTA = { RECIBO: 'recibos', 'RETENCIÓN': 'retenciones', 'EXENCIÓN': 'exenciones' };
  Object.entries(CLASES).forEach(([clave, cfg]) => { window.PANTALLAS[clave] = (cont, m, extra) => pantalla(cont, m, extra, cfg); });

  function pantalla(cont, m, extra, cfg) {
    const ctx = montar(cont, { titulo: cfg.titulo, icono: cfg.icono, clase: 'bk-movimientos bm-solo vf-facturas vr-recibos', grupo: 'Ventas · Registros' });
    const { sb } = ctx;
    let clientes = [], vendedores = [], series = [], conClase = false, locCargada = null;
    let actual = null, modificando = false, pestana = 'FACTURAS', serieLibre = false, tipoImp = 'ORIGINAL';
    let lineas = [], asociado = null, listado = null, listaTexto = '';

    const cliente = (id) => clientes.find((c) => c.id === id);
    const sim = (id) => ctx.moneda(id)?.simbolo || 'Q';
    const gtq = () => ctx.monedas.find((x) => x.iso === 'GTQ');
    const nombreFac = (f) => f ? (f.serie ? `${f.serie}-${f.numero_dte || ''}` : `Interna ${f.numero}`) : '';
    const estadoDe = (r) => !r ? ['pendiente', 'Sin registrar'] : r.estado === 'ANULADO' ? ['anulada', 'ANULADO'] : r.situacion === 'LIQUIDADO' ? ['aprobada', 'LIQUIDADO'] : ['definitiva', 'EMITIDO'];
    const editable = () => ctx.admin && (!actual || (modificando && actual.estado !== 'ANULADO'));

    function pintarFiltros() {
      ctx.filtros(`<label class="campo vr-ir"><span>Recibo No.</span><input name="ir_recibo" inputmode="numeric" placeholder="Número" autocomplete="off"></label>`, '');
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('recibos_venta').select('id, numero').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/numero|recibos_venta/.test(prueba.error.message) ? 'Falta instalar los scripts 132 (recibos de cobro) y 133 (pantallas de recibos) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      pintarFiltros();
      await cargarLocalidad();
      if (extra && /^\d+$/.test(String(extra))) {
        const { data } = await sb.from('recibos_venta').select('*').eq('id', Number(extra)).maybeSingle();
        if (data && data.clase && data.clase !== cfg.clase && RUTA[data.clase]) { location.hash = `#/facturacion/${RUTA[data.clase]}/${data.id}`; return; }
        if (data) return abrir(data);
      }
      // Desde Facturas Ventas («Registrar recibo»): recibo nuevo con el cliente, el saldo y la factura.
      const mf = /^factura-(\d+)$/.exec(String(extra || ''));
      if (mf) {
        const { data: fa } = await sb.from('facturas_venta').select('id, numero, serie, numero_dte, nombre, fecha_emision, total, saldo, estado, cliente_id, vendedor_id, localidad_id, organizacion_id, moneda_id, tipo_cambio').eq('id', Number(mf[1])).maybeSingle();
        if (fa) {
          if (fa.localidad_id !== locCargada) { ctx.sel.loc = fa.localidad_id; ctx.sel.org = fa.organizacion_id; pintarFiltros(); await cargarLocalidad(); }
          await abrir(null);
          lineas = Number(fa.saldo) > 0 ? [{ factura_id: fa.id, factura: fa, saldo: Number(fa.saldo), abono: Number(fa.saldo) }] : [];
          return pintar({ ...valoresNuevos(), cliente_id: fa.cliente_id, nombre: fa.nombre, vendedor_id: fa.vendedor_id, valor: Number(fa.saldo) || 0, descripcion: `PAGO DE FACTURA ${fa.serie ? `${fa.serie}-${fa.numero_dte || ''}` : fa.numero}` });
        }
      }
      // Abre con el último documento de la clase y el listado (incluye los migrados del sistema anterior).
      let ult = sb.from('recibos_venta').select('*').eq('localidad_id', ctx.sel.loc || 0);
      if (conClase) ult = ult.eq('clase', cfg.clase);
      const { data: u } = await ult.order('fecha', { ascending: false }).order('numero', { ascending: false }).limit(1);
      if (u?.[0]) { pestana = 'RECIBOS'; await abrir(u[0]); listaTexto = ''; listado = null; await cargarListado(); return pintar(); }
      abrir(null);
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc || 0;
      locCargada = loc;
      const [c, v] = await Promise.all([
        sb.from('clientes').select('id, codigo, nombre, documento, tipo_documento, direccion, vendedor_id, estado').eq('localidad_id', loc).order('nombre'),
        sb.from('vendedores').select('id, codigo, nombre, activo').eq('localidad_id', loc).order('codigo')
      ]);
      clientes = c.data || []; vendedores = v.data || [];
      // Series de la clase (script 138); sin él, la serie se escribe libre.
      const se = await sb.from('series_recibo').select('serie, recibo_inicial, principal, tipo, mostrar').eq('localidad_id', loc).eq('tipo', cfg.clase).order('serie');
      conClase = !se.error; series = se.data || [];
    }
    const serieDef = () => (series.find((x) => x.principal) || series.find((x) => x.mostrar) || {}).serie || cfg.serie;

    async function abrir(r) {
      if (r && r.localidad_id !== locCargada) { ctx.sel.loc = r.localidad_id; ctx.sel.org = r.organizacion_id; pintarFiltros(); await cargarLocalidad(); }
      else if (r && ctx.pFil.querySelector('[name=loc]')?.value !== String(r.localidad_id)) pintarFiltros();
      const otro = !r || r.cliente_id !== actual?.cliente_id;
      actual = r; modificando = false; serieLibre = false; lineas = []; asociado = null;
      if (otro) { listado = null; listaTexto = r?.nombre || ''; }
      if (r) {
        const [p, a] = await Promise.all([
          sb.from('factura_venta_pagos').select('*, facturas_venta(id, numero, serie, numero_dte, nombre, fecha_emision, total, saldo, estado)').eq('recibo_id', r.id).order('id'),
          r.recibo_asociado_anterior ? sb.from('recibos_venta').select('*').eq('localidad_id', r.localidad_id).eq('numero', r.recibo_asociado_anterior).maybeSingle() : Promise.resolve({ data: null })
        ]);
        lineas = (p.data || []).map((x) => ({ id: x.id, factura_id: x.factura_id, factura: x.facturas_venta, abono: Number(x.valor || 0), saldo: Number(x.facturas_venta?.saldo || 0) + Number(x.valor || 0), nota: x.nota_anterior, retencion: Number(x.valor_retencion || 0), migrada: x.origen_anterior === 'MIGRADO' }));
        asociado = a.data || null;
        if (pestana === 'RECIBOS' && !listado) await cargarListado();
      }
      pintar();
    }

    const valoresNuevos = () => {
      const q = gtq();
      return { serie: serieDef(), recibo_fisico: '', fecha: fmt.hoy(), moneda_id: q?.id || null, tipo_cambio: 1, valor: 0, cliente_id: null, nombre: '', descripcion: '', observaciones: '', vendedor_id: null,
        forma: 'TRANSFERENCIA', tipo_pago: 'CANCELACIÓN', cuenta_bancaria: '', banco: '', documento: '', valor_documento: 0, incluir_retencion: !!cfg.retencion, tipo_retencion: 'IVA', pct_retencion: cfg.retencion ? 25 : 0, valor_retencion: 0,
        gasto_fecha: fmt.hoy(), gasto_concepto: '', gasto_valor: 0, firma_digital: true, situacion: 'EMITIDO' };
    };

    function pintar(v0) {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-receipt-2'); return; }
      const r = actual;
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const v = v0 || (r ? { ...r } : valoresNuevos());
      const tc = Number(v.tipo_cambio || 1) || 1;
      const abonos = fmt.redondear(lineas.reduce((t, x) => t + Number(x.abono || 0), 0));
      const disponible = fmt.redondear(Number(v.valor || 0) - abonos - Number(v.gasto_valor || 0));
      const [cls, txt] = estadoDe(r);
      const c = cliente(v.cliente_id);
      const puede = ctx.admin && r && r.estado !== 'ANULADO' && !modificando;
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form bm-form vf-form vr-form" novalidate>
          <header class="tk-titulo bm-titulo">
            <div class="tk-titulo-texto"><small>${esc(cfg.titulo)} · ${esc(ctx.localidad(r?.localidad_id || ctx.sel.loc)?.codigo || '')} ${esc(ctx.localidad(r?.localidad_id || ctx.sel.loc)?.nombre_comercial || '')}</small><h2>${r ? `${esc(cfg.nombre)} ${esc([r.serie, r.recibo_fisico].filter((x) => x != null && x !== '').join('-') || r.numero)}` : esc(cfg.nuevo)}</h2></div>
            <div class="tk-marcas"><span class="pc-marca ${cls}">${txt}</span>${modificando ? ' <span class="pc-marca pendiente"><i class="ti ti-pencil" aria-hidden="true"></i> Modificando</span>' : ''}</div>
            <div class="tk-titulo-acciones">
              <a class="boton secundario-sm" href="#/facturacion/consulta-de-recibos"><i class="ti ti-file-search" aria-hidden="true"></i> Consulta</a>
              ${ctx.admin && !modificando ? `<button type="button" class="boton ${ed ? 'secundario-sm' : 'primario-sm'}" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>` : ''}
              ${modificando ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}
              ${ed ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${r ? 'Guardar cambios' : 'Registrar'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          ${r?.estado === 'ANULADO' ? `<p class="tk-aviso bm-anulado"><i class="ti ti-ban" aria-hidden="true"></i> Anulado${r.anulado_por ? ` por ${esc(r.anulado_por)}` : ''}${r.anulado_en ? ` el ${esc(fmt.fechaHora(r.anulado_en))}` : ''}${r.motivo_anulacion ? `: ${esc(r.motivo_anulacion)}` : ''}</p>` : ''}
          <div class="vr-arriba">
            <section class="vfb-card vr-enc">
              <div class="vr-g vr-g1">
                <label class="campo"><span>Serie</span><input name="serie" list="vr-series" value="${esc(v.serie || '')}" maxlength="10" ${ed && (serieLibre || !r) ? '' : 'disabled'}></label>
                <label class="campo"><span>${esc(cfg.fisico)}</span><input name="recibo_fisico" inputmode="numeric" value="${esc(String(v.recibo_fisico ?? ''))}" ${ed && (serieLibre || !r) ? '' : 'disabled'}></label>
                <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(v.fecha || '')}" ${dis}></label>
                <label class="campo"><span>Estado</span><input value="${txt}" disabled></label>
                <label class="campo"><span>Moneda</span><select name="moneda_id" ${dis}>${ctx.monedas.map((x) => `<option value="${x.id}" ${x.id === v.moneda_id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>
                <label class="campo"><span>Valor cambio</span><input type="number" step="0.00001" min="0" name="tipo_cambio" value="${esc(String(v.tipo_cambio ?? 1))}" ${dis}></label>
              </div>
              <div class="vr-g vr-g2">
                <label class="campo"><span>Código</span><input list="vr-clientes" name="cliente_codigo" value="${esc(String(c?.codigo ?? v.cliente_codigo_anterior ?? ''))}" placeholder="Código" ${dis}></label>
                <label class="campo"><span>Nombre *</span><input name="nombre" value="${esc(v.nombre || '')}" maxlength="150" ${dis}></label>
                <label class="campo"><span>Vendedor</span><select name="vendedor_id" ${dis}><option value="">—</option>${vendedores.filter((x) => x.activo !== false || x.id === v.vendedor_id).map((x) => `<option value="${x.id}" ${x.id === v.vendedor_id ? 'selected' : ''}>${x.codigo} · ${esc(x.nombre)}</option>`).join('')}</select></label>
                <button type="button" class="boton secundario-sm vr-saldos" data-accion="ver-saldos" ${v.cliente_id ? '' : 'disabled'}><i class="ti ti-scale" aria-hidden="true"></i> Ver saldos</button>
              </div>
              <div class="vr-g vr-g3">
                <label class="campo"><span>Descripción</span><textarea name="descripcion" rows="2" maxlength="500" ${dis}>${esc(v.descripcion || '')}</textarea></label>
                <label class="campo"><span>Observaciones</span><textarea name="observaciones" rows="2" maxlength="500" ${dis}>${esc(v.observaciones || '')}</textarea></label>
              </div>
              <div class="vr-g vr-g4">
                <label class="campo"><span>Forma de pago</span><select name="forma" ${dis}>${FORMAS.map((x) => `<option ${v.forma === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
                <label class="campo"><span>Tipo de pago</span><select name="tipo_pago" ${dis}>${TIPOS_PAGO.map((x) => `<option ${v.tipo_pago === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
                <label class="campo"><span>Cuenta</span><input name="cuenta_bancaria" value="${esc(v.cuenta_bancaria || '')}" maxlength="40" ${dis}></label>
                <label class="campo"><span>Banco</span><input name="banco" value="${esc(v.banco || '')}" maxlength="60" ${dis}></label>
                <label class="campo"><span>Documento</span><input name="documento" value="${esc(v.documento || '')}" maxlength="60" ${dis}></label>
                <label class="campo"><span>Valor documento</span><input type="number" step="0.01" min="0" name="valor_documento" value="${esc(String(v.valor_documento ?? ''))}" ${dis}></label>
              </div>
              <datalist id="vr-series">${series.filter((x) => x.mostrar).map((x) => `<option value="${esc(x.serie)}"></option>`).join('')}</datalist>
              <datalist id="vr-clientes">${clientes.filter((x) => x.estado !== 'INACTIVO').map((x) => `<option value="${esc(x.nombre)}${x.tipo_documento !== 'CF' && x.documento ? ` · NIT ${esc(x.documento)}` : ''} — ${x.codigo}"></option>`).join('')}</datalist>
            </section>
            <aside class="vr-lado">
              <section class="vfb-card vfb-resumen vr-valor">
                <label class="vr-valor-campo"><span>Valor</span>${ed ? `<input type="number" step="0.01" min="0" name="valor" value="${esc(String(v.valor ?? ''))}">` : `<b class="vr-valor-num">${esc(sim(v.moneda_id))} ${fmt.monto(v.valor)}</b><input type="hidden" name="valor" value="${esc(String(v.valor ?? 0))}">`}</label>
                <div><span>Valor MI</span><b data-calc="mi">${fmt.monto(Number(v.valor || 0) / tc)}</b></div>
                <div><span>Facturas</span><b data-calc="abonos">${fmt.monto(abonos)}</b></div>
                <div class="${disponible < 0 ? 'vf-saldo' : ''}" data-disp><span>Saldo disponible</span><b data-calc="disponible">${fmt.monto(disponible)}</b></div>
                <div class="vr-ingreso"><span>Ingreso</span><b>${esc(r ? (r.usuario || '') : (ctx.yo.usuario || '').toUpperCase())} · ${esc(fmt.fechaHora(r ? (r.fecha_ingreso || r.creado_en) : new Date().toISOString()))}</b></div>
              </section>
              <section class="vfb-card vr-acciones">
                <div class="vr-acc-col">
                  <button type="button" class="boton secundario-sm" data-accion="modificar" ${puede ? '' : 'disabled'}><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>
                  <button type="button" class="boton secundario-sm rp-peligro" data-accion="anular" ${puede ? '' : 'disabled'}><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>
                  <button type="button" class="boton secundario-sm rp-peligro" data-accion="eliminar" ${ctx.admin && r && !modificando ? '' : 'disabled'}><i class="ti ti-trash" aria-hidden="true"></i> Eliminar</button>
                  <label class="pc-check"><input type="checkbox" name="serie_libre" ${serieLibre ? 'checked' : ''} ${ed ? '' : 'disabled'}> Habilitar serie</label>
                </div>
                <div class="vr-acc-col">
                  <button type="button" class="boton secundario-sm" data-accion="imprimir" ${r ? '' : 'disabled'}><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>
                  <label class="campo"><span>Tipo</span><select name="tipo_impresion">${['ORIGINAL', 'COPIA'].map((x) => `<option ${tipoImp === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
                  <label class="pc-check"><input type="checkbox" name="firma_digital" ${v.firma_digital !== false ? 'checked' : ''} ${dis}> Firma y sello digital</label>
                </div>
              </section>
            </aside>
          </div>
          <section class="bm-pestanas">
            <div class="bm-tabs-barra">
              <div class="rp-pestanas" role="tablist">${PESTANAS.map(([k, t, i]) => `<button type="button" role="tab" data-pestana="${k}" class="${pestana === k ? 'activa' : ''}" aria-selected="${pestana === k}"><i class="ti ${i}" aria-hidden="true"></i> ${t}${k === 'FACTURAS' ? ` <b>${lineas.length}</b>` : ''}</button>`).join('')}</div>
              <span class="vf-tab-acc">${pestana === 'FACTURAS' ? `
                <button type="button" class="boton secundario-sm" data-accion="asignar" ${ed && v.cliente_id ? '' : 'disabled'}><i class="ti ti-file-plus" aria-hidden="true"></i> Asignar facturas</button>
                <label class="pc-check"><input type="checkbox" name="incluir_retencion" ${v.incluir_retencion ? 'checked' : ''} ${dis}> Retención</label>
                <label class="campo vr-in"><span>Tipo ret.</span><select name="tipo_retencion" ${dis}>${['IVA', 'ISR'].map((x) => `<option ${(v.tipo_retencion || 'IVA') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
                <label class="campo vr-in"><span>% ret.</span><input type="number" step="0.01" min="0" max="100" name="pct_retencion" value="${esc(String(v.pct_retencion ?? ''))}" ${dis}></label>
                <label class="campo vr-in"><span>Valor ret.</span><input type="number" step="0.01" min="0" name="valor_retencion" value="${esc(String(v.valor_retencion ?? ''))}" ${dis}></label>
                <button type="button" class="boton primario-sm" data-accion="liquidar" ${puede && r.situacion !== 'LIQUIDADO' ? '' : 'disabled'}><i class="ti ti-checks" aria-hidden="true"></i> Liquidar facturas</button>` : ''}</span>
            </div>
            <div class="bm-panel vr-panel-fac" data-panel="FACTURAS" ${pestana === 'FACTURAS' ? '' : 'hidden'}>
              <div class="vr-fac">
                <div class="pc-lineas"><table class="vr-lineas"><thead><tr><th class="pc-n">#</th><th class="vr-c-fac">No. factura</th><th>Nombre factura</th><th class="vr-c-fecha">Fecha</th><th class="num vr-c-m">Valor factura</th><th class="num vr-c-m">Saldo factura</th><th class="num vr-c-m">Valor abono</th><th class="vr-c-chk">Liquidada</th><th class="pq-x"></th></tr></thead>
                  <tbody>${lineas.map((x, i) => { const liq = x.abono > 0 && x.abono >= x.saldo - 0.005; return `<tr data-linea="${i}">
                    <td class="pc-n">${i + 1}</td><td class="fuerte"><a class="vf-p-link" href="#/facturacion/facturas-ventas/${x.factura_id}" title="Abrir la factura en Facturas Ventas">${esc(nombreFac(x.factura))}</a><small class="cq-ant">interno ${x.factura?.numero ?? ''}</small></td>
                    <td class="cc-nombre">${esc(x.factura?.nombre || '')}</td><td>${esc(fmt.fechaDia(String(x.factura?.fecha_emision || '').slice(0, 10)))}</td>
                    <td class="num">${fmt.monto(x.factura?.total)}</td><td class="num">${fmt.monto(x.saldo)}</td>
                    <td class="num">${ed ? `<input type="number" step="0.01" min="0" data-abono value="${x.abono || ''}">` : `<b>${fmt.monto(x.abono)}</b>`}</td>
                    <td class="vr-c-chk" data-liq>${liq ? '<i class="ti ti-circle-check pc-verde" aria-label="Liquidada"></i>' : ''}</td>
                    <td class="pq-x">${ed ? `<button type="button" class="icono-boton" data-quitar="${i}" aria-label="Quitar la factura"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`; }).join('') || `<tr><td colspan="9" class="tk-vacio">${ed ? 'Elige el cliente y pulsa «Asignar facturas» para traer sus facturas con saldo.' : 'El recibo no tiene facturas.'}</td></tr>`}</tbody>
                  <tfoot><tr><td colspan="5">Totales</td><td class="num">${fmt.monto(lineas.reduce((t, x) => t + Number(x.saldo || 0), 0))}</td><td class="num" data-calc="abonos2">${fmt.monto(abonos)}</td><td colspan="2"></td></tr></tfoot></table></div>
                <div class="vr-extra">
                  <section class="vfb-card vr-gastos">
                    <h3 class="ta-col-titulo"><i class="ti ti-receipt-tax" aria-hidden="true"></i> Gastos administrativos</h3>
                    <div class="vr-g vr-g5">
                      <label class="campo"><span>Fecha</span><input type="date" name="gasto_fecha" value="${esc(v.gasto_fecha || '')}" ${dis}></label>
                      <label class="campo"><span>Concepto</span><input name="gasto_concepto" value="${esc(v.gasto_concepto || '')}" maxlength="200" ${dis}></label>
                      <label class="campo"><span>Valor</span><input type="number" step="0.01" min="0" name="gasto_valor" value="${esc(String(v.gasto_valor ?? ''))}" ${dis}></label>
                    </div>
                  </section>
                  <section class="vfb-card vr-notas">
                    <h3 class="ta-col-titulo"><i class="ti ti-file-minus" aria-hidden="true"></i> Notas de crédito en facturas</h3>
                    <div class="pc-lineas"><table><thead><tr><th>Factura</th><th>Nota</th><th>Nombre</th><th class="num">Valor aplicado</th></tr></thead>
                      <tbody>${lineas.filter((x) => x.nota).map((x) => `<tr><td>${esc(nombreFac(x.factura))}</td><td>${esc(String(x.nota))}</td><td class="cc-nombre">${esc(x.factura?.nombre || '')}</td><td class="num">${fmt.monto(x.abono)}</td></tr>`).join('') || '<tr><td colspan="4" class="tk-vacio">Sin notas de crédito.</td></tr>'}</tbody></table></div>
                  </section>
                  <section class="vfb-card vr-asociado">
                    <h3 class="ta-col-titulo"><i class="ti ti-link" aria-hidden="true"></i> Recibo asociado</h3>
                    ${asociado ? `<button type="button" class="vr-asoc" data-abrir-recibo="${asociado.id}"><b>${esc([asociado.serie, asociado.recibo_fisico].filter(Boolean).join('-'))}</b><span>${esc(fmt.fechaDia(asociado.fecha))} · ${esc(asociado.nombre || '')}</span><b>${fmt.monto(asociado.valor)}</b></button>`
                      : `<p class="cc-ingreso">${r?.recibo_asociado_anterior ? `Recibo ${esc(String(r.recibo_asociado_anterior))} (no está en el sistema).` : 'Sin recibo asociado.'}</p>`}
                  </section>
                </div>
              </div>
            </div>
            <div class="bm-panel vf-listado" data-panel="RECIBOS" ${pestana === 'RECIBOS' ? '' : 'hidden'}>${pestana === 'RECIBOS' ? panelRecibos() : ''}</div>
          </section>
        </form>`;
    }

    // Recibos del cliente (o de los clientes cuyo nombre contiene el texto).
    async function cargarListado() {
      const txt = listaTexto.trim();
      let q = sb.from('recibos_venta').select('id, numero, serie, recibo_fisico, fecha, estado, situacion, nombre, valor, forma, tipo_pago, cliente_id').eq('localidad_id', ctx.sel.loc);
      if (conClase) q = q.eq('clase', cfg.clase);
      if (actual?.cliente_id && txt === (actual.nombre || '')) q = q.eq('cliente_id', actual.cliente_id);
      else if (txt) q = q.ilike('nombre', `%${txt.replace(/[%_]/g, '')}%`);
      const { data, error } = await q.order('fecha', { ascending: false }).order('numero', { ascending: false }).limit(500);
      listado = error ? [] : (data || []);
      if (error) window.FIN.aviso(window.UI.traducirError(error));
    }
    function panelRecibos() {
      const l = listado || [];
      const vig = l.filter((x) => x.estado !== 'ANULADO');
      return `<div class="vf-lista-barra">
          <label class="campo vf-lista-cliente"><span>Consultar por cliente</span><input name="lista_texto" value="${esc(listaTexto)}" placeholder="Nombre del cliente" autocomplete="off"></label>
          <button type="button" class="boton secundario-sm" data-accion="lista-consultar"><i class="ti ti-search" aria-hidden="true"></i> Consultar</button>
          <span class="vf-lista-resumen">${listado ? `<b>${l.length}</b> ${esc(cfg.titulo.toLowerCase())} · <b>${fmt.monto(vig.reduce((t, x) => t + Number(x.valor || 0), 0))}</b> vigentes` : ''}</span>
        </div>
        <div class="pc-lineas">${!listado ? '<p class="tk-vacio">Cargando…</p>' : `<table class="vf-lista"><thead><tr><th>No.</th><th>Serie</th><th>Recibo físico</th><th>Fecha</th><th>Estado</th><th>Nombre</th><th>Forma</th><th>Tipo</th><th class="num">Valor</th></tr></thead>
          <tbody>${l.map((x) => { const [cls, txt] = estadoDe(x); return `<tr data-abrir-recibo="${x.id}" class="${x.id === actual?.id ? 'actual' : ''}" title="Abrir el recibo"><td class="fuerte">${x.numero ?? ''}</td><td>${esc(x.serie || '')}</td><td>${esc(String(x.recibo_fisico ?? ''))}</td><td>${esc(fmt.fechaDia(x.fecha))}</td><td><span class="pc-marca ${cls}">${txt}</span></td><td>${esc(x.nombre || '')}</td><td>${esc(x.forma || '')}</td><td>${esc(x.tipo_pago || '')}</td><td class="num fuerte">${fmt.monto(x.valor)}</td></tr>`; }).join('') || '<tr><td colspan="9" class="tk-vacio">No hay recibos para ese cliente.</td></tr>'}</tbody></table>`}</div>`;
    }

    // ---------- Lectura del formulario ----------
    function encabezado(form) {
      const el = form.elements;
      const t = (n) => el[n] && String(el[n].value).trim() !== '' ? String(el[n].value).trim() : null;
      const num = (n) => el[n] && el[n].value !== '' ? Number(el[n].value) : null;
      const c = clientes.find((x) => String(x.codigo) === String(el.cliente_codigo.value).trim());
      return { serie: t('serie'), recibo_fisico: num('recibo_fisico'), fecha: t('fecha'), moneda_id: num('moneda_id'), tipo_cambio: num('tipo_cambio') || 1, valor: num('valor') || 0,
        cliente_id: c ? c.id : (actual?.cliente_id && String(el.cliente_codigo.value).trim() === String(cliente(actual.cliente_id)?.codigo ?? actual.cliente_codigo_anterior ?? '') ? actual.cliente_id : null),
        nombre: t('nombre'), descripcion: t('descripcion'), observaciones: t('observaciones'), vendedor_id: num('vendedor_id'), forma: el.forma.value, tipo_pago: el.tipo_pago.value,
        cuenta_bancaria: t('cuenta_bancaria'), banco: t('banco'), documento: t('documento'), valor_documento: num('valor_documento'), firma_digital: !!el.firma_digital?.checked,
        incluir_retencion: el.incluir_retencion ? !!el.incluir_retencion.checked : !!actual?.incluir_retencion, tipo_retencion: el.tipo_retencion ? el.tipo_retencion.value : (actual?.tipo_retencion || 'IVA'),
        pct_retencion: el.pct_retencion ? num('pct_retencion') : actual?.pct_retencion ?? null, valor_retencion: el.valor_retencion ? num('valor_retencion') : actual?.valor_retencion ?? null,
        gasto_fecha: t('gasto_fecha'), gasto_concepto: t('gasto_concepto'), gasto_valor: num('gasto_valor') };
    }
    function leerLineas() {
      ctx.pDet.querySelectorAll('tr[data-linea]').forEach((tr) => {
        const x = lineas[Number(tr.dataset.linea)]; const i = tr.querySelector('[data-abono]');
        if (x && i) x.abono = fmt.redondear(Number(i.value) || 0);
      });
    }
    function repintar(cambios = {}) {
      // Las líneas ya se leyeron antes de cambiarlas (si se leyeran aquí, la pantalla anterior pisaría los cambios).
      const form = ctx.pDet.querySelector('.vr-form'); if (!form) return pintar();
      pintar({ ...(actual || valoresNuevos()), ...encabezado(form), ...cambios });
    }
    function totalizar() {
      const form = ctx.pDet.querySelector('.vr-form'); if (!form) return;
      leerLineas();
      const valor = Number(form.elements.valor.value || 0), tc = Number(form.elements.tipo_cambio.value || 1) || 1, gasto = Number(form.elements.gasto_valor?.value || 0);
      const ab = fmt.redondear(lineas.reduce((t, x) => t + Number(x.abono || 0), 0));
      const disp = fmt.redondear(valor - ab - gasto);
      const set = (k, t) => { const e = form.querySelector(`[data-calc=${k}]`); if (e) e.textContent = t; };
      set('mi', fmt.monto(valor / tc)); set('abonos', fmt.monto(ab)); set('abonos2', fmt.monto(ab)); set('disponible', fmt.monto(disp));
      form.querySelector('[data-disp]')?.classList.toggle('vf-saldo', disp < 0);
      form.querySelectorAll('tr[data-linea]').forEach((tr) => { const x = lineas[Number(tr.dataset.linea)]; const td = tr.querySelector('[data-liq]'); if (x && td) td.innerHTML = x.abono > 0 && x.abono >= x.saldo - 0.005 ? '<i class="ti ti-circle-check pc-verde" aria-label="Liquidada"></i>' : ''; });
    }

    // ---------- Acciones ----------
    async function asignar() {
      const form = ctx.pDet.querySelector('.vr-form');
      const h = encabezado(form);
      if (!h.cliente_id) return window.FIN.aviso('Elige primero el cliente (por su código)');
      leerLineas();
      const { data, error } = await sb.from('facturas_venta').select('id, numero, serie, numero_dte, nombre, fecha_emision, total, saldo, estado').eq('localidad_id', ctx.sel.loc).eq('cliente_id', h.cliente_id).eq('estado', 'FACTURADA').gt('saldo', 0).order('fecha_emision');
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      const ya = new Set(lineas.map((x) => x.factura_id));
      let disp = fmt.redondear(Number(h.valor || 0) - lineas.reduce((t, x) => t + Number(x.abono || 0), 0) - Number(h.gasto_valor || 0));
      const nuevas = (data || []).filter((f) => !ya.has(f.id));
      if (!nuevas.length) return window.FIN.aviso(lineas.length ? 'El cliente no tiene otras facturas con saldo' : 'El cliente no tiene facturas con saldo');
      for (const f of nuevas) { const ab = Math.max(0, Math.min(Number(f.saldo), disp)); disp = fmt.redondear(disp - ab); lineas.push({ factura_id: f.id, factura: f, saldo: Number(f.saldo), abono: fmt.redondear(ab) }); }
      repintar(h);
    }
    async function verSaldos() {
      const h = encabezado(ctx.pDet.querySelector('.vr-form'));
      if (!h.cliente_id) return;
      const { data } = await sb.from('facturas_venta').select('saldo').eq('localidad_id', ctx.sel.loc).eq('cliente_id', h.cliente_id).eq('estado', 'FACTURADA').gt('saldo', 0);
      const l = data || [];
      window.FIN.aviso(l.length ? `${cliente(h.cliente_id)?.nombre || h.nombre}: ${l.length} facturas con saldo, total Q ${fmt.monto(l.reduce((t, x) => t + Number(x.saldo), 0))}` : 'El cliente no tiene facturas con saldo');
    }

    async function guardar(form, liquidar = false) {
      const error = form.querySelector('.tk-error'); error.textContent = '';
      leerLineas();
      const h = encabezado(form);
      if (!h.nombre) { error.textContent = 'Escribe el nombre del cliente.'; return false; }
      if (!h.fecha) { error.textContent = 'Indica la fecha del recibo.'; return false; }
      if (!(h.valor > 0)) { error.textContent = 'El valor del recibo debe ser mayor que cero.'; return false; }
      const ab = fmt.redondear(lineas.reduce((t, x) => t + Number(x.abono || 0), 0));
      if (ab + Number(h.gasto_valor || 0) > h.valor + 0.005) { error.textContent = `Las facturas (${fmt.monto(ab)}) y los gastos suman más que el valor del recibo (${fmt.monto(h.valor)}).`; return false; }
      const exceso = lineas.find((x) => x.abono > x.saldo + 0.005);
      if (exceso) { error.textContent = `El abono a la factura ${nombreFac(exceso.factura)} es mayor que su saldo (${fmt.monto(exceso.saldo)}).`; return false; }
      const quien = (ctx.yo.usuario || '').toUpperCase();
      const datos = { ...h, valor_mi: fmt.redondear(h.valor / (h.tipo_cambio || 1)) };
      if (liquidar) datos.situacion = 'LIQUIDADO';
      let id = actual?.id;
      try {
        if (id) {
          const r = await sb.from('recibos_venta').update({ ...datos, modificado_por: quien, modificado_en: new Date().toISOString() }).eq('id', id); if (r.error) throw r.error;
        } else {
          const r = await sb.from('recibos_venta').insert({ ...datos, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, estado: 'VIGENTE', ...(conClase ? { clase: cfg.clase } : {}), situacion: liquidar ? 'LIQUIDADO' : 'EMITIDO', usuario: quien, fecha_ingreso: new Date().toISOString() }).select('id').single();
          if (r.error) throw r.error; id = r.data.id;
        }
        // Facturas: las quitadas se borran, las demás se actualizan o se agregan (los datos migrados de cada una se conservan).
        const { data: previas } = await sb.from('factura_venta_pagos').select('id, factura_id').eq('recibo_id', id);
        const quedan = new Set(lineas.filter((x) => x.abono > 0 || x.migrada).map((x) => x.factura_id));
        const quitar = (previas || []).filter((p) => !quedan.has(p.factura_id)).map((p) => p.id);
        if (quitar.length) { const d = await sb.from('factura_venta_pagos').delete().in('id', quitar); if (d.error) throw d.error; }
        const doc = `RECIBO ${[h.serie, h.recibo_fisico].filter((x) => x != null && x !== '').join('-')}`.trim();
        const filas = lineas.filter((x) => x.abono > 0 || x.migrada).map((x) => ({ factura_id: x.factura_id, recibo_id: id, fecha: h.fecha, forma: h.forma, documento: doc.slice(0, 120), banco: h.banco, valor: x.abono, usuario: quien }));
        if (filas.length) { const u = await sb.from('factura_venta_pagos').upsert(filas, { onConflict: 'recibo_id,factura_id' }); if (u.error) throw u.error; }
      } catch (e) { error.textContent = window.UI.traducirError(e); return false; }
      const o = cfg.clase === 'RECIBO' ? 'o' : 'a';
      window.FIN.aviso(`${cfg.nombre} ${liquidar ? `liquidad${o}` : actual ? `actualizad${o}` : `registrad${o}`}`);
      const { data } = await sb.from('recibos_venta').select('*').eq('id', id).single();
      listado = null;
      await abrir(data);
      return true;
    }
    async function liquidar() {
      if (!lineas.length) return window.FIN.aviso('El recibo no tiene facturas para liquidar');
      const form = ctx.pDet.querySelector('.vr-form');
      if (modificando) return guardar(form, true);
      const { error } = await sb.from('recibos_venta').update({ situacion: 'LIQUIDADO', modificado_por: (ctx.yo.usuario || '').toUpperCase(), modificado_en: new Date().toISOString() }).eq('id', actual.id);
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      window.FIN.aviso('Recibo liquidado');
      const { data } = await sb.from('recibos_venta').select('*').eq('id', actual.id).single();
      await abrir(data);
    }
    async function anular() {
      const motivo = prompt(`Motivo de la anulación del recibo ${actual.serie || ''}-${actual.recibo_fisico ?? actual.numero}:`);
      if (motivo === null) return;
      if (!motivo.trim()) return window.FIN.aviso('Escribe el motivo de la anulación');
      const quien = (ctx.yo.usuario || '').toUpperCase();
      const r = await sb.from('recibos_venta').update({ estado: 'ANULADO', motivo_anulacion: motivo.trim(), anulado_por: quien, anulado_en: new Date().toISOString() }).eq('id', actual.id);
      if (r.error) return window.FIN.aviso(window.UI.traducirError(r.error));
      // Sus facturas recuperan el saldo.
      const d = await sb.from('factura_venta_pagos').delete().eq('recibo_id', actual.id);
      if (d.error) return window.FIN.aviso(window.UI.traducirError(d.error));
      window.FIN.aviso('Recibo anulado: sus facturas recuperan el saldo');
      const { data } = await sb.from('recibos_venta').select('*').eq('id', actual.id).single();
      listado = null;
      await abrir(data);
    }
    async function eliminar() {
      if (!confirm(`¿Eliminar el recibo ${actual.serie || ''}-${actual.recibo_fisico ?? actual.numero}? Se borra con sus ${lineas.length} pagos a facturas (que recuperan su saldo). No se puede deshacer.`)) return;
      const d = await sb.from('factura_venta_pagos').delete().eq('recibo_id', actual.id);
      if (d.error) return window.FIN.aviso(window.UI.traducirError(d.error));
      const r = await sb.from('recibos_venta').delete().eq('id', actual.id);
      if (r.error) return window.FIN.aviso(window.UI.traducirError(r.error));
      window.FIN.aviso('Recibo eliminado');
      listado = null;
      abrir(null);
    }
    async function irRecibo(n) {
      if (!/^\d+$/.test(String(n).trim())) return;
      const v = Number(n);
      let qq = sb.from('recibos_venta').select('*').eq('localidad_id', ctx.sel.loc).or(`numero.eq.${v},recibo_fisico.eq.${v}`);
      if (conClase) qq = qq.eq('clase', cfg.clase);
      const { data } = await qq.order('fecha', { ascending: false }).limit(1);
      if (!data?.[0]) return window.FIN.aviso(`No hay un recibo ${v} en la empresa`);
      abrir(data[0]);
    }

    function imprimirRecibo() {
      const r = actual; if (!r) return;
      const c = cliente(r.cliente_id); const ven = vendedores.find((x) => x.id === r.vendedor_id); const mon = ctx.moneda(r.moneda_id);
      const letras = window.BANCOS.enLetras ? window.BANCOS.enLetras(r.valor, (mon?.nombre || 'QUETZALES').toUpperCase()) : '';
      imprimir(`${cfg.nombre} ${r.numero}`, `<h1>${esc(cfg.nombre)} ${esc([r.serie, r.recibo_fisico].filter((x) => x != null && x !== '').join('-'))} · ${tipoImp}${r.estado === 'ANULADO' ? ' · ANULADO' : ''}</h1>
        <h2>${esc([`No. interno: ${r.numero}`, `Fecha: ${fmt.fechaDia(r.fecha)}`, `Cliente: ${c ? `${c.codigo} · ` : ''}${r.nombre || ''}`, `Vendedor: ${ven ? ven.nombre : '—'}`, `Forma de pago: ${r.forma || ''}`, `Tipo: ${r.tipo_pago || ''}`, `Estado: ${estadoDe(r)[1]}`].join(' · '))}</h2>
        <table><tbody>
          <tr><th>Recibimos de</th><td>${esc(r.nombre || '')}</td><th>Valor</th><td class="n"><b>${esc(sim(r.moneda_id))} ${fmt.monto(r.valor)}</b></td></tr>
          ${letras ? `<tr><th>La suma de</th><td colspan="3">${esc(letras)}</td></tr>` : ''}
          <tr><th>Banco</th><td>${esc(r.banco || '')}</td><th>Documento</th><td>${esc([r.documento, r.cuenta_bancaria].filter(Boolean).join(' · '))}</td></tr>
          ${r.descripcion ? `<tr><th>Descripción</th><td colspan="3">${esc(r.descripcion)}</td></tr>` : ''}
        </tbody></table>
        <table><thead><tr><th>#</th><th>Factura</th><th>Fecha</th><th class="n">Valor factura</th><th class="n">Abono</th></tr></thead><tbody>
        ${lineas.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(nombreFac(x.factura))}</td><td>${esc(fmt.fechaDia(String(x.factura?.fecha_emision || '').slice(0, 10)))}</td><td class="n">${fmt.monto(x.factura?.total)}</td><td class="n">${fmt.monto(x.abono)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="4">Total aplicado${Number(r.valor_retencion) ? ` · retención ${esc(r.tipo_retencion || '')} ${fmt.monto(r.valor_retencion)}` : ''}${Number(r.gasto_valor) ? ` · gastos ${fmt.monto(r.gasto_valor)}` : ''}</td><td class="n">${fmt.monto(lineas.reduce((t, x) => t + x.abono, 0))}</td></tr></tfoot></table>
        <div class="firmas"><div>${r.firma_digital ? `Firma y sello digital<br>${esc(r.usuario || '')} · ${esc(fmt.fechaHora(r.fecha_ingreso || r.creado_en))}` : 'Recibió'}</div><div>Cliente</div></div>`, { locId: r.localidad_id, orgId: r.organizacion_id });
    }

    // Listas de valores: cada opción es «descripción — código» (se busca por cualquiera de los dos); al elegirla el campo queda con el código.
    cont.addEventListener('change', (e) => { const i = e.target; if (i && i.matches && i.matches('input[list]')) { const k = i.value.lastIndexOf(' — '); if (k >= 0) i.value = i.value.slice(k + 3).trim(); } }, true);
    // ---------- Eventos ----------
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { await cargarLocalidad(); return abrir(null); }
      if (e.target.name === 'ir_recibo') return irRecibo(e.target.value);
      const form = e.target.closest('.vr-form'); if (!form) return;
      leerLineas();
      const n = e.target.name;
      if (n === 'tipo_impresion') { tipoImp = e.target.value; return; }
      if (n === 'serie_libre') { serieLibre = e.target.checked; return repintar(); }
      if (n === 'cliente_codigo') {
        const c = clientes.find((x) => String(x.codigo) === e.target.value.trim());
        if (c) { if (lineas.some((x) => x.abono > 0) && actual?.cliente_id !== c.id) lineas = []; return repintar({ cliente_id: c.id, nombre: c.nombre, vendedor_id: c.vendedor_id || null }); }
      }
      if (n === 'moneda_id') { const mo = ctx.moneda(Number(e.target.value)); return repintar({ tipo_cambio: mo?.cambio || 1 }); }
      if (n === 'pct_retencion' || n === 'incluir_retencion') {
        const el = form.elements; const pct = Number(el.pct_retencion.value || 0);
        if (el.incluir_retencion.checked && pct > 0) { const base = lineas.reduce((t, x) => t + Number(x.abono || 0), 0); el.valor_retencion.value = fmt.redondear(base / 1.12 * 0.12 * pct / 100) || ''; }
      }
      totalizar();
    });
    cont.addEventListener('input', (e) => { if (e.target.closest('.vr-form') && (e.target.matches('[data-abono]') || ['valor', 'tipo_cambio', 'gasto_valor'].includes(e.target.name))) totalizar(); });
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.name === 'ir_recibo') { e.preventDefault(); irRecibo(e.target.value); }
    });
    cont.addEventListener('click', async (e) => {
      const tab = e.target.closest('[data-pestana]');
      if (tab) {
        if (editable()) leerLineas();
        const form = ctx.pDet.querySelector('.vr-form'); const h = form && editable() ? encabezado(form) : null;
        pestana = tab.dataset.pestana; h ? pintar({ ...(actual || valoresNuevos()), ...h }) : pintar();
        if (pestana === 'RECIBOS' && !listado) { await cargarListado(); if (pestana === 'RECIBOS') h ? pintar({ ...(actual || valoresNuevos()), ...h }) : pintar(); }
        return;
      }
      const ab = e.target.closest('[data-abrir-recibo]');
      if (ab) { if (Number(ab.dataset.abrirRecibo) === actual?.id) return; const { data } = await sb.from('recibos_venta').select('*').eq('id', Number(ab.dataset.abrirRecibo)).single(); return data ? abrir(data) : null; }
      const q = e.target.closest('[data-quitar]'); if (q) { leerLineas(); lineas.splice(Number(q.dataset.quitar), 1); return repintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (!a) return;
      if (a === 'nuevo') { pestana = 'FACTURAS'; return abrir(null); }
      if (a === 'modificar') { modificando = true; return pintar(); }
      if (a === 'cancelar') return abrir(actual);
      if (a === 'asignar') return asignar();
      if (a === 'ver-saldos') return verSaldos();
      if (a === 'liquidar') return liquidar();
      if (a === 'anular') return anular();
      if (a === 'eliminar') return eliminar();
      if (a === 'imprimir') return imprimirRecibo();
      if (a === 'lista-consultar') { listaTexto = ctx.pDet.querySelector('[name=lista_texto]')?.value || ''; listado = null; pintar(); await cargarListado(); return pintar(); }
    });
    cont.addEventListener('submit', (e) => {
      if (!e.target.matches('.vr-form')) return;
      e.preventDefault();
      if (document.activeElement?.name === 'lista_texto') return ctx.pDet.querySelector('[data-accion=lista-consultar]')?.click();
      if (editable()) guardar(e.target);
    });

    iniciar();
  }
})();
