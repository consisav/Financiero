// Facturación/Ventas · Procesos · Ventas Inteligentes.
// Parámetros: organización, localidad, cliente y fecha. En el detalle se agregan productos y cantidades; cada línea
// toma el precio del tipo de precio del cliente (y muestra el último que pagó), su existencia y un botón para ver las
// existencias por bodega y lote. Sugiere los productos que más compra el cliente y avisa su saldo vencido.
// Flujo: Detalle → Confirmar (valida cantidades y existencias) → Generar (factura preliminar) → Aceptar: la venta pasa a
// Facturas Ventas como factura nueva ya llenada, para revisarla, guardarla y certificarla allí.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const CLAVE = 'fin-venta-inteligente';
  const hace = (meses) => { const d = new Date(); d.setMonth(d.getMonth() - meses); return d.toISOString().slice(0, 10); };
  const cant = (n) => Number(n || 0).toLocaleString('es-GT', { maximumFractionDigits: 4 });

  window.PANTALLAS['ventas-inteligentes'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Ventas Inteligentes', icono: 'ti-sparkles', clase: 'bk-movimientos bm-solo vi-pantalla', grupo: 'Ventas · Procesos' });
    const { sb } = ctx;
    const est = { clientes: [], productos: [], tipos: [], precios: [], exist: new Map(), bodegas: [], cliente: null, fecha: fmt.hoy(), lineas: [], etapa: 'DETALLE', sugeridos: [], ultimos: new Map(), saldo: null, cargando: false };
    const prod = (id) => est.productos.find((p) => p.id === id);
    const etqProd = (p) => `${p.nombre} — ${p.codigo_producto || p.codigo}`;
    const etqCli = (c) => `${c.nombre}${c.tipo_documento !== 'CF' && c.documento ? ` · NIT ${c.documento}` : ''} — ${c.codigo}`;
    const tipoPrecio = () => est.cliente?.tipo_precio_id || est.tipos.find((t) => t.activo !== false)?.id || null;
    const precioDe = (pid) => Number(est.precios.find((x) => x.producto_id === pid && x.tipo_precio_id === tipoPrecio())?.precio || 0);
    const existencia = (pid) => Number(est.exist.get(pid) || 0);
    const total = () => fmt.redondear(est.lineas.filter((l) => l.producto_id).reduce((t, l) => t + Number(l.cantidad || 0) * Number(l.precio || 0), 0));
    const nuevaLinea = () => ({ producto_id: null, texto: '', cantidad: 1, precio: 0 });

    function pintarFiltros() {
      const orgs = ctx.organizaciones, locs = ctx.localidades.filter((x) => x.organizacion_id === ctx.sel.org);
      const bloqueado = est.etapa !== 'DETALLE';
      ctx.pFil.innerHTML = `
        <div class="ta-titulo"><span class="tk-icono"><i class="ti ti-sparkles" aria-hidden="true"></i></span><div><small>Ventas · Procesos</small><h2>Ventas Inteligentes</h2></div></div>
        <label class="campo"><span>Organización</span><select name="org" ${bloqueado ? 'disabled' : ''}>${orgs.map((o) => `<option value="${o.id}" ${o.id === ctx.sel.org ? 'selected' : ''}>${esc(String(o.codigo))} · ${esc(o.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Localidad</span><select name="loc" ${bloqueado ? 'disabled' : ''}>${locs.map((l) => `<option value="${l.id}" ${l.id === ctx.sel.loc ? 'selected' : ''}>${esc(l.codigo)} · ${esc(l.nombre_comercial)}</option>`).join('')}</select></label>
        <label class="campo vi-cli"><span>Nombre del cliente</span><input name="cliente" list="vi-clientes" value="${esc(est.cliente ? etqCli(est.cliente) : '')}" placeholder="Buscar por nombre, NIT o código" autocomplete="off" ${bloqueado ? 'disabled' : ''}>
          <datalist id="vi-clientes">${est.clientes.map((c) => `<option ${c.estado === 'INACTIVO' ? 'label="Inactivo" ' : ''}value="${esc(etqCli(c))}"></option>`).join('')}</datalist></label>
        <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(est.fecha)}" ${bloqueado ? 'disabled' : ''}></label>
        <div class="oc-extra vi-acciones">
          ${est.etapa === 'DETALLE' ? '<button type="button" class="boton primario-sm" data-accion="confirmar"><i class="ti ti-circle-check" aria-hidden="true"></i> Confirmar</button>'
            : '<button type="button" class="boton secundario-sm" data-accion="editar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button><button type="button" class="boton primario-sm" data-accion="generar"><i class="ti ti-file-invoice" aria-hidden="true"></i> Generar</button>'}
        </div>`;
    }

    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      est.cliente = null; est.lineas = [nuevaLinea()]; est.etapa = 'DETALLE'; est.sugeridos = []; est.ultimos = new Map(); est.saldo = null;
      if (!loc) { pintarFiltros(); ctx.pDet.innerHTML = ctx.vacio('Elige la localidad.', 'ti-sparkles'); return; }
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
      pintarFiltros(); pintar();
    }

    // Al elegir el cliente: lo que más compra (12 meses) con su último precio, y su saldo pendiente y vencido.
    async function elegirCliente(c) {
      est.cliente = c; est.sugeridos = []; est.ultimos = new Map(); est.saldo = null;
      est.lineas.forEach((l) => { if (l.producto_id) l.precio = precioDe(l.producto_id) || l.precio; });
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
      const c = est.cliente, ed = est.etapa === 'DETALLE', dis = ed ? '' : 'disabled';
      const tot = total(), iva = fmt.redondear(tot / 1.12 * 0.12);
      const faltan = est.lineas.filter((l) => l.producto_id && Number(l.cantidad) > existencia(l.producto_id));
      const tp = est.tipos.find((t) => t.id === tipoPrecio());
      const PASOS = [['DETALLE', 'Detalle'], ['CONFIRMADA', 'Confirmada'], ['PRELIMINAR', 'Factura preliminar'], ['FACTURA', 'Factura']];
      const iEt = PASOS.findIndex(([k]) => k === est.etapa);
      ctx.pDet.innerHTML = `
        <div class="vi">
          <section class="vi-main">
            <ol class="vi-pasos">${PASOS.map(([k, t], i) => `<li class="${i < iEt ? 'hecho' : i === iEt ? 'actual' : ''}"><span>${i < iEt ? '<i class="ti ti-check" aria-hidden="true"></i>' : i + 1}</span>${t}</li>`).join('')}</ol>
            ${ed && est.sugeridos.length ? `<div class="vi-sug"><b><i class="ti ti-bulb" aria-hidden="true"></i> Lo que más compra este cliente</b>${est.sugeridos.map((s) => `<button type="button" class="vi-chip" data-sugerido="${s.producto_id}" title="${s.veces} compra(s) en 12 meses · último precio ${fmt.monto(s.ultimo)}"><i class="ti ti-plus" aria-hidden="true"></i> ${esc(prod(s.producto_id).nombre)}</button>`).join('')}</div>` : ''}
            <div class="vi-tabla"><table>
              <thead><tr><th>#</th><th>Producto</th><th class="num">Existencia</th><th class="num">Cantidad</th><th class="num">Precio</th><th class="num">Total</th><th></th></tr></thead>
              <tbody>${est.lineas.map((l, i) => { const p = l.producto_id && prod(l.producto_id); const ex = p ? existencia(p.id) : null; const ult = p && est.ultimos.get(p.id);
                return `<tr data-i="${i}" class="${p && Number(l.cantidad) > ex ? 'vi-falta' : ''}">
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
                : '<p class="rg-nota">Elige el cliente en los parámetros.</p>'}
            </section>
            <section class="vi-card vi-res">
              <h3><i class="ti ti-receipt" aria-hidden="true"></i> Resumen</h3>
              <div><span>Productos</span><b>${est.lineas.filter((l) => l.producto_id).length}</b></div>
              <div><span>Subtotal sin IVA</span><b data-r="sub">${fmt.monto(tot - iva)}</b></div>
              <div><span>IVA (12 %)</span><b data-r="iva">${fmt.monto(iva)}</b></div>
              <div class="vi-total"><span>Total</span><b data-r="tot">Q ${fmt.monto(tot)}</b></div>
              ${faltan.length ? `<p class="vi-alerta"><i class="ti ti-packages" aria-hidden="true"></i> ${faltan.length} producto(s) con existencia insuficiente.</p>` : ''}
            </section>
          </aside>
        </div>`;
    }

    // Lee la tabla (sin repintar) y actualiza los totales.
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

    async function verExistencias(pid) {
      const p = prod(pid);
      const { data } = await window.UI.todo(sb.from('inventario_movimientos').select('bodega_id, lote, fecha_vencimiento, cantidad').eq('localidad_id', ctx.sel.loc).eq('producto_id', pid).order('id'));
      const g = new Map();
      (data || []).forEach((m) => { const k = `${m.bodega_id}|${m.lote || ''}`; const a = g.get(k) || { bodega: m.bodega_id, lote: m.lote || '', vence: m.fecha_vencimiento, q: 0 }; a.q += Number(m.cantidad || 0); if (m.fecha_vencimiento) a.vence = m.fecha_vencimiento; g.set(k, a); });
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

    function confirmar() {
      leer();
      if (!est.cliente) return window.FIN.aviso('Elige el cliente');
      const malas = est.lineas.filter((l) => !l.producto_id && (l.texto || '').trim());
      if (malas.length) return window.FIN.aviso(`«${malas[0].texto}» no está en el catálogo de productos`);
      est.lineas = est.lineas.filter((l) => l.producto_id);
      if (!est.lineas.length) { est.lineas = [nuevaLinea()]; pintar(); return window.FIN.aviso('Agrega al menos un producto'); }
      const sinCant = est.lineas.find((l) => !(Number(l.cantidad) > 0));
      if (sinCant) { pintar(); return window.FIN.aviso(`Indica la cantidad de ${prod(sinCant.producto_id).nombre}`); }
      const sinPrecio = est.lineas.find((l) => !(Number(l.precio) > 0));
      if (sinPrecio) { pintar(); return window.FIN.aviso(`${prod(sinPrecio.producto_id).nombre} no tiene precio`); }
      const faltan = est.lineas.filter((l) => Number(l.cantidad) > existencia(l.producto_id));
      if (faltan.length && !confirm(`${faltan.length} producto(s) no tienen existencia suficiente (por ejemplo ${prod(faltan[0].producto_id).nombre}: hay ${cant(existencia(faltan[0].producto_id))}). ¿Confirmar de todos modos?`)) return pintar();
      est.etapa = 'CONFIRMADA'; pintarFiltros(); pintar();
      window.FIN.aviso('Venta confirmada: presiona Generar para ver la factura preliminar');
    }

    // Factura preliminar: vista del documento; al aceptarla, la venta pasa a Facturas Ventas.
    function generar() {
      const c = est.cliente, tot = total(), iva = fmt.redondear(tot / 1.12 * 0.12);
      const loc = ctx.localidad(ctx.sel.loc), org = ctx.organizaciones.find((o) => o.id === ctx.sel.org);
      est.etapa = 'PRELIMINAR'; pintarFiltros(); pintar();
      const velo = document.createElement('div');
      velo.className = 'modal-velo';
      velo.innerHTML = `<div class="modal vi-modal vi-pre" role="dialog" aria-modal="true" aria-labelledby="vi-pre-t">
        <header class="modal-cab"><h2 id="vi-pre-t"><i class="ti ti-file-invoice" aria-hidden="true"></i> Factura preliminar</h2><button type="button" class="icono-boton" data-rechazar aria-label="Cerrar"><i class="ti ti-x" aria-hidden="true"></i></button></header>
        <div class="vi-modal-cuerpo">
          <div class="vi-doc">
            <div class="vi-doc-cab"><div><b>${esc(loc ? loc.nombre_comercial : '')}</b><small>${esc(org ? org.nombre : '')} · ${esc(loc ? loc.codigo : '')}</small></div><div class="vi-doc-sello">PRELIMINAR<small>Sin validez fiscal</small></div></div>
            <dl class="vi-doc-dl"><div><dt>Cliente</dt><dd>${esc(c.nombre)}</dd></div><div><dt>NIT</dt><dd>${esc(c.tipo_documento === 'CF' ? 'CF' : c.documento || '—')}</dd></div><div><dt>Fecha</dt><dd>${esc(fmt.fechaDia(est.fecha))}</dd></div><div><dt>Pago</dt><dd>${esc(c.forma_pago || 'CONTADO')}</dd></div></dl>
            <table><thead><tr><th>#</th><th>Código</th><th>Descripción</th><th class="num">Cantidad</th><th class="num">Precio</th><th class="num">Total</th></tr></thead>
              <tbody>${est.lineas.map((l, i) => { const p = prod(l.producto_id); return `<tr><td>${i + 1}</td><td>${esc(String(p.codigo_producto || p.codigo))}</td><td>${esc(p.nombre)}</td><td class="num">${cant(l.cantidad)}</td><td class="num">${fmt.monto(l.precio)}</td><td class="num">${fmt.monto(l.cantidad * l.precio)}</td></tr>`; }).join('')}</tbody>
              <tfoot><tr><td colspan="5">Subtotal sin IVA</td><td class="num">${fmt.monto(tot - iva)}</td></tr><tr><td colspan="5">IVA (12 %)</td><td class="num">${fmt.monto(iva)}</td></tr><tr class="vi-doc-tot"><td colspan="5">Total</td><td class="num">Q ${fmt.monto(tot)}</td></tr></tfoot></table>
          </div>
        </div>
        <footer class="modal-pie"><button type="button" class="boton secundario-sm" data-rechazar><i class="ti ti-x" aria-hidden="true"></i> Rechazar</button><button type="button" class="boton primario-sm" data-aceptar><i class="ti ti-check" aria-hidden="true"></i> Aceptar y pasar a la factura</button></footer></div>`;
      document.body.appendChild(velo);
      const rechazar = () => { velo.remove(); est.etapa = 'CONFIRMADA'; pintarFiltros(); pintar(); };
      velo.querySelectorAll('[data-rechazar]').forEach((b) => b.addEventListener('click', rechazar));
      velo.addEventListener('keydown', (e) => { if (e.key === 'Escape') rechazar(); });
      velo.querySelector('[data-aceptar]').addEventListener('click', () => {
        const datos = { org: ctx.sel.org, loc: ctx.sel.loc, cliente_id: c.id, fecha: est.fecha,
          lineas: est.lineas.map((l) => { const p = prod(l.producto_id); return { producto_id: p.id, producto_codigo: p.codigo, descripcion: p.nombre, cantidad: Number(l.cantidad), precio: Number(l.precio) }; }) };
        try { sessionStorage.setItem(CLAVE, JSON.stringify(datos)); } catch { window.VENTA_INTELIGENTE = datos; }
        window.VENTA_INTELIGENTE = datos;
        velo.remove();
        est.etapa = 'FACTURA'; pintarFiltros(); pintar();
        location.hash = '#/facturacion/facturas-ventas/inteligente';
      });
      velo.querySelector('[data-aceptar]').focus();
    }

    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
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
    cont.addEventListener('click', (e) => {
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'agregar') { leer(); est.lineas.push(nuevaLinea()); pintar(); ctx.pDet.querySelector('tr[data-i]:last-child [data-l=producto]')?.focus(); return; }
      if (a === 'confirmar') return confirmar();
      if (a === 'editar') { est.etapa = 'DETALLE'; if (!est.lineas.some((l) => !l.producto_id)) est.lineas.push(nuevaLinea()); pintarFiltros(); return pintar(); }
      if (a === 'generar') return generar();
      const q = e.target.closest('[data-quitar]');
      if (q) { leer(); est.lineas.splice(Number(q.dataset.quitar), 1); return pintar(); }
      const s = e.target.closest('[data-sugerido]');
      if (s) {
        leer();
        const p = prod(Number(s.dataset.sugerido));
        const ya = est.lineas.find((l) => l.producto_id === p.id);
        if (ya) ya.cantidad = Number(ya.cantidad || 0) + 1;
        else { let l = est.lineas.find((x) => !x.producto_id && !x.texto); if (!l) { l = nuevaLinea(); est.lineas.push(l); } ponerProducto(l, p); if (est.lineas[est.lineas.length - 1] === l) est.lineas.push(nuevaLinea()); }
        return pintar();
      }
      const x = e.target.closest('[data-existencias]');
      if (x) return verExistencias(Number(x.dataset.existencias));
    });

    (async () => { if (!(await ctx.cargarBase())) return; await cargarLocalidad(); })();
  };
})();
