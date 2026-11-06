// Facturación/Ventas · Catálogos de cada organización y localidad (empresa).
//   Vendedores: lista a la izquierda y la ficha a la derecha (correo, celular, teléfono, comisiones
//   general, crédito y contado, siglas y usuario del sistema).
//   Clasificaciones y tipos: arriba las clasificaciones (descripción, tipo, cuenta, tipo de
//   servicio, inventario y laboratorio) y abajo los tipos de productos de la clasificación elegida
//   (siglas, descripción, cuenta de inventarios y de facturación). Se editan en la misma lista.
//   Tipos de medida, Tipos de precio y Presentación productos: listas editables por empresa.
//   Productos y servicios: lista de artículos (nombre y código) y la ficha: clasificación y tipo,
//   estado, marca, proveedor principal, código de barras, presentación, unidad de medida, genérico,
//   punto mínimo (mínimo y máximo), precio costo, ubicación (estante, fila, bloque) y bodega, con las
//   pestañas Otros proveedores, Precios (por tipo de precio) e Imagen. Listado en PDF o Excel.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;
  const BUCKET = 'productos';
  const marcaActivo = (a) => `<span class="pc-marca ${a ? 'aprobada' : 'pendiente'}">${a ? 'Activo' : 'Inactivo'}</span>`;
  const faltaScript = (msg) => /does not exist|schema cache|vendedores|productos|clasificaciones_producto/.test(msg || '');
  const AVISO_SCRIPT = 'Falta instalar el script 59 (catálogos de ventas y productos) en Supabase.';

  // Lista de valores: ventana con búsqueda para elegir un registro de un catálogo y, si se permite,
  // crear uno nuevo ahí mismo. o: { titulo, columnas, filas: [{ id, celdas }], actual, crear: { campos:
  // [{ k, t, req, max }], guardar: async (datos) => id } }. Devuelve el id elegido o null.
  function listaValores(o) {
    return new Promise((resolver) => {
      const fondo = document.createElement('div');
      fondo.className = 'lov-fondo';
      let q = '';
      let sel = Math.max(0, o.filas.findIndex((f) => f.id === o.actual));
      const visibles = () => o.filas.filter((f) => !q || f.celdas.some((c) => String(c ?? '').toLowerCase().includes(q)));
      const cerrar = (id) => { fondo.remove(); document.removeEventListener('keydown', teclas, true); resolver(id ?? null); };
      function pintar() {
        const vis = visibles();
        sel = Math.min(sel, Math.max(0, vis.length - 1));
        fondo.querySelector('tbody').innerHTML = vis.map((f, i) => `<tr data-id="${f.id}" class="${i === sel ? 'lov-sel' : ''} ${f.id === o.actual ? 'lov-actual' : ''}">${f.celdas.map((c, k) => `<td class="${k === 0 ? 'num fuerte' : ''}">${esc(String(c ?? ''))}</td>`).join('')}</tr>`).join('')
          || `<tr><td colspan="${o.columnas.length}" class="tk-vacio">${o.filas.length ? 'Nada coincide con la búsqueda.' : 'El catálogo está vacío.'}${o.crear ? ' Agrégalo abajo.' : ''}</td></tr>`;
        fondo.querySelector('[data-n]').textContent = `${vis.length} de ${o.filas.length}`;
        fondo.querySelector('tr.lov-sel')?.scrollIntoView({ block: 'nearest' });
      }
      fondo.innerHTML = `
        <div class="lov" role="dialog" aria-modal="true" aria-label="${esc(o.titulo)}">
          <header class="lov-cab"><h3><i class="ti ti-list-search" aria-hidden="true"></i> ${esc(o.titulo)}</h3><small data-n></small><button type="button" class="icono-boton" data-cerrar aria-label="Cerrar"><i class="ti ti-x" aria-hidden="true"></i></button></header>
          <label class="tk-buscar lov-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-q placeholder="Buscar… (Enter elige, Esc cierra)" aria-label="Buscar"></label>
          <div class="pc-lineas lov-tabla"><table><thead><tr>${o.columnas.map((c, k) => `<th class="${k === 0 ? 'num' : ''}">${esc(c)}</th>`).join('')}</tr></thead><tbody></tbody></table></div>
          ${o.crear ? `<form class="lov-nuevo" novalidate><span class="lov-nuevo-t"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo</span>${o.crear.campos.map((c) => `<label class="campo"><span>${esc(c.t)}${c.req ? ' *' : ''}</span><input name="${c.k}" maxlength="${c.max || 120}"></label>`).join('')}<button type="submit" class="boton primario-sm">Agregar y elegir</button><p class="modal-error tk-error" role="alert"></p></form>` : ''}
        </div>`;
      document.body.appendChild(fondo);
      pintar();
      fondo.querySelector('[data-q]').focus();
      function teclas(e) {
        if (e.key === 'Escape') { e.preventDefault(); return cerrar(null); }
        if (e.target.closest?.('.lov-nuevo')) return;
        const vis = visibles();
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, vis.length - 1); pintar(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); pintar(); }
        if (e.key === 'Enter' && vis[sel]) { e.preventDefault(); cerrar(vis[sel].id); }
      }
      document.addEventListener('keydown', teclas, true);
      fondo.addEventListener('input', (e) => { if (e.target.matches('[data-q]')) { q = e.target.value.trim().toLowerCase(); sel = 0; pintar(); } });
      fondo.addEventListener('click', (e) => {
        if (e.target === fondo || e.target.closest('[data-cerrar]')) return cerrar(null);
        const tr = e.target.closest('tr[data-id]');
        if (tr) cerrar(Number(tr.dataset.id));
      });
      fondo.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const datos = Object.fromEntries(o.crear.campos.map((c) => [c.k, form.elements[c.k].value.trim()]));
        const falta = o.crear.campos.find((c) => c.req && !datos[c.k]);
        if (falta) { form.querySelector('.modal-error').textContent = `Escribe ${falta.t.toLowerCase()}.`; return form.elements[falta.k].focus(); }
        const boton = form.querySelector('[type=submit]');
        boton.disabled = true;
        try { const id = await o.crear.guardar(datos); if (id) cerrar(id); }
        catch (err) { form.querySelector('.modal-error').textContent = window.UI.traducirError(err); }
        finally { boton.disabled = false; }
      });
    });
  }
  window.LOV = listaValores;

  window.PANTALLAS = window.PANTALLAS || {};

  // ===================== Vendedores =====================
  window.PANTALLAS.vendedores = function (cont) {
    const ctx = montar(cont, { titulo: 'Vendedores', icono: 'ti-user-dollar', clase: 'bk-vendedores cp-lado', grupo: 'Ventas · Catálogos' });
    const { sb } = ctx;
    let lista = [], usuarios = [];
    let actual = null, nuevo = false, buscar = '';
    const f = { estado: 'ACTIVOS' };

    function pintarFiltros() {
      ctx.filtros(`<label class="campo"><span>Vendedores</span><select name="estado">${[['ACTIVOS', 'Activos'], ['TODOS', 'Todos']].map(([k, t]) => `<option value="${k}" ${f.estado === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`,
        ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo vendedor</button>' : '');
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('vendedores').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${faltaScript(prueba.error.message) ? AVISO_SCRIPT : esc(prueba.error.message)}</p></section>`; return; }
      pintarFiltros();
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const { data } = ctx.sel.org ? await sb.from('perfiles').select('id, usuario, nombre, localidad_id, activo').eq('organizacion_id', ctx.sel.org).order('usuario') : { data: [] };
      usuarios = data || [];
      actual = null; nuevo = false;
      await consultar();
    }
    async function consultar(id = actual?.id) {
      if (!ctx.sel.loc) { lista = []; pintarLista(); return abrir(null); }
      let q = sb.from('vendedores').select('*').eq('localidad_id', ctx.sel.loc).order('codigo');
      if (f.estado === 'ACTIVOS') q = q.eq('activo', true);
      const { data, error } = await q;
      if (error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      lista = data || [];
      pintarLista();
      abrir(lista.find((v) => v.id === id) || (nuevo ? null : lista[0]) || null);
    }
    const usuario = (id) => usuarios.find((u) => u.id === id);
    function pintarLista() {
      const q = buscar.trim().toLowerCase();
      const filas = lista.filter((v) => !q || [v.codigo, v.nombre, v.siglas, v.correo, usuario(v.perfil_id)?.usuario].some((x) => String(x || '').toLowerCase().includes(q)));
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab"><h2>Vendedores <small>${lista.length}</small></h2>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Número, nombre o siglas…" value="${esc(buscar)}" aria-label="Buscar vendedores"></label></header>
        <div class="ta-tabla cc-tabla"><table><thead><tr><th class="num">Vendedor</th><th>Nombre del vendedor</th><th>Siglas</th><th>Usuario</th><th class="num">% Comisión</th><th>Estado</th></tr></thead>
          <tbody>${filas.map((v) => `<tr data-id="${v.id}" class="${actual && actual.id === v.id ? 'actual' : ''} ${v.activo ? '' : 'pc-anulada'}" tabindex="0"><td class="num fuerte">${v.codigo}</td><td class="cc-nombre">${esc(v.nombre)}</td><td>${esc(v.siglas || '')}</td><td>${esc(usuario(v.perfil_id)?.usuario || '')}</td><td class="num">${fmt.monto(v.pct_comision_general)}</td><td>${marcaActivo(v.activo)}</td></tr>`).join('')
            || `<tr><td colspan="6" class="tk-vacio"><i class="ti ti-user-dollar" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : lista.length ? 'Ninguno coincide con la búsqueda.' : `No hay vendedores${ctx.admin ? ': crea el primero con «Nuevo vendedor».' : '.'}`}</td></tr>`}</tbody></table></div>`;
    }
    function abrir(v) {
      actual = v;
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-id]').forEach((tr) => tr.classList.toggle('actual', !!v && tr.dataset.id === String(v.id)));
    }
    function pintarDetalle() {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-user-dollar'); return; }
      const v = actual || (nuevo ? { activo: true, pct_comision_general: 0, pct_comision_credito: 0, pct_comision_contado: 0 } : null);
      if (!v) { ctx.pDet.innerHTML = ctx.vacio('Elige un vendedor.', 'ti-user-dollar'); return; }
      const dis = ctx.admin ? '' : 'disabled';
      const pct = (n, t) => `<label class="campo"><span>${t}</span><input type="number" step="0.01" min="0" max="100" name="${n}" value="${esc(String(v[n] ?? 0))}" ${dis}></label>`;
      const enLoc = usuarios.filter((u) => u.activo || u.id === v.perfil_id);
      ctx.pDet.innerHTML = `
        <form class="tk-form bm-form cp-form cv-form" novalidate>
          <header class="tk-titulo bm-titulo"><span class="tk-icono"><i class="ti ti-user-dollar" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>${actual ? `Vendedor ${actual.codigo}` : 'Nuevo vendedor'}</small><h2>${actual ? esc(actual.nombre) : 'Datos del vendedor'}</h2></div>
            <div class="tk-marcas">${actual ? marcaActivo(actual.activo) : ''}</div>
            <div class="tk-titulo-acciones">${nuevo ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}${ctx.admin ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${actual ? 'Guardar cambios' : 'Crear vendedor'}</button>` : ''}</div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          <section class="bm-bloque"><h3 class="ta-col-titulo"><i class="ti ti-id" aria-hidden="true"></i> Vendedor</h3>
            <div class="cp-g cp-g6">
              ${actual ? `<div class="bs-req-num"><span>Vendedor</span><b>${actual.codigo}</b></div>` : `<label class="campo"><span>Vendedor</span><input type="number" min="1" name="codigo" placeholder="Auto" ${dis}></label>`}
              <label class="campo cp-c4"><span>Nombre del vendedor *</span><input name="nombre" value="${esc(v.nombre || '')}" maxlength="120" ${dis}></label>
              <label class="campo"><span>Siglas</span><input name="siglas" value="${esc(v.siglas || '')}" maxlength="6" class="cg-siglas" ${dis}></label>
              <label class="campo cp-c3"><span>Correo</span><input type="email" name="correo" value="${esc(v.correo || '')}" maxlength="120" ${dis}></label>
              <label class="campo cp-c2"><span>Celular</span><input name="celular" value="${esc(v.celular || '')}" maxlength="30" ${dis}></label>
              <label class="pc-check cp-checks"><input type="checkbox" name="activo" ${v.activo ? 'checked' : ''} ${dis}> Activo</label>
              <label class="campo cp-c2"><span>Teléfono</span><input name="telefono" value="${esc(v.telefono || '')}" maxlength="30" ${dis}></label>
              <label class="campo cp-c4"><span>Usuario del sistema</span><select name="perfil_id" ${dis}><option value="">— Sin usuario —</option>${enLoc.map((u) => `<option value="${u.id}" ${u.id === v.perfil_id ? 'selected' : ''}>${esc(u.usuario || '')} · ${esc(u.nombre || '')}</option>`).join('')}</select></label>
            </div>
          </section>
          <section class="bm-bloque"><h3 class="ta-col-titulo"><i class="ti ti-percentage" aria-hidden="true"></i> Comisiones</h3>
            <div class="cp-g cp-g6 cv-com">${pct('pct_comision_general', '% Comisión general')}${pct('pct_comision_credito', '% Comisión crédito')}${pct('pct_comision_contado', '% Comisión contado')}</div>
          </section>
          ${actual ? `<p class="cc-ingreso"><i class="ti ti-user" aria-hidden="true"></i> Creó ${esc(actual.creado_por_nombre || '')} · ${esc(fmt.fechaHora(actual.creado_en))}${actual.modificado_en ? ` · modificó ${esc(actual.modificado_por_nombre || '')} ${esc(fmt.fechaHora(actual.modificado_en))}` : ''}</p>` : ''}
        </form>`;
    }
    async function guardar(form) {
      const el = form.elements;
      const error = form.querySelector('.modal-error');
      const t = (n) => el[n].value.trim() || null;
      const v = { nombre: el.nombre.value.trim(), siglas: t('siglas'), correo: t('correo'), celular: t('celular'), telefono: t('telefono'), activo: el.activo.checked, perfil_id: el.perfil_id.value || null,
        pct_comision_general: Number(el.pct_comision_general.value) || 0, pct_comision_credito: Number(el.pct_comision_credito.value) || 0, pct_comision_contado: Number(el.pct_comision_contado.value) || 0 };
      if (!v.nombre) { error.textContent = 'Escribe el nombre del vendedor.'; return el.nombre.focus(); }
      if (v.siglas && !/^[A-Za-z0-9]{1,6}$/.test(v.siglas)) { error.textContent = 'Las siglas son de 1 a 6 letras o números.'; return el.siglas.focus(); }
      if ([v.pct_comision_general, v.pct_comision_credito, v.pct_comision_contado].some((p) => p < 0 || p > 100)) { error.textContent = 'Las comisiones van de 0 a 100 %.'; return; }
      if (!actual && el.codigo.value) {
        const c = Number(el.codigo.value);
        if (lista.some((x) => x.codigo === c)) { error.textContent = `El número ${c} ya es de otro vendedor.`; return el.codigo.focus(); }
        v.codigo = c;
      }
      error.textContent = '';
      const r = actual ? await sb.from('vendedores').update(v).eq('id', actual.id).select('id').single()
        : await sb.from('vendedores').insert({ codigo: 0, ...v, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single();
      if (r.error) { error.textContent = window.UI.traducirError(r.error); return; }
      window.FIN.aviso(actual ? 'Vendedor guardado' : 'Vendedor creado');
      nuevo = false;
      if (f.estado === 'ACTIVOS' && !v.activo) { f.estado = 'TODOS'; pintarFiltros(); }
      await consultar(r.data.id);
    }
    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { pintarFiltros(); return cargarLocalidad(); }
      if (cambio === 'otro') { f.estado = e.target.value; return consultar(); }
    });
    cont.addEventListener('input', (e) => { if (!e.target.matches('[data-buscar]')) return; buscar = e.target.value; const pos = e.target.selectionStart; pintarLista(); const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos); });
    cont.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-buscar]')) e.preventDefault(); });
    cont.addEventListener('click', (e) => {
      const fila = e.target.closest('tr[data-id]');
      if (fila && ctx.pMae.contains(fila)) { nuevo = false; return abrir(lista.find((v) => String(v.id) === fila.dataset.id)); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'nuevo') { nuevo = true; actual = null; ctx.pMae.querySelectorAll('tr.actual').forEach((tr) => tr.classList.remove('actual')); pintarDetalle(); ctx.pDet.querySelector('[name=nombre]')?.focus(); }
      if (a === 'cancelar') { nuevo = false; abrir(lista[0] || null); }
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.cv-form')) { e.preventDefault(); guardar(e.target); } });
    iniciar();
  };

  // ===================== Lista editable con cuentas contables =====================
  // cfg: { tabla, columnas: [{ k, t, tipo: 'texto'|'select'|'check'|'cuenta', opciones, max, req, ancho }],
  // extra(): campos fijos de las filas nuevas, filtro(q): filtra la consulta, alElegir(fila) }.
  function lista(el, cfg) {
    const sb = window.FIN.sb;
    const ed = window.FIN.puedeEditarCatalogos();
    let filas = [];
    let elegida = null;
    const contable = (id) => cfg.contables().find((x) => x.id === id);
    const porCodigo = (c) => cfg.contables().find((x) => x.codigo === String(c || '').trim() && x.movimiento);
    const datos = (x) => Object.fromEntries([...cfg.columnas.map((c) => [c.k, x[c.k] ?? (c.tipo === 'check' ? false : c.tipo === 'select' ? c.opciones[0][0] : c.tipo === 'cuenta' ? null : '')]), ['activo', x.activo !== false]]);
    const cambiadas = () => filas.filter((x) => !x.id || JSON.stringify(datos(x)) !== x._orig);
    const api = {
      async cargar() {
        let q = sb.from(cfg.tabla).select('*').order('codigo');
        q = cfg.filtro(q);
        if (!q) { filas = []; return api.pintar(); }
        const { data, error } = await q;
        if (error) { el.querySelector('.cy-cuerpo').innerHTML = `<p class="vacio">${faltaScript(error.message) ? AVISO_SCRIPT : esc(error.message)}</p>`; return; }
        filas = (data || []).map((x) => ({ ...x, _orig: JSON.stringify(datos(x)), _cod: {} }));
        if (!filas.some((x) => x.id === elegida)) elegida = filas[0]?.id || null;
        api.pintar();
        cfg.alElegir?.(filas.find((x) => x.id === elegida) || null);
      },
      pintar() {
        const n = cambiadas().length;
        const cuerpo = el.querySelector('.cy-cuerpo');
        el.querySelector('[data-cy-guardar]')?.toggleAttribute('disabled', !n);
        const g = el.querySelector('[data-cy-guardar]');
        if (g) g.innerHTML = `<i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar${n ? ` (${n})` : ''}`;
        el.querySelector('[data-cy-n]').textContent = filas.length;
        cuerpo.innerHTML = `<div class="pc-lineas cg-tabla"><table>
          <thead><tr><th class="cg-cod">${esc(cfg.codigo)}</th>${cfg.columnas.map((c) => `<th class="${c.tipo === 'check' ? 'cg-chk' : ''}" ${c.ancho ? `style="width:${c.ancho}"` : ''}>${esc(c.t)}${c.req ? ' *' : ''}</th>`).join('')}<th class="cg-chk">Activo</th></tr></thead>
          <tbody>${filas.map((x, i) => `<tr data-fila="${i}" class="${x.id && x.id === elegida ? 'cy-elegida' : ''} ${!x.id ? 'cg-nueva' : JSON.stringify(datos(x)) !== x._orig ? 'cg-cambio' : ''} ${x.activo === false ? 'cg-inactiva' : ''}">
            <td class="cg-cod">${x.codigo ?? '<span class="tk-tenue">Nuevo</span>'}</td>
            ${cfg.columnas.map((c) => {
              const dis = ed ? '' : 'disabled';
              if (c.tipo === 'check') return `<td class="cg-chk"><input type="checkbox" data-k="${c.k}" ${x[c.k] ? 'checked' : ''} ${dis} aria-label="${esc(c.t)}"></td>`;
              if (c.tipo === 'select') return `<td><select data-k="${c.k}" ${dis} aria-label="${esc(c.t)}">${c.opciones.map(([v, t]) => `<option value="${v}" ${x[c.k] === v ? 'selected' : ''}>${t}</option>`).join('')}</select></td>`;
              if (c.tipo === 'cuenta') { const k = contable(x[c.k]); const cod = x._cod?.[c.k] ?? (k ? k.codigo : ''); return `<td class="cy-cta"><input list="cy-cuentas" data-k="${c.k}" data-cuenta value="${esc(cod)}" placeholder="Cuenta" ${dis} aria-label="${esc(c.t)}"><small data-nombre="${c.k}">${k ? esc(k.nombre) : cod ? '<span class="pc-error">No es de movimiento</span>' : ''}</small></td>`; }
              return `<td><input data-k="${c.k}" value="${esc(x[c.k] ?? '')}" maxlength="${c.max || 120}" ${c.k === 'siglas' ? 'class="cg-siglas"' : ''} ${dis} aria-label="${esc(c.t)}"></td>`;
            }).join('')}
            <td class="cg-chk"><input type="checkbox" data-k="activo" ${x.activo !== false ? 'checked' : ''} ${ed ? '' : 'disabled'} aria-label="Activo"></td></tr>`).join('')
            || `<tr><td colspan="${cfg.columnas.length + 2}" class="tk-vacio">${esc(cfg.vacio())}</td></tr>`}</tbody></table></div>`;
      },
      agregar() { const extra = cfg.extra(); if (!extra) return; filas.push({ codigo: null, ...Object.fromEntries(cfg.columnas.map((c) => [c.k, c.defecto ?? (c.tipo === 'check' ? false : c.tipo === 'select' ? c.opciones[0][0] : c.tipo === 'cuenta' ? null : '')])), activo: true, _cod: {}, _extra: extra }); api.pintar(); const ins = el.querySelectorAll('tr.cg-nueva [data-k=nombre]'); ins[ins.length - 1]?.focus(); },
      async guardar() {
        const error = el.querySelector('.cg-error');
        const ls = cambiadas();
        for (const x of ls) {
          if (!String(x.nombre || '').trim()) { error.textContent = 'Escribe la descripción de cada fila.'; return false; }
          if (x.siglas && !/^[A-Za-z0-9]{1,6}$/.test(String(x.siglas).trim())) { error.textContent = `Las siglas de «${x.nombre}» deben ser de 1 a 6 letras o números.`; return false; }
          const mala = cfg.columnas.find((c) => c.tipo === 'cuenta' && x._cod?.[c.k] && !porCodigo(x._cod[c.k]));
          if (mala) { error.textContent = `${mala.t} de «${x.nombre}» no es una cuenta de movimiento de la localidad.`; return false; }
        }
        const nombres = filas.map((x) => String(x.nombre || '').trim().toUpperCase());
        const rep = nombres.find((n, i) => n && nombres.indexOf(n) !== i && cfg.unico !== false);
        if (rep) { error.textContent = `«${rep}» está repetida.`; return false; }
        error.textContent = '';
        for (const x of ls) {
          const v = datos(x);
          cfg.columnas.forEach((c) => { if (c.tipo === 'texto' || !c.tipo) v[c.k] = String(v[c.k] ?? '').trim() || null; });
          const r = x.id ? await sb.from(cfg.tabla).update(v).eq('id', x.id).select('id').single() : await sb.from(cfg.tabla).insert({ codigo: 0, ...v, ...x._extra }).select('id').single();
          if (r.error) { error.textContent = window.UI.traducirError(r.error); return false; }
          if (!x.id && !elegida) elegida = r.data.id;
        }
        window.FIN.aviso(`${ls.length} cambio(s) guardado(s)`);
        await api.cargar();
        return true;
      },
      pendientes: () => cambiadas().length,
      elegida: () => filas.find((x) => x.id === elegida) || null
    };
    el.addEventListener('input', (e) => {
      const tr = e.target.closest('tr[data-fila]');
      if (!tr || e.target.type === 'checkbox') return;
      const x = filas[Number(tr.dataset.fila)];
      if (e.target.matches('[data-cuenta]')) { x._cod[e.target.dataset.k] = e.target.value; const k = porCodigo(e.target.value); x[e.target.dataset.k] = k ? k.id : null; tr.querySelector(`[data-nombre="${e.target.dataset.k}"]`).innerHTML = k ? esc(k.nombre) : e.target.value.trim() ? '<span class="pc-error">No es de movimiento</span>' : ''; }
      else x[e.target.dataset.k] = e.target.value;
      tr.classList.toggle('cg-cambio', !!x.id && JSON.stringify(datos(x)) !== x._orig);
      const n = cambiadas().length;
      const g = el.querySelector('[data-cy-guardar]');
      if (g) { g.disabled = !n; g.innerHTML = `<i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar${n ? ` (${n})` : ''}`; }
    });
    el.addEventListener('change', (e) => {
      const tr = e.target.closest('tr[data-fila]');
      if (!tr || !(e.target.type === 'checkbox' || e.target.tagName === 'SELECT')) return;
      filas[Number(tr.dataset.fila)][e.target.dataset.k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      api.pintar();
    });
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-cy-agregar]')) return api.agregar();
      if (e.target.closest('[data-cy-guardar]')) return api.guardar();
      const tr = e.target.closest('tr[data-fila]');
      if (tr && cfg.alElegir) {
        const x = filas[Number(tr.dataset.fila)];
        if (!x.id || x.id === elegida) return;
        elegida = x.id;
        el.querySelectorAll('tr[data-fila]').forEach((t) => t.classList.toggle('cy-elegida', t === tr));
        cfg.alElegir(x);
      }
    });
    return api;
  }

  // ===================== Clasificaciones y tipos =====================
  window.PANTALLAS['clasificaciones-y-tipos'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Clasificaciones y tipos de productos', icono: 'ti-category', clase: 'bk-clasif-tipos', grupo: grupoCat() });
    const { sb } = ctx;
    let contables = [];
    let clasif = null;
    const cajon = (id, titulo, icono, ayuda) => `<section class="cy-caja" data-caja="${id}">
        <header class="cy-cab"><h3 class="ta-col-titulo"><i class="ti ${icono}" aria-hidden="true"></i> ${titulo} <small data-cy-n>0</small></h3><span class="cy-ayuda">${ayuda}</span>
          ${ctx.admin ? '<button type="button" class="boton secundario-sm" data-cy-agregar><i class="ti ti-plus" aria-hidden="true"></i> Agregar</button><button type="button" class="boton primario-sm" data-cy-guardar disabled><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button>' : ''}</header>
        <p class="modal-error tk-error cg-error" role="alert"></p><div class="cy-cuerpo"></div></section>`;
    let lc = null, lt = null;

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      ctx.filtros('');
      ctx.pMae.innerHTML = cajon('clasif', 'Clasificaciones', 'ti-category', 'Elige una clasificación para ver sus tipos de productos.');
      ctx.pDet.innerHTML = `${cajon('tipos', 'Tipos de productos', 'ti-tags', '')}<datalist id="cy-cuentas"></datalist>`;
      lc = lista(ctx.pMae.querySelector('[data-caja=clasif]'), {
        tabla: 'clasificaciones_producto', codigo: '#', contables: () => contables,
        columnas: [
          { k: 'nombre', t: 'Descripción', req: true, max: 100 },
          { k: 'tipo', t: 'Tipo', tipo: 'select', ancho: '112px', opciones: [['PRODUCTO', 'Producto'], ['SERVICIO', 'Servicio']] },
          { k: 'cuenta_id', t: 'Cuenta', tipo: 'cuenta', ancho: '190px' },
          { k: 'tipo_servicio', t: 'Servicio', tipo: 'select', ancho: '104px', opciones: [['INTERNO', 'Interno'], ['EXTERNO', 'Externo']] },
          { k: 'inventario', t: 'Inv.', tipo: 'check', defecto: true }, { k: 'laboratorio', t: 'Lab.', tipo: 'check' },
          { k: 'utilizar_lote', t: 'Lote', tipo: 'check', ayuda: 'Los productos de esta clasificación se controlan por lote (script 102).' }
        ],
        filtro: (q) => ctx.sel.loc ? q.eq('localidad_id', ctx.sel.loc) : null,
        extra: () => ctx.sel.loc ? { organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc } : null,
        vacio: () => ctx.sel.loc ? 'Sin clasificaciones: agrega la primera.' : 'Elige la empresa.',
        alElegir: (x) => { clasif = x; ctx.pDet.querySelector('[data-caja=tipos] .ta-col-titulo').innerHTML = `<i class="ti ti-tags" aria-hidden="true"></i> Tipos de productos${x ? ` · ${esc(x.nombre)}` : ''} <small data-cy-n>0</small>`; lt.cargar(); }
      });
      lt = lista(ctx.pDet.querySelector('[data-caja=tipos]'), {
        tabla: 'tipos_producto', codigo: 'Tipo', contables: () => contables, unico: false,
        columnas: [
          { k: 'siglas', t: 'Siglas', ancho: '84px', max: 6 },
          { k: 'nombre', t: 'Descripción', req: true, max: 120 },
          { k: 'cuenta_inventario_id', t: 'Cuenta inventarios', tipo: 'cuenta', ancho: '150px' },
          { k: 'cuenta_facturacion_id', t: 'Cuenta facturación', tipo: 'cuenta', ancho: '150px' }
        ],
        filtro: (q) => clasif?.id ? q.eq('clasificacion_id', clasif.id) : null,
        extra: () => { if (!clasif?.id) { window.FIN.aviso('Guarda y elige primero la clasificación'); return null; } return { clasificacion_id: clasif.id, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }; },
        vacio: () => clasif?.id ? 'La clasificación no tiene tipos: agrega el primero.' : 'Elige una clasificación.'
      });
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      contables = await ctx.cuentasContables();
      ctx.pDet.querySelector('#cy-cuentas').innerHTML = contables.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('');
      clasif = null;
      await lc.cargar();
      if (!lc.elegida()) await lt.cargar();
    }
    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') {
        if ((lc.pendientes() || lt.pendientes()) && !confirm('Hay cambios sin guardar. ¿Cambiar de empresa y descartarlos?')) return;
        ctx.filtros(''); cargarLocalidad();
      }
    });
    iniciar();
  };

  // ===================== Tipos de medida, Tipos de precio y Presentación productos =====================
  // Las mismas pantallas se abren desde Compras › Catálogos › Generales (script 101): el rótulo dice de dónde.
  const grupoCat = () => location.hash.startsWith('#/compras/') ? 'Compras · Catálogos' : 'Ventas · Catálogos';
  const LOCAL = { local: true, script: '59 (catálogos de ventas y productos)', get grupo() { return grupoCat(); } };
  window.PANTALLAS['tipos-de-medida'] = (cont) => window.CATALOGO_GRID(cont, { ...LOCAL, tabla: 'tipos_medida', titulo: 'Tipos de medida', icono: 'ti-ruler-measure', codigo: 'Tipo', enColumnas: 3,
    descripcion: 'Unidades de medida con que se venden y se controlan los productos.', columnas: [{ k: 'nombre', t: 'Descripción', req: true, max: 80 }] });
  window.PANTALLAS['presentaciones-productos'] = (cont) => window.CATALOGO_GRID(cont, { ...LOCAL, tabla: 'presentaciones_producto', titulo: 'Presentaciones de productos', icono: 'ti-package', codigo: '#', enColumnas: 3,
    descripcion: 'Presentación en que viene el producto: caja, bolsa, unidad, rollo…', columnas: [{ k: 'nombre', t: 'Descripción', req: true, max: 80 }] });
  window.PANTALLAS['tipos-de-precio'] = (cont) => window.CATALOGO_GRID(cont, { ...LOCAL, tabla: 'tipos_precio', titulo: 'Administración de tipos de precios', icono: 'ti-currency-dollar', codigo: 'Tipo precio',
    descripcion: 'Listas de precio de venta: el % de utilidad sobre el costo y el % de descuento.',
    columnas: [{ k: 'nombre', t: 'Descripción', req: true, max: 80 }, { k: 'pct_utilidad', t: '% Utilidad', tipo: 'numero', ancho: '130px' }, { k: 'pct_descuento', t: '% Descuento', tipo: 'numero', ancho: '130px', maximo: 100 },
      { k: 'factor', t: 'Factor precios', tipo: 'select', ancho: '170px', defecto: 'NORMAL', opciones: [['NORMAL', 'Normal (sobre costo)'], ['PRECIO FIJO', 'Precio fijo']] }],
    leyenda: '<i class="ti ti-info-circle" aria-hidden="true"></i> Normal: precio = costo × (1 + % utilidad) × (1 − % descuento). Precio fijo: se escribe en cada producto (pestaña Precios). «Activo» es el estado del tipo de precio.' });

  // ===================== Productos y servicios =====================
  // Diseño A (sin desplazar la página): la lista de artículos arriba con sus datos clave y la ficha abajo
  // en 4 bloques (artículo, clasificación y medida, costo y existencias, y precios / otros proveedores /
  // imagen). Los datos del sistema anterior (script 105) se muestran en el bloque de costo.
  window.PANTALLAS['productos-y-servicios'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Definición de artículos', icono: 'ti-package', clase: 'bk-productos cp-arriba', grupo: grupoCat() });
    const { sb } = ctx;
    const f = { estado: 'ACTIVO', clasificacion: '', formato: 'PDF' };
    let lista0 = [], clasificaciones = [], tipos = [], medidas = [], presentaciones = [], precios = [], proveedores = [], bodegas = [];
    let actual = null, nuevo = false, buscar = '', pestana = 'PRECIOS', nPrecios = new Map();
    let otros = [], preciosProd = [], imagen = { nuevo: null, quitar: false };
    const prov = (id) => proveedores.find((p) => p.id === id);
    const provTxt = (p) => `${p.codigo} · ${p.nombre_comercial}`;
    const provDe = (t0) => { const t = String(t0 || '').trim().toUpperCase(); return t ? proveedores.find((p) => provTxt(p).toUpperCase() === t) || proveedores.find((p) => String(p.codigo) === t || p.nit === t || p.nombre_comercial === t) || null : null; };
    const clas = (id) => clasificaciones.find((x) => x.id === id);
    // La bodega principal: la general activa sin bodega mayor (o la que se llama «principal»).
    const principal = () => { const act = bodegas.filter((b) => b.estado === 'ACTIVO'); return (act.find((b) => /PRINCIPAL/i.test(b.nombre)) || act.find((b) => b.tipo !== 'SUB-BODEGA' && !b.bodega_mayor_id) || act[0])?.id || null; };

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Estado</span><select name="estado"><option value="">Todos</option>${['ACTIVO', 'INACTIVO', 'DESCONTINUADO'].map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label class="campo"><span>Clasificación</span><select name="clasificacion"><option value="">Todas</option>${clasificaciones.map((c) => `<option value="${c.id}" ${String(c.id) === f.clasificacion ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Formato</span><select name="formato">${['PDF', 'EXCEL'].map((x) => `<option ${f.formato === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`,
        `<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>
         ${ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nuevo artículo</button>' : ''}`);
    }
    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('productos').select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${faltaScript(prueba.error.message) ? AVISO_SCRIPT : esc(prueba.error.message)}</p></section>`; return; }
      await cargarLocalidad();
    }
    async function cargarLocalidad() {
      const loc = ctx.sel.loc || 0;
      const q = (t, cols = '*') => sb.from(t).select(cols).eq('localidad_id', loc).order('codigo');
      const r = await Promise.all([q('clasificaciones_producto'), q('tipos_producto'), q('tipos_medida'), q('presentaciones_producto'), q('tipos_precio'),
        sb.from('proveedores').select('id, codigo, nit, nombre_comercial, estado').eq('localidad_id', loc).order('nombre_comercial'), q('bodegas', 'id, codigo, nombre, estado, tipo, bodega_mayor_id')]);
      [clasificaciones, tipos, medidas, presentaciones, precios, proveedores, bodegas] = r.map((x) => x.data || []);
      if (f.clasificacion && !clas(Number(f.clasificacion))) f.clasificacion = '';
      pintarFiltros();
      actual = null; nuevo = false;
      await consultar();
    }
    async function consultar(id = actual?.id) {
      if (!ctx.sel.loc) { lista0 = []; pintarLista(); return abrir(null); }
      let q = sb.from('productos').select('*').eq('localidad_id', ctx.sel.loc).order('codigo');
      if (f.estado) q = q.eq('estado', f.estado);
      if (f.clasificacion) q = q.eq('clasificacion_id', Number(f.clasificacion));
      const { data, error } = await q;
      if (error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      lista0 = data || [];
      const pr = await sb.from('producto_precios').select('producto_id').eq('localidad_id', ctx.sel.loc).not('producto_id', 'is', null);
      nPrecios = new Map();
      (pr.data || []).forEach((x) => nPrecios.set(x.producto_id, (nPrecios.get(x.producto_id) || 0) + 1));
      pintarLista();
      await abrir(lista0.find((p) => p.id === id) || (nuevo ? null : lista0[0]) || null);
    }
    function pintarLista() {
      const q = buscar.trim().toLowerCase();
      const filas = lista0.filter((p) => !q || [p.codigo, p.nombre, p.codigo_producto, p.codigo_barras, p.marca].some((v) => String(v || '').toLowerCase().includes(q)));
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab"><h2>Artículos <small>${lista0.length}</small></h2>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Nombre, código o código de barras…" value="${esc(buscar)}" aria-label="Buscar artículos"></label></header>
        <div class="ta-tabla cc-tabla cpa-lista"><table><thead><tr><th class="num">Artículo</th><th>Código producto</th><th>Nombre</th><th>Tipo</th><th>Medida</th><th>Presentación</th><th>Bodega</th><th class="num">Costo Q</th><th class="num" title="Precios definidos">Precios</th><th>Estado</th></tr></thead>
          <tbody>${filas.map((p) => { const tp = tipos.find((x) => x.id === p.tipo_producto_id); const nm = (l, id) => l.find((x) => x.id === id)?.nombre || ''; return `<tr data-id="${p.id}" class="${actual && actual.id === p.id ? 'actual' : ''} ${p.estado !== 'ACTIVO' ? 'pc-anulada' : ''}" tabindex="0"><td class="num fuerte">${p.codigo}</td><td class="cpa-cod">${esc(p.codigo_producto || '')}</td><td class="cc-nombre" title="${esc(p.nombre)}${clas(p.clasificacion_id) ? ` · ${esc(clas(p.clasificacion_id).nombre)}` : ''}">${esc(p.nombre)}</td>
            <td title="${esc(tp?.nombre || '')}">${esc(tp ? tp.siglas || tp.nombre : '')}</td><td class="cpa-txt">${esc(nm(medidas, p.tipo_medida_id))}</td><td class="cpa-txt">${esc(nm(presentaciones, p.presentacion_id))}</td><td class="cpa-txt">${esc(nm(bodegas, p.bodega_id))}</td>
            <td class="num">${fmt.monto(p.precio_costo)}</td><td class="num">${nPrecios.get(p.id) || '<span class="tk-tenue">—</span>'}</td><td><span class="pc-marca ${p.estado === 'ACTIVO' ? 'aprobada' : p.estado === 'INACTIVO' ? 'pendiente' : 'anulada'}">${esc(p.estado)}</span></td></tr>`; }).join('')
            || `<tr><td colspan="10" class="tk-vacio"><i class="ti ti-package" aria-hidden="true"></i>${!ctx.sel.loc ? 'Elige la empresa.' : lista0.length ? 'Ninguno coincide con la búsqueda.' : `No hay artículos${ctx.admin ? ': crea el primero con «Nuevo artículo».' : '.'}`}</td></tr>`}</tbody></table></div>`;
    }
    async function abrir(p) {
      actual = p;
      otros = []; preciosProd = []; imagen = { nuevo: null, quitar: false };
      if (p) {
        const [o, r] = await Promise.all([sb.from('producto_proveedores').select('*').eq('producto_id', p.id).order('id'), sb.from('producto_precios').select('*').eq('producto_id', p.id)]);
        otros = (o.data || []).map((x) => ({ proveedor_id: x.proveedor_id, codigo_proveedor: x.codigo_proveedor, ultimo_costo: x.ultimo_costo }));
        preciosProd = r.data || [];
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-id]').forEach((tr) => tr.classList.toggle('actual', !!p && tr.dataset.id === String(p.id)));
    }
    const anterior = (v) => {
      const d = [
        v.correlativo_bodega != null && ['Correlativo bodega', v.correlativo_bodega],
        v.administracion_pm && ['Adm. punto mínimo', v.administracion_pm],
        v.revisado != null && ['Revisado', v.revisado ? 'Sí' : 'No'],
        v.covid && ['COVID', 'Sí'],
        v.critico && ['Crítico', 'Sí'],
        v.codigo_visual != null && ['Código visual', v.codigo_visual],
        v.proveedor_codigo_anterior != null && !v.proveedor_id && ['Proveedor anterior', v.proveedor_codigo_anterior],
        v.codigo_barras_anterior && v.codigo_barras_anterior !== v.codigo_barras && ['Barras anterior', v.codigo_barras_anterior],
        v.nombre_foto && ['Foto', v.nombre_foto]
      ].filter(Boolean);
      return d.length ? `<p class="cpa-anterior" title="Datos del sistema anterior"><i class="ti ti-history" aria-hidden="true"></i> ${d.map(([k, x]) => `${k}: <b>${esc(String(x))}</b>`).join(' · ')}</p>` : '';
    };
    const calcPrecio = (tp, costo) => fmt.redondear(Number(costo || 0) * (1 + Number(tp.pct_utilidad) / 100) * (1 - Number(tp.pct_descuento) / 100));

    function pintarDetalle(v0) {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-package'); return; }
      const p = actual;
      if (!p && !nuevo) { ctx.pDet.innerHTML = ctx.vacio(ctx.admin ? 'Elige un artículo o crea uno nuevo.' : 'Elige un artículo.', 'ti-package'); return; }
      const dis = ctx.admin ? '' : 'disabled';
      const v = v0 || (p ? { ...p } : { estado: 'ACTIVO', clasificacion_id: f.clasificacion ? Number(f.clasificacion) : null, tipo_producto_id: null, generico: false, punto_minimo: false, minimo: 0, maximo: 0, precio_costo: 0, presentacion_id: presentaciones.find((x) => x.activo && /SIN PRESENT/i.test(x.nombre))?.id || presentaciones.find((x) => x.activo)?.id || null, tipo_medida_id: medidas.find((x) => x.activo && /^UNIDAD/i.test(x.nombre))?.id || null, bodega_id: principal(), proveedor_id: null });
      const tiposClas = tipos.filter((t) => t.clasificacion_id === v.clasificacion_id && (t.activo || t.id === v.tipo_producto_id));
      const opt = (lista, id, txt = (x) => `${x.codigo} · ${esc(x.nombre)}`, vacio = '—') => `<option value="">${vacio}</option>${lista.filter((x) => x.activo !== false || x.id === id).filter((x) => x.estado === undefined || x.estado === 'ACTIVO' || x.id === id).map((x) => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${txt(x)}</option>`).join('')}`;
      const pv = prov(v.proveedor_id);
      const tabs = [['PRECIOS', 'Precios', 'ti-currency-dollar', preciosProd.length], ['PROVEEDORES', 'Otros proveedores', 'ti-truck', otros.length], ['IMAGEN', 'Imagen', 'ti-photo', p?.imagen_ruta || imagen.nuevo ? 1 : 0]];
      ctx.pDet.innerHTML = `
        <form class="tk-form bm-form cp-form cpr-form cpr-compacto" novalidate>
          <header class="tk-titulo bm-titulo cpr-titulo"><span class="tk-icono"><i class="ti ti-package" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>${p ? `Artículo ${p.codigo}${p.codigo_producto ? ` · ${esc(p.codigo_producto)}` : ''}` : 'Nuevo artículo'}</small><h2>${p ? esc(p.nombre) : 'Definición del artículo'}</h2></div>
            <div class="tk-marcas">${p ? `<span class="pc-marca ${p.estado === 'ACTIVO' ? 'aprobada' : 'pendiente'}">${esc(p.estado)}</span>` : ''}${p?.generico ? '<span class="pc-marca definitiva">Genérico</span>' : ''}</div>
            <div class="tk-titulo-acciones">${nuevo ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}${ctx.admin ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${p ? 'Guardar' : 'Crear artículo'}</button>` : ''}</div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          <div class="cpa-bloques">
          <section class="cpr-bloque cpa-b">
            <h3 class="cpa-tit"><i class="ti ti-package" aria-hidden="true"></i> Artículo</h3>
            <div class="cpa-g">
              <label class="campo cpa-ancho"><span>Nombre *</span><input name="nombre" value="${esc(v.nombre || '')}" maxlength="150" ${dis}></label>
              <label class="campo"><span>Código producto</span><input name="codigo_producto" value="${esc(v.codigo_producto || '')}" maxlength="40" ${dis}></label>
              <label class="campo"><span>Código de barras</span><input name="codigo_barras" value="${esc(v.codigo_barras || '')}" maxlength="40" ${dis}></label>
              <label class="campo"><span>Marca</span><input name="marca" value="${esc(v.marca || '')}" maxlength="80" ${dis}></label>
              <label class="campo" title="Sustancia activa (medicamentos) o línea del producto"><span>Principio activo</span><input name="principio_activo" value="${esc(v.principio_activo || '')}" maxlength="150" ${dis}></label>
              <label class="campo"><span>Estado</span><select name="estado" ${dis}>${['ACTIVO', 'INACTIVO', 'DESCONTINUADO'].map((e) => `<option ${v.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
              <label class="pc-check cpr-chk"><input type="checkbox" name="generico" ${v.generico ? 'checked' : ''} ${dis}> ¿Es genérico?</label>
            </div>
          </section>
          <section class="cpr-bloque cpa-b">
            <h3 class="cpa-tit"><i class="ti ti-category" aria-hidden="true"></i> Clasificación y medida</h3>
            <div class="cpa-g cpa-g1">
              <div class="campo"><span>Clasificación</span><div class="lov-campo"><select name="clasificacion_id" ${dis} aria-label="Clasificación">${opt(clasificaciones, v.clasificacion_id)}</select><button type="button" class="icono-boton lov-btn" data-lov="clasificacion" title="Lista de valores de clasificaciones" aria-label="Lista de valores de clasificaciones" ${dis}><i class="ti ti-dots" aria-hidden="true"></i></button></div></div>
              <div class="campo"><span>Tipo producto</span><div class="lov-campo"><select name="tipo_producto_id" ${dis} aria-label="Tipo producto">${opt(tiposClas, v.tipo_producto_id, (x) => `${x.codigo} · ${esc(x.nombre)}${x.siglas ? ` (${esc(x.siglas)})` : ''}`, v.clasificacion_id ? (tiposClas.length ? '—' : 'Sin tipos') : 'Elige la clasificación')}</select><button type="button" class="icono-boton lov-btn" data-lov="tipo" title="Lista de valores de tipos de producto" aria-label="Lista de valores de tipos de producto" ${dis}><i class="ti ti-dots" aria-hidden="true"></i></button></div></div>
              <div class="campo"><span>Unidad de medida</span><div class="lov-campo"><select name="tipo_medida_id" ${dis} aria-label="Unidad de medida">${opt(medidas, v.tipo_medida_id)}</select><button type="button" class="icono-boton lov-btn" data-lov="medida" title="Lista de valores de unidades de medida" aria-label="Lista de valores de unidades de medida" ${dis}><i class="ti ti-dots" aria-hidden="true"></i></button></div></div>
              <div class="campo"><span>Presentación</span><div class="lov-campo"><select name="presentacion_id" ${dis} aria-label="Presentación">${opt(presentaciones, v.presentacion_id)}</select><button type="button" class="icono-boton lov-btn" data-lov="presentacion" title="Lista de valores de presentaciones" aria-label="Lista de valores de presentaciones" ${dis}><i class="ti ti-dots" aria-hidden="true"></i></button></div></div>
              <div class="campo"><span>Proveedor principal</span><div class="lov-campo"><input list="cpr-proveedores" name="proveedor" value="${esc(pv ? provTxt(pv) : '')}" placeholder="Código, NIT o nombre" ${dis} aria-label="Proveedor principal"><button type="button" class="icono-boton lov-btn" data-lov="proveedor" title="Lista de valores de proveedores" aria-label="Lista de valores de proveedores" ${dis}><i class="ti ti-dots" aria-hidden="true"></i></button></div></div>
            </div>
          </section>
          <section class="cpr-bloque cpa-b">
            <h3 class="cpa-tit"><i class="ti ti-coin" aria-hidden="true"></i> Costo y existencias</h3>
            <div class="cpa-g">
              <label class="campo cpr-costo"><span>Precio costo Q</span><input type="number" step="0.0001" min="0" name="precio_costo" value="${esc(String(v.precio_costo ?? 0))}" ${dis}></label>
              <label class="campo" title="Costo en dólares del sistema anterior"><span>Costo US$</span><input value="${v.precio_costo_dolar != null ? fmt.monto(v.precio_costo_dolar) : ''}" placeholder="—" disabled></label>
              <label class="campo cpa-ancho"><span>Bodega</span><select name="bodega_id" ${dis}>${opt(bodegas, v.bodega_id)}</select></label>
              <label class="pc-check cpr-chk cpa-ancho"><input type="checkbox" name="punto_minimo" ${v.punto_minimo ? 'checked' : ''} ${dis}> Punto mínimo</label>
              <label class="campo"><span>Mínimo</span><input type="number" step="0.001" min="0" name="minimo" value="${esc(String(v.minimo ?? 0))}" ${dis || (v.punto_minimo ? '' : 'disabled')}></label>
              <label class="campo"><span>Máximo</span><input type="number" step="0.001" min="0" name="maximo" value="${esc(String(v.maximo ?? 0))}" ${dis || (v.punto_minimo ? '' : 'disabled')}></label>
              <div class="cpa-ubic cpa-ancho">
                <label class="campo"><span>Estante</span><input name="estante" value="${esc(v.estante || '')}" maxlength="20" ${dis}></label>
                <label class="campo"><span>Fila</span><input name="fila" value="${esc(v.fila || '')}" maxlength="20" ${dis}></label>
                <label class="campo"><span>Bloque</span><input name="bloque" value="${esc(v.bloque || '')}" maxlength="20" ${dis}></label>
              </div>
            </div>
            ${anterior(v)}
          </section>
          <section class="cpr-bloque cpa-b cpa-pest bm-pestanas cp-tabs">
            <div class="bm-tabs-barra"><div class="rp-pestanas" role="tablist">${tabs.map(([k, t, i, n]) => `<button type="button" role="tab" data-pestana="${k}" class="${pestana === k ? 'activa' : ''}" aria-selected="${pestana === k}"><i class="ti ${i}" aria-hidden="true"></i> ${t}${n ? ` <b>${n}</b>` : ''}</button>`).join('')}</div></div>
            <div class="bm-panel cp-panel" data-panel="PRECIOS" ${pestana === 'PRECIOS' ? '' : 'hidden'}>
              <div class="pc-lineas"><table><thead><tr><th>Tipo de precio</th><th class="num">% Utilidad</th><th class="num">% Descuento</th><th class="num">Precio calculado</th><th class="num">Precio del producto</th></tr></thead>
                <tbody>${precios.filter((t) => t.activo).map((t) => { const pp = preciosProd.find((x) => x.tipo_precio_id === t.id); return `<tr data-precio="${t.id}"><td class="fuerte">${t.codigo} · ${esc(t.nombre)}${t.factor === 'PRECIO FIJO' ? ' <span class="pc-tipo">Precio fijo</span>' : ''}</td><td class="num">${fmt.monto(t.pct_utilidad)}</td><td class="num">${fmt.monto(t.pct_descuento)}</td>
                  <td class="num" data-calc>${t.factor === 'NORMAL' ? fmt.monto(calcPrecio(t, v.precio_costo)) : '<span class="tk-tenue">—</span>'}</td><td class="num"><input type="number" step="0.01" min="0" data-p="${t.id}" value="${pp ? Number(pp.precio) : ''}" placeholder="${t.factor === 'NORMAL' ? 'El calculado' : 'Escribe el precio'}" ${dis} aria-label="Precio ${esc(t.nombre)}"></td></tr>`; }).join('')
                  || '<tr><td colspan="5" class="tk-vacio">No hay tipos de precio activos: defínelos en Tipos de precio.</td></tr>'}</tbody></table></div>
            </div>
            <div class="bm-panel cp-panel" data-panel="PROVEEDORES" ${pestana === 'PROVEEDORES' ? '' : 'hidden'}>
              <div class="pc-lineas"><table><thead><tr><th>Proveedor</th><th>Código del proveedor</th><th class="num">Último costo</th><th></th></tr></thead>
                <tbody>${otros.map((o, i) => `<tr data-otro="${i}"><td><input list="cpr-proveedores" data-o="proveedor" value="${esc(prov(o.proveedor_id) ? provTxt(prov(o.proveedor_id)) : o._txt || '')}" ${dis} aria-label="Proveedor"></td><td><input data-o="codigo_proveedor" value="${esc(o.codigo_proveedor || '')}" maxlength="40" ${dis} aria-label="Código del proveedor"></td><td class="num"><input type="number" step="0.0001" min="0" data-o="ultimo_costo" value="${o.ultimo_costo ?? ''}" ${dis} aria-label="Último costo"></td><td>${dis ? '' : `<button type="button" class="icono-boton" data-quitar-otro="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>`}</td></tr>`).join('')
                  || '<tr><td colspan="4" class="tk-vacio">Sin otros proveedores.</td></tr>'}</tbody></table></div>
              ${ctx.admin ? '<button type="button" class="boton secundario-sm cp-agregar" data-accion="otro"><i class="ti ti-plus" aria-hidden="true"></i> Proveedor</button>' : ''}
            </div>
            <div class="bm-panel cp-panel" data-panel="IMAGEN" ${pestana === 'IMAGEN' ? '' : 'hidden'}>
              <div class="cpr-imagen">
                <div class="cpr-marco">${imagen.nuevo || (p?.imagen_ruta && !imagen.quitar) ? '<img data-img alt="Imagen del artículo">' : '<span class="sin-imagen"><i class="ti ti-photo" aria-hidden="true"></i> Sin imagen</span>'}</div>
                ${ctx.admin ? `<div class="cpr-img-acc"><label class="boton secundario-sm"><i class="ti ti-photo-plus" aria-hidden="true"></i> ${p?.imagen_ruta || imagen.nuevo ? 'Cambiar imagen' : 'Elegir imagen'}<input type="file" accept="image/png,image/jpeg,image/webp" data-imagen hidden></label>
                  ${imagen.nuevo || (p?.imagen_ruta && !imagen.quitar) ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="quitar-imagen"><i class="ti ti-trash" aria-hidden="true"></i> Quitar</button>' : ''}
                  <small>PNG, JPG o WebP de hasta 5 MB. Se guarda al guardar el artículo.</small></div>` : ''}
              </div>
            </div>
          </section>
          </div>
          ${p ? `<p class="cc-ingreso cpr-control"><i class="ti ti-user" aria-hidden="true"></i> Creó ${esc(p.creado_por_nombre || '')} · ${esc(fmt.fechaHora(p.creado_en))}${p.modificado_en ? ` · modificó ${esc(p.modificado_por_nombre || '')} ${esc(fmt.fechaHora(p.modificado_en))}` : ''}</p>` : ''}
          <datalist id="cpr-proveedores">${proveedores.filter((x) => x.estado === 'ACTIVO').map((x) => `<option value="${esc(provTxt(x))}"></option>`).join('')}</datalist>
        </form>`;
      mostrarImagen();
    }
    async function mostrarImagen() {
      const img = ctx.pDet.querySelector('[data-img]');
      if (!img) return;
      if (imagen.nuevo) { img.src = URL.createObjectURL(imagen.nuevo); return; }
      const { data } = await sb.storage.from(BUCKET).createSignedUrl(actual.imagen_ruta, 600);
      if (data?.signedUrl && img.isConnected) img.src = data.signedUrl;
    }
    function leerOtros() {
      ctx.pDet.querySelectorAll('tr[data-otro]').forEach((tr) => {
        const o = otros[Number(tr.dataset.otro)];
        const t = tr.querySelector('[data-o=proveedor]').value;
        const p = provDe(t);
        o.proveedor_id = p ? p.id : null; o._txt = t;
        o.codigo_proveedor = tr.querySelector('[data-o=codigo_proveedor]').value.trim();
        const c = tr.querySelector('[data-o=ultimo_costo]').value;
        o.ultimo_costo = c === '' ? null : Number(c);
      });
      ctx.pDet.querySelectorAll('[data-p]').forEach((el) => {
        const id = Number(el.dataset.p);
        const i = preciosProd.findIndex((x) => x.tipo_precio_id === id);
        if (el.value === '') { if (i >= 0) preciosProd.splice(i, 1); } else if (i >= 0) preciosProd[i].precio = Number(el.value); else preciosProd.push({ tipo_precio_id: id, precio: Number(el.value) });
      });
    }
    function leer(form) {
      const el = form.elements;
      const t = (n) => el[n].value.trim() || null;
      const id = (n) => el[n].value ? Number(el[n].value) : null;
      const pv = provDe(el.proveedor.value);
      return { nombre: el.nombre.value.trim(), codigo_producto: t('codigo_producto'), clasificacion_id: id('clasificacion_id'), tipo_producto_id: id('tipo_producto_id'), estado: el.estado.value,
        marca: t('marca'), ...(actual && 'principio_activo' in actual) || t('principio_activo') ? { principio_activo: t('principio_activo') } : {}, codigo_barras: t('codigo_barras'), proveedor_id: pv ? pv.id : null, _prov: el.proveedor.value.trim(), generico: el.generico.checked,
        presentacion_id: id('presentacion_id'), tipo_medida_id: id('tipo_medida_id'), precio_costo: Number(el.precio_costo.value) || 0,
        punto_minimo: el.punto_minimo.checked, minimo: Number(el.minimo.value) || 0, maximo: Number(el.maximo.value) || 0,
        estante: t('estante'), fila: t('fila'), bloque: t('bloque'), bodega_id: id('bodega_id') };
    }
    function repintar(cambios = {}) { const form = ctx.pDet.querySelector('.cpr-form'); if (!form) return; leerOtros(); const v = { ...(actual || {}), ...leer(form), ...cambios }; delete v._prov; pintarDetalle(v); }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      leerOtros();
      const v = leer(form);
      const foco = (n, txt) => { error.textContent = txt; form.elements[n]?.focus(); };
      if (!v.nombre) return foco('nombre', 'Escribe el nombre del artículo.');
      if (v._prov && !v.proveedor_id) return foco('proveedor', 'El proveedor principal no está en el catálogo de proveedores.');
      if (v.punto_minimo && v.maximo < v.minimo) return foco('maximo', 'El máximo no puede ser menor que el mínimo.');
      const os = otros.filter((o) => o.proveedor_id || o._txt);
      const malo = os.find((o) => !o.proveedor_id);
      if (malo) { pestana = 'PROVEEDORES'; repintar(); return ctx.pDet.querySelector('.modal-error').textContent = `«${malo._txt}» no está en el catálogo de proveedores.`; }
      const ids = os.map((o) => o.proveedor_id);
      if (ids.some((x, i) => ids.indexOf(x) !== i)) { pestana = 'PROVEEDORES'; repintar(); return ctx.pDet.querySelector('.modal-error').textContent = 'Un proveedor está repetido en Otros proveedores.'; }
      const fijoSin = precios.find((t) => t.activo && t.factor === 'PRECIO FIJO' && !preciosProd.some((x) => x.tipo_precio_id === t.id));
      delete v._prov;
      error.textContent = '';
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      try {
        const r = actual ? await sb.from('productos').update(v).eq('id', actual.id).select('id').single()
          : await sb.from('productos').insert({ codigo: 0, ...v, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id').single();
        if (r.error) throw r.error;
        const pid = r.data.id;
        const d1 = await sb.from('producto_proveedores').delete().eq('producto_id', pid); if (d1.error) throw d1.error;
        if (os.length) { const x = await sb.from('producto_proveedores').insert(os.map((o) => ({ producto_id: pid, proveedor_id: o.proveedor_id, codigo_proveedor: o.codigo_proveedor || null, ultimo_costo: o.ultimo_costo }))); if (x.error) throw x.error; }
        const d2 = await sb.from('producto_precios').delete().eq('producto_id', pid); if (d2.error) throw d2.error;
        if (preciosProd.length) { const x = await sb.from('producto_precios').insert(preciosProd.map((pp) => ({ producto_id: pid, tipo_precio_id: pp.tipo_precio_id, precio: pp.precio }))); if (x.error) throw x.error; }
        let avisoImg = '';
        if (imagen.nuevo) {
          const limpio = imagen.nuevo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-60);
          const ruta = `${ctx.sel.loc}/${pid}/${Date.now()}-${limpio}`;
          const up = await sb.storage.from(BUCKET).upload(ruta, imagen.nuevo, { contentType: imagen.nuevo.type });
          if (up.error) avisoImg = ' (no se pudo subir la imagen)';
          else { await sb.from('productos').update({ imagen_ruta: ruta, imagen_nombre: imagen.nuevo.name, imagen_tipo: imagen.nuevo.type }).eq('id', pid); if (actual?.imagen_ruta) await sb.storage.from(BUCKET).remove([actual.imagen_ruta]); }
        } else if (imagen.quitar && actual?.imagen_ruta) {
          await sb.from('productos').update({ imagen_ruta: null, imagen_nombre: null, imagen_tipo: null }).eq('id', pid);
          await sb.storage.from(BUCKET).remove([actual.imagen_ruta]);
        }
        window.FIN.aviso(`${actual ? 'Artículo guardado' : 'Artículo creado'}${avisoImg}${fijoSin ? ` · falta el precio fijo de ${fijoSin.nombre}` : ''}`);
        nuevo = false;
        if (f.estado && v.estado !== f.estado) { f.estado = ''; pintarFiltros(); }
        await consultar(pid);
      } catch (err) {
        error.textContent = /codigo_producto_key/.test(err.message || '') ? 'Ese código de producto ya es de otro artículo.' : /codigo_barras_key/.test(err.message || '') ? 'Ese código de barras ya es de otro artículo.' : window.UI.traducirError(err);
      } finally { boton.disabled = false; }
    }

    function listado() {
      if (!lista0.length) return window.FIN.aviso('No hay artículos con esos filtros');
      const emp = ctx.localidad(ctx.sel.loc);
      const nom = (l, id) => l.find((x) => x.id === id)?.nombre || '';
      const cab = ['Artículo', 'Nombre', 'Código producto', 'Clasificación', 'Tipo', 'Marca', 'Presentación', 'Medida', 'Costo Q', 'Mínimo', 'Máximo', 'Bodega', 'Estado'];
      const datos = lista0.map((p) => [p.codigo, p.nombre, p.codigo_producto, nom(clasificaciones, p.clasificacion_id), nom(tipos, p.tipo_producto_id), p.marca, nom(presentaciones, p.presentacion_id), nom(medidas, p.tipo_medida_id), fmt.monto(p.precio_costo), p.punto_minimo ? p.minimo : '', p.punto_minimo ? p.maximo : '', nom(bodegas, p.bodega_id), p.estado]);
      if (f.formato === 'EXCEL') return window.COMPRAS_CAT.descargarCsv(`articulos_${emp?.codigo || ''}_${fmt.hoy()}.csv`, [cab, ...datos]);
      imprimir('Artículos', `<h1>Definición de artículos</h1><h2>${esc(emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '')} · ${lista0.length} artículos${f.clasificacion ? ` · ${esc(nom(clasificaciones, Number(f.clasificacion)))}` : ''}</h2>
        <table><thead><tr>${cab.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${datos.map((d) => `<tr>${d.map((x) => `<td>${esc(String(x ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargarLocalidad();
      if (cambio === 'otro') { if (e.target.name === 'formato') { f.formato = e.target.value; return; } f[e.target.name] = e.target.value; return consultar(); }
      const form = e.target.closest('.cpr-form');
      if (!form) return;
      if (e.target.name === 'clasificacion_id') return repintar({ tipo_producto_id: null });
      if (e.target.name === 'punto_minimo') return repintar();
      if (e.target.name === 'precio_costo') { const c = Number(e.target.value) || 0; form.querySelectorAll('tr[data-precio]').forEach((tr) => { const t = precios.find((x) => x.id === Number(tr.dataset.precio)); if (t?.factor === 'NORMAL') tr.querySelector('[data-calc]').textContent = fmt.monto(calcPrecio(t, c)); }); }
      if (e.target.matches('[data-imagen]')) {
        const a = e.target.files[0];
        if (!a) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(a.type)) return window.FIN.aviso('La imagen debe ser PNG, JPG o WebP');
        if (a.size > 5 * 1024 * 1024) return window.FIN.aviso('La imagen pasa de 5 MB');
        imagen = { nuevo: a, quitar: false };
        return repintar();
      }
    });
    cont.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar]')) { buscar = e.target.value; const pos = e.target.selectionStart; pintarLista(); const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos); return; }
      if (e.target.name === 'precio_costo') e.target.dispatchEvent(new Event('change', { bubbles: true }));
    });
    cont.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-buscar]')) e.preventDefault(); });
    cont.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-pestana]');
      if (tab) { pestana = tab.dataset.pestana; ctx.pDet.querySelectorAll('[data-pestana]').forEach((b) => { b.classList.toggle('activa', b === tab); b.setAttribute('aria-selected', b === tab); }); ctx.pDet.querySelectorAll('[data-panel]').forEach((x) => { x.hidden = x.dataset.panel !== pestana; }); return; }
      const fila = e.target.closest('tr[data-id]');
      if (fila && ctx.pMae.contains(fila)) { nuevo = false; return abrir(lista0.find((p) => String(p.id) === fila.dataset.id)); }
      const q = e.target.closest('[data-quitar-otro]');
      if (q) { leerOtros(); otros.splice(Number(q.dataset.quitarOtro), 1); return repintar(); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'nuevo') { nuevo = true; actual = null; otros = []; preciosProd = []; imagen = { nuevo: null, quitar: false }; pestana = 'PRECIOS'; ctx.pMae.querySelectorAll('tr.actual').forEach((tr) => tr.classList.remove('actual')); pintarDetalle(); return ctx.pDet.querySelector('[name=nombre]')?.focus(); }
      if (a === 'cancelar') { nuevo = false; return abrir(lista0[0] || null); }
      if (a === 'imprimir') return listado();
      if (a === 'otro') { leerOtros(); otros.push({ proveedor_id: null, codigo_proveedor: '', ultimo_costo: null }); return repintar(); }
      if (a === 'quitar-imagen') { imagen = { nuevo: null, quitar: true }; return repintar(); }
      const lv = e.target.closest('[data-lov]');
      if (lv) return abrirLov(lv.dataset.lov);
    });
    // Lista de valores de clasificación, tipo, proveedor, presentación y medida.
    async function abrirLov(que) {
      const form = ctx.pDet.querySelector('.cpr-form');
      leerOtros();
      const v = leer(form);
      const nuevaEn = (tabla, extra = {}) => async (d) => {
        const r = await sb.from(tabla).insert({ codigo: 0, ...d, ...extra, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('*').single();
        if (r.error) throw r.error;
        return r.data;
      };
      const activos = (l) => l.filter((x) => x.activo !== false && (x.estado === undefined || x.estado === 'ACTIVO'));
      let cfg;
      if (que === 'clasificacion') cfg = { titulo: 'Clasificaciones', columnas: ['#', 'Descripción', 'Tipo'], filas: activos(clasificaciones).map((x) => ({ id: x.id, celdas: [x.codigo, x.nombre, x.tipo] })), actual: v.clasificacion_id,
        crear: ctx.admin && { campos: [{ k: 'nombre', t: 'Descripción', req: true }], guardar: async (d) => { const x = await nuevaEn('clasificaciones_producto')(d); clasificaciones.push(x); return x.id; } },
        aplicar: (id) => ({ clasificacion_id: id, tipo_producto_id: null }) };
      if (que === 'tipo') {
        if (!v.clasificacion_id) return window.FIN.aviso('Elige primero la clasificación');
        cfg = { titulo: `Tipos de producto · ${clas(v.clasificacion_id)?.nombre || ''}`, columnas: ['Tipo', 'Siglas', 'Descripción'], filas: activos(tipos.filter((t) => t.clasificacion_id === v.clasificacion_id)).map((x) => ({ id: x.id, celdas: [x.codigo, x.siglas, x.nombre] })), actual: v.tipo_producto_id,
          crear: ctx.admin && { campos: [{ k: 'siglas', t: 'Siglas', max: 6 }, { k: 'nombre', t: 'Descripción', req: true }], guardar: async (d) => { if (d.siglas && !/^[A-Za-z0-9]{1,6}$/.test(d.siglas)) throw new Error('Las siglas son de 1 a 6 letras o números.'); const x = await nuevaEn('tipos_producto', { clasificacion_id: v.clasificacion_id, siglas: d.siglas || null })({ nombre: d.nombre }); tipos.push(x); return x.id; } },
          aplicar: (id) => ({ tipo_producto_id: id }) };
      }
      if (que === 'proveedor') cfg = { titulo: 'Proveedores', columnas: ['Código', 'NIT', 'Nombre comercial'], filas: activos(proveedores).map((x) => ({ id: x.id, celdas: [x.codigo, x.nit, x.nombre_comercial] })), actual: v.proveedor_id,
        crear: ctx.admin && { campos: [{ k: 'nit', t: 'NIT', max: 20 }, { k: 'nombre_comercial', t: 'Nombre comercial', req: true, max: 150 }], guardar: async (d) => { const r = await sb.from('proveedores').insert({ nit: d.nit || null, nombre_comercial: d.nombre_comercial, concepto_gastos: 'COMPRAS DE PRODUCTOS', organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id, codigo, nit, nombre_comercial, estado').single(); if (r.error) throw r.error; proveedores.push(r.data); return r.data.id; } },
        aplicar: (id) => ({ proveedor_id: id }) };
      if (que === 'presentacion') cfg = { titulo: 'Presentaciones de productos', columnas: ['#', 'Descripción'], filas: activos(presentaciones).map((x) => ({ id: x.id, celdas: [x.codigo, x.nombre] })), actual: v.presentacion_id,
        crear: ctx.admin && { campos: [{ k: 'nombre', t: 'Descripción', req: true }], guardar: async (d) => { const x = await nuevaEn('presentaciones_producto')(d); presentaciones.push(x); return x.id; } },
        aplicar: (id) => ({ presentacion_id: id }) };
      if (que === 'medida') cfg = { titulo: 'Tipos de medida', columnas: ['Tipo', 'Descripción'], filas: activos(medidas).map((x) => ({ id: x.id, celdas: [x.codigo, x.nombre] })), actual: v.tipo_medida_id,
        crear: ctx.admin && { campos: [{ k: 'nombre', t: 'Descripción', req: true }], guardar: async (d) => { const x = await nuevaEn('tipos_medida')(d); medidas.push(x); return x.id; } },
        aplicar: (id) => ({ tipo_medida_id: id }) };
      if (!cfg.crear) delete cfg.crear;
      const id = await listaValores(cfg);
      if (id) repintar(cfg.aplicar(id));
    }
    cont.addEventListener('submit', (e) => { if (e.target.matches('.cpr-form')) { e.preventDefault(); guardar(e.target); } });
    iniciar();
  };
})();
