// Administración · Procesos · Backup: respaldo de la información en un archivo JSON (comprimido
// si el navegador lo permite), por organización y localidad.
//   Parámetros: organización y localidad (empresa); «Todas» solo para administradores, los demás
//   respaldan únicamente su organización y su localidad. Usuario y fecha (hora, minuto, segundo)
//   automáticos. Destino: carpeta de la computadora o del servidor (en Chrome y Edge se elige y el
//   archivo se guarda ahí; en otros navegadores se descarga) y la ruta como referencia.
//   «Generar backup» lee cada tabla en páginas (respaldo_tablas / respaldo_datos), arma el archivo,
//   lo guarda y registra el respaldo en el historial.
//   Contenido: Aplicativo (los archivos de la página: index.html, estilos y programas, leídos del
//   sitio publicado), Base de datos (las tablas) o Todo (ambos en el mismo archivo).
(function () {
  const { esc } = window.UI;
  const POR_PAGINA = 1000;
  const fechaHora = (f) => new Date(f).toLocaleString('es-GT', { timeZone: 'America/Guatemala', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '');
  const sello = (f) => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(f); const v = (t) => p.find((x) => x.type === t).value; return `${v('year')}${v('month')}${v('day')}_${v('hour')}${v('minute')}${v('second')}`; };
  const tamano = (n) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
  const leerLocal = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
  const guardarLocal = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS.backup = function (cont) {
    const sb = window.FIN.sb;
    const yo = window.FIN.perfil();
    const admin = window.FIN.esAdmin();
    let organizaciones = [];
    let localidades = [];
    let historial = [];
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
    const sel = { org: yo.organizacion_id ? String(yo.organizacion_id) : '', loc: yo.localidad_id ? String(yo.localidad_id) : '' };
    const puedeCarpeta = typeof window.showDirectoryPicker === 'function';
    const puedeComprimir = typeof window.CompressionStream === 'function';

    const org = (id) => organizaciones.find((o) => String(o.id) === String(id));
    const loc = (id) => localidades.find((l) => String(l.id) === String(id));

    async function iniciar() {
      const [o, l] = await Promise.all([
        sb.from('organizaciones').select('id, codigo, nombre').order('codigo'),
        sb.from('localidades').select('id, codigo, nombre_comercial, organizacion_id').order('organizacion_id').order('correlativo')
      ]);
      organizaciones = o.data || [];
      localidades = l.data || [];
      if (!admin && (!yo.organizacion_id || !yo.localidad_id)) {
        cont.innerHTML = '<section class="panel"><p class="vacio">Tu usuario no tiene organización y localidad asignadas: pide a un administrador que las asigne para poder generar un backup.</p></section>';
        return;
      }
      await cargarHistorial();
      pintar();
    }

    async function cargarHistorial() {
      const { data, error } = await sb.from('respaldos').select('*').order('fecha', { ascending: false }).limit(50);
      historial = error ? null : data || [];
    }

    function pintar() {
      const locs = localidades.filter((l) => !sel.org || String(l.organizacion_id) === sel.org);
      if (sel.loc && !locs.some((l) => String(l.id) === sel.loc)) sel.loc = admin ? '' : sel.loc;
      cont.innerHTML = `
        <div class="bu-espacio">
          <form class="tk-form ta-form bm-form bu-form" novalidate>
            <header class="tk-titulo bm-titulo">
              <span class="tk-icono"><i class="ti ti-database-export" aria-hidden="true"></i></span>
              <div class="tk-titulo-texto"><small>Administración · Procesos</small><h2>Backup de la información</h2></div>
              <div class="tk-marcas">${admin ? '<span class="pc-marca definitiva"><i class="ti ti-shield-check" aria-hidden="true"></i> Administrador: puede respaldar todas</span>' : '<span class="pc-marca pendiente">Solo tu organización y localidad</span>'}</div>
              <div class="tk-titulo-acciones"><button type="submit" class="boton primario-sm" data-generar><i class="ti ti-database-export" aria-hidden="true"></i> Generar backup</button></div>
            </header>
            <p class="modal-error tk-error" role="alert"></p>

            <div class="bu-tarjetas">
              <section class="bm-bloque">
                <h3 class="ta-col-titulo"><i class="ti ti-building" aria-hidden="true"></i> Alcance del backup</h3>
                <div class="bu-linea">
                <label class="campo"><span>Organización</span><select name="org" ${admin && contenido.bd ? '' : 'disabled'}>
                  ${admin ? `<option value="" ${sel.org ? '' : 'selected'}>Todas las organizaciones</option>` : ''}
                  ${organizaciones.filter((o) => admin || String(o.id) === sel.org).map((o) => `<option value="${o.id}" ${String(o.id) === sel.org ? 'selected' : ''}>${o.codigo} · ${esc(o.nombre)}</option>`).join('')}</select></label>
                <label class="campo"><span>Localidad (empresa)</span><select name="loc" ${admin && contenido.bd ? '' : 'disabled'}>
                  ${admin ? `<option value="" ${sel.loc ? '' : 'selected'}>${sel.org ? 'Todas las localidades de la organización' : 'Todas las localidades'}</option>` : ''}
                  ${locs.filter((l) => admin || String(l.id) === sel.loc).map((l) => `<option value="${l.id}" ${String(l.id) === sel.loc ? 'selected' : ''}>${esc(l.codigo)} · ${esc(l.nombre_comercial)}</option>`).join('')}</select></label>
                </div>
                <fieldset class="bu-contenido"><legend>Respaldar</legend>
                  ${CONTENIDOS.map((c) => `<label class="bu-opcion${marcado(c.k) ? ' marcada' : ''}"><input type="checkbox" name="contenido" value="${c.k}" ${marcado(c.k) ? 'checked' : ''}><i class="ti ${c.icono}" aria-hidden="true"></i><span><b>${c.nombre}</b><small>${c.nota}</small></span></label>`).join('')}
                </fieldset>
                <p class="bu-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> ${!contenido.bd ? 'El aplicativo es el mismo para todas las organizaciones: la organización y la localidad aplican a la base de datos.' : admin ? 'Las tablas generales del sistema (monedas, bancos, países, roles…) se incluyen siempre.' : 'Solo los administradores pueden respaldar otras organizaciones o todas.'}</p>
              </section>

              <section class="bm-bloque">
                <h3 class="ta-col-titulo"><i class="ti ti-user-check" aria-hidden="true"></i> Control</h3>
                <div class="bu-control">
                  <div class="bm-dato"><dt>Usuario</dt><dd><b>${esc((yo.usuario || '').toUpperCase())}</b><small>${esc(yo.nombre || yo.correo || '')}</small></dd></div>
                  <div class="bm-dato"><dt>Fecha y hora</dt><dd><b data-reloj>${esc(fechaHora(new Date()))}</b><small>Hora de Guatemala</small></dd></div>
                  <div class="bm-dato"><dt>Formato</dt><dd><b>JSON${puedeComprimir ? ' comprimido (.json.gz)' : ' (.json)'}</b><small>Una sección por tabla</small></dd></div>
                </div>
                ${puedeComprimir ? `<label class="pc-check"><input type="checkbox" name="comprimir" ${comprimirArchivo ? 'checked' : ''}> Comprimir el archivo</label>` : ''}
              </section>

              <section class="bm-bloque">
                <h3 class="ta-col-titulo"><i class="ti ti-folder" aria-hidden="true"></i> Destino</h3>
                <label class="campo"><span>Directorio o ruta (computadora o servidor)</span><input name="ruta" value="${esc(leerLocal('fin.backup.ruta'))}" placeholder="Ej. D:\\Respaldos\\Financiero o \\\\SERVIDOR\\Respaldos" maxlength="300"></label>
                ${puedeCarpeta ? `<div class="bu-carpeta">
                    <button type="button" class="boton secundario-sm" data-carpeta><i class="ti ti-folder-open" aria-hidden="true"></i> ${carpeta ? 'Cambiar carpeta' : 'Elegir carpeta…'}</button>
                    <span>${carpeta ? `<i class="ti ti-folder-check" aria-hidden="true"></i> Se guardará en la carpeta <b>${esc(carpeta.name)}</b>` : 'Elige la carpeta donde se guardará el archivo (también una carpeta compartida del servidor).'}</span></div>`
                  : '<p class="bu-nota"><i class="ti ti-download" aria-hidden="true"></i> Este navegador no permite elegir la carpeta: el archivo se descarga y después lo mueves a la ruta indicada. En Chrome o Edge se guarda directo en la carpeta elegida.</p>'}
              </section>
            </div>

            <section class="bu-progreso" data-progreso hidden>
              <div class="bu-barra"><i data-barra style="width:0%"></i></div>
              <span data-estado></span>
            </section>

            <section class="bm-bloque bu-historial">
              <h3 class="ta-col-titulo"><i class="ti ti-history" aria-hidden="true"></i> Historial de backups</h3>
              ${historial === null ? '<p class="vacio">Falta instalar el script 49 (backup) en Supabase.</p>' : `
              <div class="pc-lineas"><table>
                <thead><tr><th>Fecha y hora</th><th>Contenido</th><th>Usuario</th><th>Organización</th><th>Localidad</th><th>Archivo</th><th>Ruta</th><th class="num">Tablas</th><th class="num">Registros</th><th class="num">Tamaño</th></tr></thead>
                <tbody>${historial.map((r) => `<tr><td>${esc(fechaHora(r.fecha))}</td><td>${tipoArchivo(r.archivo)}</td><td>${esc(r.usuario || '')}</td><td>${esc(r.organizacion_id ? `${org(r.organizacion_id)?.codigo ?? ''} · ${org(r.organizacion_id)?.nombre || ''}` : 'TODAS')}</td><td>${esc(r.localidad_id ? `${loc(r.localidad_id)?.codigo || ''} · ${loc(r.localidad_id)?.nombre_comercial || ''}` : 'TODAS')}</td><td class="fuerte">${esc(r.archivo)}</td><td>${esc(r.ruta || '')}</td><td class="num">${r.tablas}</td><td class="num">${Number(r.registros).toLocaleString('es-GT')}</td><td class="num">${tamano(Number(r.bytes))}</td></tr>`).join('')
                  || '<tr><td colspan="10" class="tk-vacio"><i class="ti ti-database" aria-hidden="true"></i>Todavía no se ha generado ningún backup.</td></tr>'}</tbody>
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
    async function leerAplicativo(hasta) {
      progreso(1, 'Leyendo el aplicativo…');
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
        progreso(1 + n / unicas.length * (hasta - 1), `Leyendo el aplicativo · <b>${esc(ruta)}</b> · ${n} de ${unicas.length} archivos`);
      }
      return { origen: raiz.href, archivos, librerias };
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
      const comprimir = !!form.elements.comprimir?.checked;
      const boton = form.querySelector('[data-generar]');
      trabajando = true;
      boton.disabled = true;
      const inicio = new Date();
      try {
        let tablas = [];
        const datos = {};
        const aplicativo = contenido.app ? await leerAplicativo(contenido.bd ? 10 : 90) : null;
        if (contenido.bd) {
          const base = contenido.app ? 10 : 0;
          progreso(base + 1, 'Revisando las tablas…');
          const r1 = await sb.rpc('respaldo_tablas', { p_org: pOrg, p_loc: pLoc });
          if (r1.error) throw r1.error;
          tablas = r1.data;
          const total = tablas.reduce((s, t) => s + Number(t.filas), 0) || 1;
          let leidas = 0;
          for (const t of tablas) {
            const filas = [];
            for (let desde = 0; desde < Number(t.filas); desde += POR_PAGINA) {
              const { data, error: e2 } = await sb.rpc('respaldo_datos', { p_tabla: t.tabla, p_org: pOrg, p_loc: pLoc, p_desde: desde, p_cantidad: POR_PAGINA });
              if (e2) throw e2;
              filas.push(...data);
              leidas += data.length;
              progreso(base + 3 + leidas / total * (87 - base), `Leyendo <b>${esc(t.tabla)}</b> · ${leidas.toLocaleString('es-GT')} de ${total.toLocaleString('es-GT')} registros`);
              if (data.length < POR_PAGINA) break;
            }
            datos[t.tabla] = { filas: filas.length, general: t.general, datos: filas };
          }
        }
        const o = pOrg ? org(pOrg) : null;
        const l = pLoc ? loc(pLoc) : null;
        const tipo = contenido.app && contenido.bd ? 'todo' : contenido.app ? 'aplicativo' : 'bd';
        const respaldo = {
          sistema: 'Financiero CONSISAV', formato: 1, contenido: { todo: 'TODO', aplicativo: 'APLICATIVO', bd: 'BASE DE DATOS' }[tipo], generado: inicio.toISOString(), generado_local: fechaHora(inicio),
          usuario: (yo.usuario || '').toUpperCase(),
          organizacion: o ? { id: o.id, codigo: o.codigo, nombre: o.nombre } : 'TODAS',
          localidad: l ? { id: l.id, codigo: l.codigo, nombre: l.nombre_comercial } : 'TODAS',
          ruta: ruta || null,
          ...(aplicativo ? { aplicativo } : {}),
          ...(contenido.bd ? { tablas: datos } : {})
        };
        progreso(92, 'Armando el archivo…');
        let blob = new Blob([JSON.stringify(respaldo)], { type: 'application/json' });
        if (comprimir) blob = await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();
        const alcance = contenido.bd ? `${o ? `org${o.codigo}` : 'TODAS'}_${l ? `loc${l.codigo}` : 'TODAS'}_` : '';
        const nombre = `backup_${tipo === 'bd' ? '' : `${tipo}_`}${alcance}${sello(inicio)}.json${comprimir ? '.gz' : ''}`;
        progreso(96, `Guardando <b>${esc(nombre)}</b>…`);
        let destino = ruta;
        if (carpeta) {
          const archivo = await carpeta.getFileHandle(nombre, { create: true });
          const w = await archivo.createWritable();
          await w.write(blob);
          await w.close();
          destino = ruta || carpeta.name;
        } else {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = nombre;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 30000);
        }
        const registros = Object.values(datos).reduce((s, t) => s + t.filas, 0);
        const { error: e3 } = await sb.from('respaldos').insert({ organizacion_id: pOrg, localidad_id: pLoc, archivo: nombre, ruta: destino || null, tablas: tablas.length, registros, bytes: blob.size });
        await cargarHistorial();
        pintar();
        progreso(100, `<i class="ti ti-circle-check" aria-hidden="true"></i> Backup generado: <b>${esc(nombre)}</b>${aplicativo ? ` · ${Object.keys(aplicativo.archivos).length} archivos del aplicativo` : ''}${contenido.bd ? ` · ${tablas.length} tablas · ${registros.toLocaleString('es-GT')} registros` : ''} · ${tamano(blob.size)}${carpeta ? ` · en la carpeta ${esc(carpeta.name)}` : ' · descargado'}${e3 ? ' · <span class="pc-rojo">no se pudo registrar en el historial</span>' : ''}`);
        window.FIN.aviso('Backup generado');
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
      if (e.target.name === 'comprimir') comprimirArchivo = e.target.checked;
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
      if (!e.target.closest('[data-carpeta]')) return;
      try {
        carpeta = await window.showDirectoryPicker({ id: 'fin-backup', mode: 'readwrite' });
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
