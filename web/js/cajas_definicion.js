// Caja y Bancos · Cajas · Definición de Cajas (script 120): a la izquierda las cajas de la empresa (número,
// nombre, responsable, tipo y estado); a la derecha la definición de la caja elegida:
//   Caja: nombre, responsable, tipo de movimiento (tipo de caja), modalidad, transacción, cuenta principal,
//   centros de costo, moneda, monto asignado, usuario que liquida y cuenta bancaria de reintegro, con las
//   cuentas del IVA y de retenciones de la liquidación.
//   Vinculación de cuentas (contabilización por carga masiva): carga masiva, verifica liquidación, cuenta de la
//   caja, cuenta de anticipo y cuenta de migración.
//   Tipos de gasto: cada tipo con su cuenta contable; «Cargar cuentas» trae las cuentas de gasto que ya usan los
//   documentos de la caja.
// Imprime en PDF y genera Excel el listado de cajas con el encabezado común de los reportes.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  const TIPOS_CAJA = ['CAJA CHICA', 'CORTE CAJA', 'FONDO ROTATIVO', 'LIQUIDACIÓN DE GASTOS'];
  const leerSesion = (k) => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } };
  const guardarSesion = (k, v) => { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch { /* sin almacenamiento */ } };
  window.PANTALLAS = window.PANTALLAS || {};

  window.PANTALLAS['definicion-cajas'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Definición de Cajas', icono: 'ti-cash-register', clase: 'bk-movimientos dc-def', grupo: 'Cajas' });
    const { sb, yo } = ctx;
    const f = { estado: 'TODAS' };
    let cajas = [], caja = null, nueva = false, contables = [], centros = [], cuentas = [], transacciones = [], usuarios = [], tipos = [], ultimo = new Map(), buscar = '';
    let sinScript = false;

    const contable = (id) => contables.find((x) => x.id === id);
    const centro = (id) => centros.find((x) => x.id === id);
    const porCodigo = (cod) => contables.find((x) => x.codigo === String(cod || '').trim() && x.movimiento);
    const centroPorCodigo = (cod) => centros.find((x) => x.codigo === String(cod || '').trim() && x.movimiento);
    const simbolo = (id) => ctx.moneda(id)?.simbolo || 'Q';

    function pintarFiltros() {
      ctx.filtros(`<label class="campo"><span>Cajas</span><select name="estado">${[['TODAS', 'Todas'], ['ACTIVAS', 'Activas'], ['INACTIVAS', 'Inactivas']].map(([k, t]) => `<option value="${k}" ${f.estado === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`,
        `<div class="bmc-reportes"><button type="button" class="boton secundario-sm bca-pdf" data-accion="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i><span><b>Imprimir en PDF</b><small>Listado de cajas</small></span></button>
         <button type="button" class="boton cqc-excel" data-accion="excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i><span><b>Generar Excel</b><small>Listado de cajas</small></span></button>
         ${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva caja</button>' : ''}</div>`);
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      pintarFiltros();
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      const [c, k, cb, t, u] = await Promise.all([
        ctx.cuentasContables(),
        centrosLocalidad(),
        ctx.cuentasBancarias(),
        loc ? sb.from('transacciones_contables').select('id, numero, descripcion, estado').eq('localidad_id', loc).order('numero') : { data: [] },
        sb.from('perfiles').select('usuario, nombre, activo').order('usuario').limit(1000)
      ]);
      contables = c; centros = k; cuentas = cb; transacciones = t.data || []; usuarios = (u.data || []).filter((x) => x.usuario);
      await consultar();
    }
    async function centrosLocalidad() {
      if (!ctx.sel.loc) return [];
      const { data: k } = await sb.from('catalogos_centros').select('id').eq('localidad_id', ctx.sel.loc).eq('activo', true).order('version', { ascending: false }).limit(1);
      if (!k?.[0]) return [];
      const { data } = await sb.from('centros_costo').select('id, codigo, nombre, centro_mayor_id, vigente').eq('catalogo_id', k[0].id).order('codigo');
      const padres = new Set((data || []).map((x) => x.centro_mayor_id).filter(Boolean));
      return (data || []).map((x) => ({ ...x, movimiento: !padres.has(x.id) && x.vigente }));
    }
    async function consultar(id = caja?.id) {
      if (!ctx.sel.loc) { cajas = []; caja = null; return pintar(); }
      let q = sb.from('cajas_chicas').select('*').eq('localidad_id', ctx.sel.loc).order('codigo');
      if (f.estado === 'ACTIVAS') q = q.eq('activa', true);
      if (f.estado === 'INACTIVAS') q = q.eq('activa', false);
      const { data, error } = await q;
      if (error) { ctx.pMae.innerHTML = ctx.vacio(/cajas_chicas/.test(error.message) ? 'Falta instalar el script 54 (cajas chicas) en Supabase.' : esc(error.message), 'ti-alert-triangle'); ctx.pDet.innerHTML = ''; return; }
      cajas = data || [];
      sinScript = cajas.length > 0 && !('carga_masiva' in cajas[0]);
      const ids = cajas.map((x) => x.id);
      const { data: ps } = ids.length ? await sb.from('caja_periodos_resumen').select('caja_id, numero, anio, mes, estado').in('caja_id', ids).order('numero', { ascending: false }) : { data: [] };
      ultimo = new Map(); (ps || []).forEach((p) => { if (!ultimo.has(p.caja_id)) ultimo.set(p.caja_id, p); });
      if (leerSesion('fin.caja.nueva')) { guardarSesion('fin.caja.nueva', ''); nueva = true; caja = null; }
      else { const g = Number(leerSesion('fin.caja')); caja = cajas.find((x) => x.id === (id || g)) || cajas[0] || null; nueva = !caja; }
      await cargarTipos();
      pintar();
    }
    async function cargarTipos() {
      tipos = [];
      if (!caja) return;
      const { data, error } = await sb.from('caja_tipos_gasto').select('*').eq('caja_id', caja.id).order('orden');
      if (!error) tipos = (data || []).map((x) => ({ tipo_gasto: x.tipo_gasto, cuenta_id: x.cuenta_id }));
    }

    function pintar() { pintarLista(); pintarFicha(); }
    function pintarLista() {
      const q = buscar.trim().toLowerCase();
      const filas = cajas.filter((c) => !q || [c.codigo, c.nombre, c.responsable, c.tipo_caja].some((v) => String(v || '').toLowerCase().includes(q)));
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab tg-cab"><h2>Cajas de la empresa <small>${cajas.length}</small></h2>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar caja, responsable…" value="${esc(buscar)}" aria-label="Buscar cajas"></label></header>
        <div class="ta-tabla"><table class="bmc-tabla dc-tabla"><colgroup><col style="width:58px"><col><col style="width:20%"><col style="width:17%"><col style="width:96px"></colgroup>
          <thead><tr><th class="num">Caja</th><th>Nombre</th><th>Responsable</th><th>Tipo</th><th>Estado</th></tr></thead>
          <tbody>${filas.map((c) => `<tr data-caja="${c.id}" class="${caja && caja.id === c.id ? 'actual' : ''} ${c.activa ? '' : 'pc-anulada'}" tabindex="0">
            <td class="num fuerte">${c.codigo}</td><td title="${esc(c.nombre)}"><b>${esc(c.nombre)}</b><small>${esc(contable(c.cuenta_id) ? `${contable(c.cuenta_id).codigo} · ${contable(c.cuenta_id).nombre}` : 'Sin cuenta principal')}</small></td>
            <td>${esc(c.responsable || '')}</td><td><span class="pc-tipo">${esc(c.tipo_caja)}</span></td>
            <td><span class="pc-marca ${c.activa ? 'aprobada' : 'anulada'}">${c.activa ? 'Activa' : 'Inactiva'}</span></td></tr>`).join('')
            || `<tr><td colspan="5" class="tk-vacio"><i class="ti ti-cash-register" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : cajas.length ? 'Ninguna caja coincide con la búsqueda.' : 'La empresa no tiene cajas: crea la primera con «Nueva caja».'}</td></tr>`}</tbody>
        </table></div>`;
    }

    const cuentaCampo = (name, etq, id, dis, clase = '') => { const k = contable(id); return `<label class="campo ${clase}"><span>${etq}</span><input list="dc-cuentas" name="${name}" value="${esc(k ? k.codigo : '')}" placeholder="Código" ${dis}><small class="cc-nombre-cta" data-nombre-de="${name}">${k ? esc(k.nombre) : ''}</small></label>`; };
    const centroCampo = (name, etq, id, dis) => { const k = centro(id); return `<label class="campo"><span>${etq}</span><input list="dc-centros" name="${name}" value="${esc(k ? k.codigo : '')}" placeholder="Código" ${dis}><small class="cc-nombre-cta" data-nombre-de="${name}">${k ? esc(k.nombre) : ''}</small></label>`; };

    function pintarFicha(v0) {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-cash-register'); return; }
      if (!caja && !nueva) { ctx.pDet.innerHTML = ctx.vacio('Elige una caja o crea una nueva.', 'ti-cash-register'); return; }
      const c = caja;
      const dis = ctx.admin ? '' : 'disabled';
      const iva = contables.find((x) => x.movimiento && /IVA/i.test(x.nombre));
      const v = v0 || (c ? { ...c } : { nombre: '', responsable: '', tipo_caja: 'CAJA CHICA', modalidad: 'NORMAL', moneda_id: ctx.monedaBase()?.id, monto_fondo: '', cuenta_iva_id: iva?.id || null, activa: true, carga_masiva: false, verifica_liquidacion: false });
      const u = c ? ultimo.get(c.id) : null;
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form bm-form dc-form" novalidate>
          <header class="tk-titulo bm-titulo">
            <span class="tk-icono"><i class="ti ti-cash-register" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>Definición de la caja</small><h2>${c ? `Caja ${c.codigo} · ${esc(c.nombre)}` : 'Nueva caja'}</h2></div>
            <div class="tk-marcas">${c ? `<span class="pc-marca ${c.activa ? 'aprobada' : 'anulada'}">${c.activa ? 'Activa' : 'Inactiva'}</span>` : ''}${u ? `<span class="pc-marca ${u.estado === 'ABIERTA' ? 'pendiente' : 'definitiva'}">Subcaja ${u.numero}</span>` : ''}</div>
            <div class="tk-titulo-acciones">
              ${!c && cajas.length ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}
              ${c ? '<a class="boton secundario-sm" href="#/caja-bancos/cajas-chicas" data-accion="operar"><i class="ti ti-arrow-right" aria-hidden="true"></i> Operar la caja</a>' : ''}
              ${ctx.admin ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${c ? 'Guardar cambios' : 'Crear caja'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          ${sinScript ? '<p class="bu-nota"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Falta ejecutar en Supabase el script 20261106000120_definicion_y_liquidacion_cajas.sql para guardar la vinculación de cuentas y los tipos de gasto.</p>' : ''}
          <div class="dc-grid">
            <section class="bm-bloque dc-caja">
              <h3 class="ta-col-titulo"><i class="ti ti-id" aria-hidden="true"></i> Caja</h3>
              <div class="dc-campos">
                <div class="bs-req-num"><span>No. caja</span><b>${c ? c.codigo : 'Auto'}</b></div>
                <label class="campo dc-c3"><span>Nombre *</span><input name="nombre" value="${esc(v.nombre || '')}" maxlength="80" ${dis}></label>
                <label class="campo dc-c2"><span>Responsable</span><input name="responsable" value="${esc(v.responsable || '')}" maxlength="80" ${dis}></label>
                <label class="campo dc-c2"><span>Tipo de movimiento</span><select name="tipo_caja" ${dis}>${TIPOS_CAJA.map((t) => `<option ${v.tipo_caja === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
                <div class="campo dc-c2"><span>Modalidad</span><div class="cc-radios">${[['NORMAL', 'Normal'], ['LIQUIDACION', 'Liquidación']].map(([k, t]) => `<label class="pc-check"><input type="radio" name="modalidad" value="${k}" ${v.modalidad === k ? 'checked' : ''} ${dis}> ${t}</label>`).join('')}</div></div>
                <label class="pc-check dc-activa"><input type="checkbox" name="activa" ${v.activa ? 'checked' : ''} ${dis}> Activa</label>
                <label class="campo"><span>Moneda</span><select name="moneda_id" ${dis}>${ctx.monedas.map((m) => `<option value="${m.id}" ${v.moneda_id === m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
                <label class="campo dc-c2"><span>Transacción</span><select name="transaccion_id" ${dis}><option value="">—</option>${transacciones.filter((t) => t.estado === 'ACTIVO' || t.id === v.transaccion_id).slice().sort((a, b) => String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es')).map((t) => `<option value="${t.id}" ${t.id === v.transaccion_id ? 'selected' : ''}>${esc(t.descripcion || '')} · ${t.numero}</option>`).join('')}</select></label>
                <label class="campo dc-c2"><span>Usuario que liquida</span><input list="dc-usuarios" name="usuario_liquida" value="${esc(v.usuario_liquida || '')}" maxlength="40" placeholder="Usuario" ${dis}><small class="cc-nombre-cta" data-usuario>${esc(usuarios.find((x) => x.usuario?.toUpperCase() === String(v.usuario_liquida || '').toUpperCase())?.nombre || '')}</small></label>
                ${cuentaCampo('cuenta', 'Cuenta principal (haber)', v.cuenta_id, dis, 'dc-c2')}
                ${centroCampo('centro_costo', 'Centro de costo', v.centro_costo_id, dis)}
                ${centroCampo('centro_alterno', 'Centro alterno', v.centro_alterno_id, dis)}
                <label class="campo dc-monto"><span>Monto asignado</span><input type="number" step="0.01" min="0" name="monto_fondo" value="${esc(String(v.monto_fondo ?? ''))}" ${dis}></label>
                <label class="campo dc-c3"><span>Cuenta bancaria de reintegro</span><select name="cuenta_bancaria_id" ${dis}><option value="">—</option>${cuentas.filter((x) => x.activo || x.id === v.cuenta_bancaria_id).map((x) => `<option value="${x.id}" ${x.id === v.cuenta_bancaria_id ? 'selected' : ''}>${esc(ctx.nombreCuentaBancaria(x))}</option>`).join('')}</select></label>
                ${cuentaCampo('cuenta_iva', 'IVA por cobrar (debe)', v.cuenta_iva_id, dis, 'dc-c2')}
                ${cuentaCampo('cuenta_retencion', 'Retenciones (haber)', v.cuenta_retencion_id, dis, 'dc-c2')}
              </div>
            </section>
            <div class="dc-derecha">
              <section class="bm-bloque dc-vinc">
                <h3 class="ta-col-titulo"><i class="ti ti-link" aria-hidden="true"></i> Vinculación de cuentas · contabilización carga masiva</h3>
                <div class="dc-checks"><label class="pc-check"><input type="checkbox" name="carga_masiva" ${v.carga_masiva ? 'checked' : ''} ${dis}> Carga masiva</label><label class="pc-check"><input type="checkbox" name="verifica_liquidacion" ${v.verifica_liquidacion ? 'checked' : ''} ${dis}> Verifica liquidación</label></div>
                <div class="dc-campos dc-tres">
                  ${cuentaCampo('cuenta_caja', 'Cuenta de la caja', v.cuenta_caja_id, dis)}
                  ${cuentaCampo('cuenta_anticipo', 'Cuenta de anticipo', v.cuenta_anticipo_id, dis)}
                  <label class="campo"><span>Cuenta de migración</span><input name="cuenta_migracion" value="${esc(v.cuenta_migracion || '')}" maxlength="40" placeholder="Del sistema anterior" ${dis}></label>
                </div>
              </section>
              <section class="bm-bloque dc-tipos">
                <h3 class="ta-col-titulo"><i class="ti ti-list-details" aria-hidden="true"></i> Tipos de gasto <small>${tipos.length}</small>
                  <span class="dc-tipos-acc">${ctx.admin && c ? '<button type="button" class="boton secundario-sm" data-accion="cargar-cuentas" title="Trae las cuentas de gasto que usan los documentos de la caja"><i class="ti ti-download" aria-hidden="true"></i> Cargar cuentas</button>' : ''}${ctx.admin ? '<button type="button" class="rp-enlace" data-accion="agregar-tipo"><i class="ti ti-plus" aria-hidden="true"></i> Agregar</button>' : ''}</span></h3>
                <div class="pc-lineas dc-tipos-tabla"><table><thead><tr><th>Tipo de gasto</th><th>Cuenta</th><th>Nombre de la cuenta</th><th></th></tr></thead>
                  <tbody>${tipos.map((t, i) => { const k = contable(t.cuenta_id); return `<tr data-tipo="${i}"><td><input data-campo="tipo_gasto" value="${esc(t.tipo_gasto || '')}" maxlength="60" aria-label="Tipo de gasto" ${dis}></td>
                    <td><input list="dc-cuentas" data-campo="cuenta" value="${esc(k ? k.codigo : '')}" aria-label="Cuenta del tipo de gasto" ${dis}></td><td class="cc-nombre" data-nombre-tipo>${esc(k ? k.nombre : '')}</td>
                    <td>${ctx.admin ? `<button type="button" class="icono-boton" data-quitar-tipo="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`; }).join('')
                    || `<tr><td colspan="4" class="tk-vacio">Sin tipos de gasto.${ctx.admin && c ? ' Usa «Cargar cuentas» o «Agregar».' : ''}</td></tr>`}</tbody></table></div>
              </section>
              <section class="bm-bloque bm-control dc-control">
                <h3 class="ta-col-titulo"><i class="ti ti-shield-check" aria-hidden="true"></i> Control</h3>
                <dl>
                  <div class="bm-dato"><dt>Creó</dt><dd>${c ? `${esc(c.creado_por_nombre || '')} <small>${esc(fmt.fechaHora(c.creado_en))}</small>` : esc((yo.usuario || '').toUpperCase())}</dd></div>
                  <div class="bm-dato"><dt>Modificó</dt><dd>${c?.modificado_en ? `${esc(c.modificado_por_nombre || '')} <small>${esc(fmt.fechaHora(c.modificado_en))}</small>` : '<span class="tk-tenue">—</span>'}</dd></div>
                  <div class="bm-dato"><dt>Subcaja actual</dt><dd>${u ? `${u.numero} · ${u.anio}-${String(u.mes).padStart(2, '0')}` : '<span class="tk-tenue">—</span>'}</dd></div>
                </dl>
              </section>
            </div>
          </div>
          <datalist id="dc-cuentas">${contables.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('')}</datalist>
          <datalist id="dc-centros">${centros.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('')}</datalist>
          <datalist id="dc-usuarios">${usuarios.map((x) => `<option value="${esc(x.usuario.toUpperCase())}">${esc(x.nombre || '')}</option>`).join('')}</datalist>
        </form>`;
    }

    function leerTipos(form) {
      form.querySelectorAll('tr[data-tipo]').forEach((tr) => {
        const t = tipos[Number(tr.dataset.tipo)];
        t.tipo_gasto = tr.querySelector('[data-campo=tipo_gasto]').value.trim().toUpperCase();
        const k = porCodigo(tr.querySelector('[data-campo=cuenta]').value);
        t.cuenta_id = k ? k.id : null;
        t._codigo = tr.querySelector('[data-campo=cuenta]').value.trim();
      });
    }
    function leer(form) {
      const el = form.elements;
      const cta = (n) => { const t = el[n].value.trim(); const k = porCodigo(t); return { id: k ? k.id : null, mal: !!t && !k }; };
      const cen = (n) => { const t = el[n].value.trim(); const k = centroPorCodigo(t); return { id: k ? k.id : null, mal: !!t && !k }; };
      const c1 = cta('cuenta'), c2 = cta('cuenta_iva'), c3 = cta('cuenta_retencion'), c4 = cta('cuenta_caja'), c5 = cta('cuenta_anticipo');
      const n1 = cen('centro_costo'), n2 = cen('centro_alterno');
      leerTipos(form);
      const v = {
        nombre: el.nombre.value.trim(), responsable: el.responsable.value.trim() || null, tipo_caja: el.tipo_caja.value,
        modalidad: form.querySelector('[name=modalidad]:checked')?.value || 'NORMAL', activa: el.activa.checked,
        centro_costo_id: n1.id, centro_alterno_id: n2.id, moneda_id: Number(el.moneda_id.value), monto_fondo: fmt.redondear(el.monto_fondo.value),
        cuenta_bancaria_id: el.cuenta_bancaria_id.value ? Number(el.cuenta_bancaria_id.value) : null,
        cuenta_id: c1.id, cuenta_iva_id: c2.id, cuenta_retencion_id: c3.id
      };
      const extra = {
        transaccion_id: el.transaccion_id.value ? Number(el.transaccion_id.value) : null, usuario_liquida: el.usuario_liquida.value.trim().toUpperCase() || null,
        carga_masiva: el.carga_masiva.checked, verifica_liquidacion: el.verifica_liquidacion.checked, cuenta_caja_id: c4.id, cuenta_anticipo_id: c5.id,
        cuenta_migracion: el.cuenta_migracion.value.trim() || null
      };
      const mal = [[c1, 'cuenta', 'La cuenta principal'], [c2, 'cuenta_iva', 'La cuenta del IVA'], [c3, 'cuenta_retencion', 'La cuenta de retenciones'], [c4, 'cuenta_caja', 'La cuenta de la caja'],
        [c5, 'cuenta_anticipo', 'La cuenta de anticipo'], [n1, 'centro_costo', 'El centro de costo'], [n2, 'centro_alterno', 'El centro alterno']].find(([x]) => x.mal);
      return { v, extra, mal };
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      const { v, extra, mal } = leer(form);
      if (!v.nombre) { error.textContent = 'Escribe el nombre de la caja.'; return form.elements.nombre.focus(); }
      if (mal) { error.textContent = `${mal[2]} no es de movimiento en el catálogo de la localidad.`; return form.elements[mal[1]].focus(); }
      const tmal = tipos.find((t) => t._codigo && !t.cuenta_id);
      if (tmal) { error.textContent = `La cuenta ${tmal._codigo} del tipo de gasto ${tmal.tipo_gasto} no es de movimiento.`; return; }
      error.textContent = '';
      const boton = form.querySelector('[type=submit]'); boton.disabled = true;
      const datos = sinScript ? v : { ...v, ...extra };
      let r = caja ? await sb.from('cajas_chicas').update(datos).eq('id', caja.id).select('id').single()
        : await sb.from('cajas_chicas').insert({ ...datos, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single();
      // Sin el script 120 se guarda solo lo que ya existía.
      if (r.error && /carga_masiva|cuenta_caja|usuario_liquida|transaccion_id|cuenta_migracion/.test(r.error.message || '')) {
        sinScript = true;
        r = caja ? await sb.from('cajas_chicas').update(v).eq('id', caja.id).select('id').single()
          : await sb.from('cajas_chicas').insert({ ...v, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single();
      }
      if (r.error) { boton.disabled = false; error.textContent = window.UI.traducirError(r.error); return; }
      const id = r.data.id;
      if (!sinScript) {
        const del = await sb.from('caja_tipos_gasto').delete().eq('caja_id', id);
        const ts = tipos.filter((t) => t.tipo_gasto);
        const ins = !del.error && ts.length ? await sb.from('caja_tipos_gasto').insert(ts.map((t, i) => ({ caja_id: id, orden: i + 1, tipo_gasto: t.tipo_gasto, cuenta_id: t.cuenta_id }))) : { error: del.error };
        if (ins.error) window.FIN.aviso(`Caja guardada, pero los tipos de gasto no: ${window.UI.traducirError(ins.error)}`);
      }
      boton.disabled = false;
      window.FIN.aviso(caja ? 'Caja guardada' : 'Caja creada');
      guardarSesion('fin.caja', String(id));
      nueva = false; caja = { id };
      await consultar(id);
    }

    async function cargarCuentas(form) {
      leerTipos(form);
      const { data: ps } = await sb.from('caja_periodos').select('id').eq('caja_id', caja.id);
      const ids = (ps || []).map((p) => p.id);
      const usadas = new Map();
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await sb.from('caja_documentos').select('cuenta_gasto_id, clasificacion').in('periodo_id', ids.slice(i, i + 200)).not('cuenta_gasto_id', 'is', null);
        (data || []).forEach((d) => { if (!usadas.has(d.cuenta_gasto_id)) usadas.set(d.cuenta_gasto_id, d.clasificacion); });
      }
      let n = 0;
      usadas.forEach((cl, cid) => {
        if (tipos.some((t) => t.cuenta_id === cid)) return;
        const k = contable(cid);
        tipos.push({ tipo_gasto: (k?.nombre || cl || 'GASTO').toUpperCase().slice(0, 60), cuenta_id: cid }); n += 1;
      });
      window.FIN.aviso(n ? `${n} cuentas de gasto cargadas: revisa y presiona «Guardar cambios»` : 'No hay cuentas de gasto nuevas en los documentos de la caja');
      pintarFicha(leer(form).v && { ...caja, ...leer(form).v, ...leer(form).extra });
    }

    // ---------- Reportes (PDF y Excel) del listado ----------
    const filasReporte = () => cajas.map((c) => { const k = contable(c.cuenta_id); const u = ultimo.get(c.id); return { c, k, u }; });
    function pdf() {
      if (!cajas.length) return window.FIN.aviso('No hay cajas');
      const l = ctx.localidad(ctx.sel.loc);
      imprimir('Definición de Cajas', `<h1>Definición de Cajas</h1><h2>Empresa: ${esc(l ? `${l.codigo} · ${l.nombre_comercial}` : '')} · Cajas: ${esc(f.estado)} · ${cajas.length} cajas</h2>
        <table><thead><tr><th>Caja</th><th>Nombre</th><th>Responsable</th><th>Tipo</th><th>Cuenta principal</th><th>Usuario liquida</th><th class="n">Monto asignado</th><th>Subcaja actual</th><th>Estado</th></tr></thead><tbody>
        ${filasReporte().map(({ c, k, u }) => `<tr><td>${c.codigo}</td><td>${esc(c.nombre)}</td><td>${esc(c.responsable || '')}</td><td>${esc(c.tipo_caja)}</td><td>${esc(k ? `${k.codigo} ${k.nombre}` : '')}</td><td>${esc(c.usuario_liquida || '')}</td><td class="n">${esc(simbolo(c.moneda_id))} ${fmt.monto(c.monto_fondo)}</td><td>${u ? `${u.numero} · ${u.anio}-${String(u.mes).padStart(2, '0')}` : ''}</td><td>${c.activa ? 'Activa' : 'Inactiva'}</td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="6">Total asignado (activas)</td><td class="n">${fmt.monto(cajas.filter((c) => c.activa).reduce((t, c) => t + Number(c.monto_fondo || 0), 0))}</td><td colspan="2"></td></tr></tfoot></table>`, { locId: ctx.sel.loc });
    }
    function excel() {
      if (!cajas.length) return window.FIN.aviso('No hay cajas');
      const l = ctx.localidad(ctx.sel.loc);
      window.REPORTE_XLSX.generar({
        titulo: 'Definición de Cajas', parametros: [`Empresa: ${l ? `${l.codigo} · ${l.nombre_comercial}` : ''}`, `Cajas: ${f.estado}`, `${cajas.length} cajas`],
        orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Cajas', archivo: `definicion_cajas_${l?.codigo || ''}`, autofiltro: true,
        columnas: [{ titulo: 'Caja', ancho: 7 }, { titulo: 'Nombre', ancho: 38 }, { titulo: 'Responsable', ancho: 22 }, { titulo: 'Tipo', ancho: 18 }, { titulo: 'Cuenta principal', ancho: 14 }, { titulo: 'Nombre de la cuenta', ancho: 32 },
          { titulo: 'Usuario liquida', ancho: 14 }, { titulo: 'Monto asignado', ancho: 15, tipo: 'monto' }, { titulo: 'Subcaja actual', ancho: 14 }, { titulo: 'Estado', ancho: 10 }],
        filas: filasReporte().map(({ c, k, u }) => ({ tenue: !c.activa, valores: [c.codigo, c.nombre, c.responsable || '', c.tipo_caja, k?.codigo || '', k?.nombre || '', c.usuario_liquida || '', Number(c.monto_fondo || 0), u ? `${u.numero} · ${u.anio}-${String(u.mes).padStart(2, '0')}` : '', c.activa ? 'Activa' : 'Inactiva'] }))
      });
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { caja = null; return cargarLocalidad(); }
      if (cambio === 'otro' && e.target.name === 'estado') { f.estado = e.target.value; return consultar(); }
      const form = e.target.closest('.dc-form');
      if (!form) return;
      if (e.target.list?.id === 'dc-cuentas' || e.target.list?.id === 'dc-centros') {
        const k = e.target.list.id === 'dc-cuentas' ? contables.find((x) => x.codigo === e.target.value.trim()) : centros.find((x) => x.codigo === e.target.value.trim());
        const txt = k ? (k.movimiento ? esc(k.nombre) : '<span class="pc-error">Agrupa a otras: usa una de movimiento</span>') : e.target.value.trim() ? '<span class="pc-error">No existe en el catálogo</span>' : '';
        const n = e.target.name ? form.querySelector(`[data-nombre-de="${e.target.name}"]`) : e.target.closest('tr')?.querySelector('[data-nombre-tipo]');
        if (n) n.innerHTML = txt;
      }
      if (e.target.name === 'usuario_liquida') { const x = usuarios.find((y) => y.usuario?.toUpperCase() === e.target.value.trim().toUpperCase()); form.querySelector('[data-usuario]').textContent = x?.nombre || ''; }
    });
    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-buscar]')) return;
      buscar = e.target.value; const pos = e.target.selectionStart; pintarLista();
      const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
    });
    cont.addEventListener('click', async (e) => {
      const fila = e.target.closest('tr[data-caja]');
      if (fila && ctx.pMae.contains(fila)) { caja = cajas.find((c) => String(c.id) === fila.dataset.caja); nueva = false; guardarSesion('fin.caja', String(caja.id)); await cargarTipos(); return pintar(); }
      const qt = e.target.closest('[data-quitar-tipo]');
      if (qt) { const form = ctx.pDet.querySelector('.dc-form'); const x = leer(form); tipos.splice(Number(qt.dataset.quitarTipo), 1); return pintarFicha({ ...caja, ...x.v, ...x.extra }); }
      const ac = e.target.closest('[data-accion]');
      if (!ac) return;
      const a = ac.dataset.accion;
      if (a === 'pdf') return pdf();
      if (a === 'excel') return excel();
      if (a === 'nueva') { caja = null; nueva = true; tipos = []; pintarLista(); return pintarFicha(); }
      if (a === 'cancelar') { nueva = false; return consultar(); }
      if (a === 'operar' && caja) guardarSesion('fin.caja', String(caja.id));
      const form = ctx.pDet.querySelector('.dc-form');
      if (a === 'agregar-tipo' && form) { const x = leer(form); tipos.push({ tipo_gasto: '', cuenta_id: null }); pintarFicha({ ...(caja || {}), ...x.v, ...x.extra }); return ctx.pDet.querySelector('tr[data-tipo]:last-child [data-campo=tipo_gasto]')?.focus(); }
      if (a === 'cargar-cuentas' && form) return cargarCuentas(form);
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.dc-form')) { e.preventDefault(); guardar(e.target); } });

    iniciar();
  };
})();
