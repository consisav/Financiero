// Tickets · Asignación (maestro - detalle), en una sola pantalla:
//   Arriba, los parámetros de consulta: organización, localidad, fecha inicial y final, módulo,
//   prioridad y si están asignados o no.
//   Maestro: los tickets que cumplen esos parámetros.
//   Detalle: el ticket elegido, su asignación (recurso, fecha estimada de entrega, observaciones;
//   la fecha y hora y el usuario que asigna se graban solos), los procesos de la solución
//   (número, descripción, entrega, responsable, estado con su fecha y observaciones) y el
//   historial de asignaciones.
(function () {
  const { esc } = window.UI;

  const PRIORIDADES = [
    { valor: 1, texto: 'Normal', clase: 'p1' },
    { valor: 2, texto: 'Urgente', clase: 'p2' },
    { valor: 3, texto: 'Importante', clase: 'p3' },
    { valor: 4, texto: 'Urgente no importante', clase: 'p4' },
    { valor: 5, texto: 'Importante y urgente', clase: 'p5' }
  ];
  const prioridad = (v) => PRIORIDADES.find((p) => p.valor === v) || PRIORIDADES[0];
  const zona = { timeZone: 'America/Guatemala', hour12: false };
  const fechaHora = (f) => f ? new Date(f).toLocaleString('es-GT', { ...zona, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '') : '';
  const fechaCorta = (f) => f ? new Date(f).toLocaleString('es-GT', { ...zona, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '';
  // Fecha de hoy en Guatemala (aaaa-mm-dd).
  const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
  const iniciales = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?';
  const ESTADOS_PROCESO = ['ASIGNADO', 'EN PROCESO', 'FINALIZADO'];
  const claseProceso = (e) => ({ ASIGNADO: 'asignado', 'EN PROCESO': 'proceso', FINALIZADO: 'finalizado' })[e];
  const fechaDia = (d) => d ? d.split('-').reverse().join('/') : '';
  const marcaPrioridad = (v) => `<span class="tk-prioridad ${prioridad(v).clase}">${esc(prioridad(v).texto)}</span>`;

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['tickets-asignacion'] = function (cont) {
    const sb = window.FIN.sb;
    const yo = window.FIN.perfil();
    const editable = window.FIN.puedeEditarCatalogos();
    let organizaciones = [];
    let localidades = [];
    let modulos = [];
    let estados = [];
    let tickets = [];
    let actual = null;
    let recursos = [];      // usuarios de la localidad del ticket elegido
    let asignaciones = [];
    let procesos = [];
    let editando = null;    // id del proceso que se modifica (null = nuevo)
    let modificando = false; // se modifica la asignación vigente en lugar de reasignar
    let nombres = {};       // id de perfil → nombre (de los recursos ya consultados)
    const f = {
      org: yo.organizacion_id || null, loc: yo.localidad_id || null,
      desde: hoy().slice(0, 8) + '01', hasta: hoy(), modulo: '', prioridad: 0, asignacion: 'todos'
    };

    cont.innerHTML = `
      <div class="ta-espacio ta-apilado tq-espacio">
        <section class="ta-filtros" id="ta-filtros"></section>
        <div class="ta-cuerpo">
          <section class="tk-bandeja ta-maestro" id="ta-maestro"></section>
          <section class="tk-detalle ta-detalle" id="ta-detalle"></section>
        </div>
      </div>`;
    const espacio = cont.querySelector('.ta-espacio');
    const pFil = cont.querySelector('#ta-filtros');
    const pMae = cont.querySelector('#ta-maestro');
    const pDet = cont.querySelector('#ta-detalle');

    const nombreEstado = (c) => (estados.find((e) => e.codigo === c) || {}).nombre || '';
    const marcaEstado = (c) => `<span class="tk-estado e${c}">${esc(nombreEstado(c))}</span>`;
    const modulo = (id) => modulos.find((m) => m.id === id);
    const localidad = (id) => localidades.find((l) => l.id === id);

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
        sb.from('ticket_asignaciones').select('id').limit(1)
      ]);
      if (prueba.error || e.error) {
        const err = prueba.error || e.error;
        espacio.innerHTML = `<section class="panel"><p class="vacio">${/ticket_asignaciones|estados_ticket/.test(err.message) ? 'Falta instalar el script 28 (asignación de tickets) en Supabase.' : esc(err.message)}</p></section>`;
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
        <div class="ta-titulo"><span class="tk-icono"><i class="ti ti-user-check" aria-hidden="true"></i></span><div><small>Tickets</small><h2>Asignación</h2></div></div>
        <label class="campo"><span>Organización</span><select name="org">${organizaciones.map((o) => `<option value="${o.id}" ${f.org === o.id ? 'selected' : ''}>${o.codigo} · ${esc(o.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Localidad</span><select name="loc"><option value="">Todas</option>${locs.map((l) => `<option value="${l.id}" ${f.loc === l.id ? 'selected' : ''}>${esc(l.codigo)} · ${esc(l.nombre_comercial)}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Módulo</span><select name="modulo"><option value="">Todos</option><option value="general" ${f.modulo === 'general' ? 'selected' : ''}>Todos los módulos (general)</option>${modulos.map((m) => `<option value="${m.id}" ${String(f.modulo) === String(m.id) ? 'selected' : ''}>${esc(m.siglas)} · ${esc(m.descripcion)}</option>`).join('')}</select></label>
        <label class="campo"><span>Prioridad</span><select name="prioridad"><option value="0">Todas</option>${PRIORIDADES.map((p) => `<option value="${p.valor}" ${f.prioridad === p.valor ? 'selected' : ''}>${p.valor}. ${esc(p.texto)}</option>`).join('')}</select></label>
        <label class="campo"><span>Asignación</span><select name="asignacion">
          <option value="todos" ${f.asignacion === 'todos' ? 'selected' : ''}>Todos</option>
          <option value="sin" ${f.asignacion === 'sin' ? 'selected' : ''}>Sin asignar</option>
          <option value="con" ${f.asignacion === 'con' ? 'selected' : ''}>Asignados</option></select></label>`;
    }

    async function consultar() {
      let q = sb.from('tickets')
        .select('*, localidad:localidades!tickets_localidad_id_organizacion_id_fkey(codigo, nombre_comercial)')
        .gte('fecha', `${f.desde}T00:00:00-06:00`).lte('fecha', `${f.hasta}T23:59:59.999-06:00`)
        .order('fecha', { ascending: false }).limit(500);
      if (f.org) q = q.eq('organizacion_id', f.org);
      if (f.loc) q = q.eq('localidad_id', f.loc);
      if (f.modulo === 'general') q = q.is('modulo_id', null);
      else if (f.modulo) q = q.eq('modulo_id', Number(f.modulo));
      if (f.prioridad) q = q.eq('prioridad', f.prioridad);
      if (f.asignacion === 'sin') q = q.is('recurso_id', null);
      if (f.asignacion === 'con') q = q.not('recurso_id', 'is', null);
      const { data, error } = await q;
      if (error) { pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      tickets = data;
      await cargarNombres(tickets.map((t) => t.localidad_id));
      if (actual && !tickets.some((t) => t.id === actual.id)) actual = null;
      if (!actual && tickets.length) actual = tickets.find((t) => !t.recurso_id) || tickets[0];
      pintarMaestro();
      await abrir(actual ? tickets.find((t) => t.id === actual.id) : null);
    }

    // Nombres de los usuarios de las localidades consultadas (para mostrar el recurso asignado).
    async function cargarNombres(locs) {
      const faltan = [...new Set(locs)].filter((l) => !(`loc${l}` in nombres));
      await Promise.all(faltan.map(async (l) => {
        const { data } = await sb.rpc('recursos_localidad', { p_localidad: l });
        nombres[`loc${l}`] = data || [];
        (data || []).forEach((r) => { nombres[r.id] = r; });
      }));
    }
    const nombreUsuario = (id) => { const r = nombres[id]; return r ? r.nombre || r.usuario : ''; };

    // ---------- Maestro ----------
    function pintarMaestro() {
      const sin = tickets.filter((t) => !t.recurso_id).length;
      pMae.innerHTML = `
        <header class="tk-bandeja-cab">
          <h2>Tickets <small>${tickets.length}</small></h2>
          <div class="ta-totales"><span class="ta-total sin"><b>${sin}</b> sin asignar</span><span class="ta-total con"><b>${tickets.length - sin}</b> asignados</span></div>
        </header>
        <div class="ta-tabla">
          <table>
            <thead><tr><th>Ticket</th><th>Fecha</th><th>Solicitante</th><th>Módulo</th><th>Requerimiento</th><th>Prioridad</th><th>Estado</th><th>Recurso asignado</th><th>Entrega</th><th><span class="oculto">Acciones</span></th></tr></thead>
            <tbody>
              ${tickets.map((t) => `
                <tr class="${actual && actual.id === t.id ? 'actual' : ''}" data-ticket="${t.id}" tabindex="0">
                  <td class="fuerte"><i class="tk-franja-celda ${prioridad(t.prioridad).clase}" aria-hidden="true"></i>${esc(t.numero)}</td>
                  <td>${esc(fechaCorta(t.fecha))}</td>
                  <td>${esc(t.usuario || '')}</td>
                  <td>${esc(modulo(t.modulo_id)?.siglas || 'Todos')}</td>
                  <td class="ta-desc" title="${esc(t.descripcion)}">${esc(t.descripcion)}</td>
                  <td>${marcaPrioridad(t.prioridad)}</td>
                  <td>${marcaEstado(t.estado)}</td>
                  <td>${t.recurso_id ? `<span class="tk-persona"><span class="tk-avatar">${esc(iniciales(nombreUsuario(t.recurso_id)))}</span>${esc(nombreUsuario(t.recurso_id))}</span>` : '<span class="ta-sin">Sin asignar</span>'}</td>
                  <td class="${t.fecha_entrega && t.fecha_entrega < hoy() && t.estado < 6 ? 'ta-vencido' : ''}">${esc(fechaDia(t.fecha_entrega)) || '—'}</td>
                  ${window.TICKETS.botones(t, { modificar: editable })}
                </tr>`).join('') || '<tr><td colspan="10" class="tk-vacio"><i class="ti ti-inbox" aria-hidden="true"></i>No hay tickets con esos parámetros.</td></tr>'}
            </tbody>
          </table>
        </div>`;
    }

    async function abrir(t) {
      actual = t;
      asignaciones = [];
      procesos = [];
      recursos = [];
      editando = null;
      modificando = false;
      if (t) {
        const [a, p] = await Promise.all([
          sb.from('ticket_asignaciones').select('*').eq('ticket_id', t.id).order('fecha', { ascending: false }),
          sb.from('ticket_procesos').select('*').eq('ticket_id', t.id).order('numero'),
          cargarNombres([t.localidad_id])
        ]);
        asignaciones = a.data || [];
        procesos = p.data || [];
        recursos = nombres[`loc${t.localidad_id}`] || [];
      }
      pintarDetalle();
      pMae.querySelectorAll('tr[data-ticket]').forEach((tr) => tr.classList.toggle('actual', !!t && tr.dataset.ticket === String(t.id)));
    }

    // ---------- Detalle ----------
    function pintarDetalle() {
      const t = actual;
      if (!t) {
        pDet.innerHTML = '<div class="tk-vacio ta-elige"><i class="ti ti-hand-click" aria-hidden="true"></i>Elige un ticket del maestro para asignarlo.</div>';
        return;
      }
      const dis = editable ? '' : 'disabled';
      const vig = asignaciones[0];
      const mod = modificando && vig;
      pDet.innerHTML = `
        <div class="tk-form ta-form">
          <header class="tk-titulo">
            <span class="tk-icono"><i class="ti ti-ticket" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>${t.recurso_id ? 'Reasignar ticket' : 'Asignar ticket'}</small><h2>${esc(t.numero)}</h2></div>
            <div class="tk-marcas">${marcaEstado(t.estado)}${marcaPrioridad(t.prioridad)}</div>
          </header>
          <div class="ta-det-grid">
          <div class="ta-col">
          <h3 class="ta-col-titulo"><i class="ti ti-file-description" aria-hidden="true"></i> Datos del ticket</h3>
          <dl class="tk-datos ta-datos">
            <div><dt><i class="ti ti-user" aria-hidden="true"></i> Solicitante</dt><dd>${esc(t.usuario || '')}</dd></div>
            <div><dt><i class="ti ti-clock" aria-hidden="true"></i> Fecha del ticket</dt><dd>${esc(fechaHora(t.fecha))}</dd></div>
            <div><dt><i class="ti ti-map-pin" aria-hidden="true"></i> Localidad</dt><dd title="${esc(t.localidad?.nombre_comercial || '')}">${esc(t.localidad ? `${t.localidad.codigo} · ${t.localidad.nombre_comercial}` : '')}</dd></div>
            <div><dt><i class="ti ti-apps" aria-hidden="true"></i> Módulo</dt><dd>${esc(modulo(t.modulo_id)?.descripcion || 'Todos los módulos')}</dd></div>
            <div><dt><i class="ti ti-user-check" aria-hidden="true"></i> Recurso asignado</dt><dd>${esc(nombreUsuario(t.recurso_id) || 'Sin asignar')}</dd></div>
            <div><dt><i class="ti ti-calendar-due" aria-hidden="true"></i> Entrega estimada</dt><dd class="${t.fecha_entrega && t.fecha_entrega < hoy() && t.estado < 6 ? 'ta-vencido' : ''}">${esc(fechaDia(t.fecha_entrega)) || '—'}</dd></div>
          </dl>
          <div class="ta-requerimiento"><span>Requerimiento</span><p>${esc(t.descripcion)}</p></div>
          <div class="tk-historial ta-historial">
            <span>Historial de asignaciones <small class="tk-tenue">${asignaciones.length || ''}</small></span>
            ${asignaciones.length ? `<ol>
              ${asignaciones.map((a, i) => `
                <li>
                  <span class="tk-punto-color ${i === 0 ? 'e3' : 'e1'}" aria-hidden="true"></span>
                  <div><b>${esc(nombreUsuario(a.recurso_id) || 'Usuario')}</b>${i === 0 ? ' <span class="ta-vigente">vigente</span>' : ''}
                    <small>${esc(fechaHora(a.fecha))} · asignó ${esc(a.asignado_por || '')}${a.fecha_entrega ? ` · entrega ${esc(fechaDia(a.fecha_entrega))}` : ''}</small>
                    ${a.modificado_en ? `<small>Modificada por ${esc(a.modificado_por || '')} el ${esc(fechaHora(a.modificado_en))}</small>` : ''}
                    ${a.observaciones ? `<small class="ta-obs">${esc(a.observaciones)}</small>` : ''}</div>
                </li>`).join('')}
            </ol>` : '<p class="tk-tenue">El ticket todavía no tiene asignaciones.</p>'}
          </div>
          </div>

          <div class="ta-col">
          <form class="ta-asignar-form" novalidate>
          <fieldset class="rp-seccion ta-asignar" ${dis}>
            <legend><i class="ti ${mod ? 'ti-pencil' : 'ti-user-check'}" aria-hidden="true"></i> ${mod ? 'Modificar asignación vigente' : t.recurso_id ? 'Reasignación' : 'Asignación'}</legend>
            ${editable && vig ? `<div class="ta-modo">${mod
              ? '<span>Corrige la asignación vigente sin crear una nueva.</span><button type="button" class="rp-enlace" data-modo-asignacion="reasignar">Reasignar en su lugar</button>'
              : '<span>¿Solo corregir la asignación vigente?</span><button type="button" class="rp-enlace" data-modo-asignacion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar asignación</button>'}</div>` : ''}
            <div class="ta-asignar-campos">
              <label class="campo"><span>Usuario asignado *</span>
                <select name="recurso_id" required><option value="">Seleccionar usuario…</option>${recursos.map((r) => `<option value="${r.id}" ${(mod ? vig.recurso_id : t.recurso_id) === r.id ? 'selected' : ''}>${esc(r.nombre || r.usuario)}${r.usuario ? ` (${esc(r.usuario)})` : ''}</option>`).join('')}</select></label>
              <label class="campo"><span>Fecha estimada de entrega</span><input type="date" name="fecha_entrega" value="${esc((mod ? vig.fecha_entrega : t.fecha_entrega) || '')}" ${mod ? '' : `min="${hoy()}"`}></label>
              ${mod
                ? `<div class="ta-auto"><span>Fecha de asignación</span><b>${esc(fechaHora(vig.fecha))}</b><small>No cambia</small></div>
              <div class="ta-auto"><span>Asignado por</span><b>${esc(vig.asignado_por || '')}</b><small>No cambia</small></div>`
                : `<div class="ta-auto"><span>Fecha de asignación</span><b data-reloj>${esc(fechaHora(new Date()))}</b><small>Se graba al asignar</small></div>
              <div class="ta-auto"><span>Asignado por</span><b>${esc((yo.usuario || '').toUpperCase())}</b><small>Usuario actual</small></div>`}
            </div>
            <label class="campo"><span>Descripción / observaciones de la asignación</span>
              <textarea name="observaciones" rows="3" placeholder="Instrucciones para el recurso, alcance, plazos…">${mod ? esc(vig.observaciones || '') : ''}</textarea></label>
            <p class="modal-error tk-error" role="alert"></p>
            <div class="ta-boton">
              ${editable ? `<button type="submit" class="boton primario-sm"><i class="ti ${mod ? 'ti-device-floppy' : 'ti-user-check'}" aria-hidden="true"></i> ${mod ? 'Guardar modificación' : t.recurso_id ? 'Reasignar' : 'Asignar'}</button>` : '<span class="tk-aviso"><i class="ti ti-lock" aria-hidden="true"></i> Solo un administrador puede asignar tickets</span>'}
            </div>
          </fieldset>
          </form>
          </div>

          <div class="ta-col">${seccionProcesos(t)}</div>
          </div>
        </div>`;
    }

    // ---------- Procesos de la solución ----------
    function seccionProcesos(t) {
      const gestiona = editable || [t.perfil_id, t.recurso_id].includes(yo.id);
      const p = procesos.find((x) => x.id === editando);
      const puedeForm = p ? gestiona || p.responsable_id === yo.id : gestiona;
      const fin = procesos.filter((x) => x.estado === 'FINALIZADO').length;
      const pct = procesos.length ? Math.round((fin / procesos.length) * 100) : 0;
      const responsable = p ? p.responsable_id : t.recurso_id;
      return `
        <section class="ta-procesos">
          <div class="ta-proc-cab">
            <h3><i class="ti ti-list-numbers" aria-hidden="true"></i> Procesos de la solución</h3>
            ${procesos.length ? `<span class="ta-avance" title="${fin} de ${procesos.length} finalizados"><i style="width:${pct}%"></i></span><small>${fin} de ${procesos.length} finalizados</small>` : ''}
          </div>
          ${procesos.length ? `<ol class="ta-proc-lista">
            ${procesos.map((x) => {
              const vencido = x.fecha_entrega && x.fecha_entrega < hoy() && x.estado !== 'FINALIZADO';
              const puede = gestiona || x.responsable_id === yo.id;
              return `
                <li class="${editando === x.id ? 'editando' : ''}">
                  <span class="ta-proc-num ${claseProceso(x.estado)}">${x.estado === 'FINALIZADO' ? '<i class="ti ti-check" aria-hidden="true"></i>' : x.numero}</span>
                  <div class="ta-proc-texto">
                    <div class="ta-proc-linea"><b>${x.numero}. ${esc(x.descripcion)}</b><span class="ta-proc-estado ${claseProceso(x.estado)}">${esc(x.estado)}</span>
                      ${puede ? `<button type="button" class="icono-boton" data-editar-proceso="${x.id}" title="Modificar el proceso ${x.numero}"><i class="ti ti-pencil" aria-hidden="true"></i></button>` : ''}</div>
                    <small><span class="${vencido ? 'ta-vencido' : ''}"><i class="ti ti-calendar-due" aria-hidden="true"></i> ${x.fecha_entrega ? `Entrega ${esc(fechaDia(x.fecha_entrega))}${vencido ? ' · vencido' : ''}` : 'Sin fecha de entrega'}</span>
                      <span><i class="ti ti-user" aria-hidden="true"></i> ${esc(nombreUsuario(x.responsable_id) || 'Sin responsable')}</span>
                      <span><i class="ti ti-clock" aria-hidden="true"></i> ${esc(x.estado.toLowerCase())} desde ${esc(fechaHora(x.fecha_estado))}</span></small>
                    ${x.observaciones ? `<small class="ta-obs">${esc(x.observaciones)}</small>` : ''}
                  </div>
                </li>`;
            }).join('')}
          </ol>` : '<p class="tk-tenue">Todavía no hay procesos. Divide la solución en pasos con su responsable y fecha de entrega.</p>'}
          ${puedeForm ? `
            <form class="ta-proc-form" novalidate>
              <div class="ta-proc-campos">
                <label class="campo ta-proc-desc"><span>${p ? `Proceso ${p.numero}` : `Proceso ${(procesos[procesos.length - 1]?.numero || 0) + 1}`} · descripción *</span><input name="descripcion" value="${esc(p ? p.descripcion : '')}" maxlength="300" placeholder="Qué se hará en este proceso" ${p && !gestiona ? 'disabled' : ''}></label>
                <label class="campo"><span>Fecha estimada de entrega</span><input type="date" name="fecha_entrega" value="${esc(p ? p.fecha_entrega || '' : t.fecha_entrega || '')}" ${p && !gestiona ? 'disabled' : ''}></label>
                <label class="campo"><span>Responsable</span><select name="responsable_id" ${p && !gestiona ? 'disabled' : ''}><option value="">Sin responsable</option>${recursos.map((r) => `<option value="${r.id}" ${responsable === r.id ? 'selected' : ''}>${esc(r.nombre || r.usuario)}</option>`).join('')}</select></label>
                <label class="campo"><span>Estado</span><select name="estado">${ESTADOS_PROCESO.map((e) => `<option ${(p ? p.estado : 'ASIGNADO') === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
                <div class="ta-auto"><span>Fecha del estado</span><b>${esc(p ? fechaHora(p.fecha_estado) : 'Al guardar')}</b><small>Se graba al cambiar el estado</small></div>
                <label class="campo ta-proc-obs"><span>Observaciones</span><input name="observaciones" value="${esc(p ? p.observaciones || '' : '')}" maxlength="500" placeholder="Avance, pendientes, notas…"></label>
              </div>
              <p class="modal-error tk-error" role="alert"></p>
              <div class="ta-boton">
                ${p ? '<button type="button" class="boton secundario-sm" data-cancelar-proceso>Cancelar</button>' : ''}
                <button type="submit" class="boton ${p ? 'primario-sm' : 'secundario-sm'}"><i class="ti ${p ? 'ti-device-floppy' : 'ti-plus'}" aria-hidden="true"></i> ${p ? 'Guardar proceso' : 'Agregar proceso'}</button>
              </div>
            </form>` : ''}
        </section>`;
    }

    async function guardarProceso(form) {
      const error = form.querySelector('.modal-error');
      const el = form.elements;
      const d = { estado: el.estado.value, observaciones: el.observaciones.value };
      if (!el.descripcion.disabled) {
        d.descripcion = el.descripcion.value.trim();
        d.fecha_entrega = el.fecha_entrega.value || null;
        d.responsable_id = el.responsable_id.value || null;
        if (!d.descripcion) { error.textContent = 'Escribe la descripción del proceso.'; el.descripcion.focus(); return; }
      }
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      error.textContent = '';
      const r = editando
        ? await sb.from('ticket_procesos').update(d).eq('id', editando)
        : await sb.from('ticket_procesos').insert({ ...d, ticket_id: actual.id });
      boton.disabled = false;
      if (r.error) {
        error.textContent = /ticket_procesos/.test(r.error.message) && /schema cache|does not exist/.test(r.error.message) ? 'Falta instalar el script 29 (procesos de la solución) en Supabase.' : window.UI.traducirError(r.error);
        return;
      }
      window.FIN.aviso(editando ? 'Proceso guardado' : 'Proceso agregado');
      editando = null;
      await abrir(actual);
    }

    async function asignar(form) {
      const error = form.querySelector('.modal-error');
      const recurso = form.elements.recurso_id.value;
      if (!recurso) { error.textContent = 'Elige el usuario que atenderá el ticket.'; form.elements.recurso_id.focus(); return; }
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      error.textContent = '';
      const d = { recurso_id: recurso, observaciones: form.elements.observaciones.value, fecha_entrega: form.elements.fecha_entrega.value || null };
      const mod = modificando && asignaciones[0];
      const { error: err } = mod
        ? await sb.from('ticket_asignaciones').update(d).eq('id', asignaciones[0].id)
        : await sb.from('ticket_asignaciones').insert({ ...d, ticket_id: actual.id });
      boton.disabled = false;
      if (err) {
        error.textContent = /fecha_entrega/.test(err.message) ? 'Falta instalar el script 29 (fecha de entrega y procesos) en Supabase.'
          : mod && /policy|permission|0 rows|JSON object/.test(err.message) ? 'Falta instalar el script 32 (modificar y eliminar tickets) en Supabase.' : window.UI.traducirError(err);
        return;
      }
      window.FIN.aviso(mod ? `Asignación del ticket ${actual.numero} modificada` : `Ticket ${actual.numero} asignado a ${nombreUsuario(recurso)}`);
      await consultar();
    }

    cont.addEventListener('change', (e) => {
      if (!e.target.closest('#ta-filtros')) return;
      const n = e.target.name;
      const val = e.target.value;
      if (n === 'org') { f.org = Number(val); f.loc = null; pintarFiltros(); }
      else if (n === 'loc') f.loc = val ? Number(val) : null;
      else if (n === 'prioridad') f.prioridad = Number(val);
      else f[n] = val;
      if (n === 'desde' || n === 'hasta') {
        if (f.desde && f.hasta && f.hasta < f.desde) { if (n === 'desde') f.hasta = f.desde; else f.desde = f.hasta; }
        pintarFiltros();
      }
      if (f.desde && f.hasta) consultar();
    });
    cont.addEventListener('click', (e) => {
      const bmod = e.target.closest('[data-modificar]');
      if (bmod) {
        return abrir(tickets.find((x) => String(x.id) === bmod.dataset.modificar)).then(() => {
          if (asignaciones.length) { modificando = true; pintarDetalle(); }
          pDet.querySelector('[name=recurso_id]')?.focus();
        });
      }
      const bm = e.target.closest('[data-eliminar]');
      if (bm) {
        const t = tickets.find((x) => String(x.id) === bm.dataset.eliminar);
        return window.TICKETS.eliminar(t).then(async (ok) => { if (ok) { if (actual && actual.id === t.id) actual = null; await consultar(); } });
      }
      const mo = e.target.closest('[data-modo-asignacion]');
      if (mo) { modificando = mo.dataset.modoAsignacion === 'modificar'; return pintarDetalle(); }
      const ep = e.target.closest('[data-editar-proceso]');
      if (ep) { editando = Number(ep.dataset.editarProceso); pintarDetalle(); pDet.querySelector('.ta-proc-form')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
      if (e.target.closest('[data-cancelar-proceso]')) { editando = null; return pintarDetalle(); }
      const tr = e.target.closest('tr[data-ticket]');
      if (tr) abrir(tickets.find((t) => String(t.id) === tr.dataset.ticket));
    });
    cont.addEventListener('keydown', (e) => {
      const tr = e.target.closest('tr[data-ticket]');
      if (tr && e.key === 'Enter') abrir(tickets.find((t) => String(t.id) === tr.dataset.ticket));
    });
    cont.addEventListener('submit', (e) => {
      if (e.target.matches('.ta-asignar-form')) { e.preventDefault(); return asignar(e.target); }
      if (e.target.matches('.ta-proc-form')) { e.preventDefault(); return guardarProceso(e.target); }
    });

    const reloj = setInterval(() => {
      if (!pDet.isConnected) return clearInterval(reloj);
      const c = pDet.querySelector('[data-reloj]');
      if (c) c.textContent = fechaHora(new Date());
    }, 1000);

    iniciar();
  };
})();
