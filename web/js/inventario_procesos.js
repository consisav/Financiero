// Inventarios · Procesos (script 152):
//   Toma física: abre la fotografía de existencias de una bodega a una fecha de corte, se registra el conteo (ciego
//     si se quiere), se ven las diferencias valuadas al costo y, al cerrar, se generan y operan los ajustes de
//     sobrantes y faltantes. Acta de toma física con firmas en PDF o Excel.
//   Recalcular costo promedio: promedio ponderado perpetuo de cada producto (toda la empresa, sin traslados ni
//     cambios de lote) contra el costo del catálogo; se aplica a los productos elegidos y queda el historial.
//   Cierre de inventario: cierre mensual con la fotografía de saldos (libro de inventarios); un mes cerrado ya no
//     acepta movimientos. Se reabre con motivo.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const cant = (n) => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const r4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;
  const horaGt = (v) => (v ? new Date(v).toLocaleString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') : '');
  const kpi = (t, v, cls = '') => `<div class="ec-kpi ${cls}"><small>${t}</small><b>${v}</b></div>`;
  const empresaDe = (ctx) => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await hacer().range(i, i + 999);
      if (error) throw error;
      out.push(...(data || [])); if (!data || data.length < 1000) break;
    }
    return out;
  }
  const salida = (formato, cfg) => (formato === 'PDF' ? window.CUENTAS_XLSX.pdf(cfg) : window.REPORTE_XLSX.generar(cfg).catch((e) => window.FIN.aviso(e.message || 'No se pudo generar el Excel')));
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });

  // ===================== Toma física =====================
  window.PANTALLAS['toma-fisica'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Toma física de inventario', icono: 'ti-clipboard-check', clase: 'bk-movimientos bm-solo cx-rep pr-toma', grupo: 'Inventarios · Procesos' });
    const { sb } = ctx;
    const f = { estado: 'TODAS', vista: 'TODOS', buscar: '', formato: 'PDF' };
    let tomas = [], bodegas = [], productos = new Map(), actual = null, lineas = [], nueva = false;
    const bod = (id) => bodegas.find((b) => b.id === id);
    const ESTADO = { 'EN CONTEO': ['En conteo', 'pendiente'], CERRADA: ['Cerrada', 'aprobada'], ANULADA: ['Anulada', 'anulada'] };
    const marca = (e) => `<span class="pc-marca ${ESTADO[e]?.[1] || ''}">${ESTADO[e]?.[0] || e}</span>`;

    function pintarFiltros() {
      ctx.filtros(`<label class="campo"><span>Estado</span><select name="estado">${['TODAS', 'EN CONTEO', 'CERRADA', 'ANULADA'].map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label class="campo"><span>Toma</span><select name="toma">${tomas.map((t) => `<option value="${t.id}" ${actual?.id === t.id ? 'selected' : ''}>No. ${t.numero} · ${fmt.fechaDia(t.fecha_corte)} · ${esc(bod(t.bodega_id)?.nombre || '')} · ${ESTADO[t.estado]?.[0]}</option>`).join('') || '<option value="">Sin tomas</option>'}</select></label>`,
        `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva toma física</button>' : ''}`);
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const pr = await sb.from('tomas_fisicas').select('id').limit(1);
      if (pr.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/tomas_fisicas/.test(pr.error.message) ? 'Falta instalar el script 152 (procesos de inventario) en Supabase.' : esc(pr.error.message)}</p></section>`; return; }
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      if (!loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-clipboard-check'); return; }
      const [b, p] = await Promise.all([sb.from('bodegas').select('id, codigo, nombre, estado').eq('localidad_id', loc).order('codigo'),
        leerTodo(() => sb.from('productos').select('id, codigo, codigo_producto, nombre, precio_costo, estado').eq('localidad_id', loc).order('id'))]);
      bodegas = b.data || []; productos = new Map(p.map((x) => [x.id, x]));
      await consultar();
    }
    async function consultar(id = actual?.id) {
      let q = sb.from('tomas_fisicas').select('*').eq('localidad_id', ctx.sel.loc).order('numero', { ascending: false });
      if (f.estado !== 'TODAS') q = q.eq('estado', f.estado);
      const { data } = await q; tomas = data || [];
      await abrir(tomas.find((t) => t.id === id) || tomas[0] || null);
    }
    async function abrir(t) {
      actual = t; nueva = false; lineas = [];
      if (t) lineas = await leerTodo(() => sb.from('toma_fisica_lineas').select('*').eq('toma_id', t.id).order('id'));
      pintarFiltros(); pintar();
    }
    const visibles = () => { const q = f.buscar.trim().toLowerCase();
      return lineas.filter((l) => (f.vista === 'TODOS' || (f.vista === 'PENDIENTES' ? l.conteo == null : Number(l.diferencia) !== 0)) && (!q || [productos.get(l.producto_id)?.codigo_producto, productos.get(l.producto_id)?.nombre, l.lote, productos.get(l.producto_id)?.codigo].some((v) => String(v || '').toLowerCase().includes(q)))); };
    function totales() {
      const cont = lineas.filter((l) => l.conteo != null).length;
      const sob = lineas.filter((l) => Number(l.diferencia) > 0), fal = lineas.filter((l) => Number(l.diferencia) < 0);
      return { n: lineas.length, cont, pend: lineas.length - cont, sob: r2(sob.reduce((s, l) => s + Number(l.valor_diferencia), 0)), fal: r2(fal.reduce((s, l) => s + Number(l.valor_diferencia), 0)), nsob: sob.length, nfal: fal.length };
    }
    function pintar() {
      if (nueva) return pintarNueva();
      const t = actual;
      if (!t) { ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico"><p class="ck-elige"><i class="ti ti-clipboard-check" aria-hidden="true"></i> No hay tomas físicas${f.estado !== 'TODAS' ? ' con ese estado' : ''}.${ctx.admin ? ' Abre una con «Nueva toma física».' : ''}</p></div>`; return; }
      const enConteo = t.estado === 'EN CONTEO', ciego = t.conteo_ciego && enConteo, ed = ctx.admin && enConteo;
      const k = totales();
      const ls = visibles();
      ctx.pDet.innerHTML = `
        <div class="bm-form cx-form cl-clasico">
          <section class="pr-cab">
            <div class="pr-id"><small>Toma física</small><b>No. ${t.numero}</b>${marca(t.estado)}</div>
            <div class="pr-datos">
              <span><small>Bodega</small>${esc(bod(t.bodega_id) ? `${bod(t.bodega_id).codigo} · ${bod(t.bodega_id).nombre}` : '')}</span>
              <span><small>Fecha de corte</small>${esc(fmt.fechaDia(t.fecha_corte))}</span>
              <span><small>Responsable</small>${esc(t.responsable || '—')}</span>
              <span><small>Conteo</small>${t.conteo_ciego ? 'Ciego (sin ver el sistema)' : 'Con existencia del sistema'}</span>
              <span class="pr-desc"><small>Descripción</small>${esc(t.descripcion || '—')}</span>
              <span><small>Abrió</small>${esc(`${t.usuario || ''} · ${horaGt(t.creado_en)}`)}</span>
              ${t.cerrado_por ? `<span><small>Cerró</small>${esc(`${t.cerrado_por} · ${horaGt(t.cerrado_en)}`)}</span>` : ''}
              ${t.estado === 'ANULADA' ? `<span class="pc-rojo"><small>Anulada</small>${esc(`${t.anulado_por || ''}: ${t.motivo_anulacion || ''}`)}</span>` : ''}
            </div>
            <div class="pr-acc">
              ${ed ? `<button type="button" class="boton primario-sm" data-accion="cerrar"><i class="ti ti-lock-check" aria-hidden="true"></i> Cerrar y ajustar</button>
                <button type="button" class="boton secundario-sm" data-accion="anular"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>` : ''}
              <span class="iv-imp"><button type="button" class="boton secundario-sm" data-accion="acta"><i class="ti ti-printer" aria-hidden="true"></i> Acta</button><select name="formato">${['PDF', 'EXCEL'].map((x) => `<option ${f.formato === x ? 'selected' : ''}>${x}</option>`).join('')}</select></span>
            </div>
          </section>
          <div class="ec-kpis">${kpi('Productos / lotes', k.n)}${kpi('Contados', `${k.cont} de ${k.n}`, k.pend ? '' : 'ec-fin')}${kpi('Pendientes', k.pend, k.pend ? 'ec-alerta' : '')}
            ${ciego ? kpi('Diferencias', 'Al cerrar') : `${kpi(`Sobrantes (${k.nsob})`, `Q ${fmt.monto(k.sob)}`)}${kpi(`Faltantes (${k.nfal})`, `Q ${fmt.monto(k.fal)}`, k.nfal ? 'ec-alerta' : '')}${kpi('Diferencia neta', `Q ${fmt.monto(k.sob + k.fal)}`, 'ec-fin')}`}</div>
          <div class="pr-barra">
            <div class="iv-seg">${[['TODOS', 'Todos'], ['PENDIENTES', 'Pendientes'], ...(ciego ? [] : [['DIFERENCIAS', 'Con diferencia']])].map(([x, tx]) => `<label class="${f.vista === x ? 'activo' : ''}"><input type="radio" name="vista" value="${x}" ${f.vista === x ? 'checked' : ''}>${tx}</label>`).join('')}</div>
            <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar value="${esc(f.buscar)}" placeholder="Código, nombre o lote…"></label>
            ${ed ? `<span class="pr-agregar"><input list="pr-prods" data-agregar placeholder="Producto encontrado que no está en la lista…" autocomplete="off"><input data-agregar-lote placeholder="Lote" maxlength="40"><button type="button" class="boton secundario-sm" data-accion="agregar"><i class="ti ti-plus" aria-hidden="true"></i> Agregar</button></span>` : ''}
            <span class="pr-guardado tk-tenue" data-guardado></span>
          </div>
          <div class="pc-lineas cx-tabla iv-tabla pr-lineas"><table>
            <thead><tr><th class="num">#</th><th>Código</th><th>Producto</th><th>Lote</th><th>Vence</th>${ciego ? '' : '<th class="num">Sistema</th>'}<th class="num">Conteo físico</th>${ciego ? '' : '<th class="num">Diferencia</th>'}<th class="num">Costo</th>${ciego ? '' : '<th class="num">Valor diferencia</th>'}<th>Observaciones</th></tr></thead>
            <tbody>${ls.map((l) => { const p = productos.get(l.producto_id); const d = Number(l.diferencia); return `<tr data-l="${l.id}" class="${l.conteo == null ? 'pr-pend' : ''}">
              <td class="num tk-tenue">${p?.codigo ?? ''}</td><td class="fuerte">${esc(p?.codigo_producto || '')}</td><td class="iv-nom iv-prod" title="${esc(p?.nombre || '')}"><div>${esc(p?.nombre || '')}${l.agregada ? ' <span class="pc-marca pendiente">agregado</span>' : ''}</div></td>
              <td>${esc(l.lote || '—')}</td><td>${esc(fmt.fechaDia(l.fecha_vencimiento))}</td>${ciego ? '' : `<td class="num">${cant(l.existencia_sistema)}</td>`}
              <td class="num"><input type="number" min="0" step="0.0001" data-c="conteo" value="${l.conteo ?? ''}" ${ed ? '' : 'disabled'} aria-label="Conteo físico"></td>
              ${ciego ? '' : `<td class="num ${d > 0 ? 'kx-ent' : d < 0 ? 'pc-rojo' : 'tk-tenue'}">${l.conteo == null ? '—' : `${d > 0 ? '+' : ''}${cant(d)}`}</td>`}
              <td class="num">${fmt.monto(l.costo_unitario)}</td>${ciego ? '' : `<td class="num ${d < 0 ? 'pc-rojo' : ''}">${l.conteo == null || !d ? '' : fmt.monto(l.valor_diferencia)}</td>`}
              <td><input data-c="observaciones" value="${esc(l.observaciones || '')}" maxlength="200" ${ed ? '' : 'disabled'} aria-label="Observaciones"></td></tr>`; }).join('')
              || `<tr><td colspan="11" class="tk-vacio">${lineas.length ? 'Ningún producto con ese filtro.' : 'La bodega no tenía existencias a la fecha de corte: agrega lo que encuentres en el conteo.'}</td></tr>`}</tbody>
          </table></div>
          <datalist id="pr-prods">${[...productos.values()].filter((p) => p.estado === 'ACTIVO').map((p) => `<option value="${esc(`${p.nombre} — ${p.codigo_producto || p.codigo}`)}"></option>`).join('')}</datalist>
        </div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    function pintarNueva() {
      const hoy = fmt.hoy();
      ctx.pDet.innerHTML = `
        <form class="bm-form cx-form cl-clasico pr-nueva" novalidate>
          <div class="cl-banda">Nueva toma física</div>
          <div class="pr-nueva-c">
            <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Al abrir la toma se toma la <b>fotografía de existencias del sistema</b> por producto y lote en la bodega a la fecha de corte.
              Durante el conteo no deben registrarse movimientos en la bodega. Al cerrar, las diferencias se ajustan automáticamente (sobrantes y faltantes) con el motivo «TOMA FÍSICA».</p>
            <label class="campo"><span>Bodega *</span><select name="bodega">${bodegas.filter((b) => b.estado === 'ACTIVO').map((b) => `<option value="${b.id}">${b.codigo} · ${esc(b.nombre)}</option>`).join('')}</select></label>
            <label class="campo"><span>Fecha de corte *</span><input type="date" name="fecha" value="${hoy}" max="${hoy}"></label>
            <label class="campo"><span>Responsable del conteo</span><input name="responsable" maxlength="120" placeholder="Nombre de quien cuenta"></label>
            <label class="campo pr-desc"><span>Descripción</span><input name="descripcion" maxlength="200" placeholder="Ej.: Inventario físico de cierre anual"></label>
            <label class="pc-check"><input type="checkbox" name="ciego" checked> Conteo ciego (no mostrar la existencia del sistema mientras se cuenta)</label>
            <p class="modal-error tk-error" role="alert"></p>
            <div class="pr-nueva-acc"><button type="button" class="boton secundario-sm" data-accion="cancelar-nueva">Cancelar</button><button type="submit" class="boton primario-sm"><i class="ti ti-clipboard-plus" aria-hidden="true"></i> Abrir toma física</button></div>
          </div>
        </form>`;
    }
    let pendiente = 0;
    async function guardarLinea(tr) {
      const l = lineas.find((x) => String(x.id) === tr.dataset.l); if (!l) return;
      const c = tr.querySelector('[data-c=conteo]').value, o = tr.querySelector('[data-c=observaciones]').value;
      const datos = { conteo: c === '' ? null : Number(c), observaciones: o.trim() || null };
      const g = ctx.pDet.querySelector('[data-guardado]'); pendiente++; if (g) g.textContent = 'Guardando…';
      const { data, error } = await sb.from('toma_fisica_lineas').update(datos).eq('id', l.id).select('*').single();
      pendiente--;
      if (error) { if (g) g.textContent = ''; return window.FIN.aviso(window.UI.traducirError(error)); }
      Object.assign(l, data);
      if (!pendiente) { pintar(); const g2 = ctx.pDet.querySelector('[data-guardado]'); if (g2) g2.textContent = `Guardado ${new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`; }
    }
    async function agregar() {
      const t = ctx.pDet.querySelector('[data-agregar]').value.trim().toUpperCase(), lote = ctx.pDet.querySelector('[data-agregar-lote]').value.trim();
      const cod = t.includes(' — ') ? t.slice(t.lastIndexOf(' — ') + 3) : t;
      const p = [...productos.values()].find((x) => `${x.nombre} — ${x.codigo_producto || x.codigo}`.toUpperCase() === t || (x.codigo_producto || '').toUpperCase() === cod || String(x.codigo) === cod);
      if (!p) return window.FIN.aviso('Ese producto no está en el catálogo');
      const { error } = await sb.from('toma_fisica_lineas').insert({ toma_id: actual.id, producto_id: p.id, lote, existencia_sistema: 0, costo_unitario: Number(p.precio_costo) || 0, agregada: true });
      if (error) return window.FIN.aviso(/duplicate|unique/i.test(error.message) ? 'Ese producto y lote ya están en la toma' : window.UI.traducirError(error));
      await abrir(actual);
    }
    async function cerrar() {
      const k = totales();
      if (!confirm(`¿Cerrar la toma física ${actual.numero}?\n\n${k.pend ? `${k.pend} producto(s) sin contar se tomarán como iguales al sistema.\n` : ''}Se generarán y operarán los ajustes de sobrantes y faltantes con fecha ${fmt.fechaDia(actual.fecha_corte)}. Ya no se podrá modificar el conteo.`)) return;
      const { data, error } = await sb.rpc('cerrar_toma_fisica', { p_id: actual.id, p_sin_contar_iguales: true });
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      window.FIN.aviso(`Toma cerrada: ${data.sobrantes} sobrante(s) y ${data.faltantes} faltante(s) ajustados`);
      await consultar(actual.id);
    }
    function acta() {
      const t = actual, k = totales(), b = bod(t.bodega_id);
      const cerrada = t.estado === 'CERRADA';
      const columnas = [col('Código', 'texto', 12), col('Producto', 'texto', 44), col('Lote', 'texto', 13), col('Vence', 'texto', 11), col('Sistema', 'numero', 11), col('Conteo físico', 'numero', 12), col('Diferencia', 'numero', 11), col('Costo', 'monto', 12), col('Valor diferencia', 'monto', 15), col('Observaciones', 'texto', 28)];
      const filas = lineas.map((l) => { const p = productos.get(l.producto_id); return { valores: [p?.codigo_producto || String(p?.codigo ?? ''), p?.nombre || '', l.lote || '', fmt.fechaDia(l.fecha_vencimiento), r4(l.existencia_sistema), l.conteo == null ? '' : r4(l.conteo), l.conteo == null ? '' : r4(l.diferencia), r2(l.costo_unitario), l.conteo == null ? '' : r2(l.valor_diferencia), l.observaciones || ''] }; });
      filas.push({ valores: [`Total · ${k.n} producto(s) · sobrantes Q ${fmt.monto(k.sob)} · faltantes Q ${fmt.monto(k.fal)}`, '', '', '', '', '', '', '', r2(k.sob + k.fal), ''], tipo: 'total' });
      const cfg = { titulo: `Acta de toma física de inventario No. ${t.numero}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Toma fisica', archivo: `toma_fisica_${t.numero}`, columnas, filas,
        parametros: [`Empresa: ${empresaDe(ctx)}`, `Bodega: ${b ? `${b.codigo} · ${b.nombre}` : ''}`, `Fecha de corte: ${fmt.fechaDia(t.fecha_corte)}`, `Estado: ${ESTADO[t.estado]?.[0]}`, `Responsable: ${t.responsable || '—'}`, ...(cerrada ? [`Cerró: ${t.cerrado_por} · ${horaGt(t.cerrado_en)}`] : [])] };
      if (f.formato === 'PDF') {
        cfg.filas.push({ valores: ['Los firmantes hacen constar que el conteo físico se realizó en la fecha y bodega indicadas y que las diferencias anotadas son las encontradas.'], tipo: 'nota' });
        cfg.firmas = [`Responsable del conteo${t.responsable ? `: ${t.responsable}` : ''}`, 'Encargado de bodega', 'Contador / Auditor'];
      }
      salida(f.formato, cfg);
    }
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (e.target.name === 'estado') { f.estado = e.target.value; return consultar(null); }
      if (e.target.name === 'toma') return abrir(tomas.find((t) => String(t.id) === e.target.value) || null);
      if (e.target.name === 'formato') { f.formato = e.target.value; return; }
      if (e.target.name === 'vista') { f.vista = e.target.value; return pintar(); }
      if (e.target.dataset.c) return guardarLinea(e.target.closest('tr[data-l]'));
    });
    cont.addEventListener('input', (e) => { if (e.target.matches('[data-buscar]')) { f.buscar = e.target.value; pintar(); const i = ctx.pDet.querySelector('[data-buscar]'); i?.focus(); i?.setSelectionRange(i.value.length, i.value.length); } });
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.dataset.c === 'conteo') { e.preventDefault(); const ins = [...ctx.pDet.querySelectorAll('[data-c=conteo]')]; const i = ins.indexOf(e.target); e.target.blur(); setTimeout(() => ctx.pDet.querySelectorAll('[data-c=conteo]')[i + 1]?.focus(), 250); }
    });
    cont.addEventListener('submit', async (e) => {
      if (!e.target.matches('.pr-nueva')) return; e.preventDefault();
      const el = e.target.elements, err = e.target.querySelector('.modal-error');
      const { data, error } = await sb.rpc('crear_toma_fisica', { p_bodega: Number(el.bodega.value), p_fecha: el.fecha.value, p_descripcion: el.descripcion.value, p_ciego: el.ciego.checked, p_responsable: el.responsable.value });
      if (error) { err.textContent = window.UI.traducirError(error); return; }
      window.FIN.aviso('Toma física abierta: registra el conteo');
      f.estado = 'TODAS'; await consultar(data);
    });
    cont.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'nueva') { nueva = true; return pintar(); }
      if (a === 'cancelar-nueva') { nueva = false; return pintar(); }
      if (a === 'agregar') return agregar();
      if (a === 'cerrar') return cerrar();
      if (a === 'acta') return acta();
      if (a === 'anular') { const m = prompt(`Motivo de la anulación de la toma ${actual.numero}:`); if (!m) return; const { error } = await sb.rpc('anular_toma_fisica', { p_id: actual.id, p_motivo: m }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); return consultar(actual.id); }
    });
    iniciar();
  };

  // ===================== Recalcular costo promedio =====================
  window.PANTALLAS['recalcular-costo-promedio'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Recalcular costo promedio', icono: 'ti-calculator', clase: 'bk-movimientos bm-solo cx-rep pr-costo', grupo: 'Inventarios · Procesos' });
    const { sb } = ctx;
    const f = { fecha: fmt.hoy(), mostrar: 'DIF', buscar: '', formato: 'PDF' };
    let productos = [], calc = new Map(), ultimo = new Map(), elegidos = new Set();
    // Movimientos que no cambian el costo de la empresa: traslados y cambios de lote (salen y entran al mismo costo).
    const NEUTROS = new Set([3, 4, 9, 10, 40, 41, 43, 44, 45, 46]);
    function pintarFiltros() {
      ctx.filtros(`<label class="campo"><span>Fecha de corte</span><input type="date" name="fecha" value="${f.fecha}" max="${fmt.hoy()}"></label>
        <label class="campo"><span>Mostrar</span><select name="mostrar">${[['DIF', 'CON DIFERENCIA MAYOR A 1 %'], ['EXIS', 'CON EXISTENCIA'], ['TODOS', 'TODOS LOS CALCULADOS']].map(([x, t]) => `<option value="${x}" ${f.mostrar === x ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo cx-prov"><span>Producto</span><input type="search" name="buscar" value="${esc(f.buscar)}" placeholder="Código o nombre" autocomplete="off"></label>`,
        `${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="aplicar"><i class="ti ti-check" aria-hidden="true"></i> Aplicar a los marcados</button>' : ''}
         <button type="button" class="boton secundario-sm" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button><button type="button" class="boton secundario-sm" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>`);
    }
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargarLocalidad(); }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      if (!loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-calculator'); return; }
      pintarFiltros();
      ctx.pDet.innerHTML = '<p class="vacio">Calculando el costo promedio de los movimientos…</p>';
      try {
        const [p, mv, h] = await Promise.all([
          leerTodo(() => sb.from('productos').select('id, codigo, codigo_producto, nombre, precio_costo, estado').eq('localidad_id', loc).order('id')),
          leerTodo(() => sb.from('inventario_movimientos').select('producto_id, fecha, cantidad, costo_unitario, tipo_movimiento, origen').eq('localidad_id', loc).lte('fecha', f.fecha).order('fecha').order('id')),
          sb.from('historial_costo_promedio').select('producto_id, costo_nuevo, fecha_corte, creado_en, usuario').eq('localidad_id', loc).order('creado_en', { ascending: false }).limit(2000)
        ]);
        productos = p; ultimo = new Map(); (h.data || []).forEach((x) => { if (!ultimo.has(x.producto_id)) ultimo.set(x.producto_id, x); });
        // Promedio ponderado perpetuo: cada entrada con costo mueve el promedio; las salidas salen al promedio.
        calc = new Map();
        mv.forEach((m) => {
          if (m.origen === 'TRASLADO' || NEUTROS.has(m.tipo_movimiento)) return;
          const c = Number(m.cantidad), cu = Number(m.costo_unitario) || 0;
          const a = calc.get(m.producto_id) || { q: 0, v: 0, prom: 0, n: 0 };
          if (c > 0) { a.v += c * (cu > 0 ? cu : a.prom); a.q += c; a.prom = a.q > 0 ? a.v / a.q : (cu || a.prom); a.n++; }
          else if (c < 0) { a.q += c; a.v = a.q * a.prom; }
          calc.set(m.producto_id, a);
        });
        elegidos = new Set(); // Se revisa y se marca a mano (o «marcar todos») antes de aplicar.
      } catch (e) { ctx.pDet.innerHTML = `<p class="vacio">${esc(window.UI.traducirError(e))}</p>`; return; }
      pintar();
    }
    function filas() {
      const q = f.buscar.trim().toLowerCase();
      return productos.map((p) => { const a = calc.get(p.id); if (!a || !a.n) return null; const prom = r4(a.prom), cat = Number(p.precio_costo) || 0;
        return { p, a, prom, cat, ex: r4(a.q), valor: r2(Math.max(a.q, 0) * prom), dif: cat ? ((prom - cat) / cat) * 100 : (prom ? 100 : null) }; })
        .filter(Boolean).filter((x) => (!q || [x.p.codigo, x.p.codigo_producto, x.p.nombre].some((v) => String(v || '').toLowerCase().includes(q))) && (f.mostrar === 'TODOS' || (f.mostrar === 'EXIS' ? x.ex > 0 : x.dif !== null && Math.abs(x.dif) > 1)))
        .sort((a, b) => Math.abs(b.dif ?? 0) - Math.abs(a.dif ?? 0));
    }
    function pintar() {
      const rs = filas();
      const vProm = rs.reduce((s, x) => s + x.valor, 0), vCat = rs.reduce((s, x) => s + Math.max(x.ex, 0) * x.cat, 0);
      ctx.pDet.innerHTML = `
        <div class="bm-form cx-form cl-clasico">
          <div class="cl-banda">Costo promedio ponderado al ${esc(fmt.fechaDia(f.fecha))} · ${esc(empresaDe(ctx))}</div>
          <div class="ec-kpis">${kpi('Productos', rs.length)}${kpi('Marcados para aplicar', elegidos.size, elegidos.size ? 'ec-fin' : '')}${kpi('Inventario al promedio', `Q ${fmt.monto(vProm)}`)}${kpi('Inventario al catálogo', `Q ${fmt.monto(vCat)}`)}${kpi('Diferencia', `Q ${fmt.monto(vProm - vCat)}`, Math.abs(vProm - vCat) > 0.5 ? 'ec-alerta' : '')}</div>
          <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Promedio ponderado perpetuo (art. 55 de la Ley de Actualización Tributaria, Decreto 10-2012): cada entrada con costo recalcula el promedio y las salidas salen al promedio vigente; los traslados entre bodegas y los cambios de lote no lo afectan. Al aplicar, el costo del catálogo de los productos marcados pasa a ser el promedio y queda el historial.</p>
          <div class="pc-lineas cx-tabla iv-tabla"><table>
            <thead><tr><th class="cc-det"><input type="checkbox" data-todos ${rs.length && rs.every((x) => elegidos.has(x.p.id)) ? 'checked' : ''} aria-label="Marcar todos"></th><th class="num">ID</th><th>Código</th><th>Producto</th><th class="num">Existencia</th><th class="num">Entradas con costo</th><th class="num">Costo catálogo</th><th class="num">Costo promedio</th><th class="num">Diferencia</th><th class="num">Valor al promedio</th><th>Último aplicado</th></tr></thead>
            <tbody>${rs.map((x) => { const u = ultimo.get(x.p.id); return `<tr><td class="cc-det"><input type="checkbox" data-p="${x.p.id}" ${elegidos.has(x.p.id) ? 'checked' : ''} ${ctx.admin ? '' : 'disabled'}></td><td class="num tk-tenue">${x.p.codigo}</td><td class="fuerte">${esc(x.p.codigo_producto || '')}</td><td class="iv-nom iv-prod" title="${esc(x.p.nombre)}"><div>${esc(x.p.nombre)}</div></td>
              <td class="num">${cant(x.ex)}</td><td class="num tk-tenue">${x.a.n}</td><td class="num">${fmt.monto(x.cat)}</td><td class="num fuerte">${fmt.monto(x.prom)}</td>
              <td class="num ${x.dif === null ? 'tk-tenue' : Math.abs(x.dif) > 1 ? 'pc-rojo' : 'kx-ent'}">${x.dif === null ? '—' : `${x.dif >= 0 ? '+' : ''}${x.dif.toFixed(1)} %`}</td><td class="num">${fmt.monto(x.valor)}</td>
              <td class="tk-tenue">${u ? esc(`${fmt.monto(u.costo_nuevo)} · ${fmt.fechaDia(u.fecha_corte)} · ${u.usuario || ''}`) : '—'}</td></tr>`; }).join('')
              || '<tr><td colspan="11" class="tk-vacio">Ningún producto con esos parámetros.</td></tr>'}</tbody>
          </table></div>
        </div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    async function aplicar() {
      const rs = filas().filter((x) => elegidos.has(x.p.id) && x.prom > 0);
      if (!rs.length) return window.FIN.aviso('Marca los productos a los que se aplica el costo promedio');
      if (!confirm(`¿Aplicar el costo promedio al ${fmt.fechaDia(f.fecha)} como costo del catálogo de ${rs.length} producto(s)?`)) return;
      const { data, error } = await sb.rpc('aplicar_costo_promedio', { p_localidad: ctx.sel.loc, p_fecha: f.fecha, p_datos: rs.map((x) => ({ producto_id: x.p.id, costo: x.prom, existencia: x.ex, valor: x.valor })) });
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      window.FIN.aviso(`${data} costo(s) actualizado(s)`);
      await cargarLocalidad();
    }
    function exportar(formato) {
      const rs = filas(); if (!rs.length) return window.FIN.aviso('No hay productos con esos parámetros');
      salida(formato, { titulo: 'Costo promedio ponderado', orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Costo promedio', archivo: `costo_promedio_${f.fecha}`,
        parametros: [`Empresa: ${empresaDe(ctx)}`, `Fecha de corte: ${fmt.fechaDia(f.fecha)}`, 'Método: promedio ponderado perpetuo', `Mostrar: ${f.mostrar === 'DIF' ? 'con diferencia mayor a 1 %' : f.mostrar === 'EXIS' ? 'con existencia' : 'todos'}`],
        columnas: [col('ID', 'texto', 7), col('Código', 'texto', 12), col('Producto', 'texto', 44), col('Existencia', 'numero', 12), col('Costo catálogo', 'monto', 14), col('Costo promedio', 'monto', 14), col('Diferencia %', 'numero', 12), col('Valor al promedio', 'monto', 16)],
        filas: [...rs.map((x) => ({ valores: [String(x.p.codigo), x.p.codigo_producto || '', x.p.nombre, x.ex, r4(x.cat), r4(x.prom), x.dif === null ? '' : r2(x.dif), x.valor] })), { valores: [`Total · ${rs.length} producto(s)`, '', '', '', '', '', '', r2(rs.reduce((s, x) => s + x.valor, 0))], tipo: 'total' }] });
    }
    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (e.target.matches('[data-todos]')) { filas().forEach((x) => (e.target.checked ? elegidos.add(x.p.id) : elegidos.delete(x.p.id))); return pintar(); }
      if (e.target.dataset.p) { const id = Number(e.target.dataset.p); if (e.target.checked) elegidos.add(id); else elegidos.delete(id); return pintar(); }
      if (cambio !== 'otro') return;
      const n = e.target.name; if (!n || !(n in f)) return; f[n] = e.target.value;
      return n === 'fecha' ? cargarLocalidad() : pintar();
    });
    cont.addEventListener('input', (e) => { if (e.target.name === 'buscar') { f.buscar = e.target.value; pintar(); ctx.pFil.querySelector('[name=buscar]')?.focus(); } });
    cont.addEventListener('click', (e) => { const a = e.target.closest('[data-accion]')?.dataset.accion; if (a === 'aplicar') return aplicar(); if (a === 'pdf') return exportar('PDF'); if (a === 'excel') return exportar('EXCEL'); });
    iniciar();
  };

  // ===================== Cierre de inventario =====================
  window.PANTALLAS['cierre-de-inventario'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Cierre de inventario', icono: 'ti-lock', clase: 'bk-movimientos bm-solo cx-rep pr-cierre', grupo: 'Inventarios · Procesos' });
    const { sb } = ctx;
    const hoy = fmt.hoy();
    const f = { anio: Number(hoy.slice(0, 4)), formato: 'PDF' };
    let cierres = [], productos = new Map(), bodegas = new Map();
    function pintarFiltros() {
      ctx.filtros(`<label class="campo cx-anio"><span>Año</span><input type="number" name="anio" min="2000" max="2999" value="${f.anio}"></label>
        <label class="campo"><span>Formato del libro</span><select name="formato">${['PDF', 'EXCEL'].map((x) => `<option ${f.formato === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`, '');
    }
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargarLocalidad(); }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      if (!loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-lock'); return; }
      pintarFiltros();
      const [p, b] = await Promise.all([leerTodo(() => sb.from('productos').select('id, codigo, codigo_producto, nombre').eq('localidad_id', loc).order('id')), sb.from('bodegas').select('id, codigo, nombre').eq('localidad_id', loc)]);
      productos = new Map(p.map((x) => [x.id, x])); bodegas = new Map((b.data || []).map((x) => [x.id, x]));
      await consultar();
    }
    async function consultar() {
      const { data, error } = await sb.from('cierres_inventario').select('*').eq('localidad_id', ctx.sel.loc).order('anio').order('mes');
      if (error) { ctx.pDet.innerHTML = `<p class="vacio">${/cierres_inventario/.test(error.message) ? 'Falta instalar el script 152 (procesos de inventario) en Supabase.' : esc(error.message)}</p>`; return; }
      cierres = data || []; pintar();
    }
    function pintar() {
      const ult = cierres.filter((c) => c.estado === 'CERRADO').sort((a, b) => b.fecha_cierre.localeCompare(a.fecha_cierre))[0];
      const delAnio = cierres.filter((c) => c.anio === f.anio);
      ctx.pDet.innerHTML = `
        <div class="bm-form cx-form cl-clasico">
          <div class="cl-banda">Cierres de inventario ${f.anio} · ${esc(empresaDe(ctx))}</div>
          <div class="ec-kpis">${kpi('Inventario cerrado al', ult ? fmt.fechaDia(ult.fecha_cierre) : 'Sin cierres', ult ? 'ec-fin' : '')}${kpi('Valor del último cierre', ult ? `Q ${fmt.monto(ult.valor_total)}` : '—')}${kpi('Productos', ult ? ult.productos : '—')}${kpi(`Meses cerrados ${f.anio}`, delAnio.filter((c) => c.estado === 'CERRADO').length)}</div>
          <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> El cierre guarda los saldos por producto y bodega valuados al costo del catálogo (recalcula el costo promedio antes de cerrar) y ya no permite registrar, cambiar ni borrar movimientos con fecha del mes cerrado. El cierre de diciembre es el inventario anual del libro de inventarios (Código de Comercio, art. 368). Un mes se reabre con motivo y solo si los meses posteriores están abiertos.</p>
          <div class="pr-meses">${MESES.map((nom, i) => {
            const mes = i + 1, c = delAnio.find((x) => x.mes === mes); const fin = new Date(f.anio, mes, 0).toLocaleDateString('en-CA'); const termino = fin < hoy;
            const est = c?.estado === 'CERRADO' ? 'cerrado' : c?.estado === 'REABIERTO' ? 'reabierto' : termino ? 'abierto' : 'curso';
            return `<article class="pr-mes pr-${est}">
              <header><b>${nom}</b><span>${{ cerrado: '<i class="ti ti-lock"></i> Cerrado', reabierto: '<i class="ti ti-lock-open"></i> Reabierto', abierto: '<i class="ti ti-lock-open-2"></i> Abierto', curso: 'En curso' }[est]}</span></header>
              ${c?.estado === 'CERRADO' ? `<div class="pr-mes-v"><small>Valor</small><b>Q ${fmt.monto(c.valor_total)}</b><small>${c.productos} producto(s) · ${esc(c.cerrado_por || '')} · ${esc(fmt.fechaDia(String(c.cerrado_en).slice(0, 10)))}</small></div>`
                : c?.estado === 'REABIERTO' ? `<div class="pr-mes-v"><small>Reabierto por ${esc(c.reabierto_por || '')}</small><small>${esc(c.motivo_reapertura || '')}</small></div>` : `<div class="pr-mes-v"><small>${termino ? `Al ${fmt.fechaDia(fin)}` : 'El mes no ha terminado'}</small></div>`}
              <footer>${ctx.admin && termino && c?.estado !== 'CERRADO' ? `<button type="button" class="boton primario-sm" data-cerrar="${mes}"><i class="ti ti-lock" aria-hidden="true"></i> Cerrar</button>` : ''}
                ${c?.estado === 'CERRADO' ? `<button type="button" class="boton secundario-sm" data-libro="${c.id}"><i class="ti ti-book" aria-hidden="true"></i> Libro</button>${ctx.admin ? `<button type="button" class="boton secundario-sm" data-reabrir="${c.id}"><i class="ti ti-lock-open" aria-hidden="true"></i> Reabrir</button>` : ''}` : ''}</footer>
            </article>`; }).join('')}</div>
        </div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    async function cerrarMes(mes) {
      const ant = cierres.find((c) => c.anio === (mes === 1 ? f.anio - 1 : f.anio) && c.mes === (mes === 1 ? 12 : mes - 1));
      if (!confirm(`¿Cerrar el inventario de ${MESES[mes - 1]} ${f.anio}?${ant?.estado === 'CERRADO' || cierres.length === 0 ? '' : '\n\nEl mes anterior no está cerrado.'}\n\nSe guardarán los saldos por producto y bodega y ya no se aceptarán movimientos con fecha de ese mes o anterior.`)) return;
      const { data, error } = await sb.rpc('cerrar_inventario', { p_localidad: ctx.sel.loc, p_anio: f.anio, p_mes: mes });
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      window.FIN.aviso(`${MESES[mes - 1]} cerrado: ${data.productos} producto(s) · Q ${fmt.monto(data.valor)}`);
      await consultar();
    }
    async function libro(id) {
      const c = cierres.find((x) => x.id === id);
      let s;
      try { s = await leerTodo(() => sb.from('cierre_inventario_saldos').select('producto_id, bodega_id, existencia, costo_promedio, valor').eq('cierre_id', id).order('id')); } catch (e) { return window.FIN.aviso(window.UI.traducirError(e)); }
      const g = new Map(); s.forEach((x) => { const a = g.get(x.bodega_id) || []; a.push(x); g.set(x.bodega_id, a); });
      const filas = [];
      [...g.entries()].sort((a, b) => (bodegas.get(a[0])?.codigo || 0) - (bodegas.get(b[0])?.codigo || 0)).forEach(([bid, xs]) => {
        const b = bodegas.get(bid); filas.push({ valores: [`Bodega ${b ? `${b.codigo} · ${b.nombre}` : bid}`], tipo: 'grupo', combinar: true });
        xs.sort((a, b2) => String(productos.get(a.producto_id)?.nombre).localeCompare(String(productos.get(b2.producto_id)?.nombre))).forEach((x) => { const p = productos.get(x.producto_id); filas.push({ valores: [p?.codigo_producto || String(p?.codigo ?? ''), p?.nombre || '', r4(x.existencia), r4(x.costo_promedio), r2(x.valor)] }); });
        filas.push({ valores: [`Subtotal (${xs.length})`, '', r4(xs.reduce((t, x) => t + Number(x.existencia), 0)), '', r2(xs.reduce((t, x) => t + Number(x.valor), 0))], tipo: 'subtotal' });
      });
      filas.push({ valores: [`Total del inventario al ${fmt.fechaDia(c.fecha_cierre)}`, '', r4(c.existencia_total), '', r2(c.valor_total)], tipo: 'total' });
      salida(f.formato, { titulo: `Libro de inventarios · ${MESES[c.mes - 1]} ${c.anio}`, orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Libro de inventarios', archivo: `libro_inventarios_${c.anio}_${String(c.mes).padStart(2, '0')}`,
        parametros: [`Empresa: ${empresaDe(ctx)}`, `Inventario al ${fmt.fechaDia(c.fecha_cierre)}`, 'Valuación: costo promedio ponderado', `Cerró: ${c.cerrado_por || ''} · ${horaGt(c.cerrado_en)}`],
        columnas: [col('Código', 'texto', 13), col('Producto', 'texto', 50), col('Existencia', 'numero', 13), col('Costo unitario', 'monto', 14), col('Valor Q', 'monto', 16)], filas, firmas: ['Representante legal', 'Contador'] });
    }
    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (e.target.name === 'anio') { f.anio = Number(e.target.value) || f.anio; return pintar(); }
      if (e.target.name === 'formato') f.formato = e.target.value;
    });
    cont.addEventListener('click', async (e) => {
      const ce = e.target.closest('[data-cerrar]'); if (ce) return cerrarMes(Number(ce.dataset.cerrar));
      const li = e.target.closest('[data-libro]'); if (li) return libro(Number(li.dataset.libro));
      const re = e.target.closest('[data-reabrir]');
      if (re) { const m = prompt('Motivo de la reapertura del mes:'); if (!m) return; const { error } = await sb.rpc('reabrir_inventario', { p_id: Number(re.dataset.reabrir), p_motivo: m }); if (error) return window.FIN.aviso(window.UI.traducirError(error)); window.FIN.aviso('Mes reabierto'); return consultar(); }
    });
    iniciar();
  };
})();
