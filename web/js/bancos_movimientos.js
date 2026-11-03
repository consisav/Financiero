// Registros · Bancos · Depósitos multimoneda, Notas de crédito y Notas de débito / transferencias
// (misma pantalla con distinta configuración), por organización y localidad:
//   Parámetros: cuenta bancaria, fechas y estado.
//   Maestro: los documentos (folio, fecha, cuenta, número, tercero, valor y valor en quetzales,
//   estado, partida y conciliado).
//   Detalle: encabezado (cuenta bancaria, número de documento, fecha, moneda y valor de cambio,
//   valor, descripción, cliente o proveedor, tipo de operación; folio, operador y fecha de
//   operación automáticos), documentos aplicados (facturas, recibos, notas) y detalle contable
//   generado desde una transacción de Objetos contables («Contabilizar»), con el que se genera la
//   partida contable.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;

  const CONFIG = {
    depositos: {
      tipo: 'DEPOSITO', titulo: 'Depósitos multimoneda', icono: 'ti-cash-banknote', nombre: 'Depósito', etiquetaNumero: 'Número de depósito',
      terceros: [{ valor: 'CLIENTE', texto: 'Cliente' }], etiquetaTercero: 'Depositó / cliente', documentos: ['FACTURA', 'RECIBO'], tituloDocs: 'Facturas y recibos depositados'
    },
    'notas-credito': {
      tipo: 'NOTA_CREDITO', titulo: 'Notas de crédito / transferencias', icono: 'ti-file-plus', nombre: 'Nota de crédito', etiquetaNumero: 'Número de nota',
      terceros: [{ valor: 'CLIENTE', texto: 'Cliente' }, { valor: 'CLIENTES VARIOS', texto: 'Clientes varios' }], etiquetaTercero: 'Cliente', documentos: ['FACTURA', 'NOTA'], tituloDocs: 'Facturas y notas'
    },
    'notas-debito': {
      tipo: 'NOTA_DEBITO', titulo: 'Notas de débito / transferencias', icono: 'ti-file-minus', nombre: 'Nota de débito', etiquetaNumero: 'Número de nota',
      terceros: [{ valor: 'PROVEEDOR PRODUCTOS', texto: 'Proveedor de productos' }, { valor: 'PROVEEDOR SERVICIOS', texto: 'Proveedor de servicios' }], etiquetaTercero: 'Proveedor', documentos: ['NOTA', 'FACTURA', 'OTRO'], tituloDocs: 'Notas y documentos',
      liquidaciones: [{ texto: 'Liquidar caja chica', icono: 'ti-cash', modulo: 'Caja chica' }, { texto: 'Liquidar compras', icono: 'ti-shopping-cart', modulo: 'Compras' }]
    }
  };
  const IVA = 0.12;

  function pantallaMovimiento(cont, cfg) {
    const ctx = montar(cont, { titulo: cfg.titulo, icono: cfg.icono, clase: 'bk-movimientos' });
    const { sb } = ctx;
    const [anio, mes] = fmt.hoy().split('-');
    const f = { cuenta: '', desde: `${anio}-${mes}-01`, hasta: fmt.hoy(), estado: '' };
    let cuentas = [];
    let contables = [];
    let transacciones = [];
    let partidas = {};      // id → { mes, numero }
    let docs = [];
    let actual = null;
    let documentos = [];    // { tipo, numero, tercero, nombre, valor, fecha, estado }
    let lineas = [];        // { cuenta_id, debe, haber }
    let buscar = '';

    const cuentaBancaria = (id) => cuentas.find((c) => c.id === id);
    const contable = (id) => contables.find((c) => c.id === id);
    const editable = () => ctx.admin && (!actual || actual.estado === 'ACTIVO');
    const contabilizado = () => !!actual?.partida_id;

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Cuenta bancaria</span><select name="cuenta"><option value="">Todas</option>${cuentas.map((c) => `<option value="${c.id}" ${String(f.cuenta) === String(c.id) ? 'selected' : ''}>${esc(ctx.nombreCuentaBancaria(c))}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Estado</span><select name="estado"><option value="">Todos</option><option ${f.estado === 'ACTIVO' ? 'selected' : ''}>ACTIVO</option><option ${f.estado === 'ANULADO' ? 'selected' : ''}>ANULADO</option></select></label>`);
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      await cargarLocalidad();
      pintarFiltros();
      await consultar();
    }

    async function cargarLocalidad() {
      [cuentas, contables] = await Promise.all([ctx.cuentasBancarias(), ctx.cuentasContables()]);
      const { data } = ctx.sel.loc ? await sb.from('transacciones_contables').select('id, numero, descripcion, estado, aplica_poliza, tipo_operacion').eq('localidad_id', ctx.sel.loc).eq('estado', 'ACTIVO').order('numero') : { data: [] };
      transacciones = data || [];
    }

    async function consultar() {
      if (!ctx.sel.loc) { docs = []; pintarMaestro(); return abrir(null); }
      let q = sb.from('movimientos_bancarios').select('*').eq('localidad_id', ctx.sel.loc).eq('tipo', cfg.tipo).gte('fecha', f.desde).lte('fecha', f.hasta).order('fecha', { ascending: false }).order('folio', { ascending: false });
      if (f.cuenta) q = q.eq('cuenta_bancaria_id', Number(f.cuenta));
      if (f.estado) q = q.eq('estado', f.estado);
      const { data, error } = await q;
      if (error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      docs = data;
      const ids = [...new Set(docs.map((d) => d.partida_id).filter(Boolean))];
      partidas = {};
      if (ids.length) {
        const { data: ps } = await sb.from('partidas').select('id, mes, numero, estado').in('id', ids);
        (ps || []).forEach((p) => { partidas[p.id] = p; });
      }
      if (actual && !docs.some((d) => d.id === actual.id)) actual = null;
      pintarMaestro();
      await abrir(actual ? docs.find((d) => d.id === actual.id) : docs[0] || null);
    }

    const nombrePartida = (id) => partidas[id] ? `${String(partidas[id].mes).padStart(2, '0')}-${partidas[id].numero}` : '';

    function pintarMaestro() {
      const q = buscar.trim().toLowerCase();
      const filas = docs.filter((d) => !q || [d.folio, d.numero_documento, d.tercero_nombre, d.descripcion, d.tipo_operacion].some((v) => String(v || '').toLowerCase().includes(q)));
      const activos = docs.filter((d) => d.estado === 'ACTIVO');
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab tg-cab">
          <h2>${esc(cfg.titulo)} <small>${docs.length}</small></h2>
          <div class="ta-totales pc-resumen"><span class="ta-total"><b>Q ${fmt.monto(activos.reduce((s, d) => s + Number(d.valor_ml), 0))}</b> en el período</span><span class="ta-total sin"><b>${activos.filter((d) => !d.partida_id).length}</b> sin partida</span></div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar folio, documento, tercero…" value="${esc(buscar)}" aria-label="Buscar documentos"></label>
          ${ctx.admin && ctx.sel.loc && cuentas.length ? `<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>` : ''}
        </header>
        <div class="ta-tabla">
          <table>
            <thead><tr><th>Folio</th><th>Fecha</th><th>Cuenta bancaria</th><th>${esc(cfg.etiquetaNumero)}</th><th>${esc(cfg.etiquetaTercero)}</th><th class="num">Valor</th><th class="num">Valor Q</th><th>Tipo operación</th><th>Estado</th><th>Partida</th><th>Conciliado</th><th><span class="oculto">Acciones</span></th></tr></thead>
            <tbody>
              ${filas.map((d) => {
                const abierto = ctx.admin && d.estado === 'ACTIVO';
                return `<tr class="${actual && actual.id === d.id ? 'actual' : ''} ${d.estado === 'ANULADO' ? 'pc-anulada' : ''}" data-doc="${d.id}" tabindex="0">
                  <td class="fuerte">${d.folio}</td>
                  <td>${esc(fmt.fechaDia(d.fecha))}</td>
                  <td>${esc(ctx.nombreCuentaBancaria(cuentaBancaria(d.cuenta_bancaria_id)))}</td>
                  <td>${esc(d.numero_documento || '')}</td>
                  <td>${esc(d.tercero_nombre || '')}</td>
                  <td class="num">${esc(ctx.moneda(d.moneda_id)?.simbolo || '')} ${fmt.monto(d.valor)}</td>
                  <td class="num">${fmt.monto(d.valor_ml)}</td>
                  <td>${esc(d.tipo_operacion || '')}</td>
                  <td>${d.estado === 'ANULADO' ? '<span class="pc-marca anulada">Anulado</span>' : '<span class="pc-marca aprobada">Activo</span>'}</td>
                  <td>${d.partida_id ? `<span class="pc-tipo">${esc(nombrePartida(d.partida_id))}</span>` : '<span class="tk-tenue">—</span>'}</td>
                  <td>${d.conciliado ? '<i class="ti ti-square-check marca-si" aria-label="Sí"></i>' : '<i class="ti ti-square marca-no" aria-label="No"></i>'}</td>
                  <td class="tk-acciones">
                    <button type="button" class="tk-accion-btn" data-modificar="${d.id}"><i class="ti ${abierto ? 'ti-pencil' : 'ti-eye'}" aria-hidden="true"></i> ${abierto ? 'Modificar' : 'Ver'}</button>
                    <button type="button" class="tk-accion-btn peligro" data-eliminar="${d.id}" ${ctx.superAdmin && !d.partida_id ? '' : 'disabled'} title="${!ctx.superAdmin ? 'Solo el Super Administrador' : d.partida_id ? 'Ya generó su partida: anúlalo' : 'Eliminar'}"><i class="ti ti-trash" aria-hidden="true"></i> Eliminar</button>
                  </td></tr>`;
              }).join('') || `<tr><td colspan="12" class="tk-vacio"><i class="ti ${cfg.icono}" aria-hidden="true"></i>${!cuentas.length ? 'La localidad no tiene cuentas bancarias: créalas en Bancos · Cuentas bancarias.' : docs.length ? 'Ningún documento coincide con la búsqueda.' : 'No hay documentos en ese rango de fechas.'}</td></tr>`}
            </tbody>
          </table>
        </div>`;
    }

    async function abrir(d) {
      actual = d;
      documentos = [];
      lineas = [];
      if (d) {
        const [a, b] = await Promise.all([
          sb.from('movimiento_documentos').select('*').eq('movimiento_id', d.id).order('id'),
          sb.from('movimiento_lineas').select('*').eq('movimiento_id', d.id).order('linea')
        ]);
        documentos = (a.data || []).map((x) => ({ tipo: x.tipo, numero: x.numero, tercero: x.tercero || '', nombre: x.nombre || '', valor: Number(x.valor), fecha: x.fecha || '', estado: x.estado || '' }));
        lineas = (b.data || []).map((x) => ({ cuenta_id: x.cuenta_id, debe: Number(x.debe), haber: Number(x.haber) }));
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-doc]').forEach((tr) => tr.classList.toggle('actual', !!d && tr.dataset.doc === String(d.id)));
    }

    function pintarDetalle(v0) {
      const d = actual;
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la organización y la localidad.'); return; }
      if (!cuentas.length) { ctx.pDet.innerHTML = ctx.vacio('La localidad no tiene cuentas bancarias: créalas en Bancos · Cuentas bancarias.'); return; }
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const disC = ed && !contabilizado() ? '' : 'disabled';
      const cb0 = cuentaBancaria(Number(f.cuenta)) || cuentas[0];
      const v = v0 || (d ? { ...d } : { cuenta_bancaria_id: cb0.id, numero_documento: '', fecha: fmt.hoy(), moneda_id: cb0.moneda_id, tipo_cambio: ctx.moneda(cb0.moneda_id)?.cambio || 1, valor: '', descripcion: '', tipo_tercero: cfg.terceros[0].valor, tercero_codigo: '', tercero_nombre: '', tipo_operacion: '', transaccion_id: null });
      const valorMl = fmt.redondear(Number(v.valor || 0) * Number(v.tipo_cambio || 1));
      const tiposOperacion = [...new Set(transacciones.map((t) => t.tipo_operacion).filter(Boolean))];
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form bm-form" novalidate>
          <header class="tk-titulo">
            <span class="tk-icono"><i class="ti ${cfg.icono}" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>${esc(cfg.titulo)}</small><h2>${d ? `${esc(cfg.nombre)} folio ${d.folio}` : `${cfg.tipo === 'DEPOSITO' ? 'Nuevo' : 'Nueva'} ${esc(cfg.nombre.toLowerCase())}`}</h2></div>
            <div class="tk-marcas">${d ? (d.estado === 'ANULADO' ? '<span class="pc-marca anulada">Anulado</span>' : '<span class="pc-marca aprobada">Activo</span>') : '<span class="pc-marca pendiente">Sin registrar</span>'}${d?.partida_id ? `<span class="pc-marca definitiva"><i class="ti ti-notebook" aria-hidden="true"></i> Partida ${esc(nombrePartida(d.partida_id))}</span>` : ''}${d?.conciliado ? '<span class="pc-marca aprobada">Conciliado</span>' : ''}</div>
            <div class="tk-titulo-acciones">
              ${cfg.liquidaciones && ed ? cfg.liquidaciones.map((l) => `<button type="button" class="boton secundario-sm" data-proximamente="${esc(l.texto)}" data-modulo="${esc(l.modulo)}" title="Se habilita cuando exista el módulo de ${esc(l.modulo)}"><i class="ti ${l.icono}" aria-hidden="true"></i> ${esc(l.texto)}</button>`).join('') : ''}
              ${d ? '<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>' : ''}
              ${d && ed ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="anular"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>' : ''}
              ${d && ed && !contabilizado() ? '<button type="button" class="boton secundario-sm" data-accion="partida" title="Genera la partida contable con el detalle contable"><i class="ti ti-notebook" aria-hidden="true"></i> Generar partida</button>' : ''}
              ${ed ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${d ? 'Guardar cambios' : 'Registrar'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          ${d && d.estado === 'ANULADO' ? `<p class="tk-aviso"><i class="ti ti-ban" aria-hidden="true"></i> Anulado por ${esc(d.anulado_por || '')} el ${esc(fmt.fechaHora(d.anulado_en))}: ${esc(d.motivo_anulacion || '')}</p>` : ''}

          <div class="pc-encabezado bm-encabezado">
            <label class="campo bm-cuenta"><span>Cuenta bancaria *</span><select name="cuenta_bancaria_id" ${disC}>${cuentas.filter((c) => c.activo || c.id === v.cuenta_bancaria_id).map((c) => `<option value="${c.id}" ${v.cuenta_bancaria_id === c.id ? 'selected' : ''}>${esc(ctx.nombreCuentaBancaria(c))}</option>`).join('')}</select></label>
            <label class="campo"><span>${esc(cfg.etiquetaNumero)}</span><input name="numero_documento" value="${esc(v.numero_documento || '')}" maxlength="40" ${dis}></label>
            <label class="campo"><span>Fecha *</span><input type="date" name="fecha" value="${esc(v.fecha)}" ${disC}></label>
            <label class="campo"><span>Moneda</span><select name="moneda_id" ${dis}>${ctx.monedas.map((m) => `<option value="${m.id}" ${v.moneda_id === m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
            <label class="campo"><span>Valor cambio</span><input type="number" step="any" min="0" name="tipo_cambio" value="${esc(String(v.tipo_cambio ?? 1))}" ${dis}></label>
            <label class="campo bm-valor"><span>Valor *</span><input type="number" step="0.01" min="0" name="valor" value="${esc(String(v.valor ?? ''))}" ${disC}></label>
            <div class="ta-auto pc-auto"><span>Valor en quetzales</span><b data-valor-ml>Q ${fmt.monto(valorMl)}</b></div>
          </div>
          <div class="pc-encabezado bm-fila2">
            <label class="campo pc-desc"><span>Descripción</span><input name="descripcion" value="${esc(v.descripcion || '')}" maxlength="250" placeholder="${cfg.tipo === 'DEPOSITO' ? 'Ej. FE-7074 FE-7075' : 'Concepto de la nota o transferencia'}" ${dis}></label>
            ${cfg.terceros.length > 1 ? `<div class="campo"><span>${esc(cfg.etiquetaTercero)}</span><div class="pc-radios bm-radios">${cfg.terceros.map((t) => `<label><input type="radio" name="tipo_tercero" value="${t.valor}" ${v.tipo_tercero === t.valor ? 'checked' : ''} ${dis}> ${esc(t.texto)}</label>`).join('')}</div></div>` : `<input type="hidden" name="tipo_tercero" value="${cfg.terceros[0].valor}">`}
            <label class="campo bm-codigo"><span>Código</span><input name="tercero_codigo" value="${esc(v.tercero_codigo || '')}" maxlength="20" ${dis}></label>
            <label class="campo"><span>${esc(cfg.etiquetaTercero)} (nombre)</span><input name="tercero_nombre" value="${esc(v.tercero_nombre || '')}" maxlength="150" ${dis}></label>
            <label class="campo"><span>Tipo de operación</span><input list="bm-operaciones" name="tipo_operacion" value="${esc(v.tipo_operacion || '')}" maxlength="40" ${dis}><datalist id="bm-operaciones">${tiposOperacion.map((t) => `<option value="${esc(t)}">`).join('')}</datalist></label>
            <div class="ta-auto pc-auto"><span>Operador · fecha</span><b ${d ? '' : 'data-reloj'}>${esc(d ? d.usuario || '' : (ctx.yo.usuario || '').toUpperCase())}</b><small>${esc(fmt.fechaHora(d ? d.fecha_operacion : new Date()))}</small></div>
          </div>

          <div class="ta-det-grid oc-grid bm-grid">
            <div class="ta-col">
              <div class="pc-detalle-cab"><h3 class="ta-col-titulo"><i class="ti ti-files" aria-hidden="true"></i> ${esc(cfg.tituloDocs)} <small class="tk-tenue" data-docs-total></small></h3>${ed ? '<button type="button" class="rp-enlace" data-accion="documento"><i class="ti ti-plus" aria-hidden="true"></i> Agregar</button>' : ''}</div>
              <div class="pc-lineas"><table><thead><tr><th>Tipo</th><th>Número</th><th>Código</th><th>Nombre</th><th class="num">Valor</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
                <tbody data-tabla="docs">${documentos.map((x, i) => filaDocumento(x, i, dis)).join('') || '<tr><td colspan="8" class="tk-vacio">Sin documentos aplicados.</td></tr>'}</tbody></table></div>
            </div>
            <div class="ta-col">
              <div class="pc-detalle-cab"><h3 class="ta-col-titulo"><i class="ti ti-list-details" aria-hidden="true"></i> Detalle contable</h3>${ed && !contabilizado() ? '<button type="button" class="rp-enlace" data-accion="linea"><i class="ti ti-plus" aria-hidden="true"></i> Agregar línea</button>' : ''}</div>
              <div class="bm-transaccion">
                <label class="campo"><span>Transacción</span><select name="transaccion_id" ${disC}><option value="">Elegir transacción…</option>${transacciones.filter((t) => t.aplica_poliza).map((t) => `<option value="${t.id}" ${v.transaccion_id === t.id ? 'selected' : ''}>${t.numero} · ${esc(t.descripcion)}</option>`).join('')}</select></label>
                ${ed && !contabilizado() ? '<button type="button" class="boton secundario-sm" data-accion="contabilizar" title="Arma el detalle contable con las cuentas de la transacción y el valor del documento"><i class="ti ti-calculator" aria-hidden="true"></i> Contabilizar</button>' : ''}
              </div>
              <div class="pc-lineas"><table><thead><tr><th class="pc-n">Línea</th><th class="pc-cta">Cuenta</th><th>Nombre</th><th class="num">Debe</th><th class="num">Haber</th><th></th></tr></thead>
                <tbody data-tabla="lineas">${lineas.map((l, i) => filaLinea(l, i, disC)).join('') || '<tr><td colspan="6" class="tk-vacio">Elige la transacción y presiona «Contabilizar».</td></tr>'}</tbody>
                <tfoot><tr><td colspan="3" class="pc-totales-lbl">Totales</td><td class="num" data-total="debe"></td><td class="num" data-total="haber"></td><td data-cuadre></td></tr></tfoot></table></div>
            </div>
          </div>
          <datalist id="bm-cuentas">${contables.filter((c) => c.movimiento).map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>
        </form>`;
      totalizar();
    }

    function filaDocumento(x, i, dis) {
      return `<tr data-docfila="${i}">
        <td><select data-campo="tipo" ${dis}>${cfg.documentos.map((t) => `<option ${x.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
        <td><input data-campo="numero" value="${esc(x.numero)}" maxlength="40" ${dis} aria-label="Número"></td>
        <td class="bm-codigo"><input data-campo="tercero" value="${esc(x.tercero)}" maxlength="20" ${dis} aria-label="Código"></td>
        <td><input data-campo="nombre" value="${esc(x.nombre)}" maxlength="150" ${dis} aria-label="Nombre"></td>
        <td class="num"><input type="number" step="0.01" data-campo="valor" value="${x.valor || ''}" ${dis} aria-label="Valor"></td>
        <td><input type="date" data-campo="fecha" value="${esc(x.fecha)}" ${dis} aria-label="Fecha"></td>
        <td><input data-campo="estado" value="${esc(x.estado)}" maxlength="20" ${dis} aria-label="Estado"></td>
        <td>${dis ? '' : `<button type="button" class="icono-boton" data-quitar-doc="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>`}</td></tr>`;
    }
    function filaLinea(l, i, dis) {
      const c = contable(l.cuenta_id);
      return `<tr data-linea="${i}">
        <td class="pc-n">${i + 1}</td>
        <td class="pc-cta"><input list="bm-cuentas" data-campo="cuenta" value="${esc(c ? c.codigo : l.codigo || '')}" ${dis} aria-label="Cuenta"></td>
        <td class="pc-nombre" data-nombre>${c ? esc(c.nombre) : l.codigo ? '<span class="oc-pendiente">Cuenta pendiente: no existe en el catálogo</span>' : ''}</td>
        <td class="num"><input type="number" step="0.01" min="0" data-campo="debe" value="${l.debe || ''}" ${dis} aria-label="Debe"></td>
        <td class="num"><input type="number" step="0.01" min="0" data-campo="haber" value="${l.haber || ''}" ${dis} aria-label="Haber"></td>
        <td>${dis ? '' : `<button type="button" class="icono-boton" data-quitar-linea="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>`}</td></tr>`;
    }

    function totalizar() {
      const d = fmt.redondear(lineas.reduce((s, l) => s + Number(l.debe || 0), 0));
      const h = fmt.redondear(lineas.reduce((s, l) => s + Number(l.haber || 0), 0));
      const td = ctx.pDet.querySelector('[data-total=debe]');
      if (!td) return;
      td.textContent = fmt.monto(d);
      ctx.pDet.querySelector('[data-total=haber]').textContent = fmt.monto(h);
      ctx.pDet.querySelector('[data-cuadre]').innerHTML = !lineas.length ? '' : d === h && d > 0 ? '<span class="pc-cuadre ok"><i class="ti ti-circle-check" aria-hidden="true"></i></span>' : `<span class="pc-cuadre no" title="Diferencia ${fmt.monto(Math.abs(d - h))}"><i class="ti ti-alert-triangle" aria-hidden="true"></i></span>`;
      const td2 = ctx.pDet.querySelector('[data-docs-total]');
      const sumDocs = fmt.redondear(documentos.reduce((s, x) => s + Number(x.valor || 0), 0));
      const valor = Number(ctx.pDet.querySelector('[name=valor]')?.value || 0);
      if (td2) td2.innerHTML = documentos.length ? `${fmt.monto(sumDocs)}${valor && sumDocs !== fmt.redondear(valor) ? ` <span class="pc-rojo">(el valor es ${fmt.monto(valor)})</span>` : ''}` : '';
    }

    function leerEncabezado(form) {
      const el = form.elements;
      return {
        cuenta_bancaria_id: Number(el.cuenta_bancaria_id.value), numero_documento: el.numero_documento.value.trim() || null, fecha: el.fecha.value,
        moneda_id: Number(el.moneda_id.value), tipo_cambio: Number(el.tipo_cambio.value) || 1, valor: fmt.redondear(el.valor.value),
        descripcion: el.descripcion.value, tipo_tercero: form.querySelector('[name=tipo_tercero]:checked')?.value || el.tipo_tercero.value,
        tercero_codigo: el.tercero_codigo.value.trim() || null, tercero_nombre: el.tercero_nombre.value.trim().toUpperCase() || null,
        tipo_operacion: el.tipo_operacion.value.trim() || null, transaccion_id: el.transaccion_id.value ? Number(el.transaccion_id.value) : null
      };
    }
    function leerFilas() {
      ctx.pDet.querySelectorAll('tr[data-docfila]').forEach((tr) => {
        const x = documentos[Number(tr.dataset.docfila)];
        const val = (c) => tr.querySelector(`[data-campo=${c}]`).value;
        Object.assign(x, { tipo: val('tipo'), numero: val('numero').trim(), tercero: val('tercero').trim(), nombre: val('nombre').trim(), valor: fmt.redondear(val('valor')), fecha: val('fecha'), estado: val('estado').trim() });
      });
      ctx.pDet.querySelectorAll('tr[data-linea]').forEach((tr) => {
        const l = lineas[Number(tr.dataset.linea)];
        const cod = tr.querySelector('[data-campo=cuenta]').value.trim();
        const c = contables.find((x) => x.codigo === cod && x.movimiento);
        l.cuenta_id = c ? c.id : null;
        l.codigo = cod;
        tr.querySelector('[data-nombre]').innerHTML = c ? esc(c.nombre) : cod ? '<span class="pc-error">No es una cuenta de movimiento de la localidad</span>' : '';
        l.debe = fmt.redondear(tr.querySelector('[data-campo=debe]').value);
        l.haber = fmt.redondear(tr.querySelector('[data-campo=haber]').value);
      });
    }
    function repintar() {
      const form = ctx.pDet.querySelector('.bm-form');
      leerFilas();
      pintarDetalle({ ...(actual || {}), ...leerEncabezado(form) });
    }

    // Detalle contable desde la transacción: TOTAL = valor en quetzales; SUBTOTAL = sin IVA (12 %);
    // IMPUESTO = IVA; RETENCIÓN y OTRO quedan en cero para completarlas.
    async function contabilizar() {
      const form = ctx.pDet.querySelector('.bm-form');
      const v = leerEncabezado(form);
      const error = form.querySelector('.modal-error');
      if (!v.transaccion_id) { error.textContent = 'Elige la transacción con la que se contabiliza el documento.'; return; }
      if (!v.valor) { error.textContent = 'Escribe el valor del documento.'; return; }
      const { data } = await sb.from('transaccion_cuentas').select('*').eq('transaccion_id', v.transaccion_id).order('orden').order('linea');
      if (!data?.length) { error.textContent = 'La transacción no tiene cuentas: defínelas en Objetos contables · Transacciones.'; return; }
      const total = fmt.redondear(v.valor * v.tipo_cambio);
      const subtotal = fmt.redondear(total / (1 + IVA));
      const montoDe = (op) => op === 'TOTAL' ? total : op === 'SUBTOTAL' ? subtotal : op === 'IMPUESTO' ? fmt.redondear(total - subtotal) : 0;
      leerFilas();
      lineas = data.map((t) => {
        const c = contables.find((x) => x.id === t.cuenta_id) || contables.find((x) => x.codigo === t.cuenta_codigo);
        const m = montoDe(t.operacion);
        return { cuenta_id: c && c.movimiento ? c.id : null, codigo: c ? c.codigo : t.cuenta_codigo, debe: t.naturaleza === 'D' ? m : 0, haber: t.naturaleza === 'H' ? m : 0 };
      });
      pintarDetalle({ ...(actual || {}), ...v });
      const pend = lineas.filter((l) => !l.cuenta_id).length;
      window.FIN.aviso(`Detalle contable armado con la transacción${pend ? ` · ${pend} cuenta(s) pendiente(s) en el catálogo` : ''}`);
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      leerFilas();
      const v = leerEncabezado(form);
      if (!v.valor || v.valor <= 0) { error.textContent = 'Escribe el valor del documento.'; return; }
      if (!v.fecha) { error.textContent = 'Escribe la fecha del documento.'; return; }
      const malas = lineas.filter((l) => (l.debe || l.haber || l.codigo) && !l.cuenta_id);
      if (malas.length && !contabilizado()) { error.textContent = 'Hay líneas del detalle contable sin una cuenta de movimiento válida: corrígelas o quítalas.'; return; }
      error.textContent = '';
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      try {
        let id = actual?.id;
        if (actual) {
          const r = await sb.from('movimientos_bancarios').update(v).eq('id', id);
          if (r.error) throw r.error;
        } else {
          const r = await sb.from('movimientos_bancarios').insert({ ...v, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, tipo: cfg.tipo }).select('id').single();
          if (r.error) throw r.error;
          id = r.data.id;
        }
        const delD = await sb.from('movimiento_documentos').delete().eq('movimiento_id', id);
        if (delD.error) throw delD.error;
        const docsV = documentos.filter((x) => x.numero);
        if (docsV.length) { const r = await sb.from('movimiento_documentos').insert(docsV.map((x) => ({ movimiento_id: id, tipo: x.tipo, numero: x.numero, tercero: x.tercero || null, nombre: x.nombre || null, valor: x.valor || 0, fecha: x.fecha || null, estado: x.estado || null }))); if (r.error) throw r.error; }
        if (!contabilizado()) {
          const delL = await sb.from('movimiento_lineas').delete().eq('movimiento_id', id);
          if (delL.error) throw delL.error;
          const ls = lineas.filter((l) => l.cuenta_id && (l.debe || l.haber));
          if (ls.length) { const r = await sb.from('movimiento_lineas').insert(ls.map((l, i) => ({ movimiento_id: id, linea: i + 1, cuenta_id: l.cuenta_id, debe: l.debe || 0, haber: l.haber || 0 }))); if (r.error) throw r.error; }
        }
        window.FIN.aviso(actual ? `${cfg.nombre} guardado` : `${cfg.nombre} registrado`);
        actual = { id };
        await consultar();
      } catch (err) {
        error.textContent = window.UI.traducirError(err);
      } finally {
        boton.disabled = false;
      }
    }

    async function procesar(accion) {
      let motivo = null;
      if (accion === 'ANULAR') { motivo = prompt(`Motivo de la anulación del ${cfg.nombre.toLowerCase()} folio ${actual.folio}:`); if (motivo === null) return; }
      if (accion === 'PARTIDA' && !confirm(`¿Generar la partida contable del ${cfg.nombre.toLowerCase()} folio ${actual.folio}? Después ya no se cambia su detalle contable.`)) return;
      if (accion === 'ELIMINAR' && !confirm(`¿Eliminar el ${cfg.nombre.toLowerCase()} folio ${actual.folio}? No se puede deshacer.`)) return;
      const { data, error } = await sb.rpc('procesar_movimiento_bancario', { p_id: actual.id, p_accion: accion, p_motivo: motivo });
      if (error) {
        const e = ctx.pDet.querySelector('.modal-error');
        if (e) e.textContent = window.UI.traducirError(error); else window.FIN.aviso(window.UI.traducirError(error));
        return;
      }
      window.FIN.aviso(accion === 'PARTIDA' ? `Partida ${data.partida} generada` : accion === 'ANULAR' ? 'Documento anulado' : 'Documento eliminado');
      if (accion === 'ELIMINAR') actual = null;
      await consultar();
    }

    function imprimirDocumento() {
      const d = actual;
      const cb = cuentaBancaria(d.cuenta_bancaria_id);
      const loc = ctx.localidad(d.localidad_id);
      imprimir(`${cfg.nombre} ${d.folio}`, `
        <h1>${esc(loc ? `${loc.codigo} ${loc.nombre_comercial}` : '')}</h1>
        <h2>${esc(cfg.nombre)} folio ${d.folio}${d.estado === 'ANULADO' ? ' · ANULADO' : ''}${d.partida_id ? ` · partida ${esc(nombrePartida(d.partida_id))}` : ''}</h2>
        <div class="cab"><div><b>Cuenta bancaria</b>${esc(ctx.nombreCuentaBancaria(cb))}</div><div><b>${esc(cfg.etiquetaNumero)}</b>${esc(d.numero_documento || '')}</div><div><b>Fecha</b>${esc(fmt.fechaDia(d.fecha))}</div>
          <div><b>Valor</b>${esc(ctx.moneda(d.moneda_id)?.simbolo || '')} ${fmt.monto(d.valor)} · Q ${fmt.monto(d.valor_ml)}</div>
          <div><b>${esc(cfg.etiquetaTercero)}</b>${esc([d.tercero_codigo, d.tercero_nombre].filter(Boolean).join(' · '))}</div><div><b>Tipo de operación</b>${esc(d.tipo_operacion || '')}</div><div><b>Operador</b>${esc(d.usuario || '')} · ${esc(fmt.fechaHora(d.fecha_operacion))}</div>
          ${d.descripcion ? `<div style="grid-column:1/-1"><b>Descripción</b>${esc(d.descripcion)}</div>` : ''}</div>
        ${documentos.length ? `<h3>${esc(cfg.tituloDocs)}</h3><table><thead><tr><th>Tipo</th><th>Número</th><th>Código</th><th>Nombre</th><th class="n">Valor</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>${documentos.map((x) => `<tr><td>${esc(x.tipo)}</td><td>${esc(x.numero)}</td><td>${esc(x.tercero)}</td><td>${esc(x.nombre)}</td><td class="n">${fmt.monto(x.valor)}</td><td>${esc(fmt.fechaDia(x.fecha))}</td><td>${esc(x.estado)}</td></tr>`).join('')}</tbody></table>` : ''}
        ${lineas.length ? `<h3>Detalle contable</h3><table><thead><tr><th>Línea</th><th>Cuenta</th><th>Nombre</th><th class="n">Debe</th><th class="n">Haber</th></tr></thead><tbody>${lineas.map((l, i) => { const c = contable(l.cuenta_id); return `<tr><td>${i + 1}</td><td>${esc(c?.codigo || '')}</td><td>${esc(c?.nombre || '')}</td><td class="n">${l.debe ? fmt.monto(l.debe) : ''}</td><td class="n">${l.haber ? fmt.monto(l.haber) : ''}</td></tr>`; }).join('')}</tbody>
          <tfoot><tr><td colspan="3">Totales</td><td class="n">${fmt.monto(lineas.reduce((s, l) => s + l.debe, 0))}</td><td class="n">${fmt.monto(lineas.reduce((s, l) => s + l.haber, 0))}</td></tr></tfoot></table>` : ''}
        <div class="firmas"><div>Elaboró: ${esc(d.usuario || '')}</div><div>Revisó</div><div>Autorizó</div></div>`);
    }

    // ---------- Eventos ----------
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { f.cuenta = ''; actual = null; await cargarLocalidad(); pintarFiltros(); return consultar(); }
      if (cambio === 'otro') {
        f[e.target.name] = e.target.value;
        if (e.target.name === 'desde' || e.target.name === 'hasta') {
          if (f.desde && f.hasta && f.hasta < f.desde) { if (e.target.name === 'desde') f.hasta = f.desde; else f.desde = f.hasta; }
          pintarFiltros();
        }
        actual = null;
        return consultar();
      }
      const form = e.target.closest('.bm-form');
      if (!form) return;
      if (e.target.name === 'cuenta_bancaria_id') {
        // La moneda y su valor de cambio siguen a la cuenta bancaria.
        const cb = cuentaBancaria(Number(e.target.value));
        if (cb) { form.elements.moneda_id.value = cb.moneda_id; form.elements.tipo_cambio.value = ctx.moneda(cb.moneda_id)?.cambio || 1; }
      }
      if (e.target.name === 'moneda_id') form.elements.tipo_cambio.value = ctx.moneda(Number(e.target.value))?.cambio || 1;
      if (['cuenta_bancaria_id', 'moneda_id', 'tipo_cambio', 'valor'].includes(e.target.name)) {
        const v = leerEncabezado(form);
        form.querySelector('[data-valor-ml]').textContent = `Q ${fmt.monto(v.valor * v.tipo_cambio)}`;
        totalizar();
      }
    });
    cont.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar]')) {
        buscar = e.target.value;
        const pos = e.target.selectionStart;
        pintarMaestro();
        const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
        return;
      }
      const form = e.target.closest('.bm-form');
      if (!form) return;
      if (e.target.closest('tr[data-linea]')) {
        const tr = e.target.closest('tr[data-linea]');
        if (e.target.dataset.campo === 'debe' && e.target.value) tr.querySelector('[data-campo=haber]').value = '';
        if (e.target.dataset.campo === 'haber' && e.target.value) tr.querySelector('[data-campo=debe]').value = '';
      }
      if (e.target.closest('tr[data-linea], tr[data-docfila]')) { leerFilas(); totalizar(); }
      if (['valor', 'tipo_cambio'].includes(e.target.name)) {
        const v = leerEncabezado(form);
        form.querySelector('[data-valor-ml]').textContent = `Q ${fmt.monto(v.valor * v.tipo_cambio)}`;
        totalizar();
      }
    });
    cont.addEventListener('click', async (e) => {
      const bm = e.target.closest('[data-modificar]');
      if (bm) { await abrir(docs.find((d) => String(d.id) === bm.dataset.modificar)); return ctx.pDet.querySelector('[name=numero_documento]')?.focus(); }
      const be = e.target.closest('[data-eliminar]');
      if (be) { actual = docs.find((d) => String(d.id) === be.dataset.eliminar); return procesar('ELIMINAR'); }
      const fila = e.target.closest('tr[data-doc]');
      if (fila) return abrir(docs.find((d) => String(d.id) === fila.dataset.doc));
      const px = e.target.closest('[data-proximamente]');
      if (px) return window.FIN.aviso(`${px.dataset.proximamente}: se habilita cuando exista el módulo de ${px.dataset.modulo}`);
      const ac = e.target.closest('[data-accion]');
      if (ac) {
        const a = ac.dataset.accion;
        if (a === 'nuevo') return abrir(null);
        if (a === 'imprimir') return imprimirDocumento();
        if (a === 'anular') return procesar('ANULAR');
        if (a === 'partida') return procesar('PARTIDA');
        if (a === 'contabilizar') return contabilizar();
        if (a === 'documento') { leerFilas(); documentos.push({ tipo: cfg.documentos[0], numero: '', tercero: '', nombre: '', valor: 0, fecha: '', estado: '' }); return repintar(); }
        if (a === 'linea') { leerFilas(); lineas.push({ cuenta_id: null, codigo: '', debe: 0, haber: 0 }); return repintar(); }
      }
      const qd = e.target.closest('[data-quitar-doc]');
      if (qd) { leerFilas(); documentos.splice(Number(qd.dataset.quitarDoc), 1); return repintar(); }
      const ql = e.target.closest('[data-quitar-linea]');
      if (ql) { leerFilas(); lineas.splice(Number(ql.dataset.quitarLinea), 1); return repintar(); }
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.bm-form')) { e.preventDefault(); guardar(e.target); } });

    const reloj = setInterval(() => {
      if (!ctx.pDet.isConnected) return clearInterval(reloj);
      const c = ctx.pDet.querySelector('[data-reloj]');
      if (c) c.nextElementSibling.textContent = fmt.fechaHora(new Date());
    }, 1000);

    iniciar();
  }

  window.PANTALLAS = window.PANTALLAS || {};
  Object.entries(CONFIG).forEach(([id, cfg]) => { window.PANTALLAS[id] = (cont) => pantallaMovimiento(cont, cfg); });
})();
