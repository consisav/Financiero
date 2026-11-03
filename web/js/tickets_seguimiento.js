// Tickets · Seguimiento (maestro - detalle), en una sola pantalla:
//   Arriba, los parámetros de consulta: organización, localidad, fecha inicial y final, módulo,
//   prioridad y estado.
//   Maestro: por cada ticket, su descripción, estado (por color), fecha de asignación, usuario
//   asignado y tiempo transcurrido.
//   Detalle: el ticket elegido con su gráfica del proceso, tiempos, procesos de la solución y las
//   observaciones de seguimiento (bitácora: la fecha y el usuario se graban solos).
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
  const fechaHora = (f) => f ? new Date(f).toLocaleString('es-GT', { ...zona, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '') : '';
  const fechaCorta = (f) => f ? new Date(f).toLocaleString('es-GT', { ...zona, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '';
  const fechaDia = (d) => d ? d.split('-').reverse().join('/') : '';
  const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
  const iniciales = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?';
  const marcaPrioridad = (v) => `<span class="tk-prioridad ${prioridad(v).clase}">${esc(prioridad(v).texto)}</span>`;
  // Duración legible: 2 d 4 h · 3 h 12 min · 8 min.
  const duracion = (ms) => {
    const min = Math.max(0, Math.floor(ms / 60000));
    const d = Math.floor(min / 1440);
    const h = Math.floor((min % 1440) / 60);
    const m = min % 60;
    return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
  };

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['tickets-seguimiento'] = function (cont) {
    const sb = window.FIN.sb;
    const yo = window.FIN.perfil();
    let organizaciones = [];
    let localidades = [];
    let modulos = [];
    let estados = [];
    let tickets = [];
    let actual = null;
    let procesos = [];
    let notas = [];
    const nombres = {};     // id de perfil → { nombre, usuario }
    const f = {
      org: yo.organizacion_id || null, loc: yo.localidad_id || null,
      desde: hoy().slice(0, 8) + '01', hasta: hoy(), modulo: '', prioridad: 0, estado: 0
    };

    cont.innerHTML = `
      <div class="ta-espacio">
        <section class="ta-filtros ts-filtros" id="ts-filtros"></section>
        <div class="ta-cuerpo ts-cuerpo">
          <section class="tk-bandeja ta-maestro" id="ts-maestro"></section>
          <section class="tk-detalle ta-detalle" id="ts-detalle"></section>
        </div>
      </div>`;
    const espacio = cont.querySelector('.ta-espacio');
    const pFil = cont.querySelector('#ts-filtros');
    const pMae = cont.querySelector('#ts-maestro');
    const pDet = cont.querySelector('#ts-detalle');

    const nombreEstado = (c) => (estados.find((e) => e.codigo === c) || {}).nombre || '';
    const marcaEstado = (c) => `<span class="tk-estado e${c}"><i class="tk-punto-color e${c}" aria-hidden="true"></i>${esc(nombreEstado(c))}</span>`;
    const modulo = (id) => modulos.find((m) => m.id === id);
    const nombreUsuario = (id) => { const r = nombres[id]; return r ? r.nombre || r.usuario : ''; };
    const puedeAnotar = (t) => window.FIN.puedeEditarCatalogos() || [t.perfil_id, t.recurso_id].includes(yo.id);
    // El tiempo corre desde que se generó el ticket hasta que se resolvió (o hasta ahora).
    const finDe = (t) => {
      if (t.estado < RESUELTO) return null;
      const m = (t.movimientos || []).filter((x) => x.estado >= RESUELTO).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
      return m ? m.fecha : null;
    };
    const transcurrido = (t) => duracion((finDe(t) ? new Date(finDe(t)) : new Date()) - new Date(t.fecha));
    const desdeAsignacion = (t) => t.asignado_en ? duracion((finDe(t) ? new Date(finDe(t)) : new Date()) - new Date(t.asignado_en)) : '';
    const vencido = (t) => t.fecha_entrega && t.fecha_entrega < hoy() && t.estado < RESUELTO;

    function ajustarAlto() {
      if (!espacio.isConnected) return window.removeEventListener('resize', ajustarAlto);
      const arriba = espacio.getBoundingClientRect().top + window.scrollY;
      const alto = Math.max(600, window.innerHeight - arriba - 16);
      espacio.style.setProperty('--tk-alto', `${alto}px`);
      const sobra = document.documentElement.scrollHeight - window.innerHeight;
      if (sobra > 0 && alto - sobra >= 600) espacio.style.setProperty('--tk-alto', `${alto - sobra}px`);
    }
    window.addEventListener('resize', ajustarAlto);

    async function iniciar() {
      ajustarAlto();
      const [o, l, m, e, prueba] = await Promise.all([
        sb.from('organizaciones').select('id, codigo, nombre').eq('activo', true).order('codigo'),
        sb.from('localidades').select('id, codigo, correlativo, nombre_comercial, organizacion_id').eq('activo', true).order('organizacion_id').order('correlativo'),
        sb.from('modulos_sistema').select('id, siglas, descripcion').is('modulo_mayor_id', null).eq('activo', true).order('codigo'),
        sb.from('estados_ticket').select('*').order('codigo'),
        sb.from('ticket_seguimientos').select('id').limit(1)
      ]);
      if (prueba.error || e.error) {
        const err = prueba.error || e.error;
        espacio.innerHTML = `<section class="panel"><p class="vacio">${/ticket_seguimientos|estados_ticket/.test(err.message) ? 'Falta instalar el script 30 (seguimiento de tickets) en Supabase.' : esc(err.message)}</p></section>`;
        return;
      }
      organizaciones = o.data || [];
      localidades = l.data || [];
      modulos = m.data || [];
      estados = e.data || [];
      pintarFiltros();
      await consultar();
    }

    // ---------- Parámetros de consulta ----------
    function pintarFiltros() {
      const locs = localidades.filter((l) => l.organizacion_id === f.org);
      pFil.innerHTML = `
        <div class="ta-titulo"><span class="tk-icono"><i class="ti ti-progress-check" aria-hidden="true"></i></span><div><small>Tickets</small><h2>Seguimiento</h2></div></div>
        <label class="campo"><span>Organización</span><select name="org">${organizaciones.map((o) => `<option value="${o.id}" ${f.org === o.id ? 'selected' : ''}>${o.codigo} · ${esc(o.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Localidad</span><select name="loc"><option value="">Todas</option>${locs.map((l) => `<option value="${l.id}" ${f.loc === l.id ? 'selected' : ''}>${esc(l.codigo)} · ${esc(l.nombre_comercial)}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Módulo</span><select name="modulo"><option value="">Todos</option><option value="general" ${f.modulo === 'general' ? 'selected' : ''}>Todos los módulos (general)</option>${modulos.map((m) => `<option value="${m.id}" ${String(f.modulo) === String(m.id) ? 'selected' : ''}>${esc(m.siglas)} · ${esc(m.descripcion)}</option>`).join('')}</select></label>
        <label class="campo"><span>Prioridad</span><select name="prioridad"><option value="0">Todas</option>${PRIORIDADES.map((p) => `<option value="${p.valor}" ${f.prioridad === p.valor ? 'selected' : ''}>${p.valor}. ${esc(p.texto)}</option>`).join('')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado"><option value="0">Todos</option>${estados.map((e) => `<option value="${e.codigo}" ${f.estado === e.codigo ? 'selected' : ''}>${e.codigo}. ${esc(e.nombre)}</option>`).join('')}</select></label>`;
    }

    async function consultar() {
      let q = sb.from('tickets')
        .select('*, localidad:localidades!tickets_localidad_id_organizacion_id_fkey(codigo, nombre_comercial), movimientos:ticket_movimientos(estado, fecha)')
        .gte('fecha', `${f.desde}T00:00:00-06:00`).lte('fecha', `${f.hasta}T23:59:59.999-06:00`)
        .order('fecha', { ascending: false }).limit(500);
      if (f.org) q = q.eq('organizacion_id', f.org);
      if (f.loc) q = q.eq('localidad_id', f.loc);
      if (f.modulo === 'general') q = q.is('modulo_id', null);
      else if (f.modulo) q = q.eq('modulo_id', Number(f.modulo));
      if (f.prioridad) q = q.eq('prioridad', f.prioridad);
      if (f.estado) q = q.eq('estado', f.estado);
      const { data, error } = await q;
      if (error) { pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      tickets = data;
      await cargarNombres(tickets.map((t) => t.localidad_id));
      if (actual && !tickets.some((t) => t.id === actual.id)) actual = null;
      if (!actual && tickets.length) actual = tickets[0];
      pintarMaestro();
      await abrir(actual ? tickets.find((t) => t.id === actual.id) : null);
    }

    async function cargarNombres(locs) {
      const faltan = [...new Set(locs)].filter((l) => !(`loc${l}` in nombres));
      await Promise.all(faltan.map(async (l) => {
        const { data } = await sb.rpc('recursos_localidad', { p_localidad: l });
        nombres[`loc${l}`] = true;
        (data || []).forEach((r) => { nombres[r.id] = r; });
      }));
    }

    // ---------- Maestro ----------
    function pintarMaestro() {
      const cuenta = (c) => tickets.filter((t) => t.estado === c).length;
      pMae.innerHTML = `
        <header class="tk-bandeja-cab">
          <h2>Tickets <small>${tickets.length}</small></h2>
          <div class="ts-resumen">${estados.filter((e) => cuenta(e.codigo)).map((e) => `<span class="tk-estado e${e.codigo}" title="${esc(e.nombre)}">${esc(e.nombre)} <b>${cuenta(e.codigo)}</b></span>`).join('')}
            ${tickets.some(vencido) ? `<span class="ts-vencidos"><i class="ti ti-alarm" aria-hidden="true"></i> ${tickets.filter(vencido).length} vencidos</span>` : ''}</div>
        </header>
        <div class="ta-tabla">
          <table>
            <thead><tr><th>Ticket</th><th>Descripción</th><th>Prioridad</th><th>Estado</th><th>Fecha asignación</th><th>Asignado a</th><th>Tiempo transcurrido</th><th>Entrega</th></tr></thead>
            <tbody>
              ${tickets.map((t) => `
                <tr class="${actual && actual.id === t.id ? 'actual' : ''}" data-ticket="${t.id}" tabindex="0">
                  <td class="fuerte"><i class="tk-franja-celda e${t.estado}" aria-hidden="true"></i>${esc(t.numero)}<small class="ts-sub">${esc(fechaCorta(t.fecha))}</small></td>
                  <td class="ta-desc" title="${esc(t.descripcion)}">${esc(t.descripcion)}</td>
                  <td>${marcaPrioridad(t.prioridad)}</td>
                  <td>${marcaEstado(t.estado)}</td>
                  <td>${t.asignado_en ? esc(fechaCorta(t.asignado_en)) : '<span class="ta-sin">Sin asignar</span>'}</td>
                  <td>${t.recurso_id ? `<span class="tk-persona"><span class="tk-avatar">${esc(iniciales(nombreUsuario(t.recurso_id)))}</span>${esc(nombreUsuario(t.recurso_id))}</span>` : '—'}</td>
                  <td><span class="ts-tiempo ${finDe(t) ? 'fin' : ''}" data-tiempo="${t.id}">${esc(transcurrido(t))}</span></td>
                  <td class="${vencido(t) ? 'ta-vencido' : ''}">${esc(fechaDia(t.fecha_entrega)) || '—'}</td>
                </tr>`).join('') || '<tr><td colspan="8" class="tk-vacio"><i class="ti ti-inbox" aria-hidden="true"></i>No hay tickets con esos parámetros.</td></tr>'}
            </tbody>
          </table>
        </div>`;
    }

    async function abrir(t) {
      actual = t;
      procesos = [];
      notas = [];
      if (t) {
        const [p, n] = await Promise.all([
          sb.from('ticket_procesos').select('*').eq('ticket_id', t.id).order('numero'),
          sb.from('ticket_seguimientos').select('*').eq('ticket_id', t.id).order('fecha', { ascending: false })
        ]);
        procesos = p.data || [];
        notas = n.data || [];
      }
      pintarDetalle();
      pMae.querySelectorAll('tr[data-ticket]').forEach((tr) => tr.classList.toggle('actual', !!t && tr.dataset.ticket === String(t.id)));
    }

    // ---------- Detalle ----------
    function grafica(t) {
      const llegada = {};
      (t.movimientos || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach((m) => { llegada[m.estado] = m.fecha; });
      return `
        <ol class="tk-pasos" aria-label="Estado del ticket: ${esc(nombreEstado(t.estado))}">
          ${estados.map((e) => {
            const clase = e.codigo < t.estado ? 'hecho' : e.codigo === t.estado ? 'actual' : '';
            return `
              <li class="tk-paso ${clase}" ${e.codigo === t.estado ? 'aria-current="step"' : ''} title="${esc(e.descripcion || '')}">
                <span class="tk-punto">${e.codigo < t.estado ? '<i class="ti ti-check" aria-hidden="true"></i>' : e.codigo}</span>
                <span class="tk-paso-nombre">${esc(e.nombre)}</span>
                <small>${llegada[e.codigo] && e.codigo <= t.estado ? esc(fechaCorta(llegada[e.codigo])) : ''}</small>
              </li>`;
          }).join('')}
        </ol>`;
    }

    function pintarDetalle() {
      const t = actual;
      if (!t) {
        pDet.innerHTML = '<div class="tk-vacio ta-elige"><i class="ti ti-hand-click" aria-hidden="true"></i>Elige un ticket del maestro para ver su seguimiento.</div>';
        return;
      }
      const fin = procesos.filter((x) => x.estado === 'FINALIZADO').length;
      const pct = procesos.length ? Math.round((fin / procesos.length) * 100) : 0;
      pDet.innerHTML = `
        <div class="tk-form ta-form ts-form">
          <header class="tk-titulo">
            <span class="tk-icono ts-icono e${t.estado}"><i class="ti ti-ticket" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>Seguimiento del ticket</small><h2>${esc(t.numero)}</h2></div>
            <div class="tk-marcas">${marcaEstado(t.estado)}${marcaPrioridad(t.prioridad)}</div>
          </header>

          <div class="ts-tiempos">
            <div class="ts-reloj ${finDe(t) ? 'fin' : ''}"><span>Tiempo transcurrido</span><b data-tiempo-det>${esc(transcurrido(t))}</b><small>${finDe(t) ? `Resuelto el ${esc(fechaCorta(finDe(t)))}` : `Desde ${esc(fechaCorta(t.fecha))}`}</small></div>
            <div><span>Fecha asignación</span><b>${t.asignado_en ? esc(fechaHora(t.asignado_en)) : 'Sin asignar'}</b><small>${t.asignado_en ? `Hace ${esc(desdeAsignacion(t))} · por ${esc(t.asignado_por || '')}` : '&nbsp;'}</small></div>
            <div><span>Asignado a</span><b>${esc(nombreUsuario(t.recurso_id) || '—')}</b><small>${t.recurso_id && nombres[t.recurso_id]?.usuario ? esc(nombres[t.recurso_id].usuario) : '&nbsp;'}</small></div>
            <div class="${vencido(t) ? 'ts-alerta' : ''}"><span>Entrega estimada</span><b>${esc(fechaDia(t.fecha_entrega)) || '—'}</b><small>${vencido(t) ? 'Vencida' : t.fecha_entrega ? 'En plazo' : '&nbsp;'}</small></div>
          </div>

          <div class="tk-proceso">${grafica(t)}</div>

          <div class="ta-requerimiento"><span>Descripción</span><p>${esc(t.descripcion)}</p></div>

          ${procesos.length ? `
            <section class="ta-procesos ts-procesos">
              <div class="ta-proc-cab"><h3><i class="ti ti-list-numbers" aria-hidden="true"></i> Procesos de la solución</h3><span class="ta-avance"><i style="width:${pct}%"></i></span><small>${fin} de ${procesos.length} finalizados</small></div>
              <ol class="ta-proc-lista">
                ${procesos.map((x) => `
                  <li><span class="ta-proc-num ${({ ASIGNADO: 'asignado', 'EN PROCESO': 'proceso', FINALIZADO: 'finalizado' })[x.estado]}">${x.estado === 'FINALIZADO' ? '<i class="ti ti-check" aria-hidden="true"></i>' : x.numero}</span>
                    <div class="ta-proc-texto"><div class="ta-proc-linea"><b>${x.numero}. ${esc(x.descripcion)}</b><span class="ta-proc-estado ${({ ASIGNADO: 'asignado', 'EN PROCESO': 'proceso', FINALIZADO: 'finalizado' })[x.estado]}">${esc(x.estado)}</span></div>
                      <small><span class="${x.fecha_entrega && x.fecha_entrega < hoy() && x.estado !== 'FINALIZADO' ? 'ta-vencido' : ''}"><i class="ti ti-calendar-due" aria-hidden="true"></i> ${x.fecha_entrega ? `Entrega ${esc(fechaDia(x.fecha_entrega))}` : 'Sin fecha'}</span><span><i class="ti ti-user" aria-hidden="true"></i> ${esc(nombreUsuario(x.responsable_id) || '—')}</span></small></div></li>`).join('')}
              </ol>
            </section>` : ''}

          <section class="ts-notas">
            <h3><i class="ti ti-notes" aria-hidden="true"></i> Observaciones de seguimiento <small class="tk-tenue">${notas.length || ''}</small></h3>
            ${puedeAnotar(t) ? `
              <form class="ts-nota-form" novalidate>
                <textarea name="observacion" rows="2" placeholder="Escribe el avance, una novedad o lo que falta para resolverlo…" maxlength="1000"></textarea>
                <div class="ts-nota-pie"><small class="tk-tenue">Se graba con la fecha, hora y tu usuario (${esc((yo.usuario || '').toUpperCase())}).</small>
                  <button type="submit" class="boton primario-sm"><i class="ti ti-message-plus" aria-hidden="true"></i> Agregar observación</button></div>
                <p class="modal-error tk-error" role="alert"></p>
              </form>` : '<p class="tk-aviso"><i class="ti ti-lock" aria-hidden="true"></i> Solo quien creó el ticket, el recurso asignado o un administrador pueden agregar observaciones</p>'}
            ${notas.length ? `<ol class="ts-bitacora">
              ${notas.map((n) => `<li><span class="tk-avatar">${esc(iniciales(nombreUsuario(n.perfil_id) || n.usuario || ''))}</span><div><p>${esc(n.observacion)}</p><small>${esc(n.usuario || '')} · ${esc(fechaHora(n.fecha))}</small></div></li>`).join('')}
            </ol>` : '<p class="tk-tenue">Todavía no hay observaciones de seguimiento.</p>'}
          </section>
        </div>`;
    }

    async function anotar(form) {
      const error = form.querySelector('.modal-error');
      const texto = form.elements.observacion.value.trim();
      if (!texto) { error.textContent = 'Escribe la observación.'; form.elements.observacion.focus(); return; }
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      const { error: err } = await sb.from('ticket_seguimientos').insert({ ticket_id: actual.id, observacion: texto });
      boton.disabled = false;
      if (err) { error.textContent = window.UI.traducirError(err); return; }
      window.FIN.aviso('Observación agregada');
      await abrir(actual);
    }

    cont.addEventListener('change', (e) => {
      if (!e.target.closest('#ts-filtros')) return;
      const n = e.target.name;
      const val = e.target.value;
      if (n === 'org') { f.org = Number(val); f.loc = null; pintarFiltros(); }
      else if (n === 'loc') f.loc = val ? Number(val) : null;
      else if (n === 'prioridad' || n === 'estado') f[n] = Number(val);
      else f[n] = val;
      if (n === 'desde' || n === 'hasta') {
        if (f.desde && f.hasta && f.hasta < f.desde) { if (n === 'desde') f.hasta = f.desde; else f.desde = f.hasta; }
        pintarFiltros();
      }
      if (f.desde && f.hasta) consultar();
    });
    cont.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-ticket]');
      if (tr) abrir(tickets.find((t) => String(t.id) === tr.dataset.ticket));
    });
    cont.addEventListener('keydown', (e) => {
      const tr = e.target.closest('tr[data-ticket]');
      if (tr && e.key === 'Enter') abrir(tickets.find((t) => String(t.id) === tr.dataset.ticket));
    });
    cont.addEventListener('submit', (e) => {
      if (!e.target.matches('.ts-nota-form')) return;
      e.preventDefault();
      anotar(e.target);
    });

    // Los tiempos transcurridos se actualizan cada 30 segundos.
    const reloj = setInterval(() => {
      if (!pMae.isConnected) return clearInterval(reloj);
      pMae.querySelectorAll('[data-tiempo]').forEach((el) => {
        const t = tickets.find((x) => String(x.id) === el.dataset.tiempo);
        if (t) el.textContent = transcurrido(t);
      });
      const d = pDet.querySelector('[data-tiempo-det]');
      if (d && actual) d.textContent = transcurrido(actual);
    }, 30000);

    iniciar();
  };
})();
