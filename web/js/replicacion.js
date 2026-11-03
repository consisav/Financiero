// Cuentas y CC · Replicación · Empresa y parámetros: «Replicar información contable», en una sola
// pantalla (bandeja y detalle):
//   Izquierda, las réplicas registradas. Derecha, la réplica abierta: empresa origen y destino,
//   fechas, descripción, los objetos a replicar (parámetros de la empresa, objetos de catálogos y
//   objetos de operación) y, a la derecha, el resumen de lo que hará y la comparación de
//   parámetros. Aplicar guarda un respaldo del destino; Desaplicar lo devuelve.
(function () {
  const { esc } = window.UI;

  // disponible: 'copia' se replica · 'comun' es compartido por todas las empresas · 'pronto' aún no existe su módulo.
  const SECCIONES = [
    { id: 'parametros', nombre: 'Parámetros de la empresa', icono: 'ti-adjustments', objetos: [
      { id: 'TIEMPO', nombre: 'Parámetros de tiempo', icono: 'ti-calendar', disponible: 'copia' },
      { id: 'PANTALLAS', nombre: 'Uso de pantallas', icono: 'ti-layout-dashboard', disponible: 'copia' },
      { id: 'IMPUESTOS', nombre: 'Impuestos básicos', icono: 'ti-receipt-tax', disponible: 'copia' },
      { id: 'IDP', nombre: 'IDP por galón', icono: 'ti-gas-station', disponible: 'copia' },
      { id: 'OTROS', nombre: 'Monedas y otros', icono: 'ti-coins', disponible: 'copia' },
      { id: 'FIRMANTES', nombre: 'Firmantes', icono: 'ti-signature', disponible: 'copia' }] },
    { id: 'catalogos', nombre: 'Objetos de catálogos', icono: 'ti-list-details', objetos: [
      { id: 'TIPOS_CUENTA', nombre: 'Tipo cuentas', icono: 'ti-tags', disponible: 'comun' },
      { id: 'CUENTAS', nombre: 'Cuentas contables', icono: 'ti-list-tree', disponible: 'copia' },
      { id: 'CENTROS', nombre: 'Centros de costo', icono: 'ti-hierarchy-2', disponible: 'copia' },
      { id: 'FLUJO_EFECTIVO', nombre: 'Flujo de efectivo', icono: 'ti-arrows-exchange', disponible: 'pronto' },
      { id: 'MONEDAS', nombre: 'Tipo monedas', icono: 'ti-currency-dollar', disponible: 'comun' },
      { id: 'OBJETOS_CONTABLES', nombre: 'Objetos contables', icono: 'ti-box', disponible: 'pronto' },
      { id: 'CAJA_CHICA', nombre: 'Caja chica', icono: 'ti-cash', disponible: 'pronto' },
      { id: 'TRANSACCIONES', nombre: 'Transacciones', icono: 'ti-transfer', disponible: 'pronto' },
      { id: 'PROVEEDORES', nombre: 'Proveedores', icono: 'ti-truck', disponible: 'pronto' },
      { id: 'CLIENTES', nombre: 'Clientes', icono: 'ti-users', disponible: 'pronto' }] },
    { id: 'operacion', nombre: 'Objetos de operación', icono: 'ti-file-dollar', objetos: [
      { id: 'POLIZAS', nombre: 'Pólizas', icono: 'ti-notebook', disponible: 'pronto' },
      { id: 'CHEQUES', nombre: 'Cheques', icono: 'ti-writing', disponible: 'pronto' },
      { id: 'CUENTAS_BANCARIAS', nombre: 'Cuentas bancarias', icono: 'ti-building-bank', disponible: 'pronto' },
      { id: 'DEPOSITOS', nombre: 'Depósitos', icono: 'ti-cash-banknote', disponible: 'pronto' },
      { id: 'NOTAS_CREDITO', nombre: 'Notas de crédito', icono: 'ti-file-plus', disponible: 'pronto' },
      { id: 'NOTAS_DEBITO', nombre: 'Notas de débito', icono: 'ti-file-minus', disponible: 'pronto' },
      { id: 'CONCILIACION', nombre: 'Conciliación bancaria', icono: 'ti-scale', disponible: 'pronto' },
      { id: 'DISPONIBILIDAD', nombre: 'Disponibilidad bancaria', icono: 'ti-chart-line', disponible: 'pronto' },
      { id: 'COMPRAS', nombre: 'Compras', icono: 'ti-shopping-cart', disponible: 'pronto' },
      { id: 'VENTAS', nombre: 'Ventas', icono: 'ti-receipt', disponible: 'pronto' },
      { id: 'RECIBOS', nombre: 'Recibos', icono: 'ti-receipt-2', disponible: 'pronto' }] }
  ];
  const OBJETOS = SECCIONES.flatMap((s) => s.objetos);
  const objeto = (id) => OBJETOS.find((o) => o.id === id) || { id, nombre: id, icono: 'ti-point', disponible: 'pronto' };
  const PARAMETROS_OBJ = SECCIONES[0].objetos.map((o) => o.id);
  const SELECCIONABLES = OBJETOS.filter((o) => o.disponible !== 'pronto').map((o) => o.id);

  // Parámetros generales de cada grupo, para la comparación.
  const CAMPOS = {
    TIEMPO: [['anio_actual', 'Año actual'], ['mes_actual', 'Mes actual'], ['proximo_cierre', 'Próximo cierre'], ['ultimo_cierre', 'Último cierre'],
      ['inicio_periodo_actual', 'Inicio período actual'], ['fin_periodo_actual', 'Fin período actual'],
      ['inicio_periodo_fiscal', 'Inicio período fiscal'], ['fin_periodo_fiscal', 'Fin período fiscal'],
      ['primer_mes_contable', 'Primer mes contable'], ['ultimo_mes_contable', 'Último mes contable']],
    PANTALLAS: [['aplicar_iva', 'Aplicar IVA'], ['incluir_centros_costo', 'Incluir centros de costo'], ['migracion_bancos', 'Migración de bancos']],
    IMPUESTOS: [['nombre_impuesto1', 'Impuesto 1'], ['impuesto1', 'Impuesto 1 (%)'], ['nombre_impuesto2', 'Impuesto 2'], ['impuesto2', 'Impuesto 2 (%)'],
      ['nombre_impuesto3', 'Impuesto 3'], ['impuesto3', 'Impuesto 3 (%)'], ['nombre_impuesto4', 'Impuesto 4'], ['impuesto4', 'Impuesto 4 (%)']],
    IDP: [['idp_super', 'IDP súper'], ['idp_regular', 'IDP regular'], ['idp_diesel', 'IDP diésel']],
    OTROS: [['valor_cheques_autorizacion', 'Cheques con autorización desde'], ['moneda_integracion', 'Moneda de integración'], ['moneda_ingreso', 'Moneda de ingreso']]
  };
  const ESTADOS = { PENDIENTE: 'Pendiente', APLICADA: 'Aplicada', DESAPLICADA: 'Desaplicada' };
  const fechaHora = (f) => f ? new Date(f).toLocaleString('es-GT', {
    timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
  }).replace(',', '') : '';
  const fechaCorta = (d) => d ? d.split('-').reverse().join('/') : '';
  const valor = (v) => v === null || v === undefined || v === '' ? '—' : v === true ? 'Sí' : v === false ? 'No' : String(v);
  const marcaEstado = (e) => `<span class="rp-estado ${e.toLowerCase()}">${ESTADOS[e]}</span>`;
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['replicacion-empresa'] = function (cont) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    let replicas = [];
    let empresas = [];      // localidades con su organización
    let actual = null;      // réplica abierta (null = nueva)
    let buscar = '';
    let vistaDerecha = 'resumen';
    const cache = {};       // datos de cada empresa: parámetros, firmantes y versiones de catálogos

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
        espacio.innerHTML = `<section class="panel"><p class="vacio">${/replicas/.test(r.error.message) ? 'Falta instalar los scripts 24 y 25 (replicación) en Supabase.' : esc(r.error.message)}</p></section>`;
        return;
      }
      empresas = l.data || [];
      replicas = r.data;
      pintarLista();
      abrir(null);
    }

    async function datosEmpresa(locId) {
      if (!locId) return null;
      if (!(locId in cache)) {
        const [p, c, k] = await Promise.all([
          sb.from('parametros_generales').select('*, firmantes:parametros_firmantes(orden, tipo, nombre, cargo)').eq('localidad_id', locId).maybeSingle(),
          sb.from('catalogos_cuentas').select('id, version, activo, cuentas(count)').eq('localidad_id', locId).order('version', { ascending: false }),
          sb.from('catalogos_centros').select('id, version, activo, centros_costo(count)').eq('localidad_id', locId).order('version', { ascending: false })
        ]);
        const versiones = (lista, rel) => (lista || []).map((v) => ({ id: v.id, version: v.version, activo: v.activo, total: v[rel]?.[0]?.count ?? 0 }));
        cache[locId] = { parametros: p.data || null, cuentas: versiones(c.data, 'cuentas'), centros: versiones(k.data, 'centros_costo') };
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
                <span><i class="ti ti-stack-2" aria-hidden="true"></i>${plural(r.objetos.length, 'objeto', 'objetos')}</span>
                ${r.descripcion ? `<span class="rp-desc" title="${esc(r.descripcion)}">${esc(r.descripcion)}</span>` : ''}
              </div>
            </li>`).join('') || `<li class="tk-vacio"><i class="ti ti-copy" aria-hidden="true"></i>${replicas.length ? 'Ninguna réplica coincide con la búsqueda.' : 'Todavía no hay réplicas.'}</li>`}
        </ul>`;
    }

    async function abrir(r) {
      actual = r;
      pintarLista();
      await pintarDetalle(r
        ? { origen: r.origen_localidad_id, destino: r.destino_localidad_id, objetos: r.objetos, descripcion: r.descripcion || '', fecha_inicial: r.fecha_inicial || '', fecha_final: r.fecha_final || '' }
        : { origen: null, destino: null, objetos: [...PARAMETROS_OBJ], descripcion: '', fecha_inicial: '', fecha_final: '' });
    }

    // ---------- Detalle ----------
    async function pintarDetalle(v) {
      const r = actual;
      const bloqueada = !editable || (r && r.estado !== 'PENDIENTE');
      const dis = bloqueada ? 'disabled' : '';
      const opciones = (sel, excluir) => `<option value="">Seleccionar empresa…</option>` + empresas.filter((e) => e.id !== excluir).map((e) =>
        `<option value="${e.id}" ${sel === e.id ? 'selected' : ''}>${esc(e.codigo)} · ${esc(e.nombre_comercial)}${e.organizacion ? ` — ${esc(e.organizacion.nombre)}` : ''}</option>`).join('');
      const [eo, ed] = await Promise.all([datosEmpresa(v.origen), datosEmpresa(v.destino)]);
      const usuarioModifica = r && r.modificado_en ? `${esc(r.modificado_por_nombre || '')} · ${esc(fechaHora(r.modificado_en))}` : '—';
      pDet.innerHTML = `
        <form class="tk-form rp-form" novalidate>
          <header class="tk-titulo">
            <span class="tk-icono"><i class="ti ti-copy" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto">
              <small>Replicar información contable</small>
              <h2>${r ? `Réplica ${r.numero}` : 'Nueva réplica'}</h2>
            </div>
            <div class="tk-marcas">${marcaEstado(r ? r.estado : 'PENDIENTE')}</div>
            <div class="tk-titulo-acciones">
              ${editable && (!r || r.estado !== 'APLICADA') ? `<button type="submit" class="boton secundario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button>` : ''}
              ${editable && (!r || r.estado !== 'APLICADA') ? '<button type="button" class="boton primario-sm" data-accion="aplicar"><i class="ti ti-player-play" aria-hidden="true"></i> Aplicar réplica</button>' : ''}
              ${editable && r && r.estado === 'APLICADA' ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="desaplicar"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Desaplicar réplica</button>' : ''}
              ${!editable ? '<span class="tk-aviso"><i class="ti ti-lock" aria-hidden="true"></i> Solo un administrador puede replicar</span>' : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>

          <dl class="tk-datos rp-datos">
            <div><dt><i class="ti ti-hash" aria-hidden="true"></i> Réplica</dt><dd>${r ? r.numero : 'Al guardar'}</dd></div>
            <div><dt><i class="ti ti-calendar" aria-hidden="true"></i> Fecha réplica</dt><dd>${esc(fechaHora(r ? r.fecha : new Date()))}</dd></div>
            <div><dt><i class="ti ti-user-plus" aria-hidden="true"></i> Usuario ingresa</dt><dd>${r ? `${esc(r.creado_por_nombre || '')} · ${esc(fechaHora(r.creado_en))}` : '—'}</dd></div>
            <div><dt><i class="ti ti-user-edit" aria-hidden="true"></i> Usuario modifica</dt><dd>${usuarioModifica}</dd></div>
            <div><dt><i class="ti ${r && r.estado === 'DESAPLICADA' ? 'ti-arrow-back-up' : 'ti-player-play'}" aria-hidden="true"></i> ${r && r.estado === 'DESAPLICADA' ? 'Desaplicada' : 'Aplicada'}</dt><dd>${r && r.estado === 'DESAPLICADA' ? `${esc(r.desaplicada_por)} · ${esc(fechaHora(r.desaplicada_en))}` : r && r.aplicada_en ? `${esc(r.aplicada_por)} · ${esc(fechaHora(r.aplicada_en))}` : '—'}</dd></div>
          </dl>

          <div class="rp-empresas">
            <label class="campo"><span>Empresa origen *</span><select name="origen" ${dis}>${opciones(v.origen, v.destino)}</select></label>
            <span class="rp-flecha" aria-hidden="true"><i class="ti ti-arrow-right"></i></span>
            <label class="campo"><span>Empresa destino *</span><select name="destino" ${dis}>${opciones(v.destino, v.origen)}</select></label>
            <label class="campo"><span>Fecha inicial</span><input type="date" name="fecha_inicial" value="${esc(v.fecha_inicial)}" ${dis}></label>
            <label class="campo"><span>Fecha final</span><input type="date" name="fecha_final" value="${esc(v.fecha_final)}" ${dis}></label>
            <label class="campo rp-descripcion"><span>Descripción</span><input name="descripcion" value="${esc(v.descripcion)}" ${!editable || (r && r.estado === 'APLICADA') ? 'disabled' : ''} placeholder="Motivo de la réplica" maxlength="200"></label>
          </div>

          <div class="tk-cuerpo rp-cuerpo">
            <div class="tk-col rp-objetos">
              <div class="rp-marcar">
                <span><b>Objetos a replicar</b> <small>${plural(v.objetos.length, 'marcado', 'marcados')} de ${SELECCIONABLES.length} disponibles</small></span>
                ${!bloqueada ? `
                  <button type="button" class="boton secundario-sm" data-marcar="todos" ${v.objetos.length === SELECCIONABLES.length ? 'disabled' : ''}><i class="ti ti-checks" aria-hidden="true"></i> Marcar todos</button>
                  <button type="button" class="boton secundario-sm" data-marcar="ninguno" ${!v.objetos.length ? 'disabled' : ''}><i class="ti ti-square-off" aria-hidden="true"></i> Desmarcar todos</button>` : ''}
              </div>
              ${SECCIONES.map((s) => seccion(s, v, bloqueada)).join('')}
              <p class="rp-leyenda">
                <span><i class="rp-etiqueta comun">Común</i> compartido por todas las empresas, no se copia</span>
                <span><i class="rp-etiqueta pronto">Próximamente</i> se habilita cuando exista su módulo</span>
              </p>
            </div>
            <div class="tk-col rp-comparacion">
              <div class="rp-pestanas" role="tablist">
                <button type="button" role="tab" class="${vistaDerecha === 'resumen' ? 'activa' : ''}" aria-selected="${vistaDerecha === 'resumen'}" data-vista="resumen"><i class="ti ti-list-check" aria-hidden="true"></i> Resumen</button>
                <button type="button" role="tab" class="${vistaDerecha === 'comparacion' ? 'activa' : ''}" aria-selected="${vistaDerecha === 'comparacion'}" data-vista="comparacion"><i class="ti ti-arrows-left-right" aria-hidden="true"></i> Comparación de parámetros <b>${diferencias(v, eo, ed)}</b></button>
              </div>
              ${vistaDerecha === 'resumen' ? resumen(v, eo, ed) : comparacion(v, eo, ed)}
            </div>
          </div>
        </form>`;
    }

    function seccion(s, v, bloqueada) {
      const marcados = s.objetos.filter((o) => v.objetos.includes(o.id)).length;
      const posibles = s.objetos.filter((o) => o.disponible !== 'pronto');
      return `
        <fieldset class="rp-seccion">
          <legend><i class="ti ${s.icono}" aria-hidden="true"></i> ${esc(s.nombre)} <small>${marcados}/${s.objetos.length}</small>
            ${!bloqueada && posibles.length ? `<button type="button" class="rp-enlace" data-todos="${s.id}">${posibles.every((o) => v.objetos.includes(o.id)) ? 'Quitar todos' : 'Todos'}</button>` : ''}</legend>
          <div class="rp-grupos">
            ${s.objetos.map((o) => `
              <label class="rp-grupo ${o.disponible}" title="${esc(o.nombre)}${o.disponible === 'comun' ? ': compartido por todas las empresas' : o.disponible === 'pronto' ? ': se habilita cuando exista su módulo' : ''}">
                <input type="checkbox" name="objetos" value="${o.id}" ${v.objetos.includes(o.id) ? 'checked' : ''} ${bloqueada || o.disponible === 'pronto' ? 'disabled' : ''}>
                <i class="ti ${o.icono}" aria-hidden="true"></i>
                <span>${esc(o.nombre)}</span>
                ${o.disponible === 'comun' ? '<i class="rp-etiqueta comun">Común</i>' : o.disponible === 'pronto' ? '<i class="rp-etiqueta pronto">Pronto</i>' : ''}
              </label>`).join('')}
          </div>
        </fieldset>`;
    }

    // Qué hará la réplica con cada objeto marcado.
    function resumen(v, eo, ed) {
      if (!v.origen || !v.destino) return '<p class="tk-vacio"><i class="ti ti-arrows-left-right" aria-hidden="true"></i>Elige la empresa origen y la destino para ver qué se replicará.</p>';
      const marcados = v.objetos.map(objeto);
      if (!marcados.length) return '<p class="tk-vacio"><i class="ti ti-checkbox" aria-hidden="true"></i>Marca al menos un objeto para replicar.</p>';
      const params = marcados.filter((o) => PARAMETROS_OBJ.includes(o.id));
      const linea = (icono, titulo, texto, clase = '') => `<li class="${clase}"><i class="ti ${icono}" aria-hidden="true"></i><div><b>${titulo}</b><small>${texto}</small></div></li>`;
      const catalogo = (id, nombre, unidad, icono) => {
        if (!v.objetos.includes(id)) return '';
        const o = (id === 'CUENTAS' ? eo.cuentas : eo.centros).find((x) => x.activo);
        const destino = id === 'CUENTAS' ? ed.cuentas : ed.centros;
        const nueva = (destino[0]?.version || 0) + 1;
        return o
          ? linea(icono, nombre, `Se copia la versión ${o.version} del origen (${plural(o.total, unidad.slice(0, -1), unidad)}) como versión ${nueva} del destino.`)
          : linea('ti-alert-triangle', nombre, `La empresa origen no tiene un catálogo de ${unidad} activo.`, 'falta');
      };
      return `
        <ul class="rp-resumen">
          ${params.length ? (eo.parametros
            ? linea('ti-adjustments', 'Parámetros de la empresa', `${params.map((o) => o.nombre).join(', ')}. ${ed.parametros ? `Se reemplazan ${plural(diferencias(v, eo, ed), 'valor distinto', 'valores distintos')} del destino (se guarda un respaldo).` : 'El destino no tiene parámetros: se crean.'} El NIT no se copia.`)
            : linea('ti-alert-triangle', 'Parámetros de la empresa', 'La empresa origen no tiene Parámetros generales para replicar.', 'falta')) : ''}
          ${catalogo('CUENTAS', 'Cuentas contables', 'cuentas', 'ti-list-tree')}
          ${catalogo('CENTROS', 'Centros de costo', 'centros', 'ti-hierarchy-2')}
          ${marcados.filter((o) => o.disponible === 'comun').map((o) => linea(o.icono, o.nombre, 'Es común a todas las empresas: el destino ya lo tiene.', 'comun')).join('')}
          ${v.fecha_inicial || v.fecha_final ? linea('ti-calendar-event', 'Rango de documentos', `Del ${fechaCorta(v.fecha_inicial) || '…'} al ${fechaCorta(v.fecha_final) || '…'} (para los objetos de operación).`, 'comun') : ''}
        </ul>
        <p class="rp-nota"><i class="ti ti-shield-check" aria-hidden="true"></i> Al desaplicar, el destino vuelve a como estaba: se devuelven sus parámetros y se quitan las versiones de catálogo creadas.</p>`;
    }

    function filasGrupo(id, po, pd) {
      if (id === 'FIRMANTES') {
        const t = (p) => p ? p.firmantes.slice().sort((a, b) => a.orden - b.orden).map((f) => `${f.tipo}${f.nombre ? `: ${f.nombre}` : ''}`).join(' · ') || '—' : '—';
        return [['Firmantes', t(po), t(pd)]];
      }
      return (CAMPOS[id] || []).map(([c, n]) => [n, valor(po ? po[c] : null), valor(pd ? pd[c] : null)]);
    }

    function diferencias(v, eo, ed) {
      if (!eo || !eo.parametros) return 0;
      return PARAMETROS_OBJ.filter((id) => v.objetos.includes(id)).flatMap((id) => filasGrupo(id, eo.parametros, ed && ed.parametros)).filter(([, a, b]) => a !== b).length;
    }

    function comparacion(v, eo, ed) {
      if (!v.origen || !v.destino) return '<p class="tk-vacio"><i class="ti ti-arrows-left-right" aria-hidden="true"></i>Elige la empresa origen y la destino para comparar sus parámetros.</p>';
      const grupos = PARAMETROS_OBJ.filter((id) => v.objetos.includes(id));
      if (!grupos.length) return '<p class="tk-vacio"><i class="ti ti-adjustments" aria-hidden="true"></i>Marca algún grupo de Parámetros de la empresa para compararlo.</p>';
      const po = eo.parametros;
      const pd = ed.parametros;
      return `
        <div class="rp-tabla">
          <table>
            <thead><tr><th>Parámetro</th><th>Origen</th><th>Destino actual</th></tr></thead>
            ${grupos.map((id) => `
              <tbody>
                <tr class="rp-tabla-grupo"><td colspan="3"><i class="ti ${objeto(id).icono}" aria-hidden="true"></i> ${esc(objeto(id).nombre)}</td></tr>
                ${filasGrupo(id, po, pd).map(([n, a, b]) => `
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
        descripcion: form.elements.descripcion.value,
        fecha_inicial: form.elements.fecha_inicial.value,
        fecha_final: form.elements.fecha_final.value
      };
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      const v = leer(form);
      if (!actual || actual.estado === 'PENDIENTE') {
        if (!v.origen || !v.destino) { error.textContent = 'Elige la empresa origen y la empresa destino.'; return null; }
        if (!v.objetos.length) { error.textContent = 'Marca al menos un objeto para replicar.'; return null; }
        if (v.fecha_inicial && v.fecha_final && v.fecha_final < v.fecha_inicial) { error.textContent = 'La fecha final no puede ser anterior a la inicial.'; return null; }
      }
      error.textContent = '';
      const d = {
        origen_localidad_id: v.origen, destino_localidad_id: v.destino, objetos: v.objetos, descripcion: v.descripcion.trim() || null,
        fecha_inicial: v.fecha_inicial || null, fecha_final: v.fecha_final || null
      };
      const r = actual
        ? await sb.from('replicas').update(d).eq('id', actual.id).select('*').single()
        : await sb.from('replicas').insert(d).select('*').single();
      if (r.error) {
        error.textContent = /fecha_inicial|fecha_final|replicas_objetos_check/.test(r.error.message) ? 'Falta instalar el script 25 (objetos y fechas de la réplica) en Supabase.' : window.UI.traducirError(r.error);
        return null;
      }
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
      if (accion === 'aplicar') {
        // Lo que se cambió en pantalla se guarda antes de aplicar.
        const guardada = await guardar(form);
        if (!guardada) return;
        const dest = nombreEmpresa(guardada.destino_localidad_id);
        if (!confirm(`¿Aplicar la réplica ${guardada.numero} a ${dest}? Se reemplazan los parámetros elegidos y se crean las versiones de catálogo marcadas. Se guarda un respaldo para poder desaplicarla.`)) return;
        const { data, error } = await sb.rpc('aplicar_replica', { p_id: guardada.id });
        if (error) { pDet.querySelector('.modal-error').textContent = window.UI.traducirError(error); return; }
        const partes = [data.parametros ? 'parámetros' : '', data.cuentas ? plural(data.cuentas, 'cuenta', 'cuentas') : '', data.centros ? plural(data.centros, 'centro de costo', 'centros de costo') : ''].filter(Boolean);
        window.FIN.aviso(`Réplica ${data.numero} aplicada a ${dest}${partes.length ? ` · ${partes.join(', ')}` : ''}`);
        return recargar(guardada.id);
      }
      if (!confirm(`¿Desaplicar la réplica ${actual.numero}? ${nombreEmpresa(actual.destino_localidad_id)} vuelve a como estaba antes de aplicarla.`)) return;
      const { data, error } = await sb.rpc('desaplicar_replica', { p_id: actual.id });
      if (error) { form.querySelector('.modal-error').textContent = window.UI.traducirError(error); return; }
      window.FIN.aviso(`Réplica ${data.numero} desaplicada`);
      return recargar(actual.id);
    }

    cont.addEventListener('click', (e) => {
      if (e.target.closest('[data-accion=nueva]')) return abrir(null);
      const ac = e.target.closest('[data-accion=aplicar], [data-accion=desaplicar]');
      if (ac) return ejecutar(ac.dataset.accion);
      const vt = e.target.closest('[data-vista]');
      if (vt) { vistaDerecha = vt.dataset.vista; return pintarDetalle(leer(pDet.querySelector('form'))); }
      const mk = e.target.closest('[data-marcar]');
      if (mk) {
        const v = leer(pDet.querySelector('form'));
        v.objetos = mk.dataset.marcar === 'todos' ? [...SELECCIONABLES] : [];
        return pintarDetalle(v);
      }
      const td = e.target.closest('[data-todos]');
      if (td) {
        e.preventDefault();
        const v = leer(pDet.querySelector('form'));
        const ids = SECCIONES.find((s) => s.id === td.dataset.todos).objetos.filter((o) => SELECCIONABLES.includes(o.id)).map((o) => o.id);
        v.objetos = ids.every((id) => v.objetos.includes(id)) ? v.objetos.filter((id) => !ids.includes(id)) : [...new Set([...v.objetos, ...ids])];
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
      if (form && e.target.matches('[name=origen], [name=destino], [name=objetos], [name=fecha_inicial], [name=fecha_final]')) pintarDetalle(leer(form));
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
