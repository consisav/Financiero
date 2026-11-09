// Facturación/Ventas · Registros · Notas electrónicas: notas de crédito, de débito y de abono (una misma pantalla con
// distinta configuración; el diseño del sistema anterior con el estilo de Facturas Ventas).
//   Encabezado: número interno (NC-n), datos FEL (autorización, serie, DTE, emisión, certificación, estado), moneda,
//   valor y valor MI. Cliente: tipo de documento, NIT, cliente, contacto, teléfono, correo, direcciones, vendedor y
//   bodega destino. Factura de referencia (SAT): número interno, autorización, serie, DTE, fechas, saldo,
//   clasificación, exento de IVA, tipo de ajuste, bodega de la factura y saldo a favor; motivo del ajuste.
//   Pestañas: Detalle nota (productos con unidad, lote, registro sanitario y fechas al lado), Detalle contable (con
//   montos MI), Listado de notas y Procedimientos (certificar, imprimir, anular, validar y auditoría).
//   Efecto: la de crédito y la de abono bajan el saldo de la factura; la de débito lo sube (lo hace la base de datos).
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const TIPOS = {
    'notas-de-credito-electronicas': { tipo: 'CRÉDITO', titulo: 'Notas de Crédito', nombre: 'Nota de crédito', icono: 'ti-file-minus', ajuste: 'DESCUENTO', doc: 'NOTA DE CRÉDITO' },
    'notas-de-debito-electronicas': { tipo: 'DÉBITO', titulo: 'Notas de Débito', nombre: 'Nota de débito', icono: 'ti-file-plus', ajuste: 'INTERESES', doc: 'NOTA DE DÉBITO' },
    'notas-de-abono-electronicas': { tipo: 'ABONO', titulo: 'Notas de Abono', nombre: 'Nota de abono', icono: 'ti-file-dollar', ajuste: 'DEVOLUCIÓN', doc: 'NOTA DE ABONO' }
  };
  const AJUSTES = ['DESCUENTO', 'DEVOLUCIÓN', 'BONIFICACIÓN', 'CORRECCIÓN DE PRECIO', 'INTERESES', 'OTRO'];
  const CLASIFICACIONES = ['BIENES', 'SERVICIOS', 'BIENES Y SERVICIOS'];
  const PESTANAS = [['DETALLE', 'Detalle nota', 'ti-list-details'], ['CONTABLE', 'Detalle contable', 'ti-notebook'], ['LISTADO', 'Listado de notas', 'ti-list-search'], ['PROCESOS', 'Procedimientos', 'ti-settings-automation']];

  Object.entries(TIPOS).forEach(([clave, cfg]) => {
    window.PANTALLAS[clave] = function (cont, m, extra) { pantalla(cont, extra, clave, cfg); };
  });

  function pantalla(cont, extra, clave, cfg) {
    const ctx = montar(cont, { titulo: cfg.titulo, icono: cfg.icono, clase: 'bk-movimientos bm-solo vf-facturas vn-notas', grupo: 'Ventas · Registros' });
    const { sb } = ctx;
    let clientes = [], vendedores = [], bodegas = [], productos = [], contables = [], centros = [], locCargada = null;
    let actual = null, modificando = false, pestana = 'DETALLE', lineaSel = 0;
    let lineas = [], conta = [], factura = null, listado = null, listaTexto = '';

    const cliente = (id) => clientes.find((c) => c.id === id);
    const producto = (id) => productos.find((p) => p.id === id);
    const porCodigoProd = (cod) => productos.find((p) => String(p.codigo) === String(cod).trim());
    const cuenta = (id) => contables.find((c) => c.id === id);
    const cuentaPorCodigo = (cod) => contables.find((c) => c.codigo === String(cod || '').trim() && c.movimiento);
    const centro = (id) => centros.find((c) => c.id === id);
    const sim = (id) => ctx.moneda(id)?.simbolo || 'Q';
    const nombreNota = (n) => n ? `NC-${n.numero ?? ''}` : '';
    const nombreFac = (f) => f ? (f.serie ? `${f.serie}-${f.numero_dte || ''}` : `Interna ${f.numero}`) : '';
    const editable = () => ctx.admin && (!actual || (modificando && actual.estado === 'EMITIDA'));
    const nuevaLinea = () => ({ producto_id: null, producto_codigo: '', descripcion: '', tipo: 'BIEN', cantidad: 1, precio: 0, inventario: cfg.tipo !== 'DÉBITO', unidad_medida: '', lote: '', registro_sanitario: '', fecha_vencimiento: '', fecha_fabricacion: '' });
    const marcaDe = (n) => !n ? ['pendiente', 'Sin registrar'] : n.estado === 'ANULADA' ? ['anulada', 'Anulada'] : n.estado === 'CERTIFICADA' ? ['definitiva', 'Certificada'] : ['aprobada', 'Emitida'];

    function pintarFiltros() {
      ctx.filtros(`<label class="campo vr-ir"><span>Nota NC-</span><input name="ir_nota" inputmode="numeric" placeholder="Número" autocomplete="off"></label>`, '');
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('notas_venta').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/notas_venta/.test(prueba.error.message) ? 'Falta instalar el script 134 (notas electrónicas) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      pintarFiltros();
      await cargarLocalidad();
      const id = /^\d+$/.test(String(extra || '')) ? Number(extra) : null;
      if (id) { const { data } = await sb.from('notas_venta').select('*').eq('id', id).maybeSingle(); if (data) return abrir(data); }
      // Desde Facturas Ventas: nota nueva con la factura de referencia.
      const mf = /^factura-(\d+)$/.exec(String(extra || ''));
      if (mf) { await abrir(null); return usarFactura(Number(mf[1])); }
      abrir(null);
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc || 0;
      locCargada = loc;
      const [c, v, b, p] = await Promise.all([
        window.UI.todo(sb.from('clientes').select('id, codigo, nombre, documento, tipo_documento, direccion, contacto, telefono, correo, vendedor_id, estado').eq('localidad_id', loc).order('nombre').order('id')),
        window.UI.todo(sb.from('vendedores').select('id, codigo, nombre, activo').eq('localidad_id', loc).order('codigo').order('id')),
        sb.from('bodegas').select('id, codigo, nombre, estado').eq('localidad_id', loc).order('codigo'),
        sb.from('productos').select('id, codigo, nombre, estado, lote').eq('localidad_id', loc).order('codigo')
      ]);
      clientes = c.data || []; vendedores = v.data || []; bodegas = b.data || []; productos = p.data || [];
      [contables, centros] = await Promise.all([ctx.cuentasContables(), centrosLocalidad()]);
    }
    async function centrosLocalidad() {
      if (!ctx.sel.loc) return [];
      const { data: k } = await sb.from('catalogos_centros').select('id').eq('localidad_id', ctx.sel.loc).eq('activo', true).order('version', { ascending: false }).limit(1);
      if (!k?.[0]) return [];
      const { data } = await sb.from('centros_costo').select('id, codigo, nombre, centro_mayor_id, vigente').eq('catalogo_id', k[0].id).order('codigo');
      const padres = new Set((data || []).map((x) => x.centro_mayor_id).filter(Boolean));
      return (data || []).map((x) => ({ ...x, movimiento: !padres.has(x.id) && x.vigente }));
    }

    // Certificación en línea con COFIDI (Edge Function «fel-cofidi»).
    async function certificar() {
      const n = actual; if (!n || n.estado !== 'EMITIDA') return;
      if (!confirm(`¿Certificar con COFIDI la nota ${n.numero} por ${fmt.monto(n.valor)}?`)) return;
      window.FIN.aviso('Enviando la nota a COFIDI…');
      try {
        const r = await window.FEL_COFIDI.enviar(sb, { origen: 'NOTA', id: n.id, proceso: 'CERTIFICAR' });
        if (!r?.ok) throw new Error(r?.mensaje || r?.error || 'COFIDI no certificó la nota.');
        const { data } = await sb.from('notas_venta').select('*').eq('id', n.id).single();
        await abrir(data);
        window.FIN.aviso(`Nota certificada · Serie ${r.serie || ''} · DTE ${r.numero_dte || ''}`);
      } catch (e) { alert(`No se certificó la nota: ${e.message}`); }
    }

    async function abrir(n) {
      if (n && n.localidad_id !== locCargada) { ctx.sel.loc = n.localidad_id; ctx.sel.org = n.organizacion_id; pintarFiltros(); await cargarLocalidad(); }
      actual = n; modificando = false; lineaSel = 0; lineas = []; conta = []; factura = null;
      if (n) {
        const [l, c, f] = await Promise.all([
          sb.from('nota_venta_lineas').select('*').eq('nota_id', n.id).order('linea'),
          sb.from('nota_venta_contable').select('*, cuentas(codigo, nombre)').eq('nota_id', n.id).order('linea'),
          n.factura_id ? sb.from('facturas_venta').select('*').eq('id', n.factura_id).maybeSingle() : Promise.resolve({ data: null })
        ]);
        lineas = (l.data || []).map((x) => ({ ...x, cantidad: Number(x.cantidad), precio: Number(x.precio), fecha_vencimiento: x.fecha_vencimiento || '', fecha_fabricacion: x.fecha_fabricacion || '' }));
        conta = (c.data || []).map((x) => ({ cuenta_id: x.cuenta_id, codigo: x.cuentas?.codigo || '', nombre: x.cuentas?.nombre || '', centro_id: x.centro_id, concepto: x.concepto || '', debe: Number(x.debe), haber: Number(x.haber), debe_mi: x.debe_mi == null ? null : Number(x.debe_mi), haber_mi: x.haber_mi == null ? null : Number(x.haber_mi) }));
        factura = f.data || null;
        if (pestana === 'LISTADO') await cargarListado();
      } else { lineas = [nuevaLinea()]; if (pestana === 'LISTADO') pestana = 'DETALLE'; }
      pintar();
    }

    const valoresNuevos = () => {
      const q = ctx.monedas.find((x) => x.iso === 'GTQ');
      return { tipo: cfg.tipo, tipo_documento: cfg.doc, autorizacion: '', serie: '', numero_dte: '', fecha_emision: new Date().toISOString(), fecha_certificacion: null, estado: 'EMITIDA',
        moneda_id: q?.id || null, tipo_cambio: 1, cliente_id: null, cliente_codigo: '', nombre: '', nit: '', nit_externo: '', contacto: '', telefono: '', correo: '', direccion: '', direccion_envio: '',
        vendedor_id: null, bodega_id: null, factura_id: null, clasificacion: 'BIENES', exento_iva: false, tipo_ajuste: cfg.ajuste, asignar_saldo: false, motivo: '' };
    };
    const opt = (l, id, txt = (x) => `${x.codigo} · ${esc(x.nombre)}`) => `<option value="">—</option>${l.filter((x) => x.activo !== false && (!x.estado || x.estado === 'ACTIVO' || x.estado === 'A') || x.id === id).map((x) => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${txt(x)}</option>`).join('')}`;
    const fechaLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); const p = (k) => String(k).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
    function miConta(x, lado, tc) { const q = Number(x[lado] || 0); if (!q) return 0; const mi = x[lado + '_mi']; return mi != null && !x.editada ? Number(mi) : fmt.redondear(q / (tc || 1)); }

    function pintar(v0) {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', cfg.icono); return; }
      const n = actual;
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const v = v0 || (n ? { ...n } : valoresNuevos());
      const tc = Number(v.tipo_cambio || 1) || 1;
      const total = fmt.redondear(lineas.reduce((t, l) => t + Number(l.cantidad || 0) * Number(l.precio || 0), 0));
      const [cls, txt] = marcaDe(n);
      const puede = ctx.admin && n && n.estado !== 'ANULADA' && !modificando;
      const l = lineas[lineaSel] || null;
      const fac = factura;
      const bFac = fac ? bodegas.find((x) => x.id === fac.bodega_id) : null;
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form bm-form vf-form vn-form" novalidate>
          <header class="tk-titulo bm-titulo">
            <div class="tk-titulo-texto"><small>${esc(cfg.titulo)} · ${esc(ctx.localidad(n?.localidad_id || ctx.sel.loc)?.codigo || '')} ${esc(ctx.localidad(n?.localidad_id || ctx.sel.loc)?.nombre_comercial || '')}</small><h2>${n ? `${esc(cfg.nombre)} ${esc(nombreNota(n))}` : `Nueva ${esc(cfg.nombre.toLowerCase())}`}</h2></div>
            <div class="tk-marcas"><span class="pc-marca ${cls}">${txt}</span>${modificando ? ' <span class="pc-marca pendiente"><i class="ti ti-pencil" aria-hidden="true"></i> Modificando</span>' : ''}</div>
            <div class="tk-titulo-acciones">
              <button type="button" class="boton secundario-sm bca-pdf" data-accion="pdf" ${n ? '' : 'disabled'}><i class="ti ti-file-type-pdf" aria-hidden="true"></i> Imprimir en PDF</button>
              ${ctx.admin && !modificando ? `<button type="button" class="boton ${ed ? 'secundario-sm' : 'primario-sm'}" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva</button>` : ''}
              ${puede && n.estado === 'EMITIDA' ? '<button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}
              ${modificando ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}
              ${ed ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${n ? 'Guardar cambios' : 'Registrar'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          ${n?.estado === 'ANULADA' ? `<p class="tk-aviso bm-anulado"><i class="ti ti-ban" aria-hidden="true"></i> Anulada${n.anulada_por ? ` por ${esc(n.anulada_por)}` : ''}${n.anulada_en ? ` el ${esc(fmt.fechaHora(n.anulada_en))}` : ''}${n.motivo_anulacion ? `: ${esc(n.motivo_anulacion)}` : ''}</p>` : ''}
          <div class="vfa">
            <div class="vfa-arriba">
              <section class="bm-bloque dpb-banda vf vn-cli">
                <h3 class="ta-col-titulo"><i class="ti ti-user" aria-hidden="true"></i> Cliente</h3>
                <div class="vn-g vn-g1">
                  <label class="campo"><span>Tipo de documento</span><input name="tipo_documento" value="${esc(v.tipo_documento || '')}" maxlength="80" ${dis}></label>
                  <label class="campo"><span>NIT o CUI</span><input name="nit" value="${esc(v.nit || '')}" maxlength="25" ${dis}></label>
                  <label class="campo"><span>NIT externo</span><input name="nit_externo" value="${esc(v.nit_externo || '')}" maxlength="40" ${dis}></label>
                  <label class="campo"><span>Código</span><input list="vn-clientes" name="cliente_codigo" value="${esc(String(v.cliente_codigo ?? ''))}" placeholder="Código" ${dis}></label>
                  <label class="campo vn-c2"><span>Cliente *</span><input name="nombre" value="${esc(v.nombre || '')}" maxlength="150" ${dis}></label>
                </div>
                <div class="vn-g vn-g2">
                  <label class="campo"><span>Contacto</span><input name="contacto" value="${esc(v.contacto || '')}" maxlength="100" ${dis}></label>
                  <label class="campo"><span>Teléfono</span><input name="telefono" value="${esc(v.telefono || '')}" maxlength="40" ${dis}></label>
                  <label class="campo"><span>Correo electrónico</span><input name="correo" value="${esc(v.correo || '')}" maxlength="120" ${dis}></label>
                  <label class="campo"><span>Vendedor</span><select name="vendedor_id" ${dis}>${opt(vendedores, v.vendedor_id)}</select></label>
                  <label class="campo"><span>Bodega destino</span><select name="bodega_id" ${dis}>${opt(bodegas, v.bodega_id)}</select></label>
                </div>
                <div class="vn-g vn-g3">
                  <label class="campo"><span>Dirección</span><input name="direccion" value="${esc(v.direccion || '')}" maxlength="300" ${dis}></label>
                  <label class="campo"><span>Dirección de envío</span><input name="direccion_envio" value="${esc(v.direccion_envio || '')}" maxlength="300" ${dis}></label>
                </div>
                <datalist id="vn-clientes">${clientes.map((c) => `<option ${c.estado === 'INACTIVO' ? 'label="Inactivo" ' : ''}value="${esc(c.nombre)}${c.tipo_documento !== 'CF' && c.documento ? ` · NIT ${esc(c.documento)}` : ''} — ${c.codigo}"></option>`).join('')}</datalist>
              </section>
              <section class="vfb-card vfb-resumen vfa-resumen vn-resumen">
                <div class="vfb-total"><span>Valor</span><b data-calc="total">${esc(sim(v.moneda_id))} ${fmt.monto(total)}</b></div>
                <div><span>Valor MI</span><b data-calc="mi">${fmt.monto(total / tc)}</b></div>
                <div><span>Tipo</span><b>${esc(cfg.nombre)}</b></div>
                <label class="campo"><span>Moneda</span><select name="moneda_id" ${dis}>${ctx.monedas.map((x) => `<option value="${x.id}" ${x.id === v.moneda_id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>
                <label class="campo"><span>Valor cambio</span><input type="number" step="0.00001" min="0" name="tipo_cambio" value="${esc(String(v.tipo_cambio ?? 1))}" ${dis}></label>
              </section>
            </div>
            <div class="vfa-cards vf vn-cards">
              <section class="vfb-card">
                <h3 class="ta-col-titulo"><i class="ti ti-certificate" aria-hidden="true"></i> Documento FEL</h3>
                <div class="vfb-g">
                  <label class="campo vfb-c2"><span>Número de autorización</span><input name="autorizacion" value="${esc(v.autorizacion || '')}" maxlength="60" placeholder="Lo asigna COFIDI al certificar" ${dis}></label>
                  <label class="campo"><span>Serie</span><input name="serie" value="${esc(v.serie || '')}" maxlength="20" ${dis}></label>
                  <label class="campo"><span>Número DTE</span><input name="numero_dte" value="${esc(v.numero_dte || '')}" maxlength="20" ${dis}></label>
                  <label class="campo vfb-c2"><span>Fecha y hora de emisión</span><input type="datetime-local" name="fecha_emision" value="${esc(fechaLocal(v.fecha_emision))}" ${dis}></label>
                  <label class="campo vfb-c2"><span>Fecha y hora de certificación</span><input type="datetime-local" name="fecha_certificacion" value="${esc(fechaLocal(v.fecha_certificacion))}" ${dis}></label>
                  <label class="campo vfb-c2"><span>Estado</span><input value="${esc(txt)}" disabled></label>
                </div>
              </section>
              <section class="vfb-card vn-ref">
                <h3 class="ta-col-titulo"><i class="ti ti-file-invoice" aria-hidden="true"></i> Factura de referencia (SAT)${fac ? ` <a class="vf-p-link" href="#/facturacion/facturas-ventas/${fac.id}" title="Abrir la factura en Facturas Ventas">${esc(nombreFac(fac))}</a>` : ''}</h3>
                <div class="vfb-g">
                  <label class="campo"><span>No. interno</span><input name="factura_numero" inputmode="numeric" value="${esc(fac ? String(fac.numero) : '')}" placeholder="Número" ${dis}></label>
                  <label class="campo vfb-c2"><span>Número de autorización</span><input value="${esc(fac?.autorizacion || '')}" disabled></label>
                  <label class="campo"><span>Serie electrónica</span><input value="${esc(fac?.serie || '')}" disabled></label>
                  <label class="campo"><span>Número DTE</span><input value="${esc(fac?.numero_dte || '')}" disabled></label>
                  <label class="campo"><span>Emisión</span><input value="${esc(fac ? fmt.fechaHora(fac.fecha_emision) : '')}" disabled></label>
                  <label class="campo"><span>Certificación</span><input value="${esc(fac?.fecha_certificacion ? fmt.fechaHora(fac.fecha_certificacion) : '')}" disabled></label>
                  <label class="campo"><span>Saldo factura</span><input class="vn-saldo" value="${fac ? fmt.monto(fac.saldo) : ''}" disabled></label>
                  <label class="campo"><span>Clasificación</span><select name="clasificacion" ${dis}>${CLASIFICACIONES.map((x) => `<option ${v.clasificacion === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
                  <label class="campo"><span>Tipo de ajuste</span><select name="tipo_ajuste" ${dis}>${AJUSTES.map((x) => `<option ${v.tipo_ajuste === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
                  <label class="campo"><span>Bodega factura</span><input value="${esc(bFac ? `${bFac.codigo} · ${bFac.nombre}` : '')}" disabled></label>
                  <label class="pc-check vf-chk"><input type="checkbox" name="exento_iva" ${v.exento_iva ? 'checked' : ''} ${dis}> Exento de IVA</label>
                  <label class="pc-check vf-chk vfb-c2"><input type="checkbox" name="asignar_saldo" ${v.asignar_saldo ? 'checked' : ''} ${dis}> ¿Asignar saldo a favor a otro documento?</label>
                  ${ed && cfg.tipo !== 'DÉBITO' ? `<button type="button" class="boton secundario-sm vn-copiar" data-accion="copiar-productos" ${fac ? '' : 'disabled'}><i class="ti ti-copy" aria-hidden="true"></i> Copiar productos</button>` : ''}
                </div>
              </section>
              <section class="vfb-card vn-motivo">
                <h3 class="ta-col-titulo"><i class="ti ti-message-2" aria-hidden="true"></i> Motivo de ajuste</h3>
                <textarea name="motivo" rows="4" maxlength="500" ${dis} placeholder="${cfg.tipo === 'DÉBITO' ? 'Cargo adicional a la factura…' : 'Descuento o devolución de la factura…'}">${esc(v.motivo || '')}</textarea>
              </section>
            </div>
            <section class="bm-pestanas">
              <div class="bm-tabs-barra">
                <div class="rp-pestanas" role="tablist">${PESTANAS.map(([k, t, i]) => `<button type="button" role="tab" data-pestana="${k}" class="${pestana === k ? 'activa' : ''}" aria-selected="${pestana === k}"><i class="ti ${i}" aria-hidden="true"></i> ${t}${k === 'DETALLE' ? ` <b>${lineas.length}</b>` : ''}</button>`).join('')}</div>
                <span class="vf-tab-acc">${ed && pestana === 'DETALLE' ? '<button type="button" class="boton secundario-sm" data-accion="linea"><i class="ti ti-plus" aria-hidden="true"></i> Producto</button>' : ''}${ed && pestana === 'CONTABLE' ? '<button type="button" class="boton secundario-sm" data-accion="conta"><i class="ti ti-plus" aria-hidden="true"></i> Línea contable</button>' : ''}${pestana === 'CONTABLE' ? '<span class="vf-tr-cuadre" data-cuadre></span>' : ''}</span>
              </div>
              <div class="bm-panel" data-panel="DETALLE" ${pestana === 'DETALLE' ? '' : 'hidden'}>
                <div class="vf-detalle">
                  <div class="pc-lineas"><table class="vf-lineas"><thead><tr><th class="pc-n">#</th><th class="vf-c-prod">Producto</th><th>Descripción</th><th class="vf-c-tipo">Bien / servicio</th><th class="num vf-c-num">Cantidad</th><th class="num vf-c-num">Precio Q</th><th class="num vf-c-num">Total Q</th><th class="num vf-c-num">Precio MI</th><th class="num vf-c-num">Total MI</th><th class="vf-c-chk" title="Regresa al inventario de la bodega destino (devolución)">Inv.</th><th class="pq-x"></th></tr></thead>
                    <tbody>${lineas.map((x, i) => filaLinea(x, i, ed, tc)).join('') || '<tr><td colspan="11" class="tk-vacio">Sin productos.</td></tr>'}</tbody>
                    <tfoot><tr><td colspan="4">Totales</td><td class="num" data-calc="cant">${fmt.monto(lineas.reduce((t, x) => t + Number(x.cantidad || 0), 0))}</td><td></td><td class="num" data-calc="tq">${fmt.monto(total)}</td><td></td><td class="num" data-calc="tmi">${fmt.monto(total / tc)}</td><td colspan="2"></td></tr></tfoot></table></div>
                  <aside class="vf-lado vfd-lado" aria-label="Datos de la línea">${ladoLinea(l, dis)}</aside>
                </div>
                <datalist id="vn-productos">${productos.filter((p) => p.estado !== 'INACTIVO').map((p) => `<option value="${esc(p.nombre)} — ${p.codigo}"></option>`).join('')}</datalist>
              </div>
              <div class="bm-panel" data-panel="CONTABLE" ${pestana === 'CONTABLE' ? '' : 'hidden'}>
                <div class="pc-lineas"><table class="vf-conta"><thead><tr><th class="pc-n">#</th><th class="vf-k-cta">Cuenta</th><th>Nombre de la cuenta</th><th class="vf-k-cc">Centro de costo</th><th class="vf-k-con">Nombre del centro de costo</th><th class="num vf-k-m">Débito</th><th class="num vf-k-m">Débito MI</th><th class="num vf-k-m">Crédito</th><th class="num vf-k-m">Crédito MI</th><th class="pq-x"></th></tr></thead>
                  <tbody>${conta.map((x, i) => filaConta(x, i, ed, tc)).join('') || '<tr><td colspan="10" class="tk-vacio">Sin detalle contable.</td></tr>'}</tbody>
                  <tfoot><tr><td colspan="5">Totales</td><td class="num" data-calc="debe">${fmt.monto(conta.reduce((t, x) => t + Number(x.debe || 0), 0))}</td><td class="num">${fmt.monto(conta.reduce((t, x) => t + miConta(x, 'debe', tc), 0))}</td><td class="num" data-calc="haber">${fmt.monto(conta.reduce((t, x) => t + Number(x.haber || 0), 0))}</td><td class="num">${fmt.monto(conta.reduce((t, x) => t + miConta(x, 'haber', tc), 0))}</td><td></td></tr></tfoot></table></div>
                <datalist id="vn-cuentas">${contables.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.nombre)} — ${esc(x.codigo)}"></option>`).join('')}</datalist>
                <datalist id="vn-centros">${centros.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.nombre)} — ${esc(x.codigo)}"></option>`).join('')}</datalist>
              </div>
              <div class="bm-panel vf-listado" data-panel="LISTADO" ${pestana === 'LISTADO' ? '' : 'hidden'}>${pestana === 'LISTADO' ? panelListado() : ''}</div>
              <div class="bm-panel vf-procesos" data-panel="PROCESOS" ${pestana === 'PROCESOS' ? '' : 'hidden'}>${panelProcesos(n, v, puede)}</div>
            </section>
          </div>
        </form>`;
      cuadre();
    }

    function ladoLinea(l, dis) {
      return l ? `<small>Línea ${lineaSel + 1}</small>
        <label class="campo"><span>Unidad de medida</span><input data-lado="unidad_medida" value="${esc(l.unidad_medida || '')}" maxlength="60" ${dis}></label>
        <label class="campo"><span>Lote</span><input data-lado="lote" value="${esc(l.lote || '')}" maxlength="40" ${dis}></label>
        <label class="campo"><span>Registro sanitario</span><input data-lado="registro_sanitario" value="${esc(l.registro_sanitario || '')}" maxlength="60" ${dis}></label>
        <label class="campo"><span>Fecha de vencimiento</span><input type="date" data-lado="fecha_vencimiento" value="${esc(l.fecha_vencimiento || '')}" ${dis}></label>
        <label class="campo"><span>Fecha de fabricación</span><input type="date" data-lado="fecha_fabricacion" value="${esc(l.fecha_fabricacion || '')}" ${dis}></label>` : '<small>Sin línea</small>';
    }
    function filaLinea(x, i, ed, tc) {
      const dis = ed ? '' : 'disabled';
      const tq = Number(x.cantidad || 0) * Number(x.precio || 0);
      return `<tr data-linea="${i}" class="${i === lineaSel ? 'actual' : ''}">
        <td class="pc-n">${i + 1}</td>
        <td><input list="vn-productos" data-l="producto" value="${esc(String(x.producto_codigo ?? ''))}" ${dis}></td>
        <td><input data-l="descripcion" value="${esc(x.descripcion || '')}" maxlength="300" ${dis}></td>
        <td><select data-l="tipo" ${dis}>${['BIEN', 'SERVICIO'].map((y) => `<option ${x.tipo === y ? 'selected' : ''}>${y}</option>`).join('')}</select></td>
        <td class="num"><input type="number" step="any" min="0" data-l="cantidad" value="${esc(String(x.cantidad ?? ''))}" ${dis}></td>
        <td class="num"><input type="number" step="any" min="0" data-l="precio" value="${esc(String(x.precio ?? ''))}" ${dis}></td>
        <td class="num fuerte" data-tq>${fmt.monto(tq)}</td>
        <td class="num tk-tenue">${fmt.monto(Number(x.precio || 0) / tc)}</td>
        <td class="num tk-tenue" data-tmi>${fmt.monto(tq / tc)}</td>
        <td class="vf-c-chk"><input type="checkbox" data-l="inventario" ${x.inventario ? 'checked' : ''} ${dis}></td>
        <td class="pq-x">${ed ? `<button type="button" class="icono-boton" data-quitar-linea="${i}" aria-label="Quitar la línea ${i + 1}"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`;
    }
    function filaConta(x, i, ed, tc) {
      const k = cuenta(x.cuenta_id); const c = centro(x.centro_id);
      const m = (lado) => { const q = Number(x[lado] || 0); return q ? fmt.monto(q) : ''; };
      const mi = (lado) => { const q = miConta(x, lado, tc); return q ? fmt.monto(q) : ''; };
      const num = (lado) => ed ? `<input type="number" step="0.01" min="0" data-c="${lado}" value="${x[lado] || ''}">` : m(lado);
      return `<tr data-conta="${i}"><td class="pc-n">${i + 1}</td>
        <td>${ed ? `<input list="vn-cuentas" data-c="cuenta" value="${esc(k?.codigo || x.codigo || '')}">` : `<span class="vf-k-codigo">${esc(k?.codigo || x.codigo || '')}</span>`}</td>
        <td class="cc-nombre">${esc(k?.nombre || x.nombre || '')}</td>
        <td>${ed ? `<input list="vn-centros" data-c="centro" value="${esc(c?.codigo || '')}">` : `<span class="vf-k-codigo">${esc(c?.codigo || '')}</span>`}</td>
        <td class="cc-nombre">${esc(c?.nombre || '')}</td>
        <td class="num">${num('debe')}</td><td class="num tk-tenue">${mi('debe')}</td>
        <td class="num">${num('haber')}</td><td class="num tk-tenue">${mi('haber')}</td>
        <td class="pq-x">${ed ? `<button type="button" class="icono-boton" data-quitar-conta="${i}" aria-label="Quitar la línea ${i + 1}"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`;
    }
    function cuadre() {
      const d = fmt.redondear(conta.reduce((t, x) => t + Number(x.debe || 0), 0)), h = fmt.redondear(conta.reduce((t, x) => t + Number(x.haber || 0), 0));
      const e = ctx.pDet.querySelector('[data-cuadre]');
      if (e) e.innerHTML = !conta.length ? '' : d === h ? '<span class="pc-cuadre ok"><i class="ti ti-circle-check" aria-hidden="true"></i> Cuadra</span>' : `<span class="pc-cuadre no"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Diferencia ${fmt.monto(Math.abs(d - h))}</span>`;
    }

    // ---------- Listado de notas ----------
    async function cargarListado() {
      const txt = listaTexto.trim();
      let q = sb.from('notas_venta').select('id, numero, serie, numero_dte, estado, fecha_emision, nombre, valor, valor_mi, tipo_ajuste, factura_id, cliente_id').eq('localidad_id', ctx.sel.loc).eq('tipo', cfg.tipo);
      if (actual?.cliente_id && txt === (actual.nombre || '')) q = q.eq('cliente_id', actual.cliente_id);
      else if (txt) q = q.ilike('nombre', `%${txt.replace(/[%_]/g, '')}%`);
      const { data, error } = await q.order('fecha_emision', { ascending: false }).order('numero', { ascending: false }).limit(500);
      listado = error ? [] : (data || []);
    }
    function panelListado() {
      const l = listado || [];
      const vig = l.filter((x) => x.estado !== 'ANULADA');
      return `<div class="vf-lista-barra">
          <label class="campo vf-lista-cliente"><span>Consultar por cliente</span><input name="lista_texto" value="${esc(listaTexto)}" placeholder="Nombre del cliente (vacío: todas)" autocomplete="off"></label>
          <button type="button" class="boton secundario-sm" data-accion="lista-consultar"><i class="ti ti-search" aria-hidden="true"></i> Consultar</button>
          <span class="vf-lista-resumen">${listado ? `<b>${l.length}</b> notas · <b>${fmt.monto(vig.reduce((t, x) => t + Number(x.valor || 0), 0))}</b> vigentes` : ''}</span>
        </div>
        <div class="pc-lineas">${!listado ? '<p class="tk-vacio">Cargando…</p>' : `<table class="vf-lista"><thead><tr><th>#</th><th>Serie</th><th>Número DTE</th><th>Estado</th><th>Fecha y hora de emisión</th><th>Cliente</th><th>Ajuste</th><th class="num">Valor</th><th class="num">Valor MI</th></tr></thead>
          <tbody>${l.map((x) => { const [c, t] = marcaDe(x); return `<tr data-abrir-nota="${x.id}" class="${x.id === actual?.id ? 'actual' : ''}" title="Abrir la nota"><td class="fuerte">NC-${x.numero}</td><td>${esc(x.serie || '')}</td><td>${esc(x.numero_dte || '')}</td><td><span class="pc-marca ${c}">${t}</span></td><td>${esc(fmt.fechaHora(x.fecha_emision))}</td><td>${esc(x.nombre || '')}</td><td>${esc(x.tipo_ajuste || '')}</td><td class="num fuerte">${fmt.monto(x.valor)}</td><td class="num tk-tenue">${fmt.monto(x.valor_mi)}</td></tr>`; }).join('') || `<tr><td colspan="9" class="tk-vacio">No hay ${esc(cfg.titulo.toLowerCase())} con ese criterio.</td></tr>`}</tbody></table>`}</div>`;
    }

    // ---------- Procedimientos ----------
    function panelProcesos(n, v, puede) {
      const dato = (r, val) => `<div class="vf-pr-dato"><span>${r}</span><b>${esc(val || '') || '—'}</b></div>`;
      const nf = !n ? 'disabled title="Registra primero la nota"' : '';
      return `<div class="vf-pr-grid vn-pr-grid">
        <section class="vf-pr-col">
          <h3 class="ta-col-titulo"><i class="ti ti-file-certificate" aria-hidden="true"></i> Nota</h3>
          <button type="button" class="boton secundario-sm" data-accion="certificar" ${n && n.estado === 'EMITIDA' ? '' : 'disabled'}><i class="ti ti-certificate" aria-hidden="true"></i> Certificar nota</button>
          <button type="button" class="boton secundario-sm" data-accion="pdf" ${nf}><i class="ti ti-printer" aria-hidden="true"></i> Imprimir nota</button>
          <a class="boton secundario-sm rp-peligro ${puede ? '' : 'deshabilitado'}" ${puede ? `href="#/facturacion/anulacion-de-documentos-dte/nota-${n.id}"` : 'aria-disabled="true"'}><i class="ti ti-ban" aria-hidden="true"></i> Anular nota</a>
          <button type="button" class="boton secundario-sm" data-accion="validar" ${nf}><i class="ti ti-checklist" aria-hidden="true"></i> Validar nota</button>
        </section>
        <section class="vf-pr-col">
          <h3 class="ta-col-titulo"><i class="ti ti-file-invoice" aria-hidden="true"></i> Factura de referencia</h3>
          ${dato('Factura', factura ? nombreFac(factura) : '')}
          ${dato('Total factura', factura ? fmt.monto(factura.total) : '')}
          ${dato('Notas crédito/abono', factura ? fmt.monto(factura.notas_credito) : '')}
          ${dato('Notas de débito', factura ? fmt.monto(factura.notas_debito) : '')}
          ${dato('Saldo actual', factura ? fmt.monto(factura.saldo) : '')}
        </section>
        <section class="vf-pr-col">
          <h3 class="ta-col-titulo"><i class="ti ti-history" aria-hidden="true"></i> Auditoría</h3>
          <table class="vf-pr-audit"><thead><tr><th></th><th>Usuario</th><th>Fecha</th></tr></thead><tbody>
            ${[['Ingresa', v.usuario, v.creado_en], ['Modifica', v.modificado_por_nombre, v.modificado_en], ['Anula', v.anulada_por, v.anulada_en]].map(([r, u, d]) => `<tr><th>${r}</th><td>${esc(u || '') || '—'}</td><td>${d ? esc(fmt.fechaHora(d)) : '—'}</td></tr>`).join('')}
          </tbody></table>
        </section>
      </div>`;
    }

    // ---------- Formulario ----------
    function encabezado(form) {
      const el = form.elements;
      const t = (k) => el[k] && String(el[k].value).trim() !== '' ? String(el[k].value).trim() : null;
      const id = (k) => el[k] && el[k].value ? Number(el[k].value) : null;
      const c = clientes.find((x) => String(x.codigo) === String(el.cliente_codigo.value).trim());
      const fecha = (k) => el[k]?.value ? new Date(el[k].value).toISOString() : null;
      return { tipo_documento: t('tipo_documento'), autorizacion: t('autorizacion'), serie: t('serie'), numero_dte: t('numero_dte'), fecha_emision: fecha('fecha_emision') || new Date().toISOString(), fecha_certificacion: fecha('fecha_certificacion'),
        moneda_id: id('moneda_id'), tipo_cambio: Number(el.tipo_cambio.value) || 1, cliente_id: c ? c.id : (actual?.cliente_id && String(el.cliente_codigo.value).trim() === String(actual.cliente_codigo ?? '') ? actual.cliente_id : null),
        cliente_codigo: t('cliente_codigo'), nombre: (el.nombre.value || '').trim(), nit: t('nit'), nit_externo: t('nit_externo'), contacto: t('contacto'), telefono: t('telefono'), correo: t('correo'),
        direccion: t('direccion'), direccion_envio: t('direccion_envio'), vendedor_id: id('vendedor_id'), bodega_id: id('bodega_id'), factura_id: factura?.id || null,
        clasificacion: el.clasificacion.value, exento_iva: !!el.exento_iva.checked, tipo_ajuste: el.tipo_ajuste.value, asignar_saldo: !!el.asignar_saldo.checked, motivo: t('motivo') };
    }
    function leerTablas() {
      ctx.pDet.querySelectorAll('tr[data-linea]').forEach((tr) => {
        const x = lineas[Number(tr.dataset.linea)]; if (!x) return;
        const v = (k) => tr.querySelector(`[data-l=${k}]`);
        if (!v('descripcion')) return;
        x.descripcion = v('descripcion').value; x.tipo = v('tipo').value; x.cantidad = Number(v('cantidad').value) || 0; x.precio = Number(v('precio').value) || 0; x.inventario = v('inventario').checked;
      });
      ctx.pDet.querySelectorAll('[data-lado]').forEach((inp) => { const x = lineas[lineaSel]; if (x) x[inp.dataset.lado] = inp.value; });
      ctx.pDet.querySelectorAll('tr[data-conta]').forEach((tr) => {
        const x = conta[Number(tr.dataset.conta)]; if (!x || !tr.querySelector('[data-c=debe]')) return;
        const v = (k) => tr.querySelector(`[data-c=${k}]`).value.trim();
        if (!(x.cuenta_id && v('cuenta') === x.codigo && !cuenta(x.cuenta_id))) { const k = cuentaPorCodigo(v('cuenta')); x.cuenta_id = k ? k.id : null; x.nombre = k?.nombre || ''; x.codigo = v('cuenta'); }
        const c = centros.find((y) => y.codigo === v('centro') && y.movimiento); x.centro_id = c ? c.id : null;
        const d0 = x.debe, h0 = x.haber; x.debe = Number(v('debe')) || 0; x.haber = Number(v('haber')) || 0; if (x.debe !== d0 || x.haber !== h0) x.editada = true;
      });
    }
    function repintar(cambios = {}) {
      // Las tablas ya se leyeron antes de cambiarlas (si se leyeran aquí, la pantalla anterior pisaría los cambios).
      const form = ctx.pDet.querySelector('.vn-form'); if (!form) return;
      pintar({ ...(actual || valoresNuevos()), ...encabezado(form), estado: actual?.estado, ...cambios });
    }
    function totalizar() {
      const form = ctx.pDet.querySelector('.vn-form'); if (!form) return;
      leerTablas();
      const tc = Number(form.elements.tipo_cambio.value || 1) || 1;
      const total = fmt.redondear(lineas.reduce((t, l) => t + Number(l.cantidad || 0) * Number(l.precio || 0), 0));
      form.querySelectorAll('tr[data-linea]').forEach((tr) => { const x = lineas[Number(tr.dataset.linea)]; if (!x) return; const tq = x.cantidad * x.precio; const a = tr.querySelector('[data-tq]'); if (a) a.textContent = fmt.monto(tq); const b = tr.querySelector('[data-tmi]'); if (b) b.textContent = fmt.monto(tq / tc); });
      const set = (k, t) => { const e = form.querySelector(`[data-calc=${k}]`); if (e) e.textContent = t; };
      set('total', `${sim(Number(form.elements.moneda_id.value))} ${fmt.monto(total)}`); set('mi', fmt.monto(total / tc)); set('tq', fmt.monto(total)); set('tmi', fmt.monto(total / tc));
      set('cant', fmt.monto(lineas.reduce((t, x) => t + Number(x.cantidad || 0), 0)));
      set('debe', fmt.monto(conta.reduce((t, x) => t + x.debe, 0))); set('haber', fmt.monto(conta.reduce((t, x) => t + x.haber, 0)));
      cuadre();
    }

    // Factura de referencia: por número interno; trae el cliente, la clasificación, el IVA y la bodega.
    async function usarFactura(idONumero, porNumero = false) {
      const q = sb.from('facturas_venta').select('*').eq(porNumero ? 'numero' : 'id', idONumero);
      const { data } = await (porNumero ? q.eq('localidad_id', ctx.sel.loc) : q).maybeSingle();
      const form = ctx.pDet.querySelector('.vn-form');
      if (!data) { window.FIN.aviso(`No hay una factura ${idONumero} en la empresa`); return; }
      if (data.localidad_id !== locCargada) { ctx.sel.loc = data.localidad_id; ctx.sel.org = data.organizacion_id; pintarFiltros(); await cargarLocalidad(); }
      if (data.estado === 'ANULADA') window.FIN.aviso('La factura está anulada');
      factura = data;
      const base = form ? { ...(actual || valoresNuevos()), ...encabezado(form) } : valoresNuevos();
      const c = cliente(data.cliente_id);
      if (form) leerTablas();
      pintar({ ...base, factura_id: data.id, cliente_id: data.cliente_id, cliente_codigo: data.cliente_codigo ?? c?.codigo ?? '', nombre: data.nombre, nit: data.nit, nit_externo: data.nit_externo, contacto: data.contacto, telefono: data.telefono,
        correo: data.correo, direccion: data.direccion, direccion_envio: data.direccion_envio, vendedor_id: data.vendedor_id, bodega_id: base.bodega_id || data.bodega_id, clasificacion: data.clasificacion, exento_iva: data.exento_iva,
        moneda_id: data.moneda_id, tipo_cambio: data.tipo_cambio || 1,
        motivo: base.motivo || `${cfg.tipo === 'DÉBITO' ? 'Cargo' : base.tipo_ajuste === 'DEVOLUCIÓN' ? 'Devolución de productos según' : 'Descuento en'} la factura con no. interno: ${data.numero}` });
    }
    async function copiarProductos() {
      if (!factura) return;
      const { data } = await sb.from('factura_venta_lineas').select('*').eq('factura_id', factura.id).order('linea');
      if (!data?.length) return window.FIN.aviso('La factura no tiene productos');
      leerTablas();
      const vacias = lineas.every((x) => !x.descripcion);
      const nuevas = data.map((x) => ({ producto_id: x.producto_id, producto_codigo: x.producto_codigo ?? producto(x.producto_id)?.codigo ?? '', descripcion: x.descripcion, tipo: x.tipo, cantidad: Number(x.cantidad), precio: Number(x.precio),
        inventario: x.tipo === 'BIEN', unidad_medida: x.unidad_medida || '', lote: x.lote || '', registro_sanitario: x.registro_sanitario || '', fecha_vencimiento: x.fecha_vencimiento || '', fecha_fabricacion: x.fecha_fabricacion || '' }));
      lineas = vacias ? nuevas : [...lineas, ...nuevas]; lineaSel = 0;
      repintar();
    }

    async function guardar(form) {
      const error = form.querySelector('.tk-error'); error.textContent = '';
      leerTablas();
      const h = encabezado(form);
      const ir = (t) => { pestana = t; repintar(); };
      if (!h.nombre) { error.textContent = 'Escribe el nombre del cliente.'; return; }
      if (!factura) { error.textContent = 'Indica la factura de referencia (su número interno).'; return; }
      const ls = lineas.filter((x) => x.descripcion.trim() || x.cantidad || x.precio);
      if (!ls.length) { ir('DETALLE'); error.textContent = 'Agrega al menos un producto o concepto.'; return; }
      const mala = ls.findIndex((x) => !x.descripcion.trim() || !(x.cantidad > 0));
      if (mala >= 0) { ir('DETALLE'); error.textContent = `Revisa la línea ${mala + 1}: necesita descripción y cantidad mayor que cero.`; return; }
      const total = fmt.redondear(ls.reduce((t, x) => t + x.cantidad * x.precio, 0));
      if (cfg.tipo !== 'DÉBITO' && factura && total > Number(factura.saldo || 0) + Number(actual?.factura_id === factura.id && actual.estado !== 'ANULADA' ? actual.valor : 0) + 0.005 && !h.asignar_saldo) {
        error.textContent = `La nota (${fmt.monto(total)}) es mayor que el saldo de la factura (${fmt.monto(factura.saldo)}). Marca «¿Asignar saldo a favor a otro documento?» si corresponde.`; return;
      }
      const cs = conta.filter((x) => x.codigo || x.debe || x.haber);
      if (cs.some((x) => !x.cuenta_id)) { ir('CONTABLE'); error.textContent = 'Hay líneas del detalle contable sin una cuenta de movimiento válida.'; return; }
      const quien = (ctx.yo.usuario || '').toUpperCase();
      const tc = Number(h.tipo_cambio || 1) || 1;
      try {
        let id = actual?.id;
        if (id) {
          const r = await sb.from('notas_venta').update({ ...h, modificado_por_nombre: quien, modificado_en: new Date().toISOString() }).eq('id', id); if (r.error) throw r.error;
          for (const t of ['nota_venta_lineas', 'nota_venta_contable']) { const d = await sb.from(t).delete().eq('nota_id', id); if (d.error) throw d.error; }
        } else {
          const r = await sb.from('notas_venta').insert({ ...h, tipo: cfg.tipo, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, usuario: quien }).select('id').single(); if (r.error) throw r.error;
          id = r.data.id;
        }
        const r1 = await sb.from('nota_venta_lineas').insert(ls.map((x, i) => ({ nota_id: id, linea: i + 1, producto_id: x.producto_id, producto_codigo: x.producto_codigo ? String(x.producto_codigo) : null, descripcion: x.descripcion, tipo: x.tipo,
          cantidad: x.cantidad, precio: x.precio, inventario: !!x.inventario, unidad_medida: x.unidad_medida || null, lote: x.lote || null, registro_sanitario: x.registro_sanitario || null,
          fecha_vencimiento: x.fecha_vencimiento || null, fecha_fabricacion: x.fecha_fabricacion || null })));
        if (r1.error) throw r1.error;
        if (cs.length) { const r2 = await sb.from('nota_venta_contable').insert(cs.map((x, i) => ({ nota_id: id, linea: i + 1, cuenta_id: x.cuenta_id, centro_id: x.centro_id, concepto: x.concepto || null, debe: x.debe, haber: x.haber, debe_mi: miConta(x, 'debe', tc), haber_mi: miConta(x, 'haber', tc) }))); if (r2.error) throw r2.error; }
        window.FIN.aviso(actual ? 'Nota guardada' : 'Nota registrada');
        const { data } = await sb.from('notas_venta').select('*').eq('id', id).single();
        listado = null;
        await abrir(data);
      } catch (err) {
        error.textContent = /notas_venta|nota_venta/.test(err.message || '') && /does not exist|schema cache/.test(err.message || '') ? 'Falta instalar el script 134 (notas electrónicas) en Supabase.' : window.UI.traducirError(err);
      }
    }

    function validar() {
      const n = actual; if (!n) return;
      const obs = [];
      if (!n.cliente_id) obs.push('el cliente no está en el catálogo');
      if (!n.nit) obs.push('no tiene NIT');
      if (!factura) obs.push('no tiene factura de referencia');
      else if (factura.estado === 'ANULADA') obs.push('la factura de referencia está anulada');
      if (!lineas.length) obs.push('no tiene productos');
      const d = fmt.redondear(conta.reduce((t, x) => t + Number(x.debe || 0), 0)), h = fmt.redondear(conta.reduce((t, x) => t + Number(x.haber || 0), 0));
      if (!conta.length) obs.push('no tiene detalle contable'); else if (d !== h) obs.push(`el detalle contable no cuadra (diferencia ${fmt.monto(Math.abs(d - h))})`);
      if (!n.motivo) obs.push('no tiene motivo de ajuste');
      if (n.tipo_ajuste === 'DEVOLUCIÓN' && !n.bodega_id) obs.push('es una devolución sin bodega destino');
      if (n.estado === 'EMITIDA') obs.push('no está certificada');
      window.FIN.aviso(obs.length ? `Nota con observaciones: ${obs.join('; ')}.` : 'Nota válida: cliente, factura, productos y detalle contable en orden.');
    }
    function pdf() {
      const n = actual; if (!n) return;
      const v = vendedores.find((x) => x.id === n.vendedor_id); const b = bodegas.find((x) => x.id === n.bodega_id);
      imprimir(`${cfg.nombre} ${n.numero}`, `<h1>${esc(cfg.nombre)} ${esc(nombreNota(n))}${n.estado === 'ANULADA' ? ' · ANULADA' : ''}</h1>
        <h2>${esc([`Autorización: ${n.autorizacion || 'sin certificar'}`, `Serie: ${n.serie || '—'}`, `DTE: ${n.numero_dte || '—'}`, `Emisión: ${fmt.fechaHora(n.fecha_emision)}`, `Cliente: ${n.cliente_codigo || ''} · ${n.nombre}`, `NIT: ${n.nit || ''}`, `Vendedor: ${v ? v.nombre : '—'}`, `Factura: ${factura ? nombreFac(factura) : '—'} (interno ${factura?.numero ?? ''})`, `Ajuste: ${n.tipo_ajuste}`, `Bodega destino: ${b ? b.nombre : '—'}`].join(' · '))}</h2>
        ${n.motivo ? `<p><b>Motivo:</b> ${esc(n.motivo)}</p>` : ''}
        <table><thead><tr><th>#</th><th>Producto</th><th>Descripción</th><th>Lote</th><th>Vence</th><th class="n">Cantidad</th><th class="n">Precio</th><th class="n">Total</th></tr></thead><tbody>
        ${lineas.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(String(x.producto_codigo ?? ''))}</td><td>${esc(x.descripcion)}</td><td>${esc(x.lote || '')}</td><td>${esc(x.fecha_vencimiento ? fmt.fechaDia(x.fecha_vencimiento) : '')}</td><td class="n">${fmt.monto(x.cantidad)}</td><td class="n">${fmt.monto(x.precio)}</td><td class="n">${fmt.monto(x.cantidad * x.precio)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="7">Valor (${esc(sim(n.moneda_id))}) · valor MI ${fmt.monto(n.valor_mi)}</td><td class="n">${fmt.monto(n.valor)}</td></tr></tfoot></table>
        <div class="firmas"><div>Elaboró: ${esc(n.usuario || '')}</div><div>Recibí conforme</div></div>`, { locId: n.localidad_id, orgId: n.organizacion_id });
    }
    async function irNota(k) {
      if (!/^\d+$/.test(String(k).trim())) return;
      const { data } = await sb.from('notas_venta').select('*').eq('localidad_id', ctx.sel.loc).eq('numero', Number(k)).maybeSingle();
      if (!data) return window.FIN.aviso(`No hay una nota NC-${k} en la empresa`);
      if (data.tipo !== cfg.tipo) { const destino = Object.entries(TIPOS).find(([, c]) => c.tipo === data.tipo)?.[0]; if (destino) { location.hash = `#/facturacion/${destino}/${data.id}`; return; } }
      abrir(data);
    }

    // Listas de valores: cada opción es «descripción — código» (se busca por cualquiera de los dos); al elegirla el campo queda con el código.
    cont.addEventListener('change', (e) => { const i = e.target; if (i && i.matches && i.matches('input[list]')) { const k = i.value.lastIndexOf(' — '); if (k >= 0) i.value = i.value.slice(k + 3).trim(); } }, true);
    // ---------- Eventos ----------
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { await cargarLocalidad(); listado = null; return abrir(null); }
      if (e.target.name === 'ir_nota') return irNota(e.target.value);
      const form = e.target.closest('.vn-form'); if (!form) return;
      leerTablas();
      const k = e.target.name;
      if (k === 'factura_numero') { if (e.target.value.trim()) return usarFactura(Number(e.target.value), true); factura = null; return repintar({ factura_id: null }); }
      if (k === 'cliente_codigo') {
        const c = clientes.find((x) => String(x.codigo) === e.target.value.trim());
        if (c) return repintar({ cliente_id: c.id, cliente_codigo: c.codigo, nombre: c.nombre, nit: c.tipo_documento === 'CF' ? 'CF' : c.documento, contacto: c.contacto || '', telefono: c.telefono || '', correo: c.correo || '', direccion: c.direccion || '', vendedor_id: c.vendedor_id || null });
      }
      if (k === 'moneda_id') { const mo = ctx.moneda(Number(e.target.value)); return repintar({ tipo_cambio: mo?.cambio || 1 }); }
      const prod = e.target.closest('[data-l=producto]');
      if (prod) {
        const x = lineas[Number(prod.closest('tr').dataset.linea)]; const p = porCodigoProd(prod.value);
        if (p) { x.producto_id = p.id; x.producto_codigo = p.codigo; x.descripcion = x.descripcion || p.nombre; x.lote = x.lote || p.lote || ''; } else { x.producto_id = null; x.producto_codigo = prod.value.trim(); }
        return repintar();
      }
      if (e.target.closest('[data-c=cuenta], [data-c=centro]')) { leerTablas(); return repintar(); }
      if (k === 'tipo_ajuste' || k === 'tipo_cambio') return repintar();
      totalizar();
    });
    cont.addEventListener('input', (e) => {
      if (!e.target.closest('.vn-form')) return;
      const tr = e.target.closest('tr[data-conta]');
      if (tr && e.target.dataset.c === 'debe' && e.target.value) tr.querySelector('[data-c=haber]').value = '';
      if (tr && e.target.dataset.c === 'haber' && e.target.value) tr.querySelector('[data-c=debe]').value = '';
      if (e.target.closest('tr[data-linea], tr[data-conta]')) totalizar();
    });
    cont.addEventListener('focusin', (e) => {
      const tr = e.target.closest('tr[data-linea]');
      if (!tr || Number(tr.dataset.linea) === lineaSel) return;
      leerTablas();
      lineaSel = Number(tr.dataset.linea);
      ctx.pDet.querySelectorAll('tr[data-linea]').forEach((x) => x.classList.toggle('actual', x === tr));
      const lado = ctx.pDet.querySelector('.vfd-lado');
      if (lado) lado.innerHTML = ladoLinea(lineas[lineaSel], editable() ? '' : 'disabled');
    });
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.name === 'ir_nota') { e.preventDefault(); irNota(e.target.value); }
      if (e.key === 'Enter' && e.target.name === 'factura_numero') { e.preventDefault(); e.target.blur(); }
    });
    cont.addEventListener('click', async (e) => {
      const tab = e.target.closest('[data-pestana]');
      if (tab) {
        const form = ctx.pDet.querySelector('.vn-form'); if (!form) return;
        leerTablas(); pestana = tab.dataset.pestana;
        editable() ? repintar() : pintar();
        if (pestana === 'LISTADO' && !listado) { if (!listaTexto && actual) listaTexto = actual.nombre || ''; await cargarListado(); if (pestana === 'LISTADO') editable() ? repintar() : pintar(); }
        return;
      }
      const ab = e.target.closest('[data-abrir-nota]');
      if (ab) { if (Number(ab.dataset.abrirNota) === actual?.id) return; const { data } = await sb.from('notas_venta').select('*').eq('id', Number(ab.dataset.abrirNota)).single(); return data ? abrir(data) : null; }
      const ql = e.target.closest('[data-quitar-linea]'); if (ql) { leerTablas(); lineas.splice(Number(ql.dataset.quitarLinea), 1); if (!lineas.length) lineas.push(nuevaLinea()); lineaSel = 0; return repintar(); }
      const qc = e.target.closest('[data-quitar-conta]'); if (qc) { leerTablas(); conta.splice(Number(qc.dataset.quitarConta), 1); return repintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (!a) return;
      if (a === 'nueva') { pestana = 'DETALLE'; return abrir(null); }
      if (a === 'modificar') { modificando = true; return pintar(); }
      if (a === 'cancelar') return abrir(actual);
      if (a === 'linea') { leerTablas(); lineas.push(nuevaLinea()); lineaSel = lineas.length - 1; return repintar(); }
      if (a === 'conta') { leerTablas(); conta.push({ cuenta_id: null, centro_id: null, concepto: '', debe: 0, haber: 0 }); return repintar(); }
      if (a === 'copiar-productos') return copiarProductos();
      if (a === 'validar') return validar();
      if (a === 'pdf') return pdf();
      if (a === 'certificar') return certificar();
      if (a === 'lista-consultar') { listaTexto = ctx.pDet.querySelector('[name=lista_texto]')?.value || ''; listado = null; pintar(); await cargarListado(); return pintar(); }
    });
    cont.addEventListener('submit', (e) => {
      if (!e.target.matches('.vn-form')) return;
      e.preventDefault();
      if (document.activeElement?.name === 'lista_texto') return ctx.pDet.querySelector('[data-accion=lista-consultar]')?.click();
      if (document.activeElement?.name === 'factura_numero') return;
      if (editable()) guardar(e.target);
    });

    iniciar();
  }
})();
