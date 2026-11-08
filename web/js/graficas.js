// Gráficas en SVG para los reportes (pantalla, PDF y Excel). Colores fijos para que se impriman igual:
// un solo tono para magnitudes y dos tonos fijos para comparar dos series (entradas y salidas).
//   GRAFICAS.barras(titulo, [{ etiqueta, valor, texto }])           barras horizontales ordenadas
//   GRAFICAS.columnas(titulo, categorias, [{ nombre, color, valores }], formato)
//   GRAFICAS.linea(titulo, [{ x, y }], formato)
//   GRAFICAS.png(svg) -> Promise<{ base64, width, height }>        para insertarla en Excel
(function () {
  const AZUL = '#2f6fd6', VERDE = '#1f9d74', NARANJA = '#e07b39', TINTA = '#1f2937', SUAVE = '#6b7280', REJILLA = '#e5e7eb';
  const W = 900;
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const corta = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));
  const num = (v) => Number(v || 0).toLocaleString('es-GT', { maximumFractionDigits: 2 });
  const marco = (h, titulo, cuerpo) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" font-family="Arial, Helvetica, sans-serif">
    <rect width="${W}" height="${h}" fill="#ffffff"/><text x="12" y="22" font-size="14" font-weight="bold" fill="${TINTA}">${esc(titulo)}</text>${cuerpo}</svg>`;

  function barras(titulo, items, color = AZUL) {
    const xs = items.filter((i) => Number(i.valor) > 0);
    if (!xs.length) return '';
    const fila = 24, top = 38, izq = 300, h = top + xs.length * fila + 10;
    const max = Math.max(...xs.map((i) => Number(i.valor)));
    const ancho = W - izq - 130;
    return marco(h, titulo, xs.map((i, k) => {
      const y = top + k * fila, w = Math.max(2, (Number(i.valor) / max) * ancho);
      return `<text x="${izq - 8}" y="${y + 12}" font-size="11.5" fill="${TINTA}" text-anchor="end">${esc(corta(i.etiqueta, 46))}</text>
        <rect x="${izq}" y="${y + 1}" width="${w.toFixed(1)}" height="15" rx="3" fill="${color}"/>
        <text x="${izq + w + 6}" y="${y + 12}" font-size="11.5" fill="${SUAVE}">${esc(i.texto ?? num(i.valor))}</text>`;
    }).join(''));
  }

  function escala(max) {
    if (max <= 0) return [1, 0.25];
    const p = 10 ** Math.floor(Math.log10(max)); const m = max / p;
    const paso = (m <= 1.2 ? 0.25 : m <= 2.5 ? 0.5 : m <= 5 ? 1 : 2) * p;
    return [Math.ceil(max / paso) * paso, paso];
  }

  function columnas(titulo, cats, series, formato = num) {
    if (!cats.length) return '';
    const h = 300, izq = 80, der = 16, top = 46, abajo = 34, alto = h - top - abajo;
    const [tope, paso] = escala(Math.max(0, ...series.flatMap((s) => s.valores.map(Number))));
    const grupo = (W - izq - der) / cats.length, bw = Math.min(26, (grupo - 10) / series.length);
    const y = (v) => top + alto - (Math.max(0, v) / tope) * alto;
    let g = '';
    for (let v = 0; v <= tope + 1e-9; v += paso) g += `<line x1="${izq}" x2="${W - der}" y1="${y(v)}" y2="${y(v)}" stroke="${REJILLA}"/><text x="${izq - 6}" y="${y(v) + 4}" font-size="10.5" fill="${SUAVE}" text-anchor="end">${esc(formato(v))}</text>`;
    const ley = series.map((s, i) => `<rect x="${W - der - 230 + i * 115}" y="12" width="12" height="12" rx="2" fill="${s.color}"/><text x="${W - der - 213 + i * 115}" y="22" font-size="11.5" fill="${TINTA}">${esc(s.nombre)}</text>`).join('');
    const cuerpo = cats.map((c, k) => {
      const x0 = izq + k * grupo + (grupo - bw * series.length - 2 * (series.length - 1)) / 2;
      return series.map((s, i) => { const v = Number(s.valores[k]) || 0; const yy = y(v); return `<rect x="${(x0 + i * (bw + 2)).toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${(top + alto - yy).toFixed(1)}" rx="3" fill="${s.color}"><title>${esc(`${c} · ${s.nombre}: ${formato(v)}`)}</title></rect>`; }).join('')
        + `<text x="${(izq + k * grupo + grupo / 2).toFixed(1)}" y="${h - 14}" font-size="11" fill="${SUAVE}" text-anchor="middle">${esc(c)}</text>`;
    }).join('');
    return marco(h, titulo, `${g}${ley}${cuerpo}<line x1="${izq}" x2="${W - der}" y1="${top + alto}" y2="${top + alto}" stroke="#9ca3af"/>`);
  }

  function linea(titulo, puntos, formato = num, color = AZUL) {
    if (puntos.length < 2) return '';
    const h = 260, izq = 80, der = 16, top = 40, abajo = 34, alto = h - top - abajo;
    const ys = puntos.map((p) => Number(p.y)); const min = Math.min(0, ...ys);
    const [tope, paso] = escala(Math.max(...ys) - min);
    const X = (i) => izq + (i / (puntos.length - 1)) * (W - izq - der);
    const Y = (v) => top + alto - ((v - min) / tope) * alto;
    let g = '';
    for (let v = 0; v <= tope + 1e-9; v += paso) g += `<line x1="${izq}" x2="${W - der}" y1="${Y(min + v)}" y2="${Y(min + v)}" stroke="${REJILLA}"/><text x="${izq - 6}" y="${Y(min + v) + 4}" font-size="10.5" fill="${SUAVE}" text-anchor="end">${esc(formato(min + v))}</text>`;
    // Escalones: el saldo se mantiene hasta el siguiente movimiento.
    let d = `M${X(0).toFixed(1)},${Y(ys[0]).toFixed(1)}`;
    for (let i = 1; i < puntos.length; i++) d += ` H${X(i).toFixed(1)} V${Y(ys[i]).toFixed(1)}`;
    const marcas = [0, Math.floor((puntos.length - 1) / 2), puntos.length - 1].map((i) => `<text x="${X(i)}" y="${h - 14}" font-size="11" fill="${SUAVE}" text-anchor="${i === 0 ? 'start' : i === puntos.length - 1 ? 'end' : 'middle'}">${esc(puntos[i].x)}</text>`).join('');
    return marco(h, titulo, `${g}<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>${marcas}`);
  }

  function png(svg) {
    return new Promise((ok, mal) => {
      const w = Number(svg.match(/width="(\d+)"/)[1]), h = Number(svg.match(/height="(\d+)"/)[1]);
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2;
        const c = cv.getContext('2d'); c.scale(2, 2); c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.drawImage(img, 0, 0, w, h);
        ok({ base64: cv.toDataURL('image/png').split(',')[1], width: Math.round(w * 0.8), height: Math.round(h * 0.8) });
      };
      img.onerror = () => mal(new Error('No se pudo dibujar la gráfica'));
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
  }

  window.GRAFICAS = { barras, columnas, linea, png, COLORES: { AZUL, VERDE, NARANJA } };
})();
