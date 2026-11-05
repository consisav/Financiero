// Tickets · Generación (maestro - detalle), con el mismo diseño de Asignación:
//   Arriba, los parámetros de consulta: organización, localidad, fecha inicial y final, módulo,
//   prioridad y estado.
//   Maestro: los tickets que cumplen esos parámetros, con búsqueda y el botón de nuevo ticket.
//   Detalle: cabecera (número, estado, prioridad y acciones), gráfica del proceso y tres
//   columnas: datos del ticket y requerimiento (organización, localidad, solicitante, fecha,
//   módulo y descripción), gestión (prioridad, estado, recurso asignado y adjuntos) e historial.
(function () {
  const { esc } = window.UI;

  const BUCKET = 'tickets';
  const ADJUNTO_MAX = 10 * 1024 * 1024;
  const PRIORIDADES = [
    { valor: 1, texto: 'Normal', clase: 'p1' },
    { valor: 2, texto: 'Urgente', clase: 'p2' },
    { valor: 3, texto: 'Importante', clase: 'p3' },
    { valor: 4, texto: 'Urgente no importante', clase: 'p4' },
    { valor: 5, texto: 'Importante y urgente', clase: 'p5' }
  ];
  const prioridad = (v) => PRIORIDADES.find((p) => p.valor === v) || PRIORIDADES[0];
  const fechaHora = (f) => new Date(f).toLocaleString('es-GT', {
    timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).replace(',', '');
  const fechaCorta = (f) => new Date(f).toLocaleString('es-GT', {
    timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
  }).replace(',', '');
  const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
  const tamano = (b) => b == null ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
  const iconoArchivo = (tipo = '') => tipo.startsWith('image/') ? 'ti-photo' : tipo === 'application/pdf' ? 'ti-file-type-pdf' : 'ti-file';
  const iniciales = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?';
  const marcaPrioridad = (v) => `<span class="tk-prioridad ${prioridad(v).clase}">${esc(prioridad(v).texto)}</span>`;

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['tickets-generacion'] = function (cont) {
    const sb = window.FIN.sb;
    const yo = window.FIN.perfil();
    let estados = [];
    let recursos = [];
    let modulos = [];       // módulos principales del sistema
    let tickets = [];
    let org = null;
    let loc = null;
    let actual = null;      // ticket abierto (null = nuevo)
    let adjuntos = [];      // adjuntos guardados del ticket abierto
    let movimientos = [];
    let pendientes = [];    // archivos elegidos que se suben al guardar
    let buscar = '';
    let organizaciones = [];
    let localidades = [];
    const f = {
      org: yo.organizacion_id || null, loc: yo.localidad_id || null,
      desde: hoy().slice(0, 8) + '01', hasta: hoy(), modulo: '', prioridad: 0, estado: 0
    };

    cont.innerHTML = `
      <div class="ta-espacio ta-apilado tg-espacio">
        <section class="ta-filtros" id="tg-filtros"></section>
        <div class="ta-cuerpo">
          <section class="tk-bandeja ta-maestro" id="tk-lista"></section>
          <section class="tk-detalle ta-detalle" id="tk-ticket"></section>
        </div>
      </div>`;
    const espacio = cont.querySelector('.ta-espacio');
    const pFil = cont.querySelector('#tg-filtros');
    const pTicket = cont.querySelector('#tk-ticket');
    const pLista = cont.querySelector('#tk-lista');

    const recurso = (id) => recursos.find((x) => x.id === id);
    const nombreRecurso = (id) => { const r = recurso(id); return r ? r.nombre || r.usuario : ''; };
    const modulo = (id) => modulos.find((x) => x.id === id);
    const nombreModulo = (id) => { const m = modulo(id); return m ? m.descripcion : 'Todos'; };
    const nombreEstado = (c) => (estados.find((e) => e.codigo === c) || {}).nombre || '';
    const marcaEstado = (c) => `<span class="tk-estado e${c}">${esc(nombreEstado(c))}</span>`;
    const puedeEditar = (t) => !t || window.FIN.puedeEditarCatalogos() || [t.perfil_id, t.recurso_id].includes(yo.id);

    // El espacio de trabajo ocupa el alto visible de la ventana, debajo del menú.
    function ajustarAlto() {
      if (!espacio.isConnected) return window.removeEventListener('resize', ajustarAlto);
      const arriba = espacio.getBoundingClientRect().top + window.scrollY;
      const alto = Math.max(600, window.innerHeight - arriba - 16);
      espacio.style.setProperty('--tk-alto', `${alto}px`);
      // Lo que sobra debajo (márgenes del contenedor) se descuenta para no desplazar la página.
      const sobra = document.documentElement.scrollHeight - window.innerHeight;
      if (sobra > 0 && alto - sobra >= 600) espacio.style.setProperty('--tk-alto', `${alto - sobra}px`);
    }
    window.addEventListener('resize', ajustarAlto);

    async function iniciar() {
      ajustarAlto();
      const [e, r, o, l, md, os, ls] = await Promise.all([
        sb.from('estados_ticket').select('*').eq('activo', true).order('codigo'),
        sb.rpc('recursos_ticket'),
        yo.organizacion_id ? sb.from('organizaciones').select('codigo, nombre').eq('id', yo.organizacion_id).maybeSingle() : { data: null },
        yo.localidad_id ? sb.from('localidades').select('codigo, nombre_comercial').eq('id', yo.localidad_id).maybeSingle() : { data: null },
        sb.from('modulos_sistema').select('id, codigo, siglas, descripcion').is('modulo_mayor_id', null).eq('activo', true).order('codigo'),
        sb.from('organizaciones').select('id, codigo, nombre').eq('activo', true).order('codigo'),
        sb.from('localidades').select('id, codigo, correlativo, nombre_comercial, organizacion_id').eq('activo', true).order('organizacion_id').order('correlativo')
      ]);
      const err = e.error || r.error;
      if (err) {
        espacio.innerHTML = `<section class="panel"><p class="vacio">${/estados_ticket|recursos_ticket/.test(err.message) ? 'Falta instalar el script 21 (tickets) en Supabase.' : esc(err.message)}</p></section>`;
        return;
      }
      estados = e.data;
      recursos = r.data || [];
      org = o.data;
      loc = l.data;
      modulos = md.data || [];
      organizaciones = os.data || [];
      localidades = ls.data || [];
      pintarFiltros();
      await cargarLista();
      abrir(null);
    }

    // ---------- Parámetros de consulta ----------
    function pintarFiltros() {
      const locs = localidades.filter((x) => x.organizacion_id === f.org);
      pFil.innerHTML = `
        <div class="ta-titulo"><span class="tk-icono"><i class="ti ti-ticket" aria-hidden="true"></i></span><div><small>Tickets</small><h2>Generación</h2></div></div>
        <label class="campo"><span>Organización</span><select name="org">${organizaciones.map((o) => `<option value="${o.id}" ${f.org === o.id ? 'selected' : ''}>${o.codigo} · ${esc(o.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Localidad</span><select name="loc"><option value="">Todas</option>${locs.map((x) => `<option value="${x.id}" ${f.loc === x.id ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre_comercial)}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Módulo</span><select name="modulo"><option value="">Todos</option><option value="general" ${f.modulo === 'general' ? 'selected' : ''}>Todos los módulos (general)</option>${modulos.map((m) => `<option value="${m.id}" ${String(f.modulo) === String(m.id) ? 'selected' : ''}>${esc(m.siglas)} · ${esc(m.descripcion)}</option>`).join('')}</select></label>
        <label class="campo"><span>Prioridad</span><select name="prioridad"><option value="0">Todas</option>${PRIORIDADES.map((p) => `<option value="${p.valor}" ${f.prioridad === p.valor ? 'selected' : ''}>${p.valor}. ${esc(p.texto)}</option>`).join('')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado"><option value="0">Todos</option>${estados.map((x) => `<option value="${x.codigo}" ${f.estado === x.codigo ? 'selected' : ''}>${x.codigo}. ${esc(x.nombre)}</option>`).join('')}</select></label>`;
    }

    async function cargarLista() {
      let q = sb.from('tickets')
        .select('*, organizacion:organizaciones(codigo, nombre), localidad:localidades!tickets_localidad_id_organizacion_id_fkey(codigo, nombre_comercial)')
        .gte('fecha', `${f.desde}T00:00:00-06:00`).lte('fecha', `${f.hasta}T23:59:59.999-06:00`)
        .order('fecha', { ascending: false }).limit(500);
      if (f.org) q = q.eq('organizacion_id', f.org);
      if (f.loc) q = q.eq('localidad_id', f.loc);
      if (f.modulo === 'general') q = q.is('modulo_id', null);
      else if (f.modulo) q = q.eq('modulo_id', Number(f.modulo));
      if (f.prioridad) q = q.eq('prioridad', f.prioridad);
      if (f.estado) q = q.eq('estado', f.estado);
      const { data, error } = await q;
      if (error) { pLista.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      tickets = data;
      pintarLista();
    }

    // ---------- Bandeja ----------
    function pintarLista() {
      const q = buscar.trim().toLowerCase();
      const filas = tickets.filter((t) => !q || [t.numero, t.descripcion, t.usuario, nombreModulo(t.modulo_id), nombreEstado(t.estado), prioridad(t.prioridad).texto, nombreRecurso(t.recurso_id)]
        .some((v) => String(v || '').toLowerCase().includes(q)));
      pLista.innerHTML = `
        <header class="tk-bandeja-cab tg-cab">
          <h2>Tickets <small>${filas.length === tickets.length ? tickets.length : `${filas.length} de ${tickets.length}`}</small></h2>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar ticket, requerimiento, módulo…" value="${esc(buscar)}" aria-label="Buscar tickets"></label>
          <button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo ticket</button>
        </header>
        <div class="ta-tabla">
          <table>
            <thead><tr><th>Ticket</th><th>Fecha</th><th>Solicitante</th><th>Módulo</th><th>Requerimiento</th><th>Prioridad</th><th>Estado</th><th>Recurso asignado</th><th><span class="oculto">Acciones</span></th></tr></thead>
            <tbody>
              ${filas.map((t) => `
                <tr class="${actual && actual.id === t.id ? 'actual' : ''}" data-ticket="${t.id}" tabindex="0">
                  <td class="fuerte"><i class="tk-franja-celda ${prioridad(t.prioridad).clase}" aria-hidden="true"></i>${esc(t.numero)}</td>
                  <td>${esc(fechaCorta(t.fecha))}</td>
                  <td>${esc(t.usuario || '')}</td>
                  <td>${esc(modulo(t.modulo_id)?.siglas || 'Todos')}</td>
                  <td class="ta-desc" title="${esc(t.descripcion)}">${esc(t.descripcion)}</td>
                  <td>${marcaPrioridad(t.prioridad)}</td>
                  <td>${marcaEstado(t.estado)}</td>
                  <td>${t.recurso_id && nombreRecurso(t.recurso_id) ? `<span class="tk-persona"><span class="tk-avatar">${esc(iniciales(nombreRecurso(t.recurso_id)))}</span>${esc(nombreRecurso(t.recurso_id))}</span>` : '<span class="ta-sin">Sin asignar</span>'}</td>
                  ${window.TICKETS.botones(t, { textoModificar: puedeEditar(t) ? 'Modificar' : 'Ver' })}
                </tr>`).join('') || `<tr><td colspan="9" class="tk-vacio"><i class="ti ti-inbox" aria-hidden="true"></i>${tickets.length ? 'Ningún ticket coincide con la búsqueda.' : 'No hay tickets con esos parámetros.'}</td></tr>`}
            </tbody>
          </table>
        </div>`;
    }

    async function abrir(t) {
      actual = t;
      pendientes = [];
      adjuntos = [];
      movimientos = [];
      if (t) {
        const [a, m] = await Promise.all([
          sb.from('ticket_adjuntos').select('*').eq('ticket_id', t.id).order('creado_en'),
          sb.from('ticket_movimientos').select('*').eq('ticket_id', t.id).order('fecha')
        ]);
        adjuntos = a.data || [];
        movimientos = m.data || [];
      }
      pintarTicket();
      pintarLista();
    }

    // ---------- Ticket ----------
    function pintarTicket() {
      const t = actual;
      const editable = puedeEditar(t);
      const dis = editable ? '' : 'disabled';
      const estado = t ? t.estado : 1;
      const prio = t ? t.prioridad : 1;
      const orgTexto = t ? `${t.organizacion?.codigo} · ${t.organizacion?.nombre}` : org ? `${org.codigo} · ${org.nombre}` : 'Sin organización';
      const locTexto = t ? `${t.localidad?.codigo} · ${t.localidad?.nombre_comercial}` : loc ? `${loc.codigo} · ${loc.nombre_comercial}` : 'Sin localidad';
      pTicket.innerHTML = `
        <form class="tk-form ta-form tg-form" novalidate>
          <header class="tk-titulo">
            <span class="tk-icono"><i class="ti ti-ticket" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto">
              <small>${t ? (editable ? 'Modificando ticket' : 'Ticket (solo consulta)') : 'Nuevo ticket'}</small>
              <h2>${t ? esc(t.numero) : 'Se numera al generarlo'}</h2>
            </div>
            <div class="tk-marcas" data-marcas>${marcaEstado(estado)}${marcaPrioridad(prio)}</div>
            <div class="tk-titulo-acciones">
              ${editable && t ? '<button type="button" class="boton secundario-sm" data-accion="descartar" title="Descartar cambios"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Descartar</button>' : ''}
              ${editable ? `<button type="submit" class="boton primario-sm"><i class="ti ${t ? 'ti-device-floppy' : 'ti-send'}" aria-hidden="true"></i> ${t ? 'Guardar cambios' : 'Generar ticket'}</button>` : '<span class="tk-aviso"><i class="ti ti-lock" aria-hidden="true"></i> Solo quien lo creó, el recurso asignado o un administrador pueden modificarlo</span>'}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>

          <div class="tk-proceso" data-grafica>${grafica(estado)}</div>

          <div class="ta-det-grid">
            <div class="ta-col">
              <h3 class="ta-col-titulo"><i class="ti ti-file-description" aria-hidden="true"></i> Datos del ticket</h3>
              <dl class="tk-datos ta-datos">
                <div><dt><i class="ti ti-building" aria-hidden="true"></i> Organización</dt><dd title="${esc(orgTexto)}">${esc(orgTexto)}</dd></div>
                <div><dt><i class="ti ti-map-pin" aria-hidden="true"></i> Localidad</dt><dd title="${esc(locTexto)}">${esc(locTexto)}</dd></div>
                <div><dt><i class="ti ti-user" aria-hidden="true"></i> Solicitante</dt><dd>${esc(t ? t.usuario : (yo.usuario || '').toUpperCase())}</dd></div>
                <div><dt><i class="ti ti-clock" aria-hidden="true"></i> Fecha y hora</dt><dd data-reloj="${t ? '' : '1'}">${esc(fechaHora(t ? t.fecha : new Date()))}</dd></div>
              </dl>
              <label class="campo"><span>Módulo</span>
                <select name="modulo_id" ${dis}><option value="">Todos los módulos</option>${modulos.map((m) => `<option value="${m.id}" ${t && t.modulo_id === m.id ? 'selected' : ''}>${esc(m.siglas)} · ${esc(m.descripcion)}</option>`).join('')}</select></label>
              <label class="campo tg-descripcion"><span>Descripción del requerimiento *</span>
                <textarea name="descripcion" required ${dis} placeholder="Describe qué se necesita, dónde y para cuándo.">${esc(t ? t.descripcion : '')}</textarea></label>
            </div>

            <div class="ta-col">
              <h3 class="ta-col-titulo"><i class="ti ti-adjustments" aria-hidden="true"></i> Gestión</h3>
              <fieldset class="tk-prioridades" ${dis}>
                <legend>Prioridad</legend>
                ${PRIORIDADES.map((p) => `
                  <label class="tk-opcion-prio ${p.clase}" title="${p.valor}. ${esc(p.texto)}"><input type="radio" name="prioridad" value="${p.valor}" ${prio === p.valor ? 'checked' : ''}><span class="tk-punto-color ${p.clase}" aria-hidden="true"></span>${p.valor}. ${esc(p.texto)}</label>`).join('')}
              </fieldset>
              <div class="tk-dos">
                <label class="campo"><span>Estado</span>
                  <select name="estado" ${dis}>${estados.map((e) => `<option value="${e.codigo}" ${estado === e.codigo ? 'selected' : ''}>${e.codigo}. ${esc(e.nombre)}</option>`).join('')}</select></label>
                <label class="campo"><span>Recurso asignado</span>
                  <select name="recurso_id" ${dis}><option value="">Sin asignar</option>${recursos.map((r) => `<option value="${r.id}" ${t && t.recurso_id === r.id ? 'selected' : ''}>${esc(r.nombre || r.usuario)}${r.usuario ? ` (${esc(r.usuario)})` : ''}</option>`).join('')}</select></label>
              </div>
              <div class="campo">
                <span>Adjuntos ${adjuntos.length + pendientes.length ? `<small class="tk-tenue">(${adjuntos.length + pendientes.length})</small>` : ''}</span>
                <div class="tk-adjuntos">
                  ${editable ? `
                    <label class="tk-zona" data-zona title="Arrastra archivos aquí o haz clic para elegirlos (máximo 10 MB cada uno)">
                      <i class="ti ti-cloud-upload" aria-hidden="true"></i><span><b>Adjuntar</b> · arrastra o elige</span>
                      <input type="file" multiple hidden data-archivos>
                    </label>` : ''}
                  ${adjuntos.map((a) => `
                    <div class="tk-adjunto">
                      <button type="button" class="tk-archivo" data-ver="${a.id}" title="Abrir ${esc(a.nombre)} (${tamano(a.tamano)})"><i class="ti ${iconoArchivo(a.tipo)}" aria-hidden="true"></i><span>${esc(a.nombre)}</span></button>
                      ${editable ? `<button type="button" class="icono-boton" data-quitar-adjunto="${a.id}" aria-label="Quitar ${esc(a.nombre)}"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}
                    </div>`).join('')}
                  ${pendientes.map((x, i) => `
                    <div class="tk-adjunto pendiente" title="${esc(x.name)} · ${tamano(x.size)} · se sube al guardar">
                      <span class="tk-archivo"><i class="ti ${iconoArchivo(x.type)}" aria-hidden="true"></i><span>${esc(x.name)}</span></span>
                      <button type="button" class="icono-boton" data-quitar-pendiente="${i}" aria-label="Quitar ${esc(x.name)}"><i class="ti ti-x" aria-hidden="true"></i></button>
                    </div>`).join('')}
                  ${!adjuntos.length && !pendientes.length && !editable ? '<small class="tk-tenue">Sin archivos adjuntos.</small>' : ''}
                </div>
              </div>
            </div>

            <div class="ta-col">
              <h3 class="ta-col-titulo"><i class="ti ti-history" aria-hidden="true"></i> Historial</h3>
              <div class="tk-historial ta-historial">
                ${t ? `<ol>
                  ${movimientos.slice().reverse().map((m) => `
                    <li>
                      <span class="tk-punto-color e${m.estado}" aria-hidden="true"></span>
                      <div><b>${esc(nombreEstado(m.estado))}</b>${m.recurso_id && nombreRecurso(m.recurso_id) ? ` · ${esc(nombreRecurso(m.recurso_id))}` : ''}
                      <small>${esc(fechaHora(m.fecha))} · ${esc(m.usuario || '')}</small></div>
                    </li>`).join('')}
                </ol>` : '<p class="tk-tenue">El historial de estados se registra al generar el ticket.</p>'}
              </div>
            </div>
          </div>
        </form>`;
    }

    // Pasos del proceso: completados, el actual y los pendientes, con la fecha en que se alcanzó cada uno.
    function grafica(estado) {
      const llegada = {};
      movimientos.forEach((m) => { llegada[m.estado] = m.fecha; });
      return `
        <ol class="tk-pasos" aria-label="Estado del ticket: ${esc(nombreEstado(estado))}">
          ${estados.map((e) => {
            const clase = e.codigo < estado ? 'hecho' : e.codigo === estado ? 'actual' : '';
            return `
              <li class="tk-paso ${clase}" ${e.codigo === estado ? 'aria-current="step"' : ''} title="${esc(e.descripcion || '')}">
                <span class="tk-punto">${e.codigo < estado ? '<i class="ti ti-check" aria-hidden="true"></i>' : e.codigo}</span>
                <span class="tk-paso-nombre">${esc(e.nombre)}</span>
                <small>${llegada[e.codigo] && e.codigo <= estado ? esc(fechaCorta(llegada[e.codigo])) : ''}</small>
              </li>`;
          }).join('')}
        </ol>`;
    }

    // Al cambiar estado o prioridad, la cabecera y la gráfica se actualizan antes de guardar.
    function vistaPrevia(form) {
      const estado = Number(form.elements.estado.value);
      const prio = Number(form.querySelector('[name=prioridad]:checked').value);
      pTicket.querySelector('[data-marcas]').innerHTML = marcaEstado(estado) + marcaPrioridad(prio);
      pTicket.querySelector('[data-grafica]').innerHTML = grafica(estado);
    }

    // Lleva la vista al formulario del ticket y pone el cursor en la descripción.
    function enfocarDescripcion() {
      const ta = pTicket.querySelector('[name=descripcion]');
      if (!ta) return;
      pTicket.scrollIntoView({ behavior: 'smooth', block: 'start' });
      ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ta.focus({ preventScroll: true });
      ta.classList.add('tg-resalta');
      setTimeout(() => ta.classList.remove('tg-resalta'), 1600);
    }

    async function guardar(form) {
      try { await guardarTicket(form); } catch (err) {
        const msg = window.UI.traducirError(err);
        form.querySelector('.modal-error').textContent = msg;
        window.FIN.aviso(`No se generó el ticket: ${msg}`);
      }
    }
    async function guardarTicket(form) {
      const error = form.querySelector('.modal-error');
      const boton = form.querySelector('[type=submit]');
      const d = {
        descripcion: form.elements.descripcion.value.trim(),
        prioridad: Number(form.querySelector('[name=prioridad]:checked')?.value || 1),
        estado: Number(form.elements.estado.value),
        recurso_id: form.elements.recurso_id.value || null,
        modulo_id: form.elements.modulo_id.value ? Number(form.elements.modulo_id.value) : null
      };
      if (!d.descripcion) { error.textContent = 'Escribe la descripción del requerimiento.'; window.FIN.aviso('Escribe la descripción del requerimiento para generar el ticket'); return enfocarDescripcion(); }
      error.textContent = '';
      boton.disabled = true;
      try {
        const r = actual
          ? await sb.from('tickets').update(d).eq('id', actual.id).select('id').single()
          : await sb.from('tickets').insert(d).select('id').single();
        if (r.error) throw /modulo_id/.test(r.error.message) ? new Error('Falta instalar el script 23 (módulo del ticket) en Supabase.') : r.error;
        const id = r.data.id;
        let fallidos = 0;
        for (const f of pendientes) {
          const ruta = `${id}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
          const up = await sb.storage.from(BUCKET).upload(ruta, f, { contentType: f.type || 'application/octet-stream' });
          if (up.error) { fallidos++; continue; }
          const ins = await sb.from('ticket_adjuntos').insert({ ticket_id: id, ruta, nombre: f.name, tipo: f.type || null, tamano: f.size });
          if (ins.error) { fallidos++; await sb.storage.from(BUCKET).remove([ruta]); }
        }
        if (!actual && (f.hasta < hoy() || f.estado > 1)) { f.hasta = hoy(); f.estado = 0; pintarFiltros(); }
        await cargarLista();
        const t = tickets.find((x) => x.id === id) || (await sb.from('tickets').select('*, organizacion:organizaciones(codigo, nombre), localidad:localidades!tickets_localidad_id_organizacion_id_fkey(codigo, nombre_comercial)').eq('id', id).single()).data;
        window.FIN.aviso(`${actual ? 'Ticket guardado' : `Ticket ${t ? t.numero : ''} generado`}${fallidos ? ` · ${fallidos} adjunto(s) no se pudieron subir` : ''}`);
        await abrir(t || null);
      } catch (err) {
        error.textContent = window.UI.traducirError(err);
        window.FIN.aviso(`No se pudo guardar el ticket: ${error.textContent}`);
        error.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } finally {
        boton.disabled = false;
      }
    }

    function agregarArchivos(lista) {
      const archivos = [...lista];
      const grandes = archivos.filter((f) => f.size > ADJUNTO_MAX);
      pendientes.push(...archivos.filter((f) => f.size <= ADJUNTO_MAX));
      if (grandes.length) window.FIN.aviso(`${grandes.map((f) => f.name).join(', ')}: pesa más de 10 MB`);
      pintarConDatos();
    }

    cont.addEventListener('click', async (e) => {
      const bmod = e.target.closest('[data-modificar]');
      if (bmod) {
        await abrir(tickets.find((x) => String(x.id) === bmod.dataset.modificar));
        return pTicket.querySelector('[name=descripcion]')?.focus();
      }
      const bm = e.target.closest('[data-eliminar]');
      if (bm) {
        const t = tickets.find((x) => String(x.id) === bm.dataset.eliminar);
        return window.TICKETS.eliminar(t).then(async (ok) => { if (ok) { if (actual && actual.id === t.id) actual = null; await cargarLista().then(() => { if (!actual) abrir(null); }); } });
      }
      if (e.target.closest('[data-accion=nuevo]')) { await abrir(null); return enfocarDescripcion(); }
      if (e.target.closest('[data-accion=descartar]')) return abrir(actual);
      const fila = e.target.closest('[data-ticket]');
      if (fila) return abrir(tickets.find((x) => String(x.id) === fila.dataset.ticket));
      const ver = e.target.closest('[data-ver]');
      if (ver) {
        const a = adjuntos.find((x) => String(x.id) === ver.dataset.ver);
        const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(a.ruta, 600);
        if (error) return window.FIN.aviso('No se pudo abrir el adjunto');
        return window.open(data.signedUrl, '_blank', 'noopener');
      }
      const qp = e.target.closest('[data-quitar-pendiente]');
      if (qp) { pendientes.splice(Number(qp.dataset.quitarPendiente), 1); return pintarConDatos(); }
      const qa = e.target.closest('[data-quitar-adjunto]');
      if (qa) {
        const a = adjuntos.find((x) => String(x.id) === qa.dataset.quitarAdjunto);
        if (!confirm(`¿Quitar el adjunto ${a.nombre}?`)) return;
        const r = await sb.from('ticket_adjuntos').delete().eq('id', a.id);
        if (r.error) return window.FIN.aviso(window.UI.traducirError(r.error));
        await sb.storage.from(BUCKET).remove([a.ruta]);
        adjuntos = adjuntos.filter((x) => x !== a);
        return pintarConDatos();
      }
    });
    cont.addEventListener('keydown', (e) => {
      const fila = e.target.closest('tr[data-ticket]');
      if (fila && e.target === fila && e.key === 'Enter') abrir(tickets.find((x) => String(x.id) === fila.dataset.ticket));
    });
    cont.addEventListener('change', (e) => {
      if (e.target.matches('[data-archivos]')) return agregarArchivos(e.target.files);
      if (e.target.closest('#tg-filtros')) return cambiarFiltro(e.target);
      if (e.target.matches('[name=estado], [name=prioridad]')) vistaPrevia(e.target.form);
    });
    cont.addEventListener('dragover', (e) => {
      const z = e.target.closest('[data-zona]');
      if (!z) return;
      e.preventDefault();
      z.classList.add('encima');
    });
    cont.addEventListener('dragleave', (e) => { const z = e.target.closest('[data-zona]'); if (z) z.classList.remove('encima'); });
    cont.addEventListener('drop', (e) => {
      const z = e.target.closest('[data-zona]');
      if (!z) return;
      e.preventDefault();
      agregarArchivos(e.dataTransfer.files);
    });
    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-buscar]')) return;
      buscar = e.target.value;
      const pos = e.target.selectionStart;
      pintarLista();
      const b = pLista.querySelector('[data-buscar]');
      b.focus();
      b.setSelectionRange(pos, pos);
    });
    cont.addEventListener('submit', (e) => {
      if (!e.target.matches('.tk-form')) return;
      e.preventDefault();
      guardar(e.target);
    });

    function cambiarFiltro(el) {
      const n = el.name;
      const val = el.value;
      if (n === 'org') { f.org = Number(val); f.loc = null; pintarFiltros(); }
      else if (n === 'loc') f.loc = val ? Number(val) : null;
      else if (n === 'prioridad' || n === 'estado') f[n] = Number(val);
      else f[n] = val;
      if (n === 'desde' || n === 'hasta') {
        if (f.desde && f.hasta && f.hasta < f.desde) { if (n === 'desde') f.hasta = f.desde; else f.desde = f.hasta; }
        pintarFiltros();
      }
      if (f.desde && f.hasta) cargarLista();
    }

    // Vuelve a pintar el ticket conservando lo que se escribió.
    function pintarConDatos() {
      const form = pTicket.querySelector('.tk-form');
      const v = form ? {
        descripcion: form.elements.descripcion.value, estado: form.elements.estado.value,
        recurso_id: form.elements.recurso_id.value, modulo_id: form.elements.modulo_id.value,
        prioridad: form.querySelector('[name=prioridad]:checked').value
      } : null;
      pintarTicket();
      if (!v) return;
      const f = pTicket.querySelector('.tk-form');
      ['descripcion', 'estado', 'recurso_id', 'modulo_id'].forEach((k) => { f.elements[k].value = v[k]; });
      f.querySelector(`[name=prioridad][value="${v.prioridad}"]`).checked = true;
      vistaPrevia(f);
    }

    // Reloj de la fecha mientras el ticket es nuevo.
    const reloj = setInterval(() => {
      if (!pTicket.isConnected) return clearInterval(reloj);
      const c = pTicket.querySelector('[data-reloj="1"]');
      if (c) c.textContent = fechaHora(new Date());
    }, 1000);

    iniciar();
  };
})();
