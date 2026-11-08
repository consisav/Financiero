// Compras · Procesos · Carga Facturas SAT (pasos guiados).
//   1 Cargar: el archivo de facturas recibidas descargado del portal de la SAT (.xls, .xlsx o .csv), con las columnas
//     agregadas «Clasificación» (siglas del catálogo Clasificación compras) y «Cuenta» (cuenta contable) al final.
//     Las columnas se reconocen por su nombre; las que no se conocen se guardan en «extras». Una factura que ya se
//     había cargado (misma autorización) solo se actualiza.
//   2 Revisar: totales, filtros y la tabla de facturas; la clasificación, la cuenta y las observaciones se eligen en
//     la fila (al elegirlas se proponen para las demás facturas pendientes del mismo NIT). Cada fila se despliega con
//     todos los datos del archivo: receptor, certificador, moneda e impuestos especiales.
//   3 Generar: crea las compras (con su detalle contable) o los documentos de la subcaja elegida; «Reversar facturas»
//     los quita mientras no tengan partida, pagos ni la subcaja esté liquidada.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const SHEETJS = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  // Columnas del archivo de la SAT: [expresión sobre el nombre normalizado, campo]. El orden importa.
  const COLUMNAS = [
    [/^fecha (de )?emision/, 'fecha_emision'], [/autorizacion/, 'numero_autorizacion'], [/^tipo (de )?(dte|docto|documento)/, 'tipo_dte'],
    [/^serie/, 'serie'], [/^numero( del dte)?$/, 'numero'], [/^nit (del )?emisor/, 'nit_emisor'], [/^nombre (completo )?(del )?emisor/, 'nombre_emisor'],
    [/^clasificacion (del )?emisor/, 'clasificacion_emisor'], [/exportacion/, 'exportacion'], [/ubicacion temporal/, 'ubicacion_temporal'],
    [/^codigo (de |del )?establecimiento/, 'codigo_establecimiento'], [/^nombre (del )?establecimiento/, 'nombre_establecimiento'],
    [/^id (del )?receptor/, 'id_receptor'], [/^nombre (completo )?(del )?receptor/, 'nombre_receptor'], [/^nit (del )?certificador/, 'nit_certificador'],
    [/^nombre (completo )?(del )?certificador/, 'nombre_certificador'], [/^estado/, 'estado'], [/^moneda/, 'moneda'], [/^gran total/, 'gran_total'],
    [/^iva/, 'iva'], [/^fecha (de )?anulacion/, 'fecha_anulacion'], [/anulad/, 'anulada'], [/^petroleo/, 'petroleo'], [/^turismo hospedaje/, 'turismo_hospedaje'],
    [/^turismo pasaje/, 'turismo_pasaje'], [/^timbre/, 'timbre_prensa'], [/^bomberos/, 'bomberos'], [/^tasa municipal/, 'tasa_municipal'],
    [/^bebidas no alcohol/, 'bebidas_no_alcohol'], [/^bebidas/, 'bebidas_alcohol'], [/^tabaco/, 'tabaco'], [/^cemento/, 'cemento'],
    [/^tarifa portuaria/, 'tarifa_portuaria'], [/^clasificacion/, 'clasificacion'], [/^cuenta/, 'cuenta_codigo'], [/^observacion/, 'observaciones']
  ];
  const NUMEROS = ['gran_total', 'iva', 'petroleo', 'turismo_hospedaje', 'turismo_pasaje', 'timbre_prensa', 'bomberos', 'tasa_municipal', 'bebidas_alcohol', 'tabaco', 'cemento', 'bebidas_no_alcohol', 'tarifa_portuaria'];
  const ESPECIALES = [['petroleo', 'Petróleo'], ['turismo_hospedaje', 'Turismo hospedaje'], ['turismo_pasaje', 'Turismo pasaje'], ['timbre_prensa', 'Timbre prensa'], ['bomberos', 'Bomberos'], ['tasa_municipal', 'Tasa municipal'], ['bebidas_alcohol', 'Bebidas alcohol'], ['bebidas_no_alcohol', 'Bebidas no alcohol'], ['tabaco', 'Tabaco'], ['cemento', 'Cemento'], ['tarifa_portuaria', 'Tarifa portuaria']];
  const normal = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

  let cargaLib = null;
  const libreria = () => cargaLib || (cargaLib = new Promise((ok, mal) => {
    if (window.XLSX) return ok(window.XLSX);
    const s = document.createElement('script'); s.src = SHEETJS; s.onload = () => ok(window.XLSX); s.onerror = () => { cargaLib = null; mal(new Error('No se pudo cargar el lector de Excel. Revisa la conexión.')); };
    document.head.appendChild(s);
  }));

  // La misma pantalla está en Compras · Procesos y en Facturación/Ventas · Procesos.
  window.PANTALLAS['carga-facturas-sat'] = function (cont, m) {
    const ctx = montar(cont, { titulo: 'Carga Facturas SAT', icono: 'ti-file-import', clase: 'bk-movimientos bm-solo vf-facturas sat-sat', grupo: m && m.id === 'facturacion' ? 'Ventas · Procesos' : 'Compras · Procesos' });
    const { sb } = ctx;
    let cargas = [], carga = null, lineas = [], clasif = [], contables = [], cajas = [], periodos = [], abiertas = new Set(), filtro = 'TODAS', buscar = '', ocupado = false;
    const contable = (id) => contables.find((x) => x.id === id);
    const clasificacion = (id) => clasif.find((x) => x.id === id);
    const vigente = (l) => !l.anulada && (l.estado || 'VIGENTE').toUpperCase() === 'VIGENTE';
    const sigla = (k) => k ? (k.siglas || String(k.codigo)) : '';

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('cargas_sat').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/cargas_sat/.test(prueba.error.message) ? 'Falta instalar el script 140 (Carga Facturas SAT) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      ctx.filtros('', '');
      const { data } = await sb.from('clasificaciones_compra').select('id, codigo, nombre, siglas, aplica_iva, activo').order('codigo');
      clasif = (data || []).filter((x) => x.activo);
      await cargarLocalidad();
    }
    // Cada lectura lleva su turno: si mientras tanto se cambió de empresa o de carga, la respuesta vieja se descarta.
    let turno = 0;
    async function cargarLocalidad(id) {
      const t = ++turno;
      if (!ctx.sel.loc) { pintar(); return; }
      const loc = ctx.sel.loc;
      const [c, k, cc] = await Promise.all([
        sb.from('cargas_sat').select('*').eq('localidad_id', loc).order('numero', { ascending: false }).limit(200),
        sb.from('cajas_chicas').select('id, codigo, nombre, activa').eq('localidad_id', loc).order('codigo'),
        ctx.cuentasContables(loc)
      ]);
      if (t !== turno) return;
      cargas = c.data || []; cajas = (k.data || []).filter((x) => x.activa !== false); contables = (cc || []).filter((x) => x.movimiento);
      await abrir(cargas.find((x) => x.id === id) || cargas[0] || null);
    }
    async function abrir(c) {
      const t = ++turno;
      const todas = []; let pers = [];
      if (c) {
        for (let i = 0; ; i += 1000) {
          const { data } = await sb.from('carga_sat_lineas').select('*').eq('carga_id', c.id).order('linea').range(i, i + 999);
          todas.push(...(data || [])); if (!data || data.length < 1000) break;
        }
        if (c.caja_periodo_id) {
          const { data } = await sb.from('caja_periodos').select('id, caja_id, numero, anio, mes, estado').eq('id', c.caja_periodo_id).maybeSingle();
          if (data) { const r = await sb.from('caja_periodos').select('id, caja_id, numero, anio, mes, estado').eq('caja_id', data.caja_id).order('numero', { ascending: false }); pers = r.data || []; }
        }
      }
      if (t !== turno) return;
      carga = c; lineas = todas; periodos = pers; abiertas = new Set();
      pintar();
    }
    async function leerPeriodos(cajaId) {
      if (!cajaId) { periodos = []; return; }
      const { data } = await sb.from('caja_periodos').select('id, caja_id, numero, anio, mes, estado').eq('caja_id', cajaId).order('numero', { ascending: false });
      periodos = data || [];
    }

    // ---------- Pintado ----------
    function paso() { return !carga ? 1 : lineas.some((l) => l.generado) ? 3 : 2; }
    function visibles() {
      const q = normal(buscar);
      return lineas.filter((l) => {
        if (filtro === 'PENDIENTES' && (l.generado || !vigente(l))) return false;
        if (filtro === 'SIN' && (l.generado || !vigente(l) || (l.clasificacion_id && l.cuenta_id))) return false;
        if (filtro === 'GENERADAS' && !l.generado) return false;
        if (filtro === 'ANULADAS' && vigente(l)) return false;
        if (filtro === 'AVISOS' && !(l.resultado && !l.generado && vigente(l))) return false;
        return !q || normal(`${l.nombre_emisor} ${l.nit_emisor} ${l.serie} ${l.numero} ${l.numero_autorizacion} ${l.observaciones || ''}`).includes(q);
      });
    }
    function pintar() {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-file-import'); return; }
      const ed = ctx.admin;
      const p = paso();
      const vig = lineas.filter(vigente);
      const tot = fmt.redondear(vig.reduce((t, l) => t + Number(l.gran_total || 0), 0));
      const iva = fmt.redondear(vig.reduce((t, l) => t + Number(l.iva || 0), 0));
      const sin = vig.filter((l) => !l.generado && (!l.clasificacion_id || !l.cuenta_id)).length;
      const gen = lineas.filter((l) => l.generado).length;
      const pend = vig.filter((l) => !l.generado).length;
      const per = periodos.find((x) => x.id === carga?.caja_periodo_id);
      const cajaId = per?.caja_id || carga?._caja || '';
      const destinoCaja = !!(carga && (carga.caja_periodo_id || carga._destino === 'CAJA'));
      const fijo = !ed || !carga || gen > 0;
      const vis = visibles();
      ctx.pDet.innerHTML = `
        <div class="tk-form ta-form bm-form vf-form sat-form">
          <header class="tk-titulo bm-titulo">
            <div class="tk-titulo-texto"><small>Facturas recibidas del portal SAT · ${esc(ctx.localidad(ctx.sel.loc)?.codigo || '')} ${esc(ctx.localidad(ctx.sel.loc)?.nombre_comercial || '')}</small><h2>${carga ? `Carga ${carga.numero}` : 'Nueva carga'}</h2></div>
            <div class="tk-marcas">${carga ? `<span class="pc-marca ${carga.estado === 'GENERADA' ? 'definitiva' : 'pendiente'}">${carga.estado === 'GENERADA' ? 'Generada' : 'Cargada'}</span>` : ''}</div>
            <div class="tk-titulo-acciones">
              ${cargas.length ? `<label class="campo sat-cargas"><span>Carga</span><select data-accion="carga">${!carga ? '<option value="">Nueva carga</option>' : ''}${cargas.map((x) => `<option value="${x.id}" ${carga?.id === x.id ? 'selected' : ''}>${x.numero} · ${esc(fmt.fechaDia ? fmt.fechaDia(x.fecha) : x.fecha)} · ${esc((x.archivo || '').slice(0, 40))}</option>`).join('')}</select></label>` : ''}
              ${ed && carga ? '<button type="button" class="boton secundario-sm" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva carga</button>' : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          <ol class="sat-pasos">${[['Cargar archivo', 'ti-upload'], ['Revisar y clasificar', 'ti-list-check'], ['Generar facturas', 'ti-file-invoice']].map(([t, i], n) => `<li class="${p > n + 1 ? 'hecho' : p === n + 1 ? 'actual' : ''}"><b>${p > n + 1 ? '<i class="ti ti-check" aria-hidden="true"></i>' : n + 1}</b><span><i class="ti ${i}" aria-hidden="true"></i> ${t}</span></li>`).join('')}</ol>

          <section class="bm-bloque dpb-banda vf sat-carga">
            <div class="sat-g">
              <div class="sat-archivo">
                <span class="sat-r">Archivo SAT</span>
                <div class="sat-archivo-fila">
                  <i class="ti ti-file-spreadsheet" aria-hidden="true"></i>
                  <div><b>${esc(carga?.archivo || 'Ningún archivo cargado')}</b><small>${carga ? `${lineas.length} facturas · ${esc(fmt.fechaDia ? fmt.fechaDia(carga.fecha) : carga.fecha)} · ${esc(carga.usuario || '')}` : '.xls, .xlsx o .csv descargado de «Consulta de DTE» en la Agencia Virtual'}</small></div>
                </div>
                ${ed ? `<div class="sat-botones">
                  <label class="boton ${carga ? 'secundario-sm' : 'primario-sm'} sat-subir"><i class="ti ti-upload" aria-hidden="true"></i> ${carga ? 'Cargar otro archivo' : 'Cargar archivo'}<input type="file" accept=".xls,.xlsx,.csv" data-accion="archivo" hidden></label>
                  ${carga ? `<button type="button" class="boton secundario-sm rp-peligro" data-accion="reversar-carga" ${gen ? 'disabled title="Primero reversa las facturas generadas"' : ''}><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Reversar carga</button>` : ''}
                </div>` : ''}
              </div>
              <div class="sat-destino">
                <span class="sat-r">Destino de las facturas</span>
                <div class="sat-opciones" role="radiogroup">
                  <label class="${destinoCaja ? '' : 'activa'}"><input type="radio" name="sat-destino" value="COMPRAS" ${destinoCaja ? '' : 'checked'} ${fijo ? 'disabled' : ''}><i class="ti ti-shopping-cart" aria-hidden="true"></i> Ingreso de compras</label>
                  <label class="${destinoCaja ? 'activa' : ''}"><input type="radio" name="sat-destino" value="CAJA" ${destinoCaja ? 'checked' : ''} ${fijo ? 'disabled' : ''}><i class="ti ti-cash" aria-hidden="true"></i> Caja chica</label>
                </div>
                ${destinoCaja ? `<div class="sat-caja">
                  <label class="campo"><span>Caja</span><select data-accion="caja" ${fijo ? 'disabled' : ''}><option value="">Elige la caja</option>${cajas.map((x) => `<option value="${x.id}" ${String(cajaId) === String(x.id) ? 'selected' : ''}>${esc(String(x.codigo))} · ${esc(x.nombre || '')}</option>`).join('')}</select></label>
                  <label class="campo"><span>Subcaja</span><select data-accion="subcaja" ${fijo || !cajaId ? 'disabled' : ''}><option value="">Elige la subcaja</option>${periodos.filter((x) => x.estado !== 'LIQUIDADA' || x.id === carga?.caja_periodo_id).map((x) => `<option value="${x.id}" ${carga?.caja_periodo_id === x.id ? 'selected' : ''}>Subcaja ${x.numero}</option>`).join('')}</select></label>
                  <label class="campo"><span>Año</span><input value="${per?.anio || ''}" disabled></label>
                  <label class="campo"><span>Mes</span><input value="${per ? MESES[per.mes] || per.mes : ''}" disabled></label>
                </div>` : '<p class="sat-nota">Cada factura se registra como una compra con su detalle contable: cuenta de la factura (o la de gastos del proveedor), IVA por cobrar y cuenta por pagar.</p>'}
              </div>
            </div>
            <details class="sat-instrucciones"><summary><i class="ti ti-info-circle" aria-hidden="true"></i> Instrucciones</summary><ol>
              <li>Descarga el archivo de facturas recibidas desde el portal de la SAT (.xls, .xlsx o .csv) sin cambiar sus columnas.</li>
              <li>Al final de cada fila agrega las columnas <b>Clasificación</b> (siglas del catálogo Clasificación compras) y <b>Cuenta</b> (cuenta contable de movimiento). También puedes elegirlas aquí, en cada fila.</li>
              <li>Al terminar la carga, revisa la tabla: si no aparecen datos, verifica el paso 2. Una factura que ya se había cargado solo se actualiza.</li>
              <li>Con todo clasificado presiona «Generar facturas»: se crean las compras (o los documentos de la subcaja) de las facturas vigentes; las anuladas y las notas no se generan.</li>
            </ol></details>
          </section>

          ${carga ? `
          <div class="rm-kpis sat-kpis">
            <div class="rm-kpi"><span>Documentos</span><b>${vig.length}${lineas.length - vig.length ? ` <small>+ ${lineas.length - vig.length} anuladas</small>` : ''}</b></div>
            <div class="rm-kpi"><span>Total vigente</span><b>Q ${fmt.monto(tot)}</b></div>
            <div class="rm-kpi"><span>IVA</span><b>Q ${fmt.monto(iva)}</b></div>
            <div class="rm-kpi ${sin ? 'sat-alerta' : ''}"><span>${sin ? 'Sin clasificar o sin cuenta' : 'Generadas'}</span><b>${sin || `${gen} <small>de ${vig.length}</small>`}</b></div>
          </div>
          <section class="bm-bloque sat-revision">
            <div class="sat-barra">
              <div class="rp-pestanas sat-filtros" role="tablist">${[['TODAS', 'Todas', lineas.length], ['PENDIENTES', 'Pendientes', pend], ['SIN', 'Sin clasificar', sin], ['GENERADAS', 'Generadas', gen], ['ANULADAS', 'Anuladas', lineas.length - vig.length], ['AVISOS', 'Con aviso', lineas.filter((l) => l.resultado && !l.generado && vigente(l)).length]].filter(([k, , n]) => n || k === 'TODAS' || k === filtro).map(([k, t, n]) => `<button type="button" role="tab" data-filtro="${k}" class="${filtro === k ? 'activa' : ''}">${t} <b>${n}</b></button>`).join('')}</div>
              <label class="campo sat-buscar"><span class="sr-only">Buscar</span><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-accion="buscar" value="${esc(buscar)}" placeholder="Proveedor, NIT, serie o número"></label>
            </div>
            <div class="pc-lineas sat-tabla"><table>
              <thead><tr><th class="sat-c-x"></th><th>Documento</th><th>Emisor</th><th class="num">Total</th><th class="num">IVA</th><th class="sat-c-clas">Clasificación</th><th class="sat-c-cta">Cuenta contable</th><th class="sat-c-est">Estado</th></tr></thead>
              <tbody>${vis.map(fila).join('') || '<tr><td colspan="8" class="tk-vacio">No hay facturas con ese filtro.</td></tr>'}</tbody>
              ${vis.length ? `<tfoot><tr><td></td><td colspan="2">${vis.length} facturas</td><td class="num">${fmt.monto(vis.reduce((t, l) => t + Number(l.gran_total || 0), 0))}</td><td class="num">${fmt.monto(vis.reduce((t, l) => t + Number(l.iva || 0), 0))}</td><td colspan="3"></td></tr></tfoot>` : ''}
            </table></div>
            <datalist id="sat-cuentas">${contables.map((x) => `<option value="${esc(x.nombre)} — ${esc(x.codigo)}"></option>`).join('')}</datalist>
          </section>
          ${ed ? `<footer class="sat-generar">
            <p>${pend ? `${pend - sin} de ${pend} facturas pendientes listas para generar${destinoCaja ? (per ? ` en la subcaja ${per.numero} (${MESES[per.mes] || ''} ${per.anio})` : ' — elige la subcaja') : ' como compras'}.` : gen ? 'Todas las facturas vigentes ya están generadas.' : 'No hay facturas vigentes por generar.'}</p>
            <button type="button" class="boton secundario-sm rp-peligro" data-accion="reversar" ${gen ? '' : 'disabled'}><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Reversar facturas</button>
            <button type="button" class="boton primario-sm" data-accion="generar" ${pend - sin > 0 && !(destinoCaja && !per) ? '' : 'disabled'}><i class="ti ti-file-invoice" aria-hidden="true"></i> Generar facturas</button>
          </footer>` : ''}` : `<section class="bm-bloque sat-vacio">${ctx.vacio('Carga el archivo de facturas recibidas de la SAT para empezar.', 'ti-file-spreadsheet')}</section>`}
        </div>`;
      if (ocupado) ctx.pDet.querySelectorAll('button, input, select').forEach((x) => { x.disabled = true; });
    }
    function fila(l) {
      const ed = ctx.admin && !l.generado && vigente(l);
      const k = clasificacion(l.clasificacion_id), cc = contable(l.cuenta_id);
      const ab = abiertas.has(l.id);
      const est = !vigente(l) ? ['anulada', 'Anulada'] : l.generado ? ['definitiva', l.compra_id ? 'Compra' : 'Caja'] : l.resultado && !/^Reversada/.test(l.resultado) ? ['pendiente', 'Aviso'] : l.clasificacion_id && l.cuenta_id ? ['aprobada', 'Lista'] : ['pendiente', 'Pendiente'];
      const dia = l.fecha_emision ? new Date(l.fecha_emision).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
      return `<tr data-l="${l.id}" class="${ab ? 'abierta' : ''} ${vigente(l) ? '' : 'sat-anulada'}">
        <td class="sat-c-x"><button type="button" class="icono-boton" data-abrir="${l.id}" aria-expanded="${ab}" aria-label="Ver detalle"><i class="ti ti-chevron-${ab ? 'down' : 'right'}" aria-hidden="true"></i></button></td>
        <td><b>${esc(l.tipo_dte || '')} ${esc(l.serie || '')}</b><small>${esc(l.numero || '')} · ${dia}</small></td>
        <td><b title="${esc(l.nombre_emisor || '')}">${esc(l.nombre_emisor || '')}</b><small>NIT ${esc(l.nit_emisor || '')}${l.nombre_establecimiento ? ` · ${esc(l.codigo_establecimiento || '')} ${esc(l.nombre_establecimiento)}` : ''}</small></td>
        <td class="num">${l.moneda && l.moneda !== 'GTQ' ? `<small>${esc(l.moneda)}</small>` : ''}${fmt.monto(l.gran_total)}</td>
        <td class="num">${fmt.monto(l.iva)}</td>
        <td class="sat-c-clas">${ed ? `<select data-c="clasificacion_id"><option value="">—</option>${clasif.map((x) => `<option value="${x.id}" ${l.clasificacion_id === x.id ? 'selected' : ''} title="${esc(x.nombre)}">${esc(sigla(x))} · ${esc(x.nombre)}</option>`).join('')}</select>` : `<span title="${esc(k?.nombre || '')}">${esc(k ? `${sigla(k)} · ${k.nombre}` : l.clasificacion || '')}</span>`}</td>
        <td class="sat-c-cta">${ed ? `<input list="sat-cuentas" data-c="cuenta" value="${esc(cc ? cc.codigo : l.cuenta_codigo || '')}" placeholder="Cuenta del proveedor" title="${esc(cc?.nombre || '')}">` : `<span title="${esc(cc?.nombre || '')}">${esc(cc ? cc.codigo : l.cuenta_codigo || '')}</span>`}${cc ? `<small>${esc(cc.nombre)}</small>` : ''}</td>
        <td class="sat-c-est"><span class="pc-marca ${est[0]}" title="${esc(l.resultado || '')}">${est[1]}</span>${l.compra_id ? `<a href="#/compras/facturas-compra/${l.compra_id}" class="sat-enlace">Ver</a>` : ''}</td>
      </tr>${ab ? `<tr class="sat-detalle"><td></td><td colspan="7">${detalle(l, ed)}</td></tr>` : ''}`;
    }
    function detalle(l, ed) {
      const dato = (t, v) => `<div><span>${t}</span><b>${esc(v == null || v === '' ? '—' : String(v))}</b></div>`;
      const fh = (v) => v ? new Date(v).toLocaleString('es-GT', { timeZone: 'America/Guatemala' }) : '';
      const esp = ESPECIALES.filter(([k]) => Number(l[k]));
      const extras = Object.entries(l.extras || {}).filter(([, v]) => v !== null && v !== '');
      return `<div class="sat-det">
        <div class="sat-det-g"><h4>Documento</h4>${dato('Autorización', l.numero_autorizacion)}${dato('Emisión', fh(l.fecha_emision))}${dato('Tipo', l.tipo_dte)}${dato('Estado', l.estado)}${dato('Anulada', l.anulada ? `Sí ${fh(l.fecha_anulacion)}` : 'No')}${dato('Moneda', l.moneda)}</div>
        <div class="sat-det-g"><h4>Emisor</h4>${dato('Clasificación emisor', l.clasificacion_emisor)}${dato('Exportación', l.exportacion)}${dato('Ubicación temporal', l.ubicacion_temporal)}${dato('Establecimiento', `${l.codigo_establecimiento || ''} ${l.nombre_establecimiento || ''}`.trim())}</div>
        <div class="sat-det-g"><h4>Receptor y certificador</h4>${dato('Receptor', `${l.id_receptor || ''} ${l.nombre_receptor || ''}`.trim())}${dato('Certificador', `${l.nit_certificador || ''} ${l.nombre_certificador || ''}`.trim())}</div>
        <div class="sat-det-g"><h4>Impuestos especiales</h4>${esp.length ? esp.map(([k, t]) => dato(t, fmt.monto(l[k]))).join('') : '<p class="sat-nota">Sin impuestos especiales.</p>'}</div>
        ${extras.length ? `<div class="sat-det-g"><h4>Otras columnas</h4>${extras.map(([k, v]) => dato(k, v)).join('')}</div>` : ''}
        <label class="campo sat-obs"><span>Observaciones</span><input data-c="observaciones" value="${esc(l.observaciones || '')}" maxlength="300" placeholder="Descripción de la compra" ${ed ? '' : 'disabled'}></label>
        ${l.resultado ? `<p class="sat-resultado"><i class="ti ti-info-circle" aria-hidden="true"></i> ${esc(l.resultado)}</p>` : ''}
      </div>`;
    }

    // ---------- Archivo ----------
    function valorFecha(v, X) {
      if (v == null || v === '') return null;
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'number') { const d = X.SSF.parse_date_code(v); return d ? new Date(Date.UTC(d.y, d.m - 1, d.d, d.H + 6, d.M, Math.floor(d.S))).toISOString() : null; }
      const s = String(v).trim();
      const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
      if (m) return new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T${(m[4] || '0').padStart(2, '0')}:${m[5] || '00'}:${m[6] || '00'}-06:00`).toISOString();
      const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.length <= 10 ? `${s}T00:00:00` : s}-06:00`;
      const d = new Date(iso); return isNaN(d) ? null : d.toISOString();
    }
    const numero = (v) => { if (v == null || v === '') return 0; if (typeof v === 'number') return v; const n = Number(String(v).replace(/[Q,\s]/g, '')); return isNaN(n) ? 0 : n; };
    async function leerArchivo(file) {
      const X = await libreria();
      const libro = X.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      const filas = X.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: null, blankrows: false });
      const fi = filas.findIndex((r) => r.some((c) => /autorizaci/i.test(normal(c))));
      if (fi < 0) throw new Error('El archivo no tiene la columna «Número de autorización»: verifica que sea el archivo descargado de la SAT.');
      const enc = filas[fi].map((c) => String(c ?? '').trim());
      const mapa = enc.map((h) => { const n = normal(h); const m = COLUMNAS.find(([re]) => re.test(n)); return m ? m[1] : null; });
      const usados = new Set();
      mapa.forEach((k, i) => { if (k && usados.has(k)) mapa[i] = null; else if (k) usados.add(k); });
      const out = [];
      filas.slice(fi + 1).forEach((r) => {
        const x = { extras: {} };
        r.forEach((v, i) => {
          const k = mapa[i];
          if (!k) { if (enc[i] && v !== null && v !== '') x.extras[enc[i]] = v instanceof Date ? v.toISOString() : v; return; }
          if (k === 'fecha_emision' || k === 'fecha_anulacion') x[k] = valorFecha(v, X);
          else if (NUMEROS.includes(k)) x[k] = numero(v);
          else if (k === 'anulada') x[k] = /^(s|si|true|1|anulad)/i.test(normal(v));
          else x[k] = v == null ? null : String(v instanceof Date ? v.toISOString() : v).trim();
        });
        if (!x.numero_autorizacion) return;
        if (!Object.keys(x.extras).length) x.extras = null;
        out.push(x);
      });
      return { lineas: out, columnas: usados };
    }
    async function subir(file) {
      const error = ctx.pDet.querySelector('.tk-error');
      error.textContent = '';
      let datos;
      try { datos = await leerArchivo(file); } catch (e) { error.textContent = e.message; return; }
      if (!datos.lineas.length) { error.textContent = 'El archivo no trae facturas debajo de los encabezados.'; return; }
      const faltan = ['fecha_emision', 'numero', 'nit_emisor', 'gran_total'].filter((k) => !datos.columnas.has(k));
      if (faltan.length) { error.textContent = `Al archivo le faltan columnas de la SAT: ${faltan.join(', ')}.`; return; }
      ocupado = true; pintar();
      let creada = null;
      try {
        // Facturas que ya estaban (misma autorización en la empresa): solo se actualizan, sin perder lo clasificado.
        const auts = datos.lineas.map((x) => x.numero_autorizacion);
        const previas = new Map();
        for (let i = 0; i < auts.length; i += 300) {
          const { data } = await sb.from('carga_sat_lineas').select('numero_autorizacion, clasificacion_id, cuenta_id, observaciones').eq('localidad_id', ctx.sel.loc).in('numero_autorizacion', auts.slice(i, i + 300));
          (data || []).forEach((x) => previas.set(x.numero_autorizacion, x));
        }
        // Propuesta por NIT: la última clasificación y cuenta que se usaron con ese emisor.
        const nits = [...new Set(datos.lineas.map((x) => String(x.nit_emisor || '').toUpperCase().replace(/-/g, '')).filter(Boolean))];
        const hist = new Map();
        for (let i = 0; i < nits.length; i += 200) {
          const { data } = await sb.from('carga_sat_lineas').select('nit_emisor, clasificacion_id, cuenta_id').eq('localidad_id', ctx.sel.loc).in('nit_emisor', nits.slice(i, i + 200)).not('clasificacion_id', 'is', null).order('id', { ascending: false }).limit(2000);
          (data || []).forEach((x) => { if (!hist.has(x.nit_emisor)) hist.set(x.nit_emisor, x); });
        }
        const { data: nueva, error: e1 } = await sb.from('cargas_sat').insert({ organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, archivo: file.name, caja_periodo_id: carga && !lineas.length ? carga.caja_periodo_id : null }).select('*').single();
        if (e1) throw e1;
        creada = nueva.id;
        const filas = datos.lineas.map((x, i) => {
          const nit = String(x.nit_emisor || '').toUpperCase().replace(/-/g, '');
          const pr = previas.get(x.numero_autorizacion), h = hist.get(nit);
          const r = { ...x, carga_id: nueva.id, localidad_id: ctx.sel.loc, linea: i + 1 };
          const conClas = datos.columnas.has('clasificacion') && x.clasificacion;
          r.clasificacion = conClas ? x.clasificacion : null;
          r.clasificacion_id = conClas ? null : pr?.clasificacion_id || h?.clasificacion_id || null;
          const conCta = datos.columnas.has('cuenta_codigo') && x.cuenta_codigo;
          r.cuenta_codigo = conCta ? x.cuenta_codigo : null;
          r.cuenta_id = conCta ? null : pr?.cuenta_id || h?.cuenta_id || null;
          r.observaciones = x.observaciones || pr?.observaciones || null;
          return r;
        });
        const llaves = [...new Set(filas.flatMap((x) => Object.keys(x)))];
        for (let i = 0; i < filas.length; i += 400) {
          const parte = filas.slice(i, i + 400).map((x) => Object.fromEntries(llaves.map((k) => [k, x[k] ?? (NUMEROS.includes(k) ? 0 : k === 'anulada' ? false : null)])));
          const r = await sb.from('carga_sat_lineas').upsert(parte, { onConflict: 'localidad_id,numero_autorizacion' });
          if (r.error) throw r.error;
        }
        // Una carga vacía anterior (todas sus facturas pasaron a esta) se quita.
        if (carga && carga.id !== nueva.id && !lineas.length) await sb.from('cargas_sat').delete().eq('id', carga.id);
        ocupado = false;
        filtro = 'TODAS'; buscar = '';
        window.FIN.aviso(`${filas.length} facturas cargadas${previas.size ? ` (${previas.size} ya estaban y se actualizaron)` : ''}`);
        await cargarLocalidad(nueva.id);
      } catch (e) {
        // Si la carga quedó sin facturas por el error, se quita.
        if (creada) { const { count } = await sb.from('carga_sat_lineas').select('id', { count: 'exact', head: true }).eq('carga_id', creada); if (!count) await sb.from('cargas_sat').delete().eq('id', creada); }
        ocupado = false; pintar();
        ctx.pDet.querySelector('.tk-error').textContent = window.UI.traducirError(e);
      }
    }

    // ---------- Cambios en las filas ----------
    async function guardarLinea(l, cambios, mismoNit) {
      const { error } = await sb.from('carga_sat_lineas').update(cambios).eq('id', l.id);
      if (error) { ctx.pDet.querySelector('.tk-error').textContent = window.UI.traducirError(error); return; }
      Object.assign(l, cambios);
      if (mismoNit) {
        const k = Object.keys(cambios)[0];
        const otras = lineas.filter((x) => x !== l && !x.generado && vigente(x) && x.nit_emisor && x.nit_emisor === l.nit_emisor && !x[k]);
        if (otras.length) {
          const r = await sb.from('carga_sat_lineas').update(cambios).in('id', otras.map((x) => x.id));
          if (!r.error) { otras.forEach((x) => Object.assign(x, cambios)); window.FIN.aviso(`También se aplicó a ${otras.length} factura${otras.length === 1 ? '' : 's'} más de ${l.nombre_emisor || 'ese NIT'}`); }
        }
      }
      pintar();
    }

    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { filtro = 'TODAS'; buscar = ''; return cargarLocalidad(); }
      const t = e.target;
      if (t.matches('[data-accion=archivo]')) { const f = t.files?.[0]; if (f) subir(f); return; }
      if (t.matches('[data-accion=carga]')) return abrir(cargas.find((x) => x.id === Number(t.value)) || null);
      if (t.name === 'sat-destino' && carga) {
        if (t.value === 'COMPRAS') {
          const r = await sb.from('cargas_sat').update({ caja_periodo_id: null }).eq('id', carga.id);
          if (r.error) { ctx.pDet.querySelector('.tk-error').textContent = window.UI.traducirError(r.error); return; }
          carga.caja_periodo_id = null; carga._destino = null; periodos = [];
        } else carga._destino = 'CAJA';
        return pintar();
      }
      if (t.matches('[data-accion=caja]') && carga) { carga._caja = t.value; await leerPeriodos(Number(t.value) || null); return pintar(); }
      if (t.matches('[data-accion=subcaja]') && carga) {
        const id = t.value ? Number(t.value) : null;
        const r = await sb.from('cargas_sat').update({ caja_periodo_id: id }).eq('id', carga.id);
        if (r.error) { ctx.pDet.querySelector('.tk-error').textContent = window.UI.traducirError(r.error); return; }
        carga.caja_periodo_id = id; return pintar();
      }
      const tr = t.closest('tr[data-l]') || t.closest('tr.sat-detalle')?.previousElementSibling;
      const l = tr && lineas.find((x) => x.id === Number(tr.dataset.l));
      if (!l || !t.dataset.c) return;
      if (t.dataset.c === 'clasificacion_id') return guardarLinea(l, { clasificacion_id: t.value ? Number(t.value) : null }, !!t.value);
      if (t.dataset.c === 'observaciones') return guardarLinea(l, { observaciones: t.value.trim() || null }, false);
      if (t.dataset.c === 'cuenta') {
        const v = t.value.includes(' — ') ? t.value.slice(t.value.lastIndexOf(' — ') + 3).trim() : t.value.trim();
        if (!v) return guardarLinea(l, { cuenta_id: null, cuenta_codigo: null }, false);
        const c = contables.find((x) => x.codigo === v) || contables.find((x) => x.codigo.replace(/\./g, '') === v.replace(/\./g, ''));
        if (!c) { t.value = v; ctx.pDet.querySelector('.tk-error').textContent = `La cuenta ${v} no es una cuenta de movimiento del catálogo de la empresa.`; t.focus(); return; }
        ctx.pDet.querySelector('.tk-error').textContent = '';
        return guardarLinea(l, { cuenta_id: c.id, cuenta_codigo: c.codigo }, true);
      }
    });
    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-accion=buscar]')) return;
      buscar = e.target.value;
      const pos = e.target.selectionStart;
      pintar();
      const b = ctx.pDet.querySelector('[data-accion=buscar]'); if (b) { b.focus(); b.setSelectionRange(pos, pos); }
    });
    cont.addEventListener('click', async (e) => {
      const ab = e.target.closest('[data-abrir]');
      if (ab) { const id = Number(ab.dataset.abrir); if (abiertas.has(id)) abiertas.delete(id); else abiertas.add(id); return pintar(); }
      const fl = e.target.closest('[data-filtro]');
      if (fl) { filtro = fl.dataset.filtro; return pintar(); }
      const b = e.target.closest('[data-accion]');
      if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return;
      const error = ctx.pDet.querySelector('.tk-error');
      if (b.dataset.accion === 'nueva') { carga = null; lineas = []; periodos = []; return pintar(); }
      if (b.dataset.accion === 'reversar-carga') {
        if (!confirm(`¿Quitar la carga ${carga.numero} con sus ${lineas.length} facturas? Las compras no se tocan.`)) return;
        const r = await sb.from('cargas_sat').delete().eq('id', carga.id);
        if (r.error) { error.textContent = window.UI.traducirError(r.error); return; }
        window.FIN.aviso(`Carga ${carga.numero} reversada`);
        return cargarLocalidad();
      }
      if (b.dataset.accion === 'generar' || b.dataset.accion === 'reversar') {
        const gen = b.dataset.accion === 'generar';
        const per = periodos.find((x) => x.id === carga.caja_periodo_id);
        if (!confirm(gen ? `¿Generar las facturas pendientes y clasificadas ${per ? `en la subcaja ${per.numero}` : 'como compras'}?` : '¿Reversar las facturas generadas por esta carga? Se quitan las compras o documentos de caja que no tengan partida, pagos ni liquidación.')) return;
        ocupado = true; pintar();
        const { data, error: er } = await sb.rpc(gen ? 'generar_facturas_sat' : 'reversar_facturas_sat', { p_carga: carga.id });
        ocupado = false;
        if (er) { pintar(); ctx.pDet.querySelector('.tk-error').textContent = window.UI.traducirError(er); return; }
        window.FIN.aviso(gen ? `${data.generadas} generadas${data.enlazadas ? `, ${data.enlazadas} ya existían` : ''}${data.omitidas ? `, ${data.omitidas} omitidas` : ''}${data.errores ? `, ${data.errores} con error` : ''}` : `${data.reversadas} reversadas${data.quedan ? `, ${data.quedan} no se pudieron reversar` : ''}`);
        if ((gen && (data.errores || data.omitidas)) || (!gen && data.quedan)) filtro = gen ? 'AVISOS' : 'GENERADAS';
        return cargarLocalidad(carga.id);
      }
    });
    iniciar();
  };
})();
