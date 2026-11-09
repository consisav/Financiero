// Reportes gerenciales (script 171): al final de los Reportes de un módulo. Por organización, localidad y usuario con
// acceso al módulo se eligen los reportes de todos los segmentos del módulo y, con casillas, sus salidas: PDF, Excel,
// voz, WhatsApp y correo. Se generan manualmente («Generar ahora») o automáticamente con su frecuencia (cada hora,
// diaria, semanal, quincenal o mensual, a la hora indicada): la sesión abierta de ese usuario los genera al llegar la
// hora y avisa para enviarlos.
// Los reportes que se generan aquí son los del motor de reportes comerciales (reportes_comerciales.js).
(function () {
  const { esc } = window.UI;
  window.PANTALLAS = window.PANTALLAS || {};

  const SALIDAS = [
    ['pdf', 'PDF', 'ti-file-type-pdf'], ['excel', 'Excel', 'ti-file-spreadsheet'], ['voz', 'Voz', 'ti-volume'],
    ['whatsapp', 'WhatsApp', 'ti-brand-whatsapp'], ['correo', 'Correo', 'ti-mail']
  ];
  const PERIODOS = [['HOY', 'Hoy'], ['AYER', 'Ayer'], ['SEMANA', 'Últimos 7 días'], ['MES', 'Mes en curso'], ['MES_ANTERIOR', 'Mes anterior'], ['ANIO', 'Año a la fecha']];
  const FRECUENCIAS = [['CADA_HORA', 'Cada hora'], ['DIARIA', 'Diaria'], ['SEMANAL', 'Semanal'], ['QUINCENAL', 'Quincenal (días 1 y 16)'], ['MENSUAL', 'Mensual']];
  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const GT = 6 * 3600e3; // Guatemala: UTC-6, sin horario de verano.

  const motor = () => window.REPORTES_COMERCIALES_MOTOR;
  const generable = (id) => !!(window.REPORTES_COMERCIALES && window.REPORTES_COMERCIALES[id] && motor());
  const fmt = () => window.BANCOS.fmt;

  // Reportes de todos los segmentos (subgrupos) del grupo Reportes del módulo, con el segmento al que pertenecen.
  function reportesDe(m) {
    const out = [];
    const recorrer = (ps, seg) => ps.forEach((p) => (p.pantallas ? recorrer(p.pantallas, `${seg} · ${p.subgrupo}`) : p.id !== 'reportes-gerenciales' && out.push({ ...p, segmento: seg })));
    ((m.subgrupos || {}).reportes || []).forEach((s) => recorrer(s.pantallas, s.subgrupo));
    return out;
  }

  // Fechas del período relativo al día de generación (aaaa-mm-dd, hora de Guatemala).
  function periodo(clave, hoy) {
    const d = (s, n) => { const x = new Date(`${s}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    const ini = `${hoy.slice(0, 7)}-01`;
    switch (clave) {
      case 'HOY': return { desde: hoy, fecha: hoy };
      case 'AYER': return { desde: d(hoy, -1), fecha: d(hoy, -1) };
      case 'SEMANA': return { desde: d(hoy, -6), fecha: hoy };
      case 'MES_ANTERIOR': { const fin = d(ini, -1); return { desde: `${fin.slice(0, 7)}-01`, fecha: fin }; }
      case 'ANIO': return { desde: `${hoy.slice(0, 4)}-01-01`, fecha: hoy };
      default: return { desde: ini, fecha: hoy };
    }
  }

  // Próxima generación después de «desde» según la frecuencia (en hora de Guatemala).
  function proxima(c, desde = new Date()) {
    const [hh, mm] = String(c.hora || '07:00').split(':').map(Number);
    const ahora = desde.getTime();
    const local = new Date(ahora - GT); // sus campos UTC son la hora de Guatemala
    if (c.frecuencia === 'CADA_HORA') {
      const x = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), local.getUTCHours(), mm) + GT;
      return new Date(x > ahora ? x : x + 3600e3);
    }
    for (let i = 0; i < 400; i++) {
      const dia = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + i, hh, mm));
      const ultimo = new Date(Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth() + 1, 0)).getUTCDate();
      const ok = c.frecuencia === 'DIARIA' ? true
        : c.frecuencia === 'SEMANAL' ? ((dia.getUTCDay() + 6) % 7) + 1 === Number(c.dia_semana || 1)
          : c.frecuencia === 'QUINCENAL' ? [1, 16].includes(dia.getUTCDate())
            : dia.getUTCDate() === Math.min(Number(c.dia_mes || 1), ultimo);
      if (ok && dia.getTime() + GT > ahora) return new Date(dia.getTime() + GT);
    }
    return null;
  }
  const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-GT', { timeZone: 'America/Guatemala', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—');
  const lista = (t) => String(t || '').split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
  const telefono = (t) => { const n = String(t).replace(/\D/g, ''); return n.length === 8 ? `502${n}` : n; };

  // ---------- Generación ----------
  // conf: fila de reportes_gerenciales. Devuelve { resultados, texto } y deja listas las salidas pedidas.
  async function generar(conf, m, { automatico = false } = {}) {
    const sb = window.FIN.sb;
    const desde = sb.__fromOriginal || sb.from.bind(sb);
    const F = fmt();
    const elegidos = reportesDe(m).filter((r) => generable(r.id) && SALIDAS.some(([k]) => conf.reportes?.[r.id]?.[k]));
    if (!elegidos.length) { window.FIN.aviso('Marca al menos una salida de un reporte'); return null; }
    window.FIN.aviso(`Generando ${elegidos.length} reporte(s)…`);
    const [mo, lo, og] = await Promise.all([
      sb.from('monedas').select('id, iso'),
      desde('localidades').select('id, codigo, nombre_comercial').eq('id', conf.localidad_id).maybeSingle(),
      desde('organizaciones').select('id, codigo, nombre').eq('id', conf.organizacion_id).maybeSingle()
    ]);
    const monedas = mo.data || [];
    const empTxt = lo.data ? `${lo.data.codigo} · ${lo.data.nombre_comercial}` : '';
    const par = conf.parametros || {};
    const per = periodo(par.periodo || 'MES', F.hoy());
    let productos = [];
    if (elegidos.some((r) => window.REPORTES_COMERCIALES[r.id].tipo === 'GRAFICA')) {
      productos = await motor().leerTodo(() => sb.from('productos').select('id, codigo, codigo_producto, nombre').eq('localidad_id', conf.localidad_id).order('id')).catch(() => []);
    }
    const resultados = [];
    for (const r of elegidos) {
      const f = { ...per, producto: '', contenido: par.contenido || 'RESUMIDO' };
      const M = motor().motor(r.id, { sb, f, productos: () => productos, loc: () => conf.localidad_id, org: () => conf.organizacion_id, moneda: (id) => monedas.find((x) => x.id === id), empresa: () => empTxt });
      try { resultados.push({ r, sal: conf.reportes[r.id], cfg: M.construir(await M.leer()) }); }
      catch (e) { resultados.push({ r, sal: conf.reportes[r.id], error: window.UI.traducirError ? window.UI.traducirError(e) : e.message }); }
    }
    const ok = resultados.filter((x) => x.cfg);
    const graficas = par.graficas !== false;
    const titulo = `Reportes gerenciales · ${m.corto}`;
    const cabecera = [`Organización: ${og.data ? `${og.data.codigo} · ${og.data.nombre}` : ''}`, `Empresa: ${empTxt}`,
      `Período: ${PERIODOS.find((p) => p[0] === (par.periodo || 'MES'))[1]} (${F.fechaDia(per.desde)} al ${F.fechaDia(per.fecha)})`];

    // PDF: todos los marcados en un solo documento, un reporte por página.
    const enPdf = ok.filter((x) => x.sal.pdf);
    if (enPdf.length) {
      const cuerpo = enPdf.map((x, i) => seccionPdf(x.cfg, graficas, i > 0)).join('');
      window.BANCOS.imprimir(titulo, `<style>${ESTILO_PDF}</style><h1>${esc(titulo)}</h1><h2>${esc(cabecera.join(' · '))}</h2>${cuerpo}`,
        { orgId: conf.organizacion_id, locId: conf.localidad_id, horizontal: enPdf.some((x) => x.cfg.columnas.length > 7) });
    }
    // Excel: un libro por reporte.
    for (const x of ok.filter((y) => y.sal.excel)) {
      const gs = graficas ? (x.cfg.graficas || []).filter(Boolean) : [];
      const imagenes = await Promise.all(gs.map((g) => window.GRAFICAS.png(g))).catch(() => []);
      await window.REPORTE_XLSX.generar({ ...x.cfg, imagenes });
    }
    // Voz: lectura del resumen (indicadores) de cada reporte.
    const enVoz = ok.filter((x) => x.sal.voz);
    if (enVoz.length) hablar([`${titulo}. ${empTxt}. ${cabecera[2]}.`, ...enVoz.map((x) => textoVoz(x.cfg))].join(' '));
    const texto = (sel) => [`*${titulo}*`, ...cabecera, '', ...ok.filter((x) => x.sal[sel]).map((x) => textoResumen(x.cfg))].join('\n');
    const salida = {
      resultados,
      whatsapp: ok.some((x) => x.sal.whatsapp) ? { numeros: String(conf.whatsapp || '').split(/[,;]+/).map(telefono).filter((n) => n.length >= 8), texto: texto('whatsapp') } : null,
      correo: ok.some((x) => x.sal.correo) ? { para: lista(conf.correos), asunto: `${titulo} · ${empTxt} · ${F.fechaDia(per.fecha)}`, texto: texto('correo').replace(/\*/g, '') } : null
    };
    avisoEnvio(salida, automatico ? `Se generaron automáticamente los reportes gerenciales de ${m.corto}` : 'Reportes generados');
    return salida;
  }

  const ESTILO_PDF = 'table.cx td,table.cx th{font-size:10.5px;padding:3px 5px}tr.g td{background:#dfe7f2;color:#1f3a5f;font-weight:bold}tr.s td{font-weight:bold;background:#f1f4f9}tr.t td{font-weight:bold;background:#eaf0f7;border-top:2px solid #1f3a5f}'
    + '.rgp{break-before:page}.rgp-par{font-size:11px;color:#444;margin:0 0 6px}.rgp-k{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}.rgp-k span{border:1px solid #bbb;padding:3px 8px;font-size:10.5px}.rgp-k b{color:#1f3a5f}'
    + '.graf svg{display:block;width:100%;height:auto;break-inside:avoid;margin-top:12px}';
  function seccionPdf(c, graficas, salto) {
    const F = fmt();
    const celda = (v, col) => {
      if (v === '' || v == null) return '<td></td>';
      if (typeof v === 'number') return `<td class="n">${col.tipo === 'monto' ? F.monto(v) : col.tipo === 'porcentaje' ? `${(v * 100).toFixed(1)} %` : v.toLocaleString('es-GT', { maximumFractionDigits: 4 })}</td>`;
      return `<td>${esc(String(v))}</td>`;
    };
    const n = c.columnas.length;
    const filas = c.filas.map((f) => (f.tipo === 'grupo' ? `<tr class="g"><td colspan="${n}">${esc(String(f.valores[0] ?? ''))}</td></tr>`
      : `<tr class="${f.tipo === 'subtotal' ? 's' : f.tipo === 'total' ? 't' : ''}">${c.columnas.map((col, i) => celda(f.valores[i], col)).join('')}</tr>`)).join('');
    const gs = graficas && c.n ? (c.graficas || []).filter(Boolean).join('') : '';
    return `<section class="${salto ? 'rgp' : ''}"><h3>${esc(c.titulo)}</h3><p class="rgp-par">${esc(c.parametros.join(' · '))}</p>
      <div class="rgp-k">${(c.kpis || []).map(([t, v]) => `<span>${esc(t)}: <b>${esc(String(v))}</b></span>`).join('')}</div>
      ${c.n ? `<table class="cx"><thead><tr>${c.columnas.map((x) => `<th class="${x.tipo === 'texto' ? '' : 'n'}">${esc(x.titulo)}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table>` : '<p>Sin información en el período.</p>'}
      ${gs ? `<div class="graf">${gs}</div>` : ''}</section>`;
  }
  const textoResumen = (c) => [`*${c.titulo}*`, ...(c.kpis || []).map(([t, v]) => `• ${t}: ${v}`)].join('\n');
  const textoVoz = (c) => `${c.titulo}. ${(c.kpis || []).map(([t, v]) => `${t}: ${String(v).replace(/^Q\s*/, '').replace(/,/g, '')}${/^Q/.test(String(v)) ? ' quetzales' : ''}`).join('. ')}.`;
  function hablar(texto) {
    if (!('speechSynthesis' in window)) return window.FIN.aviso('Este navegador no tiene lectura en voz');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-GT';
    const voz = speechSynthesis.getVoices().find((v) => /^es/i.test(v.lang));
    if (voz) u.voice = voz;
    speechSynthesis.speak(u);
  }

  // Aviso con los envíos: WhatsApp y correo se abren con un clic (el navegador no deja abrirlos solos).
  function avisoEnvio(s, titulo) {
    document.querySelectorAll('.rg-aviso').forEach((x) => x.remove());
    const errores = s.resultados.filter((x) => x.error);
    const caja = document.createElement('div');
    caja.className = 'rg-aviso';
    caja.setAttribute('role', 'status');
    caja.innerHTML = `<div class="rg-aviso-cab"><i class="ti ti-report-analytics" aria-hidden="true"></i><b>${esc(titulo)}</b><button type="button" class="rg-cerrar" aria-label="Cerrar"><i class="ti ti-x" aria-hidden="true"></i></button></div>
      <ul>${s.resultados.map((x) => `<li class="${x.error ? 'mal' : ''}"><i class="ti ${x.error ? 'ti-alert-triangle' : 'ti-circle-check'}" aria-hidden="true"></i> ${esc(x.r.nombre)}${x.error ? ` · ${esc(x.error)}` : ` · ${SALIDAS.filter(([k]) => x.sal[k]).map(([, t]) => t).join(', ')}`}</li>`).join('')}</ul>
      ${s.whatsapp ? (s.whatsapp.numeros.length ? s.whatsapp.numeros.map((n) => `<a class="boton rg-wa" target="_blank" rel="noopener" href="https://wa.me/${n}?text=${encodeURIComponent(s.whatsapp.texto)}"><i class="ti ti-brand-whatsapp" aria-hidden="true"></i> Enviar a WhatsApp ${esc(n)}</a>`).join('') : '<p class="rg-falta">Falta el número de WhatsApp.</p>') : ''}
      ${s.correo ? (s.correo.para.length ? `<a class="boton rg-mail" href="mailto:${s.correo.para.map(encodeURIComponent).join(',')}?subject=${encodeURIComponent(s.correo.asunto)}&body=${encodeURIComponent(s.correo.texto.slice(0, 1800))}"><i class="ti ti-mail" aria-hidden="true"></i> Enviar por correo (${s.correo.para.length})</a>` : '<p class="rg-falta">Falta el correo de destino.</p>') : ''}
      ${s.whatsapp || s.correo ? '<small>El mensaje lleva el resumen de cada reporte; el PDF o el Excel se adjuntan desde la carpeta de descargas.</small>' : ''}
      ${errores.length ? '' : ''}`;
    caja.addEventListener('click', (e) => { if (e.target.closest('.rg-cerrar')) caja.remove(); });
    document.body.appendChild(caja);
  }

  // ---------- Pantalla ----------
  window.PANTALLAS['reportes-gerenciales'] = function (cont, m) {
    const ctx = window.BANCOS.montar(cont, { titulo: 'Reportes gerenciales', icono: 'ti-report-analytics', clase: 'bk-movimientos bm-solo rg-pantalla', grupo: `${m.corto} · Reportes` });
    const { sb } = ctx;
    const yo = window.FIN.perfil();
    const reps = reportesDe(m);
    const est = { usuarios: [], usuario: null, conf: null, cambios: false };

    const nuevaConf = () => ({
      organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, modulo: m.id, perfil_id: est.usuario,
      reportes: Object.fromEntries(reps.filter((r) => generable(r.id)).map((r) => [r.id, { pdf: true, excel: false, voz: false, whatsapp: false, correo: false }])),
      parametros: { periodo: 'MES', contenido: 'RESUMIDO', graficas: true },
      whatsapp: '', correos: est.usuarios.find((u) => u.id === est.usuario)?.correo || '', modo: 'MANUAL', frecuencia: 'DIARIA', hora: '07:00', dia_semana: 1, dia_mes: 1, activo: true
    });

    // Usuarios con acceso al módulo en la localidad: por su rol en esa empresa (o su empresa principal) o Super Administrador.
    async function cargarUsuarios() {
      const desde = sb.__fromOriginal || sb.from.bind(sb);
      const mod = [m.id, m.hereda].filter(Boolean);
      const [p, pe, rm] = await Promise.all([
        desde('perfiles').select('id, nombre, usuario, correo, rol_id, organizacion_id, localidad_id, activo, es_global').eq('activo', true).order('nombre'),
        desde('perfil_empresas').select('perfil_id, localidad_id, rol_id, activo').eq('localidad_id', ctx.sel.loc).eq('activo', true),
        desde('rol_modulos').select('rol_id, modulo, puede_ver').in('modulo', mod)
      ]);
      const ven = new Set((rm.data || []).filter((x) => x.puede_ver).map((x) => x.rol_id));
      const rolEn = new Map((pe.data || []).map((x) => [x.perfil_id, x.rol_id]));
      est.usuarios = (p.data || []).filter((u) => (u.rol_id === 'superadministrador' && (u.es_global || u.organizacion_id === ctx.sel.org))
        || (rolEn.has(u.id) && ven.has(rolEn.get(u.id))) || (u.localidad_id === ctx.sel.loc && ven.has(u.rol_id)));
      if (!est.usuarios.some((u) => u.id === yo.id) && yo.localidad_id === ctx.sel.loc) est.usuarios.unshift(yo);
      if (!est.usuarios.some((u) => u.id === est.usuario)) est.usuario = (est.usuarios.find((u) => u.id === yo.id) || est.usuarios[0])?.id || null;
    }
    async function cargarConf() {
      est.cambios = false;
      if (!est.usuario || !ctx.sel.loc) { est.conf = null; return; }
      const { data, error } = await sb.from('reportes_gerenciales').select('*').eq('localidad_id', ctx.sel.loc).eq('modulo', m.id).eq('perfil_id', est.usuario).maybeSingle();
      if (error) { ctx.pDet.innerHTML = ctx.vacio(/reportes_gerenciales/.test(error.message) ? 'Falta ejecutar el script 171 (Reportes gerenciales) en Supabase.' : esc(error.message), 'ti-report-analytics'); est.conf = undefined; return; }
      const base = nuevaConf();
      est.conf = data ? { ...base, ...data, hora: String(data.hora).slice(0, 5), reportes: { ...base.reportes, ...data.reportes }, parametros: { ...base.parametros, ...data.parametros } } : base;
    }

    function pintarFiltros() {
      const orgs = ctx.organizaciones, locs = ctx.localidades.filter((x) => x.organizacion_id === ctx.sel.org);
      ctx.pFil.innerHTML = `
        <div class="ta-titulo"><span class="tk-icono"><i class="ti ti-report-analytics" aria-hidden="true"></i></span><div><small>${esc(ctx.grupo)}</small><h2>Reportes gerenciales</h2></div></div>
        <label class="campo"><span>Organización</span><select name="org">${orgs.map((o) => `<option value="${o.id}" ${o.id === ctx.sel.org ? 'selected' : ''}>${esc(String(o.codigo))} · ${esc(o.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Localidad</span><select name="loc">${locs.map((l) => `<option value="${l.id}" ${l.id === ctx.sel.loc ? 'selected' : ''}>${esc(l.codigo)} · ${esc(l.nombre_comercial)}</option>`).join('') || '<option value="">Sin localidades</option>'}</select></label>
        <label class="campo rg-usuario"><span>Usuario que los genera</span><select name="usuario">${est.usuarios.map((u) => `<option value="${u.id}" ${u.id === est.usuario ? 'selected' : ''}>${esc(u.nombre || u.usuario || u.correo)}${u.usuario ? ` · ${esc(u.usuario)}` : ''}</option>`).join('') || '<option value="">Sin usuarios con acceso</option>'}</select></label>
        <div class="oc-extra">
          <button type="button" class="boton secundario-sm" data-accion="guardar" ${est.conf ? '' : 'disabled'}><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button>
          <button type="button" class="boton primario-sm" data-accion="generar" ${est.conf ? '' : 'disabled'}><i class="ti ti-player-play" aria-hidden="true"></i> Generar ahora</button>
        </div>`;
    }

    function pintar() {
      pintarFiltros();
      const c = est.conf;
      if (!c) { if (c === null) ctx.pDet.innerHTML = ctx.vacio(est.usuarios.length ? 'Elige el usuario.' : 'Esta localidad no tiene usuarios con acceso al módulo.', 'ti-report-analytics'); return; }
      const par = c.parametros;
      const marcado = (id, k) => !!c.reportes[id]?.[k];
      const gen = reps.filter((r) => generable(r.id));
      const col = (k) => gen.length && gen.every((r) => marcado(r.id, k));
      const fila = (r) => gen.length && SALIDAS.every(([k]) => marcado(r.id, k));
      const per = periodo(par.periodo, fmt().hoy());
      const prox = c.modo === 'AUTOMATICO' ? proxima(c) : null;
      ctx.pDet.innerHTML = `
        <div class="rg">
          <section class="rg-card rg-reportes">
            <h3 class="ta-col-titulo"><i class="ti ti-list-check" aria-hidden="true"></i> Reportes del módulo <small>${gen.length} de ${reps.length}</small></h3>
            <div class="rg-tabla"><table>
              <thead><tr><th>Reporte</th>${SALIDAS.map(([k, t, ic]) => `<th class="rg-c"><label title="Marcar ${t} en todos"><i class="ti ${ic}" aria-hidden="true"></i><span>${t}</span><input type="checkbox" data-col="${k}" ${col(k) ? 'checked' : ''}></label></th>`).join('')}<th class="rg-c"><label title="Todas las salidas de todos"><i class="ti ti-checks" aria-hidden="true"></i><span>Todo</span><input type="checkbox" data-todo ${gen.length && gen.every((r) => fila(r)) ? 'checked' : ''}></label></th></tr></thead>
              <tbody>${reps.map((r) => generable(r.id) ? `<tr>
                <td><span class="rg-rep"><i class="ti ${r.icono}" aria-hidden="true"></i><span><b>${esc(r.nombre)}</b><small>${esc(r.segmento)}</small></span></span></td>
                ${SALIDAS.map(([k, t]) => `<td class="rg-c"><input type="checkbox" data-rep="${r.id}" data-sal="${k}" aria-label="${esc(r.nombre)} · ${t}" ${marcado(r.id, k) ? 'checked' : ''}></td>`).join('')}
                <td class="rg-c"><input type="checkbox" data-fila="${r.id}" aria-label="${esc(r.nombre)} · todas" ${fila(r) ? 'checked' : ''}></td></tr>`
                : `<tr class="rg-no"><td><span class="rg-rep"><i class="ti ${r.icono}" aria-hidden="true"></i><span><b>${esc(r.nombre)}</b><small>${esc(r.segmento)} · se genera desde su pantalla</small></span></span></td><td colspan="${SALIDAS.length + 1}"></td></tr>`).join('')}</tbody>
            </table></div>
            <div class="rg-param">
              <label class="campo"><span>Período</span><select data-par="periodo">${PERIODOS.map(([k, t]) => `<option value="${k}" ${par.periodo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
              <label class="campo"><span>Contenido</span><select data-par="contenido">${[['RESUMIDO', 'Resumido'], ['DETALLADO', 'Detallado']].map(([k, t]) => `<option value="${k}" ${par.contenido === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
              <label class="pc-check"><input type="checkbox" data-par="graficas" ${par.graficas !== false ? 'checked' : ''}> Con gráficas</label>
              <span class="rg-nota">Hoy sería del ${fmt().fechaDia(per.desde)} al ${fmt().fechaDia(per.fecha)}; Cuentas por cobrar, el saldo al ${fmt().fechaDia(per.fecha)}.</span>
            </div>
          </section>
          <div class="rg-lado">
            <section class="rg-card">
              <h3 class="ta-col-titulo"><i class="ti ti-send" aria-hidden="true"></i> Destinos</h3>
              <label class="campo"><span><i class="ti ti-brand-whatsapp" aria-hidden="true"></i> WhatsApp (números separados por coma)</span><input data-campo="whatsapp" value="${esc(c.whatsapp || '')}" placeholder="5555 1234, 502 4444 5678" inputmode="tel"></label>
              <label class="campo"><span><i class="ti ti-mail" aria-hidden="true"></i> Correos (separados por coma)</span><input data-campo="correos" value="${esc(c.correos || '')}" placeholder="gerencia@empresa.com"></label>
            </section>
            <section class="rg-card">
              <h3 class="ta-col-titulo"><i class="ti ti-clock-play" aria-hidden="true"></i> Generación</h3>
              <div class="rg-modo">
                <label class="${c.modo === 'MANUAL' ? 'si' : ''}"><input type="radio" name="rg-modo" value="MANUAL" ${c.modo === 'MANUAL' ? 'checked' : ''}><i class="ti ti-hand-click" aria-hidden="true"></i><span><b>Manual</b><small>Con «Generar ahora»</small></span></label>
                <label class="${c.modo === 'AUTOMATICO' ? 'si' : ''}"><input type="radio" name="rg-modo" value="AUTOMATICO" ${c.modo === 'AUTOMATICO' ? 'checked' : ''}><i class="ti ti-repeat" aria-hidden="true"></i><span><b>Automática</b><small>Con la frecuencia indicada</small></span></label>
              </div>
              <div class="rg-frec ${c.modo === 'AUTOMATICO' ? '' : 'apagado'}">
                <label class="campo"><span>Frecuencia</span><select data-campo="frecuencia" ${c.modo === 'AUTOMATICO' ? '' : 'disabled'}>${FRECUENCIAS.map(([k, t]) => `<option value="${k}" ${c.frecuencia === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
                <label class="campo"><span>${c.frecuencia === 'CADA_HORA' ? 'Minuto (de cada hora)' : 'Hora'}</span><input type="time" data-campo="hora" value="${esc(c.hora)}" ${c.modo === 'AUTOMATICO' ? '' : 'disabled'}></label>
                ${c.frecuencia === 'SEMANAL' ? `<label class="campo"><span>Día</span><select data-campo="dia_semana" ${c.modo === 'AUTOMATICO' ? '' : 'disabled'}>${DIAS.map((d, i) => `<option value="${i + 1}" ${Number(c.dia_semana) === i + 1 ? 'selected' : ''}>${d}</option>`).join('')}</select></label>` : ''}
                ${c.frecuencia === 'MENSUAL' ? `<label class="campo"><span>Día del mes</span><input type="number" min="1" max="31" data-campo="dia_mes" value="${esc(String(c.dia_mes))}" ${c.modo === 'AUTOMATICO' ? '' : 'disabled'}></label>` : ''}
              </div>
              <dl class="rg-cuando">
                <div><dt>Próxima</dt><dd>${c.modo === 'AUTOMATICO' ? esc(fechaHora(prox)) : 'Manual'}</dd></div>
                <div><dt>Última</dt><dd>${esc(fechaHora(c.ultima_ejecucion))}</dd></div>
              </dl>
              <p class="rg-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> En automático los genera la sesión abierta de este usuario al llegar la hora (o al entrar, si ya pasó) y avisa para enviarlos por WhatsApp o correo.</p>
            </section>
          </div>
        </div>`;
      ctx.pDet.querySelector('[data-todo]').indeterminate = false;
      SALIDAS.forEach(([k]) => { const x = ctx.pDet.querySelector(`[data-col="${k}"]`); x.indeterminate = !col(k) && gen.some((r) => marcado(r.id, k)); });
    }

    async function cargarTodo() {
      await cargarUsuarios();
      await cargarConf();
      if (est.conf !== undefined) pintar(); else pintarFiltros();
    }

    function datosGuardar() {
      const c = est.conf;
      return {
        organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, modulo: m.id, perfil_id: est.usuario, reportes: c.reportes, parametros: c.parametros,
        whatsapp: c.whatsapp || null, correos: c.correos || null, modo: c.modo, frecuencia: c.frecuencia, hora: c.hora || '07:00',
        dia_semana: Number(c.dia_semana) || 1, dia_mes: Math.min(31, Math.max(1, Number(c.dia_mes) || 1)), activo: true,
        proxima_ejecucion: c.modo === 'AUTOMATICO' ? proxima(c)?.toISOString() || null : null,
        modificado_en: new Date().toISOString(), modificado_por: yo.nombre || yo.usuario || null
      };
    }
    async function guardar() {
      const d = datosGuardar();
      const r = est.conf.id ? await sb.from('reportes_gerenciales').update(d).eq('id', est.conf.id).select().single()
        : await sb.from('reportes_gerenciales').insert(d).select().single();
      if (r.error) { window.FIN.aviso(window.UI.traducirError ? window.UI.traducirError(r.error) : r.error.message); return false; }
      est.conf = { ...est.conf, ...r.data, hora: String(r.data.hora).slice(0, 5) };
      est.cambios = false;
      window.FIN.aviso(d.modo === 'AUTOMATICO' ? `Guardado. Próxima generación: ${fechaHora(d.proxima_ejecucion)}` : 'Reportes gerenciales guardados');
      pintar();
      return true;
    }

    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarTodo();
      const t = e.target, c = est.conf;
      if (t.name === 'usuario') { est.usuario = t.value || null; await cargarConf(); return est.conf !== undefined ? pintar() : null; }
      if (!c) return;
      const sal = (id) => (c.reportes[id] = c.reportes[id] || {});
      const gen = reps.filter((r) => generable(r.id));
      if (t.dataset.rep) sal(t.dataset.rep)[t.dataset.sal] = t.checked;
      else if (t.dataset.col) gen.forEach((r) => { sal(r.id)[t.dataset.col] = t.checked; });
      else if (t.dataset.fila) SALIDAS.forEach(([k]) => { sal(t.dataset.fila)[k] = t.checked; });
      else if (t.matches('[data-todo]')) gen.forEach((r) => SALIDAS.forEach(([k]) => { sal(r.id)[k] = t.checked; }));
      else if (t.dataset.par) c.parametros[t.dataset.par] = t.type === 'checkbox' ? t.checked : t.value;
      else if (t.name === 'rg-modo') c.modo = t.value;
      else if (t.dataset.campo) c[t.dataset.campo] = t.value;
      else return;
      est.cambios = true;
      pintar();
    });
    cont.addEventListener('input', (e) => { const t = e.target; if (est.conf && (t.dataset.campo === 'whatsapp' || t.dataset.campo === 'correos')) { est.conf[t.dataset.campo] = t.value; est.cambios = true; } });
    cont.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (!a || !est.conf) return;
      if (a === 'guardar') return guardar();
      if (a === 'generar') {
        if (est.cambios && !(await guardar())) return;
        const s = await generar({ ...est.conf, ...datosGuardar() }, m);
        if (s && est.conf.id) {
          const ahora = new Date().toISOString();
          await sb.from('reportes_gerenciales').update({ ultima_ejecucion: ahora }).eq('id', est.conf.id);
          est.conf.ultima_ejecucion = ahora; pintar();
        }
      }
    });

    (async () => { if (!(await ctx.cargarBase())) return; await cargarTodo(); })();
  };

  // ---------- Generación automática ----------
  // Cada minuto, con la sesión abierta, se buscan las configuraciones automáticas vencidas del usuario; cada una se
  // toma moviendo su próxima ejecución (solo una sesión la toma) y se genera.
  let revisando = false;
  async function revisar() {
    const yo = window.FIN && window.FIN.perfil && window.FIN.perfil();
    if (revisando || !yo || !yo.activo || document.getElementById('app')?.hidden) return;
    revisando = true;
    try {
      const sb = window.FIN.sb;
      const { data, error } = await sb.from('reportes_gerenciales').select('*').eq('perfil_id', yo.id).eq('modo', 'AUTOMATICO').eq('activo', true).lte('proxima_ejecucion', new Date().toISOString());
      if (error || !data) return;
      for (const c of data) {
        const m = (window.MODULOS || []).find((x) => x.id === c.modulo);
        if (!m) continue;
        const sig = proxima({ ...c, hora: String(c.hora).slice(0, 5) });
        const t = await sb.from('reportes_gerenciales').update({ ultima_ejecucion: new Date().toISOString(), proxima_ejecucion: sig ? sig.toISOString() : null })
          .eq('id', c.id).eq('proxima_ejecucion', c.proxima_ejecucion).select('id');
        if (t.error || !t.data?.length) continue;
        await generar(c, m, { automatico: true });
      }
    } catch (e) { /* se reintenta en la siguiente revisión */ } finally { revisando = false; }
  }
  setTimeout(() => { revisar(); setInterval(revisar, 60e3); }, 10e3);

  window.REPORTES_GERENCIALES = { proxima, periodo, reportesDe };
})();
