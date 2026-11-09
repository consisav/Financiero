// Facturación/Ventas · Mantenimientos · Envíos (diseño del sistema anterior).
//   Encabezado: número de envío, fecha, bodega; cliente, NIT, teléfono, contacto, dirección; forma de pago, días de
//   crédito, tipo de precio y fecha de cobro. Productos con código, descripción, cantidad, valor unitario y total; al
//   lado la unidad, el lote, el registro sanitario y las fechas de la línea. Impresión tipo factura o tipo envío.
//   Pestaña «Listado de envíos» para abrir los anteriores.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  window.PANTALLAS.envios = function (cont, m, extra) {
    const ctx = montar(cont, { titulo: 'Envíos', icono: 'ti-truck', clase: 'bk-movimientos bm-solo vf-facturas ve-envios', grupo: 'Ventas · Mantenimientos' });
    const { sb } = ctx;
    let clientes = [], bodegas = [], precios = [], productos = [], preciosProd = [], locCargada = null;
    let actual = null, modificando = false, pestana = 'PRODUCTOS', lineaSel = 0, lineas = [], listado = null;

    const cliente = (id) => clientes.find((c) => c.id === id);
    const porCodigoProd = (cod) => productos.find((p) => String(p.codigo) === String(cod).trim());
    const precioDe = (pid, tp) => Number(preciosProd.find((x) => x.producto_id === pid && x.tipo_precio_id === tp)?.precio || 0);
    const editable = () => ctx.admin && (!actual || (modificando && actual.estado !== 'ANULADO'));
    const nuevaLinea = () => ({ producto_id: null, producto_codigo: '', descripcion: '', cantidad: 1, precio: 0, unidad_medida: '', lote: '', registro_sanitario: '', fecha_vencimiento: '', fecha_fabricacion: '' });
    const sumar = (dias, desde) => { const d = desde ? new Date(`${desde}T12:00:00`) : new Date(); d.setDate(d.getDate() + Number(dias || 0)); return d.toISOString().slice(0, 10); };

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('envios_venta').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/envios_venta/.test(prueba.error.message) ? 'Falta instalar el script 138 (series, correlativos, envíos y despachos) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      pintarFiltros();
      await cargarLocalidad();
      if (/^\d+$/.test(String(extra || ''))) { const { data } = await sb.from('envios_venta').select('*').eq('id', Number(extra)).maybeSingle(); if (data) return abrir(data); }
      // Abre con el último envío y el listado (incluye los migrados del sistema anterior).
      const { data: ult } = await sb.from('envios_venta').select('*').eq('localidad_id', ctx.sel.loc || 0).order('numero', { ascending: false }).limit(500);
      if (ult?.length) { listado = ult; pestana = 'LISTADO'; return abrir(ult[0]); }
      abrir(null);
    }
    function pintarFiltros() { ctx.filtros(`<label class="campo vr-ir"><span>Envío No.</span><input name="ir_envio" inputmode="numeric" placeholder="Número" autocomplete="off"></label>`, ''); }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc || 0; locCargada = loc;
      const [c, b, p, pr, pp] = await Promise.all([
        sb.from('clientes').select('*').eq('localidad_id', loc).order('nombre'),
        sb.from('bodegas').select('id, codigo, nombre, estado').eq('localidad_id', loc).order('codigo'),
        sb.from('tipos_precio').select('id, codigo, nombre, activo').eq('localidad_id', loc).order('codigo'),
        sb.from('productos').select('id, codigo, nombre, estado, lote').eq('localidad_id', loc).order('codigo'),
        sb.from('producto_precios').select('producto_id, tipo_precio_id, precio').eq('localidad_id', loc)
      ]);
      clientes = c.data || []; bodegas = b.data || []; precios = pr.data || []; productos = p.data || []; preciosProd = pp.data || [];
    }
    async function abrir(e) {
      if (e && e.localidad_id !== locCargada) { ctx.sel.loc = e.localidad_id; ctx.sel.org = e.organizacion_id; pintarFiltros(); await cargarLocalidad(); }
      actual = e; modificando = false; lineaSel = 0; lineas = [];
      if (e) { const { data } = await sb.from('envio_venta_lineas').select('*').eq('envio_id', e.id).order('linea'); lineas = (data || []).map((x) => ({ ...x, cantidad: Number(x.cantidad), precio: Number(x.precio), fecha_vencimiento: x.fecha_vencimiento || '', fecha_fabricacion: x.fecha_fabricacion || '' })); }
      else lineas = [nuevaLinea()];
      pintar();
    }
    const nuevos = () => ({ fecha: fmt.hoy(), bodega_id: null, cliente_id: null, cliente_codigo: '', nombre: '', nit: '', telefono: '', contacto: '', direccion: '', forma_pago: 'CONTADO', dias_credito: 0, tipo_precio_id: null, fecha_cobro: '', observaciones: '' });
    const opt = (l, id) => `<option value="">—</option>${l.filter((x) => x.activo !== false && (!x.estado || x.estado === 'ACTIVO' || x.estado === 'A') || x.id === id).map((x) => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${x.codigo} · ${esc(x.nombre)}</option>`).join('')}`;

    function pintar(v0) {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-truck'); return; }
      const e = actual, ed = editable(), dis = ed ? '' : 'disabled';
      const v = v0 || (e ? { ...e } : nuevos());
      const total = fmt.redondear(lineas.reduce((t, l) => t + Number(l.cantidad || 0) * Number(l.precio || 0), 0));
      const l = lineas[lineaSel] || null;
      const puede = ctx.admin && e && e.estado !== 'ANULADO' && !modificando;
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form bm-form vf-form ve-form" novalidate>
          <header class="tk-titulo bm-titulo">
            <div class="tk-titulo-texto"><small>Envíos · ${esc(ctx.localidad(ctx.sel.loc)?.codigo || '')} ${esc(ctx.localidad(ctx.sel.loc)?.nombre_comercial || '')}</small><h2>${e ? `Envío ${e.numero}` : 'Nuevo envío'}</h2></div>
            <div class="tk-marcas">${e ? (e.estado === 'ANULADO' ? '<span class="pc-marca anulada">Anulado</span>' : '<span class="pc-marca aprobada">Emitido</span>') : '<span class="pc-marca pendiente">Sin registrar</span>'}</div>
            <div class="tk-titulo-acciones">
              <button type="button" class="boton secundario-sm" data-accion="imp-factura" ${e ? '' : 'disabled'}><i class="ti ti-file-invoice" aria-hidden="true"></i> Imprimir tipo factura</button>
              <button type="button" class="boton secundario-sm" data-accion="imp-envio" ${e ? '' : 'disabled'}><i class="ti ti-truck" aria-hidden="true"></i> Imprimir tipo envío</button>
              ${ctx.admin && !modificando ? `<button type="button" class="boton ${ed ? 'secundario-sm' : 'primario-sm'}" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>` : ''}
              ${puede ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="anular"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button><button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}
              ${modificando ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}
              ${ed ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${e ? 'Guardar cambios' : 'Registrar'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          <div class="vfa">
            <div class="vfa-arriba">
              <section class="bm-bloque dpb-banda vf">
                <div class="ve-g ve-g1">
                  <label class="campo"><span>Envío</span><input value="${e ? e.numero : 'Automático'}" disabled></label>
                  <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(v.fecha || '')}" ${dis}></label>
                  <label class="campo ve-c2"><span>Bodega</span><select name="bodega_id" ${dis}>${opt(bodegas, v.bodega_id)}</select></label>
                  <label class="campo"><span>Cliente</span><input list="ve-clientes" name="cliente_codigo" value="${esc(String(v.cliente_codigo ?? ''))}" placeholder="Código" ${dis}></label>
                  <label class="campo ve-c3"><span>Nombre *</span><input name="nombre" value="${esc(v.nombre || '')}" maxlength="150" ${dis}></label>
                  <label class="campo"><span>NIT</span><input name="nit" value="${esc(v.nit || '')}" maxlength="25" ${dis}></label>
                </div>
                <div class="ve-g ve-g2">
                  <label class="campo"><span>Teléfono</span><input name="telefono" value="${esc(v.telefono || '')}" maxlength="40" ${dis}></label>
                  <label class="campo ve-c2"><span>Contacto</span><input name="contacto" value="${esc(v.contacto || '')}" maxlength="100" ${dis}></label>
                  <label class="campo ve-c3"><span>Dirección</span><input name="direccion" value="${esc(v.direccion || '')}" maxlength="300" ${dis}></label>
                </div>
                <div class="ve-g ve-g3">
                  <label class="campo"><span>Forma de pago</span><select name="forma_pago" ${dis}>${['CONTADO', 'CRÉDITO'].map((x) => `<option ${v.forma_pago === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
                  <label class="campo"><span>Días crédito</span><input type="number" min="0" max="365" name="dias_credito" value="${esc(String(v.dias_credito ?? 0))}" ${dis}></label>
                  <label class="campo ve-c2"><span>Tipo de precio</span><select name="tipo_precio_id" ${dis}>${opt(precios, v.tipo_precio_id)}</select></label>
                  <label class="campo"><span>Fecha cobro</span><input type="date" name="fecha_cobro" value="${esc(v.fecha_cobro || '')}" ${dis}></label>
                  <label class="campo ve-c2"><span>Observaciones</span><input name="observaciones" value="${esc(v.observaciones || '')}" maxlength="300" ${dis}></label>
                </div>
                <datalist id="ve-clientes">${clientes.filter((c) => c.estado !== 'INACTIVO').map((c) => `<option value="${esc(c.nombre)}${c.tipo_documento !== 'CF' && c.documento ? ` · NIT ${esc(c.documento)}` : ''} — ${c.codigo}"></option>`).join('')}</datalist>
              </section>
              <section class="vfb-card vfb-resumen vfa-resumen">
                <div class="vfb-total"><span>Total</span><b data-calc="total">Q ${fmt.monto(total)}</b></div>
                <div><span>Productos</span><b>${lineas.filter((x) => x.descripcion).length}</b></div>
                <div><span>Unidades</span><b data-calc="cant">${fmt.monto(lineas.reduce((t, x) => t + Number(x.cantidad || 0), 0))}</b></div>
                <div><span>Usuario</span><b>${esc(e?.usuario || (ctx.yo.usuario || '').toUpperCase())}</b></div>
              </section>
            </div>
            <section class="bm-pestanas">
              <div class="bm-tabs-barra">
                <div class="rp-pestanas" role="tablist">${[['PRODUCTOS', 'Productos', 'ti-list-details'], ['LISTADO', 'Listado de envíos', 'ti-list-search']].map(([k, t, i]) => `<button type="button" role="tab" data-pestana="${k}" class="${pestana === k ? 'activa' : ''}"><i class="ti ${i}" aria-hidden="true"></i> ${t}${k === 'PRODUCTOS' ? ` <b>${lineas.length}</b>` : ''}</button>`).join('')}</div>
                <span class="vf-tab-acc">${ed && pestana === 'PRODUCTOS' ? '<button type="button" class="boton secundario-sm" data-accion="linea"><i class="ti ti-plus" aria-hidden="true"></i> Producto</button>' : ''}</span>
              </div>
              <div class="bm-panel" data-panel="PRODUCTOS" ${pestana === 'PRODUCTOS' ? '' : 'hidden'}>
                <div class="vf-detalle">
                  <div class="pc-lineas"><table class="vf-lineas"><thead><tr><th class="pc-n">#</th><th class="vf-c-prod">Código</th><th>Descripción</th><th class="num vf-c-num">Cantidad</th><th class="num vf-c-num">Valor unitario</th><th class="num vf-c-num">Valor total</th><th class="pq-x"></th></tr></thead>
                    <tbody>${lineas.map((x, i) => `<tr data-linea="${i}" class="${i === lineaSel ? 'actual' : ''}"><td class="pc-n">${i + 1}</td>
                      <td><input list="ve-productos" data-l="producto" value="${esc(String(x.producto_codigo ?? ''))}" ${dis}></td>
                      <td><input data-l="descripcion" value="${esc(x.descripcion || '')}" maxlength="300" ${dis}></td>
                      <td class="num"><input type="number" step="any" min="0" data-l="cantidad" value="${esc(String(x.cantidad ?? ''))}" ${dis}></td>
                      <td class="num"><input type="number" step="any" min="0" data-l="precio" value="${esc(String(x.precio ?? ''))}" ${dis}></td>
                      <td class="num fuerte" data-tq>${fmt.monto(Number(x.cantidad || 0) * Number(x.precio || 0))}</td>
                      <td class="pq-x">${ed ? `<button type="button" class="icono-boton" data-quitar="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`).join('')}</tbody>
                    <tfoot><tr><td colspan="3">Total</td><td class="num">${fmt.monto(lineas.reduce((t, x) => t + Number(x.cantidad || 0), 0))}</td><td></td><td class="num" data-calc="tq">${fmt.monto(total)}</td><td></td></tr></tfoot></table></div>
                  <aside class="vf-lado vfd-lado">${lado(l, dis)}</aside>
                </div>
                <datalist id="ve-productos">${productos.filter((p) => p.estado !== 'INACTIVO').map((p) => `<option value="${esc(p.nombre)} — ${p.codigo}"></option>`).join('')}</datalist>
              </div>
              <div class="bm-panel vf-listado" data-panel="LISTADO" ${pestana === 'LISTADO' ? '' : 'hidden'}>${pestana === 'LISTADO' ? panelListado() : ''}</div>
            </section>
          </div>
        </form>`;
    }
    const lado = (l, dis) => l ? `<small>Línea ${lineaSel + 1}</small>
        <label class="campo"><span>Unidad de medida</span><input data-lado="unidad_medida" value="${esc(l.unidad_medida || '')}" maxlength="60" ${dis}></label>
        <label class="campo"><span>Lote</span><input data-lado="lote" value="${esc(l.lote || '')}" maxlength="40" ${dis}></label>
        <label class="campo"><span>Registro sanitario</span><input data-lado="registro_sanitario" value="${esc(l.registro_sanitario || '')}" maxlength="60" ${dis}></label>
        <label class="campo"><span>Fecha de vencimiento</span><input type="date" data-lado="fecha_vencimiento" value="${esc(l.fecha_vencimiento || '')}" ${dis}></label>
        <label class="campo"><span>Fecha de fabricación</span><input type="date" data-lado="fecha_fabricacion" value="${esc(l.fecha_fabricacion || '')}" ${dis}></label>` : '<small>Sin línea</small>';
    function panelListado() {
      const l = listado || [];
      return `<div class="pc-lineas">${!listado ? '<p class="tk-vacio">Cargando…</p>' : `<table class="vf-lista"><thead><tr><th>Envío</th><th>Fecha</th><th>Cliente</th><th>Bodega</th><th>Pago</th><th class="num">Total</th><th>Estado</th></tr></thead>
        <tbody>${l.map((x) => { const b = bodegas.find((y) => y.id === x.bodega_id); return `<tr data-abrir="${x.id}" class="${x.id === actual?.id ? 'actual' : ''}"><td class="fuerte">${x.numero}</td><td>${esc(fmt.fechaDia(x.fecha))}</td><td>${esc(x.nombre)}</td><td>${esc(b ? b.nombre : '')}</td><td>${esc(x.forma_pago)}${x.forma_pago === 'CRÉDITO' ? ` ${x.dias_credito}` : ''}</td><td class="num fuerte">${fmt.monto(x.total)}</td><td>${x.estado === 'ANULADO' ? '<span class="pc-marca anulada">Anulado</span>' : '<span class="pc-marca aprobada">Emitido</span>'}</td></tr>`; }).join('') || '<tr><td colspan="7" class="tk-vacio">Sin envíos.</td></tr>'}</tbody></table>`}</div>`;
    }

    function encabezado(form) {
      const el = form.elements; const t = (k) => el[k] && String(el[k].value).trim() !== '' ? String(el[k].value).trim() : null;
      const id = (k) => el[k] && el[k].value ? Number(el[k].value) : null;
      const c = clientes.find((x) => String(x.codigo) === String(el.cliente_codigo.value).trim());
      return { fecha: t('fecha') || fmt.hoy(), bodega_id: id('bodega_id'), cliente_id: c ? c.id : (actual?.cliente_id || null), cliente_codigo: t('cliente_codigo'), nombre: t('nombre') || '', nit: t('nit'), telefono: t('telefono'),
        contacto: t('contacto'), direccion: t('direccion'), forma_pago: el.forma_pago.value, dias_credito: Number(el.dias_credito.value) || 0, tipo_precio_id: id('tipo_precio_id'), fecha_cobro: t('fecha_cobro'), observaciones: t('observaciones') };
    }
    function leer() {
      ctx.pDet.querySelectorAll('tr[data-linea]').forEach((tr) => {
        const x = lineas[Number(tr.dataset.linea)]; if (!x) return; const g = (k) => tr.querySelector(`[data-l=${k}]`);
        if (!g('descripcion')) return; x.descripcion = g('descripcion').value; x.cantidad = Number(g('cantidad').value) || 0; x.precio = Number(g('precio').value) || 0;
      });
      ctx.pDet.querySelectorAll('[data-lado]').forEach((i) => { const x = lineas[lineaSel]; if (x) x[i.dataset.lado] = i.value; });
    }
    function repintar(c = {}) { const form = ctx.pDet.querySelector('.ve-form'); if (!form) return; pintar({ ...(actual || nuevos()), ...encabezado(form), ...c }); }
    function totalizar() {
      const form = ctx.pDet.querySelector('.ve-form'); if (!form) return; leer();
      const total = lineas.reduce((t, l) => t + l.cantidad * l.precio, 0);
      form.querySelectorAll('tr[data-linea]').forEach((tr) => { const x = lineas[Number(tr.dataset.linea)]; const td = tr.querySelector('[data-tq]'); if (x && td) td.textContent = fmt.monto(x.cantidad * x.precio); });
      const s = (k, t) => { const e = form.querySelector(`[data-calc=${k}]`); if (e) e.textContent = t; };
      s('total', `Q ${fmt.monto(total)}`); s('tq', fmt.monto(total)); s('cant', fmt.monto(lineas.reduce((t, x) => t + x.cantidad, 0)));
    }
    async function guardar(form) {
      const error = form.querySelector('.tk-error'); error.textContent = ''; leer();
      const h = encabezado(form);
      if (!h.nombre) { error.textContent = 'Escribe el nombre del cliente.'; return; }
      const ls = lineas.filter((x) => x.descripcion.trim() || x.cantidad || x.precio);
      if (!ls.length) { error.textContent = 'Agrega al menos un producto.'; return; }
      const mala = ls.findIndex((x) => !x.descripcion.trim() || !(x.cantidad > 0));
      if (mala >= 0) { error.textContent = `Revisa la línea ${mala + 1}: necesita descripción y cantidad mayor que cero.`; return; }
      try {
        let id = actual?.id;
        if (id) { const r = await sb.from('envios_venta').update(h).eq('id', id); if (r.error) throw r.error; const d = await sb.from('envio_venta_lineas').delete().eq('envio_id', id); if (d.error) throw d.error; }
        else { const r = await sb.from('envios_venta').insert({ ...h, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, usuario: (ctx.yo.usuario || '').toUpperCase() }).select('id').single(); if (r.error) throw r.error; id = r.data.id; }
        const r1 = await sb.from('envio_venta_lineas').insert(ls.map((x, i) => ({ envio_id: id, linea: i + 1, producto_id: x.producto_id, producto_codigo: x.producto_codigo ? String(x.producto_codigo) : null, descripcion: x.descripcion, cantidad: x.cantidad, precio: x.precio,
          unidad_medida: x.unidad_medida || null, lote: x.lote || null, registro_sanitario: x.registro_sanitario || null, fecha_vencimiento: x.fecha_vencimiento || null, fecha_fabricacion: x.fecha_fabricacion || null })));
        if (r1.error) throw r1.error;
        window.FIN.aviso(actual ? 'Envío guardado' : 'Envío registrado');
        listado = null;
        const { data } = await sb.from('envios_venta').select('*').eq('id', id).single(); await abrir(data);
      } catch (err) { error.textContent = window.UI.traducirError(err); }
    }
    function imprimirEnvio(tipo) {
      const e = actual; if (!e) return; const b = bodegas.find((x) => x.id === e.bodega_id); const tp = precios.find((x) => x.id === e.tipo_precio_id);
      imprimir(`Envío ${e.numero}`, `<h1>Envío ${e.numero}${tipo === 'FACTURA' ? ' · tipo factura' : ' · tipo envío'}${e.estado === 'ANULADO' ? ' · ANULADO' : ''}</h1>
        <h2>${esc([`Fecha: ${fmt.fechaDia(e.fecha)}`, `Cliente: ${e.cliente_codigo || ''} · ${e.nombre}`, `NIT: ${e.nit || ''}`, `Bodega: ${b ? b.nombre : '—'}`, ...(tipo === 'FACTURA' ? [`Pago: ${e.forma_pago}${e.forma_pago === 'CRÉDITO' ? ` ${e.dias_credito} días` : ''}`, `Tipo de precio: ${tp ? tp.nombre : '—'}`, `Fecha de cobro: ${e.fecha_cobro ? fmt.fechaDia(e.fecha_cobro) : '—'}`] : [`Contacto: ${e.contacto || '—'}`, `Teléfono: ${e.telefono || '—'}`])].join(' · '))}</h2>
        ${e.direccion ? `<p><b>Dirección:</b> ${esc(e.direccion)}</p>` : ''}
        <table><thead><tr><th>#</th><th>Código</th><th>Descripción</th><th>Lote</th><th>Vence</th><th class="n">Cantidad</th>${tipo === 'FACTURA' ? '<th class="n">Valor unitario</th><th class="n">Valor total</th>' : ''}</tr></thead><tbody>
        ${lineas.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(String(x.producto_codigo ?? ''))}</td><td>${esc(x.descripcion)}</td><td>${esc(x.lote || '')}</td><td>${esc(x.fecha_vencimiento ? fmt.fechaDia(x.fecha_vencimiento) : '')}</td><td class="n">${fmt.monto(x.cantidad)}</td>${tipo === 'FACTURA' ? `<td class="n">${fmt.monto(x.precio)}</td><td class="n">${fmt.monto(x.cantidad * x.precio)}</td>` : ''}</tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="5">Total</td><td class="n">${fmt.monto(lineas.reduce((t, x) => t + x.cantidad, 0))}</td>${tipo === 'FACTURA' ? `<td></td><td class="n">${fmt.monto(e.total)}</td>` : ''}</tr></tfoot></table>
        <div class="firmas"><div>Entregó: ${esc(e.usuario || '')}</div><div>Recibió conforme</div></div>`, { locId: e.localidad_id, orgId: e.organizacion_id });
    }

    // Listas de valores «descripción — código»: el campo queda con el código.
    cont.addEventListener('change', (e) => { const i = e.target; if (i && i.matches && i.matches('input[list]')) { const k = i.value.lastIndexOf(' — '); if (k >= 0) i.value = i.value.slice(k + 3).trim(); } }, true);
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { await cargarLocalidad(); listado = null; return abrir(null); }
      if (e.target.name === 'ir_envio' && /^\d+$/.test(e.target.value.trim())) { const { data } = await sb.from('envios_venta').select('*').eq('localidad_id', ctx.sel.loc).eq('numero', Number(e.target.value)).maybeSingle(); return data ? abrir(data) : window.FIN.aviso('No hay ese envío'); }
      const form = e.target.closest('.ve-form'); if (!form) return;
      leer();
      const k = e.target.name;
      if (k === 'cliente_codigo') { const c = clientes.find((x) => String(x.codigo) === e.target.value.trim()); if (c) return repintar({ cliente_id: c.id, cliente_codigo: c.codigo, nombre: c.nombre, nit: c.tipo_documento === 'CF' ? 'CF' : c.documento, telefono: c.telefono || '', contacto: c.contacto || '', direccion: c.direccion_envio || c.direccion || '', forma_pago: c.forma_pago || 'CONTADO', dias_credito: c.dias_credito || 0, tipo_precio_id: c.tipo_precio_id || null, bodega_id: c.bodega_id || null, fecha_cobro: c.forma_pago === 'CRÉDITO' ? sumar(c.dias_credito, form.elements.fecha.value) : '' }); }
      if (k === 'dias_credito' || k === 'forma_pago' || k === 'fecha') { const h = encabezado(form); return repintar({ fecha_cobro: h.forma_pago === 'CRÉDITO' ? sumar(h.dias_credito, h.fecha) : '' }); }
      const prod = e.target.closest('[data-l=producto]');
      if (prod) { const x = lineas[Number(prod.closest('tr').dataset.linea)]; const p = porCodigoProd(prod.value); if (p) { x.producto_id = p.id; x.producto_codigo = p.codigo; x.descripcion = p.nombre; x.lote = x.lote || p.lote || ''; const tp = Number(form.elements.tipo_precio_id.value) || null; const pr = tp ? precioDe(p.id, tp) : 0; if (pr) x.precio = pr; } else { x.producto_id = null; x.producto_codigo = prod.value.trim(); } return repintar(); }
      totalizar();
    });
    cont.addEventListener('input', (e) => { if (e.target.closest('.ve-form tr[data-linea]')) totalizar(); });
    cont.addEventListener('focusin', (e) => { const tr = e.target.closest('.ve-form tr[data-linea]'); if (!tr || Number(tr.dataset.linea) === lineaSel) return; leer(); lineaSel = Number(tr.dataset.linea); ctx.pDet.querySelectorAll('tr[data-linea]').forEach((x) => x.classList.toggle('actual', x === tr)); const a = ctx.pDet.querySelector('.vfd-lado'); if (a) a.innerHTML = lado(lineas[lineaSel], editable() ? '' : 'disabled'); });
    cont.addEventListener('click', async (e) => {
      const tab = e.target.closest('[data-pestana]');
      if (tab) { leer(); pestana = tab.dataset.pestana; editable() ? repintar() : pintar(); if (pestana === 'LISTADO' && !listado) { const { data } = await sb.from('envios_venta').select('*').eq('localidad_id', ctx.sel.loc).order('numero', { ascending: false }).limit(500); listado = data || []; editable() ? repintar() : pintar(); } return; }
      const ab = e.target.closest('[data-abrir]'); if (ab) { const { data } = await sb.from('envios_venta').select('*').eq('id', Number(ab.dataset.abrir)).single(); return data ? abrir(data) : null; }
      const q = e.target.closest('[data-quitar]'); if (q) { leer(); lineas.splice(Number(q.dataset.quitar), 1); if (!lineas.length) lineas.push(nuevaLinea()); lineaSel = 0; return repintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion; if (!a) return;
      if (a === 'nuevo') { pestana = 'PRODUCTOS'; return abrir(null); }
      if (a === 'modificar') { modificando = true; return pintar(); }
      if (a === 'cancelar') return abrir(actual);
      if (a === 'linea') { leer(); lineas.push(nuevaLinea()); lineaSel = lineas.length - 1; return repintar(); }
      if (a === 'imp-factura') return imprimirEnvio('FACTURA');
      if (a === 'imp-envio') return imprimirEnvio('ENVIO');
      if (a === 'anular') {
        if (!confirm(`¿Anular el envío ${actual.numero}?`)) return;
        const r = await sb.from('envios_venta').update({ estado: 'ANULADO', anulado_por: (ctx.yo.usuario || '').toUpperCase(), anulado_en: new Date().toISOString() }).eq('id', actual.id);
        if (r.error) return window.FIN.aviso(window.UI.traducirError(r.error));
        listado = null; const { data } = await sb.from('envios_venta').select('*').eq('id', actual.id).single(); return abrir(data);
      }
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.ve-form')) { e.preventDefault(); if (editable()) guardar(e.target); } });
    iniciar();
  };
})();
