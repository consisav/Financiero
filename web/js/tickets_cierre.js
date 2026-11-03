// Tickets · Cierre (maestro - detalle), en una sola pantalla:
//   Arriba, los parámetros de consulta: organización, localidad, fecha inicial y final, módulo,
//   prioridad y si están pendientes de cierre o cerrados.
//   Maestro: los tickets que cumplen esos parámetros.
//   Detalle: el cierre del ticket elegido: usuario que entrega, usuario que recibe, tipo de
//   pruebas o cierre, observaciones y archivos con las pruebas. Al grabar, el ticket pasa a
//   CERRADO y la fecha y hora de cierre y el usuario que lo cierra se graban solos.
(function () {
  const { esc } = window.UI;

  const BUCKET = 'tickets';
  const ADJUNTO_MAX = 10 * 1024 * 1024;
  const CERRADO = 7;
  const TIPOS = ['PRUEBAS DE USUARIO', 'PRUEBAS TÉCNICAS', 'PRUEBAS INTEGRALES', 'CIERRE ADMINISTRATIVO', 'CIERRE SIN SOLUCIÓN'];
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
  const fechaDia = (d) => d ? d.split('-').reverse().join('/') : '';
  const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
  const iniciales = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?';
  const tamano = (b) => b == null ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
  const iconoArchivo = (tipo = '') => tipo.startsWith('image/') ? 'ti-photo' : tipo === 'application/pdf' ? 'ti-file-type-pdf' : 'ti-file';
  const marcaPrioridad = (v) => `<span class="tk-prioridad ${prioridad(v).clase}">${esc(prioridad(v).texto)}</span>`;

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['tickets-cierre'] = function (cont) {
    const sb = window.FIN.sb;
    const yo = window.FIN.perfil();
    let organizaciones = [];
    let localidades = [];
    let modulos = [];
    let estados = [];
    let tickets = [];
    let actual = null;
    let cierre = null;      // cierre registrado del ticket elegido
    let pruebas = [];       // adjuntos del cierre
    let procesos = [];
    let pendientes = [];    // archivos elegidos que se suben al cerrar
    const nombres = {};
    const f = {
      org: yo.organizacion_id || null, loc: yo.localidad_id || null,
      desde: hoy().slice(0, 8) + '01', hasta: hoy(), modulo: '', prioridad: 0, cierre: 'pendientes'
    };

    cont.innerHTML = `
      <div class="ta-espacio ta-apilado">
        <section class="ta-filtros" id="tc-filtros"></section>
        <div class="ta-cuerpo">
          <section class="tk-bandeja ta-maestro" id="tc-maestro"></section>
          <section class="tk-detalle ta-detalle" id="tc-detalle"></section>
        </div>
      </div>`;
    const espacio = cont.querySelector('.ta-espacio');
    const pFil = cont.querySelector('#tc-filtros');
    const pMae = cont.querySelector('#tc-maestro');
    const pDet = cont.querySelector('#tc-detalle');

    const nombreEstado = (c) => (estados.find((e) => e.codigo === c) || {}).nombre || '';
    const marcaEstado = (c) => `<span class="tk-estado e${c}"><i class="tk-punto-color e${c}" aria-hidden="true"></i>${esc(nombreEstado(c))}</span>`;
    const modulo = (id) => modulos.find((m) => m.id === id);
    const nombreUsuario = (id) => { const r = nombres[id]; return r ? r.nombre || r.usuario : ''; };
    const usuariosDe = (loc) => nombres[`loc${loc}`] || [];
    const puedeCerrar = (t) => window.FIN.puedeEditarCatalogos() || [t.perfil_id, t.recurso_id].includes(yo.id);

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
        sb.from('ticket_cierres').select('id').limit(1)
      ]);
      if (prueba.error || e.error) {
        const err = prueba.error || e.error;
        espacio.innerHTML = `<section class="panel"><p class="vacio">${/ticket_cierres|estados_ticket/.test(err.message) ? 'Falta instalar el script 31 (cierre de tickets) en Supabase.' : esc(err.message)}</p></section>`;
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
        <div class="ta-titulo"><span class="tk-icono"><i class="ti ti-circle-check" aria-hidden="true"></i></span><div><small>Tickets</small><h2>Cierre</h2></div></div>
        <label class="campo"><span>Organización</span><select name="org">${organizaciones.map((o) => `<option value="${o.id}" ${f.org === o.id ? 'selected' : ''}>${o.codigo} · ${esc(o.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Localidad</span><select name="loc"><option value="">Todas</option>${locs.map((l) => `<option value="${l.id}" ${f.loc === l.id ? 'selected' : ''}>${esc(l.codigo)} · ${esc(l.nombre_comercial)}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>
        <label class="campo"><span>Módulo</span><select name="modulo"><option value="">Todos</option><option value="general" ${f.modulo === 'general' ? 'selected' : ''}>Todos los módulos (general)</option>${modulos.map((m) => `<option value="${m.id}" ${String(f.modulo) === String(m.id) ? 'selected' : ''}>${esc(m.siglas)} · ${esc(m.descripcion)}</option>`).join('')}</select></label>
        <label class="campo"><span>Prioridad</span><select name="prioridad"><option value="0">Todas</option>${PRIORIDADES.map((p) => `<option value="${p.valor}" ${f.prioridad === p.valor ? 'selected' : ''}>${p.valor}. ${esc(p.texto)}</option>`).join('')}</select></label>
        <label class="campo"><span>Cierre</span><select name="cierre">
          <option value="pendientes" ${f.cierre === 'pendientes' ? 'selected' : ''}>Pendientes de cierre</option>
          <option value="cerrados" ${f.cierre === 'cerrados' ? 'selected' : ''}>Cerrados</option>
          <option value="todos" ${f.cierre === 'todos' ? 'selected' : ''}>Todos</option></select></label>`;
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
      if (f.cierre === 'pendientes') q = q.lt('estado', CERRADO);
      if (f.cierre === 'cerrados') q = q.eq('estado', CERRADO);
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
        nombres[`loc${l}`] = data || [];
        (data || []).forEach((r) => { nombres[r.id] = r; });
      }));
    }

    // ---------- Maestro ----------
    function pintarMaestro() {
      const cerrados = tickets.filter((t) => t.estado === CERRADO).length;
      const listos = tickets.filter((t) => t.estado === 6).length;
      pMae.innerHTML = `
        <header class="tk-bandeja-cab">
          <h2>Tickets <small>${tickets.length}</small></h2>
          <div class="ta-totales">
            ${listos ? `<span class="ta-total listo"><b>${listos}</b> resueltos por cerrar</span>` : ''}
            <span class="ta-total sin"><b>${tickets.length - cerrados}</b> pendientes</span><span class="ta-total con"><b>${cerrados}</b> cerrados</span>
          </div>
        </header>
        <div class="ta-tabla">
          <table>
            <thead><tr><th>Ticket</th><th>Descripción</th><th>Prioridad</th><th>Estado</th><th>Asignado a</th><th>Entrega</th><th>Fecha de cierre</th></tr></thead>
            <tbody>
              ${tickets.map((t) => `
                <tr class="${actual && actual.id === t.id ? 'actual' : ''}" data-ticket="${t.id}" tabindex="0">
                  <td class="fuerte"><i class="tk-franja-celda e${t.estado}" aria-hidden="true"></i>${esc(t.numero)}<small class="ts-sub">${esc(fechaCorta(t.fecha))}</small></td>
                  <td class="ta-desc" title="${esc(t.descripcion)}">${esc(t.descripcion)}</td>
                  <td>${marcaPrioridad(t.prioridad)}</td>
                  <td>${marcaEstado(t.estado)}</td>
                  <td>${t.recurso_id ? `<span class="tk-persona"><span class="tk-avatar">${esc(iniciales(nombreUsuario(t.recurso_id)))}</span>${esc(nombreUsuario(t.recurso_id))}</span>` : '<span class="ta-sin">Sin asignar</span>'}</td>
                  <td class="${t.fecha_entrega && t.fecha_entrega < hoy() && t.estado < 6 ? 'ta-vencido' : ''}">${esc(fechaDia(t.fecha_entrega)) || '—'}</td>
                  <td>${t.cerrado_en ? `<span class="tc-cerrado"><i class="ti ti-lock" aria-hidden="true"></i> ${esc(fechaCorta(t.cerrado_en))}</span>` : '<span class="tk-tenue">Pendiente</span>'}</td>
                </tr>`).join('') || '<tr><td colspan="7" class="tk-vacio"><i class="ti ti-inbox" aria-hidden="true"></i>No hay tickets con esos parámetros.</td></tr>'}
            </tbody>
          </table>
        </div>`;
    }

    async function abrir(t) {
      actual = t;
      cierre = null;
      pruebas = [];
      procesos = [];
      pendientes = [];
      if (t) {
        const [c, p] = await Promise.all([
          sb.from('ticket_cierres').select('*').eq('ticket_id', t.id).maybeSingle(),
          sb.from('ticket_procesos').select('estado').eq('ticket_id', t.id)
        ]);
        cierre = c.data || null;
        procesos = p.data || [];
        if (cierre) {
          const a = await sb.from('ticket_adjuntos').select('*').eq('cierre_id', cierre.id).order('creado_en');
          pruebas = a.data || [];
        }
      }
      pintarDetalle();
      pMae.querySelectorAll('tr[data-ticket]').forEach((tr) => tr.classList.toggle('actual', !!t && tr.dataset.ticket === String(t.id)));
    }

    // ---------- Detalle ----------
    function pintarDetalle(valores) {
      const t = actual;
      if (!t) {
        pDet.innerHTML = '<div class="tk-vacio ta-elige"><i class="ti ti-hand-click" aria-hidden="true"></i>Elige un ticket del maestro para cerrarlo.</div>';
        return;
      }
      const usuarios = usuariosDe(t.localidad_id);
      const fin = procesos.filter((x) => x.estado === 'FINALIZADO').length;
      const v = valores || { entrega_id: t.recurso_id || '', recibe_id: t.perfil_id || '', tipo: TIPOS[0], observaciones: '' };
      const opciones = (sel) => '<option value="">Seleccionar usuario…</option>' + usuarios.map((r) => `<option value="${r.id}" ${sel === r.id ? 'selected' : ''}>${esc(r.nombre || r.usuario)}${r.usuario ? ` (${esc(r.usuario)})` : ''}</option>`).join('');
      pDet.innerHTML = `
        <div class="tk-form ta-form">
          <header class="tk-titulo">
            <span class="tk-icono ts-icono e${t.estado}"><i class="ti ${cierre ? 'ti-lock' : 'ti-ticket'}" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>${cierre ? 'Ticket cerrado' : 'Cierre del ticket'}</small><h2>${esc(t.numero)}</h2></div>
            <div class="tk-marcas">${marcaEstado(t.estado)}${marcaPrioridad(t.prioridad)}</div>
          </header>

          <div class="ta-det-grid">
          <div class="ta-col">
          <h3 class="ta-col-titulo"><i class="ti ti-file-description" aria-hidden="true"></i> Datos del ticket</h3>
          <dl class="tk-datos ta-datos">
            <div><dt><i class="ti ti-user" aria-hidden="true"></i> Solicitante</dt><dd>${esc(t.usuario || '')}</dd></div>
            <div><dt><i class="ti ti-clock" aria-hidden="true"></i> Fecha del ticket</dt><dd>${esc(fechaHora(t.fecha))}</dd></div>
            <div><dt><i class="ti ti-user-check" aria-hidden="true"></i> Asignado a</dt><dd>${esc(nombreUsuario(t.recurso_id) || 'Sin asignar')}</dd></div>
            <div><dt><i class="ti ti-calendar-due" aria-hidden="true"></i> Entrega estimada</dt><dd>${esc(fechaDia(t.fecha_entrega)) || '—'}</dd></div>
          </dl>
          <div class="ta-requerimiento"><span>Descripción</span><p>${esc(t.descripcion)}</p></div>
          ${procesos.length ? `<p class="tc-procesos ${fin < procesos.length ? 'aviso' : 'ok'}"><i class="ti ${fin < procesos.length ? 'ti-alert-triangle' : 'ti-circle-check'}" aria-hidden="true"></i> Procesos de la solución: ${fin} de ${procesos.length} finalizados${fin < procesos.length ? ' · hay procesos sin terminar' : ''}</p>` : ''}
          </div>

          ${cierre ? resumenCierre() : !puedeCerrar(t) ? `
            <div class="ta-col"><p class="tk-aviso"><i class="ti ti-lock" aria-hidden="true"></i> Solo quien creó el ticket, el recurso asignado o un administrador pueden cerrarlo</p></div>
            <div class="ta-col"></div>` : `
            <form class="tc-form" novalidate>
              <div class="ta-col">
                <h3 class="ta-col-titulo"><i class="ti ti-circle-check" aria-hidden="true"></i> Cierre</h3>
                <div class="ta-asignar-campos">
                  <div class="ta-auto"><span>Fecha de cierre</span><b data-reloj>${esc(fechaHora(new Date()))}</b><small>Se graba al cerrar</small></div>
                  <div class="ta-auto"><span>Cierra</span><b>${esc((yo.usuario || '').toUpperCase())}</b><small>Usuario actual</small></div>
                  <label class="campo"><span>Usuario que entrega *</span><select name="entrega_id">${opciones(v.entrega_id)}</select></label>
                  <label class="campo"><span>Usuario que recibe *</span><select name="recibe_id">${opciones(v.recibe_id)}</select></label>
                </div>
                <label class="campo"><span>Tipo de pruebas o cierre *</span><select name="tipo">${TIPOS.map((x) => `<option ${v.tipo === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
                <p class="rp-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> Al cerrar, el ticket pasa a CERRADO y ya no cambia de estado.</p>
              </div>
              <div class="ta-col">
                <h3 class="ta-col-titulo"><i class="ti ti-paperclip" aria-hidden="true"></i> Pruebas y observaciones</h3>
                <label class="campo"><span>Observaciones (tipo de pruebas o cierre)</span><textarea name="observaciones" rows="3" placeholder="Pruebas realizadas, resultado, conformidad del usuario…">${esc(v.observaciones)}</textarea></label>
                <div class="campo">
                  <span>Archivos adjuntos (pruebas) ${pendientes.length ? `<small class="tk-tenue">(${pendientes.length})</small>` : ''}</span>
                  <div class="tk-adjuntos">
                    <label class="tk-zona" data-zona title="Arrastra archivos aquí o haz clic para elegirlos (máximo 10 MB cada uno)">
                      <i class="ti ti-cloud-upload" aria-hidden="true"></i><span><b>Adjuntar pruebas</b> · arrastra o elige</span>
                      <input type="file" multiple hidden data-archivos>
                    </label>
                    ${pendientes.map((a, i) => `
                      <div class="tk-adjunto pendiente" title="${esc(a.name)} · ${tamano(a.size)}">
                        <span class="tk-archivo"><i class="ti ${iconoArchivo(a.type)}" aria-hidden="true"></i><span>${esc(a.name)}</span></span>
                        <button type="button" class="icono-boton" data-quitar-pendiente="${i}" aria-label="Quitar ${esc(a.name)}"><i class="ti ti-x" aria-hidden="true"></i></button>
                      </div>`).join('')}
                  </div>
                </div>
                <p class="modal-error tk-error" role="alert"></p>
                <div class="ta-boton"><button type="submit" class="boton primario-sm"><i class="ti ti-lock" aria-hidden="true"></i> Cerrar ticket</button></div>
              </div>
            </form>`}
          </div>
        </div>`;
    }

    function resumenCierre() {
      return `
        <div class="ta-col">
          <h3 class="ta-col-titulo tc-ok"><i class="ti ti-lock" aria-hidden="true"></i> Cierre registrado</h3>
          <dl class="tk-datos ta-datos">
            <div><dt><i class="ti ti-calendar-check" aria-hidden="true"></i> Fecha de cierre</dt><dd>${esc(fechaHora(cierre.fecha))}</dd></div>
            <div><dt><i class="ti ti-user-shield" aria-hidden="true"></i> Cerró</dt><dd>${esc(cierre.cerrado_por || '')}</dd></div>
            <div><dt><i class="ti ti-arrow-up-right" aria-hidden="true"></i> Entrega</dt><dd>${esc(nombreUsuario(cierre.entrega_id))}</dd></div>
            <div><dt><i class="ti ti-arrow-down-left" aria-hidden="true"></i> Recibe</dt><dd>${esc(nombreUsuario(cierre.recibe_id))}</dd></div>
          </dl>
          <p class="tc-tipo"><span class="rp-estado aplicada">${esc(cierre.tipo)}</span></p>
        </div>
        <div class="ta-col">
          <h3 class="ta-col-titulo"><i class="ti ti-paperclip" aria-hidden="true"></i> Pruebas y observaciones</h3>
          <div class="ta-requerimiento"><span>Observaciones</span><p>${esc(cierre.observaciones || 'Sin observaciones.')}</p></div>
          <div class="campo"><span>Pruebas adjuntas</span>
            <div class="tk-adjuntos">${pruebas.map((a) => `<div class="tk-adjunto"><button type="button" class="tk-archivo" data-ver="${a.id}" title="Abrir ${esc(a.nombre)} (${tamano(a.tamano)})"><i class="ti ${iconoArchivo(a.tipo)}" aria-hidden="true"></i><span>${esc(a.nombre)}</span></button></div>`).join('') || '<small class="tk-tenue">Sin archivos adjuntos.</small>'}</div>
          </div>
        </div>`;
    }

    function leer(form) {
      return { entrega_id: form.elements.entrega_id.value, recibe_id: form.elements.recibe_id.value, tipo: form.elements.tipo.value, observaciones: form.elements.observaciones.value };
    }

    async function cerrar(form) {
      const error = form.querySelector('.modal-error');
      const v = leer(form);
      if (!v.entrega_id || !v.recibe_id) { error.textContent = 'Elige el usuario que entrega y el que recibe.'; return; }
      if (!confirm(`¿Cerrar el ticket ${actual.numero}? Pasa a CERRADO y ya no cambia de estado.`)) return;
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      error.textContent = '';
      const { data, error: err } = await sb.from('ticket_cierres').insert({ ticket_id: actual.id, ...v }).select('id').single();
      if (err) { boton.disabled = false; error.textContent = window.UI.traducirError(err); return; }
      let fallidos = 0;
      for (const a of pendientes) {
        const ruta = `${actual.id}/cierre-${Date.now()}-${a.name.replace(/[^\w.\-]+/g, '_')}`;
        const up = await sb.storage.from(BUCKET).upload(ruta, a, { contentType: a.type || 'application/octet-stream' });
        if (up.error) { fallidos++; continue; }
        const ins = await sb.from('ticket_adjuntos').insert({ ticket_id: actual.id, cierre_id: data.id, ruta, nombre: a.name, tipo: a.type || null, tamano: a.size });
        if (ins.error) { fallidos++; await sb.storage.from(BUCKET).remove([ruta]); }
      }
      window.FIN.aviso(`Ticket ${actual.numero} cerrado${fallidos ? ` · ${fallidos} archivo(s) no se pudieron subir` : ''}`);
      const id = actual.id;
      await consultar();
      const t = tickets.find((x) => x.id === id);
      if (t) await abrir(t);
    }

    cont.addEventListener('change', (e) => {
      if (e.target.matches('[data-archivos]')) {
        const archivos = [...e.target.files];
        const grandes = archivos.filter((a) => a.size > ADJUNTO_MAX);
        pendientes.push(...archivos.filter((a) => a.size <= ADJUNTO_MAX));
        if (grandes.length) window.FIN.aviso(`${grandes.map((a) => a.name).join(', ')}: pesa más de 10 MB`);
        return pintarDetalle(leer(pDet.querySelector('.tc-form')));
      }
      if (!e.target.closest('#tc-filtros')) return;
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
    cont.addEventListener('click', async (e) => {
      const qp = e.target.closest('[data-quitar-pendiente]');
      if (qp) { const v = leer(pDet.querySelector('.tc-form')); pendientes.splice(Number(qp.dataset.quitarPendiente), 1); return pintarDetalle(v); }
      const ver = e.target.closest('[data-ver]');
      if (ver) {
        const a = pruebas.find((x) => String(x.id) === ver.dataset.ver);
        const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(a.ruta, 600);
        if (error) return window.FIN.aviso('No se pudo abrir el archivo');
        return window.open(data.signedUrl, '_blank', 'noopener');
      }
      const tr = e.target.closest('tr[data-ticket]');
      if (tr) abrir(tickets.find((t) => String(t.id) === tr.dataset.ticket));
    });
    cont.addEventListener('keydown', (e) => {
      const tr = e.target.closest('tr[data-ticket]');
      if (tr && e.key === 'Enter') abrir(tickets.find((t) => String(t.id) === tr.dataset.ticket));
    });
    cont.addEventListener('dragover', (e) => { const z = e.target.closest('[data-zona]'); if (z) { e.preventDefault(); z.classList.add('encima'); } });
    cont.addEventListener('dragleave', (e) => { const z = e.target.closest('[data-zona]'); if (z) z.classList.remove('encima'); });
    cont.addEventListener('drop', (e) => {
      const z = e.target.closest('[data-zona]');
      if (!z) return;
      e.preventDefault();
      const v = leer(pDet.querySelector('.tc-form'));
      pendientes.push(...[...e.dataTransfer.files].filter((a) => a.size <= ADJUNTO_MAX));
      pintarDetalle(v);
    });
    cont.addEventListener('submit', (e) => {
      if (!e.target.matches('.tc-form')) return;
      e.preventDefault();
      cerrar(e.target);
    });

    const reloj = setInterval(() => {
      if (!pDet.isConnected) return clearInterval(reloj);
      const c = pDet.querySelector('[data-reloj]');
      if (c) c.textContent = fechaHora(new Date());
    }, 1000);

    iniciar();
  };
})();
