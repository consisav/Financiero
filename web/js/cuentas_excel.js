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
      { titulo: 'No.', ancho: 10, tipo: 'texto' }, { titulo: 'Serie', ancho: 12, tipo: 'texto' }, { titulo: 'Documento', ancho: 16, tipo: 'texto' },
      { titulo: 'Fecha docto.', ancho: 12, tipo: 'texto' }, { titulo: tercero === 'Cliente' ? 'Se estima cobro' : 'Se estima pago', ancho: 14, tipo: 'texto' },
      { titulo: 'Días mora', ancho: 9, tipo: 'numero' },
      ...(conTercero ? [{ titulo: tercero, ancho: 9, tipo: 'texto' }, { titulo: `Nombre ${tercero.toLowerCase()}`, ancho: 40, tipo: 'texto' }] : []),
      { titulo: 'Valor total Q', ancho: 15, tipo: 'monto' }, { titulo: 'Saldo Q', ancho: 15, tipo: 'monto' }
    ];
  }
  const filaDoc = (x, conTercero = true) => ({ valores: [x.numero, x.serie || '', x.documento || '', dd(x.fecha_doc), dd(x.estimada), x.mora || 0, ...(conTercero ? [x.codigo ?? '', x.nombre || ''] : []), r2(x.valor), r2(x.saldo)] });
  const relleno = (n) => Array(n).fill('');

  function generar(o) {
    const filas = o.filas || [];
    const tot = { v: r2(filas.reduce((t, x) => t + Number(x.valor || 0), 0)), s: r2(filas.reduce((t, x) => t + Number(x.saldo || 0), 0)) };
    let columnas, salida = [], sufijo;
    if (o.tipo === 'RESUMIDO') {
      sufijo = 'Resumido';
      const g = new Map();
      filas.forEach((x) => { const k = x.tercero_id || `N${x.nit}${x.nombre}`; const a = g.get(k) || { codigo: x.codigo, nombre: x.nombre, nit: x.nit, docs: 0, mora: 0, v: 0, s: 0 }; a.docs++; a.mora = Math.max(a.mora, x.mora || 0); a.v += Number(x.valor || 0); a.s += Number(x.saldo || 0); g.set(k, a); });
      columnas = [{ titulo: o.tercero, ancho: 10, tipo: 'texto' }, { titulo: `Nombre ${o.tercero.toLowerCase()}`, ancho: 44, tipo: 'texto' }, { titulo: 'NIT', ancho: 14, tipo: 'texto' }, { titulo: 'Documentos', ancho: 11, tipo: 'numero' }, { titulo: 'Mayor mora', ancho: 11, tipo: 'numero' }, { titulo: 'Valor total Q', ancho: 16, tipo: 'monto' }, { titulo: 'Saldo Q', ancho: 16, tipo: 'monto' }];
      salida = [...g.values()].sort((a, b) => b.s - a.s).map((a) => ({ valores: [a.codigo ?? '', a.nombre || '', a.nit || '', a.docs, a.mora, r2(a.v), r2(a.s)] }));
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
    return window.REPORTE_XLSX.generar({
      titulo: `${o.titulo} · ${sufijo}`, parametros: o.parametros, orgId: o.orgId, locId: o.locId,
      hoja: sufijo.slice(0, 30), archivo: `${o.archivo}_${sufijo.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, columnas, filas: salida
    });
  }

  window.CUENTAS_XLSX = { generar, OPCIONES: [['PDF', 'PDF'], ['RESUMIDO', 'EXCEL · RESUMIDO'], ['DETALLADO', 'EXCEL · DETALLADO'], ['PERIODO', 'EXCEL · POR PERIODO']] };
})();
