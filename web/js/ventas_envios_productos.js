// Facturación · Registros · Facturas · Envíos de productos.
//   Maestro: los envíos de la empresa entre dos fechas (número, fecha, cliente, NIT, estado, moneda, valor y responsable),
//   con búsqueda por cliente, NIT o número, filtro de estado, «Crear envío» y el listado en PDF y Excel.
//   Detalle: la pantalla de Envíos (ventas_envios.js) con el botón «Listado» para volver al maestro.
//   window.ENVIOS_IMPRESION: impresión tipo factura y tipo envío con el logo y los datos de la empresa.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const C = () => window.CONTA;
  const GRUPO = 'Facturación · Registros · Facturas';
  const pick = (o, ...ks) => { for (const k of ks) { const v = o?.[k]; if (v != null && String(v).trim() !== '') return v; } return ''; };
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const inicioMes = () => `${fmt.hoy().slice(0, 7)}-01`;
  const finMes = () => { const [a, m] = fmt.hoy().split('-').map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); };
  const est = () => window.ENVIOS || { estadoEnvio: (e) => (e.estado === 'ANULADO' ? 'ANULADO' : e.factura_id ? 'OPERADO' : 'VIGENTE'), MARCA_ESTADO: {} };

  // ===================== Impresión =====================
  // Datos de la empresa (localidad y, si le faltan, la organización) y el logo como imagen incrustada.
  async function empresa(sb, locId, orgId) {
    const [l, o] = await Promise.all([
      locId ? sb.from('localidades').select('*').eq('id', locId).maybeSingle() : { data: null },
      orgId ? sb.from('organizaciones').select('*').eq('id', orgId).maybeSingle() : { data: null }]);
    const loc = l.data || {}, org = o.data || {};
    let logo = '';
    const ruta = loc.logo_ruta || org.logo_ruta;
    if (ruta) {
      try {
        const blob = await (await fetch(sb.storage.from('organizaciones').getPublicUrl(ruta).data.publicUrl)).blob();
        logo = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => ok(''); r.readAsDataURL(blob); });
      } catch { logo = ''; }
    }
    return { nombre: pick(loc, 'nombre_comercial') || pick(org, 'nombre'), razon: pick(org, 'nombre'), lema: pick(loc, 'eslogan', 'lema') || pick(org, 'eslogan', 'lema'),
      direccion: pick(loc, 'direccion') || pick(org, 'direccion'), nit: pick(loc, 'nit') || pick(org, 'nit'),
      telefono: pick(loc, 'telefonos', 'telefono') || pick(org, 'telefonos', 'telefono'), correo: pick(loc, 'correo', 'email') || pick(org, 'correo', 'email'), logo };
  }

  const ESTILO = `
    @page { size: letter; margin: 10mm 11mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; font: 10.5px/1.35 'Segoe UI', Arial, sans-serif; color: #1c2b3a; }
    .hoja { min-height: 256mm; display: flex; flex-direction: column; }
    .top { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; margin-bottom: 10px; }
    .emp { text-align: center; color: #1f5f9e; font-size: 9.5px; line-height: 1.5; }
    .emp img { max-height: 78px; max-width: 230px; object-fit: contain; display: block; margin: 0 auto 2px; }
    .emp b { display: block; font-size: 15px; color: #13406b; letter-spacing: .02em; }
    .emp .lema { font-size: 8px; letter-spacing: .08em; text-transform: uppercase; color: #13406b; }
    .doc { background: #3d7cc0; color: #fff; border-radius: 6px; text-align: center; padding: 10px 12px 12px; font-size: 17px; font-weight: 300; line-height: 1.35; border-bottom: 4px solid #1f5f9e; }
    .doc b { font-weight: 400; }
    .caja { border: 1.3px solid #2b3d50; border-radius: 12px; padding: 7px 10px; }
    .cli { display: grid; grid-template-columns: 1.35fr 1fr; gap: 0 20px; margin-bottom: 4px; }
    .kv { display: grid; grid-template-columns: max-content 1fr; gap: 1px 8px; align-content: start; }
    .kv dt { font-weight: 700; color: #13406b; text-align: right; }
    .kv dd { margin: 0; }
    .cli .kv:first-child dt { text-align: left; }
    .envbox { min-height: 92px; }
    .envbox .num { color: #9b1c1c; font-weight: 700; }
    table.det { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 6px; }
    table.det thead th { background: #3d7cc0; color: #fff; font-size: 12.5px; font-weight: 600; padding: 4px 8px; text-align: left; border-top: 1.3px solid #2b3d50; border-bottom: 1.3px solid #2b3d50; }
    table.det thead th:first-child { border-left: 1.3px solid #2b3d50; border-radius: 12px 0 0 12px; }
    table.det thead th:last-child { border-right: 1.3px solid #2b3d50; border-radius: 0 12px 12px 0; }
    table.det td { padding: 2px 8px; font-size: 10px; vertical-align: top; }
    table.det .n { text-align: right; white-space: nowrap; } table.det .c { text-align: center; }
    .q { display: flex; justify-content: space-between; gap: 6px; }
    .pie { margin-top: auto; padding-top: 14px; }
    .totales { display: grid; grid-template-columns: 1fr 260px; gap: 12px; align-items: stretch; margin-bottom: 14px; }
    .letras b { display: block; color: #13406b; }
    .tot { display: grid; grid-template-columns: 120px 1fr; border: 1.3px solid #2b3d50; border-radius: 12px; overflow: hidden; }
    .tot span { background: #3d7cc0; color: #fff; font-size: 15px; font-weight: 600; display: flex; align-items: center; justify-content: center; border-right: 1.3px solid #2b3d50; border-radius: 0 12px 12px 0; }
    .tot b { display: flex; justify-content: space-between; align-items: center; padding: 0 10px; font-size: 13px; }
    .firmas { display: grid; grid-template-columns: 1fr 190px; gap: 8px 24px; color: #13406b; font-size: 9.5px; align-items: end; }
    .linea { display: inline-block; min-width: 230px; border-bottom: 1px solid #13406b; margin-left: 10px; }
    .nombre { text-align: right; }
    .recibido { border: 1.3px solid #13406b; border-radius: 12px 12px 0 0; border-bottom: 0; height: 58px; text-align: center; padding-top: 10px; grid-row: span 2; align-self: end; }
    .anulado { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 80px; color: rgba(190, 30, 30, .13); transform: rotate(-24deg); font-weight: 800; letter-spacing: .1em; }
  `;
  const htmlEmpresa = (emp) => `<div class="emp">${emp.logo ? `<img src="${emp.logo}" alt="">` : `<b>${esc(emp.nombre)}</b>`}
    ${emp.logo && emp.lema ? `<div class="lema">${esc(emp.lema)}</div>` : ''}
    ${emp.direccion ? `<div>${esc(emp.direccion)}</div>` : ''}${emp.nit ? `<div>Nit: ${esc(emp.nit)}</div>` : ''}${emp.telefono ? `<div>${esc(emp.telefono)}</div>` : ''}${emp.correo ? `<div>${esc(emp.correo)}</div>` : ''}</div>`;
  const kv = (pares) => `<dl class="kv">${pares.map(([t, v]) => `<dt>${esc(t)}:</dt><dd>${v}</dd>`).join('')}</dl>`;
  const fechaLarga = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '').replace(/ /g, '-').replace(/-(\w)/, (m, c) => `-${c.toUpperCase()}`) : '');
  const fechaGuion = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('-') : '');

  function imprimir(tipo, e, lineas, emp, moneda) {
    const sim = moneda?.simbolo || 'Q.';
    const simb = /\.$/.test(sim) ? sim : sim === 'Q' ? 'Q.' : sim;
    const total = lineas.reduce((t, x) => t + Number(x.cantidad || 0) * Number(x.precio || 0), 0);
    const nomMon = String(moneda?.nombre || 'QUETZALES').toUpperCase();
    const letras = window.BANCOS.enLetras ? window.BANCOS.enLetras(total, nomMon) : '';
    const anulado = e.estado === 'ANULADO' ? '<div class="anulado">ANULADO</div>' : '';
    const firmaEmp = `FIRMA Y SELLO DE ${esc(String(emp.nombre || '').toUpperCase())}:`;
    let cuerpo;
    if (tipo === 'FACTURA') {
      cuerpo = `<div class="top">${htmlEmpresa(emp)}<div class="doc">Documento de Envío<br><b># ${esc(String(e.numero ?? ''))}</b></div></div>
        <div class="caja cli">${kv([['Cliente', `${esc(String(e.cliente_codigo ?? ''))}&nbsp;&nbsp;&nbsp;${esc(e.nombre || '')}`], ['Nit', esc(e.nit || '')], ['Contacto', esc(e.contacto || '')], ['Dirección', esc(e.direccion || '')]])}
          ${kv([['Teléfono', esc(e.telefono || '')], ['Condición de Pago', esc(e.forma_pago === 'CRÉDITO' ? `CRÉDITO ${e.dias_credito || 0} DÍAS` : (e.forma_pago || 'CONTADO'))], ['Vencimiento', esc(fechaLarga(e.fecha_cobro || e.fecha))], ['Monto', fmt.monto(total)]])}</div>
        <table class="det"><thead><tr><th style="width:11%">Cantidad</th><th style="width:15%">Código</th><th>Descripción</th><th class="n" style="width:15%">Precio Unit.</th><th class="n" style="width:15%">Total</th></tr></thead>
        <tbody>${lineas.map((x) => `<tr><td class="c">${fmt.monto(x.cantidad).replace(/\.00$/, '')}</td><td>${esc(String(x.producto_codigo ?? ''))}</td><td>${esc(x.descripcion || '')}${x.lote ? ` <small>· Lote ${esc(x.lote)}</small>` : ''}</td>
          <td class="n"><span class="q"><span>${esc(simb)}</span><span>${fmt.monto(x.precio)}</span></span></td><td class="n"><span class="q"><span>${esc(simb)}</span><span>${fmt.monto(Number(x.cantidad) * Number(x.precio))}</span></span></td></tr>`).join('')}</tbody></table>
        <div class="pie">
          <div class="totales"><div class="caja letras"><b>Valor en Letras:</b>${esc(letras)}</div><div class="tot"><span>Total:</span><b><small>${esc(simb)}</small> ${fmt.monto(total)}</b></div></div>
          <div class="firmas"><div class="nombre">NOMBRE DE: <span class="linea" style="min-width:150px"></span></div><div></div>
            <div>${firmaEmp}<span class="linea"></span></div><div class="recibido">RECIBIDO DE CONFORMIDAD</div></div>
        </div>`;
    } else {
      cuerpo = `<div class="top">${htmlEmpresa(emp)}<div class="caja envbox">${kv([['Envío', `<span class="num">${esc(String(e.numero ?? ''))}</span>`], ['Fecha Emisión', esc(fechaGuion(e.fecha))], ['Nombre', esc(e.nombre || '')], ['Nit', esc(e.nit || '')], ['Teléfono', esc(e.telefono || '')], ['Dirección Envío', esc(e.direccion || '')]])}</div></div>
        <table class="det"><thead><tr><th style="width:13%">Cantidad</th><th style="width:20%">Código</th><th>Descripción</th></tr></thead>
        <tbody>${lineas.map((x) => `<tr><td class="c">${fmt.monto(x.cantidad).replace(/\.00$/, '')}</td><td>${esc(String(x.producto_codigo ?? ''))}</td><td>${esc(x.descripcion || '')}${x.lote ? ` <small>· Lote ${esc(x.lote)}${x.fecha_vencimiento ? ` · vence ${esc(fechaGuion(x.fecha_vencimiento))}` : ''}</small>` : ''}</td></tr>`).join('')}</tbody></table>
        <div class="pie"><div class="firmas"><div class="nombre">NOMBRE DE: <span class="linea" style="min-width:150px"></span></div><div></div>
          <div>${firmaEmp}<span class="linea"></span></div><div class="recibido">RECIBIDO DE CONFORMIDAD</div>
          <div>FIRMA RESPONSABLE:<span class="linea"></span>${e.responsable ? `<div style="margin:2px 0 0 120px">${esc(e.responsable)}</div>` : ''}</div><div></div></div></div>`;
    }
    const titulo = `${tipo === 'FACTURA' ? 'Envío tipo factura' : 'Envío'} ${e.numero ?? ''}`;
    const { v, imprimirYa } = window.FIN_IMPRESION();
    v.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${ESTILO}</style></head><body>${anulado}<div class="hoja">${cuerpo}</div></body></html>`);
    v.document.close();
    const img = v.document.querySelector('img');
    if (img && !img.complete) { img.onload = img.onerror = () => setTimeout(imprimirYa, 50); setTimeout(imprimirYa, 2500); } else setTimeout(imprimirYa, 250);
  }
  window.ENVIOS_IMPRESION = { empresa, imprimir };

  // ===================== Maestro =====================
  window.PANTALLAS['envios-productos'] = function (cont, m, extra) {
    const f = { desde: inicioMes(), al: finMes(), estado: '', texto: '' };
    let envios = [], vendedores = [], cfg = null;

    function detalle(id) {
      const hijo = document.createElement('div'); hijo.className = 'ep-vista'; cont.replaceChildren(hijo);
      window.PANTALLAS.envios(hijo, m, { id, nuevo: !id, volver: maestro, grupo: GRUPO });
    }
    function maestro() {
      const hijo = document.createElement('div'); hijo.className = 'ep-vista'; cont.replaceChildren(hijo);
      const ctx = montar(hijo, { titulo: 'Envíos de productos', icono: 'ti-truck-delivery', clase: 'bk-movimientos bm-solo cx-rep pr-rep ep-envios', grupo: GRUPO });
      const { sb } = ctx;
      const moneda = (id) => ctx.monedas.find((x) => x.id === id);
      async function iniciar() {
        if (!(await ctx.cargarBase())) return;
        filtros(); await consultar();
      }
      function filtros() {
        ctx.filtros(`<label class="campo"><span>De fecha</span><input type="date" name="desde" value="${f.desde}"></label>
          <label class="campo"><span>A fecha</span><input type="date" name="al" value="${f.al}"></label>
          <label class="campo"><span>Estado</span><select name="estado">${[['', 'Todos'], ['VIGENTE', 'Vigentes'], ['OPERADO', 'Operados'], ['ANULADO', 'Anulados']].map(([k, t]) => `<option value="${k}" ${f.estado === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="campo cx-prov"><span>Buscar</span><input type="search" name="texto" value="${esc(f.texto)}" placeholder="Cliente, NIT o número de envío" autocomplete="off"></label>`,
        `<button type="button" class="boton secundario-sm" data-accion="buscar"><i class="ti ti-search" aria-hidden="true"></i> Buscar</button>${C()?.botonesExp || ''}${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="crear"><i class="ti ti-plus" aria-hidden="true"></i> Crear envío</button>' : ''}`);
      }
      async function consultar() {
        if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-truck-delivery'); return; }
        if (f.desde > f.al) { ctx.pDet.innerHTML = ctx.vacio('La fecha inicial es posterior a la final.', 'ti-truck-delivery'); return; }
        ctx.pDet.innerHTML = '<p class="vacio">Buscando los envíos…</p>';
        const base = 'id, numero, fecha, cliente_codigo, nombre, nit, estado, factura_id, total, usuario, forma_pago';
        const q = (sel) => window.UI.todo(sb.from('envios_venta').select(sel).eq('localidad_id', ctx.sel.loc).gte('fecha', f.desde).lte('fecha', f.al).order('numero', { ascending: false }).order('id', { ascending: false }));
        let r = await q(`${base}, moneda_id, vendedor_id, responsable`);
        let sin219 = false;
        if (r.error && /moneda_id|vendedor_id|responsable/.test(r.error.message || '')) { r = await q(base); sin219 = true; }
        if (r.error) { ctx.pDet.innerHTML = `<p class="vacio">${/envios_venta/.test(r.error.message) ? 'Falta instalar el script 138 (envíos) en Supabase.' : esc(window.UI.traducirError(r.error))}</p>`; return; }
        envios = r.data || [];
        const vd = await sb.from('vendedores').select('id, nombre').eq('localidad_id', ctx.sel.loc);
        vendedores = vd.data || [];
        pintar(sin219);
      }
      const responsable = (x) => vendedores.find((v) => v.id === x.vendedor_id)?.nombre || x.responsable || '';
      function pintar(sin219) {
        const t = f.texto.trim().toLowerCase();
        const lista = envios.filter((x) => (!f.estado || est().estadoEnvio(x) === f.estado) && (!t || String(x.numero).includes(t) || String(x.nombre || '').toLowerCase().includes(t) || String(x.nit || '').toLowerCase().includes(t)));
        const cuenta = (k) => lista.filter((x) => est().estadoEnvio(x) === k).length;
        const porMon = new Map(); lista.filter((x) => x.estado !== 'ANULADO').forEach((x) => { const s = moneda(x.moneda_id)?.simbolo || 'Q'; porMon.set(s, (porMon.get(s) || 0) + Number(x.total || 0)); });
        const valores = [...porMon.entries()].map(([s, v]) => `${s} ${fmt.monto(v)}`).join(' · ') || 'Q 0.00';
        const marca = (k) => `<span class="pc-marca ${est().MARCA_ESTADO[k] || ''}">${k.charAt(0) + k.slice(1).toLowerCase()}</span>`;
        cfg = { orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: 'Envíos', titulo: 'Envíos de productos', archivo: `envios_${f.desde}_${f.al}`,
          parametros: [`Empresa: ${ctx.localidad(ctx.sel.loc)?.codigo || ''} · ${ctx.localidad(ctx.sel.loc)?.nombre_comercial || ''}`, `Del ${fmt.fechaDia(f.desde)} al ${fmt.fechaDia(f.al)}`, `Estado: ${f.estado ? f.estado.toLowerCase() : 'todos'}`, ...(t ? [`Búsqueda: ${f.texto}`] : [])],
          columnas: [col('Envío', 'texto', 8), col('Fecha', 'texto', 11), col('Nombre del cliente', 'texto', 38), col('NIT', 'texto', 13), col('Estado', 'texto', 11), col('Moneda', 'texto', 12), col('Valor', 'monto', 15), col('Nombre del responsable', 'texto', 30)],
          filas: lista.map((x) => ({ valores: [String(x.numero ?? ''), fmt.fechaDia(x.fecha), x.nombre || '', x.nit || '', est().estadoEnvio(x), moneda(x.moneda_id)?.nombre || 'QUETZALES', Number(x.total || 0), responsable(x)] })) };
        ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico ep-form">
          ${sin219 ? '<p class="cp-aviso cp-error"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Falta instalar el script 219 (moneda y responsable de los envíos) en Supabase.</p>' : ''}
          <div class="ec-kpis ep-kpis">
            <div class="ec-kpi"><small>Envíos</small><b>${lista.length}</b></div>
            <div class="ec-kpi ec-fin"><small>Vigentes</small><b>${cuenta('VIGENTE')}</b></div>
            <div class="ec-kpi"><small>Operados</small><b>${cuenta('OPERADO')}</b></div>
            <div class="ec-kpi ${cuenta('ANULADO') ? 'ec-alerta' : ''}"><small>Anulados</small><b>${cuenta('ANULADO')}</b></div>
            <div class="ec-kpi"><small>Valor (sin anulados)</small><b>${esc(valores)}</b></div>
          </div>
          <div class="pc-lineas pr-tabla ep-tabla"><table><thead><tr><th>Envío</th><th>Fecha</th><th>Nombre del cliente</th><th>NIT</th><th>Estado</th><th>Moneda</th><th class="num">Valor</th><th>Nombre del responsable</th></tr></thead>
          <tbody>${lista.map((x) => { const k = est().estadoEnvio(x); return `<tr data-envio="${x.id}" class="${k === 'ANULADO' ? 'ep-anulado' : ''}" title="Abrir el envío ${x.numero}">
            <td class="ep-num">${x.numero ?? ''}</td><td>${esc(fmt.fechaDia(x.fecha))}</td><td>${esc(x.nombre || '')}</td><td>${esc(x.nit || '')}</td><td>${marca(k)}</td>
            <td>${esc(moneda(x.moneda_id)?.nombre || 'QUETZALES')}</td><td class="num">${fmt.monto(x.total)}</td><td>${esc(responsable(x))}</td></tr>`; }).join('')
            || `<tr><td colspan="8" class="tk-vacio">No hay envíos ${f.estado || t ? 'con esos filtros' : 'en esas fechas'}.</td></tr>`}</tbody></table></div></div>`;
        window.CUENTAS_XLSX?.ajustarAlto?.(hijo);
      }
      hijo.addEventListener('change', (e) => {
        const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return consultar();
        const n = e.target.name; if (!(n in f)) return;
        f[n] = e.target.value;
        if (n === 'desde' || n === 'al') return consultar();
        pintar();
      });
      hijo.addEventListener('input', (e) => { if (e.target.name === 'texto') { f.texto = e.target.value; pintar(); } });
      hijo.addEventListener('click', (e) => {
        const ex = e.target.closest('[data-exp]'); if (ex) return C().exportar(cfg, ex.dataset.exp, false);
        const a = e.target.closest('[data-accion]')?.dataset.accion;
        if (a === 'buscar') return consultar();
        if (a === 'crear') return detalle(null);
        const tr = e.target.closest('tr[data-envio]'); if (tr) detalle(Number(tr.dataset.envio));
      });
      iniciar();
    }
    if (/^\d+$/.test(String(extra || ''))) detalle(Number(extra)); else maestro();
  };
})();
