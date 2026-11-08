// Excel de Cuentas x Pagar (Compras) y Cuentas x Cobrar (Ventas), con el diseño de los reportes .xlsx del sistema.
//   RESUMIDO: un renglón por proveedor o cliente (documentos, mayor mora, valor y saldo).
//   DETALLADO: los documentos agrupados por proveedor o cliente, con subtotal de cada uno.
//   PERIODO: los documentos agrupados por el periodo que corresponde al parámetro del encabezado:
//     mes (consolidado mensual) → por día; rango de fechas (consolidado general) → por mes;
//     saldo a una fecha (por periodo) → por antigüedad del saldo a esa fecha.
// window.CUENTAS_XLSX.generar({ tipo, modo, titulo, parametros, orgId, locId, tercero, archivo, filas, corte })
//   filas: [{ tercero_id, codigo, nombre, nit, numero, serie, documento, fecha, estimada, mora, valor, saldo, ref }]
//   fecha: la fecha que manda en el reporte (estimada o del documento), en formato aaaa-mm-dd.
(function () {
  const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
  const ANTIGUEDAD = [[-Infinity, 0, 'POR VENCER / AL DÍA'], [1, 30, '1 A 30 DÍAS'], [31, 60, '31 A 60 DÍAS'], [61, 90, '61 A 90 DÍAS'], [91, 120, '91 A 120 DÍAS'], [121, Infinity, 'MÁS DE 120 DÍAS']];
  const dd = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  function columnasDet(tercero, conTercero = true) {
    return [
      { titulo: 'No.', ancho: conTercero ? 32 : 46, tipo: 'texto' }, { titulo: 'Serie', ancho: 12, tipo: 'texto' }, { titulo: 'Documento', ancho: 16, tipo: 'texto' },
      { titulo: 'Fecha docto.', ancho: 12, tipo: 'texto' }, { titulo: tercero === 'Cliente' ? 'Se estima cobro' : 'Se estima pago', ancho: 14, tipo: 'texto' },
      { titulo: 'Días mora', ancho: 10, tipo: 'entero' },
      ...(conTercero ? [{ titulo: tercero, ancho: 9, tipo: 'texto' }, { titulo: `Nombre ${tercero.toLowerCase()}`, ancho: 40, tipo: 'texto' }] : []),
      { titulo: 'Valor total Q', ancho: 15, tipo: 'monto' }, { titulo: 'Saldo Q', ancho: 15, tipo: 'monto' }
    ];
  }
  const filaDoc = (x, conTercero = true) => ({ valores: [x.numero, x.serie || '', x.documento || '', dd(x.fecha_doc), dd(x.estimada), x.mora || 0, ...(conTercero ? [x.codigo ?? '', x.nombre || ''] : []), r2(x.valor), r2(x.saldo)] });
  const relleno = (n) => Array(n).fill('');

  // El reporte ocupa toda la altura disponible hasta el borde inferior de la ventana (la tabla toma el resto).
  function ajustarAlto(cont) {
    const el = cont.querySelector('.cx-rep');
    if (!el) return;
    const fijar = () => { if (!el.isConnected) return window.removeEventListener('resize', fijar); el.style.setProperty('--tk-alto', `${Math.max(420, Math.floor(window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - (parseFloat(getComputedStyle(el.closest('.vista') || document.body).paddingBottom) || 0) - 4))}px`); };
    if (!el.dataset.alto) { el.dataset.alto = '1'; window.addEventListener('resize', fijar); }
    fijar();
  }

  // Orden ascendente / descendente por columna (pantalla, PDF y Excel).
  // o: { campo: 'fdoc' | 'fpago' | 'mora' | 'valor' | 'saldo' | '', dir: 'ASC' | 'DESC' }; get: { campo: (fila) => valor }.
  function ordenar(rows, o, get) {
    if (!o || !o.campo || !get[o.campo]) return rows;
    const s = o.dir === 'DESC' ? -1 : 1, g = get[o.campo];
    return rows.map((r, i) => [r, i]).sort(([a, i], [b, j]) => {
      const x = g(a), y = g(b);
      const c = typeof x === 'number' || typeof y === 'number' ? (Number(x) || 0) - (Number(y) || 0) : String(x || '').localeCompare(String(y || ''));
      return c ? c * s : i - j;
    }).map(([r]) => r);
  }
  // Encabezado de columna que ordena al hacer clic (alterna ascendente y descendente).
  function th(campo, txt, o, cls = '') {
    const act = o.campo === campo, desc = o.dir === 'DESC';
    return `<th class="${cls} cx-ord${act ? ' activo' : ''}" data-orden="${campo}" tabindex="0" aria-sort="${act ? (desc ? 'descending' : 'ascending') : 'none'}" title="Ordenar ${act && !desc ? 'descendente' : 'ascendente'}">${txt}<i class="ti ${act ? (desc ? 'ti-arrow-down' : 'ti-arrow-up') : 'ti-arrows-sort'}" aria-hidden="true"></i></th>`;
  }
  function alternar(o, campo) { if (o.campo === campo) o.dir = o.dir === 'ASC' ? 'DESC' : 'ASC'; else { o.campo = campo; o.dir = 'ASC'; } }
  const opcionesOrden = (pago) => [['', 'PREDETERMINADO'], ['fdoc', 'FECHA DOCTO.'], ['fpago', pago], ['mora', 'DÍAS MORA'], ['valor', 'VALOR'], ['saldo', 'SALDO']];
  const textoOrden = (o, pago) => (o.campo ? `Orden: ${opcionesOrden(pago).find(([k]) => k === o.campo)[1]} ${o.dir === 'DESC' ? 'descendente' : 'ascendente'}` : 'Orden: predeterminado');

  // PDF con la misma estructura del Excel (grupos, subtotales, total y notas) y el encabezado común de los reportes.
  function aPdf({ titulo, parametros, columnas, filas, orgId, locId }) {
    const { esc } = window.UI;
    const { fmt, imprimir } = window.BANCOS;
    const n = columnas.length;
    const celda = (v, c) => {
      if (v === '' || v == null) return '<td></td>';
      if (c.tipo === 'monto' && typeof v === 'number') return `<td class="n">${fmt.monto(v)}</td>`;
      if (c.tipo === 'entero' && typeof v === 'number') return `<td class="n">${v.toLocaleString('es-GT')}</td>`;
      return `<td class="${c.tipo === 'texto' ? '' : 'n'}">${esc(String(v))}</td>`;
    };
    const cuerpo = filas.map((f) => (f.tipo === 'grupo' ? `<tr class="g"><td colspan="${n}">${esc(String(f.valores[0] ?? ''))}</td></tr>`
      : f.tipo === 'nota' ? `<tr class="nt"><td colspan="${n}">${esc(String(f.valores[0] ?? ''))}</td></tr>`
        : `<tr class="${f.tipo === 'subtotal' ? 's' : f.tipo === 'total' ? 't' : ''}">${columnas.map((c, i) => celda(f.valores[i], c)).join('')}</tr>`)).join('');
    const est = `<style>table.cx td,table.cx th{font-size:10.5px;padding:3px 5px}tr.g td{background:#dfe7f2;color:#1f3a5f;font-weight:bold;font-size:11px}
      tr.s td{font-weight:bold;background:#f1f4f9;border-top:1px solid #9fb0c8}tr.t td{font-weight:bold;background:#eaf0f7;border-top:2px solid #1f3a5f}
      tr.nt td{font-style:italic;color:#555;font-size:10px;border:0}tr.g,tr.s{break-inside:avoid}tr.g{break-after:avoid}</style>`;
    imprimir(titulo, `${est}<h1>${esc(titulo)}</h1><h2>${esc((parametros || []).join(' · '))}</h2>
      <table class="cx"><thead><tr>${columnas.map((c) => `<th class="${c.tipo === 'texto' ? '' : 'n'}">${esc(c.titulo)}</th>`).join('')}</tr></thead><tbody>${cuerpo}</tbody></table>`, { orgId, locId, horizontal: n > 7 });
    return Promise.resolve(true);
  }

  // o.tipo: RESUMIDO | DETALLADO | PERIODO (Excel) o PDF_RESUMIDO | PDF_DETALLADO | PDF_PERIODO (PDF).
  function generar(o) {
    const enPdf = String(o.tipo || '').startsWith('PDF_');
    o = { ...o, tipo: enPdf ? o.tipo.slice(4) : o.tipo };
    const filas = o.filas || [];
    const tot = { v: r2(filas.reduce((t, x) => t + Number(x.valor || 0), 0)), s: r2(filas.reduce((t, x) => t + Number(x.saldo || 0), 0)) };
    let columnas, salida = [], sufijo;
    if (o.tipo === 'RESUMIDO') {
      sufijo = 'Resumido';
      const g = new Map();
      filas.forEach((x) => { const k = x.tercero_id || `N${x.nit}${x.nombre}`; const a = g.get(k) || { codigo: x.codigo, nombre: x.nombre, nit: x.nit, docs: 0, mora: 0, v: 0, s: 0 }; a.docs++; a.mora = Math.max(a.mora, x.mora || 0); a.v += Number(x.valor || 0); a.s += Number(x.saldo || 0); g.set(k, a); });
      columnas = [{ titulo: o.tercero, ancho: 10, tipo: 'texto' }, { titulo: `Nombre ${o.tercero.toLowerCase()}`, ancho: 44, tipo: 'texto' }, { titulo: 'NIT', ancho: 14, tipo: 'texto' }, { titulo: 'Documentos', ancho: 11, tipo: 'entero' }, { titulo: 'Mayor mora', ancho: 11, tipo: 'entero' }, { titulo: 'Valor total Q', ancho: 16, tipo: 'monto' }, { titulo: 'Saldo Q', ancho: 16, tipo: 'monto' }];
      const ord = o.orden && ['mora', 'valor', 'saldo'].includes(o.orden.campo) ? o.orden : { campo: 'saldo', dir: 'DESC' };
      salida = ordenar([...g.values()], ord, { mora: (a) => a.mora, valor: (a) => a.v, saldo: (a) => a.s }).map((a) => ({ valores: [a.codigo ?? '', a.nombre || '', a.nit || '', a.docs, a.mora, r2(a.v), r2(a.s)] }));
      salida.push({ valores: [`${g.size} ${o.tercero.toLowerCase()}(s)`, '', '', filas.length, '', tot.v, tot.s], tipo: 'total' });
    } else if (o.tipo === 'DETALLADO') {
      sufijo = 'Detallado';
      columnas = columnasDet(o.tercero, false);
      const g = new Map();
      filas.forEach((x) => { const k = x.tercero_id || `N${x.nit}${x.nombre}`; if (!g.has(k)) g.set(k, { x, docs: [] }); g.get(k).docs.push(x); });
      [...g.values()].sort((a, b) => String(a.x.nombre).localeCompare(String(b.x.nombre))).forEach(({ x, docs }) => {
        salida.push({ valores: [`${x.codigo ?? ''} · ${x.nombre || ''}${x.nit ? ` · NIT ${x.nit}` : ''}`, ...relleno(columnas.length - 1)], tipo: 'grupo' });
        docs.forEach((d) => salida.push(filaDoc(d, false)));
        salida.push({ valores: [`Subtotal (${docs.length})`, ...relleno(columnas.length - 3), r2(docs.reduce((t, d) => t + Number(d.valor || 0), 0)), r2(docs.reduce((t, d) => t + Number(d.saldo || 0), 0))], tipo: 'subtotal' });
      });
      salida.push({ valores: [`Total · ${filas.length} documento(s)`, ...relleno(columnas.length - 3), tot.v, tot.s], tipo: 'total' });
    } else {
      // Por periodo, según el parámetro del encabezado.
      columnas = columnasDet(o.tercero, true);
      const grupos = new Map();
      const clave = o.modo === 'PERIODO'
        ? (x) => { const i = ANTIGUEDAD.findIndex(([a, b]) => (x.mora || 0) >= a && (x.mora || 0) <= b); return [String(i), ANTIGUEDAD[i][2]]; }
        : o.modo === 'MENSUAL'
          ? (x) => [x.fecha || '', x.fecha ? `${DIAS[new Date(`${x.fecha}T12:00:00`).getDay()]} ${dd(x.fecha)}` : 'SIN FECHA']
          : (x) => [x.fecha ? x.fecha.slice(0, 7) : '', x.fecha ? `${MESES[Number(x.fecha.slice(5, 7)) - 1]} ${x.fecha.slice(0, 4)}` : 'SIN FECHA'];
      sufijo = o.modo === 'PERIODO' ? 'Por antigüedad' : o.modo === 'MENSUAL' ? 'Por día' : 'Por mes';
      const lista = o.modo === 'PERIODO' ? filas.filter((x) => Number(x.saldo) > 0.004) : filas;
      lista.forEach((x) => { const [k, t] = clave(x); if (!grupos.has(k)) grupos.set(k, { t, docs: [] }); grupos.get(k).docs.push(x); });
      const n = columnas.length;
      [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true })).forEach(([, { t, docs }]) => {
        salida.push({ valores: [t, ...relleno(n - 1)], tipo: 'grupo' });
        docs.forEach((d) => salida.push(filaDoc(d)));
        salida.push({ valores: [`Subtotal ${t.toLowerCase()} (${docs.length})`, ...relleno(n - 3), r2(docs.reduce((s, d) => s + Number(d.valor || 0), 0)), r2(docs.reduce((s, d) => s + Number(d.saldo || 0), 0))], tipo: 'subtotal' });
      });
      const tv = r2(lista.reduce((s, d) => s + Number(d.valor || 0), 0)), ts = r2(lista.reduce((s, d) => s + Number(d.saldo || 0), 0));
      salida.push({ valores: [`Total · ${lista.length} documento(s)`, ...relleno(n - 3), tv, ts], tipo: 'total' });
      if (o.modo === 'PERIODO' && filas.length !== lista.length) salida.push({ valores: [`Por antigüedad solo se incluyen los documentos con saldo al ${dd(o.corte)}.`, ...relleno(n - 1)], tipo: 'nota' });
    }
    if (enPdf) return aPdf({ titulo: `${o.titulo} · ${sufijo}`, parametros: o.parametros, columnas, filas: salida, orgId: o.orgId, locId: o.locId });
    return window.REPORTE_XLSX.generar({
      titulo: `${o.titulo} · ${sufijo}`, parametros: o.parametros, orgId: o.orgId, locId: o.locId,
      hoja: sufijo.slice(0, 30), archivo: `${o.archivo}_${sufijo.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, columnas, filas: salida
    });
  }

  window.CUENTAS_XLSX = { generar, pdf: aPdf, ajustarAlto, ordenar, th, alternar, opcionesOrden, textoOrden,OPCIONES: [['PDF', 'PDF · LISTADO'], ['PDF_RESUMIDO', 'PDF · RESUMIDO'], ['PDF_DETALLADO', 'PDF · DETALLADO'], ['PDF_PERIODO', 'PDF · POR PERIODO'], ['RESUMIDO', 'EXCEL · RESUMIDO'], ['DETALLADO', 'EXCEL · DETALLADO'], ['PERIODO', 'EXCEL · POR PERIODO']] };
})();
