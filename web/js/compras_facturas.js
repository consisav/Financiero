// Compras · Registros · Ingreso de compras (antes Facturas de compra): el ingreso completo de la compra (son las mismas compras
// que se pagan en Generación cheques y Generación transferencias).
//   Encabezado: el proveedor (del catálogo: trae NIT, régimen, días de crédito, forma y datos de
//   pago, bodega y transacción), estado y factura original; el documento (tipo DTE, mes y año de
//   presentación, pago inmediato, número de compra, serie, número, fecha, días de crédito, fecha de
//   pago y contraseña de pago); la clasificación fiscal (régimen ISR, clasificación, tipo de
//   operación, rubro y descripción); el desglose fiscal (combustibles con su IDP, exento, gastos no
//   deducibles, IVA e ISR especial, INGUAT, turismo ITP, IVA de importación, DAI y cuenta ajena); la
//   retención (formulario, valor y fecha) y los totales (descuentos, subtotal, total, IVA, base y
//   saldo).
//   Pestañas: Compras varias (el detalle de la compra), Detalle contable, Documentos a liquidar
//   (notas de crédito, descuentos y pagos), Otras funciones e integración (forma de pago, cuentas,
//   partida, anulación y contraseña), Órdenes de compra y Listado.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const OPERACIONES = ['NO DEFINIDO', 'COMPRA LOCAL', 'IMPORTACIÓN', 'SERVICIO LOCAL', 'SERVICIO DEL EXTERIOR', 'CUENTA AJENA'];
  const DIAS = [0, 8, 15, 30, 45, 60, 90, 120];
  const ESTADO_PAGO = (c) => c.estado === 'ANULADA' ? 'ANULADA' : Number(c.pendiente) <= 0 ? 'PAGADA' : Number(c.pagado) > 0 ? 'PARCIAL' : 'PENDIENTE';
  const CLASE = { PENDIENTE: 'pendiente', PARCIAL: 'aprobada', PAGADA: 'definitiva', ANULADA: 'anulada' };
  const marca = (e) => `<span class="pc-marca ${CLASE[e]}">${{ PENDIENTE: 'Vigente · por pagar', PARCIAL: 'Pago parcial', PAGADA: 'Pagada', ANULADA: 'Anulada' }[e]}</span>`;
  const sumaDias = (fecha, dias) => { if (!fecha) return ''; const d = new Date(`${fecha}T12:00:00`); d.setDate(d.getDate() + Number(dias || 0)); return d.toISOString().slice(0, 10); };

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['facturas-compra'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Ingreso de compras', icono: 'ti-file-invoice', clase: 'bk-movimientos bk-compras cf-compras', grupo: 'Compras · Registros' });
    const { sb, yo } = ctx;
    const [anio, mes] = fmt.hoy().split('-');
    const f = { estado: 'TODAS', desde: `${anio}-${mes}-01`, hasta: fmt.hoy() };
    let compras = [];
    let proveedores = [], bodegas = [], regimenes = [], rubros = [], tiposDoc = [], clasificaciones = [], cuentas = [], contables = [], centros = [], transacciones = [];
    let params = {};
    let actual = null;
    let items = [], lineas = [], pagos = [], cuentasProv = [];
    let articulos = [], productos = [], ingresosLibres = [], ingresoVincular = null;
    let modificando = false;
    let pestana = 'ITEMS';
    let buscar = '';

    const editable = () => ctx.admin && (!actual || (modificando && actual.estado === 'ACTIVA'));
    const contable = (id) => contables.find((x) => x.id === id);
    const porCodigo = (cod) => contables.find((x) => x.codigo === String(cod || '').trim() && x.movimiento);
    const proveedor = (id) => proveedores.find((p) => p.id === id);
    const tipoDoc = (id) => tiposDoc.find((x) => x.id === id);
    const clasificacion = (id) => clasificaciones.find((x) => x.id === id);
    const simbolo = (id) => ctx.moneda(id)?.simbolo || 'Q';
    const provTxt = (p) => `${p.codigo} · ${p.nombre_comercial}${p.nit ? ` · ${p.nit}` : ''}`;
    const docTxt = (c) => `${c.serie ? `${c.serie}-` : ''}${c.documento}`;
    // Compra de bienes (artículos) o de servicios (compras varias), según su clasificación.
    // Bienes si la clasificación aplica inventarios (sin el script 64, si no es de servicios); una compra
    // que ya tiene artículos o líneas de compras varias se queda con ese detalle.
    const aplicaInv = (k) => !k || (k.aplica_inventario ?? !/SERVICIO/i.test(k.nombre || ''));
    const esBienes = (v) => articulos.length > 0 || (!items.some((i) => i.descripcion) && aplicaInv(clasificacion(v?.clasificacion_id)));
    const totalArt = (a) => Number(a.cantidad || 0) * Number(a.costo_unitario || 0) - Number(a.descuento || 0) + Number(a.costo_extra || 0);
    const subtotal = () => fmt.redondear(articulos.length ? articulos.reduce((t, a) => t + totalArt(a), 0) : items.reduce((t, i) => t + Number(i.costo_total || 0), 0));
    const prod = (id) => productos.find((p) => p.id === id);
    const prodTxt = (p) => `${p.codigo_producto || p.codigo} · ${p.nombre}`;
    const tasaMI = () => ctx.monedas.find((m) => m.iso === 'USD')?.cambio || 1;
    // Tipo de cambio a la moneda base: una compra en la moneda base no se convierte.
    const aBase = (moneda, cambio) => Number(moneda) === ctx.monedaBase()?.id ? 1 : Number(cambio) || 1;

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Estado</span><select name="estado">${['TODAS', 'POR PAGAR', 'PAGADAS', 'ANULADAS'].map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha desde</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha hasta</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>`,
        '<div class="cf-barra" data-barra></div>');
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('compras_saldo').select('id, tipo_dte, tipo_documento_id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/tipo_documento_id/.test(prueba.error.message) ? 'Falta instalar el script 58 (clasificaciones, tipos de documento y contraseñas de pago) en Supabase.' : /tipo_dte|proveedor/.test(prueba.error.message) ? 'Falta instalar el script 57 (proveedores, bodegas y facturas de compra) en Supabase.' : /compras/.test(prueba.error.message) ? 'Falta instalar el script 53 (facturas de compra) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      const [r, u, t, k] = await Promise.all([sb.from('regimenes_isr').select('*').order('codigo'), sb.from('rubros_presupuesto').select('id, codigo, nombre, activo').order('codigo'),
        sb.from('tipos_documento_compra').select('*').order('codigo'), sb.from('clasificaciones_compra').select('*').order('codigo')]);
      regimenes = r.data || []; rubros = u.data || []; tiposDoc = t.data || []; clasificaciones = k.data || [];
      pintarFiltros();
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      actual = null;
      const loc = ctx.sel.loc;
      const C = window.COMPRAS_CAT;
      const [p, b, g] = await Promise.all([
        loc ? sb.from('proveedores').select('*').eq('localidad_id', loc).order('nombre_comercial') : { data: [] },
        loc ? sb.from('bodegas').select('id, codigo, nombre, estado').eq('localidad_id', loc).order('codigo') : { data: [] },
        loc ? sb.from('parametros_generales').select('impuesto1, idp_super, idp_regular, idp_diesel').eq('localidad_id', loc).order('id').limit(1) : { data: [] }
      ]);
      proveedores = p.data || []; bodegas = b.data || []; params = g.data?.[0] || {};
      const [pr, il] = await Promise.all([
        loc ? sb.from('productos').select('id, codigo, codigo_producto, nombre, estado, precio_costo').eq('localidad_id', loc).order('nombre') : { data: [] },
        loc ? sb.from('ingresos_compra').select('id, numero, fecha_ingreso, orden_id, proveedor_id, bodega_id, moneda_id, tipo_cambio, forma_pago, dias_credito, serie, documento, fecha_documento, valor_descuento, transaccion_id, ordenes_compra(numero), ingreso_lineas(id, producto_id, lote, cantidad, costo_unitario, inventariado)').eq('localidad_id', loc).eq('estado', 'APLICADO').is('compra_id', null).order('numero', { ascending: false }) : { data: [] }
      ]);
      productos = pr.data || []; ingresosLibres = il.error ? [] : il.data || [];
      [cuentas, contables, centros, transacciones] = await Promise.all([ctx.cuentasBancarias(), ctx.cuentasContables(), C.centrosLocalidad(sb, loc), C.transaccionesLocalidad(sb, loc)]);
      await consultar();
    }

    async function consultar(id = actual?.id) {
      if (!ctx.sel.loc) { compras = []; pintarMaestro(); return abrir(null); }
      let q = sb.from('compras_saldo').select('*').eq('localidad_id', ctx.sel.loc).order('numero', { ascending: false });
      if (f.estado === 'POR PAGAR') q = q.eq('estado', 'ACTIVA').gt('pendiente', 0);
      else {
        q = q.gte('fecha_documento', f.desde).lte('fecha_documento', f.hasta);
        if (f.estado === 'PAGADAS') q = q.eq('estado', 'ACTIVA').lte('pendiente', 0);
        if (f.estado === 'ANULADAS') q = q.eq('estado', 'ANULADA');
      }
      const { data, error } = await q;
      if (error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      compras = data || [];
      pintarMaestro();
      await abrir(compras.find((c) => c.id === id) || (id === null ? null : compras[0]) || null);
    }

    function pintarMaestro() {
      const q = buscar.trim().toLowerCase();
      const filas = compras.filter((c) => !q || [c.numero, c.documento, c.serie, c.proveedor_codigo, c.proveedor_nombre, c.nit, c.contrasena].some((v) => String(v || '').toLowerCase().includes(q)));
      const vivas = compras.filter((c) => c.estado === 'ACTIVA');
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab tg-cab">
          <h2>Compras <small>${compras.length}</small></h2>
          <div class="ta-totales pc-resumen"><span class="ta-total"><b>Q ${fmt.monto(vivas.reduce((t, c) => t + Number(c.valor_total) * Number(c.tipo_cambio), 0))}</b> total</span><span class="ta-total"><b>Q ${fmt.monto(vivas.reduce((t, c) => t + Number(c.iva) * Number(c.tipo_cambio), 0))}</b> IVA</span><span class="ta-total sin"><b>Q ${fmt.monto(vivas.reduce((t, c) => t + Number(c.pendiente) * Number(c.tipo_cambio), 0))}</b> saldo</span></div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Compra, documento, proveedor, NIT, contraseña…" value="${esc(buscar)}" aria-label="Buscar compras"></label>
        </header>
        <div class="ta-tabla">
          <table>
            <thead><tr><th>Compra</th><th>Tipo</th><th>Documento</th><th>Fecha</th><th>Presentación</th><th>Proveedor</th><th>NIT</th><th class="num">Total</th><th class="num">IVA</th><th class="num">Saldo</th><th>Contraseña</th><th>Estado</th></tr></thead>
            <tbody>${filas.map((c) => `<tr class="${actual && actual.id === c.id ? 'actual' : ''} ${c.estado === 'ANULADA' ? 'pc-anulada' : ''}" data-compra="${c.id}" tabindex="0">
              <td class="fuerte">${c.numero}</td><td><span class="pc-tipo">${esc((c.tipo_dte || c.tipo_documento).replace('FACTURA ', 'F. '))}</span></td><td>${esc(docTxt(c))}</td><td>${esc(fmt.fechaDia(c.fecha_documento))}</td>
              <td>${c.mes_presentacion ? `${MESES[c.mes_presentacion - 1].slice(0, 3)} ${c.anio_presentacion}` : '<span class="tk-tenue">—</span>'}</td>
              <td class="ta-desc" title="${esc(c.proveedor_nombre)}">${esc(c.proveedor_nombre)}</td><td>${esc(c.nit || '')}</td>
              <td class="num">${esc(simbolo(c.moneda_id))} ${fmt.monto(c.valor_total)}</td><td class="num">${fmt.monto(c.iva)}</td><td class="num fuerte">${fmt.monto(c.pendiente)}</td>
              <td>${c.contrasena ? esc(String(c.contrasena)) : '<span class="tk-tenue">—</span>'}</td><td>${marca(ESTADO_PAGO(c))}</td></tr>`).join('')
              || `<tr><td colspan="12" class="tk-vacio"><i class="ti ti-file-invoice" aria-hidden="true"></i>${compras.length ? 'Ninguna compra coincide con la búsqueda.' : 'No hay compras con esos filtros.'}</td></tr>`}</tbody>
          </table>
        </div>`;
    }

    async function abrir(c, editar = false) {
      actual = c;
      modificando = !!c && editar && c.estado === 'ACTIVA' && ctx.admin;
      items = []; lineas = []; pagos = []; articulos = []; ingresoVincular = null;
      if (c) {
        const ar = await sb.from('compra_articulos').select('*').eq('compra_id', c.id).order('linea');
        articulos = ar.error ? [] : (ar.data || []).map((x) => ({ ...x, cantidad: Number(x.cantidad), costo_unitario: Number(x.costo_unitario), descuento: Number(x.descuento), costo_extra: Number(x.costo_extra) }));
        const [i, l, d] = await Promise.all([
          sb.from('compra_items').select('*').eq('compra_id', c.id).order('linea'),
          sb.from('compra_lineas').select('*').eq('compra_id', c.id).order('linea'),
          sb.from('movimiento_documentos').select('abono, abono_compra, movimientos_bancarios(tipo, numero_documento, folio, fecha, estado, moneda_id, cuenta_bancaria_id, deposito_por)').eq('compra_id', c.id)
        ]);
        items = (i.data || []).map((x) => ({ descripcion: x.descripcion, cantidad: Number(x.cantidad), costo_total: Number(x.costo_total) }));
        lineas = (l.data || []).map((x) => ({ cuenta_id: x.cuenta_id, codigo: contable(x.cuenta_id)?.codigo || '', centro_id: x.centro_id, debe: Number(x.debe), haber: Number(x.haber) }));
        pagos = d.data || [];
      }
      await cargarCuentasProv(c?.proveedor_id);
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-compra]').forEach((tr) => tr.classList.toggle('actual', !!c && tr.dataset.compra === String(c.id)));
    }
    async function cargarCuentasProv(id) {
      cuentasProv = [];
      if (!id) return;
      const { data } = await sb.from('proveedor_cuentas').select('*').eq('proveedor_id', id).order('linea');
      cuentasProv = data || [];
    }

    const nuevoValor = () => {
      const base = ctx.monedaBase();
      const hoy = fmt.hoy();
      return { tipo_documento_id: (tiposDoc.find((x) => x.nombre === 'FACTURA ELECTRÓNICA') || tiposDoc.find((x) => x.activo))?.id || null, mes_presentacion: Number(hoy.slice(5, 7)), anio_presentacion: Number(hoy.slice(0, 4)), pago_inmediato: false, dias_credito: 0, serie: '', documento: '', fecha_documento: hoy, fecha_ingreso: hoy, fecha_vencimiento: hoy,
        factura_original: true, proveedor_id: null, proveedor_codigo: '', proveedor_nombre: '', nit: '', beneficiario: '', tipo_tercero: 'PROVEEDOR PRODUCTOS', regimen_isr_id: null, clasificacion_id: (clasificaciones.find((x) => x.nombre === 'BIENES') || clasificaciones.find((x) => x.activo))?.id || null, tipo_operacion: 'NO DEFINIDO', rubro_id: null, bodega_id: null, descripcion: '',
        moneda_id: base?.id, tipo_cambio: base?.cambio || 1, valor_total: '', bonificaciones: 0, notas_credito: 0, descuentos_nd: 0,
        galones_super: 0, galones_regular: 0, galones_diesel: 0, exento: 0, no_deducible: 0, iva_especial: 0, isr_especial: 0, aplica_inguat: false, inguat: 0, turismo_itp: 0, iva_importacion: 0, dai: 0, valor_cuenta_ajena: 0,
        retencion: false, retencion_formulario: '', retencion_valor: 0, retencion_fecha: '', forma_pago: 'CHEQUE', cuenta_bancaria_id: null, banco_destino_id: null, cuenta_destino: '', cuenta_pagar_id: null, transaccion_id: null, compra_inventario: '', orden_compra: '' };
    };

    // Mismo cálculo que calcular_compra (servidor).
    function calcular(v) {
      const n = (k) => Number(v[k] || 0);
      const idp = fmt.redondear(n('galones_super') * Number(params.idp_super || 0) + n('galones_regular') * Number(params.idp_regular || 0) + n('galones_diesel') * Number(params.idp_diesel || 0));
      const inguat = v.aplica_inguat ? n('inguat') : 0;
      const afecto = fmt.redondear(n('valor_total') - n('exento') - idp - inguat - n('turismo_itp') - n('no_deducible') - n('dai') - n('valor_cuenta_ajena') - n('iva_importacion'));
      const pct = Number(params.impuesto1 || 12);
      // Igual que el servidor: el tipo de documento dice cómo va el IVA y la clasificación si aplica.
      const calculo = tipoDoc(v.tipo_documento_id)?.calculo_iva || 'NORMAL';
      const aplica = clasificacion(v.clasificacion_id)?.aplica_iva !== false;
      const iva = calculo === 'IMPORTACIÓN' ? n('iva_importacion') : calculo === 'SIN IVA' || !aplica || afecto <= 0 ? 0 : fmt.redondear(afecto * pct / (100 + pct));
      const base = calculo === 'IMPORTACIÓN' || calculo === 'SIN IVA' || !aplica ? afecto : fmt.redondear(afecto - iva);
      const neto = fmt.redondear(n('valor_total') - n('bonificaciones') - n('notas_credito') - n('descuentos_nd'));
      return { idp, afecto, iva, base, neto };
    }

    const tabs = (bienes) => bienes ? [
      ['ARTICULOS', 'Artículos', 'ti-package', articulos.length], ['LISTADO', 'Listado de facturas', 'ti-list-search', compras.length], ['LIQUIDAR', 'Abonos', 'ti-receipt-refund', pagos.length],
      ['CONTABLE', 'Contabilidad', 'ti-list-details', lineas.length], ['OTRAS', 'Otras funciones, integración', 'ti-plug-connected', 0], ['ORDENES', 'Órdenes de compra', 'ti-clipboard-list', 0]
    ] : [
      ['ITEMS', 'Compras varias', 'ti-list', items.length], ['CONTABLE', 'Detalle contable', 'ti-list-details', lineas.length], ['LIQUIDAR', 'Doctos. a liquidar', 'ti-receipt-refund', pagos.length],
      ['OTRAS', 'Otras funciones, integración', 'ti-plug-connected', 0], ['ORDENES', 'Órdenes de compra', 'ti-clipboard-list', 0], ['LISTADO', 'Listado de compras', 'ti-list-search', compras.length]
    ];

    function pintarDetalle(v0) {
      const c = actual;
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-file-invoice'); pintarBarra(null, {}, null, false, false); return; }
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const v = v0 || (c ? { ...c } : nuevoValor());
      const td = tipoDoc(v.tipo_documento_id);
      const cl = clasificacion(v.clasificacion_id);
      const k = calcular(v);
      const sim = simbolo(v.moneda_id);
      const pagado = c ? Number(c.pagado) : 0;
      const consulta = c && !modificando;
      const p = proveedor(v.proveedor_id);
      const disC = ed && !c?.partida_id ? '' : 'disabled';
      const num = (name, etq, extra = '', step = '0.01') => `<label class="campo ${extra}"><span>${etq}</span><input type="number" step="${step}" min="0" name="${name}" value="${esc(String(v[name] ?? 0))}" ${dis}></label>`;
      const cxp = contable(v.cuenta_pagar_id);
      const bienes = esBienes(v);
      if (bienes && pestana === 'ITEMS') pestana = 'ARTICULOS';
      if (!bienes && pestana === 'ARTICULOS') pestana = 'ITEMS';
      const mi = tasaMI();
      const cambio = aBase(v.moneda_id, v.tipo_cambio);
      const totArt = fmt.redondear(articulos.reduce((t, a) => t + totalArt(a), 0));
      const hayInv = articulos.some((a) => a.inventariado && !a.ingreso_linea_id);
      const pendInv = articulos.some((a) => a.inventario && !a.inventariado && !a.ingreso_linea_id);
      ctx.pDet.innerHTML = `
        <form id="cf-form" class="tk-form ta-form bm-form cf-form cl-clasico cf-compacto" novalidate>
          <p class="modal-error tk-error" role="alert"></p>
          ${c?.estado === 'ANULADA' ? `<p class="tk-aviso bm-anulado"><i class="ti ti-ban" aria-hidden="true"></i> Anulada por ${esc(c.anulado_por || '')} · ${esc(fmt.fechaHora(c.anulado_en))}: ${esc(c.motivo_anulacion || '')}</p>` : ''}

          <div class="cf-cabecera">
            <section class="bs-tipo cf-doc">
              <div class="cfx cfx6">
                <label class="campo cfx3" title="${td ? (td.calculo_iva === 'NORMAL' ? 'IVA incluido en el total' : td.calculo_iva === 'SIN IVA' ? 'Sin IVA' : 'IVA de importación') : ''}${td?.es_recibo ? ' · recibo' : ''}"><span>Tipo de documento <em class="cf-pista">${td ? (td.calculo_iva === 'NORMAL' ? '· IVA incluido' : td.calculo_iva === 'SIN IVA' ? '· sin IVA' : '· IVA importación') : ''}</em></span><select name="tipo_documento_id" ${dis}>${tiposDoc.filter((t) => t.activo || t.id === v.tipo_documento_id).map((t) => `<option value="${t.id}" ${t.id === v.tipo_documento_id ? 'selected' : ''}>${t.codigo} · ${esc(t.nombre)}</option>`).join('')}</select></label>
                <label class="campo cfx2"><span>Presentación</span><select name="mes_presentacion" ${dis}>${MESES.map((m, i) => `<option value="${i + 1}" ${Number(v.mes_presentacion) === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
                <label class="campo"><span>Año</span><input type="number" name="anio_presentacion" min="1900" max="2999" value="${esc(String(v.anio_presentacion || ''))}" ${dis}></label>
                <div class="campo cf-numero"><span>Compra</span><b>${c ? c.numero : 'Auto'}</b></div>
                <div class="campo cf-inv" title="Ingreso de la orden de compra que se convierte en esta compra"><span>Compra inv.</span><div class="lov-campo"><input name="compra_inventario" value="${esc(v.compra_inventario || '')}" maxlength="30" readonly placeholder="—" aria-label="Compra de inventario"><button type="button" class="icono-boton lov-btn" data-accion="lov-ingresos" title="Ingresos que aún no se han convertido en compra (${ingresosLibres.length})" aria-label="Ingresos sin compra" ${dis}><i class="ti ti-dots" aria-hidden="true"></i></button></div></div>
                <label class="campo"><span># Serie</span><input name="serie" value="${esc(v.serie || '')}" maxlength="20" ${dis}></label>
                <label class="campo"><span># Documento *</span><input name="documento" value="${esc(v.documento || '')}" maxlength="40" ${dis}></label>
                <label class="campo cfx2"><span>Fecha *</span><input type="date" name="fecha_documento" value="${esc(v.fecha_documento || '')}" ${dis}></label>
                <label class="campo cfx2"><span>Días de crédito</span><select name="dias_credito" ${dis || (v.pago_inmediato ? 'disabled' : '')}>${[...new Set([...DIAS, Number(v.dias_credito) || 0])].sort((a, b) => a - b).map((d) => `<option value="${d}" ${Number(v.dias_credito) === d ? 'selected' : ''}>${d ? `${d} DÍAS` : 'INMEDIATO'}</option>`).join('')}</select></label>
                <label class="campo cfx2"><span>Fecha de pago</span><input type="date" name="fecha_vencimiento" value="${esc(v.fecha_vencimiento || '')}" ${dis}></label>
                <div class="cf-checks cfx2"><label class="pc-check"><input type="checkbox" name="pago_inmediato" ${v.pago_inmediato ? 'checked' : ''} ${dis}> Pago inmediato</label><label class="pc-check" title="Factura original recibida"><input type="checkbox" name="factura_original" ${v.factura_original ? 'checked' : ''} ${dis}> Original recibida</label></div>
              </div>
            </section>
            <section class="bm-bloque cf-prov">
              <div class="cfx cfx4">
                <label class="campo cfx3"><span>Proveedor * <em class="cf-pista">código, NIT o nombre</em></span><input list="cf-proveedores" name="proveedor" value="${esc(p ? provTxt(p) : v.proveedor_nombre ? [v.proveedor_codigo, v.proveedor_nombre, v.nit].filter(Boolean).join(' · ') : '')}" placeholder="Escribe para buscar en el catálogo" ${dis}></label>
                <label class="campo"><span>Bodega</span><select name="bodega_id" ${dis}><option value="">—</option>${bodegas.filter((b) => b.estado === 'ACTIVO' || b.id === v.bodega_id).map((b) => `<option value="${b.id}" ${b.id === v.bodega_id ? 'selected' : ''}>${b.codigo} · ${esc(b.nombre)}</option>`).join('')}</select></label>
                <label class="campo cfx2"><span>Régimen ISR</span><select name="regimen_isr_id" ${dis}><option value="">—</option>${regimenes.map((r) => `<option value="${r.id}" ${r.id === v.regimen_isr_id ? 'selected' : ''}>${r.codigo} · ${esc(r.nombre)}</option>`).join('')}</select></label>
                <label class="campo cfx2" title="${cl ? `${cl.aplica_iva ? 'Aplica IVA' : 'No aplica IVA'} · ${cl.libro_compras ? 'libro de compras' : 'fuera del libro'}` : ''}"><span>Clasificación <em class="cf-pista">${cl ? (cl.aplica_iva ? '· aplica IVA' : '· sin IVA') : ''}</em></span><select name="clasificacion_id" ${dis}>${clasificaciones.filter((x) => x.activo || x.id === v.clasificacion_id).map((x) => `<option value="${x.id}" ${x.id === v.clasificacion_id ? 'selected' : ''}>${x.codigo} · ${esc(x.nombre)}</option>`).join('')}</select></label>
                <label class="campo"><span>Tipo de operación</span><select name="tipo_operacion" ${dis}>${OPERACIONES.map((x) => `<option ${v.tipo_operacion === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
                <label class="campo"><span>Rubro</span><select name="rubro_id" ${dis}><option value="">—</option>${rubros.filter((r) => r.activo || r.id === v.rubro_id).map((r) => `<option value="${r.id}" ${r.id === v.rubro_id ? 'selected' : ''}>${r.codigo} · ${esc(r.nombre)}</option>`).join('')}</select></label>
                <label class="campo cfx2"><span>Descripción</span><input name="descripcion" value="${esc(v.descripcion || '')}" maxlength="300" ${dis}></label>
              </div>
            </section>
            <section class="cf-totales">
              <div class="cfx cfx2">
                <label class="campo"><span>Moneda</span><select name="moneda_id" ${dis}>${ctx.monedas.map((m) => `<option value="${m.id}" ${v.moneda_id === m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
                <label class="campo"><span>Cambio</span><input type="number" step="any" min="0" name="tipo_cambio" value="${esc(String(v.tipo_cambio ?? 1))}" ${dis}></label>
              </div>
              <dl class="cf-cifras">
                <div><dt>Descuentos</dt><dd><input type="number" step="0.01" min="0" name="bonificaciones" value="${esc(String(v.bonificaciones ?? 0))}" ${dis} aria-label="Descuentos"></dd></div>
                <div><dt>Subtotal (detalle)</dt><dd data-calc="subtotal">${fmt.monto(subtotal())}</dd></div>
                <div class="cf-total"><dt>Total *</dt><dd><input type="number" step="0.01" min="0" name="valor_total" value="${esc(String(v.valor_total ?? ''))}" ${dis} aria-label="Total"></dd></div>
                <div><dt>Base</dt><dd data-calc="base">${fmt.monto(k.base)}</dd></div>
                <div class="cf-iva"><dt>IVA</dt><dd data-calc="iva">${fmt.monto(k.iva)}</dd></div>
                <div class="cf-saldo"><dt>Saldo</dt><dd data-calc="saldo">${esc(sim)} ${fmt.monto(k.neto - pagado)}</dd></div>
              </dl>
            </section>
            <section class="bm-bloque cf-fiscal">
              <div class="cfx cfx8">
                <span class="cf-tit cfx-fila"><i class="ti ti-receipt-tax" aria-hidden="true"></i> Desglose fiscal</span>
                ${num('galones_super', 'Súper (gal)', '', '0.001')}${num('galones_regular', 'Regular (gal)', '', '0.001')}${num('galones_diesel', 'Diésel (gal)', '', '0.001')}
                <div class="cc-calc"><span>IDP</span><b data-calc="idp">${fmt.monto(k.idp)}</b></div>
                ${num('exento', 'Exento')}${num('no_deducible', 'G. N. D.')}
                ${num('iva_especial', 'IVA especial')}${num('isr_especial', 'ISR especial')}
                <div class="campo cf-inguat"><label class="pc-check"><input type="checkbox" name="aplica_inguat" ${v.aplica_inguat ? 'checked' : ''} ${dis}> INGUAT</label><input type="number" step="0.01" min="0" name="inguat" value="${esc(String(v.inguat ?? 0))}" ${dis || (v.aplica_inguat ? '' : 'disabled')} aria-label="INGUAT"></div>
                ${num('turismo_itp', 'Turismo ITP')}${num('valor_cuenta_ajena', 'Cta. ajena')}
                ${num('iva_importacion', 'IVA importación')}${num('dai', 'DAI (arancel)')}
                <div class="cc-calc cfx2 ${k.afecto < 0 ? 'cc-mal' : ''}" data-calc-caja="afecto"><span>Afecto a IVA</span><b data-calc="afecto">${fmt.monto(k.afecto)}</b></div>
              </div>
            </section>
            <section class="bm-bloque cf-ret">
              <div class="cfx cfx2">
                <span class="cf-tit cfx-fila"><i class="ti ti-receipt-2" aria-hidden="true"></i> Retención <label class="pc-check cf-ret-chk"><input type="checkbox" name="retencion" ${v.retencion ? 'checked' : ''} ${dis}> ¿Retención?</label></span>
                <label class="campo cfx2"><span># Formulario</span><input name="retencion_formulario" value="${esc(v.retencion_formulario || '')}" maxlength="30" ${dis || (v.retencion ? '' : 'disabled')}></label>
                <label class="campo"><span>Valor</span><input type="number" step="0.01" min="0" name="retencion_valor" value="${esc(String(v.retencion_valor ?? 0))}" ${dis || (v.retencion ? '' : 'disabled')}></label>
                <label class="campo"><span>Fecha</span><input type="date" name="retencion_fecha" value="${esc(v.retencion_fecha || '')}" ${dis || (v.retencion ? '' : 'disabled')}></label>
              </div>
            </section>
          </div>

          <section class="bm-pestanas">
            <div class="bm-tabs-barra">
              <div class="rp-pestanas" role="tablist">${tabs(bienes).map(([id, t, i, n]) => `<button type="button" role="tab" data-pestana="${id}" class="${pestana === id ? 'activa' : ''}" aria-selected="${pestana === id}"><i class="ti ${i}" aria-hidden="true"></i> ${t}${n ? ` <b>${n}</b>` : ''}</button>`).join('')}</div>
              <span data-cuadre></span>
            </div>
            <div class="bm-panel" data-panel="ITEMS" ${pestana === 'ITEMS' ? '' : 'hidden'}>
              <div class="pc-lineas"><table><thead><tr><th class="pc-n">Correlativo</th><th>Descripción</th><th class="num">Cantidad</th><th class="num">Costo unitario</th><th class="num">Costo total</th><th></th></tr></thead>
                <tbody>${items.map((it, i) => `<tr data-item="${i}"><td class="pc-n">${i + 1}</td><td><input data-i="descripcion" value="${esc(it.descripcion || '')}" maxlength="200" ${dis} aria-label="Descripción"></td>
                  <td class="num"><input type="number" step="0.001" min="0" data-i="cantidad" value="${it.cantidad ?? 1}" ${dis} aria-label="Cantidad"></td><td class="num cf-unit" data-unit>${it.cantidad ? fmt.monto(Number(it.costo_total || 0) / Number(it.cantidad)) : ''}</td>
                  <td class="num"><input type="number" step="0.01" min="0" data-i="costo_total" value="${it.costo_total || ''}" ${dis} aria-label="Costo total"></td>
                  <td>${dis ? '' : `<button type="button" class="icono-boton" data-quitar-item="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>`}</td></tr>`).join('')
                  || `<tr><td colspan="6" class="tk-vacio">${ed ? 'Agrega el detalle de lo comprado con «Línea».' : 'La compra no tiene detalle.'}</td></tr>`}</tbody>
                <tfoot><tr><td colspan="4">Total del detalle ${items.length && Number(v.valor_total) && Math.abs(subtotal() - Number(v.valor_total) + Number(v.bonificaciones || 0)) > 0.009 ? '<span class="pc-cuadre no"><i class="ti ti-alert-triangle" aria-hidden="true"></i> No coincide con el total menos descuentos</span>' : ''}</td><td class="num" data-calc="subtotal2">${fmt.monto(subtotal())}</td><td></td></tr></tfoot></table></div>
              ${ed ? '<div class="cf-acc"><button type="button" class="boton secundario-sm" data-accion="item"><i class="ti ti-plus" aria-hidden="true"></i> Línea</button><button type="button" class="boton secundario-sm" data-accion="total-detalle" ' + (items.length ? '' : 'disabled') + '><i class="ti ti-equal" aria-hidden="true"></i> Usar el detalle como total</button></div>' : ''}
            </div>
            <div class="bm-panel cf-articulos" data-panel="ARTICULOS" ${pestana === 'ARTICULOS' ? '' : 'hidden'}>
              <div class="pc-lineas"><table><thead><tr><th class="pc-n">ID</th><th>Código producto</th><th>Nombre producto</th><th>Serie</th><th class="num">Cantidad</th><th class="num">Costo unitario</th><th class="num">Descuento</th><th class="num">Costo total</th><th class="num">C/U MI</th><th class="num">Costo total MI</th><th class="cc-det" title="Va a inventario">Inv?</th><th class="cc-det" title="Exento">Exen?</th><th></th></tr></thead>
                <tbody>${articulos.map((a, i) => { const pd = prod(a.producto_id); const fijo = a.inventariado; const d2 = ed && !fijo ? '' : 'disabled'; const tq = totalArt(a) * cambio; return `<tr data-art="${i}" class="${fijo ? 'cf-inventariado' : ''}">
                  <td class="pc-n">${a.linea || i + 1}</td><td class="fuerte">${esc(pd?.codigo_producto || String(pd?.codigo || ''))}</td><td class="cc-nombre" title="${esc(pd?.nombre || '')}">${esc(pd?.nombre || '')}${a.ingreso_linea_id ? ' <i class="ti ti-truck-delivery cf-del-ingreso" title="Viene del ingreso de la orden" aria-label="Del ingreso"></i>' : ''}</td>
                  <td><input data-a="serie" value="${esc(a.serie || '')}" maxlength="40" ${ed ? '' : 'disabled'} aria-label="Serie"></td>
                  <td class="num"><input type="number" step="0.0001" min="0" data-a="cantidad" value="${a.cantidad || ''}" ${d2} aria-label="Cantidad"></td>
                  <td class="num"><input type="number" step="0.0001" min="0" data-a="costo_unitario" value="${a.costo_unitario || ''}" ${ed ? '' : 'disabled'} aria-label="Costo unitario"></td>
                  <td class="num"><input type="number" step="0.0001" min="0" data-a="descuento" value="${a.descuento || ''}" ${ed ? '' : 'disabled'} aria-label="Descuento"></td>
                  <td class="num fuerte" data-at>${fmt.monto(totalArt(a))}${a.costo_extra ? `<small class="cf-extra" title="Incluye ${fmt.monto(a.costo_extra)} de costos extra">+extra</small>` : ''}</td>
                  <td class="num">${fmt.monto(Number(a.costo_unitario || 0) * cambio / mi)}</td><td class="num" data-atm>${fmt.monto(tq / mi)}</td>
                  <td class="cc-det"><input type="checkbox" data-a="inventario" ${a.inventario ? 'checked' : ''} ${d2} aria-label="Va a inventario"></td>
                  <td class="cc-det"><input type="checkbox" data-a="exento" ${a.exento ? 'checked' : ''} ${ed ? '' : 'disabled'} aria-label="Exento"></td>
                  <td>${ed && !fijo ? `<button type="button" class="icono-boton" data-quitar-art="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`; }).join('')
                  || `<tr><td colspan="13" class="tk-vacio">${ed ? 'Agrega los artículos, elige la compra de inventario arriba o carga el detalle desde Excel.' : 'La compra no tiene artículos.'}</td></tr>`}</tbody>
                <tfoot><tr><td colspan="3">${articulos.length} total productos</td><td colspan="4" class="num">Total</td><td class="num" data-tart>${esc(sim)} ${fmt.monto(totArt)}</td><td></td><td class="num" data-tartm>$ ${fmt.monto(totArt * cambio / mi)}</td><td colspan="3"></td></tr></tfoot></table></div>
              <div class="cf-art-acc">
                ${ed ? '<input list="cf-productos" data-agregar-art placeholder="Agregar artículo (código o nombre)…" aria-label="Agregar artículo">' : ''}
                ${consulta && ctx.admin && c.estado === 'ACTIVA' ? `<button type="button" class="boton secundario-sm" data-accion="cargar-inv" ${pendInv ? '' : 'disabled'} title="Carga a la bodega los artículos marcados en Inv?"><i class="ti ti-package-import" aria-hidden="true"></i> Cargar inventario</button>
                  <button type="button" class="boton secundario-sm" data-accion="revertir-inv" ${hayInv ? '' : 'disabled'}><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Revertir carga</button>
                  <button type="button" class="boton secundario-sm rp-peligro" data-accion="anular" ${pagado || hayInv ? 'disabled' : ''}><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>` : ''}
                ${c ? '<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>' : ''}
                ${ed ? `<button type="button" class="boton secundario-sm" data-accion="costos-extra" ${articulos.length ? '' : 'disabled'} title="Prorratea fletes, seguros u otros costos entre los artículos"><i class="ti ti-truck" aria-hidden="true"></i> Costos extras</button>
                  <button type="button" class="boton secundario-sm" data-accion="crear-producto"><i class="ti ti-plus" aria-hidden="true"></i> Crear producto</button>
                  <label class="boton secundario-sm" title="Archivo CSV de Excel: código; cantidad; costo unitario; serie; descuento"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Cargar detalle Excel<input type="file" accept=".csv,.txt,text/csv" data-excel hidden></label>
                  <button type="button" class="boton secundario-sm" data-accion="total-articulos" ${articulos.length ? '' : 'disabled'}><i class="ti ti-equal" aria-hidden="true"></i> Usar como total</button>` : ''}
              </div>
            </div>
            <div class="bm-panel" data-panel="CONTABLE" ${pestana === 'CONTABLE' ? '' : 'hidden'}>
              <div class="bm-transaccion bc-transaccion">
                <label class="campo"><span>Transacción</span><select name="transaccion_id" ${dis}><option value="">Sin transacción (cuentas del proveedor)</option>${transacciones.filter((t) => t.estado === 'ACTIVO' || t.id === v.transaccion_id).map((t) => `<option value="${t.id}" ${t.id === v.transaccion_id ? 'selected' : ''}>${t.numero} · ${esc(t.descripcion || '')}</option>`).join('')}</select></label>
                <label class="campo"><span>Cuenta por pagar (proveedor)</span><input list="cf-cuentas" name="cuenta_pagar" value="${esc(cxp ? cxp.codigo : '')}" placeholder="Si se deja vacía, la cuenta al haber" ${dis}><small class="bc-cxp" data-cxp>${cxp ? esc(cxp.nombre) : ''}</small></label>
                ${!disC ? '<button type="button" class="boton secundario-sm" data-accion="contabilizar"><i class="ti ti-calculator" aria-hidden="true"></i> Contabilizar</button><button type="button" class="boton secundario-sm" data-accion="linea"><i class="ti ti-plus" aria-hidden="true"></i> Línea</button>' : ''}
              </div>
              <div class="pc-lineas"><table><thead><tr><th class="pc-n">Línea</th><th class="pc-cta">Cuenta</th><th>Nombre de la cuenta</th><th class="num">Debe</th><th class="num">Haber</th><th class="bm-centro">Centro</th><th>Nombre del centro</th><th></th></tr></thead>
                <tbody>${lineas.map((l, i) => filaLinea(l, i, disC)).join('') || '<tr><td colspan="8" class="tk-vacio">Presiona «Contabilizar»: usa la transacción o, sin ella, la cuenta de gastos del proveedor, el IVA y la cuenta por pagar.</td></tr>'}</tbody>
                <tfoot><tr><td colspan="3">Totales</td><td class="num" data-total="debe"></td><td class="num" data-total="haber"></td><td colspan="3"></td></tr></tfoot></table></div>
            </div>
            <div class="bm-panel" data-panel="LIQUIDAR" ${pestana === 'LIQUIDAR' ? '' : 'hidden'}>
              <div class="cf-liquidar">
                <div class="cf-g cf-g4">
                  ${num('notas_credito', 'Notas de crédito')}${num('descuentos_nd', 'Descuentos ND')}
                  <div class="cc-calc"><span>Neto a pagar</span><b data-calc="neto">${esc(sim)} ${fmt.monto(k.neto)}</b></div>
                  <div class="cc-calc"><span>Pagado</span><b>${esc(sim)} ${fmt.monto(pagado)}</b></div>
                </div>
                <div class="pc-lineas"><table><thead><tr><th>Tipo</th><th>Número</th><th>Fecha</th><th>Cuenta</th><th>A favor de</th><th>Estado</th><th class="num">Abono</th><th class="num">Abono en la compra</th></tr></thead>
                  <tbody>${pagos.map((d) => { const m = d.movimientos_bancarios || {}; const cb = cuentas.find((x) => x.id === m.cuenta_bancaria_id); return `<tr class="${m.estado === 'ANULADO' ? 'pc-anulada' : ''}"><td>${m.tipo === 'CHEQUE' ? 'Cheque' : 'Transferencia'}</td><td class="fuerte">${esc(m.numero_documento || m.folio)}</td><td>${esc(fmt.fechaDia(m.fecha))}</td><td>${esc(cb ? cb.numero : '')}</td><td>${esc(m.deposito_por || '')}</td><td>${esc(m.estado || '')}</td><td class="num">${esc(simbolo(m.moneda_id))} ${fmt.monto(d.abono)}</td><td class="num">${esc(sim)} ${fmt.monto(d.abono_compra)}</td></tr>`; }).join('')
                    || '<tr><td colspan="8" class="tk-vacio">Sin pagos todavía: se paga en Caja y Bancos › Generación cheques o Generación transferencias.</td></tr>'}</tbody></table></div>
              </div>
            </div>
            <div class="bm-panel" data-panel="OTRAS" ${pestana === 'OTRAS' ? '' : 'hidden'}>
              <div class="cf-otras">
                <div class="cf-g cf-g4">
                  <div class="campo cf-c2"><span>Forma de pago</span><div class="cc-radios">${[['CHEQUE', 'Cheque'], ['TRANSFERENCIA', 'Transferencia']].map(([x, t]) => `<label class="pc-check"><input type="radio" name="forma_pago" value="${x}" ${v.forma_pago === x ? 'checked' : ''} ${dis}> ${t}</label>`).join('')}</div></div>
                  <label class="campo cf-c2"><span>A favor de (beneficiario)</span><input name="beneficiario" value="${esc(v.beneficiario || '')}" maxlength="150" placeholder="Si se deja vacío, el proveedor" ${dis}></label>
                  <label class="campo cf-c2"><span>Cuenta bancaria de pago</span><select name="cuenta_bancaria_id" ${dis}><option value="">La que se elija al generar</option>${cuentas.filter((x) => x.activo || x.id === v.cuenta_bancaria_id).map((x) => `<option value="${x.id}" ${x.id === v.cuenta_bancaria_id ? 'selected' : ''}>${esc(ctx.nombreCuentaBancaria(x))}</option>`).join('')}</select></label>
                  <label class="campo"><span>Banco del proveedor</span><select name="banco_destino_id" ${dis}><option value="">—</option>${ctx.bancos.filter((b) => b.activo || b.id === v.banco_destino_id).map((b) => `<option value="${b.id}" ${b.id === v.banco_destino_id ? 'selected' : ''}>${esc(b.siglas || b.nombre)}</option>`).join('')}</select></label>
                  <label class="campo"><span>Cuenta del proveedor</span><input name="cuenta_destino" value="${esc(v.cuenta_destino || '')}" maxlength="40" ${dis}></label>
                </div>
                <div class="cf-integracion">
                  <div class="cc-calc"><span>Partida</span><b>${c?.partida_id ? 'Generada' : 'Pendiente'}</b></div>
                  <div class="cc-calc"><span>Pagos</span><b>${esc(c?.ultimo_pago || '—')}</b></div>
                  <div class="cc-calc"><span>Ingresó</span><b>${esc(c ? `${c.usuario || ''} · ${fmt.fechaHora(c.creado_en)}` : (yo.usuario || '').toUpperCase())}</b></div>
                  ${consulta && ctx.admin && c.estado === 'ACTIVA' && !c.partida_id ? '<button type="button" class="boton secundario-sm" data-accion="partida"><i class="ti ti-file-check" aria-hidden="true"></i> Generar partida</button>' : ''}
                  ${consulta && ctx.admin && c.estado === 'ACTIVA' && Number(c.pendiente) > 0 ? `<a class="boton secundario-sm" href="#/caja-bancos/${c.forma_pago === 'CHEQUE' ? 'generacion-cheques' : 'generacion-transferencias'}"><i class="ti ${c.forma_pago === 'CHEQUE' ? 'ti-files' : 'ti-arrows-exchange'}" aria-hidden="true"></i> Pagar</a>` : ''}
                  ${consulta && ctx.admin && c.estado === 'ACTIVA' && !pagado ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="anular"><i class="ti ti-ban" aria-hidden="true"></i> Anular compra</button>' : ''}
                </div>
              </div>
            </div>
            <div class="bm-panel" data-panel="ORDENES" ${pestana === 'ORDENES' ? '' : 'hidden'}>
              <div class="cf-g cf-g4 cf-ordenes">
                <label class="campo"><span>Orden de compra</span><input name="orden_compra" value="${esc(v.orden_compra || '')}" maxlength="30" ${dis}></label>
                <p class="cc-ingreso cf-c3"><i class="ti ti-info-circle" aria-hidden="true"></i> La compra de inventario (ingreso de la orden) se elige arriba, con su lista de valores: trae el proveedor, el documento y los artículos ya recibidos en la bodega.</p>
              </div>
            </div>
            <div class="bm-panel bm-listado" data-panel="LISTADO" ${pestana === 'LISTADO' ? '' : 'hidden'}></div>
          </section>
          <datalist id="cf-proveedores">${proveedores.filter((x) => x.estado === 'ACTIVO').map((x) => `<option value="${esc(provTxt(x))}"></option>`).join('')}</datalist>
          <datalist id="cf-productos">${productos.filter((x) => x.estado === 'ACTIVO').map((x) => `<option value="${esc(prodTxt(x))}"></option>`).join('')}</datalist>
          <datalist id="cf-cuentas">${contables.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('')}</datalist>
          <datalist id="cf-centros">${centros.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('')}</datalist>
        </form>`;
      ctx.pDet.querySelector('[data-panel=LISTADO]').appendChild(ctx.pMae);
      pintarBarra(c, v, td, ed, consulta);
      totalizar();
    }

    // Barra de arriba: qué compra es, su estado y contraseña, y sus botones (ocupan el lugar del título).
    function pintarBarra(c, v, td, ed, consulta) {
      const b = ctx.pFil.querySelector('[data-barra]');
      if (!b) return;
      if (!c && !ed) { b.innerHTML = ''; return; }
      b.innerHTML = `
        <div class="cf-quien">${c ? `<small>Compra ${c.numero} · ${esc(td?.nombre || c.tipo_dte || '')} ${esc(docTxt(c))}</small><b title="${esc(v.proveedor_nombre || '')}">${esc(v.proveedor_nombre || '')}</b>` : '<small>Nueva compra</small><b>Elige el proveedor</b>'}</div>
        <div class="cf-marcas">${c ? marca(ESTADO_PAGO(c)) : ''}${c?.partida_id ? '<span class="pc-marca definitiva" title="Contabilizada"><i class="ti ti-check" aria-hidden="true"></i> Partida</span>' : ''}${modificando ? '<span class="pc-marca pendiente"><i class="ti ti-pencil" aria-hidden="true"></i> Modificando</span>' : ''}
          ${c?.contrasena ? `<span class="cf-contra" title="Contraseña de pago ${c.contrasena} · ${esc(fmt.fechaDia(c.contrasena_fecha))}"><i class="ti ti-key" aria-hidden="true"></i> <b>${c.contrasena}</b><a class="icono-boton" href="#/compras/contrasenas-pago" title="Abrir en Contraseñas de pago" aria-label="Abrir en Contraseñas de pago"><i class="ti ti-external-link" aria-hidden="true"></i></a><button type="button" class="icono-boton" data-accion="imprimir-contrasena" title="Imprimir contraseña" aria-label="Imprimir contraseña"><i class="ti ti-printer" aria-hidden="true"></i></button></span>`
            : c && consulta && ctx.admin && c.estado === 'ACTIVA' ? '<button type="button" class="boton secundario-sm" data-accion="contrasena" title="Crear la contraseña de pago"><i class="ti ti-key" aria-hidden="true"></i> Contraseña</button>' : ''}</div>
        <div class="cf-botones">
          ${consulta && ctx.admin ? '<button type="button" class="boton secundario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nueva</button>' : ''}
          ${consulta ? '<button type="button" class="icono-boton cf-imprimir" data-accion="imprimir" title="Imprimir la compra" aria-label="Imprimir la compra"><i class="ti ti-printer" aria-hidden="true"></i></button>' : ''}
          ${consulta && ctx.admin && c.estado === 'ACTIVA' ? '<button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}
          ${modificando || (!c && compras.length) ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}
          ${ed ? `<button type="submit" form="cf-form" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${c ? 'Guardar' : 'Registrar compra'}</button>` : ''}
        </div>`;
    }

    function filaLinea(l, i, dis) {
      const k = contable(l.cuenta_id);
      const cc = centros.find((x) => x.id === l.centro_id);
      return `<tr data-linea="${i}">
        <td class="pc-n">${i + 1}</td>
        <td class="pc-cta"><input list="cf-cuentas" data-campo="cuenta" value="${esc(k ? k.codigo : l.codigo || '')}" ${dis} aria-label="Cuenta"></td>
        <td class="pc-nombre" data-nombre>${k ? esc(k.nombre) : ''}</td>
        <td class="num"><input type="number" step="0.01" min="0" data-campo="debe" value="${l.debe || ''}" ${dis} aria-label="Debe"></td>
        <td class="num"><input type="number" step="0.01" min="0" data-campo="haber" value="${l.haber || ''}" ${dis} aria-label="Haber"></td>
        <td class="bm-centro"><input list="cf-centros" data-campo="centro" value="${esc(cc ? cc.codigo : l.centro_codigo || '')}" ${dis} aria-label="Centro de costo"></td>
        <td class="pc-nombre" data-nombre-centro>${cc ? esc(cc.nombre) : ''}</td>
        <td>${dis ? '' : `<button type="button" class="icono-boton" data-quitar-linea="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>`}</td></tr>`;
    }
    function leerFilas() {
      ctx.pDet.querySelectorAll('tr[data-linea]').forEach((tr) => {
        const l = lineas[Number(tr.dataset.linea)];
        const cod = tr.querySelector('[data-campo=cuenta]').value.trim();
        const k = porCodigo(cod);
        l.cuenta_id = k ? k.id : null; l.codigo = cod;
        tr.querySelector('[data-nombre]').innerHTML = k ? esc(k.nombre) : cod ? '<span class="pc-error">No es una cuenta de movimiento de la localidad</span>' : '';
        const codC = tr.querySelector('[data-campo=centro]').value.trim();
        const cc = centros.find((x) => x.codigo === codC && x.movimiento);
        l.centro_id = cc ? cc.id : null; l.centro_codigo = codC;
        tr.querySelector('[data-nombre-centro]').innerHTML = cc ? esc(cc.nombre) : codC ? '<span class="pc-error">No es un centro de movimiento</span>' : '';
        l.debe = fmt.redondear(tr.querySelector('[data-campo=debe]').value);
        l.haber = fmt.redondear(tr.querySelector('[data-campo=haber]').value);
      });
      ctx.pDet.querySelectorAll('tr[data-art]').forEach((tr) => {
        const a = articulos[Number(tr.dataset.art)];
        tr.querySelectorAll('[data-a]').forEach((el) => { a[el.dataset.a] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) || 0 : el.value; });
      });
      ctx.pDet.querySelectorAll('tr[data-item]').forEach((tr) => {
        const it = items[Number(tr.dataset.item)];
        it.descripcion = tr.querySelector('[data-i=descripcion]').value.trim();
        it.cantidad = Number(tr.querySelector('[data-i=cantidad]').value) || 0;
        it.costo_total = fmt.redondear(tr.querySelector('[data-i=costo_total]').value);
        tr.querySelector('[data-unit]').textContent = it.cantidad ? fmt.monto(it.costo_total / it.cantidad) : '';
      });
    }
    function totalizar() {
      const d = fmt.redondear(lineas.reduce((s, l) => s + Number(l.debe || 0), 0));
      const h = fmt.redondear(lineas.reduce((s, l) => s + Number(l.haber || 0), 0));
      const td = ctx.pDet.querySelector('[data-total=debe]');
      if (!td) return;
      td.textContent = fmt.monto(d);
      ctx.pDet.querySelector('[data-total=haber]').textContent = fmt.monto(h);
      ctx.pDet.querySelector('[data-cuadre]').innerHTML = pestana !== 'CONTABLE' || !lineas.length ? '' : d === h && d > 0 ? '<span class="pc-cuadre ok"><i class="ti ti-circle-check" aria-hidden="true"></i> Cuadra</span>' : `<span class="pc-cuadre no"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Diferencia ${fmt.monto(Math.abs(d - h))}</span>`;
    }

    function leer(form) {
      const el = form.elements;
      const t = (n) => el[n].value.trim() || null;
      const n = (x) => fmt.redondear(el[x].value);
      const id = (x) => el[x].value ? Number(el[x].value) : null;
      const cxp = porCodigo(el.cuenta_pagar.value);
      const p = proveedorDe(el.proveedor.value);
      const v0 = actual || {};
      return {
        tipo_documento_id: Number(el.tipo_documento_id.value) || null, mes_presentacion: Number(el.mes_presentacion.value), anio_presentacion: Number(el.anio_presentacion.value) || null,
        serie: t('serie'), documento: el.documento.value.trim(), fecha_documento: el.fecha_documento.value, fecha_vencimiento: el.fecha_vencimiento.value || null,
        pago_inmediato: el.pago_inmediato.checked, dias_credito: el.pago_inmediato.checked ? 0 : Number(el.dias_credito.value) || 0, factura_original: el.factura_original.checked,
        proveedor_id: p ? p.id : (v0.proveedor_id && el.proveedor.value.trim() === [v0.proveedor_codigo, v0.proveedor_nombre, v0.nit].filter(Boolean).join(' · ') ? v0.proveedor_id : null),
        proveedor_codigo: p ? String(p.codigo) : v0.proveedor_codigo || null, proveedor_nombre: p ? p.nombre_fiscal || p.nombre_comercial : v0.proveedor_nombre || '', nit: p ? p.nit : v0.nit || null,
        _prov: el.proveedor.value.trim(),
        regimen_isr_id: id('regimen_isr_id'), clasificacion_id: Number(el.clasificacion_id.value) || null, tipo_operacion: el.tipo_operacion.value, bodega_id: id('bodega_id'), rubro_id: id('rubro_id'), descripcion: t('descripcion'),
        moneda_id: Number(el.moneda_id.value), tipo_cambio: Number(el.tipo_cambio.value) || 1, valor_total: n('valor_total'), bonificaciones: n('bonificaciones'), notas_credito: n('notas_credito'), descuentos_nd: n('descuentos_nd'),
        galones_super: Number(el.galones_super.value) || 0, galones_regular: Number(el.galones_regular.value) || 0, galones_diesel: Number(el.galones_diesel.value) || 0,
        exento: n('exento'), no_deducible: n('no_deducible'), iva_especial: n('iva_especial'), isr_especial: n('isr_especial'), aplica_inguat: el.aplica_inguat.checked, inguat: el.aplica_inguat.checked ? n('inguat') : 0,
        turismo_itp: n('turismo_itp'), iva_importacion: n('iva_importacion'), dai: n('dai'), valor_cuenta_ajena: n('valor_cuenta_ajena'),
        retencion: el.retencion.checked, retencion_formulario: el.retencion.checked ? t('retencion_formulario') : null, retencion_valor: el.retencion.checked ? n('retencion_valor') : 0, retencion_fecha: el.retencion.checked ? el.retencion_fecha.value || null : null,
        forma_pago: form.querySelector('[name=forma_pago]:checked')?.value || 'CHEQUE', beneficiario: t('beneficiario'), cuenta_bancaria_id: id('cuenta_bancaria_id'), banco_destino_id: id('banco_destino_id'), cuenta_destino: t('cuenta_destino'),
        transaccion_id: id('transaccion_id'), cuenta_pagar_id: cxp ? cxp.id : null, _cxp: el.cuenta_pagar.value.trim(),
        orden_compra: t('orden_compra'), compra_inventario: t('compra_inventario'),
        tipo_tercero: p ? (/SERVICIO/.test(p.concepto_gastos || '') ? 'PROVEEDOR SERVICIOS' : 'PROVEEDOR PRODUCTOS') : v0.tipo_tercero || 'PROVEEDOR PRODUCTOS'
      };
    }
    // El proveedor escrito: la opción de la lista, o un código, NIT o nombre exacto.
    function proveedorDe(texto) {
      const t = String(texto || '').trim().toUpperCase();
      if (!t) return null;
      return proveedores.find((p) => provTxt(p).toUpperCase() === t) || proveedores.find((p) => String(p.codigo) === t || (p.nit && p.nit === t.replace(/\s/g, '')) || p.nombre_comercial === t) || null;
    }

    // Al elegir el proveedor se traen sus datos (régimen, crédito, pago, bodega y transacción).
    async function aplicarProveedor(form) {
      const p = proveedorDe(form.elements.proveedor.value);
      if (!p) { if (form.elements.proveedor.value.trim()) form.querySelector('.modal-error').textContent = 'Ese proveedor no está en el catálogo: créalo en Compras › Catálogos › Proveedores.'; return; }
      leerFilas();
      const v = { ...(actual || {}), ...leer(form) };
      v.proveedor_id = p.id; v.proveedor_codigo = String(p.codigo); v.proveedor_nombre = p.nombre_fiscal || p.nombre_comercial; v.nit = p.nit;
      v.regimen_isr_id = p.regimen_isr_id || v.regimen_isr_id; v.bodega_id = p.bodega_id || v.bodega_id; v.transaccion_id = p.transaccion_id || v.transaccion_id;
      v.dias_credito = p.dias_credito; v.pago_inmediato = !p.dias_credito; v.fecha_vencimiento = sumaDias(v.fecha_documento, p.dias_credito);
      v.forma_pago = p.forma_pago; v.banco_destino_id = p.banco_id; v.cuenta_destino = p.cuenta_bancaria; v.beneficiario = p.beneficiario;
      v.retencion = p.efectuar_retencion || v.retencion;
      if (p.moneda_id) { v.moneda_id = p.moneda_id; v.tipo_cambio = ctx.moneda(p.moneda_id)?.cambio || 1; }
      if (!p.nacional && v.tipo_operacion === 'NO DEFINIDO') v.tipo_operacion = 'IMPORTACIÓN';
      v.tipo_tercero = /SERVICIO/.test(p.concepto_gastos || '') ? 'PROVEEDOR SERVICIOS' : 'PROVEEDOR PRODUCTOS';
      await cargarCuentasProv(p.id);
      delete v._cxp; delete v._prov;
      pintarDetalle(v);
      const dup = compras.find((c) => c.id !== actual?.id && c.estado === 'ACTIVA' && c.proveedor_id === p.id && c.documento === (v.documento || '').toUpperCase() && (c.serie || '') === (v.serie || '').toUpperCase());
      if (dup) ctx.pDet.querySelector('.modal-error').textContent = `Ese documento del proveedor ya está registrado en la compra ${dup.numero}.`;
    }

    function actualizar(form) {
      const v = leer(form);
      const k = calcular(v);
      const sim = simbolo(v.moneda_id);
      const pon = (x, val, s = false) => { const b = form.querySelector(`[data-calc=${x}]`); if (b) b.textContent = `${s ? `${sim} ` : ''}${fmt.monto(val)}`; };
      pon('idp', k.idp); pon('iva', k.iva); pon('base', k.base); pon('afecto', k.afecto); pon('neto', k.neto, true); pon('saldo', k.neto - (actual ? Number(actual.pagado) : 0), true);
      pon('subtotal', subtotal()); pon('subtotal2', subtotal());
      form.querySelector('[data-calc-caja=afecto]')?.classList.toggle('cc-mal', k.afecto < 0);
      if (!editable()) return;
      form.elements.inguat.disabled = !v.aplica_inguat;
      ['retencion_formulario', 'retencion_valor', 'retencion_fecha'].forEach((x) => { form.elements[x].disabled = !v.retencion; });
      form.elements.dias_credito.disabled = v.pago_inmediato;
    }

    // Detalle contable: con la transacción (TOTAL, SUBTOTAL e IMPUESTO) o, sin ella, con las cuentas
    // del proveedor (gasto o varias cuentas), el IVA por cobrar y la cuenta por pagar.
    async function contabilizar() {
      const form = ctx.pDet.querySelector('.cf-form');
      const error = form.querySelector('.modal-error');
      leerFilas();
      const v = leer(form);
      if (!v.valor_total) { error.textContent = 'Escribe el total de la compra.'; return; }
      const k = calcular(v);
      const cambio = v.tipo_cambio;
      const total = fmt.redondear(v.valor_total * cambio);
      const iva = fmt.redondear(k.iva * cambio);
      const ret = fmt.redondear(v.retencion_valor * cambio);
      const subtotalQ = fmt.redondear(total - iva);
      let aviso = '';
      if (v.transaccion_id) {
        const { data } = await sb.from('transaccion_cuentas').select('*').eq('transaccion_id', v.transaccion_id).order('orden').order('linea');
        if (!data?.length) { error.textContent = 'La transacción no tiene cuentas: defínelas en Objetos contables · Transacciones.'; return; }
        const monto = (op) => op === 'TOTAL' ? total : op === 'SUBTOTAL' ? subtotalQ : op === 'IMPUESTO' ? iva : 0;
        lineas = data.map((t) => { const c = contable(t.cuenta_id); const m = monto(t.operacion); return { cuenta_id: c && c.movimiento ? c.id : null, codigo: c ? c.codigo : '', centro_id: t.centro_id || null, debe: t.naturaleza === 'D' ? m : 0, haber: t.naturaleza === 'H' ? m : 0 }; });
      } else {
        const p = proveedor(v.proveedor_id);
        const gasto = p?.cuenta_gasto_id ? contable(p.cuenta_gasto_id) : null;
        const ivaCta = contables.find((x) => x.movimiento && /IVA/i.test(x.nombre) && /(COBRAR|CR[EÉ]DITO)/i.test(x.nombre)) || contables.find((x) => x.movimiento && /IVA/i.test(x.nombre));
        const pagar = contable(v.cuenta_pagar_id) || contables.find((x) => x.movimiento && /PROVEEDOR/i.test(x.nombre));
        if (!gasto && !(p?.varias_cuentas && cuentasProv.length)) { error.textContent = 'El proveedor no tiene cuenta de gastos: elige una transacción o define la cuenta en el catálogo de proveedores.'; return; }
        if (iva && !ivaCta) { error.textContent = 'No hay una cuenta de IVA en el catálogo: elige una transacción.'; return; }
        if (!pagar) { error.textContent = 'Escribe la cuenta por pagar del proveedor.'; return; }
        const nuevas = [];
        if (p?.varias_cuentas && cuentasProv.length) {
          const conPct = cuentasProv.some((x) => x.porcentaje);
          let resto = subtotalQ;
          cuentasProv.forEach((x, i) => {
            const m = i === cuentasProv.length - 1 ? resto : fmt.redondear(subtotalQ * (conPct ? Number(x.porcentaje || 0) / 100 : 1 / cuentasProv.length));
            resto = fmt.redondear(resto - m);
            nuevas.push({ cuenta_id: x.cuenta_id, codigo: contable(x.cuenta_id)?.codigo || '', centro_id: x.centro_id, debe: m, haber: 0 });
          });
        } else nuevas.push({ cuenta_id: gasto.id, codigo: gasto.codigo, centro_id: null, debe: subtotalQ, haber: 0 });
        if (iva) nuevas.push({ cuenta_id: ivaCta.id, codigo: ivaCta.codigo, centro_id: null, debe: iva, haber: 0 });
        nuevas.push({ cuenta_id: pagar.id, codigo: pagar.codigo, centro_id: null, debe: 0, haber: fmt.redondear(total - ret) });
        if (ret) {
          const retCta = contables.find((x) => x.movimiento && /RETENCI/i.test(x.nombre));
          if (!retCta) { aviso = 'No hay una cuenta de retenciones en el catálogo: la retención quedó en la cuenta por pagar; ajústala con «Línea».'; nuevas[nuevas.length - 1].haber = total; }
          else nuevas.push({ cuenta_id: retCta.id, codigo: retCta.codigo, centro_id: null, debe: 0, haber: ret });
        }
        lineas = nuevas;
      }
      pestana = 'CONTABLE';
      const val = { ...(actual || {}), ...v }; delete val._cxp; delete val._prov;
      pintarDetalle(val);
      if (aviso) ctx.pDet.querySelector('.modal-error').textContent = aviso;
      window.FIN.aviso('Detalle contable armado');
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      leerFilas();
      const v = leer(form);
      const foco = (n, txt) => { error.textContent = txt; form.elements[n]?.focus(); };
      if (!v.proveedor_nombre || (v._prov && !v.proveedor_id && !actual?.proveedor_nombre)) return foco('proveedor', 'Elige el proveedor del catálogo.');
      if (!v.documento) return foco('documento', 'Escribe el número del documento.');
      if (!v.fecha_documento) return foco('fecha_documento', 'Escribe la fecha del documento.');
      if (!(v.valor_total > 0)) return foco('valor_total', 'Escribe el total de la compra.');
      const k = calcular(v);
      if (k.afecto < 0) return foco('exento', 'El exento, IDP, INGUAT, ITP, no deducibles, DAI, IVA de importación y cuenta ajena pasan del total.');
      if (k.neto < 0) return foco('bonificaciones', 'Los descuentos, notas y descuentos ND pasan del total.');
      if (v.retencion && v.retencion_valor > v.valor_total) return foco('retencion_valor', 'La retención pasa del total.');
      if (v._cxp && !v.cuenta_pagar_id) { pestana = 'CONTABLE'; return foco('cuenta_pagar', 'La cuenta por pagar no es una cuenta de movimiento de la localidad.'); }
      if (v.forma_pago === 'TRANSFERENCIA' && !v.cuenta_destino) { pestana = 'OTRAS'; return foco('cuenta_destino', 'Para pagar por transferencia escribe la cuenta bancaria del proveedor.'); }
      if (lineas.some((l) => (l.debe || l.haber || l.codigo) && !l.cuenta_id)) { error.textContent = 'Hay líneas contables con una cuenta que no es de movimiento.'; return; }
      const bienes = esBienes(v);
      if (!bienes && items.some((i) => (i.costo_total || i.cantidad !== 1) && !i.descripcion)) { pestana = 'ITEMS'; error.textContent = 'Escribe la descripción de cada línea del detalle.'; return; }
      const malArt = articulos.find((a) => !(a.cantidad > 0) || a.descuento > a.cantidad * a.costo_unitario);
      if (bienes && malArt) { pestana = 'ARTICULOS'; error.textContent = `Revisa la cantidad y el descuento de ${prod(malArt.producto_id)?.nombre || 'un artículo'}.`; return; }
      if (bienes && articulos.some((a) => a.inventario && !a.inventariado) && !v.bodega_id) return foco('bodega_id', 'Elige la bodega a la que entran los artículos.');
      const ls = lineas.filter((l) => l.cuenta_id && (l.debe || l.haber));
      const its = items.filter((i) => i.descripcion);
      if (!v.cuenta_pagar_id) v.cuenta_pagar_id = ls.find((l) => l.haber)?.cuenta_id || null;
      delete v._cxp; delete v._prov;
      error.textContent = '';
      const boton = document.querySelector('[type=submit][form=cf-form]');
      if (boton) boton.disabled = true;
      try {
        let id = actual?.id;
        if (actual) {
          const r = await sb.from('compras').update(v).eq('id', id);
          if (r.error) throw r.error;
        } else {
          const r = await sb.from('compras').insert({ ...v, fecha_ingreso: fmt.hoy(), organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single();
          if (r.error) throw r.error;
          id = r.data.id;
        }
        if (bienes) await guardarArticulos(id);
        const di = await sb.from('compra_items').delete().eq('compra_id', id);
        if (di.error) throw di.error;
        if (its.length && !bienes) { const r = await sb.from('compra_items').insert(its.map((i, n) => ({ compra_id: id, linea: n + 1, descripcion: i.descripcion, cantidad: i.cantidad || 1, costo_total: i.costo_total || 0 }))); if (r.error) throw r.error; }
        if (!actual?.partida_id) {
          const d = await sb.from('compra_lineas').delete().eq('compra_id', id);
          if (d.error) throw d.error;
          if (ls.length) { const r = await sb.from('compra_lineas').insert(ls.map((l, i) => ({ compra_id: id, linea: i + 1, cuenta_id: l.cuenta_id, centro_id: l.centro_id || null, debe: l.debe || 0, haber: l.haber || 0 }))); if (r.error) throw r.error; }
        }
        if (ingresoVincular) { const r = await sb.rpc('vincular_ingreso_compra', { p_ingreso: ingresoVincular, p_compra: id }); if (r.error) throw r.error; ingresoVincular = null; }
        window.FIN.aviso(actual ? 'Compra guardada' : 'Compra registrada');
        modificando = false;
        if (!actual && (v.fecha_documento < f.desde || v.fecha_documento > f.hasta) && f.estado !== 'POR PAGAR') { f.desde = v.fecha_documento < f.desde ? v.fecha_documento : f.desde; f.hasta = v.fecha_documento > f.hasta ? v.fecha_documento : f.hasta; pintarFiltros(); }
        actual = { id };
        await consultar(id);
      } catch (err) {
        error.textContent = /compras_documento_key/.test(err.message || '') ? 'Ese documento ya está registrado para el proveedor.' : window.UI.traducirError(err);
      } finally { if (boton) boton.disabled = false; }
    }

    // Artículos: los que ya están en inventario se actualizan; los demás se vuelven a grabar.
    async function guardarArticulos(id) {
      const fijos = articulos.filter((a) => a.id && a.inventariado);
      for (const a of fijos) { const r = await sb.from('compra_articulos').update({ serie: a.serie || null, costo_unitario: a.costo_unitario || 0, descuento: a.descuento || 0, costo_extra: a.costo_extra || 0, exento: !!a.exento }).eq('id', a.id); if (r.error) throw r.error; }
      const d = await sb.from('compra_articulos').delete().eq('compra_id', id).eq('inventariado', false);
      if (d.error) throw d.error;
      let n = Math.max(0, ...fijos.map((a) => a.linea || 0));
      const otros = articulos.filter((a) => !(a.id && a.inventariado));
      if (otros.length) { const r = await sb.from('compra_articulos').insert(otros.map((a) => ({ compra_id: id, linea: ++n, producto_id: a.producto_id, serie: a.serie || null, cantidad: a.cantidad, costo_unitario: a.costo_unitario || 0, descuento: a.descuento || 0, costo_extra: a.costo_extra || 0, inventario: !!a.inventario, exento: !!a.exento, ingreso_linea_id: a.ingreso_linea_id || null }))); if (r.error) throw r.error; }
    }
    function agregarArticulo(texto) {
      const t = String(texto || '').trim().toUpperCase();
      const pd = productos.find((p) => prodTxt(p).toUpperCase() === t) || productos.find((p) => (p.codigo_producto || '').toUpperCase() === t || String(p.codigo) === t);
      if (!pd) return window.FIN.aviso('Ese producto no está en el catálogo: créalo con «Crear producto»');
      leerFilas();
      articulos.push({ producto_id: pd.id, serie: '', cantidad: 1, costo_unitario: Number(pd.precio_costo) || 0, descuento: 0, costo_extra: 0, inventario: true, exento: false, inventariado: false });
      repintar();
      const ins = ctx.pDet.querySelectorAll('[data-a=cantidad]'); ins[ins.length - 1]?.select();
    }
    // Lista de valores de los ingresos aplicados que aún no se convirtieron en compra.
    async function elegirIngreso() {
      if (!ingresosLibres.length) return window.FIN.aviso('No hay ingresos de órdenes de compra pendientes de convertir en compra');
      const prov = (id) => proveedores.find((p) => p.id === id)?.nombre_comercial || '';
      const id = await window.LOV({ titulo: 'Ingresos sin compra', columnas: ['Ingreso', 'Orden', 'Proveedor', 'Documento', 'Fecha', 'Valor'],
        filas: ingresosLibres.map((i) => ({ id: i.id, celdas: [i.numero, i.ordenes_compra?.numero || '', prov(i.proveedor_id), [i.serie, i.documento].filter(Boolean).join('-'), fmt.fechaDia(i.fecha_ingreso), fmt.monto(i.ingreso_lineas.reduce((t, l) => t + Number(l.cantidad) * Number(l.costo_unitario), 0) - Number(i.valor_descuento))] })) });
      if (!id) return;
      const i = ingresosLibres.find((x) => x.id === id);
      const form = ctx.pDet.querySelector('.cf-form');
      leerFilas();
      const v = { ...(actual || {}), ...leer(form) };
      const p = proveedores.find((x) => x.id === i.proveedor_id);
      Object.assign(v, { compra_inventario: String(i.numero), proveedor_id: i.proveedor_id, proveedor_codigo: p ? String(p.codigo) : '', proveedor_nombre: p ? p.nombre_fiscal || p.nombre_comercial : '', nit: p?.nit || null,
        serie: i.serie || v.serie, documento: i.documento || v.documento, fecha_documento: i.fecha_documento || i.fecha_ingreso, moneda_id: i.moneda_id, tipo_cambio: aBase(i.moneda_id, i.tipo_cambio), bodega_id: i.bodega_id,
        transaccion_id: i.transaccion_id || v.transaccion_id, dias_credito: i.dias_credito, pago_inmediato: i.forma_pago === 'CONTADO', fecha_vencimiento: sumaDias(i.fecha_documento || i.fecha_ingreso, i.dias_credito),
        orden_compra: i.ordenes_compra?.numero || v.orden_compra, bonificaciones: Number(i.valor_descuento) || 0,
        clasificacion_id: aplicaInv(clasificacion(v.clasificacion_id)) && v.clasificacion_id ? v.clasificacion_id : (clasificaciones.find((x) => x.nombre === 'BIENES' && aplicaInv(x)) || clasificaciones.find((x) => x.activo !== false && aplicaInv(x)))?.id || v.clasificacion_id,
        descripcion: v.descripcion || `COMPRA DEL INGRESO ${i.numero} DE LA ORDEN ${i.ordenes_compra?.numero || ''}` });
      articulos = articulos.filter((a) => !a.ingreso_linea_id).concat(i.ingreso_lineas.map((l) => ({ producto_id: l.producto_id, serie: l.lote || '', cantidad: Number(l.cantidad), costo_unitario: Number(l.costo_unitario), descuento: 0, costo_extra: 0, inventario: true, exento: false, inventariado: false, ingreso_linea_id: l.id })));
      v.valor_total = fmt.redondear(articulos.reduce((t, a) => t + totalArt(a), 0) - (Number(i.valor_descuento) || 0));
      ingresoVincular = i.id;
      await cargarCuentasProv(i.proveedor_id);
      delete v._cxp; delete v._prov;
      pestana = 'ARTICULOS';
      pintarDetalle(v);
      window.FIN.aviso(`Ingreso ${i.numero} cargado: ${i.ingreso_lineas.length} artículo(s) (ya están en la bodega)`);
    }
    function costosExtras() {
      leerFilas();
      const t = prompt('Total de costos extra a prorratear entre los artículos (flete, seguro, aduana…):');
      if (t === null) return;
      const extra = fmt.redondear(t);
      const base = articulos.reduce((s, a) => s + a.cantidad * a.costo_unitario - a.descuento, 0);
      if (!(extra >= 0) || !base) return window.FIN.aviso('Escribe un monto válido');
      let resto = extra;
      articulos.forEach((a, i) => { const m = i === articulos.length - 1 ? resto : fmt.redondear(extra * (a.cantidad * a.costo_unitario - a.descuento) / base); a.costo_extra = m; resto = fmt.redondear(resto - m); });
      repintar();
      window.FIN.aviso(`${fmt.monto(extra)} prorrateados entre ${articulos.length} artículo(s)`);
    }
    async function crearProducto() {
      const id = await window.LOV({ titulo: 'Productos', columnas: ['Código', 'Nombre'], filas: productos.filter((p) => p.estado === 'ACTIVO').map((p) => ({ id: p.id, celdas: [p.codigo_producto || p.codigo, p.nombre] })),
        crear: ctx.admin && { campos: [{ k: 'codigo_producto', t: 'Código producto', max: 40 }, { k: 'nombre', t: 'Nombre', req: true, max: 150 }], guardar: async (d) => { const r = await sb.from('productos').insert({ codigo: 0, nombre: d.nombre, codigo_producto: d.codigo_producto || null, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, bodega_id: actual?.bodega_id || null }).select('id, codigo, codigo_producto, nombre, estado, precio_costo').single(); if (r.error) throw r.error; productos.push(r.data); return r.data.id; } } });
      if (id) agregarArticulo(prodTxt(prod(id)));
    }
    // Detalle desde Excel guardado como CSV: código; cantidad; costo unitario; serie; descuento.
    async function cargarExcel(archivo) {
      const texto = await archivo.text();
      const filas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const sep = (filas[0] || '').includes('\t') ? '\t' : (filas[0] || '').includes(';') ? ';' : ',';
      const num = (x) => Number(String(x ?? '').replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.')) || 0;
      leerFilas();
      let n = 0; const faltan = [];
      filas.forEach((l, k) => {
        const c = l.split(sep).map((x) => x.replace(/^"|"$/g, '').trim());
        const cod = (c[0] || '').toUpperCase();
        if (!cod || (k === 0 && !num(c[1]))) return;
        const pd = productos.find((p) => (p.codigo_producto || '').toUpperCase() === cod || String(p.codigo) === cod);
        if (!pd) { faltan.push(cod); return; }
        articulos.push({ producto_id: pd.id, cantidad: num(c[1]) || 1, costo_unitario: num(c[2]), serie: c[3] || '', descuento: num(c[4]), costo_extra: 0, inventario: true, exento: false, inventariado: false });
        n++;
      });
      repintar();
      window.FIN.aviso(`${n} artículo(s) cargado(s)${faltan.length ? ` · no están en el catálogo: ${faltan.slice(0, 5).join(', ')}${faltan.length > 5 ? '…' : ''}` : ''}`);
    }
    async function inventario(accion) {
      if (!confirm(accion === 'CARGAR' ? `¿Cargar a la bodega los artículos de la compra ${actual.numero}?` : `¿Revertir la carga al inventario de la compra ${actual.numero}?`)) return;
      const { data, error } = await sb.rpc('cargar_inventario_compra', { p_compra: actual.id, p_accion: accion });
      if (error) { const e = ctx.pDet.querySelector('.modal-error'); if (e) e.textContent = window.UI.traducirError(error); return; }
      window.FIN.aviso(`${data.articulos} artículo(s) ${accion === 'CARGAR' ? 'cargado(s) al' : 'revertido(s) del'} inventario`);
      await consultar(actual.id);
    }

    async function procesar(accion) {
      let motivo = null;
      if (accion === 'ANULAR') { motivo = prompt(`Motivo de la anulación de la compra ${actual.numero}:`); if (motivo === null) return; }
      if (accion === 'PARTIDA' && !confirm(`¿Generar la partida de compras de la compra ${actual.numero}?`)) return;
      const { data, error } = await sb.rpc('procesar_compra', { p_id: actual.id, p_accion: accion, p_motivo: motivo });
      if (error) { const e = ctx.pDet.querySelector('.modal-error'); if (e) e.textContent = window.UI.traducirError(error); return; }
      window.FIN.aviso(accion === 'ANULAR' ? 'Compra anulada' : `Partida ${data?.partida || ''} generada`);
      await consultar();
    }
    async function crearContrasena() {
      const { data, error } = await sb.rpc('crear_contrasena_compra', { p_id: actual.id });
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      window.FIN.aviso(`Contraseña de pago ${data} creada`);
      await consultar();
    }

    function imprimirCompra() {
      const c = actual;
      const sim = simbolo(c.moneda_id);
      const emp = ctx.localidad(c.localidad_id);
      const reg = regimenes.find((r) => r.id === c.regimen_isr_id);
      imprimir(`Compra ${c.numero}`, `
        <h1>Compra ${c.numero} · ${esc(c.tipo_dte || c.tipo_documento)} ${esc(docTxt(c))}</h1>
        <h2>${esc(emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '')} · ${esc(ESTADO_PAGO(c))}${c.contrasena ? ` · Contraseña ${c.contrasena}` : ''}</h2>
        <div class="cab">
          <div><b>Proveedor</b>${esc([c.proveedor_codigo, c.proveedor_nombre].filter(Boolean).join(' · '))}</div><div><b>NIT</b>${esc(c.nit || '')}</div><div><b>Fecha</b>${esc(fmt.fechaDia(c.fecha_documento))}</div><div><b>Fecha de pago</b>${esc(fmt.fechaDia(c.fecha_vencimiento))}</div>
          <div><b>Presentación</b>${c.mes_presentacion ? `${MESES[c.mes_presentacion - 1]} ${c.anio_presentacion}` : ''}</div><div><b>Régimen ISR</b>${esc(reg?.nombre || '')}</div><div><b>Clasificación</b>${esc(c.clasificacion)}</div><div><b>Tipo de operación</b>${esc(c.tipo_operacion)}</div>
          <div><b>Total</b>${esc(sim)} ${fmt.monto(c.valor_total)}</div><div><b>Base</b>${fmt.monto(c.base)}</div><div><b>IVA</b>${fmt.monto(c.iva)}</div><div><b>Saldo</b>${fmt.monto(c.pendiente)}</div>
          <div><b>Exento</b>${fmt.monto(c.exento)}</div><div><b>IDP</b>${fmt.monto(c.idp)}</div><div><b>G. N. D.</b>${fmt.monto(c.no_deducible)}</div><div><b>Retención</b>${c.retencion ? `${fmt.monto(c.retencion_valor)} · form. ${esc(c.retencion_formulario || '')}` : 'No'}</div>
          <div style="grid-column:1/-1"><b>Descripción</b>${esc(c.descripcion || '')}</div></div>
        ${articulos.length ? `<h3>Artículos</h3><table><thead><tr><th>#</th><th>Código</th><th>Producto</th><th>Serie</th><th class="n">Cantidad</th><th class="n">Costo unitario</th><th class="n">Descuento</th><th class="n">Costo total</th></tr></thead><tbody>${articulos.map((a, n) => { const pd = prod(a.producto_id); return `<tr><td>${a.linea || n + 1}</td><td>${esc(pd?.codigo_producto || '')}</td><td>${esc(pd?.nombre || '')}</td><td>${esc(a.serie || '')}</td><td class="n">${a.cantidad}</td><td class="n">${fmt.monto(a.costo_unitario)}</td><td class="n">${fmt.monto(a.descuento)}</td><td class="n">${fmt.monto(totalArt(a))}</td></tr>`; }).join('')}</tbody><tfoot><tr><td colspan="7">Total</td><td class="n">${fmt.monto(subtotal())}</td></tr></tfoot></table>` : ''}
        ${items.length && !articulos.length ? `<h3>Detalle de la compra</h3><table><thead><tr><th>#</th><th>Descripción</th><th class="n">Cantidad</th><th class="n">Costo total</th></tr></thead><tbody>${items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.descripcion)}</td><td class="n">${i.cantidad}</td><td class="n">${fmt.monto(i.costo_total)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3">Total</td><td class="n">${fmt.monto(subtotal())}</td></tr></tfoot></table>` : ''}
        ${lineas.length ? `<h3>Detalle contable</h3><table><thead><tr><th>Cuenta</th><th>Nombre</th><th class="n">Debe</th><th class="n">Haber</th></tr></thead><tbody>${lineas.map((l) => { const k = contable(l.cuenta_id); return `<tr><td>${esc(k?.codigo || '')}</td><td>${esc(k?.nombre || '')}</td><td class="n">${l.debe ? fmt.monto(l.debe) : ''}</td><td class="n">${l.haber ? fmt.monto(l.haber) : ''}</td></tr>`; }).join('')}</tbody></table>` : ''}
        <div class="firmas"><div>Elaboró</div><div>Revisó</div><div>Autorizó</div></div>`);
    }
    function imprimirContrasena() {
      const c = actual;
      const emp = ctx.localidad(c.localidad_id);
      imprimir(`Contraseña ${c.contrasena}`, `
        <h1>Contraseña de pago No. ${c.contrasena}</h1>
        <h2>${esc(emp ? emp.nombre_comercial : '')} · Emitida el ${esc(fmt.fechaDia(c.contrasena_fecha))}</h2>
        <div class="cab">
          <div style="grid-column:span 2"><b>Proveedor</b>${esc(c.proveedor_nombre)}</div><div><b>NIT</b>${esc(c.nit || '')}</div><div><b>Compra</b>${c.numero}</div>
          <div><b>Documento</b>${esc(c.tipo_dte || c.tipo_documento)} ${esc(docTxt(c))}</div><div><b>Fecha del documento</b>${esc(fmt.fechaDia(c.fecha_documento))}</div><div><b>Valor</b>${esc(simbolo(c.moneda_id))} ${fmt.monto(c.neto)}</div><div><b>Fecha de pago</b>${esc(fmt.fechaDia(c.fecha_vencimiento))}</div></div>
        <p>Presentar esta contraseña para recibir el pago.</p>
        <div class="firmas"><div>Recibió</div><div>Proveedor</div><div>Sello</div></div>`);
    }

    // ---------- Eventos ----------
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { pintarFiltros(); return cargarLocalidad(); }
      if (cambio === 'otro') {
        f[e.target.name] = e.target.value;
        if (f.hasta < f.desde) { if (e.target.name === 'desde') f.hasta = f.desde; else f.desde = f.hasta; }
        pintarFiltros(); actual = null;
        return consultar();
      }
      const form = e.target.closest('.cf-form');
      if (!form) return;
      const nm = e.target.name;
      if (nm === 'proveedor') return aplicarProveedor(form);
      // Bienes o servicios: el detalle cambia con la clasificación.
      if (nm === 'clasificacion_id' && !articulos.length && esBienes({ clasificacion_id: Number(e.target.value) }) !== !form.querySelector('[data-panel=ITEMS]')) return repintar();
      if (nm === 'moneda_id') form.elements.tipo_cambio.value = ctx.moneda(Number(e.target.value))?.cambio || 1;
      if (nm === 'fecha_documento' || nm === 'dias_credito' || nm === 'pago_inmediato') {
        const dias = form.elements.pago_inmediato.checked ? 0 : Number(form.elements.dias_credito.value) || 0;
        if (form.elements.pago_inmediato.checked) form.elements.dias_credito.value = '0';
        form.elements.fecha_vencimiento.value = sumaDias(form.elements.fecha_documento.value, dias);
        if (nm === 'fecha_documento' && e.target.value && !actual) { form.elements.mes_presentacion.value = String(Number(e.target.value.slice(5, 7))); form.elements.anio_presentacion.value = e.target.value.slice(0, 4); }
      }
      if (nm === 'tipo_documento_id' || nm === 'clasificacion_id') {
        if (nm === 'tipo_documento_id' && tipoDoc(Number(e.target.value))?.calculo_iva === 'IMPORTACIÓN' && form.elements.tipo_operacion.value === 'NO DEFINIDO') form.elements.tipo_operacion.value = 'IMPORTACIÓN';
        return repintar();
      }
      if (nm === 'cuenta_pagar') {
        const k = porCodigo(e.target.value);
        form.querySelector('[data-cxp]').innerHTML = k ? esc(k.nombre) : e.target.value.trim() ? '<span class="pc-error">No es una cuenta de movimiento</span>' : '';
      }
      if (e.target.matches('[data-agregar-art]')) { const t = e.target.value; e.target.value = ''; return agregarArticulo(t); }
      if (e.target.matches('[data-excel]')) { const a = e.target.files[0]; e.target.value = ''; if (a) cargarExcel(a); return; }
      if (e.target.closest('tr[data-art]') && e.target.type === 'checkbox') { leerFilas(); return; }
      if (e.target.closest('tr[data-linea], tr[data-item]')) { leerFilas(); totalizar(); }
      actualizar(form);
    });
    // Totales de los artículos mientras se escribe.
    function totalesArticulos() {
      const form = ctx.pDet.querySelector('.cf-form');
      const sim = simbolo(Number(form.elements.moneda_id.value));
      const cambio = aBase(form.elements.moneda_id.value, form.elements.tipo_cambio.value);
      const mi = tasaMI();
      ctx.pDet.querySelectorAll('tr[data-art]').forEach((tr) => { const a = articulos[Number(tr.dataset.art)]; tr.querySelector('[data-at]').firstChild.textContent = fmt.monto(totalArt(a)); tr.querySelector('[data-atm]').textContent = fmt.monto(totalArt(a) * cambio / mi); });
      const tot = articulos.reduce((t, a) => t + totalArt(a), 0);
      ctx.pDet.querySelector('[data-tart]').textContent = `${sim} ${fmt.monto(tot)}`;
      ctx.pDet.querySelector('[data-tartm]').textContent = `$ ${fmt.monto(tot * cambio / mi)}`;
      const st = form.querySelector('[data-calc=subtotal]'); if (st) st.textContent = fmt.monto(tot);
    }
    cont.addEventListener('input', (e) => {
      if (e.target.closest('tr[data-art]') && e.target.type === 'number') { leerFilas(); return totalesArticulos(); }
      if (e.target.matches('[data-buscar]')) {
        buscar = e.target.value;
        const pos = e.target.selectionStart;
        pintarMaestro();
        const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
        return;
      }
      const form = e.target.closest('.cf-form');
      if (!form || e.target.type !== 'number') return;
      if (e.target.closest('tr[data-linea], tr[data-item]')) { leerFilas(); totalizar(); }
      actualizar(form);
    });
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-buscar]')) e.preventDefault();
      if (e.key === 'Enter' && e.target.matches('[data-agregar-art]')) { e.preventDefault(); const t = e.target.value; e.target.value = ''; agregarArticulo(t); }
    });
    cont.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-pestana]');
      if (tab) {
        pestana = tab.dataset.pestana;
        ctx.pDet.querySelectorAll('[data-pestana]').forEach((b) => { b.classList.toggle('activa', b === tab); b.setAttribute('aria-selected', b === tab); });
        ctx.pDet.querySelectorAll('[data-panel]').forEach((x) => { x.hidden = x.dataset.panel !== pestana; });
        totalizar();
        return;
      }
      const fila = e.target.closest('tr[data-compra]');
      if (fila) { pestana = 'ITEMS'; return abrir(compras.find((c) => String(c.id) === fila.dataset.compra)); }
      const qa = e.target.closest('[data-quitar-art]');
      if (qa) { leerFilas(); articulos.splice(Number(qa.dataset.quitarArt), 1); return repintar(); }
      const ql = e.target.closest('[data-quitar-linea]');
      if (ql) { leerFilas(); lineas.splice(Number(ql.dataset.quitarLinea), 1); return repintar(); }
      const qi = e.target.closest('[data-quitar-item]');
      if (qi) { leerFilas(); items.splice(Number(qi.dataset.quitarItem), 1); return repintar(); }
      const ac = e.target.closest('[data-accion]');
      if (!ac) return;
      const a = ac.dataset.accion;
      if (a === 'lov-ingresos') return elegirIngreso();
      if (a === 'cargar-inv') return inventario('CARGAR');
      if (a === 'revertir-inv') return inventario('REVERTIR');
      if (a === 'costos-extra') return costosExtras();
      if (a === 'crear-producto') return crearProducto();
      if (a === 'total-articulos') { leerFilas(); const form = ctx.pDet.querySelector('.cf-form'); form.elements.valor_total.value = fmt.redondear(articulos.reduce((t, x) => t + totalArt(x), 0) - Number(form.elements.bonificaciones.value || 0)); return actualizar(form); }
      if (a === 'nuevo') { actual = null; modificando = false; items = []; lineas = []; pagos = []; cuentasProv = []; articulos = []; ingresoVincular = null; pestana = 'ITEMS'; pintarDetalle(); return ctx.pDet.querySelector('[name=proveedor]')?.focus(); }
      if (a === 'modificar') { modificando = true; return repintar(); }
      if (a === 'cancelar') return actual ? abrir(actual) : abrir(compras[0] || null);
      if (a === 'imprimir') return imprimirCompra();
      if (a === 'imprimir-contrasena') return imprimirContrasena();
      if (a === 'contrasena') return crearContrasena();
      if (a === 'contabilizar') return contabilizar();
      if (a === 'linea') { leerFilas(); lineas.push({ cuenta_id: null, codigo: '', centro_id: null, debe: 0, haber: 0 }); return repintar(); }
      if (a === 'item') { leerFilas(); items.push({ descripcion: '', cantidad: 1, costo_total: 0 }); repintar(); const ins = ctx.pDet.querySelectorAll('[data-i=descripcion]'); return ins[ins.length - 1]?.focus(); }
      if (a === 'total-detalle') { leerFilas(); const form = ctx.pDet.querySelector('.cf-form'); form.elements.valor_total.value = fmt.redondear(subtotal() - Number(form.elements.bonificaciones.value || 0)); return actualizar(form); }
      if (a === 'anular') return procesar('ANULAR');
      if (a === 'partida') return procesar('PARTIDA');
    });
    function repintar() {
      const form = ctx.pDet.querySelector('.cf-form');
      if (!form) return;
      leerFilas();
      const v = leer(form);
      delete v._cxp; delete v._prov;
      pintarDetalle({ ...(actual || {}), ...v });
    }
    cont.addEventListener('submit', (e) => { if (e.target.matches('.cf-form')) { e.preventDefault(); guardar(e.target); } });

    iniciar();
  };
})();
