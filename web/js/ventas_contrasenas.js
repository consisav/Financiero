// Facturación/Ventas · Mantenimientos · Contraseñas de Cobro: «Recepción de facturas clientes».
//   Encabezado: número, fecha, usuario, estado (EMITIDA, AUTORIZADA, ANULADA), cliente, días de crédito y fecha
//   estimada de cobro. Detalle de documentos emitidos: factura (FE-n), fecha, valor y observaciones, con el total.
//   «Asignar facturas» trae las facturas con saldo del cliente que aún no tienen contraseña. Al guardar, cada factura
//   toma la contraseña (C-n) y la fecha estimada de cobro; al anular, la pierde. Pestaña con el listado.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const DIAS = [0, 8, 15, 30, 45, 60, 90, 120];

  window.PANTALLAS['contrasenas-cobros'] = function (cont, m, extra) {
    const ctx = montar(cont, { titulo: 'Contraseñas de Cobro', icono: 'ti-key', clase: 'bk-movimientos bm-solo vf-facturas vk-contrasenas', grupo: 'Ventas · Mantenimientos' });
    const { sb } = ctx;
    let clientes = [], actual = null, modificando = false, pestana = 'DETALLE', lineas = [], listado = null;
    const cliente = (id) => clientes.find((c) => c.id === id);
    const fe = (f) => f ? (f.no_interno || (f.serie ? `${f.serie}-${f.numero_dte || ''}` : `Interna ${f.numero}`)) : '';
    const editable = () => ctx.admin && (!actual || (modificando && actual.estado === 'EMITIDA'));
    const sumar = (dias, desde) => { const d = desde ? new Date(desde) : new Date(); d.setDate(d.getDate() + Number(dias || 0)); return d.toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }); };
    const marca = (c) => !c ? ['pendiente', 'Sin registrar'] : c.estado === 'ANULADA' ? ['anulada', 'Anulada'] : c.estado === 'AUTORIZADA' ? ['aprobada', 'Autorizada'] : ['definitiva', 'Emitida'];

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('contrasenas_cobro').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/contrasenas_cobro/.test(prueba.error.message) ? 'Falta instalar el script 138 (series, correlativos, envíos y despachos) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      ctx.filtros('', '');
      await cargarLocalidad();
      if (/^\d+$/.test(String(extra || ''))) { const { data } = await sb.from('contrasenas_cobro').select('*').eq('id', Number(extra)).maybeSingle(); if (data) return abrir(data); }
      // Abre con la última contraseña y el listado.
      const { data: ult } = await sb.from('contrasenas_cobro').select('*').eq('localidad_id', ctx.sel.loc || 0).order('numero', { ascending: false }).limit(500);
      if (ult?.length) { listado = ult; pestana = 'LISTADO'; return abrir(ult[0]); }
      abrir(null);
    }
    async function cargarLocalidad() { const { data } = await sb.from('clientes').select('id, codigo, nombre, documento, tipo_documento, dias_credito, estado').eq('localidad_id', ctx.sel.loc || 0).order('nombre'); clientes = data || []; }
    async function abrir(c) {
      actual = c; modificando = false; lineas = [];
      if (c) {
        const { data } = await sb.from('contrasena_cobro_lineas').select('*, facturas_venta(id, numero, no_interno, serie, numero_dte, fecha_emision, total, saldo)').eq('contrasena_id', c.id).order('linea');
        lineas = (data || []).map((x) => ({ factura_id: x.factura_id, factura: x.facturas_venta, valor: Number(x.valor), observaciones: x.observaciones || '' }));
      }
      pintar();
    }
    const nuevos = () => ({ fecha: new Date().toISOString(), cliente_id: null, cliente_codigo: '', nombre: '', dias_credito: 15, fecha_cobro: sumar(15), observaciones: '' });

    function pintar(v0) {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-key'); return; }
      const c = actual, ed = editable(), dis = ed ? '' : 'disabled';
      const v = v0 || (c ? { ...c } : nuevos());
      const [cls, txt] = marca(c);
      const total = fmt.redondear(lineas.reduce((t, x) => t + Number(x.valor || 0), 0));
      const puede = ctx.admin && c && c.estado !== 'ANULADA' && !modificando;
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form bm-form vf-form vk-form" novalidate>
          <header class="tk-titulo bm-titulo">
            <div class="tk-titulo-texto"><small>Recepción de facturas clientes · ${esc(ctx.localidad(ctx.sel.loc)?.codigo || '')} ${esc(ctx.localidad(ctx.sel.loc)?.nombre_comercial || '')}</small><h2>${c ? `Contraseña C-${c.numero}` : 'Nueva contraseña de cobro'}</h2></div>
            <div class="tk-marcas"><span class="pc-marca ${cls}">${txt}</span></div>
            <div class="tk-titulo-acciones">
              <button type="button" class="boton secundario-sm" data-accion="imprimir" ${c ? '' : 'disabled'}><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>
              ${ctx.admin && !modificando ? `<button type="button" class="boton ${ed ? 'secundario-sm' : 'primario-sm'}" data-accion="nueva"><i class="ti ti-plus" aria-hidden="true"></i> Nueva</button>` : ''}
              ${puede && c.estado === 'EMITIDA' ? '<button type="button" class="boton secundario-sm" data-accion="autorizar"><i class="ti ti-circle-check" aria-hidden="true"></i> Autorizar</button><button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}
              ${puede ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="anular"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>' : ''}
              ${modificando ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}
              ${ed ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${c ? 'Guardar cambios' : 'Registrar'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          <section class="bm-bloque dpb-banda vf vk-enc">
            <div class="vk-g">
              <label class="campo"><span>#</span><input value="${c ? c.numero : 'Automático'}" disabled></label>
              <label class="campo"><span>Fecha</span><input value="${esc(fmt.fechaHora(v.fecha))}" disabled></label>
              <label class="campo"><span>Usuario</span><input value="${esc(c?.usuario || (ctx.yo.usuario || '').toUpperCase())}" disabled></label>
              <label class="campo"><span>Estado</span><input value="${txt}" disabled></label>
              <label class="campo"><span>Cliente</span><input list="vk-clientes" name="cliente_codigo" value="${esc(String(v.cliente_codigo ?? ''))}" placeholder="Código" ${dis}></label>
              <label class="campo vk-c3"><span>Nombre *</span><input name="nombre" value="${esc(v.nombre || '')}" maxlength="150" ${dis}></label>
              <label class="campo"><span>Días crédito</span><select name="dias_credito" ${dis}>${[...new Set([...DIAS, Number(v.dias_credito || 0)])].sort((a, b) => a - b).map((d) => `<option value="${d}" ${Number(v.dias_credito) === d ? 'selected' : ''}>${d} DÍAS</option>`).join('')}</select></label>
              <label class="campo"><span>Fecha estimada cobro</span><input type="date" name="fecha_cobro" value="${esc(v.fecha_cobro || '')}" ${dis}></label>
              <label class="campo vk-c3"><span>Observaciones</span><input name="observaciones" value="${esc(v.observaciones || '')}" maxlength="300" ${dis}></label>
            </div>
            <datalist id="vk-clientes">${clientes.filter((x) => x.estado !== 'INACTIVO').map((x) => `<option value="${esc(x.nombre)}${x.tipo_documento !== 'CF' && x.documento ? ` · NIT ${esc(x.documento)}` : ''} — ${x.codigo}"></option>`).join('')}</datalist>
          </section>
          <section class="bm-pestanas">
            <div class="bm-tabs-barra">
              <div class="rp-pestanas" role="tablist">${[['DETALLE', 'Detalle de documentos emitidos', 'ti-file-invoice'], ['LISTADO', 'Listado de contraseñas', 'ti-list-search']].map(([k, t, i]) => `<button type="button" role="tab" data-pestana="${k}" class="${pestana === k ? 'activa' : ''}"><i class="ti ${i}" aria-hidden="true"></i> ${t}${k === 'DETALLE' ? ` <b>${lineas.length}</b>` : ''}</button>`).join('')}</div>
              <span class="vf-tab-acc">${ed && pestana === 'DETALLE' ? `<button type="button" class="boton secundario-sm" data-accion="asignar" ${v.cliente_id ? '' : 'disabled'}><i class="ti ti-file-plus" aria-hidden="true"></i> Asignar facturas</button>` : ''}</span>
            </div>
            <div class="bm-panel" data-panel="DETALLE" ${pestana === 'DETALLE' ? '' : 'hidden'}>
              <div class="pc-lineas"><table class="vf-lista vk-lineas"><thead><tr><th class="pc-n">#</th><th>Factura</th><th>Fecha</th><th class="num">Valor</th><th class="num">Saldo</th><th>Observaciones</th><th class="pq-x"></th></tr></thead>
                <tbody>${lineas.map((x, i) => `<tr data-linea="${i}"><td class="pc-n">${i + 1}</td><td class="fuerte"><a class="vf-p-link" href="#/facturacion/facturas-ventas/${x.factura_id}">${esc(fe(x.factura))}</a><small class="cq-ant">interno ${x.factura?.numero ?? ''}</small></td>
                  <td>${esc(fmt.fechaDia(x.factura?.fecha_emision ? new Date(x.factura.fecha_emision).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }) : ''))}</td><td class="num fuerte">${fmt.monto(x.valor)}</td><td class="num">${fmt.monto(x.factura?.saldo)}</td>
                  <td>${ed ? `<input data-obs value="${esc(x.observaciones || '')}" maxlength="200">` : esc(x.observaciones || '')}</td>
                  <td class="pq-x">${ed ? `<button type="button" class="icono-boton" data-quitar="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`).join('') || `<tr><td colspan="7" class="tk-vacio">${ed ? 'Elige el cliente y pulsa «Asignar facturas».' : 'Sin facturas.'}</td></tr>`}</tbody>
                <tfoot><tr><td colspan="3">Valor</td><td class="num">${fmt.monto(total)}</td><td colspan="3"></td></tr></tfoot></table></div>
            </div>
            <div class="bm-panel vf-listado" data-panel="LISTADO" ${pestana === 'LISTADO' ? '' : 'hidden'}>${pestana === 'LISTADO' ? `<div class="pc-lineas">${!listado ? '<p class="tk-vacio">Cargando…</p>' : `<table class="vf-lista"><thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Días</th><th>Cobro estimado</th><th class="num">Valor</th><th>Estado</th><th>Usuario</th></tr></thead>
              <tbody>${listado.map((x) => { const [k, t] = marca(x); return `<tr data-abrir="${x.id}" class="${x.id === c?.id ? 'actual' : ''}"><td class="fuerte">C-${x.numero}</td><td>${esc(fmt.fechaHora(x.fecha))}</td><td>${esc(x.nombre)}</td><td>${x.dias_credito}</td><td>${esc(x.fecha_cobro ? fmt.fechaDia(x.fecha_cobro) : '')}</td><td class="num fuerte">${fmt.monto(x.valor)}</td><td><span class="pc-marca ${k}">${t}</span></td><td>${esc(x.usuario || '')}</td></tr>`; }).join('') || '<tr><td colspan="8" class="tk-vacio">Sin contraseñas.</td></tr>'}</tbody></table>`}</div>` : ''}</div>
          </section>
        </form>`;
    }

    function encabezado(form) {
      const el = form.elements; const t = (k) => el[k] && String(el[k].value).trim() !== '' ? String(el[k].value).trim() : null;
      const c = clientes.find((x) => String(x.codigo) === String(el.cliente_codigo.value).trim());
      return { cliente_id: c ? c.id : (actual?.cliente_id || null), cliente_codigo: t('cliente_codigo'), nombre: t('nombre') || '', dias_credito: Number(el.dias_credito.value) || 0, fecha_cobro: t('fecha_cobro'), observaciones: t('observaciones') };
    }
    function leer() { ctx.pDet.querySelectorAll('tr[data-linea]').forEach((tr) => { const x = lineas[Number(tr.dataset.linea)]; const i = tr.querySelector('[data-obs]'); if (x && i) x.observaciones = i.value; }); }
    function repintar(c = {}) { const form = ctx.pDet.querySelector('.vk-form'); if (!form) return; pintar({ ...(actual || nuevos()), ...encabezado(form), ...c }); }

    async function asignar() {
      const form = ctx.pDet.querySelector('.vk-form'); const h = encabezado(form); if (!h.cliente_id) return;
      leer();
      const { data, error } = await sb.from('facturas_venta').select('id, numero, no_interno, serie, numero_dte, fecha_emision, total, saldo, contrasena').eq('localidad_id', ctx.sel.loc).eq('cliente_id', h.cliente_id).eq('estado', 'FACTURADA').gt('saldo', 0).order('fecha_emision');
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      const ya = new Set(lineas.map((x) => x.factura_id));
      const nuevas = (data || []).filter((f) => !ya.has(f.id) && !f.contrasena);
      if (!nuevas.length) return window.FIN.aviso('El cliente no tiene otras facturas con saldo sin contraseña');
      nuevas.forEach((f) => lineas.push({ factura_id: f.id, factura: f, valor: Number(f.total), observaciones: '' }));
      repintar(h);
    }
    async function guardar(form) {
      const error = form.querySelector('.tk-error'); error.textContent = ''; leer();
      const h = encabezado(form);
      if (!h.nombre) { error.textContent = 'Escribe el nombre del cliente.'; return; }
      if (!lineas.length) { error.textContent = 'Asigna al menos una factura.'; return; }
      const valor = fmt.redondear(lineas.reduce((t, x) => t + x.valor, 0));
      try {
        let id = actual?.id;
        if (id) { const r = await sb.from('contrasenas_cobro').update({ ...h, valor }).eq('id', id); if (r.error) throw r.error; }
        else { const r = await sb.from('contrasenas_cobro').insert({ ...h, valor, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, usuario: (ctx.yo.usuario || '').toUpperCase() }).select('id, numero').single(); if (r.error) throw r.error; id = r.data.id; }
        const { data: c } = await sb.from('contrasenas_cobro').select('*').eq('id', id).single();
        const { data: previas } = await sb.from('contrasena_cobro_lineas').select('factura_id').eq('contrasena_id', id);
        const quedan = new Set(lineas.map((x) => x.factura_id));
        const quitadas = (previas || []).map((p) => p.factura_id).filter((f) => !quedan.has(f));
        const d = await sb.from('contrasena_cobro_lineas').delete().eq('contrasena_id', id); if (d.error) throw d.error;
        const r1 = await sb.from('contrasena_cobro_lineas').insert(lineas.map((x, i) => ({ contrasena_id: id, linea: i + 1, factura_id: x.factura_id, valor: x.valor, observaciones: x.observaciones || null }))); if (r1.error) throw r1.error;
        // Cada factura toma la contraseña y la fecha estimada de cobro; las quitadas la pierden.
        const u = await sb.from('facturas_venta').update({ contrasena: `C-${c.numero}`, fecha_cobro: h.fecha_cobro }).in('id', [...quedan]); if (u.error) throw u.error;
        if (quitadas.length) { const u2 = await sb.from('facturas_venta').update({ contrasena: null }).in('id', quitadas).eq('contrasena', `C-${c.numero}`); if (u2.error) throw u2.error; }
        window.FIN.aviso(actual ? 'Contraseña guardada' : `Contraseña C-${c.numero} registrada`);
        listado = null; await abrir(c);
      } catch (err) { error.textContent = window.UI.traducirError(err); }
    }
    function imprimirContrasena() {
      const c = actual; if (!c) return;
      imprimir(`Contraseña ${c.numero}`, `<h1>Contraseña de cobro C-${c.numero}${c.estado === 'ANULADA' ? ' · ANULADA' : ''}</h1>
        <h2>${esc([`Fecha: ${fmt.fechaHora(c.fecha)}`, `Cliente: ${c.cliente_codigo || ''} · ${c.nombre}`, `Días de crédito: ${c.dias_credito}`, `Fecha estimada de cobro: ${c.fecha_cobro ? fmt.fechaDia(c.fecha_cobro) : '—'}`, `Estado: ${c.estado}`].join(' · '))}</h2>
        <table><thead><tr><th>#</th><th>Factura</th><th>Fecha</th><th class="n">Valor</th><th>Observaciones</th></tr></thead><tbody>
        ${lineas.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(fe(x.factura))}</td><td>${esc(x.factura?.fecha_emision ? fmt.fechaHora(x.factura.fecha_emision).slice(0, 10) : '')}</td><td class="n">${fmt.monto(x.valor)}</td><td>${esc(x.observaciones || '')}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Valor</td><td class="n">${fmt.monto(c.valor)}</td><td></td></tr></tfoot></table>
        <div class="firmas"><div>Recibió (cliente)</div><div>Entregó: ${esc(c.usuario || '')}</div></div>`, { locId: c.localidad_id, orgId: c.organizacion_id });
    }

    cont.addEventListener('change', (e) => { const i = e.target; if (i && i.matches && i.matches('input[list]')) { const k = i.value.lastIndexOf(' — '); if (k >= 0) i.value = i.value.slice(k + 3).trim(); } }, true);
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { await cargarLocalidad(); listado = null; return abrir(null); }
      const form = e.target.closest('.vk-form'); if (!form) return; leer();
      const k = e.target.name;
      if (k === 'cliente_codigo') { const c = clientes.find((x) => String(x.codigo) === e.target.value.trim()); if (c) { if (actual?.cliente_id !== c.id) lineas = []; const d = Number(c.dias_credito) || Number(form.elements.dias_credito.value) || 0; return repintar({ cliente_id: c.id, cliente_codigo: c.codigo, nombre: c.nombre, dias_credito: d, fecha_cobro: sumar(d, actual?.fecha) }); } }
      if (k === 'dias_credito') return repintar({ fecha_cobro: sumar(e.target.value, actual?.fecha) });
    });
    cont.addEventListener('click', async (e) => {
      const tab = e.target.closest('[data-pestana]');
      if (tab) { leer(); pestana = tab.dataset.pestana; editable() ? repintar() : pintar(); if (pestana === 'LISTADO' && !listado) { const { data } = await sb.from('contrasenas_cobro').select('*').eq('localidad_id', ctx.sel.loc).order('numero', { ascending: false }).limit(500); listado = data || []; editable() ? repintar() : pintar(); } return; }
      const ab = e.target.closest('[data-abrir]'); if (ab) { const { data } = await sb.from('contrasenas_cobro').select('*').eq('id', Number(ab.dataset.abrir)).single(); pestana = 'DETALLE'; return data ? abrir(data) : null; }
      const q = e.target.closest('[data-quitar]'); if (q) { leer(); lineas.splice(Number(q.dataset.quitar), 1); return repintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion; if (!a) return;
      if (a === 'nueva') { pestana = 'DETALLE'; return abrir(null); }
      if (a === 'modificar') { modificando = true; return pintar(); }
      if (a === 'cancelar') return abrir(actual);
      if (a === 'asignar') return asignar();
      if (a === 'imprimir') return imprimirContrasena();
      if (a === 'autorizar' || a === 'anular') {
        if (a === 'anular' && !confirm(`¿Anular la contraseña C-${actual.numero}? Sus facturas pierden la contraseña.`)) return;
        const quien = (ctx.yo.usuario || '').toUpperCase();
        const r = await sb.from('contrasenas_cobro').update(a === 'autorizar' ? { estado: 'AUTORIZADA', autorizada_por: quien, autorizada_en: new Date().toISOString() } : { estado: 'ANULADA' }).eq('id', actual.id);
        if (r.error) return window.FIN.aviso(window.UI.traducirError(r.error));
        if (a === 'anular') await sb.from('facturas_venta').update({ contrasena: null }).in('id', lineas.map((x) => x.factura_id)).eq('contrasena', `C-${actual.numero}`);
        listado = null; const { data } = await sb.from('contrasenas_cobro').select('*').eq('id', actual.id).single(); return abrir(data);
      }
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.vk-form')) { e.preventDefault(); if (editable()) guardar(e.target); } });
    iniciar();
  };
})();
