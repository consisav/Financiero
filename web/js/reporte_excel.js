// Reporte en Excel (.xlsx) con el diseño de las Consultas de Cheques, Notas y Compras: a la izquierda el logo
// (de la localidad o, si no tiene, de la organización) y el nombre de la empresa; al centro el título y los
// parámetros; a la derecha la fecha y hora de generación con el usuario; una línea de separación, los
// encabezados de columna y los datos. Lo usan los reportes de Contabilidad (partidas, cuentas, centros de
// costo y presupuesto).
//
// window.REPORTE_XLSX.generar({
//   titulo, parametros: ['…', …], orgId, locId, hoja, archivo,
//   columnas: [{ titulo, ancho, tipo: 'texto' | 'monto' | 'numero' | 'porcentaje' }],
//   filas: [{ valores: [...], tipo: 'dato' | 'grupo' | 'subtotal' | 'total' | 'nota', resaltar, tenue, sangria }]
// })
(function () {
  const AZUL = 'FF1F3A5F';
  const MONTO = '#,##0.00';
  const NUMERO = '#,##0.####';

  const cargar = () => window.ExcelJS ? Promise.resolve(window.ExcelJS) : new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
    s.onload = () => window.ExcelJS ? ok(window.ExcelJS) : mal(new Error('ExcelJS'));
    s.onerror = () => mal(new Error('No se pudo cargar la librería de Excel'));
    document.head.appendChild(s);
  });

  // Texto plano de un valor que pudo venir con HTML escapado.
  const plano = (v) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&') : v;

  async function marca(sb, orgId, locId) {
    try {
      const { data: o } = orgId ? await sb.from('organizaciones').select('codigo, nombre, logo_ruta').eq('id', orgId).maybeSingle() : { data: null };
      const { data: l, error: el } = locId ? await sb.from('localidades').select('codigo, nombre_comercial, logo_ruta').eq('id', locId).maybeSingle() : { data: null };
      const loc = el ? (await sb.from('localidades').select('codigo, nombre_comercial').eq('id', locId).maybeSingle()).data : l;
      const ruta = (!el && l?.logo_ruta) || o?.logo_ruta;
      if (!ruta) return { org: o, loc, logo: null };
      const blob = await (await fetch(sb.storage.from('organizaciones').getPublicUrl(ruta).data.publicUrl)).blob();
      const ext = /png/.test(blob.type) ? 'png' : /jpe?g/.test(blob.type) ? 'jpeg' : /gif/.test(blob.type) ? 'gif' : null;
      if (!ext) return { org: o, loc, logo: null };
      const b64 = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
      const dim = await new Promise((ok) => { const i = new Image(); i.onload = () => ok({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => ok({ w: 160, h: 80 }); i.src = URL.createObjectURL(blob); });
      return { org: o, loc, logo: { base64: b64, extension: ext, ...dim } };
    } catch { return { org: null, loc: null, logo: null }; }
  }

  async function generar(cfg) {
    const sb = window.FIN.sb;
    let ExcelJS;
    try { ExcelJS = await cargar(); } catch (err) { window.FIN.aviso(err.message); return false; }
    window.FIN.aviso('Generando el reporte…');
    const { org, loc, logo } = await marca(sb, cfg.orgId, cfg.locId);
    const yo = window.FIN.perfil ? window.FIN.perfil() : {};
    const ahora = new Date().toLocaleString('es-GT', { timeZone: 'America/Guatemala', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '');
    // Al menos 6 columnas para repartir el encabezado en tres bloques.
    const cols = [...cfg.columnas];
    while (cols.length < 6) cols.push({ titulo: '', ancho: 10 });
    const n = cols.length;
    const L = Math.max(2, Math.floor(n * 0.3));
    const derecha = Math.max(2, Math.floor(n * 0.25));
    const R = Math.max(L + 1, n - derecha);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Financiero CONSISAV';
    const ws = wb.addWorksheet(String(cfg.hoja || 'Reporte').slice(0, 31), { views: [{ state: 'frozen', ySplit: 7, showGridLines: false }], pageSetup: { orientation: n > 6 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.columns = cols.map((c) => ({ width: c.ancho || 14 }));
    // a) Izquierda: logo y nombre de la empresa.
    if (logo) {
      const id = wb.addImage({ base64: logo.base64, extension: logo.extension });
      const alto = 64; const ancho = Math.round(alto * (logo.w / (logo.h || 1)));
      ws.addImage(id, { tl: { col: 0.1, row: 0.15 }, ext: { width: Math.min(ancho, 150), height: alto } });
    }
    const izq = logo && L >= 3 ? 2 : 1;
    const desdeTexto = logo ? Math.min(izq + 1, L) : 1;
    ws.mergeCells(1, desdeTexto, 1, L); ws.getCell(1, desdeTexto).value = org?.nombre || '';
    ws.getCell(1, desdeTexto).font = { bold: true, size: 13, color: { argb: AZUL } };
    ws.mergeCells(2, desdeTexto, 2, L); ws.getCell(2, desdeTexto).value = loc ? `${loc.codigo} · ${loc.nombre_comercial}` : '';
    ws.getCell(2, desdeTexto).font = { size: 10, color: { argb: 'FF555555' } };
    [1, 2].forEach((r) => { ws.getCell(r, desdeTexto).alignment = { vertical: 'middle', wrapText: false }; });
    // b) Centro: título y parámetros (en tres renglones).
    const par = (cfg.parametros || []).map(plano).filter(Boolean);
    const tercio = Math.ceil(par.length / 3) || 1;
    ws.mergeCells(1, L + 1, 1, R); ws.getCell(1, L + 1).value = plano(cfg.titulo);
    ws.getCell(1, L + 1).font = { bold: true, size: 14, color: { argb: AZUL } };
    [par.slice(0, tercio), par.slice(tercio, tercio * 2), par.slice(tercio * 2)].forEach((p, i) => {
      ws.mergeCells(2 + i, L + 1, 2 + i, R); ws.getCell(2 + i, L + 1).value = p.join('   ·   ');
      ws.getCell(2 + i, L + 1).font = { size: 9.5, color: { argb: 'FF444444' } };
    });
    for (let r = 1; r <= 4; r += 1) ws.getCell(r, L + 1).alignment = { horizontal: 'center', vertical: 'middle' };
    // c) Derecha: fecha y hora, y el usuario.
    ws.mergeCells(1, R + 1, 1, n); ws.getCell(1, R + 1).value = `Fecha: ${ahora}`;
    ws.mergeCells(2, R + 1, 2, n); ws.getCell(2, R + 1).value = `Usuario: ${(yo.usuario || '').toUpperCase()}${yo.nombre ? ` · ${yo.nombre}` : ''}`;
    [1, 2].forEach((r) => { ws.getCell(r, R + 1).alignment = { horizontal: 'right' }; ws.getCell(r, R + 1).font = { size: 9.5, color: { argb: 'FF444444' } }; });
    ws.getRow(1).height = 22; [2, 3, 4].forEach((r) => { ws.getRow(r).height = 15; });
    // Línea de separación.
    for (let c = 1; c <= n; c += 1) ws.getCell(5, c).border = { bottom: { style: 'medium', color: { argb: AZUL } } };
    ws.getRow(5).height = 6;
    // Encabezados de columna (fila 7).
    const cab = ws.getRow(7);
    cols.forEach((c, i) => {
      const x = cab.getCell(i + 1); x.value = c.titulo;
      x.font = { bold: true, color: { argb: 'FFFFFFFF' } }; x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
      x.alignment = { vertical: 'middle', horizontal: ['monto', 'numero', 'porcentaje'].includes(c.tipo) ? 'right' : 'left' };
    });
    cab.height = 18;
    // Datos.
    let fila = 8;
    for (const f of cfg.filas) {
      const r = ws.getRow(fila);
      r.values = f.valores.map((v) => plano(v ?? ''));
      cols.forEach((c, i) => { if (c.tipo === 'monto') r.getCell(i + 1).numFmt = MONTO; if (c.tipo === 'numero') r.getCell(i + 1).numFmt = NUMERO; if (c.tipo === 'porcentaje') r.getCell(i + 1).numFmt = '0.0%'; });
      if (f.sangria) r.getCell(1).alignment = { indent: f.sangria };
      if (f.sangria && cfg.sangriaEn) cfg.sangriaEn.forEach((k) => { r.getCell(k).alignment = { indent: f.sangria }; });
      if (f.tipo === 'grupo') { r.font = { bold: true, color: { argb: AZUL } }; r.eachCell({ includeEmpty: true }, (x) => { x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF0F7' } }; }); }
      if (f.tipo === 'subtotal') { r.font = { bold: true, size: 10 }; cols.forEach((c, i) => { if (c.tipo === 'monto') r.getCell(i + 1).border = { top: { style: 'thin' } }; }); }
      if (f.tipo === 'total') { r.font = { bold: true }; for (let c = 1; c <= n; c += 1) r.getCell(c).border = { top: { style: 'medium', color: { argb: AZUL } } }; }
      if (f.tipo === 'nota') r.font = { italic: true, size: 9.5, color: { argb: 'FF555555' } };
      if (f.resaltar) { r.font = { ...(r.font || {}), bold: true }; r.eachCell({ includeEmpty: true }, (x) => { x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: f.resaltar === 2 ? 'FFD6E2F3' : 'FFEAF0F7' } }; }); }
      if (f.tenue) r.font = { ...(r.font || {}), color: { argb: 'FF8A94A6' } };
      fila += 1;
    }
    if (cfg.autofiltro) ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: cfg.columnas.length } };

    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `${String(cfg.archivo || 'reporte').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_')}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    window.FIN.aviso('Reporte en Excel generado');
    return true;
  }

  // Botón «Generar Excel» compacto, con el mismo color verde de las consultas.
  const boton = (atributos = '') => `<button type="button" class="boton rx-excel" ${atributos} title="Reporte en Excel (.xlsx) con el encabezado de la empresa"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> Generar Excel</button>`;

  window.REPORTE_XLSX = { generar, boton, plano };
})();
