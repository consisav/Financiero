// Catálogos · Objetos contables, con dos pantallas (pestañas) por organización y localidad:
//   Definición de objetos: maestro de objetos y, en el detalle, sus cuentas (cuentas x objeto) y
//   sus transacciones (transacciones x objeto, con la cuenta bancaria).
//   Transacciones: maestro de transacciones (plantillas de partida) y, en el detalle, su
//   encabezado (estado, aplica póliza, tipo de operación) y sus cuentas (debe o haber, orden,
//   operación, centro de costo y columna para nóminas). Imprimir plantillas.
(function () {
  const { esc } = window.UI;

  const OPERACIONES = ['TOTAL', 'SUBTOTAL', 'IMPUESTO', 'RETENCIÓN', 'DESCUENTO', 'OTRO'];
  const zona = { timeZone: 'America/Guatemala', hour12: false };
  const fechaCorta = (f) => f ? new Date(f).toLocaleString('es-GT', { ...zona, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '';
  // La organización y localidad elegidas se conservan al cambiar de pestaña.
  const seleccion = { org: null, loc: null };

  // Base común: parámetros (organización, localidad), pestañas, maestro arriba y detalle abajo.
  function base(cont, pestana) {
    const sb = window.FIN.sb;
    const yo = window.FIN.perfil();
    const ctx = {
      sb, yo, admin: window.FIN.puedeEditarCatalogos(), organizaciones: [], localidades: [],
      cuentas: [], centros: [], catalogoId: null
    };
    if (!seleccion.org) { seleccion.org = yo.organizacion_id || null; seleccion.loc = yo.localidad_id || null; }
    cont.innerHTML = `
      <div class="ta-espacio ta-apilado oc-espacio">
        <section class="ta-filtros oc-filtros" id="oc-filtros"></section>
        <div class="ta-cuerpo">
          <section class="tk-bandeja ta-maestro" id="oc-maestro"></section>
          <section class="tk-detalle ta-detalle" id="oc-detalle"></section>
        </div>
      </div>`;
    ctx.espacio = cont.querySelector('.ta-espacio');
    ctx.pFil = cont.querySelector('#oc-filtros');
    ctx.pMae = cont.querySelector('#oc-maestro');
    ctx.pDet = cont.querySelector('#oc-detalle');

    ctx.ajustarAlto = function () {
      if (!ctx.espacio.isConnected) return window.removeEventListener('resize', ctx.ajustarAlto);
      const arriba = ctx.espacio.getBoundingClientRect().top + window.scrollY;
      const alto = Math.max(600, window.innerHeight - arriba - 16);
      ctx.espacio.style.setProperty('--tk-alto', `${alto}px`);
      const sobra = document.documentElement.scrollHeight - window.innerHeight;
      if (sobra > 0 && alto - sobra >= 600) ctx.espacio.style.setProperty('--tk-alto', `${alto - sobra}px`);
    };
    window.addEventListener('resize', ctx.ajustarAlto);

    ctx.cargarBase = async function () {
      ctx.ajustarAlto();
      const [o, l] = await Promise.all([
        sb.from('organizaciones').select('id, codigo, nombre').eq('activo', true).order('codigo'),
        sb.from('localidades').select('id, codigo, correlativo, nombre_comercial, organizacion_id').eq('activo', true).order('organizacion_id').order('correlativo')
      ]);
      ctx.organizaciones = o.data || [];
      ctx.localidades = l.data || [];
      if (!seleccion.org) seleccion.org = ctx.organizaciones[0]?.id || null;
      if (!ctx.localidades.some((x) => x.id === seleccion.loc && x.organizacion_id === seleccion.org)) {
        seleccion.loc = ctx.localidades.find((x) => x.organizacion_id === seleccion.org)?.id || null;
      }
    };

    // Cuentas y centros de costo de la localidad (versiones activas más recientes).
    ctx.cargarCatalogos = async function () {
      ctx.cuentas = []; ctx.centros = []; ctx.catalogoId = null;
      if (!seleccion.loc) return;
      const [k, kc] = await Promise.all([
        sb.from('catalogos_cuentas').select('id').eq('localidad_id', seleccion.loc).eq('activo', true).order('version', { ascending: false }).limit(1),
        sb.from('catalogos_centros').select('id').eq('localidad_id', seleccion.loc).eq('activo', true).order('version', { ascending: false }).limit(1)
      ]);
      ctx.catalogoId = k.data?.[0]?.id || null;
      const [c, cc] = await Promise.all([
        ctx.catalogoId ? sb.from('cuentas').select('id, codigo, nombre, cuenta_mayor_id, vigente').eq('catalogo_id', ctx.catalogoId).order('codigo') : { data: [] },
        kc.data?.[0] ? sb.from('centros_costo').select('id, codigo, nombre, centro_mayor_id, vigente').eq('catalogo_id', kc.data[0].id).order('codigo') : { data: [] }
      ]);
      const padres = new Set((c.data || []).map((x) => x.cuenta_mayor_id).filter(Boolean));
      ctx.cuentas = (c.data || []).map((x) => ({ ...x, movimiento: !padres.has(x.id) && x.vigente }));
      const padresC = new Set((cc.data || []).map((x) => x.centro_mayor_id).filter(Boolean));
      ctx.centros = (cc.data || []).filter((x) => !padresC.has(x.id) && x.vigente);
    };

    ctx.pintarFiltros = function (extra = '') {
      const locs = ctx.localidades.filter((x) => x.organizacion_id === seleccion.org);
      ctx.pFil.innerHTML = `
        <div class="ta-titulo"><span class="tk-icono"><i class="ti ti-box" aria-hidden="true"></i></span><div><small>Objetos contables</small><h2>${pestana === 'definicion' ? 'Definición de objetos' : 'Transacciones'}</h2></div></div>
        <label class="campo"><span>Organización</span><select name="org">${ctx.organizaciones.map((o) => `<option value="${o.id}" ${seleccion.org === o.id ? 'selected' : ''}>${o.codigo} · ${esc(o.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Localidad</span><select name="loc">${locs.map((x) => `<option value="${x.id}" ${seleccion.loc === x.id ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre_comercial)}</option>`).join('') || '<option value="">Sin localidades</option>'}</select></label>
        <nav class="oc-pestanas" aria-label="Objetos contables">
          <a href="#/contabilidad/objetos-definicion" class="${pestana === 'definicion' ? 'activa' : ''}"><i class="ti ti-category" aria-hidden="true"></i> Definición de objetos</a>
          <a href="#/contabilidad/objetos-transacciones" class="${pestana === 'transacciones' ? 'activa' : ''}"><i class="ti ti-arrows-exchange" aria-hidden="true"></i> Transacciones</a>
        </nav>
        <div class="oc-extra">${extra}</div>`;
    };

    // Cambio de organización o localidad: se vuelve a consultar.
    ctx.alCambiarFiltro = function (e, recargar) {
      if (!e.target.closest('#oc-filtros')) return false;
      if (e.target.name === 'org') {
        seleccion.org = Number(e.target.value);
        seleccion.loc = ctx.localidades.find((x) => x.organizacion_id === seleccion.org)?.id || null;
      } else if (e.target.name === 'loc') seleccion.loc = e.target.value ? Number(e.target.value) : null;
      else return false;
      recargar();
      return true;
    };

    ctx.cuentaPorCodigo = (cod, soloMovimiento) => ctx.cuentas.find((c) => c.codigo === cod && (!soloMovimiento || c.movimiento));
    ctx.botonesFila = (id, puede) => `
      <td class="tk-acciones">
        <button type="button" class="tk-accion-btn" data-modificar="${id}"><i class="ti ${puede ? 'ti-pencil' : 'ti-eye'}" aria-hidden="true"></i> ${puede ? 'Modificar' : 'Ver'}</button>
        <button type="button" class="tk-accion-btn peligro" data-eliminar="${id}" ${puede ? '' : 'disabled'} title="${puede ? 'Eliminar' : 'Solo un administrador'}"><i class="ti ti-trash" aria-hidden="true"></i> Eliminar</button>
      </td>`;
    return ctx;
  }

  window.PANTALLAS = window.PANTALLAS || {};

  // ===================== Definición de objetos =====================
  window.PANTALLAS['objetos-definicion'] = function (cont) {
    const ctx = base(cont, 'definicion');
    const { sb } = ctx;
    let objetos = [];
    let transacciones = [];
    let actual = null;
    let cuentasObj = [];    // { cuenta_id, linea }
    let transObj = [];      // { transaccion_id, cuenta_bancaria }
    let buscar = '';

    async function iniciar() {
      await ctx.cargarBase();
      ctx.pintarFiltros();
      const prueba = await sb.from('objetos_contables').select('id').limit(1);
      if (prueba.error) {
        ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/objetos_contables/.test(prueba.error.message) ? 'Falta instalar el script 36 (objetos contables) en Supabase.' : esc(prueba.error.message)}</p></section>`;
        return;
      }
      await consultar();
    }

    async function consultar() {
      await ctx.cargarCatalogos();
      if (!seleccion.loc) { objetos = []; transacciones = []; pintarMaestro(); return abrir(null); }
      const [o, t] = await Promise.all([
        sb.from('objetos_contables').select('*, cuentas:objeto_cuentas(count), transacciones:objeto_transacciones(count)').eq('localidad_id', seleccion.loc).order('numero'),
        sb.from('transacciones_contables').select('id, numero, descripcion, estado').eq('localidad_id', seleccion.loc).order('numero')
      ]);
      objetos = o.data || [];
      transacciones = t.data || [];
      if (actual && !objetos.some((x) => x.id === actual.id)) actual = null;
      pintarMaestro();
      await abrir(actual ? objetos.find((x) => x.id === actual.id) : objetos[0] || null);
    }

    function pintarMaestro() {
      const q = buscar.trim().toLowerCase();
      const filas = objetos.filter((x) => !q || `${x.numero} ${x.descripcion}`.toLowerCase().includes(q));
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab tg-cab">
          <h2>Definición de objetos contables <small>${objetos.length}</small></h2>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar objeto…" value="${esc(buscar)}" aria-label="Buscar objetos"></label>
          ${ctx.admin && seleccion.loc ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo objeto</button>' : ''}
        </header>
        <div class="ta-tabla">
          <table>
            <thead><tr><th>Objeto</th><th>Descripción</th><th class="num">No. cuentas</th><th class="num">No. transacciones</th><th>Estado</th><th><span class="oculto">Acciones</span></th></tr></thead>
            <tbody>
              ${filas.map((x) => `
                <tr class="${actual && actual.id === x.id ? 'actual' : ''}" data-fila="${x.id}" tabindex="0">
                  <td class="fuerte">${x.numero}</td>
                  <td>${esc(x.descripcion)}</td>
                  <td class="num">${x.cuentas?.[0]?.count ?? 0}</td>
                  <td class="num">${x.transacciones?.[0]?.count ?? 0}</td>
                  <td>${window.UI.estado(x.activo)}</td>
                  ${ctx.botonesFila(x.id, ctx.admin)}
                </tr>`).join('') || `<tr><td colspan="6" class="tk-vacio"><i class="ti ti-box" aria-hidden="true"></i>${objetos.length ? 'Ningún objeto coincide con la búsqueda.' : 'Todavía no hay objetos contables en esta localidad.'}</td></tr>`}
            </tbody>
          </table>
        </div>`;
    }

    async function abrir(x) {
      actual = x;
      cuentasObj = [];
      transObj = [];
      if (x) {
        const [c, t] = await Promise.all([
          sb.from('objeto_cuentas').select('cuenta_id, linea').eq('objeto_id', x.id).order('id'),
          sb.from('objeto_transacciones').select('transaccion_id, cuenta_bancaria').eq('objeto_id', x.id).order('id')
        ]);
        cuentasObj = (c.data || []).map((r) => ({ cuenta_id: r.cuenta_id, linea: r.linea || '' }));
        transObj = (t.data || []).map((r) => ({ transaccion_id: r.transaccion_id, cuenta_bancaria: r.cuenta_bancaria || '' }));
      }
      if (!cuentasObj.length) cuentasObj.push({ cuenta_id: null, linea: '' });
      if (!transObj.length) transObj.push({ transaccion_id: null, cuenta_bancaria: '' });
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-fila]').forEach((tr) => tr.classList.toggle('actual', !!x && tr.dataset.fila === String(x.id)));
    }

    function filaCuenta(r, i, dis) {
      const c = ctx.cuentas.find((x) => x.id === r.cuenta_id);
      return `<tr data-cta="${i}">
        <td class="pc-cta"><input list="oc-cuentas" data-campo="cuenta" value="${esc(c ? c.codigo : '')}" placeholder="Código" ${dis} aria-label="Cuenta ${i + 1}"></td>
        <td class="pc-nombre" data-nombre>${esc(c ? c.nombre : '')}</td>
        <td class="oc-linea"><input data-campo="linea" value="${esc(r.linea)}" maxlength="20" ${dis} aria-label="Línea ${i + 1}"></td>
        <td>${dis ? '' : `<button type="button" class="icono-boton" data-quitar-cta="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>`}</td></tr>`;
    }
    function filaTrans(r, i, dis) {
      const t = transacciones.find((x) => x.id === r.transaccion_id);
      return `<tr data-tra="${i}">
        <td class="oc-trans"><select data-campo="transaccion" ${dis} aria-label="Transacción ${i + 1}"><option value="">Elegir…</option>${transacciones.map((x) => `<option value="${x.id}" ${r.transaccion_id === x.id ? 'selected' : ''}>${x.numero}</option>`).join('')}</select></td>
        <td class="pc-nombre" data-nombre>${esc(t ? t.descripcion : '')}</td>
        <td><input data-campo="banco" value="${esc(r.cuenta_bancaria)}" maxlength="40" placeholder="No. de cuenta bancaria" ${dis} aria-label="Cuenta bancaria ${i + 1}"></td>
        <td>${dis ? '' : `<button type="button" class="icono-boton" data-quitar-tra="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>`}</td></tr>`;
    }

    function pintarDetalle() {
      const x = actual;
      if (!seleccion.loc) { ctx.pDet.innerHTML = '<div class="tk-vacio ta-elige"><i class="ti ti-building" aria-hidden="true"></i>Elige la organización y la localidad.</div>'; return; }
      const dis = ctx.admin ? '' : 'disabled';
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form oc-form" novalidate>
          <header class="tk-titulo">
            <span class="tk-icono"><i class="ti ti-category" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>Objeto contable</small><h2>${x ? `Objeto ${x.numero}` : 'Nuevo objeto'}</h2></div>
            <label class="campo oc-desc"><span>Descripción *</span><input name="descripcion" value="${esc(x ? x.descripcion : '')}" maxlength="120" placeholder="Ej. PROVEEDORES, CRÉDITOS, IMPUESTOS…" ${dis}></label>
            <label class="pc-check"><input type="checkbox" name="activo" ${!x || x.activo ? 'checked' : ''} ${dis}> Activo</label>
            <div class="tk-titulo-acciones">${ctx.admin ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${x ? 'Guardar cambios' : 'Crear objeto'}</button>` : ''}</div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          ${!ctx.catalogoId ? '<p class="tk-aviso"><i class="ti ti-alert-triangle" aria-hidden="true"></i> La localidad no tiene un catálogo de cuentas activo.</p>' : ''}
          <div class="ta-det-grid oc-grid">
            <div class="ta-col">
              <div class="pc-detalle-cab"><h3 class="ta-col-titulo"><i class="ti ti-list-tree" aria-hidden="true"></i> Cuentas x objeto</h3>${ctx.admin ? '<button type="button" class="rp-enlace" data-agregar="cta"><i class="ti ti-plus" aria-hidden="true"></i> Agregar cuenta</button>' : ''}</div>
              <div class="pc-lineas"><table><thead><tr><th class="pc-cta">Cuenta</th><th>Nombre</th><th>Línea</th><th></th></tr></thead>
                <tbody data-tabla="cta">${cuentasObj.map((r, i) => filaCuenta(r, i, dis)).join('')}</tbody></table></div>
            </div>
            <div class="ta-col">
              <div class="pc-detalle-cab"><h3 class="ta-col-titulo"><i class="ti ti-arrows-exchange" aria-hidden="true"></i> Transacciones x objeto</h3>${ctx.admin ? '<button type="button" class="rp-enlace" data-agregar="tra"><i class="ti ti-plus" aria-hidden="true"></i> Agregar transacción</button>' : ''}</div>
              <div class="pc-lineas"><table><thead><tr><th>Transacción</th><th>Descripción</th><th>Cuenta bancaria</th><th></th></tr></thead>
                <tbody data-tabla="tra">${transObj.map((r, i) => filaTrans(r, i, dis)).join('')}</tbody></table></div>
              ${!transacciones.length ? '<p class="rp-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> Crea las transacciones en la pestaña Transacciones.</p>' : ''}
            </div>
          </div>
          <datalist id="oc-cuentas">${ctx.cuentas.map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>
        </form>`;
    }

    function leerFilas() {
      ctx.pDet.querySelectorAll('tr[data-cta]').forEach((tr) => {
        const r = cuentasObj[Number(tr.dataset.cta)];
        const cod = tr.querySelector('[data-campo=cuenta]').value.trim();
        const c = ctx.cuentaPorCodigo(cod, false);
        r.cuenta_id = c ? c.id : null;
        r.linea = tr.querySelector('[data-campo=linea]').value.trim();
        tr.querySelector('[data-nombre]').innerHTML = c ? esc(c.nombre) : cod ? '<span class="pc-error">Cuenta no encontrada</span>' : '';
      });
      ctx.pDet.querySelectorAll('tr[data-tra]').forEach((tr) => {
        const r = transObj[Number(tr.dataset.tra)];
        r.transaccion_id = Number(tr.querySelector('[data-campo=transaccion]').value) || null;
        r.cuenta_bancaria = tr.querySelector('[data-campo=banco]').value.trim();
        const t = transacciones.find((x) => x.id === r.transaccion_id);
        tr.querySelector('[data-nombre]').textContent = t ? t.descripcion : '';
      });
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      leerFilas();
      const d = { descripcion: form.elements.descripcion.value.trim(), activo: form.elements.activo.checked };
      if (!d.descripcion) { error.textContent = 'Escribe la descripción del objeto.'; return; }
      const ctas = cuentasObj.filter((r) => r.cuenta_id);
      if (cuentasObj.some((r, i) => !r.cuenta_id && ctx.pDet.querySelector(`tr[data-cta="${i}"] [data-campo=cuenta]`).value.trim())) { error.textContent = 'Hay cuentas que no existen en el catálogo de la localidad.'; return; }
      if (new Set(ctas.map((r) => r.cuenta_id)).size !== ctas.length) { error.textContent = 'Una cuenta está repetida en el objeto.'; return; }
      const tras = transObj.filter((r) => r.transaccion_id);
      if (new Set(tras.map((r) => r.transaccion_id)).size !== tras.length) { error.textContent = 'Una transacción está repetida en el objeto.'; return; }
      error.textContent = '';
      let id = actual?.id;
      const eraNuevo = !actual;
      try {
        if (actual) {
          const r = await sb.from('objetos_contables').update(d).eq('id', id);
          if (r.error) throw r.error;
          const [a, b] = await Promise.all([sb.from('objeto_cuentas').delete().eq('objeto_id', id), sb.from('objeto_transacciones').delete().eq('objeto_id', id)]);
          if (a.error || b.error) throw a.error || b.error;
        } else {
          const r = await sb.from('objetos_contables').insert({ ...d, organizacion_id: seleccion.org, localidad_id: seleccion.loc }).select('id').single();
          if (r.error) throw r.error;
          id = r.data.id;
        }
        if (ctas.length) { const r = await sb.from('objeto_cuentas').insert(ctas.map((x) => ({ objeto_id: id, cuenta_id: x.cuenta_id, linea: x.linea || null }))); if (r.error) throw r.error; }
        if (tras.length) { const r = await sb.from('objeto_transacciones').insert(tras.map((x) => ({ objeto_id: id, transaccion_id: x.transaccion_id, cuenta_bancaria: x.cuenta_bancaria || null }))); if (r.error) throw r.error; }
        window.FIN.aviso(actual ? 'Objeto guardado' : 'Objeto creado');
        actual = { id };
        await consultar();
      } catch (err) {
        const texto = window.UI.traducirError(err);
        // Si el encabezado se creó pero falló el detalle, se abre el registro creado para corregirlo.
        if (eraNuevo && id) { actual = { id }; await consultar(); }
        const e2 = ctx.pDet.querySelector(".modal-error");
        if (e2) e2.textContent = texto;
      }
    }

    cont.addEventListener('change', (e) => {
      if (ctx.alCambiarFiltro(e, () => { actual = null; ctx.pintarFiltros(); consultar(); })) return;
      if (e.target.closest('tr[data-cta], tr[data-tra]')) leerFilas();
    });
    cont.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar]')) {
        buscar = e.target.value;
        const pos = e.target.selectionStart;
        pintarMaestro();
        const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
        return;
      }
      if (e.target.closest('tr[data-cta]')) leerFilas();
    });
    cont.addEventListener('click', async (e) => {
      const m = e.target.closest('[data-modificar]');
      if (m) { await abrir(objetos.find((x) => String(x.id) === m.dataset.modificar)); return ctx.pDet.querySelector('[name=descripcion]')?.focus(); }
      const el = e.target.closest('[data-eliminar]');
      if (el) {
        const x = objetos.find((o) => String(o.id) === el.dataset.eliminar);
        if (!confirm(`¿Eliminar el objeto ${x.numero} · ${x.descripcion} con sus cuentas y transacciones?`)) return;
        const { error } = await sb.from('objetos_contables').delete().eq('id', x.id);
        if (error) return window.FIN.aviso(window.UI.traducirError(error));
        window.FIN.aviso('Objeto eliminado');
        if (actual && actual.id === x.id) actual = null;
        return consultar();
      }
      const fila = e.target.closest('tr[data-fila]');
      if (fila) return abrir(objetos.find((x) => String(x.id) === fila.dataset.fila));
      if (e.target.closest('[data-accion=nuevo]')) return abrir(null);
      const ag = e.target.closest('[data-agregar]');
      if (ag) {
        leerFilas();
        if (ag.dataset.agregar === 'cta') cuentasObj.push({ cuenta_id: null, linea: '' }); else transObj.push({ transaccion_id: null, cuenta_bancaria: '' });
        const valores = { descripcion: ctx.pDet.querySelector('[name=descripcion]').value, activo: ctx.pDet.querySelector('[name=activo]').checked };
        pintarDetalle();
        ctx.pDet.querySelector('[name=descripcion]').value = valores.descripcion;
        ctx.pDet.querySelector('[name=activo]').checked = valores.activo;
        return ctx.pDet.querySelector(`[data-tabla=${ag.dataset.agregar}] tr:last-child input, [data-tabla=${ag.dataset.agregar}] tr:last-child select`)?.focus();
      }
      const qc = e.target.closest('[data-quitar-cta], [data-quitar-tra]');
      if (qc) {
        leerFilas();
        if (qc.dataset.quitarCta !== undefined) cuentasObj.splice(Number(qc.dataset.quitarCta), 1); else transObj.splice(Number(qc.dataset.quitarTra), 1);
        if (!cuentasObj.length) cuentasObj.push({ cuenta_id: null, linea: '' });
        if (!transObj.length) transObj.push({ transaccion_id: null, cuenta_bancaria: '' });
        const valores = { descripcion: ctx.pDet.querySelector('[name=descripcion]').value, activo: ctx.pDet.querySelector('[name=activo]').checked };
        pintarDetalle();
        ctx.pDet.querySelector('[name=descripcion]').value = valores.descripcion;
        ctx.pDet.querySelector('[name=activo]').checked = valores.activo;
      }
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.oc-form')) { e.preventDefault(); guardar(e.target); } });

    iniciar();
  };

  // ===================== Transacciones =====================
  window.PANTALLAS['objetos-transacciones'] = function (cont) {
    const ctx = base(cont, 'transacciones');
    const { sb } = ctx;
    let transacciones = [];
    let actual = null;
    let lineas = [];        // { cuenta_id, naturaleza, orden, operacion, centro_id, columna_nomina }
    let buscar = '';
    const nuevaLinea = (n) => ({ cuenta_id: null, cuenta_codigo: "", naturaleza: 'D', orden: n, operacion: 'TOTAL', centro_id: null, columna_nomina: '' });

    async function iniciar() {
      await ctx.cargarBase();
      ctx.pintarFiltros('<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir plantillas</button>');
      const prueba = await sb.from('transacciones_contables').select('id').limit(1);
      if (prueba.error) {
        ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/transacciones_contables/.test(prueba.error.message) ? 'Falta instalar el script 36 (objetos contables) en Supabase.' : esc(prueba.error.message)}</p></section>`;
        return;
      }
      await consultar();
    }

    async function consultar() {
      await ctx.cargarCatalogos();
      if (!seleccion.loc) { transacciones = []; pintarMaestro(); return abrir(null); }
      const { data } = await sb.from('transacciones_contables').select('*, cuentas:transaccion_cuentas(count)').eq('localidad_id', seleccion.loc).order('numero');
      transacciones = data || [];
      if (actual && !transacciones.some((x) => x.id === actual.id)) actual = null;
      pintarMaestro();
      await abrir(actual ? transacciones.find((x) => x.id === actual.id) : transacciones[0] || null);
    }

    function pintarMaestro() {
      const q = buscar.trim().toLowerCase();
      const filas = transacciones.filter((x) => !q || `${x.numero} ${x.descripcion} ${x.tipo_operacion || ''}`.toLowerCase().includes(q));
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab tg-cab">
          <h2>Transacciones <small>${transacciones.length}</small></h2>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar transacción…" value="${esc(buscar)}" aria-label="Buscar transacciones"></label>
          ${ctx.admin && seleccion.loc ? '<button type="button" class="boton primario-sm" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva transacción</button>' : ''}
        </header>
        <div class="ta-tabla">
          <table>
            <thead><tr><th>#</th><th>Descripción</th><th>Estado</th><th>Aplica póliza</th><th>Tipo operación (migración doctos)</th><th class="num">Cuentas</th><th>Usr ingresa</th><th>Fecha ingresa</th><th>Usr modifica</th><th>Fecha modifica</th><th><span class="oculto">Acciones</span></th></tr></thead>
            <tbody>
              ${filas.map((x) => `
                <tr class="${actual && actual.id === x.id ? 'actual' : ''}" data-fila="${x.id}" tabindex="0">
                  <td class="fuerte">${x.numero}</td>
                  <td>${esc(x.descripcion)}</td>
                  <td>${window.UI.estado(x.estado === 'ACTIVO')}</td>
                  <td>${x.aplica_poliza ? '<i class="ti ti-square-check marca-si" aria-label="Sí"></i>' : '<i class="ti ti-square marca-no" aria-label="No"></i>'}</td>
                  <td>${esc(x.tipo_operacion || '')}</td>
                  <td class="num">${x.cuentas?.[0]?.count ?? 0}</td>
                  <td>${esc(x.creado_por_nombre || '')}</td>
                  <td>${esc(fechaCorta(x.creado_en))}</td>
                  <td>${esc(x.modificado_por_nombre || '')}</td>
                  <td>${esc(fechaCorta(x.modificado_en))}</td>
                  ${ctx.botonesFila(x.id, ctx.admin)}
                </tr>`).join('') || `<tr><td colspan="11" class="tk-vacio"><i class="ti ti-arrows-exchange" aria-hidden="true"></i>${transacciones.length ? 'Ninguna transacción coincide con la búsqueda.' : 'Todavía no hay transacciones en esta localidad.'}</td></tr>`}
            </tbody>
          </table>
        </div>`;
    }

    async function abrir(x) {
      actual = x;
      lineas = [];
      if (x) {
        const { data } = await sb.from('transaccion_cuentas').select('*').eq('transaccion_id', x.id).order('linea');
        lineas = (data || []).map((l) => ({ cuenta_id: l.cuenta_id, cuenta_codigo: l.cuenta_codigo || "", naturaleza: l.naturaleza, orden: l.orden, operacion: l.operacion, centro_id: l.centro_id, columna_nomina: l.columna_nomina || '' }));
      }
      if (!lineas.length) lineas = [nuevaLinea(1), { ...nuevaLinea(2), naturaleza: 'H' }];
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-fila]').forEach((tr) => tr.classList.toggle('actual', !!x && tr.dataset.fila === String(x.id)));
    }

    // Línea con un código que todavía no existe en el catálogo de la localidad.
    const pendiente = '<span class="oc-pendiente" title="La línea se guarda con este código y se liga sola cuando la cuenta exista en el catálogo de la localidad"><i class="ti ti-clock-exclamation" aria-hidden="true"></i> Cuenta pendiente: no existe en el catálogo</span>';
    function filaLinea(l, i, dis) {
      const c = ctx.cuentas.find((x) => x.id === l.cuenta_id);
      const cc = ctx.centros.find((x) => x.id === l.centro_id);
      return `<tr data-linea="${i}">
        <td class="pc-n">${i + 1}</td>
        <td class="pc-cta"><input list="oc-cuentas-mov" data-campo="cuenta" value="${esc(c ? c.codigo : l.cuenta_codigo || '')}" placeholder="Código" ${dis} aria-label="Cuenta de la línea ${i + 1}"></td>
        <td class="pc-nombre" data-nombre-cuenta>${c ? esc(c.nombre) : l.cuenta_codigo ? pendiente : ''}</td>
        <td class="oc-dh"><label title="Debe"><input type="radio" name="dh${i}" value="D" ${l.naturaleza === 'D' ? 'checked' : ''} ${dis}> D</label><label title="Haber"><input type="radio" name="dh${i}" value="H" ${l.naturaleza === 'H' ? 'checked' : ''} ${dis}> H</label></td>
        <td class="oc-orden"><input type="number" min="1" data-campo="orden" value="${l.orden ?? ''}" ${dis} aria-label="Orden de la línea ${i + 1}"></td>
        <td class="oc-oper"><select data-campo="operacion" ${dis} aria-label="Operación de la línea ${i + 1}">${OPERACIONES.map((o) => `<option ${l.operacion === o ? 'selected' : ''}>${o}</option>`).join('')}</select></td>
        <td class="pc-cc"><input list="oc-centros" data-campo="centro" value="${esc(cc ? cc.codigo : '')}" placeholder="Código" ${dis} aria-label="Centro de costo de la línea ${i + 1}"></td>
        <td class="pc-nombre" data-nombre-centro>${esc(cc ? cc.nombre : '')}</td>
        <td class="oc-col"><input data-campo="columna" value="${esc(l.columna_nomina)}" maxlength="40" ${dis} aria-label="Columna para nóminas de la línea ${i + 1}"></td>
        <td>${dis ? '' : `<button type="button" class="icono-boton" data-quitar-linea="${i}" aria-label="Quitar la línea ${i + 1}"><i class="ti ti-x" aria-hidden="true"></i></button>`}</td></tr>`;
    }

    function pintarDetalle(valores) {
      const x = actual;
      if (!seleccion.loc) { ctx.pDet.innerHTML = '<div class="tk-vacio ta-elige"><i class="ti ti-building" aria-hidden="true"></i>Elige la organización y la localidad.</div>'; return; }
      // Código sugerido para una transacción nueva: el siguiente de la localidad.
      const sugerido = Math.max(1000, ...transacciones.map((t) => t.numero)) + 1;
      const v = valores || (x ? { numero: x.numero, descripcion: x.descripcion, estado: x.estado, aplica_poliza: x.aplica_poliza, tipo_operacion: x.tipo_operacion || '' } : { numero: sugerido, descripcion: '', estado: 'ACTIVO', aplica_poliza: true, tipo_operacion: '' });
      const dis = ctx.admin ? '' : 'disabled';
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form ot-form" novalidate>
          <header class="tk-titulo">
            <span class="tk-icono"><i class="ti ti-arrows-exchange" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>Transacción</small><h2>${x ? `Transacción ${x.numero}` : 'Nueva transacción'}</h2></div>
            <div class="tk-titulo-acciones">${ctx.admin ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${x ? 'Guardar cambios' : 'Crear transacción'}</button>` : ''}</div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          ${!ctx.catalogoId ? '<p class="tk-aviso"><i class="ti ti-alert-triangle" aria-hidden="true"></i> La localidad no tiene un catálogo de cuentas activo.</p>' : ''}
          <div class="pc-encabezado ot-encabezado">
            <label class="campo ot-codigo"><span>Código *</span><input type="number" name="numero" min="1" step="1" value="${esc(String(v.numero ?? ''))}" ${dis} aria-label="Código de la transacción"></label>
            <label class="campo pc-desc"><span>Descripción *</span><input name="descripcion" value="${esc(v.descripcion)}" maxlength="150" placeholder="Ej. DEPÓSITOS VARIOS, NOTAS DE CRÉDITO…" ${dis}></label>
            <label class="campo"><span>Estado</span><select name="estado" ${dis}><option ${v.estado === 'ACTIVO' ? 'selected' : ''}>ACTIVO</option><option ${v.estado === 'INACTIVO' ? 'selected' : ''}>INACTIVO</option></select></label>
            <label class="pc-check ot-aplica"><input type="checkbox" name="aplica_poliza" ${v.aplica_poliza ? 'checked' : ''} ${dis}> Aplica póliza</label>
            <label class="campo"><span>Tipo operación (migración doctos)</span><input name="tipo_operacion" value="${esc(v.tipo_operacion)}" maxlength="40" ${dis}></label>
            <div class="ta-auto pc-auto"><span>Ingresó</span><b>${esc(x?.creado_por_nombre || '—')}</b><small>${esc(fechaCorta(x?.creado_en)) || '&nbsp;'}</small></div>
            <div class="ta-auto pc-auto"><span>Modificó</span><b>${esc(x?.modificado_por_nombre || '—')}</b><small>${esc(fechaCorta(x?.modificado_en)) || '&nbsp;'}</small></div>
          </div>
          <section class="pc-detalle">
            <div class="pc-detalle-cab">
              <h3 class="ta-col-titulo"><i class="ti ti-list-details" aria-hidden="true"></i> Cuentas x transacción</h3>
              ${ctx.admin ? '<button type="button" class="rp-enlace" data-accion="linea"><i class="ti ti-plus" aria-hidden="true"></i> Agregar línea</button>' : ''}
            </div>
            <div class="pc-lineas">
              <table>
                <thead><tr><th class="pc-n">Línea</th><th class="pc-cta">Cuenta</th><th>Nombre</th><th>D / H</th><th>Orden</th><th>Operación</th><th class="pc-cc">Centro costo</th><th>Nombre centro</th><th>Columna (nóminas)</th><th></th></tr></thead>
                <tbody>${lineas.map((l, i) => filaLinea(l, i, dis)).join('')}</tbody>
              </table>
            </div>
            <datalist id="oc-cuentas-mov">${ctx.cuentas.filter((c) => c.movimiento).map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>
            <datalist id="oc-centros">${ctx.centros.map((c) => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join('')}</datalist>
          </section>
        </form>`;
    }

    const leerEncabezado = (form) => ({
      numero: Number(form.elements.numero.value) || null,
      descripcion: form.elements.descripcion.value.trim(), estado: form.elements.estado.value,
      aplica_poliza: form.elements.aplica_poliza.checked, tipo_operacion: form.elements.tipo_operacion.value.trim() || null
    });

    function leerLineas() {
      ctx.pDet.querySelectorAll('tr[data-linea]').forEach((tr) => {
        const l = lineas[Number(tr.dataset.linea)];
        const cod = tr.querySelector('[data-campo=cuenta]').value.trim();
        const c = ctx.cuentaPorCodigo(cod, true);
        const existe = ctx.cuentas.find((x) => x.codigo === cod);
        l.cuenta_id = c ? c.id : null;
        l.cuenta_codigo = cod;
        tr.querySelector('[data-nombre-cuenta]').innerHTML = c ? esc(c.nombre) : existe ? '<span class="pc-error">Agrupa a otras cuentas: usa una cuenta de movimiento</span>' : cod ? pendiente : '';
        const codc = tr.querySelector('[data-campo=centro]').value.trim();
        const cc = ctx.centros.find((x) => x.codigo === codc);
        l.centro_id = cc ? cc.id : null;
        tr.querySelector('[data-nombre-centro]').innerHTML = cc ? esc(cc.nombre) : codc ? '<span class="pc-error">Centro no encontrado</span>' : '';
        l.naturaleza = tr.querySelector('input[type=radio]:checked')?.value || 'D';
        l.orden = Number(tr.querySelector('[data-campo=orden]').value) || null;
        l.operacion = tr.querySelector('[data-campo=operacion]').value;
        l.columna_nomina = tr.querySelector('[data-campo=columna]').value.trim();
      });
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      leerLineas();
      const d = leerEncabezado(form);
      if (!d.numero || d.numero < 1 || !Number.isInteger(d.numero)) { error.textContent = 'Escribe el código de la transacción (número entero mayor que cero).'; form.elements.numero.focus(); return; }
      if (transacciones.some((t) => t.numero === d.numero && (!actual || t.id !== actual.id))) { error.textContent = `Ya existe la transacción ${d.numero} en esta localidad: usa otro código.`; form.elements.numero.focus(); return; }
      if (!d.descripcion) { error.textContent = 'Escribe la descripción de la transacción.'; return; }
      const validas = lineas.filter((l) => l.cuenta_id || l.cuenta_codigo);
      // Una cuenta que existe pero agrupa a otras no sirve; un código que no existe queda pendiente.
      const mala = lineas.findIndex((l) => !l.cuenta_id && l.cuenta_codigo && ctx.cuentas.some((x) => x.codigo === l.cuenta_codigo));
      if (mala >= 0) { error.textContent = `La cuenta de la línea ${mala + 1} agrupa a otras cuentas: usa una cuenta de movimiento.`; return; }
      error.textContent = '';
      let id = actual?.id;
      const eraNuevo = !actual;
      try {
        if (actual) {
          const r = await sb.from('transacciones_contables').update(d).eq('id', id);
          if (r.error) throw r.error;
          const del = await sb.from('transaccion_cuentas').delete().eq('transaccion_id', id);
          if (del.error) throw del.error;
        } else {
          const r = await sb.from('transacciones_contables').insert({ ...d, organizacion_id: seleccion.org, localidad_id: seleccion.loc }).select('id').single();
          if (r.error) throw r.error;
          id = r.data.id;
        }
        if (validas.length) {
          const r = await sb.from('transaccion_cuentas').insert(validas.map((l, i) => ({
            transaccion_id: id, linea: i + 1, cuenta_id: l.cuenta_id || null, cuenta_codigo: l.cuenta_codigo || null, naturaleza: l.naturaleza, orden: l.orden, operacion: l.operacion, centro_id: l.centro_id || null, columna_nomina: l.columna_nomina || null
          })));
          if (r.error) throw r.error;
        }
        window.FIN.aviso(actual ? 'Transacción guardada' : 'Transacción creada');
        actual = { id };
        await consultar();
      } catch (err) {
        const texto = window.UI.traducirError(err);
        // Si el encabezado se creó pero falló el detalle, se abre el registro creado para corregirlo.
        if (eraNuevo && id) { actual = { id }; await consultar(); }
        const e2 = ctx.pDet.querySelector(".modal-error");
        if (e2) e2.textContent = texto;
      }
    }

    // Imprime todas las transacciones de la localidad con sus cuentas.
    async function imprimirPlantillas() {
      const ids = transacciones.map((t) => t.id);
      const { data } = ids.length ? await sb.from('transaccion_cuentas').select('*').in('transaccion_id', ids).order('linea') : { data: [] };
      const org = ctx.organizaciones.find((o) => o.id === seleccion.org);
      const loc = ctx.localidades.find((l) => l.id === seleccion.loc);
      const cuerpo = transacciones.map((t) => {
        const ls = (data || []).filter((l) => l.transaccion_id === t.id);
        return `<h3>${t.numero} · ${esc(t.descripcion)} <small>${esc(t.estado)}${t.aplica_poliza ? ' · aplica póliza' : ''}${t.tipo_operacion ? ` · ${esc(t.tipo_operacion)}` : ''}</small></h3>
          <table><thead><tr><th>Línea</th><th>Cuenta</th><th>Nombre</th><th>D/H</th><th>Orden</th><th>Operación</th><th>Centro de costo</th><th>Columna</th></tr></thead><tbody>
          ${ls.map((l) => { const c = ctx.cuentas.find((x) => x.id === l.cuenta_id); const cc = ctx.centros.find((x) => x.id === l.centro_id); return `<tr><td>${l.linea}</td><td>${esc(c?.codigo || l.cuenta_codigo || '')}</td><td>${esc(c?.nombre || (l.cuenta_codigo ? '(cuenta pendiente)' : ''))}</td><td>${l.naturaleza}</td><td>${l.orden ?? ''}</td><td>${esc(l.operacion)}</td><td>${esc(cc ? `${cc.codigo} ${cc.nombre}` : '')}</td><td>${esc(l.columna_nomina || '')}</td></tr>`; }).join('') || '<tr><td colspan="8">Sin cuentas</td></tr>'}
          </tbody></table>`;
      }).join('');
      const v = window.open('', '_blank');
      if (!v) return window.FIN.aviso('Permite las ventanas emergentes para imprimir');
      v.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Plantillas de transacciones</title><style>
        body{font:12px/1.4 Arial,sans-serif;color:#111;margin:28px}h1{font-size:16px;margin:0 0 4px}h2{font-size:12px;font-weight:normal;color:#555;margin:0 0 16px}
        h3{font-size:13px;margin:18px 0 6px}h3 small{font-weight:normal;color:#666}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:3px 6px;text-align:left}th{background:#eee;font-size:11px}
        @media print{body{margin:10mm}h3{break-after:avoid}table{break-inside:avoid}}</style></head><body>
        <h1>Plantillas de transacciones</h1><h2>${esc(org?.nombre || '')} · ${esc(loc ? `${loc.codigo} ${loc.nombre_comercial}` : '')} · ${transacciones.length} transacciones</h2>
        ${cuerpo || '<p>No hay transacciones.</p>'}<script>window.onload=()=>window.print()<\/script></body></html>`);
      v.document.close();
    }

    cont.addEventListener('change', (e) => {
      if (ctx.alCambiarFiltro(e, () => { actual = null; ctx.pintarFiltros('<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir plantillas</button>'); consultar(); })) return;
      if (e.target.closest('tr[data-linea]')) leerLineas();
    });
    cont.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar]')) {
        buscar = e.target.value;
        const pos = e.target.selectionStart;
        pintarMaestro();
        const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
        return;
      }
      if (e.target.closest('tr[data-linea]')) leerLineas();
    });
    cont.addEventListener('click', async (e) => {
      const m = e.target.closest('[data-modificar]');
      if (m) { await abrir(transacciones.find((x) => String(x.id) === m.dataset.modificar)); return ctx.pDet.querySelector('[name=descripcion]')?.focus(); }
      const el = e.target.closest('[data-eliminar]');
      if (el) {
        const x = transacciones.find((t) => String(t.id) === el.dataset.eliminar);
        if (!confirm(`¿Eliminar la transacción ${x.numero} · ${x.descripcion} con sus cuentas? También se quita de los objetos que la usan.`)) return;
        const { error } = await sb.from('transacciones_contables').delete().eq('id', x.id);
        if (error) return window.FIN.aviso(window.UI.traducirError(error));
        window.FIN.aviso('Transacción eliminada');
        if (actual && actual.id === x.id) actual = null;
        return consultar();
      }
      const fila = e.target.closest('tr[data-fila]');
      if (fila) return abrir(transacciones.find((x) => String(x.id) === fila.dataset.fila));
      const ac = e.target.closest('[data-accion]');
      if (ac) {
        if (ac.dataset.accion === 'nueva') return abrir(null);
        if (ac.dataset.accion === 'imprimir') return imprimirPlantillas();
        if (ac.dataset.accion === 'linea') {
          leerLineas();
          const v = leerEncabezado(ctx.pDet.querySelector('.ot-form'));
          lineas.push(nuevaLinea(lineas.length + 1));
          pintarDetalle({ ...v, tipo_operacion: v.tipo_operacion || '' });
          return ctx.pDet.querySelector('tr[data-linea]:last-child [data-campo=cuenta]')?.focus();
        }
      }
      const ql = e.target.closest('[data-quitar-linea]');
      if (ql) {
        leerLineas();
        const v = leerEncabezado(ctx.pDet.querySelector('.ot-form'));
        lineas.splice(Number(ql.dataset.quitarLinea), 1);
        if (!lineas.length) lineas.push(nuevaLinea(1));
        pintarDetalle({ ...v, tipo_operacion: v.tipo_operacion || '' });
      }
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.ot-form')) { e.preventDefault(); guardar(e.target); } });

    iniciar();
  };
})();
