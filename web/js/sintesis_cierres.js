// Reportes y gráficas · Cierre y análisis · Síntesis por cuenta y Síntesis por centro de costo (datos del sistema anterior, scripts 215 y 216).
//   Las dos pantallas comparten el código; cambian la tabla del detalle (saldos_cierre o saldos_cierre_centros), el catálogo
//   (cuentas o centros de costo) y, en la de centros, el maestro muestra solo los cierres por centros (clasificación E).
//   Maestro: los cierres de la empresa (CON_CIERRES + CON_TIPOS_CIERRES) por año, mes y tipo.
//   Detalle: los saldos del cierre elegido (CON_SALDOS_CIERRE) por cuenta, con filtro de cuenta (una y sus hijas, o todas)
//   y de nivel (todos, hasta uno o solo uno), indentados por nivel. El saldo de cada cuenta mayor es el que guardó el sistema anterior.
//   PDF y Excel con el encabezado del cierre y el detalle. Usa window.CONTA (contabilidad_cierre.js).
(function () {
  const { esc } = window.UI;
  const { montar, fmt } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const C = () => window.CONTA;
  const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const col = (titulo, tipo, ancho) => ({ titulo, tipo, ancho });
  const sang = (n) => ' '.repeat(Math.max(0, n) * 4);
  const mesDe = (m) => MES[m - 1] || `Mes ${m}`;
  const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') : '');
  const empresaDe = (ctx) => { const e = ctx.localidad(ctx.sel.loc); return e ? `${e.codigo} · ${e.nombre_comercial}` : ''; };
  const codigo = (v) => String(v || '').split(' ')[0].trim();
  const clase = (t) => (t?.clasificacion === 'E' ? 'Por centros' : t?.definitivo ? 'Definitivo' : 'Previo');
  const sel = (n, lbl, ops, v) => `<label class="campo"><span>${lbl}</span><select name="${n}">${ops.map(([x, t]) => `<option value="${esc(String(x))}" ${String(v) === String(x) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;

  const MODOS = {
    cuenta: { titulo: 'Síntesis por cuenta', tabla: 'saldos_cierre', campo: 'cuenta_codigo', rel: 'cuentas', extra: 'version, ', etq: 'Cuenta', nombreEtq: 'Nombre de la cuenta', plural: 'cuentas',
      todas: 'Todas las cuentas', falta: '(cuenta no encontrada en el catálogo)', archivo: 'sintesis_cuenta', icono: 'ti-report-search', maestro: () => true, mensual: false, lista: 'sc-cuentas' },
    centro: { titulo: 'Síntesis por centro de costo', tabla: 'saldos_cierre_centros', campo: 'centro_codigo', rel: 'centros_costo', extra: 'saldo_mensual, saldo_mensual_mi, ', etq: 'Centro de costo', nombreEtq: 'Nombre del centro de costo', plural: 'centros',
      todas: 'Todos los centros', falta: '(centro no encontrado en el catálogo)', archivo: 'sintesis_centro', icono: 'ti-sitemap', maestro: (c) => c.tipos_cierre?.clasificacion === 'E', mensual: true, lista: 'sc-centros' },
  };

  function pantalla(cont, M) {
    const ctx = montar(cont, { titulo: M.titulo, icono: M.icono, clase: `bk-movimientos bm-solo cx-rep pr-rep cr-conta sc-sintesis${M.mensual ? ' sc-centros' : ''}`, grupo: 'Contabilidad · Reportes · Cierre y análisis' });
    const { sb } = ctx;
    const f = { anio: '', mes: '', tipo: '', cuenta: '', nivel: '', mon: 'L' };
    let cierres = [], actual = null, saldos = [], claveSaldos = '', cfg = null;

    async function iniciar() { if (!(await ctx.cargarBase())) return; await cargar(); }
    async function cargar() {
      cierres = []; actual = null; saldos = []; claveSaldos = '';
      if (!ctx.sel.loc) { ctx.filtros(''); ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-report-search'); return; }
      ctx.pDet.innerHTML = '<p class="vacio">Leyendo los cierres…</p>';
      const r = await sb.from('cierres_contables_anteriores').select('id, anio, mes, tipo_cierre, resultado_ejercicio, fecha, usuario, tipos_cierre(descripcion, definitivo, frecuencia, clasificacion)')
        .eq('localidad_id', ctx.sel.loc).order('anio', { ascending: false }).order('mes', { ascending: false }).order('tipo_cierre');
      if (r.error) { ctx.filtros(''); ctx.pDet.innerHTML = `<p class="vacio">${/cierres_contables_anteriores|tipos_cierre/.test(r.error.message) ? 'Falta instalar el script 215 (cierres del sistema anterior) en Supabase.' : esc(r.error.message)}</p>`; return; }
      cierres = (r.data || []).filter(M.maestro);
      // Año por omisión: el más reciente con cierres.
      if (!f.anio || (f.anio !== '*' && !cierres.some((c) => String(c.anio) === String(f.anio)))) f.anio = cierres.length ? String(cierres[0].anio) : '*';
      await pintar();
    }

    const filtrados = () => cierres.filter((c) => (f.anio === '*' || String(c.anio) === String(f.anio)) && (!f.mes || String(c.mes) === String(f.mes)) && (!f.tipo || String(c.tipo_cierre) === String(f.tipo)));

    function barraFiltros() {
      const anios = [...new Set(cierres.map((c) => c.anio))].sort((a, b) => b - a);
      const tipos = new Map(); cierres.forEach((c) => tipos.set(c.tipo_cierre, c.tipos_cierre?.descripcion || ''));
      const niveles = [...new Set(saldos.map((s) => s.nivel))].sort((a, b) => a - b);
      ctx.filtros(`${sel('anio', 'Año', [['*', 'Todos'], ...anios.map((a) => [a, a])], f.anio)}
        ${sel('mes', 'Mes', [['', 'Todos'], ...MES.map((m, i) => [i + 1, m])], f.mes)}
        ${sel('tipo', 'Tipo de cierre', [['', 'Todos'], ...[...tipos.entries()].sort((a, b) => a[0] - b[0]).map(([k, d]) => [k, `${k} · ${d}`])], f.tipo)}
        <label class="campo cx-prov pr-prod"><span>${M.etq}</span><input name="cuenta" list="${M.lista}" value="${esc(f.cuenta)}" placeholder="${M.todas}" autocomplete="off"></label>
        <datalist id="${M.lista}">${saldos.map((s) => `<option value="${esc(s.codigo)}">${esc(s.nombre)}</option>`).join('')}</datalist>
        ${sel('nivel', 'Nivel', [['', 'Todos'], ...niveles.map((n) => ['h' + n, `Hasta nivel ${n}`]), ...niveles.map((n) => ['s' + n, `Solo nivel ${n}`])], f.nivel)}
        ${sel('mon', 'Moneda', [['L', 'Local'], ['E', 'Extranjera']], f.mon)}`, C().botonesExp);
    }

    // Saldos del cierre elegido, con nombre y nivel de la cuenta (del catálogo; si no está, por los códigos que la contienen).
    async function leerSaldos() {
      if (!actual) { saldos = []; claveSaldos = ''; return; }
      const k = `${ctx.sel.loc}|${actual.anio}|${actual.mes}|${actual.tipo_cierre}`;
      if (k === claveSaldos) return;
      const leidas = await C().leerTodo(() => sb.from(M.tabla).select(`${M.campo}, ${M.extra}saldo_anterior, debitos, creditos, saldo_actual, saldo_anterior_mi, debitos_mi, creditos_mi, saldo_actual_mi, ${M.rel}(nombre, nivel, integra)`)
        .eq('localidad_id', ctx.sel.loc).eq('anio', actual.anio).eq('mes', actual.mes).eq('tipo_cierre', actual.tipo_cierre).order(M.campo));
      const filas = leidas.map((s) => ({ ...s, cuenta_codigo: s[M.campo], cat: s[M.rel] }));
      // Sin nivel en el catálogo: uno más que la cuenta madre más cercana (el código más largo que la contiene).
      const niv = new Map();
      [...filas].sort((a, b) => a.cuenta_codigo.length - b.cuenta_codigo.length).forEach((s) => {
        const madre = [...niv.keys()].filter((c) => c !== s.cuenta_codigo && s.cuenta_codigo.startsWith(c)).sort((a, b) => b.length - a.length)[0];
        niv.set(s.cuenta_codigo, num(s.cat?.nivel) || (madre ? niv.get(madre) + 1 : 1));
      });
      // Cuenta madre (va en negrilla): la que tiene alguna subcuenta en el cierre (código que la contiene y de mayor nivel).
      const madres = new Set();
      niv.forEach((n, c) => { for (let i = c.length - 1; i > 0; i -= 1) { const p = c.slice(0, i); if (niv.has(p) && niv.get(p) < n) madres.add(p); } });
      saldos = filas.map((s) => ({ ...s, codigo: s.cuenta_codigo, nombre: s.cat?.nombre || M.falta, nivel: niv.get(s.cuenta_codigo), madre: madres.has(s.cuenta_codigo) || !!s.cat?.integra }));
      claveSaldos = k;
    }

    // Filas del detalle: la cuenta pedida y sus hijas (por prefijo del código), hasta el nivel pedido, indentadas por nivel.
    function detalle() {
      const ext = f.mon === 'E', v = (s, c) => num(ext ? s[`${c}_mi`] : s[c]);
      let xs = saldos.filter((s) => !f.cuenta || s.codigo.startsWith(f.cuenta));
      const nN = Number(f.nivel.slice(1)), solo = f.nivel[0] === 's';
      if (f.nivel) xs = xs.filter((s) => (solo ? s.nivel === nN : s.nivel <= nN));
      const base = xs.length ? Math.min(...xs.map((s) => s.nivel)) : 1;
      // Para los totales solo cuentan las cuentas sin una cuenta madre en la lista (así no se suma dos veces).
      // Madre = cuenta de la lista de menor nivel cuyo código contiene al de la cuenta (601010 no es madre de 6010104: son del mismo nivel).
      const raiz = (s) => !xs.some((c) => c.nivel < s.nivel && s.codigo.startsWith(c.codigo));
      const t = { sa: 0, de: 0, cr: 0, sx: 0, sm: 0 };
      const filas = xs.map((s) => {
        const top = raiz(s);
        if (top) { t.sa += v(s, 'saldo_anterior'); t.de += v(s, 'debitos'); t.cr += v(s, 'creditos'); t.sx += v(s, 'saldo_actual'); if (M.mensual) t.sm += v(s, 'saldo_mensual'); }
        return { sangria: s.nivel - base, negrita: s.madre, valores: [s.codigo, `${sang(s.nivel - base)}${s.nombre}`, s.nivel, r2(v(s, 'saldo_anterior')), r2(v(s, 'debitos')), r2(v(s, 'creditos')), ...(M.mensual ? [r2(v(s, 'saldo_mensual'))] : []), r2(v(s, 'saldo_actual'))],
          tipo: s.nivel === base && xs.some((h) => h.nivel > s.nivel && h.codigo.startsWith(s.codigo)) ? 'subtotal' : undefined };
      });
      const uno = M.mensual ? 'centro' : 'cuenta';
      if (xs.length) filas.push({ valores: ['', `${f.cuenta ? `Total ${uno} ${f.cuenta}` : solo ? `Total de ${M.plural === 'cuentas' ? 'las cuentas' : 'los centros'} de nivel ${nN}` : `Total de ${M.plural === 'cuentas' ? 'las cuentas' : 'los centros'} de primer nivel`}${f.cuenta && solo ? ` (nivel ${nN})` : ''}`, '', f.cuenta ? r2(t.sa) : '', r2(t.de), r2(t.cr), ...(M.mensual ? [r2(t.sm)] : []), f.cuenta ? r2(t.sx) : ''], tipo: 'total' });
      return { filas, n: xs.length, t };
    }

    async function pintar() {
      const lista = filtrados();
      if (!actual || !lista.includes(actual)) actual = lista[0] || null;
      ctx.pDet.innerHTML = '<p class="vacio">Leyendo los saldos del cierre…</p>';
      try { await leerSaldos(); } catch (e) { ctx.pDet.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; return; }
      if (f.nivel && !saldos.some((s) => String(s.nivel) === f.nivel.slice(1))) f.nivel = '';
      barraFiltros();
      if (!cierres.length) { cfg = null; ctx.pDet.innerHTML = ctx.vacio(`${empresaDe(ctx) || 'La empresa'} no tiene cierres${M.mensual ? ' por centros de costo' : ''} migrados del sistema anterior todavía (Hospital Miraflores: script 215; Futura Farma: script 216).`, 'ti-report-search'); return; }

      const maestro = { columnas: [col('Año', 'texto', 6), col('Mes', 'texto', 10), col('Tipo de cierre', 'texto', 30), col('Clase', 'texto', 10), col('Frecuencia', 'texto', 9), col('Resultado del ejercicio', 'monto', 15), col('Fecha', 'texto', 13), col('Usuario', 'texto', 8)],
        filas: lista.map((c) => ({ valores: [String(c.anio), mesDe(c.mes), `${c.tipo_cierre} · ${c.tipos_cierre?.descripcion || ''}`, clase(c.tipos_cierre), c.tipos_cierre?.frecuencia === 'A' ? 'Anual' : 'Mensual', r2(c.resultado_ejercicio), fechaHora(c.fecha), c.usuario || ''],
          attr: `data-cierre="${c.id}"${c === actual ? ' data-sel' : ''}` })), vacio: 'No hay cierres con esos filtros.' };
      const D = detalle();
      const tc = actual?.tipos_cierre;
      const titDet = actual ? `${mesDe(actual.mes)} ${actual.anio} · ${actual.tipo_cierre} ${tc?.descripcion || ''}` : '';
      cfg = { orgId: ctx.sel.org, locId: ctx.sel.loc, hoja: M.titulo, titulo: M.titulo,
        archivo: actual ? `${M.archivo}_${actual.anio}_${String(actual.mes).padStart(2, '0')}_tipo${actual.tipo_cierre}${f.cuenta ? `_${f.cuenta}` : ''}` : M.archivo,
        parametros: [`Empresa: ${empresaDe(ctx)}`, `Cierre: ${titDet}`, actual ? `${clase(tc)} · resultado del ejercicio Q ${fmt.monto(actual.resultado_ejercicio)} · ${fechaHora(actual.fecha)} · usuario ${actual.usuario || '—'}` : '',
          `${M.etq}: ${f.cuenta ? `${f.cuenta} y sus ${M.mensual ? 'subcentros' : 'subcuentas'}` : M.mensual ? 'todos' : 'todas'} · Nivel: ${f.nivel ? `${f.nivel[0] === 's' ? 'solo' : 'hasta'} ${f.nivel.slice(1)}` : 'todos'} · Moneda ${f.mon === 'E' ? 'extranjera' : 'local'}`].filter(Boolean),
        columnas: [col(M.mensual ? 'Centro' : 'Cuenta', 'texto', 16), col(M.nombreEtq, 'texto', M.mensual ? 32 : 38), col('Nivel', 'numero', 6), col('Saldo anterior', 'monto', 15), col('Débitos', 'monto', 15), col('Créditos', 'monto', 15), ...(M.mensual ? [col('Saldo del mes', 'monto', 15)] : []), col('Saldo actual', 'monto', 15)],
        filas: D.filas, vacio: !actual ? 'Elige un cierre en el maestro.' : !saldos.length ? (M.mensual ? 'Este cierre no tiene saldos por centro de costo con montos.' : tc?.clasificacion === 'E' ? 'Este cierre es por centros de costo: consúltalo en Síntesis por centro de costo.' : 'Este cierre no tiene saldos por cuenta con montos.') : `Ningún ${M.mensual ? 'centro' : 'registro'} cumple con el filtro.` };
      const definitivos = lista.filter((c) => c.tipos_cierre?.definitivo).length;
      ctx.pDet.innerHTML = `<div class="bm-form cx-form cl-clasico ci-compacto sc-form">
        <div class="ci-barra"><div class="ci-tit"><b>Maestro · cierres</b> <span>${esc(empresaDe(ctx))}</span> <i class="ti ti-info-circle" title="Cierres del sistema anterior (CON_CIERRES y CON_TIPOS_CIERRES). Clic en un cierre para ver sus saldos." aria-hidden="true"></i></div>
          <div class="ci-kpis"><span class="ci-k"><small>Cierres</small> <b>${lista.length}</b></span><span class="ci-k ec-fin"><small>Definitivos</small> <b>${definitivos}</b></span><span class="ci-k"><small>Otros</small> <b>${lista.length - definitivos}</b></span></div></div>
        <div class="sc-maestro">${C().tabla(maestro, false)}</div>
        <div class="ci-barra"><div class="ci-tit"><b>Detalle · saldos</b> <span>${esc(titDet || 'sin cierre elegido')}</span> <i class="ti ti-info-circle" title="${M.mensual ? 'Saldos del cierre por centro de costo (CON_SALDOS_CIERRE_CC). Al elegir un centro mayor se muestran todos sus subcentros, indentados por nivel.' : 'Saldos del cierre (CON_SALDOS_CIERRE). Al elegir una cuenta mayor se muestran todas sus subcuentas, indentadas por nivel. El saldo de cada cuenta mayor es el que guardó el sistema anterior.'}" aria-hidden="true"></i></div>
          <div class="ci-kpis"><span class="ci-k"><small>${M.mensual ? 'Centros' : 'Cuentas'}</small> <b>${D.n}</b></span><span class="ci-k"><small>Débitos</small> <b>${fmt.monto(D.t.de)}</b></span><span class="ci-k"><small>Créditos</small> <b>${fmt.monto(D.t.cr)}</b></span>${f.cuenta ? `<span class="ci-k ec-fin"><small>Saldo actual</small> <b>${fmt.monto(D.t.sx)}</b></span>` : ''}</div></div>
        <div class="sc-detalle">${C().tabla(cfg, false)}</div></div>`;
      window.CUENTAS_XLSX.ajustarAlto(cont);
    }

    cont.addEventListener('change', (e) => {
      const c = ctx.cambioOrgLoc(e); if (c === 'org' || c === 'loc') { f.anio = ''; f.cuenta = ''; f.nivel = ''; return cargar(); }
      const n = e.target.name; if (!n || !(n in f)) return;
      f[n] = n === 'cuenta' ? codigo(e.target.value) : e.target.value;
      if (n === 'cuenta') e.target.value = f.cuenta;
      pintar();
    });
    cont.addEventListener('click', (e) => {
      const ex = e.target.closest('[data-exp]'); if (ex) return C().exportar(cfg, ex.dataset.exp, false);
      const r = e.target.closest('[data-cierre]'); if (!r) return;
      const c = cierres.find((x) => String(x.id) === r.dataset.cierre); if (!c || c === actual) return;
      actual = c; pintar();
    });
    iniciar();
  }
  window.PANTALLAS['sintesis-cierres'] = (cont) => pantalla(cont, MODOS.cuenta);
  window.PANTALLAS['sintesis-centros'] = (cont) => pantalla(cont, MODOS.centro);
})();
