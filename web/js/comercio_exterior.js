// Importaciones y exportaciones (script 156). Costeo de la póliza de importación:
//   FOB + flete + seguro (en la moneda de la factura) × tipo de cambio = valor CIF en quetzales (valor en aduana).
//   DAI = CIF × % de la partida arancelaria; IVA de importación = (CIF + DAI) × 12 % (crédito fiscal, no es costo).
//   Gastos locales «al costo» (agente aduanal, almacenaje, transporte…) sin su IVA.
//   Flete, seguro y gastos se prorratean por valor FOB, peso o cantidad. Costo = CIF + DAI + gastos; unitario = costo ÷ cantidad.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const M3 = MES.map((m) => m.slice(0, 3));
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const r4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;
  const q = (n) => `Q ${fmt.monto(n)}`;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const G = () => window.GRAFICAS;
  const empresaDe = (ctx) => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
  const faltaScript = (ctx, e) => { ctx.pDet.innerHTML = `<p class="vacio">${/com_/.test(e?.message || '') ? 'Falta instalar el script 156 (Importaciones y exportaciones) en Supabase.' : esc(window.UI.traducirError(e))}</p>`; };
  const ESTADO_CLS = { REGISTRADA: 'pendiente', LIQUIDADA: 'editando', INGRESADA: 'aprobada', DESPACHADA: 'aprobada', ANULADA: 'anulada', 'EN TRÁNSITO': 'editando', 'EN PUERTO': 'pendiente', 'EN ADUANA': 'pendiente', LIBERADO: 'aprobada', ENTREGADO: 'aprobada', PROGRAMADO: 'pendiente' };
  const marca = (e) => `<span class="pc-marca ${ESTADO_CLS[e] || ''}">${esc(e)}</span>`;
  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) { const { data, error } = await hacer().range(i, i + 999); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; }
    return out;
  }
  const botonesExp = '<button type="button" class="boton secundario-sm" data-exp="PDF"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button><button type="button" class="boton secundario-sm" data-exp="EXCEL"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>';
  function tabla(c, graficas = true) {
    const n = c.columnas.length;
    const celda = (v, x) => (v === '' || v == null ? '<td></td>' : typeof v === 'number' ? `<td class="num">${x.tipo === 'monto' ? fmt.monto(v) : x.tipo === 'porcentaje' ? `${(v * 100).toFixed(1)} %` : v.toLocaleString('es-GT', { maximumFractionDigits: 4 })}</td>` : String(v).startsWith('¤') ? `<td>${marca(String(v).slice(1))}</td>` : `<td>${esc(String(v))}</td>`);
    const gs = graficas ? (c.graficas || []).filter(Boolean) : [];
    return `<div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${c.columnas.map((x) => `<th class="${x.tipo === 'texto' ? '' : 'num'}">${esc(x.titulo)}</th>`).join('')}</tr></thead>
      <tbody>${c.filas.length ? c.filas.map((r) => (r.tipo === 'grupo' && r.combinar ? `<tr class="pr-g"><td colspan="${n}">${esc(r.valores[0])}</td></tr>` : `<tr class="${r.tipo === 'subtotal' ? 'pr-s' : r.tipo === 'total' ? 'pr-t' : ''}" ${r.attr || ''}>${c.columnas.map((x, i) => celda(r.valores[i], x)).join('')}</tr>`)).join('') : `<tr><td colspan="${n}" class="tk-vacio">${esc(c.vacio || 'Sin información con esos parámetros.')}</td></tr>`}</tbody></table>
      ${gs.length && c.filas.length ? `<section class="pr-graficas"><h3><i class="ti ti-chart-bar" aria-hidden="true"></i> Gráficas</h3>${gs.join('')}</section>` : ''}</div>`;
  }
  function exportar(c, formato, graficas = true) {
    if (!c || !c.filas.length) return window.FIN.aviso('No hay información con esos parámetros');
    const gs = graficas ? (c.graficas || []).filter(Boolean) : [];
    const s = { ...c, filas: c.filas.map((r) => ({ ...r, valores: r.valores.map((v) => (typeof v === 'string' && v.startsWith('¤') ? v.slice(1) : v)) })) };
    if (formato === 'PDF') return window.CUENTAS_XLSX.pdf({ ...s, graficas: gs.join('') });
    Promise.all(gs.map((g) => G().png(g))).then((imagenes) => window.REPORTE_XLSX.generar({ ...s, imagenes })).catch((e) => window.FIN.aviso(e.message || 'No se pudo generar el Excel'));
  }

  // ---------- Base: catálogos de la empresa ----------
  async function baseComercio(ctx) {
    const { sb } = ctx, loc = ctx.sel.loc;
    const [ad, inc, ag, pa, tr, pr, bo, pv] = await Promise.all([
      sb.from('com_aduanas').select('*').order('codigo'), sb.from('com_incoterms').select('*').order('grupo').order('codigo'),
      sb.from('com_agentes').select('*').eq('localidad_id', loc).order('codigo'), sb.from('com_partidas').select('*').eq('localidad_id', loc).order('codigo'),
      sb.from('com_transportistas').select('*').eq('localidad_id', loc).order('codigo'),
      leerTodo(() => sb.from('productos').select('id, codigo, codigo_producto, nombre').eq('localidad_id', loc).order('nombre')),
      sb.from('bodegas').select('id, codigo, nombre').eq('localidad_id', loc).order('codigo'),
      leerTodo(() => sb.from('proveedores').select('id, codigo, nombre_comercial, nacional').eq('localidad_id', loc).order('nombre_comercial'))]);
    if (ad.error) throw ad.error;
    if (!(pa.data || []).length) { await sb.rpc('com_asegurar_catalogos', { p_localidad: loc }); pa.data = (await sb.from('com_partidas').select('*').eq('localidad_id', loc).order('codigo')).data; }
    return { aduanas: ad.data || [], incoterms: inc.data || [], agentes: ag.data || [], partidas: pa.data || [], transportistas: tr.data || [], productos: pr, bodegas: bo.data || [], proveedores: pv };
  }
  const etqProd = (p) => `${p.nombre} — ${p.codigo_producto || p.codigo}`;

  // ---------- Costeo ----------
  function costear(p, lineas, gastos, B) {
    const k = num(p.tipo_cambio) || 1;
    const base = (l) => (p.metodo_prorrateo === 'PESO' ? num(l.peso) : p.metodo_prorrateo === 'CANTIDAD' ? num(l.cantidad) : num(l.fob_moneda));
    const tb = sum(lineas.map(base)) || 1;
    const gTot = sum(gastos.filter((g) => g.al_costo).map((g) => g.monto_q));
    const ls = lineas.map((l) => {
      const sh = base(l) / tb, pa = B.partidas.find((x) => x.id === l.partida_id);
      const fob = num(l.fob_moneda) * k, flete = num(p.flete_moneda) * k * sh, seguro = num(p.seguro_moneda) * k * sh, cif = fob + flete + seguro;
      const daiPct = num(pa?.dai), dai = cif * daiPct / 100, iva = (cif + dai) * (pa ? num(pa.iva) : 12) / 100, gastosL = gTot * sh, costo = cif + dai + gastosL;
      return { id: l.id, fob_q: r2(fob), flete_q: r2(flete), seguro_q: r2(seguro), cif_q: r2(cif), dai_pct: daiPct, dai_q: r2(dai), iva_q: r2(iva), gastos_q: r2(gastosL), costo_total_q: r2(costo), costo_unitario_q: r4(costo / (num(l.cantidad) || 1)) };
    });
    const S = (key) => r2(sum(ls.map((x) => x[key])));
    return { lineas: ls, tot: { fob_q: S('fob_q'), flete_q: S('flete_q'), seguro_q: S('seguro_q'), cif_q: S('cif_q'), dai_q: S('dai_q'), iva_q: S('iva_q'), gastos_q: S('gastos_q'), costo_total_q: S('costo_total_q'), iva_gastos: r2(sum(gastos.map((g) => g.iva_q))) } };
  }

  // ===================== Catálogos =====================
  function lista(cont, op) {
    const ctx = montar(cont, { titulo: op.titulo, icono: op.icono, clase: 'bk-movimientos bm-solo cx-rep pf-cat', grupo: 'Import. y export. · Catálogos' });
    const { sb } = ctx;
    let filas = [];
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (op.porEmpresa && !ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', op.icono); return; }
      ctx.filtros('', `${ctx.admin && op.nuevo ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>' : ''}${ctx.admin && op.omision ? '<button type="button" class="boton secundario-sm" data-accion="omision"><i class="ti ti-wand" aria-hidden="true"></i> Cargar partidas frecuentes</button>' : ''}${botonesExp}`);
      let qy = sb.from(op.tabla).select('*'); if (op.porEmpresa) qy = qy.eq('localidad_id', ctx.sel.loc);
      const { data, error } = await qy.order(op.orden || 'codigo');
      if (error) return faltaScript(ctx, error);
      filas = data || []; pintar();
    }
    function pintar() {
      const ed = ctx.admin && !op.soloLectura;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> ${op.ayuda}</p><div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${op.campos.map((c) => `<th>${c.titulo}</th>`).join('')}${ed ? '<th></th>' : ''}</tr></thead>
        <tbody>${filas.map((f) => `<tr data-id="${f.id ?? f.codigo}">${op.campos.map((c) => `<td>${!ed || c.ro ? esc(c.tipo === 'check' ? (f[c.k] ? 'Sí' : 'No') : String(f[c.k] ?? '')) : c.opciones ? `<select data-c="${c.k}">${c.opciones.map((o) => `<option ${f[c.k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>` : c.tipo === 'check' ? `<input type="checkbox" data-c="${c.k}" ${f[c.k] ? 'checked' : ''}>` : `<input data-c="${c.k}" value="${esc(String(f[c.k] ?? ''))}" ${c.tipo === 'numero' ? 'type="number" step="any"' : ''}>`}</td>`).join('')}${ed ? '<td><button type="button" class="icono-boton rp-peligro" data-quitar title="Quitar"><i class="ti ti-trash" aria-hidden="true"></i></button></td>' : ''}</tr>`).join('') || `<tr><td colspan="${op.campos.length + 1}" class="tk-vacio">Sin registros.</td></tr>`}</tbody></table></div></div>`;
    }
    const cfg = () => ({ titulo: op.titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: op.titulo.slice(0, 30), archivo: op.tabla, parametros: op.porEmpresa ? [`Empresa: ${empresaDe(ctx)}`] : [], columnas: op.campos.map((c) => col(c.titulo, 'texto', c.ancho || 18)), filas: filas.map((f) => ({ valores: op.campos.map((c) => (c.tipo === 'check' ? (f[c.k] ? 'Sí' : 'No') : String(f[c.k] ?? ''))) })) });
    cont.addEventListener('change', async (e) => {
      const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar();
      const tr = e.target.closest('tr[data-id]'); const k = e.target.dataset.c; if (!tr || !k) return;
      const c = op.campos.find((x) => x.k === k);
      const v = c.tipo === 'check' ? e.target.checked : c.tipo === 'numero' ? num(e.target.value) : e.target.value.trim().toUpperCase();
      const { error } = await sb.from(op.tabla).update({ [k]: v }).eq(op.clave || 'id', op.clave ? tr.dataset.id : Number(tr.dataset.id));
      if (error) { window.FIN.aviso(window.UI.traducirError(error)); cargar(); }
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'nuevo') { const { error } = await sb.from(op.tabla).insert({ ...(op.porEmpresa ? { organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc } : {}), ...op.nuevo(filas) }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); return cargar(); }
      if (a === 'omision') { await sb.rpc('com_asegurar_catalogos', { p_localidad: ctx.sel.loc }); return cargar(); }
      if (e.target.closest('[data-quitar]')) { if (!confirm('¿Quitar el registro?')) return; const tr = e.target.closest('tr'); const { error } = await sb.from(op.tabla).delete().eq(op.clave || 'id', op.clave ? tr.dataset.id : Number(tr.dataset.id)); if (error) return window.FIN.aviso(/foreign|referen/i.test(error.message) ? 'Está en uso: márcalo inactivo' : window.UI.traducirError(error)); cargar(); }
    });
    iniciar();
  }
  const sig = (f) => Math.max(0, ...f.map((x) => Number(x.codigo) || 0)) + 1;
  window.PANTALLAS['com-agentes'] = (cont) => lista(cont, { titulo: 'Agentes aduanales', icono: 'ti-id', tabla: 'com_agentes', porEmpresa: true, ayuda: 'Agentes aduanales autorizados por la SAT con su licencia y honorario de referencia.', campos: [{ k: 'codigo', titulo: 'Código', tipo: 'numero', ancho: 8 }, { k: 'nombre', titulo: 'Nombre', ancho: 34 }, { k: 'nit', titulo: 'NIT' }, { k: 'licencia', titulo: 'Licencia' }, { k: 'telefono', titulo: 'Teléfono' }, { k: 'correo', titulo: 'Correo', ancho: 26 }, { k: 'honorario_pct', titulo: 'Honorario %', tipo: 'numero' }, { k: 'activo', titulo: 'Activo', tipo: 'check' }], nuevo: (f) => ({ codigo: sig(f), nombre: 'NUEVO AGENTE' }) });
  window.PANTALLAS['com-aduanas'] = (cont) => lista(cont, { titulo: 'Aduanas', icono: 'ti-building-community', tabla: 'com_aduanas', soloLectura: false, clave: 'id', ayuda: 'Aduanas de Guatemala por tipo (marítimas, terrestres, aérea, express e internas).', campos: [{ k: 'codigo', titulo: 'Código', ro: true, ancho: 8 }, { k: 'nombre', titulo: 'Nombre', ancho: 36 }, { k: 'tipo', titulo: 'Tipo', opciones: ['MARÍTIMA', 'TERRESTRE', 'AÉREA', 'EXPRESS', 'INTERNA'] }, { k: 'ubicacion', titulo: 'Ubicación' }, { k: 'activo', titulo: 'Activa', tipo: 'check' }] });
  window.PANTALLAS['com-incoterms'] = (cont) => lista(cont, { titulo: 'Incoterms 2020', icono: 'ti-world-share', tabla: 'com_incoterms', soloLectura: true, orden: 'grupo', ayuda: 'Términos de comercio internacional: definen quién paga el flete y el seguro y, por tanto, qué se suma al valor FOB para el CIF.', campos: [{ k: 'codigo', titulo: 'Código', ancho: 8 }, { k: 'nombre', titulo: 'Nombre', ancho: 30 }, { k: 'grupo', titulo: 'Grupo', ancho: 6 }, { k: 'flete_comprador', titulo: 'Flete del comprador', tipo: 'check' }, { k: 'seguro_comprador', titulo: 'Seguro del comprador', tipo: 'check' }, { k: 'descripcion', titulo: 'Descripción', ancho: 50 }] });
  window.PANTALLAS['com-partidas'] = (cont) => lista(cont, { titulo: 'Partidas arancelarias', icono: 'ti-barcode', tabla: 'com_partidas', porEmpresa: true, omision: true, ayuda: 'Partidas del Sistema Arancelario Centroamericano (SAC) con su DAI y su IVA. Verifica las tasas vigentes en el arancel publicado por la SAT.', campos: [{ k: 'codigo', titulo: 'Partida SAC', ancho: 14 }, { k: 'descripcion', titulo: 'Descripción', ancho: 44 }, { k: 'dai', titulo: 'DAI %', tipo: 'numero', ancho: 8 }, { k: 'iva', titulo: 'IVA %', tipo: 'numero', ancho: 8 }, { k: 'observaciones', titulo: 'Observaciones', ancho: 30 }, { k: 'activo', titulo: 'Activa', tipo: 'check' }], nuevo: (f) => ({ codigo: `0000.00.${String(f.length + 1).padStart(2, '0')}`, descripcion: 'NUEVA PARTIDA' }) });
  window.PANTALLAS['com-transportistas'] = (cont) => lista(cont, { titulo: 'Navieras y transportistas', icono: 'ti-ship', tabla: 'com_transportistas', porEmpresa: true, ayuda: 'Navieras, aerolíneas, transportistas terrestres y couriers.', campos: [{ k: 'codigo', titulo: 'Código', tipo: 'numero', ancho: 8 }, { k: 'nombre', titulo: 'Nombre', ancho: 34 }, { k: 'tipo', titulo: 'Tipo', opciones: ['NAVIERA', 'AÉREA', 'TERRESTRE', 'COURIER'] }, { k: 'contacto', titulo: 'Contacto' }, { k: 'telefono', titulo: 'Teléfono' }, { k: 'correo', titulo: 'Correo', ancho: 26 }, { k: 'activo', titulo: 'Activo', tipo: 'check' }], nuevo: (f) => ({ codigo: sig(f), nombre: 'NUEVO TRANSPORTISTA' }) });

  // ===================== Pólizas de importación (registro y liquidación) =====================
  function polizas(cont, modo) {
    const ctx = montar(cont, { titulo: modo === 'LIQ' ? 'Liquidación de pólizas' : 'Pólizas de importación', icono: modo === 'LIQ' ? 'ti-calculator' : 'ti-file-import', clase: 'bk-movimientos bm-solo cx-rep pr-rep com-pol', grupo: `Import. y export. · ${modo === 'LIQ' ? 'Procesos' : 'Registros'}` });
    const { sb } = ctx;
    const f = { anio: new Date().getFullYear(), estado: modo === 'LIQ' ? 'REGISTRADA' : 'TODAS' };
    let B = null, lista0 = [], actual = null, lineas = [], gastos = [], nueva = false;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar(id = actual?.id) {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-file-import'); return; }
      try { B = await baseComercio(ctx); } catch (e) { return faltaScript(ctx, e); }
      let qy = sb.from('com_polizas').select('*').eq('localidad_id', ctx.sel.loc).gte('fecha', `${f.anio}-01-01`).lte('fecha', `${f.anio}-12-31`).order('numero', { ascending: false });
      if (f.estado !== 'TODAS') qy = qy.eq('estado', f.estado);
      lista0 = (await qy).data || [];
      actual = lista0.find((p) => p.id === id) || (nueva ? null : lista0[0]) || null;
      if (actual) { const [l, g] = await Promise.all([sb.from('com_poliza_lineas').select('*').eq('poliza_id', actual.id).order('linea'), sb.from('com_gastos').select('*').eq('poliza_id', actual.id).order('id')]); lineas = l.data || []; gastos = g.data || []; } else { lineas = []; gastos = []; }
      ctx.filtros(`<label class="campo cx-anio"><span>Año</span><input type="number" name="anio" value="${f.anio}" min="2000" max="2999"></label><label class="campo"><span>Estado</span><select name="estado">${['TODAS', 'REGISTRADA', 'LIQUIDADA', 'INGRESADA', 'ANULADA'].map((x) => `<option ${f.estado === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="campo"><span>Póliza</span><select name="pol">${lista0.map((p) => `<option value="${p.id}" ${actual?.id === p.id ? 'selected' : ''}>No. ${p.numero} · ${esc(p.duca || 'sin DUCA')} · ${esc(p.proveedor_nombre)} · ${p.estado}</option>`).join('') || '<option value="">Sin pólizas</option>'}</select></label>`,
        `${ctx.admin && modo !== 'LIQ' ? '<button type="button" class="boton primario-sm" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva póliza</button>' : ''}${botonesExp}`);
      pintar();
    }
    const opt = (lst, sel, val, txt, vacio = true) => `${vacio ? '<option value="">—</option>' : ''}${lst.map((x) => `<option value="${x[val]}" ${String(sel ?? '') === String(x[val]) ? 'selected' : ''}>${esc(txt(x))}</option>`).join('')}`;
    function encabezado(p) {
      const v = p || { fecha: fmt.hoy(), tipo_duca: 'DUCA-D', incoterm: 'FOB', tipo_cambio: 7.7, metodo_prorrateo: 'VALOR', moneda_id: ctx.monedas.find((m) => m.iso === 'USD')?.id };
      const ed = ctx.admin && (!p || p.estado === 'REGISTRADA'), dis = ed ? '' : 'disabled';
      const t = (k, l, x = '') => `<label class="campo ${x}"><span>${l}</span><input name="${k}" value="${esc(String(v[k] ?? ''))}" ${dis}></label>`;
      const n = (k, l, st = '0.01') => `<label class="campo"><span>${l}</span><input type="number" step="${st}" name="${k}" value="${v[k] ?? ''}" ${dis}></label>`;
      return `<form class="com-enc" novalidate><div class="sat-g">
        <label class="campo"><span>Tipo de DUCA</span><select name="tipo_duca" ${dis}>${['DUCA-D', 'DUCA-F', 'DUCA-T'].map((x) => `<option ${v.tipo_duca === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>${t('duca', 'Número de DUCA')}<label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${v.fecha || ''}" ${dis}></label><label class="campo"><span>Llegada a bodega</span><input type="date" name="fecha_llegada" value="${v.fecha_llegada || ''}" ${dis}></label>
        <label class="campo sat-ancho"><span>Proveedor del exterior *</span><input name="proveedor_nombre" list="com-prov" value="${esc(v.proveedor_nombre || '')}" ${dis}></label>${t('factura_exterior', 'Factura del exterior')}${t('pais_origen', 'País de origen')}
        <label class="campo"><span>Incoterm</span><select name="incoterm" ${dis}>${opt(B.incoterms, v.incoterm, 'codigo', (x) => `${x.codigo} · ${x.nombre}`)}</select></label><label class="campo"><span>Moneda</span><select name="moneda_id" ${dis}>${opt(ctx.monedas, v.moneda_id, 'id', (x) => `${x.iso} · ${x.nombre}`, false)}</select></label>${n('tipo_cambio', 'Tipo de cambio', '0.000001')}
        <label class="campo"><span>Aduana</span><select name="aduana_id" ${dis}>${opt(B.aduanas, v.aduana_id, 'id', (x) => `${x.codigo} · ${x.nombre}`)}</select></label><label class="campo"><span>Agente aduanal</span><select name="agente_id" ${dis}>${opt(B.agentes, v.agente_id, 'id', (x) => x.nombre)}</select></label><label class="campo"><span>Transportista</span><select name="transportista_id" ${dis}>${opt(B.transportistas, v.transportista_id, 'id', (x) => x.nombre)}</select></label>
        ${t('documento_transporte', 'BL / guía aérea / carta de porte')}${t('contenedor', 'Contenedor')}
        ${n('flete_moneda', 'Flete internacional (moneda)')}${n('seguro_moneda', 'Seguro (moneda)')}<label class="campo"><span>Prorrateo</span><select name="metodo_prorrateo" ${dis}>${[['VALOR', 'Por valor FOB'], ['PESO', 'Por peso'], ['CANTIDAD', 'Por cantidad']].map(([a, b]) => `<option value="${a}" ${v.metodo_prorrateo === a ? 'selected' : ''}>${b}</option>`).join('')}</select></label><label class="campo"><span>Bodega de ingreso</span><select name="bodega_id" ${dis}>${opt(B.bodegas, v.bodega_id, 'id', (x) => `${x.codigo} · ${x.nombre}`)}</select></label>
        ${t('observaciones', 'Observaciones', 'sat-ancho')}</div><datalist id="com-prov">${B.proveedores.map((x) => `<option value="${esc(x.nombre_comercial)}"></option>`).join('')}</datalist>
        <p class="modal-error tk-error" role="alert"></p>${ed ? `<div class="pr-nueva-acc">${p ? '' : '<button type="button" class="boton secundario-sm" data-accion="cancelar">Cancelar</button>'}<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${p ? 'Guardar encabezado' : 'Crear póliza'}</button></div>` : ''}</form>`;
    }
    function cfgCosto() {
      const C = costear(actual, lineas, gastos, B), p = actual;
      const filas = lineas.map((l, i) => { const c = C.lineas[i], pr = B.productos.find((x) => x.id === l.producto_id), pa = B.partidas.find((x) => x.id === l.partida_id); return { valores: [l.linea, pr ? (pr.codigo_producto || String(pr.codigo)) : '', l.descripcion, pa?.codigo || '', num(l.cantidad), r2(num(l.fob_moneda)), c.fob_q, c.flete_q, c.seguro_q, c.cif_q, c.dai_pct / 100, c.dai_q, c.iva_q, c.gastos_q, c.costo_total_q, c.costo_unitario_q], attr: `data-l="${l.id}"` }; });
      filas.push({ valores: ['Total', '', '', '', r2(sum(lineas.map((l) => l.cantidad))), r2(sum(lineas.map((l) => l.fob_moneda))), C.tot.fob_q, C.tot.flete_q, C.tot.seguro_q, C.tot.cif_q, '', C.tot.dai_q, C.tot.iva_q, C.tot.gastos_q, C.tot.costo_total_q, ''], tipo: 'total' });
      const mon = ctx.moneda(p.moneda_id)?.iso || '';
      return { C, titulo: `Liquidación de póliza de importación No. ${p.numero}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Poliza', archivo: `poliza_${p.numero}`, firmas: ['Elaboró', 'Revisó', 'Autorizó'],
        parametros: [`Empresa: ${empresaDe(ctx)}`, `${p.tipo_duca} ${p.duca || ''}`, `Proveedor: ${p.proveedor_nombre}`, `Incoterm ${p.incoterm || '—'} · ${mon} × ${p.tipo_cambio}`, `Prorrateo por ${p.metodo_prorrateo.toLowerCase()}`, `Estado: ${p.estado}`],
        columnas: [col('#', 'entero', 5), col('Código', 'texto', 10), col('Descripción', 'texto', 30), col('Partida', 'texto', 11), col('Cantidad', 'numero', 9), col(`FOB ${mon}`, 'monto', 12), col('FOB Q', 'monto', 12), col('Flete Q', 'monto', 11), col('Seguro Q', 'monto', 10), col('CIF Q', 'monto', 12), col('DAI %', 'porcentaje', 7), col('DAI Q', 'monto', 11), col('IVA Q', 'monto', 11), col('Gastos Q', 'monto', 11), col('Costo Q', 'monto', 13), col('Unitario Q', 'numero', 11)], filas,
        graficas: [G().barras('Composición del costo de la importación (Q)', [['Valor FOB', C.tot.fob_q], ['Flete', C.tot.flete_q], ['Seguro', C.tot.seguro_q], ['DAI', C.tot.dai_q], ['Gastos locales', C.tot.gastos_q]].map(([t, v]) => ({ etiqueta: t, valor: v, texto: `${q(v)} · ${C.tot.costo_total_q ? ((v / C.tot.costo_total_q) * 100).toFixed(1) : 0} %` })))] };
    }
    function pintar() {
      if (nueva) { ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="cl-banda">Nueva póliza de importación</div>${encabezado(null)}</div>`; return; }
      const p = actual;
      if (!p) { ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="ck-elige"><i class="ti ti-file-import" aria-hidden="true"></i> No hay pólizas${f.estado !== 'TODAS' ? ` ${f.estado.toLowerCase()}s` : ''} en ${f.anio}. ${ctx.admin && modo !== 'LIQ' ? 'Crea una con «Nueva póliza».' : ''}</p></div>`; return; }
      const c = cfgCosto(), C = c.C, ed = ctx.admin && p.estado === 'REGISTRADA';
      const inc = B.incoterms.find((x) => x.codigo === p.incoterm);
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">
        <section class="pr-cab"><div class="pr-id"><small>Póliza de importación</small><b>No. ${p.numero}</b>${marca(p.estado)}</div>
          <div class="pr-datos"><span><small>${esc(p.tipo_duca)}</small>${esc(p.duca || 'sin número')}</span><span><small>Proveedor</small>${esc(p.proveedor_nombre)}</span><span><small>Aduana</small>${esc(B.aduanas.find((x) => x.id === p.aduana_id)?.nombre || '—')}</span><span><small>Incoterm</small>${esc(p.incoterm || '—')}</span><span><small>Elaboró</small>${esc(p.usuario || '')}</span>${p.liquidada_por ? `<span><small>Liquidó</small>${esc(p.liquidada_por)}</span>` : ''}${p.ingresada_por ? `<span><small>Ingresó a bodega</small>${esc(p.ingresada_por)}</span>` : ''}${p.motivo_anulacion ? `<span class="pc-rojo"><small>Anulada</small>${esc(p.motivo_anulacion)}</span>` : ''}</div>
          <div class="pr-acc">${ctx.admin && p.estado === 'REGISTRADA' ? '<button type="button" class="boton primario-sm" data-accion="liquidar"><i class="ti ti-calculator" aria-hidden="true"></i> Liquidar</button>' : ''}${ctx.admin && p.estado === 'LIQUIDADA' ? '<button type="button" class="boton primario-sm" data-accion="ingresar"><i class="ti ti-building-warehouse" aria-hidden="true"></i> Ingresar a bodega</button>' : ''}${ctx.admin && ['REGISTRADA', 'LIQUIDADA'].includes(p.estado) ? '<button type="button" class="boton secundario-sm" data-accion="anular"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>' : ''}</div></section>
        <ol class="pf-ciclo">${['Registrar', 'Liquidar', 'Ingresar a bodega'].map((t, i) => { const k = { REGISTRADA: 0, LIQUIDADA: 1, INGRESADA: 3 }[p.estado] ?? 0; return `<li class="${i < k ? 'hecho' : i === k ? 'actual' : ''}">${t}</li>`; }).join('')}</ol>
        <div class="ec-kpis">${kpi('Valor CIF', q(C.tot.cif_q))}${kpi('DAI', q(C.tot.dai_q))}${kpi('IVA importación (crédito)', q(C.tot.iva_q))}${kpi('Gastos al costo', q(C.tot.gastos_q))}${kpi('Costo total', q(C.tot.costo_total_q), 'ec-fin')}${kpi('Costo sobre FOB', C.tot.fob_q ? `+${(((C.tot.costo_total_q / C.tot.fob_q) - 1) * 100).toFixed(1)} %` : '—')}</div>
        ${inc && !inc.flete_comprador && num(p.flete_moneda) ? '<p class="pr-guia pc-rojo"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Con este Incoterm el flete lo paga el vendedor: revisa que no se sume dos veces.</p>' : ''}
        <details ${ed ? 'open' : ''} class="com-det"><summary>Encabezado de la póliza</summary>${encabezado(p)}</details>
        ${ed ? `<form class="pf-modform com-lin" novalidate><label class="campo sat-ancho"><span>Producto</span><input name="producto" list="com-prods" placeholder="Nombre o código" autocomplete="off"></label><label class="campo"><span>Descripción</span><input name="descripcion"></label><label class="campo"><span>Partida</span><select name="partida">${opt(B.partidas, '', 'id', (x) => `${x.codigo} (${x.dai} %)`)}</select></label><label class="campo"><span>Cantidad</span><input type="number" name="cantidad" step="any" min="0"></label><label class="campo"><span>Peso kg</span><input type="number" name="peso" step="any" min="0" value="0"></label><label class="campo"><span>FOB (moneda)</span><input type="number" name="fob" step="0.01" min="0"></label><label class="campo"><span>Lote</span><input name="lote"></label><label class="campo"><span>Vence</span><input type="date" name="vence"></label><button type="submit" class="boton primario-sm"><i class="ti ti-plus" aria-hidden="true"></i> Agregar producto</button><p class="modal-error tk-error" role="alert"></p></form><datalist id="com-prods">${B.productos.map((x) => `<option value="${esc(etqProd(x))}"></option>`).join('')}</datalist>` : ''}
        ${tabla(c)}
        <div class="cl-banda">Gastos locales de la importación</div>
        ${ed ? `<form class="pf-modform com-gas" novalidate><label class="campo"><span>Tipo</span><select name="tipo">${['AGENTE ADUANAL', 'ALMACENAJE', 'TRANSPORTE INTERNO', 'MANEJO Y ESTIBA', 'FLETE LOCAL', 'SEGURO LOCAL', 'TRÁMITES', 'OTROS'].map((x) => `<option>${x}</option>`).join('')}</select></label><label class="campo"><span>Proveedor</span><input name="proveedor"></label><label class="campo"><span>Documento</span><input name="documento"></label><label class="campo"><span>Monto sin IVA Q</span><input type="number" name="monto" step="0.01" min="0"></label><label class="campo"><span>IVA Q</span><input type="number" name="iva" step="0.01" min="0" value="0"></label><label class="pc-check"><input type="checkbox" name="costo" checked> Va al costo</label><button type="submit" class="boton secundario-sm"><i class="ti ti-plus" aria-hidden="true"></i> Agregar gasto</button></form>` : ''}
        ${tabla({ columnas: [col('Tipo', 'texto'), col('Proveedor', 'texto'), col('Documento', 'texto'), col('Monto Q', 'monto'), col('IVA Q', 'monto'), col('Al costo', 'texto')], filas: gastos.map((g) => ({ valores: [g.tipo, g.proveedor || '', g.documento || '', r2(g.monto_q), r2(g.iva_q), g.al_costo ? 'Sí' : 'No'], attr: `data-g="${g.id}"` })), vacio: 'Sin gastos locales.' }, false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    const leerEnc = (el) => ({ tipo_duca: el.tipo_duca.value, duca: el.duca.value.trim() || null, fecha: el.fecha.value, fecha_llegada: el.fecha_llegada.value || null, proveedor_nombre: el.proveedor_nombre.value.trim().toUpperCase(), factura_exterior: el.factura_exterior.value.trim() || null, pais_origen: el.pais_origen.value.trim().toUpperCase() || null,
      incoterm: el.incoterm.value || null, moneda_id: Number(el.moneda_id.value) || null, tipo_cambio: num(el.tipo_cambio.value) || 1, aduana_id: Number(el.aduana_id.value) || null, agente_id: Number(el.agente_id.value) || null, transportista_id: Number(el.transportista_id.value) || null,
      documento_transporte: el.documento_transporte.value.trim() || null, contenedor: el.contenedor.value.trim() || null, flete_moneda: num(el.flete_moneda.value), seguro_moneda: num(el.seguro_moneda.value), metodo_prorrateo: el.metodo_prorrateo.value, bodega_id: Number(el.bodega_id.value) || null, observaciones: el.observaciones.value.trim() || null,
      proveedor_id: B.proveedores.find((x) => x.nombre_comercial === el.proveedor_nombre.value.trim())?.id || null });
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(null); if (!e.target.closest('.bk-filtros')) return; const n = e.target.name; if (n === 'anio') { f.anio = Number(e.target.value) || f.anio; return cargar(null); } if (n === 'estado') { f.estado = e.target.value; return cargar(null); } if (n === 'pol') { nueva = false; return cargar(Number(e.target.value)); } });
    cont.addEventListener('submit', async (e) => {
      e.preventDefault();
      const el = e.target.elements, err = e.target.querySelector('.modal-error');
      if (e.target.matches('.com-enc')) {
        const v = leerEnc(el); if (!v.proveedor_nombre) { err.textContent = 'Escribe el proveedor.'; return; }
        const r = nueva ? await sb.from('com_polizas').insert({ ...v, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, numero: 0 }).select('id').single() : await sb.from('com_polizas').update(v).eq('id', actual.id).select('id').single();
        if (r.error) { err.textContent = window.UI.traducirError(r.error); return; }
        nueva = false; window.FIN.aviso('Póliza guardada'); return cargar(r.data.id);
      }
      if (e.target.matches('.com-lin')) {
        const t = el.producto.value.trim(); const pr = B.productos.find((x) => etqProd(x) === t || x.codigo_producto === t);
        if (!num(el.cantidad.value) || !num(el.fob.value)) { err.textContent = 'Escribe la cantidad y el valor FOB.'; return; }
        const { error } = await sb.from('com_poliza_lineas').insert({ poliza_id: actual.id, linea: lineas.length + 1, producto_id: pr?.id || null, descripcion: (el.descripcion.value.trim() || pr?.nombre || t || 'PRODUCTO').toUpperCase(), partida_id: Number(el.partida.value) || null, cantidad: num(el.cantidad.value), peso: num(el.peso.value), fob_moneda: num(el.fob.value), lote: el.lote.value.trim() || null, fecha_vencimiento: el.vence.value || null });
        if (error) { err.textContent = window.UI.traducirError(error); return; }
        return cargar();
      }
      if (e.target.matches('.com-gas')) {
        if (!num(el.monto.value)) return window.FIN.aviso('Escribe el monto');
        const { error } = await sb.from('com_gastos').insert({ poliza_id: actual.id, tipo: el.tipo.value, proveedor: el.proveedor.value.trim() || null, documento: el.documento.value.trim() || null, fecha: fmt.hoy(), monto_q: num(el.monto.value), iva_q: num(el.iva.value), al_costo: el.costo.checked });
        if (error) return window.FIN.aviso(window.UI.traducirError(error));
        return cargar();
      }
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return actual ? exportar(cfgCosto(), ex.dataset.exp) : null;
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'nueva') { nueva = true; actual = null; return pintar(); }
      if (a === 'cancelar') { nueva = false; return cargar(); }
      if (a === 'liquidar') { const C = costear(actual, lineas, gastos, B); if (!lineas.length) return window.FIN.aviso('Agrega los productos'); if (!confirm(`¿Liquidar la póliza ${actual.numero}?\n\nCIF ${q(C.tot.cif_q)} · DAI ${q(C.tot.dai_q)} · IVA ${q(C.tot.iva_q)} · gastos ${q(C.tot.gastos_q)}\nCosto total ${q(C.tot.costo_total_q)}`)) return; const { error } = await sb.rpc('com_liquidar_poliza', { p_id: actual.id, p_lineas: C.lineas, p_totales: C.tot }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); window.FIN.aviso('Póliza liquidada'); return cargar(); }
      if (a === 'ingresar') { if (!confirm('¿Ingresar los productos a la bodega con su costo liquidado?')) return; const { data, error } = await sb.rpc('com_ingresar_inventario', { p_id: actual.id }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); window.FIN.aviso(`${data} producto(s) ingresado(s) a la bodega`); return cargar(); }
      if (a === 'anular') { const m = prompt('Motivo de la anulación:'); if (!m) return; const { error } = await sb.rpc('com_anular_poliza', { p_id: actual.id, p_motivo: m }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); return cargar(); }
      const trl = e.target.closest('tr[data-l]'); if (trl && ctx.admin && actual?.estado === 'REGISTRADA') { if (!confirm('¿Quitar el producto de la póliza?')) return; await sb.from('com_poliza_lineas').delete().eq('id', Number(trl.dataset.l)); return cargar(); }
      const trg = e.target.closest('tr[data-g]'); if (trg && ctx.admin && actual?.estado === 'REGISTRADA') { if (!confirm('¿Quitar el gasto?')) return; await sb.from('com_gastos').delete().eq('id', Number(trg.dataset.g)); return cargar(); }
    });
    iniciar();
  }
  window.PANTALLAS['com-polizas'] = (cont) => polizas(cont, 'REG');
  window.PANTALLAS['com-liquidacion'] = (cont) => polizas(cont, 'LIQ');

  // ===================== Exportaciones =====================
  window.PANTALLAS['com-exportaciones'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Exportaciones', icono: 'ti-file-export', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Import. y export. · Registros' });
    const { sb } = ctx;
    const f = { anio: new Date().getFullYear() };
    let B = null, ls0 = [], actual = null, lineas = [], nueva = false;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar(id = actual?.id) {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-file-export'); return; }
      try { B = await baseComercio(ctx); } catch (e) { return faltaScript(ctx, e); }
      ls0 = (await sb.from('com_exportaciones').select('*').eq('localidad_id', ctx.sel.loc).gte('fecha', `${f.anio}-01-01`).lte('fecha', `${f.anio}-12-31`).order('numero', { ascending: false })).data || [];
      actual = ls0.find((x) => x.id === id) || (nueva ? null : ls0[0]) || null;
      lineas = actual ? (await sb.from('com_exportacion_lineas').select('*').eq('exportacion_id', actual.id).order('linea')).data || [] : [];
      ctx.filtros(`<label class="campo cx-anio"><span>Año</span><input type="number" name="anio" value="${f.anio}"></label><label class="campo"><span>Exportación</span><select name="exp">${ls0.map((x) => `<option value="${x.id}" ${actual?.id === x.id ? 'selected' : ''}>No. ${x.numero} · ${esc(x.cliente_nombre)} · ${esc(x.pais_destino)} · ${x.estado}</option>`).join('') || '<option value="">Sin exportaciones</option>'}</select></label>`,
        `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva exportación</button>' : ''}${botonesExp}`);
      pintar();
    }
    const opt = (lst, sel, val, txt) => `<option value="">—</option>${lst.map((x) => `<option value="${x[val]}" ${String(sel ?? '') === String(x[val]) ? 'selected' : ''}>${esc(txt(x))}</option>`).join('')}`;
    function form(x) {
      const v = x || { fecha: fmt.hoy(), incoterm: 'FOB', tipo_cambio: 7.7, moneda_id: ctx.monedas.find((m) => m.iso === 'USD')?.id };
      const ed = ctx.admin && (!x || x.estado === 'REGISTRADA'), dis = ed ? '' : 'disabled';
      const t = (k, l, c = '') => `<label class="campo ${c}"><span>${l}</span><input name="${k}" value="${esc(String(v[k] ?? ''))}" ${dis}></label>`;
      const n = (k, l, st = '0.01') => `<label class="campo"><span>${l}</span><input type="number" step="${st}" name="${k}" value="${v[k] ?? ''}" ${dis}></label>`;
      return `<form class="com-exp" novalidate><div class="sat-g">${t('duca', 'DUCA de exportación')}<label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${v.fecha || ''}" ${dis}></label>${t('cliente_nombre', 'Cliente del exterior *', 'sat-ancho')}${t('pais_destino', 'País de destino *')}
        <label class="campo"><span>Incoterm</span><select name="incoterm" ${dis}>${opt(B.incoterms, v.incoterm, 'codigo', (i) => `${i.codigo} · ${i.nombre}`)}</select></label><label class="campo"><span>Moneda</span><select name="moneda_id" ${dis}>${opt(ctx.monedas, v.moneda_id, 'id', (m) => m.iso)}</select></label>${n('tipo_cambio', 'Tipo de cambio', '0.000001')}${t('factura', 'Factura de exportación')}
        <label class="campo"><span>Aduana de salida</span><select name="aduana_id" ${dis}>${opt(B.aduanas, v.aduana_id, 'id', (a) => a.nombre)}</select></label><label class="campo"><span>Agente aduanal</span><select name="agente_id" ${dis}>${opt(B.agentes, v.agente_id, 'id', (a) => a.nombre)}</select></label><label class="campo"><span>Transportista</span><select name="transportista_id" ${dis}>${opt(B.transportistas, v.transportista_id, 'id', (a) => a.nombre)}</select></label>${t('documento_transporte', 'BL / guía')}
        ${n('flete', 'Flete (moneda)')}${n('seguro', 'Seguro (moneda)')}${t('observaciones', 'Observaciones', 'sat-ancho')}</div>
        <p class="modal-error tk-error" role="alert"></p>${ed ? `<div class="pr-nueva-acc">${x ? '' : '<button type="button" class="boton secundario-sm" data-accion="cancelar">Cancelar</button>'}<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button></div>` : ''}</form>`;
    }
    const cfg = () => { const x = actual, mon = ctx.moneda(x.moneda_id)?.iso || ''; return { titulo: `Exportación No. ${x.numero}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Exportacion', archivo: `exportacion_${x.numero}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `Cliente: ${x.cliente_nombre}`, `Destino: ${x.pais_destino}`, `Incoterm ${x.incoterm || ''} · ${mon} × ${x.tipo_cambio}`, `Estado: ${x.estado}`],
      columnas: [col('#', 'entero', 5), col('Descripción', 'texto', 40), col('Partida', 'texto', 12), col('Cantidad', 'numero', 10), col('Peso kg', 'numero', 10), col(`Valor ${mon}`, 'monto', 14), col('Valor Q', 'monto', 14)],
      filas: [...lineas.map((l) => ({ valores: [l.linea, l.descripcion, B.partidas.find((p) => p.id === l.partida_id)?.codigo || '', num(l.cantidad), num(l.peso), r2(l.valor), r2(num(l.valor) * num(x.tipo_cambio))], attr: `data-l="${l.id}"` })), { valores: ['Total FOB', '', '', '', '', r2(sum(lineas.map((l) => l.valor))), r2(sum(lineas.map((l) => l.valor)) * num(x.tipo_cambio))], tipo: 'total' }] }; };
    async function totalizar() { const fob = sum(lineas.map((l) => l.valor)); const tot = fob + num(actual.flete) + num(actual.seguro); await sb.from('com_exportaciones').update({ valor_fob: r2(fob), valor_total: r2(tot), valor_q: r2(tot * num(actual.tipo_cambio)) }).eq('id', actual.id); }
    function pintar() {
      if (nueva) { ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="cl-banda">Nueva exportación</div>${form(null)}</div>`; return; }
      const x = actual; if (!x) { ctx.pDet.innerHTML = '<div class="bm-form cx-form cl-clasico"><p class="ck-elige"><i class="ti ti-file-export" aria-hidden="true"></i> No hay exportaciones en el año.</p></div>'; return; }
      const ed = ctx.admin && x.estado === 'REGISTRADA';
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><section class="pr-cab"><div class="pr-id"><small>Exportación</small><b>No. ${x.numero}</b>${marca(x.estado)}</div><div class="pr-datos"><span><small>Cliente</small>${esc(x.cliente_nombre)}</span><span><small>Destino</small>${esc(x.pais_destino)}</span><span><small>DUCA</small>${esc(x.duca || '—')}</span><span><small>Valor total</small>${fmt.monto(x.valor_total)} · ${q(x.valor_q)}</span></div>
        <div class="pr-acc">${ed ? '<button type="button" class="boton primario-sm" data-accion="despachar"><i class="ti ti-truck-delivery" aria-hidden="true"></i> Marcar despachada</button><button type="button" class="boton secundario-sm" data-accion="anular"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>' : ''}</div></section>
        <details ${ed ? 'open' : ''} class="com-det"><summary>Datos de la exportación</summary>${form(x)}</details>
        ${ed ? `<form class="pf-modform com-elin" novalidate><label class="campo sat-ancho"><span>Producto o descripción</span><input name="descripcion" list="com-prods2"></label><label class="campo"><span>Partida</span><select name="partida">${opt(B.partidas, '', 'id', (p) => p.codigo)}</select></label><label class="campo"><span>Cantidad</span><input type="number" name="cantidad" step="any"></label><label class="campo"><span>Peso kg</span><input type="number" name="peso" step="any" value="0"></label><label class="campo"><span>Valor (moneda)</span><input type="number" name="valor" step="0.01"></label><button type="submit" class="boton primario-sm"><i class="ti ti-plus" aria-hidden="true"></i> Agregar</button></form><datalist id="com-prods2">${B.productos.map((p) => `<option value="${esc(etqProd(p))}"></option>`).join('')}</datalist>` : ''}
        ${tabla(cfg(), false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(null); if (!e.target.closest('.bk-filtros')) return; if (e.target.name === 'anio') { f.anio = Number(e.target.value) || f.anio; return cargar(null); } if (e.target.name === 'exp') { nueva = false; return cargar(Number(e.target.value)); } });
    cont.addEventListener('submit', async (e) => {
      e.preventDefault(); const el = e.target.elements;
      if (e.target.matches('.com-exp')) {
        const v = { duca: el.duca.value.trim() || null, fecha: el.fecha.value, cliente_nombre: el.cliente_nombre.value.trim().toUpperCase(), pais_destino: el.pais_destino.value.trim().toUpperCase(), incoterm: el.incoterm.value || null, moneda_id: Number(el.moneda_id.value) || null, tipo_cambio: num(el.tipo_cambio.value) || 1, factura: el.factura.value.trim() || null, aduana_id: Number(el.aduana_id.value) || null, agente_id: Number(el.agente_id.value) || null, transportista_id: Number(el.transportista_id.value) || null, documento_transporte: el.documento_transporte.value.trim() || null, flete: num(el.flete.value), seguro: num(el.seguro.value), observaciones: el.observaciones.value.trim() || null };
        if (!v.cliente_nombre || !v.pais_destino) { e.target.querySelector('.modal-error').textContent = 'Escribe el cliente y el país de destino.'; return; }
        const r = nueva ? await sb.from('com_exportaciones').insert({ ...v, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, numero: 0 }).select('id').single() : await sb.from('com_exportaciones').update(v).eq('id', actual.id).select('id').single();
        if (r.error) { e.target.querySelector('.modal-error').textContent = window.UI.traducirError(r.error); return; }
        nueva = false; await cargar(r.data.id); await totalizar(); return cargar(r.data.id);
      }
      if (e.target.matches('.com-elin')) {
        const t = el.descripcion.value.trim(); const pr = B.productos.find((p) => etqProd(p) === t);
        if (!num(el.cantidad.value)) return window.FIN.aviso('Escribe la cantidad');
        const { error } = await sb.from('com_exportacion_lineas').insert({ exportacion_id: actual.id, linea: lineas.length + 1, producto_id: pr?.id || null, descripcion: (pr?.nombre || t || 'PRODUCTO').toUpperCase(), partida_id: Number(el.partida.value) || null, cantidad: num(el.cantidad.value), peso: num(el.peso.value), valor: num(el.valor.value) });
        if (error) return window.FIN.aviso(window.UI.traducirError(error));
        await cargar(); await totalizar(); return cargar();
      }
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return actual ? exportar(cfg(), ex.dataset.exp, false) : null;
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'nueva') { nueva = true; actual = null; return pintar(); }
      if (a === 'cancelar') { nueva = false; return cargar(); }
      if (a === 'despachar' || a === 'anular') { if (!confirm(a === 'despachar' ? '¿Marcar la exportación como despachada?' : '¿Anular la exportación?')) return; await sb.from('com_exportaciones').update({ estado: a === 'despachar' ? 'DESPACHADA' : 'ANULADA' }).eq('id', actual.id); return cargar(); }
      const tr = e.target.closest('tr[data-l]'); if (tr && ctx.admin && actual?.estado === 'REGISTRADA') { if (!confirm('¿Quitar la línea?')) return; await sb.from('com_exportacion_lineas').delete().eq('id', Number(tr.dataset.l)); await cargar(); await totalizar(); return cargar(); }
    });
    iniciar();
  };

  // ===================== Embarques =====================
  window.PANTALLAS['com-embarques'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Embarques', icono: 'ti-ship', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Import. y export. · Registros' });
    const { sb } = ctx;
    const ESTADOS = ['PROGRAMADO', 'EN TRÁNSITO', 'EN PUERTO', 'EN ADUANA', 'LIBERADO', 'ENTREGADO'];
    let B = null, ems = [], pols = [], exps = [], ver = 'ACTIVOS';
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-ship'); return; }
      try { B = await baseComercio(ctx); } catch (e) { return faltaScript(ctx, e); }
      const [e1, p1, x1] = await Promise.all([sb.from('com_embarques').select('*').eq('localidad_id', ctx.sel.loc).order('numero', { ascending: false }), sb.from('com_polizas').select('id, numero, proveedor_nombre').eq('localidad_id', ctx.sel.loc).neq('estado', 'ANULADA').order('numero', { ascending: false }).limit(200), sb.from('com_exportaciones').select('id, numero, cliente_nombre').eq('localidad_id', ctx.sel.loc).neq('estado', 'ANULADA').order('numero', { ascending: false }).limit(200)]);
      ems = e1.data || []; pols = p1.data || []; exps = x1.data || [];
      ctx.filtros(`<label class="campo"><span>Mostrar</span><select name="ver">${['ACTIVOS', 'ENTREGADOS', 'TODOS'].map((x) => `<option ${ver === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`, botonesExp);
      pintar();
    }
    const cfg = () => { const ls = ems.filter((x) => ver === 'TODOS' || (ver === 'ENTREGADOS' ? x.estado === 'ENTREGADO' : x.estado !== 'ENTREGADO'));
      return { titulo: 'Seguimiento de embarques', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Embarques', archivo: 'embarques', parametros: [`Empresa: ${empresaDe(ctx)}`, `Mostrar: ${ver}`],
        columnas: [col('No.', 'entero', 6), col('Tipo', 'texto', 12), col('Documento', 'texto', 20), col('Transportista', 'texto', 22), col('BL / guía', 'texto', 16), col('Contenedor', 'texto', 14), col('Origen', 'texto', 16), col('Destino', 'texto', 16), col('Embarque', 'texto', 11), col('ETA', 'texto', 11), col('Estado', 'texto', 12), col('Último evento', 'texto', 30)],
        filas: ls.map((x) => { const ult = (x.bitacora || []).slice(-1)[0]; return { valores: [x.numero, x.tipo, x.poliza_id ? `Póliza ${pols.find((p) => p.id === x.poliza_id)?.numero ?? ''}` : x.exportacion_id ? `Exportación ${exps.find((p) => p.id === x.exportacion_id)?.numero ?? ''}` : '', B.transportistas.find((t) => t.id === x.transportista_id)?.nombre || '', x.documento_transporte || '', x.contenedor || '', x.puerto_origen || '', x.puerto_destino || '', fmt.fechaDia(x.fecha_embarque), fmt.fechaDia(x.eta), `¤${x.estado}`, ult ? `${ult.fecha} · ${ult.estado}${ult.nota ? ` · ${ult.nota}` : ''}` : ''], attr: `data-e="${x.id}"` }; }) }; };
    function pintar() {
      const c = cfg(), hoy = fmt.hoy();
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Embarques activos', ems.filter((x) => x.estado !== 'ENTREGADO').length)}${kpi('En tránsito', ems.filter((x) => x.estado === 'EN TRÁNSITO').length)}${kpi('En aduana', ems.filter((x) => ['EN PUERTO', 'EN ADUANA'].includes(x.estado)).length)}${kpi('Con ETA vencida', ems.filter((x) => x.eta && x.eta < hoy && !['LIBERADO', 'ENTREGADO'].includes(x.estado)).length, 'ec-alerta')}</div>
        ${ctx.admin ? `<form class="pf-modform com-emb" novalidate><label class="campo"><span>Tipo</span><select name="tipo"><option>IMPORTACIÓN</option><option>EXPORTACIÓN</option></select></label><label class="campo"><span>Póliza / exportación</span><select name="doc"><option value="">—</option>${pols.map((p) => `<option value="P${p.id}">Póliza ${p.numero} · ${esc(p.proveedor_nombre)}</option>`).join('')}${exps.map((p) => `<option value="E${p.id}">Exportación ${p.numero} · ${esc(p.cliente_nombre)}</option>`).join('')}</select></label><label class="campo"><span>Transportista</span><select name="tr"><option value="">—</option>${B.transportistas.map((t) => `<option value="${t.id}">${esc(t.nombre)}</option>`).join('')}</select></label><label class="campo"><span>BL / guía</span><input name="bl"></label><label class="campo"><span>Contenedor</span><input name="cont"></label><label class="campo"><span>Origen</span><input name="origen"></label><label class="campo"><span>Destino</span><input name="destino"></label><label class="campo"><span>Fecha de embarque</span><input type="date" name="fe"></label><label class="campo"><span>ETA</span><input type="date" name="eta"></label><button type="submit" class="boton primario-sm"><i class="ti ti-plus" aria-hidden="true"></i> Registrar embarque</button></form>` : ''}
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Toca un embarque para avanzar su estado (programado › en tránsito › en puerto › en aduana › liberado › entregado) y anotar el evento en su bitácora.</p>${tabla(c, false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); if (e.target.name === 'ver' && e.target.closest('.bk-filtros')) { ver = e.target.value; pintar(); } });
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('.com-emb')) return; e.preventDefault(); const el = e.target.elements, d = el.doc.value;
      const { error } = await sb.from('com_embarques').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, numero: 0, tipo: el.tipo.value, poliza_id: d.startsWith('P') ? Number(d.slice(1)) : null, exportacion_id: d.startsWith('E') ? Number(d.slice(1)) : null, transportista_id: Number(el.tr.value) || null, documento_transporte: el.bl.value.trim() || null, contenedor: el.cont.value.trim() || null, puerto_origen: el.origen.value.trim().toUpperCase() || null, puerto_destino: el.destino.value.trim().toUpperCase() || null, fecha_embarque: el.fe.value || null, eta: el.eta.value || null, estado: el.fe.value ? 'EN TRÁNSITO' : 'PROGRAMADO', bitacora: [{ fecha: fmt.hoy(), estado: el.fe.value ? 'EN TRÁNSITO' : 'PROGRAMADO', nota: 'Registro del embarque', usuario: window.FIN.perfil()?.usuario || '' }] });
      if (error) return window.FIN.aviso(window.UI.traducirError(error)); cargar();
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      const tr = e.target.closest('tr[data-e]'); if (!tr || !ctx.admin) return;
      const x = ems.find((y) => String(y.id) === tr.dataset.e); const k = ESTADOS.indexOf(x.estado); if (k >= ESTADOS.length - 1) return window.FIN.aviso('El embarque ya fue entregado');
      const nuevo = ESTADOS[k + 1]; const nota = prompt(`Avanzar el embarque ${x.numero} a «${nuevo}». Nota del evento:`, ''); if (nota == null) return;
      const { error } = await sb.from('com_embarques').update({ estado: nuevo, fecha_llegada: nuevo === 'EN PUERTO' ? fmt.hoy() : x.fecha_llegada, bitacora: [...(x.bitacora || []), { fecha: fmt.hoy(), estado: nuevo, nota: nota.trim(), usuario: window.FIN.perfil()?.usuario || '' }] }).eq('id', x.id);
      if (error) return window.FIN.aviso(window.UI.traducirError(error)); cargar();
    });
    iniciar();
  };

  // ===================== Reportes =====================
  const DEF = { 'com-importaciones-periodo': 'Importaciones por período', 'com-costo-poliza': 'Costo por póliza', 'com-exportaciones-destino': 'Exportaciones por destino', 'com-tributos-aduana': 'Tributos de aduana' };
  function reporte(cont, id) {
    const ctx = montar(cont, { titulo: DEF[id], icono: 'ti-report', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Import. y export. · Reportes' });
    const { sb } = ctx;
    const f = { desde: `${new Date().getFullYear()}-01-01`, hasta: fmt.hoy(), graficas: true };
    let B = null, cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-report'); return; }
      ctx.filtros(`<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}"></label><label class="pc-check"><input type="checkbox" name="graficas" ${f.graficas ? 'checked' : ''}> Gráficas</label>`, botonesExp);
      try {
        B = await baseComercio(ctx);
        if (id === 'com-exportaciones-destino') {
          const xs = (await sb.from('com_exportaciones').select('*').eq('localidad_id', ctx.sel.loc).neq('estado', 'ANULADA').gte('fecha', f.desde).lte('fecha', f.hasta)).data || [];
          const g = new Map(); xs.forEach((x) => { const a = g.get(x.pais_destino) || []; a.push(x); g.set(x.pais_destino, a); });
          const tot = sum(xs.map((x) => x.valor_q));
          const filas = [...g.entries()].map(([pais, a]) => ({ valores: [pais, a.length, r2(sum(a.map((x) => x.valor_fob))), r2(sum(a.map((x) => x.valor_q))), tot ? sum(a.map((x) => x.valor_q)) / tot : 0] })).sort((a, b) => b.valores[3] - a.valores[3]);
          filas.push({ valores: ['Total', xs.length, r2(sum(xs.map((x) => x.valor_fob))), r2(tot), tot ? 1 : 0], tipo: 'total' });
          cfg = { titulo: DEF[id], orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Exportaciones', archivo: 'exportaciones_destino', parametros: [`Empresa: ${empresaDe(ctx)}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`], columnas: [col('País de destino', 'texto', 28), col('Exportaciones', 'entero', 12), col('Valor FOB (moneda)', 'monto', 16), col('Valor Q', 'monto', 16), col('%', 'porcentaje', 8)], filas, vacio: 'No hay exportaciones en el período.',
            graficas: [G().barras('Exportaciones por país (Q)', [...g.entries()].map(([p, a]) => ({ etiqueta: p, valor: sum(a.map((x) => x.valor_q)), texto: q(sum(a.map((x) => x.valor_q))) })).sort((a, b) => b.valor - a.valor))] };
        } else {
          const ps = (await sb.from('com_polizas').select('*').eq('localidad_id', ctx.sel.loc).in('estado', ['LIQUIDADA', 'INGRESADA']).gte('fecha', f.desde).lte('fecha', f.hasta).order('fecha')).data || [];
          const ad = (i) => B.aduanas.find((a) => a.id === i)?.nombre || 'SIN ADUANA';
          if (id === 'com-importaciones-periodo') {
            const porM = new Map(); ps.forEach((p) => { const k = p.fecha.slice(0, 7); const a = porM.get(k) || []; a.push(p); porM.set(k, a); });
            const filas = [];
            [...porM.entries()].forEach(([k, a]) => { filas.push({ valores: [`${MES[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`], tipo: 'grupo', combinar: true }); a.forEach((p) => filas.push({ valores: [fmt.fechaDia(p.fecha), `${p.numero} · ${p.duca || ''}`, p.proveedor_nombre, ad(p.aduana_id), r2(p.cif_q), r2(p.dai_q), r2(p.iva_q), r2(p.gastos_q), r2(p.costo_total_q), `¤${p.estado}`] })); filas.push({ valores: ['Subtotal', '', '', '', ...['cif_q', 'dai_q', 'iva_q', 'gastos_q', 'costo_total_q'].map((c) => r2(sum(a.map((p) => p[c])))), ''], tipo: 'subtotal' }); });
            filas.push({ valores: [`Total (${ps.length} pólizas)`, '', '', '', ...['cif_q', 'dai_q', 'iva_q', 'gastos_q', 'costo_total_q'].map((c) => r2(sum(ps.map((p) => p[c])))), ''], tipo: 'total' });
            cfg = { titulo: DEF[id], orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Importaciones', archivo: 'importaciones_periodo', parametros: [`Empresa: ${empresaDe(ctx)}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`], columnas: [col('Fecha', 'texto', 11), col('Póliza / DUCA', 'texto', 18), col('Proveedor', 'texto', 30), col('Aduana', 'texto', 20), col('CIF Q', 'monto', 14), col('DAI Q', 'monto', 12), col('IVA Q', 'monto', 12), col('Gastos Q', 'monto', 12), col('Costo Q', 'monto', 14), col('Estado', 'texto', 11)], filas: ps.length ? filas : [], vacio: 'No hay pólizas liquidadas en el período.',
              graficas: [G().columnas('Costo de importaciones por mes (Q)', [...porM.keys()].map((k) => M3[Number(k.slice(5)) - 1]), [{ nombre: 'Costo', color: G().COLORES.AZUL, valores: [...porM.values()].map((a) => sum(a.map((p) => p.costo_total_q))) }])] };
          } else if (id === 'com-tributos-aduana') {
            const g = new Map(); ps.forEach((p) => { const k = `${p.fecha.slice(0, 7)}|${ad(p.aduana_id)}`; const a = g.get(k) || { dai: 0, iva: 0, cif: 0, n: 0 }; a.dai += num(p.dai_q); a.iva += num(p.iva_q); a.cif += num(p.cif_q); a.n++; g.set(k, a); });
            const filas = [...g.entries()].map(([k, a]) => { const [m, adu] = k.split('|'); return { valores: [`${MES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`, adu, a.n, r2(a.cif), r2(a.dai), r2(a.iva), r2(a.dai + a.iva)] }; });
            filas.push({ valores: ['Total', '', ps.length, r2(sum(ps.map((p) => p.cif_q))), r2(sum(ps.map((p) => p.dai_q))), r2(sum(ps.map((p) => p.iva_q))), r2(sum(ps.map((p) => num(p.dai_q) + num(p.iva_q))))], tipo: 'total' });
            cfg = { titulo: DEF[id], orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Tributos', archivo: 'tributos_aduana', parametros: [`Empresa: ${empresaDe(ctx)}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, 'El IVA de importación es crédito fiscal del período'], columnas: [col('Mes', 'texto', 16), col('Aduana', 'texto', 26), col('Pólizas', 'entero', 9), col('CIF Q', 'monto', 15), col('DAI Q', 'monto', 13), col('IVA Q', 'monto', 13), col('Total tributos Q', 'monto', 15)], filas: ps.length ? filas : [], vacio: 'No hay pólizas liquidadas en el período.',
              graficas: [G().barras('Tributos por aduana (Q)', [...ps.reduce((m, p) => m.set(ad(p.aduana_id), (m.get(ad(p.aduana_id)) || 0) + num(p.dai_q) + num(p.iva_q)), new Map())].map(([k, v]) => ({ etiqueta: k, valor: v, texto: q(v) })))] };
          } else {
            const ids = ps.map((p) => p.id); const ls = ids.length ? await leerTodo(() => sb.from('com_poliza_lineas').select('*').in('poliza_id', ids).order('id')) : [];
            const filas = [];
            ps.forEach((p) => { const xs = ls.filter((l) => l.poliza_id === p.id); filas.push({ valores: [`Póliza ${p.numero} · ${p.duca || ''} · ${p.proveedor_nombre} · ${fmt.fechaDia(p.fecha)}`], tipo: 'grupo', combinar: true }); xs.forEach((l) => filas.push({ valores: [l.descripcion, num(l.cantidad), r2(l.fob_q), r2(num(l.flete_q) + num(l.seguro_q)), r2(l.dai_q), r2(l.gastos_q), r2(l.costo_total_q), r4(l.costo_unitario_q), num(l.fob_q) ? num(l.costo_total_q) / num(l.fob_q) - 1 : ''] })); filas.push({ valores: ['Total de la póliza', '', r2(sum(xs.map((l) => l.fob_q))), r2(sum(xs.map((l) => num(l.flete_q) + num(l.seguro_q)))), r2(sum(xs.map((l) => l.dai_q))), r2(sum(xs.map((l) => l.gastos_q))), r2(sum(xs.map((l) => l.costo_total_q))), '', ''], tipo: 'subtotal' }); });
            cfg = { titulo: DEF[id], orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Costo por poliza', archivo: 'costo_por_poliza', parametros: [`Empresa: ${empresaDe(ctx)}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`], columnas: [col('Producto', 'texto', 34), col('Cantidad', 'numero', 10), col('FOB Q', 'monto', 13), col('Flete y seguro Q', 'monto', 13), col('DAI Q', 'monto', 12), col('Gastos Q', 'monto', 12), col('Costo Q', 'monto', 14), col('Unitario Q', 'numero', 12), col('Recargo sobre FOB', 'porcentaje', 11)], filas, vacio: 'No hay pólizas liquidadas en el período.' };
          }
        }
      } catch (e) { return faltaScript(ctx, e); }
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="cl-banda">${esc(cfg.titulo)} · ${esc(cfg.parametros.join(' · '))}</div>${tabla(cfg, f.graficas)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); const n = e.target.name; if (['desde', 'hasta'].includes(n)) { f[n] = e.target.value || f[n]; return cargar(); } if (n === 'graficas') { f.graficas = e.target.checked; return cargar(); } });
    cont.addEventListener('click', (e) => { const ex = e.target.closest('[data-exp]'); if (ex) exportar(cfg, ex.dataset.exp, f.graficas); });
    iniciar();
  }
  Object.keys(DEF).forEach((k) => { window.PANTALLAS[k] = (cont) => reporte(cont, k); });
})();
