// Tickets · Visualización General: todos los tickets de la organización del usuario en una sola
// tabla de consulta (sin la organización en los parámetros): ticket, fecha, solicitante, módulo,
// requerimiento, prioridad, estado, recurso asignado, fecha de asignación, tiempo transcurrido y
// entrega. Los parámetros incluyen la columna de ordenamiento y si es ascendente o descendente
// (también al tocar el encabezado de una columna). Imprime en PDF o Excel.
(function () {
  const { esc } = window.UI;
  const PRIORIDADES = [
    { valor: 1, texto: 'Normal', clase: 'p1' },
    { valor: 2, texto: 'Urgente', clase: 'p2' },
    { valor: 3, texto: 'Importante', clase: 'p3' },
    { valor: 4, texto: 'Urgente no importante', clase: 'p4' },
    { valor: 5, texto: 'Importante y urgente', clase: 'p5' }
  ];
  const RESUELTO = 6;
  const prioridad = (v) => PRIORIDADES.find((p) => p.valor === v) || PRIORIDADES[0];
  const zona = { timeZone: 'America/Guatemala', hour12: false };
  const fechaCorta = (f) => f ? new Date(f).toLocaleString('es-GT', { ...zona, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '';
  const fechaDia = (d) => d ? d.split('-').reverse().join('/') : '';
  const fecha2 = (f) => { const t = fechaCorta(f); if (!t) return '<span class="tk-tenue">—</span>'; const [d, h] = t.split(' '); return `<span class="tv-f2"><b>${esc(d)}</b><small>${esc(h || '')}</small></span>`; };
  const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
  const iniciales = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?';
  const duracion = (ms) => {
    const min = Math.max(0, Math.floor(ms / 60000));
    const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
    return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
  };
  // Columnas que se pueden ordenar: etiqueta y valor de comparación.
  const COLUMNAS = [
    ['fecha', 'Fecha'], ['numero', 'Ticket'], ['transcurrido', 'Tiempo transcurrido'], ['modulo', 'Módulo'], ['estado', 'Estado'],
    ['recurso', 'Usuario asignado'], ['asignado_en', 'Fecha de asignación'], ['prioridad', 'Prioridad'], ['usuario', 'Solicitante'], ['fecha_entrega', 'Fecha estimada de entrega']
  ];

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['tickets-visualizacion'] = function (cont) {
    const sb = window.FIN.sb;
    const yo = window.FIN.perfil();
    let localidades = [], modulos = [], estados = [], tickets = [];
    const nombres = {};
    const f = { org: yo.organizacion_id || null, loc: yo.localidad_id || null, desde: hoy().slice(0, 8) + '01', hasta: hoy(), modulo: '', prioridad: 0, estado: 0, orden: 'fecha', dir: 'desc', formato: 'PDF' };
    let buscar = '';
    let usuarioGraf = null;   // usuario de la gráfica de estados (null = el que más tickets tiene)

    cont.innerHTML = `
      <div class="ta-espacio tv-espacio">
        <section class="ta-filtros tv-filtros" id="tv-filtros"></section>
        <section class="tk-bandeja tv-tabla" id="tv-tabla"></section>
      </div>`;
    const espacio = cont.querySelector('.ta-espacio');
    const pFil = cont.querySelector('#tv-filtros');
    const pTab = cont.querySelector('#tv-tabla');

    const nombreEstado = (c) => (estados.find((e) => e.codigo === c) || {}).nombre || '';
    const marcaEstado = (c) => `<span class="tk-estado e${c}"><i class="tk-punto-color e${c}" aria-hidden="true"></i>${esc(nombreEstado(c))}</span>`;
    const nombreModulo = (id) => { const m = modulos.find((x) => x.id === id); return m ? m.siglas : 'Todos'; };
    const nombreUsuario = (id) => { const r = nombres[id]; return r ? r.nombre || r.usuario : ''; };
    const finDe = (t) => {
      if (t.estado < RESUELTO) return null;
      const m = (t.movimientos || []).filter((x) => x.estado >= RESUELTO).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
      return m ? m.fecha : null;
    };
    const msTranscurrido = (t) => (finDe(t) ? new Date(finDe(t)) : new Date()) - new Date(t.fecha);
    const vencido = (t) => t.fecha_entrega && t.fecha_entrega < hoy() && t.estado < RESUELTO;
    // Fecha de asignación: la de Tickets · Asignación o, si el recurso se puso al generar el ticket, el
    // primer movimiento del historial que ya tiene recurso.
    const fechaAsig = (t) => t.asignado_en || (t.recurso_id ? (t.movimientos || []).filter((m) => m.recurso_id).sort((a, b) => a.fecha.localeCompare(b.fecha))[0]?.fecha : null) || null;
    // Días que faltan (o de atraso) para la fecha estimada de entrega.
    const plazo = (t) => {
      if (!t.fecha_entrega || t.estado >= RESUELTO) return '';
      const d = Math.round((new Date(`${t.fecha_entrega}T12:00:00`) - new Date(`${hoy()}T12:00:00`)) / 86400000);
      return d < 0 ? `vencida ${-d} d` : d === 0 ? 'vence hoy' : `en ${d} d`;
    };
    const valor = (t, c) => ({ fecha: t.fecha, numero: t.numero, transcurrido: msTranscurrido(t), modulo: nombreModulo(t.modulo_id), estado: t.estado, recurso: nombreUsuario(t.recurso_id) || '￿',
      asignado_en: fechaAsig(t) || '￿', prioridad: t.prioridad, usuario: t.usuario || '', fecha_entrega: t.fecha_entrega || '￿' }[c]);

    function ajustarAlto() {
      if (!espacio.isConnected) return window.removeEventListener('resize', ajustarAlto);
      const arriba = espacio.getBoundingClientRect().top + window.scrollY;
      const alto = Math.max(520, window.innerHeight - arriba - 16);
      espacio.style.setProperty('--tk-alto', `${alto}px`);
      const sobra = document.documentElement.scrollHeight - window.innerHeight;
      if (sobra > 0 && alto - sobra >= 520) espacio.style.setProperty('--tk-alto', `${alto - sobra}px`);
    }
    window.addEventListener('resize', ajustarAlto);

    async function iniciar() {
      ajustarAlto();
      const [l, m, e] = await Promise.all([
        sb.from('localidades').select('id, codigo, correlativo, nombre_comercial, organizacion_id').eq('activo', true).order('organizacion_id').order('correlativo'),
        sb.from('modulos_sistema').select('id, siglas, descripcion').is('modulo_mayor_id', null).eq('activo', true).order('codigo'),
        sb.from('estados_ticket').select('*').order('codigo')
      ]);
      if (e.error) { espacio.innerHTML = `<section class="panel"><p class="vacio">${esc(e.error.message)}</p></section>`; return; }
      localidades = (l.data || []).filter((x) => !f.org || x.organizacion_id === f.org);
      modulos = m.data || [];
      estados = e.data || [];
      pintarFiltros();
      await consultar();
    }

    function pintarFiltros() {
      const sel = (n, ops, v) => `<select name="${n}">${ops.map(([x, t]) => `<option value="${x}" ${String(v) === String(x) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
      pFil.innerHTML = `
        <div class="ta-titulo"><span class="tk-icono"><i class="ti ti-layout-dashboard" aria-hidden="true"></i></span><div><small>Tickets</small><h2>Visualización general</h2></div></div>
        <label class="campo"><span>Localidad</span>${sel('loc', [['', 'Todas'], ...localidades.map((x) => [x.id, `${x.codigo} · ${x.nombre_comercial}`])], f.loc || '')}</label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Módulo</span>${sel('modulo', [['', 'Todos'], ['general', 'Todos los módulos (general)'], ...modulos.map((x) => [x.id, `${x.siglas} · ${x.descripcion}`])], f.modulo)}</label>
        <label class="campo"><span>Prioridad</span>${sel('prioridad', [[0, 'Todas'], ...PRIORIDADES.map((p) => [p.valor, `${p.valor}. ${p.texto}`])], f.prioridad)}</label>
        <label class="campo"><span>Estado</span>${sel('estado', [[0, 'Todos'], ...estados.map((x) => [x.codigo, `${x.codigo}. ${x.nombre}`])], f.estado)}</label>
        <label class="campo"><span>Ordenar por</span>${sel('orden', COLUMNAS, f.orden)}</label>
        <label class="campo"><span>Orden</span>${sel('dir', [['asc', 'Ascendente'], ['desc', 'Descendente']], f.dir)}</label>`;
    }

    async function consultar() {
      let q = sb.from('tickets')
        .select('*, localidad:localidades!tickets_localidad_id_organizacion_id_fkey(codigo, nombre_comercial), movimientos:ticket_movimientos(estado, fecha, recurso_id)')
        .gte('fecha', `${f.desde}T00:00:00-06:00`).lte('fecha', `${f.hasta}T23:59:59.999-06:00`).limit(2000);
      if (f.org) q = q.eq('organizacion_id', f.org);
      if (f.loc) q = q.eq('localidad_id', f.loc);
      if (f.modulo === 'general') q = q.is('modulo_id', null);
      else if (f.modulo) q = q.eq('modulo_id', Number(f.modulo));
      if (f.prioridad) q = q.eq('prioridad', f.prioridad);
      if (f.estado) q = q.eq('estado', f.estado);
      const { data, error } = await q;
      if (error) { pTab.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      tickets = data || [];
      const faltan = [...new Set(tickets.map((t) => t.localidad_id))].filter((l) => !(`loc${l}` in nombres));
      await Promise.all(faltan.map(async (l) => { const { data: r } = await sb.rpc('recursos_localidad', { p_localidad: l }); nombres[`loc${l}`] = true; (r || []).forEach((x) => { nombres[x.id] = x; }); }));
      pintarTabla();
    }
    function ordenados() {
      const q = buscar.trim().toLowerCase();
      const lista = tickets.filter((t) => !q || [t.numero, t.descripcion, t.usuario, nombreModulo(t.modulo_id), nombreUsuario(t.recurso_id), nombreEstado(t.estado)].some((v) => String(v || '').toLowerCase().includes(q)));
      const s = f.dir === 'asc' ? 1 : -1;
      return lista.sort((a, b) => { const x = valor(a, f.orden), y = valor(b, f.orden); return (x < y ? -1 : x > y ? 1 : 0) * s || String(b.fecha).localeCompare(String(a.fecha)); });
    }
    function pintarTabla() {
      const lista = ordenados();
      const cuenta = estados.map((e) => [e, tickets.filter((t) => t.estado === e.codigo).length]).filter(([, n]) => n);
      const th = (c, txt, clase = '') => `<th class="tv-orden ${clase} ${f.orden === c ? 'activo' : ''}" data-ordenar="${c}" title="Ordenar por ${esc(txt.toLowerCase())}">${esc(txt)}${f.orden === c ? ` <i class="ti ti-arrow-${f.dir === 'asc' ? 'up' : 'down'}" aria-hidden="true"></i>` : ''}</th>`;
      pTab.innerHTML = `
        <header class="tk-bandeja-cab tv-cab">
          <h2>Tickets <small>${lista.length}${lista.length !== tickets.length ? ` de ${tickets.length}` : ''}</small></h2>
          <div class="tv-cuenta">${cuenta.map(([e, n]) => `<span class="tk-estado e${e.codigo}"><i class="tk-punto-color e${e.codigo}" aria-hidden="true"></i>${esc(e.nombre)} <b>${n}</b></span>`).join('')}${tickets.filter(vencido).length ? `<span class="tv-vencidos"><i class="ti ti-alert-triangle" aria-hidden="true"></i> ${tickets.filter(vencido).length} con entrega vencida</span>` : ''}</div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar ticket, requerimiento, usuario…" value="${esc(buscar)}" aria-label="Buscar tickets"></label>
          <select data-formato aria-label="Formato"><option ${f.formato === 'PDF' ? 'selected' : ''}>PDF</option><option ${f.formato === 'EXCEL' ? 'selected' : ''}>EXCEL</option></select>
          <button type="button" class="boton primario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>
        </header>
        <div class="ta-tabla tv-lista"><table class="tv-t">
          <colgroup><col class="c-num"><col class="c-fecha"><col class="c-sol"><col class="c-mod"><col><col class="c-prio"><col class="c-est"><col class="c-rec"><col class="c-fecha"><col class="c-tiempo"><col class="c-ent"></colgroup>
          <thead><tr>${th('numero', 'Ticket')}${th('fecha', 'Fecha')}${th('usuario', 'Solicitante')}${th('modulo', 'Módulo')}<th>Requerimiento</th>${th('prioridad', 'Prioridad')}${th('estado', 'Estado')}${th('recurso', 'Recurso asignado')}${th('asignado_en', 'Fecha asignación')}${th('transcurrido', 'Tiempo transcurrido')}${th('fecha_entrega', 'Fecha estimada entrega')}</tr></thead>
          <tbody>${lista.map((t) => { const r = nombreUsuario(t.recurso_id); const fin = finDe(t); return `<tr>
            <td class="tk-celda-num"><b>${esc(t.numero)}</b>${f.loc ? '' : `<small>${esc(t.localidad?.codigo || '')}</small>`}</td>
            <td>${fecha2(t.fecha)}</td><td>${esc(t.usuario || '')}</td><td>${esc(nombreModulo(t.modulo_id))}</td>
            <td class="tv-req" title="${esc(t.descripcion)}">${esc(t.descripcion)}</td>
            <td><span class="tk-prioridad ${prioridad(t.prioridad).clase}">${esc(prioridad(t.prioridad).texto)}</span></td>
            <td>${marcaEstado(t.estado)}</td>
            <td title="${esc(r || 'Sin asignar')}">${r ? `<span class="tv-recurso"><span class="tk-avatar">${esc(iniciales(r))}</span>${esc(r)}</span>` : '<span class="ta-sin">Sin asignar</span>'}</td>
            <td>${fecha2(fechaAsig(t))}</td>
            <td><span class="ts-tiempo ${fin ? 'fin' : ''}" data-tiempo="${t.id}">${esc(duracion(msTranscurrido(t)))}</span></td>
            <td class="tv-entrega ${vencido(t) ? 'vencida' : ''}">${t.fecha_entrega ? `<b>${esc(fechaDia(t.fecha_entrega))}</b>${plazo(t) ? `<small>${esc(plazo(t))}</small>` : ''}` : '<span class="tk-tenue">Sin fecha</span>'}</td></tr>`; }).join('')
            || '<tr><td colspan="11" class="tk-vacio"><i class="ti ti-ticket" aria-hidden="true"></i>No hay tickets con esos parámetros.</td></tr>'}</tbody>
        </table></div>
        <div class="tv-graficas">${grafica(lista)}${graficaEstados(lista)}</div>`;
    }
    // Tickets asignados por usuario (barras horizontales, una serie): los mismos tickets de la tabla.
    function grafica(lista) {
      if (!lista.length) return '';
      const g = new Map();
      lista.forEach((t) => { const k = t.recurso_id || ''; const x = g.get(k) || { nombre: k ? nombreUsuario(k) || 'Usuario' : 'Sin asignar', total: 0, abiertos: 0, porEstado: {} }; x.total++; if (t.estado < RESUELTO) x.abiertos++; x.porEstado[t.estado] = (x.porEstado[t.estado] || 0) + 1; g.set(k, x); });
      const filas = [...g.entries()].sort((a, b) => (a[0] === '') - (b[0] === '') || b[1].total - a[1].total);
      const max = Math.max(...filas.map(([, x]) => x.total));
      const asignados = filas.filter(([k]) => k).reduce((t, [, x]) => t + x.total, 0);
      return `<section class="tv-grafica" aria-label="Tickets asignados por usuario">
          <header><h3><i class="ti ti-chart-bar" aria-hidden="true"></i> Tickets asignados por usuario</h3><small>${asignados} de ${lista.length} ticket(s) asignados · según los parámetros y la búsqueda</small></header>
          <div class="tv-barras">${filas.map(([k, x]) => { const det = Object.entries(x.porEstado).map(([e, n]) => `${nombreEstado(Number(e))}: ${n}`).join(' · '); return `<div class="tv-fila ${k && k === usuarioElegido(lista) ? 'elegido' : ''}" data-usuario="${esc(k)}" tabindex="0" title="${esc(x.nombre)} · ${x.total} ticket(s) · ${esc(det)}">
              <span class="tv-nombre">${k ? `<span class="tk-avatar">${esc(iniciales(x.nombre))}</span>` : ''}${esc(x.nombre)}</span>
              <span class="tv-pista"><span class="tv-barra ${k ? '' : 'sin'}" style="width:${Math.max(2, x.total / max * 100)}%"></span></span>
              <span class="tv-valor"><b>${x.total}</b> <small>${x.abiertos === x.total ? (x.total === 1 ? 'abierto' : 'abiertos') : x.abiertos ? `· ${x.abiertos} abierto${x.abiertos === 1 ? '' : 's'}` : (x.total === 1 ? 'resuelto' : 'resueltos')}</small></span></div>`; }).join('')}</div>
        </section>`;
    }
    // Usuario de la gráfica de estados: el elegido si sigue en la lista; si no, el que más tickets tiene.
    function usuarioElegido(lista) {
      const ids = lista.map((t) => t.recurso_id).filter(Boolean);
      if (usuarioGraf && ids.includes(usuarioGraf)) return usuarioGraf;
      const n = {};
      ids.forEach((id) => { n[id] = (n[id] || 0) + 1; });
      return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || null;
    }
    // Tickets de un usuario por estado (barras horizontales, una serie, en el orden del proceso).
    function graficaEstados(lista) {
      if (!lista.length) return '';
      const usuarios = [...new Set(lista.map((t) => t.recurso_id).filter(Boolean))].sort((a, b) => nombreUsuario(a).localeCompare(nombreUsuario(b)));
      const u = usuarioElegido(lista);
      const suyos = lista.filter((t) => t.recurso_id === u);
      const porEstado = estados.map((e) => [e, suyos.filter((t) => t.estado === e.codigo)]);
      const max = Math.max(1, ...porEstado.map(([, x]) => x.length));
      const abiertos = suyos.filter((t) => t.estado < RESUELTO).length;
      const vencidos = suyos.filter(vencido).length;
      return `<section class="tv-grafica" aria-label="Tickets por estado del usuario">
          <header><h3><i class="ti ti-chart-bar" aria-hidden="true"></i> Tickets por estado de</h3>
            ${usuarios.length ? `<select data-usuario-graf aria-label="Usuario">${usuarios.map((id) => `<option value="${esc(id)}" ${id === u ? 'selected' : ''}>${esc(nombreUsuario(id) || 'Usuario')}</option>`).join('')}</select>` : ''}
            <small>${u ? `${suyos.length} ticket(s) · ${abiertos} abierto${abiertos === 1 ? '' : 's'}${vencidos ? ` · <b class="pc-rojo">${vencidos} con entrega vencida</b>` : ''}` : 'Ningún ticket asignado con estos parámetros'}</small></header>
          ${u ? `<div class="tv-barras tv-estados">${porEstado.map(([e, x]) => `<div class="tv-fila ${x.length ? '' : 'cero'}" tabindex="0" title="${esc(e.nombre)}: ${x.length} ticket(s)${x.length ? ` · ${esc(x.map((t) => t.numero).join(', '))}` : ''}">
              <span class="tv-nombre"><span class="tk-estado e${e.codigo}"><i class="tk-punto-color e${e.codigo}" aria-hidden="true"></i>${esc(e.nombre)}</span></span>
              <span class="tv-pista">${x.length ? `<span class="tv-barra" style="width:${Math.max(2, x.length / max * 100)}%"></span>` : ''}</span>
              <span class="tv-valor"><b>${x.length}</b></span></div>`).join('')}</div>` : ''}
        </section>`;
    }
    function imprimirLista() {
      const lista = ordenados();
      if (!lista.length) return window.FIN.aviso('No hay tickets para imprimir');
      const cab = ['Ticket', 'Localidad', 'Fecha', 'Solicitante', 'Módulo', 'Requerimiento', 'Prioridad', 'Estado', 'Recurso asignado', 'Fecha asignación', 'Tiempo transcurrido', 'Fecha estimada de entrega', 'Plazo'];
      const filas = lista.map((t) => [t.numero, t.localidad?.codigo || '', fechaCorta(t.fecha), t.usuario || '', nombreModulo(t.modulo_id), t.descripcion, prioridad(t.prioridad).texto, nombreEstado(t.estado), nombreUsuario(t.recurso_id) || 'Sin asignar', fechaCorta(fechaAsig(t)), duracion(msTranscurrido(t)), fechaDia(t.fecha_entrega), plazo(t)]);
      if (f.formato === 'EXCEL') return window.COMPRAS_CAT.descargarCsv(`tickets_${f.desde}_${f.hasta}.csv`, [cab, ...filas]);
      const loc = localidades.find((x) => x.id === f.loc);
      window.BANCOS.imprimir('Tickets · Visualización general', `<h1>Tickets · Visualización general</h1><h2>${esc(loc ? `${loc.codigo} · ${loc.nombre_comercial}` : 'Todas las localidades')} · del ${esc(fechaDia(f.desde))} al ${esc(fechaDia(f.hasta))} · ordenado por ${esc(COLUMNAS.find(([c]) => c === f.orden)[1].toLowerCase())} (${f.dir === 'asc' ? 'ascendente' : 'descendente'})</h2>
        <table><thead><tr>${cab.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${filas.map((r) => `<tr>${r.map((v) => `<td>${esc(String(v ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="${cab.length}">${filas.length} ticket(s)</td></tr></tfoot></table>`);
    }

    cont.addEventListener('change', (e) => {
      if (e.target.matches('[data-formato]')) { f.formato = e.target.value; return; }
      if (e.target.matches('[data-usuario-graf]')) { usuarioGraf = e.target.value; return pintarTabla(); }
      if (!e.target.closest('#tv-filtros')) return;
      const n = e.target.name, v = e.target.value;
      if (n === 'loc') f.loc = v ? Number(v) : null;
      else if (n === 'prioridad' || n === 'estado') f[n] = Number(v);
      else f[n] = v;
      if (f.hasta < f.desde) { if (n === 'desde') f.hasta = f.desde; else f.desde = f.hasta; }
      pintarFiltros();
      return n === 'orden' || n === 'dir' ? pintarTabla() : consultar();
    });
    cont.addEventListener('click', (e) => {
      const th = e.target.closest('[data-ordenar]');
      if (th) { const c = th.dataset.ordenar; f.dir = f.orden === c && f.dir === 'desc' ? 'asc' : f.orden === c ? 'desc' : 'asc'; f.orden = c; pintarFiltros(); return pintarTabla(); }
      if (e.target.closest('[data-accion=imprimir]')) return imprimirLista();
      const fu = e.target.closest('.tv-fila[data-usuario]');
      if (fu && fu.dataset.usuario) { usuarioGraf = fu.dataset.usuario; return pintarTabla(); }
    });
    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-buscar]')) return;
      buscar = e.target.value;
      const pos = e.target.selectionStart;
      pintarTabla();
      const b = pTab.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
    });
    // Los tiempos transcurridos se actualizan cada minuto.
    const reloj = setInterval(() => {
      if (!espacio.isConnected) return clearInterval(reloj);
      pTab.querySelectorAll('[data-tiempo]').forEach((el) => { const t = tickets.find((x) => String(x.id) === el.dataset.tiempo); if (t) el.textContent = duracion(msTranscurrido(t)); });
    }, 60000);
    iniciar();
  };
})();
