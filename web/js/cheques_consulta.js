// Caja y Bancos · Consultas de documentos bancarios, con un mismo diseño:
//   Cheques · Consulta de Cheques, Bancos · Consulta de Depósitos Monetarios y Bancos · Consulta de Notas
//   (de crédito y de débito). Resumen de los documentos de una empresa (organización y localidad) en un rango
//   de fechas, como Consultar Compras: arriba el maestro con sus totales y abajo el detalle del documento
//   elegido (detalle contable y las compras, facturas o recibos que tiene).
// Filtros: cuenta bancaria, tipo (solo en notas), beneficiario/cliente/proveedor, fechas (la inicial, por
// omisión, la del primer documento de la empresa), estado (vigentes, anulados, conciliados, sin conciliar,
// sin partida) y orden (número, fecha o valor; también con clic en el encabezado). «Consultar» abre el
// documento en su pantalla de registro.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const ORDENES = [['fecha:desc', 'Fecha ↓'], ['fecha:asc', 'Fecha ↑'], ['numero:desc', 'Número ↓'], ['numero:asc', 'Número ↑'], ['valor:desc', 'Valor ↓'], ['valor:asc', 'Valor ↑']];
  const ESTADOS = ['TODOS', 'VIGENTES', 'ANULADOS', 'CONCILIADOS', 'SIN CONCILIAR', 'SIN PARTIDA'];
  const TIPOS_NOTA = { NOTA_CREDITO: { corto: 'NC', nombre: 'Crédito', ruta: 'notas-credito' }, NOTA_DEBITO: { corto: 'ND', nombre: 'Débito', ruta: 'notas-debito' } };

  const CONSULTAS = {
    'consulta-de-cheques': {
      tipos: ['CHEQUE'], titulo: 'Consulta de Cheques', grupo: 'Cheques', icono: 'ti-writing', plural: 'cheques', Plural: 'Cheques', uno: 'cheque', el: 'el cheque',
      numero: 'Cheque', quien: 'A favor de', etqTercero: 'Beneficiario o proveedor', colDocs: 'Compras', tituloDocs: 'Compras y facturas pagadas', colTercero: 'Proveedor',
      sinDocs: 'El cheque no liquidó compras ni facturas.', ruta: () => 'emision-de-cheques', pantalla: 'Emisión de cheques', anulados: 'anulados', vigentes: 'vigentes'
    },
    'consulta-de-depositos': {
      tipos: ['DEPOSITO'], titulo: 'Consulta de Depósitos Monetarios', grupo: 'Bancos', icono: 'ti-cash-banknote', plural: 'depósitos', Plural: 'Depósitos', uno: 'depósito', el: 'el depósito',
      numero: 'Depósito', quien: 'Cliente o depositante', etqTercero: 'Cliente o depositante', colDocs: 'Docs.', tituloDocs: 'Facturas y recibos depositados', colTercero: 'Cliente',
      sinDocs: 'El depósito no tiene facturas ni recibos.', ruta: () => 'depositos', pantalla: 'Depósitos multimoneda', anulados: 'anulados', vigentes: 'vigentes'
    },
    'consulta-de-notas': {
      tipos: ['NOTA_CREDITO', 'NOTA_DEBITO'], titulo: 'Consulta de Notas', grupo: 'Bancos', icono: 'ti-file-invoice', plural: 'notas', Plural: 'Notas', uno: 'nota', el: 'la nota',
      numero: 'Nota', quien: 'Cliente o proveedor', etqTercero: 'Cliente o proveedor', colDocs: 'Docs.', tituloDocs: 'Facturas, recibos y compras', colTercero: 'Cliente / prov.',
      sinDocs: 'La nota no tiene facturas, recibos ni compras.', ruta: (d) => TIPOS_NOTA[d.tipo]?.ruta || 'notas-credito', pantalla: 'su pantalla de notas', anulados: 'anuladas', vigentes: 'vigentes', conTipo: true
    }
  };

  Object.entries(CONSULTAS).forEach(([id, cfg]) => { window.PANTALLAS[id] = (cont) => pantallaConsulta(cont, cfg); });

  function pantallaConsulta(cont, cfg) {
    const ctx = montar(cont, { titulo: cfg.titulo, icono: 'ti-file-search', clase: `bk-movimientos bk-consultar cb-apilado bk-consulta-cheques ${cfg.conTipo ? 'cqc-con-tipo' : ''}`, grupo: cfg.grupo });
    const { sb } = ctx;
    const [anio] = fmt.hoy().split('-');
    const f = { cuenta: '', tercero: '', desde: `${anio}-01-01`, hasta: fmt.hoy(), estado: 'TODOS', buscar: '', orden: 'fecha', dir: 'desc' };
    let cuentas = [], cheques = [], sel = null, partidas = {}, compras = new Map();
    let consulta = 0;
    let rango = null;
    let detalle = { lineas: [], liquida: [], facturas: [] };

    const cuenta = (id) => cuentas.find((c) => c.id === id);
    const numero = (d) => Number(d.numero_documento) || 0;
    const partida = (id) => partidas[id] ? `${String(partidas[id].mes).padStart(2, '0')}-${partidas[id].numero}` : '';
    const sim = (d) => ctx.moneda(d.moneda_id)?.simbolo || 'Q';
    // Quién: en cheques el beneficiario; en depósitos y notas el cliente o proveedor (o quien depositó / ordenó).
    const quienDe = (d) => cfg.tipos[0] === 'CHEQUE' ? d.deposito_por || d.tercero_nombre || ''
      : d.clientes_varios ? 'CLIENTES VARIOS' : d.tercero_nombre || d.deposito_por || (d.tercero_codigo ? `Código ${d.tercero_codigo}` : '');
    const tipoNota = (d) => TIPOS_NOTA[d.tipo];
    f.tipo = 'TODOS';

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Cuenta bancaria</span><select name="cuenta"><option value="">Todas</option>${cuentas.map((c) => `<option value="${c.id}" ${String(f.cuenta) === String(c.id) ? 'selected' : ''}>${esc(ctx.nombreCuentaBancaria(c))}</option>`).join('')}</select></label>
        ${cfg.conTipo ? `<label class="campo"><span>Tipo de nota</span><select name="tipo">${[['TODOS', 'Crédito y débito'], ['NOTA_CREDITO', 'Notas de crédito'], ['NOTA_DEBITO', 'Notas de débito']].map(([k, t]) => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
        <label class="campo cq-prov"><span>${esc(cfg.etqTercero)}</span><input name="tercero" value="${esc(f.tercero)}" placeholder="Todos (nombre o código)"></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Ordenar por</span><select name="orden">${ORDENES.map(([k, t]) => `<option value="${k}" ${`${f.orden}:${f.dir}` === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado">${ESTADOS.map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>`,
        '<button type="button" class="boton cqc-excel" data-accion="excel" title="Reporte en Excel (.xlsx): resumido o detallado, con el encabezado de la empresa"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i><span><b>Generar Excel</b><small>Resumido o detallado</small></span></button>');
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      cuentas = await ctx.cuentasBancarias();
      if (f.cuenta && !cuenta(Number(f.cuenta))) f.cuenta = '';
      // Fecha inicial por omisión: la del primer documento de la empresa (sin documentos, el 1 de enero).
      const pr = ctx.sel.loc ? await sb.from('movimientos_bancarios').select('fecha').eq('localidad_id', ctx.sel.loc).in('tipo', cfg.tipos).order('fecha').limit(1) : { data: [] };
      f.desde = pr.data?.[0]?.fecha || `${anio}-01-01`;
      if (f.hasta < f.desde) f.hasta = fmt.hoy();
      pintarFiltros();
      await consultar();
    }

    async function consultar(id = sel?.id) {
      const loc = ctx.sel.loc;
      if (!loc) { cheques = []; pintar(); return; }
      // Por páginas de 1,000 (el servidor devuelve como máximo 1,000 filas por consulta), hasta 10,000.
      const pagina = (desde) => {
        let q = sb.from('movimientos_bancarios').select('*').eq('localidad_id', loc).in('tipo', cfg.tipos).gte('fecha', f.desde).lte('fecha', f.hasta)
          .order('fecha', { ascending: false }).order('id', { ascending: false }).range(desde, desde + 999);
        if (f.cuenta) q = q.eq('cuenta_bancaria_id', Number(f.cuenta));
        return q;
      };
      const yo = ++consulta;
      const lista = [];
      for (let p = 0; p < 10000; p += 1000) {
        const r = await pagina(p);
        if (yo !== consulta) return;
        if (r.error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(r.error.message)}</p>`; return; }
        lista.push(...(r.data || []));
        if ((r.data || []).length < 1000) break;
      }
      rango = null;
      if (!lista.length) {
        let qr = sb.from('movimientos_bancarios').select('fecha', { count: 'exact' }).eq('localidad_id', loc).in('tipo', cfg.tipos);
        if (f.cuenta) qr = qr.eq('cuenta_bancaria_id', Number(f.cuenta));
        const [a, b] = await Promise.all([qr.order('fecha').limit(1), sb.from('movimientos_bancarios').select('fecha').eq('localidad_id', loc).in('tipo', cfg.tipos).order('fecha', { ascending: false }).limit(1)]);
        if (a.count) rango = { n: a.count, desde: a.data?.[0]?.fecha, hasta: b.data?.[0]?.fecha };
      }
      // Partidas y compras liquidadas de cada cheque, por partes.
      partidas = {}; compras = new Map();
      const ids = lista.map((d) => d.id);
      const pids = [...new Set(lista.map((d) => d.partida_id).filter(Boolean))];
      for (let i = 0; i < pids.length; i += 300) {
        const { data } = await sb.from('partidas').select('id, mes, numero').in('id', pids.slice(i, i + 300));
        (data || []).forEach((p) => { partidas[p.id] = p; });
      }
      for (let i = 0; i < ids.length; i += 300) {
        const [a, b] = await Promise.all([
          sb.from('compra_documentos_banco').select('movimiento_id').in('movimiento_id', ids.slice(i, i + 300)),
          cfg.tipos[0] === 'CHEQUE' ? sb.from('movimiento_documentos').select('movimiento_id').in('movimiento_id', ids.slice(i, i + 300)).not('compra_id', 'is', null)
            : sb.from('movimiento_documentos').select('movimiento_id').in('movimiento_id', ids.slice(i, i + 300))
        ]);
        [...(a.error ? [] : a.data || []), ...(b.data || [])].forEach((x) => compras.set(x.movimiento_id, (compras.get(x.movimiento_id) || 0) + 1));
      }
      if (yo !== consulta) return;
      cheques = lista;
      sel = cheques.find((d) => d.id === id) || null;
      pintar();
      if (!sel && visibles()[0]) await elegir(visibles()[0]);
    }

    const visibles = () => {
      const q = f.buscar.trim().toLowerCase();
      const t = f.tercero.trim().toLowerCase();
      return cheques.filter((d) => (f.tipo === 'TODOS' || d.tipo === f.tipo) && (f.estado === 'TODOS' || (f.estado === 'VIGENTES' && d.estado === 'ACTIVO') || (f.estado === 'ANULADOS' && d.estado === 'ANULADO')
        || (f.estado === 'CONCILIADOS' && d.conciliado) || (f.estado === 'SIN CONCILIAR' && d.estado === 'ACTIVO' && !d.conciliado) || (f.estado === 'SIN PARTIDA' && d.estado === 'ACTIVO' && !d.partida_id))
        && (!t || [d.deposito_por, d.tercero_nombre, d.tercero_codigo].some((v) => String(v || '').toLowerCase().includes(t)))
        && (!q || [d.numero_documento, d.folio, d.deposito_por, d.tercero_nombre, d.descripcion, d.documento_mig].some((v) => String(v || '').toLowerCase().includes(q))))
        .sort((a, b) => {
          const va = f.orden === 'numero' ? numero(a) : f.orden === 'valor' ? Number(a.valor_ml) : a.fecha;
          const vb = f.orden === 'numero' ? numero(b) : f.orden === 'valor' ? Number(b.valor_ml) : b.fecha;
          const d = va < vb ? -1 : va > vb ? 1 : numero(b) - numero(a);
          return f.dir === 'asc' ? d : -d;
        });
    };
    const ordenTh = (campo, texto, clase = '') => `<th class="${clase} cq-orden ${f.orden === campo ? 'activo' : ''}" data-ordenar="${campo}" title="Ordenar por ${texto.toLowerCase()}">${texto} <i class="ti ${f.orden === campo ? (f.dir === 'asc' ? 'ti-sort-ascending' : 'ti-sort-descending') : 'ti-arrows-sort'}" aria-hidden="true"></i></th>`;

    async function elegir(d) {
      sel = d;
      detalle = { lineas: [], liquida: [], facturas: [] };
      if (d) {
        ctx.pDet.innerHTML = ctx.vacio(`Cargando el detalle de ${cfg.el}…`, 'ti-loader-2');
        const [l, c, m] = await Promise.all([
          sb.from('movimiento_lineas').select('linea, debe, haber, cuentas(codigo, nombre, catalogos_cuentas(version)), centros_costo(codigo, nombre)').eq('movimiento_id', d.id).order('linea'),
          sb.from('compra_documentos_banco').select('valor, liquidacion, compras(id, numero, serie, documento, fecha_documento, proveedor_nombre, valor_total, moneda_id)').eq('movimiento_id', d.id),
          sb.from('movimiento_documentos').select('tipo, serie, numero, tercero, nombre, valor, abono, fecha, compra_id').eq('movimiento_id', d.id).order('id')
        ]);
        if (sel !== d) return;
        detalle = { lineas: l.data || [], liquida: c.error ? [] : c.data || [], facturas: m.data || [] };
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-cheque]').forEach((tr) => tr.classList.toggle('actual', !!d && tr.dataset.cheque === String(d.id)));
    }

    function pintar() { pintarMaestro(); pintarDetalle(); }

    function pintarMaestro() {
      const filas = visibles();
      const vivos = filas.filter((d) => d.estado === 'ACTIVO');
      const total = vivos.reduce((t, d) => t + Number(d.valor_ml || 0), 0);
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>${esc(cfg.Plural)} <small>${filas.length}</small></h2>
          <div class="ta-totales pc-resumen">
            ${cfg.conTipo ? ['NOTA_CREDITO', 'NOTA_DEBITO'].map((k) => { const v = vivos.filter((d) => d.tipo === k); return `<span class="ta-total cqc-tn-${TIPOS_NOTA[k].corto}"><b>Q ${fmt.monto(v.reduce((t, d) => t + Number(d.valor_ml || 0), 0))}</b> ${TIPOS_NOTA[k].nombre.toLowerCase()} (${v.length})</span>`; }).join('')
              : `<span class="ta-total"><b>Q ${fmt.monto(total)}</b> ${cfg.vigentes} (${vivos.length})</span>`}
            <span class="ta-total"><b>${filas.length - vivos.length}</b> ${cfg.anulados}</span>
            <span class="ta-total"><b>${vivos.filter((d) => d.conciliado).length}</b> conciliados</span>
            <span class="ta-total sin"><b>${vivos.filter((d) => !d.conciliado).length}</b> sin conciliar</span>
            <span class="ta-total sin"><b>${vivos.filter((d) => !d.partida_id).length}</b> sin partida</span>
          </div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Número, ${esc(cfg.quien.toLowerCase())}, descripción…" value="${esc(f.buscar)}" aria-label="Buscar ${esc(cfg.plural)}"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table class="cqc-tabla"><colgroup><col class="w-num"><col class="w-fecha"><col><col class="w-cta"><col class="w-valor"><col class="w-estado"><col class="w-compras"><col class="w-acc"></colgroup>
            <thead><tr>${ordenTh('numero', cfg.numero, 'num')}${ordenTh('fecha', 'Fecha')}<th>${esc(cfg.quien)} · descripción</th><th>Cuenta bancaria</th>${ordenTh('valor', 'Valor', 'num')}<th>Estado</th><th class="num" title="${esc(cfg.tituloDocs)}">${esc(cfg.colDocs)}</th><th aria-label="Consultar"></th></tr></thead>
            <tbody>${filas.map((d) => { const cb = cuenta(d.cuenta_bancaria_id); const quien = quienDe(d); const tn = tipoNota(d); return `<tr data-cheque="${d.id}" class="${sel && sel.id === d.id ? 'actual' : ''} ${d.estado === 'ANULADO' ? 'pc-anulada' : ''}" tabindex="0">
              <td class="num fuerte">${tn ? `<span class="cqc-tn cqc-tn-${tn.corto}" title="Nota de ${tn.nombre.toLowerCase()}">${tn.corto}</span> ` : ''}${esc(d.numero_documento || '')}<small class="cq-ant">folio ${d.folio}</small></td>
              <td>${esc(fmt.fechaDia(d.fecha))}</td>
              <td class="cqc-quien" title="${esc(quien)}${d.descripcion ? ` · ${esc(d.descripcion)}` : ''}"><b>${esc(quien || '—')}</b><small>${esc(d.descripcion || '')}</small></td>
              <td class="cqc-cta" title="${esc(cb ? ctx.nombreCuentaBancaria(cb) : '')}">${esc(cb ? cb.numero : '')}<small>${esc(cb ? ctx.banco(cb.banco_id)?.siglas || ctx.banco(cb.banco_id)?.nombre || '' : '')}</small></td>
              <td class="num"><b>${esc(sim(d))} ${fmt.monto(d.valor)}</b>${d.moneda_id !== ctx.monedaBase()?.id ? `<small>Q ${fmt.monto(d.valor_ml)}</small>` : ''}</td>
              <td class="cqc-estado"><span class="pc-marca ${d.estado === 'ANULADO' ? 'anulada' : 'aprobada'}">${d.estado === 'ANULADO' ? 'Anulado' : 'Vigente'}</span>${d.conciliado ? ' <span class="pc-marca definitiva">Conciliado</span>' : ''}
                <small>${d.partida_id ? `Partida ${esc(partida(d.partida_id))}` : d.origen_anterior ? 'Sistema anterior' : 'Sin partida'}</small></td>
              <td class="num">${compras.get(d.id) || '<span class="tk-tenue">—</span>'}</td>
              <td class="cq-acc"><button type="button" class="icono-boton cqc-ver" data-consultar="${d.id}" title="Consultar: abrir ${esc(cfg.el)} en ${esc(cfg.pantalla)}" aria-label="Consultar ${esc(cfg.el)} ${esc(d.numero_documento || '')}"><i class="ti ti-eye" aria-hidden="true"></i></button></td></tr>`; }).join('')
              || `<tr><td colspan="8" class="tk-vacio"><i class="ti ti-file-search" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : !cheques.length && rango ? `No hay ${esc(cfg.plural)} entre el ${esc(fmt.fechaDia(f.desde))} y el ${esc(fmt.fechaDia(f.hasta))}. La empresa tiene <b>${rango.n.toLocaleString('es-GT')}</b> ${esc(cfg.plural)}, del ${esc(fmt.fechaDia(rango.desde))} al ${esc(fmt.fechaDia(rango.hasta))}. <button type="button" class="boton primario-sm" data-ver-todos>Ver todos</button>` : `No hay ${esc(cfg.plural)} con estos parámetros.`}</td></tr>`}</tbody></table>
        </div>`;
    }

    function pintarDetalle() {
      const d = sel;
      if (!d) { ctx.pDet.innerHTML = ctx.vacio(ctx.sel.loc ? `Elige ${cfg.uno === 'nota' ? 'una' : 'un'} ${cfg.uno} para ver su detalle.` : 'Elige la empresa.', 'ti-file-search'); return; }
      const { lineas, liquida, facturas } = detalle;
      const cb = cuenta(d.cuenta_bancaria_id);
      const tn = tipoNota(d);
      const nombreDoc = tn ? `Nota de ${tn.nombre.toLowerCase()}` : cfg.numero;
      const debe = lineas.reduce((t, l) => t + Number(l.debe || 0), 0);
      const haber = lineas.reduce((t, l) => t + Number(l.haber || 0), 0);
      ctx.pDet.innerHTML = `
        <div class="tk-form cq-ficha">
          <header class="tk-titulo cb-titulo">
            <span class="tk-icono"><i class="ti ${tn ? (d.tipo === 'NOTA_DEBITO' ? 'ti-file-minus' : 'ti-file-plus') : cfg.icono}" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>${esc(nombreDoc)} ${esc(d.numero_documento || '')} · folio ${d.folio}${d.origen_anterior ? ' · del sistema anterior' : ''}${cb ? ` · ${esc(ctx.nombreCuentaBancaria(cb))}` : ''}</small><h2>${esc(quienDe(d) || (cfg.tipos[0] === 'CHEQUE' ? 'Sin beneficiario' : 'Sin cliente ni proveedor'))}</h2></div>
            <dl class="cq-datos">
              <div><dt>Fecha</dt><dd>${esc(fmt.fechaDia(d.fecha))}</dd></div>
              <div><dt>Valor</dt><dd>${esc(sim(d))} ${fmt.monto(d.valor)}${d.moneda_id !== ctx.monedaBase()?.id ? ` · Q ${fmt.monto(d.valor_ml)}` : ''}</dd></div>
              <div><dt>Estado</dt><dd>${d.estado === 'ANULADO' ? `Anulado${d.anulado_en ? ` ${esc(fmt.fechaDia(String(d.anulado_en).slice(0, 10)))}` : ''}` : 'Vigente'}${d.conciliado ? ' · conciliado' : ''}</dd></div>
              <div><dt>Partida</dt><dd>${d.partida_id ? esc(partida(d.partida_id)) : '—'}</dd></div>
              <div><dt>Operador</dt><dd>${esc(d.usuario || '—')}</dd></div>
            </dl>
            <div class="tk-titulo-acciones">
              <a class="boton primario-sm" href="#/caja-bancos/${cfg.ruta(d)}/${d.id}"><i class="ti ti-eye" aria-hidden="true"></i> Ver en ${esc(tn ? `Notas de ${tn.nombre.toLowerCase()}` : cfg.pantalla)}</a>
            </div>
          </header>
          ${d.descripcion || d.estado === 'ANULADO' ? `<p class="cqc-concepto"><i class="ti ti-file-text" aria-hidden="true"></i> ${esc(d.descripcion || '')}${d.estado === 'ANULADO' && d.motivo_anulacion ? ` <span class="pc-rojo">· Anulación: ${esc(d.motivo_anulacion)}</span>` : ''}</p>` : ''}
          <div class="cq-det">
            <section class="cb-bloque cq-conta">
              <h3 class="ta-col-titulo"><i class="ti ti-list-details" aria-hidden="true"></i> Detalle contable <small>${lineas.length}</small>${lineas.length ? (Math.abs(debe - haber) < 0.005 ? ' <span class="pc-marca aprobada">Cuadra</span>' : ' <span class="pc-marca anulada">No cuadra</span>') : ''}</h3>
              <div class="pc-lineas"><table><thead><tr><th class="pc-n">Línea</th><th>Cuenta</th><th>Nombre</th><th>Centro</th><th class="num">Debe</th><th class="num">Haber</th></tr></thead>
                <tbody>${lineas.map((l) => `<tr><td class="pc-n">${l.linea}</td><td class="fuerte">${esc(l.cuentas?.codigo || '')}</td><td class="cc-nombre">${esc(l.cuentas?.nombre || '')}${l.cuentas?.catalogos_cuentas?.version ? ` <span class="pc-tipo cf-version">v${l.cuentas.catalogos_cuentas.version}</span>` : ''}</td><td>${esc(l.centros_costo?.codigo || '')}</td><td class="num">${Number(l.debe) ? fmt.monto(l.debe) : ''}</td><td class="num">${Number(l.haber) ? fmt.monto(l.haber) : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="tk-vacio">Sin detalle contable.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="4">Totales</td><td class="num">${fmt.monto(debe)}</td><td class="num">${fmt.monto(haber)}</td></tr></tfoot></table></div>
            </section>
            <section class="cb-bloque cq-lineas">
              <h3 class="ta-col-titulo"><i class="ti ${cfg.tipos[0] === 'CHEQUE' ? 'ti-shopping-cart' : 'ti-receipt'}" aria-hidden="true"></i> ${esc(cfg.tituloDocs)} <small>${liquida.length + facturas.length}</small></h3>
              <div class="pc-lineas"><table><thead><tr><th>${cfg.tipos[0] === 'CHEQUE' ? 'Compra' : 'Tipo'}</th><th>Documento</th><th>Fecha</th><th>${esc(cfg.colTercero)}</th><th class="num">${cfg.tipos[0] === 'CHEQUE' ? 'Total compra' : 'Valor'}</th><th class="num">${cfg.tipos[0] === 'CHEQUE' ? 'Liquidado' : 'Aplicado'}</th><th></th></tr></thead>
                <tbody>${[...liquida.map((x) => ({ c: x.compras, valor: x.valor, nota: x.liquidacion ? `liq. ${x.liquidacion}` : '' })), ...facturas.map((x) => ({ c: null, tipo: x.tipo, doc: `${x.serie ? `${x.serie}-` : ''}${x.numero}`, fecha: x.fecha, nombre: x.nombre || x.tercero, total: x.valor, valor: x.abono || x.valor, compraId: x.compra_id, nota: x.tipo }))].map((x) => `<tr>
                  <td class="fuerte">${x.c ? x.c.numero : cfg.tipos[0] === 'CHEQUE' ? (x.compraId ? '—' : '') : `<span class="pc-tipo">${esc((x.tipo || '').toLowerCase())}</span>`}</td><td>${esc(x.c ? `${x.c.serie ? `${x.c.serie}-` : ''}${x.c.documento}` : x.doc || '')}</td><td>${esc(x.c ? fmt.fechaDia(x.c.fecha_documento) : x.fecha ? fmt.fechaDia(x.fecha) : '')}</td>
                  <td class="cc-nombre">${esc(x.c ? x.c.proveedor_nombre : x.nombre || '')}</td><td class="num">${x.c ? fmt.monto(x.c.valor_total) : cfg.tipos[0] === 'CHEQUE' ? '' : fmt.monto(x.total)}</td><td class="num fuerte">${fmt.monto(x.valor)}</td>
                  <td>${x.c ? `<a class="rp-enlace" href="#/compras/facturas-compra/${x.c.id}" title="Abrir la compra"><i class="ti ti-external-link" aria-hidden="true"></i></a>` : cfg.tipos[0] === 'CHEQUE' ? `<small class="tk-tenue">${esc(x.nota || '')}</small>` : ''}</td></tr>`).join('') || `<tr><td colspan="7" class="tk-vacio">${esc(cfg.sinDocs)}</td></tr>`}</tbody>
                <tfoot><tr><td colspan="5">${cfg.tipos[0] === 'CHEQUE' ? 'Total liquidado' : 'Total aplicado'}</td><td class="num">${fmt.monto([...liquida, ...facturas].reduce((t, x) => t + Number(x.abono || x.valor || 0), 0))}</td><td></td></tr></tfoot></table></div>
            </section>
          </div>
        </div>`;
    }

    // ---------- Reporte en Excel ----------
    // Antes de generarlo se elige el tipo: Resumido (el listado de cheques) o Detallado (cada cheque con su
    // detalle contable). El archivo (.xlsx, con ExcelJS) lleva un encabezado: a la izquierda el logo y el
    // nombre de la empresa, al centro los parámetros del reporte y a la derecha la fecha y hora de
    // generación con el usuario; una línea de separación y después los datos. Si la librería no carga, se
    // genera el CSV de siempre.
    function excel() {
      const filas = visibles();
      if (!filas.length) return window.FIN.aviso(`No hay ${cfg.plural} con estos parámetros`);
      let formRef = null;
      window.UI.formulario({
        titulo: `Reporte de ${cfg.plural} en Excel`,
        campos: [],
        alPreparar: (form) => {
          formRef = form;
          form.querySelector('.modal-cuerpo').innerHTML = `
            <fieldset class="cqc-tipos"><legend>Tipo de reporte</legend>
              <label class="cqc-tipo"><input type="radio" name="tipo" value="RESUMIDO" checked><i class="ti ti-list" aria-hidden="true"></i><span><b>Resumido</b><small>Solo el listado general de ${cfg.uno === 'nota' ? 'las' : 'los'} ${filas.length.toLocaleString('es-GT')} ${esc(cfg.plural)}.</small></span></label>
              <label class="cqc-tipo"><input type="radio" name="tipo" value="DETALLADO"><i class="ti ti-list-details" aria-hidden="true"></i><span><b>Detallado</b><small>Cada ${esc(cfg.uno)} con el detalle de su contabilización.</small></span></label>
            </fieldset>
            <p class="bu-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> Con los filtros de la pantalla: ${esc(parametros().join(' · '))}.</p>`;
          form.querySelector('[type=submit]').innerHTML = '<i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Generar Excel';
        },
        alGuardar: async () => {
          const tipo = formRef?.elements.tipo?.value || 'RESUMIDO';
          await generarExcel(filas, tipo);
        }
      });
    }

    // Parámetros del reporte, tal como están en la pantalla.
    function parametros() {
      const emp = ctx.localidad(ctx.sel.loc);
      const cb = cuenta(Number(f.cuenta));
      const orden = ORDENES.find(([k]) => k === `${f.orden}:${f.dir}`)?.[1] || '';
      return [`Empresa: ${emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '—'}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`,
        `Cuenta: ${cb ? `${cb.numero} · ${cb.nombre}` : 'Todas'}`, ...(cfg.conTipo ? [`Tipo: ${f.tipo === 'TODOS' ? 'Crédito y débito' : TIPOS_NOTA[f.tipo].nombre}`] : []), `${cfg.etqTercero}: ${f.tercero.trim() || 'Todos'}`, `Estado: ${f.estado}`, `Orden: ${orden}`,
        ...(f.buscar.trim() ? [`Búsqueda: ${f.buscar.trim()}`] : [])];
    }

    const cargarExcelJS = () => window.ExcelJS ? Promise.resolve(window.ExcelJS) : new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
      s.onload = () => window.ExcelJS ? ok(window.ExcelJS) : mal(new Error('ExcelJS'));
      s.onerror = () => mal(new Error('No se pudo cargar la librería de Excel'));
      document.head.appendChild(s);
    });

    // Logo de la organización (organizaciones.logo_ruta en Storage), como base64 para incrustarlo.
    async function logoOrganizacion(orgId) {
      try {
        const { data: o } = await sb.from('organizaciones').select('codigo, nombre, logo_ruta').eq('id', orgId).maybeSingle();
        if (!o?.logo_ruta) return { org: o, logo: null };
        const url = sb.storage.from('organizaciones').getPublicUrl(o.logo_ruta).data.publicUrl;
        const blob = await (await fetch(url)).blob();
        const ext = /png/.test(blob.type) ? 'png' : /jpe?g/.test(blob.type) ? 'jpeg' : /gif/.test(blob.type) ? 'gif' : null;
        if (!ext) return { org: o, logo: null };
        const b64 = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
        const dim = await new Promise((ok) => { const i = new Image(); i.onload = () => ok({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => ok({ w: 160, h: 80 }); i.src = URL.createObjectURL(blob); });
        return { org: o, logo: { base64: b64, extension: ext, ...dim } };
      } catch { return { org: null, logo: null }; }
    }

    async function generarExcel(filas, tipo) {
      const emp = ctx.localidad(ctx.sel.loc);
      let ExcelJS;
      try { ExcelJS = await cargarExcelJS(); } catch (err) { window.FIN.aviso(`${err.message}: se descarga en CSV`); return excelCsv(filas); }
      window.FIN.aviso('Generando el reporte…');
      // Detallado: líneas contables de todos los cheques, por partes.
      const lineasDe = new Map();
      if (tipo === 'DETALLADO') {
        const ids = filas.map((d) => d.id);
        for (let i = 0; i < ids.length; i += 200) {
          const { data } = await sb.from('movimiento_lineas').select('movimiento_id, linea, debe, haber, cuentas(codigo, nombre), centros_costo(codigo)').in('movimiento_id', ids.slice(i, i + 200)).order('linea');
          (data || []).forEach((l) => { if (!lineasDe.has(l.movimiento_id)) lineasDe.set(l.movimiento_id, []); lineasDe.get(l.movimiento_id).push(l); });
        }
      }
      const { org, logo } = await logoOrganizacion(emp?.organizacion_id);
      const yo = window.FIN.perfil();
      const ahora = new Date().toLocaleString('es-GT', { timeZone: 'America/Guatemala', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '');

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Financiero CONSISAV';
      const ws = wb.addWorksheet(tipo === 'DETALLADO' ? `${cfg.Plural} detallado` : cfg.Plural, { views: [{ state: 'frozen', ySplit: 7, showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
      const COLS = [[cfg.conTipo ? 'Tipo · nota' : cfg.numero, cfg.conTipo ? 14 : 10], ['Folio', 8], ['Fecha', 11], ['Cuenta bancaria', 16], [cfg.quien, 34], ['Descripción', 46], ['Moneda', 8], ['Valor', 14], ['Valor Q', 14], ['Estado', 11], ['Conciliado', 11], ['Partida', 10]];
      ws.columns = COLS.map(([, w]) => ({ width: w }));
      const ultima = COLS.length;
      const azul = 'FF1F3A5F';
      // a) Izquierda: logo y nombre de la empresa.
      if (logo) {
        const id = wb.addImage({ base64: logo.base64, extension: logo.extension });
        const alto = 64; const ancho = Math.round(alto * (logo.w / (logo.h || 1)));
        ws.addImage(id, { tl: { col: 0.1, row: 0.15 }, ext: { width: Math.min(ancho, 150), height: alto } });
      }
      const izq = logo ? 3 : 1;
      ws.mergeCells(1, izq, 1, 4); ws.getCell(1, izq).value = org?.nombre || '';
      ws.getCell(1, izq).font = { bold: true, size: 13, color: { argb: azul } };
      ws.mergeCells(2, izq, 2, 4); ws.getCell(2, izq).value = emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '';
      ws.getCell(2, izq).font = { size: 10, color: { argb: 'FF555555' } };
      // b) Centro: título y parámetros.
      const par = parametros();
      ws.mergeCells(1, 5, 1, 9); ws.getCell(1, 5).value = `${cfg.titulo} · ${tipo === 'DETALLADO' ? 'Detallado' : 'Resumido'}`;
      ws.getCell(1, 5).font = { bold: true, size: 14, color: { argb: azul } };
      [par.slice(0, 2).join('   ·   '), par.slice(2, 4).join('   ·   '), par.slice(4).join('   ·   ')].forEach((t, i) => {
        ws.mergeCells(2 + i, 5, 2 + i, 9); ws.getCell(2 + i, 5).value = t; ws.getCell(2 + i, 5).font = { size: 9.5, color: { argb: 'FF444444' } };
      });
      for (let r = 1; r <= 4; r += 1) ws.getCell(r, 5).alignment = { horizontal: 'center', vertical: 'middle' };
      // c) Derecha: fecha y hora de generación, y el usuario.
      ws.mergeCells(1, 10, 1, ultima); ws.getCell(1, 10).value = `Fecha: ${ahora}`;
      ws.mergeCells(2, 10, 2, ultima); ws.getCell(2, 10).value = `Usuario: ${(yo.usuario || '').toUpperCase()}${yo.nombre ? ` · ${yo.nombre}` : ''}`;
      [1, 2].forEach((r) => { ws.getCell(r, 10).alignment = { horizontal: 'right' }; ws.getCell(r, 10).font = { size: 9.5, color: { argb: 'FF444444' } }; });
      ws.getRow(1).height = 22; [2, 3, 4].forEach((r) => { ws.getRow(r).height = 15; });
      // Línea de separación.
      for (let c = 1; c <= ultima; c += 1) ws.getCell(5, c).border = { bottom: { style: 'medium', color: { argb: azul } } };
      ws.getRow(5).height = 6;
      // Encabezado de columnas (fila 7).
      const cab = ws.getRow(7);
      COLS.forEach(([t], i) => { const c = cab.getCell(i + 1); c.value = t; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: azul } }; c.alignment = { vertical: 'middle', horizontal: i >= 7 && i <= 8 ? 'right' : 'left' }; });
      cab.height = 18;
      const monto = '#,##0.00';
      let fila = 8;
      let total = 0;
      for (const d of filas) {
        const cb = cuenta(d.cuenta_bancaria_id);
        const r = ws.getRow(fila);
        r.values = [tipoNota(d) ? `${tipoNota(d).corto} ${d.numero_documento || ''}` : d.numero_documento, d.folio, fmt.fechaDia(d.fecha), cb?.numero || '', quienDe(d), d.descripcion || '', sim(d), Number(d.valor || 0), Number(d.valor_ml || 0),
          d.estado === 'ANULADO' ? 'Anulado' : 'Vigente', d.conciliado ? 'Sí' : 'No', partida(d.partida_id) || (d.origen_anterior ? 'Sist. ant.' : '')];
        r.getCell(8).numFmt = monto; r.getCell(9).numFmt = monto;
        if (d.estado === 'ANULADO') r.font = { color: { argb: 'FF999999' }, strike: true };
        if (tipo === 'DETALLADO') { r.font = { ...(r.font || {}), bold: true }; r.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF0F7' } }; }); }
        if (d.estado === 'ACTIVO') total += Number(d.valor_ml || 0);
        fila += 1;
        if (tipo === 'DETALLADO') {
          const ls = lineasDe.get(d.id) || [];
          const sub = ws.getRow(fila);
          sub.values = ['', 'Línea', 'Cuenta', '', 'Nombre de la cuenta', 'Centro', '', 'Debe', 'Haber'];
          sub.font = { italic: true, size: 9, color: { argb: 'FF666666' } };
          fila += 1;
          let tDebe = 0; let tHaber = 0;
          for (const l of ls) {
            const x = ws.getRow(fila);
            x.values = ['', l.linea, l.cuentas?.codigo || '', '', l.cuentas?.nombre || '', l.centros_costo?.codigo || '', '', Number(l.debe) || null, Number(l.haber) || null];
            x.getCell(8).numFmt = monto; x.getCell(9).numFmt = monto; x.font = { size: 9.5 };
            tDebe += Number(l.debe || 0); tHaber += Number(l.haber || 0);
            fila += 1;
          }
          if (!ls.length) { ws.getRow(fila).getCell(5).value = 'Sin detalle contable'; ws.getRow(fila).font = { italic: true, size: 9, color: { argb: 'FF999999' } }; fila += 1; }
          else {
            const t = ws.getRow(fila);
            t.values = ['', '', '', '', Math.abs(tDebe - tHaber) < 0.005 ? 'Totales · cuadra' : 'Totales · NO CUADRA', '', '', tDebe, tHaber];
            t.getCell(8).numFmt = monto; t.getCell(9).numFmt = monto; t.font = { bold: true, size: 9.5 };
            [8, 9].forEach((c) => { t.getCell(c).border = { top: { style: 'thin' } }; });
            fila += 1;
          }
          fila += 1;
        }
      }
      // Total general de los vigentes.
      const tg = ws.getRow(fila + (tipo === 'DETALLADO' ? 0 : 1));
      tg.getCell(6).value = `Total de ${filas.filter((d) => d.estado === 'ACTIVO').length} ${cfg.plural} ${cfg.vigentes} (de ${filas.length})`;
      tg.getCell(9).value = total; tg.getCell(9).numFmt = monto; tg.font = { bold: true };
      for (let c = 1; c <= ultima; c += 1) tg.getCell(c).border = { top: { style: 'medium', color: { argb: azul } } };
      ws.autoFilter = tipo === 'DETALLADO' ? undefined : { from: { row: 7, column: 1 }, to: { row: 7, column: ultima } };

      const buf = await wb.xlsx.writeBuffer();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = `${cfg.plural.normalize('NFD').replace(/[̀-ͯ]/g, '')}_${tipo === 'DETALLADO' ? 'detallado' : 'resumido'}_${emp?.codigo || ''}_${f.desde}_${f.hasta}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      window.FIN.aviso(`Reporte ${tipo === 'DETALLADO' ? 'detallado' : 'resumido'} generado: ${filas.length.toLocaleString('es-GT')} ${cfg.plural}`);
    }

    function excelCsv(filas) {
      const emp = ctx.localidad(ctx.sel.loc);
      const cab = [cfg.conTipo ? 'Tipo · nota' : cfg.numero, 'Folio', 'Fecha', 'Cuenta bancaria', cfg.quien, 'Cliente o proveedor', 'Descripción', 'Moneda', 'Valor', 'Valor Q', 'Estado', 'Conciliado', 'Partida', 'Compras'];
      const datos = filas.map((d) => [tipoNota(d) ? `${tipoNota(d).corto} ${d.numero_documento || ''}` : d.numero_documento, d.folio, d.fecha, cuenta(d.cuenta_bancaria_id)?.numero || '', quienDe(d), d.tercero_nombre || '', d.descripcion || '', sim(d), d.valor, d.valor_ml,
        d.estado === 'ANULADO' ? 'ANULADO' : 'VIGENTE', d.conciliado ? 'SÍ' : 'NO', partida(d.partida_id), compras.get(d.id) || 0]);
      window.COMPRAS_CAT.descargarCsv(`consulta_${cfg.plural.normalize('NFD').replace(/[̀-ͯ]/g, '')}_${emp?.codigo || ''}_${f.desde}_${f.hasta}.csv`, [cab, ...datos]);
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { sel = null; return cargarLocalidad(); }
      if (cambio === 'otro') {
        const n = e.target.name;
        if (n === 'estado' || n === 'tercero' || n === 'tipo') { f[n] = e.target.value; pintarMaestro(); return elegir(visibles().find((d) => d.id === sel?.id) || visibles()[0] || null); }
        if (n === 'orden') { [f.orden, f.dir] = e.target.value.split(':'); return pintarMaestro(); }
        if (n === 'cuenta' || n === 'desde' || n === 'hasta') { f[n] = e.target.value; sel = null; return consultar(); }
      }
    });
    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-buscar]')) return;
      f.buscar = e.target.value;
      const pos = e.target.selectionStart;
      pintarMaestro();
      const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
    });
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-buscar]')) e.preventDefault();
      if (e.key === 'Enter' && e.target.matches('tr[data-cheque]')) e.target.click();
    });
    cont.addEventListener('click', (e) => {
      const q = e.target.closest('[data-consultar]');
      if (q) { const d = cheques.find((x) => String(x.id) === q.dataset.consultar); location.hash = `#/caja-bancos/${cfg.ruta(d || {})}/${q.dataset.consultar}`; return; }
      if (e.target.closest('[data-ver-todos]') && rango) { f.desde = rango.desde; f.hasta = rango.hasta > fmt.hoy() ? rango.hasta : fmt.hoy(); sel = null; pintarFiltros(); return consultar(); }
      const th = e.target.closest('[data-ordenar]');
      if (th) { const campo = th.dataset.ordenar; f.dir = f.orden === campo && f.dir === 'desc' ? 'asc' : 'desc'; f.orden = campo; const o = ctx.pFil.querySelector('[name=orden]'); if (o) o.value = `${f.orden}:${f.dir}`; return pintarMaestro(); }
      const tr = e.target.closest('tr[data-cheque]');
      if (tr && ctx.pMae.contains(tr)) return elegir(cheques.find((d) => String(d.id) === tr.dataset.cheque));
      const ac = e.target.closest('[data-accion]');
      if (ac?.dataset.accion === 'excel') return excel();
    });

    iniciar();
  }
})();
