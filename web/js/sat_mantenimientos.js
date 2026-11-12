// Integraciones SAT · Mantenimientos · FEL: los objetos FEL del sistema anterior migrados (scripts 154, 164, 165, 166 y 205).
//   Documentos FEL (DTE): FEL_DTE con su emisor, receptor, ítems e impuestos (FEL_ITEMS, FEL_ITEMS_IMPUESTOS, FEL_COMENTARIOS_ITEMS,
//     FEL_IMPUESTOS), frases, complementos (FEL_DTE_CAMBIARIAS, FEL_DTE_EXPORTACIONES, FEL_DTE_NOTAS), adendas, resultado,
//     anulación (FEL_ANULACIONES) e ID FEL. Solo consulta: son documentos certificados.
//   IDs FEL (FEL_ID): los ID reservados con su estado y el DTE que lo usó.
//   Tipos de frase y escenarios (TIPOS_FRASES_FEL y COD_ESCENARIO_FEL), Tipos de documento FEL (TIPOS_DOCUMENTOS_FEL) y
//   Conexión del certificador (DATOS_FEL, sin usuario ni contraseña): se editan (administrador).
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const r2 = (n) => Math.round(num(n) * 100) / 100;
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const GRUPO = 'Integraciones SAT · Mantenimientos · FEL';
  const hoy = () => fmt.hoy();
  const mesAnterior = () => { const [a, m] = hoy().split('-').map(Number); return m === 1 ? `${a - 1}-12-01` : `${a}-${String(m - 1).padStart(2, '0')}-01`; };
  const fh = (v) => (v ? new Date(v).toLocaleString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') : '');
  const TIPOS = { FACT: 'Factura', FCAM: 'Factura cambiaria', NCRE: 'Nota de crédito', NDEB: 'Nota de débito', NABN: 'Nota de abono', FESP: 'Factura especial', FPEQ: 'Factura pequeño contribuyente', FCAP: 'Factura cambiaria pequeño contribuyente', RDON: 'Recibo por donación', RECI: 'Recibo' };
  const CLS = { CERTIFICADO: 'aprobada', ERROR: 'anulada', PENDIENTE: 'pendiente', 'SIN RESULTADO': 'definitiva', ANULADO: 'anulada' };
  const marca = (e) => `<span class="pc-marca ${CLS[e] || ''}">${esc(e || '')}</span>`;
  const botonesExp = '<button type="button" class="boton secundario-sm" data-exp="PDF"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button><button type="button" class="boton secundario-sm" data-exp="EXCEL"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>';
  const exportar = (c, formato) => (window.CONTA ? window.CONTA.exportar(c, formato, false) : window.FIN.aviso('No se pudo cargar el exportador'));
  const faltaScript = (ctx, e, script) => { ctx.pDet.innerHTML = `<p class="vacio">${/sat_|relation|does not exist|column/.test(e?.message || '') ? `Falta instalar el script ${script} en Supabase.` : esc(window.UI.traducirError(e))}</p>`; };
  const empresaDe = (ctx) => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
  async function leerTodo(fn) { const out = []; for (let i = 0; ; i += 1000) { const { data, error } = await fn().range(i, i + 999); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; } return out; }
  // Ficha de datos: solo los que tienen valor.
  const ficha = (pares) => { const xs = pares.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== ''); return xs.length ? `<div class="sm-ficha">${xs.map(([a, v]) => `<div><span>${esc(a)}</span><b>${esc(String(v))}</b></div>`).join('')}</div>` : '<p class="vacio sm-vacio">Sin datos en el sistema anterior.</p>'; };
  const tabla = (cols, filas, vacio = 'Sin registros.') => `<div class="pc-lineas cx-tabla iv-tabla pr-tabla sm-tabla"><table><thead><tr>${cols.map(([t, n]) => `<th class="${n ? 'num' : ''}">${esc(t)}</th>`).join('')}</tr></thead><tbody>${filas.length ? filas.map((r) => `<tr>${r.map((v, i) => `<td class="${cols[i][1] ? 'num' : ''}">${v ?? ''}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="tk-vacio">${vacio}</td></tr>`}</tbody></table></div>`;

  // ===================== 1. Documentos FEL (DTE) =====================
  const PESTANAS = [['general', 'General y resultado'], ['partes', 'Emisor y receptor'], ['items', 'Ítems e impuestos'], ['frases', 'Frases'], ['complementos', 'Complementos'], ['adendas', 'Adendas'], ['anulacion', 'Anulación'], ['id', 'ID FEL']];
  window.PANTALLAS['sat-mant-dte'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Documentos FEL (DTE)', icono: 'ti-file-certificate', clase: 'bk-movimientos bm-solo cx-rep pr-rep sm-fel', grupo: GRUPO });
    const { sb } = ctx;
    const f = { desde: mesAnterior(), hasta: hoy(), tipo: '', estado: '', buscar: '' };
    let filas = [], sel = null, det = null, pest = 'general', frases = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    function filtros() {
      const s = (n, l, ops) => `<label class="campo"><span>${l}</span><select name="${n}">${ops.map(([v, t]) => `<option value="${v}" ${f[n] === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
      ctx.filtros(`<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}"></label>
        ${s('tipo', 'Tipo', [['', 'Todos'], ...Object.entries(TIPOS).map(([k, v]) => [k, `${k} · ${v}`])])}${s('estado', 'Estado', [['', 'Todos'], ['CERTIFICADO', 'Certificados vigentes'], ['ANULADO', 'Anulados'], ['ERROR', 'Con error'], ['PENDIENTE', 'Pendientes'], ['SIN RESULTADO', 'Sin resultado']])}
        <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar value="${esc(f.buscar)}" placeholder="No. interno, NIT, receptor, autorización"></label>`, botonesExp);
    }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-file-certificate'); return; }
      filtros(); ctx.pDet.innerHTML = '<p class="vacio">Leyendo los DTE…</p>';
      try {
        filas = await leerTodo(() => { let x = sb.from('sat_dte').select('id, id_anterior, tipo_dte, no_interno, fecha_emision, moneda, gran_total, total_iva, receptor_nit, receptor_nombre, serie, numero_dte, autorizacion, resultado, estado')
          .eq('localidad_id', ctx.sel.loc).gte('fecha_emision', `${f.desde}T00:00:00-06:00`).lte('fecha_emision', `${f.hasta}T23:59:59-06:00`);
          if (f.tipo) x = x.eq('tipo_dte', f.tipo);
          if (f.estado === 'ANULADO') x = x.eq('estado', 'ANULADO'); else if (f.estado === 'CERTIFICADO') x = x.eq('resultado', 'CERTIFICADO').eq('estado', 'VIGENTE'); else if (f.estado) x = x.eq('resultado', f.estado);
          return x.order('fecha_emision', { ascending: false }).order('id', { ascending: false }); });
        const fr = await sb.from('sat_frases').select('tipo, escenario, descripcion'); frases = fr.data || [];
      } catch (e) { return faltaScript(ctx, e, '164 (historial FEL)'); }
      const ab = window.SAT_ABRIR_DTE; window.SAT_ABRIR_DTE = null;
      if (ab) return abrir(ab);
      pintar();
    }
    const vis = () => filas.filter((d) => !f.buscar || `${d.no_interno} ${d.receptor_nit} ${d.receptor_nombre} ${d.autorizacion} ${d.serie} ${d.numero_dte} ${d.id_anterior}`.toLowerCase().includes(f.buscar.toLowerCase()));
    const estado = (d) => (d.estado === 'ANULADO' ? 'ANULADO' : d.resultado);
    function pintar() {
      const vs = vis();
      cfg = { titulo: 'Documentos FEL (DTE)', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'DTE', archivo: `dte_fel_${f.hasta}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, `${vs.length} DTE`],
        columnas: [col('Fecha', 'texto', 15), col('Tipo', 'texto', 6), col('No. interno', 'texto', 10), col('Serie', 'texto', 9), col('Número DTE', 'texto', 11), col('NIT receptor', 'texto', 11), col('Receptor', 'texto', 30), col('Moneda', 'texto', 6), col('Total', 'monto', 13), col('IVA', 'monto', 12), col('Estado', 'texto', 12), col('ID anterior', 'texto', 9)],
        filas: vs.map((d) => ({ id: d.id, valores: [fh(d.fecha_emision), d.tipo_dte, d.no_interno || '', d.serie || '', d.numero_dte || '', d.receptor_nit || '', d.receptor_nombre || '', d.moneda || '', r2(d.gran_total), r2(d.total_iva), estado(d), String(d.id_anterior ?? '')], resaltar: d.resultado === 'ERROR' })) };
      const cert = vs.filter((d) => d.resultado === 'CERTIFICADO' && d.estado === 'VIGENTE');
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico ci-compacto">
        <div class="ci-barra"><div class="ci-tit"><b>Documentos FEL</b> <span>${esc(cfg.parametros.slice(1).join(' · '))}</span> <i class="ti ti-info-circle" title="DTE del sistema anterior con todo su detalle. Elige uno para ver sus pestañas. Son documentos certificados: solo consulta." aria-hidden="true"></i></div>
          <div class="ci-kpis"><span class="ci-k"><small>Vigentes</small> <b>${cert.length}</b></span><span class="ci-k ec-fin"><small>Monto vigente</small> <b>Q ${fmt.monto(cert.reduce((s, d) => s + num(d.gran_total), 0))}</b></span><span class="ci-k"><small>Anulados</small> <b>${vs.filter((d) => d.estado === 'ANULADO').length}</b></span><span class="ci-k"><small>Con error</small> <b>${vs.filter((d) => d.resultado === 'ERROR').length}</b></span></div></div>
        ${sel ? detalle() : ''}
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla sm-lista"><table><thead><tr>${cfg.columnas.map((c) => `<th class="${c.tipo === 'texto' ? '' : 'num'}">${esc(c.titulo)}</th>`).join('')}</tr></thead><tbody>
        ${cfg.filas.slice(0, 600).map((r) => `<tr data-dte="${r.id}" class="${r.id === sel?.id ? 'cr-n2' : ''}${r.resaltar ? ' pr-alerta' : ''}" style="cursor:pointer">${r.valores.map((v, i) => (i === 10 ? `<td>${marca(v)}</td>` : cfg.columnas[i].tipo === 'monto' ? `<td class="num">${fmt.monto(v)}</td>` : `<td>${esc(String(v))}</td>`)).join('')}</tr>`).join('') || `<tr><td colspan="${cfg.columnas.length}" class="tk-vacio">Sin DTE en el período.</td></tr>`}
        ${cfg.filas.length > 600 ? `<tr><td colspan="${cfg.columnas.length}" class="tk-vacio">Se muestran 600 de ${cfg.filas.length}: el PDF y el Excel llevan todos.</td></tr>` : ''}</tbody></table></div></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    function detalle() {
      const d = sel, x = det || {};
      const frase = (z) => frases.find((y) => y.tipo === z.tipo && y.escenario === z.escenario)?.descripcion || '';
      const cuerpo = {
        general: () => ficha([['Tipo', `${d.tipo_dte} · ${TIPOS[d.tipo_dte] || ''}`], ['No. interno', d.no_interno], ['ID anterior', d.id_anterior], ['Emitido', fh(d.fecha_emision)], ['Moneda', d.moneda], ['Gran total', fmt.monto(d.gran_total)], ['Total IVA', fmt.monto(d.total_iva)], ['Impuesto', d.impuesto_nombre],
          ['Exportación', d.exportacion ? 'Sí' : ''], ['Serie', d.serie], ['Número DTE', d.numero_dte], ['Autorización', d.autorizacion], ['Certificado', fh(d.fecha_certificacion)], ['Resultado', d.resultado], ['Resultado (anterior)', d.resultado_anterior], ['Proceso', d.resultado_proceso],
          ['Resultado de certificación', d.resultado_certificacion], ['No. interno del resultado', d.no_interno_resultado], ['Motivo de error', d.motivo_error || d.motivo_error_anterior], ['Estado', d.estado], ['Documento en el sistema', d.factura_venta_id ? `Factura ${d.factura_venta_id}` : d.nota_venta_id ? `Nota ${d.nota_venta_id}` : '']]),
        partes: () => `<h4 class="sm-sub">Emisor</h4>${ficha([['NIT', d.emisor_nit], ['Código anterior', d.emisor_codigo_anterior], ['Nombre', d.emisor_nombre], ['Nombre comercial', d.emisor_nombre_comercial], ['Establecimiento', d.establecimiento], ['Afiliación IVA', d.afiliacion_iva], ['Correo', d.emisor_correo], ['Dirección', d.emisor_direccion], ['Código postal', d.emisor_codigo_postal], ['Municipio', d.emisor_municipio], ['Departamento', d.emisor_departamento], ['País', d.emisor_pais]])}
          <h4 class="sm-sub">Receptor</h4>${ficha([['ID receptor', d.receptor_id], ['NIT', d.receptor_nit], ['Nombre', d.receptor_nombre], ['Correo', d.receptor_correo], ['Tipo especial', d.receptor_tipo_especial], ['Dirección', d.receptor_direccion || d.receptor_direccion_anterior], ['Código postal', d.receptor_codigo_postal], ['Municipio', d.receptor_municipio], ['Departamento', d.receptor_departamento], ['País', d.receptor_pais]])}`,
        items: () => tabla([['#'], ['B/S'], ['Cantidad', 1], ['Unidad'], ['Descripción'], ['Precio', 1], ['Descuento', 1], ['Total', 1], ['Gravable', 1], ['Impuesto'], ['Unidad grav.', 1], ['IVA', 1]],
          (x.items || []).map((l) => [l.linea, esc(l.bien_servicio || ''), num(l.cantidad).toLocaleString('es-GT'), esc(l.unidad || ''), `${esc(l.descripcion || '')}${l.comentario ? `<br><small class="sm-com">${esc(l.comentario)}</small>` : ''}`, fmt.monto(l.precio_unitario), fmt.monto(l.descuento), fmt.monto(l.precio_total), fmt.monto(l.monto_gravable), esc(l.impuesto_nombre || ''), l.codigo_unidad_gravable ?? '', fmt.monto(l.total_impuesto_linea ?? l.iva)]), 'Sin ítems.'),
        frases: () => tabla([['Orden', 1], ['Tipo', 1], ['Escenario', 1], ['Frase']], (x.frases || []).map((z) => [z.orden ?? '', z.tipo, z.escenario, esc(frase(z))]), 'Sin frases.'),
        complementos: () => `<h4 class="sm-sub">Abonos de factura cambiaria / retenciones de factura especial</h4>${tabla([['Complemento'], ['ID'], ['Abono', 1], ['Vence'], ['Monto', 1]], (x.abonos || []).map((a) => [esc(a.complemento || ''), esc(a.id_complemento || ''), a.numero, fmt.fechaDia(a.fecha_vencimiento), fmt.monto(a.monto)]), 'Sin abonos.')}
          <h4 class="sm-sub">Exportación</h4>${ficha([['Complemento', d.export_complemento], ['URI', d.export_uri_complemento], ['Incoterm', d.export_incoterm], ['Consignatario', d.export_consignatario], ['Dirección del consignatario', d.export_direccion_consignatario], ['Exportador', d.export_exportador], ['Código del exportador', d.export_codigo_exportador]])}
          <h4 class="sm-sub">Nota (documento de origen)</h4>${ficha([['Complemento', d.nota_complemento], ['URI', d.nota_uri_complemento], ['Versión', d.nota_version], ['Autorización de origen', d.nota_autorizacion_origen], ['Serie de origen', d.nota_serie_origen], ['Número de origen', d.nota_numero_origen], ['Fecha de origen', fmt.fechaDia(d.nota_fecha_origen)], ['Motivo', d.nota_motivo]])}`,
        adendas: () => tabla([['Adenda', 1], ['Llave'], ['Valor']], (x.adendas || []).map((a) => [a.adenda ?? '', esc(a.llave), esc(a.valor || '')]), 'Sin adendas.'),
        anulacion: () => (x.anulaciones || []).length ? x.anulaciones.map((a) => ficha([['ID anterior', a.id_anterior], ['No. interno', a.no_interno], ['Documento', a.numero_documento], ['Emitido', fh(a.fecha_emision_documento)], ['Anulado', fh(a.fecha_hora_anulacion)], ['NIT emisor', a.nit_emisor], ['ID receptor', a.id_receptor], ['Motivo', a.motivo]])).join('') : ficha([['Anulado', fh(d.anulado_en)], ['Motivo', d.motivo_anulacion]]),
        id: () => tabla([['ID FEL', 1], ['Estado']], (x.ids || []).map((i) => [i.id_anterior, esc(i.estado || '')]), 'Sin ID FEL ligado.')
      };
      const n = { items: (x.items || []).length, frases: (x.frases || []).length, adendas: (x.adendas || []).length, anulacion: (x.anulaciones || []).length || (d.anulado_en ? 1 : 0), id: (x.ids || []).length, complementos: (x.abonos || []).length + (d.export_incoterm || d.export_complemento ? 1 : 0) + (d.nota_numero_origen || d.nota_complemento ? 1 : 0) };
      return `<section class="sm-det"><div class="sm-det-cab"><b>${esc(d.tipo_dte)} ${esc(d.no_interno || '')}</b> ${esc(d.receptor_nombre || '')} · ${esc(d.moneda)} ${fmt.monto(d.gran_total)} ${marca(estado(d))}
          <span class="sm-acc"><button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button><button type="button" class="boton secundario-sm" data-accion="cerrar"><i class="ti ti-x" aria-hidden="true"></i> Cerrar</button></span></div>
        <div class="sm-pest" role="tablist">${PESTANAS.map(([k, t]) => `<button type="button" role="tab" aria-selected="${pest === k}" class="${pest === k ? 'activo' : ''}" data-pest="${k}">${esc(t)}${n[k] != null ? ` <b class="cp-num ${n[k] ? '' : 'cp-cero'}">${n[k]}</b>` : ''}</button>`).join('')}</div>
        <div class="sm-cuerpo">${cuerpo[pest]()}</div></section>`;
    }
    async function abrir(idDte) {
      const [d, it, fr, ab, ad, an, ids] = await Promise.all([sb.from('sat_dte').select('*').eq('id', idDte).single(), sb.from('sat_dte_items').select('*').eq('dte_id', idDte).order('linea'),
        sb.from('sat_dte_frases').select('*').eq('dte_id', idDte).order('tipo').order('escenario'), sb.from('sat_dte_abonos').select('*').eq('dte_id', idDte).order('numero'),
        sb.from('sat_dte_adendas').select('*').eq('dte_id', idDte).order('id'), sb.from('sat_dte_anulaciones').select('*').eq('dte_id', idDte), sb.from('sat_fel_ids').select('id_anterior, estado').eq('dte_id', idDte)]);
      if (d.error) return window.FIN.aviso(window.UI.traducirError(d.error));
      sel = d.data; det = { items: it.data || [], frases: fr.data || [], abonos: ab.data || [], adendas: ad.data || [], anulaciones: an.data || [], ids: ids.data || [] };
      if (!filas.some((x) => x.id === sel.id)) filas.unshift(sel);
      pintar(); cont.querySelector('.sm-det')?.scrollIntoView({ block: 'nearest' });
    }
    function imprimirDte() {
      const d = sel, x = det;
      imprimir(`${d.tipo_dte} ${d.serie || ''}-${d.numero_dte || ''}`, `<h1>${esc(TIPOS[d.tipo_dte] || d.tipo_dte)} ${esc(d.no_interno || '')}</h1><h2>Empresa: ${esc(empresaDe(ctx))} · Serie ${esc(d.serie || '')} · Número ${esc(d.numero_dte || '')} · ${esc(estado(d))}</h2>
        <p><b>Autorización:</b> ${esc(d.autorizacion || '')} · <b>Emitido:</b> ${fh(d.fecha_emision)} · <b>Certificado:</b> ${fh(d.fecha_certificacion)}</p>
        <p><b>Emisor:</b> ${esc(d.emisor_nombre || '')} · NIT ${esc(d.emisor_nit || '')} · <b>Receptor:</b> ${esc(d.receptor_nombre || '')} · NIT ${esc(d.receptor_nit || '')}</p>
        <table><tr><th>#</th><th>Cantidad</th><th>Descripción</th><th class="n">Precio</th><th class="n">Descuento</th><th class="n">Total</th><th class="n">IVA</th></tr>${(x.items || []).map((l) => `<tr><td>${l.linea}</td><td>${num(l.cantidad)}</td><td>${esc(l.descripcion || '')}</td><td class="n">${fmt.monto(l.precio_unitario)}</td><td class="n">${fmt.monto(l.descuento)}</td><td class="n">${fmt.monto(l.precio_total)}</td><td class="n">${fmt.monto(l.total_impuesto_linea ?? l.iva)}</td></tr>`).join('')}
        <tr><th colspan="5">Total ${esc(d.moneda)}</th><th class="n">${fmt.monto(d.gran_total)}</th><th class="n">${fmt.monto(d.total_iva)}</th></tr></table>`, { locId: ctx.sel.loc });
    }
    cont.addEventListener('input', (e) => { if (e.target.matches('[data-buscar]')) { f.buscar = e.target.value; pintar(); const i = cont.querySelector('[data-buscar]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } });
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') { sel = null; return cargar(); } const n = e.target.name; if (['desde', 'hasta', 'tipo', 'estado'].includes(n)) { f[n] = e.target.value; sel = null; cargar(); } });
    cont.addEventListener('click', (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp);
      const p = e.target.closest('[data-pest]'); if (p) { pest = p.dataset.pest; return pintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'cerrar') { sel = null; return pintar(); }
      if (a === 'imprimir' && sel) return imprimirDte();
      const tr = e.target.closest('tr[data-dte]'); if (tr) abrir(Number(tr.dataset.dte));
    });
    iniciar();
  };

  // ===================== 2. IDs FEL =====================
  window.PANTALLAS['sat-mant-ids'] = function (cont) {
    const ctx = montar(cont, { titulo: 'IDs FEL', icono: 'ti-id', clase: 'bk-movimientos bm-solo cx-rep pr-rep sm-fel', grupo: GRUPO });
    const { sb } = ctx;
    const f = { estado: '', uso: '', buscar: '' }; let filas = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.org) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-id'); return; }
      ctx.pDet.innerHTML = '<p class="vacio">Leyendo los ID FEL…</p>';
      try { filas = await leerTodo(() => sb.from('sat_fel_ids').select('id_anterior, estado, dte_id, sat_dte(tipo_dte, no_interno, fecha_emision, gran_total, localidad_id)').eq('organizacion_id', ctx.sel.org).order('id_anterior')); }
      catch (e) { ctx.filtros(''); return faltaScript(ctx, e, '205 (parte 0)'); }
      const est = [...new Set(filas.map((x) => x.estado || ''))].sort();
      ctx.filtros(`<label class="campo"><span>Estado</span><select name="estado"><option value="">Todos</option>${est.map((s) => `<option value="${esc(s)}" ${f.estado === s ? 'selected' : ''}>${esc(s || '(sin estado)')}</option>`).join('')}</select></label>
        <label class="campo"><span>Uso</span><select name="uso"><option value="">Todos</option><option value="CON" ${f.uso === 'CON' ? 'selected' : ''}>Con DTE</option><option value="SIN" ${f.uso === 'SIN' ? 'selected' : ''}>Sin DTE</option></select></label>
        <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar value="${esc(f.buscar)}" placeholder="ID o No. interno"></label>`, botonesExp);
      pintar();
    }
    function pintar() {
      const vs = filas.filter((x) => (!f.estado || (x.estado || '') === f.estado) && (!f.uso || (f.uso === 'CON' ? x.dte_id : !x.dte_id)) && (!f.buscar || `${x.id_anterior} ${x.sat_dte?.no_interno || ''}`.toLowerCase().includes(f.buscar.toLowerCase())));
      cfg = { titulo: 'IDs FEL', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'IDs FEL', archivo: 'ids_fel', parametros: [`Empresa: ${empresaDe(ctx)} (ID de su organización)`, `${vs.length} ID`],
        columnas: [col('ID FEL', 'texto', 12), col('Estado', 'texto', 14), col('Tipo', 'texto', 8), col('No. interno', 'texto', 14), col('Fecha del DTE', 'texto', 16), col('Total', 'monto', 14)],
        filas: vs.map((x) => ({ dte: x.dte_id, valores: [String(x.id_anterior), x.estado || '', x.sat_dte?.tipo_dte || '', x.sat_dte?.no_interno || '', fh(x.sat_dte?.fecha_emision), x.sat_dte ? r2(x.sat_dte.gran_total) : ''] })) };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico ci-compacto"><div class="ci-barra"><div class="ci-tit"><b>IDs FEL</b> <span>ID reservados en el sistema anterior; los que tienen DTE abren su documento.</span></div>
          <div class="ci-kpis"><span class="ci-k"><small>ID</small> <b>${vs.length.toLocaleString('es-GT')}</b></span><span class="ci-k ec-fin"><small>Con DTE</small> <b>${vs.filter((x) => x.dte_id).length.toLocaleString('es-GT')}</b></span><span class="ci-k"><small>Sin DTE</small> <b>${vs.filter((x) => !x.dte_id).length.toLocaleString('es-GT')}</b></span></div></div>
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla sm-lista"><table><thead><tr>${cfg.columnas.map((c) => `<th class="${c.tipo === 'texto' ? '' : 'num'}">${esc(c.titulo)}</th>`).join('')}</tr></thead><tbody>
        ${cfg.filas.slice(0, 800).map((r) => `<tr ${r.dte ? `data-dte="${r.dte}" style="cursor:pointer" title="Abrir el DTE"` : ''}>${r.valores.map((v, i) => (i === 5 ? `<td class="num">${v === '' ? '' : fmt.monto(v)}</td>` : `<td>${esc(String(v))}</td>`)).join('')}</tr>`).join('') || `<tr><td colspan="6" class="tk-vacio">Sin ID FEL.</td></tr>`}
        ${cfg.filas.length > 800 ? `<tr><td colspan="6" class="tk-vacio">Se muestran 800 de ${cfg.filas.length.toLocaleString('es-GT')}: busca o filtra, o usa el PDF o el Excel.</td></tr>` : ''}</tbody></table></div></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('input', (e) => { if (e.target.matches('[data-buscar]')) { f.buscar = e.target.value; pintar(); } });
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); if (['estado', 'uso'].includes(e.target.name)) { f[e.target.name] = e.target.value; pintar(); } });
    cont.addEventListener('click', (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp);
      const tr = e.target.closest('tr[data-dte]'); if (tr) { window.SAT_ABRIR_DTE = Number(tr.dataset.dte); location.hash = '#/sat/sat-mant-dte'; }
    });
    iniciar();
  };

  // ===================== Edición en línea (catálogos) =====================
  // Celda editable: texto, número, casilla o lista.
  const celda = (c, v, ed) => (c.ro || !ed ? esc(c.tipo === 'check' ? (v ? 'Sí' : 'No') : String(v ?? ''))
    : c.tipo === 'check' ? `<input type="checkbox" data-c="${c.k}" ${v ? 'checked' : ''}>`
    : c.ops ? `<select data-c="${c.k}">${c.ops.map(([x, t]) => `<option value="${esc(x)}" ${String(v) === String(x) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`
    : `<input data-c="${c.k}" value="${esc(String(v ?? ''))}" ${c.tipo === 'numero' ? 'type="number"' : ''}>`);
  const valorDe = (c, el) => (c.tipo === 'check' ? el.checked : c.tipo === 'numero' ? num(el.value) : c.mayus === false ? el.value.trim() : el.value.trim().toUpperCase());
  const tablaEd = (campos, filas, ed, idDe, extra = '', vacio = 'Sin registros.') => `<div class="pc-lineas cx-tabla iv-tabla pr-tabla sm-tabla sm-ed"><table><thead><tr>${campos.map((c) => `<th>${esc(c.titulo)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map((x) => `<tr data-id="${idDe(x)}" ${extra ? extra(x) : ''}>${campos.map((c) => `<td>${celda(c, x[c.k], ed)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${campos.length}" class="tk-vacio">${vacio}</td></tr>`}</tbody></table></div>`;
  const cfgDe = (titulo, ctx, campos, filas, parametros = []) => ({ titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: titulo.slice(0, 30), archivo: titulo.toLowerCase().replace(/\s+/g, '_'), parametros,
    columnas: campos.map((c) => col(c.titulo, 'texto', c.ancho || 16)), filas: filas.map((x) => ({ valores: campos.map((c) => (c.tipo === 'check' ? (x[c.k] ? 'Sí' : 'No') : String(x[c.k] ?? ''))) })) });

  // ===================== 3. Tipos de frase y escenarios =====================
  window.PANTALLAS['sat-mant-frases'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Tipos de frase y escenarios', icono: 'ti-quote', clase: 'bk-movimientos bm-solo cx-rep pr-rep sm-fel', grupo: GRUPO });
    const { sb } = ctx;
    let tipos = [], esc_ = [], sel = null;
    const CT = [{ k: 'codigo', titulo: 'Código', ro: true, ancho: 8 }, { k: 'nombre', titulo: 'Tipo de frase', ancho: 30 }, { k: 'descripcion', titulo: 'Descripción', ancho: 40, mayus: false }, { k: 'activo', titulo: 'Activo', tipo: 'check', ancho: 8 }];
    const CE = [{ k: 'escenario', titulo: 'Escenario', ro: true, ancho: 9 }, { k: 'descripcion', titulo: 'Descripción', ancho: 40, mayus: false }, { k: 'texto', titulo: 'Texto en el DTE', ancho: 50, mayus: false }, { k: 'exento_iva', titulo: 'Exento de IVA', tipo: 'check', ancho: 10 }];
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      ctx.filtros('', `${ctx.admin ? '<button type="button" class="boton secundario-sm" data-accion="nuevo-tipo"><i class="ti ti-plus" aria-hidden="true"></i> Tipo</button><button type="button" class="boton secundario-sm" data-accion="nuevo-esc"><i class="ti ti-plus" aria-hidden="true"></i> Escenario</button>' : ''}${botonesExp}`);
      const [t, e] = await Promise.all([sb.from('sat_tipos_frase').select('*').order('codigo'), sb.from('sat_frases').select('*').order('tipo').order('escenario')]);
      if (t.error || e.error) return faltaScript(ctx, t.error || e.error, '165 (tipos de frase)');
      tipos = t.data || []; esc_ = e.data || [];
      if (sel == null || !tipos.some((x) => x.codigo === sel)) sel = tipos[0]?.codigo ?? null;
      pintar();
    }
    function pintar() {
      const ed = ctx.admin, t = tipos.find((x) => x.codigo === sel);
      const es = esc_.filter((x) => x.tipo === sel);
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico ci-compacto sm-md">
        <div class="ci-barra"><div class="ci-tit"><b>Tipos de frase y escenarios</b> <span>${tipos.length} tipos · ${esc_.length} escenarios${ed ? ' · los cambios se guardan al salir de cada casilla' : ''}</span></div></div>
        <div class="sm-dos"><div><h4 class="sm-sub">Tipos de frase</h4>${tablaEd(CT, tipos, ed, (x) => x.codigo, (x) => `data-tipo="${x.codigo}" class="${x.codigo === sel ? 'cr-n2' : ''}" style="cursor:pointer"`)}</div>
        <div><h4 class="sm-sub">Escenarios del tipo ${t ? `${t.codigo} · ${esc(t.nombre)}` : ''}</h4>${tablaEd(CE, es, ed, (x) => x.id, '', 'Este tipo no tiene escenarios.')}</div></div></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', async (e) => {
      const k = e.target.dataset.c; if (!k) return; const tr = e.target.closest('tr[data-id]');
      const enTipos = tr.closest('.sm-dos > div:first-child') != null;
      const c = (enTipos ? CT : CE).find((x) => x.k === k);
      const { error } = enTipos ? await sb.from('sat_tipos_frase').update({ [k]: valorDe(c, e.target) }).eq('codigo', Number(tr.dataset.id)) : await sb.from('sat_frases').update({ [k]: valorDe(c, e.target) }).eq('id', Number(tr.dataset.id));
      if (error) { window.FIN.aviso(window.UI.traducirError(error)); return cargar(); }
      const lista = enTipos ? tipos : esc_; const x = lista.find((y) => String(enTipos ? y.codigo : y.id) === tr.dataset.id); if (x) x[k] = valorDe(c, e.target);
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]');
      if (ex) { const filas = tipos.flatMap((t) => [{ valores: [`${t.codigo} · ${t.nombre}`, t.descripcion || '', '', t.activo ? 'Activo' : 'Inactivo'], tipo: 'grupo' }, ...esc_.filter((x) => x.tipo === t.codigo).map((x) => ({ valores: [String(x.escenario), x.descripcion || '', x.texto || '', x.exento_iva ? 'Sí' : 'No'] }))]);
        return exportar({ titulo: 'Tipos de frase y escenarios', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Frases', archivo: 'tipos_frase_escenarios', parametros: [`${tipos.length} tipos · ${esc_.length} escenarios`], columnas: [col('Tipo / escenario', 'texto', 26), col('Descripción', 'texto', 44), col('Texto en el DTE', 'texto', 54), col('Exento IVA / estado', 'texto', 12)], filas }, ex.dataset.exp); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'nuevo-tipo') { const codigo = Math.max(0, ...tipos.map((x) => x.codigo)) + 1; const { error } = await sb.from('sat_tipos_frase').insert({ codigo, nombre: 'NUEVO TIPO DE FRASE' }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); sel = codigo; return cargar(); }
      if (a === 'nuevo-esc') { if (sel == null) return window.FIN.aviso('Elige primero el tipo de frase'); const escenario = Math.max(0, ...esc_.filter((x) => x.tipo === sel).map((x) => x.escenario)) + 1; const { error } = await sb.from('sat_frases').insert({ tipo: sel, escenario, descripcion: 'NUEVO ESCENARIO' }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); return cargar(); }
      if (e.target.matches('input, select')) return;
      const tr = e.target.closest('tr[data-tipo]'); if (tr) { sel = Number(tr.dataset.tipo); pintar(); }
    });
    iniciar();
  };

  // ===================== 4. Tipos de documento FEL =====================
  window.PANTALLAS['sat-mant-tipos-doc'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Tipos de documento FEL', icono: 'ti-files', clase: 'bk-movimientos bm-solo cx-rep pr-rep sm-fel', grupo: GRUPO });
    const { sb } = ctx;
    let filas = [], tiposDte = [];
    const campos = () => [{ k: 'codigo', titulo: 'Código', tipo: 'numero', ancho: 8 }, { k: 'tipo_dte', titulo: 'Tipo DTE', ops: tiposDte.map((t) => [t.codigo, `${t.codigo} · ${t.nombre}`]), ancho: 30 }, { k: 'descripcion', titulo: 'Descripción', ancho: 50 }];
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.org) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-files'); return; }
      ctx.filtros('', `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>' : ''}${botonesExp}`);
      const [d, t] = await Promise.all([sb.from('sat_tipos_documento_fel').select('*').eq('organizacion_id', ctx.sel.org).order('codigo'), sb.from('sat_tipos_dte').select('codigo, nombre').order('codigo')]);
      if (d.error) return faltaScript(ctx, d.error, '164 (historial FEL)');
      filas = d.data || []; tiposDte = t.data || [];
      filas.forEach((x) => { if (!tiposDte.some((y) => y.codigo === x.tipo_dte)) tiposDte.push({ codigo: x.tipo_dte, nombre: TIPOS[x.tipo_dte] || x.tipo_dte }); });
      pintar();
    }
    function pintar() {
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico ci-compacto"><div class="ci-barra"><div class="ci-tit"><b>Tipos de documento FEL</b> <span>${esc(empresaDe(ctx))} (catálogo de su organización) · ${filas.length} tipos · equivalencia del código del sistema anterior con el tipo de DTE</span></div></div>
        ${tablaEd(campos(), filas, ctx.admin, (x) => x.id)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', async (e) => {
      const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar();
      const k = e.target.dataset.c; if (!k) return; const tr = e.target.closest('tr[data-id]'); const c = campos().find((x) => x.k === k);
      const v = c.ops ? e.target.value : valorDe(c, e.target);
      const { error } = await sb.from('sat_tipos_documento_fel').update({ [k]: v }).eq('id', Number(tr.dataset.id));
      if (error) { window.FIN.aviso(window.UI.traducirError(error)); return cargar(); }
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfgDe('Tipos de documento FEL', ctx, campos().map((c) => ({ ...c, ops: null })), filas, [`Empresa: ${empresaDe(ctx)} (catálogo de su organización)`]), ex.dataset.exp);
      if (e.target.closest('[data-accion="nuevo"]')) { const { error } = await sb.from('sat_tipos_documento_fel').insert({ organizacion_id: ctx.sel.org, codigo: Math.max(0, ...filas.map((x) => x.codigo)) + 1, tipo_dte: 'FACT', descripcion: 'NUEVO TIPO DE DOCUMENTO' }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); cargar(); }
    });
    iniciar();
  };

  // ===================== 5. Conexión del certificador =====================
  window.PANTALLAS['sat-mant-conexion'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Conexión del certificador', icono: 'ti-plug-connected', clase: 'bk-movimientos bm-solo cx-rep pr-rep sm-fel', grupo: GRUPO });
    const { sb } = ctx;
    let x = null;
    const CAMPOS = [['ambiente', 'Ambiente', [['PRUEBAS', 'Pruebas'], ['PRODUCCION', 'Producción']]], ['url', 'URL del web service (RequestTransaction)'], ['soap_action', 'SOAP Action (solo si el certificador la exige)'], ['transaccion', 'Transacción'], ['dato_certificar', 'Identificador para certificar'],
      ['dato_anular', 'Identificador para anular'], ['transaccion_consulta', 'Transacción de consulta'], ['secreto', 'Prefijo de los secretos']];
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-plug-connected'); return; }
      ctx.filtros('', ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="guardar"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button>' : '');
      const { data, error } = await sb.from('sat_fel_conexiones').select('*').eq('localidad_id', ctx.sel.loc).maybeSingle();
      if (error) return faltaScript(ctx, error, '166 (conexión FEL)');
      x = data || { ambiente: 'PRUEBAS', transaccion: 'SYSTEM_REQUEST', dato_certificar: 'POST_DOCUMENT_SAT', dato_anular: 'VOID_DOCUMENT', secreto: 'COFIDI', activo: false };
      const ed = ctx.admin ? '' : 'disabled';
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico ci-compacto"><div class="ci-barra"><div class="ci-tit"><b>Conexión del certificador</b> <span>${esc(empresaDe(ctx))}${data ? '' : ' · sin conexión registrada'}</span></div></div>
        <p class="cp-aviso sm-nota"><i class="ti ti-lock" aria-hidden="true"></i> El usuario, la contraseña y el requestor del certificador no se guardan aquí ni se migraron del sistema anterior: van como secretos del servidor (&lt;prefijo&gt;_REQUESTOR y &lt;prefijo&gt;_USUARIO).</p>
        <div class="sm-form">${CAMPOS.map(([k, t, ops]) => `<label class="campo ${k === 'url' ? 'sm-ancho' : ''}"><span>${esc(t)}</span>${ops ? `<select name="${k}" ${ed}>${ops.map(([v, l]) => `<option value="${v}" ${x[k] === v ? 'selected' : ''}>${l}</option>`).join('')}</select>` : `<input name="${k}" value="${esc(x[k] || '')}" ${ed} autocomplete="off">`}</label>`).join('')}
          <label class="pc-check"><input type="checkbox" name="activo" ${x.activo ? 'checked' : ''} ${ed}> Conexión activa</label></div>
        ${data ? `<p class="sm-pie">Registrada ${fh(data.creado_en)}${data.modificado_en ? ` · modificada ${fh(data.modificado_en)}` : ''}</p>` : ''}</div>`;
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') cargar(); });
    cont.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-accion="guardar"]')) return;
      const v = { organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, activo: cont.querySelector('[name=activo]').checked, modificado_en: new Date().toISOString() };
      CAMPOS.forEach(([k]) => { const el = cont.querySelector(`[name=${k}]`); v[k] = el.value.trim() || null; });
      ['transaccion', 'dato_certificar', 'dato_anular', 'secreto'].forEach((k) => { if (!v[k]) v[k] = x[k] || ''; });
      if (v.activo && !v.url) return window.FIN.aviso('Para activar la conexión indica la URL del web service');
      const { error } = x.id ? await sb.from('sat_fel_conexiones').update(v).eq('id', x.id) : await sb.from('sat_fel_conexiones').insert(v);
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      window.FIN.aviso('Conexión guardada'); cargar();
    });
    iniciar();
  };
})();
