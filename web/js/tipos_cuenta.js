// Contabilidad · Tipos de cuentas: naturaleza (debe-haber / haber-debe) y efecto en el resultado del ejercicio.
(function () {
  const { esc, tabla, formulario, filtrar } = window.UI;

  const OPERACIONES = [{ valor: 'DEBE-HABER', texto: 'DEBE - HABER' }, { valor: 'HABER-DEBE', texto: 'HABER - DEBE' }];
  const RESULTADOS = ['NINGUNA', 'SUMAR', 'RESTAR'].map((v) => ({ valor: v, texto: v }));
  const marca = (si) => si ? '<i class="ti ti-square-check marca-si" aria-label="Sí"></i>' : '<i class="ti ti-square marca-no" aria-label="No"></i>';

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['tipos-cuenta'] = function (cont) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    let filas = [];
    let buscar = '';

    cont.innerHTML = '<section class="panel" id="p-tipos"></section>';
    const panel = cont.querySelector('#p-tipos');

    async function cargar() {
      const { data, error } = await sb.from('tipos_cuenta').select('*').order('codigo');
      if (error) { panel.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      filas = data;
      panel.innerHTML = `
        <div class="panel-cab">
          <h2>Tipos de cuentas contables</h2>
          <div class="panel-acciones">${editable ? '<button type="button" class="boton primario-sm" data-accion="nuevo">+ Tipo de cuenta</button>' : ''}</div>
        </div>
        <input type="search" class="buscar" data-buscar placeholder="Buscar tipo de cuenta" value="${esc(buscar)}">
        ${tabla({
          id: 'tipos', editable, vacio: 'Todavía no hay tipos de cuenta.',
          columnas: [
            { titulo: 'Tipo', valor: (f) => f.codigo, clase: 'angosta' },
            { titulo: 'Descripción', valor: (f) => esc(f.descripcion), clase: 'fuerte' },
            { titulo: 'Tipo de operación', valor: (f) => esc(f.tipo_operacion.replace('-', ' - ')) },
            { titulo: 'Operación resultado ejercicio', valor: (f) => esc(f.operacion_resultado) },
            { titulo: 'Incluye centro de costo', valor: (f) => marca(f.incluye_centro_costo), clase: 'centrada' },
            { titulo: 'Estado', valor: (f) => window.UI.estado(f.activo) }
          ],
          filas
        })}`;
      filtrar(panel, buscar);
    }

    function form(fila) {
      formulario({
        titulo: fila ? `Modificar tipo de cuenta · ${fila.descripcion}` : 'Nuevo tipo de cuenta',
        valores: fila || { codigo: Math.max(0, ...filas.map((x) => x.codigo)) + 1, tipo_operacion: 'DEBE-HABER', operacion_resultado: 'NINGUNA', activo: true },
        campos: [
          { nombre: 'codigo', etiqueta: 'Tipo', tipo: 'numero', requerido: true },
          { nombre: 'descripcion', etiqueta: 'Descripción', requerido: true },
          { nombre: 'tipo_operacion', etiqueta: 'Tipo de operación', tipo: 'select', opciones: OPERACIONES, requerido: true },
          { nombre: 'operacion_resultado', etiqueta: 'Operación resultado ejercicio', tipo: 'select', opciones: RESULTADOS, requerido: true },
          { nombre: 'incluye_centro_costo', etiqueta: 'Incluye centro de costo', tipo: 'casilla' },
          { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla' }
        ],
        alGuardar: async (d) => {
          d.descripcion = d.descripcion.toUpperCase();
          const r = fila ? await sb.from('tipos_cuenta').update(d).eq('id', fila.id) : await sb.from('tipos_cuenta').insert(d);
          if (r.error) throw r.error;
          window.FIN.aviso('Tipo de cuenta guardado');
          await cargar();
        }
      });
    }

    cont.addEventListener('click', (e) => {
      if (e.target.closest('[data-accion=nuevo]')) return form();
      const ed = e.target.closest('[data-editar]');
      if (ed) form(filas.find((x) => String(x.id) === ed.dataset.editar));
    });
    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-buscar]')) return;
      buscar = e.target.value;
      filtrar(panel, buscar);
    });

    cargar();
  };
})();
