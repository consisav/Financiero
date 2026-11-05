// Ayuda · Manual del módulo: el manual de cada módulo como presentación (diapositivas). Si hay uno
// generado con IA (tabla manuales_modulo, Edge Function «manual-modulo» con Claude) se muestra ese;
// si no, se arma uno automático con la estructura del menú y ejemplos de la información que existe.
// Un administrador puede generarlo (o regenerarlo) con IA desde el mismo visor.
(function () {
  const { esc } = window.UI;
  // Tablas de ejemplo por módulo (pocas filas, de la localidad del usuario cuando la tabla la tiene).
  const TABLAS = {
    administracion: ['organizaciones', 'localidades', 'roles_funcionales', 'modulos_sistema'],
    contabilidad: ['cuentas', 'partidas', 'centros_costo', 'tipos_partida', 'transacciones_contables'],
    'caja-bancos': ['cuentas_bancarias', 'movimientos_bancarios', 'cajas_chicas', 'compras_saldo'],
    facturacion: ['clientes', 'productos', 'vendedores', 'tipos_precio'],
    compras: ['proveedores', 'compras_saldo', 'ordenes_compra', 'ingresos_compra', 'notas_compra', 'bodegas', 'regularizaciones_anticipo'],
    'presupuesto-flujo': ['rubros_presupuesto', 'presupuestos'],
    inventarios: ['productos', 'bodegas', 'existencias']
  };
  // Columnas que no se muestran ni se envían (identificadores, auditoría y datos de contacto).
  const OCULTA = /(^id$|_id$|^creado_|^modificado_|correo|telefono|ruta|firma|imagen|logo|eslogan|clave|token)/i;
  // Generación con IA desde el visor (Edge Function con clave de Anthropic): apagada; los manuales
  // escritos viven en web/manuales/<módulo>.json y se completan con ejemplos de la información actual.
  const CON_IA = false;
  const TIPO_ICONO = { portada: 'ti-book', indice: 'ti-list', concepto: 'ti-route', pantalla: 'ti-app-window', pasos: 'ti-list-numbers', ejemplo: 'ti-table', consejos: 'ti-bulb', cierre: 'ti-flag' };

  async function ejemplos(sb, loc) {
    const m = window.MANUAL._modulo;
    const salida = {};
    for (const t of TABLAS[m.id] || []) {
      const { data, error } = await sb.from(t).select('*').limit(40);
      if (error || !data?.length) continue;
      const filas = data.filter((r) => !('localidad_id' in r) || !loc || r.localidad_id === loc).slice(0, 4);
      if (!filas.length) continue;
      const cols = Object.keys(filas[0]).filter((k) => !OCULTA.test(k) && filas.some((r) => r[k] !== null && r[k] !== '' && typeof r[k] !== 'object')).slice(0, 7);
      salida[t] = { total: data.length >= 40 ? '40+' : data.length, columnas: cols.map(nombreTabla), filas: filas.map((r) => cols.map((k) => (r[k] === true ? 'Sí' : r[k] === false ? 'No' : String(r[k] ?? '').slice(0, 60)))) };
    }
    return salida;
  }
  const nombreTabla = (t) => t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

  // Manual sin IA: portada, índice, una diapositiva por subgrupo, pasos de operación, ejemplos y consejos.
  function automatico(m, estructura, datos) {
    const d = [];
    const vacio = { titulo: '', columnas: [], filas: [] };
    const dia = (o) => d.push({ subtitulo: '', puntos: [], pasos: [], ejemplo: vacio, nota: '', ...o });
    dia({ tipo: 'portada', titulo: `Manual del módulo ${m.nombre}`, subtitulo: m.descripcion || '', nota: 'Manual automático generado con la estructura del menú y la información registrada.' });
    dia({ tipo: 'indice', titulo: 'Contenido', puntos: estructura.map((g) => `${g.grupo}: ${g.subgrupos.map((s) => s.subgrupo).join(', ') || g.opciones.join(', ')}`) });
    // Una diapositiva por subgrupo (también los anidados, p. ej. Compras · Órdenes de compra).
    const porRuta = [];
    estructura.forEach((g) => g.subgrupos.forEach((s) => s.pantallas.forEach((p) => { let x = porRuta.find((r) => r.g === g && r.ruta === p.ruta); if (!x) porRuta.push(x = { g, ruta: p.ruta, pantallas: [] }); x.pantallas.push(p); })));
    porRuta.forEach(({ g, ruta, pantallas }) => {
      dia({ tipo: 'pantalla', titulo: ruta.split(' · ').pop(), subtitulo: `${m.corto} › ${g.grupo} › ${ruta.replace(/ · /g, ' › ')}`, puntos: pantallas.slice(0, 6).map((p) => `${p.nombre}: ${p.descripcion || ''}`) });
      if (g.id === 'registros' || g.id === 'procesos') {
        const p = pantallas.find((x) => /ingreso|registro|generaci|solicitud|movimiento|partida|factura|nota|orden/i.test(x.nombre)) || pantallas[0];
        if (p) dia({ tipo: 'pasos', titulo: `Cómo operar ${p.nombre}`, subtitulo: `${m.corto} › ${g.grupo} › ${ruta.replace(/ · /g, ' › ')}`, pasos: [
          `Abre el módulo ${m.corto} y en el menú «${g.grupo}» elige «${ruta.replace(/ · /g, '» › «')}» › «${p.nombre}».`,
          'Elige la empresa (localidad) y los filtros de fecha o estado en la barra superior.',
          'Presiona «Nueva» (o «Modificar» en un registro existente) y llena los campos obligatorios (*).',
          'Agrega el detalle en la pestaña correspondiente y revisa los totales.',
          'Presiona «Guardar»; luego procesa, aplica o imprime según el documento.',
          'Revisa el resultado en la pestaña «Listado» y en los reportes del módulo.'] });
      }
    });
    Object.entries(datos).forEach(([t, x]) => dia({ tipo: 'ejemplo', titulo: `Ejemplo: ${nombreTabla(t)}`, subtitulo: `${x.total} registro(s) en el sistema`, ejemplo: { titulo: nombreTabla(t), columnas: x.columnas, filas: x.filas } }));
    dia({ tipo: 'consejos', titulo: 'Buenas prácticas', puntos: ['Los campos con * son obligatorios; el sistema avisa en rojo lo que falta.', 'Los documentos procesados ya no se modifican: revierte o anula primero.', 'Cada empresa (localidad) tiene sus propios catálogos y correlativos.', 'Imprime o exporta a Excel desde el botón Imprimir de cada pantalla.', 'Los permisos de cada opción se definen en Administración › Roles módulos.'] });
    dia({ tipo: 'cierre', titulo: '¡Listo para operar!', subtitulo: 'Consulta este manual desde Ayuda › Manual del módulo.' });
    return { titulo: `Manual del módulo ${m.nombre}`, resumen: m.descripcion || '', diapositivas: d };
  }

  // El manual escrito más las diapositivas de ejemplo con la información actual (antes de los consejos).
  function conEjemplos(manual, datos) {
    const vacio = { titulo: '', columnas: [], filas: [] };
    const ej = Object.entries(datos).filter(([t]) => !(manual.sinEjemplos || []).includes(t)).map(([t, x]) => ({ tipo: 'ejemplo', titulo: `Información actual: ${manual.nombresTablas?.[t] || nombreTabla(t)}`, subtitulo: `${x.total} registro(s) en el sistema · datos reales de la empresa`, puntos: [], pasos: [], ejemplo: { titulo: '', columnas: x.columnas, filas: x.filas }, nota: '' }));
    const ds = manual.diapositivas.map((d) => ({ subtitulo: '', puntos: [], pasos: [], ejemplo: vacio, nota: '', ...d }));
    let k = ds.findIndex((d) => d.tipo === 'consejos');
    if (k < 0) k = ds.length - (ds[ds.length - 1]?.tipo === 'cierre' ? 1 : 0);
    ds.splice(k, 0, ...ej);
    return { ...manual, diapositivas: ds };
  }

  // ---------- Visor ----------
  let estado = null;
  function cerrar() { document.querySelector('.mm-fondo')?.remove(); document.removeEventListener('keydown', teclas); estado = null; }
  function teclas(e) {
    if (!estado) return;
    if (e.key === 'Escape') cerrar();
    if (e.key === 'ArrowRight' || e.key === 'PageDown') ir(estado.i + 1);
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') ir(estado.i - 1);
  }
  function ir(i) { if (!estado) return; estado.i = Math.max(0, Math.min(estado.manual.diapositivas.length - 1, i)); pintar(); }
  function diapositiva(s, n, total) {
    const ej = s.ejemplo && s.ejemplo.columnas?.length ? `<div class="mm-tabla"><table><thead><tr>${s.ejemplo.columnas.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${(s.ejemplo.filas || []).map((f) => `<tr>${f.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
    return `<article class="mm-dia mm-t-${esc(s.tipo)}">
        <header><span class="mm-tipo"><i class="ti ${TIPO_ICONO[s.tipo] || 'ti-point'}" aria-hidden="true"></i></span><div><h2>${esc(s.titulo)}</h2>${s.subtitulo ? `<p>${esc(s.subtitulo)}</p>` : ''}</div></header>
        <div class="mm-cuerpo">
          ${s.puntos?.length ? `<ul>${s.puntos.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
          ${s.pasos?.length ? `<ol class="mm-pasos">${s.pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>` : ''}
          ${ej}
        </div>
        <footer>${s.nota ? `<span class="mm-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> ${esc(s.nota)}</span>` : '<span></span>'}<span>${esc(estado.m.corto)} · ${n} / ${total}</span></footer>
      </article>`;
  }
  function pintar() {
    const { manual, i, origen } = estado;
    const ds = manual.diapositivas;
    const fondo = document.querySelector('.mm-fondo');
    fondo.innerHTML = `<div class="mm-visor" role="dialog" aria-modal="true" aria-label="${esc(manual.titulo)}">
        <div class="mm-barra">
          <div class="mm-titulo"><i class="ti ti-presentation" aria-hidden="true"></i><div><b>${esc(manual.titulo)}</b><small>${origen === 'IA' ? `Generado con IA (${esc(estado.modelo || 'Claude')}) · ${esc(estado.fecha || '')}` : origen === 'GUIA' ? `Manual del módulo · versión ${esc(estado.version || '')} · con ejemplos de la información actual` : 'Manual automático'}</small></div></div>
          <div class="mm-acc">
            ${CON_IA && window.FIN.puedeEditarCatalogos() ? `<button type="button" class="boton secundario-sm" data-mm="ia"><i class="ti ti-sparkles" aria-hidden="true"></i> ${origen === 'IA' ? 'Regenerar con IA' : 'Generar con IA'}</button>` : ''}
            <button type="button" class="boton secundario-sm" data-mm="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir / PDF</button>
            <button type="button" class="icono-boton" data-mm="cerrar" aria-label="Cerrar"><i class="ti ti-x" aria-hidden="true"></i></button>
          </div>
        </div>
        <div class="mm-cuerpo-visor">
          <nav class="mm-indice">${ds.map((s, k) => `<button type="button" data-ir="${k}" class="${k === i ? 'actual' : ''}"><span>${k + 1}</span><i class="ti ${TIPO_ICONO[s.tipo] || 'ti-point'}" aria-hidden="true"></i>${esc(s.titulo)}</button>`).join('')}</nav>
          <div class="mm-escena">${diapositiva(ds[i], i + 1, ds.length)}
            <div class="mm-nav"><button type="button" class="boton secundario-sm" data-ir="${i - 1}" ${i ? '' : 'disabled'}><i class="ti ti-chevron-left" aria-hidden="true"></i> Anterior</button><span>${i + 1} de ${ds.length}</span><button type="button" class="boton primario-sm" data-ir="${i + 1}" ${i < ds.length - 1 ? '' : 'disabled'}>Siguiente <i class="ti ti-chevron-right" aria-hidden="true"></i></button></div>
          </div>
        </div>
        <p class="mm-estado" data-estado></p>
      </div>`;
    fondo.querySelector('.mm-indice .actual')?.scrollIntoView({ block: 'nearest' });
  }
  function imprimirManual() {
    const { manual } = estado;
    const v = window.open('', '_blank');
    if (!v) return window.FIN.aviso('Permite las ventanas emergentes para imprimir');
    const guardado = estado.i;
    const paginas = manual.diapositivas.map((s, k) => diapositiva(s, k + 1, manual.diapositivas.length)).join('');
    estado.i = guardado;
    v.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(manual.titulo)}</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
      <style>@page{size:A4 landscape;margin:10mm}body{font:14px/1.45 Arial,sans-serif;color:#111;margin:0}
      .mm-dia{page-break-after:always;height:180mm;display:flex;flex-direction:column;border:1px solid #c9d6e6;border-radius:10px;padding:14mm 16mm;box-sizing:border-box;margin-bottom:8mm}
      .mm-dia header{display:flex;gap:12px;align-items:center;border-bottom:3px solid #8b1a1a;padding-bottom:8px}.mm-dia h2{margin:0;font-size:24px;color:#8b1a1a}.mm-dia header p{margin:2px 0 0;color:#555}
      .mm-tipo{font-size:28px;color:#1f5fa8}.mm-cuerpo{flex:1;padding-top:10px;font-size:15px}.mm-cuerpo li{margin:5px 0}.mm-pasos li{margin:7px 0}
      table{border-collapse:collapse;width:100%;font-size:12px;margin-top:8px}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left}th{background:#e1eefb}
      footer{display:flex;justify-content:space-between;color:#666;font-size:11px;border-top:1px solid #ddd;padding-top:6px}.mm-t-portada h2{font-size:34px}
      </style></head><body>${paginas}<script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`);
    v.document.close();
  }
  async function generarIA() {
    const sb = window.FIN.sb;
    const msg = document.querySelector('[data-estado]');
    if (!confirm(`¿Generar el manual de ${estado.m.nombre} con IA (Claude)?\n\nSe envían la estructura del menú y unos pocos registros de ejemplo (sin correos ni teléfonos). Cada generación consume la API de Anthropic configurada en Supabase y tarda uno o dos minutos.`)) return;
    const botones = document.querySelectorAll('.mm-acc button');
    botones.forEach((b) => { b.disabled = true; });
    msg.innerHTML = '<i class="ti ti-loader-2 mm-gira" aria-hidden="true"></i> Generando el manual con IA… (1 a 2 minutos)';
    try {
      const datos = await ejemplos(sb, window.FIN.perfil()?.localidad_id);
      const { data, error } = await sb.functions.invoke('manual-modulo', { body: { modulo: { id: estado.m.id, nombre: estado.m.nombre, descripcion: estado.m.descripcion }, estructura: estado.estructura, ejemplos: datos } });
      if (error) {
        if (error.context?.status === 404) throw new Error('La función «manual-modulo» no está instalada en Supabase (Edge Functions).');
        let detalle = error.message;
        try { detalle = (await error.context?.json())?.error || detalle; } catch { /* sin cuerpo */ }
        throw new Error(/Failed to send|not found|404/i.test(detalle) ? 'La función «manual-modulo» no está instalada en Supabase (Edge Functions).' : detalle);
      }
      if (!data?.manual?.diapositivas?.length) throw new Error(data?.error || 'La IA no devolvió diapositivas.');
      const g = await sb.from('manuales_modulo').upsert({ modulo: estado.m.id, contenido: data.manual, modelo: data.modelo || 'claude', generado_por: (window.FIN.perfil()?.usuario || '').toUpperCase() }, { onConflict: 'modulo' });
      Object.assign(estado, { manual: data.manual, origen: 'IA', modelo: data.modelo, fecha: new Date().toLocaleString('es-GT'), i: 0 });
      pintar();
      window.FIN.aviso(g.error ? 'Manual generado (no se pudo guardar: falta el script 73)' : 'Manual generado con IA y guardado');
    } catch (err) {
      botones.forEach((b) => { b.disabled = false; });
      msg.innerHTML = `<i class="ti ti-alert-triangle" aria-hidden="true"></i> ${esc(err.message || String(err))}`;
    }
  }

  async function abrir(m, estructura) {
    cerrar();
    window.MANUAL._modulo = m;
    const fondo = document.createElement('div');
    fondo.className = 'mm-fondo';
    fondo.innerHTML = '<div class="mm-visor mm-cargando"><i class="ti ti-loader-2 mm-gira" aria-hidden="true"></i> Preparando el manual…</div>';
    document.body.appendChild(fondo);
    document.addEventListener('keydown', teclas);
    fondo.addEventListener('click', (e) => {
      if (e.target === fondo) return cerrar();
      const irA = e.target.closest('[data-ir]');
      if (irA) return ir(Number(irA.dataset.ir));
      const a = e.target.closest('[data-mm]')?.dataset.mm;
      if (a === 'cerrar') return cerrar();
      if (a === 'imprimir') return imprimirManual();
      if (a === 'ia') return generarIA();
    });
    const sb = window.FIN.sb;
    const guardado = await sb.from('manuales_modulo').select('*').eq('modulo', m.id).maybeSingle();
    if (!document.body.contains(fondo)) return;
    if (!guardado.error && guardado.data?.contenido?.diapositivas?.length) {
      estado = { m, estructura, manual: guardado.data.contenido, origen: 'IA', modelo: guardado.data.modelo, fecha: new Date(guardado.data.generado_en).toLocaleString('es-GT'), i: 0 };
    } else {
      const datos = await ejemplos(sb, window.FIN.perfil()?.localidad_id);
      const escrito = await fetch(`manuales/${m.id}.json?v=${encodeURIComponent(document.querySelector('script[src*="manual_modulo.js"]')?.src.split('v=')[1] || '')}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      estado = escrito?.diapositivas?.length
        ? { m, estructura, manual: conEjemplos(escrito, datos), origen: 'GUIA', version: escrito.version, i: 0 }
        : { m, estructura, manual: automatico(m, estructura, datos), origen: 'AUTO', i: 0 };
    }
    if (document.body.contains(fondo)) pintar();
  }
  window.MANUAL = { abrir, _modulo: null };
})();
