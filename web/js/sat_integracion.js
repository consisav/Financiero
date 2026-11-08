// Integraciones SAT (Guatemala, script 154).
//   Catálogos: Datos del emisor (regímenes IVA/ISR, agente retenedor, certificador sin claves), Establecimientos,
//     Tipos de DTE y Frases y escenarios FEL.
//   Registros: DTE emitidos (bandeja de certificación), DTE recibidos (Carga Facturas SAT) y Constancias de retención.
//   Procesos: Conciliación fiscal, Liquidación de impuestos (IVA mensual tipo SAT-2237, ISR, ISO) con cierre del
//     período fiscal, y Calendario fiscal con las obligaciones y su presentación.
//   Reportes: Libro de ventas, Libro de compras, Resumen de IVA y DTE por estado (PDF, Excel y gráficas).
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const M3 = MES.map((m) => m.slice(0, 3));
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const q = (n) => `Q ${fmt.monto(n)}`;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const G = () => window.GRAFICAS;
  const diaLocal = (v) => (!v ? '' : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : new Date(v).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }));
  const ini = (x) => `${x}T00:00:00-06:00`, fin = (x) => `${x}T23:59:59.999-06:00`;
  const finMes = (a, m) => new Date(a, m, 0).toLocaleDateString('en-CA');
  const iniMes = (a, m) => `${a}-${String(m).padStart(2, '0')}-01`;
  const nitN = (s) => String(s || '').toUpperCase().replace(/[^0-9K]/g, '');
  const empresaDe = (ctx) => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
  const faltaScript = (ctx, e) => { ctx.pDet.innerHTML = `<p class="vacio">${/sat_|periodo_fiscal/.test(e?.message || '') ? 'Falta instalar el script 154 (Integraciones SAT) en Supabase.' : esc(window.UI.traducirError(e))}</p>`; };
  const ESTADO_CLS = { CERTIFICADO: 'aprobada', PENDIENTE: 'pendiente', ANULADO: 'anulada', REGISTRADA: 'aprobada', 'SIN REGISTRAR': 'pendiente', ANULADA: 'anulada', PRESENTADA: 'aprobada', VENCIDA: 'anulada', 'PRÓXIMA': 'editando' };
  const marca = (e) => `<span class="pc-marca ${ESTADO_CLS[e] || ''}">${esc(e)}</span>`;
  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) { const { data, error } = await hacer().range(i, i + 999); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; }
    return out;
  }
  const botonesExp = '<button type="button" class="boton secundario-sm" data-exp="PDF"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button><button type="button" class="boton secundario-sm" data-exp="EXCEL"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>';
  function tabla(c, graficas = true) {
    const n = c.columnas.length;
    const celda = (v, x) => (v === '' || v == null ? '<td></td>' : typeof v === 'number' ? `<td class="num${v < 0 ? ' pc-rojo' : ''}">${x.tipo === 'monto' ? fmt.monto(v) : x.tipo === 'porcentaje' ? `${(v * 100).toFixed(1)} %` : v.toLocaleString('es-GT')}</td>` : String(v).startsWith('¤') ? `<td>${marca(String(v).slice(1))}</td>` : `<td>${esc(String(v))}</td>`);
    const gs = graficas ? (c.graficas || []).filter(Boolean) : [];
    return `<div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${c.columnas.map((x) => `<th class="${x.tipo === 'texto' ? '' : 'num'}">${esc(x.titulo)}</th>`).join('')}</tr></thead>
      <tbody>${c.filas.length ? c.filas.slice(0, 2000).map((r) => (r.tipo === 'grupo' && r.combinar ? `<tr class="pr-g"><td colspan="${n}">${esc(r.valores[0])}</td></tr>` : `<tr class="${r.tipo === 'subtotal' ? 'pr-s' : r.tipo === 'total' ? 'pr-t' : ''}${r.resaltar === true ? ' pr-alerta' : ''}" ${r.attr || ''}>${c.columnas.map((x, i) => celda(r.valores[i], x)).join('')}</tr>`)).join('') : `<tr><td colspan="${n}" class="tk-vacio">${esc(c.vacio || 'Sin información con esos parámetros.')}</td></tr>`}
      ${c.filas.length > 2000 ? `<tr><td colspan="${n}" class="tk-vacio">Vista previa de 2000 de ${c.filas.length} renglones: el PDF y el Excel llevan todo.</td></tr>` : ''}</tbody></table>${gs.length && c.filas.length ? `<section class="pr-graficas"><h3><i class="ti ti-chart-bar" aria-hidden="true"></i> Gráficas</h3>${gs.join('')}</section>` : ''}</div>`;
  }
  function exportar(c, formato, graficas = true) {
    if (!c || !c.filas.length) return window.FIN.aviso('No hay información con esos parámetros');
    const gs = graficas ? (c.graficas || []).filter(Boolean) : [];
    const s = { ...c, filas: c.filas.map((r) => ({ ...r, resaltar: r.resaltar === true ? 1 : undefined, valores: r.valores.map((v) => (typeof v === 'string' && v.startsWith('¤') ? v.slice(1) : v)) })) };
    if (formato === 'PDF') return window.CUENTAS_XLSX.pdf({ ...s, graficas: gs.join('') });
    Promise.all(gs.map((g) => G().png(g))).then((imagenes) => window.REPORTE_XLSX.generar({ ...s, imagenes })).catch((e) => window.FIN.aviso(e.message || 'No se pudo generar el Excel'));
  }

  // ---------- Datos fiscales del período ----------
  async function emisorDe(sb, loc) { const { data } = await sb.from('sat_emisores').select('*').eq('localidad_id', loc).maybeSingle(); return data; }
  async function datosFiscales(ctx, desde, hasta, op = {}) {
    const { sb } = ctx, loc = ctx.sel.loc;
    const em = await emisorDe(sb, loc);
    const tasa = (num(em?.porcentaje_iva) || 12) / 100;
    const k = (d) => (ctx.moneda(d.moneda_id)?.iso && ctx.moneda(d.moneda_id).iso !== 'GTQ' ? Number(d.tipo_cambio) || 1 : 1);
    const ivaDe = (total, ivaReg, exento, tipo) => (exento || ['FPEQ', 'FCAP', 'RECI', 'RDON'].includes(tipo) ? 0 : num(ivaReg) > 0 ? num(ivaReg) : total - total / (1 + tasa));
    const [fs, ns, cs, rs] = await Promise.all([
      op.ventas === false ? [] : leerTodo(() => sb.from('facturas_venta').select('id, numero, no_interno, tipo_dte, serie, numero_dte, autorizacion, fecha_emision, fecha_certificacion, estado, nit, nombre, total, iva, exento_iva, moneda_id, tipo_cambio, monto_retencion_iva, monto_retencion_isr').eq('localidad_id', loc).gte('fecha_emision', ini(desde)).lte('fecha_emision', fin(hasta)).order('fecha_emision').order('id')),
      op.ventas === false ? [] : leerTodo(() => sb.from('notas_venta').select('id, numero, tipo, tipo_dte, serie, numero_dte, autorizacion, fecha_emision, estado, nit, nombre, valor, exento_iva, moneda_id, tipo_cambio, factura_id').eq('localidad_id', loc).gte('fecha_emision', ini(desde)).lte('fecha_emision', fin(hasta)).order('fecha_emision').order('id')),
      op.compras === false ? [] : leerTodo(() => { const a = Number(desde.slice(0, 4)), b = Number(hasta.slice(0, 4)); return sb.from('compras').select('id, numero, tipo_dte, serie, documento, fecha_documento, nit, proveedor_nombre, valor_total, iva, base, exento, idp, no_deducible, estado, anio_presentacion, mes_presentacion, moneda_id, tipo_cambio, clasificacion, retencion, retencion_valor, retencion_iva, retencion_formulario, retencion_fecha').eq('localidad_id', loc).eq('estado', 'ACTIVA').gte('anio_presentacion', a - 1).lte('anio_presentacion', b + 1).order('fecha_documento').order('id'); }),
      op.retenciones === false ? [] : leerTodo(() => sb.from('recibos_venta').select('id, clase, serie, recibo_fisico, numero, fecha, nombre, valor, valor_retencion, tipo_retencion, pct_retencion, estado, documento').eq('localidad_id', loc).neq('estado', 'ANULADO').gte('fecha', desde).lte('fecha', hasta).order('fecha').order('id'))
    ]);
    const enPer = (d) => d >= desde && d <= hasta;
    const ventas = fs.map((f) => { const kk = k(f), anul = f.estado === 'ANULADA', total = anul ? 0 : num(f.total) * kk, iva = anul ? 0 : ivaDe(total, num(f.iva) * kk, f.exento_iva, f.tipo_dte);
      return { tipo: f.tipo_dte || 'FACT', serie: f.serie || '', numero: f.numero_dte || f.no_interno || String(f.numero), aut: f.autorizacion || '', fecha: diaLocal(f.fecha_emision), nit: f.nit || 'CF', nombre: f.nombre || '', total, iva, exento: f.exento_iva ? total : 0, gravado: f.exento_iva ? 0 : total - iva, anulada: anul, estadoDte: anul ? 'ANULADO' : f.autorizacion ? 'CERTIFICADO' : 'PENDIENTE', id: f.id, clase: 'FACTURA', certif: f.fecha_certificacion, retIva: num(f.monto_retencion_iva) * kk, retIsr: num(f.monto_retencion_isr) * kk }; });
    const notas = ns.map((n) => { const kk = k(n), anul = n.estado === 'ANULADA', sg = n.tipo === 'DÉBITO' ? 1 : -1, total = anul ? 0 : sg * num(n.valor) * kk, iva = anul ? 0 : (n.exento_iva ? 0 : total - total / (1 + tasa));
      return { tipo: n.tipo_dte || (n.tipo === 'DÉBITO' ? 'NDEB' : n.tipo === 'ABONO' ? 'NABN' : 'NCRE'), serie: n.serie || '', numero: n.numero_dte || `N-${n.numero}`, aut: n.autorizacion || '', fecha: diaLocal(n.fecha_emision), nit: n.nit || 'CF', nombre: n.nombre || '', total, iva, exento: n.exento_iva ? total : 0, gravado: n.exento_iva ? 0 : total - iva, anulada: anul, estadoDte: anul ? 'ANULADO' : n.autorizacion ? 'CERTIFICADO' : 'PENDIENTE', id: n.id, clase: 'NOTA' }; });
    const compras = cs.map((c) => { const kk = k(c), per = c.anio_presentacion && c.mes_presentacion ? iniMes(c.anio_presentacion, c.mes_presentacion) : c.fecha_documento; const total = num(c.valor_total) * kk, iva = num(c.iva) * kk, exento = num(c.exento) * kk, idp = num(c.idp) * kk;
      const cl = String(c.clasificacion || ''); const base = Math.max(0, total - iva - exento - idp);
      return { id: c.id, numero: c.numero, tipo: c.tipo_dte || 'FACTURA', serie: c.serie || '', documento: c.documento || '', fecha: c.fecha_documento, periodo: per, nit: c.nit || '', nombre: c.proveedor_nombre || '', total, iva, exento, idp, bienes: /SERVIC/.test(cl) ? 0 : base, servicios: /SERVIC/.test(cl) ? base : 0, clasificacion: cl, retencion: c.retencion, retIsr: num(c.retencion_valor) * kk, retIva: num(c.retencion_iva) * kk, formulario: c.retencion_formulario || '', fechaRet: c.retencion_fecha }; })
      .filter((c) => { const p = c.periodo.slice(0, 7); return p >= desde.slice(0, 7) && p <= hasta.slice(0, 7); });
    const retenciones = rs.map((r) => { const esRet = r.clase === 'RETENCIÓN'; const monto = esRet ? num(r.valor) : num(r.valor_retencion); return { fecha: r.fecha, tipo: r.tipo_retencion || 'IVA', documento: `${r.serie || ''}-${r.recibo_fisico || r.numero || ''}`, nombre: r.nombre || '', monto, pct: num(r.pct_retencion), clase: esRet ? 'Constancia' : 'En recibo', constancia: r.documento || '' }; }).filter((r) => r.monto > 0 && enPer(r.fecha));
    return { em, tasa, ventas, notas, compras, retenciones };
  }

  // ---------- Liquidación (IVA, ISR, ISO) ----------
  function liquidar(D, remanenteAnterior, anio, mes) {
    const docs = [...D.ventas, ...D.notas];
    const ventasGravadas = sum(docs.map((d) => d.gravado)), ventasExentas = sum(docs.map((d) => d.exento)), debito = sum(docs.map((d) => d.iva));
    const comprasGravadas = sum(D.compras.map((c) => c.bienes + c.servicios)), credito = sum(D.compras.map((c) => c.iva));
    const retIva = sum(D.retenciones.filter((r) => r.tipo === 'IVA').map((r) => r.monto));
    const retIsr = sum(D.retenciones.filter((r) => r.tipo === 'ISR').map((r) => r.monto));
    const resultado = debito - credito - retIva - remanenteAnterior;
    const pequeno = D.em?.regimen_iva === 'PEQUEÑO CONTRIBUYENTE';
    const ivaPagar = pequeno ? sum(docs.map((d) => d.total)) * 0.05 : Math.max(0, resultado);
    const remSig = pequeno ? 0 : Math.max(0, -resultado);
    // ISR régimen opcional simplificado: 5 % sobre los primeros Q 30,000 del mes y 7 % sobre el excedente (menos lo retenido).
    const isrSimpl = Math.min(ventasGravadas, 30000) * 0.05 + Math.max(0, ventasGravadas - 30000) * 0.07;
    const isr = D.em?.regimen_isr === 'SIMPLIFICADO' ? Math.max(0, isrSimpl - retIsr) : 0;
    return { anio, mes, ventas_gravadas: r2(ventasGravadas), ventas_exentas: r2(ventasExentas), debito_fiscal: r2(debito), compras_gravadas: r2(comprasGravadas), credito_fiscal: r2(credito), retenciones_iva: r2(retIva), retenciones_isr: r2(retIsr), remanente_anterior: r2(remanenteAnterior), iva_a_pagar: r2(ivaPagar), remanente_siguiente: r2(remSig), isr_estimado: r2(isr), iso_estimado: 0, pequeno, documentos_venta: docs.length, documentos_compra: D.compras.length };
  }

  // ===================== Datos del emisor =====================
  window.PANTALLAS['sat-emisor'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Datos del emisor', icono: 'ti-id-badge-2', clase: 'bk-movimientos bm-solo cx-rep sat-emisor', grupo: 'Integraciones SAT · Catálogos' });
    const { sb } = ctx;
    let em = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-id-badge-2'); return; }
      ctx.filtros('', '');
      const r = await sb.from('sat_emisores').select('*').eq('localidad_id', ctx.sel.loc).maybeSingle();
      if (r.error) return faltaScript(ctx, r.error);
      em = r.data; pintar();
    }
    function pintar() {
      const l = ctx.localidad(ctx.sel.loc) || {};
      const v = em || { nit: l.nit || '', nombre_emisor: l.razon_social || l.nombre_comercial || '', nombre_comercial: l.nombre_comercial || '', regimen_iva: 'GENERAL', regimen_isr: 'UTILIDADES', agente_retencion_iva: false, agente_retencion_isr: true, contribuyente_especial: false, certificador: 'COFIDI', porcentaje_iva: 12 };
      const dis = ctx.admin ? '' : 'disabled';
      const sel = (n, ops) => `<select name="${n}" ${dis}>${ops.map((o) => `<option ${v[n] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
      const chk = (n, t) => `<label class="pc-check"><input type="checkbox" name="${n}" ${v[n] ? 'checked' : ''} ${dis}> ${t}</label>`;
      ctx.pDet.innerHTML = `<form class="bm-form cx-form cl-clasico sat-form" novalidate>
        <div class="cl-banda">Emisor ante la SAT · ${esc(empresaDe(ctx))}${em ? '' : ' · <b>sin registrar</b> (se propone con los datos de la empresa)'}</div>
        <div class="sat-g">
          <label class="campo"><span>NIT *</span><input name="nit" value="${esc(v.nit || '')}" maxlength="20" ${dis}></label>
          <label class="campo sat-ancho"><span>Nombre del emisor (como en el RTU) *</span><input name="nombre_emisor" value="${esc(v.nombre_emisor || '')}" ${dis}></label>
          <label class="campo sat-ancho"><span>Nombre comercial</span><input name="nombre_comercial" value="${esc(v.nombre_comercial || '')}" ${dis}></label>
          <label class="campo"><span>Régimen de IVA</span>${sel('regimen_iva', ['GENERAL', 'PEQUEÑO CONTRIBUYENTE', 'EXENTO'])}</label>
          <label class="campo"><span>Régimen de ISR</span>${sel('regimen_isr', ['UTILIDADES', 'SIMPLIFICADO'])}</label>
          <label class="campo"><span>% IVA</span><input type="number" name="porcentaje_iva" step="0.01" value="${v.porcentaje_iva}" ${dis}></label>
          ${chk('agente_retencion_iva', 'Agente de retención del IVA')}${chk('agente_retencion_isr', 'Agente de retención del ISR')}${chk('contribuyente_especial', 'Contribuyente especial')}
          <label class="campo"><span>Certificador FEL</span><input name="certificador" value="${esc(v.certificador || 'COFIDI')}" ${dis}></label>
          <label class="campo"><span>NIT del certificador</span><input name="nit_certificador" value="${esc(v.nit_certificador || '')}" ${dis}></label>
          <label class="campo"><span>Usuario del certificador</span><input name="usuario_certificador" value="${esc(v.usuario_certificador || '')}" ${dis}></label>
          <label class="campo sat-ancho"><span>Correo de notificaciones</span><input name="correo_notificaciones" value="${esc(v.correo_notificaciones || '')}" ${dis}></label>
        </div>
        <p class="pr-guia"><i class="ti ti-shield-lock" aria-hidden="true"></i> La clave y el token del certificador no se guardan en la aplicación: viven en los secretos del servidor. Aquí solo el usuario de referencia.</p>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> El régimen define el cálculo: IVA general 12 % (débito − crédito); pequeño contribuyente 5 % sobre ingresos; ISR simplificado 5 % hasta Q 30,000 mensuales y 7 % sobre el excedente; ISR sobre utilidades 25 % con pagos trimestrales.</p>
        <p class="modal-error tk-error" role="alert"></p>
        ${ctx.admin ? '<div class="pr-nueva-acc"><button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button></div>' : ''}</form>`;
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') cargar(); });
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('.sat-form')) return; e.preventDefault();
      const el = e.target.elements;
      const v = { organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, nit: nitN(el.nit.value), nombre_emisor: el.nombre_emisor.value.trim().toUpperCase(), nombre_comercial: el.nombre_comercial.value.trim().toUpperCase() || null, regimen_iva: el.regimen_iva.value, regimen_isr: el.regimen_isr.value, porcentaje_iva: num(el.porcentaje_iva.value) || 12,
        agente_retencion_iva: el.agente_retencion_iva.checked, agente_retencion_isr: el.agente_retencion_isr.checked, contribuyente_especial: el.contribuyente_especial.checked, certificador: el.certificador.value.trim().toUpperCase() || 'COFIDI', nit_certificador: el.nit_certificador.value.trim() || null, usuario_certificador: el.usuario_certificador.value.trim() || null, correo_notificaciones: el.correo_notificaciones.value.trim() || null };
      if (!v.nit || !v.nombre_emisor) { e.target.querySelector('.modal-error').textContent = 'El NIT y el nombre del emisor son obligatorios.'; return; }
      const { error } = await sb.from('sat_emisores').upsert(v, { onConflict: 'localidad_id' });
      if (error) { e.target.querySelector('.modal-error').textContent = window.UI.traducirError(error); return; }
      window.FIN.aviso('Datos del emisor guardados'); cargar();
    });
    iniciar();
  };

  // ===================== Establecimientos, Tipos de DTE, Frases =====================
  function lista(cont, op) {
    const ctx = montar(cont, { titulo: op.titulo, icono: op.icono, clase: 'bk-movimientos bm-solo cx-rep pf-cat', grupo: 'Integraciones SAT · Catálogos' });
    const { sb } = ctx;
    let filas = [], aplica = new Set();
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (op.porEmpresa && !ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', op.icono); return; }
      ctx.filtros('', `${ctx.admin && op.nuevo ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>' : ''}${botonesExp}`);
      let qy = sb.from(op.tabla).select('*'); if (op.porEmpresa) qy = qy.eq('localidad_id', ctx.sel.loc);
      const { data, error } = await qy.order(op.orden[0]).order(op.orden[1] || op.orden[0]);
      if (error) return faltaScript(ctx, error);
      filas = data || [];
      if (op.tabla === 'sat_frases' && ctx.sel.loc) { const r = await sb.from('sat_emisor_frases').select('frase_id').eq('localidad_id', ctx.sel.loc); aplica = new Set((r.data || []).map((x) => x.frase_id)); }
      pintar();
    }
    function pintar() {
      const ed = ctx.admin;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> ${op.ayuda}</p>
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${op.campos.map((c) => `<th>${c.titulo}</th>`).join('')}${op.tabla === 'sat_frases' ? `<th>Aplica a ${esc(empresaDe(ctx))}</th>` : ''}</tr></thead>
        <tbody>${filas.map((f) => `<tr data-id="${f.id ?? f.codigo}">${op.campos.map((c) => `<td>${c.ro ? esc(String(f[c.k] ?? '')) : c.tipo === 'check' ? `<input type="checkbox" data-c="${c.k}" ${f[c.k] ? 'checked' : ''} ${ed ? '' : 'disabled'}>` : `<input data-c="${c.k}" value="${esc(String(f[c.k] ?? ''))}" ${c.tipo === 'numero' ? 'type="number"' : ''} ${ed ? '' : 'disabled'}>`}</td>`).join('')}
          ${op.tabla === 'sat_frases' ? `<td><input type="checkbox" data-aplica ${aplica.has(f.id) ? 'checked' : ''} ${ed && ctx.sel.loc ? '' : 'disabled'}></td>` : ''}</tr>`).join('') || `<tr><td colspan="${op.campos.length + 1}" class="tk-vacio">Sin registros.</td></tr>`}</tbody></table></div></div>`;
    }
    const cfg = () => ({ titulo: op.titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: op.titulo.slice(0, 30), archivo: op.tabla, parametros: op.porEmpresa ? [`Empresa: ${empresaDe(ctx)}`] : [], columnas: op.campos.map((c) => col(c.titulo, 'texto', c.ancho || 18)), filas: filas.map((f) => ({ valores: op.campos.map((c) => (c.tipo === 'check' ? (f[c.k] ? 'Sí' : 'No') : String(f[c.k] ?? ''))) })) });
    cont.addEventListener('change', async (e) => {
      const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar();
      const tr = e.target.closest('tr[data-id]'); if (!tr) return;
      const idv = op.tabla === 'sat_tipos_dte' ? tr.dataset.id : Number(tr.dataset.id);
      if (e.target.matches('[data-aplica]')) { const r = e.target.checked ? await sb.from('sat_emisor_frases').insert({ localidad_id: ctx.sel.loc, frase_id: idv }) : await sb.from('sat_emisor_frases').delete().eq('localidad_id', ctx.sel.loc).eq('frase_id', idv); if (r.error) window.FIN.aviso(window.UI.traducirError(r.error)); return; }
      const k = e.target.dataset.c; if (!k) return; const c = op.campos.find((x) => x.k === k);
      const v = c.tipo === 'check' ? e.target.checked : c.tipo === 'numero' ? num(e.target.value) : e.target.value.trim().toUpperCase();
      const { error } = await sb.from(op.tabla).update({ [k]: v }).eq(op.tabla === 'sat_tipos_dte' ? 'codigo' : 'id', idv);
      if (error) { window.FIN.aviso(window.UI.traducirError(error)); cargar(); }
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      if (e.target.closest('[data-accion="nuevo"]')) { const { error } = await sb.from(op.tabla).insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, ...op.nuevo(filas) }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); cargar(); }
    });
    iniciar();
  }
  window.PANTALLAS['sat-establecimientos'] = (cont) => lista(cont, { titulo: 'Establecimientos', icono: 'ti-building-store', tabla: 'sat_establecimientos', orden: ['codigo'], porEmpresa: true, ayuda: 'Establecimientos registrados en el RTU de la SAT: el código va en cada DTE que se certifica.', campos: [{ k: 'codigo', titulo: 'Código SAT', tipo: 'numero', ancho: 10 }, { k: 'nombre', titulo: 'Nombre', ancho: 36 }, { k: 'direccion', titulo: 'Dirección', ancho: 40 }, { k: 'municipio', titulo: 'Municipio' }, { k: 'departamento', titulo: 'Departamento' }, { k: 'activo', titulo: 'Activo', tipo: 'check' }], nuevo: (f) => ({ codigo: Math.max(0, ...f.map((x) => x.codigo)) + 1, nombre: 'ESTABLECIMIENTO' }) });
  window.PANTALLAS['sat-tipos-dte'] = (cont) => lista(cont, { titulo: 'Tipos de DTE', icono: 'ti-file-certificate', tabla: 'sat_tipos_dte', orden: ['uso', 'codigo'], ayuda: 'Documentos tributarios electrónicos de la FEL y su efecto en el IVA (+1 suma débito, −1 lo resta, 0 sin efecto).', campos: [{ k: 'codigo', titulo: 'Código', ro: true, ancho: 8 }, { k: 'nombre', titulo: 'Nombre', ro: true, ancho: 36 }, { k: 'uso', titulo: 'Uso', ro: true }, { k: 'efecto_iva', titulo: 'Efecto IVA', ro: true }, { k: 'descripcion', titulo: 'Descripción', ro: true, ancho: 50 }, { k: 'activo', titulo: 'Activo', tipo: 'check' }] });
  window.PANTALLAS['sat-frases'] = (cont) => lista(cont, { titulo: 'Frases y escenarios', icono: 'ti-quote', tabla: 'sat_frases', orden: ['tipo', 'escenario'], ayuda: 'Frases que la SAT exige en los DTE según el régimen (ISR trimestral o retención definitiva, agente de retención, exenciones, pequeño contribuyente). Marca las que aplican a la empresa.', campos: [{ k: 'tipo', titulo: 'Tipo', ro: true, ancho: 6 }, { k: 'escenario', titulo: 'Escenario', ro: true, ancho: 8 }, { k: 'descripcion', titulo: 'Descripción', ro: true, ancho: 44 }, { k: 'texto', titulo: 'Texto en el DTE', ro: true, ancho: 44 }] });

  // ===================== Reportes / registros sobre los datos fiscales =====================
  const DEF = {
    'dte-emitidos': { titulo: 'DTE emitidos', icono: 'ti-file-certificate', grupo: 'Registros', estado: true },
    'dte-recibidos': { titulo: 'DTE recibidos', icono: 'ti-file-download', grupo: 'Registros' },
    'constancias-retencion': { titulo: 'Constancias de retención', icono: 'ti-receipt-tax', grupo: 'Registros' },
    'conciliacion-fiscal': { titulo: 'Conciliación fiscal', icono: 'ti-arrows-diff', grupo: 'Procesos' },
    'libro-ventas': { titulo: 'Libro de ventas y servicios', icono: 'ti-book', grupo: 'Reportes' },
    'libro-compras': { titulo: 'Libro de compras y servicios', icono: 'ti-book-2', grupo: 'Reportes' },
    'dte-por-estado': { titulo: 'DTE por estado', icono: 'ti-chart-pie', grupo: 'Reportes' }
  };
  function reporte(cont, id) {
    const R = DEF[id];
    const ctx = montar(cont, { titulo: R.titulo, icono: R.icono, clase: 'bk-movimientos bm-solo cx-rep pr-rep sat-rep', grupo: `Integraciones SAT · ${R.grupo}` });
    const { sb } = ctx;
    const hoy = new Date();
    const f = { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1, rango: 'MES', desde: iniMes(hoy.getFullYear(), 1), hasta: fmt.hoy(), estado: 'TODOS', tipo: 'TODAS', sentido: 'RECIBIDAS', graficas: true };
    let D = null, extra = null, cfg = null, cargado = '';
    const per = () => (f.rango === 'MES' ? [iniMes(f.anio, f.mes), finMes(f.anio, f.mes)] : [f.desde, f.hasta]);
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', R.icono); return; }
      ctx.filtros(`<label class="campo"><span>Período</span><select name="rango"><option value="MES" ${f.rango === 'MES' ? 'selected' : ''}>Un mes</option><option value="RANGO" ${f.rango === 'RANGO' ? 'selected' : ''}>Rango de fechas</option></select></label>
        ${f.rango === 'MES' ? `<label class="campo cx-anio"><span>Año</span><input type="number" name="anio" value="${f.anio}" min="2000" max="2999"></label><label class="campo"><span>Mes</span><select name="mes">${MES.map((m, i) => `<option value="${i + 1}" ${f.mes === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>`
          : `<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}"></label>`}
        ${R.estado ? `<label class="campo"><span>Estado</span><select name="estado">${['TODOS', 'CERTIFICADO', 'PENDIENTE', 'ANULADO'].map((x) => `<option ${f.estado === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>` : ''}
        ${id === 'constancias-retencion' ? `<label class="campo"><span>Retenciones</span><select name="sentido"><option value="RECIBIDAS" ${f.sentido === 'RECIBIDAS' ? 'selected' : ''}>Recibidas de clientes</option><option value="EMITIDAS" ${f.sentido === 'EMITIDAS' ? 'selected' : ''}>Emitidas a proveedores</option></select></label><label class="campo"><span>Tipo</span><select name="tipo">${['TODAS', 'IVA', 'ISR'].map((x) => `<option ${f.tipo === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>` : ''}
        <label class="pc-check"><input type="checkbox" name="graficas" ${f.graficas ? 'checked' : ''}> Gráficas</label>`, botonesExp);
      await consultar();
    }
    async function consultar() {
      const [a, b] = per(); const clave = `${ctx.sel.loc}|${a}|${b}`;
      if (clave !== cargado) {
        ctx.pDet.innerHTML = '<p class="vacio">Leyendo los documentos fiscales…</p>';
        try {
          D = await datosFiscales(ctx, a, b, { compras: !['dte-emitidos', 'libro-ventas'].includes(id), ventas: !['dte-recibidos', 'libro-compras'].includes(id) });
          extra = ['dte-recibidos', 'conciliacion-fiscal'].includes(id) ? await leerTodo(() => sb.from('carga_sat_lineas').select('id, fecha_emision, numero_autorizacion, tipo_dte, serie, numero, nit_emisor, nombre_emisor, gran_total, iva, anulada, estado, compra_id, caja_documento_id, generado').eq('localidad_id', ctx.sel.loc).gte('fecha_emision', ini(a)).lte('fecha_emision', fin(b)).order('fecha_emision').order('id')) : null;
          cargado = clave;
        } catch (e) { return faltaScript(ctx, e); }
      }
      cfg = construir(); pintar();
    }
    const base = () => { const [a, b] = per(); return { titulo: R.titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: R.titulo.slice(0, 30), archivo: `${id}_${a}_${b}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `NIT: ${D.em?.nit || '(registra los Datos del emisor)'}`, f.rango === 'MES' ? `Período: ${MES[f.mes - 1]} ${f.anio}` : `Del ${fmt.fechaDia(a)} al ${fmt.fechaDia(b)}`] }; };
    function construir() {
      if (id === 'dte-emitidos' || id === 'dte-por-estado') {
        const docs = [...D.ventas, ...D.notas].sort((x, y) => x.fecha.localeCompare(y.fecha));
        const cnt = (e) => docs.filter((d) => d.estadoDte === e);
        if (id === 'dte-por-estado') {
          const tipos = [...new Set(docs.map((d) => d.tipo))].sort();
          const filas = tipos.map((t) => { const ds = docs.filter((d) => d.tipo === t); return { valores: [t, ...['CERTIFICADO', 'PENDIENTE', 'ANULADO'].map((e) => ds.filter((d) => d.estadoDte === e).length), ds.length, r2(sum(ds.map((d) => d.total))), r2(sum(ds.map((d) => d.iva)))] }; });
          filas.push({ valores: ['Total', cnt('CERTIFICADO').length, cnt('PENDIENTE').length, cnt('ANULADO').length, docs.length, r2(sum(docs.map((d) => d.total))), r2(sum(docs.map((d) => d.iva)))], tipo: 'total' });
          return { ...base(), filas, columnas: [col('Tipo DTE', 'texto', 12), col('Certificados', 'entero', 12), col('Pendientes', 'entero', 12), col('Anulados', 'entero', 12), col('Total', 'entero', 10), col('Valor Q', 'monto', 16), col('IVA Q', 'monto', 14)],
            kpis: [['Documentos', docs.length], ['Certificados', cnt('CERTIFICADO').length, 'ec-fin'], ['Pendientes de certificar', cnt('PENDIENTE').length, cnt('PENDIENTE').length ? 'ec-alerta' : ''], ['Anulados', cnt('ANULADO').length]],
            graficas: [G().barras('Documentos por estado', ['CERTIFICADO', 'PENDIENTE', 'ANULADO'].map((e) => ({ etiqueta: e, valor: cnt(e).length }))), G().barras('Valor por tipo de DTE (Q)', tipos.map((t) => ({ etiqueta: t, valor: Math.abs(sum(docs.filter((d) => d.tipo === t).map((d) => d.total))), texto: q(sum(docs.filter((d) => d.tipo === t).map((d) => d.total))) })))] };
        }
        const ls = docs.filter((d) => f.estado === 'TODOS' || d.estadoDte === f.estado);
        return { ...base(), filas: ls.map((d) => ({ valores: [d.fecha, d.tipo, d.serie, d.numero, d.aut ? `${d.aut.slice(0, 8)}…` : '', d.nit, d.nombre, r2(d.total), r2(d.iva), `¤${d.estadoDte}`, d.certif ? new Date(d.certif).toLocaleString('es-GT') : ''], resaltar: d.estadoDte === 'PENDIENTE' })),
          columnas: [col('Fecha', 'texto', 11), col('Tipo', 'texto', 7), col('Serie', 'texto', 11), col('Número DTE', 'texto', 13), col('Autorización', 'texto', 12), col('NIT', 'texto', 12), col('Receptor', 'texto', 34), col('Total Q', 'monto', 14), col('IVA Q', 'monto', 12), col('Estado', 'texto', 13), col('Certificación', 'texto', 17)],
          kpis: [['Documentos', ls.length], ['Certificados', cnt('CERTIFICADO').length, 'ec-fin'], ['Pendientes', cnt('PENDIENTE').length, cnt('PENDIENTE').length ? 'ec-alerta' : ''], ['Anulados', cnt('ANULADO').length], ['IVA débito', q(sum(docs.map((d) => d.iva)))]], vacio: 'No hay DTE emitidos en el período.',
          nota: cnt('PENDIENTE').length ? 'Los pendientes se certifican desde Facturación/Ventas › Facturas Ventas (o Notas) con «Certificar».' : '' };
      }
      if (id === 'dte-recibidos') {
        const ls = extra.map((l) => { const est = l.anulada ? 'ANULADA' : l.compra_id || l.caja_documento_id || l.generado ? 'REGISTRADA' : 'SIN REGISTRAR'; return { ...l, est }; });
        const c = (e) => ls.filter((x) => x.est === e);
        return { ...base(), filas: ls.map((l) => ({ valores: [diaLocal(l.fecha_emision), l.tipo_dte || '', l.serie || '', l.numero || '', l.nit_emisor || '', l.nombre_emisor || '', r2(l.gran_total), r2(l.iva), `¤${l.est}`], resaltar: l.est === 'SIN REGISTRAR' })),
          columnas: [col('Fecha', 'texto', 11), col('Tipo', 'texto', 7), col('Serie', 'texto', 12), col('Número', 'texto', 13), col('NIT emisor', 'texto', 12), col('Emisor', 'texto', 36), col('Total Q', 'monto', 14), col('IVA Q', 'monto', 12), col('Estado', 'texto', 14)],
          kpis: [['DTE recibidos', ls.length], ['Registrados', c('REGISTRADA').length, 'ec-fin'], ['Sin registrar', c('SIN REGISTRAR').length, c('SIN REGISTRAR').length ? 'ec-alerta' : ''], ['IVA de lo recibido', q(sum(ls.filter((x) => !x.anulada).map((x) => num(x.iva))))]],
          vacio: 'No hay DTE recibidos del período: cárgalos en Compras › Procesos › Carga Facturas SAT con el archivo del portal de la SAT.' };
      }
      if (id === 'constancias-retencion') {
        if (f.sentido === 'RECIBIDAS') {
          const ls = D.retenciones.filter((r) => f.tipo === 'TODAS' || r.tipo === f.tipo);
          return { ...base(), filas: [...ls.map((r) => ({ valores: [fmt.fechaDia(r.fecha), r.tipo, r.clase, r.documento, r.constancia, r.nombre, r.pct ? r.pct / 100 : '', r2(r.monto)] })), { valores: [`Total (${ls.length})`, '', '', '', '', '', '', r2(sum(ls.map((r) => r.monto)))], tipo: 'total' }],
            columnas: [col('Fecha', 'texto', 11), col('Tipo', 'texto', 6), col('Origen', 'texto', 12), col('Recibo', 'texto', 14), col('Constancia', 'texto', 16), col('Cliente', 'texto', 40), col('%', 'porcentaje', 8), col('Monto Q', 'monto', 14)],
            kpis: [['Constancias', ls.length], ['IVA retenido', q(sum(ls.filter((r) => r.tipo === 'IVA').map((r) => r.monto))), 'ec-fin'], ['ISR retenido', q(sum(ls.filter((r) => r.tipo === 'ISR').map((r) => r.monto)))]], vacio: 'No hay retenciones recibidas en el período (se registran en Facturación › Recibos o Retenciones).' };
        }
        const ls = D.compras.filter((c) => c.retencion || c.retIsr || c.retIva).flatMap((c) => [...(c.retIsr && f.tipo !== 'IVA' ? [{ c, tipo: 'ISR', monto: c.retIsr }] : []), ...(c.retIva && f.tipo !== 'ISR' ? [{ c, tipo: 'IVA', monto: c.retIva }] : [])]);
        return { ...base(), filas: [...ls.map((x) => ({ valores: [fmt.fechaDia(x.c.fechaRet || x.c.fecha), x.tipo, x.c.formulario, `${x.c.serie}-${x.c.documento}`, x.c.nit, x.c.nombre, r2(x.c.bienes + x.c.servicios), r2(x.monto)] })), { valores: [`Total (${ls.length})`, '', '', '', '', '', '', r2(sum(ls.map((x) => x.monto)))], tipo: 'total' }],
          columnas: [col('Fecha', 'texto', 11), col('Tipo', 'texto', 6), col('Constancia', 'texto', 16), col('Factura', 'texto', 16), col('NIT', 'texto', 12), col('Proveedor', 'texto', 38), col('Base Q', 'monto', 14), col('Retenido Q', 'monto', 14)],
          kpis: [['Retenciones', ls.length], ['ISR retenido a proveedores', q(sum(ls.filter((x) => x.tipo === 'ISR').map((x) => x.monto))), 'ec-fin'], ['IVA retenido a proveedores', q(sum(ls.filter((x) => x.tipo === 'IVA').map((x) => x.monto)))]], vacio: 'No hay retenciones emitidas en el período.' };
      }
      if (id === 'conciliacion-fiscal') {
        const clave = (nit, serie, numero) => `${nitN(nit)}|${String(serie || '').toUpperCase()}|${String(numero || '').replace(/^0+/, '')}`;
        const sat = extra.filter((l) => !l.anulada), comp = D.compras.filter((c) => /FACTURA|ELECTR/i.test(c.tipo));
        const mSat = new Map(sat.map((l) => [clave(l.nit_emisor, l.serie, l.numero), l])), mCom = new Map(comp.map((c) => [clave(c.nit, c.serie, c.documento), c]));
        const filas = [];
        const faltan = sat.filter((l) => !mCom.has(clave(l.nit_emisor, l.serie, l.numero)) && !l.compra_id && !l.caja_documento_id);
        const sobran = comp.filter((c) => !mSat.has(clave(c.nit, c.serie, c.documento)));
        const difer = sat.map((l) => ({ l, c: mCom.get(clave(l.nit_emisor, l.serie, l.numero)) })).filter((x) => x.c && Math.abs(num(x.l.gran_total) - x.c.total) > 0.05);
        const pend = [...D.ventas, ...D.notas].filter((d) => d.estadoDte === 'PENDIENTE');
        const sec = (t, ls, map) => { filas.push({ valores: [`${t} (${ls.length})`], tipo: 'grupo', combinar: true }); ls.slice(0, 500).forEach((x) => filas.push(map(x))); };
        sec('En la SAT y no registradas en compras (se pierde el crédito fiscal)', faltan, (l) => ({ valores: [diaLocal(l.fecha_emision), `${l.serie}-${l.numero}`, l.nit_emisor, l.nombre_emisor, r2(l.gran_total), r2(l.iva), 'Registrar en Ingreso de compras'], resaltar: true }));
        sec('Registradas en compras y no en el archivo de la SAT', extra.length ? sobran : [], (c) => ({ valores: [c.fecha, `${c.serie}-${c.documento}`, c.nit, c.nombre, r2(c.total), r2(c.iva), 'Verificar el DTE en la SAT'] }));
        sec('Con monto distinto entre la SAT y compras', difer, (x) => ({ valores: [x.c.fecha, `${x.c.serie}-${x.c.documento}`, x.c.nit, x.c.nombre, r2(x.c.total), r2(num(x.l.gran_total)), `Diferencia ${fmt.monto(x.c.total - num(x.l.gran_total))}`], resaltar: true }));
        sec('Ventas pendientes de certificar', pend, (d) => ({ valores: [d.fecha, `${d.serie}-${d.numero}`, d.nit, d.nombre, r2(d.total), r2(d.iva), 'Certificar en Facturación'], resaltar: true }));
        return { ...base(), filas, columnas: [col('Fecha', 'texto', 11), col('Documento', 'texto', 18), col('NIT', 'texto', 12), col('Nombre', 'texto', 38), col('Valor Q', 'monto', 14), col('IVA / SAT Q', 'monto', 14), col('Acción', 'texto', 28)],
          kpis: [['DTE en la SAT', sat.length], ['Sin registrar', faltan.length, faltan.length ? 'ec-alerta' : 'ec-fin'], ['Sin DTE en la SAT', extra.length ? sobran.length : '—', extra.length && sobran.length ? 'ec-alerta' : ''], ['Montos distintos', difer.length, difer.length ? 'ec-alerta' : ''], ['Ventas sin certificar', pend.length, pend.length ? 'ec-alerta' : 'ec-fin']],
          nota: extra.length ? '' : 'Para conciliar las compras carga primero el archivo de facturas recibidas del portal de la SAT en Compras › Procesos › Carga Facturas SAT.' };
      }
      if (id === 'libro-ventas') {
        const docs = [...D.ventas, ...D.notas].sort((x, y) => x.fecha.localeCompare(y.fecha) || String(x.numero).localeCompare(String(y.numero)));
        const filas = docs.map((d) => ({ valores: [fmt.fechaDia(d.fecha), d.tipo, d.serie, d.numero, d.nit, d.anulada ? 'ANULADA' : d.nombre, r2(d.gravado), r2(d.exento), r2(d.iva), r2(d.total)] }));
        filas.push({ valores: [`Total (${docs.length} documentos)`, '', '', '', '', '', r2(sum(docs.map((d) => d.gravado))), r2(sum(docs.map((d) => d.exento))), r2(sum(docs.map((d) => d.iva))), r2(sum(docs.map((d) => d.total)))], tipo: 'total' });
        const porDia = new Map(); docs.forEach((d) => porDia.set(d.fecha, (porDia.get(d.fecha) || 0) + d.total));
        return { ...base(), firmas: ['Contador registrado', 'Representante legal'], filas, columnas: [col('Fecha', 'texto', 11), col('Tipo', 'texto', 7), col('Serie', 'texto', 12), col('Número', 'texto', 13), col('NIT', 'texto', 12), col('Cliente', 'texto', 38), col('Gravado Q', 'monto', 15), col('Exento Q', 'monto', 13), col('IVA débito Q', 'monto', 14), col('Total Q', 'monto', 15)],
          kpis: [['Documentos', docs.length], ['Ventas gravadas', q(sum(docs.map((d) => d.gravado)))], ['Exentas', q(sum(docs.map((d) => d.exento)))], ['IVA débito fiscal', q(sum(docs.map((d) => d.iva))), 'ec-fin']],
          graficas: [G().columnas('Ventas por día (Q)', [...porDia.keys()].map((k) => k.slice(8)), [{ nombre: 'Ventas', color: G().COLORES.AZUL, valores: [...porDia.values()] }])], vacio: 'No hay ventas en el período.' };
      }
      // Libro de compras
      const cs = [...D.compras].sort((x, y) => String(x.fecha).localeCompare(String(y.fecha)));
      const filas = cs.map((c) => ({ valores: [fmt.fechaDia(c.fecha), c.tipo, c.serie, c.documento, c.nit, c.nombre, r2(c.bienes), r2(c.servicios), r2(c.idp), r2(c.exento), r2(c.iva), r2(c.total)] }));
      filas.push({ valores: [`Total (${cs.length} documentos)`, '', '', '', '', '', ...['bienes', 'servicios', 'idp', 'exento', 'iva', 'total'].map((k) => r2(sum(cs.map((c) => c[k]))))], tipo: 'total' });
      return { ...base(), firmas: ['Contador registrado', 'Representante legal'], filas, columnas: [col('Fecha', 'texto', 11), col('Tipo', 'texto', 10), col('Serie', 'texto', 12), col('Número', 'texto', 13), col('NIT', 'texto', 12), col('Proveedor', 'texto', 36), col('Bienes Q', 'monto', 14), col('Servicios Q', 'monto', 14), col('Combustibles IDP Q', 'monto', 13), col('Exento Q', 'monto', 12), col('IVA crédito Q', 'monto', 14), col('Total Q', 'monto', 15)],
        kpis: [['Documentos', cs.length], ['Bienes', q(sum(cs.map((c) => c.bienes)))], ['Servicios', q(sum(cs.map((c) => c.servicios)))], ['IVA crédito fiscal', q(sum(cs.map((c) => c.iva))), 'ec-fin']],
        graficas: [G().barras('Proveedores con mayor compra del período (Q)', [...cs.reduce((m, c) => m.set(c.nombre, (m.get(c.nombre) || 0) + c.total), new Map())].map(([k, v]) => ({ etiqueta: k, valor: v, texto: q(v) })).sort((a, b) => b.valor - a.valor).slice(0, 10))],
        vacio: 'No hay compras con período de presentación en las fechas elegidas.' };
    }
    function pintar() {
      const c = cfg;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="cl-banda">${esc(c.titulo)} · ${esc(c.parametros.join(' · '))}</div>
        ${c.kpis?.length ? `<div class="ec-kpis">${c.kpis.map(([t, v, cls]) => kpi(t, v, cls)).join('')}</div>` : ''}
        ${c.nota ? `<p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> ${esc(c.nota)}</p>` : ''}${tabla(c, f.graficas)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => {
      const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') { cargado = ''; return cargar(); }
      const n = e.target.name;
      if (n === 'rango') { f.rango = e.target.value; return cargar(); }
      if (['anio', 'mes'].includes(n)) { f[n] = Number(e.target.value) || f[n]; return consultar(); }
      if (['desde', 'hasta'].includes(n)) { f[n] = e.target.value || f[n]; return consultar(); }
      if (['estado', 'tipo', 'sentido'].includes(n)) { f[n] = e.target.value; cfg = construir(); return pintar(); }
      if (n === 'graficas') { f.graficas = e.target.checked; return pintar(); }
    });
    cont.addEventListener('click', (e) => { const ex = e.target.closest('[data-exp]'); if (ex) exportar(cfg, ex.dataset.exp, f.graficas); });
    iniciar();
  }
  Object.keys(DEF).forEach((k) => { window.PANTALLAS[k] = (cont) => reporte(cont, k); });

  // ===================== Liquidación de impuestos =====================
  window.PANTALLAS['liquidacion-impuestos'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Liquidación de impuestos', icono: 'ti-calculator', clase: 'bk-movimientos bm-solo cx-rep pr-rep sat-liq', grupo: 'Integraciones SAT · Procesos' });
    const { sb } = ctx;
    const h = new Date(); h.setMonth(h.getMonth() - 1);
    const f = { anio: h.getFullYear(), mes: h.getMonth() + 1 };
    let L = null, periodos = [], D = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-calculator'); return; }
      ctx.filtros(`<label class="campo cx-anio"><span>Año</span><input type="number" name="anio" value="${f.anio}" min="2000" max="2999"></label><label class="campo"><span>Mes</span><select name="mes">${MES.map((m, i) => `<option value="${i + 1}" ${f.mes === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>`, botonesExp);
      ctx.pDet.innerHTML = '<p class="vacio">Calculando la liquidación…</p>';
      try {
        const r = await sb.from('sat_periodos_fiscales').select('*').eq('localidad_id', ctx.sel.loc).order('anio').order('mes');
        if (r.error) return faltaScript(ctx, r.error);
        periodos = r.data || [];
        D = await datosFiscales(ctx, iniMes(f.anio, f.mes), finMes(f.anio, f.mes));
        const ant = periodos.find((p) => p.anio * 12 + p.mes === f.anio * 12 + f.mes - 1 && p.estado === 'CERRADO');
        L = liquidar(D, num(ant?.remanente_siguiente), f.anio, f.mes);
      } catch (e) { return faltaScript(ctx, e); }
      pintar();
    }
    const actual = () => periodos.find((p) => p.anio === f.anio && p.mes === f.mes);
    function cfgL() {
      const p = actual(), cerrado = p?.estado === 'CERRADO', V = cerrado ? { ...L, ...p } : L;
      const fila = (t, v, tipo) => ({ valores: [t, r2(v)], tipo });
      const filas = V.pequeno ? [{ valores: ['RÉGIMEN DE PEQUEÑO CONTRIBUYENTE (SAT-2046)'], tipo: 'grupo', combinar: true }, fila('Ingresos del mes', sum([...D.ventas, ...D.notas].map((d) => d.total))), fila('Impuesto 5 % a pagar', V.iva_a_pagar, 'total')]
        : [{ valores: ['DÉBITOS (ventas · SAT-2237)'], tipo: 'grupo', combinar: true }, fila('Ventas y servicios gravados', V.ventas_gravadas), fila('Ventas exentas', V.ventas_exentas), fila('Débito fiscal (IVA de ventas)', V.debito_fiscal, 'subtotal'),
          { valores: ['CRÉDITOS (compras)'], tipo: 'grupo', combinar: true }, fila('Compras y servicios gravados', V.compras_gravadas), fila('Crédito fiscal (IVA de compras)', V.credito_fiscal, 'subtotal'),
          { valores: ['DETERMINACIÓN DEL IMPUESTO'], tipo: 'grupo', combinar: true }, fila('Débito fiscal', V.debito_fiscal), fila('(−) Crédito fiscal', -V.credito_fiscal), fila('(−) Retenciones de IVA recibidas (constancias)', -V.retenciones_iva), fila('(−) Remanente de crédito del período anterior', -V.remanente_anterior),
          fila('IVA A PAGAR', V.iva_a_pagar, 'total'), fila('Remanente de crédito para el período siguiente', V.remanente_siguiente, 'subtotal')];
      filas.push({ valores: ['IMPUESTO SOBRE LA RENTA'], tipo: 'grupo', combinar: true });
      filas.push(D.em?.regimen_isr === 'SIMPLIFICADO' ? fila('ISR régimen opcional simplificado (5 % / 7 %) menos retenciones (SAT-1311)', V.isr_estimado, 'subtotal') : { valores: ['ISR sobre utilidades: pago trimestral del 25 % sobre la renta imponible (SAT-1361). Ver Contabilidad › Estado de resultados del trimestre.', ''] });
      filas.push(fila('ISR retenido por clientes en el mes', V.retenciones_isr || 0));
      return { titulo: `Liquidación de impuestos · ${MES[f.mes - 1]} ${f.anio}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Liquidacion', archivo: `liquidacion_${f.anio}_${String(f.mes).padStart(2, '0')}`, firmas: ['Contador registrado', 'Representante legal'],
        parametros: [`Empresa: ${empresaDe(ctx)}`, `NIT: ${D.em?.nit || '—'}`, `Régimen IVA: ${D.em?.regimen_iva || 'GENERAL (sin registrar)'}`, `ISR: ${D.em?.regimen_isr || 'UTILIDADES'}`, cerrado ? `Período CERRADO por ${p.cerrado_por}` : 'Período abierto (cálculo en línea)'],
        columnas: [col('Concepto', 'texto', 70), col('Q', 'monto', 18)], filas, V, cerrado, p,
        graficas: [G().barras('IVA del período (Q)', [['Débito fiscal', V.debito_fiscal], ['Crédito fiscal', V.credito_fiscal], ['Retenciones', V.retenciones_iva], ['IVA a pagar', V.iva_a_pagar]].map(([t, v]) => ({ etiqueta: t, valor: v, texto: q(v) })))] };
    }
    function pintar() {
      const c = cfgL(), V = c.V, termino = finMes(f.anio, f.mes) < fmt.hoy();
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">
        <section class="pr-cab"><div class="pr-id"><small>Período fiscal</small><b>${MES[f.mes - 1]} ${f.anio}</b>${marca(c.cerrado ? 'PRESENTADA' : 'PENDIENTE').replace(/>[^<]+</, `>${c.cerrado ? 'CERRADO' : c.p?.estado === 'REABIERTO' ? 'REABIERTO' : 'ABIERTO'}<`)}</div>
          <div class="pr-datos"><span><small>NIT</small>${esc(D.em?.nit || 'Registra los Datos del emisor')}</span><span><small>Régimen IVA</small>${esc(D.em?.regimen_iva || '—')}</span><span><small>Régimen ISR</small>${esc(D.em?.regimen_isr || '—')}</span><span><small>Documentos</small>${V.documentos_venta ?? '—'} de venta · ${V.documentos_compra ?? '—'} de compra</span>${c.cerrado ? `<span><small>Cerró</small>${esc(c.p.cerrado_por || '')} · ${esc(new Date(c.p.cerrado_en).toLocaleString('es-GT'))}</span>` : ''}${c.p?.motivo_reapertura ? `<span class="pc-rojo"><small>Reapertura</small>${esc(c.p.motivo_reapertura)}</span>` : ''}</div>
          <div class="pr-acc">${ctx.admin && !c.cerrado && termino ? '<button type="button" class="boton primario-sm" data-accion="cerrar"><i class="ti ti-lock" aria-hidden="true"></i> Cerrar período</button>' : ''}${c.cerrado && window.FIN.esSuperAdmin() ? '<button type="button" class="boton secundario-sm" data-accion="reabrir"><i class="ti ti-lock-open" aria-hidden="true"></i> Reabrir</button>' : ''}</div></section>
        <div class="ec-kpis">${kpi('Débito fiscal', q(V.debito_fiscal))}${kpi('Crédito fiscal', q(V.credito_fiscal))}${kpi('Retenciones IVA', q(V.retenciones_iva))}${kpi('IVA a pagar', q(V.iva_a_pagar), V.iva_a_pagar > 0 ? 'ec-alerta' : 'ec-fin')}${kpi('Remanente siguiente', q(V.remanente_siguiente))}</div>
        <div class="sat-meses">${M3.map((m, i) => { const p = periodos.find((x) => x.anio === f.anio && x.mes === i + 1); return `<button type="button" data-mes="${i + 1}" class="${i + 1 === f.mes ? 'actual' : ''} ${p?.estado === 'CERRADO' ? 'cerrado' : ''}" title="${p?.estado === 'CERRADO' ? `Cerrado · IVA ${q(p.iva_a_pagar)}` : 'Abierto'}">${m}${p?.estado === 'CERRADO' ? ' <i class="ti ti-lock"></i>' : ''}</button>`; }).join('')}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Cálculo de referencia para Declaraguate: débito de las facturas y notas del mes, crédito de las compras con período de presentación en el mes, retenciones de IVA recibidas y remanente del mes anterior cerrado. Al cerrar el período se guarda la liquidación y se bloquean las facturas, notas y compras del mes.</p>
        ${tabla(c)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); if (['anio', 'mes'].includes(e.target.name)) { f[e.target.name] = Number(e.target.value) || f[e.target.name]; return cargar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfgL(), ex.dataset.exp);
      const bm = e.target.closest('[data-mes]'); if (bm) { f.mes = Number(bm.dataset.mes); return cargar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'cerrar') { if (!confirm(`¿Cerrar el período fiscal ${MES[f.mes - 1]} ${f.anio}?\n\nIVA a pagar ${q(L.iva_a_pagar)} · remanente ${q(L.remanente_siguiente)}.\nYa no se podrán modificar las facturas, notas y compras del mes.`)) return;
        const { error } = await sb.rpc('cerrar_periodo_fiscal', { p_localidad: ctx.sel.loc, p_anio: f.anio, p_mes: f.mes, p_datos: L }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); window.FIN.aviso('Período fiscal cerrado'); return cargar(); }
      if (a === 'reabrir') { const m = prompt('Motivo de la reapertura (por ejemplo, rectificación de la declaración):'); if (!m) return; const { error } = await sb.rpc('reabrir_periodo_fiscal', { p_id: actual().id, p_motivo: m }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); return cargar(); }
    });
    iniciar();
  };

  // ===================== Resumen de IVA (año) =====================
  window.PANTALLAS['resumen-iva'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Resumen de IVA', icono: 'ti-chart-histogram', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Integraciones SAT · Reportes' });
    const { sb } = ctx;
    const f = { anio: new Date().getFullYear(), graficas: true };
    let cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-chart-histogram'); return; }
      ctx.filtros(`<label class="campo cx-anio"><span>Año</span><input type="number" name="anio" value="${f.anio}" min="2000" max="2999"></label><label class="pc-check"><input type="checkbox" name="graficas" ${f.graficas ? 'checked' : ''}> Gráficas</label>`, botonesExp);
      ctx.pDet.innerHTML = '<p class="vacio">Calculando el año…</p>';
      try {
        const r = await sb.from('sat_periodos_fiscales').select('*').eq('localidad_id', ctx.sel.loc).eq('anio', f.anio);
        if (r.error) return faltaScript(ctx, r.error);
        const hasta = `${f.anio}-12-31` < fmt.hoy() ? `${f.anio}-12-31` : fmt.hoy();
        const D = await datosFiscales(ctx, `${f.anio}-01-01`, hasta);
        let rem = 0; const filas = [], meses = [];
        for (let m = 1; m <= 12; m++) {
          const a = iniMes(f.anio, m); if (a > hasta) break;
          const p = (r.data || []).find((x) => x.mes === m && x.estado === 'CERRADO');
          const dm = { em: D.em, ventas: D.ventas.filter((x) => x.fecha.slice(5, 7) == m), notas: D.notas.filter((x) => x.fecha.slice(5, 7) == m), compras: D.compras.filter((x) => Number(x.periodo.slice(5, 7)) === m), retenciones: D.retenciones.filter((x) => Number(x.fecha.slice(5, 7)) === m) };
          const L = p || liquidar(dm, rem, f.anio, m); rem = num(L.remanente_siguiente);
          meses.push(L); filas.push({ valores: [MES[m - 1], r2(L.ventas_gravadas), r2(L.debito_fiscal), r2(L.compras_gravadas), r2(L.credito_fiscal), r2(L.retenciones_iva), r2(L.remanente_anterior), r2(L.iva_a_pagar), r2(L.remanente_siguiente), p ? 'Cerrado' : 'Calculado'] });
        }
        const S = (k) => r2(sum(meses.map((x) => x[k])));
        filas.push({ valores: ['Total del año', S('ventas_gravadas'), S('debito_fiscal'), S('compras_gravadas'), S('credito_fiscal'), S('retenciones_iva'), '', S('iva_a_pagar'), '', ''], tipo: 'total' });
        cfg = { titulo: `Resumen de IVA ${f.anio}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Resumen IVA', archivo: `resumen_iva_${f.anio}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `NIT: ${D.em?.nit || '—'}`], filas,
          columnas: [col('Mes', 'texto', 12), col('Ventas gravadas', 'monto', 15), col('Débito', 'monto', 13), col('Compras gravadas', 'monto', 15), col('Crédito', 'monto', 13), col('Retenciones', 'monto', 13), col('Remanente ant.', 'monto', 13), col('IVA a pagar', 'monto', 13), col('Remanente sig.', 'monto', 13), col('Estado', 'texto', 10)],
          kpis: [['Débito del año', q(S('debito_fiscal'))], ['Crédito del año', q(S('credito_fiscal'))], ['IVA pagado / por pagar', q(S('iva_a_pagar')), 'ec-fin'], ['Meses cerrados', (r.data || []).filter((x) => x.estado === 'CERRADO').length]],
          graficas: [G().columnas('IVA débito vs. crédito por mes (Q)', meses.map((x) => M3[x.mes - 1]), [{ nombre: 'Débito', color: G().COLORES.NARANJA, valores: meses.map((x) => num(x.debito_fiscal)) }, { nombre: 'Crédito', color: G().COLORES.VERDE, valores: meses.map((x) => num(x.credito_fiscal)) }]), G().columnas('IVA a pagar por mes (Q)', meses.map((x) => M3[x.mes - 1]), [{ nombre: 'IVA a pagar', color: G().COLORES.AZUL, valores: meses.map((x) => num(x.iva_a_pagar)) }])] };
      } catch (e) { return faltaScript(ctx, e); }
      pintar();
    }
    function pintar() { ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="cl-banda">${esc(cfg.titulo)} · ${esc(cfg.parametros.join(' · '))}</div><div class="ec-kpis">${cfg.kpis.map(([t, v, c]) => kpi(t, v, c)).join('')}</div>${tabla(cfg, f.graficas)}</div>`; window.CUENTAS_XLSX.ajustarAlto(cont); }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); if (e.target.name === 'anio') { f.anio = Number(e.target.value) || f.anio; return cargar(); } if (e.target.name === 'graficas') { f.graficas = e.target.checked; pintar(); } });
    cont.addEventListener('click', (e) => { const ex = e.target.closest('[data-exp]'); if (ex) exportar(cfg, ex.dataset.exp, f.graficas); });
    iniciar();
  };

  // ===================== Calendario fiscal =====================
  // Vencimientos en días hábiles (lunes a viernes; no considera los asuetos oficiales: revisarlos en el calendario de la SAT).
  const habil = (d) => d.getDay() !== 0 && d.getDay() !== 6;
  const ultimoHabil = (a, m) => { const d = new Date(a, m, 0); while (!habil(d)) d.setDate(d.getDate() - 1); return d; };
  const nHabiles = (a, m, n) => { const d = new Date(a, m - 1, 1); let k = habil(d) ? 1 : 0; while (k < n) { d.setDate(d.getDate() + 1); if (habil(d)) k++; } return d; };
  const sig = (a, m) => (m === 12 ? [a + 1, 1] : [a, m + 1]);
  function obligaciones(em, anio) {
    const out = [];
    for (let m = 1; m <= 12; m++) {
      const [a2, m2] = sig(anio, m);
      if (em?.regimen_iva === 'PEQUEÑO CONTRIBUYENTE') out.push({ clave: 'IVA-PEQ', nombre: 'IVA pequeño contribuyente (5 %)', formulario: 'SAT-2046', periodo: m, vence: ultimoHabil(a2, m2) });
      else out.push({ clave: 'IVA', nombre: 'IVA régimen general', formulario: 'SAT-2237', periodo: m, vence: ultimoHabil(a2, m2) });
      out.push({ clave: 'LIBROS', nombre: 'Libros de compras y ventas (Asiste Libros)', formulario: 'Asiste Libros', periodo: m, vence: ultimoHabil(a2, m2) });
      if (em?.regimen_isr === 'SIMPLIFICADO') out.push({ clave: 'ISR-M', nombre: 'ISR régimen opcional simplificado', formulario: 'SAT-1311', periodo: m, vence: nHabiles(a2, m2, 10) });
      if (em?.agente_retencion_isr !== false) out.push({ clave: 'RET-ISR', nombre: 'Retenciones de ISR efectuadas', formulario: 'Declaraguate', periodo: m, vence: nHabiles(a2, m2, 10) });
      if (em?.agente_retencion_iva) out.push({ clave: 'RET-IVA', nombre: 'Retenciones de IVA (agente retenedor)', formulario: 'RetenIVA', periodo: m, vence: nHabiles(a2, m2, 15) });
      if (m % 3 === 0) {
        if (em?.regimen_isr !== 'SIMPLIFICADO') out.push({ clave: 'ISR-T', nombre: `ISR trimestral sobre utilidades (T${m / 3})`, formulario: 'SAT-1361', periodo: m, vence: nHabiles(a2, m2, 10) });
        out.push({ clave: 'ISO', nombre: `Impuesto de Solidaridad (T${m / 3})`, formulario: 'SAT-1608', periodo: m, vence: ultimoHabil(a2, m2) });
      }
    }
    out.push({ clave: 'ISR-A', nombre: 'ISR anual (declaración jurada y estados financieros)', formulario: 'SAT-1411', periodo: 0, vence: (() => { const d = new Date(anio + 1, 2, 31); while (!habil(d)) d.setDate(d.getDate() - 1); return d; })() });
    return out.sort((x, y) => x.vence - y.vence);
  }
  window.PANTALLAS['calendario-fiscal'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Calendario fiscal', icono: 'ti-calendar-due', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Integraciones SAT · Procesos' });
    const { sb } = ctx;
    const f = { anio: new Date().getFullYear(), ver: 'TODAS' };
    let em = null, pres = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-calendar-due'); return; }
      ctx.filtros(`<label class="campo cx-anio"><span>Año</span><input type="number" name="anio" value="${f.anio}" min="2000" max="2999"></label><label class="campo"><span>Mostrar</span><select name="ver">${['TODAS', 'PENDIENTES', 'VENCIDAS', 'PRESENTADAS'].map((x) => `<option ${f.ver === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`, botonesExp);
      const [e, p] = await Promise.all([emisorDe(sb, ctx.sel.loc), sb.from('sat_obligaciones_presentadas').select('*').eq('localidad_id', ctx.sel.loc).eq('anio', f.anio)]);
      if (p.error) return faltaScript(ctx, p.error);
      em = e; pres = p.data || []; cfg = construir(); pintar();
    }
    function construir() {
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const os = obligaciones(em, f.anio).map((o) => { const p = pres.find((x) => x.obligacion === o.clave && x.periodo === o.periodo); const dias = Math.round((o.vence - hoy) / 864e5); const est = p ? 'PRESENTADA' : dias < 0 ? 'VENCIDA' : dias <= 10 ? 'PRÓXIMA' : 'PENDIENTE'; return { ...o, p, dias, est }; })
        .filter((o) => f.ver === 'TODAS' || (f.ver === 'PENDIENTES' ? ['PENDIENTE', 'PRÓXIMA'].includes(o.est) : f.ver === 'VENCIDAS' ? o.est === 'VENCIDA' : o.est === 'PRESENTADA'));
      return { titulo: `Calendario fiscal ${f.anio}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Calendario fiscal', archivo: `calendario_fiscal_${f.anio}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `Régimen IVA: ${em?.regimen_iva || 'GENERAL'} · ISR: ${em?.regimen_isr || 'UTILIDADES'}`, 'Vencimientos en días hábiles (sin asuetos)'], os,
        filas: os.map((o) => ({ valores: [o.vence.toLocaleDateString('es-GT'), o.nombre, o.formulario, o.periodo ? `${MES[o.periodo - 1]} ${f.anio}` : `Año ${f.anio}`, `¤${o.est}`, o.p ? `${fmt.fechaDia(o.p.fecha_presentacion)} · ${o.p.numero_acceso || ''}` : o.dias >= 0 ? `faltan ${o.dias} día(s)` : `vencida hace ${-o.dias} día(s)`, o.p ? r2(o.p.monto) : ''], attr: `data-o="${o.clave}" data-per="${o.periodo}"`, resaltar: o.est === 'VENCIDA' })),
        columnas: [col('Vence', 'texto', 11), col('Obligación', 'texto', 44), col('Formulario', 'texto', 14), col('Período', 'texto', 16), col('Estado', 'texto', 13), col('Presentación / plazo', 'texto', 28), col('Monto Q', 'monto', 14)] };
    }
    function pintar() {
      const c = cfg, n = (e) => c.os.filter((o) => o.est === e).length;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="cl-banda">${esc(c.titulo)} · ${esc(c.parametros.join(' · '))}</div>
        <div class="ec-kpis">${kpi('Obligaciones', c.os.length)}${kpi('Presentadas', n('PRESENTADA'), 'ec-fin')}${kpi('Próximas (10 días)', n('PRÓXIMA'), n('PRÓXIMA') ? 'ec-alerta' : '')}${kpi('Vencidas', n('VENCIDA'), n('VENCIDA') ? 'ec-alerta' : '')}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Las obligaciones salen del régimen registrado en Datos del emisor. ${ctx.admin ? 'Toca una fila para registrar su presentación (fecha, número de acceso de Declaraguate y monto).' : ''} Verifica los asuetos en el calendario oficial de la SAT.</p>
        ${tabla(c, false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); if (e.target.name === 'anio') { f.anio = Number(e.target.value) || f.anio; return cargar(); } if (e.target.name === 'ver') { f.ver = e.target.value; cfg = construir(); pintar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp, false);
      const tr = e.target.closest('tr[data-o]'); if (!tr || !ctx.admin) return;
      const o = cfg.os.find((x) => x.clave === tr.dataset.o && String(x.periodo) === tr.dataset.per);
      if (o.p) { if (!confirm(`¿Quitar el registro de presentación de «${o.nombre}»?`)) return; await sb.from('sat_obligaciones_presentadas').delete().eq('id', o.p.id); return cargar(); }
      const acceso = prompt(`Presentación de «${o.nombre}» (${o.periodo ? MES[o.periodo - 1] : 'anual'} ${f.anio}).\nNúmero de acceso o formulario de Declaraguate:`); if (acceso == null) return;
      const monto = prompt('Monto pagado (Q):', '0'); if (monto == null) return;
      const { error } = await sb.from('sat_obligaciones_presentadas').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, obligacion: o.clave, anio: f.anio, periodo: o.periodo, formulario: o.formulario, numero_acceso: acceso.trim() || null, monto: num(monto), usuario: (window.FIN.perfil()?.usuario || '').toUpperCase() });
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      window.FIN.aviso('Presentación registrada'); cargar();
    });
    iniciar();
  };
})();
