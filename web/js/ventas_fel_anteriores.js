// Facturación/Ventas · Registros · Facturas FEL anteriores: consulta de las facturas FEL emitidas que se migraron de un
//   sistema anterior (Consisav CON_DETALLE_ARCHIVOS_VEN → carga_sat_ventas_lineas, script 330). El sistema anterior solo
//   guardaba el encabezado de cada DTE (sin productos ni pagos), por eso no están en la Consulta de Facturas.
//   Mismo diseño que la Consulta de Facturas. Solo lectura. Reportes en PDF y Excel con los filtros de la pantalla.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const diaLocal = (t) => t ? new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }) : '';
  const horaLocal = (t) => t ? new Date(t).toLocaleTimeString('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit' }) : '';
  const n = (v) => Number(v || 0);
  const ORDENES = [['fecha:desc', 'Fecha ↓'], ['fecha:asc', 'Fecha ↑'], ['valor:desc', 'Valor ↓'], ['valor:asc', 'Valor ↑']];
  const IMPUESTOS = [['petroleo', 'Petróleo'], ['turismo_hospedaje', 'Turismo hospedaje'], ['turismo_pasaje', 'Turismo pasaje'], ['timbre_prensa', 'Timbre de prensa'], ['bomberos', 'Bomberos'],
    ['tasa_municipal', 'Tasa municipal'], ['bebidas_alcohol', 'Bebidas alcohólicas'], ['tabaco', 'Tabaco'], ['cemento', 'Cemento'], ['bebidas_no_alcohol', 'Bebidas no alcohólicas'], ['tarifa_portuaria', 'Tarifa portuaria']];
  const COLS = 'id, carga_id, fecha_emision, fecha_emision_anterior, numero_autorizacion, tipo_dte, serie, numero, id_receptor, nombre_receptor, moneda, gran_total, iva, anulada, estado';

  window.PANTALLAS['facturas-fel-anteriores'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Facturas FEL anteriores', icono: 'ti-file-certificate', clase: 'bk-movimientos bk-consultar cb-apilado bk-consulta-cheques cqc-con-tipo vfc-consulta vla-consulta cq-fila', grupo: 'Ventas · Registros' });
    const { sb } = ctx;
    ctx.pFil.closest('.bk-espacio').style.setProperty('--cq-n', 6);
    const f = { desde: fmt.hoy(), hasta: fmt.hoy(), tipo: '', estado: 'TODAS', buscar: '', orden: 'fecha', dir: 'desc' };
    let facturas = [], tipos = [], sel = null, consulta = 0, rango = null, completo = null;

    const anulada = (x) => !!x.anulada;
    const docto = (x) => [x.serie, x.numero].filter(Boolean).join(' · ') || x.numero_autorizacion;

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Tipo de DTE</span><select name="tipo"><option value="">Todos</option>${tipos.map((t) => `<option ${f.tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="campo"><span>Ordenar por</span><select name="orden">${ORDENES.map(([k, t]) => `<option value="${k}" ${`${f.orden}:${f.dir}` === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado">${['TODAS', 'VIGENTES', 'ANULADAS'].map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>`,
        `<div class="bmc-reportes"><button type="button" class="boton secundario-sm bca-pdf" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i><span><b>Imprimir en PDF</b><small>Listado de facturas</small></span></button>
         <button type="button" class="boton cqc-excel" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i><span><b>Generar Excel</b><small>Listado de facturas</small></span></button></div>`);
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('carga_sat_ventas_lineas').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/carga_sat_ventas_lineas/.test(prueba.error.message) ? 'Falta instalar el script 330 (archivos SAT de Consisav) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      await cargarLocalidad();
    }
    // Periodo por omisión: toda la historia de la empresa si tiene hasta 5,000 facturas; si no, sus últimos tres meses con datos.
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      rango = null; f.tipo = ''; tipos = [];
      if (loc) {
        const [u, p] = await Promise.all([
          sb.from('carga_sat_ventas_lineas').select('fecha_emision', { count: 'exact' }).eq('localidad_id', loc).not('fecha_emision', 'is', null).order('fecha_emision', { ascending: false }).limit(1),
          sb.from('carga_sat_ventas_lineas').select('fecha_emision').eq('localidad_id', loc).not('fecha_emision', 'is', null).order('fecha_emision').limit(1)
        ]);
        if (u.data?.length) {
          rango = { n: u.count || 0, desde: diaLocal(p.data?.[0]?.fecha_emision || u.data[0].fecha_emision), hasta: diaLocal(u.data[0].fecha_emision) };
          const [y, m] = rango.hasta.split('-').map(Number); const k = y * 12 + m - 1 - 2;
          f.hasta = rango.hasta; f.desde = rango.n <= 5000 ? rango.desde : `${Math.floor(k / 12)}-${String(k % 12 + 1).padStart(2, '0')}-01`;
        } else { f.desde = fmt.hoy(); f.hasta = fmt.hoy(); }
      }
      pintarFiltros();
      await consultar();
    }
    async function consultar(id = sel?.id) {
      const loc = ctx.sel.loc;
      if (!loc) { facturas = []; pintar(); return; }
      const yo = ++consulta;
      ctx.pMae.innerHTML = ctx.vacio('Cargando las facturas FEL…', 'ti-loader-2');
      const lista = [];
      for (let p = 0; p < 60000; p += 1000) {
        const r = await sb.from('carga_sat_ventas_lineas').select(COLS).eq('localidad_id', loc).gte('fecha_emision', `${f.desde}T00:00:00-06:00`).lte('fecha_emision', `${f.hasta}T23:59:59.999-06:00`)
          .order('fecha_emision', { ascending: false }).order('id', { ascending: false }).range(p, p + 999);
        if (yo !== consulta) return;
        if (r.error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(r.error.message)}</p>`; return; }
        lista.push(...(r.data || []));
        if ((r.data || []).length < 1000) break;
      }
      facturas = lista;
      tipos = [...new Set(lista.map((x) => x.tipo_dte).filter(Boolean))].sort();
      if (f.tipo && !tipos.includes(f.tipo)) tipos.push(f.tipo);
      pintarFiltros();
      sel = facturas.find((x) => x.id === id) || null;
      pintar();
      if (!sel && visibles()[0]) await elegir(visibles()[0]);
    }
    const visibles = () => {
      const q = f.buscar.trim().toLowerCase();
      return facturas.filter((x) => (!f.tipo || x.tipo_dte === f.tipo)
        && (f.estado === 'TODAS' || (f.estado === 'ANULADAS') === anulada(x))
        && (!q || [x.serie, x.numero, x.numero_autorizacion, x.nombre_receptor, x.id_receptor].some((v) => String(v || '').toLowerCase().includes(q))))
        .sort((a, b) => {
          const va = f.orden === 'valor' ? n(a.gran_total) : a.fecha_emision || '', vb = f.orden === 'valor' ? n(b.gran_total) : b.fecha_emision || '';
          const d = va < vb ? -1 : va > vb ? 1 : a.id - b.id;
          return f.dir === 'asc' ? d : -d;
        });
    };
    const ordenTh = (campo, texto, clase = '') => `<th class="${clase} cq-orden ${f.orden === campo ? 'activo' : ''}" data-ordenar="${campo}" title="Ordenar por ${texto.toLowerCase()}">${texto} <i class="ti ${f.orden === campo ? (f.dir === 'asc' ? 'ti-sort-ascending' : 'ti-sort-descending') : 'ti-arrows-sort'}" aria-hidden="true"></i></th>`;
    const marca = (x) => anulada(x) ? '<span class="pc-marca anulada">Anulada</span>' : '<span class="pc-marca aprobada">Vigente</span>';

    async function elegir(x) {
      sel = x; completo = null;
      if (x) {
        ctx.pDet.innerHTML = ctx.vacio('Cargando la factura…', 'ti-loader-2');
        const r = await sb.from('carga_sat_ventas_lineas').select('*').eq('id', x.id).single();
        if (sel !== x) return;
        completo = r.data || x;
        const [c, cu] = await Promise.all([
          completo.carga_id ? sb.from('cargas_sat').select('numero, archivo, fecha, archivo_anterior').eq('id', completo.carga_id).maybeSingle() : { data: null },
          completo.cuenta_id ? sb.from('cuentas').select('codigo, nombre').eq('id', completo.cuenta_id).maybeSingle() : { data: null }
        ]);
        if (sel !== x) return;
        completo = { ...completo, carga: c.data || null, cuenta: cu.data || null };
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-fel]').forEach((tr) => tr.classList.toggle('actual', !!x && tr.dataset.fel === String(x.id)));
    }
    function pintar() { pintarMaestro(); pintarDetalle(); }

    function pintarMaestro() {
      const filas = visibles();
      const vivas = filas.filter((x) => !anulada(x));
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>Facturas <small>${filas.length.toLocaleString('es-GT')}</small></h2>
          <div class="ta-totales pc-resumen">
            <span class="ta-total"><b>Q ${fmt.monto(vivas.reduce((t, x) => t + n(x.gran_total), 0))}</b> total (${vivas.length.toLocaleString('es-GT')})</span>
            <span class="ta-total"><b>Q ${fmt.monto(vivas.reduce((t, x) => t + n(x.iva), 0))}</b> IVA</span>
            ${filas.length - vivas.length ? `<span class="ta-total sin"><b>${(filas.length - vivas.length).toLocaleString('es-GT')}</b> anuladas</span>` : ''}
            ${rango && (f.desde > rango.desde || f.hasta < rango.hasta) ? `<span class="ta-total sin">La empresa tiene <b>${rango.n.toLocaleString('es-GT')}</b> del ${esc(fmt.fechaDia(rango.desde))} al ${esc(fmt.fechaDia(rango.hasta))} <button type="button" class="boton secundario-sm" data-ver-todos>Ver todas</button></span>` : ''}
          </div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Cliente, NIT, serie, autorización…" value="${esc(f.buscar)}" aria-label="Buscar facturas FEL"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table class="cqc-tabla vfc-tabla vla-tabla"><colgroup><col class="w-fecha"><col class="w-vla-n"><col class="w-vla-doc"><col><col class="w-valor"><col class="w-valor"><col class="w-vla-est"></colgroup>
            <thead><tr>${ordenTh('fecha', 'Fecha')}<th>Tipo</th><th>Serie · número</th><th>Cliente · NIT</th><th class="num">IVA</th>${ordenTh('valor', 'Total', 'num')}<th>Estado</th></tr></thead>
            <tbody>${filas.slice(0, 3000).map((x) => `<tr data-fel="${x.id}" class="${sel && sel.id === x.id ? 'actual' : ''} ${anulada(x) ? 'pc-anulada' : ''}" tabindex="0">
              <td class="fuerte">${esc(fmt.fechaDia(diaLocal(x.fecha_emision)))}</td>
              <td>${esc(x.tipo_dte || '')}</td>
              <td class="cc-nombre" title="${esc(x.numero_autorizacion)}">${esc(docto(x))}</td>
              <td class="cqc-quien" title="${esc(x.nombre_receptor || '')}"><b>${esc(x.nombre_receptor || '')}</b><small>${esc(x.id_receptor || '')}</small></td>
              <td class="num">${fmt.monto(x.iva)}</td>
              <td class="num"><b>${fmt.monto(x.gran_total)}</b>${x.moneda && x.moneda !== 'GTQ' ? ` <small>${esc(x.moneda)}</small>` : ''}</td>
              <td class="cqc-estado">${marca(x)}</td></tr>`).join('')
              + (filas.length > 3000 ? `<tr><td colspan="7" class="tk-vacio">Se muestran las primeras 3,000 de ${filas.length.toLocaleString('es-GT')}. Usa el buscador o acorta las fechas; el PDF y el Excel traen todas.</td></tr>` : '')
              || `<tr><td colspan="7" class="tk-vacio"><i class="ti ti-file-certificate" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : !rango ? 'Esta empresa no tiene facturas FEL emitidas migradas de un sistema anterior.' : 'No hay facturas con estos parámetros.'}</td></tr>`}</tbody></table>
        </div>`;
    }

    function pintarDetalle() {
      const x = completo || sel;
      if (!sel) { ctx.pDet.innerHTML = ctx.vacio(ctx.sel.loc ? 'Elige una factura para ver su detalle.' : 'Elige la empresa.', 'ti-file-certificate'); return; }
      const otros = IMPUESTOS.filter(([k]) => n(x[k]));
      const dato = (t, v) => `<div><dt>${t}</dt><dd>${v || '—'}</dd></div>`;
      ctx.pDet.innerHTML = `
        <div class="tk-form cq-ficha">
          <header class="tk-titulo cb-titulo">
            <span class="tk-icono"><i class="ti ti-file-certificate" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>${esc(x.tipo_dte || 'DTE')} · autorización ${esc(x.numero_autorizacion)}</small><h2>${esc(x.nombre_receptor || '')} · ${esc(docto(x))}</h2></div>
            <dl class="cq-datos">
              ${dato('Emisión', `${esc(fmt.fechaDia(diaLocal(x.fecha_emision)))} ${esc(horaLocal(x.fecha_emision))}`)}
              ${dato('Total', `${esc(x.moneda || 'GTQ')} ${fmt.monto(x.gran_total)}`)}
              ${dato('IVA', fmt.monto(x.iva))}
              ${dato('Estado', marca(x))}
            </dl>
          </header>
          ${anulada(x) ? `<p class="cqc-concepto"><span class="pc-rojo">Anulada${x.fecha_anulacion ? ` el ${esc(fmt.fechaDia(diaLocal(x.fecha_anulacion)))}` : ''}</span></p>` : ''}
          <dl class="cq-datos vfa-datos">
            ${dato('Cliente', `${esc(x.nombre_receptor || '')}${x.id_receptor ? ` · ${esc(x.id_receptor)}` : ''}`)}
            ${dato('Emisor', x.nombre_emisor ? `${esc(x.nombre_emisor)} · ${esc(x.nit_emisor || '')}` : '')}
            ${dato('Establecimiento', x.codigo_establecimiento || x.nombre_establecimiento ? esc([x.codigo_establecimiento, x.nombre_establecimiento].filter(Boolean).join(' · ')) : '')}
            ${dato('Certificador', x.nombre_certificador ? `${esc(x.nombre_certificador)} · ${esc(x.nit_certificador || '')}` : '')}
            ${dato('Estado en la SAT', esc(x.estado || ''))}
            ${dato('Exportación', esc(x.exportacion || ''))}
            ${dato('Otros impuestos', otros.map(([k, t]) => `${t} ${fmt.monto(x[k])}`).join(' · '))}
            ${dato('Cuenta contable', x.cuenta ? `${esc(x.cuenta.codigo)} · ${esc(x.cuenta.nombre)}` : x.cuenta_codigo ? `${esc(x.cuenta_codigo)} <span class="pc-rojo">no existe en la nomenclatura</span>` : '')}
            ${dato('Archivo de origen', x.carga ? `Carga ${esc(x.carga.numero)}${x.carga.fecha ? ` del ${esc(fmt.fechaDia(x.carga.fecha))}` : ''}${x.carga.archivo ? ` · ${esc(x.carga.archivo)}` : ''}` : '')}
            ${dato('Observaciones', esc(x.observaciones || ''))}
            ${x.fecha_emision_anterior ? dato('Fecha en el sistema anterior', esc(x.fecha_emision_anterior)) : ''}
          </dl>
        </div>`;
    }

    // ---------- Reportes ----------
    function parametros() {
      const emp = ctx.localidad(ctx.sel.loc);
      return [`Empresa: ${emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '—'}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`,
        `Tipo: ${f.tipo || 'Todos'}`, `Estado: ${f.estado}`, ...(f.buscar.trim() ? [`Búsqueda: ${f.buscar.trim()}`] : [])];
    }
    function reporte(formato) {
      const filas = visibles();
      if (!filas.length) return window.FIN.aviso('No hay facturas con estos parámetros');
      const vivas = filas.filter((x) => !anulada(x));
      const total = vivas.reduce((t, x) => t + n(x.gran_total), 0), iva = vivas.reduce((t, x) => t + n(x.iva), 0);
      const pie = `Total de ${vivas.length.toLocaleString('es-GT')} facturas vigentes (de ${filas.length.toLocaleString('es-GT')})`;
      if (formato === 'PDF') {
        window.BANCOS.imprimir('Facturas FEL anteriores', `<h1>Facturas FEL anteriores</h1><h2>${esc(parametros().join(' · '))}</h2>
          <table><thead><tr><th>Fecha</th><th>Tipo</th><th>Serie · número</th><th>Autorización</th><th>Cliente</th><th>NIT</th><th class="n">IVA</th><th class="n">Total</th><th>Estado</th></tr></thead><tbody>
          ${filas.map((x) => `<tr><td>${esc(fmt.fechaDia(diaLocal(x.fecha_emision)))}</td><td>${esc(x.tipo_dte || '')}</td><td>${esc(docto(x))}</td><td>${esc(x.numero_autorizacion)}</td><td>${esc(x.nombre_receptor || '')}</td><td>${esc(x.id_receptor || '')}</td><td class="n">${fmt.monto(x.iva)}</td><td class="n">${fmt.monto(x.gran_total)}</td><td>${anulada(x) ? 'Anulada' : 'Vigente'}</td></tr>`).join('')}
          </tbody><tfoot><tr><td colspan="6">${pie}</td><td class="n">${fmt.monto(iva)}</td><td class="n">${fmt.monto(total)}</td><td></td></tr></tfoot></table>`, { locId: ctx.sel.loc, horizontal: true });
        return;
      }
      if (!window.REPORTE_XLSX) return;
      const datos = filas.map((x) => ({ tenue: anulada(x), valores: [fmt.fechaDia(diaLocal(x.fecha_emision)), x.tipo_dte || '', x.serie || '', x.numero || '', x.numero_autorizacion, x.nombre_receptor || '', x.id_receptor || '', x.moneda || '', n(x.iva), n(x.gran_total), anulada(x) ? 'Anulada' : 'Vigente'] }));
      datos.push({ tipo: 'total', valores: ['', '', '', '', '', pie, '', '', iva, total, ''] });
      const emp = ctx.localidad(ctx.sel.loc);
      window.REPORTE_XLSX.generar({ titulo: 'Facturas FEL anteriores', parametros: parametros(), orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Facturas FEL',
        archivo: `facturas_fel_anteriores_${emp?.codigo || ''}_${f.desde}_${f.hasta}`, autofiltro: true,
        columnas: [{ titulo: 'Fecha', ancho: 12 }, { titulo: 'Tipo', ancho: 8 }, { titulo: 'Serie', ancho: 12 }, { titulo: 'Número', ancho: 13 }, { titulo: 'Autorización', ancho: 38 }, { titulo: 'Cliente', ancho: 40 },
          { titulo: 'NIT', ancho: 14 }, { titulo: 'Moneda', ancho: 8 }, { titulo: 'IVA', ancho: 14, tipo: 'monto' }, { titulo: 'Total', ancho: 15, tipo: 'monto' }, { titulo: 'Estado', ancho: 10 }],
        filas: datos });
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { sel = null; return cargarLocalidad(); }
      if (cambio === 'otro') {
        const nm = e.target.name;
        if (nm === 'estado' || nm === 'tipo') { f[nm] = e.target.value; pintarMaestro(); return elegir(visibles().find((x) => x.id === sel?.id) || visibles()[0] || null); }
        if (nm === 'orden') { [f.orden, f.dir] = e.target.value.split(':'); return pintarMaestro(); }
        if (nm === 'desde' || nm === 'hasta') { f[nm] = e.target.value; sel = null; return consultar(); }
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
      if (e.key === 'Enter' && e.target.matches('tr[data-fel]')) e.target.click();
    });
    cont.addEventListener('click', (e) => {
      if (e.target.closest('[data-ver-todos]') && rango) { f.desde = rango.desde; f.hasta = rango.hasta; sel = null; pintarFiltros(); return consultar(); }
      const th = e.target.closest('[data-ordenar]');
      if (th) { const campo = th.dataset.ordenar; f.dir = f.orden === campo && f.dir === 'desc' ? 'asc' : 'desc'; f.orden = campo; const o = ctx.pFil.querySelector('[name=orden]'); if (o) o.value = `${f.orden}:${f.dir}`; return pintarMaestro(); }
      const tr = e.target.closest('tr[data-fel]');
      if (tr && ctx.pMae.contains(tr)) return elegir(facturas.find((x) => String(x.id) === tr.dataset.fel));
      const ac = e.target.closest('[data-accion]');
      if (ac?.dataset.accion === 'excel') return reporte('EXCEL');
      if (ac?.dataset.accion === 'pdf') return reporte('PDF');
    });

    iniciar();
  };
})();
