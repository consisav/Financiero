// Tickets · Generación. Arriba, la cabecera del ticket: número, estado, prioridad, datos por
// defecto (organización, localidad, solicitante, fecha) y la gráfica del proceso. Debajo, dos
// columnas: el requerimiento con sus adjuntos y la gestión (prioridad, estado, recurso asignado
// e historial). Al final, la lista de tickets con filtros por estado y prioridad.
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
    let tickets = [];
    let org = null;
    let loc = null;
    let actual = null;      // ticket abierto (null = nuevo)
    let adjuntos = [];      // adjuntos guardados del ticket abierto
    let movimientos = [];
    let pendientes = [];    // archivos elegidos que se suben al guardar
    let buscar = '';
    let filtroEstado = 0;   // 0 = todos
    let filtroPrioridad = 0;

    cont.innerHTML = '<div id="tk-ticket"></div><section class="panel" id="tk-lista"></section>';
    const pTicket = cont.querySelector('#tk-ticket');
    const pLista = cont.querySelector('#tk-lista');

    const recurso = (id) => recursos.find((x) => x.id === id);
    const nombreRecurso = (id) => { const r = recurso(id); return r ? r.nombre || r.usuario : ''; };
    const nombreEstado = (c) => (estados.find((e) => e.codigo === c) || {}).nombre || '';
    const marcaEstado = (c) => `<span class="tk-estado e${c}">${esc(nombreEstado(c))}</span>`;
    const puedeEditar = (t) => !t || window.FIN.puedeEditarCatalogos() || [t.perfil_id, t.recurso_id].includes(yo.id);

    async function iniciar() {
      const [e, r, o, l] = await Promise.all([
        sb.from('estados_ticket').select('*').eq('activo', true).order('codigo'),
        sb.rpc('recursos_ticket'),
        yo.organizacion_id ? sb.from('organizaciones').select('codigo, nombre').eq('id', yo.organizacion_id).maybeSingle() : { data: null },
        yo.localidad_id ? sb.from('localidades').select('codigo, nombre_comercial').eq('id', yo.localidad_id).maybeSingle() : { data: null }
      ]);
      const err = e.error || r.error;
      if (err) {
        pTicket.innerHTML = `<section class="panel"><p class="vacio">${/estados_ticket|recursos_ticket/.test(err.message) ? 'Falta instalar el script 21 (tickets) en Supabase.' : esc(err.message)}</p></section>`;
        return;
      }
      estados = e.data;
      recursos = r.data || [];
      org = o.data;
      loc = l.data;
      await cargarLista();
      abrir(null);
    }

    async function cargarLista() {
      const { data, error } = await sb.from('tickets')
        .select('*, organizacion:organizaciones(codigo, nombre), localidad:localidades!tickets_localidad_id_organizacion_id_fkey(codigo, nombre_comercial)')
        .order('fecha', { ascending: false }).limit(300);
      if (error) { pLista.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      tickets = data;
      pintarLista();
    }

    // ---------- Lista ----------
    function pintarLista() {
      const q = buscar.trim().toLowerCase();
      const filas = tickets.filter((t) =>
        (!filtroEstado || t.estado === filtroEstado) &&
        (!filtroPrioridad || t.prioridad === filtroPrioridad) &&
        (!q || [t.numero, t.descripcion, t.usuario, nombreEstado(t.estado), prioridad(t.prioridad).texto, nombreRecurso(t.recurso_id)]
          .some((v) => String(v || '').toLowerCase().includes(q))));
      const cuenta = (c) => tickets.filter((t) => t.estado === c).length;
      pLista.innerHTML = `
        <div class="panel-cab">
          <h2>Tickets <small>${filas.length === tickets.length ? tickets.length : `${filas.length} de ${tickets.length}`}</small></h2>
        </div>
        <div class="tk-filtros" role="group" aria-label="Filtrar por estado">
          <button type="button" class="tk-chip ${!filtroEstado ? 'activo' : ''}" data-filtro-estado="0">Todos <b>${tickets.length}</b></button>
          ${estados.map((e) => `<button type="button" class="tk-chip ${filtroEstado === e.codigo ? 'activo' : ''}" data-filtro-estado="${e.codigo}"><i class="tk-punto-color e${e.codigo}" aria-hidden="true"></i>${esc(e.nombre)} <b>${cuenta(e.codigo)}</b></button>`).join('')}
        </div>
        <div class="tk-barra">
          <input type="search" class="buscar" data-buscar placeholder="Buscar por ticket, requerimiento, solicitante o recurso" value="${esc(buscar)}">
          <select data-filtro-prioridad aria-label="Filtrar por prioridad">
            <option value="0">Todas las prioridades</option>
            ${PRIORIDADES.map((p) => `<option value="${p.valor}" ${filtroPrioridad === p.valor ? 'selected' : ''}>${p.valor}. ${esc(p.texto)}</option>`).join('')}
          </select>
        </div>
        <div class="tabla-desplazable">
          <table class="tabla tk-tabla">
            <thead><tr><th>Ticket</th><th>Fecha</th><th>Solicitante</th><th>Requerimiento</th><th>Prioridad</th><th>Estado</th><th>Recurso asignado</th><th><span class="oculto">Acciones</span></th></tr></thead>
            <tbody>
              ${filas.map((t) => `
                <tr class="tk-fila ${actual && actual.id === t.id ? 'tk-actual' : ''}" data-ticket="${t.id}" tabindex="0">
                  <td class="fuerte">${esc(t.numero)}</td>
                  <td>${esc(fechaHora(t.fecha))}</td>
                  <td>${esc(t.usuario || '')}</td>
                  <td class="tk-desc" title="${esc(t.descripcion)}">${esc(t.descripcion)}</td>
                  <td>${marcaPrioridad(t.prioridad)}</td>
                  <td>${marcaEstado(t.estado)}</td>
                  <td>${t.recurso_id ? `<span class="tk-persona"><span class="tk-avatar">${esc(iniciales(nombreRecurso(t.recurso_id)))}</span>${esc(nombreRecurso(t.recurso_id))}</span>` : '<span class="tk-tenue">Sin asignar</span>'}</td>
                  <td class="tk-accion"><button type="button" class="boton secundario-sm" data-ticket="${t.id}" title="${puedeEditar(t) ? 'Modificar' : 'Ver'} el ticket ${esc(t.numero)}"><i class="ti ${puedeEditar(t) ? 'ti-pencil' : 'ti-eye'}" aria-hidden="true"></i> ${puedeEditar(t) ? 'Modificar' : 'Ver'}</button></td>
                </tr>`).join('') || `<tr><td colspan="8" class="vacio">${tickets.length ? 'Ningún ticket coincide con los filtros.' : 'Todavía no hay tickets.'}</td></tr>`}
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
        <form class="tk-form" novalidate>
          <section class="panel tk-cabecera">
            <div class="tk-titulo">
              <span class="tk-icono"><i class="ti ti-ticket" aria-hidden="true"></i></span>
              <div>
                <small>${t ? 'Ticket' : 'Nuevo ticket'}</small>
                <h2>${t ? esc(t.numero) : 'Se numera al generarlo'}</h2>
              </div>
              <div class="tk-marcas" data-marcas>${marcaEstado(estado)}${marcaPrioridad(prio)}</div>
              <div class="tk-titulo-acciones">
                ${t ? '<button type="button" class="boton secundario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo ticket</button>' : ''}
                ${editable && t ? '<button type="button" class="boton secundario-sm" data-accion="descartar"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Descartar cambios</button>' : ''}
                ${editable ? `<button type="submit" class="boton primario-sm"><i class="ti ${t ? 'ti-device-floppy' : 'ti-send'}" aria-hidden="true"></i> ${t ? 'Guardar cambios' : 'Generar ticket'}</button>` : ''}
              </div>
            </div>
            <p class="modal-error tk-error" role="alert"></p>
            ${t && !editable ? '<p class="tk-aviso"><i class="ti ti-lock" aria-hidden="true"></i> Solo quien lo creó, el recurso asignado o un administrador pueden modificar este ticket.</p>' : ''}
            ${t && editable ? '<p class="tk-aviso editando"><i class="ti ti-pencil" aria-hidden="true"></i> Modificando el ticket: cambia lo que necesites y presiona «Guardar cambios».</p>' : ''}
            <dl class="tk-datos">
              <div><dt><i class="ti ti-building" aria-hidden="true"></i> Organización</dt><dd>${esc(orgTexto)}</dd></div>
              <div><dt><i class="ti ti-map-pin" aria-hidden="true"></i> Localidad</dt><dd>${esc(locTexto)}</dd></div>
              <div><dt><i class="ti ti-user" aria-hidden="true"></i> Solicitante</dt><dd>${esc(t ? t.usuario : (yo.usuario || '').toUpperCase())}</dd></div>
              <div><dt><i class="ti ti-clock" aria-hidden="true"></i> Fecha y hora</dt><dd data-reloj="${t ? '' : '1'}">${esc(fechaHora(t ? t.fecha : new Date()))}</dd></div>
            </dl>
            <div class="tk-proceso" data-grafica>${grafica(estado)}</div>
          </section>

          <div class="tk-cuerpo">
            <section class="panel tk-req">
              <div class="panel-cab"><h2>Requerimiento</h2></div>
              <label class="campo"><span>Descripción del requerimiento *</span>
                <textarea name="descripcion" rows="6" required ${dis} placeholder="Describe qué se necesita, dónde y para cuándo.">${esc(t ? t.descripcion : '')}</textarea></label>
              <div class="campo">
                <span>Adjuntos <small class="tk-tenue">${adjuntos.length + pendientes.length || ''}</small></span>
                ${editable ? `
                  <label class="tk-zona" data-zona>
                    <i class="ti ti-cloud-upload" aria-hidden="true"></i>
                    <span><b>Arrastra archivos o imágenes aquí</b> o haz clic para elegirlos</span>
                    <small>Máximo 10 MB por archivo</small>
                    <input type="file" multiple hidden data-archivos>
                  </label>` : ''}
                <div class="tk-adjuntos">
                  ${adjuntos.map((a) => `
                    <div class="tk-adjunto">
                      <button type="button" class="tk-archivo" data-ver="${a.id}" title="Abrir ${esc(a.nombre)}"><i class="ti ${iconoArchivo(a.tipo)}" aria-hidden="true"></i><span>${esc(a.nombre)}</span><small>${tamano(a.tamano)}</small></button>
                      ${editable ? `<button type="button" class="icono-boton" data-quitar-adjunto="${a.id}" aria-label="Quitar ${esc(a.nombre)}"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}
                    </div>`).join('')}
                  ${pendientes.map((f, i) => `
                    <div class="tk-adjunto pendiente">
                      <span class="tk-archivo"><i class="ti ${iconoArchivo(f.type)}" aria-hidden="true"></i><span>${esc(f.name)}</span><small>${tamano(f.size)} · se sube al guardar</small></span>
                      <button type="button" class="icono-boton" data-quitar-pendiente="${i}" aria-label="Quitar ${esc(f.name)}"><i class="ti ti-x" aria-hidden="true"></i></button>
                    </div>`).join('')}
                  ${!adjuntos.length && !pendientes.length && !editable ? '<small class="tk-tenue">Sin archivos adjuntos.</small>' : ''}
                </div>
              </div>
            </section>

            <section class="panel tk-gestion">
              <div class="panel-cab"><h2>Gestión</h2></div>
              <fieldset class="tk-prioridades" ${dis}>
                <legend>Prioridad</legend>
                ${PRIORIDADES.map((p) => `
                  <label class="tk-opcion-prio ${p.clase}"><input type="radio" name="prioridad" value="${p.valor}" ${prio === p.valor ? 'checked' : ''}><span class="tk-punto-color ${p.clase}" aria-hidden="true"></span>${p.valor}. ${esc(p.texto)}</label>`).join('')}
              </fieldset>
              <label class="campo"><span>Estado</span>
                <select name="estado" ${dis}>${estados.map((e) => `<option value="${e.codigo}" ${estado === e.codigo ? 'selected' : ''}>${e.codigo}. ${esc(e.nombre)}</option>`).join('')}</select></label>
              <label class="campo"><span>Recurso asignado</span>
                <select name="recurso_id" ${dis}><option value="">Sin asignar</option>${recursos.map((r) => `<option value="${r.id}" ${t && t.recurso_id === r.id ? 'selected' : ''}>${esc(r.nombre || r.usuario)}${r.usuario ? ` (${esc(r.usuario)})` : ''}</option>`).join('')}</select></label>
              ${t ? `
                <div class="tk-historial">
                  <h3>Historial</h3>
                  <ol>
                    ${movimientos.slice().reverse().map((m) => `
                      <li>
                        <span class="tk-punto-color e${m.estado}" aria-hidden="true"></span>
                        <div><b>${esc(nombreEstado(m.estado))}</b>${m.recurso_id ? ` · ${esc(nombreRecurso(m.recurso_id))}` : ''}
                        <small>${esc(fechaHora(m.fecha))} · ${esc(m.usuario || '')}</small></div>
                      </li>`).join('')}
                  </ol>
                </div>` : ''}
            </section>
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
                <small>${llegada[e.codigo] && e.codigo <= estado ? esc(fechaHora(llegada[e.codigo])) : ''}</small>
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

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      const boton = form.querySelector('[type=submit]');
      const d = {
        descripcion: form.elements.descripcion.value.trim(),
        prioridad: Number(form.querySelector('[name=prioridad]:checked').value),
        estado: Number(form.elements.estado.value),
        recurso_id: form.elements.recurso_id.value || null
      };
      if (!d.descripcion) { error.textContent = 'Escribe la descripción del requerimiento.'; form.elements.descripcion.focus(); return; }
      error.textContent = '';
      boton.disabled = true;
      try {
        const r = actual
          ? await sb.from('tickets').update(d).eq('id', actual.id).select('id').single()
          : await sb.from('tickets').insert(d).select('id').single();
        if (r.error) throw r.error;
        const id = r.data.id;
        let fallidos = 0;
        for (const f of pendientes) {
          const ruta = `${id}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
          const up = await sb.storage.from(BUCKET).upload(ruta, f, { contentType: f.type || 'application/octet-stream' });
          if (up.error) { fallidos++; continue; }
          const ins = await sb.from('ticket_adjuntos').insert({ ticket_id: id, ruta, nombre: f.name, tipo: f.type || null, tamano: f.size });
          if (ins.error) { fallidos++; await sb.storage.from(BUCKET).remove([ruta]); }
        }
        await cargarLista();
        const t = tickets.find((x) => x.id === id);
        window.FIN.aviso(`${actual ? 'Ticket guardado' : `Ticket ${t ? t.numero : ''} generado`}${fallidos ? ` · ${fallidos} adjunto(s) no se pudieron subir` : ''}`);
        await abrir(t || null);
      } catch (err) {
        error.textContent = window.UI.traducirError(err);
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
      if (e.target.closest('[data-accion=nuevo]')) return abrir(null);
      if (e.target.closest('[data-accion=descartar]')) return abrir(actual);
      const fe = e.target.closest('[data-filtro-estado]');
      if (fe) { filtroEstado = Number(fe.dataset.filtroEstado); return pintarLista(); }
      const fila = e.target.closest('[data-ticket]');
      if (fila) {
        await abrir(tickets.find((x) => String(x.id) === fila.dataset.ticket));
        return pTicket.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
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
      const fila = e.target.closest('[data-ticket]');
      if (fila && e.key === 'Enter') abrir(tickets.find((x) => String(x.id) === fila.dataset.ticket));
    });
    cont.addEventListener('change', (e) => {
      if (e.target.matches('[data-archivos]')) return agregarArchivos(e.target.files);
      if (e.target.matches('[data-filtro-prioridad]')) { filtroPrioridad = Number(e.target.value); return pintarLista(); }
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

    // Vuelve a pintar el ticket conservando lo que se escribió.
    function pintarConDatos() {
      const form = pTicket.querySelector('.tk-form');
      const v = form ? {
        descripcion: form.elements.descripcion.value, estado: form.elements.estado.value,
        recurso_id: form.elements.recurso_id.value, prioridad: form.querySelector('[name=prioridad]:checked').value
      } : null;
      pintarTicket();
      if (!v) return;
      const f = pTicket.querySelector('.tk-form');
      ['descripcion', 'estado', 'recurso_id'].forEach((k) => { f.elements[k].value = v[k]; });
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
