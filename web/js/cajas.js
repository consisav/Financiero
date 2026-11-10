// Caja y Bancos · Cajas · Cajas chicas: dos vistas en la misma pantalla.
//   Selección de caja a operar: las cajas de la localidad (número, nombre, responsable, centro de
//   costo y alterno, tipo de caja, modalidad normal o liquidación, fondo y subcaja actual) y, abajo,
//   la definición de la caja elegida con sus cuentas contables. «Ir a detalle» abre la caja.
//   Administración de la caja: crear subcaja (año, mes, cuenta y cheque del anticipo) y cambiar su
//   mes; las subcajas de la caja; la subcaja elegida (valor, tasa, póliza y estado); el anticipo,
//   el adelanto y la liquidación (cuenta bancaria, cheque, nota y valor); los reportes; los
//   documentos liquidados (facturas y recibos) con su desglose fiscal (IVA, IDP, INGUAT, timbre,
//   exentos, no deducibles y retención) y su cuenta de gasto; el detalle contable (se reconstruye
//   con los documentos marcados) y la liquidación con su póliza.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const TIPOS_CAJA = ['CAJA CHICA', 'CORTE CAJA', 'FONDO ROTATIVO', 'LIQUIDACIÓN DE GASTOS'];
  const TIPOS_DOC = [['FACTURA ELECTRÓNICA', 'FEL'], ['FACTURA ESPECIAL', 'FESP'], ['FACTURA PEQUEÑO CONTRIBUYENTE', 'FPC'], ['RECIBO', 'REC'], ['OTRO', 'OTRO']];
  const SIN_IVA = ['FACTURA PEQUEÑO CONTRIBUYENTE', 'RECIBO', 'OTRO'];
  const CLASIFICACIONES = ['BIENES', 'SERVICIOS', 'COMBUSTIBLE', 'IMPORTACIÓN', 'OTROS'];
  const FONDOS = [['anticipo', 'Anticipo'], ['adelanto', 'Adelanto'], ['liquidacion', 'Liquidación']];
  const REPORTES = [['TODOS', 'Todos los documentos'], ['CONTABLE', 'Con detalle contable'], ['SIN', 'Sin detalle contable']];
  const leerSesion = (k) => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } };
  const guardarSesion = (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['cajas-chicas'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Selección de caja a operar', icono: 'ti-cash-register', clase: 'bk-cajas', grupo: 'Cajas' });
    const { sb, yo } = ctx;
    const f = { estado: 'ACTIVAS' };
    let vista = 'CAJAS';
    let cajas = [];
    let ultimo = new Map();      // subcaja más reciente de cada caja
    let cuentas = [];
    let contables = [];
    let centros = [];
    let params = {};
    let caja = null;
    let periodos = [];
    let periodo = null;
    let documentos = [];
    let doc = null;
    let lineas = [];
    let verContable = false;
    let tipoReporte = 'TODOS';
    let pestanaDet = 'DOCUMENTOS';   // Documentos o Liquidación
    let formatoRep = 'PDF';           // PDF o Excel
    let buscar = '';
    let paginaSub = 0;            // página de la lista de subcajas (5 por página)
    let paginaFijada = false;     // true cuando el usuario cambió de página
    // Síntesis: detalle contable de cada subcaja (función caja_resumen_contable, script 186) y resumen de cada caja.
    let contablePer = new Map();  // periodo_id → { lineas, debe, haber }
    let resumenCaja = new Map();  // caja_id → { subcajas, conDocs, conLineas, sinInfo, lineas, documentos }
    let soloInfo = false;         // lista de subcajas: solo las que tienen documentos o detalle contable
    const conInfo = (x) => Number(x.documentos || 0) > 0 || Number(contablePer.get(x.id)?.lineas || 0) > 0;

    const contable = (id) => contables.find((x) => x.id === id);
    const centro = (id) => centros.find((x) => x.id === id);
    const porCodigo = (cod) => { const c = String(cod || '').trim(); return contables.find((x) => x.codigo === c && x.movimiento && !x.anterior) || contables.find((x) => x.codigo === c && x.anterior); };
    // Las cajas, documentos y asientos migrados usan cuentas de una versión anterior del catálogo: se cargan para mostrarlas.
    async function asegurarCuentas(ids) {
      const faltan = [...new Set(ids.filter((x) => x && !contables.some((k) => k.id === x)))];
      for (let i = 0; i < faltan.length; i += 150) {
        const { data } = await sb.from('cuentas').select('id, codigo, nombre, cuenta_mayor_id, vigente').in('id', faltan.slice(i, i + 150));
        (data || []).forEach((c) => contables.push({ ...c, movimiento: true, anterior: true }));
      }
    }
    const centroPorCodigo = (cod) => centros.find((x) => x.codigo === String(cod || '').trim() && x.movimiento);
    const simbolo = (id) => ctx.moneda(id)?.simbolo || 'Q';
    const mesTxt = (p) => p ? `${MESES[p.mes - 1]} ${p.anio}` : '';
    const docTxt = (d) => `${d.serie ? `${d.serie}-` : ''}${d.documento}`;
    const abierta = () => !!periodo && periodo.estado === 'ABIERTA';
    const puede = () => ctx.admin && abierta();
    const liquidado = () => fmt.redondear(documentos.reduce((t, d) => t + Number(d.total), 0));
    const sinPartida = () => '<span class="tk-tenue">—</span>';

    // ===================== Vista 1 · Selección de caja a operar =====================
    function pintarFiltros() {
      ctx.titulo = 'Selección de caja a operar';
      ctx.filtros(`<label class="campo"><span>Cajas</span><select name="estado">${[['ACTIVAS', 'Activas'], ['TODAS', 'Todas']].map(([k, t]) => `<option value="${k}" ${f.estado === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`,
        `<div class="bmc-reportes"><button type="button" class="boton secundario-sm bca-pdf" data-accion="cajas-pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i><span><b>Imprimir en PDF</b><small>Cajas y subcajas</small></span></button>
         <button type="button" class="boton cqc-excel" data-accion="cajas-excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i><span><b>Generar Excel</b><small>Cajas y subcajas</small></span></button>
         ${ctx.admin ? '<button type="button" class="boton secundario-sm" data-accion="nueva-caja" title="Se crea en Cajas · Definición de Cajas"><i class="ti ti-plus" aria-hidden="true"></i> Nueva caja</button>' : ''}
         <button type="button" class="boton primario-sm cc-ir" data-accion="ir-detalle" ${caja ? '' : 'disabled'}>Ir a detalle <i class="ti ti-arrow-right" aria-hidden="true"></i></button></div>`);
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('cajas_chicas').select('id').limit(1);
      if (prueba.error) {
        ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/cajas_chicas/.test(prueba.error.message) ? 'Falta instalar el script 54 (cajas chicas) en Supabase.' : esc(prueba.error.message)}</p></section>`;
        return;
      }
      pintarFiltros();
      await cargarLocalidad();
    }

    async function cargarLocalidad() {
      caja = null;
      const loc = ctx.sel.loc;
      [cuentas, contables, centros] = await Promise.all([ctx.cuentasBancarias(), ctx.cuentasContables(), centrosLocalidad()]);
      const { data } = loc ? await sb.from('parametros_generales').select('impuesto1, idp_super, idp_regular, idp_diesel').eq('localidad_id', loc).order('id').limit(1) : { data: [] };
      params = data?.[0] || {};
      await consultarCajas();
    }
    async function centrosLocalidad() {
      if (!ctx.sel.loc) return [];
      const { data: k } = await sb.from('catalogos_centros').select('id').eq('localidad_id', ctx.sel.loc).eq('activo', true).order('version', { ascending: false }).limit(1);
      if (!k?.[0]) return [];
      const { data } = await sb.from('centros_costo').select('id, codigo, nombre, centro_mayor_id, vigente').eq('catalogo_id', k[0].id).order('codigo');
      const padres = new Set((data || []).map((c) => c.centro_mayor_id).filter(Boolean));
      return (data || []).map((c) => ({ ...c, movimiento: !padres.has(c.id) && c.vigente }));
    }

    async function consultarCajas() {
      if (!ctx.sel.loc) { cajas = []; pintarCajas(); return pintarCaja(); }
      let q = sb.from('cajas_chicas').select('*').eq('localidad_id', ctx.sel.loc).order('codigo');
      if (f.estado === 'ACTIVAS') q = q.eq('activa', true);
      const { data, error } = await q;
      if (error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      cajas = data || [];
      await asegurarCuentas(cajas.flatMap((c) => [c.cuenta_id, c.cuenta_caja_id, c.cuenta_iva_id, c.cuenta_retencion_id, c.cuenta_anticipo_id]));
      const ids = cajas.map((c) => c.id);
      const [{ data: ps }, cn] = ids.length ? await Promise.all([
        window.UI.todo(sb.from('caja_periodos_resumen').select('id, caja_id, numero, anio, mes, estado, liquidado, anticipo_valor, adelanto_valor, disponible, documentos').in('caja_id', ids).order('numero', { ascending: false })),
        sb.rpc('caja_resumen_contable', { p_cajas: ids })
      ]) : [{ data: [] }, { data: [] }];
      ultimo = new Map();
      (ps || []).forEach((p) => { if (!ultimo.has(p.caja_id)) ultimo.set(p.caja_id, p); });
      // Síntesis por caja: subcajas, cuántas tienen documentos o detalle contable, y sus líneas (sin el script 185, solo documentos).
      contablePer = new Map((cn.error ? [] : cn.data || []).map((x) => [x.id, x]));
      resumenCaja = new Map();
      (ps || []).forEach((p) => {
        const r = resumenCaja.get(p.caja_id) || { subcajas: 0, conDocs: 0, conLineas: 0, sinInfo: 0, lineas: 0, documentos: 0 };
        const l = Number(contablePer.get(p.id)?.lineas || 0), d = Number(p.documentos || 0);
        r.subcajas += 1; r.documentos += d; r.lineas += l;
        if (d) r.conDocs += 1;
        if (l) r.conLineas += 1;
        if (!d && !l) r.sinInfo += 1;
        resumenCaja.set(p.caja_id, r);
      });
      const guardada = Number(leerSesion('fin.caja'));
      caja = cajas.find((c) => c.id === (caja?.id || guardada)) || cajas[0] || null;
      pintarFiltros();
      pintarCajas();
      pintarCaja();
    }

    function pintarCajas() {
      const q = buscar.trim().toLowerCase();
      const filas = cajas.filter((c) => !q || [c.codigo, c.nombre, c.responsable, c.tipo_caja, contable(c.cuenta_id)?.codigo].some((v) => String(v || '').toLowerCase().includes(q)));
      const tot = [...resumenCaja.values()].reduce((a, r) => ({ subcajas: a.subcajas + r.subcajas, conDocs: a.conDocs + r.conDocs, conLineas: a.conLineas + r.conLineas, sinInfo: a.sinInfo + r.sinInfo, lineas: a.lineas + r.lineas }), { subcajas: 0, conDocs: 0, conLineas: 0, sinInfo: 0, lineas: 0 });
      const cajasConInfo = cajas.filter((c) => { const r = resumenCaja.get(c.id); return r && (r.conDocs || r.conLineas); }).length;
      const info = (c) => { const r = resumenCaja.get(c.id); if (!r) return '<span class="tk-tenue">Sin subcajas</span>';
        return `<b class="${r.conDocs || r.conLineas ? 'cs-con-info' : 'tk-tenue'}">${r.subcajas} subcaja${r.subcajas === 1 ? '' : 's'}</b><small>${[r.conDocs ? `${r.conDocs} con documentos` : '', r.conLineas ? `${r.conLineas} con contable (${r.lineas.toLocaleString('es-GT')} líneas)` : '', r.sinInfo ? `${r.sinInfo} vacías` : ''].filter(Boolean).join(' · ')}</small>`; };
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>Selección de caja a operar <small>${cajas.length}</small></h2>
          <div class="ta-totales pc-resumen cs-sintesis" title="Síntesis de la información de las cajas de la empresa">
            <span class="ta-total"><b>${cajasConInfo}</b> de ${cajas.length} cajas con información</span>
            <span class="ta-total"><b>${tot.subcajas.toLocaleString('es-GT')}</b> subcajas</span>
            <span class="ta-total"><b>${tot.conDocs.toLocaleString('es-GT')}</b> con documentos</span>
            <span class="ta-total"><b>${tot.conLineas.toLocaleString('es-GT')}</b> con detalle contable · ${tot.lineas.toLocaleString('es-GT')} líneas</span>
            <span class="ta-total sin"><b>${tot.sinInfo.toLocaleString('es-GT')}</b> vacías</span>
          </div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar caja, responsable, cuenta…" value="${esc(buscar)}" aria-label="Buscar cajas"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table class="bmc-tabla cs-tabla"><colgroup><col style="width:52px"><col><col style="width:11%"><col style="width:15%"><col style="width:96px"><col style="width:19%"><col style="width:128px"><col style="width:92px"><col style="width:86px"></colgroup>
            <thead><tr><th class="num">Caja</th><th>Nombre</th><th>Responsable</th><th>Cuenta contable asociada</th><th class="num">Fondo</th><th title="Subcajas con documentos y con detalle contable">Información</th><th>Subcaja actual</th><th class="num">Disponible</th><th>Estado</th></tr></thead>
            <tbody>
              ${filas.map((c) => { const u = ultimo.get(c.id); const k = contable(c.cuenta_id); return `<tr data-caja="${c.id}" class="${caja && caja.id === c.id ? 'actual' : ''} ${c.activa ? '' : 'pc-anulada'}" tabindex="0">
                <td class="num fuerte">${c.codigo}</td><td title="${esc(c.nombre)}"><b>${esc(c.nombre)}</b><small>${esc(c.tipo_caja)} · ${c.modalidad === 'NORMAL' ? 'normal' : 'liquidación'}</small></td><td>${esc(c.responsable || '')}</td>
                <td title="${esc(k ? `${k.codigo} · ${k.nombre}` : '')}"><b class="bmc-n">${esc(k?.codigo || '—')}</b><small>${esc(k?.nombre || 'Sin cuenta: defínela en Definición de Cajas')}</small></td>
                <td class="num">${esc(simbolo(c.moneda_id))} ${fmt.monto(c.monto_fondo)}</td>
                <td title="${esc((() => { const r = resumenCaja.get(c.id); return r ? `${r.subcajas} subcajas: ${r.conDocs} con documentos, ${r.conLineas} con detalle contable (${r.lineas} líneas), ${r.sinInfo} vacías` : 'Sin subcajas'; })())}">${info(c)}</td>
                <td>${u ? `<b>Subcaja ${u.numero}</b><small>${esc(mesTxt(u).toLowerCase())} · ${u.documentos || 0} doc.</small>` : '<span class="tk-tenue">Sin subcajas</span>'}</td>
                <td class="num ${u && Number(u.disponible) < 0 ? 'pc-rojo' : ''}">${u ? fmt.monto(u.disponible) : '—'}</td>
                <td>${!c.activa ? '<span class="pc-marca anulada">Inactiva</span>' : u ? `<span class="pc-marca ${u.estado === 'ABIERTA' ? 'pendiente' : 'definitiva'}">${u.estado === 'ABIERTA' ? 'Abierta' : 'Liquidada'}</span>` : '<span class="pc-marca aprobada">Activa</span>'}</td></tr>`; }).join('')
                || `<tr><td colspan="9" class="tk-vacio"><i class="ti ti-cash-register" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : cajas.length ? 'Ninguna caja coincide con la búsqueda.' : `La empresa no tiene cajas${ctx.admin ? ': créala en Cajas · Definición de Cajas («Nueva caja»).' : '.'}`}</td></tr>`}
            </tbody>
          </table>
        </div>`;
    }

    const cuentaCampo = (name, etq, id, dis, clase = '') => { const k = contable(id); return `<label class="campo ${clase}"><span>${etq}</span><input list="cc-cuentas" name="${name}" value="${esc(k ? k.codigo : '')}" placeholder="Código" ${dis}><small class="cc-nombre-cta" data-nombre-de="${name}">${k ? esc(k.nombre) : ''}</small></label>`; };
    const centroCampo = (name, etq, id, dis, clase = '') => { const k = centro(id); return `<label class="campo ${clase}"><span>${etq}</span><input list="cc-centros" name="${name}" value="${esc(k ? k.codigo : '')}" placeholder="Código" ${dis}><small class="cc-nombre-cta" data-nombre-de="${name}">${k ? esc(k.nombre) : ''}</small></label>`; };
    const listas = () => `
      <datalist id="cc-cuentas">${contables.filter((x) => x.movimiento && !x.anterior).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('')}</datalist>
      <datalist id="cc-centros">${centros.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('')}</datalist>`;

    function pintarCaja() {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-cash-register'); return; }
      const c = caja;
      if (!c) { ctx.pDet.innerHTML = ctx.vacio('Elige una caja para operarla.', 'ti-cash-register'); return; }
      const u = ultimo.get(c.id);
      const k = contable(c.cuenta_id);
      const sim = simbolo(c.moneda_id);
      const fondos = u ? Number(u.anticipo_valor) + Number(u.adelanto_valor) : 0;
      ctx.pDet.innerHTML = `
        <div class="cs-ficha">
          <div class="cs-id"><span class="tk-icono"><i class="ti ti-cash-register" aria-hidden="true"></i></span>
            <div><small>Caja ${c.codigo} · ${esc(c.tipo_caja)}</small><h2>${esc(c.nombre)}</h2><small>Responsable ${esc(c.responsable || '—')} · cuenta ${esc(k ? `${k.codigo} ${k.nombre}` : '—')}</small></div></div>
          <div class="cs-kpis">
            <div><span>Fondo asignado</span><b>${esc(sim)} ${fmt.monto(c.monto_fondo)}</b></div>
            <div><span>Subcaja actual</span><b>${u ? `${u.numero} · ${esc(mesTxt(u).toLowerCase())}` : '—'}</b></div>
            <div><span>Fondos entregados</span><b>${esc(sim)} ${fmt.monto(fondos)}</b></div>
            <div><span>Total gastos</span><b>${esc(sim)} ${fmt.monto(u?.liquidado || 0)}</b></div>
            <div class="${u && Number(u.disponible) < 0 ? 'alerta' : ''}"><span>${u && Number(u.disponible) < 0 ? 'Por reembolsar' : 'Disponible'}</span><b>${esc(sim)} ${fmt.monto(Math.abs(u?.disponible || 0))}</b></div>
          </div>
          <div class="cs-acc">
            <a class="boton secundario-sm" href="#/caja-bancos/definicion-cajas" data-accion="definir"><i class="ti ti-settings" aria-hidden="true"></i> Definición de la caja</a>
            <button type="button" class="boton primario-sm" data-accion="ir-detalle">Ir a detalle <i class="ti ti-arrow-right" aria-hidden="true"></i></button>
          </div>
        </div>`;
    }

    function leerCaja(form) {
      const el = form.elements;
      const cta = (n) => { const t = el[n].value.trim(); const k = porCodigo(t); return { id: k ? k.id : null, mal: !!t && !k }; };
      const cen = (n) => { const t = el[n].value.trim(); const k = centroPorCodigo(t); return { id: k ? k.id : null, mal: !!t && !k }; };
      const c1 = cta('cuenta'); const c2 = cta('cuenta_iva'); const c3 = cta('cuenta_retencion');
      const n1 = cen('centro_costo'); const n2 = cen('centro_alterno');
      return {
        v: {
          nombre: el.nombre.value.trim(), responsable: el.responsable.value.trim() || null, tipo_caja: el.tipo_caja.value,
          modalidad: form.querySelector('[name=modalidad]:checked')?.value || 'NORMAL', activa: el.activa.checked,
          centro_costo_id: n1.id, centro_alterno_id: n2.id, moneda_id: Number(el.moneda_id.value), monto_fondo: fmt.redondear(el.monto_fondo.value),
          cuenta_bancaria_id: el.cuenta_bancaria_id.value ? Number(el.cuenta_bancaria_id.value) : null,
          cuenta_id: c1.id, cuenta_iva_id: c2.id, cuenta_retencion_id: c3.id
        },
        mal: [[c1, 'cuenta', 'La cuenta de la caja'], [c2, 'cuenta_iva', 'La cuenta del IVA'], [c3, 'cuenta_retencion', 'La cuenta de retenciones'], [n1, 'centro_costo', 'El centro de costo'], [n2, 'centro_alterno', 'El centro alterno']].find(([x]) => x.mal)
      };
    }

    async function guardarCaja(form) {
      const error = form.querySelector('.modal-error');
      const { v, mal } = leerCaja(form);
      if (!v.nombre) { error.textContent = 'Escribe el nombre de la caja.'; return form.elements.nombre.focus(); }
      if (mal) { error.textContent = `${mal[2]} no es de movimiento en el catálogo de la localidad.`; return form.elements[mal[1]].focus(); }
      error.textContent = '';
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      const r = caja ? await sb.from('cajas_chicas').update(v).eq('id', caja.id).select('id').single()
        : await sb.from('cajas_chicas').insert({ ...v, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single();
      boton.disabled = false;
      if (r.error) { error.textContent = window.UI.traducirError(r.error); return; }
      window.FIN.aviso(caja ? 'Caja guardada' : 'Caja creada');
      caja = { id: r.data.id };
      guardarSesion('fin.caja', String(r.data.id));
      await consultarCajas();
    }

    // ===================== Vista 2 · Administración de la caja =====================
    async function irDetalle() {
      if (!caja) return window.FIN.aviso('Elige una caja');
      guardarSesion('fin.caja', String(caja.id));
      vista = 'DETALLE';
      verContable = false;
      ctx.espacio.classList.add('cc-en-detalle');
      periodo = null;
      await cargarPeriodos();
    }
    function irCajas() {
      vista = 'CAJAS';
      ctx.espacio.classList.remove('cc-en-detalle');
      pintarFiltros();
      consultarCajas();
    }

    async function cargarPeriodos(id = periodo?.id) {
      const [{ data, error }, cn] = await Promise.all([
        window.UI.todo(sb.from('caja_periodos_resumen').select('*').eq('caja_id', caja.id).order('numero', { ascending: false })),
        sb.rpc('caja_resumen_contable', { p_cajas: [caja.id] })
      ]);
      if (error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      periodos = data || [];
      if (!cn.error) (cn.data || []).forEach((x) => contablePer.set(x.id, x));
      await abrirPeriodo(periodos.find((p) => p.id === id) || periodos[0] || null);
    }

    async function abrirPeriodo(p, docId = null) {
      periodo = p;
      documentos = []; lineas = [];
      if (p) {
        const [d, l] = await Promise.all([
          // Por páginas: una subcaja migrada puede tener más de 1,000 líneas o documentos.
          window.UI.todo(sb.from('caja_documentos').select('*').eq('periodo_id', p.id).order('linea', { ascending: false })),
          window.UI.todo(sb.from('caja_lineas').select('*').eq('periodo_id', p.id).order('linea'))
        ]);
        if (periodo !== p) return;
        documentos = d.data || [];
        lineas = l.data || [];
        // Subcaja migrada sin documentos: se abre directo en su detalle contable.
        if (!documentos.length && lineas.length) verContable = true;
        await asegurarCuentas([...documentos.flatMap((x) => [x.cuenta_gasto_id, x.cuenta_no_deducible_id]), ...lineas.map((x) => x.cuenta_id)]);
      }
      doc = documentos.find((x) => x.id === docId) || (abierta() && ctx.admin ? null : documentos[0] || null);
      pintarCabecera();
      pintarSubcajas();
      pintarDocumentos();
    }

    function pintarCabecera() {
      const c = caja;
      const k = contable(c.cuenta_id);
      ctx.pFil.innerHTML = `
        <div class="ta-titulo"><span class="tk-icono"><i class="ti ti-cash-register" aria-hidden="true"></i></span><div><small>Cajas · Administración de cajas chicas</small><h2>Caja ${c.codigo} · ${esc(c.nombre)}</h2></div></div>
        <div class="cd-dato"><small>Responsable</small><b>${esc(c.responsable || '—')}</b><small>${esc(c.tipo_caja)} · ${c.modalidad === 'NORMAL' ? 'Normal' : 'Liquidación'}</small></div>
        <div class="cd-dato"><small>Cuenta de la caja</small><b>${esc(k?.codigo || '—')}</b><small>${esc(k?.nombre || '')}</small></div>
        <div class="cd-dato"><small>Fondo asignado</small><b>${esc(simbolo(c.moneda_id))} ${fmt.monto(c.monto_fondo)}</b><small>${esc(c.usuario_liquida ? `Liquida ${c.usuario_liquida}` : '')}</small></div>
        <div class="cd-acc-cab"><span class="cc-imp"><button type="button" class="boton secundario-sm" data-reporte="ACTUAL" data-fmt="PDF" title="Imprimir en PDF"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button><button type="button" class="boton secundario-sm" data-reporte="ACTUAL" data-fmt="EXCEL" title="Descargar en Excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button></span><button type="button" class="boton cd-ver" data-accion="ir-cajas"><i class="ti ti-layout-list" aria-hidden="true"></i> Ver cajas</button></div>`;
    }

    function pintarSubcajas() {
      const p = periodo;
      const sim = simbolo(caja.moneda_id);
      const hoy = fmt.hoy().split('-');
      const anio = p ? p.anio : Number(hoy[0]);
      const mes = p ? p.mes : Number(hoy[1]);
      const gastos = liquidado();
      const fondos = p ? Number(p.anticipo_valor) + Number(p.adelanto_valor) : 0;
      const pendLiq = fmt.redondear(gastos - fondos);           // > 0: gastos sobre el fondo, por reembolsar
      const reembolso = p ? Number(p.liquidacion_valor || 0) : 0;
      const pendReem = p && p.estado === 'ABIERTA' ? Math.max(0, pendLiq - reembolso) : 0;
      const porPag = 5;
      const lista = soloInfo ? periodos.filter(conInfo) : periodos;
      const conAlgo = periodos.filter(conInfo).length;
      const paginas = Math.max(1, Math.ceil(lista.length / porPag));
      if (p && !paginaFijada) { const i = lista.findIndex((x) => x.id === p.id); if (i >= 0) paginaSub = Math.floor(i / porPag); }
      paginaFijada = false;
      paginaSub = Math.min(Math.max(paginaSub, 0), paginas - 1);
      const vis = lista.slice(paginaSub * porPag, paginaSub * porPag + porPag);
      const lin = (x) => Number(contablePer.get(x.id)?.lineas || 0);
      const fila = (t, v, clase = '') => `<div class="cd5-fila ${clase}"><span>${t}</span><b>${esc(sim)} ${fmt.monto(v)}</b></div>`;
      const dato = (t, v) => `<div class="cd5-dato"><span>${t}</span><b>${v}</b></div>`;
      ctx.pMae.innerHTML = `
        <div class="cd-cinco">
          <section class="bm-bloque cd5-sub">
            <h3 class="ta-col-titulo"><i class="ti ti-folders" aria-hidden="true"></i> Subcajas <small title="${conAlgo} con documentos o detalle contable">${periodos.length}${conAlgo !== periodos.length ? ` · ${conAlgo} con info.` : ''}</small>
              <button type="button" class="cd5-info ${soloInfo ? 'activo' : ''}" data-accion="solo-info" aria-pressed="${soloInfo}" title="${soloInfo ? 'Ver todas las subcajas' : 'Ver solo las subcajas con documentos o detalle contable'}"><i class="ti ti-filter" aria-hidden="true"></i> Con info.</button>
              ${paginas > 1 ? `<span class="cd5-pag"><button type="button" class="icono-boton" data-pag-sub="-1" ${paginaSub ? '' : 'disabled'} aria-label="Subcajas más recientes"><i class="ti ti-chevron-left" aria-hidden="true"></i></button><small>${paginaSub + 1} de ${paginas}</small><button type="button" class="icono-boton" data-pag-sub="1" ${paginaSub < paginas - 1 ? '' : 'disabled'} aria-label="Subcajas anteriores"><i class="ti ti-chevron-right" aria-hidden="true"></i></button></span>` : ''}</h3>
            <table class="cd5-tabla"><thead><tr><th class="num">Subcaja</th><th class="num">Año</th><th>Mes</th><th class="num" title="Total de los documentos">Gastos</th><th class="num" title="Líneas del detalle contable">Lín.</th><th></th></tr></thead>
              <tbody>${vis.map((x) => `<tr data-periodo="${x.id}" class="${p && p.id === x.id ? 'actual' : ''} ${conInfo(x) ? '' : 'cd5-vacia'}" tabindex="0" title="${Number(x.documentos || 0)} documentos · ${lin(x)} líneas contables"><td class="num fuerte">${x.numero}</td><td class="num">${x.anio}</td><td>${MESES[x.mes - 1]}</td><td class="num">${Number(x.documentos || 0) ? fmt.monto(x.liquidado) : '<span class="tk-tenue">—</span>'}</td>
                <td class="num">${lin(x) ? `<span class="cd5-lin">${lin(x).toLocaleString('es-GT')}</span>` : '<span class="tk-tenue">—</span>'}</td>
                <td>${x.estado === 'LIQUIDADA' ? '<i class="ti ti-lock cc-si" title="Liquidada" aria-label="Liquidada"></i>' : '<i class="ti ti-circle-dot cd-abierta" title="Abierta" aria-label="Abierta"></i>'}</td></tr>`).join('')
                || `<tr><td colspan="6" class="tk-vacio">${soloInfo && periodos.length ? 'Ninguna subcaja tiene documentos ni detalle contable.' : ctx.admin ? 'Sin subcajas: créala a la derecha.' : 'La caja no tiene subcajas.'}</td></tr>`}</tbody></table>
          </section>
          <section class="bm-bloque cd5-crear">
            <h3 class="ta-col-titulo"><i class="ti ti-folder-plus" aria-hidden="true"></i> Crear nueva subcaja</h3>
            ${ctx.admin ? `<div class="cd5-am">
              <label class="campo"><span>Año</span><input type="number" name="anio" min="1900" max="2999" value="${anio}"></label>
              <label class="campo"><span>Mes</span><select name="mes">${MESES.map((m, i) => `<option value="${i + 1}" ${mes === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
            </div>
            <div class="cd5-botones">
              <button type="button" class="boton primario-sm" data-accion="crear-subcaja"><i class="ti ti-folder-plus" aria-hidden="true"></i> Crear subcaja</button>
              <button type="button" class="boton secundario-sm" data-accion="cambiar-mes" ${abierta() ? '' : 'disabled'} title="Pasa la subcaja elegida al año y mes indicados"><i class="ti ti-calendar-repeat" aria-hidden="true"></i> Cambiar mes</button>
            </div>
            <div class="cd5-fecha">
              <label class="campo"><span>F. presentación</span><input type="date" name="fecha_presentacion_sub" value="${esc(p?.fecha_presentacion || '')}" ${puede() ? '' : 'disabled'}></label>
              <button type="button" class="boton secundario-sm" data-accion="actualizar-fecha" ${puede() ? '' : 'disabled'} title="Aplica la fecha a la subcaja y a sus documentos"><i class="ti ti-calendar-check" aria-hidden="true"></i> Actualizar fecha</button>
            </div>` : '<p class="tk-tenue">Solo un administrador crea subcajas.</p>'}
            <p class="cd-creacion">Creación <b>${p ? esc(p.usuario || '') : '—'}</b> ${p ? esc(fmt.fechaHora(p.creado_en)) : ''}</p>
          </section>
          <section class="bm-bloque cd5-resumen">
            <h3 class="ta-col-titulo"><i class="ti ti-calculator" aria-hidden="true"></i> Resumen liquidación ${p ? `<small title="${esc(mesTxt(p).toLowerCase())}">subcaja ${p.numero}</small>` : ''}</h3>
            <div class="cd5-grupo">
              ${fila('Total liquidado', fondos)}
              ${fila('Total gastos', gastos)}
              ${fila(pendLiq < 0 ? 'Disponible' : 'Pend. liquidar', Math.abs(pendLiq), pendLiq > 0 ? 'alerta' : pendLiq < 0 ? 'ok' : '')}
            </div>
            <div class="cd5-grupo">
              ${fila('Pend. reembolso', pendReem, pendReem > 0 ? 'alerta' : '')}
              ${fila('Total reembolso', reembolso)}
            </div>
          </section>
          <section class="bm-bloque cd-reportes cd5-rep">
            <h3 class="ta-col-titulo"><i class="ti ti-report" aria-hidden="true"></i> Reportes</h3>
            ${p ? `<div class="cd5-rep-cab"><div class="cd-formato" role="radiogroup" aria-label="Formato">${[['PDF', 'ti-file-type-pdf', 'PDF'], ['EXCEL', 'ti-file-spreadsheet', 'Excel']].map(([k, ic, t]) => `<button type="button" role="radio" aria-checked="${formatoRep === k}" class="${formatoRep === k ? 'activo' : ''} cd-f-${k}" data-formato="${k}"><i class="ti ${ic}" aria-hidden="true"></i> ${t}</button>`).join('')}</div>
              <select name="tipo_reporte" aria-label="Documentos del reporte">${REPORTES.map(([k, t]) => `<option value="${k}" ${tipoReporte === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
            <div class="cd-rep-botones">
              <button type="button" class="boton secundario-sm" data-reporte="RESUMEN">Resumen contable</button>
              <button type="button" class="boton secundario-sm" data-reporte="CONTABLE">Detalle contable</button>
              <button type="button" class="boton secundario-sm" data-reporte="MOVIMIENTOS">Movimientos</button>
              <button type="button" class="boton secundario-sm" data-reporte="DETALLE">Documentos</button>
            </div>` : ctx.vacio('Elige una subcaja.', 'ti-report')}
          </section>
          <section class="bm-bloque cd5-estado">
            ${p && ctx.admin && abierta() ? '<button type="button" class="boton primario-sm cc-liquidar" data-accion="liquidar"><i class="ti ti-file-check" aria-hidden="true"></i> Cerrar caja</button>' : ''}
            ${p && ctx.admin && p.estado === 'LIQUIDADA' ? '<button type="button" class="boton secundario-sm" data-accion="reabrir"><i class="ti ti-lock-open" aria-hidden="true"></i> Reabrir caja</button>' : ''}
            ${p ? `${dato('Estado caja', `<span class="cd-estado-v ${p.estado === 'ABIERTA' ? 'vigente' : 'cerrada'}">${p.estado === 'ABIERTA' ? 'VIGENTE' : 'LIQUIDADA'}</span>`)}
              ${dato('Fecha cierre', p.liquidado_en ? esc(fmt.fechaHora(p.liquidado_en)) : '—')}
              ${dato('Cierre', esc(p.liquidado_por || '—'))}
              ${p.partida_id ? dato('Póliza', `<span class="pc-tipo">${esc(partidaTxt())}</span>`) : ''}` : ctx.vacio('Sin subcaja.', 'ti-lock')}
          </section>
        </div>`;
    }
    let partidas = new Map();
    const partidaTxt = () => partidas.get(periodo?.partida_id) || `Partida ${periodo?.partida_id}`;
    async function cargarPartida() {
      if (!periodo?.partida_id || partidas.has(periodo.partida_id)) return;
      const { data } = await sb.from('partidas').select('id, mes, numero, estado').eq('id', periodo.partida_id).maybeSingle();
      if (data) { partidas.set(data.id, `${data.mes}-${data.numero}${data.estado === 'VIGENTE' ? '' : ' (anulada)'}`); pintarSubcajas(); }
    }

    // ---------- Documentos ----------
    function pintarDocumentos(v0) {
      cargarPartida();
      if (!periodo) { ctx.pDet.innerHTML = ctx.vacio(ctx.admin ? 'Crea la primera subcaja de la caja para ingresar sus documentos.' : 'La caja no tiene subcajas.', 'ti-receipt'); return; }
      const sim = simbolo(caja.moneda_id);
      const q = buscar.trim().toLowerCase();
      const filas = documentos.filter((d) => !q || [d.serie, d.documento, d.nit, d.proveedor_nombre, d.proveedor_codigo].some((x) => String(x || '').toLowerCase().includes(q)));
      const marcados = documentos.filter((d) => d.contable).length;
      const debe = fmt.redondear(lineas.reduce((t, l) => t + Number(l.debe), 0));
      const haber = fmt.redondear(lineas.reduce((t, l) => t + Number(l.haber), 0));
      const tabs = `<div class="cd-tabs" role="tablist">${[['DOCUMENTOS', 'ti-receipt', 'Documentos', documentos.length], ['LIQUIDACION', 'ti-building-bank', 'Liquidación', null]].map(([k, ic, t, n]) => `<button type="button" role="tab" class="${pestanaDet === k ? 'activa' : ''}" aria-selected="${pestanaDet === k}" data-tab-caja="${k}"><i class="ti ${ic}" aria-hidden="true"></i> ${t}${n != null ? ` <b>${n}</b>` : ''}</button>`).join('')}</div>`;
      if (pestanaDet === 'LIQUIDACION') { ctx.pDet.innerHTML = `${tabs}${panelLiquidacion()}`; return; }
      ctx.pDet.innerHTML = `${tabs}
        <div class="cc-docs ${verContable ? 'cc-solo-contable' : ''}">
          <section class="cc-docs-lista">
            <header class="tk-bandeja-cab cc-cab">
              <h2>${verContable ? 'Detalle contable de la subcaja' : 'Documentos de la subcaja'} <small>${verContable ? lineas.length : documentos.length}</small></h2>
              ${verContable ? (lineas.length ? (debe === haber ? '<span class="pc-cuadre ok"><i class="ti ti-circle-check" aria-hidden="true"></i> Cuadra</span>' : `<span class="pc-cuadre no"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Diferencia ${fmt.monto(Math.abs(debe - haber))}</span>`) : '')
                : `<label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar documento, NIT, proveedor…" value="${esc(buscar)}" aria-label="Buscar documentos"></label>`}
            </header>
            <div class="pc-lineas cc-docs-tabla">
              ${verContable ? `<table><thead><tr><th class="pc-n">Línea</th><th>Cuenta</th><th>Nombre de la cuenta</th><th>Concepto</th><th>Centro</th><th class="num">Debe</th><th class="num">Haber</th></tr></thead>
                <tbody>${lineas.map((l) => { const k = contable(l.cuenta_id); const cc = centro(l.centro_id); return `<tr><td class="pc-n">${l.linea}</td><td class="fuerte">${esc(k?.codigo || '')}</td><td>${esc(k?.nombre || '')}</td><td>${esc(l.concepto || '')}</td><td>${esc(cc?.codigo || '')}</td><td class="num">${Number(l.debe) ? fmt.monto(l.debe) : ''}</td><td class="num">${Number(l.haber) ? fmt.monto(l.haber) : ''}</td></tr>`; }).join('')
                  || `<tr><td colspan="7" class="tk-vacio">Sin detalle contable${puede() ? ': presiona «Reconstruir detalle contable».' : '.'}</td></tr>`}</tbody>
                <tfoot><tr><td colspan="5">Totales (Q)</td><td class="num">${fmt.monto(debe)}</td><td class="num">${fmt.monto(haber)}</td></tr></tfoot></table>`
              : `<table><thead><tr><th class="pc-n">#</th><th>Serie</th><th>Documento</th><th>Tipo</th><th>Fecha</th><th>NIT</th><th>Proveedor</th><th class="num">Valor</th><th class="cc-det" title="Entra al detalle contable">Contable</th></tr></thead>
                <tbody>${filas.map((d) => `<tr data-doc="${d.id}" class="${doc && doc.id === d.id ? 'actual' : ''}" tabindex="0">
                  <td class="pc-n">${d.linea}</td><td>${esc(d.serie || '')}</td><td class="fuerte">${esc(d.documento)}</td>
                  <td><span class="pc-tipo" title="${esc(d.tipo_documento)}">${esc((TIPOS_DOC.find(([k]) => k === d.tipo_documento) || [])[1] || '')}</span></td>
                  <td>${esc(fmt.fechaDia(d.fecha))}</td><td>${esc(d.nit || '')}</td>
                  <td class="cc-prov" title="${esc(d.proveedor_nombre)}">${d.proveedor_codigo ? `<span class="tk-tenue">${esc(d.proveedor_codigo)}</span> ` : ''}${esc(d.proveedor_nombre)}</td>
                  <td class="num fuerte">${d.moneda_id !== caja.moneda_id ? `${esc(simbolo(d.moneda_id))} ` : ''}${fmt.monto(d.total)}</td>
                  <td class="cc-det"><input type="checkbox" data-contable="${d.id}" ${d.contable ? 'checked' : ''} ${puede() ? '' : 'disabled'} aria-label="Detalle contable de ${esc(docTxt(d))}"></td></tr>`).join('')
                  || `<tr><td colspan="9" class="tk-vacio"><i class="ti ti-receipt" aria-hidden="true"></i>${documentos.length ? 'Ningún documento coincide con la búsqueda.' : puede() ? 'Ingresa el primer documento en el formulario de la derecha.' : 'La subcaja no tiene documentos.'}</td></tr>`}</tbody></table>`}
            </div>
            <footer class="cc-docs-pie">
              <span class="cc-cuenta"><b>${documentos.length}</b> documentos ingresados · <b>${marcados}</b> al detalle contable</span>
              <button type="button" class="boton secundario-sm" data-accion="ver-contable"><i class="ti ${verContable ? 'ti-receipt' : 'ti-list-details'}" aria-hidden="true"></i> ${verContable ? 'Ver documentos' : 'Ver contable'}</button>
              ${puede() ? `<button type="button" class="boton secundario-sm" data-accion="reconstruir"><i class="ti ti-refresh" aria-hidden="true"></i> Reconstruir detalle contable</button>
                <button type="button" class="boton secundario-sm" data-accion="marcar" ${documentos.length ? '' : 'disabled'}><i class="ti ti-checks" aria-hidden="true"></i> Marcar/Desmarcar</button>` : ''}
              <span class="cc-total"><small>Total liquidado</small><b>${esc(sim)} ${fmt.monto(liquidado())}</b></span>
            </footer>
          </section>
          ${verContable ? '' : formDocumento(v0)}
        </div>`;
    }

    function panelLiquidacion() {
      const p = periodo;
      const dis = puede() ? '' : 'disabled';
      const sim = simbolo(caja.moneda_id);
      return `<form id="cc-sub-form" class="cc-fondos-form cd-liq" novalidate>
        <div class="cd-liq-cab">
          <label class="campo"><span>Valor del fondo</span><input type="number" step="0.01" min="0" name="valor" value="${esc(String(p.valor))}" ${dis}></label>
          <label class="campo"><span>Tasa de cambio</span><input type="number" step="any" min="0" name="tipo_cambio" value="${esc(String(p.tipo_cambio))}" ${dis}></label>
          <div class="cd-dato"><small>Usuario que liquidó</small><b>${esc(p.liquidado_por || '—')}</b><small>${esc(fmt.fechaHora(p.liquidado_en))}</small></div>
          <div class="cd-dato"><small>Total gastos</small><b>${esc(sim)} ${fmt.monto(liquidado())}</b><small>${documentos.length} documentos</small></div>
        </div>
        <div class="cc-fondos-tabla cd-fondos">
          <span></span><small>Cuenta bancaria</small><small>No. cheque</small><small># Nota</small><small class="num">Valor</small>
          ${FONDOS.map(([k, t]) => `<b>${t}</b>
            <select name="${k}_cuenta_id" aria-label="Cuenta bancaria del ${t.toLowerCase()}" ${dis}><option value="">—</option>${cuentas.filter((x) => x.activo || x.id === p[`${k}_cuenta_id`]).map((x) => `<option value="${x.id}" ${x.id === p[`${k}_cuenta_id`] ? 'selected' : ''}>${esc(ctx.nombreCuentaBancaria(x))}</option>`).join('')}</select>
            <input name="${k}_cheque" value="${esc(p[`${k}_cheque`] || '')}" maxlength="20" aria-label="Cheque del ${t.toLowerCase()}" ${dis}>
            <input name="${k}_nota" value="${esc(p[`${k}_nota`] || '')}" maxlength="20" aria-label="Nota del ${t.toLowerCase()}" ${dis}>
            <input type="number" step="0.01" min="0" class="num" name="${k}_valor" value="${esc(String(p[`${k}_valor`]))}" aria-label="Valor del ${t.toLowerCase()}" ${dis}>`).join('')}
        </div>
        <div class="cc-fondos-pie"><p class="modal-error tk-error" role="alert"></p>${puede() ? '<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar liquidación</button>' : ''}</div>
      </form>`;
    }

    function formDocumento(v0) {
      const d = doc;
      const ed = puede();
      const dis = ed ? '' : 'disabled';
      const anterior = documentos[0];
      const v = v0 || (d ? { ...d } : {
        serie: '', documento: '', tipo_documento: 'FACTURA ELECTRÓNICA', fecha: fmt.hoy(), nit: '', proveedor_codigo: '', proveedor_nombre: '', fecha_presentacion: fmt.hoy(),
        moneda_id: caja.moneda_id, clasificacion: 'BIENES', total: '', exento: 0, galones_super: 0, galones_regular: 0, galones_diesel: 0, inguat: 0, timbre_prensa: 0, no_deducible: 0,
        retencion: false, valor_retencion: 0, porcentaje_iva: Number(params.impuesto1) || 12, justificacion: '',
        cuenta_gasto_id: anterior?.cuenta_gasto_id || null, cuenta_no_deducible_id: null, centro_costo_id: caja.centro_costo_id || null, contable: true
      });
      const c = calcular(v);
      const num = (name, etq, val, extra = '', step = '0.01') => `<label class="campo ${extra}"><span>${etq}</span><input type="number" step="${step}" min="0" name="${name}" value="${esc(String(val ?? 0))}" ${dis}></label>`;
      const sim = simbolo(v.moneda_id);
      return `
        <form class="tk-form bm-form cc-doc-form" novalidate>
          <header class="cc-doc-cab">
            <div><small title="${d && d.modificado_en ? esc(`Modificó ${d.modificado_por_nombre || ''} ${fmt.fechaHora(d.modificado_en)}`) : ''}">${d ? `Documento ${d.linea} · ingresó ${esc(d.usuario || '')} ${esc(fmt.fechaHora(d.creado_en))}` : 'Nuevo documento'}</small><h3>${d ? esc(`${(TIPOS_DOC.find(([k]) => k === d.tipo_documento) || [])[1] || ''} ${docTxt(d)}`) : ed ? 'Ingresa la factura o el recibo' : 'Sin documento elegido'}</h3></div>
            <div class="cc-doc-acc">
              <label class="pc-check cc-contable" title="El documento entra al detalle contable de la subcaja"><input type="checkbox" name="contable" ${v.contable ? 'checked' : ''} ${dis}> Contable</label>
              ${ed && d ? '<button type="button" class="boton secundario-sm" data-accion="nuevo-doc"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</button><button type="button" class="icono-boton rp-peligro" data-accion="quitar-doc" title="Quitar el documento" aria-label="Quitar el documento"><i class="ti ti-trash" aria-hidden="true"></i></button>' : ''}
              ${ed ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${d ? 'Guardar' : 'Agregar'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          <div class="cc-doc-cuerpo">
            <div class="cc-g cc-g4">
              <label class="campo"><span>Serie</span><input name="serie" value="${esc(v.serie || '')}" maxlength="20" ${dis}></label>
              <label class="campo cc-c2"><span>Documento *</span><input name="documento" value="${esc(v.documento || '')}" maxlength="40" ${dis}></label>
              <label class="campo"><span>Fecha *</span><input type="date" name="fecha" value="${esc(v.fecha || '')}" ${dis}></label>
              <label class="campo cc-c2"><span>Tipo</span><select name="tipo_documento" ${dis}>${TIPOS_DOC.map(([k]) => `<option ${v.tipo_documento === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
              <label class="campo cc-c2"><span>F. presentación</span><input type="date" name="fecha_presentacion" value="${esc(v.fecha_presentacion || '')}" ${dis}></label>
              <label class="campo"><span>NIT</span><input name="nit" value="${esc(v.nit || '')}" maxlength="20" ${dis}></label>
              <label class="campo"><span>Código</span><input name="proveedor_codigo" value="${esc(v.proveedor_codigo || '')}" maxlength="20" ${dis}></label>
              <label class="campo cc-c2"><span>Proveedor *</span><input name="proveedor_nombre" value="${esc(v.proveedor_nombre || '')}" maxlength="150" ${dis}></label>
              <label class="campo"><span>Moneda</span><select name="moneda_id" ${dis}>${ctx.monedas.map((m) => `<option value="${m.id}" ${v.moneda_id === m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
              <label class="campo"><span>Clasificación</span><select name="clasificacion" ${dis}>${CLASIFICACIONES.map((k) => `<option ${v.clasificacion === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
              <label class="campo cc-total-doc cc-c2"><span>Total factura *</span><input type="number" step="0.01" min="0" name="total" value="${esc(String(v.total ?? ''))}" ${dis}></label>
            </div>
            <fieldset class="cc-fiscal"><legend>Desglose fiscal</legend>
              <div class="cc-g cc-g6">
                ${num('exento', 'Exento', v.exento)}
                ${num('inguat', 'INGUAT', v.inguat)}
                ${num('timbre_prensa', 'Timbre', v.timbre_prensa)}
                ${num('no_deducible', 'No deducible', v.no_deducible)}
                ${num('galones_super', 'Gal. súper', v.galones_super, '', '0.001')}
                ${num('galones_regular', 'Gal. regular', v.galones_regular, '', '0.001')}
                ${num('galones_diesel', 'Gal. diésel', v.galones_diesel, '', '0.001')}
                <div class="cc-calc"><span>IDP</span><b data-calc="idp">${fmt.monto(c.idp)}</b></div>
                ${num('porcentaje_iva', '% IVA', v.porcentaje_iva)}
                <label class="pc-check cc-ret"><input type="checkbox" name="retencion" ${v.retencion ? 'checked' : ''} ${dis}> Retención</label>
                <label class="campo"><span>Valor ret.</span><input type="number" step="0.01" min="0" name="valor_retencion" value="${esc(String(v.valor_retencion ?? 0))}" ${dis || (v.retencion ? '' : 'disabled')}></label>
                <div class="cc-calc"><span>A pagar</span><b data-calc="pagar">${fmt.monto(c.pagar)}</b></div>
              </div>
              <div class="cc-resumen-fiscal">
                <div><span>Base (sin IVA)</span><b data-calc="base">${esc(sim)} ${fmt.monto(c.base)}</b></div>
                <div class="cc-iva"><span>IVA</span><b data-calc="iva">${esc(sim)} ${fmt.monto(c.iva)}</b></div>
                <div class="${c.afecto < 0 ? 'cc-mal' : ''}" data-calc-caja="afecto"><span>Afecto</span><b data-calc="afecto">${esc(sim)} ${fmt.monto(c.afecto)}</b></div>
              </div>
            </fieldset>
            <div class="cc-g cd-cuentas">
              <label class="campo cd-justif"><span>Justificación</span><textarea name="justificacion" rows="1" maxlength="300" ${dis}>${esc(v.justificacion || '')}</textarea></label>
              ${cuentaCampo('cuenta_gasto', 'Cuenta de gasto', v.cuenta_gasto_id, dis)}
              ${cuentaCampo('cuenta_no_deducible', 'Cuenta no deducible', v.cuenta_no_deducible_id, dis)}
              ${centroCampo('centro_costo', 'Centro de costo', v.centro_costo_id, dis)}
            </div>
          </div>
        </form>`;
    }

    // Mismo cálculo que el servidor (preparar_caja_documento), para verlo mientras se escribe.
    function calcular(v) {
      const n = (k) => Number(v[k] || 0);
      const idp = fmt.redondear(n('galones_super') * Number(params.idp_super || 0) + n('galones_regular') * Number(params.idp_regular || 0) + n('galones_diesel') * Number(params.idp_diesel || 0));
      const afecto = fmt.redondear(n('total') - n('exento') - idp - n('inguat') - n('timbre_prensa') - n('no_deducible'));
      const pct = n('porcentaje_iva');
      const iva = SIN_IVA.includes(v.tipo_documento) || afecto <= 0 ? 0 : fmt.redondear(afecto * pct / (100 + pct));
      return { idp, afecto, iva, base: fmt.redondear(afecto - iva), pagar: fmt.redondear(n('total') - (v.retencion ? n('valor_retencion') : 0)) };
    }

    function leerDoc(form) {
      const el = form.elements;
      const t = (k) => el[k].value.trim() || null;
      const n = (k) => Number(el[k].value || 0);
      const cta = (k) => { const x = el[k].value.trim(); const c = porCodigo(x); return { id: c ? c.id : null, mal: !!x && !c }; };
      const cg = cta('cuenta_gasto'); const cn = cta('cuenta_no_deducible');
      const cc = el.centro_costo.value.trim(); const cen = centroPorCodigo(cc);
      return {
        v: {
          serie: t('serie'), documento: el.documento.value.trim(), tipo_documento: el.tipo_documento.value, fecha: el.fecha.value, fecha_presentacion: el.fecha_presentacion.value || null,
          nit: t('nit'), proveedor_codigo: t('proveedor_codigo'), proveedor_nombre: el.proveedor_nombre.value.trim(), moneda_id: Number(el.moneda_id.value), clasificacion: el.clasificacion.value,
          total: fmt.redondear(el.total.value), exento: fmt.redondear(el.exento.value), inguat: fmt.redondear(el.inguat.value), timbre_prensa: fmt.redondear(el.timbre_prensa.value), no_deducible: fmt.redondear(el.no_deducible.value),
          galones_super: n('galones_super'), galones_regular: n('galones_regular'), galones_diesel: n('galones_diesel'),
          porcentaje_iva: n('porcentaje_iva'), retencion: el.retencion.checked, valor_retencion: el.retencion.checked ? fmt.redondear(el.valor_retencion.value) : 0,
          justificacion: t('justificacion'), cuenta_gasto_id: cg.id, cuenta_no_deducible_id: cn.id, centro_costo_id: cen ? cen.id : null, contable: el.contable.checked
        },
        mal: cg.mal ? ['cuenta_gasto', 'La cuenta de gasto no es de movimiento en el catálogo.'] : cn.mal ? ['cuenta_no_deducible', 'La cuenta de no deducibles no es de movimiento en el catálogo.'] : cc && !cen ? ['centro_costo', 'El centro de costo no es de movimiento.'] : null
      };
    }

    function actualizarCalculo(form) {
      const { v } = leerDoc(form);
      const c = calcular(v);
      const sim = simbolo(v.moneda_id);
      const pon = (k, val, con = true) => { const b = form.querySelector(`[data-calc=${k}]`); if (b) b.textContent = `${con ? `${sim} ` : ''}${fmt.monto(val)}`; };
      pon('idp', c.idp, false); pon('pagar', c.pagar, false); pon('base', c.base); pon('iva', c.iva); pon('afecto', c.afecto);
      form.querySelector('[data-calc-caja=afecto]').classList.toggle('cc-mal', c.afecto < 0);
      form.elements.valor_retencion.disabled = !puede() || !v.retencion;
    }

    async function guardarDoc(form) {
      const error = form.querySelector('.modal-error');
      const { v, mal } = leerDoc(form);
      const foco = (k, txt) => { error.textContent = txt; form.elements[k]?.focus(); };
      if (!v.documento) return foco('documento', 'Escribe el número del documento.');
      if (!v.fecha) return foco('fecha', 'Escribe la fecha del documento.');
      if (!v.proveedor_nombre) return foco('proveedor_nombre', 'Escribe el nombre del proveedor.');
      if (!(v.total > 0)) return foco('total', 'Escribe el total de la factura.');
      if (mal) return foco(mal[0], mal[1]);
      const c = calcular(v);
      if (c.afecto < 0) return foco('exento', 'El exento, el IDP, el INGUAT, el timbre y los no deducibles pasan del total.');
      if (v.valor_retencion > v.total) return foco('valor_retencion', 'La retención pasa del total del documento.');
      if (v.contable && !v.cuenta_gasto_id) return foco('cuenta_gasto', 'Escribe la cuenta de gasto (o desmarca «Entra al detalle contable»).');
      const repetido = documentos.find((x) => x.id !== doc?.id && x.documento === v.documento.toUpperCase() && (x.serie || '') === (v.serie || '').toUpperCase() && (x.nit || '') === (v.nit || '').toUpperCase().replace(/-/g, ''));
      if (repetido && !confirm(`El documento ${docTxt(repetido)} de ese NIT ya está ingresado en la línea ${repetido.linea}. ¿Agregarlo otra vez?`)) return;
      error.textContent = '';
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      const r = doc ? await sb.from('caja_documentos').update(v).eq('id', doc.id).select('id').single()
        : await sb.from('caja_documentos').insert({ ...v, periodo_id: periodo.id }).select('id').single();
      boton.disabled = false;
      if (r.error) { error.textContent = window.UI.traducirError(r.error); return; }
      window.FIN.aviso(doc ? 'Documento guardado' : 'Documento agregado');
      const nuevo = !doc;
      await refrescar(nuevo ? null : r.data.id);
      if (nuevo) ctx.pDet.querySelector('.cc-doc-form [name=serie]')?.focus();
    }

    // Recarga la subcaja (totales) y sus documentos, sin perder la elección.
    async function refrescar(docId = doc?.id) {
      const { data } = await sb.from('caja_periodos_resumen').select('*').eq('caja_id', caja.id).order('numero', { ascending: false });
      periodos = data || [];
      await abrirPeriodo(periodos.find((p) => p.id === periodo?.id) || periodos[0] || null, docId);
    }

    // Proveedor por NIT: el último documento de caja o de compras con ese NIT.
    async function buscarNit(form) {
      const nit = form.elements.nit.value.trim().toUpperCase().replace(/-/g, '');
      if (!nit || form.elements.proveedor_nombre.value.trim()) return;
      const [a, b] = await Promise.all([
        sb.from('caja_documentos').select('proveedor_nombre, proveedor_codigo, cuenta_gasto_id').eq('nit', nit).order('id', { ascending: false }).limit(1),
        sb.from('compras').select('proveedor_nombre, proveedor_codigo').eq('nit', nit).order('id', { ascending: false }).limit(1)
      ]);
      const x = a.data?.[0] || b.data?.[0];
      if (!x || form.elements.proveedor_nombre.value.trim()) return;
      form.elements.proveedor_nombre.value = x.proveedor_nombre || '';
      if (!form.elements.proveedor_codigo.value.trim()) form.elements.proveedor_codigo.value = x.proveedor_codigo || '';
      const k = contable(x.cuenta_gasto_id);
      if (k && !form.elements.cuenta_gasto.value.trim()) { form.elements.cuenta_gasto.value = k.codigo; nombreCuenta(form.elements.cuenta_gasto); }
    }

    function nombreCuenta(input) {
      const s = input.form?.querySelector(`[data-nombre-de="${input.name}"]`) || input.closest('form')?.querySelector(`[data-nombre-de="${input.name}"]`);
      if (!s) return;
      const t = input.value.trim();
      const k = /^centro/.test(input.name) ? centroPorCodigo(t) : porCodigo(t);
      s.innerHTML = k ? esc(k.nombre) : t ? '<span class="pc-error">No es de movimiento</span>' : '';
    }

    // ---------- Subcaja: crear, cambiar mes, guardar, liquidar ----------
    async function crearSubcaja() {
      const el = (n) => ctx.pMae.querySelector(`[name=${n}]`);
      const anio = Number(el('anio').value);
      const mes = Number(el('mes').value);
      if (!(anio >= 1900 && anio <= 2999)) return window.FIN.aviso('Escribe un año válido');
      const abiertas = periodos.filter((p) => p.estado === 'ABIERTA');
      const mismo = periodos.find((p) => p.anio === anio && p.mes === mes);
      const aviso = [mismo ? `Ya existe la subcaja ${mismo.numero} de ${mesTxt(mismo).toLowerCase()}.` : '', abiertas.length ? `Hay ${abiertas.length} subcaja(s) abierta(s).` : ''].filter(Boolean).join(' ');
      if (!confirm(`${aviso ? `${aviso}\n\n` : ''}¿Crear la subcaja de ${MESES[mes - 1].toLowerCase()} ${anio} con un fondo de ${simbolo(caja.moneda_id)} ${fmt.monto(caja.monto_fondo)}?`)) return;
      const cuenta = el('cta_anticipo')?.value ? Number(el('cta_anticipo').value) : caja.cuenta_bancaria_id || null;
      const m = ctx.moneda(caja.moneda_id);
      const { data, error } = await sb.from('caja_periodos').insert({
        caja_id: caja.id, organizacion_id: caja.organizacion_id, localidad_id: caja.localidad_id, numero: 0, anio, mes,
        valor: caja.monto_fondo, anticipo_valor: caja.monto_fondo, anticipo_cuenta_id: cuenta, anticipo_cheque: el('cheque_anticipo')?.value.trim() || null,
        tipo_cambio: m && m.iso !== 'GTQ' ? m.cambio : 1
      }).select('id, numero').single();
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      window.FIN.aviso(`Subcaja ${data.numero} creada`);
      periodo = { id: data.id };
      await cargarPeriodos(data.id);
    }
    async function actualizarFecha() {
      const fecha = ctx.pMae.querySelector('[name=fecha_presentacion_sub]')?.value;
      if (!fecha) return window.FIN.aviso('Elige la fecha de presentación');
      const a = await sb.from('caja_periodos').update({ fecha_presentacion: fecha }).eq('id', periodo.id);
      if (a.error && !/fecha_presentacion/.test(a.error.message)) return window.FIN.aviso(window.UI.traducirError(a.error));
      const b = await sb.from('caja_documentos').update({ fecha_presentacion: fecha }).eq('periodo_id', periodo.id);
      if (b.error) return window.FIN.aviso(window.UI.traducirError(b.error));
      window.FIN.aviso(`Fecha de presentación aplicada a la subcaja y a sus ${documentos.length} documentos`);
      await refrescar();
    }
    async function cambiarMes() {
      const anio = Number(ctx.pMae.querySelector('[name=anio]').value);
      const mes = Number(ctx.pMae.querySelector('[name=mes]').value);
      if (anio === periodo.anio && mes === periodo.mes) return window.FIN.aviso('Elige otro año o mes');
      if (!confirm(`¿Pasar la subcaja ${periodo.numero} de ${mesTxt(periodo).toLowerCase()} a ${MESES[mes - 1].toLowerCase()} ${anio}?`)) return;
      const { error } = await sb.from('caja_periodos').update({ anio, mes }).eq('id', periodo.id);
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      window.FIN.aviso('Mes cambiado');
      await cargarPeriodos();
    }
    async function guardarSubcaja(form) {
      const el = form.elements;
      const error = form.querySelector('.modal-error');
      const v = { valor: fmt.redondear(el.valor.value), tipo_cambio: Number(el.tipo_cambio.value) || 1 };
      FONDOS.forEach(([k]) => {
        v[`${k}_cuenta_id`] = el[`${k}_cuenta_id`].value ? Number(el[`${k}_cuenta_id`].value) : null;
        v[`${k}_cheque`] = el[`${k}_cheque`].value.trim() || null;
        v[`${k}_nota`] = el[`${k}_nota`].value.trim() || null;
        v[`${k}_valor`] = fmt.redondear(el[`${k}_valor`].value);
      });
      const { error: e } = await sb.from('caja_periodos').update(v).eq('id', periodo.id);
      if (e) { error.textContent = window.UI.traducirError(e); return; }
      window.FIN.aviso('Subcaja guardada');
      await refrescar();
    }
    async function procesar(accion) {
      if (accion === 'LIQUIDAR') {
        const sin = documentos.filter((d) => d.contable && !d.cuenta_gasto_id);
        if (sin.length) return window.FIN.aviso(`Falta la cuenta de gasto en ${sin.length} documento(s)`);
        if (!confirm(`¿Liquidar la subcaja ${periodo.numero} (${mesTxt(periodo).toLowerCase()}) por ${simbolo(caja.moneda_id)} ${fmt.monto(liquidado())} y generar su póliza?\n\nLa subcaja y sus documentos ya no se podrán modificar.`)) return;
      }
      if (accion === 'REABRIR' && !confirm(`¿Reabrir la subcaja ${periodo.numero}? Su póliza debe estar anulada.`)) return;
      const { data, error } = await sb.rpc('procesar_caja_periodo', { p_id: periodo.id, p_accion: accion, p_partida: true });
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      if (accion === 'RECONSTRUIR') { verContable = true; window.FIN.aviso(`Detalle contable reconstruido: ${data.lineas} líneas`); }
      if (accion === 'LIQUIDAR') window.FIN.aviso(`Subcaja liquidada${data.partida ? ` · póliza ${data.partida}` : ''}`);
      if (accion === 'REABRIR') window.FIN.aviso('Subcaja reabierta');
      partidas = new Map();
      await refrescar();
    }
    async function marcarTodos() {
      const todos = documentos.every((d) => d.contable);
      const { error } = await sb.from('caja_documentos').update({ contable: !todos }).eq('periodo_id', periodo.id);
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      await refrescar();
    }

    // ---------- Reportes ----------
    function resumenLiq() {
      const p = periodo, gastos = liquidado();
      const fondos = Number(p.anticipo_valor) + Number(p.adelanto_valor);
      const pendLiq = fmt.redondear(gastos - fondos), reembolso = Number(p.liquidacion_valor || 0);
      const pendReem = p.estado === 'ABIERTA' ? Math.max(0, pendLiq - reembolso) : 0;
      return [['Total liquidado (anticipo + adelanto)', fondos], ['Total gastos', gastos], [pendLiq < 0 ? 'Disponible' : 'Pendiente de liquidar', Math.abs(pendLiq)], ['Pendiente de reembolso', pendReem], ['Total reembolso', reembolso]];
    }
    const cuentaTxt = (id) => { const x = cuentas.find((c) => c.id === id); return x ? ctx.nombreCuentaBancaria(x) : ''; };
    function reporte(tipo) {
      const p = periodo;
      if (!p) return window.FIN.aviso('Elige una subcaja');
      const sim = simbolo(caja.moneda_id);
      const emp = ctx.localidad(caja.localidad_id);
      const docs = [...documentos].reverse().filter((d) => tipoReporte === 'TODOS' || (tipoReporte === 'CONTABLE' ? d.contable : !d.contable));
      const suma = (k) => fmt.monto(docs.reduce((t, d) => t + Number(d[k]), 0));
      const titulos = { RESUMEN: 'Resumen contable', CONTABLE: 'Detalle contable', MOVIMIENTOS: 'Detalle de movimientos', DETALLE: 'Detalle de documentos', LIQUIDACION: 'Liquidación de la subcaja' };
      const cab = `
        <h1>${titulos[tipo]} · Caja ${caja.codigo} ${esc(caja.nombre)}</h1>
        <h2>${esc(emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '')} · Subcaja ${p.numero} · ${esc(mesTxt(p))} · ${p.estado === 'ABIERTA' ? 'Abierta' : `Liquidada por ${esc(p.liquidado_por || '')} ${esc(fmt.fechaHora(p.liquidado_en))}`}</h2>
        <div class="cab">
          <div><b>Responsable</b>${esc(caja.responsable || '')}</div><div><b>Valor del fondo</b>${esc(sim)} ${fmt.monto(p.valor)}</div><div><b>Póliza</b>${esc(p.partida_id ? partidaTxt() : '—')}</div><div><b>Tasa</b>${esc(String(p.tipo_cambio))}</div>
          ${FONDOS.map(([k, t]) => `<div><b>${t}</b>${esc(sim)} ${fmt.monto(p[`${k}_valor`])}${p[`${k}_cheque`] ? ` · ch. ${esc(p[`${k}_cheque`])}` : ''}</div>`).join('')}
          <div><b>Total liquidado</b>${esc(sim)} ${fmt.monto(liquidado())}</div></div>`;
      let cuerpo = '';
      if (tipo === 'RESUMEN' || tipo === 'CONTABLE') {
        if (!lineas.length) return window.FIN.aviso('Reconstruye primero el detalle contable');
        const filas = tipo === 'CONTABLE' ? lineas : [...lineas.reduce((m, l) => { const x = m.get(l.cuenta_id) || { cuenta_id: l.cuenta_id, debe: 0, haber: 0 }; x.debe += Number(l.debe); x.haber += Number(l.haber); return m.set(l.cuenta_id, x); }, new Map()).values()];
        cuerpo = `<table><thead><tr><th>Cuenta</th><th>Nombre</th>${tipo === 'CONTABLE' ? '<th>Concepto</th><th>Centro</th>' : ''}<th class="n">Debe</th><th class="n">Haber</th></tr></thead>
          <tbody>${filas.map((l) => { const k = contable(l.cuenta_id); return `<tr><td>${esc(k?.codigo || '')}</td><td>${esc(k?.nombre || '')}</td>${tipo === 'CONTABLE' ? `<td>${esc(l.concepto || '')}</td><td>${esc(centro(l.centro_id)?.codigo || '')}</td>` : ''}<td class="n">${Number(l.debe) ? fmt.monto(l.debe) : ''}</td><td class="n">${Number(l.haber) ? fmt.monto(l.haber) : ''}</td></tr>`; }).join('')}</tbody>
          <tfoot><tr><td colspan="${tipo === 'CONTABLE' ? 4 : 2}">Totales (Q)</td><td class="n">${fmt.monto(lineas.reduce((t, l) => t + Number(l.debe), 0))}</td><td class="n">${fmt.monto(lineas.reduce((t, l) => t + Number(l.haber), 0))}</td></tr></tfoot></table>`;
      } else if (tipo === 'LIQUIDACION') {
        cuerpo = `<table><thead><tr><th>Concepto</th><th>Cuenta bancaria</th><th>No. cheque</th><th># Nota</th><th class="n">Valor ${esc(sim)}</th></tr></thead>
          <tbody>${FONDOS.map(([k, t]) => `<tr><td>${t}</td><td>${esc(cuentaTxt(p[`${k}_cuenta_id`]))}</td><td>${esc(p[`${k}_cheque`] || '')}</td><td>${esc(p[`${k}_nota`] || '')}</td><td class="n">${fmt.monto(p[`${k}_valor`])}</td></tr>`).join('')}</tbody></table>
          <h3 style="margin:14px 0 4px;font-size:12px">Resumen de la liquidación</h3><table><tbody>${resumenLiq().map(([t, v]) => `<tr><td>${t}</td><td class="n">${esc(sim)} ${fmt.monto(v)}</td></tr>`).join('')}</tbody></table>
          <h3 style="margin:14px 0 4px;font-size:12px">Documentos liquidados</h3><table><thead><tr><th>#</th><th>Documento</th><th>Fecha</th><th>NIT</th><th>Proveedor</th><th class="n">Valor</th></tr></thead>
          <tbody>${docs.map((d) => `<tr><td>${d.linea}</td><td>${esc(docTxt(d))}</td><td>${esc(fmt.fechaDia(d.fecha))}</td><td>${esc(d.nit || '')}</td><td>${esc(d.proveedor_nombre)}</td><td class="n">${fmt.monto(d.total)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="5">${docs.length} documentos</td><td class="n">${suma('total')}</td></tr></tfoot></table>`;
      } else if (tipo === 'MOVIMIENTOS') {
        cuerpo = `<table><thead><tr><th>#</th><th>Serie</th><th>Documento</th><th>Tipo</th><th>Fecha</th><th>NIT</th><th>Proveedor</th><th>Justificación</th><th class="n">Valor</th></tr></thead>
          <tbody>${docs.map((d) => `<tr><td>${d.linea}</td><td>${esc(d.serie || '')}</td><td>${esc(d.documento)}</td><td>${esc((TIPOS_DOC.find(([k]) => k === d.tipo_documento) || [])[1] || '')}</td><td>${esc(fmt.fechaDia(d.fecha))}</td><td>${esc(d.nit || '')}</td><td>${esc(d.proveedor_nombre)}</td><td>${esc(d.justificacion || '')}</td><td class="n">${fmt.monto(d.total)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="8">${docs.length} documentos</td><td class="n">${suma('total')}</td></tr></tfoot></table>`;
      } else {
        cuerpo = `<table><thead><tr><th>#</th><th>Documento</th><th>Proveedor</th><th>Cuenta gasto</th><th class="n">Total</th><th class="n">Exento</th><th class="n">IDP</th><th class="n">INGUAT</th><th class="n">Timbre</th><th class="n">No ded.</th><th class="n">Base</th><th class="n">IVA</th><th class="n">Retención</th></tr></thead>
          <tbody>${docs.map((d) => `<tr><td>${d.linea}</td><td>${esc(docTxt(d))}</td><td>${esc(d.proveedor_nombre)}</td><td>${esc(contable(d.cuenta_gasto_id)?.codigo || '')}</td>${['total', 'exento', 'idp', 'inguat', 'timbre_prensa', 'no_deducible', 'base', 'iva', 'valor_retencion'].map((k) => `<td class="n">${fmt.monto(d[k])}</td>`).join('')}</tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="4">${docs.length} documentos</td>${['total', 'exento', 'idp', 'inguat', 'timbre_prensa', 'no_deducible', 'base', 'iva', 'valor_retencion'].map((k) => `<td class="n">${suma(k)}</td>`).join('')}</tr></tfoot></table>`;
      }
      imprimir(`${titulos[tipo]} · caja ${caja.codigo} subcaja ${p.numero}`, `${cab}${cuerpo}<div class="firmas"><div>Responsable de la caja</div><div>Revisó</div><div>Autorizó</div></div>`);
    }

    // Los mismos reportes de la subcaja en Excel, con el encabezado común (logo, parámetros, fecha y usuario).
    function reporteExcel(tipo) {
      const p = periodo;
      if (!p) return window.FIN.aviso('Elige una subcaja');
      if (!window.REPORTE_XLSX) return;
      const sim = simbolo(caja.moneda_id);
      const emp = ctx.localidad(caja.localidad_id);
      const docs = [...documentos].reverse().filter((d) => tipoReporte === 'TODOS' || (tipoReporte === 'CONTABLE' ? d.contable : !d.contable));
      const titulos = { RESUMEN: 'Resumen contable', CONTABLE: 'Detalle contable', MOVIMIENTOS: 'Detalle de movimientos', DETALLE: 'Detalle de documentos', LIQUIDACION: 'Liquidación de la subcaja' };
      const parametros = [`Empresa: ${emp ? `${emp.codigo} · ${emp.nombre_comercial}` : ''}`, `Caja: ${caja.codigo} · ${caja.nombre}`, `Subcaja: ${p.numero} · ${mesTxt(p)}`, `Estado: ${p.estado}`,
        `Responsable: ${caja.responsable || ''}`, `Documentos: ${(REPORTES.find(([x]) => x === tipoReporte) || [])[1] || ''}`];
      let columnas; let filas;
      if (tipo === 'RESUMEN' || tipo === 'CONTABLE') {
        if (!lineas.length) return window.FIN.aviso('Reconstruye primero el detalle contable');
        const ls = tipo === 'CONTABLE' ? lineas : [...lineas.reduce((m, l) => { const x = m.get(l.cuenta_id) || { cuenta_id: l.cuenta_id, debe: 0, haber: 0 }; x.debe += Number(l.debe); x.haber += Number(l.haber); return m.set(l.cuenta_id, x); }, new Map()).values()];
        columnas = [{ titulo: 'Línea', ancho: 7 }, { titulo: 'Cuenta', ancho: 14 }, { titulo: 'Nombre de la cuenta', ancho: 40 }, { titulo: 'Concepto', ancho: 34 }, { titulo: 'Centro', ancho: 10 }, { titulo: 'Debe', ancho: 15, tipo: 'monto' }, { titulo: 'Haber', ancho: 15, tipo: 'monto' }];
        filas = ls.map((l, i) => { const c = contable(l.cuenta_id); return { valores: [l.linea || i + 1, c?.codigo || '', c?.nombre || '', l.concepto || '', centro(l.centro_id)?.codigo || '', Number(l.debe) || null, Number(l.haber) || null] }; });
        filas.push({ tipo: 'total', valores: ['', '', 'Totales (Q)', '', '', lineas.reduce((t, l) => t + Number(l.debe), 0), lineas.reduce((t, l) => t + Number(l.haber), 0)] });
      } else if (tipo === 'LIQUIDACION') {
        columnas = [{ titulo: 'Concepto', ancho: 34 }, { titulo: 'Cuenta bancaria / Proveedor', ancho: 40 }, { titulo: 'Cheque / Fecha', ancho: 14 }, { titulo: 'Nota / NIT', ancho: 14 }, { titulo: `Valor ${sim}`, ancho: 15, tipo: 'monto' }];
        filas = [{ tipo: 'grupo', valores: ['Fondos de la subcaja'] }, ...FONDOS.map(([k, t]) => ({ valores: [t, cuentaTxt(p[`${k}_cuenta_id`]), p[`${k}_cheque`] || '', p[`${k}_nota`] || '', Number(p[`${k}_valor`] || 0)] })),
          { tipo: 'nota', valores: [''] }, { tipo: 'grupo', valores: ['Resumen de la liquidación'] }, ...resumenLiq().map(([t, v], i) => ({ tipo: i === 1 ? 'subtotal' : undefined, valores: [t, '', '', '', v] })),
          { tipo: 'nota', valores: [''] }, { tipo: 'grupo', valores: ['Documentos liquidados'] }, ...docs.map((d) => ({ valores: [`${d.linea} · ${docTxt(d)}`, d.proveedor_nombre, fmt.fechaDia(d.fecha), d.nit || '', Number(d.total)] })),
          { tipo: 'total', valores: [`${docs.length} documentos`, '', '', '', docs.reduce((t, d) => t + Number(d.total), 0)] }];
      } else if (tipo === 'MOVIMIENTOS') {
        columnas = [{ titulo: '#', ancho: 6 }, { titulo: 'Serie', ancho: 12 }, { titulo: 'Documento', ancho: 16 }, { titulo: 'Tipo', ancho: 8 }, { titulo: 'Fecha', ancho: 11 }, { titulo: 'NIT', ancho: 13 }, { titulo: 'Proveedor', ancho: 34 }, { titulo: 'Justificación', ancho: 34 }, { titulo: `Valor ${sim}`, ancho: 14, tipo: 'monto' }];
        filas = docs.map((d) => ({ valores: [d.linea, d.serie || '', d.documento, (TIPOS_DOC.find(([x]) => x === d.tipo_documento) || [])[1] || '', fmt.fechaDia(d.fecha), d.nit || '', d.proveedor_nombre, d.justificacion || '', Number(d.total)] }));
        filas.push({ tipo: 'total', valores: ['', '', `${docs.length} documentos`, '', '', '', '', '', docs.reduce((t, d) => t + Number(d.total), 0)] });
      } else {
        const K = ['total', 'exento', 'idp', 'inguat', 'timbre_prensa', 'no_deducible', 'base', 'iva', 'valor_retencion'];
        columnas = [{ titulo: '#', ancho: 6 }, { titulo: 'Documento', ancho: 18 }, { titulo: 'Proveedor', ancho: 32 }, { titulo: 'Cuenta gasto', ancho: 13 }, ...['Total', 'Exento', 'IDP', 'INGUAT', 'Timbre', 'No ded.', 'Base', 'IVA', 'Retención'].map((t) => ({ titulo: t, ancho: 12, tipo: 'monto' }))];
        filas = docs.map((d) => ({ valores: [d.linea, docTxt(d), d.proveedor_nombre, contable(d.cuenta_gasto_id)?.codigo || '', ...K.map((x) => Number(d[x] || 0))] }));
        filas.push({ tipo: 'total', valores: ['', `${docs.length} documentos`, '', '', ...K.map((x) => docs.reduce((t, d) => t + Number(d[x] || 0), 0))] });
      }
      // Fondos al pie: etiqueta, referencia y el valor en la última columna.
      if (tipo !== 'LIQUIDACION') {
      const pie = (t, ref, v, tp = 'nota') => { const r = Array(columnas.length).fill(''); r[0] = t; r[1] = ref; r[columnas.length - 1] = v; return { tipo: tp, valores: r }; };
      filas.push({ tipo: 'nota', valores: [''] }, { tipo: 'grupo', valores: ['Fondos de la subcaja'] }, ...FONDOS.map(([x, t]) => pie(t, p[`${x}_cheque`] ? `cheque ${p[`${x}_cheque`]}` : p[`${x}_nota`] ? `nota ${p[`${x}_nota`]}` : '', Number(p[`${x}_valor`] || 0))), pie('Total gastos', '', liquidado(), 'subtotal'));
      }
      window.REPORTE_XLSX.generar({ titulo: `${titulos[tipo]} · Caja ${caja.codigo} · Subcaja ${p.numero}`, parametros, orgId: caja.organizacion_id, locId: caja.localidad_id,
        hoja: titulos[tipo], archivo: `caja_${caja.codigo}_subcaja_${p.numero}_${tipo.toLowerCase()}`, columnas, filas });
    }

    // ---------- Reporte de cajas (selección): parámetros confirmados con casillas ----------
    async function dialogoReporte(formato) {
      if (!cajas.length) return window.FIN.aviso('No hay cajas');
      const { data: pr } = await sb.from('caja_periodos').select('anio, mes').in('caja_id', cajas.map((c) => c.id)).order('anio').order('mes').limit(1);
      const ini = pr?.[0] ? `${pr[0].anio}-${String(pr[0].mes).padStart(2, '0')}-01` : `${fmt.hoy().slice(0, 4)}-01-01`;
      const opcion = (name, titulo, ayuda, marcado, extra = '') => `<div class="cr-opcion"><label class="cr-check"><input type="checkbox" name="${name}" ${marcado ? 'checked' : ''}> ${titulo}</label><small>${ayuda}</small>${extra}</div>`;
      const velo = document.createElement('div');
      velo.className = 'modal-velo';
      velo.innerHTML = `<form class="modal cr-modal" novalidate>
        <header class="modal-cab"><h2><i class="ti ${formato === 'PDF' ? 'ti-file-type-pdf' : 'ti-file-spreadsheet'}" aria-hidden="true"></i> Reporte de cajas chicas · ${formato === 'PDF' ? 'PDF' : 'Excel'}</h2>
          <button type="button" class="icono-boton" data-cr="cerrar" aria-label="Cerrar"><i class="ti ti-x" aria-hidden="true"></i></button></header>
        <div class="modal-cuerpo">
          ${opcion('todas', 'Imprimir todas las cajas', 'Desmarca para elegir una sola caja.', true,
            `<div class="cr-sub" data-cr-caja hidden><label class="campo"><span>Caja</span><select name="caja">${cajas.map((c) => `<option value="${c.id}" ${caja && caja.id === c.id ? 'selected' : ''}>${c.codigo} · ${esc(c.nombre)}</option>`).join('')}</select></label></div>`)}
          ${opcion('rango', 'De una fecha inicial a una fecha final', 'Subcajas cuyo mes cae en el rango y documentos con fecha en el rango.', true,
            `<div class="cr-sub" data-cr-rango><label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${ini}"></label><label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${fmt.hoy()}"></label></div>`)}
          ${opcion('subcajas', 'Ver las subcajas', 'Resumen de cada subcaja: mes, estado, fondo, anticipos, gastos y disponible.', true)}
          ${opcion('movimientos', 'Ver los movimientos de la subcaja', 'Los documentos (facturas y recibos) de cada subcaja.', false)}
          ${opcion('contable', 'Mostrar el detalle contable', 'Las líneas contables de cada subcaja con sus totales.', false)}
        </div>
        <p class="modal-error tk-error" role="alert"></p>
        <footer class="modal-pie"><button type="button" class="boton secundario-sm" data-cr="cerrar">Cancelar</button>
          <button type="submit" class="boton primario-sm"><i class="ti ti-player-play" aria-hidden="true"></i> Generar</button></footer>
      </form>`;
      document.body.appendChild(velo);
      const form = velo.querySelector('form');
      const cerrar = () => { velo.remove(); document.removeEventListener('keydown', tecla); };
      const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
      document.addEventListener('keydown', tecla);
      velo.addEventListener('click', (e) => { if (e.target === velo || e.target.closest('[data-cr=cerrar]')) cerrar(); });
      form.addEventListener('change', () => {
        form.querySelector('[data-cr-caja]').hidden = form.elements.todas.checked;
        form.querySelector('[data-cr-rango]').hidden = !form.elements.rango.checked;
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const el = form.elements;
        const error = form.querySelector('.modal-error');
        const o = { formato, todas: el.todas.checked, cajaId: Number(el.caja.value), rango: el.rango.checked, desde: el.desde.value, hasta: el.hasta.value,
          subcajas: el.subcajas.checked, movimientos: el.movimientos.checked, contable: el.contable.checked };
        if (o.rango && (!o.desde || !o.hasta || o.desde > o.hasta)) { error.textContent = 'Revisa el rango: la fecha inicial no puede pasar de la final.'; return; }
        if (!o.subcajas && !o.movimientos && !o.contable) { error.textContent = 'Marca al menos una opción: subcajas, movimientos o detalle contable.'; return; }
        const b = form.querySelector('[type=submit]');
        b.disabled = true; error.textContent = '';
        try { await generarReporteCajas(o); cerrar(); } catch (x) { error.textContent = x.message || String(x); b.disabled = false; }
      });
      form.elements.todas.focus();
    }

    // Lee todas las filas de una consulta, de 1,000 en 1,000.
    async function leerTodo(consulta) {
      const out = [];
      for (let i = 0; ; i += 1000) {
        const { data, error } = await consulta().range(i, i + 999);
        if (error) throw new Error(error.message);
        out.push(...(data || []));
        if (!data || data.length < 1000) return out;
      }
    }

    async function generarReporteCajas(o) {
      const sel = o.todas ? cajas : cajas.filter((c) => c.id === o.cajaId);
      const am = (d) => Number(d.slice(0, 4)) * 100 + Number(d.slice(5, 7));
      let ps = await leerTodo(() => sb.from('caja_periodos_resumen').select('*').in('caja_id', sel.map((c) => c.id)).order('caja_id').order('numero'));
      if (o.rango) ps = ps.filter((p) => p.anio * 100 + p.mes >= am(o.desde) && p.anio * 100 + p.mes <= am(o.hasta));
      if (!ps.length) throw new Error('No hay subcajas con esos parámetros.');
      const docs = []; const lins = [];
      const pids = ps.map((p) => p.id);
      for (let i = 0; i < pids.length; i += 80) {
        const parte = pids.slice(i, i + 80);
        if (o.movimientos) docs.push(...await leerTodo(() => { let q = sb.from('caja_documentos').select('id, periodo_id, linea, serie, documento, tipo_documento, fecha, nit, proveedor_nombre, justificacion, total, iva, cuenta_gasto_id').in('periodo_id', parte).order('periodo_id').order('linea'); if (o.rango) q = q.gte('fecha', o.desde).lte('fecha', o.hasta); return q; }));
        if (o.contable) lins.push(...await leerTodo(() => sb.from('caja_lineas').select('id, periodo_id, linea, cuenta_id, concepto, debe, haber, centro_id').in('periodo_id', parte).order('periodo_id').order('linea')));
      }
      await asegurarCuentas([...docs.map((d) => d.cuenta_gasto_id), ...lins.map((l) => l.cuenta_id)]);
      const docsDe = (id) => docs.filter((d) => d.periodo_id === id);
      const linsDe = (id) => lins.filter((l) => l.periodo_id === id);
      const sum = (arr, k) => fmt.redondear(arr.reduce((t, x) => t + Number(x[k] || 0), 0));
      const anticipos = (p) => fmt.redondear(Number(p.anticipo_valor || 0) + Number(p.adelanto_valor || 0));
      const estado = (p) => p.estado === 'ABIERTA' ? 'Abierta' : 'Liquidada';
      const l = ctx.localidad(ctx.sel.loc);
      const contenido = [o.subcajas && 'Subcajas', o.movimientos && 'Movimientos', o.contable && 'Detalle contable'].filter(Boolean).join(', ');
      const parametros = [`Empresa: ${l ? `${l.codigo} · ${l.nombre_comercial}` : ''}`, `Cajas: ${o.todas ? `todas (${sel.length})` : `${sel[0].codigo} · ${sel[0].nombre}`}`,
        `Período: ${o.rango ? `del ${fmt.fechaDia(o.desde)} al ${fmt.fechaDia(o.hasta)}` : 'todas las fechas'}`, `Contenido: ${contenido}`];
      const grupos = sel.map((c) => ({ c, ps: ps.filter((p) => p.caja_id === c.id) })).filter((g) => g.ps.length);
      const archivo = `cajas_chicas_${l?.codigo || ''}${o.todas ? '' : `_caja_${sel[0].codigo}`}`;
      if (o.formato === 'PDF') {
        const tablaSub = (lista) => `<table><thead><tr><th>Subcaja</th><th>Mes</th><th>Estado</th><th class="n">Docs</th><th class="n">Fondo</th><th class="n">Anticipos</th><th class="n">Gastos</th><th class="n">Disponible</th></tr></thead>
          <tbody>${lista.map((p) => `<tr><td>${p.numero}</td><td>${esc(mesTxt(p))}</td><td>${estado(p)}</td><td class="n">${p.documentos ?? 0}</td><td class="n">${fmt.monto(p.valor)}</td><td class="n">${fmt.monto(anticipos(p))}</td><td class="n">${fmt.monto(p.liquidado)}</td><td class="n">${fmt.monto(p.disponible)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="3">${lista.length} subcajas</td><td class="n">${lista.reduce((t, p) => t + Number(p.documentos || 0), 0)}</td><td class="n">${fmt.monto(sum(lista, 'valor'))}</td><td class="n">${fmt.monto(lista.reduce((t, p) => t + anticipos(p), 0))}</td><td class="n">${fmt.monto(sum(lista, 'liquidado'))}</td><td class="n">${fmt.monto(sum(lista, 'disponible'))}</td></tr></tfoot></table>`;
        const tablaDocs = (ds) => `<table><thead><tr><th>#</th><th>Fecha</th><th>Tipo</th><th>Documento</th><th>NIT</th><th>Proveedor</th><th>Justificación</th><th>Cuenta</th><th class="n">IVA</th><th class="n">Valor</th></tr></thead>
          <tbody>${ds.map((d) => `<tr><td>${d.linea}</td><td>${esc(fmt.fechaDia(d.fecha))}</td><td>${esc((TIPOS_DOC.find(([k]) => k === d.tipo_documento) || [])[1] || '')}</td><td>${esc(docTxt(d))}</td><td>${esc(d.nit || '')}</td><td>${esc(d.proveedor_nombre)}</td><td>${esc(d.justificacion || '')}</td><td>${esc(contable(d.cuenta_gasto_id)?.codigo || '')}</td><td class="n">${fmt.monto(d.iva)}</td><td class="n">${fmt.monto(d.total)}</td></tr>`).join('')
            || '<tr><td colspan="10">Sin documentos en el período.</td></tr>'}</tbody>
          <tfoot><tr><td colspan="8">${ds.length} documentos</td><td class="n">${fmt.monto(sum(ds, 'iva'))}</td><td class="n">${fmt.monto(sum(ds, 'total'))}</td></tr></tfoot></table>`;
        const tablaLin = (ls) => `<table><thead><tr><th>Línea</th><th>Cuenta</th><th>Nombre de la cuenta</th><th>Concepto</th><th class="n">Debe</th><th class="n">Haber</th></tr></thead>
          <tbody>${ls.map((x) => { const k = contable(x.cuenta_id); return `<tr><td>${x.linea}</td><td>${esc(k?.codigo || '')}</td><td>${esc(k?.nombre || '')}</td><td>${esc(x.concepto || '')}</td><td class="n">${Number(x.debe) ? fmt.monto(x.debe) : ''}</td><td class="n">${Number(x.haber) ? fmt.monto(x.haber) : ''}</td></tr>`; }).join('')
            || '<tr><td colspan="6">Sin detalle contable.</td></tr>'}</tbody>
          <tfoot><tr><td colspan="4">Totales (Q)</td><td class="n">${fmt.monto(sum(ls, 'debe'))}</td><td class="n">${fmt.monto(sum(ls, 'haber'))}</td></tr></tfoot></table>`;
        const cuerpo = grupos.map(({ c, ps: lista }) => `
          <h3 style="margin:14px 0 4px;font-size:13px;border-bottom:1.5px solid #1f3b63;padding-bottom:2px">Caja ${c.codigo} · ${esc(c.nombre)} <small style="font-weight:400">· ${esc(c.responsable || '')} · fondo ${esc(simbolo(c.moneda_id))} ${fmt.monto(c.monto_fondo)}</small></h3>
          ${o.subcajas ? tablaSub(lista) : ''}
          ${o.movimientos || o.contable ? lista.map((p) => `<h4 style="margin:8px 0 3px;font-size:12px">Subcaja ${p.numero} · ${esc(mesTxt(p).toLowerCase())} · ${estado(p)}</h4>
            ${o.movimientos ? tablaDocs(docsDe(p.id)) : ''}${o.contable ? tablaLin(linsDe(p.id)) : ''}`).join('') : ''}`).join('');
        const total = o.todas && grupos.length > 1 && o.subcajas ? `<h3 style="margin:14px 0 4px;font-size:13px">Total de las cajas</h3>${tablaSub(ps)}` : '';
        return imprimir('Reporte de cajas chicas', `<h1>Cajas chicas · reporte de cajas y subcajas</h1><h2>${esc(parametros.join(' · '))}</h2>${cuerpo}${total}`, { locId: ctx.sel.loc, horizontal: true });
      }
      if (!window.REPORTE_XLSX) throw new Error('No se pudo cargar el generador de Excel.');
      const columnas = [{ titulo: 'Caja · subcaja', ancho: 30 }, { titulo: 'Mes · fecha', ancho: 16 }, { titulo: 'Documento · cuenta', ancho: 20 }, { titulo: 'Proveedor · nombre de la cuenta', ancho: 38 },
        { titulo: 'Justificación · concepto', ancho: 36 }, { titulo: 'Estado', ancho: 11 }, { titulo: 'Docs', ancho: 7, tipo: 'numero' }, { titulo: 'Fondo', ancho: 13, tipo: 'monto' }, { titulo: 'Anticipos', ancho: 13, tipo: 'monto' },
        { titulo: 'Gastos · valor', ancho: 14, tipo: 'monto' }, { titulo: 'Debe', ancho: 13, tipo: 'monto' }, { titulo: 'Haber', ancho: 13, tipo: 'monto' }, { titulo: 'Disponible', ancho: 13, tipo: 'monto' }];
      const fila = (v, extra = {}) => ({ valores: Array.from({ length: columnas.length }, (_, i) => v[i] ?? ''), ...extra });
      const filas = [];
      grupos.forEach(({ c, ps: lista }) => {
        filas.push(fila([`Caja ${c.codigo} · ${c.nombre}`, '', '', c.responsable || '', '', '', '', Number(c.monto_fondo || 0)], { tipo: 'grupo' }));
        lista.forEach((p) => {
          filas.push(o.subcajas ? fila([`Subcaja ${p.numero}`, mesTxt(p), '', '', '', estado(p), Number(p.documentos || 0), Number(p.valor || 0), anticipos(p), Number(p.liquidado || 0), null, null, Number(p.disponible || 0)], { tipo: 'subtotal', sangria: 1 })
            : fila([`Subcaja ${p.numero}`, mesTxt(p), '', '', '', estado(p)], { tipo: 'nota', sangria: 1 }));
          if (o.movimientos) {
            const ds = docsDe(p.id);
            ds.forEach((d) => filas.push(fila([`Documento ${d.linea}`, fmt.fechaDia(d.fecha), docTxt(d), d.proveedor_nombre, d.justificacion || '', (TIPOS_DOC.find(([k]) => k === d.tipo_documento) || [])[1] || '', null, null, null, Number(d.total)], { sangria: 2 })));
            filas.push(fila([`${ds.length} documentos`, '', '', '', '', '', null, null, null, sum(ds, 'total')], { tipo: 'nota', sangria: 2 }));
          }
          if (o.contable) {
            const ls = linsDe(p.id);
            ls.forEach((x) => { const k = contable(x.cuenta_id); filas.push(fila([`Línea ${x.linea}`, '', k?.codigo || '', k?.nombre || '', x.concepto || '', '', null, null, null, null, Number(x.debe) || null, Number(x.haber) || null], { sangria: 2, tenue: true })); });
            filas.push(fila(['Totales del detalle contable', '', '', '', '', '', null, null, null, null, sum(ls, 'debe'), sum(ls, 'haber')], { tipo: 'nota', sangria: 2 }));
          }
        });
        if (o.subcajas) filas.push(fila([`Total caja ${c.codigo}`, '', '', '', '', '', lista.reduce((t, p) => t + Number(p.documentos || 0), 0), sum(lista, 'valor'), fmt.redondear(lista.reduce((t, p) => t + anticipos(p), 0)), sum(lista, 'liquidado'), null, null, sum(lista, 'disponible')], { tipo: 'subtotal' }));
      });
      if (o.subcajas) filas.push(fila(['Total general', '', '', '', '', '', ps.reduce((t, p) => t + Number(p.documentos || 0), 0), sum(ps, 'valor'), fmt.redondear(ps.reduce((t, p) => t + anticipos(p), 0)), sum(ps, 'liquidado'), null, null, sum(ps, 'disponible')], { tipo: 'total' }));
      window.REPORTE_XLSX.generar({ titulo: 'Cajas chicas · reporte de cajas y subcajas', parametros, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Cajas', archivo, columnas, filas });
    }

    // ---------- Eventos ----------
    cont.addEventListener('change', async (e) => {
      if (vista === 'CAJAS') {
        const cambio = ctx.cambioOrgLoc(e);
        if (cambio === 'org' || cambio === 'loc') { pintarFiltros(); return cargarLocalidad(); }
        if (cambio === 'otro' && e.target.name === 'estado') { f.estado = e.target.value; return consultarCajas(); }
        if (e.target.closest('.cc-caja-form') && e.target.list) return nombreCuenta(e.target);
        return;
      }
      if (e.target.name === 'tipo_reporte') { tipoReporte = e.target.value; return; }
      const cb = e.target.closest('[data-contable]');
      if (cb) {
        const { error } = await sb.from('caja_documentos').update({ contable: cb.checked }).eq('id', Number(cb.dataset.contable));
        if (error) { cb.checked = !cb.checked; return window.FIN.aviso(window.UI.traducirError(error)); }
        const d = documentos.find((x) => String(x.id) === cb.dataset.contable);
        if (d) d.contable = cb.checked;
        const pie = ctx.pDet.querySelector('.cc-cuenta');
        if (pie) pie.innerHTML = `<b>${documentos.length}</b> documentos ingresados · <b>${documentos.filter((x) => x.contable).length}</b> al detalle contable`;
        if (doc && d && doc.id === d.id) { const c = ctx.pDet.querySelector('.cc-doc-form [name=contable]'); if (c) c.checked = cb.checked; }
        return;
      }
      const form = e.target.closest('.cc-doc-form');
      if (form) {
        if (e.target.list) nombreCuenta(e.target);
        if (e.target.name === 'nit') buscarNit(form);
        actualizarCalculo(form);
      }
    });
    cont.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar]')) {
        buscar = e.target.value;
        const pos = e.target.selectionStart;
        if (vista === 'CAJAS') pintarCajas(); else pintarDocumentos();
        const b = cont.querySelector('[data-buscar]'); if (b) { b.focus(); b.setSelectionRange(pos, pos); }
        return;
      }
      const form = e.target.closest('.cc-doc-form');
      if (form && e.target.type === 'number') actualizarCalculo(form);
    });
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-buscar]')) e.preventDefault();
      const fila = e.target.closest?.('tr[data-caja], tr[data-periodo], tr[data-doc]');
      if (fila && e.target === fila && e.key === 'Enter') { e.preventDefault(); fila.click(); if (fila.dataset.caja) irDetalle(); }
    });
    cont.addEventListener('dblclick', (e) => { if (e.target.closest('tr[data-caja]')) irDetalle(); });
    cont.addEventListener('click', (e) => {
      const rep = e.target.closest('[data-reporte]');
      if (rep) {
        const t = rep.dataset.reporte === 'ACTUAL' ? (pestanaDet === 'LIQUIDACION' ? 'LIQUIDACION' : verContable ? 'CONTABLE' : 'MOVIMIENTOS') : rep.dataset.reporte;
        return (rep.dataset.fmt || formatoRep) === 'EXCEL' ? reporteExcel(t) : reporte(t);
      }
      const fmtB = e.target.closest('[data-formato]');
      if (fmtB) { formatoRep = fmtB.dataset.formato; ctx.pMae.querySelectorAll('[data-formato]').forEach((b) => { b.classList.toggle('activo', b === fmtB); b.setAttribute('aria-checked', String(b === fmtB)); }); return; }
      const tabB = e.target.closest('[data-tab-caja]');
      if (tabB) { pestanaDet = tabB.dataset.tabCaja; return pintarDocumentos(); }
      const filaCaja = e.target.closest('tr[data-caja]');
      if (filaCaja) {
        caja = cajas.find((c) => String(c.id) === filaCaja.dataset.caja);
        guardarSesion('fin.caja', String(caja.id));
        ctx.pMae.querySelectorAll('tr[data-caja]').forEach((tr) => tr.classList.toggle('actual', tr === filaCaja));
        pintarFiltros();
        return pintarCaja();
      }
      const pag = e.target.closest('[data-pag-sub]');
      if (pag) { paginaSub += Number(pag.dataset.pagSub); paginaFijada = true; return pintarSubcajas(); }
      const filaP = e.target.closest('tr[data-periodo]');
      if (filaP) { verContable = false; return abrirPeriodo(periodos.find((p) => String(p.id) === filaP.dataset.periodo)); }
      const filaD = e.target.closest('tr[data-doc]');
      if (filaD && !e.target.closest('[data-contable]')) {
        doc = documentos.find((d) => String(d.id) === filaD.dataset.doc);
        ctx.pDet.querySelectorAll('tr[data-doc]').forEach((tr) => tr.classList.toggle('actual', tr === filaD));
        ctx.pDet.querySelector('.cc-doc-form').outerHTML = formDocumento();
        return;
      }
      const ac = e.target.closest('[data-accion]');
      if (!ac) return;
      const a = ac.dataset.accion;
      if (a === 'nueva-caja') { guardarSesion('fin.caja.nueva', '1'); location.hash = '#/caja-bancos/definicion-cajas'; return; }
      if (a === 'definir' && caja) { guardarSesion('fin.caja', String(caja.id)); return; }
      if (a === 'cajas-pdf') return dialogoReporte('PDF');
      if (a === 'cajas-excel') return dialogoReporte('EXCEL');
      if (a === 'cancelar-caja') return consultarCajas();
      if (a === 'ir-detalle') return irDetalle();
      if (a === 'ir-cajas') return irCajas();
      if (a === 'crear-subcaja') return crearSubcaja();
      if (a === 'cambiar-mes') return cambiarMes();
      if (a === 'actualizar-fecha') return actualizarFecha();
      if (a === 'liquidar') return procesar('LIQUIDAR');
      if (a === 'reabrir') return procesar('REABRIR');
      if (a === 'reconstruir') return procesar('RECONSTRUIR');
      if (a === 'marcar') return marcarTodos();
      if (a === 'ver-contable') { verContable = !verContable; return pintarDocumentos(); }
      if (a === 'solo-info') { soloInfo = !soloInfo; paginaSub = 0; paginaFijada = true; return pintarSubcajas(); }
      if (a === 'nuevo-doc') { doc = null; ctx.pDet.querySelectorAll('tr.actual').forEach((tr) => tr.classList.remove('actual')); ctx.pDet.querySelector('.cc-doc-form').outerHTML = formDocumento(); return ctx.pDet.querySelector('.cc-doc-form [name=serie]')?.focus(); }
      if (a === 'quitar-doc') {
        if (!confirm(`¿Quitar el documento ${docTxt(doc)} de ${doc.proveedor_nombre}?`)) return;
        sb.from('caja_documentos').delete().eq('id', doc.id).then(({ error }) => {
          if (error) return window.FIN.aviso(window.UI.traducirError(error));
          window.FIN.aviso('Documento quitado');
          doc = null;
          refrescar(null);
        });
      }
    });
    cont.addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.target.matches('.cc-caja-form')) return guardarCaja(e.target);
      if (e.target.matches('.cc-doc-form')) return guardarDoc(e.target);
      if (e.target.matches('.cc-fondos-form')) return guardarSubcaja(e.target);
    });

    iniciar();
  };
})();
