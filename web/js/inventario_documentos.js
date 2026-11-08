// Inventarios · Registros · Traslados entre bodegas, Ajustes al inventario por lotes y Ajustes al inventario por
// producto (por bodega). Los tres usan documentos_inventario y sus líneas (script 144):
//   REGISTRADO → se modifica; «Operar» mueve el inventario (OPERADO); «Revertir» lo deshace; «Anular» con motivo.
//   Traslado: sale de la bodega origen y entra a la destino con el mismo lote.
//   Ajuste por lotes: cambia el lote (fabricación y vencimiento) de una cantidad de producto en la bodega.
//   Ajuste por producto: añade o disminuye existencias de la bodega con su motivo y justificación.
// La existencia por lote se revisa al operar; si no alcanza, se avisa y se pide confirmación.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const cant = (n) => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const horaGt = (v) => (v ? new Date(v).toLocaleString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') : '');
  const aLocal = (v) => { const d = v ? new Date(v) : new Date(); const g = new Date(d.toLocaleString('en-US', { timeZone: 'America/Guatemala' })); const p = (n) => String(n).padStart(2, '0'); return `${g.getFullYear()}-${p(g.getMonth() + 1)}-${p(g.getDate())}T${p(g.getHours())}:${p(g.getMinutes())}`; };
  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await hacer().range(i, i + 999);
      if (error) throw error;
      out.push(...(data || [])); if (!data || data.length < 1000) break;
    }
    return out;
  }

  const CONF = {
    TRASLADO: { titulo: 'Traslados de productos entre bodegas', corto: 'Traslado', icono: 'ti-arrows-exchange', lista: 'Listado de traslados', archivo: 'traslado',
      operar: ['Operar traslado', 'ti-truck-delivery'], revertir: 'Revertir traslado', anular: 'Anular traslado', sale: () => true },
    'AJUSTE LOTE': { titulo: 'Ajuste de productos por lotes', corto: 'Ajuste', icono: 'ti-barcode', lista: 'Listado de ajustes', archivo: 'ajuste_lotes',
      operar: ['Procesar ajuste', 'ti-check'], revertir: 'Revertir ajuste', anular: 'Anular ajuste', sale: () => true },
    'AJUSTE PRODUCTO': { titulo: 'Ajustes al inventario por bodega', corto: 'Ajuste', icono: 'ti-adjustments-horizontal', lista: 'Listado de ajustes', archivo: 'ajuste_producto',
      operar: ['Aplicar ajuste', 'ti-check'], revertir: 'Revertir ajuste', anular: 'Anular ajuste', sale: (v) => v.direccion === 'DISMINUIR' },
    'DEVOLUCIÓN': { titulo: 'Notas por devolución / reingreso', corto: 'Nota', icono: 'ti-arrow-back-up-double', lista: 'Listado de notas', archivo: 'nota_devolucion',
      operar: ['Aplicar a inventario', 'ti-package-import'], revertir: 'Revertir aplicación', anular: 'Anular nota', sale: (v) => v.direccion === 'DISMINUIR' }
  };
  const ESTADOS = { REGISTRADO: ['Registrado', 'pendiente'], OPERADO: ['Operado', 'aprobada'], ANULADO: ['Anulado', 'anulada'] };
  const marca = (e) => `<span class="pc-marca ${ESTADOS[e]?.[1] || ''}">${esc(ESTADOS[e]?.[0] || e)}</span>`;

  function documento(cont, tipo) {
    const C = CONF[tipo];
    const tras = tipo === 'TRASLADO', lote = tipo === 'AJUSTE LOTE', dev = tipo === 'DEVOLUCIÓN', prodAj = tipo === 'AJUSTE PRODUCTO' || dev;
    // Movimiento: en el ajuste, añadir o disminuir; en la nota, reingreso (entra) o devolución (sale).
    const DIR = dev ? [['DISMINUIR', 'Devolución', 'ti-arrow-back-up'], ['AÑADIR', 'Reingreso', 'ti-arrow-forward-up']] : [['AÑADIR', 'Añadir', 'ti-plus'], ['DISMINUIR', 'Disminuir', 'ti-minus']];
    let compras = [];
    const ctx = montar(cont, { titulo: C.titulo, icono: C.icono, clase: `bk-movimientos bm-solo kq-consig iv-doc iv-${tras ? 'tras' : lote ? 'lote' : dev ? 'dev' : 'prod'}`, grupo: 'Inventarios · Registros' });
    const { sb } = ctx;
    const [y, m] = fmt.hoy().split('-');
    const f = { estado: 'TODOS', desde: `${y}-${m}-01`, hasta: fmt.hoy(), formato: 'PDF' };
    let lista = [], bodegas = [], productos = [], motivos = [], lotes = new Map();
    let actual = null, editando = false, pestana = 'DETALLE', lineas = [];
    const prod = (id) => productos.find((p) => p.id === id);
    const prodTxt = (p) => `${p.nombre} — ${p.codigo_producto || p.codigo}`;
    const prodDe = (t0) => { const t = String(t0 || '').trim().toUpperCase(); if (!t) return null; const cod = t.includes(' — ') ? t.slice(t.lastIndexOf(' — ') + 3) : t; return productos.find((p) => prodTxt(p).toUpperCase() === t) || productos.find((p) => (p.codigo_barras || '').toUpperCase() === cod || (p.codigo_producto || '').toUpperCase() === cod || String(p.codigo) === cod) || null; };
    const bodega = (id) => bodegas.find((b) => b.id === id);
    const motivo = (id) => motivos.find((x) => x.id === id);
    const lotesDe = (pid, bid) => [...lotes.values()].filter((x) => x.producto_id === pid && x.bodega_id === bid && Math.abs(x.ex) > 0.00001);
    const exLote = (pid, bid, l) => lotes.get(`${pid}|${bid}|${(l || '').toUpperCase()}`)?.ex || 0;
    const total = () => r2(lineas.reduce((t, l) => t + Number(l.cantidad || 0) * Number(l.costo_unitario || 0), 0));
    const editable = () => ctx.admin && (!actual || (editando && actual.estado === 'REGISTRADO'));

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Estado</span><select name="estado">${['TODOS', 'REGISTRADO', 'OPERADO', 'ANULADO'].map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha desde</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha hasta</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <div class="cf-barra" data-barra></div>`);
      pintarBarra();
    }
    function pintarBarra() {
      const b = ctx.pFil.querySelector('[data-barra]');
      if (!b) return;
      b.innerHTML = editable()
        ? `<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button><button type="submit" form="iv-form" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${actual ? 'Guardar' : 'Registrar'}</button>`
        : `${ctx.admin ? '<button type="button" class="boton secundario-sm" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>' : ''}${ctx.admin && actual?.estado === 'REGISTRADO' ? '<button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}`;
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('documentos_inventario').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/documentos_inventario/.test(prueba.error.message) ? 'Falta instalar el script 144 (traslados y ajustes de inventario) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      pintarFiltros();
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      if (!loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', C.icono); return; }
      const [b, p, mo, mv] = await Promise.all([
        sb.from('bodegas').select('id, codigo, nombre, estado').eq('localidad_id', loc).order('codigo'),
        leerTodo(() => sb.from('productos').select('id, codigo, codigo_producto, codigo_barras, nombre, precio_costo, estado').eq('localidad_id', loc).order('nombre').order('id')),
        sb.from('motivos_ajuste').select('id, codigo, nombre, activo').eq('organizacion_id', ctx.sel.org).order('codigo'),
        leerTodo(() => sb.from('inventario_movimientos').select('producto_id, bodega_id, lote, fecha_vencimiento, cantidad, costo_unitario').eq('localidad_id', loc).order('id'))
      ]);
      bodegas = b.data || []; productos = p; motivos = mo.data || [];
      // Notas de devolución: las compras vigentes para referenciar la compra de ingreso.
      if (dev) compras = await leerTodo(() => sb.from('compras').select('id, numero, serie, documento, proveedor_nombre, fecha_documento').eq('localidad_id', loc).eq('estado', 'ACTIVA').order('numero', { ascending: false }).order('id'));
      // Existencia por producto, bodega y lote, con su vencimiento y el último costo de entrada.
      lotes = new Map();
      mv.forEach((x) => { const l = (x.lote || '').toUpperCase(); const k = `${x.producto_id}|${x.bodega_id}|${l}`; const a = lotes.get(k) || { producto_id: x.producto_id, bodega_id: x.bodega_id, lote: l, ex: 0, vence: null, costo: 0 }; a.ex += Number(x.cantidad); if (x.fecha_vencimiento && (Number(x.cantidad) > 0 || !a.vence)) a.vence = x.fecha_vencimiento; if (Number(x.cantidad) > 0) a.costo = Number(x.costo_unitario); lotes.set(k, a); });
      await consultar(null);
    }
    async function consultar(id = actual?.id) {
      let q = sb.from('documentos_inventario').select('*, documento_inventario_lineas(count)').eq('localidad_id', ctx.sel.loc).eq('tipo', tipo)
        .gte('fecha', `${f.desde}T00:00:00-06:00`).lte('fecha', `${f.hasta}T23:59:59.999-06:00`).order('numero', { ascending: false });
      if (f.estado !== 'TODOS') q = q.eq('estado', f.estado);
      const { data, error } = await q;
      if (error) { ctx.pDet.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      lista = (data || []).map((d) => ({ ...d, lineas: d.documento_inventario_lineas?.[0]?.count || 0 }));
      await abrir(lista.find((d) => d.id === id) || lista[0] || null);
    }
    async function abrir(d) {
      actual = d; editando = false; lineas = [];
      if (d) {
        const { data } = await sb.from('documento_inventario_lineas').select('*').eq('documento_id', d.id).order('linea');
        lineas = (data || []).map((l) => ({ ...l, cantidad: Number(l.cantidad), costo_unitario: Number(l.costo_unitario) }));
      }
      pintarBarra();
      pintarDetalle();
    }
    function nuevoValor() {
      const act = bodegas.filter((b) => b.estado === 'ACTIVO');
      return { fecha: new Date().toISOString(), estado: 'REGISTRADO', bodega_id: act[0]?.id || null, bodega_destino_id: tras ? act[1]?.id || null : null,
        motivo_id: lote ? (motivos.find((x) => /LOTE/.test(x.nombre)) || motivos[0])?.id || null : dev ? (motivos.find((x) => /^DEVOLUCI/.test(x.nombre)) || null)?.id || null : null,
        direccion: dev ? 'DISMINUIR' : 'AÑADIR', aplica_conta: false };
    }

    // ---------- Pintar ----------
    function pintarDetalle(v0) {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', C.icono); return; }
      const d = actual, ed = editable(), dis = ed ? '' : 'disabled';
      const v = v0 || (d ? { ...d } : nuevoValor());
      const tab = !d && !ed ? 'LISTA' : pestana;
      const consulta = d && !editando;
      const boton = (accion, icono, texto, ok, clase = 'secundario-sm') => `<button type="button" class="boton ${clase}" data-accion="${accion}" ${ok ? '' : 'disabled'}><i class="ti ${icono}" aria-hidden="true"></i> ${texto}</button>`;
      const selBod = (name, val) => `<select name="${name}" ${dis}><option value="">—</option>${bodegas.filter((x) => x.estado === 'ACTIVO' || x.id === val).map((x) => `<option value="${x.id}" ${x.id === val ? 'selected' : ''}>${x.codigo} · ${esc(x.nombre)}</option>`).join('')}</select>`;
      const sale = C.sale(v);
      // Columnas del detalle según el documento.
      const cols = tras ? ['ID', 'Código producto', 'Nombre producto', 'Lote', 'Vence', 'Exist. origen', 'Cantidad', 'Inv.']
        : lote ? ['Producto', 'Nombre producto', 'Lote inicial', 'Fabricación', 'Vencimiento', 'Exist.', 'Nuevo lote', 'Fabricación', 'Vencimiento', 'Cantidad', 'Costo unit.', 'Costo total']
          : ['Producto', 'Nombre producto', 'Lote', 'Fabricación', 'Vencimiento', 'Exist.', 'Cantidad', 'Costo unit.', 'Costo total', 'Inv.'];
      const num = new Set(['Exist. origen', 'Exist.', 'Cantidad', 'Costo unit.', 'Costo total']);
      const operado = d?.estado === 'OPERADO';
      const filas = lineas.map((l, i) => {
        const p = prod(l.producto_id), b = v.bodega_id, ex = exLote(l.producto_id, b, l.lote);
        const lotesOp = lotesDe(l.producto_id, b);
        const lt = `<input data-c="lote" list="iv-lotes-${i}" value="${esc(l.lote || '')}" ${dis} aria-label="Lote"><datalist id="iv-lotes-${i}">${lotesOp.map((x) => `<option value="${esc(x.lote)}">Existencia ${cant(x.ex)}${x.vence ? ` · vence ${fmt.fechaDia(x.vence)}` : ''}</option>`).join('')}</datalist>`;
        const fecha = (c) => `<input type="date" data-c="${c}" value="${esc(l[c] || '')}" ${dis} aria-label="${c}">`;
        const exCel = `<td class="num ${sale && Number(l.cantidad) > ex ? 'pc-rojo' : 'tk-tenue'}" title="Existencia del lote en la bodega${tras ? ' origen' : ''}">${cant(ex)}</td>`;
        const cantCel = `<td class="num"><input type="number" step="0.0001" min="0" data-c="cantidad" value="${l.cantidad || ''}" ${dis} aria-label="Cantidad"></td>`;
        const costoCel = `<td class="num"><input type="number" step="0.0001" min="0" data-c="costo_unitario" value="${l.costo_unitario ?? ''}" ${dis} aria-label="Costo unitario"></td><td class="num" data-ct>${fmt.monto(Number(l.cantidad || 0) * Number(l.costo_unitario || 0))}</td>`;
        const inv = `<td class="cc-det"><i class="ti ${operado ? 'ti-square-check-filled iv-ok' : 'ti-square'}" aria-label="${operado ? 'Movido en el inventario' : 'Pendiente'}"></i></td>`;
        const quitar = `<td>${ed ? `<button type="button" class="icono-boton" data-quitar="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td>`;
        const nombre = `<td class="nq-desc" title="${esc(p?.nombre || '')}">${esc(p?.nombre || '')}</td>`;
        if (tras) return `<tr data-l="${i}"><td class="num">${p?.codigo ?? ''}</td><td class="fuerte">${esc(p?.codigo_producto || '')}</td>${nombre}<td>${lt}</td><td>${fecha('fecha_vencimiento')}</td>${exCel}${cantCel}${inv}${quitar}</tr>`;
        if (lote) return `<tr data-l="${i}"><td class="fuerte">${esc(p ? p.codigo_producto || String(p.codigo) : '')}</td>${nombre}<td>${lt}</td><td>${fecha('fecha_fabricacion')}</td><td>${fecha('fecha_vencimiento')}</td>${exCel}
          <td class="iv-nuevo"><input data-c="nuevo_lote" value="${esc(l.nuevo_lote || '')}" ${dis} aria-label="Nuevo lote"></td><td class="iv-nuevo">${fecha('nueva_fabricacion')}</td><td class="iv-nuevo">${fecha('nuevo_vencimiento')}</td>${cantCel}${costoCel}${quitar}</tr>`;
        return `<tr data-l="${i}"><td class="fuerte">${esc(p ? p.codigo_producto || String(p.codigo) : '')}</td>${nombre}<td>${lt}</td><td>${fecha('fecha_fabricacion')}</td><td>${fecha('fecha_vencimiento')}</td>${exCel}${cantCel}${costoCel}${inv}${quitar}</tr>`;
      }).join('');
      const nCol = cols.length + 1;
      ctx.pDet.innerHTML = `
        <form id="iv-form" class="tk-form ta-form bm-form kq-form iv-form cl-clasico" novalidate>
          <div class="cl-banda">${esc(C.titulo)}</div>
          ${!d && !ed ? `<p class="ck-elige"><i class="ti ti-hand-click" aria-hidden="true"></i> No hay documentos con esos filtros${ctx.admin ? ': crea uno con «Nuevo»' : ''}.</p>` : `
          <section class="iv-cab">
            <div class="iv-id">
              <div class="campo"><span>${C.corto}</span><b class="iv-num">${d ? d.numero : 'Nuevo'}</b></div>
              <label class="campo"><span>Fecha</span><input type="datetime-local" name="fecha" value="${aLocal(v.fecha)}" ${dis}></label>
              <div class="campo"><span>Estado</span>${marca(v.estado || 'REGISTRADO')}</div>
              <div class="campo iv-usr"><span>Usuario</span><b>${esc(d ? `${d.usuario || ''}${d.usuario_nombre ? ` · ${d.usuario_nombre}` : ''}` : (window.FIN.perfil?.()?.usuario || '').toUpperCase())}</b></div>
            </div>
            <div class="iv-datos">
              ${tras ? `<label class="campo"><span>Bodega origen *</span>${selBod('bodega_id', v.bodega_id)}</label>
                <label class="campo"><span>Bodega destino *</span>${selBod('bodega_destino_id', v.bodega_destino_id)}</label>
                <label class="campo"><span>Aplica conta</span><select name="aplica_conta" ${dis}><option value="false" ${v.aplica_conta ? '' : 'selected'}>NO</option><option value="true" ${v.aplica_conta ? 'selected' : ''}>SÍ</option></select></label>`
              : `<label class="campo"><span>Bodega *</span>${selBod('bodega_id', v.bodega_id)}</label>
                <label class="campo iv-motivo"><span>${dev ? 'Tipo nota *' : 'Motivo ajuste *'}</span><div class="lov-campo"><select name="motivo_id" ${dis}><option value="">—</option>${motivos.filter((x) => x.activo || x.id === v.motivo_id).map((x) => `<option value="${x.id}" ${x.id === v.motivo_id ? 'selected' : ''}>${x.codigo} · ${esc(x.nombre)}</option>`).join('')}</select>${ed ? '<button type="button" class="icono-boton lov-btn" data-accion="motivo-nuevo" title="Agregar un motivo" aria-label="Agregar un motivo"><i class="ti ti-plus" aria-hidden="true"></i></button>' : ''}</div></label>
                ${prodAj ? `<div class="campo iv-dir"><span>Movimiento</span><div class="iv-seg" role="radiogroup">${DIR.map(([x, t, ic]) => `<label class="${v.direccion === x ? 'activo' : ''}"><input type="radio" name="direccion" value="${x}" ${v.direccion === x ? 'checked' : ''} ${dis}><i class="ti ${ic}" aria-hidden="true"></i> ${t}</label>`).join('')}</div></div>` : ''}
                ${dev ? `<label class="campo"><span>Compra ingreso</span><input list="iv-compras" name="compra" value="${esc((() => { const c = compras.find((x) => x.id === v.compra_id); return c ? `${c.numero} · ${[c.serie, c.documento].filter(Boolean).join('-')} · ${c.proveedor_nombre || ''}` : ''; })())}" placeholder="No. de compra" autocomplete="off" ${dis}></label>
                <label class="campo"><span>Referencia</span><input name="referencia" value="${esc(v.referencia || '')}" maxlength="120" placeholder="Nota de débito, devolución o despacho" ${dis}></label>` : ''}`}
              <label class="campo iv-desc"><span>${tras ? 'Descripción' : prodAj ? 'Justificación' : 'Observaciones'}</span><input name="descripcion" value="${esc(v.descripcion || '')}" maxlength="300" ${dis}></label>
            </div>
            <div class="kq-acc iv-acc">
              ${boton('OPERAR', C.operar[1], C.operar[0], consulta && ctx.admin && d.estado === 'REGISTRADO', 'primario-sm')}
              ${boton('REVERTIR', 'ti-arrow-back-up', C.revertir, consulta && ctx.admin && d.estado === 'OPERADO')}
              ${boton('ANULAR', 'ti-ban', C.anular, consulta && ctx.admin && d.estado === 'REGISTRADO')}
              <div class="kq-imp">${boton('imprimir', 'ti-printer', 'Imprimir', !!d)}<select name="formato" aria-label="Formato"><option ${f.formato === 'PDF' ? 'selected' : ''}>PDF</option><option ${f.formato === 'EXCEL' ? 'selected' : ''}>EXCEL</option></select></div>
              ${d?.operado_por ? `<small class="tk-tenue">Operó ${esc(d.operado_por)} · ${esc(horaGt(d.operado_en))}</small>` : ''}
            </div>
          </section>`}
          <p class="modal-error tk-error" role="alert"></p>
          ${d?.estado === 'ANULADO' ? `<p class="tk-aviso bm-anulado"><i class="ti ti-ban" aria-hidden="true"></i> Anulado por ${esc(d.anulado_por || '')} · ${esc(horaGt(d.anulado_en))}: ${esc(d.motivo_anulacion || '')}</p>` : ''}
          <section class="bm-pestanas nq-pestanas">
            <div class="bm-tabs-barra"><div class="rp-pestanas" role="tablist">
              ${!d && !ed ? '' : `<button type="button" role="tab" data-pestana="DETALLE" class="${tab === 'DETALLE' ? 'activa' : ''}"><i class="ti ti-packages" aria-hidden="true"></i> Productos${lineas.length ? ` <b>${lineas.length}</b>` : ''}</button>`}
              <button type="button" role="tab" data-pestana="LISTA" class="${tab === 'LISTA' ? 'activa' : ''}"><i class="ti ti-list-search" aria-hidden="true"></i> ${C.lista}${lista.length ? ` <b>${lista.length}</b>` : ''}</button>
            </div>
            ${ed && tab === 'DETALLE' ? '<div class="ck-docs-acc"><input list="iv-productos" data-agregar placeholder="Agregar producto (código, código de barras o nombre)…" aria-label="Agregar producto" autocomplete="off"></div>' : ''}</div>
            <div class="bm-panel" data-panel="DETALLE" ${tab === 'DETALLE' ? '' : 'hidden'}>
              <div class="pc-lineas iv-lineas"><table>
                <thead><tr>${cols.map((c, i) => `<th class="${num.has(c) ? 'num' : ''} ${lote && i >= 6 && i <= 8 ? 'iv-nuevo-th' : ''}">${c}</th>`).join('')}<th></th></tr></thead>
                <tbody>${filas}${Array.from({ length: Math.max(0, 8 - lineas.length) }, () => `<tr class="rg-vacia"><td colspan="${nCol}"></td></tr>`).join('')}</tbody>
                <tfoot><tr><td colspan="${tras ? 6 : lote ? 9 : 6}">${lineas.length} producto(s)</td><td class="num" data-tc>${cant(lineas.reduce((t, l) => t + Number(l.cantidad || 0), 0))}</td>${tras ? '<td colspan="2"></td>' : `<td class="num">Total</td><td class="num" data-tt>${fmt.monto(total())}</td><td colspan="${lote ? 1 : 2}"></td>`}</tr></tfoot>
              </table></div>
            </div>
            <div class="bm-panel" data-panel="LISTA" ${tab === 'LISTA' ? '' : 'hidden'}>
              <div class="pc-lineas"><table>
                <thead><tr><th class="num">${C.corto}</th><th>Fecha</th><th>${tras ? 'Bodega origen' : 'Bodega'}</th>${tras ? '<th>Bodega destino</th>' : '<th>Motivo</th>'}${prodAj ? '<th>Movimiento</th>' : ''}<th>${tras ? 'Descripción' : 'Observaciones'}</th><th class="num">Productos</th>${tras ? '' : '<th class="num">Total</th>'}<th>Estado</th><th>Usuario</th></tr></thead>
                <tbody>${lista.map((x) => `<tr data-id="${x.id}" class="${d?.id === x.id ? 'actual' : ''} ${x.estado === 'ANULADO' ? 'pc-anulada' : ''}" tabindex="0"><td class="num fuerte">${x.numero}</td><td>${esc(horaGt(x.fecha))}</td><td>${esc(bodega(x.bodega_id)?.nombre || '')}</td>
                  ${tras ? `<td>${esc(bodega(x.bodega_destino_id)?.nombre || '')}</td>` : `<td>${esc(motivo(x.motivo_id)?.nombre || '')}</td>`}${prodAj ? `<td>${esc(DIR.find(([k]) => k === x.direccion)?.[1] || x.direccion || '')}</td>` : ''}<td class="ta-desc">${esc(x.descripcion || '')}</td><td class="num">${x.lineas}</td>${tras ? '' : `<td class="num">${fmt.monto(x.valor_total)}</td>`}<td>${marca(x.estado)}</td><td>${esc(x.usuario || '')}</td></tr>`).join('')
                  || `<tr><td colspan="10" class="tk-vacio">No hay documentos con esos filtros.</td></tr>`}</tbody>
              </table></div>
            </div>
          </section>
          ${dev ? `<datalist id="iv-compras">${compras.slice(0, 600).map((c) => `<option value="${esc(`${c.numero} · ${[c.serie, c.documento].filter(Boolean).join('-')} · ${c.proveedor_nombre || ''}`)}"></option>`).join('')}</datalist>` : ''}
          <datalist id="iv-productos">${productos.filter((x) => x.estado === 'ACTIVO').map((x) => `<option value="${esc(prodTxt(x))}">${esc(x.codigo_barras || '')}</option>`).join('')}</datalist>
        </form>`;
    }

    // ---------- Leer y editar ----------
    function leerFilas() {
      ctx.pDet.querySelectorAll('tr[data-l]').forEach((tr) => {
        const l = lineas[Number(tr.dataset.l)];
        tr.querySelectorAll('[data-c]').forEach((el) => { const c = el.dataset.c; l[c] = ['cantidad', 'costo_unitario'].includes(c) ? Number(el.value) || 0 : el.value.trim() || null; });
      });
    }
    function leer(form) {
      const el = form.elements;
      if (!el.bodega_id) return {};
      return { fecha: el.fecha.value ? new Date(`${el.fecha.value}:00-06:00`).toISOString() : new Date().toISOString(), bodega_id: el.bodega_id.value ? Number(el.bodega_id.value) : null,
        bodega_destino_id: el.bodega_destino_id?.value ? Number(el.bodega_destino_id.value) : null, aplica_conta: el.aplica_conta ? el.aplica_conta.value === 'true' : false,
        motivo_id: el.motivo_id?.value ? Number(el.motivo_id.value) : null, direccion: prodAj ? form.querySelector('[name=direccion]:checked')?.value || (dev ? 'DISMINUIR' : 'AÑADIR') : null, descripcion: el.descripcion.value.trim() || null,
        ...(dev ? { compra_id: compras.find((c) => String(c.numero) === String(el.compra.value).trim().split(' ')[0])?.id || null, referencia: el.referencia.value.trim() || null, _compra: el.compra.value.trim() } : {}) };
    }
    function repintar(cambios = {}) { const form = ctx.pDet.querySelector('.iv-form'); leerFilas(); const v = { ...(actual || {}), ...leer(form), ...cambios }; delete v._compra; pintarDetalle(v); }
    function totales() {
      leerFilas();
      ctx.pDet.querySelectorAll('tr[data-l]').forEach((tr) => { const l = lineas[Number(tr.dataset.l)]; const c = tr.querySelector('[data-ct]'); if (c) c.textContent = fmt.monto(Number(l.cantidad || 0) * Number(l.costo_unitario || 0)); });
      const set = (s, t) => { const e = ctx.pDet.querySelector(s); if (e) e.textContent = t; };
      set('[data-tt]', fmt.monto(total())); set('[data-tc]', cant(lineas.reduce((t, l) => t + Number(l.cantidad || 0), 0)));
    }
    function agregar(texto) {
      const p = prodDe(texto);
      if (!p) { if (String(texto || '').trim()) window.FIN.aviso('Ese producto no está en el catálogo'); return; }
      leerFilas();
      const form = ctx.pDet.querySelector('.iv-form'); const v = leer(form);
      // Propone el lote con más existencia en la bodega (o el que vence primero).
      const op = lotesDe(p.id, v.bodega_id).filter((x) => x.ex > 0).sort((a, b) => String(a.vence || '9').localeCompare(String(b.vence || '9')) || b.ex - a.ex)[0];
      const sale = C.sale(v);
      lineas.push({ producto_id: p.id, lote: sale && op ? op.lote : '', fecha_vencimiento: sale && op ? op.vence : null, cantidad: 1, costo_unitario: (op?.costo || Number(p.precio_costo) || 0) });
      repintar();
      const ins = ctx.pDet.querySelectorAll('[data-c=cantidad]'); ins[ins.length - 1]?.select();
    }
    async function nuevoMotivo() {
      const nombre = prompt('Nombre del nuevo motivo de ajuste:');
      if (!nombre || !nombre.trim()) return;
      const { data, error } = await sb.from('motivos_ajuste').insert({ organizacion_id: ctx.sel.org, codigo: 0, nombre: nombre.trim() }).select('id, codigo, nombre, activo').single();
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      motivos.push(data); motivos.sort((a, b) => a.codigo - b.codigo);
      repintar({ motivo_id: data.id });
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      leerFilas();
      const v = leer(form);
      if (!v.bodega_id) { error.textContent = tras ? 'Elige la bodega origen.' : 'Elige la bodega.'; return; }
      if (tras && !v.bodega_destino_id) { error.textContent = 'Elige la bodega destino.'; return; }
      if (tras && v.bodega_destino_id === v.bodega_id) { error.textContent = 'La bodega destino debe ser distinta de la de origen.'; return; }
      if (!tras && !v.motivo_id) { error.textContent = dev ? 'Elige el tipo de nota.' : 'Elige el motivo del ajuste.'; return; }
      if (dev && v._compra && !v.compra_id) { error.textContent = 'Esa compra de ingreso no existe en la empresa.'; return; }
      delete v._compra;
      if (!lineas.length) { pestana = 'DETALLE'; error.textContent = 'Agrega los productos.'; return; }
      const mal = lineas.find((l) => !(l.cantidad > 0));
      if (mal) { error.textContent = `Revisa la cantidad de ${prod(mal.producto_id)?.nombre || 'un producto'}.`; return; }
      if (lote) { const sn = lineas.find((l) => !l.nuevo_lote); if (sn) { error.textContent = `Escribe el nuevo lote de ${prod(sn.producto_id)?.nombre || 'un producto'}.`; return; } }
      error.textContent = '';
      const boton = document.querySelector('[type=submit][form=iv-form]');
      if (boton) boton.disabled = true;
      try {
        let id = actual?.id;
        const datos = { ...v, valor_total: total() };
        if (actual) { const r = await sb.from('documentos_inventario').update(datos).eq('id', id); if (r.error) throw r.error; }
        else { const r = await sb.from('documentos_inventario').insert({ ...datos, tipo, numero: 0, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single(); if (r.error) throw r.error; id = r.data.id; }
        const del = await sb.from('documento_inventario_lineas').delete().eq('documento_id', id);
        if (del.error) throw del.error;
        const r = await sb.from('documento_inventario_lineas').insert(lineas.map((l, i) => ({ documento_id: id, linea: i + 1, producto_id: l.producto_id, lote: l.lote || null, fecha_fabricacion: l.fecha_fabricacion || null, fecha_vencimiento: l.fecha_vencimiento || null,
          nuevo_lote: lote ? l.nuevo_lote : null, nueva_fabricacion: lote ? l.nueva_fabricacion || null : null, nuevo_vencimiento: lote ? l.nuevo_vencimiento || null : null, cantidad: l.cantidad, costo_unitario: Number(l.costo_unitario) || 0 })));
        if (r.error) throw r.error;
        window.FIN.aviso(actual ? 'Documento guardado' : 'Documento registrado');
        const dd = new Date(v.fecha).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
        if (dd < f.desde) f.desde = dd; if (dd > f.hasta) f.hasta = dd;
        if (f.estado !== 'TODOS' && f.estado !== 'REGISTRADO') f.estado = 'TODOS';
        pintarFiltros();
        await consultar(id);
      } catch (err) { error.textContent = window.UI.traducirError(err); }
      finally { if (boton) boton.disabled = false; }
    }
    async function procesar(accion) {
      const d = actual;
      let motivoTxt = null;
      if (accion === 'OPERAR' && !confirm(tras ? `¿Operar el traslado ${d.numero}: sacar los productos de ${bodega(d.bodega_id)?.nombre || ''} y cargarlos a ${bodega(d.bodega_destino_id)?.nombre || ''}?` : `¿${C.operar[0]} ${d.numero}: mover el inventario de ${bodega(d.bodega_id)?.nombre || ''}?`)) return;
      if (accion === 'REVERTIR' && !confirm(`¿Revertir el movimiento de inventario del documento ${d.numero}?`)) return;
      if (accion === 'ANULAR') { motivoTxt = prompt(`Motivo de la anulación del documento ${d.numero}:`); if (motivoTxt === null) return; }
      const llamar = (forzar) => sb.rpc('procesar_documento_inventario', { p_id: d.id, p_accion: accion, p_motivo: motivoTxt, p_forzar: forzar });
      let { data, error } = await llamar(false);
      if (error && /EXISTENCIA:/.test(error.message || '')) {
        if (!confirm(`${error.message.replace(/^.*EXISTENCIA:\s*/, '')}\n\n¿Operar de todas formas? La existencia de esos lotes quedará negativa.`)) return;
        ({ data, error } = await llamar(true));
      }
      if (error) { const e = ctx.pDet.querySelector('.modal-error'); if (e) e.textContent = window.UI.traducirError(error); return; }
      window.FIN.aviso({ OPERAR: `${data.movimientos} movimiento(s) de inventario`, REVERTIR: 'Movimiento revertido', ANULAR: 'Documento anulado' }[accion]);
      await cargarLocalidad().then(() => consultar(d.id));
    }

    // ---------- Imprimir ----------
    function imprimirDoc() {
      const d = actual, e = ctx.localidad(d.localidad_id);
      const cab = tras ? ['#', 'Código', 'Producto', 'Lote', 'Vence', 'Cantidad'] : lote ? ['#', 'Código', 'Producto', 'Lote inicial', 'Vence', 'Nuevo lote', 'Fabricación', 'Vence', 'Cantidad', 'Costo unit.', 'Costo total'] : ['#', 'Código', 'Producto', 'Lote', 'Fabricación', 'Vence', 'Cantidad', 'Costo unit.', 'Costo total'];
      const filas = lineas.map((l, i) => { const p = prod(l.producto_id); const b = [i + 1, p?.codigo_producto || p?.codigo || '', p?.nombre || ''];
        if (tras) return [...b, l.lote || '', fmt.fechaDia(l.fecha_vencimiento), l.cantidad];
        if (lote) return [...b, l.lote || '', fmt.fechaDia(l.fecha_vencimiento), l.nuevo_lote || '', fmt.fechaDia(l.nueva_fabricacion), fmt.fechaDia(l.nuevo_vencimiento), l.cantidad, r2(l.costo_unitario), r2(l.cantidad * l.costo_unitario)];
        return [...b, l.lote || '', fmt.fechaDia(l.fecha_fabricacion), fmt.fechaDia(l.fecha_vencimiento), l.cantidad, r2(l.costo_unitario), r2(l.cantidad * l.costo_unitario)]; });
      const datosCab = [[`${C.corto} No.`, d.numero], ['Fecha', horaGt(d.fecha)], ['Estado', ESTADOS[d.estado]?.[0] || d.estado], ['Usuario', `${d.usuario || ''}${d.usuario_nombre ? ` · ${d.usuario_nombre}` : ''}`],
        ...(tras ? [['Bodega origen', bodega(d.bodega_id)?.nombre || ''], ['Bodega destino', bodega(d.bodega_destino_id)?.nombre || ''], ['Aplica conta', d.aplica_conta ? 'SÍ' : 'NO']]
          : [['Bodega', bodega(d.bodega_id)?.nombre || ''], [dev ? 'Tipo nota' : 'Motivo', motivo(d.motivo_id)?.nombre || ''], ...(prodAj ? [['Movimiento', DIR.find(([x]) => x === d.direccion)?.[1] || d.direccion]] : []),
            ...(dev ? [['Compra ingreso', (() => { const c = compras.find((x) => x.id === d.compra_id); return c ? `${c.numero} · ${[c.serie, c.documento].filter(Boolean).join('-')}` : ''; })()], ['Referencia', d.referencia || '']] : []), ['Total', `Q ${fmt.monto(total())}`]]),
        [tras ? 'Descripción' : prodAj ? 'Justificación' : 'Observaciones', d.descripcion || '']];
      const titulo = `${C.titulo} · No. ${d.numero}`;
      if (f.formato === 'EXCEL') {
        const tiposCol = cab.map((c) => (['Cantidad'].includes(c) ? 'numero' : ['Costo unit.', 'Costo total'].includes(c) ? 'monto' : 'texto'));
        return window.REPORTE_XLSX.generar({ titulo, parametros: [`Empresa: ${e ? `${e.codigo} · ${e.nombre_comercial}` : ''}`, ...datosCab.map(([k, x]) => `${k}: ${x}`)], orgId: d.organizacion_id, locId: d.localidad_id, hoja: C.corto, archivo: `${C.archivo}_${d.numero}`,
          columnas: cab.map((c, i) => ({ titulo: c, tipo: tiposCol[i], ancho: c === 'Producto' ? 46 : c === '#' ? 6 : 13 })), filas: [...filas.map((x) => ({ valores: x })), ...(tras ? [] : [{ valores: ['Total', ...Array(cab.length - 2).fill(''), total()], tipo: 'total' }])] });
      }
      const n = (i) => ['Cantidad', 'Costo unit.', 'Costo total'].includes(cab[i]);
      imprimir(titulo, `<h1>${esc(titulo)}</h1><h2>Empresa: ${esc(e ? `${e.codigo} · ${e.nombre_comercial}` : '')} · ${esc(ESTADOS[d.estado]?.[0] || d.estado)}</h2>
        <div class="cab">${datosCab.map(([k, x]) => `<div${k.length > 11 && String(x).length > 30 ? ' style="grid-column:span 2"' : ''}><b>${esc(k)}</b>${esc(String(x))}</div>`).join('')}</div>
        <table><thead><tr>${cab.map((c, i) => `<th class="${n(i) ? 'n' : ''}">${c}</th>`).join('')}</tr></thead>
        <tbody>${filas.map((r) => `<tr>${r.map((c, i) => `<td class="${n(i) ? 'n' : ''}">${esc(typeof c === 'number' && cab[i] !== 'Cantidad' && cab[i] !== '#' ? fmt.monto(c) : String(c ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody>
        ${tras ? '' : `<tfoot><tr><td colspan="${cab.length - 1}">Total</td><td class="n">${fmt.monto(total())}</td></tr></tfoot>`}</table>
        <div class="firmas"><div>${tras ? 'Entregó' : 'Elaboró'}</div><div>${tras ? 'Recibió' : 'Revisó'}</div><div>Autorizó</div></div>`, { orgId: d.organizacion_id, locId: d.localidad_id, horizontal: lote });
    }

    // ---------- Eventos ----------
    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { pintarFiltros(); return cargarLocalidad(); }
      if (cambio === 'otro') { f[e.target.name] = e.target.value; if (f.hasta < f.desde) { if (e.target.name === 'desde') f.hasta = f.desde; else f.desde = f.hasta; } pintarFiltros(); return consultar(); }
      const form = e.target.closest('.iv-form');
      if (!form) return;
      if (e.target.name === 'formato') { f.formato = e.target.value; return; }
      if (['bodega_id', 'bodega_destino_id', 'direccion'].includes(e.target.name)) return repintar();
      if (e.target.matches('[data-agregar]')) { const t = e.target.value; e.target.value = ''; return agregar(t); }
      if (e.target.dataset.c === 'lote') {
        // Al elegir un lote existente se completa su vencimiento y su costo.
        leerFilas(); const tr = e.target.closest('tr[data-l]'); const l = lineas[Number(tr.dataset.l)];
        const x = lotes.get(`${l.producto_id}|${leer(form).bodega_id}|${(l.lote || '').toUpperCase()}`);
        // Se escribe en los campos de la fila: repintar() vuelve a leerlos.
        if (x) { const fv = tr.querySelector('[data-c=fecha_vencimiento]'); if (x.vence && fv) fv.value = x.vence; const cu = tr.querySelector('[data-c=costo_unitario]'); if (x.costo && cu) cu.value = x.costo; }
        return repintar();
      }
      if (e.target.dataset.c) totales();
    });
    cont.addEventListener('input', (e) => { if (['cantidad', 'costo_unitario'].includes(e.target.dataset.c)) totales(); });
    cont.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-agregar]')) { e.preventDefault(); const t = e.target.value; e.target.value = ''; agregar(t); } });
    cont.addEventListener('click', (e) => {
      const fila = e.target.closest('tr[data-id]');
      if (fila) { pestana = 'DETALLE'; return abrir(lista.find((x) => String(x.id) === fila.dataset.id)); }
      const tab = e.target.closest('[data-pestana]');
      if (tab) { pestana = tab.dataset.pestana; return ctx.pDet.querySelector('.iv-form [name=bodega_id]') ? repintar() : pintarDetalle(); }
      const q = e.target.closest('[data-quitar]');
      if (q) { leerFilas(); lineas.splice(Number(q.dataset.quitar), 1); return repintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (!a) return;
      if (a === 'nueva') { actual = null; editando = true; lineas = []; pestana = 'DETALLE'; pintarBarra(); return pintarDetalle(); }
      if (a === 'modificar') { editando = true; pintarBarra(); return pintarDetalle(); }
      if (a === 'cancelar') return abrir(actual || lista[0] || null);
      if (a === 'motivo-nuevo') return nuevoMotivo();
      if (a === 'imprimir') return imprimirDoc();
      if (['OPERAR', 'REVERTIR', 'ANULAR'].includes(a)) return procesar(a);
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.iv-form')) { e.preventDefault(); guardar(e.target); } });
    iniciar();
  }
  window.PANTALLAS['traslados-entre-bodegas'] = (cont) => documento(cont, 'TRASLADO');
  window.PANTALLAS['ajustes-por-lotes'] = (cont) => documento(cont, 'AJUSTE LOTE');
  window.PANTALLAS['ajustes-por-producto'] = (cont) => documento(cont, 'AJUSTE PRODUCTO');
  window.PANTALLAS['devoluciones-reingresos'] = (cont) => documento(cont, 'DEVOLUCIÓN');
})();
