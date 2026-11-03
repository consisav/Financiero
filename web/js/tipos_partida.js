// Catálogos iniciales · Tipos de partida: clasificación de las partidas del libro diario
// (apertura, operación, ajuste o cierre) con sus siglas.
(function () {
  const { esc, tabla, formulario, filtrar } = window.UI;

  const CLASIFICACIONES = ['APERTURA', 'OPERACIÓN', 'AJUSTE', 'CIERRE'].map((v) => ({ valor: v, texto: v }));

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['tipos-de-partida'] = function (cont) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    let filas = [];
    let buscar = '';

    cont.innerHTML = '<section class="panel" id="p-tipos-partida"></section>';
    const panel = cont.querySelector('#p-tipos-partida');

    async function cargar() {
      const { data, error } = await sb.from('tipos_partida').select('*').order('codigo');
      if (error) {
        const falta = /tipos_partida/.test(error.message) && /schema cache|does not exist/.test(error.message);
        panel.innerHTML = `<p class="vacio">${falta ? 'Falta instalar el script 19 (tipos de partida) en Supabase.' : esc(error.message)}</p>`;
        return;
      }
      filas = data;
      panel.innerHTML = `
        <div class="panel-cab">
          <h2>Tipos de partida contable</h2>
          <div class="panel-acciones">${editable ? '<button type="button" class="boton primario-sm" data-accion="nuevo">+ Tipo de partida</button>' : ''}</div>
        </div>
        <input type="search" class="buscar" data-buscar placeholder="Buscar tipo de partida" value="${esc(buscar)}">
        ${tabla({
          id: 'tipos-partida', editable, vacio: 'Todavía no hay tipos de partida.',
          columnas: [
            { titulo: 'Tipo', valor: (f) => f.codigo, clase: 'angosta' },
            { titulo: 'Siglas', valor: (f) => esc(f.siglas), clase: 'angosta fuerte' },
            { titulo: 'Nombre', valor: (f) => esc(f.nombre), clase: 'fuerte' },
            { titulo: 'Clasificación', valor: (f) => esc(f.clasificacion) },
            { titulo: 'Descripción', valor: (f) => esc(f.descripcion || '') },
            { titulo: 'Estado', valor: (f) => window.UI.estado(f.activo) }
          ],
          filas
        })}`;
      filtrar(panel, buscar);
    }

    function form(fila) {
      formulario({
        titulo: fila ? `Modificar tipo de partida · ${fila.nombre}` : 'Nuevo tipo de partida',
        valores: fila || { codigo: Math.max(0, ...filas.map((x) => x.codigo)) + 1, clasificacion: 'OPERACIÓN', activo: true },
        campos: [
          { nombre: 'codigo', etiqueta: 'Tipo', tipo: 'numero', requerido: true },
          { nombre: 'siglas', etiqueta: 'Siglas', requerido: true },
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
          { nombre: 'clasificacion', etiqueta: 'Clasificación', tipo: 'select', opciones: CLASIFICACIONES, requerido: true },
          { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'area', ancho: 'completo' },
          { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla' }
        ],
        alGuardar: async (d) => {
          d.siglas = d.siglas.trim().toUpperCase();
          d.nombre = d.nombre.toUpperCase();
          const r = fila ? await sb.from('tipos_partida').update(d).eq('id', fila.id) : await sb.from('tipos_partida').insert(d);
          if (r.error) throw r.error;
          window.FIN.aviso('Tipo de partida guardado');
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
