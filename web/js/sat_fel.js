// Integraciones SAT · Historial FEL (script 164): DTE certificados en el sistema anterior con su detalle (líneas e
// impuestos, frases, abonos de la factura cambiaria, adendas, exportación, referencias de notas, anulación y resultado
// de la certificación), enlazados a sus facturas y notas de venta. Permite enlazar de nuevo y crear la factura de un DTE
// que no tiene documento. Listado en PDF y Excel; representación impresa del DTE.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const q = (n) => `Q ${fmt.monto(n)}`;
  const hoy = () => fmt.hoy();
  const fh = (v) => (v ? new Date(v).toLocaleString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') : '');
  const CLS = { CERTIFICADO: 'aprobada', ERROR: 'anulada', PENDIENTE: 'pendiente', 'SIN RESULTADO': 'definitiva', VIGENTE: 'aprobada', ANULADO: 'anulada' };
  const marca = (e) => `<span class="pc-marca ${CLS[e] || ''}">${esc(e)}</span>`;
  const TIPOS = { FACT: 'Factura', FCAM: 'Factura cambiaria', NCRE: 'Nota de crédito', NDEB: 'Nota de débito', NABN: 'Nota de abono', FESP: 'Factura especial', FPEQ: 'Factura pequeño contribuyente', FCAP: 'Factura cambiaria pequeño contribuyente' };
  const botonesExp = '<button type="button" class="boton secundario-sm" data-exp="PDF"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button><button type="button" class="boton secundario-sm" data-exp="EXCEL"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>';

  window.PANTALLAS['sat-historial-fel'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Historial FEL (DTE certificados)', icono: 'ti-certificate', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Integraciones SAT · Registros' });
    const { sb } = ctx;
    const f = { desde: `${hoy().slice(0, 4)}-01-01`, hasta: hoy(), tipo: '', resultado: '', enlace: '', buscar: '' }; let filas = [], sel = null, det = null, frases = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    function filtros() {
      const s = (n, l, ops) => `<label class="campo"><span>${l}</span><select name="${n}">${ops.map(([v, t]) => `<option value="${v}" ${f[n] === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
      ctx.filtros(`<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}"></label>
        ${s('tipo', 'Tipo', [['', 'Todos'], ...Object.entries(TIPOS).map(([k, v]) => [k, `${k} · ${v}`])])}${s('resultado', 'Resultado', [['', 'Todos'], ['CERTIFICADO', 'Certificados'], ['ANULADO', 'Anulados'], ['ERROR', 'Con error'], ['PENDIENTE', 'Pendientes'], ['SIN RESULTADO', 'Sin resultado']])}
        ${s('enlace', 'Documento', [['', 'Todos'], ['SIN', 'Sin factura ni nota'], ['CON', 'Enlazados']])}<label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar value="${esc(f.buscar)}" placeholder="No. interno, NIT, nombre, autorización…"></label>`,
        `${ctx.admin ? '<button type="button" class="boton secundario-sm" data-accion="enlazar"><i class="ti ti-link" aria-hidden="true"></i> Enlazar documentos</button>' : ''}${botonesExp}`);
    }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-certificate'); return; }
      filtros(); ctx.pDet.innerHTML = '<p class="vacio">Leyendo los DTE…</p>';
      try {
        const out = [];
        for (let i = 0; ; i += 1000) {
          let x = sb.from('sat_dte').select('id, id_anterior, tipo_dte, no_interno, fecha_emision, moneda, gran_total, total_iva, receptor_nit, receptor_nombre, serie, numero_dte, autorizacion, fecha_certificacion, resultado, motivo_error, estado, factura_venta_id, nota_venta_id, exportacion')
            .eq('localidad_id', ctx.sel.loc).gte('fecha_emision', `${f.desde}T00:00:00-06:00`).lte('fecha_emision', `${f.hasta}T23:59:59-06:00`);
          if (f.tipo) x = x.eq('tipo_dte', f.tipo);
          if (f.resultado === 'ANULADO') x = x.eq('estado', 'ANULADO'); else if (f.resultado) x = x.eq('resultado', f.resultado);
          const { data, error } = await x.order('fecha_emision', { ascending: false }).range(i, i + 999); if (error) throw error;
          out.push(...(data || [])); if (!data || data.length < 1000) break;
        }
        filas = out; const { data: fr } = await sb.from('sat_frases').select('tipo, escenario, descripcion'); frases = fr || [];
      } catch (e) { ctx.pDet.innerHTML = `<p class="vacio">${/sat_dte/.test(e?.message || '') ? 'Falta instalar el script 164 (historial FEL) en Supabase.' : esc(window.UI.traducirError(e))}</p>`; return; }
      pintar();
    }
    const vis = () => filas.filter((d) => (!f.enlace || (f.enlace === 'SIN' ? !d.factura_venta_id && !d.nota_venta_id && d.resultado === 'CERTIFICADO' : d.factura_venta_id || d.nota_venta_id))
      && (!f.buscar || `${d.no_interno} ${d.receptor_nit} ${d.receptor_nombre} ${d.autorizacion} ${d.serie} ${d.numero_dte}`.toLowerCase().includes(f.buscar.toLowerCase())));
    const estado = (d) => (d.estado === 'ANULADO' ? 'ANULADO' : d.resultado);
    function pintar() {
      const vs = vis(), cert = vs.filter((d) => d.resultado === 'CERTIFICADO' && d.estado === 'VIGENTE');
      cfg = { titulo: 'Historial FEL (DTE certificados)', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Historial FEL', archivo: `historial_fel_${f.hasta}`, parametros: [`Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, `${vs.length} DTE`],
        columnas: [col('Fecha', 'texto', 15), col('Tipo', 'texto', 6), col('No. interno', 'texto', 10), col('Serie', 'texto', 9), col('Número DTE', 'texto', 11), col('NIT receptor', 'texto', 11), col('Receptor', 'texto', 30), col('Total', 'monto', 13), col('IVA', 'monto', 11), col('Estado', 'texto', 12), col('Documento', 'texto', 10)],
        filas: vs.map((d) => ({ valores: [fh(d.fecha_emision), d.tipo_dte, d.no_interno || '', d.serie || '', d.numero_dte || '', d.receptor_nit || '', d.receptor_nombre || '', r2(d.gran_total), r2(d.total_iva), estado(d), d.factura_venta_id ? 'Factura' : d.nota_venta_id ? 'Nota' : d.resultado === 'CERTIFICADO' ? 'SIN DOCUMENTO' : ''], resaltar: d.resultado === 'CERTIFICADO' && !d.factura_venta_id && !d.nota_venta_id, id: d.id })) };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('DTE', vs.length)}${kpi('Certificados vigentes', cert.length, 'ec-fin')}${kpi('Monto certificado', q(sum(cert.map((d) => d.gran_total))))}${kpi('Anulados', vs.filter((d) => d.estado === 'ANULADO').length)}${kpi('Con error', vs.filter((d) => d.resultado === 'ERROR').length, 'ec-alerta')}${kpi('Sin documento', vs.filter((d) => d.resultado === 'CERTIFICADO' && !d.factura_venta_id && !d.nota_venta_id).length, vs.some((d) => d.resultado === 'CERTIFICADO' && !d.factura_venta_id && !d.nota_venta_id) ? 'ec-alerta' : '')}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Documentos tributarios electrónicos emitidos en el sistema anterior con su certificación, anulación y errores, enlazados a sus facturas y notas de venta. Los certificados sin documento se resaltan: ábrelos para crear su factura. Toca un DTE para ver su detalle.</p>
        ${sel ? detalle() : ''}
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${cfg.columnas.map((c) => `<th class="${c.tipo === 'texto' ? '' : 'num'}">${esc(c.titulo)}</th>`).join('')}</tr></thead><tbody>
        ${cfg.filas.slice(0, 600).map((r) => `<tr data-dte="${r.id}" class="${r.id === sel?.id ? 'cr-n2' : ''}${r.resaltar ? ' pr-alerta' : ''}" style="cursor:pointer">${r.valores.map((v, i) => (i === 9 ? `<td>${marca(v)}</td>` : cfg.columnas[i].tipo === 'monto' ? `<td class="num">${fmt.monto(v)}</td>` : `<td>${esc(String(v))}</td>`)).join('')}</tr>`).join('') || `<tr><td colspan="${cfg.columnas.length}" class="tk-vacio">Sin DTE con esos filtros.</td></tr>`}
        ${cfg.filas.length > 600 ? `<tr><td colspan="${cfg.columnas.length}" class="tk-vacio">Se muestran 600 de ${cfg.filas.length}: el PDF y el Excel llevan todos.</td></tr>` : ''}</tbody></table></div></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    function detalle() {
      const d = sel, x = det || {};
      const fila = (a, b) => (b ? `<div><span>${esc(a)}</span><b>${esc(String(b))}</b></div>` : '');
      return `<section class="sat-fel-det"><div class="cl-banda">${esc(TIPOS[d.tipo_dte] || d.tipo_dte)} ${esc(d.no_interno || '')} · ${marca(estado(d))}</div>
        <div class="bc-saldos sat-fel-g">${fila('Emitido', fh(d.fecha_emision))}${fila('Receptor', `${d.receptor_nombre || ''} · NIT ${d.receptor_nit || ''}`)}${fila('Correo', d.receptor_correo)}${fila('Dirección', d.receptor_direccion)}
          ${fila('Serie y número', d.serie ? `${d.serie} · ${d.numero_dte}` : '')}${fila('Autorización', d.autorizacion)}${fila('Certificado', fh(d.fecha_certificacion))}${fila('Total', `${d.moneda} ${fmt.monto(d.gran_total)} · IVA ${fmt.monto(d.total_iva)}`)}
          ${fila('Error de certificación', d.motivo_error)}${fila('Anulado', d.anulado_en ? `${fh(d.anulado_en)} · ${d.motivo_anulacion || ''}` : '')}
          ${fila('Documento de origen', d.nota_numero_origen ? `${d.nota_serie_origen || ''} ${d.nota_numero_origen} del ${fmt.fechaDia(d.nota_fecha_origen)} · ${d.nota_motivo || ''}` : '')}
          ${fila('Exportación', d.export_incoterm ? `${d.export_incoterm} · ${d.export_consignatario || ''}` : '')}</div>
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr><th>#</th><th>B/S</th><th class="num">Cantidad</th><th>Unidad</th><th>Descripción</th><th class="num">Precio</th><th class="num">Descuento</th><th class="num">Total</th><th class="num">IVA</th></tr></thead><tbody>
          ${(x.items || []).map((l) => `<tr><td>${l.linea}</td><td>${esc(l.bien_servicio || '')}</td><td class="num">${num(l.cantidad).toLocaleString('es-GT')}</td><td>${esc(l.unidad || '')}</td><td>${esc(l.descripcion || '')}${l.comentario ? `<br><small>${esc(l.comentario)}</small>` : ''}</td><td class="num">${fmt.monto(l.precio_unitario)}</td><td class="num">${fmt.monto(l.descuento)}</td><td class="num">${fmt.monto(l.precio_total)}</td><td class="num">${fmt.monto(l.iva)}</td></tr>`).join('') || '<tr><td colspan="9" class="tk-vacio">Sin líneas.</td></tr>'}</tbody></table></div>
        ${(x.frases || []).length ? `<p class="pr-guia"><b>Frases:</b> ${x.frases.map((fz) => esc(frases.find((y) => y.tipo === fz.tipo && y.escenario === fz.escenario)?.descripcion || `${fz.tipo}-${fz.escenario}`)).join(' · ')}</p>` : ''}
        ${(x.abonos || []).length ? `<p class="pr-guia"><b>Abonos (factura cambiaria):</b> ${x.abonos.map((a) => `${a.numero}: ${fmt.fechaDia(a.fecha_vencimiento)} · Q ${fmt.monto(a.monto)}`).join(' · ')}</p>` : ''}
        ${(x.adendas || []).length ? `<p class="pr-guia"><b>Adendas:</b> ${x.adendas.map((a) => `${esc(a.llave)}: ${esc(a.valor || '')}`).join(' · ')}</p>` : ''}
        <p class="acciones-form">${d.factura_venta_id ? `<a class="boton secundario-sm" href="#/facturacion/facturas-ventas/${d.factura_venta_id}"><i class="ti ti-file-invoice" aria-hidden="true"></i> Ver factura</a>` : ''}${d.nota_venta_id ? `<a class="boton secundario-sm" href="#/facturacion/${{ NCRE: 'notas-de-credito-electronicas', NDEB: 'notas-de-debito-electronicas', NABN: 'notas-de-abono-electronicas' }[d.tipo_dte] || 'consulta-de-notas'}/${d.nota_venta_id}"><i class="ti ti-file-invoice" aria-hidden="true"></i> Ver nota</a>` : ''}
          ${ctx.admin && !d.factura_venta_id && !d.nota_venta_id && d.resultado === 'CERTIFICADO' && ['FACT', 'FCAM'].includes(d.tipo_dte) ? '<button type="button" class="boton primario-sm" data-accion="crear"><i class="ti ti-file-plus" aria-hidden="true"></i> Crear la factura</button>' : ''}
          <button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir DTE</button> <button type="button" class="boton secundario-sm" data-accion="cerrar"><i class="ti ti-x" aria-hidden="true"></i> Cerrar</button></p></section>`;
    }
    async function abrir(idDte) {
      const [d, it, fr, ab, ad] = await Promise.all([sb.from('sat_dte').select('*').eq('id', idDte).single(), sb.from('sat_dte_items').select('*').eq('dte_id', idDte).order('linea'), sb.from('sat_dte_frases').select('tipo, escenario').eq('dte_id', idDte),
        sb.from('sat_dte_abonos').select('*').eq('dte_id', idDte).order('numero'), sb.from('sat_dte_adendas').select('llave, valor').eq('dte_id', idDte)]);
      sel = d.data; det = { items: it.data || [], frases: fr.data || [], abonos: ab.data || [], adendas: ad.data || [] }; pintar(); cont.querySelector('.sat-fel-det')?.scrollIntoView({ block: 'nearest' });
    }
    function imprimirDte() {
      const d = sel, x = det; const emp = ctx.localidad(ctx.sel.loc);
      imprimir(`${d.tipo_dte} ${d.serie || ''}-${d.numero_dte || ''}`, `<h2>${esc(TIPOS[d.tipo_dte] || d.tipo_dte)} · documento tributario electrónico</h2>
        <p><b>Emisor:</b> ${esc(emp?.nombre_comercial || '')} · NIT ${esc(d.emisor_nit || '')}</p><p><b>Serie:</b> ${esc(d.serie || '')} · <b>Número:</b> ${esc(d.numero_dte || '')} · <b>Autorización:</b> ${esc(d.autorizacion || '')}</p>
        <p><b>Fecha de emisión:</b> ${fh(d.fecha_emision)} · <b>Certificación:</b> ${fh(d.fecha_certificacion)}</p><p><b>Receptor:</b> ${esc(d.receptor_nombre || '')} · NIT ${esc(d.receptor_nit || '')} · ${esc(d.receptor_direccion || '')}</p>
        <table><tr><th>#</th><th>Cantidad</th><th>Descripción</th><th class="n">Precio</th><th class="n">Descuento</th><th class="n">Total</th></tr>${(x.items || []).map((l) => `<tr><td>${l.linea}</td><td>${num(l.cantidad)}</td><td>${esc(l.descripcion || '')}</td><td class="n">${fmt.monto(l.precio_unitario)}</td><td class="n">${fmt.monto(l.descuento)}</td><td class="n">${fmt.monto(l.precio_total)}</td></tr>`).join('')}
        <tr><th colspan="5">Total ${esc(d.moneda)}</th><th class="n">${fmt.monto(d.gran_total)}</th></tr></table>
        ${(x.frases || []).length ? `<p>${x.frases.map((fz) => esc(frases.find((y) => y.tipo === fz.tipo && y.escenario === fz.escenario)?.descripcion || '')).join(' · ')}</p>` : ''}${d.estado === 'ANULADO' ? `<p><b>ANULADO</b> el ${fh(d.anulado_en)}: ${esc(d.motivo_anulacion || '')}</p>` : ''}`);
    }
    cont.addEventListener('input', (e) => { if (e.target.matches('[data-buscar]')) { f.buscar = e.target.value; pintar(); const i = cont.querySelector('[data-buscar]'); i.focus(); i.setSelectionRange(f.buscar.length, f.buscar.length); } });
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') { sel = null; return cargar(); } const n = e.target.name; if (['desde', 'hasta', 'tipo', 'resultado'].includes(n)) { f[n] = e.target.value; sel = null; return cargar(); } if (n === 'enlace') { f.enlace = e.target.value; pintar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]');
      if (ex) { if (!cfg?.filas.length) return window.FIN.aviso('No hay información para imprimir'); const s = { ...cfg, filas: cfg.filas.map(({ valores, resaltar }) => ({ valores, resaltar: resaltar ? 1 : undefined })) }; return ex.dataset.exp === 'PDF' ? window.CUENTAS_XLSX.pdf(s) : window.REPORTE_XLSX.generar(s); }
      const tr = e.target.closest('tr[data-dte]'); if (tr) return abrir(Number(tr.dataset.dte));
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'cerrar') { sel = null; return pintar(); }
      if (a === 'imprimir' && sel) return imprimirDte();
      if (a === 'enlazar') { const { data, error } = await sb.rpc('sat_vincular_dte', { p_organizacion: ctx.sel.org }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); window.FIN.aviso(`Enlazados: ${data.facturas_enlazadas} facturas y ${data.notas_enlazadas} notas · sin documento: ${data.sin_documento}`); return cargar(); }
      if (a === 'crear' && sel) { if (!confirm(`¿Crear en Facturas Ventas la factura ${sel.no_interno} por ${sel.moneda} ${fmt.monto(sel.gran_total)}?`)) return; const { data, error } = await sb.rpc('sat_crear_factura', { p_dte: sel.id }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); window.FIN.aviso(`Factura interna ${data.numero} creada por Q ${fmt.monto(data.total)}`); await cargar(); return abrir(sel.id); }
    });
    iniciar();
  };
})();
