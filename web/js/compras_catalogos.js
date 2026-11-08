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
  const opcionesTrx = (lista, id) => `<option value="">—</option>${lista.filter((t) => t.estado === 'ACTIVO' || t.id === id).slice().sort((a, b) => String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es')).map((t) => `<option value="${t.id}" ${t.id === id ? 'selected' : ''}>${esc(t.descripcion)} · ${t.numero}</option>`).join('')}`;
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
  window.PANTALLAS.proveedores = function (cont, m) {
    const ctx = montar(cont, { titulo: 'Proveedores', icono: 'ti-truck', clase: 'bk-proveedores cb-apilado', grupo: `${m?.id === 'inventarios' ? 'Inventarios' : 'Compras'} · Catálogos` });
    const { sb, yo } = ctx;
    const f = { estado: 'ACTIVO', tipo: '', formato: 'PDF' };
    let lista = [];
    let actual = null;
    let nuevo = false;
    let tipos = [], regimenes = [], bodegas = [], contables = [], centros = [], transacciones = [];
    let cuentasProv = [];
    let pestana = 'FICHA'; // FICHA (los tres bloques) o CUENTAS (varias cuentas)
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

    // Lista a lo ancho con las columnas para comparar proveedores.
    function pintarLista() {
      const q = buscar.trim().toLowerCase();
      const filas = lista.filter((p) => !q || [p.codigo, p.nit, p.nombre_comercial, p.nombre_fiscal, p.contacto].some((v) => String(v || '').toLowerCase().includes(q)));
      const tipo = (id) => tipos.find((t) => t.id === id)?.nombre.replace(/^PROVEEDOR (DEL |DE )?/, '') || '';
      const reg = (id) => regimenes.find((t) => t.id === id);
      const si = (x) => x ? '<i class="ti ti-check cb-si" aria-label="Sí"></i>' : '<span class="tk-tenue">—</span>';
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>Proveedores <small>${lista.length}</small></h2>
          <span class="cb-resumen">${lista.filter((p) => p.nacional).length} nacionales · ${lista.filter((p) => !p.nacional).length} del exterior · ${lista.filter((p) => p.pendiente_revisar).length} pendientes de revisar</span>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Código, NIT o nombre…" value="${esc(buscar)}" aria-label="Buscar proveedores"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table><thead><tr><th class="num">Código</th><th>NIT</th><th>Nombre comercial</th><th>Nombre fiscal</th><th>Tipo</th><th>Régimen ISR</th><th class="num">Días</th><th class="cb-c">Retención</th><th>Cuenta gastos</th><th>Estado</th></tr></thead>
            <tbody>${filas.map((p) => { const r = reg(p.regimen_isr_id); return `<tr data-id="${p.id}" class="${actual && actual.id === p.id ? 'actual' : ''}" tabindex="0">
              <td class="num fuerte">${p.codigo}</td><td>${esc(p.nit || '')}</td>
              <td class="cc-nombre fuerte" title="${esc(p.nombre_comercial)}">${esc(p.nombre_comercial)}${p.pendiente_revisar ? ' <i class="ti ti-flag cp-revisar" title="Pendiente de revisar" aria-label="Pendiente de revisar"></i>' : ''}${p.servicio_critico ? ' <i class="ti ti-alert-triangle cp-critico" title="Servicio crítico" aria-label="Servicio crítico"></i>' : ''}</td>
              <td class="cc-nombre" title="${esc(p.nombre_fiscal || '')}">${esc(p.nombre_fiscal || '')}</td>
              <td>${esc(tipo(p.tipo_proveedor_id))}</td><td class="cp-reg" title="${esc(r?.nombre || '')}">${r ? `${r.codigo} · ${esc(r.nombre)}` : p.regimen_isr_anterior ? `<span class="tk-tenue">${p.regimen_isr_anterior} (anterior)</span>` : '<span class="tk-tenue">—</span>'}</td>
              <td class="num">${p.dias_credito || '<span class="tk-tenue">—</span>'}</td><td class="cb-c">${si(p.efectuar_retencion)}</td>
              <td>${esc(contable(p.cuenta_gasto_id)?.codigo || p.cuenta_gasto_codigo || '')}</td><td>${marcaEstado(p.estado)}</td></tr>`; }).join('')
              || `<tr><td colspan="10" class="tk-vacio"><i class="ti ti-truck" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : lista.length ? 'Ningún proveedor coincide con la búsqueda.' : `No hay proveedores${ctx.admin ? ': crea el primero con «Nuevo proveedor».' : '.'}`}</td></tr>`}</tbody></table>
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

    // Cuenta del proveedor: la del catálogo vigente o, si está ligada a otra versión, su código guardado.
    const cuentaCampo = (name, etq, id, dis, codigoGuardado) => { const k = contable(id); return `<label class="cb-linea"><span>${etq}</span><span class="cp-cta cb-cta"><input list="cp-cuentas" name="${name}" value="${esc(k ? k.codigo : codigoGuardado || '')}" placeholder="Código" ${dis}><small data-nombre-de="${name}">${k ? esc(k.nombre) : id && codigoGuardado ? 'Ligada a otra versión del catálogo' : ''}</small></span></label>`; };

    // Ficha en tres bloques: proveedor, contacto y clasificación, contable y pago. «Varias cuentas»
    // muestra la distribución del gasto en lugar de la ficha (los campos siguen en el formulario).
    function pintarDetalle(v0) {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-truck'); return; }
      const p = actual;
      if (!p && !nuevo) { ctx.pDet.innerHTML = ctx.vacio(ctx.admin ? 'Elige un proveedor o crea uno nuevo.' : 'Elige un proveedor.', 'ti-truck'); return; }
      const dis = ctx.admin ? '' : 'disabled';
      const local = tipos.find((t) => /LOCAL/.test(t.nombre));
      const v = v0 || (p ? { ...p } : { estado: 'ACTIVO', nacional: true, servicio_critico: false, pendiente_revisar: false, tipo_proveedor_id: local?.id || null, regimen_isr_id: null, bodega_id: null, dias_credito: 0, efectuar_retencion: false, varias_cuentas: false, visualizar_en: 'AMBAS', forma_pago: 'CHEQUE', moneda_id: ctx.monedaBase()?.id, tipo_cuenta: 'MONETARIA' });
      const sel = (name, opciones, etq = '') => `<select name="${name}" ${dis} ${etq ? `aria-label="${etq}"` : ''}>${opciones}</select>`;
      const chk = (name, etq, val) => `<label class="pc-check"><input type="checkbox" name="${name}" ${val ? 'checked' : ''} ${dis}> ${etq}</label>`;
      const txt = (name, etq, max, extra = '') => `<label class="cb-linea"><span>${etq}</span><input name="${name}" value="${esc(v[name] || '')}" maxlength="${max}" ${extra} ${dis}></label>`;
      const conMas = (accion, titulo) => ctx.admin ? `<button type="button" class="icono-boton" data-accion="${accion}" title="${titulo}" aria-label="${titulo}"><i class="ti ti-plus" aria-hidden="true"></i></button>` : '';
      const cuentas = pestana === 'CUENTAS';
      ctx.pDet.innerHTML = `
        <form class="tk-form cp-form cb-ficha cp-ficha" novalidate>
          <header class="tk-titulo cb-titulo">
            <span class="tk-icono"><i class="ti ti-truck" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>${p ? `Proveedor ${p.codigo}` : 'Nuevo proveedor'}</small><h2>${p ? esc(p.nombre_comercial) : 'Datos del proveedor'}</h2></div>
            <div class="tk-marcas">${p ? marcaEstado(p.estado) : ''}${p?.pendiente_revisar ? '<span class="pc-marca pendiente"><i class="ti ti-flag" aria-hidden="true"></i> Pendiente de revisar</span>' : ''}</div>
            ${p ? `<p class="cc-ingreso cb-audit"><i class="ti ti-user" aria-hidden="true"></i> Creó ${esc(p.creado_por_nombre || '')} · ${esc(fmt.fechaHora(p.creado_en))}${p.modificado_en ? ` · modificó ${esc(p.modificado_por_nombre || '')} ${esc(fmt.fechaHora(p.modificado_en))}` : ''}</p>` : ''}
            <p class="modal-error tk-error" role="alert"></p>
            <div class="tk-titulo-acciones">
              <button type="button" class="boton secundario-sm" data-pestana="${cuentas ? 'FICHA' : 'CUENTAS'}">${cuentas ? '<i class="ti ti-arrow-left" aria-hidden="true"></i> Volver a la ficha' : `<i class="ti ti-list-numbers" aria-hidden="true"></i> Varias cuentas${cuentasProv.length ? ` <b>${cuentasProv.length}</b>` : ''}`}</button>
              ${nuevo ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}
              ${ctx.admin ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${p ? 'Guardar cambios' : 'Crear proveedor'}</button>` : ''}
            </div>
          </header>
          <div class="cb-tres cp-tres" data-panel="FICHA" ${cuentas ? 'hidden' : ''}>
            <section class="cb-bloque">
              <h3 class="ta-col-titulo"><i class="ti ti-id" aria-hidden="true"></i> Proveedor ${p ? p.codigo : '(automático)'}</h3>
              ${txt('nit', 'NIT', 20, 'placeholder="1234567-8 o CF"')}
              ${txt('nombre_comercial', 'Nombre comercial *', 150)}
              ${txt('nombre_fiscal', 'Nombre fiscal (SAT)', 150, 'placeholder="Si se deja vacío, el comercial"')}
              ${txt('nombre_emision', 'Emisión de docs.', 150, 'placeholder="Si se deja vacío, el fiscal"')}
              ${txt('direccion', 'Dirección', 300)}
              <label class="cb-linea"><span class="cp-req">Concepto de gastos *</span><input name="concepto_gastos" value="${esc(v.concepto_gastos || '')}" maxlength="300" ${dis}></label>
              ${p && (p.fax || p.acreditaciones) ? `<p class="cb-trx-ant">${p.fax ? `Fax ${esc(p.fax)}` : ''}${p.fax && p.acreditaciones ? ' · ' : ''}${p.acreditaciones ? `Acreditaciones ${esc(p.acreditaciones)}` : ''}</p>` : ''}
            </section>
            <section class="cb-bloque">
              <h3 class="ta-col-titulo"><i class="ti ti-address-book" aria-hidden="true"></i> Contacto y clasificación</h3>
              <div class="cb-par cp-tel">${txt('telefonos', 'Teléfonos', 60)}<label class="cb-linea"><span>Ext.</span><input name="extension" value="${esc(v.extension || '')}" maxlength="10" ${dis}></label></div>
              ${txt('contacto', 'Contacto', 100)}
              <label class="cb-linea"><span>Correo</span><input type="email" name="correo" value="${esc(v.correo || '')}" maxlength="120" ${dis}></label>
              <label class="cb-linea"><span>Tipo de proveedor</span><span class="cp-con-mas">${sel('tipo_proveedor_id', `<option value="">—</option>${tipos.filter((t) => t.activo || t.id === v.tipo_proveedor_id).map((t) => `<option value="${t.id}" ${t.id === v.tipo_proveedor_id ? 'selected' : ''}>${t.codigo} · ${esc(t.nombre)}</option>`).join('')}`, 'Tipo de proveedor')}${conMas('nuevo-tipo', 'Agregar tipo de proveedor')}</span></label>
              <label class="cb-linea"><span>Régimen ISR</span><span class="cp-con-mas">${sel('regimen_isr_id', `<option value="">${p?.regimen_isr_anterior && !v.regimen_isr_id ? `— (código anterior ${p.regimen_isr_anterior})` : '—'}</option>${regimenes.filter((t) => t.activo || t.id === v.regimen_isr_id).map((t) => `<option value="${t.id}" ${t.id === v.regimen_isr_id ? 'selected' : ''}>${t.codigo} · ${esc(t.nombre)}</option>`).join('')}`, 'Régimen ISR')}${conMas('nuevo-regimen', 'Agregar régimen ISR')}</span></label>
              <div class="cb-par">
                <label class="cb-linea"><span>Bodega</span>${sel('bodega_id', `<option value="">—</option>${bodegas.filter((b) => b.estado === 'ACTIVO' || b.id === v.bodega_id).map((b) => `<option value="${b.id}" ${b.id === v.bodega_id ? 'selected' : ''}>${b.codigo} · ${esc(b.nombre)}</option>`).join('')}`, 'Bodega')}</label>
                <label class="cb-linea"><span>Estado</span>${sel('estado', ESTADOS.map((e) => `<option ${v.estado === e ? 'selected' : ''}>${e}</option>`).join(''), 'Estado')}</label>
              </div>
              <div class="cb-checks cp-checks3">${chk('nacional', 'Nacional', v.nacional)}${chk('servicio_critico', 'Servicio crítico', v.servicio_critico)}${chk('pendiente_revisar', 'Pendiente de revisar', v.pendiente_revisar)}</div>
            </section>
            <section class="cb-bloque">
              <h3 class="ta-col-titulo"><i class="ti ti-calculator" aria-hidden="true"></i> Contable y pago</h3>
              <div class="cb-par">
                <label class="cb-linea"><span>Días de crédito</span>${sel('dias_credito', DIAS.map(([d, t]) => `<option value="${d}" ${Number(v.dias_credito) === d ? 'selected' : ''}>${t}</option>`).join('') + (DIAS.some(([d]) => d === Number(v.dias_credito)) ? '' : `<option value="${v.dias_credito}" selected>${v.dias_credito} DÍAS</option>`), 'Días de crédito')}</label>
                <label class="cb-linea"><span>Visualizar</span>${sel('visualizar_en', VISUALIZAR.map((x) => `<option ${v.visualizar_en === x ? 'selected' : ''}>${x}</option>`).join(''), 'Visualizar en')}</label>
              </div>
              <div class="cb-checks">${chk('efectuar_retencion', 'Efectuar retención', v.efectuar_retencion)}${chk('varias_cuentas', 'Varias cuentas', v.varias_cuentas)}</div>
              ${cuentaCampo('cuenta_gasto', 'Cuenta de gastos', v.cuenta_gasto_id, dis, v.cuenta_gasto_codigo)}
              <div class="cb-par">
                <label class="cb-linea"><span>Transacción</span>${sel('transaccion_id', opcionesTrx(transacciones, v.transaccion_id), 'Transacción')}</label>
                <label class="cb-linea" title="2da. transacción (exenciones)"><span>2da.</span>${sel('transaccion_exencion_id', opcionesTrx(transacciones, v.transaccion_exencion_id), '2da. transacción (exenciones)')}</label>
              </div>
              <div class="cb-par">
                <div class="cb-linea"><span>Forma de pago</span><div class="cc-radios">${[['CHEQUE', 'Cheque'], ['TRANSFERENCIA', 'Transf.']].map(([k, t]) => `<label class="pc-check"><input type="radio" name="forma_pago" value="${k}" ${v.forma_pago === k ? 'checked' : ''} ${dis}> ${t}</label>`).join('')}</div></div>
                <label class="cb-linea"><span>Moneda</span>${sel('moneda_id', ctx.monedas.map((m) => `<option value="${m.id}" ${m.id === v.moneda_id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join(''), 'Moneda')}</label>
              </div>
              <div class="cb-par">
                <label class="cb-linea"><span>Banco</span>${sel('banco_id', `<option value="">—</option>${ctx.bancosLoc().filter((b) => b.activo || b.id === v.banco_id).map((b) => `<option value="${b.id}" ${b.id === v.banco_id ? 'selected' : ''}>${esc(b.siglas || b.nombre)}</option>`).join('')}`, 'Banco')}</label>
                <label class="cb-linea"><span>Tipo cuenta</span>${sel('tipo_cuenta', `<option value="">—</option>${['MONETARIA', 'AHORRO'].map((x) => `<option ${v.tipo_cuenta === x ? 'selected' : ''}>${x}</option>`).join('')}`, 'Tipo de cuenta')}</label>
              </div>
              <div class="cb-par">${txt('cuenta_bancaria', 'Cuenta bancaria', 40)}${txt('titular_cuenta', 'Titular', 150)}</div>
              <div class="cb-par">${txt('beneficiario', 'Beneficiario', 150, 'placeholder="El nombre fiscal"')}<label class="cb-linea"><span>Correo pagos</span><input type="email" name="correo_pagos" value="${esc(v.correo_pagos || '')}" maxlength="120" ${dis}></label></div>
            </section>
          </div>
          <section class="cb-bloque cp-cuentas" data-panel="CUENTAS" ${cuentas ? '' : 'hidden'}>
            <h3 class="ta-col-titulo"><i class="ti ti-list-numbers" aria-hidden="true"></i> Varias cuentas · distribución del gasto</h3>
            ${v.varias_cuentas ? `<div class="pc-lineas"><table><thead><tr><th class="pc-n">Línea</th><th class="pc-cta">Cuenta</th><th>Nombre</th><th class="bm-centro">Centro</th><th class="num">%</th><th>Descripción</th><th></th></tr></thead>
              <tbody>${cuentasProv.map((l, i) => `<tr data-cta="${i}"><td class="pc-n">${i + 1}</td><td class="pc-cta"><input list="cp-cuentas" data-c="codigo" value="${esc(l.codigo || '')}" ${dis} aria-label="Cuenta"></td><td class="pc-nombre" data-nombre>${esc(porCodigo(l.codigo)?.nombre || '')}</td>
                <td class="bm-centro"><input list="cp-centros" data-c="centro_codigo" value="${esc(l.centro_codigo || '')}" ${dis} aria-label="Centro"></td><td class="num"><input type="number" step="0.01" min="0" max="100" data-c="porcentaje" value="${l.porcentaje ?? ''}" ${dis} aria-label="Porcentaje"></td>
                <td><input data-c="descripcion" value="${esc(l.descripcion || '')}" maxlength="120" ${dis} aria-label="Descripción"></td><td>${dis ? '' : `<button type="button" class="icono-boton" data-quitar-cta="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>`}</td></tr>`).join('')
                || '<tr><td colspan="7" class="tk-vacio">Agrega las cuentas del proveedor.</td></tr>'}</tbody></table></div>
              ${ctx.admin ? '<button type="button" class="boton secundario-sm cp-agregar" data-accion="agregar-cta"><i class="ti ti-plus" aria-hidden="true"></i> Cuenta</button>' : ''}`
              : `<p class="tk-vacio cp-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> Marca «Varias cuentas» en Contable y pago para distribuir el gasto del proveedor en varias cuentas.</p>`}
          </section>
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
      // Si el código no cambió y la cuenta es de otra versión del catálogo, se conserva la que tenía.
      const igual = actual?.cuenta_gasto_id && cg && cg === (contable(actual.cuenta_gasto_id)?.codigo || actual.cuenta_gasto_codigo);
      const k = igual ? { id: actual.cuenta_gasto_id } : porCodigo(cg);
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
      if (v._cg && !v.cuenta_gasto_id) { pestana = 'FICHA'; repintar(); return ctx.pDet.querySelector('.modal-error').textContent = 'La cuenta de gastos no es de movimiento en el catálogo de la localidad.'; }
      if (v.forma_pago === 'TRANSFERENCIA' && !v.cuenta_bancaria) { pestana = 'FICHA'; repintar(); return ctx.pDet.querySelector('.modal-error').textContent = 'Para pagar por transferencia escribe la cuenta bancaria del proveedor.'; }
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
      if (tab) { pestana = tab.dataset.pestana; return repintar(); }
      const fila = e.target.closest('tr[data-id]');
      if (fila && ctx.pMae.contains(fila)) { nuevo = false; return abrir(lista.find((p) => String(p.id) === fila.dataset.id)); }
      const q = e.target.closest('[data-quitar-cta]');
      if (q) { leerCuentas(); cuentasProv.splice(Number(q.dataset.quitarCta), 1); return repintar(); }
      const ac = e.target.closest('[data-accion]');
      if (!ac) return;
      const a = ac.dataset.accion;
      if (a === 'nuevo') { nuevo = true; actual = null; cuentasProv = []; pestana = 'FICHA'; ctx.pMae.querySelectorAll('tr.actual').forEach((tr) => tr.classList.remove('actual')); pintarDetalle(); return ctx.pDet.querySelector('[name=nit]')?.focus(); }
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
  window.PANTALLAS.bodegas = function (cont, m) {
    const ctx = montar(cont, { titulo: 'Administración de bodegas', icono: 'ti-building-warehouse', clase: 'bk-bodegas cb-apilado', grupo: `${m?.id === 'inventarios' ? 'Inventarios' : 'Compras'} · Catálogos` });
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
    // Lista a lo ancho: generales con sus sub-bodegas debajo y las columnas para comparar bodegas.
    function pintarLista() {
      const q = buscar.trim().toLowerCase();
      const filas = arbol().filter((b) => !q || [b.codigo, b.nombre, b.siglas, b.encargado_nombre].some((v) => String(v || '').toLowerCase().includes(q)));
      const generales = lista.filter((b) => b.tipo === 'GENERAL').length;
      const si = (x) => x ? '<i class="ti ti-check cb-si" aria-label="Sí"></i>' : '<span class="tk-tenue">—</span>';
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>Bodegas <small>${lista.length}</small></h2>
          <span class="cb-resumen">${generales} generales · ${lista.length - generales} sub-bodegas · ${lista.filter((b) => b.estado === 'ACTIVO').length} activas</span>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar bodega…" value="${esc(buscar)}" aria-label="Buscar bodegas"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table><thead><tr><th class="num">Bodega</th><th>Nombre</th><th>Siglas</th><th>Tipo</th><th>Bodega mayor</th><th>Modalidad</th><th>Precio</th><th>Encargado</th><th class="cb-c">Carga directa</th><th class="cb-c">Ventas</th><th class="cb-c">Licitación</th><th>Estado</th></tr></thead>
            <tbody>${filas.map((b) => { const m = bodega(b.bodega_mayor_id); const sub = b.tipo === 'SUB-BODEGA'; return `<tr data-id="${b.id}" class="${actual && actual.id === b.id ? 'actual' : ''} ${b.estado === 'INACTIVO' ? 'pc-anulada' : ''}" tabindex="0">
              <td class="num fuerte">${b.codigo}</td><td class="cc-nombre ${sub ? 'cp-sub' : 'fuerte'}" title="${esc(b.nombre)}">${sub ? '<i class="ti ti-corner-down-right" aria-hidden="true"></i> ' : ''}${esc(b.nombre)}</td>
              <td>${esc(b.siglas || '')}</td>
              <td><span class="pc-tipo ${sub ? '' : 'cp-general'}">${sub ? 'SUB-BODEGA' : 'GENERAL'}</span></td><td>${m ? `${m.codigo} · ${esc(m.nombre)}` : '<span class="tk-tenue">—</span>'}</td>
              <td>${esc(b.modalidad)}</td><td>${esc(b.tipo_precio)}</td><td class="cb-enc" title="${esc(b.encargado_nombre || '')}">${esc(b.encargado_nombre || '') || '<span class="tk-tenue">—</span>'}</td>
              <td class="cb-c">${si(b.carga_directa)}</td><td class="cb-c">${si(b.permite_ventas)}</td><td class="cb-c">${si(b.licitacion)}</td>
              <td><span class="pc-marca ${b.estado === 'ACTIVO' ? 'aprobada' : 'pendiente'}">${b.estado === 'ACTIVO' ? 'Activa' : 'Inactiva'}</span></td></tr>`; }).join('')
              || `<tr><td colspan="12" class="tk-vacio"><i class="ti ti-building-warehouse" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : lista.length ? 'Ninguna bodega coincide.' : `No hay bodegas${ctx.admin ? ': crea la primera con «Nueva bodega».' : '.'}`}</td></tr>`}</tbody></table>
        </div>`;
    }
    function abrir(b) {
      actual = b;
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-id]').forEach((tr) => tr.classList.toggle('actual', !!b && tr.dataset.id === String(b.id)));
    }

    // Ficha en tres bloques: datos de la bodega, configuración y definiciones contables.
    function pintarDetalle(v0) {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-building-warehouse'); return; }
      const b = actual;
      if (!b && !nuevo) { ctx.pDet.innerHTML = ctx.vacio(ctx.admin ? 'Elige una bodega o crea una nueva.' : 'Elige una bodega.', 'ti-building-warehouse'); return; }
      const dis = ctx.admin ? '' : 'disabled';
      const v = v0 || (b ? { ...b } : { tipo: 'GENERAL', bodega_mayor_id: null, modalidad: 'NORMAL', tipo_precio: 'DISTRIBUIDOR', estado: 'ACTIVO', carga_directa: true, permite_ventas: false, consignacion: false, licitacion: false });
      const chk = (name, etq) => `<label class="pc-check"><input type="checkbox" name="${name}" ${v[name] ? 'checked' : ''} ${dis}> ${etq}</label>`;
      const mayores = lista.filter((x) => x.tipo === 'GENERAL' && (!b || x.id !== b.id));
      const pt = contable(v.cuenta_pt_id);
      const sn = (x) => x === true ? 'Sí' : x === false ? 'No' : '—';
      // Datos del sistema anterior (script 87): solo se muestran si la bodega los trae.
      const anteriores = b ? [
        ['Secuencia', b.secuencia_orden], ['Escoger serie', b.escoger_serie != null ? sn(b.escoger_serie) : null],
        ['Desglose despacho', b.calcular_desg_despacho != null ? sn(b.calcular_desg_despacho) : null], ['Aplica conta', b.aplica_conta != null ? sn(b.aplica_conta) : null],
        ['COVID', b.bodega_covid != null ? sn(b.bodega_covid) : null], ['Precio (código)', b.tipo_precio_anterior],
        ['Cuenta PT ant.', b.cuenta_pt_codigo && !pt ? b.cuenta_pt_codigo : null], ['Cuenta PT sumin.', b.cuenta_pt_sumi]
      ].filter(([, x]) => x != null && x !== '') : [];
      ctx.pDet.innerHTML = `
        <form class="tk-form cp-form cb-form cb-ficha" novalidate>
          <header class="tk-titulo cb-titulo">
            <span class="tk-icono"><i class="ti ti-building-warehouse" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>${b ? `Bodega ${b.codigo}` : 'Nueva bodega'}</small><h2>${b ? esc(b.nombre) : 'Datos de la bodega'}</h2></div>
            <div class="tk-marcas">${b ? `<span class="pc-marca ${b.estado === 'ACTIVO' ? 'aprobada' : 'pendiente'}">${b.estado === 'ACTIVO' ? 'Activa' : 'Inactiva'}</span><span class="pc-marca definitiva">${esc(b.tipo)}</span>` : ''}</div>
            ${b ? `<p class="cc-ingreso cb-audit"><i class="ti ti-user" aria-hidden="true"></i> Creó ${esc(b.creado_por_nombre || '')} · ${esc(fmt.fechaHora(b.creado_en))}${b.modificado_en ? ` · modificó ${esc(b.modificado_por_nombre || '')} ${esc(fmt.fechaHora(b.modificado_en))}` : ''}</p>` : ''}
            <p class="modal-error tk-error" role="alert"></p>
            <div class="tk-titulo-acciones">
              ${nuevo ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}
              ${ctx.admin ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${b ? 'Guardar cambios' : 'Crear bodega'}</button>` : ''}
            </div>
          </header>
          <div class="cb-tres">
            <section class="cb-bloque">
              <h3 class="ta-col-titulo"><i class="ti ti-id" aria-hidden="true"></i> Bodega ${b ? b.codigo : '(automático)'}</h3>
              <label class="cb-linea"><span>Nombre *</span><input name="nombre" value="${esc(v.nombre || '')}" maxlength="100" ${dis}></label>
              <div class="cb-par">
                <label class="cb-linea"><span>Siglas</span><input name="siglas" value="${esc(v.siglas || '')}" maxlength="6" ${dis}></label>
                <label class="cb-linea"><span>Estado</span><select name="estado" ${dis}>${['ACTIVO', 'INACTIVO'].map((e) => `<option ${v.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
              </div>
              <label class="cb-linea"><span>Tipo</span><select name="tipo" ${dis}>${['GENERAL', 'SUB-BODEGA'].map((e) => `<option ${v.tipo === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
              <label class="cb-linea"><span>Bodega mayor${v.tipo === 'SUB-BODEGA' ? ' *' : ''}</span><select name="bodega_mayor_id" ${dis}><option value="">${v.tipo === 'SUB-BODEGA' ? 'Elige la bodega general' : '— (es bodega principal)'}</option>${mayores.map((x) => `<option value="${x.id}" ${x.id === v.bodega_mayor_id ? 'selected' : ''}>${x.codigo} · ${esc(x.nombre)}</option>`).join('')}</select></label>
              <label class="cb-linea"><span>Dirección</span><input name="direccion" value="${esc(v.direccion || '')}" maxlength="200" ${dis}></label>
              <div class="cb-par cb-enc-par">
                <label class="cb-linea"><span>Encargado</span><input name="encargado_codigo" value="${esc(v.encargado_codigo || '')}" maxlength="20" placeholder="Código" ${dis}></label>
                <label class="cb-linea cb-sin-et"><input name="encargado_nombre" value="${esc(v.encargado_nombre || '')}" maxlength="120" placeholder="Nombre del encargado" aria-label="Nombre del encargado" ${dis}></label>
              </div>
            </section>
            <section class="cb-bloque">
              <h3 class="ta-col-titulo"><i class="ti ti-adjustments" aria-hidden="true"></i> Configuración</h3>
              <div class="cb-linea"><span>Tipo de bodega</span><div class="cc-radios">${MODALIDADES.map(([k, t]) => `<label class="pc-check"><input type="radio" name="modalidad" value="${k}" ${v.modalidad === k ? 'checked' : ''} ${dis}> ${t}</label>`).join('')}</div></div>
              <label class="cb-linea"><span>Precio por defecto</span><select name="tipo_precio" ${dis}>${PRECIOS.map((x) => `<option ${v.tipo_precio === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
              <div class="cb-checks">${chk('carga_directa', 'Permitir carga directa')}${chk('permite_ventas', 'Permitir ventas')}${chk('consignacion', 'Bodega de consignación')}${chk('licitacion', 'Bodega de licitación')}</div>
              ${anteriores.length ? `<dl class="cb-anterior"><dt>Sistema anterior</dt>${anteriores.map(([k, x]) => `<dd><span>${k}</span> ${esc(String(x))}</dd>`).join('')}</dl>` : ''}
            </section>
            <section class="cb-bloque">
              <h3 class="ta-col-titulo"><i class="ti ti-calculator" aria-hidden="true"></i> Definiciones contables</h3>
              <div class="cb-trx-cab"><span></span><span>Transacción</span><span>Reversión</span></div>
              ${[['Entradas', 'trx_entradas_id', 'rev_entradas_id'], ['Ajuste (+)', 'trx_ajuste_mas_id', 'rev_ajustes_id'], ['Ajuste (−)', 'trx_ajuste_menos_id', null],
                 ['Despachos', 'trx_despachos_id', 'rev_despachos_id'], ['Traslados', 'trx_traslados_id', 'rev_traslados_id']].map(([t, k, r]) => `
                <div class="cb-trx"><span>${t}</span><select name="${k}" aria-label="${t}" ${dis}>${opcionesTrx(transacciones, v[k])}</select>${r ? `<select name="${r}" aria-label="Reversión de ${t.toLowerCase()}" ${dis}>${opcionesTrx(transacciones, v[r])}</select>` : `<span class="tk-tenue cb-rev-nota">${t === 'Ajuste (−)' ? 'Rev. con ajustes' : ''}</span>`}</div>`).join('')}
              <label class="cb-linea cb-pt"><span>Cuenta PT</span><span class="cp-cta"><input list="cb-cuentas" name="cuenta_pt" value="${esc(pt ? pt.codigo : '')}" placeholder="Código" ${dis}><small data-nombre-de="cuenta_pt">${pt ? esc(pt.nombre) : ''}</small></span></label>
              ${b && b.transacciones_anteriores ? `<p class="cb-trx-ant" title="${esc(b.transacciones_anteriores)}"><i class="ti ti-history" aria-hidden="true"></i> ${esc(b.transacciones_anteriores)}</p>` : ''}
            </section>
          </div>
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
