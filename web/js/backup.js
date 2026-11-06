// Administración · Procesos · Backup: respaldo de la información en un archivo JSON (comprimido
// si el navegador lo permite), por organización y localidad.
//   Parámetros: organización y localidad (empresa); «Todas» solo para administradores (y es lo que
//   trae por defecto el superadministrador), los demás respaldan únicamente su organización y su
//   localidad. Usuario y fecha (hora, minuto, segundo) automáticos. Destino: la carpeta de la
//   computadora o del servidor que corresponde a la ruta; en Chrome y Edge los archivos se guardan
//   ahí (la carpeta se recuerda y el navegador solo pide permiso), no en Descargas. En otros
//   navegadores, que no permiten escribir en carpetas, se descargan.
//   «Generar backup» lee cada tabla en páginas (respaldo_tablas / respaldo_datos), arma el archivo,
//   lo guarda y registra el respaldo en el historial.
//   Contenido: Base de datos (respaldo SQL leído de Supabase: un INSERT por tabla que se restaura en
//   el SQL Editor), Aplicativo (los archivos de la página: index.html, estilos y programas, en JSON
//   comprimido) o Todo (los dos archivos).
//   Diseño A: alcance y contenido, programación automática y destino en tres columnas; el historial
//   (manuales y automáticos, con su resultado) abajo.
//   Backup automático (script 109): frecuencia diaria, semanal o mensual, día de la semana (semanal y
//   mensual; en la mensual, la semana del mes) y hora. Lo genera el servidor (pg_cron de Supabase) a esa hora
//   aunque nadie esté conectado; su resultado (exitoso, o el error con su detalle) queda en el historial, y el
//   archivo se copia comprimido a la carpeta de destino cuando se abre la app en esta computadora (Chrome y
//   Edge con la carpeta elegida y permiso; si falta el permiso, el botón «Copiar a la carpeta»).
(function () {
  const { esc } = window.UI;
  const POR_PAGINA = 1000;
  const fechaHora = (f) => new Date(f).toLocaleString('es-GT', { timeZone: 'America/Guatemala', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '');
  const sello = (f) => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(f); const v = (t) => p.find((x) => x.type === t).value; return `${v('year')}${v('month')}${v('day')}_${v('hour')}${v('minute')}${v('second')}`; };
  const tamano = (n) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
  const leerLocal = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
  const guardarLocal = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
  // La carpeta de destino se recuerda en IndexedDB (un FileSystemDirectoryHandle no cabe en localStorage).
  const almacen = (modo, fn) => new Promise((ok) => {
    try {
      const r = indexedDB.open('fin-backup', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('carpeta');
      r.onsuccess = () => {
        const t = r.result.transaction('carpeta', modo);
        const q = fn(t.objectStore('carpeta'));
        t.oncomplete = () => { r.result.close(); ok(q.result ?? null); };
        t.onerror = () => { r.result.close(); ok(null); };
      };
      r.onerror = () => ok(null);
    } catch { ok(null); }
  });
  const leerCarpeta = () => almacen('readonly', (st) => st.get('destino'));
  const guardarCarpeta = (h) => almacen('readwrite', (st) => st.put(h, 'destino'));
  const ultimaCarpeta = (ruta) => (ruta || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop().replace(/:$/, '');

  // Copia a la carpeta (o descarga) los backups automáticos exitosos que aún no se copiaron. Con pedir=false
  // solo copia si el navegador ya tiene permiso (al entrar a la app); con pedir=true lo solicita (botón).
  async function copiarPendientes({ pedir = false } = {}) {
    const sb = window.FIN.sb;
    const { data: lista, error } = await sb.from('respaldos_automaticos').select('id, archivo').eq('estado', 'EXITOSO').is('copiado_en', null).not('contenido', 'is', null).order('inicio');
    if (error || !lista?.length) return 0;
    const carpeta = typeof window.showDirectoryPicker === 'function' ? await leerCarpeta() : null;
    if (carpeta) {
      let p = await carpeta.queryPermission({ mode: 'readwrite' });
      if (p !== 'granted' && pedir) p = await carpeta.requestPermission({ mode: 'readwrite' });
      if (p !== 'granted') return 0;
    } else if (!pedir) return 0;
    const comprimir = typeof window.CompressionStream === 'function';
    const ruta = leerLocal('fin.backup.ruta') || carpeta?.name || 'Descargas';
    let n = 0;
    for (const x of lista) {
      const { data: sql, error: e } = await sb.rpc('backup_automatico_contenido', { p_id: x.id });
      if (e || !sql) continue;
      const nombre = x.archivo + (comprimir ? '.gz' : '');
      const blob0 = new Blob([sql], { type: 'application/sql' });
      const blob = comprimir ? await new Response(blob0.stream().pipeThrough(new CompressionStream('gzip'))).blob() : blob0;
      if (carpeta) {
        const h = await carpeta.getFileHandle(nombre, { create: true });
        const w = await h.createWritable(); await w.write(blob); await w.close();
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      }
      await sb.rpc('backup_copiado', { p_id: x.id, p_ruta: carpeta ? ruta : 'Descargas' });
      n += 1;
    }
    return n;
  }
  window.BACKUP_AUTO = { copiarPendientes };

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS.backup = function (cont) {
    const sb = window.FIN.sb;
    const yo = window.FIN.perfil();
    const admin = window.FIN.esAdmin();
    const superadmin = admin && yo.rol_id === 'superadministrador';
    let organizaciones = [];
    let localidades = [];
    let historial = [];
    let programacion = null;   // backup_programacion (undefined = falta el script 109)
    let pendientes = [];       // backups automáticos por copiar a la carpeta
    let permiso = 'prompt';    // permiso del navegador sobre la carpeta
    const prog = {};           // cambios de la programación aún sin guardar
    let carpeta = null;      // carpeta elegida (File System Access)
    let trabajando = false;
    let comprimirArchivo = true;
    const guardado = leerLocal('fin.backup.contenido');
    const contenido = { app: guardado === 'app' || guardado === 'todo', bd: guardado !== 'app' };
    const CONTENIDOS = [
      { k: 'app', icono: 'ti-code', nombre: 'Aplicativo', nota: 'Página, estilos y programas' },
      { k: 'bd', icono: 'ti-database', nombre: 'Base de datos', nota: 'Tablas y registros' },
      { k: 'todo', icono: 'ti-stack-2', nombre: 'Todo', nota: 'Aplicativo y base de datos' }
    ];
    const marcado = (k) => k === 'todo' ? contenido.app && contenido.bd : contenido[k];
    const tipoArchivo = (n) => /^backup_aplicativo_/.test(n) ? 'Aplicativo' : /^backup_todo_/.test(n) ? 'Todo' : 'Base de datos';
    // Página de respaldos del proyecto en el panel de Supabase.
    const proyecto = (window.FIN_CONFIG?.supabaseUrl || window.CONFIG?.supabaseUrl || '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] || '';
    const panelBackups = proyecto ? `https://supabase.com/dashboard/project/${proyecto}/database/backups/scheduled` : 'https://supabase.com/dashboard/projects';
    // El superadministrador respalda por defecto todas las organizaciones y todas las localidades.
    const sel = superadmin ? { org: '', loc: '' } : { org: yo.organizacion_id ? String(yo.organizacion_id) : '', loc: yo.localidad_id ? String(yo.localidad_id) : '' };
    const puedeCarpeta = typeof window.showDirectoryPicker === 'function';
    const puedeComprimir = typeof window.CompressionStream === 'function';

    const org = (id) => organizaciones.find((o) => String(o.id) === String(id));
    const loc = (id) => localidades.find((l) => String(l.id) === String(id));
    const coincide = () => { const r = ultimaCarpeta(leerLocal('fin.backup.ruta')); return !r || !carpeta || r.toLowerCase() === carpeta.name.toLowerCase(); };
    const elegirCarpeta = async () => {
      carpeta = await window.showDirectoryPicker({ id: 'fin-backup', mode: 'readwrite', ...(carpeta ? { startIn: carpeta } : {}) });
      await guardarCarpeta(carpeta);
    };

    async function iniciar() {
      const [o, l] = await Promise.all([
        sb.from('organizaciones').select('id, codigo, nombre').order('codigo'),
        sb.from('localidades').select('id, codigo, nombre_comercial, organizacion_id').order('organizacion_id').order('correlativo')
      ]);
      organizaciones = o.data || [];
      if (puedeCarpeta) carpeta = await leerCarpeta();
      if (carpeta) { try { permiso = await carpeta.queryPermission({ mode: 'readwrite' }); } catch { permiso = 'prompt'; } }
      // Al abrir la pantalla, se copian solos los automáticos pendientes si ya hay permiso.
      if (permiso === 'granted') { try { const n = await copiarPendientes(); if (n) window.FIN.aviso(n === 1 ? 'Se copió 1 backup automático a la carpeta' : `Se copiaron ${n} backups automáticos a la carpeta`); } catch { /* se reintenta con el botón */ } }
      localidades = l.data || [];
      if (!admin && (!yo.organizacion_id || !yo.localidad_id)) {
        cont.innerHTML = '<section class="panel"><p class="vacio">Tu usuario no tiene organización y localidad asignadas: pide a un administrador que las asigne para poder generar un backup.</p></section>';
        return;
      }
      await cargarHistorial();
      pintar();
    }

    async function cargarHistorial() {
      const [h, p, a] = await Promise.all([
        sb.from('respaldos').select('*').order('fecha', { ascending: false }).limit(60),
        sb.from('backup_programacion').select('*').eq('id', 1).maybeSingle(),
        sb.from('respaldos_automaticos').select('id, inicio, estado, archivo, bytes, detalle').eq('estado', 'EXITOSO').is('copiado_en', null).not('contenido', 'is', null).order('inicio')
      ]);
      historial = h.error ? null : h.data || [];
      programacion = p.error ? undefined : p.data || null;
      pendientes = a.error ? [] : a.data || [];
    }

    const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const SEMANAS = [[1, 'Primer'], [2, 'Segundo'], [3, 'Tercer'], [4, 'Cuarto'], [5, 'Último']];
    const resultado = (r) => r.estado === 'ERROR'
      ? (r.detalle ? `<details class="bu-det"><summary><span class="pc-marca anulada">Error</span> <small class="bu-error">ver detalle</small></summary><pre>${esc(r.detalle)}</pre></details>` : '<span class="pc-marca anulada">Error</span>')
      : `<span class="pc-marca aprobada">Exitoso</span>`;

    function bloqueProgramacion() {
      if (programacion === undefined) return '<p class="vacio">Falta instalar en Supabase el script <b>20261106000109_backup_programado.sql</b> (backup automático).</p>';
      const p = { activo: false, frecuencia: 'DIARIA', dia_semana: 5, semana_mes: 1, hora: '22:00', ...(programacion || {}), ...prog };
      const dis = superadmin ? '' : 'disabled';
      const alcance = `${programacion?.organizacion_id ? `${org(programacion.organizacion_id)?.codigo ?? ''} · ${org(programacion.organizacion_id)?.nombre || ''}` : 'Todas las organizaciones'} · ${programacion?.localidad_id ? `${loc(programacion.localidad_id)?.codigo || ''} · ${loc(programacion.localidad_id)?.nombre_comercial || ''}` : 'todas las localidades'}`;
      return `
        <div class="bu-prog-cab">
          <label class="pc-check bu-activo"><input type="checkbox" name="p_activo" ${p.activo ? 'checked' : ''} ${dis}> Backup automático ${p.activo ? 'activo' : 'inactivo'}</label>
          <span class="pc-marca ${programacion?.activo ? 'aprobada' : 'pendiente'}">${programacion?.activo ? 'Programado' : 'Sin programar'}</span>
        </div>
        <div class="bu-frecuencia" role="radiogroup" aria-label="Frecuencia">${['DIARIA', 'SEMANAL', 'MENSUAL'].map((f) => `<label class="${p.frecuencia === f ? 'marcada' : ''}"><input type="radio" name="p_frecuencia" value="${f}" ${p.frecuencia === f ? 'checked' : ''} ${dis}> ${f.charAt(0) + f.slice(1).toLowerCase()}</label>`).join('')}</div>
        <div class="bu-prog-campos">
          ${p.frecuencia === 'MENSUAL' ? `<label class="campo"><span>Semana del mes</span><select name="p_semana" ${dis}>${SEMANAS.map(([v, t]) => `<option value="${v}" ${Number(p.semana_mes) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
          ${p.frecuencia !== 'DIARIA' ? `<label class="campo"><span>Día de la semana</span><select name="p_dia" ${dis}>${DIAS.map((d, i) => `<option value="${i + 1}" ${Number(p.dia_semana) === i + 1 ? 'selected' : ''}>${d}</option>`).join('')}</select></label>` : ''}
          <label class="campo"><span>Hora de ejecución</span><input type="time" name="p_hora" value="${esc(String(p.hora || '22:00').slice(0, 5))}" ${dis}></label>
        </div>
        <dl class="bu-prog-datos">
          <div class="bm-dato"><dt>Próximo backup</dt><dd><b>${programacion?.activo && programacion?.proximo ? esc(fechaHora(programacion.proximo)) : '—'}</b></dd></div>
          <div class="bm-dato"><dt>Último backup</dt><dd>${programacion?.ultimo ? `<b>${esc(fechaHora(programacion.ultimo))}</b> ${resultado({ estado: programacion.ultimo_estado, detalle: programacion.ultimo_estado === 'ERROR' ? programacion.ultimo_detalle : '' })}` : '<b>—</b>'}</dd></div>
          <div class="bm-dato bu-c2"><dt>Qué respalda</dt><dd><small>Base de datos · ${esc(alcance)}. Lo genera el servidor (Supabase) a la hora indicada, aunque nadie esté conectado, y se copia a la carpeta al abrir la app en esta computadora.</small></dd></div>
        </dl>
        ${superadmin ? `<div class="bu-prog-acc"><button type="button" class="boton primario-sm" data-guardar-prog><i class="ti ti-calendar-check" aria-hidden="true"></i> Guardar programación</button>
          <button type="button" class="boton secundario-sm" data-probar title="Genera ahora el backup automático en el servidor para comprobar que funciona"><i class="ti ti-player-play" aria-hidden="true"></i> Probar ahora</button></div>
          <p class="bu-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> Al guardar se toma el alcance elegido a la izquierda.</p>` : '<p class="bu-nota">Solo el Super Administrador cambia la programación.</p>'}`;
    }

    function pintar() {
      const locs = localidades.filter((l) => !sel.org || String(l.organizacion_id) === sel.org);
      if (sel.loc && !locs.some((l) => String(l.id) === sel.loc)) sel.loc = admin ? '' : sel.loc;
      cont.innerHTML = `
        <div class="bu-espacio bu-a">
          <form class="tk-form ta-form bm-form bu-form" novalidate>
            <header class="tk-titulo bm-titulo">
              <span class="tk-icono"><i class="ti ti-database-export" aria-hidden="true"></i></span>
              <div class="tk-titulo-texto"><small>Administración · Procesos</small><h2>Backup de la información</h2></div>
              <div class="tk-marcas">${superadmin ? '<span class="pc-marca definitiva"><i class="ti ti-shield-check" aria-hidden="true"></i> Super administrador: todas las organizaciones y localidades</span>' : admin ? '<span class="pc-marca definitiva"><i class="ti ti-shield-check" aria-hidden="true"></i> Administrador: puede respaldar todas</span>' : '<span class="pc-marca pendiente">Solo tu organización y localidad</span>'}
                <span class="bu-usuario"><i class="ti ti-user" aria-hidden="true"></i> ${esc((yo.usuario || '').toUpperCase())} · <b data-reloj>${esc(fechaHora(new Date()))}</b></span></div>
              <div class="tk-titulo-acciones">${contenido.bd ? `<a class="boton secundario-sm" href="${panelBackups}" target="_blank" rel="noopener" title="Respaldos del proyecto en el panel de Supabase"><i class="ti ti-external-link" aria-hidden="true"></i> Backups en Supabase</a>` : ''}
                <button type="submit" class="boton primario-sm" data-generar><i class="ti ti-database-export" aria-hidden="true"></i> Generar backup ahora</button></div>
            </header>
            <p class="modal-error tk-error" role="alert"></p>
            ${pendientes.length ? `<p class="tk-aviso bu-pendientes"><i class="ti ti-cloud-download" aria-hidden="true"></i> ${pendientes.length === 1 ? 'Hay 1 backup automático' : `Hay ${pendientes.length} backups automáticos`} del servidor por copiar a la carpeta${carpeta ? ` <b>${esc(carpeta.name)}</b>` : ''}.
              ${puedeCarpeta ? '<button type="button" class="boton primario-sm" data-copiar><i class="ti ti-copy" aria-hidden="true"></i> Copiar a la carpeta</button>' : '<button type="button" class="boton primario-sm" data-copiar><i class="ti ti-download" aria-hidden="true"></i> Descargar</button>'}</p>` : ''}

            <div class="bu-tarjetas">
              <section class="bm-bloque">
                <h3 class="ta-col-titulo"><i class="ti ti-building" aria-hidden="true"></i> Alcance y contenido</h3>
                <label class="campo"><span>Organización</span><select name="org" ${admin && contenido.bd ? '' : 'disabled'}>
                  ${admin ? `<option value="" ${sel.org ? '' : 'selected'}>Todas las organizaciones</option>` : ''}
                  ${organizaciones.filter((o) => admin || String(o.id) === sel.org).map((o) => `<option value="${o.id}" ${String(o.id) === sel.org ? 'selected' : ''}>${o.codigo} · ${esc(o.nombre)}</option>`).join('')}</select></label>
                <label class="campo"><span>Localidad (empresa)</span><select name="loc" ${admin && contenido.bd ? '' : 'disabled'}>
                  ${admin ? `<option value="" ${sel.loc ? '' : 'selected'}>${sel.org ? 'Todas las localidades de la organización' : 'Todas las localidades'}</option>` : ''}
                  ${locs.filter((l) => admin || String(l.id) === sel.loc).map((l) => `<option value="${l.id}" ${String(l.id) === sel.loc ? 'selected' : ''}>${esc(l.codigo)} · ${esc(l.nombre_comercial)}</option>`).join('')}</select></label>
                <fieldset class="bu-contenido"><legend>Respaldar</legend>
                  ${CONTENIDOS.map((c) => `<label class="bu-opcion${marcado(c.k) ? ' marcada' : ''}"><input type="checkbox" name="contenido" value="${c.k}" ${marcado(c.k) ? 'checked' : ''}><i class="ti ${c.icono}" aria-hidden="true"></i><span><b>${c.nombre}</b><small>${c.nota}</small></span></label>`).join('')}
                </fieldset>
                <div class="bu-formato">${puedeComprimir ? `<label class="pc-check"><input type="checkbox" name="comprimir" ${comprimirArchivo ? 'checked' : ''}> Comprimir</label>` : ''}
                  <small>${contenido.bd ? `Base de datos: SQL${puedeComprimir && comprimirArchivo ? ' (.sql.gz)' : ' (.sql)'}` : ''}${contenido.app && contenido.bd ? ' · ' : ''}${contenido.app ? `Aplicativo: JSON${puedeComprimir && comprimirArchivo ? ' (.json.gz)' : ''}` : ''}</small></div>
                <p class="bu-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> ${!contenido.bd ? 'El aplicativo es el mismo para todas las organizaciones.' : admin ? 'Las tablas generales (monedas, bancos, países, roles…) se incluyen siempre.' : 'Solo los administradores respaldan otras organizaciones.'}</p>
              </section>

              <section class="bm-bloque bu-prog">
                <h3 class="ta-col-titulo"><i class="ti ti-calendar-time" aria-hidden="true"></i> Programación automática</h3>
                ${bloqueProgramacion()}
              </section>

              <section class="bm-bloque">
                <h3 class="ta-col-titulo"><i class="ti ti-folder" aria-hidden="true"></i> Destino</h3>
                <label class="campo"><span>Directorio o ruta (computadora o servidor)</span><input name="ruta" value="${esc(leerLocal('fin.backup.ruta'))}" placeholder="Ej. D:\\Respaldos\\Financiero o \\\\SERVIDOR\\Respaldos" maxlength="300"></label>
                ${puedeCarpeta ? `<div class="bu-carpeta">
                    <button type="button" class="boton secundario-sm" data-carpeta><i class="ti ti-folder-open" aria-hidden="true"></i> ${carpeta ? 'Cambiar carpeta' : 'Elegir carpeta…'}</button>
                    <span>${carpeta ? `<i class="ti ti-folder-check" aria-hidden="true"></i> Se guarda en la carpeta <b>${esc(carpeta.name)}</b>${permiso === 'granted' ? ' · permiso concedido' : ' · el navegador pedirá permiso'}.` : 'Elige la carpeta de la ruta (también una carpeta compartida del servidor).'}</span></div>
                  ${carpeta && !coincide() ? `<p class="bu-nota bu-aviso"><i class="ti ti-alert-triangle" aria-hidden="true"></i> La carpeta elegida (<b>${esc(carpeta.name)}</b>) no coincide con la ruta: pulsa «Cambiar carpeta» y busca ${esc(leerLocal('fin.backup.ruta'))}.</p>` : ''}`
                  : '<p class="bu-nota"><i class="ti ti-download" aria-hidden="true"></i> Este navegador no permite elegir la carpeta: el archivo se descarga. En Chrome o Edge se guarda directo en la carpeta.</p>'}
                <p class="bu-nota"><i class="ti ti-refresh" aria-hidden="true"></i> Los backups automáticos se copian aquí al abrir la app en esta computadora.</p>
              </section>
            </div>

            <section class="bu-progreso" data-progreso hidden>
              <div class="bu-barra"><i data-barra style="width:0%"></i></div>
              <span data-estado></span>
            </section>

            <section class="bm-bloque bu-historial">
              <h3 class="ta-col-titulo"><i class="ti ti-history" aria-hidden="true"></i> Historial de backups <small>manuales y automáticos, con su resultado</small></h3>
              ${historial === null ? '<p class="vacio">Falta instalar el script 49 (backup) en Supabase.</p>' : `
              <div class="pc-lineas bu-tabla"><table>
                <thead><tr><th>Fecha y hora</th><th>Origen</th><th>Contenido</th><th>Usuario</th><th>Organización</th><th>Localidad</th><th>Archivo</th><th>Ruta</th><th class="num">Tablas</th><th class="num">Registros</th><th class="num">Tamaño</th><th>Resultado</th></tr></thead>
                <tbody>${historial.map((r) => `<tr class="${r.estado === 'ERROR' ? 'bu-fila-error' : ''}"><td>${esc(fechaHora(r.fecha))}</td><td>${r.origen === 'AUTOMÁTICO' ? '<span class="pc-tipo">Automático</span>' : 'Manual'}</td><td>${tipoArchivo(r.archivo)}</td><td>${esc(r.usuario || '')}</td><td>${esc(r.organizacion_id ? `${org(r.organizacion_id)?.codigo ?? ''} · ${org(r.organizacion_id)?.nombre || ''}` : 'TODAS')}</td><td>${esc(r.localidad_id ? `${loc(r.localidad_id)?.codigo || ''} · ${loc(r.localidad_id)?.nombre_comercial || ''}` : 'TODAS')}</td><td class="fuerte">${esc(r.archivo)}</td><td>${esc(r.ruta || '')}</td><td class="num">${r.tablas}</td><td class="num">${Number(r.registros).toLocaleString('es-GT')}</td><td class="num">${tamano(Number(r.bytes))}</td><td>${resultado(r)}</td></tr>`).join('')
                  || '<tr><td colspan="12" class="tk-vacio"><i class="ti ti-database" aria-hidden="true"></i>Todavía no se ha generado ningún backup.</td></tr>'}</tbody>
              </table></div>`}
            </section>
          </form>
        </div>`;
    }

    const progreso = (pct, txt) => {
      const p = cont.querySelector('[data-progreso]');
      p.hidden = false;
      p.querySelector('[data-barra]').style.width = `${Math.min(100, pct)}%`;
      p.querySelector('[data-estado]').innerHTML = txt;
    };

    // Archivos del aplicativo: index.html y los estilos y programas propios que carga (los del
    // mismo sitio); las librerías externas (CDN) se anotan con su dirección.
    async function leerAplicativo(desde, hasta) {
      progreso(desde + 1, 'Leyendo el aplicativo…');
      const raiz = new URL('./', location.href);
      const leer = async (ruta) => {
        const r = await fetch(new URL(ruta, raiz), { cache: 'no-store' });
        if (!r.ok) throw new Error(`No se pudo leer ${ruta} del aplicativo (${r.status}).`);
        return r.text();
      };
      const indice = await leer('index.html');
      const doc = new DOMParser().parseFromString(indice, 'text/html');
      const propias = [];
      const librerias = [];
      doc.querySelectorAll('script[src], link[rel=stylesheet][href]').forEach((n) => {
        const url = new URL(n.getAttribute('src') || n.getAttribute('href'), raiz);
        if (url.origin === raiz.origin && url.pathname.startsWith(raiz.pathname)) propias.push(url.pathname.slice(raiz.pathname.length));
        else librerias.push(url.href);
      });
      const unicas = [...new Set(propias)];
      const archivos = { 'index.html': indice };
      let n = 0;
      for (const ruta of unicas) {
        archivos[ruta] = await leer(ruta);
        n += 1;
        progreso(desde + 1 + n / unicas.length * (hasta - desde - 1), `Leyendo el aplicativo · <b>${esc(ruta)}</b> · ${n} de ${unicas.length} archivos`);
      }
      return { origen: raiz.href, archivos, librerias };
    }

    const empacar = async (texto, tipo, comprimir) => {
      const blob = new Blob([texto], { type: tipo });
      return comprimir ? new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob() : blob;
    };
    // Respaldo SQL: se restaura pegándolo en el SQL Editor de Supabase. Sin disparadores mientras se
    // carga (session_replication_role) y sin duplicar lo que ya exista (on conflict do nothing).
    function cabeceraSql(inicio, o, l, tablas, ruta) {
      return [
        '-- Backup de la base de datos · Financiero CONSISAV (Supabase)',
        `-- Generado: ${fechaHora(inicio)} (hora de Guatemala) · usuario ${(yo.usuario || '').toUpperCase()}`,
        `-- Organización: ${o ? `${o.codigo} · ${o.nombre}` : 'TODAS'} · Localidad: ${l ? `${l.codigo} · ${l.nombre_comercial}` : 'TODAS'}`,
        `-- Tablas: ${tablas.length}${ruta ? ` · ruta ${ruta}` : ''}`,
        '-- Restaurar: abrir el SQL Editor del proyecto en Supabase, pegar este archivo y ejecutarlo.',
        '-- La estructura (tablas y funciones) se crea con los scripts de supabase/migrations.',
        '',
        'begin;',
        'set session_replication_role = replica;',
        ''
      ].join('\n');
    }
    function insertSql(tabla, filas, general, columnas) {
      if (!filas.length) return `\n-- ${tabla}: sin registros\n`;
      const lineas = [`\n-- ${tabla}: ${filas.length} registros${general ? ' (tabla general)' : ''}`];
      // Sin las columnas calculadas (por ejemplo costo_total): la base las recalcula al restaurar.
      const cols = columnas?.length ? columnas.map((c) => `"${c.replace(/"/g, '""')}"`).join(', ') : null;
      for (let i = 0; i < filas.length; i += 500) {
        const json = JSON.stringify(filas.slice(i, i + 500)).replace(/'/g, "''");
        lineas.push(cols
          ? `insert into public."${tabla}" (${cols}) overriding system value select ${cols} from jsonb_populate_recordset(null::public."${tabla}", '${json}'::jsonb) on conflict do nothing;`
          : `insert into public."${tabla}" overriding system value select * from jsonb_populate_recordset(null::public."${tabla}", '${json}'::jsonb) on conflict do nothing;`);
      }
      return `${lineas.join('\n')}\n`;
    }

    async function generar(form) {
      if (trabajando) return;
      const error = form.querySelector('.modal-error');
      error.textContent = '';
      const pOrg = sel.org ? Number(sel.org) : null;
      const pLoc = sel.loc ? Number(sel.loc) : null;
      if (!admin && (pOrg !== yo.organizacion_id || pLoc !== yo.localidad_id)) { error.textContent = 'Solo puedes respaldar tu organización y tu localidad.'; return; }
      if (!contenido.app && !contenido.bd) { error.textContent = 'Marca qué deseas respaldar: aplicativo, base de datos o todo.'; return; }
      const ruta = form.elements.ruta.value.trim();
      if (!ruta && !carpeta) { error.textContent = 'Escribe el directorio o la ruta donde se alojará el backup.'; return; }
      guardarLocal('fin.backup.ruta', ruta);
      if (puedeCarpeta) {
        // Con el clic todavía vigente: elegir la carpeta o renovar el permiso antes de leer datos.
        try {
          if (!carpeta) await elegirCarpeta();
          else if (await carpeta.queryPermission({ mode: 'readwrite' }) !== 'granted' && await carpeta.requestPermission({ mode: 'readwrite' }) !== 'granted') {
            error.textContent = 'El navegador no dio permiso para escribir en la carpeta de destino.';
            return;
          }
        } catch (err) {
          if (err?.name !== 'AbortError') { carpeta = null; pintar(); }
          cont.querySelector('.modal-error').textContent = err?.name === 'AbortError' ? 'Elige la carpeta de destino: ahí se guardará el backup.' : 'No se pudo abrir la carpeta de destino: elígela de nuevo.';
          return;
        }
      }
      const comprimir = !!form.elements.comprimir?.checked;
      const boton = form.querySelector('[data-generar]');
      trabajando = true;
      boton.disabled = true;
      const inicio = new Date();
      try {
        const o = pOrg ? org(pOrg) : null;
        const l = pLoc ? loc(pLoc) : null;
        const alcance = `${o ? `org${o.codigo}` : 'TODAS'}_${l ? `loc${l.codigo}` : 'TODAS'}`;
        const gz = comprimir ? '.gz' : '';
        const archivos = [];
        // a) Base de datos: respaldo SQL leído de Supabase.
        if (contenido.bd) {
          const tope = contenido.app ? 80 : 92;
          progreso(1, 'Conectando con Supabase: revisando las tablas…');
          const r1 = await sb.rpc('respaldo_tablas', { p_org: pOrg, p_loc: pLoc });
          if (r1.error) throw r1.error;
          const tablas = r1.data;
          const total = tablas.reduce((t, x) => t + Number(x.filas), 0) || 1;
          let leidas = 0;
          const partes = [cabeceraSql(inicio, o, l, tablas, ruta)];
          for (const t of tablas) {
            const filas = [];
            for (let desde = 0; desde < Number(t.filas); desde += POR_PAGINA) {
              const { data, error: e2 } = await sb.rpc('respaldo_datos', { p_tabla: t.tabla, p_org: pOrg, p_loc: pLoc, p_desde: desde, p_cantidad: POR_PAGINA });
              if (e2) throw e2;
              filas.push(...data);
              leidas += data.length;
              progreso(2 + leidas / total * (tope - 2), `Supabase · leyendo <b>${esc(t.tabla)}</b> · ${leidas.toLocaleString('es-GT')} de ${total.toLocaleString('es-GT')} registros`);
              if (data.length < POR_PAGINA) break;
            }
            const rc = filas.length ? await sb.rpc('respaldo_columnas', { p_tabla: t.tabla }) : { data: null };
            partes.push(insertSql(t.tabla, filas, t.general, rc.error ? null : rc.data));
          }
          partes.push('\nset session_replication_role = origin;\ncommit;\n');
          archivos.push({ nombre: `backup_bd_${alcance}_${sello(inicio)}.sql${gz}`, blob: await empacar(partes.join(''), 'application/sql', comprimir), tablas: tablas.length, registros: leidas, que: `${tablas.length} tablas · ${leidas.toLocaleString('es-GT')} registros` });
        }
        // b) Aplicativo: JSON comprimido con los archivos de la página.
        if (contenido.app) {
          const desde = contenido.bd ? 80 : 0;
          const aplicativo = await leerAplicativo(desde, contenido.bd ? 92 : 92);
          const respaldo = {
            sistema: 'Financiero CONSISAV', formato: 1, contenido: 'APLICATIVO', generado: inicio.toISOString(), generado_local: fechaHora(inicio),
            usuario: (yo.usuario || '').toUpperCase(), ruta: ruta || null, aplicativo
          };
          const n = Object.keys(aplicativo.archivos).length;
          archivos.push({ nombre: `backup_aplicativo_${sello(inicio)}.json${gz}`, blob: await empacar(JSON.stringify(respaldo), 'application/json', comprimir), tablas: 0, registros: 0, que: `${n} archivos del aplicativo` });
        }
        let destino = ruta;
        const hechos = [];
        for (const [i, x] of archivos.entries()) {
          progreso(94 + i * 3, `Guardando <b>${esc(x.nombre)}</b>…`);
          if (carpeta) {
            const archivo = await carpeta.getFileHandle(x.nombre, { create: true });
            const w = await archivo.createWritable();
            await w.write(x.blob);
            await w.close();
            destino = coincide() ? ruta || carpeta.name : carpeta.name;
          } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(x.blob);
            a.download = x.nombre;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 30000);
            if (i < archivos.length - 1) await new Promise((r) => setTimeout(r, 700));
          }
          const { error: e3 } = await sb.from('respaldos').insert({ organizacion_id: pOrg, localidad_id: pLoc, archivo: x.nombre, ruta: destino || null, tablas: x.tablas, registros: x.registros, bytes: x.blob.size });
          hechos.push(`<b>${esc(x.nombre)}</b> · ${x.que} · ${tamano(x.blob.size)}${e3 ? ' · <span class="pc-rojo">no se pudo registrar en el historial</span>' : ''}`);
        }
        await cargarHistorial();
        pintar();
        progreso(100, `<i class="ti ti-circle-check" aria-hidden="true"></i> ${archivos.length > 1 ? 'Se generaron dos archivos' : 'Backup generado'}${carpeta ? ` en la carpeta ${esc(carpeta.name)}` : ' (descargado)'}:<br>${hechos.join('<br>')}`);
        window.FIN.aviso(archivos.length > 1 ? 'Backups generados' : 'Backup generado');
      } catch (err) {
        const msg = err?.name === 'NotAllowedError' ? 'El navegador no dio permiso para escribir en la carpeta: elígela de nuevo.' : /respaldo_/.test(err?.message || '') && /function|schema cache/.test(err?.message || '') ? 'Falta instalar el script 49 (backup) en Supabase.' : window.UI.traducirError(err);
        progreso(0, '');
        cont.querySelector('[data-progreso]').hidden = true;
        cont.querySelector('.modal-error').textContent = msg;
      } finally {
        trabajando = false;
        const b = cont.querySelector('[data-generar]');
        if (b) b.disabled = false;
      }
    }

    cont.addEventListener('change', (e) => {
      if (e.target.name === 'org') { sel.org = e.target.value; sel.loc = ''; return pintar(); }
      if (e.target.name === 'loc') { sel.loc = e.target.value; return pintar(); }
      if (e.target.name === 'comprimir') { comprimirArchivo = e.target.checked; return pintar(); }
      if (e.target.name === 'p_activo') { prog.activo = e.target.checked; return pintar(); }
      if (e.target.name === 'p_frecuencia') { prog.frecuencia = e.target.value; return pintar(); }
      if (e.target.name === 'p_dia') { prog.dia_semana = Number(e.target.value); return; }
      if (e.target.name === 'p_semana') { prog.semana_mes = Number(e.target.value); return; }
      if (e.target.name === 'p_hora') { prog.hora = e.target.value; return; }
      if (e.target.name === 'contenido') {
        const k = e.target.value;
        if (k === 'todo') { contenido.app = e.target.checked; contenido.bd = e.target.checked; } else contenido[k] = e.target.checked;
        guardarLocal('fin.backup.contenido', contenido.app && contenido.bd ? 'todo' : contenido.app ? 'app' : contenido.bd ? 'bd' : 'ninguno');
        pintar();
      }
    });
    // La ruta escrita se recuerda (también al repintar el formulario).
    cont.addEventListener('input', (e) => { if (e.target.name === 'ruta') guardarLocal('fin.backup.ruta', e.target.value.trim()); });
    cont.addEventListener('click', async (e) => {
      const error = () => cont.querySelector('.modal-error');
      if (e.target.closest('[data-guardar-prog]')) {
        const p = { activo: false, frecuencia: 'DIARIA', dia_semana: 5, semana_mes: 1, hora: '22:00', ...(programacion || {}), ...prog };
        if (!p.hora) { error().textContent = 'Indica la hora de ejecución del backup automático.'; return; }
        if (p.frecuencia !== 'DIARIA' && !p.dia_semana) { error().textContent = 'Indica el día de la semana.'; return; }
        const { error: e1 } = await sb.from('backup_programacion').update({ activo: !!p.activo, frecuencia: p.frecuencia, dia_semana: p.frecuencia === 'DIARIA' ? null : Number(p.dia_semana),
          semana_mes: p.frecuencia === 'MENSUAL' ? Number(p.semana_mes || 1) : null, hora: p.hora, organizacion_id: sel.org ? Number(sel.org) : null, localidad_id: sel.loc ? Number(sel.loc) : null }).eq('id', 1);
        if (e1) { error().textContent = window.UI.traducirError(e1); return; }
        Object.keys(prog).forEach((k) => delete prog[k]);
        await cargarHistorial(); pintar();
        window.FIN.aviso(programacion?.activo ? `Backup automático programado · próximo ${fechaHora(programacion.proximo)}` : 'Backup automático desactivado');
        return;
      }
      if (e.target.closest('[data-probar]')) {
        const b = e.target.closest('[data-probar]'); b.disabled = true;
        progreso(30, 'Generando el backup automático en el servidor…');
        const { data, error: e2 } = await sb.rpc('probar_backup_programado');
        cont.querySelector('[data-progreso]').hidden = true;
        if (e2) { b.disabled = false; error().textContent = window.UI.traducirError(e2); return; }
        await cargarHistorial(); pintar();
        window.FIN.aviso(data === 'EXITOSO' ? 'Backup automático de prueba: exitoso' : 'El backup automático de prueba tuvo un error: mira el detalle en el historial');
        return;
      }
      if (e.target.closest('[data-copiar]')) {
        try {
          const n = await copiarPendientes({ pedir: true });
          if (carpeta) { try { permiso = await carpeta.queryPermission({ mode: 'readwrite' }); } catch { /* sin permiso */ } }
          await cargarHistorial(); pintar();
          window.FIN.aviso(n ? (n === 1 ? 'Se copió 1 backup automático' : `Se copiaron ${n} backups automáticos`) : 'No se copió ningún backup: revisa el permiso de la carpeta');
        } catch (err) { error().textContent = err?.name === 'NotAllowedError' ? 'El navegador no dio permiso para escribir en la carpeta.' : window.UI.traducirError(err); }
        return;
      }
      if (!e.target.closest('[data-carpeta]')) return;
      try {
        await elegirCarpeta();
        permiso = 'granted';
        const ruta = cont.querySelector('[name=ruta]');
        if (ruta && !ruta.value.trim()) guardarLocal('fin.backup.ruta', carpeta.name);
        pintar();
      } catch (err) {
        if (err?.name !== 'AbortError') window.FIN.aviso('No se pudo abrir la carpeta');
      }
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.bu-form')) { e.preventDefault(); generar(e.target); } });

    const reloj = setInterval(() => {
      if (!cont.isConnected) return clearInterval(reloj);
      const r = cont.querySelector('[data-reloj]');
      if (r) r.textContent = fechaHora(new Date());
    }, 1000);

    iniciar();
  };
})();
