// Representación gráfica de la factura electrónica (FEL) para imprimir o guardar en PDF, con el diseño del sistema anterior:
//   encabezado con logo y datos del emisor, recuadro «Documento Tributario Electrónico» con el tipo de documento, serie, número y
//   fecha de emisión; datos del cliente y condiciones de pago (abono y vencimiento si es cambiaria); detalle con lote, vencimiento
//   y fabricación; frases del emisor, IVA, valor en letras y total; autorización, fecha de certificación y certificador; y, en la
//   factura cambiaria, la cláusula de pago con firma del vendedor y recibido de conformidad.
// Uso: window.FACTURA_FEL.imprimir(factura, lineas, { vendedor, moneda })
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const gt = (d) => { const x = new Date(d); return Number.isNaN(x.getTime()) ? null : new Date(x.toLocaleString('en-US', { timeZone: 'America/Guatemala' })); };
  const dos = (n) => String(n).padStart(2, '0');
  const fechaHora = (d) => { const x = d && gt(d); return x ? `${dos(x.getDate())}-${dos(x.getMonth() + 1)}-${x.getFullYear()} ${dos(x.getHours())}:${dos(x.getMinutes())}:${dos(x.getSeconds())}` : ''; };
  const fechaCert = (d) => { const x = d && gt(d); return x ? `${dos(x.getDate())}-${MES[x.getMonth()].toUpperCase()}-${String(x.getFullYear()).slice(2)} ${dos(x.getHours())}:${dos(x.getMinutes())}:${dos(x.getSeconds())}` : ''; };
  // Fechas sin hora (AAAA-MM-DD): 29-Mar-2028.
  const fechaCorta = (d) => { if (!d) return ''; const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[3]}-${MES[Number(m[2]) - 1]}-${m[1]}`; const x = gt(d); return x ? `${dos(x.getDate())}-${MES[x.getMonth()]}-${x.getFullYear()}` : ''; };
  const monto = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cant = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 4 });
  const titulo = (t) => String(t || '').toLowerCase().replace(/(^|\s)(\S)/g, (m, p, c) => p + c.toUpperCase());
  const sumarDias = (d, n) => { const x = gt(d) || new Date(); x.setDate(x.getDate() + Number(n || 0)); return `${x.getFullYear()}-${dos(x.getMonth() + 1)}-${dos(x.getDate())}`; };

  const TIPOS = { FACT: 'FACTURA ELECTRÓNICA', FCAM: 'FACTURA ELECTRÓNICA CAMBIARIA', FPEQ: 'FACTURA PEQUEÑO CONTRIBUYENTE', FCAP: 'FACTURA CAMBIARIA PEQUEÑO CONTRIBUYENTE',
    FESP: 'FACTURA ESPECIAL', NABN: 'NOTA DE ABONO', RDON: 'RECIBO POR DONACIÓN', RECI: 'RECIBO', NDEB: 'NOTA DE DÉBITO', NCRE: 'NOTA DE CRÉDITO', FEXP: 'FACTURA DE EXPORTACIÓN' };
  const CLAUSULA = 'No se considera cancelada esta factura si no está amparada por el recibo oficial del vendedor beneficiario extendido por el depto. de caja, el colaborador o vendedor autorizado. El comprador da como bueno el valor total de esta factura cambiaria, se compromete a cancelarla al vencimiento en las oficinas del vendedor-beneficiario, depósito o transferencia bancaria y el caso de incumplimiento el comprador renuncia expresamente al fuero de su domicilio y se somete a los tribunales de la República de Guatemala que el beneficiario elija obligándose a pagar sobre la misma intereses moratorios del CINCO POR CIENTO (5%) mensual, dicho recargo de interés se hará únicamente en caso de no efectuar el pago capital en la fecha pactada, así mismo Q. 150.00 por cada cheque rechazado. Acepto la presente factura cambiaria y doy por válido a quien yo autorizo en mi representación para la firma y aceptación de la presente en caso de no poder firmarla y a quien designe para la aceptación de la misma.';

  async function datos(f) {
    const sb = window.FIN.sb;
    const desde = sb.__fromOriginal || sb.from.bind(sb);
    const uno = async (q) => { try { const r = await q; return r.error ? null : r.data; } catch { return null; } };
    const [loc, emi, est, fr] = await Promise.all([
      uno(desde('localidades').select('*').eq('id', f.localidad_id).maybeSingle()),
      uno(sb.from('sat_emisores').select('*').eq('localidad_id', f.localidad_id).order('id').limit(1).maybeSingle()),
      uno(sb.from('sat_establecimientos').select('*').eq('localidad_id', f.localidad_id).order('codigo').limit(1).maybeSingle()),
      uno(sb.from('sat_emisor_frases').select('sat_frases(tipo, escenario, descripcion, texto)').eq('localidad_id', f.localidad_id))
    ]);
    const org = loc ? await uno(desde('organizaciones').select('nombre, logo_ruta').eq('id', loc.organizacion_id).maybeSingle()) : null;
    // Frases como en el DTE: una por tipo; las de exención (tipo 4) solo si el documento va exento.
    const exento = !!f.exento_iva || !!f.incoterm || /EXPORTA/i.test(`${f.tipo_factura || ''} ${f.tipo_documento || ''}`);
    const esc4 = exento ? (/EXPORTA/i.test(`${f.tipo_factura || ''}`) || f.incoterm ? 1 : f.generico ? 9 : null) : null;
    const todas = (fr || []).map((x) => x.sat_frases).filter(Boolean).sort((a, b) => a.tipo - b.tipo || a.escenario - b.escenario);
    const frases = [];
    const vistos = new Set();
    todas.forEach((s) => {
      if (vistos.has(s.tipo)) return;
      if (s.tipo === 4) { if (!exento) return; const elegida = esc4 ? todas.find((y) => y.tipo === 4 && y.escenario === esc4) : todas.find((y) => y.tipo === 4 && ![1, 9, 22].includes(y.escenario)); if (!elegida) return; frases.push(elegida); vistos.add(4); return; }
      frases.push(s); vistos.add(s.tipo);
    });
    const logo = loc?.logo_ruta || org?.logo_ruta;
    return { loc, emi, est, org, frases, exento, logo: logo ? sb.storage.from('organizaciones').getPublicUrl(logo).data.publicUrl : null };
  }

  function html(f, lineas, o, d) {
    const tipo = String(f.tipo_dte || 'FACT').toUpperCase();
    const cambiaria = tipo === 'FCAM' || tipo === 'FCAP' || /CAMBIAR/i.test(`${f.tipo_factura || ''} ${f.tipo_documento || ''}`);
    const nombreTipo = cambiaria && tipo === 'FACT' ? TIPOS.FCAM : (TIPOS[tipo] || 'FACTURA ELECTRÓNICA');
    const e = d.emi || {}; const l = d.loc || {}; const s = d.est || {};
    const pick = (...v) => v.find((x) => x != null && String(x).trim() !== '') || '';
    const emisor = pick(e.nombre_emisor, l.razon_social, l.nombre_comercial);
    const comercial = pick(e.nombre_comercial, l.nombre_comercial);
    const direccion = [pick(s.direccion, e.direccion, l.direccion), pick(s.municipio, e.municipio), pick(s.departamento, e.departamento)].filter(Boolean).join(', ');
    const tel = pick(l.telefono, l.telefonos, l.telefono1);
    const correo = pick(e.correo_emisor, l.correo, l.email, l.correo_electronico);
    const nitEm = pick(e.nit, l.nit);
    const certificador = pick(e.certificador, 'COFIDI');
    const nomCert = /^COFIDI$/i.test(certificador) ? 'COFIDI, SOCIEDAD ANONIMA' : certificador;
    const nitCert = pick(e.nit_certificador, /^COFIDI$/i.test(certificador) ? '62469045' : '');
    const sim = o.moneda?.simbolo || 'Q';
    const total = Number(f.total || lineas.reduce((t, x) => t + Number(x.cantidad || 0) * Number(x.precio || 0), 0));
    const iva = d.exento ? 0 : Number(f.iva ?? Math.round(total * 12 / 112 * 100) / 100);
    const vence = f.fecha_cobro || (f.forma_pago === 'CRÉDITO' ? sumarDias(f.fecha_emision, f.dias_credito) : null);
    const letrasFn = window.BANCOS?.enLetras;
    const letras = letrasFn ? titulo(letrasFn(total, String(o.moneda?.nombre || 'QUETZALES').toUpperCase())) : '';
    const interno = pick(f.no_interno, `F-${f.numero}`);
    const sinCert = !f.autorizacion;
    const marca = f.estado === 'ANULADA' ? 'ANULADA' : sinCert ? 'SIN CERTIFICAR' : '';
    const detalle = (x) => {
      const extra = [x.lote ? `Lote: ${esc(x.lote)}` : '', x.fecha_vencimiento ? `Vence: ${esc(fechaCorta(x.fecha_vencimiento))}` : '', x.fecha_fabricacion ? `Fab: ${esc(fechaCorta(x.fecha_fabricacion))}` : ''].filter(Boolean).join(' ');
      return `${esc(x.descripcion || '')}${extra ? ` ${extra}` : ''}`;
    };
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(`${nombreTipo} ${f.serie ? `${f.serie}-${f.numero_dte || ''}` : `interna ${f.numero}`}`)}</title><style>
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      @page{size:letter;margin:9mm 10mm}
      body{margin:0;font:10.5px/1.3 Arial,Helvetica,sans-serif;color:#111}
      .hoja{min-height:259mm;display:flex;flex-direction:column;position:relative}
      .az{color:#12386b}.b{font-weight:700}
      .cab{display:grid;grid-template-columns:1.05fr 1fr;gap:10px;align-items:start}
      .emi{text-align:center}.emi img{max-height:74px;max-width:230px;object-fit:contain;display:block;margin:0 auto 6px}
      .emi .n1{font-size:11.5px;color:#1f3a8a}.emi div{color:#1f3a8a;font-size:10px;line-height:1.25}
      .der{display:flex;flex-direction:column;gap:8px}
      .dte{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center}
      .fel{display:flex;flex-direction:column;align-items:center;line-height:1}.fel b{font:italic 800 30px Arial;color:#0b74b8;letter-spacing:-1px}.fel small{font-size:9px;font-weight:700;color:#12386b;margin-top:2px}
      .dte-t{background:#12386b;color:#fff;border-radius:8px;text-align:center;padding:6px 10px;font-size:12.5px;line-height:1.35;letter-spacing:.02em}
      .caja{border:1.3px solid #333;border-radius:12px;padding:7px 12px}
      .num{display:grid;grid-template-columns:auto auto;gap:2px 14px;justify-content:end;font-size:11px}.num span{text-align:right;font-weight:700;color:#12386b}
      .cli{margin-top:8px;display:grid;grid-template-columns:1.25fr 1fr;gap:2px 16px}
      .fila{display:grid;grid-template-columns:76px 1fr;gap:6px;align-items:start}.fila>span{font-weight:700;color:#12386b}
      .fila2{display:grid;grid-template-columns:auto 1fr;gap:6px}.fila2>span{font-weight:700;color:#12386b;text-align:right;min-width:130px}
      .mini{display:flex;gap:16px;align-items:baseline}.mini span{font-weight:700;color:#12386b}
      table{width:100%;border-collapse:separate;border-spacing:0;margin-top:8px}
      thead th{background:#12386b;color:#fff;font-size:12px;padding:5px 8px;text-align:center}
      thead th:first-child{border-radius:9px 0 0 9px}thead th:last-child{border-radius:0 9px 9px 0}
      td{padding:4px 8px;vertical-align:top;font-size:10.5px}
      td.n{text-align:right;white-space:nowrap}td.c{text-align:center}td.q{white-space:nowrap}
      .det{flex:1}
      .frases{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;margin-top:6px;font-weight:700;color:#12386b;font-size:11.5px}
      .frases .fr{display:flex;gap:28px;flex-wrap:wrap}.frases .iva{display:grid;grid-template-columns:auto 90px;gap:4px;color:#111}.frases .iva b{color:#111}
      .tot{display:grid;grid-template-columns:1fr 215px;gap:8px;margin-top:4px;align-items:stretch}
      .tot .caja span{display:block;font-weight:700;color:#12386b}
      .total{background:#12386b;color:#fff;border-radius:12px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:8px 12px;font-size:16px;font-weight:700}
      .total em{font-style:normal;text-align:right}
      .aut{margin-top:6px;display:grid;grid-template-columns:1.35fr 1fr;gap:2px 16px;font-size:11px}
      .aut .fila{grid-template-columns:185px 1fr}.aut .fila2>span{min-width:90px}
      .pie{display:grid;grid-template-columns:1fr 175px;gap:18px;margin-top:8px}
      .pie p{margin:0;font-size:9.6px;text-align:justify;line-height:1.3;color:#222}.pie .firma{font-size:10px;border-bottom:1px solid #333;padding-bottom:1px;margin-bottom:2px}
      .recib{border:1.3px solid #333;border-radius:12px;height:125px;padding:8px;text-align:center;color:#12386b;font-size:10.5px}
      .recib-l{text-align:center;color:#12386b;font-size:10.5px;margin-top:4px}
      .marca{position:absolute;inset:35% 0 auto 0;text-align:center;font:900 72px Arial;color:rgba(200,30,30,.16);transform:rotate(-22deg);pointer-events:none}
    </style></head><body><div class="hoja">
      ${marca ? `<div class="marca">${marca}</div>` : ''}
      <header class="cab">
        <div class="emi">${d.logo ? `<img src="${esc(d.logo)}" alt="">` : ''}
          <div class="n1">${esc(emisor)}</div>${comercial && comercial !== emisor ? `<div>${esc(comercial)}</div>` : ''}
          ${direccion ? `<div>${esc(direccion)}</div>` : ''}${tel ? `<div>Teléfono: ${esc(tel)}</div>` : ''}${correo ? `<div>email: ${esc(correo)}</div>` : ''}${nitEm ? `<div>Nit: ${esc(nitEm)}</div>` : ''}</div>
        <div class="der">
          <div class="dte"><div class="fel"><b>fel</b><small>Factura Electrónica</small></div>
            <div class="dte-t">DOCUMENTO TRIBUTARIO ELECTRÓNICO<br>${esc(nombreTipo)}${cambiaria ? '<br>LIBRE DE PROTESTO' : ''}</div></div>
          <div class="caja num"><span>Serie:</span><div>${esc(f.serie || '—')}</div><span>Número:</span><div>${esc(f.numero_dte || '—')}</div><span>Fecha y hora de emisión:</span><div>${esc(fechaHora(f.fecha_emision))}</div></div>
        </div>
      </header>
      <section class="caja cli">
        <div style="display:flex;flex-direction:column;gap:2px">
          <div class="fila"><span>Cliente:</span><div>${esc(f.nombre || '')}</div></div>
          <div class="fila"><span>Dirección:</span><div>${esc(f.direccion || 'CIUDAD')}</div></div>
          <div class="mini"><div class="fila" style="grid-template-columns:76px auto"><span>No. Interno:</span><div>${esc(interno)}</div></div><div><span>Cod. Cliente:</span> ${esc(f.cliente_codigo ?? '')}</div><div><span>Nit:</span> ${esc(f.consumidor_final ? 'CF' : f.nit || 'CF')}</div></div>
          <div class="mini" style="padding-left:82px"><div><span>Cod. Vendedor:</span> ${esc(o.vendedor?.codigo ?? '')}</div></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:2px">
          <div class="fila2"><span>Teléfono:</span><div>${esc(f.telefono || '')}</div></div>
          <div class="fila2"><span>Contacto:</span><div>${esc(f.contacto || '')}</div></div>
          <div class="fila2"><span>Condiciones de Pago:</span><div>${esc(f.forma_pago || '')}${f.forma_pago === 'CRÉDITO' && Number(f.dias_credito) ? ` ${esc(f.dias_credito)} días` : ''}</div></div>
          ${vence ? `<div class="fila2"><span>Vencimiento:</span><div>${esc(fechaCorta(vence))}</div></div>` : ''}
          ${cambiaria ? `<div class="fila2"><span># Abono:</span><div style="display:flex;gap:26px"><span>1</span><span><b class="az">Monto:</b> &nbsp; ${monto(total)}</span></div></div>` : ''}
        </div>
      </section>
      <div class="det"><table><thead><tr><th style="width:11%">Código</th><th>Descripción</th><th style="width:13%">Medida</th><th style="width:9%">Cantidad</th><th style="width:13%">Precio Unit.</th><th style="width:12%">Total</th></tr></thead>
        <tbody>${lineas.filter((x) => x.descripcion || x.producto_id).map((x) => `<tr><td class="c">${esc(String(x.producto_codigo ?? ''))}</td><td>${detalle(x)}</td><td class="c">${esc(x.unidad_medida || '')}</td><td class="n">${cant(x.cantidad)}</td><td class="q">${esc(sim)}. <span style="float:right">${monto(x.precio)}</span></td><td class="q">${esc(sim)}. <span style="float:right">${monto(Number(x.cantidad || 0) * Number(x.precio || 0))}</span></td></tr>`).join('')}</tbody></table></div>
      <div class="frases"><div class="fr">${d.frases.map((x) => `<span>${esc(pick(x.texto, x.descripcion))}</span>`).join('')}</div><div class="iva"><b>IVA:</b><span style="text-align:right">${monto(iva)}</span></div></div>
      <div class="tot"><div class="caja"><span>Valor en Letras:</span>${esc(letras)}</div><div class="total"><span>Total:</span><span>${esc(sim)}.</span><em>${monto(total)}</em></div></div>
      <section class="caja aut">
        <div class="fila"><span>No. de Autorización:</span><div>${esc(f.autorizacion || 'Pendiente de certificar')}</div></div>
        <div class="fila2"><span>Certificador:</span><div>${esc(nomCert)}</div></div>
        <div class="fila"><span>Fecha y Hora de Certificación:</span><div>${esc(fechaCert(f.fecha_certificacion))}</div></div>
        <div class="fila2"><span>Nit:</span><div>${esc(nitCert)}</div></div>
      </section>
      ${cambiaria ? `<div class="pie"><div><div class="firma">FIRMA Y SELLO DEL VENDEDOR-BENEFICIARIO:</div><p>${esc(CLAUSULA)}</p></div><div><div class="recib">RECIBIDA DE CONFORMIDAD</div><div class="recib-l">FIRMA Y SELLO</div></div></div>` : ''}
    </div></body></html>`;
  }

  async function imprimir(f, lineas, o = {}) {
    if (!window.FIN_IMPRESION) return;
    const d = await datos(f);
    const { v, fr, imprimirYa } = window.FIN_IMPRESION();
    v.document.write(html(f, lineas || [], o, d));
    v.document.close();
    const img = v.document.querySelector('.emi img');
    await new Promise((ok) => {
      if (!img || img.complete) return ok();
      const t = setTimeout(ok, 3000);
      img.onload = img.onerror = () => { clearTimeout(t); ok(); };
    });
    if (fr.isConnected) imprimirYa();
  }

  // Organizaciones que imprimen la factura con este diseño (por código): 3 = Futura Farma.
  const ORGANIZACIONES = ['3'];
  async function aplica(f) {
    try {
      const sb = window.FIN.sb; const desde = sb.__fromOriginal || sb.from.bind(sb);
      const { data } = await desde('organizaciones').select('codigo').eq('id', f.organizacion_id).maybeSingle();
      return ORGANIZACIONES.includes(String(data?.codigo ?? ''));
    } catch { return false; }
  }

  window.FACTURA_FEL = { imprimir, html, datos, aplica };
})();
