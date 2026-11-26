// Facturación/Ventas · Registros · Libro de ventas anterior: consulta del libro de ventas migrado de un sistema anterior
//   (Consisav CON_VENTAS, script 329). Cada fila es un resumen diario por serie y tipo de documento; al elegirlo se ven
//   sus documentos (uno por uno) y su partida contable. Mismo diseño que la Consulta de Facturas. Solo lectura.
//   Reportes en PDF y Excel, resumidos (los resúmenes) o detallados (cada resumen con sus documentos).
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const ORDENES = [['fecha:desc', 'Fecha ↓'], ['fecha:asc', 'Fecha ↑'], ['total:desc', 'Total ↓'], ['total:asc', 'Total ↑']];
  const TIPOS = { 0: 'Sin tipo', 1: 'Factura', 2: 'Nota de crédito', 3: 'Nota de débito' };
  const tipo = (n) => TIPOS[n] || `Tipo ${n}`;
  const n = (v) => Number(v || 0);
  const anulado = (x) => String(x.estado || '').toUpperCase().startsWith('A');

  // Trae todas las filas de una consulta de Supabase, de 1000 en 1000 (hasta «tope»).
  async function todos(hacer, tope = 50000) {
    const lista = [];
    for (let p = 0; p < tope; p += 1000) {
      const r = await hacer().range(p, p + 999);
      if (r.error) return { error: r.error, data: lista };
      lista.push(...(r.data || []));
      if ((r.data || []).length < 1000) break;
    }
    return { data: lista };
  }

  window.PANTALLAS['libro-ventas-anterior'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Libro de ventas anterior', icono: 'ti-book', clase: 'bk-movimientos bk-consultar cb-apilado bk-consulta-cheques cqc-con-tipo vfc-consulta vla-consulta cq-fila', grupo: 'Ventas · Registros' });
    const { sb } = ctx;
    ctx.pFil.closest('.bk-espacio').style.setProperty('--cq-n', 5);
    const f = { desde: fmt.hoy(), hasta: fmt.hoy(), serie: '', estado: 'TODOS', buscar: '', orden: 'fecha', dir: 'desc' };
    let resumenes = [], sel = null, consulta = 0, rango = null;
    let detalle = { docs: [], conta: [] };

    const nombre = (x) => `${x.serie || 'Sin serie'} · ${tipo(x.tipo_docto)}`;
    const delAl = (x) => x.documento_inicial || x.documento_final ? `${x.documento_inicial ?? ''} – ${x.documento_final ?? ''}` : '';
    const poliza = (x) => x.poliza_numero ? `${x.poliza_anio || ''}-${String(x.poliza_mes || '').padStart(2, '0')} #${x.poliza_numero}` : '';

    function pintarFiltros() {
      const series = [...new Set(resumenes.map((x) => x.serie || ''))].sort();
      if (f.serie && !series.includes(f.serie)) series.push(f.serie);
      ctx.filtros(`
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Serie</span><select name="serie"><option value="">Todas</option>${series.map((s) => `<option value="${esc(s)}" ${f.serie === s ? 'selected' : ''}>${esc(s || 'Sin serie')}</option>`).join('')}</select></label>
        <label class="campo"><span>Ordenar por</span><select name="orden">${ORDENES.map(([k, t]) => `<option value="${k}" ${`${f.orden}:${f.dir}` === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado">${['TODOS', 'VIGENTES', 'ANULADOS'].map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>`,
        `<div class="bmc-reportes"><button type="button" class="boton secundario-sm bca-pdf" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i><span><b>Imprimir en PDF</b><small>Resumido o detallado</small></span></button>
         <button type="button" class="boton cqc-excel" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i><span><b>Generar Excel</b><small>Resumido o detallado</small></span></button></div>`);
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('ventas_libro_anteriores').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/ventas_libro_anteriores/.test(prueba.error.message) ? 'Falta instalar el script 329 (libro de ventas anterior) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      await cargarLocalidad();
    }
    // Al abrir o cambiar de empresa: el periodo por omisión es el último mes con datos de esa empresa.
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      rango = null; f.serie = '';
      if (loc) {
        const [u, p] = await Promise.all([
          sb.from('ventas_libro_anteriores').select('fecha', { count: 'exact' }).eq('localidad_id', loc).order('fecha', { ascending: false }).limit(1),
          sb.from('ventas_libro_anteriores').select('fecha').eq('localidad_id', loc).order('fecha').limit(1)
        ]);
        if (u.data?.length) {
          rango = { n: u.count || 0, desde: p.data?.[0]?.fecha || u.data[0].fecha, hasta: u.data[0].fecha };
          f.hasta = rango.hasta; f.desde = `${rango.hasta.slice(0, 8)}01`;
        } else { f.desde = fmt.hoy(); f.hasta = fmt.hoy(); }
      }
      pintarFiltros();
      await consultar();
    }
    async function consultar(id = sel?.id) {
      const loc = ctx.sel.loc;
      if (!loc) { resumenes = []; pintar(); return; }
      const yo = ++consulta;
      ctx.pMae.innerHTML = ctx.vacio('Cargando el libro de ventas…', 'ti-loader-2');
      const r = await todos(() => sb.from('ventas_libro_anteriores').select('*').eq('localidad_id', loc).gte('fecha', f.desde).lte('fecha', f.hasta).order('fecha', { ascending: false }).order('serie').order('id'));
      if (yo !== consulta) return;
      if (r.error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(r.error.message)}</p>`; return; }
      resumenes = r.data;
      pintarFiltros();
      sel = resumenes.find((x) => x.id === id) || null;
      pintar();
      if (!sel && visibles()[0]) await elegir(visibles()[0]);
    }
    const visibles = () => {
      const q = f.buscar.trim().toLowerCase();
      return resumenes.filter((x) => (!f.serie || (x.serie || '') === f.serie)
        && (f.estado === 'TODOS' || (f.estado === 'ANULADOS') === anulado(x))
        && (!q || [x.serie, x.documento_inicial, x.documento_final, x.nit, x.nombre_proveedor_anterior, x.sucursal, poliza(x)].some((v) => String(v || '').toLowerCase().includes(q))))
        .sort((a, b) => {
          const va = f.orden === 'total' ? n(a.total) : a.fecha, vb = f.orden === 'total' ? n(b.total) : b.fecha;
          const d = va < vb ? -1 : va > vb ? 1 : a.id - b.id;
          return f.dir === 'asc' ? d : -d;
        });
    };
    const ordenTh = (campo, texto, clase = '') => `<th class="${clase} cq-orden ${f.orden === campo ? 'activo' : ''}" data-ordenar="${campo}" title="Ordenar por ${texto.toLowerCase()}">${texto} <i class="ti ${f.orden === campo ? (f.dir === 'asc' ? 'ti-sort-ascending' : 'ti-sort-descending') : 'ti-arrows-sort'}" aria-hidden="true"></i></th>`;

    async function elegir(x) {
      sel = x;
      detalle = { docs: [], conta: [] };
      if (x) {
        ctx.pDet.innerHTML = ctx.vacio('Cargando el detalle del resumen…', 'ti-loader-2');
        const [d, c] = await Promise.all([
          todos(() => sb.from('ventas_libro_documentos_anteriores').select('*').eq('venta_id', x.id).order('documento'), 20000),
          sb.from('ventas_libro_contable_anteriores').select('linea, cuenta_codigo, debe, haber, cuentas(codigo, nombre)').eq('venta_id', x.id).order('linea')
        ]);
        if (sel !== x) return;
        const docs = (d.data || []).sort((a, b) => (Number(a.documento) - Number(b.documento)) || String(a.documento).localeCompare(String(b.documento)));
        detalle = { docs, conta: c.data || [] };
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-resumen]').forEach((tr) => tr.classList.toggle('actual', !!x && tr.dataset.resumen === String(x.id)));
    }
    function pintar() { pintarMaestro(); pintarDetalle(); }

    function pintarMaestro() {
      const filas = visibles();
      const vivos = filas.filter((x) => !anulado(x));
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>Resúmenes <small>${filas.length}</small></h2>
          <div class="ta-totales pc-resumen">
            <span class="ta-total"><b>${vivos.reduce((t, x) => t + n(x.total_documentos), 0).toLocaleString('es-GT')}</b> documentos</span>
            <span class="ta-total"><b>Q ${fmt.monto(vivos.reduce((t, x) => t + n(x.neto), 0))}</b> neto</span>
            <span class="ta-total"><b>Q ${fmt.monto(vivos.reduce((t, x) => t + n(x.iva), 0))}</b> IVA</span>
            <span class="ta-total"><b>Q ${fmt.monto(vivos.reduce((t, x) => t + n(x.total), 0))}</b> total</span>
            ${filas.length - vivos.length ? `<span class="ta-total sin"><b>${filas.length - vivos.length}</b> anulados</span>` : ''}
          </div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Serie, documento, póliza…" value="${esc(f.buscar)}" aria-label="Buscar resúmenes"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table class="cqc-tabla vfc-tabla vla-tabla"><colgroup><col class="w-fecha"><col class="w-vla-serie"><col><col class="w-vla-n"><col class="w-valor"><col class="w-valor"><col class="w-valor"><col class="w-valor"><col class="w-vla-pol"></colgroup>
            <thead><tr>${ordenTh('fecha', 'Fecha')}<th>Serie · tipo</th><th>Del · al</th><th class="num">Docs.</th><th class="num">Servicios</th><th class="num">Bienes</th><th class="num">IVA</th>${ordenTh('total', 'Total', 'num')}<th>Póliza</th></tr></thead>
            <tbody>${filas.map((x) => `<tr data-resumen="${x.id}" class="${sel && sel.id === x.id ? 'actual' : ''} ${anulado(x) ? 'pc-anulada' : ''}" tabindex="0">
              <td class="fuerte">${esc(fmt.fechaDia(x.fecha))}${x.fecha_anterior ? `<small class="cq-ant" title="Fecha como venía en el sistema anterior">${esc(x.fecha_anterior)}</small>` : ''}</td>
              <td>${esc(nombre(x))}</td>
              <td class="cc-nombre">${esc(delAl(x))}</td>
              <td class="num">${n(x.total_documentos).toLocaleString('es-GT')}</td>
              <td class="num">${fmt.monto(x.servicios)}</td>
              <td class="num">${fmt.monto(x.productos)}</td>
              <td class="num">${fmt.monto(x.iva)}</td>
              <td class="num"><b>${fmt.monto(x.total)}</b></td>
              <td>${esc(poliza(x))}${anulado(x) ? ' <span class="pc-marca anulada">Anulado</span>' : ''}</td></tr>`).join('')
              || `<tr><td colspan="9" class="tk-vacio"><i class="ti ti-book" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : !rango ? 'Esta empresa no tiene libro de ventas de un sistema anterior.' : !resumenes.length ? `No hay resúmenes entre el ${esc(fmt.fechaDia(f.desde))} y el ${esc(fmt.fechaDia(f.hasta))}. La empresa tiene <b>${rango.n.toLocaleString('es-GT')}</b> resúmenes del ${esc(fmt.fechaDia(rango.desde))} al ${esc(fmt.fechaDia(rango.hasta))}. <button type="button" class="boton primario-sm" data-ver-todos>Ver todos</button>` : 'No hay resúmenes con estos parámetros.'}</td></tr>`}</tbody></table>
        </div>`;
    }

    function pintarDetalle() {
      const x = sel;
      if (!x) { ctx.pDet.innerHTML = ctx.vacio(ctx.sel.loc ? 'Elige un resumen para ver sus documentos y su partida contable.' : 'Elige la empresa.', 'ti-book'); return; }
      const { docs, conta } = detalle;
      const debe = conta.reduce((t, l) => t + n(l.debe), 0), haber = conta.reduce((t, l) => t + n(l.haber), 0);
      const fuera = docs.filter((d) => d.fuera_de_rango).length;
      const sd = (k) => docs.reduce((t, d) => t + n(d[k]), 0);
      ctx.pDet.innerHTML = `
        <div class="tk-form cq-ficha">
          <header class="tk-titulo cb-titulo">
            <span class="tk-icono"><i class="ti ti-book" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>Libro de ventas anterior · ${esc(tipo(x.tipo_docto).toLowerCase())}${x.sucursal ? ` · sucursal ${esc(x.sucursal)}` : ''}</small><h2>${esc(fmt.fechaDia(x.fecha))} · serie ${esc(x.serie || 'sin serie')}</h2></div>
            <dl class="cq-datos">
              <div><dt>Documentos</dt><dd>${esc(delAl(x) || '—')} (${n(x.total_documentos).toLocaleString('es-GT')})</dd></div>
              <div><dt>Neto</dt><dd>Q ${fmt.monto(x.neto)}</dd></div>
              <div><dt>IVA</dt><dd>Q ${fmt.monto(x.iva)}</dd></div>
              <div><dt>Total</dt><dd>Q ${fmt.monto(x.total)}</dd></div>
              <div><dt>Póliza</dt><dd>${esc(poliza(x) || '—')}</dd></div>
            </dl>
          </header>
          ${n(x.exentos) || n(x.exportaciones) || n(x.valor_retencion) ? `<p class="cqc-concepto">Exento Q ${fmt.monto(x.exentos)} · exportaciones Q ${fmt.monto(x.exportaciones)}${n(x.valor_retencion) ? ` · retención Q ${fmt.monto(x.valor_retencion)}` : ''}</p>` : ''}
          <div class="cq-det vfc-det">
            <section class="cb-bloque cq-conta">
              <h3 class="ta-col-titulo"><i class="ti ti-files" aria-hidden="true"></i> Documentos <small>${docs.length.toLocaleString('es-GT')}</small>${fuera ? ` <span class="pc-marca pendiente">${fuera} fuera de rango</span>` : ''}</h3>
              <div class="pc-lineas"><table><thead><tr><th>Documento</th><th>Serie electrónica</th><th class="num">Servicios</th><th class="num">Bienes</th><th class="num">Exento</th><th class="num">Export.</th></tr></thead>
                <tbody>${docs.map((d) => `<tr><td class="fuerte">${esc(d.documento)}${d.fuera_de_rango ? ' <span class="pc-marca pendiente" title="El documento no está entre el inicial y el final del resumen">fuera de rango</span>' : ''}</td><td>${esc(d.serie_electronica || '')}</td><td class="num">${fmt.monto(d.servicios)}</td><td class="num">${fmt.monto(d.productos)}</td><td class="num">${fmt.monto(d.exentos)}</td><td class="num">${n(d.exportaciones) ? fmt.monto(d.exportaciones) : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="tk-vacio">El sistema anterior no traía el detalle de documentos de este resumen.</td></tr>'}</tbody>
                ${docs.length ? `<tfoot><tr><td colspan="2">Total</td><td class="num">${fmt.monto(sd('servicios'))}</td><td class="num">${fmt.monto(sd('productos'))}</td><td class="num">${fmt.monto(sd('exentos'))}</td><td class="num">${fmt.monto(sd('exportaciones'))}</td></tr></tfoot>` : ''}</table></div>
            </section>
            <section class="cb-bloque cq-lineas">
              <h3 class="ta-col-titulo"><i class="ti ti-notebook" aria-hidden="true"></i> Partida contable <small>${conta.length}</small>${conta.length ? (Math.abs(debe - haber) < 0.005 ? ' <span class="pc-marca aprobada">Cuadra</span>' : ' <span class="pc-marca anulada">No cuadra</span>') : ''}</h3>
              <div class="pc-lineas"><table><thead><tr><th>Cuenta</th><th>Nombre</th><th class="num">Debe</th><th class="num">Haber</th></tr></thead>
                <tbody>${conta.map((l) => `<tr><td class="fuerte">${esc(l.cuentas?.codigo || l.cuenta_codigo || '')}</td><td class="cc-nombre">${l.cuentas ? esc(l.cuentas.nombre) : '<span class="pc-rojo">No existe en la nomenclatura</span>'}</td><td class="num">${n(l.debe) ? fmt.monto(l.debe) : ''}</td><td class="num">${n(l.haber) ? fmt.monto(l.haber) : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="tk-vacio">Sin partida contable.</td></tr>'}</tbody>
                ${conta.length ? `<tfoot><tr><td colspan="2">Totales</td><td class="num">${fmt.monto(debe)}</td><td class="num">${fmt.monto(haber)}</td></tr></tfoot>` : ''}</table></div>
            </section>
          </div>
        </div>`;
    }

    // ---------- Reportes ----------
    function parametros() {
      const emp = ctx.localidad(ctx.sel.loc);
      return [`Empresa: ${emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '—'}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`,
        `Serie: ${f.serie || 'Todas'}`, `Estado: ${f.estado}`, ...(f.buscar.trim() ? [`Búsqueda: ${f.buscar.trim()}`] : [])];
    }
    function dialogo(formato) {
      const filas = visibles();
      if (!filas.length) return window.FIN.aviso('No hay resúmenes con estos parámetros');
      let formRef = null;
      window.UI.formulario({
        titulo: `Libro de ventas anterior · ${formato === 'PDF' ? 'Imprimir en PDF' : 'Generar Excel'}`, campos: [],
        alPreparar: (form) => {
          formRef = form;
          form.querySelector('.modal-cuerpo').innerHTML = `
            <fieldset class="cqc-tipos"><legend>Tipo de reporte</legend>
              <label class="cqc-tipo"><input type="radio" name="tipo" value="RESUMIDO" checked><i class="ti ti-list" aria-hidden="true"></i><span><b>Resumido</b><small>El listado de los ${filas.length.toLocaleString('es-GT')} resúmenes.</small></span></label>
              <label class="cqc-tipo"><input type="radio" name="tipo" value="DETALLADO"><i class="ti ti-list-details" aria-hidden="true"></i><span><b>Detallado</b><small>Cada resumen con sus documentos.</small></span></label>
            </fieldset>
            <p class="bu-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> Con los filtros de la pantalla: ${esc(parametros().join(' · '))}.</p>`;
          form.querySelector('[type=submit]').innerHTML = formato === 'PDF' ? '<i class="ti ti-file-type-pdf" aria-hidden="true"></i> Imprimir en PDF' : '<i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Generar Excel';
        },
        alGuardar: async () => { await reporte(formato, formRef?.elements.tipo?.value || 'RESUMIDO', filas); }
      });
    }
    async function reporte(formato, modo, filas) {
      const docsDe = new Map();
      if (modo === 'DETALLADO') {
        const ids = filas.map((x) => x.id);
        for (let i = 0; i < ids.length; i += 100) {
          const { data } = await todos(() => sb.from('ventas_libro_documentos_anteriores').select('venta_id, documento, serie_electronica, servicios, productos, exentos, exportaciones, fuera_de_rango').in('venta_id', ids.slice(i, i + 100)).order('venta_id').order('documento'), 200000);
          (data || []).forEach((d) => { if (!docsDe.has(d.venta_id)) docsDe.set(d.venta_id, []); docsDe.get(d.venta_id).push(d); });
        }
      }
      const vivos = filas.filter((x) => !anulado(x));
      const s = (k) => vivos.reduce((t, x) => t + n(x[k]), 0);
      const pie = `Total de ${vivos.length} resúmenes vigentes (de ${filas.length})`;
      if (formato === 'PDF') {
        window.BANCOS.imprimir('Libro de ventas anterior', `<h1>Libro de ventas anterior · ${modo === 'DETALLADO' ? 'detallado' : 'resumido'}</h1><h2>${esc(parametros().join(' · '))}</h2>
          <table><thead><tr><th>Fecha</th><th>Serie · tipo</th><th>Del · al</th><th class="n">Docs.</th><th class="n">Servicios</th><th class="n">Bienes</th><th class="n">Exento</th><th class="n">IVA</th><th class="n">Total</th><th>Póliza</th></tr></thead><tbody>
          ${filas.map((x) => `<tr class="${modo === 'DETALLADO' ? 's' : ''}"><td>${esc(fmt.fechaDia(x.fecha))}</td><td>${esc(nombre(x))}</td><td>${esc(delAl(x))}</td><td class="n">${n(x.total_documentos)}</td><td class="n">${fmt.monto(x.servicios)}</td><td class="n">${fmt.monto(x.productos)}</td><td class="n">${fmt.monto(x.exentos)}</td><td class="n">${fmt.monto(x.iva)}</td><td class="n">${fmt.monto(x.total)}</td><td>${esc(poliza(x))}${anulado(x) ? ' · anulado' : ''}</td></tr>
            ${modo === 'DETALLADO' ? (docsDe.get(x.id) || []).map((d) => `<tr><td></td><td>${esc(d.serie_electronica || '')}</td><td>${esc(d.documento)}${d.fuera_de_rango ? ' · fuera de rango' : ''}</td><td></td><td class="n">${fmt.monto(d.servicios)}</td><td class="n">${fmt.monto(d.productos)}</td><td class="n">${fmt.monto(d.exentos)}</td><td colspan="3"></td></tr>`).join('') : ''}`).join('')}
          </tbody><tfoot><tr><td colspan="3">${pie}</td><td class="n">${s('total_documentos')}</td><td class="n">${fmt.monto(s('servicios'))}</td><td class="n">${fmt.monto(s('productos'))}</td><td class="n">${fmt.monto(s('exentos'))}</td><td class="n">${fmt.monto(s('iva'))}</td><td class="n">${fmt.monto(s('total'))}</td><td></td></tr></tfoot></table>`, { locId: ctx.sel.loc, horizontal: true });
        return;
      }
      if (!window.REPORTE_XLSX) return;
      const datos = [];
      filas.forEach((x) => {
        datos.push({ resaltar: modo === 'DETALLADO' ? 1 : 0, tenue: anulado(x), valores: [fmt.fechaDia(x.fecha), nombre(x), delAl(x), n(x.total_documentos), n(x.servicios), n(x.productos), n(x.exentos), n(x.iva), n(x.total), poliza(x)] });
        if (modo === 'DETALLADO') (docsDe.get(x.id) || []).forEach((d) => datos.push({ tipo: 'nota', valores: ['', d.serie_electronica || '', d.documento, null, n(d.servicios), n(d.productos), n(d.exentos), null, null, d.fuera_de_rango ? 'Fuera de rango' : ''] }));
      });
      datos.push({ tipo: 'total', valores: ['', '', pie, s('total_documentos'), s('servicios'), s('productos'), s('exentos'), s('iva'), s('total'), ''] });
      const emp = ctx.localidad(ctx.sel.loc);
      window.REPORTE_XLSX.generar({ titulo: `Libro de ventas anterior · ${modo === 'DETALLADO' ? 'Detallado' : 'Resumido'}`, parametros: parametros(), orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Libro de ventas',
        archivo: `libro_ventas_anterior_${modo.toLowerCase()}_${emp?.codigo || ''}_${f.desde}_${f.hasta}`, autofiltro: modo !== 'DETALLADO',
        columnas: [{ titulo: 'Fecha', ancho: 12 }, { titulo: modo === 'DETALLADO' ? 'Serie · tipo / serie electrónica' : 'Serie · tipo', ancho: 22 }, { titulo: modo === 'DETALLADO' ? 'Del · al / documento' : 'Del · al', ancho: 22 },
          { titulo: 'Docs.', ancho: 8, tipo: 'monto' }, { titulo: 'Servicios', ancho: 15, tipo: 'monto' }, { titulo: 'Bienes', ancho: 15, tipo: 'monto' }, { titulo: 'Exento', ancho: 13, tipo: 'monto' }, { titulo: 'IVA', ancho: 14, tipo: 'monto' }, { titulo: 'Total', ancho: 15, tipo: 'monto' }, { titulo: 'Póliza', ancho: 14 }],
        filas: datos });
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { sel = null; return cargarLocalidad(); }
      if (cambio === 'otro') {
        const nm = e.target.name;
        if (nm === 'estado' || nm === 'serie') { f[nm] = e.target.value; pintarMaestro(); return elegir(visibles().find((x) => x.id === sel?.id) || visibles()[0] || null); }
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
      if (e.key === 'Enter' && e.target.matches('tr[data-resumen]')) e.target.click();
    });
    cont.addEventListener('click', (e) => {
      if (e.target.closest('[data-ver-todos]') && rango) { f.desde = rango.desde; f.hasta = rango.hasta; sel = null; pintarFiltros(); return consultar(); }
      const th = e.target.closest('[data-ordenar]');
      if (th) { const campo = th.dataset.ordenar; f.dir = f.orden === campo && f.dir === 'desc' ? 'asc' : 'desc'; f.orden = campo; const o = ctx.pFil.querySelector('[name=orden]'); if (o) o.value = `${f.orden}:${f.dir}`; return pintarMaestro(); }
      const tr = e.target.closest('tr[data-resumen]');
      if (tr && ctx.pMae.contains(tr)) return elegir(resumenes.find((x) => String(x.id) === tr.dataset.resumen));
      const ac = e.target.closest('[data-accion]');
      if (ac?.dataset.accion === 'excel') return dialogo('EXCEL');
      if (ac?.dataset.accion === 'pdf') return dialogo('PDF');
    });

    iniciar();
  };
})();
