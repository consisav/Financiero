// Contabilidad · Procesos · Generación de Cierres (script 206).
//   Transacciones por módulo: cada transacción contable queda asociada a un módulo; la asignación inicial sale de la
//   descripción (y de los documentos que la usan) y se cambia a mano.
//   Cierre Preliminar: se elige el mes y el módulo; por cada transacción del módulo muestra los documentos del mes
//   pendientes de póliza y genera (o reversa) una póliza integrada por transacción.
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};

  const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const MODULOS = [
    ['VENTAS', 'Ventas', 'ti-receipt'], ['COMPRAS', 'Compras', 'ti-shopping-cart'], ['INVENTARIOS', 'Inventarios', 'ti-packages'],
    ['CAJA Y BANCOS', 'Caja y bancos', 'ti-building-bank'], ['NÓMINAS', 'Nóminas', 'ti-users'], ['CONTABILIDAD', 'Contabilidad', 'ti-calculator'],
    ['ACTIVOS FIJOS', 'Activos fijos', 'ti-building'], ['IMPORTACIONES', 'Importaciones', 'ti-world']
  ];
  const SIN = '';
  const nombreMod = (m) => (MODULOS.find((x) => x[0] === m) || [m, 'Sin módulo'])[1];
  const iconoMod = (m) => (MODULOS.find((x) => x[0] === m) || [0, 0, 'ti-help-circle'])[2];
  const q = (n) => `Q ${fmt.monto(Number(n) || 0)}`;
  const hoyAM = () => { const h = fmt.hoy(); return { anio: Number(h.slice(0, 4)), mes: Number(h.slice(5, 7)) }; };
  const finMes = (a, m) => new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  const dmy = (iso) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
  const falta206 = (e) => /modulo_cierre|con_preliminar|con_cierre_preliminar|con_asignar_modulos|cierres_preliminares/.test(e?.message || '');
  const errorTxt = (e) => (falta206(e) ? 'Falta instalar el script 206 (Cierre preliminar) en Supabase.' : window.UI.traducirError(e));
  // Módulo elegido: se conserva al cambiar de pantalla.
  const estado = { modulo: 'VENTAS', cierre: '*' };
  // Módulos principales del catálogo (Administración · Módulos) y el módulo de cierre que agrupa sus transacciones.
  const CIERRE_DE_SIGLAS = { CON: 'CONTABILIDAD', FAC: 'VENTAS', INV: 'INVENTARIOS', NOM: 'NÓMINAS', ACT: 'ACTIVOS FIJOS', IMP: 'IMPORTACIONES', CYB: 'CAJA Y BANCOS', COM: 'COMPRAS' };
  const ICONO_SIGLAS = { CON: 'ti-calculator', FAC: 'ti-receipt', INV: 'ti-packages', NOM: 'ti-users', ACT: 'ti-building', IMP: 'ti-world', SAT: 'ti-file-certificate', CAR: 'ti-wallet', CYB: 'ti-building-bank', COM: 'ti-shopping-cart' };
  const titulo = (t) => String(t || '').toLowerCase().split(' ').map((w, i) => (['sat', 'iva', 'isr'].includes(w) ? w.toUpperCase() : i && ['y', 'e', 'de', 'del'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

  // ===================== Transacciones por módulo =====================
  window.PANTALLAS['con-transacciones-modulo'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Transacciones por módulo', icono: 'ti-arrows-exchange', clase: 'bk-movimientos bm-solo cx-rep cp-espacio', grupo: 'Contabilidad · Objetos contables' });
    const { sb } = ctx;
    let trx = []; let buscar = '';
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-arrows-exchange'); return; }
      ctx.filtros('', ctx.admin ? `<button type="button" class="boton secundario-sm" data-asignar="vacias" title="Asigna el módulo a las transacciones que no lo tienen, según su descripción"><i class="ti ti-wand" aria-hidden="true"></i> Asignar sin módulo</button>
        <button type="button" class="boton secundario-sm" data-asignar="todas" title="Vuelve a asignar todas según su descripción (reemplaza los cambios manuales)"><i class="ti ti-refresh" aria-hidden="true"></i> Reasignar todas</button>` : '');
      ctx.pDet.innerHTML = '<p class="vacio">Cargando transacciones…</p>';
      const { data, error } = await sb.from('transacciones_contables').select('id, numero, descripcion, estado, aplica_poliza, modulo_cierre').eq('localidad_id', ctx.sel.loc).order('numero');
      if (error) { ctx.pDet.innerHTML = `<p class="vacio">${esc(errorTxt(error))}</p>`; return; }
      trx = data || [];
      if (!trx.length) { ctx.pDet.innerHTML = ctx.vacio('La empresa no tiene transacciones contables. Créalas en Objetos contables › Transacciones.', 'ti-arrows-exchange'); return; }
      pintar();
    }
    const deMod = (m) => trx.filter((t) => (t.modulo_cierre || SIN) === m);
    function pintar() {
      const sin = deMod(SIN).length;
      if (estado.modulo !== '*' && !deMod(estado.modulo).length && estado.modulo !== SIN) estado.modulo = (MODULOS.find((m) => deMod(m[0]).length) || ['*'])[0];
      const lista = [...MODULOS.filter((m) => deMod(m[0]).length || ['VENTAS', 'COMPRAS', 'INVENTARIOS', 'CAJA Y BANCOS', 'NÓMINAS', 'CONTABILIDAD'].includes(m[0])).map((m) => [m[0], m[1], m[2], deMod(m[0]).length]),
        ...(sin ? [[SIN, 'Sin módulo', 'ti-alert-triangle', sin]] : []), ['*', 'Todas', 'ti-list', trx.length]];
      const txt = buscar.trim().toUpperCase();
      const filas = (estado.modulo === '*' ? trx : deMod(estado.modulo)).filter((t) => !txt || `${t.numero} ${t.descripcion}`.toUpperCase().includes(txt));
      const asignadas = trx.length - sin;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico cp-tm">
        <div class="cl-banda">Transacciones por módulo · ${esc(empresa())}</div>
        <p class="pr-guia"><i class="ti ti-info-circle" aria-hidden="true"></i> Cada módulo agrupa sus transacciones contables; el Cierre Preliminar genera las pólizas módulo por módulo con este agrupamiento. ${asignadas} de ${trx.length} transacciones tienen módulo${sin ? `; <b>${sin}</b> están sin módulo` : ''}.</p>
        <div class="cp-dos">
          <nav class="cp-modulos" aria-label="Módulos">${lista.map(([k, n, i, c]) => `<button type="button" class="cp-mod ${estado.modulo === k ? 'activo' : ''} ${k === SIN ? 'cp-sin' : ''}" data-mod="${esc(k)}"><i class="ti ${i}" aria-hidden="true"></i><span>${esc(n)}</span><b>${c}</b></button>`).join('')}</nav>
          <section class="cp-lista">
            <div class="cp-barra"><label class="campo cp-buscar"><span>Buscar</span><input type="search" name="buscar" value="${esc(buscar)}" placeholder="Número o descripción"></label><span class="cp-cuenta">${filas.length} transacción(es)</span></div>
            <div class="pc-lineas cp-tabla"><table><thead><tr><th class="num">#Trans</th><th>Descripción</th><th>Estado</th><th>Póliza</th><th>Módulo</th></tr></thead><tbody>
            ${filas.length ? filas.map((t) => `<tr data-id="${t.id}"><td class="num">${t.numero}</td><td>${esc(t.descripcion)}</td>
              <td><span class="pc-marca ${t.estado === 'ACTIVO' ? 'aprobada' : 'definitiva'}">${t.estado === 'ACTIVO' ? 'Activa' : 'Inactiva'}</span></td>
              <td>${t.aplica_poliza ? '<i class="ti ti-check cp-ok" aria-label="Aplica póliza"></i>' : '<span class="cp-tenue">No aplica</span>'}</td>
              <td>${ctx.admin ? `<select name="modulo" aria-label="Módulo de la transacción ${t.numero}"><option value="">Sin módulo</option>${MODULOS.map((m) => `<option value="${esc(m[0])}" ${t.modulo_cierre === m[0] ? 'selected' : ''}>${esc(m[1])}</option>`).join('')}</select>` : esc(nombreMod(t.modulo_cierre))}</td></tr>`).join('')
              : '<tr><td colspan="5" class="tk-vacio">No hay transacciones en este módulo.</td></tr>'}
            </tbody></table></div>
          </section>
        </div></div>`;
      window.CUENTAS_XLSX && window.CUENTAS_XLSX.ajustarAlto && window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    const empresa = () => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
    cont.addEventListener('change', async (e) => {
      const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar();
      if (e.target.name !== 'modulo') return;
      const tr = e.target.closest('tr[data-id]'); const t = trx.find((x) => x.id === Number(tr.dataset.id)); if (!t) return;
      const nuevo = e.target.value || null;
      const { error } = await sb.from('transacciones_contables').update({ modulo_cierre: nuevo }).eq('id', t.id);
      if (error) { e.target.value = t.modulo_cierre || ''; return window.FIN.aviso(errorTxt(error)); }
      t.modulo_cierre = nuevo;
      window.FIN.aviso(`${t.numero} pasa a ${nombreMod(nuevo)}`);
      pintar();
    });
    cont.addEventListener('input', (e) => { if (e.target.name === 'buscar') { buscar = e.target.value; const pos = e.target.selectionStart; pintar(); const i = cont.querySelector('input[name="buscar"]'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } } });
    cont.addEventListener('click', async (e) => {
      const m = e.target.closest('[data-mod]'); if (m) { estado.modulo = m.dataset.mod; return pintar(); }
      const a = e.target.closest('[data-asignar]'); if (!a) return;
      const todas = a.dataset.asignar === 'todas';
      if (todas && !confirm('¿Volver a asignar el módulo de todas las transacciones según su descripción? Se reemplazan los cambios hechos a mano.')) return;
      a.disabled = true;
      const { data, error } = await sb.rpc('con_asignar_modulos', { p_loc: ctx.sel.loc, p_solo_vacias: !todas });
      a.disabled = false;
      if (error) return window.FIN.aviso(errorTxt(error));
      window.FIN.aviso(data ? `${data} transacción(es) con módulo asignado` : 'No hubo transacciones que asignar');
      cargar();
    });
    iniciar();
  };

  // ===================== Cierre Preliminar =====================
  window.PANTALLAS['con-cierre-preliminar'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Cierre Preliminar', icono: 'ti-lock-open', clase: 'bk-movimientos bm-solo cx-rep cp-espacio', grupo: 'Contabilidad · Generación de Cierres' });
    const { sb } = ctx;
    const f = hoyAM();
    let res = null; const marcadas = new Set(); let avisos = []; let ocupado = false;
    // Pestañas: los módulos principales del catálogo con código del 1 al 9; si no se puede leer, los módulos de cierre.
    let pestanas = MODULOS.map(([k, n, i]) => ({ k, n, i }));
    async function cargarModulos() {
      const { data, error } = await sb.from('modulos_sistema').select('codigo, siglas, descripcion').is('modulo_mayor_id', null).eq('activo', true).gte('codigo', 1).lte('codigo', 9).order('codigo');
      if (error || !data?.length) return;
      pestanas = data.map((m) => ({ k: CIERRE_DE_SIGLAS[m.siglas] || 'CAT:' + m.siglas, n: titulo(m.descripcion), i: ICONO_SIGLAS[m.siglas] || 'ti-apps' }));
    }
    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargarModulos(); await cargar(); }
    async function cargar(conservarAvisos = false) {
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-lock-open'); return; }
      ctx.filtros(`<label class="campo cx-anio"><span>Año</span><input type="number" name="anio" min="2000" max="2999" value="${f.anio}"></label>`,
        '<a class="boton secundario-sm" href="#/contabilidad/con-transacciones-modulo"><i class="ti ti-arrows-exchange" aria-hidden="true"></i> Transacciones por módulo</a>');
      if (!conservarAvisos) avisos = [];
      ctx.pDet.innerHTML = '<p class="vacio">Revisando los documentos del mes…</p>';
      const { data, error } = await sb.rpc('con_preliminar_resumen', { p_loc: ctx.sel.loc, p_anio: f.anio, p_mes: f.mes });
      if (error) { ctx.pDet.innerHTML = `<p class="vacio">${esc(errorTxt(error))}</p>`; return; }
      res = data;
      // Marcadas por omisión: las que tienen documentos pendientes, aplican póliza y no están generadas.
      marcadas.clear();
      res.transacciones.forEach((t) => { if (t.pendientes > 0 && t.aplica_poliza && !t.generado && !t.sin_detalle) marcadas.add(t.id); });
      pintar();
    }
    const deMod = (m) => res.transacciones.filter((t) => m === '*' || (t.modulo || SIN) === m);
    const estadoTrx = (t) => {
      if (t.generado) return `<span class="pc-marca ${t.generado.definitiva ? 'definitiva' : 'aprobada'}" title="Generada por ${esc(t.generado.por || '')}">Póliza ${esc(t.generado.partida || '')}</span>${t.pendientes ? ` <span class="pc-marca pendiente" title="Documentos registrados después de generar la póliza">+${t.pendientes} nuevo(s)</span>` : ''}`;
      if (!t.aplica_poliza) return '<span class="cp-tenue">No aplica póliza</span>';
      if (t.sin_detalle) return `<span class="pc-marca anulada" title="Documentos sin detalle contable ni plantilla">${t.sin_detalle} sin detalle</span>`;
      if (Math.abs((t.debe || 0) - (t.haber || 0)) >= 0.005) return '<span class="pc-marca descuadrada">No cuadra</span>';
      if (t.pendientes) return '<span class="pc-marca pendiente">Pendiente</span>';
      return '<span class="cp-tenue">Sin documentos</span>';
    };
    function pintar() {
      const a = f.anio, m = f.mes, desde = `${a}-${String(m).padStart(2, '0')}-01`, hasta = finMes(a, m);
      const cerrado = res.cerrado;
      // Todos primero, después los módulos principales del catálogo (1 al 9) que tienen transacciones, en su orden,
      // y al final las transacciones que no tienen módulo definido.
      const mods = [{ k: '*', n: 'Todos', i: 'ti-list' }, ...pestanas, { k: SIN, n: 'Sin módulo', i: 'ti-alert-triangle' }]
        .map(({ k, n, i }) => { const ts = deMod(k); return { k, n, i, total: ts.length, pend: ts.filter((t) => t.pendientes).length, gen: ts.filter((t) => t.generado).length }; })
        .filter((x) => x.k === '*' || x.total);
      if (!mods.some((x) => x.k === estado.cierre)) estado.cierre = '*';
      const modAct = mods.find((x) => x.k === estado.cierre);
      const filas = deMod(estado.cierre);
      const todas = res.transacciones;
      const kp = { pend: todas.filter((t) => t.pendientes).length, docs: todas.reduce((s, t) => s + (t.pendientes || 0), 0), gen: todas.filter((t) => t.generado).length, prob: todas.filter((t) => t.sin_detalle || (t.pendientes && Math.abs((t.debe || 0) - (t.haber || 0)) >= 0.005)).length };
      const cls = { DEFINITIVO: 'cp-def', PRELIMINAR: 'cp-pre', PENDIENTE: '' };
      const tit = { DEFINITIVO: 'Cierre mensual definitivo', PRELIMINAR: 'Con pólizas preliminares', PENDIENTE: 'Sin pólizas preliminares' };
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico cp-cierre">
        <div class="cl-banda">Generación de pólizas · ${MES[m - 1]} ${a} · ${esc(empresa())}</div>
        <div class="cp-meses" role="group" aria-label="Mes">${res.meses.map((x) => `<button type="button" class="cp-mes ${cls[x.estado]} ${x.mes === m ? 'activo' : ''}" data-mes="${x.mes}" title="${tit[x.estado]}">${x.estado === 'DEFINITIVO' ? '<i class="ti ti-lock" aria-hidden="true"></i>' : x.estado === 'PRELIMINAR' ? '<i class="ti ti-circle-half-2" aria-hidden="true"></i>' : ''}${MES[x.mes - 1].slice(0, 3)}</button>`).join('')}</div>
        <div class="cp-leyenda"><span><i class="ti ti-lock" aria-hidden="true"></i> Definitivo (Cierre Mensual)</span><span><i class="ti ti-circle-half-2" aria-hidden="true"></i> Preliminar generado</span><span>Sin marca: pendiente</span><span class="cp-rango">Del <b>${dmy(desde)}</b> al <b>${dmy(hasta)}</b></span></div>
        ${cerrado ? '<p class="cp-aviso cp-error"><i class="ti ti-lock" aria-hidden="true"></i> El mes tiene cierre mensual definitivo: sus pólizas ya no se generan ni se reversan. Reábrelo en Cierre Mensual si necesitas cambiarlas.</p>' : ''}
        <div class="ec-kpis cp-kpis"><div class="ec-kpi"><small>Transacciones con pendientes</small><b>${kp.pend}</b></div><div class="ec-kpi"><small>Documentos pendientes</small><b>${kp.docs}</b></div><div class="ec-kpi ec-fin"><small>Pólizas generadas</small><b>${kp.gen}</b></div><div class="ec-kpi ${kp.prob ? 'ec-alerta' : ''}"><small>Con problemas</small><b>${kp.prob}</b></div></div>
        <div class="cp-modtabs" role="tablist" aria-label="Módulo">${mods.map((x) => `<button type="button" role="tab" aria-selected="${estado.cierre === x.k}" class="cp-modtab ${estado.cierre === x.k ? 'activo' : ''} ${x.k === SIN ? 'cp-sin' : ''}" data-mod="${esc(x.k)}"><i class="ti ${x.i}" aria-hidden="true"></i> ${esc(x.n)}${x.pend ? ` <b class="cp-num">${x.pend}</b>` : ''}${x.gen ? ` <span class="cp-gen" title="Pólizas generadas">${x.gen} ✓</span>` : ''}</button>`).join('')}</div>
        <h3 class="cp-modtitulo"><i class="ti ${modAct.i}" aria-hidden="true"></i> Módulo: ${esc(modAct.n)}</h3>
        <div class="pc-lineas cp-tabla"><table><thead><tr><th class="cp-chk"><input type="checkbox" data-todas aria-label="Marcar todas" ${filas.length && filas.filter(sel).every((t) => marcadas.has(t.id)) && filas.some(sel) ? 'checked' : ''}></th><th class="num">#Trans</th><th>Descripción</th><th>Aplica póliza</th><th class="num">Documentos</th><th class="num">Valor</th><th>Estado</th></tr></thead><tbody>
          ${filas.length ? filas.map((t) => `<tr data-id="${t.id}" class="${t.pendientes || t.generado ? '' : 'cp-vacia'}"><td class="cp-chk"><input type="checkbox" data-trx="${t.id}" ${marcadas.has(t.id) ? 'checked' : ''} ${sel(t) ? '' : 'disabled'} aria-label="Generar ${t.numero}"></td>
            <td class="num">${t.numero}</td><td>${esc(t.descripcion)}</td><td>${t.aplica_poliza ? '<i class="ti ti-check cp-ok" aria-label="Sí"></i>' : '<span class="cp-tenue">No</span>'}</td>
            <td class="num">${t.pendientes || (t.generado ? t.generado.documentos : '') || ''}</td><td class="num">${t.pendientes ? fmt.monto(t.debe) : t.generado ? fmt.monto(t.generado.total) : ''}</td><td>${estadoTrx(t)}</td></tr>`).join('')
            : '<tr><td colspan="7" class="tk-vacio">Este módulo no tiene transacciones. Asígnalas en Transacciones por módulo.</td></tr>'}
        </tbody></table></div>
        <div class="cp-acciones">
          <button type="button" class="boton secundario-sm" data-acc="marcar"><i class="ti ti-checks" aria-hidden="true"></i> Marcar</button>
          <button type="button" class="boton secundario-sm" data-acc="desmarcar"><i class="ti ti-square" aria-hidden="true"></i> Desmarcar</button>
          <span class="cp-sel">${filas.filter((t) => marcadas.has(t.id)).length} marcada(s) en el módulo</span>
          ${ctx.admin ? `<button type="button" class="boton" data-acc="generar" ${cerrado ? 'aria-disabled="true"' : ''}><i class="ti ti-player-play" aria-hidden="true"></i> Generar pólizas</button>
          <button type="button" class="boton secundario-sm" data-acc="reversar" ${cerrado ? 'aria-disabled="true"' : ''}><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Reversar</button>` : '<span class="cp-tenue">Solo un administrador genera o reversa pólizas.</span>'}
        </div>
        <section class="cp-avisos" aria-live="polite"><h4>Avisos</h4>${avisos.length ? `<ul>${avisos.map((x) => `<li class="cp-av-${x.tipo}"><i class="ti ${x.tipo === 'ok' ? 'ti-circle-check' : x.tipo === 'error' ? 'ti-alert-circle' : 'ti-info-circle'}" aria-hidden="true"></i>${x.t ? `<b>${esc(x.t)}</b> · ` : ''}${esc(x.msg)}</li>`).join('')}</ul>` : '<p class="cp-tenue">Marca las transacciones del módulo y genera sus pólizas: cada transacción integra en una póliza los documentos del mes que aún no tienen partida.</p>'}</section>
      </div>`;
      window.CUENTAS_XLSX && window.CUENTAS_XLSX.ajustarAlto && window.CUENTAS_XLSX.ajustarAlto(cont);
    }
    // Se puede marcar para generar (con pendientes) o para reversar (generada).
    const sel = (t) => (t.pendientes > 0 && t.aplica_poliza) || !!t.generado;
    const empresa = () => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
    async function ejecutar(accion) {
      if (ocupado) return;
      if (res.cerrado) return window.FIN.aviso('El mes tiene cierre mensual definitivo');
      const visibles = new Set(deMod(estado.cierre).map((t) => t.id));
      const ids = [...marcadas].filter((id) => visibles.has(id));
      const lista = res.transacciones.filter((t) => ids.includes(t.id));
      let envio;
      if (accion === 'GENERAR') {
        envio = lista.filter((t) => t.pendientes > 0 && t.aplica_poliza);
        if (!envio.length) return window.FIN.aviso('Marca transacciones con documentos pendientes');
        if (!confirm(`¿Generar ${envio.length} póliza(s) preliminar(es) de ${MES[f.mes - 1]} ${f.anio} con ${envio.reduce((s, t) => s + t.pendientes, 0)} documento(s)?`)) return;
      } else {
        envio = lista.filter((t) => t.generado);
        if (!envio.length) return window.FIN.aviso('Marca transacciones con póliza generada');
        if (!confirm(`¿Reversar ${envio.length} póliza(s) preliminar(es) de ${MES[f.mes - 1]} ${f.anio}? Se anulan y sus documentos vuelven a quedar pendientes.`)) return;
      }
      ocupado = true;
      cont.querySelectorAll('[data-acc]').forEach((b) => { b.disabled = true; });
      const { data, error } = await sb.rpc('con_cierre_preliminar', { p_loc: ctx.sel.loc, p_anio: f.anio, p_mes: f.mes, p_accion: accion, p_transacciones: envio.map((t) => t.id) });
      ocupado = false;
      if (error) { cont.querySelectorAll('[data-acc]').forEach((b) => { b.disabled = false; }); return window.FIN.aviso(errorTxt(error)); }
      avisos = data.avisos || [];
      const n = accion === 'GENERAR' ? data.generadas : data.reversadas;
      window.FIN.aviso(accion === 'GENERAR' ? `${n} póliza(s) generada(s)` : `${n} póliza(s) reversada(s)`);
      await cargar(true);
    }
    cont.addEventListener('change', (e) => {
      const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') return cargar();
      if (e.target.name === 'anio') { f.anio = Number(e.target.value) || f.anio; return cargar(); }
      if (e.target.dataset.trx) { const id = Number(e.target.dataset.trx); if (e.target.checked) marcadas.add(id); else marcadas.delete(id); return pintar(); }
      if ('todas' in e.target.dataset) { deMod(estado.cierre).filter(sel).forEach((t) => (e.target.checked ? marcadas.add(t.id) : marcadas.delete(t.id))); pintar(); }
    });
    cont.addEventListener('click', (e) => {
      const ms = e.target.closest('[data-mes]'); if (ms) { f.mes = Number(ms.dataset.mes); return cargar(); }
      const md = e.target.closest('[data-mod]'); if (md) { estado.cierre = md.dataset.mod; return pintar(); }
      const ac = e.target.closest('[data-acc]'); if (!ac) return;
      const ts = deMod(estado.cierre);
      if (ac.dataset.acc === 'marcar') { ts.filter((t) => t.pendientes > 0 && t.aplica_poliza && !t.generado).forEach((t) => marcadas.add(t.id)); return pintar(); }
      if (ac.dataset.acc === 'desmarcar') { ts.forEach((t) => marcadas.delete(t.id)); return pintar(); }
      if (ac.dataset.acc === 'generar') return ejecutar('GENERAR');
      if (ac.dataset.acc === 'reversar') return ejecutar('REVERSAR');
    });
    iniciar();
  };
})();
