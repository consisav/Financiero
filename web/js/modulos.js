// Catálogos · Iniciales · Módulos (vista dividida): lista de módulos principales a la izquierda y,
// a la derecha, la ficha del módulo elegido con sus sub-módulos.
(function () {
  const { esc, tabla, formulario, filtrar } = window.UI;

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS.modulos = function (cont) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    const estado = { filas: [], sel: null, buscar: '', buscarSub: '' };
    const principales = () => estado.filas.filter((f) => !f.modulo_mayor_id);
    const subDe = (id) => estado.filas.filter((f) => f.modulo_mayor_id === id);
    const porId = (id) => estado.filas.find((f) => f.id === id);

    cont.innerHTML = `
      <div class="md-barra" id="md-barra"></div>
      <div class="rm-grid md-grid">
        <aside class="panel rm-roles" id="md-lista"></aside>
        <section class="panel md-detalle" id="md-detalle"></section>
      </div>`;
    const pBarra = cont.querySelector('#md-barra');
    const pLista = cont.querySelector('#md-lista');
    const pDet = cont.querySelector('#md-detalle');

    async function cargar(seleccion) {
      const { data, error } = await sb.from('modulos_sistema').select('*').order('codigo');
      if (error) {
        cont.innerHTML = /modulos_sistema/.test(error.message)
          ? '<p class="vacio">Falta instalar en Supabase el script <b>20261102000010_modulos_del_sistema.sql</b>.</p>'
          : `<p class="vacio">${esc(error.message)}</p>`;
        return;
      }
      estado.filas = data;
      const previo = seleccion || (estado.sel && estado.sel.id);
      estado.sel = principales().find((f) => f.id === previo) || principales()[0] || null;
      pintar();
    }

    function pintarBarra() {
      const p = principales();
      const subs = estado.filas.length - p.length;
      const activos = estado.filas.filter((f) => f.activo).length;
      pBarra.innerHTML = `
        <div class="rm-stats" role="list" aria-label="Resumen de módulos">
          <span class="rm-stat" role="listitem"><i class="ti ti-apps" aria-hidden="true"></i><b>${p.length}</b> módulos</span>
          <span class="rm-stat" role="listitem"><i class="ti ti-subtask" aria-hidden="true"></i><b>${subs}</b> sub-módulos</span>
          <span class="rm-stat" role="listitem"><i class="ti ti-circle-check" aria-hidden="true"></i><b>${activos}</b> activos</span>
          ${estado.filas.length - activos ? `<span class="rm-stat aviso" role="listitem"><i class="ti ti-circle-off" aria-hidden="true"></i><b>${estado.filas.length - activos}</b> inactivos</span>` : ''}
        </div>
        ${editable ? '<button type="button" class="boton primario-sm" data-accion="nuevo-modulo">+ Módulo</button>' : ''}`;
    }

    function pintarLista() {
      const q = estado.buscar.trim().toLowerCase();
      const lista = principales().filter((m) => !q || [m.descripcion, m.siglas, String(m.codigo)].some((t) => t.toLowerCase().includes(q))
        || subDe(m.id).some((s) => s.descripcion.toLowerCase().includes(q) || s.siglas.toLowerCase().includes(q)));
      pLista.innerHTML = `
        <div class="panel-cab"><h2>Módulos principales</h2></div>
        <input type="search" class="buscar" data-buscar placeholder="Buscar módulo o sub-módulo" value="${esc(estado.buscar)}">
        <ul class="rm-lista">
          ${lista.map((m) => `
            <li><button type="button" class="rm-rol md-item ${estado.sel && m.id === estado.sel.id ? 'activo' : ''} ${m.activo ? '' : 'apagado'}" data-mod="${m.id}">
              <span class="siglas">${esc(m.siglas)}</span>
              <span class="rm-rol-nombre">${esc(m.descripcion)}<small class="md-cod">Código ${m.codigo}${m.activo ? '' : ' · inactivo'}</small></span>
              <span class="rm-rol-cuenta" title="Sub-módulos">${subDe(m.id).length}</span>
            </button></li>`).join('') || '<li class="vacio">Sin coincidencias</li>'}
        </ul>`;
    }

    function pintarDetalle() {
      const m = estado.sel;
      if (!m) {
        pDet.innerHTML = `<div class="md-vacio"><i class="ti ti-apps" aria-hidden="true"></i><h2>Crea el primer módulo</h2><p>Los módulos principales agrupan las pantallas del sistema.</p>${editable ? '<button type="button" class="boton primario-sm" data-accion="nuevo-modulo">+ Módulo</button>' : ''}</div>`;
        return;
      }
      const subs = subDe(m.id);
      const q = estado.buscarSub.trim().toLowerCase();
      pDet.innerHTML = `
        <div class="md-ficha">
          <span class="md-siglas">${esc(m.siglas)}</span>
          <div class="md-ficha-texto">
            <h2>${esc(m.descripcion)}</h2>
            <p>Código <b>${m.codigo}</b> · ${window.UI.estado(m.activo)} · ${subs.length} sub-módulo${subs.length === 1 ? '' : 's'}
              · Grabado por <b>${esc(m.creado_por_nombre || 'sistema')}</b>${m.modificado_en ? ` · modificado por <b>${esc(m.modificado_por_nombre || 'sistema')}</b> el ${window.UI.fecha(m.modificado_en).slice(0, 10)}` : ''}</p>
          </div>
          <div class="panel-acciones">
            ${editable ? '<button type="button" class="boton secundario-sm" data-accion="modificar-modulo"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}
            ${editable ? '<button type="button" class="boton primario-sm" data-accion="nuevo-sub">+ Sub-módulo</button>' : ''}
          </div>
        </div>
        <div class="panel-cab md-subcab">
          <h2>Sub-módulos</h2>
          ${subs.length > 6 ? `<input type="search" class="buscar" data-buscar-sub placeholder="Buscar sub-módulo" value="${esc(estado.buscarSub)}">` : ''}
        </div>
        ${tabla({
          id: 'sub', editable, vacio: `${m.descripcion} todavía no tiene sub-módulos.${editable ? ' Agrega el primero con «+ Sub-módulo».' : ''}`,
          columnas: [
            { titulo: 'Código', valor: (f) => `<span class="codigo">${f.codigo}</span>`, clase: 'angosta' },
            { titulo: 'Siglas', valor: (f) => `<span class="siglas">${esc(f.siglas)}</span>`, clase: 'angosta' },
            { titulo: 'Descripción', valor: (f) => esc(f.descripcion), clase: 'fuerte' },
            { titulo: 'Grabado por', valor: (f) => esc(f.creado_por_nombre || 'sistema') },
            { titulo: 'Estado', valor: (f) => window.UI.estado(f.activo) }
          ],
          filas: subs
        })}`;
      if (q) filtrar(pDet, q);
    }

    function pintar() { pintarBarra(); pintarLista(); pintarDetalle(); }

    function form(fila, mayor) {
      const esSub = fila ? !!fila.modulo_mayor_id : !!mayor;
      const padre = fila ? porId(fila.modulo_mayor_id) : mayor;
      const hermanos = esSub ? subDe(padre.id) : principales();
      // Código sugerido: siguiente libre (sub-módulos: código del mayor × 100 + correlativo).
      const base = esSub ? padre.codigo * 100 : 0;
      const usados = new Set(estado.filas.map((f) => f.codigo));
      let sugerido = Math.max(base, ...hermanos.map((h) => h.codigo)) + 1;
      while (usados.has(sugerido)) sugerido++;
      formulario({
        titulo: fila ? `Modificar ${esSub ? 'sub-módulo' : 'módulo'} · ${fila.descripcion}` : esSub ? `Nuevo sub-módulo de ${padre.descripcion}` : 'Nuevo módulo principal',
        valores: fila || { codigo: sugerido, activo: true },
        campos: [
          { nombre: 'codigo', etiqueta: 'Módulo (código)', tipo: 'numero', requerido: true },
          { nombre: 'siglas', etiqueta: 'Siglas', requerido: true, patron: '[A-Za-z0-9]{2,6}', max: 6, placeholder: 'CON' },
          { nombre: 'descripcion', etiqueta: 'Descripción', requerido: true, ancho: 'completo' },
          { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla' }
        ],
        alGuardar: async (d) => {
          d.siglas = d.siglas.toUpperCase();
          d.descripcion = d.descripcion.toUpperCase();
          if (!fila && esSub) d.modulo_mayor_id = padre.id;
          const r = fila ? await sb.from('modulos_sistema').update(d).eq('id', fila.id).select('id').single()
                         : await sb.from('modulos_sistema').insert(d).select('id').single();
          if (r.error) {
            if (/modulos_sistema_siglas/.test(r.error.message)) throw new Error(`Ya existen las siglas ${d.siglas} en este nivel.`);
            if (/modulos_sistema_codigo_key/.test(r.error.message)) throw new Error(`Ya existe un módulo con el código ${d.codigo}.`);
            throw r.error;
          }
          window.FIN.aviso(esSub ? 'Sub-módulo guardado' : 'Módulo guardado');
          await cargar(esSub ? padre.id : r.data.id);
        }
      });
    }

    cont.addEventListener('click', (e) => {
      const a = e.target.closest('[data-accion]');
      if (a) {
        if (a.dataset.accion === 'nuevo-modulo') form(null, null);
        if (a.dataset.accion === 'modificar-modulo') form(estado.sel);
        if (a.dataset.accion === 'nuevo-sub') form(null, estado.sel);
        return;
      }
      const ed = e.target.closest('[data-editar]');
      if (ed) return form(porId(Number(ed.dataset.editar)));
      const b = e.target.closest('[data-mod]');
      if (b && Number(b.dataset.mod) !== (estado.sel && estado.sel.id)) {
        estado.sel = porId(Number(b.dataset.mod));
        estado.buscarSub = '';
        pintarLista();
        pintarDetalle();
      }
    });
    cont.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar]')) {
        estado.buscar = e.target.value;
        pintarLista();
        const el = cont.querySelector('[data-buscar]');
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
      if (e.target.matches('[data-buscar-sub]')) {
        estado.buscarSub = e.target.value;
        filtrar(pDet, estado.buscarSub);
      }
    });

    cargar();
  };
})();
