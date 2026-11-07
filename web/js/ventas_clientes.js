// Facturación/Ventas · Catálogos · Clientes de cada organización y localidad (empresa).
//   A la izquierda el listado de clientes (número, tipo de documento, documento, nombre, razón social
//   y estado) con su búsqueda; a la derecha el cliente en un solo bloque: identificación (con la
//   validación del NIT y del CUI), contacto, vendedor, tipo de precio, bodega y modo de entrega, el
//   crédito (solo se cambia con «Modificar crédito cliente», que pide el motivo y queda en el
//   historial), la ubicación (país, departamento, municipio, código postal y dirección) y las
//   pestañas Datos de exportación e Historial de crédito. «Duplicar cliente» abre uno nuevo con los
//   mismos datos. Listado en PDF o Excel.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  const TIPOS_DOC = [['NIT', 'NIT'], ['CUI', 'CUI (DPI)'], ['PASAPORTE', 'Pasaporte'], ['EXTRANJERO', 'Extranjero'], ['CF', 'Consumidor final']];
  const TIPOS_CLIENTE = ['LOCAL', 'EXPORTACIÓN', 'GOBIERNO', 'RELACIONADO', 'EMPLEADO'];
  const ESTADOS = ['ACTIVO', 'INACTIVO', 'BLOQUEADO'];
  const ENTREGAS = ['OFICINA', 'RUTA', 'MENSAJERÍA', 'GUATEX', 'CARGO EXPRESO', 'OTRO'];
  const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
  const marcaEstado = (e) => `<span class="pc-marca ${e === 'ACTIVO' ? 'aprobada' : e === 'BLOQUEADO' ? 'anulada' : 'pendiente'}">${esc(e)}</span>`;

  // Dígito verificador del NIT de Guatemala (módulo 11, «K» cuando da 10).
  function nitValido(n) {
    const s = String(n || '').toUpperCase().replace(/[^0-9K]/g, '');
    if (s.length < 2) return false;
    const cuerpo = s.slice(0, -1);
    if (!/^\d+$/.test(cuerpo)) return false;
    let suma = 0;
    for (let i = 0; i < cuerpo.length; i++) suma += Number(cuerpo[cuerpo.length - 1 - i]) * (i + 2);
    const r = (11 - (suma % 11)) % 11;
    return s.slice(-1) === (r === 10 ? 'K' : String(r));
  }
  function pistaDocumento(tipo, doc) {
    if (!doc || tipo === 'CF') return '';
    if (tipo === 'NIT') return nitValido(doc) ? '<em class="cl-ok">· NIT válido</em>' : '<em class="cl-mal">· revisa el dígito verificador</em>';
    if (tipo === 'CUI') return /^\d{13}$/.test(String(doc).replace(/\s/g, '')) ? '<em class="cl-ok">· CUI de 13 dígitos</em>' : '<em class="cl-mal">· el CUI lleva 13 dígitos</em>';
    return '';
  }

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS.clientes = function (cont) {
    const ctx = montar(cont, { titulo: 'Listado de clientes', icono: 'ti-users', clase: 'bk-clientes cp-lado clb-pantalla', grupo: 'Ventas · Catálogos' });
    const { sb } = ctx;
    const f = { estado: 'ACTIVO', tipo: '', formato: 'PDF' };
    let lista = [], vendedores = [], precios = [], bodegas = [], paises = [];
    let actual = null, nuevo = false, credito = false, buscar = '', pestana = 'EXPORTACION';
    let historial = [];
    let base = null;   // datos de un cliente que se duplica

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Estado</span><select name="estado"><option value="">Todos</option>${ESTADOS.map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label class="campo"><span>Tipo de cliente</span><select name="tipo"><option value="">Todos</option>${TIPOS_CLIENTE.map((e) => `<option ${f.tipo === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label class="campo"><span>Formato</span><select name="formato">${['PDF', 'EXCEL'].map((x) => `<option ${f.formato === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`,
        `<button type="button" class="boton secundario-sm" data-accion="listado"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>
         ${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo cliente</button>' : ''}`);
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('clientes').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/clientes/.test(prueba.error.message) ? 'Falta instalar el script 60 (clientes) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      const { data } = await sb.from('paises').select('id, nombre, iso2').eq('activo', true).order('nombre');
      paises = data || [];
      pintarFiltros();
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc || 0;
      const [v, p, b] = await Promise.all([
        sb.from('vendedores').select('id, codigo, nombre, activo').eq('localidad_id', loc).order('codigo'),
        sb.from('tipos_precio').select('id, codigo, nombre, activo').eq('localidad_id', loc).order('codigo'),
        sb.from('bodegas').select('id, codigo, nombre, estado').eq('localidad_id', loc).order('codigo')
      ]);
      vendedores = v.data || []; precios = p.data || []; bodegas = b.data || [];
      actual = null; nuevo = false; credito = false;
      await consultar();
    }
    async function consultar(id = actual?.id) {
      if (!ctx.sel.loc) { lista = []; pintarLista(); return abrir(null); }
      let q = sb.from('clientes').select('*').eq('localidad_id', ctx.sel.loc).order('nombre');
      if (f.estado) q = q.eq('estado', f.estado);
      if (f.tipo) q = q.eq('tipo_cliente', f.tipo);
      const { data, error } = await q;
      if (error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      lista = data || [];
      pintarLista();
      await abrir(lista.find((c) => c.id === id) || (nuevo ? null : lista[0]) || null);
    }
    function pintarLista() {
      const q = buscar.trim().toLowerCase();
      const filas = lista.filter((c) => !q || [c.codigo, c.documento, c.nombre, c.razon_social, c.contacto, c.correo].some((v) => String(v || '').toLowerCase().includes(q)));
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab clb-cab"><h2>Clientes <small>${lista.length}</small></h2>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Nombre, NIT, código o correo…" value="${esc(buscar)}" aria-label="Buscar clientes"></label></header>
        <div class="ta-tabla cc-tabla clb-lista"><table><tbody>${filas.map((c) => `<tr data-id="${c.id}" class="${actual && actual.id === c.id ? 'actual' : ''} ${c.estado !== 'ACTIVO' ? 'pc-anulada' : ''}" tabindex="0">
            <td class="clb-item"><b title="${esc(c.nombre)}">${esc(c.nombre)}</b><small>${c.codigo} · ${c.tipo_documento === 'CF' ? 'Consumidor final' : `${esc(c.tipo_documento)} ${esc(c.documento)}`}</small></td>
            <td class="clb-marca">${c.estado !== 'ACTIVO' ? marcaEstado(c.estado) : c.forma_pago === 'CRÉDITO' ? '<span class="pc-marca aprobada">Crédito</span>' : '<span class="pc-marca">Contado</span>'}</td></tr>`).join('')
          || `<tr><td colspan="2" class="tk-vacio"><i class="ti ti-users" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : lista.length ? 'Ningún cliente coincide con la búsqueda.' : `No hay clientes${ctx.admin ? ': crea el primero con «Nuevo cliente».' : '.'}`}</td></tr>`}</tbody></table></div>`;
    }
    async function abrir(c) {
      actual = c; credito = false; historial = [];
      if (c) { const { data } = await sb.from('cliente_creditos').select('*').eq('cliente_id', c.id).order('fecha', { ascending: false }); historial = data || []; }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-id]').forEach((tr) => tr.classList.toggle('actual', !!c && tr.dataset.id === String(c.id)));
    }

    function pintarDetalle(v0) {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-users'); return; }
      const c = actual;
      if (!c && !nuevo) { ctx.pDet.innerHTML = ctx.vacio(ctx.admin ? 'Elige un cliente o crea uno nuevo.' : 'Elige un cliente.', 'ti-users'); return; }
      const dis = ctx.admin ? '' : 'disabled';
      const gt = paises.find((p) => p.iso2 === 'GT') || paises[0];
      const v = v0 || (c ? { ...c } : base ? { ...base } : { tipo_documento: 'NIT', estado: 'ACTIVO', tipo_cliente: 'LOCAL', modo_entrega: 'OFICINA', aplicar_detalle: true, forma_pago: 'CONTADO', dias_credito: 0, monto_credito: 0, pais_id: gt?.id || null });
      const disCred = !ctx.admin || (c && !credito) ? 'disabled' : '';
      const sel = (name, ops, val, extra = '') => `<select name="${name}" ${dis} ${extra}>${ops}</select>`;
      const opt = (l, id, txt = (x) => `${x.codigo} · ${esc(x.nombre)}`) => `<option value="">—</option>${l.filter((x) => x.activo !== false && (x.estado === undefined || x.estado === 'ACTIVO') || x.id === id).map((x) => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${txt(x)}</option>`).join('')}`;
      const tabs = [['EXPORTACION', 'Datos de exportación', 'ti-world-upload'], ['CREDITO', 'Historial de crédito', 'ti-history', historial.length]];
      ctx.pDet.innerHTML = `
        <form class="tk-form bm-form cp-form cl-form clb-form" novalidate>
          <header class="tk-titulo bm-titulo cpr-titulo"><span class="tk-icono clb-avatar">${esc((v.nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?')}</span>
            <div class="tk-titulo-texto"><small>${c ? `Cliente ${c.codigo} · ${c.tipo_documento === 'CF' ? 'consumidor final' : `${esc(c.tipo_documento)} ${esc(c.documento)}`}` : base ? 'Nuevo cliente (duplicado)' : 'Nuevo cliente'}</small><h2>${c ? esc(c.nombre) : 'Datos del cliente'}</h2></div>
            <div class="tk-titulo-acciones">
              ${c && ctx.admin ? '<button type="button" class="boton secundario-sm" data-accion="duplicar" title="Abre un cliente nuevo con estos mismos datos"><i class="ti ti-copy" aria-hidden="true"></i> Duplicar</button>' : ''}
              ${c && ctx.admin && !credito ? '<button type="button" class="boton secundario-sm" data-accion="credito"><i class="ti ti-credit-card" aria-hidden="true"></i> Modificar crédito</button>' : ''}
              ${nuevo ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}
              ${ctx.admin ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${c ? 'Guardar' : 'Crear cliente'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          <div class="dpb clb">
            <div class="dpb-control">
              <span><small>Estado</small><b class="${v.estado === 'ACTIVO' ? 'dpb-ok' : 'pc-rojo'}">${esc(v.estado || 'ACTIVO')}</b></span>
              <span><small>Tipo</small><b>${esc(v.tipo_cliente || 'LOCAL')}</b></span>
              <span><small>Pago</small><b>${v.forma_pago === 'CRÉDITO' ? `Crédito ${v.dias_credito} días` : 'Contado'}</b></span>
              ${c ? `<span><small>Creó</small><b>${esc(c.creado_por_nombre || '—')}</b><em>${esc(fmt.fechaHora(c.creado_en))}</em></span>` : ''}
              ${c?.modificado_en ? `<span><small>Modificó</small><b>${esc(c.modificado_por_nombre || '')}</b><em>${esc(fmt.fechaHora(c.modificado_en))}</em></span>` : ''}
            </div>
            <section class="bm-bloque dpb-banda">
              <h3 class="ta-col-titulo"><i class="ti ti-id" aria-hidden="true"></i> Identificación y contacto</h3>
              <div class="dpb-g clb-g1">
                ${c ? `<div class="campo clb-num"><span>Cliente</span><b>${c.codigo}</b></div>` : `<label class="campo"><span>Cliente</span><input type="number" min="1" name="codigo" placeholder="Auto" ${dis}></label>`}
                <label class="campo"><span>Tipo de documento</span>${sel('tipo_documento', TIPOS_DOC.map(([k, t]) => `<option value="${k}" ${v.tipo_documento === k ? 'selected' : ''}>${t}</option>`).join(''))}</label>
                <label class="campo"><span>Documento * <span data-pista>${pistaDocumento(v.tipo_documento, v.documento)}</span></span><input name="documento" value="${esc(v.tipo_documento === 'CF' ? 'CF' : v.documento || '')}" maxlength="25" ${dis || (v.tipo_documento === 'CF' ? 'disabled' : '')}></label>
                <label class="campo"><span>Nombre del cliente *</span><input name="nombre" value="${esc(v.nombre || '')}" maxlength="150" ${dis}></label>
                <label class="campo"><span>Estado</span>${sel('estado', ESTADOS.map((e) => `<option ${v.estado === e ? 'selected' : ''}>${e}</option>`).join(''))}</label>
                <label class="campo"><span>Tipo de cliente</span>${sel('tipo_cliente', TIPOS_CLIENTE.map((e) => `<option ${v.tipo_cliente === e ? 'selected' : ''}>${e}</option>`).join(''))}</label>
              </div>
              <div class="dpb-g clb-g2">
                <label class="campo"><span>Razón social</span><input name="razon_social" value="${esc(v.razon_social || '')}" maxlength="150" placeholder="Si se deja vacía, el nombre" ${dis}></label>
                <label class="campo"><span>Contacto</span><input name="contacto" value="${esc(v.contacto || '')}" maxlength="100" ${dis}></label>
                <label class="campo"><span>Teléfono</span><input name="telefono" value="${esc(v.telefono || '')}" maxlength="40" ${dis}></label>
                <label class="campo"><span>Correo electrónico</span><input type="email" name="correo" value="${esc(v.correo || '')}" maxlength="120" ${dis}></label>
              </div>
            </section>
            <section class="bm-bloque dpb-banda dpb-deposito">
              <div class="dpb-campos">
                <h3 class="ta-col-titulo"><i class="ti ti-briefcase" aria-hidden="true"></i> Comercial</h3>
                <div class="dpb-g clb-g3">
                  <label class="campo"><span>Vendedor</span>${sel('vendedor_id', opt(vendedores, v.vendedor_id))}</label>
                  <label class="campo"><span>Tipo de precio</span>${sel('tipo_precio_id', opt(precios, v.tipo_precio_id))}</label>
                  <label class="campo"><span>Bodega</span>${sel('bodega_id', opt(bodegas, v.bodega_id))}</label>
                  <label class="campo"><span>Modo de entrega</span>${sel('modo_entrega', ENTREGAS.map((e) => `<option ${v.modo_entrega === e ? 'selected' : ''}>${e}</option>`).join(''))}</label>
                  <label class="pc-check clb-chk"><input type="checkbox" name="aplicar_detalle" ${v.aplicar_detalle ? 'checked' : ''} ${dis}> Aplicar detalle</label>
                </div>
              </div>
              <div class="dpb-valor clb-credito ${credito ? 'cl-editando' : ''}">
                <span class="clb-cred-tit"><i class="ti ti-credit-card" aria-hidden="true"></i> Crédito</span>
                <div class="clb-cred-g">
                  <label class="campo"><span>Forma de pago</span><select name="forma_pago" ${disCred}>${['CONTADO', 'CRÉDITO'].map((e) => `<option ${v.forma_pago === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
                  <label class="campo"><span>Días</span><input type="number" min="0" max="365" name="dias_credito" value="${esc(String(v.dias_credito ?? 0))}" ${disCred || (v.forma_pago === 'CONTADO' ? 'disabled' : '')}></label>
                  <label class="campo"><span>Monto máximo Q</span><input type="number" step="0.01" min="0" name="monto_credito" value="${esc(String(v.monto_credito ?? 0))}" ${disCred || (v.forma_pago === 'CONTADO' ? 'disabled' : '')}></label>
                </div>
                ${credito ? `<label class="campo cl-motivo"><span>Motivo del cambio *</span><input name="motivo_credito" maxlength="200" placeholder="Por qué se cambia el crédito"></label>
                  <div class="clb-cred-acc"><button type="button" class="boton secundario-sm" data-accion="cancelar-credito">Cancelar</button><button type="button" class="boton primario-sm" data-accion="aplicar-credito"><i class="ti ti-check" aria-hidden="true"></i> Aplicar</button></div>` : ''}
              </div>
            </section>
            <section class="bm-bloque dpb-banda">
              <h3 class="ta-col-titulo"><i class="ti ti-map-pin" aria-hidden="true"></i> Ubicación</h3>
              <div class="dpb-g clb-g4">
                <label class="campo"><span>País</span><select name="pais_id" ${dis}></select></label>
                <label class="campo"><span>Departamento</span><select name="departamento_id" ${dis}></select></label>
                <label class="campo"><span>Municipio</span><select name="municipio_id" ${dis}></select></label>
                <label class="campo"><span>Cód. postal</span><input name="codigo_postal" value="${esc(v.codigo_postal || '')}" maxlength="10" ${dis}></label>
                <label class="campo"><span>Dirección</span><input name="direccion" value="${esc(v.direccion || '')}" maxlength="300" ${dis}></label>
              </div>
            </section>
          </div>
          <section class="bm-pestanas cp-tabs">
            <div class="bm-tabs-barra"><div class="rp-pestanas" role="tablist">${tabs.map(([k, t, i, n]) => `<button type="button" role="tab" data-pestana="${k}" class="${pestana === k ? 'activa' : ''}" aria-selected="${pestana === k}"><i class="ti ${i}" aria-hidden="true"></i> ${t}${n ? ` <b>${n}</b>` : ''}</button>`).join('')}</div></div>
            <div class="bm-panel cp-panel" data-panel="EXPORTACION" ${pestana === 'EXPORTACION' ? '' : 'hidden'}>
              <div class="dpb-g clb-g5">
                <label class="campo"><span>País de destino</span><select name="exp_pais_id" ${dis}><option value="">—</option>${paises.map((p) => `<option value="${p.id}" ${p.id === v.exp_pais_id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>
                <label class="campo"><span>Incoterm</span><select name="exp_incoterm" ${dis}><option value="">—</option>${INCOTERMS.map((x) => `<option ${v.exp_incoterm === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
                <label class="campo"><span>Código del comprador</span><input name="exp_codigo_comprador" value="${esc(v.exp_codigo_comprador || '')}" maxlength="40" ${dis}></label>
                <label class="campo"><span>Consignatario</span><input name="exp_consignatario" value="${esc(v.exp_consignatario || '')}" maxlength="150" ${dis}></label>
                <label class="campo"><span>Dirección en el exterior</span><input name="exp_direccion" value="${esc(v.exp_direccion || '')}" maxlength="300" ${dis}></label>
              </div>
              ${v.tipo_cliente !== 'EXPORTACIÓN' ? '<p class="cc-ingreso"><i class="ti ti-info-circle" aria-hidden="true"></i> Se usan cuando el tipo de cliente es «EXPORTACIÓN».</p>' : ''}
            </div>
            <div class="bm-panel cp-panel" data-panel="CREDITO" ${pestana === 'CREDITO' ? '' : 'hidden'}>
              <div class="pc-lineas"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Antes</th><th>Después</th><th>Motivo</th></tr></thead>
                <tbody>${historial.map((h) => `<tr><td>${esc(fmt.fechaHora(h.fecha))}</td><td>${esc(h.usuario || '')}</td><td>${esc(h.forma_anterior || '')}${h.forma_anterior === 'CRÉDITO' ? ` · ${h.dias_anterior} días · Q ${fmt.monto(h.monto_anterior)}` : ''}</td><td class="fuerte">${esc(h.forma_pago)}${h.forma_pago === 'CRÉDITO' ? ` · ${h.dias_credito} días · Q ${fmt.monto(h.monto_credito)}` : ''}</td><td>${esc(h.motivo)}</td></tr>`).join('')
                  || '<tr><td colspan="5" class="tk-vacio">Sin cambios de crédito.</td></tr>'}</tbody></table></div>
            </div>
          </section>
        </form>`;
      const form = ctx.pDet.querySelector('.cl-form');
      window.UI.cascadaUbicacion(form, { pais_id: v.pais_id, departamento_id: v.departamento_id, municipio_id: v.municipio_id });
    }

    function leer(form) {
      const el = form.elements;
      const t = (n) => el[n].value.trim() || null;
      const id = (n) => el[n].value ? Number(el[n].value) : null;
      return {
        tipo_documento: el.tipo_documento.value, documento: el.tipo_documento.value === 'CF' ? 'CF' : el.documento.value.trim(), nombre: el.nombre.value.trim(), razon_social: t('razon_social'),
        estado: el.estado.value, tipo_cliente: el.tipo_cliente.value, contacto: t('contacto'), telefono: t('telefono'), correo: t('correo'),
        vendedor_id: id('vendedor_id'), tipo_precio_id: id('tipo_precio_id'), bodega_id: id('bodega_id'), modo_entrega: el.modo_entrega.value,
        aplicar_detalle: el.aplicar_detalle ? el.aplicar_detalle.checked : (actual?.aplicar_detalle ?? true),
        pais_id: id('pais_id'), departamento_id: id('departamento_id'), municipio_id: id('municipio_id'), codigo_postal: t('codigo_postal'), direccion: t('direccion'),
        forma_pago: el.forma_pago.value, dias_credito: Number(el.dias_credito.value) || 0, monto_credito: Number(el.monto_credito.value) || 0,
        exp_pais_id: id('exp_pais_id'), exp_incoterm: t('exp_incoterm'), exp_codigo_comprador: t('exp_codigo_comprador'), exp_consignatario: t('exp_consignatario'), exp_direccion: t('exp_direccion')
      };
    }
    function repintar(cambios = {}) { const form = ctx.pDet.querySelector('.cl-form'); if (!form) return; pintarDetalle({ ...(actual || {}), ...leer(form), ...cambios }); }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      const v = leer(form);
      const foco = (n, txt) => { error.textContent = txt; form.elements[n]?.focus(); };
      if (!v.documento) return foco('documento', 'Escribe el documento del cliente (o elige Consumidor final).');
      if (!v.nombre) return foco('nombre', 'Escribe el nombre del cliente.');
      if (v.tipo_documento !== 'CF') {
        const otro = lista.find((x) => x.id !== actual?.id && x.tipo_documento === v.tipo_documento && x.documento === v.documento.toUpperCase().replace(/\s/g, ''));
        if (otro) return foco('documento', `Ese documento ya es del cliente ${otro.codigo} · ${otro.nombre}.`);
      }
      if (v.tipo_documento === 'NIT' && !nitValido(v.documento) && !confirm(`El NIT ${v.documento} no pasa la validación del dígito verificador. ¿Guardarlo de todos modos?`)) return foco('documento', 'Revisa el NIT.');
      if (!actual && v.forma_pago === 'CRÉDITO' && (!v.dias_credito || !v.monto_credito)) return foco('dias_credito', 'Para dar crédito escribe los días y el monto máximo.');
      if (!actual && form.elements.codigo?.value) {
        const n = Number(form.elements.codigo.value);
        if (lista.some((x) => x.codigo === n)) return foco('codigo', `El número ${n} ya es de otro cliente.`);
        v.codigo = n;
      }
      if (actual) { delete v.forma_pago; delete v.dias_credito; delete v.monto_credito; }
      error.textContent = '';
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      const r = actual ? await sb.from('clientes').update(v).eq('id', actual.id).select('id').single()
        : await sb.from('clientes').insert({ codigo: 0, ...v, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single();
      boton.disabled = false;
      if (r.error) { error.textContent = /clientes_documento_key/.test(r.error.message || '') ? 'Ya existe un cliente con ese documento en la empresa.' : window.UI.traducirError(r.error); return; }
      window.FIN.aviso(actual ? 'Cliente guardado' : 'Cliente creado');
      nuevo = false; base = null;
      if (f.estado && v.estado !== f.estado) { f.estado = ''; pintarFiltros(); }
      await consultar(r.data.id);
    }
    async function aplicarCredito(form) {
      const el = form.elements;
      const error = form.querySelector('.modal-error');
      const motivo = el.motivo_credito.value.trim();
      if (!motivo) { error.textContent = 'Escribe el motivo del cambio de crédito.'; return el.motivo_credito.focus(); }
      const { error: e } = await sb.rpc('cambiar_credito_cliente', { p_id: actual.id, p_forma: el.forma_pago.value, p_dias: Number(el.dias_credito.value) || 0, p_monto: Number(el.monto_credito.value) || 0, p_motivo: motivo });
      if (e) { error.textContent = window.UI.traducirError(e); return; }
      window.FIN.aviso('Crédito del cliente modificado');
      pestana = 'CREDITO';
      await consultar(actual.id);
    }
    function listado() {
      if (!lista.length) return window.FIN.aviso('No hay clientes con esos filtros');
      const emp = ctx.localidad(ctx.sel.loc);
      const nom = (l, id) => l.find((x) => x.id === id)?.nombre || '';
      const cab = ['Cliente', 'Tipo doc.', 'Documento', 'Nombre', 'Razón social', 'Tipo', 'Contacto', 'Teléfono', 'Correo', 'Vendedor', 'Forma de pago', 'Días', 'Monto máximo', 'Estado'];
      const datos = lista.map((c) => [c.codigo, c.tipo_documento, c.documento, c.nombre, c.razon_social, c.tipo_cliente, c.contacto, c.telefono, c.correo, nom(vendedores, c.vendedor_id), c.forma_pago, c.dias_credito || '', c.forma_pago === 'CRÉDITO' ? fmt.monto(c.monto_credito) : '', c.estado]);
      if (f.formato === 'EXCEL') return window.COMPRAS_CAT.descargarCsv(`clientes_${emp?.codigo || ''}_${fmt.hoy()}.csv`, [cab, ...datos]);
      imprimir('Listado de clientes', `<h1>Listado de clientes</h1><h2>${esc(emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '')} · ${lista.length} clientes${f.estado ? ` · ${esc(f.estado)}` : ''}${f.tipo ? ` · ${esc(f.tipo)}` : ''}</h2>
        <table><thead><tr>${cab.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${datos.map((d) => `<tr>${d.map((x) => `<td>${esc(String(x ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    }

    // ---------- Eventos ----------
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { pintarFiltros(); return cargarLocalidad(); }
      if (cambio === 'otro') { if (e.target.name === 'formato') { f.formato = e.target.value; return; } f[e.target.name] = e.target.value; return consultar(); }
      const form = e.target.closest('.cl-form');
      if (!form) return;
      const n = e.target.name;
      if (n === 'tipo_documento' || n === 'forma_pago' || n === 'tipo_cliente') return repintar(n === 'tipo_documento' && e.target.value !== 'CF' && form.elements.documento.value === 'CF' ? { documento: '' } : {});
      if (n === 'documento') form.querySelector('[data-pista]').innerHTML = pistaDocumento(form.elements.tipo_documento.value, e.target.value);
      if (n === 'municipio_id' && e.target.value && !form.elements.codigo_postal.value.trim()) {
        const { data } = await sb.from('municipios').select('cod_postal').eq('id', Number(e.target.value)).maybeSingle();
        if (data?.cod_postal) form.elements.codigo_postal.value = data.cod_postal;
      }
    });
    cont.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar]')) { buscar = e.target.value; const pos = e.target.selectionStart; pintarLista(); const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos); return; }
      if (e.target.name === 'documento') { const form = e.target.closest('.cl-form'); form.querySelector('[data-pista]').innerHTML = pistaDocumento(form.elements.tipo_documento.value, e.target.value); }
    });
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-buscar]')) e.preventDefault();
      const fila = e.target.closest?.('tr[data-id]');
      if (fila && e.target === fila && e.key === 'Enter') fila.click();
    });
    cont.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-pestana]');
      if (tab) { pestana = tab.dataset.pestana; ctx.pDet.querySelectorAll('[data-pestana]').forEach((b) => { b.classList.toggle('activa', b === tab); b.setAttribute('aria-selected', b === tab); }); ctx.pDet.querySelectorAll('[data-panel]').forEach((x) => { x.hidden = x.dataset.panel !== pestana; }); return; }
      const fila = e.target.closest('tr[data-id]');
      if (fila && ctx.pMae.contains(fila)) { nuevo = false; base = null; return abrir(lista.find((c) => String(c.id) === fila.dataset.id)); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (!a) return;
      if (a === 'nuevo') { nuevo = true; actual = null; base = null; historial = []; pestana = 'EXPORTACION'; ctx.pMae.querySelectorAll('tr.actual').forEach((tr) => tr.classList.remove('actual')); pintarDetalle(); return ctx.pDet.querySelector('[name=documento]')?.focus(); }
      if (a === 'duplicar') {
        const form = ctx.pDet.querySelector('.cl-form');
        base = { ...leer(form), documento: '', razon_social: '', estado: 'ACTIVO' };
        nuevo = true; actual = null; historial = [];
        ctx.pMae.querySelectorAll('tr.actual').forEach((tr) => tr.classList.remove('actual'));
        pintarDetalle();
        window.FIN.aviso('Cliente duplicado: escribe el documento del nuevo cliente');
        return ctx.pDet.querySelector('[name=documento]')?.focus();
      }
      if (a === 'cancelar') { nuevo = false; base = null; return abrir(lista[0] || null); }
      if (a === 'exportacion') { pestana = 'EXPORTACION'; return ctx.pDet.querySelector('[data-pestana=EXPORTACION]')?.click(); }
      if (a === 'credito') { credito = true; return repintar(); }
      if (a === 'cancelar-credito') { credito = false; return pintarDetalle(); }
      if (a === 'aplicar-credito') return aplicarCredito(ctx.pDet.querySelector('.cl-form'));
      if (a === 'listado') return listado();
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.cl-form')) { e.preventDefault(); guardar(e.target); } });
    iniciar();
  };
})();
