// Reportes gerenciales (scripts 171 y 172): al final de los Reportes de un módulo. Por organización y localidad se marcan
// los usuarios del sistema a los que se aplica la generación, los reportes de todos los segmentos del módulo con su
// prioridad (1 … n, el orden de la lista y de la generación) y, con casillas, sus salidas: PDF, Excel, voz, WhatsApp y
// correo. Se generan manualmente («Generar ahora») o automáticamente con su frecuencia (cada hora, diaria, semanal,
// quincenal o mensual, a la hora indicada): la sesión abierta de cada usuario marcado los genera al llegar la hora y
// avisa para enviarlos. Al generar se piden los parámetros de cada reporte (van en su encabezado); el asistente por
// voz pregunta en voz alta qué reporte generar y con qué parámetros.
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
  // Reportes de otros segmentos que también entran en los Reportes gerenciales de cada módulo.
  const EXTRA = {
    facturacion: [
      { id: 'cxc-estado', nombre: 'Estado de cuenta por cliente', icono: 'ti-file-invoice', segmento: 'Cuentas x Cobrar' },
      { id: 'cxp-estado', nombre: 'Estado de cuenta por proveedor', icono: 'ti-file-invoice', segmento: 'Compras · Cuentas x Pagar' },
      { id: 'existencias-inventario', nombre: 'Existencia de productos', icono: 'ti-packages', segmento: 'Inventarios · Reportes' },
      { id: 'disponibilidad-bancaria', nombre: 'Disponibilidad bancaria', icono: 'ti-chart-line', segmento: 'Caja y Bancos · Bancos' }
    ]
  };
  const ESTADOS = new Set(['cxc-estado', 'cxp-estado']);
  const generable = (id) => (window.REPORTES_COMERCIALES && window.REPORTES_COMERCIALES[id] && !!motor())
    || (ESTADOS.has(id) && !!window.PANTALLAS[id]) || (id === 'existencias-inventario' && !!window.INVENTARIO_REPORTES)
    || (id === 'disponibilidad-bancaria' && !!window.DISPONIBILIDAD);
  const fmt = () => window.BANCOS.fmt;

  // Reportes de todos los segmentos (subgrupos) del grupo Reportes del módulo, con el segmento al que pertenecen.
  function reportesDe(m) {
    const out = [];
    const recorrer = (ps, seg) => ps.forEach((p) => (p.pantallas ? recorrer(p.pantallas, `${seg} · ${p.subgrupo}`) : p.id !== 'reportes-gerenciales' && out.push({ ...p, segmento: seg })));
    ((m.subgrupos || {}).reportes || []).forEach((s) => recorrer(s.pantallas, s.subgrupo));
    return [...out, ...(EXTRA[m.id] || [])];
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

  // Contenido de un reporte sin su pantalla: { titulo, parametros, columnas, filas, kpis, graficas, n }.
  // e: { sb, ctx (empresa del reporte), empresa(), productos() }; p: parámetros del reporte (ver PARAMS).
  async function construirCfg(id, e, p) {
    if (window.REPORTES_COMERCIALES && window.REPORTES_COMERCIALES[id]) {
      const M = motor().motor(id, { sb: e.sb, f: { desde: p.desde, fecha: p.fecha, producto: p.producto ? String(p.producto) : '', contenido: p.contenido }, productos: e.productos, loc: () => e.ctx.sel.loc, org: () => e.ctx.sel.org, moneda: e.ctx.moneda, empresa: e.empresa });
      return M.construir(await M.leer());
    }
    if (ESTADOS.has(id)) return window.PANTALLAS[id](null, null, { ctx: e.ctx, f: { desde: p.desde, hasta: p.fecha, contenido: p.contenido, mostrar: p.mostrar || 'CON SALDO', terceroKey: p.tercero || '', tercero: '' } }).cfg();
    if (id === 'existencias-inventario') return window.INVENTARIO_REPORTES.directo(id, e.ctx, { fecha: p.fecha, ceros: !!p.ceros, producto: p.producto ? String(p.producto) : '' }).cfg();
    // La disponibilidad se genera (y queda en su histórico) a la fecha de corte.
    if (id === 'disponibilidad-bancaria') return window.DISPONIBILIDAD.cfg(e.sb, e.ctx.sel.loc, p.fecha, e.empresa(), p.contenido, { banco: p.banco, cuenta: p.cuenta, nivel: p.nivel });
    throw new Error('Este reporte se genera desde su pantalla');
  }

  // Parámetros que pide cada reporte antes de generarse (van en su encabezado):
  //   empresa, desde y fecha (o solo la fecha de corte), producto, cliente o proveedor, mostrar, contenido o nivel,
  //   banco y cuenta, incluir existencias en cero.
  function camposDe(id) {
    const R = window.REPORTES_COMERCIALES?.[id];
    if (R) return R.tipo === 'SALDOS' ? ['empresa', 'fecha:Saldo al', 'producto', 'contenido'] : ['empresa', 'desde', 'fecha:Fecha final', 'producto', ...(R.tipo === 'GRAFICA' ? [] : ['contenido'])];
    if (id === 'cxc-estado') return ['empresa', 'desde', 'fecha:Fecha final', 'cliente', 'mostrar', 'contenido'];
    if (id === 'cxp-estado') return ['empresa', 'desde', 'fecha:Fecha final', 'proveedor', 'mostrar', 'contenido'];
    if (id === 'existencias-inventario') return ['empresa', 'fecha:A la fecha', 'producto', 'ceros'];
    if (id === 'disponibilidad-bancaria') return ['empresa', 'fecha:Fecha de corte', 'banco', 'cuenta', 'nivel'];
    return ['empresa', 'desde', 'fecha:Fecha final'];
  }
  // Parámetros de un reporte: los guardados (sin fechas) sobre los del período general, o los que se llenaron al generar.
  function paramsDe(conf, id, per) {
    const par = conf.parametros || {};
    const g = { ...(conf.reportes?.[id]?.param || {}) };
    delete g.desde; delete g.fecha;
    return { loc: conf.localidad_id, desde: per.desde, fecha: per.fecha, contenido: par.contenido || 'RESUMIDO', producto: '', tercero: '', mostrar: 'CON SALDO', ceros: false, banco: '', cuenta: '', nivel: (par.contenido || 'RESUMIDO') === 'DETALLADO' ? 'DETALLADA' : 'RESUMIDA', ...g };
  }

  // Catálogos de una empresa para llenar los parámetros (se leen una vez por empresa).
  const catalogos = new Map();
  async function catalogo(tipo, loc) {
    const k = `${tipo}:${loc}`;
    if (catalogos.has(k)) return catalogos.get(k);
    const sb = window.FIN.sb, leer = (q) => motor().leerTodo(q).catch(() => []);
    const p = tipo === 'productos' ? leer(() => sb.from('productos').select('id, codigo, codigo_producto, nombre').eq('localidad_id', loc).order('nombre'))
      : tipo === 'clientes' ? leer(() => sb.from('clientes').select('id, codigo, nombre').eq('localidad_id', loc).order('nombre'))
        : tipo === 'proveedores' ? leer(() => sb.from('proveedores').select('id, codigo, nombre_comercial').eq('localidad_id', loc).order('nombre_comercial'))
          : tipo === 'bancos' ? Promise.all([sb.from('bancos').select('id, codigo, nombre, siglas').eq('localidad_id', loc).order('codigo'), sb.from('cuentas_bancarias').select('id, banco_id, numero, nombre').eq('localidad_id', loc).order('numero')]).then(([b, c]) => ({ bancos: b.data || [], cuentas: c.data || [] }))
            : Promise.resolve([]);
    catalogos.set(k, p);
    return p;
  }
  const etqProd = (x) => `${x.nombre} — ${x.codigo_producto || x.codigo}`;
  const etqTer = (x) => `${x.nombre || x.nombre_comercial}${x.codigo !== '' && x.codigo != null ? ` — ${x.codigo}` : ''}`;

  // Diálogo con los parámetros de cada reporte elegido, en orden de prioridad. Devuelve { id: parámetros } o null.
  function pedirParametros(conf, elegidos, locs, per) {
    return new Promise((listo) => {
      const vals = Object.fromEntries(elegidos.map((r) => [r.id, paramsDe(conf, r.id, per)]));
      const velo = document.createElement('div');
      velo.className = 'modal-velo';
      velo.innerHTML = `<form class="modal rg-modal" role="dialog" aria-modal="true" aria-labelledby="rg-par-t">
          <header class="modal-cab"><h2 id="rg-par-t"><i class="ti ti-adjustments-horizontal" aria-hidden="true"></i> Parámetros de los reportes <small>${elegidos.length} reporte(s) · en orden de prioridad</small></h2>
            <button type="button" class="icono-boton" data-cerrar aria-label="Cerrar"><i class="ti ti-x" aria-hidden="true"></i></button></header>
          <div class="rg-par-lista"></div>
          <p class="modal-error" aria-live="polite"></p>
          <footer class="modal-pie"><button type="button" class="boton secundario-sm" data-cerrar>Cancelar</button>
            <button type="submit" class="boton primario-sm"><i class="ti ti-player-play" aria-hidden="true"></i> Generar ${elegidos.length} reporte(s)</button></footer>
        </form>`;
      document.body.appendChild(velo);
      const form = velo.querySelector('form'), lista = form.querySelector('.rg-par-lista');
      const sel = (n, ops, v, rid) => `<select data-p="${n}" data-r="${rid}">${ops.map(([k, t]) => `<option value="${esc(String(k))}" ${String(v) === String(k) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;

      async function tarjeta(r, i) {
        const p = vals[r.id], loc = Number(p.loc);
        const cs = camposDe(r.id).map((c) => c.split(':'));
        const necesita = (n) => cs.some(([c]) => c === n);
        const [prods, clis, provs, bc] = await Promise.all([necesita('producto') ? catalogo('productos', loc) : [], necesita('cliente') ? catalogo('clientes', loc) : [],
          necesita('proveedor') ? catalogo('proveedores', loc) : [], necesita('banco') ? catalogo('bancos', loc) : { bancos: [], cuentas: [] }]);
        const ters = necesita('cliente') ? clis.map((x) => ({ key: `C${x.id}`, t: etqTer(x) })) : provs.map((x) => ({ key: `P${x.id}`, t: etqTer(x) }));
        const campo = ([c, etq]) => {
          if (c === 'empresa') return `<label class="campo rg-p-emp"><span>Empresa</span>${sel('loc', locs.map((l) => [l.id, `${l.codigo} · ${l.nombre_comercial}`]), p.loc, r.id)}</label>`;
          if (c === 'desde') return `<label class="campo"><span>Fecha inicial</span><input type="date" data-p="desde" data-r="${r.id}" value="${esc(p.desde)}" max="${esc(p.fecha)}"></label>`;
          if (c === 'fecha') return `<label class="campo"><span>${etq || 'Fecha'}</span><input type="date" data-p="fecha" data-r="${r.id}" value="${esc(p.fecha)}"></label>`;
          if (c === 'producto') { const x = prods.find((y) => String(y.id) === String(p.producto)); return `<label class="campo rg-p-ancho"><span>Producto</span><input data-p="producto" data-r="${r.id}" list="rg-dl-p-${r.id}" value="${esc(x ? etqProd(x) : '')}" placeholder="Todos los productos" autocomplete="off"><datalist id="rg-dl-p-${r.id}">${prods.map((y) => `<option value="${esc(etqProd(y))}"></option>`).join('')}</datalist></label>`; }
          if (c === 'cliente' || c === 'proveedor') { const x = ters.find((y) => y.key === p.tercero); return `<label class="campo rg-p-ancho"><span>${c === 'cliente' ? 'Nombre del cliente' : 'Nombre del proveedor'}</span><input data-p="tercero" data-r="${r.id}" list="rg-dl-t-${r.id}" value="${esc(x ? x.t : '')}" placeholder="${c === 'cliente' ? 'Todos los clientes' : 'Todos los proveedores'}" autocomplete="off"><datalist id="rg-dl-t-${r.id}">${ters.map((y) => `<option value="${esc(y.t)}"></option>`).join('')}</datalist></label>`; }
          if (c === 'mostrar') return `<label class="campo"><span>Mostrar</span>${sel('mostrar', [['CON SALDO', 'Con saldo'], ['CON MOVIMIENTO', 'Con movimiento o saldo'], ['VENCIDOS', 'Con saldo vencido'], ['TODOS', 'Todos']], p.mostrar, r.id)}</label>`;
          if (c === 'contenido') return `<label class="campo"><span>Contenido</span>${sel('contenido', [['RESUMIDO', 'Resumido'], ['DETALLADO', 'Detallado']], p.contenido, r.id)}</label>`;
          if (c === 'nivel') return `<label class="campo"><span>Nivel</span>${sel('nivel', [['RESUMIDA', 'Resumida'], ['DETALLADA', 'Detallada'], ['TOTAL', 'Total']], p.nivel, r.id)}</label>`;
          if (c === 'banco') return `<label class="campo"><span>Banco</span>${sel('banco', [['', 'Todos los bancos'], ...bc.bancos.map((b) => [b.id, `${b.codigo} · ${b.siglas || b.nombre}`])], p.banco, r.id)}</label>`;
          if (c === 'cuenta') return `<label class="campo"><span>Cuenta</span>${sel('cuenta', [['', 'Todas las cuentas'], ...bc.cuentas.filter((x) => !p.banco || String(x.banco_id) === String(p.banco)).map((x) => [x.id, `${x.numero} · ${x.nombre || ''}`])], p.cuenta, r.id)}</label>`;
          if (c === 'ceros') return `<label class="pc-check rg-p-chk"><input type="checkbox" data-p="ceros" data-r="${r.id}" ${p.ceros ? 'checked' : ''}> Incluir existencias en cero</label>`;
          return '';
        };
        return `<section class="rgd-card" data-tarjeta="${r.id}"><h3><span class="rg-par-n">${i + 1}</span><i class="ti ${r.icono}" aria-hidden="true"></i> ${esc(r.nombre)} <small>${esc(r.segmento)}</small></h3>
          <div class="rg-par-g">${cs.map(campo).join('')}</div></section>`;
      }
      const repintar = async (id) => {
        const i = elegidos.findIndex((r) => r.id === id);
        const vieja = lista.querySelector(`[data-tarjeta="${id}"]`);
        if (vieja) vieja.outerHTML = await tarjeta(elegidos[i], i);
      };
      (async () => { lista.innerHTML = '<p class="rg-nota">Cargando…</p>'; lista.innerHTML = (await Promise.all(elegidos.map(tarjeta))).join(''); form.querySelector('[data-p]')?.focus(); })();

      // Texto escrito en producto o tercero → su id (al salir del campo o al generar).
      async function resolver(input) {
        const id = input.dataset.r, p = vals[id], t = input.value.trim().toUpperCase(), loc = Number(p.loc);
        if (input.dataset.p === 'producto') {
          const ls = await catalogo('productos', loc);
          const x = t ? ls.find((y) => etqProd(y).toUpperCase() === t || String(y.codigo_producto || '').toUpperCase() === t || String(y.codigo) === t) : null;
          p.producto = x ? x.id : ''; return !t || !!x;
        }
        const cli = id === 'cxc-estado';
        const ls = await catalogo(cli ? 'clientes' : 'proveedores', loc);
        const x = t ? ls.find((y) => etqTer(y).toUpperCase() === t || String(y.codigo).toUpperCase() === t || String(y.nombre || y.nombre_comercial || '').toUpperCase() === t) : null;
        p.tercero = x ? `${cli ? 'C' : 'P'}${x.id}` : ''; return !t || !!x;
      }
      form.addEventListener('change', async (e) => {
        const t = e.target, id = t.dataset.r, n = t.dataset.p;
        if (!id || !n) return;
        const p = vals[id];
        if (n === 'producto' || n === 'tercero') { if (!(await resolver(t))) { form.querySelector('.modal-error').textContent = `${n === 'producto' ? 'El producto' : 'El nombre'} «${t.value}» no está en el catálogo de esa empresa.`; } else form.querySelector('.modal-error').textContent = ''; return; }
        p[n] = t.type === 'checkbox' ? t.checked : t.value;
        if (n === 'loc') { p.producto = ''; p.tercero = ''; p.banco = ''; p.cuenta = ''; return repintar(id); }
        if (n === 'banco') { p.cuenta = ''; return repintar(id); }
        if (n === 'fecha' && p.desde > p.fecha) { p.desde = p.fecha; return repintar(id); }
      });
      const fin = (v) => { velo.remove(); listo(v); };
      velo.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', () => fin(null)));
      velo.addEventListener('keydown', (e) => { if (e.key === 'Escape') fin(null); });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        for (const inp of form.querySelectorAll('[data-p=producto], [data-p=tercero]')) {
          if (!(await resolver(inp))) { form.querySelector('.modal-error').textContent = `«${inp.value}» no está en el catálogo de esa empresa.`; inp.focus(); return; }
        }
        const malo = elegidos.find((r) => camposDe(r.id).includes('desde') && vals[r.id].desde > vals[r.id].fecha);
        if (malo) { form.querySelector('.modal-error').textContent = `${malo.nombre}: la fecha inicial es posterior a la final.`; return; }
        fin(vals);
      });
    });
  }

  // ---------- Generación ----------
  // conf: fila de reportes_gerenciales; params: { id: parámetros } llenados en el diálogo (sin ellos, los guardados
  // con las fechas del período). Genera las salidas pedidas en orden de prioridad y avisa para enviarlas.
  async function generar(conf, m, { automatico = false, params = null } = {}) {
    const sb = window.FIN.sb;
    const desde = sb.__fromOriginal || sb.from.bind(sb);
    const F = fmt();
    const elegidos = ordenados(reportesDe(m), conf).filter((r) => generable(r.id) && SALIDAS.some(([k]) => conf.reportes?.[r.id]?.[k]));
    if (!elegidos.length) { window.FIN.aviso('Marca al menos una salida de un reporte'); return null; }
    const par = conf.parametros || {};
    const per = periodo(par.periodo || 'MES', F.hoy());
    const [mo, lo, og] = await Promise.all([
      sb.from('monedas').select('id, iso'),
      desde('localidades').select('id, codigo, nombre_comercial, organizacion_id').eq('organizacion_id', conf.organizacion_id).eq('activo', true).order('codigo'),
      desde('organizaciones').select('id, codigo, nombre').eq('id', conf.organizacion_id).maybeSingle()
    ]);
    const locs = lo.data || [];
    if (!params && !automatico) {
      params = await pedirParametros(conf, elegidos, locs, per);
      if (!params) return null;
    }
    const P = (id) => (params && params[id]) || paramsDe(conf, id, per);
    window.FIN.aviso(`Generando ${elegidos.length} reporte(s)…`);
    const monedas = mo.data || [];
    const locDe = (id) => locs.find((x) => x.id === Number(id));
    const empTxt = (id) => { const l = locDe(id); return l ? `${l.codigo} · ${l.nombre_comercial}` : ''; };
    const resultados = [];
    for (const r of elegidos) {
      const p = P(r.id), loc = Number(p.loc) || conf.localidad_id;
      // Contexto mínimo de pantalla que esperan los reportes (empresa del reporte, localidades y monedas).
      const ctx = { sb, sel: { org: conf.organizacion_id, loc }, localidad: (id) => locDe(id) || null, moneda: (id) => monedas.find((x) => x.id === id) };
      const prods = window.REPORTES_COMERCIALES?.[r.id] ? await catalogo('productos', loc) : [];
      try { resultados.push({ r, p, sal: conf.reportes[r.id], cfg: await construirCfg(r.id, { sb, ctx, empresa: () => empTxt(loc), productos: () => prods }, p) }); }
      catch (e) { resultados.push({ r, p, sal: conf.reportes[r.id], error: window.UI.traducirError ? window.UI.traducirError(e) : e.message }); }
    }
    const ok = resultados.filter((x) => x.cfg);
    const graficas = par.graficas !== false;
    const titulo = `Reportes gerenciales · ${m.corto}`;
    const cabecera = [`Organización: ${og.data ? `${og.data.codigo} · ${og.data.nombre}` : ''}`, `Empresa: ${empTxt(conf.localidad_id)}`, `${ok.length} reporte(s) en orden de prioridad`];

    // PDF: todos los marcados en un solo documento, un reporte por página, cada uno con sus parámetros.
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
    // Voz: lectura de los parámetros y del resumen (indicadores) de cada reporte.
    const enVoz = ok.filter((x) => x.sal.voz);
    if (enVoz.length) hablar([`${titulo}.`, ...enVoz.map((x) => textoVoz(x.cfg))].join(' '));
    const texto = (sel) => [`*${titulo}*`, cabecera[0], '', ...ok.filter((x) => x.sal[sel]).map((x) => textoResumen(x.cfg))].join('\n');
    const salida = {
      resultados, params: Object.fromEntries(resultados.map((x) => [x.r.id, x.p])),
      whatsapp: ok.some((x) => x.sal.whatsapp) ? { numeros: String(conf.whatsapp || '').split(/[,;]+/).map(telefono).filter((n) => n.length >= 8), texto: texto('whatsapp') } : null,
      correo: ok.some((x) => x.sal.correo) ? { para: lista(conf.correos), asunto: `${titulo} · ${empTxt(conf.localidad_id)} · ${F.fechaDia(F.hoy())}`, texto: texto('correo').replace(/\*/g, '') } : null
    };
    avisoEnvio(salida, automatico ? `Se generaron automáticamente los reportes gerenciales de ${m.corto}` : 'Reportes generados');
    return salida;
  }

  const ESTILO_PDF = 'table.cx td,table.cx th{font-size:10.5px;padding:3px 5px}tr.g td{background:#dfe7f2;color:#1f3a5f;font-weight:bold}tr.s td{font-weight:bold;background:#f1f4f9}tr.t td{font-weight:bold;background:#eaf0f7;border-top:2px solid #1f3a5f}'
    + 'tr.nt td{font-style:italic;color:#555;font-size:10px}.rgp{break-before:page}.rgp-par{font-size:11px;color:#444;margin:0 0 6px}.rgp-k{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}.rgp-k span{border:1px solid #bbb;padding:3px 8px;font-size:10.5px}.rgp-k b{color:#1f3a5f}'
    + '.graf svg{display:block;width:100%;height:auto;break-inside:avoid;margin-top:12px}';
  function seccionPdf(c, graficas, salto) {
    const F = fmt();
    const celda = (v, col) => {
      if (v === '' || v == null) return '<td></td>';
      if (typeof v === 'number') return `<td class="n">${col.tipo === 'monto' ? F.monto(v) : col.tipo === 'porcentaje' ? `${(v * 100).toFixed(1)} %` : v.toLocaleString('es-GT', { maximumFractionDigits: 4 })}</td>`;
      return `<td>${esc(String(v))}</td>`;
    };
    const n = c.columnas.length;
    const filas = c.filas.map((f) => (f.tipo === 'grupo' || f.combinar || f.tipo === 'nota' ? `<tr class="${f.tipo === 'grupo' ? 'g' : f.tipo === 'subtotal' ? 's' : 'nt'}"><td colspan="${n}">${esc(String(f.valores[0] ?? ''))}</td></tr>`
      : `<tr class="${f.tipo === 'subtotal' ? 's' : f.tipo === 'total' ? 't' : ''}">${c.columnas.map((col, i) => celda(f.valores[i], col)).join('')}</tr>`)).join('');
    const gs = graficas && c.n ? (c.graficas || []).filter(Boolean).join('') : '';
    return `<section class="${salto ? 'rgp' : ''}"><h3>${esc(c.titulo)}</h3><p class="rgp-par">${esc(c.parametros.join(' · '))}</p>
      <div class="rgp-k">${(c.kpis || []).map(([t, v]) => `<span>${esc(t)}: <b>${esc(String(v))}</b></span>`).join('')}</div>
      ${c.n ? `<table class="cx"><thead><tr>${c.columnas.map((x) => `<th class="${x.tipo === 'texto' ? '' : 'n'}">${esc(x.titulo)}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table>` : '<p>Sin información en el período.</p>'}
      ${gs ? `<div class="graf">${gs}</div>` : ''}</section>`;
  }
  const textoResumen = (c) => [`*${c.titulo}*`, `_${(c.parametros || []).join(' · ')}_`, ...(c.kpis || []).map(([t, v]) => `• ${t}: ${v}`)].join('\n');
  const textoVoz = (c) => `${c.titulo}. ${(c.parametros || []).slice(1, 3).join('. ')}. ${(c.kpis || []).map(([t, v]) => `${t}: ${String(v).replace(/^Q\s*/, '').replace(/,/g, '')}${/^Q/.test(String(v)) ? ' quetzales' : ''}`).join('. ')}.`;
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

  // ---------- Asistente por voz ----------
  // Pregunta en voz alta qué reporte gerencial generar y luego cada uno de sus parámetros; escucha la respuesta con el
  // reconocimiento de voz del navegador (Chrome o Edge) o la toma escrita o de los botones de sugerencia. Al final
  // confirma y genera el reporte con esos parámetros en las salidas elegidas.
  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ\s/-]/g, ' ').replace(/\s+/g, ' ').trim();
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const NUM = { uno: 1, primero: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, treintayuno: 31 };
  const dosDig = (n) => String(n).padStart(2, '0');
  // Parecido entre la respuesta y un nombre: proporción de palabras del nombre que se dijeron.
  function parecido(dicho, nombre) {
    const d = new Set(norm(dicho).split(' ')), ps = norm(nombre).split(' ').filter((x) => x.length > 2 || /\d/.test(x));
    if (!ps.length) return 0;
    return ps.filter((x) => d.has(x) || [...d].some((y) => y.length > 3 && (x.startsWith(y) || y.startsWith(x)))).length / ps.length;
  }
  function mejor(dicho, items, nombreDe, minimo = 0.5) {
    let m = null, s = 0;
    items.forEach((x) => { const v = parecido(dicho, nombreDe(x)); if (v > s) { s = v; m = x; } });
    return s >= minimo ? m : null;
  }
  // Fecha dicha: hoy, ayer, inicio o fin de mes, «5 de noviembre (de 2026)», «5/11/2026».
  function fechaDicha(t, hoy) {
    const s = norm(t).replace(/ y /g, 'y');
    const d = (base, n) => { const x = new Date(`${base}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    if (/\bhoy\b/.test(s)) return hoy;
    if (/\bayer\b/.test(s)) return d(hoy, -1);
    if (/(inicio|principio|primero) de(l)? (este )?mes/.test(s)) return `${hoy.slice(0, 7)}-01`;
    if (/(inicio|principio) de(l)? (este )?ano/.test(s)) return `${hoy.slice(0, 4)}-01-01`;
    if (/fin de(l)? mes (anterior|pasado)/.test(s)) return d(`${hoy.slice(0, 7)}-01`, -1);
    if (/(inicio|principio) de(l)? mes (anterior|pasado)/.test(s)) return `${d(`${hoy.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
    let m = s.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
    if (m) { const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : hoy.slice(0, 4); return `${y}-${dosDig(m[2])}-${dosDig(m[1])}`; }
    m = s.match(/(\d{1,2}|[a-z]+) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?: de(?:l)? (\d{4}))?/);
    if (m) {
      const dia = /^\d+$/.test(m[1]) ? Number(m[1]) : NUM[m[1]];
      const mes = m[2] === 'setiembre' ? 9 : MESES.indexOf(m[2]) + 1;
      if (dia && mes) return `${m[3] || hoy.slice(0, 4)}-${dosDig(mes)}-${dosDig(dia)}`;
    }
    return null;
  }
  const fechaVoz = (f) => { const [y, mm, dd] = f.split('-').map(Number); return `${dd} de ${MESES[mm - 1]} de ${y}`; };

  function asistenteVoz(conf, m, reps) {
    const Reco = window.SpeechRecognition || window.webkitSpeechRecognition;
    const F = fmt();
    const per = periodo(conf.parametros?.periodo || 'MES', F.hoy());
    const velo = document.createElement('div');
    velo.className = 'modal-velo';
    velo.innerHTML = `<div class="modal rgv" role="dialog" aria-modal="true" aria-labelledby="rgv-t">
        <header class="modal-cab"><h2 id="rgv-t"><i class="ti ti-microphone" aria-hidden="true"></i> Asistente por voz <small>Reportes gerenciales · ${esc(m.corto)}</small></h2>
          <button type="button" class="icono-boton" data-cerrar aria-label="Cerrar"><i class="ti ti-x" aria-hidden="true"></i></button></header>
        <div class="rgv-chat" aria-live="polite"></div>
        <div class="rgv-sug"></div>
        <form class="rgv-pie">
          <button type="button" class="rgv-mic" data-mic title="Hablar" aria-label="Hablar"><i class="ti ti-microphone" aria-hidden="true"></i></button>
          <input class="rgv-txt" placeholder="${Reco ? 'Hable o escriba su respuesta' : 'Escriba su respuesta (este navegador no reconoce la voz)'}" autocomplete="off">
          <button type="submit" class="boton primario-sm"><i class="ti ti-send" aria-hidden="true"></i> Responder</button>
        </form>
        <p class="rgv-estado"></p>
      </div>`;
    document.body.appendChild(velo);
    const chat = velo.querySelector('.rgv-chat'), sug = velo.querySelector('.rgv-sug'), txt = velo.querySelector('.rgv-txt'), estado = velo.querySelector('.rgv-estado'), mic = velo.querySelector('[data-mic]');
    let cerrado = false, responder = null, reco = null;
    const decir = (t, quien = 'yo') => { chat.insertAdjacentHTML('beforeend', `<div class="rgv-m ${quien}"><i class="ti ${quien === 'yo' ? 'ti-robot' : 'ti-user'}" aria-hidden="true"></i><p>${esc(t)}</p></div>`); chat.scrollTop = chat.scrollHeight; };
    const hablarYEsperar = (t) => new Promise((ok) => {
      if (!('speechSynthesis' in window)) return ok();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t); u.lang = 'es-GT';
      const v = speechSynthesis.getVoices().find((x) => /^es/i.test(x.lang)); if (v) u.voice = v;
      u.onend = ok; u.onerror = ok; speechSynthesis.speak(u);
      setTimeout(ok, Math.min(15000, 900 + t.length * 70));
    });
    function escuchar() {
      if (!Reco || cerrado) return;
      try { reco?.abort(); } catch { /* nada */ }
      reco = new Reco(); reco.lang = 'es-GT'; reco.interimResults = true; reco.maxAlternatives = 1;
      mic.classList.add('activo'); estado.textContent = 'Escuchando…';
      reco.onresult = (e) => { const r = e.results[e.results.length - 1]; txt.value = r[0].transcript; if (r.isFinal) { estado.textContent = ''; enviar(); } };
      reco.onerror = (e) => { estado.textContent = e.error === 'not-allowed' ? 'Permita el micrófono en el navegador o escriba la respuesta.' : e.error === 'no-speech' ? 'No le escuché: toque el micrófono para repetir o escriba.' : ''; };
      reco.onend = () => mic.classList.remove('activo');
      try { reco.start(); } catch { /* ya escuchando */ }
    }
    function enviar() { const v = txt.value.trim(); if (!v || !responder) return; txt.value = ''; decir(v, 'tu'); const r = responder; responder = null; sug.innerHTML = ''; r(v); }
    // Pregunta y espera una respuesta que «interpretar» acepte (si no, vuelve a preguntar).
    async function preguntar(texto, interpretar, sugerencias = []) {
      for (;;) {
        if (cerrado) throw new Error('cancelado');
        decir(texto);
        sug.innerHTML = sugerencias.map((s) => `<button type="button" class="rgv-chip">${esc(s)}</button>`).join('');
        const resp = new Promise((ok) => { responder = ok; });
        await hablarYEsperar(texto);
        escuchar();
        const dicho = await resp;
        if (/\b(cancelar|salir|terminar)\b/.test(norm(dicho))) throw new Error('cancelado');
        const v = await interpretar(dicho);
        if (v !== undefined) return v;
        texto = 'No le entendí. ' + texto;
      }
    }
    velo.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); enviar(); });
    sug.addEventListener('click', (e) => { const b = e.target.closest('.rgv-chip'); if (b) { txt.value = b.textContent; enviar(); } });
    mic.addEventListener('click', escuchar);
    const cerrar = () => { cerrado = true; try { reco?.abort(); } catch { /* nada */ } speechSynthesis?.cancel(); velo.remove(); if (responder) responder('cancelar'); };
    velo.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrar));
    velo.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });

    (async () => {
      const sb = window.FIN.sb, desde = sb.__fromOriginal || sb.from.bind(sb);
      const { data: locs } = await desde('localidades').select('id, codigo, nombre_comercial, organizacion_id').eq('organizacion_id', conf.organizacion_id).eq('activo', true).order('codigo');
      const lista = ordenados(reps, conf);
      const r = await preguntar('¿Qué reporte gerencial desea generar?', (t) => {
        const n = norm(t).match(/\b(?:numero|prioridad|el|la)?\s*(\d{1,2})\b/);
        if (n && lista[Number(n[1]) - 1] && norm(t).replace(/\d+/g, '').trim().split(' ').length <= 2) return lista[Number(n[1]) - 1];
        return mejor(t, lista, (x) => x.nombre, 0.6) || undefined;
      }, lista.map((x) => x.nombre));
      decir(`Muy bien: ${r.nombre}.`);
      const p = paramsDe(conf, r.id, per);
      for (const [c, etq] of camposDe(r.id).map((x) => x.split(':'))) {
        const loc = () => Number(p.loc) || conf.localidad_id;
        if (c === 'empresa') {
          p.loc = (await preguntar('¿De qué empresa?', (t) => {
            if (/\b(esta|actual|la misma)\b/.test(norm(t))) return conf.localidad_id;
            const cod = norm(t).replace(/\s+/g, '-').match(/\d+-\d+/);
            const x = (cod && locs.find((l) => l.codigo === cod[0])) || mejor(t, locs, (l) => l.nombre_comercial, 0.5);
            return x ? x.id : undefined;
          }, locs.map((l) => `${l.codigo} ${l.nombre_comercial}`))); p.producto = ''; p.tercero = ''; p.banco = ''; p.cuenta = '';
        } else if (c === 'desde') {
          p.desde = await preguntar('¿Fecha inicial?', (t) => fechaDicha(t, F.hoy()) || undefined, ['Inicio de mes', 'Inicio de año', 'Ayer', 'Hoy']);
        } else if (c === 'fecha') {
          p.fecha = await preguntar(`¿${etq || 'Fecha'}?`, (t) => { const f = fechaDicha(t, F.hoy()); return f && (!camposDe(r.id).includes('desde') || f >= p.desde) ? f : undefined; }, ['Hoy', 'Ayer', 'Fin de mes anterior']);
        } else if (c === 'producto') {
          const ls = await catalogo('productos', loc());
          p.producto = await preguntar('¿De qué producto? Diga «todos» o el nombre del producto.', (t) => (/\btodos?\b/.test(norm(t)) ? '' : (mejor(t, ls, (x) => x.nombre, 0.6)?.id ?? undefined)), ['Todos']);
        } else if (c === 'cliente' || c === 'proveedor') {
          const cli = c === 'cliente', ls = await catalogo(cli ? 'clientes' : 'proveedores', loc());
          p.tercero = await preguntar(`¿Nombre del ${c}? Diga «todos» o el nombre.`, (t) => { if (/\btodos?\b/.test(norm(t))) return ''; const x = mejor(t, ls, (y) => y.nombre || y.nombre_comercial, 0.6); return x ? `${cli ? 'C' : 'P'}${x.id}` : undefined; }, ['Todos']);
        } else if (c === 'mostrar') {
          p.mostrar = await preguntar('¿Qué desea mostrar: con saldo, con movimiento, vencidos o todos?', (t) => { const s = norm(t); return /vencid/.test(s) ? 'VENCIDOS' : /movimiento/.test(s) ? 'CON MOVIMIENTO' : /saldo/.test(s) ? 'CON SALDO' : /todos/.test(s) ? 'TODOS' : undefined; }, ['Con saldo', 'Con movimiento', 'Vencidos', 'Todos']);
        } else if (c === 'contenido') {
          p.contenido = await preguntar('¿Resumido o detallado?', (t) => (/detall/.test(norm(t)) ? 'DETALLADO' : /resum/.test(norm(t)) ? 'RESUMIDO' : undefined), ['Resumido', 'Detallado']);
        } else if (c === 'nivel') {
          p.nivel = await preguntar('¿Nivel resumido, detallado o total?', (t) => (/total/.test(norm(t)) ? 'TOTAL' : /detall/.test(norm(t)) ? 'DETALLADA' : /resum/.test(norm(t)) ? 'RESUMIDA' : undefined), ['Resumida', 'Detallada', 'Total']);
        } else if (c === 'banco') {
          const bc = await catalogo('bancos', loc());
          p.banco = await preguntar('¿De qué banco? Diga «todos» o el nombre del banco.', (t) => (/\btodos?\b/.test(norm(t)) ? '' : (mejor(t, bc.bancos, (b) => `${b.siglas || ''} ${b.nombre}`, 0.34)?.id ?? undefined)), ['Todos', ...bc.bancos.map((b) => b.siglas || b.nombre)]);
        } else if (c === 'cuenta') {
          const bc = await catalogo('bancos', loc());
          const cs = bc.cuentas.filter((x) => !p.banco || String(x.banco_id) === String(p.banco));
          p.cuenta = await preguntar('¿Qué cuenta? Diga «todas» o los últimos dígitos.', (t) => { if (/\btodas?\b/.test(norm(t))) return ''; const dig = norm(t).replace(/\D/g, ''); const x = dig.length >= 3 && cs.find((y) => String(y.numero).replace(/\D/g, '').endsWith(dig)); return x ? x.id : undefined; }, ['Todas']);
        } else if (c === 'ceros') {
          p.ceros = await preguntar('¿Incluir los productos con existencia en cero?', (t) => (/\b(si|incluir|incluya)\b/.test(norm(t)) ? true : /\bno\b/.test(norm(t)) ? false : undefined), ['Sí', 'No']);
        }
      }
      const salidasDichas = await preguntar('¿Cómo lo desea? PDF, Excel, en voz, por WhatsApp o por correo. Puede decir varias.', (t) => {
        const s = norm(t), o = { pdf: /\bpdf\b/.test(s), excel: /excel/.test(s), voz: /\bvoz\b|leer|lea|escuchar/.test(s), whatsapp: /whats|guasap|wasap/.test(s), correo: /correo|mail/.test(s) };
        return Object.values(o).some(Boolean) ? o : undefined;
      }, ['PDF', 'Excel', 'Voz', 'WhatsApp', 'Correo', 'PDF y voz']);
      const empresa = locs.find((l) => l.id === Number(p.loc));
      const resumen = `${r.nombre} de ${empresa ? empresa.nombre_comercial : 'la empresa'}, ${p.desde && camposDe(r.id).includes('desde') ? `del ${fechaVoz(p.desde)} ` : ''}al ${fechaVoz(p.fecha)}, en ${SALIDAS.filter(([k]) => salidasDichas[k]).map(([, t]) => t).join(', ')}`;
      const si = await preguntar(`¿Genero ${resumen}?`, (t) => (/\b(si|claro|dale|genera|adelante|ok)\b/.test(norm(t)) ? true : /\bno\b/.test(norm(t)) ? false : undefined), ['Sí', 'No']);
      if (!si) { decir('Está bien, no lo genero.'); await hablarYEsperar('Está bien, no lo genero.'); return cerrar(); }
      decir('Generando…');
      const confUno = { ...conf, reportes: { [r.id]: { ...(conf.reportes?.[r.id] || {}), ...salidasDichas } } };
      const s = await generar(confUno, m, { params: { [r.id]: p } });
      const ok = s?.resultados?.[0];
      const fin = !ok ? 'No se pudo generar.' : ok.error ? `No se pudo generar: ${ok.error}` : `Listo, se generó ${r.nombre}.`;
      decir(fin);
      if (!salidasDichas.voz) await hablarYEsperar(fin);
      setTimeout(() => { if (!cerrado) { velo.remove(); cerrado = true; } }, 2500);
    })().catch((e) => { if (e.message !== 'cancelado') { decir(`Ocurrió un problema: ${e.message}`); } else if (!cerrado) cerrar(); });
  }

  // ---------- Pantalla ----------
  // Prioridad de cada reporte (1 … n): la lista y la generación van en ese orden.
  function ordenados(reps, conf) {
    const pos = new Map(reps.map((r, i) => [r.id, i]));
    return [...reps].sort((a, b) => (Number(conf.reportes?.[a.id]?.prioridad) || 999) - (Number(conf.reportes?.[b.id]?.prioridad) || 999) || pos.get(a.id) - pos.get(b.id));
  }
  function renumerar(reps, conf, id, nueva) {
    const lista = ordenados(reps, conf).filter((r) => r.id !== id);
    const r = reps.find((x) => x.id === id);
    if (r) lista.splice(Math.max(0, Math.min(lista.length, nueva - 1)), 0, r);
    lista.forEach((x, i) => { conf.reportes[x.id] = { ...(conf.reportes[x.id] || {}), prioridad: i + 1 }; });
  }

  window.PANTALLAS['reportes-gerenciales'] = function (cont, m) {
    const ctx = window.BANCOS.montar(cont, { titulo: 'Reportes gerenciales', icono: 'ti-report-analytics', clase: 'bk-movimientos bm-solo rg-pantalla', grupo: `${m.corto} · Reportes` });
    const { sb } = ctx;
    const yo = window.FIN.perfil();
    const reps = reportesDe(m).filter((r) => generable(r.id));
    const est = { usuarios: [], conf: null, cambios: false };

    const nuevaConf = () => ({
      organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, modulo: m.id,
      usuarios: est.usuarios.some((u) => u.id === yo.id) ? [yo.id] : [],
      reportes: Object.fromEntries(reps.map((r, i) => [r.id, { pdf: true, excel: false, voz: false, whatsapp: false, correo: false, prioridad: i + 1 }])),
      parametros: { periodo: 'MES', contenido: 'RESUMIDO', graficas: true },
      whatsapp: '', correos: yo.correo || '', modo: 'MANUAL', frecuencia: 'DIARIA', hora: '07:00', dia_semana: 1, dia_mes: 1, activo: true, ejecuciones: {}
    });

    // Usuarios del sistema con acceso al módulo en la localidad: por su rol en esa empresa (o su empresa principal) o Super Administrador.
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
      const roles = window.FIN.roles ? window.FIN.roles() : [];
      est.usuarios.forEach((u) => { const rid = rolEn.get(u.id) || u.rol_id; u.rolNombre = u.es_global ? 'Super Administrador Global' : (roles.find((r) => r.id === rid) || {}).nombre || rid; });
    }
    async function cargarConf() {
      est.cambios = false;
      if (!ctx.sel.loc) { est.conf = null; return; }
      const { data, error } = await sb.from('reportes_gerenciales').select('*').eq('localidad_id', ctx.sel.loc).eq('modulo', m.id).maybeSingle();
      if (error) { ctx.pDet.innerHTML = ctx.vacio(/reportes_gerenciales|usuarios|ejecuciones|multiple/.test(error.message) ? 'Falta ejecutar los scripts 171 y 172 (Reportes gerenciales) en Supabase.' : esc(error.message), 'ti-report-analytics'); est.conf = undefined; return; }
      const base = nuevaConf();
      const repDe = (d) => Object.fromEntries(reps.map((r) => [r.id, { ...base.reportes[r.id], ...(d?.[r.id] || {}) }]));
      est.conf = data ? { ...base, ...data, hora: String(data.hora).slice(0, 5), reportes: repDe(data.reportes), parametros: { ...base.parametros, ...data.parametros }, usuarios: data.usuarios || [] } : base;
      // Prioridades sin repetir del 1 a n.
      ordenados(reps, est.conf).forEach((r, i) => { est.conf.reportes[r.id].prioridad = i + 1; });
    }

    function pintarFiltros() {
      const orgs = ctx.organizaciones, locs = ctx.localidades.filter((x) => x.organizacion_id === ctx.sel.org);
      ctx.pFil.innerHTML = `
        <div class="ta-titulo"><span class="tk-icono"><i class="ti ti-report-analytics" aria-hidden="true"></i></span><div><small>${esc(ctx.grupo)}</small><h2>Reportes gerenciales</h2></div></div>
        <label class="campo"><span>Organización</span><select name="org">${orgs.map((o) => `<option value="${o.id}" ${o.id === ctx.sel.org ? 'selected' : ''}>${esc(String(o.codigo))} · ${esc(o.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Localidad</span><select name="loc">${locs.map((l) => `<option value="${l.id}" ${l.id === ctx.sel.loc ? 'selected' : ''}>${esc(l.codigo)} · ${esc(l.nombre_comercial)}</option>`).join('') || '<option value="">Sin localidades</option>'}</select></label>
        <div class="oc-extra rg-acciones">
          <button type="button" class="boton secundario-sm rg-voz-b" data-accion="voz" ${est.conf ? '' : 'disabled'} title="Le pregunta en voz alta qué reporte desea y con qué parámetros"><i class="ti ti-microphone" aria-hidden="true"></i> Asistente por voz</button>
          <button type="button" class="boton secundario-sm" data-accion="guardar" ${est.conf ? '' : 'disabled'}><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button>
          <button type="button" class="boton primario-sm" data-accion="generar" ${est.conf ? '' : 'disabled'}><i class="ti ti-player-play" aria-hidden="true"></i> Generar ahora</button>
        </div>`;
    }

    function pintar() {
      pintarFiltros();
      const c = est.conf;
      if (!c) { if (c === null) ctx.pDet.innerHTML = ctx.vacio('Elige la localidad.', 'ti-report-analytics'); return; }
      const par = c.parametros;
      const marcado = (id, k) => !!c.reportes[id]?.[k];
      const col = (k) => reps.length && reps.every((r) => marcado(r.id, k));
      const fila = (r) => SALIDAS.every(([k]) => marcado(r.id, k));
      const per = periodo(par.periodo, fmt().hoy());
      const prox = c.modo === 'AUTOMATICO' ? proxima(c) : null;
      const us = new Set(c.usuarios);
      const todosU = est.usuarios.length && est.usuarios.every((u) => us.has(u.id));
      const n = reps.length;
      ctx.pDet.innerHTML = `
        <div class="rg">
          <section class="rg-card rg-usuarios">
            <h3 class="ta-col-titulo"><i class="ti ti-users" aria-hidden="true"></i> Usuarios <small>${est.usuarios.filter((u) => us.has(u.id)).length} de ${est.usuarios.length}</small></h3>
            <label class="rg-u rg-u-todos"><input type="checkbox" data-u-todos ${todosU ? 'checked' : ''}><span><b>Todos los usuarios</b><small>Aplicar la generación a todos</small></span></label>
            <div class="rg-u-lista">${est.usuarios.map((u) => `
              <label class="rg-u ${us.has(u.id) ? 'si' : ''}"><input type="checkbox" data-u="${u.id}" ${us.has(u.id) ? 'checked' : ''}>
                <span class="rg-av">${esc((u.nombre || u.usuario || '?').split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase())}</span>
                <span class="rg-u-tx"><b>${esc(u.nombre || u.usuario || u.correo)}</b><small>${esc([u.usuario, u.rolNombre].filter(Boolean).join(' · '))}</small></span>
                <em>${us.has(u.id) ? 'Aplica' : 'No aplica'}</em></label>`).join('') || '<p class="rg-nota">Esta localidad no tiene usuarios con acceso al módulo.</p>'}</div>
          </section>
          <section class="rg-card rg-reportes">
            <h3 class="ta-col-titulo"><i class="ti ti-list-check" aria-hidden="true"></i> Reportes del módulo <small>${n} · en orden de prioridad</small></h3>
            <div class="rg-tabla"><table>
              <thead><tr><th class="rg-pri">Prioridad</th><th>Reporte</th>${SALIDAS.map(([k, t, ic]) => `<th class="rg-c"><label title="Marcar ${t} en todos"><i class="ti ${ic}" aria-hidden="true"></i><span>${t}</span><input type="checkbox" data-col="${k}" ${col(k) ? 'checked' : ''}></label></th>`).join('')}<th class="rg-c"><label title="Todas las salidas de todos"><i class="ti ti-checks" aria-hidden="true"></i><span>Todo</span><input type="checkbox" data-todo ${reps.every((r) => fila(r)) ? 'checked' : ''}></label></th></tr></thead>
              <tbody>${ordenados(reps, c).map((r) => `<tr>
                <td class="rg-pri"><select data-pri="${r.id}" aria-label="Prioridad de ${esc(r.nombre)}">${Array.from({ length: n }, (_, i) => `<option value="${i + 1}" ${c.reportes[r.id].prioridad === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></td>
                <td><span class="rg-rep" title="${esc(r.segmento)}"><i class="ti ${r.icono}" aria-hidden="true"></i><span><b>${esc(r.nombre)}</b><small>${esc(r.segmento)}</small></span></span></td>
                ${SALIDAS.map(([k, t]) => `<td class="rg-c"><input type="checkbox" data-rep="${r.id}" data-sal="${k}" aria-label="${esc(r.nombre)} · ${t}" ${marcado(r.id, k) ? 'checked' : ''}></td>`).join('')}
                <td class="rg-c"><input type="checkbox" data-fila="${r.id}" aria-label="${esc(r.nombre)} · todas" ${fila(r) ? 'checked' : ''}></td></tr>`).join('')}</tbody>
            </table></div>
            <div class="rg-param">
              <label class="campo"><span>Período</span><select data-par="periodo">${PERIODOS.map(([k, t]) => `<option value="${k}" ${par.periodo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
              <label class="campo"><span>Contenido</span><select data-par="contenido">${[['RESUMIDO', 'Resumido'], ['DETALLADO', 'Detallado']].map(([k, t]) => `<option value="${k}" ${par.contenido === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
              <label class="pc-check"><input type="checkbox" data-par="graficas" ${par.graficas !== false ? 'checked' : ''}> Con gráficas</label>
              <span class="rg-nota">Hoy sería del ${fmt().fechaDia(per.desde)} al ${fmt().fechaDia(per.fecha)}; saldos, existencias y disponibilidad al ${fmt().fechaDia(per.fecha)}.</span>
            </div>
          </section>
          <div class="rg-lado">
            <section class="rg-card">
              <h3 class="ta-col-titulo"><i class="ti ti-send" aria-hidden="true"></i> Destinos</h3>
              <label class="campo"><span><i class="ti ti-brand-whatsapp" aria-hidden="true"></i> WhatsApp (separados por coma)</span><input data-campo="whatsapp" value="${esc(c.whatsapp || '')}" placeholder="5555 1234, 502 4444 5678" inputmode="tel"></label>
              <label class="campo"><span><i class="ti ti-mail" aria-hidden="true"></i> Correos (separados por coma)</span><input data-campo="correos" value="${esc(c.correos || '')}" placeholder="gerencia@empresa.com"></label>
            </section>
            <section class="rg-card">
              <h3 class="ta-col-titulo"><i class="ti ti-clock-play" aria-hidden="true"></i> Generación</h3>
              <div class="rg-modo">
                <label class="${c.modo === 'MANUAL' ? 'si' : ''}"><input type="radio" name="rg-modo" value="MANUAL" ${c.modo === 'MANUAL' ? 'checked' : ''}><i class="ti ti-hand-click" aria-hidden="true"></i><span><b>Manual</b><small>Con «Generar ahora»</small></span></label>
                <label class="${c.modo === 'AUTOMATICO' ? 'si' : ''}"><input type="radio" name="rg-modo" value="AUTOMATICO" ${c.modo === 'AUTOMATICO' ? 'checked' : ''}><i class="ti ti-repeat" aria-hidden="true"></i><span><b>Automática</b><small>Con su frecuencia</small></span></label>
              </div>
              <div class="rg-frec ${c.modo === 'AUTOMATICO' ? '' : 'apagado'}">
                <label class="campo"><span>Frecuencia</span><select data-campo="frecuencia" ${c.modo === 'AUTOMATICO' ? '' : 'disabled'}>${FRECUENCIAS.map(([k, t]) => `<option value="${k}" ${c.frecuencia === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
                <label class="campo"><span>${c.frecuencia === 'CADA_HORA' ? 'Minuto' : 'Hora'}</span><input type="time" data-campo="hora" value="${esc(c.hora)}" ${c.modo === 'AUTOMATICO' ? '' : 'disabled'}></label>
                ${c.frecuencia === 'SEMANAL' ? `<label class="campo"><span>Día</span><select data-campo="dia_semana" ${c.modo === 'AUTOMATICO' ? '' : 'disabled'}>${DIAS.map((d, i) => `<option value="${i + 1}" ${Number(c.dia_semana) === i + 1 ? 'selected' : ''}>${d}</option>`).join('')}</select></label>` : ''}
                ${c.frecuencia === 'MENSUAL' ? `<label class="campo"><span>Día del mes</span><input type="number" min="1" max="31" data-campo="dia_mes" value="${esc(String(c.dia_mes))}" ${c.modo === 'AUTOMATICO' ? '' : 'disabled'}></label>` : ''}
              </div>
              <dl class="rg-cuando">
                <div><dt>Próxima</dt><dd>${c.modo === 'AUTOMATICO' ? esc(fechaHora(prox)) : 'Manual'}</dd></div>
                <div><dt>Última</dt><dd>${esc(fechaHora(c.ultima_ejecucion))}</dd></div>
              </dl>
              <p class="rg-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> En automático se generan en la sesión abierta de cada usuario marcado al llegar la hora (o al entrar, si ya pasó) y avisan para enviarlos.</p>
            </section>
          </div>
        </div>`;
      ctx.pDet.querySelector('[data-u-todos]').indeterminate = !todosU && est.usuarios.some((u) => us.has(u.id));
      SALIDAS.forEach(([k]) => { const x = ctx.pDet.querySelector(`[data-col="${k}"]`); x.indeterminate = !col(k) && reps.some((r) => marcado(r.id, k)); });
    }

    async function cargarTodo() {
      await cargarUsuarios();
      await cargarConf();
      if (est.conf !== undefined) pintar(); else pintarFiltros();
    }

    function datosGuardar() {
      const c = est.conf;
      return {
        organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, modulo: m.id, usuarios: c.usuarios, reportes: c.reportes, parametros: c.parametros,
        whatsapp: c.whatsapp || null, correos: c.correos || null, modo: c.modo, frecuencia: c.frecuencia, hora: c.hora || '07:00',
        dia_semana: Number(c.dia_semana) || 1, dia_mes: Math.min(31, Math.max(1, Number(c.dia_mes) || 1)), activo: true,
        proxima_ejecucion: c.modo === 'AUTOMATICO' ? proxima(c)?.toISOString() || null : null,
        modificado_en: new Date().toISOString(), modificado_por: yo.nombre || yo.usuario || null
      };
    }
    async function guardar() {
      const d = datosGuardar();
      if (d.modo === 'AUTOMATICO' && !d.usuarios.length) { window.FIN.aviso('Marca al menos un usuario al que se aplique la generación automática'); return false; }
      const r = est.conf.id ? await sb.from('reportes_gerenciales').update(d).eq('id', est.conf.id).select().single()
        : await sb.from('reportes_gerenciales').insert(d).select().single();
      if (r.error) { window.FIN.aviso(window.UI.traducirError ? window.UI.traducirError(r.error) : r.error.message); return false; }
      est.conf = { ...est.conf, ...r.data, hora: String(r.data.hora).slice(0, 5), reportes: est.conf.reportes, parametros: est.conf.parametros };
      est.cambios = false;
      window.FIN.aviso(d.modo === 'AUTOMATICO' ? `Guardado. Próxima generación: ${fechaHora(d.proxima_ejecucion)}` : 'Reportes gerenciales guardados');
      pintar();
      return true;
    }

    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarTodo();
      const t = e.target, c = est.conf;
      if (!c) return;
      const sal = (id) => (c.reportes[id] = c.reportes[id] || {});
      if (t.dataset.rep) sal(t.dataset.rep)[t.dataset.sal] = t.checked;
      else if (t.dataset.col) reps.forEach((r) => { sal(r.id)[t.dataset.col] = t.checked; });
      else if (t.dataset.fila) SALIDAS.forEach(([k]) => { sal(t.dataset.fila)[k] = t.checked; });
      else if (t.matches('[data-todo]')) reps.forEach((r) => SALIDAS.forEach(([k]) => { sal(r.id)[k] = t.checked; }));
      else if (t.dataset.pri) renumerar(reps, c, t.dataset.pri, Number(t.value));
      else if (t.dataset.u) c.usuarios = t.checked ? [...new Set([...c.usuarios, t.dataset.u])] : c.usuarios.filter((x) => x !== t.dataset.u);
      else if (t.matches('[data-u-todos]')) c.usuarios = t.checked ? est.usuarios.map((u) => u.id) : [];
      else if (t.dataset.par) c.parametros[t.dataset.par] = t.type === 'checkbox' ? t.checked : t.value;
      else if (t.name === 'rg-modo') c.modo = t.value;
      else if (t.dataset.campo) c[t.dataset.campo] = t.value;
      else return;
      est.cambios = true;
      const lista = ctx.pDet.querySelector('.rg-u-lista')?.scrollTop;
      pintar();
      if (lista) ctx.pDet.querySelector('.rg-u-lista').scrollTop = lista;
    });
    cont.addEventListener('input', (e) => { const t = e.target; if (est.conf && (t.dataset.campo === 'whatsapp' || t.dataset.campo === 'correos')) { est.conf[t.dataset.campo] = t.value; est.cambios = true; } });
    cont.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (!a || !est.conf) return;
      if (a === 'guardar') return guardar();
      if (a === 'voz') return asistenteVoz({ ...est.conf, ...datosGuardar() }, m, reps);
      if (a === 'generar') {
        if (est.cambios && !(await guardar())) return;
        const s = await generar({ ...est.conf, ...datosGuardar() }, m);
        if (s) {
          Object.entries(s.params || {}).forEach(([id, prm]) => { if (est.conf.reportes[id]) est.conf.reportes[id].param = prm; });
          const ahora = new Date().toISOString();
          if (est.conf.id) await sb.from('reportes_gerenciales').update({ ultima_ejecucion: ahora, reportes: est.conf.reportes }).eq('id', est.conf.id);
          est.conf.ultima_ejecucion = ahora; pintar();
        }
      }
    });

    (async () => { if (!(await ctx.cargarBase())) return; await cargarTodo(); })();
  };

  // ---------- Generación automática ----------
  // Cada minuto, con la sesión abierta, se revisan las configuraciones automáticas en las que está marcado el usuario:
  // si su próxima generación (desde su última, o desde que se guardó) ya pasó, se marca (solo una sesión del usuario la
  // toma) y se generan.
  let revisando = false;
  async function revisar() {
    const yo = window.FIN && window.FIN.perfil && window.FIN.perfil();
    if (revisando || !yo || !yo.activo || document.getElementById('app')?.hidden) return;
    revisando = true;
    try {
      const sb = window.FIN.sb;
      const { data, error } = await sb.from('reportes_gerenciales').select('*').contains('usuarios', [yo.id]).eq('modo', 'AUTOMATICO').eq('activo', true);
      if (error || !data) return;
      for (const c of data) {
        const m = (window.MODULOS || []).find((x) => x.id === c.modulo);
        if (!m) continue;
        const previa = c.ejecuciones?.[yo.id] || null;
        const conf = { ...c, hora: String(c.hora).slice(0, 5) };
        const toca = proxima(conf, new Date(previa || c.modificado_en || c.creado_en));
        if (!toca || toca.getTime() > Date.now()) continue;
        const t = await sb.rpc('marcar_reporte_gerencial', { p_id: c.id, p_previa: previa });
        if (t.error || t.data !== true) continue;
        await generar(conf, m, { automatico: true });
      }
    } catch (e) { /* se reintenta en la siguiente revisión */ } finally { revisando = false; }
  }
  setTimeout(() => { revisar(); setInterval(revisar, 60e3); }, 10e3);

  window.REPORTES_GERENCIALES = { proxima, periodo, reportesDe };
})();
