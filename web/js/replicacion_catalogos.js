// Cuentas y CC · Replicación · Nomenclatura y Centros de costos (misma pantalla, distinta configuración):
//   Izquierda, el proceso: ayuda, origen (organización y empresa fuente), rango de empresas
//   destino, "solo madres", replicar catálogo o parámetros, y eliminar la última replicación
//   hecha a una empresa. Derecha, el área de mensajes: resultado por empresa del último proceso
//   y el historial de replicaciones.
(function () {
  const { esc } = window.UI;

  const CONFIG = {
    'replicacion-nomenclatura': {
      tipo: 'NOMENCLATURA', titulo: 'Replicación de nomenclatura contable', icono: 'ti-list-tree',
      catalogo: 'nomenclatura', unidad: ['cuenta', 'cuentas'], tablaVersiones: 'catalogos_cuentas', tablaElementos: 'cuentas', padre: 'cuenta_mayor_id',
      madres: 'Solo cuentas madres', madresAyuda: 'Solo las cuentas que tienen subcuentas',
      botonCatalogo: 'Replicar nomenclatura', botonEliminar: 'Eliminar nomenclatura',
      parametros: 'Parámetros de tiempo: año y mes actual, cierres, períodos y meses contables.',
      ayuda: 'Este proceso crea una nomenclatura contable para un rango de empresas a partir de una nomenclatura ya existente, con la misma estructura funcional.'
    },
    'replicacion-centros': {
      tipo: 'CENTROS', titulo: 'Replicación de centros de costo', icono: 'ti-hierarchy-2',
      catalogo: 'catálogo de centros de costo', unidad: ['centro de costo', 'centros de costo'], tablaVersiones: 'catalogos_centros', tablaElementos: 'centros_costo', padre: 'centro_mayor_id',
      madres: 'Solo centros mayores', madresAyuda: 'Solo los centros que agrupan a otros centros',
      botonCatalogo: 'Replicar centros de costo', botonEliminar: 'Eliminar centros de costo',
      parametros: 'Uso de centros de costo: «Incluir centros de costo» de Parámetros generales.',
      ayuda: 'Este proceso crea el catálogo de centros de costo para un rango de empresas a partir de un catálogo ya existente, con la misma estructura funcional.'
    }
  };
  const fechaHora = (f) => f ? new Date(f).toLocaleString('es-GT', {
    timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
  }).replace(',', '') : '';
  const plural = (n, [uno, varios]) => `${n} ${n === 1 ? uno : varios}`;

  function pantallaReplicaCatalogo(cont, cfg) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    const yo = window.FIN.perfil();
    let organizaciones = [];
    let empresas = [];
    let versiones = [];     // versiones del catálogo de todas las empresas, con su total
    let historial = [];
    let mensajes = null;    // resultado del último proceso { titulo, filas: [{ destino, ok, mensaje }] }
    let madres = null;      // { total, madres } de la versión activa de la fuente
    const v = { orgFuente: yo.organizacion_id || null, fuente: yo.localidad_id || null, orgDestino: yo.organizacion_id || null, desde: null, hasta: null, soloMadres: false, eliminar: null };

    cont.innerHTML = '<div class="tk-espacio rc-espacio"><section class="tk-detalle" id="rc-proceso"></section><section class="tk-bandeja" id="rc-mensajes"></section></div>';
    const espacio = cont.querySelector('.tk-espacio');
    const pProc = cont.querySelector('#rc-proceso');
    const pMsj = cont.querySelector('#rc-mensajes');

    const empresa = (id) => empresas.find((e) => e.id === id);
    const nombreEmpresa = (id) => { const e = empresa(id); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
    const empresasDe = (org) => empresas.filter((e) => e.organizacion_id === org);
    const activa = (loc) => versiones.filter((x) => x.localidad_id === loc && x.activo).sort((a, b) => b.version - a.version)[0];
    const destinos = () => {
      const lista = empresasDe(v.orgDestino);
      const a = empresa(v.desde);
      const b = empresa(v.hasta);
      if (!a || !b) return [];
      const [min, max] = [Math.min(a.correlativo, b.correlativo), Math.max(a.correlativo, b.correlativo)];
      return lista.filter((e) => e.correlativo >= min && e.correlativo <= max);
    };

    function ajustarAlto() {
      if (!espacio.isConnected) return window.removeEventListener('resize', ajustarAlto);
      const arriba = espacio.getBoundingClientRect().top + window.scrollY;
      const alto = Math.max(560, window.innerHeight - arriba - 16);
      espacio.style.setProperty('--tk-alto', `${alto}px`);
      const sobra = document.documentElement.scrollHeight - window.innerHeight;
      if (sobra > 0 && alto - sobra >= 560) espacio.style.setProperty('--tk-alto', `${alto - sobra}px`);
    }
    window.addEventListener('resize', ajustarAlto);

    async function cargar() {
      const [o, l, k, h] = await Promise.all([
        sb.from('organizaciones').select('id, codigo, nombre').eq('activo', true).order('codigo'),
        sb.from('localidades').select('id, codigo, correlativo, nombre_comercial, organizacion_id').eq('activo', true).order('organizacion_id').order('correlativo'),
        sb.from(cfg.tablaVersiones).select(`id, localidad_id, version, activo, ${cfg.tablaElementos}(count)`),
        sb.from('replicaciones_catalogo').select('*').eq('tipo', cfg.tipo).order('fecha', { ascending: false }).order('id', { ascending: false }).limit(150)
      ]);
      if (h.error) {
        espacio.innerHTML = `<section class="panel"><p class="vacio">${/replicaciones_catalogo/.test(h.error.message) ? 'Falta instalar el script 26 (replicación de nomenclatura y centros de costo) en Supabase.' : esc(h.error.message)}</p></section>`;
        return false;
      }
      organizaciones = o.data || [];
      empresas = l.data || [];
      versiones = (k.data || []).map((x) => ({ id: x.id, localidad_id: x.localidad_id, version: x.version, activo: x.activo, total: x[cfg.tablaElementos]?.[0]?.count ?? 0 }));
      historial = h.data || [];
      return true;
    }

    // Cuántos elementos de la versión activa de la fuente son madres (tienen hijos).
    async function contarMadres() {
      madres = null;
      const a = activa(v.fuente);
      if (!a) return;
      const { data } = await sb.from(cfg.tablaElementos).select(`id, ${cfg.padre}`).eq('catalogo_id', a.id);
      const padres = new Set((data || []).map((x) => x[cfg.padre]).filter(Boolean));
      madres = { total: (data || []).length, madres: (data || []).filter((x) => padres.has(x.id)).length };
    }

    async function iniciar() {
      ajustarAlto();
      if (!(await cargar())) return;
      if (!empresa(v.fuente)) v.fuente = null;
      const propias = empresasDe(v.orgDestino).filter((e) => e.id !== v.fuente);
      v.desde = propias[0]?.id || null;
      v.hasta = propias[propias.length - 1]?.id || null;
      v.eliminar = propias[0]?.id || null;
      await contarMadres();
      pintar();
      pintarMensajes();
    }

    // ---------- Proceso ----------
    function pintar() {
      const dis = editable ? '' : 'disabled';
      const orgOpc = (sel) => '<option value="">Seleccionar organización…</option>' + organizaciones.map((o) => `<option value="${o.id}" ${sel === o.id ? 'selected' : ''}>${o.codigo} · ${esc(o.nombre)}</option>`).join('');
      const empOpc = (org, sel, vacio = 'Seleccionar empresa…') => `<option value="">${vacio}</option>` + empresasDe(org).map((e) => `<option value="${e.id}" ${sel === e.id ? 'selected' : ''}>${esc(e.codigo)} · ${esc(e.nombre_comercial)}</option>`).join('');
      const a = activa(v.fuente);
      const lista = destinos();
      const ultima = (accion) => historial.find((x) => x.destino_localidad_id === v.eliminar && x.accion === accion && x.estado === 'APLICADA');
      const ulCat = ultima('CATALOGO');
      const ulPar = ultima('PARAMETROS');
      pProc.innerHTML = `
        <div class="tk-form rc-form">
          <header class="tk-titulo">
            <span class="tk-icono"><i class="ti ${cfg.icono}" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>Replicación</small><h2>${esc(cfg.titulo)}</h2></div>
            ${!editable ? '<div class="tk-titulo-acciones"><span class="tk-aviso"><i class="ti ti-lock" aria-hidden="true"></i> Solo un administrador puede replicar</span></div>' : ''}
          </header>

          <aside class="rc-ayuda">
            <i class="ti ti-help-circle" aria-hidden="true"></i>
            <div>
              <p>${esc(cfg.ayuda)}</p>
              <ol><li>Indica la organización y la empresa fuente.</li><li>Indica la organización y el rango de empresas destino.</li><li>Presiona el botón del proceso y revisa el resultado en el área de mensajes.</li></ol>
            </div>
          </aside>

          <div class="rc-bloques">
            <fieldset class="rp-seccion rc-bloque">
              <legend><span class="rc-paso">1</span> Origen de la ${cfg.tipo === 'NOMENCLATURA' ? 'nomenclatura' : 'información'}</legend>
              <div class="rc-campos">
                <label class="campo"><span>Organización fuente</span><select name="orgFuente" ${dis}>${orgOpc(v.orgFuente)}</select></label>
                <label class="campo"><span>Empresa fuente</span><select name="fuente" ${dis}>${empOpc(v.orgFuente, v.fuente)}</select></label>
              </div>
              <p class="rc-info ${v.fuente && !a ? 'falta' : ''}">${!v.fuente ? '<i class="ti ti-info-circle" aria-hidden="true"></i> Elige la empresa fuente.'
                : a ? `<i class="ti ti-circle-check" aria-hidden="true"></i> Versión activa ${a.version} · ${plural(a.total, cfg.unidad)}${madres ? ` · ${madres.madres} madres` : ''}`
                : `<i class="ti ti-alert-triangle" aria-hidden="true"></i> No tiene ${esc(cfg.catalogo)} activa para replicar.`}</p>
            </fieldset>

            <fieldset class="rp-seccion rc-bloque">
              <legend><span class="rc-paso">2</span> Rango de empresas destino</legend>
              <div class="rc-campos tres">
                <label class="campo"><span>Organización destino</span><select name="orgDestino" ${dis}>${orgOpc(v.orgDestino)}</select></label>
                <label class="campo"><span>De la empresa No.</span><select name="desde" ${dis}>${empOpc(v.orgDestino, v.desde)}</select></label>
                <label class="campo"><span>A la empresa No.</span><select name="hasta" ${dis}>${empOpc(v.orgDestino, v.hasta)}</select></label>
              </div>
              <div class="rc-destinos">
                ${lista.length ? lista.map((e) => {
                  const k = activa(e.id);
                  return `<span class="rc-destino ${e.id === v.fuente ? 'omitida' : ''}" title="${e.id === v.fuente ? 'Es la empresa fuente: se omite' : k ? `Tiene la versión ${k.version} (${plural(k.total, cfg.unidad)}); se crea una versión nueva` : 'Sin catálogo: se crea la versión 1'}"><b>${esc(e.codigo)}</b> ${esc(e.nombre_comercial)} <small>${e.id === v.fuente ? 'fuente' : k ? `v${k.version} → v${Math.max(...versiones.filter((x) => x.localidad_id === e.id).map((x) => x.version)) + 1}` : 'nueva'}</small></span>`;
                }).join('') : '<small class="tk-tenue">Elige el rango de empresas.</small>'}
              </div>
            </fieldset>
          </div>

          <div class="rc-acciones">
            <label class="rc-madres" title="${esc(cfg.madresAyuda)}"><input type="checkbox" name="soloMadres" ${v.soloMadres ? 'checked' : ''} ${dis}> ${esc(cfg.madres)} <small>${madres ? `(${madres.madres} de ${madres.total})` : ''}</small></label>
            <div class="rc-botones">
              <button type="button" class="boton primario-sm" data-proceso="catalogo" ${dis}><i class="ti ti-copy" aria-hidden="true"></i> ${esc(cfg.botonCatalogo)}</button>
              <button type="button" class="boton secundario-sm" data-proceso="parametros" ${dis} title="${esc(cfg.parametros)}"><i class="ti ti-adjustments" aria-hidden="true"></i> Replicar parámetros</button>
            </div>
            <p class="rp-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> ${plural(lista.filter((e) => e.id !== v.fuente).length, ['empresa destino', 'empresas destino'])} · Parámetros: ${esc(cfg.parametros)}</p>
          </div>

          <fieldset class="rp-seccion rc-bloque rc-eliminar">
            <legend><i class="ti ti-trash" aria-hidden="true"></i> Eliminar replicación</legend>
            <div class="rc-eliminar-fila">
              <label class="campo"><span>A la empresa No.</span><select name="eliminar" ${dis}>${empOpc(v.orgDestino, v.eliminar)}</select></label>
              <button type="button" class="boton secundario-sm rp-peligro" data-eliminar="CATALOGO" ${!editable || !ulCat ? 'disabled' : ''}><i class="ti ti-trash" aria-hidden="true"></i> ${esc(cfg.botonEliminar)}</button>
              <button type="button" class="boton secundario-sm rp-peligro" data-eliminar="PARAMETROS" ${!editable || !ulPar ? 'disabled' : ''}><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Eliminar parámetros</button>
            </div>
            <p class="rp-nota">${v.eliminar ? `<i class="ti ti-info-circle" aria-hidden="true"></i> ${ulCat ? `Última replicación: ${esc(ulCat.mensaje)} (${esc(fechaHora(ulCat.fecha))})` : `Sin ${esc(cfg.catalogo)} replicada para eliminar`} · ${ulPar ? `parámetros replicados el ${esc(fechaHora(ulPar.fecha))}` : 'sin parámetros replicados'}.` : 'Elige la empresa.'}</p>
          </fieldset>
        </div>`;
    }

    // ---------- Mensajes ----------
    function pintarMensajes() {
      const accionTexto = (x) => x.accion === 'CATALOGO' ? cfg.botonCatalogo.replace('Replicar ', '') : 'parámetros';
      pMsj.innerHTML = `
        <header class="tk-bandeja-cab"><h2>Mensajes</h2>${mensajes ? '<button type="button" class="rp-enlace" data-accion="limpiar">Limpiar</button>' : ''}</header>
        <div class="rc-resultado">
          ${mensajes ? `
            <p class="rc-resultado-titulo"><b>${esc(mensajes.titulo)}</b><small>${mensajes.filas.filter((f) => f.ok).length} correctas · ${mensajes.filas.filter((f) => !f.ok).length} con aviso</small></p>
            <ul>${mensajes.filas.map((f) => `<li class="${f.ok ? 'ok' : 'error'}"><i class="ti ${f.ok ? 'ti-circle-check' : 'ti-alert-circle'}" aria-hidden="true"></i><div><b>${esc(nombreEmpresa(f.destino))}</b><small>${esc(f.mensaje)}</small></div></li>`).join('')}</ul>`
            : '<p class="tk-tenue rc-espera"><i class="ti ti-message-dots" aria-hidden="true"></i> El resultado de cada proceso aparece aquí, empresa por empresa.</p>'}
        </div>
        <h3 class="rc-historial-titulo">Historial</h3>
        <ul class="tk-items rc-historial">
          ${historial.map((x) => `
            <li class="rc-mov ${x.estado.toLowerCase()}">
              <i class="ti ${x.estado === 'ERROR' ? 'ti-alert-circle' : x.estado === 'ELIMINADA' ? 'ti-trash' : x.accion === 'CATALOGO' ? 'ti-copy' : 'ti-adjustments'}" aria-hidden="true"></i>
              <div>
                <div class="rc-mov-linea"><b>${esc(nombreEmpresa(x.destino_localidad_id))}</b><span class="rp-estado ${x.estado === 'APLICADA' ? 'aplicada' : x.estado === 'ERROR' ? 'error' : 'desaplicada'}">${x.estado === 'APLICADA' ? 'Aplicada' : x.estado === 'ERROR' ? 'Error' : 'Eliminada'}</span></div>
                <small>${esc(accionTexto(x))} desde ${esc(nombreEmpresa(x.origen_localidad_id))} · ${esc(x.mensaje)}</small>
                <small class="rc-mov-pie">${esc(x.usuario || '')} · ${esc(fechaHora(x.fecha))}${x.eliminada_en ? ` · eliminada por ${esc(x.eliminada_por)} el ${esc(fechaHora(x.eliminada_en))}` : ''}</small>
              </div>
            </li>`).join('') || '<li class="tk-vacio"><i class="ti ti-history" aria-hidden="true"></i>Todavía no hay replicaciones.</li>'}
        </ul>`;
    }

    async function procesar(tipoProceso) {
      const lista = destinos().filter((e) => e.id !== v.fuente);
      if (!v.fuente) return window.FIN.aviso('Indica la empresa fuente');
      if (!lista.length) return window.FIN.aviso('Indica el rango de empresas destino');
      const nombres = lista.map((e) => e.codigo).join(', ');
      const que = tipoProceso === 'catalogo' ? `la ${cfg.catalogo}${v.soloMadres ? ` (${cfg.madres.toLowerCase()})` : ''}` : 'los parámetros';
      if (!confirm(`¿Replicar ${que} de ${nombreEmpresa(v.fuente)} a ${plural(lista.length, ['empresa', 'empresas'])} (${nombres})?`)) return;
      const botones = pProc.querySelectorAll('[data-proceso]');
      botones.forEach((b) => { b.disabled = true; });
      const { data, error } = tipoProceso === 'catalogo'
        ? await sb.rpc('replicar_catalogo', { p_tipo: cfg.tipo, p_origen: v.fuente, p_destinos: lista.map((e) => e.id), p_solo_madres: v.soloMadres })
        : await sb.rpc('replicar_parametros_catalogo', { p_tipo: cfg.tipo, p_origen: v.fuente, p_destinos: lista.map((e) => e.id) });
      mensajes = { titulo: tipoProceso === 'catalogo' ? cfg.botonCatalogo : 'Replicar parámetros', filas: error ? [{ destino: v.fuente, ok: false, mensaje: window.UI.traducirError(error) }] : data };
      await cargar();
      await contarMadres();
      pintar();
      pintarMensajes();
      if (!error) window.FIN.aviso(`${mensajes.titulo}: ${data.filter((f) => f.ok).length} de ${data.length} empresas`);
    }

    async function eliminar(accion) {
      const que = accion === 'CATALOGO' ? `la ${cfg.catalogo} replicada` : 'los parámetros replicados';
      if (!confirm(`¿Eliminar ${que} de ${nombreEmpresa(v.eliminar)}? Se deshace la última replicación hecha a esa empresa.`)) return;
      const { data, error } = await sb.rpc('eliminar_replica_catalogo', { p_tipo: cfg.tipo, p_accion: accion, p_destino: v.eliminar });
      mensajes = { titulo: accion === 'CATALOGO' ? cfg.botonEliminar : 'Eliminar parámetros', filas: [error ? { destino: v.eliminar, ok: false, mensaje: window.UI.traducirError(error) } : data] };
      await cargar();
      await contarMadres();
      pintar();
      pintarMensajes();
    }

    cont.addEventListener('change', async (e) => {
      const n = e.target.name;
      if (!['orgFuente', 'fuente', 'orgDestino', 'desde', 'hasta', 'soloMadres', 'eliminar'].includes(n)) return;
      if (n === 'soloMadres') { v.soloMadres = e.target.checked; return pintar(); }
      v[n] = e.target.value ? Number(e.target.value) : null;
      if (n === 'orgFuente') { v.fuente = empresasDe(v.orgFuente)[0]?.id || null; }
      if (n === 'orgDestino') {
        const l = empresasDe(v.orgDestino);
        v.desde = l[0]?.id || null; v.hasta = l[l.length - 1]?.id || null; v.eliminar = l[0]?.id || null;
      }
      if (n === 'orgFuente' || n === 'fuente') await contarMadres();
      pintar();
    });
    cont.addEventListener('click', (e) => {
      const p = e.target.closest('[data-proceso]');
      if (p) return procesar(p.dataset.proceso);
      const el = e.target.closest('[data-eliminar]');
      if (el) return eliminar(el.dataset.eliminar);
      if (e.target.closest('[data-accion=limpiar]')) { mensajes = null; pintarMensajes(); }
    });

    iniciar();
  }

  window.PANTALLAS = window.PANTALLAS || {};
  Object.entries(CONFIG).forEach(([id, cfg]) => {
    window.PANTALLAS[id] = (cont) => pantallaReplicaCatalogo(cont, cfg);
  });
})();
