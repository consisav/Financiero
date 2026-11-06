// Caja y Bancos · Cheques · Consulta de Cheques: resumen de los cheques de una empresa (organización y
// localidad) en un rango de fechas, como Consultar Compras: arriba el maestro con sus totales y abajo el
// detalle del cheque elegido (detalle contable, compras que liquidó y facturas pagadas).
// Filtros: cuenta bancaria, beneficiario o proveedor, fechas, estado (vigentes, anulados, conciliados, sin
// conciliar, sin partida) y orden (número, fecha o valor, ascendente o descendente; también con clic en el
// encabezado). «Consultar» abre el cheque en Emisión de cheques.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const ORDENES = [['fecha:desc', 'Fecha ↓'], ['fecha:asc', 'Fecha ↑'], ['numero:desc', 'Número ↓'], ['numero:asc', 'Número ↑'], ['valor:desc', 'Valor ↓'], ['valor:asc', 'Valor ↑']];
  const ESTADOS = ['TODOS', 'VIGENTES', 'ANULADOS', 'CONCILIADOS', 'SIN CONCILIAR', 'SIN PARTIDA'];

  window.PANTALLAS['consulta-de-cheques'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Consulta de Cheques', icono: 'ti-file-search', clase: 'bk-movimientos bk-consultar cb-apilado bk-consulta-cheques', grupo: 'Cheques' });
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

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Cuenta bancaria</span><select name="cuenta"><option value="">Todas</option>${cuentas.map((c) => `<option value="${c.id}" ${String(f.cuenta) === String(c.id) ? 'selected' : ''}>${esc(ctx.nombreCuentaBancaria(c))}</option>`).join('')}</select></label>
        <label class="campo cq-prov"><span>Beneficiario o proveedor</span><input name="tercero" value="${esc(f.tercero)}" placeholder="Todos (nombre o código)"></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Ordenar por</span><select name="orden">${ORDENES.map(([k, t]) => `<option value="${k}" ${`${f.orden}:${f.dir}` === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado">${ESTADOS.map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>`,
        '<button type="button" class="boton secundario-sm" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>');
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      cuentas = await ctx.cuentasBancarias();
      if (f.cuenta && !cuenta(Number(f.cuenta))) f.cuenta = '';
      pintarFiltros();
      await consultar();
    }

    async function consultar(id = sel?.id) {
      const loc = ctx.sel.loc;
      if (!loc) { cheques = []; pintar(); return; }
      let q = sb.from('movimientos_bancarios').select('*').eq('localidad_id', loc).eq('tipo', 'CHEQUE').gte('fecha', f.desde).lte('fecha', f.hasta)
        .order('fecha', { ascending: false }).order('folio', { ascending: false }).limit(5000);
      if (f.cuenta) q = q.eq('cuenta_bancaria_id', Number(f.cuenta));
      const yo = ++consulta;
      const r = await q;
      if (yo !== consulta) return;
      if (r.error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(r.error.message)}</p>`; return; }
      const lista = r.data || [];
      rango = null;
      if (!lista.length) {
        let qr = sb.from('movimientos_bancarios').select('fecha', { count: 'exact' }).eq('localidad_id', loc).eq('tipo', 'CHEQUE');
        if (f.cuenta) qr = qr.eq('cuenta_bancaria_id', Number(f.cuenta));
        const [a, b] = await Promise.all([qr.order('fecha').limit(1), sb.from('movimientos_bancarios').select('fecha').eq('localidad_id', loc).eq('tipo', 'CHEQUE').order('fecha', { ascending: false }).limit(1)]);
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
          sb.from('movimiento_documentos').select('movimiento_id').in('movimiento_id', ids.slice(i, i + 300)).not('compra_id', 'is', null)
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
      return cheques.filter((d) => (f.estado === 'TODOS' || (f.estado === 'VIGENTES' && d.estado === 'ACTIVO') || (f.estado === 'ANULADOS' && d.estado === 'ANULADO')
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
        ctx.pDet.innerHTML = ctx.vacio('Cargando el detalle del cheque…', 'ti-loader-2');
        const [l, c, m] = await Promise.all([
          sb.from('movimiento_lineas').select('linea, debe, haber, cuentas(codigo, nombre, catalogos_cuentas(version)), centros_costo(codigo, nombre)').eq('movimiento_id', d.id).order('linea'),
          sb.from('compra_documentos_banco').select('valor, liquidacion, compras(id, numero, serie, documento, fecha_documento, proveedor_nombre, valor_total, moneda_id)').eq('movimiento_id', d.id),
          sb.from('movimiento_documentos').select('tipo, serie, numero, nombre, valor, abono, compra_id').eq('movimiento_id', d.id).order('id')
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
          <h2>Cheques <small>${filas.length}</small></h2>
          <div class="ta-totales pc-resumen">
            <span class="ta-total"><b>Q ${fmt.monto(total)}</b> vigentes (${vivos.length})</span>
            <span class="ta-total"><b>${filas.length - vivos.length}</b> anulados</span>
            <span class="ta-total"><b>${vivos.filter((d) => d.conciliado).length}</b> conciliados</span>
            <span class="ta-total sin"><b>${vivos.filter((d) => !d.conciliado).length}</b> sin conciliar</span>
            <span class="ta-total sin"><b>${vivos.filter((d) => !d.partida_id).length}</b> sin partida</span>
          </div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Número, beneficiario, descripción…" value="${esc(f.buscar)}" aria-label="Buscar cheques"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table><thead><tr>${ordenTh('numero', 'Cheque', 'num')}${ordenTh('fecha', 'Fecha')}<th>Cuenta bancaria</th><th>A favor de</th><th>Descripción</th>${ordenTh('valor', 'Valor', 'num')}<th class="num">Valor Q</th><th>Estado</th><th>Conciliado</th><th>Partida</th><th class="num" title="Compras que liquidó">Compras</th><th class="cq-acc"></th></tr></thead>
            <tbody>${filas.map((d) => { const cb = cuenta(d.cuenta_bancaria_id); return `<tr data-cheque="${d.id}" class="${sel && sel.id === d.id ? 'actual' : ''} ${d.estado === 'ANULADO' ? 'pc-anulada' : ''}" tabindex="0">
              <td class="num fuerte">${esc(d.numero_documento || '')}<small class="cq-ant">folio ${d.folio}</small></td>
              <td>${esc(fmt.fechaDia(d.fecha))}</td>
              <td title="${esc(cb ? ctx.nombreCuentaBancaria(cb) : '')}">${esc(cb ? cb.numero : '')}</td>
              <td class="cc-nombre" title="${esc(d.deposito_por || d.tercero_nombre || '')}">${esc(d.deposito_por || d.tercero_nombre || '')}</td>
              <td class="cc-nombre cqc-desc" title="${esc(d.descripcion || '')}">${esc(d.descripcion || '')}</td>
              <td class="num">${esc(sim(d))} ${fmt.monto(d.valor)}</td><td class="num">${fmt.monto(d.valor_ml)}</td>
              <td><span class="pc-marca ${d.estado === 'ANULADO' ? 'anulada' : 'aprobada'}">${d.estado === 'ANULADO' ? 'Anulado' : 'Vigente'}</span></td>
              <td>${d.conciliado ? '<span class="pc-marca definitiva">Conciliado</span>' : '<span class="tk-tenue">No</span>'}</td>
              <td>${d.partida_id ? `<span class="pc-tipo">${esc(partida(d.partida_id))}</span>` : d.origen_anterior ? '<span class="tk-tenue" title="Cheque del sistema anterior">Sist. anterior</span>' : '<span class="tk-tenue">—</span>'}</td>
              <td class="num">${compras.get(d.id) || '<span class="tk-tenue">—</span>'}</td>
              <td class="cq-acc"><button type="button" class="boton secundario-sm" data-consultar="${d.id}" title="Abrir el cheque en Emisión de cheques"><i class="ti ti-eye" aria-hidden="true"></i> Consultar</button></td></tr>`; }).join('')
              || `<tr><td colspan="12" class="tk-vacio"><i class="ti ti-file-search" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : !cheques.length && rango ? `No hay cheques entre el ${esc(fmt.fechaDia(f.desde))} y el ${esc(fmt.fechaDia(f.hasta))}. La empresa tiene <b>${rango.n.toLocaleString('es-GT')}</b> cheques, del ${esc(fmt.fechaDia(rango.desde))} al ${esc(fmt.fechaDia(rango.hasta))}. <button type="button" class="boton primario-sm" data-ver-todos>Ver todos</button>` : 'No hay cheques con estos parámetros.'}</td></tr>`}</tbody></table>
        </div>`;
    }

    function pintarDetalle() {
      const d = sel;
      if (!d) { ctx.pDet.innerHTML = ctx.vacio(ctx.sel.loc ? 'Elige un cheque para ver su detalle.' : 'Elige la empresa.', 'ti-file-search'); return; }
      const { lineas, liquida, facturas } = detalle;
      const cb = cuenta(d.cuenta_bancaria_id);
      const debe = lineas.reduce((t, l) => t + Number(l.debe || 0), 0);
      const haber = lineas.reduce((t, l) => t + Number(l.haber || 0), 0);
      ctx.pDet.innerHTML = `
        <div class="tk-form cq-ficha">
          <header class="tk-titulo cb-titulo">
            <span class="tk-icono"><i class="ti ti-writing" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>Cheque ${esc(d.numero_documento || '')} · folio ${d.folio}${d.origen_anterior ? ' · del sistema anterior' : ''}${cb ? ` · ${esc(ctx.nombreCuentaBancaria(cb))}` : ''}</small><h2>${esc(d.deposito_por || d.tercero_nombre || 'Sin beneficiario')}</h2></div>
            <dl class="cq-datos">
              <div><dt>Fecha</dt><dd>${esc(fmt.fechaDia(d.fecha))}</dd></div>
              <div><dt>Valor</dt><dd>${esc(sim(d))} ${fmt.monto(d.valor)}${d.moneda_id !== ctx.monedaBase()?.id ? ` · Q ${fmt.monto(d.valor_ml)}` : ''}</dd></div>
              <div><dt>Estado</dt><dd>${d.estado === 'ANULADO' ? `Anulado${d.anulado_en ? ` ${esc(fmt.fechaDia(String(d.anulado_en).slice(0, 10)))}` : ''}` : 'Vigente'}${d.conciliado ? ' · conciliado' : ''}</dd></div>
              <div><dt>Partida</dt><dd>${d.partida_id ? esc(partida(d.partida_id)) : '—'}</dd></div>
              <div><dt>Operador</dt><dd>${esc(d.usuario || '—')}</dd></div>
            </dl>
            <div class="tk-titulo-acciones">
              <a class="boton primario-sm" href="#/caja-bancos/emision-de-cheques/${d.id}"><i class="ti ti-eye" aria-hidden="true"></i> Ver en Emisión de cheques</a>
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
              <h3 class="ta-col-titulo"><i class="ti ti-shopping-cart" aria-hidden="true"></i> Compras y facturas pagadas <small>${liquida.length + facturas.length}</small></h3>
              <div class="pc-lineas"><table><thead><tr><th>Compra</th><th>Documento</th><th>Fecha</th><th>Proveedor</th><th class="num">Total compra</th><th class="num">Liquidado</th><th></th></tr></thead>
                <tbody>${[...liquida.map((x) => ({ c: x.compras, valor: x.valor, nota: x.liquidacion ? `liq. ${x.liquidacion}` : '' })), ...facturas.map((x) => ({ c: null, doc: `${x.serie ? `${x.serie}-` : ''}${x.numero}`, nombre: x.nombre, valor: x.abono || x.valor, compraId: x.compra_id, nota: x.tipo }))].map((x) => `<tr>
                  <td class="fuerte">${x.c ? x.c.numero : x.compraId ? '—' : ''}</td><td>${esc(x.c ? `${x.c.serie ? `${x.c.serie}-` : ''}${x.c.documento}` : x.doc || '')}</td><td>${esc(x.c ? fmt.fechaDia(x.c.fecha_documento) : '')}</td>
                  <td class="cc-nombre">${esc(x.c ? x.c.proveedor_nombre : x.nombre || '')}</td><td class="num">${x.c ? fmt.monto(x.c.valor_total) : ''}</td><td class="num fuerte">${fmt.monto(x.valor)}</td>
                  <td>${x.c ? `<a class="rp-enlace" href="#/compras/facturas-compra/${x.c.id}" title="Abrir la compra"><i class="ti ti-external-link" aria-hidden="true"></i></a>` : `<small class="tk-tenue">${esc(x.nota || '')}</small>`}</td></tr>`).join('') || '<tr><td colspan="7" class="tk-vacio">El cheque no liquidó compras ni facturas.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="5">Total liquidado</td><td class="num">${fmt.monto([...liquida, ...facturas].reduce((t, x) => t + Number(x.abono || x.valor || 0), 0))}</td><td></td></tr></tfoot></table></div>
            </section>
          </div>
        </div>`;
    }

    function excel() {
      const filas = visibles();
      if (!filas.length) return window.FIN.aviso('No hay cheques con estos parámetros');
      const emp = ctx.localidad(ctx.sel.loc);
      const cab = ['Cheque', 'Folio', 'Fecha', 'Cuenta bancaria', 'A favor de', 'Proveedor', 'Descripción', 'Moneda', 'Valor', 'Valor Q', 'Estado', 'Conciliado', 'Partida', 'Compras'];
      const datos = filas.map((d) => [d.numero_documento, d.folio, d.fecha, cuenta(d.cuenta_bancaria_id)?.numero || '', d.deposito_por || '', d.tercero_nombre || '', d.descripcion || '', sim(d), d.valor, d.valor_ml,
        d.estado === 'ANULADO' ? 'ANULADO' : 'VIGENTE', d.conciliado ? 'SÍ' : 'NO', partida(d.partida_id), compras.get(d.id) || 0]);
      window.COMPRAS_CAT.descargarCsv(`consulta_cheques_${emp?.codigo || ''}_${f.desde}_${f.hasta}.csv`, [cab, ...datos]);
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { sel = null; return cargarLocalidad(); }
      if (cambio === 'otro') {
        const n = e.target.name;
        if (n === 'estado' || n === 'tercero') { f[n] = e.target.value; pintarMaestro(); return elegir(visibles().find((d) => d.id === sel?.id) || visibles()[0] || null); }
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
      if (q) { location.hash = `#/caja-bancos/emision-de-cheques/${q.dataset.consultar}`; return; }
      if (e.target.closest('[data-ver-todos]') && rango) { f.desde = rango.desde; f.hasta = rango.hasta > fmt.hoy() ? rango.hasta : fmt.hoy(); sel = null; pintarFiltros(); return consultar(); }
      const th = e.target.closest('[data-ordenar]');
      if (th) { const campo = th.dataset.ordenar; f.dir = f.orden === campo && f.dir === 'desc' ? 'asc' : 'desc'; f.orden = campo; const o = ctx.pFil.querySelector('[name=orden]'); if (o) o.value = `${f.orden}:${f.dir}`; return pintarMaestro(); }
      const tr = e.target.closest('tr[data-cheque]');
      if (tr && ctx.pMae.contains(tr)) return elegir(cheques.find((d) => String(d.id) === tr.dataset.cheque));
      const ac = e.target.closest('[data-accion]');
      if (ac?.dataset.accion === 'excel') return excel();
    });

    iniciar();
  };
})();
