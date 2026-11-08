// Hospital (script 157): catálogos, admisión, citas, cuenta del paciente, órdenes y farmacia, quirófanos, censo y
// día-cama, egreso y facturación (paciente / aseguradora con deducible y coaseguro), honorarios médicos, reclamos,
// cierre de caja y reportes (ocupación, ingresos, cuentas abiertas, cartera e indicadores hospitalarios).
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const q = (n) => `Q ${fmt.monto(n)}`;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const G = () => window.GRAFICAS;
  const hoy = () => fmt.hoy();
  const diaGt = (v) => (v ? new Date(v).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }) : '');
  const horaGt = (v) => (v ? new Date(v).toLocaleString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') : '');
  const dias = (a, b) => Math.max(0, Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5));
  const empresaDe = (ctx) => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
  const faltaScript = (ctx, e) => { ctx.pDet.innerHTML = `<p class="vacio">${/hos_/.test(e?.message || '') ? 'Falta instalar el script 157 (Hospital) en Supabase.' : esc(window.UI.traducirError(e))}</p>`; };
  const CLS = { ABIERTA: 'editando', EGRESADA: 'pendiente', FACTURADA: 'aprobada', ANULADA: 'anulada', DISPONIBLE: 'aprobada', OCUPADA: 'anulada', LIMPIEZA: 'pendiente', MANTENIMIENTO: 'definitiva', PROGRAMADA: 'editando', CONFIRMADA: 'editando', ATENDIDA: 'aprobada', CANCELADA: 'anulada', 'NO ASISTIÓ': 'anulada', PENDIENTE: 'pendiente', DESPACHADA: 'aprobada', REALIZADA: 'aprobada', PRESENTADO: 'pendiente', 'EN REVISIÓN': 'editando', APROBADO: 'editando', PAGADO: 'aprobada', RECHAZADO: 'anulada', PARCIAL: 'pendiente', CALCULADA: 'pendiente', PAGADA: 'aprobada', 'EN CURSO': 'editando' };
  const marca = (e) => `<span class="pc-marca ${CLS[e] || ''}">${esc(e)}</span>`;
  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) { const { data, error } = await hacer().range(i, i + 999); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; }
    return out;
  }
  const botonesExp = '<button type="button" class="boton secundario-sm" data-exp="PDF"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button><button type="button" class="boton secundario-sm" data-exp="EXCEL"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>';
  function tabla(c, graficas = true) {
    const n = c.columnas.length;
    const celda = (v, x) => (v === '' || v == null ? '<td></td>' : typeof v === 'number' ? `<td class="num">${x.tipo === 'monto' ? fmt.monto(v) : x.tipo === 'porcentaje' ? `${(v * 100).toFixed(1)} %` : v.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</td>` : String(v).startsWith('¤') ? `<td>${marca(String(v).slice(1))}</td>` : `<td>${esc(String(v))}</td>`);
    const gs = graficas ? (c.graficas || []).filter(Boolean) : [];
    return `<div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${c.columnas.map((x) => `<th class="${x.tipo === 'texto' ? '' : 'num'}">${esc(x.titulo)}</th>`).join('')}</tr></thead>
      <tbody>${c.filas.length ? c.filas.map((r) => (r.tipo === 'grupo' && r.combinar ? `<tr class="pr-g"><td colspan="${n}">${esc(r.valores[0])}</td></tr>` : `<tr class="${r.tipo === 'subtotal' ? 'pr-s' : r.tipo === 'total' ? 'pr-t' : ''}${r.resaltar ? ' pr-alerta' : ''}" ${r.attr || ''}>${c.columnas.map((x, i) => celda(r.valores[i], x)).join('')}</tr>`)).join('') : `<tr><td colspan="${n}" class="tk-vacio">${esc(c.vacio || 'Sin información.')}</td></tr>`}</tbody></table>
      ${gs.length && c.filas.length ? `<section class="pr-graficas"><h3><i class="ti ti-chart-bar" aria-hidden="true"></i> Gráficas</h3>${gs.join('')}</section>` : ''}</div>`;
  }
  function exportar(c, formato, graficas = true) {
    if (!c || !c.filas.length) return window.FIN.aviso('No hay información para imprimir');
    const gs = graficas ? (c.graficas || []).filter(Boolean) : [];
    const s = { ...c, filas: c.filas.map((r) => ({ ...r, resaltar: r.resaltar ? 1 : undefined, valores: r.valores.map((v) => (typeof v === 'string' && v.startsWith('¤') ? v.slice(1) : v)) })) };
    if (formato === 'PDF') return window.CUENTAS_XLSX.pdf({ ...s, graficas: gs.join('') });
    Promise.all(gs.map((g) => G().png(g))).then((imagenes) => window.REPORTE_XLSX.generar({ ...s, imagenes })).catch((e) => window.FIN.aviso(e.message || 'No se pudo generar el Excel'));
  }

  // ---------- Base del hospital ----------
  async function baseHospital(ctx) {
    const { sb } = ctx, loc = ctx.sel.loc;
    const leer = (t, ord = 'codigo') => sb.from(t).select('*').eq('localidad_id', loc).order(ord);
    let [as, es, me, ar, ca, se] = await Promise.all([leer('hos_aseguradoras'), leer('hos_especialidades'), leer('hos_medicos'), leer('hos_areas'), leer('hos_camas'), leer('hos_servicios')]);
    if (as.error) throw as.error;
    if (!(es.data || []).length) { await sb.rpc('hos_asegurar_catalogos', { p_localidad: loc }); [es, ar, se] = await Promise.all([leer('hos_especialidades'), leer('hos_areas'), leer('hos_servicios')]); }
    const pac = await leerTodo(() => sb.from('hos_pacientes').select('*').eq('localidad_id', loc).order('expediente'));
    return { aseguradoras: as.data || [], especialidades: es.data || [], medicos: me.data || [], areas: ar.data || [], camas: ca.data || [], servicios: se.data || [], pacientes: pac };
  }
  const nomPac = (p) => (p ? `${p.expediente} · ${p.nombres} ${p.apellidos}` : '');
  const opt = (lst, sel, val, txt, vacio = '—') => `${vacio != null ? `<option value="">${vacio}</option>` : ''}${lst.map((x) => `<option value="${x[val]}" ${String(sel ?? '') === String(x[val]) ? 'selected' : ''}>${esc(txt(x))}</option>`).join('')}`;

  // ===================== Listas de catálogo =====================
  function lista(cont, op) {
    const ctx = montar(cont, { titulo: op.titulo, icono: op.icono, clase: 'bk-movimientos bm-solo cx-rep pf-cat', grupo: 'Hospital · Catálogos' });
    const { sb } = ctx;
    let B = null, sec = 0;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', op.icono); return; }
      ctx.filtros(op.secciones.length > 1 ? `<label class="campo"><span>Catálogo</span><select name="sec">${op.secciones.map((s, i) => `<option value="${i}" ${sec === i ? 'selected' : ''}>${s.titulo}</option>`).join('')}</select></label>` : '', `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>' : ''}${botonesExp}`);
      try { B = await baseHospital(ctx); } catch (e) { return faltaScript(ctx, e); }
      pintar();
    }
    const S = () => op.secciones[sec];
    const filas = () => B[S().clave];
    const opciones = (c) => (c.ref ? [['', '—'], ...B[c.ref].map((x) => [x.id, x.nombre])] : c.opciones.map((o) => [o, o]));
    function pintar() {
      const s = S(), ed = ctx.admin;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> ${s.ayuda}</p>${s.kpis ? `<div class="ec-kpis">${s.kpis(B).map(([t, v, c]) => kpi(t, v, c)).join('')}</div>` : ''}
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${s.campos.map((c) => `<th>${c.titulo}</th>`).join('')}${ed ? '<th></th>' : ''}</tr></thead>
        <tbody>${filas().map((f) => `<tr data-id="${f.id}">${s.campos.map((c) => `<td>${!ed ? esc(c.tipo === 'check' ? (f[c.k] ? 'Sí' : 'No') : c.ref ? (B[c.ref].find((x) => x.id === f[c.k])?.nombre || '') : String(f[c.k] ?? '')) : c.opciones || c.ref ? `<select data-c="${c.k}">${opciones(c).map(([v, t]) => `<option value="${v}" ${String(f[c.k] ?? '') === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : c.tipo === 'check' ? `<input type="checkbox" data-c="${c.k}" ${f[c.k] ? 'checked' : ''}>` : `<input data-c="${c.k}" value="${esc(String(f[c.k] ?? ''))}" ${c.tipo === 'numero' ? 'type="number" step="any"' : ''}>`}</td>`).join('')}${ed ? '<td><button type="button" class="icono-boton rp-peligro" data-quitar title="Quitar"><i class="ti ti-trash" aria-hidden="true"></i></button></td>' : ''}</tr>`).join('') || `<tr><td colspan="${s.campos.length + 1}" class="tk-vacio">Sin registros.</td></tr>`}</tbody></table></div></div>`;
    }
    const cfg = () => ({ titulo: S().titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: S().titulo.slice(0, 30), archivo: S().tabla, parametros: [`Empresa: ${empresaDe(ctx)}`], columnas: S().campos.map((c) => col(c.titulo, c.tipo === 'numero' ? 'numero' : 'texto', c.ancho || 16)), filas: filas().map((f) => ({ valores: S().campos.map((c) => (c.tipo === 'check' ? (f[c.k] ? 'Sí' : 'No') : c.ref ? (B[c.ref].find((x) => x.id === f[c.k])?.nombre || '') : c.tipo === 'numero' ? num(f[c.k]) : String(f[c.k] ?? ''))) })) });
    cont.addEventListener('change', async (e) => {
      const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar();
      if (e.target.name === 'sec' && e.target.closest('.bk-filtros')) { sec = Number(e.target.value); return pintar(); }
      const tr = e.target.closest('tr[data-id]'); const k = e.target.dataset.c; if (!tr || !k) return;
      const c = S().campos.find((x) => x.k === k);
      const v = c.tipo === 'check' ? e.target.checked : c.tipo === 'numero' ? num(e.target.value) : c.ref ? (Number(e.target.value) || null) : e.target.value.trim().toUpperCase();
      const { error } = await sb.from(S().tabla).update({ [k]: v }).eq('id', Number(tr.dataset.id));
      if (error) { window.FIN.aviso(window.UI.traducirError(error)); return cargar(); }
      Object.assign(filas().find((f) => String(f.id) === tr.dataset.id), { [k]: v }); if (S().kpis) pintar();
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      if (e.target.closest('[data-accion="nuevo"]')) { const { error } = await sb.from(S().tabla).insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, ...S().nuevo(filas(), B) }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); return cargar(); }
      if (e.target.closest('[data-quitar]')) { if (!confirm('¿Quitar el registro?')) return; const { error } = await sb.from(S().tabla).delete().eq('id', Number(e.target.closest('tr').dataset.id)); if (error) return window.FIN.aviso(/foreign|referen/i.test(error.message) ? 'Está en uso: márcalo inactivo' : window.UI.traducirError(error)); cargar(); }
    });
    iniciar();
  }
  const sig = (f) => Math.max(0, ...f.map((x) => Number(x.codigo) || 0)) + 1;
  window.PANTALLAS['hos-medicos'] = (cont) => lista(cont, { titulo: 'Médicos y especialidades', icono: 'ti-stethoscope', secciones: [
    { titulo: 'Médicos', clave: 'medicos', tabla: 'hos_medicos', ayuda: 'Médicos con su colegiado, especialidad, tipo (staff, externo, residente), participación del hospital sobre honorarios y retención de ISR.', campos: [{ k: 'codigo', titulo: 'Código', tipo: 'numero', ancho: 7 }, { k: 'nombre', titulo: 'Nombre', ancho: 30 }, { k: 'colegiado', titulo: 'Colegiado' }, { k: 'especialidad_id', titulo: 'Especialidad', ref: 'especialidades', ancho: 22 }, { k: 'tipo', titulo: 'Tipo', opciones: ['STAFF', 'EXTERNO', 'RESIDENTE'] }, { k: 'nit', titulo: 'NIT' }, { k: 'telefono', titulo: 'Teléfono' }, { k: 'pct_hospital', titulo: '% hospital', tipo: 'numero' }, { k: 'retencion_isr_pct', titulo: '% ret. ISR', tipo: 'numero' }, { k: 'activo', titulo: 'Activo', tipo: 'check' }], nuevo: (f) => ({ codigo: sig(f), nombre: 'DR. NUEVO MÉDICO' }) },
    { titulo: 'Especialidades', clave: 'especialidades', tabla: 'hos_especialidades', ayuda: 'Especialidades médicas.', campos: [{ k: 'codigo', titulo: 'Código', tipo: 'numero', ancho: 7 }, { k: 'nombre', titulo: 'Especialidad', ancho: 36 }, { k: 'activo', titulo: 'Activa', tipo: 'check' }], nuevo: (f) => ({ codigo: sig(f), nombre: 'NUEVA ESPECIALIDAD' }) }] });
  window.PANTALLAS['hos-camas'] = (cont) => lista(cont, { titulo: 'Áreas, habitaciones y camas', icono: 'ti-bed', secciones: [
    { titulo: 'Camas', clave: 'camas', tabla: 'hos_camas', ayuda: 'Camas por área con su habitación, tipo, tarifa diaria (día-cama) y estado.', kpis: (B) => [['Camas', B.camas.filter((c) => c.activo).length], ['Disponibles', B.camas.filter((c) => c.estado === 'DISPONIBLE').length, 'ec-fin'], ['Ocupadas', B.camas.filter((c) => c.estado === 'OCUPADA').length], ['En limpieza', B.camas.filter((c) => c.estado === 'LIMPIEZA').length]], campos: [{ k: 'codigo', titulo: 'Cama', ancho: 8 }, { k: 'area_id', titulo: 'Área', ref: 'areas', ancho: 20 }, { k: 'habitacion', titulo: 'Habitación' }, { k: 'tipo', titulo: 'Tipo', opciones: ['PRIVADA', 'SEMIPRIVADA', 'GENERAL', 'INTENSIVO', 'OBSERVACIÓN'] }, { k: 'tarifa_diaria', titulo: 'Tarifa diaria Q', tipo: 'numero' }, { k: 'estado', titulo: 'Estado', opciones: ['DISPONIBLE', 'OCUPADA', 'LIMPIEZA', 'MANTENIMIENTO'] }, { k: 'activo', titulo: 'Activa', tipo: 'check' }], nuevo: (f, B) => ({ codigo: `C-${f.length + 1}`, area_id: B.areas.find((a) => a.tipo === 'ENCAMAMIENTO')?.id || null, tarifa_diaria: 800 }) },
    { titulo: 'Áreas', clave: 'areas', tabla: 'hos_areas', ayuda: 'Áreas del hospital: emergencia, encamamiento, intensivo, sala de operaciones, consulta externa, maternidad y pediatría.', campos: [{ k: 'codigo', titulo: 'Código', tipo: 'numero', ancho: 7 }, { k: 'nombre', titulo: 'Área', ancho: 30 }, { k: 'tipo', titulo: 'Tipo', opciones: ['EMERGENCIA', 'ENCAMAMIENTO', 'INTENSIVO', 'QUIRÓFANO', 'CONSULTA', 'MATERNIDAD', 'PEDIATRÍA'] }, { k: 'activo', titulo: 'Activa', tipo: 'check' }], nuevo: (f) => ({ codigo: sig(f), nombre: 'NUEVA ÁREA' }) }] });
  window.PANTALLAS['hos-servicios'] = (cont) => lista(cont, { titulo: 'Servicios y tarifas', icono: 'ti-list-check', secciones: [
    { titulo: 'Servicios', clave: 'servicios', tabla: 'hos_servicios', ayuda: 'Servicios que se cargan a la cuenta del paciente con su precio de lista: procedimientos, laboratorio, imagenología, honorarios, quirófano e insumos.', campos: [{ k: 'codigo', titulo: 'Código', ancho: 9 }, { k: 'nombre', titulo: 'Servicio', ancho: 36 }, { k: 'tipo', titulo: 'Tipo', opciones: ['HABITACIÓN', 'PROCEDIMIENTO', 'LABORATORIO', 'IMAGENOLOGÍA', 'HONORARIO', 'MEDICAMENTO', 'INSUMO', 'QUIRÓFANO', 'OTRO'] }, { k: 'precio', titulo: 'Precio Q', tipo: 'numero' }, { k: 'activo', titulo: 'Activo', tipo: 'check' }], nuevo: (f) => ({ codigo: `SRV-${f.length + 1}`, nombre: 'NUEVO SERVICIO', tipo: 'PROCEDIMIENTO' }) }] });
  window.PANTALLAS['hos-aseguradoras'] = (cont) => lista(cont, { titulo: 'Aseguradoras y convenios', icono: 'ti-shield-heart', secciones: [
    { titulo: 'Aseguradoras', clave: 'aseguradoras', tabla: 'hos_aseguradoras', ayuda: 'Aseguradoras con su convenio: deducible por evento y coaseguro (% que paga el paciente sobre lo que excede el deducible), días de crédito.', campos: [{ k: 'codigo', titulo: 'Código', tipo: 'numero', ancho: 7 }, { k: 'nombre', titulo: 'Aseguradora', ancho: 30 }, { k: 'nit', titulo: 'NIT' }, { k: 'contacto', titulo: 'Contacto' }, { k: 'telefono', titulo: 'Teléfono' }, { k: 'deducible', titulo: 'Deducible Q', tipo: 'numero' }, { k: 'coaseguro_pct', titulo: 'Coaseguro %', tipo: 'numero' }, { k: 'dias_credito', titulo: 'Días crédito', tipo: 'numero' }, { k: 'activo', titulo: 'Activa', tipo: 'check' }], nuevo: (f) => ({ codigo: sig(f), nombre: 'NUEVA ASEGURADORA', deducible: 1000, coaseguro_pct: 20 }) }] });

  // ===================== Pacientes =====================
  window.PANTALLAS['hos-pacientes'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Pacientes', icono: 'ti-user-heart', clase: 'bk-movimientos bm-solo cx-rep nom-emp', grupo: 'Hospital · Catálogos' });
    const { sb } = ctx;
    let B = null, actual = null, nuevo = false, buscar = '';
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar(id = actual?.id) {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-user-heart'); return; }
      try { B = await baseHospital(ctx); } catch (e) { return faltaScript(ctx, e); }
      actual = B.pacientes.find((p) => p.id === id) || null;
      ctx.filtros(`<label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar value="${esc(buscar)}" placeholder="Expediente, nombre, DPI…"></label>`, `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-user-plus" aria-hidden="true"></i> Nuevo paciente</button>' : ''}${botonesExp}`);
      pintar();
    }
    const ls = () => B.pacientes.filter((p) => !buscar || `${p.expediente} ${p.nombres} ${p.apellidos} ${p.dpi || ''}`.toLowerCase().includes(buscar.toLowerCase()));
    function ficha(p) {
      const v = p || { estado: 'ACTIVO' }, dis = ctx.admin ? '' : 'disabled';
      const t = (k, l, c = '') => `<label class="campo ${c}"><span>${l}</span><input name="${k}" value="${esc(String(v[k] ?? ''))}" ${dis}></label>`;
      return `<form class="hos-pac" novalidate><div class="cl-banda">${p ? `Expediente ${p.expediente} · ${esc(p.nombres)} ${esc(p.apellidos)}` : 'Nuevo paciente'}</div><div class="sat-g">
        ${t('nombres', 'Nombres *')}${t('apellidos', 'Apellidos *')}${t('dpi', 'DPI (CUI)')}${t('nit', 'NIT')}<label class="campo"><span>Fecha de nacimiento</span><input type="date" name="fecha_nacimiento" value="${v.fecha_nacimiento || ''}" ${dis}></label><label class="campo"><span>Género</span><select name="genero" ${dis}>${opt([{ v: 'M', t: 'Masculino' }, { v: 'F', t: 'Femenino' }], v.genero, 'v', (x) => x.t)}</select></label>
        ${t('telefono', 'Teléfono')}${t('correo', 'Correo')}${t('direccion', 'Dirección', 'sat-ancho')}${t('tipo_sangre', 'Tipo de sangre')}${t('alergias', 'Alergias', 'sat-ancho')}${t('contacto_emergencia', 'Contacto de emergencia')}${t('telefono_emergencia', 'Teléfono de emergencia')}
        <label class="campo"><span>Aseguradora</span><select name="aseguradora_id" ${dis}>${opt(B.aseguradoras, v.aseguradora_id, 'id', (a) => a.nombre, 'Particular')}</select></label>${t('poliza_seguro', 'Póliza / carné')}${p ? `<label class="campo"><span>Estado</span><select name="estado" ${dis}>${opt([{ v: 'ACTIVO' }, { v: 'INACTIVO' }, { v: 'FALLECIDO' }], v.estado, 'v', (x) => x.v, null)}</select></label>` : ''}</div>
        <p class="modal-error tk-error" role="alert"></p>${ctx.admin ? `<div class="pr-nueva-acc">${p ? '' : '<button type="button" class="boton secundario-sm" data-accion="cancelar">Cancelar</button>'}<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button></div>` : ''}</form>`;
    }
    function pintar() {
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Pacientes', B.pacientes.length)}${kpi('Con seguro', B.pacientes.filter((p) => p.aseguradora_id).length)}${kpi('Particulares', B.pacientes.filter((p) => !p.aseguradora_id).length)}</div>
        <div class="nom-split"><div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr><th class="num">Exp.</th><th>Paciente</th><th>DPI</th><th>Aseguradora</th></tr></thead><tbody>${ls().slice(0, 500).map((p) => `<tr data-p="${p.id}" class="${actual?.id === p.id ? 'actual' : ''}" style="cursor:pointer"><td class="num">${p.expediente}</td><td>${esc(`${p.nombres} ${p.apellidos}`)}</td><td>${esc(p.dpi || '')}</td><td>${esc(B.aseguradoras.find((a) => a.id === p.aseguradora_id)?.nombre || 'PARTICULAR')}</td></tr>`).join('') || '<tr><td colspan="4" class="tk-vacio">Sin pacientes.</td></tr>'}</tbody></table></div>
        <div class="nom-ficha-c">${nuevo ? ficha(null) : actual ? ficha(actual) : '<p class="ck-elige"><i class="ti ti-user-heart" aria-hidden="true"></i> Elige un paciente o registra uno nuevo.</p>'}</div></div></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') cargar(null); });
    cont.addEventListener('input', (e) => { if (e.target.matches('[data-buscar]')) { buscar = e.target.value; pintar(); ctx.pFil.querySelector('[data-buscar]')?.focus(); } });
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('.hos-pac')) return; e.preventDefault();
      const el = e.target.elements, g = (k) => el[k]?.value?.trim() ?? '';
      const v = { nombres: g('nombres').toUpperCase(), apellidos: g('apellidos').toUpperCase(), dpi: g('dpi') || null, nit: g('nit') || null, fecha_nacimiento: g('fecha_nacimiento') || null, genero: g('genero') || null, telefono: g('telefono') || null, correo: g('correo') || null, direccion: g('direccion') || null, tipo_sangre: g('tipo_sangre') || null, alergias: g('alergias') || null, contacto_emergencia: g('contacto_emergencia') || null, telefono_emergencia: g('telefono_emergencia') || null, aseguradora_id: Number(g('aseguradora_id')) || null, poliza_seguro: g('poliza_seguro') || null };
      if (el.estado) v.estado = g('estado');
      if (!v.nombres || !v.apellidos) { e.target.querySelector('.modal-error').textContent = 'Nombres y apellidos son obligatorios.'; return; }
      const r = nuevo ? await sb.from('hos_pacientes').insert({ ...v, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, expediente: 0 }).select('id').single() : await sb.from('hos_pacientes').update(v).eq('id', actual.id).select('id').single();
      if (r.error) { e.target.querySelector('.modal-error').textContent = window.UI.traducirError(r.error); return; }
      nuevo = false; window.FIN.aviso('Paciente guardado'); cargar(r.data.id);
    });
    cont.addEventListener('click', (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar({ titulo: 'Pacientes', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Pacientes', archivo: 'pacientes', parametros: [`Empresa: ${empresaDe(ctx)}`], columnas: [col('Expediente', 'texto', 9), col('Paciente', 'texto', 34), col('DPI', 'texto', 16), col('Teléfono', 'texto', 12), col('Aseguradora', 'texto', 24), col('Estado', 'texto', 10)], filas: ls().map((p) => ({ valores: [String(p.expediente), `${p.nombres} ${p.apellidos}`, p.dpi || '', p.telefono || '', B.aseguradoras.find((a) => a.id === p.aseguradora_id)?.nombre || 'PARTICULAR', p.estado] })) }, ex.dataset.exp, false);
      const tr = e.target.closest('tr[data-p]'); if (tr) { nuevo = false; actual = B.pacientes.find((p) => String(p.id) === tr.dataset.p); return pintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion; if (a === 'nuevo') { nuevo = true; actual = null; pintar(); } if (a === 'cancelar') { nuevo = false; pintar(); }
    });
    iniciar();
  };

  // ===================== Admisión =====================
  window.PANTALLAS['hos-admision'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Admisión', icono: 'ti-door-enter', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Hospital · Registros' });
    const { sb } = ctx;
    let B = null, ads = [], ver = 'ABIERTA';
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-door-enter'); return; }
      try { B = await baseHospital(ctx); } catch (e) { return faltaScript(ctx, e); }
      let qy = sb.from('hos_admisiones').select('*').eq('localidad_id', ctx.sel.loc).order('numero', { ascending: false }).limit(500); if (ver !== 'TODAS') qy = qy.eq('estado', ver);
      ads = (await qy).data || [];
      ctx.filtros(`<label class="campo"><span>Estado</span><select name="ver">${['ABIERTA', 'EGRESADA', 'FACTURADA', 'ANULADA', 'TODAS'].map((x) => `<option ${ver === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`, botonesExp);
      pintar();
    }
    const cfg = () => ({ titulo: `Admisiones ${ver === 'TODAS' ? '' : ver.toLowerCase() + 's'}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Admisiones', archivo: 'admisiones', parametros: [`Empresa: ${empresaDe(ctx)}`],
      columnas: [col('No.', 'entero', 6), col('Ingreso', 'texto', 15), col('Paciente', 'texto', 30), col('Tipo', 'texto', 16), col('Cama', 'texto', 8), col('Médico', 'texto', 24), col('Aseguradora', 'texto', 20), col('Diagnóstico', 'texto', 28), col('Cargos Q', 'monto', 13), col('Estado', 'texto', 11)],
      filas: ads.map((a) => ({ valores: [a.numero, horaGt(a.fecha_ingreso), nomPac(B.pacientes.find((p) => p.id === a.paciente_id)), a.tipo, B.camas.find((c) => c.id === a.cama_id)?.codigo || '', B.medicos.find((m) => m.id === a.medico_id)?.nombre || '', B.aseguradoras.find((x) => x.id === a.aseguradora_id)?.nombre || 'PARTICULAR', a.diagnostico_ingreso || '', r2(a.total_cargos), `¤${a.estado}`] })) });
    function pintar() {
      const libres = B.camas.filter((c) => c.estado === 'DISPONIBLE' && c.activo);
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Pacientes internados', ads.filter((a) => a.estado === 'ABIERTA' && a.cama_id).length)}${kpi('Camas disponibles', libres.length, 'ec-fin')}${kpi('Admisiones en la lista', ads.length)}</div>
        ${ctx.admin ? `<form class="pf-modform hos-adm" novalidate><label class="campo sat-ancho"><span>Paciente *</span><input name="paciente" list="hos-pacs" placeholder="Expediente o nombre (regístralo en Pacientes)" autocomplete="off"></label><label class="campo"><span>Tipo</span><select name="tipo">${['EMERGENCIA', 'CONSULTA EXTERNA', 'HOSPITALIZACIÓN', 'CIRUGÍA AMBULATORIA'].map((x) => `<option>${x}</option>`).join('')}</select></label><label class="campo"><span>Médico tratante</span><select name="medico">${opt(B.medicos.filter((m) => m.activo), '', 'id', (m) => m.nombre)}</select></label><label class="campo"><span>Cama</span><select name="cama">${opt(libres, '', 'id', (c) => `${c.codigo} · ${c.tipo} · ${q(c.tarifa_diaria)}/día`, 'Sin cama')}</select></label><label class="campo"><span>Aseguradora</span><select name="aseg">${opt(B.aseguradoras, '', 'id', (a) => a.nombre, 'Según el paciente')}</select></label><label class="campo pf-just"><span>Diagnóstico de ingreso</span><input name="diag"></label><button type="submit" class="boton primario-sm"><i class="ti ti-door-enter" aria-hidden="true"></i> Admitir</button><p class="modal-error tk-error" role="alert"></p></form><datalist id="hos-pacs">${B.pacientes.filter((p) => p.estado === 'ACTIVO').map((p) => `<option value="${esc(nomPac(p))}"></option>`).join('')}</datalist>` : ''}
        ${tabla(cfg(), false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); if (e.target.name === 'ver' && e.target.closest('.bk-filtros')) { ver = e.target.value; cargar(); } });
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('.hos-adm')) return; e.preventDefault(); const el = e.target.elements;
      const p = B.pacientes.find((x) => nomPac(x) === el.paciente.value.trim() || String(x.expediente) === el.paciente.value.trim());
      if (!p) { e.target.querySelector('.modal-error').textContent = 'Elige un paciente registrado (Catálogos › Pacientes).'; return; }
      const { error } = await sb.from('hos_admisiones').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, numero: 0, paciente_id: p.id, tipo: el.tipo.value, medico_id: Number(el.medico.value) || null, cama_id: Number(el.cama.value) || null, aseguradora_id: Number(el.aseg.value) || p.aseguradora_id || null, poliza_seguro: p.poliza_seguro, diagnostico_ingreso: el.diag.value.trim() || null });
      if (error) { e.target.querySelector('.modal-error').textContent = window.UI.traducirError(error); return; }
      window.FIN.aviso('Paciente admitido: registra los cargos en Cuenta del paciente'); cargar();
    });
    cont.addEventListener('click', (e) => { const ex = e.target.closest('[data-exp]'); if (ex) exportar(cfg(), ex.dataset.exp, false); });
    iniciar();
  };

  // ===================== Citas =====================
  window.PANTALLAS['hos-citas'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Citas y agenda médica', icono: 'ti-calendar-plus', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Hospital · Registros' });
    const { sb } = ctx;
    const f = { fecha: hoy(), medico: '' };
    let B = null, citas = [];
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-calendar-plus'); return; }
      try { B = await baseHospital(ctx); } catch (e) { return faltaScript(ctx, e); }
      let qy = sb.from('hos_citas').select('*').eq('localidad_id', ctx.sel.loc).eq('fecha', f.fecha).order('hora'); if (f.medico) qy = qy.eq('medico_id', Number(f.medico));
      citas = (await qy).data || [];
      ctx.filtros(`<label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${f.fecha}"></label><label class="campo"><span>Médico</span><select name="medico">${opt(B.medicos, f.medico, 'id', (m) => m.nombre, 'Todos')}</select></label>`, botonesExp);
      pintar();
    }
    const cfg = () => ({ titulo: `Agenda del ${fmt.fechaDia(f.fecha)}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Agenda', archivo: `agenda_${f.fecha}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `Médico: ${B.medicos.find((m) => String(m.id) === f.medico)?.nombre || 'Todos'}`],
      columnas: [col('Hora', 'texto', 7), col('Paciente', 'texto', 32), col('Teléfono', 'texto', 12), col('Médico', 'texto', 26), col('Motivo', 'texto', 30), col('Estado', 'texto', 12)],
      filas: citas.map((c) => { const p = B.pacientes.find((x) => x.id === c.paciente_id); return { valores: [String(c.hora).slice(0, 5), nomPac(p), p?.telefono || '', B.medicos.find((m) => m.id === c.medico_id)?.nombre || '', c.motivo || '', `¤${c.estado}`], attr: `data-c="${c.id}"` }; }) });
    function pintar() {
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Citas del día', citas.length)}${kpi('Atendidas', citas.filter((c) => c.estado === 'ATENDIDA').length, 'ec-fin')}${kpi('Pendientes', citas.filter((c) => ['PROGRAMADA', 'CONFIRMADA'].includes(c.estado)).length)}${kpi('No asistió', citas.filter((c) => c.estado === 'NO ASISTIÓ').length)}</div>
        ${ctx.admin ? `<form class="pf-modform hos-cita" novalidate><label class="campo sat-ancho"><span>Paciente *</span><input name="paciente" list="hos-pacs2" autocomplete="off"></label><label class="campo"><span>Médico</span><select name="medico">${opt(B.medicos.filter((m) => m.activo), f.medico, 'id', (m) => m.nombre)}</select></label><label class="campo"><span>Hora</span><input type="time" name="hora" value="08:00"></label><label class="campo"><span>Duración min</span><input type="number" name="dur" value="30"></label><label class="campo pf-just"><span>Motivo</span><input name="motivo"></label><button type="submit" class="boton primario-sm"><i class="ti ti-plus" aria-hidden="true"></i> Agendar</button><p class="modal-error tk-error" role="alert"></p></form><datalist id="hos-pacs2">${B.pacientes.map((p) => `<option value="${esc(nomPac(p))}"></option>`).join('')}</datalist>` : ''}
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Toca una cita para cambiar su estado: confirmada, atendida, no asistió o cancelada. El sistema avisa si el médico ya tiene una cita a esa hora.</p>${tabla(cfg(), false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); if (['fecha', 'medico'].includes(e.target.name) && e.target.closest('.bk-filtros')) { f[e.target.name] = e.target.value; cargar(); } });
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('.hos-cita')) return; e.preventDefault(); const el = e.target.elements;
      const p = B.pacientes.find((x) => nomPac(x) === el.paciente.value.trim()); if (!p) { e.target.querySelector('.modal-error').textContent = 'Elige un paciente registrado.'; return; }
      const choque = citas.find((c) => String(c.medico_id) === el.medico.value && String(c.hora).slice(0, 5) === el.hora.value && !['CANCELADA', 'NO ASISTIÓ'].includes(c.estado));
      if (choque && !confirm('El médico ya tiene una cita a esa hora. ¿Agendar de todos modos?')) return;
      const { error } = await sb.from('hos_citas').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, paciente_id: p.id, medico_id: Number(el.medico.value) || null, fecha: f.fecha, hora: el.hora.value, duracion_min: Number(el.dur.value) || 30, motivo: el.motivo.value.trim() || null, usuario: (window.FIN.perfil()?.usuario || '').toUpperCase() });
      if (error) { e.target.querySelector('.modal-error').textContent = window.UI.traducirError(error); return; }
      cargar();
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      const tr = e.target.closest('tr[data-c]'); if (!tr || !ctx.admin) return;
      const est = prompt('Nuevo estado (CONFIRMADA, ATENDIDA, NO ASISTIÓ, CANCELADA):', 'ATENDIDA'); if (!est) return;
      const v = est.trim().toUpperCase().replace('NO ASISTIO', 'NO ASISTIÓ'); if (!['PROGRAMADA', 'CONFIRMADA', 'ATENDIDA', 'NO ASISTIÓ', 'CANCELADA'].includes(v)) return window.FIN.aviso('Estado no válido');
      await sb.from('hos_citas').update({ estado: v }).eq('id', Number(tr.dataset.c)); cargar();
    });
    iniciar();
  };

  // ===================== Cuenta del paciente (y órdenes/farmacia) =====================
  function cuenta(cont, modo) {
    const ctx = montar(cont, { titulo: modo === 'ORD' ? 'Órdenes médicas y farmacia' : 'Cuenta del paciente', icono: modo === 'ORD' ? 'ti-pill' : 'ti-file-invoice', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Hospital · Registros' });
    const { sb } = ctx;
    let B = null, ads = [], actual = null, cargos = [], pagos = [], ordenes = [], productos = [], bodegas = [], selId = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-file-invoice'); return; }
      try { B = await baseHospital(ctx); } catch (e) { return faltaScript(ctx, e); }
      ads = (await sb.from('hos_admisiones').select('*').eq('localidad_id', ctx.sel.loc).in('estado', modo === 'ORD' ? ['ABIERTA'] : ['ABIERTA', 'EGRESADA', 'FACTURADA']).order('numero', { ascending: false }).limit(300)).data || [];
      actual = ads.find((a) => a.id === selId) || ads[0] || null; selId = actual?.id;
      if (actual) { const [c, p, o] = await Promise.all([sb.from('hos_cargos').select('*').eq('admision_id', actual.id).order('fecha').order('id'), sb.from('hos_pagos').select('*').eq('admision_id', actual.id).order('fecha'), sb.from('hos_ordenes').select('*').eq('admision_id', actual.id).order('fecha', { ascending: false })]); cargos = c.data || []; pagos = p.data || []; ordenes = o.data || []; }
      if (modo === 'ORD' && !productos.length) { productos = await leerTodo(() => sb.from('productos').select('id, codigo, codigo_producto, nombre, precio_costo').eq('localidad_id', ctx.sel.loc).eq('estado', 'ACTIVO').order('nombre')); bodegas = (await sb.from('bodegas').select('id, codigo, nombre').eq('localidad_id', ctx.sel.loc).order('codigo')).data || []; }
      ctx.filtros(`<label class="campo sat-ancho"><span>Admisión</span><select name="adm">${ads.map((a) => `<option value="${a.id}" ${actual?.id === a.id ? 'selected' : ''}>No. ${a.numero} · ${esc(nomPac(B.pacientes.find((p) => p.id === a.paciente_id)))} · ${a.estado}</option>`).join('') || '<option value="">Sin admisiones</option>'}</select></label>`, botonesExp);
      pintar();
    }
    const etq = (p) => `${p.nombre} — ${p.codigo_producto || p.codigo}`;
    function estadoCuenta() {
      const a = actual, p = B.pacientes.find((x) => x.id === a.paciente_id), ag = B.aseguradoras.find((x) => x.id === a.aseguradora_id);
      const porTipo = new Map(); cargos.forEach((c) => { const l = porTipo.get(c.tipo) || []; l.push(c); porTipo.set(c.tipo, l); });
      const filas = [];
      [...porTipo.entries()].forEach(([t, ls]) => { filas.push({ valores: [t], tipo: 'grupo', combinar: true }); ls.forEach((c) => filas.push({ valores: [fmt.fechaDia(c.fecha), c.descripcion, B.medicos.find((m) => m.id === c.medico_id)?.nombre || '', num(c.cantidad), r2(c.precio), r2(c.total)], attr: `data-cargo="${c.id}"` })); filas.push({ valores: [`Subtotal ${t.toLowerCase()}`, '', '', '', '', r2(sum(ls.map((c) => c.total)))], tipo: 'subtotal' }); });
      filas.push({ valores: ['TOTAL DE CARGOS', '', '', '', '', r2(a.total_cargos)], tipo: 'total' });
      filas.push({ valores: ['(−) Anticipos y pagos', '', '', '', '', -r2(a.total_pagos)] });
      if (a.estado !== 'ABIERTA') { filas.push({ valores: ['Parte de la aseguradora', '', '', '', '', r2(a.parte_aseguradora)] }); filas.push({ valores: ['Parte del paciente (deducible + coaseguro)', '', '', '', '', r2(a.parte_paciente)] }); }
      filas.push({ valores: ['SALDO A CARGO DEL PACIENTE', '', '', '', '', r2((a.estado === 'ABIERTA' ? a.total_cargos : a.parte_paciente) - a.total_pagos)], tipo: 'total' });
      return { titulo: `Estado de cuenta · Admisión ${a.numero}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Estado de cuenta', archivo: `estado_cuenta_${a.numero}`, firmas: ['Paciente o responsable', 'Caja'],
        parametros: [`Paciente: ${nomPac(p)}`, `Ingreso: ${horaGt(a.fecha_ingreso)}`, `Aseguradora: ${ag?.nombre || 'PARTICULAR'}`, `Estado: ${a.estado}`], columnas: [col('Fecha', 'texto', 11), col('Descripción', 'texto', 44), col('Médico', 'texto', 24), col('Cantidad', 'numero', 9), col('Precio Q', 'monto', 12), col('Total Q', 'monto', 13)], filas };
    }
    function pintar() {
      const a = actual;
      if (!a) { ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="ck-elige"><i class="ti ti-file-invoice" aria-hidden="true"></i> No hay admisiones ${modo === 'ORD' ? 'abiertas' : ''}. Admite al paciente en Registros › Admisión.</p></div>`; return; }
      const p = B.pacientes.find((x) => x.id === a.paciente_id), ed = ctx.admin && a.estado === 'ABIERTA';
      const cab = `<section class="pr-cab"><div class="pr-id"><small>Admisión</small><b>No. ${a.numero}</b>${marca(a.estado)}</div><div class="pr-datos"><span><small>Paciente</small>${esc(nomPac(p))}</span><span><small>Tipo</small>${esc(a.tipo)}</span><span><small>Cama</small>${esc(B.camas.find((c) => c.id === a.cama_id)?.codigo || '—')}</span><span><small>Médico</small>${esc(B.medicos.find((m) => m.id === a.medico_id)?.nombre || '—')}</span><span><small>Aseguradora</small>${esc(B.aseguradoras.find((x) => x.id === a.aseguradora_id)?.nombre || 'PARTICULAR')}</span>${p?.alergias ? `<span class="pc-rojo"><small>Alergias</small>${esc(p.alergias)}</span>` : ''}</div></section>`;
      if (modo === 'ORD') {
        ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">${cab}
          ${ed ? `<form class="pf-modform hos-ord" novalidate><label class="campo"><span>Tipo</span><select name="tipo">${['MEDICAMENTO', 'INSUMO', 'LABORATORIO', 'IMAGENOLOGÍA', 'PROCEDIMIENTO', 'DIETA', 'CUIDADOS'].map((x) => `<option>${x}</option>`).join('')}</select></label><label class="campo sat-ancho"><span>Medicamento, insumo o servicio</span><input name="desc" list="hos-items" autocomplete="off"></label><label class="campo"><span>Cantidad</span><input type="number" name="cant" step="any" value="1"></label><label class="campo"><span>Médico</span><select name="medico">${opt(B.medicos, a.medico_id, 'id', (m) => m.nombre)}</select></label><label class="campo pf-just"><span>Indicaciones</span><input name="ind" placeholder="Dosis, vía y frecuencia"></label><button type="submit" class="boton primario-sm"><i class="ti ti-plus" aria-hidden="true"></i> Registrar orden</button></form>
            <datalist id="hos-items">${productos.map((x) => `<option value="${esc(etq(x))}"></option>`).join('')}${B.servicios.filter((s) => s.activo).map((s) => `<option value="${esc(`${s.codigo} · ${s.nombre}`)}"></option>`).join('')}</datalist>` : ''}
          <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Toca una orden pendiente para despacharla: los medicamentos e insumos salen de la bodega (con su lote) y se cargan a la cuenta; los servicios se cargan al precio de lista.</p>
          ${tabla({ columnas: [col('Fecha', 'texto'), col('Tipo', 'texto'), col('Descripción', 'texto'), col('Cantidad', 'numero'), col('Indicaciones', 'texto'), col('Médico', 'texto'), col('Estado', 'texto')], filas: ordenes.map((o) => ({ valores: [horaGt(o.fecha), o.tipo, o.descripcion, num(o.cantidad), o.indicaciones || '', B.medicos.find((m) => m.id === o.medico_id)?.nombre || '', `¤${o.estado}`], attr: `data-o="${o.id}"` })), vacio: 'Sin órdenes médicas.' }, false)}</div>`;
        return window.CUENTAS_XLSX.ajustarAlto(cont);
      }
      const saldo = (a.estado === 'ABIERTA' ? a.total_cargos : a.parte_paciente) - a.total_pagos;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">${cab}
        <div class="ec-kpis">${kpi('Total de cargos', q(a.total_cargos))}${kpi('Anticipos y pagos', q(a.total_pagos))}${a.estado !== 'ABIERTA' ? kpi('Parte aseguradora', q(a.parte_aseguradora)) : ''}${kpi('Saldo del paciente', q(saldo), saldo > 0 ? 'ec-alerta' : 'ec-fin')}${kpi('Días de estancia', dias(diaGt(a.fecha_ingreso), diaGt(a.fecha_egreso) || hoy()))}</div>
        ${ed ? `<form class="pf-modform hos-cargo" novalidate><label class="campo sat-ancho"><span>Servicio</span><select name="serv">${opt(B.servicios.filter((s) => s.activo), '', 'id', (s) => `${s.tipo} · ${s.nombre} · ${q(s.precio)}`)}</select></label><label class="campo"><span>Médico (honorarios)</span><select name="medico">${opt(B.medicos, '', 'id', (m) => m.nombre)}</select></label><label class="campo"><span>Cantidad</span><input type="number" name="cant" step="any" value="1"></label><label class="campo"><span>Precio Q</span><input type="number" name="precio" step="0.01" placeholder="De lista"></label><label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${hoy()}"></label><button type="submit" class="boton primario-sm"><i class="ti ti-plus" aria-hidden="true"></i> Cargar</button><p class="modal-error tk-error" role="alert"></p></form>` : ''}
        ${ed || (ctx.admin && a.estado === 'EGRESADA') ? `<form class="pf-modform hos-pago" novalidate><label class="campo"><span>Pago</span><select name="tipo">${['ANTICIPO', 'ABONO', 'PAGO FINAL', 'DEVOLUCIÓN'].map((x) => `<option>${x}</option>`).join('')}</select></label><label class="campo"><span>Forma</span><select name="forma">${['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE', 'DEPÓSITO'].map((x) => `<option>${x}</option>`).join('')}</select></label><label class="campo"><span>Monto Q</span><input type="number" name="monto" step="0.01"></label><label class="campo"><span>Referencia</span><input name="ref"></label><button type="submit" class="boton secundario-sm"><i class="ti ti-cash" aria-hidden="true"></i> Registrar pago</button></form>` : ''}
        ${tabla(estadoCuenta(), false)}
        <div class="cl-banda">Pagos registrados</div>${tabla({ columnas: [col('Fecha', 'texto'), col('Tipo', 'texto'), col('Forma', 'texto'), col('Referencia', 'texto'), col('Monto Q', 'monto')], filas: pagos.map((x) => ({ valores: [fmt.fechaDia(x.fecha), x.tipo, x.forma, x.referencia || '', r2(x.tipo === 'DEVOLUCIÓN' ? -x.monto : x.monto)] })), vacio: 'Sin pagos.' }, false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => {
      const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') { selId = null; return cargar(); }
      if (e.target.name === 'adm' && e.target.closest('.bk-filtros')) { selId = Number(e.target.value); return cargar(); }
      if (e.target.name === 'serv') { const s = B.servicios.find((x) => String(x.id) === e.target.value); const pr = e.target.form?.elements.precio; if (s && pr) pr.value = s.precio; }
    });
    cont.addEventListener('submit', async (e) => {
      e.preventDefault(); const el = e.target.elements, a = actual;
      if (e.target.matches('.hos-cargo')) {
        const s = B.servicios.find((x) => String(x.id) === el.serv.value); if (!s) { e.target.querySelector('.modal-error').textContent = 'Elige el servicio.'; return; }
        if (s.tipo === 'HONORARIO' && !el.medico.value) { e.target.querySelector('.modal-error').textContent = 'Los honorarios llevan el médico.'; return; }
        const { error } = await sb.from('hos_cargos').insert({ admision_id: a.id, fecha: el.fecha.value, servicio_id: s.id, tipo: s.tipo, descripcion: s.nombre, medico_id: Number(el.medico.value) || null, cantidad: num(el.cant.value) || 1, precio: el.precio.value === '' ? num(s.precio) : num(el.precio.value) });
        if (error) { e.target.querySelector('.modal-error').textContent = window.UI.traducirError(error); return; }
        return cargar();
      }
      if (e.target.matches('.hos-pago')) {
        if (!num(el.monto.value)) return window.FIN.aviso('Escribe el monto');
        const { error } = await sb.from('hos_pagos').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, admision_id: a.id, tipo: el.tipo.value, forma: el.forma.value, monto: num(el.monto.value), referencia: el.ref.value.trim() || null, usuario: (window.FIN.perfil()?.usuario || '').toUpperCase() });
        if (error) return window.FIN.aviso(window.UI.traducirError(error));
        return cargar();
      }
      if (e.target.matches('.hos-ord')) {
        const t = el.desc.value.trim(); if (!t) return window.FIN.aviso('Escribe qué se ordena');
        const pr = productos.find((x) => etq(x) === t), sv = B.servicios.find((s) => `${s.codigo} · ${s.nombre}` === t);
        const { error } = await sb.from('hos_ordenes').insert({ admision_id: a.id, medico_id: Number(el.medico.value) || null, tipo: el.tipo.value, descripcion: (pr?.nombre || sv?.nombre || t).toUpperCase(), producto_id: pr?.id || null, servicio_id: sv?.id || null, cantidad: num(el.cant.value) || 1, indicaciones: el.ind.value.trim() || null, usuario: (window.FIN.perfil()?.usuario || '').toUpperCase() });
        if (error) return window.FIN.aviso(window.UI.traducirError(error));
        return cargar();
      }
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) { if (!actual) return; if (modo === 'ORD') return exportar({ titulo: `Órdenes médicas · Admisión ${actual.numero}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Ordenes', archivo: `ordenes_${actual.numero}`, parametros: [`Paciente: ${nomPac(B.pacientes.find((p) => p.id === actual.paciente_id))}`], columnas: [col('Fecha', 'texto', 15), col('Tipo', 'texto', 14), col('Descripción', 'texto', 40), col('Cantidad', 'numero', 9), col('Indicaciones', 'texto', 34), col('Estado', 'texto', 12)], filas: ordenes.map((o) => ({ valores: [horaGt(o.fecha), o.tipo, o.descripcion, num(o.cantidad), o.indicaciones || '', o.estado] })) }, ex.dataset.exp, false); return exportar(estadoCuenta(), ex.dataset.exp, false); }
      const tro = e.target.closest('tr[data-o]');
      if (tro && ctx.admin) {
        const o = ordenes.find((x) => String(x.id) === tro.dataset.o); if (o.estado !== 'PENDIENTE') return;
        if (o.producto_id) {
          const b = prompt(`Despachar «${o.descripcion}» × ${o.cantidad}.\nBodega (código): ${bodegas.map((x) => `${x.codigo} ${x.nombre}`).join(' · ')}`, String(bodegas[0]?.codigo ?? '')); if (b == null) return;
          const bod = bodegas.find((x) => String(x.codigo) === b.trim()); if (!bod) return window.FIN.aviso('Bodega no válida');
          const lote = prompt('Lote despachado (vacío si no aplica):', '') ?? '';
          const pre = prompt('Precio de venta al paciente por unidad (Q):', String(B.servicios.find((s) => s.producto_id === o.producto_id)?.precio || r2(num(productos.find((x) => x.id === o.producto_id)?.precio_costo) * 1.3))); if (pre == null) return;
          const { error } = await sb.rpc('hos_despachar', { p_admision: actual.id, p_producto: o.producto_id, p_cantidad: num(o.cantidad), p_bodega: bod.id, p_lote: lote.trim(), p_precio: num(pre), p_orden: o.id });
          if (error) return window.FIN.aviso(window.UI.traducirError(error));
          window.FIN.aviso('Despachado: salió de la bodega y se cargó a la cuenta');
        } else {
          const s = B.servicios.find((x) => x.id === o.servicio_id);
          if (s) { const r = await sb.from('hos_cargos').insert({ admision_id: actual.id, servicio_id: s.id, tipo: s.tipo, descripcion: s.nombre, medico_id: o.medico_id, cantidad: num(o.cantidad), precio: num(s.precio) }).select('id').single(); if (r.error) return window.FIN.aviso(window.UI.traducirError(r.error)); await sb.from('hos_ordenes').update({ estado: 'REALIZADA', atendida_por: (window.FIN.perfil()?.usuario || '').toUpperCase(), atendida_en: new Date().toISOString(), cargo_id: r.data.id }).eq('id', o.id); }
          else await sb.from('hos_ordenes').update({ estado: 'REALIZADA', atendida_por: (window.FIN.perfil()?.usuario || '').toUpperCase(), atendida_en: new Date().toISOString() }).eq('id', o.id);
        }
        return cargar();
      }
      const trc = e.target.closest('tr[data-cargo]');
      if (trc && ctx.admin && actual.estado === 'ABIERTA') { if (!confirm('¿Quitar el cargo?')) return; const { error } = await sb.from('hos_cargos').delete().eq('id', Number(trc.dataset.cargo)); if (error) return window.FIN.aviso(window.UI.traducirError(error)); return cargar(); }
    });
    iniciar();
  }
  window.PANTALLAS['hos-cuenta'] = (cont) => cuenta(cont, 'CTA');
  window.PANTALLAS['hos-ordenes'] = (cont) => cuenta(cont, 'ORD');

  // ===================== Quirófanos =====================
  window.PANTALLAS['hos-quirofanos'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Programación de quirófanos', icono: 'ti-heart-rate-monitor', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Hospital · Registros' });
    const { sb } = ctx;
    const f = { desde: hoy(), hasta: (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toLocaleDateString('en-CA'); })() };
    let B = null, qx = [];
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-heart-rate-monitor'); return; }
      try { B = await baseHospital(ctx); } catch (e) { return faltaScript(ctx, e); }
      qx = (await sb.from('hos_quirofanos').select('*').eq('localidad_id', ctx.sel.loc).gte('fecha', f.desde).lte('fecha', f.hasta).order('fecha').order('hora')).data || [];
      ctx.filtros(`<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}"></label>`, botonesExp);
      pintar();
    }
    const med = (i) => B.medicos.find((m) => m.id === i)?.nombre || '';
    const cfg = () => ({ titulo: 'Programación de quirófanos', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Quirofanos', archivo: 'quirofanos', parametros: [`Empresa: ${empresaDe(ctx)}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`],
      columnas: [col('Fecha', 'texto', 11), col('Hora', 'texto', 7), col('Sala', 'texto', 10), col('Paciente', 'texto', 28), col('Procedimiento', 'texto', 30), col('Cirujano', 'texto', 22), col('Anestesiólogo', 'texto', 22), col('Min', 'entero', 6), col('Estado', 'texto', 11)],
      filas: qx.map((x) => ({ valores: [fmt.fechaDia(x.fecha), String(x.hora).slice(0, 5), x.sala, nomPac(B.pacientes.find((p) => p.id === x.paciente_id)), x.procedimiento, med(x.cirujano_id), med(x.anestesiologo_id), x.duracion_min, `¤${x.estado}`], attr: `data-q="${x.id}"` })) });
    function pintar() {
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Cirugías programadas', qx.filter((x) => x.estado === 'PROGRAMADA').length)}${kpi('Realizadas', qx.filter((x) => x.estado === 'REALIZADA').length, 'ec-fin')}${kpi('Horas de sala', (sum(qx.filter((x) => x.estado !== 'CANCELADA').map((x) => x.duracion_min)) / 60).toFixed(1))}</div>
        ${ctx.admin ? `<form class="pf-modform hos-qx" novalidate><label class="campo"><span>Sala</span><input name="sala" value="SALA 1"></label><label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${hoy()}"></label><label class="campo"><span>Hora</span><input type="time" name="hora" value="07:00"></label><label class="campo"><span>Duración min</span><input type="number" name="dur" value="90"></label><label class="campo sat-ancho"><span>Paciente *</span><input name="paciente" list="hos-pacs3" autocomplete="off"></label><label class="campo"><span>Cirujano</span><select name="cir">${opt(B.medicos, '', 'id', (m) => m.nombre)}</select></label><label class="campo"><span>Anestesiólogo</span><select name="anes">${opt(B.medicos, '', 'id', (m) => m.nombre)}</select></label><label class="campo pf-just"><span>Procedimiento *</span><input name="proc"></label><button type="submit" class="boton primario-sm"><i class="ti ti-plus" aria-hidden="true"></i> Programar</button><p class="modal-error tk-error" role="alert"></p></form><datalist id="hos-pacs3">${B.pacientes.map((p) => `<option value="${esc(nomPac(p))}"></option>`).join('')}</datalist>` : ''}
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> El sistema avisa si la sala ya está ocupada en ese horario. Toca una cirugía para marcarla en curso, realizada o cancelada.</p>${tabla(cfg(), false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); if (['desde', 'hasta'].includes(e.target.name) && e.target.closest('.bk-filtros')) { f[e.target.name] = e.target.value; cargar(); } });
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('.hos-qx')) return; e.preventDefault(); const el = e.target.elements;
      const p = B.pacientes.find((x) => nomPac(x) === el.paciente.value.trim()); if (!p || !el.proc.value.trim()) { e.target.querySelector('.modal-error').textContent = 'Elige el paciente y escribe el procedimiento.'; return; }
      const ini = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5)), a = ini(el.hora.value), b = a + (Number(el.dur.value) || 60);
      const choque = qx.find((x) => x.sala === el.sala.value.trim().toUpperCase() && x.fecha === el.fecha.value && x.estado !== 'CANCELADA' && ini(String(x.hora)) < b && ini(String(x.hora)) + x.duracion_min > a);
      if (choque && !confirm('La sala ya está programada en ese horario. ¿Programar de todos modos?')) return;
      const adm = (await sb.from('hos_admisiones').select('id').eq('paciente_id', p.id).eq('estado', 'ABIERTA').maybeSingle()).data;
      const { error } = await sb.from('hos_quirofanos').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, sala: el.sala.value.trim().toUpperCase(), fecha: el.fecha.value, hora: el.hora.value, duracion_min: Number(el.dur.value) || 60, paciente_id: p.id, admision_id: adm?.id || null, cirujano_id: Number(el.cir.value) || null, anestesiologo_id: Number(el.anes.value) || null, procedimiento: el.proc.value.trim().toUpperCase(), usuario: (window.FIN.perfil()?.usuario || '').toUpperCase() });
      if (error) { e.target.querySelector('.modal-error').textContent = window.UI.traducirError(error); return; }
      cargar();
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      const tr = e.target.closest('tr[data-q]'); if (!tr || !ctx.admin) return;
      const v = (prompt('Nuevo estado (EN CURSO, REALIZADA, CANCELADA):', 'REALIZADA') || '').trim().toUpperCase(); if (!['EN CURSO', 'REALIZADA', 'CANCELADA', 'PROGRAMADA'].includes(v)) return;
      await sb.from('hos_quirofanos').update({ estado: v }).eq('id', Number(tr.dataset.q)); cargar();
    });
    iniciar();
  };

  // ===================== Censo diario y día-cama =====================
  window.PANTALLAS['hos-censo'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Censo diario y día-cama', icono: 'ti-bed', clase: 'bk-movimientos bm-solo cx-rep pr-rep hos-censo', grupo: 'Hospital · Procesos' });
    const { sb } = ctx;
    let B = null, ads = [];
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-bed'); return; }
      try { B = await baseHospital(ctx); } catch (e) { return faltaScript(ctx, e); }
      ads = (await sb.from('hos_admisiones').select('*').eq('localidad_id', ctx.sel.loc).eq('estado', 'ABIERTA')).data || [];
      ctx.filtros('', `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="diacama"><i class="ti ti-calendar-dollar" aria-hidden="true"></i> Cargar día-cama a hoy</button>' : ''}${botonesExp}`);
      pintar();
    }
    const camas = () => B.camas.filter((c) => c.activo);
    const cfg = () => ({ titulo: `Censo hospitalario · ${fmt.fechaDia(hoy())}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Censo', archivo: `censo_${hoy()}`, parametros: [`Empresa: ${empresaDe(ctx)}`],
      columnas: [col('Área', 'texto', 18), col('Cama', 'texto', 8), col('Tipo', 'texto', 12), col('Estado', 'texto', 13), col('Paciente', 'texto', 30), col('Ingreso', 'texto', 15), col('Días', 'entero', 6), col('Médico', 'texto', 24), col('Cargos Q', 'monto', 13)],
      filas: camas().map((c) => { const a = ads.find((x) => x.cama_id === c.id); return { valores: [B.areas.find((x) => x.id === c.area_id)?.nombre || '', c.codigo, c.tipo, `¤${c.estado}`, a ? nomPac(B.pacientes.find((p) => p.id === a.paciente_id)) : '', a ? horaGt(a.fecha_ingreso) : '', a ? dias(diaGt(a.fecha_ingreso), hoy()) : '', a ? B.medicos.find((m) => m.id === a.medico_id)?.nombre || '' : '', a ? r2(a.total_cargos) : ''], attr: `data-cama="${c.id}"` }; }) });
    function pintar() {
      const cs = camas(), oc = cs.filter((c) => c.estado === 'OCUPADA').length;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Camas', cs.length)}${kpi('Ocupadas', oc)}${kpi('Disponibles', cs.filter((c) => c.estado === 'DISPONIBLE').length, 'ec-fin')}${kpi('En limpieza', cs.filter((c) => c.estado === 'LIMPIEZA').length)}${kpi('Ocupación', cs.length ? `${((oc / cs.length) * 100).toFixed(1)} %` : '—', oc / (cs.length || 1) > 0.85 ? 'ec-alerta' : '')}</div>
        <div class="hos-mapa">${B.areas.map((ar) => { const xs = cs.filter((c) => c.area_id === ar.id); return xs.length ? `<section><h4>${esc(ar.nombre)}</h4><div>${xs.map((c) => { const a = ads.find((x) => x.cama_id === c.id); return `<button type="button" class="hos-cama hos-${c.estado.toLowerCase()}" data-cama="${c.id}" title="${esc(a ? nomPac(B.pacientes.find((p) => p.id === a.paciente_id)) : c.estado)}"><b>${esc(c.codigo)}</b><small>${a ? esc(B.pacientes.find((p) => p.id === a.paciente_id)?.apellidos || '') : esc(c.estado)}</small></button>`; }).join('')}</div></section>` : ''; }).join('') || '<p class="tk-tenue">Registra las camas en Catálogos › Áreas, habitaciones y camas.</p>'}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> «Cargar día-cama a hoy» agrega a cada paciente internado los días de habitación pendientes (tarifa de su cama). Toca una cama en limpieza o mantenimiento para dejarla disponible.</p>${tabla(cfg(), false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') cargar(); });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      if (e.target.closest('[data-accion="diacama"]')) { const { data, error } = await sb.rpc('hos_cargar_dias_cama', { p_localidad: ctx.sel.loc, p_fecha: hoy() }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); window.FIN.aviso(`${data} día(s)-cama cargado(s)`); return cargar(); }
      const b = e.target.closest('[data-cama]'); if (!b || !ctx.admin) return;
      const c = B.camas.find((x) => String(x.id) === b.dataset.cama); if (c.estado === 'OCUPADA') return;
      const v = (prompt(`Cama ${c.codigo} (${c.estado}). Nuevo estado: DISPONIBLE, LIMPIEZA o MANTENIMIENTO`, 'DISPONIBLE') || '').trim().toUpperCase(); if (!['DISPONIBLE', 'LIMPIEZA', 'MANTENIMIENTO'].includes(v)) return;
      await sb.from('hos_camas').update({ estado: v }).eq('id', c.id); cargar();
    });
    iniciar();
  };

  // ===================== Egreso y facturación =====================
  window.PANTALLAS['hos-egreso'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Egreso y facturación', icono: 'ti-door-exit', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Hospital · Procesos' });
    const { sb } = ctx;
    let B = null, ads = [], ver = 'ABIERTA';
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-door-exit'); return; }
      try { B = await baseHospital(ctx); } catch (e) { return faltaScript(ctx, e); }
      ads = (await sb.from('hos_admisiones').select('*').eq('localidad_id', ctx.sel.loc).eq('estado', ver).order('numero', { ascending: false }).limit(300)).data || [];
      ctx.filtros(`<label class="campo"><span>Mostrar</span><select name="ver">${[['ABIERTA', 'Por egresar'], ['EGRESADA', 'Por facturar'], ['FACTURADA', 'Facturadas']].map(([v, t]) => `<option value="${v}" ${ver === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`, botonesExp);
      pintar();
    }
    const cfg = () => ({ titulo: `Egresos · ${ver.toLowerCase()}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Egresos', archivo: 'egresos', parametros: [`Empresa: ${empresaDe(ctx)}`],
      columnas: [col('No.', 'entero', 6), col('Paciente', 'texto', 30), col('Ingreso', 'texto', 15), col('Egreso', 'texto', 15), col('Aseguradora', 'texto', 20), col('Cargos Q', 'monto', 13), col('Aseguradora Q', 'monto', 13), col('Paciente Q', 'monto', 13), col('Pagado Q', 'monto', 12), col('Saldo Q', 'monto', 12), col('Facturas', 'texto', 22)],
      filas: ads.map((a) => ({ valores: [a.numero, nomPac(B.pacientes.find((p) => p.id === a.paciente_id)), horaGt(a.fecha_ingreso), horaGt(a.fecha_egreso), B.aseguradoras.find((x) => x.id === a.aseguradora_id)?.nombre || 'PARTICULAR', r2(a.total_cargos), r2(a.parte_aseguradora), r2(a.estado === 'ABIERTA' ? a.total_cargos : a.parte_paciente), r2(a.total_pagos), r2((a.estado === 'ABIERTA' ? a.total_cargos : a.parte_paciente) - a.total_pagos), [a.factura_paciente, a.factura_aseguradora].filter(Boolean).join(' / ')], attr: `data-a="${a.id}"` })) });
    function pintar() {
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Admisiones', ads.length)}${kpi('Cargos', q(sum(ads.map((a) => a.total_cargos))))}${kpi('Por cobrar a pacientes', q(sum(ads.map((a) => (a.estado === 'ABIERTA' ? a.total_cargos : a.parte_paciente) - a.total_pagos))), 'ec-alerta')}${kpi('Por cobrar a aseguradoras', q(sum(ads.map((a) => a.parte_aseguradora))))}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> ${ver === 'ABIERTA' ? 'Toca una admisión para egresar al paciente: se cargan los días-cama pendientes, se libera la cama y se divide la cuenta entre la aseguradora y el paciente (deducible + coaseguro); se genera el reclamo a la aseguradora.' : ver === 'EGRESADA' ? 'Emite las facturas FEL en Facturación/Ventas › Facturas Ventas con el estado de cuenta (paciente y aseguradora) y toca la admisión para registrar sus números.' : 'Admisiones cerradas con sus facturas.'}</p>${tabla(cfg(), false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); if (e.target.name === 'ver' && e.target.closest('.bk-filtros')) { ver = e.target.value; cargar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      const tr = e.target.closest('tr[data-a]'); if (!tr || !ctx.admin) return;
      const a = ads.find((x) => String(x.id) === tr.dataset.a);
      if (a.estado === 'ABIERTA') {
        const tipo = (prompt(`Egreso de la admisión ${a.numero}. Tipo: ALTA MÉDICA, ALTA VOLUNTARIA, TRASLADO o DEFUNCIÓN`, 'ALTA MÉDICA') || '').trim().toUpperCase(); if (!['ALTA MÉDICA', 'ALTA VOLUNTARIA', 'TRASLADO', 'DEFUNCIÓN'].includes(tipo)) return;
        const diag = prompt('Diagnóstico de egreso:', a.diagnostico_ingreso || '') ?? '';
        const { data, error } = await sb.rpc('hos_egresar', { p_id: a.id, p_fecha: new Date().toISOString(), p_tipo: tipo, p_diagnostico: diag });
        if (error) return window.FIN.aviso(window.UI.traducirError(error));
        window.FIN.aviso(`Egresado · total ${q(data.total)} · aseguradora ${q(data.aseguradora)} · paciente ${q(data.paciente)} · saldo ${q(data.saldo_paciente)}`); return cargar();
      }
      if (a.estado === 'EGRESADA') {
        const fp = prompt('Número de la factura FEL al paciente (serie-número):', ''); if (fp == null) return;
        const fa = num(a.parte_aseguradora) > 0 ? prompt('Número de la factura FEL a la aseguradora:', '') : '';
        const { error } = await sb.rpc('hos_facturar', { p_id: a.id, p_factura_paciente: fp, p_factura_aseguradora: fa || '' }); if (error) return window.FIN.aviso(window.UI.traducirError(error));
        window.FIN.aviso('Admisión facturada'); return cargar();
      }
    });
    iniciar();
  };

  // ===================== Honorarios, reclamos y caja =====================
  window.PANTALLAS['hos-honorarios'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Liquidación de honorarios médicos', icono: 'ti-cash', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Hospital · Procesos' });
    const { sb } = ctx;
    const d = new Date(); const f = { desde: new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA'), hasta: hoy() };
    let B = null, liqs = [], pend = [];
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-cash'); return; }
      try { B = await baseHospital(ctx); } catch (e) { return faltaScript(ctx, e); }
      const [l, p] = await Promise.all([sb.from('hos_honorarios').select('*').eq('localidad_id', ctx.sel.loc).order('numero', { ascending: false }).limit(200), leerTodo(() => sb.from('hos_cargos').select('id, medico_id, total, fecha, hos_admisiones!inner(localidad_id, estado)').eq('hos_admisiones.localidad_id', ctx.sel.loc).neq('hos_admisiones.estado', 'ANULADA').eq('tipo', 'HONORARIO').is('honorario_liq_id', null).gte('fecha', f.desde).lte('fecha', f.hasta).order('id'))]);
      liqs = l.data || []; pend = p;
      ctx.filtros(`<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}"></label>`, botonesExp);
      pintar();
    }
    const med = (i) => B.medicos.find((m) => m.id === i);
    const cfg = () => ({ titulo: 'Liquidaciones de honorarios médicos', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Honorarios', archivo: 'honorarios', parametros: [`Empresa: ${empresaDe(ctx)}`],
      columnas: [col('No.', 'entero', 6), col('Médico', 'texto', 30), col('Período', 'texto', 22), col('Bruto Q', 'monto', 13), col('Participación hospital Q', 'monto', 15), col('Retención ISR Q', 'monto', 13), col('Líquido Q', 'monto', 13), col('Estado', 'texto', 11)],
      filas: liqs.map((x) => ({ valores: [x.numero, med(x.medico_id)?.nombre || '', `${fmt.fechaDia(x.desde)} al ${fmt.fechaDia(x.hasta)}`, r2(x.bruto), r2(x.participacion_hospital), r2(x.retencion_isr), r2(x.liquido), `¤${x.estado}`], attr: `data-h="${x.id}"` })) });
    function pintar() {
      const porM = new Map(); pend.forEach((c) => porM.set(c.medico_id, (porM.get(c.medico_id) || 0) + num(c.total)));
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Honorarios pendientes', q(sum([...porM.values()])))}${kpi('Médicos con pendientes', porM.size)}${kpi('Liquidaciones por pagar', liqs.filter((x) => x.estado === 'CALCULADA').length)}</div>
        <div class="cl-banda">Pendientes de liquidar del período</div>${tabla({ columnas: [col('Médico', 'texto'), col('Honorarios Q', 'monto'), col('% hospital', 'numero'), col('% ret. ISR', 'numero'), col('', 'texto')], filas: [...porM.entries()].map(([i, v]) => ({ valores: [med(i)?.nombre || '(sin médico)', r2(v), num(med(i)?.pct_hospital), num(med(i)?.retencion_isr_pct), ctx.admin && i ? 'Toca para liquidar' : ''], attr: i ? `data-m="${i}"` : '' })), vacio: 'Sin honorarios pendientes en el período.' }, false)}
        <div class="cl-banda">Liquidaciones</div><p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Líquido = honorarios − participación del hospital − retención de ISR (sobre lo que corresponde al médico). Toca una liquidación calculada para registrar su pago.</p>${tabla(cfg(), false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); if (['desde', 'hasta'].includes(e.target.name) && e.target.closest('.bk-filtros')) { f[e.target.name] = e.target.value; cargar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      if (!ctx.admin) return;
      const trm = e.target.closest('tr[data-m]');
      if (trm) { const m = med(Number(trm.dataset.m)); if (!confirm(`¿Liquidar los honorarios de ${m.nombre} del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}?`)) return; const { error } = await sb.rpc('hos_liquidar_honorarios', { p_localidad: ctx.sel.loc, p_medico: m.id, p_desde: f.desde, p_hasta: f.hasta }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); window.FIN.aviso('Honorarios liquidados'); return cargar(); }
      const trh = e.target.closest('tr[data-h]');
      if (trh) { const x = liqs.find((y) => String(y.id) === trh.dataset.h); if (x.estado !== 'CALCULADA') return; const ref = prompt(`Pago de la liquidación ${x.numero} (${q(x.liquido)}). Cheque o transferencia:`, ''); if (ref == null) return; await sb.from('hos_honorarios').update({ estado: 'PAGADA', referencia_pago: ref.trim() || null }).eq('id', x.id); cargar(); }
    });
    iniciar();
  };
  window.PANTALLAS['hos-reclamos'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Reclamos a aseguradoras', icono: 'ti-file-certificate', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Hospital · Procesos' });
    const { sb } = ctx;
    let B = null, rs = [], ver = 'PENDIENTES';
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-file-certificate'); return; }
      try { B = await baseHospital(ctx); } catch (e) { return faltaScript(ctx, e); }
      let qy = sb.from('hos_reclamos').select('*, hos_admisiones(numero, paciente_id)').eq('localidad_id', ctx.sel.loc).order('numero', { ascending: false }).limit(500);
      if (ver === 'PENDIENTES') qy = qy.in('estado', ['PRESENTADO', 'EN REVISIÓN', 'APROBADO', 'PARCIAL']);
      rs = (await qy).data || [];
      ctx.filtros(`<label class="campo"><span>Mostrar</span><select name="ver">${['PENDIENTES', 'TODOS'].map((x) => `<option ${ver === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`, botonesExp);
      pintar();
    }
    const cfg = () => ({ titulo: 'Reclamos a aseguradoras', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Reclamos', archivo: 'reclamos', parametros: [`Empresa: ${empresaDe(ctx)}`],
      columnas: [col('No.', 'entero', 6), col('Fecha', 'texto', 11), col('Aseguradora', 'texto', 24), col('Admisión', 'texto', 8), col('Paciente', 'texto', 28), col('Reclamado Q', 'monto', 13), col('Aprobado Q', 'monto', 13), col('Pagado Q', 'monto', 13), col('Pendiente Q', 'monto', 13), col('Días', 'entero', 6), col('Estado', 'texto', 12)],
      filas: rs.map((r) => ({ valores: [r.numero, fmt.fechaDia(r.fecha), B.aseguradoras.find((a) => a.id === r.aseguradora_id)?.nombre || '', String(r.hos_admisiones?.numero ?? ''), nomPac(B.pacientes.find((p) => p.id === r.hos_admisiones?.paciente_id)), r2(r.monto), r.monto_aprobado == null ? '' : r2(r.monto_aprobado), r2(r.monto_pagado), r2((r.monto_aprobado ?? r.monto) - r.monto_pagado), dias(r.fecha, hoy()), `¤${r.estado}`], attr: `data-r="${r.id}"`, resaltar: dias(r.fecha, hoy()) > 90 && !['PAGADO', 'RECHAZADO'].includes(r.estado) })) });
    function pintar() {
      const pend = rs.filter((r) => !['PAGADO', 'RECHAZADO'].includes(r.estado));
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Reclamos pendientes', pend.length)}${kpi('Por cobrar', q(sum(pend.map((r) => (r.monto_aprobado ?? r.monto) - r.monto_pagado))), 'ec-alerta')}${kpi('Más de 90 días', pend.filter((r) => dias(r.fecha, hoy()) > 90).length)}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Los reclamos se generan al egresar a un paciente asegurado. Toca uno para registrar su avance: en revisión, aprobado (con el monto aprobado), pagado (con el monto y la fecha) o rechazado.</p>${tabla(cfg(), false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); if (e.target.name === 'ver' && e.target.closest('.bk-filtros')) { ver = e.target.value; cargar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      const tr = e.target.closest('tr[data-r]'); if (!tr || !ctx.admin) return;
      const r = rs.find((x) => String(x.id) === tr.dataset.r);
      const est = (prompt(`Reclamo ${r.numero}. Nuevo estado: EN REVISIÓN, APROBADO, PAGADO, PARCIAL o RECHAZADO`, r.estado === 'PRESENTADO' ? 'EN REVISIÓN' : 'PAGADO') || '').trim().toUpperCase().replace('REVISION', 'REVISIÓN'); if (!['EN REVISIÓN', 'APROBADO', 'PAGADO', 'PARCIAL', 'RECHAZADO'].includes(est)) return;
      const v = { estado: est };
      if (est === 'APROBADO') { const m = prompt('Monto aprobado (Q):', String(r.monto)); if (m == null) return; v.monto_aprobado = num(m); }
      if (est === 'PAGADO' || est === 'PARCIAL') { const m = prompt('Monto pagado acumulado (Q):', String(r.monto_aprobado ?? r.monto)); if (m == null) return; v.monto_pagado = num(m); v.fecha_pago = hoy(); }
      if (est === 'RECHAZADO') { const m = prompt('Motivo del rechazo:', ''); if (!m) return; v.observaciones = m; }
      await sb.from('hos_reclamos').update(v).eq('id', r.id); cargar();
    });
    iniciar();
  };
  window.PANTALLAS['hos-caja'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Cierre de caja hospitalaria', icono: 'ti-cash-register', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Hospital · Procesos' });
    const { sb } = ctx;
    const f = { fecha: hoy() };
    let pagos = [], cierre = null, B = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-cash-register'); return; }
      try { B = await baseHospital(ctx); } catch (e) { return faltaScript(ctx, e); }
      const [p, c] = await Promise.all([sb.from('hos_pagos').select('*, hos_admisiones(numero, paciente_id)').eq('localidad_id', ctx.sel.loc).eq('fecha', f.fecha).order('id'), sb.from('hos_cierres_caja').select('*').eq('localidad_id', ctx.sel.loc).eq('fecha', f.fecha).maybeSingle()]);
      pagos = p.data || []; cierre = c.data;
      ctx.filtros(`<label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${f.fecha}"></label>`, `${ctx.admin && !cierre ? '<button type="button" class="boton primario-sm" data-accion="cerrar"><i class="ti ti-lock" aria-hidden="true"></i> Cerrar caja</button>' : ''}${botonesExp}`);
      pintar();
    }
    const tot = (forma) => sum(pagos.filter((x) => x.forma === forma).map((x) => (x.tipo === 'DEVOLUCIÓN' ? -x.monto : x.monto)));
    const cfg = () => ({ titulo: `Cierre de caja hospitalaria · ${fmt.fechaDia(f.fecha)}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Caja', archivo: `caja_${f.fecha}`, firmas: ['Cajero', 'Supervisor'], parametros: [`Empresa: ${empresaDe(ctx)}`, cierre ? `Cerrada por ${cierre.usuario}` : 'Caja abierta'],
      columnas: [col('Admisión', 'texto', 9), col('Paciente', 'texto', 30), col('Tipo', 'texto', 12), col('Forma', 'texto', 14), col('Referencia', 'texto', 18), col('Monto Q', 'monto', 13)],
      filas: [...pagos.map((x) => ({ valores: [String(x.hos_admisiones?.numero ?? ''), nomPac(B.pacientes.find((p) => p.id === x.hos_admisiones?.paciente_id)), x.tipo, x.forma, x.referencia || '', r2(x.tipo === 'DEVOLUCIÓN' ? -x.monto : x.monto)] })), ...['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE', 'DEPÓSITO'].map((fo) => ({ valores: [`Total ${fo.toLowerCase()}`, '', '', '', '', r2(tot(fo))], tipo: 'subtotal' })), { valores: ['TOTAL DEL DÍA', '', '', '', '', r2(sum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE', 'DEPÓSITO'].map(tot)))], tipo: 'total' }] });
    function pintar() {
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Efectivo', q(tot('EFECTIVO')))}${kpi('Tarjeta', q(tot('TARJETA')))}${kpi('Transferencias y depósitos', q(tot('TRANSFERENCIA') + tot('DEPÓSITO')))}${kpi('Cheques', q(tot('CHEQUE')))}${kpi('Total del día', q(sum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE', 'DEPÓSITO'].map(tot))), 'ec-fin')}${cierre ? kpi('Diferencia de efectivo', q(cierre.diferencia), num(cierre.diferencia) ? 'ec-alerta' : 'ec-fin') : ''}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Pagos del día registrados en Cuenta del paciente. «Cerrar caja» pide el efectivo contado y guarda la diferencia (arqueo).</p>${tabla(cfg(), false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); if (e.target.name === 'fecha' && e.target.closest('.bk-filtros')) { f.fecha = e.target.value; cargar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      if (!e.target.closest('[data-accion="cerrar"]')) return;
      const cont0 = prompt(`Efectivo contado en caja (sistema: ${q(tot('EFECTIVO'))}):`, String(r2(tot('EFECTIVO')))); if (cont0 == null) return;
      const v = { organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, fecha: f.fecha, usuario: (window.FIN.perfil()?.usuario || '').toUpperCase(), efectivo: r2(tot('EFECTIVO')), tarjeta: r2(tot('TARJETA')), transferencia: r2(tot('TRANSFERENCIA')), cheque: r2(tot('CHEQUE')), deposito: r2(tot('DEPÓSITO')), total: r2(sum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE', 'DEPÓSITO'].map(tot))), efectivo_contado: num(cont0), diferencia: r2(num(cont0) - tot('EFECTIVO')) };
      const { error } = await sb.from('hos_cierres_caja').insert(v); if (error) return window.FIN.aviso(window.UI.traducirError(error));
      window.FIN.aviso(`Caja cerrada · diferencia ${q(v.diferencia)}`); cargar();
    });
    iniciar();
  };

  // ===================== Reportes =====================
  const DEF = { 'hos-rep-ocupacion': 'Censo y ocupación', 'hos-rep-ingresos': 'Ingresos por servicio y médico', 'hos-rep-cuentas': 'Cuentas abiertas de pacientes', 'hos-rep-cartera': 'Cartera de aseguradoras', 'hos-rep-indicadores': 'Indicadores hospitalarios' };
  function reporte(cont, id) {
    const ctx = montar(cont, { titulo: DEF[id], icono: 'ti-report-medical', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Hospital · Reportes' });
    const { sb } = ctx;
    const d = new Date(); const f = { desde: new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA'), hasta: hoy(), graficas: true };
    let cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-report-medical'); return; }
      const periodo = !['hos-rep-cuentas', 'hos-rep-cartera'].includes(id);
      ctx.filtros(`${periodo ? `<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}"></label>` : ''}<label class="pc-check"><input type="checkbox" name="graficas" ${f.graficas ? 'checked' : ''}> Gráficas</label>`, botonesExp);
      ctx.pDet.innerHTML = '<p class="vacio">Calculando…</p>';
      try { cfg = await construir(); } catch (e) { return faltaScript(ctx, e); }
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="cl-banda">${esc(cfg.titulo)} · ${esc(cfg.parametros.join(' · '))}</div>${cfg.kpis ? `<div class="ec-kpis">${cfg.kpis.map(([t, v, c]) => kpi(t, v, c)).join('')}</div>` : ''}${tabla(cfg, f.graficas)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    async function construir() {
      const B = await baseHospital(ctx), loc = ctx.sel.loc;
      const base = { titulo: DEF[id], orgId: ctx.sel.org, locId: loc, hoja: DEF[id].slice(0, 30), archivo: id, parametros: [`Empresa: ${empresaDe(ctx)}`, ...(['hos-rep-cuentas', 'hos-rep-cartera'].includes(id) ? [`Al ${fmt.fechaDia(hoy())}`] : [`Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`])] };
      const ads = await leerTodo(() => sb.from('hos_admisiones').select('*').eq('localidad_id', loc).neq('estado', 'ANULADA').order('id'));
      const camas = B.camas.filter((c) => c.activo), nDias = dias(f.desde, f.hasta) + 1;
      // Días-cama ocupados en el período (por admisión con cama).
      const diasOcup = (a) => { if (!a.cama_id) return 0; const i = diaGt(a.fecha_ingreso) > f.desde ? diaGt(a.fecha_ingreso) : f.desde; const e = a.fecha_egreso ? diaGt(a.fecha_egreso) : hoy(); const fin = e < f.hasta ? e : f.hasta; return fin < i ? 0 : dias(i, fin) + (a.fecha_egreso && diaGt(a.fecha_egreso) <= f.hasta ? 0 : 1); };
      if (id === 'hos-rep-ocupacion') {
        const filas = B.areas.map((ar) => { const cs = camas.filter((c) => c.area_id === ar.id); const oc = sum(ads.filter((a) => cs.some((c) => c.id === a.cama_id)).map(diasOcup)); const disp = cs.length * nDias; return { valores: [ar.nombre, cs.length, cs.filter((c) => c.estado === 'OCUPADA').length, oc, disp, disp ? oc / disp : 0] }; }).filter((r) => r.valores[1]);
        const oc = sum(filas.map((r) => r.valores[3])), disp = sum(filas.map((r) => r.valores[4]));
        filas.push({ valores: ['Total', camas.length, camas.filter((c) => c.estado === 'OCUPADA').length, oc, disp, disp ? oc / disp : 0], tipo: 'total' });
        return { ...base, filas, columnas: [col('Área', 'texto', 26), col('Camas', 'entero', 8), col('Ocupadas hoy', 'entero', 11), col('Días-cama ocupados', 'entero', 14), col('Días-cama disponibles', 'entero', 14), col('% ocupación', 'porcentaje', 11)], kpis: [['Ocupación del período', disp ? `${((oc / disp) * 100).toFixed(1)} %` : '—', 'ec-fin'], ['Camas ocupadas hoy', camas.filter((c) => c.estado === 'OCUPADA').length], ['Camas', camas.length]],
          graficas: [G().barras('% de ocupación por área', filas.filter((r) => !r.tipo).map((r) => ({ etiqueta: r.valores[0], valor: r.valores[5] * 100, texto: `${(r.valores[5] * 100).toFixed(1)} %` })))] };
      }
      if (id === 'hos-rep-ingresos') {
        const cs = await leerTodo(() => sb.from('hos_cargos').select('tipo, medico_id, total, fecha, hos_admisiones!inner(localidad_id, estado)').eq('hos_admisiones.localidad_id', loc).neq('hos_admisiones.estado', 'ANULADA').gte('fecha', f.desde).lte('fecha', f.hasta).order('id'));
        const tot = sum(cs.map((c) => c.total)), porT = new Map(), porM = new Map();
        cs.forEach((c) => { porT.set(c.tipo, (porT.get(c.tipo) || 0) + num(c.total)); if (c.medico_id) porM.set(c.medico_id, (porM.get(c.medico_id) || 0) + num(c.total)); });
        const filas = [{ valores: ['Por tipo de servicio'], tipo: 'grupo', combinar: true }, ...[...porT.entries()].sort((a, b) => b[1] - a[1]).map(([t, v]) => ({ valores: [t, r2(v), tot ? v / tot : 0] })), { valores: ['Total', r2(tot), tot ? 1 : 0], tipo: 'subtotal' }, { valores: ['Por médico (cargos asignados)'], tipo: 'grupo', combinar: true }, ...[...porM.entries()].sort((a, b) => b[1] - a[1]).map(([m, v]) => ({ valores: [B.medicos.find((x) => x.id === m)?.nombre || '', r2(v), tot ? v / tot : 0] }))];
        return { ...base, filas, columnas: [col('Concepto', 'texto', 40), col('Ingresos Q', 'monto', 16), col('%', 'porcentaje', 9)], kpis: [['Ingresos del período', q(tot), 'ec-fin'], ['Cargos', cs.length]],
          graficas: [G().barras('Ingresos por tipo de servicio (Q)', [...porT.entries()].map(([t, v]) => ({ etiqueta: t, valor: v, texto: q(v) })).sort((a, b) => b.valor - a.valor)), G().barras('Médicos con más ingresos (10)', [...porM.entries()].map(([m, v]) => ({ etiqueta: B.medicos.find((x) => x.id === m)?.nombre || '', valor: v, texto: q(v) })).sort((a, b) => b.valor - a.valor).slice(0, 10), G().COLORES.VERDE)] };
      }
      if (id === 'hos-rep-cuentas') {
        const ab = ads.filter((a) => ['ABIERTA', 'EGRESADA'].includes(a.estado));
        const filas = ab.map((a) => { const saldo = (a.estado === 'ABIERTA' ? a.total_cargos : a.parte_paciente) - a.total_pagos; return { valores: [a.numero, nomPac(B.pacientes.find((p) => p.id === a.paciente_id)), a.tipo, B.camas.find((c) => c.id === a.cama_id)?.codigo || '', dias(diaGt(a.fecha_ingreso), diaGt(a.fecha_egreso) || hoy()), B.aseguradoras.find((x) => x.id === a.aseguradora_id)?.nombre || 'PARTICULAR', r2(a.total_cargos), r2(a.total_pagos), r2(saldo), `¤${a.estado}`], resaltar: saldo > 0 && a.estado === 'EGRESADA' }; });
        filas.push({ valores: ['Total', '', '', '', '', '', r2(sum(ab.map((a) => a.total_cargos))), r2(sum(ab.map((a) => a.total_pagos))), r2(sum(ab.map((a) => (a.estado === 'ABIERTA' ? a.total_cargos : a.parte_paciente) - a.total_pagos))), ''], tipo: 'total' });
        return { ...base, filas, columnas: [col('No.', 'entero', 6), col('Paciente', 'texto', 30), col('Tipo', 'texto', 16), col('Cama', 'texto', 7), col('Días', 'entero', 6), col('Aseguradora', 'texto', 20), col('Cargos Q', 'monto', 13), col('Pagos Q', 'monto', 12), col('Saldo Q', 'monto', 13), col('Estado', 'texto', 11)], kpis: [['Cuentas abiertas', ab.length], ['Saldo por cobrar a pacientes', q(sum(ab.map((a) => (a.estado === 'ABIERTA' ? a.total_cargos : a.parte_paciente) - a.total_pagos))), 'ec-alerta']], vacio: 'No hay cuentas abiertas.' };
      }
      if (id === 'hos-rep-cartera') {
        const rs = (await sb.from('hos_reclamos').select('*').eq('localidad_id', loc).in('estado', ['PRESENTADO', 'EN REVISIÓN', 'APROBADO', 'PARCIAL'])).data || [];
        const B5 = [['0-30', (x) => x <= 30], ['31-60', (x) => x > 30 && x <= 60], ['61-90', (x) => x > 60 && x <= 90], ['Más de 90', (x) => x > 90]];
        const sal = (r) => num(r.monto_aprobado ?? r.monto) - num(r.monto_pagado);
        const filas = B.aseguradoras.map((a) => { const xs = rs.filter((r) => r.aseguradora_id === a.id); return { valores: [a.nombre, xs.length, ...B5.map(([, fn]) => r2(sum(xs.filter((r) => fn(dias(r.fecha, hoy()))).map(sal)))), r2(sum(xs.map(sal)))] }; }).filter((r) => r.valores[1]);
        filas.push({ valores: ['Total', rs.length, ...B5.map(([, fn]) => r2(sum(rs.filter((r) => fn(dias(r.fecha, hoy()))).map(sal)))), r2(sum(rs.map(sal)))], tipo: 'total' });
        return { ...base, filas, columnas: [col('Aseguradora', 'texto', 30), col('Reclamos', 'entero', 9), ...B5.map(([t]) => col(`${t} días`, 'monto', 13)), col('Saldo Q', 'monto', 14)], kpis: [['Cartera de aseguradoras', q(sum(rs.map(sal))), 'ec-fin'], ['Más de 90 días', q(sum(rs.filter((r) => dias(r.fecha, hoy()) > 90).map(sal))), 'ec-alerta']], vacio: 'No hay reclamos pendientes.',
          graficas: [G().barras('Antigüedad de la cartera (Q)', B5.map(([t, fn]) => ({ etiqueta: `${t} días`, valor: sum(rs.filter((r) => fn(dias(r.fecha, hoy()))).map(sal)) })))] };
      }
      // Indicadores hospitalarios.
      const egr = ads.filter((a) => a.fecha_egreso && diaGt(a.fecha_egreso) >= f.desde && diaGt(a.fecha_egreso) <= f.hasta);
      const ing = ads.filter((a) => diaGt(a.fecha_ingreso) >= f.desde && diaGt(a.fecha_ingreso) <= f.hasta);
      const oc = sum(ads.map(diasOcup)), disp = camas.length * nDias;
      const estancia = egr.filter((a) => a.cama_id).map((a) => Math.max(1, dias(diaGt(a.fecha_ingreso), diaGt(a.fecha_egreso))));
      const I = [['% de ocupación', disp ? oc / disp : null, '%', 'Días-cama ocupados ÷ días-cama disponibles', '75 % – 85 %'], ['Promedio de días de estancia', estancia.length ? sum(estancia) / estancia.length : null, 'días', 'Días de estancia de los egresos ÷ egresos', '3 – 5 días'],
        ['Giro de cama', camas.length ? egr.filter((a) => a.cama_id).length / camas.length : null, 'veces', 'Egresos ÷ camas', ''], ['Intervalo de sustitución', egr.length ? (disp - oc) / Math.max(1, egr.filter((a) => a.cama_id).length) : null, 'días', 'Días-cama vacíos ÷ egresos', '< 1 día'],
        ['Ingreso promedio por egreso', egr.length ? sum(egr.map((a) => a.total_cargos)) / egr.length : null, 'Q', 'Cargos de los egresos ÷ egresos', ''], ['Tasa de mortalidad', egr.length ? egr.filter((a) => a.tipo_egreso === 'DEFUNCIÓN').length / egr.length : null, '%', 'Defunciones ÷ egresos', '< 3 %'],
        ['Admisiones del período', ing.length, 'n', '', ''], ['Egresos del período', egr.length, 'n', '', ''], ['Pacientes con seguro', ing.length ? ing.filter((a) => a.aseguradora_id).length / ing.length : null, '%', 'Admisiones aseguradas ÷ admisiones', '']];
      const t = (v, u) => (v == null ? '—' : u === '%' ? `${(v * 100).toFixed(1)} %` : u === 'Q' ? q(v) : u === 'n' ? String(v) : `${v.toFixed(2)} ${u}`);
      return { ...base, filas: I.map(([n, v, u, fo, re]) => ({ valores: [n, t(v, u), fo, re] })), columnas: [col('Indicador', 'texto', 32), col('Resultado', 'texto', 16), col('Fórmula', 'texto', 44), col('Referencia', 'texto', 14)], kpis: [['% ocupación', t(I[0][1], '%'), 'ec-fin'], ['Estancia promedio', t(I[1][1], 'días')], ['Egresos', egr.length], ['Ingreso por egreso', t(I[4][1], 'Q')]],
        graficas: [G().columnas('Admisiones y egresos por día', [...new Set([...ing.map((a) => diaGt(a.fecha_ingreso)), ...egr.map((a) => diaGt(a.fecha_egreso))])].sort().map((x) => x.slice(8)), [{ nombre: 'Admisiones', color: G().COLORES.AZUL, valores: [...new Set([...ing.map((a) => diaGt(a.fecha_ingreso)), ...egr.map((a) => diaGt(a.fecha_egreso))])].sort().map((x) => ing.filter((a) => diaGt(a.fecha_ingreso) === x).length) }, { nombre: 'Egresos', color: G().COLORES.VERDE, valores: [...new Set([...ing.map((a) => diaGt(a.fecha_ingreso)), ...egr.map((a) => diaGt(a.fecha_egreso))])].sort().map((x) => egr.filter((a) => diaGt(a.fecha_egreso) === x).length) }])] };
    }
    cont.addEventListener('change', (e) => { const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar(); const n = e.target.name; if (['desde', 'hasta'].includes(n)) { f[n] = e.target.value || f[n]; return cargar(); } if (n === 'graficas') { f.graficas = e.target.checked; return cargar(); } });
    cont.addEventListener('click', (e) => { const ex = e.target.closest('[data-exp]'); if (ex) exportar(cfg, ex.dataset.exp, f.graficas); });
    iniciar();
  }
  Object.keys(DEF).forEach((k) => { window.PANTALLAS[k] = (cont) => reporte(cont, k); });
})();
