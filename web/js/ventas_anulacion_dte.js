// Facturación/Ventas · Registros · Anulación de documentos DTE (diseño del sistema anterior).
//   Se elige el documento (factura o nota, por su número interno), se revisan sus datos (tipo de documento,
//   autorización, serie, DTE, fechas, valor y valor MI) y el cliente, se escribe el motivo y se anula: el documento
//   queda ANULADO (la factura deja saldo cero y devuelve su inventario; la nota deja de afectar a su factura) y la
//   anulación queda registrada con su número, quién y cuándo. «Duplicar documento» crea una factura nueva igual a la
//   anulada (sin certificar) y la liga como «Factura nueva». Abajo, las anulaciones de la empresa.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  // Columnas de la factura que se copian al duplicarla (las del formulario de Facturas Ventas).
  const COPIAR = ['tipo_factura', 'tipo_dte', 'tipo_documento', 'moneda_id', 'tipo_cambio', 'cliente_id', 'cliente_codigo', 'nombre', 'nit', 'consumidor_final', 'nit_externo', 'contacto', 'telefono', 'correo',
    'direccion', 'direccion_envio', 'lab_fab', 'generico', 'vendedor_id', 'tipo_precio_id', 'bodega_id', 'forma_pago', 'dias_credito', 'contrasena', 'fecha_cobro', 'modo_entrega', 'unificar_productos',
    'exento_iva', 'agente_retenedor', 'pct_retencion_iva', 'retencion_isr', 'monto_retencion_isr', 'clasificacion', 'cuenta_por_cobrar', 'incoterm', 'observaciones'];
  const COPIAR_LINEA = ['linea', 'producto_id', 'producto_codigo', 'descripcion', 'tipo', 'cantidad', 'precio', 'inventario', 'cpa', 'fecha_compromiso', 'unidad_medida', 'lote', 'registro_sanitario', 'fecha_vencimiento', 'fecha_fabricacion'];
  const NOTAS = { 'CRÉDITO': 'notas-de-credito-electronicas', 'DÉBITO': 'notas-de-debito-electronicas', 'ABONO': 'notas-de-abono-electronicas' };

  window.PANTALLAS['anulacion-de-documentos-dte'] = function (cont, m, extra) {
    const ctx = montar(cont, { titulo: 'Anulación de Documentos DTE', icono: 'ti-file-x', clase: 'bk-movimientos bm-solo vf-facturas va-anulacion', grupo: 'Ventas · Registros' });
    const { sb } = ctx;
    let actual = null, doc = null, tipoDoc = 'FACTURA', lista = [], nueva = null, ocupado = false;

    const nombreFac = (f) => f ? (f.serie ? `${f.serie}-${f.numero_dte || ''}` : `Interna ${f.numero}`) : '';
    const interno = (d, t) => d ? (t === 'NOTA' ? `NC-${d.numero}` : `FE-${d.numero}`) : '';
    const sim = (id) => ctx.moneda(id)?.simbolo || 'Q';

    function pintarFiltros() { ctx.filtros('', ''); }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('anulaciones_dte').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/anulaciones_dte/.test(prueba.error.message) ? 'Falta instalar el script 134 (notas electrónicas y anulación de documentos DTE) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      pintarFiltros();
      const mx = /^(factura|nota)-(\d+)$/.exec(String(extra || ''));
      if (mx) { tipoDoc = mx[1] === 'nota' ? 'NOTA' : 'FACTURA'; await buscar(Number(mx[2]), false); }
      else if (/^\d+$/.test(String(extra || ''))) { const { data } = await sb.from('anulaciones_dte').select('*').eq('id', Number(extra)).maybeSingle(); if (data) await verAnulacion(data); }
      await cargarLista();
      pintar();
    }
    async function cargarLista() {
      const { data } = await sb.from('anulaciones_dte').select('*').eq('localidad_id', ctx.sel.loc || 0).order('numero', { ascending: false }).limit(300);
      lista = data || [];
    }
    async function buscar(valor, porNumero = true) {
      const tabla = tipoDoc === 'NOTA' ? 'notas_venta' : 'facturas_venta';
      let q = sb.from(tabla).select('*').eq(porNumero ? 'numero' : 'id', valor);
      if (porNumero) q = q.eq('localidad_id', ctx.sel.loc);
      const { data } = await q.maybeSingle();
      actual = null; nueva = null; doc = data || null;
      if (!doc) { window.FIN.aviso(`No hay ${tipoDoc === 'NOTA' ? 'una nota NC' : 'una factura'}-${valor} en la empresa`); return; }
      if (doc.localidad_id !== ctx.sel.loc) { ctx.sel.loc = doc.localidad_id; ctx.sel.org = doc.organizacion_id; pintarFiltros(); await cargarLista(); }
      // Si ya está anulado, se muestra su anulación.
      const { data: an } = await sb.from('anulaciones_dte').select('*').eq(tipoDoc === 'NOTA' ? 'nota_id' : 'factura_id', doc.id).order('id', { ascending: false }).limit(1);
      if (an?.[0]) await verAnulacion(an[0], doc);
    }
    async function verAnulacion(a, d = null) {
      actual = a; tipoDoc = a.documento;
      if (!d) { const { data } = await sb.from(a.documento === 'NOTA' ? 'notas_venta' : 'facturas_venta').select('*').eq('id', a.documento === 'NOTA' ? a.nota_id : a.factura_id).maybeSingle(); d = data; }
      doc = d;
      nueva = null;
      if (a.factura_nueva_id) { const { data } = await sb.from('facturas_venta').select('id, numero, serie, numero_dte').eq('id', a.factura_nueva_id).maybeSingle(); nueva = data; }
      if (a.localidad_id !== ctx.sel.loc) { ctx.sel.loc = a.localidad_id; ctx.sel.org = a.organizacion_id; pintarFiltros(); await cargarLista(); }
    }

    function pintar() {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-file-x'); return; }
      const d = doc, a = actual;
      const anulado = d && (tipoDoc === 'NOTA' ? d.estado === 'ANULADA' : d.estado === 'ANULADA');
      const valor = d ? Number(tipoDoc === 'NOTA' ? d.valor : d.total) : 0;
      const valorMi = d ? Number(tipoDoc === 'NOTA' ? d.valor_mi : d.total_mi) : 0;
      const puede = ctx.admin && d && !anulado && !ocupado;
      const href = d ? (tipoDoc === 'NOTA' ? `#/facturacion/${NOTAS[d.tipo]}/${d.id}` : `#/facturacion/facturas-ventas/${d.id}`) : '';
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form bm-form vf-form va-form" novalidate>
          <header class="tk-titulo bm-titulo">
            <div class="tk-titulo-texto"><small>Anulación de Documentos DTE · ${esc(ctx.localidad(ctx.sel.loc)?.codigo || '')} ${esc(ctx.localidad(ctx.sel.loc)?.nombre_comercial || '')}</small><h2>${a ? `Anulación ${a.numero}` : 'Nueva anulación'}</h2></div>
            <div class="tk-marcas">${a || anulado ? '<span class="pc-marca anulada">Anulada</span>' : d ? '<span class="pc-marca aprobada">Vigente</span>' : ''}</div>
            <div class="tk-titulo-acciones">
              <button type="button" class="boton secundario-sm" data-accion="limpiar"><i class="ti ti-plus" aria-hidden="true"></i> Nueva anulación</button>
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          <div class="va-cuerpo">
            <section class="vfb-card va-doc">
              <h3 class="ta-col-titulo"><i class="ti ti-file-search" aria-hidden="true"></i> Documento a anular</h3>
              <div class="va-g va-g1">
                <label class="campo"><span>Documento</span><select name="tipo_doc" ${a ? 'disabled' : ''}>${[['FACTURA', 'Factura'], ['NOTA', 'Nota (crédito, débito o abono)']].map(([k, t]) => `<option value="${k}" ${tipoDoc === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
                <label class="campo"><span>No. interno</span><input name="buscar" inputmode="numeric" value="${esc(d ? String(d.numero) : '')}" placeholder="${tipoDoc === 'NOTA' ? 'Número de la nota' : 'Número de la factura'}" ${a ? 'disabled' : ''}></label>
                <label class="campo va-c2"><span>Tipo de documento</span><input value="${esc(d ? (d.tipo_documento || (tipoDoc === 'NOTA' ? `NOTA DE ${d.tipo}` : d.tipo_factura)) : '')}" disabled></label>
                <label class="campo va-c2"><span>Número de autorización</span><input value="${esc(d?.autorizacion || '')}" disabled></label>
                <label class="campo"><span>Serie</span><input value="${esc(d?.serie || '')}" disabled></label>
                <label class="campo"><span>Número DTE</span><input value="${esc(d?.numero_dte || '')}" disabled></label>
                <label class="campo"><span>Emisión</span><input value="${esc(d ? fmt.fechaHora(d.fecha_emision) : '')}" disabled></label>
                <label class="campo"><span>Certificación</span><input value="${esc(d?.fecha_certificacion ? fmt.fechaHora(d.fecha_certificacion) : '')}" disabled></label>
                <label class="campo"><span>Valor</span><input class="va-num" value="${d ? `${sim(d.moneda_id)} ${fmt.monto(valor)}` : ''}" disabled></label>
                <label class="campo"><span>Valor MI</span><input class="va-num" value="${d ? fmt.monto(valorMi) : ''}" disabled></label>
              </div>
              ${d ? `<p class="cc-ingreso"><a class="vf-p-link" href="${href}"><i class="ti ti-external-link" aria-hidden="true"></i> Abrir ${esc(interno(d, tipoDoc))} ${tipoDoc === 'FACTURA' ? `(${esc(nombreFac(d))})` : ''}</a>${tipoDoc === 'FACTURA' && Number(d.pagado) > 0 ? ` · <span class="pc-rojo">tiene pagos por ${fmt.monto(d.pagado)}</span>` : ''}</p>` : ''}
            </section>
            <section class="vfb-card va-cli">
              <h3 class="ta-col-titulo"><i class="ti ti-user" aria-hidden="true"></i> Cliente y motivo</h3>
              <div class="va-g va-g2">
                <label class="campo"><span>NIT</span><input value="${esc(d?.nit || '')}" disabled></label>
                <label class="campo va-c2"><span>Correo electrónico</span><input value="${esc(d?.correo || '')}" disabled></label>
                <label class="campo"><span>Código</span><input value="${esc(String(d?.cliente_codigo ?? ''))}" disabled></label>
                <label class="campo va-c2"><span>Cliente</span><input value="${esc(d?.nombre || '')}" disabled></label>
                <label class="campo va-c3"><span>Motivo de anulación *</span><textarea name="motivo" rows="3" maxlength="300" ${a || !puede ? 'disabled' : ''}>${esc(a?.motivo || (anulado ? (d.motivo_anulacion || '') : ''))}</textarea></label>
              </div>
            </section>
            <section class="vfb-card va-ctl">
              <h3 class="ta-col-titulo"><i class="ti ti-history" aria-hidden="true"></i> Control</h3>
              <div class="vf-pr-dato"><span>Anulación No.</span><b>${a ? a.numero : '—'}</b></div>
              <div class="vf-pr-dato"><span>Estado</span><b>${a || anulado ? 'ANULADA' : d ? 'VIGENTE' : '—'}</b></div>
              <div class="vf-pr-dato"><span>Usuario ingresa</span><b>${esc(a?.usuario || (anulado ? d.anulada_por || '' : '')) || '—'}</b></div>
              <div class="vf-pr-dato"><span>Fecha ingresa</span><b>${a ? esc(fmt.fechaHora(a.creado_en)) : anulado && d.anulada_en ? esc(fmt.fechaHora(d.anulada_en)) : '—'}</b></div>
              <div class="vf-pr-dato va-nueva"><span>Factura nueva</span><b>${nueva ? `<a class="vf-p-link" href="#/facturacion/facturas-ventas/${nueva.id}">FE-${nueva.numero}</a>` : '—'}</b></div>
              <div class="va-acciones">
                <button type="button" class="boton primario-sm rp-peligro" data-accion="anular" ${puede ? '' : 'disabled'}><i class="ti ti-ban" aria-hidden="true"></i> Anular documento</button>
                <button type="button" class="boton secundario-sm" data-accion="duplicar" ${ctx.admin && d && tipoDoc === 'FACTURA' && (a || anulado) && !nueva && !ocupado ? '' : 'disabled'}><i class="ti ti-copy" aria-hidden="true"></i> Duplicar documento</button>
                <button type="button" class="boton secundario-sm" data-accion="imprimir" ${a ? '' : 'disabled'}><i class="ti ti-printer" aria-hidden="true"></i> Imprimir documento</button>
              </div>
            </section>
          </div>
          <section class="bm-pestanas va-lista">
            <div class="bm-tabs-barra"><h3 class="ta-col-titulo"><i class="ti ti-list" aria-hidden="true"></i> Anulaciones de la empresa <small>${lista.length}</small></h3></div>
            <div class="bm-panel"><div class="pc-lineas"><table class="vf-lista"><thead><tr><th>No.</th><th>Fecha</th><th>Documento</th><th>Tipo</th><th>Cliente</th><th>Motivo</th><th class="num">Valor</th><th>Usuario</th><th>Factura nueva</th></tr></thead>
              <tbody>${lista.map((x) => `<tr data-anulacion="${x.id}" class="${x.id === a?.id ? 'actual' : ''}" title="Ver la anulación"><td class="fuerte">${x.numero}</td><td>${esc(fmt.fechaHora(x.creado_en))}</td><td>${x.documento === 'NOTA' ? 'Nota' : 'Factura'}</td><td>${esc(x.tipo_documento || '')}</td><td>${esc(x.nombre || '')}</td><td class="cc-nombre">${esc(x.motivo || '')}</td><td class="num">${fmt.monto(x.valor)}</td><td>${esc(x.usuario || '')}</td><td>${x.factura_nueva_id ? '<i class="ti ti-circle-check pc-verde" aria-label="Sí"></i>' : ''}</td></tr>`).join('') || '<tr><td colspan="9" class="tk-vacio">Sin anulaciones registradas.</td></tr>'}</tbody></table></div></div>
          </section>
        </form>`;
    }

    async function anular() {
      const form = ctx.pDet.querySelector('.va-form'); const error = form.querySelector('.tk-error');
      const motivo = (form.elements.motivo.value || '').trim();
      if (!motivo) { error.textContent = 'Escribe el motivo de la anulación.'; return; }
      const d = doc;
      if (!confirm(`¿Anular ${tipoDoc === 'NOTA' ? 'la nota' : 'la factura'} ${interno(d, tipoDoc)} por ${fmt.monto(tipoDoc === 'NOTA' ? d.valor : d.total)}? ${tipoDoc === 'FACTURA' ? 'Su saldo queda en cero y su inventario regresa a la bodega.' : 'Deja de afectar el saldo de su factura.'}`)) return;
      ocupado = true; pintar();
      const quien = (ctx.yo.usuario || '').toUpperCase(); const ahora = new Date().toISOString();
      try {
        const tabla = tipoDoc === 'NOTA' ? 'notas_venta' : 'facturas_venta';
        const u = await sb.from(tabla).update({ estado: 'ANULADA', motivo_anulacion: motivo, anulada_por: quien, anulada_en: ahora }).eq('id', d.id); if (u.error) throw u.error;
        const r = await sb.from('anulaciones_dte').insert({ organizacion_id: d.organizacion_id, localidad_id: d.localidad_id, documento: tipoDoc, factura_id: tipoDoc === 'FACTURA' ? d.id : null, nota_id: tipoDoc === 'NOTA' ? d.id : null,
          tipo_documento: d.tipo_documento || (tipoDoc === 'NOTA' ? `NOTA DE ${d.tipo}` : d.tipo_factura), fecha_certificacion: d.fecha_certificacion, moneda_id: d.moneda_id,
          valor: tipoDoc === 'NOTA' ? d.valor : d.total, valor_mi: tipoDoc === 'NOTA' ? d.valor_mi : d.total_mi, cliente_id: d.cliente_id, cliente_codigo: d.cliente_codigo != null ? String(d.cliente_codigo) : null,
          nombre: d.nombre, nit: d.nit, correo: d.correo, motivo, usuario: quien }).select('*').single();
        if (r.error) throw r.error;
        window.FIN.aviso(`${tipoDoc === 'NOTA' ? 'Nota' : 'Factura'} anulada (anulación ${r.data.numero})`);
        ocupado = false;
        await verAnulacion(r.data);
        await cargarLista();
      } catch (e) { ocupado = false; error.textContent = window.UI.traducirError(e); return; }
      pintar();
    }
    async function duplicar() {
      const d = doc; if (!d || tipoDoc !== 'FACTURA') return;
      if (!confirm(`¿Crear una factura nueva igual a ${interno(d, 'FACTURA')} (${nombreFac(d)}), sin certificar?`)) return;
      ocupado = true; pintar();
      try {
        const [l, c] = await Promise.all([
          sb.from('factura_venta_lineas').select('*').eq('factura_id', d.id).order('linea'),
          sb.from('factura_venta_contable').select('*').eq('factura_id', d.id).order('linea')
        ]);
        const h = Object.fromEntries(COPIAR.map((k) => [k, d[k] ?? null]));
        const r = await sb.from('facturas_venta').insert({ ...h, numero: 0, estado: 'FACTURADA', organizacion_id: d.organizacion_id, localidad_id: d.localidad_id, fecha_emision: new Date().toISOString(),
          observaciones: [d.observaciones, `Duplicada de la factura anulada interno ${d.numero}`].filter(Boolean).join(' · '), usuario: (ctx.yo.usuario || '').toUpperCase() }).select('id, numero').single();
        if (r.error) throw r.error;
        const id = r.data.id;
        if ((l.data || []).length) { const x = await sb.from('factura_venta_lineas').insert(l.data.map((y) => ({ ...Object.fromEntries(COPIAR_LINEA.map((k) => [k, y[k] ?? null])), factura_id: id,
          // El precio sale del total de la línea: así la factura nueva suma lo mismo (en las migradas el total no siempre es cantidad × precio).
          cantidad: Number(y.cantidad) > 0 ? y.cantidad : 1, precio: Number(y.cantidad) > 0 ? Math.round(Number(y.total) / Number(y.cantidad) * 1e6) / 1e6 : Number(y.total) }))); if (x.error) throw x.error; }
        if ((c.data || []).length) { const x = await sb.from('factura_venta_contable').insert(c.data.map((y) => ({ factura_id: id, linea: y.linea, cuenta_id: y.cuenta_id, centro_id: y.centro_id, concepto: y.concepto, debe: y.debe, haber: y.haber, debe_mi: y.debe_mi ?? null, haber_mi: y.haber_mi ?? null }))); if (x.error) throw x.error; }
        if (actual) { const x = await sb.from('anulaciones_dte').update({ factura_nueva_id: id }).eq('id', actual.id); if (x.error) throw x.error; }
        window.FIN.aviso(`Factura nueva FE-${r.data.numero} creada`);
        ocupado = false;
        if (actual) { const { data } = await sb.from('anulaciones_dte').select('*').eq('id', actual.id).single(); await verAnulacion(data, d); await cargarLista(); }
      } catch (e) { ocupado = false; window.FIN.aviso(window.UI.traducirError(e)); }
      pintar();
    }
    function imprimirAnulacion() {
      const a = actual, d = doc; if (!a) return;
      imprimir(`Anulación ${a.numero}`, `<h1>Anulación de documento DTE No. ${a.numero}</h1>
        <h2>${esc([`Fecha: ${fmt.fechaHora(a.creado_en)}`, `Usuario: ${a.usuario || ''}`, `Documento: ${a.documento === 'NOTA' ? 'Nota' : 'Factura'} ${interno(d, a.documento)}`, `Tipo: ${a.tipo_documento || ''}`].join(' · '))}</h2>
        <table><tbody>
          <tr><th>Cliente</th><td>${esc(`${a.cliente_codigo || ''} · ${a.nombre || ''}`)}</td><th>NIT</th><td>${esc(a.nit || '')}</td></tr>
          <tr><th>Autorización</th><td>${esc(d?.autorizacion || '')}</td><th>Serie · DTE</th><td>${esc([d?.serie, d?.numero_dte].filter(Boolean).join(' · '))}</td></tr>
          <tr><th>Emisión</th><td>${esc(d ? fmt.fechaHora(d.fecha_emision) : '')}</td><th>Certificación</th><td>${esc(d?.fecha_certificacion ? fmt.fechaHora(d.fecha_certificacion) : '')}</td></tr>
          <tr><th>Valor</th><td class="n">${esc(sim(a.moneda_id))} ${fmt.monto(a.valor)}</td><th>Valor MI</th><td class="n">${fmt.monto(a.valor_mi)}</td></tr>
          <tr><th>Motivo</th><td colspan="3">${esc(a.motivo)}</td></tr>
          ${nueva ? `<tr><th>Factura nueva</th><td colspan="3">FE-${nueva.numero}</td></tr>` : ''}
        </tbody></table>
        <div class="firmas"><div>Anuló: ${esc(a.usuario || '')}</div><div>Autorizó</div></div>`, { locId: a.localidad_id, orgId: a.organizacion_id });
    }

    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { actual = null; doc = null; nueva = null; await cargarLista(); return pintar(); }
      if (e.target.name === 'tipo_doc') { tipoDoc = e.target.value; doc = null; actual = null; nueva = null; return pintar(); }
      if (e.target.name === 'buscar' && /^\d+$/.test(e.target.value.trim())) { await buscar(Number(e.target.value.trim())); return pintar(); }
    });
    cont.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.name === 'buscar') { e.preventDefault(); e.target.blur(); } });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.va-form')) e.preventDefault(); });
    cont.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr[data-anulacion]');
      if (tr) { const x = lista.find((y) => String(y.id) === tr.dataset.anulacion); if (x) { await verAnulacion(x); pintar(); } return; }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'limpiar') { actual = null; doc = null; nueva = null; return pintar(); }
      if (a === 'anular') return anular();
      if (a === 'duplicar') return duplicar();
      if (a === 'imprimir') return imprimirAnulacion();
    });

    iniciar();
  };

})();
