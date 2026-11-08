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
    inventarios: ['productos', 'bodegas', 'existencias', 'tomas_fisicas', 'cierres_inventario']
  };
  // Columnas que no se muestran ni se envían (identificadores, auditoría y datos de contacto).
  const OCULTA = /(^id$|_id$|^creado_|^modificado_|correo|telefono|ruta|firma|imagen|logo|eslogan|clave|token)/i;
  // Generación con IA desde el visor (Edge Function con clave de Anthropic): apagada; los manuales
  // escritos viven en web/manuales/<módulo>.json y se completan con ejemplos de la información actual.
  const CON_IA = false;
  const TIPO_ICONO = { portada: 'ti-book', indice: 'ti-list', concepto: 'ti-route', pantalla: 'ti-app-window', pasos: 'ti-list-numbers', ejemplo: 'ti-table', consejos: 'ti-bulb', cierre: 'ti-flag', grupo: 'ti-folders', opcion: 'ti-app-window', desarrollo: 'ti-hourglass' };

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

  // ---------- Manual completo ----------
  const MESES_TXT = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  async function valores(sb) {
    const yo = window.FIN.perfil() || {};
    const loc = window.BANCOS?.seleccion?.loc || yo.localidad_id;
    const v = { usuario: yo.usuario || '', hoy: new Date().toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' }), anio: String(new Date().getFullYear()), mes: MESES_TXT[new Date().getMonth()] };
    const uno = async (t, campos, f = (q) => q, orden = 'id', asc = true) => { try { const { data } = await f(sb.from(t).select(campos)).order(orden, { ascending: asc }).limit(1); return data?.[0] || null; } catch { return null; } };
    const enLoc = (q) => (loc ? q.eq('localidad_id', loc) : q);
    const l = loc ? await uno('localidades', 'id, codigo, nombre_comercial, organizacion_id', (q) => q.eq('id', loc)) : null;
    v.empresa = l ? `${l.codigo} · ${l.nombre_comercial}` : 'la empresa';
    const o = l ? await uno('organizaciones', 'nombre', (q) => q.eq('id', l.organizacion_id)) : null;
    v.organizacion = o?.nombre || 'la organización';
    const [p, bo, cl, pr, cb, ve, tp, pa, fa, co, re, ca, tr, cc] = await Promise.all([
      uno('productos', 'codigo, codigo_producto, nombre', (q) => enLoc(q).eq('estado', 'ACTIVO')),
      uno('bodegas', 'codigo, nombre', enLoc, 'codigo'),
      uno('clientes', 'codigo, nombre, documento', enLoc, 'codigo'),
      uno('proveedores', 'codigo, nombre_comercial, nit', enLoc, 'codigo'),
      uno('cuentas_bancarias', 'numero, nombre', enLoc),
      uno('vendedores', 'codigo, nombre', enLoc, 'codigo'),
      uno('tipos_precio', 'codigo, nombre', enLoc, 'codigo'),
      uno('partidas', 'numero, anio, mes, fecha, descripcion, total_debe', (q) => enLoc(q).eq('estado', 'VIGENTE'), 'fecha', false),
      uno('facturas_venta', 'serie, numero_dte, no_interno, numero, nombre, total, fecha_emision', (q) => enLoc(q).neq('estado', 'ANULADA'), 'fecha_emision', false),
      uno('compras', 'serie, documento, numero, proveedor_nombre, valor_total, fecha_documento', (q) => enLoc(q).eq('estado', 'ACTIVA'), 'fecha_documento', false),
      uno('recibos_venta', 'serie, recibo_fisico, nombre, valor, fecha', enLoc, 'fecha', false),
      uno('cajas_chicas', 'codigo, nombre, monto_fondo', enLoc, 'codigo'),
      uno('transacciones_contables', 'numero, descripcion', enLoc, 'numero'),
      uno('cuentas', 'codigo, nombre', (q) => q.eq('integra', false), 'codigo')
    ]);
    const q = (n) => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    v.producto = p ? `${p.nombre} (${p.codigo_producto || p.codigo})` : 'un producto del catálogo';
    v.codigoProducto = p ? (p.codigo_producto || String(p.codigo)) : 'el código del producto';
    v.bodega = bo ? `${bo.codigo} · ${bo.nombre}` : 'la bodega principal';
    v.cliente = cl ? `${cl.nombre}${cl.documento ? ` (NIT ${cl.documento})` : ''}` : 'un cliente del catálogo';
    v.proveedor = pr ? `${pr.nombre_comercial}${pr.nit ? ` (NIT ${pr.nit})` : ''}` : 'un proveedor del catálogo';
    v.cuentaBancaria = cb ? `${cb.numero}${cb.nombre ? ` · ${cb.nombre}` : ''}` : 'la cuenta bancaria';
    v.vendedor = ve ? ve.nombre : 'el vendedor';
    v.tipoPrecio = tp ? tp.nombre : 'el tipo de precio';
    v.partida = pa ? `partida ${pa.numero} de ${MESES_TXT[(pa.mes || 1) - 1]} ${pa.anio} («${(pa.descripcion || '').slice(0, 50)}», ${q(pa.total_debe)})` : 'una partida del mes';
    v.factura = fa ? `factura ${[fa.serie, fa.numero_dte].filter(Boolean).join('-') || fa.no_interno || fa.numero} de ${fa.nombre || ''} por ${q(fa.total)}` : 'una factura del mes';
    v.compra = co ? `compra ${[co.serie, co.documento].filter(Boolean).join('-') || co.numero} de ${co.proveedor_nombre || ''} por ${q(co.valor_total)}` : 'una compra del mes';
    v.recibo = re ? `recibo ${[re.serie, re.recibo_fisico].filter(Boolean).join('-')} de ${re.nombre || ''} por ${q(re.valor)}` : 'un recibo de cobro';
    v.caja = ca ? `Caja ${ca.codigo} · ${ca.nombre} (fondo ${q(ca.monto_fondo)})` : 'la caja chica';
    v.transaccion = tr ? `${tr.numero} · ${tr.descripcion}` : 'la transacción contable';
    v.cuenta = cc ? `${cc.codigo} · ${cc.nombre}` : 'una cuenta de movimiento';
    return v;
  }
  const llenar = (t, v) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));

  // Pasos generales cuando una opción aún no tiene guía escrita (según el grupo del menú).
  function pasosGenerales(g, p, ruta, m) {
    const abrir = `Abre ${m.corto} › «${g.grupo}» › «${ruta.replace(/ › /g, '» › «')}» › «${p.nombre}».`;
    if (g.id === 'reportes') return [abrir, 'Elige la organización y la localidad ({empresa}) y los parámetros (fechas, cuenta, producto o cliente según el reporte).', 'Revisa la vista previa con sus totales y gráficas.', 'Presiona «PDF» para imprimir o «Excel» para descargar el reporte con los mismos parámetros.'];
    if (g.id === 'catalogos') return [abrir, 'Elige la organización y la localidad ({empresa}); cada empresa tiene su propio catálogo.', 'Busca el registro en la lista o presiona «Nuevo» para crearlo.', 'Llena los campos obligatorios (*) y presiona «Guardar».', 'Para cambiarlo, selecciónalo, presiona «Modificar», corrige y guarda; para darlo de baja cambia su estado a inactivo.'];
    return [abrir, 'Elige la organización y la localidad ({empresa}) y los filtros de fecha o estado.', 'Presiona «Nuevo» (o selecciona un registro y «Modificar»), llena los campos obligatorios (*) y el detalle.', 'Presiona «Guardar» y luego procesa, aplica o imprime según corresponda.', 'Revisa el resultado en el listado y en los reportes del módulo.'];
  }

  // Manual completo: portada, índice, conceptos, cada grupo del menú con cada opción (pantalla en vivo y paso a
  // paso), las opciones en desarrollo, la información actual, consejos y cierre.
  function completo(m, estructura, escrito, guias, datos, v) {
    const d = [], vistos = new Set();
    const vacio = { titulo: '', columnas: [], filas: [] };
    const dia = (o) => d.push({ subtitulo: '', puntos: [], pasos: [], ejemplo: vacio, nota: '', ...o });
    const esc0 = escrito?.diapositivas || [];
    const port = esc0.find((x) => x.tipo === 'portada');
    dia({ tipo: 'portada', titulo: port?.titulo || `Módulo ${m.nombre}`, subtitulo: port?.subtitulo || m.descripcion || '', nota: `Manual opción por opción con ejemplos de ${v.empresa} · ${v.organizacion}` });
    dia({ tipo: 'indice', titulo: 'Contenido', puntos: estructura.map((g) => `${g.grupo}: ${[...g.subgrupos.flatMap((s) => s.pantallas.map((p) => p.nombre)), ...g.opciones].filter((x, i, a) => a.indexOf(x) === i).join(', ')}`) });
    esc0.filter((x) => x.tipo === 'concepto').forEach((x) => dia({ ...x, pasos: (x.pasos || []).map((t) => llenar(t, v)), puntos: (x.puntos || []).map((t) => llenar(t, v)) }));
    estructura.forEach((g) => {
      const pants = g.subgrupos.flatMap((s) => s.pantallas);
      dia({ tipo: 'grupo', titulo: g.grupo, subtitulo: `${m.corto} › ${g.grupo}`, puntos: [...g.subgrupos.map((s) => `${s.subgrupo}: ${s.pantallas.map((p) => p.nombre).join(', ')}`), ...(g.opciones.length ? [`En desarrollo: ${g.opciones.join(', ')}`] : [])] });
      pants.forEach((p) => {
        if (vistos.has(p.id)) return; vistos.add(p.id);
        const gu = guias[p.id] || {};
        const ruta = p.ruta.replace(/ · /g, ' › ');
        dia({ tipo: 'opcion', titulo: p.nombre, subtitulo: `${m.corto} › ${g.grupo} › ${ruta}`, vista: window.PANTALLAS?.[p.id] ? p.id : '',
          puntos: (gu.puntos || [p.descripcion]).filter(Boolean).map((t) => llenar(t, v)),
          pasos: (gu.pasos || pasosGenerales(g, p, ruta, m)).map((t) => llenar(t, v)),
          nota: llenar(gu.nota || '', v) });
      });
      if (g.opciones.length) dia({ tipo: 'desarrollo', titulo: `${g.grupo}: opciones en desarrollo`, subtitulo: `${m.corto} › ${g.grupo}`, puntos: g.opciones.map((o) => `${o}: ${llenar(guias[`${m.id}|${o}`] || 'opción planificada; todavía no tiene pantalla. Al tocarla, el sistema avisa «en construcción».', v)}`) });
    });
    Object.entries(datos).filter(([t]) => !(escrito?.sinEjemplos || []).includes(t)).forEach(([t, x]) => dia({ tipo: 'ejemplo', titulo: `Información actual: ${escrito?.nombresTablas?.[t] || nombreTabla(t)}`, subtitulo: `${x.total} registro(s) en el sistema · ${v.empresa}`, ejemplo: { titulo: '', columnas: x.columnas, filas: x.filas } }));
    const cons = esc0.find((x) => x.tipo === 'consejos');
    dia(cons ? { ...cons, puntos: (cons.puntos || []).map((t) => llenar(t, v)) } : { tipo: 'consejos', titulo: 'Buenas prácticas', puntos: ['Los campos con * son obligatorios.', 'Los documentos procesados no se modifican: revierte o anula primero.', 'Cada empresa (localidad) tiene sus propios catálogos y correlativos.'] });
    const fin = esc0.find((x) => x.tipo === 'cierre');
    dia(fin || { tipo: 'cierre', titulo: '¡Listo para operar!', subtitulo: `Consulta este manual en ${m.corto} › Ayuda › Manual del módulo` });
    return { titulo: escrito?.titulo || `Manual del módulo ${m.nombre}`, resumen: escrito?.resumen || m.descripcion || '', diapositivas: d };
  }

  // Pantalla en vivo dentro de la diapositiva: la misma pantalla del sistema con la empresa activa, reducida y sin
  // poder tocarla (es la «imagen» de la opción con su información real).
  function montarVista(fondo) {
    const marco = fondo.querySelector('[data-vista]');
    if (!marco) return;
    const id = marco.dataset.vista, fn = window.PANTALLAS?.[id];
    if (!fn) return;
    const ANCHO = 1500;
    const lienzo = document.createElement('div');
    lienzo.className = 'mm-vista-lienzo';
    lienzo.style.width = `${ANCHO}px`;
    marco.appendChild(lienzo);
    try { fn(lienzo, estado.m); } catch (e) { marco.innerHTML = `<p class="mm-vista-error">No se pudo mostrar la pantalla: ${esc(e.message)}</p>`; return; }
    const escalar = () => { const k = marco.clientWidth / ANCHO; lienzo.style.transform = `scale(${k})`; marco.style.height = `${Math.min(lienzo.scrollHeight, 900) * k}px`; };
    escalar();
    const ro = new ResizeObserver(escalar); ro.observe(lienzo); ro.observe(marco);
    marco._ro = ro;
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
          ${s.vista ? `<figure class="mm-vista-fig"><figcaption><i class="ti ti-photo" aria-hidden="true"></i> Pantalla «${esc(s.titulo)}» con la información de ${esc(estado.v?.empresa || 'la empresa')}</figcaption>${estado.imprimiendo ? '<p class="mm-vista-nota">La pantalla en vivo se ve en el visor del manual.</p>' : `<div class="mm-vista" data-vista="${esc(s.vista)}" inert></div>`}</figure>` : ''}
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
          <div class="mm-titulo"><i class="ti ti-presentation" aria-hidden="true"></i><div><b>${esc(manual.titulo)}</b><small>${origen === 'IA' ? `Generado con IA (${esc(estado.modelo || 'Claude')}) · ${esc(estado.fecha || '')}` : origen === 'COMPLETO' ? `Manual opción por opción · ${esc(estado.v?.empresa || '')} · pantallas en vivo` : origen === 'GUIA' ? `Manual del módulo · versión ${esc(estado.version || '')} · con ejemplos de la información actual` : 'Manual automático'}</small></div></div>
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
    montarVista(fondo);
  }
  function imprimirManual() {
    const { manual } = estado;
    // Se imprime en un marco oculto de la misma página (ver «marcoImpresion» en bancos.js): no bloquea el sitio.
    const { v, imprimirYa } = window.FIN_IMPRESION();
    const guardado = estado.i;
    estado.imprimiendo = true;
    const paginas = manual.diapositivas.map((s, k) => diapositiva(s, k + 1, manual.diapositivas.length)).join('');
    estado.imprimiendo = false;
    estado.i = guardado;
    v.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(manual.titulo)}</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
      <style>@page{size:A4 landscape;margin:10mm}body{font:14px/1.45 Arial,sans-serif;color:#111;margin:0}
      .mm-dia{page-break-after:always;height:180mm;display:flex;flex-direction:column;border:1px solid #c9d6e6;border-radius:10px;padding:14mm 16mm;box-sizing:border-box;margin-bottom:8mm}
      .mm-dia header{display:flex;gap:12px;align-items:center;border-bottom:3px solid #8b1a1a;padding-bottom:8px}.mm-dia h2{margin:0;font-size:24px;color:#8b1a1a}.mm-dia header p{margin:2px 0 0;color:#555}
      .mm-tipo{font-size:28px;color:#1f5fa8}.mm-cuerpo{flex:1;padding-top:10px;font-size:15px}.mm-cuerpo li{margin:5px 0}.mm-pasos li{margin:7px 0}
      table{border-collapse:collapse;width:100%;font-size:12px;margin-top:8px}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left}th{background:#e1eefb}
      footer{display:flex;justify-content:space-between;color:#666;font-size:11px;border-top:1px solid #ddd;padding-top:6px}.mm-t-portada h2{font-size:34px}
      </style></head><body>${paginas}</body></html>`);
    v.document.close();
    setTimeout(imprimirYa, 900);
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
    const ver = encodeURIComponent(document.querySelector('script[src*="manual_modulo.js"]')?.src.split('v=')[1] || '');
    const leer = (ruta) => fetch(`${ruta}?v=${ver}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const [datos, escrito, guias, v] = await Promise.all([ejemplos(sb, window.BANCOS?.seleccion?.loc || window.FIN.perfil()?.localidad_id), leer(`manuales/${m.id}.json`), leer('manuales/guias.json'), valores(sb)]);
    if (!document.body.contains(fondo)) return;
    estado = { m, estructura, v, manual: completo(m, estructura, escrito, guias || {}, datos, v), origen: 'COMPLETO', version: escrito?.version, i: 0 };
    if (document.body.contains(fondo)) pintar();
  }
  window.MANUAL = { abrir, _modulo: null };
})();
