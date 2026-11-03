// Catálogos · Iniciales · Módulos: maestro (módulo principal) → detalle (sub-módulos).
(function () {
  const { esc, tabla, formulario, filtrar } = window.UI;

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS.modulos = function (cont) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    const estado = { filas: [], sel: null, buscar: '' };
    const principales = () => estado.filas.filter((f) => !f.modulo_mayor_id);
    const subDe = (id) => estado.filas.filter((f) => f.modulo_mayor_id === id);
    const porId = (id) => estado.filas.find((f) => f.id === id);

    cont.innerHTML = '<section class="panel" id="p-modulos"></section><section class="panel" id="p-sub"></section>';
    const pMod = cont.querySelector('#p-modulos');
    const pSub = cont.querySelector('#p-sub');

    async function cargar(seleccion) {
      const { data, error } = await sb.from('modulos_sistema').select('*').order('codigo');
      if (error) {
        pMod.innerHTML = /modulos_sistema/.test(error.message)
          ? '<p class="vacio">Falta instalar en Supabase el script <b>20261102000010_modulos_del_sistema.sql</b>.</p>'
          : `<p class="vacio">${esc(error.message)}</p>`;
        pSub.innerHTML = '';
        return;
      }
      estado.filas = data;
      const previo = seleccion || (estado.sel && estado.sel.id);
      estado.sel = principales().find((f) => f.id === previo) || principales()[0] || null;
      pintar();
    }

    function pintar() {
      pMod.innerHTML = `
        <div class="panel-cab">
          <h2>Módulo principal</h2>
          <div class="panel-acciones">${editable ? '<button type="button" class="boton primario-sm" data-accion="nuevo-modulo">+ Módulo</button>' : ''}</div>
        </div>
        <input type="search" class="buscar" data-buscar placeholder="Buscar módulo" value="${esc(estado.buscar)}">
        ${tabla({
          id: 'principales', editable, seleccionado: estado.sel && estado.sel.id, vacio: 'Todavía no hay módulos.',
          columnas: [
            { titulo: 'Módulo', valor: (f) => `<span class="codigo">${f.codigo}</span>`, clase: 'angosta' },
            { titulo: 'Siglas', valor: (f) => `<span class="siglas">${esc(f.siglas)}</span>`, clase: 'angosta' },
            { titulo: 'Descripción', valor: (f) => esc(f.descripcion), clase: 'fuerte' },
            { titulo: 'Sub-módulos', valor: (f) => subDe(f.id).length || '—', clase: 'centrada' },
            { titulo: 'Estado', valor: (f) => window.UI.estado(f.activo) }
          ],
          filas: principales()
        })}`;
      filtrar(pMod, estado.buscar);

      const m = estado.sel;
      pSub.innerHTML = m ? `
        <div class="panel-cab">
          <h2>Sub-módulos de ${m.codigo} · ${esc(m.descripcion)}</h2>
          <div class="panel-acciones">${editable ? '<button type="button" class="boton primario-sm" data-accion="nuevo-sub">+ Sub-módulo</button>' : ''}</div>
        </div>
        ${tabla({
          id: 'sub', editable, vacio: `${m.descripcion} todavía no tiene sub-módulos.`,
          columnas: [
            { titulo: 'Módulo', valor: (f) => `<span class="codigo">${f.codigo}</span>`, clase: 'angosta' },
            { titulo: 'Siglas', valor: (f) => `<span class="siglas">${esc(f.siglas)}</span>`, clase: 'angosta' },
            { titulo: 'Descripción', valor: (f) => esc(f.descripcion), clase: 'fuerte' },
            { titulo: 'Módulo mayor', valor: () => `<span class="codigo">${m.codigo}</span> ${esc(m.siglas)}` },
            { titulo: 'Estado', valor: (f) => window.UI.estado(f.activo) }
          ],
          filas: subDe(m.id)
        })}` : '';
    }

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
        if (a.dataset.accion === 'nuevo-sub') form(null, estado.sel);
        return;
      }
      const ed = e.target.closest('[data-editar]');
      if (ed) return form(porId(Number(ed.dataset.editar)));
      const tr = e.target.closest('table[data-tabla=principales] tr[data-id]');
      if (tr && Number(tr.dataset.id) !== (estado.sel && estado.sel.id)) {
        estado.sel = porId(Number(tr.dataset.id));
        pintar();
      }
    });
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('tr[data-id]')) e.target.click();
    });
    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-buscar]')) return;
      estado.buscar = e.target.value;
      filtrar(pMod, estado.buscar);
    });

    cargar();
  };
})();
