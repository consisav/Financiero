// Facturación/Ventas · Registros · Consulta de Recibos: el mismo diseño de la Consulta de Facturas.
//   Arriba los parámetros (empresa, cliente, vendedor, forma de pago, fechas —la inicial, por omisión, el primer
//   día del mes en curso—, orden y estado) y la lista con sus totales; abajo el recibo elegido con las facturas que
//   pagó. «Consultar» abre el recibo en Recibos. Reportes en PDF y Excel, resumidos o detallados.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const ORDENES = [['fecha:desc', 'Fecha ↓'], ['fecha:asc', 'Fecha ↑'], ['numero:desc', 'Número ↓'], ['numero:asc', 'Número ↑'], ['valor:desc', 'Valor ↓'], ['valor:asc', 'Valor ↑']];
  const ESTADOS = ['TODOS', 'VIGENTES', 'EMITIDOS', 'ASIGNADOS', 'LIQUIDADOS', 'ANULADOS', 'CON SALDO DISPONIBLE'];
  const PERIODOS = [['RANGO', 'Rango de fechas'], ['HISTORIA', 'Toda la historia']];
  const FORMAS = ['EFECTIVO', 'CHEQUE', 'DEPÓSITO', 'TRANSFERENCIA', 'TARJETA', 'NOTA DE CRÉDITO'];

  window.PANTALLAS['consulta-de-recibos'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Consulta de Recibos', icono: 'ti-file-search', clase: 'bk-movimientos bk-consultar cb-apilado bk-consulta-cheques cqc-con-tipo vfc-consulta vrc-consulta cq-fila', grupo: 'Ventas · Registros' });
    const { sb } = ctx;
    ctx.pFil.closest('.bk-espacio').style.setProperty('--cq-n', 7);
    // Fecha inicial por omisión: el primer día del mes en curso (cada vez que se abre la pantalla).
    // Fecha inicial por omisión: el primer día del mes en curso; en la organización 2, el de dos meses atrás.
    const primeroDelMes = () => {
      const org = ctx.organizaciones.find((o) => o.id === (ctx.localidad(ctx.sel.loc)?.organizacion_id ?? ctx.sel.org));
      const [y, m] = fmt.hoy().split('-').map(Number); const k = y * 12 + (m - 1) - (String(org?.codigo) === '2' ? 2 : 0);
      return `${Math.floor(k / 12)}-${String(k % 12 + 1).padStart(2, '0')}-01`;
    };
    const f = { cliente: '', vendedor: '', forma: '', periodo: 'RANGO', desde: primeroDelMes(), hasta: fmt.hoy(), estado: 'TODOS', buscar: '', orden: 'fecha', dir: 'desc' };
    let recibos = [], aplicado = new Map(), vendedores = [], clientes = [], sel = null, consulta = 0, rango = null, pagos = [];

    const nombre = (x) => [x.serie, x.recibo_fisico].filter((v) => v != null && v !== '').join('-') || `Interno ${x.numero}`;
    const vendedor = (id) => vendedores.find((v) => v.id === id);
    const etiquetaCli = (c) => (c.codigo ? `${c.codigo} · ${c.nombre}` : c.nombre);
    const normNom = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
    const clienteElegido = () => clientes.find((c) => etiquetaCli(c) === f.cliente.trim());
    const asignado = (x) => x.estado !== 'ANULADO' && x.situacion !== 'LIQUIDADO' && (aplicado.get(x.id) || 0) > 0.005;
    const estadoDe = (x) => x.estado === 'ANULADO' ? ['anulada', 'Anulado'] : x.situacion === 'LIQUIDADO' ? ['aprobada', 'Liquidado'] : asignado(x) ? ['pendiente', 'Asignado'] : ['definitiva', 'Emitido'];
    const historia = () => f.periodo === 'HISTORIA';
    const disponible = (x) => x.estado === 'ANULADO' ? 0 : fmt.redondear(Number(x.valor || 0) - (aplicado.get(x.id) || 0) - Number(x.gasto_valor || 0));
    const nombreFac = (v) => v ? (v.serie ? `${v.serie}-${v.numero_dte || ''}` : `Interna ${v.numero}`) : '';

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Forma de pago</span><select name="forma"><option value="">Todas</option>${FORMAS.map((x) => `<option ${f.forma === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="campo"><span>Fechas</span><select name="periodo">${PERIODOS.map(([k, t]) => `<option value="${k}" ${f.periodo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}" ${historia() ? 'disabled' : ''}></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}" ${historia() ? 'disabled' : ''}></label>
        <label class="campo"><span>Ordenar por</span><select name="orden">${ORDENES.map(([k, t]) => `<option value="${k}" ${`${f.orden}:${f.dir}` === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado">${ESTADOS.map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>`,
        `<div class="bmc-reportes"><button type="button" class="boton secundario-sm bca-pdf" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i><span><b>Imprimir en PDF</b><small>Resumido o detallado</small></span></button>
         <button type="button" class="boton cqc-excel" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i><span><b>Generar Excel</b><small>Resumido o detallado</small></span></button></div>`);
      if (ctx.pFil.querySelector('[name=cliente]')) window.UI.autocompletar(ctx.pFil.querySelector('[name=cliente]'), () => clientes.map((c) => ({ valor: etiquetaCli(c), texto: etiquetaCli(c), detalle: c.documento ? `NIT ${c.documento}` : '' })));
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('recibos_venta').select('id, numero').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/numero|recibos_venta/.test(prueba.error.message) ? 'Falta instalar los scripts 132 (recibos de cobro) y 133 (pantallas de recibos) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc || 0;
      // Lista de clientes: el catálogo y, además, los que aparecen en facturas y recibos de la empresa aunque
      // no estén en el catálogo (ventas migradas), para que ninguno falte en la lista.
      const [v, cl, fv, rv] = await Promise.all([sb.from('vendedores').select('id, codigo, nombre').eq('localidad_id', loc).order('codigo'),
        window.UI.todo(sb.from('clientes').select('id, codigo, nombre, documento').eq('localidad_id', loc).order('nombre').order('id')),
        window.UI.todo(sb.from('facturas_venta').select('id, cliente_id, cliente_codigo, nombre, nit').eq('localidad_id', loc).order('id')),
        window.UI.todo(sb.from('recibos_venta').select('id, cliente_id, nombre').eq('localidad_id', loc).order('id'))]);
      vendedores = v.data || [];
      clientes = (cl.data || []).slice();
      const yaId = new Set(clientes.map((c) => c.id)), yaCod = new Set(clientes.map((c) => c.codigo)), yaNom = new Set(clientes.map((c) => normNom(c.nombre)));
      [...(fv.data || []), ...(rv.data || [])].forEach((x) => {
        const n = normNom(x.nombre);
        if (!n || (x.cliente_id && yaId.has(x.cliente_id)) || (x.cliente_codigo && yaCod.has(x.cliente_codigo)) || yaNom.has(n)) return;
        clientes.push({ id: x.cliente_id || null, codigo: x.cliente_codigo || null, nombre: String(x.nombre).trim(), documento: x.nit || '' });
        if (x.cliente_id) yaId.add(x.cliente_id); if (x.cliente_codigo) yaCod.add(x.cliente_codigo); yaNom.add(n);
      });
      clientes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      f.cliente = '';
      f.desde = primeroDelMes(); f.hasta = fmt.hoy(); f.periodo = 'RANGO';
      f.vendedor = '';
      pintarFiltros();
      await consultar();
    }
    async function consultar(id = sel?.id) {
      const loc = ctx.sel.loc;
      if (!loc) { recibos = []; pintar(); return; }
      const yo = ++consulta;
      const lista = [];
      for (let p = 0; p < 200000; p += 1000) {
        let q = sb.from('recibos_venta').select('*').eq('localidad_id', loc);
        if (!historia()) q = q.gte('fecha', f.desde).lte('fecha', f.hasta);
        q = q.order('fecha', { ascending: false }).order('numero', { ascending: false }).order('id', { ascending: false }).range(p, p + 999);
        if (f.vendedor) q = q.eq('vendedor_id', Number(f.vendedor));
        if (f.forma) q = q.eq('forma', f.forma);
        const r = await q;
        if (yo !== consulta) return;
        if (r.error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(r.error.message)}</p>`; return; }
        lista.push(...(r.data || []));
        if ((r.data || []).length < 1000) break;
      }
      // Lo aplicado a facturas de cada recibo (para el saldo disponible).
      const ap = new Map(); const ids = lista.map((x) => x.id);
      for (let i = 0; i < ids.length; i += 300) {
        const { data } = await sb.from('factura_venta_pagos').select('recibo_id, valor').in('recibo_id', ids.slice(i, i + 300));
        (data || []).forEach((p) => ap.set(p.recibo_id, fmt.redondear((ap.get(p.recibo_id) || 0) + Number(p.valor || 0))));
        if (yo !== consulta) return;
      }
      recibos = lista; aplicado = ap;
      rango = null;
      if (!lista.length && !historia()) {
        const a = await sb.from('recibos_venta').select('fecha', { count: 'exact' }).eq('localidad_id', loc).not('fecha', 'is', null).order('fecha').limit(1);
        if (a.count) rango = { n: a.count, desde: String(a.data[0].fecha).slice(0, 10) };
      }
      sel = recibos.find((x) => x.id === id) || null;
      pintar();
      if (!sel && visibles()[0]) await elegir(visibles()[0]);
    }
    const visibles = () => {
      const q = f.buscar.trim().toLowerCase();
      const c = f.cliente.trim().toLowerCase();
      const ce = clienteElegido();
      return recibos.filter((x) => (f.estado === 'TODOS' || (f.estado === 'VIGENTES' && x.estado !== 'ANULADO') || (f.estado === 'ANULADOS' && x.estado === 'ANULADO')
        || (f.estado === 'EMITIDOS' && x.estado !== 'ANULADO' && x.situacion !== 'LIQUIDADO' && !asignado(x)) || (f.estado === 'ASIGNADOS' && asignado(x)) || (f.estado === 'LIQUIDADOS' && x.estado !== 'ANULADO' && x.situacion === 'LIQUIDADO')
        || (f.estado === 'CON SALDO DISPONIBLE' && disponible(x) > 0.005))
        && (!c || (ce ? ((ce.id && x.cliente_id === ce.id) || normNom(x.nombre) === normNom(ce.nombre)) : [x.nombre, x.cliente_codigo_anterior].some((v) => String(v ?? '').toLowerCase().includes(c))))
        && (!q || [x.numero, x.serie, x.recibo_fisico, x.nombre, x.documento, x.banco, x.descripcion, x.observaciones].some((v) => String(v ?? '').toLowerCase().includes(q))))
        .sort((a, b) => {
          const va = f.orden === 'numero' ? a.numero : f.orden === 'valor' ? Number(a.valor) : a.fecha;
          const vb = f.orden === 'numero' ? b.numero : f.orden === 'valor' ? Number(b.valor) : b.fecha;
          const d = va < vb ? -1 : va > vb ? 1 : b.numero - a.numero;
          return f.dir === 'asc' ? d : -d;
        });
    };
    const ordenTh = (campo, texto, clase = '') => `<th class="${clase} cq-orden ${f.orden === campo ? 'activo' : ''}" data-ordenar="${campo}" title="Ordenar por ${texto.toLowerCase()}">${texto} <i class="ti ${f.orden === campo ? (f.dir === 'asc' ? 'ti-sort-ascending' : 'ti-sort-descending') : 'ti-arrows-sort'}" aria-hidden="true"></i></th>`;

    async function elegir(x) {
      sel = x; pagos = [];
      if (x) {
        ctx.pDet.innerHTML = ctx.vacio('Cargando el detalle del recibo…', 'ti-loader-2');
        const { data } = await sb.from('factura_venta_pagos').select('*, facturas_venta(id, numero, serie, numero_dte, nombre, fecha_emision, total, saldo)').eq('recibo_id', x.id).order('id');
        if (sel !== x) return;
        pagos = data || [];
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-recibo]').forEach((tr) => tr.classList.toggle('actual', !!x && tr.dataset.recibo === String(x.id)));
    }
    function pintar() { pintarMaestro(); pintarDetalle(); }

    function pintarMaestro() {
      const filas = visibles();
      const vivos = filas.filter((x) => x.estado !== 'ANULADO');
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>Recibos <small>${filas.length}</small></h2>
          <div class="ta-totales pc-resumen">
            <span class="ta-total"><b>Q ${fmt.monto(vivos.reduce((t, x) => t + Number(x.valor || 0), 0))}</b> cobrados (${vivos.length})</span>
            <span class="ta-total"><b>Q ${fmt.monto(vivos.reduce((t, x) => t + (aplicado.get(x.id) || 0), 0))}</b> aplicados a facturas</span>
            <span class="ta-total sin"><b>Q ${fmt.monto(vivos.reduce((t, x) => t + Math.max(0, disponible(x)), 0))}</b> disponible</span>
            <span class="ta-total"><b>${filas.length - vivos.length}</b> anulados</span>
            <span class="ta-total"><b>${vivos.filter(asignado).length}</b> asignados</span>
            <span class="ta-total sin"><b>${vivos.filter((x) => x.situacion !== 'LIQUIDADO').length}</b> sin liquidar</span>
          </div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Número, serie, cliente, documento…" value="${esc(f.buscar)}" aria-label="Buscar recibos"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table class="cqc-tabla vfc-tabla vrc-tabla"><colgroup><col class="w-vf-num"><col class="w-fecha"><col><col class="w-vf-vend"><col class="w-vf-pago"><col class="w-valor"><col class="w-valor"><col class="w-estado"><col class="w-acc"></colgroup>
            <thead><tr>${ordenTh('numero', 'Recibo', 'num')}${ordenTh('fecha', 'Fecha')}<th>Cliente</th><th>Vendedor</th><th>Forma · tipo</th>${ordenTh('valor', 'Valor', 'num')}<th class="num">Disponible</th><th>Estado</th><th aria-label="Consultar"></th></tr></thead>
            <tbody>${filas.map((x) => { const [cls, txt] = estadoDe(x); const v = vendedor(x.vendedor_id); const d = disponible(x); return `<tr data-recibo="${x.id}" class="${sel && sel.id === x.id ? 'actual' : ''} ${x.estado === 'ANULADO' ? 'pc-anulada' : ''}" tabindex="0">
              <td class="num fuerte">${esc(nombre(x))}<small class="cq-ant">interno ${x.numero ?? ''}</small></td>
              <td>${esc(fmt.fechaDia(x.fecha))}</td>
              <td class="cqc-quien" title="${esc(x.nombre || '')}"><b>${esc(x.nombre || '')}</b><small>${esc(x.descripcion || '')}</small></td>
              <td class="cc-nombre">${esc(v ? v.nombre : '')}</td>
              <td>${esc(x.forma || '')}<small class="cq-ant">${esc(x.tipo_pago || '')}</small></td>
              <td class="num"><b>${fmt.monto(x.valor)}</b></td>
              <td class="num ${d > 0.005 ? 'pc-rojo' : ''}">${fmt.monto(d)}</td>
              <td class="cqc-estado"><span class="pc-marca ${cls}">${txt}</span></td>
              <td class="cq-acc"><button type="button" class="boton secundario-sm cqc-ver" data-consultar="${x.id}" title="Consultar: abrir el recibo en Recibos"><i class="ti ti-file-search" aria-hidden="true"></i> Consultar</button></td></tr>`; }).join('')
              || `<tr><td colspan="9" class="tk-vacio"><i class="ti ti-file-search" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : !recibos.length && rango ? `No hay recibos entre el ${esc(fmt.fechaDia(f.desde))} y el ${esc(fmt.fechaDia(f.hasta))}. La empresa tiene <b>${rango.n.toLocaleString('es-GT')}</b> recibos. <button type="button" class="boton primario-sm" data-ver-todos>Ver todos</button>` : 'No hay recibos con estos parámetros.'}</td></tr>`}</tbody></table>
        </div>`;
    }

    function pintarDetalle() {
      const x = sel;
      if (!x) { ctx.pDet.innerHTML = ctx.vacio(ctx.sel.loc ? 'Elige un recibo para ver su detalle.' : 'Elige la empresa.', 'ti-file-search'); return; }
      const [cls, txt] = estadoDe(x);
      const ap = pagos.reduce((t, p) => t + Number(p.valor || 0), 0);
      ctx.pDet.innerHTML = `
        <div class="tk-form cq-ficha">
          <header class="tk-titulo cb-titulo">
            <span class="tk-icono"><i class="ti ti-receipt-2" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>Recibo ${esc(nombre(x))} · interno ${x.numero ?? ''} · ${esc((x.forma || '').toLowerCase())} · ${esc((x.tipo_pago || '').toLowerCase())}${x.banco ? ` · ${esc(x.banco)}` : ''}${x.documento ? ` ${esc(x.documento)}` : ''}</small><h2>${esc(x.nombre || '')}</h2></div>
            <dl class="cq-datos">
              <div><dt>Fecha</dt><dd>${esc(fmt.fechaDia(x.fecha))}</dd></div>
              <div><dt>Valor</dt><dd>Q ${fmt.monto(x.valor)}</dd></div>
              <div><dt>Disponible</dt><dd>Q ${fmt.monto(disponible(x))}</dd></div>
              <div><dt>Estado</dt><dd><span class="pc-marca ${cls}">${txt}</span></dd></div>
              <div><dt>Usuario</dt><dd>${esc(x.usuario || '—')}</dd></div>
            </dl>
            <div class="tk-titulo-acciones"><a class="boton primario-sm" href="#/facturacion/recibos/${x.id}"><i class="ti ti-eye" aria-hidden="true"></i> Ver en Recibos</a></div>
          </header>
          ${x.estado === 'ANULADO' ? `<p class="cqc-concepto"><span class="pc-rojo">Anulado${x.anulado_por ? ` por ${esc(x.anulado_por)}` : ''}${x.motivo_anulacion ? `: ${esc(x.motivo_anulacion)}` : ''}</span></p>` : x.descripcion || x.observaciones ? `<p class="cqc-concepto">${esc([x.descripcion, x.observaciones].filter(Boolean).join(' · '))}</p>` : ''}
          <section class="cb-bloque cq-lineas">
            <h3 class="ta-col-titulo"><i class="ti ti-file-invoice" aria-hidden="true"></i> Facturas pagadas <small>${pagos.length}</small></h3>
            <div class="pc-lineas"><table><thead><tr><th>Factura</th><th>Interno</th><th>Fecha</th><th>Nombre</th><th class="num">Valor factura</th><th class="num">Abono</th><th class="num">Retención</th><th class="num">Saldo actual</th></tr></thead>
              <tbody>${pagos.map((p) => { const v = p.facturas_venta; return `<tr><td class="fuerte">${esc(nombreFac(v))}</td><td>${v?.numero ?? ''}</td><td>${esc(fmt.fechaDia(String(v?.fecha_emision || '').slice(0, 10)))}</td><td class="cc-nombre">${esc(v?.nombre || '')}</td><td class="num">${fmt.monto(v?.total)}</td><td class="num"><b>${fmt.monto(p.valor)}</b></td><td class="num">${Number(p.valor_retencion) ? fmt.monto(p.valor_retencion) : ''}</td><td class="num ${Number(v?.saldo) > 0 ? 'pc-rojo' : ''}">${fmt.monto(v?.saldo)}</td></tr>`; }).join('') || '<tr><td colspan="8" class="tk-vacio">El recibo no tiene facturas.</td></tr>'}</tbody>
              <tfoot><tr><td colspan="5">Aplicado${Number(x.gasto_valor) ? ` · gastos administrativos ${fmt.monto(x.gasto_valor)}` : ''} · disponible ${fmt.monto(disponible(x))}</td><td class="num">${fmt.monto(ap)}</td><td colspan="2"></td></tr></tfoot></table></div>
          </section>
        </div>`;
    }

    // ---------- Reportes ----------
    function parametros() {
      const emp = ctx.localidad(ctx.sel.loc);
      return [`Empresa: ${emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '—'}`, historia() ? 'Fechas: toda la historia' : `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`,
        `Forma de pago: ${f.forma || 'Todas'}`, `Estado: ${f.estado}`, ...(f.buscar.trim() ? [`Búsqueda: ${f.buscar.trim()}`] : [])];
    }
    function dialogo(formato) {
      const filas = visibles();
      if (!filas.length) return window.FIN.aviso('No hay recibos con estos parámetros');
      let formRef = null;
      window.UI.formulario({
        titulo: `Reporte de recibos · ${formato === 'PDF' ? 'Imprimir en PDF' : 'Generar Excel'}`, campos: [],
        alPreparar: (form) => {
          formRef = form;
          form.querySelector('.modal-cuerpo').innerHTML = `
            <fieldset class="cqc-tipos"><legend>Tipo de reporte</legend>
              <label class="cqc-tipo"><input type="radio" name="tipo" value="RESUMIDO" checked><i class="ti ti-list" aria-hidden="true"></i><span><b>Resumido</b><small>El listado de los ${filas.length.toLocaleString('es-GT')} recibos.</small></span></label>
              <label class="cqc-tipo"><input type="radio" name="tipo" value="DETALLADO"><i class="ti ti-list-details" aria-hidden="true"></i><span><b>Detallado</b><small>Cada recibo con las facturas que pagó.</small></span></label>
            </fieldset>
            <p class="bu-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> Con los filtros de la pantalla: ${esc(parametros().join(' · '))}.</p>`;
          form.querySelector('[type=submit]').innerHTML = formato === 'PDF' ? '<i class="ti ti-file-type-pdf" aria-hidden="true"></i> Imprimir en PDF' : '<i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Generar Excel';
        },
        alGuardar: async () => { await reporte(formato, formRef?.elements.tipo?.value || 'RESUMIDO', filas); }
      });
    }
    async function reporte(formato, modo, filas) {
      const detDe = new Map();
      if (modo === 'DETALLADO') {
        const ids = filas.map((x) => x.id);
        for (let i = 0; i < ids.length; i += 200) {
          const { data } = await sb.from('factura_venta_pagos').select('recibo_id, valor, facturas_venta(numero, serie, numero_dte, fecha_emision, total)').in('recibo_id', ids.slice(i, i + 200)).order('id');
          (data || []).forEach((p) => { if (!detDe.has(p.recibo_id)) detDe.set(p.recibo_id, []); detDe.get(p.recibo_id).push(p); });
        }
      }
      const vivos = filas.filter((x) => x.estado !== 'ANULADO');
      const total = vivos.reduce((t, x) => t + Number(x.valor || 0), 0), disp = vivos.reduce((t, x) => t + Math.max(0, disponible(x)), 0);
      if (formato === 'PDF') {
        window.BANCOS.imprimir('Consulta de Recibos', `<h1>Consulta de Recibos · ${modo === 'DETALLADO' ? 'detallado' : 'resumido'}</h1><h2>${esc(parametros().join(' · '))}</h2>
          <table><thead><tr><th>Recibo</th><th>Interno</th><th>Fecha</th><th>Cliente</th><th>Forma</th><th>Tipo</th><th class="n">Valor</th><th class="n">Disponible</th><th>Estado</th></tr></thead><tbody>
          ${filas.map((x) => `<tr class="${modo === 'DETALLADO' ? 's' : ''}"><td>${esc(nombre(x))}</td><td>${x.numero ?? ''}</td><td>${esc(fmt.fechaDia(x.fecha))}</td><td>${esc(x.nombre || '')}</td><td>${esc(x.forma || '')}</td><td>${esc(x.tipo_pago || '')}</td><td class="n">${fmt.monto(x.valor)}</td><td class="n">${fmt.monto(disponible(x))}</td><td>${estadoDe(x)[1]}</td></tr>
            ${modo === 'DETALLADO' ? (detDe.get(x.id) || []).map((p) => `<tr><td></td><td>${p.facturas_venta?.numero ?? ''}</td><td>${esc(fmt.fechaDia(String(p.facturas_venta?.fecha_emision || '').slice(0, 10)))}</td><td colspan="3">Factura ${esc(nombreFac(p.facturas_venta))} · valor ${fmt.monto(p.facturas_venta?.total)}</td><td class="n">${fmt.monto(p.valor)}</td><td colspan="2"></td></tr>`).join('') : ''}`).join('')}
          </tbody><tfoot><tr><td colspan="6">Total de ${vivos.length} recibos vigentes (de ${filas.length})</td><td class="n">${fmt.monto(total)}</td><td class="n">${fmt.monto(disp)}</td><td></td></tr></tfoot></table>`, { locId: ctx.sel.loc, horizontal: true });
        return;
      }
      if (!window.REPORTE_XLSX) return;
      const datos = [];
      filas.forEach((x) => {
        datos.push({ resaltar: modo === 'DETALLADO' ? 1 : 0, tenue: x.estado === 'ANULADO', valores: [nombre(x), x.numero ?? '', fmt.fechaDia(x.fecha), x.nombre || '', x.forma || '', x.tipo_pago || '', Number(x.valor || 0), disponible(x), estadoDe(x)[1]] });
        if (modo === 'DETALLADO') (detDe.get(x.id) || []).forEach((p) => datos.push({ tipo: 'nota', valores: ['', p.facturas_venta?.numero ?? '', fmt.fechaDia(String(p.facturas_venta?.fecha_emision || '').slice(0, 10)), `Factura ${nombreFac(p.facturas_venta)}`, '', '', Number(p.valor || 0), null, ''] }));
      });
      datos.push({ tipo: 'total', valores: ['', '', '', `Total de ${vivos.length} recibos vigentes (de ${filas.length})`, '', '', total, disp, ''] });
      const emp = ctx.localidad(ctx.sel.loc);
      window.REPORTE_XLSX.generar({ titulo: `Consulta de Recibos · ${modo === 'DETALLADO' ? 'Detallado' : 'Resumido'}`, parametros: parametros(), orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Recibos',
        archivo: `recibos_${modo.toLowerCase()}_${emp?.codigo || ''}_${historia() ? 'historia' : `${f.desde}_${f.hasta}`}`, autofiltro: modo !== 'DETALLADO',
        columnas: [{ titulo: 'Recibo', ancho: 14 }, { titulo: modo === 'DETALLADO' ? 'Interno · factura' : 'Interno', ancho: 10 }, { titulo: 'Fecha', ancho: 12 }, { titulo: modo === 'DETALLADO' ? 'Cliente · factura' : 'Cliente', ancho: 44 },
          { titulo: 'Forma', ancho: 15 }, { titulo: 'Tipo', ancho: 13 }, { titulo: modo === 'DETALLADO' ? 'Valor · abono' : 'Valor', ancho: 15, tipo: 'monto' }, { titulo: 'Disponible', ancho: 15, tipo: 'monto' }, { titulo: 'Estado', ancho: 12 }],
        filas: datos });
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { sel = null; return cargarLocalidad(); }
      if (cambio === 'otro') {
        const n = e.target.name;
        if (n === 'estado' || n === 'cliente') { f[n] = e.target.value; pintarMaestro(); return elegir(visibles().find((x) => x.id === sel?.id) || visibles()[0] || null); }
        if (n === 'orden') { [f.orden, f.dir] = e.target.value.split(':'); return pintarMaestro(); }
        if (n === 'periodo') { f.periodo = e.target.value; sel = null; pintarFiltros(); return consultar(); }
        if (['vendedor', 'forma', 'desde', 'hasta'].includes(n)) { f[n] = e.target.value; sel = null; return consultar(); }
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
      if (e.key === 'Enter' && e.target.matches('tr[data-recibo]')) e.target.click();
    });
    cont.addEventListener('click', (e) => {
      const q = e.target.closest('[data-consultar]');
      if (q) { location.hash = `#/facturacion/recibos/${q.dataset.consultar}`; return; }
      if (e.target.closest('[data-ver-todos]') && rango) { f.periodo = 'HISTORIA'; sel = null; pintarFiltros(); return consultar(); }
      const th = e.target.closest('[data-ordenar]');
      if (th) { const campo = th.dataset.ordenar; f.dir = f.orden === campo && f.dir === 'desc' ? 'asc' : 'desc'; f.orden = campo; const o = ctx.pFil.querySelector('[name=orden]'); if (o) o.value = `${f.orden}:${f.dir}`; return pintarMaestro(); }
      const tr = e.target.closest('tr[data-recibo]');
      if (tr && ctx.pMae.contains(tr)) return elegir(recibos.find((x) => String(x.id) === tr.dataset.recibo));
      const ac = e.target.closest('[data-accion]');
      if (ac?.dataset.accion === 'excel') return dialogo('EXCEL');
      if (ac?.dataset.accion === 'pdf') return dialogo('PDF');
    });

    iniciar();
  };
})();
