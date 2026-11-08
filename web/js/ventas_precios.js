// Facturación/Ventas · Catálogos · Productos · Precios de venta (también en Inventarios › Catálogos › Productos).
// Arriba el catálogo de productos (buscar, subir / bajar, incluir inactivos) con su costo y cuántos precios tiene;
// abajo los precios del producto elegido en cada tipo de precio de la empresa: fecha, precio, margen sobre el costo,
// precio sugerido (costo + % de utilidad − % de descuento del tipo de precio) y si está vigente. Se guarda por
// producto y se imprime la lista de precios (todos los productos × tipos de precio) en PDF o Excel.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const horaGt = (v) => (v ? new Date(v).toLocaleString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') : '');
  async function leerTodo(hacer) {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await hacer().range(i, i + 999);
      if (error) throw error;
      out.push(...(data || [])); if (!data || data.length < 1000) break;
    }
    return out;
  }

  window.PANTALLAS['precios-de-venta'] = function (cont, m) {
    const grupo = m?.id === 'inventarios' ? 'Inventarios · Catálogos' : 'Ventas · Catálogos';
    const ctx = montar(cont, { titulo: 'Precios de venta', icono: 'ti-tags', clase: 'bk-movimientos bm-solo kx-kardex pv-precios', grupo });
    const { sb } = ctx;
    const f = { buscar: '', inactivos: false, sinPrecio: false };
    let productos = [], tipos = [], precios = [], sel = null, filas = [], cambios = false;
    const prod = (id) => productos.find((p) => p.id === id);
    const usuario = () => (window.FIN.perfil?.()?.usuario || 'SISTEMA').toUpperCase();
    const preciosDe = (id) => precios.filter((x) => x.producto_id === id);
    const visibles = () => {
      const q = f.buscar.trim().toLowerCase();
      return productos.filter((p) => (f.inactivos || p.estado === 'ACTIVO') && (!f.sinPrecio || !preciosDe(p.id).length)
        && (!q || [p.codigo, p.codigo_producto, p.codigo_barras, p.nombre, p.principio_activo].some((v) => String(v || '').toLowerCase().includes(q))));
    };
    // Precio sugerido del tipo: costo con su % de utilidad y su % de descuento.
    const sugerido = (t, costo) => (costo > 0 && Number(t.pct_utilidad) ? r2(costo * (1 + Number(t.pct_utilidad) / 100) * (1 - Number(t.pct_descuento || 0) / 100)) : null);

    function pintarFiltros() {
      ctx.filtros('', `<button type="button" class="boton primario-sm" data-accion="lista-pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> Lista de precios PDF</button>
        <button type="button" class="boton primario-sm" data-accion="lista-excel"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel</button>`);
    }
    async function iniciar() { if (!(await ctx.cargarBase())) return; pintarFiltros(); await cargarLocalidad(); }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc;
      if (!loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-tags'); return; }
      const [p, t, pr] = await Promise.all([
        leerTodo(() => sb.from('productos').select('id, codigo, codigo_producto, codigo_barras, nombre, principio_activo, estado, precio_costo, clasificaciones_producto(nombre)').eq('localidad_id', loc).order('nombre').order('id')),
        sb.from('tipos_precio').select('id, codigo, nombre, pct_utilidad, pct_descuento, factor, activo').eq('localidad_id', loc).order('codigo'),
        leerTodo(() => sb.from('producto_precios').select('*').eq('localidad_id', loc).order('id'))
      ]);
      productos = p; tipos = t.data || []; precios = pr;
      sel = (visibles().find((x) => preciosDe(x.id).length) || visibles()[0])?.id || null;
      pintar();
    }

    // Renglones de precios del producto: uno por cada tipo de precio activo (o con precio guardado).
    function armarFilas() {
      const ps = preciosDe(sel);
      filas = tipos.filter((t) => t.activo || ps.some((x) => x.tipo_precio_id === t.id)).map((t) => {
        const x = ps.find((y) => y.tipo_precio_id === t.id);
        return { t, id: x?.id || null, precio: x ? Number(x.precio) : '', vigente: x ? x.estado !== 'INACTIVO' : true, fecha: x?.fecha || x?.fecha_modifica || x?.fecha_ingresa || null, x };
      });
      cambios = false;
    }
    function pintar() {
      armarFilas();
      ctx.pDet.innerHTML = `
        <div class="bm-form kx-form cl-clasico pv-form">
          <div class="cl-banda kx-banda"><span>Administración de precios de venta</span><small>${esc(ctx.localidad(ctx.sel.loc)?.nombre_comercial || '')} · ${tipos.filter((t) => t.activo).length} tipo(s) de precio</small></div>
          <section class="kx-cat">
            <div class="kx-cat-cab">
              <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Código, código de barras, nombre o principio activo…" value="${esc(f.buscar)}" aria-label="Buscar producto"></label>
              <div class="kx-nav"><button type="button" class="boton secundario-sm" data-mover="-1"><i class="ti ti-chevron-up" aria-hidden="true"></i> Subir</button><button type="button" class="boton secundario-sm" data-mover="1"><i class="ti ti-chevron-down" aria-hidden="true"></i> Bajar</button></div>
              <label class="pc-check"><input type="checkbox" data-sinprecio ${f.sinPrecio ? 'checked' : ''}> Solo sin precio</label>
              <label class="pc-check kx-inact"><input type="checkbox" data-inactivos ${f.inactivos ? 'checked' : ''}> Incluir inactivos</label>
            </div>
            <div class="pc-lineas kx-productos"><table>
              <thead><tr><th class="num">ID</th><th>Código producto</th><th>Nombre</th><th>Principio activo</th><th>Estado</th><th class="num">Costo</th><th class="num">Precios</th></tr></thead>
              <tbody data-productos>${filasProductos()}</tbody>
            </table></div>
          </section>
          <section class="pv-cuerpo" data-precios></section>
        </div>`;
      pintarPrecios();
      ctx.pDet.querySelector(`tr[data-prod="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
    }
    function filasProductos() {
      return visibles().map((p) => { const n = preciosDe(p.id).length; return `<tr data-prod="${p.id}" class="${p.id === sel ? 'actual' : ''}" tabindex="0">
          <td class="num fuerte">${p.codigo}</td><td>${esc(p.codigo_producto || '')}</td><td class="cx-nombre" title="${esc(p.nombre)}">${esc(p.nombre)}</td><td class="cx-nombre tk-tenue" title="${esc(p.principio_activo || '')}">${esc(p.principio_activo || '')}</td>
          <td><span class="pc-marca ${p.estado === 'ACTIVO' ? 'aprobada' : 'anulada'}">${esc(p.estado.charAt(0) + p.estado.slice(1).toLowerCase())}</span></td><td class="num">${Number(p.precio_costo) ? fmt.monto(p.precio_costo) : '<span class="tk-tenue">—</span>'}</td>
          <td class="num ${n ? 'fuerte' : 'pc-rojo'}">${n || 'Sin precio'}</td></tr>`; }).join('') || '<tr><td colspan="7" class="tk-vacio">Ningún producto coincide.</td></tr>';
    }
    function pintarPrecios() {
      const caja = ctx.pDet.querySelector('[data-precios]');
      if (!caja) return;
      const p = prod(sel);
      if (!p) { caja.innerHTML = '<p class="vacio">Elige un producto.</p>'; return; }
      const costo = Number(p.precio_costo) || 0, ed = ctx.admin;
      const conAud = preciosDe(sel);
      const ing = conAud.filter((x) => x.fecha_ingresa).sort((a, b) => String(a.fecha_ingresa).localeCompare(String(b.fecha_ingresa)))[0];
      const mod = conAud.filter((x) => x.fecha_modifica).sort((a, b) => String(b.fecha_modifica).localeCompare(String(a.fecha_modifica)))[0];
      caja.innerHTML = `
        <div class="pv-tabla">
          <div class="kx-resumen pv-barra"><b class="pv-prod" title="${esc(p.nombre)}">${esc(p.codigo_producto || String(p.codigo))} · ${esc(p.nombre)}</b><span>Costo <b>Q ${fmt.monto(costo)}</b></span><span>Precios <b>${conAud.length} de ${filas.length}</b></span>
            ${ed ? `<span class="pv-acc"><button type="button" class="boton secundario-sm" data-accion="sugeridos" ${costo ? '' : 'disabled'} title="${costo ? 'Llena los precios vacíos con el sugerido de cada tipo' : 'El producto no tiene costo'}"><i class="ti ti-wand" aria-hidden="true"></i> Aplicar sugeridos</button><button type="button" class="boton primario-sm" data-accion="guardar"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar precios</button></span>` : ''}</div>
          <p class="modal-error tk-error pv-error" role="alert"></p>
          <div class="pc-lineas"><table>
            <thead><tr><th>Tipo precio</th><th>Fecha</th><th class="num">Precio Q</th><th class="num">Margen s/costo</th><th class="num">Sugerido</th><th class="cc-det">Vigente</th><th></th></tr></thead>
            <tbody>${filas.map((r, i) => { const pr = Number(r.precio) || 0, mg = costo && pr ? ((pr - costo) / costo) * 100 : null, sg = sugerido(r.t, costo); return `<tr data-f="${i}" class="${!r.t.activo ? 'tk-tenue' : ''}">
              <td class="fuerte">${esc(r.t.nombre)}<small class="tk-tenue pv-tipo">${Number(r.t.pct_utilidad) ? ` · utilidad ${Number(r.t.pct_utilidad)} %` : ''}${Number(r.t.pct_descuento) ? ` · desc. ${Number(r.t.pct_descuento)} %` : ''}</small></td>
              <td>${esc(fmt.fechaDia(r.fecha ? new Date(r.fecha).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }) : ''))}</td>
              <td class="num"><input type="number" step="0.01" min="0" data-p="precio" value="${r.precio === '' ? '' : r.precio}" ${ed ? '' : 'disabled'} aria-label="Precio ${esc(r.t.nombre)}"></td>
              <td class="num ${mg === null ? 'tk-tenue' : mg < 0 ? 'pc-rojo' : 'kx-ent'}" data-mg>${mg === null ? '—' : `${mg.toFixed(1)} %`}</td>
              <td class="num">${sg ? `<button type="button" class="pv-sug" data-sugerir="${i}" title="Usar el precio sugerido" ${ed ? '' : 'disabled'}>${fmt.monto(sg)}</button>` : '<span class="tk-tenue">—</span>'}</td>
              <td class="cc-det"><input type="checkbox" data-p="vigente" ${r.vigente ? 'checked' : ''} ${ed ? '' : 'disabled'} aria-label="Vigente"></td>
              <td>${ed && r.id ? `<button type="button" class="icono-boton" data-borrar="${i}" title="Quitar este precio" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="7" class="tk-vacio">La empresa no tiene tipos de precio: créalos en «Tipos de precio».</td></tr>'}</tbody>
          </table></div>
          <div class="pv-aud"><span>Ingreso <b>${esc(ing ? `${ing.usuario_ingresa || ''} · ${horaGt(ing.fecha_ingresa)}` : '—')}</b></span><span>Modificación <b>${esc(mod ? `${mod.usuario_modifica || ''} · ${horaGt(mod.fecha_modifica)}` : '—')}</b></span>${costo ? '' : '<span class="pc-rojo">Sin costo en el catálogo: el margen y el sugerido no se calculan.</span>'}</div>
        </div>
        `;
    }
    function leerFilas() { ctx.pDet.querySelectorAll('tr[data-f]').forEach((tr) => { const r = filas[Number(tr.dataset.f)]; const pi = tr.querySelector('[data-p=precio]'); r.precio = pi.value === '' ? '' : Number(pi.value); r.vigente = tr.querySelector('[data-p=vigente]').checked; }); }
    function margen(tr) { const r = filas[Number(tr.dataset.f)]; const costo = Number(prod(sel)?.precio_costo) || 0; const pr = Number(tr.querySelector('[data-p=precio]').value) || 0; const c = tr.querySelector('[data-mg]'); const mg = costo && pr ? ((pr - costo) / costo) * 100 : null; c.textContent = mg === null ? '—' : `${mg.toFixed(1)} %`; c.className = `num ${mg === null ? 'tk-tenue' : mg < 0 ? 'pc-rojo' : 'kx-ent'}`; cambios = true; return r; }

    async function guardar() {
      leerFilas();
      const err = ctx.pDet.querySelector('.pv-error');
      const mal = filas.find((r) => r.precio !== '' && !(r.precio >= 0));
      if (mal) { err.textContent = `Revisa el precio ${mal.t.nombre}.`; return; }
      err.textContent = '';
      const ahora = new Date().toISOString(), u = usuario();
      try {
        for (const r of filas) {
          if (r.id && r.precio === '') { const d = await sb.from('producto_precios').delete().eq('id', r.id); if (d.error) throw d.error; continue; }
          if (r.precio === '') continue;
          const estado = r.vigente ? 'ACTIVO' : 'INACTIVO';
          if (r.id) {
            if (Number(r.x.precio) === r.precio && (r.x.estado !== 'INACTIVO') === r.vigente) continue;
            const x = await sb.from('producto_precios').update({ precio: r.precio, estado, fecha: Number(r.x.precio) !== r.precio ? ahora : r.x.fecha, usuario_modifica: u, fecha_modifica: ahora }).eq('id', r.id);
            if (x.error) throw x.error;
          } else {
            const x = await sb.from('producto_precios').insert({ producto_id: sel, tipo_precio_id: r.t.id, precio: r.precio, estado, fecha: ahora, usuario_ingresa: u, fecha_ingresa: ahora });
            if (x.error) throw x.error;
          }
        }
        precios = await leerTodo(() => sb.from('producto_precios').select('*').eq('localidad_id', ctx.sel.loc).order('id'));
        window.FIN.aviso('Precios guardados');
        armarFilas(); pintarPrecios();
        const tb = ctx.pDet.querySelector('[data-productos]'); if (tb) tb.innerHTML = filasProductos();
      } catch (e) { err.textContent = window.UI.traducirError(e); }
    }

    // Lista de precios: todos los productos visibles con su costo y el precio de cada tipo.
    function lista(formato) {
      const ps = visibles(), ts = tipos.filter((t) => t.activo);
      if (!ps.length) return window.FIN.aviso('No hay productos con esos filtros');
      const e = ctx.localidad(ctx.sel.loc);
      const columnas = [{ titulo: 'ID', tipo: 'texto', ancho: 8 }, { titulo: 'Código', tipo: 'texto', ancho: 13 }, { titulo: 'Producto', tipo: 'texto', ancho: 48 }, { titulo: 'Costo', tipo: 'monto', ancho: 12 }, ...ts.map((t) => ({ titulo: t.nombre, tipo: 'monto', ancho: 14 }))];
      const filasL = ps.map((p) => ({ valores: [String(p.codigo), p.codigo_producto || '', p.nombre, Number(p.precio_costo) || '', ...ts.map((t) => { const x = precios.find((y) => y.producto_id === p.id && y.tipo_precio_id === t.id && y.estado !== 'INACTIVO'); return x ? Number(x.precio) : ''; })] }));
      const cfg = { titulo: 'Lista de precios de venta', parametros: [`Empresa: ${e ? `${e.codigo} · ${e.nombre_comercial}` : ''}`, `Productos: ${ps.length}${f.buscar ? ` (búsqueda «${f.buscar}»)` : ''}`, `Estado: ${f.inactivos ? 'TODOS' : 'ACTIVOS'}`, 'Solo precios vigentes'], orgId: ctx.sel.org, locId: ctx.sel.loc, columnas, filas: filasL };
      if (formato === 'PDF') return window.CUENTAS_XLSX.pdf(cfg);
      return window.REPORTE_XLSX.generar({ ...cfg, hoja: 'Precios', archivo: `lista_precios_${fmt.hoy()}` });
    }

    function elegir(id) {
      if (cambios && !confirm('Hay cambios de precios sin guardar. ¿Cambiar de producto y descartarlos?')) return;
      sel = id;
      ctx.pDet.querySelectorAll('tr[data-prod]').forEach((tr) => tr.classList.toggle('actual', Number(tr.dataset.prod) === id));
      ctx.pDet.querySelector(`tr[data-prod="${id}"]`)?.scrollIntoView({ block: 'nearest' });
      armarFilas(); pintarPrecios();
    }
    const refrescar = () => { const tb = ctx.pDet.querySelector('[data-productos]'); if (tb) tb.innerHTML = filasProductos(); };
    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (e.target.matches('[data-inactivos]')) { f.inactivos = e.target.checked; return refrescar(); }
      if (e.target.matches('[data-sinprecio]')) { f.sinPrecio = e.target.checked; return refrescar(); }
      if (e.target.matches('[data-p=vigente]')) cambios = true;
    });
    cont.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar]')) { f.buscar = e.target.value; return refrescar(); }
      if (e.target.matches('[data-p=precio]')) margen(e.target.closest('tr[data-f]'));
    });
    cont.addEventListener('click', (e) => {
      const fila = e.target.closest('tr[data-prod]');
      if (fila) return elegir(Number(fila.dataset.prod));
      const mv = e.target.closest('[data-mover]');
      if (mv) { const v = visibles(); const i = v.findIndex((p) => p.id === sel); const nx = v[Math.max(0, Math.min(v.length - 1, i + Number(mv.dataset.mover)))]; if (nx && nx.id !== sel) elegir(nx.id); return; }
      const sg = e.target.closest('[data-sugerir]');
      if (sg) { const tr = sg.closest('tr[data-f]'); tr.querySelector('[data-p=precio]').value = sugerido(filas[Number(sg.dataset.sugerir)].t, Number(prod(sel)?.precio_costo) || 0); return margen(tr); }
      const b = e.target.closest('[data-borrar]');
      if (b) { const tr = b.closest('tr[data-f]'); tr.querySelector('[data-p=precio]').value = ''; return margen(tr); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'guardar') return guardar();
      if (a === 'sugeridos') { ctx.pDet.querySelectorAll('tr[data-f]').forEach((tr) => { const r = filas[Number(tr.dataset.f)]; const i = tr.querySelector('[data-p=precio]'); const s = sugerido(r.t, Number(prod(sel)?.precio_costo) || 0); if (i.value === '' && s) { i.value = s; margen(tr); } }); return; }
      if (a === 'lista-pdf') return lista('PDF');
      if (a === 'lista-excel') return lista('EXCEL');
    });
    cont.addEventListener('keydown', (e) => {
      const fila = e.target.closest?.('tr[data-prod]');
      if (fila && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); const v = visibles(); const i = v.findIndex((p) => p.id === Number(fila.dataset.prod)); const nx = v[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (nx) { elegir(nx.id); ctx.pDet.querySelector(`tr[data-prod="${nx.id}"]`)?.focus(); } }
      if (e.key === 'Enter' && e.target.matches('[data-p=precio]')) { e.preventDefault(); guardar(); }
    });
    iniciar();
  };
})();
