// Facturación/Ventas · Procesos · Ventas Inteligentes (script 174):
//   Generar Ventas: parámetros organización, localidad, cliente y fecha; en el detalle los productos y cantidades con el
//   precio del tipo de precio del cliente (y el último que pagó), su existencia y el botón de existencias por bodega y
//   lote; sugiere lo que más compra el cliente y avisa su saldo vencido. «Nueva venta» limpia la pantalla; «Por voz»
//   pregunta el cliente, los productos y las cantidades. Cada venta se guarda con su estado:
//   GENERADA → CONFIRMADA → FACTURA PRELIMINAR → FACTURADA (al guardar la factura real), o ELIMINADA.
//   Al aceptar la factura preliminar la venta pasa a Facturas Ventas como factura nueva ya llenada.
//   Consulta de Ventas: las ventas por organización, localidad, fechas, cliente y estado, con sus totales y productos;
//   abre la venta en Generar Ventas o su factura; reportes en PDF y Excel.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const CLAVE = 'fin-venta-inteligente';
  const hace = (meses) => { const d = new Date(); d.setMonth(d.getMonth() - meses); return d.toISOString().slice(0, 10); };
  const cant = (n) => Number(n || 0).toLocaleString('es-GT', { maximumFractionDigits: 4 });
  const ESTADOS = [['GENERADA', 'Generada', 'ti-file-plus'], ['CONFIRMADA', 'Confirmada', 'ti-circle-check'], ['FACTURA PRELIMINAR', 'Factura preliminar', 'ti-file-invoice'], ['FACTURADA', 'Facturada', 'ti-receipt'], ['ELIMINADA', 'Eliminada', 'ti-trash']];
  const claseEstado = (e) => ({ GENERADA: 'gen', CONFIRMADA: 'conf', 'FACTURA PRELIMINAR': 'pre', FACTURADA: 'fac', ELIMINADA: 'eli', NUEVA: 'nueva' }[e] || 'nueva');
  const etqEstado = (e) => (ESTADOS.find((x) => x[0] === e) || [e, e === 'NUEVA' ? 'Nueva' : e])[1];
  const sinTabla = (e) => e && /ventas_inteligentes|venta_inteligente_lineas/.test(e.message || '');
  const AVISO = 'Falta ejecutar en Supabase el script 174 (Ventas Inteligentes).';
  const etqCli = (c) => `${c.nombre}${c.tipo_documento !== 'CF' && c.documento ? ` · NIT ${c.documento}` : ''} — ${c.codigo}`;
  const etqProd = (p) => `${p.nombre} — ${p.codigo_producto || p.codigo}`;

  // ===================== Generar Ventas =====================
  function generarVentas(cont, m, extra) {
    const ctx = montar(cont, { titulo: 'Generar Ventas', icono: 'ti-sparkles', clase: 'bk-movimientos bm-solo vi-pantalla', grupo: 'Ventas · Ventas Inteligentes' });
    const { sb } = ctx;
    const est = { clientes: [], productos: [], tipos: [], precios: [], exist: new Map(), bodegas: [], cliente: null, fecha: fmt.hoy(), lineas: [], venta: null, sugeridos: [], ultimos: new Map(), saldo: null, locCargada: null, origen: 'PANTALLA' };
    const prod = (id) => est.productos.find((p) => p.id === id);
    const tipoPrecio = () => est.cliente?.tipo_precio_id || est.tipos.find((t) => t.activo !== false)?.id || null;
    const precioDe = (pid) => Number(est.precios.find((x) => x.producto_id === pid && x.tipo_precio_id === tipoPrecio())?.precio || 0);
    const existencia = (pid) => Number(est.exist.get(pid) || 0);
    const conProd = () => est.lineas.filter((l) => l.producto_id);
    const total = () => fmt.redondear(conProd().reduce((t, l) => t + Number(l.cantidad || 0) * Number(l.precio || 0), 0));
    const nuevaLinea = () => ({ producto_id: null, texto: '', cantidad: 1, precio: 0 });
    const estado = () => est.venta?.estado || 'NUEVA';
    const editable = () => ['NUEVA', 'GENERADA'].includes(estado());

    function pintarFiltros() {
      const orgs = ctx.organizaciones, locs = ctx.localidades.filter((x) => x.organizacion_id === ctx.sel.org);
      const dis = editable() ? '' : 'disabled', e = estado();
      const b = (accion, icono, texto, clase = 'secundario-sm') => `<button type="button" class="boton ${clase}" data-accion="${accion}"><i class="ti ${icono}" aria-hidden="true"></i> ${texto}</button>`;
      const acciones = [b('nueva', 'ti-plus', 'Nueva venta'), b('voz', 'ti-microphone', 'Por voz', 'secundario-sm vi-voz')];
      if (e === 'NUEVA' || e === 'GENERADA') acciones.push(b('guardar', 'ti-device-floppy', 'Guardar'), b('confirmar', 'ti-circle-check', 'Confirmar', 'primario-sm'));
      if (e === 'CONFIRMADA') acciones.push(b('modificar', 'ti-pencil', 'Modificar'), b('preliminar', 'ti-file-invoice', 'Factura preliminar', 'primario-sm'));
      if (e === 'FACTURA PRELIMINAR') acciones.push(b('modificar', 'ti-pencil', 'Modificar'), b('preliminar', 'ti-file-invoice', 'Ver preliminar'), b('trasladar', 'ti-file-export', 'Trasladar a factura', 'primario-sm'));
      if (e === 'FACTURADA' && est.venta?.factura_id) acciones.push(b('factura', 'ti-receipt', 'Ver factura', 'primario-sm'));
      if (est.venta && !['FACTURADA', 'ELIMINADA'].includes(e)) acciones.push(b('eliminar', 'ti-trash', 'Eliminar', 'secundario-sm vi-eliminar'));
      ctx.pFil.innerHTML = `
        <div class="ta-titulo"><span class="tk-icono"><i class="ti ti-sparkles" aria-hidden="true"></i></span><div><small>Ventas Inteligentes</small><h2>Generar Ventas ${est.venta ? `<em class="vi-no">No. ${est.venta.numero}</em>` : ''}</h2></div></div>
        <label class="campo"><span>Organización</span><select name="org" ${est.venta ? 'disabled' : ''}>${orgs.map((o) => `<option value="${o.id}" ${o.id === ctx.sel.org ? 'selected' : ''}>${esc(String(o.codigo))} · ${esc(o.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Localidad</span><select name="loc" ${est.venta ? 'disabled' : ''}>${locs.map((l) => `<option value="${l.id}" ${l.id === ctx.sel.loc ? 'selected' : ''}>${esc(l.codigo)} · ${esc(l.nombre_comercial)}</option>`).join('')}</select></label>
        <label class="campo vi-cli"><span>Nombre del cliente</span><input name="cliente" list="vi-clientes" value="${esc(est.cliente ? etqCli(est.cliente) : '')}" placeholder="Buscar por nombre, NIT o código" autocomplete="off" ${dis}>
          <datalist id="vi-clientes">${est.clientes.map((c) => `<option ${c.estado === 'INACTIVO' ? 'label="Inactivo" ' : ''}value="${esc(etqCli(c))}"></option>`).join('')}</datalist></label>
        <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(est.fecha)}" ${dis}></label>
        <div class="vi-estado"><span>Estado</span><b class="vi-est ${claseEstado(e)}"><i class="ti ${(ESTADOS.find((x) => x[0] === e) || [, , 'ti-point'])[2]}" aria-hidden="true"></i> ${esc(etqEstado(e))}</b></div>
        <div class="oc-extra vi-acciones">${acciones.join('')}</div>`;
    }

    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      if (!loc) { pintarFiltros(); ctx.pDet.innerHTML = ctx.vacio('Elige la localidad.', 'ti-sparkles'); return; }
      if (est.locCargada === loc) return;
      ctx.pDet.innerHTML = '<p class="vacio">Cargando clientes, productos, precios y existencias…</p>';
      const [c, p, t, pr, ex, b] = await Promise.all([
        window.UI.todo(sb.from('clientes').select('id, codigo, nombre, documento, tipo_documento, tipo_precio_id, forma_pago, dias_credito, vendedor_id, bodega_id, estado').eq('localidad_id', loc).order('nombre').order('id')),
        window.UI.todo(sb.from('productos').select('id, codigo, codigo_producto, nombre, estado').eq('localidad_id', loc).order('nombre').order('id')),
        sb.from('tipos_precio').select('id, codigo, nombre, activo').eq('localidad_id', loc).order('codigo'),
        window.UI.todo(sb.from('producto_precios').select('producto_id, tipo_precio_id, precio').eq('localidad_id', loc).order('producto_id').order('tipo_precio_id')),
        window.UI.todo(sb.from('existencias').select('producto_id, bodega_id, existencia').eq('localidad_id', loc).order('producto_id').order('bodega_id')),
        sb.from('bodegas').select('id, codigo, nombre').eq('localidad_id', loc).order('codigo')
      ]);
      est.clientes = c.data || []; est.productos = p.data || []; est.tipos = t.data || []; est.precios = pr.data || []; est.bodegas = b.data || [];
      est.exist = new Map();
      (ex.data || []).forEach((x) => est.exist.set(x.producto_id, (est.exist.get(x.producto_id) || 0) + Number(x.existencia || 0)));
      est.locCargada = loc;
    }
    function nueva() {
      est.venta = null; est.cliente = null; est.fecha = fmt.hoy(); est.lineas = [nuevaLinea()]; est.sugeridos = []; est.ultimos = new Map(); est.saldo = null; est.origen = 'PANTALLA';
      if (location.hash !== '#/facturacion/generar-ventas') history.replaceState(null, '', '#/facturacion/generar-ventas');
      pintarFiltros(); pintar();
    }
    async function abrirVenta(id) {
      const [v, l] = await Promise.all([sb.from('ventas_inteligentes').select('*').eq('id', id).maybeSingle(), sb.from('venta_inteligente_lineas').select('*').eq('venta_id', id).order('linea')]);
      if (v.error) return window.FIN.aviso(sinTabla(v.error) ? AVISO : v.error.message);
      if (!v.data) return nueva();
      if (v.data.localidad_id !== ctx.sel.loc) { ctx.sel.org = v.data.organizacion_id; ctx.sel.loc = v.data.localidad_id; await cargarLocalidad(); }
      est.venta = v.data; est.fecha = v.data.fecha; est.origen = v.data.origen || 'PANTALLA';
      est.lineas = (l.data || []).map((x) => ({ producto_id: x.producto_id, texto: x.producto_id ? '' : x.descripcion, cantidad: Number(x.cantidad), precio: Number(x.precio) }));
      if (editable()) est.lineas.push(nuevaLinea());
      await elegirCliente(est.clientes.find((c) => c.id === v.data.cliente_id) || null, false);
    }

    // Al elegir el cliente: lo que más compra (12 meses) con su último precio, y su saldo pendiente y vencido.
    async function elegirCliente(c, precios = true) {
      est.cliente = c; est.sugeridos = []; est.ultimos = new Map(); est.saldo = null;
      if (precios) est.lineas.forEach((l) => { if (l.producto_id) l.precio = precioDe(l.producto_id) || l.precio; });
      pintarFiltros(); pintar();
      if (!c) return;
      const [h, s] = await Promise.all([
        window.UI.todo(sb.from('factura_venta_lineas').select('producto_id, cantidad, precio, facturas_venta!inner(cliente_id, fecha_emision, estado)').eq('facturas_venta.cliente_id', c.id).neq('facturas_venta.estado', 'ANULADA').gte('facturas_venta.fecha_emision', `${hace(12)}T00:00:00-06:00`).order('id')),
        window.UI.todo(sb.from('facturas_venta').select('id, saldo, fecha_emision, fecha_cobro, dias_credito').eq('cliente_id', c.id).neq('estado', 'ANULADA').gt('saldo', 0).order('id'))
      ]);
      if (est.cliente !== c) return;
      const g = new Map();
      (h.data || []).forEach((x) => {
        if (!x.producto_id) return;
        const a = g.get(x.producto_id) || { producto_id: x.producto_id, veces: 0, cantidad: 0, ultimo: null, fecha: '' };
        a.veces++; a.cantidad += Number(x.cantidad || 0);
        if (x.facturas_venta.fecha_emision >= a.fecha) { a.fecha = x.facturas_venta.fecha_emision; a.ultimo = Number(x.precio || 0); }
        g.set(x.producto_id, a);
      });
      est.ultimos = new Map([...g.values()].map((a) => [a.producto_id, a.ultimo]));
      est.sugeridos = [...g.values()].filter((a) => prod(a.producto_id)).sort((a, b) => b.veces - a.veces || b.cantidad - a.cantidad).slice(0, 8);
      const hoy = fmt.hoy();
      const fs = s.data || [];
      const venc = (f) => f.fecha_cobro || new Date(new Date(f.fecha_emision).getTime() + Number(f.dias_credito || 0) * 864e5).toISOString().slice(0, 10);
      est.saldo = { total: fs.reduce((t, f) => t + Number(f.saldo), 0), vencido: fs.filter((f) => venc(f) < hoy).reduce((t, f) => t + Number(f.saldo), 0), facturas: fs.length };
      pintar();
    }

    function pintar() {
      if (!ctx.sel.loc) return;
      const c = est.cliente, ed = editable(), dis = ed ? '' : 'disabled', e = estado();
      const tot = total(), iva = fmt.redondear(tot / 1.12 * 0.12);
      const faltan = conProd().filter((l) => Number(l.cantidad) > existencia(l.producto_id));
      const tp = est.tipos.find((t) => t.id === tipoPrecio());
      const PASOS = ['GENERADA', 'CONFIRMADA', 'FACTURA PRELIMINAR', 'FACTURADA'];
      const iEt = e === 'NUEVA' ? -1 : PASOS.indexOf(e);
      ctx.pDet.innerHTML = `
        <div class="vi">
          <section class="vi-main">
            ${e === 'ELIMINADA' ? `<p class="vi-eliminada"><i class="ti ti-trash" aria-hidden="true"></i> Venta eliminada${est.venta?.motivo_eliminacion ? `: ${esc(est.venta.motivo_eliminacion)}` : ''}.</p>`
              : `<ol class="vi-pasos">${PASOS.map((k, i) => `<li class="${i < iEt || e === 'FACTURADA' ? 'hecho' : i === iEt ? 'actual' : ''}"><span>${i < iEt || e === 'FACTURADA' ? '<i class="ti ti-check" aria-hidden="true"></i>' : i + 1}</span>${etqEstado(k)}</li>`).join('')}</ol>`}
            ${ed && est.sugeridos.length ? `<div class="vi-sug"><b><i class="ti ti-bulb" aria-hidden="true"></i> Lo que más compra este cliente</b>${est.sugeridos.map((s) => `<button type="button" class="vi-chip" data-sugerido="${s.producto_id}" title="${s.veces} compra(s) en 12 meses · último precio ${fmt.monto(s.ultimo)}"><i class="ti ti-plus" aria-hidden="true"></i> ${esc(prod(s.producto_id).nombre)}</button>`).join('')}</div>` : ''}
            <div class="vi-tabla"><table>
              <thead><tr><th>#</th><th>Producto</th><th class="num">Existencia</th><th class="num">Cantidad</th><th class="num">Precio</th><th class="num">Total</th><th></th></tr></thead>
              <tbody>${est.lineas.map((l, i) => { const p = l.producto_id && prod(l.producto_id); const ex = p ? existencia(p.id) : null; const ult = p && est.ultimos.get(p.id);
                return `<tr data-i="${i}" class="${p && ed && Number(l.cantidad) > ex ? 'vi-falta' : ''}">
                  <td class="vi-n">${i + 1}</td>
                  <td class="vi-prod"><input data-l="producto" list="vi-productos" value="${esc(p ? etqProd(p) : l.texto)}" placeholder="Nombre o código del producto" autocomplete="off" ${dis}>${ult ? `<small>Último precio al cliente: ${fmt.monto(ult)}</small>` : ''}</td>
                  <td class="num vi-ex">${p ? `<span class="vi-badge ${ex <= 0 ? 'no' : Number(l.cantidad) > ex ? 'poco' : 'si'}">${cant(ex)}</span><button type="button" class="icono-boton" data-existencias="${p.id}" title="Ver existencias por bodega y lote" aria-label="Ver existencias de ${esc(p.nombre)}"><i class="ti ti-packages" aria-hidden="true"></i></button>` : ''}</td>
                  <td class="num"><input type="number" min="0" step="any" data-l="cantidad" value="${esc(String(l.cantidad))}" ${dis}></td>
                  <td class="num"><input type="number" min="0" step="any" data-l="precio" value="${esc(String(l.precio))}" ${dis}></td>
                  <td class="num vi-tot" data-tot>${fmt.monto(Number(l.cantidad || 0) * Number(l.precio || 0))}</td>
                  <td>${ed && est.lineas.length > 1 ? `<button type="button" class="icono-boton" data-quitar="${i}" aria-label="Quitar línea ${i + 1}"><i class="ti ti-trash" aria-hidden="true"></i></button>` : ''}</td></tr>`; }).join('')}</tbody>
            </table></div>
            <datalist id="vi-productos">${est.productos.filter((p) => p.estado !== 'INACTIVO').map((p) => `<option value="${esc(etqProd(p))}" label="Existencia ${cant(existencia(p.id))}"></option>`).join('')}</datalist>
            ${ed ? '<button type="button" class="boton secundario-sm vi-agregar" data-accion="agregar"><i class="ti ti-plus" aria-hidden="true"></i> Agregar producto</button>' : ''}
          </section>
          <aside class="vi-lado">
            <section class="vi-card">
              <h3><i class="ti ti-user" aria-hidden="true"></i> Cliente</h3>
              ${c ? `<b class="vi-nom">${esc(c.nombre)}</b>
                <dl class="vi-dl"><div><dt>NIT</dt><dd>${esc(c.tipo_documento === 'CF' ? 'CF' : c.documento || '—')}</dd></div><div><dt>Pago</dt><dd>${esc(c.forma_pago || 'CONTADO')}${c.forma_pago === 'CRÉDITO' ? ` · ${c.dias_credito || 0} días` : ''}</dd></div>
                  <div><dt>Tipo de precio</dt><dd>${esc(tp ? tp.nombre : '—')}</dd></div><div><dt>Saldo pendiente</dt><dd>${est.saldo ? fmt.monto(est.saldo.total) : '…'}</dd></div></dl>
                ${est.saldo?.vencido > 0.004 ? `<p class="vi-alerta"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Tiene ${fmt.monto(est.saldo.vencido)} vencido.</p>` : ''}`
                : est.venta ? `<b class="vi-nom">${esc(est.venta.nombre)}</b>` : '<p class="rg-nota">Elige el cliente en los parámetros, o usa «Por voz».</p>'}
            </section>
            <section class="vi-card vi-res">
              <h3><i class="ti ti-receipt" aria-hidden="true"></i> Resumen</h3>
              <div><span>Productos</span><b>${conProd().length}</b></div>
              <div><span>Subtotal sin IVA</span><b data-r="sub">${fmt.monto(tot - iva)}</b></div>
              <div><span>IVA (12 %)</span><b data-r="iva">${fmt.monto(iva)}</b></div>
              <div class="vi-total"><span>Total</span><b data-r="tot">Q ${fmt.monto(tot)}</b></div>
              ${ed && faltan.length ? `<p class="vi-alerta"><i class="ti ti-packages" aria-hidden="true"></i> ${faltan.length} producto(s) con existencia insuficiente.</p>` : ''}
              ${est.venta ? `<p class="vi-quien">Venta No. ${est.venta.numero} · ${esc(est.venta.creado_por_nombre || '')}${est.origen === 'VOZ' ? ' · por voz' : ''}</p>` : ''}
            </section>
          </aside>
        </div>`;
    }

    function leer() {
      ctx.pDet.querySelectorAll('tr[data-i]').forEach((tr) => {
        const l = est.lineas[Number(tr.dataset.i)];
        l.cantidad = Number(tr.querySelector('[data-l=cantidad]').value) || 0;
        l.precio = Number(tr.querySelector('[data-l=precio]').value) || 0;
        tr.querySelector('[data-tot]').textContent = fmt.monto(l.cantidad * l.precio);
      });
      const tot = total(), iva = fmt.redondear(tot / 1.12 * 0.12);
      const r = (k, v) => { const e = ctx.pDet.querySelector(`[data-r=${k}]`); if (e) e.textContent = v; };
      r('sub', fmt.monto(tot - iva)); r('iva', fmt.monto(iva)); r('tot', `Q ${fmt.monto(tot)}`);
    }
    function ponerProducto(l, p) {
      l.producto_id = p ? p.id : null; l.texto = '';
      if (p) l.precio = precioDe(p.id) || est.ultimos.get(p.id) || l.precio || 0;
    }
    function agregarProducto(p, cantidad = 1) {
      const ya = est.lineas.find((l) => l.producto_id === p.id);
      if (ya) { ya.cantidad = Number(ya.cantidad || 0) + Number(cantidad); return; }
      let l = est.lineas.find((x) => !x.producto_id && !x.texto);
      if (!l) { l = nuevaLinea(); est.lineas.push(l); }
      ponerProducto(l, p); l.cantidad = Number(cantidad);
      if (est.lineas[est.lineas.length - 1] === l) est.lineas.push(nuevaLinea());
    }

    // Revisa la venta antes de guardar o confirmar (confirmar también revisa precios y existencias).
    function validar(confirmando) {
      leer();
      if (!est.cliente) { window.FIN.aviso('Elige el cliente'); return false; }
      const malas = est.lineas.filter((l) => !l.producto_id && (l.texto || '').trim());
      if (malas.length) { window.FIN.aviso(`«${malas[0].texto}» no está en el catálogo de productos`); return false; }
      if (!conProd().length) { window.FIN.aviso('Agrega al menos un producto'); return false; }
      const sinCant = conProd().find((l) => !(Number(l.cantidad) > 0));
      if (sinCant) { window.FIN.aviso(`Indica la cantidad de ${prod(sinCant.producto_id).nombre}`); return false; }
      if (!confirmando) return true;
      const sinPrecio = conProd().find((l) => !(Number(l.precio) > 0));
      if (sinPrecio) { window.FIN.aviso(`${prod(sinPrecio.producto_id).nombre} no tiene precio`); return false; }
      const faltan = conProd().filter((l) => Number(l.cantidad) > existencia(l.producto_id));
      if (faltan.length && !confirm(`${faltan.length} producto(s) no tienen existencia suficiente (por ejemplo ${prod(faltan[0].producto_id).nombre}: hay ${cant(existencia(faltan[0].producto_id))}). ¿Confirmar de todos modos?`)) return false;
      return true;
    }
    // Guarda la venta (encabezado y productos) con su estado.
    async function guardar(estadoNuevo) {
      const c = est.cliente;
      const h = { organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, fecha: est.fecha, cliente_id: c.id, cliente_codigo: String(c.codigo ?? ''), nombre: c.nombre,
        nit: c.tipo_documento === 'CF' ? 'CF' : c.documento || null, vendedor_id: c.vendedor_id || null, estado: estadoNuevo, total: total(), origen: est.origen };
      let id = est.venta?.id;
      const r = id ? await sb.from('ventas_inteligentes').update(h).eq('id', id).select().single() : await sb.from('ventas_inteligentes').insert(h).select().single();
      if (r.error) { window.FIN.aviso(sinTabla(r.error) ? AVISO : window.UI.traducirError(r.error)); return false; }
      id = r.data.id;
      const d = await sb.from('venta_inteligente_lineas').delete().eq('venta_id', id);
      if (d.error) { window.FIN.aviso(window.UI.traducirError(d.error)); return false; }
      const ins = await sb.from('venta_inteligente_lineas').insert(conProd().map((l, i) => { const p = prod(l.producto_id); return { venta_id: id, linea: i + 1, producto_id: p.id, producto_codigo: String(p.codigo_producto || p.codigo), descripcion: p.nombre, cantidad: Number(l.cantidad), precio: Number(l.precio) }; }));
      if (ins.error) { window.FIN.aviso(window.UI.traducirError(ins.error)); return false; }
      est.venta = r.data;
      if (location.hash !== `#/facturacion/generar-ventas/${id}`) history.replaceState(null, '', `#/facturacion/generar-ventas/${id}`);
      return true;
    }
    async function cambiarEstado(nuevo, extra = {}) {
      const r = await sb.from('ventas_inteligentes').update({ estado: nuevo, ...extra }).eq('id', est.venta.id).select().single();
      if (r.error) { window.FIN.aviso(window.UI.traducirError(r.error)); return false; }
      est.venta = r.data; return true;
    }

    async function verExistencias(pid) {
      const p = prod(pid);
      const { data } = await window.UI.todo(sb.from('inventario_movimientos').select('bodega_id, lote, fecha_vencimiento, cantidad').eq('localidad_id', ctx.sel.loc).eq('producto_id', pid).order('id'));
      const g = new Map();
      (data || []).forEach((x) => { const k = `${x.bodega_id}|${x.lote || ''}`; const a = g.get(k) || { bodega: x.bodega_id, lote: x.lote || '', vence: x.fecha_vencimiento, q: 0 }; a.q += Number(x.cantidad || 0); if (x.fecha_vencimiento) a.vence = x.fecha_vencimiento; g.set(k, a); });
      const filas = [...g.values()].filter((a) => Math.abs(a.q) > 0.00005).sort((a, b) => String(a.vence || '9').localeCompare(String(b.vence || '9')));
      const bod = (id) => est.bodegas.find((b) => b.id === id);
      const velo = document.createElement('div');
      velo.className = 'modal-velo';
      velo.innerHTML = `<div class="modal vi-modal" role="dialog" aria-modal="true" aria-labelledby="vi-ex-t">
        <header class="modal-cab"><h2 id="vi-ex-t"><i class="ti ti-packages" aria-hidden="true"></i> Existencias · ${esc(p.nombre)}</h2><button type="button" class="icono-boton" data-cerrar aria-label="Cerrar"><i class="ti ti-x" aria-hidden="true"></i></button></header>
        <div class="vi-modal-cuerpo">
          <p class="vi-ex-total">Existencia total: <b>${cant(existencia(pid))}</b></p>
          ${filas.length ? `<table class="vi-ex-tabla"><thead><tr><th>Bodega</th><th>Lote</th><th>Vence</th><th class="num">Existencia</th></tr></thead><tbody>${filas.map((a) => `<tr class="${a.vence && a.vence < fmt.hoy() ? 'vi-vencido' : ''}"><td>${esc(bod(a.bodega) ? `${bod(a.bodega).codigo} · ${bod(a.bodega).nombre}` : String(a.bodega))}</td><td>${esc(a.lote || '—')}</td><td>${a.vence ? esc(fmt.fechaDia(a.vence)) : '—'}</td><td class="num">${cant(a.q)}</td></tr>`).join('')}</tbody></table>` : '<p class="rg-nota">Sin existencias registradas por lote.</p>'}
        </div>
        <footer class="modal-pie"><button type="button" class="boton primario-sm" data-cerrar>Cerrar</button></footer></div>`;
      document.body.appendChild(velo);
      const fin = () => velo.remove();
      velo.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', fin));
      velo.addEventListener('click', (e) => { if (e.target === velo) fin(); });
      velo.addEventListener('keydown', (e) => { if (e.key === 'Escape') fin(); });
      velo.querySelector('[data-cerrar]').focus();
    }

    // Factura preliminar: vista del documento; al aceptarla, la venta pasa a Facturas Ventas.
    function preliminar() {
      const c = est.cliente || { nombre: est.venta.nombre, documento: est.venta.nit, tipo_documento: est.venta.nit === 'CF' ? 'CF' : 'NIT', forma_pago: '' };
      const tot = total(), iva = fmt.redondear(tot / 1.12 * 0.12);
      const loc = ctx.localidad(ctx.sel.loc), org = ctx.organizaciones.find((o) => o.id === ctx.sel.org);
      const velo = document.createElement('div');
      velo.className = 'modal-velo';
      velo.innerHTML = `<div class="modal vi-modal vi-pre" role="dialog" aria-modal="true" aria-labelledby="vi-pre-t">
        <header class="modal-cab"><h2 id="vi-pre-t"><i class="ti ti-file-invoice" aria-hidden="true"></i> Factura preliminar · venta No. ${est.venta.numero}</h2><button type="button" class="icono-boton" data-cerrar aria-label="Cerrar"><i class="ti ti-x" aria-hidden="true"></i></button></header>
        <div class="vi-modal-cuerpo">
          <div class="vi-doc">
            <div class="vi-doc-cab"><div><b>${esc(loc ? loc.nombre_comercial : '')}</b><small>${esc(org ? org.nombre : '')} · ${esc(loc ? loc.codigo : '')}</small></div><div class="vi-doc-sello">PRELIMINAR<small>Sin validez fiscal</small></div></div>
            <dl class="vi-doc-dl"><div><dt>Cliente</dt><dd>${esc(c.nombre)}</dd></div><div><dt>NIT</dt><dd>${esc(c.tipo_documento === 'CF' ? 'CF' : c.documento || '—')}</dd></div><div><dt>Fecha</dt><dd>${esc(fmt.fechaDia(est.fecha))}</dd></div><div><dt>Pago</dt><dd>${esc(c.forma_pago || 'CONTADO')}</dd></div></dl>
            <table><thead><tr><th>#</th><th>Código</th><th>Descripción</th><th class="num">Cantidad</th><th class="num">Precio</th><th class="num">Total</th></tr></thead>
              <tbody>${conProd().map((l, i) => { const p = prod(l.producto_id); return `<tr><td>${i + 1}</td><td>${esc(String(p.codigo_producto || p.codigo))}</td><td>${esc(p.nombre)}</td><td class="num">${cant(l.cantidad)}</td><td class="num">${fmt.monto(l.precio)}</td><td class="num">${fmt.monto(l.cantidad * l.precio)}</td></tr>`; }).join('')}</tbody>
              <tfoot><tr><td colspan="5">Subtotal sin IVA</td><td class="num">${fmt.monto(tot - iva)}</td></tr><tr><td colspan="5">IVA (12 %)</td><td class="num">${fmt.monto(iva)}</td></tr><tr class="vi-doc-tot"><td colspan="5">Total</td><td class="num">Q ${fmt.monto(tot)}</td></tr></tfoot></table>
          </div>
        </div>
        <footer class="modal-pie vi-pre-pie">${pie()}</footer></div>`;
      document.body.appendChild(velo);
      const cerrar = () => { velo.remove(); pintarFiltros(); pintar(); };
      velo.querySelector('[data-cerrar]').addEventListener('click', cerrar);
      velo.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
      // Regresar: cierra la preliminar sin cambiar la venta. Aceptar: la venta queda en FACTURA PRELIMINAR y se pregunta
      // si se traslada a la factura o se deja pendiente. Trasladar a factura: pasa a Facturas Ventas.
      velo.querySelector('.vi-pre-pie').addEventListener('click', async (e) => {
        const a = e.target.closest('[data-pre]')?.dataset.pre;
        if (a === 'regresar') return cerrar();
        if (a === 'pendiente') { cerrar(); return window.FIN.aviso(`Venta No. ${est.venta.numero}: factura preliminar aceptada y pendiente de trasladar a la factura`); }
        if (a === 'trasladar') { velo.remove(); return trasladar(); }
        if (a === 'aceptar') {
          e.target.closest('button').disabled = true;
          if (!(await cambiarEstado('FACTURA PRELIMINAR'))) { e.target.closest('button').disabled = false; return; }
          pintarFiltros(); pintar();
          const pie = velo.querySelector('.vi-pre-pie');
          pie.innerHTML = `<p class="vi-pre-pregunta"><i class="ti ti-circle-check" aria-hidden="true"></i> Factura preliminar aceptada. ¿Desea trasladarla a la factura o dejarla pendiente?</p>
            <button type="button" class="boton secundario-sm" data-pre="pendiente"><i class="ti ti-clock-pause" aria-hidden="true"></i> Dejar pendiente</button>
            <button type="button" class="boton primario-sm" data-pre="trasladar"><i class="ti ti-file-export" aria-hidden="true"></i> Trasladar a factura</button>`;
          pie.querySelector('[data-pre=trasladar]').focus();
        }
      });
      velo.querySelector('.vi-pre-pie [data-pre]:last-child').focus();
    }
    function pie() {
      return estado() === 'FACTURA PRELIMINAR'
        ? '<button type="button" class="boton secundario-sm" data-pre="regresar"><i class="ti ti-arrow-left" aria-hidden="true"></i> Regresar</button><button type="button" class="boton primario-sm" data-pre="trasladar"><i class="ti ti-file-export" aria-hidden="true"></i> Trasladar a factura</button>'
        : '<button type="button" class="boton secundario-sm" data-pre="regresar"><i class="ti ti-arrow-left" aria-hidden="true"></i> Regresar</button><button type="button" class="boton primario-sm" data-pre="aceptar"><i class="ti ti-check" aria-hidden="true"></i> Aceptar</button>';
    }
    // Pasa la venta a Facturas Ventas como factura nueva ya llenada (al registrarla, la venta queda FACTURADA).
    function trasladar() {
      const datos = { venta_id: est.venta.id, org: ctx.sel.org, loc: ctx.sel.loc, cliente_id: est.venta.cliente_id, fecha: est.fecha,
        lineas: conProd().map((l) => { const p = prod(l.producto_id); return { producto_id: p.id, producto_codigo: p.codigo, descripcion: p.nombre, cantidad: Number(l.cantidad), precio: Number(l.precio) }; }) };
      try { sessionStorage.setItem(CLAVE, JSON.stringify(datos)); } catch { /* sin almacenamiento */ }
      window.VENTA_INTELIGENTE = datos;
      location.hash = '#/facturacion/facturas-ventas/inteligente';
    }

    // Nueva venta por voz: cliente, productos y cantidades; al final la guarda o la confirma.
    async function porVoz() {
      const V = window.VOZ;
      if (!V) return window.FIN.aviso('Falta cargar el asistente por voz');
      nueva();
      const loc = ctx.localidad(ctx.sel.loc);
      const conv = V.conversacion({ titulo: 'Nueva venta por voz', subtitulo: loc ? `${loc.codigo} · ${loc.nombre_comercial}` : '' });
      try {
        const c = await conv.preguntar('¿Para qué cliente es la venta?', (t) => V.mejor(t, est.clientes, (x) => x.nombre, 0.5) || est.clientes.find((x) => String(x.codigo) === V.norm(t) || String(x.documento || '').toLowerCase() === V.norm(t)) || undefined);
        conv.decir(`Cliente: ${c.nombre.replace(/.$/, '')}.`);
        await elegirCliente(c);
        for (;;) {
          const sug = est.sugeridos.slice(0, 4).map((s) => prod(s.producto_id).nombre);
          const activos = est.productos.filter((x) => x.estado !== 'INACTIVO');
          let candidatos = [];
          let p = await conv.preguntar('¿Qué producto?', (t) => {
            const d = V.norm(t);
            const cod = activos.find((x) => V.norm(String(x.codigo_producto || '')) === d);
            if (cod) return cod;
            // Varios productos con ese nombre (p. ej. «omeprazol»): se pregunta cuál.
            candidatos = d.length >= 4 ? activos.filter((x) => V.norm(x.nombre).includes(d)) : [];
            if (candidatos.length > 1) return 'VARIOS';
            return candidatos[0] || V.mejor(t, activos, (x) => x.nombre, 0.5) || undefined;
          }, sug);
          if (p === 'VARIOS') {
            const lista = candidatos.sort((a, b) => existencia(b.id) - existencia(a.id)).slice(0, 6);
            p = await conv.preguntar(`Hay ${candidatos.length} productos con ese nombre. ¿Cuál? ${candidatos.length > 6 ? 'Le muestro los 6 con más existencia.' : ''}`,
              (t) => { const n = V.numero(t); return (n && lista[n - 1]) || V.mejor(t, lista, (x) => x.nombre, 0.34) || undefined; },
              lista.map((x, i) => `${i + 1}. ${x.nombre} · ${x.codigo_producto || x.codigo} (${cant(existencia(x.id))})`));
          }
          const q = await conv.preguntar(`¿Cuántas unidades de ${p.nombre}? Hay ${cant(existencia(p.id))} en existencia.`, (t) => { const n = V.numero(t); return n > 0 ? n : undefined; }, ['1', '5', '10', '12']);
          agregarProducto(p, q); pintar();
          const precio = est.lineas.find((l) => l.producto_id === p.id)?.precio || 0;
          conv.decir(`${q} de ${p.nombre}${precio ? ` a ${fmt.monto(precio)}` : ' (sin precio en su tipo de precio)'}.`);
          if (!(await conv.preguntar('¿Agrega otro producto?', V.si, ['Sí', 'No']))) break;
        }
        const resumen = `Venta para ${c.nombre}: ${conProd().length} producto(s) por ${fmt.monto(total())} quetzales.`;
        const fin = await conv.preguntar(`${resumen} ¿La guardo, la confirmo o la dejo en pantalla para revisarla?`, (t) => { const s = V.norm(t); return /confirm/.test(s) ? 'CONFIRMAR' : /guard/.test(s) ? 'GUARDAR' : /revis|pantalla|dejar|deja/.test(s) ? 'REVISAR' : undefined; }, ['Confirmar', 'Guardar', 'Revisar en pantalla']);
        est.origen = 'VOZ';
        if (fin === 'REVISAR') { conv.decir('Listo: revise la venta en pantalla.'); await conv.hablar('Listo: revise la venta en pantalla.'); }
        else {
          const confirmando = fin === 'CONFIRMAR';
          const ok = validar(confirmando) && (await guardar(confirmando ? 'CONFIRMADA' : 'GENERADA'));
          const msj = ok ? `Venta número ${est.venta.numero} ${confirmando ? 'confirmada' : 'guardada'}.` : 'No se pudo guardar: revise la venta en pantalla.';
          conv.decir(msj); await conv.hablar(msj);
          if (ok && editable()) est.lineas.push(nuevaLinea());
        }
        pintarFiltros(); pintar();
        setTimeout(() => conv.cerrar(), 1500);
      } catch (e) { conv.cerrar(); if (e.message !== 'cancelado') window.FIN.aviso(e.message); pintarFiltros(); pintar(); }
    }

    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { await cargarLocalidad(); return nueva(); }
      const t = e.target;
      if (t.name === 'fecha') { est.fecha = t.value || fmt.hoy(); return; }
      if (t.name === 'cliente') {
        const v = t.value.trim().toUpperCase();
        let c = v ? est.clientes.find((x) => etqCli(x).toUpperCase() === v || String(x.codigo) === v || String(x.documento || '').toUpperCase() === v || x.nombre.toUpperCase() === v) : null;
        if (v && !c) { const parc = est.clientes.filter((x) => x.nombre.toUpperCase().includes(v)); if (parc.length === 1) c = parc[0]; }
        if (v && !c) window.FIN.aviso('Ese cliente no está en el catálogo de la localidad');
        return elegirCliente(c || null);
      }
      if (t.dataset.l === 'producto') {
        leer();
        const l = est.lineas[Number(t.closest('tr').dataset.i)];
        const v = t.value.trim().toUpperCase();
        let p = v ? est.productos.find((x) => etqProd(x).toUpperCase() === v || String(x.codigo_producto || '').toUpperCase() === v || String(x.codigo) === v) : null;
        if (v && !p) { const parc = est.productos.filter((x) => x.nombre.toUpperCase().includes(v)); if (parc.length === 1) p = parc[0]; }
        ponerProducto(l, p); if (!p) l.texto = t.value;
        if (p && est.lineas[est.lineas.length - 1] === l) est.lineas.push(nuevaLinea());
        pintar();
        if (p) ctx.pDet.querySelector(`tr[data-i="${est.lineas.indexOf(l)}"] [data-l=cantidad]`)?.select();
      }
    });
    cont.addEventListener('input', (e) => { if (e.target.dataset.l === 'cantidad' || e.target.dataset.l === 'precio') leer(); });
    cont.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-accion]');
      const a = b?.dataset.accion;
      if (a) {
        if (a === 'agregar') { leer(); est.lineas.push(nuevaLinea()); pintar(); ctx.pDet.querySelector('tr[data-i]:last-child [data-l=producto]')?.focus(); return; }
        if (a === 'nueva') return nueva();
        if (a === 'voz') return porVoz();
        if (a === 'factura') { location.hash = `#/facturacion/facturas-ventas/${est.venta.factura_id}`; return; }
        b.disabled = true;
        try {
          if (a === 'guardar' && validar(false) && (await guardar('GENERADA'))) { est.lineas = est.lineas.filter((l) => l.producto_id); est.lineas.push(nuevaLinea()); window.FIN.aviso(`Venta No. ${est.venta.numero} guardada (generada)`); }
          if (a === 'confirmar' && validar(true) && (await guardar('CONFIRMADA'))) { est.lineas = conProd(); window.FIN.aviso(`Venta No. ${est.venta.numero} confirmada: genera su factura preliminar`); }
          if (a === 'modificar' && (await cambiarEstado('GENERADA'))) { est.lineas.push(nuevaLinea()); window.FIN.aviso('La venta vuelve a generada para modificarla'); }
          if (a === 'preliminar') return preliminar();
          if (a === 'trasladar') return trasladar();
          if (a === 'eliminar') {
            const motivo = prompt(`¿Eliminar la venta No. ${est.venta.numero}? Escribe el motivo:`);
            if (motivo === null) return;
            if (await cambiarEstado('ELIMINADA', { motivo_eliminacion: motivo.trim() || null })) { est.lineas = conProd(); window.FIN.aviso(`Venta No. ${est.venta.numero} eliminada`); }
          }
        } finally { b.disabled = false; }
        pintarFiltros(); pintar();
        return;
      }
      const q = e.target.closest('[data-quitar]');
      if (q) { leer(); est.lineas.splice(Number(q.dataset.quitar), 1); return pintar(); }
      const s = e.target.closest('[data-sugerido]');
      if (s) { leer(); agregarProducto(prod(Number(s.dataset.sugerido)), 1); return pintar(); }
      const x = e.target.closest('[data-existencias]');
      if (x) return verExistencias(Number(x.dataset.existencias));
    });

    (async () => {
      if (!(await ctx.cargarBase())) return;
      await cargarLocalidad();
      if (extra && /^\d+$/.test(String(extra))) return abrirVenta(Number(extra));
      nueva();
    })();
  }
  window.PANTALLAS['generar-ventas'] = generarVentas;
  window.PANTALLAS['ventas-inteligentes'] = generarVentas;

  // ===================== Consulta de Ventas =====================
  window.PANTALLAS['consulta-ventas'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Consulta de Ventas', icono: 'ti-file-search', clase: 'bk-movimientos bm-solo vic-pantalla', grupo: 'Ventas · Ventas Inteligentes' });
    const { sb } = ctx;
    const primero = () => `${fmt.hoy().slice(0, 7)}-01`;
    const f = { desde: primero(), hasta: fmt.hoy(), cliente: '', estado: '', orden: 'numero:desc' };
    let ventas = [], sel = null, lineas = [], turno = 0;
    const ORDENES = [['numero:desc', 'Número ↓'], ['numero:asc', 'Número ↑'], ['fecha:desc', 'Fecha ↓'], ['fecha:asc', 'Fecha ↑'], ['total:desc', 'Total ↓'], ['nombre:asc', 'Cliente A-Z']];

    function pintarFiltros() {
      const orgs = ctx.organizaciones, locs = ctx.localidades.filter((x) => x.organizacion_id === ctx.sel.org);
      ctx.pFil.innerHTML = `
        <div class="ta-titulo"><span class="tk-icono"><i class="ti ti-file-search" aria-hidden="true"></i></span><div><small>Ventas Inteligentes</small><h2>Consulta de Ventas</h2></div></div>
        <label class="campo"><span>Organización</span><select name="org">${orgs.map((o) => `<option value="${o.id}" ${o.id === ctx.sel.org ? 'selected' : ''}>${esc(String(o.codigo))} · ${esc(o.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Localidad</span><select name="loc">${locs.map((l) => `<option value="${l.id}" ${l.id === ctx.sel.loc ? 'selected' : ''}>${esc(l.codigo)} · ${esc(l.nombre_comercial)}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo vic-cli"><span>Cliente</span><input name="cliente" value="${esc(f.cliente)}" placeholder="Todos (nombre o NIT)"></label>
        <label class="campo"><span>Estado</span><select name="estado"><option value="">Todos</option>${ESTADOS.map(([k, t]) => `<option value="${k}" ${f.estado === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Ordenar</span><select name="orden">${ORDENES.map(([k, t]) => `<option value="${k}" ${f.orden === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <div class="oc-extra vic-acciones">
          <button type="button" class="boton secundario-sm" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button>
          <button type="button" class="boton secundario-sm" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>
          <button type="button" class="boton primario-sm" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva venta</button>
        </div>`;
    }
    async function consultar() {
      const t = ++turno, loc = ctx.sel.loc;
      if (!loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la localidad.', 'ti-file-search'); return; }
      ctx.pDet.innerHTML = '<p class="vacio">Consultando las ventas…</p>';
      const [campo, dir] = f.orden.split(':');
      let q = sb.from('ventas_inteligentes').select('*, venta_inteligente_lineas(count), facturas_venta(serie, numero_dte, numero)').eq('localidad_id', loc).gte('fecha', f.desde).lte('fecha', f.hasta);
      if (f.estado) q = q.eq('estado', f.estado);
      if (f.cliente.trim()) q = q.or(`nombre.ilike.%${f.cliente.trim().replace(/[,()%]/g, ' ')}%,nit.ilike.%${f.cliente.trim().replace(/[,()%]/g, ' ')}%`);
      const r = await window.UI.todo(q.order(campo, { ascending: dir === 'asc' }).order('id', { ascending: dir === 'asc' }));
      if (t !== turno) return;
      if (r.error) { ctx.pDet.innerHTML = `<p class="vacio">${esc(sinTabla(r.error) ? AVISO : r.error.message)}</p>`; return; }
      ventas = r.data || [];
      if (sel && !ventas.some((v) => v.id === sel.id)) sel = null;
      sel = sel || ventas[0] || null;
      await cargarLineas();
    }
    async function cargarLineas() {
      lineas = [];
      if (sel) { const { data } = await sb.from('venta_inteligente_lineas').select('*').eq('venta_id', sel.id).order('linea'); lineas = data || []; }
      pintar();
    }
    const factTxt = (v) => (v.facturas_venta ? (v.facturas_venta.serie ? `${v.facturas_venta.serie}-${v.facturas_venta.numero_dte || ''}` : `Interna ${v.facturas_venta.numero}`) : '');
    function pintar() {
      const porEstado = ESTADOS.map(([k, t, ic]) => { const xs = ventas.filter((v) => v.estado === k); return { k, t, ic, n: xs.length, total: xs.reduce((s, v) => s + Number(v.total), 0) }; });
      const vivas = ventas.filter((v) => v.estado !== 'ELIMINADA');
      ctx.pDet.innerHTML = `
        <div class="vic">
          <div class="vic-kpis">
            <button type="button" class="vic-kpi ${f.estado === '' ? 'activo' : ''}" data-estado=""><small>Ventas (sin eliminadas)</small><b>${vivas.length}</b><span>Q ${fmt.monto(vivas.reduce((s, v) => s + Number(v.total), 0))}</span></button>
            ${porEstado.map((x) => `<button type="button" class="vic-kpi ${claseEstado(x.k)} ${f.estado === x.k ? 'activo' : ''}" data-estado="${x.k}"><small><i class="ti ${x.ic}" aria-hidden="true"></i> ${x.t}</small><b>${x.n}</b><span>Q ${fmt.monto(x.total)}</span></button>`).join('')}
          </div>
          <div class="vic-lista"><table>
            <thead><tr><th class="num">No.</th><th>Fecha</th><th>Cliente</th><th>NIT</th><th class="num">Productos</th><th class="num">Total</th><th>Estado</th><th>Factura</th><th>Generó</th></tr></thead>
            <tbody>${ventas.map((v) => `<tr data-venta="${v.id}" class="${sel?.id === v.id ? 'sel' : ''}" tabindex="0">
              <td class="num">${v.numero}</td><td>${esc(fmt.fechaDia(v.fecha))}</td><td class="vic-nom">${esc(v.nombre)}${v.origen === 'VOZ' ? ' <i class="ti ti-microphone" title="Generada por voz" aria-label="por voz"></i>' : ''}</td><td>${esc(v.nit || '')}</td>
              <td class="num">${v.venta_inteligente_lineas?.[0]?.count ?? ''}</td><td class="num">${fmt.monto(v.total)}</td><td><span class="vi-est ${claseEstado(v.estado)}">${esc(etqEstado(v.estado))}</span></td><td>${esc(factTxt(v))}</td><td>${esc(v.creado_por_nombre || '')}</td></tr>`).join('')
              || '<tr><td colspan="9" class="tk-vacio"><i class="ti ti-file-search" aria-hidden="true"></i>Sin ventas con esos parámetros.</td></tr>'}</tbody>
            ${ventas.length ? `<tfoot><tr><td colspan="5">${ventas.length} venta(s)</td><td class="num">${fmt.monto(ventas.reduce((s, v) => s + Number(v.total), 0))}</td><td colspan="3"></td></tr></tfoot>` : ''}
          </table></div>
          ${sel ? `<section class="vic-det">
            <div class="vic-det-cab"><div><b>Venta No. ${sel.numero} · ${esc(sel.nombre)}</b><small>${esc(fmt.fechaDia(sel.fecha))} · <span class="vi-est ${claseEstado(sel.estado)}">${esc(etqEstado(sel.estado))}</span>${sel.motivo_eliminacion ? ` · ${esc(sel.motivo_eliminacion)}` : ''}</small></div>
              <div class="vic-det-acc"><button type="button" class="boton secundario-sm" data-accion="abrir"><i class="ti ti-external-link" aria-hidden="true"></i> Abrir venta</button>${sel.factura_id ? '<button type="button" class="boton secundario-sm" data-accion="factura"><i class="ti ti-receipt" aria-hidden="true"></i> Ver factura</button>' : ''}</div></div>
            <table><thead><tr><th>#</th><th>Código</th><th>Producto</th><th class="num">Cantidad</th><th class="num">Precio</th><th class="num">Total</th></tr></thead>
              <tbody>${lineas.map((l) => `<tr><td>${l.linea}</td><td>${esc(l.producto_codigo || '')}</td><td>${esc(l.descripcion)}</td><td class="num">${cant(l.cantidad)}</td><td class="num">${fmt.monto(l.precio)}</td><td class="num">${fmt.monto(l.total)}</td></tr>`).join('')}</tbody>
              <tfoot><tr><td colspan="5">Total</td><td class="num">${fmt.monto(sel.total)}</td></tr></tfoot></table>
          </section>` : ''}
        </div>`;
    }
    const empresa = () => { const l = ctx.localidad(ctx.sel.loc); return l ? `${l.codigo} · ${l.nombre_comercial}` : ''; };
    function reporte() {
      return { titulo: 'Consulta de Ventas Inteligentes', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Ventas', archivo: `ventas_inteligentes_${f.hasta}`,
        parametros: [`Empresa: ${empresa()}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, `Cliente: ${f.cliente || 'Todos'}`, `Estado: ${f.estado ? etqEstado(f.estado) : 'Todos'}`],
        columnas: [{ titulo: 'No.', tipo: 'entero', ancho: 8 }, { titulo: 'Fecha', tipo: 'texto', ancho: 11 }, { titulo: 'Cliente', tipo: 'texto', ancho: 40 }, { titulo: 'NIT', tipo: 'texto', ancho: 13 }, { titulo: 'Productos', tipo: 'entero', ancho: 10 },
          { titulo: 'Total Q', tipo: 'monto', ancho: 15 }, { titulo: 'Estado', tipo: 'texto', ancho: 18 }, { titulo: 'Factura', tipo: 'texto', ancho: 16 }, { titulo: 'Generó', tipo: 'texto', ancho: 14 }],
        filas: [...ventas.map((v) => ({ valores: [v.numero, fmt.fechaDia(v.fecha), v.nombre, v.nit || '', Number(v.venta_inteligente_lineas?.[0]?.count || 0), Number(v.total), etqEstado(v.estado), factTxt(v), v.creado_por_nombre || ''] })),
          { valores: [`${ventas.length} venta(s)`, '', '', '', '', fmt.redondear(ventas.reduce((s, v) => s + Number(v.total), 0)), '', '', ''], tipo: 'total' }] };
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { sel = null; pintarFiltros(); return consultar(); }
      const n = e.target.name;
      if (!(n in f)) return;
      f[n] = e.target.value;
      if (n === 'desde' && f.hasta < f.desde) f.hasta = f.desde;
      if (n === 'hasta' && f.desde > f.hasta) f.desde = f.hasta;
      pintarFiltros(); consultar();
    });
    cont.addEventListener('click', (e) => {
      const k = e.target.closest('[data-estado]');
      if (k) { f.estado = k.dataset.estado; pintarFiltros(); return consultar(); }
      const tr = e.target.closest('tr[data-venta]');
      if (tr) { sel = ventas.find((v) => v.id === Number(tr.dataset.venta)); return cargarLineas(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'abrir' && sel) location.hash = `#/facturacion/generar-ventas/${sel.id}`;
      if (a === 'factura' && sel?.factura_id) location.hash = `#/facturacion/facturas-ventas/${sel.factura_id}`;
      if (a === 'nueva') location.hash = '#/facturacion/generar-ventas';
      if (a === 'pdf') { if (!ventas.length) return window.FIN.aviso('No hay ventas con esos parámetros'); window.CUENTAS_XLSX.pdf(reporte()); }
      if (a === 'excel') { if (!ventas.length) return window.FIN.aviso('No hay ventas con esos parámetros'); window.REPORTE_XLSX.generar(reporte()); }
    });
    cont.addEventListener('keydown', (e) => { const tr = e.target.closest?.('tr[data-venta]'); if (tr && e.key === 'Enter') tr.click(); });

    (async () => { if (!(await ctx.cargarBase())) return; pintarFiltros(); await consultar(); })();
  };
})();
