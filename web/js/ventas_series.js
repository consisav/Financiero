// Facturación/Ventas · Catálogos · Series Recibos y Correlativo - DTE (diseños del sistema anterior).
//   Series Recibos: serie, recibo inicial, principal (una por tipo), tipo (recibo, retención o exención) y si se
//   muestra en la lista de Recibos, Retenciones y Exenciones.
//   Correlativo - DTE: documento, descripción, serie y último correlativo interno de las facturas (FE) y de las notas de
//   crédito (NC); el siguiente documento toma el número siguiente.
(function () {
  const { esc } = window.UI;
  const { montar } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const TIPOS = ['RECIBO', 'RETENCIÓN', 'EXENCIÓN'];

  // Pantalla de catálogo con una tabla editable (las dos usan la misma estructura).
  function catalogo(cont, cfg) {
    const ctx = montar(cont, { titulo: cfg.titulo, icono: cfg.icono, clase: 'bk-movimientos bm-solo vs-catalogo', grupo: 'Ventas · Catálogos' });
    const { sb } = ctx;
    let filas = [], borrar = [];

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from(cfg.tabla).select('id').limit(1);
      if (prueba.error) { ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/does not exist|schema cache/.test(prueba.error.message) ? 'Falta instalar el script 138 (series, correlativos, envíos y despachos) en Supabase.' : esc(prueba.error.message)}</p></section>`; return; }
      ctx.filtros('', '');
      await cargar();
    }
    async function cargar() {
      const { data } = await sb.from(cfg.tabla).select('*').eq('localidad_id', ctx.sel.loc || 0).order(cfg.orden);
      filas = (data || []).map((x) => ({ ...x })); borrar = [];
      pintar();
    }
    function pintar() {
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', cfg.icono); return; }
      const ed = ctx.admin;
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form bm-form vs-form" novalidate>
          <header class="tk-titulo bm-titulo">
            <div class="tk-titulo-texto"><small>${esc(cfg.titulo)} · ${esc(ctx.localidad(ctx.sel.loc)?.codigo || '')} ${esc(ctx.localidad(ctx.sel.loc)?.nombre_comercial || '')}</small><h2>${esc(cfg.encabezado)}</h2></div>
            <div class="tk-titulo-acciones">
              ${ed ? `<button type="button" class="boton secundario-sm" data-accion="agregar"><i class="ti ti-plus" aria-hidden="true"></i> ${esc(cfg.agregar)}</button>
              <button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar cambios</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          <p class="cc-ingreso vs-ayuda">${cfg.ayuda}</p>
          <div class="pc-lineas vs-tabla"><table><thead><tr>${cfg.columnas.map(([, t, c]) => `<th class="${c || ''}">${t}</th>`).join('')}<th class="pq-x"></th></tr></thead>
            <tbody>${filas.map((x, i) => `<tr data-fila="${i}">${cfg.columnas.map(([k, , c, tipo, extra]) => `<td class="${c || ''}">${celda(x, k, tipo, extra, ed)}</td>`).join('')}<td class="pq-x">${ed && cfg.quitar ? `<button type="button" class="icono-boton" data-quitar="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`).join('') || `<tr><td colspan="${cfg.columnas.length + 1}" class="tk-vacio">Sin registros.</td></tr>`}</tbody></table></div>
        </form>`;
    }
    function celda(x, k, tipo, extra, ed) {
      const dis = ed && !(extra === 'fijo' && x.id) ? '' : 'disabled';
      if (tipo === 'check') return `<input type="checkbox" data-c="${k}" ${x[k] ? 'checked' : ''} ${dis}>`;
      if (tipo === 'select') return `<select data-c="${k}" ${dis}>${extra.map((y) => `<option ${x[k] === y ? 'selected' : ''}>${y}</option>`).join('')}</select>`;
      if (tipo === 'sino') return `<select data-c="${k}" ${dis}><option value="true" ${x[k] ? 'selected' : ''}>SI</option><option value="false" ${!x[k] ? 'selected' : ''}>NO</option></select>`;
      return `<input data-c="${k}" ${tipo === 'num' ? 'type="number" step="1" min="0"' : 'maxlength="60"'} value="${esc(String(x[k] ?? ''))}" ${dis}>`;
    }
    function leer() {
      ctx.pDet.querySelectorAll('tr[data-fila]').forEach((tr) => {
        const x = filas[Number(tr.dataset.fila)]; if (!x) return;
        tr.querySelectorAll('[data-c]').forEach((el) => {
          const k = el.dataset.c; const col = cfg.columnas.find((c) => c[0] === k);
          x[k] = el.type === 'checkbox' ? el.checked : col[3] === 'sino' ? el.value === 'true' : col[3] === 'num' ? (el.value === '' ? null : Number(el.value)) : el.value.trim().toUpperCase();
        });
      });
    }
    async function guardar(form) {
      const error = form.querySelector('.tk-error'); error.textContent = '';
      leer();
      const msg = cfg.validar(filas);
      if (msg) { error.textContent = msg; return; }
      try {
        if (borrar.length) { const d = await sb.from(cfg.tabla).delete().in('id', borrar); if (d.error) throw d.error; }
        for (const x of filas) {
          const datos = Object.fromEntries(cfg.columnas.map(([k]) => [k, x[k]]));
          const r = x.id ? await sb.from(cfg.tabla).update(datos).eq('id', x.id) : await sb.from(cfg.tabla).insert({ ...datos, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc });
          if (r.error) throw r.error;
        }
      } catch (e) { error.textContent = window.UI.traducirError(e); return; }
      window.FIN.aviso('Cambios guardados');
      await cargar();
    }

    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') return cargar();
      // Principal: una sola por tipo.
      if (e.target.dataset?.c === 'principal' && e.target.checked) {
        leer(); const x = filas[Number(e.target.closest('tr').dataset.fila)];
        filas.forEach((y) => { if (y !== x && y.tipo === x.tipo) y.principal = false; }); pintar();
      }
    });
    cont.addEventListener('click', (e) => {
      const q = e.target.closest('[data-quitar]');
      if (q) { leer(); const [x] = filas.splice(Number(q.dataset.quitar), 1); if (x?.id) borrar.push(x.id); return pintar(); }
      if (e.target.closest('[data-accion=agregar]')) { leer(); filas.push(cfg.nueva(filas)); return pintar(); }
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.vs-form')) { e.preventDefault(); guardar(e.target); } });
    iniciar();
  }

  window.PANTALLAS['series-recibos'] = (cont) => catalogo(cont, {
    titulo: 'Series Recibos', encabezado: 'Series de recibos', icono: 'ti-list-numbers', tabla: 'series_recibo', orden: 'serie', agregar: 'Serie', quitar: true,
    ayuda: 'La serie principal de cada tipo es la que proponen Recibos, Retenciones y Exenciones; «Mostrar en lista» decide si la serie aparece para elegirla.',
    columnas: [['serie', 'Serie', 'vs-c-serie', 'texto', 'fijo'], ['recibo_inicial', 'Recibo inicial', 'num vs-c-num', 'num'], ['principal', 'Principal', 'vs-c-chk', 'check'], ['tipo', 'Tipo', 'vs-c-tipo', 'select', TIPOS], ['mostrar', 'Mostrar en lista', 'vs-c-tipo', 'sino']],
    nueva: () => ({ serie: '', recibo_inicial: 1, principal: false, tipo: 'RECIBO', mostrar: true }),
    validar: (f) => {
      if (f.some((x) => !x.serie)) return 'Cada fila necesita su serie.';
      const s = f.map((x) => x.serie); if (new Set(s).size !== s.length) return 'Hay series repetidas.';
      if (f.some((x) => !(Number(x.recibo_inicial) >= 0))) return 'El recibo inicial debe ser un número.';
      return '';
    }
  });
  window.PANTALLAS['correlativo-dte'] = (cont) => catalogo(cont, {
    titulo: 'Correlativo - DTE', encabezado: 'Correlativo interno - DTE', icono: 'ti-123', tabla: 'correlativos_dte', orden: 'documento', agregar: 'Documento', quitar: false,
    ayuda: 'El correlativo es el último número usado: la siguiente factura toma FE-(correlativo + 1) y la siguiente nota de crédito, NC-(correlativo + 1).',
    columnas: [['documento', 'Documento', 'num vs-c-num', 'num', 'fijo'], ['descripcion', 'Descripción', '', 'texto'], ['serie', 'Serie', 'vs-c-serie', 'texto'], ['correlativo', 'Correlativo', 'num vs-c-num', 'num']],
    nueva: (f) => ({ documento: Math.max(0, ...f.map((x) => Number(x.documento) || 0)) + 1, descripcion: '', serie: '', correlativo: 0 }),
    validar: (f) => {
      if (f.some((x) => !x.documento || !x.descripcion || !x.serie)) return 'Cada documento necesita número, descripción y serie.';
      if (f.some((x) => !(Number(x.correlativo) >= 0))) return 'El correlativo debe ser un número.';
      return '';
    }
  });
})();
