// Tickets · Generación: segmento del ticket (datos por defecto, requerimiento, prioridad,
// adjuntos, estado, recurso asignado y gráfica del proceso) y la lista de tickets.
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

    cont.innerHTML = '<section class="panel" id="tk-ticket"></section><section class="panel" id="tk-lista"></section>';
    const pTicket = cont.querySelector('#tk-ticket');
    const pLista = cont.querySelector('#tk-lista');

    const nombreRecurso = (id) => { const r = recursos.find((x) => x.id === id); return r ? `${r.nombre || r.usuario}${r.usuario ? ` (${r.usuario})` : ''}` : ''; };
    const nombreEstado = (c) => (estados.find((e) => e.codigo === c) || {}).nombre || '';
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
        pTicket.innerHTML = `<p class="vacio">${/estados_ticket|recursos_ticket/.test(err.message) ? 'Falta instalar el script 21 (tickets) en Supabase.' : esc(err.message)}</p>`;
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

    function pintarLista() {
      const q = buscar.trim().toLowerCase();
      const filas = tickets.filter((t) => !q || [t.numero, t.descripcion, t.usuario, nombreEstado(t.estado), prioridad(t.prioridad).texto, nombreRecurso(t.recurso_id)]
        .some((v) => String(v || '').toLowerCase().includes(q)));
      pLista.innerHTML = `
        <div class="panel-cab"><h2>Tickets <small>${tickets.length}</small></h2></div>
        <input type="search" class="buscar" data-buscar placeholder="Buscar por ticket, requerimiento, usuario, estado…" value="${esc(buscar)}">
        <div class="tabla-desplazable">
          <table class="tabla">
            <thead><tr><th>Ticket</th><th>Fecha</th><th>Usuario</th><th>Requerimiento</th><th>Prioridad</th><th>Estado</th><th>Recurso asignado</th></tr></thead>
            <tbody>
              ${filas.map((t) => `
                <tr class="tk-fila ${actual && actual.id === t.id ? 'tk-actual' : ''}" data-ticket="${t.id}" tabindex="0">
                  <td class="fuerte">${esc(t.numero)}</td>
                  <td>${esc(fechaHora(t.fecha))}</td>
                  <td>${esc(t.usuario || '')}</td>
                  <td class="tk-desc">${esc(t.descripcion)}</td>
                  <td><span class="tk-prioridad ${prioridad(t.prioridad).clase}">${esc(prioridad(t.prioridad).texto)}</span></td>
                  <td>${esc(nombreEstado(t.estado))}</td>
                  <td>${esc(nombreRecurso(t.recurso_id))}</td>
                </tr>`).join('') || `<tr><td colspan="7" class="vacio">${q ? 'Ningún ticket coincide con la búsqueda.' : 'Todavía no hay tickets.'}</td></tr>`}
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

    function pintarTicket() {
      const t = actual;
      const editable = puedeEditar(t);
      const dis = editable ? '' : 'disabled';
      const orgTexto = t ? `${t.organizacion?.codigo} · ${t.organizacion?.nombre}` : org ? `${org.codigo} · ${org.nombre}` : 'Sin organización';
      const locTexto = t ? `${t.localidad?.codigo} · ${t.localidad?.nombre_comercial}` : loc ? `${loc.codigo} · ${loc.nombre_comercial}` : 'Sin localidad';
      pTicket.innerHTML = `
        <div class="panel-cab">
          <h2>${t ? `Ticket <small>${esc(t.numero)}</small>` : 'Nuevo ticket'}</h2>
          <div class="panel-acciones">${t ? '<button type="button" class="boton secundario-sm" data-accion="nuevo">+ Nuevo ticket</button>' : ''}</div>
        </div>
        <form class="tk-form" novalidate>
          <div class="tk-defecto">
            <label class="campo"><span>1. Organización</span><input value="${esc(orgTexto)}" readonly></label>
            <label class="campo"><span>2. Localidad</span><input value="${esc(locTexto)}" readonly></label>
            <label class="campo"><span>3. Usuario</span><input value="${esc(t ? t.usuario : (yo.usuario || '').toUpperCase())}" readonly></label>
            <label class="campo"><span>Fecha</span><input value="${esc(fechaHora(t ? t.fecha : new Date()))}" readonly data-reloj="${t ? '' : '1'}"></label>
            <label class="campo"><span>4. Ticket</span><input value="${esc(t ? t.numero : 'Se asigna al guardar')}" readonly class="${t ? 'tk-numero' : ''}"></label>
          </div>
          <label class="campo completo"><span>5. Descripción del requerimiento *</span>
            <textarea name="descripcion" rows="3" required ${dis}>${esc(t ? t.descripcion : '')}</textarea></label>
          <div class="tk-fila3">
            <label class="campo"><span>6. Prioridad</span>
              <select name="prioridad" ${dis}>${PRIORIDADES.map((p) => `<option value="${p.valor}" ${(t ? t.prioridad : 1) === p.valor ? 'selected' : ''}>${p.valor}. ${esc(p.texto)}</option>`).join('')}</select></label>
            <label class="campo"><span>7. Estado</span>
              <select name="estado" ${dis}>${estados.map((e) => `<option value="${e.codigo}" ${(t ? t.estado : 1) === e.codigo ? 'selected' : ''}>${e.codigo}. ${esc(e.nombre)}</option>`).join('')}</select></label>
            <label class="campo"><span>8. Recurso asignado</span>
              <select name="recurso_id" ${dis}><option value="">Sin asignar</option>${recursos.map((r) => `<option value="${r.id}" ${t && t.recurso_id === r.id ? 'selected' : ''}>${esc(r.nombre || r.usuario)}${r.usuario ? ` (${esc(r.usuario)})` : ''}</option>`).join('')}</select></label>
          </div>
          <div class="campo completo">
            <span>Adjuntos</span>
            <div class="tk-adjuntos">
              ${adjuntos.map((a) => `
                <div class="tk-adjunto">
                  <button type="button" class="tk-archivo" data-ver="${a.id}"><i class="ti ${iconoArchivo(a.tipo)}" aria-hidden="true"></i><span>${esc(a.nombre)}</span><small>${tamano(a.tamano)}</small></button>
                  ${editable ? `<button type="button" class="icono-boton" data-quitar-adjunto="${a.id}" aria-label="Quitar ${esc(a.nombre)}"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}
                </div>`).join('')}
              ${pendientes.map((f, i) => `
                <div class="tk-adjunto pendiente">
                  <span class="tk-archivo"><i class="ti ${iconoArchivo(f.type)}" aria-hidden="true"></i><span>${esc(f.name)}</span><small>${tamano(f.size)} · se sube al guardar</small></span>
                  <button type="button" class="icono-boton" data-quitar-pendiente="${i}" aria-label="Quitar ${esc(f.name)}"><i class="ti ti-x" aria-hidden="true"></i></button>
                </div>`).join('')}
              ${!adjuntos.length && !pendientes.length ? '<small class="tk-sin">Sin archivos adjuntos.</small>' : ''}
              ${editable ? `<label class="boton secundario-sm tk-subir"><i class="ti ti-upload" aria-hidden="true"></i> Subir archivo o imagen<input type="file" multiple hidden data-archivos></label><small class="tk-sin">Máximo 10 MB por archivo.</small>` : ''}
            </div>
          </div>
          <div class="campo completo">
            <span>9. Gráfica del proceso</span>
            ${grafica(t)}
          </div>
          <p class="modal-error" role="alert"></p>
          ${editable ? `<div class="tk-pie"><button type="submit" class="boton primario-sm">${t ? 'Guardar cambios' : 'Generar ticket'}</button></div>` : '<p class="tk-sin">Solo quien lo creó, el recurso asignado o un administrador pueden modificarlo.</p>'}
        </form>`;
    }

    // Pasos del proceso: completados, el actual y los pendientes, con la fecha en que se alcanzó cada uno.
    function grafica(t) {
      const estado = t ? t.estado : 1;
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

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      const boton = form.querySelector('[type=submit]');
      const d = {
        descripcion: form.elements.descripcion.value.trim(),
        prioridad: Number(form.elements.prioridad.value),
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

    cont.addEventListener('click', async (e) => {
      if (e.target.closest('[data-accion=nuevo]')) return abrir(null);
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
      const fila = e.target.closest('[data-ticket]');
      if (fila && e.key === 'Enter') abrir(tickets.find((x) => String(x.id) === fila.dataset.ticket));
    });
    cont.addEventListener('change', (e) => {
      if (!e.target.matches('[data-archivos]')) return;
      const grandes = [...e.target.files].filter((f) => f.size > ADJUNTO_MAX);
      pendientes.push(...[...e.target.files].filter((f) => f.size <= ADJUNTO_MAX));
      if (grandes.length) window.FIN.aviso(`${grandes.map((f) => f.name).join(', ')}: pesa más de 10 MB`);
      pintarConDatos();
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

    // Vuelve a pintar el segmento conservando lo que se escribió.
    function pintarConDatos() {
      const form = pTicket.querySelector('.tk-form');
      const v = form ? { descripcion: form.elements.descripcion.value, prioridad: form.elements.prioridad.value, estado: form.elements.estado.value, recurso_id: form.elements.recurso_id.value } : null;
      pintarTicket();
      if (!v) return;
      const f = pTicket.querySelector('.tk-form');
      Object.entries(v).forEach(([k, x]) => { f.elements[k].value = x; });
    }

    // Reloj de la fecha mientras el ticket es nuevo.
    const reloj = setInterval(() => {
      if (!document.body.contains(cont) || !pTicket.isConnected) return clearInterval(reloj);
      const c = pTicket.querySelector('[data-reloj="1"]');
      if (c) c.value = fechaHora(new Date());
    }, 1000);

    iniciar();
  };
})();
