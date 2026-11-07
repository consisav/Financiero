// Facturación/Ventas · Registros · Facturas Ventas: ingreso de la factura con el diseño en bandas del sistema.
//   Franja de control (interno, tipo, emisión, certificación, usuario); banda del documento electrónico FEL con el valor,
//   el valor en la moneda de integración y el saldo; banda del cliente; venta y crédito; impuestos y cobro; y pestañas:
//   Detalle factura (productos con su lote, registro sanitario y fechas), Detalle contable, Detalle inventario, Pagos y
//   Procedimientos (certificación FEL con COFIDI, anulación e impresión). Totales, IVA, saldo y la salida del inventario
//   los calcula el servidor (script 130). Las facturas registradas se buscan en «Consulta de Facturas».
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const TIPOS_FACTURA = ['FACTURA NORMAL', 'FACTURA CAMBIARIA', 'FACTURA ESPECIAL', 'FACTURA DE EXPORTACIÓN', 'FACTURA PEQUEÑO CONTRIBUYENTE'];
  const TIPOS_DTE = [['FACT', 'Factura'], ['FCAM', 'Factura cambiaria'], ['FESP', 'Factura especial'], ['FPEQ', 'Pequeño contribuyente'], ['FEXP', 'Exportación']];
  const DTE_DE = { 'FACTURA NORMAL': 'FACT', 'FACTURA CAMBIARIA': 'FCAM', 'FACTURA ESPECIAL': 'FESP', 'FACTURA DE EXPORTACIÓN': 'FEXP', 'FACTURA PEQUEÑO CONTRIBUYENTE': 'FPEQ' };
  const ENTREGAS = ['OFICINA', 'RUTA', 'MENSAJERÍA', 'GUATEX', 'CARGO EXPRESO', 'OTRO'];
  const CLASIFICACIONES = ['BIENES', 'SERVICIOS', 'BIENES Y SERVICIOS'];
  const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
  const FORMAS_PAGO = ['EFECTIVO', 'CHEQUE', 'DEPÓSITO', 'TRANSFERENCIA', 'TARJETA', 'NOTA DE CRÉDITO'];
  const PESTANAS = [['DETALLE', 'Detalle factura', 'ti-list-details'], ['CONTABLE', 'Detalle contable', 'ti-notebook'], ['INVENTARIO', 'Detalle inventario', 'ti-packages'], ['PAGOS', 'Pagos', 'ti-cash'], ['PROCESOS', 'Procedimientos', 'ti-settings-automation']];

  window.PANTALLAS['facturas-ventas'] = function (cont, m, extra) {
    const ctx = montar(cont, { titulo: 'Facturas Ventas', icono: 'ti-file-invoice', clase: 'bk-movimientos bm-solo vf-facturas', grupo: 'Ventas · Registros' });
    const { sb } = ctx;
    let clientes = [], vendedores = [], precios = [], bodegas = [], productos = [], preciosProd = [], contables = [], centros = [];
    let actual = null, modificando = false, pestana = 'DETALLE', lineaSel = 0;
    let lineas = [], conta = [], pagos = [], inventario = [];

    const cliente = (id) => clientes.find((c) => c.id === id);
    const producto = (id) => productos.find((p) => p.id === id);
    const porCodigoProd = (cod) => productos.find((p) => String(p.codigo) === String(cod).trim());
    const cuentaPorCodigo = (cod) => contables.find((c) => c.codigo === String(cod || '').trim() && c.movimiento);
    const cuenta = (id) => contables.find((c) => c.id === id);
    const centro = (id) => centros.find((c) => c.id === id);
    const certificada = () => !!actual?.autorizacion;
    const editable = () => ctx.admin && (!actual || (modificando && actual.estado === 'FACTURADA' && !certificada()));
    const sim = (id) => ctx.moneda(id)?.simbolo || 'Q';
    const precioDe = (productoId, tipoPrecioId) => Number(preciosProd.find((x) => x.producto_id === productoId && x.tipo_precio_id === tipoPrecioId)?.precio || 0);
    const nuevaLinea = () => ({ producto_id: null, producto_codigo: null, descripcion: '', tipo: 'BIEN', cantidad: 1, precio: 0, inventario: true, cpa: false, fecha_compromiso: '', unidad_medida: '', lote: '', registro_sanitario: '', fecha_vencimiento: '', fecha_fabricacion: '' });

    function pintarFiltros() {
      ctx.filtros('', '');
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('facturas_venta').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/facturas_venta/.test(prueba.error.message) ? 'Falta instalar el script 130 (facturas de venta) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      pintarFiltros();
      await cargarLocalidad();
      if (extra && /^\d+$/.test(String(extra))) {
        const { data } = await sb.from('facturas_venta').select('*').eq('id', Number(extra)).maybeSingle();
        if (data) { if (data.localidad_id !== ctx.sel.loc) { ctx.sel.loc = data.localidad_id; ctx.sel.org = data.organizacion_id; pintarFiltros(); await cargarLocalidad(); } return abrir(data); }
      }
      abrir(null);
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc || 0;
      const [c, v, p, b, pr, pp] = await Promise.all([
        sb.from('clientes').select('*').eq('localidad_id', loc).order('nombre'),
        sb.from('vendedores').select('id, codigo, nombre, activo').eq('localidad_id', loc).order('codigo'),
        sb.from('tipos_precio').select('id, codigo, nombre, activo').eq('localidad_id', loc).order('codigo'),
        sb.from('bodegas').select('id, codigo, nombre, estado').eq('localidad_id', loc).order('codigo'),
        sb.from('productos').select('id, codigo, nombre, estado, tipo_medida_id, lote, precio_costo').eq('localidad_id', loc).order('codigo'),
        sb.from('producto_precios').select('producto_id, tipo_precio_id, precio').eq('localidad_id', loc)
      ]);
      clientes = c.data || []; vendedores = v.data || []; precios = p.data || []; bodegas = b.data || []; productos = pr.data || []; preciosProd = pp.data || [];
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

    async function abrir(f) {
      actual = f; modificando = false; lineaSel = 0;
      lineas = []; conta = []; pagos = []; inventario = [];
      if (f) {
        const [l, c, p] = await Promise.all([
          sb.from('factura_venta_lineas').select('*').eq('factura_id', f.id).order('linea'),
          sb.from('factura_venta_contable').select('*, cuentas(codigo, nombre)').eq('factura_id', f.id).order('linea'),
          sb.from('factura_venta_pagos').select('*').eq('factura_id', f.id).order('fecha')
        ]);
        lineas = (l.data || []).map((x) => ({ ...x, fecha_compromiso: x.fecha_compromiso || '', fecha_vencimiento: x.fecha_vencimiento || '', fecha_fabricacion: x.fecha_fabricacion || '' }));
        // La cuenta puede ser de otro catálogo (p. ej. la versión 1 de las facturas migradas): su código y nombre vienen con la línea.
        conta = (c.data || []).map((x) => ({ cuenta_id: x.cuenta_id, codigo: x.cuentas?.codigo || '', nombre: x.cuentas?.nombre || '', centro_id: x.centro_id, concepto: x.concepto || '', debe: Number(x.debe), haber: Number(x.haber) }));
        pagos = (p.data || []).map((x) => ({ fecha: x.fecha, forma: x.forma, documento: x.documento || '', banco: x.banco || '', valor: Number(x.valor) }));
        const ids = lineas.map((x) => x.id);
        if (ids.length) { const { data } = await sb.from('inventario_movimientos').select('fecha, cantidad, costo_unitario, lote, fecha_vencimiento, bodega_id, producto_id, factura_linea_id').in('factura_linea_id', ids); inventario = data || []; }
      } else lineas = [nuevaLinea()];
      pintar();
    }

    const valoresNuevos = () => {
      const gtq = ctx.monedaBase();
      return { tipo_factura: 'FACTURA NORMAL', tipo_dte: 'FACT', tipo_documento: '', serie: '', numero_dte: '', autorizacion: '', fecha_emision: new Date().toISOString(), moneda_id: gtq?.id, tipo_cambio: 7.7,
        cliente_id: null, cliente_codigo: '', nombre: '', nit: '', consumidor_final: false, nit_externo: '', contacto: '', telefono: '', correo: '', direccion: '', direccion_envio: '', lab_fab: '', generico: false,
        vendedor_id: null, tipo_precio_id: null, bodega_id: null, forma_pago: 'CONTADO', dias_credito: 0, contrasena: '', fecha_cobro: '', modo_entrega: 'OFICINA', unificar_productos: false,
        exento_iva: false, agente_retenedor: false, pct_retencion_iva: 0, retencion_isr: false, monto_retencion_isr: 0, clasificacion: 'BIENES', cuenta_por_cobrar: 'C X C', incoterm: '', observaciones: '' };
    };
    const opt = (l, id, txt = (x) => `${x.codigo} · ${esc(x.nombre)}`) => `<option value="">—</option>${l.filter((x) => (x.activo !== false && (x.estado === undefined || x.estado === 'ACTIVO' || x.estado === 'A')) || x.id === id).map((x) => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${txt(x)}</option>`).join('')}`;
    const fechaLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
    const sumar = (dias, desde) => { const d = desde ? new Date(desde) : new Date(); d.setDate(d.getDate() + Number(dias || 0)); return d.toISOString().slice(0, 10); };

    function pintar(v0) {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-file-invoice'); return; }
      const f = actual;
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const v = v0 || (f ? { ...f } : valoresNuevos());
      const total = fmt.redondear(lineas.reduce((t, l) => t + Number(l.cantidad || 0) * Number(l.precio || 0), 0));
      const tc = Number(v.tipo_cambio || 1) || 1;
      const pagado = fmt.redondear(pagos.reduce((t, p) => t + Number(p.valor || 0), 0));
      const iva = v.exento_iva ? 0 : fmt.redondear(total * 12 / 112);
      const retIva = v.agente_retenedor ? fmt.redondear(iva * Number(v.pct_retencion_iva || 0) / 100) : 0;
      const saldo = v.estado === 'ANULADA' ? 0 : Math.max(0, fmt.redondear(total - retIva - Number(v.monto_retencion_isr || 0) - pagado));
      const marca = !f ? '<span class="pc-marca pendiente">Sin registrar</span>' : f.estado === 'ANULADA' ? '<span class="pc-marca anulada">Anulada</span>' : `<span class="pc-marca aprobada">Facturada</span>${certificada() ? ' <span class="pc-marca definitiva">Certificada</span>' : ''}`;
      const puede = ctx.admin && f && f.estado === 'FACTURADA' && !modificando;
      const l = lineas[lineaSel] || null;
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form bm-form vf-form" novalidate>
          <header class="tk-titulo bm-titulo">
            <div class="tk-titulo-texto"><small>Facturas Ventas · ${esc(ctx.localidad(ctx.sel.loc)?.codigo || '')} ${esc(ctx.localidad(ctx.sel.loc)?.nombre_comercial || '')}</small><h2>${f ? `Factura ${esc(f.serie ? `${f.serie}-${f.numero_dte || f.numero}` : `interna ${f.numero}`)}` : 'Nueva factura'}</h2></div>
            <div class="tk-marcas">${marca}${modificando ? '<span class="pc-marca pendiente"><i class="ti ti-pencil" aria-hidden="true"></i> Modificando</span>' : ''}</div>
            <div class="tk-titulo-acciones">
              <a class="boton secundario-sm" href="#/facturacion/consulta-de-facturas"><i class="ti ti-file-search" aria-hidden="true"></i> Consulta</a>
              <button type="button" class="boton secundario-sm bca-pdf" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> Imprimir en PDF</button>
              <button type="button" class="boton cqc-excel" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Generar Excel</button>
              ${ctx.admin && !modificando ? `<button type="button" class="boton ${ed ? 'secundario-sm' : 'primario-sm'}" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva</button>` : ''}
              ${puede ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="anular"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>' : ''}
              ${puede && !certificada() ? '<button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}
              ${modificando ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}
              ${ed ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${f ? 'Guardar cambios' : 'Registrar'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          ${f?.estado === 'ANULADA' ? `<p class="tk-aviso bm-anulado"><i class="ti ti-ban" aria-hidden="true"></i> Anulada por ${esc(f.anulada_por || '')} el ${esc(fmt.fechaHora(f.anulada_en))}: ${esc(f.motivo_anulacion || '')}</p>` : ''}
          <div class="dpb vf ${ed ? 'editando' : 'consulta'}">
            <div class="dpb-control">
              <span><small>Interno</small><b>${f ? f.numero : 'Automático'}</b></span>
              <span><small>Emisión</small><b>${esc(fmt.fechaHora(v.fecha_emision))}</b></span>
              <span><small>Certificación</small><b>${v.fecha_certificacion ? esc(fmt.fechaHora(v.fecha_certificacion)) : '—'}</b></span>
              <span><small>Usuario</small><b>${esc(f ? f.usuario || '' : (ctx.yo.usuario || '').toUpperCase())}</b></span>
              <span><small>Certificador</small><b>COFIDI</b></span>
              ${v.autorizacion ? `<span><small>Autorización</small><b>${esc(v.autorizacion)}</b></span>` : ''}
            </div>
          </div>
          <div class="vfa">
            <div class="vfa-arriba">
              <section class="bm-bloque dpb-banda vf">
                <h3 class="ta-col-titulo"><i class="ti ti-user" aria-hidden="true"></i> Cliente</h3>
                <div class="dpb-g vfb-g1">
                  <label class="campo"><span>Código</span><input list="vf-clientes" name="cliente_codigo" value="${esc(String(v.cliente_codigo ?? ''))}" placeholder="Código o nombre" ${dis}></label>
                  <label class="campo"><span>Cliente *</span><input name="nombre" value="${esc(v.nombre || '')}" maxlength="150" ${dis}></label>
                  <label class="campo"><span>NIT</span><input name="nit" value="${esc(v.consumidor_final ? 'CF' : v.nit || '')}" maxlength="25" ${dis || (v.consumidor_final ? 'disabled' : '')}></label>
                  <label class="pc-check vf-chk"><input type="checkbox" name="consumidor_final" ${v.consumidor_final ? 'checked' : ''} ${dis}> C. F.</label>
                  <label class="campo"><span>Teléfono</span><input name="telefono" value="${esc(v.telefono || '')}" maxlength="40" ${dis}></label>
                  <label class="campo"><span>Contacto</span><input name="contacto" value="${esc(v.contacto || '')}" maxlength="100" ${dis}></label>
                </div>
                <div class="dpb-g vfb-g2">
                  <label class="campo"><span>Dirección</span><input name="direccion" value="${esc(v.direccion || '')}" maxlength="300" ${dis}></label>
                  <label class="campo"><span>Dirección de envío</span><input name="direccion_envio" value="${esc(v.direccion_envio || '')}" maxlength="300" ${dis}></label>
                  <label class="campo"><span>Correo</span><input name="correo" value="${esc(v.correo || '')}" maxlength="120" ${dis}></label>
                  <label class="campo"><span>NIT externo</span><input name="nit_externo" value="${esc(v.nit_externo || '')}" maxlength="40" ${dis}></label>
                </div>
                <datalist id="vf-clientes">${clientes.filter((c) => c.estado === 'ACTIVO').map((c) => `<option value="${c.codigo}">${esc(c.nombre)}${c.tipo_documento !== 'CF' ? ` · ${esc(c.documento)}` : ''}</option>`).join('')}</datalist>
              </section>
              <section class="vfb-card vfb-resumen vfa-resumen">
                <div><span>Subtotal</span><b data-calc="subtotal">${fmt.monto(total - iva)}</b></div>
                <div><span>IVA</span><b data-calc="iva">${fmt.monto(iva)}</b></div>
                ${retIva || v.agente_retenedor ? `<div><span>Retención IVA</span><b data-calc="retiva2">${fmt.monto(retIva)}</b></div>` : ''}
                ${Number(v.monto_retencion_isr || 0) ? `<div><span>Retención ISR</span><b>${fmt.monto(v.monto_retencion_isr)}</b></div>` : ''}
                <div class="vfb-total"><span>Total</span><b data-calc="total">${esc(sim(v.moneda_id))} ${fmt.monto(total)}</b></div>
                <div><span>Valor MI</span><b data-calc="mi">${fmt.monto(total / tc)}</b></div>
                <div><span>Pagado</span><b data-calc="pagado">${fmt.monto(pagado)}</b></div>
                <div class="vf-saldo"><span>Saldo</span><b data-calc="saldo">${fmt.monto(saldo)}</b></div>
              </section>
            </div>
            <div class="vfa-cards vf">
              <section class="vfb-card">
                <h3 class="ta-col-titulo"><i class="ti ti-certificate" aria-hidden="true"></i> Documento FEL</h3>
                <div class="vfb-g">
                  <label class="campo vfb-c2"><span>Tipo de factura</span><select name="tipo_factura" ${dis}>${TIPOS_FACTURA.map((t) => `<option ${v.tipo_factura === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
                  <label class="campo"><span>Tipo DTE</span><select name="tipo_dte" ${dis}>${TIPOS_DTE.map(([k, t]) => `<option value="${k}" ${v.tipo_dte === k ? 'selected' : ''} title="${t}">${k}</option>`).join('')}</select></label>
                  <label class="campo"><span>Serie</span><input name="serie" value="${esc(v.serie || '')}" maxlength="20" ${dis}></label>
                  <label class="campo vfb-c2"><span>No. DTE</span><input name="numero_dte" value="${esc(v.numero_dte || '')}" maxlength="20" ${dis}></label>
                  <label class="campo vfb-c2"><span>No. de autorización</span><input name="autorizacion" value="${esc(v.autorizacion || '')}" maxlength="60" placeholder="Lo asigna COFIDI al certificar" ${dis}></label>
                  <label class="campo vfb-c2"><span>Tipo de documento</span><input name="tipo_documento" value="${esc(v.tipo_documento || '')}" maxlength="80" placeholder="Ej. Factura cambiaria · genéricos" ${dis}></label>
                  <label class="campo"><span>Moneda</span><select name="moneda_id" ${dis}>${ctx.monedas.map((x) => `<option value="${x.id}" ${v.moneda_id === x.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>
                  <label class="campo"><span>Cambio</span><input type="number" step="any" min="0" name="tipo_cambio" value="${esc(String(v.tipo_cambio ?? 1))}" ${dis}></label>
                </div>
              </section>
              <section class="vfb-card">
                <h3 class="ta-col-titulo"><i class="ti ti-briefcase" aria-hidden="true"></i> Venta y crédito</h3>
                <div class="vfb-g">
                  <label class="campo vfb-c2"><span>Vendedor</span><select name="vendedor_id" ${dis}>${opt(vendedores, v.vendedor_id)}</select></label>
                  <label class="campo vfb-c2"><span>Tipo de precio</span><select name="tipo_precio_id" ${dis}>${opt(precios, v.tipo_precio_id)}</select></label>
                  <label class="campo vfb-c2"><span>Bodega</span><select name="bodega_id" ${dis}>${opt(bodegas, v.bodega_id)}</select></label>
                  <label class="campo"><span>Pago</span><select name="forma_pago" ${dis}>${['CONTADO', 'CRÉDITO'].map((x) => `<option ${v.forma_pago === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
                  <label class="campo"><span>Días</span><input type="number" min="0" max="365" name="dias_credito" value="${esc(String(v.dias_credito ?? 0))}" ${dis || (v.forma_pago === 'CONTADO' ? 'disabled' : '')}></label>
                  <label class="campo"><span>Cobro</span><input type="date" name="fecha_cobro" value="${esc(v.fecha_cobro || '')}" ${dis}></label>
                  <label class="campo"><span>Contraseña</span><input name="contrasena" value="${esc(v.contrasena || '')}" maxlength="40" ${dis}></label>
                  <label class="campo"><span>Entrega</span><select name="modo_entrega" ${dis}>${ENTREGAS.map((x) => `<option ${v.modo_entrega === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
                  <label class="pc-check vf-chk"><input type="checkbox" name="unificar_productos" ${v.unificar_productos ? 'checked' : ''} ${dis}> Unificar</label>
                </div>
              </section>
              <section class="vfb-card">
                <h3 class="ta-col-titulo"><i class="ti ti-receipt-tax" aria-hidden="true"></i> Impuestos y cobro</h3>
                <div class="vf-checks">
                  <label class="pc-check"><input type="checkbox" name="exento_iva" ${v.exento_iva ? 'checked' : ''} ${dis}> Exento de IVA</label>
                  <label class="pc-check"><input type="checkbox" name="agente_retenedor" ${v.agente_retenedor ? 'checked' : ''} ${dis}> Agente retenedor</label>
                  <label class="pc-check"><input type="checkbox" name="retencion_isr" ${v.retencion_isr ? 'checked' : ''} ${dis}> Retención ISR</label>
                </div>
                <div class="vfb-g">
                  <label class="campo"><span>% ret. IVA</span><input type="number" step="0.01" min="0" max="100" name="pct_retencion_iva" value="${esc(String(v.pct_retencion_iva ?? 0))}" ${dis || (v.agente_retenedor ? '' : 'disabled')}></label>
                  <label class="campo"><span>Retenido</span><input value="${fmt.monto(retIva)}" disabled data-calc="retiva"></label>
                  <label class="campo"><span>Ret. ISR</span><input type="number" step="0.01" min="0" name="monto_retencion_isr" value="${esc(String(v.monto_retencion_isr ?? 0))}" ${dis || (v.retencion_isr ? '' : 'disabled')}></label>
                  <label class="campo"><span>Clasif.</span><select name="clasificacion" ${dis}>${CLASIFICACIONES.map((x) => `<option ${v.clasificacion === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
                  <label class="campo vfb-c2"><span>Cuenta x cobrar</span><select name="cuenta_por_cobrar" ${dis}>${['C X C', 'CONTADO'].map((x) => `<option ${v.cuenta_por_cobrar === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
                  <label class="campo vfb-c2"><span>Incoterm</span><select name="incoterm" ${dis}><option value="">—</option>${INCOTERMS.map((x) => `<option ${v.incoterm === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
                </div>
              </section>
              <section class="vfb-card">
                <h3 class="ta-col-titulo"><i class="ti ti-pill" aria-hidden="true"></i> Producto y línea</h3>
                <div class="vfb-g">
                  <label class="campo vfb-c2"><span>Lab. fab.</span><input name="lab_fab" value="${esc(v.lab_fab || '')}" maxlength="120" ${dis}></label>
                  <label class="pc-check vf-chk"><input type="checkbox" name="generico" ${v.generico ? 'checked' : ''} ${dis}> Genérico</label>
                  <div class="vf-lado vfa-lado">${pestana === 'DETALLE' && l ? `
                <small>Línea ${lineaSel + 1}</small>
                <label class="campo"><span>Unidad</span><input data-lado="unidad_medida" value="${esc(l.unidad_medida || '')}" maxlength="60" ${dis}></label>
                <label class="campo"><span>Lote</span><input data-lado="lote" value="${esc(l.lote || '')}" maxlength="40" ${dis}></label>
                <label class="campo"><span>Registro sanitario</span><input data-lado="registro_sanitario" value="${esc(l.registro_sanitario || '')}" maxlength="60" ${dis}></label>
                <label class="campo"><span>Vencimiento</span><input type="date" data-lado="fecha_vencimiento" value="${esc(l.fecha_vencimiento || '')}" ${dis}></label>
                <label class="campo"><span>Fabricación</span><input type="date" data-lado="fecha_fabricacion" value="${esc(l.fecha_fabricacion || '')}" ${dis}></label>` : ''}</div>
                </div>
              </section>
            </div>
          <section class="bm-pestanas">
            <div class="bm-tabs-barra">
              <div class="rp-pestanas" role="tablist">${PESTANAS.map(([k, t, i]) => `<button type="button" role="tab" data-pestana="${k}" class="${pestana === k ? 'activa' : ''}" aria-selected="${pestana === k}"><i class="ti ${i}" aria-hidden="true"></i> ${t}${k === 'DETALLE' ? ` <b>${lineas.length}</b>` : k === 'PAGOS' && pagos.length ? ` <b>${pagos.length}</b>` : ''}</button>`).join('')}</div>
              <span class="vf-tab-acc">${ed && pestana === 'DETALLE' ? '<button type="button" class="boton secundario-sm" data-accion="linea"><i class="ti ti-plus" aria-hidden="true"></i> Producto</button>' : ''}${ed && pestana === 'CONTABLE' ? '<button type="button" class="boton secundario-sm" data-accion="conta"><i class="ti ti-plus" aria-hidden="true"></i> Línea contable</button>' : ''}${ctx.admin && pestana === 'PAGOS' && (ed || puede) ? '<button type="button" class="boton secundario-sm" data-accion="pago"><i class="ti ti-plus" aria-hidden="true"></i> Pago</button>' : ''}</span>
            </div>
            <div class="bm-panel" data-panel="DETALLE" ${pestana === 'DETALLE' ? '' : 'hidden'}>
              <div class="vf-detalle">
                <div class="pc-lineas"><table class="vf-lineas"><thead><tr><th class="pc-n">#</th><th class="vf-c-prod">Producto</th><th>Descripción</th><th class="vf-c-tipo">Bien / servicio</th><th class="num vf-c-num">Cantidad</th><th class="num vf-c-num">Precio Q</th><th class="num vf-c-num">Total Q</th><th class="num vf-c-num">Precio MI</th><th class="num vf-c-num">Total MI</th><th class="vf-c-chk" title="Descarga del inventario">Inv.</th><th class="vf-c-chk" title="C.P.A.">CPA</th><th class="vf-c-fecha">Fecha comp.</th><th class="pq-x"></th></tr></thead>
                  <tbody>${lineas.map((x, i) => filaLinea(x, i, ed, tc)).join('') || '<tr><td colspan="13" class="tk-vacio">Sin productos.</td></tr>'}</tbody>
                  <tfoot><tr><td colspan="4">Totales</td><td class="num" data-calc="cant">${fmt.monto(lineas.reduce((t, x) => t + Number(x.cantidad || 0), 0))}</td><td></td><td class="num" data-calc="tq">${fmt.monto(total)}</td><td></td><td class="num" data-calc="tmi">${fmt.monto(total / tc)}</td><td colspan="4"></td></tr></tfoot></table></div>
              </div>
              <datalist id="vf-productos">${productos.filter((p) => p.estado !== 'INACTIVO').map((p) => `<option value="${p.codigo}">${esc(p.nombre)}</option>`).join('')}</datalist>
            </div>
            <div class="bm-panel" data-panel="CONTABLE" ${pestana === 'CONTABLE' ? '' : 'hidden'}>
              <div class="pc-lineas"><table><thead><tr><th class="pc-n">#</th><th>Cuenta</th><th>Nombre de la cuenta</th><th>Concepto</th><th class="num">Debe</th><th class="num">Haber</th><th>Centro</th><th class="pq-x"></th></tr></thead>
                <tbody>${conta.map((x, i) => { const k = cuenta(x.cuenta_id); const c = centro(x.centro_id); return `<tr data-conta="${i}"><td class="pc-n">${i + 1}</td><td><input list="vf-cuentas" data-c="cuenta" value="${esc(k?.codigo || x.codigo || '')}" ${dis}></td><td class="cc-nombre">${esc(k?.nombre || x.nombre || '')}</td><td><input data-c="concepto" value="${esc(x.concepto || '')}" maxlength="200" ${dis}></td><td class="num"><input type="number" step="0.01" min="0" data-c="debe" value="${x.debe || ''}" ${dis}></td><td class="num"><input type="number" step="0.01" min="0" data-c="haber" value="${x.haber || ''}" ${dis}></td><td><input list="vf-centros" data-c="centro" value="${esc(c?.codigo || '')}" ${dis}></td><td class="pq-x">${ed ? `<button type="button" class="icono-boton" data-quitar-conta="${i}" aria-label="Quitar la línea ${i + 1}"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="8" class="tk-vacio">Sin detalle contable.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="4">Totales <span data-cuadre></span></td><td class="num" data-calc="debe">${fmt.monto(conta.reduce((t, x) => t + Number(x.debe || 0), 0))}</td><td class="num" data-calc="haber">${fmt.monto(conta.reduce((t, x) => t + Number(x.haber || 0), 0))}</td><td colspan="2"></td></tr></tfoot></table></div>
              <datalist id="vf-cuentas">${contables.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('')}</datalist>
              <datalist id="vf-centros">${centros.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('')}</datalist>
            </div>
            <div class="bm-panel" data-panel="INVENTARIO" ${pestana === 'INVENTARIO' ? '' : 'hidden'}>
              <div class="pc-lineas"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Bodega</th><th>Lote</th><th>Vence</th><th class="num">Cantidad</th><th class="num">Costo unitario</th></tr></thead>
                <tbody>${inventario.map((x) => { const p = producto(x.producto_id); const b = bodegas.find((y) => y.id === x.bodega_id); return `<tr><td>${esc(fmt.fechaDia(x.fecha))}</td><td>${esc(p ? `${p.codigo} · ${p.nombre}` : '')}</td><td>${esc(b ? `${b.codigo} · ${b.nombre}` : '')}</td><td>${esc(x.lote || '')}</td><td>${esc(x.fecha_vencimiento ? fmt.fechaDia(x.fecha_vencimiento) : '')}</td><td class="num">${fmt.monto(x.cantidad)}</td><td class="num">${fmt.monto(x.costo_unitario)}</td></tr>`; }).join('')
                  || `<tr><td colspan="7" class="tk-vacio">${f ? (f.bodega_id ? 'La factura no descargó productos del inventario (revisa la casilla «Inv.» de las líneas).' : 'La factura no tiene bodega: no descarga inventario.') : 'Al registrar la factura, sus productos con «Inv.» salen del inventario de la bodega.'}</td></tr>`}</tbody></table></div>
            </div>
            <div class="bm-panel" data-panel="PAGOS" ${pestana === 'PAGOS' ? '' : 'hidden'}>
              <div class="pc-lineas"><table><thead><tr><th>Fecha</th><th>Forma</th><th>Documento</th><th>Banco</th><th class="num">Valor</th><th class="pq-x"></th></tr></thead>
                <tbody>${pagos.map((x, i) => { const dp = ctx.admin && (ed || puede) ? '' : 'disabled'; return `<tr data-pago="${i}"><td><input type="date" data-p="fecha" value="${esc(x.fecha || '')}" ${dp}></td><td><select data-p="forma" ${dp}>${FORMAS_PAGO.map((y) => `<option ${x.forma === y ? 'selected' : ''}>${y}</option>`).join('')}</select></td><td><input data-p="documento" value="${esc(x.documento || '')}" maxlength="40" ${dp}></td><td><input data-p="banco" value="${esc(x.banco || '')}" maxlength="60" ${dp}></td><td class="num"><input type="number" step="0.01" min="0" data-p="valor" value="${x.valor || ''}" ${dp}></td><td class="pq-x">${!dp ? `<button type="button" class="icono-boton" data-quitar-pago="${i}" aria-label="Quitar el pago"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="6" class="tk-vacio">Sin pagos.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="4">Total pagado · saldo ${fmt.monto(saldo)}</td><td class="num">${fmt.monto(pagado)}</td><td></td></tr></tfoot></table></div>
              ${puede && !modificando ? '<div class="vf-pie"><button type="button" class="boton primario-sm" data-accion="guardar-pagos"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar pagos</button></div>' : ''}
            </div>
            <div class="bm-panel vf-procesos" data-panel="PROCESOS" ${pestana === 'PROCESOS' ? '' : 'hidden'}>
              <div class="bm-bloque"><h3 class="ta-col-titulo"><i class="ti ti-certificate" aria-hidden="true"></i> Certificación FEL · COFIDI</h3>
                <p class="cc-ingreso">${certificada() ? `Certificada: autorización ${esc(f.autorizacion)}.` : 'La certificación con COFIDI se conecta con sus credenciales en el servidor. Mientras tanto, registra a mano el número de autorización, la serie y el DTE.'}</p>
                <button type="button" class="boton secundario-sm" data-accion="certificar" ${f && !certificada() && f.estado === 'FACTURADA' ? '' : 'disabled'}><i class="ti ti-certificate" aria-hidden="true"></i> Certificar con COFIDI</button></div>
              <div class="bm-bloque"><h3 class="ta-col-titulo"><i class="ti ti-ban" aria-hidden="true"></i> Anulación</h3>
                <p class="cc-ingreso">Anular deja el saldo en cero y devuelve al inventario los productos de la factura.</p>
                <button type="button" class="boton secundario-sm rp-peligro" data-accion="anular" ${puede ? '' : 'disabled'}><i class="ti ti-ban" aria-hidden="true"></i> Anular factura</button></div>
              <div class="bm-bloque"><h3 class="ta-col-titulo"><i class="ti ti-printer" aria-hidden="true"></i> Impresión</h3>
                <p class="cc-ingreso">La factura en PDF con el encabezado de la empresa, o en Excel con su detalle.</p>
                <span class="rx-par"><button type="button" class="boton secundario-sm" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button><button type="button" class="boton secundario-sm" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button></span></div>
            </div>
          </section>
          </div>
        </form>`;
      cuadre();
    }

    function filaLinea(x, i, ed, tc) {
      const dis = ed ? '' : 'disabled';
      const tq = Number(x.cantidad || 0) * Number(x.precio || 0);
      return `<tr data-linea="${i}" class="${i === lineaSel ? 'actual' : ''}">
        <td class="pc-n">${i + 1}</td>
        <td><input list="vf-productos" data-l="producto" value="${esc(x.producto_codigo != null ? String(x.producto_codigo) : '')}" placeholder="${ed ? 'Código' : ''}" ${dis}></td>
        <td><input data-l="descripcion" value="${esc(x.descripcion || '')}" maxlength="300" ${dis}></td>
        <td><select data-l="tipo" ${dis}>${['BIEN', 'SERVICIO'].map((y) => `<option ${x.tipo === y ? 'selected' : ''}>${y}</option>`).join('')}</select></td>
        <td class="num"><input type="number" step="any" min="0" data-l="cantidad" value="${esc(String(x.cantidad ?? ''))}" ${dis}></td>
        <td class="num"><input type="number" step="any" min="0" data-l="precio" value="${esc(String(x.precio ?? ''))}" ${dis}></td>
        <td class="num fuerte" data-tq>${fmt.monto(tq)}</td>
        <td class="num tk-tenue" data-pmi>${fmt.monto(Number(x.precio || 0) / tc)}</td>
        <td class="num tk-tenue" data-tmi>${fmt.monto(tq / tc)}</td>
        <td class="vf-c-chk"><input type="checkbox" data-l="inventario" ${x.inventario ? 'checked' : ''} ${dis} aria-label="Descarga del inventario"></td>
        <td class="vf-c-chk"><input type="checkbox" data-l="cpa" ${x.cpa ? 'checked' : ''} ${dis} aria-label="C.P.A."></td>
        <td><input type="date" data-l="fecha_compromiso" value="${esc(x.fecha_compromiso || '')}" ${dis}></td>
        <td class="pq-x">${ed ? `<button type="button" class="icono-boton" data-quitar-linea="${i}" aria-label="Quitar la línea ${i + 1}"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`;
    }

    function cuadre() {
      const d = fmt.redondear(conta.reduce((t, x) => t + Number(x.debe || 0), 0));
      const h = fmt.redondear(conta.reduce((t, x) => t + Number(x.haber || 0), 0));
      const e = ctx.pDet.querySelector('[data-cuadre]');
      if (e) e.innerHTML = !conta.length ? '' : d === h ? '<span class="pc-cuadre ok"><i class="ti ti-circle-check" aria-hidden="true"></i> Cuadra</span>' : `<span class="pc-cuadre no"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Diferencia ${fmt.monto(Math.abs(d - h))}</span>`;
    }

    // Lee el encabezado del formulario.
    function encabezado(form) {
      const el = form.elements;
      const t = (n) => el[n] && el[n].value.trim() !== '' ? el[n].value.trim() : null;
      const id = (n) => el[n] && el[n].value ? Number(el[n].value) : null;
      const ck = (n) => !!el[n]?.checked;
      const c = clientes.find((x) => String(x.codigo) === String(el.cliente_codigo.value).trim());
      return { tipo_factura: el.tipo_factura.value, tipo_dte: el.tipo_dte.value, tipo_documento: t('tipo_documento'), serie: t('serie'), numero_dte: t('numero_dte'), autorizacion: t('autorizacion'),
        moneda_id: id('moneda_id'), tipo_cambio: Number(el.tipo_cambio.value) || 1, cliente_id: c ? c.id : null, cliente_codigo: c ? c.codigo : (Number(el.cliente_codigo.value) || null),
        nombre: el.nombre.value.trim(), nit: ck('consumidor_final') ? 'CF' : t('nit'), consumidor_final: ck('consumidor_final'), nit_externo: t('nit_externo'), contacto: t('contacto'), telefono: t('telefono'),
        correo: t('correo'), direccion: t('direccion'), direccion_envio: t('direccion_envio'), lab_fab: t('lab_fab'), generico: ck('generico'),
        vendedor_id: id('vendedor_id'), tipo_precio_id: id('tipo_precio_id'), bodega_id: id('bodega_id'), forma_pago: el.forma_pago.value, dias_credito: Number(el.dias_credito.value) || 0,
        contrasena: t('contrasena'), fecha_cobro: t('fecha_cobro'), modo_entrega: el.modo_entrega.value, unificar_productos: ck('unificar_productos'),
        exento_iva: ck('exento_iva'), agente_retenedor: ck('agente_retenedor'), pct_retencion_iva: Number(el.pct_retencion_iva.value) || 0, retencion_isr: ck('retencion_isr'),
        monto_retencion_isr: ck('retencion_isr') ? Number(el.monto_retencion_isr.value) || 0 : 0, clasificacion: el.clasificacion.value, cuenta_por_cobrar: el.cuenta_por_cobrar.value, incoterm: t('incoterm') };
    }
    function leerTablas() {
      ctx.pDet.querySelectorAll('tr[data-linea]').forEach((tr) => {
        const x = lineas[Number(tr.dataset.linea)]; if (!x) return;
        const v = (k) => tr.querySelector(`[data-l=${k}]`);
        x.descripcion = v('descripcion').value; x.tipo = v('tipo').value; x.cantidad = Number(v('cantidad').value) || 0; x.precio = Number(v('precio').value) || 0;
        x.inventario = v('inventario').checked; x.cpa = v('cpa').checked; x.fecha_compromiso = v('fecha_compromiso').value;
      });
      ctx.pDet.querySelectorAll('[data-lado]').forEach((inp) => { const x = lineas[lineaSel]; if (x) x[inp.dataset.lado] = inp.value; });
      ctx.pDet.querySelectorAll('tr[data-conta]').forEach((tr) => {
        const x = conta[Number(tr.dataset.conta)]; if (!x) return;
        const v = (k) => tr.querySelector(`[data-c=${k}]`).value.trim();
        // Si no cambió el código se conserva la cuenta original aunque sea de otro catálogo.
        if (!(x.cuenta_id && v('cuenta') === x.codigo && !cuenta(x.cuenta_id))) { const k = cuentaPorCodigo(v('cuenta')); x.cuenta_id = k ? k.id : null; x.nombre = k?.nombre || ''; x.codigo = v('cuenta'); }
        const c = centros.find((y) => y.codigo === v('centro') && y.movimiento); x.centro_id = c ? c.id : null; x.centro_codigo = v('centro');
        x.concepto = v('concepto'); x.debe = Number(v('debe')) || 0; x.haber = Number(v('haber')) || 0;
      });
      ctx.pDet.querySelectorAll('tr[data-pago]').forEach((tr) => {
        const x = pagos[Number(tr.dataset.pago)]; if (!x) return;
        const v = (k) => tr.querySelector(`[data-p=${k}]`).value;
        x.fecha = v('fecha'); x.forma = v('forma'); x.documento = v('documento'); x.banco = v('banco'); x.valor = Number(v('valor')) || 0;
      });
    }
    function repintar(cambios = {}) {
      const form = ctx.pDet.querySelector('.vf-form'); if (!form) return;
      pintar({ ...(actual || valoresNuevos()), ...encabezado(form), estado: actual?.estado, fecha_emision: actual?.fecha_emision || new Date().toISOString(), fecha_certificacion: actual?.fecha_certificacion, ...cambios });
    }
    // Totales en vivo (sin repintar el formulario mientras se escribe).
    function totalizar() {
      const form = ctx.pDet.querySelector('.vf-form'); if (!form) return;
      leerTablas();
      const h = encabezado(form);
      const tc = h.tipo_cambio || 1;
      const total = fmt.redondear(lineas.reduce((t, x) => t + x.cantidad * x.precio, 0));
      const pagado = pagos.reduce((t, p) => t + Number(p.valor || 0), 0);
      const iva = h.exento_iva ? 0 : fmt.redondear(total * 12 / 112);
      const retIva = h.agente_retenedor ? fmt.redondear(iva * h.pct_retencion_iva / 100) : 0;
      const set = (k, t) => { const e = form.querySelector(`[data-calc=${k}]`); if (e) { if ('value' in e && e.tagName === 'INPUT') e.value = t; else e.textContent = t; } };
      set('total', `${sim(h.moneda_id)} ${fmt.monto(total)}`); set('mi', fmt.monto(total / tc)); set('tq', fmt.monto(total)); set('tmi', fmt.monto(total / tc)); set('retiva', fmt.monto(retIva));
      set('cant', fmt.monto(lineas.reduce((t, x) => t + x.cantidad, 0)));
      set('iva', fmt.monto(iva)); set('subtotal', fmt.monto(total - iva)); set('pagado', fmt.monto(pagado)); set('retiva2', fmt.monto(retIva));
      set('saldo', fmt.monto(Math.max(0, total - retIva - h.monto_retencion_isr - pagado)));
      form.querySelectorAll('tr[data-linea]').forEach((tr) => { const x = lineas[Number(tr.dataset.linea)]; tr.querySelector('[data-tq]').textContent = fmt.monto(x.cantidad * x.precio); tr.querySelector('[data-pmi]').textContent = fmt.monto(x.precio / tc); tr.querySelector('[data-tmi]').textContent = fmt.monto(x.cantidad * x.precio / tc); });
      set('debe', fmt.monto(conta.reduce((t, x) => t + x.debe, 0))); set('haber', fmt.monto(conta.reduce((t, x) => t + x.haber, 0)));
      cuadre();
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      leerTablas();
      const h = encabezado(form);
      const ir = (t) => { pestana = t; ctx.pDet.querySelector(`[data-pestana=${t}]`)?.click(); };
      if (!h.nombre) { error.textContent = 'Escribe el nombre del cliente.'; return form.elements.nombre.focus(); }
      const ls = lineas.filter((x) => x.descripcion.trim() || x.producto_id);
      if (!ls.length) { ir('DETALLE'); error.textContent = 'Agrega al menos un producto o servicio.'; return; }
      const mala = ls.findIndex((x) => !x.descripcion.trim() || !(x.cantidad > 0));
      if (mala >= 0) { ir('DETALLE'); error.textContent = `Revisa la línea ${lineas.indexOf(ls[mala]) + 1}: necesita descripción y cantidad mayor que cero.`; return; }
      const cs = conta.filter((x) => x.codigo || x.debe || x.haber);
      if (cs.some((x) => !x.cuenta_id)) { ir('CONTABLE'); error.textContent = 'Hay líneas del detalle contable sin una cuenta de movimiento válida.'; return; }
      const ps = pagos.filter((x) => x.valor > 0);
      error.textContent = '';
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      try {
        let id = actual?.id;
        if (actual) {
          const r = await sb.from('facturas_venta').update(h).eq('id', id); if (r.error) throw r.error;
          for (const t of ['factura_venta_lineas', 'factura_venta_contable', 'factura_venta_pagos']) { const d = await sb.from(t).delete().eq('factura_id', id); if (d.error) throw d.error; }
        } else {
          const r = await sb.from('facturas_venta').insert({ ...h, numero: 0, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single(); if (r.error) throw r.error;
          id = r.data.id;
        }
        const r1 = await sb.from('factura_venta_lineas').insert(ls.map((x, i) => ({ factura_id: id, linea: i + 1, producto_id: x.producto_id, producto_codigo: x.producto_codigo, descripcion: x.descripcion, tipo: x.tipo,
          cantidad: x.cantidad, precio: x.precio, inventario: x.inventario, cpa: x.cpa, fecha_compromiso: x.fecha_compromiso || null, unidad_medida: x.unidad_medida || null, lote: x.lote || null,
          registro_sanitario: x.registro_sanitario || null, fecha_vencimiento: x.fecha_vencimiento || null, fecha_fabricacion: x.fecha_fabricacion || null })));
        if (r1.error) throw r1.error;
        if (cs.length) { const r2 = await sb.from('factura_venta_contable').insert(cs.map((x, i) => ({ factura_id: id, linea: i + 1, cuenta_id: x.cuenta_id, centro_id: x.centro_id, concepto: x.concepto || null, debe: x.debe, haber: x.haber }))); if (r2.error) throw r2.error; }
        if (ps.length) { const r3 = await sb.from('factura_venta_pagos').insert(ps.map((x) => ({ factura_id: id, fecha: x.fecha || fmt.hoy(), forma: x.forma, documento: x.documento || null, banco: x.banco || null, valor: x.valor, usuario: (ctx.yo.usuario || '').toUpperCase() }))); if (r3.error) throw r3.error; }
        window.FIN.aviso(actual ? 'Factura guardada' : 'Factura registrada');
        const { data } = await sb.from('facturas_venta').select('*').eq('id', id).single();
        await abrir(data);
      } catch (err) {
        error.textContent = /facturas_venta|factura_venta/.test(err.message || '') && /does not exist|schema cache/.test(err.message || '') ? 'Falta instalar el script 130 (facturas de venta) en Supabase.' : window.UI.traducirError(err);
      } finally { boton.disabled = false; }
    }
    async function guardarPagos() {
      leerTablas();
      const d = await sb.from('factura_venta_pagos').delete().eq('factura_id', actual.id);
      if (d.error) return window.FIN.aviso(window.UI.traducirError(d.error));
      const ps = pagos.filter((x) => x.valor > 0);
      if (ps.length) { const r = await sb.from('factura_venta_pagos').insert(ps.map((x) => ({ factura_id: actual.id, fecha: x.fecha || fmt.hoy(), forma: x.forma, documento: x.documento || null, banco: x.banco || null, valor: x.valor, usuario: (ctx.yo.usuario || '').toUpperCase() }))); if (r.error) return window.FIN.aviso(window.UI.traducirError(r.error)); }
      window.FIN.aviso('Pagos guardados');
      const { data } = await sb.from('facturas_venta').select('*').eq('id', actual.id).single();
      pestana = 'PAGOS'; await abrir(data);
    }
    async function anular() {
      const motivo = prompt(`Motivo de la anulación de la factura ${actual.serie ? `${actual.serie}-${actual.numero_dte}` : actual.numero}:`);
      if (motivo === null) return;
      if (!motivo.trim()) return window.FIN.aviso('Escribe el motivo de la anulación');
      const { error } = await sb.from('facturas_venta').update({ estado: 'ANULADA', motivo_anulacion: motivo.trim(), anulada_por: (ctx.yo.usuario || '').toUpperCase(), anulada_en: new Date().toISOString() }).eq('id', actual.id);
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      window.FIN.aviso('Factura anulada');
      const { data } = await sb.from('facturas_venta').select('*').eq('id', actual.id).single();
      await abrir(data);
    }

    // ---------- Impresión y Excel de la factura ----------
    function datosImpresion() {
      const f = actual;
      const v = vendedores.find((x) => x.id === f.vendedor_id);
      return [`Factura: ${f.serie ? `${f.serie}-${f.numero_dte || ''}` : `interna ${f.numero}`}`, `Autorización: ${f.autorizacion || 'sin certificar'}`, `Emisión: ${fmt.fechaHora(f.fecha_emision)}`,
        `Cliente: ${f.cliente_codigo || ''} · ${f.nombre}`, `NIT: ${f.nit || ''}`, `Forma de pago: ${f.forma_pago}${f.forma_pago === 'CRÉDITO' ? ` ${f.dias_credito} días` : ''}`, `Vendedor: ${v ? v.nombre : '—'}`, `Estado: ${f.estado}`];
    }
    function pdf() {
      const f = actual;
      if (!f) return window.FIN.aviso('Registra primero la factura');
      imprimir(`Factura ${f.numero}`, `<h1>Factura ${esc(f.serie ? `${f.serie}-${f.numero_dte || ''}` : `interna ${f.numero}`)}${f.estado === 'ANULADA' ? ' · ANULADA' : ''}</h1><h2>${esc(datosImpresion().join(' · '))}</h2>
        <table><thead><tr><th>#</th><th>Producto</th><th>Descripción</th><th>Lote</th><th>Vence</th><th class="n">Cantidad</th><th class="n">Precio</th><th class="n">Total</th></tr></thead><tbody>
        ${lineas.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(String(x.producto_codigo ?? ''))}</td><td>${esc(x.descripcion)}</td><td>${esc(x.lote || '')}</td><td>${esc(x.fecha_vencimiento ? fmt.fechaDia(x.fecha_vencimiento) : '')}</td><td class="n">${fmt.monto(x.cantidad)}</td><td class="n">${fmt.monto(x.precio)}</td><td class="n">${fmt.monto(x.cantidad * x.precio)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="7">Total (IVA incluido ${fmt.monto(f.iva)})</td><td class="n">${fmt.monto(f.total)}</td></tr><tr><td colspan="7">Pagado</td><td class="n">${fmt.monto(f.pagado)}</td></tr><tr><td colspan="7">Saldo</td><td class="n">${fmt.monto(f.saldo)}</td></tr></tfoot></table>
        <div class="firmas"><div>Elaboró: ${esc(f.usuario || '')}</div><div>Recibí conforme</div></div>`, { locId: f.localidad_id, orgId: f.organizacion_id });
    }
    function excel() {
      const f = actual;
      if (!f) return window.FIN.aviso('Registra primero la factura');
      if (!window.REPORTE_XLSX) return;
      const filas = lineas.map((x, i) => ({ valores: [i + 1, x.producto_codigo ?? '', x.descripcion, x.tipo, x.lote || '', x.fecha_vencimiento ? fmt.fechaDia(x.fecha_vencimiento) : '', Number(x.cantidad), Number(x.precio), fmt.redondear(x.cantidad * x.precio)] }));
      filas.push({ tipo: 'total', valores: ['', '', 'Total', '', '', '', lineas.reduce((t, x) => t + Number(x.cantidad), 0), null, Number(f.total)] },
        { tipo: 'nota', valores: ['', '', `IVA ${fmt.monto(f.iva)} · pagado ${fmt.monto(f.pagado)} · saldo ${fmt.monto(f.saldo)}`] });
      window.REPORTE_XLSX.generar({ titulo: `Factura ${f.serie ? `${f.serie}-${f.numero_dte || ''}` : `interna ${f.numero}`}`, parametros: datosImpresion(), orgId: f.organizacion_id, locId: f.localidad_id, hoja: 'Factura', archivo: `factura_${f.numero}`,
        columnas: [{ titulo: '#', ancho: 5 }, { titulo: 'Producto', ancho: 10 }, { titulo: 'Descripción', ancho: 50 }, { titulo: 'Tipo', ancho: 10 }, { titulo: 'Lote', ancho: 14 }, { titulo: 'Vence', ancho: 11 }, { titulo: 'Cantidad', ancho: 11, tipo: 'numero' }, { titulo: 'Precio', ancho: 13, tipo: 'monto' }, { titulo: 'Total', ancho: 15, tipo: 'monto' }],
        filas });
    }

    // ---------- Eventos ----------
    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad().then(() => abrir(null));
      const form = e.target.closest('.vf-form');
      if (!form) return;
      const n = e.target.name;
      leerTablas();
      if (n === 'cliente_codigo') {
        const c = clientes.find((x) => String(x.codigo) === e.target.value.trim());
        if (c) return repintar({ cliente_codigo: c.codigo, cliente_id: c.id, nombre: c.nombre, nit: c.tipo_documento === 'CF' ? 'CF' : c.documento, consumidor_final: c.tipo_documento === 'CF', contacto: c.contacto || '', telefono: c.telefono || '',
          correo: c.correo || '', direccion: c.direccion || '', direccion_envio: c.direccion_envio || '', nit_externo: c.nit_externo || '', vendedor_id: c.vendedor_id, tipo_precio_id: c.tipo_precio_id, bodega_id: c.bodega_id,
          forma_pago: c.forma_pago || 'CONTADO', dias_credito: c.dias_credito || 0, fecha_cobro: c.forma_pago === 'CRÉDITO' ? sumar(c.dias_credito, actual?.fecha_emision) : '', modo_entrega: c.modo_entrega || 'OFICINA',
          agente_retenedor: !!c.agente_retenedor });
      }
      if (n === 'tipo_factura') return repintar({ tipo_dte: DTE_DE[e.target.value] || 'FACT' });
      if (n === 'forma_pago' || n === 'dias_credito') { const h = encabezado(form); return repintar({ fecha_cobro: h.forma_pago === 'CRÉDITO' ? sumar(h.dias_credito, actual?.fecha_emision) : '' }); }
      if (['consumidor_final', 'agente_retenedor', 'retencion_isr'].includes(n)) return repintar();
      if (n === 'tipo_precio_id') { leerTablas(); const tp = Number(e.target.value) || null; lineas.forEach((x) => { if (x.producto_id && tp) { const p = precioDe(x.producto_id, tp); if (p) x.precio = p; } }); return repintar(); }
      if (n === 'moneda_id') form.elements.tipo_cambio.value = ctx.moneda(Number(e.target.value))?.iso === 'GTQ' ? form.elements.tipo_cambio.value : ctx.moneda(Number(e.target.value))?.cambio || 1;
      const prod = e.target.closest('[data-l=producto]');
      if (prod) {
        leerTablas();
        const tr = prod.closest('tr'); const x = lineas[Number(tr.dataset.linea)];
        const p = porCodigoProd(prod.value);
        if (p) { x.producto_id = p.id; x.producto_codigo = p.codigo; x.descripcion = p.nombre; x.lote = x.lote || p.lote || ''; const tp = Number(form.elements.tipo_precio_id.value) || null; const pr = tp ? precioDe(p.id, tp) : 0; if (pr) x.precio = pr; }
        else { x.producto_id = null; x.producto_codigo = Number(prod.value) || null; }
        return repintar();
      }
      if (e.target.closest('[data-c=cuenta], [data-c=centro]')) { leerTablas(); return repintar(); }
      totalizar();
    });
    cont.addEventListener('input', (e) => {
      if (e.target.closest('tr[data-linea], tr[data-conta], tr[data-pago]') || ['tipo_cambio', 'pct_retencion_iva', 'monto_retencion_isr'].includes(e.target.name)) {
        const tr = e.target.closest('tr[data-conta]');
        if (tr && e.target.dataset.c === 'debe' && e.target.value) tr.querySelector('[data-c=haber]').value = '';
        if (tr && e.target.dataset.c === 'haber' && e.target.value) tr.querySelector('[data-c=debe]').value = '';
        totalizar();
      }
    });
    cont.addEventListener('focusin', (e) => {
      const tr = e.target.closest('tr[data-linea]');
      if (!tr || Number(tr.dataset.linea) === lineaSel) return;
      leerTablas();
      lineaSel = Number(tr.dataset.linea);
      ctx.pDet.querySelectorAll('tr[data-linea]').forEach((x) => x.classList.toggle('actual', x === tr));
      const lado = ctx.pDet.querySelector('.vf-lado');
      const l = lineas[lineaSel]; const dis = editable() ? '' : 'disabled';
      if (lado && l) lado.innerHTML = `<small>Línea ${lineaSel + 1}</small>
        <label class="campo"><span>Unidad</span><input data-lado="unidad_medida" value="${esc(l.unidad_medida || '')}" maxlength="60" ${dis}></label>
        <label class="campo"><span>Lote</span><input data-lado="lote" value="${esc(l.lote || '')}" maxlength="40" ${dis}></label>
        <label class="campo"><span>Registro sanitario</span><input data-lado="registro_sanitario" value="${esc(l.registro_sanitario || '')}" maxlength="60" ${dis}></label>
        <label class="campo"><span>Vencimiento</span><input type="date" data-lado="fecha_vencimiento" value="${esc(l.fecha_vencimiento || '')}" ${dis}></label>
        <label class="campo"><span>Fabricación</span><input type="date" data-lado="fecha_fabricacion" value="${esc(l.fecha_fabricacion || '')}" ${dis}></label>`;
    });
    cont.addEventListener('click', async (e) => {
      const tab = e.target.closest('[data-pestana]');
      if (tab) { leerTablas(); pestana = tab.dataset.pestana; const form = ctx.pDet.querySelector('.vf-form'); return form ? repintar() : null; }
      const ql = e.target.closest('[data-quitar-linea]'); if (ql) { leerTablas(); lineas.splice(Number(ql.dataset.quitarLinea), 1); if (!lineas.length) lineas.push(nuevaLinea()); lineaSel = 0; return repintar(); }
      const qc = e.target.closest('[data-quitar-conta]'); if (qc) { leerTablas(); conta.splice(Number(qc.dataset.quitarConta), 1); return repintar(); }
      const qp = e.target.closest('[data-quitar-pago]'); if (qp) { leerTablas(); pagos.splice(Number(qp.dataset.quitarPago), 1); return repintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (!a) return;
      if (a === 'nueva') { pestana = 'DETALLE'; return abrir(null); }
      if (a === 'modificar') { modificando = true; return repintar(); }
      if (a === 'cancelar') return abrir(actual);
      if (a === 'linea') { leerTablas(); lineas.push(nuevaLinea()); lineaSel = lineas.length - 1; repintar(); return ctx.pDet.querySelector(`tr[data-linea="${lineaSel}"] [data-l=producto]`)?.focus(); }
      if (a === 'conta') { leerTablas(); conta.push({ cuenta_id: null, centro_id: null, concepto: '', debe: 0, haber: 0 }); return repintar(); }
      if (a === 'pago') { leerTablas(); pagos.push({ fecha: fmt.hoy(), forma: 'EFECTIVO', documento: '', banco: '', valor: 0 }); return repintar(); }
      if (a === 'guardar-pagos') return guardarPagos();
      if (a === 'anular') return anular();
      if (a === 'certificar') return window.FIN.aviso('Certificación con COFIDI: se habilita al configurar sus credenciales en el servidor. Mientras tanto registra la autorización con «Modificar».');
      if (a === 'pdf') return pdf();
      if (a === 'excel') return excel();
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.vf-form')) { e.preventDefault(); guardar(e.target); } });

    iniciar();
  };
})();
