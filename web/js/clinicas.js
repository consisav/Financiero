// Clínicas médicas (script 159): consulta externa. Comparte con Hospital pacientes, médicos, especialidades y
// aseguradoras. Catálogos (médicos y horarios, consultorios, servicios, tarifas y paquetes, CIE-10, vademécum y
// plantillas), registros (expediente, agenda, recepción, consulta SOAP, órdenes, constancias, cobro), procesos
// (confirmación y lista de espera, paquetes, caja, honorarios, reclamos, integración contable) y reportes.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const q = (n) => `Q ${fmt.monto(n)}`;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const G = () => window.GRAFICAS;
  const hoy = () => fmt.hoy();
  const sumarDias = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const diaGt = (v) => (v ? new Date(v).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }) : '');
  const horaGt = (v) => (v ? new Date(v).toLocaleTimeString('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit', hour12: false }) : '');
  const minutos = (a, b) => (a && b ? Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000)) : null);
  const edad = (fn, al = hoy()) => { if (!fn) return null; const a = new Date(`${fn}T12:00:00`), b = new Date(`${al}T12:00:00`); let e = b.getFullYear() - a.getFullYear(); if (b < new Date(b.getFullYear(), a.getMonth(), a.getDate())) e--; return e; };
  const diaSemana = (d) => { const x = new Date(`${d}T12:00:00`).getDay(); return x === 0 ? 7 : x; };
  const hm = (t) => String(t || '').slice(0, 5);
  const aMin = (t) => { const [h, m] = hm(t).split(':').map(Number); return h * 60 + m; };
  const deMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const empresaDe = (ctx) => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
  const errorTxt = (e) => window.UI.traducirError(e);
  const falta = (ctx, e) => { ctx.pDet.innerHTML = `<p class="vacio">${/cli_|hos_/.test(e?.message || '') ? 'Falta instalar el script 159 (Clínicas médicas) en Supabase.' : esc(errorTxt(e))}</p>`; };
  const CLS = { PROGRAMADA: 'editando', CONFIRMADA: 'editando', 'EN ESPERA': 'pendiente', 'EN CONSULTA': 'pendiente', ATENDIDA: 'aprobada', CANCELADA: 'anulada', 'NO ASISTIÓ': 'anulada', ABIERTA: 'editando', CERRADA: 'aprobada', ANULADA: 'anulada',
    PAGADO: 'aprobada', ANULADO: 'anulada', PENDIENTE: 'pendiente', REALIZADA: 'editando', 'CON RESULTADO': 'aprobada', ACTIVO: 'aprobada', AGOTADO: 'definitiva', VENCIDO: 'anulada', CALCULADA: 'pendiente', PAGADA: 'aprobada',
    PRESENTADO: 'pendiente', 'EN REVISIÓN': 'editando', APROBADO: 'editando', PARCIAL: 'pendiente', RECHAZADO: 'anulada', CUADRA: 'aprobada', DIFERENCIA: 'anulada', 'SIN CUENTA': 'definitiva', GENERADA: 'aprobada', 'EN ESPERA ': 'pendiente', AGENDADO: 'aprobada', DESCARTADO: 'anulada' };
  const marca = (e) => `<span class="pc-marca ${CLS[e] || ''}">${esc(e)}</span>`;
  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) { const { data, error } = await hacer().range(i, i + 999); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; }
    return out;
  }
  const botonesExp = '<button type="button" class="boton secundario-sm" data-exp="PDF"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button><button type="button" class="boton secundario-sm" data-exp="EXCEL"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>';
  function tabla(c, graficas = true) {
    const n = c.columnas.length;
    const celda = (v, x) => (v === '' || v == null ? '<td></td>' : typeof v === 'number' ? `<td class="num${v < 0 ? ' pc-rojo' : ''}">${x.tipo === 'monto' ? fmt.monto(v) : x.tipo === 'porcentaje' ? `${(v * 100).toFixed(1)} %` : v.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</td>` : String(v).startsWith('¤') ? `<td>${marca(String(v).slice(1))}</td>` : `<td>${esc(String(v))}</td>`);
    const gs = graficas ? (c.graficas || []).filter(Boolean) : [];
    return `<div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${c.columnas.map((x) => `<th class="${x.tipo === 'texto' ? '' : 'num'}">${esc(x.titulo)}</th>`).join('')}${c.acciones ? '<th></th>' : ''}</tr></thead>
      <tbody>${c.filas.length ? c.filas.map((r) => (r.tipo === 'grupo' && r.combinar ? `<tr class="pr-g"><td colspan="${n + (c.acciones ? 1 : 0)}">${esc(r.valores[0])}</td></tr>` : `<tr class="${r.tipo === 'subtotal' ? 'pr-s' : r.tipo === 'total' ? 'pr-t' : r.tipo === 'grupo' ? 'pr-g' : ''}${r.resaltar ? ' pr-alerta' : ''}" ${r.attr || ''}>${c.columnas.map((x, i) => celda(r.valores[i], x)).join('')}${c.acciones ? `<td class="cli-acc">${r.acciones || ''}</td>` : ''}</tr>`)).join('') : `<tr><td colspan="${n + (c.acciones ? 1 : 0)}" class="tk-vacio">${esc(c.vacio || 'Sin información.')}</td></tr>`}</tbody></table>
      ${gs.length && c.filas.length ? `<section class="pr-graficas"><h3><i class="ti ti-chart-bar" aria-hidden="true"></i> Gráficas</h3>${gs.join('')}</section>` : ''}</div>`;
  }
  function exportar(c, formato, graficas = true) {
    if (!c || !c.filas.length) return window.FIN.aviso('No hay información para imprimir');
    const gs = graficas ? (c.graficas || []).filter(Boolean) : [];
    const s = { ...c, filas: c.filas.map((r) => ({ ...r, resaltar: r.resaltar ? 1 : undefined, valores: r.valores.map((v) => (typeof v === 'string' && v.startsWith('¤') ? v.slice(1) : v)) })) };
    if (formato === 'PDF') return window.CUENTAS_XLSX.pdf({ ...s, graficas: gs.join('') });
    Promise.all(gs.map((g) => G().png(g))).then((imagenes) => window.REPORTE_XLSX.generar({ ...s, imagenes })).catch((e) => window.FIN.aviso(e.message || 'No se pudo generar el Excel'));
  }
  const opt = (lst, sel, val, txt, vacio = '—') => `${vacio != null ? `<option value="">${vacio}</option>` : ''}${lst.map((x) => `<option value="${esc(String(x[val]))}" ${String(sel ?? '') === String(x[val]) ? 'selected' : ''}>${esc(txt(x))}</option>`).join('')}`;
  const btn = (acc, icono, texto, extra = '', cls = 'secundario-sm') => `<button type="button" class="boton ${cls}" data-accion="${acc}" ${extra}><i class="ti ${icono}" aria-hidden="true"></i> ${texto}</button>`;

  // ---------- Base de la clínica ----------
  async function baseClinica(ctx) {
    const { sb } = ctx, loc = ctx.sel.loc;
    const leer = (t, ord = 'codigo') => sb.from(t).select('*').eq('localidad_id', loc).order(ord);
    let [co, sv] = await Promise.all([leer('cli_consultorios'), leer('cli_servicios')]);
    if (co.error) throw co.error;
    if (!(sv.data || []).length) { const r = await sb.rpc('cli_asegurar_catalogos', { p_localidad: loc }); if (r.error) throw r.error; [co, sv] = await Promise.all([leer('cli_consultorios'), leer('cli_servicios')]); }
    const [es, me, as, pq, ho, pac, bo] = await Promise.all([leer('hos_especialidades'), leer('hos_medicos'), leer('hos_aseguradoras'), leer('cli_paquetes'), leer('cli_horarios', 'id'),
      leerTodo(() => sb.from('hos_pacientes').select('*').eq('localidad_id', loc).order('expediente')), sb.from('bodegas').select('id, codigo, nombre').eq('localidad_id', loc)]);
    return { consultorios: co.data || [], servicios: sv.data || [], especialidades: es.data || [], medicos: me.data || [], aseguradoras: as.data || [], paquetes: pq.data || [], horarios: ho.data || [], pacientes: pac, bodegas: bo.data || [] };
  }
  const nomPac = (p) => (p ? `${p.expediente} · ${p.nombres} ${p.apellidos}` : '');
  const pacDe = (B, txt) => { const n = Number(String(txt || '').split(' · ')[0]); return B.pacientes.find((p) => p.expediente === n) || null; };
  const listaPac = (B, id = 'cli-pac') => `<datalist id="${id}">${B.pacientes.filter((p) => p.estado !== 'FALLECIDO').map((p) => `<option value="${esc(nomPac(p))}">${esc(p.dpi || '')}</option>`).join('')}</datalist>`;
  const nomMed = (B, id) => B.medicos.find((m) => m.id === id)?.nombre || '';
  const nomSrv = (B, id) => B.servicios.find((s) => s.id === id)?.nombre || '';
  const nomAse = (B, id) => (id ? B.aseguradoras.find((a) => a.id === id)?.nombre || '' : 'Particular');
  const nomCon = (B, id) => B.consultorios.find((c) => c.id === id)?.nombre || '';
  const sig = (f) => Math.max(0, ...f.map((x) => Number(x.codigo) || 0)) + 1;

  // ===================== Listas de catálogo =====================
  function lista(cont, op) {
    const ctx = montar(cont, { titulo: op.titulo, icono: op.icono, clase: 'bk-movimientos bm-solo cx-rep pf-cat', grupo: 'Clínicas médicas · Catálogos' });
    const { sb } = ctx;
    let B = null, sec = 0, filas = [], buscar = '';
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', op.icono); return; }
      ctx.filtros(`${op.secciones.length > 1 ? `<label class="campo"><span>Catálogo</span><select name="sec">${op.secciones.map((s, i) => `<option value="${i}" ${sec === i ? 'selected' : ''}>${s.titulo}</option>`).join('')}</select></label>` : ''}<label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar value="${esc(buscar)}" placeholder="Buscar…"></label>`,
        `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>' : ''}${botonesExp}`);
      try {
        B = await baseClinica(ctx);
        const s = S();
        if (s.leer) filas = await s.leer(ctx, B);
        else { const { data, error } = await sb.from(s.tabla).select('*').eq('localidad_id', ctx.sel.loc).order(s.orden || 'codigo'); if (error) throw error; filas = data || []; }
      } catch (e) { return falta(ctx, e); }
      pintar();
    }
    const S = () => op.secciones[sec];
    const visibles = () => filas.filter((f) => !buscar || JSON.stringify(f).toLowerCase().includes(buscar.toLowerCase()));
    const opciones = (c) => (c.ref ? [['', '—'], ...c.ref(B)] : c.opciones.map((o) => [o, o]));
    const txt = (c, f) => (c.calc ? c.calc(f, B) : c.tipo === 'check' ? (f[c.k] ? 'Sí' : 'No') : c.ref ? (c.ref(B).find(([v]) => String(v) === String(f[c.k]))?.[1] || '') : f[c.k] ?? '');
    function pintar() {
      const s = S(), ed = ctx.admin && !s.soloLectura, vs = visibles().slice(0, 600);
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> ${s.ayuda}</p>${s.kpis ? `<div class="ec-kpis">${s.kpis(filas, B).map(([t, v, c]) => kpi(t, v, c)).join('')}</div>` : ''}
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${s.campos.map((c) => `<th>${c.titulo}</th>`).join('')}${ed ? '<th></th>' : ''}</tr></thead>
        <tbody>${vs.map((f) => `<tr data-id="${f.id}">${s.campos.map((c) => (c.calc || !ed ? `<td>${esc(String(txt(c, f)))}</td>` : c.opciones || c.ref ? `<td><select data-c="${c.k}">${opciones(c).map(([v, t]) => `<option value="${esc(String(v))}" ${String(f[c.k] ?? '') === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></td>`
          : c.tipo === 'check' ? `<td><input type="checkbox" data-c="${c.k}" ${f[c.k] ? 'checked' : ''}></td>` : `<td><input data-c="${c.k}" value="${esc(String(f[c.k] ?? ''))}" ${c.tipo === 'numero' ? 'type="number" step="any"' : c.tipo === 'hora' ? 'type="time"' : ''}></td>`)).join('')}${ed ? '<td><button type="button" class="icono-boton rp-peligro" data-quitar title="Quitar"><i class="ti ti-trash" aria-hidden="true"></i></button></td>' : ''}</tr>`).join('') || `<tr><td colspan="${s.campos.length + 1}" class="tk-vacio">Sin registros.</td></tr>`}</tbody></table></div>
        ${filas.length > 600 ? '<p class="pr-guia">Se muestran 600 registros: usa la búsqueda.</p>' : ''}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    const cfg = () => ({ titulo: S().titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: S().titulo.slice(0, 30), archivo: S().tabla, parametros: [`Empresa: ${empresaDe(ctx)}`], columnas: S().campos.map((c) => col(c.titulo, c.tipo === 'numero' ? 'numero' : 'texto', c.ancho || 16)), filas: visibles().map((f) => ({ valores: S().campos.map((c) => (c.tipo === 'numero' && !c.calc ? num(f[c.k]) : String(txt(c, f)))) })) });
    cont.addEventListener('input', (e) => { if (e.target.matches('[data-buscar]')) { buscar = e.target.value; pintar(); const i = cont.querySelector('[data-buscar]'); i.focus(); i.setSelectionRange(buscar.length, buscar.length); } });
    cont.addEventListener('change', async (e) => {
      const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar();
      if (e.target.name === 'sec' && e.target.closest('.bk-filtros')) { sec = Number(e.target.value); buscar = ''; return cargar(); }
      const tr = e.target.closest('tr[data-id]'); const k = e.target.dataset.c; if (!tr || !k) return;
      const c = S().campos.find((x) => x.k === k);
      const v = c.tipo === 'check' ? e.target.checked : c.tipo === 'numero' ? num(e.target.value) : c.ref ? (Number(e.target.value) || null) : c.tipo === 'hora' ? e.target.value : c.mayus === false ? e.target.value.trim() : e.target.value.trim().toUpperCase();
      const { error } = await sb.from(S().tabla).update({ [k]: v }).eq('id', Number(tr.dataset.id));
      if (error) { window.FIN.aviso(errorTxt(error)); return cargar(); }
      Object.assign(filas.find((f) => String(f.id) === tr.dataset.id), { [k]: v }); if (S().kpis) pintar();
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp, false);
      if (e.target.closest('[data-accion="nuevo"]')) {
        const base = S().sinLoc ? {} : { organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc };
        const n = S().nuevo(filas, B); if (!n) return;
        const { error } = await sb.from(S().tabla).insert({ ...base, ...n }); if (error) return window.FIN.aviso(errorTxt(error)); return cargar();
      }
      if (e.target.closest('[data-quitar]')) { if (!confirm('¿Quitar el registro?')) return; const { error } = await sb.from(S().tabla).delete().eq('id', Number(e.target.closest('tr').dataset.id)); if (error) return window.FIN.aviso(/foreign|referen/i.test(error.message) ? 'Está en uso: márcalo inactivo' : errorTxt(error)); cargar(); }
    });
    iniciar();
  }
  const refMed = (B) => B.medicos.filter((m) => m.activo).map((m) => [m.id, m.nombre]);
  const refEsp = (B) => B.especialidades.map((x) => [x.id, x.nombre]);
  const refCon = (B) => B.consultorios.map((x) => [x.id, x.nombre]);
  const refSrv = (B) => B.servicios.map((x) => [x.id, `${x.codigo} · ${x.nombre}`]);
  const refAse = (B) => B.aseguradoras.map((x) => [x.id, x.nombre]);

  window.PANTALLAS['cli-medicos'] = (cont) => lista(cont, { titulo: 'Médicos, especialidades y horarios', icono: 'ti-stethoscope', secciones: [
    { titulo: 'Médicos', tabla: 'hos_medicos', ayuda: 'Médicos (compartidos con Hospital) con colegiado, especialidad, participación de la clínica sobre sus honorarios y retención de ISR.', kpis: (f) => [['Médicos', f.length], ['Activos', f.filter((m) => m.activo).length, 'ec-fin']],
      campos: [{ k: 'codigo', titulo: 'Código', tipo: 'numero', ancho: 7 }, { k: 'nombre', titulo: 'Nombre', ancho: 30 }, { k: 'colegiado', titulo: 'Colegiado' }, { k: 'especialidad_id', titulo: 'Especialidad', ref: refEsp, ancho: 22 }, { k: 'tipo', titulo: 'Tipo', opciones: ['STAFF', 'EXTERNO', 'RESIDENTE'] }, { k: 'nit', titulo: 'NIT' }, { k: 'telefono', titulo: 'Teléfono' }, { k: 'pct_hospital', titulo: '% clínica', tipo: 'numero' }, { k: 'retencion_isr_pct', titulo: '% ret. ISR', tipo: 'numero' }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
      nuevo: (f) => ({ codigo: sig(f), nombre: 'DR. NUEVO MÉDICO', pct_hospital: 30, retencion_isr_pct: 5 }) },
    { titulo: 'Horarios de atención', tabla: 'cli_horarios', orden: 'id', ayuda: 'Días y horas de consulta de cada médico, su consultorio y la duración de la cita: la agenda arma los espacios con estos horarios.', kpis: (f) => [['Bloques', f.length], ['Horas por semana', r2(sum(f.filter((h) => h.activo).map((h) => (aMin(h.hora_fin) - aMin(h.hora_inicio)) / 60)))]],
      campos: [{ k: 'medico_id', titulo: 'Médico', ref: refMed, ancho: 28 }, { k: 'consultorio_id', titulo: 'Consultorio', ref: refCon, ancho: 20 }, { k: 'dia_semana', titulo: 'Día', ref: () => DIAS.slice(1).map((d, i) => [i + 1, d]) }, { k: 'hora_inicio', titulo: 'Desde', tipo: 'hora' }, { k: 'hora_fin', titulo: 'Hasta', tipo: 'hora' }, { k: 'duracion_min', titulo: 'Min. por cita', tipo: 'numero' }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
      nuevo: (f, B) => (B.medicos.length ? { medico_id: B.medicos[0].id, consultorio_id: B.consultorios[0]?.id || null, dia_semana: 1, hora_inicio: '08:00', hora_fin: '12:00', duracion_min: 20 } : (window.FIN.aviso('Primero registra un médico'), null)) },
    { titulo: 'Especialidades', tabla: 'hos_especialidades', ayuda: 'Especialidades médicas (compartidas con Hospital).', campos: [{ k: 'codigo', titulo: 'Código', tipo: 'numero', ancho: 7 }, { k: 'nombre', titulo: 'Especialidad', ancho: 36 }, { k: 'activo', titulo: 'Activa', tipo: 'check' }], nuevo: (f) => ({ codigo: sig(f), nombre: 'NUEVA ESPECIALIDAD' }) }] });
  window.PANTALLAS['cli-consultorios'] = (cont) => lista(cont, { titulo: 'Clínicas y consultorios', icono: 'ti-door', secciones: [
    { titulo: 'Consultorios', tabla: 'cli_consultorios', ayuda: 'Consultorios de cada sede con su especialidad y equipo.', campos: [{ k: 'codigo', titulo: 'Código', tipo: 'numero', ancho: 7 }, { k: 'nombre', titulo: 'Consultorio', ancho: 26 }, { k: 'sede', titulo: 'Sede / clínica', ancho: 20 }, { k: 'especialidad_id', titulo: 'Especialidad', ref: refEsp, ancho: 22 }, { k: 'equipo', titulo: 'Equipo', ancho: 30 }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
      nuevo: (f) => ({ codigo: sig(f), nombre: `CONSULTORIO ${sig(f)}`, sede: 'SEDE CENTRAL' }) }] });
  window.PANTALLAS['cli-servicios'] = (cont) => lista(cont, { titulo: 'Servicios, tarifas y paquetes', icono: 'ti-list-check', secciones: [
    { titulo: 'Servicios', tabla: 'cli_servicios', ayuda: 'Servicios que se cobran con su precio particular. «Honorario» indica si cuenta para la liquidación del médico; un insumo descarga el producto de inventario al cobrar.', kpis: (f) => [['Servicios', f.length], ['Activos', f.filter((s) => s.activo).length, 'ec-fin']],
      campos: [{ k: 'codigo', titulo: 'Código', ancho: 9 }, { k: 'nombre', titulo: 'Servicio', ancho: 34 }, { k: 'tipo', titulo: 'Tipo', opciones: ['CONSULTA', 'RECONSULTA', 'PROCEDIMIENTO', 'LABORATORIO', 'IMAGEN', 'CERTIFICADO', 'INSUMO', 'PAQUETE', 'OTRO'] }, { k: 'especialidad_id', titulo: 'Especialidad', ref: refEsp }, { k: 'precio', titulo: 'Precio Q', tipo: 'numero' }, { k: 'honorario', titulo: 'Honorario', tipo: 'check' }, { k: 'producto_id', titulo: 'Producto (insumo)', tipo: 'numero' }, { k: 'cantidad_insumo', titulo: 'Cant. insumo', tipo: 'numero' }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
      nuevo: (f) => ({ codigo: `SRV-${f.length + 1}`, nombre: 'NUEVO SERVICIO', tipo: 'CONSULTA', precio: 250 }) },
    { titulo: 'Tarifas por aseguradora', tabla: 'cli_tarifas', sinLoc: true, ayuda: 'Precio pactado con cada aseguradora y el copago fijo que paga el paciente. Sin tarifa se usa el precio particular y el coaseguro de la aseguradora.',
      leer: async (ctx, B) => { if (!B.servicios.length) return []; const { data, error } = await ctx.sb.from('cli_tarifas').select('*').in('servicio_id', B.servicios.map((s) => s.id)).order('id'); if (error) throw error; return data || []; },
      campos: [{ k: 'aseguradora_id', titulo: 'Aseguradora', ref: refAse, ancho: 26 }, { k: 'servicio_id', titulo: 'Servicio', ref: refSrv, ancho: 34 }, { k: 'precio', titulo: 'Precio Q', tipo: 'numero' }, { k: 'copago', titulo: 'Copago Q', tipo: 'numero' }],
      nuevo: (f, B) => (B.aseguradoras.length ? { aseguradora_id: B.aseguradoras[0].id, servicio_id: B.servicios[0].id, precio: B.servicios[0].precio, copago: 50 } : (window.FIN.aviso('Primero registra una aseguradora'), null)) },
    { titulo: 'Aseguradoras', tabla: 'hos_aseguradoras', ayuda: 'Aseguradoras (compartidas con Hospital) con su coaseguro y días de crédito.', campos: [{ k: 'codigo', titulo: 'Código', tipo: 'numero', ancho: 7 }, { k: 'nombre', titulo: 'Aseguradora', ancho: 30 }, { k: 'nit', titulo: 'NIT' }, { k: 'contacto', titulo: 'Contacto' }, { k: 'telefono', titulo: 'Teléfono' }, { k: 'coaseguro_pct', titulo: 'Coaseguro %', tipo: 'numero' }, { k: 'dias_credito', titulo: 'Días crédito', tipo: 'numero' }, { k: 'activo', titulo: 'Activa', tipo: 'check' }],
      nuevo: (f) => ({ codigo: sig(f), nombre: 'NUEVA ASEGURADORA', coaseguro_pct: 20, deducible: 0 }) },
    { titulo: 'Paquetes y membresías', tabla: 'cli_paquetes', ayuda: 'Paquetes de sesiones o consultas prepagadas: precio, sesiones y vigencia. Se venden en Procesos › Paquetes y membresías.', campos: [{ k: 'codigo', titulo: 'Código', tipo: 'numero', ancho: 7 }, { k: 'nombre', titulo: 'Paquete', ancho: 30 }, { k: 'servicio_id', titulo: 'Servicio de cada sesión', ref: refSrv, ancho: 30 }, { k: 'sesiones', titulo: 'Sesiones', tipo: 'numero' }, { k: 'precio', titulo: 'Precio Q', tipo: 'numero' }, { k: 'vigencia_dias', titulo: 'Vigencia (días)', tipo: 'numero' }, { k: 'por', titulo: 'Q por sesión', calc: (f) => fmt.monto(f.precio / Math.max(1, f.sesiones)) }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
      nuevo: (f, B) => ({ codigo: sig(f), nombre: 'PAQUETE DE CONTROL', servicio_id: B.servicios.find((s) => s.tipo === 'CONSULTA')?.id || null, sesiones: 4, precio: 800, vigencia_dias: 180 }) }] });
  window.PANTALLAS['cli-diagnosticos'] = (cont) => lista(cont, { titulo: 'Diagnósticos CIE-10', icono: 'ti-vaccine', secciones: [
    { titulo: 'Diagnósticos', tabla: 'cli_diagnosticos', sinLoc: true, ayuda: 'Clasificación internacional de enfermedades (CIE-10) que se usa en la consulta y en el reporte de morbilidad. Viene con los diagnósticos más frecuentes; agrega los que necesites.',
      leer: async (ctx) => { const { data, error } = await ctx.sb.from('cli_diagnosticos').select('*').order('codigo'); if (error) throw error; return data || []; },
      kpis: (f) => [['Diagnósticos', f.length], ['Capítulos', new Set(f.map((d) => d.capitulo)).size]],
      campos: [{ k: 'codigo', titulo: 'Código', ancho: 9 }, { k: 'descripcion', titulo: 'Descripción', ancho: 60, mayus: false }, { k: 'capitulo', titulo: 'Capítulo', ancho: 9 }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
      nuevo: () => { const c = prompt('Código CIE-10 (por ejemplo K35.8):'); return c ? { codigo: c.trim().toUpperCase(), descripcion: 'Descripción del diagnóstico' } : null; } }] });
  window.PANTALLAS['cli-vademecum'] = (cont) => lista(cont, { titulo: 'Medicamentos y plantillas', icono: 'ti-pill', secciones: [
    { titulo: 'Vademécum', tabla: 'cli_medicamentos', orden: 'nombre', ayuda: 'Medicamentos para la receta con presentación, concentración, vía y dosis habitual (se proponen al recetar).', campos: [{ k: 'nombre', titulo: 'Medicamento', ancho: 28 }, { k: 'presentacion', titulo: 'Presentación' }, { k: 'concentracion', titulo: 'Concentración' }, { k: 'via', titulo: 'Vía', opciones: ['ORAL', 'TÓPICA', 'INTRAMUSCULAR', 'INTRAVENOSA', 'SUBCUTÁNEA', 'INHALADA', 'OFTÁLMICA', 'ÓTICA', 'RECTAL', 'VAGINAL'] }, { k: 'dosis_habitual', titulo: 'Dosis habitual', ancho: 30 }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
      nuevo: () => ({ nombre: 'ACETAMINOFÉN', presentacion: 'TABLETAS', concentracion: '500 MG', via: 'ORAL', dosis_habitual: '1 TABLETA CADA 8 HORAS POR 3 DÍAS' }) },
    { titulo: 'Plantillas clínicas', tabla: 'cli_plantillas', orden: 'nombre', ayuda: 'Formato de historia, examen físico y plan por especialidad: en la consulta se cargan con un clic.', campos: [{ k: 'nombre', titulo: 'Plantilla', ancho: 24 }, { k: 'especialidad_id', titulo: 'Especialidad', ref: refEsp }, { k: 'historia', titulo: 'Historia', ancho: 40, mayus: false }, { k: 'examen_fisico', titulo: 'Examen físico', ancho: 40, mayus: false }, { k: 'plan', titulo: 'Plan', ancho: 30, mayus: false }, { k: 'activo', titulo: 'Activa', tipo: 'check' }],
      nuevo: (f, B) => ({ nombre: 'CONTROL DE NIÑO SANO', especialidad_id: B.especialidades.find((e) => /PEDIA/.test(e.nombre))?.id || null, historia: 'Alimentación: \nDesarrollo psicomotor: \nVacunas al día: ', examen_fisico: 'Peso y talla para la edad: \nPerímetro cefálico: \nCardiopulmonar: ', plan: 'Próximo control en 1 mes.' }) }] });

  // ===================== Pacientes y expediente clínico =====================
  window.PANTALLAS['cli-expediente'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Pacientes y expediente clínico', icono: 'ti-user-heart', clase: 'bk-movimientos bm-solo cx-rep nom-emp', grupo: 'Clínicas médicas · Registros' });
    const { sb } = ctx;
    let B = null, actual = null, nuevo = false, buscar = '', H = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar(id = actual?.id) {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-user-heart'); return; }
      try { B = await baseClinica(ctx); } catch (e) { return falta(ctx, e); }
      ctx.filtros(`<label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar value="${esc(buscar)}" placeholder="Expediente, nombre, DPI…"></label>`, `${ctx.admin ? btn('nuevo', 'ti-user-plus', 'Nuevo paciente', '', 'primario-sm') : ''}${actual ? btn('imprimir', 'ti-printer', 'Historia clínica') : ''}`);
      actual = B.pacientes.find((p) => p.id === id) || null; H = actual ? await historial(actual.id) : null; pintar();
    }
    async function historial(pid) {
      const [ex, cs, pv] = await Promise.all([sb.from('cli_expedientes').select('*').eq('paciente_id', pid).maybeSingle(), sb.from('cli_consultas').select('id, numero, fecha, medico_id, motivo, plan, estado, peso_kg, presion, cli_consulta_diagnosticos(codigo, descripcion, tipo)').eq('paciente_id', pid).order('fecha', { ascending: false }).limit(50),
        sb.from('cli_paquetes_vendidos').select('numero, paquete_id, sesiones, usadas, vence, estado').eq('paciente_id', pid).order('id', { ascending: false })]);
      return { ex: ex.data || {}, cs: cs.data || [], pv: pv.data || [] };
    }
    const ls = () => B.pacientes.filter((p) => !buscar || `${p.expediente} ${p.nombres} ${p.apellidos} ${p.dpi || ''}`.toLowerCase().includes(buscar.toLowerCase())).slice(0, 200);
    function pintar() {
      const p = nuevo ? null : actual, dis = ctx.admin ? '' : 'disabled', v = p || { estado: 'ACTIVO' };
      const t = (k, l, c = '', src = v) => `<label class="campo ${c}"><span>${l}</span><input name="${k}" value="${esc(String(src[k] ?? ''))}" ${dis}></label>`;
      const ta = (k, l) => `<label class="campo sat-ancho"><span>${l}</span><textarea name="ex_${k}" rows="2" ${dis}>${esc(H?.ex?.[k] || '')}</textarea></label>`;
      ctx.pDet.innerHTML = `<div class="nom-dos"><aside class="nom-lista"><div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr><th>Exp.</th><th>Paciente</th><th>Edad</th></tr></thead><tbody>
        ${ls().map((x) => `<tr data-pac="${x.id}" class="${x === actual && !nuevo ? 'cr-n2' : ''}" style="cursor:pointer"><td>${x.expediente}</td><td>${esc(`${x.nombres} ${x.apellidos}`)}</td><td>${edad(x.fecha_nacimiento) ?? ''}</td></tr>`).join('') || '<tr><td colspan="3" class="tk-vacio">Sin pacientes.</td></tr>'}</tbody></table></div></aside>
        <section>${p || nuevo ? `<form class="cli-pac" novalidate><div class="cl-banda">${p ? `Expediente ${p.expediente} · ${esc(p.nombres)} ${esc(p.apellidos)}${p.fecha_nacimiento ? ` · ${edad(p.fecha_nacimiento)} años` : ''}` : 'Nuevo paciente'}</div><div class="sat-g">
          ${t('nombres', 'Nombres *')}${t('apellidos', 'Apellidos *')}${t('dpi', 'DPI (CUI)')}${t('nit', 'NIT')}<label class="campo"><span>Fecha de nacimiento</span><input type="date" name="fecha_nacimiento" value="${v.fecha_nacimiento || ''}" ${dis}></label>
          <label class="campo"><span>Sexo</span><select name="genero" ${dis}>${opt([{ v: 'M', t: 'Masculino' }, { v: 'F', t: 'Femenino' }], v.genero, 'v', (x) => x.t)}</select></label>${t('telefono', 'Teléfono')}${t('correo', 'Correo')}${t('direccion', 'Dirección', 'sat-ancho')}${t('tipo_sangre', 'Tipo de sangre')}
          <label class="campo"><span>Aseguradora</span><select name="aseguradora_id" ${dis}>${opt(B.aseguradoras, v.aseguradora_id, 'id', (a) => a.nombre, 'Particular')}</select></label>${t('poliza_seguro', 'Póliza / carné')}${t('contacto_emergencia', 'Contacto de emergencia')}${t('telefono_emergencia', 'Teléfono de emergencia')}</div>
          ${p ? `<div class="cl-banda">Antecedentes</div><div class="sat-g">${ta('alergias', 'Alergias')}${ta('antecedentes_personales', 'Antecedentes personales patológicos')}${ta('antecedentes_familiares', 'Antecedentes familiares')}${ta('quirurgicos', 'Quirúrgicos')}${ta('gineco_obstetricos', 'Gineco-obstétricos')}${ta('medicamentos_cronicos', 'Medicamentos de uso crónico')}${ta('vacunas', 'Vacunas')}${ta('habitos', 'Hábitos (tabaco, alcohol, ejercicio)')}</div>` : ''}
          ${ctx.admin ? `<p class="acciones-form">${btn('guardar', 'ti-device-floppy', p ? 'Guardar cambios' : 'Crear paciente', '', 'primario-sm')}${p ? ` <a class="boton secundario-sm" href="#/clinicas/cli-agenda"><i class="ti ti-calendar-plus" aria-hidden="true"></i> Agendar cita</a>` : ''}</p>` : ''}</form>
          ${p ? `<div class="cl-banda">Historial de consultas (${H.cs.length})</div>${tabla({ columnas: [col('No.', 'texto', 6), col('Fecha', 'texto', 11), col('Médico', 'texto', 22), col('Motivo', 'texto', 26), col('Diagnóstico', 'texto', 34), col('Estado', 'texto', 10)],
            filas: H.cs.map((c) => ({ valores: [String(c.numero), fmt.fechaDia(diaGt(c.fecha)), nomMed(B, c.medico_id), c.motivo || '', (c.cli_consulta_diagnosticos || []).map((d) => `${d.codigo} ${d.descripcion}`).join('; '), `¤${c.estado}`] })), vacio: 'Sin consultas.' }, false)}
            ${H.pv.length ? `<div class="cl-banda">Paquetes</div>${tabla({ columnas: [col('No.', 'texto', 6), col('Paquete', 'texto', 30), col('Sesiones', 'texto', 10), col('Vence', 'texto', 11), col('Estado', 'texto', 10)], filas: H.pv.map((x) => ({ valores: [String(x.numero), B.paquetes.find((k) => k.id === x.paquete_id)?.nombre || '', `${x.usadas} de ${x.sesiones}`, x.vence ? fmt.fechaDia(x.vence) : '', `¤${x.estado}`] })) }, false)}` : ''}` : ''}`
          : ctx.vacio('Elige un paciente de la lista o crea uno nuevo.', 'ti-user-heart')}</section></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    async function guardar() {
      const f = cont.querySelector('form.cli-pac'), d = Object.fromEntries(new FormData(f).entries());
      const pac = {}; const ex = {};
      Object.entries(d).forEach(([k, val]) => { if (k.startsWith('ex_')) ex[k.slice(3)] = val.trim() || null; else pac[k] = k === 'aseguradora_id' ? (Number(val) || null) : k === 'correo' ? val.trim() || null : val.trim().toUpperCase() || null; });
      if (!pac.nombres || !pac.apellidos) return window.FIN.aviso('Escribe nombres y apellidos');
      if (!actual || nuevo) {
        const { data, error } = await sb.from('hos_pacientes').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, expediente: 0, ...pac }).select().single();
        if (error) return window.FIN.aviso(errorTxt(error)); nuevo = false; window.FIN.aviso(`Paciente creado con expediente ${data.expediente}`); return cargar(data.id);
      }
      const { error } = await sb.from('hos_pacientes').update(pac).eq('id', actual.id); if (error) return window.FIN.aviso(errorTxt(error));
      const r = await sb.from('cli_expedientes').upsert({ paciente_id: actual.id, ...ex }, { onConflict: 'paciente_id' }); if (r.error) return window.FIN.aviso(errorTxt(r.error));
      window.FIN.aviso('Expediente guardado'); cargar();
    }
    function imprimirHistoria() {
      const p = actual, ex = H.ex || {};
      const filas = [['Expediente', p.expediente], ['Paciente', `${p.nombres} ${p.apellidos}`], ['Edad', edad(p.fecha_nacimiento) ?? ''], ['Sexo', p.genero === 'F' ? 'Femenino' : p.genero === 'M' ? 'Masculino' : ''], ['DPI', p.dpi || ''], ['Tipo de sangre', p.tipo_sangre || ''], ['Alergias', ex.alergias || 'Ninguna conocida'], ['Antecedentes personales', ex.antecedentes_personales || ''], ['Antecedentes familiares', ex.antecedentes_familiares || ''], ['Quirúrgicos', ex.quirurgicos || ''], ['Medicamentos crónicos', ex.medicamentos_cronicos || '']];
      imprimir(`Historia clínica · Exp. ${p.expediente}`, `<h2>Historia clínica</h2><table>${filas.map(([a, b]) => `<tr><th style="width:30%">${esc(a)}</th><td>${esc(String(b))}</td></tr>`).join('')}</table><h3>Consultas</h3><table><tr><th>Fecha</th><th>Médico</th><th>Motivo</th><th>Diagnóstico</th><th>Plan</th></tr>${H.cs.map((c) => `<tr><td>${fmt.fechaDia(diaGt(c.fecha))}</td><td>${esc(nomMed(B, c.medico_id))}</td><td>${esc(c.motivo || '')}</td><td>${esc((c.cli_consulta_diagnosticos || []).map((d) => `${d.codigo} ${d.descripcion}`).join('; '))}</td><td>${esc(c.plan || '')}</td></tr>`).join('')}</table>`);
    }
    cont.addEventListener('input', (e) => { if (e.target.matches('[data-buscar]')) { buscar = e.target.value; pintar(); const i = cont.querySelector('[data-buscar]'); if (i) { i.focus(); i.setSelectionRange(buscar.length, buscar.length); } } });
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') { actual = null; cargar(null); } });
    cont.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr[data-pac]'); if (tr) { nuevo = false; return cargar(Number(tr.dataset.pac)); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'nuevo') { nuevo = true; actual = null; return pintar(); }
      if (a === 'guardar') return guardar();
      if (a === 'imprimir' && actual) return imprimirHistoria();
    });
    iniciar();
  };

  // ===================== Agenda de citas =====================
  window.PANTALLAS['cli-agenda'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Agenda de citas', icono: 'ti-calendar-event', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Clínicas médicas · Registros' });
    const { sb } = ctx;
    const f = { fecha: hoy(), medico: '' }; let B = null, citas = [], form = null, cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-calendar-event'); return; }
      try { B = await baseClinica(ctx); } catch (e) { return falta(ctx, e); }
      ctx.filtros(`<label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${f.fecha}"></label><label class="campo"><span>Médico</span><select name="medico">${opt(B.medicos.filter((m) => m.activo), f.medico, 'id', (m) => m.nombre, 'Todos')}</select></label>`, `${btn('dia-', 'ti-chevron-left', 'Día anterior')}${btn('dia+', 'ti-chevron-right', 'Día siguiente')}${ctx.admin ? btn('nueva', 'ti-calendar-plus', 'Nueva cita', '', 'primario-sm') : ''}${botonesExp}`);
      await leer();
    }
    async function leer() {
      const { data, error } = await sb.from('cli_citas').select('*').eq('localidad_id', ctx.sel.loc).eq('fecha', f.fecha).order('hora'); if (error) return falta(ctx, error);
      citas = (data || []).filter((c) => !f.medico || String(c.medico_id) === String(f.medico)); pintar();
    }
    // Espacios del día por médico según sus horarios.
    function espacios() {
      const ds = diaSemana(f.fecha), out = [];
      B.horarios.filter((h) => h.activo && h.dia_semana === ds && (!f.medico || String(h.medico_id) === String(f.medico))).forEach((h) => {
        for (let m = aMin(h.hora_inicio); m + h.duracion_min <= aMin(h.hora_fin); m += h.duracion_min) {
          const ocup = citas.find((c) => c.medico_id === h.medico_id && !['CANCELADA', 'NO ASISTIÓ'].includes(c.estado) && aMin(c.hora) < m + h.duracion_min && m < aMin(c.hora) + c.duracion_min);
          if (!ocup) out.push({ medico_id: h.medico_id, hora: deMin(m), duracion: h.duracion_min, consultorio_id: h.consultorio_id });
        }
      });
      return out;
    }
    function pintar() {
      const libres = espacios();
      cfg = { titulo: `Agenda del ${fmt.fechaDia(f.fecha)}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Agenda', archivo: `agenda_${f.fecha}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `${DIAS[diaSemana(f.fecha)]} ${fmt.fechaDia(f.fecha)}`, `Médico: ${f.medico ? nomMed(B, Number(f.medico)) : 'Todos'}`],
        columnas: [col('Hora', 'texto', 7), col('Médico', 'texto', 24), col('Paciente', 'texto', 30), col('Servicio', 'texto', 22), col('Consultorio', 'texto', 14), col('Cobertura', 'texto', 16), col('Estado', 'texto', 12)],
        filas: citas.map((c) => ({ valores: [hm(c.hora), nomMed(B, c.medico_id), `${nomPac(B.pacientes.find((p) => p.id === c.paciente_id))}${c.primera_vez ? ' (primera vez)' : ''}`, nomSrv(B, c.servicio_id), nomCon(B, c.consultorio_id), nomAse(B, c.aseguradora_id), `¤${c.estado}`], attr: `data-cita="${c.id}" style="cursor:pointer"` })), vacio: 'Sin citas en el día.' };
      const nP = (e) => citas.filter((c) => c.estado === e).length;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Citas', citas.length)}${kpi('Confirmadas', nP('CONFIRMADA'))}${kpi('Atendidas', nP('ATENDIDA'), 'ec-fin')}${kpi('No asistió / canceladas', nP('NO ASISTIÓ') + nP('CANCELADA'), nP('NO ASISTIÓ') ? 'ec-alerta' : '')}${kpi('Espacios libres', libres.length)}</div>
        ${form ? formulario() : ''}${tabla(cfg, false)}
        ${libres.length ? `<h3 class="pr-sub"><i class="ti ti-clock" aria-hidden="true"></i> Espacios libres según los horarios</h3><div class="cr-meses">${libres.slice(0, 80).map((l, i) => `<button type="button" class="pc-marca editando" data-libre="${i}" title="${esc(nomMed(B, l.medico_id))}">${l.hora} · ${esc(nomMed(B, l.medico_id).split(' ').slice(0, 2).join(' '))}</button>`).join('')}</div>` : `<p class="pr-guia">${B.horarios.length ? 'No quedan espacios libres en los horarios de este día.' : 'Registra los horarios de los médicos (Catálogos › Médicos, especialidades y horarios) para ver los espacios libres.'}</p>`}</div>`;
      cont._libres = libres;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    function formulario() {
      const c = form, ed = !!c.id;
      return `<form class="cli-cita" novalidate><div class="cl-banda">${ed ? `Cita de ${esc(nomPac(B.pacientes.find((p) => p.id === c.paciente_id)))} · ${marca(c.estado)}` : 'Nueva cita'}</div><div class="sat-g">
        <label class="campo sat-ancho"><span>Paciente *</span><input name="paciente" list="cli-pac" value="${esc(nomPac(B.pacientes.find((p) => p.id === c.paciente_id)))}" placeholder="Expediente o nombre" autocomplete="off"></label>
        <label class="campo"><span>Médico *</span><select name="medico_id">${opt(B.medicos.filter((m) => m.activo), c.medico_id, 'id', (m) => m.nombre, null)}</select></label>
        <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${c.fecha}"></label><label class="campo"><span>Hora</span><input type="time" name="hora" value="${hm(c.hora)}"></label><label class="campo"><span>Minutos</span><input type="number" name="duracion_min" value="${c.duracion_min || 20}"></label>
        <label class="campo"><span>Consultorio</span><select name="consultorio_id">${opt(B.consultorios, c.consultorio_id, 'id', (x) => x.nombre)}</select></label>
        <label class="campo"><span>Servicio</span><select name="servicio_id">${opt(B.servicios.filter((s) => s.activo && ['CONSULTA', 'RECONSULTA', 'PROCEDIMIENTO'].includes(s.tipo)), c.servicio_id, 'id', (s) => `${s.nombre} · Q ${fmt.monto(s.precio)}`)}</select></label>
        <label class="campo"><span>Cobertura</span><select name="aseguradora_id">${opt(B.aseguradoras, c.aseguradora_id, 'id', (a) => a.nombre, 'Particular')}</select></label>
        <label class="campo sat-ancho"><span>Motivo</span><input name="motivo" value="${esc(c.motivo || '')}"></label></div>
        <p class="acciones-form">${btn('guardar-cita', 'ti-device-floppy', ed ? 'Guardar' : 'Agendar', '', 'primario-sm')}${ed ? ['CONFIRMADA', 'EN ESPERA', 'CANCELADA', 'NO ASISTIÓ'].filter((x) => x !== c.estado).map((x) => ` ${btn('estado', 'ti-arrow-right', x.charAt(0) + x.slice(1).toLowerCase(), `data-estado="${x}"`)}`).join('') : ''} ${btn('cerrar-form', 'ti-x', 'Cerrar')}</p></form>${listaPac(B)}`;
    }
    async function guardarCita() {
      const d = Object.fromEntries(new FormData(cont.querySelector('form.cli-cita')).entries());
      const p = pacDe(B, d.paciente); if (!p) return window.FIN.aviso('Elige el paciente de la lista (o créalo en Pacientes y expediente)');
      const reg = { paciente_id: p.id, medico_id: Number(d.medico_id), fecha: d.fecha, hora: d.hora, duracion_min: Number(d.duracion_min) || 20, consultorio_id: Number(d.consultorio_id) || null, servicio_id: Number(d.servicio_id) || null, aseguradora_id: Number(d.aseguradora_id) || null, motivo: d.motivo.trim().toUpperCase() || null };
      const r = form.id ? await sb.from('cli_citas').update(reg).eq('id', form.id) : await sb.from('cli_citas').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, ...reg });
      if (r.error) return window.FIN.aviso(errorTxt(r.error));
      window.FIN.aviso(form.id ? 'Cita actualizada' : `Cita agendada a las ${reg.hora}`); form = null; f.fecha = reg.fecha; cargar();
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); if (e.target.closest('.bk-filtros') && ['fecha', 'medico'].includes(e.target.name)) { f[e.target.name] = e.target.value || (e.target.name === 'fecha' ? hoy() : ''); leer(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp, false);
      const li = e.target.closest('[data-libre]'); if (li) { const l = cont._libres[Number(li.dataset.libre)]; const p = B.pacientes.find((x) => x.estado === 'ACTIVO'); form = { fecha: f.fecha, hora: l.hora, duracion_min: l.duracion, medico_id: l.medico_id, consultorio_id: l.consultorio_id, servicio_id: B.servicios.find((s) => s.tipo === 'CONSULTA')?.id, paciente_id: null, aseguradora_id: null }; void p; return pintar(); }
      const tr = e.target.closest('tr[data-cita]'); if (tr) { form = { ...citas.find((c) => String(c.id) === tr.dataset.cita) }; return pintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'dia-' || a === 'dia+') { f.fecha = sumarDias(f.fecha, a === 'dia+' ? 1 : -1); cont.querySelector('[name=fecha]').value = f.fecha; return leer(); }
      if (a === 'nueva') { form = { fecha: f.fecha, hora: '08:00', duracion_min: 20, medico_id: Number(f.medico) || B.medicos.find((m) => m.activo)?.id, servicio_id: B.servicios.find((s) => s.tipo === 'CONSULTA')?.id }; return pintar(); }
      if (a === 'cerrar-form') { form = null; return pintar(); }
      if (a === 'guardar-cita') return guardarCita();
      if (a === 'estado') {
        const est = e.target.closest('[data-estado]').dataset.estado; const upd = { estado: est };
        if (est === 'CANCELADA') { const m = prompt('Motivo de la cancelación:'); if (m === null) return; upd.motivo_cancelacion = m.trim() || null; }
        const { error } = await sb.from('cli_citas').update(upd).eq('id', form.id); if (error) return window.FIN.aviso(errorTxt(error)); form = null; leer();
      }
    });
    iniciar();
  };

  // ===================== Recepción y signos vitales =====================
  window.PANTALLAS['cli-recepcion'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Recepción y signos vitales', icono: 'ti-heartbeat', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Clínicas médicas · Registros' });
    const { sb } = ctx;
    let B = null, citas = [], consultas = [], sel = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-heartbeat'); return; }
      try { B = await baseClinica(ctx); } catch (e) { return falta(ctx, e); }
      ctx.filtros('', btn('refrescar', 'ti-refresh', 'Actualizar'));
      const [c, k] = await Promise.all([sb.from('cli_citas').select('*').eq('localidad_id', ctx.sel.loc).eq('fecha', hoy()).order('hora'), sb.from('cli_consultas').select('*').eq('localidad_id', ctx.sel.loc).gte('fecha', `${hoy()}T00:00:00-06:00`)]);
      citas = c.data || []; consultas = k.data || []; pintar();
    }
    const consultaDe = (c) => consultas.find((k) => k.cita_id === c.id && k.estado !== 'ANULADA');
    function pintar() {
      const espera = citas.filter((c) => c.estado === 'EN ESPERA');
      const c = sel ? citas.find((x) => x.id === sel) : null, k = c ? consultaDe(c) : null, v = k || {};
      const t = (n, l, tipo = 'number', step = 'any') => `<label class="campo"><span>${l}</span><input name="${n}" type="${tipo}" step="${step}" value="${esc(String(v[n] ?? ''))}"></label>`;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Citas de hoy', citas.length)}${kpi('En sala de espera', espera.length, espera.length ? 'ec-alerta' : '')}${kpi('En consulta', citas.filter((x) => x.estado === 'EN CONSULTA').length)}${kpi('Atendidas', citas.filter((x) => x.estado === 'ATENDIDA').length, 'ec-fin')}${kpi('Espera promedio', espera.length ? `${Math.round(sum(espera.map((x) => minutos(x.llegada, new Date()))) / espera.length)} min` : '—')}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Marca la llegada del paciente, toma sus signos vitales (se guardan en la consulta) y pásalo al médico. El tiempo de espera se mide desde la llegada.</p>
        ${tabla({ columnas: [col('Hora', 'texto', 7), col('Paciente', 'texto', 30), col('Médico', 'texto', 22), col('Llegó', 'texto', 7), col('Espera', 'texto', 8), col('Signos', 'texto', 8), col('Estado', 'texto', 12)], acciones: true,
          filas: citas.map((x) => ({ valores: [hm(x.hora), nomPac(B.pacientes.find((p) => p.id === x.paciente_id)), nomMed(B, x.medico_id), horaGt(x.llegada), x.llegada ? `${minutos(x.llegada, x.inicio_consulta || new Date())} min` : '', consultaDe(x) ? 'Sí' : '', `¤${x.estado}`], resaltar: x.id === sel,
            acciones: ['PROGRAMADA', 'CONFIRMADA'].includes(x.estado) ? `<button type="button" class="boton secundario-sm" data-llego="${x.id}">Llegó</button>` : x.estado === 'EN ESPERA' ? `<button type="button" class="boton secundario-sm" data-signos="${x.id}">Signos</button> <button type="button" class="boton primario-sm" data-pasar="${x.id}">Pasar</button>` : x.estado === 'EN CONSULTA' ? '<a class="boton secundario-sm" href="#/clinicas/cli-consulta">Consulta</a>' : '' })), vacio: 'No hay citas hoy. Agéndalas en Agenda de citas.' }, false)}
        ${c ? `<form class="cli-signos" novalidate><div class="cl-banda">Signos vitales · ${esc(nomPac(B.pacientes.find((p) => p.id === c.paciente_id)))}</div><div class="sat-g">
          ${t('peso_kg', 'Peso (kg)')}${t('talla_cm', 'Talla (cm)')}${t('presion', 'Presión arterial', 'text')}${t('frecuencia_cardiaca', 'Frec. cardíaca', 'number', '1')}${t('frecuencia_respiratoria', 'Frec. respiratoria', 'number', '1')}${t('temperatura', 'Temperatura °C')}${t('saturacion', 'Saturación %', 'number', '1')}${t('glucosa', 'Glucosa mg/dL')}
          <label class="campo sat-ancho"><span>Motivo de consulta</span><input name="motivo" value="${esc(v.motivo || c.motivo || '')}"></label></div>
          <p class="acciones-form">${btn('guardar-signos', 'ti-device-floppy', 'Guardar signos', '', 'primario-sm')} <span class="pr-guia" data-imc></span></p></form>` : ''}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    async function guardarSignos() {
      const c = citas.find((x) => x.id === sel), d = Object.fromEntries(new FormData(cont.querySelector('form.cli-signos')).entries());
      const reg = { motivo: d.motivo.trim().toUpperCase() || null }; ['peso_kg', 'talla_cm', 'frecuencia_cardiaca', 'frecuencia_respiratoria', 'temperatura', 'saturacion', 'glucosa'].forEach((k) => { reg[k] = d[k] === '' ? null : num(d[k]); }); reg.presion = d.presion.trim() || null;
      const k = consultaDe(c);
      const r = k ? await sb.from('cli_consultas').update(reg).eq('id', k.id) : await sb.from('cli_consultas').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, numero: 0, cita_id: c.id, paciente_id: c.paciente_id, medico_id: c.medico_id, ...reg });
      if (r.error) return window.FIN.aviso(errorTxt(r.error));
      window.FIN.aviso(reg.peso_kg && reg.talla_cm ? `Signos guardados · IMC ${(reg.peso_kg / ((reg.talla_cm / 100) ** 2)).toFixed(1)}` : 'Signos guardados'); cargar();
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') cargar(); });
    cont.addEventListener('click', async (e) => {
      const ll = e.target.closest('[data-llego]'), sg = e.target.closest('[data-signos]'), pa = e.target.closest('[data-pasar]');
      if (ll) { const { error } = await sb.from('cli_citas').update({ estado: 'EN ESPERA' }).eq('id', Number(ll.dataset.llego)); if (error) return window.FIN.aviso(errorTxt(error)); sel = Number(ll.dataset.llego); return cargar(); }
      if (sg) { sel = Number(sg.dataset.signos); return pintar(); }
      if (pa) {
        const c = citas.find((x) => x.id === Number(pa.dataset.pasar));
        if (!consultaDe(c)) { const r = await sb.from('cli_consultas').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, numero: 0, cita_id: c.id, paciente_id: c.paciente_id, medico_id: c.medico_id, motivo: c.motivo }); if (r.error) return window.FIN.aviso(errorTxt(r.error)); }
        const { error } = await sb.from('cli_citas').update({ estado: 'EN CONSULTA' }).eq('id', c.id); if (error) return window.FIN.aviso(errorTxt(error)); sel = null; return cargar();
      }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'refrescar') return cargar();
      if (a === 'guardar-signos') return guardarSignos();
    });
    iniciar();
  };

  // ===================== Consulta médica (SOAP) =====================
  window.PANTALLAS['cli-consulta'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Consulta médica', icono: 'ti-stethoscope', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Clínicas médicas · Registros' });
    const { sb } = ctx;
    const f = { fecha: hoy(), medico: '' }; let B = null, lista = [], K = null, det = null, dx = [], meds = [], plantillas = [];
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar(id = K?.id) {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-stethoscope'); return; }
      try {
        B = await baseClinica(ctx);
        if (!dx.length) { const [d, m, p] = await Promise.all([sb.from('cli_diagnosticos').select('codigo, descripcion').eq('activo', true).order('codigo'), sb.from('cli_medicamentos').select('*').eq('localidad_id', ctx.sel.loc).eq('activo', true).order('nombre'), sb.from('cli_plantillas').select('*').eq('localidad_id', ctx.sel.loc).eq('activo', true).order('nombre')]); dx = d.data || []; meds = m.data || []; plantillas = p.data || []; }
      } catch (e) { return falta(ctx, e); }
      ctx.filtros(`<label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${f.fecha}"></label><label class="campo"><span>Médico</span><select name="medico">${opt(B.medicos.filter((m) => m.activo), f.medico, 'id', (m) => m.nombre, 'Todos')}</select></label>`, ctx.admin ? btn('nueva', 'ti-plus', 'Consulta sin cita') : '');
      const { data } = await sb.from('cli_consultas').select('*').eq('localidad_id', ctx.sel.loc).gte('fecha', `${f.fecha}T00:00:00-06:00`).lte('fecha', `${f.fecha}T23:59:59-06:00`).order('numero');
      lista = (data || []).filter((k) => !f.medico || String(k.medico_id) === String(f.medico));
      K = lista.find((k) => k.id === id) || (id ? (await sb.from('cli_consultas').select('*').eq('id', id).maybeSingle()).data : null);
      det = K ? await detalle(K.id) : null; pintar();
    }
    async function detalle(id) {
      const [d, r, o, h] = await Promise.all([sb.from('cli_consulta_diagnosticos').select('*').eq('consulta_id', id).order('id'), sb.from('cli_recetas').select('*').eq('consulta_id', id).order('id'), sb.from('cli_ordenes').select('*').eq('consulta_id', id).order('id'),
        sb.from('cli_consultas').select('numero, fecha, motivo, cli_consulta_diagnosticos(codigo, descripcion)').eq('paciente_id', K.paciente_id).neq('id', id).order('fecha', { ascending: false }).limit(5)]);
      const ex = await sb.from('cli_expedientes').select('alergias, medicamentos_cronicos, antecedentes_personales').eq('paciente_id', K.paciente_id).maybeSingle();
      return { d: d.data || [], r: r.data || [], o: o.data || [], h: h.data || [], ex: ex.data || {} };
    }
    function pintar() {
      const k = K, ed = ctx.admin && k?.estado === 'ABIERTA', dis = ed ? '' : 'disabled', p = k ? B.pacientes.find((x) => x.id === k.paciente_id) : null;
      const ta = (n, l, rows = 3) => `<label class="campo sat-ancho"><span>${l}</span><textarea name="${n}" rows="${rows}" ${dis}>${esc(k[n] || '')}</textarea></label>`;
      const imc = k?.peso_kg && k?.talla_cm ? (k.peso_kg / ((k.talla_cm / 100) ** 2)).toFixed(1) : '';
      ctx.pDet.innerHTML = `<div class="nom-dos"><aside class="nom-lista">${tabla({ columnas: [col('No.', 'texto', 5), col('Paciente', 'texto', 24), col('Estado', 'texto', 9)], filas: lista.map((x) => ({ valores: [String(x.numero), nomPac(B.pacientes.find((y) => y.id === x.paciente_id)), `¤${x.estado}`], attr: `data-con="${x.id}" style="cursor:pointer"`, resaltar: x.id === k?.id })), vacio: 'Sin consultas en el día. Pasa pacientes desde Recepción.' }, false)}</aside>
        <section>${k ? `<form class="cli-soap" novalidate><div class="cl-banda">Consulta ${k.numero} · ${esc(nomPac(p))}${p?.fecha_nacimiento ? ` · ${edad(p.fecha_nacimiento)} años` : ''} · ${esc(nomMed(B, k.medico_id))} · ${marca(k.estado)}</div>
          ${det.ex.alergias ? `<p class="pr-guia pc-rojo"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Alergias: ${esc(det.ex.alergias)}</p>` : ''}
          <div class="ec-kpis">${kpi('Peso', k.peso_kg ? `${k.peso_kg} kg` : '—')}${kpi('Talla', k.talla_cm ? `${k.talla_cm} cm` : '—')}${kpi('IMC', imc || '—', imc && (imc < 18.5 || imc >= 30) ? 'ec-alerta' : '')}${kpi('Presión', k.presion || '—')}${kpi('Temp.', k.temperatura ? `${k.temperatura} °C` : '—')}${kpi('SpO₂', k.saturacion ? `${k.saturacion} %` : '—')}</div>
          <div class="sat-g">${plantillas.length && ed ? `<label class="campo"><span>Plantilla</span><select name="plantilla">${opt(plantillas, '', 'id', (x) => x.nombre, 'Cargar plantilla…')}</select></label>` : ''}
          ${ta('motivo', 'S · Motivo de consulta', 2)}${ta('historia', 'S · Historia de la enfermedad actual')}${ta('examen_fisico', 'O · Examen físico')}${ta('plan', 'P · Plan')}${ta('indicaciones', 'Indicaciones al paciente', 2)}
          <label class="campo"><span>Próxima cita</span><input type="date" name="proxima_cita" value="${k.proxima_cita || ''}" ${dis}></label></div>
          <div class="cl-banda">A · Diagnósticos (CIE-10)</div>
          ${tabla({ columnas: [col('Código', 'texto', 8), col('Diagnóstico', 'texto', 40), col('Tipo', 'texto', 10), col('Condición', 'texto', 10)], acciones: ed, filas: det.d.map((x) => ({ valores: [x.codigo, x.descripcion, x.tipo, x.condicion], acciones: ed ? `<button type="button" class="icono-boton rp-peligro" data-qdx="${x.id}" title="Quitar"><i class="ti ti-trash" aria-hidden="true"></i></button>` : '' })), vacio: 'Agrega al menos un diagnóstico.' }, false)}
          ${ed ? `<div class="sat-g"><label class="campo sat-ancho"><span>Agregar diagnóstico</span><input name="nuevo_dx" list="cli-dx" placeholder="Código o nombre CIE-10" autocomplete="off"></label><label class="campo"><span>Tipo</span><select name="tipo_dx"><option>PRINCIPAL</option><option>SECUNDARIO</option></select></label><label class="campo"><span>Condición</span><select name="cond_dx"><option>NUEVO</option><option>SUBSECUENTE</option></select></label>${btn('agregar-dx', 'ti-plus', 'Agregar')}</div><datalist id="cli-dx">${dx.map((d) => `<option value="${esc(`${d.codigo} · ${d.descripcion}`)}"></option>`).join('')}</datalist>` : ''}
          <div class="cl-banda">Receta</div>
          ${tabla({ columnas: [col('Medicamento', 'texto', 26), col('Dosis', 'texto', 14), col('Frecuencia', 'texto', 14), col('Duración', 'texto', 12), col('Vía', 'texto', 10), col('Cantidad', 'texto', 10)], acciones: ed, filas: det.r.map((x) => ({ valores: [x.medicamento, x.dosis || '', x.frecuencia || '', x.duracion || '', x.via || '', x.cantidad || ''], acciones: ed ? `<button type="button" class="icono-boton rp-peligro" data-qrx="${x.id}" title="Quitar"><i class="ti ti-trash" aria-hidden="true"></i></button>` : '' })), vacio: 'Sin medicamentos.' }, false)}
          ${ed ? `<div class="sat-g"><label class="campo sat-ancho"><span>Medicamento</span><input name="rx_med" list="cli-med" autocomplete="off"></label><label class="campo"><span>Dosis</span><input name="rx_dosis"></label><label class="campo"><span>Frecuencia</span><input name="rx_frec" placeholder="CADA 8 HORAS"></label><label class="campo"><span>Duración</span><input name="rx_dur" placeholder="5 DÍAS"></label><label class="campo"><span>Vía</span><input name="rx_via" value="ORAL"></label><label class="campo"><span>Cantidad</span><input name="rx_cant"></label>${btn('agregar-rx', 'ti-plus', 'Agregar')}</div><datalist id="cli-med">${meds.map((m) => `<option value="${esc(`${m.nombre} ${m.concentracion || ''} ${m.presentacion || ''}`.trim())}">${esc(m.dosis_habitual || '')}</option>`).join('')}</datalist>` : ''}
          <div class="cl-banda">Órdenes de laboratorio, imagen y procedimientos</div>
          ${tabla({ columnas: [col('Tipo', 'texto', 12), col('Descripción', 'texto', 34), col('Estado', 'texto', 12), col('Resultado', 'texto', 30)], filas: det.o.map((x) => ({ valores: [x.tipo, x.descripcion, `¤${x.estado}`, x.resultado || ''] })), vacio: 'Sin órdenes.' }, false)}
          ${ed ? `<div class="sat-g"><label class="campo sat-ancho"><span>Ordenar</span><select name="orden_srv">${opt(B.servicios.filter((s) => s.activo && ['LABORATORIO', 'IMAGEN', 'PROCEDIMIENTO'].includes(s.tipo)), '', 'id', (s) => `${s.tipo} · ${s.nombre}`, 'Elige el examen o procedimiento')}</select></label><label class="campo sat-ancho"><span>o interconsulta / referencia</span><input name="orden_txt" placeholder="INTERCONSULTA A CARDIOLOGÍA"></label>${btn('agregar-orden', 'ti-plus', 'Agregar')}</div>` : ''}
          ${det.h.length ? `<div class="cl-banda">Consultas anteriores</div><p class="pr-guia">${det.h.map((x) => `${fmt.fechaDia(diaGt(x.fecha))}: ${esc(x.motivo || '')} — ${esc((x.cli_consulta_diagnosticos || []).map((d) => d.codigo).join(', '))}`).join('<br>')}</p>` : ''}
          <p class="acciones-form">${ed ? `${btn('guardar', 'ti-device-floppy', 'Guardar', '', 'primario-sm')} ${btn('cerrar', 'ti-lock', 'Cerrar consulta')} ` : ''}${btn('receta', 'ti-printer', 'Imprimir receta')} ${btn('ordenes', 'ti-printer', 'Imprimir órdenes')} <a class="boton secundario-sm" href="#/clinicas/cli-cobro"><i class="ti ti-cash" aria-hidden="true"></i> Ir a cobro</a> <a class="boton secundario-sm" href="#/clinicas/cli-documentos"><i class="ti ti-certificate" aria-hidden="true"></i> Constancia</a> ${ctx.admin ? btn('hospitalizar', 'ti-building-hospital', 'Trasladar a hospitalización') : ''}</p></form>`
          : ctx.vacio('Elige una consulta de la lista.', 'ti-stethoscope')}</section></div>${listaPac(B)}`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    const datos = () => Object.fromEntries(new FormData(cont.querySelector('form.cli-soap')).entries());
    async function guardar(silencio = false) {
      const d = datos(); const reg = {}; ['motivo', 'historia', 'examen_fisico', 'plan', 'indicaciones'].forEach((k) => { reg[k] = (d[k] || '').trim() || null; }); reg.proxima_cita = d.proxima_cita || null;
      const { error } = await sb.from('cli_consultas').update(reg).eq('id', K.id); if (error) { window.FIN.aviso(errorTxt(error)); return false; }
      Object.assign(K, reg); if (!silencio) window.FIN.aviso('Consulta guardada'); return true;
    }
    function imprimirReceta() {
      const p = B.pacientes.find((x) => x.id === K.paciente_id), m = B.medicos.find((x) => x.id === K.medico_id);
      imprimir(`Receta · consulta ${K.numero}`, `<h2>Receta médica</h2><p><b>Paciente:</b> ${esc(nomPac(p))}${p?.fecha_nacimiento ? ` · ${edad(p.fecha_nacimiento)} años` : ''} · <b>Fecha:</b> ${fmt.fechaDia(diaGt(K.fecha))}</p><p><b>Diagnóstico:</b> ${esc(det.d.map((x) => `${x.codigo} ${x.descripcion}`).join('; '))}</p>
        <table><tr><th>Medicamento</th><th>Dosis</th><th>Frecuencia</th><th>Duración</th><th>Vía</th><th>Cantidad</th></tr>${det.r.map((x) => `<tr><td>${esc(x.medicamento)}</td><td>${esc(x.dosis || '')}</td><td>${esc(x.frecuencia || '')}</td><td>${esc(x.duracion || '')}</td><td>${esc(x.via || '')}</td><td>${esc(x.cantidad || '')}</td></tr>`).join('')}</table>
        ${K.indicaciones ? `<p><b>Indicaciones:</b> ${esc(K.indicaciones)}</p>` : ''}${K.proxima_cita ? `<p><b>Próxima cita:</b> ${fmt.fechaDia(K.proxima_cita)}</p>` : ''}<p style="margin-top:60px;text-align:center">______________________________<br>${esc(m?.nombre || '')}<br>Colegiado ${esc(m?.colegiado || '')}</p>`);
    }
    function imprimirOrdenes() {
      const p = B.pacientes.find((x) => x.id === K.paciente_id), m = B.medicos.find((x) => x.id === K.medico_id);
      if (!det.o.length) return window.FIN.aviso('La consulta no tiene órdenes');
      imprimir(`Órdenes · consulta ${K.numero}`, `<h2>Orden de exámenes y procedimientos</h2><p><b>Paciente:</b> ${esc(nomPac(p))} · <b>Fecha:</b> ${fmt.fechaDia(diaGt(K.fecha))}</p><p><b>Diagnóstico:</b> ${esc(det.d.map((x) => `${x.codigo} ${x.descripcion}`).join('; '))}</p><table><tr><th>Tipo</th><th>Examen / procedimiento</th><th>Indicaciones</th></tr>${det.o.map((x) => `<tr><td>${esc(x.tipo)}</td><td>${esc(x.descripcion)}</td><td>${esc(x.indicaciones || '')}</td></tr>`).join('')}</table><p style="margin-top:60px;text-align:center">______________________________<br>${esc(m?.nombre || '')}</p>`);
    }
    cont.addEventListener('change', async (e) => {
      const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') { K = null; dx = []; return cargar(null); }
      if (e.target.closest('.bk-filtros') && ['fecha', 'medico'].includes(e.target.name)) { f[e.target.name] = e.target.value || (e.target.name === 'fecha' ? hoy() : ''); return cargar(null); }
      if (e.target.name === 'plantilla' && e.target.value) { const pl = plantillas.find((x) => String(x.id) === e.target.value); ['historia', 'examen_fisico', 'plan'].forEach((k) => { const t = cont.querySelector(`[name=${k}]`); if (t && pl[k] && !t.value.trim()) t.value = pl[k]; }); }
      if (e.target.name === 'rx_med') { const m = meds.find((x) => `${x.nombre} ${x.concentracion || ''} ${x.presentacion || ''}`.trim() === e.target.value); if (m) { cont.querySelector('[name=rx_dosis]').value = m.dosis_habitual || ''; cont.querySelector('[name=rx_via]').value = m.via || 'ORAL'; } }
    });
    cont.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr[data-con]'); if (tr) return cargar(Number(tr.dataset.con));
      const qd = e.target.closest('[data-qdx]'), qr = e.target.closest('[data-qrx]');
      if (qd) { await sb.from('cli_consulta_diagnosticos').delete().eq('id', Number(qd.dataset.qdx)); det = await detalle(K.id); return pintar(); }
      if (qr) { await sb.from('cli_recetas').delete().eq('id', Number(qr.dataset.qrx)); det = await detalle(K.id); return pintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion; if (!a) return;
      if (a === 'nueva') {
        const t = prompt('Paciente (expediente):'); if (!t) return; const p = B.pacientes.find((x) => x.expediente === Number(t)); if (!p) return window.FIN.aviso('No existe ese expediente');
        const m = Number(f.medico) || B.medicos.find((x) => x.activo)?.id; if (!m) return window.FIN.aviso('Registra primero un médico');
        const { data, error } = await sb.from('cli_consultas').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, numero: 0, paciente_id: p.id, medico_id: m }).select().single(); if (error) return window.FIN.aviso(errorTxt(error)); f.fecha = hoy(); return cargar(data.id);
      }
      if (a === 'guardar') return guardar();
      if (a === 'agregar-dx') {
        const d = datos(); const cod = (d.nuevo_dx || '').split(' · ')[0].trim().toUpperCase(); const x = dx.find((y) => y.codigo === cod) || dx.find((y) => y.descripcion.toUpperCase().includes(cod));
        if (!x) return window.FIN.aviso('Elige un diagnóstico de la lista CIE-10 (o agrégalo en Catálogos › Diagnósticos CIE-10)');
        await guardar(true);
        const { error } = await sb.from('cli_consulta_diagnosticos').insert({ consulta_id: K.id, codigo: x.codigo, descripcion: x.descripcion, tipo: det.d.length ? d.tipo_dx : 'PRINCIPAL', condicion: d.cond_dx }); if (error) return window.FIN.aviso(errorTxt(error)); det = await detalle(K.id); return pintar();
      }
      if (a === 'agregar-rx') {
        const d = datos(); if (!d.rx_med.trim()) return window.FIN.aviso('Escribe el medicamento'); await guardar(true);
        const { error } = await sb.from('cli_recetas').insert({ consulta_id: K.id, medicamento: d.rx_med.trim().toUpperCase(), dosis: d.rx_dosis.trim().toUpperCase() || null, frecuencia: d.rx_frec.trim().toUpperCase() || null, duracion: d.rx_dur.trim().toUpperCase() || null, via: d.rx_via.trim().toUpperCase() || null, cantidad: d.rx_cant.trim().toUpperCase() || null });
        if (error) return window.FIN.aviso(errorTxt(error)); det = await detalle(K.id); return pintar();
      }
      if (a === 'agregar-orden') {
        const d = datos(); const s = B.servicios.find((x) => String(x.id) === d.orden_srv); const txt = d.orden_txt.trim().toUpperCase();
        if (!s && !txt) return window.FIN.aviso('Elige el examen o escribe la interconsulta'); await guardar(true);
        const { error } = await sb.from('cli_ordenes').insert({ consulta_id: K.id, servicio_id: s?.id || null, tipo: s ? (s.tipo === 'IMAGEN' ? 'IMAGEN' : s.tipo === 'LABORATORIO' ? 'LABORATORIO' : 'PROCEDIMIENTO') : 'INTERCONSULTA', descripcion: s ? s.nombre : txt });
        if (error) return window.FIN.aviso(errorTxt(error)); det = await detalle(K.id); return pintar();
      }
      if (a === 'cerrar') { if (!(await guardar(true))) return; if (!confirm('¿Cerrar la consulta? Ya no se podrá modificar.')) return; const { error } = await sb.rpc('cli_cerrar_consulta', { p_id: K.id }); if (error) return window.FIN.aviso(errorTxt(error)); window.FIN.aviso('Consulta cerrada: la cita quedó atendida'); return cargar(); }
      if (a === 'receta') return imprimirReceta();
      if (a === 'ordenes') return imprimirOrdenes();
      if (a === 'hospitalizar') {
        if (!confirm('¿Trasladar al paciente a hospitalización? Se abre su admisión en el módulo Hospital.')) return;
        const { data, error } = await sb.from('hos_admisiones').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, numero: 0, paciente_id: K.paciente_id, tipo: 'HOSPITALIZACIÓN', medico_id: K.medico_id, diagnostico_ingreso: det.d.map((x) => `${x.codigo} ${x.descripcion}`).join('; ') || K.motivo, aseguradora_id: B.pacientes.find((x) => x.id === K.paciente_id)?.aseguradora_id || null }).select().single();
        if (error) return window.FIN.aviso(errorTxt(error)); window.FIN.aviso(`Admisión ${data.numero} abierta en Hospital: asígnale cama en Admisión`);
      }
    });
    iniciar();
  };

  // ===================== Órdenes y resultados =====================
  window.PANTALLAS['cli-ordenes'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Órdenes y resultados', icono: 'ti-microscope', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Clínicas médicas · Registros' });
    const { sb } = ctx;
    const f = { estado: 'PENDIENTE', desde: sumarDias(hoy(), -30) }; let B = null, ords = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-microscope'); return; }
      try { B = await baseClinica(ctx); } catch (e) { return falta(ctx, e); }
      ctx.filtros(`<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}"></label><label class="campo"><span>Estado</span><select name="estado">${['', 'PENDIENTE', 'REALIZADA', 'CON RESULTADO', 'CANCELADA'].map((x) => `<option value="${x}" ${f.estado === x ? 'selected' : ''}>${x || 'Todas'}</option>`).join('')}</select></label>`, botonesExp);
      let x = sb.from('cli_ordenes').select('*, cli_consultas!inner(numero, fecha, paciente_id, medico_id, localidad_id)').eq('cli_consultas.localidad_id', ctx.sel.loc).gte('cli_consultas.fecha', `${f.desde}T00:00:00-06:00`).order('id', { ascending: false });
      if (f.estado) x = x.eq('estado', f.estado);
      const { data, error } = await x; if (error) return falta(ctx, error); ords = data || []; pintar();
    }
    function pintar() {
      cfg = { titulo: 'Órdenes y resultados', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Órdenes', archivo: 'ordenes_clinica', parametros: [`Empresa: ${empresaDe(ctx)}`, `Desde ${fmt.fechaDia(f.desde)}`, `Estado: ${f.estado || 'Todas'}`],
        columnas: [col('Consulta', 'texto', 8), col('Fecha', 'texto', 10), col('Paciente', 'texto', 26), col('Médico', 'texto', 20), col('Tipo', 'texto', 12), col('Examen', 'texto', 26), col('Estado', 'texto', 12), col('Resultado', 'texto', 30)], acciones: ctx.admin,
        filas: ords.map((o) => ({ valores: [String(o.cli_consultas.numero), fmt.fechaDia(diaGt(o.cli_consultas.fecha)), nomPac(B.pacientes.find((p) => p.id === o.cli_consultas.paciente_id)), nomMed(B, o.cli_consultas.medico_id), o.tipo, o.descripcion, `¤${o.estado}`, o.resultado || ''],
          acciones: ctx.admin && o.estado !== 'CON RESULTADO' ? `<button type="button" class="boton secundario-sm" data-res="${o.id}">Resultado</button>${o.estado === 'PENDIENTE' ? ` <button type="button" class="boton secundario-sm" data-real="${o.id}">Realizada</button>` : ''}` : '' })), vacio: 'Sin órdenes con esos filtros.' };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Órdenes', ords.length)}${kpi('Pendientes', ords.filter((o) => o.estado === 'PENDIENTE').length, 'ec-alerta')}${kpi('Con resultado', ords.filter((o) => o.estado === 'CON RESULTADO').length, 'ec-fin')}</div>${tabla(cfg, false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); if (['estado', 'desde'].includes(e.target.name)) { f[e.target.name] = e.target.value; cargar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp, false);
      const r = e.target.closest('[data-res]'), re = e.target.closest('[data-real]');
      if (re) { await sb.from('cli_ordenes').update({ estado: 'REALIZADA' }).eq('id', Number(re.dataset.real)); return cargar(); }
      if (r) { const t = prompt('Resultado (texto o valores):'); if (!t) return; const { error } = await sb.from('cli_ordenes').update({ estado: 'CON RESULTADO', resultado: t.trim(), fecha_resultado: hoy() }).eq('id', Number(r.dataset.res)); if (error) return window.FIN.aviso(errorTxt(error)); cargar(); }
    });
    iniciar();
  };

  // ===================== Constancias y referencias =====================
  window.PANTALLAS['cli-documentos'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Constancias y referencias', icono: 'ti-certificate', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Clínicas médicas · Registros' });
    const { sb } = ctx;
    let B = null, docs = [], form = null, cfg = null;
    const TIPOS = ['CERTIFICADO MÉDICO', 'INCAPACIDAD', 'REFERENCIA', 'CONSTANCIA DE ASISTENCIA'];
    const texto = (t, p, d) => (t === 'INCAPACIDAD' ? `Se hace constar que ${p} requiere reposo médico por ${d.dias || '__'} día(s), del ${d.desde ? fmt.fechaDia(d.desde) : '__'} al ${d.hasta ? fmt.fechaDia(d.hasta) : '__'}, por motivo de ${d.dx || 'enfermedad'}.`
      : t === 'REFERENCIA' ? `Refiero a ${p} a ${d.destino || '__'} para evaluación y manejo. Diagnóstico: ${d.dx || '__'}. Agradezco su atención.`
        : t === 'CONSTANCIA DE ASISTENCIA' ? `Se hace constar que ${p} asistió a consulta médica en esta clínica el ${fmt.fechaDia(hoy())}.`
          : `Certifico que examiné a ${p}, quien se encuentra en buen estado de salud física y mental al momento de la evaluación.`);
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-certificate'); return; }
      try { B = await baseClinica(ctx); } catch (e) { return falta(ctx, e); }
      ctx.filtros('', `${ctx.admin ? btn('nuevo', 'ti-plus', 'Nuevo documento', '', 'primario-sm') : ''}${botonesExp}`);
      const { data, error } = await sb.from('cli_documentos').select('*').eq('localidad_id', ctx.sel.loc).order('numero', { ascending: false }).limit(300); if (error) return falta(ctx, error); docs = data || []; pintar();
    }
    function pintar() {
      cfg = { titulo: 'Constancias y referencias', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Documentos', archivo: 'constancias', parametros: [`Empresa: ${empresaDe(ctx)}`],
        columnas: [col('No.', 'texto', 6), col('Fecha', 'texto', 10), col('Tipo', 'texto', 20), col('Paciente', 'texto', 28), col('Médico', 'texto', 22), col('Días', 'numero', 6), col('Destino', 'texto', 20)], acciones: true,
        filas: docs.map((d) => ({ valores: [String(d.numero), fmt.fechaDia(d.fecha), d.tipo, nomPac(B.pacientes.find((p) => p.id === d.paciente_id)), nomMed(B, d.medico_id), d.dias ?? '', d.destino || ''], acciones: `<button type="button" class="boton secundario-sm" data-imp="${d.id}"><i class="ti ti-printer" aria-hidden="true"></i></button>` })), vacio: 'Sin documentos emitidos.' };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">${form ? `<form class="cli-doc" novalidate><div class="cl-banda">Nuevo documento</div><div class="sat-g">
        <label class="campo"><span>Tipo</span><select name="tipo">${TIPOS.map((t) => `<option ${form.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo sat-ancho"><span>Paciente *</span><input name="paciente" list="cli-pac" autocomplete="off"></label><label class="campo"><span>Médico</span><select name="medico_id">${opt(B.medicos.filter((m) => m.activo), '', 'id', (m) => m.nombre, null)}</select></label>
        <label class="campo"><span>Días</span><input type="number" name="dias" min="0"></label><label class="campo"><span>Desde</span><input type="date" name="desde" value="${hoy()}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta"></label>
        <label class="campo"><span>Destino (referencia)</span><input name="destino"></label><label class="campo sat-ancho"><span>Diagnóstico o motivo</span><input name="dx"></label>
        <label class="campo sat-ancho"><span>Texto (se propone; puedes editarlo)</span><textarea name="texto" rows="4"></textarea></label></div>
        <p class="acciones-form">${btn('proponer', 'ti-wand', 'Proponer texto')} ${btn('guardar', 'ti-device-floppy', 'Emitir', '', 'primario-sm')} ${btn('cancelar', 'ti-x', 'Cancelar')}</p></form>${listaPac(B)}` : ''}${tabla(cfg, false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    function imprimirDoc(d) {
      const p = B.pacientes.find((x) => x.id === d.paciente_id), m = B.medicos.find((x) => x.id === d.medico_id);
      imprimir(`${d.tipo} No. ${d.numero}`, `<h2>${esc(d.tipo)}</h2><p style="text-align:right">No. ${d.numero} · ${fmt.fechaDia(d.fecha)}</p><p style="font-size:14px;line-height:1.8">${esc(d.texto)}</p><p>Paciente: ${esc(nomPac(p))}${p?.dpi ? ` · DPI ${esc(p.dpi)}` : ''}</p><p style="margin-top:80px;text-align:center">______________________________<br>${esc(m?.nombre || '')}<br>Colegiado ${esc(m?.colegiado || '')}</p>`);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') cargar(); });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp, false);
      const im = e.target.closest('[data-imp]'); if (im) return imprimirDoc(docs.find((d) => String(d.id) === im.dataset.imp));
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'nuevo') { form = { tipo: 'CERTIFICADO MÉDICO' }; return pintar(); }
      if (a === 'cancelar') { form = null; return pintar(); }
      const fr = cont.querySelector('form.cli-doc'); if (!fr) return; const d = Object.fromEntries(new FormData(fr).entries()); const p = pacDe(B, d.paciente);
      if (a === 'proponer') { if (!p) return window.FIN.aviso('Elige el paciente'); fr.querySelector('[name=texto]').value = texto(d.tipo, `${p.nombres} ${p.apellidos}`, d); return; }
      if (a === 'guardar') {
        if (!p) return window.FIN.aviso('Elige el paciente'); const tx = d.texto.trim() || texto(d.tipo, `${p.nombres} ${p.apellidos}`, d);
        const { data, error } = await sb.from('cli_documentos').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, numero: 0, paciente_id: p.id, medico_id: Number(d.medico_id) || null, tipo: d.tipo, dias: d.dias ? Number(d.dias) : null, desde: d.desde || null, hasta: d.hasta || null, destino: d.destino.trim().toUpperCase() || null, texto: tx }).select().single();
        if (error) return window.FIN.aviso(errorTxt(error)); form = null; await cargar(); imprimirDoc(data);
      }
    });
    iniciar();
  };

  // ===================== Cobro de consulta =====================
  window.PANTALLAS['cli-cobro'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Cobro de consulta', icono: 'ti-cash-register', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Clínicas médicas · Caja' });
    const { sb } = ctx;
    const f = { fecha: hoy() }; let B = null, cobros = [], pend = [], lineas = [], tarifas = [], paquetes = [], cab = {}, cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-cash-register'); return; }
      try { B = await baseClinica(ctx); } catch (e) { return falta(ctx, e); }
      ctx.filtros(`<label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${f.fecha}"></label>`, botonesExp);
      const [c, a, t] = await Promise.all([sb.from('cli_cobros').select('*, cli_cobro_lineas(descripcion, total)').eq('localidad_id', ctx.sel.loc).eq('fecha', f.fecha).order('numero', { ascending: false }),
        sb.from('cli_citas').select('*').eq('localidad_id', ctx.sel.loc).eq('fecha', f.fecha).in('estado', ['ATENDIDA', 'EN CONSULTA']),
        B.servicios.length ? sb.from('cli_tarifas').select('*').in('servicio_id', B.servicios.map((s) => s.id)) : { data: [] }]);
      if (c.error) return falta(ctx, c.error);
      cobros = c.data || []; tarifas = t.data || []; pend = (a.data || []).filter((x) => !cobros.some((y) => y.cita_id === x.id && y.estado === 'PAGADO'));
      pintar();
    }
    async function elegirPaciente(p, cita = null) {
      cab = { paciente_id: p.id, aseguradora_id: cita ? cita.aseguradora_id : p.aseguradora_id, cita_id: cita?.id || null, nit: p.nit || 'CF', nombre: `${p.nombres} ${p.apellidos}`, forma: 'EFECTIVO' };
      const { data } = await sb.from('cli_paquetes_vendidos').select('*').eq('paciente_id', p.id).eq('estado', 'ACTIVO'); paquetes = data || [];
      if (cita) { const { data: k } = await sb.from('cli_consultas').select('id').eq('cita_id', cita.id).neq('estado', 'ANULADA').maybeSingle(); cab.consulta_id = k?.id || null; }
      lineas = cita?.servicio_id ? [{ servicio_id: cita.servicio_id, medico_id: cita.medico_id, cantidad: 1 }] : [];
      pintar();
    }
    const precioDe = (l) => { const s = B.servicios.find((x) => x.id === Number(l.servicio_id)); const t = cab.aseguradora_id && tarifas.find((x) => x.servicio_id === s?.id && x.aseguradora_id === Number(cab.aseguradora_id)); return { s, precio: t ? num(t.precio) : num(s?.precio), copago: t ? num(t.copago) : null }; };
    const parte = (l) => { if (l.paquete_vendido_id) return [0, 0]; const { precio, copago } = precioDe(l); const tot = r2(precio * num(l.cantidad || 1)); if (!cab.aseguradora_id) return [tot, 0]; const ag = B.aseguradoras.find((a) => a.id === Number(cab.aseguradora_id)); const pac = Math.min(tot, copago != null ? copago * num(l.cantidad || 1) : r2(tot * num(ag?.coaseguro_pct) / 100)); return [pac, r2(tot - pac)]; };
    function pintar() {
      const totPac = sum(lineas.map((l) => parte(l)[0])), totAse = sum(lineas.map((l) => parte(l)[1]));
      cfg = { titulo: `Cobros del ${fmt.fechaDia(f.fecha)}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Cobros', archivo: `cobros_clinica_${f.fecha}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `Fecha ${fmt.fechaDia(f.fecha)}`],
        columnas: [col('No.', 'texto', 6), col('Paciente', 'texto', 26), col('Detalle', 'texto', 30), col('Cobertura', 'texto', 14), col('Forma', 'texto', 12), col('Paciente Q', 'monto', 12), col('Aseguradora Q', 'monto', 12), col('Estado', 'texto', 10)], acciones: ctx.admin,
        filas: cobros.map((c) => ({ valores: [String(c.numero), nomPac(B.pacientes.find((p) => p.id === c.paciente_id)), (c.cli_cobro_lineas || []).map((l) => l.descripcion).join(', '), nomAse(B, c.aseguradora_id), c.forma, r2(c.parte_paciente), r2(c.parte_aseguradora), `¤${c.estado}`],
          acciones: `<button type="button" class="boton secundario-sm" data-recibo="${c.id}"><i class="ti ti-printer" aria-hidden="true"></i></button>${ctx.admin && c.estado === 'PAGADO' && !c.cierre_id ? ` <button type="button" class="boton secundario-sm rp-peligro" data-anular="${c.id}">Anular</button>` : ''}` })), vacio: 'Sin cobros en el día.' };
      const p = cab.paciente_id ? B.pacientes.find((x) => x.id === cab.paciente_id) : null;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Cobros', cobros.filter((c) => c.estado === 'PAGADO').length)}${kpi('Pacientes', q(sum(cobros.filter((c) => c.estado === 'PAGADO').map((c) => c.parte_paciente))), 'ec-fin')}${kpi('Aseguradoras', q(sum(cobros.filter((c) => c.estado === 'PAGADO').map((c) => c.parte_aseguradora))))}${kpi('Atendidos sin cobrar', pend.length, pend.length ? 'ec-alerta' : '')}</div>
        ${pend.length ? `<p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Atendidos sin cobrar: ${pend.map((c) => `<button type="button" class="pc-marca pendiente" data-pend="${c.id}">${esc(nomPac(B.pacientes.find((x) => x.id === c.paciente_id)))}</button>`).join(' ')}</p>` : ''}
        ${ctx.admin ? `<form class="cli-cobro" novalidate><div class="cl-banda">${p ? `Cobro a ${esc(nomPac(p))}` : 'Nuevo cobro'}</div><div class="sat-g">
          <label class="campo sat-ancho"><span>Paciente</span><input name="paciente" list="cli-pac" value="${esc(nomPac(p))}" autocomplete="off"></label>
          ${p ? `<label class="campo"><span>Cobertura</span><select name="aseguradora_id">${opt(B.aseguradoras, cab.aseguradora_id, 'id', (a) => `${a.nombre} (coaseguro ${a.coaseguro_pct} %)`, 'Particular')}</select></label>
          <label class="campo"><span>Forma de pago</span><select name="forma">${['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE'].map((x) => `<option ${cab.forma === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label class="campo"><span>Referencia</span><input name="referencia" value="${esc(cab.referencia || '')}"></label>
          <label class="campo"><span>NIT</span><input name="nit" value="${esc(cab.nit || '')}"></label><label class="campo"><span>Nombre factura</span><input name="nombre" value="${esc(cab.nombre || '')}"></label><label class="campo"><span>Factura (DTE)</span><input name="factura" value="${esc(cab.factura || '')}"></label>` : ''}</div>
          ${p ? `<div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr><th>Servicio</th><th>Médico</th><th>Paquete</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Paciente</th><th class="num">Aseguradora</th><th>Bodega (insumo)</th><th></th></tr></thead><tbody>
            ${lineas.map((l, i) => { const { precio, s } = precioDe(l); const [pp, pa] = parte(l); const usaInsumo = s?.producto_id && (s.tipo === 'INSUMO' || num(s.cantidad_insumo) > 0); return `<tr data-lin="${i}"><td><select data-l="servicio_id">${opt(B.servicios.filter((x) => x.activo && x.tipo !== 'PAQUETE'), l.servicio_id, 'id', (x) => `${x.codigo} · ${x.nombre}`, null)}</select></td>
              <td><select data-l="medico_id">${opt(B.medicos.filter((m) => m.activo), l.medico_id, 'id', (m) => m.nombre)}</select></td><td><select data-l="paquete_vendido_id">${opt(paquetes, l.paquete_vendido_id, 'id', (x) => `No. ${x.numero} (${x.sesiones - x.usadas} disp.)`, 'No')}</select></td>
              <td class="num"><input data-l="cantidad" type="number" min="1" step="1" value="${l.cantidad || 1}" style="width:60px"></td><td class="num">${fmt.monto(precio)}</td><td class="num">${fmt.monto(pp)}</td><td class="num">${fmt.monto(pa)}</td>
              <td>${usaInsumo ? `<select data-l="bodega_id">${opt(B.bodegas, l.bodega_id, 'id', (b) => b.nombre, 'Sin descargar')}</select>` : ''}</td><td><button type="button" class="icono-boton rp-peligro" data-qlin="${i}"><i class="ti ti-trash" aria-hidden="true"></i></button></td></tr>`; }).join('')}
            <tr class="pr-t"><td colspan="5">Total</td><td class="num">${fmt.monto(totPac)}</td><td class="num">${fmt.monto(totAse)}</td><td colspan="2"></td></tr></tbody></table></div>
            <p class="acciones-form">${btn('linea', 'ti-row-insert-bottom', 'Agregar servicio')} ${btn('cobrar', 'ti-cash', `Cobrar Q ${fmt.monto(totPac)}`, '', 'primario-sm')} ${btn('limpiar', 'ti-x', 'Limpiar')}</p>` : ''}</form>${listaPac(B)}` : ''}
        ${tabla(cfg, false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    function recibo(c) {
      const p = B.pacientes.find((x) => x.id === c.paciente_id);
      sb.from('cli_cobro_lineas').select('*').eq('cobro_id', c.id).then(({ data }) => imprimir(`Recibo de clínica No. ${c.numero}`, `<h2>Recibo de caja No. ${c.numero}</h2><p>${fmt.fechaDia(c.fecha)} · Paciente: ${esc(nomPac(p))} · Cobertura: ${esc(nomAse(B, c.aseguradora_id))}${c.factura ? ` · Factura ${esc(c.factura)}` : ''}</p>
        <table><tr><th>Servicio</th><th>Médico</th><th class="n">Cant.</th><th class="n">Precio</th><th class="n">Paciente</th><th class="n">Aseguradora</th></tr>${(data || []).map((l) => `<tr><td>${esc(l.descripcion)}${l.paquete_vendido_id && c.tipo === 'SERVICIOS' ? ' (paquete)' : ''}</td><td>${esc(nomMed(B, l.medico_id))}</td><td class="n">${l.cantidad}</td><td class="n">${fmt.monto(l.precio)}</td><td class="n">${fmt.monto(l.parte_paciente)}</td><td class="n">${fmt.monto(l.parte_aseguradora)}</td></tr>`).join('')}
        <tr><th colspan="4">Total</th><th class="n">${fmt.monto(c.parte_paciente)}</th><th class="n">${fmt.monto(c.parte_aseguradora)}</th></tr></table><p>Forma de pago: ${esc(c.forma)}${c.referencia ? ` · ${esc(c.referencia)}` : ''} · Cajero: ${esc(c.cajero || '')}</p>`));
    }
    cont.addEventListener('change', async (e) => {
      const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') { cab = {}; lineas = []; return cargar(); }
      if (e.target.name === 'fecha' && e.target.closest('.bk-filtros')) { f.fecha = e.target.value || hoy(); return cargar(); }
      if (e.target.name === 'paciente') { const p = pacDe(B, e.target.value); if (p) return elegirPaciente(p); return; }
      const tr = e.target.closest('tr[data-lin]'); if (tr && e.target.dataset.l) { const l = lineas[Number(tr.dataset.lin)]; const k = e.target.dataset.l; l[k] = k === 'cantidad' ? Math.max(1, num(e.target.value)) : Number(e.target.value) || null; return pintar(); }
      if (['aseguradora_id', 'forma', 'referencia', 'nit', 'nombre', 'factura'].includes(e.target.name)) { cab[e.target.name] = e.target.name === 'aseguradora_id' ? Number(e.target.value) || null : e.target.value; if (e.target.name === 'aseguradora_id') pintar(); }
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp, false);
      const pe = e.target.closest('[data-pend]'); if (pe) { const ci = pend.find((x) => String(x.id) === pe.dataset.pend); return elegirPaciente(B.pacientes.find((p) => p.id === ci.paciente_id), ci); }
      const rc = e.target.closest('[data-recibo]'); if (rc) return recibo(cobros.find((c) => String(c.id) === rc.dataset.recibo));
      const an = e.target.closest('[data-anular]'); if (an) { const m = prompt('Motivo de la anulación:'); if (!m) return; const { error } = await sb.rpc('cli_anular_cobro', { p_id: Number(an.dataset.anular), p_motivo: m }); if (error) return window.FIN.aviso(errorTxt(error)); window.FIN.aviso('Cobro anulado'); return cargar(); }
      const ql = e.target.closest('[data-qlin]'); if (ql) { lineas.splice(Number(ql.dataset.qlin), 1); return pintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'linea') { lineas.push({ servicio_id: B.servicios.find((s) => s.activo && s.tipo !== 'PAQUETE')?.id, cantidad: 1, medico_id: lineas[0]?.medico_id || null }); return pintar(); }
      if (a === 'limpiar') { cab = {}; lineas = []; return pintar(); }
      if (a === 'cobrar') {
        if (!lineas.length) return window.FIN.aviso('Agrega al menos un servicio');
        const { data, error } = await sb.rpc('cli_cobrar', { p_loc: ctx.sel.loc, p_paciente: cab.paciente_id, p_cita: cab.cita_id || null, p_consulta: cab.consulta_id || null, p_aseguradora: cab.aseguradora_id || null,
          p_lineas: lineas.map((l) => ({ servicio_id: l.servicio_id, medico_id: l.medico_id || null, cantidad: l.cantidad || 1, paquete_vendido_id: l.paquete_vendido_id || null, bodega_id: l.bodega_id || null })), p_forma: cab.forma || 'EFECTIVO', p_referencia: cab.referencia || null, p_factura: cab.factura || null, p_nit: cab.nit || null, p_nombre: cab.nombre || null });
        if (error) return window.FIN.aviso(errorTxt(error));
        window.FIN.aviso(`Cobro ${data.numero}: paciente Q ${fmt.monto(data.paciente)} · aseguradora Q ${fmt.monto(data.aseguradora)}`); cab = {}; lineas = []; await cargar(); const c = cobros.find((x) => x.id === data.id); if (c) recibo(c);
      }
    });
    iniciar();
  };

  // ===================== Procesos: confirmación de citas y lista de espera =====================
  window.PANTALLAS['cli-confirmacion'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Confirmación de citas y lista de espera', icono: 'ti-phone-check', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Clínicas médicas · Procesos' });
    const { sb } = ctx;
    const f = { fecha: sumarDias(hoy(), 1) }; let B = null, citas = [], espera = [], vencidas = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-phone-check'); return; }
      try { B = await baseClinica(ctx); } catch (e) { return falta(ctx, e); }
      ctx.filtros(`<label class="campo"><span>Citas del</span><input type="date" name="fecha" value="${f.fecha}"></label>`, `${ctx.admin ? btn('espera', 'ti-user-plus', 'Agregar a lista de espera') : ''}${ctx.admin && vencidas.length ? btn('noshow', 'ti-user-x', 'Marcar no asistió') : ''}${botonesExp}`);
      const [c, l, v] = await Promise.all([sb.from('cli_citas').select('*').eq('localidad_id', ctx.sel.loc).eq('fecha', f.fecha).order('hora'), sb.from('cli_lista_espera').select('*').eq('localidad_id', ctx.sel.loc).eq('estado', 'EN ESPERA').order('id'),
        sb.from('cli_citas').select('id').eq('localidad_id', ctx.sel.loc).lt('fecha', hoy()).in('estado', ['PROGRAMADA', 'CONFIRMADA'])]);
      if (c.error) return falta(ctx, c.error); citas = c.data || []; espera = l.data || []; const nv = (v.data || []).length; const antes = vencidas.length; vencidas = v.data || [];
      if (antes !== nv) ctx.filtros(`<label class="campo"><span>Citas del</span><input type="date" name="fecha" value="${f.fecha}"></label>`, `${ctx.admin ? btn('espera', 'ti-user-plus', 'Agregar a lista de espera') : ''}${ctx.admin && vencidas.length ? btn('noshow', 'ti-user-x', `Marcar no asistió (${vencidas.length})`) : ''}${botonesExp}`);
      pintar();
    }
    function pintar() {
      const tel = (id) => B.pacientes.find((p) => p.id === id)?.telefono || '';
      cfg = { titulo: `Citas por confirmar del ${fmt.fechaDia(f.fecha)}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Confirmación', archivo: `confirmacion_${f.fecha}`, parametros: [`Empresa: ${empresaDe(ctx)}`, fmt.fechaDia(f.fecha)],
        columnas: [col('Hora', 'texto', 7), col('Paciente', 'texto', 28), col('Teléfono', 'texto', 12), col('Médico', 'texto', 22), col('Motivo', 'texto', 22), col('Estado', 'texto', 12)], acciones: ctx.admin,
        filas: citas.map((c) => ({ valores: [hm(c.hora), nomPac(B.pacientes.find((p) => p.id === c.paciente_id)), tel(c.paciente_id), nomMed(B, c.medico_id), c.motivo || '', `¤${c.estado}`], acciones: c.estado === 'PROGRAMADA' ? `<button type="button" class="boton secundario-sm" data-conf="${c.id}">Confirmó</button> <button type="button" class="boton secundario-sm rp-peligro" data-canc="${c.id}">Canceló</button>` : '' })), vacio: 'Sin citas ese día.' };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Citas', citas.length)}${kpi('Por confirmar', citas.filter((c) => c.estado === 'PROGRAMADA').length, 'ec-alerta')}${kpi('Confirmadas', citas.filter((c) => c.estado === 'CONFIRMADA').length, 'ec-fin')}${kpi('Lista de espera', espera.length)}${kpi('Citas pasadas sin cerrar', vencidas.length, vencidas.length ? 'ec-alerta' : '')}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Llama a los pacientes de la fecha (por defecto mañana) y registra si confirmaron o cancelaron. Al cancelar una cita, ofrece el espacio a la lista de espera. Las citas pasadas sin atender se marcan como «no asistió» para medir el ausentismo.</p>${tabla(cfg, false)}
        <h3 class="pr-sub"><i class="ti ti-list-numbers" aria-hidden="true"></i> Lista de espera</h3>${tabla({ columnas: [col('Paciente', 'texto', 28), col('Teléfono', 'texto', 12), col('Especialidad / médico', 'texto', 26), col('Preferencia', 'texto', 20), col('Prioridad', 'texto', 10)], acciones: ctx.admin,
          filas: espera.map((x) => ({ valores: [nomPac(B.pacientes.find((p) => p.id === x.paciente_id)), tel(x.paciente_id), x.medico_id ? nomMed(B, x.medico_id) : B.especialidades.find((s) => s.id === x.especialidad_id)?.nombre || '', x.preferencia || '', x.prioridad], resaltar: x.prioridad === 'URGENTE',
            acciones: `<a class="boton secundario-sm" href="#/clinicas/cli-agenda" data-agendar="${x.id}">Agendar</a> <button type="button" class="boton secundario-sm" data-desc="${x.id}">Descartar</button>` })), vacio: 'Nadie en lista de espera.' }, false)}
        ${espera.length ? '' : ''}<div data-form-espera></div>${listaPac(B)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); if (e.target.name === 'fecha' && e.target.closest('.bk-filtros')) { f.fecha = e.target.value || hoy(); cargar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp, false);
      const cf = e.target.closest('[data-conf]'), ca = e.target.closest('[data-canc]'), de = e.target.closest('[data-desc]'), ag = e.target.closest('[data-agendar]');
      if (cf) { await sb.from('cli_citas').update({ estado: 'CONFIRMADA' }).eq('id', Number(cf.dataset.conf)); return cargar(); }
      if (ca) { const m = prompt('Motivo de la cancelación:'); if (m === null) return; await sb.from('cli_citas').update({ estado: 'CANCELADA', motivo_cancelacion: m.trim() || null }).eq('id', Number(ca.dataset.canc)); if (espera.length) window.FIN.aviso('Cita cancelada: hay pacientes en lista de espera para ese espacio'); return cargar(); }
      if (de) { await sb.from('cli_lista_espera').update({ estado: 'DESCARTADO' }).eq('id', Number(de.dataset.desc)); return cargar(); }
      if (ag) { await sb.from('cli_lista_espera').update({ estado: 'AGENDADO' }).eq('id', Number(ag.dataset.agendar)); return; }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'noshow') { if (!confirm(`¿Marcar ${vencidas.length} cita(s) pasada(s) como «no asistió»?`)) return; const { error } = await sb.from('cli_citas').update({ estado: 'NO ASISTIÓ' }).in('id', vencidas.map((v) => v.id)); if (error) return window.FIN.aviso(errorTxt(error)); vencidas = []; return cargar(); }
      if (a === 'espera') {
        const box = cont.querySelector('[data-form-espera]');
        box.innerHTML = `<form class="cli-esp" novalidate><div class="sat-g"><label class="campo sat-ancho"><span>Paciente</span><input name="paciente" list="cli-pac" autocomplete="off"></label><label class="campo"><span>Especialidad</span><select name="especialidad_id">${opt(B.especialidades, '', 'id', (s) => s.nombre)}</select></label><label class="campo"><span>Médico</span><select name="medico_id">${opt(B.medicos.filter((m) => m.activo), '', 'id', (m) => m.nombre, 'Cualquiera')}</select></label><label class="campo"><span>Preferencia</span><input name="preferencia" placeholder="MAÑANAS, LUNES"></label><label class="campo"><span>Prioridad</span><select name="prioridad"><option>NORMAL</option><option>PREFERENTE</option><option>URGENTE</option></select></label>${btn('guardar-espera', 'ti-device-floppy', 'Agregar', '', 'primario-sm')}</div></form>`;
        window.CUENTAS_XLSX.ajustarAlto(cont); return;
      }
      if (a === 'guardar-espera') {
        const d = Object.fromEntries(new FormData(cont.querySelector('form.cli-esp')).entries()); const p = pacDe(B, d.paciente); if (!p) return window.FIN.aviso('Elige el paciente');
        const { error } = await sb.from('cli_lista_espera').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, paciente_id: p.id, especialidad_id: Number(d.especialidad_id) || null, medico_id: Number(d.medico_id) || null, preferencia: d.preferencia.trim().toUpperCase() || null, prioridad: d.prioridad });
        if (error) return window.FIN.aviso(errorTxt(error)); cargar();
      }
    });
    iniciar();
  };

  // ===================== Paquetes y membresías =====================
  window.PANTALLAS['cli-paquetes'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Paquetes y membresías', icono: 'ti-ticket', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Clínicas médicas · Procesos' });
    const { sb } = ctx;
    let B = null, vend = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-ticket'); return; }
      try { B = await baseClinica(ctx); } catch (e) { return falta(ctx, e); }
      ctx.filtros('', botonesExp);
      const { data, error } = await sb.from('cli_paquetes_vendidos').select('*').eq('localidad_id', ctx.sel.loc).order('numero', { ascending: false }); if (error) return falta(ctx, error); vend = data || []; pintar();
    }
    function pintar() {
      const act = vend.filter((v) => v.estado === 'ACTIVO'), dif = sum(act.map((v) => v.monto - v.reconocido));
      cfg = { titulo: 'Paquetes vendidos', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Paquetes', archivo: 'paquetes_vendidos', parametros: [`Empresa: ${empresaDe(ctx)}`],
        columnas: [col('No.', 'texto', 6), col('Fecha', 'texto', 10), col('Paciente', 'texto', 28), col('Paquete', 'texto', 26), col('Sesiones', 'texto', 9), col('Monto Q', 'monto', 12), col('Reconocido Q', 'monto', 12), col('Por reconocer Q', 'monto', 13), col('Vence', 'texto', 10), col('Estado', 'texto', 10)],
        filas: vend.map((v) => ({ valores: [String(v.numero), fmt.fechaDia(v.fecha), nomPac(B.pacientes.find((p) => p.id === v.paciente_id)), B.paquetes.find((k) => k.id === v.paquete_id)?.nombre || '', `${v.usadas} de ${v.sesiones}`, r2(v.monto), r2(v.reconocido), r2(v.monto - v.reconocido), v.vence ? fmt.fechaDia(v.vence) : '', `¤${v.estado}`], resaltar: v.estado === 'ACTIVO' && v.vence && v.vence < sumarDias(hoy(), 15) })), vacio: 'Sin paquetes vendidos.' };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Vendidos', vend.length)}${kpi('Activos', act.length, 'ec-fin')}${kpi('Sesiones pendientes', sum(act.map((v) => v.sesiones - v.usadas)))}${kpi('Ingreso diferido', q(dif))}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> El paquete se cobra completo al venderlo y queda como ingreso diferido; cada sesión usada (en Cobro de consulta, columna «Paquete») reconoce su parte como ingreso. Resaltados: vencen en menos de 15 días.</p>
        ${ctx.admin ? `<form class="cli-venta" novalidate><div class="cl-banda">Vender paquete</div><div class="sat-g"><label class="campo sat-ancho"><span>Paciente</span><input name="paciente" list="cli-pac" autocomplete="off"></label><label class="campo sat-ancho"><span>Paquete</span><select name="paquete">${opt(B.paquetes.filter((p) => p.activo), '', 'id', (p) => `${p.nombre} · ${p.sesiones} sesiones · Q ${fmt.monto(p.precio)}`, null)}</select></label>
          <label class="campo"><span>Forma de pago</span><select name="forma"><option>EFECTIVO</option><option>TARJETA</option><option>TRANSFERENCIA</option><option>CHEQUE</option></select></label><label class="campo"><span>Referencia</span><input name="referencia"></label><label class="campo"><span>Factura</span><input name="factura"></label>${btn('vender', 'ti-shopping-cart', 'Vender', '', 'primario-sm')}</div></form>${listaPac(B)}` : ''}${tabla(cfg, false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') cargar(); });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp, false);
      if (e.target.closest('[data-accion="vender"]')) {
        const d = Object.fromEntries(new FormData(cont.querySelector('form.cli-venta')).entries()); const p = pacDe(B, d.paciente);
        if (!p) return window.FIN.aviso('Elige el paciente'); if (!d.paquete) return window.FIN.aviso('Registra paquetes en Catálogos › Servicios, tarifas y paquetes');
        const { error } = await sb.rpc('cli_vender_paquete', { p_loc: ctx.sel.loc, p_paciente: p.id, p_paquete: Number(d.paquete), p_forma: d.forma, p_referencia: d.referencia || null, p_factura: d.factura || null });
        if (error) return window.FIN.aviso(errorTxt(error)); window.FIN.aviso('Paquete vendido'); cargar();
      }
    });
    iniciar();
  };

  // ===================== Cierre de caja diario =====================
  window.PANTALLAS['cli-caja'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Cierre de caja diario', icono: 'ti-cash-banknote', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Clínicas médicas · Procesos' });
    const { sb } = ctx;
    const f = { fecha: hoy() }; let cobros = [], cierres = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-cash-banknote'); return; }
      ctx.filtros(`<label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${f.fecha}"></label>`, botonesExp);
      const [c, k] = await Promise.all([sb.from('cli_cobros').select('*').eq('localidad_id', ctx.sel.loc).eq('fecha', f.fecha).eq('estado', 'PAGADO'), sb.from('cli_cierres_caja').select('*').eq('localidad_id', ctx.sel.loc).order('fecha', { ascending: false }).limit(60)]);
      if (c.error) return falta(ctx, c.error); cobros = c.data || []; cierres = k.data || []; pintar();
    }
    function pintar() {
      const pend = cobros.filter((c) => !c.cierre_id), porForma = (xs, fm) => sum(xs.filter((c) => c.forma === fm).map((c) => c.parte_paciente));
      const cajeros = [...new Set(pend.map((c) => c.cajero))];
      cfg = { titulo: 'Cierres de caja de la clínica', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Cierres', archivo: 'cierres_caja_clinica', parametros: [`Empresa: ${empresaDe(ctx)}`], firmas: ['Cajero', 'Revisado por'],
        columnas: [col('Fecha', 'texto', 10), col('Cajero', 'texto', 16), col('Cobros', 'numero', 7), col('Efectivo', 'monto', 12), col('Tarjeta', 'monto', 12), col('Transferencia', 'monto', 12), col('Cheque', 'monto', 11), col('Total', 'monto', 13), col('Contado', 'monto', 12), col('Diferencia', 'monto', 11)],
        filas: cierres.map((x) => ({ valores: [fmt.fechaDia(x.fecha), x.cajero, x.cobros, r2(x.efectivo), r2(x.tarjeta), r2(x.transferencia), r2(x.cheque), r2(x.total), x.efectivo_contado == null ? '' : r2(x.efectivo_contado), r2(x.diferencia)], resaltar: Math.abs(num(x.diferencia)) >= 0.01 })), vacio: 'Sin cierres.' };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Cobros sin cerrar', pend.length, pend.length ? 'ec-alerta' : '')}${kpi('Efectivo', q(porForma(pend, 'EFECTIVO')))}${kpi('Tarjeta', q(porForma(pend, 'TARJETA')))}${kpi('Transferencia', q(porForma(pend, 'TRANSFERENCIA')))}${kpi('Total', q(sum(pend.map((c) => c.parte_paciente))), 'ec-fin')}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Cada cajero cierra sus cobros del día: cuenta el efectivo y la diferencia queda registrada. Cajeros con cobros pendientes: ${esc(cajeros.join(', ') || 'ninguno')}.</p>
        ${ctx.admin && pend.length ? `<div class="sat-g"><label class="campo"><span>Efectivo contado Q</span><input type="number" step="0.01" name="contado"></label><label class="campo sat-ancho"><span>Observaciones</span><input name="obs"></label>${btn('cerrar', 'ti-lock', 'Cerrar mi caja', '', 'primario-sm')}</div>` : ''}${tabla(cfg, false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); if (e.target.name === 'fecha') { f.fecha = e.target.value || hoy(); cargar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp, false);
      if (e.target.closest('[data-accion="cerrar"]')) {
        const v = cont.querySelector('[name=contado]').value; const { data, error } = await sb.rpc('cli_cerrar_caja', { p_loc: ctx.sel.loc, p_fecha: f.fecha, p_contado: v === '' ? null : num(v), p_observaciones: cont.querySelector('[name=obs]').value || null });
        if (error) return window.FIN.aviso(errorTxt(error)); window.FIN.aviso(`Caja cerrada: ${data.cobros} cobro(s) por Q ${fmt.monto(data.total)}`); cargar();
      }
    });
    iniciar();
  };

  // ===================== Liquidación de honorarios =====================
  window.PANTALLAS['cli-honorarios'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Liquidación de honorarios', icono: 'ti-receipt-tax', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Clínicas médicas · Procesos' });
    const { sb } = ctx;
    const f = { desde: `${hoy().slice(0, 8)}01`, hasta: hoy() }; let B = null, pend = [], liq = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-receipt-tax'); return; }
      try { B = await baseClinica(ctx); } catch (e) { return falta(ctx, e); }
      ctx.filtros(`<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}"></label>`, botonesExp);
      const [l, h] = await Promise.all([leerTodo(() => sb.from('cli_cobro_lineas').select('medico_id, total, reconocido, servicio_id, honorario_liq_id, cli_cobros!inner(localidad_id, fecha, estado, tipo)').eq('cli_cobros.localidad_id', ctx.sel.loc).eq('cli_cobros.estado', 'PAGADO').eq('cli_cobros.tipo', 'SERVICIOS').is('honorario_liq_id', null).gte('cli_cobros.fecha', f.desde).lte('cli_cobros.fecha', f.hasta).not('medico_id', 'is', null).order('id')),
        sb.from('cli_honorarios').select('*').eq('localidad_id', ctx.sel.loc).order('numero', { ascending: false }).limit(100)]);
      const hon = (sid) => B.servicios.find((s) => s.id === sid)?.honorario !== false;
      const m = new Map(); l.filter((x) => hon(x.servicio_id)).forEach((x) => m.set(x.medico_id, (m.get(x.medico_id) || 0) + num(x.total) + num(x.reconocido)));
      pend = [...m.entries()].map(([id, bruto]) => { const me = B.medicos.find((x) => x.id === id) || {}; const part = r2(bruto * num(me.pct_hospital) / 100), ret = r2((bruto - part) * num(me.retencion_isr_pct) / 100); return { id, bruto: r2(bruto), part, ret, liq: r2(bruto - part - ret) }; });
      liq = h.data || []; pintar();
    }
    function pintar() {
      cfg = { titulo: 'Liquidaciones de honorarios', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Honorarios', archivo: 'honorarios_clinica', parametros: [`Empresa: ${empresaDe(ctx)}`], firmas: ['Elaborado por', 'Médico'],
        columnas: [col('No.', 'texto', 6), col('Médico', 'texto', 26), col('Período', 'texto', 20), col('Consultas', 'numero', 8), col('Bruto', 'monto', 12), col('Clínica', 'monto', 12), col('Ret. ISR', 'monto', 11), col('Líquido', 'monto', 12), col('Estado', 'texto', 10)], acciones: ctx.admin,
        filas: liq.map((x) => ({ valores: [String(x.numero), nomMed(B, x.medico_id), `${fmt.fechaDia(x.desde)} al ${fmt.fechaDia(x.hasta)}`, x.consultas, r2(x.bruto), r2(x.participacion_clinica), r2(x.retencion_isr), r2(x.liquido), `¤${x.estado}`], acciones: x.estado === 'CALCULADA' ? `<button type="button" class="boton secundario-sm" data-pagar="${x.id}">Pagada</button>` : esc(x.referencia_pago || '') })), vacio: 'Sin liquidaciones.' };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Médicos con pendiente', pend.length)}${kpi('Bruto pendiente', q(sum(pend.map((x) => x.bruto))))}${kpi('Líquido a pagar', q(sum(pend.map((x) => x.liq))), 'ec-fin')}${kpi('Liquidaciones por pagar', q(sum(liq.filter((x) => x.estado === 'CALCULADA').map((x) => x.liquido))), 'ec-alerta')}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Honorario = servicios con honorario cobrados del médico (incluye las sesiones de paquetes reconocidas). Se descuenta la participación de la clínica (% del médico) y la retención de ISR sobre el resto.</p>
        ${tabla({ columnas: [col('Médico', 'texto', 28), col('Bruto Q', 'monto', 13), col('Clínica Q', 'monto', 12), col('Ret. ISR Q', 'monto', 12), col('Líquido Q', 'monto', 13)], acciones: ctx.admin, filas: pend.map((x) => ({ valores: [nomMed(B, x.id), x.bruto, x.part, x.ret, x.liq], acciones: `<button type="button" class="boton primario-sm" data-liq="${x.id}">Liquidar</button>` })), vacio: 'Sin honorarios pendientes en el período.' }, false)}
        <h3 class="pr-sub"><i class="ti ti-history" aria-hidden="true"></i> Liquidaciones</h3>${tabla(cfg, false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); if (['desde', 'hasta'].includes(e.target.name)) { f[e.target.name] = e.target.value; cargar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp, false);
      const l = e.target.closest('[data-liq]'), p = e.target.closest('[data-pagar]');
      if (l) { const { error } = await sb.rpc('cli_liquidar_honorarios', { p_loc: ctx.sel.loc, p_medico: Number(l.dataset.liq), p_desde: f.desde, p_hasta: f.hasta }); if (error) return window.FIN.aviso(errorTxt(error)); window.FIN.aviso('Honorarios liquidados'); return cargar(); }
      if (p) { const r = prompt('Referencia del pago (cheque o transferencia):'); if (r === null) return; const { error } = await sb.from('cli_honorarios').update({ estado: 'PAGADA', referencia_pago: r.trim() || null, fecha_pago: hoy() }).eq('id', Number(p.dataset.pagar)); if (error) return window.FIN.aviso(errorTxt(error)); cargar(); }
    });
    iniciar();
  };

  // ===================== Reclamos a aseguradoras =====================
  window.PANTALLAS['cli-reclamos'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Reclamos a aseguradoras', icono: 'ti-shield-heart', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Clínicas médicas · Procesos' });
    const { sb } = ctx;
    const f = { desde: `${hoy().slice(0, 8)}01`, hasta: hoy() }; let B = null, pend = [], recl = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-shield-heart'); return; }
      try { B = await baseClinica(ctx); } catch (e) { return falta(ctx, e); }
      ctx.filtros(`<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}"></label>`, botonesExp);
      const [c, r] = await Promise.all([sb.from('cli_cobros').select('aseguradora_id, parte_aseguradora').eq('localidad_id', ctx.sel.loc).eq('estado', 'PAGADO').gt('parte_aseguradora', 0).is('reclamo_id', null).gte('fecha', f.desde).lte('fecha', f.hasta), sb.from('cli_reclamos').select('*').eq('localidad_id', ctx.sel.loc).order('numero', { ascending: false }).limit(100)]);
      if (r.error) return falta(ctx, r.error);
      const m = new Map(); (c.data || []).forEach((x) => { const a = m.get(x.aseguradora_id) || { n: 0, v: 0 }; a.n++; a.v += num(x.parte_aseguradora); m.set(x.aseguradora_id, a); });
      pend = [...m.entries()].map(([id, a]) => ({ id, ...a })); recl = r.data || []; pintar();
    }
    function pintar() {
      const ed = ctx.admin;
      cfg = { titulo: 'Reclamos a aseguradoras', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Reclamos', archivo: 'reclamos_clinica', parametros: [`Empresa: ${empresaDe(ctx)}`],
        columnas: [col('No.', 'texto', 6), col('Aseguradora', 'texto', 24), col('Período', 'texto', 20), col('Cobros', 'numero', 7), col('Reclamado', 'monto', 12), col('Aprobado', 'monto', 12), col('Glosa', 'monto', 11), col('Pagado', 'monto', 12), col('Saldo', 'monto', 12), col('Estado', 'texto', 11)],
        filas: recl.map((x) => ({ valores: [String(x.numero), nomAse(B, x.aseguradora_id), `${fmt.fechaDia(x.desde)} al ${fmt.fechaDia(x.hasta)}`, x.cobros, r2(x.monto), x.monto_aprobado == null ? '' : r2(x.monto_aprobado), r2(x.glosa), r2(x.monto_pagado), r2(num(x.monto_aprobado ?? x.monto) - num(x.monto_pagado)), `¤${x.estado}`], attr: `data-rec="${x.id}"` })), vacio: 'Sin reclamos.' };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Por reclamar', q(sum(pend.map((x) => x.v))), 'ec-alerta')}${kpi('Reclamado pendiente de pago', q(sum(recl.filter((x) => !['PAGADO', 'RECHAZADO'].includes(x.estado)).map((x) => num(x.monto_aprobado ?? x.monto) - num(x.monto_pagado)))))}${kpi('Cobrado a aseguradoras', q(sum(recl.map((x) => x.monto_pagado))), 'ec-fin')}${kpi('Glosas', q(sum(recl.map((x) => x.glosa))))}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Agrupa en un reclamo los cobros del período con parte de la aseguradora. Al recibir respuesta registra lo aprobado, la glosa (lo no reconocido) y lo pagado.</p>
        ${tabla({ columnas: [col('Aseguradora', 'texto', 28), col('Cobros', 'numero', 8), col('Monto Q', 'monto', 14)], acciones: ed, filas: pend.map((x) => ({ valores: [nomAse(B, x.id), x.n, r2(x.v)], acciones: `<button type="button" class="boton primario-sm" data-gen="${x.id}">Generar reclamo</button>` })), vacio: 'Sin cobros por reclamar en el período.' }, false)}
        <h3 class="pr-sub"><i class="ti ti-history" aria-hidden="true"></i> Reclamos</h3>
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${cfg.columnas.map((c) => `<th class="${c.tipo === 'texto' ? '' : 'num'}">${c.titulo}</th>`).join('')}</tr></thead><tbody>
        ${recl.map((x) => `<tr data-rec="${x.id}"><td>${x.numero}</td><td>${esc(nomAse(B, x.aseguradora_id))}</td><td>${fmt.fechaDia(x.desde)} al ${fmt.fechaDia(x.hasta)}</td><td class="num">${x.cobros}</td><td class="num">${fmt.monto(x.monto)}</td>
          ${['monto_aprobado', 'glosa', 'monto_pagado'].map((k) => `<td class="num">${ed ? `<input data-c="${k}" type="number" step="0.01" value="${x[k] ?? ''}" style="width:100px">` : fmt.monto(x[k])}</td>`).join('')}<td class="num">${fmt.monto(num(x.monto_aprobado ?? x.monto) - num(x.monto_pagado))}</td>
          <td>${ed ? `<select data-c="estado">${['PRESENTADO', 'EN REVISIÓN', 'APROBADO', 'PARCIAL', 'PAGADO', 'RECHAZADO'].map((s) => `<option ${x.estado === s ? 'selected' : ''}>${s}</option>`).join('')}</select>` : marca(x.estado)}</td></tr>`).join('') || '<tr><td colspan="10" class="tk-vacio">Sin reclamos.</td></tr>'}</tbody></table></div></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', async (e) => {
      const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); if (['desde', 'hasta'].includes(e.target.name)) { f[e.target.name] = e.target.value; return cargar(); }
      const tr = e.target.closest('tr[data-rec]'), k = e.target.dataset.c; if (!tr || !k) return;
      const v = k === 'estado' ? e.target.value : e.target.value === '' ? (k === 'monto_aprobado' ? null : 0) : num(e.target.value);
      const upd = { [k]: v }; if (k === 'monto_pagado' && v > 0) upd.fecha_pago = hoy();
      const { error } = await sb.from('cli_reclamos').update(upd).eq('id', Number(tr.dataset.rec)); if (error) window.FIN.aviso(errorTxt(error)); cargar();
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp, false);
      const g = e.target.closest('[data-gen]'); if (g) { const { error } = await sb.rpc('cli_generar_reclamo', { p_loc: ctx.sel.loc, p_aseguradora: Number(g.dataset.gen), p_desde: f.desde, p_hasta: f.hasta }); if (error) return window.FIN.aviso(errorTxt(error)); window.FIN.aviso('Reclamo generado'); cargar(); }
    });
    iniciar();
  };

  // ===================== Integración contable =====================
  // Cuentas (Contabilidad › Catálogos › Cuentas de integración): caja, bancos, CxC aseguradoras, ingresos por tipo de
  // servicio, ingreso diferido de paquetes, IVA débito y honorarios por pagar.
  window.PANTALLAS['cli-contabilidad'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Integración contable de la clínica', icono: 'ti-arrows-join', clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Clínicas médicas · Procesos' });
    const { sb } = ctx;
    const f = { fecha: hoy() }; let B = null, K = null, P = null, aux = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-arrows-join'); return; }
      ctx.filtros(`<label class="campo"><span>Día</span><input type="date" name="fecha" value="${f.fecha}" max="${hoy()}"></label>`, `${ctx.admin ? btn('generar', 'ti-player-play', 'Generar partida del día', '', 'primario-sm') : ''}${botonesExp}`);
      ctx.pDet.innerHTML = '<p class="vacio">Preparando la integración…</p>';
      try {
        B = await baseClinica(ctx); if (!window.CONTA) throw new Error('Falta el módulo de cierre contable');
        K = await window.CONTA.cuentasClave(ctx); P = await partidaDia(); aux = await auxiliares();
      } catch (e) { return falta(ctx, e); }
      pintar();
    }
    async function partidaDia() {
      const { data: cs, error } = await sb.from('cli_cobros').select('*, cli_cobro_lineas(*)').eq('localidad_id', ctx.sel.loc).eq('fecha', f.fecha).eq('estado', 'PAGADO').order('numero');
      if (error) throw error;
      const pend = (cs || []).filter((c) => !c.partida_id), hecha = (cs || []).find((c) => c.partida_id);
      const tasa = 1.12, neto = (v) => r2(v / tasa), L = [], add = (clave, concepto, d, h) => { if (r2(d) || r2(h)) L.push({ clave, cuenta: K.cuenta(clave), concepto, debe: r2(d), haber: r2(h) }); };
      const forma = (fm) => sum(pend.filter((c) => c.forma === fm).map((c) => c.parte_paciente));
      add('CLI_CAJA', 'Efectivo cobrado', forma('EFECTIVO'), 0);
      add('CLI_BANCOS', 'Tarjeta, transferencia y cheque', forma('TARJETA') + forma('TRANSFERENCIA') + forma('CHEQUE'), 0);
      add('ASEGURADORAS_CXC', 'Parte de aseguradoras', sum(pend.map((c) => c.parte_aseguradora)), 0);
      const ls = pend.flatMap((c) => c.cli_cobro_lineas || []);
      const grupo = (t) => (['CONSULTA', 'RECONSULTA'].includes(t) ? 'CLI_INGRESO_CONSULTAS' : t === 'PROCEDIMIENTO' ? 'CLI_INGRESO_PROCEDIMIENTOS' : ['LABORATORIO', 'IMAGEN'].includes(t) ? 'CLI_INGRESO_LAB_IMAGEN' : t === 'PAQUETE' ? 'CLI_INGRESO_DIFERIDO' : 'CLI_INGRESO_OTROS');
      const porG = new Map(); ls.filter((l) => num(l.total) > 0).forEach((l) => { const g = grupo(l.tipo); porG.set(g, (porG.get(g) || 0) + num(l.total)); });
      const brutoTot = sum([...porG.values()]); let iva = 0;
      porG.forEach((v, g) => { const n = neto(v); iva += v - n; add(g, g === 'CLI_INGRESO_DIFERIDO' ? 'Paquetes vendidos (ingreso diferido)' : `Ingresos ${g.replace('CLI_INGRESO_', '').replace('_', ' / ').toLowerCase()}`, 0, n); });
      add('IVA_DEBITO', 'IVA débito fiscal', 0, iva);
      const rec = sum(ls.map((l) => l.reconocido)); if (rec) { add('CLI_INGRESO_DIFERIDO', 'Sesiones de paquetes usadas', neto(rec), 0); add('CLI_INGRESO_CONSULTAS', 'Ingreso reconocido de paquetes', 0, neto(rec)); }
      // Redondeo: la diferencia (centavos) va al IVA.
      const dif = r2(sum(L.map((x) => x.debe)) - sum(L.map((x) => x.haber))); const ivaL = L.find((x) => x.clave === 'IVA_DEBITO'); if (dif && ivaL) ivaL.haber = r2(ivaL.haber + dif);
      return { pend, hecha, L, brutoTot, nCobros: (cs || []).length };
    }
    async function auxiliares() {
      const [cs, rc, hn, pv] = await Promise.all([sb.from('cli_cobros').select('aseguradora_id, parte_aseguradora, reclamo_id').eq('localidad_id', ctx.sel.loc).eq('estado', 'PAGADO').gt('parte_aseguradora', 0).lte('fecha', f.fecha),
        sb.from('cli_reclamos').select('id, monto_pagado, glosa').eq('localidad_id', ctx.sel.loc), sb.from('cli_honorarios').select('liquido, estado').eq('localidad_id', ctx.sel.loc).eq('estado', 'CALCULADA'), sb.from('cli_paquetes_vendidos').select('monto, reconocido, estado').eq('localidad_id', ctx.sel.loc).eq('estado', 'ACTIVO')]);
      const pagado = sum((rc.data || []).map((x) => num(x.monto_pagado) + num(x.glosa)));
      const base = await window.CONTA.leer(ctx, { locs: [ctx.sel.loc], hasta: f.fecha });
      const saldo = (clave) => { const c = K.cuenta(clave); return c ? r2(window.CONTA.saldoCod(base, c)) : null; };
      return [
        { t: 'Cuentas por cobrar aseguradoras', clave: 'ASEGURADORAS_CXC', aux: r2(sum((cs.data || []).map((x) => x.parte_aseguradora)) - pagado), cont: saldo('ASEGURADORAS_CXC') },
        { t: 'Honorarios médicos por pagar', clave: 'HONORARIOS_POR_PAGAR', aux: r2(sum((hn.data || []).map((x) => x.liquido))), cont: saldo('HONORARIOS_POR_PAGAR') },
        { t: 'Ingreso diferido de paquetes (neto de IVA)', clave: 'CLI_INGRESO_DIFERIDO', aux: r2(sum((pv.data || []).map((x) => (num(x.monto) - num(x.reconocido)) / 1.12))), cont: saldo('CLI_INGRESO_DIFERIDO') }
      ];
    }
    function pintar() {
      const faltan = [...new Set(P.L.filter((x) => !x.cuenta).map((x) => x.clave))];
      const td = sum(P.L.map((x) => x.debe)), th = sum(P.L.map((x) => x.haber));
      cfg = { titulo: `Partida de ingresos de la clínica del ${fmt.fechaDia(f.fecha)}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Integración', archivo: `integracion_clinica_${f.fecha}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `Día ${fmt.fechaDia(f.fecha)}`, `${P.pend.length} cobro(s) por contabilizar`],
        columnas: [col('Concepto', 'texto', 34), col('Clave', 'texto', 24), col('Cuenta', 'texto', 14), col('Debe', 'monto', 14), col('Haber', 'monto', 14)],
        filas: [...P.L.map((x) => ({ valores: [x.concepto, x.clave, x.cuenta || 'SIN CONFIGURAR', x.debe || '', x.haber || ''], resaltar: !x.cuenta })), { valores: ['Totales', '', '', r2(td), r2(th)], tipo: 'total' },
          { valores: ['Auxiliares contra contabilidad'], tipo: 'grupo', combinar: true },
          ...aux.map((a) => ({ valores: [a.t, a.clave, K.cuenta(a.clave) || 'SIN CONFIGURAR', a.cont == null ? '' : a.cont, a.aux], resaltar: a.cont != null && Math.abs(a.cont - a.aux) >= 0.01 }))], vacio: 'Sin cobros por contabilizar.' };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="ec-kpis">${kpi('Cobros del día', P.nCobros)}${kpi('Por contabilizar', P.pend.length, P.pend.length ? 'ec-alerta' : 'ec-fin')}${kpi('Ingresos brutos', q(P.brutoTot))}${kpi('Cuadre', Math.abs(td - th) < 0.01 ? 'Cuadra' : `Dif. Q ${fmt.monto(td - th)}`, Math.abs(td - th) < 0.01 ? 'ec-fin' : 'ec-alerta')}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> La partida diaria (tipo PI) lleva al debe la caja, los bancos y la parte de las aseguradoras; al haber los ingresos netos por tipo de servicio, el ingreso diferido de paquetes vendidos y el IVA débito. Las sesiones de paquetes usadas trasladan el diferido al ingreso. ${P.hecha ? 'Parte de los cobros del día ya se contabilizó.' : ''}
        ${faltan.length ? `<br><b class="pc-rojo">Configura en Contabilidad › Catálogos › Cuentas de integración: ${faltan.join(', ')}.</b>` : ''}</p>${tabla({ ...cfg, columnas: [col('Concepto', 'texto', 34), col('Clave', 'texto', 24), col('Cuenta', 'texto', 14), col('Debe / contable', 'monto', 14), col('Haber / auxiliar', 'monto', 14)] }, false)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); if (e.target.name === 'fecha') { f.fecha = e.target.value || hoy(); cargar(); } });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp, false);
      if (!e.target.closest('[data-accion="generar"]')) return;
      if (!P.pend.length) return window.FIN.aviso('No hay cobros por contabilizar ese día');
      const faltan = P.L.filter((x) => !x.cuenta); if (faltan.length) return window.FIN.aviso(`Configura las cuentas: ${[...new Set(faltan.map((x) => x.clave))].join(', ')}`);
      if (!confirm(`¿Generar la partida de ingresos de la clínica del ${fmt.fechaDia(f.fecha)}?`)) return;
      const { data, error } = await sb.rpc('con_generar_partida', { p_loc: ctx.sel.loc, p_anio: Number(f.fecha.slice(0, 4)), p_mes: Number(f.fecha.slice(5, 7)), p_tipo: 'PI', p_descripcion: `Ingresos de clínica del ${fmt.fechaDia(f.fecha)} (${P.pend.length} cobros)`, p_lineas: P.L.map((x) => ({ cuenta: x.cuenta, concepto: x.concepto, debe: x.debe, haber: x.haber })), p_origen: 'CLÍNICA', p_ref: Number(f.fecha.replace(/-/g, '')), p_monto: P.brutoTot });
      if (error) return window.FIN.aviso(errorTxt(error)); window.FIN.aviso(`Partida PI-${data.numero} generada y aprobada`); cargar();
    });
    iniciar();
  };

  // ===================== Reportes =====================
  function reporte(cont, op) {
    const ctx = montar(cont, { titulo: op.titulo, icono: op.icono, clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: 'Clínicas médicas · Reportes' });
    const f = { desde: `${hoy().slice(0, 4)}-01-01`, hasta: hoy(), graficas: true, ...(op.f || {}) }; let B = null, D = null, cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', op.icono); return; }
      ctx.filtros(`<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}" max="${hoy()}"></label>${op.filtros ? op.filtros(f) : ''}<label class="pc-check"><input type="checkbox" name="graficas" ${f.graficas ? 'checked' : ''}> Gráficas</label>`, botonesExp);
      ctx.pDet.innerHTML = '<p class="vacio">Leyendo la información de la clínica…</p>';
      try { B = await baseClinica(ctx); D = await op.leer(ctx, f, B); } catch (e) { return falta(ctx, e); }
      pintar();
    }
    function pintar() {
      const c = op.construir(f, B, D, ctx);
      cfg = { titulo: op.titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: op.titulo.slice(0, 30), archivo: `${op.archivo}_${f.hasta}`, parametros: [`Empresa: ${empresaDe(ctx)}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, ...(c.extra || [])], ...c };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><div class="cl-banda">${esc(op.titulo)} · ${esc(cfg.parametros.slice(0, 2).join(' · '))}</div><div class="ec-kpis">${(c.kpis || []).map(([t, v, k]) => kpi(t, v, k)).join('')}</div>${tabla(cfg, f.graficas)}</div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    cont.addEventListener('change', (e) => { const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar(); const n = e.target.name; if (!n) return; if (n === 'graficas') { f.graficas = e.target.checked; return pintar(); } f[n] = e.target.value; if (op.repintar?.includes(n)) return pintar(); cargar(); });
    cont.addEventListener('click', (e) => { const ex = e.target.closest('[data-exp]'); if (ex) exportar(cfg, ex.dataset.exp, f.graficas); });
    iniciar();
  }
  const citasDe = (ctx, f) => leerTodo(() => ctx.sb.from('cli_citas').select('*').eq('localidad_id', ctx.sel.loc).gte('fecha', f.desde).lte('fecha', f.hasta).order('id'));
  // Ingresos: la venta de un paquete es un anticipo (ingreso diferido); el ingreso es cada sesión reconocida.
  const cobrosDe = (ctx, f) => leerTodoIng(() => ctx.sb.from('cli_cobro_lineas').select('*, cli_cobros!inner(localidad_id, fecha, estado, forma, aseguradora_id, paciente_id, tipo, numero)').eq('cli_cobros.localidad_id', ctx.sel.loc).eq('cli_cobros.estado', 'PAGADO').gte('cli_cobros.fecha', f.desde).lte('cli_cobros.fecha', f.hasta).order('id'));
  async function leerTodoIng(h) { return (await leerTodo(h)).filter((l) => l.tipo !== 'PAQUETE'); }
  const meses = (f) => { const out = []; let d = f.desde.slice(0, 7); while (d <= f.hasta.slice(0, 7) && out.length < 36) { out.push(d); const [y, m] = d.split('-').map(Number); d = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; } return out; };

  window.PANTALLAS['cli-rep-productividad'] = (cont) => reporte(cont, { titulo: 'Agenda y productividad por médico', icono: 'ti-user-check', archivo: 'productividad_medicos', leer: async (ctx, f) => ({ citas: await citasDe(ctx, f), lineas: await cobrosDe(ctx, f) }),
    construir: (f, B, D) => {
      const ids = [...new Set(D.citas.map((c) => c.medico_id))];
      const filas = ids.map((id) => { const cs = D.citas.filter((c) => c.medico_id === id), at = cs.filter((c) => c.estado === 'ATENDIDA'), no = cs.filter((c) => c.estado === 'NO ASISTIÓ'), ca = cs.filter((c) => c.estado === 'CANCELADA');
        const esp = at.map((c) => minutos(c.llegada, c.inicio_consulta)).filter((x) => x != null), dur = at.map((c) => minutos(c.inicio_consulta, c.fin_consulta)).filter((x) => x != null);
        const ing = sum(D.lineas.filter((l) => l.medico_id === id).map((l) => num(l.total) + num(l.reconocido)));
        return { valores: [nomMed(B, id), cs.length, at.length, no.length, ca.length, cs.length ? no.length / cs.length : 0, esp.length ? Math.round(sum(esp) / esp.length) : '', dur.length ? Math.round(sum(dur) / dur.length) : '', r2(ing), at.length ? r2(ing / at.length) : 0], resaltar: cs.length && no.length / cs.length > 0.15 }; }).sort((a, b) => b.valores[2] - a.valores[2]);
      const T = (i) => sum(filas.map((r) => num(r.valores[i])));
      filas.push({ valores: ['Total', T(1), T(2), T(3), T(4), T(1) ? T(3) / T(1) : 0, '', '', r2(T(8)), T(2) ? r2(T(8) / T(2)) : 0], tipo: 'total' });
      return { kpis: [['Citas', T(1)], ['Atendidas', T(2), 'ec-fin'], ['Ausentismo', T(1) ? `${((T(3) / T(1)) * 100).toFixed(1)} %` : '—', T(1) && T(3) / T(1) > 0.15 ? 'ec-alerta' : ''], ['Ingreso por consulta', T(2) ? q(T(8) / T(2)) : '—']],
        columnas: [col('Médico', 'texto', 26), col('Citas', 'numero', 7), col('Atendidas', 'numero', 8), col('No asistió', 'numero', 8), col('Canceladas', 'numero', 8), col('Ausentismo', 'porcentaje', 9), col('Espera (min)', 'numero', 9), col('Duración (min)', 'numero', 9), col('Ingresos Q', 'monto', 13), col('Por consulta Q', 'monto', 12)], filas,
        graficas: [G().barras('Consultas atendidas por médico', filas.slice(0, -1).map((r) => ({ etiqueta: r.valores[0], valor: r.valores[2], texto: String(r.valores[2]) })).slice(0, 12))] };
    } });
  window.PANTALLAS['cli-rep-morbilidad'] = (cont) => reporte(cont, { titulo: 'Morbilidad CIE-10', icono: 'ti-virus', archivo: 'morbilidad_cie10', f: { top: '20' }, repintar: ['top'], filtros: (f) => `<label class="campo"><span>Primeros</span><select name="top">${['10', '20', '50', '0'].map((x) => `<option value="${x}" ${f.top === x ? 'selected' : ''}>${x === '0' ? 'Todos' : x}</option>`).join('')}</select></label>`,
    leer: async (ctx, f) => leerTodo(() => ctx.sb.from('cli_consulta_diagnosticos').select('codigo, descripcion, tipo, condicion, cli_consultas!inner(localidad_id, fecha, estado, paciente_id, medico_id)').eq('cli_consultas.localidad_id', ctx.sel.loc).neq('cli_consultas.estado', 'ANULADA').gte('cli_consultas.fecha', `${f.desde}T00:00:00-06:00`).lte('cli_consultas.fecha', `${f.hasta}T23:59:59-06:00`).order('id')),
    construir: (f, B, ds) => {
      const GR = [['0-4', 0, 4], ['5-14', 5, 14], ['15-44', 15, 44], ['45-64', 45, 64], ['65+', 65, 200]];
      const m = new Map(); ds.forEach((d) => { const p = B.pacientes.find((x) => x.id === d.cli_consultas.paciente_id); const e = edad(p?.fecha_nacimiento, diaGt(d.cli_consultas.fecha)); const a = m.get(d.codigo) || { d: d.descripcion, n: 0, nu: 0, M: 0, F: 0, g: GR.map(() => 0) }; a.n++; if (d.condicion === 'NUEVO') a.nu++; if (p?.genero) a[p.genero]++; const i = GR.findIndex(([, x, y]) => e != null && e >= x && e <= y); if (i >= 0) a.g[i]++; m.set(d.codigo, a); });
      const tot = ds.length; let xs = [...m.entries()].sort((a, b) => b[1].n - a[1].n); if (f.top !== '0') xs = xs.slice(0, Number(f.top));
      const filas = xs.map(([c, a], i) => ({ valores: [i + 1, c, a.d, a.n, tot ? a.n / tot : 0, a.nu, a.M, a.F, ...a.g] }));
      return { extra: [`${tot} diagnósticos`], kpis: [['Diagnósticos', tot], ['Distintos', m.size], ['Principal', xs[0] ? `${xs[0][0]} (${xs[0][1].n})` : '—'], ['Casos nuevos', `${tot ? ((sum([...m.values()].map((a) => a.nu)) / tot) * 100).toFixed(0) : 0} %`]],
        columnas: [col('#', 'numero', 4), col('CIE-10', 'texto', 8), col('Diagnóstico', 'texto', 40), col('Casos', 'numero', 7), col('%', 'porcentaje', 7), col('Nuevos', 'numero', 7), col('Hombres', 'numero', 7), col('Mujeres', 'numero', 7), ...GR.map(([t]) => col(`${t} años`, 'numero', 7))], filas,
        graficas: [G().barras('Diagnósticos más frecuentes', xs.slice(0, 10).map(([c, a]) => ({ etiqueta: `${c} ${a.d}`.slice(0, 40), valor: a.n, texto: String(a.n) })), G().COLORES.NARANJA)] };
    } });
  window.PANTALLAS['cli-rep-ingresos'] = (cont) => reporte(cont, { titulo: 'Ingresos por servicio, médico y forma de pago', icono: 'ti-report-money', archivo: 'ingresos_clinica', f: { por: 'SERVICIO' }, repintar: ['por'],
    filtros: (f) => `<label class="campo"><span>Agrupar por</span><select name="por">${[['SERVICIO', 'Servicio'], ['TIPO', 'Tipo de servicio'], ['MEDICO', 'Médico'], ['FORMA', 'Forma de pago'], ['COBERTURA', 'Cobertura'], ['MES', 'Mes']].map(([x, t]) => `<option value="${x}" ${f.por === x ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`,
    leer: (ctx, f) => cobrosDe(ctx, f),
    construir: (f, B, ls) => {
      const key = (l) => (f.por === 'SERVICIO' ? l.descripcion : f.por === 'TIPO' ? l.tipo : f.por === 'MEDICO' ? nomMed(B, l.medico_id) || 'Sin médico' : f.por === 'FORMA' ? l.cli_cobros.forma : f.por === 'COBERTURA' ? nomAse(B, l.cli_cobros.aseguradora_id) : `${MES[Number(l.cli_cobros.fecha.slice(5, 7)) - 1]} ${l.cli_cobros.fecha.slice(0, 4)}`);
      const m = new Map(); ls.forEach((l) => { const k = key(l); const a = m.get(k) || { n: 0, c: 0, pac: 0, ase: 0, rec: 0 }; a.n++; a.c += num(l.cantidad); a.pac += num(l.parte_paciente); a.ase += num(l.parte_aseguradora); a.rec += num(l.reconocido); m.set(k, a); });
      const tot = sum([...m.values()].map((a) => a.pac + a.ase + a.rec));
      const xs = [...m.entries()].sort((a, b) => (f.por === 'MES' ? 0 : (b[1].pac + b[1].ase + b[1].rec) - (a[1].pac + a[1].ase + a[1].rec)));
      const filas = xs.map(([k, a]) => ({ valores: [k, a.c, r2(a.pac), r2(a.ase), r2(a.rec), r2(a.pac + a.ase + a.rec), tot ? (a.pac + a.ase + a.rec) / tot : 0] }));
      filas.push({ valores: ['Total', sum(xs.map(([, a]) => a.c)), r2(sum(xs.map(([, a]) => a.pac))), r2(sum(xs.map(([, a]) => a.ase))), r2(sum(xs.map(([, a]) => a.rec))), r2(tot), 1], tipo: 'total' });
      return { extra: [`Agrupado por ${f.por.toLowerCase()}`], kpis: [['Ingresos', q(tot), 'ec-fin'], ['Pacientes', q(sum(xs.map(([, a]) => a.pac)))], ['Aseguradoras', q(sum(xs.map(([, a]) => a.ase)))], ['Paquetes reconocidos', q(sum(xs.map(([, a]) => a.rec)))]],
        columnas: [col(f.por === 'MES' ? 'Mes' : 'Concepto', 'texto', 36), col('Cantidad', 'numero', 9), col('Pacientes Q', 'monto', 13), col('Aseguradoras Q', 'monto', 13), col('Paquetes Q', 'monto', 12), col('Total Q', 'monto', 14), col('%', 'porcentaje', 8)], filas,
        graficas: [f.por === 'MES' ? G().columnas('Ingresos por mes (Q)', xs.map(([k]) => k.slice(0, 3)), [{ nombre: 'Pacientes', color: G().COLORES.VERDE, valores: xs.map(([, a]) => a.pac) }, { nombre: 'Aseguradoras', color: G().COLORES.AZUL, valores: xs.map(([, a]) => a.ase) }], (v) => fmt.monto(v))
          : G().barras('Ingresos (Q)', xs.slice(0, 12).map(([k, a]) => ({ etiqueta: k, valor: a.pac + a.ase + a.rec, texto: q(a.pac + a.ase + a.rec) })))] };
    } });
  window.PANTALLAS['cli-rep-ocupacion'] = (cont) => reporte(cont, { titulo: 'Ocupación de consultorios', icono: 'ti-door', archivo: 'ocupacion_consultorios', f: { desde: `${hoy().slice(0, 8)}01` }, leer: (ctx, f) => citasDe(ctx, f),
    construir: (f, B, citas) => {
      const dias = []; for (let d = f.desde; d <= f.hasta && dias.length < 400; d = sumarDias(d, 1)) dias.push(d);
      const filas = B.consultorios.map((c) => { const disp = sum(dias.map((d) => sum(B.horarios.filter((h) => h.activo && h.consultorio_id === c.id && h.dia_semana === diaSemana(d)).map((h) => aMin(h.hora_fin) - aMin(h.hora_inicio))))) / 60;
        const cs = citas.filter((x) => x.consultorio_id === c.id && !['CANCELADA', 'NO ASISTIÓ'].includes(x.estado)), usadas = sum(cs.map((x) => x.duracion_min)) / 60;
        return { valores: [c.nombre, c.sede || '', r2(disp), r2(usadas), cs.length, disp ? usadas / disp : 0], resaltar: disp && usadas / disp < 0.4 }; });
      const sinC = citas.filter((x) => !x.consultorio_id && !['CANCELADA', 'NO ASISTIÓ'].includes(x.estado)); if (sinC.length) filas.push({ valores: ['Sin consultorio asignado', '', 0, r2(sum(sinC.map((x) => x.duracion_min)) / 60), sinC.length, 0] });
      const D = sum(filas.map((r) => r.valores[2])), U = sum(filas.map((r) => r.valores[3]));
      filas.push({ valores: ['Total', '', r2(D), r2(U), sum(filas.map((r) => r.valores[4])), D ? U / D : 0], tipo: 'total' });
      return { extra: ['Horas disponibles según los horarios de los médicos'], kpis: [['Horas disponibles', r2(D)], ['Horas citadas', r2(U)], ['Ocupación', D ? `${((U / D) * 100).toFixed(1)} %` : '—', D && U / D < 0.4 ? 'ec-alerta' : 'ec-fin']],
        columnas: [col('Consultorio', 'texto', 26), col('Sede', 'texto', 18), col('Horas disponibles', 'numero', 12), col('Horas citadas', 'numero', 12), col('Citas', 'numero', 8), col('Ocupación', 'porcentaje', 10)], filas,
        graficas: [G().barras('Ocupación por consultorio (%)', filas.slice(0, -1).map((r) => ({ etiqueta: r.valores[0], valor: r.valores[5] * 100, texto: `${(r.valores[5] * 100).toFixed(1)} %` })), G().COLORES.VERDE)] };
    } });
  window.PANTALLAS['cli-rep-cartera'] = (cont) => reporte(cont, { titulo: 'Cartera de aseguradoras y honorarios', icono: 'ti-shield-heart', archivo: 'cartera_aseguradoras', f: { desde: '2000-01-01' },
    leer: async (ctx, f) => { const [c, r, h] = await Promise.all([leerTodo(() => ctx.sb.from('cli_cobros').select('id, fecha, aseguradora_id, parte_aseguradora, reclamo_id').eq('localidad_id', ctx.sel.loc).eq('estado', 'PAGADO').gt('parte_aseguradora', 0).lte('fecha', f.hasta).order('id')),
      ctx.sb.from('cli_reclamos').select('*').eq('localidad_id', ctx.sel.loc), ctx.sb.from('cli_honorarios').select('*').eq('localidad_id', ctx.sel.loc).eq('estado', 'CALCULADA')]); return { c, r: r.data || [], h: h.data || [] }; },
    construir: (f, B, D) => {
      const BANDAS = [['0-30', 0, 30], ['31-60', 31, 60], ['61-90', 61, 90], ['Más de 90', 91, 99999]];
      const dias = (d) => Math.max(0, Math.round((new Date(`${f.hasta}T12:00:00`) - new Date(`${d}T12:00:00`)) / 864e5));
      const porA = new Map(); const sumar = (id, d, v, tipo) => { const a = porA.get(id) || { sin: 0, b: BANDAS.map(() => 0) }; if (tipo === 'sin') a.sin += v; const i = BANDAS.findIndex(([, x, y]) => dias(d) >= x && dias(d) <= y); a.b[i] += v; porA.set(id, a); };
      D.c.filter((x) => !x.reclamo_id).forEach((x) => sumar(x.aseguradora_id, x.fecha, num(x.parte_aseguradora), 'sin'));
      D.r.filter((x) => !['PAGADO', 'RECHAZADO'].includes(x.estado)).forEach((x) => sumar(x.aseguradora_id, x.fecha, num(x.monto_aprobado ?? x.monto) - num(x.monto_pagado), 'rec'));
      const filas = [{ valores: ['Cartera de aseguradoras por antigüedad'], tipo: 'grupo', combinar: true }];
      [...porA.entries()].forEach(([id, a]) => filas.push({ valores: [nomAse(B, id), r2(a.sin), ...a.b.map(r2), r2(sum(a.b))], resaltar: a.b[3] > 0 }));
      const tb = BANDAS.map((_, i) => sum([...porA.values()].map((a) => a.b[i])));
      filas.push({ valores: ['Total aseguradoras', r2(sum([...porA.values()].map((a) => a.sin))), ...tb.map(r2), r2(sum(tb))], tipo: 'total' });
      filas.push({ valores: ['Honorarios médicos liquidados por pagar'], tipo: 'grupo', combinar: true });
      D.h.forEach((x) => filas.push({ valores: [`${nomMed(B, x.medico_id)} · liquidación ${x.numero}`, '', '', '', '', '', r2(x.liquido)] }));
      filas.push({ valores: ['Total honorarios por pagar', '', '', '', '', '', r2(sum(D.h.map((x) => x.liquido)))], tipo: 'total' });
      return { parametros: undefined, extra: [`Saldos al ${fmt.fechaDia(f.hasta)}`], kpis: [['Por cobrar aseguradoras', q(sum(tb)), 'ec-alerta'], ['Sin reclamar', q(sum([...porA.values()].map((a) => a.sin)))], ['Más de 90 días', q(tb[3]), tb[3] ? 'ec-alerta' : ''], ['Honorarios por pagar', q(sum(D.h.map((x) => x.liquido)))]],
        columnas: [col('Aseguradora / médico', 'texto', 34), col('Sin reclamar', 'monto', 12), ...BANDAS.map(([t]) => col(`${t} días`, 'monto', 12)), col('Total Q', 'monto', 13)], filas,
        graficas: [G().barras('Cartera por antigüedad (Q)', BANDAS.map(([t], i) => ({ etiqueta: `${t} días`, valor: tb[i], texto: q(tb[i]) })), G().COLORES.NARANJA)] };
    } });
  window.PANTALLAS['cli-rep-indicadores'] = (cont) => reporte(cont, { titulo: 'Indicadores de la clínica', icono: 'ti-gauge', archivo: 'indicadores_clinica',
    leer: async (ctx, f) => { const [ci, ls, cs] = await Promise.all([citasDe(ctx, f), cobrosDe(ctx, f), leerTodo(() => ctx.sb.from('cli_consultas').select('id, paciente_id, fecha, medico_id, estado').eq('localidad_id', ctx.sel.loc).neq('estado', 'ANULADA').gte('fecha', `${f.desde}T00:00:00-06:00`).lte('fecha', `${f.hasta}T23:59:59-06:00`).order('id'))]); return { ci, ls, cs }; },
    construir: (f, B, D) => {
      const nDias = Math.max(1, new Set(D.cs.map((c) => diaGt(c.fecha))).size), pac = new Set(D.cs.map((c) => c.paciente_id)), nuevos = D.ci.filter((c) => c.primera_vez && c.estado === 'ATENDIDA').length;
      const ing = sum(D.ls.map((l) => num(l.total) + num(l.reconocido))), ase = sum(D.ls.map((l) => num(l.parte_aseguradora))), noA = D.ci.filter((c) => c.estado === 'NO ASISTIÓ').length;
      const esp = D.ci.map((c) => minutos(c.llegada, c.inicio_consulta)).filter((x) => x != null), cob = new Set(D.ls.map((l) => l.cobro_id)).size;
      const I = [['Consultas realizadas', D.cs.length, 'Consultas no anuladas del período'], ['Pacientes atendidos', pac.size, 'Pacientes distintos'], ['Pacientes nuevos', nuevos, 'Citas atendidas de primera vez'],
        ['Pacientes recurrentes', Math.max(0, pac.size - nuevos), 'Atendidos que ya tenían consultas'], ['Consultas por día', r2(D.cs.length / nDias), `${nDias} días con consulta`], ['Consultas por paciente', pac.size ? r2(D.cs.length / pac.size) : 0, 'Frecuencia de uso'],
        ['Ausentismo (%)', D.ci.length ? r2((noA / D.ci.length) * 100) : 0, `${noA} de ${D.ci.length} citas`], ['Espera promedio (min)', esp.length ? Math.round(sum(esp) / esp.length) : 0, 'Llegada a inicio de consulta'],
        ['Ingresos (Q)', r2(ing), 'Pacientes, aseguradoras y paquetes'], ['Ticket promedio (Q)', cob ? r2(ing / cob) : 0, `${cob} cobros`], ['Ingreso por consulta (Q)', D.cs.length ? r2(ing / D.cs.length) : 0, ''], ['Participación de aseguradoras (%)', ing ? r2((ase / ing) * 100) : 0, 'Del ingreso total']];
      const ms = meses(f);
      return { kpis: [['Consultas', D.cs.length], ['Pacientes', pac.size], ['Ticket promedio', cob ? q(ing / cob) : '—', 'ec-fin'], ['Ausentismo', `${D.ci.length ? ((noA / D.ci.length) * 100).toFixed(1) : 0} %`, D.ci.length && noA / D.ci.length > 0.15 ? 'ec-alerta' : '']],
        columnas: [col('Indicador', 'texto', 32), col('Valor', 'numero', 14), col('Base de cálculo', 'texto', 36)], filas: I.map(([a, b, c]) => ({ valores: [a, b, c] })),
        graficas: [G().columnas('Consultas por mes', ms.map((m) => MES[Number(m.slice(5, 7)) - 1].slice(0, 3)), [{ nombre: 'Consultas', color: G().COLORES.AZUL, valores: ms.map((m) => D.cs.filter((c) => diaGt(c.fecha).startsWith(m)).length) }])] };
    } });
})();
