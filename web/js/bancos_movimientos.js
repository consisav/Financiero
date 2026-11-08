// Registros · Bancos · Depósitos multimoneda, Notas de crédito y Notas de débito / transferencias
// (misma pantalla con distinta configuración). Cada documento es de una organización y localidad.
//   Parámetros: organización, localidad, cuenta bancaria, fechas y estado.
//   Encabezado: empresa (organización › localidad), banco y cuenta bancaria, número y valor (con su
//   valor en quetzales), datos (fecha, moneda, valor de cambio, tipo de operación, caja chica),
//   cliente o proveedor, quién depositó, descripción y control (folio, estado, operador, actualiza,
//   póliza, anulación).
//   Pestañas: detalle contable desde una transacción de Objetos contables («Contabilizar»), con
//   centro de costo; facturas de liquidación (valor y abono, en su moneda y en quetzales);
//   recibos físicos (o notas en las notas de crédito y débito).
//   Diseño A (sin desplazar la página): el listado de documentos del período arriba, siempre a la vista, y el
//   documento elegido abajo (cuenta y número, valor, datos, tercero y control) con sus pestañas.
//   Las líneas migradas pueden usar cuentas de otra versión activa del catálogo de la localidad: se buscan
//   aparte para mostrar su código y nombre (con la versión) y se conservan al guardar si no se cambian.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;

  const CONFIG = {
    depositos: {
      tipo: 'DEPOSITO', titulo: 'Depósitos multimoneda', icono: 'ti-cash-banknote', nombre: 'Depósito', plural: 'depósitos', etiquetaNumero: 'Número de depósito',
      terceros: [{ valor: 'CLIENTE', texto: 'Cliente' }], etiquetaTercero: 'Cliente', documentos: ['FACTURA', 'RECIBO'], tituloDocs: 'Facturas y recibos depositados',
      varios: true, etiquetaPor: 'Depositó', ayudaPor: 'Persona que hizo el depósito', queImagen: 'del depósito', ayudaImagen: 'Foto o escaneo de la boleta (imagen o PDF, hasta 10 MB)',
      // Solo ingreso: sin la lista del período; se busca, consulta y reporta en Bancos · Consulta de Depósitos Monetarios.
      soloIngreso: true, consulta: 'consulta-de-depositos'
    },
    'notas-credito': {
      tipo: 'NOTA_CREDITO', titulo: 'Notas de crédito / transferencias', icono: 'ti-file-plus', nombre: 'Nota de crédito', plural: 'notas de crédito', etiquetaNumero: 'Número de nota',
      terceros: [{ valor: 'CLIENTE', texto: 'Cliente' }, { valor: 'CLIENTES VARIOS', texto: 'Clientes varios' }], etiquetaTercero: 'Cliente', documentos: ['FACTURA', 'RECIBO'], tituloDocs: 'Facturas y recibos',
      varios: true, etiquetaPor: 'Ordenante', ayudaPor: 'Quien hizo la transferencia o la nota', queImagen: 'de la nota', ayudaImagen: 'Comprobante de la nota o transferencia (imagen o PDF, hasta 10 MB)',
      soloIngreso: true, consulta: 'consulta-de-notas'
    },
    'notas-debito': {
      tipo: 'NOTA_DEBITO', titulo: 'Notas de débito / transferencias', icono: 'ti-file-minus', nombre: 'Nota de débito', plural: 'notas de débito', etiquetaNumero: 'Número de nota',
      terceros: [{ valor: 'PROVEEDOR PRODUCTOS', texto: 'Proveedor de productos' }, { valor: 'PROVEEDOR SERVICIOS', texto: 'Proveedor de servicios' }], etiquetaTercero: 'Proveedor', documentos: ['NOTA', 'FACTURA', 'OTRO'], tituloDocs: 'Notas y documentos',
      radios: true, etiquetaPor: 'Beneficiario', ayudaPor: 'A quién se pagó o transfirió', queImagen: 'de la nota', ayudaImagen: 'Comprobante de la nota o transferencia (imagen o PDF, hasta 10 MB)',
      liquidaciones: [{ texto: 'Liquidar caja chica', icono: 'ti-cash', modulo: 'Caja chica' }, { texto: 'Liquidar compras', icono: 'ti-shopping-cart', modulo: 'Compras' }],
      soloIngreso: true, consulta: 'consulta-de-notas'
    },
    // Cheques · Emisión de cheques: el número sale de la chequera de la cuenta bancaria.
    'emision-de-cheques': {
      tipo: 'CHEQUE', titulo: 'Emisión de cheques', icono: 'ti-writing', nombre: 'Cheque', plural: 'cheques', etiquetaNumero: 'Número de cheque', grupo: 'Cheques',
      terceros: [{ valor: 'PROVEEDOR PRODUCTOS', texto: 'Proveedor de productos' }, { valor: 'PROVEEDOR SERVICIOS', texto: 'Proveedor de servicios' }], etiquetaTercero: 'Proveedor', documentos: ['FACTURA', 'OTRO'], tituloDocs: 'Facturas pagadas',
      radios: true, etiquetaPor: 'A favor de', ayudaPor: 'Beneficiario: el nombre que se imprime en el cheque', queImagen: 'del cheque', ayudaImagen: 'Cheque firmado o constancia de entrega (imagen o PDF, hasta 10 MB)',
      liquidaciones: [{ texto: 'Liquidar compras', icono: 'ti-shopping-cart', modulo: 'Compras' }],
      cheque: true, soloIngreso: true, consulta: 'consulta-de-cheques'
    }
  };
  const IVA = 0.12;
  const TITULO_DOC = {
    FACTURA: (cfg) => cfg.tipo === 'CHEQUE' ? 'Facturas pagadas' : cfg.tipo === 'NOTA_DEBITO' ? 'Facturas de proveedor' : 'Facturas de liquidación',
    RECIBO: () => 'Recibos físicos',
    NOTA: () => 'Notas',
    OTRO: () => 'Otros documentos'
  };
  const ICONO_DOC = { FACTURA: 'ti-file-invoice', RECIBO: 'ti-receipt', NOTA: 'ti-file-text', OTRO: 'ti-files' };

  // Valor en letras para el cheque: 6153.84 → «SEIS MIL CIENTO CINCUENTA Y TRES QUETZALES CON 84/100».
  const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
    'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  function menorMil(x) {
    if (x === 100) return 'CIEN';
    const r = x % 100;
    const dec = r < 30 ? UNIDADES[r] : `${DECENAS[Math.floor(r / 10)]}${r % 10 ? ` Y ${UNIDADES[r % 10]}` : ''}`;
    return [CENTENAS[Math.floor(x / 100)], dec].filter(Boolean).join(' ');
  }
  // También la usan otras pantallas (p. ej. Recibos).
  window.BANCOS.enLetras = (v, m) => enLetras(v, m);
  function enLetras(valor, moneda = 'QUETZALES') {
    const centavos = Math.round(Number(valor || 0) * 100);
    const entero = Math.floor(centavos / 100);
    const millones = Math.floor(entero / 1e6);
    const miles = Math.floor((entero % 1e6) / 1000);
    const resto = entero % 1000;
    const partes = [];
    if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : `${menorMil(millones)} MILLONES`);
    if (miles) partes.push(miles === 1 ? 'MIL' : `${menorMil(miles)} MIL`);
    if (resto) partes.push(menorMil(resto));
    // «UN QUETZAL», «UN MILLÓN DE QUETZALES».
    const nombre = entero === 1 && /ES$/.test(moneda) ? moneda.slice(0, -2) : moneda;
    const de = millones && !miles && !resto ? 'DE ' : '';
    return `${partes.join(' ') || 'CERO'} ${de}${nombre} CON ${String(centavos % 100).padStart(2, '0')}/100`;
  }

  function pantallaMovimiento(cont, cfg, extra) {
    const ctx = montar(cont, { titulo: cfg.titulo, icono: cfg.icono, clase: `bk-movimientos${cfg.cheque ? ' bk-cheques' : ''}${cfg.soloIngreso ? ' bm-solo' : ''}`, grupo: cfg.grupo || 'Bancos' });
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
    let rango = null;       // si el período está vacío: cuántos documentos tiene la empresa y sus fechas

    const cuentaBancaria = (id) => cuentas.find((c) => c.id === id);
    let otrasCuentas = [];
    const contable = (id) => contables.find((c) => c.id === id) || otrasCuentas.find((c) => c.id === id);
    let modificando = false;        // un documento guardado se edita solo después de «Modificar»
    let comprobanteNuevo = null;    // archivo elegido, se sube al guardar
    let quitarComprobante = false;  // quitar la imagen guardada al guardar
    const editable = () => ctx.admin && (!actual || (actual.estado === 'ACTIVO' && modificando));
    const contabilizado = () => !!actual?.partida_id;
    // Chequera de la cuenta bancaria: número del siguiente cheque y cheques disponibles.
    const chequera = (cb) => {
      if (!cb || cb.cheque_inicial == null || cb.cheque_final == null) return null;
      const siguiente = Number(cb.cheque_inicial) + Number(cb.cheques_utilizados || 0);
      return { siguiente, disponibles: Math.max(0, Number(cb.cheque_final) - siguiente + 1), minimo: Number(cb.minimo_cheques || 0) };
    };
    let modoCheque = 'ambos';      // impresión: cheque y voucher, solo cheque o solo voucher

    function pintarFiltros() {
      if (cfg.soloIngreso) {
        ctx.filtros(`<label class="campo"><span>Cuenta bancaria</span><select name="cuenta"><option value="">Todas</option>${cuentas.map((c) => `<option value="${c.id}" ${String(f.cuenta) === String(c.id) ? 'selected' : ''}>${esc(ctx.nombreCuentaBancaria(c))}</option>`).join('')}</select></label>`);
        return;
      }
      ctx.filtros(`
        <label class="campo"><span>Cuenta bancaria</span><select name="cuenta"><option value="">Todas</option>${cuentas.map((c) => `<option value="${c.id}" ${String(f.cuenta) === String(c.id) ? 'selected' : ''}>${esc(ctx.nombreCuentaBancaria(c))}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Estado</span><select name="estado"><option value="">Todos</option><option ${f.estado === 'ACTIVO' ? 'selected' : ''}>ACTIVO</option><option ${f.estado === 'ANULADO' ? 'selected' : ''}>ANULADO</option></select></label>`);
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      await cargarLocalidad();
      // Enlace a un documento (Consulta de Cheques): se abre con su fecha y su empresa.
      if (extra && /^\d+$/.test(String(extra))) {
        const { data: d } = await sb.from('movimientos_bancarios').select('*').eq('id', Number(extra)).eq('tipo', cfg.tipo).maybeSingle();
        if (d && Number(d.localidad_id) === Number(ctx.sel.loc)) { f.desde = d.fecha; f.hasta = d.fecha; f.cuenta = String(d.cuenta_bancaria_id); f.estado = ''; actual = d; }
      }
      pintarFiltros();
      await consultar();
      let pedida = null;
      try { pedida = Number(sessionStorage.getItem('fin.solicitud-cheque')) || null; sessionStorage.removeItem('fin.solicitud-cheque'); } catch (err) { /* sin almacenamiento */ }
      const x = cfg.cheque && pedida ? solicitudCheque(pedida) : null;
      if (x && x.estado === 'APROBADA' && ctx.admin) {
        await abrir(null);
        pintarDetalle({ ...valoresNuevos(), ...desdeSolicitud(x) });
        window.FIN.aviso(`Cheque con la solicitud ${String(x.numero).padStart(5, '0')}: revisa y presiona «Registrar»`);
      }
    }

    // Cheques: solicitudes de la localidad aprobadas y por emitir, más las ya emitidas (para mostrarlas).
    let solicitudesCheque = [];
    async function cargarSolicitudes() {
      if (!ctx.sel.loc) { solicitudesCheque = []; return; }
      const { data, error } = await sb.from('solicitudes_cheque').select('*').eq('localidad_id', ctx.sel.loc).in('estado', ['APROBADA', 'EMITIDA']).order('numero', { ascending: false }).limit(300);
      solicitudesCheque = error ? [] : data;
    }
    const solicitudCheque = (id) => solicitudesCheque.find((x) => x.id === id);
    // Datos del cheque que vienen de la solicitud aprobada.
    const desdeSolicitud = (x) => ({ solicitud_id: x.id, deposito_por: x.beneficiario, valor: Number(x.monto), moneda_id: x.moneda_id, tipo_cambio: Number(x.tipo_cambio), descripcion: x.descripcion,
      tercero_codigo: x.proveedor_codigo || x.empleado_codigo || '', tercero_nombre: x.proveedor_nombre || x.empleado_nombre || '', ...(x.cuenta_bancaria_id ? { cuenta_bancaria_id: x.cuenta_bancaria_id } : {}) });

    async function cargarLocalidad() {
      [cuentas, contables, centros] = await Promise.all([ctx.cuentasBancarias(), ctx.cuentasContables(), centrosLocalidad()]);
      otrasCuentas = [];
      const { data } = ctx.sel.loc ? await sb.from('transacciones_contables').select('id, numero, descripcion, estado, aplica_poliza, tipo_operacion').eq('localidad_id', ctx.sel.loc).eq('estado', 'ACTIVO').order('numero') : { data: [] };
      transacciones = data || [];
      if (cfg.cheque) await cargarSolicitudes();
      // Fecha inicial por omisión: la del primer documento de la empresa (sin documentos, el inicio del mes).
      const pr = ctx.sel.loc ? await sb.from('movimientos_bancarios').select('fecha').eq('localidad_id', ctx.sel.loc).eq('tipo', cfg.tipo).order('fecha').limit(1) : { data: [] };
      f.desde = pr.data?.[0]?.fecha || `${anio}-${mes}-01`;
      if (f.hasta < f.desde) f.hasta = fmt.hoy();
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
      // Solo ingreso: el documento abierto (recién registrado o abierto desde la Consulta) o uno nuevo.
      if (cfg.soloIngreso) {
        docs = []; partidas = {};
        if (actual?.id) {
          const { data: d } = await sb.from('movimientos_bancarios').select('*').eq('id', actual.id).maybeSingle();
          if (d) {
            docs = [d];
            if (d.partida_id) { const { data: p } = await sb.from('partidas').select('id, mes, numero, estado').eq('id', d.partida_id).maybeSingle(); if (p) partidas[p.id] = p; }
          }
        }
        return abrir(docs[0] || null, modificando);
      }
      // Por páginas de 1,000 (el servidor devuelve como máximo 1,000 filas por consulta), hasta 10,000.
      const data = [];
      for (let p = 0; p < 10000; p += 1000) {
        let q = sb.from('movimientos_bancarios').select('*').eq('localidad_id', ctx.sel.loc).eq('tipo', cfg.tipo).gte('fecha', f.desde).lte('fecha', f.hasta).order('fecha', { ascending: false }).order('folio', { ascending: false }).range(p, p + 999);
        if (f.cuenta) q = q.eq('cuenta_bancaria_id', Number(f.cuenta));
        if (f.estado) q = q.eq('estado', f.estado);
        const { data: pag, error } = await q;
        if (error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
        data.push(...(pag || []));
        if ((pag || []).length < 1000) break;
      }
      docs = data;
      // Sin documentos en el período: cuántos tiene la empresa y entre qué fechas (para ofrecer verlos).
      rango = null;
      if (!docs.length) {
        let qr = sb.from('movimientos_bancarios').select('fecha', { count: 'exact' }).eq('localidad_id', ctx.sel.loc).eq('tipo', cfg.tipo);
        if (f.cuenta) qr = qr.eq('cuenta_bancaria_id', Number(f.cuenta));
        const [a, b] = await Promise.all([qr.order('fecha').limit(1), sb.from('movimientos_bancarios').select('fecha').eq('localidad_id', ctx.sel.loc).eq('tipo', cfg.tipo).order('fecha', { ascending: false }).limit(1)]);
        if (a.count) rango = { n: a.count, desde: a.data?.[0]?.fecha, hasta: b.data?.[0]?.fecha };
      }
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
          <div class="bmc-reportes"><button type="button" class="boton secundario-sm bca-pdf" data-accion="lista-pdf" title="Reporte de la lista en PDF"><i class="ti ti-file-type-pdf" aria-hidden="true"></i><span><b>Imprimir en PDF</b><small>Resumido o detallado</small></span></button><button type="button" class="boton cqc-excel" data-accion="lista-excel" title="Reporte de la lista en Excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i><span><b>Generar Excel</b><small>Resumido o detallado</small></span></button></div>
          ${ctx.admin && ctx.sel.loc && cuentas.length ? `<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>` : ''}
        </header>
        <div class="ta-tabla">
          <table class="bmc-tabla"><colgroup><col class="w-folio"><col class="w-fecha"><col class="w-cta"><col><col class="w-valor"><col class="w-estado"><col class="w-acc"></colgroup>
            <thead><tr><th>Folio · ${esc(cfg.etiquetaNumero.replace('Número de ', '').replace('número de ', ''))}</th><th>Fecha</th><th>Cuenta bancaria</th><th>${esc(cfg.cheque ? cfg.etiquetaPor : cfg.etiquetaTercero)} · descripción</th><th class="num">Valor</th><th>Estado</th><th aria-label="Acciones"></th></tr></thead>
            <tbody>
              ${filas.map((d) => {
                const abierto = ctx.admin && d.estado === 'ACTIVO';
                const cb = cuentaBancaria(d.cuenta_bancaria_id);
                const quien = (cfg.cheque ? d.deposito_por : '') || d.tercero_nombre || (d.clientes_varios ? 'CLIENTES VARIOS' : '') || '';
                const otra = d.moneda_id !== ctx.monedaBase()?.id;
                return `<tr class="${actual && actual.id === d.id ? 'actual' : ''} ${d.estado === 'ANULADO' ? 'pc-anulada' : ''}" data-doc="${d.id}" tabindex="0">
                  <td><b>${d.folio}</b><small>${esc(d.numero_documento || '—')}</small></td>
                  <td>${esc(fmt.fechaDia(d.fecha))}</td>
                  <td title="${esc(ctx.nombreCuentaBancaria(cb))}"><b class="bmc-n">${esc(cb?.numero || '')}</b><small>${esc(ctx.banco(cb?.banco_id)?.siglas || ctx.banco(cb?.banco_id)?.nombre || '')}${cb && ctx.moneda(cb.moneda_id)?.iso !== 'GTQ' ? ` · ${esc(ctx.moneda(cb.moneda_id)?.simbolo || '')}` : ''}</small></td>
                  <td title="${esc(quien)}${d.descripcion ? ` · ${esc(d.descripcion)}` : ''}"><b>${esc(quien || '—')}</b><small>${esc([d.tipo_operacion, d.descripcion].filter(Boolean).join(' · '))}</small></td>
                  <td class="num"><b>${esc(ctx.moneda(d.moneda_id)?.simbolo || '')} ${fmt.monto(d.valor)}</b>${otra ? `<small>Q ${fmt.monto(d.valor_ml)}</small>` : ''}</td>
                  <td class="bmc-estado">${d.estado === 'ANULADO' ? '<span class="pc-marca anulada">Anulado</span>' : '<span class="pc-marca aprobada">Activo</span>'}${d.conciliado ? ' <span class="pc-marca definitiva" title="Conciliado">Concil.</span>' : ''}<small>${d.partida_id ? `Partida ${esc(nombrePartida(d.partida_id))}` : d.origen_anterior ? 'Sistema anterior' : 'Sin partida'}</small></td>
                  <td class="tk-acciones bmc-acc">
                    <button type="button" class="icono-boton bmc-btn" data-modificar="${d.id}" title="${abierto ? 'Modificar' : 'Ver'}" aria-label="${abierto ? 'Modificar' : 'Ver'} el documento ${d.folio}"><i class="ti ${abierto ? 'ti-pencil' : 'ti-eye'}" aria-hidden="true"></i></button>
                    <button type="button" class="icono-boton bmc-btn peligro" data-eliminar="${d.id}" ${ctx.superAdmin && !d.partida_id && !cfg.cheque ? '' : 'disabled'} title="${cfg.cheque ? 'Un cheque no se elimina: anúlalo' : !ctx.superAdmin ? 'Solo el Super Administrador' : d.partida_id ? 'Ya generó su partida: anúlalo' : 'Eliminar'}" aria-label="Eliminar el documento ${d.folio}"><i class="ti ti-trash" aria-hidden="true"></i></button>
                  </td></tr>`;
              }).join('') || `<tr><td colspan="7" class="tk-vacio"><i class="ti ${cfg.icono}" aria-hidden="true"></i>${!cuentas.length ? 'La localidad no tiene cuentas bancarias: créalas en Bancos · Cuentas bancarias.' : docs.length ? 'Ningún documento coincide con la búsqueda.' : rango ? `No hay ${esc(cfg.plural)} entre el ${esc(fmt.fechaDia(f.desde))} y el ${esc(fmt.fechaDia(f.hasta))}. La empresa tiene <b>${rango.n.toLocaleString('es-GT')}</b> ${esc(cfg.plural)}, del ${esc(fmt.fechaDia(rango.desde))} al ${esc(fmt.fechaDia(rango.hasta))}. <button type="button" class="boton primario-sm" data-ver-todos>Ver todos</button>` : 'No hay documentos en ese rango de fechas.'}</td></tr>`}
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
        documentos = (a.data || []).map((x) => ({ tipo: x.tipo, serie: x.serie || '', numero: x.numero, tercero: x.tercero || '', nombre: x.nombre || '', valor: Number(x.valor), abono: Number(x.abono || 0), fecha: x.fecha || '', estado: x.estado || '', contrato: x.contrato || '', compra_id: x.compra_id || null }));
        const faltan = [...new Set((b.data || []).map((x) => x.cuenta_id).filter((id) => id && !contable(id)))];
        if (faltan.length) {
          const o = await sb.from('cuentas').select('id, codigo, nombre, vigente, catalogos_cuentas(version)').in('id', faltan);
          otrasCuentas.push(...(o.data || []).map((k) => ({ ...k, movimiento: true, version: k.catalogos_cuentas?.version, otraVersion: true })));
        }
        lineas = (b.data || []).map((x) => ({ cuenta_id: x.cuenta_id, centro_id: x.centro_id, debe: Number(x.debe), haber: Number(x.haber) }));
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-doc]').forEach((tr) => tr.classList.toggle('actual', !!d && tr.dataset.doc === String(d.id)));
    }

    // Pestañas: detalle contable, una por tipo de documento y el listado del período.
    const pestanas = () => [
      { id: 'CONTABLE', texto: 'Detalle contable', icono: 'ti-list-details' },
      ...cfg.documentos.map((t) => ({ id: t, texto: TITULO_DOC[t](cfg), icono: ICONO_DOC[t] }))
    ];

    // Encabezado de un documento nuevo.
    function valoresNuevos() {
      const cb0 = cuentaBancaria(Number(f.cuenta)) || cuentas[0];
      return { cuenta_bancaria_id: cb0.id, numero_documento: '', fecha: fmt.hoy(), moneda_id: cb0.moneda_id, tipo_cambio: ctx.moneda(cb0.moneda_id)?.cambio || 1, valor: '', descripcion: '', tipo_tercero: cfg.terceros[0].valor, tercero_codigo: '', tercero_nombre: '', tipo_operacion: '', transaccion_id: null, caja_chica: false, clientes_varios: false, deposito_por: '', no_negociable: false, cxc: false, firmado: false, codigo_banco: '', solicitud_id: null };
    }

    function pintarDetalle(v0) {
      const d = actual;
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la organización y la localidad.'); return; }
      if (!cuentas.length) { ctx.pDet.innerHTML = ctx.vacio('La localidad no tiene cuentas bancarias: créalas en Bancos · Cuentas bancarias.'); return; }
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const disC = ed && !contabilizado() ? '' : 'disabled';
      const cb0 = cuentaBancaria(Number(f.cuenta)) || cuentas[0];
      const v = v0 || (d ? { ...d } : valoresNuevos());
      const cb = cuentaBancaria(v.cuenta_bancaria_id) || cb0;
      const ch = cfg.cheque ? chequera(cb) : null;
      // Un cheque impreso ya no cambia su valor ni su beneficiario.
      const disImp = d?.impreso ? 'disabled' : '';
      const banco = ctx.banco(cb.banco_id);
      const valorMl = fmt.redondear(Number(v.valor || 0) * Number(v.tipo_cambio || 1));
      const tiposOperacion = [...new Set(transacciones.map((t) => t.tipo_operacion).filter(Boolean))];
      if (!pestanas().some((p) => p.id === pestana)) pestana = 'CONTABLE';
      varios = !!v.clientes_varios || v.tipo_tercero === 'CLIENTES VARIOS';
      const cuenta = (tipo) => documentos.filter((x) => x.tipo === tipo).length;
      const marca = d ? (d.estado === 'ANULADO' ? '<span class="pc-marca anulada">Anulado</span>' : '<span class="pc-marca aprobada">Activo</span>') : '<span class="pc-marca pendiente">Sin registrar</span>';
      const dato = (etq, val, extra = '') => `<div class="bm-dato ${extra}"><dt>${etq}</dt><dd>${val || '<span class="tk-tenue">—</span>'}</dd></div>`;
      const puede = ctx.admin && d && d.estado === 'ACTIVO' && !modificando;
      // Ingreso (depósitos, notas y cheques · opción B): franja de control bajo el título, banda del documento con el valor
      // destacado y banda del tercero con la descripción.
      const nomDoc = cfg.cheque ? 'Cheque' : cfg.tipo === 'DEPOSITO' ? 'Depósito' : 'Nota';
      const cabA = !cfg.soloIngreso ? '' : `
          <div class="dpb ${ed ? 'editando' : 'consulta'}">
            <div class="dpb-control">
              <span><small>Folio</small><b>${d ? d.folio : 'Automático'}</b></span>
              <span><small>Estado</small><b class="${!d ? 'dpb-pend' : d.estado === 'ANULADO' ? 'pc-rojo' : 'dpb-ok'}">${d ? esc(d.estado) : 'Sin registrar'}</b></span>
              <span><small>Operador</small><b ${d ? '' : 'data-reloj'}>${esc(d ? d.usuario || '' : (ctx.yo.usuario || '').toUpperCase())}</b><em>${esc(fmt.fechaHora(d ? d.fecha_operacion : new Date()))}</em></span>
              <span><small>Póliza</small><b>${d?.partida_id ? esc(nombrePartida(d.partida_id)) : '—'}</b></span>
              ${cfg.cheque ? `<span><small>Cheques disp.</small>${ch ? `<b data-cheques-disp class="${ch.disponibles <= ch.minimo ? 'pc-rojo' : ''}">${ch.disponibles}</b>` : '<b class="pc-rojo" data-cheques-disp>Sin chequera</b>'}</span>` : ''}
              ${cfg.cheque && d?.impreso ? `<span><small>Impreso</small><b>${esc(d.impreso_por || '')}</b><em>${esc(fmt.fechaHora(d.impreso_en))}</em></span>` : ''}
              ${d?.modificado_en ? `<span><small>Actualiza</small><b>${esc(d.modificado_por_nombre || '')}</b><em>${esc(fmt.fechaHora(d.modificado_en))}</em></span>` : ''}
              ${d?.anulado_en ? `<span title="${esc(d.motivo_anulacion || '')}"><small>Anuló</small><b>${esc(d.anulado_por || '')}</b><em>${esc(fmt.fechaHora(d.anulado_en))}</em></span>` : ''}
              <div class="dpb-adjunto">${window.BANCOS.adjunto.html(adjuntoActual({ ed, puede }))}</div>
            </div>
            <section class="bm-bloque dpb-banda dpb-deposito">
              <div class="dpb-campos">
                <h3 class="ta-col-titulo"><i class="ti ${cfg.cheque ? 'ti-writing' : 'ti-building-bank'}" aria-hidden="true"></i> ${nomDoc}</h3>
                <div class="dpb-g dpb-g1">
                  <div class="dpb-banco"><span class="bk-cod" data-banco-cod>${banco?.codigo ?? ''}</span><div><small>Banco</small><b data-banco-nombre title="${esc(banco?.nombre || '')}">${esc(banco?.nombre || '')}</b></div></div>
                  <label class="campo dpb-cta"><span>Cuenta bancaria *</span><select name="cuenta_bancaria_id" ${disC}>${cuentas.filter((c) => c.activo || c.id === v.cuenta_bancaria_id).map((c) => `<option value="${c.id}" ${v.cuenta_bancaria_id === c.id ? 'selected' : ''}>${esc(c.numero)} · ${esc(c.nombre)}</option>`).join('')}</select></label>
                  ${cfg.cheque
                    ? `<div class="campo" title="El número lo asigna la chequera de la cuenta al registrar el cheque"><span>${d ? 'No. cheque' : 'Siguiente cheque'}</span><input value="${esc(d ? d.numero_documento || '' : ch ? String(ch.siguiente) : 'Sin chequera')}" disabled data-cheque-num aria-label="Número de cheque"></div>`
                    : `<label class="campo"><span>No. ${cfg.tipo === 'DEPOSITO' ? 'depósito' : 'nota'}</span><input name="numero_documento" value="${esc(v.numero_documento || '')}" maxlength="40" ${dis}></label>`}
                  <label class="campo"><span>Fecha *</span><input type="date" name="fecha" value="${esc(v.fecha)}" ${disC}></label>
                  <label class="campo"><span>Moneda</span><select name="moneda_id" ${dis || disImp}>${ctx.monedas.map((m) => `<option value="${m.id}" ${v.moneda_id === m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
                  <label class="campo"><span>Cambio</span><input type="number" step="any" min="0" name="tipo_cambio" value="${esc(String(v.tipo_cambio ?? 1))}" ${dis}></label>
                </div>
              </div>
              <div class="dpb-valor">
                <label class="campo"><span>Valor *</span><input type="number" step="0.01" min="0" name="valor" value="${esc(String(v.valor ?? ''))}" placeholder="0.00" ${disC || disImp}></label>
                <b data-valor-ml>Q ${fmt.monto(valorMl)}</b>
              </div>
            </section>
            <section class="bm-bloque dpb-banda">
              <h3 class="ta-col-titulo"><i class="ti ti-user" aria-hidden="true"></i> ${esc(cfg.etiquetaTercero)} y descripción</h3>
              <div class="dpb-g dpb-g2 ${cfg.cheque ? 'dpb-g2c' : ''}">
                <label class="campo"><span>Código</span><input name="tercero_codigo" value="${esc(v.tercero_codigo || '')}" maxlength="20" ${dis}></label>
                <label class="campo"><span>${esc(cfg.etiquetaTercero)}</span><input name="tercero_nombre" value="${esc(v.tercero_nombre || '')}" maxlength="150" ${dis}></label>
                <label class="campo"><span>${esc(cfg.etiquetaPor)}</span><input name="deposito_por" value="${esc(v.deposito_por || '')}" maxlength="120" placeholder="${esc(cfg.ayudaPor)}" ${dis || disImp}></label>
                <label class="campo"><span>Descripción</span><input name="descripcion" value="${esc(v.descripcion || '')}" maxlength="250" placeholder="${cfg.tipo === 'DEPOSITO' ? 'Ej. FE-7074 FE-7075' : cfg.cheque ? 'Concepto del pago' : 'Concepto de la nota o transferencia'}" ${dis}></label>
                <label class="campo"><span>Tipo de operación</span><input list="bm-operaciones" name="tipo_operacion" value="${esc(v.tipo_operacion || '')}" maxlength="40" ${dis}><datalist id="bm-operaciones">${tiposOperacion.map((t) => `<option value="${esc(t)}">`).join('')}</datalist></label>
                ${cfg.cheque ? `<label class="campo" title="Solicitud de cheque aprobada con la que se emite"><span>Solicitud</span><select name="solicitud_id" ${disC || disImp}><option value="">Sin solicitud</option>${solicitudesCheque.filter((x) => x.estado === 'APROBADA' || x.id === v.solicitud_id).map((x) => `<option value="${x.id}" ${v.solicitud_id === x.id ? 'selected' : ''}>${String(x.numero).padStart(5, '0')} · ${esc(x.beneficiario)} · ${fmt.monto(x.monto)}</option>`).join('')}</select></label>` : ''}
              </div>
              <div class="dpb-checks">
                ${cfg.radios ? `<div class="pc-radios dpb-radios">${cfg.terceros.map((t) => `<label><input type="radio" name="tipo_tercero" value="${t.valor}" ${v.tipo_tercero === t.valor ? 'checked' : ''} ${dis}> ${esc(t.texto)}</label>`).join('')}</div>` : `<input type="hidden" name="tipo_tercero" value="${cfg.terceros[0].valor}">`}
                ${cfg.cheque
                  ? `<label class="pc-check" title="Solo se deposita en la cuenta del beneficiario"><input type="checkbox" name="no_negociable" ${v.no_negociable ? 'checked' : ''} ${dis}> No negociable</label>
                    <label class="pc-check" title="El cheque genera una cuenta por cobrar"><input type="checkbox" name="cxc" ${v.cxc ? 'checked' : ''} ${dis}> CXC</label>
                    <label class="pc-check" title="El cheque ya está firmado"><input type="checkbox" name="firmado" ${v.firmado ? 'checked' : ''} ${dis}> Firmado</label>
                    <label class="campo dpb-codbanco"><span>Código banco</span><input name="codigo_banco" value="${esc(v.codigo_banco || '')}" maxlength="30" ${dis}></label>`
                  : `<label class="pc-check"><input type="checkbox" name="caja_chica" ${v.caja_chica ? 'checked' : ''} ${dis}> Caja chica</label>`}
                ${cfg.varios ? `<label class="pc-check"><input type="checkbox" name="clientes_varios" ${v.clientes_varios || v.tipo_tercero === 'CLIENTES VARIOS' ? 'checked' : ''} ${dis}> Clientes varios</label>` : ''}
              </div>
            </section>
          </div>`;
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form bm-form" novalidate>
          <header class="tk-titulo bm-titulo">
            <div class="tk-titulo-texto"><small>${esc(cfg.titulo)} · ${esc(empresaDe(d))}</small><h2>${d ? (cfg.cheque ? `Cheque ${esc(d.numero_documento || '')} <span class="pc-anual">folio ${d.folio}</span>` : `${esc(cfg.nombre)} folio ${d.folio}`) : `${cfg.tipo === 'DEPOSITO' || cfg.cheque ? 'Nuevo' : 'Nueva'} ${esc(cfg.nombre.toLowerCase())}`}</h2></div>
            <div class="tk-marcas">${marca}${modificando ? '<span class="pc-marca pendiente"><i class="ti ti-pencil" aria-hidden="true"></i> Modificando</span>' : ''}${d?.partida_id ? `<span class="pc-marca definitiva"><i class="ti ti-notebook" aria-hidden="true"></i> Partida ${esc(nombrePartida(d.partida_id))}</span>` : ''}${d?.conciliado ? '<span class="pc-marca aprobada">Conciliado</span>' : ''}${cfg.cheque && d?.impreso ? '<span class="pc-marca definitiva"><i class="ti ti-printer" aria-hidden="true"></i> Impreso</span>' : ''}${cfg.cheque && v.no_negociable ? '<span class="pc-marca descuadrada">No negociable</span>' : ''}</div>
            <div class="tk-titulo-acciones">
              ${cfg.soloIngreso ? `<a class="boton secundario-sm" href="#/caja-bancos/${cfg.consulta}" title="Buscar y consultar ${esc(cfg.plural)} registrados"><i class="ti ti-file-search" aria-hidden="true"></i> Consulta</a>
                <button type="button" class="boton secundario-sm bca-pdf" data-accion="doc-pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> Imprimir en PDF</button>
                <button type="button" class="boton cqc-excel" data-accion="doc-excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Generar Excel</button>
                ${ctx.admin && !modificando ? `<button type="button" class="boton ${ed ? 'secundario-sm' : 'primario-sm'}" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>` : ''}`
                : ctx.admin && d && !modificando ? '<button type="button" class="boton secundario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>' : ''}
              ${cfg.liquidaciones && ed ? cfg.liquidaciones.map((l) => `<button type="button" class="boton secundario-sm" data-proximamente="${esc(l.texto)}" data-modulo="${esc(l.modulo)}" title="Se habilita cuando exista el módulo de ${esc(l.modulo)}"><i class="ti ${l.icono}" aria-hidden="true"></i> ${esc(l.texto)}</button>`).join('') : ''}
              ${d && !modificando ? (cfg.cheque
                ? `<span class="pc-imprimir"><button type="button" class="boton secundario-sm" data-accion="imprimir-cheque" ${d.estado === 'ANULADO' ? 'disabled' : ''}><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button><select class="boton secundario-sm bm-modo-cheque" name="modo_cheque" aria-label="Qué imprimir">${[['ambos', 'Cheque y voucher'], ['cheque', 'Solo cheque'], ['voucher', 'Solo voucher']].map(([k, t]) => `<option value="${k}" ${modoCheque === k ? 'selected' : ''}>${t}</option>`).join('')}</select></span>`
                : cfg.soloIngreso ? '' : '<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>') : ''}
              ${puede ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="anular"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>' : ''}
              ${d && ctx.superAdmin && !d.partida_id && !modificando && !cfg.cheque ? `<button type="button" class="boton secundario-sm rp-peligro" data-eliminar="${d.id}"><i class="ti ti-trash" aria-hidden="true"></i> Eliminar</button>` : ''}
              ${puede && !contabilizado() ? '<button type="button" class="boton secundario-sm" data-accion="partida" title="Genera la partida contable con el detalle contable"><i class="ti ti-notebook" aria-hidden="true"></i> Generar partida</button>' : ''}
              ${puede ? '<button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}
              ${modificando ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}
              ${ed ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${d ? 'Guardar cambios' : 'Registrar'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          ${d && d.estado === 'ANULADO' ? `<p class="tk-aviso bm-anulado"><i class="ti ti-ban" aria-hidden="true"></i> Anulado por ${esc(d.anulado_por || '')} el ${esc(fmt.fechaHora(d.anulado_en))}: ${esc(d.motivo_anulacion || '')}</p>` : ''}

          ${cfg.soloIngreso ? cabA : `<div class="bm-cabecera ${ed ? 'editando' : 'consulta'}">
            <section class="bm-banco">
              <div class="bm-banco-id"><span class="bk-cod" data-banco-cod>${banco?.codigo ?? ''}</span><div><small>Banco</small><b data-banco-nombre title="${esc(banco?.nombre || '')}">${esc(banco?.nombre || '')}</b></div></div>
              <label class="campo bm-cta"><span>Cuenta bancaria *</span><select name="cuenta_bancaria_id" ${disC}>${cuentas.filter((c) => c.activo || c.id === v.cuenta_bancaria_id).map((c) => `<option value="${c.id}" ${v.cuenta_bancaria_id === c.id ? 'selected' : ''}>${esc(c.numero)} · ${esc(c.nombre)}</option>`).join('')}</select></label>
              ${cfg.cheque
                ? `<div class="campo bm-num" title="El número lo asigna la chequera de la cuenta al registrar el cheque"><span>${d ? 'Número de cheque' : 'Siguiente cheque'}</span><input value="${esc(d ? d.numero_documento || '' : ch ? String(ch.siguiente) : 'Sin chequera')}" disabled data-cheque-num aria-label="Número de cheque"></div>`
                : `<label class="campo bm-num"><span>${esc(cfg.etiquetaNumero)}</span><input name="numero_documento" value="${esc(v.numero_documento || '')}" maxlength="40" ${dis}></label>`}
            </section>
            <section class="bm-importe">
              <label class="campo"><span>Valor *</span><input type="number" step="0.01" min="0" name="valor" value="${esc(String(v.valor ?? ''))}" ${disC || disImp}></label>
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
                ${cfg.cheque ? dato('Cheques disp.', ch ? `<b data-cheques-disp class="${ch.disponibles <= ch.minimo ? 'pc-rojo' : ''}">${ch.disponibles}</b> <small>de la chequera</small>` : '<span class="pc-rojo" data-cheques-disp>Sin chequera</span>') : ''}
                ${cfg.cheque ? dato('Impreso', d?.impreso ? `${esc(d.impreso_por || '')} <small>${esc(fmt.fechaHora(d.impreso_en))}</small>` : '', 'bm-c2') : ''}
              </dl>
              ${window.BANCOS.adjunto.html(adjuntoActual({ ed, puede }))}
              <button type="button" class="rp-enlace bm-flujo" data-proximamente="Ir a flujo de caja" data-modulo="Flujo de caja"><i class="ti ti-arrows-right-left" aria-hidden="true"></i> Ir a flujo de caja</button>
            </section>

            <section class="bm-bloque bm-datos">
              <h3 class="ta-col-titulo"><i class="ti ti-calendar-dollar" aria-hidden="true"></i> Datos ${cfg.cheque ? 'del cheque' : cfg.tipo === 'DEPOSITO' ? 'del depósito' : 'de la nota'}</h3>
              <div class="bm-campos">
                <label class="campo"><span>Fecha *</span><input type="date" name="fecha" value="${esc(v.fecha)}" ${disC}></label>
                <label class="campo"><span>Moneda</span><select name="moneda_id" ${dis || disImp}>${ctx.monedas.map((m) => `<option value="${m.id}" ${v.moneda_id === m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
                <label class="campo"><span>Valor cambio</span><input type="number" step="any" min="0" name="tipo_cambio" value="${esc(String(v.tipo_cambio ?? 1))}" ${dis}></label>
                ${cfg.cheque
                  ? `<div class="bm-checks bm-c3">
                      <label class="pc-check" title="Solo se deposita en la cuenta del beneficiario"><input type="checkbox" name="no_negociable" ${v.no_negociable ? 'checked' : ''} ${dis}> No negociable</label>
                      <label class="pc-check" title="El cheque genera una cuenta por cobrar"><input type="checkbox" name="cxc" ${v.cxc ? 'checked' : ''} ${dis}> CXC</label>
                      <label class="pc-check" title="El cheque ya está firmado"><input type="checkbox" name="firmado" ${v.firmado ? 'checked' : ''} ${dis}> Firmado</label>
                      <label class="campo bm-codbanco"><span>Código banco</span><input name="codigo_banco" value="${esc(v.codigo_banco || '')}" maxlength="30" ${dis}></label>
                    </div>`
                  : `<label class="pc-check bm-check"><input type="checkbox" name="caja_chica" ${v.caja_chica ? 'checked' : ''} ${dis}> Caja chica</label>`}
                <label class="campo bm-c2"><span>Tipo de operación</span><input list="bm-operaciones" name="tipo_operacion" value="${esc(v.tipo_operacion || '')}" maxlength="40" ${dis}><datalist id="bm-operaciones">${tiposOperacion.map((t) => `<option value="${esc(t)}">`).join('')}</datalist></label>
                ${cfg.cheque ? `<label class="campo" title="Solicitud de cheque aprobada con la que se emite"><span>Solicitud</span><select name="solicitud_id" ${disC || disImp}><option value="">Sin solicitud</option>${solicitudesCheque.filter((x) => x.estado === 'APROBADA' || x.id === v.solicitud_id).map((x) => `<option value="${x.id}" ${v.solicitud_id === x.id ? 'selected' : ''}>${String(x.numero).padStart(5, '0')} · ${esc(x.beneficiario)} · ${fmt.monto(x.monto)}</option>`).join('')}</select></label>` : ''}
                <label class="campo bm-c2"><span>Descripción</span><input name="descripcion" value="${esc(v.descripcion || '')}" maxlength="250" placeholder="${cfg.tipo === 'DEPOSITO' ? 'Ej. FE-7074 FE-7075' : cfg.cheque ? 'Concepto del pago' : 'Concepto de la nota o transferencia'}" ${dis}></label>
              </div>
            </section>
            <section class="bm-bloque bm-tercero">
              <h3 class="ta-col-titulo"><i class="ti ti-user" aria-hidden="true"></i> ${esc(cfg.etiquetaTercero)}</h3>
              <div class="bm-campos">
                <label class="campo"><span>Código</span><input name="tercero_codigo" value="${esc(v.tercero_codigo || '')}" maxlength="20" ${dis}></label>
                <label class="campo bm-c3"><span>${esc(cfg.etiquetaTercero)} (nombre)</span><input name="tercero_nombre" value="${esc(v.tercero_nombre || '')}" maxlength="150" ${dis}></label>
                <label class="campo bm-c3"><span>${esc(cfg.etiquetaPor)}</span><input name="deposito_por" value="${esc(v.deposito_por || '')}" maxlength="120" placeholder="${esc(cfg.ayudaPor)}" ${dis || disImp}></label>
                ${cfg.varios ? `<label class="pc-check bm-check"><input type="checkbox" name="clientes_varios" ${v.clientes_varios || v.tipo_tercero === 'CLIENTES VARIOS' ? 'checked' : ''} ${dis}> Clientes varios</label>` : ''}
                ${cfg.radios ? `<div class="pc-radios bm-radios bm-c4">${cfg.terceros.map((t) => `<label><input type="radio" name="tipo_tercero" value="${t.valor}" ${v.tipo_tercero === t.valor ? 'checked' : ''} ${dis}> ${esc(t.texto)}</label>`).join('')}</div>` : `<input type="hidden" name="tipo_tercero" value="${cfg.terceros[0].valor}">`}
              </div>
            </section>
          </div>`}

          <section class="bm-pestanas">
            <div class="bm-tabs-barra">
              <div class="rp-pestanas" role="tablist">${pestanas().map((p) => `<button type="button" role="tab" data-pestana="${p.id}" class="${pestana === p.id ? 'activa' : ''}" aria-selected="${pestana === p.id}"><i class="ti ${p.icono}" aria-hidden="true"></i> ${esc(p.texto)}${p.id === 'CONTABLE' ? (lineas.length ? ` <b>${lineas.length}</b>` : '') : (cuenta(p.id) ? ` <b data-cuenta-tab="${p.id}">${cuenta(p.id)}</b>` : '')}</button>`).join('')}</div>
              <span class="bm-aplicado" data-docs-total></span>
            </div>

            <div class="bm-panel" data-panel="CONTABLE" ${pestana === 'CONTABLE' ? '' : 'hidden'}>
              <div class="bm-transaccion">
                <label class="campo"><span>Transacción</span><select name="transaccion_id" ${disC}><option value="">Elegir transacción…</option>${transacciones.filter((t) => t.aplica_poliza).slice().sort((a, b) => String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es')).map((t) => `<option value="${t.id}" ${v.transaccion_id === t.id ? 'selected' : ''}>${esc(t.descripcion)} · ${t.numero}</option>`).join('')}</select></label>
                ${ed && !contabilizado() ? '<button type="button" class="boton secundario-sm" data-accion="contabilizar" title="Arma el detalle contable con las cuentas de la transacción y el valor del documento"><i class="ti ti-calculator" aria-hidden="true"></i> Contabilizar</button>' : ''}
                ${ed && !contabilizado() ? '<button type="button" class="rp-enlace" data-accion="linea"><i class="ti ti-plus" aria-hidden="true"></i> Agregar línea</button>' : ''}
              </div>
              <div class="pc-lineas"><table><thead><tr><th class="pc-n">Línea</th><th class="pc-cta">Cuenta</th><th>Nombre de la cuenta</th><th class="num">Debe</th><th class="num">Haber</th><th class="bm-centro">Centro</th><th>Nombre del centro</th><th></th></tr></thead>
                <tbody data-tabla="lineas">${lineas.map((l, i) => filaLinea(l, i, disC)).join('') || '<tr><td colspan="8" class="tk-vacio">Elige la transacción y presiona «Contabilizar».</td></tr>'}</tbody>
                <tfoot><tr><td colspan="3" class="pc-totales-lbl">Totales</td><td class="num" data-total="debe"></td><td class="num" data-total="haber"></td><td colspan="2" data-cuadre></td><td></td></tr></tfoot></table></div>
            </div>
            ${cfg.documentos.map((t) => panelDocumentos(t, dis)).join('')}
          </section>
          <datalist id="bm-cuentas">${contables.filter((c) => c.movimiento).map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>
          <datalist id="bm-centros">${centros.filter((c) => c.movimiento).map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>
        </form>`;
      totalizar();
      miniatura();
    }

    // Imagen del documento abierto para la ayuda común de adjuntos.
    const adjuntoActual = (extra = {}) => ({ nuevo: comprobanteNuevo, ruta: actual?.comprobante_ruta, nombre: actual?.comprobante_nombre, tipo: actual?.comprobante_tipo, quitar: quitarComprobante, que: cfg.queImagen, ayuda: cfg.ayudaImagen, ...extra });
    const miniatura = () => window.BANCOS.adjunto.miniatura(ctx.pDet, adjuntoActual());
    const verComprobante = () => window.BANCOS.adjunto.ver(adjuntoActual());
    const guardarComprobante = (id, anterior) => window.BANCOS.adjunto.guardar({ tabla: 'movimientos_bancarios', id, carpeta: `${ctx.sel.loc}/${id}`, nuevo: comprobanteNuevo, quitar: quitarComprobante, anterior });

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
        <td class="pc-nombre" data-nombre>${c ? `${esc(c.nombre)}${c.otraVersion ? ` <span class="pc-tipo cf-version" title="Cuenta del catálogo versión ${c.version ?? '?'} de la empresa (con que se migró el documento). Se conserva al guardar.">catálogo v${c.version ?? '?'}</span>` : ''}` : l.codigo ? '<span class="oc-pendiente">Cuenta pendiente: no existe en el catálogo</span>' : ''}</td>
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
        cuenta_bancaria_id: Number(el.cuenta_bancaria_id.value), fecha: el.fecha.value,
        // El número del cheque lo asigna la chequera.
        ...(cfg.cheque
          ? { no_negociable: el.no_negociable.checked, cxc: el.cxc.checked, firmado: el.firmado.checked, codigo_banco: el.codigo_banco.value.trim() || null, solicitud_id: el.solicitud_id.value ? Number(el.solicitud_id.value) : null }
          : { numero_documento: el.numero_documento.value.trim() || null }),
        moneda_id: Number(el.moneda_id.value), tipo_cambio: Number(el.tipo_cambio.value) || 1, valor: fmt.redondear(el.valor.value),
        descripcion: el.descripcion.value,
        tipo_tercero: form.querySelector('[name=tipo_tercero]:checked')?.value || (el.clientes_varios?.checked && cfg.terceros.some((t) => t.valor === 'CLIENTES VARIOS') ? 'CLIENTES VARIOS' : cfg.terceros[0].valor),
        tercero_codigo: el.tercero_codigo.value.trim() || null, tercero_nombre: el.tercero_nombre.value.trim().toUpperCase() || null,
        tipo_operacion: el.tipo_operacion.value.trim() || null, transaccion_id: el.transaccion_id.value ? Number(el.transaccion_id.value) : null,
        caja_chica: !!el.caja_chica?.checked, clientes_varios: !!el.clientes_varios?.checked, deposito_por: el.deposito_por.value.trim().toUpperCase() || null
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
        const previa = contable(l.cuenta_id);
        const c = previa?.otraVersion && previa.codigo === cod ? previa : contables.find((x) => x.codigo === cod && x.movimiento);
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
            fecha: x.fecha || null, estado: x.estado || null, contrato: x.contrato || null, ...(x.compra_id ? { compra_id: x.compra_id } : {})
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
        let numero = '';
        if (cfg.cheque && !actual) {
          // La chequera avanzó: se recargan las cuentas para el siguiente número.
          cuentas = await ctx.cuentasBancarias();
          await cargarSolicitudes();
          const { data: n } = await sb.from('movimientos_bancarios').select('numero_documento').eq('id', id).single();
          numero = n?.numero_documento ? ` con el número ${n.numero_documento}` : '';
        }
        window.FIN.aviso(`${actual ? `${cfg.nombre} guardado` : `${cfg.nombre} registrado${numero}`}${okImagen ? '' : ' · la imagen no se pudo subir'}`);
        actual = { id };
        modificando = false;
        await consultar();
      } catch (err) {
        error.textContent = /column .* does not exist|schema cache|tipo_check/.test(err.message || '')
          ? (cfg.cheque ? 'Falta instalar el script 51 (emisión de cheques) en Supabase.' : 'Falta instalar el script 43 (detalle de depósitos) en Supabase.')
          : window.UI.traducirError(err);
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

    function excelDocumento() {
      const d = actual;
      if (!d) return window.FIN.aviso(`Registra primero ${cfg.tipo.startsWith('NOTA') ? 'la' : 'el'} ${cfg.nombre.toLowerCase()}`);
      if (!window.REPORTE_XLSX) return;
      const cb = cuentaBancaria(d.cuenta_bancaria_id);
      const l = ctx.localidad(d.localidad_id);
      const mon = ctx.moneda(d.moneda_id);
      const quien = d.tercero_nombre || (d.clientes_varios ? 'CLIENTES VARIOS' : '');
      const parametros = [`Empresa: ${l ? `${l.codigo} · ${l.nombre_comercial}` : ''}`, `Cuenta: ${cb ? ctx.nombreCuentaBancaria(cb) : ''}`, `Folio: ${d.folio}`, `${cfg.etiquetaNumero}: ${d.numero_documento || '—'}`,
        `Fecha: ${fmt.fechaDia(d.fecha)}`, `${cfg.etiquetaTercero}: ${quien || '—'}`, `Valor: ${mon?.simbolo || ''} ${fmt.monto(d.valor)} (Q ${fmt.monto(d.valor_ml)})`,
        `Estado: ${d.estado === 'ANULADO' ? 'Anulado' : 'Activo'}${d.partida_id ? ` · partida ${nombrePartida(d.partida_id)}` : ' · sin partida'}`, ...(d.descripcion ? [`Descripción: ${d.descripcion}`] : [])];
      const filas = [{ tipo: 'grupo', valores: ['Detalle contable'] }];
      lineas.forEach((x, i) => { const k = contable(x.cuenta_id); const c = centros.find((z) => z.id === x.centro_id); filas.push({ valores: [i + 1, k?.codigo || '', k?.nombre || '', c?.codigo || '', Number(x.debe) || null, Number(x.haber) || null] }); });
      if (!lineas.length) filas.push({ tipo: 'nota', valores: ['', 'Sin detalle contable'] });
      filas.push({ tipo: 'total', valores: ['', '', 'Totales', '', lineas.reduce((t, x) => t + Number(x.debe || 0), 0), lineas.reduce((t, x) => t + Number(x.haber || 0), 0)] });
      if (documentos.length) {
        filas.push({ tipo: 'nota', valores: [''] }, { tipo: 'grupo', valores: [cfg.tituloDocs] });
        documentos.forEach((x) => filas.push({ valores: [x.tipo, [x.serie, x.numero].filter(Boolean).join('-'), x.nombre || x.tercero || '', x.fecha ? fmt.fechaDia(x.fecha) : '', Number(x.valor || 0), x.tipo === 'FACTURA' ? Number(x.abono || 0) : null] }));
        filas.push({ tipo: 'total', valores: ['', `${documentos.length} documentos`, '', '', documentos.reduce((t, x) => t + Number(x.valor || 0), 0), null] });
      }
      window.REPORTE_XLSX.generar({ titulo: `${cfg.nombre} folio ${d.folio}`, parametros, orgId: d.organizacion_id, locId: d.localidad_id, hoja: cfg.nombre, archivo: `${cfg.plural.replace(/\s+/g, '_')}_folio_${d.folio}`,
        columnas: [{ titulo: 'Línea · tipo', ancho: 11 }, { titulo: 'Cuenta · documento', ancho: 18 }, { titulo: 'Nombre', ancho: 44 }, { titulo: 'Centro · fecha', ancho: 13 }, { titulo: 'Debe · valor', ancho: 15, tipo: 'monto' }, { titulo: 'Haber · abono', ancho: 15, tipo: 'monto' }],
        filas });
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
          <div><b>${esc(cfg.etiquetaPor)}</b>${esc(d.deposito_por || '')}</div>
          <div><b>Operador</b>${esc(d.usuario || '')} · ${esc(fmt.fechaHora(d.fecha_operacion))}</div>
          ${d.anulado_en ? `<div><b>Anulado</b>${esc(d.anulado_por || '')} · ${esc(fmt.fechaHora(d.anulado_en))} · ${esc(d.motivo_anulacion || '')}</div>` : ''}
          ${d.descripcion ? `<div style="grid-column:1/-1"><b>Descripción</b>${esc(d.descripcion)}</div>` : ''}</div>
        ${cfg.documentos.map(tabla).join('')}
        ${lineas.length ? `<h3>Detalle contable</h3><table><thead><tr><th>Línea</th><th>Cuenta</th><th>Nombre</th><th class="n">Debe</th><th class="n">Haber</th><th>Centro</th><th>Nombre del centro</th></tr></thead><tbody>${lineas.map((l, i) => { const c = contable(l.cuenta_id); const cc = centros.find((x) => x.id === l.centro_id); return `<tr><td>${i + 1}</td><td>${esc(c?.codigo || '')}</td><td>${esc(c?.nombre || '')}</td><td class="n">${l.debe ? n(l.debe) : ''}</td><td class="n">${l.haber ? n(l.haber) : ''}</td><td>${esc(cc?.codigo || '')}</td><td>${esc(cc?.nombre || '')}</td></tr>`; }).join('')}</tbody>
          <tfoot><tr><td colspan="3">Totales</td><td class="n">${n(lineas.reduce((t, l) => t + l.debe, 0))}</td><td class="n">${n(lineas.reduce((t, l) => t + l.haber, 0))}</td><td colspan="2"></td></tr></tfoot></table>` : ''}
        <div class="firmas"><div>Elaboró: ${esc(d.usuario || '')}</div><div>Revisó</div><div>Autorizó</div></div>`);
    }

    // Cheque (fecha, beneficiario, valor en números y en letras, no negociable) y su voucher con
    // el detalle contable y las facturas pagadas. Al imprimir el cheque queda marcado como impreso.
    async function imprimirCheque() {
      const d = actual;
      const cb = cuentaBancaria(d.cuenta_bancaria_id);
      const banco = ctx.banco(cb?.banco_id);
      const mon = ctx.moneda(d.moneda_id);
      const loc = ctx.localidad(d.localidad_id);
      const org = ctx.organizaciones.find((o) => o.id === d.organizacion_id);
      const n = (x) => fmt.monto(x);
      const [a, m, dd] = String(d.fecha).slice(0, 10).split('-');
      const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const cheque = `
        <div class="ch">
          <div class="ch-cab"><div><b>${esc(banco?.nombre || '')}</b><br>Cuenta ${esc(cb?.numero || '')} · ${esc(cb?.nombre || '')}</div><div class="ch-num">No. ${esc(d.numero_documento || '')}</div></div>
          <div class="ch-fila"><span>Guatemala, ${Number(dd)} de ${MESES[Number(m) - 1]} de ${a}</span><span class="ch-valor">${esc(mon?.simbolo || 'Q')} ${n(d.valor)}</span></div>
          <div class="ch-fila"><span>Páguese a la orden de:</span><b class="ch-linea">${esc(d.deposito_por || d.tercero_nombre || '')}</b></div>
          <div class="ch-fila"><span>La suma de:</span><b class="ch-linea">${esc(enLetras(d.valor, (mon?.nombre || 'QUETZALES').toUpperCase()))}</b></div>
          ${d.no_negociable ? '<div class="ch-nn">NO NEGOCIABLE</div>' : ''}
          <div class="ch-firma">Firma autorizada</div>
        </div>`;
      const facturas = documentos.filter((x) => x.numero);
      const voucher = `
        <h1>${esc(org?.nombre || '')}</h1>
        <h2>${esc(loc ? `${loc.codigo} · ${loc.nombre_comercial}` : '')} · Voucher del cheque ${esc(d.numero_documento || '')} · folio ${d.folio}${d.estado === 'ANULADO' ? ' · ANULADO' : ''}${d.partida_id ? ` · póliza ${esc(nombrePartida(d.partida_id))}` : ''}</h2>
        <div class="cab">
          <div><b>Banco · cuenta</b>${esc(banco?.nombre || '')} · ${esc(cb?.numero || '')}</div><div><b>Fecha</b>${esc(fmt.fechaDia(d.fecha))}</div>
          <div><b>Valor</b>${esc(mon?.simbolo || '')} ${n(d.valor)}</div><div><b>Valor en quetzales</b>Q ${n(d.valor_ml)}</div>
          <div><b>A favor de</b>${esc(d.deposito_por || '')}</div><div><b>Proveedor</b>${esc([d.tercero_codigo, d.tercero_nombre].filter(Boolean).join(' · '))}</div>
          <div><b>Operador</b>${esc(d.usuario || '')}</div><div><b>Condiciones</b>${[d.no_negociable && 'NO NEGOCIABLE', d.cxc && 'CXC', d.firmado && 'FIRMADO'].filter(Boolean).join(' · ') || '—'}</div>
          ${d.descripcion ? `<div style="grid-column:1/-1"><b>Descripción</b>${esc(d.descripcion)}</div>` : ''}</div>
        ${lineas.length ? `<h3>Detalle contable</h3><table><thead><tr><th>Línea</th><th>Cuenta</th><th>Nombre</th><th class="n">Debe</th><th class="n">Haber</th><th>Centro</th></tr></thead><tbody>${lineas.map((l, i) => { const c = contable(l.cuenta_id); const cc = centros.find((x) => x.id === l.centro_id); return `<tr><td>${i + 1}</td><td>${esc(c?.codigo || '')}</td><td>${esc(c?.nombre || '')}</td><td class="n">${l.debe ? n(l.debe) : ''}</td><td class="n">${l.haber ? n(l.haber) : ''}</td><td>${esc(cc ? `${cc.codigo} ${cc.nombre}` : '')}</td></tr>`; }).join('')}</tbody>
          <tfoot><tr><td colspan="3">Totales</td><td class="n">${n(lineas.reduce((t, l) => t + l.debe, 0))}</td><td class="n">${n(lineas.reduce((t, l) => t + l.haber, 0))}</td><td></td></tr></tfoot></table>` : ''}
        ${facturas.length ? `<h3>Facturas y documentos pagados</h3><table><thead><tr><th>Tipo</th><th>Número</th><th>Nombre</th><th class="n">Valor</th><th class="n">Abono</th></tr></thead><tbody>${facturas.map((x) => `<tr><td>${esc(x.tipo)}</td><td>${esc(x.numero)}</td><td>${esc(x.nombre || '')}</td><td class="n">${n(x.valor)}</td><td class="n">${x.tipo === 'FACTURA' ? n(x.abono) : ''}</td></tr>`).join('')}</tbody></table>` : ''}
        <div class="firmas"><div>Elaboró: ${esc(d.usuario || '')}</div><div>Autorizó</div><div>Recibí conforme</div></div>`;
      const estilos = `<style>.ch{border:1px solid #333;padding:14px 18px;margin-bottom:24px;font-size:13px;position:relative;min-height:190px}.ch-cab{display:flex;justify-content:space-between;margin-bottom:14px}.ch-num{font-size:16px;font-weight:bold}
        .ch-fila{display:flex;gap:10px;align-items:baseline;margin:10px 0}.ch-linea{flex:1;border-bottom:1px solid #333;padding:0 6px 2px}.ch-valor{margin-left:auto;font-size:16px;font-weight:bold;border:1px solid #333;padding:3px 12px}
        .ch-nn{position:absolute;left:18px;bottom:14px;font-weight:bold;border:2px solid #000;padding:2px 10px;letter-spacing:.1em}.ch-firma{position:absolute;right:18px;bottom:14px;border-top:1px solid #333;padding-top:3px;width:220px;text-align:center}
        .corte{border-top:1px dashed #999;margin:18px 0}</style>`;
      const cuerpo = modoCheque === 'cheque' ? cheque : modoCheque === 'voucher' ? voucher : `${cheque}<div class="corte"></div>${voucher}`;
      // El cheque se imprime sobre su papel: sin el encabezado de los reportes (el voucher solo, sí lo lleva).
      imprimir(`Cheque ${d.numero_documento || d.folio}`, estilos + cuerpo, { sinEncabezado: modoCheque !== 'voucher', locId: d.localidad_id, orgId: d.organizacion_id });
      if (modoCheque !== 'voucher' && !d.impreso && d.estado === 'ACTIVO' && ctx.admin) {
        const { error } = await sb.rpc('procesar_movimiento_bancario', { p_id: d.id, p_accion: 'IMPRESO', p_motivo: null });
        if (error) return window.FIN.aviso(window.UI.traducirError(error));
        window.FIN.aviso(`Cheque ${d.numero_documento} marcado como impreso`);
        await consultar();
      }
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
        const malo = window.BANCOS.adjunto.validar(archivo);
        if (malo) return window.FIN.aviso(malo);
        comprobanteNuevo = archivo;
        quitarComprobante = false;
        return repintar();
      }
      if (e.target.name === 'modo_cheque') { modoCheque = e.target.value; return; }
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
          // El siguiente cheque y los disponibles son de la chequera de la cuenta elegida.
          if (cfg.cheque && !actual) return repintar();
        }
      }
      if (e.target.name === 'clientes_varios') return repintar();
      if (e.target.name === 'solicitud_id') {
        const x = solicitudCheque(Number(e.target.value));
        leerFilas();
        return pintarDetalle({ ...(actual || {}), ...leerEncabezado(form), ...(x ? desdeSolicitud(x) : { solicitud_id: null }) });
      }
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
    // ---------- Reportes de la lista (PDF y Excel) con los parámetros del encabezado ----------
    // Resumido: los documentos de la lista. Detallado: cada documento con su detalle contable.
    const parametrosLista = () => {
      const l = ctx.localidad(ctx.sel.loc);
      const cb = cuentaBancaria(Number(f.cuenta));
      return [`Empresa: ${l ? `${l.codigo} · ${l.nombre_comercial}` : '—'}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, `Cuenta: ${cb ? ctx.nombreCuentaBancaria(cb) : 'Todas'}`,
        `Estado: ${f.estado || 'Todos'}`, ...(buscar.trim() ? [`Búsqueda: ${buscar.trim()}`] : [])];
    };
    const filasLista = () => { const q = buscar.trim().toLowerCase(); return docs.filter((d) => !q || [d.folio, d.numero_documento, d.tercero_nombre, d.descripcion, d.tipo_operacion].some((v) => String(v || '').toLowerCase().includes(q))); };
    function dialogoReporte(formato) {
      const filas = filasLista();
      if (!filas.length) return window.FIN.aviso(`No hay ${cfg.plural} con estos parámetros`);
      let formRef = null;
      window.UI.formulario({
        titulo: `${cfg.titulo} · ${formato === 'PDF' ? 'Imprimir en PDF' : 'Generar Excel'}`,
        campos: [],
        alPreparar: (form) => {
          formRef = form;
          form.querySelector('.modal-cuerpo').innerHTML = `
            <fieldset class="cqc-tipos"><legend>Tipo de reporte</legend>
              <label class="cqc-tipo"><input type="radio" name="tipo" value="RESUMIDO" checked><i class="ti ti-list" aria-hidden="true"></i><span><b>Resumido</b><small>El listado de los ${filas.length.toLocaleString('es-GT')} documentos.</small></span></label>
              <label class="cqc-tipo"><input type="radio" name="tipo" value="DETALLADO"><i class="ti ti-list-details" aria-hidden="true"></i><span><b>Detallado</b><small>Cada documento con su detalle contable.</small></span></label>
            </fieldset>
            <p class="bu-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> Con los parámetros del encabezado: ${esc(parametrosLista().join(' · '))}.</p>`;
          form.querySelector('[type=submit]').innerHTML = formato === 'PDF' ? '<i class="ti ti-file-type-pdf" aria-hidden="true"></i> Imprimir en PDF' : '<i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Generar Excel';
        },
        alGuardar: async () => { await reporteLista(formato, formRef?.elements.tipo?.value || 'RESUMIDO', filas); }
      });
    }
    async function reporteLista(formato, tipo, filas) {
      const lineasDe = new Map();
      if (tipo === 'DETALLADO') {
        const ids = filas.map((d) => d.id);
        for (let i = 0; i < ids.length; i += 200) {
          const { data } = await sb.from('movimiento_lineas').select('movimiento_id, linea, debe, haber, cuentas(codigo, nombre)').in('movimiento_id', ids.slice(i, i + 200)).order('linea');
          (data || []).forEach((l) => { if (!lineasDe.has(l.movimiento_id)) lineasDe.set(l.movimiento_id, []); lineasDe.get(l.movimiento_id).push(l); });
        }
      }
      const quien = (d) => (cfg.cheque ? d.deposito_por : '') || d.tercero_nombre || (d.clientes_varios ? 'CLIENTES VARIOS' : '') || '';
      const estado = (d) => `${d.estado === 'ANULADO' ? 'Anulado' : 'Activo'}${d.conciliado ? ' · conciliado' : ''}`;
      const activos = filas.filter((d) => d.estado === 'ACTIVO');
      const total = activos.reduce((s, d) => s + Number(d.valor_ml || 0), 0);
      if (formato === 'PDF') {
        window.BANCOS.imprimir(cfg.titulo, `
          <h1>${esc(cfg.titulo)} · ${tipo === 'DETALLADO' ? 'detallado' : 'resumido'}</h1>
          <h2>${esc(parametrosLista().join(' · '))} · generado el ${esc(fmt.fechaHora(new Date()))} por ${esc((ctx.yo.usuario || '').toUpperCase())}</h2>
          <table><thead><tr><th>Folio</th><th>${esc(cfg.etiquetaNumero)}</th><th>Fecha</th><th>Cuenta</th><th>${esc(cfg.cheque ? cfg.etiquetaPor : cfg.etiquetaTercero)}</th><th>Descripción</th><th class="n">Valor</th><th class="n">Valor Q</th><th>Estado</th><th>Partida</th></tr></thead><tbody>
          ${filas.map((d) => `<tr class="${tipo === 'DETALLADO' ? 's' : ''}"><td>${d.folio}</td><td>${esc(d.numero_documento || '')}</td><td>${esc(fmt.fechaDia(d.fecha))}</td><td>${esc(cuentaBancaria(d.cuenta_bancaria_id)?.numero || '')}</td><td>${esc(quien(d))}</td><td>${esc(d.descripcion || '')}</td><td class="n">${esc(ctx.moneda(d.moneda_id)?.simbolo || '')} ${fmt.monto(d.valor)}</td><td class="n">${fmt.monto(d.valor_ml)}</td><td>${estado(d)}</td><td>${esc(nombrePartida(d.partida_id))}</td></tr>
            ${tipo === 'DETALLADO' ? (lineasDe.get(d.id) || []).map((l) => `<tr><td></td><td colspan="2">${esc(l.cuentas?.codigo || '')}</td><td colspan="3">${esc(l.cuentas?.nombre || '')}</td><td class="n">${Number(l.debe) ? fmt.monto(l.debe) : ''}</td><td class="n">${Number(l.haber) ? fmt.monto(l.haber) : ''}</td><td colspan="2"></td></tr>`).join('') || '<tr><td></td><td colspan="9">Sin detalle contable</td></tr>' : ''}`).join('')}
          </tbody><tfoot><tr><td colspan="7">Total de ${activos.length} documentos activos (de ${filas.length})</td><td class="n">${fmt.monto(total)}</td><td colspan="2"></td></tr></tfoot></table>`);
        return;
      }
      if (!window.REPORTE_XLSX) return;
      const datos = [];
      filas.forEach((d) => {
        datos.push({ resaltar: tipo === 'DETALLADO' ? 1 : 0, tenue: d.estado === 'ANULADO', valores: [d.folio, d.numero_documento || '', fmt.fechaDia(d.fecha), cuentaBancaria(d.cuenta_bancaria_id)?.numero || '', quien(d), d.descripcion || '',
          ctx.moneda(d.moneda_id)?.simbolo || '', Number(d.valor || 0), Number(d.valor_ml || 0), estado(d), nombrePartida(d.partida_id) || (d.origen_anterior ? 'Sist. anterior' : '')] });
        if (tipo === 'DETALLADO') {
          const ls = lineasDe.get(d.id) || [];
          ls.forEach((l) => datos.push({ tipo: 'nota', valores: ['', l.linea, l.cuentas?.codigo || '', '', l.cuentas?.nombre || '', '', '', Number(l.debe) || null, Number(l.haber) || null] }));
          if (!ls.length) datos.push({ tipo: 'nota', valores: ['', '', '', '', 'Sin detalle contable'] });
        }
      });
      datos.push({ tipo: 'total', valores: ['', '', '', '', `Total de ${activos.length} documentos activos (de ${filas.length})`, '', '', null, total, '', ''] });
      window.REPORTE_XLSX.generar({
        titulo: `${cfg.titulo} · ${tipo === 'DETALLADO' ? 'Detallado' : 'Resumido'}`, parametros: parametrosLista(), orgId: ctx.sel.org, locId: ctx.sel.loc,
        hoja: cfg.titulo.replace(/[\\/?*[\]:]/g, '-').slice(0, 28), archivo: `${cfg.plural}_${tipo.toLowerCase()}_${f.desde}_${f.hasta}`, autofiltro: tipo !== 'DETALLADO',
        columnas: [{ titulo: 'Folio', ancho: 8 }, { titulo: cfg.etiquetaNumero, ancho: 16 }, { titulo: 'Fecha', ancho: 11 }, { titulo: 'Cuenta bancaria', ancho: 16 }, { titulo: cfg.cheque ? cfg.etiquetaPor : cfg.etiquetaTercero, ancho: 34 },
          { titulo: 'Descripción', ancho: 44 }, { titulo: 'Moneda', ancho: 8 }, { titulo: tipo === 'DETALLADO' ? 'Valor · Debe' : 'Valor', ancho: 15, tipo: 'monto' }, { titulo: tipo === 'DETALLADO' ? 'Valor Q · Haber' : 'Valor Q', ancho: 15, tipo: 'monto' },
          { titulo: 'Estado', ancho: 16 }, { titulo: 'Partida', ancho: 12 }],
        filas: datos
      });
    }

    cont.addEventListener('click', async (e) => {
      const rl = e.target.closest('[data-accion=lista-pdf], [data-accion=lista-excel]');
      if (rl) return dialogoReporte(rl.dataset.accion === 'lista-pdf' ? 'PDF' : 'EXCEL');
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
      if (e.target.closest('[data-ver-todos]') && rango) {
        f.desde = rango.desde; f.hasta = rango.hasta > fmt.hoy() ? rango.hasta : fmt.hoy(); actual = null;
        pintarFiltros(); return consultar();
      }
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
        if (a === 'doc-pdf') return actual ? imprimirDocumento() : window.FIN.aviso(`Registra primero ${cfg.tipo.startsWith('NOTA') ? 'la' : 'el'} ${cfg.nombre.toLowerCase()}`);
        if (a === 'doc-excel') return excelDocumento();
        if (a === 'imprimir-cheque') return imprimirCheque();
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
  Object.entries(CONFIG).forEach(([id, cfg]) => { window.PANTALLAS[id] = (cont, m, extra) => pantallaMovimiento(cont, cfg, extra); });
})();
