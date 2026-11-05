// Compras · Registros · Notas crédito compras: notas de crédito y de débito de los proveedores.
//   Encabezado: autorización, serie y número del DTE, fecha, moneda, proveedor, bodega destino y la
//   factura de referencia con el motivo y tipo de ajuste. Detalle de la nota (productos con su
//   inventario, lote, registro sanitario y fechas), detalle contable y listado de notas.
//   Descargar: mueve el inventario, genera la póliza y la nota rebaja (o aumenta) la compra.
// Compras · Registros · Productos en consignación: partes de depósito de envío o devolución que
//   cargan (o sacan) la mercadería de la bodega sin ser compra.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const AJUSTES = ['DEVOLUCIÓN', 'DESCUENTO', 'BONIFICACIÓN', 'AJUSTE DE PRECIO', 'OTRO'];
  const CLASE = { VIGENTE: 'pendiente', OPERADA: 'definitiva', ANULADA: 'anulada' };
  const marca = (e) => `<span class="pc-marca ${CLASE[e]}">${e.charAt(0) + e.slice(1).toLowerCase()}</span>`;
  const docTxt = (c) => `${c.serie ? `${c.serie}-` : ''}${c.documento || ''}`;

  window.PANTALLAS['notas-credito-compras'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Notas crédito compras', icono: 'ti-receipt-refund', clase: 'bk-movimientos nq-notas', grupo: 'Compras · Registros' });
    const { sb } = ctx;
    const [y, m] = fmt.hoy().split('-');
    const f = { estado: 'TODAS', desde: `${y}-${m}-01`, hasta: fmt.hoy() };
    let lista = [], proveedores = [], bodegas = [], productos = [], medidas = [], contables = [], compras = [];
    let actual = null, editando = false, pestana = 'DETALLE', sel = 0;
    let lineas = [], contable = [];
    let refCompra = null;   // factura de referencia de la nota que se ve o se edita
    const prov = (id) => proveedores.find((p) => p.id === id);
    const provTxt = (p) => `${p.codigo} · ${p.nombre_comercial}`;
    const provDe = (t0) => { const t = String(t0 || '').trim().toUpperCase(); return t ? proveedores.find((p) => provTxt(p).toUpperCase() === t) || proveedores.find((p) => String(p.codigo) === t || (p.nit && p.nit.toUpperCase() === t)) || null : null; };
    const prod = (id) => productos.find((p) => p.id === id);
    const prodTxt = (p) => `${p.codigo_producto || p.codigo} · ${p.nombre}`;
    const prodDe = (t0) => { const t = String(t0 || '').trim().toUpperCase(); return t ? productos.find((p) => prodTxt(p).toUpperCase() === t) || productos.find((p) => (p.codigo_producto || '').toUpperCase() === t || String(p.codigo) === t) || null : null; };
    const bodega = (id) => bodegas.find((b) => b.id === id);
    const compra = (id) => compras.find((c) => c.id === id);
    const cuenta = (id) => contables.find((x) => x.id === id);
    const porCodigo = (cod) => contables.find((x) => x.codigo === String(cod || '').trim() && x.movimiento);
    const aBase = (mon, cambio) => (ctx.moneda(Number(mon))?.iso === 'GTQ' ? 1 : Number(cambio) || 1);
    const tasaMI = () => ctx.monedas.find((x) => x.iso === 'USD')?.cambio || 1;
    const total = () => fmt.redondear(lineas.reduce((t, l) => t + fmt.redondear(Number(l.cantidad || 0) * Number(l.precio || 0)), 0));
    const editable = () => ctx.admin && (!actual || (editando && actual.estado === 'VIGENTE'));

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Estado</span><select name="estado">${['TODAS', 'VIGENTE', 'OPERADA', 'ANULADA'].map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha desde</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha hasta</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <div class="cf-barra" data-barra></div>`);
      pintarBarra();
    }
    function pintarBarra() {
      const b = ctx.pFil.querySelector('[data-barra]');
      if (!b) return;
      b.innerHTML = editable()
        ? `<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button><button type="submit" form="nq-form" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${actual ? 'Guardar' : 'Registrar nota'}</button>`
        : `${ctx.admin ? '<button type="button" class="boton secundario-sm" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva</button>' : ''}${ctx.admin && actual?.estado === 'VIGENTE' ? '<button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}`;
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('notas_compra').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/notas_compra/.test(prueba.error.message) ? 'Falta instalar el script 65 (notas de compras) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      pintarFiltros();
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      const vacio = { data: [] };
      const [p, b, pr, md, cs, ct] = await Promise.all([
        loc ? sb.from('proveedores').select('id, codigo, nit, nombre_comercial, nombre_fiscal, estado').eq('localidad_id', loc).order('nombre_comercial') : vacio,
        loc ? sb.from('bodegas').select('id, codigo, nombre, estado').eq('localidad_id', loc).order('codigo') : vacio,
        loc ? sb.from('productos').select('id, codigo, codigo_producto, nombre, tipo_medida_id, precio_costo, estado').eq('localidad_id', loc).order('nombre') : vacio,
        loc ? sb.from('tipos_medida').select('id, nombre').eq('localidad_id', loc).order('nombre') : vacio,
        loc ? sb.from('compras_saldo').select('id, numero, serie, documento, fecha_documento, proveedor_id, bodega_id, moneda_id, tipo_cambio, valor_total, neto, pendiente, estado, cuenta_pagar_id').eq('localidad_id', loc).order('numero', { ascending: false }).limit(5000) : vacio,
        ctx.cuentasContables()
      ]);
      proveedores = p.data || []; bodegas = b.data || []; productos = pr.data || []; medidas = md.data || []; compras = cs.data || []; contables = ct;
      actual = null; editando = false;
      await consultar(null);
    }
    async function consultar(id = actual?.id) {
      if (!ctx.sel.loc) { lista = []; return abrir(null); }
      let q = sb.from('notas_compra').select('*').eq('localidad_id', ctx.sel.loc).gte('fecha', f.desde).lte('fecha', f.hasta).order('numero', { ascending: false });
      if (f.estado !== 'TODAS') q = q.eq('estado', f.estado);
      const { data, error } = await q;
      if (error) { ctx.pDet.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      lista = data || [];
      await abrir(lista.find((n) => n.id === id) || lista[0] || null);
    }
    async function abrir(n) {
      actual = n; editando = false; lineas = []; contable = []; sel = 0; refCompra = n?.compra_id ?? null;
      if (n) {
        const [l, k, p] = await Promise.all([
          sb.from('nota_compra_lineas').select('*').eq('nota_id', n.id).order('linea'),
          sb.from('nota_compra_contable').select('*').eq('nota_id', n.id).order('linea'),
          n.partida_id ? sb.from('partidas').select('id, mes, numero, estado').eq('id', n.partida_id).maybeSingle() : { data: null }
        ]);
        lineas = (l.data || []).map((x) => ({ ...x, cantidad: Number(x.cantidad), precio: Number(x.precio) }));
        contable = (k.data || []).map((x) => ({ ...x, debe: Number(x.debe), haber: Number(x.haber), codigo: cuenta(x.cuenta_id)?.codigo || '' }));
        actual = { ...n, _partida: p.data };
      }
      pintarBarra();
      pintarDetalle();
    }
    function nuevoValor() {
      const gtq = ctx.monedaBase();
      return { tipo: 'NOTA DE CRÉDITO', fecha: fmt.hoy(), moneda_id: gtq?.id, tipo_cambio: 1, tipo_ajuste: 'DEVOLUCIÓN', tipo_nota: 'MANUAL', estado: 'VIGENTE', proveedor_id: null, compra_id: null, bodega_id: bodegas.find((b) => b.estado === 'ACTIVO')?.id || null };
    }

    function pintarDetalle(v0) {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-receipt-refund'); return; }
      const n = actual;
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const v = v0 || (n ? { ...n } : nuevoValor());
      const tab = !n && !ed ? 'LISTA' : pestana;
      const p = prov(v.proveedor_id);
      const c = compra(v.compra_id);
      const bc = bodega(c?.bodega_id);
      const val = total();
      const cambio = aBase(v.moneda_id, v.tipo_cambio);
      const mi = tasaMI();
      const l = lineas[sel];
      const pd = l && prod(l.producto_id);
      const consulta = n && !editando;
      const boton = (accion, texto, ok) => `<button type="button" class="boton secundario-sm" data-accion="${accion}" ${ok ? '' : 'disabled'}>${texto}</button>`;
      const vacias = Math.max(0, 6 - lineas.length);
      ctx.pDet.innerHTML = `
        <form id="nq-form" class="tk-form ta-form bm-form nq-form cl-clasico" novalidate>
          <div class="cl-banda nq-banda"><b class="nq-num">${n ? n.numero : 'Nueva'}</b><span>Notas compras</span>
            <select name="tipo" ${dis} aria-label="Tipo de nota">${['NOTA DE CRÉDITO', 'NOTA DE DÉBITO'].map((t) => `<option ${v.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          ${!n && !ed ? `<p class="ck-elige"><i class="ti ti-hand-click" aria-hidden="true"></i> No hay notas con esos filtros${ctx.admin ? ': crea una con «Nueva»' : ''}.</p>` : `
          <section class="nq-cab">
            <div class="nq-doc">
              <label class="campo nq-aut"><span>Número de autorización</span><input name="numero_autorizacion" value="${esc(v.numero_autorizacion || '')}" maxlength="60" ${dis}></label>
              <label class="campo"><span>Serie</span><input name="serie" value="${esc(v.serie || '')}" maxlength="20" ${dis}></label>
              <label class="campo"><span>Número *</span><input name="documento" value="${esc(v.documento || '')}" maxlength="40" ${dis}></label>
              <label class="campo"><span>Fecha *</span><input type="date" name="fecha" value="${esc(v.fecha || '')}" ${dis}></label>
              <div class="campo"><span>Estado</span>${marca(v.estado || 'VIGENTE')}</div>
            </div>
            <div class="nq-mon">
              <label class="campo"><span>Moneda</span><select name="moneda_id" ${dis}>${ctx.monedas.map((x) => `<option value="${x.id}" ${x.id === Number(v.moneda_id) ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>
              <label class="campo"><span>Valor cambio</span><input type="number" step="any" min="0" name="tipo_cambio" value="${esc(String(v.tipo_cambio ?? 1))}" ${dis}></label>
            </div>
            <div class="nq-val">
              <div class="campo"><span>Valor</span><b data-valor>${fmt.monto(val)}</b></div>
              <div class="campo"><span>Valor MI</span><b data-valormi>${fmt.monto(val * cambio / mi)}</b></div>
            </div>
            <div class="nq-prov">
              <label class="campo nq-p"><span>Proveedor *</span><div class="lov-campo"><input list="nq-proveedores" name="proveedor" value="${esc(p ? provTxt(p) : v.proveedor_nombre || '')}" placeholder="Código, NIT o nombre" ${dis}><button type="button" class="icono-boton lov-btn" data-accion="lov-proveedor" aria-label="Lista de proveedores" ${dis}><i class="ti ti-dots" aria-hidden="true"></i></button></div></label>
              <div class="campo"><span>NIT</span><b class="nq-txt">${esc(p?.nit || v.nit || '')}</b></div>
              <label class="campo"><span>Bodega destino</span><select name="bodega_id" ${dis}><option value="">—</option>${bodegas.filter((b) => b.estado === 'ACTIVO' || b.id === v.bodega_id).map((b) => `<option value="${b.id}" ${b.id === v.bodega_id ? 'selected' : ''}>${b.codigo} · ${esc(b.nombre)}</option>`).join('')}</select></label>
            </div>
            <fieldset class="nq-ref">
              <legend>Factura de referencia</legend>
              <div class="campo nq-fact"><span>Compra</span><div class="lov-campo"><input value="${c ? `${c.numero} · ${esc(docTxt(c))}` : ''}" placeholder="Sin factura de referencia" disabled aria-label="Factura de referencia"><button type="button" class="icono-boton lov-btn" data-accion="lov-compra" aria-label="Facturas del proveedor" ${ed && v.proveedor_id ? '' : 'disabled'}><i class="ti ti-dots" aria-hidden="true"></i></button>${ed && c ? '<button type="button" class="icono-boton" data-accion="sin-compra" aria-label="Quitar la factura"><i class="ti ti-x" aria-hidden="true"></i></button>' : ''}</div></div>
              <div class="campo"><span>Serie</span><b class="nq-txt">${esc(c?.serie || '')}</b></div>
              <div class="campo"><span>Número</span><b class="nq-txt">${esc(c?.documento || '')}</b></div>
              <div class="campo"><span>Fecha emisión</span><b class="nq-txt">${esc(fmt.fechaDia(c?.fecha_documento))}</b></div>
              <div class="campo"><span>Bodega</span><b class="nq-txt">${bc ? `${bc.codigo} · ${esc(bc.nombre)}` : ''}</b></div>
              <div class="campo"><span>Saldo</span><b class="nq-txt">${c ? fmt.monto(c.pendiente) : ''}</b></div>
              <label class="campo nq-motivo"><span>Motivo de ajuste</span><input name="motivo" value="${esc(v.motivo || '')}" maxlength="200" ${dis}></label>
              <label class="campo"><span>Tipo de ajuste</span><select name="tipo_ajuste" ${dis}>${AJUSTES.map((a) => `<option ${v.tipo_ajuste === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
            </fieldset>
            <div class="nq-acc">
              ${boton('DESCARGAR', '<i class="ti ti-download" aria-hidden="true"></i> Descargar', consulta && ctx.admin && n.estado === 'VIGENTE')}
              ${boton('REVERSAR', '<i class="ti ti-arrow-back-up" aria-hidden="true"></i> Reversar', consulta && ctx.admin && n.estado === 'OPERADA')}
              ${boton('ANULAR', '<i class="ti ti-ban" aria-hidden="true"></i> Anular nota', consulta && ctx.admin && n.estado === 'VIGENTE')}
              ${boton('imprimir', '<i class="ti ti-printer" aria-hidden="true"></i> Imprimir nota', !!n)}
            </div>
            <div class="nq-aud">
              <div class="campo"><span>Usr ingresa</span><b class="nq-txt">${esc(n?.usuario || '')}</b></div><div class="campo"><span>Fecha ingresa</span><b class="nq-txt">${esc(fmt.fechaDia(n?.creado_en))}</b></div>
              <div class="campo"><span>Usr modifica</span><b class="nq-txt">${esc(n?.modificado_por_nombre || '')}</b></div><div class="campo"><span>Fecha modifica</span><b class="nq-txt">${esc(fmt.fechaDia(n?.modificado_en))}</b></div>
              <div class="campo"><span>Póliza</span><b class="nq-txt ${n?._partida?.estado === 'ANULADA' ? 'pc-rojo' : ''}">${n?._partida ? `${n._partida.mes}-${n._partida.numero}` : '—'}</b></div>
              <div class="campo"><span>Tipo de nota</span><b class="nq-txt">${esc(v.tipo_nota || 'MANUAL')}</b></div>
            </div>
          </section>`}
          <p class="modal-error tk-error" role="alert"></p>
          ${n?.estado === 'ANULADA' ? `<p class="tk-aviso bm-anulado"><i class="ti ti-ban" aria-hidden="true"></i> Anulada por ${esc(n.anulado_por || '')} · ${esc(fmt.fechaHora(n.anulado_en))}: ${esc(n.motivo_anulacion || '')}</p>` : ''}
          <section class="bm-pestanas nq-pestanas">
            <div class="bm-tabs-barra"><div class="rp-pestanas" role="tablist">
              ${!n && !ed ? '' : `<button type="button" role="tab" data-pestana="DETALLE" class="${tab === 'DETALLE' ? 'activa' : ''}"><i class="ti ti-list" aria-hidden="true"></i> Detalle nota${lineas.length ? ` <b>${lineas.length}</b>` : ''}</button>
              <button type="button" role="tab" data-pestana="CONTABLE" class="${tab === 'CONTABLE' ? 'activa' : ''}"><i class="ti ti-list-details" aria-hidden="true"></i> Detalle contable${contable.length ? ` <b>${contable.length}</b>` : ''}</button>`}
              <button type="button" role="tab" data-pestana="LISTA" class="${tab === 'LISTA' ? 'activa' : ''}"><i class="ti ti-list-search" aria-hidden="true"></i> Listado de notas${lista.length ? ` <b>${lista.length}</b>` : ''}</button>
            </div>
            ${ed && tab === 'DETALLE' ? `<div class="ck-docs-acc"><button type="button" class="boton secundario-sm" data-accion="traer" ${c ? '' : 'disabled'} title="Trae los artículos de la factura de referencia"><i class="ti ti-download" aria-hidden="true"></i> Traer de la factura</button><input list="nq-productos" data-agregar placeholder="Agregar producto…" aria-label="Agregar producto"><button type="button" class="boton secundario-sm" data-accion="concepto"><i class="ti ti-plus" aria-hidden="true"></i> Concepto</button></div>` : ''}
            ${ed && tab === 'CONTABLE' ? `<div class="ck-docs-acc"><button type="button" class="boton secundario-sm" data-accion="contabilizar" title="Revierte en proporción el detalle contable de la factura de referencia"><i class="ti ti-calculator" aria-hidden="true"></i> Contabilizar</button><button type="button" class="boton secundario-sm" data-accion="linea-contable"><i class="ti ti-plus" aria-hidden="true"></i> Línea</button></div>` : ''}</div>
            <div class="bm-panel nq-detalle" data-panel="DETALLE" ${tab === 'DETALLE' ? '' : 'hidden'}>
              <div class="pc-lineas"><table>
                <thead><tr><th class="pc-n">#</th><th>Código</th><th>Descripción</th><th class="num">Cantidad</th><th class="num">Precio Q.</th><th class="num">Total Q.</th><th class="num">Precio MI</th><th class="num">Total MI</th><th class="cc-det">Inv</th><th></th></tr></thead>
                <tbody>${lineas.map((x, i) => { const pp = prod(x.producto_id); const t = fmt.redondear(x.cantidad * x.precio); return `<tr data-l="${i}" class="${i === sel ? 'actual' : ''}">
                  <td class="pc-n">${i + 1}</td><td class="fuerte">${esc(pp ? pp.codigo_producto || String(pp.codigo) : '')}</td>
                  <td class="nq-desc">${pp ? `<span title="${esc(pp.nombre)}">${esc(pp.nombre)}</span>` : `<input data-c="descripcion" value="${esc(x.descripcion || '')}" maxlength="200" ${dis} aria-label="Descripción">`}</td>
                  <td class="num"><input type="number" step="0.0001" min="0" data-c="cantidad" value="${x.cantidad || ''}" ${dis} aria-label="Cantidad"></td>
                  <td class="num"><input type="number" step="0.0001" min="0" data-c="precio" value="${x.precio || ''}" ${dis} aria-label="Precio"></td>
                  <td class="num fuerte" data-t>${fmt.monto(t * cambio)}</td><td class="num tk-tenue" data-pm>${fmt.monto(x.precio * cambio / mi)}</td><td class="num tk-tenue" data-tm>${fmt.monto(t * cambio / mi)}</td>
                  <td class="cc-det"><input type="checkbox" data-c="inventario" ${x.inventario ? 'checked' : ''} ${ed && pp ? '' : 'disabled'} aria-label="Mueve inventario"></td>
                  <td>${ed ? `<button type="button" class="icono-boton" data-quitar="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`; }).join('')}${Array.from({ length: vacias }, () => '<tr class="rg-vacia"><td colspan="10"></td></tr>').join('')}</tbody>
                <tfoot><tr><td colspan="3" class="num nq-tot">Totales</td><td class="num" data-tc>${lineas.reduce((t, x) => t + Number(x.cantidad || 0), 0).toFixed(4)}</td><td></td><td class="num" data-tq>${fmt.monto(val * cambio)}</td><td></td><td class="num" data-tmi>${fmt.monto(val * cambio / mi)}</td><td colspan="2"></td></tr></tfoot>
              </table></div>
              <aside class="nq-lado">${l ? `
                <label class="campo"><span>Unidad de medida</span><select data-s="tipo_medida_id" ${dis}><option value="">—</option>${medidas.map((x) => `<option value="${x.id}" ${x.id === (l.tipo_medida_id ?? pd?.tipo_medida_id) ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>
                <label class="campo"><span>Lote</span><input data-s="lote" value="${esc(l.lote || '')}" maxlength="40" ${dis}></label>
                <label class="campo"><span>Registro sanitario</span><input data-s="registro_sanitario" value="${esc(l.registro_sanitario || '')}" maxlength="40" ${dis}></label>
                <label class="campo"><span>Fecha vencimiento</span><input type="date" data-s="fecha_vencimiento" value="${esc(l.fecha_vencimiento || '')}" ${dis}></label>
                <label class="campo"><span>Fecha fabricación</span><input type="date" data-s="fecha_fabricacion" value="${esc(l.fecha_fabricacion || '')}" ${dis}></label>
                <label class="campo"><span>Bodega</span><select data-s="bodega_id" ${dis}><option value="">La de la nota</option>${bodegas.map((b) => `<option value="${b.id}" ${b.id === l.bodega_id ? 'selected' : ''}>${b.codigo} · ${esc(b.nombre)}</option>`).join('')}</select></label>
                <small class="tk-tenue">Línea ${sel + 1}${pd ? ` · ${esc(pd.nombre)}` : ''}</small>` : '<p class="tk-tenue">Elige una línea del detalle para ver sus datos.</p>'}</aside>
            </div>
            <div class="bm-panel" data-panel="CONTABLE" ${tab === 'CONTABLE' ? '' : 'hidden'}>
              <div class="pc-lineas"><table>
                <thead><tr><th class="pc-n">#</th><th>Cuenta</th><th>Nombre</th><th>Concepto</th><th class="num">Debe</th><th class="num">Haber</th><th></th></tr></thead>
                <tbody>${contable.map((k, i) => { const kk = porCodigo(k.codigo); return `<tr data-k="${i}"><td class="pc-n">${i + 1}</td>
                  <td class="pc-cta"><input list="nq-cuentas" data-k="codigo" value="${esc(k.codigo || '')}" ${dis} aria-label="Cuenta"></td><td class="tk-tenue" data-kn>${esc(kk?.nombre || '')}</td>
                  <td><input data-k="concepto" value="${esc(k.concepto || '')}" maxlength="200" ${dis} aria-label="Concepto"></td>
                  <td class="num"><input type="number" step="0.01" min="0" data-k="debe" value="${k.debe || ''}" ${dis} aria-label="Debe"></td>
                  <td class="num"><input type="number" step="0.01" min="0" data-k="haber" value="${k.haber || ''}" ${dis} aria-label="Haber"></td>
                  <td>${ed ? `<button type="button" class="icono-boton" data-quitar-k="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`; }).join('') || `<tr><td colspan="7" class="tk-vacio">${ed ? 'Usa «Contabilizar» o agrega las líneas: la póliza se genera al descargar la nota.' : 'Sin detalle contable: la nota se descarga sin póliza.'}</td></tr>`}</tbody>
                <tfoot><tr><td colspan="4" class="num">Totales</td><td class="num" data-kd>${fmt.monto(contable.reduce((t, k) => t + Number(k.debe || 0), 0))}</td><td class="num" data-kh>${fmt.monto(contable.reduce((t, k) => t + Number(k.haber || 0), 0))}</td><td></td></tr></tfoot>
              </table></div>
            </div>
            <div class="bm-panel" data-panel="LISTA" ${tab === 'LISTA' ? '' : 'hidden'}>
              <div class="pc-lineas"><table>
                <thead><tr><th class="num">Nota</th><th>Tipo</th><th>Documento</th><th>Fecha</th><th>Proveedor</th><th class="num">Compra</th><th>Ajuste</th><th class="num">Valor</th><th>Estado</th><th>Usuario</th></tr></thead>
                <tbody>${lista.map((x) => `<tr data-id="${x.id}" class="${n?.id === x.id ? 'actual' : ''} ${x.estado === 'ANULADA' ? 'pc-anulada' : ''}" tabindex="0"><td class="num fuerte">${x.numero}</td><td>${x.tipo === 'NOTA DE CRÉDITO' ? 'Crédito' : 'Débito'}</td><td>${esc(docTxt(x))}</td><td>${esc(fmt.fechaDia(x.fecha))}</td><td class="ta-desc">${esc(x.proveedor_nombre || '')}</td><td class="num">${compra(x.compra_id)?.numero ?? ''}</td><td>${esc(x.tipo_ajuste)}</td><td class="num">${fmt.monto(x.valor)}</td><td>${marca(x.estado)}</td><td>${esc(x.usuario || '')}</td></tr>`).join('')
                  || '<tr><td colspan="10" class="tk-vacio">No hay notas con esos filtros.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="7">${lista.length} nota(s)</td><td class="num">${fmt.monto(lista.filter((x) => x.estado === 'OPERADA').reduce((t, x) => t + Number(x.valor), 0))}</td><td colspan="2">operadas</td></tr></tfoot>
              </table></div>
            </div>
          </section>
          <datalist id="nq-proveedores">${proveedores.filter((x) => x.estado === 'ACTIVO').map((x) => `<option value="${esc(provTxt(x))}"></option>`).join('')}</datalist>
          <datalist id="nq-productos">${productos.filter((x) => x.estado === 'ACTIVO').map((x) => `<option value="${esc(prodTxt(x))}"></option>`).join('')}</datalist>
          <datalist id="nq-cuentas">${contables.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('')}</datalist>
        </form>`;
    }

    function leerFilas() {
      ctx.pDet.querySelectorAll('tr[data-l]').forEach((tr) => { const x = lineas[Number(tr.dataset.l)]; tr.querySelectorAll('[data-c]').forEach((el) => { x[el.dataset.c] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) || 0 : el.value; }); });
      const x = lineas[sel];
      if (x) ctx.pDet.querySelectorAll('[data-s]').forEach((el) => { x[el.dataset.s] = ['tipo_medida_id', 'bodega_id'].includes(el.dataset.s) ? (el.value ? Number(el.value) : null) : el.value || null; });
      ctx.pDet.querySelectorAll('tr[data-k]').forEach((tr) => { const k = contable[Number(tr.dataset.k)]; tr.querySelectorAll('[data-k]').forEach((el) => { if (el.tagName === 'TR') return; k[el.dataset.k] = el.type === 'number' ? fmt.redondear(el.value) : el.value; }); });
    }
    function leer(form) {
      const el = form.elements;
      if (!el.documento) return {};
      const p = provDe(el.proveedor.value);
      return { tipo: el.tipo.value, numero_autorizacion: el.numero_autorizacion.value.trim() || null, serie: el.serie.value.trim() || null, documento: el.documento.value.trim(), fecha: el.fecha.value || null,
        moneda_id: Number(el.moneda_id.value), tipo_cambio: Number(el.tipo_cambio.value) || 1, proveedor_id: p ? p.id : null, proveedor_codigo: p ? String(p.codigo) : null,
        proveedor_nombre: p ? p.nombre_fiscal || p.nombre_comercial : el.proveedor.value.trim(), nit: p?.nit || null, _prov: el.proveedor.value.trim(),
        bodega_id: el.bodega_id.value ? Number(el.bodega_id.value) : null, motivo: el.motivo.value.trim() || null, tipo_ajuste: el.tipo_ajuste.value };
    }
    const valorActual = () => { const form = ctx.pDet.querySelector('.nq-form'); leerFilas(); return { ...(actual || {}), ...leer(form), compra_id: refCompra }; };
    function repintar(cambios = {}) { const v = { ...valorActual(), ...cambios }; delete v._prov; pintarDetalle(v); }
    function totales() {
      leerFilas();
      const form = ctx.pDet.querySelector('.nq-form');
      const cambio = aBase(form.elements.moneda_id?.value, form.elements.tipo_cambio?.value);
      const mi = tasaMI();
      ctx.pDet.querySelectorAll('tr[data-l]').forEach((tr) => { const x = lineas[Number(tr.dataset.l)]; const t = fmt.redondear(x.cantidad * x.precio); tr.querySelector('[data-t]').textContent = fmt.monto(t * cambio); tr.querySelector('[data-pm]').textContent = fmt.monto(x.precio * cambio / mi); tr.querySelector('[data-tm]').textContent = fmt.monto(t * cambio / mi); });
      const val = total();
      const set = (s, t) => { const e = ctx.pDet.querySelector(s); if (e) e.textContent = t; };
      set('[data-valor]', fmt.monto(val)); set('[data-valormi]', fmt.monto(val * cambio / mi)); set('[data-tq]', fmt.monto(val * cambio)); set('[data-tmi]', fmt.monto(val * cambio / mi));
      set('[data-tc]', lineas.reduce((t, x) => t + Number(x.cantidad || 0), 0).toFixed(4));
      set('[data-kd]', fmt.monto(contable.reduce((t, k) => t + Number(k.debe || 0), 0))); set('[data-kh]', fmt.monto(contable.reduce((t, k) => t + Number(k.haber || 0), 0)));
    }

    async function elegirProveedor() {
      const id = await window.LOV({ titulo: 'Proveedores', columnas: ['Código', 'Nombre', 'NIT'], filas: proveedores.filter((p) => p.estado === 'ACTIVO').map((p) => ({ id: p.id, celdas: [p.codigo, p.nombre_comercial, p.nit || ''] })) });
      if (id) cambiarProveedor(prov(id));
    }
    function cambiarProveedor(p) {
      const v = valorActual();
      const otra = v.compra_id && compra(v.compra_id)?.proveedor_id !== p.id;
      if (otra) refCompra = null;
      repintar({ proveedor_id: p.id, proveedor_nombre: p.nombre_fiscal || p.nombre_comercial, nit: p.nit });
    }
    async function elegirCompra() {
      const v = valorActual();
      const cs = compras.filter((c) => c.proveedor_id === v.proveedor_id && c.estado === 'ACTIVA');
      if (!cs.length) return window.FIN.aviso('El proveedor no tiene facturas de compra vigentes');
      const id = await window.LOV({ titulo: 'Facturas del proveedor', columnas: ['Compra', 'Serie', 'Número', 'Fecha', 'Total', 'Saldo'], filas: cs.map((c) => ({ id: c.id, celdas: [c.numero, c.serie || '', c.documento || '', fmt.fechaDia(c.fecha_documento), fmt.monto(c.neto), fmt.monto(c.pendiente)] })) });
      if (!id) return;
      const c = compra(id);
      refCompra = id;
      repintar({ moneda_id: c.moneda_id, tipo_cambio: aBase(c.moneda_id, c.tipo_cambio), bodega_id: v.bodega_id || c.bodega_id });
    }
    async function traer() {
      const v = valorActual();
      const { data, error } = await sb.from('compra_articulos').select('*, ingreso_lineas(lote, fecha_vencimiento, fecha_fabricacion)').eq('compra_id', v.compra_id).order('linea');
      if (error || !data?.length) return window.FIN.aviso('La factura de referencia no tiene artículos: agrega los productos o conceptos');
      const ya = lineas.map((x) => x.producto_id);
      const nuevas = data.filter((a) => !ya.includes(a.producto_id));
      lineas = lineas.concat(nuevas.map((a) => ({ producto_id: a.producto_id, cantidad: Number(a.cantidad), precio: fmt.redondear(Number(a.costo_total) / Number(a.cantidad) * 10000) / 10000, inventario: a.inventariado && v.tipo_ajuste === 'DEVOLUCIÓN',
        tipo_medida_id: prod(a.producto_id)?.tipo_medida_id || null, lote: a.ingreso_lineas?.lote || a.serie || null, fecha_vencimiento: a.ingreso_lineas?.fecha_vencimiento || null, fecha_fabricacion: a.ingreso_lineas?.fecha_fabricacion || null, bodega_id: null })));
      pintarDetalle(v);
      window.FIN.aviso(`${nuevas.length} artículo(s) traído(s): ajusta la cantidad devuelta`);
    }
    function agregar(texto) {
      const p = prodDe(texto);
      if (!p) return window.FIN.aviso('Ese producto no está en el catálogo');
      const v = valorActual();
      lineas.push({ producto_id: p.id, cantidad: 1, precio: Number(p.precio_costo) || 0, inventario: v.tipo_ajuste === 'DEVOLUCIÓN', tipo_medida_id: p.tipo_medida_id, lote: null, bodega_id: null });
      sel = lineas.length - 1;
      pintarDetalle(v);
    }
    // Revierte en proporción el detalle contable de la factura de referencia (o la cuenta por pagar).
    async function contabilizar() {
      const v = valorActual();
      const val = total();
      if (!val) return window.FIN.aviso('Agrega primero el detalle de la nota');
      const c = compra(v.compra_id);
      const credito = v.tipo === 'NOTA DE CRÉDITO';
      let nuevas = [];
      if (c) {
        const { data } = await sb.from('compra_lineas').select('cuenta_id, debe, haber, centro_id').eq('compra_id', c.id).order('linea');
        const base = (data || []).reduce((t, l) => t + Number(l.debe), 0);
        if (base) {
          const k = val * aBase(v.moneda_id, v.tipo_cambio) / base;
          nuevas = data.map((l) => { const d = fmt.redondear(Number(l.debe) * k), h = fmt.redondear(Number(l.haber) * k); return { cuenta_id: l.cuenta_id, codigo: cuenta(l.cuenta_id)?.codigo || '', centro_id: l.centro_id, concepto: `${v.tipo} ${v.documento || ''}`, debe: credito ? h : d, haber: credito ? d : h }; });
          const dif = fmt.redondear(nuevas.reduce((t, l) => t + l.debe - l.haber, 0));
          if (dif) { const ult = nuevas.slice().reverse().find((l) => (dif > 0 ? l.haber : l.debe)); if (ult) { if (dif > 0) ult.haber = fmt.redondear(ult.haber + dif); else ult.debe = fmt.redondear(ult.debe - dif); } }
        }
      }
      if (!nuevas.length) {
        const cxp = cuenta(c?.cuenta_pagar_id) || contables.find((x) => x.movimiento && /PROVEEDOR/i.test(x.nombre));
        const q = fmt.redondear(val * aBase(v.moneda_id, v.tipo_cambio));
        nuevas = [{ cuenta_id: cxp?.id, codigo: cxp?.codigo || '', concepto: `${v.tipo} ${v.documento || ''}`, debe: credito ? q : 0, haber: credito ? 0 : q },
          { cuenta_id: null, codigo: '', concepto: v.motivo || '', debe: credito ? 0 : q, haber: credito ? q : 0 }];
      }
      contable = nuevas;
      pintarDetalle(v);
      window.FIN.aviso(c ? 'Detalle contable de la factura revertido en proporción' : 'Completa la cuenta de la contrapartida');
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      leerFilas();
      const v = leer(form);
      if (!v.proveedor_id) { error.textContent = v._prov ? 'Ese proveedor no está en el catálogo.' : 'Elige el proveedor.'; return form.elements.proveedor.focus(); }
      if (!v.documento) { error.textContent = 'Escribe el número de la nota.'; return form.elements.documento.focus(); }
      if (!v.fecha) { error.textContent = 'Escribe la fecha.'; return form.elements.fecha.focus(); }
      const ls = lineas.filter((x) => x.producto_id || (x.descripcion || '').trim());
      if (!ls.length) { pestana = 'DETALLE'; error.textContent = 'Agrega el detalle de la nota.'; return; }
      if (ls.some((x) => !(x.cantidad > 0))) { error.textContent = 'Revisa las cantidades del detalle.'; return; }
      const valor = total();
      const ks = contable.filter((k) => k.codigo || k.debe || k.haber);
      for (const k of ks) { const kk = porCodigo(k.codigo); if (!kk) { pestana = 'CONTABLE'; error.textContent = `La cuenta ${k.codigo || '(vacía)'} no es de movimiento.`; return; } k.cuenta_id = kk.id; }
      const v2 = { ...v, compra_id: refCompra, valor };
      delete v2._prov;
      error.textContent = '';
      const boton = document.querySelector('[type=submit][form=nq-form]');
      if (boton) boton.disabled = true;
      try {
        let id = actual?.id;
        if (actual) { const r = await sb.from('notas_compra').update(v2).eq('id', id); if (r.error) throw r.error; }
        else { const r = await sb.from('notas_compra').insert({ ...v2, numero: 0, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single(); if (r.error) throw r.error; id = r.data.id; }
        for (const t of ['nota_compra_lineas', 'nota_compra_contable']) { const d = await sb.from(t).delete().eq('nota_id', id); if (d.error) throw d.error; }
        const r1 = await sb.from('nota_compra_lineas').insert(ls.map((x, i) => ({ nota_id: id, linea: i + 1, producto_id: x.producto_id || null, descripcion: x.producto_id ? null : x.descripcion, cantidad: x.cantidad, precio: x.precio || 0, inventario: !!x.inventario && !!x.producto_id,
          tipo_medida_id: x.tipo_medida_id || null, lote: x.lote || null, registro_sanitario: x.registro_sanitario || null, fecha_vencimiento: x.fecha_vencimiento || null, fecha_fabricacion: x.fecha_fabricacion || null, bodega_id: x.bodega_id || null })));
        if (r1.error) throw r1.error;
        if (ks.length) { const r2 = await sb.from('nota_compra_contable').insert(ks.map((k, i) => ({ nota_id: id, linea: i + 1, cuenta_id: k.cuenta_id, concepto: k.concepto || null, debe: k.debe || 0, haber: k.haber || 0, centro_id: k.centro_id || null }))); if (r2.error) throw r2.error; }
        window.FIN.aviso(actual ? 'Nota guardada' : 'Nota registrada');
        editando = false;
        if (f.estado !== 'TODAS' && f.estado !== 'VIGENTE') { f.estado = 'TODAS'; pintarFiltros(); }
        if (v.fecha < f.desde || v.fecha > f.hasta) { f.desde = v.fecha < f.desde ? v.fecha : f.desde; f.hasta = v.fecha > f.hasta ? v.fecha : f.hasta; pintarFiltros(); }
        pestana = 'DETALLE';
        await consultar(id);
      } catch (err) { error.textContent = window.UI.traducirError(err); }
      finally { if (boton) boton.disabled = false; }
    }
    async function procesar(accion) {
      const n = actual;
      let motivo = null;
      if (accion === 'DESCARGAR' && !confirm(`¿Descargar la nota ${n.numero}? Mueve el inventario, genera la póliza y afecta la factura de referencia.`)) return;
      if (accion === 'REVERSAR') { motivo = prompt(`Motivo de la reversión de la nota ${n.numero} (se anula su póliza):`, 'REVERSIÓN DE LA NOTA'); if (motivo === null) return; }
      if (accion === 'ANULAR') { motivo = prompt(`Motivo de la anulación de la nota ${n.numero}:`); if (motivo === null) return; }
      const { data, error } = await sb.rpc('procesar_nota_compra', { p_id: n.id, p_accion: accion, p_motivo: motivo });
      if (error) { const e = ctx.pDet.querySelector('.modal-error'); if (e) e.textContent = window.UI.traducirError(error); return; }
      window.FIN.aviso({ DESCARGAR: `Nota descargada${data.partida ? ` · póliza ${data.partida}` : ''}`, REVERSAR: 'Nota reversada', ANULAR: 'Nota anulada' }[accion]);
      const { data: cs } = await sb.from('compras_saldo').select('id, numero, serie, documento, fecha_documento, proveedor_id, bodega_id, moneda_id, tipo_cambio, valor_total, neto, pendiente, estado, cuenta_pagar_id').eq('localidad_id', ctx.sel.loc).order('numero', { ascending: false }).limit(5000);
      compras = cs || compras;
      await consultar(n.id);
    }
    function imprimirNota() {
      const n = actual, c = compra(n.compra_id), e = ctx.localidad(n.localidad_id);
      const cambio = aBase(n.moneda_id, n.tipo_cambio);
      imprimir(`Nota ${n.numero}`, `<h1>${esc(n.tipo)} No. ${n.numero} · ${esc(docTxt(n))}</h1><h2>${esc(e ? `${e.codigo} · ${e.nombre_comercial}` : '')} · ${esc(fmt.fechaDia(n.fecha))} · ${esc(n.estado)}</h2>
        <div class="cab"><div style="grid-column:span 2"><b>Proveedor</b>${esc([n.proveedor_codigo, n.proveedor_nombre].filter(Boolean).join(' · '))}</div><div><b>NIT</b>${esc(n.nit || '')}</div><div><b>Autorización</b>${esc(n.numero_autorizacion || '')}</div>
          <div><b>Factura de referencia</b>${c ? `Compra ${c.numero} · ${esc(docTxt(c))}` : '—'}</div><div><b>Tipo de ajuste</b>${esc(n.tipo_ajuste)}</div><div><b>Bodega</b>${esc(bodega(n.bodega_id)?.nombre || '')}</div><div><b>Póliza</b>${n._partida ? `${n._partida.mes}-${n._partida.numero}` : '—'}</div>
          <div style="grid-column:span 4"><b>Motivo</b>${esc(n.motivo || '')}</div></div>
        <table><thead><tr><th>#</th><th>Código</th><th>Descripción</th><th>Lote</th><th class="n">Cantidad</th><th class="n">Precio Q</th><th class="n">Total Q</th><th>Inv</th></tr></thead>
        <tbody>${lineas.map((x, i) => { const p = prod(x.producto_id); return `<tr><td>${i + 1}</td><td>${esc(p?.codigo_producto || '')}</td><td>${esc(p?.nombre || x.descripcion || '')}</td><td>${esc(x.lote || '')}</td><td class="n">${x.cantidad}</td><td class="n">${fmt.monto(x.precio * cambio)}</td><td class="n">${fmt.monto(x.cantidad * x.precio * cambio)}</td><td>${x.inventario ? 'Sí' : ''}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr><td colspan="6">Total</td><td class="n">${fmt.monto(total() * cambio)}</td><td></td></tr></tfoot></table>
        ${contable.length ? `<h3>Detalle contable</h3><table><thead><tr><th>Cuenta</th><th>Nombre</th><th>Concepto</th><th class="n">Debe</th><th class="n">Haber</th></tr></thead><tbody>${contable.map((k) => `<tr><td>${esc(k.codigo)}</td><td>${esc(cuenta(k.cuenta_id)?.nombre || '')}</td><td>${esc(k.concepto || '')}</td><td class="n">${fmt.monto(k.debe)}</td><td class="n">${fmt.monto(k.haber)}</td></tr>`).join('')}</tbody></table>` : ''}
        <div class="firmas"><div>Elaboró</div><div>Revisó</div><div>Autorizó</div></div>`);
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { pintarFiltros(); return cargarLocalidad(); }
      if (cambio === 'otro') { f[e.target.name] = e.target.value; if (f.hasta < f.desde) { if (e.target.name === 'desde') f.hasta = f.desde; else f.desde = f.hasta; } pintarFiltros(); return consultar(); }
      const form = e.target.closest('.nq-form');
      if (!form) return;
      if (e.target.name === 'proveedor') { const p = provDe(e.target.value); if (p) return cambiarProveedor(p); form.querySelector('.modal-error').textContent = e.target.value.trim() ? 'Ese proveedor no está en el catálogo.' : ''; return; }
      if (e.target.matches('[data-agregar]')) { const t = e.target.value; e.target.value = ''; return agregar(t); }
      if (e.target.dataset.k === 'codigo') { const kk = porCodigo(e.target.value); e.target.closest('tr').querySelector('[data-kn]').textContent = kk ? kk.nombre : e.target.value ? 'No es una cuenta de movimiento' : ''; }
      if (['moneda_id', 'tipo_cambio'].includes(e.target.name) || e.target.dataset.c || e.target.dataset.k || e.target.dataset.s) totales();
    });
    cont.addEventListener('input', (e) => { if (e.target.dataset.c === 'cantidad' || e.target.dataset.c === 'precio' || e.target.dataset.k === 'debe' || e.target.dataset.k === 'haber' || e.target.name === 'tipo_cambio') totales(); });
    cont.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-agregar]')) { e.preventDefault(); const t = e.target.value; e.target.value = ''; agregar(t); } });
    cont.addEventListener('click', (e) => {
      const fila = e.target.closest('tr[data-id]');
      if (fila) { pestana = 'DETALLE'; return abrir(lista.find((x) => String(x.id) === fila.dataset.id)); }
      const tab = e.target.closest('[data-pestana]');
      if (tab) { pestana = tab.dataset.pestana; return ctx.pDet.querySelector('.nq-form [name=documento]') ? repintar() : pintarDetalle(); }
      const q = e.target.closest('[data-quitar]');
      if (q) { leerFilas(); lineas.splice(Number(q.dataset.quitar), 1); sel = Math.max(0, Math.min(sel, lineas.length - 1)); return repintar(); }
      const qk = e.target.closest('[data-quitar-k]');
      if (qk) { leerFilas(); contable.splice(Number(qk.dataset.quitarK), 1); return repintar(); }
      const ln = e.target.closest('tr[data-l]');
      if (ln && !e.target.closest('input, button') && Number(ln.dataset.l) !== sel) { leerFilas(); sel = Number(ln.dataset.l); return ctx.pDet.querySelector('.nq-form [name=documento]') ? repintar() : pintarDetalle(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (!a) return;
      if (a === 'nueva') { actual = null; editando = true; lineas = []; contable = []; sel = 0; pestana = 'DETALLE'; refCompra = null; pintarBarra(); return pintarDetalle(); }
      if (a === 'modificar') { editando = true; pintarBarra(); return pintarDetalle(); }
      if (a === 'cancelar') return abrir(actual || lista[0] || null);
      if (a === 'lov-proveedor') return elegirProveedor();
      if (a === 'lov-compra') return elegirCompra();
      if (a === 'sin-compra') { refCompra = null; return repintar(); }
      if (a === 'traer') return traer();
      if (a === 'concepto') { leerFilas(); lineas.push({ producto_id: null, descripcion: '', cantidad: 1, precio: 0, inventario: false }); sel = lineas.length - 1; repintar(); return ctx.pDet.querySelectorAll('[data-c=descripcion]')[ctx.pDet.querySelectorAll('[data-c=descripcion]').length - 1]?.focus(); }
      if (a === 'contabilizar') return contabilizar();
      if (a === 'linea-contable') { leerFilas(); contable.push({ codigo: '', concepto: '', debe: 0, haber: 0 }); return repintar(); }
      if (a === 'imprimir') return imprimirNota();
      if (['DESCARGAR', 'REVERSAR', 'ANULAR'].includes(a)) return procesar(a);
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.nq-form')) { e.preventDefault(); guardar(e.target); } });
    iniciar();
  };

  // ===================== Productos en consignación =====================
  // Partes de depósito: ENVÍO (entra a la bodega sin ser compra) o DEVOLUCIÓN (regresa al proveedor).
  const CLASE_K = { VIGENTE: 'pendiente', CARGADA: 'definitiva', ANULADA: 'anulada' };
  const marcaK = (e) => `<span class="pc-marca ${CLASE_K[e]}">${e.charAt(0) + e.slice(1).toLowerCase()}</span>`;
  window.PANTALLAS['productos-consignacion'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Productos en consignación', icono: 'ti-packages', clase: 'bk-movimientos kq-consig', grupo: 'Compras · Registros' });
    const { sb } = ctx;
    const [y, m] = fmt.hoy().split('-');
    const f = { estado: 'TODAS', desde: `${y}-${m}-01`, hasta: fmt.hoy(), formato: 'PDF' };
    let lista = [], proveedores = [], bodegas = [], productos = [], transacciones = [], existencias = new Map();
    let actual = null, editando = false, pestana = 'DETALLE', lineas = [];
    const prov = (id) => proveedores.find((p) => p.id === id);
    const provTxt = (p) => `${p.codigo} · ${p.nombre_comercial}`;
    const provDe = (t0) => { const t = String(t0 || '').trim().toUpperCase(); return t ? proveedores.find((p) => provTxt(p).toUpperCase() === t) || proveedores.find((p) => String(p.codigo) === t || (p.nit && p.nit.toUpperCase() === t)) || null : null; };
    const prod = (id) => productos.find((p) => p.id === id);
    const prodTxt = (p) => `${p.codigo_producto || p.codigo} · ${p.nombre}`;
    const prodDe = (t0) => { const t = String(t0 || '').trim().toUpperCase(); return t ? productos.find((p) => prodTxt(p).toUpperCase() === t) || productos.find((p) => (p.codigo_barras || '').toUpperCase() === t || (p.codigo_producto || '').toUpperCase() === t || String(p.codigo) === t) || null : null; };
    const bodega = (id) => bodegas.find((b) => b.id === id);
    const total = () => fmt.redondear(lineas.reduce((t, l) => t + Number(l.costo_total || 0), 0));
    const editable = () => ctx.admin && (!actual || (editando && actual.estado === 'VIGENTE'));

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Estado</span><select name="estado">${['TODAS', 'VIGENTE', 'CARGADA', 'ANULADA'].map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha desde</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha hasta</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <div class="cf-barra" data-barra></div>`);
      pintarBarra();
    }
    function pintarBarra() {
      const b = ctx.pFil.querySelector('[data-barra]');
      if (!b) return;
      b.innerHTML = editable()
        ? `<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button><button type="submit" form="kq-form" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${actual ? 'Guardar' : 'Registrar parte'}</button>`
        : `${ctx.admin ? '<button type="button" class="boton secundario-sm" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>' : ''}${ctx.admin && actual?.estado === 'VIGENTE' ? '<button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}`;
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('consignaciones').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/consignaciones/.test(prueba.error.message) ? 'Falta instalar el script 65 (notas de compras y productos en consignación) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      pintarFiltros();
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      const vacio = { data: [] };
      const [p, b, pr, ex, tr] = await Promise.all([
        loc ? sb.from('proveedores').select('id, codigo, nit, nombre_comercial, nombre_fiscal, estado').eq('localidad_id', loc).order('nombre_comercial') : vacio,
        loc ? sb.from('bodegas').select('id, codigo, nombre, estado').eq('localidad_id', loc).order('codigo') : vacio,
        loc ? sb.from('productos').select('id, codigo, codigo_producto, codigo_barras, nombre, precio_costo, estado').eq('localidad_id', loc).order('nombre') : vacio,
        loc ? sb.from('existencias').select('producto_id, bodega_id, existencia').eq('localidad_id', loc) : vacio,
        window.COMPRAS_CAT.transaccionesLocalidad(sb, loc)
      ]);
      proveedores = p.data || []; bodegas = b.data || []; productos = pr.data || []; transacciones = tr;
      existencias = new Map((ex.data || []).map((x) => [`${x.producto_id}|${x.bodega_id}`, Number(x.existencia)]));
      await consultar(null);
    }
    async function consultar(id = actual?.id) {
      if (!ctx.sel.loc) { lista = []; return abrir(null); }
      let q = sb.from('consignaciones').select('*, consignacion_lineas(count)').eq('localidad_id', ctx.sel.loc).gte('fecha_documento', f.desde).lte('fecha_documento', f.hasta).order('numero', { ascending: false });
      if (f.estado !== 'TODAS') q = q.eq('estado', f.estado);
      const { data, error } = await q;
      if (error) { ctx.pDet.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      lista = (data || []).map((k) => ({ ...k, lineas: k.consignacion_lineas?.[0]?.count || 0 }));
      await abrir(lista.find((k) => k.id === id) || lista[0] || null);
    }
    async function abrir(k) {
      actual = k; editando = false; lineas = [];
      if (k) {
        const { data } = await sb.from('consignacion_lineas').select('*').eq('consignacion_id', k.id).order('linea');
        lineas = (data || []).map((l) => ({ ...l, cantidad: Number(l.cantidad), costo_total: Number(l.costo_total) }));
      }
      pintarBarra();
      pintarDetalle();
    }
    function nuevoValor() { return { tipo_documento: 'ENVÍO', fecha_documento: fmt.hoy(), estado: 'VIGENTE', bodega_id: bodegas.find((b) => b.estado === 'ACTIVO')?.id || null }; }

    function pintarDetalle(v0) {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-packages'); return; }
      const k = actual;
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const v = v0 || (k ? { ...k } : nuevoValor());
      const tab = !k && !ed ? 'LISTA' : pestana;
      const p = prov(v.proveedor_id);
      const b = bodega(v.bodega_id);
      const consulta = k && !editando;
      const boton = (accion, icono, texto, ok, clase = 'secundario-sm') => `<button type="button" class="boton ${clase}" data-accion="${accion}" ${ok ? '' : 'disabled'}><i class="ti ${icono}" aria-hidden="true"></i> ${texto}</button>`;
      const devol = v.tipo_documento === 'DEVOLUCIÓN';
      ctx.pDet.innerHTML = `
        <form id="kq-form" class="tk-form ta-form bm-form kq-form cl-clasico" novalidate>
          <div class="cl-banda">Productos en consignación</div>
          ${!k && !ed ? `<p class="ck-elige"><i class="ti ti-hand-click" aria-hidden="true"></i> No hay partes de depósito con esos filtros${ctx.admin ? ': crea uno con «Nuevo»' : ''}.</p>` : `
          <section class="kq-cab">
            <div class="kq-datos">
              <div class="campo kq-num"><span>Consig.</span><b>${k ? k.numero : 'Nuevo'}</b></div>
              <label class="campo"><span>Tipo documento</span><select name="tipo_documento" ${dis}>${['ENVÍO', 'DEVOLUCIÓN'].map((t) => `<option ${v.tipo_documento === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
              <label class="campo"><span>Documento</span><input name="documento" value="${esc(v.documento || '')}" maxlength="40" ${dis}></label>
              <label class="campo"><span>Serie</span><input name="serie" value="${esc(v.serie || '')}" maxlength="20" ${dis}></label>
              <label class="campo"><span>Fecha documento *</span><input type="date" name="fecha_documento" value="${esc(v.fecha_documento || '')}" ${dis}></label>
              <div class="campo"><span>Estado</span>${marcaK(v.estado || 'VIGENTE')}</div>
              <div class="campo kq-total"><span>Valor total</span><b data-total>${fmt.monto(total())}</b></div>

              <label class="campo kq-prov"><span>Proveedor *</span><div class="lov-campo"><input list="kq-proveedores" name="proveedor" value="${esc(p ? provTxt(p) : v.proveedor_nombre || '')}" placeholder="Código, NIT o nombre" ${dis}><button type="button" class="icono-boton lov-btn" data-accion="lov-proveedor" aria-label="Lista de proveedores" ${dis}><i class="ti ti-dots" aria-hidden="true"></i></button></div></label>
              <div class="campo"><span>NIT</span><b class="nq-txt">${esc(p?.nit || '')}</b></div>
              <label class="campo kq-bod"><span>Bodega *</span><select name="bodega_id" ${dis}><option value="">—</option>${bodegas.filter((x) => x.estado === 'ACTIVO' || x.id === v.bodega_id).map((x) => `<option value="${x.id}" ${x.id === v.bodega_id ? 'selected' : ''}>${x.codigo} · ${esc(x.nombre)}</option>`).join('')}</select></label>
              <label class="campo kq-trx"><span>Transacción</span><select name="transaccion_id" ${dis}>${window.COMPRAS_CAT.opcionesTrx(transacciones, v.transaccion_id)}</select></label>

              <label class="campo kq-desc"><span>Descripción</span><input name="descripcion" value="${esc(v.descripcion || '')}" maxlength="250" placeholder="${devol ? 'Motivo de la devolución al proveedor' : 'Mercadería recibida en consignación'}" ${dis}></label>
              <div class="kq-aud">
                <div class="campo"><span>Usuario ingresa</span><b class="nq-txt">${esc(k ? `${k.usuario || ''} · ${fmt.fechaDia(k.creado_en)}` : '')}</b></div>
                <div class="campo"><span>Usuario modifica</span><b class="nq-txt">${esc(k?.modificado_en ? `${k.modificado_por_nombre || ''} · ${fmt.fechaDia(k.modificado_en)}` : '')}</b></div>
              </div>
            </div>
            <div class="kq-acc">
              ${boton('CARGAR', 'ti-package-import', devol ? 'Descargar del inventario' : 'Cargar al inventario', consulta && ctx.admin && k.estado === 'VIGENTE', 'primario-sm')}
              ${boton('REVERTIR', 'ti-arrow-back-up', 'Revertir carga', consulta && ctx.admin && k.estado === 'CARGADA')}
              ${boton('ANULAR', 'ti-ban', 'Anular', consulta && ctx.admin && k.estado === 'VIGENTE')}
              <div class="kq-imp">${boton('imprimir', 'ti-printer', 'Imprimir', !!k)}<select name="formato" aria-label="Formato"><option ${f.formato === 'PDF' ? 'selected' : ''}>PDF</option><option ${f.formato === 'EXCEL' ? 'selected' : ''}>EXCEL</option></select></div>
              ${k?.cargado_por ? `<small class="tk-tenue">Cargó ${esc(k.cargado_por)} · ${esc(fmt.fechaHora(k.cargado_en))}</small>` : ''}
            </div>
          </section>`}
          <p class="modal-error tk-error" role="alert"></p>
          ${k?.estado === 'ANULADA' ? `<p class="tk-aviso bm-anulado"><i class="ti ti-ban" aria-hidden="true"></i> Anulado por ${esc(k.anulado_por || '')} · ${esc(fmt.fechaHora(k.anulado_en))}: ${esc(k.motivo_anulacion || '')}</p>` : ''}
          <section class="bm-pestanas nq-pestanas">
            <div class="bm-tabs-barra"><div class="rp-pestanas" role="tablist">
              ${!k && !ed ? '' : `<button type="button" role="tab" data-pestana="DETALLE" class="${tab === 'DETALLE' ? 'activa' : ''}"><i class="ti ti-packages" aria-hidden="true"></i> Productos${lineas.length ? ` <b>${lineas.length}</b>` : ''}</button>`}
              <button type="button" role="tab" data-pestana="LISTA" class="${tab === 'LISTA' ? 'activa' : ''}"><i class="ti ti-list-search" aria-hidden="true"></i> Listado de partes${lista.length ? ` <b>${lista.length}</b>` : ''}</button>
            </div>
            ${ed && tab === 'DETALLE' ? '<div class="ck-docs-acc"><input list="kq-productos" data-agregar placeholder="Agregar producto (código, código de barras o nombre)…" aria-label="Agregar producto"></div>' : ''}</div>
            <div class="bm-panel" data-panel="DETALLE" ${tab === 'DETALLE' ? '' : 'hidden'}>
              <div class="pc-lineas"><table>
                <thead><tr><th class="pc-n">#</th><th>Código barras</th><th>Producto</th><th>Nombre producto</th>${devol ? '<th class="num">Existencia</th>' : ''}<th class="num">Cantidad</th><th class="num">Costo total</th><th class="num">Costo unitario</th><th class="cc-det">Invent.</th><th></th></tr></thead>
                <tbody>${lineas.map((l, i) => { const pp = prod(l.producto_id); const ex = existencias.get(`${l.producto_id}|${v.bodega_id}`) || 0; return `<tr data-l="${i}">
                  <td class="pc-n">${i + 1}</td><td>${esc(pp?.codigo_barras || '')}</td><td class="fuerte">${esc(pp ? pp.codigo_producto || String(pp.codigo) : '')}</td><td class="nq-desc" title="${esc(pp?.nombre || '')}">${esc(pp?.nombre || '')}</td>
                  ${devol ? `<td class="num ${l.cantidad > ex ? 'pc-rojo' : 'tk-tenue'}">${fmt.monto(ex)}</td>` : ''}
                  <td class="num"><input type="number" step="0.0001" min="0" data-c="cantidad" value="${l.cantidad || ''}" ${dis} aria-label="Cantidad"></td>
                  <td class="num"><input type="number" step="0.01" min="0" data-c="costo_total" value="${l.costo_total || ''}" ${dis} aria-label="Costo total"></td>
                  <td class="num tk-tenue" data-cu>${l.cantidad ? fmt.monto(l.costo_total / l.cantidad) : ''}</td>
                  <td class="cc-det"><input type="checkbox" data-c="inventario" ${l.inventario !== false ? 'checked' : ''} ${dis} aria-label="Mueve inventario"></td>
                  <td>${ed ? `<button type="button" class="icono-boton" data-quitar="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`; }).join('')}${Array.from({ length: Math.max(0, 8 - lineas.length) }, () => `<tr class="rg-vacia"><td colspan="${devol ? 10 : 9}"></td></tr>`).join('')}</tbody>
                <tfoot><tr><td colspan="${devol ? 5 : 4}">${lineas.length} producto(s)</td><td class="num" data-tc>${lineas.reduce((t, l) => t + Number(l.cantidad || 0), 0).toFixed(4)}</td><td class="num" data-tt>${fmt.monto(total())}</td><td class="num kq-ct">Costo total</td><td colspan="2"></td></tr></tfoot>
              </table></div>
            </div>
            <div class="bm-panel" data-panel="LISTA" ${tab === 'LISTA' ? '' : 'hidden'}>
              <div class="pc-lineas"><table>
                <thead><tr><th class="num">Consig.</th><th>Tipo</th><th>Documento</th><th>Fecha</th><th>Proveedor</th><th>Bodega</th><th class="num">Productos</th><th class="num">Valor total</th><th>Estado</th><th>Usuario</th></tr></thead>
                <tbody>${lista.map((x) => `<tr data-id="${x.id}" class="${k?.id === x.id ? 'actual' : ''} ${x.estado === 'ANULADA' ? 'pc-anulada' : ''}" tabindex="0"><td class="num fuerte">${x.numero}</td><td>${esc(x.tipo_documento)}</td><td>${esc([x.serie, x.documento].filter(Boolean).join('-'))}</td><td>${esc(fmt.fechaDia(x.fecha_documento))}</td><td class="ta-desc">${esc(x.proveedor_nombre || '')}</td><td>${esc(bodega(x.bodega_id)?.nombre || '')}</td><td class="num">${x.lineas}</td><td class="num">${fmt.monto(x.valor_total)}</td><td>${marcaK(x.estado)}</td><td>${esc(x.usuario || '')}</td></tr>`).join('')
                  || '<tr><td colspan="10" class="tk-vacio">No hay partes de depósito con esos filtros.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="7">${lista.length} parte(s)</td><td class="num">${fmt.monto(lista.filter((x) => x.estado === 'CARGADA').reduce((t, x) => t + Number(x.valor_total), 0))}</td><td colspan="2">cargados</td></tr></tfoot>
              </table></div>
            </div>
          </section>
          <datalist id="kq-proveedores">${proveedores.filter((x) => x.estado === 'ACTIVO').map((x) => `<option value="${esc(provTxt(x))}"></option>`).join('')}</datalist>
          <datalist id="kq-productos">${productos.filter((x) => x.estado === 'ACTIVO').map((x) => `<option value="${esc(prodTxt(x))}">${esc(x.codigo_barras || '')}</option>`).join('')}</datalist>
        </form>`;
    }

    function leerFilas() { ctx.pDet.querySelectorAll('tr[data-l]').forEach((tr) => { const l = lineas[Number(tr.dataset.l)]; tr.querySelectorAll('[data-c]').forEach((el) => { l[el.dataset.c] = el.type === 'checkbox' ? el.checked : Number(el.value) || 0; }); }); }
    function leer(form) {
      const el = form.elements;
      if (!el.proveedor) return {};
      const p = provDe(el.proveedor.value);
      return { tipo_documento: el.tipo_documento.value, documento: el.documento.value.trim() || null, serie: el.serie.value.trim() || null, fecha_documento: el.fecha_documento.value || null,
        proveedor_id: p ? p.id : null, proveedor_nombre: p ? p.nombre_fiscal || p.nombre_comercial : el.proveedor.value.trim(), _prov: el.proveedor.value.trim(),
        bodega_id: el.bodega_id.value ? Number(el.bodega_id.value) : null, transaccion_id: el.transaccion_id.value ? Number(el.transaccion_id.value) : null, descripcion: el.descripcion.value.trim() || null };
    }
    function repintar(cambios = {}) { const form = ctx.pDet.querySelector('.kq-form'); leerFilas(); const v = { ...(actual || {}), ...leer(form), ...cambios }; delete v._prov; pintarDetalle(v); }
    function totales() {
      leerFilas();
      ctx.pDet.querySelectorAll('tr[data-l]').forEach((tr) => { const l = lineas[Number(tr.dataset.l)]; tr.querySelector('[data-cu]').textContent = l.cantidad ? fmt.monto(l.costo_total / l.cantidad) : ''; });
      const set = (s, t) => { const e = ctx.pDet.querySelector(s); if (e) e.textContent = t; };
      set('[data-total]', fmt.monto(total())); set('[data-tt]', fmt.monto(total())); set('[data-tc]', lineas.reduce((t, l) => t + Number(l.cantidad || 0), 0).toFixed(4));
    }
    function agregar(texto) {
      const p = prodDe(texto);
      if (!p) return window.FIN.aviso('Ese producto no está en el catálogo');
      leerFilas();
      const ya = lineas.find((l) => l.producto_id === p.id);
      if (ya) { ya.cantidad += 1; ya.costo_total = fmt.redondear(ya.costo_total + (Number(p.precio_costo) || 0)); }
      else lineas.push({ producto_id: p.id, cantidad: 1, costo_total: Number(p.precio_costo) || 0, inventario: true });
      repintar();
      const ins = ctx.pDet.querySelectorAll('[data-c=cantidad]'); (ya ? ins[lineas.indexOf(ya)] : ins[ins.length - 1])?.select();
    }
    async function elegirProveedor() {
      const id = await window.LOV({ titulo: 'Proveedores', columnas: ['Código', 'Nombre', 'NIT'], filas: proveedores.filter((p) => p.estado === 'ACTIVO').map((p) => ({ id: p.id, celdas: [p.codigo, p.nombre_comercial, p.nit || ''] })) });
      if (id) { const p = prov(id); repintar({ proveedor_id: p.id, proveedor_nombre: p.nombre_fiscal || p.nombre_comercial }); }
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      leerFilas();
      const v = leer(form);
      if (!v.proveedor_id) { error.textContent = v._prov ? 'Ese proveedor no está en el catálogo.' : 'Elige el proveedor.'; return form.elements.proveedor.focus(); }
      if (!v.fecha_documento) { error.textContent = 'Escribe la fecha del documento.'; return form.elements.fecha_documento.focus(); }
      if (!v.bodega_id) { error.textContent = 'Elige la bodega.'; return form.elements.bodega_id.focus(); }
      if (!lineas.length) { pestana = 'DETALLE'; error.textContent = 'Agrega los productos del parte de depósito.'; return; }
      const mal = lineas.find((l) => !(l.cantidad > 0));
      if (mal) { error.textContent = `Revisa la cantidad de ${prod(mal.producto_id)?.nombre || 'un producto'}.`; return; }
      delete v._prov;
      error.textContent = '';
      const boton = document.querySelector('[type=submit][form=kq-form]');
      if (boton) boton.disabled = true;
      try {
        let id = actual?.id;
        const datos = { ...v, valor_total: total() };
        if (actual) { const r = await sb.from('consignaciones').update(datos).eq('id', id); if (r.error) throw r.error; }
        else { const r = await sb.from('consignaciones').insert({ ...datos, numero: 0, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single(); if (r.error) throw r.error; id = r.data.id; }
        const d = await sb.from('consignacion_lineas').delete().eq('consignacion_id', id);
        if (d.error) throw d.error;
        const r = await sb.from('consignacion_lineas').insert(lineas.map((l, i) => ({ consignacion_id: id, linea: i + 1, producto_id: l.producto_id, cantidad: l.cantidad, costo_total: fmt.redondear(l.costo_total), inventario: l.inventario !== false })));
        if (r.error) throw r.error;
        window.FIN.aviso(actual ? 'Parte de depósito guardado' : 'Parte de depósito registrado');
        editando = false;
        if (v.fecha_documento < f.desde || v.fecha_documento > f.hasta) { f.desde = v.fecha_documento < f.desde ? v.fecha_documento : f.desde; f.hasta = v.fecha_documento > f.hasta ? v.fecha_documento : f.hasta; }
        if (f.estado !== 'TODAS' && f.estado !== 'VIGENTE') f.estado = 'TODAS';
        pintarFiltros();
        await consultar(id);
      } catch (err) { error.textContent = window.UI.traducirError(err); }
      finally { if (boton) boton.disabled = false; }
    }
    async function procesar(accion) {
      const k = actual;
      let motivo = null;
      if (accion === 'CARGAR' && !confirm(k.tipo_documento === 'ENVÍO' ? `¿Cargar a la bodega los productos del parte ${k.numero}?` : `¿Sacar de la bodega los productos devueltos en el parte ${k.numero}?`)) return;
      if (accion === 'REVERTIR' && !confirm(`¿Revertir la carga al inventario del parte ${k.numero}?`)) return;
      if (accion === 'ANULAR') { motivo = prompt(`Motivo de la anulación del parte ${k.numero}:`); if (motivo === null) return; }
      const { data, error } = await sb.rpc('procesar_consignacion', { p_id: k.id, p_accion: accion, p_motivo: motivo });
      if (error) { const e = ctx.pDet.querySelector('.modal-error'); if (e) e.textContent = window.UI.traducirError(error); return; }
      window.FIN.aviso({ CARGAR: `${data.movimientos} producto(s) movido(s) en el inventario`, REVERTIR: 'Carga revertida', ANULAR: 'Parte de depósito anulado' }[accion]);
      await cargarLocalidad().then(() => consultar(k.id));
    }
    function imprimirParte() {
      const k = actual, p = prov(k.proveedor_id), e = ctx.localidad(k.localidad_id);
      if (f.formato === 'EXCEL') return window.COMPRAS_CAT.descargarCsv(`consignacion_${k.numero}.csv`, [['#', 'Código barras', 'Producto', 'Nombre', 'Cantidad', 'Costo total', 'Costo unitario', 'Inventario'], ...lineas.map((l, i) => { const pp = prod(l.producto_id); return [i + 1, pp?.codigo_barras || '', pp?.codigo_producto || '', pp?.nombre || '', l.cantidad, l.costo_total.toFixed(2), (l.costo_total / l.cantidad).toFixed(4), l.inventario ? 'SÍ' : 'NO']; })]);
      imprimir(`Consignación ${k.numero}`, `<h1>Parte de depósito No. ${k.numero} · ${esc(k.tipo_documento)}</h1><h2>${esc(e ? `${e.codigo} · ${e.nombre_comercial}` : '')} · Productos en consignación · ${esc(k.estado)}</h2>
        <div class="cab"><div style="grid-column:span 2"><b>Proveedor</b>${esc(p ? provTxt(p) : k.proveedor_nombre || '')}</div><div><b>NIT</b>${esc(p?.nit || '')}</div><div><b>Documento</b>${esc([k.serie, k.documento].filter(Boolean).join('-'))}</div>
          <div><b>Fecha</b>${esc(fmt.fechaDia(k.fecha_documento))}</div><div><b>Bodega</b>${esc(bodega(k.bodega_id)?.nombre || '')}</div><div><b>Usuario</b>${esc(k.usuario || '')}</div><div><b>Valor total</b>Q ${fmt.monto(k.valor_total)}</div>
          <div style="grid-column:span 4"><b>Descripción</b>${esc(k.descripcion || '')}</div></div>
        <table><thead><tr><th>#</th><th>Código barras</th><th>Producto</th><th>Nombre</th><th class="n">Cantidad</th><th class="n">Costo total</th><th class="n">Costo unitario</th><th>Inv.</th></tr></thead>
        <tbody>${lineas.map((l, i) => { const pp = prod(l.producto_id); return `<tr><td>${i + 1}</td><td>${esc(pp?.codigo_barras || '')}</td><td>${esc(pp?.codigo_producto || '')}</td><td>${esc(pp?.nombre || '')}</td><td class="n">${l.cantidad}</td><td class="n">${fmt.monto(l.costo_total)}</td><td class="n">${fmt.monto(l.costo_total / l.cantidad)}</td><td>${l.inventario ? 'Sí' : ''}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr><td colspan="5">Costo total</td><td class="n">${fmt.monto(total())}</td><td colspan="2"></td></tr></tfoot></table>
        <div class="firmas"><div>Entregó</div><div>Recibió</div><div>Autorizó</div></div>`);
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { pintarFiltros(); return cargarLocalidad(); }
      if (cambio === 'otro') { f[e.target.name] = e.target.value; if (f.hasta < f.desde) { if (e.target.name === 'desde') f.hasta = f.desde; else f.desde = f.hasta; } pintarFiltros(); return consultar(); }
      const form = e.target.closest('.kq-form');
      if (!form) return;
      if (e.target.name === 'formato') { f.formato = e.target.value; return; }
      if (e.target.name === 'proveedor') { const p = provDe(e.target.value); if (p) return repintar({ proveedor_id: p.id }); form.querySelector('.modal-error').textContent = e.target.value.trim() ? 'Ese proveedor no está en el catálogo.' : ''; return; }
      if (['tipo_documento', 'bodega_id'].includes(e.target.name)) return repintar();
      if (e.target.matches('[data-agregar]')) { const t = e.target.value; e.target.value = ''; return agregar(t); }
      if (e.target.dataset.c) totales();
    });
    cont.addEventListener('input', (e) => { if (e.target.dataset.c === 'cantidad' || e.target.dataset.c === 'costo_total') totales(); });
    cont.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-agregar]')) { e.preventDefault(); const t = e.target.value; e.target.value = ''; agregar(t); } });
    cont.addEventListener('click', (e) => {
      const fila = e.target.closest('tr[data-id]');
      if (fila) { pestana = 'DETALLE'; return abrir(lista.find((x) => String(x.id) === fila.dataset.id)); }
      const tab = e.target.closest('[data-pestana]');
      if (tab) { pestana = tab.dataset.pestana; return ctx.pDet.querySelector('.kq-form [name=proveedor]') ? repintar() : pintarDetalle(); }
      const q = e.target.closest('[data-quitar]');
      if (q) { leerFilas(); lineas.splice(Number(q.dataset.quitar), 1); return repintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (!a) return;
      if (a === 'nueva') { actual = null; editando = true; lineas = []; pestana = 'DETALLE'; pintarBarra(); return pintarDetalle(); }
      if (a === 'modificar') { editando = true; pintarBarra(); return pintarDetalle(); }
      if (a === 'cancelar') return abrir(actual || lista[0] || null);
      if (a === 'lov-proveedor') return elegirProveedor();
      if (a === 'imprimir') return imprimirParte();
      if (['CARGAR', 'REVERTIR', 'ANULAR'].includes(a)) return procesar(a);
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.kq-form')) { e.preventDefault(); guardar(e.target); } });
    iniciar();
  };
})();
