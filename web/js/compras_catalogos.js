// Compras · Catálogos: Proveedores y Bodegas de cada localidad.
//   Proveedores: a la izquierda la lista (código, NIT, nombre comercial y estado) con su búsqueda;
//   a la derecha el proveedor: datos generales (nombre fiscal SAT, de emisión, dirección, concepto
//   de gastos, teléfonos, contacto, nacional, servicio crítico, pendiente de revisar, tipo, régimen
//   ISR y bodega) y las pestañas Datos contables (días de crédito, retención, cuenta de gastos,
//   varias cuentas, visualizar en, transacción y transacción de exenciones), Datos de pago y Varias
//   cuentas. Arriba, el listado por tipo de proveedor en PDF o Excel (CSV).
//   Bodegas: la lista en árbol (bodegas generales con sus sub-bodegas) y la bodega elegida: tipo,
//   bodega mayor, dirección, siglas, permisos (carga directa, consignación, licitación, ventas),
//   modalidad, encargado, tipo de precio, estado y las definiciones contables por bodega
//   (transacciones, reversiones y cuenta PT).
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  const DIAS = [[0, 'INMEDIATO'], [8, '8 DÍAS'], [15, '15 DÍAS'], [30, '30 DÍAS'], [45, '45 DÍAS'], [60, '60 DÍAS'], [90, '90 DÍAS'], [120, '120 DÍAS']];
  const ESTADOS = ['ACTIVO', 'INACTIVO', 'BLOQUEADO'];
  const VISUALIZAR = ['AMBAS', 'COMPRAS INVENTARIO', 'COMPRAS VARIAS'];
  const marcaEstado = (e) => `<span class="pc-marca ${e === 'ACTIVO' ? 'aprobada' : e === 'BLOQUEADO' ? 'anulada' : 'pendiente'}">${esc(e)}</span>`;

  // Piezas comunes: catálogo de cuentas, centros y transacciones de la localidad.
  async function centrosLocalidad(sb, loc) {
    if (!loc) return [];
    const { data: k } = await sb.from('catalogos_centros').select('id').eq('localidad_id', loc).eq('activo', true).order('version', { ascending: false }).limit(1);
    if (!k?.[0]) return [];
    const { data } = await sb.from('centros_costo').select('id, codigo, nombre, centro_mayor_id, vigente').eq('catalogo_id', k[0].id).order('codigo');
    const padres = new Set((data || []).map((c) => c.centro_mayor_id).filter(Boolean));
    return (data || []).map((c) => ({ ...c, movimiento: !padres.has(c.id) && c.vigente }));
  }
  async function transaccionesLocalidad(sb, loc) {
    if (!loc) return [];
    const { data } = await sb.from('transacciones_contables').select('id, numero, descripcion, estado').eq('localidad_id', loc).order('numero');
    return data || [];
  }
  const opcionesTrx = (lista, id) => `<option value="">—</option>${lista.filter((t) => t.estado === 'ACTIVO' || t.id === id).map((t) => `<option value="${t.id}" ${t.id === id ? 'selected' : ''}>${t.numero} · ${esc(t.descripcion)}</option>`).join('')}`;
  function descargarCsv(nombre, filas) {
    const csv = filas.map((f) => f.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }

  window.PANTALLAS = window.PANTALLAS || {};

  // ===================== Proveedores =====================
  window.PANTALLAS.proveedores = function (cont) {
    const ctx = montar(cont, { titulo: 'Proveedores', icono: 'ti-truck', clase: 'bk-proveedores cp-lado', grupo: 'Compras · Catálogos' });
    const { sb, yo } = ctx;
    const f = { estado: 'ACTIVO', tipo: '', formato: 'PDF' };
    let lista = [];
    let actual = null;
    let nuevo = false;
    let tipos = [], regimenes = [], bodegas = [], contables = [], centros = [], transacciones = [];
    let cuentasProv = [];
    let pestana = 'CONTABLE';
    let buscar = '';
    const contable = (id) => contables.find((x) => x.id === id);
    const porCodigo = (cod) => contables.find((x) => x.codigo === String(cod || '').trim() && x.movimiento);

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Estado</span><select name="estado"><option value="">Todos</option>${ESTADOS.map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label class="campo"><span>Tipo de proveedor</span><select name="tipo"><option value="">TODOS</option>${tipos.map((t) => `<option value="${t.id}" ${String(t.id) === f.tipo ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Formato</span><select name="formato">${['PDF', 'EXCEL'].map((x) => `<option ${f.formato === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`,
        `<button type="button" class="boton secundario-sm" data-accion="listado"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir listado</button>
         ${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo proveedor</button>' : ''}`);
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('proveedores').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/proveedores/.test(prueba.error.message) ? 'Falta instalar el script 57 (proveedores, bodegas y facturas de compra) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      await cargarCatalogos();
      pintarFiltros();
      await cargarLocalidad();
    }
    async function cargarCatalogos() {
      const [t, r] = await Promise.all([sb.from('tipos_proveedor').select('*').order('codigo'), sb.from('regimenes_isr').select('*').order('codigo')]);
      tipos = t.data || []; regimenes = r.data || [];
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      const [b, k, c, x] = await Promise.all([
        loc ? sb.from('bodegas').select('id, codigo, nombre, estado').eq('localidad_id', loc).order('codigo') : { data: [] },
        ctx.cuentasContables(), centrosLocalidad(sb, loc), transaccionesLocalidad(sb, loc)
      ]);
      bodegas = b.data || []; contables = k; centros = c; transacciones = x;
      actual = null;
      await consultar();
    }
    async function consultar(id = actual?.id) {
      if (!ctx.sel.loc) { lista = []; pintarLista(); return abrir(null); }
      let q = sb.from('proveedores').select('*').eq('localidad_id', ctx.sel.loc).order('nombre_comercial');
      if (f.estado) q = q.eq('estado', f.estado);
      if (f.tipo) q = q.eq('tipo_proveedor_id', Number(f.tipo));
      const { data, error } = await q;
      if (error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      lista = data || [];
      pintarLista();
      await abrir(lista.find((p) => p.id === id) || (nuevo ? null : lista[0]) || null);
    }

    function pintarLista() {
      const q = buscar.trim().toLowerCase();
      const filas = lista.filter((p) => !q || [p.codigo, p.nit, p.nombre_comercial, p.nombre_fiscal, p.contacto].some((v) => String(v || '').toLowerCase().includes(q)));
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>Proveedores <small>${lista.length}</small></h2>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Código, NIT o nombre…" value="${esc(buscar)}" aria-label="Buscar proveedores"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table><thead><tr><th class="num">Proveedor</th><th>NIT</th><th>Nombre comercial</th><th>Estado</th></tr></thead>
            <tbody>${filas.map((p) => `<tr data-id="${p.id}" class="${actual && actual.id === p.id ? 'actual' : ''}" tabindex="0"><td class="num fuerte">${p.codigo}</td><td>${esc(p.nit || '')}</td><td class="cc-nombre" title="${esc(p.nombre_comercial)}">${esc(p.nombre_comercial)}${p.pendiente_revisar ? ' <i class="ti ti-flag cp-revisar" title="Pendiente de revisar" aria-label="Pendiente de revisar"></i>' : ''}${p.servicio_critico ? ' <i class="ti ti-alert-triangle cp-critico" title="Servicio crítico" aria-label="Servicio crítico"></i>' : ''}</td><td>${marcaEstado(p.estado)}</td></tr>`).join('')
              || `<tr><td colspan="4" class="tk-vacio"><i class="ti ti-truck" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : lista.length ? 'Ningún proveedor coincide con la búsqueda.' : `No hay proveedores${ctx.admin ? ': crea el primero con «Nuevo proveedor».' : '.'}`}</td></tr>`}</tbody></table>
        </div>`;
    }

    async function abrir(p) {
      actual = p;
      cuentasProv = [];
      if (p) {
        const { data } = await sb.from('proveedor_cuentas').select('*').eq('proveedor_id', p.id).order('linea');
        cuentasProv = (data || []).map((x) => ({ ...x, codigo: contable(x.cuenta_id)?.codigo || '', centro_codigo: centros.find((c) => c.id === x.centro_id)?.codigo || '' }));
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-id]').forEach((tr) => tr.classList.toggle('actual', !!p && tr.dataset.id === String(p.id)));
    }

    const cuentaCampo = (name, etq, id, dis, clase = '') => { const k = contable(id); return `<label class="campo ${clase}"><span>${etq}</span><span class="cp-cta"><input list="cp-cuentas" name="${name}" value="${esc(k ? k.codigo : '')}" placeholder="Código" ${dis}><small data-nombre-de="${name}">${k ? esc(k.nombre) : ''}</small></span></label>`; };

    function pintarDetalle(v0) {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-truck'); return; }
      const p = actual;
      if (!p && !nuevo) { ctx.pDet.innerHTML = ctx.vacio(ctx.admin ? 'Elige un proveedor o crea uno nuevo.' : 'Elige un proveedor.', 'ti-truck'); return; }
      const dis = ctx.admin ? '' : 'disabled';
      const local = tipos.find((t) => /LOCAL/.test(t.nombre));
      const v = v0 || (p ? { ...p } : { estado: 'ACTIVO', nacional: true, servicio_critico: false, pendiente_revisar: false, tipo_proveedor_id: local?.id || null, regimen_isr_id: null, bodega_id: null, dias_credito: 0, efectuar_retencion: false, varias_cuentas: false, visualizar_en: 'AMBAS', forma_pago: 'CHEQUE', moneda_id: ctx.monedaBase()?.id, tipo_cuenta: 'MONETARIA' });
      const sel = (name, opciones, val, extra = '') => `<select name="${name}" ${dis} ${extra}>${opciones}</select>`;
      const chk = (name, etq, val) => `<label class="pc-check"><input type="checkbox" name="${name}" ${val ? 'checked' : ''} ${dis}> ${etq}</label>`;
      const tabs = [['CONTABLE', 'Datos contables', 'ti-calculator'], ['PAGO', 'Datos de pago', 'ti-building-bank'], ['CUENTAS', 'Varias cuentas', 'ti-list-numbers']];
      ctx.pDet.innerHTML = `
        <form class="tk-form bm-form cp-form" novalidate>
          <header class="tk-titulo bm-titulo">
            <span class="tk-icono"><i class="ti ti-truck" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>${p ? `Proveedor ${p.codigo}` : 'Nuevo proveedor'}</small><h2>${p ? esc(p.nombre_comercial) : 'Datos del proveedor'}</h2></div>
            <div class="tk-marcas">${p ? marcaEstado(p.estado) : ''}${p?.pendiente_revisar ? '<span class="pc-marca pendiente"><i class="ti ti-flag" aria-hidden="true"></i> Pendiente de revisar</span>' : ''}</div>
            <div class="tk-titulo-acciones">
              ${nuevo ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}
              ${ctx.admin ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${p ? 'Guardar cambios' : 'Crear proveedor'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          <section class="bm-bloque cp-general">
            <div class="cp-g cp-g6">
              <div class="bs-req-num"><span>Código</span><b>${p ? p.codigo : 'Auto'}</b></div>
              <label class="campo cp-c2"><span>NIT</span><input name="nit" value="${esc(v.nit || '')}" maxlength="20" placeholder="1234567-8 o CF" ${dis}></label>
              <label class="campo cp-c3"><span>Nombre comercial *</span><input name="nombre_comercial" value="${esc(v.nombre_comercial || '')}" maxlength="150" ${dis}></label>
              <label class="campo cp-c3"><span>Nombre fiscal (SAT)</span><input name="nombre_fiscal" value="${esc(v.nombre_fiscal || '')}" maxlength="150" placeholder="Si se deja vacío, el comercial" ${dis}></label>
              <label class="campo cp-c3"><span>Nombre de emisión de documentos</span><input name="nombre_emision" value="${esc(v.nombre_emision || '')}" maxlength="150" placeholder="Si se deja vacío, el fiscal" ${dis}></label>
              <label class="campo cp-c3"><span>Dirección</span><textarea name="direccion" rows="2" maxlength="300" ${dis}>${esc(v.direccion || '')}</textarea></label>
              <label class="campo cp-c3"><span class="cp-req">Concepto de gastos *</span><textarea name="concepto_gastos" rows="2" maxlength="300" ${dis}>${esc(v.concepto_gastos || '')}</textarea></label>
              <label class="campo cp-c2"><span>Teléfonos</span><input name="telefonos" value="${esc(v.telefonos || '')}" maxlength="60" ${dis}></label>
              <label class="campo"><span>Ext.</span><input name="extension" value="${esc(v.extension || '')}" maxlength="10" ${dis}></label>
              <label class="campo cp-c3"><span>Contacto</span><input name="contacto" value="${esc(v.contacto || '')}" maxlength="100" ${dis}></label>
              <label class="campo cp-c3"><span>Correo</span><input type="email" name="correo" value="${esc(v.correo || '')}" maxlength="120" ${dis}></label>
              <label class="campo"><span>Estado</span>${sel('estado', ESTADOS.map((e) => `<option ${v.estado === e ? 'selected' : ''}>${e}</option>`).join(''), v.estado)}</label>
              <div class="cp-checks cp-c2">${chk('nacional', 'Proveedor nacional', v.nacional)}${chk('servicio_critico', 'Servicio crítico', v.servicio_critico)}${chk('pendiente_revisar', 'Pendiente de revisar', v.pendiente_revisar)}</div>
              <label class="campo cp-c2"><span>Tipo de proveedor</span><span class="cp-con-mas">${sel('tipo_proveedor_id', `<option value="">—</option>${tipos.filter((t) => t.activo || t.id === v.tipo_proveedor_id).map((t) => `<option value="${t.id}" ${t.id === v.tipo_proveedor_id ? 'selected' : ''}>${t.codigo} · ${esc(t.nombre)}</option>`).join('')}`)}${ctx.admin ? '<button type="button" class="icono-boton" data-accion="nuevo-tipo" title="Agregar tipo de proveedor" aria-label="Agregar tipo de proveedor"><i class="ti ti-plus" aria-hidden="true"></i></button>' : ''}</span></label>
              <label class="campo cp-c2"><span>Régimen ISR</span><span class="cp-con-mas">${sel('regimen_isr_id', `<option value="">—</option>${regimenes.filter((t) => t.activo || t.id === v.regimen_isr_id).map((t) => `<option value="${t.id}" ${t.id === v.regimen_isr_id ? 'selected' : ''}>${t.codigo} · ${esc(t.nombre)}</option>`).join('')}`)}${ctx.admin ? '<button type="button" class="icono-boton" data-accion="nuevo-regimen" title="Agregar régimen ISR" aria-label="Agregar régimen ISR"><i class="ti ti-plus" aria-hidden="true"></i></button>' : ''}</span></label>
              <label class="campo cp-c2"><span>Bodega</span>${sel('bodega_id', `<option value="">—</option>${bodegas.filter((b) => b.estado === 'ACTIVO' || b.id === v.bodega_id).map((b) => `<option value="${b.id}" ${b.id === v.bodega_id ? 'selected' : ''}>${b.codigo} · ${esc(b.nombre)}</option>`).join('')}`)}</label>
            </div>
          </section>
          <section class="bm-pestanas cp-tabs">
            <div class="bm-tabs-barra"><div class="rp-pestanas" role="tablist">${tabs.map(([k, t, i]) => `<button type="button" role="tab" data-pestana="${k}" class="${pestana === k ? 'activa' : ''}" aria-selected="${pestana === k}"><i class="ti ${i}" aria-hidden="true"></i> ${t}${k === 'CUENTAS' && cuentasProv.length ? ` <b>${cuentasProv.length}</b>` : ''}</button>`).join('')}</div></div>
            <div class="bm-panel cp-panel" data-panel="CONTABLE" ${pestana === 'CONTABLE' ? '' : 'hidden'}>
              <div class="cp-g cp-g6">
                <label class="campo cp-c2"><span>Días de crédito</span>${sel('dias_credito', DIAS.map(([d, t]) => `<option value="${d}" ${Number(v.dias_credito) === d ? 'selected' : ''}>${t}</option>`).join('') + (DIAS.some(([d]) => d === Number(v.dias_credito)) ? '' : `<option value="${v.dias_credito}" selected>${v.dias_credito} DÍAS</option>`))}</label>
                <div class="cp-checks cp-c2">${chk('efectuar_retencion', 'Efectuar retención', v.efectuar_retencion)}${chk('varias_cuentas', 'Varias cuentas', v.varias_cuentas)}</div>
                <label class="campo cp-c2"><span>Visualizar en</span>${sel('visualizar_en', VISUALIZAR.map((x) => `<option ${v.visualizar_en === x ? 'selected' : ''}>${x}</option>`).join(''))}</label>
                ${cuentaCampo('cuenta_gasto', 'Cuenta contable de gastos', v.cuenta_gasto_id, dis, 'cp-c4')}
                <div class="cp-c2 cp-ver"><button type="button" class="boton secundario-sm" data-accion="ver-cuentas" ${v.varias_cuentas ? '' : 'disabled'}><i class="ti ti-list-numbers" aria-hidden="true"></i> Ver cuentas</button></div>
                <label class="campo cp-c3"><span>Transacción</span>${sel('transaccion_id', opcionesTrx(transacciones, v.transaccion_id))}</label>
                <label class="campo cp-c3"><span>2da. transacción (exenciones)</span>${sel('transaccion_exencion_id', opcionesTrx(transacciones, v.transaccion_exencion_id))}</label>
              </div>
            </div>
            <div class="bm-panel cp-panel" data-panel="PAGO" ${pestana === 'PAGO' ? '' : 'hidden'}>
              <div class="cp-g cp-g6">
                <div class="campo cp-c2"><span>Forma de pago</span><div class="cc-radios">${[['CHEQUE', 'Cheque'], ['TRANSFERENCIA', 'Transferencia']].map(([k, t]) => `<label class="pc-check"><input type="radio" name="forma_pago" value="${k}" ${v.forma_pago === k ? 'checked' : ''} ${dis}> ${t}</label>`).join('')}</div></div>
                <label class="campo cp-c2"><span>Moneda</span>${sel('moneda_id', ctx.monedas.map((m) => `<option value="${m.id}" ${m.id === v.moneda_id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join(''))}</label>
                <label class="campo cp-c2"><span>Beneficiario del cheque</span><input name="beneficiario" value="${esc(v.beneficiario || '')}" maxlength="150" placeholder="Si se deja vacío, el nombre fiscal" ${dis}></label>
                <label class="campo cp-c2"><span>Banco</span>${sel('banco_id', `<option value="">—</option>${ctx.bancosLoc().filter((b) => b.activo || b.id === v.banco_id).map((b) => `<option value="${b.id}" ${b.id === v.banco_id ? 'selected' : ''}>${esc(b.siglas || b.nombre)}</option>`).join('')}`)}</label>
                <label class="campo cp-c2"><span>Cuenta bancaria</span><input name="cuenta_bancaria" value="${esc(v.cuenta_bancaria || '')}" maxlength="40" ${dis}></label>
                <label class="campo cp-c2"><span>Tipo de cuenta</span>${sel('tipo_cuenta', `<option value="">—</option>${['MONETARIA', 'AHORRO'].map((x) => `<option ${v.tipo_cuenta === x ? 'selected' : ''}>${x}</option>`).join('')}`)}</label>
                <label class="campo cp-c3"><span>Titular de la cuenta</span><input name="titular_cuenta" value="${esc(v.titular_cuenta || '')}" maxlength="150" ${dis}></label>
                <label class="campo cp-c3"><span>Correo para avisos de pago</span><input type="email" name="correo_pagos" value="${esc(v.correo_pagos || '')}" maxlength="120" ${dis}></label>
              </div>
            </div>
            <div class="bm-panel cp-panel" data-panel="CUENTAS" ${pestana === 'CUENTAS' ? '' : 'hidden'}>
              ${v.varias_cuentas ? `<div class="pc-lineas"><table><thead><tr><th class="pc-n">Línea</th><th class="pc-cta">Cuenta</th><th>Nombre</th><th class="bm-centro">Centro</th><th class="num">%</th><th>Descripción</th><th></th></tr></thead>
                <tbody>${cuentasProv.map((l, i) => `<tr data-cta="${i}"><td class="pc-n">${i + 1}</td><td class="pc-cta"><input list="cp-cuentas" data-c="codigo" value="${esc(l.codigo || '')}" ${dis} aria-label="Cuenta"></td><td class="pc-nombre" data-nombre>${esc(porCodigo(l.codigo)?.nombre || '')}</td>
                  <td class="bm-centro"><input list="cp-centros" data-c="centro_codigo" value="${esc(l.centro_codigo || '')}" ${dis} aria-label="Centro"></td><td class="num"><input type="number" step="0.01" min="0" max="100" data-c="porcentaje" value="${l.porcentaje ?? ''}" ${dis} aria-label="Porcentaje"></td>
                  <td><input data-c="descripcion" value="${esc(l.descripcion || '')}" maxlength="120" ${dis} aria-label="Descripción"></td><td>${dis ? '' : `<button type="button" class="icono-boton" data-quitar-cta="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>`}</td></tr>`).join('')
                  || '<tr><td colspan="7" class="tk-vacio">Agrega las cuentas del proveedor.</td></tr>'}</tbody></table></div>
                ${ctx.admin ? '<button type="button" class="boton secundario-sm cp-agregar" data-accion="agregar-cta"><i class="ti ti-plus" aria-hidden="true"></i> Cuenta</button>' : ''}`
                : `<p class="tk-vacio cp-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> Marca «Varias cuentas» en Datos contables para distribuir el gasto del proveedor en varias cuentas.</p>`}
            </div>
          </section>
          ${p ? `<p class="cc-ingreso"><i class="ti ti-user" aria-hidden="true"></i> Creó ${esc(p.creado_por_nombre || '')} · ${esc(fmt.fechaHora(p.creado_en))}${p.modificado_en ? ` · modificó ${esc(p.modificado_por_nombre || '')} ${esc(fmt.fechaHora(p.modificado_en))}` : ''}</p>` : ''}
          <datalist id="cp-cuentas">${contables.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('')}</datalist>
          <datalist id="cp-centros">${centros.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('')}</datalist>
        </form>`;
    }

    function leerCuentas() {
      ctx.pDet.querySelectorAll('tr[data-cta]').forEach((tr) => {
        const l = cuentasProv[Number(tr.dataset.cta)];
        tr.querySelectorAll('[data-c]').forEach((el) => { l[el.dataset.c] = el.value.trim(); });
      });
    }
    function leer(form) {
      const el = form.elements;
      const t = (n) => el[n].value.trim() || null;
      const id = (n) => el[n].value ? Number(el[n].value) : null;
      const cg = el.cuenta_gasto.value.trim();
      const k = porCodigo(cg);
      return {
        nit: t('nit'), nombre_comercial: el.nombre_comercial.value.trim(), nombre_fiscal: t('nombre_fiscal'), nombre_emision: t('nombre_emision'),
        direccion: t('direccion'), concepto_gastos: el.concepto_gastos.value.trim(), telefonos: t('telefonos'), extension: t('extension'), contacto: t('contacto'), correo: t('correo'),
        estado: el.estado.value, nacional: el.nacional.checked, servicio_critico: el.servicio_critico.checked, pendiente_revisar: el.pendiente_revisar.checked,
        tipo_proveedor_id: id('tipo_proveedor_id'), regimen_isr_id: id('regimen_isr_id'), bodega_id: id('bodega_id'),
        dias_credito: Number(el.dias_credito.value) || 0, efectuar_retencion: el.efectuar_retencion.checked, varias_cuentas: el.varias_cuentas.checked, visualizar_en: el.visualizar_en.value,
        cuenta_gasto_id: k ? k.id : null, _cg: cg, transaccion_id: id('transaccion_id'), transaccion_exencion_id: id('transaccion_exencion_id'),
        forma_pago: form.querySelector('[name=forma_pago]:checked')?.value || 'CHEQUE', moneda_id: id('moneda_id'), beneficiario: t('beneficiario'),
        banco_id: id('banco_id'), cuenta_bancaria: t('cuenta_bancaria'), tipo_cuenta: t('tipo_cuenta'), titular_cuenta: t('titular_cuenta'), correo_pagos: t('correo_pagos')
      };
    }
    function repintar() { const form = ctx.pDet.querySelector('.cp-form'); if (!form) return; leerCuentas(); const v = leer(form); delete v._cg; pintarDetalle({ ...(actual || {}), ...v }); }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      leerCuentas();
      const v = leer(form);
      const foco = (n, txt) => { error.textContent = txt; form.elements[n]?.focus(); };
      if (!v.nombre_comercial) return foco('nombre_comercial', 'Escribe el nombre comercial del proveedor.');
      if (!v.concepto_gastos) return foco('concepto_gastos', 'Escribe el concepto de gastos del proveedor.');
      if (v._cg && !v.cuenta_gasto_id) { pestana = 'CONTABLE'; repintar(); return ctx.pDet.querySelector('.modal-error').textContent = 'La cuenta de gastos no es de movimiento en el catálogo de la localidad.'; }
      if (v.forma_pago === 'TRANSFERENCIA' && !v.cuenta_bancaria) { pestana = 'PAGO'; repintar(); return ctx.pDet.querySelector('.modal-error').textContent = 'Para pagar por transferencia escribe la cuenta bancaria del proveedor.'; }
      const ls = v.varias_cuentas ? cuentasProv.filter((l) => l.codigo) : [];
      const mala = ls.find((l) => !porCodigo(l.codigo) || (l.centro_codigo && !centros.find((c) => c.codigo === l.centro_codigo && c.movimiento)));
      if (mala) { pestana = 'CUENTAS'; repintar(); return ctx.pDet.querySelector('.modal-error').textContent = `La línea ${cuentasProv.indexOf(mala) + 1} tiene una cuenta o un centro que no es de movimiento.`; }
      const pct = ls.reduce((s, l) => s + Number(l.porcentaje || 0), 0);
      if (ls.some((l) => l.porcentaje) && Math.abs(pct - 100) > 0.01) { pestana = 'CUENTAS'; repintar(); return ctx.pDet.querySelector('.modal-error').textContent = `Los porcentajes de las cuentas suman ${pct.toFixed(2)} %: deben sumar 100 %.`; }
      delete v._cg;
      error.textContent = '';
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      try {
        const r = actual ? await sb.from('proveedores').update(v).eq('id', actual.id).select('id').single()
          : await sb.from('proveedores').insert({ ...v, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single();
        if (r.error) throw r.error;
        const d = await sb.from('proveedor_cuentas').delete().eq('proveedor_id', r.data.id);
        if (d.error) throw d.error;
        if (ls.length) {
          const x = await sb.from('proveedor_cuentas').insert(ls.map((l, i) => ({ proveedor_id: r.data.id, linea: i + 1, cuenta_id: porCodigo(l.codigo).id, centro_id: centros.find((c) => c.codigo === l.centro_codigo)?.id || null, porcentaje: l.porcentaje ? Number(l.porcentaje) : null, descripcion: l.descripcion || null })));
          if (x.error) throw x.error;
        }
        window.FIN.aviso(actual ? 'Proveedor guardado' : 'Proveedor creado');
        nuevo = false;
        if (f.estado && v.estado !== f.estado) { f.estado = ''; pintarFiltros(); }
        await consultar(r.data.id);
      } catch (err) {
        error.textContent = /proveedores_nit_key/.test(err.message || '') ? 'Ya existe un proveedor con ese NIT en la empresa.' : window.UI.traducirError(err);
      } finally { boton.disabled = false; }
    }

    async function agregarCatalogo(tabla, que) {
      const nombre = prompt(`Nombre del nuevo ${que}:`);
      if (!nombre?.trim()) return;
      const lista0 = tabla === 'tipos_proveedor' ? tipos : regimenes;
      const { data, error } = await sb.from(tabla).insert({ codigo: Math.max(0, ...lista0.map((x) => x.codigo)) + 1, nombre: nombre.trim().toUpperCase() }).select('id').single();
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      const form = ctx.pDet.querySelector('.cp-form');
      leerCuentas();
      const v = leer(form); delete v._cg;
      await cargarCatalogos();
      v[tabla === 'tipos_proveedor' ? 'tipo_proveedor_id' : 'regimen_isr_id'] = data.id;
      pintarFiltros();
      pintarDetalle({ ...(actual || {}), ...v });
    }

    function listado() {
      const filas = lista;
      if (!filas.length) return window.FIN.aviso('No hay proveedores con esos filtros');
      const tipo = (id) => tipos.find((t) => t.id === id)?.nombre || '';
      const reg = (id) => regimenes.find((t) => t.id === id)?.nombre || '';
      const emp = ctx.localidad(ctx.sel.loc);
      const cab = ['Código', 'NIT', 'Nombre comercial', 'Nombre fiscal', 'Tipo', 'Régimen ISR', 'Teléfonos', 'Contacto', 'Días crédito', 'Forma de pago', 'Estado'];
      const datos = filas.map((p) => [p.codigo, p.nit, p.nombre_comercial, p.nombre_fiscal, tipo(p.tipo_proveedor_id), reg(p.regimen_isr_id), p.telefonos, p.contacto, p.dias_credito ? `${p.dias_credito} días` : 'Inmediato', p.forma_pago, p.estado]);
      if (f.formato === 'EXCEL') return descargarCsv(`proveedores_${emp?.codigo || ''}_${fmt.hoy()}.csv`, [cab, ...datos]);
      imprimir('Listado de proveedores', `<h1>Listado de proveedores</h1><h2>${esc(emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '')} · Tipo: ${esc(f.tipo ? tipo(Number(f.tipo)) : 'TODOS')} · Estado: ${esc(f.estado || 'TODOS')} · ${filas.length} proveedores</h2>
        <table><thead><tr>${cab.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${datos.map((d) => `<tr>${d.map((x) => `<td>${esc(String(x ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    }

    // ---------- Eventos ----------
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { pintarFiltros(); nuevo = false; return cargarLocalidad(); }
      if (cambio === 'otro') {
        if (e.target.name === 'formato') { f.formato = e.target.value; return; }
        f[e.target.name] = e.target.value;
        return consultar();
      }
      const form = e.target.closest('.cp-form');
      if (!form) return;
      if (e.target.name === 'varias_cuentas') { if (e.target.checked && !cuentasProv.length) cuentasProv.push({ codigo: '', centro_codigo: '', porcentaje: '', descripcion: '' }); return repintar(); }
      if (e.target.name === 'cuenta_gasto') { const k = porCodigo(e.target.value); form.querySelector('[data-nombre-de=cuenta_gasto]').innerHTML = k ? esc(k.nombre) : e.target.value.trim() ? '<span class="pc-error">No es de movimiento</span>' : ''; }
      if (e.target.dataset.c === 'codigo') { const k = porCodigo(e.target.value); e.target.closest('tr').querySelector('[data-nombre]').innerHTML = k ? esc(k.nombre) : e.target.value.trim() ? '<span class="pc-error">No es de movimiento</span>' : ''; }
      if (e.target.name === 'nit' && !actual) {
        const nit = e.target.value.trim().toUpperCase().replace(/\s/g, '');
        const otro = nit && !['CF', 'C/F'].includes(nit) && lista.find((p) => p.nit === nit);
        if (otro) form.querySelector('.modal-error').textContent = `Ese NIT ya es del proveedor ${otro.codigo} · ${otro.nombre_comercial}.`;
      }
    });
    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-buscar]')) return;
      buscar = e.target.value;
      const pos = e.target.selectionStart;
      pintarLista();
      const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
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
      if (fila && ctx.pMae.contains(fila)) { nuevo = false; return abrir(lista.find((p) => String(p.id) === fila.dataset.id)); }
      const q = e.target.closest('[data-quitar-cta]');
      if (q) { leerCuentas(); cuentasProv.splice(Number(q.dataset.quitarCta), 1); return repintar(); }
      const ac = e.target.closest('[data-accion]');
      if (!ac) return;
      const a = ac.dataset.accion;
      if (a === 'nuevo') { nuevo = true; actual = null; cuentasProv = []; pestana = 'CONTABLE'; ctx.pMae.querySelectorAll('tr.actual').forEach((tr) => tr.classList.remove('actual')); pintarDetalle(); return ctx.pDet.querySelector('[name=nit]')?.focus(); }
      if (a === 'cancelar') { nuevo = false; return abrir(lista[0] || null); }
      if (a === 'listado') return listado();
      if (a === 'ver-cuentas') { pestana = 'CUENTAS'; return repintar(); }
      if (a === 'agregar-cta') { leerCuentas(); cuentasProv.push({ codigo: '', centro_codigo: '', porcentaje: '', descripcion: '' }); return repintar(); }
      if (a === 'nuevo-tipo') return agregarCatalogo('tipos_proveedor', 'tipo de proveedor');
      if (a === 'nuevo-regimen') return agregarCatalogo('regimenes_isr', 'régimen ISR');
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.cp-form')) { e.preventDefault(); guardar(e.target); } });

    iniciar();
  };

  // ===================== Bodegas =====================
  window.PANTALLAS.bodegas = function (cont) {
    const ctx = montar(cont, { titulo: 'Administración de bodegas', icono: 'ti-building-warehouse', clase: 'bk-bodegas cp-lado', grupo: 'Compras · Catálogos' });
    const { sb } = ctx;
    const f = { estado: 'ACTIVO' };
    const TRX = [['trx_entradas_id', 'Entradas'], ['trx_ajuste_mas_id', 'Ajuste (+)'], ['trx_ajuste_menos_id', 'Ajuste (−)'], ['trx_despachos_id', 'Despachos'], ['trx_traslados_id', 'Traslados']];
    const REV = [['rev_traslados_id', 'Traslados'], ['rev_ajustes_id', 'Ajustes'], ['rev_despachos_id', 'Despachos'], ['rev_entradas_id', 'Entradas']];
    const PRECIOS = ['PÚBLICO', 'MAYORISTA', 'DISTRIBUIDOR', 'INSTITUCIONAL', 'COSTO'];
    const MODALIDADES = [['NORMAL', 'Normal'], ['CONSIGNACIÓN', 'Consignación'], ['CUENTA AJENA', 'Cuenta ajena']];
    let lista = [];
    let actual = null;
    let nuevo = false;
    let contables = [], transacciones = [];
    let buscar = '';
    const contable = (id) => contables.find((x) => x.id === id);
    const porCodigo = (cod) => contables.find((x) => x.codigo === String(cod || '').trim() && x.movimiento);
    const bodega = (id) => lista.find((b) => b.id === id);

    function pintarFiltros() {
      ctx.filtros(`<label class="campo"><span>Estado</span><select name="estado"><option value="">Todas</option>${['ACTIVO', 'INACTIVO'].map((e) => `<option value="${e}" ${f.estado === e ? 'selected' : ''}>${e === 'ACTIVO' ? 'Activas' : 'Inactivas'}</option>`).join('')}</select></label>`,
        `<button type="button" class="boton secundario-sm" data-accion="listado"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir listado</button>
         ${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nueva bodega</button>' : ''}`);
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('bodegas').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/bodegas/.test(prueba.error.message) ? 'Falta instalar el script 57 (proveedores, bodegas y facturas de compra) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      pintarFiltros();
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      [contables, transacciones] = await Promise.all([ctx.cuentasContables(), transaccionesLocalidad(sb, ctx.sel.loc)]);
      actual = null;
      await consultar();
    }
    async function consultar(id = actual?.id) {
      if (!ctx.sel.loc) { lista = []; pintarLista(); return abrir(null); }
      const { data, error } = await sb.from('bodegas').select('*').eq('localidad_id', ctx.sel.loc).order('codigo');
      if (error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      lista = data || [];
      pintarLista();
      abrir(lista.find((b) => b.id === id) || (nuevo ? null : arbol()[0]) || null);
    }
    // Generales (y bodegas sin mayor) con sus sub-bodegas debajo.
    function arbol() {
      const vis = lista.filter((b) => !f.estado || b.estado === f.estado);
      const raiz = vis.filter((b) => b.tipo === 'GENERAL' || !vis.some((x) => x.id === b.bodega_mayor_id));
      return raiz.flatMap((b) => [b, ...vis.filter((x) => x.tipo === 'SUB-BODEGA' && x.bodega_mayor_id === b.id && x !== b)]);
    }
    function pintarLista() {
      const q = buscar.trim().toLowerCase();
      const filas = arbol().filter((b) => !q || [b.codigo, b.nombre, b.siglas, b.encargado_nombre].some((v) => String(v || '').toLowerCase().includes(q)));
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>Bodegas <small>${lista.length}</small></h2>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar bodega…" value="${esc(buscar)}" aria-label="Buscar bodegas"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table><thead><tr><th class="num">Bodega</th><th>Nombre</th><th>Tipo</th><th>Bodega mayor</th><th>Modalidad</th><th>Estado</th></tr></thead>
            <tbody>${filas.map((b) => { const m = bodega(b.bodega_mayor_id); const sub = b.tipo === 'SUB-BODEGA'; return `<tr data-id="${b.id}" class="${actual && actual.id === b.id ? 'actual' : ''} ${b.estado === 'INACTIVO' ? 'pc-anulada' : ''}" tabindex="0">
              <td class="num fuerte">${b.codigo}</td><td class="cc-nombre ${sub ? 'cp-sub' : 'fuerte'}" title="${esc(b.nombre)}">${sub ? '<i class="ti ti-corner-down-right" aria-hidden="true"></i> ' : ''}${esc(b.nombre)}${b.siglas ? ` <span class="tk-tenue">${esc(b.siglas)}</span>` : ''}</td>
              <td><span class="pc-tipo ${sub ? '' : 'cp-general'}">${sub ? 'SUB-BODEGA' : 'GENERAL'}</span></td><td>${m ? `${m.codigo} · ${esc(m.nombre)}` : '<span class="tk-tenue">—</span>'}</td>
              <td>${esc(b.modalidad)}</td><td><span class="pc-marca ${b.estado === 'ACTIVO' ? 'aprobada' : 'pendiente'}">${b.estado === 'ACTIVO' ? 'Activa' : 'Inactiva'}</span></td></tr>`; }).join('')
              || `<tr><td colspan="6" class="tk-vacio"><i class="ti ti-building-warehouse" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : lista.length ? 'Ninguna bodega coincide.' : `No hay bodegas${ctx.admin ? ': crea la primera con «Nueva bodega».' : '.'}`}</td></tr>`}</tbody></table>
        </div>`;
    }
    function abrir(b) {
      actual = b;
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-id]').forEach((tr) => tr.classList.toggle('actual', !!b && tr.dataset.id === String(b.id)));
    }

    function pintarDetalle(v0) {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-building-warehouse'); return; }
      const b = actual;
      if (!b && !nuevo) { ctx.pDet.innerHTML = ctx.vacio(ctx.admin ? 'Elige una bodega o crea una nueva.' : 'Elige una bodega.', 'ti-building-warehouse'); return; }
      const dis = ctx.admin ? '' : 'disabled';
      const v = v0 || (b ? { ...b } : { tipo: 'GENERAL', bodega_mayor_id: null, modalidad: 'NORMAL', tipo_precio: 'DISTRIBUIDOR', estado: 'ACTIVO', carga_directa: true, permite_ventas: false, consignacion: false, licitacion: false });
      const chk = (name, etq) => `<label class="pc-check"><input type="checkbox" name="${name}" ${v[name] ? 'checked' : ''} ${dis}> ${etq}</label>`;
      const trxSel = ([k, t]) => `<label class="campo"><span>${t}</span><select name="${k}" ${dis}>${opcionesTrx(transacciones, v[k])}</select></label>`;
      const mayores = lista.filter((x) => x.tipo === 'GENERAL' && (!b || x.id !== b.id));
      const pt = contable(v.cuenta_pt_id);
      ctx.pDet.innerHTML = `
        <form class="tk-form bm-form cp-form cb-form" novalidate>
          <header class="tk-titulo bm-titulo">
            <span class="tk-icono"><i class="ti ti-building-warehouse" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>${b ? `Bodega ${b.codigo}` : 'Nueva bodega'}</small><h2>${b ? esc(b.nombre) : 'Datos de la bodega'}</h2></div>
            <div class="tk-marcas">${b ? `<span class="pc-marca ${b.estado === 'ACTIVO' ? 'aprobada' : 'pendiente'}">${b.estado === 'ACTIVO' ? 'Activa' : 'Inactiva'}</span><span class="pc-marca definitiva">${esc(b.tipo)}</span>` : ''}</div>
            <div class="tk-titulo-acciones">
              ${nuevo ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}
              ${ctx.admin ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${b ? 'Guardar cambios' : 'Crear bodega'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          <section class="bm-bloque">
            <h3 class="ta-col-titulo"><i class="ti ti-id" aria-hidden="true"></i> Bodega</h3>
            <div class="cp-g cp-g6">
              <div class="bs-req-num"><span>Bodega</span><b>${b ? b.codigo : 'Auto'}</b></div>
              <label class="campo cp-c3"><span>Nombre *</span><input name="nombre" value="${esc(v.nombre || '')}" maxlength="100" ${dis}></label>
              <label class="campo"><span>Siglas</span><input name="siglas" value="${esc(v.siglas || '')}" maxlength="6" ${dis}></label>
              <label class="campo"><span>Estado</span><select name="estado" ${dis}>${['ACTIVO', 'INACTIVO'].map((e) => `<option ${v.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
              <label class="campo cp-c2"><span>Tipo</span><select name="tipo" ${dis}>${['GENERAL', 'SUB-BODEGA'].map((e) => `<option ${v.tipo === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
              <label class="campo cp-c4"><span>Bodega mayor${v.tipo === 'SUB-BODEGA' ? ' *' : ''}</span><select name="bodega_mayor_id" ${dis}><option value="">${v.tipo === 'SUB-BODEGA' ? 'Elige la bodega general' : '— (es bodega principal)'}</option>${mayores.map((x) => `<option value="${x.id}" ${x.id === v.bodega_mayor_id ? 'selected' : ''}>${x.codigo} · ${esc(x.nombre)}</option>`).join('')}</select></label>
              <label class="campo cp-c6"><span>Dirección</span><input name="direccion" value="${esc(v.direccion || '')}" maxlength="200" ${dis}></label>
              <div class="campo cp-c3"><span>Tipo de bodega</span><div class="cc-radios">${MODALIDADES.map(([k, t]) => `<label class="pc-check"><input type="radio" name="modalidad" value="${k}" ${v.modalidad === k ? 'checked' : ''} ${dis}> ${t}</label>`).join('')}</div></div>
              <label class="campo cp-c3"><span>Tipo de precio por defecto</span><select name="tipo_precio" ${dis}>${PRECIOS.map((x) => `<option ${v.tipo_precio === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
              <div class="cp-checks cp-c6">${chk('carga_directa', '¿Permitir carga directa?')}${chk('consignacion', '¿Bodega de consignación?')}${chk('licitacion', '¿Bodega de licitación?')}${chk('permite_ventas', '¿Permitir ventas?')}</div>
              <label class="campo"><span>Encargado</span><input name="encargado_codigo" value="${esc(v.encargado_codigo || '')}" maxlength="20" placeholder="Código" ${dis}></label>
              <label class="campo cp-c5"><span>Nombre del encargado</span><input name="encargado_nombre" value="${esc(v.encargado_nombre || '')}" maxlength="120" ${dis}></label>
            </div>
          </section>
          <section class="bm-bloque cb-contable">
            <h3 class="ta-col-titulo"><i class="ti ti-calculator" aria-hidden="true"></i> Definiciones contables por bodega</h3>
            <div class="cb-dos">
              <fieldset class="cc-fiscal"><legend>Transacciones</legend><div class="cp-g cp-g2">${TRX.map(trxSel).join('')}</div></fieldset>
              <fieldset class="cc-fiscal"><legend>Reversiones</legend><div class="cp-g cp-g2">${REV.map(trxSel).join('')}
                <label class="campo"><span>Cuenta PT</span><span class="cp-cta"><input list="cb-cuentas" name="cuenta_pt" value="${esc(pt ? pt.codigo : '')}" placeholder="Código" ${dis}><small data-nombre-de="cuenta_pt">${pt ? esc(pt.nombre) : ''}</small></span></label></div></fieldset>
            </div>
          </section>
          ${b ? `<p class="cc-ingreso"><i class="ti ti-user" aria-hidden="true"></i> Creó ${esc(b.creado_por_nombre || '')} · ${esc(fmt.fechaHora(b.creado_en))}${b.modificado_en ? ` · modificó ${esc(b.modificado_por_nombre || '')} ${esc(fmt.fechaHora(b.modificado_en))}` : ''}</p>` : ''}
          <datalist id="cb-cuentas">${contables.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('')}</datalist>
        </form>`;
    }
    function leer(form) {
      const el = form.elements;
      const t = (n) => el[n].value.trim() || null;
      const id = (n) => el[n].value ? Number(el[n].value) : null;
      const k = porCodigo(el.cuenta_pt.value);
      const v = {
        nombre: el.nombre.value.trim(), siglas: t('siglas'), estado: el.estado.value, tipo: el.tipo.value, bodega_mayor_id: id('bodega_mayor_id'), direccion: t('direccion'),
        modalidad: form.querySelector('[name=modalidad]:checked')?.value || 'NORMAL', tipo_precio: el.tipo_precio.value,
        carga_directa: el.carga_directa.checked, consignacion: el.consignacion.checked, licitacion: el.licitacion.checked, permite_ventas: el.permite_ventas.checked,
        encargado_codigo: t('encargado_codigo'), encargado_nombre: t('encargado_nombre'), cuenta_pt_id: k ? k.id : null, _pt: el.cuenta_pt.value.trim()
      };
      [...TRX, ...REV].forEach(([n]) => { v[n] = id(n); });
      return v;
    }
    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      const v = leer(form);
      const foco = (n, txt) => { error.textContent = txt; form.elements[n]?.focus(); };
      if (!v.nombre) return foco('nombre', 'Escribe el nombre de la bodega.');
      if (v.siglas && !/^[A-Za-z0-9]{1,6}$/.test(v.siglas)) return foco('siglas', 'Las siglas son de 1 a 6 letras o números.');
      if (v.tipo === 'SUB-BODEGA' && !v.bodega_mayor_id) return foco('bodega_mayor_id', 'Elige la bodega mayor de la sub-bodega.');
      if (v._pt && !v.cuenta_pt_id) return foco('cuenta_pt', 'La cuenta PT no es de movimiento en el catálogo de la localidad.');
      delete v._pt;
      error.textContent = '';
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      const r = actual ? await sb.from('bodegas').update(v).eq('id', actual.id).select('id').single()
        : await sb.from('bodegas').insert({ ...v, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single();
      boton.disabled = false;
      if (r.error) { error.textContent = window.UI.traducirError(r.error); return; }
      window.FIN.aviso(actual ? 'Bodega guardada' : 'Bodega creada');
      nuevo = false;
      if (f.estado && v.estado !== f.estado) { f.estado = ''; pintarFiltros(); }
      await consultar(r.data.id);
    }
    function listado() {
      const filas = arbol();
      if (!filas.length) return window.FIN.aviso('No hay bodegas');
      const emp = ctx.localidad(ctx.sel.loc);
      const trx = (id) => { const t = transacciones.find((x) => x.id === id); return t ? String(t.numero) : ''; };
      imprimir('Listado de bodegas', `<h1>Bodegas</h1><h2>${esc(emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '')} · ${filas.length} bodegas</h2>
        <table><thead><tr><th>Bodega</th><th>Nombre</th><th>Tipo</th><th>Mayor</th><th>Modalidad</th><th>Encargado</th><th>Precio</th><th>Trx entradas</th><th>Trx despachos</th><th>Cuenta PT</th><th>Estado</th></tr></thead>
        <tbody>${filas.map((b) => `<tr><td>${b.codigo}</td><td>${b.tipo === 'SUB-BODEGA' ? '&nbsp;&nbsp;↳ ' : ''}${esc(b.nombre)}</td><td>${esc(b.tipo)}</td><td>${esc(bodega(b.bodega_mayor_id)?.nombre || '')}</td><td>${esc(b.modalidad)}</td><td>${esc(b.encargado_nombre || '')}</td><td>${esc(b.tipo_precio)}</td><td>${trx(b.trx_entradas_id)}</td><td>${trx(b.trx_despachos_id)}</td><td>${esc(contable(b.cuenta_pt_id)?.codigo || '')}</td><td>${esc(b.estado)}</td></tr>`).join('')}</tbody></table>`);
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { pintarFiltros(); nuevo = false; return cargarLocalidad(); }
      if (cambio === 'otro') { f.estado = e.target.value; pintarLista(); return abrir(arbol().find((b) => b.id === actual?.id) || arbol()[0] || null); }
      const form = e.target.closest('.cb-form');
      if (!form) return;
      if (e.target.name === 'tipo' || e.target.name === 'modalidad') { const v = leer(form); delete v._pt; if (v.modalidad === 'CONSIGNACIÓN') v.consignacion = true; return pintarDetalle({ ...(actual || {}), ...v }); }
      if (e.target.name === 'cuenta_pt') { const k = porCodigo(e.target.value); form.querySelector('[data-nombre-de=cuenta_pt]').innerHTML = k ? esc(k.nombre) : e.target.value.trim() ? '<span class="pc-error">No es de movimiento</span>' : ''; }
    });
    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-buscar]')) return;
      buscar = e.target.value;
      const pos = e.target.selectionStart;
      pintarLista();
      const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
    });
    cont.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-buscar]')) e.preventDefault(); });
    cont.addEventListener('click', (e) => {
      const fila = e.target.closest('tr[data-id]');
      if (fila && ctx.pMae.contains(fila)) { nuevo = false; return abrir(bodega(Number(fila.dataset.id))); }
      const ac = e.target.closest('[data-accion]');
      if (!ac) return;
      const a = ac.dataset.accion;
      if (a === 'nuevo') { nuevo = true; actual = null; ctx.pMae.querySelectorAll('tr.actual').forEach((tr) => tr.classList.remove('actual')); pintarDetalle(); return ctx.pDet.querySelector('[name=nombre]')?.focus(); }
      if (a === 'cancelar') { nuevo = false; return abrir(arbol()[0] || null); }
      if (a === 'listado') return listado();
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.cb-form')) { e.preventDefault(); guardar(e.target); } });

    iniciar();
  };

  window.COMPRAS_CAT = { centrosLocalidad, transaccionesLocalidad, opcionesTrx, descargarCsv };
})();
