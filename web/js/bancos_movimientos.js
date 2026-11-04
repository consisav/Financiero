// Registros · Bancos · Depósitos multimoneda, Notas de crédito y Notas de débito / transferencias
// (misma pantalla con distinta configuración). Cada documento es de una organización y localidad.
//   Parámetros: organización, localidad, cuenta bancaria, fechas y estado.
//   Encabezado: empresa (organización › localidad), banco y cuenta bancaria, número y valor (con su
//   valor en quetzales), datos (fecha, moneda, valor de cambio, tipo de operación, caja chica),
//   cliente o proveedor, quién depositó, descripción y control (folio, estado, operador, actualiza,
//   póliza, anulación).
//   Pestañas: detalle contable desde una transacción de Objetos contables («Contabilizar»), con
//   centro de costo; facturas de liquidación (valor y abono, en su moneda y en quetzales);
//   recibos físicos (o notas en las notas de crédito y débito) y el listado de documentos del período.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;

  const CONFIG = {
    depositos: {
      tipo: 'DEPOSITO', titulo: 'Depósitos multimoneda', icono: 'ti-cash-banknote', nombre: 'Depósito', plural: 'depósitos', etiquetaNumero: 'Número de depósito',
      terceros: [{ valor: 'CLIENTE', texto: 'Cliente' }], etiquetaTercero: 'Depositó / cliente', documentos: ['FACTURA', 'RECIBO'], tituloDocs: 'Facturas y recibos depositados'
    },
    'notas-credito': {
      tipo: 'NOTA_CREDITO', titulo: 'Notas de crédito / transferencias', icono: 'ti-file-plus', nombre: 'Nota de crédito', plural: 'notas de crédito', etiquetaNumero: 'Número de nota',
      terceros: [{ valor: 'CLIENTE', texto: 'Cliente' }, { valor: 'CLIENTES VARIOS', texto: 'Clientes varios' }], etiquetaTercero: 'Cliente', documentos: ['FACTURA', 'NOTA'], tituloDocs: 'Facturas y notas'
    },
    'notas-debito': {
      tipo: 'NOTA_DEBITO', titulo: 'Notas de débito / transferencias', icono: 'ti-file-minus', nombre: 'Nota de débito', plural: 'notas de débito', etiquetaNumero: 'Número de nota',
      terceros: [{ valor: 'PROVEEDOR PRODUCTOS', texto: 'Proveedor de productos' }, { valor: 'PROVEEDOR SERVICIOS', texto: 'Proveedor de servicios' }], etiquetaTercero: 'Proveedor', documentos: ['NOTA', 'FACTURA', 'OTRO'], tituloDocs: 'Notas y documentos',
      liquidaciones: [{ texto: 'Liquidar caja chica', icono: 'ti-cash', modulo: 'Caja chica' }, { texto: 'Liquidar compras', icono: 'ti-shopping-cart', modulo: 'Compras' }]
    }
  };
  const IVA = 0.12;
  const TITULO_DOC = {
    FACTURA: (cfg) => cfg.tipo === 'DEPOSITO' ? 'Facturas de liquidación' : 'Facturas',
    RECIBO: () => 'Recibos físicos',
    NOTA: () => 'Notas',
    OTRO: () => 'Otros documentos'
  };
  const ICONO_DOC = { FACTURA: 'ti-file-invoice', RECIBO: 'ti-receipt', NOTA: 'ti-file-text', OTRO: 'ti-files' };

  function pantallaMovimiento(cont, cfg) {
    const ctx = montar(cont, { titulo: cfg.titulo, icono: cfg.icono, clase: 'bk-movimientos' });
    const { sb } = ctx;
    const [anio, mes] = fmt.hoy().split('-');
    const f = { cuenta: '', desde: `${anio}-${mes}-01`, hasta: fmt.hoy(), estado: '' };
    let cuentas = [];
    let contables = [];
    let centros = [];      // centros de costo de la localidad
    let pestana = 'CONTABLE';
    let transacciones = [];
    let partidas = {};      // id → { mes, numero }
    let docs = [];
    let actual = null;
    let documentos = [];    // { tipo, numero, tercero, nombre, valor, fecha, estado }
    let lineas = [];        // { cuenta_id, debe, haber }
    let buscar = '';

    const cuentaBancaria = (id) => cuentas.find((c) => c.id === id);
    const contable = (id) => contables.find((c) => c.id === id);
    let modificando = false;        // un documento guardado se edita solo después de «Modificar»
    let comprobanteNuevo = null;    // archivo elegido, se sube al guardar
    let quitarComprobante = false;  // quitar la imagen guardada al guardar
    const BUCKET = 'bancos';
    const editable = () => ctx.admin && (!actual || (actual.estado === 'ACTIVO' && modificando));
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
      [cuentas, contables, centros] = await Promise.all([ctx.cuentasBancarias(), ctx.cuentasContables(), centrosLocalidad()]);
      const { data } = ctx.sel.loc ? await sb.from('transacciones_contables').select('id, numero, descripcion, estado, aplica_poliza, tipo_operacion').eq('localidad_id', ctx.sel.loc).eq('estado', 'ACTIVO').order('numero') : { data: [] };
      transacciones = data || [];
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
      await abrir(actual ? docs.find((d) => d.id === actual.id) : docs[0] || null, modificando);
    }

    // Organización y localidad del documento (o las elegidas, si es nuevo).
    const empresaDe = (d) => {
      const loc = ctx.localidad(d ? d.localidad_id : ctx.sel.loc);
      const org = ctx.organizaciones.find((o) => o.id === (d ? d.organizacion_id : ctx.sel.org));
      return [org ? `${org.codigo} · ${org.nombre}` : '', loc ? `${loc.codigo} · ${loc.nombre_comercial}` : ''].filter(Boolean).join('  ›  ');
    };
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

    async function abrir(d, editar = false) {
      actual = d;
      modificando = !!d && editar && ctx.admin && d.estado === 'ACTIVO';
      comprobanteNuevo = null;
      quitarComprobante = false;
      documentos = [];
      lineas = [];
      if (d) {
        const [a, b] = await Promise.all([
          sb.from('movimiento_documentos').select('*').eq('movimiento_id', d.id).order('id'),
          sb.from('movimiento_lineas').select('*').eq('movimiento_id', d.id).order('linea')
        ]);
        documentos = (a.data || []).map((x) => ({ tipo: x.tipo, serie: x.serie || '', numero: x.numero, tercero: x.tercero || '', nombre: x.nombre || '', valor: Number(x.valor), abono: Number(x.abono || 0), fecha: x.fecha || '', estado: x.estado || '', contrato: x.contrato || '' }));
        lineas = (b.data || []).map((x) => ({ cuenta_id: x.cuenta_id, centro_id: x.centro_id, debe: Number(x.debe), haber: Number(x.haber) }));
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-doc]').forEach((tr) => tr.classList.toggle('actual', !!d && tr.dataset.doc === String(d.id)));
    }

    // Pestañas: detalle contable, una por tipo de documento y el listado del período.
    const pestanas = () => [
      { id: 'CONTABLE', texto: 'Detalle contable', icono: 'ti-list-details' },
      ...cfg.documentos.map((t) => ({ id: t, texto: TITULO_DOC[t](cfg), icono: ICONO_DOC[t] })),
      { id: 'LISTADO', texto: `Listado de ${cfg.plural}`, icono: 'ti-list-search' }
    ];

    function pintarDetalle(v0) {
      const d = actual;
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la organización y la localidad.'); return; }
      if (!cuentas.length) { ctx.pDet.innerHTML = ctx.vacio('La localidad no tiene cuentas bancarias: créalas en Bancos · Cuentas bancarias.'); return; }
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const disC = ed && !contabilizado() ? '' : 'disabled';
      const cb0 = cuentaBancaria(Number(f.cuenta)) || cuentas[0];
      const v = v0 || (d ? { ...d } : { cuenta_bancaria_id: cb0.id, numero_documento: '', fecha: fmt.hoy(), moneda_id: cb0.moneda_id, tipo_cambio: ctx.moneda(cb0.moneda_id)?.cambio || 1, valor: '', descripcion: '', tipo_tercero: cfg.terceros[0].valor, tercero_codigo: '', tercero_nombre: '', tipo_operacion: '', transaccion_id: null, caja_chica: false, clientes_varios: false, deposito_por: '' });
      const cb = cuentaBancaria(v.cuenta_bancaria_id) || cb0;
      const banco = ctx.banco(cb.banco_id);
      const valorMl = fmt.redondear(Number(v.valor || 0) * Number(v.tipo_cambio || 1));
      const tiposOperacion = [...new Set(transacciones.map((t) => t.tipo_operacion).filter(Boolean))];
      if (!pestanas().some((p) => p.id === pestana)) pestana = 'CONTABLE';
      varios = !!v.clientes_varios;
      const cuenta = (tipo) => documentos.filter((x) => x.tipo === tipo).length;
      const marca = d ? (d.estado === 'ANULADO' ? '<span class="pc-marca anulada">Anulado</span>' : '<span class="pc-marca aprobada">Activo</span>') : '<span class="pc-marca pendiente">Sin registrar</span>';
      const dato = (etq, val, extra = '') => `<div class="bm-dato ${extra}"><dt>${etq}</dt><dd>${val || '<span class="tk-tenue">—</span>'}</dd></div>`;
      const puede = ctx.admin && d && d.estado === 'ACTIVO' && !modificando;
      const conImagen = comprobanteNuevo || (d?.comprobante_ruta && !quitarComprobante);
      const nombreImagen = comprobanteNuevo ? comprobanteNuevo.name : d?.comprobante_nombre || '';
      const esPdf = comprobanteNuevo ? comprobanteNuevo.type === 'application/pdf' : d?.comprobante_tipo === 'application/pdf';
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form bm-form" novalidate>
          <header class="tk-titulo bm-titulo">
            <div class="tk-titulo-texto"><small>${esc(cfg.titulo)} · ${esc(empresaDe(d))}</small><h2>${d ? `${esc(cfg.nombre)} folio ${d.folio}` : `${cfg.tipo === 'DEPOSITO' ? 'Nuevo' : 'Nueva'} ${esc(cfg.nombre.toLowerCase())}`}</h2></div>
            <div class="tk-marcas">${marca}${modificando ? '<span class="pc-marca pendiente"><i class="ti ti-pencil" aria-hidden="true"></i> Modificando</span>' : ''}${d?.partida_id ? `<span class="pc-marca definitiva"><i class="ti ti-notebook" aria-hidden="true"></i> Partida ${esc(nombrePartida(d.partida_id))}</span>` : ''}${d?.conciliado ? '<span class="pc-marca aprobada">Conciliado</span>' : ''}</div>
            <div class="tk-titulo-acciones">
              ${ctx.admin && d && !modificando ? '<button type="button" class="boton secundario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>' : ''}
              ${cfg.liquidaciones && ed ? cfg.liquidaciones.map((l) => `<button type="button" class="boton secundario-sm" data-proximamente="${esc(l.texto)}" data-modulo="${esc(l.modulo)}" title="Se habilita cuando exista el módulo de ${esc(l.modulo)}"><i class="ti ${l.icono}" aria-hidden="true"></i> ${esc(l.texto)}</button>`).join('') : ''}
              ${d && !modificando ? '<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>' : ''}
              ${puede ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="anular"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>' : ''}
              ${d && ctx.superAdmin && !d.partida_id && !modificando ? `<button type="button" class="boton secundario-sm rp-peligro" data-eliminar="${d.id}"><i class="ti ti-trash" aria-hidden="true"></i> Eliminar</button>` : ''}
              ${puede && !contabilizado() ? '<button type="button" class="boton secundario-sm" data-accion="partida" title="Genera la partida contable con el detalle contable"><i class="ti ti-notebook" aria-hidden="true"></i> Generar partida</button>' : ''}
              ${puede ? '<button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}
              ${modificando ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}
              ${ed ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${d ? 'Guardar cambios' : 'Registrar'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          ${d && d.estado === 'ANULADO' ? `<p class="tk-aviso bm-anulado"><i class="ti ti-ban" aria-hidden="true"></i> Anulado por ${esc(d.anulado_por || '')} el ${esc(fmt.fechaHora(d.anulado_en))}: ${esc(d.motivo_anulacion || '')}</p>` : ''}

          <div class="bm-cabecera ${ed ? 'editando' : 'consulta'}">
            <section class="bm-banco">
              <div class="bm-banco-id"><span class="bk-cod" data-banco-cod>${banco?.codigo ?? ''}</span><div><small>Banco</small><b data-banco-nombre title="${esc(banco?.nombre || '')}">${esc(banco?.nombre || '')}</b></div></div>
              <label class="campo bm-cta"><span>Cuenta bancaria *</span><select name="cuenta_bancaria_id" ${disC}>${cuentas.filter((c) => c.activo || c.id === v.cuenta_bancaria_id).map((c) => `<option value="${c.id}" ${v.cuenta_bancaria_id === c.id ? 'selected' : ''}>${esc(c.numero)} · ${esc(c.nombre)}</option>`).join('')}</select></label>
              <label class="campo bm-num"><span>${esc(cfg.etiquetaNumero)}</span><input name="numero_documento" value="${esc(v.numero_documento || '')}" maxlength="40" ${dis}></label>
            </section>
            <section class="bm-importe">
              <label class="campo"><span>Valor *</span><input type="number" step="0.01" min="0" name="valor" value="${esc(String(v.valor ?? ''))}" ${disC}></label>
              <div class="bm-ml"><span>Valor en quetzales</span><b data-valor-ml>Q ${fmt.monto(valorMl)}</b></div>
            </section>

            <section class="bm-bloque bm-control">
              <h3 class="ta-col-titulo"><i class="ti ti-shield-check" aria-hidden="true"></i> Control</h3>
              <dl>
                ${dato('Folio', d ? `<b>${d.folio}</b>` : 'Automático')}
                ${dato('Estado', d ? esc(d.estado) : 'Sin registrar')}
                ${dato('Póliza', d?.partida_id ? `<b>${esc(nombrePartida(d.partida_id))}</b>` : '')}
                ${dato('Operador', `<span ${d ? '' : 'data-reloj'}>${esc(d ? d.usuario || '' : (ctx.yo.usuario || '').toUpperCase())}</span> <small>${esc(fmt.fechaHora(d ? d.fecha_operacion : new Date()))}</small>`)}
                ${dato('Actualiza', d?.modificado_en ? `${esc(d.modificado_por_nombre || '')} <small>${esc(fmt.fechaHora(d.modificado_en))}</small>` : '')}
                ${dato('Fecha anula', d?.anulado_en ? `${esc(fmt.fechaHora(d.anulado_en))}<small title="${esc(d.motivo_anulacion || '')}">${esc(d.anulado_por || '')}</small>` : '')}
              </dl>
              <div class="bm-comprobante ${conImagen ? 'con' : ''}">
                ${conImagen ? `
                  <button type="button" class="bm-miniatura" data-accion="ver-comprobante" title="Ver ${esc(nombreImagen)}">${esPdf ? '<i class="ti ti-file-type-pdf" aria-hidden="true"></i>' : '<img data-comprobante-img alt="">'}</button>
                  <div class="bm-comprobante-txt"><small>Imagen del ${cfg.tipo === 'DEPOSITO' ? 'depósito' : 'documento'}</small><b title="${esc(nombreImagen)}">${esc(nombreImagen)}</b>${comprobanteNuevo ? '<span class="tk-tenue">Se sube al guardar</span>' : ''}</div>
                  ${ed ? `<label class="rp-enlace bm-cambiar">Cambiar<input type="file" accept="image/*,application/pdf" data-comprobante hidden></label><button type="button" class="icono-boton" data-accion="quitar-comprobante" aria-label="Quitar la imagen"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}`
                : ed ? `<label class="bm-adjuntar"><i class="ti ti-photo-plus" aria-hidden="true"></i><span><b>Adjuntar imagen del ${cfg.tipo === 'DEPOSITO' ? 'depósito' : 'documento'}</b><small>Foto o escaneo de la boleta (imagen o PDF, hasta 10 MB)</small></span><input type="file" accept="image/*,application/pdf" data-comprobante hidden></label>`
                : `<span class="bm-sin-imagen"><i class="ti ti-photo-off" aria-hidden="true"></i> Sin imagen adjunta${puede ? ' · usa «Modificar» para adjuntarla' : ''}</span>`}
              </div>
              <button type="button" class="rp-enlace bm-flujo" data-proximamente="Ir a flujo de caja" data-modulo="Flujo de caja"><i class="ti ti-arrows-right-left" aria-hidden="true"></i> Ir a flujo de caja</button>
            </section>

            <section class="bm-bloque bm-datos">
              <h3 class="ta-col-titulo"><i class="ti ti-calendar-dollar" aria-hidden="true"></i> Datos ${cfg.tipo === 'DEPOSITO' ? 'del depósito' : 'de la nota'}</h3>
              <div class="bm-campos">
                <label class="campo"><span>Fecha *</span><input type="date" name="fecha" value="${esc(v.fecha)}" ${disC}></label>
                <label class="campo"><span>Moneda</span><select name="moneda_id" ${dis}>${ctx.monedas.map((m) => `<option value="${m.id}" ${v.moneda_id === m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
                <label class="campo"><span>Valor cambio</span><input type="number" step="any" min="0" name="tipo_cambio" value="${esc(String(v.tipo_cambio ?? 1))}" ${dis}></label>
                <label class="pc-check bm-check"><input type="checkbox" name="caja_chica" ${v.caja_chica ? 'checked' : ''} ${dis}> Caja chica</label>
                <label class="campo bm-c2"><span>Tipo de operación</span><input list="bm-operaciones" name="tipo_operacion" value="${esc(v.tipo_operacion || '')}" maxlength="40" ${dis}><datalist id="bm-operaciones">${tiposOperacion.map((t) => `<option value="${esc(t)}">`).join('')}</datalist></label>
                <label class="campo bm-c2"><span>Descripción</span><input name="descripcion" value="${esc(v.descripcion || '')}" maxlength="250" placeholder="${cfg.tipo === 'DEPOSITO' ? 'Ej. FE-7074 FE-7075' : 'Concepto de la nota o transferencia'}" ${dis}></label>
              </div>
            </section>
            <section class="bm-bloque bm-tercero">
              <h3 class="ta-col-titulo"><i class="ti ti-user" aria-hidden="true"></i> ${esc(cfg.etiquetaTercero)}</h3>
              <div class="bm-campos">
                <label class="campo"><span>Código</span><input name="tercero_codigo" value="${esc(v.tercero_codigo || '')}" maxlength="20" ${dis}></label>
                <label class="campo bm-c3"><span>${esc(cfg.etiquetaTercero)} (nombre)</span><input name="tercero_nombre" value="${esc(v.tercero_nombre || '')}" maxlength="150" ${dis}></label>
                ${cfg.tipo === 'DEPOSITO' ? `<label class="campo bm-c3"><span>Depositó</span><input name="deposito_por" value="${esc(v.deposito_por || '')}" maxlength="120" placeholder="Persona que hizo el depósito" ${dis}></label>
                <label class="pc-check bm-check"><input type="checkbox" name="clientes_varios" ${v.clientes_varios ? 'checked' : ''} ${dis}> Clientes varios</label>`
                : cfg.terceros.length > 1 ? `<div class="pc-radios bm-radios bm-c4">${cfg.terceros.map((t) => `<label><input type="radio" name="tipo_tercero" value="${t.valor}" ${v.tipo_tercero === t.valor ? 'checked' : ''} ${dis}> ${esc(t.texto)}</label>`).join('')}</div>` : ''}
                ${cfg.terceros.length > 1 && cfg.tipo === 'DEPOSITO' ? '' : cfg.terceros.length > 1 ? '' : `<input type="hidden" name="tipo_tercero" value="${cfg.terceros[0].valor}">`}
              </div>
            </section>
          </div>

          <section class="bm-pestanas">
            <div class="bm-tabs-barra">
              <div class="rp-pestanas" role="tablist">${pestanas().map((p) => `<button type="button" role="tab" data-pestana="${p.id}" class="${pestana === p.id ? 'activa' : ''}" aria-selected="${pestana === p.id}"><i class="ti ${p.icono}" aria-hidden="true"></i> ${esc(p.texto)}${p.id === 'CONTABLE' ? (lineas.length ? ` <b>${lineas.length}</b>` : '') : p.id === 'LISTADO' ? ` <b>${docs.length}</b>` : (cuenta(p.id) ? ` <b data-cuenta-tab="${p.id}">${cuenta(p.id)}</b>` : '')}</button>`).join('')}</div>
              <span class="bm-aplicado" data-docs-total></span>
            </div>

            <div class="bm-panel" data-panel="CONTABLE" ${pestana === 'CONTABLE' ? '' : 'hidden'}>
              <div class="bm-transaccion">
                <label class="campo"><span>Transacción</span><select name="transaccion_id" ${disC}><option value="">Elegir transacción…</option>${transacciones.filter((t) => t.aplica_poliza).map((t) => `<option value="${t.id}" ${v.transaccion_id === t.id ? 'selected' : ''}>${t.numero} · ${esc(t.descripcion)}</option>`).join('')}</select></label>
                ${ed && !contabilizado() ? '<button type="button" class="boton secundario-sm" data-accion="contabilizar" title="Arma el detalle contable con las cuentas de la transacción y el valor del documento"><i class="ti ti-calculator" aria-hidden="true"></i> Contabilizar</button>' : ''}
                ${ed && !contabilizado() ? '<button type="button" class="rp-enlace" data-accion="linea"><i class="ti ti-plus" aria-hidden="true"></i> Agregar línea</button>' : ''}
              </div>
              <div class="pc-lineas"><table><thead><tr><th class="pc-n">Línea</th><th class="pc-cta">Cuenta</th><th>Nombre de la cuenta</th><th class="num">Debe</th><th class="num">Haber</th><th class="bm-centro">Centro</th><th>Nombre del centro</th><th></th></tr></thead>
                <tbody data-tabla="lineas">${lineas.map((l, i) => filaLinea(l, i, disC)).join('') || '<tr><td colspan="8" class="tk-vacio">Elige la transacción y presiona «Contabilizar».</td></tr>'}</tbody>
                <tfoot><tr><td colspan="3" class="pc-totales-lbl">Totales</td><td class="num" data-total="debe"></td><td class="num" data-total="haber"></td><td colspan="2" data-cuadre></td><td></td></tr></tfoot></table></div>
            </div>
            ${cfg.documentos.map((t) => panelDocumentos(t, dis)).join('')}
            <div class="bm-panel bm-listado" data-panel="LISTADO" ${pestana === 'LISTADO' ? '' : 'hidden'}></div>
          </section>
          <datalist id="bm-cuentas">${contables.filter((c) => c.movimiento).map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>
          <datalist id="bm-centros">${centros.filter((c) => c.movimiento).map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>
        </form>`;
      ctx.pDet.querySelector('[data-panel=LISTADO]').appendChild(ctx.pMae);
      totalizar();
      miniatura();
    }

    async function miniatura() {
      const img = ctx.pDet.querySelector('[data-comprobante-img]');
      if (!img) return;
      if (comprobanteNuevo) { img.src = URL.createObjectURL(comprobanteNuevo); return; }
      const { data } = await sb.storage.from(BUCKET).createSignedUrl(actual.comprobante_ruta, 600);
      if (data?.signedUrl && img.isConnected) img.src = data.signedUrl;
    }
    async function verComprobante() {
      if (comprobanteNuevo) return window.open(URL.createObjectURL(comprobanteNuevo), '_blank');
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(actual.comprobante_ruta, 600);
      if (error || !data?.signedUrl) return window.FIN.aviso('No se pudo abrir la imagen del documento');
      window.open(data.signedUrl, '_blank');
    }
    // Sube la imagen elegida o quita la guardada, después de guardar el documento.
    async function guardarComprobante(id, anterior) {
      if (comprobanteNuevo) {
        const limpio = comprobanteNuevo.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);
        const ruta = `${ctx.sel.loc}/${id}/${Date.now()}-${limpio}`;
        const up = await sb.storage.from(BUCKET).upload(ruta, comprobanteNuevo, { contentType: comprobanteNuevo.type || 'application/octet-stream' });
        if (up.error) return false;
        const r = await sb.from('movimientos_bancarios').update({ comprobante_ruta: ruta, comprobante_nombre: comprobanteNuevo.name, comprobante_tipo: comprobanteNuevo.type || null }).eq('id', id);
        if (r.error) { await sb.storage.from(BUCKET).remove([ruta]); return false; }
        if (anterior) await sb.storage.from(BUCKET).remove([anterior]);
      } else if (quitarComprobante && anterior) {
        const r = await sb.from('movimientos_bancarios').update({ comprobante_ruta: null, comprobante_nombre: null, comprobante_tipo: null }).eq('id', id);
        if (r.error) return false;
        await sb.storage.from(BUCKET).remove([anterior]);
      }
      return true;
    }

    // Columnas de cada tipo de documento aplicado.
    const COLUMNAS = {
      FACTURA: [['numero', 'Factura'], ['nombre', 'Nombre factura', 'ancho'], ['valor', 'Valor factura', 'num'], ['valor_ml', 'Valor factura Q', 'auto'], ['abono', 'Valor abono', 'num'], ['abono_ml', 'Valor abono Q', 'auto'], ['contrato', 'Contrato']],
      RECIBO: [['serie', 'Serie', 'corto'], ['numero', 'Recibo físico'], ['tercero', 'Cliente', 'corto'], ['nombre', 'Nombre recibo', 'ancho'], ['valor', 'Valor', 'num'], ['fecha', 'Fecha recibo', 'fecha'], ['estado', 'Estado', 'estado']],
      NOTA: [['numero', 'Número'], ['tercero', 'Código', 'corto'], ['nombre', 'Nombre', 'ancho'], ['valor', 'Valor', 'num'], ['fecha', 'Fecha', 'fecha'], ['estado', 'Estado']],
    };
    COLUMNAS.OTRO = COLUMNAS.NOTA;
    let varios = false;     // «Clientes varios» del documento abierto
    const columnas = (tipo) => tipo === 'FACTURA' && varios
      ? [COLUMNAS.FACTURA[0], ['tercero', 'Cliente', 'corto'], ...COLUMNAS.FACTURA.slice(1)]
      : COLUMNAS[tipo];
    const sumaCampo = (ls, c) => fmt.redondear(ls.reduce((s, x) => s + Number(x[c] || 0), 0));
    const totalCols = { FACTURA: ['valor', 'valor_ml', 'abono', 'abono_ml'], RECIBO: ['valor'], NOTA: ['valor'], OTRO: ['valor'] };

    function panelDocumentos(tipo, dis) {
      const cols = columnas(tipo);
      const filas = documentos.map((x, i) => [x, i]).filter(([x]) => x.tipo === tipo);
      return `
        <div class="bm-panel" data-panel="${tipo}" ${pestana === tipo ? '' : 'hidden'}>
          <div class="pc-lineas"><table><thead><tr>${cols.map(([, t, k]) => `<th class="${k === 'num' || k === 'auto' ? 'num' : ''}">${t}</th>`).join('')}<th>${dis ? '' : `<button type="button" class="rp-enlace" data-accion="documento" data-tipo="${tipo}"><i class="ti ti-plus" aria-hidden="true"></i> Agregar</button>`}</th></tr></thead>
            <tbody>${filas.map(([x, i]) => filaDocumento(x, i, dis)).join('') || `<tr><td colspan="${cols.length + 1}" class="tk-vacio">Sin ${esc(TITULO_DOC[tipo](cfg).toLowerCase())}.${dis ? '' : ' Usa «Agregar».'}</td></tr>`}</tbody>
            <tfoot><tr>${cols.map(([c], k) => totalCols[tipo].includes(c) ? `<td class="num" data-suma="${tipo}-${c}"></td>` : `<td ${k === 0 ? 'class="pc-totales-lbl"' : ''}>${k === 0 ? 'Totales' : ''}</td>`).join('')}<td></td></tr></tfoot></table></div>
        </div>`;
    }

    function filaDocumento(x, i, dis) {
      const celda = ([c, , k]) => {
        if (k === 'auto') return `<td class="num bm-auto" data-auto="${c}">${fmt.monto(x[c === 'valor_ml' ? 'valor' : 'abono'] * tcActual())}</td>`;
        if (k === 'num') return `<td class="num"><input type="number" step="0.01" min="0" data-campo="${c}" value="${x[c] || ''}" ${c === 'abono' && x.abono && x.abono !== x.valor ? 'data-manual="1"' : ''} ${dis} aria-label="${c}"></td>`;
        if (k === 'fecha') return `<td><input type="date" data-campo="${c}" value="${esc(x[c])}" ${dis} aria-label="Fecha"></td>`;
        if (k === 'estado') return `<td><select data-campo="${c}" ${dis}>${['EMITIDO', 'APLICADO', 'ANULADO'].map((e) => `<option ${(x[c] || 'EMITIDO') === e ? 'selected' : ''}>${e}</option>`).join('')}</select></td>`;
        return `<td class="${k === 'corto' ? 'bm-codigo' : ''}"><input data-campo="${c}" value="${esc(x[c] || '')}" maxlength="${k === 'ancho' ? 150 : 40}" ${dis} aria-label="${c}"></td>`;
      };
      return `<tr data-docfila="${i}">${columnas(x.tipo).map(celda).join('')}
        <td>${dis ? '' : `<button type="button" class="icono-boton" data-quitar-doc="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>`}</td></tr>`;
    }
    function filaLinea(l, i, dis) {
      const c = contable(l.cuenta_id);
      const cc = centros.find((x) => x.id === l.centro_id);
      return `<tr data-linea="${i}">
        <td class="pc-n">${i + 1}</td>
        <td class="pc-cta"><input list="bm-cuentas" data-campo="cuenta" value="${esc(c ? c.codigo : l.codigo || '')}" ${dis} aria-label="Cuenta"></td>
        <td class="pc-nombre" data-nombre>${c ? esc(c.nombre) : l.codigo ? '<span class="oc-pendiente">Cuenta pendiente: no existe en el catálogo</span>' : ''}</td>
        <td class="num"><input type="number" step="0.01" min="0" data-campo="debe" value="${l.debe || ''}" ${dis} aria-label="Debe"></td>
        <td class="num"><input type="number" step="0.01" min="0" data-campo="haber" value="${l.haber || ''}" ${dis} aria-label="Haber"></td>
        <td class="bm-centro"><input list="bm-centros" data-campo="centro" value="${esc(cc ? cc.codigo : l.centro_codigo || '')}" ${dis} aria-label="Centro de costo"></td>
        <td class="pc-nombre" data-nombre-centro>${cc ? esc(cc.nombre) : ''}</td>
        <td>${dis ? '' : `<button type="button" class="icono-boton" data-quitar-linea="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>`}</td></tr>`;
    }

    const tcActual = () => Number(ctx.pDet.querySelector('[name=tipo_cambio]')?.value || actual?.tipo_cambio || 1) || 1;

    function totalizar() {
      const d = fmt.redondear(lineas.reduce((s, l) => s + Number(l.debe || 0), 0));
      const h = fmt.redondear(lineas.reduce((s, l) => s + Number(l.haber || 0), 0));
      const td = ctx.pDet.querySelector('[data-total=debe]');
      if (!td) return;
      td.textContent = fmt.monto(d);
      ctx.pDet.querySelector('[data-total=haber]').textContent = fmt.monto(h);
      ctx.pDet.querySelector('[data-cuadre]').innerHTML = !lineas.length ? '' : d === h && d > 0 ? '<span class="pc-cuadre ok"><i class="ti ti-circle-check" aria-hidden="true"></i> Cuadra</span>' : `<span class="pc-cuadre no"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Diferencia ${fmt.monto(Math.abs(d - h))}</span>`;
      const tc = tcActual();
      ctx.pDet.querySelectorAll('tr[data-docfila]').forEach((tr) => {
        const x = documentos[Number(tr.dataset.docfila)];
        tr.querySelectorAll('[data-auto]').forEach((c) => { c.textContent = fmt.monto((c.dataset.auto === 'valor_ml' ? x.valor : x.abono) * tc); });
      });
      Object.entries(totalCols).forEach(([tipo, cs]) => {
        const ls = documentos.filter((x) => x.tipo === tipo).map((x) => ({ ...x, valor_ml: x.valor * tc, abono_ml: x.abono * tc }));
        cs.forEach((c) => { const e = ctx.pDet.querySelector(`[data-suma="${tipo}-${c}"]`); if (e) e.textContent = fmt.monto(sumaCampo(ls, c)); });
      });
      // Lo aplicado: abonos de facturas más el valor de los demás documentos, contra el valor del documento.
      const aplicado = fmt.redondear(documentos.reduce((s, x) => s + Number(x.tipo === 'FACTURA' ? x.abono : x.valor) || 0, 0));
      const valor = fmt.redondear(ctx.pDet.querySelector('[name=valor]')?.value || 0);
      const e = ctx.pDet.querySelector('[data-docs-total]');
      if (e) e.innerHTML = !documentos.length ? '' : aplicado === valor ? `<i class="ti ti-circle-check" aria-hidden="true"></i> Aplicado ${fmt.monto(aplicado)} de ${fmt.monto(valor)}` : `<span class="pc-rojo"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Aplicado ${fmt.monto(aplicado)} de ${fmt.monto(valor)}</span>`;
    }

    function leerEncabezado(form) {
      const el = form.elements;
      return {
        cuenta_bancaria_id: Number(el.cuenta_bancaria_id.value), numero_documento: el.numero_documento.value.trim() || null, fecha: el.fecha.value,
        moneda_id: Number(el.moneda_id.value), tipo_cambio: Number(el.tipo_cambio.value) || 1, valor: fmt.redondear(el.valor.value),
        descripcion: el.descripcion.value, tipo_tercero: form.querySelector('[name=tipo_tercero]:checked')?.value || el.tipo_tercero.value,
        tercero_codigo: el.tercero_codigo.value.trim() || null, tercero_nombre: el.tercero_nombre.value.trim().toUpperCase() || null,
        tipo_operacion: el.tipo_operacion.value.trim() || null, transaccion_id: el.transaccion_id.value ? Number(el.transaccion_id.value) : null,
        caja_chica: el.caja_chica.checked, clientes_varios: !!el.clientes_varios?.checked, deposito_por: el.deposito_por ? el.deposito_por.value.trim().toUpperCase() || null : null
      };
    }
    function leerFilas() {
      ctx.pDet.querySelectorAll('tr[data-docfila]').forEach((tr) => {
        const x = documentos[Number(tr.dataset.docfila)];
        tr.querySelectorAll('[data-campo]').forEach((e) => {
          const c = e.dataset.campo;
          x[c] = c === 'valor' || c === 'abono' ? fmt.redondear(e.value) : e.value.trim();
        });
      });
      ctx.pDet.querySelectorAll('tr[data-linea]').forEach((tr) => {
        const l = lineas[Number(tr.dataset.linea)];
        const cod = tr.querySelector('[data-campo=cuenta]').value.trim();
        const c = contables.find((x) => x.codigo === cod && x.movimiento);
        l.cuenta_id = c ? c.id : null;
        l.codigo = cod;
        tr.querySelector('[data-nombre]').innerHTML = c ? esc(c.nombre) : cod ? '<span class="pc-error">No es una cuenta de movimiento de la localidad</span>' : '';
        const codC = tr.querySelector('[data-campo=centro]').value.trim();
        const cc = centros.find((x) => x.codigo === codC && x.movimiento);
        l.centro_id = cc ? cc.id : null;
        l.centro_codigo = codC;
        tr.querySelector('[data-nombre-centro]').innerHTML = cc ? esc(cc.nombre) : codC ? '<span class="pc-error">No es un centro de movimiento</span>' : '';
        l.debe = fmt.redondear(tr.querySelector('[data-campo=debe]').value);
        l.haber = fmt.redondear(tr.querySelector('[data-campo=haber]').value);
      });
    }
    function repintar() {
      const form = ctx.pDet.querySelector('.bm-form');
      if (!form) return;
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
        return { cuenta_id: c && c.movimiento ? c.id : null, codigo: c ? c.codigo : t.cuenta_codigo, centro_id: null, debe: t.naturaleza === 'D' ? m : 0, haber: t.naturaleza === 'H' ? m : 0 };
      });
      pestana = 'CONTABLE';
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
      if (!v.descripcion.trim() && documentos.some((x) => x.numero)) {
        v.descripcion = documentos.filter((x) => x.numero).map((x) => [x.serie, x.numero].filter(Boolean).join('-')).join(' ').slice(0, 250);
      }
      const malas = lineas.filter((l) => (l.debe || l.haber || l.codigo) && !l.cuenta_id);
      if (malas.length && !contabilizado()) { pestana = 'CONTABLE'; error.textContent = 'Hay líneas del detalle contable sin una cuenta de movimiento válida: corrígelas o quítalas.'; return; }
      if (lineas.some((l) => l.centro_codigo && !l.centro_id) && !contabilizado()) { error.textContent = 'Hay líneas con un centro de costo que no es de movimiento: corrígelo o déjalo vacío.'; return; }
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
        if (docsV.length) {
          const r = await sb.from('movimiento_documentos').insert(docsV.map((x) => ({
            movimiento_id: id, tipo: x.tipo, serie: x.serie || null, numero: x.numero, tercero: x.tercero || null, nombre: x.nombre || null,
            valor: x.valor || 0, valor_ml: fmt.redondear((x.valor || 0) * v.tipo_cambio), abono: x.abono || 0, abono_ml: fmt.redondear((x.abono || 0) * v.tipo_cambio),
            fecha: x.fecha || null, estado: x.estado || null, contrato: x.contrato || null
          })));
          if (r.error) throw r.error;
        }
        if (!contabilizado()) {
          const delL = await sb.from('movimiento_lineas').delete().eq('movimiento_id', id);
          if (delL.error) throw delL.error;
          const ls = lineas.filter((l) => l.cuenta_id && (l.debe || l.haber));
          if (ls.length) { const r = await sb.from('movimiento_lineas').insert(ls.map((l, i) => ({ movimiento_id: id, linea: i + 1, cuenta_id: l.cuenta_id, centro_id: l.centro_id || null, debe: l.debe || 0, haber: l.haber || 0 }))); if (r.error) throw r.error; }
        }
        const okImagen = await guardarComprobante(id, actual?.comprobante_ruta);
        window.FIN.aviso(`${actual ? `${cfg.nombre} guardado` : `${cfg.nombre} registrado`}${okImagen ? '' : ' · la imagen no se pudo subir'}`);
        actual = { id };
        modificando = false;
        await consultar();
      } catch (err) {
        error.textContent = /column .* does not exist|schema cache/.test(err.message || '') ? 'Falta instalar el script 43 (detalle de depósitos) en Supabase.' : window.UI.traducirError(err);
      } finally {
        boton.disabled = false;
      }
    }

    async function procesar(accion) {
      let motivo = null;
      if (accion === 'ANULAR') { motivo = prompt(`Motivo de la anulación del ${cfg.nombre.toLowerCase()} folio ${actual.folio}:`); if (motivo === null) return; }
      if (accion === 'PARTIDA') {
        const e = ctx.pDet.querySelector('.modal-error');
        const d = fmt.redondear(lineas.reduce((t, l) => t + Number(l.debe || 0), 0));
        const h = fmt.redondear(lineas.reduce((t, l) => t + Number(l.haber || 0), 0));
        const ml = fmt.redondear(actual.valor_ml);
        const aviso = (txt) => { pestana = 'CONTABLE'; ctx.pDet.querySelector('[data-pestana=CONTABLE]')?.click(); if (e) e.textContent = txt; };
        if (!lineas.length) return aviso('Arma y guarda el detalle contable antes de generar la partida.');
        if (d !== h) return aviso(`El detalle contable no cuadra: debe ${fmt.monto(d)} y haber ${fmt.monto(h)}.`);
        if (d !== ml) return aviso(`El detalle contable (${fmt.monto(d)}) no coincide con el valor en quetzales (${fmt.monto(ml)}).`);
        const aplicado = fmt.redondear(documentos.reduce((t, x) => t + Number(x.tipo === 'FACTURA' ? x.abono : x.valor) || 0, 0));
        const nota = documentos.length && aplicado !== fmt.redondear(actual.valor) ? `\n\nAtención: lo aplicado en documentos (${fmt.monto(aplicado)}) no es igual al valor (${fmt.monto(actual.valor)}).` : '';
        if (!confirm(`¿Generar la partida contable del ${cfg.nombre.toLowerCase()} folio ${actual.folio} por Q ${fmt.monto(ml)}? Después ya no se cambia su detalle contable.${nota}`)) return;
      }
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
      const banco = ctx.banco(cb?.banco_id);
      const mon = ctx.moneda(d.moneda_id);
      const tc = Number(d.tipo_cambio || 1);
      const n = (x) => fmt.monto(x);
      const tabla = (tipo) => {
        const ls = documentos.filter((x) => x.tipo === tipo);
        if (!ls.length) return '';
        const cols = columnas(tipo);
        const valorDe = (x, c) => c === 'valor_ml' ? x.valor * tc : c === 'abono_ml' ? x.abono * tc : x[c];
        const esNum = (k) => k === 'num' || k === 'auto';
        return `<h3>${esc(TITULO_DOC[tipo](cfg))}</h3><table><thead><tr>${cols.map(([, t, k]) => `<th class="${esNum(k) ? 'n' : ''}">${t}</th>`).join('')}</tr></thead>
          <tbody>${ls.map((x) => `<tr>${cols.map(([c, , k]) => `<td class="${esNum(k) ? 'n' : ''}">${esNum(k) ? n(valorDe(x, c)) : k === 'fecha' ? esc(fmt.fechaDia(x[c])) : esc(x[c] || '')}</td>`).join('')}</tr>`).join('')}</tbody>
          <tfoot><tr>${cols.map(([c, , k], i) => totalCols[tipo].includes(c) ? `<td class="n">${n(ls.reduce((t, x) => t + Number(valorDe(x, c) || 0), 0))}</td>` : `<td>${i === 0 ? 'Totales' : ''}</td>`).join('')}</tr></tfoot></table>`;
      };
      imprimir(`${cfg.nombre} ${d.folio}`, `
        <h1>${esc(cfg.titulo)}</h1>
        <h2>${esc(empresaDe(d))} · folio ${d.folio}${d.estado === 'ANULADO' ? ' · ANULADO' : ''}${d.partida_id ? ` · póliza ${esc(nombrePartida(d.partida_id))}` : ''}</h2>
        <div class="cab">
          <div><b>Banco</b>${esc(banco ? `${banco.codigo} · ${banco.nombre}` : '')}</div><div><b>Cuenta bancaria</b>${esc(cb ? `${cb.numero} · ${cb.nombre}` : '')}</div>
          <div><b>${esc(cfg.etiquetaNumero)}</b>${esc(d.numero_documento || '')}</div><div><b>Fecha</b>${esc(fmt.fechaDia(d.fecha))}</div>
          <div><b>Valor</b>${esc(mon?.simbolo || '')} ${n(d.valor)}</div><div><b>Valor en quetzales</b>Q ${n(d.valor_ml)}</div>
          <div><b>Moneda · cambio</b>${esc(mon?.nombre || '')} · ${tc}</div><div><b>Tipo de operación</b>${esc(d.tipo_operacion || '')}${d.caja_chica ? ' · CAJA CHICA' : ''}</div>
          <div><b>${esc(cfg.etiquetaTercero)}</b>${d.clientes_varios ? 'CLIENTES VARIOS' : esc([d.tercero_codigo, d.tercero_nombre].filter(Boolean).join(' · '))}</div>
          ${cfg.tipo === 'DEPOSITO' ? `<div><b>Depositó</b>${esc(d.deposito_por || '')}</div>` : ''}
          <div><b>Operador</b>${esc(d.usuario || '')} · ${esc(fmt.fechaHora(d.fecha_operacion))}</div>
          ${d.anulado_en ? `<div><b>Anulado</b>${esc(d.anulado_por || '')} · ${esc(fmt.fechaHora(d.anulado_en))} · ${esc(d.motivo_anulacion || '')}</div>` : ''}
          ${d.descripcion ? `<div style="grid-column:1/-1"><b>Descripción</b>${esc(d.descripcion)}</div>` : ''}</div>
        ${cfg.documentos.map(tabla).join('')}
        ${lineas.length ? `<h3>Detalle contable</h3><table><thead><tr><th>Línea</th><th>Cuenta</th><th>Nombre</th><th class="n">Debe</th><th class="n">Haber</th><th>Centro</th><th>Nombre del centro</th></tr></thead><tbody>${lineas.map((l, i) => { const c = contable(l.cuenta_id); const cc = centros.find((x) => x.id === l.centro_id); return `<tr><td>${i + 1}</td><td>${esc(c?.codigo || '')}</td><td>${esc(c?.nombre || '')}</td><td class="n">${l.debe ? n(l.debe) : ''}</td><td class="n">${l.haber ? n(l.haber) : ''}</td><td>${esc(cc?.codigo || '')}</td><td>${esc(cc?.nombre || '')}</td></tr>`; }).join('')}</tbody>
          <tfoot><tr><td colspan="3">Totales</td><td class="n">${n(lineas.reduce((t, l) => t + l.debe, 0))}</td><td class="n">${n(lineas.reduce((t, l) => t + l.haber, 0))}</td><td colspan="2"></td></tr></tfoot></table>` : ''}
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
      if (e.target.matches('[data-comprobante]')) {
        const archivo = e.target.files[0];
        if (!archivo) return;
        if (!/^image\//.test(archivo.type) && archivo.type !== 'application/pdf') return window.FIN.aviso('Adjunta una imagen o un PDF');
        if (archivo.size > 10 * 1024 * 1024) return window.FIN.aviso('La imagen pasa de 10 MB');
        comprobanteNuevo = archivo;
        quitarComprobante = false;
        return repintar();
      }
      const form = e.target.closest('.bm-form');
      if (!form) return;
      if (e.target.name === 'cuenta_bancaria_id') {
        // La moneda y su valor de cambio siguen a la cuenta bancaria.
        const cb = cuentaBancaria(Number(e.target.value));
        if (cb) {
          form.elements.moneda_id.value = cb.moneda_id; form.elements.tipo_cambio.value = ctx.moneda(cb.moneda_id)?.cambio || 1;
          const b = ctx.banco(cb.banco_id);
          form.querySelector('[data-banco-cod]').textContent = b?.codigo ?? '';
          form.querySelector('[data-banco-nombre]').textContent = b?.nombre || '';
        }
      }
      if (e.target.name === 'clientes_varios') return repintar();
      if (e.target.name === 'moneda_id') form.elements.tipo_cambio.value = ctx.moneda(Number(e.target.value))?.cambio || 1;
      if (['cuenta_bancaria_id', 'moneda_id', 'tipo_cambio', 'valor'].includes(e.target.name)) {
        const v = leerEncabezado(form);
        form.querySelector('[data-valor-ml]').textContent = `Q ${fmt.monto(v.valor * v.tipo_cambio)}`;
        totalizar();
      }
    });
    cont.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-buscar]')) e.preventDefault(); });
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
      if (e.target.closest('tr[data-docfila]')) {
        const tr = e.target.closest('tr[data-docfila]');
        const abono = tr.querySelector('[data-campo=abono]');
        if (abono && e.target.dataset.campo === 'abono') abono.dataset.manual = e.target.value ? '1' : '';
        if (abono && e.target.dataset.campo === 'valor' && !abono.dataset.manual) abono.value = e.target.value;
      }
      if (e.target.closest('tr[data-linea], tr[data-docfila]')) { leerFilas(); totalizar(); }
      if (['valor', 'tipo_cambio'].includes(e.target.name)) {
        const v = leerEncabezado(form);
        form.querySelector('[data-valor-ml]').textContent = `Q ${fmt.monto(v.valor * v.tipo_cambio)}`;
        totalizar();
      }
    });
    cont.addEventListener('click', async (e) => {
      const tab = e.target.closest('[data-pestana]');
      if (tab) {
        pestana = tab.dataset.pestana;
        ctx.pDet.querySelectorAll('[data-pestana]').forEach((b) => { b.classList.toggle('activa', b === tab); b.setAttribute('aria-selected', b === tab); });
        ctx.pDet.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== pestana; });
        return;
      }
      const bm = e.target.closest('[data-modificar]');
      if (bm) { await abrir(docs.find((d) => String(d.id) === bm.dataset.modificar), true); return ctx.pDet.querySelector('[name=numero_documento]')?.focus(); }
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
        if (a === 'modificar') { modificando = true; repintar(); return ctx.pDet.querySelector('[name=numero_documento]')?.focus(); }
        if (a === 'cancelar') return abrir(actual);
        if (a === 'ver-comprobante') return verComprobante();
        if (a === 'quitar-comprobante') { if (comprobanteNuevo) comprobanteNuevo = null; else quitarComprobante = true; return repintar(); }
        if (a === 'imprimir') return imprimirDocumento();
        if (a === 'anular') return procesar('ANULAR');
        if (a === 'partida') return procesar('PARTIDA');
        if (a === 'contabilizar') return contabilizar();
        if (a === 'documento') {
          leerFilas();
          const t = ac.dataset.tipo || cfg.documentos[0];
          const h = leerEncabezado(ctx.pDet.querySelector('.bm-form'));
          const propio = !(t === 'FACTURA' && h.clientes_varios);
          documentos.push({ tipo: t, serie: '', numero: '', tercero: propio ? h.tercero_codigo || '' : '', nombre: propio ? h.tercero_nombre || '' : '', valor: 0, abono: 0, fecha: t === 'FACTURA' ? '' : h.fecha, estado: t === 'RECIBO' ? 'EMITIDO' : '', contrato: '' });
          pestana = t;
          repintar();
          return ctx.pDet.querySelector(`[data-panel=${t}] tr[data-docfila="${documentos.length - 1}"] [data-campo=${t === 'RECIBO' ? 'serie' : 'numero'}]`)?.focus();
        }
        if (a === 'linea') { leerFilas(); lineas.push({ cuenta_id: null, codigo: '', centro_id: null, debe: 0, haber: 0 }); return repintar(); }
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
