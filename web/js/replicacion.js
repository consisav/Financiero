// Cuentas y CC · Replicación · Empresa y parámetros, en una sola pantalla (bandeja y detalle):
//   Izquierda, las réplicas registradas. Derecha, la réplica abierta: empresa origen y destino,
//   descripción, grupos de Parámetros generales a replicar y la comparación de valores
//   (origen contra destino actual). Aplicar guarda un respaldo del destino; Desaplicar lo devuelve.
(function () {
  const { esc } = window.UI;

  const GRUPOS = [
    { id: 'TIEMPO', nombre: 'Parámetros de tiempo', icono: 'ti-calendar', campos: [
      ['anio_actual', 'Año actual'], ['mes_actual', 'Mes actual'], ['proximo_cierre', 'Próximo cierre'], ['ultimo_cierre', 'Último cierre'],
      ['inicio_periodo_actual', 'Inicio período actual'], ['fin_periodo_actual', 'Fin período actual'],
      ['inicio_periodo_fiscal', 'Inicio período fiscal'], ['fin_periodo_fiscal', 'Fin período fiscal'],
      ['primer_mes_contable', 'Primer mes contable'], ['ultimo_mes_contable', 'Último mes contable']] },
    { id: 'PANTALLAS', nombre: 'Uso de pantallas', icono: 'ti-layout-dashboard', campos: [
      ['aplicar_iva', 'Aplicar IVA'], ['incluir_centros_costo', 'Incluir centros de costo'], ['migracion_bancos', 'Migración de bancos']] },
    { id: 'IMPUESTOS', nombre: 'Impuestos básicos', icono: 'ti-receipt-tax', campos: [
      ['nombre_impuesto1', 'Impuesto 1'], ['impuesto1', 'Impuesto 1 (%)'], ['nombre_impuesto2', 'Impuesto 2'], ['impuesto2', 'Impuesto 2 (%)'],
      ['nombre_impuesto3', 'Impuesto 3'], ['impuesto3', 'Impuesto 3 (%)'], ['nombre_impuesto4', 'Impuesto 4'], ['impuesto4', 'Impuesto 4 (%)']] },
    { id: 'IDP', nombre: 'IDP por galón', icono: 'ti-gas-station', campos: [
      ['idp_super', 'IDP súper'], ['idp_regular', 'IDP regular'], ['idp_diesel', 'IDP diésel']] },
    { id: 'OTROS', nombre: 'Monedas y otros', icono: 'ti-coins', campos: [
      ['valor_cheques_autorizacion', 'Cheques con autorización desde'], ['moneda_integracion', 'Moneda de integración'], ['moneda_ingreso', 'Moneda de ingreso']] },
    { id: 'FIRMANTES', nombre: 'Firmantes', icono: 'ti-signature', campos: [] }
  ];
  const ESTADOS = { PENDIENTE: 'Pendiente', APLICADA: 'Aplicada', DESAPLICADA: 'Desaplicada' };
  const fechaHora = (f) => f ? new Date(f).toLocaleString('es-GT', {
    timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
  }).replace(',', '') : '';
  const valor = (v) => v === null || v === undefined || v === '' ? '—' : v === true ? 'Sí' : v === false ? 'No' : String(v);
  const marcaEstado = (e) => `<span class="rp-estado ${e.toLowerCase()}">${ESTADOS[e]}</span>`;

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['replicacion-empresa'] = function (cont) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    let replicas = [];
    let empresas = [];      // localidades con su organización
    let actual = null;      // réplica abierta (null = nueva)
    let buscar = '';
    const cache = {};       // parámetros y firmantes por localidad

    cont.innerHTML = '<div class="tk-espacio"><section class="tk-bandeja" id="rp-lista"></section><section class="tk-detalle" id="rp-detalle"></section></div>';
    const espacio = cont.querySelector('.tk-espacio');
    const pLista = cont.querySelector('#rp-lista');
    const pDet = cont.querySelector('#rp-detalle');

    const empresa = (id) => empresas.find((e) => e.id === id);
    const nombreEmpresa = (id) => { const e = empresa(id); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };

    function ajustarAlto() {
      if (!espacio.isConnected) return window.removeEventListener('resize', ajustarAlto);
      const arriba = espacio.getBoundingClientRect().top + window.scrollY;
      const alto = Math.max(560, window.innerHeight - arriba - 16);
      espacio.style.setProperty('--tk-alto', `${alto}px`);
      const sobra = document.documentElement.scrollHeight - window.innerHeight;
      if (sobra > 0 && alto - sobra >= 560) espacio.style.setProperty('--tk-alto', `${alto - sobra}px`);
    }
    window.addEventListener('resize', ajustarAlto);

    async function iniciar() {
      ajustarAlto();
      const [l, r] = await Promise.all([
        sb.from('localidades').select('id, codigo, correlativo, nombre_comercial, organizacion_id, organizacion:organizaciones(codigo, nombre)').eq('activo', true).order('organizacion_id').order('correlativo'),
        sb.from('replicas').select('*').order('numero', { ascending: false })
      ]);
      if (r.error) {
        espacio.innerHTML = `<section class="panel"><p class="vacio">${/replicas/.test(r.error.message) ? 'Falta instalar el script 24 (réplica de empresa y parámetros) en Supabase.' : esc(r.error.message)}</p></section>`;
        return;
      }
      empresas = l.data || [];
      replicas = r.data;
      pintarLista();
      abrir(null);
    }

    async function parametros(locId) {
      if (!locId) return null;
      if (!(locId in cache)) {
        const { data } = await sb.from('parametros_generales').select('*, firmantes:parametros_firmantes(orden, tipo, nombre, cargo)').eq('localidad_id', locId).maybeSingle();
        cache[locId] = data || null;
      }
      return cache[locId];
    }

    // ---------- Bandeja ----------
    function pintarLista() {
      const q = buscar.trim().toLowerCase();
      const filas = replicas.filter((r) => !q || [r.numero, r.descripcion, nombreEmpresa(r.origen_localidad_id), nombreEmpresa(r.destino_localidad_id), ESTADOS[r.estado]]
        .some((v) => String(v || '').toLowerCase().includes(q)));
      pLista.innerHTML = `
        <header class="tk-bandeja-cab">
          <h2>Réplicas <small>${replicas.length}</small></h2>
          ${editable ? '<button type="button" class="boton primario-sm" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva</button>' : ''}
        </header>
        <div class="tk-barra rp-barra">
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar réplica, empresa o descripción…" value="${esc(buscar)}" aria-label="Buscar réplicas"></label>
        </div>
        <ul class="tk-items">
          ${filas.map((r) => `
            <li class="tk-item ${actual && actual.id === r.id ? 'actual' : ''}" data-replica="${r.id}" tabindex="0">
              <i class="tk-franja rp-${r.estado.toLowerCase()}" aria-hidden="true"></i>
              <div class="tk-item-linea"><b>Réplica ${r.numero}</b>${marcaEstado(r.estado)}</div>
              <p class="rp-ruta"><span>${esc(nombreEmpresa(r.origen_localidad_id))}</span><i class="ti ti-arrow-right" aria-hidden="true"></i><span>${esc(nombreEmpresa(r.destino_localidad_id))}</span></p>
              <div class="tk-item-pie">
                <span><i class="ti ti-clock" aria-hidden="true"></i>${esc(fechaHora(r.fecha))}</span>
                <span><i class="ti ti-stack-2" aria-hidden="true"></i>${r.objetos.length} ${r.objetos.length === 1 ? 'grupo' : 'grupos'}</span>
                ${r.descripcion ? `<span class="rp-desc" title="${esc(r.descripcion)}">${esc(r.descripcion)}</span>` : ''}
              </div>
            </li>`).join('') || `<li class="tk-vacio"><i class="ti ti-copy" aria-hidden="true"></i>${replicas.length ? 'Ninguna réplica coincide con la búsqueda.' : 'Todavía no hay réplicas.'}</li>`}
        </ul>`;
    }

    async function abrir(r) {
      actual = r;
      pintarLista();
      await pintarDetalle(r ? { origen: r.origen_localidad_id, destino: r.destino_localidad_id, objetos: r.objetos, descripcion: r.descripcion || '' }
        : { origen: null, destino: null, objetos: GRUPOS.map((g) => g.id), descripcion: '' });
    }

    // ---------- Detalle ----------
    async function pintarDetalle(v) {
      const r = actual;
      const bloqueada = !editable || (r && r.estado !== 'PENDIENTE');
      const dis = bloqueada ? 'disabled' : '';
      const opciones = (sel, excluir) => `<option value="">Seleccionar empresa…</option>` + empresas.filter((e) => e.id !== excluir).map((e) =>
        `<option value="${e.id}" ${sel === e.id ? 'selected' : ''}>${esc(e.codigo)} · ${esc(e.nombre_comercial)}${e.organizacion ? ` — ${esc(e.organizacion.nombre)}` : ''}</option>`).join('');
      const [po, pd] = await Promise.all([parametros(v.origen), parametros(v.destino)]);
      pDet.innerHTML = `
        <form class="tk-form rp-form" novalidate>
          <header class="tk-titulo">
            <span class="tk-icono"><i class="ti ti-copy" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto">
              <small>Replicar empresa y parámetros</small>
              <h2>${r ? `Réplica ${r.numero}` : 'Nueva réplica'}</h2>
            </div>
            <div class="tk-marcas">${marcaEstado(r ? r.estado : 'PENDIENTE')}</div>
            <div class="tk-titulo-acciones">
              ${editable && (!r || r.estado !== 'APLICADA') ? `<button type="submit" class="boton secundario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button>` : ''}
              ${editable && r && r.estado !== 'APLICADA' ? '<button type="button" class="boton primario-sm" data-accion="aplicar"><i class="ti ti-player-play" aria-hidden="true"></i> Aplicar réplica</button>' : ''}
              ${editable && r && r.estado === 'APLICADA' ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="desaplicar"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Desaplicar réplica</button>' : ''}
              ${!editable ? '<span class="tk-aviso"><i class="ti ti-lock" aria-hidden="true"></i> Solo un administrador puede replicar</span>' : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>

          <dl class="tk-datos">
            <div><dt><i class="ti ti-hash" aria-hidden="true"></i> Réplica</dt><dd>${r ? r.numero : 'Se numera al guardar'}</dd></div>
            <div><dt><i class="ti ti-calendar" aria-hidden="true"></i> Fecha réplica</dt><dd>${esc(fechaHora(r ? r.fecha : new Date()))}</dd></div>
            <div><dt><i class="ti ti-user-plus" aria-hidden="true"></i> Usuario ingresa</dt><dd>${r ? `${esc(r.creado_por_nombre || '')} · ${esc(fechaHora(r.creado_en))}` : '—'}</dd></div>
            <div><dt><i class="ti ti-player-play" aria-hidden="true"></i> ${r && r.estado === 'DESAPLICADA' ? 'Desaplicada' : 'Aplicada'}</dt><dd>${r && r.estado === 'DESAPLICADA' ? `${esc(r.desaplicada_por)} · ${esc(fechaHora(r.desaplicada_en))}` : r && r.aplicada_en ? `${esc(r.aplicada_por)} · ${esc(fechaHora(r.aplicada_en))}` : '—'}</dd></div>
          </dl>

          <div class="rp-empresas">
            <label class="campo"><span>Empresa origen *</span><select name="origen" ${dis}>${opciones(v.origen, v.destino)}</select>
              <small class="${po ? 'rp-ok' : 'rp-falta'}">${v.origen ? (po ? `<i class="ti ti-circle-check" aria-hidden="true"></i> Tiene parámetros generales · ${po.firmantes.length} firmantes` : '<i class="ti ti-alert-triangle" aria-hidden="true"></i> No tiene parámetros generales para replicar') : '&nbsp;'}</small></label>
            <span class="rp-flecha" aria-hidden="true"><i class="ti ti-arrow-right"></i></span>
            <label class="campo"><span>Empresa destino *</span><select name="destino" ${dis}>${opciones(v.destino, v.origen)}</select>
              <small class="rp-nota">${v.destino ? (pd ? `<i class="ti ti-info-circle" aria-hidden="true"></i> Sus parámetros se reemplazan · se guarda un respaldo` : '<i class="ti ti-info-circle" aria-hidden="true"></i> Sin parámetros: se crean al aplicar') : '&nbsp;'}</small></label>
            <label class="campo rp-descripcion"><span>Descripción</span><input name="descripcion" value="${esc(v.descripcion)}" ${!editable || (r && r.estado === 'APLICADA') ? 'disabled' : ''} placeholder="Motivo de la réplica" maxlength="200"></label>
          </div>

          <div class="tk-cuerpo rp-cuerpo">
            <div class="tk-col">
              <div class="rp-col-cab">
                <h3>Parámetros a replicar</h3>
                ${!bloqueada ? `<button type="button" class="rp-enlace" data-accion="todos">${v.objetos.length === GRUPOS.length ? 'Quitar todos' : 'Seleccionar todos'}</button>` : ''}
              </div>
              <div class="rp-grupos">
                ${GRUPOS.map((g) => `
                  <label class="rp-grupo">
                    <input type="checkbox" name="objetos" value="${g.id}" ${v.objetos.includes(g.id) ? 'checked' : ''} ${dis}>
                    <span class="rp-grupo-icono"><i class="ti ${g.icono}" aria-hidden="true"></i></span>
                    <span><b>${esc(g.nombre)}</b><small>${g.id === 'FIRMANTES' ? 'Firmantes de reportes y documentos' : `${g.campos.length} parámetros`}</small></span>
                  </label>`).join('')}
              </div>
              <p class="rp-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> El NIT no se replica: es propio de cada empresa.</p>
            </div>
            <div class="tk-col rp-comparacion">
              <div class="rp-col-cab"><h3>Comparación</h3><small class="tk-tenue">${diferencias(v, po, pd)} diferencias</small></div>
              ${comparacion(v, po, pd)}
            </div>
          </div>
        </form>`;
    }

    function filasGrupo(g, po, pd) {
      if (g.id === 'FIRMANTES') {
        const t = (p) => p ? p.firmantes.slice().sort((a, b) => a.orden - b.orden).map((f) => `${f.tipo}${f.nombre ? `: ${f.nombre}` : ''}`).join(' · ') || '—' : '—';
        return [['Firmantes', t(po), t(pd)]];
      }
      return g.campos.map(([c, n]) => [n, valor(po ? po[c] : null), valor(pd ? pd[c] : null)]);
    }

    function diferencias(v, po, pd) {
      if (!po) return 0;
      return GRUPOS.filter((g) => v.objetos.includes(g.id)).flatMap((g) => filasGrupo(g, po, pd)).filter(([, a, b]) => a !== b).length;
    }

    function comparacion(v, po, pd) {
      if (!v.origen || !v.destino) return '<p class="tk-vacio"><i class="ti ti-arrows-left-right" aria-hidden="true"></i>Elige la empresa origen y la destino para comparar sus parámetros.</p>';
      const grupos = GRUPOS.filter((g) => v.objetos.includes(g.id));
      if (!grupos.length) return '<p class="tk-vacio"><i class="ti ti-checkbox" aria-hidden="true"></i>Marca al menos un grupo de parámetros.</p>';
      return `
        <div class="rp-tabla">
          <table>
            <thead><tr><th>Parámetro</th><th>Origen</th><th>Destino actual</th></tr></thead>
            ${grupos.map((g) => `
              <tbody>
                <tr class="rp-tabla-grupo"><td colspan="3"><i class="ti ${g.icono}" aria-hidden="true"></i> ${esc(g.nombre)}</td></tr>
                ${filasGrupo(g, po, pd).map(([n, a, b]) => `
                  <tr class="${a !== b ? 'distinto' : ''}"><td>${esc(n)}</td><td>${esc(a)}</td><td>${esc(b)}${a !== b ? ' <i class="ti ti-arrow-left rp-cambia" title="Cambia al aplicar" aria-label="Cambia al aplicar"></i>' : ''}</td></tr>`).join('')}
              </tbody>`).join('')}
          </table>
        </div>`;
    }

    function leer(form) {
      return {
        origen: form.elements.origen.value ? Number(form.elements.origen.value) : null,
        destino: form.elements.destino.value ? Number(form.elements.destino.value) : null,
        objetos: [...form.querySelectorAll('[name=objetos]:checked')].map((x) => x.value),
        descripcion: form.elements.descripcion.value
      };
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      const v = leer(form);
      if (!actual || actual.estado !== 'APLICADA') {
        if (!v.origen || !v.destino) { error.textContent = 'Elige la empresa origen y la empresa destino.'; return null; }
        if (!v.objetos.length) { error.textContent = 'Marca al menos un grupo de parámetros.'; return null; }
      }
      error.textContent = '';
      const d = { origen_localidad_id: v.origen, destino_localidad_id: v.destino, objetos: v.objetos, descripcion: v.descripcion.trim() || null };
      const r = actual
        ? await sb.from('replicas').update(d).eq('id', actual.id).select('*').single()
        : await sb.from('replicas').insert(d).select('*').single();
      if (r.error) { error.textContent = window.UI.traducirError(r.error); return null; }
      await recargar(r.data.id);
      return r.data;
    }

    async function recargar(id) {
      const { data } = await sb.from('replicas').select('*').order('numero', { ascending: false });
      replicas = data || [];
      Object.keys(cache).forEach((k) => delete cache[k]);
      await abrir(replicas.find((x) => x.id === id) || null);
    }

    async function ejecutar(accion) {
      const form = pDet.querySelector('form');
      const error = form.querySelector('.modal-error');
      if (accion === 'aplicar') {
        // Lo que se cambió en pantalla se guarda antes de aplicar.
        const guardada = await guardar(form);
        if (!guardada) return;
        const dest = nombreEmpresa(guardada.destino_localidad_id);
        if (!confirm(`¿Aplicar la réplica ${guardada.numero}? Los parámetros elegidos de ${dest} se reemplazan por los de la empresa origen. Se guarda un respaldo para poder desaplicarla.`)) return;
        const { data, error: err } = await sb.rpc('aplicar_replica', { p_id: guardada.id });
        if (err) { pDet.querySelector('.modal-error').textContent = window.UI.traducirError(err); return; }
        window.FIN.aviso(`Réplica ${data.numero} aplicada a ${dest}`);
        return recargar(guardada.id);
      }
      if (!confirm(`¿Desaplicar la réplica ${actual.numero}? ${nombreEmpresa(actual.destino_localidad_id)} vuelve a los parámetros que tenía antes de aplicarla.`)) return;
      const { data, error: err } = await sb.rpc('desaplicar_replica', { p_id: actual.id });
      if (err) { error.textContent = window.UI.traducirError(err); return; }
      window.FIN.aviso(`Réplica ${data.numero} desaplicada`);
      return recargar(actual.id);
    }

    cont.addEventListener('click', (e) => {
      if (e.target.closest('[data-accion=nueva]')) return abrir(null);
      const ac = e.target.closest('[data-accion=aplicar], [data-accion=desaplicar]');
      if (ac) return ejecutar(ac.dataset.accion);
      if (e.target.closest('[data-accion=todos]')) {
        const form = pDet.querySelector('form');
        const v = leer(form);
        v.objetos = v.objetos.length === GRUPOS.length ? [] : GRUPOS.map((g) => g.id);
        return pintarDetalle(v);
      }
      const li = e.target.closest('[data-replica]');
      if (li) return abrir(replicas.find((x) => String(x.id) === li.dataset.replica));
    });
    cont.addEventListener('keydown', (e) => {
      const li = e.target.closest('[data-replica]');
      if (li && e.key === 'Enter') abrir(replicas.find((x) => String(x.id) === li.dataset.replica));
    });
    cont.addEventListener('change', (e) => {
      const form = e.target.closest('.rp-form');
      if (form && e.target.matches('[name=origen], [name=destino], [name=objetos]')) pintarDetalle(leer(form));
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
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('.rp-form')) return;
      e.preventDefault();
      const r = await guardar(e.target);
      if (r) window.FIN.aviso(`Réplica ${r.numero} guardada`);
    });

    iniciar();
  };
})();
