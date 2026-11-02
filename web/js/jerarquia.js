// Árbol jerárquico en tres bloques (maestro → detalle → detalle), usado por cuentas contables
// y centros de costo. Se carga todo el árbol de una vez y se navega en memoria: cada bloque
// muestra un nivel y los hijos del registro elegido en el bloque anterior. Con "Bajar nivel"
// y "Subir nivel" la ventana de tres bloques se mueve por niveles más profundos.
(function () {
  const { esc, tabla, formulario, filtrar } = window.UI;

  // cfg: { tabla, padre, select, filtro, titulos[], etiquetaCodigo, etiquetaMayor, editable,
  //        columnas(fila), ficha(fila), campos(fila, mayor), valores(mayor, hermanos), antesDeGuardar(d, fila, mayor) }
  window.Jerarquia = function (cont, cfg) {
    const sb = window.FIN.sb;
    const estado = { filas: [], ruta: [], base: 1, buscar: {} };
    const hijos = (id) => estado.filas.filter((f) => (f[cfg.padre] ?? null) === id);
    const porId = (id) => estado.filas.find((f) => f.id === id);
    const titulo = (nivel) => cfg.titulos[nivel - 1] || `Nivel ${nivel}`;

    async function cargar(seleccion) {
      let q = sb.from(cfg.tabla).select(cfg.select || '*').order('codigo');
      for (const [k, v] of Object.entries(cfg.filtro)) q = q.eq(k, v);
      const { data, error } = await q;
      if (error) { cont.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      estado.filas = data.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
      if (seleccion) seleccionar(seleccion, true);
      completarRuta();
      pintar();
    }

    // La ruta guarda el registro elegido en cada nivel (índice 0 = nivel 1).
    function seleccionar(id, ajustarVentana) {
      const cadena = [];
      for (let f = porId(id); f; f = porId(f[cfg.padre])) cadena.unshift(f.id);
      estado.ruta = cadena;
      if (ajustarVentana) {
        const nivel = cadena.length;
        if (nivel < estado.base) estado.base = nivel;
        if (nivel > estado.base + 2) estado.base = nivel - 2;
      }
    }

    // Elige el primer hijo en los niveles visibles que aún no tienen selección.
    function completarRuta() {
      estado.ruta = estado.ruta.filter((id) => porId(id));
      for (let n = estado.ruta.length + 1; n <= estado.base + 2; n++) {
        const lista = hijos(n === 1 ? null : estado.ruta[n - 2]);
        if (!lista.length) break;
        estado.ruta[n - 1] = lista[0].id;
      }
    }

    function pintar() {
      const bloques = [];
      for (let i = 0; i < 3; i++) {
        const nivel = estado.base + i;
        const idMayor = nivel === 1 ? null : estado.ruta[nivel - 2];
        if (nivel > 1 && !idMayor) break;
        bloques.push(bloque(nivel, idMayor, i));
      }
      const camino = estado.ruta.map(porId).filter(Boolean);
      cont.innerHTML = `
        <div class="ruta-arbol">
          <span>Ruta:</span>
          ${camino.length ? camino.map((f) => `<button type="button" class="miga" data-ir="${f.id}">${esc(f.codigo)} · ${esc(f.nombre)}</button>`).join('<i class="ti ti-chevron-right" aria-hidden="true"></i>') : '<em>sin registros</em>'}
        </div>
        ${bloques.join('')}`;
      for (let i = 0; i < bloques.length; i++) {
        const b = cont.querySelector(`[data-bloque="${estado.base + i}"]`);
        if (b) filtrar(b, estado.buscar[estado.base + i] || '');
      }
    }

    function bloque(nivel, idMayor, posicion) {
      const lista = hijos(idMayor);
      const mayor = idMayor && porId(idMayor);
      const sel = porId(estado.ruta[nivel - 1]);
      const puedeBajar = posicion === 2 && sel;
      return `
        <section class="panel bloque" data-bloque="${nivel}">
          <div class="panel-cab">
            <h2>${esc(titulo(nivel))}${mayor ? ` <small>de ${esc(mayor.codigo)} · ${esc(mayor.nombre)}</small>` : ''}</h2>
            <div class="panel-acciones">
              ${posicion === 0 && estado.base > 1 ? '<button type="button" class="boton secundario-sm" data-accion="subir"><i class="ti ti-arrow-up" aria-hidden="true"></i> Subir nivel</button>' : ''}
              ${puedeBajar ? '<button type="button" class="boton secundario-sm" data-accion="bajar">Bajar nivel <i class="ti ti-arrow-down" aria-hidden="true"></i></button>' : ''}
              ${cfg.editable ? `<button type="button" class="boton primario-sm" data-accion="nuevo" data-nivel="${nivel}">+ ${esc(titulo(nivel))}</button>` : ''}
            </div>
          </div>
          ${lista.length > 8 ? `<input type="search" class="buscar" data-buscar="${nivel}" placeholder="Buscar en ${esc(titulo(nivel).toLowerCase())}" value="${esc(estado.buscar[nivel] || '')}">` : ''}
          <div class="bloque-cuerpo">
            ${tabla({
              id: `nivel-${nivel}`, editable: cfg.editable, seleccionado: sel && sel.id,
              vacio: mayor ? `${mayor.codigo} · ${mayor.nombre} todavía no tiene registros en este nivel.` : 'Todavía no hay registros. Crea el primero.',
              columnas: [
                { titulo: cfg.etiquetaCodigo, valor: (f) => `<span class="codigo">${esc(f.codigo)}</span>`, clase: 'codigo-col' },
                { titulo: 'Nombre', valor: (f) => esc(f.nombre), clase: 'fuerte' },
                { titulo: cfg.etiquetaMayor, valor: (f) => esc((porId(f[cfg.padre]) || {}).codigo || '') },
                ...cfg.columnas,
                { titulo: 'Niveles abajo', valor: (f) => hijos(f.id).length || '—', clase: 'centrada' }
              ],
              filas: lista
            })}
            <aside class="ficha">${sel ? ficha(sel) : '<p class="vacio">Sin selección</p>'}</aside>
          </div>
        </section>`;
    }

    function ficha(f) {
      return `
        ${cfg.ficha(f)}
        <div class="ficha-dato"><span>Nivel</span><b>${f.nivel}</b></div>
        <div class="ficha-dato"><span>Vigente</span><b><span class="estado ${f.vigente ? 'activo' : 'inactivo'}">${f.vigente ? 'Sí' : 'No'}</span></b></div>
        <p class="ficha-auditoria">Grabado por <b>${esc(f.creado_por_nombre || 'sistema')}</b> el ${window.UI.fecha(f.creado_en)}
          ${f.modificado_en ? `<br>Modificado por <b>${esc(f.modificado_por_nombre || 'sistema')}</b> el ${window.UI.fecha(f.modificado_en)}` : ''}</p>`;
    }

    function abrirFormulario(fila, nivel) {
      const mayor = fila ? porId(fila[cfg.padre]) : (nivel === 1 ? null : porId(estado.ruta[nivel - 2]));
      const nombreNivel = titulo(fila ? fila.nivel : nivel);
      formulario({
        titulo: fila ? `Modificar ${nombreNivel.toLowerCase()} · ${fila.codigo}` : `Nueva ${nombreNivel.toLowerCase()}${mayor ? ` de ${mayor.codigo} · ${mayor.nombre}` : ''}`,
        valores: fila || cfg.valores(mayor, hijos(mayor ? mayor.id : null)),
        campos: cfg.campos(fila, mayor),
        alGuardar: async (d) => {
          if (fila) delete d.codigo;
          else Object.assign(d, cfg.filtro, { [cfg.padre]: mayor ? mayor.id : null });
          if (cfg.antesDeGuardar) cfg.antesDeGuardar(d, fila, mayor);
          const r = fila ? await sb.from(cfg.tabla).update(d).eq('id', fila.id).select('id').single()
                         : await sb.from(cfg.tabla).insert(d).select('id').single();
          if (r.error) throw r.error;
          window.FIN.aviso('Registro guardado');
          await cargar(r.data.id);
        }
      });
    }

    // ---------- Eventos ----------
    cont.addEventListener('click', (e) => {
      const ir = e.target.closest('[data-ir]');
      if (ir) { seleccionar(Number(ir.dataset.ir), true); completarRuta(); return pintar(); }
      const accion = e.target.closest('[data-accion]');
      if (accion) {
        const a = accion.dataset.accion;
        if (a === 'nuevo') abrirFormulario(null, Number(accion.dataset.nivel));
        if (a === 'subir' && estado.base > 1) { estado.base--; pintar(); }
        if (a === 'bajar') { estado.base++; completarRuta(); pintar(); }
        return;
      }
      const ed = e.target.closest('[data-editar]');
      if (ed) return abrirFormulario(porId(Number(ed.dataset.editar)));
      const tr = e.target.closest('tr[data-id]');
      if (tr && !tr.classList.contains('seleccionada')) {
        seleccionar(Number(tr.dataset.id), false);
        completarRuta();
        pintar();
      }
    });
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('tr[data-id]')) e.target.click();
    });
    cont.addEventListener('input', (e) => {
      const n = e.target.dataset.buscar;
      if (!n) return;
      estado.buscar[n] = e.target.value;
      filtrar(e.target.closest('.panel'), e.target.value);
    });

    cargar();
    return { recargar: () => cargar(), filas: () => estado.filas };
  };

  // Código sugerido para un hijo: código del mayor + correlativo de 2 dígitos (1 → 101, 102…).
  window.Jerarquia.siguienteCodigo = function (mayor, hermanos) {
    if (!mayor) return String(Math.max(0, ...hermanos.map((h) => Number(h.codigo) || 0)) + 1);
    const sufijos = hermanos.map((h) => Number(h.codigo.slice(mayor.codigo.length)) || 0);
    return mayor.codigo + String(Math.max(0, ...sufijos) + 1).padStart(2, '0');
  };
})();
