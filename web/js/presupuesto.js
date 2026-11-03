// Contabilidad · Registros · Presupuesto (maestro - detalle), con el diseño de Partidas contables:
//   Arriba, los parámetros: organización y localidad (cada presupuesto pertenece a una), año,
//   tipo de presupuesto y estado.
//   Maestro: los presupuestos de esa empresa y año.
//   Detalle: encabezado (número, fecha, tipo, frecuencia, período con sus fechas, estado,
//   descripción; elaboró y aprobó automáticos) y los rubros con lo presupuestado y lo ejecutado
//   del período, la variación y el porcentaje de ejecución, por grupo y con totales.
(function () {
  const { esc } = window.UI;

  const TIPOS = ['PRESUPUESTO MAESTRO', 'PRESUPUESTO DE INGRESOS', 'PRESUPUESTO DE GASTOS DE OPERACIÓN', 'PRESUPUESTO DE PERSONAL (PLANILLA)',
    'PRESUPUESTO DE INVERSIÓN (CAPITAL)', 'PRESUPUESTO DE CAJA (FLUJO DE EFECTIVO)', 'PRESUPUESTO FINANCIERO', 'PRESUPUESTO DE CARTERA DE CRÉDITOS',
    'PRESUPUESTO DE CAPTACIONES', 'PRESUPUESTO DE COMPRAS', 'PRESUPUESTO DE VENTAS'];
  const FRECUENCIAS = [
    { valor: 'SEMANAL', texto: 'Semanal', periodos: 53, nombre: (p) => `Semana ${p}` },
    { valor: 'MENSUAL', texto: 'Mensual', periodos: 12, nombre: (p) => ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][p - 1] },
    { valor: 'TRIMESTRAL', texto: 'Trimestral', periodos: 4, nombre: (p) => `${['Primer', 'Segundo', 'Tercer', 'Cuarto'][p - 1]} trimestre` },
    { valor: 'SEMESTRAL', texto: 'Semestral', periodos: 2, nombre: (p) => `${p === 1 ? 'Primer' : 'Segundo'} semestre` },
    { valor: 'ANUAL', texto: 'Anual', periodos: 1, nombre: () => 'Año completo' }
  ];
  const ESTADOS = [
    { valor: 'FORMULACIÓN', clase: 'formulacion', ayuda: 'Se elabora el presupuesto' },
    { valor: 'EN REVISIÓN', clase: 'revision', ayuda: 'Lo revisa la gerencia o el comité' },
    { valor: 'APROBADO', clase: 'aprobado', ayuda: 'Aprobado por la junta directiva o la gerencia' },
    { valor: 'EN EJECUCIÓN', clase: 'ejecucion', ayuda: 'Se registra lo ejecutado del período' },
    { valor: 'MODIFICADO', clase: 'modificado', ayuda: 'Se reformuló durante su ejecución' },
    { valor: 'CERRADO', clase: 'cerrado', ayuda: 'Período liquidado: ya no se modifica' },
    { valor: 'ANULADO', clase: 'anulado', ayuda: 'Sin efecto: ya no se modifica' }
  ];
  const GRUPOS = ['INGRESOS', 'GASTOS DE PERSONAL', 'GASTOS FINANCIEROS', 'GASTOS ADMINISTRATIVOS', 'IMPUESTOS', 'INVERSIONES'];
  const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
  const fechaDia = (d) => d ? d.split('-').reverse().join('/') : '';
  const fechaCorta = (f) => f ? new Date(f).toLocaleString('es-GT', { timeZone: 'America/Guatemala', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '';
  const monto = (n) => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (e, p) => Number(p) > 0 ? Math.round((Number(e) / Number(p)) * 1000) / 10 : 0;
  const frecuencia = (v) => FRECUENCIAS.find((x) => x.valor === v) || FRECUENCIAS[1];
  const estado = (v) => ESTADOS.find((x) => x.valor === v) || ESTADOS[0];
  const marcaEstado = (v) => `<span class="pp-estado ${estado(v).clase}" title="${esc(estado(v).ayuda)}">${esc(v)}</span>`;

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['presupuesto'] = function (cont) {
    const sb = window.FIN.sb;
    const yo = window.FIN.perfil();
    const admin = window.FIN.puedeEditarCatalogos();
    const superAdmin = window.FIN.esSuperAdmin();
    let organizaciones = [];
    let localidades = [];
    let rubros = [];
    let presupuestos = [];
    let actual = null;
    let lineas = [];        // { rubro_id, presupuestado, ejecutado, observaciones }
    let buscar = '';
    const [anioHoy, mesHoy] = hoy().split('-').map(Number);
    const f = { org: yo.organizacion_id || null, loc: yo.localidad_id || null, anio: anioHoy, tipo: '', estado: '' };

    cont.innerHTML = `
      <div class="ta-espacio ta-apilado pp-espacio">
        <section class="ta-filtros pp-filtros" id="pp-filtros"></section>
        <div class="ta-cuerpo">
          <section class="tk-bandeja ta-maestro" id="pp-maestro"></section>
          <section class="tk-detalle ta-detalle" id="pp-detalle"></section>
        </div>
      </div>`;
    const espacio = cont.querySelector('.ta-espacio');
    const pFil = cont.querySelector('#pp-filtros');
    const pMae = cont.querySelector('#pp-maestro');
    const pDet = cont.querySelector('#pp-detalle');

    const localidad = (id) => localidades.find((l) => l.id === id);
    const rubro = (id) => rubros.find((r) => r.id === id);
    const editable = () => admin && (!actual || !['CERRADO', 'ANULADO'].includes(actual.estado));

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
      const [o, l, r, prueba] = await Promise.all([
        sb.from('organizaciones').select('id, codigo, nombre').eq('activo', true).order('codigo'),
        sb.from('localidades').select('id, codigo, correlativo, nombre_comercial, organizacion_id').eq('activo', true).order('organizacion_id').order('correlativo'),
        sb.from('rubros_presupuesto').select('id, codigo, nombre, grupo, naturaleza, activo').order('codigo'),
        sb.from('presupuestos').select('id').limit(1)
      ]);
      const err = prueba.error || r.error;
      if (err) {
        espacio.innerHTML = `<section class="panel"><p class="vacio">${/presupuesto|rubros/.test(err.message) ? 'Falta instalar el script 40 (presupuestos) en Supabase.' : esc(err.message)}</p></section>`;
        return;
      }
      organizaciones = o.data || [];
      localidades = l.data || [];
      rubros = r.data || [];
      if (!f.org) f.org = organizaciones[0]?.id || null;
      if (!localidades.some((x) => x.id === f.loc && x.organizacion_id === f.org)) f.loc = localidades.find((x) => x.organizacion_id === f.org)?.id || null;
      pintarFiltros();
      await consultar();
    }

    // ---------- Parámetros ----------
    function pintarFiltros() {
      const locs = localidades.filter((x) => x.organizacion_id === f.org);
      const anios = []; for (let a = anioHoy + 1; a >= anioHoy - 6; a--) anios.push(a);
      pFil.innerHTML = `
        <div class="ta-titulo"><span class="tk-icono"><i class="ti ti-chart-bar" aria-hidden="true"></i></span><div><small>Registros</small><h2>Presupuesto</h2></div></div>
        <label class="campo"><span>Organización</span><select name="org">${organizaciones.map((o) => `<option value="${o.id}" ${f.org === o.id ? 'selected' : ''}>${o.codigo} · ${esc(o.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Localidad</span><select name="loc">${locs.map((x) => `<option value="${x.id}" ${f.loc === x.id ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre_comercial)}</option>`).join('') || '<option value="">Sin localidades</option>'}</select></label>
        <label class="campo"><span>Año</span><select name="anio">${anios.map((a) => `<option ${f.anio === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <label class="campo"><span>Tipo de presupuesto</span><select name="tipo"><option value="">Todos</option>${TIPOS.map((t) => `<option ${f.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado"><option value="">Todos</option>${ESTADOS.map((e) => `<option ${f.estado === e.valor ? 'selected' : ''}>${e.valor}</option>`).join('')}</select></label>`;
    }

    async function consultar() {
      if (!f.loc) { presupuestos = []; pintarMaestro(); return abrir(null); }
      let q = sb.from('presupuestos').select('*').eq('organizacion_id', f.org).eq('localidad_id', f.loc).eq('anio', f.anio).order('numero', { ascending: false });
      if (f.tipo) q = q.eq('tipo', f.tipo);
      if (f.estado) q = q.eq('estado', f.estado);
      const { data, error } = await q;
      if (error) { pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      presupuestos = data;
      if (actual && !presupuestos.some((p) => p.id === actual.id)) actual = null;
      pintarMaestro();
      await abrir(actual ? presupuestos.find((p) => p.id === actual.id) : presupuestos[0] || null);
    }

    // ---------- Maestro ----------
    function pintarMaestro() {
      const q = buscar.trim().toLowerCase();
      const filas = presupuestos.filter((p) => !q || [p.numero, p.tipo, p.descripcion, p.estado, p.frecuencia].some((v) => String(v || '').toLowerCase().includes(q)));
      const tp = presupuestos.filter((p) => p.estado !== 'ANULADO');
      const sumP = tp.reduce((s, p) => s + Number(p.total_presupuestado), 0);
      const sumE = tp.reduce((s, p) => s + Number(p.total_ejecutado), 0);
      pMae.innerHTML = `
        <header class="tk-bandeja-cab tg-cab">
          <h2>Presupuestos <small>${esc(localidad(f.loc)?.codigo || '')} · ${f.anio} · ${presupuestos.length}</small></h2>
          <div class="ta-totales pc-resumen"><span class="ta-total"><b>${monto(sumP)}</b> presupuestado</span><span class="ta-total"><b>${monto(sumE)}</b> ejecutado</span><span class="ta-total sin"><b>${pct(sumE, sumP)}%</b> de ejecución</span></div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar presupuesto…" value="${esc(buscar)}" aria-label="Buscar presupuestos"></label>
          ${admin && f.loc ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo presupuesto</button>' : ''}
        </header>
        <div class="ta-tabla">
          <table>
            <thead><tr><th>No.</th><th>Fecha</th><th>Tipo de presupuesto</th><th>Frecuencia</th><th>Período</th><th>Estado</th><th class="num">Presupuestado</th><th class="num">Ejecutado</th><th>Ejecución</th><th>Elaboró</th><th><span class="oculto">Acciones</span></th></tr></thead>
            <tbody>
              ${filas.map((p) => {
                const fr = frecuencia(p.frecuencia);
                const e = pct(p.total_ejecutado, p.total_presupuestado);
                const abierto = admin && !['CERRADO', 'ANULADO'].includes(p.estado);
                return `
                <tr class="${actual && actual.id === p.id ? 'actual' : ''}" data-presupuesto="${p.id}" tabindex="0">
                  <td class="fuerte">${p.numero}</td>
                  <td>${esc(fechaDia(p.fecha))}</td>
                  <td>${esc(p.tipo.replace('PRESUPUESTO ', ''))}</td>
                  <td>${esc(fr.texto)}</td>
                  <td>${esc(fr.nombre(p.periodo))}</td>
                  <td>${marcaEstado(p.estado)}</td>
                  <td class="num">${monto(p.total_presupuestado)}</td>
                  <td class="num">${monto(p.total_ejecutado)}</td>
                  <td><span class="pp-barra ${e > 100 ? 'excedido' : ''}" title="${e}% ejecutado"><i style="width:${Math.min(100, e)}%"></i></span> <small>${e}%</small></td>
                  <td>${esc(p.elaborado_por || '')}</td>
                  <td class="tk-acciones">
                    <button type="button" class="tk-accion-btn" data-modificar="${p.id}"><i class="ti ${abierto ? 'ti-pencil' : 'ti-eye'}" aria-hidden="true"></i> ${abierto ? 'Modificar' : 'Ver'}</button>
                    <button type="button" class="tk-accion-btn peligro" data-eliminar="${p.id}" ${superAdmin && ['FORMULACIÓN', 'ANULADO'].includes(p.estado) ? '' : 'disabled'} title="${superAdmin ? 'Solo se eliminan presupuestos en formulación o anulados' : 'Solo el Super Administrador puede eliminar presupuestos'}"><i class="ti ti-trash" aria-hidden="true"></i> Eliminar</button>
                  </td>
                </tr>`;
              }).join('') || `<tr><td colspan="11" class="tk-vacio"><i class="ti ti-chart-bar" aria-hidden="true"></i>${presupuestos.length ? 'Ningún presupuesto coincide con la búsqueda.' : `No hay presupuestos de ${f.anio} para esta empresa.`}</td></tr>`}
            </tbody>
          </table>
        </div>`;
    }

    // ---------- Detalle ----------
    async function abrir(p) {
      actual = p;
      lineas = [];
      if (p) {
        const { data } = await sb.from('presupuesto_lineas').select('*').eq('presupuesto_id', p.id);
        lineas = (data || []).map((l) => ({ rubro_id: l.rubro_id, presupuestado: Number(l.presupuestado), ejecutado: Number(l.ejecutado), observaciones: l.observaciones || '' }));
        ordenarLineas();
      }
      pintarDetalle();
      pMae.querySelectorAll('tr[data-presupuesto]').forEach((tr) => tr.classList.toggle('actual', !!p && tr.dataset.presupuesto === String(p.id)));
    }
    const ordenarLineas = () => lineas.sort((a, b) => (rubro(a.rubro_id)?.codigo || 9999) - (rubro(b.rubro_id)?.codigo || 9999));

    function pintarDetalle(valores) {
      const p = actual;
      if (!f.loc) { pDet.innerHTML = '<div class="tk-vacio ta-elige"><i class="ti ti-building" aria-hidden="true"></i>Elige la organización y la localidad.</div>'; return; }
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const v = valores || (p
        ? { fecha: p.fecha, tipo: p.tipo, frecuencia: p.frecuencia, periodo: p.periodo, estado: p.estado, descripcion: p.descripcion || '' }
        : { fecha: hoy(), tipo: TIPOS[0], frecuencia: 'MENSUAL', periodo: mesHoy, estado: 'FORMULACIÓN', descripcion: '' });
      const fr = frecuencia(v.frecuencia);
      const loc = localidad(p ? p.localidad_id : f.loc);
      const usados = new Set(lineas.map((l) => l.rubro_id));
      const disponibles = rubros.filter((r) => r.activo && !usados.has(r.id));
      pDet.innerHTML = `
        <form class="tk-form ta-form pp-form" novalidate>
          <header class="tk-titulo">
            <span class="tk-icono"><i class="ti ti-chart-bar" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>${esc(loc ? `${loc.codigo} · ${loc.nombre_comercial}` : '')}</small><h2>${p ? `Presupuesto ${p.numero}` : 'Nuevo presupuesto'}</h2></div>
            <div class="tk-marcas">${marcaEstado(v.estado)}</div>
            <div class="tk-titulo-acciones">
              ${p ? '<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>' : ''}
              ${ed ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${p ? 'Guardar cambios' : 'Registrar presupuesto'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>

          <div class="pc-encabezado pp-encabezado">
            <div class="pc-periodo">
              <div><span>Número</span><b>${p ? p.numero : '—'}</b></div>
              <div><span>Año</span><b>${p ? p.anio : f.anio}</b></div>
              <div><span>Del</span><b data-del>${esc(fechaDia(p?.fecha_inicio)) || '—'}</b></div>
              <div><span>Al</span><b data-al>${esc(fechaDia(p?.fecha_fin)) || '—'}</b></div>
            </div>
            <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(v.fecha)}" ${dis}></label>
            <label class="campo pp-tipo"><span>Tipo de presupuesto *</span><select name="tipo" ${dis}>${TIPOS.map((t) => `<option ${v.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            <label class="campo"><span>Frecuencia</span><select name="frecuencia" ${dis}>${FRECUENCIAS.map((x) => `<option value="${x.valor}" ${v.frecuencia === x.valor ? 'selected' : ''}>${x.texto}</option>`).join('')}</select></label>
            <label class="campo"><span>Período</span><select name="periodo" ${dis}>${Array.from({ length: fr.periodos }, (_, i) => i + 1).map((n) => `<option value="${n}" ${Number(v.periodo) === n ? 'selected' : ''}>${esc(fr.nombre(n))}</option>`).join('')}</select></label>
            <label class="campo"><span>Estado</span><select name="estado" ${dis}>${ESTADOS.map((e) => `<option value="${e.valor}" ${v.estado === e.valor ? 'selected' : ''} title="${esc(e.ayuda)}">${e.valor}</option>`).join('')}</select></label>
          </div>
          <div class="pc-encabezado pp-fila2">
            <label class="campo pc-desc"><span>Descripción</span><input name="descripcion" value="${esc(v.descripcion)}" maxlength="200" placeholder="Objetivo o alcance del presupuesto" ${dis}></label>
            <div class="ta-auto pc-auto"><span>Elaboró</span><b>${esc(p ? p.elaborado_por || '' : (yo.usuario || '').toUpperCase())}</b><small>${p ? esc(fechaCorta(p.creado_en)) : 'Usuario actual'}</small></div>
            <div class="ta-auto pc-auto"><span>Aprobó</span><b>${esc(p?.aprobado_por || '—')}</b><small>${p?.aprobado_en ? esc(fechaCorta(p.aprobado_en)) : 'Al pasar a APROBADO'}</small></div>
          </div>

          <section class="pc-detalle">
            <div class="pc-detalle-cab">
              <h3 class="ta-col-titulo"><i class="ti ti-list-details" aria-hidden="true"></i> Rubros del presupuesto <small class="tk-tenue">${lineas.length} rubros</small></h3>
              ${ed ? `<span class="pp-agregar">
                <select data-nuevo-rubro aria-label="Rubro para agregar"><option value="">Agregar rubro…</option>${GRUPOS.map((g) => `<optgroup label="${g}">${disponibles.filter((r) => r.grupo === g).map((r) => `<option value="${r.id}">${r.codigo} · ${esc(r.nombre)}</option>`).join('')}</optgroup>`).join('')}</select>
                <button type="button" class="rp-enlace" data-accion="todos" ${disponibles.length ? '' : 'disabled'}><i class="ti ti-list-check" aria-hidden="true"></i> Agregar todos</button></span>` : ''}
            </div>
            <div class="pc-lineas pp-lineas">
              <table>
                <thead><tr><th>Código</th><th>Rubro</th><th class="num">Presupuestado</th><th class="num">Ejecutado</th><th class="num">Variación</th><th>Ejecución</th><th>Observaciones</th><th></th></tr></thead>
                <tbody>${cuerpoLineas(ed)}</tbody>
                <tfoot><tr><td colspan="2" class="pc-totales-lbl">Totales</td><td class="num" data-total="p"></td><td class="num" data-total="e"></td><td class="num" data-total="v"></td><td data-total="x"></td><td colspan="2"></td></tr></tfoot>
              </table>
            </div>
          </section>
        </form>`;
      totalizar();
    }

    // Líneas agrupadas por grupo de rubro, con subtotal por grupo.
    function cuerpoLineas(ed) {
      const dis = ed ? '' : 'disabled';
      if (!lineas.length) return `<tr><td colspan="8" class="tk-vacio"><i class="ti ti-list-details" aria-hidden="true"></i>Agrega los rubros del presupuesto${ed ? ' (uno por uno o «Agregar todos»)' : ''}.</td></tr>`;
      return GRUPOS.map((g) => {
        const ls = lineas.map((l, i) => ({ l, i })).filter(({ l }) => rubro(l.rubro_id)?.grupo === g);
        if (!ls.length) return '';
        return `<tr class="pp-grupo"><td colspan="2">${g}</td><td class="num" data-sub-p="${g}"></td><td class="num" data-sub-e="${g}"></td><td class="num" data-sub-v="${g}"></td><td colspan="3"></td></tr>
          ${ls.map(({ l, i }) => {
            const r = rubro(l.rubro_id);
            return `<tr data-linea="${i}">
              <td class="pc-n">${r?.codigo || ''}</td>
              <td class="pp-rubro">${esc(r?.nombre || '')}</td>
              <td class="num"><input type="number" step="0.01" min="0" data-campo="presupuestado" value="${l.presupuestado || ''}" ${dis} aria-label="Presupuestado de ${esc(r?.nombre || '')}"></td>
              <td class="num"><input type="number" step="0.01" min="0" data-campo="ejecutado" value="${l.ejecutado || ''}" ${dis} aria-label="Ejecutado de ${esc(r?.nombre || '')}"></td>
              <td class="num" data-variacion></td>
              <td data-ejecucion></td>
              <td><input data-campo="observaciones" value="${esc(l.observaciones)}" maxlength="200" ${dis} aria-label="Observaciones de ${esc(r?.nombre || '')}"></td>
              <td>${ed ? `<button type="button" class="icono-boton" data-quitar="${i}" aria-label="Quitar ${esc(r?.nombre || '')}"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td>
            </tr>`;
          }).join('')}`;
      }).join('');
    }

    const barra = (e, p) => { const x = pct(e, p); return `<span class="pp-barra ${x > 100 ? 'excedido' : ''}"><i style="width:${Math.min(100, x)}%"></i></span> <small>${x}%</small>`; };
    function totalizar() {
      if (!pDet.querySelector('[data-total=p]')) return;
      pDet.querySelectorAll('tr[data-linea]').forEach((tr) => {
        const l = lineas[Number(tr.dataset.linea)];
        const vr = l.presupuestado - l.ejecutado;
        tr.querySelector('[data-variacion]').innerHTML = `<span class="${vr < 0 ? 'pc-rojo' : ''}">${monto(vr)}</span>`;
        tr.querySelector('[data-ejecucion]').innerHTML = barra(l.ejecutado, l.presupuestado);
      });
      GRUPOS.forEach((g) => {
        const ls = lineas.filter((l) => rubro(l.rubro_id)?.grupo === g);
        const c = pDet.querySelector(`[data-sub-p="${g}"]`);
        if (!c) return;
        const sp = ls.reduce((s, l) => s + l.presupuestado, 0);
        const se = ls.reduce((s, l) => s + l.ejecutado, 0);
        c.textContent = monto(sp);
        pDet.querySelector(`[data-sub-e="${g}"]`).textContent = monto(se);
        pDet.querySelector(`[data-sub-v="${g}"]`).textContent = monto(sp - se);
      });
      const tp = lineas.reduce((s, l) => s + l.presupuestado, 0);
      const te = lineas.reduce((s, l) => s + l.ejecutado, 0);
      pDet.querySelector('[data-total=p]').textContent = monto(tp);
      pDet.querySelector('[data-total=e]').textContent = monto(te);
      pDet.querySelector('[data-total=v]').innerHTML = `<span class="${tp - te < 0 ? 'pc-rojo' : ''}">${monto(tp - te)}</span>`;
      pDet.querySelector('[data-total=x]').innerHTML = barra(te, tp);
    }

    const leerEncabezado = (form) => ({
      fecha: form.elements.fecha.value || hoy(), tipo: form.elements.tipo.value, frecuencia: form.elements.frecuencia.value,
      periodo: Number(form.elements.periodo.value) || 1, estado: form.elements.estado.value, descripcion: form.elements.descripcion.value
    });
    function leerLineas() {
      pDet.querySelectorAll('tr[data-linea]').forEach((tr) => {
        const l = lineas[Number(tr.dataset.linea)];
        l.presupuestado = Math.round((Number(tr.querySelector('[data-campo=presupuestado]').value) || 0) * 100) / 100;
        l.ejecutado = Math.round((Number(tr.querySelector('[data-campo=ejecutado]').value) || 0) * 100) / 100;
        l.observaciones = tr.querySelector('[data-campo=observaciones]').value;
      });
    }
    function repintar() {
      const form = pDet.querySelector('.pp-form');
      leerLineas();
      const v = leerEncabezado(form);
      pintarDetalle(v);
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      leerLineas();
      const d = leerEncabezado(form);
      if (!lineas.length) { error.textContent = 'Agrega al menos un rubro al presupuesto.'; return; }
      error.textContent = '';
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      try {
        let id = actual?.id;
        if (!actual) {
          const r = await sb.from('presupuestos').insert({ ...d, organizacion_id: f.org, localidad_id: f.loc, anio: f.anio }).select('id').single();
          if (r.error) throw r.error;
          id = r.data.id;
        } else {
          const del = await sb.from('presupuesto_lineas').delete().eq('presupuesto_id', id);
          if (del.error) throw del.error;
        }
        // Primero las líneas y después el encabezado: si el estado pasa a CERRADO o ANULADO, ya no se pueden cambiar.
        const ins = await sb.from('presupuesto_lineas').insert(lineas.map((l) => ({ presupuesto_id: id, rubro_id: l.rubro_id, presupuestado: l.presupuestado, ejecutado: l.ejecutado, observaciones: l.observaciones })));
        if (ins.error) throw ins.error;
        if (actual) {
          const r = await sb.from('presupuestos').update(d).eq('id', id);
          if (r.error) throw r.error;
        }
        window.FIN.aviso(actual ? 'Presupuesto guardado' : 'Presupuesto registrado');
        actual = { id };
        await consultar();
      } catch (err) {
        error.textContent = window.UI.traducirError(err);
      } finally {
        boton.disabled = false;
      }
    }

    function imprimir() {
      const p = actual;
      const org = organizaciones.find((o) => o.id === p.organizacion_id);
      const loc = localidad(p.localidad_id);
      const fr = frecuencia(p.frecuencia);
      const cuerpo = GRUPOS.map((g) => {
        const ls = lineas.filter((l) => rubro(l.rubro_id)?.grupo === g);
        if (!ls.length) return '';
        const sp = ls.reduce((s, l) => s + l.presupuestado, 0); const se = ls.reduce((s, l) => s + l.ejecutado, 0);
        return `<tr class="g"><td colspan="6">${g}</td></tr>${ls.map((l) => { const r = rubro(l.rubro_id); return `<tr><td>${r?.codigo || ''}</td><td>${esc(r?.nombre || '')}</td><td class="n">${monto(l.presupuestado)}</td><td class="n">${monto(l.ejecutado)}</td><td class="n">${monto(l.presupuestado - l.ejecutado)}</td><td class="n">${pct(l.ejecutado, l.presupuestado)}%</td></tr>`; }).join('')}
          <tr class="s"><td colspan="2">Subtotal ${g.toLowerCase()}</td><td class="n">${monto(sp)}</td><td class="n">${monto(se)}</td><td class="n">${monto(sp - se)}</td><td class="n">${pct(se, sp)}%</td></tr>`;
      }).join('');
      const v = window.open('', '_blank');
      if (!v) return window.FIN.aviso('Permite las ventanas emergentes para imprimir');
      v.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Presupuesto ${p.numero}</title><style>
        body{font:12px/1.4 Arial,sans-serif;color:#111;margin:28px}h1{font-size:16px;margin:0}h2{font-size:13px;margin:2px 0 12px;font-weight:normal;color:#444}
        .cab{display:grid;grid-template-columns:repeat(4,1fr);gap:4px 16px;border:1px solid #bbb;padding:8px 10px;margin-bottom:12px}.cab b{display:block;font-size:10px;color:#666;text-transform:uppercase}
        table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left}th{background:#eee;font-size:11px}.n{text-align:right;white-space:nowrap}
        tr.g td{background:#f3f3f3;font-weight:bold}tr.s td{font-weight:bold}tfoot td{font-weight:bold;background:#eee}.firmas{display:grid;grid-template-columns:repeat(2,1fr);gap:60px;margin-top:60px;text-align:center}.firmas div{border-top:1px solid #333;padding-top:4px}
        @media print{body{margin:10mm}}</style></head><body>
        <h1>${esc(org?.nombre || '')} · ${esc(loc ? `${loc.codigo} ${loc.nombre_comercial}` : '')}</h1>
        <h2>Presupuesto ${p.numero} · ${esc(p.tipo)} · ${esc(p.estado)}</h2>
        <div class="cab"><div><b>Fecha</b>${esc(fechaDia(p.fecha))}</div><div><b>Frecuencia</b>${esc(fr.texto)}</div><div><b>Período</b>${esc(fr.nombre(p.periodo))} ${p.anio}</div><div><b>Del / al</b>${esc(fechaDia(p.fecha_inicio))} – ${esc(fechaDia(p.fecha_fin))}</div>${p.descripcion ? `<div style="grid-column:1/-1"><b>Descripción</b>${esc(p.descripcion)}</div>` : ''}</div>
        <table><thead><tr><th>Código</th><th>Rubro</th><th class="n">Presupuestado</th><th class="n">Ejecutado</th><th class="n">Variación</th><th class="n">Ejecución</th></tr></thead><tbody>${cuerpo}</tbody>
        <tfoot><tr><td colspan="2">Totales</td><td class="n">${monto(p.total_presupuestado)}</td><td class="n">${monto(p.total_ejecutado)}</td><td class="n">${monto(p.total_presupuestado - p.total_ejecutado)}</td><td class="n">${pct(p.total_ejecutado, p.total_presupuestado)}%</td></tr></tfoot></table>
        <div class="firmas"><div>Elaboró: ${esc(p.elaborado_por || '')}</div><div>Aprobó: ${esc(p.aprobado_por || '')}</div></div>
        <script>window.onload=()=>window.print()<\/script></body></html>`);
      v.document.close();
    }

    // ---------- Eventos ----------
    cont.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar]')) {
        buscar = e.target.value;
        const pos = e.target.selectionStart;
        pintarMaestro();
        const b = pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
        return;
      }
      if (e.target.closest('tr[data-linea]')) { leerLineas(); totalizar(); }
    });
    cont.addEventListener('change', (e) => {
      if (e.target.closest('#pp-filtros')) {
        const n = e.target.name;
        if (n === 'org') { f.org = Number(e.target.value); f.loc = localidades.find((x) => x.organizacion_id === f.org)?.id || null; pintarFiltros(); }
        else if (n === 'loc') f.loc = e.target.value ? Number(e.target.value) : null;
        else if (n === 'anio') f.anio = Number(e.target.value);
        else f[n] = e.target.value;
        actual = null;
        return consultar();
      }
      if (e.target.name === 'frecuencia') {
        // Al cambiar la frecuencia, el período se ajusta al rango de la nueva.
        const form = e.target.form;
        const v = leerEncabezado(form);
        const fr = frecuencia(v.frecuencia);
        v.periodo = v.frecuencia === 'MENSUAL' ? mesHoy : v.frecuencia === 'TRIMESTRAL' ? Math.ceil(mesHoy / 3) : v.frecuencia === 'SEMESTRAL' ? (mesHoy > 6 ? 2 : 1) : Math.min(fr.periodos, Number(v.periodo) || 1);
        leerLineas();
        return pintarDetalle(v);
      }
      if (e.target.name === 'estado') {
        pDet.querySelector('.tk-marcas').innerHTML = marcaEstado(e.target.value);
      }
      if (e.target.matches('[data-nuevo-rubro]') && e.target.value) {
        leerLineas();
        lineas.push({ rubro_id: Number(e.target.value), presupuestado: 0, ejecutado: 0, observaciones: '' });
        ordenarLineas();
        repintar();
        return pDet.querySelector(`tr[data-linea="${lineas.findIndex((l) => l.rubro_id === Number(e.target.value))}"] [data-campo=presupuestado]`)?.focus();
      }
    });
    cont.addEventListener('click', async (e) => {
      const bm = e.target.closest('[data-modificar]');
      if (bm) { await abrir(presupuestos.find((p) => String(p.id) === bm.dataset.modificar)); return pDet.querySelector('[data-campo=presupuestado]')?.focus(); }
      const be = e.target.closest('[data-eliminar]');
      if (be) {
        const p = presupuestos.find((x) => String(x.id) === be.dataset.eliminar);
        if (!confirm(`¿Eliminar el presupuesto ${p.numero} con todos sus rubros? No se puede deshacer.`)) return;
        const { error } = await sb.from('presupuestos').delete().eq('id', p.id);
        if (error) return window.FIN.aviso(window.UI.traducirError(error));
        window.FIN.aviso('Presupuesto eliminado');
        if (actual && actual.id === p.id) actual = null;
        return consultar();
      }
      const fila = e.target.closest('tr[data-presupuesto]');
      if (fila) return abrir(presupuestos.find((p) => String(p.id) === fila.dataset.presupuesto));
      const ac = e.target.closest('[data-accion]');
      if (ac) {
        if (ac.dataset.accion === 'nuevo') return abrir(null);
        if (ac.dataset.accion === 'imprimir') return imprimir();
        if (ac.dataset.accion === 'todos') {
          leerLineas();
          const usados = new Set(lineas.map((l) => l.rubro_id));
          rubros.filter((r) => r.activo && !usados.has(r.id)).forEach((r) => lineas.push({ rubro_id: r.id, presupuestado: 0, ejecutado: 0, observaciones: '' }));
          ordenarLineas();
          return repintar();
        }
      }
      const q = e.target.closest('[data-quitar]');
      if (q) { leerLineas(); lineas.splice(Number(q.dataset.quitar), 1); return repintar(); }
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.pp-form')) { e.preventDefault(); guardar(e.target); } });

    iniciar();
  };
})();
