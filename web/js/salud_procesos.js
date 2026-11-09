// Hospital y Clínicas médicas · etapa 2 (script 162): procesos.
// Kits, paquetes y devoluciones de la cuenta; auditoría de cuenta médica; facturación de cuentas en Facturación/Ventas;
// glosas de aseguradoras; cuentas incobrables con su partida; botiquines de piso; libro de controlados; esterilización
// (CEYE) y mantenimiento de equipo médico. Usa window.SALUD (salud.js) y window.CONTA (cierre contable).
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const S = () => window.SALUD;
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const q = (n) => `Q ${fmt.monto(n)}`;
  const hoy = () => fmt.hoy();
  const errorTxt = (e) => window.UI.traducirError(e);
  const falta = (ctx, e) => { ctx.pDet.innerHTML = `<p class="vacio">${/med_|ceye_|far_|hos_/.test(e?.message || '') ? 'Falta instalar el script 162 (Hospital y clínicas, etapa 2) en Supabase.' : esc(errorTxt(e))}</p>`; };
  const dias = (a, b = hoy()) => Math.max(0, Math.round((new Date(`${b}T12:00:00`) - new Date(`${String(a).slice(0, 10)}T12:00:00`)) / 864e5));
  // Tabla simple con columnas {titulo, tipo} y filas {valores, resaltar, acciones, attr}.
  function tabla(c) {
    const n = c.columnas.length + (c.acciones ? 1 : 0);
    return `<div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${c.columnas.map((x) => `<th class="${x.tipo === 'texto' ? '' : 'num'}">${esc(x.titulo)}</th>`).join('')}${c.acciones ? '<th></th>' : ''}</tr></thead><tbody>
      ${c.filas.length ? c.filas.map((r) => (r.tipo === 'grupo' ? `<tr class="pr-g"><td colspan="${n}">${esc(r.valores[0])}</td></tr>` : `<tr class="${r.tipo === 'total' ? 'pr-t' : r.tipo === 'subtotal' ? 'pr-s' : ''}${r.resaltar ? ' pr-alerta' : ''}" ${r.attr || ''}>${c.columnas.map((x, i) => S().celda(r.valores[i], x)).join('')}${c.acciones ? `<td class="cli-acc">${r.acciones || ''}</td>` : ''}</tr>`)).join('') : `<tr><td colspan="${n}" class="tk-vacio">${esc(c.vacio || 'Sin información.')}</td></tr>`}</tbody></table></div>`;
  }
  const exportar = (c, f) => S().exportar({ ...c, filas: c.filas.map((r) => (r.tipo === 'grupo' ? { valores: [r.valores[0]], tipo: 'grupo', combinar: true } : r)) }, f);
  const encabezado = (ctx, filtros, acciones = '') => ctx.filtros(filtros, `${acciones}${S().botonesExp}`);

  // ===================== Kits, paquetes y devoluciones =====================
  window.PANTALLAS['hos-kits-paquetes'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Kits, paquetes y devoluciones', icono: 'ti-package', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Hospital · Procesos' });
    const { sb } = ctx;
    let B = null, adm = null, cargos = [], devs = [], bodegas = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-package'); return; }
      try { B = await S().base(ctx); const { data } = await sb.from('bodegas').select('id, codigo, nombre').eq('localidad_id', ctx.sel.loc).order('codigo'); bodegas = data || []; } catch (e) { return falta(ctx, e); }
      const abiertas = B.admisiones.filter((a) => a.estado === 'ABIERTA');
      if (!adm || !abiertas.some((a) => a.id === adm)) adm = abiertas[0]?.id || null;
      encabezado(ctx, `<label class="campo sat-ancho"><span>Admisión abierta</span><select name="adm">${abiertas.map((a) => `<option value="${a.id}" ${a.id === adm ? 'selected' : ''}>${esc(`Adm. ${a.numero} · ${S().nomPac(B, a.paciente_id)}`)}</option>`).join('')}</select></label>`);
      await leer();
    }
    async function leer() {
      if (!adm) { ctx.pDet.innerHTML = ctx.vacio('No hay admisiones abiertas.', 'ti-package'); return; }
      const [c, d, a] = await Promise.all([sb.from('hos_cargos').select('*').eq('admision_id', adm).order('id'), sb.from('far_devoluciones').select('*').eq('admision_id', adm).order('id'), sb.from('hos_admisiones').select('paquete_id').eq('id', adm).single()]);
      if (d.error) return falta(ctx, d.error);
      cargos = c.data || []; devs = d.data || []; const paq = a.data?.paquete_id; pintar(paq);
    }
    function pintar(paq) {
      const devuelto = (id) => sum(devs.filter((x) => x.cargo_id === id).map((x) => x.cantidad));
      cfg = { titulo: 'Cuenta del paciente', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Cuenta', archivo: `cuenta_adm_${adm}`, parametros: [S().nomAdm(B, adm)],
        columnas: [col('Fecha', 'texto', 10), col('Tipo', 'texto', 12), col('Descripción', 'texto', 46), col('Médico', 'texto', 18), col('Cant.', 'numero', 7), col('Precio', 'monto', 12), col('Total', 'monto', 13), col('Origen', 'texto', 10)],
        filas: [...cargos.map((c) => ({ valores: [fmt.fechaDia(c.fecha), c.tipo, c.descripcion, S().nomMed(B, c.medico_id), num(c.cantidad), r2(c.precio), r2(c.total), c.origen], resaltar: num(c.precio) === 0 && c.origen !== 'DÍA-CAMA',
          acciones: c.origen === 'FARMACIA' && num(c.precio) >= 0 && num(c.cantidad) - devuelto(c.id) > 0 && ctx.admin ? `<button type="button" class="boton secundario-sm" data-dev="${c.id}">Devolver (${num(c.cantidad) - devuelto(c.id)})</button>` : '' })),
          { valores: ['Total de la cuenta', '', '', '', '', '', r2(sum(cargos.map((c) => c.total))), ''], tipo: 'total' }], acciones: true };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Cargos', cargos.length)}${kpi('Total de la cuenta', q(sum(cargos.map((c) => c.total))), 'ec-fin')}${kpi('Paquete', paq ? S().nom(B.paquetes, paq) : 'Sin paquete')}${kpi('Devoluciones', devs.length)}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> El paquete quirúrgico carga su precio cerrado (separando los honorarios del cirujano y del anestesiólogo para su liquidación). El kit carga los artículos del procedimiento y descarga de la bodega los que tienen producto. La devolución regresa a la bodega lo no utilizado y descuenta la cuenta. Los cargos sin precio se resaltan.</p>
        ${ctx.admin ? `<div class="sat-g"><label class="campo sat-ancho"><span>Paquete quirúrgico</span><select name="paquete" ${paq ? 'disabled' : ''}>${B.paquetes.filter((p) => p.activo).map((p) => `<option value="${p.id}">${esc(`${p.nombre} · Q ${fmt.monto(p.precio)}`)}</option>`).join('')}</select></label>
          <label class="campo"><span>Cirujano</span><select name="cirujano"><option value="">—</option>${B.medicos.filter((m) => m.activo).map((m) => `<option value="${m.id}">${esc(m.nombre)}</option>`).join('')}</select></label><label class="campo"><span>Anestesiólogo</span><select name="anestesia"><option value="">—</option>${B.medicos.filter((m) => m.activo).map((m) => `<option value="${m.id}">${esc(m.nombre)}</option>`).join('')}</select></label>
          <button type="button" class="boton secundario-sm" data-accion="paquete" ${paq || !B.paquetes.length ? 'disabled' : ''}><i class="ti ti-box" aria-hidden="true"></i> Aplicar paquete</button></div>
          <div class="sat-g"><label class="campo sat-ancho"><span>Kit</span><select name="kit">${B.kits.filter((k) => k.activo).map((k) => `<option value="${k.id}">${esc(k.nombre)}</option>`).join('')}</select></label><label class="campo"><span>Bodega (farmacia)</span><select name="bodega"><option value="">Sin descargar inventario</option>${bodegas.map((b) => `<option value="${b.id}">${esc(`${b.codigo} · ${b.nombre}`)}</option>`).join('')}</select></label>
          <button type="button" class="boton secundario-sm" data-accion="kit" ${B.kits.length ? '' : 'disabled'}><i class="ti ti-first-aid-kit" aria-hidden="true"></i> Cargar kit</button></div>` : ''}${tabla(cfg)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') { adm = null; return cargar(); } if (e.target.name === 'adm') { adm = Number(e.target.value); leer(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp);
      const dv = e.target.closest('[data-dev]');
      if (dv) { const n = Number(prompt('Cantidad a devolver:', '1')); if (!n) return; const m = prompt('Motivo:', 'NO UTILIZADO') || null; const { error } = await sb.rpc('hos_devolver', { p_cargo: Number(dv.dataset.dev), p_cantidad: n, p_motivo: m }); if (error) return window.FIN.aviso(errorTxt(error)); window.FIN.aviso('Devolución registrada'); return leer(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion; const v = (n) => cont.querySelector(`[name=${n}]`)?.value;
      if (a === 'paquete') { const { data, error } = await sb.rpc('hos_aplicar_paquete', { p_admision: adm, p_paquete: Number(v('paquete')), p_cirujano: Number(v('cirujano')) || null, p_anestesiologo: Number(v('anestesia')) || null }); if (error) return window.FIN.aviso(errorTxt(error)); window.FIN.aviso(`Paquete aplicado: Q ${fmt.monto(data)}`); return leer(); }
      if (a === 'kit') { const { data, error } = await sb.rpc('hos_cargar_kit', { p_admision: adm, p_kit: Number(v('kit')), p_bodega: Number(v('bodega')) || null }); if (error) return window.FIN.aviso(errorTxt(error)); window.FIN.aviso(`${data} artículo(s) del kit cargados`); return leer(); }
    });
    iniciar();
  };

  // ===================== Auditoría de cuenta médica =====================
  window.PANTALLAS['hos-auditoria-cuenta'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Auditoría de cuenta médica', icono: 'ti-file-search', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Hospital · Procesos' });
    const { sb } = ctx;
    let B = null, R = [], cfg = null, sel = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-file-search'); return; }
      encabezado(ctx, '', '<button type="button" class="boton secundario-sm" data-accion="actualizar"><i class="ti ti-refresh" aria-hidden="true"></i> Auditar</button>');
      ctx.pDet.innerHTML = '<p class="vacio">Auditando las cuentas…</p>';
      try {
        B = await S().base(ctx);
        const ads = B.admisiones.filter((a) => a.estado === 'ABIERTA' || a.estado === 'EGRESADA' || (a.estado === 'FACTURADA' && S().diaGt(a.fecha_ingreso) >= S().sumarDias(hoy(), -60)));
        const ids = ads.map((a) => a.id).concat([0]);
        const [ca, or, kx, ep, ga, full] = await Promise.all([S().leerTodo(() => sb.from('hos_cargos').select('id, admision_id, fecha, tipo, descripcion, cantidad, precio, total, origen, medico_id').in('admision_id', ids).order('id')), sb.from('hos_ordenes').select('id, admision_id, tipo, estado, cargo_id').in('admision_id', ids),
          sb.from('hos_kardex').select('admision_id, estado').in('admision_id', ids), sb.from('hos_epicrisis').select('admision_id').in('admision_id', ids), sb.from('med_garantias').select('admision_id, monto_autorizado, estado').in('admision_id', ids).in('estado', ['AUTORIZADA', 'PARCIAL']),
          sb.from('hos_admisiones').select('id, ultimo_dia_cama, cama_id, total_cargos, parte_paciente, total_pagos, factura_paciente_id, factura_aseguradora_id, aseguradora_id, parte_aseguradora').in('id', ids)]);
        if (ga.error) throw ga.error;
        const ayer = S().sumarDias(hoy(), -1);
        R = ads.map((a) => {
          const x = (full.data || []).find((y) => y.id === a.id) || {}, cs = ca.filter((c) => c.admision_id === a.id), H = [];
          const sinPrecio = cs.filter((c) => num(c.precio) === 0 && c.origen !== 'DÍA-CAMA'); if (sinPrecio.length) H.push(['Cargos sin precio', sinPrecio.length, sinPrecio.slice(0, 3).map((c) => c.descripcion).join('; ')]);
          const claves = new Map(); cs.filter((c) => num(c.precio) > 0).forEach((c) => { const k = `${c.fecha}|${c.descripcion}|${c.cantidad}`; claves.set(k, (claves.get(k) || 0) + 1); });
          const dup = [...claves.entries()].filter(([, n]) => n > 1); if (dup.length) H.push(['Posibles cargos duplicados', dup.length, dup.slice(0, 3).map(([k]) => k.split('|')[1]).join('; ')]);
          if (a.estado === 'ABIERTA' && x.cama_id && (!x.ultimo_dia_cama || x.ultimo_dia_cama < ayer)) H.push(['Días-cama sin cargar', 1, `Último cargado: ${x.ultimo_dia_cama ? fmt.fechaDia(x.ultimo_dia_cama) : 'ninguno'}`]);
          const ordCargo = new Set((or.data || []).filter((o) => o.cargo_id).map((o) => o.cargo_id)); const sinOrden = cs.filter((c) => c.origen === 'FARMACIA' && num(c.precio) > 0 && !ordCargo.has(c.id)); if (sinOrden.length) H.push(['Medicamentos sin orden médica', sinOrden.length, sinOrden.slice(0, 3).map((c) => c.descripcion).join('; ')]);
          const despachadas = (or.data || []).filter((o) => o.admision_id === a.id && o.tipo === 'MEDICAMENTO' && o.estado === 'DESPACHADA').length, adm = kx.data ? kx.data.filter((k) => k.admision_id === a.id && k.estado === 'ADMINISTRADA').length : 0;
          if (despachadas > adm) H.push(['Medicamentos despachados sin registro de administración', despachadas - adm, `${despachadas} despachados, ${adm} administrados en kardex`]);
          const honSin = cs.filter((c) => c.tipo === 'HONORARIO' && !c.medico_id); if (honSin.length) H.push(['Honorarios sin médico', honSin.length, 'No se podrán liquidar']);
          const gar = (ga.data || []).filter((g) => g.admision_id === a.id); const aut = sum(gar.map((g) => g.monto_autorizado)); if (gar.length && num(x.total_cargos) > aut) H.push(['Cuenta excede la carta de garantía', 1, `Cargos ${q(x.total_cargos)} vs. autorizado ${q(aut)}`]);
          if (a.aseguradora_id && !gar.length) H.push(['Paciente asegurado sin carta de garantía', 1, S().nom(B.aseguradoras, a.aseguradora_id)]);
          if (a.estado !== 'ABIERTA' && !(ep.data || []).some((y) => y.admision_id === a.id)) H.push(['Egreso sin epicrisis', 1, '']);
          if (a.estado !== 'ABIERTA' && num(x.parte_paciente) > 0 && !x.factura_paciente_id) H.push(['Parte del paciente sin facturar', 1, q(x.parte_paciente)]);
          if (a.estado !== 'ABIERTA' && num(x.parte_aseguradora) > 0 && !x.factura_aseguradora_id) H.push(['Parte de la aseguradora sin facturar', 1, q(x.parte_aseguradora)]);
          return { a, x, H, total: num(x.total_cargos) };
        });
      } catch (e) { return falta(ctx, e); }
      pintar();
    }
    function pintar() {
      const conH = R.filter((r) => r.H.length);
      cfg = { titulo: 'Auditoría de cuenta médica', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Auditoría', archivo: `auditoria_cuentas_${hoy()}`, parametros: [`Empresa: ${S().empresaDe(ctx)}`, `Al ${fmt.fechaDia(hoy())}`, `${R.length} cuentas revisadas`],
        columnas: [col('Admisión', 'texto', 30), col('Estado', 'texto', 11), col('Total cuenta', 'monto', 13), col('Hallazgo', 'texto', 34), col('Casos', 'numero', 7), col('Detalle', 'texto', 40)],
        filas: R.flatMap((r) => (r.H.length ? r.H.map((h, i) => ({ valores: [i ? '' : S().nomAdm(B, r.a.id), i ? '' : `¤${r.a.estado}`, i ? '' : r2(r.total), h[0], h[1], h[2]], resaltar: true, attr: `data-a="${r.a.id}" style="cursor:pointer"` }))
          : [{ valores: [S().nomAdm(B, r.a.id), `¤${r.a.estado}`, r2(r.total), 'Sin hallazgos', 0, ''], attr: `data-a="${r.a.id}"` }])), firmas: ['Auditor de cuentas médicas', 'Jefe de facturación'] };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Cuentas revisadas', R.length)}${kpi('Con hallazgos', conH.length, conH.length ? 'ec-alerta' : 'ec-fin')}${kpi('Hallazgos', sum(R.map((r) => r.H.length)))}${kpi('Monto en cuentas con hallazgos', q(sum(conH.map((r) => r.total))))}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Revisa las cuentas abiertas, egresadas y facturadas de los últimos 60 días antes de facturar: cargos sin precio o duplicados, días-cama sin cargar, medicamentos sin orden o sin registro de administración, honorarios sin médico, carta de garantía excedida o faltante, egresos sin epicrisis y partes sin facturar. Toca una cuenta para abrir su detalle.</p>${tabla(cfg)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') cargar(); });
    cont.addEventListener('click', (e) => { const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp); if (e.target.closest('[data-accion="actualizar"]')) return cargar(); const t = e.target.closest('tr[data-a]'); if (t) { sel = t.dataset.a; location.hash = '#/hospital/hos-kits-paquetes'; } void sel; });
    iniciar();
  };

  // ===================== Facturación de cuentas =====================
  window.PANTALLAS['med-facturacion'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Facturación de cuentas', icono: 'ti-file-invoice', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Procesos' });
    const { sb } = ctx;
    const f = { origen: location.hash.includes('/clinicas/') ? 'CLÍNICA' : 'HOSPITAL', estado: 'PENDIENTES' }; let B = null, filas = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-file-invoice'); return; }
      encabezado(ctx, `<label class="campo"><span>Origen</span><select name="origen">${['HOSPITAL', 'CLÍNICA'].map((x) => `<option ${f.origen === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label class="campo"><span>Mostrar</span><select name="estado"><option value="PENDIENTES" ${f.estado === 'PENDIENTES' ? 'selected' : ''}>Por facturar</option><option value="TODAS" ${f.estado === 'TODAS' ? 'selected' : ''}>Todas</option></select></label>`);
      try {
        B = await S().base(ctx);
        if (f.origen === 'HOSPITAL') { const { data, error } = await sb.from('hos_admisiones').select('id, numero, paciente_id, aseguradora_id, estado, fecha_egreso, total_cargos, parte_paciente, parte_aseguradora, factura_paciente_id, factura_aseguradora_id').eq('localidad_id', ctx.sel.loc).in('estado', ['EGRESADA', 'FACTURADA']).order('numero', { ascending: false }).limit(300); if (error) throw error; filas = data || []; }
        else { const { data, error } = await sb.from('cli_cobros').select('id, numero, fecha, paciente_id, aseguradora_id, total, parte_paciente, parte_aseguradora, factura_id, nit, nombre_factura').eq('localidad_id', ctx.sel.loc).eq('estado', 'PAGADO').eq('tipo', 'SERVICIOS').gte('fecha', S().sumarDias(hoy(), -90)).order('numero', { ascending: false }).limit(500); if (error) throw error; filas = data || []; }
      } catch (e) { return falta(ctx, e); }
      pintar();
    }
    function pintar() {
      const hos = f.origen === 'HOSPITAL';
      const pend = (r) => (hos ? (num(r.parte_paciente) > 0 && !r.factura_paciente_id) || (num(r.parte_aseguradora) > 0 && !r.factura_aseguradora_id) : num(r.parte_paciente) > 0 && !r.factura_id);
      const vs = filas.filter((r) => f.estado === 'TODAS' || pend(r));
      const btnF = (id, dest, fac) => (fac ? `<a class="boton secundario-sm" href="#/facturacion/facturas-ventas/${fac}"><i class="ti ti-file-invoice" aria-hidden="true"></i> Ver</a>` : ctx.admin ? `<button type="button" class="boton primario-sm" data-fac="${id}" data-dest="${dest}">Facturar</button>` : '');
      cfg = { titulo: `Facturación de cuentas · ${hos ? 'Hospital' : 'Clínica'}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Facturación', archivo: 'facturacion_cuentas', parametros: [`Empresa: ${S().empresaDe(ctx)}`, f.estado === 'TODAS' ? 'Todas' : 'Por facturar'],
        columnas: [col(hos ? 'Admisión' : 'Cobro', 'texto', 8), col('Fecha', 'texto', 10), col('Paciente', 'texto', 28), col('Aseguradora', 'texto', 18), col('Total', 'monto', 13), col('Paciente Q', 'monto', 13), col('Factura paciente', 'texto', 12), col('Aseguradora Q', 'monto', 13), col('Factura aseguradora', 'texto', 12)], acciones: false,
        filas: vs.map((r) => ({ valores: [String(r.numero), fmt.fechaDia(String(hos ? r.fecha_egreso : r.fecha).slice(0, 10)), S().nomPac(B, r.paciente_id), r.aseguradora_id ? S().nom(B.aseguradoras, r.aseguradora_id) : 'Particular', r2(hos ? r.total_cargos : r.total), r2(r.parte_paciente), hos ? (r.factura_paciente_id ? 'Facturada' : num(r.parte_paciente) ? 'Pendiente' : '') : (r.factura_id ? 'Facturada' : 'Pendiente'), r2(r.parte_aseguradora), hos ? (r.factura_aseguradora_id ? 'Facturada' : num(r.parte_aseguradora) ? 'Pendiente' : '') : (num(r.parte_aseguradora) ? 'Va en el reclamo' : '')], r })) };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Por facturar', filas.filter(pend).length, filas.some(pend) ? 'ec-alerta' : 'ec-fin')}${kpi('Pacientes por facturar', q(sum(filas.filter((r) => num(r.parte_paciente) > 0 && !(hos ? r.factura_paciente_id : r.factura_id)).map((r) => r.parte_paciente))))}${hos ? kpi('Aseguradoras por facturar', q(sum(filas.filter((r) => num(r.parte_aseguradora) > 0 && !r.factura_aseguradora_id).map((r) => r.parte_aseguradora)))) : ''}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Crea la factura en Facturación/Ventas con el detalle de la cuenta en la proporción de cada destinatario: la del paciente al contado y la de la aseguradora al crédito (queda en sus cuentas por cobrar). La factura queda lista para certificar el DTE en Facturas Ventas. ${hos ? 'Solo se facturan cuentas egresadas.' : 'En la clínica la parte de la aseguradora se cobra con el reclamo.'}</p>
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${cfg.columnas.map((c) => `<th class="${c.tipo === 'texto' ? '' : 'num'}">${esc(c.titulo)}</th>`).join('')}</tr></thead><tbody>
        ${cfg.filas.map(({ valores, r }) => `<tr>${valores.slice(0, 6).map((v, i) => S().celda(v, cfg.columnas[i])).join('')}<td>${num(r.parte_paciente) > 0 ? btnF(r.id, 'PACIENTE', hos ? r.factura_paciente_id : r.factura_id) : ''}</td>${S().celda(valores[7], cfg.columnas[7])}<td>${hos && num(r.parte_aseguradora) > 0 ? btnF(r.id, 'ASEGURADORA', r.factura_aseguradora_id) : esc(valores[8])}</td></tr>`).join('') || '<tr><td colspan="9" class="tk-vacio">No hay cuentas por facturar.</td></tr>'}</tbody></table></div></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); if (['origen', 'estado'].includes(e.target.name)) { f[e.target.name] = e.target.value; cargar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar({ ...cfg, filas: cfg.filas.map(({ valores }) => ({ valores })) }, ex.dataset.exp);
      const b = e.target.closest('[data-fac]'); if (!b) return;
      const dest = b.dataset.dest; const nit = prompt(`NIT para la factura ${dest === 'PACIENTE' ? 'del paciente' : 'de la aseguradora'} (vacío = el registrado o CF):`, ''); if (nit === null) return;
      const { data, error } = await sb.rpc('med_facturar', { p_origen: f.origen, p_id: Number(b.dataset.fac), p_destino: dest, p_nit: nit.trim() || null, p_nombre: null });
      if (error) return window.FIN.aviso(errorTxt(error));
      window.FIN.aviso(`Factura interna ${data.numero} por Q ${fmt.monto(data.total)} creada: certifica el DTE en Facturas Ventas`); cargar();
    });
    iniciar();
  };

  // ===================== Preautorizaciones y glosas =====================
  window.PANTALLAS['med-glosas'] = (cont) => S().registro(cont, { titulo: 'Preautorizaciones y glosas', nombre: 'Glosa', icono: 'ti-file-alert', grupo: 'Aseguradoras', tabla: 'med_glosas', fecha: 'fecha', fechaTipo: 'fecha', orden: 'fecha', numerado: true, dias: 180,
    ayuda: 'Glosas: montos que la aseguradora no reconoce de un reclamo, con su motivo. Se apelan con argumento y soporte y se registra lo recuperado; lo no recuperable se cobra al paciente o se acepta como pérdida. Arriba, las preautorizaciones pendientes o por vencer.',
    panel: async (ctx) => { const { data } = await ctx.sb.from('med_garantias').select('numero, paciente_id, aseguradora_id, procedimiento, fecha_solicitud, vence, estado, monto_solicitado').eq('localidad_id', ctx.sel.loc).in('estado', ['SOLICITADA', 'AUTORIZADA', 'PARCIAL']).order('fecha_solicitud'); const B = await S().base(ctx); const xs = (data || []).filter((g) => g.estado === 'SOLICITADA' || (g.vence && g.vence <= S().sumarDias(hoy(), 7)));
      return xs.length ? `<h3 class="pr-sub"><i class="ti ti-shield-check" aria-hidden="true"></i> Preautorizaciones por atender (${xs.length})</h3>${tabla({ columnas: [col('No.', 'texto'), col('Paciente', 'texto'), col('Aseguradora', 'texto'), col('Procedimiento', 'texto'), col('Solicitada', 'texto'), col('Días', 'numero'), col('Vence', 'texto'), col('Estado', 'texto')], filas: xs.map((g) => ({ valores: [String(g.numero), S().nomPac(B, g.paciente_id), S().nom(B.aseguradoras, g.aseguradora_id), g.procedimiento || '', fmt.fechaDia(g.fecha_solicitud), dias(g.fecha_solicitud), g.vence ? fmt.fechaDia(g.vence) : '', `¤${g.estado}`], resaltar: g.estado === 'SOLICITADA' && dias(g.fecha_solicitud) > 3 })) })}<p class="pr-guia"><a href="#/hospital/med-garantias">Abrir Cartas de garantía</a></p>` : ''; },
    campos: [{ k: 'origen', t: 'Origen', tipo: 'sel', op: ['HOSPITAL', 'CLÍNICA'], vacio: false }, { k: 'aseguradora_id', t: 'Aseguradora', tipo: 'sel', op: (B) => B.aseguradoras.map((a) => [a.id, a.nombre]), req: true }, { k: 'reclamo_id', t: 'No. de reclamo (id)', tipo: 'numero' }, { k: 'paciente_id', t: 'Paciente', tipo: 'paciente' },
      { k: 'fecha', t: 'Fecha de la glosa', tipo: 'fecha' }, { k: 'concepto', t: 'Concepto glosado', req: true, ancho: 1 }, { k: 'motivo', t: 'Motivo', tipo: 'sel', op: ['NO CUBIERTO POR LA PÓLIZA', 'SIN PREAUTORIZACIÓN', 'TARIFA EXCEDIDA', 'FALTA DE SOPORTE', 'CARGO DUPLICADO', 'NO PERTINENTE', 'EXCLUSIÓN', 'OTRO'], vacio: false, ancho: 1 },
      { k: 'monto', t: 'Monto glosado Q', tipo: 'numero', req: true }, { k: 'estado', t: 'Estado', tipo: 'sel', op: ['RECIBIDA', 'APELADA', 'ACEPTADA', 'RECUPERADA', 'COBRADA AL PACIENTE'], vacio: false }, { k: 'fecha_apelacion', t: 'Fecha de apelación', tipo: 'fecha' }, { k: 'argumento', t: 'Argumento de la apelación', tipo: 'area', filas: 3 }, { k: 'monto_recuperado', t: 'Monto recuperado Q', tipo: 'numero' }],
    nuevo: () => ({ origen: location.hash.includes('/clinicas/') ? 'CLÍNICA' : 'HOSPITAL', fecha: hoy(), estado: 'RECIBIDA', motivo: 'NO CUBIERTO POR LA PÓLIZA', monto_recuperado: 0 }),
    columnas: [{ t: 'No.', v: (r) => String(r.numero), ancho: 6 }, { t: 'Fecha', v: (r) => fmt.fechaDia(r.fecha), ancho: 10 }, { t: 'Aseguradora', v: (r, B) => S().nom(B.aseguradoras, r.aseguradora_id), ancho: 20 }, { t: 'Paciente', v: (r, B) => S().nomPac(B, r.paciente_id), ancho: 24 }, { t: 'Concepto', v: (r) => r.concepto, ancho: 26 }, { t: 'Motivo', v: (r) => r.motivo, ancho: 20 },
      { t: 'Glosado Q', v: (r) => r2(r.monto), tipo: 'monto', ancho: 12 }, { t: 'Recuperado Q', v: (r) => r2(r.monto_recuperado), tipo: 'monto', ancho: 12 }, { t: 'Estado', v: (r) => `¤${r.estado}`, ancho: 12 }],
    resaltar: (r) => r.estado === 'RECIBIDA' && dias(r.fecha) > 15,
    kpis: (xs) => [['Glosas', xs.length], ['Monto glosado', q(sum(xs.map((r) => r.monto))), 'ec-alerta'], ['Recuperado', q(sum(xs.map((r) => r.monto_recuperado))), 'ec-fin'], ['% de recuperación', sum(xs.map((r) => r.monto)) ? `${((sum(xs.map((r) => r.monto_recuperado)) / sum(xs.map((r) => r.monto))) * 100).toFixed(1)} %` : '—']] });

  // ===================== Cuentas incobrables =====================
  window.PANTALLAS['med-incobrables'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Cuentas incobrables', icono: 'ti-cash-off', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Aseguradoras y cartera' });
    const { sb } = ctx;
    const f = { minimo: 90 }; let B = null, cands = [], regs = [], K = null, cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-cash-off'); return; }
      encabezado(ctx, `<label class="campo"><span>Antigüedad mínima (días)</span><input type="number" name="minimo" value="${f.minimo}" min="0"></label>`);
      try {
        B = await S().base(ctx); K = window.CONTA ? await window.CONTA.cuentasClave(ctx) : null;
        const loc = ctx.sel.loc;
        const [ad, hr, cr, reg] = await Promise.all([sb.from('hos_admisiones').select('id, numero, paciente_id, fecha_egreso, parte_paciente, total_pagos').eq('localidad_id', loc).in('estado', ['EGRESADA', 'FACTURADA']),
          sb.from('hos_reclamos').select('id, numero, aseguradora_id, fecha, monto, monto_aprobado, monto_pagado, estado').eq('localidad_id', loc).not('estado', 'in', '("PAGADO","RECHAZADO")'),
          sb.from('cli_reclamos').select('id, numero, aseguradora_id, fecha, monto, monto_aprobado, monto_pagado, glosa, estado').eq('localidad_id', loc).not('estado', 'in', '("PAGADO","RECHAZADO")'),
          sb.from('med_incobrables').select('*').eq('localidad_id', loc).order('numero', { ascending: false })]);
        if (reg.error) throw reg.error; regs = reg.data || [];
        const ya = (o, id) => regs.filter((x) => x.origen === o && x.referencia_id === id);
        cands = [
          ...(ad.data || []).map((a) => ({ origen: 'CUENTA HOSPITALARIA', id: a.id, doc: `Admisión ${a.numero}`, deudor: S().nomPac(B, a.paciente_id), fecha: String(a.fecha_egreso || '').slice(0, 10), saldo: r2(num(a.parte_paciente) - num(a.total_pagos)) })),
          ...(hr.data || []).map((r) => ({ origen: 'RECLAMO HOSPITAL', id: r.id, doc: `Reclamo ${r.numero}`, deudor: S().nom(B.aseguradoras, r.aseguradora_id), fecha: r.fecha, saldo: r2(num(r.monto_aprobado ?? r.monto) - num(r.monto_pagado)) })),
          ...(cr.data || []).map((r) => ({ origen: 'RECLAMO CLÍNICA', id: r.id, doc: `Reclamo ${r.numero}`, deudor: S().nom(B.aseguradoras, r.aseguradora_id), fecha: r.fecha, saldo: r2(num(r.monto_aprobado ?? r.monto) - num(r.monto_pagado)) }))
        ].map((c) => { const p = ya(c.origen, c.id); return { ...c, dias: c.fecha ? dias(c.fecha) : 0, estimado: sum(p.filter((x) => x.tipo === 'ESTIMACIÓN').map((x) => x.saldo)), castigado: sum(p.filter((x) => x.tipo === 'CASTIGO').map((x) => x.saldo)) }; })
          .filter((c) => c.saldo > 0.004 && c.dias >= f.minimo && c.castigado < c.saldo).sort((a, b) => b.dias - a.dias);
      } catch (e) { return falta(ctx, e); }
      pintar();
    }
    function pintar() {
      const ok = K && K.cuenta('ESTIMACION_INCOBRABLES') && K.cuenta('GASTO_INCOBRABLES');
      cfg = { titulo: 'Cuentas incobrables', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Incobrables', archivo: 'cuentas_incobrables', parametros: [`Empresa: ${S().empresaDe(ctx)}`, `Saldos con ${f.minimo} días o más`],
        columnas: [col('Origen', 'texto', 18), col('Documento', 'texto', 14), col('Deudor', 'texto', 28), col('Fecha', 'texto', 10), col('Días', 'numero', 7), col('Saldo Q', 'monto', 13), col('Estimado Q', 'monto', 12), col('Castigado Q', 'monto', 12)], acciones: ctx.admin,
        filas: cands.map((c, i) => ({ valores: [c.origen, c.doc, c.deudor, c.fecha ? fmt.fechaDia(c.fecha) : '', c.dias, c.saldo, r2(c.estimado), r2(c.castigado)], resaltar: c.dias > 180, acciones: ok ? `<button type="button" class="boton secundario-sm" data-inc="${i}" data-tipo="ESTIMACIÓN">Estimar</button> <button type="button" class="boton secundario-sm rp-peligro" data-inc="${i}" data-tipo="CASTIGO">Castigar</button>` : '' })), vacio: 'No hay saldos con esa antigüedad.' };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Saldos vencidos', cands.length)}${kpi('Monto', q(sum(cands.map((c) => c.saldo))), 'ec-alerta')}${kpi('Más de 180 días', q(sum(cands.filter((c) => c.dias > 180).map((c) => c.saldo))))}${kpi('Estimación registrada', q(sum(regs.filter((r) => r.tipo === 'ESTIMACIÓN').map((r) => r.saldo))))}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Saldos de pacientes y aseguradoras con la antigüedad indicada. «Estimar» registra la estimación para cuentas incobrables (partida PEV: gasto contra estimación); «Castigar» da de baja el saldo contra la estimación (partida PAJ). ${ok ? '' : '<b class="pc-rojo">Configura las cuentas ESTIMACION_INCOBRABLES y GASTO_INCOBRABLES (y CXC / ASEGURADORAS_CXC) en Contabilidad › Cuentas de integración.</b>'}</p>${tabla(cfg)}
        <h3 class="pr-sub"><i class="ti ti-history" aria-hidden="true"></i> Registradas</h3>${tabla({ columnas: [col('No.', 'texto'), col('Fecha', 'texto'), col('Tipo', 'texto'), col('Origen', 'texto'), col('Deudor', 'texto'), col('Saldo Q', 'monto'), col('Motivo', 'texto'), col('Partida', 'texto')], filas: regs.map((r) => ({ valores: [String(r.numero), fmt.fechaDia(r.fecha), r.tipo, r.origen, r.deudor, r2(r.saldo), r.motivo || '', r.partida_id ? `No. ${r.partida_id}` : ''] })), vacio: 'Sin registros.' })}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); if (e.target.name === 'minimo') { f.minimo = Number(e.target.value) || 0; cargar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp);
      const b = e.target.closest('[data-inc]'); if (!b) return;
      const c = cands[Number(b.dataset.inc)], tipo = b.dataset.tipo;
      const monto = Number(prompt(`Monto a ${tipo === 'CASTIGO' ? 'castigar' : 'estimar'} (Q):`, String(tipo === 'CASTIGO' ? r2(c.saldo - c.castigado) : r2(c.saldo - c.estimado)))); if (!monto || monto <= 0) return;
      const motivo = prompt('Motivo:', tipo === 'CASTIGO' ? 'Agotadas las gestiones de cobro' : 'Saldo con más de 90 días'); if (motivo === null) return;
      const est = K.cuenta('ESTIMACION_INCOBRABLES'), gas = K.cuenta('GASTO_INCOBRABLES'), cxc = c.origen === 'CUENTA HOSPITALARIA' ? K.cuenta('CXC') : K.cuenta('ASEGURADORAS_CXC') || K.cuenta('CXC');
      if (tipo === 'CASTIGO' && !cxc) return window.FIN.aviso('Configura la cuenta CXC / ASEGURADORAS_CXC');
      const lineas = tipo === 'ESTIMACIÓN' ? [{ cuenta: gas, concepto: `Estimación incobrable ${c.doc} ${c.deudor}`, debe: monto, haber: 0 }, { cuenta: est, concepto: `Estimación incobrable ${c.doc} ${c.deudor}`, debe: 0, haber: monto }]
        : [{ cuenta: est, concepto: `Castigo ${c.doc} ${c.deudor}`, debe: monto, haber: 0 }, { cuenta: cxc, concepto: `Castigo ${c.doc} ${c.deudor}`, debe: 0, haber: monto }];
      const h = hoy();
      const { data: p, error } = await sb.rpc('con_generar_partida', { p_loc: ctx.sel.loc, p_anio: Number(h.slice(0, 4)), p_mes: Number(h.slice(5, 7)), p_tipo: tipo === 'ESTIMACIÓN' ? 'PEV' : 'PAJ', p_descripcion: `${tipo === 'ESTIMACIÓN' ? 'Estimación para cuentas incobrables' : 'Castigo de cuenta incobrable'}: ${c.doc} ${c.deudor}`, p_lineas: lineas });
      if (error) return window.FIN.aviso(errorTxt(error));
      const r = await sb.from('med_incobrables').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, numero: 0, origen: c.origen, referencia_id: c.id, deudor: c.deudor, saldo: monto, dias: c.dias, tipo, motivo: motivo.trim() || null, partida_id: p.id });
      if (r.error) return window.FIN.aviso(errorTxt(r.error));
      window.FIN.aviso(`${tipo === 'ESTIMACIÓN' ? 'Estimación' : 'Castigo'} registrado con la partida ${tipo === 'ESTIMACIÓN' ? 'PEV' : 'PAJ'}-${p.numero}`); cargar();
    });
    iniciar();
  };

  // ===================== Botiquines de piso =====================
  window.PANTALLAS['far-botiquines'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Botiquines de piso', icono: 'ti-first-aid-kit', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Hospital · Procesos' });
    const { sb } = ctx;
    const f = { desde: S().sumarDias(hoy(), -7), hasta: hoy(), cobertura: 3 }; let cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-first-aid-kit'); return; }
      encabezado(ctx, `<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}"></label><label class="campo"><span>Días de cobertura</span><input type="number" name="cobertura" value="${f.cobertura}" min="1"></label>`);
      try {
        const loc = ctx.sel.loc;
        const [cg, ar, ca, fo] = await Promise.all([S().leerTodo(() => sb.from('hos_cargos').select('producto_id, descripcion, cantidad, precio, fecha, hos_admisiones!inner(localidad_id, cama_id)').eq('hos_admisiones.localidad_id', loc).eq('origen', 'FARMACIA').gte('fecha', f.desde).lte('fecha', f.hasta).order('id')),
          sb.from('hos_areas').select('id, nombre').eq('localidad_id', loc), sb.from('hos_camas').select('id, area_id').eq('localidad_id', loc), sb.from('far_formulario').select('producto_id, stock_minimo, controlado').eq('localidad_id', loc)]);
        const area = (camaId) => (ar.data || []).find((a) => a.id === (ca.data || []).find((c) => c.id === camaId)?.area_id)?.nombre || 'SIN CAMA ASIGNADA';
        const nDias = Math.max(1, Math.round((new Date(`${f.hasta}T12:00:00`) - new Date(`${f.desde}T12:00:00`)) / 864e5) + 1);
        const m = new Map(); cg.forEach((c) => { const k = `${area(c.hos_admisiones.cama_id)}|${c.producto_id}`; const a = m.get(k) || { area: area(c.hos_admisiones.cama_id), prod: c.producto_id, desc: String(c.descripcion).replace(/^DEVOLUCIÓN: /, ''), q: 0 }; a.q += num(c.cantidad) * (num(c.precio) < 0 ? -1 : 1); m.set(k, a); });
        const xs = [...m.values()].filter((x) => x.q > 0).sort((a, b) => a.area.localeCompare(b.area) || b.q - a.q);
        const filas = []; let ar0 = null;
        xs.forEach((x) => { if (x.area !== ar0) { filas.push({ valores: [x.area], tipo: 'grupo' }); ar0 = x.area; } const fm = (fo.data || []).find((y) => y.producto_id === x.prod); const diario = x.q / nDias; filas.push({ valores: [x.desc, r2(x.q), r2(diario), Math.max(Math.ceil(diario * f.cobertura), num(fm?.stock_minimo)), fm?.controlado ? 'Sí' : ''], resaltar: !!fm?.controlado }); });
        cfg = { titulo: 'Reposición de botiquines de piso', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Botiquines', archivo: `botiquines_${f.hasta}`, parametros: [`Empresa: ${S().empresaDe(ctx)}`, `Consumo del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, `Cobertura ${f.cobertura} días`],
          columnas: [col('Medicamento / insumo', 'texto', 46), col('Consumo', 'numero', 10), col('Promedio diario', 'numero', 10), col('Reponer', 'numero', 10), col('Controlado', 'texto', 9)], filas, vacio: 'Sin despachos de farmacia en el período.', firmas: ['Jefe de enfermería', 'Farmacia'] };
        ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Productos', xs.length)}${kpi('Áreas', new Set(xs.map((x) => x.area)).size)}${kpi('Controlados', xs.filter((x) => (fo.data || []).some((y) => y.producto_id === x.prod && y.controlado)).length, 'ec-alerta')}</div>
          <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Consumo neto (despachos menos devoluciones) de cada área en el período y la cantidad a reponer para los días de cobertura (o el stock mínimo del formulario terapéutico, el que sea mayor). Imprime la lista para que farmacia prepare el traslado a cada piso.</p>${tabla(cfg)}</div>`;
        window.CUENTAS_XLSX.ajustarAlto(cont);
      } catch (e) { falta(ctx, e); }
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); if (['desde', 'hasta', 'cobertura'].includes(e.target.name)) { f[e.target.name] = e.target.name === 'cobertura' ? Number(e.target.value) || 1 : e.target.value; cargar(); } });
    cont.addEventListener('click', (e) => { const ex = e.target.closest('[data-exp]'); if (ex) exportar(cfg, ex.dataset.exp); });
    iniciar();
  };

  // ===================== Libro de medicamentos controlados =====================
  window.PANTALLAS['far-controlados'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Libro de medicamentos controlados', icono: 'ti-lock-square', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Hospital · Procesos' });
    const { sb } = ctx;
    const f = { desde: `${hoy().slice(0, 8)}01`, hasta: hoy(), folio: 1 }; let cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-lock-square'); return; }
      encabezado(ctx, `<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}"></label><label class="campo"><span>Folio inicial</span><input type="number" name="folio" value="${f.folio}" min="1"></label>`);
      try {
        const loc = ctx.sel.loc, B = await S().base(ctx);
        const { data: fo, error } = await sb.from('far_formulario').select('producto_id, nombre, clase_control').eq('localidad_id', loc).eq('controlado', true); if (error) throw error;
        const ids = (fo || []).map((x) => x.producto_id).filter(Boolean);
        const movs = ids.length ? await S().leerTodo(() => sb.from('inventario_movimientos').select('id, producto_id, fecha, cantidad, origen, documento_fisico, observaciones, lote').eq('localidad_id', loc).in('producto_id', ids).lte('fecha', f.hasta).order('fecha').order('id')) : [];
        const cg = ids.length ? await S().leerTodo(() => sb.from('hos_cargos').select('movimiento_id, admision_id, medico_id').in('producto_id', ids).not('movimiento_id', 'is', null).order('id')) : [];
        const filas = []; let nP = 0;
        (fo || []).filter((x) => x.producto_id).forEach((p) => {
          const ms = movs.filter((m) => m.producto_id === p.producto_id); const ini = sum(ms.filter((m) => m.fecha < f.desde).map((m) => m.cantidad)); const per = ms.filter((m) => m.fecha >= f.desde);
          if (!per.length && !ini) return; nP++;
          filas.push({ valores: [`${p.nombre} · ${p.clase_control || 'CONTROLADO'}`], tipo: 'grupo' });
          filas.push({ valores: [fmt.fechaDia(f.desde), 'SALDO INICIAL', '', '', '', '', r2(ini)] });
          let s = ini;
          per.forEach((m) => { s += num(m.cantidad); const c = cg.find((x) => x.movimiento_id === m.id); const ad = c ? B.admisiones.find((a) => a.id === c.admision_id) : null; filas.push({ valores: [fmt.fechaDia(m.fecha), `${m.origen} ${m.documento_fisico || ''}`.trim(), ad ? S().nomPac(B, ad.paciente_id) : (m.observaciones || ''), c ? S().nomMed(B, c.medico_id) : '', num(m.cantidad) > 0 ? r2(m.cantidad) : '', num(m.cantidad) < 0 ? r2(-m.cantidad) : '', r2(s)] }); });
          filas.push({ valores: ['', 'SALDO FINAL', '', '', r2(sum(per.filter((m) => m.cantidad > 0).map((m) => m.cantidad))), r2(-sum(per.filter((m) => m.cantidad < 0).map((m) => m.cantidad))), r2(s)], tipo: 'subtotal' });
        });
        cfg = { titulo: 'Libro de control de medicamentos controlados', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Controlados', archivo: `controlados_${f.hasta}`, parametros: [`Empresa: ${S().empresaDe(ctx)}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, `Folio inicial ${f.folio}`],
          columnas: [col('Fecha', 'texto', 10), col('Documento', 'texto', 18), col('Paciente / detalle', 'texto', 30), col('Médico que prescribe', 'texto', 22), col('Entradas', 'numero', 9), col('Salidas', 'numero', 9), col('Existencia', 'numero', 10)], filas, firmas: ['Químico farmacéutico regente', 'Director médico'],
          vacio: (fo || []).length ? 'Sin movimientos de controlados en el período.' : 'Marca los medicamentos controlados (con su producto) en Catálogos › Formulario, dietas, salas y personal.' };
        ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Controlados en el formulario', (fo || []).length)}${kpi('Con movimiento', nP)}</div>
          <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Entradas, salidas y existencia de cada psicotrópico, estupefaciente o precursor con el paciente y el médico que lo prescribió. Imprime en PDF con folio para el libro de control que exige el Departamento de Regulación y Control de Productos Farmacéuticos del MSPAS.</p>${tabla(cfg)}</div>`;
        window.CUENTAS_XLSX.ajustarAlto(cont);
      } catch (e) { falta(ctx, e); }
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); if (['desde', 'hasta', 'folio'].includes(e.target.name)) { f[e.target.name] = e.target.name === 'folio' ? Number(e.target.value) || 1 : e.target.value; cargar(); } });
    cont.addEventListener('click', (e) => { const ex = e.target.closest('[data-exp]'); if (ex) exportar(cfg, ex.dataset.exp); });
    iniciar();
  };

  // ===================== Esterilización (CEYE) =====================
  window.PANTALLAS['ceye-paquetes'] = (cont) => S().catalogo(cont, { titulo: 'Paquetes de esterilización', icono: 'ti-box-seam', grupo: 'Hospital · Catálogos', secciones: [
    { titulo: 'Paquetes', tabla: 'ceye_paquetes', orden: 'codigo', leer: async (ctx) => { await ctx.sb.rpc('ceye_asegurar', { p_localidad: ctx.sel.loc }); const { data, error } = await ctx.sb.from('ceye_paquetes').select('*').eq('localidad_id', ctx.sel.loc).order('codigo'); if (error) throw error; return data || []; },
      ayuda: 'Paquetes que se esterilizan en la CEYE con su contenido, método y vigencia de esterilidad.', campos: [{ k: 'codigo', titulo: 'No.', tipo: 'numero', ancho: 6 }, { k: 'nombre', titulo: 'Paquete', ancho: 28 }, { k: 'contenido', titulo: 'Contenido', ancho: 34, mayus: false }, { k: 'metodo', titulo: 'Método', opciones: ['VAPOR', 'ÓXIDO DE ETILENO', 'PLASMA', 'CALOR SECO'] }, { k: 'vigencia_dias', titulo: 'Vigencia (días)', tipo: 'numero' }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
      nuevo: (f) => ({ codigo: Math.max(0, ...f.map((x) => x.codigo)) + 1, nombre: 'NUEVO PAQUETE' }) }] });
  window.PANTALLAS['ceye-esterilizacion'] = (cont) => S().registro(cont, { titulo: 'Esterilización (CEYE)', nombre: 'Ciclo de esterilización', icono: 'ti-temperature', grupo: 'Hospital · Procesos', tabla: 'ceye_ciclos', fecha: 'fecha', orden: 'fecha', numerado: true, dias: 30,
    ayuda: 'Cada ciclo del autoclave con sus parámetros e indicadores químico y biológico; los paquetes del ciclo quedan con lote y fecha de vencimiento. Un ciclo con indicador biológico positivo se rechaza y sus paquetes se reprocesan.',
    panel: async (ctx) => { const { data } = await ctx.sb.from('ceye_ciclo_items').select('cantidad, vence, lote, ceye_paquetes(nombre), ceye_ciclos!inner(localidad_id, estado, numero)').eq('ceye_ciclos.localidad_id', ctx.sel.loc).eq('ceye_ciclos.estado', 'LIBERADO').gte('vence', hoy()).lte('vence', S().sumarDias(hoy(), 7)); const xs = data || [];
      return `<p class="pr-guia"><a href="#/hospital/ceye-paquetes"><i class="ti ti-box-seam" aria-hidden="true"></i> Catálogo de paquetes de esterilización</a></p>${xs.length ? `<h3 class="pr-sub">Paquetes que vencen en 7 días (${xs.length})</h3>${tabla({ columnas: [col('Paquete', 'texto'), col('Ciclo', 'texto'), col('Lote', 'texto'), col('Cantidad', 'numero'), col('Vence', 'texto')], filas: xs.map((x) => ({ valores: [x.ceye_paquetes?.nombre || '', String(x.ceye_ciclos.numero), x.lote || '', x.cantidad, fmt.fechaDia(x.vence)], resaltar: true })) })}` : ''}`; },
    campos: [{ k: 'fecha', t: 'Fecha y hora', tipo: 'fechahora' }, { k: 'equipo', t: 'Equipo' }, { k: 'metodo', t: 'Método', tipo: 'sel', op: ['VAPOR', 'ÓXIDO DE ETILENO', 'PLASMA', 'CALOR SECO'], vacio: false }, { k: 'temperatura', t: 'Temperatura °C', tipo: 'numero' }, { k: 'presion', t: 'Presión' }, { k: 'minutos', t: 'Minutos', tipo: 'numero' },
      { k: 'indicador_quimico', t: 'Indicador químico', tipo: 'sel', op: ['VIRÓ', 'NO VIRÓ'] }, { k: 'indicador_biologico', t: 'Indicador biológico', tipo: 'sel', op: ['PENDIENTE', 'NEGATIVO', 'POSITIVO'] }, { k: 'operador', t: 'Operador' }, { k: 'estado', t: 'Estado', tipo: 'sel', op: ['EN PROCESO', 'LIBERADO', 'RECHAZADO'], vacio: false }, { k: 'observaciones', t: 'Observaciones', tipo: 'area', filas: 2 }],
    cargarExtra: async (ctx, B) => { await ctx.sb.rpc('ceye_asegurar', { p_localidad: ctx.sel.loc }); const { data } = await ctx.sb.from('ceye_paquetes').select('*').eq('localidad_id', ctx.sel.loc).order('codigo'); B.ceye = data || []; },
    nuevo: () => ({ fecha: new Date().toISOString(), equipo: 'AUTOCLAVE 1', metodo: 'VAPOR', temperatura: 134, minutos: 18, indicador_biologico: 'PENDIENTE', estado: 'EN PROCESO' }),
    antes: (r) => (r.estado === 'LIBERADO' && (r.indicador_quimico !== 'VIRÓ' || r.indicador_biologico === 'POSITIVO') ? 'Solo se libera un ciclo con indicador químico que viró y biológico negativo o pendiente' : r.indicador_biologico === 'POSITIVO' && r.estado !== 'RECHAZADO' ? 'Con indicador biológico positivo el ciclo debe quedar rechazado' : null),
    columnas: [{ t: 'No.', v: (r) => String(r.numero), ancho: 6 }, { t: 'Fecha', v: (r) => S().fhGt(r.fecha), ancho: 15 }, { t: 'Equipo', v: (r) => r.equipo, ancho: 14 }, { t: 'Método', v: (r) => r.metodo, ancho: 12 }, { t: 'T °C', v: (r) => r.temperatura ?? '', tipo: 'numero', ancho: 6 }, { t: 'Min.', v: (r) => r.minutos ?? '', tipo: 'numero', ancho: 6 }, { t: 'Químico', v: (r) => r.indicador_quimico || '', ancho: 8 }, { t: 'Biológico', v: (r) => r.indicador_biologico || '', ancho: 9 }, { t: 'Estado', v: (r) => `¤${r.estado === 'LIBERADO' ? 'AUTORIZADA' : r.estado === 'RECHAZADO' ? 'RECHAZADA' : 'EN CURSO'}`, ancho: 11 }],
    resaltar: (r) => r.indicador_biologico === 'POSITIVO',
    kpis: (xs) => [['Ciclos', xs.length], ['Liberados', xs.filter((r) => r.estado === 'LIBERADO').length, 'ec-fin'], ['Rechazados', xs.filter((r) => r.estado === 'RECHAZADO').length, 'ec-alerta'], ['Biológico pendiente', xs.filter((r) => r.indicador_biologico === 'PENDIENTE').length]],
    detalle: { titulo: 'Paquetes del ciclo', tabla: 'ceye_ciclo_items', fk: 'ciclo_id',
      columnas: [{ k: 'paquete', t: 'Paquete', v: (l, B) => (B.ceye || []).find((x) => x.id === l.paquete_id)?.nombre || '' }, { k: 'cantidad', t: 'Cantidad', editable: true, tipo: 'numero', ancho: 70 }, { k: 'lote', t: 'Lote', editable: true }, { k: 'vence', t: 'Vence', v: (l) => (l.vence ? fmt.fechaDia(l.vence) : '') }, { k: 'destino', t: 'Destino (área)', editable: true }],
      agregarHtml: (B) => `<label class="campo sat-ancho"><span>Paquete</span><select name="ceye_paq">${(B.ceye || []).filter((x) => x.activo).map((x) => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}</select></label><label class="campo"><span>Cantidad</span><input type="number" name="ceye_cant" value="1" min="1"></label>`,
      agregar: async (r, B, cont) => { const id = Number(cont.querySelector('[name=ceye_paq]').value); if (!id) return []; return [{ paquete_id: id, cantidad: Number(cont.querySelector('[name=ceye_cant]').value) || 1, lote: `C${r.numero}-${String(r.fecha).slice(0, 10).replace(/-/g, '')}` }]; } } });
  // ===================== Mantenimiento de equipo médico =====================
  window.PANTALLAS['med-mantenimiento'] = (cont) => S().registro(cont, { titulo: 'Mantenimiento de equipo médico', nombre: 'Mantenimiento', icono: 'ti-tool', grupo: 'Procesos', tabla: 'med_mantenimientos', fecha: 'programado', fechaTipo: 'fecha', orden: 'programado', numerado: true, dias: 365,
    ayuda: 'Mantenimiento preventivo, correctivo, calibración y verificación del equipo médico (con su código de activo fijo): programado, realizado, proveedor, costo y próximo servicio. Los vencidos sin realizar y los equipos fuera de servicio se resaltan.',
    campos: [{ k: 'equipo', t: 'Equipo', req: true, ancho: 1 }, { k: 'activo_codigo', t: 'Código de activo fijo' }, { k: 'area_id', t: 'Área', tipo: 'sel', op: (B) => B.areas.map((a) => [a.id, a.nombre]) }, { k: 'tipo', t: 'Tipo', tipo: 'sel', op: ['PREVENTIVO', 'CORRECTIVO', 'CALIBRACIÓN', 'VERIFICACIÓN'], vacio: false },
      { k: 'programado', t: 'Programado', tipo: 'fecha' }, { k: 'realizado', t: 'Realizado', tipo: 'fecha' }, { k: 'proveedor', t: 'Proveedor' }, { k: 'tecnico', t: 'Técnico' }, { k: 'costo', t: 'Costo Q', tipo: 'numero' },
      { k: 'falla', t: 'Falla reportada', tipo: 'area', filas: 2 }, { k: 'trabajo', t: 'Trabajo realizado', tipo: 'area', filas: 2 }, { k: 'estado', t: 'Estado', tipo: 'sel', op: ['PROGRAMADO', 'EN PROCESO', 'REALIZADO', 'CANCELADO'], vacio: false }, { k: 'fuera_de_servicio', t: 'Equipo fuera de servicio', tipo: 'check' }, { k: 'proximo', t: 'Próximo servicio', tipo: 'fecha' }],
    nuevo: () => ({ tipo: 'PREVENTIVO', programado: hoy(), estado: 'PROGRAMADO', costo: 0 }),
    columnas: [{ t: 'No.', v: (r) => String(r.numero), ancho: 6 }, { t: 'Programado', v: (r) => fmt.fechaDia(r.programado), ancho: 10 }, { t: 'Equipo', v: (r) => r.equipo, ancho: 28 }, { t: 'Activo', v: (r) => r.activo_codigo || '', ancho: 10 }, { t: 'Área', v: (r, B) => S().nom(B.areas, r.area_id), ancho: 16 }, { t: 'Tipo', v: (r) => r.tipo, ancho: 12 }, { t: 'Realizado', v: (r) => (r.realizado ? fmt.fechaDia(r.realizado) : ''), ancho: 10 }, { t: 'Costo Q', v: (r) => r2(r.costo), tipo: 'monto', ancho: 11 }, { t: 'Estado', v: (r) => `¤${r.estado === 'REALIZADO' ? 'TERMINADA' : r.estado === 'CANCELADO' ? 'ANULADA' : 'PENDIENTE'}`, ancho: 11 }],
    resaltar: (r) => r.fuera_de_servicio || (r.estado === 'PROGRAMADO' && r.programado < hoy()),
    kpis: (xs) => [['Servicios', xs.length], ['Vencidos', xs.filter((r) => r.estado === 'PROGRAMADO' && r.programado < hoy()).length, 'ec-alerta'], ['Fuera de servicio', xs.filter((r) => r.fuera_de_servicio).length, 'ec-alerta'], ['Costo', q(sum(xs.map((r) => r.costo)))]] });
})();
