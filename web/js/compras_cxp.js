// Compras · Registros · Regularización anticipos y Cuentas x Pagar.
//   Regularización anticipos: los anticipos a proveedores (cheques o notas de débito cargados a la
//   cuenta de anticipo) se liquidan contra compras por pagar; al procesar se genera la póliza con la
//   fecha final (debe cuenta a operar, haber cuenta de anticipo). Reversar anula la póliza.
//   Cuentas x Pagar (grupo Procesos): Consolidado CXP mensual, Consolidado general y CXP por periodo (saldo a una
//   fecha), con resumen por proveedor, estado de cuenta e impresión en PDF o Excel.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const TIPO_MOV = { CHEQUE: 'CHEQUE', NOTA_DEBITO: 'NOTA DÉBITO' };
  const docTxt = (c) => `${c.serie ? `${c.serie}-` : ''}${c.documento || ''}`;
  const empresaTxt = (ctx) => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
  const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
  const faltaScript = (ctx, err) => { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/regulariza|compra_abonos|anticipos_disponibles/.test(err.message) ? 'Falta instalar el script 64 (regularización de anticipos y cuentas por pagar) en Supabase.' : esc(err.message)}</p></section>`; };

  // ===================== Regularización anticipos =====================
  window.PANTALLAS['regularizacion-anticipos'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Regularización anticipos', icono: 'ti-arrows-exchange', clase: 'bk-movimientos rg-regulariza', grupo: 'Compras · Registros' });
    const { sb } = ctx;
    let lista = [], contables = [], cuentasBan = [], compras = [];
    let actual = null, editando = false;
    let anticipos = [], documentos = [];
    let partida = null;
    const cuenta = (id) => contables.find((x) => x.id === id);
    const porCodigo = (cod) => contables.find((x) => x.codigo === String(cod || '').trim() && x.movimiento);
    const compra = (id) => compras.find((c) => c.id === id);
    const totAnt = () => fmt.redondear(anticipos.reduce((t, a) => t + Number(a.valor || 0), 0));
    const totDoc = () => fmt.redondear(documentos.reduce((t, d) => t + Number(d.valor || 0), 0));
    const editable = () => ctx.admin && (!actual || (editando && actual.estado === 'VIGENTE'));

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Regularización</span><select name="reg">${lista.map((r) => `<option value="${r.id}" ${actual?.id === r.id ? 'selected' : ''}>${r.numero} · ${esc(fmt.fechaDia(r.fecha_inicial))} al ${esc(fmt.fechaDia(r.fecha_final))} · ${r.estado}</option>`).join('') || '<option value="">Sin regularizaciones</option>'}${!actual && editando ? '<option value="" selected>Nueva regularización</option>' : ''}</select></label>
        <div class="cf-barra" data-barra></div>`);
      pintarBarra();
    }
    function pintarBarra() {
      const b = ctx.pFil.querySelector('[data-barra]');
      if (!b) return;
      const ed = editable();
      b.innerHTML = ed
        ? `<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button><button type="submit" form="rg-form" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${actual ? 'Guardar' : 'Registrar'}</button>`
        : `${ctx.admin ? '<button type="button" class="boton secundario-sm" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva</button>' : ''}
           ${ctx.admin && actual?.estado === 'VIGENTE' ? '<button type="button" class="boton secundario-sm" data-accion="anular"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button><button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}`;
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('regularizaciones_anticipo').select('id').limit(1);
      if (prueba.error) return faltaScript(ctx, prueba.error);
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      [contables, cuentasBan] = await Promise.all([ctx.cuentasContables(), ctx.cuentasBancarias()]);
      const { data } = loc ? await sb.from('compras_saldo').select('id, numero, serie, documento, fecha_documento, proveedor_nombre, proveedor_codigo, descripcion, neto, pendiente, estado, moneda_id').eq('localidad_id', loc).order('numero', { ascending: false }).limit(3000) : { data: [] };
      compras = data || [];
      editando = false;
      await consultar(null);
    }
    async function consultar(id = actual?.id) {
      const { data } = ctx.sel.loc ? await sb.from('regularizaciones_anticipo').select('*').eq('localidad_id', ctx.sel.loc).order('numero', { ascending: false }) : { data: [] };
      lista = data || [];
      await abrir(lista.find((r) => r.id === id) || lista[0] || null);
    }
    async function abrir(r) {
      actual = r; editando = false; anticipos = []; documentos = []; partida = null;
      if (r) {
        const [a, d, p] = await Promise.all([
          sb.from('regularizacion_anticipos').select('*, movimientos_bancarios(id, cuenta_bancaria_id, tipo, numero_documento, folio, fecha, descripcion)').eq('regularizacion_id', r.id).order('linea'),
          sb.from('regularizacion_documentos').select('*').eq('regularizacion_id', r.id).order('linea'),
          r.partida_id ? sb.from('partidas').select('id, anio, mes, numero, estado').eq('id', r.partida_id).maybeSingle() : { data: null }
        ]);
        anticipos = (a.data || []).map((x) => { const m = x.movimientos_bancarios || {}; return { movimiento_id: x.movimiento_id, cuenta_bancaria_id: m.cuenta_bancaria_id, tipo: m.tipo, numero: m.numero_documento || String(m.folio || ''), fecha: m.fecha, valor: Number(x.valor), descripcion: x.descripcion || m.descripcion || '' }; });
        documentos = (d.data || []).map((x) => ({ compra_id: x.compra_id, valor: Number(x.valor), descripcion: x.descripcion || '' }));
        partida = p.data;
      }
      pintarFiltros();
      pintarDetalle();
    }
    function nuevoValor() {
      const ult = lista[0];
      const [y, m] = fmt.hoy().split('-');
      return { fecha_inicial: `${y}-${m}-01`, fecha_final: fmt.hoy(), tipo: 'CTA POR PAGAR',
        cuenta_anticipo_id: ult?.cuenta_anticipo_id || contables.find((x) => x.movimiento && /ANTICIPO/i.test(x.nombre))?.id || null,
        cuenta_operar_id: ult?.cuenta_operar_id || contables.find((x) => x.movimiento && /(PAGAR|PROVEEDOR)/i.test(x.nombre))?.id || null, observaciones: '' };
    }

    function pintarDetalle(v0) {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-arrows-exchange'); return; }
      const r = actual;
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      if (!r && !ed) { ctx.pDet.innerHTML = ctx.vacio(`No hay regularizaciones de anticipos${ctx.admin ? ': crea una con «Nueva»' : ''}.`, 'ti-arrows-exchange'); return; }
      const v = v0 || (r ? { ...r } : nuevoValor());
      const ca = cuenta(v.cuenta_anticipo_id), co = cuenta(v.cuenta_operar_id);
      const estado = r ? r.estado : 'VIGENTE';
      const cuadra = totAnt() === totDoc();
      const vacias = (n, cols) => Array.from({ length: Math.max(0, n) }, () => `<tr class="rg-vacia">${'<td></td>'.repeat(cols)}</tr>`).join('');
      ctx.pDet.innerHTML = `
        <form id="rg-form" class="tk-form ta-form bm-form rg-form cl-clasico" novalidate>
          <div class="cl-banda">Regularización anticipos</div>
          <section class="rg-cab">
            <div class="rg-g">
              <div class="campo rg-num"><span>Partida</span><b>${r ? r.numero : 'Nueva'}</b></div>
              <label class="campo"><span>Fecha inicial *</span><input type="date" name="fecha_inicial" value="${esc(v.fecha_inicial || '')}" ${dis}></label>
              <label class="campo"><span>Fecha final *</span><input type="date" name="fecha_final" value="${esc(v.fecha_final || '')}" ${dis}></label>
              <div class="rg-acc">${ed ? '<button type="button" class="boton secundario-sm" data-accion="obtener" title="Trae los cheques y notas de débito con cargo a la cuenta de anticipo en el rango de fechas"><i class="ti ti-download" aria-hidden="true"></i> Obtener documentos</button>' : ''}</div>

              <div class="campo"><span>Estado</span><span class="pc-marca ${{ VIGENTE: 'pendiente', OPERADA: 'definitiva', ANULADA: 'anulada' }[estado]}">${estado.charAt(0) + estado.slice(1).toLowerCase()}</span></div>
              <label class="campo rg-cta"><span>Cuenta anticipo *</span><div class="rg-par"><input list="rg-cuentas" name="cuenta_anticipo" value="${esc(ca ? ca.codigo : '')}" ${dis}><input value="${esc(ca ? ca.nombre : '')}" data-nombre="cuenta_anticipo" disabled aria-label="Nombre de la cuenta de anticipo"></div></label>
              <div class="rg-acc">${ctx.admin && r && !editando ? `<button type="button" class="boton secundario-sm" data-accion="PROCESAR" ${estado === 'VIGENTE' ? '' : 'disabled'}><i class="ti ti-player-play" aria-hidden="true"></i> Procesar</button><button type="button" class="boton secundario-sm" data-accion="REVERSAR" ${estado === 'OPERADA' ? '' : 'disabled'}><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Reversar</button>` : ''}</div>

              <label class="campo"><span>Tipo</span><select name="tipo" ${dis}><option>CTA POR PAGAR</option></select></label>
              <label class="campo rg-cta"><span>Cuenta a operar *</span><div class="rg-par"><input list="rg-cuentas" name="cuenta_operar" value="${esc(co ? co.codigo : '')}" ${dis}><input value="${esc(co ? co.nombre : '')}" data-nombre="cuenta_operar" disabled aria-label="Nombre de la cuenta a operar"></div></label>
              <div class="rg-acc rg-poliza"><div class="campo"><span>Póliza</span><b class="${partida?.estado === 'ANULADA' ? 'pc-rojo' : ''}">${partida ? `${partida.mes}-${partida.numero}` : '—'}</b></div>${partida ? '<button type="button" class="boton secundario-sm" data-accion="ver-poliza"><i class="ti ti-eye" aria-hidden="true"></i> Ver</button>' : ''}${r ? '<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>' : ''}</div>
            </div>
            <div class="rg-pie">
              <label class="campo rg-obs"><span>Observaciones</span><input name="observaciones" value="${esc(v.observaciones || '')}" maxlength="200" ${dis}></label>
              <p class="rg-nota">* La póliza contable se genera con base a la fecha final.${r?.operado_por ? ` Operó ${esc(r.operado_por)} · ${esc(fmt.fechaHora(r.operado_en))}.` : ''}${r?.reversado_por ? ` Reversó ${esc(r.reversado_por)} · ${esc(fmt.fechaHora(r.reversado_en))}.` : ''}</p>
            </div>
          </section>
          <p class="modal-error tk-error" role="alert"></p>
          <div class="rg-cuerpo">
            <section class="rg-sec">
              <h3 class="cl-subtitulo">Documentos anticipos</h3>
              <div class="pc-lineas"><table>
                <thead><tr><th class="pc-n">Línea</th><th>Cuenta bancaria</th><th>Tipo documento</th><th>No. documento</th><th>Fecha</th><th class="num">Valor documento</th><th>Descripción</th><th></th></tr></thead>
                <tbody>${anticipos.map((a, i) => { const cb = cuentasBan.find((x) => x.id === a.cuenta_bancaria_id); return `<tr data-ant="${i}">
                  <td class="pc-n">${i + 1}</td><td>${esc(cb ? cb.numero : '')}</td><td>${esc(TIPO_MOV[a.tipo] || a.tipo || '')}</td><td class="fuerte">${esc(a.numero || '')}</td><td>${esc(fmt.fechaDia(a.fecha))}</td>
                  <td class="num"><input type="number" step="0.01" min="0" data-a="valor" value="${a.valor || ''}" ${dis} aria-label="Valor" ${a.disponible ? `title="Disponible ${fmt.monto(a.disponible)}"` : ''}></td>
                  <td class="rg-desc"><input data-a="descripcion" value="${esc(a.descripcion || '')}" maxlength="200" ${dis} aria-label="Descripción"></td>
                  <td>${ed ? `<button type="button" class="icono-boton" data-quitar-ant="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`; }).join('')}${vacias(4 - anticipos.length, 8)}</tbody>
                <tfoot><tr><td colspan="5" class="num">Valor total</td><td class="num" data-tant>${fmt.monto(totAnt())}</td><td colspan="2"></td></tr></tfoot>
              </table></div>
            </section>
            <section class="rg-sec">
              <div class="rg-sec-cab"><h3 class="cl-subtitulo">Documentos a liquidar</h3>${ed ? '<button type="button" class="boton secundario-sm" data-accion="agregar-compra"><i class="ti ti-plus" aria-hidden="true"></i> Agregar compra</button>' : ''}</div>
              <div class="pc-lineas"><table>
                <thead><tr><th>Tipo docto.</th><th class="num">Docto.</th><th>Serie</th><th>Número</th><th>Fecha</th><th>Proveedor</th><th class="num">Pendiente</th><th class="num">Valor liquidar</th><th>Descripción</th><th></th></tr></thead>
                <tbody>${documentos.map((d, i) => { const c = compra(d.compra_id) || {}; return `<tr data-doc="${i}">
                  <td>COMPRA</td><td class="num fuerte">${c.numero ?? ''}</td><td>${esc(c.serie || '')}</td><td>${esc(c.documento || '')}</td><td>${esc(fmt.fechaDia(c.fecha_documento))}</td><td class="rg-prov" title="${esc(c.proveedor_nombre || '')}">${esc(c.proveedor_nombre || '')}</td>
                  <td class="num tk-tenue">${c.pendiente !== undefined ? fmt.monto(Number(c.pendiente) + (estado === 'OPERADA' ? d.valor : 0)) : ''}</td>
                  <td class="num"><input type="number" step="0.01" min="0" data-d="valor" value="${d.valor || ''}" ${dis} aria-label="Valor a liquidar"></td>
                  <td class="rg-desc"><input data-d="descripcion" value="${esc(d.descripcion || '')}" maxlength="200" ${dis} aria-label="Descripción"></td>
                  <td>${ed ? `<button type="button" class="icono-boton" data-quitar-doc="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`; }).join('')}${vacias(4 - documentos.length, 10)}</tbody>
                <tfoot><tr><td colspan="7" class="num">Valor total <span class="rg-cuadre ${cuadra ? '' : 'pc-rojo'}" data-cuadre>${cuadra ? '' : `· diferencia ${fmt.monto(totAnt() - totDoc())}`}</span></td><td class="num" data-tdoc>${fmt.monto(totDoc())}</td><td colspan="2"></td></tr></tfoot>
              </table></div>
            </section>
          </div>
          <datalist id="rg-cuentas">${contables.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('')}</datalist>
        </form>`;
    }

    function leerFilas() {
      ctx.pDet.querySelectorAll('tr[data-ant]').forEach((tr) => { const a = anticipos[Number(tr.dataset.ant)]; tr.querySelectorAll('[data-a]').forEach((el) => { a[el.dataset.a] = el.dataset.a === 'valor' ? fmt.redondear(el.value) : el.value; }); });
      ctx.pDet.querySelectorAll('tr[data-doc]').forEach((tr) => { const d = documentos[Number(tr.dataset.doc)]; tr.querySelectorAll('[data-d]').forEach((el) => { d[el.dataset.d] = el.dataset.d === 'valor' ? fmt.redondear(el.value) : el.value; }); });
    }
    function leer(form) {
      const el = form.elements;
      return { fecha_inicial: el.fecha_inicial.value, fecha_final: el.fecha_final.value, tipo: el.tipo.value,
        cuenta_anticipo_id: porCodigo(el.cuenta_anticipo.value)?.id || null, cuenta_operar_id: porCodigo(el.cuenta_operar.value)?.id || null,
        observaciones: el.observaciones.value.trim() || null };
    }
    function repintar() { const form = ctx.pDet.querySelector('.rg-form'); leerFilas(); pintarDetalle({ ...(actual || {}), ...leer(form) }); }
    function totales() {
      leerFilas();
      const c = totAnt() === totDoc();
      ctx.pDet.querySelector('[data-tant]').textContent = fmt.monto(totAnt());
      ctx.pDet.querySelector('[data-tdoc]').textContent = fmt.monto(totDoc());
      const q = ctx.pDet.querySelector('[data-cuadre]'); q.textContent = c ? '' : `· diferencia ${fmt.monto(totAnt() - totDoc())}`; q.classList.toggle('pc-rojo', !c);
    }

    async function obtener() {
      const form = ctx.pDet.querySelector('.rg-form');
      leerFilas();
      const v = leer(form);
      const error = form.querySelector('.modal-error');
      if (!v.cuenta_anticipo_id) { error.textContent = 'Escribe la cuenta de anticipo (de movimiento).'; return form.elements.cuenta_anticipo.focus(); }
      if (!v.fecha_inicial || !v.fecha_final || v.fecha_final < v.fecha_inicial) { error.textContent = 'Revisa el rango de fechas.'; return; }
      const { data, error: e } = await sb.rpc('anticipos_disponibles', { p_loc: ctx.sel.loc, p_cuenta: v.cuenta_anticipo_id, p_desde: v.fecha_inicial, p_hasta: v.fecha_final, p_regularizacion: actual?.id || null });
      if (e) { error.textContent = window.UI.traducirError(e); return; }
      const ya = anticipos.map((a) => a.movimiento_id);
      const nuevos = (data || []).filter((m) => Number(m.disponible) > 0 && !ya.includes(m.movimiento_id));
      anticipos = anticipos.concat(nuevos.map((m) => ({ movimiento_id: m.movimiento_id, cuenta_bancaria_id: m.cuenta_bancaria_id, tipo: m.tipo, numero: m.numero_documento, fecha: m.fecha, valor: Number(m.disponible), disponible: Number(m.disponible), descripcion: [m.tercero_nombre, m.descripcion].filter(Boolean).join(' · ') })));
      pintarDetalle({ ...(actual || {}), ...v });
      window.FIN.aviso(nuevos.length ? `${nuevos.length} anticipo(s) con saldo por regularizar` : 'No hay anticipos con saldo en la cuenta y el rango de fechas');
    }
    async function agregarCompra() {
      leerFilas();
      const usadas = documentos.map((d) => d.compra_id);
      const pend = compras.filter((c) => c.estado === 'ACTIVA' && Number(c.pendiente) > 0 && !usadas.includes(c.id));
      if (!pend.length) return window.FIN.aviso('No hay compras con saldo pendiente');
      const id = await window.LOV({ titulo: 'Compras por pagar', columnas: ['Compra', 'Documento', 'Fecha', 'Proveedor', 'Pendiente'],
        filas: pend.map((c) => ({ id: c.id, celdas: [c.numero, docTxt(c), fmt.fechaDia(c.fecha_documento), c.proveedor_nombre || '', fmt.monto(c.pendiente)] })) });
      if (!id) return;
      const c = compra(id);
      const resta = fmt.redondear(totAnt() - totDoc());
      documentos.push({ compra_id: id, valor: resta > 0 ? Math.min(resta, Number(c.pendiente)) : Number(c.pendiente), descripcion: [c.proveedor_nombre, c.descripcion].filter(Boolean).join(' · ').slice(0, 200) });
      repintar();
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      leerFilas();
      const v = leer(form);
      if (!v.fecha_inicial || !v.fecha_final) { error.textContent = 'Escribe las fechas inicial y final.'; return; }
      if (v.fecha_final < v.fecha_inicial) { error.textContent = 'La fecha final es anterior a la inicial.'; return; }
      if (!v.cuenta_anticipo_id) { error.textContent = 'La cuenta de anticipo no es una cuenta de movimiento del catálogo.'; return form.elements.cuenta_anticipo.focus(); }
      if (!v.cuenta_operar_id) { error.textContent = 'La cuenta a operar no es una cuenta de movimiento del catálogo.'; return form.elements.cuenta_operar.focus(); }
      if (v.cuenta_anticipo_id === v.cuenta_operar_id) { error.textContent = 'La cuenta de anticipo y la cuenta a operar deben ser distintas.'; return; }
      const ants = anticipos.filter((a) => a.valor > 0), docs = documentos.filter((d) => d.valor > 0);
      const mal = docs.find((d) => d.valor > Number(compra(d.compra_id)?.pendiente || 0) + 0.001);
      if (mal) { error.textContent = `El valor a liquidar de la compra ${compra(mal.compra_id)?.numero} pasa de su saldo pendiente.`; return; }
      const sobra = ants.find((a) => a.disponible && a.valor > a.disponible + 0.001);
      if (sobra) { error.textContent = `El anticipo ${sobra.numero} solo tiene ${fmt.monto(sobra.disponible)} disponibles.`; return; }
      error.textContent = '';
      const boton = document.querySelector('[type=submit][form=rg-form]');
      if (boton) boton.disabled = true;
      try {
        let id = actual?.id;
        if (actual) { const r = await sb.from('regularizaciones_anticipo').update(v).eq('id', id); if (r.error) throw r.error; }
        else { const r = await sb.from('regularizaciones_anticipo').insert({ ...v, numero: 0, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single(); if (r.error) throw r.error; id = r.data.id; }
        for (const t of ['regularizacion_anticipos', 'regularizacion_documentos']) { const d = await sb.from(t).delete().eq('regularizacion_id', id); if (d.error) throw d.error; }
        if (ants.length) { const r = await sb.from('regularizacion_anticipos').insert(ants.map((a, i) => ({ regularizacion_id: id, linea: i + 1, movimiento_id: a.movimiento_id, valor: a.valor, descripcion: a.descripcion || null }))); if (r.error) throw r.error; }
        if (docs.length) { const r = await sb.from('regularizacion_documentos').insert(docs.map((d, i) => ({ regularizacion_id: id, linea: i + 1, compra_id: d.compra_id, valor: d.valor, descripcion: d.descripcion || null }))); if (r.error) throw r.error; }
        window.FIN.aviso(actual ? 'Regularización guardada' : 'Regularización registrada');
        editando = false;
        await consultar(id);
      } catch (err) { error.textContent = window.UI.traducirError(err); }
      finally { if (boton) boton.disabled = false; }
    }
    async function procesar(accion) {
      const r = actual;
      let motivo = null;
      if (accion === 'PROCESAR' && !confirm(`¿Procesar la regularización ${r.numero}? Se genera la póliza con fecha ${fmt.fechaDia(r.fecha_final)}.`)) return;
      if (accion === 'REVERSAR') { motivo = prompt(`Motivo de la reversión de la regularización ${r.numero} (se anula su póliza):`, 'REVERSIÓN DE LA REGULARIZACIÓN'); if (motivo === null) return; }
      if (accion === 'ANULAR' && !confirm(`¿Anular la regularización ${r.numero}?`)) return;
      const { data, error } = await sb.rpc('procesar_regularizacion', { p_id: r.id, p_accion: accion, p_motivo: motivo });
      if (error) { const e = ctx.pDet.querySelector('.modal-error'); if (e) e.textContent = window.UI.traducirError(error); else window.FIN.aviso(window.UI.traducirError(error)); return; }
      window.FIN.aviso({ PROCESAR: `Regularización operada · póliza ${data.partida}`, REVERSAR: 'Regularización reversada · póliza anulada', ANULAR: 'Regularización anulada' }[accion]);
      await cargarLocalidad().then(() => consultar(r.id));
    }
    async function verPoliza() {
      const [{ data: p }, { data: l }] = await Promise.all([sb.from('partidas').select('*').eq('id', partida.id).single(), sb.from('partida_lineas').select('linea, cuenta_id, concepto, debe, haber').eq('partida_id', partida.id).order('linea')]);
      if (!p) return;
      imprimir(`Póliza ${p.mes}-${p.numero}`, `<h1>Póliza ${p.mes}-${p.numero} · ${esc(p.estado)}</h1><h2>${esc(empresaTxt(ctx))} · ${MESES[p.mes - 1]} ${p.anio} · ${esc(p.descripcion)}</h2>
        <table><thead><tr><th>#</th><th>Cuenta</th><th>Nombre</th><th>Concepto</th><th class="n">Debe</th><th class="n">Haber</th></tr></thead>
        <tbody>${(l || []).map((x) => { const k = cuenta(x.cuenta_id); return `<tr><td>${x.linea}</td><td>${esc(k?.codigo || '')}</td><td>${esc(k?.nombre || '')}</td><td>${esc(x.concepto || '')}</td><td class="n">${fmt.monto(x.debe)}</td><td class="n">${fmt.monto(x.haber)}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr><td colspan="4">Totales</td><td class="n">${fmt.monto(p.total_debe)}</td><td class="n">${fmt.monto(p.total_haber)}</td></tr></tfoot></table>
        <div class="firmas"><div>Elaboró</div><div>Revisó</div><div>Autorizó</div></div>`);
    }
    function imprimirReg() {
      const r = actual, ca = cuenta(r.cuenta_anticipo_id), co = cuenta(r.cuenta_operar_id);
      imprimir(`Regularización ${r.numero}`, `<h1>Regularización de anticipos No. ${r.numero}</h1><h2>${esc(empresaTxt(ctx))} · del ${esc(fmt.fechaDia(r.fecha_inicial))} al ${esc(fmt.fechaDia(r.fecha_final))}</h2>
        <div class="cab"><div><b>Estado</b>${esc(r.estado)}</div><div><b>Tipo</b>${esc(r.tipo)}</div><div><b>Póliza</b>${partida ? `${partida.mes}-${partida.numero}` : '—'}</div><div><b>Usuario</b>${esc(r.usuario || '')}</div>
          <div style="grid-column:span 2"><b>Cuenta anticipo</b>${esc(ca ? `${ca.codigo} · ${ca.nombre}` : '')}</div><div style="grid-column:span 2"><b>Cuenta a operar</b>${esc(co ? `${co.codigo} · ${co.nombre}` : '')}</div></div>
        <h3>Documentos anticipos</h3><table><thead><tr><th>#</th><th>Cuenta bancaria</th><th>Tipo</th><th>Documento</th><th>Fecha</th><th>Descripción</th><th class="n">Valor</th></tr></thead>
        <tbody>${anticipos.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(cuentasBan.find((x) => x.id === a.cuenta_bancaria_id)?.numero || '')}</td><td>${esc(TIPO_MOV[a.tipo] || '')}</td><td>${esc(a.numero || '')}</td><td>${esc(fmt.fechaDia(a.fecha))}</td><td>${esc(a.descripcion || '')}</td><td class="n">${fmt.monto(a.valor)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="6">Valor total</td><td class="n">${fmt.monto(totAnt())}</td></tr></tfoot></table>
        <h3>Documentos a liquidar</h3><table><thead><tr><th>Tipo</th><th>Compra</th><th>Serie</th><th>Número</th><th>Fecha</th><th>Proveedor</th><th>Descripción</th><th class="n">Valor</th></tr></thead>
        <tbody>${documentos.map((d) => { const c = compra(d.compra_id) || {}; return `<tr><td>COMPRA</td><td>${c.numero ?? ''}</td><td>${esc(c.serie || '')}</td><td>${esc(c.documento || '')}</td><td>${esc(fmt.fechaDia(c.fecha_documento))}</td><td>${esc(c.proveedor_nombre || '')}</td><td>${esc(d.descripcion || '')}</td><td class="n">${fmt.monto(d.valor)}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr><td colspan="7">Valor total</td><td class="n">${fmt.monto(totDoc())}</td></tr></tfoot></table>
        <div class="firmas"><div>Elaboró</div><div>Revisó</div><div>Autorizó</div></div>`);
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (cambio === 'otro' && e.target.name === 'reg') return abrir(lista.find((r) => String(r.id) === e.target.value) || null);
      const form = e.target.closest('.rg-form');
      if (!form) return;
      if (['cuenta_anticipo', 'cuenta_operar'].includes(e.target.name)) { const k = porCodigo(e.target.value); form.querySelector(`[data-nombre=${e.target.name}]`).value = k ? k.nombre : e.target.value ? 'No es una cuenta de movimiento' : ''; return; }
      if (e.target.dataset.a || e.target.dataset.d) totales();
    });
    cont.addEventListener('input', (e) => { if (e.target.dataset.a === 'valor' || e.target.dataset.d === 'valor') totales(); });
    cont.addEventListener('click', (e) => {
      const qa = e.target.closest('[data-quitar-ant]');
      if (qa) { leerFilas(); anticipos.splice(Number(qa.dataset.quitarAnt), 1); return repintar(); }
      const qd = e.target.closest('[data-quitar-doc]');
      if (qd) { leerFilas(); documentos.splice(Number(qd.dataset.quitarDoc), 1); return repintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (!a) return;
      if (a === 'nueva') { actual = null; editando = true; anticipos = []; documentos = []; partida = null; pintarFiltros(); return pintarDetalle(); }
      if (a === 'modificar') { editando = true; pintarBarra(); return pintarDetalle(); }
      if (a === 'cancelar') return abrir(actual || lista[0] || null);
      if (a === 'obtener') return obtener();
      if (a === 'agregar-compra') return agregarCompra();
      if (a === 'ver-poliza') return verPoliza();
      if (a === 'imprimir') return imprimirReg();
      if (a === 'anular') return procesar('ANULAR');
      if (a === 'PROCESAR' || a === 'REVERSAR') return procesar(a);
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.rg-form')) { e.preventDefault(); guardar(e.target); } });
    iniciar();
  };

  // ===================== Cuentas x Pagar =====================
  // modo: MENSUAL (mes y año), GENERAL (rango de fechas) o PERIODO (saldo a una fecha).
  function reporteCxp(cont, modo) {
    const TITULOS = { MENSUAL: ['Consolidado CXP mensual', 'ti-calendar-month'], GENERAL: ['Consolidado general', 'ti-report-money'], PERIODO: ['CXP por periodo', 'ti-calendar-dollar'] };
    const ctx = montar(cont, { titulo: TITULOS[modo][0], icono: TITULOS[modo][1], clase: `bk-movimientos cx-rep cx-${modo.toLowerCase()}`, grupo: 'Compras · Procesos' });
    const { sb } = ctx;
    const hoy = fmt.hoy();
    const [y, m] = hoy.split('-').map(Number);
    const f = { anio: y, mes: m, desde: `${y}-01-01`, hasta: hoy, fecha: modo === 'MENSUAL' ? 'ESTIMADA' : 'DOCUMENTO', saldo: modo === 'MENSUAL' ? 'CON SALDO' : 'TODAS', tipo: '', proveedor: '', formato: 'PDF' };
    let proveedores = [], tipos = [], compras = [], abonos = new Map();
    let filas = [], resumen = false, sel = null;
    const prov = (id) => proveedores.find((p) => p.id === id);
    const provDe = (t) => { const s = String(t || '').trim().toUpperCase(); return s ? proveedores.find((p) => `${p.codigo} · ${p.nombre_comercial}`.toUpperCase() === s || String(p.codigo) === s || (p.nit && p.nit.toUpperCase() === s)) || null : null; };
    const aBase = (c) => (ctx.moneda(c.moneda_id)?.iso === 'GTQ' ? 1 : Number(c.tipo_cambio) || 1);
    const fechaDe = (c) => (f.fecha === 'ESTIMADA' ? c.fecha_vencimiento || c.fecha_documento : f.fecha === 'INGRESO' ? c.fecha_ingreso : c.fecha_documento);

    function pintarFiltros() {
      const p = provDe(f.proveedor);
      const sl = (n, ops, val) => `<select name="${n}">${ops.map(([x, t]) => `<option value="${x}" ${String(val) === String(x) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
      ctx.filtros(`
        ${modo === 'GENERAL' ? `<label class="campo"><span>Fecha inicio</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label><label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>` : ''}
        ${modo === 'PERIODO' ? `<label class="campo cx-anio"><span>Año pago</span><input type="number" name="anio" min="2000" max="2999" value="${f.anio}"></label><label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}"></label>` : ''}
        <label class="campo cx-prov"><span>Proveedor</span><input list="cx-proveedores" name="proveedor" value="${esc(f.proveedor)}" placeholder="TODOS"></label>
        ${modo !== 'PERIODO' ? `<label class="campo"><span>Tipo fecha</span>${sl('fecha', [['ESTIMADA', 'ESTIMADA PAGO'], ['DOCUMENTO', 'DOCUMENTO'], ['INGRESO', 'INGRESO']], f.fecha)}</label>` : ''}
        <label class="campo"><span>Saldo?</span>${sl('saldo', [['CON SALDO', 'CON SALDO'], ['SIN SALDO', 'SIN SALDO'], ['TODAS', 'TODAS']], f.saldo)}</label>
        <label class="campo"><span>Tipo proveedor</span>${sl('tipo', [['', 'TODOS'], ...tipos.map((t) => [t.id, t.nombre])], f.tipo)}</label>
        <label class="campo cx-formato"><span>Formato</span>${sl('formato', [['PDF', 'PDF'], ['EXCEL', 'EXCEL']], f.formato)}</label>
        <datalist id="cx-proveedores">${proveedores.map((x) => `<option value="${esc(`${x.codigo} · ${x.nombre_comercial}`)}"></option>`).join('')}</datalist>
        ${p || !f.proveedor ? '' : '<small class="cx-aviso pc-rojo">Proveedor no encontrado</small>'}`,
        `<button type="button" class="boton primario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>
         ${modo === 'PERIODO' ? `<button type="button" class="boton secundario-sm ${resumen ? 'activo' : ''}" data-accion="resumen" aria-pressed="${resumen}"><i class="ti ti-list-numbers" aria-hidden="true"></i> Resumen</button>` : ''}
         <button type="button" class="boton secundario-sm" data-accion="estado-cuenta" title="Estado de cuenta del proveedor elegido (o de la fila seleccionada)"><i class="ti ti-file-text" aria-hidden="true"></i> Est. cuenta</button>
         <button type="button" class="boton secundario-sm" data-accion="regresar"><i class="ti ti-arrow-left" aria-hidden="true"></i> Regresar</button>`);
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('compra_abonos').select('compra_id').limit(1);
      if (prueba.error) return faltaScript(ctx, prueba.error);
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      const [p, t] = await Promise.all([
        loc ? sb.from('proveedores').select('id, codigo, nit, nombre_comercial, nombre_fiscal, tipo_proveedor_id, dias_credito').eq('localidad_id', loc).order('nombre_comercial') : { data: [] },
        sb.from('tipos_proveedor').select('id, codigo, nombre').eq('activo', true).order('codigo')
      ]);
      proveedores = p.data || []; tipos = t.data || [];
      pintarFiltros();
      await consultar();
    }
    async function consultar() {
      const loc = ctx.sel.loc;
      if (!loc) { compras = []; return pintar(); }
      let q = sb.from('compras_saldo').select('id, numero, serie, documento, fecha_documento, fecha_ingreso, fecha_vencimiento, proveedor_id, proveedor_codigo, proveedor_nombre, nit, moneda_id, tipo_cambio, neto, pendiente').eq('localidad_id', loc).eq('estado', 'ACTIVA');
      if (modo === 'PERIODO') q = q.gte('fecha_documento', `${f.anio}-01-01`).lte('fecha_documento', f.hasta < `${f.anio}-12-31` ? f.hasta : `${f.anio}-12-31`);
      const { data, error } = await q.order('fecha_documento').order('numero').limit(10000);
      if (error) { ctx.pDet.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      compras = data || [];
      abonos = new Map();
      if (modo === 'PERIODO' && compras.length) {
        const ids = compras.map((c) => c.id);
        for (let i = 0; i < ids.length; i += 300) {
          const { data: ab } = await sb.from('compra_abonos').select('compra_id, fecha, valor').in('compra_id', ids.slice(i, i + 300)).lte('fecha', f.hasta);
          (ab || []).forEach((a) => abonos.set(a.compra_id, (abonos.get(a.compra_id) || 0) + Number(a.valor)));
        }
      }
      pintar();
    }
    // Filas del reporte con los filtros aplicados.
    function calcular() {
      const p = provDe(f.proveedor);
      const ini = modo === 'MENSUAL' ? `${f.anio}-${String(f.mes).padStart(2, '0')}-01` : f.desde;
      const fin = modo === 'MENSUAL' ? new Date(f.anio, f.mes, 0).toLocaleDateString('en-CA') : f.hasta;
      return compras.map((c) => {
        const k = aBase(c);
        const saldo = modo === 'PERIODO' ? fmt.redondear(Number(c.neto) - (abonos.get(c.id) || 0)) : Number(c.pendiente);
        const fp = c.fecha_vencimiento || c.fecha_documento;
        const corte = modo === 'PERIODO' ? f.hasta : hoy;
        const mora = saldo > 0.004 && fp && fp < corte ? diasEntre(fp, corte) : 0;
        const pv = prov(c.proveedor_id);
        return { ...c, k, saldo, valorQ: fmt.redondear(Number(c.neto) * k), saldoQ: fmt.redondear(saldo * k), mi: ctx.moneda(c.moneda_id)?.iso !== 'GTQ', mora, fp, codigo: pv?.codigo ?? c.proveedor_codigo, nombre: c.proveedor_nombre || pv?.nombre_comercial || '', tipoProv: pv?.tipo_proveedor_id };
      }).filter((c) => {
        if (p && c.proveedor_id !== p.id) return false;
        if (f.tipo && String(c.tipoProv) !== String(f.tipo)) return false;
        if (f.saldo === 'CON SALDO' && !(c.saldo > 0.004)) return false;
        if (f.saldo === 'SIN SALDO' && c.saldo > 0.004) return false;
        if (modo !== 'PERIODO') { const d = fechaDe(c); if (!d || d < ini || d > fin) return false; }
        return true;
      }).sort((a, b) => (fechaDe(a) || '').localeCompare(fechaDe(b) || '') || a.numero - b.numero);
    }
    const agrupar = (rows) => {
      const g = new Map();
      rows.forEach((c) => { const x = g.get(c.proveedor_id) || { codigo: c.codigo, nombre: c.nombre, nit: c.nit, docs: 0, valorQ: 0, saldoQ: 0, mora: 0 }; x.docs++; x.valorQ += c.valorQ; x.saldoQ += c.saldoQ; x.mora = Math.max(x.mora, c.mora); g.set(c.proveedor_id, x); });
      return [...g.values()].sort((a, b) => b.saldoQ - a.saldoQ);
    };

    function pintar() {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-report-money'); return; }
      filas = calcular();
      const tot = filas.reduce((t, c) => ({ v: t.v + c.valorQ, s: t.s + c.saldoQ, mv: t.mv + (c.mi ? Number(c.neto) : 0), ms: t.ms + (c.mi ? c.saldo : 0) }), { v: 0, s: 0, mv: 0, ms: 0 });
      const meses = modo === 'MENSUAL' ? `<div class="cx-meses">
          <button type="button" class="boton secundario-sm" data-anio="-1" aria-label="Año anterior">−</button><b class="cx-anio-n">${f.anio}</b><button type="button" class="boton secundario-sm" data-anio="1" aria-label="Año siguiente">+</button>
          ${MESES.map((n, i) => `<button type="button" class="cx-mes ${f.mes === i + 1 ? 'activo' : ''}" data-mes="${i + 1}">${n}</button>`).join('')}</div>` : '';
      const fechaCol = modo === 'MENSUAL' ? 'Se estima pago' : 'Fecha pago';
      const cuerpo = resumen ? (() => { const g = agrupar(filas); return `
          <thead><tr><th class="num">Prov.</th><th>Nombre proveedor</th><th>NIT</th><th class="num">Documentos</th><th class="num">Mayor mora</th><th class="num">Valor total Q</th><th class="num">Saldo Q</th></tr></thead>
          <tbody>${g.map((x) => `<tr><td class="num">${x.codigo ?? ''}</td><td class="cx-nombre">${esc(x.nombre)}</td><td>${esc(x.nit || '')}</td><td class="num">${x.docs}</td><td class="num ${x.mora ? 'pc-rojo' : ''}">${x.mora}</td><td class="num">${fmt.monto(x.valorQ)}</td><td class="num fuerte">${fmt.monto(x.saldoQ)}</td></tr>`).join('') || '<tr><td colspan="7" class="tk-vacio">Sin documentos con esos filtros.</td></tr>'}</tbody>
          <tfoot><tr><td colspan="3">${g.length} proveedor(es)</td><td class="num">${filas.length}</td><td></td><td class="num">${fmt.monto(tot.v)}</td><td class="num">${fmt.monto(tot.s)}</td></tr></tfoot>`; })() : `
          <thead><tr><th class="num">${modo === 'PERIODO' ? 'Compra' : 'ID'}</th><th>Serie</th><th>Documento</th><th>Fecha docto.</th><th>${fechaCol}</th>${modo !== 'PERIODO' ? '<th class="num">Días mora</th>' : ''}<th class="num">${modo === 'MENSUAL' ? '#' : 'Prov.'}</th><th>Nombre proveedor</th><th class="num">Valor total${modo === 'MENSUAL' ? '' : ' Q'}</th><th class="num">Saldo${modo === 'MENSUAL' ? '' : ' Q'}</th>${modo === 'PERIODO' ? '<th class="num">Valor total MI</th><th class="num">Saldo MI</th>' : ''}</tr></thead>
          <tbody>${filas.map((c) => `<tr data-fila="${c.id}" class="${sel === c.id ? 'actual' : ''}" tabindex="0">
            <td class="num fuerte">${c.numero}</td><td>${esc(c.serie || '')}</td><td>${esc(c.documento || '')}</td><td>${esc(fmt.fechaDia(c.fecha_documento))}</td><td>${esc(fmt.fechaDia(c.fp))}</td>
            ${modo !== 'PERIODO' ? `<td class="num ${c.mora ? 'pc-rojo' : ''}">${c.mora}</td>` : ''}<td class="num">${c.codigo ?? ''}</td><td class="cx-nombre" title="${esc(c.nombre)}">${esc(c.nombre)}</td>
            <td class="num">${fmt.monto(c.valorQ)}</td><td class="num fuerte">${fmt.monto(c.saldoQ)}</td>
            ${modo === 'PERIODO' ? `<td class="num">${c.mi ? fmt.monto(c.neto) : ''}</td><td class="num">${c.mi ? fmt.monto(c.saldo) : fmt.monto(0)}</td>` : ''}</tr>`).join('')
            || `<tr><td colspan="12" class="tk-vacio"><i class="ti ti-report-money" aria-hidden="true"></i>Sin documentos con esos filtros.</td></tr>`}</tbody>
          <tfoot><tr><td colspan="${modo === 'PERIODO' ? 7 : 8}">${filas.length} documento(s) · Total</td><td class="num">${fmt.monto(tot.v)}</td><td class="num">${fmt.monto(tot.s)}</td>${modo === 'PERIODO' ? `<td class="num">${tot.mv ? fmt.monto(tot.mv) : ''}</td><td class="num">${fmt.monto(tot.ms)}</td>` : ''}</tr></tfoot>`;
      ctx.pDet.innerHTML = `
        <div class="bm-form cx-form cl-clasico">
          <div class="cl-banda">${esc(TITULOS[modo][0])}${modo === 'PERIODO' ? ` · saldo al ${esc(fmt.fechaDia(f.hasta))}` : modo === 'GENERAL' ? ` · ${esc(fmt.fechaDia(f.desde))} al ${esc(fmt.fechaDia(f.hasta))}` : ` · ${MESES[f.mes - 1]} ${f.anio}`}</div>
          ${meses}
          <div class="pc-lineas cx-tabla"><table>${cuerpo}</table></div>
        </div>`;
    }

    function titulo() { return `${TITULOS[modo][0]} · ${modo === 'MENSUAL' ? `${MESES[f.mes - 1]} ${f.anio}` : modo === 'GENERAL' ? `${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.hasta)}` : `saldo al ${fmt.fechaDia(f.hasta)}`}`; }
    function imprimirRep() {
      if (!filas.length) return window.FIN.aviso('No hay documentos con esos filtros');
      const filtros = `Proveedor: ${provDe(f.proveedor)?.nombre_comercial || 'TODOS'} · Saldo: ${f.saldo} · Tipo proveedor: ${tipos.find((t) => String(t.id) === String(f.tipo))?.nombre || 'TODOS'}${modo !== 'PERIODO' ? ` · Tipo fecha: ${f.fecha}` : ''}`;
      if (resumen) {
        const g = agrupar(filas);
        if (f.formato === 'EXCEL') return window.COMPRAS_CAT.descargarCsv(`cxp_resumen_${f.hasta}.csv`, [['Prov.', 'Nombre proveedor', 'NIT', 'Documentos', 'Mayor mora', 'Valor total Q', 'Saldo Q'], ...g.map((x) => [x.codigo, x.nombre, x.nit || '', x.docs, x.mora, x.valorQ.toFixed(2), x.saldoQ.toFixed(2)])]);
        return imprimir(titulo(), `<h1>${esc(titulo())} · Resumen</h1><h2>${esc(empresaTxt(ctx))} · ${esc(filtros)}</h2><table><thead><tr><th>Prov.</th><th>Nombre</th><th>NIT</th><th class="n">Docs.</th><th class="n">Mora</th><th class="n">Valor Q</th><th class="n">Saldo Q</th></tr></thead>
          <tbody>${g.map((x) => `<tr><td>${x.codigo ?? ''}</td><td>${esc(x.nombre)}</td><td>${esc(x.nit || '')}</td><td class="n">${x.docs}</td><td class="n">${x.mora}</td><td class="n">${fmt.monto(x.valorQ)}</td><td class="n">${fmt.monto(x.saldoQ)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="5">Total</td><td class="n">${fmt.monto(g.reduce((t, x) => t + x.valorQ, 0))}</td><td class="n">${fmt.monto(g.reduce((t, x) => t + x.saldoQ, 0))}</td></tr></tfoot></table>`);
      }
      const cab = ['Compra', 'Serie', 'Documento', 'Fecha docto.', 'Fecha pago', 'Días mora', 'Prov.', 'Nombre proveedor', 'Valor total Q', 'Saldo Q'];
      if (f.formato === 'EXCEL') return window.COMPRAS_CAT.descargarCsv(`cxp_${modo.toLowerCase()}_${f.hasta}.csv`, [cab, ...filas.map((c) => [c.numero, c.serie || '', c.documento || '', fmt.fechaDia(c.fecha_documento), fmt.fechaDia(c.fp), c.mora, c.codigo ?? '', c.nombre, c.valorQ.toFixed(2), c.saldoQ.toFixed(2)])]);
      imprimir(titulo(), `<h1>${esc(titulo())}</h1><h2>${esc(empresaTxt(ctx))} · ${esc(filtros)}</h2>
        <table><thead><tr>${cab.map((x, i) => `<th class="${i === 5 || i > 7 ? 'n' : ''}">${x}</th>`).join('')}</tr></thead>
        <tbody>${filas.map((c) => `<tr><td>${c.numero}</td><td>${esc(c.serie || '')}</td><td>${esc(c.documento || '')}</td><td>${esc(fmt.fechaDia(c.fecha_documento))}</td><td>${esc(fmt.fechaDia(c.fp))}</td><td class="n">${c.mora}</td><td>${c.codigo ?? ''}</td><td>${esc(c.nombre)}</td><td class="n">${fmt.monto(c.valorQ)}</td><td class="n">${fmt.monto(c.saldoQ)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="8">${filas.length} documentos · Total</td><td class="n">${fmt.monto(filas.reduce((t, c) => t + c.valorQ, 0))}</td><td class="n">${fmt.monto(filas.reduce((t, c) => t + c.saldoQ, 0))}</td></tr></tfoot></table>`);
    }
    // Estado de cuenta: las compras del proveedor con sus abonos y el saldo acumulado.
    async function estadoCuenta() {
      const p = provDe(f.proveedor) || prov(compras.find((c) => c.id === sel)?.proveedor_id);
      if (!p) return window.FIN.aviso('Elige el proveedor o selecciona una fila del reporte');
      const corte = modo === 'PERIODO' ? f.hasta : hoy;
      const { data: cs } = await sb.from('compras_saldo').select('id, numero, serie, documento, fecha_documento, fecha_vencimiento, moneda_id, tipo_cambio, neto').eq('localidad_id', ctx.sel.loc).eq('estado', 'ACTIVA').eq('proveedor_id', p.id).lte('fecha_documento', corte).order('fecha_documento').order('numero');
      const lista = cs || [];
      const { data: ab } = lista.length ? await sb.from('compra_abonos').select('compra_id, fecha, valor, origen, documento').in('compra_id', lista.map((c) => c.id)).lte('fecha', corte).order('fecha') : { data: [] };
      const mov = [...lista.map((c) => ({ fecha: c.fecha_documento, txt: `Compra ${c.numero} · ${docTxt(c)}`, vence: c.fecha_vencimiento, cargo: Number(c.neto) * aBase(c), abono: 0 })),
        ...(ab || []).map((a) => { const c = lista.find((x) => x.id === a.compra_id); return { fecha: a.fecha, txt: `${a.origen === 'ANTICIPO' ? 'Anticipo' : a.origen === 'CHEQUE' ? 'Cheque' : 'Transferencia'} ${a.documento || ''} · compra ${c?.numero ?? ''}`, cargo: 0, abono: Number(a.valor) * (c ? aBase(c) : 1) }; })]
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || b.cargo - a.cargo);
      let s = 0;
      const filasEc = mov.map((x) => { s += x.cargo - x.abono; return `<tr><td>${esc(fmt.fechaDia(x.fecha))}</td><td>${esc(x.txt)}</td><td>${esc(fmt.fechaDia(x.vence || ''))}</td><td class="n">${x.cargo ? fmt.monto(x.cargo) : ''}</td><td class="n">${x.abono ? fmt.monto(x.abono) : ''}</td><td class="n">${fmt.monto(s)}</td></tr>`; }).join('');
      imprimir(`Estado de cuenta ${p.nombre_comercial}`, `<h1>Estado de cuenta · ${esc(p.codigo)} · ${esc(p.nombre_fiscal || p.nombre_comercial)}</h1><h2>${esc(empresaTxt(ctx))} · NIT ${esc(p.nit || '')} · al ${esc(fmt.fechaDia(corte))}</h2>
        <table><thead><tr><th>Fecha</th><th>Documento</th><th>Vence</th><th class="n">Cargos Q</th><th class="n">Abonos Q</th><th class="n">Saldo Q</th></tr></thead><tbody>${filasEc || '<tr><td colspan="6">Sin movimientos.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="3">Saldo al ${esc(fmt.fechaDia(corte))}</td><td class="n">${fmt.monto(mov.reduce((t, x) => t + x.cargo, 0))}</td><td class="n">${fmt.monto(mov.reduce((t, x) => t + x.abono, 0))}</td><td class="n">${fmt.monto(s)}</td></tr></tfoot></table>`);
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (cambio !== 'otro') return;
      const n = e.target.name;
      f[n] = n === 'anio' ? Number(e.target.value) || f.anio : e.target.value;
      if (n === 'desde' && f.hasta < f.desde) f.hasta = f.desde;
      if (n === 'hasta' && f.desde > f.hasta) f.desde = f.hasta;
      if (n === 'anio' && modo === 'PERIODO' && !f.hasta.startsWith(String(f.anio))) f.hasta = `${f.anio}-12-31` < hoy ? `${f.anio}-12-31` : hoy;
      pintarFiltros();
      if (n === 'formato') return;
      return ['desde', 'hasta', 'anio'].includes(n) && modo !== 'MENSUAL' ? consultar() : pintar();
    });
    cont.addEventListener('click', (e) => {
      const mes = e.target.closest('[data-mes]');
      if (mes) { f.mes = Number(mes.dataset.mes); return pintar(); }
      const an = e.target.closest('[data-anio]');
      if (an) { f.anio += Number(an.dataset.anio); return pintar(); }
      const fila = e.target.closest('tr[data-fila]');
      if (fila) { sel = Number(fila.dataset.fila); ctx.pDet.querySelectorAll('tr[data-fila]').forEach((tr) => tr.classList.toggle('actual', tr === fila)); return; }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'imprimir') return imprimirRep();
      if (a === 'resumen') { resumen = !resumen; pintarFiltros(); return pintar(); }
      if (a === 'estado-cuenta') return estadoCuenta();
      if (a === 'regresar') return history.length > 1 ? history.back() : (location.hash = '#/compras');
    });
    iniciar();
  }
  window.PANTALLAS['cxp-mensual'] = (cont) => reporteCxp(cont, 'MENSUAL');
  window.PANTALLAS['cxp-general'] = (cont) => reporteCxp(cont, 'GENERAL');
  window.PANTALLAS['cxp-periodo'] = (cont) => reporteCxp(cont, 'PERIODO');
})();
