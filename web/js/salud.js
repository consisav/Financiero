// Hospital y Clínicas médicas · etapa 1 (script 161): catálogos clínicos y registros de atención.
// Motor común: catálogos editables por secciones y registros con listado, formulario, detalle, impresión del documento
// y exportación del listado a PDF y Excel. Las pantallas med-* se muestran en Hospital y en Clínicas.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const hoy = () => fmt.hoy();
  const sumarDias = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const diaGt = (v) => (v ? new Date(v).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }) : '');
  const fhGt = (v) => (v ? new Date(v).toLocaleString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') : '');
  const aLocal = (v) => { if (!v) return ''; const d = new Date(v); const p = (n) => String(n).padStart(2, '0'); const g = new Date(d.toLocaleString('en-US', { timeZone: 'America/Guatemala' })); return `${g.getFullYear()}-${p(g.getMonth() + 1)}-${p(g.getDate())}T${p(g.getHours())}:${p(g.getMinutes())}`; };
  const deLocal = (v) => (v ? `${v}:00-06:00` : null);
  const edad = (fn) => { if (!fn) return ''; const a = new Date(`${fn}T12:00:00`), b = new Date(); let e = b.getFullYear() - a.getFullYear(); if (b < new Date(b.getFullYear(), a.getMonth(), a.getDate())) e--; return e; };
  const empresaDe = (ctx) => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
  const errorTxt = (e) => window.UI.traducirError(e);
  const falta = (ctx, e) => { ctx.pDet.innerHTML = `<p class="vacio">${/med_|lab_|img_|hos_|cli_|far_/.test(e?.message || '') ? 'Falta instalar el script 161 (Hospital y clínicas, etapa 1) en Supabase.' : esc(errorTxt(e))}</p>`; };
  const CLS = { NORMAL: 'aprobada', BAJO: 'pendiente', ALTO: 'pendiente', 'CRÍTICO': 'anulada', 'EN PROCESO': 'pendiente', VALIDADO: 'editando', ENTREGADO: 'aprobada', ANULADO: 'anulada', ANULADA: 'anulada', PENDIENTE: 'pendiente', INFORMADO: 'editando',
    'EN CURSO': 'pendiente', TERMINADA: 'aprobada', SUSPENDIDA: 'anulada', PROGRAMADA: 'editando', ADMINISTRADA: 'aprobada', OMITIDA: 'anulada', EMITIDA: 'editando', ACEPTADA: 'aprobada', RECHAZADA: 'anulada', VENCIDA: 'anulada',
    SOLICITADA: 'pendiente', AUTORIZADA: 'aprobada', PARCIAL: 'pendiente', UTILIZADA: 'definitiva', VIVO: 'aprobada', MORTINATO: 'anulada', FALLECIDO: 'anulada', ALTA: 'aprobada', 'OBSERVACIÓN': 'pendiente', 'HOSPITALIZACIÓN': 'editando' };
  const marca = (e) => `<span class="pc-marca ${CLS[e] || ''}">${esc(e)}</span>`;
  const PRIO = { 1: ['ROJO · RESUCITACIÓN', 'anulada', 0], 2: ['NARANJA · EMERGENCIA', 'anulada', 10], 3: ['AMARILLO · URGENCIA', 'pendiente', 60], 4: ['VERDE · MENOS URGENTE', 'aprobada', 120], 5: ['AZUL · NO URGENTE', 'editando', 240] };
  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) { const { data, error } = await hacer().range(i, i + 999); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; }
    return out;
  }
  const botonesExp = '<button type="button" class="boton secundario-sm" data-exp="PDF"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button><button type="button" class="boton secundario-sm" data-exp="EXCEL"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>';
  function exportar(c, formato) {
    if (!c || !c.filas.length) return window.FIN.aviso('No hay información para imprimir');
    const s = { ...c, filas: c.filas.map((r) => ({ ...r, resaltar: r.resaltar ? 1 : undefined, valores: r.valores.map((v) => (typeof v === 'string' && v.startsWith('¤') ? v.slice(1) : v)) })) };
    if (formato === 'PDF') return window.CUENTAS_XLSX.pdf(s);
    window.REPORTE_XLSX.generar(s);
  }
  const celda = (v, x) => (v === '' || v == null ? '<td></td>' : typeof v === 'number' ? `<td class="num">${x.tipo === 'monto' ? fmt.monto(v) : v.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</td>` : String(v).startsWith('¤') ? `<td>${marca(String(v).slice(1))}</td>` : `<td>${esc(String(v))}</td>`);

  // ---------- Base compartida ----------
  async function base(ctx) {
    const { sb } = ctx, loc = ctx.sel.loc;
    const leer = (t, ord = 'id') => sb.from(t).select('*').eq('localidad_id', loc).order(ord);
    let pr = await leer('med_procedimientos', 'codigo'); if (pr.error) throw pr.error;
    if (!(pr.data || []).length) { const r = await sb.rpc('med_asegurar_catalogos', { p_localidad: loc }); if (r.error) throw r.error; pr = await leer('med_procedimientos', 'codigo'); }
    const [me, es, as, ar, lp, ie, di, sa, va, pq, pl, ki, pac, adm] = await Promise.all([leer('hos_medicos', 'nombre'), leer('hos_especialidades', 'codigo'), leer('hos_aseguradoras', 'nombre'), leer('hos_areas', 'codigo'),
      leer('lab_pruebas', 'codigo'), leer('img_estudios', 'codigo'), leer('hos_dietas', 'codigo'), leer('hos_salas', 'codigo'), leer('cli_vacunas', 'edad_meses'), leer('hos_paquetes_qx', 'codigo'), leer('med_planes', 'nombre'), leer('med_kits', 'codigo'),
      leerTodo(() => sb.from('hos_pacientes').select('id, expediente, nombres, apellidos, dpi, fecha_nacimiento, genero, aseguradora_id').eq('localidad_id', loc).order('expediente')),
      sb.from('hos_admisiones').select('id, numero, paciente_id, estado, fecha_ingreso, medico_id, cama_id, diagnostico_ingreso, aseguradora_id').eq('localidad_id', loc).order('numero', { ascending: false }).limit(400)]);
    return { procedimientos: pr.data || [], medicos: me.data || [], especialidades: es.data || [], aseguradoras: as.data || [], areas: ar.data || [], pruebas: lp.data || [], estudios: ie.data || [], dietas: di.data || [],
      salas: sa.data || [], vacunas: va.data || [], paquetes: pq.data || [], planes: pl.data || [], kits: ki.data || [], pacientes: pac, admisiones: adm.data || [] };
  }
  const nomPac = (B, id) => { const p = B.pacientes.find((x) => x.id === id); return p ? `${p.expediente} · ${p.nombres} ${p.apellidos}` : ''; };
  const pacDe = (B, t) => { const n = Number(String(t || '').split(' · ')[0]); return B.pacientes.find((p) => p.expediente === n) || null; };
  const nomMed = (B, id) => B.medicos.find((m) => m.id === id)?.nombre || '';
  const nomAdm = (B, id) => { const a = B.admisiones.find((x) => x.id === id); return a ? `Adm. ${a.numero} · ${nomPac(B, a.paciente_id)}` : ''; };
  const nom = (lista, id, k = 'nombre') => lista.find((x) => x.id === id)?.[k] || '';

  // ===================== Catálogos por secciones =====================
  function catalogo(cont, op) {
    const ctx = montar(cont, { titulo: op.titulo, icono: op.icono, clase: 'bk-movimientos bm-solo cx-rep pf-cat', grupo: op.grupo || 'Catálogos clínicos' });
    const { sb } = ctx;
    let B = null, sec = 0, filas = [], buscar = '';
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    const S = () => op.secciones[sec];
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', op.icono); return; }
      ctx.filtros(`${op.secciones.length > 1 ? `<label class="campo"><span>Catálogo</span><select name="sec">${op.secciones.map((s, i) => `<option value="${i}" ${sec === i ? 'selected' : ''}>${s.titulo}</option>`).join('')}</select></label>` : ''}<label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar value="${esc(buscar)}" placeholder="Buscar…"></label>`,
        `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>' : ''}${botonesExp}`);
      try {
        B = await base(ctx); const s = S();
        if (s.leer) filas = await s.leer(ctx, B); else { const { data, error } = await sb.from(s.tabla).select('*').eq('localidad_id', ctx.sel.loc).order(s.orden || 'id'); if (error) throw error; filas = data || []; }
      } catch (e) { return falta(ctx, e); }
      pintar();
    }
    const opciones = (c) => (c.ref ? [['', '—'], ...c.ref(B)] : c.opciones.map((o) => [o, o]));
    const txt = (c, f) => (c.calc ? c.calc(f, B) : c.tipo === 'check' ? (f[c.k] ? 'Sí' : 'No') : c.ref ? (c.ref(B).find(([v]) => String(v) === String(f[c.k]))?.[1] || '') : f[c.k] ?? '');
    const vis = () => filas.filter((f) => !buscar || JSON.stringify(f).toLowerCase().includes(buscar.toLowerCase()));
    function pintar() {
      const s = S(), ed = ctx.admin;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> ${s.ayuda}</p>${s.kpis ? `<div class="ec-kpis">${s.kpis(filas, B).map(([t, v, c]) => kpi(t, v, c)).join('')}</div>` : ''}
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${s.campos.map((c) => `<th>${c.titulo}</th>`).join('')}${ed ? '<th></th>' : ''}</tr></thead><tbody>
        ${vis().slice(0, 600).map((f) => `<tr data-id="${f.id}">${s.campos.map((c) => (c.calc || !ed ? `<td>${esc(String(txt(c, f)))}</td>` : c.opciones || c.ref ? `<td><select data-c="${c.k}">${opciones(c).map(([v, t]) => `<option value="${esc(String(v))}" ${String(f[c.k] ?? '') === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></td>`
          : c.tipo === 'check' ? `<td><input type="checkbox" data-c="${c.k}" ${f[c.k] ? 'checked' : ''}></td>` : `<td><input data-c="${c.k}" value="${esc(String(f[c.k] ?? ''))}" ${c.tipo === 'numero' ? 'type="number" step="any"' : c.tipo === 'fecha' ? 'type="date"' : ''}></td>`)).join('')}
          ${ed ? '<td><button type="button" class="icono-boton rp-peligro" data-quitar title="Quitar"><i class="ti ti-trash" aria-hidden="true"></i></button></td>' : ''}</tr>`).join('') || `<tr><td colspan="${s.campos.length + 1}" class="tk-vacio">Sin registros.</td></tr>`}</tbody></table></div></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    const cfg = () => ({ titulo: S().titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: S().titulo.slice(0, 30), archivo: S().tabla, parametros: [`Empresa: ${empresaDe(ctx)}`], columnas: S().campos.map((c) => col(c.titulo, c.tipo === 'numero' && !c.ref ? 'numero' : 'texto', c.ancho || 16)), filas: vis().map((f) => ({ valores: S().campos.map((c) => (c.tipo === 'numero' && !c.ref && !c.calc ? num(f[c.k]) : String(txt(c, f)))) })) });
    cont.addEventListener('input', (e) => { if (e.target.matches('[data-buscar]')) { buscar = e.target.value; pintar(); const i = cont.querySelector('[data-buscar]'); i.focus(); i.setSelectionRange(buscar.length, buscar.length); } });
    cont.addEventListener('change', async (e) => {
      const cm = ctx.cambioOrgLoc(e); if (cm === 'org' || cm === 'loc') return cargar();
      if (e.target.name === 'sec' && e.target.closest('.bk-filtros')) { sec = Number(e.target.value); buscar = ''; return cargar(); }
      const tr = e.target.closest('tr[data-id]'); const k = e.target.dataset.c; if (!tr || !k) return;
      const c = S().campos.find((x) => x.k === k);
      const v = c.tipo === 'check' ? e.target.checked : c.tipo === 'numero' && !c.ref ? (e.target.value === '' ? null : num(e.target.value)) : c.ref ? (Number(e.target.value) || null) : c.tipo === 'fecha' ? e.target.value || null : c.mayus === false ? e.target.value.trim() : e.target.value.trim().toUpperCase();
      const { error } = await sb.from(S().tabla).update({ [k]: v }).eq('id', Number(tr.dataset.id));
      if (error) { window.FIN.aviso(errorTxt(error)); return cargar(); }
      Object.assign(filas.find((f) => String(f.id) === tr.dataset.id), { [k]: v }); if (S().kpis) pintar();
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg(), ex.dataset.exp);
      if (e.target.closest('[data-accion="nuevo"]')) { const n = S().nuevo(filas, B); if (!n) return; const { error } = await sb.from(S().tabla).insert({ ...(S().sinLoc ? {} : { organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }), ...n }); if (error) return window.FIN.aviso(errorTxt(error)); return cargar(); }
      if (e.target.closest('[data-quitar]')) { if (!confirm('¿Quitar el registro?')) return; const { error } = await sb.from(S().tabla).delete().eq('id', Number(e.target.closest('tr').dataset.id)); if (error) return window.FIN.aviso(/foreign|referen/i.test(error.message) ? 'Está en uso: márcalo inactivo' : errorTxt(error)); cargar(); }
    });
    iniciar();
  }
  const sig = (f) => Math.max(0, ...f.map((x) => Number(x.codigo) || 0)) + 1;
  const refEsp = (B) => B.especialidades.map((x) => [x.id, x.nombre]);
  const refProc = (B) => B.procedimientos.map((x) => [x.id, `${x.codigo} · ${x.descripcion}`]);
  const refAse = (B) => B.aseguradoras.map((x) => [x.id, x.nombre]);

  window.PANTALLAS['med-procedimientos'] = (cont) => catalogo(cont, { titulo: 'Procedimientos, paquetes y kits', icono: 'ti-scalpel', secciones: [
    { titulo: 'Procedimientos (CIE-9-MC)', tabla: 'med_procedimientos', orden: 'codigo', ayuda: 'Procedimientos quirúrgicos, obstétricos, diagnósticos y terapéuticos con su código CIE-9-MC, duración estimada, precio base y si requieren consentimiento informado.', kpis: (f) => [['Procedimientos', f.length], ['Quirúrgicos', f.filter((x) => x.tipo === 'QUIRÚRGICO').length], ['Activos', f.filter((x) => x.activo).length, 'ec-fin']],
      campos: [{ k: 'codigo', titulo: 'Código', ancho: 8 }, { k: 'descripcion', titulo: 'Procedimiento', ancho: 40 }, { k: 'tipo', titulo: 'Tipo', opciones: ['QUIRÚRGICO', 'DIAGNÓSTICO', 'TERAPÉUTICO', 'OBSTÉTRICO', 'MENOR'] }, { k: 'especialidad_id', titulo: 'Especialidad', ref: refEsp }, { k: 'tiempo_min', titulo: 'Minutos', tipo: 'numero' }, { k: 'precio', titulo: 'Precio Q', tipo: 'numero' }, { k: 'requiere_consentimiento', titulo: 'Consentimiento', tipo: 'check' }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
      nuevo: () => { const c = prompt('Código CIE-9-MC del procedimiento:'); return c ? { codigo: c.trim().toUpperCase(), descripcion: 'NUEVO PROCEDIMIENTO' } : null; } },
    { titulo: 'Paquetes quirúrgicos', tabla: 'hos_paquetes_qx', orden: 'codigo', ayuda: 'Paquetes de precio cerrado: procedimiento, días de estancia y tipo de cama, honorarios incluidos y lo que incluye y excluye. Se usan en cotizaciones y cartas de garantía.',
      campos: [{ k: 'codigo', titulo: 'No.', tipo: 'numero', ancho: 6 }, { k: 'nombre', titulo: 'Paquete', ancho: 30 }, { k: 'procedimiento_id', titulo: 'Procedimiento', ref: refProc, ancho: 30 }, { k: 'dias_estancia', titulo: 'Días', tipo: 'numero' }, { k: 'tipo_cama', titulo: 'Cama', opciones: ['PRIVADA', 'SEMIPRIVADA', 'GENERAL'] }, { k: 'precio', titulo: 'Precio Q', tipo: 'numero' }, { k: 'honorario_cirujano', titulo: 'Hon. cirujano', tipo: 'numero' }, { k: 'honorario_anestesia', titulo: 'Hon. anestesia', tipo: 'numero' }, { k: 'incluye', titulo: 'Incluye', ancho: 30, mayus: false }, { k: 'excluye', titulo: 'Excluye', ancho: 24, mayus: false }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
      nuevo: (f, B) => { const p = B.procedimientos.find((x) => x.codigo === '74.1') || B.procedimientos[0]; return { codigo: sig(f), nombre: `PAQUETE ${p?.descripcion || 'QUIRÚRGICO'}`, procedimiento_id: p?.id || null, dias_estancia: 2, precio: Math.round(num(p?.precio) * 2.2), honorario_cirujano: num(p?.precio), honorario_anestesia: Math.round(num(p?.precio) * 0.4), incluye: 'Sala de operaciones, habitación, medicamentos e insumos del procedimiento, honorarios de cirujano y anestesiólogo', excluye: 'Complicaciones, transfusiones, días adicionales' }; } },
    { titulo: 'Kits por procedimiento', tabla: 'med_kits', orden: 'codigo', ayuda: 'Kits de insumos y medicamentos estándar de cada procedimiento (sus artículos se registran en «Artículos de los kits»). En la etapa de procesos se cargan a la cuenta del paciente y descargan el inventario.',
      campos: [{ k: 'codigo', titulo: 'No.', tipo: 'numero', ancho: 6 }, { k: 'nombre', titulo: 'Kit', ancho: 30 }, { k: 'procedimiento_id', titulo: 'Procedimiento', ref: refProc, ancho: 34 }, { k: 'activo', titulo: 'Activo', tipo: 'check' }], nuevo: (f) => ({ codigo: sig(f), nombre: 'KIT QUIRÚRGICO BÁSICO' }) },
    { titulo: 'Artículos de los kits', tabla: 'med_kit_items', sinLoc: true, ayuda: 'Artículos de cada kit con su cantidad (producto de inventario opcional) y si se cobran al paciente.',
      leer: async (ctx, B) => { if (!B.kits.length) return []; const { data, error } = await ctx.sb.from('med_kit_items').select('*').in('kit_id', B.kits.map((k) => k.id)).order('kit_id'); if (error) throw error; return data || []; },
      campos: [{ k: 'kit_id', titulo: 'Kit', ref: (B) => B.kits.map((k) => [k.id, k.nombre]), ancho: 26 }, { k: 'descripcion', titulo: 'Artículo', ancho: 34 }, { k: 'producto_id', titulo: 'Producto (inventario)', tipo: 'numero' }, { k: 'cantidad', titulo: 'Cantidad', tipo: 'numero' }, { k: 'cobrable', titulo: 'Se cobra', tipo: 'check' }],
      nuevo: (f, B) => (B.kits.length ? { kit_id: B.kits[0].id, descripcion: 'GUANTES ESTÉRILES', cantidad: 2 } : (window.FIN.aviso('Primero crea un kit'), null)) }] });
  window.PANTALLAS['med-laboratorio'] = (cont) => catalogo(cont, { titulo: 'Pruebas de laboratorio e imagen', icono: 'ti-microscope', secciones: [
    { titulo: 'Pruebas de laboratorio', tabla: 'lab_pruebas', orden: 'codigo', ayuda: 'Pruebas por área con unidad, valores de referencia y valores críticos (al registrar el resultado se marca bajo, alto o crítico), muestra, tiempo de entrega y precio.', kpis: (f) => [['Pruebas', f.length], ['Perfiles', f.filter((x) => x.es_perfil).length], ['Con valores críticos', f.filter((x) => x.critico_min != null || x.critico_max != null).length]],
      campos: [{ k: 'codigo', titulo: 'Código', ancho: 8 }, { k: 'nombre', titulo: 'Prueba', ancho: 30, mayus: false }, { k: 'area', titulo: 'Área', opciones: ['HEMATOLOGÍA', 'QUÍMICA', 'ORINA', 'HECES', 'INMUNOLOGÍA', 'HORMONAS', 'MICROBIOLOGÍA', 'COAGULACIÓN', 'OTRA'] }, { k: 'unidad', titulo: 'Unidad', mayus: false }, { k: 'ref_min', titulo: 'Ref. mín.', tipo: 'numero' }, { k: 'ref_max', titulo: 'Ref. máx.', tipo: 'numero' }, { k: 'ref_texto', titulo: 'Ref. texto', mayus: false }, { k: 'critico_min', titulo: 'Crítico <', tipo: 'numero' }, { k: 'critico_max', titulo: 'Crítico >', tipo: 'numero' }, { k: 'muestra', titulo: 'Muestra' }, { k: 'tiempo_horas', titulo: 'Horas', tipo: 'numero' }, { k: 'precio', titulo: 'Precio Q', tipo: 'numero' }, { k: 'es_perfil', titulo: 'Perfil', tipo: 'check' }, { k: 'activo', titulo: 'Activa', tipo: 'check' }],
      nuevo: () => { const c = prompt('Código de la prueba:'); return c ? { codigo: c.trim().toUpperCase(), nombre: 'Nueva prueba' } : null; } },
    { titulo: 'Pruebas de cada perfil', tabla: 'lab_perfil_pruebas', sinLoc: true, ayuda: 'Pruebas que componen cada perfil (hematología completa, perfil de lípidos…): al ordenar el perfil se registran todas.',
      leer: async (ctx, B) => { const ids = B.pruebas.filter((p) => p.es_perfil).map((p) => p.id); if (!ids.length) return []; const { data, error } = await ctx.sb.from('lab_perfil_pruebas').select('*').in('perfil_id', ids).order('perfil_id'); if (error) throw error; return data || []; },
      campos: [{ k: 'perfil_id', titulo: 'Perfil', ref: (B) => B.pruebas.filter((p) => p.es_perfil).map((p) => [p.id, p.nombre]), ancho: 26 }, { k: 'prueba_id', titulo: 'Prueba', ref: (B) => B.pruebas.filter((p) => !p.es_perfil).map((p) => [p.id, `${p.codigo} · ${p.nombre}`]), ancho: 30 }],
      nuevo: (f, B) => { const pf = B.pruebas.find((p) => p.es_perfil), pr = B.pruebas.find((p) => !p.es_perfil); return pf && pr ? { perfil_id: pf.id, prueba_id: pr.id } : (window.FIN.aviso('Marca primero una prueba como perfil'), null); } },
    { titulo: 'Estudios de imagen', tabla: 'img_estudios', orden: 'codigo', ayuda: 'Estudios por modalidad con la preparación del paciente, la plantilla de informe y el precio.',
      campos: [{ k: 'codigo', titulo: 'Código', ancho: 9 }, { k: 'nombre', titulo: 'Estudio', ancho: 34 }, { k: 'modalidad', titulo: 'Modalidad', opciones: ['RAYOS X', 'ULTRASONIDO', 'TOMOGRAFÍA', 'RESONANCIA', 'MAMOGRAFÍA', 'DENSITOMETRÍA', 'FLUOROSCOPÍA', 'OTRA'] }, { k: 'preparacion', titulo: 'Preparación', ancho: 26, mayus: false }, { k: 'plantilla', titulo: 'Plantilla de informe', ancho: 30, mayus: false }, { k: 'precio', titulo: 'Precio Q', tipo: 'numero' }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
      nuevo: () => { const c = prompt('Código del estudio:'); return c ? { codigo: c.trim().toUpperCase(), nombre: 'NUEVO ESTUDIO' } : null; } }] });
  window.PANTALLAS['med-convenios'] = (cont) => catalogo(cont, { titulo: 'Planes, convenios y referentes', icono: 'ti-file-certificate', secciones: [
    { titulo: 'Planes de aseguradoras', tabla: 'med_planes', orden: 'nombre', ayuda: 'Planes de cada aseguradora con deducible, coaseguro, tope anual, copago de consulta y si requieren preautorización (carta de garantía).',
      campos: [{ k: 'aseguradora_id', titulo: 'Aseguradora', ref: refAse, ancho: 24 }, { k: 'nombre', titulo: 'Plan', ancho: 24 }, { k: 'deducible', titulo: 'Deducible Q', tipo: 'numero' }, { k: 'coaseguro_pct', titulo: 'Coaseguro %', tipo: 'numero' }, { k: 'tope_anual', titulo: 'Tope anual Q', tipo: 'numero' }, { k: 'copago_consulta', titulo: 'Copago consulta Q', tipo: 'numero' }, { k: 'requiere_preautorizacion', titulo: 'Preautorización', tipo: 'check' }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
      nuevo: (f, B) => (B.aseguradoras.length ? { aseguradora_id: B.aseguradoras[0].id, nombre: 'PLAN BÁSICO', deducible: 1000, coaseguro_pct: 20, copago_consulta: 100 } : (window.FIN.aviso('Primero registra una aseguradora'), null)) },
    { titulo: 'Empresas con convenio', tabla: 'med_convenios', orden: 'empresa', ayuda: 'Empresas con convenio de atención para sus colaboradores: descuento, días de crédito y vigencia.',
      campos: [{ k: 'empresa', titulo: 'Empresa', ancho: 30 }, { k: 'nit', titulo: 'NIT' }, { k: 'contacto', titulo: 'Contacto' }, { k: 'telefono', titulo: 'Teléfono' }, { k: 'descuento_pct', titulo: 'Descuento %', tipo: 'numero' }, { k: 'dias_credito', titulo: 'Días crédito', tipo: 'numero' }, { k: 'vigente_hasta', titulo: 'Vigente hasta', tipo: 'fecha' }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
      nuevo: () => ({ empresa: 'NUEVA EMPRESA', descuento_pct: 10, dias_credito: 30 }) },
    { titulo: 'Médicos referentes', tabla: 'med_referentes', orden: 'nombre', ayuda: 'Médicos externos que refieren pacientes, con su comisión por referencia.',
      campos: [{ k: 'nombre', titulo: 'Médico', ancho: 28 }, { k: 'colegiado', titulo: 'Colegiado' }, { k: 'especialidad', titulo: 'Especialidad' }, { k: 'telefono', titulo: 'Teléfono' }, { k: 'comision_pct', titulo: 'Comisión %', tipo: 'numero' }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
      nuevo: () => ({ nombre: 'DR. REFERENTE', comision_pct: 5 }) }] });
  window.PANTALLAS['hos-recursos'] = (cont) => catalogo(cont, { titulo: 'Formulario, dietas, salas y personal', icono: 'ti-building-hospital', grupo: 'Hospital · Catálogos', secciones: [
    { titulo: 'Formulario terapéutico', tabla: 'far_formulario', orden: 'nombre', ayuda: 'Medicamentos autorizados en el hospital, su grupo, si son controlados (psicotrópicos, estupefacientes o precursores, con su libro de control del MSPAS) y el stock mínimo de piso.', kpis: (f) => [['Medicamentos', f.length], ['Controlados', f.filter((x) => x.controlado).length, 'ec-alerta']],
      campos: [{ k: 'nombre', titulo: 'Medicamento', ancho: 30 }, { k: 'grupo', titulo: 'Grupo terapéutico' }, { k: 'producto_id', titulo: 'Producto', tipo: 'numero' }, { k: 'controlado', titulo: 'Controlado', tipo: 'check' }, { k: 'clase_control', titulo: 'Clase', opciones: ['', 'PSICOTRÓPICO', 'ESTUPEFACIENTE', 'PRECURSOR'] }, { k: 'requiere_receta', titulo: 'Receta', tipo: 'check' }, { k: 'stock_minimo', titulo: 'Stock mínimo', tipo: 'numero' }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
      nuevo: () => ({ nombre: 'DIAZEPAM 10 MG/2 ML', grupo: 'ANSIOLÍTICOS', controlado: true, clase_control: 'PSICOTRÓPICO' }) },
    { titulo: 'Dietas', tabla: 'hos_dietas', orden: 'codigo', ayuda: 'Tipos de dieta que se indican en la nota de enfermería y su precio por día.', campos: [{ k: 'codigo', titulo: 'No.', tipo: 'numero', ancho: 6 }, { k: 'nombre', titulo: 'Dieta', ancho: 26 }, { k: 'descripcion', titulo: 'Descripción', ancho: 34, mayus: false }, { k: 'precio_dia', titulo: 'Precio día Q', tipo: 'numero' }, { k: 'activo', titulo: 'Activa', tipo: 'check' }], nuevo: (f) => ({ codigo: sig(f), nombre: 'NUEVA DIETA' }) },
    { titulo: 'Salas de operaciones y partos', tabla: 'hos_salas', orden: 'codigo', ayuda: 'Salas de operaciones, partos, procedimientos y recuperación con su tarifa por hora y estado.', campos: [{ k: 'codigo', titulo: 'Código', ancho: 8 }, { k: 'nombre', titulo: 'Sala', ancho: 26 }, { k: 'tipo', titulo: 'Tipo', opciones: ['QUIRÓFANO', 'SALA DE PARTOS', 'PROCEDIMIENTOS', 'ENDOSCOPÍA', 'RECUPERACIÓN'] }, { k: 'tarifa_hora', titulo: 'Tarifa hora Q', tipo: 'numero' }, { k: 'estado', titulo: 'Estado', opciones: ['DISPONIBLE', 'OCUPADA', 'LIMPIEZA', 'MANTENIMIENTO'] }, { k: 'activo', titulo: 'Activa', tipo: 'check' }], nuevo: (f) => ({ codigo: `SOP-${f.length + 1}`, nombre: `SALA DE OPERACIONES ${f.length + 1}` }) },
    { titulo: 'Personal de enfermería y apoyo', tabla: 'hos_personal', orden: 'nombre', ayuda: 'Personal por cargo, área y turno (el código de empleado enlaza con Nóminas).', kpis: (f) => [['Personal', f.length], ['Mañana', f.filter((x) => x.turno === 'MAÑANA').length], ['Tarde', f.filter((x) => x.turno === 'TARDE').length], ['Noche', f.filter((x) => x.turno === 'NOCHE').length]],
      campos: [{ k: 'nombre', titulo: 'Nombre', ancho: 28 }, { k: 'cargo', titulo: 'Cargo', opciones: ['ENFERMERA(O) PROFESIONAL', 'ENFERMERA(O) AUXILIAR', 'INSTRUMENTISTA', 'TÉCNICO DE LABORATORIO', 'TÉCNICO DE RAYOS X', 'QUÍMICO BIÓLOGO', 'QUÍMICO FARMACÉUTICO', 'CAMILLERO', 'NUTRICIONISTA', 'OTRO'] }, { k: 'area_id', titulo: 'Área', ref: (B) => B.areas.map((a) => [a.id, a.nombre]) }, { k: 'turno', titulo: 'Turno', opciones: ['MAÑANA', 'TARDE', 'NOCHE', 'ROTATIVO'] }, { k: 'registro', titulo: 'Registro / colegiado' }, { k: 'telefono', titulo: 'Teléfono' }, { k: 'empleado_id', titulo: 'Empleado (nómina)', tipo: 'numero' }, { k: 'activo', titulo: 'Activo', tipo: 'check' }],
      nuevo: () => ({ nombre: 'NOMBRE DEL PERSONAL', cargo: 'ENFERMERA(O) AUXILIAR', turno: 'MAÑANA' }) }] });
  window.PANTALLAS['cli-vacunas'] = (cont) => catalogo(cont, { titulo: 'Esquema de vacunación', icono: 'ti-vaccine-bottle', grupo: 'Clínicas médicas · Catálogos', secciones: [
    { titulo: 'Vacunas', tabla: 'cli_vacunas', orden: 'edad_meses', ayuda: 'Esquema de vacunación por edad (referencia del esquema nacional; ajústalo a la norma vigente del MSPAS) con vía, producto de inventario y precio.',
      campos: [{ k: 'codigo', titulo: 'Código', ancho: 9 }, { k: 'nombre', titulo: 'Vacuna', ancho: 30 }, { k: 'dosis', titulo: 'Dosis' }, { k: 'edad_meses', titulo: 'Edad (meses)', tipo: 'numero' }, { k: 'via', titulo: 'Vía' }, { k: 'producto_id', titulo: 'Producto', tipo: 'numero' }, { k: 'precio', titulo: 'Precio Q', tipo: 'numero' }, { k: 'activo', titulo: 'Activa', tipo: 'check' }],
      nuevo: () => { const c = prompt('Código de la vacuna:'); return c ? { codigo: c.trim().toUpperCase(), nombre: 'NUEVA VACUNA', dosis: 'ÚNICA' } : null; } }] });

  // ===================== Registros: motor común =====================
  // op: { titulo, icono, grupo, tabla, ayuda, fecha (columna para filtrar), campos: [{k, t, tipo, op, req, ancho}], columnas: [{t, v, tipo}], kpis, nuevo, imprimir, detalle, orden }
  function registro(cont, op) {
    const ctx = montar(cont, { titulo: op.titulo, icono: op.icono, clase: 'bk-movimientos bm-solo cx-rep pr-rep', grupo: op.grupo });
    const { sb } = ctx;
    const f = { desde: sumarDias(hoy(), -(op.dias || 30)), hasta: hoy(), buscar: '' }; let B = null, filas = [], actual = null, form = null, lineas = [], cfg = null;
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', op.icono); return; }
      ctx.filtros(`<label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}"></label><label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}"></label><label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar value="${esc(f.buscar)}" placeholder="Paciente, número…"></label>`,
        `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button>' : ''}${botonesExp}`);
      ctx.pDet.innerHTML = '<p class="vacio">Leyendo…</p>';
      try {
        B = await base(ctx);
        let q = sb.from(op.tabla).select(op.select || '*');
        q = op.porAdmision ? q.in('admision_id', B.admisiones.map((a) => a.id).concat([0])) : q.eq('localidad_id', ctx.sel.loc);
        if (op.fecha) { const fh = op.fechaTipo === 'fecha'; q = q.gte(op.fecha, fh ? f.desde : `${f.desde}T00:00:00-06:00`).lte(op.fecha, fh ? f.hasta : `${f.hasta}T23:59:59-06:00`); }
        const { data, error } = await q.order(op.orden || 'id', { ascending: false }).limit(1000); if (error) throw error; filas = data || [];
      } catch (e) { return falta(ctx, e); }
      if (actual) actual = filas.find((x) => x.id === actual.id) || null;
      pintar();
    }
    const vis = () => filas.filter((r) => !f.buscar || `${op.columnas.map((c) => c.v(r, B)).join(' ')}`.toLowerCase().includes(f.buscar.toLowerCase()));
    const valorCampo = (c, v) => {
      const dis = ctx.admin ? '' : 'disabled', val = v[c.k];
      if (c.tipo === 'area') return `<label class="campo sat-ancho"><span>${c.t}</span><textarea name="${c.k}" rows="${c.filas || 3}" ${dis}>${esc(val ?? '')}</textarea></label>`;
      if (c.tipo === 'check') return `<label class="pc-check"><input type="checkbox" name="${c.k}" ${val ? 'checked' : ''} ${dis}> ${c.t}</label>`;
      if (c.tipo === 'checks') { const ch = val || {}; return `<fieldset class="campo sat-ancho sal-checks"><legend>${c.t}</legend>${c.items.map(([g, items]) => `<div><b>${g}</b>${items.map((it, i) => `<label class="pc-check"><input type="checkbox" name="chk:${g}:${i}" ${ch[`${g}:${i}`] ? 'checked' : ''} ${dis}> ${esc(it)}</label>`).join('')}</div>`).join('')}</fieldset>`; }
      if (c.tipo === 'paciente') return `<label class="campo sat-ancho"><span>${c.t}${c.req ? ' *' : ''}</span><input name="${c.k}" list="sal-pac" value="${esc(nomPac(B, val))}" autocomplete="off" ${dis}></label>`;
      if (c.tipo === 'sel' || c.tipo === 'medico' || c.tipo === 'admision') {
        const ops = c.tipo === 'medico' ? B.medicos.filter((m) => m.activo || m.id === val).map((m) => [m.id, m.nombre]) : c.tipo === 'admision' ? B.admisiones.filter((a) => a.estado === 'ABIERTA' || a.id === val || c.todas).map((a) => [a.id, `Adm. ${a.numero} · ${nomPac(B, a.paciente_id)}${a.estado !== 'ABIERTA' ? ` (${a.estado.toLowerCase()})` : ''}`]) : typeof c.op === 'function' ? c.op(B) : c.op.map((x) => [x, x]);
        return `<label class="campo ${c.ancho ? 'sat-ancho' : ''}"><span>${c.t}${c.req ? ' *' : ''}</span><select name="${c.k}" ${dis}>${c.vacio === false ? '' : '<option value="">—</option>'}${ops.map(([x, t]) => `<option value="${esc(String(x))}" ${String(val ?? '') === String(x) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
      }
      const tipo = c.tipo === 'numero' ? 'type="number" step="any"' : c.tipo === 'fecha' ? 'type="date"' : c.tipo === 'fechahora' ? 'type="datetime-local"' : '';
      const vv = c.tipo === 'fechahora' ? aLocal(val) : val ?? '';
      return `<label class="campo ${c.ancho ? 'sat-ancho' : ''}"><span>${c.t}${c.req ? ' *' : ''}</span><input name="${c.k}" ${tipo} value="${esc(String(vv))}" ${dis}></label>`;
    };
    function pintar() {
      const vs = vis();
      cfg = { titulo: op.titulo, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: op.titulo.slice(0, 30), archivo: op.tabla, parametros: [`Empresa: ${empresaDe(ctx)}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}`, `${vs.length} registro(s)`],
        columnas: op.columnas.map((c) => col(c.t, c.tipo || 'texto', c.ancho || 14)), filas: vs.map((r) => ({ valores: op.columnas.map((c) => c.v(r, B)), resaltar: op.resaltar ? op.resaltar(r, B) : false })) };
      const v = form || {};
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico">${op.ayuda ? `<p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> ${op.ayuda}</p>` : ''}
        ${op.kpis ? `<div class="ec-kpis">${op.kpis(vs, B).map(([t, x, c]) => kpi(t, x, c)).join('')}</div>` : ''}
        ${form ? `<form class="sal-form" novalidate><div class="cl-banda">${actual ? `${esc(op.nombre || op.titulo)}${actual.numero ? ` No. ${actual.numero}` : ''}` : `Nuevo: ${esc(op.nombre || op.titulo)}`}</div><div class="sat-g">${op.campos.map((c) => valorCampo(c, v)).join('')}</div>
          ${actual && op.detalle ? detalleHtml() : ''}
          <p class="acciones-form">${ctx.admin ? `<button type="button" class="boton primario-sm" data-accion="guardar"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${actual ? 'Guardar' : 'Registrar'}</button> ` : ''}${actual && op.imprimir !== false ? '<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button> ' : ''}${(op.acciones ? op.acciones(actual, B) : '')}<button type="button" class="boton secundario-sm" data-accion="cerrar"><i class="ti ti-x" aria-hidden="true"></i> Cerrar</button></p></form><datalist id="sal-pac">${B.pacientes.map((p) => `<option value="${esc(`${p.expediente} · ${p.nombres} ${p.apellidos}`)}">${esc(p.dpi || '')}</option>`).join('')}</datalist>` : ''}
        <div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${cfg.columnas.map((c) => `<th class="${c.tipo === 'texto' ? '' : 'num'}">${esc(c.titulo)}</th>`).join('')}</tr></thead><tbody>
          ${cfg.filas.slice(0, 500).map((r, i) => `<tr data-reg="${vs[i].id}" class="${vs[i].id === actual?.id ? 'cr-n2' : ''}${r.resaltar ? ' pr-alerta' : ''}" style="cursor:pointer">${cfg.columnas.map((c, j) => celda(r.valores[j], c)).join('')}</tr>`).join('') || `<tr><td colspan="${cfg.columnas.length}" class="tk-vacio">Sin registros en el período. Usa «Nuevo».</td></tr>`}</tbody></table></div></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    function detalleHtml() {
      const d = op.detalle, ed = ctx.admin;
      return `<div class="cl-banda">${d.titulo}</div><div class="pc-lineas cx-tabla iv-tabla pr-tabla"><table><thead><tr>${d.columnas.map((c) => `<th>${c.t}</th>`).join('')}${ed ? '<th></th>' : ''}</tr></thead><tbody>
        ${lineas.map((l) => `<tr data-lin="${l.id}">${d.columnas.map((c) => (c.editable && ed ? `<td><input data-l="${c.k}" value="${esc(String(l[c.k] ?? ''))}" ${c.tipo === 'numero' ? 'type="number" step="any"' : ''} style="width:${c.ancho || 110}px"></td>` : celda(c.v ? c.v(l, B) : l[c.k], { tipo: c.tipo || 'texto' }))).join('')}${ed ? `<td><button type="button" class="icono-boton rp-peligro" data-qlin="${l.id}"><i class="ti ti-trash" aria-hidden="true"></i></button></td>` : ''}</tr>`).join('') || `<tr><td colspan="${d.columnas.length + 1}" class="tk-vacio">Sin líneas.</td></tr>`}</tbody></table></div>
        ${ed ? `<div class="sat-g">${d.agregarHtml(B)}<button type="button" class="boton secundario-sm" data-accion="agregar-linea"><i class="ti ti-plus" aria-hidden="true"></i> Agregar</button></div>` : ''}`;
    }
    async function leerLineas() { lineas = []; if (!actual || !op.detalle) return; const { data } = await sb.from(op.detalle.tabla).select('*').eq(op.detalle.fk, actual.id).order('id'); lineas = data || []; }
    function leerForm() {
      const fr = cont.querySelector('form.sal-form'); const reg = {};
      op.campos.forEach((c) => {
        if (c.tipo === 'checks') { const ch = {}; c.items.forEach(([g, items]) => items.forEach((_, i) => { if (fr.querySelector(`[name="chk:${g}:${i}"]`)?.checked) ch[`${g}:${i}`] = true; })); reg[c.k] = ch; return; }
        const el = fr.elements[c.k]; if (!el) return;
        if (c.tipo === 'check') reg[c.k] = el.checked;
        else if (c.tipo === 'paciente') reg[c.k] = pacDe(B, el.value)?.id || null;
        else if (['sel', 'medico', 'admision'].includes(c.tipo)) reg[c.k] = el.value === '' ? null : (c.texto ? el.value : /^\d+$/.test(el.value) ? Number(el.value) : el.value);
        else if (c.tipo === 'numero') reg[c.k] = el.value === '' ? null : num(el.value);
        else if (c.tipo === 'fechahora') reg[c.k] = deLocal(el.value);
        else if (c.tipo === 'fecha') reg[c.k] = el.value || null;
        else reg[c.k] = el.value.trim() === '' ? null : (c.tipo === 'area' || c.mayus === false ? el.value.trim() : el.value.trim().toUpperCase());
      });
      return reg;
    }
    async function guardar() {
      const reg = leerForm();
      const faltan = op.campos.filter((c) => c.req && (reg[c.k] == null || reg[c.k] === '')); if (faltan.length) return window.FIN.aviso(`Completa: ${faltan.map((c) => c.t).join(', ')}`);
      if (op.antes) { const m = op.antes(reg, B, actual); if (m) return window.FIN.aviso(m); }
      const extra = op.porAdmision ? {} : { organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, ...(op.numerado ? { numero: 0 } : {}) };
      const r = actual ? await sb.from(op.tabla).update(reg).eq('id', actual.id).select().single() : await sb.from(op.tabla).insert({ ...extra, ...reg }).select().single();
      if (r.error) return window.FIN.aviso(errorTxt(r.error));
      if (op.despues) await op.despues(r.data, ctx, B, !actual);
      window.FIN.aviso(actual ? 'Guardado' : `${op.nombre || 'Registro'}${r.data.numero ? ` No. ${r.data.numero}` : ''} registrado`);
      actual = r.data; form = op.alAbrir ? op.alAbrir({ ...r.data }) : { ...r.data }; await leerLineas(); await cargar();
    }
    function imprimirReg() {
      if (op.imprimir) return imprimir(`${op.nombre || op.titulo}${actual.numero ? ` No. ${actual.numero}` : ''}`, op.imprimir(actual, B, lineas, ctx));
      const filas = op.campos.filter((c) => c.tipo !== 'checks').map((c) => { const v = actual[c.k]; const t = c.tipo === 'paciente' ? nomPac(B, v) : c.tipo === 'medico' ? nomMed(B, v) : c.tipo === 'admision' ? nomAdm(B, v) : c.tipo === 'check' ? (v ? 'Sí' : 'No') : c.tipo === 'fechahora' ? fhGt(v) : c.tipo === 'fecha' && v ? fmt.fechaDia(v) : typeof c.op === 'function' ? (c.op(B).find(([x]) => String(x) === String(v))?.[1] || v || '') : v ?? ''; return `<tr><th style="width:32%">${esc(c.t)}</th><td>${esc(String(t))}</td></tr>`; }).join('');
      imprimir(`${op.nombre || op.titulo}${actual.numero ? ` No. ${actual.numero}` : ''}`, `<h2>${esc(op.nombre || op.titulo)}${actual.numero ? ` No. ${actual.numero}` : ''}</h2><table>${filas}</table>`);
    }
    cont.addEventListener('input', (e) => { if (e.target.matches('[data-buscar]')) { f.buscar = e.target.value; pintar(); const i = cont.querySelector('[data-buscar]'); i.focus(); i.setSelectionRange(f.buscar.length, f.buscar.length); } });
    cont.addEventListener('change', async (e) => {
      const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') { actual = null; form = null; return cargar(); }
      if (['desde', 'hasta'].includes(e.target.name) && e.target.closest('.bk-filtros')) { f[e.target.name] = e.target.value; return cargar(); }
      const tr = e.target.closest('tr[data-lin]'); if (tr && e.target.dataset.l) { const { error } = await sb.from(op.detalle.tabla).update({ [e.target.dataset.l]: e.target.value }).eq('id', Number(tr.dataset.lin)); if (error) window.FIN.aviso(errorTxt(error)); await leerLineas(); return pintar(); }
      if (op.alCambiar && e.target.closest('form.sal-form')) { const v = op.alCambiar(e.target.name, e.target.value, B, cont); if (v) { form = { ...leerForm(), ...v }; pintar(); } }
    });
    cont.addEventListener('click', async (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return exportar(cfg, ex.dataset.exp);
      const tr = e.target.closest('tr[data-reg]'); if (tr) { actual = filas.find((x) => String(x.id) === tr.dataset.reg); form = op.alAbrir ? op.alAbrir({ ...actual }) : { ...actual }; await leerLineas(); return pintar(); }
      const ql = e.target.closest('[data-qlin]'); if (ql) { await sb.from(op.detalle.tabla).delete().eq('id', Number(ql.dataset.qlin)); await leerLineas(); return pintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion; if (!a) return;
      if (a === 'nuevo') { actual = null; lineas = []; form = op.nuevo ? op.nuevo(B) : {}; return pintar(); }
      if (a === 'cerrar') { actual = null; form = null; return pintar(); }
      if (a === 'guardar') return guardar();
      if (a === 'imprimir') return imprimirReg();
      if (a === 'agregar-linea') { const rows = await op.detalle.agregar(actual, B, cont, ctx); if (!rows?.length) return; const { error } = await sb.from(op.detalle.tabla).insert(rows.map((x) => ({ [op.detalle.fk]: actual.id, ...x }))); if (error) return window.FIN.aviso(errorTxt(error)); await leerLineas(); return pintar(); }
      if (op.alAccion) { const r = await op.alAccion(a, actual, B, ctx, cont); if (r === 'recargar') return cargar(); }
    });
    iniciar();
  }
  const firma = (t) => `<p style="margin-top:60px;text-align:center">______________________________<br>${esc(t)}</p>`;
  const encab = (titulo, B, r, extra = '') => `<h2>${esc(titulo)}${r.numero ? ` No. ${r.numero}` : ''}</h2><p><b>Paciente:</b> ${esc(nomPac(B, r.paciente_id || r.madre_id))}${(() => { const p = B.pacientes.find((x) => x.id === (r.paciente_id || r.madre_id)); return p?.fecha_nacimiento ? ` · ${edad(p.fecha_nacimiento)} años` : ''; })()}${extra}</p>`;
  const refProcSel = (B) => B.procedimientos.filter((p) => p.activo).map((p) => [p.id, `${p.codigo} · ${p.descripcion}`]);

  // ===================== Emergencia y triaje =====================
  window.PANTALLAS['hos-triaje'] = (cont) => registro(cont, { titulo: 'Emergencia y triaje', nombre: 'Triaje', icono: 'ti-ambulance', grupo: 'Hospital · Registros', tabla: 'hos_triaje', fecha: 'llegada', orden: 'llegada', numerado: true, dias: 7,
    ayuda: 'Clasificación del paciente al llegar a emergencia en cinco niveles de prioridad, con el tiempo máximo de espera de cada nivel; se registra la atención médica, el diagnóstico y el destino.',
    campos: [{ k: 'paciente_id', t: 'Paciente (si está registrado)', tipo: 'paciente' }, { k: 'nombre_provisional', t: 'Nombre provisional (paciente no identificado)' }, { k: 'llegada', t: 'Llegada', tipo: 'fechahora' },
      { k: 'prioridad', t: 'Prioridad', tipo: 'sel', op: () => Object.entries(PRIO).map(([k, v]) => [k, `${k} · ${v[0]} (espera máx. ${v[2]} min)`]), vacio: false, ancho: 1 }, { k: 'motivo', t: 'Motivo de consulta', req: true, ancho: 1 },
      { k: 'presion', t: 'Presión arterial' }, { k: 'frecuencia_cardiaca', t: 'Frec. cardíaca', tipo: 'numero' }, { k: 'temperatura', t: 'Temperatura °C', tipo: 'numero' }, { k: 'saturacion', t: 'Saturación %', tipo: 'numero' }, { k: 'glasgow', t: 'Glasgow (3-15)', tipo: 'numero' }, { k: 'dolor', t: 'Dolor (0-10)', tipo: 'numero' },
      { k: 'medico_id', t: 'Médico que atiende', tipo: 'medico' }, { k: 'atencion', t: 'Inicio de atención', tipo: 'fechahora' }, { k: 'diagnostico', t: 'Diagnóstico', ancho: 1 },
      { k: 'destino', t: 'Destino', tipo: 'sel', op: ['ALTA', 'OBSERVACIÓN', 'HOSPITALIZACIÓN', 'CIRUGÍA', 'REFERENCIA', 'FALLECIDO', 'FUGA'] }, { k: 'salida', t: 'Salida de emergencia', tipo: 'fechahora' }],
    nuevo: () => ({ llegada: new Date().toISOString(), prioridad: 3 }),
    antes: (r) => (!r.paciente_id && !r.nombre_provisional ? 'Elige al paciente o escribe un nombre provisional' : null),
    columnas: [{ t: 'No.', v: (r) => String(r.numero), ancho: 6 }, { t: 'Llegada', v: (r) => fhGt(r.llegada), ancho: 15 }, { t: 'Paciente', v: (r, B) => nomPac(B, r.paciente_id) || r.nombre_provisional || '', ancho: 26 }, { t: 'Prioridad', v: (r) => `${r.prioridad} · ${PRIO[r.prioridad]?.[0] || ''}`, ancho: 20 },
      { t: 'Motivo', v: (r) => r.motivo || '', ancho: 24 }, { t: 'Espera (min)', v: (r) => (r.atencion ? Math.round((new Date(r.atencion) - new Date(r.llegada)) / 60000) : ''), tipo: 'numero', ancho: 9 }, { t: 'Destino', v: (r) => (r.destino ? `¤${r.destino}` : '¤PENDIENTE'), ancho: 14 }],
    resaltar: (r) => !r.atencion && (Date.now() - new Date(r.llegada)) / 60000 > (PRIO[r.prioridad]?.[2] ?? 60),
    kpis: (xs) => { const at = xs.filter((r) => r.atencion); const esp = at.map((r) => (new Date(r.atencion) - new Date(r.llegada)) / 60000); return [['Pacientes', xs.length], ['Sin atender', xs.filter((r) => !r.atencion).length, xs.some((r) => !r.atencion) ? 'ec-alerta' : ''], ['Espera promedio', esp.length ? `${Math.round(esp.reduce((a, b) => a + b, 0) / esp.length)} min` : '—'], ['Hospitalizados', xs.filter((r) => r.destino === 'HOSPITALIZACIÓN').length]]; },
    acciones: (r) => (r && r.paciente_id && r.destino === 'HOSPITALIZACIÓN' && !r.admision_id ? '<button type="button" class="boton secundario-sm" data-accion="admitir"><i class="ti ti-bed" aria-hidden="true"></i> Abrir admisión</button> ' : ''),
    alAccion: async (a, r, B, ctx) => { if (a !== 'admitir') return; const { data, error } = await ctx.sb.from('hos_admisiones').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, numero: 0, paciente_id: r.paciente_id, tipo: 'EMERGENCIA', medico_id: r.medico_id, diagnostico_ingreso: r.diagnostico || r.motivo }).select().single(); if (error) return window.FIN.aviso(errorTxt(error)); await ctx.sb.from('hos_triaje').update({ admision_id: data.id }).eq('id', r.id); window.FIN.aviso(`Admisión ${data.numero} abierta: asígnale cama en Admisión`); return 'recargar'; },
    imprimir: (r, B) => `${encab('Hoja de emergencia', B, r)}<p><b>Llegada:</b> ${fhGt(r.llegada)} · <b>Prioridad:</b> ${r.prioridad} ${esc(PRIO[r.prioridad]?.[0] || '')}</p><p><b>Motivo:</b> ${esc(r.motivo || '')}</p><p><b>Signos:</b> PA ${esc(r.presion || '—')} · FC ${r.frecuencia_cardiaca ?? '—'} · T ${r.temperatura ?? '—'} °C · SpO₂ ${r.saturacion ?? '—'} % · Glasgow ${r.glasgow ?? '—'} · Dolor ${r.dolor ?? '—'}/10</p><p><b>Diagnóstico:</b> ${esc(r.diagnostico || '')}</p><p><b>Destino:</b> ${esc(r.destino || '')}</p>${firma(nomMed(B, r.medico_id) || 'Médico de turno')}` });

  // ===================== Notas de evolución y enfermería =====================
  window.PANTALLAS['hos-notas'] = (cont) => registro(cont, { titulo: 'Notas de evolución y enfermería', nombre: 'Nota', icono: 'ti-notes', grupo: 'Hospital · Registros', tabla: 'hos_notas', porAdmision: true, fecha: 'fecha', orden: 'fecha', dias: 3,
    ayuda: 'Notas por turno de cada paciente internado: evolución médica, nota de enfermería con signos vitales, ingesta y excreta, dieta indicada, interconsultas y nutrición.',
    campos: [{ k: 'admision_id', t: 'Admisión', tipo: 'admision', req: true, ancho: 1 }, { k: 'tipo', t: 'Tipo', tipo: 'sel', op: ['EVOLUCIÓN', 'ENFERMERÍA', 'INTERCONSULTA', 'NUTRICIÓN'], vacio: false }, { k: 'fecha', t: 'Fecha y hora', tipo: 'fechahora' }, { k: 'turno', t: 'Turno', tipo: 'sel', op: ['MAÑANA', 'TARDE', 'NOCHE'] },
      { k: 'presion', t: 'Presión' }, { k: 'frecuencia_cardiaca', t: 'FC', tipo: 'numero' }, { k: 'frecuencia_respiratoria', t: 'FR', tipo: 'numero' }, { k: 'temperatura', t: 'T °C', tipo: 'numero' }, { k: 'saturacion', t: 'SpO₂ %', tipo: 'numero' }, { k: 'glucosa', t: 'Glucosa', tipo: 'numero' },
      { k: 'ingesta_ml', t: 'Ingesta ml', tipo: 'numero' }, { k: 'excreta_ml', t: 'Excreta ml', tipo: 'numero' }, { k: 'dieta_id', t: 'Dieta', tipo: 'sel', op: (B) => B.dietas.map((d) => [d.id, d.nombre]) }, { k: 'texto', t: 'Nota', tipo: 'area', req: true, filas: 5 }, { k: 'autor', t: 'Responsable' }],
    nuevo: () => ({ fecha: new Date().toISOString(), tipo: 'ENFERMERÍA', turno: new Date().getHours() < 13 ? 'MAÑANA' : new Date().getHours() < 19 ? 'TARDE' : 'NOCHE' }),
    columnas: [{ t: 'Fecha', v: (r) => fhGt(r.fecha), ancho: 15 }, { t: 'Admisión', v: (r, B) => nomAdm(B, r.admision_id), ancho: 28 }, { t: 'Tipo', v: (r) => r.tipo, ancho: 12 }, { t: 'Turno', v: (r) => r.turno || '', ancho: 8 }, { t: 'Signos', v: (r) => [r.presion && `PA ${r.presion}`, r.frecuencia_cardiaca && `FC ${r.frecuencia_cardiaca}`, r.temperatura && `T ${r.temperatura}`].filter(Boolean).join(' · '), ancho: 22 }, { t: 'Balance ml', v: (r) => (r.ingesta_ml != null || r.excreta_ml != null ? r2(num(r.ingesta_ml) - num(r.excreta_ml)) : ''), tipo: 'numero', ancho: 9 }, { t: 'Nota', v: (r) => (r.texto || '').slice(0, 80), ancho: 40 }],
    resaltar: (r) => num(r.temperatura) >= 38.5 || (r.saturacion != null && r.saturacion < 92),
    kpis: (xs) => [['Notas', xs.length], ['Evoluciones', xs.filter((r) => r.tipo === 'EVOLUCIÓN').length], ['Enfermería', xs.filter((r) => r.tipo === 'ENFERMERÍA').length], ['Con alerta de signos', xs.filter((r) => num(r.temperatura) >= 38.5 || (r.saturacion != null && r.saturacion < 92)).length, 'ec-alerta']] });

  // ===================== Kardex de medicamentos =====================
  window.PANTALLAS['hos-kardex'] = (cont) => registro(cont, { titulo: 'Kardex de medicamentos', nombre: 'Dosis', icono: 'ti-pill', grupo: 'Hospital · Registros', tabla: 'hos_kardex', porAdmision: true, fecha: 'programada', orden: 'programada', dias: 2,
    ayuda: 'Programación y administración de cada dosis por paciente: hora programada, administrada u omitida, responsable y observación. Las dosis vencidas sin administrar se resaltan.',
    campos: [{ k: 'admision_id', t: 'Admisión', tipo: 'admision', req: true, ancho: 1 }, { k: 'medicamento', t: 'Medicamento', req: true, ancho: 1 }, { k: 'dosis', t: 'Dosis' }, { k: 'via', t: 'Vía', tipo: 'sel', op: ['ORAL', 'INTRAVENOSA', 'INTRAMUSCULAR', 'SUBCUTÁNEA', 'INHALADA', 'TÓPICA', 'RECTAL', 'SUBLINGUAL'] },
      { k: 'programada', t: 'Hora programada', tipo: 'fechahora' }, { k: 'estado', t: 'Estado', tipo: 'sel', op: ['PROGRAMADA', 'ADMINISTRADA', 'OMITIDA', 'SUSPENDIDA'], vacio: false }, { k: 'responsable', t: 'Responsable' }, { k: 'observacion', t: 'Observación', ancho: 1 }],
    nuevo: () => ({ programada: new Date().toISOString(), estado: 'PROGRAMADA', via: 'ORAL' }),
    columnas: [{ t: 'Programada', v: (r) => fhGt(r.programada), ancho: 15 }, { t: 'Admisión', v: (r, B) => nomAdm(B, r.admision_id), ancho: 28 }, { t: 'Medicamento', v: (r) => r.medicamento, ancho: 26 }, { t: 'Dosis / vía', v: (r) => [r.dosis, r.via].filter(Boolean).join(' · '), ancho: 16 }, { t: 'Estado', v: (r) => `¤${r.estado}`, ancho: 12 }, { t: 'Administrada', v: (r) => fhGt(r.administrada), ancho: 15 }, { t: 'Responsable', v: (r) => r.responsable || '', ancho: 14 }],
    resaltar: (r) => r.estado === 'PROGRAMADA' && new Date(r.programada) < new Date(Date.now() - 30 * 60000),
    kpis: (xs) => [['Dosis', xs.length], ['Administradas', xs.filter((r) => r.estado === 'ADMINISTRADA').length, 'ec-fin'], ['Vencidas sin administrar', xs.filter((r) => r.estado === 'PROGRAMADA' && new Date(r.programada) < new Date(Date.now() - 30 * 60000)).length, 'ec-alerta'], ['Omitidas', xs.filter((r) => r.estado === 'OMITIDA').length]],
    acciones: (r) => (r && r.estado === 'PROGRAMADA' ? '<button type="button" class="boton secundario-sm" data-accion="administrar"><i class="ti ti-check" aria-hidden="true"></i> Administrada</button> <button type="button" class="boton secundario-sm" data-accion="repetir"><i class="ti ti-repeat" aria-hidden="true"></i> Programar siguientes</button> ' : ''),
    alAccion: async (a, r, B, ctx) => {
      if (a === 'administrar') { const { error } = await ctx.sb.from('hos_kardex').update({ estado: 'ADMINISTRADA' }).eq('id', r.id); if (error) window.FIN.aviso(errorTxt(error)); return 'recargar'; }
      if (a === 'repetir') { const h = Number(prompt('Cada cuántas horas:', '8')); const n = Number(prompt('Cuántas dosis más:', '3')); if (!h || !n) return; const rows = Array.from({ length: n }, (_, i) => ({ admision_id: r.admision_id, medicamento: r.medicamento, dosis: r.dosis, via: r.via, programada: new Date(new Date(r.programada).getTime() + (i + 1) * h * 3600000).toISOString() })); const { error } = await ctx.sb.from('hos_kardex').insert(rows); if (error) return window.FIN.aviso(errorTxt(error)); window.FIN.aviso(`${n} dosis programadas`); return 'recargar'; }
    } });

  // ===================== Resultados de laboratorio =====================
  const origenes = ['CLÍNICA', 'HOSPITAL', 'EMERGENCIA', 'EXTERNO'];
  window.PANTALLAS['med-resultados-lab'] = (cont) => registro(cont, { titulo: 'Resultados de laboratorio', nombre: 'Resultado de laboratorio', icono: 'ti-test-pipe', grupo: 'Apoyo diagnóstico', tabla: 'lab_resultados', fecha: 'toma', orden: 'toma', numerado: true, dias: 15,
    ayuda: 'Orden de laboratorio del paciente con sus pruebas (un perfil agrega todas sus pruebas). Al escribir el valor se marca normal, bajo, alto o crítico según los valores de referencia; los críticos se resaltan para avisar de inmediato al médico.',
    campos: [{ k: 'paciente_id', t: 'Paciente', tipo: 'paciente', req: true }, { k: 'origen', t: 'Origen', tipo: 'sel', op: origenes, vacio: false }, { k: 'admision_id', t: 'Admisión', tipo: 'admision' }, { k: 'medico_id', t: 'Médico que solicita', tipo: 'medico' },
      { k: 'toma', t: 'Toma de muestra', tipo: 'fechahora' }, { k: 'estado', t: 'Estado', tipo: 'sel', op: ['EN PROCESO', 'VALIDADO', 'ENTREGADO', 'ANULADO'], vacio: false }, { k: 'validado_por', t: 'Validado por (químico biólogo)' }, { k: 'entrega', t: 'Entrega', tipo: 'fechahora' }, { k: 'observaciones', t: 'Observaciones', tipo: 'area', filas: 2 }],
    nuevo: () => ({ origen: 'CLÍNICA', toma: new Date().toISOString(), estado: 'EN PROCESO' }),
    columnas: [{ t: 'No.', v: (r) => String(r.numero), ancho: 6 }, { t: 'Toma', v: (r) => fhGt(r.toma), ancho: 15 }, { t: 'Paciente', v: (r, B) => nomPac(B, r.paciente_id), ancho: 28 }, { t: 'Origen', v: (r) => r.origen, ancho: 11 }, { t: 'Médico', v: (r, B) => nomMed(B, r.medico_id), ancho: 20 }, { t: 'Estado', v: (r) => `¤${r.estado}`, ancho: 12 }, { t: 'Horas a entrega', v: (r) => (r.entrega ? r2((new Date(r.entrega) - new Date(r.toma)) / 3600000) : ''), tipo: 'numero', ancho: 9 }],
    kpis: (xs) => [['Órdenes', xs.length], ['En proceso', xs.filter((r) => r.estado === 'EN PROCESO').length, 'ec-alerta'], ['Entregadas', xs.filter((r) => r.estado === 'ENTREGADO').length, 'ec-fin']],
    detalle: { titulo: 'Pruebas y resultados', tabla: 'lab_resultado_lineas', fk: 'resultado_id',
      columnas: [{ k: 'prueba', t: 'Prueba', v: (l, B) => { const p = B.pruebas.find((x) => x.id === l.prueba_id); return p ? `${p.codigo} · ${p.nombre}` : ''; } }, { k: 'valor', t: 'Resultado', editable: true, ancho: 120 }, { k: 'unidad', t: 'Unidad' }, { k: 'referencia', t: 'Referencia' }, { k: 'alerta', t: 'Alerta', v: (l) => (l.alerta ? `¤${l.alerta}` : '') }],
      agregarHtml: (B) => `<label class="campo sat-ancho"><span>Prueba o perfil</span><select name="lab_prueba">${B.pruebas.filter((p) => p.activo).map((p) => `<option value="${p.id}">${esc(`${p.es_perfil ? 'PERFIL · ' : ''}${p.codigo} · ${p.nombre}`)}</option>`).join('')}</select></label>`,
      agregar: async (r, B, cont, ctx) => { const id = Number(cont.querySelector('[name=lab_prueba]').value); const p = B.pruebas.find((x) => x.id === id); if (!p) return []; if (!p.es_perfil) return [{ prueba_id: id }]; const { data } = await ctx.sb.from('lab_perfil_pruebas').select('prueba_id').eq('perfil_id', id); return (data || []).map((x) => ({ prueba_id: x.prueba_id })); } },
    imprimir: (r, B, ls) => `${encab('Informe de laboratorio', B, r, ` · <b>Toma:</b> ${fhGt(r.toma)}`)}<p><b>Médico:</b> ${esc(nomMed(B, r.medico_id))}</p><table><tr><th>Prueba</th><th>Resultado</th><th>Unidad</th><th>Valores de referencia</th><th></th></tr>${ls.map((l) => { const p = B.pruebas.find((x) => x.id === l.prueba_id); return `<tr><td>${esc(p?.nombre || '')}</td><td><b>${esc(l.valor || '')}</b></td><td>${esc(l.unidad || '')}</td><td>${esc(l.referencia || '')}</td><td>${l.alerta && l.alerta !== 'NORMAL' ? `<b>${esc(l.alerta)}</b>` : ''}</td></tr>`; }).join('')}</table>${r.observaciones ? `<p>${esc(r.observaciones)}</p>` : ''}${firma(r.validado_por || 'Químico biólogo')}` });

  // ===================== Informes de imagen =====================
  window.PANTALLAS['med-informes-imagen'] = (cont) => registro(cont, { titulo: 'Informes de imagen', nombre: 'Informe de imagen', icono: 'ti-radioactive', grupo: 'Apoyo diagnóstico', tabla: 'img_informes', fecha: 'fecha', orden: 'fecha', numerado: true, dias: 15,
    ayuda: 'Estudio realizado al paciente con los hallazgos y la conclusión del radiólogo. Al elegir el estudio se carga su plantilla de informe.',
    campos: [{ k: 'paciente_id', t: 'Paciente', tipo: 'paciente', req: true }, { k: 'estudio_id', t: 'Estudio', tipo: 'sel', op: (B) => B.estudios.filter((x) => x.activo).map((x) => [x.id, `${x.modalidad} · ${x.nombre}`]), req: true, ancho: 1 }, { k: 'origen', t: 'Origen', tipo: 'sel', op: origenes, vacio: false },
      { k: 'admision_id', t: 'Admisión', tipo: 'admision' }, { k: 'medico_solicita_id', t: 'Médico que solicita', tipo: 'medico' }, { k: 'radiologo_id', t: 'Radiólogo', tipo: 'medico' }, { k: 'fecha', t: 'Fecha', tipo: 'fechahora' },
      { k: 'estado', t: 'Estado', tipo: 'sel', op: ['PENDIENTE', 'INFORMADO', 'ENTREGADO', 'ANULADO'], vacio: false }, { k: 'hallazgos', t: 'Hallazgos', tipo: 'area', filas: 6 }, { k: 'conclusion', t: 'Conclusión / impresión diagnóstica', tipo: 'area', filas: 3 }],
    nuevo: () => ({ origen: 'CLÍNICA', fecha: new Date().toISOString(), estado: 'PENDIENTE' }),
    alCambiar: (n, v, B, cont) => { if (n !== 'estudio_id') return null; const e = B.estudios.find((x) => String(x.id) === v); const h = cont.querySelector('[name=hallazgos]'); if (e?.plantilla && h && !h.value.trim()) return { estudio_id: e.id, hallazgos: e.plantilla }; return null; },
    columnas: [{ t: 'No.', v: (r) => String(r.numero), ancho: 6 }, { t: 'Fecha', v: (r) => fhGt(r.fecha), ancho: 15 }, { t: 'Paciente', v: (r, B) => nomPac(B, r.paciente_id), ancho: 28 }, { t: 'Estudio', v: (r, B) => nom(B.estudios, r.estudio_id), ancho: 28 }, { t: 'Radiólogo', v: (r, B) => nomMed(B, r.radiologo_id), ancho: 20 }, { t: 'Estado', v: (r) => `¤${r.estado}`, ancho: 12 }],
    kpis: (xs) => [['Estudios', xs.length], ['Pendientes de informe', xs.filter((r) => r.estado === 'PENDIENTE').length, 'ec-alerta'], ['Informados', xs.filter((r) => ['INFORMADO', 'ENTREGADO'].includes(r.estado)).length, 'ec-fin']],
    imprimir: (r, B) => `${encab(`Informe de ${nom(B.estudios, r.estudio_id).toLowerCase()}`, B, r, ` · <b>Fecha:</b> ${fhGt(r.fecha)}`)}<p><b>Solicita:</b> ${esc(nomMed(B, r.medico_solicita_id))}</p><h3>Hallazgos</h3><p style="white-space:pre-wrap">${esc(r.hallazgos || '')}</p><h3>Conclusión</h3><p style="white-space:pre-wrap"><b>${esc(r.conclusion || '')}</b></p>${firma(nomMed(B, r.radiologo_id) || 'Médico radiólogo')}` });

  // ===================== Hoja quirúrgica (cirugía segura OMS) =====================
  const CHECK_OMS = [['Entrada (antes de la anestesia)', ['Identidad, sitio, procedimiento y consentimiento confirmados', 'Sitio quirúrgico marcado', 'Verificación de máquina y medicamentos de anestesia', 'Pulsioxímetro colocado y funcionando', 'Alergias conocidas revisadas', 'Vía aérea difícil o riesgo de aspiración evaluados', 'Riesgo de hemorragia > 500 ml previsto (acceso y sangre disponibles)']],
    ['Pausa quirúrgica (antes de la incisión)', ['Miembros del equipo presentados por nombre y función', 'Paciente, sitio y procedimiento confirmados en voz alta', 'Profilaxis antibiótica en los últimos 60 minutos', 'Eventos críticos previstos revisados (cirujano, anestesia, enfermería)', 'Esterilidad del instrumental confirmada', 'Imágenes diagnósticas esenciales visibles']],
    ['Salida (antes de salir del quirófano)', ['Nombre del procedimiento registrado', 'Recuento de instrumentos, gasas y agujas completo', 'Muestras etiquetadas con el nombre del paciente', 'Problemas con el instrumental o equipos registrados', 'Aspectos críticos de la recuperación revisados']]];
  window.PANTALLAS['hos-hoja-quirurgica'] = (cont) => registro(cont, { titulo: 'Hoja quirúrgica', nombre: 'Hoja quirúrgica', icono: 'ti-scalpel', grupo: 'Hospital · Registros', tabla: 'hos_cirugias', fecha: 'fecha', fechaTipo: 'fecha', orden: 'fecha', numerado: true, dias: 30,
    ayuda: 'Registro de cada cirugía: equipo, anestesia, clasificación ASA, tiempos (ingreso a sala, incisión, cierre y salida), lista de verificación de la cirugía segura de la OMS en sus tres momentos, protocolo operatorio, hallazgos, sangrado y conteo.',
    campos: [{ k: 'paciente_id', t: 'Paciente', tipo: 'paciente', req: true }, { k: 'admision_id', t: 'Admisión', tipo: 'admision' }, { k: 'fecha', t: 'Fecha', tipo: 'fecha' }, { k: 'sala_id', t: 'Sala', tipo: 'sel', op: (B) => B.salas.map((s) => [s.id, s.nombre]) },
      { k: 'procedimiento_id', t: 'Procedimiento', tipo: 'sel', op: refProcSel, ancho: 1 }, { k: 'clasificacion', t: 'Clasificación', tipo: 'sel', op: ['ELECTIVA', 'URGENCIA', 'EMERGENCIA'], vacio: false }, { k: 'herida', t: 'Tipo de herida', tipo: 'sel', op: ['LIMPIA', 'LIMPIA-CONTAMINADA', 'CONTAMINADA', 'SUCIA'] },
      { k: 'cirujano_id', t: 'Cirujano', tipo: 'medico' }, { k: 'ayudante_id', t: 'Ayudante', tipo: 'medico' }, { k: 'anestesiologo_id', t: 'Anestesiólogo', tipo: 'medico' }, { k: 'instrumentista', t: 'Instrumentista' }, { k: 'circulante', t: 'Circulante' },
      { k: 'tipo_anestesia', t: 'Anestesia', tipo: 'sel', op: ['GENERAL', 'RAQUÍDEA', 'EPIDURAL', 'BLOQUEO', 'LOCAL', 'SEDACIÓN'] }, { k: 'asa', t: 'ASA', tipo: 'sel', op: ['I', 'II', 'III', 'IV', 'V', 'VI'] },
      { k: 'ingreso_sala', t: 'Ingreso a sala', tipo: 'fechahora' }, { k: 'inicio_anestesia', t: 'Inicio anestesia', tipo: 'fechahora' }, { k: 'incision', t: 'Incisión', tipo: 'fechahora' }, { k: 'cierre', t: 'Cierre', tipo: 'fechahora' }, { k: 'salida_sala', t: 'Salida de sala', tipo: 'fechahora' },
      { k: 'checklist', t: 'Lista de verificación de la seguridad de la cirugía (OMS)', tipo: 'checks', items: CHECK_OMS }, { k: 'diagnostico_pre', t: 'Diagnóstico preoperatorio', ancho: 1 }, { k: 'diagnostico_post', t: 'Diagnóstico postoperatorio', ancho: 1 },
      { k: 'hallazgos', t: 'Hallazgos', tipo: 'area' }, { k: 'protocolo', t: 'Protocolo operatorio (técnica)', tipo: 'area', filas: 6 }, { k: 'complicaciones', t: 'Complicaciones', tipo: 'area', filas: 2 }, { k: 'sangrado_ml', t: 'Sangrado ml', tipo: 'numero' },
      { k: 'conteo_completo', t: 'Conteo de gasas e instrumental completo', tipo: 'check' }, { k: 'muestras_patologia', t: 'Envío de muestras a patología', tipo: 'check' }, { k: 'estado', t: 'Estado', tipo: 'sel', op: ['EN CURSO', 'TERMINADA', 'SUSPENDIDA'], vacio: false }],
    nuevo: () => ({ fecha: hoy(), clasificacion: 'ELECTIVA', estado: 'EN CURSO', checklist: {} }),
    antes: (r) => { if (r.estado === 'TERMINADA') { const n = Object.keys(r.checklist || {}).length, t = CHECK_OMS.reduce((s, [, i]) => s + i.length, 0); if (n < t) return `Para terminar la cirugía completa la lista de verificación (${n} de ${t})`; if (!r.conteo_completo) return 'Confirma el conteo completo antes de terminar'; } return null; },
    columnas: [{ t: 'No.', v: (r) => String(r.numero), ancho: 6 }, { t: 'Fecha', v: (r) => fmt.fechaDia(r.fecha), ancho: 10 }, { t: 'Paciente', v: (r, B) => nomPac(B, r.paciente_id), ancho: 26 }, { t: 'Procedimiento', v: (r, B) => nom(B.procedimientos, r.procedimiento_id, 'descripcion') || r.procedimiento_texto || '', ancho: 28 }, { t: 'Cirujano', v: (r, B) => nomMed(B, r.cirujano_id), ancho: 20 },
      { t: 'Duración (min)', v: (r) => (r.incision && r.cierre ? Math.round((new Date(r.cierre) - new Date(r.incision)) / 60000) : ''), tipo: 'numero', ancho: 9 }, { t: 'Lista OMS', v: (r) => `${Object.keys(r.checklist || {}).length}/${CHECK_OMS.reduce((s, [, i]) => s + i.length, 0)}`, ancho: 8 }, { t: 'Estado', v: (r) => `¤${r.estado}`, ancho: 11 }],
    resaltar: (r) => r.estado === 'TERMINADA' && !r.conteo_completo,
    kpis: (xs) => [['Cirugías', xs.length], ['Terminadas', xs.filter((r) => r.estado === 'TERMINADA').length, 'ec-fin'], ['Urgencias', xs.filter((r) => r.clasificacion !== 'ELECTIVA').length], ['Con complicaciones', xs.filter((r) => r.complicaciones).length, 'ec-alerta']],
    imprimir: (r, B) => `${encab('Hoja quirúrgica', B, r, ` · <b>Fecha:</b> ${fmt.fechaDia(r.fecha)} · <b>Sala:</b> ${esc(nom(B.salas, r.sala_id))}`)}
      <p><b>Procedimiento:</b> ${esc(nom(B.procedimientos, r.procedimiento_id, 'descripcion'))} · ${esc(r.clasificacion)} · Herida ${esc(r.herida || '—')}</p><p><b>Cirujano:</b> ${esc(nomMed(B, r.cirujano_id))} · <b>Ayudante:</b> ${esc(nomMed(B, r.ayudante_id))} · <b>Anestesiólogo:</b> ${esc(nomMed(B, r.anestesiologo_id))} · <b>Instrumentista:</b> ${esc(r.instrumentista || '')}</p>
      <p><b>Anestesia:</b> ${esc(r.tipo_anestesia || '')} · ASA ${esc(r.asa || '—')} · <b>Tiempos:</b> sala ${fhGt(r.ingreso_sala)}, incisión ${fhGt(r.incision)}, cierre ${fhGt(r.cierre)}, salida ${fhGt(r.salida_sala)}</p>
      <h3>Lista de verificación de la seguridad de la cirugía (OMS)</h3>${CHECK_OMS.map(([g, it]) => `<p><b>${esc(g)}</b><br>${it.map((x, i) => `${(r.checklist || {})[`${g}:${i}`] ? '☑' : '☐'} ${esc(x)}`).join('<br>')}</p>`).join('')}
      <p><b>Dx pre:</b> ${esc(r.diagnostico_pre || '')} · <b>Dx post:</b> ${esc(r.diagnostico_post || '')}</p><h3>Hallazgos</h3><p style="white-space:pre-wrap">${esc(r.hallazgos || '')}</p><h3>Protocolo operatorio</h3><p style="white-space:pre-wrap">${esc(r.protocolo || '')}</p>
      <p><b>Complicaciones:</b> ${esc(r.complicaciones || 'Ninguna')} · <b>Sangrado:</b> ${r.sangrado_ml ?? '—'} ml · <b>Conteo:</b> ${r.conteo_completo ? 'completo' : 'pendiente'} · <b>Patología:</b> ${r.muestras_patologia ? 'Sí' : 'No'}</p>${firma(nomMed(B, r.cirujano_id) || 'Cirujano')}` });

  // ===================== Consentimientos informados =====================
  window.PANTALLAS['med-consentimientos'] = (cont) => registro(cont, { titulo: 'Consentimientos informados', nombre: 'Consentimiento informado', icono: 'ti-signature', grupo: 'Documentos clínicos', tabla: 'med_consentimientos', fecha: 'fecha', fechaTipo: 'fecha', orden: 'fecha', numerado: true, dias: 60,
    ayuda: 'Consentimiento del paciente o su representante para el procedimiento, la anestesia, una transfusión o la hospitalización, con los riesgos y alternativas explicados; se imprime para firma.',
    campos: [{ k: 'paciente_id', t: 'Paciente', tipo: 'paciente', req: true }, { k: 'tipo', t: 'Tipo', tipo: 'sel', op: ['QUIRÚRGICO', 'ANESTÉSICO', 'TRANSFUSIÓN', 'PROCEDIMIENTO', 'ALTA VOLUNTARIA', 'HOSPITALIZACIÓN'], vacio: false }, { k: 'procedimiento_id', t: 'Procedimiento', tipo: 'sel', op: refProcSel, ancho: 1 },
      { k: 'medico_id', t: 'Médico que informa', tipo: 'medico' }, { k: 'riesgos', t: 'Riesgos explicados', tipo: 'area' }, { k: 'alternativas', t: 'Alternativas', tipo: 'area', filas: 2 }, { k: 'firmante', t: 'Firma (paciente o representante)', req: true }, { k: 'parentesco', t: 'Parentesco' }, { k: 'dpi_firmante', t: 'DPI del firmante' }, { k: 'testigo', t: 'Testigo' }, { k: 'fecha', t: 'Fecha', tipo: 'fecha' }, { k: 'admision_id', t: 'Admisión', tipo: 'admision' }],
    nuevo: () => ({ tipo: 'QUIRÚRGICO', fecha: hoy(), parentesco: 'EL MISMO PACIENTE', riesgos: 'Sangrado, infección, reacción a medicamentos, lesión de órganos vecinos y los propios del procedimiento, que me fueron explicados.' }),
    columnas: [{ t: 'No.', v: (r) => String(r.numero), ancho: 6 }, { t: 'Fecha', v: (r) => fmt.fechaDia(r.fecha), ancho: 10 }, { t: 'Paciente', v: (r, B) => nomPac(B, r.paciente_id), ancho: 28 }, { t: 'Tipo', v: (r) => r.tipo, ancho: 14 }, { t: 'Procedimiento', v: (r, B) => nom(B.procedimientos, r.procedimiento_id, 'descripcion'), ancho: 28 }, { t: 'Firmante', v: (r) => r.firmante || '', ancho: 22 }],
    imprimir: (r, B) => `<h2>Consentimiento informado ${esc(r.tipo.toLowerCase())} No. ${r.numero}</h2><p style="font-size:14px;line-height:1.8">Yo, <b>${esc(r.firmante)}</b>${r.dpi_firmante ? `, con DPI ${esc(r.dpi_firmante)}` : ''}, en calidad de ${esc((r.parentesco || '').toLowerCase())} de <b>${esc(nomPac(B, r.paciente_id))}</b>, declaro que el Dr(a). ${esc(nomMed(B, r.medico_id))} me explicó en forma clara el procedimiento <b>${esc(nom(B.procedimientos, r.procedimiento_id, 'descripcion') || r.procedimiento_texto || '')}</b>, sus beneficios, sus riesgos (${esc(r.riesgos || '')}) y las alternativas (${esc(r.alternativas || 'ninguna')}). Tuve oportunidad de preguntar y doy mi consentimiento libre y voluntario. Fecha: ${fmt.fechaDia(r.fecha)}.</p><table style="margin-top:60px;border:0"><tr><td style="border:0;text-align:center">______________________<br>${esc(r.firmante)}</td><td style="border:0;text-align:center">______________________<br>${esc(nomMed(B, r.medico_id) || 'Médico')}</td><td style="border:0;text-align:center">______________________<br>${esc(r.testigo || 'Testigo')}</td></tr></table>` });

  // ===================== Partos y recién nacidos =====================
  window.PANTALLAS['hos-partos'] = (cont) => registro(cont, { titulo: 'Partos y recién nacidos', nombre: 'Parto', icono: 'ti-baby-carriage', grupo: 'Hospital · Registros', tabla: 'hos_partos', fecha: 'fecha_hora', orden: 'fecha_hora', numerado: true, dias: 60,
    ayuda: 'Registro del parto o cesárea con los datos del recién nacido (sexo, peso, talla, APGAR al minuto y a los 5 minutos); la constancia de nacimiento se imprime para su inscripción en el RENAP.',
    campos: [{ k: 'madre_id', t: 'Madre', tipo: 'paciente', req: true }, { k: 'admision_id', t: 'Admisión', tipo: 'admision' }, { k: 'fecha_hora', t: 'Fecha y hora del nacimiento', tipo: 'fechahora' }, { k: 'tipo', t: 'Tipo de parto', tipo: 'sel', op: ['EUTÓCICO', 'DISTÓCICO', 'CESÁREA', 'INSTRUMENTADO'], vacio: false },
      { k: 'semanas_gestacion', t: 'Semanas de gestación', tipo: 'numero' }, { k: 'gesta', t: 'Gesta', tipo: 'numero' }, { k: 'para', t: 'Para', tipo: 'numero' }, { k: 'rn_sexo', t: 'Sexo del RN', tipo: 'sel', op: () => [['M', 'Masculino'], ['F', 'Femenino'], ['I', 'Indeterminado']] }, { k: 'rn_peso_g', t: 'Peso (g)', tipo: 'numero' }, { k: 'rn_talla_cm', t: 'Talla (cm)', tipo: 'numero' },
      { k: 'apgar_1', t: 'APGAR 1 min', tipo: 'numero' }, { k: 'apgar_5', t: 'APGAR 5 min', tipo: 'numero' }, { k: 'rn_condicion', t: 'Condición del RN', tipo: 'sel', op: ['VIVO', 'MORTINATO', 'FALLECIDO'], vacio: false }, { k: 'medico_id', t: 'Médico que atiende', tipo: 'medico' }, { k: 'complicaciones', t: 'Complicaciones', tipo: 'area', filas: 2 }, { k: 'observaciones', t: 'Observaciones', tipo: 'area', filas: 2 }],
    nuevo: () => ({ fecha_hora: new Date().toISOString(), tipo: 'EUTÓCICO', rn_condicion: 'VIVO' }),
    columnas: [{ t: 'No.', v: (r) => String(r.numero), ancho: 6 }, { t: 'Nacimiento', v: (r) => fhGt(r.fecha_hora), ancho: 15 }, { t: 'Madre', v: (r, B) => nomPac(B, r.madre_id), ancho: 28 }, { t: 'Tipo', v: (r) => r.tipo, ancho: 12 }, { t: 'SG', v: (r) => r.semanas_gestacion ?? '', tipo: 'numero', ancho: 5 }, { t: 'Sexo', v: (r) => r.rn_sexo || '', ancho: 5 }, { t: 'Peso g', v: (r) => r.rn_peso_g ?? '', tipo: 'numero', ancho: 8 }, { t: 'APGAR', v: (r) => (r.apgar_1 != null ? `${r.apgar_1}/${r.apgar_5 ?? ''}` : ''), ancho: 7 }, { t: 'RN', v: (r) => `¤${r.rn_condicion}`, ancho: 10 }],
    resaltar: (r) => (r.rn_peso_g != null && r.rn_peso_g < 2500) || (r.apgar_5 != null && r.apgar_5 < 7) || (r.semanas_gestacion != null && r.semanas_gestacion < 37),
    kpis: (xs) => [['Nacimientos', xs.length], ['Cesáreas', `${xs.length ? Math.round((xs.filter((r) => r.tipo === 'CESÁREA').length / xs.length) * 100) : 0} %`], ['Bajo peso (< 2,500 g)', xs.filter((r) => r.rn_peso_g != null && r.rn_peso_g < 2500).length, 'ec-alerta'], ['Prematuros (< 37 SG)', xs.filter((r) => r.semanas_gestacion != null && r.semanas_gestacion < 37).length]],
    imprimir: (r, B) => `<h2>Constancia de nacimiento No. ${r.numero}</h2><p style="font-size:14px;line-height:1.8">Hago constar que el ${fhGt(r.fecha_hora)} nació en este centro un niño(a) de sexo <b>${r.rn_sexo === 'F' ? 'femenino' : r.rn_sexo === 'M' ? 'masculino' : 'indeterminado'}</b>, ${esc((r.rn_condicion || '').toLowerCase())}, con peso de ${r.rn_peso_g ?? '__'} g y talla de ${r.rn_talla_cm ?? '__'} cm, APGAR ${r.apgar_1 ?? '_'}/${r.apgar_5 ?? '_'}, por parto ${esc((r.tipo || '').toLowerCase())} a las ${r.semanas_gestacion ?? '__'} semanas de gestación, hijo(a) de <b>${esc(nomPac(B, r.madre_id))}</b>${(() => { const p = B.pacientes.find((x) => x.id === r.madre_id); return p?.dpi ? `, DPI ${esc(p.dpi)}` : ''; })()}. Se extiende para su inscripción en el Registro Nacional de las Personas.</p>${firma(nomMed(B, r.medico_id) || 'Médico que atendió el parto')}` });

  // ===================== Defunciones =====================
  window.PANTALLAS['hos-defunciones'] = (cont) => registro(cont, { titulo: 'Defunciones', nombre: 'Defunción', icono: 'ti-cross', grupo: 'Hospital · Registros', tabla: 'hos_defunciones', fecha: 'fecha_hora', orden: 'fecha_hora', numerado: true, dias: 365,
    ayuda: 'Registro de cada fallecimiento con la cadena de causas (directa, intermedia y básica con su código CIE-10), si ocurrió antes o después de 48 horas del ingreso (para la mortalidad bruta y neta) y el número de certificado.',
    campos: [{ k: 'paciente_id', t: 'Paciente', tipo: 'paciente', req: true }, { k: 'admision_id', t: 'Admisión', tipo: 'admision', todas: true }, { k: 'fecha_hora', t: 'Fecha y hora', tipo: 'fechahora' }, { k: 'causa_directa', t: 'Causa directa', ancho: 1 }, { k: 'causa_intermedia', t: 'Causa intermedia', ancho: 1 },
      { k: 'causa_basica_codigo', t: 'Causa básica CIE-10' }, { k: 'causa_basica', t: 'Causa básica', req: true, ancho: 1 }, { k: 'contribuyentes', t: 'Otras condiciones contribuyentes', tipo: 'area', filas: 2 }, { k: 'menos_48h', t: 'Falleció antes de 48 horas del ingreso', tipo: 'check' }, { k: 'necropsia', t: 'Necropsia', tipo: 'check' },
      { k: 'medico_id', t: 'Médico que certifica', tipo: 'medico' }, { k: 'certificado', t: 'No. de certificado' }, { k: 'observaciones', t: 'Observaciones', tipo: 'area', filas: 2 }],
    nuevo: () => ({ fecha_hora: new Date().toISOString() }),
    despues: async (r, ctx) => { await ctx.sb.from('hos_pacientes').update({ estado: 'FALLECIDO' }).eq('id', r.paciente_id); },
    columnas: [{ t: 'No.', v: (r) => String(r.numero), ancho: 6 }, { t: 'Fecha', v: (r) => fhGt(r.fecha_hora), ancho: 15 }, { t: 'Paciente', v: (r, B) => nomPac(B, r.paciente_id), ancho: 28 }, { t: 'Causa básica', v: (r) => `${r.causa_basica_codigo || ''} ${r.causa_basica || ''}`.trim(), ancho: 34 }, { t: '< 48 h', v: (r) => (r.menos_48h ? 'Sí' : 'No'), ancho: 6 }, { t: 'Certificado', v: (r) => r.certificado || '', ancho: 12 }],
    kpis: (xs) => [['Defunciones', xs.length], ['Antes de 48 h', xs.filter((r) => r.menos_48h).length], ['Después de 48 h', xs.filter((r) => !r.menos_48h).length]] });

  // ===================== Epicrisis =====================
  window.PANTALLAS['hos-epicrisis'] = (cont) => registro(cont, { titulo: 'Epicrisis', nombre: 'Epicrisis', icono: 'ti-file-text', grupo: 'Hospital · Registros', tabla: 'hos_epicrisis', porAdmision: true, orden: 'id',
    ayuda: 'Resumen de egreso de cada hospitalización: motivo de ingreso, evolución, procedimientos realizados, diagnósticos de ingreso y egreso (CIE-10), condición al egreso, tratamiento y recomendaciones. Se imprime para el paciente y su médico.',
    campos: [{ k: 'admision_id', t: 'Admisión', tipo: 'admision', todas: true, req: true, ancho: 1 }, { k: 'motivo_ingreso', t: 'Motivo de ingreso', tipo: 'area', filas: 2 }, { k: 'diagnostico_ingreso', t: 'Diagnóstico de ingreso', ancho: 1 }, { k: 'resumen', t: 'Resumen de la evolución', tipo: 'area', filas: 5 },
      { k: 'procedimientos', t: 'Procedimientos realizados', tipo: 'area', filas: 2 }, { k: 'diagnostico_egreso', t: 'Diagnóstico de egreso', ancho: 1 }, { k: 'diagnostico_codigo', t: 'CIE-10 de egreso' }, { k: 'condicion_egreso', t: 'Condición al egreso', tipo: 'sel', op: ['MEJORADO', 'CURADO', 'IGUAL', 'EMPEORADO', 'FALLECIDO', 'TRASLADADO'] },
      { k: 'tratamiento_egreso', t: 'Tratamiento al egreso', tipo: 'area', filas: 3 }, { k: 'recomendaciones', t: 'Recomendaciones', tipo: 'area', filas: 2 }, { k: 'control', t: 'Control (cita)' }, { k: 'medico_id', t: 'Médico tratante', tipo: 'medico' }],
    alCambiar: (n, v, B) => { if (n !== 'admision_id') return null; const a = B.admisiones.find((x) => String(x.id) === v); return a ? { admision_id: a.id, diagnostico_ingreso: a.diagnostico_ingreso, medico_id: a.medico_id } : null; },
    columnas: [{ t: 'Admisión', v: (r, B) => nomAdm(B, r.admision_id), ancho: 30 }, { t: 'Dx egreso', v: (r) => `${r.diagnostico_codigo || ''} ${r.diagnostico_egreso || ''}`.trim(), ancho: 34 }, { t: 'Condición', v: (r) => r.condicion_egreso || '', ancho: 12 }, { t: 'Médico', v: (r, B) => nomMed(B, r.medico_id), ancho: 22 }],
    imprimir: (r, B) => { const a = B.admisiones.find((x) => x.id === r.admision_id) || {}; return `<h2>Epicrisis · admisión ${a.numero || ''}</h2><p><b>Paciente:</b> ${esc(nomPac(B, a.paciente_id))} · <b>Ingreso:</b> ${fhGt(a.fecha_ingreso)}</p><p><b>Motivo de ingreso:</b> ${esc(r.motivo_ingreso || '')}</p><p><b>Diagnóstico de ingreso:</b> ${esc(r.diagnostico_ingreso || '')}</p><h3>Evolución</h3><p style="white-space:pre-wrap">${esc(r.resumen || '')}</p><p><b>Procedimientos:</b> ${esc(r.procedimientos || '')}</p><p><b>Diagnóstico de egreso:</b> ${esc(`${r.diagnostico_codigo || ''} ${r.diagnostico_egreso || ''}`)} · <b>Condición:</b> ${esc(r.condicion_egreso || '')}</p><h3>Tratamiento al egreso</h3><p style="white-space:pre-wrap">${esc(r.tratamiento_egreso || '')}</p><p><b>Recomendaciones:</b> ${esc(r.recomendaciones || '')} · <b>Control:</b> ${esc(r.control || '')}</p>${firma(nomMed(B, r.medico_id) || 'Médico tratante')}`; } });

  // ===================== Cotizaciones =====================
  window.PANTALLAS['med-cotizaciones'] = (cont) => registro(cont, { titulo: 'Cotizaciones', nombre: 'Cotización', icono: 'ti-file-dollar', grupo: 'Comercial', tabla: 'med_cotizaciones', fecha: 'fecha', fechaTipo: 'fecha', orden: 'fecha', numerado: true, dias: 60,
    ayuda: 'Presupuesto al paciente de un paquete quirúrgico o procedimiento, con vigencia. Al elegir el paquete se propone su precio; el detalle se escribe en «Detalle» (una línea por concepto: descripción y valor separados por «;»).',
    campos: [{ k: 'paciente_id', t: 'Paciente', tipo: 'paciente' }, { k: 'nombre', t: 'A nombre de', req: true, ancho: 1 }, { k: 'fecha', t: 'Fecha', tipo: 'fecha' }, { k: 'vigencia_dias', t: 'Vigencia (días)', tipo: 'numero' },
      { k: 'paquete_id', t: 'Paquete quirúrgico', tipo: 'sel', op: (B) => B.paquetes.filter((p) => p.activo).map((p) => [p.id, `${p.nombre} · Q ${fmt.monto(p.precio)}`]), ancho: 1 }, { k: 'procedimiento_id', t: 'Procedimiento', tipo: 'sel', op: refProcSel, ancho: 1 }, { k: 'aseguradora_id', t: 'Aseguradora', tipo: 'sel', op: (B) => B.aseguradoras.map((a) => [a.id, a.nombre]) },
      { k: 'detalle_txt', t: 'Detalle (concepto; valor por línea)', tipo: 'area', filas: 5, mayus: false }, { k: 'total', t: 'Total Q', tipo: 'numero' }, { k: 'estado', t: 'Estado', tipo: 'sel', op: ['EMITIDA', 'ACEPTADA', 'RECHAZADA', 'VENCIDA'], vacio: false }, { k: 'observaciones', t: 'Observaciones', tipo: 'area', filas: 2 }],
    nuevo: () => ({ fecha: hoy(), vigencia_dias: 15, estado: 'EMITIDA' }),
    alAbrir: (r) => ({ ...r, detalle_txt: (r.detalle || []).map((d) => `${d.concepto}; ${d.valor}`).join('\n') }),
    alCambiar: (n, v, B, cont) => {
      if (n === 'paciente_id') { const p = pacDe(B, v); return p ? { paciente_id: p.id, nombre: `${p.nombres} ${p.apellidos}` } : null; }
      if (n === 'paquete_id') { const p = B.paquetes.find((x) => String(x.id) === v); if (!p) return null; const det = [`Paquete ${p.nombre}; ${p.precio}`, `Incluye: ${p.incluye || ''}; 0`, `Excluye: ${p.excluye || ''}; 0`].join('\n'); return { paquete_id: p.id, procedimiento_id: p.procedimiento_id, detalle_txt: det, total: num(p.precio) }; }
      if (n === 'detalle_txt') { const t = String(v).split('\n').reduce((s, l) => s + num(l.split(';')[1]), 0); return { total: r2(t) }; }
      return null;
    },
    columnas: [{ t: 'No.', v: (r) => String(r.numero), ancho: 6 }, { t: 'Fecha', v: (r) => fmt.fechaDia(r.fecha), ancho: 10 }, { t: 'A nombre de', v: (r) => r.nombre, ancho: 28 }, { t: 'Paquete / procedimiento', v: (r, B) => nom(B.paquetes, r.paquete_id) || nom(B.procedimientos, r.procedimiento_id, 'descripcion'), ancho: 30 }, { t: 'Total Q', v: (r) => r2(r.total), tipo: 'monto', ancho: 13 }, { t: 'Vence', v: (r) => fmt.fechaDia(sumarDias(r.fecha, r.vigencia_dias)), ancho: 10 }, { t: 'Estado', v: (r) => `¤${r.estado === 'EMITIDA' && sumarDias(r.fecha, r.vigencia_dias) < hoy() ? 'VENCIDA' : r.estado}`, ancho: 11 }],
    kpis: (xs) => [['Cotizaciones', xs.length], ['Monto cotizado', `Q ${fmt.monto(xs.reduce((s, r) => s + num(r.total), 0))}`], ['Aceptadas', xs.filter((r) => r.estado === 'ACEPTADA').length, 'ec-fin'], ['Conversión', xs.length ? `${Math.round((xs.filter((r) => r.estado === 'ACEPTADA').length / xs.length) * 100)} %` : '—']],
    antes: (r) => { r.detalle = String(r.detalle_txt || '').split('\n').filter((l) => l.trim()).map((l) => ({ concepto: l.split(';')[0].trim(), valor: num(l.split(';')[1]) })); delete r.detalle_txt; if (!r.total) r.total = r2(r.detalle.reduce((s, x) => s + x.valor, 0)); return null; },
    imprimir: (r, B, ls, ctx) => `<h2>Cotización No. ${r.numero}</h2><p>${esc(empresaDe(ctx))} · Fecha ${fmt.fechaDia(r.fecha)} · Válida hasta ${fmt.fechaDia(sumarDias(r.fecha, r.vigencia_dias))}</p><p><b>A nombre de:</b> ${esc(r.nombre)}${r.aseguradora_id ? ` · <b>Aseguradora:</b> ${esc(nom(B.aseguradoras, r.aseguradora_id))}` : ''}</p><table><tr><th>Concepto</th><th class="n">Valor Q</th></tr>${(r.detalle || []).map((d) => `<tr><td>${esc(d.concepto)}</td><td class="n">${d.valor ? fmt.monto(d.valor) : ''}</td></tr>`).join('')}<tr><th>Total</th><th class="n">${fmt.monto(r.total)}</th></tr></table>${r.observaciones ? `<p>${esc(r.observaciones)}</p>` : ''}<p style="font-size:11px">Precios en quetzales, IVA incluido. No incluye complicaciones ni servicios no detallados.</p>` });
  // ===================== Cartas de garantía =====================
  window.PANTALLAS['med-garantias'] = (cont) => registro(cont, { titulo: 'Cartas de garantía', nombre: 'Carta de garantía', icono: 'ti-shield-check', grupo: 'Comercial', tabla: 'med_garantias', fecha: 'fecha_solicitud', fechaTipo: 'fecha', orden: 'fecha_solicitud', numerado: true, dias: 90,
    ayuda: 'Solicitud de preautorización a la aseguradora para un procedimiento u hospitalización: monto solicitado, número de autorización, monto autorizado y vencimiento. Se da seguimiento hasta que se usa en la cuenta del paciente.',
    campos: [{ k: 'paciente_id', t: 'Paciente', tipo: 'paciente', req: true }, { k: 'aseguradora_id', t: 'Aseguradora', tipo: 'sel', op: (B) => B.aseguradoras.map((a) => [a.id, a.nombre]), req: true }, { k: 'plan_id', t: 'Plan', tipo: 'sel', op: (B) => B.planes.map((p) => [p.id, `${nom(B.aseguradoras, p.aseguradora_id)} · ${p.nombre}`]) },
      { k: 'admision_id', t: 'Admisión', tipo: 'admision' }, { k: 'procedimiento', t: 'Procedimiento', ancho: 1 }, { k: 'diagnostico', t: 'Diagnóstico', ancho: 1 }, { k: 'fecha_solicitud', t: 'Solicitada', tipo: 'fecha' }, { k: 'monto_solicitado', t: 'Monto solicitado Q', tipo: 'numero' },
      { k: 'autorizacion', t: 'No. de autorización' }, { k: 'monto_autorizado', t: 'Monto autorizado Q', tipo: 'numero' }, { k: 'vence', t: 'Vence', tipo: 'fecha' }, { k: 'estado', t: 'Estado', tipo: 'sel', op: ['SOLICITADA', 'AUTORIZADA', 'PARCIAL', 'RECHAZADA', 'VENCIDA', 'UTILIZADA'], vacio: false }, { k: 'observaciones', t: 'Observaciones', tipo: 'area', filas: 2 }],
    nuevo: () => ({ fecha_solicitud: hoy(), estado: 'SOLICITADA' }),
    alCambiar: (n, v, B) => { if (n !== 'paciente_id') return null; const p = pacDe(B, v); return p?.aseguradora_id ? { paciente_id: p.id, aseguradora_id: p.aseguradora_id } : null; },
    columnas: [{ t: 'No.', v: (r) => String(r.numero), ancho: 6 }, { t: 'Solicitada', v: (r) => fmt.fechaDia(r.fecha_solicitud), ancho: 10 }, { t: 'Paciente', v: (r, B) => nomPac(B, r.paciente_id), ancho: 26 }, { t: 'Aseguradora', v: (r, B) => nom(B.aseguradoras, r.aseguradora_id), ancho: 20 }, { t: 'Procedimiento', v: (r) => r.procedimiento || '', ancho: 24 }, { t: 'Solicitado Q', v: (r) => r2(r.monto_solicitado), tipo: 'monto', ancho: 12 }, { t: 'Autorizado Q', v: (r) => (r.monto_autorizado == null ? '' : r2(r.monto_autorizado)), tipo: 'monto', ancho: 12 }, { t: 'Estado', v: (r) => `¤${r.estado}`, ancho: 11 }],
    resaltar: (r) => r.estado === 'SOLICITADA' && sumarDias(r.fecha_solicitud, 3) < hoy(),
    kpis: (xs) => [['Solicitudes', xs.length], ['Pendientes', xs.filter((r) => r.estado === 'SOLICITADA').length, 'ec-alerta'], ['Autorizado', `Q ${fmt.monto(xs.reduce((s, r) => s + num(r.monto_autorizado), 0))}`, 'ec-fin'], ['Rechazadas', xs.filter((r) => r.estado === 'RECHAZADA').length]] });

  // ===================== Control prenatal y niño sano =====================
  window.PANTALLAS['cli-controles'] = (cont) => registro(cont, { titulo: 'Control prenatal y niño sano', nombre: 'Control', icono: 'ti-heart-handshake', grupo: 'Clínicas médicas · Registros', tabla: 'cli_controles', fecha: 'fecha', fechaTipo: 'fecha', orden: 'fecha', dias: 90,
    ayuda: 'Controles del embarazo (semanas, presión, altura uterina, frecuencia cardíaca fetal) y del niño sano (edad, peso, talla, perímetro cefálico) y de pacientes crónicos, con la fecha del próximo control.',
    campos: [{ k: 'paciente_id', t: 'Paciente', tipo: 'paciente', req: true }, { k: 'tipo', t: 'Programa', tipo: 'sel', op: ['PRENATAL', 'NIÑO SANO', 'CRÓNICO'], vacio: false }, { k: 'fecha', t: 'Fecha', tipo: 'fecha' }, { k: 'semanas_gestacion', t: 'Semanas de gestación', tipo: 'numero' }, { k: 'edad_meses', t: 'Edad (meses)', tipo: 'numero' },
      { k: 'peso_kg', t: 'Peso (kg)', tipo: 'numero' }, { k: 'talla_cm', t: 'Talla (cm)', tipo: 'numero' }, { k: 'perimetro_cefalico', t: 'Perímetro cefálico (cm)', tipo: 'numero' }, { k: 'presion', t: 'Presión arterial' }, { k: 'altura_uterina', t: 'Altura uterina (cm)', tipo: 'numero' }, { k: 'fcf', t: 'FCF (lpm)', tipo: 'numero' }, { k: 'glucosa', t: 'Glucosa', tipo: 'numero' },
      { k: 'medico_id', t: 'Médico', tipo: 'medico' }, { k: 'proximo', t: 'Próximo control', tipo: 'fecha' }, { k: 'observaciones', t: 'Observaciones', tipo: 'area', filas: 2 }],
    nuevo: () => ({ fecha: hoy(), tipo: 'PRENATAL', proximo: sumarDias(hoy(), 30) }),
    columnas: [{ t: 'Fecha', v: (r) => fmt.fechaDia(r.fecha), ancho: 10 }, { t: 'Paciente', v: (r, B) => nomPac(B, r.paciente_id), ancho: 28 }, { t: 'Programa', v: (r) => r.tipo, ancho: 11 }, { t: 'SG / meses', v: (r) => (r.tipo === 'PRENATAL' ? r.semanas_gestacion ?? '' : r.edad_meses ?? ''), tipo: 'numero', ancho: 8 }, { t: 'Peso', v: (r) => r.peso_kg ?? '', tipo: 'numero', ancho: 7 }, { t: 'Talla', v: (r) => r.talla_cm ?? '', tipo: 'numero', ancho: 7 }, { t: 'PA', v: (r) => r.presion || '', ancho: 8 }, { t: 'FCF', v: (r) => r.fcf ?? '', tipo: 'numero', ancho: 6 }, { t: 'Próximo', v: (r) => (r.proximo ? fmt.fechaDia(r.proximo) : ''), ancho: 10 }],
    resaltar: (r) => { const pa = String(r.presion || '').split('/').map(Number); return (pa[0] >= 140 || pa[1] >= 90) || (r.fcf != null && (r.fcf < 110 || r.fcf > 160)); },
    kpis: (xs) => [['Controles', xs.length], ['Prenatales', xs.filter((r) => r.tipo === 'PRENATAL').length], ['Niño sano', xs.filter((r) => r.tipo === 'NIÑO SANO').length], ['Con alerta', xs.filter((r) => { const pa = String(r.presion || '').split('/').map(Number); return pa[0] >= 140 || pa[1] >= 90; }).length, 'ec-alerta']] });

  // ===================== Vacunación =====================
  window.PANTALLAS['cli-vacunacion'] = (cont) => registro(cont, { titulo: 'Vacunación', nombre: 'Vacuna aplicada', icono: 'ti-vaccine', grupo: 'Clínicas médicas · Registros', tabla: 'cli_vacunacion', fecha: 'fecha', fechaTipo: 'fecha', orden: 'fecha', dias: 90, imprimir: false,
    ayuda: 'Vacunas aplicadas a cada paciente con lote, responsable y fecha de la siguiente dosis. El carné de vacunación se imprime desde el listado filtrado por paciente.',
    campos: [{ k: 'paciente_id', t: 'Paciente', tipo: 'paciente', req: true }, { k: 'vacuna_id', t: 'Vacuna y dosis', tipo: 'sel', op: (B) => B.vacunas.filter((v) => v.activo).map((v) => [v.id, `${v.nombre} · ${v.dosis}${v.edad_meses != null ? ` (${v.edad_meses} meses)` : ''}`]), req: true, ancho: 1 },
      { k: 'fecha', t: 'Fecha', tipo: 'fecha' }, { k: 'lote', t: 'Lote' }, { k: 'aplicada_por', t: 'Aplicada por' }, { k: 'proxima', t: 'Próxima dosis', tipo: 'fecha' }, { k: 'observaciones', t: 'Observaciones', ancho: 1 }],
    nuevo: () => ({ fecha: hoy() }),
    columnas: [{ t: 'Fecha', v: (r) => fmt.fechaDia(r.fecha), ancho: 10 }, { t: 'Paciente', v: (r, B) => nomPac(B, r.paciente_id), ancho: 28 }, { t: 'Vacuna', v: (r, B) => nom(B.vacunas, r.vacuna_id), ancho: 26 }, { t: 'Dosis', v: (r, B) => nom(B.vacunas, r.vacuna_id, 'dosis'), ancho: 12 }, { t: 'Lote', v: (r) => r.lote || '', ancho: 10 }, { t: 'Próxima', v: (r) => (r.proxima ? fmt.fechaDia(r.proxima) : ''), ancho: 10 }],
    kpis: (xs) => [['Dosis aplicadas', xs.length], ['Pacientes', new Set(xs.map((r) => r.paciente_id)).size], ['Próximas en 30 días', xs.filter((r) => r.proxima && r.proxima <= sumarDias(hoy(), 30) && r.proxima >= hoy()).length]] });
})();
