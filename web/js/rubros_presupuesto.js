// Catálogos · Cuentas y CC · Rubros de presupuesto: rubros que se presupuestan, por grupo.
(function () {
  const { esc, tabla, formulario, filtrar } = window.UI;

  const GRUPOS = ['INGRESOS', 'GASTOS DE PERSONAL', 'GASTOS FINANCIEROS', 'GASTOS ADMINISTRATIVOS', 'IMPUESTOS', 'INVERSIONES'].map((v) => ({ valor: v, texto: v }));
  const NATURALEZAS = ['INGRESO', 'EGRESO', 'INVERSIÓN'].map((v) => ({ valor: v, texto: v }));

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['rubros-presupuesto'] = function (cont) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    let filas = [];
    let buscar = '';

    cont.innerHTML = '<section class="panel" id="p-rubros"></section>';
    const panel = cont.querySelector('#p-rubros');

    async function cargar() {
      const { data, error } = await sb.from('rubros_presupuesto').select('*').order('codigo');
      if (error) {
        const falta = /rubros_presupuesto/.test(error.message) && /schema cache|does not exist/.test(error.message);
        panel.innerHTML = `<p class="vacio">${falta ? 'Falta instalar el script 40 (presupuestos) en Supabase.' : esc(error.message)}</p>`;
        return;
      }
      filas = data;
      panel.innerHTML = `
        <div class="panel-cab">
          <h2>Rubros de presupuesto</h2>
          <div class="panel-acciones">${editable ? '<button type="button" class="boton primario-sm" data-accion="nuevo">+ Rubro</button>' : ''}</div>
        </div>
        <input type="search" class="buscar" data-buscar placeholder="Buscar rubro o grupo" value="${esc(buscar)}">
        ${tabla({
          id: 'rubros', editable, vacio: 'Todavía no hay rubros de presupuesto.',
          columnas: [
            { titulo: 'Código', valor: (f) => f.codigo, clase: 'angosta' },
            { titulo: 'Rubro', valor: (f) => esc(f.nombre), clase: 'fuerte' },
            { titulo: 'Grupo', valor: (f) => esc(f.grupo) },
            { titulo: 'Naturaleza', valor: (f) => `<span class="rb-naturaleza ${f.naturaleza === 'INGRESO' ? 'ingreso' : f.naturaleza === 'INVERSIÓN' ? 'inversion' : 'egreso'}">${esc(f.naturaleza)}</span>` },
            { titulo: 'Estado', valor: (f) => window.UI.estado(f.activo) }
          ],
          filas
        })}`;
      filtrar(panel, buscar);
    }

    function form(fila) {
      const grupo = fila?.grupo || 'GASTOS ADMINISTRATIVOS';
      formulario({
        titulo: fila ? `Modificar rubro · ${fila.nombre}` : 'Nuevo rubro de presupuesto',
        valores: fila || { codigo: Math.max(0, ...filas.filter((x) => x.grupo === grupo).map((x) => x.codigo)) + 1, grupo, naturaleza: 'EGRESO', activo: true },
        campos: [
          { nombre: 'codigo', etiqueta: 'Código', tipo: 'numero', requerido: true },
          { nombre: 'nombre', etiqueta: 'Rubro', requerido: true },
          { nombre: 'grupo', etiqueta: 'Grupo', tipo: 'select', opciones: GRUPOS, requerido: true },
          { nombre: 'naturaleza', etiqueta: 'Naturaleza', tipo: 'select', opciones: NATURALEZAS, requerido: true },
          { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla' }
        ],
        alGuardar: async (d) => {
          d.nombre = d.nombre.toUpperCase();
          const r = fila ? await sb.from('rubros_presupuesto').update(d).eq('id', fila.id) : await sb.from('rubros_presupuesto').insert(d);
          if (r.error) throw r.error;
          window.FIN.aviso('Rubro guardado');
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
