// Compras · Mantenimientos · Consultar Compras: resumen de los ingresos de compras de una empresa
// (organización y localidad), un proveedor y un rango de fechas: arriba el maestro de compras con sus
// totales y abajo el detalle de la compra elegida (artículos o compras varias y su detalle contable).
// «Modificar» abre la compra en Registros · Ingreso de compras para modificarla, solo si no está
// contabilizada (partida en el sistema o contabilizada en el sistema anterior) y su mes no está cerrado.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const cant = (n) => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  window.PANTALLAS['consultar-compras'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Consultar Compras', icono: 'ti-file-search', clase: 'bk-movimientos bk-consultar cb-apilado', grupo: 'Compras · Mantenimientos' });
    const { sb } = ctx;
    const [anio] = fmt.hoy().split('-');
    const f = { proveedor: '', desde: `${anio}-01-01`, hasta: fmt.hoy(), estado: 'TODAS', buscar: '' };
    let proveedores = [], compras = [], cerrados = new Set(), sel = null;
    let detalle = { articulos: [], items: [], lineas: [] };

    const proveedor = (id) => proveedores.find((p) => p.id === id);
    const provTxt = (p) => `${p.codigo} · ${p.nombre_comercial}${p.nit ? ` · ${p.nit}` : ''}`;
    const docTxt = (c) => `${c.serie ? `${c.serie}-` : ''}${c.documento}`;
    const mesDe = (c) => (c.fecha_documento || '').slice(0, 7);
    const contabilizada = (c) => !!(c.partida_id || c.fecha_contabilizacion || c.poliza_numero);
    const cerrado = (c) => cerrados.has(mesDe(c));
    // Por qué no se puede modificar (vacío = se puede).
    const bloqueo = (c) => c.estado === 'ANULADA' ? 'La compra está anulada.'
      : contabilizada(c) ? (c.partida_id ? 'La compra ya generó su partida contable.' : 'La compra se contabilizó en el sistema anterior.')
        : cerrado(c) ? `El mes de ${MESES[Number(mesDe(c).slice(5, 7)) - 1]} ${mesDe(c).slice(0, 4)} está cerrado.` : '';

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo cq-prov"><span>Proveedor</span><input list="cq-proveedores" name="proveedor" value="${esc(f.proveedor)}" placeholder="Todos (código, NIT o nombre)"></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Estado</span><select name="estado">${['TODAS', 'MODIFICABLES', 'CONTABILIZADAS', 'MES CERRADO', 'ANULADAS'].map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <datalist id="cq-proveedores">${proveedores.map((p) => `<option value="${esc(provTxt(p))}"></option>`).join('')}</datalist>`,
        '<button type="button" class="boton secundario-sm" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>');
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      const [p, k] = await Promise.all([
        loc ? sb.from('proveedores').select('id, codigo, nit, nombre_comercial').eq('localidad_id', loc).order('nombre_comercial') : { data: [] },
        loc ? sb.from('cierres_mes').select('anio, mes, cerrado').eq('localidad_id', loc).eq('cerrado', true) : { data: [] }
      ]);
      proveedores = p.data || [];
      cerrados = new Set((k.error ? [] : k.data || []).map((x) => `${x.anio}-${String(x.mes).padStart(2, '0')}`));
      pintarFiltros();
      await consultar();
    }

    // Proveedor elegido en el filtro: por su texto de la lista, su código, NIT o nombre.
    function proveedorFiltro() {
      const t = f.proveedor.trim().toUpperCase();
      if (!t) return null;
      return proveedores.find((p) => provTxt(p).toUpperCase() === t) || proveedores.find((p) => String(p.codigo) === t || (p.nit || '').toUpperCase() === t)
        || proveedores.find((p) => p.nombre_comercial.toUpperCase().includes(t)) || { id: -1 };
    }

    async function consultar(id = sel?.id) {
      const loc = ctx.sel.loc;
      if (!loc) { compras = []; pintar(); return; }
      const pv = proveedorFiltro();
      let q = sb.from('compras').select('id, numero, tipo_documento, tipo_dte, serie, documento, fecha_documento, fecha_ingreso, proveedor_id, proveedor_codigo, proveedor_nombre, nit, clasificacion, moneda_id, tipo_cambio, valor_total, iva, base, estado, partida_id, usuario, origen_anterior, compra_anterior, compra_varia_anterior, fecha_contabilizacion, poliza_numero, bodega_id')
        .eq('localidad_id', loc).gte('fecha_documento', f.desde).lte('fecha_documento', f.hasta).order('fecha_documento', { ascending: false }).order('numero', { ascending: false }).limit(5000);
      if (pv) q = q.eq('proveedor_id', pv.id);
      let r = await q;
      // Sin las columnas de la migración (script 89) se consulta lo básico.
      if (r.error && /origen_anterior|fecha_contabilizacion|poliza_numero|compra_varia/.test(r.error.message)) {
        let q2 = sb.from('compras').select('id, numero, tipo_documento, tipo_dte, serie, documento, fecha_documento, fecha_ingreso, proveedor_id, proveedor_codigo, proveedor_nombre, nit, clasificacion, moneda_id, tipo_cambio, valor_total, iva, base, estado, partida_id, usuario, bodega_id')
          .eq('localidad_id', loc).gte('fecha_documento', f.desde).lte('fecha_documento', f.hasta).order('fecha_documento', { ascending: false }).order('numero', { ascending: false }).limit(5000);
        if (pv) q2 = q2.eq('proveedor_id', pv.id);
        r = await q2;
      }
      if (r.error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(r.error.message)}</p>`; return; }
      compras = r.data || [];
      // Saldo de cada compra (vista compras_saldo), por partes para no alargar la consulta.
      const saldos = new Map();
      for (let i = 0; i < compras.length; i += 300) {
        const { data } = await sb.from('compras_saldo').select('id, pagado, pendiente').in('id', compras.slice(i, i + 300).map((c) => c.id));
        (data || []).forEach((x) => saldos.set(x.id, x));
      }
      compras.forEach((c) => { const s = saldos.get(c.id); c.pagado = Number(s?.pagado || 0); c.pendiente = Number(s?.pendiente ?? c.valor_total); });
      sel = compras.find((c) => c.id === id) || null;
      pintar();
      if (!sel && visibles()[0]) await elegir(visibles()[0]);
    }

    const visibles = () => {
      const q = f.buscar.trim().toLowerCase();
      return compras.filter((c) => (f.estado === 'TODAS' || (f.estado === 'MODIFICABLES' && !bloqueo(c)) || (f.estado === 'CONTABILIZADAS' && contabilizada(c))
        || (f.estado === 'MES CERRADO' && cerrado(c)) || (f.estado === 'ANULADAS' && c.estado === 'ANULADA'))
        && (!q || [c.numero, c.documento, c.serie, c.proveedor_codigo, c.proveedor_nombre, c.nit, c.compra_anterior].some((v) => String(v || '').toLowerCase().includes(q))));
    };
    const enQ = (c, campo) => Number(c[campo] || 0) * (c.moneda_id === ctx.monedaBase()?.id ? 1 : Number(c.tipo_cambio || 1));

    async function elegir(c) {
      sel = c;
      detalle = { articulos: [], items: [], lineas: [] };
      if (c) {
        const [a, i, l] = await Promise.all([
          sb.from('compra_articulos').select('*, productos(codigo, codigo_producto, nombre)').eq('compra_id', c.id).order('linea'),
          sb.from('compra_items').select('*').eq('compra_id', c.id).order('linea'),
          sb.from('compra_lineas').select('linea, debe, haber, cuentas(codigo, nombre)').eq('compra_id', c.id).order('linea')
        ]);
        detalle = { articulos: a.error ? [] : a.data || [], items: i.data || [], lineas: l.data || [] };
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-compra]').forEach((tr) => tr.classList.toggle('actual', !!c && tr.dataset.compra === String(c.id)));
    }

    function pintar() { pintarMaestro(); pintarDetalle(); }

    function pintarMaestro() {
      const filas = visibles();
      const vivas = filas.filter((c) => c.estado === 'ACTIVA');
      const tot = (campo) => vivas.reduce((t, c) => t + enQ(c, campo), 0);
      const mod = filas.filter((c) => !bloqueo(c)).length;
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>Compras <small>${filas.length}</small></h2>
          <div class="ta-totales pc-resumen">
            <span class="ta-total"><b>Q ${fmt.monto(tot('valor_total'))}</b> total</span>
            <span class="ta-total"><b>Q ${fmt.monto(tot('iva'))}</b> IVA</span>
            <span class="ta-total sin"><b>Q ${fmt.monto(tot('pendiente'))}</b> saldo</span>
            <span class="ta-total"><b>${mod}</b> modificables</span>
            <span class="ta-total"><b>${filas.filter(contabilizada).length}</b> contabilizadas</span>
          </div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Compra, documento, proveedor, NIT…" value="${esc(f.buscar)}" aria-label="Buscar compras"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table><thead><tr><th class="num">Compra</th><th>Tipo</th><th>Documento</th><th>Fecha</th><th>Proveedor</th><th>Clasificación</th><th class="num">Total</th><th class="num">IVA</th><th class="num">Saldo</th><th>Estado</th><th>Contabilizada</th><th>Mes</th><th class="cq-acc"></th></tr></thead>
            <tbody>${filas.map((c) => { const b = bloqueo(c); const sim = ctx.moneda(c.moneda_id)?.simbolo || 'Q'; return `<tr data-compra="${c.id}" class="${sel && sel.id === c.id ? 'actual' : ''} ${c.estado === 'ANULADA' ? 'pc-anulada' : ''}" tabindex="0">
              <td class="num fuerte">${c.numero}${c.origen_anterior ? `<small class="cq-ant" title="Compra ${c.origen_anterior === 'VARIAS' ? 'varia' : 'de medicamentos'} ${c.compra_anterior} del sistema anterior${c.compra_varia_anterior ? ` · compra varia ${c.compra_varia_anterior}` : ''}">ant. ${c.compra_anterior}</small>` : ''}</td>
              <td><span class="pc-tipo">${esc((c.tipo_dte || c.tipo_documento || '').replace('FACTURA ', 'F. '))}</span></td><td>${esc(docTxt(c))}</td><td>${esc(fmt.fechaDia(c.fecha_documento))}</td>
              <td class="cc-nombre" title="${esc(c.proveedor_nombre)}">${esc(c.proveedor_codigo ? `${c.proveedor_codigo} · ` : '')}${esc(c.proveedor_nombre)}</td><td>${esc(c.clasificacion || '')}</td>
              <td class="num">${esc(sim)} ${fmt.monto(c.valor_total)}</td><td class="num">${fmt.monto(c.iva)}</td><td class="num ${c.pendiente > 0 && c.estado === 'ACTIVA' ? 'cq-saldo' : ''}">${c.estado === 'ACTIVA' ? fmt.monto(c.pendiente) : '—'}</td>
              <td><span class="pc-marca ${c.estado === 'ANULADA' ? 'anulada' : c.pendiente <= 0 ? 'definitiva' : 'pendiente'}">${c.estado === 'ANULADA' ? 'Anulada' : c.pendiente <= 0 ? 'Pagada' : 'Por pagar'}</span></td>
              <td>${contabilizada(c) ? `<span class="pc-marca aprobada" title="${c.partida_id ? 'Partida generada en el sistema' : 'Contabilizada en el sistema anterior'}">${c.partida_id ? 'Partida' : 'Sist. anterior'}</span>` : '<span class="tk-tenue">No</span>'}</td>
              <td>${cerrado(c) ? '<span class="pc-marca anulada">Cerrado</span>' : '<span class="tk-tenue">Abierto</span>'}</td>
              <td class="cq-acc">${ctx.admin ? `<button type="button" class="boton secundario-sm" data-modificar="${c.id}" ${b ? 'disabled' : ''} title="${esc(b || 'Abrir en Ingreso de compras para modificarla')}"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>` : ''}</td></tr>`; }).join('')
              || `<tr><td colspan="13" class="tk-vacio"><i class="ti ti-file-search" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : 'No hay compras con estos parámetros.'}</td></tr>`}</tbody></table>
        </div>`;
    }

    function pintarDetalle() {
      const c = sel;
      if (!c) { ctx.pDet.innerHTML = ctx.vacio(ctx.sel.loc ? 'Elige una compra para ver su detalle.' : 'Elige la empresa.', 'ti-file-search'); return; }
      const { articulos, items, lineas } = detalle;
      const b = bloqueo(c);
      const sim = ctx.moneda(c.moneda_id)?.simbolo || 'Q';
      const totArt = articulos.reduce((t, a) => t + Number(a.costo_total ?? (Number(a.cantidad) * Number(a.costo_unitario) - Number(a.descuento || 0))), 0);
      ctx.pDet.innerHTML = `
        <div class="tk-form cq-ficha">
          <header class="tk-titulo cb-titulo">
            <span class="tk-icono"><i class="ti ti-file-invoice" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>Compra ${c.numero}${c.origen_anterior ? ` · ${c.origen_anterior === 'VARIAS' ? 'compra varia' : 'compra de medicamentos'} ${c.compra_anterior} del sistema anterior` : ''}</small><h2>${esc(c.proveedor_nombre)} · ${esc(docTxt(c))}</h2></div>
            <dl class="cq-datos">
              <div><dt>Fecha</dt><dd>${esc(fmt.fechaDia(c.fecha_documento))}</dd></div>
              <div><dt>Total</dt><dd>${esc(sim)} ${fmt.monto(c.valor_total)}</dd></div>
              <div><dt>Base · IVA</dt><dd>${fmt.monto(c.base)} · ${fmt.monto(c.iva)}</dd></div>
              <div><dt>Saldo</dt><dd>${c.estado === 'ACTIVA' ? `${esc(sim)} ${fmt.monto(c.pendiente)}` : 'Anulada'}</dd></div>
              <div><dt>Ingresó</dt><dd>${esc(c.usuario || '—')}</dd></div>
            </dl>
            <div class="tk-titulo-acciones">
              ${b ? `<span class="cq-bloqueo"><i class="ti ti-lock" aria-hidden="true"></i> ${esc(b)}</span>` : ''}
              <a class="boton secundario-sm" href="#/compras/facturas-compra/${c.id}"><i class="ti ti-eye" aria-hidden="true"></i> Ver ingreso</a>
              ${ctx.admin ? `<button type="button" class="boton primario-sm" data-modificar="${c.id}" ${b ? 'disabled' : ''}><i class="ti ti-pencil" aria-hidden="true"></i> Modificar ingreso de compra</button>` : ''}
            </div>
          </header>
          <div class="cq-det">
            <section class="cb-bloque cq-lineas">
              <h3 class="ta-col-titulo"><i class="ti ${articulos.length ? 'ti-package' : 'ti-list'}" aria-hidden="true"></i> ${articulos.length ? `Artículos <small>${articulos.length}</small>` : `Compras varias <small>${items.length}</small>`}</h3>
              <div class="pc-lineas"><table>
                ${articulos.length ? `<thead><tr><th class="pc-n">Línea</th><th>Código</th><th>Producto</th><th>Lote / serie</th><th>Vence</th><th class="num">Cantidad</th><th class="num">Costo unitario</th><th class="num">Descuento</th><th class="num">Total</th><th>Inv.</th></tr></thead>
                <tbody>${articulos.map((a) => `<tr><td class="pc-n">${a.linea}</td><td class="fuerte">${esc(a.productos?.codigo_producto || String(a.productos?.codigo || '') || a.producto_codigo || '')}</td>
                  <td class="cc-nombre">${a.productos ? esc(a.productos.nombre) : '<span class="cf-sin-prod">Producto por migrar</span>'}</td><td>${esc(a.serie || '')}</td><td>${esc(fmt.fechaDia(a.fecha_vencimiento))}</td>
                  <td class="num">${cant(a.cantidad)}</td><td class="num">${fmt.monto(a.costo_unitario)}</td><td class="num">${Number(a.descuento) ? fmt.monto(a.descuento) : ''}</td>
                  <td class="num fuerte">${fmt.monto(a.costo_total ?? Number(a.cantidad) * Number(a.costo_unitario) - Number(a.descuento || 0))}</td><td>${a.inventariado ? '<i class="ti ti-check cb-si" aria-label="Inventariado"></i>' : ''}</td></tr>`).join('')}</tbody>
                <tfoot><tr><td colspan="8">Total del detalle</td><td class="num">${esc(sim)} ${fmt.monto(totArt)}</td><td></td></tr></tfoot>`
                : `<thead><tr><th class="pc-n">Línea</th><th>Descripción</th><th class="num">Cantidad</th><th class="num">Costo total</th></tr></thead>
                <tbody>${items.map((x) => `<tr><td class="pc-n">${x.linea}</td><td>${esc(x.descripcion)}</td><td class="num">${cant(x.cantidad)}</td><td class="num">${fmt.monto(x.costo_total)}</td></tr>`).join('') || '<tr><td colspan="4" class="tk-vacio">La compra no tiene detalle.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="3">Total del detalle</td><td class="num">${esc(sim)} ${fmt.monto(items.reduce((t, x) => t + Number(x.costo_total || 0), 0))}</td></tr></tfoot>`}
              </table></div>
            </section>
            <section class="cb-bloque cq-conta">
              <h3 class="ta-col-titulo"><i class="ti ti-list-details" aria-hidden="true"></i> Detalle contable <small>${lineas.length}</small></h3>
              <div class="pc-lineas"><table><thead><tr><th>Cuenta</th><th>Nombre</th><th class="num">Debe</th><th class="num">Haber</th></tr></thead>
                <tbody>${lineas.map((l) => `<tr><td class="fuerte">${esc(l.cuentas?.codigo || '')}</td><td class="cc-nombre">${esc(l.cuentas?.nombre || '')}</td><td class="num">${Number(l.debe) ? fmt.monto(l.debe) : ''}</td><td class="num">${Number(l.haber) ? fmt.monto(l.haber) : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="tk-vacio">Sin detalle contable.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="2">Totales</td><td class="num">${fmt.monto(lineas.reduce((t, l) => t + Number(l.debe || 0), 0))}</td><td class="num">${fmt.monto(lineas.reduce((t, l) => t + Number(l.haber || 0), 0))}</td></tr></tfoot></table></div>
            </section>
          </div>
        </div>`;
    }

    // Excel (CSV) del maestro y del detalle de las compras visibles.
    async function excel() {
      const filas = visibles();
      if (!filas.length) return window.FIN.aviso('No hay compras con estos parámetros');
      const emp = ctx.localidad(ctx.sel.loc);
      const cab = ['Compra', 'Compra anterior', 'Tipo', 'Serie', 'Documento', 'Fecha', 'Proveedor', 'Nombre', 'NIT', 'Clasificación', 'Total', 'IVA', 'Saldo', 'Estado', 'Contabilizada', 'Mes cerrado'];
      const datos = filas.map((c) => [c.numero, c.compra_anterior || '', c.tipo_dte || c.tipo_documento, c.serie || '', c.documento, c.fecha_documento, c.proveedor_codigo || '', c.proveedor_nombre, c.nit || '', c.clasificacion || '',
        c.valor_total, c.iva, c.estado === 'ACTIVA' ? c.pendiente : 0, c.estado, contabilizada(c) ? 'SÍ' : 'NO', cerrado(c) ? 'SÍ' : 'NO']);
      window.COMPRAS_CAT.descargarCsv(`consulta_compras_${emp?.codigo || ''}_${f.desde}_${f.hasta}.csv`, [cab, ...datos]);
    }

    function modificar(id) {
      const c = compras.find((x) => String(x.id) === String(id));
      if (!c) return;
      const b = bloqueo(c);
      if (b) return window.FIN.aviso(b);
      location.hash = `#/compras/facturas-compra/${c.id}:modificar`;
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { sel = null; return cargarLocalidad(); }
      if (cambio === 'otro') {
        const n = e.target.name;
        if (n === 'estado') { f.estado = e.target.value; pintarMaestro(); return elegir(visibles().find((c) => c.id === sel?.id) || visibles()[0] || null); }
        if (n === 'proveedor' || n === 'desde' || n === 'hasta') { f[n] = e.target.value; sel = null; return consultar(); }
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
      if (e.key === 'Enter' && e.target.matches('tr[data-compra]')) e.target.click();
    });
    cont.addEventListener('click', (e) => {
      const m = e.target.closest('[data-modificar]');
      if (m) return modificar(m.dataset.modificar);
      const tr = e.target.closest('tr[data-compra]');
      if (tr && ctx.pMae.contains(tr)) return elegir(compras.find((c) => String(c.id) === tr.dataset.compra));
      const ac = e.target.closest('[data-accion]');
      if (ac?.dataset.accion === 'excel') return excel();
    });

    iniciar();
  };
})();
