// Contabilidad · Registros · Consulta de Partidas: el mismo diseño de la Consulta de Cheques.
//   Arriba los parámetros (empresa, tipo de partida, clasificación, fecha inicial —por omisión la de la primera
//   partida de la empresa—, fecha final, orden y estado) y la lista de partidas con sus totales; abajo la partida
//   elegida con su detalle contable y los documentos que la generaron (depósitos, cheques, notas y cajas chicas).
//   «Consultar» abre la partida en Partidas contables. Reportes en PDF y Excel, resumidos o detallados.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const CLASIFICACIONES = ['PARTIDA DEL MES', 'PARTIDA DE APERTURA', 'PARTIDA DE AJUSTE', 'PARTIDA DE CIERRE'];
  const ORDENES = [['fecha:desc', 'Fecha ↓'], ['fecha:asc', 'Fecha ↑'], ['numero:desc', 'Número ↓'], ['numero:asc', 'Número ↑'], ['valor:desc', 'Valor ↓'], ['valor:asc', 'Valor ↑']];
  const ESTADOS = ['TODAS', 'VIGENTES', 'POR APROBAR', 'APROBADAS', 'DEFINITIVAS', 'ANULADAS', 'DESCUADRADAS'];
  const TIPO_DOC = { DEPOSITO: 'Depósito', CHEQUE: 'Cheque', NOTA_CREDITO: 'Nota de crédito', NOTA_DEBITO: 'Nota de débito' };
  const RUTA_DOC = { DEPOSITO: 'depositos', CHEQUE: 'emision-de-cheques', NOTA_CREDITO: 'notas-credito', NOTA_DEBITO: 'notas-debito' };

  window.PANTALLAS['consulta-de-partidas'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Consulta de Partidas', icono: 'ti-file-search', clase: 'bk-movimientos bk-consultar cb-apilado bk-consulta-cheques pz-consulta', grupo: 'Registros' });
    const { sb } = ctx;
    const primeroDelMes = () => `${fmt.hoy().slice(0, 7)}-01`;
    const f = { tipo: '', clasif: '', desde: primeroDelMes(), hasta: fmt.hoy(), estado: 'TODAS', buscar: '', orden: 'fecha', dir: 'desc' };
    let tipos = [];
    let partidas = [];
    let sel = null;
    let consulta = 0;
    let rango = null;
    let detalle = { lineas: [], bancos: [], cajas: [] };

    const tipo = (id) => tipos.find((t) => t.id === id);
    const periodo = (p) => p.anio * 100 + p.mes;
    const nombre = (p) => `${String(p.mes).padStart(2, '0')}-${p.numero}`;
    const cuadra = (p) => Math.abs(Number(p.total_debe) - Number(p.total_haber)) < 0.005;
    const estadoDe = (p) => p.estado === 'ANULADA' ? ['anulada', 'Anulada'] : p.definitiva ? ['definitiva', 'Definitiva'] : p.aprobada ? ['aprobada', 'Aprobada'] : ['pendiente', 'Por aprobar'];
    const am = (fecha) => Number(fecha.slice(0, 4)) * 100 + Number(fecha.slice(5, 7));

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Tipo de partida</span><select name="tipo"><option value="">Todos</option>${tipos.map((t) => `<option value="${t.id}" ${String(f.tipo) === String(t.id) ? 'selected' : ''}>${esc(t.siglas)} · ${esc(t.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Clasificación</span><select name="clasif"><option value="">Todas</option>${CLASIFICACIONES.map((c) => `<option ${f.clasif === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Ordenar por</span><select name="orden">${ORDENES.map(([k, t]) => `<option value="${k}" ${`${f.orden}:${f.dir}` === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado">${ESTADOS.map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>`,
        `<div class="bmc-reportes"><button type="button" class="boton secundario-sm bca-pdf" data-accion="pdf" title="Reporte en PDF: resumido o detallado"><i class="ti ti-file-type-pdf" aria-hidden="true"></i><span><b>Imprimir en PDF</b><small>Resumido o detallado</small></span></button>
         <button type="button" class="boton cqc-excel" data-accion="excel" title="Reporte en Excel: resumido o detallado"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i><span><b>Generar Excel</b><small>Resumido o detallado</small></span></button></div>`);
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const { data } = await sb.from('tipos_partida').select('id, codigo, siglas, nombre').eq('activo', true).order('codigo');
      tipos = data || [];
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      // Fecha inicial por omisión: el primer día del mes en curso (cada vez que se abre la pantalla o se cambia de empresa).
      f.desde = primeroDelMes(); f.hasta = fmt.hoy();
      pintarFiltros();
      await consultar();
    }

    async function consultar(id = sel?.id) {
      const loc = ctx.sel.loc;
      if (!loc) { partidas = []; pintar(); return; }
      const yo = ++consulta;
      const lista = [];
      for (let p = 0; p < 20000; p += 1000) {
        let q = sb.from('partidas').select('*').eq('localidad_id', loc).gte('anio', Number(f.desde.slice(0, 4))).lte('anio', Number(f.hasta.slice(0, 4)))
          .order('anio', { ascending: false }).order('mes', { ascending: false }).order('numero', { ascending: false }).range(p, p + 999);
        if (f.tipo) q = q.eq('tipo_partida_id', Number(f.tipo));
        if (f.clasif) q = q.eq('clasificacion', f.clasif);
        const r = await q;
        if (yo !== consulta) return;
        if (r.error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(r.error.message)}</p>`; return; }
        lista.push(...(r.data || []));
        if ((r.data || []).length < 1000) break;
      }
      const d = am(f.desde), h = am(f.hasta);
      partidas = lista.filter((p) => periodo(p) >= d && periodo(p) <= h);
      rango = null;
      if (!partidas.length) {
        const [a, b] = await Promise.all([
          sb.from('partidas').select('anio, mes', { count: 'exact' }).eq('localidad_id', loc).order('anio').order('mes').limit(1),
          sb.from('partidas').select('anio, mes').eq('localidad_id', loc).order('anio', { ascending: false }).order('mes', { ascending: false }).limit(1)]);
        if (a.count) rango = { n: a.count, desde: `${a.data[0].anio}-${String(a.data[0].mes).padStart(2, '0')}-01`, hasta: `${b.data[0].anio}-${String(b.data[0].mes).padStart(2, '0')}-28` };
      }
      sel = partidas.find((p) => p.id === id) || null;
      pintar();
      if (!sel && visibles()[0]) await elegir(visibles()[0]);
    }

    const visibles = () => {
      const q = f.buscar.trim().toLowerCase();
      return partidas.filter((p) => (f.estado === 'TODAS' || (f.estado === 'VIGENTES' && p.estado === 'VIGENTE') || (f.estado === 'ANULADAS' && p.estado === 'ANULADA')
        || (f.estado === 'POR APROBAR' && p.estado === 'VIGENTE' && !p.aprobada) || (f.estado === 'APROBADAS' && p.estado === 'VIGENTE' && p.aprobada && !p.definitiva)
        || (f.estado === 'DEFINITIVAS' && p.definitiva) || (f.estado === 'DESCUADRADAS' && p.estado === 'VIGENTE' && !cuadra(p)))
        && (!q || [nombre(p), p.numero_anual, p.descripcion, p.usuario, p.origen, tipo(p.tipo_partida_id)?.siglas, tipo(p.tipo_partida_id)?.nombre].some((v) => String(v || '').toLowerCase().includes(q))))
        .sort((a, b) => {
          const va = f.orden === 'numero' ? a.numero_anual : f.orden === 'valor' ? Number(a.total_debe) : `${periodo(a)}-${String(a.numero).padStart(6, '0')}`;
          const vb = f.orden === 'numero' ? b.numero_anual : f.orden === 'valor' ? Number(b.total_debe) : `${periodo(b)}-${String(b.numero).padStart(6, '0')}`;
          const x = va < vb ? -1 : va > vb ? 1 : 0;
          return f.dir === 'asc' ? x : -x;
        });
    };
    const ordenTh = (campo, texto, clase = '') => `<th class="${clase} cq-orden ${f.orden === campo ? 'activo' : ''}" data-ordenar="${campo}" title="Ordenar por ${texto.toLowerCase()}">${texto} <i class="ti ${f.orden === campo ? (f.dir === 'asc' ? 'ti-sort-ascending' : 'ti-sort-descending') : 'ti-arrows-sort'}" aria-hidden="true"></i></th>`;

    async function elegir(p) {
      sel = p;
      detalle = { lineas: [], bancos: [], cajas: [] };
      if (p) {
        ctx.pDet.innerHTML = ctx.vacio('Cargando el detalle de la partida…', 'ti-loader-2');
        const [l, b, c] = await Promise.all([
          sb.from('partida_lineas').select('linea, concepto, debe, haber, cuentas(codigo, nombre, catalogos_cuentas(version)), centros_costo(codigo, nombre)').eq('partida_id', p.id).order('linea'),
          sb.from('movimientos_bancarios').select('id, tipo, folio, numero_documento, fecha, valor, valor_ml, moneda_id, tercero_nombre, deposito_por, estado').eq('partida_id', p.id).order('fecha'),
          sb.from('caja_periodos').select('id, numero, anio, mes, caja_id, cajas_chicas(codigo, nombre)').eq('partida_id', p.id)
        ]);
        if (sel !== p) return;
        detalle = { lineas: l.data || [], bancos: b.error ? [] : b.data || [], cajas: c.error ? [] : c.data || [] };
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-partida]').forEach((tr) => tr.classList.toggle('actual', !!p && tr.dataset.partida === String(p.id)));
    }

    function pintar() { pintarMaestro(); pintarDetalle(); }

    function pintarMaestro() {
      const filas = visibles();
      const vivas = filas.filter((p) => p.estado === 'VIGENTE');
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>Partidas <small>${filas.length}</small></h2>
          <div class="ta-totales pc-resumen">
            <span class="ta-total"><b>Q ${fmt.monto(vivas.reduce((t, p) => t + Number(p.total_debe || 0), 0))}</b> vigentes (${vivas.length})</span>
            <span class="ta-total"><b>${filas.length - vivas.length}</b> anuladas</span>
            <span class="ta-total sin"><b>${vivas.filter((p) => !p.aprobada).length}</b> por aprobar</span>
            <span class="ta-total"><b>${vivas.filter((p) => p.aprobada && !p.definitiva).length}</b> aprobadas</span>
            <span class="ta-total"><b>${vivas.filter((p) => p.definitiva).length}</b> definitivas</span>
            <span class="ta-total sin"><b>${vivas.filter((p) => !cuadra(p)).length}</b> descuadradas</span>
          </div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Partida, descripción, usuario…" value="${esc(f.buscar)}" aria-label="Buscar partidas"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table class="cqc-tabla pz-tabla"><colgroup><col class="w-pz-num"><col class="w-fecha"><col class="w-pz-tipo"><col><col class="w-pz-origen"><col class="w-valor"><col class="w-estado"><col class="w-acc"></colgroup>
            <thead><tr>${ordenTh('numero', 'Partida', 'num')}${ordenTh('fecha', 'Período')}<th>Tipo</th><th>Descripción · usuario</th><th>Origen</th>${ordenTh('valor', 'Valor', 'num')}<th>Estado</th><th aria-label="Consultar"></th></tr></thead>
            <tbody>${filas.map((p) => { const [cls, txt] = estadoDe(p); const t = tipo(p.tipo_partida_id); return `<tr data-partida="${p.id}" class="${sel && sel.id === p.id ? 'actual' : ''} ${p.estado === 'ANULADA' ? 'pc-anulada' : ''}" tabindex="0">
              <td class="num fuerte">${nombre(p)}<small class="cq-ant">anual ${p.numero_anual}</small></td>
              <td>${MESES[p.mes - 1].slice(0, 3)} ${p.anio}<small class="cq-ant">${esc(fmt.fechaDia(String(p.fecha).slice(0, 10)))}</small></td>
              <td><span class="pc-tipo" title="${esc(t?.nombre || '')}">${esc(t?.siglas || '')}</span></td>
              <td class="cqc-quien" title="${esc(p.descripcion || '')}"><b>${esc(p.descripcion || '—')}</b><small>${esc(p.usuario || '')} · ${esc((p.clasificacion || '').toLowerCase())}</small></td>
              <td><small>${esc(p.origen || '')}</small></td>
              <td class="num"><b>${fmt.monto(p.total_debe)}</b>${cuadra(p) ? '' : `<small class="pc-rojo">dif. ${fmt.monto(Math.abs(Number(p.total_debe) - Number(p.total_haber)))}</small>`}</td>
              <td class="cqc-estado"><span class="pc-marca ${cls}">${txt}</span>${cuadra(p) ? '' : ' <span class="pc-marca descuadrada">Descuadrada</span>'}</td>
              <td class="cq-acc"><button type="button" class="boton secundario-sm cqc-ver" data-consultar="${p.id}" title="Consultar: abrir la partida en Partidas contables" aria-label="Consultar la partida ${nombre(p)}"><i class="ti ti-file-search" aria-hidden="true"></i> Consultar</button></td></tr>`; }).join('')
              || `<tr><td colspan="8" class="tk-vacio"><i class="ti ti-file-search" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : !partidas.length && rango ? `No hay partidas entre el ${esc(fmt.fechaDia(f.desde))} y el ${esc(fmt.fechaDia(f.hasta))}. La empresa tiene <b>${rango.n.toLocaleString('es-GT')}</b> partidas. <button type="button" class="boton primario-sm" data-ver-todos>Ver todas</button>` : 'No hay partidas con estos parámetros.'}</td></tr>`}</tbody></table>
        </div>`;
    }

    function pintarDetalle() {
      const p = sel;
      if (!p) { ctx.pDet.innerHTML = ctx.vacio(ctx.sel.loc ? 'Elige una partida para ver su detalle.' : 'Elige la empresa.', 'ti-file-search'); return; }
      const { lineas, bancos, cajas } = detalle;
      const t = tipo(p.tipo_partida_id);
      const [cls, txt] = estadoDe(p);
      const debe = lineas.reduce((s, l) => s + Number(l.debe || 0), 0);
      const haber = lineas.reduce((s, l) => s + Number(l.haber || 0), 0);
      const docs = [...bancos.map((b) => ({ tipo: TIPO_DOC[b.tipo] || b.tipo, doc: `${b.numero_documento || ''} · folio ${b.folio}`, fecha: b.fecha, quien: b.tercero_nombre || b.deposito_por || '', valor: b.valor_ml, href: `#/caja-bancos/${RUTA_DOC[b.tipo]}/${b.id}` })),
        ...cajas.map((c) => ({ tipo: 'Caja chica', doc: `Caja ${c.cajas_chicas?.codigo ?? ''} · subcaja ${c.numero}`, fecha: `${c.anio}-${String(c.mes).padStart(2, '0')}-01`, quien: c.cajas_chicas?.nombre || '', valor: null, href: '#/caja-bancos/cajas-chicas' }))];
      ctx.pDet.innerHTML = `
        <div class="tk-form cq-ficha">
          <header class="tk-titulo cb-titulo">
            <span class="tk-icono"><i class="ti ti-file-invoice" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>Partida ${nombre(p)} · anual ${p.numero_anual} · ${esc(t ? `${t.siglas} · ${t.nombre}` : '')} · ${esc((p.clasificacion || '').toLowerCase())}</small><h2>${esc(p.descripcion || 'Sin descripción')}</h2></div>
            <dl class="cq-datos">
              <div><dt>Período</dt><dd>${MESES[p.mes - 1]} ${p.anio}</dd></div>
              <div><dt>Valor</dt><dd>Q ${fmt.monto(p.total_debe)}</dd></div>
              <div><dt>Estado</dt><dd><span class="pc-marca ${cls}">${txt}</span></dd></div>
              <div><dt>Origen</dt><dd>${esc(p.origen || '—')}</dd></div>
              <div><dt>Usuario</dt><dd>${esc(p.usuario || '—')}</dd></div>
            </dl>
            <div class="tk-titulo-acciones">
              <a class="boton primario-sm" href="#/contabilidad/partidas-contables/${p.id}"><i class="ti ti-eye" aria-hidden="true"></i> Ver en Partidas contables</a>
            </div>
          </header>
          ${p.justificacion || p.estado === 'ANULADA' ? `<p class="cqc-concepto"><i class="ti ti-file-text" aria-hidden="true"></i> ${esc(p.justificacion || '')}${p.estado === 'ANULADA' ? ` <span class="pc-rojo">· Anulada por ${esc(p.anulada_por || '')}: ${esc(p.motivo_anulacion || '')}</span>` : ''}</p>` : ''}
          <div class="cq-det">
            <section class="cb-bloque cq-conta">
              <h3 class="ta-col-titulo"><i class="ti ti-list-details" aria-hidden="true"></i> Detalle contable <small>${lineas.length}</small>${lineas.length ? (Math.abs(debe - haber) < 0.005 ? ' <span class="pc-marca aprobada">Cuadra</span>' : ' <span class="pc-marca anulada">No cuadra</span>') : ''}</h3>
              <div class="pc-lineas"><table><thead><tr><th class="pc-n">#</th><th>Cuenta</th><th>Nombre</th><th>Concepto</th><th>Centro</th><th class="num">Debe</th><th class="num">Haber</th></tr></thead>
                <tbody>${lineas.map((l) => `<tr><td class="pc-n">${l.linea}</td><td class="fuerte">${esc(l.cuentas?.codigo || '')}</td><td class="cc-nombre">${esc(l.cuentas?.nombre || '')}${l.cuentas?.catalogos_cuentas?.version ? ` <span class="pc-tipo cf-version">v${l.cuentas.catalogos_cuentas.version}</span>` : ''}</td><td class="cc-nombre">${esc(l.concepto || '')}</td><td>${esc(l.centros_costo?.codigo || '')}</td><td class="num">${Number(l.debe) ? fmt.monto(l.debe) : ''}</td><td class="num">${Number(l.haber) ? fmt.monto(l.haber) : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="tk-vacio">Sin detalle contable.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="5">Totales</td><td class="num">${fmt.monto(debe)}</td><td class="num">${fmt.monto(haber)}</td></tr></tfoot></table></div>
            </section>
            <section class="cb-bloque cq-lineas">
              <h3 class="ta-col-titulo"><i class="ti ti-files" aria-hidden="true"></i> Documentos que la generaron <small>${docs.length}</small></h3>
              <div class="pc-lineas"><table><thead><tr><th>Tipo</th><th>Documento</th><th>Fecha</th><th>Tercero · caja</th><th class="num">Valor Q</th><th></th></tr></thead>
                <tbody>${docs.map((x) => `<tr><td><span class="pc-tipo">${esc(x.tipo)}</span></td><td class="fuerte">${esc(x.doc)}</td><td>${esc(x.fecha ? fmt.fechaDia(String(x.fecha).slice(0, 10)) : '')}</td><td class="cc-nombre">${esc(x.quien)}</td><td class="num">${x.valor != null ? fmt.monto(x.valor) : ''}</td><td><a class="rp-enlace" href="${x.href}" title="Abrir el documento"><i class="ti ti-external-link" aria-hidden="true"></i></a></td></tr>`).join('')
                  || `<tr><td colspan="6" class="tk-vacio">${p.origen === 'MANUAL' ? 'Partida manual: no la generó ningún documento.' : 'Ningún documento de bancos o cajas está ligado a esta partida.'}</td></tr>`}</tbody></table></div>
            </section>
          </div>
        </div>`;
    }

    // ---------- Reportes (PDF y Excel): resumido o detallado, con los parámetros de la pantalla ----------
    function parametros() {
      const emp = ctx.localidad(ctx.sel.loc);
      const t = tipo(Number(f.tipo));
      const orden = ORDENES.find(([k]) => k === `${f.orden}:${f.dir}`)?.[1] || '';
      return [`Empresa: ${emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '—'}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, `Tipo: ${t ? `${t.siglas} · ${t.nombre}` : 'Todos'}`,
        `Clasificación: ${f.clasif || 'Todas'}`, `Estado: ${f.estado}`, `Orden: ${orden}`, ...(f.buscar.trim() ? [`Búsqueda: ${f.buscar.trim()}`] : [])];
    }
    function dialogo(formato) {
      const filas = visibles();
      if (!filas.length) return window.FIN.aviso('No hay partidas con estos parámetros');
      let formRef = null;
      window.UI.formulario({
        titulo: `Reporte de partidas · ${formato === 'PDF' ? 'Imprimir en PDF' : 'Generar Excel'}`,
        campos: [],
        alPreparar: (form) => {
          formRef = form;
          form.querySelector('.modal-cuerpo').innerHTML = `
            <fieldset class="cqc-tipos"><legend>Tipo de reporte</legend>
              <label class="cqc-tipo"><input type="radio" name="tipo" value="RESUMIDO" checked><i class="ti ti-list" aria-hidden="true"></i><span><b>Resumido</b><small>El listado de las ${filas.length.toLocaleString('es-GT')} partidas.</small></span></label>
              <label class="cqc-tipo"><input type="radio" name="tipo" value="DETALLADO"><i class="ti ti-list-details" aria-hidden="true"></i><span><b>Detallado</b><small>Cada partida con su detalle contable.</small></span></label>
            </fieldset>
            <p class="bu-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> Con los filtros de la pantalla: ${esc(parametros().join(' · '))}.</p>`;
          form.querySelector('[type=submit]').innerHTML = formato === 'PDF' ? '<i class="ti ti-file-type-pdf" aria-hidden="true"></i> Imprimir en PDF' : '<i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Generar Excel';
        },
        alGuardar: async () => { await reporte(formato, formRef?.elements.tipo?.value || 'RESUMIDO', filas); }
      });
    }
    async function reporte(formato, modo, filas) {
      const lineasDe = new Map();
      if (modo === 'DETALLADO') {
        const ids = filas.map((p) => p.id);
        for (let i = 0; i < ids.length; i += 200) {
          const { data } = await sb.from('partida_lineas').select('partida_id, linea, concepto, debe, haber, cuentas(codigo, nombre), centros_costo(codigo)').in('partida_id', ids.slice(i, i + 200)).order('linea');
          (data || []).forEach((l) => { if (!lineasDe.has(l.partida_id)) lineasDe.set(l.partida_id, []); lineasDe.get(l.partida_id).push(l); });
        }
      }
      const vivas = filas.filter((p) => p.estado === 'VIGENTE');
      const total = vivas.reduce((s, p) => s + Number(p.total_debe || 0), 0);
      const est = (p) => `${estadoDe(p)[1]}${cuadra(p) ? '' : ' · descuadrada'}`;
      if (formato === 'PDF') {
        window.BANCOS.imprimir('Consulta de Partidas', `
          <h1>Consulta de Partidas · ${modo === 'DETALLADO' ? 'detallado' : 'resumido'}</h1>
          <h2>${esc(parametros().join(' · '))}</h2>
          <table><thead><tr><th>Partida</th><th>Anual</th><th>Período</th><th>Tipo</th><th>Descripción</th><th>Usuario</th><th class="n">Debe</th><th class="n">Haber</th><th>Estado</th></tr></thead><tbody>
          ${filas.map((p) => `<tr class="${modo === 'DETALLADO' ? 's' : ''}"><td>${nombre(p)}</td><td>${p.numero_anual}</td><td>${MESES[p.mes - 1]} ${p.anio}</td><td>${esc(tipo(p.tipo_partida_id)?.siglas || '')}</td><td>${esc(p.descripcion || '')}</td><td>${esc(p.usuario || '')}</td><td class="n">${fmt.monto(p.total_debe)}</td><td class="n">${fmt.monto(p.total_haber)}</td><td>${est(p)}</td></tr>
            ${modo === 'DETALLADO' ? (lineasDe.get(p.id) || []).map((l) => `<tr><td></td><td>${l.linea}</td><td colspan="2">${esc(l.cuentas?.codigo || '')}</td><td>${esc(l.cuentas?.nombre || '')}${l.concepto ? ` · ${esc(l.concepto)}` : ''}</td><td>${esc(l.centros_costo?.codigo || '')}</td><td class="n">${Number(l.debe) ? fmt.monto(l.debe) : ''}</td><td class="n">${Number(l.haber) ? fmt.monto(l.haber) : ''}</td><td></td></tr>`).join('') || '<tr><td></td><td colspan="8">Sin detalle contable</td></tr>' : ''}`).join('')}
          </tbody><tfoot><tr><td colspan="6">Total de ${vivas.length} partidas vigentes (de ${filas.length})</td><td class="n">${fmt.monto(total)}</td><td class="n">${fmt.monto(vivas.reduce((s, p) => s + Number(p.total_haber || 0), 0))}</td><td></td></tr></tfoot></table>`, { locId: ctx.sel.loc, horizontal: true });
        return;
      }
      if (!window.REPORTE_XLSX) return;
      const datos = [];
      filas.forEach((p) => {
        datos.push({ resaltar: modo === 'DETALLADO' ? 1 : 0, tenue: p.estado === 'ANULADA', valores: [nombre(p), p.numero_anual, `${MESES[p.mes - 1]} ${p.anio}`, tipo(p.tipo_partida_id)?.siglas || '', p.descripcion || '', p.usuario || '', p.origen || '', Number(p.total_debe || 0), Number(p.total_haber || 0), est(p)] });
        if (modo === 'DETALLADO') {
          const ls = lineasDe.get(p.id) || [];
          ls.forEach((l) => datos.push({ tipo: 'nota', valores: ['', l.linea, l.cuentas?.codigo || '', l.centros_costo?.codigo || '', l.cuentas?.nombre || '', l.concepto || '', '', Number(l.debe) || null, Number(l.haber) || null] }));
          if (!ls.length) datos.push({ tipo: 'nota', valores: ['', '', '', '', 'Sin detalle contable'] });
        }
      });
      datos.push({ tipo: 'total', valores: ['', '', '', '', `Total de ${vivas.length} partidas vigentes (de ${filas.length})`, '', '', total, vivas.reduce((s, p) => s + Number(p.total_haber || 0), 0), ''] });
      const emp = ctx.localidad(ctx.sel.loc);
      window.REPORTE_XLSX.generar({
        titulo: `Consulta de Partidas · ${modo === 'DETALLADO' ? 'Detallado' : 'Resumido'}`, parametros: parametros(), orgId: ctx.sel.org, locId: ctx.sel.loc,
        hoja: 'Partidas', archivo: `partidas_${modo.toLowerCase()}_${emp?.codigo || ''}_${f.desde}_${f.hasta}`, autofiltro: modo !== 'DETALLADO',
        columnas: [{ titulo: 'Partida', ancho: 10 }, { titulo: modo === 'DETALLADO' ? 'Anual · línea' : 'Anual', ancho: 9 }, { titulo: modo === 'DETALLADO' ? 'Período · cuenta' : 'Período', ancho: 16 }, { titulo: modo === 'DETALLADO' ? 'Tipo · centro' : 'Tipo', ancho: 9 },
          { titulo: modo === 'DETALLADO' ? 'Descripción · nombre de la cuenta' : 'Descripción', ancho: 50 }, { titulo: modo === 'DETALLADO' ? 'Usuario · concepto' : 'Usuario', ancho: 22 }, { titulo: 'Origen', ancho: 12 },
          { titulo: 'Debe', ancho: 15, tipo: 'monto' }, { titulo: 'Haber', ancho: 15, tipo: 'monto' }, { titulo: 'Estado', ancho: 18 }],
        filas: datos
      });
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { sel = null; return cargarLocalidad(); }
      if (cambio === 'otro') {
        const n = e.target.name;
        if (n === 'estado') { f.estado = e.target.value; pintarMaestro(); return elegir(visibles().find((p) => p.id === sel?.id) || visibles()[0] || null); }
        if (n === 'orden') { [f.orden, f.dir] = e.target.value.split(':'); return pintarMaestro(); }
        if (['tipo', 'clasif', 'desde', 'hasta'].includes(n)) { f[n] = e.target.value; sel = null; return consultar(); }
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
      if (e.key === 'Enter' && e.target.matches('tr[data-partida]')) e.target.click();
    });
    cont.addEventListener('click', (e) => {
      const q = e.target.closest('[data-consultar]');
      if (q) { location.hash = `#/contabilidad/partidas-contables/${q.dataset.consultar}`; return; }
      if (e.target.closest('[data-ver-todos]') && rango) { f.desde = rango.desde; f.hasta = fmt.hoy(); sel = null; pintarFiltros(); return consultar(); }
      const th = e.target.closest('[data-ordenar]');
      if (th) { const campo = th.dataset.ordenar; f.dir = f.orden === campo && f.dir === 'desc' ? 'asc' : 'desc'; f.orden = campo; const o = ctx.pFil.querySelector('[name=orden]'); if (o) o.value = `${f.orden}:${f.dir}`; return pintarMaestro(); }
      const tr = e.target.closest('tr[data-partida]');
      if (tr && ctx.pMae.contains(tr)) return elegir(partidas.find((p) => String(p.id) === tr.dataset.partida));
      const ac = e.target.closest('[data-accion]');
      if (ac?.dataset.accion === 'excel') return dialogo('EXCEL');
      if (ac?.dataset.accion === 'pdf') return dialogo('PDF');
    });

    iniciar();
  };
})();
