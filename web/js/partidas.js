// Contabilidad · Registros · Partidas contables (administración de pólizas), en una sola pantalla:
//   Izquierda: parámetros (empresa agrupada por organización, año, mes, tipo y estado), el estado
//   del mes (abierto o cerrado), los totales y las partidas de esa empresa y período.
//   Derecha: la partida elegida en tarjetas (período y póliza, moneda, control con aprobación y
//   definitiva), tipo, descripción y clasificación, y en pestañas el detalle contable (cuenta de
//   movimiento, concepto, debe o haber y centro de costo, con totales y cuadre), el soporte
//   (justificación) y los procesos (transacciones, liquidaciones e impresión).
//   Una partida registrada se abre en consulta; «Modificar» la habilita solo si el mes no está
//   cerrado (Contabilidad · Procesos · Cierre de mes) y la partida está vigente y no es definitiva.
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
  const PESTANAS = [
    { id: 'detalle', texto: 'Detalle contable', icono: 'ti-list-details' },
    { id: 'soporte', texto: 'Soporte y justificación', icono: 'ti-file-description' },
    { id: 'procesos', texto: 'Procesos e impresión', icono: 'ti-settings-automation' }
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
    let modo = 'ver';       // partida registrada: 'ver' o 'editar' (con «Modificar»)
    let pestana = 'detalle';
    let cierre = null;      // cierre del mes elegido (null = abierto)
    const catalogos = {};   // cuentas por versión del catálogo
    const centrosLoc = {};  // centros de costo por localidad
    const [anioHoy, mesHoy] = hoy().split('-').map(Number);
    const f = { org: yo.organizacion_id || null, loc: yo.localidad_id || null, anio: anioHoy, mes: mesHoy, tipo: 0, estado: 'todas' };

    cont.innerHTML = `
      <div class="pq-espacio">
        <aside class="pq-lista">
          <div class="pq-filtros" id="pc-filtros"></div>
          <div class="pq-bandeja" id="pc-maestro"></div>
        </aside>
        <section class="pq-detalle" id="pc-detalle"></section>
      </div>`;
    const espacio = cont.querySelector('.pq-espacio');
    const pFil = cont.querySelector('#pc-filtros');
    const pMae = cont.querySelector('#pc-maestro');
    const pDet = cont.querySelector('#pc-detalle');

    const localidad = (id) => localidades.find((l) => l.id === id);
    const organizacion = (id) => organizaciones.find((o) => o.id === id);
    const tipo = (id) => tipos.find((t) => t.id === id);
    const moneda = (id) => monedas.find((m) => m.id === id);
    const cerrado = () => !!(cierre && cierre.cerrado);
    const vigente = (p) => p && !p.definitiva && p.estado === 'VIGENTE';
    // Se puede modificar si y solo si el mes no está cerrado y la partida sigue vigente.
    const puedeModificar = (p) => admin && !cerrado() && vigente(p);
    const editable = () => admin && !cerrado() && (!actual || (modo === 'editar' && vigente(actual)));
    const nombreMes = () => `${MESES[f.mes - 1]} ${f.anio}`;

    function ajustarAlto() {
      if (!espacio.isConnected) return window.removeEventListener('resize', ajustarAlto);
      const arriba = espacio.getBoundingClientRect().top + window.scrollY;
      const alto = Math.max(560, window.innerHeight - arriba - 14);
      espacio.style.setProperty('--pq-alto', `${alto}px`);
      const sobra = document.documentElement.scrollHeight - window.innerHeight;
      if (sobra > 0 && alto - sobra >= 560) espacio.style.setProperty('--pq-alto', `${alto - sobra}px`);
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
      if (localidad(f.loc)) f.org = localidad(f.loc).organizacion_id;
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
      const grupos = organizaciones.map((o) => ({ o, locs: localidades.filter((x) => x.organizacion_id === o.id) })).filter((g) => g.locs.length);
      const anios = []; for (let a = anioHoy + 1; a >= anioHoy - 6; a--) anios.push(a);
      pFil.innerHTML = `
        <div class="pq-marca-titulo"><span class="tk-icono"><i class="ti ti-notebook" aria-hidden="true"></i></span><div><small>Registros</small><h2>Partidas contables</h2></div></div>
        <label class="campo pq-c2"><span>Empresa</span><select name="loc">${grupos.map((g) => `<optgroup label="${g.o.codigo} · ${esc(g.o.nombre)}">${g.locs.map((x) => `<option value="${x.id}" ${f.loc === x.id ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre_comercial)}</option>`).join('')}</optgroup>`).join('') || '<option value="">Sin localidades</option>'}</select></label>
        <label class="campo"><span>Año</span><select name="anio">${anios.map((a) => `<option ${f.anio === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <label class="campo"><span>Mes</span><select name="mes">${MESES.map((n, i) => `<option value="${i + 1}" ${f.mes === i + 1 ? 'selected' : ''}>${String(i + 1).padStart(2, '0')} · ${n}</option>`).join('')}</select></label>
        <label class="campo"><span>Tipo</span><select name="tipo"><option value="0">Todos</option>${tipos.map((t) => `<option value="${t.id}" ${f.tipo === t.id ? 'selected' : ''}>${esc(t.siglas)} · ${esc(t.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado">${ESTADOS.map((e) => `<option value="${e.valor}" ${f.estado === e.valor ? 'selected' : ''}>${esc(e.texto)}</option>`).join('')}</select></label>`;
    }

    async function consultar() {
      cierre = null;
      if (!f.loc) { partidas = []; pintarMaestro(); return abrir(null); }
      let q = sb.from('partidas').select('*').eq('organizacion_id', f.org).eq('localidad_id', f.loc).eq('anio', f.anio).eq('mes', f.mes).order('numero', { ascending: false });
      if (f.tipo) q = q.eq('tipo_partida_id', f.tipo);
      if (f.estado === 'pendientes') q = q.eq('estado', 'VIGENTE').eq('aprobada', false);
      if (f.estado === 'aprobadas') q = q.eq('estado', 'VIGENTE').eq('aprobada', true).eq('definitiva', false);
      if (f.estado === 'definitivas') q = q.eq('definitiva', true);
      if (f.estado === 'anuladas') q = q.eq('estado', 'ANULADA');
      const [{ data, error }, c] = await Promise.all([
        q,
        sb.from('cierres_mes').select('*').eq('localidad_id', f.loc).eq('anio', f.anio).eq('mes', f.mes).limit(1)
      ]);
      if (error) { pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      // Sin el script 50 el mes se toma como abierto.
      cierre = c.error ? null : c.data?.[0] || null;
      partidas = data;
      if (actual && !partidas.some((p) => p.id === actual.id)) actual = null;
      pintarMaestro();
      await abrir(actual ? partidas.find((p) => p.id === actual.id) : partidas[0] || null);
    }

    // ---------- Maestro ----------
    const marcas = (p) => p.estado === 'ANULADA' ? '<span class="pc-marca anulada">Anulada</span>'
      : `${p.definitiva ? '<span class="pc-marca definitiva"><i class="ti ti-lock" aria-hidden="true"></i> Definitiva</span>' : p.aprobada ? '<span class="pc-marca aprobada"><i class="ti ti-check" aria-hidden="true"></i> Aprobada</span>' : '<span class="pc-marca pendiente">Por aprobar</span>'}${Number(p.total_debe) !== Number(p.total_haber) ? '<span class="pc-marca descuadrada">Descuadrada</span>' : ''}`;
    const franja = (p) => p.estado === 'ANULADA' ? 'e1' : p.definitiva ? 'e7' : p.aprobada ? 'e6' : 'e4';

    function pintarMaestro() {
      const q = buscar.trim().toLowerCase();
      const filas = partidas.filter((p) => !q || [`${p.mes}-${p.numero}`, p.numero_anual, p.descripcion, p.usuario, tipo(p.tipo_partida_id)?.nombre, tipo(p.tipo_partida_id)?.siglas]
        .some((v) => String(v || '').toLowerCase().includes(q)));
      const vig = partidas.filter((p) => p.estado === 'VIGENTE');
      const porAprobar = vig.filter((p) => !p.aprobada).length;
      pMae.innerHTML = `
        <div class="pq-mes ${cerrado() ? 'cerrado' : 'abierto'}">
          <i class="ti ${cerrado() ? 'ti-lock' : 'ti-lock-open'}" aria-hidden="true"></i>
          <div><b>${esc(nombreMes())} · ${cerrado() ? 'Mes cerrado' : 'Mes abierto'}</b>
          <small>${cerrado() ? `Cerrado por ${esc(cierre.cerrado_por || '')} el ${esc(fechaCorta(cierre.cerrado_en))}: solo consulta e impresión` : 'Las partidas se registran y modifican'}</small></div>
        </div>
        <div class="pq-kpis">
          <div><span>Debe</span><b>${monto(vig.reduce((s, p) => s + Number(p.total_debe), 0))}</b></div>
          <div><span>Haber</span><b>${monto(vig.reduce((s, p) => s + Number(p.total_haber), 0))}</b></div>
          <div class="${porAprobar ? 'pend' : ''}"><span>Por aprobar</span><b>${porAprobar}</b></div>
        </div>
        <div class="pq-buscar-fila">
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar partida, descripción…" value="${esc(buscar)}" aria-label="Buscar partidas"></label>
          ${admin && f.loc ? `<button type="button" class="boton primario-sm" data-accion="nueva" ${cerrado() ? 'disabled title="El mes está cerrado"' : 'title="Registrar una partida nueva en este mes"'}><i class="ti ti-plus" aria-hidden="true"></i> Nueva</button>` : ''}
        </div>
        <div class="pq-cuenta-lista"><span>${partidas.length} partida${partidas.length === 1 ? '' : 's'}</span>${q ? `<span>${filas.length} coinciden</span>` : ''}</div>
        <ul class="pq-items" role="listbox" aria-label="Partidas del mes">
          ${filas.map((p) => `
            <li class="${actual && actual.id === p.id ? 'actual' : ''} ${p.estado === 'ANULADA' ? 'anulada' : ''}" data-partida="${p.id}" tabindex="0" role="option" aria-selected="${!!actual && actual.id === p.id}">
              <i class="tk-franja-celda ${franja(p)}" aria-hidden="true"></i>
              <div class="pq-item-cab"><b>${String(p.mes).padStart(2, '0')}-${p.numero}</b><span class="pc-tipo" title="${esc(tipo(p.tipo_partida_id)?.nombre || '')}">${esc(tipo(p.tipo_partida_id)?.siglas || '')}</span><small>anual ${p.numero_anual}</small><time>${esc(fechaCorta(p.fecha))}</time></div>
              <p title="${esc(p.descripcion)}">${esc(p.descripcion)}</p>
              <div class="pq-item-pie"><span class="pc-marcas">${marcas(p)}</span><b>${monto(p.total_debe)}</b></div>
            </li>`).join('') || `<li class="pq-vacio"><i class="ti ti-notebook" aria-hidden="true"></i>${partidas.length ? 'Ninguna partida coincide con la búsqueda.' : `No hay partidas en ${esc(nombreMes())} para esta empresa.`}</li>`}
        </ul>`;
    }

    // ---------- Detalle ----------
    async function abrir(p, desde = null) {
      actual = p;
      siguiente = null;
      copia = desde;
      modo = 'ver';
      if (p) {
        const { data } = await sb.from('partida_lineas').select('*').eq('partida_id', p.id).order('linea');
        lineas = (data || []).map((l) => ({ cuenta_id: l.cuenta_id, centro_id: l.centro_id, concepto: l.concepto || '', debe: Number(l.debe), haber: Number(l.haber) }));
      } else if (!desde) {
        lineas = [nuevaLinea(), nuevaLinea()];
      }
      await pintarDetalle();
      pMae.querySelectorAll('li[data-partida]').forEach((li) => {
        const si = !!p && li.dataset.partida === String(p.id);
        li.classList.toggle('actual', si);
        li.setAttribute('aria-selected', si);
      });
    }
    const nuevaLinea = () => ({ cuenta_id: null, centro_id: null, concepto: '', debe: 0, haber: 0 });

    let cuentas = [];
    let centros = [];
    let catalogoNuevo = null;

    // Motivo por el que una partida registrada no se puede modificar.
    function motivoBloqueo(p) {
      if (!admin) return 'Solo un administrador modifica partidas';
      if (cerrado()) return `El mes de ${nombreMes()} está cerrado`;
      if (p.estado === 'ANULADA') return 'La partida está anulada';
      if (p.definitiva) return 'La partida es definitiva';
      return '';
    }

    function acciones(p, ed) {
      if (!p) {
        return ed ? '<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Registrar partida</button>' : '';
      }
      if (modo === 'editar' && ed) {
        return `<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Cancelar</button>
          <button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar cambios</button>`;
      }
      const bloqueo = motivoBloqueo(p);
      const procesar = puedeModificar(p);
      return `
        <button type="button" class="boton primario-sm" data-accion="modificar" ${bloqueo ? `disabled title="${esc(bloqueo)}: no se modifica"` : 'title="Habilitar la edición de la partida"'}><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>
        <button type="button" class="boton secundario-sm" data-accion="copiar" ${admin && !cerrado() ? '' : 'disabled'} title="${cerrado() ? 'El mes está cerrado' : 'Crear una partida nueva con este encabezado y estas líneas'}"><i class="ti ti-copy" aria-hidden="true"></i> Replicar</button>
        ${procesar ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="anular"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>' : ''}
        ${superAdmin ? `<button type="button" class="boton secundario-sm rp-peligro" data-accion="eliminar" ${!p.definitiva && !cerrado() ? '' : 'disabled'} title="${p.definitiva ? 'Una partida definitiva no se elimina' : cerrado() ? 'El mes está cerrado' : 'Eliminar la partida'}"><i class="ti ti-trash" aria-hidden="true"></i></button>` : ''}
        <span class="pc-imprimir">
          <button type="button" class="boton secundario-sm" data-imprimir title="Imprimir la partida"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>
          ${window.REPORTE_XLSX ? window.REPORTE_XLSX.boton('data-excel-partida') : ''}
          <select class="boton secundario-sm pq-modo-imp" name="impresion" aria-label="Tipo de impresión">
            <option value="general" ${modoImpresion === 'general' ? 'selected' : ''}>Póliza general</option>
            <option value="centros" ${modoImpresion === 'centros' ? 'selected' : ''}>Por centro de costo</option>
          </select>
        </span>`;
    }

    async function pintarDetalle() {
      const p = actual;
      if (!f.loc) { pDet.innerHTML = '<div class="tk-vacio ta-elige"><i class="ti ti-building" aria-hidden="true"></i>Elige la empresa.</div>'; return; }
      if (!p && !copia && (!admin || cerrado())) {
        pDet.innerHTML = `<div class="tk-vacio ta-elige"><i class="ti ${cerrado() ? 'ti-lock' : 'ti-notebook'}" aria-hidden="true"></i>${cerrado() ? `El mes de ${esc(nombreMes())} está cerrado: no se registran partidas nuevas.` : 'Elige una partida de la lista.'}</div>`;
        return;
      }
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
      const procesar = !!p && puedeModificar(p) && modo === 'ver';
      const estadoTxt = p ? (modo === 'editar' ? 'En modificación' : 'Consulta') : copia ? 'Réplica sin registrar' : 'Sin registrar';
      pDet.innerHTML = `
        <form class="pq-form ${ed ? 'editando' : 'consulta'}" novalidate>
          <header class="pq-titulo">
            <span class="tk-icono"><i class="ti ti-file-invoice" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto">
              <small>Administración de pólizas · ${esc(org ? org.nombre : '')}</small>
              <h2>${p ? `Partida ${String(p.mes).padStart(2, '0')}-${p.numero} <span class="pc-anual">anual ${p.numero_anual}</span>` : copia ? 'Réplica de partida' : 'Nueva partida'}</h2>
            </div>
            <div class="pc-marcas">${p ? marcas(p) : ''}<span class="pc-marca ${ed ? 'editando' : 'consulta'}">${estadoTxt}</span>${cerrado() ? '<span class="pc-marca cerrado"><i class="ti ti-lock" aria-hidden="true"></i> Mes cerrado</span>' : ''}</div>
            <div class="pq-acciones">${acciones(p, ed)}</div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          ${!p && !catalogoNuevo ? '<p class="tk-aviso pq-aviso"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Esta empresa no tiene un catálogo de cuentas activo: créalo en Catálogos · Cuentas y CC · Cuentas contables.</p>' : ''}
          ${p && p.estado === 'ANULADA' ? `<p class="tk-aviso pq-aviso"><i class="ti ti-ban" aria-hidden="true"></i> Anulada por ${esc(p.anulada_por || '')} el ${esc(fechaHora(p.anulada_en))}: ${esc(p.motivo_anulacion || '')}</p>` : ''}

          <div class="pq-cabecera">
            <div class="pq-tarjeta pq-periodo">
              <div class="pq-empresa"><small>Empresa</small><b title="${esc(loc ? loc.nombre_comercial : '')}">${esc(loc ? `${loc.codigo} · ${loc.nombre_comercial}` : '')}</b></div>
              <div class="pq-cifras">
                <div><span>Año</span><b>${p ? p.anio : f.anio}</b></div>
                <div><span>Mes</span><b>${MESES[(p ? p.mes : f.mes) - 1]}</b></div>
                <div class="pq-poliza"><span>Póliza</span><b data-poliza>${p ? p.numero : siguiente ? siguiente.numero : '—'}</b>${p ? '' : '<button type="button" class="rp-enlace" data-accion="obtener" title="Ver el número que tendrá la partida al registrarla">Obtener</button>'}</div>
                <div><span>Póliza anual</span><b data-anual>${p ? p.numero_anual : siguiente ? siguiente.anual : '—'}</b></div>
              </div>
            </div>
            <div class="pq-tarjeta pq-moneda">
              <label class="campo"><span>Moneda</span>
                <select name="moneda_id" ${dis}>${monedas.map((m) => `<option value="${m.id}" ${mon && mon.id === m.id ? 'selected' : ''}>${esc(m.nombre)} (${esc(m.simbolo)})</option>`).join('')}</select></label>
              <label class="campo"><span>Valor cambio</span><input type="number" name="tipo_cambio" step="any" min="0" value="${esc(String(base.tipo_cambio ?? mon?.cambio ?? 1))}" ${dis}></label>
            </div>
            <div class="pq-tarjeta pq-control">
              <dl>
                <div><dt>Fecha y hora</dt><dd ${p ? '' : 'data-reloj'}>${esc(fechaHora(p ? p.fecha : new Date()))}</dd></div>
                <div><dt>Usuario</dt><dd>${esc(p ? p.usuario || '' : (yo.usuario || '').toUpperCase())}</dd></div>
                <div><dt>Estado · origen</dt><dd class="${p && p.estado === 'ANULADA' ? 'pc-rojo' : ''}">${p ? esc(p.estado) : 'VIGENTE'} <small>${p ? esc(p.origen) : 'MANUAL'}</small></dd></div>
              </dl>
              <div class="pq-checks">
                <label class="pc-check" title="${p ? 'Aprobar requiere que la partida esté cuadrada (debe = haber)' : 'Registra la partida para poder aprobarla'}">
                  <input type="checkbox" data-check="aprobada" ${p && p.aprobada ? 'checked' : ''} ${procesar ? '' : 'disabled'}> Aprobada
                  <small>${p && p.aprobada ? `${esc(p.aprobada_por || '')} · ${esc(fechaCorta(p.aprobada_en))}` : ''}</small></label>
                <label class="pc-check" title="Una partida definitiva ya no se modifica, anula ni elimina">
                  <input type="checkbox" data-check="definitiva" ${p && p.definitiva ? 'checked' : ''} ${procesar && p.aprobada ? '' : 'disabled'}> Definitiva
                  <small>${p && p.definitiva ? `${esc(p.definitiva_por || '')} · ${esc(fechaCorta(p.definitiva_en))}` : ''}</small></label>
              </div>
            </div>
          </div>

          <div class="pq-fila">
            <label class="campo"><span>Tipo de partida (transacción) *</span>
              <select name="tipo_partida_id" ${dis}><option value="">Seleccionar…</option>${tipos.map((t) => `<option value="${t.id}" ${tp && tp.id === t.id ? 'selected' : ''}>${t.codigo} · ${esc(t.siglas)} · ${esc(t.nombre)}</option>`).join('')}</select></label>
            <label class="campo"><span>Descripción *</span><input name="descripcion" value="${esc(base.descripcion || '')}" maxlength="300" placeholder="Concepto general de la partida" ${dis}></label>
            <label class="campo"><span>Clasificación</span>
              <select name="clasificacion" ${dis}>${CLASIFICACIONES.map((c) => `<option ${clasif === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          </div>

          <div class="pq-pestanas">
            <div class="pq-tabs-barra">
              <div class="rp-pestanas" role="tablist">${PESTANAS.map((t) => `<button type="button" role="tab" data-pestana="${t.id}" class="${pestana === t.id ? 'activa' : ''}" aria-selected="${pestana === t.id}"><i class="ti ${t.icono}" aria-hidden="true"></i> ${esc(t.texto)}${t.id === 'detalle' ? ` <b data-n-lineas>${lineas.length}</b>` : ''}</button>`).join('')}</div>
              <div class="pq-tabs-der">
                <span class="tk-tenue">${movimiento.length} cuentas de movimiento</span>
                <span data-diferencia></span>
                ${ed ? '<button type="button" class="boton secundario-sm" data-accion="linea"><i class="ti ti-plus" aria-hidden="true"></i> Agregar línea</button>' : ''}
              </div>
            </div>
            <div class="pq-panel" data-panel="detalle" ${pestana === 'detalle' ? '' : 'hidden'}>
              <div class="pc-lineas">
                <table>
                  <thead><tr><th class="pc-n">#</th><th class="pc-cta">Cuenta</th><th>Nombre de la cuenta</th><th>Concepto</th><th class="num">Debe</th><th class="num">Haber</th><th class="pc-cc">Centro de costo</th><th>Nombre del centro</th><th class="pq-x"></th></tr></thead>
                  <tbody>${lineas.map((l, i) => filaLinea(l, i, ed)).join('')}</tbody>
                  <tfoot><tr><td colspan="4" class="pc-totales-lbl">Totales</td><td class="num" data-total="debe"></td><td class="num" data-total="haber"></td><td colspan="3"></td></tr></tfoot>
                </table>
              </div>
              <datalist id="pc-cuentas">${movimiento.map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>
              <datalist id="pc-centros">${centros.map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>
            </div>
            <div class="pq-panel" data-panel="soporte" ${pestana === 'soporte' ? '' : 'hidden'}>
              <label class="campo pq-justificacion"><span>Justificación</span><textarea name="justificacion" placeholder="Soporte o motivo de la partida (documentos, autorizaciones…)" ${dis}>${esc(base.justificacion || '')}</textarea></label>
            </div>
            <div class="pq-panel pq-procesos" data-panel="procesos" ${pestana === 'procesos' ? '' : 'hidden'}>
              <div class="pq-tarjeta">
                <h3 class="ta-col-titulo"><i class="ti ti-arrows-exchange" aria-hidden="true"></i> Transacciones</h3>
                <label class="campo pc-generar" title="Genera las líneas de la partida a partir de una transacción de otro módulo"><span>Generar transacción</span><input disabled placeholder="Próximamente"></label>
                <button type="button" class="boton secundario-sm" data-proximamente="Transacciones" title="Transacciones de los módulos (facturación, compras, bancos…): se habilitan cuando existan esos módulos"><i class="ti ti-arrows-exchange" aria-hidden="true"></i> Transacciones</button>
              </div>
              <div class="pq-tarjeta">
                <h3 class="ta-col-titulo"><i class="ti ti-receipt-2" aria-hidden="true"></i> Liquidaciones</h3>
                <div class="pq-botones">${LIQUIDACIONES.map((l) => `<button type="button" class="boton secundario-sm" data-proximamente="${esc(l.texto)}" data-modulo="${esc(l.modulo)}" title="Genera la partida automática con los movimientos de ${esc(l.modulo)}: se habilita cuando exista ese módulo"><i class="ti ${l.icono}" aria-hidden="true"></i> ${esc(l.texto)}</button>`).join('')}</div>
              </div>
              <div class="pq-tarjeta">
                <h3 class="ta-col-titulo"><i class="ti ti-printer" aria-hidden="true"></i> Impresión</h3>
                <div class="pc-radios" role="radiogroup" aria-label="Tipo de impresión">
                  <label><input type="radio" name="impresion" value="general" ${modoImpresion === 'general' ? 'checked' : ''}> Póliza general</label>
                  <label><input type="radio" name="impresion" value="centros" ${modoImpresion === 'centros' ? 'checked' : ''}> Integración por centro de costo</label>
                </div>
                <span class="rx-par"><button type="button" class="boton primario-sm" data-imprimir ${p ? '' : 'disabled'}><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>${p && window.REPORTE_XLSX ? window.REPORTE_XLSX.boton('data-excel-partida') : ''}</span>
              </div>
            </div>
          </div>
        </form>`;
      totalizar();
      ajustarAlto();
    }

    function filaLinea(l, i, ed) {
      const c = cuentas.find((x) => x.id === l.cuenta_id);
      const cc = centros.find((x) => x.id === l.centro_id);
      const dis = ed ? '' : 'disabled';
      return `
        <tr data-linea="${i}">
          <td class="pc-n">${i + 1}</td>
          <td class="pc-cta"><input list="pc-cuentas" data-campo="cuenta" value="${esc(c ? c.codigo : '')}" placeholder="${ed ? 'Código' : ''}" ${dis} aria-label="Cuenta de la línea ${i + 1}"></td>
          <td class="pc-nombre" data-nombre-cuenta>${esc(c ? c.nombre : '')}</td>
          <td><input data-campo="concepto" value="${esc(l.concepto)}" maxlength="200" ${dis} aria-label="Concepto de la línea ${i + 1}"></td>
          <td class="num"><input type="number" step="0.01" min="0" data-campo="debe" value="${l.debe ? l.debe : ''}" ${dis} aria-label="Debe de la línea ${i + 1}"></td>
          <td class="num"><input type="number" step="0.01" min="0" data-campo="haber" value="${l.haber ? l.haber : ''}" ${dis} aria-label="Haber de la línea ${i + 1}"></td>
          <td class="pc-cc"><input list="pc-centros" data-campo="centro" value="${esc(cc ? cc.codigo : '')}" placeholder="${ed ? 'Código' : ''}" ${dis} aria-label="Centro de costo de la línea ${i + 1}"></td>
          <td class="pc-nombre" data-nombre-centro>${esc(cc ? cc.nombre : '')}</td>
          <td class="pq-x">${ed ? `<button type="button" class="icono-boton" data-quitar-linea="${i}" aria-label="Quitar la línea ${i + 1}"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td>
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
      const n = pDet.querySelector('[data-n-lineas]');
      if (n) n.textContent = lineas.length;
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
      if (!editable()) { error.textContent = cerrado() ? `El mes de ${nombreMes()} está cerrado: la partida no se modifica.` : 'La partida no se puede modificar.'; return; }
      const e = encabezado(form);
      const validas = lineas.filter((l) => l.cuenta_id || l.debe || l.haber);
      const ir = (t) => { pestana = t; activarPestana(t); };
      if (!e.tipo_partida_id) { error.textContent = 'Elige el tipo de partida.'; return; }
      if (!e.descripcion) { error.textContent = 'Escribe la descripción de la partida.'; form.elements.descripcion.focus(); return; }
      if (!validas.length) { ir('detalle'); error.textContent = 'Agrega al menos una línea con su cuenta y su monto.'; return; }
      const mala = validas.findIndex((l) => !l.cuenta_id || !(Number(l.debe) > 0 || Number(l.haber) > 0) || (Number(l.debe) > 0 && Number(l.haber) > 0));
      if (mala >= 0) { ir('detalle'); error.textContent = `Revisa la línea ${lineas.indexOf(validas[mala]) + 1}: necesita una cuenta de movimiento y un monto en el debe o en el haber (no en ambos).`; return; }
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
    function imprimir(modoImp) {
      const p = actual;
      const org = organizacion(p.organizacion_id);
      const loc = localidad(p.localidad_id);
      const tp = tipo(p.tipo_partida_id);
      const mon = moneda(p.moneda_id);
      const filas = lineas.map((l, i) => ({ ...l, n: i + 1, cuenta: cuentas.find((c) => c.id === l.cuenta_id), centro: centros.find((c) => c.id === l.centro_id) }));
      const fila = (l) => `<tr><td>${l.n}</td><td>${esc(l.cuenta?.codigo || '')}</td><td>${esc(l.cuenta?.nombre || '')}</td><td>${esc(l.concepto || '')}</td><td class="n">${l.debe ? monto(l.debe) : ''}</td><td class="n">${l.haber ? monto(l.haber) : ''}</td>${modoImp === 'general' ? `<td>${esc(l.centro ? `${l.centro.codigo} ${l.centro.nombre}` : '')}</td>` : ''}</tr>`;
      let cuerpo;
      if (modoImp === 'centros') {
        const grupos = {};
        filas.forEach((l) => { const k = l.centro ? `${l.centro.codigo} · ${l.centro.nombre}` : 'Sin centro de costo'; (grupos[k] = grupos[k] || []).push(l); });
        cuerpo = Object.entries(grupos).map(([k, ls]) => `<tr class="g"><td colspan="6">${esc(k)}</td></tr>${ls.map(fila).join('')}<tr class="s"><td colspan="4">Subtotal</td><td class="n">${monto(ls.reduce((s, l) => s + Number(l.debe), 0))}</td><td class="n">${monto(ls.reduce((s, l) => s + Number(l.haber), 0))}</td></tr>`).join('');
      } else cuerpo = filas.map(fila).join('');
      // Encabezado común de los reportes (logo, parámetros, fecha y usuario): window.BANCOS.imprimir.
      window.BANCOS.imprimir(`Partida ${p.mes}-${p.numero}`, `<style>
        body{font:12px/1.4 Arial,sans-serif;color:#111;margin:28px}h1{font-size:16px;margin:0}h2{font-size:13px;margin:2px 0 12px;font-weight:normal;color:#444}
        .cab{display:grid;grid-template-columns:repeat(4,1fr);gap:4px 16px;border:1px solid #bbb;padding:8px 10px;margin-bottom:12px}.cab b{display:block;font-size:10px;color:#666;text-transform:uppercase}
        table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left}th{background:#eee;font-size:11px}.n{text-align:right;white-space:nowrap}
        tr.g td{background:#f3f3f3;font-weight:bold}tr.s td{font-weight:bold}tfoot td{font-weight:bold;background:#eee}.firmas{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;margin-top:60px;text-align:center}.firmas div{border-top:1px solid #333;padding-top:4px}
        @media print{body{margin:10mm}}</style>
        <h1>Partida contable ${String(p.mes).padStart(2, '0')}-${p.numero}${modoImp === 'centros' ? ' · integrada por centro de costo' : ''}${p.estado === 'ANULADA' ? ' · ANULADA' : ''}</h1>
        <h2>Póliza anual ${p.numero_anual} · ${MESES[p.mes - 1]} ${p.anio} · ${esc(org?.nombre || '')} · ${esc(loc ? `${loc.codigo} ${loc.nombre_comercial}` : '')}</h2>
        <div class="cab"><div><b>Período</b>${MESES[p.mes - 1]} ${p.anio}</div><div><b>Fecha</b>${esc(fechaHora(p.fecha))}</div><div><b>Tipo</b>${esc(tp ? `${tp.siglas} · ${tp.nombre}` : '')}</div><div><b>Moneda</b>${esc(mon ? mon.nombre : '')} · TC ${esc(String(p.tipo_cambio))}</div>
          <div style="grid-column:1/-1"><b>Descripción</b>${esc(p.descripcion)}</div>${p.justificacion ? `<div style="grid-column:1/-1"><b>Justificación</b>${esc(p.justificacion)}</div>` : ''}</div>
        <table><thead><tr><th>#</th><th>Cuenta</th><th>Nombre</th><th>Concepto</th><th class="n">Debe</th><th class="n">Haber</th>${modoImp === 'general' ? '<th>Centro de costo</th>' : ''}</tr></thead><tbody>${cuerpo}</tbody>
        <tfoot><tr><td colspan="4">Totales</td><td class="n">${monto(p.total_debe)}</td><td class="n">${monto(p.total_haber)}</td>${modoImp === 'general' ? '<td></td>' : ''}</tr></tfoot></table>
        <div class="firmas"><div>Elaboró: ${esc(p.usuario || '')}</div><div>Revisó</div><div>Aprobó: ${esc(p.aprobada_por || '')}</div></div>
        `, { locId: p.localidad_id, orgId: p.organizacion_id });
    }

    // Excel de la partida, con el encabezado de las consultas: póliza general o integrada por centro de costo.
    function excelPartida(modoImp) {
      const p = actual;
      if (!p) return;
      const tp = tipo(p.tipo_partida_id);
      const mon = moneda(p.moneda_id);
      const filas = lineas.map((l, i) => ({ ...l, n: i + 1, cuenta: cuentas.find((c) => c.id === l.cuenta_id), centro: centros.find((c) => c.id === l.centro_id) }));
      const fila = (l) => ({ valores: [l.n, l.cuenta?.codigo || '', l.cuenta?.nombre || '', l.concepto || '', l.centro ? `${l.centro.codigo} ${l.centro.nombre}` : '', Number(l.debe) || null, Number(l.haber) || null] });
      let datos = [];
      if (modoImp === 'centros') {
        const grupos = {};
        filas.forEach((l) => { const k = l.centro ? `${l.centro.codigo} · ${l.centro.nombre}` : 'Sin centro de costo'; (grupos[k] = grupos[k] || []).push(l); });
        Object.entries(grupos).forEach(([k, ls]) => {
          datos.push({ tipo: 'grupo', valores: [k] });
          datos.push(...ls.map(fila));
          datos.push({ tipo: 'subtotal', valores: ['', '', 'Subtotal', '', '', ls.reduce((t, l) => t + Number(l.debe || 0), 0), ls.reduce((t, l) => t + Number(l.haber || 0), 0)] });
        });
      } else datos = filas.map(fila);
      datos.push({ tipo: 'total', valores: ['', '', 'Totales', '', '', Number(p.total_debe || 0), Number(p.total_haber || 0)] });
      datos.push({ tipo: 'nota', valores: [''] });
      datos.push({ tipo: 'nota', valores: ['', 'Descripción', p.descripcion || ''] });
      if (p.justificacion) datos.push({ tipo: 'nota', valores: ['', 'Justificación', p.justificacion] });
      datos.push({ tipo: 'nota', valores: ['', 'Elaboró', p.usuario || '', 'Aprobó', p.aprobada_por || ''] });
      const num = `${String(p.mes).padStart(2, '0')}-${p.numero}`;
      window.REPORTE_XLSX.generar({
        titulo: `Partida contable ${num}${modoImp === 'centros' ? ' · por centro de costo' : ''}${p.estado === 'ANULADA' ? ' · ANULADA' : ''}`,
        parametros: [`Póliza anual ${p.numero_anual}`, `Período: ${MESES[p.mes - 1]} ${p.anio}`, `Fecha: ${fechaHora(p.fecha)}`, `Tipo: ${tp ? `${tp.siglas} · ${tp.nombre}` : '—'}`,
          `Moneda: ${mon ? mon.nombre : '—'} · TC ${p.tipo_cambio}`, `Estado: ${p.estado}${p.definitiva ? ' · definitiva' : ''}`],
        orgId: p.organizacion_id, locId: p.localidad_id, hoja: `Partida ${num}`, archivo: `partida_${p.anio}_${num}_${modoImp}`,
        columnas: [{ titulo: '#', ancho: 6 }, { titulo: 'Cuenta', ancho: 14 }, { titulo: 'Nombre de la cuenta', ancho: 38 }, { titulo: 'Concepto', ancho: 38 }, { titulo: 'Centro de costo', ancho: 26 }, { titulo: 'Debe', ancho: 15, tipo: 'monto' }, { titulo: 'Haber', ancho: 15, tipo: 'monto' }],
        filas: datos
      });
    }

    // ---------- Eventos ----------
    function activarPestana(id) {
      pDet.querySelectorAll('[data-pestana]').forEach((x) => { x.classList.toggle('activa', x.dataset.pestana === id); x.setAttribute('aria-selected', x.dataset.pestana === id); });
      pDet.querySelectorAll('[data-panel]').forEach((x) => { x.hidden = x.dataset.panel !== id; });
    }

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
        if (n === 'loc') { f.loc = val ? Number(val) : null; f.org = localidad(f.loc)?.organizacion_id ?? f.org; }
        else if (n === 'estado') f.estado = val;
        else f[n] = Number(val);
        actual = null;
        return consultar();
      }
      if (e.target.name === 'impresion') {
        modoImpresion = e.target.value;
        pDet.querySelectorAll('[name=impresion]').forEach((x) => { if (x.type === 'radio') x.checked = x.value === modoImpresion; else x.value = modoImpresion; });
        return;
      }
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
      const li = e.target.closest('li[data-partida]');
      if (li && e.target === li && e.key === 'Enter') abrir(partidas.find((p) => String(p.id) === li.dataset.partida));
      if (li && e.target === li && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        (e.key === 'ArrowDown' ? li.nextElementSibling : li.previousElementSibling)?.focus();
      }
    });
    function agregarLinea() {
      const tbody = pDet.querySelector('.pc-lineas tbody');
      lineas.push(nuevaLinea());
      tbody.insertAdjacentHTML('beforeend', filaLinea(lineas[lineas.length - 1], lineas.length - 1, true));
      const ult = tbody.lastElementChild;
      ult.scrollIntoView({ block: 'nearest' });
      ult.querySelector('[data-campo=cuenta]').focus();
      totalizar();
    }
    cont.addEventListener('click', async (e) => {
      const li = e.target.closest('li[data-partida]');
      if (li) return abrir(partidas.find((p) => String(p.id) === li.dataset.partida));
      const tab = e.target.closest('[data-pestana]');
      if (tab) { pestana = tab.dataset.pestana; return activarPestana(pestana); }
      const ac = e.target.closest('[data-accion]');
      if (ac) {
        const a = ac.dataset.accion;
        if (a === 'nueva') { pestana = 'detalle'; await abrir(null); return pDet.querySelector('[name=descripcion]')?.focus(); }
        if (a === 'obtener') return obtenerPoliza();
        if (a === 'linea') { if (pestana !== 'detalle') { pestana = 'detalle'; activarPestana(pestana); } return agregarLinea(); }
        if (a === 'modificar') {
          if (!puedeModificar(actual)) return;
          modo = 'editar';
          await pintarDetalle();
          return pDet.querySelector('[name=descripcion]')?.focus();
        }
        if (a === 'cancelar') return abrir(actual);
        if (a === 'eliminar') return cambiarEstado('ELIMINAR');
        if (a === 'copiar') {
          const form = pDet.querySelector('.pq-form');
          const base = { ...encabezado(form) };
          const ls = lineas.map((l) => ({ ...l }));
          await abrir(null, base);
          lineas = ls;
          await pintarDetalle();
          return window.FIN.aviso(`Copia lista para ${nombreMes()}: revisa y presiona «Registrar partida»`);
        }
        return cambiarEstado({ anular: 'ANULAR', aprobar: 'APROBAR', desaprobar: 'DESAPROBAR', definitiva: 'DEFINITIVA' }[a]);
      }
      const im = e.target.closest('[data-imprimir]');
      if (im) return imprimir(modoImpresion);
      if (e.target.closest('[data-excel-partida]')) return excelPartida(modoImpresion);
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
      if (!e.target.matches('.pq-form')) return;
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
