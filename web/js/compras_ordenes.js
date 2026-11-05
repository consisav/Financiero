// Compras · Registros · Órdenes de compra.
//   Solicitudes de compra (generación de órdenes): encabezado (folio, número de orden, fecha y
//   estado), proveedor (forma de pago, días, moneda, cambio, tipo de proveedor y observaciones
//   internas), bodega («Cargar» trae los productos del proveedor con la cantidad sugerida por su
//   punto mínimo, «Reversar carga» los quita) y observaciones al proveedor; pestañas Productos
//   (existencia, cantidad solicitada, precio, y abajo el precio en la moneda y en dólares, lo que
//   está en tránsito y solicitado, mínimo y máximo), Cotizaciones, Otros y Órdenes. «Generar orden»
//   la envía a autorización.
//   Autorizaciones de compras: la misma orden en solo lectura, con la cantidad aprobada y «Aprueba»
//   por producto; Aprobar orden, Rechazar o Devolver.
//   Autorizar órdenes: las órdenes en autorización con su botón Ver.
//   Órdenes de compra (ingresos basados en órdenes): se recibe lo autorizado por lote y vencimiento,
//   «Aplicar inventario» lo carga a la bodega y genera la factura de compra; Revertir y Anular.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  const CODIGOS = { INGRESADA: 'ING', 'EN AUTORIZACIÓN': 'EAU', AUTORIZADA: 'AUT', RECHAZADA: 'REC', 'RECIBIDA PARCIAL': 'RPA', RECIBIDA: 'RCB', ANULADA: 'ANU' };
  const CLASES = { INGRESADA: 'pendiente', 'EN AUTORIZACIÓN': 'pendiente', AUTORIZADA: 'aprobada', RECHAZADA: 'anulada', 'RECIBIDA PARCIAL': 'aprobada', RECIBIDA: 'definitiva', ANULADA: 'anulada' };
  const marca = (e) => `<span class="pc-marca ${CLASES[e] || 'pendiente'}">${esc(e)}</span>`;
  const estadoCaja = (e) => `<div class="oq-estado"><b>${CODIGOS[e] || ''}</b><span>${esc(e)}</span></div>`;
  const AVISO = 'Falta instalar el script 61 (órdenes de compra) en Supabase.';
  const leerSesion = (k) => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } };
  const guardarSesion = (k, v) => { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch { /* sin almacenamiento */ } };

  // Catálogos de la localidad que usan las cuatro pantallas.
  async function catalogos(sb, loc) {
    const q = (t, c = '*') => sb.from(t).select(c).eq('localidad_id', loc || 0);
    const [p, b, pr, pp, tp] = await Promise.all([
      q('proveedores', 'id, codigo, nit, nombre_comercial, nombre_fiscal, dias_credito, moneda_id, tipo_proveedor_id, estado').order('nombre_comercial'),
      q('bodegas', 'id, codigo, nombre, siglas, estado').order('codigo'),
      q('productos', 'id, codigo, nombre, codigo_producto, proveedor_id, punto_minimo, minimo, maximo, precio_costo, estado').order('nombre'),
      sb.from('producto_proveedores').select('producto_id, proveedor_id, ultimo_costo'),
      sb.from('tipos_proveedor').select('id, codigo, nombre').order('codigo')
    ]);
    return { proveedores: p.data || [], bodegas: b.data || [], productos: pr.data || [], prodProv: pp.data || [], tiposProv: tp.data || [] };
  }
  // Existencia, en tránsito y solicitado de los productos en la bodega (sin contar la orden actual).
  async function estadisticas(sb, ids, bodega, sinOrden) {
    const r = new Map(ids.map((id) => [id, { existencia: 0, transito: 0, solicitado: 0 }]));
    if (!ids.length || !bodega) return r;
    const [e, t, s] = await Promise.all([
      sb.from('existencias').select('producto_id, existencia').eq('bodega_id', bodega).in('producto_id', ids),
      sb.from('orden_lineas_saldo').select('producto_id, saldo').eq('bodega_id', bodega).in('producto_id', ids).gt('saldo', 0),
      sb.from('orden_compra_lineas').select('producto_id, cantidad_solicitada, orden_id, ordenes_compra!inner(estado, bodega_id)').in('producto_id', ids).eq('ordenes_compra.bodega_id', bodega).in('ordenes_compra.estado', ['INGRESADA', 'EN AUTORIZACIÓN'])
    ]);
    (e.data || []).forEach((x) => { r.get(x.producto_id).existencia += Number(x.existencia); });
    (t.data || []).forEach((x) => { r.get(x.producto_id).transito += Number(x.saldo); });
    (s.data || []).filter((x) => x.orden_id !== sinOrden).forEach((x) => { r.get(x.producto_id).solicitado += Number(x.cantidad_solicitada); });
    return r;
  }

  window.PANTALLAS = window.PANTALLAS || {};

  // ===================== Solicitudes de compra y Autorizaciones de compras =====================
  function pantallaOrden(cont, modo) {
    const AUT = modo === 'AUTORIZACION';
    const ctx = montar(cont, { titulo: AUT ? 'Autorizaciones de compras' : 'Solicitudes de compra', icono: AUT ? 'ti-checklist' : 'ti-file-plus', clase: 'bk-movimientos oq-ordenes', grupo: 'Compras · Órdenes de compra' });
    const { sb, yo } = ctx;
    const [anio, mes] = fmt.hoy().split('-');
    const f = { estado: AUT ? 'EN AUTORIZACIÓN' : 'PENDIENTES', desde: `${anio}-${String(Number(mes) - 2 > 0 ? Number(mes) - 2 : 1).padStart(2, '0')}-01`, hasta: fmt.hoy() };
    let cat = { proveedores: [], bodegas: [], productos: [], prodProv: [], tiposProv: [] };
    let ordenes = [], actual = null, lineas = [], cotiz = [], stats = new Map(), elegida = 0, pestana = 'PRODUCTOS', buscar = '', editando = false;
    const prov = (id) => cat.proveedores.find((p) => p.id === id);
    const provTxt = (p) => `${p.codigo} · ${p.nombre_comercial}`;
    const provDe = (t0) => { const t = String(t0 || '').trim().toUpperCase(); return t ? cat.proveedores.find((p) => provTxt(p).toUpperCase() === t) || cat.proveedores.find((p) => String(p.codigo) === t || p.nit === t || p.nombre_comercial === t) || null : null; };
    const prod = (id) => cat.productos.find((p) => p.id === id);
    const prodTxt = (p) => `${p.codigo_producto || p.codigo} · ${p.nombre}`;
    const bodega = (id) => cat.bodegas.find((b) => b.id === id);
    const editable = () => ctx.admin && !AUT && (!actual || (editando && ['INGRESADA', 'RECHAZADA'].includes(actual.estado)));
    const autorizable = () => ctx.admin && AUT && actual?.estado === 'EN AUTORIZACIÓN';
    const totalOrden = (ls = lineas) => fmt.redondear(ls.reduce((t, l) => t + Number(AUT ? (l.aprueba ? l.cantidad_aprobada : 0) : l.cantidad_solicitada || 0) * Number(l.precio_unitario || 0), 0));

    function pintarFiltros() {
      const ests = AUT ? [['EN AUTORIZACIÓN', 'En autorización'], ['AUTORIZADA', 'Autorizadas'], ['TODAS', 'Todas']] : [['PENDIENTES', 'Ingresadas y rechazadas'], ['EN AUTORIZACIÓN', 'En autorización'], ['TODAS', 'Todas']];
      ctx.filtros(`
        <label class="campo"><span>Estado</span><select name="estado">${ests.map(([k, t]) => `<option value="${k}" ${f.estado === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>`, '<div class="cf-barra" data-barra></div>');
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('ordenes_compra').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/ordenes_compra/.test(prueba.error.message) ? AVISO : esc(prueba.error.message)}</p></section>`; return; }
      pintarFiltros();
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      cat = await catalogos(sb, ctx.sel.loc);
      actual = null; editando = false;
      const ver = Number(leerSesion('fin.orden.ver')) || undefined;
      guardarSesion('fin.orden.ver', '');
      if (ver) f.estado = 'TODAS';
      await consultar(ver);
    }
    async function consultar(id = actual?.id) {
      if (!ctx.sel.loc) { ordenes = []; pintarLista(); return abrir(null); }
      let q = sb.from('ordenes_compra').select('*, orden_compra_lineas(cantidad_solicitada, cantidad_aprobada, aprueba, precio_unitario)').eq('localidad_id', ctx.sel.loc).order('folio', { ascending: false });
      if (f.estado === 'PENDIENTES') q = q.in('estado', ['INGRESADA', 'RECHAZADA']);
      else if (f.estado !== 'TODAS') q = q.eq('estado', f.estado);
      if (f.estado === 'TODAS') q = q.gte('fecha', f.desde).lte('fecha', f.hasta);
      const { data, error } = await q;
      if (error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      ordenes = (data || []).map((o) => ({ ...o, total: o.orden_compra_lineas.reduce((t, l) => t + Number(['INGRESADA', 'EN AUTORIZACIÓN', 'RECHAZADA'].includes(o.estado) ? l.cantidad_solicitada : l.cantidad_aprobada) * Number(l.precio_unitario), 0) }));
      if (id && !ordenes.some((o) => o.id === id)) { const { data: x } = await sb.from('ordenes_compra').select('*').eq('id', id).maybeSingle(); if (x) ordenes.unshift({ ...x, total: 0 }); }
      pintarLista();
      await abrir(ordenes.find((o) => o.id === id) || (id === null ? null : ordenes[0]) || null);
    }
    function pintarLista() {
      const q = buscar.trim().toLowerCase();
      const filas = ordenes.filter((o) => !q || [o.folio, o.numero, prov(o.proveedor_id)?.nombre_comercial, o.usuario].some((v) => String(v || '').toLowerCase().includes(q)));
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab tg-cab"><h2>Órdenes <small>${ordenes.length}</small></h2>
          <div class="ta-totales pc-resumen"><span class="ta-total"><b>Q ${fmt.monto(ordenes.reduce((t, o) => t + o.total * Number(o.tipo_cambio || 1), 0))}</b> total</span></div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Folio, número, proveedor…" value="${esc(buscar)}" aria-label="Buscar órdenes"></label></header>
        <div class="ta-tabla"><table><thead><tr><th class="num">Folio</th><th>Número de orden</th><th>Fecha</th><th>Proveedor</th><th>Bodega</th><th>Usuario</th><th class="num">Total</th><th>Estado</th></tr></thead>
          <tbody>${filas.map((o) => `<tr data-orden="${o.id}" class="${actual && actual.id === o.id ? 'actual' : ''} ${o.estado === 'ANULADA' ? 'pc-anulada' : ''}" tabindex="0"><td class="num fuerte">${o.folio}</td><td>${esc(o.numero || '')}</td><td>${esc(fmt.fechaDia(o.fecha))}</td>
            <td class="ta-desc">${esc(prov(o.proveedor_id)?.nombre_comercial || '')}</td><td>${esc(bodega(o.bodega_id)?.nombre || '')}</td><td>${esc(o.usuario || '')}</td><td class="num">${fmt.monto(o.total)}</td><td>${marca(o.estado)}</td></tr>`).join('')
            || `<tr><td colspan="8" class="tk-vacio"><i class="ti ti-clipboard-list" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : ordenes.length ? 'Ninguna coincide.' : 'No hay órdenes con esos filtros.'}</td></tr>`}</tbody></table></div>`;
    }
    async function abrir(o, editar = false) {
      actual = o; editando = editar; lineas = []; cotiz = []; elegida = 0;
      if (o) {
        const [l, c] = await Promise.all([sb.from('orden_compra_lineas').select('*').eq('orden_id', o.id).order('linea'), sb.from('orden_cotizaciones').select('*').eq('orden_id', o.id).order('linea')]);
        lineas = (l.data || []).map((x) => ({ ...x, cantidad_solicitada: Number(x.cantidad_solicitada), cantidad_aprobada: Number(x.cantidad_aprobada), precio_unitario: Number(x.precio_unitario), incluir: true }));
        cotiz = c.data || [];
      }
      await recargarStats(o?.bodega_id);
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-orden]').forEach((tr) => tr.classList.toggle('actual', !!o && tr.dataset.orden === String(o.id)));
    }
    async function recargarStats(bod) { stats = await estadisticas(sb, [...new Set(lineas.map((l) => l.producto_id))], bod, actual?.id); }

    function pintarBarra(o, ed) {
      const b = ctx.pFil.querySelector('[data-barra]');
      if (!b) return;
      b.innerHTML = `
        <div class="cf-quien">${o ? `<small>Folio ${o.folio} · ${esc(o.numero || '')}</small><b>${esc(prov(o.proveedor_id)?.nombre_comercial || '')}</b>` : ed ? '<small>Nueva solicitud</small><b>Elige el proveedor</b>' : ''}</div>
        <div class="cf-marcas">${o ? marca(o.estado) : ''}</div>
        <div class="cf-botones">
          ${!AUT && ctx.admin && !ed ? '<button type="button" class="boton secundario-sm" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva</button>' : ''}
          ${!AUT && ctx.admin && o && !ed && ['INGRESADA', 'RECHAZADA'].includes(o.estado) ? '<button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}
          ${ed ? `${o || ordenes.length ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}<button type="submit" form="oq-form" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button>` : ''}
          ${ctx.admin && o && !ed && !['ANULADA', 'RECIBIDA'].includes(o.estado) && !AUT ? '<button type="button" class="icono-boton rp-peligro" data-accion="ANULAR" title="Anular la orden" aria-label="Anular la orden"><i class="ti ti-ban" aria-hidden="true"></i></button>' : ''}
        </div>`;
    }

    function pintarDetalle(v0) {
      const o = actual;
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-clipboard-list'); pintarBarra(null, false); return; }
      // En autorizaciones, sin orden elegida: el aviso y la lista (no un formulario vacío).
      if (AUT && !o) {
        ctx.pDet.innerHTML = `<div class="oq-sin-orden">${ctx.vacio(ordenes.length ? 'Elige una orden de la lista.' : `No hay órdenes ${f.estado === 'EN AUTORIZACIÓN' ? 'esperando autorización' : 'con esos filtros'}. Cambia el estado del filtro para ver las autorizadas.`, 'ti-checklist')}</div>`;
        ctx.pDet.querySelector('.oq-sin-orden').appendChild(ctx.pMae);
        pintarBarra(null, false);
        return;
      }
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const autz = autorizable();
      const gtq = ctx.monedaBase();
      const v = v0 || (o ? { ...o } : { fecha: fmt.hoy(), forma_pago: 'CONTADO', dias_credito: 0, moneda_id: gtq?.id, tipo_cambio: ctx.monedas.find((m) => m.iso === 'USD')?.cambio || 1, bodega_id: cat.bodegas.find((b) => b.estado === 'ACTIVO')?.id || null });
      const p = prov(v.proveedor_id);
      const sim = ctx.moneda(v.moneda_id)?.simbolo || 'Q';
      const l = lineas[elegida];
      const st = l ? stats.get(l.producto_id) || {} : {};
      const pr = l ? prod(l.producto_id) : null;
      const cant = (x) => Number(AUT ? x.cantidad_aprobada : x.cantidad_solicitada) || 0;
      const cambio = Number(v.tipo_cambio) || 1;
      const tabs = [['PRODUCTOS', 'Productos', 'ti-package', lineas.length], ['COTIZACIONES', 'Cotizaciones', 'ti-file-dollar', cotiz.length], ['OTROS', 'Otros', 'ti-dots', 0], ['ORDENES', 'Órdenes', 'ti-list-search', ordenes.length]];
      ctx.pDet.innerHTML = `
        <form id="oq-form" class="tk-form ta-form bm-form cf-form cl-clasico cf-compacto oq-form" novalidate>
          <div class="cl-banda">${AUT ? 'Autorización de órdenes de compra' : 'Generación de órdenes de compra'}</div>
          <p class="modal-error tk-error" role="alert"></p>
          ${o?.motivo_rechazo ? `<p class="tk-aviso bm-anulado"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> ${o.estado === 'RECHAZADA' ? 'Rechazada' : 'Devuelta'} por ${esc(o.rechazado_por || '')} · ${esc(fmt.fechaHora(o.rechazado_en))}: ${esc(o.motivo_rechazo)}</p>` : ''}
          ${o?.estado === 'ANULADA' ? `<p class="tk-aviso bm-anulado"><i class="ti ti-ban" aria-hidden="true"></i> Anulada por ${esc(o.anulado_por || '')}: ${esc(o.motivo_anulacion || '')}</p>` : ''}
          <div class="oq-cab">
            <section class="bs-tipo oq-orden"><div class="cfx oq-g1">
              <div class="campo cf-numero"><span>Folio</span><b>${o ? o.folio : 'Auto'}</b></div>
              <div class="campo"><span>Número de orden</span><b class="oq-num">${esc(o?.numero || 'Al guardar')}</b></div>
              <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(v.fecha || '')}" ${dis || (o ? 'disabled' : '')}></label>
              <div class="campo"><span>Estado</span>${estadoCaja(o ? o.estado : 'INGRESADA')}</div>
            </div></section>
            <section class="bm-bloque oq-prov"><div class="cfx oq-g2">
              <label class="campo oq-c3"><span>Proveedor *</span><input list="oq-proveedores" name="proveedor" value="${esc(p ? provTxt(p) : '')}" placeholder="Código, NIT o nombre" ${dis}></label>
              <label class="campo"><span>Tipo proveedor</span><select name="tipo_proveedor_id" ${dis}><option value="">—</option>${cat.tiposProv.map((t) => `<option value="${t.id}" ${t.id === (v.tipo_proveedor_id || p?.tipo_proveedor_id) ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select></label>
              <label class="campo"><span>Forma de pago</span><select name="forma_pago" ${dis}>${['CONTADO', 'CRÉDITO'].map((x) => `<option ${v.forma_pago === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
              <label class="campo"><span>Días crédito</span><input type="number" min="0" max="365" name="dias_credito" value="${esc(String(v.dias_credito ?? 0))}" ${dis || (v.forma_pago === 'CONTADO' ? 'disabled' : '')}></label>
              <label class="campo"><span>Moneda</span><select name="moneda_id" ${dis}>${ctx.monedas.map((m) => `<option value="${m.id}" ${m.id === v.moneda_id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
              <label class="campo"><span>Valor cambio</span><input type="number" step="any" min="0" name="tipo_cambio" value="${esc(String(v.tipo_cambio ?? 1))}" ${dis}></label>
              <label class="campo oq-c3"><span>Observaciones internas</span><input name="observaciones_internas" value="${esc(v.observaciones_internas || '')}" maxlength="300" ${dis}></label>
            </div></section>
            <section class="bm-bloque oq-bod"><div class="cfx oq-g3">
              <label class="campo oq-c2"><span>Bodega *</span><select name="bodega_id" ${dis || (o ? 'disabled' : '')}>${cat.bodegas.filter((b) => b.estado === 'ACTIVO' || b.id === v.bodega_id).map((b) => `<option value="${b.id}" ${b.id === v.bodega_id ? 'selected' : ''}>${b.codigo} · ${esc(b.nombre)}</option>`).join('')}</select></label>
              <div class="oq-acciones oq-c2">
                ${ed ? '<button type="button" class="boton secundario-sm" data-accion="cargar" title="Trae los productos del proveedor con la cantidad sugerida por su punto mínimo"><i class="ti ti-download" aria-hidden="true"></i> Cargar</button><button type="button" class="boton secundario-sm" data-accion="reversar" title="Quita los productos de la última carga"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Reversar carga</button>' : ''}
                ${o ? '<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>' : ''}
                ${autz ? '<button type="button" class="boton primario-sm" data-accion="APROBAR"><i class="ti ti-circle-check" aria-hidden="true"></i> Aprobar orden</button><button type="button" class="boton secundario-sm" data-accion="DEVOLVER" title="Regresa la orden a quien la ingresó para corregirla"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Devolver</button><button type="button" class="boton secundario-sm rp-peligro" data-accion="RECHAZAR"><i class="ti ti-x" aria-hidden="true"></i> Rechazar</button>' : ''}
              </div>
              <label class="campo oq-c2"><span>Observaciones al proveedor</span><input name="observaciones_proveedor" value="${esc(v.observaciones_proveedor || '')}" maxlength="400" ${dis}></label>
            </div></section>
          </div>
          <section class="bm-pestanas">
            <div class="bm-tabs-barra"><div class="rp-pestanas" role="tablist">${tabs.map(([k, t, i, n]) => `<button type="button" role="tab" data-pestana="${k}" class="${pestana === k ? 'activa' : ''}" aria-selected="${pestana === k}"><i class="ti ${i}" aria-hidden="true"></i> ${t}${n ? ` <b>${n}</b>` : ''}</button>`).join('')}</div>
              <div class="oq-tab-acc">${pestana === 'PRODUCTOS' && ed ? `<input list="oq-productos" data-agregar placeholder="Agregar producto (código o nombre)…" aria-label="Agregar producto"><button type="button" class="boton primario-sm" data-accion="generar" title="Guarda y envía la orden a autorización"><i class="ti ti-send" aria-hidden="true"></i> Generar orden</button>` : ''}
                ${pestana === 'PRODUCTOS' && (ed || autz) ? '<button type="button" class="boton secundario-sm" data-accion="marcar"><i class="ti ti-checks" aria-hidden="true"></i> Marcar todo</button><button type="button" class="boton secundario-sm" data-accion="desmarcar"><i class="ti ti-square" aria-hidden="true"></i> Desmarcar todo</button>' : ''}</div></div>
            <div class="bm-panel oq-productos" data-panel="PRODUCTOS" ${pestana === 'PRODUCTOS' ? '' : 'hidden'}>
              <div class="pc-lineas"><table><thead><tr><th class="cc-det">${AUT ? 'Aprueba' : 'Incluir'}</th><th class="pc-n">#</th><th>Código</th><th>Nombre</th><th class="num">Existencia</th><th class="num">Cant. solicita</th>${AUT ? '<th class="num">En tránsito</th>' : ''}<th class="num">Cant. aprueba</th><th class="num">Precio unitario</th><th class="num">Total</th><th></th></tr></thead>
                <tbody>${lineas.map((x, i) => { const pd = prod(x.producto_id); const s = stats.get(x.producto_id) || {}; return `<tr data-linea="${i}" class="${i === elegida ? 'cy-elegida' : ''} ${(AUT ? x.aprueba : x.incluir) ? '' : 'oq-fuera'}">
                  <td class="cc-det"><input type="checkbox" data-l="${AUT ? 'aprueba' : 'incluir'}" ${(AUT ? x.aprueba : x.incluir) ? 'checked' : ''} ${ed || autz ? '' : 'disabled'} aria-label="${AUT ? 'Aprueba' : 'Incluir'}"></td>
                  <td class="pc-n">${i + 1}</td><td class="fuerte">${esc(pd?.codigo_producto || String(pd?.codigo || ''))}</td><td class="cc-nombre" title="${esc(pd?.nombre || '')}">${esc(pd?.nombre || '')}</td>
                  <td class="num">${fmt.monto(s.existencia)}</td>
                  <td class="num"><input type="number" step="0.001" min="0" data-l="cantidad_solicitada" value="${x.cantidad_solicitada || ''}" ${dis} aria-label="Cantidad solicitada"></td>
                  ${AUT ? `<td class="num">${fmt.monto(s.transito)}</td>` : ''}
                  <td class="num oq-aprueba"><input type="number" step="0.001" min="0" data-l="cantidad_aprobada" value="${AUT || x.cantidad_aprobada ? x.cantidad_aprobada : ''}" ${autz ? '' : 'disabled'} aria-label="Cantidad aprobada"></td>
                  <td class="num"><input type="number" step="0.0001" min="0" data-l="precio_unitario" value="${x.precio_unitario || ''}" ${dis} aria-label="Precio unitario"></td>
                  <td class="num" data-tot>${fmt.monto(cant(x) * Number(x.precio_unitario || 0))}</td>
                  <td>${ed ? `<button type="button" class="icono-boton" data-quitar="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`; }).join('')
                  || `<tr><td colspan="${AUT ? 11 : 10}" class="tk-vacio">${ed ? 'Elige el proveedor y la bodega y presiona «Cargar», o agrega los productos.' : 'La orden no tiene productos.'}</td></tr>`}</tbody>
                <tfoot><tr><td colspan="${AUT ? 9 : 8}" class="num">Total de la orden</td><td class="num" data-total>${esc(sim)} ${fmt.monto(totalOrden())}</td><td></td></tr></tfoot></table></div>
              <div class="oq-linea">${l ? `
                <div class="cc-calc"><span>Precio unitario</span><b data-pu>${esc(sim)} ${fmt.monto(l.precio_unitario)}</b></div>
                <div class="cc-calc"><span>Precio total</span><b data-pt>${esc(sim)} ${fmt.monto(cant(l) * Number(l.precio_unitario || 0))}</b></div>
                <div class="cc-calc"><span>Precio unitario MI</span><b data-pum>$ ${fmt.monto(Number(l.precio_unitario || 0) / cambio)}</b></div>
                <div class="cc-calc"><span>Precio total MI</span><b data-ptm>$ ${fmt.monto(cant(l) * Number(l.precio_unitario || 0) / cambio)}</b></div>
                <div class="cc-calc"><span>En tránsito</span><b>${fmt.monto(st.transito)}</b></div>
                <div class="cc-calc"><span>Solicitado</span><b>${fmt.monto(st.solicitado)}</b></div>
                <div class="cc-calc"><span>Mínimo</span><b>${pr?.punto_minimo ? fmt.monto(pr.minimo) : '—'}</b></div>
                <div class="cc-calc"><span>Máximo</span><b>${pr?.punto_minimo ? fmt.monto(pr.maximo) : '—'}</b></div>
                <label class="campo oq-obs-linea"><span>Observaciones de ${esc(pr?.nombre || 'la línea')}</span><input data-obs value="${esc(l.observaciones || '')}" maxlength="200" ${dis}></label>` : '<span class="tk-tenue">Elige un producto para ver sus precios, tránsito, mínimo y máximo.</span>'}
                <span class="oq-control">${o?.aprobado_por ? `Aprobó <b>${esc(o.aprobado_por)}</b> ${esc(fmt.fechaHora(o.aprobado_en))}` : ''}${o?.enviado_por ? ` · Envió <b>${esc(o.enviado_por)}</b> ${esc(fmt.fechaHora(o.enviado_en))}` : ''}${o?.modificado_en ? ` · Modificó <b>${esc(o.modificado_por_nombre || '')}</b> ${esc(fmt.fechaHora(o.modificado_en))}` : ''}</span>
              </div>
            </div>
            <div class="bm-panel" data-panel="COTIZACIONES" ${pestana === 'COTIZACIONES' ? '' : 'hidden'}>
              <div class="pc-lineas"><table><thead><tr><th class="pc-n">#</th><th>Proveedor cotizado</th><th>Fecha</th><th class="num">Valor</th><th class="num">Días entrega</th><th>Observaciones</th><th class="cc-det">Elegida</th><th></th></tr></thead>
                <tbody>${cotiz.map((c, i) => `<tr data-cot="${i}"><td class="pc-n">${i + 1}</td><td><input data-c="proveedor_nombre" value="${esc(c.proveedor_nombre || '')}" maxlength="150" ${dis}></td><td><input type="date" data-c="fecha" value="${esc(c.fecha || '')}" ${dis}></td>
                  <td class="num"><input type="number" step="0.01" min="0" data-c="valor" value="${c.valor ?? ''}" ${dis}></td><td class="num"><input type="number" min="0" data-c="dias_entrega" value="${c.dias_entrega ?? ''}" ${dis}></td>
                  <td><input data-c="observaciones" value="${esc(c.observaciones || '')}" maxlength="200" ${dis}></td><td class="cc-det"><input type="checkbox" data-c="elegida" ${c.elegida ? 'checked' : ''} ${dis}></td>
                  <td>${ed ? `<button type="button" class="icono-boton" data-quitar-cot="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="tk-vacio">Sin cotizaciones.</td></tr>'}</tbody></table></div>
              ${ed ? '<div class="cf-acc"><button type="button" class="boton secundario-sm" data-accion="cotizacion"><i class="ti ti-plus" aria-hidden="true"></i> Cotización</button></div>' : ''}
            </div>
            <div class="bm-panel" data-panel="OTROS" ${pestana === 'OTROS' ? '' : 'hidden'}>
              <div class="cfx oq-otros">
                <label class="campo"><span>Fecha de entrega esperada</span><input type="date" name="fecha_entrega" value="${esc(v.fecha_entrega || '')}" ${dis}></label>
                <label class="campo oq-c2"><span>Lugar de entrega</span><input name="lugar_entrega" value="${esc(v.lugar_entrega || '')}" maxlength="200" ${dis}></label>
                <label class="campo"><span>Contacto de entrega</span><input name="contacto_entrega" value="${esc(v.contacto_entrega || '')}" maxlength="100" ${dis}></label>
                <label class="campo oq-c2"><span>Condiciones</span><input name="condiciones" value="${esc(v.condiciones || '')}" maxlength="300" ${dis}></label>
                <label class="campo oq-c2"><span>Observaciones</span><input name="observaciones" value="${esc(v.observaciones || '')}" maxlength="300" ${dis}></label>
              </div>
            </div>
            <div class="bm-panel bm-listado" data-panel="ORDENES" ${pestana === 'ORDENES' ? '' : 'hidden'}></div>
          </section>
          <datalist id="oq-proveedores">${cat.proveedores.filter((x) => x.estado === 'ACTIVO').map((x) => `<option value="${esc(provTxt(x))}"></option>`).join('')}</datalist>
          <datalist id="oq-productos">${cat.productos.filter((x) => x.estado === 'ACTIVO').map((x) => `<option value="${esc(prodTxt(x))}"></option>`).join('')}</datalist>
        </form>`;
      ctx.pDet.querySelector('[data-panel=ORDENES]').appendChild(ctx.pMae);
      pintarBarra(o, ed);
    }

    function leerLineas() {
      ctx.pDet.querySelectorAll('tr[data-linea]').forEach((tr) => {
        const x = lineas[Number(tr.dataset.linea)];
        tr.querySelectorAll('[data-l]').forEach((el) => { x[el.dataset.l] = el.type === 'checkbox' ? el.checked : Number(el.value) || 0; });
      });
      const obs = ctx.pDet.querySelector('[data-obs]');
      if (obs && lineas[elegida]) lineas[elegida].observaciones = obs.value;
      ctx.pDet.querySelectorAll('tr[data-cot]').forEach((tr) => {
        const c = cotiz[Number(tr.dataset.cot)];
        tr.querySelectorAll('[data-c]').forEach((el) => { c[el.dataset.c] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value; });
      });
    }
    function leer(form) {
      const el = form.elements;
      const p = provDe(el.proveedor.value);
      return { fecha: el.fecha.value, proveedor_id: p ? p.id : null, _prov: el.proveedor.value.trim(), tipo_proveedor_id: el.tipo_proveedor_id.value ? Number(el.tipo_proveedor_id.value) : null,
        forma_pago: el.forma_pago.value, dias_credito: Number(el.dias_credito.value) || 0, moneda_id: Number(el.moneda_id.value), tipo_cambio: Number(el.tipo_cambio.value) || 1,
        bodega_id: Number(el.bodega_id.value) || null, observaciones_internas: el.observaciones_internas.value, observaciones_proveedor: el.observaciones_proveedor.value,
        fecha_entrega: el.fecha_entrega.value || null, lugar_entrega: el.lugar_entrega.value, contacto_entrega: el.contacto_entrega.value, condiciones: el.condiciones.value, observaciones: el.observaciones.value };
    }
    function repintar(c = {}) { const form = ctx.pDet.querySelector('#oq-form'); if (!form) return; leerLineas(); const v = { ...(actual || {}), ...leer(form), ...c }; delete v._prov; pintarDetalle(v); }
    function totales() {
      const form = ctx.pDet.querySelector('#oq-form');
      if (!form) return;
      const sim = ctx.moneda(Number(form.elements.moneda_id.value))?.simbolo || 'Q';
      const cambio = Number(form.elements.tipo_cambio.value) || 1;
      ctx.pDet.querySelectorAll('tr[data-linea]').forEach((tr) => { const x = lineas[Number(tr.dataset.linea)]; tr.querySelector('[data-tot]').textContent = fmt.monto(Number(AUT ? x.cantidad_aprobada : x.cantidad_solicitada) * x.precio_unitario); });
      ctx.pDet.querySelector('[data-total]').textContent = `${sim} ${fmt.monto(totalOrden())}`;
      const l = lineas[elegida];
      if (l && ctx.pDet.querySelector('[data-pu]')) {
        const q = Number(AUT ? l.cantidad_aprobada : l.cantidad_solicitada);
        ctx.pDet.querySelector('[data-pu]').textContent = `${sim} ${fmt.monto(l.precio_unitario)}`;
        ctx.pDet.querySelector('[data-pt]').textContent = `${sim} ${fmt.monto(q * l.precio_unitario)}`;
        ctx.pDet.querySelector('[data-pum]').textContent = `$ ${fmt.monto(l.precio_unitario / cambio)}`;
        ctx.pDet.querySelector('[data-ptm]').textContent = `$ ${fmt.monto(q * l.precio_unitario / cambio)}`;
      }
    }
    const precioSugerido = (pd, provId, monedaId, cambio) => {
      const pp = cat.prodProv.find((x) => x.producto_id === pd.id && x.proveedor_id === provId && x.ultimo_costo);
      const q = Number(pp ? pp.ultimo_costo : pd.precio_costo) || 0;
      return ctx.moneda(monedaId)?.iso === 'GTQ' ? fmt.redondear(q) : fmt.redondear(q / (cambio || 1));
    };
    async function cargar() {
      const form = ctx.pDet.querySelector('#oq-form');
      leerLineas();
      const v = leer(form);
      if (!v.proveedor_id) { form.querySelector('.modal-error').textContent = 'Elige el proveedor para cargar sus productos.'; return; }
      const delProv = new Set(cat.prodProv.filter((x) => x.proveedor_id === v.proveedor_id).map((x) => x.producto_id));
      const lista = cat.productos.filter((p) => p.estado === 'ACTIVO' && (p.proveedor_id === v.proveedor_id || delProv.has(p.id)) && !lineas.some((l) => l.producto_id === p.id));
      if (!lista.length) return window.FIN.aviso('El proveedor no tiene más productos en el catálogo');
      const st = await estadisticas(sb, lista.map((p) => p.id), v.bodega_id, actual?.id);
      lista.forEach((p) => {
        const s = st.get(p.id);
        const sug = p.punto_minimo && s.existencia + s.transito + s.solicitado < Number(p.minimo) ? fmt.redondear(Number(p.maximo) - s.existencia - s.transito - s.solicitado) : 0;
        stats.set(p.id, s);
        lineas.push({ producto_id: p.id, cantidad_solicitada: sug, cantidad_aprobada: 0, aprueba: true, precio_unitario: precioSugerido(p, v.proveedor_id, v.moneda_id, v.tipo_cambio), incluir: sug > 0, cargada: true });
      });
      const conSug = lista.filter((p) => { const s = st.get(p.id); return p.punto_minimo && s.existencia + s.transito + s.solicitado < Number(p.minimo); }).length;
      pintarDetalle({ ...(actual || {}), ...v });
      window.FIN.aviso(`${lista.length} producto(s) cargado(s)${conSug ? ` · ${conSug} bajo su mínimo con la cantidad sugerida` : ''}`);
    }
    async function agregar(texto) {
      const t = String(texto || '').trim().toUpperCase();
      const pd = cat.productos.find((p) => prodTxt(p).toUpperCase() === t) || cat.productos.find((p) => (p.codigo_producto || '').toUpperCase() === t || String(p.codigo) === t);
      if (!pd) return window.FIN.aviso('Ese producto no está en el catálogo');
      leerLineas();
      if (lineas.some((l) => l.producto_id === pd.id)) return window.FIN.aviso('El producto ya está en la orden');
      const v = leer(ctx.pDet.querySelector('#oq-form'));
      lineas.push({ producto_id: pd.id, cantidad_solicitada: 1, cantidad_aprobada: 0, aprueba: true, precio_unitario: precioSugerido(pd, v.proveedor_id, v.moneda_id, v.tipo_cambio), incluir: true });
      const st = await estadisticas(sb, [pd.id], v.bodega_id, actual?.id);
      stats.set(pd.id, st.get(pd.id));
      elegida = lineas.length - 1;
      delete v._prov;
      pintarDetalle({ ...(actual || {}), ...v });
      ctx.pDet.querySelectorAll('[data-l=cantidad_solicitada]')[elegida]?.select();
    }

    async function guardar(form, enviar = false) {
      const error = form.querySelector('.modal-error');
      leerLineas();
      const v = leer(form);
      if (!v.proveedor_id) { error.textContent = v._prov ? 'Ese proveedor no está en el catálogo.' : 'Elige el proveedor.'; return false; }
      if (!v.bodega_id) { error.textContent = 'Elige la bodega.'; return false; }
      const ls = lineas.filter((l) => l.incluir || !enviar);
      const incl = ls.filter((l) => l.incluir !== false);
      if (enviar && !incl.length) { error.textContent = 'Marca al menos un producto para generar la orden.'; return false; }
      const sinCant = incl.find((l) => !(l.cantidad_solicitada > 0));
      if (sinCant) { error.textContent = `Escribe la cantidad de ${prod(sinCant.producto_id)?.nombre}.`; return false; }
      if (enviar && incl.some((l) => !(l.precio_unitario > 0))) { error.textContent = 'Escribe el precio unitario de todos los productos marcados.'; return false; }
      const guardar0 = enviar ? incl : ls.filter((l) => l.cantidad_solicitada > 0);
      if (enviar && lineas.length > incl.length && !confirm(`Se generará la orden solo con los ${incl.length} producto(s) marcado(s). ¿Continuar?`)) return false;
      delete v._prov;
      error.textContent = '';
      try {
        let id = actual?.id;
        if (actual) { const r = await sb.from('ordenes_compra').update(v).eq('id', id); if (r.error) throw r.error; }
        else { const r = await sb.from('ordenes_compra').insert({ ...v, folio: 0, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single(); if (r.error) throw r.error; id = r.data.id; }
        const d = await sb.from('orden_compra_lineas').delete().eq('orden_id', id); if (d.error) throw d.error;
        if (guardar0.length) { const r = await sb.from('orden_compra_lineas').insert(guardar0.map((l, i) => ({ orden_id: id, linea: i + 1, producto_id: l.producto_id, cantidad_solicitada: l.cantidad_solicitada, precio_unitario: l.precio_unitario || 0, observaciones: l.observaciones || null }))); if (r.error) throw r.error; }
        const dc = await sb.from('orden_cotizaciones').delete().eq('orden_id', id); if (dc.error) throw dc.error;
        const cs = cotiz.filter((c) => String(c.proveedor_nombre || '').trim());
        if (cs.length) { const r = await sb.from('orden_cotizaciones').insert(cs.map((c, i) => ({ orden_id: id, linea: i + 1, proveedor_nombre: c.proveedor_nombre.trim(), fecha: c.fecha || null, valor: c.valor || 0, dias_entrega: c.dias_entrega ?? null, observaciones: c.observaciones || null, elegida: !!c.elegida }))); if (r.error) throw r.error; }
        if (enviar) {
          const r = await sb.rpc('procesar_orden', { p_id: id, p_accion: 'ENVIAR' });
          if (r.error) throw r.error;
          window.FIN.aviso(`Orden ${r.data.numero} enviada a autorización`);
        } else window.FIN.aviso(actual ? 'Orden guardada' : 'Orden registrada');
        editando = false;
        if (enviar && f.estado === 'PENDIENTES') { f.estado = 'TODAS'; pintarFiltros(); }
        actual = { id };
        await consultar(id);
        return true;
      } catch (err) { error.textContent = window.UI.traducirError(err); return false; }
    }
    async function procesar(accion) {
      let motivo = null;
      if (accion === 'RECHAZAR' || accion === 'ANULAR' || accion === 'DEVOLVER') { motivo = prompt(`Motivo para ${accion === 'RECHAZAR' ? 'rechazar' : accion === 'DEVOLVER' ? 'devolver' : 'anular'} la orden ${actual.numero}:`); if (motivo === null) return; }
      const form = ctx.pDet.querySelector('#oq-form');
      if (accion === 'APROBAR') {
        leerLineas();
        if (!lineas.some((l) => l.aprueba && l.cantidad_aprobada > 0)) { form.querySelector('.modal-error').textContent = 'Aprueba al menos un producto con su cantidad.'; return; }
        const mas = lineas.find((l) => l.cantidad_aprobada > l.cantidad_solicitada);
        if (mas) { form.querySelector('.modal-error').textContent = `Se aprueba más de lo solicitado en ${prod(mas.producto_id)?.nombre}.`; return; }
        for (const l of lineas) {
          const r = await sb.from('orden_compra_lineas').update({ cantidad_aprobada: l.aprueba ? l.cantidad_aprobada : 0, aprueba: l.aprueba }).eq('id', l.id);
          if (r.error) { form.querySelector('.modal-error').textContent = window.UI.traducirError(r.error); return; }
        }
        if (!confirm(`¿Aprobar la orden ${actual.numero} por ${ctx.moneda(actual.moneda_id)?.simbolo || 'Q'} ${fmt.monto(totalOrden())}?`)) return;
      }
      const { error } = await sb.rpc('procesar_orden', { p_id: actual.id, p_accion: accion, p_motivo: motivo });
      if (error) { form.querySelector('.modal-error').textContent = window.UI.traducirError(error); return; }
      window.FIN.aviso({ APROBAR: 'Orden aprobada', RECHAZAR: 'Orden rechazada', DEVOLVER: 'Orden devuelta', ANULAR: 'Orden anulada' }[accion]);
      await consultar(AUT && accion !== 'ANULAR' ? null : actual.id);
    }
    function imprimirOrden() {
      const o = actual;
      const p = prov(o.proveedor_id);
      const sim = ctx.moneda(o.moneda_id)?.simbolo || 'Q';
      const emp = ctx.localidad(o.localidad_id);
      const apro = !['INGRESADA', 'EN AUTORIZACIÓN', 'RECHAZADA'].includes(o.estado);
      const ls = lineas.filter((l) => !apro || (l.aprueba && l.cantidad_aprobada > 0));
      imprimir(`Orden de compra ${o.numero}`, `
        <h1>Orden de compra ${esc(o.numero)}</h1><h2>${esc(emp ? emp.nombre_comercial : '')} · Folio ${o.folio} · ${esc(o.estado)}</h2>
        <div class="cab"><div style="grid-column:span 2"><b>Proveedor</b>${esc(p ? `${p.codigo} · ${p.nombre_fiscal || p.nombre_comercial}` : '')}</div><div><b>Fecha</b>${esc(fmt.fechaDia(o.fecha))}</div><div><b>Bodega</b>${esc(bodega(o.bodega_id)?.nombre || '')}</div>
          <div><b>Forma de pago</b>${esc(o.forma_pago)}${o.dias_credito ? ` · ${o.dias_credito} días` : ''}</div><div><b>Moneda</b>${esc(ctx.moneda(o.moneda_id)?.nombre || '')}</div><div><b>Entrega</b>${esc(fmt.fechaDia(o.fecha_entrega))} ${esc(o.lugar_entrega || '')}</div><div><b>Aprobó</b>${esc(o.aprobado_por || '')}</div>
          <div style="grid-column:1/-1"><b>Observaciones</b>${esc(o.observaciones_proveedor || '')}</div></div>
        <table><thead><tr><th>#</th><th>Código</th><th>Producto</th><th class="n">Cantidad</th><th class="n">Precio unitario</th><th class="n">Total</th></tr></thead>
          <tbody>${ls.map((l, i) => { const pd = prod(l.producto_id); const q = apro ? l.cantidad_aprobada : l.cantidad_solicitada; return `<tr><td>${i + 1}</td><td>${esc(pd?.codigo_producto || '')}</td><td>${esc(pd?.nombre || '')}</td><td class="n">${fmt.monto(q)}</td><td class="n">${fmt.monto(l.precio_unitario)}</td><td class="n">${fmt.monto(q * l.precio_unitario)}</td></tr>`; }).join('')}</tbody>
          <tfoot><tr><td colspan="5">Total</td><td class="n">${esc(sim)} ${fmt.monto(ls.reduce((t, l) => t + (apro ? l.cantidad_aprobada : l.cantidad_solicitada) * l.precio_unitario, 0))}</td></tr></tfoot></table>
        <div class="firmas"><div>Solicitó</div><div>Autorizó</div><div>Proveedor</div></div>`);
    }

    // ---------- Eventos ----------
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { pintarFiltros(); return cargarLocalidad(); }
      if (cambio === 'otro') { f[e.target.name] = e.target.value; if (f.hasta < f.desde) { if (e.target.name === 'desde') f.hasta = f.desde; else f.desde = f.hasta; } pintarFiltros(); actual = null; return consultar(); }
      const form = e.target.closest('#oq-form');
      if (!form) return;
      if (e.target.matches('[data-agregar]')) { const t = e.target.value; e.target.value = ''; return agregar(t); }
      if (e.target.name === 'proveedor') {
        const p = provDe(e.target.value);
        if (!p) { form.querySelector('.modal-error').textContent = e.target.value.trim() ? 'Ese proveedor no está en el catálogo.' : ''; return; }
        return repintar({ proveedor_id: p.id, tipo_proveedor_id: p.tipo_proveedor_id, forma_pago: p.dias_credito ? 'CRÉDITO' : 'CONTADO', dias_credito: p.dias_credito || 0, ...(p.moneda_id ? { moneda_id: p.moneda_id } : {}) });
      }
      if (e.target.name === 'forma_pago') return repintar();
      if (e.target.name === 'bodega_id') { leerLineas(); await recargarStats(Number(e.target.value)); return repintar(); }
      if (e.target.closest('tr[data-linea]') && e.target.type === 'checkbox') { leerLineas(); e.target.closest('tr').classList.toggle('oq-fuera', !e.target.checked); return totales(); }
    });
    cont.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar]')) { buscar = e.target.value; const pos = e.target.selectionStart; pintarLista(); const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos); return; }
      if (e.target.closest('tr[data-linea]') || ['tipo_cambio', 'moneda_id'].includes(e.target.name)) { leerLineas(); totales(); }
    });
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.target.matches('[data-buscar]') || e.target.matches('[data-agregar]'))) { e.preventDefault(); if (e.target.matches('[data-agregar]')) { const t = e.target.value; e.target.value = ''; agregar(t); } }
    });
    cont.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-pestana]');
      if (tab) { pestana = tab.dataset.pestana; return repintar(); }
      const fila = e.target.closest('tr[data-orden]');
      if (fila) { pestana = 'PRODUCTOS'; return abrir(ordenes.find((o) => String(o.id) === fila.dataset.orden)); }
      const tl = e.target.closest('tr[data-linea]');
      if (tl && !e.target.closest('input, button')) { leerLineas(); elegida = Number(tl.dataset.linea); return repintar(); }
      const q = e.target.closest('[data-quitar]');
      if (q) { leerLineas(); lineas.splice(Number(q.dataset.quitar), 1); elegida = Math.min(elegida, Math.max(0, lineas.length - 1)); return repintar(); }
      const qc = e.target.closest('[data-quitar-cot]');
      if (qc) { leerLineas(); cotiz.splice(Number(qc.dataset.quitarCot), 1); return repintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (!a) return;
      if (a === 'nueva') { actual = null; editando = true; lineas = []; cotiz = []; stats = new Map(); elegida = 0; pestana = 'PRODUCTOS'; ctx.pMae.querySelectorAll('tr.actual').forEach((tr) => tr.classList.remove('actual')); pintarDetalle(); return ctx.pDet.querySelector('[name=proveedor]')?.focus(); }
      if (a === 'modificar') { editando = true; return pintarDetalle(); }
      if (a === 'cancelar') return actual ? abrir(actual) : abrir(ordenes[0] || null);
      if (a === 'cargar') return cargar();
      if (a === 'reversar') { leerLineas(); const n = lineas.filter((l) => l.cargada).length; if (!n) return window.FIN.aviso('No hay una carga que reversar'); lineas = lineas.filter((l) => !l.cargada); elegida = 0; repintar(); return window.FIN.aviso(`${n} producto(s) quitado(s)`); }
      if (a === 'marcar' || a === 'desmarcar') { leerLineas(); lineas.forEach((l) => { if (AUT) { l.aprueba = a === 'marcar'; if (l.aprueba && !l.cantidad_aprobada) l.cantidad_aprobada = l.cantidad_solicitada; } else l.incluir = a === 'marcar'; }); return repintar(); }
      if (a === 'generar') return guardar(ctx.pDet.querySelector('#oq-form'), true);
      if (a === 'cotizacion') { leerLineas(); cotiz.push({ proveedor_nombre: '', fecha: fmt.hoy(), valor: null, dias_entrega: null, observaciones: '', elegida: false }); return repintar(); }
      if (a === 'imprimir') return imprimirOrden();
      if (['APROBAR', 'RECHAZAR', 'DEVOLVER', 'ANULAR'].includes(a)) return procesar(a);
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('#oq-form')) { e.preventDefault(); guardar(e.target); } });
    iniciar();
  }
  window.PANTALLAS['solicitudes-de-compra'] = (cont) => pantallaOrden(cont, 'SOLICITUD');
  window.PANTALLAS['autorizaciones-de-compras'] = (cont) => pantallaOrden(cont, 'AUTORIZACION');

  // ===================== Autorizar órdenes =====================
  window.PANTALLAS['autorizar-ordenes'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Aprobación de órdenes de compra', icono: 'ti-list-check', clase: 'oq-aprobacion', grupo: 'Compras · Órdenes de compra' });
    const { sb } = ctx;
    let ordenes = [], proveedores = [];
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('ordenes_compra').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/ordenes_compra/.test(prueba.error.message) ? AVISO : esc(prueba.error.message)}</p></section>`; return; }
      ctx.filtros('', '<button type="button" class="boton secundario-sm" data-accion="actualizar"><i class="ti ti-refresh" aria-hidden="true"></i> Actualizar</button>');
      await consultar();
    }
    async function consultar() {
      const loc = ctx.sel.loc || 0;
      const [p, o] = await Promise.all([
        sb.from('proveedores').select('id, codigo, nombre_comercial').eq('localidad_id', loc),
        sb.from('ordenes_compra').select('*, orden_compra_lineas(cantidad_solicitada, precio_unitario)').eq('localidad_id', loc).eq('estado', 'EN AUTORIZACIÓN').order('fecha', { ascending: false })
      ]);
      proveedores = p.data || [];
      ordenes = (o.data || []).map((x) => ({ ...x, total: x.orden_compra_lineas.reduce((t, l) => t + Number(l.cantidad_solicitada) * Number(l.precio_unitario), 0) }));
      pintar();
    }
    function pintar() {
      ctx.pMae.innerHTML = `
        <div class="cl-clasico oq-aprob">
          <div class="cl-banda">Aprobación de órdenes de compra</div>
          <div class="ta-tabla cc-tabla"><table><thead><tr><th class="num">Orden</th><th>Cod. orden</th><th>Proveedor</th><th>Fecha</th><th>Usr. ingresa</th><th>Estado</th><th>Nombre estado</th><th class="num">Total</th><th></th></tr></thead>
            <tbody>${ordenes.map((o) => `<tr><td class="num fuerte">${o.folio}</td><td>${esc(o.numero || '')}</td><td class="cc-nombre">${esc(proveedores.find((p) => p.id === o.proveedor_id)?.nombre_comercial || '')}</td><td>${esc(fmt.fechaDia(o.fecha))}</td>
              <td>${esc(o.usuario || '')}</td><td><b>EAU</b></td><td>${marca(o.estado)}</td><td class="num">${esc(ctx.moneda(o.moneda_id)?.simbolo || 'Q')} ${fmt.monto(o.total)}</td>
              <td><button type="button" class="boton primario-sm" data-ver="${o.id}"><i class="ti ti-eye" aria-hidden="true"></i> Ver</button></td></tr>`).join('')
              || `<tr><td colspan="9" class="tk-vacio"><i class="ti ti-circle-check" aria-hidden="true"></i>${ctx.sel.loc ? 'No hay órdenes esperando autorización.' : 'Elige la empresa.'}</td></tr>`}</tbody></table></div>
        </div>`;
      ctx.pDet.innerHTML = '';
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') { ctx.filtros('', '<button type="button" class="boton secundario-sm" data-accion="actualizar"><i class="ti ti-refresh" aria-hidden="true"></i> Actualizar</button>'); consultar(); } });
    cont.addEventListener('click', (e) => {
      const v = e.target.closest('[data-ver]');
      if (v) { guardarSesion('fin.orden.ver', v.dataset.ver); location.hash = '#/compras/autorizaciones-de-compras'; return; }
      if (e.target.closest('[data-accion=actualizar]')) consultar();
    });
    iniciar();
  };

  // ===================== Órdenes de compra · ingresos basados en órdenes =====================
  window.PANTALLAS['ordenes-de-compra'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Ingresos basados en órdenes', icono: 'ti-truck-delivery', clase: 'bk-movimientos oq-ingresos', grupo: 'Compras · Órdenes de compra' });
    const { sb, yo } = ctx;
    const [anio, mes] = fmt.hoy().split('-');
    const f = { estado: 'TODOS', desde: `${anio}-${String(Number(mes) - 2 > 0 ? Number(mes) - 2 : 1).padStart(2, '0')}-01`, hasta: fmt.hoy() };
    let cat = { proveedores: [], bodegas: [], productos: [] }, transacciones = [];
    let ingresos = [], ordenesAbiertas = [], actual = null, lineas = [], saldos = [], editando = false, pestana = 'DETALLE', buscar = '';
    let generarCompra = true;
    const prov = (id) => cat.proveedores.find((p) => p.id === id);
    const prod = (id) => cat.productos.find((p) => p.id === id);
    const editable = () => ctx.admin && (!actual || (editando && actual.estado === 'VIGENTE'));
    const total = () => fmt.redondear(lineas.reduce((t, l) => t + Number(l.cantidad || 0) * Number(l.costo_unitario || 0), 0));

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Estado</span><select name="estado">${['TODOS', 'VIGENTE', 'APLICADO', 'ANULADO'].map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>`, '<div class="cf-barra" data-barra></div>');
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('ingresos_compra').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/ingresos_compra/.test(prueba.error.message) ? AVISO : esc(prueba.error.message)}</p></section>`; return; }
      pintarFiltros();
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      cat = await catalogos(sb, ctx.sel.loc);
      transacciones = await window.COMPRAS_CAT.transaccionesLocalidad(sb, ctx.sel.loc);
      actual = null; editando = false;
      await consultar();
    }
    async function consultar(id = actual?.id) {
      if (!ctx.sel.loc) { ingresos = []; pintarLista(); return abrir(null); }
      let q = sb.from('ingresos_compra').select('*, ingreso_lineas(cantidad, costo_unitario), ordenes_compra(numero, folio)').eq('localidad_id', ctx.sel.loc).gte('fecha_ingreso', f.desde).lte('fecha_ingreso', f.hasta).order('numero', { ascending: false });
      if (f.estado !== 'TODOS') q = q.eq('estado', f.estado);
      const [{ data, error }, oa] = await Promise.all([q, sb.from('ordenes_compra').select('id, folio, numero, proveedor_id, bodega_id, moneda_id, tipo_cambio, forma_pago, dias_credito, estado').eq('localidad_id', ctx.sel.loc).in('estado', ['AUTORIZADA', 'RECIBIDA PARCIAL']).order('folio', { ascending: false })]);
      if (error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      ordenesAbiertas = oa.data || [];
      ingresos = (data || []).map((i) => ({ ...i, total: i.ingreso_lineas.reduce((t, l) => t + Number(l.cantidad) * Number(l.costo_unitario), 0) - Number(i.valor_descuento) }));
      pintarLista();
      await abrir(ingresos.find((i) => i.id === id) || (id === null ? null : ingresos[0]) || null);
    }
    function pintarLista() {
      const q = buscar.trim().toLowerCase();
      const filas = ingresos.filter((i) => !q || [i.numero, i.documento, i.ordenes_compra?.numero, prov(i.proveedor_id)?.nombre_comercial].some((v) => String(v || '').toLowerCase().includes(q)));
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab tg-cab"><h2>Ingresos <small>${ingresos.length}</small></h2>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Ingreso, orden, documento, proveedor…" value="${esc(buscar)}" aria-label="Buscar ingresos"></label></header>
        <div class="ta-tabla"><table><thead><tr><th class="num">Ingreso</th><th>Fecha</th><th>Orden</th><th>Proveedor</th><th>Documento</th><th class="num">Valor total</th><th>Compra</th><th>Estado</th></tr></thead>
          <tbody>${filas.map((i) => `<tr data-ingreso="${i.id}" class="${actual && actual.id === i.id ? 'actual' : ''} ${i.estado === 'ANULADO' ? 'pc-anulada' : ''}" tabindex="0"><td class="num fuerte">${i.numero}</td><td>${esc(fmt.fechaDia(i.fecha_ingreso))}</td><td>${esc(i.ordenes_compra?.numero || '')}</td>
            <td class="ta-desc">${esc(prov(i.proveedor_id)?.nombre_comercial || '')}</td><td>${esc([i.serie, i.documento].filter(Boolean).join('-'))}</td><td class="num">${fmt.monto(i.total)}</td><td>${i.compra_id ? '<span class="pc-tipo">Generada</span>' : '<span class="tk-tenue">—</span>'}</td>
            <td><span class="pc-marca ${i.estado === 'APLICADO' ? 'definitiva' : i.estado === 'ANULADO' ? 'anulada' : 'pendiente'}">${esc(i.estado)}</span></td></tr>`).join('')
            || `<tr><td colspan="8" class="tk-vacio"><i class="ti ti-truck-delivery" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : 'No hay ingresos con esos filtros.'}</td></tr>`}</tbody></table></div>`;
    }
    async function abrir(i, editar = false) {
      actual = i; editando = editar; lineas = []; saldos = [];
      if (i) {
        const { data } = await sb.from('ingreso_lineas').select('*').eq('ingreso_id', i.id).order('linea');
        lineas = (data || []).map((x) => ({ ...x, cantidad: Number(x.cantidad), costo_unitario: Number(x.costo_unitario) }));
        await cargarSaldos(i.orden_id);
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-ingreso]').forEach((tr) => tr.classList.toggle('actual', !!i && tr.dataset.ingreso === String(i.id)));
    }
    async function cargarSaldos(orden) {
      if (!orden) { saldos = []; return; }
      const { data } = await sb.from('orden_lineas_saldo').select('*').eq('orden_id', orden).order('linea');
      saldos = data || [];
    }
    const saldoOrden = () => fmt.redondear(saldos.reduce((t, s) => t + Number(s.saldo), 0));

    function pintarBarra(i, ed) {
      const b = ctx.pFil.querySelector('[data-barra]');
      if (!b) return;
      b.innerHTML = `
        <div class="cf-quien">${i ? `<small>Ingreso ${i.numero} · orden ${esc(i.ordenes_compra?.numero || '')}</small><b>${esc(prov(i.proveedor_id)?.nombre_comercial || '')}</b>` : ed ? '<small>Nuevo ingreso</small><b>Elige la orden autorizada</b>' : ''}</div>
        <div class="cf-marcas">${i ? `<span class="pc-marca ${i.estado === 'APLICADO' ? 'definitiva' : i.estado === 'ANULADO' ? 'anulada' : 'pendiente'}">${esc(i.estado)}</span>` : ''}</div>
        <div class="cf-botones">
          ${ctx.admin && !ed ? '<button type="button" class="boton secundario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>' : ''}
          ${ctx.admin && i && !ed && i.estado === 'VIGENTE' ? '<button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}
          ${ed ? `${i || ingresos.length ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}<button type="submit" form="oi-form" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button>` : ''}
        </div>`;
    }

    function pintarDetalle(v0) {
      const i = actual;
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-truck-delivery'); pintarBarra(null, false); return; }
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const v = v0 || (i ? { ...i } : { fecha_ingreso: fmt.hoy(), orden_id: null, valor_descuento: 0 });
      const o = ordenesAbiertas.find((x) => x.id === v.orden_id) || (i ? { numero: i.ordenes_compra?.numero, folio: i.ordenes_compra?.folio } : null);
      const sim = ctx.moneda(v.moneda_id)?.simbolo || 'Q';
      const bod = cat.bodegas.find((b) => b.id === v.bodega_id);
      const valorTotal = fmt.redondear(total() - Number(v.valor_descuento || 0));
      ctx.pDet.innerHTML = `
        <form id="oi-form" class="tk-form ta-form bm-form cf-form cl-clasico cf-compacto oi-form" novalidate>
          <div class="cl-banda">Ingresos de compras basadas en órdenes</div>
          <p class="modal-error tk-error" role="alert"></p>
          ${i?.estado === 'ANULADO' ? `<p class="tk-aviso bm-anulado"><i class="ti ti-ban" aria-hidden="true"></i> Anulado por ${esc(i.anulado_por || '')}: ${esc(i.motivo_anulacion || '')}</p>` : ''}
          <section class="bm-bloque oi-cab"><div class="cfx oi-g">
            <div class="campo cf-numero"><span>Ingreso</span><b>${i ? i.numero : 'Auto'}</b></div>
            <label class="campo"><span>Fecha ingreso</span><input type="date" name="fecha_ingreso" value="${esc(v.fecha_ingreso || '')}" ${dis}></label>
            <label class="campo oq-c3"><span>Orden de compra *</span><select name="orden_id" ${dis || (i ? 'disabled' : '')}><option value="">${ordenesAbiertas.length || i ? 'Elige la orden autorizada' : 'No hay órdenes autorizadas por recibir'}</option>${(i && !ordenesAbiertas.some((x) => x.id === i.orden_id) ? [{ id: i.orden_id, folio: o?.folio, numero: o?.numero, proveedor_id: i.proveedor_id }] : []).concat(ordenesAbiertas).map((x) => `<option value="${x.id}" ${x.id === v.orden_id ? 'selected' : ''}>${esc(x.numero || '')} · ${esc(prov(x.proveedor_id)?.nombre_comercial || '')}</option>`).join('')}</select></label>
            <div class="campo oq-c2"><span>Bodega</span><b class="oq-num">${bod ? `${bod.codigo} · ${esc(bod.nombre)}` : '—'}</b></div>
            <label class="campo"><span>Moneda</span><select name="moneda_id" ${dis}>${ctx.monedas.map((m) => `<option value="${m.id}" ${m.id === v.moneda_id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
            <label class="campo"><span>Valor cambio</span><input type="number" step="any" min="0" name="tipo_cambio" value="${esc(String(v.tipo_cambio ?? 1))}" ${dis}></label>
            <div class="campo"><span>Estado</span><b class="oq-num">${esc(i ? i.estado : 'VIGENTE')}</b></div>
            <div class="cc-calc oi-total"><span>Valor total</span><b data-vt>${esc(sim)} ${fmt.monto(valorTotal)}</b></div>
            <div class="campo"><span>Compra</span>${i?.compra_id ? `<a class="pc-tipo oq-num" href="#/compras/facturas-compra" title="Abrir en Facturas de compra">Generada</a>` : '<b class="oq-num tk-tenue">—</b>'}</div>
            <label class="campo"><span>Serie doc.</span><input name="serie" value="${esc(v.serie || '')}" maxlength="20" ${dis}></label>
            <label class="campo"><span>Documento</span><input name="documento" value="${esc(v.documento || '')}" maxlength="40" placeholder="Factura del proveedor" ${dis}></label>
            <label class="campo"><span>Fecha doc.</span><input type="date" name="fecha_documento" value="${esc(v.fecha_documento || '')}" ${dis}></label>
            <label class="campo oq-c2"><span>Transacción</span><select name="transaccion_id" ${dis}>${window.COMPRAS_CAT.opcionesTrx(transacciones, v.transaccion_id)}</select></label>
            <label class="campo"><span>Forma de pago</span><select name="forma_pago" ${dis}>${['CONTADO', 'CRÉDITO'].map((x) => `<option ${v.forma_pago === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
            <label class="campo"><span>Días crédito</span><input type="number" min="0" max="365" name="dias_credito" value="${esc(String(v.dias_credito ?? 0))}" ${dis || (v.forma_pago === 'CONTADO' ? 'disabled' : '')}></label>
            <label class="campo"><span>Valor descuento</span><input type="number" step="0.01" min="0" name="valor_descuento" value="${esc(String(v.valor_descuento ?? 0))}" ${dis}></label>
            <div class="cc-calc"><span>Saldo de la orden</span><b>${fmt.monto(saldoOrden())}</b></div>
            <label class="campo oq-c3"><span>Observaciones</span><input name="observaciones" value="${esc(v.observaciones || '')}" maxlength="300" ${dis}></label>
          </div></section>
          <section class="bm-pestanas">
            <div class="bm-tabs-barra"><div class="rp-pestanas" role="tablist">${[['DETALLE', 'Productos recibidos', 'ti-package', lineas.length], ['LISTA', 'Listado de ingresos', 'ti-list-search', ingresos.length]].map(([k, t, ic, n]) => `<button type="button" role="tab" data-pestana="${k}" class="${pestana === k ? 'activa' : ''}" aria-selected="${pestana === k}"><i class="ti ${ic}" aria-hidden="true"></i> ${t}${n ? ` <b>${n}</b>` : ''}</button>`).join('')}</div>
              <div class="oq-tab-acc">
                ${ed && pestana === 'DETALLE' ? `<button type="button" class="boton secundario-sm" data-accion="saldos" ${v.orden_id ? '' : 'disabled'} title="Trae lo pendiente de recibir de la orden"><i class="ti ti-download" aria-hidden="true"></i> Cargar saldos</button>` : ''}
                ${i && !ed && ctx.admin && i.estado === 'VIGENTE' ? `<label class="pc-check" title="Crea la factura en Facturas de compra si el ingreso tiene documento"><input type="checkbox" data-generar ${generarCompra ? 'checked' : ''}> Generar factura</label><button type="button" class="boton primario-sm" data-accion="APLICAR"><i class="ti ti-package-import" aria-hidden="true"></i> Aplicar inventario</button><button type="button" class="boton secundario-sm rp-peligro" data-accion="ANULAR"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>` : ''}
                ${i && !ed && ctx.admin && i.estado === 'APLICADO' ? '<button type="button" class="boton secundario-sm" data-accion="REVERTIR"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Revertir inventario</button>' : ''}
              </div></div>
            <div class="bm-panel" data-panel="DETALLE" ${pestana === 'DETALLE' ? '' : 'hidden'}>
              <div class="pc-lineas"><table><thead><tr><th>Código</th><th>Descripción</th><th>Lote</th><th>Fecha vencimiento</th><th>Fecha fabricación</th><th class="num">Cantidad</th><th class="num">Cant. aprobada</th><th class="num">Saldo</th><th class="num">Costo unitario</th><th class="num">Costo total</th><th class="cc-det">Invent.</th><th></th></tr></thead>
                <tbody>${lineas.map((l, k) => { const s = saldos.find((x) => x.id === l.orden_linea_id) || {}; const pd = prod(s.producto_id || l.producto_id); return `<tr data-il="${k}">
                  <td class="fuerte">${esc(pd?.codigo_producto || String(pd?.codigo || ''))}</td><td class="cc-nombre" title="${esc(pd?.nombre || '')}">${esc(pd?.nombre || '')}</td>
                  <td><input data-i="lote" value="${esc(l.lote || '')}" maxlength="30" ${dis}></td><td><input type="date" data-i="fecha_vencimiento" value="${esc(l.fecha_vencimiento || '')}" ${dis}></td><td><input type="date" data-i="fecha_fabricacion" value="${esc(l.fecha_fabricacion || '')}" ${dis}></td>
                  <td class="num"><input type="number" step="0.001" min="0" data-i="cantidad" value="${l.cantidad || ''}" ${dis}></td><td class="num oq-aprueba">${fmt.monto(s.cantidad_aprobada)}</td><td class="num">${fmt.monto(s.saldo)}</td>
                  <td class="num"><input type="number" step="0.0001" min="0" data-i="costo_unitario" value="${l.costo_unitario || ''}" ${dis}></td><td class="num" data-ct>${fmt.monto(Number(l.cantidad || 0) * Number(l.costo_unitario || 0))}</td>
                  <td class="cc-det"><i class="ti ${l.inventariado ? 'ti-square-check cc-si' : 'ti-square cc-no'}" aria-label="${l.inventariado ? 'Inventariado' : 'Sin inventariar'}"></i></td>
                  <td>${ed ? `<button type="button" class="icono-boton" data-quitar="${k}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`; }).join('')
                  || `<tr><td colspan="12" class="tk-vacio">${ed ? 'Elige la orden y presiona «Cargar saldos».' : 'Sin productos.'}</td></tr>`}</tbody>
                <tfoot><tr><td colspan="9" class="num">Costo total</td><td class="num" data-total>${esc(sim)} ${fmt.monto(total())}</td><td colspan="2"></td></tr></tfoot></table></div>
            </div>
            <div class="bm-panel bm-listado" data-panel="LISTA" ${pestana === 'LISTA' ? '' : 'hidden'}></div>
          </section>
        </form>`;
      ctx.pDet.querySelector('[data-panel=LISTA]').appendChild(ctx.pMae);
      pintarBarra(i, ed);
    }
    function leerLineas() {
      ctx.pDet.querySelectorAll('tr[data-il]').forEach((tr) => {
        const l = lineas[Number(tr.dataset.il)];
        tr.querySelectorAll('[data-i]').forEach((el) => { l[el.dataset.i] = el.type === 'number' ? Number(el.value) || 0 : el.value || null; });
      });
    }
    function leer(form) {
      const el = form.elements;
      const t = (n) => el[n].value.trim() || null;
      return { fecha_ingreso: el.fecha_ingreso.value, orden_id: Number(el.orden_id.value) || actual?.orden_id || null, moneda_id: Number(el.moneda_id.value), tipo_cambio: Number(el.tipo_cambio.value) || 1,
        serie: t('serie'), documento: t('documento'), fecha_documento: el.fecha_documento.value || null, transaccion_id: el.transaccion_id.value ? Number(el.transaccion_id.value) : null,
        forma_pago: el.forma_pago.value, dias_credito: Number(el.dias_credito.value) || 0, valor_descuento: Number(el.valor_descuento.value) || 0, observaciones: t('observaciones'),
        bodega_id: actual?.bodega_id || ordenesAbiertas.find((o) => o.id === Number(el.orden_id.value))?.bodega_id || null };
    }
    function repintar(c = {}) { const form = ctx.pDet.querySelector('#oi-form'); if (!form) return; leerLineas(); pintarDetalle({ ...(actual || {}), ...leer(form), ...c }); }
    function cargarDeSaldos() {
      leerLineas();
      const usadas = new Set(lineas.map((l) => l.orden_linea_id));
      const nuevas = saldos.filter((s) => Number(s.saldo) > 0 && !usadas.has(s.id));
      if (!nuevas.length) return window.FIN.aviso('La orden no tiene más saldo por recibir');
      lineas.push(...nuevas.map((s) => ({ orden_linea_id: s.id, producto_id: s.producto_id, lote: null, fecha_vencimiento: null, fecha_fabricacion: null, cantidad: Number(s.saldo), costo_unitario: Number(s.precio_unitario), inventariado: false })));
      repintar();
      window.FIN.aviso(`${nuevas.length} producto(s) con su saldo cargado(s)`);
    }
    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      leerLineas();
      const v = leer(form);
      if (!v.orden_id) { error.textContent = 'Elige la orden de compra autorizada.'; return; }
      const ls = lineas.filter((l) => l.cantidad > 0);
      if (!ls.length) { error.textContent = 'Carga los saldos de la orden o escribe las cantidades recibidas.'; return; }
      const mas = ls.find((l) => { const s = saldos.find((x) => x.id === l.orden_linea_id); return s && l.cantidad > Number(s.saldo) + 0.0001; });
      if (mas) { error.textContent = `Se recibe más del saldo de la orden en ${prod(mas.producto_id)?.nombre}.`; return; }
      error.textContent = '';
      try {
        let id = actual?.id;
        if (actual) { const r = await sb.from('ingresos_compra').update(v).eq('id', id); if (r.error) throw r.error; }
        else { const o = ordenesAbiertas.find((x) => x.id === v.orden_id); const r = await sb.from('ingresos_compra').insert({ ...v, numero: 0, proveedor_id: o.proveedor_id, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single(); if (r.error) throw r.error; id = r.data.id; }
        const d = await sb.from('ingreso_lineas').delete().eq('ingreso_id', id); if (d.error) throw d.error;
        const r = await sb.from('ingreso_lineas').insert(ls.map((l, k) => ({ ingreso_id: id, linea: k + 1, orden_linea_id: l.orden_linea_id, producto_id: l.producto_id, lote: l.lote, fecha_vencimiento: l.fecha_vencimiento, fecha_fabricacion: l.fecha_fabricacion, cantidad: l.cantidad, costo_unitario: l.costo_unitario })));
        if (r.error) throw r.error;
        window.FIN.aviso(actual ? 'Ingreso guardado' : 'Ingreso registrado: ya puedes aplicar el inventario');
        editando = false; actual = { id };
        await consultar(id);
      } catch (err) { error.textContent = window.UI.traducirError(err); }
    }
    async function procesar(accion) {
      let motivo = null;
      if (accion === 'ANULAR') { motivo = prompt(`Motivo de la anulación del ingreso ${actual.numero}:`); if (motivo === null) return; }
      if (accion === 'APLICAR' && !confirm(`¿Aplicar al inventario de la bodega el ingreso ${actual.numero}?${generarCompra && actual.documento ? '\n\nTambién se genera la factura de compra.' : ''}`)) return;
      if (accion === 'REVERTIR' && !confirm(`¿Revertir el inventario del ingreso ${actual.numero}?${actual.compra_id ? ' Su factura de compra se anula.' : ''}`)) return;
      const { data, error } = await sb.rpc('procesar_ingreso', { p_id: actual.id, p_accion: accion, p_generar_compra: generarCompra, p_motivo: motivo });
      if (error) { const e = ctx.pDet.querySelector('.modal-error'); if (e) e.textContent = window.UI.traducirError(error); return; }
      window.FIN.aviso(accion === 'APLICAR' ? `Inventario aplicado${data?.compra ? ` · compra ${data.compra} generada` : ''}` : accion === 'REVERTIR' ? 'Inventario revertido' : 'Ingreso anulado');
      await consultar(actual.id);
    }

    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { pintarFiltros(); return cargarLocalidad(); }
      if (cambio === 'otro') { f[e.target.name] = e.target.value; if (f.hasta < f.desde) { if (e.target.name === 'desde') f.hasta = f.desde; else f.desde = f.hasta; } pintarFiltros(); actual = null; return consultar(); }
      if (e.target.matches('[data-generar]')) { generarCompra = e.target.checked; return; }
      const form = e.target.closest('#oi-form');
      if (!form) return;
      if (e.target.name === 'orden_id') {
        const o = ordenesAbiertas.find((x) => x.id === Number(e.target.value));
        lineas = [];
        await cargarSaldos(o?.id);
        return repintar(o ? { orden_id: o.id, bodega_id: o.bodega_id, moneda_id: o.moneda_id, tipo_cambio: o.tipo_cambio, forma_pago: o.forma_pago, dias_credito: o.dias_credito } : { orden_id: null });
      }
      if (e.target.name === 'forma_pago') return repintar();
    });
    cont.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar]')) { buscar = e.target.value; const pos = e.target.selectionStart; pintarLista(); const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos); return; }
      const form = e.target.closest('#oi-form');
      if (!form || (!e.target.closest('tr[data-il]') && e.target.name !== 'valor_descuento')) return;
      leerLineas();
      ctx.pDet.querySelectorAll('tr[data-il]').forEach((tr) => { const l = lineas[Number(tr.dataset.il)]; tr.querySelector('[data-ct]').textContent = fmt.monto(l.cantidad * l.costo_unitario); });
      const sim = ctx.moneda(Number(form.elements.moneda_id.value))?.simbolo || 'Q';
      ctx.pDet.querySelector('[data-total]').textContent = `${sim} ${fmt.monto(total())}`;
      ctx.pDet.querySelector('[data-vt]').textContent = `${sim} ${fmt.monto(total() - (Number(form.elements.valor_descuento.value) || 0))}`;
    });
    cont.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-buscar]')) e.preventDefault(); });
    cont.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-pestana]');
      if (tab) { pestana = tab.dataset.pestana; return repintar(); }
      const fila = e.target.closest('tr[data-ingreso]');
      if (fila) { pestana = 'DETALLE'; return abrir(ingresos.find((i) => String(i.id) === fila.dataset.ingreso)); }
      const q = e.target.closest('[data-quitar]');
      if (q) { leerLineas(); lineas.splice(Number(q.dataset.quitar), 1); return repintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (!a) return;
      if (a === 'nuevo') { actual = null; editando = true; lineas = []; saldos = []; pestana = 'DETALLE'; ctx.pMae.querySelectorAll('tr.actual').forEach((tr) => tr.classList.remove('actual')); pintarDetalle(); return ctx.pDet.querySelector('[name=orden_id]')?.focus(); }
      if (a === 'modificar') { editando = true; return pintarDetalle(); }
      if (a === 'cancelar') return actual ? abrir(actual) : abrir(ingresos[0] || null);
      if (a === 'saldos') return cargarDeSaldos();
      if (['APLICAR', 'REVERTIR', 'ANULAR'].includes(a)) return procesar(a);
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('#oi-form')) { e.preventDefault(); guardar(e.target); } });
    iniciar();
  };
})();
