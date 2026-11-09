// Facturación/Ventas · Mantenimientos · Despachos: «Administración de Despachos» y «Despacho de Productos».
//   Arriba los parámetros (fechas —por omisión del primer día del mes a hoy—, cliente y estado del despacho) y las
//   facturas con su modo de entrega, estado y la casilla «Despachar»; abajo el despacho de la factura elegida: datos
//   de la factura y del cliente, dirección de envío y modo de entrega; pestaña Guías (imprimir despacho, aplicar
//   entrega, reporte de salida con mensajero y DPI, reporte de envío, guía en tres tamaños) y pestaña Medicamentos.
//   Reporte del listado en PDF o Excel.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const MODOS = ['RUTA', 'GUATEX', 'OFICINA', 'OTRO'];
  const ESTADOS = [['PENDIENTE', 'Pendientes'], ['DESPACHADO', 'Despachados'], ['ENTREGADO', 'Entregados'], ['', 'Todos']];
  const diaLocal = (t) => t ? new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }) : '';

  window.PANTALLAS.despachos = function (cont) {
    const ctx = montar(cont, { titulo: 'Despachos', icono: 'ti-package-export', clase: 'bk-movimientos bk-consultar cb-apilado bk-consulta-cheques cqc-con-tipo vfc-consulta vd-despachos', grupo: 'Ventas · Mantenimientos' });
    const { sb } = ctx;
    // Por defecto desde el 1 de enero del año anterior: así se ven los despachos pendientes migrados.
    const f = { desde: `${Number(fmt.hoy().slice(0, 4)) - 1}-01-01`, hasta: fmt.hoy(), cliente: '', estado: 'PENDIENTE', formato: 'PDF' };
    let facturas = [], vendedores = [], sel = null, lineas = [], pestana = 'GUIAS', guiaTam = 'COMPLETA', consulta = 0;
    const vendedor = (id) => vendedores.find((v) => v.id === id);
    const fe = (x) => x.no_interno || (x.serie ? `${x.serie}-${x.numero_dte || ''}` : `Interna ${x.numero}`);
    const marcaDesp = (e) => e === 'ENTREGADO' ? ['aprobada', 'Entregado'] : e === 'DESPACHADO' ? ['definitiva', 'Despachado'] : ['pendiente', 'Pendiente'];
    const quien = () => (ctx.yo.usuario || '').toUpperCase();

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo cq-prov"><span>Cliente</span><input name="cliente" value="${esc(f.cliente)}" placeholder="Todos (nombre o código)"></label>
        <label class="campo"><span>Estado despacho</span><select name="estado">${ESTADOS.map(([k, t]) => `<option value="${k}" ${f.estado === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Formato reporte</span><select name="formato">${['PDF', 'EXCEL'].map((x) => `<option ${f.formato === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`,
        `<div class="bmc-reportes"><button type="button" class="boton secundario-sm" data-accion="buscar"><i class="ti ti-refresh" aria-hidden="true"></i><span><b>Buscar / Actualizar</b><small>Con estos parámetros</small></span></button>
         <button type="button" class="boton cqc-excel" data-accion="reporte"><i class="ti ti-file-report" aria-hidden="true"></i><span><b>Generar reporte</b><small>PDF o Excel</small></span></button></div>`);
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('facturas_venta').select('id, estado_despacho').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/estado_despacho/.test(prueba.error.message) ? 'Falta instalar el script 138 (series, correlativos, envíos y despachos) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const v = await sb.from('vendedores').select('id, codigo, nombre').eq('localidad_id', ctx.sel.loc || 0);
      vendedores = v.data || [];
      f.desde = `${Number(fmt.hoy().slice(0, 4)) - 1}-01-01`; f.hasta = fmt.hoy();
      pintarFiltros(); await consultar();
    }
    async function consultar(id = sel?.id) {
      const loc = ctx.sel.loc; if (!loc) { facturas = []; return pintar(); }
      const yo = ++consulta;
      let q = sb.from('facturas_venta').select('*').eq('localidad_id', loc).eq('estado', 'FACTURADA').gte('fecha_emision', `${f.desde}T00:00:00-06:00`).lte('fecha_emision', `${f.hasta}T23:59:59.999-06:00`)
        .order('fecha_emision', { ascending: false }).limit(2000);
      if (f.estado) q = q.eq('estado_despacho', f.estado);
      const r = await q; if (yo !== consulta) return;
      facturas = r.data || [];
      sel = facturas.find((x) => x.id === id) || null;
      pintar();
      if (sel) await elegir(sel);
    }
    const visibles = () => { const c = f.cliente.trim().toLowerCase(); return facturas.filter((x) => !c || [x.nombre, x.cliente_codigo, x.nit].some((v) => String(v ?? '').toLowerCase().includes(c))); };
    async function elegir(x) {
      sel = x; lineas = [];
      if (x) { const { data } = await sb.from('factura_venta_lineas').select('*').eq('factura_id', x.id).order('linea'); if (sel !== x) return; lineas = data || []; }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-factura]').forEach((tr) => tr.classList.toggle('actual', !!x && tr.dataset.factura === String(x.id)));
    }
    function pintar() { pintarMaestro(); pintarDetalle(); }
    function pintarMaestro() {
      const filas = visibles();
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>Administración de despachos <small>${filas.length}</small></h2>
          <div class="ta-totales pc-resumen">
            <span class="ta-total"><b>Q ${fmt.monto(filas.reduce((t, x) => t + Number(x.total || 0), 0))}</b> facturado</span>
            ${['PENDIENTE', 'DESPACHADO', 'ENTREGADO'].map((e) => `<span class="ta-total ${e === 'PENDIENTE' ? 'sin' : ''}"><b>${filas.filter((x) => x.estado_despacho === e).length}</b> ${marcaDesp(e)[1].toLowerCase()}s</span>`).join('')}
          </div>
        </header>
        <div class="ta-tabla cc-tabla">
          <table class="cqc-tabla vd-tabla"><thead><tr><th>No. interno</th><th>Fecha emisión</th><th class="num">Total factura</th><th>Cliente</th><th>Vendedor</th><th>Modo entrega</th><th>Estado</th><th class="vd-chk">Despachar</th><th></th></tr></thead>
            <tbody>${filas.map((x) => { const [c, t] = marcaDesp(x.estado_despacho); const v = vendedor(x.vendedor_id); return `<tr data-factura="${x.id}" class="${sel?.id === x.id ? 'actual' : ''}" tabindex="0">
              <td class="fuerte">${esc(fe(x))}<small class="cq-ant">interno ${x.numero}</small></td><td>${esc(fmt.fechaDia(diaLocal(x.fecha_emision)))}</td><td class="num fuerte">${fmt.monto(x.total)}</td>
              <td class="cqc-quien"><b>${esc(x.nombre)}</b><small>${esc(x.cliente_codigo ?? '')}</small></td><td class="cc-nombre">${esc(v ? v.nombre : '')}</td>
              <td><select data-modo="${x.id}" ${ctx.admin && x.estado_despacho !== 'ENTREGADO' ? '' : 'disabled'}>${MODOS.map((y) => `<option ${x.modo_entrega === y ? 'selected' : ''}>${y}</option>`).join('')}</select></td>
              <td><span class="pc-marca ${c}">${t}</span></td>
              <td class="vd-chk"><input type="checkbox" data-despachar="${x.id}" ${x.estado_despacho !== 'PENDIENTE' ? 'checked' : ''} ${ctx.admin && x.estado_despacho !== 'ENTREGADO' ? '' : 'disabled'} aria-label="Despachar"></td>
              <td><button type="button" class="boton secundario-sm" data-guias="${x.id}"><i class="ti ti-map-pin" aria-hidden="true"></i> Guías y dirección envío</button></td></tr>`; }).join('')
              || `<tr><td colspan="9" class="tk-vacio">${ctx.sel.loc ? 'No hay facturas con estos parámetros.' : 'Elige la empresa.'}</td></tr>`}</tbody></table>
        </div>`;
    }
    function pintarDetalle() {
      const x = sel;
      if (!x) { ctx.pDet.innerHTML = ctx.vacio(ctx.sel.loc ? 'Elige una factura para ver su despacho.' : 'Elige la empresa.', 'ti-package-export'); return; }
      const [c, t] = marcaDesp(x.estado_despacho); const ed = ctx.admin && x.estado_despacho !== 'ENTREGADO';
      ctx.pDet.innerHTML = `
        <form class="tk-form cq-ficha vd-form" novalidate>
          <header class="tk-titulo cb-titulo">
            <span class="tk-icono"><i class="ti ti-package-export" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>Despacho de productos · ${esc(fe(x))} · interno ${x.numero} · DTE ${esc(x.numero_dte || '—')} · emitida ${esc(fmt.fechaHora(x.fecha_emision))}</small><h2>${esc(x.nombre)}</h2></div>
            <dl class="cq-datos"><div><dt>Estado factura</dt><dd><span class="pc-marca aprobada">Facturada</span></dd></div><div><dt>Estado despacho</dt><dd><span class="pc-marca ${c}">${t}</span></dd></div><div><dt>Total</dt><dd>Q ${fmt.monto(x.total)}</dd></div></dl>
            <div class="tk-titulo-acciones"><a class="boton secundario-sm" href="#/facturacion/facturas-ventas/${x.id}"><i class="ti ti-eye" aria-hidden="true"></i> Ver factura</a>${ed ? '<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button>' : ''}</div>
          </header>
          <div class="vd-cuerpo">
            <section class="vfb-card vd-cli">
              <div class="va-g vd-g">
                <label class="campo"><span>Cliente</span><input value="${esc(String(x.cliente_codigo ?? ''))}" disabled></label>
                <label class="campo"><span>Contacto</span><input value="${esc(x.contacto || '')}" disabled></label>
                <label class="campo"><span>Teléfono</span><input value="${esc(x.telefono || '')}" disabled></label>
                <label class="campo"><span>Modo entrega</span><select name="modo_entrega" ${ed ? '' : 'disabled'}>${MODOS.map((y) => `<option ${x.modo_entrega === y ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
                <label class="campo"><span>Correo</span><input value="${esc(x.correo || '')}" disabled></label>
                <label class="campo va-c2"><span>Dirección</span><input value="${esc(x.direccion || '')}" disabled></label>
                <label class="campo va-c2"><span>Dirección de envío</span><input name="direccion_envio" value="${esc(x.direccion_envio || '')}" maxlength="300" ${ed ? '' : 'disabled'}></label>
              </div>
            </section>
            <section class="bm-pestanas vd-tabs">
              <div class="bm-tabs-barra"><div class="rp-pestanas" role="tablist">${[['GUIAS', 'Guías', 'ti-tag'], ['MEDICAMENTOS', 'Medicamentos', 'ti-pill']].map(([k, tt, i]) => `<button type="button" role="tab" data-pestana="${k}" class="${pestana === k ? 'activa' : ''}"><i class="ti ${i}" aria-hidden="true"></i> ${tt}${k === 'MEDICAMENTOS' ? ` <b>${lineas.length}</b>` : ''}</button>`).join('')}</div></div>
              <div class="bm-panel" ${pestana === 'GUIAS' ? '' : 'hidden'}>
                <div class="vf-pr-grid vd-guias">
                  <section class="vf-pr-col">
                    <h3 class="ta-col-titulo"><i class="ti ti-printer" aria-hidden="true"></i> Despacho</h3>
                    <button type="button" class="boton secundario-sm" data-accion="imp-despacho"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir despacho</button>
                    <div class="vf-pr-dato"><span>Usuario imprime</span><b>${esc(x.despacho_impreso_por || '') || '—'}</b></div>
                    <div class="vf-pr-dato"><span>Fecha imprime</span><b>${x.despacho_impreso_en ? esc(fmt.fechaHora(x.despacho_impreso_en)) : '—'}</b></div>
                    <button type="button" class="boton primario-sm" data-accion="entregar" ${ctx.admin && x.estado_despacho !== 'ENTREGADO' ? '' : 'disabled'}><i class="ti ti-circle-check" aria-hidden="true"></i> Aplicar entrega</button>
                    ${x.entregado_en ? `<div class="vf-pr-dato"><span>Entregado</span><b>${esc(x.entregado_por || '')} · ${esc(fmt.fechaHora(x.entregado_en))}</b></div>` : ''}
                  </section>
                  <section class="vf-pr-col">
                    <h3 class="ta-col-titulo"><i class="ti ti-package-export" aria-hidden="true"></i> Reporte de salida</h3>
                    <label class="campo"><span>Mensajero</span><input name="mensajero_nombre" value="${esc(x.mensajero_nombre || '')}" maxlength="100" ${ed ? '' : 'disabled'}></label>
                    <label class="campo"><span>DPI</span><input name="mensajero_dpi" value="${esc(x.mensajero_dpi || '')}" maxlength="20" ${ed ? '' : 'disabled'}></label>
                    <button type="button" class="boton secundario-sm" data-accion="imp-salida"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir rep. salida</button>
                  </section>
                  <section class="vf-pr-col">
                    <h3 class="ta-col-titulo"><i class="ti ti-send" aria-hidden="true"></i> Reporte de envío</h3>
                    <label class="campo"><span>Cliente</span><input name="envio_nombre" value="${esc(x.envio_nombre || x.nombre || '')}" maxlength="150" ${ed ? '' : 'disabled'}></label>
                    <label class="campo"><span>Dirección</span><input name="envio_direccion" value="${esc(x.envio_direccion || x.direccion_envio || x.direccion || '')}" maxlength="300" ${ed ? '' : 'disabled'}></label>
                    <button type="button" class="boton secundario-sm" data-accion="imp-envio"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir rep. envío</button>
                  </section>
                  <section class="vf-pr-col">
                    <h3 class="ta-col-titulo"><i class="ti ti-tag" aria-hidden="true"></i> Guía</h3>
                    <div class="vf-pr-tamanos" role="radiogroup" aria-label="Tamaño de la guía">${[['COMPLETA', 'Completa'], ['MEDIANA', 'Mediana'], ['PEQUEÑA', 'Pequeña']].map(([k, tt]) => `<label><input type="radio" name="guia_tam" value="${k}" ${guiaTam === k ? 'checked' : ''}> ${tt}</label>`).join('')}</div>
                    <button type="button" class="boton secundario-sm" data-accion="imp-guia"><i class="ti ti-tag" aria-hidden="true"></i> Imprimir guía</button>
                  </section>
                </div>
              </div>
              <div class="bm-panel" ${pestana === 'MEDICAMENTOS' ? '' : 'hidden'}>
                <div class="pc-lineas"><table><thead><tr><th class="pc-n">#</th><th>Producto</th><th>Descripción</th><th>Unidad</th><th>Lote</th><th>Registro sanitario</th><th>Vence</th><th class="num">Cantidad</th></tr></thead>
                  <tbody>${lineas.map((l) => `<tr><td class="pc-n">${l.linea}</td><td class="fuerte">${esc(String(l.producto_codigo ?? ''))}</td><td class="cc-nombre">${esc(l.descripcion)}</td><td>${esc(l.unidad_medida || '')}</td><td>${esc(l.lote || '')}</td><td>${esc(l.registro_sanitario || '')}</td><td>${esc(l.fecha_vencimiento ? fmt.fechaDia(l.fecha_vencimiento) : '')}</td><td class="num">${fmt.monto(l.cantidad)}</td></tr>`).join('') || '<tr><td colspan="8" class="tk-vacio">La factura no tiene productos.</td></tr>'}</tbody></table></div>
              </div>
            </section>
          </div>
        </form>`;
    }

    // Cambios del despacho de la factura elegida (y del modo de entrega o la casilla en el listado).
    async function actualizar(id, datos, aviso) {
      const r = await sb.from('facturas_venta').update(datos).eq('id', id);
      if (r.error) { window.FIN.aviso(window.UI.traducirError(r.error)); return false; }
      const { data } = await sb.from('facturas_venta').select('*').eq('id', id).single();
      const i = facturas.findIndex((x) => x.id === id); if (i >= 0 && data) facturas[i] = data;
      if (sel?.id === id) sel = data;
      if (aviso) window.FIN.aviso(aviso);
      pintarMaestro(); pintarDetalle(); return true;
    }
    const camposForm = () => { const el = ctx.pDet.querySelector('.vd-form')?.elements; if (!el || !el.modo_entrega) return {}; const t = (k) => el[k] && !el[k].disabled ? (el[k].value.trim() || null) : undefined;
      return Object.fromEntries(Object.entries({ modo_entrega: el.modo_entrega.disabled ? undefined : el.modo_entrega.value, direccion_envio: t('direccion_envio'), mensajero_nombre: t('mensajero_nombre'), mensajero_dpi: t('mensajero_dpi'), envio_nombre: t('envio_nombre'), envio_direccion: t('envio_direccion') }).filter(([, v]) => v !== undefined)); };

    function repSalida() {
      const x = sel; const d = camposForm();
      imprimir(`Salida ${x.numero}`, `<h1>Reporte de salida · ${esc(fe(x))}</h1><h2>${esc([`Interno: ${x.numero}`, `DTE: ${x.numero_dte || '—'}`, `Emisión: ${fmt.fechaHora(x.fecha_emision)}`, `Cliente: ${x.cliente_codigo ?? ''} · ${x.nombre}`, `Entrega: ${d.modo_entrega || x.modo_entrega || ''}`, `Mensajero: ${d.mensajero_nombre ?? x.mensajero_nombre ?? '—'}`, `DPI: ${d.mensajero_dpi ?? x.mensajero_dpi ?? '—'}`].join(' · '))}</h2>
        <table><thead><tr><th>#</th><th>Producto</th><th>Descripción</th><th>Unidad</th><th>Lote</th><th>Vence</th><th class="n">Cantidad</th></tr></thead><tbody>${lineas.map((l) => `<tr><td>${l.linea}</td><td>${esc(String(l.producto_codigo ?? ''))}</td><td>${esc(l.descripcion)}</td><td>${esc(l.unidad_medida || '')}</td><td>${esc(l.lote || '')}</td><td>${esc(l.fecha_vencimiento ? fmt.fechaDia(l.fecha_vencimiento) : '')}</td><td class="n">${fmt.monto(l.cantidad)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="6">Total de unidades</td><td class="n">${fmt.monto(lineas.reduce((t, l) => t + Number(l.cantidad || 0), 0))}</td></tr></tfoot></table>
        <div class="firmas"><div>Despachó</div><div>Mensajero: ${esc(d.mensajero_nombre ?? x.mensajero_nombre ?? '')}</div><div>Recibió</div></div>`, { locId: x.localidad_id, orgId: x.organizacion_id });
    }
    function repEnvio() {
      const x = sel; const d = camposForm();
      imprimir(`Envío ${x.numero}`, `<h1>Reporte de envío · ${esc(fe(x))}</h1><h2>${esc([`Interno: ${x.numero}`, `Emisión: ${fmt.fechaHora(x.fecha_emision)}`, `Valor: ${fmt.monto(x.total)}`, `Entrega: ${d.modo_entrega || x.modo_entrega || ''}`].join(' · '))}</h2>
        <table><tbody><tr><th>Para</th><td>${esc(d.envio_nombre ?? x.envio_nombre ?? x.nombre)}</td></tr><tr><th>Dirección</th><td>${esc(d.envio_direccion ?? x.envio_direccion ?? x.direccion_envio ?? x.direccion ?? '')}</td></tr><tr><th>Contacto</th><td>${esc([x.contacto, x.telefono].filter(Boolean).join(' · '))}</td></tr></tbody></table>
        <table><thead><tr><th>#</th><th>Descripción</th><th>Lote</th><th class="n">Cantidad</th></tr></thead><tbody>${lineas.map((l) => `<tr><td>${l.linea}</td><td>${esc(l.descripcion)}</td><td>${esc(l.lote || '')}</td><td class="n">${fmt.monto(l.cantidad)}</td></tr>`).join('')}</tbody></table>
        <div class="firmas"><div>Entregó</div><div>Transportista</div><div>Recibió conforme</div></div>`, { locId: x.localidad_id, orgId: x.organizacion_id });
    }
    function guia() {
      const x = sel; const d = camposForm(); const loc = ctx.localidad(x.localidad_id);
      const t = { COMPLETA: { w: '190mm', fs: 22 }, MEDIANA: { w: '140mm', fs: 16 }, 'PEQUEÑA': { w: '95mm', fs: 12 } }[guiaTam];
      imprimir(`Guía ${x.numero}`, `<style>.g{width:${t.w};border:2px solid #111;border-radius:6px;padding:${t.fs * .8}px;font-size:${t.fs}px;line-height:1.35}.g small{display:block;font-size:.55em;letter-spacing:.08em;text-transform:uppercase;color:#555;margin-top:.5em}.g b{display:block}.g .d{font-size:1.25em}.g .p{display:flex;justify-content:space-between;border-top:1px solid #999;margin-top:.8em;padding-top:.4em;font-size:.7em}</style>
        <div class="g"><small>Para</small><b class="d">${esc(d.envio_nombre ?? x.envio_nombre ?? x.nombre)}</b><small>Dirección</small><b>${esc(d.envio_direccion ?? x.envio_direccion ?? x.direccion_envio ?? x.direccion ?? '')}</b>
          ${x.contacto || x.telefono ? `<small>Contacto</small><b>${esc([x.contacto, x.telefono].filter(Boolean).join(' · '))}</b>` : ''}<small>De</small><b>${esc(loc ? `${loc.codigo} · ${loc.nombre_comercial}` : '')}</b>
          <div class="p"><span>Factura ${esc(fe(x))}</span><span>Interno ${x.numero}</span><span>${esc(d.modo_entrega || x.modo_entrega || '')}</span></div></div>`, { sinEncabezado: true });
    }
    async function reporte() {
      const filas = visibles(); if (!filas.length) return window.FIN.aviso('No hay facturas con estos parámetros');
      const emp = ctx.localidad(ctx.sel.loc);
      const par = [`Empresa: ${emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '—'}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, `Cliente: ${f.cliente || 'Todos'}`, `Estado: ${(ESTADOS.find((e) => e[0] === f.estado) || [])[1]}`];
      if (f.formato === 'PDF') {
        imprimir('Administración de Despachos', `<h1>Administración de Despachos</h1><h2>${esc(par.join(' · '))}</h2><table><thead><tr><th>No. interno</th><th>Fecha</th><th class="n">Total</th><th>Cliente</th><th>Vendedor</th><th>Modo entrega</th><th>Estado</th></tr></thead><tbody>
          ${filas.map((x) => `<tr><td>${esc(fe(x))}</td><td>${esc(fmt.fechaDia(diaLocal(x.fecha_emision)))}</td><td class="n">${fmt.monto(x.total)}</td><td>${esc(x.nombre)}</td><td>${esc(vendedor(x.vendedor_id)?.nombre || '')}</td><td>${esc(x.modo_entrega || '')}</td><td>${marcaDesp(x.estado_despacho)[1]}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="2">${filas.length} facturas</td><td class="n">${fmt.monto(filas.reduce((t, x) => t + Number(x.total || 0), 0))}</td><td colspan="4"></td></tr></tfoot></table>`, { locId: ctx.sel.loc, horizontal: true });
        return;
      }
      if (!window.REPORTE_XLSX) return;
      window.REPORTE_XLSX.generar({ titulo: 'Administración de Despachos', parametros: par, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Despachos', archivo: `despachos_${emp?.codigo || ''}_${f.desde}_${f.hasta}`, autofiltro: true,
        columnas: [{ titulo: 'No. interno', ancho: 12 }, { titulo: 'Fecha', ancho: 12 }, { titulo: 'Total', ancho: 15, tipo: 'monto' }, { titulo: 'Cliente', ancho: 46 }, { titulo: 'Vendedor', ancho: 24 }, { titulo: 'Modo entrega', ancho: 13 }, { titulo: 'Estado', ancho: 12 }],
        filas: [...filas.map((x) => ({ valores: [fe(x), fmt.fechaDia(diaLocal(x.fecha_emision)), Number(x.total || 0), x.nombre, vendedor(x.vendedor_id)?.nombre || '', x.modo_entrega || '', marcaDesp(x.estado_despacho)[1]] })), { tipo: 'total', valores: ['', `${filas.length} facturas`, filas.reduce((t, x) => t + Number(x.total || 0), 0), '', '', '', ''] }] });
    }

    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { sel = null; return cargarLocalidad(); }
      const n = e.target.name;
      if (cambio === 'otro' && ['desde', 'hasta', 'estado'].includes(n)) { f[n] = e.target.value; sel = null; return consultar(); }
      if (cambio === 'otro' && n === 'cliente') { f.cliente = e.target.value; return pintarMaestro(); }
      if (cambio === 'otro' && n === 'formato') { f.formato = e.target.value; return; }
      if (n === 'guia_tam') { guiaTam = e.target.value; return; }
      const mo = e.target.closest('[data-modo]'); if (mo) return actualizar(Number(mo.dataset.modo), { modo_entrega: mo.value }, 'Modo de entrega actualizado');
      const de = e.target.closest('[data-despachar]');
      if (de) return actualizar(Number(de.dataset.despachar), de.checked ? { estado_despacho: 'DESPACHADO', despachado_por: quien(), despachado_en: new Date().toISOString() } : { estado_despacho: 'PENDIENTE', despachado_por: null, despachado_en: null }, de.checked ? 'Factura despachada' : 'Despacho revertido');
    });
    cont.addEventListener('click', async (e) => {
      const g = e.target.closest('[data-guias]'); if (g) { pestana = 'GUIAS'; return elegir(facturas.find((x) => String(x.id) === g.dataset.guias)); }
      const tab = e.target.closest('[data-pestana]'); if (tab) { pestana = tab.dataset.pestana; return pintarDetalle(); }
      const tr = e.target.closest('tr[data-factura]'); if (tr && ctx.pMae.contains(tr) && !e.target.closest('select, input, button')) return elegir(facturas.find((x) => String(x.id) === tr.dataset.factura));
      const a = e.target.closest('[data-accion]')?.dataset.accion; if (!a) return;
      if (a === 'buscar') return consultar();
      if (a === 'reporte') return reporte();
      if (!sel) return;
      if (a === 'imp-despacho') { await actualizar(sel.id, { ...camposForm(), despacho_impreso_por: quien(), despacho_impreso_en: new Date().toISOString() }); return repSalida(); }
      if (a === 'imp-salida') return repSalida();
      if (a === 'imp-envio') return repEnvio();
      if (a === 'imp-guia') return guia();
      if (a === 'entregar') { if (!confirm(`¿Aplicar la entrega de ${fe(sel)} a ${sel.nombre}?`)) return; return actualizar(sel.id, { ...camposForm(), estado_despacho: 'ENTREGADO', entregado_por: quien(), entregado_en: new Date().toISOString(), despachado_por: sel.despachado_por || quien(), despachado_en: sel.despachado_en || new Date().toISOString() }, 'Entrega aplicada'); }
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.vd-form')) { e.preventDefault(); if (sel) actualizar(sel.id, camposForm(), 'Despacho guardado'); } });
    iniciar();
  };
})();
