// Contabilidad · Registros · Partidas contables (administración de pólizas), con el diseño de
// Tickets · Asignación:
//   Arriba, los parámetros: organización y localidad (cada partida pertenece a una de ellas),
//   año, mes, tipo de partida y estado.
//   Maestro: las partidas de esa empresa y período.
//   Detalle: encabezado (período, número del mes y anual, tipo, moneda y tipo de cambio,
//   descripción; fecha y usuario automáticos), líneas (cuenta de movimiento, concepto, debe o
//   haber y centro de costo) con sus totales y la diferencia, justificación y las acciones:
//   registrar o guardar, aprobar, hacer definitiva, anular, copiar, imprimir y eliminar.
(function () {
  const { esc } = window.UI;

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const ESTADOS = [
    { valor: 'todas', texto: 'Todas' }, { valor: 'pendientes', texto: 'Pendientes de aprobar' }, { valor: 'aprobadas', texto: 'Aprobadas' },
    { valor: 'definitivas', texto: 'Definitivas' }, { valor: 'anuladas', texto: 'Anuladas' }
  ];
  const zona = { timeZone: 'America/Guatemala', hour12: false };
  const fechaHora = (f) => f ? new Date(f).toLocaleString('es-GT', { ...zona, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '') : '';
  const fechaCorta = (f) => f ? new Date(f).toLocaleString('es-GT', { ...zona, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '';
  const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
  const monto = (n) => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const redondear = (n) => Math.round(Number(n || 0) * 100) / 100;
  const CLASIFICACIONES = ['PARTIDA DEL MES', 'PARTIDA DE APERTURA', 'PARTIDA DE AJUSTE', 'PARTIDA DE CIERRE'];
  // Procesos que generan partidas automáticas; se habilitan cuando existan sus módulos.
  const LIQUIDACIONES = [
    { id: 'ventas', texto: 'Liquidar ventas', icono: 'ti-receipt', modulo: 'Facturación y ventas' },
    { id: 'compras', texto: 'Liquidar compras', icono: 'ti-shopping-cart', modulo: 'Compras' },
    { id: 'caja', texto: 'Liquidar caja chica', icono: 'ti-cash', modulo: 'Caja chica' }
  ];

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['partidas-contables'] = function (cont) {
    const sb = window.FIN.sb;
    const yo = window.FIN.perfil();
    const admin = window.FIN.puedeEditarCatalogos();
    const superAdmin = window.FIN.esSuperAdmin();
    let organizaciones = [];
    let localidades = [];
    let tipos = [];
    let monedas = [];       // con su tipo de cambio de venta más reciente
    let partidas = [];
    let actual = null;      // partida abierta (null = nueva)
    let lineas = [];        // líneas en edición: { cuenta_id, centro_id, concepto, debe, haber }
    let copia = null;       // encabezado de la partida que se copia
    let buscar = '';
    let siguiente = null;   // número que tendría la partida nueva (Obtener póliza)
    let modoImpresion = 'general';
    const catalogos = {};   // cuentas por versión del catálogo
    const centrosLoc = {};  // centros de costo por localidad
    const [anioHoy, mesHoy] = hoy().split('-').map(Number);
    const f = { org: yo.organizacion_id || null, loc: yo.localidad_id || null, anio: anioHoy, mes: mesHoy, tipo: 0, estado: 'todas' };

    cont.innerHTML = `
      <div class="ta-espacio ta-apilado pc-espacio">
        <section class="ta-filtros pc-filtros" id="pc-filtros"></section>
        <div class="ta-cuerpo">
          <section class="tk-bandeja ta-maestro" id="pc-maestro"></section>
          <section class="tk-detalle ta-detalle" id="pc-detalle"></section>
        </div>
      </div>`;
    const espacio = cont.querySelector('.ta-espacio');
    const pFil = cont.querySelector('#pc-filtros');
    const pMae = cont.querySelector('#pc-maestro');
    const pDet = cont.querySelector('#pc-detalle');

    const localidad = (id) => localidades.find((l) => l.id === id);
    const organizacion = (id) => organizaciones.find((o) => o.id === id);
    const tipo = (id) => tipos.find((t) => t.id === id);
    const moneda = (id) => monedas.find((m) => m.id === id);
    const editable = () => admin && (!actual || (!actual.definitiva && actual.estado === 'VIGENTE'));

    function ajustarAlto() {
      if (!espacio.isConnected) return window.removeEventListener('resize', ajustarAlto);
      const arriba = espacio.getBoundingClientRect().top + window.scrollY;
      const alto = Math.max(640, window.innerHeight - arriba - 16);
      espacio.style.setProperty('--tk-alto', `${alto}px`);
      const sobra = document.documentElement.scrollHeight - window.innerHeight;
      if (sobra > 0 && alto - sobra >= 640) espacio.style.setProperty('--tk-alto', `${alto - sobra}px`);
    }
    window.addEventListener('resize', ajustarAlto);

    async function iniciar() {
      ajustarAlto();
      const [o, l, t, m, tc, prueba] = await Promise.all([
        sb.from('organizaciones').select('id, codigo, nombre').eq('activo', true).order('codigo'),
        sb.from('localidades').select('id, codigo, correlativo, nombre_comercial, organizacion_id').eq('activo', true).order('organizacion_id').order('correlativo'),
        sb.from('tipos_partida').select('id, codigo, siglas, nombre, clasificacion').eq('activo', true).order('codigo'),
        sb.from('monedas').select('id, codigo, nombre, simbolo, iso').eq('activo', true).order('codigo'),
        sb.from('tipos_cambio').select('moneda_id, valor_venta, fecha').order('fecha', { ascending: false }).limit(200),
        sb.from('partidas').select('id').limit(1)
      ]);
      const err = prueba.error || t.error || m.error;
      if (err) {
        espacio.innerHTML = `<section class="panel"><p class="vacio">${/partidas/.test(err.message) ? 'Falta instalar el script 34 (partidas contables) en Supabase.' : esc(err.message)}</p></section>`;
        return;
      }
      organizaciones = o.data || [];
      localidades = l.data || [];
      tipos = t.data || [];
      monedas = (m.data || []).map((x) => ({ ...x, cambio: x.iso === 'GTQ' ? 1 : Number((tc.data || []).find((c) => c.moneda_id === x.id)?.valor_venta || 1) }));
      if (!f.org) f.org = organizaciones[0]?.id || null;
      if (!f.loc || localidad(f.loc)?.organizacion_id !== f.org) f.loc = localidades.find((x) => x.organizacion_id === f.org)?.id || null;
      pintarFiltros();
      await consultar();
    }

    // Cuentas de una versión del catálogo: las de movimiento son las que no agrupan a otras.
    async function cuentasDe(catalogoId) {
      if (!catalogoId) return [];
      if (!catalogos[catalogoId]) {
        const { data } = await sb.from('cuentas').select('id, codigo, nombre, cuenta_mayor_id, vigente').eq('catalogo_id', catalogoId).order('codigo');
        const padres = new Set((data || []).map((c) => c.cuenta_mayor_id).filter(Boolean));
        catalogos[catalogoId] = (data || []).map((c) => ({ ...c, movimiento: !padres.has(c.id) && c.vigente }));
      }
      return catalogos[catalogoId];
    }
    async function catalogoActivo(locId) {
      const { data } = await sb.from('catalogos_cuentas').select('id, version').eq('localidad_id', locId).eq('activo', true).order('version', { ascending: false }).limit(1);
      return data?.[0] || null;
    }
    async function centrosDe(locId) {
      if (!locId) return [];
      if (!centrosLoc[locId]) {
        const { data: k } = await sb.from('catalogos_centros').select('id').eq('localidad_id', locId).eq('activo', true).order('version', { ascending: false }).limit(1);
        let lista = [];
        if (k?.[0]) {
          const { data } = await sb.from('centros_costo').select('id, codigo, nombre, centro_mayor_id, vigente').eq('catalogo_id', k[0].id).order('codigo');
          const padres = new Set((data || []).map((c) => c.centro_mayor_id).filter(Boolean));
          lista = (data || []).filter((c) => !padres.has(c.id) && c.vigente);
        }
        centrosLoc[locId] = lista;
      }
      return centrosLoc[locId];
    }

    // ---------- Parámetros ----------
    function pintarFiltros() {
      const locs = localidades.filter((x) => x.organizacion_id === f.org);
      const anios = []; for (let a = anioHoy + 1; a >= anioHoy - 6; a--) anios.push(a);
      pFil.innerHTML = `
        <div class="ta-titulo"><span class="tk-icono"><i class="ti ti-notebook" aria-hidden="true"></i></span><div><small>Registros</small><h2>Partidas contables</h2></div></div>
        <label class="campo"><span>Organización</span><select name="org">${organizaciones.map((o) => `<option value="${o.id}" ${f.org === o.id ? 'selected' : ''}>${o.codigo} · ${esc(o.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Localidad (empresa)</span><select name="loc">${locs.map((x) => `<option value="${x.id}" ${f.loc === x.id ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre_comercial)}</option>`).join('') || '<option value="">Sin localidades</option>'}</select></label>
        <label class="campo"><span>Año</span><select name="anio">${anios.map((a) => `<option ${f.anio === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <label class="campo"><span>Mes</span><select name="mes">${MESES.map((n, i) => `<option value="${i + 1}" ${f.mes === i + 1 ? 'selected' : ''}>${String(i + 1).padStart(2, '0')} · ${n}</option>`).join('')}</select></label>
        <label class="campo"><span>Tipo de partida</span><select name="tipo"><option value="0">Todos</option>${tipos.map((t) => `<option value="${t.id}" ${f.tipo === t.id ? 'selected' : ''}>${esc(t.siglas)} · ${esc(t.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado">${ESTADOS.map((e) => `<option value="${e.valor}" ${f.estado === e.valor ? 'selected' : ''}>${esc(e.texto)}</option>`).join('')}</select></label>`;
    }

    async function consultar() {
      if (!f.loc) { partidas = []; pintarMaestro(); return abrir(null); }
      let q = sb.from('partidas').select('*').eq('organizacion_id', f.org).eq('localidad_id', f.loc).eq('anio', f.anio).eq('mes', f.mes).order('numero', { ascending: false });
      if (f.tipo) q = q.eq('tipo_partida_id', f.tipo);
      if (f.estado === 'pendientes') q = q.eq('estado', 'VIGENTE').eq('aprobada', false);
      if (f.estado === 'aprobadas') q = q.eq('estado', 'VIGENTE').eq('aprobada', true).eq('definitiva', false);
      if (f.estado === 'definitivas') q = q.eq('definitiva', true);
      if (f.estado === 'anuladas') q = q.eq('estado', 'ANULADA');
      const { data, error } = await q;
      if (error) { pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      partidas = data;
      if (actual && !partidas.some((p) => p.id === actual.id)) actual = null;
      pintarMaestro();
      await abrir(actual ? partidas.find((p) => p.id === actual.id) : partidas[0] || null);
    }

    // ---------- Maestro ----------
    const marcas = (p) => p.estado === 'ANULADA' ? '<span class="pc-marca anulada">Anulada</span>'
      : `${p.definitiva ? '<span class="pc-marca definitiva"><i class="ti ti-lock" aria-hidden="true"></i> Definitiva</span>' : p.aprobada ? '<span class="pc-marca aprobada"><i class="ti ti-check" aria-hidden="true"></i> Aprobada</span>' : '<span class="pc-marca pendiente">Por aprobar</span>'}${Number(p.total_debe) !== Number(p.total_haber) ? '<span class="pc-marca descuadrada">Descuadrada</span>' : ''}`;

    function pintarMaestro() {
      const q = buscar.trim().toLowerCase();
      const filas = partidas.filter((p) => !q || [p.numero, p.numero_anual, p.descripcion, p.usuario, tipo(p.tipo_partida_id)?.nombre, tipo(p.tipo_partida_id)?.siglas]
        .some((v) => String(v || '').toLowerCase().includes(q)));
      const vig = partidas.filter((p) => p.estado === 'VIGENTE');
      const loc = localidad(f.loc);
      pMae.innerHTML = `
        <header class="tk-bandeja-cab tg-cab">
          <h2>Partidas <small>${esc(loc ? `${loc.codigo} · ${MESES[f.mes - 1]} ${f.anio}` : '')} · ${partidas.length}</small></h2>
          <div class="ta-totales pc-resumen"><span class="ta-total"><b>${monto(vig.reduce((s, p) => s + Number(p.total_debe), 0))}</b> debe</span><span class="ta-total"><b>${monto(vig.reduce((s, p) => s + Number(p.total_haber), 0))}</b> haber</span><span class="ta-total sin"><b>${vig.filter((p) => !p.aprobada).length}</b> por aprobar</span></div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar partida, descripción, tipo…" value="${esc(buscar)}" aria-label="Buscar partidas"></label>
          ${admin && f.loc ? '<button type="button" class="boton primario-sm" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva partida</button>' : ''}
        </header>
        <div class="ta-tabla">
          <table>
            <thead><tr><th>Partida</th><th>Anual</th><th>Fecha</th><th>Tipo</th><th>Descripción</th><th class="num">Debe</th><th class="num">Haber</th><th>Estado</th><th>Usuario</th><th><span class="oculto">Acciones</span></th></tr></thead>
            <tbody>
              ${filas.map((p) => `
                <tr class="${actual && actual.id === p.id ? 'actual' : ''} ${p.estado === 'ANULADA' ? 'pc-anulada' : ''}" data-partida="${p.id}" tabindex="0">
                  <td class="fuerte"><i class="tk-franja-celda ${p.estado === 'ANULADA' ? 'e1' : p.definitiva ? 'e7' : p.aprobada ? 'e6' : 'e4'}" aria-hidden="true"></i>${String(p.mes).padStart(2, '0')}-${p.numero}</td>
                  <td>${p.numero_anual}</td>
                  <td>${esc(fechaCorta(p.fecha))}</td>
                  <td><span class="pc-tipo" title="${esc(tipo(p.tipo_partida_id)?.nombre || '')}">${esc(tipo(p.tipo_partida_id)?.siglas || '')}</span></td>
                  <td class="ta-desc" title="${esc(p.descripcion)}">${esc(p.descripcion)}</td>
                  <td class="num">${monto(p.total_debe)}</td>
                  <td class="num">${monto(p.total_haber)}</td>
                  <td><span class="pc-marcas">${marcas(p)}</span></td>
                  <td>${esc(p.usuario || '')}</td>
                  <td class="tk-acciones">
                    <button type="button" class="tk-accion-btn" data-modificar="${p.id}" title="${admin && !p.definitiva && p.estado === 'VIGENTE' ? 'Modificar' : 'Ver'} la partida"><i class="ti ${admin && !p.definitiva && p.estado === 'VIGENTE' ? 'ti-pencil' : 'ti-eye'}" aria-hidden="true"></i> ${admin && !p.definitiva && p.estado === 'VIGENTE' ? 'Modificar' : 'Ver'}</button>
                    <button type="button" class="tk-accion-btn peligro" data-eliminar="${p.id}" ${superAdmin && !p.definitiva ? '' : 'disabled'} title="${!superAdmin ? 'Solo el Super Administrador puede eliminar partidas' : p.definitiva ? 'Una partida definitiva no se elimina' : 'Eliminar la partida'}"><i class="ti ti-trash" aria-hidden="true"></i> Eliminar</button>
                  </td>
                </tr>`).join('') || `<tr><td colspan="10" class="tk-vacio"><i class="ti ti-notebook" aria-hidden="true"></i>${partidas.length ? 'Ninguna partida coincide con la búsqueda.' : `No hay partidas en ${MESES[f.mes - 1]} ${f.anio} para esta empresa.`}</td></tr>`}
            </tbody>
          </table>
        </div>`;
    }

    // ---------- Detalle ----------
    async function abrir(p, desde = null) {
      actual = p;
      siguiente = null;
      copia = desde;
      if (p) {
        const { data } = await sb.from('partida_lineas').select('*').eq('partida_id', p.id).order('linea');
        lineas = (data || []).map((l) => ({ cuenta_id: l.cuenta_id, centro_id: l.centro_id, concepto: l.concepto || '', debe: Number(l.debe), haber: Number(l.haber) }));
      } else if (!desde) {
        lineas = [nuevaLinea(), nuevaLinea()];
      }
      await pintarDetalle();
      pMae.querySelectorAll('tr[data-partida]').forEach((tr) => tr.classList.toggle('actual', !!p && tr.dataset.partida === String(p.id)));
    }
    const nuevaLinea = () => ({ cuenta_id: null, centro_id: null, concepto: '', debe: 0, haber: 0 });

    let cuentas = [];
    let centros = [];
    let catalogoNuevo = null;

    async function pintarDetalle() {
      const p = actual;
      if (!f.loc) { pDet.innerHTML = '<div class="tk-vacio ta-elige"><i class="ti ti-building" aria-hidden="true"></i>Elige la organización y la localidad.</div>'; return; }
      catalogoNuevo = p ? null : await catalogoActivo(f.loc);
      [cuentas, centros] = await Promise.all([cuentasDe(p ? p.catalogo_id : catalogoNuevo?.id), centrosDe(p ? p.localidad_id : f.loc)]);
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const base = copia || p || {};
      // Tipo de partida por defecto: Partida de Diario.
      const tp = tipo(base.tipo_partida_id) || tipos.find((t) => t.siglas === 'PD') || null;
      const mon = moneda(base.moneda_id) || monedas.find((m) => m.iso === 'GTQ') || monedas[0];
      const org = organizacion(p ? p.organizacion_id : f.org);
      const loc = localidad(p ? p.localidad_id : f.loc);
      const movimiento = cuentas.filter((c) => c.movimiento);
      const clasif = base.clasificacion || CLASIFICACIONES[0];
      const procesar = admin && p && p.estado === 'VIGENTE' && !p.definitiva;
      pDet.innerHTML = `
        <form class="tk-form ta-form pc-form" novalidate>
          <header class="tk-titulo">
            <span class="tk-icono"><i class="ti ti-file-invoice" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto">
              <small>Administración de pólizas · ${esc(org ? org.nombre : '')}</small>
              <h2>${p ? `Partida ${String(p.mes).padStart(2, '0')}-${p.numero} <span class="pc-anual">anual ${p.numero_anual}</span>` : copia ? 'Réplica de partida' : 'Nueva partida'}</h2>
            </div>
            <div class="tk-marcas">${p ? marcas(p) : '<span class="pc-marca pendiente">Sin registrar</span>'}</div>
            <div class="tk-titulo-acciones">
              ${procesar ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="anular"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>' : ''}
              ${ed ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${p ? 'Guardar cambios' : 'Registrar partida'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          ${!p && !catalogoNuevo ? '<p class="tk-aviso"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Esta empresa no tiene un catálogo de cuentas activo: créalo en Catálogos · Cuentas y CC · Cuentas contables.</p>' : ''}
          ${p && p.estado === 'ANULADA' ? `<p class="tk-aviso"><i class="ti ti-ban" aria-hidden="true"></i> Anulada por ${esc(p.anulada_por || '')} el ${esc(fechaHora(p.anulada_en))}: ${esc(p.motivo_anulacion || '')}</p>` : ''}

          <div class="pc-encabezado">
            <div class="pc-periodo">
              <div><span>Empresa</span><b class="pc-empresa" title="${esc(loc ? loc.nombre_comercial : '')}">${esc(loc ? `${loc.codigo} · ${loc.nombre_comercial}` : '')}</b></div>
              <div><span>Año</span><b>${p ? p.anio : f.anio}</b></div>
              <div><span>Mes</span><b>${MESES[(p ? p.mes : f.mes) - 1]}</b></div>
              <div class="pc-poliza"><span>Póliza</span><b data-poliza>${p ? p.numero : siguiente ? siguiente.numero : '—'}</b>${p ? '' : '<button type="button" class="rp-enlace" data-accion="obtener" title="Ver el número que tendrá la partida al registrarla">Obtener póliza</button>'}</div>
              <div><span>Póliza anual</span><b data-anual>${p ? p.numero_anual : siguiente ? siguiente.anual : '—'}</b></div>
            </div>
            <label class="campo"><span>Moneda</span>
              <select name="moneda_id" ${dis}>${monedas.map((m) => `<option value="${m.id}" ${mon && mon.id === m.id ? 'selected' : ''}>${esc(m.nombre)} (${esc(m.simbolo)})</option>`).join('')}</select></label>
            <label class="campo"><span>Valor cambio</span><input type="number" name="tipo_cambio" step="any" min="0" value="${esc(String(base.tipo_cambio ?? mon?.cambio ?? 1))}" ${dis}></label>
            <div class="ta-auto pc-auto"><span>Fecha · usuario</span><b ${p ? '' : 'data-reloj'}>${esc(fechaHora(p ? p.fecha : new Date()))}</b><small>${esc(p ? p.usuario || '' : (yo.usuario || '').toUpperCase())}</small></div>
            <div class="ta-auto pc-auto"><span>Estado · tipo</span><b class="${p && p.estado === 'ANULADA' ? 'pc-rojo' : ''}">${p ? esc(p.estado) : 'VIGENTE'}</b><small>${p ? esc(p.origen) : 'MANUAL'}</small></div>
          </div>

          <div class="pc-encabezado pc-fila2">
            <label class="campo"><span>Tipo de partida (transacción) *</span>
              <select name="tipo_partida_id" ${dis}><option value="">Seleccionar…</option>${tipos.map((t) => `<option value="${t.id}" ${tp && tp.id === t.id ? 'selected' : ''}>${t.codigo} · ${esc(t.siglas)} · ${esc(t.nombre)}</option>`).join('')}</select></label>
            <label class="campo pc-desc"><span>Descripción *</span><input name="descripcion" value="${esc(base.descripcion || '')}" maxlength="300" placeholder="Concepto general de la partida" ${dis}></label>
            <label class="campo"><span>Clasificación</span>
              <select name="clasificacion" ${dis}>${CLASIFICACIONES.map((c) => `<option ${clasif === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          </div>

          <div class="pc-banda">
            <label class="pc-check" title="${p ? 'Aprobar requiere que la partida esté cuadrada (debe = haber)' : 'Registra la partida para poder aprobarla'}">
              <input type="checkbox" data-check="aprobada" ${p && p.aprobada ? 'checked' : ''} ${procesar ? '' : 'disabled'}> Aprobada</label>
            <span class="pc-banda-dato"><span>Aprobado por</span><b>${p && p.aprobada ? esc(p.aprobada_por || '') : '—'}</b><b>${p && p.aprobada ? esc(fechaCorta(p.aprobada_en)) : ''}</b></span>
            <label class="pc-check" title="Una partida definitiva ya no se modifica, anula ni elimina">
              <input type="checkbox" data-check="definitiva" ${p && p.definitiva ? 'checked' : ''} ${procesar && p.aprobada ? '' : 'disabled'}> Definitiva</label>
            ${p && p.definitiva ? `<span class="pc-banda-dato"><span>Por</span><b>${esc(p.definitiva_por || '')}</b><b>${esc(fechaCorta(p.definitiva_en))}</b></span>` : ''}
            <span class="pc-banda-sep"></span>
            <label class="pc-generar" title="Genera las líneas de la partida a partir de una transacción de otro módulo"><span>Generar transacción</span><input disabled placeholder="Próximamente"></label>
            <button type="button" class="boton secundario-sm" data-proximamente="Transacciones" title="Transacciones de los módulos (facturación, compras, bancos…): se habilitan cuando existan esos módulos"><i class="ti ti-arrows-exchange" aria-hidden="true"></i> Transacciones</button>
            <button type="button" class="boton secundario-sm" data-accion="copiar" ${p && admin ? '' : 'disabled'} title="Crear una partida nueva con este encabezado y estas líneas"><i class="ti ti-copy" aria-hidden="true"></i> Replicar</button>
          </div>

          <section class="pc-detalle">
            <div class="pc-detalle-cab">
              <h3 class="ta-col-titulo"><i class="ti ti-list-details" aria-hidden="true"></i> Detalle de la partida <small class="tk-tenue">${movimiento.length} cuentas de movimiento disponibles</small></h3>
              ${ed ? '<button type="button" class="rp-enlace" data-accion="linea"><i class="ti ti-plus" aria-hidden="true"></i> Agregar línea</button>' : ''}
            </div>
            <div class="pc-lineas">
              <table>
                <thead><tr><th class="pc-n">#</th><th class="pc-cta">Cuenta</th><th>Nombre de la cuenta</th><th>Concepto</th><th class="num">Debe</th><th class="num">Haber</th><th class="pc-cc">Centro de costo</th><th>Nombre del centro</th><th></th></tr></thead>
                <tbody>${lineas.map((l, i) => filaLinea(l, i, ed)).join('')}</tbody>
                <tfoot><tr><td colspan="4" class="pc-totales-lbl">Totales <span data-estado-cuadre></span></td><td class="num" data-total="debe"></td><td class="num" data-total="haber"></td><td colspan="3" data-diferencia></td></tr></tfoot>
              </table>
            </div>
            <datalist id="pc-cuentas">${movimiento.map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>
            <datalist id="pc-centros">${centros.map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>
          </section>

          <div class="pc-pie">
            <label class="campo pc-justificacion"><span>Justificación</span><textarea name="justificacion" rows="2" placeholder="Soporte o motivo de la partida (documentos, autorizaciones…)" ${dis}>${esc(base.justificacion || '')}</textarea></label>
            <div class="pc-liquidar">
              <span>Liquidaciones</span>
              <div>${LIQUIDACIONES.map((l) => `<button type="button" class="boton secundario-sm" data-proximamente="${esc(l.texto)}" data-modulo="${esc(l.modulo)}" title="Genera la partida automática con los movimientos de ${esc(l.modulo)}: se habilita cuando exista ese módulo"><i class="ti ${l.icono}" aria-hidden="true"></i> ${esc(l.texto)}</button>`).join('')}</div>
            </div>
            <div class="pc-impresion">
              <span>Impresión</span>
              <div class="pc-radios" role="radiogroup" aria-label="Tipo de impresión">
                <label><input type="radio" name="impresion" value="general" ${modoImpresion === 'general' ? 'checked' : ''}> Póliza general</label>
                <label><input type="radio" name="impresion" value="centros" ${modoImpresion === 'centros' ? 'checked' : ''}> Integración por centro de costo</label>
              </div>
              <button type="button" class="boton primario-sm" data-imprimir ${p ? '' : 'disabled'}><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>
            </div>
          </div>
        </form>`;
      totalizar();
    }

    function filaLinea(l, i, ed) {
      const c = cuentas.find((x) => x.id === l.cuenta_id);
      const cc = centros.find((x) => x.id === l.centro_id);
      const dis = ed ? '' : 'disabled';
      return `
        <tr data-linea="${i}">
          <td class="pc-n">${i + 1}</td>
          <td class="pc-cta"><input list="pc-cuentas" data-campo="cuenta" value="${esc(c ? c.codigo : '')}" placeholder="Código" ${dis} aria-label="Cuenta de la línea ${i + 1}"></td>
          <td class="pc-nombre" data-nombre-cuenta>${esc(c ? c.nombre : '')}</td>
          <td><input data-campo="concepto" value="${esc(l.concepto)}" maxlength="200" ${dis} aria-label="Concepto de la línea ${i + 1}"></td>
          <td class="num"><input type="number" step="0.01" min="0" data-campo="debe" value="${l.debe ? l.debe : ''}" ${dis} aria-label="Debe de la línea ${i + 1}"></td>
          <td class="num"><input type="number" step="0.01" min="0" data-campo="haber" value="${l.haber ? l.haber : ''}" ${dis} aria-label="Haber de la línea ${i + 1}"></td>
          <td class="pc-cc"><input list="pc-centros" data-campo="centro" value="${esc(cc ? cc.codigo : '')}" placeholder="Código" ${dis} aria-label="Centro de costo de la línea ${i + 1}"></td>
          <td class="pc-nombre" data-nombre-centro>${esc(cc ? cc.nombre : '')}</td>
          <td>${ed ? `<button type="button" class="icono-boton" data-quitar-linea="${i}" aria-label="Quitar la línea ${i + 1}"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td>
        </tr>`;
    }

    function totalizar() {
      const d = redondear(lineas.reduce((s, l) => s + Number(l.debe || 0), 0));
      const h = redondear(lineas.reduce((s, l) => s + Number(l.haber || 0), 0));
      const dif = redondear(d - h);
      const td = pDet.querySelector('[data-total=debe]');
      if (!td) return;
      td.textContent = monto(d);
      pDet.querySelector('[data-total=haber]').textContent = monto(h);
      const cuadra = dif === 0 && d > 0;
      pDet.querySelector('[data-diferencia]').innerHTML = cuadra
        ? '<span class="pc-cuadre ok"><i class="ti ti-circle-check" aria-hidden="true"></i> Cuadrada</span>'
        : `<span class="pc-cuadre no"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Diferencia ${monto(Math.abs(dif))} ${dif > 0 ? 'en el debe' : dif < 0 ? 'en el haber' : ''}</span>`;
    }

    // Lee el encabezado del formulario.
    function encabezado(form) {
      return {
        tipo_partida_id: form.elements.tipo_partida_id.value ? Number(form.elements.tipo_partida_id.value) : null,
        moneda_id: Number(form.elements.moneda_id.value),
        tipo_cambio: Number(form.elements.tipo_cambio.value) || 1,
        descripcion: form.elements.descripcion.value.trim(),
        clasificacion: form.elements.clasificacion.value,
        justificacion: form.elements.justificacion.value
      };
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      const e = encabezado(form);
      const validas = lineas.filter((l) => l.cuenta_id || l.debe || l.haber);
      if (!e.tipo_partida_id) { error.textContent = 'Elige el tipo de partida.'; return; }
      if (!e.descripcion) { error.textContent = 'Escribe la descripción de la partida.'; form.elements.descripcion.focus(); return; }
      if (!validas.length) { error.textContent = 'Agrega al menos una línea con su cuenta y su monto.'; return; }
      const mala = validas.findIndex((l) => !l.cuenta_id || !(Number(l.debe) > 0 || Number(l.haber) > 0) || (Number(l.debe) > 0 && Number(l.haber) > 0));
      if (mala >= 0) { error.textContent = `Revisa la línea ${lineas.indexOf(validas[mala]) + 1}: necesita una cuenta de movimiento y un monto en el debe o en el haber (no en ambos).`; return; }
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      error.textContent = '';
      try {
        let id = actual?.id;
        if (actual) {
          const r = await sb.from('partidas').update(e).eq('id', id);
          if (r.error) throw r.error;
          const del = await sb.from('partida_lineas').delete().eq('partida_id', id);
          if (del.error) throw del.error;
        } else {
          const r = await sb.from('partidas').insert({ ...e, organizacion_id: f.org, localidad_id: f.loc, anio: f.anio, mes: f.mes, catalogo_id: catalogoNuevo?.id || null }).select('id').single();
          if (r.error) throw r.error;
          id = r.data.id;
        }
        const ins = await sb.from('partida_lineas').insert(validas.map((l, i) => ({
          partida_id: id, linea: i + 1, cuenta_id: l.cuenta_id, centro_id: l.centro_id || null, concepto: l.concepto, debe: redondear(l.debe), haber: redondear(l.haber)
        })));
        if (ins.error) throw ins.error;
        window.FIN.aviso(actual ? 'Partida guardada' : 'Partida registrada');
        actual = { id };
        await consultar();
      } catch (err) {
        error.textContent = /clasificacion/.test(err.message || '') ? 'Falta instalar el script 35 (clasificación de partidas) en Supabase.' : window.UI.traducirError(err);
      } finally {
        boton.disabled = false;
      }
    }

    async function cambiarEstado(accion) {
      const p = actual;
      let motivo = null;
      const nombre = `${String(p.mes).padStart(2, '0')}-${p.numero}`;
      if (accion === 'ANULAR') {
        motivo = prompt(`Motivo de la anulación de la partida ${nombre}:`);
        if (motivo === null) return false;
      } else if (accion === 'DEFINITIVA' && !confirm(`¿Hacer definitiva la partida ${nombre}? Ya no se podrá modificar, anular ni eliminar.`)) return false;
      else if (accion === 'ELIMINAR' && !confirm(`¿Eliminar la partida ${nombre}? Se borra con todas sus líneas. No se puede deshacer.`)) return false;
      const { error } = await sb.rpc('cambiar_estado_partida', { p_id: p.id, p_accion: accion, p_motivo: motivo });
      if (error) {
        const e = pDet.querySelector('.modal-error');
        if (e) e.textContent = window.UI.traducirError(error); else window.FIN.aviso(window.UI.traducirError(error));
        return false;
      }
      window.FIN.aviso({ APROBAR: 'Partida aprobada', DESAPROBAR: 'Se quitó la aprobación', DEFINITIVA: 'Partida definitiva', ANULAR: 'Partida anulada', ELIMINAR: 'Partida eliminada' }[accion]);
      if (accion === 'ELIMINAR') actual = null;
      await consultar();
      return true;
    }

    // Número que tendrá la partida nueva en la empresa y período elegidos.
    async function obtenerPoliza() {
      const [m, a] = await Promise.all([
        sb.from('partidas').select('numero').eq('localidad_id', f.loc).eq('anio', f.anio).eq('mes', f.mes).order('numero', { ascending: false }).limit(1),
        sb.from('partidas').select('numero_anual').eq('localidad_id', f.loc).eq('anio', f.anio).order('numero_anual', { ascending: false }).limit(1)
      ]);
      siguiente = { numero: (m.data?.[0]?.numero || 0) + 1, anual: (a.data?.[0]?.numero_anual || 0) + 1 };
      pDet.querySelector('[data-poliza]').textContent = siguiente.numero;
      pDet.querySelector('[data-anual]').textContent = siguiente.anual;
      window.FIN.aviso(`La partida se registrará como ${String(f.mes).padStart(2, '0')}-${siguiente.numero} (anual ${siguiente.anual}) si nadie registra otra antes`);
    }

    // ---------- Impresión ----------
    function imprimir(modo) {
      const p = actual;
      const org = organizacion(p.organizacion_id);
      const loc = localidad(p.localidad_id);
      const tp = tipo(p.tipo_partida_id);
      const mon = moneda(p.moneda_id);
      const filas = lineas.map((l, i) => ({ ...l, n: i + 1, cuenta: cuentas.find((c) => c.id === l.cuenta_id), centro: centros.find((c) => c.id === l.centro_id) }));
      const fila = (l) => `<tr><td>${l.n}</td><td>${esc(l.cuenta?.codigo || '')}</td><td>${esc(l.cuenta?.nombre || '')}</td><td>${esc(l.concepto || '')}</td><td class="n">${l.debe ? monto(l.debe) : ''}</td><td class="n">${l.haber ? monto(l.haber) : ''}</td>${modo === 'general' ? `<td>${esc(l.centro ? `${l.centro.codigo} ${l.centro.nombre}` : '')}</td>` : ''}</tr>`;
      let cuerpo;
      if (modo === 'centros') {
        const grupos = {};
        filas.forEach((l) => { const k = l.centro ? `${l.centro.codigo} · ${l.centro.nombre}` : 'Sin centro de costo'; (grupos[k] = grupos[k] || []).push(l); });
        cuerpo = Object.entries(grupos).map(([k, ls]) => `<tr class="g"><td colspan="6">${esc(k)}</td></tr>${ls.map(fila).join('')}<tr class="s"><td colspan="4">Subtotal</td><td class="n">${monto(ls.reduce((s, l) => s + Number(l.debe), 0))}</td><td class="n">${monto(ls.reduce((s, l) => s + Number(l.haber), 0))}</td></tr>`).join('');
      } else cuerpo = filas.map(fila).join('');
      const v = window.open('', '_blank');
      if (!v) return window.FIN.aviso('Permite las ventanas emergentes para imprimir');
      v.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Partida ${p.mes}-${p.numero}</title><style>
        body{font:12px/1.4 Arial,sans-serif;color:#111;margin:28px}h1{font-size:16px;margin:0}h2{font-size:13px;margin:2px 0 12px;font-weight:normal;color:#444}
        .cab{display:grid;grid-template-columns:repeat(4,1fr);gap:4px 16px;border:1px solid #bbb;padding:8px 10px;margin-bottom:12px}.cab b{display:block;font-size:10px;color:#666;text-transform:uppercase}
        table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left}th{background:#eee;font-size:11px}.n{text-align:right;white-space:nowrap}
        tr.g td{background:#f3f3f3;font-weight:bold}tr.s td{font-weight:bold}tfoot td{font-weight:bold;background:#eee}.firmas{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;margin-top:60px;text-align:center}.firmas div{border-top:1px solid #333;padding-top:4px}
        @media print{body{margin:10mm}}</style></head><body>
        <h1>${esc(org?.nombre || '')} · ${esc(loc ? `${loc.codigo} ${loc.nombre_comercial}` : '')}</h1>
        <h2>Partida contable ${String(p.mes).padStart(2, '0')}-${p.numero} · póliza anual ${p.numero_anual}${modo === 'centros' ? ' · integrada por centro de costo' : ''}${p.estado === 'ANULADA' ? ' · ANULADA' : ''}</h2>
        <div class="cab"><div><b>Período</b>${MESES[p.mes - 1]} ${p.anio}</div><div><b>Fecha</b>${esc(fechaHora(p.fecha))}</div><div><b>Tipo</b>${esc(tp ? `${tp.siglas} · ${tp.nombre}` : '')}</div><div><b>Moneda</b>${esc(mon ? mon.nombre : '')} · TC ${esc(String(p.tipo_cambio))}</div>
          <div style="grid-column:1/-1"><b>Descripción</b>${esc(p.descripcion)}</div>${p.justificacion ? `<div style="grid-column:1/-1"><b>Justificación</b>${esc(p.justificacion)}</div>` : ''}</div>
        <table><thead><tr><th>#</th><th>Cuenta</th><th>Nombre</th><th>Concepto</th><th class="n">Debe</th><th class="n">Haber</th>${modo === 'general' ? '<th>Centro de costo</th>' : ''}</tr></thead><tbody>${cuerpo}</tbody>
        <tfoot><tr><td colspan="4">Totales</td><td class="n">${monto(p.total_debe)}</td><td class="n">${monto(p.total_haber)}</td>${modo === 'general' ? '<td></td>' : ''}</tr></tfoot></table>
        <div class="firmas"><div>Elaboró: ${esc(p.usuario || '')}</div><div>Revisó</div><div>Aprobó: ${esc(p.aprobada_por || '')}</div></div>
        <script>window.onload=()=>window.print()<\/script></body></html>`);
      v.document.close();
    }

    // ---------- Eventos ----------
    function leerLinea(tr) {
      const i = Number(tr.dataset.linea);
      const l = lineas[i];
      const val = (c) => tr.querySelector(`[data-campo=${c}]`).value.trim();
      const cod = val('cuenta');
      const c = cuentas.find((x) => x.codigo === cod && x.movimiento);
      l.cuenta_id = c ? c.id : null;
      tr.querySelector('[data-nombre-cuenta]').innerHTML = c ? esc(c.nombre) : cod ? '<span class="pc-error">No es una cuenta de movimiento</span>' : '';
      const codc = val('centro');
      const cc = centros.find((x) => x.codigo === codc);
      l.centro_id = cc ? cc.id : null;
      tr.querySelector('[data-nombre-centro]').innerHTML = cc ? esc(cc.nombre) : codc ? '<span class="pc-error">Centro no encontrado</span>' : '';
      l.concepto = val('concepto');
      l.debe = Number(val('debe')) || 0;
      l.haber = Number(val('haber')) || 0;
    }

    cont.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar]')) {
        buscar = e.target.value;
        const pos = e.target.selectionStart;
        pintarMaestro();
        const b = pMae.querySelector('[data-buscar]');
        b.focus(); b.setSelectionRange(pos, pos);
        return;
      }
      const tr = e.target.closest('tr[data-linea]');
      if (tr) {
        // Un monto en el debe borra el del haber y al revés.
        if (e.target.dataset.campo === 'debe' && e.target.value) tr.querySelector('[data-campo=haber]').value = '';
        if (e.target.dataset.campo === 'haber' && e.target.value) tr.querySelector('[data-campo=debe]').value = '';
        leerLinea(tr);
        totalizar();
      }
    });
    cont.addEventListener('change', async (e) => {
      if (e.target.closest('#pc-filtros')) {
        const n = e.target.name;
        const val = e.target.value;
        if (n === 'org') { f.org = Number(val); f.loc = localidades.find((x) => x.organizacion_id === f.org)?.id || null; pintarFiltros(); }
        else if (n === 'loc') f.loc = val ? Number(val) : null;
        else if (n === 'estado') f.estado = val;
        else f[n] = Number(val);
        actual = null;
        return consultar();
      }
      if (e.target.name === 'tipo_partida_id') {
        const t = tipo(Number(e.target.value));
        pDet.querySelector('[data-clasificacion]').innerHTML = t ? `Clasificación: ${esc(t.clasificacion)}` : '&nbsp;';
      }
      if (e.target.name === 'impresion') { modoImpresion = e.target.value; return; }
      const ck = e.target.closest('[data-check]');
      if (ck) {
        const accion = ck.dataset.check === 'aprobada' ? (ck.checked ? 'APROBAR' : 'DESAPROBAR') : 'DEFINITIVA';
        if (accion === 'DEFINITIVA' && !ck.checked) { ck.checked = true; return; }
        return cambiarEstado(accion).then((ok) => { if (!ok) ck.checked = !ck.checked; });
      }
      if (e.target.name === 'moneda_id') {
        const m = moneda(Number(e.target.value));
        if (m) e.target.form.elements.tipo_cambio.value = m.cambio;
      }
    });
    cont.addEventListener('keydown', (e) => {
      const tr = e.target.closest('tr[data-linea]');
      // Enter en la última línea agrega otra.
      if (tr && e.key === 'Enter') {
        e.preventDefault();
        if (Number(tr.dataset.linea) === lineas.length - 1) agregarLinea();
        else pDet.querySelector(`tr[data-linea="${Number(tr.dataset.linea) + 1}"] [data-campo=cuenta]`)?.focus();
        return;
      }
      const fila = e.target.closest('tr[data-partida]');
      if (fila && e.target === fila && e.key === 'Enter') abrir(partidas.find((p) => String(p.id) === fila.dataset.partida));
    });
    function agregarLinea() {
      const form = pDet.querySelector('.pc-form');
      const tbody = form.querySelector('.pc-lineas tbody');
      lineas.push(nuevaLinea());
      tbody.insertAdjacentHTML('beforeend', filaLinea(lineas[lineas.length - 1], lineas.length - 1, true));
      const ult = tbody.lastElementChild;
      ult.scrollIntoView({ block: 'nearest' });
      ult.querySelector('[data-campo=cuenta]').focus();
    }
    cont.addEventListener('click', async (e) => {
      const bm = e.target.closest('[data-modificar]');
      if (bm) { await abrir(partidas.find((p) => String(p.id) === bm.dataset.modificar)); return pDet.querySelector('[name=descripcion]')?.focus(); }
      const be = e.target.closest('[data-eliminar]');
      if (be) { actual = partidas.find((p) => String(p.id) === be.dataset.eliminar); return cambiarEstado('ELIMINAR'); }
      const fila = e.target.closest('tr[data-partida]');
      if (fila) return abrir(partidas.find((p) => String(p.id) === fila.dataset.partida));
      const ac = e.target.closest('[data-accion]');
      if (ac) {
        const a = ac.dataset.accion;
        if (a === 'nueva') return abrir(null);
        if (a === 'obtener') return obtenerPoliza();
        if (a === 'linea') return agregarLinea();
        if (a === 'copiar') {
          const form = pDet.querySelector('.pc-form');
          const base = { ...encabezado(form) };
          const ls = lineas.map((l) => ({ ...l }));
          await abrir(null, base);
          lineas = ls;
          await pintarDetalle();
          return window.FIN.aviso(`Copia lista para ${MESES[f.mes - 1]} ${f.anio}: revisa y presiona «Registrar partida»`);
        }
        return cambiarEstado({ anular: 'ANULAR', aprobar: 'APROBAR', desaprobar: 'DESAPROBAR', definitiva: 'DEFINITIVA' }[a]);
      }
      const im = e.target.closest('[data-imprimir]');
      if (im) return imprimir(modoImpresion);
      const px = e.target.closest('[data-proximamente]');
      if (px) return window.FIN.aviso(`${px.dataset.proximamente}: se habilita cuando exista el módulo${px.dataset.modulo ? ` de ${px.dataset.modulo}` : ' que origina las transacciones'}`);
      const ql = e.target.closest('[data-quitar-linea]');
      if (ql) {
        lineas.splice(Number(ql.dataset.quitarLinea), 1);
        if (!lineas.length) lineas.push(nuevaLinea());
        const tbody = pDet.querySelector('.pc-lineas tbody');
        tbody.innerHTML = lineas.map((l, i) => filaLinea(l, i, true)).join('');
        return totalizar();
      }
    });
    cont.addEventListener('submit', (e) => {
      if (!e.target.matches('.pc-form')) return;
      e.preventDefault();
      guardar(e.target);
    });

    const reloj = setInterval(() => {
      if (!pDet.isConnected) return clearInterval(reloj);
      const c = pDet.querySelector('[data-reloj]');
      if (c) c.textContent = fechaHora(new Date());
    }, 1000);

    iniciar();
  };
})();
