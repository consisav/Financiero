// Registros · Bancos: base común de las pantallas bancarias (parámetros organización y
// localidad, maestro arriba y detalle abajo) y la pantalla Cuentas bancarias:
//   Maestro: bancos del sistema bancario de Guatemala (catálogo común).
//   Detalle: cuentas bancarias del banco elegido en la localidad y, a la derecha, la cuenta
//   elegida: moneda, saldos, chequera (inicial, final, utilizados, mínimo, disponibles), formato
//   de cheque y cuenta contable.
(function () {
  const { esc } = window.UI;

  const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
  const fmt = {
    hoy,
    fechaDia: (d) => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '',
    fechaHora: (f) => f ? new Date(f).toLocaleString('es-GT', { timeZone: 'America/Guatemala', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '') : '',
    monto: (n) => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    redondear: (n) => Math.round(Number(n || 0) * 100) / 100
  };
  // La organización y localidad elegidas se conservan entre las pantallas bancarias.
  const seleccion = { org: null, loc: null };

  // Arma la pantalla y devuelve sus piezas y datos comunes.
  function montar(cont, { titulo, icono, clase = '' }) {
    const sb = window.FIN.sb;
    const yo = window.FIN.perfil();
    const ctx = { sb, yo, admin: window.FIN.puedeEditarCatalogos(), superAdmin: window.FIN.esSuperAdmin(), organizaciones: [], localidades: [], monedas: [], bancos: [], sel: seleccion };
    if (!seleccion.org) { seleccion.org = yo.organizacion_id || null; seleccion.loc = yo.localidad_id || null; }
    cont.innerHTML = `
      <div class="ta-espacio ta-apilado bk-espacio ${clase}">
        <section class="ta-filtros bk-filtros"></section>
        <div class="ta-cuerpo">
          <section class="tk-bandeja ta-maestro bk-maestro"></section>
          <section class="tk-detalle ta-detalle bk-detalle"></section>
        </div>
      </div>`;
    ctx.espacio = cont.querySelector('.ta-espacio');
    ctx.pFil = cont.querySelector('.bk-filtros');
    ctx.pMae = cont.querySelector('.bk-maestro');
    ctx.pDet = cont.querySelector('.bk-detalle');
    ctx.titulo = titulo;
    ctx.icono = icono;

    ctx.ajustarAlto = function () {
      if (!ctx.espacio.isConnected) return window.removeEventListener('resize', ctx.ajustarAlto);
      const arriba = ctx.espacio.getBoundingClientRect().top + window.scrollY;
      const alto = Math.max(620, window.innerHeight - arriba - 16);
      ctx.espacio.style.setProperty('--tk-alto', `${alto}px`);
      const sobra = document.documentElement.scrollHeight - window.innerHeight;
      if (sobra > 0 && alto - sobra >= 620) ctx.espacio.style.setProperty('--tk-alto', `${alto - sobra}px`);
    };
    window.addEventListener('resize', ctx.ajustarAlto);

    // Organizaciones, localidades, monedas (con su tipo de cambio de venta) y bancos.
    ctx.cargarBase = async function () {
      ctx.ajustarAlto();
      const [o, l, m, tc, b, prueba] = await Promise.all([
        sb.from('organizaciones').select('id, codigo, nombre').eq('activo', true).order('codigo'),
        sb.from('localidades').select('id, codigo, correlativo, nombre_comercial, organizacion_id').eq('activo', true).order('organizacion_id').order('correlativo'),
        sb.from('monedas').select('id, codigo, nombre, simbolo, iso').eq('activo', true).order('codigo'),
        sb.from('tipos_cambio').select('moneda_id, valor_venta, fecha').order('fecha', { ascending: false }).limit(200),
        sb.from('bancos').select('*').order('codigo'),
        sb.from('cuentas_bancarias').select('id').limit(1)
      ]);
      if (b.error || prueba.error) {
        const err = b.error || prueba.error;
        ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/bancos|cuentas_bancarias/.test(err.message) ? 'Falta instalar el script 42 (bancos) en Supabase.' : esc(err.message)}</p></section>`;
        return false;
      }
      ctx.organizaciones = o.data || [];
      ctx.localidades = l.data || [];
      ctx.monedas = (m.data || []).map((x) => ({ ...x, cambio: x.iso === 'GTQ' ? 1 : Number((tc.data || []).find((c) => c.moneda_id === x.id)?.valor_venta || 1) }));
      ctx.bancos = b.data || [];
      if (!seleccion.org) seleccion.org = ctx.organizaciones[0]?.id || null;
      if (!ctx.localidades.some((x) => x.id === seleccion.loc && x.organizacion_id === seleccion.org)) {
        seleccion.loc = ctx.localidades.find((x) => x.organizacion_id === seleccion.org)?.id || null;
      }
      return true;
    };

    ctx.moneda = (id) => ctx.monedas.find((x) => x.id === id);
    ctx.monedaBase = () => ctx.monedas.find((x) => x.iso === 'GTQ') || ctx.monedas[0];
    ctx.banco = (id) => ctx.bancos.find((x) => x.id === id);
    ctx.localidad = (id) => ctx.localidades.find((x) => x.id === id);

    // Selects de organización y localidad (con más parámetros si la pantalla los necesita).
    ctx.filtros = function (extra = '', acciones = '') {
      const locs = ctx.localidades.filter((x) => x.organizacion_id === seleccion.org);
      ctx.pFil.innerHTML = `
        <div class="ta-titulo"><span class="tk-icono"><i class="ti ${ctx.icono}" aria-hidden="true"></i></span><div><small>Bancos</small><h2>${esc(ctx.titulo)}</h2></div></div>
        <label class="campo"><span>Organización</span><select name="org">${ctx.organizaciones.map((o) => `<option value="${o.id}" ${seleccion.org === o.id ? 'selected' : ''}>${o.codigo} · ${esc(o.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Localidad (empresa)</span><select name="loc">${locs.map((x) => `<option value="${x.id}" ${seleccion.loc === x.id ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre_comercial)}</option>`).join('') || '<option value="">Sin localidades</option>'}</select></label>
        ${extra}
        <div class="oc-extra">${acciones}</div>`;
    };
    ctx.cambioOrgLoc = function (e) {
      if (!e.target.closest('.bk-filtros')) return false;
      if (e.target.name === 'org') {
        seleccion.org = Number(e.target.value);
        seleccion.loc = ctx.localidades.find((x) => x.organizacion_id === seleccion.org)?.id || null;
        return 'org';
      }
      if (e.target.name === 'loc') { seleccion.loc = e.target.value ? Number(e.target.value) : null; return 'loc'; }
      return 'otro';
    };

    // Cuentas bancarias y cuentas contables de movimiento de la localidad.
    ctx.cuentasBancarias = async function (loc = seleccion.loc) {
      if (!loc) return [];
      const { data } = await sb.from('cuentas_bancarias').select('*').eq('localidad_id', loc).order('banco_id').order('numero');
      return data || [];
    };
    ctx.cuentasContables = async function (loc = seleccion.loc) {
      if (!loc) return [];
      const { data: k } = await sb.from('catalogos_cuentas').select('id').eq('localidad_id', loc).eq('activo', true).order('version', { ascending: false }).limit(1);
      if (!k?.[0]) return [];
      const { data } = await sb.from('cuentas').select('id, codigo, nombre, cuenta_mayor_id, vigente').eq('catalogo_id', k[0].id).order('codigo');
      const padres = new Set((data || []).map((c) => c.cuenta_mayor_id).filter(Boolean));
      return (data || []).map((c) => ({ ...c, movimiento: !padres.has(c.id) && c.vigente }));
    };
    ctx.nombreCuentaBancaria = (cb) => cb ? `${ctx.banco(cb.banco_id)?.siglas || ctx.banco(cb.banco_id)?.nombre || ''} ${cb.numero} · ${cb.nombre}` : '';
    ctx.vacio = (txt, icono = 'ti-building-bank') => `<div class="tk-vacio ta-elige"><i class="ti ${icono}" aria-hidden="true"></i>${txt}</div>`;
    return ctx;
  }

  // Ventana de impresión con estilos sencillos.
  function imprimir(titulo, cuerpo) {
    const v = window.open('', '_blank');
    if (!v) return window.FIN.aviso('Permite las ventanas emergentes para imprimir');
    v.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
      body{font:12px/1.4 Arial,sans-serif;color:#111;margin:28px}h1{font-size:16px;margin:0}h2{font-size:13px;margin:2px 0 12px;font-weight:normal;color:#444}h3{font-size:13px;margin:16px 0 6px}
      .cab{display:grid;grid-template-columns:repeat(4,1fr);gap:4px 16px;border:1px solid #bbb;padding:8px 10px;margin-bottom:12px}.cab b{display:block;font-size:10px;color:#666;text-transform:uppercase}
      table{width:100%;border-collapse:collapse;margin-bottom:10px}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left}th{background:#eee;font-size:11px}.n{text-align:right;white-space:nowrap}
      tfoot td,tr.s td{font-weight:bold;background:#f3f3f3}.firmas{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;margin-top:60px;text-align:center}.firmas div{border-top:1px solid #333;padding-top:4px}
      @media print{body{margin:10mm}}</style></head><body>${cuerpo}<script>window.onload=()=>window.print()<\/script></body></html>`);
    v.document.close();
  }

  window.BANCOS = { montar, fmt, imprimir };

  // ===================== Cuentas bancarias =====================
  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['cuentas-bancarias'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Cuentas bancarias', icono: 'ti-building-bank', clase: 'bk-cuentas' });
    const { sb } = ctx;
    let bancoActual = null;
    let cuentas = [];       // cuentas bancarias de la localidad
    let saldos = {};        // saldo actual por cuenta
    let contables = [];
    let cuentaActual = null; // cuenta bancaria abierta (null = nueva)

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      ctx.filtros('', ctx.admin ? '<button type="button" class="boton secundario-sm" data-accion="nuevo-banco"><i class="ti ti-plus" aria-hidden="true"></i> Banco</button>' : '');
      await consultar();
    }

    async function consultar() {
      [cuentas, contables] = await Promise.all([ctx.cuentasBancarias(), ctx.cuentasContables()]);
      saldos = {};
      await Promise.all(cuentas.map(async (c) => {
        const { data } = await sb.rpc('saldo_cuenta_bancaria', { p_cuenta: c.id, p_hasta: ctx.fmt?.hoy?.() || hoy() });
        saldos[c.id] = Number(data || 0);
      }));
      if (!bancoActual || !ctx.bancos.some((b) => b.id === bancoActual.id)) {
        bancoActual = ctx.bancos.find((b) => cuentas.some((c) => c.banco_id === b.id)) || ctx.bancos[0] || null;
      }
      pintarMaestro();
      abrirBanco(bancoActual, cuentaActual?.id);
    }

    function pintarMaestro() {
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab tg-cab"><h2>Bancos del sistema <small>${ctx.bancos.length}</small></h2>
          <span class="rp-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> Bancos del sistema bancario de Guatemala (verifica el listado vigente con la SIB)</span></header>
        <div class="ta-tabla">
          <table>
            <thead><tr><th>Banco</th><th>Nombre</th><th>Siglas</th><th class="num">Costo de transferencias</th><th class="num">Cuentas en esta localidad</th><th>Estado</th><th><span class="oculto">Acciones</span></th></tr></thead>
            <tbody>
              ${ctx.bancos.map((b) => `
                <tr class="${bancoActual && bancoActual.id === b.id ? 'actual' : ''}" data-banco="${b.id}" tabindex="0">
                  <td class="fuerte">${b.codigo}</td>
                  <td>${esc(b.nombre)}</td>
                  <td>${esc(b.siglas || '')}</td>
                  <td class="num">${b.costo_transferencia != null ? window.BANCOS.fmt.monto(b.costo_transferencia) : ''}</td>
                  <td class="num">${cuentas.filter((c) => c.banco_id === b.id).length || ''}</td>
                  <td>${window.UI.estado(b.activo)}</td>
                  <td class="tk-acciones">${ctx.admin ? `<button type="button" class="tk-accion-btn" data-editar-banco="${b.id}"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>` : ''}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }

    function abrirBanco(b, cuentaId) {
      bancoActual = b;
      const lista = cuentas.filter((c) => b && c.banco_id === b.id);
      cuentaActual = lista.find((c) => c.id === cuentaId) || lista[0] || null;
      ctx.pMae.querySelectorAll('tr[data-banco]').forEach((tr) => tr.classList.toggle('actual', !!b && tr.dataset.banco === String(b.id)));
      pintarDetalle();
    }

    function pintarDetalle(valores) {
      const b = bancoActual;
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la organización y la localidad.'); return; }
      if (!b) { ctx.pDet.innerHTML = ctx.vacio('Elige un banco.'); return; }
      const lista = cuentas.filter((c) => c.banco_id === b.id);
      const c = cuentaActual;
      const base = ctx.monedaBase();
      const v = valores || (c ? { ...c } : { numero: '', nombre: '', moneda_id: base?.id, saldo_minimo: 0, saldo_inicial: 0, fecha_saldo_inicial: window.BANCOS.fmt.hoy(), cheque_inicial: '', cheque_final: '', cheques_utilizados: 0, minimo_cheques: 0, reporte: '', cuenta_id: null, activo: true });
      const dis = ctx.admin ? '' : 'disabled';
      const cc = contables.find((x) => x.id === v.cuenta_id);
      const nCheques = v.cheque_inicial && v.cheque_final ? Number(v.cheque_final) - Number(v.cheque_inicial) + 1 : 0;
      const disponibles = Math.max(0, nCheques - Number(v.cheques_utilizados || 0));
      const { monto } = window.BANCOS.fmt;
      ctx.pDet.innerHTML = `
        <div class="tk-form ta-form bk-form-cuentas">
          <header class="tk-titulo">
            <span class="tk-icono"><i class="ti ti-building-bank" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>Cuentas bancarias de ${esc(ctx.localidad(ctx.sel.loc)?.codigo || '')}</small><h2>${b.codigo} · ${esc(b.nombre)}</h2></div>
            <div class="tk-titulo-acciones">${ctx.admin ? '<button type="button" class="boton secundario-sm" data-accion="nueva-cuenta"><i class="ti ti-plus" aria-hidden="true"></i> Nueva cuenta</button>' : ''}</div>
          </header>
          <div class="ta-det-grid bk-grid">
            <div class="ta-col">
              <h3 class="ta-col-titulo"><i class="ti ti-list" aria-hidden="true"></i> Cuentas bancarias</h3>
              <div class="pc-lineas">
                <table>
                  <thead><tr><th>Cuenta bancaria</th><th>Nombre</th><th class="num">Saldo mínimo</th><th class="num">Saldo actual</th><th>Moneda local</th></tr></thead>
                  <tbody>
                    ${lista.map((x) => `<tr class="bk-fila ${c && c.id === x.id ? 'actual' : ''}" data-cuenta="${x.id}" tabindex="0">
                      <td class="fuerte">${esc(x.numero)}</td><td>${esc(x.nombre)}</td>
                      <td class="num">${monto(x.saldo_minimo)}</td>
                      <td class="num ${saldos[x.id] < Number(x.saldo_minimo) ? 'pc-rojo' : ''}">${esc(ctx.moneda(x.moneda_id)?.simbolo || '')} ${monto(saldos[x.id])}</td>
                      <td>${ctx.moneda(x.moneda_id)?.iso === 'GTQ' ? '<i class="ti ti-square-check marca-si" aria-label="Sí"></i>' : '<i class="ti ti-square marca-no" aria-label="No"></i>'}</td></tr>`).join('')
                      || '<tr><td colspan="5" class="tk-vacio"><i class="ti ti-building-bank" aria-hidden="true"></i>Este banco no tiene cuentas en la localidad.</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
            <form class="ta-col bk-ficha" novalidate>
              <h3 class="ta-col-titulo"><i class="ti ${c ? 'ti-pencil' : 'ti-plus'}" aria-hidden="true"></i> ${c ? `Cuenta ${esc(c.numero)}` : 'Nueva cuenta bancaria'}</h3>
              <div class="bk-ficha-campos">
                <label class="campo"><span>Cuenta bancaria *</span><input name="numero" value="${esc(v.numero || '')}" maxlength="30" ${dis}></label>
                <label class="campo bk-ancho"><span>Nombre *</span><input name="nombre" value="${esc(v.nombre || '')}" maxlength="120" placeholder="Ej. MAVISA PHARMACEUTICALS Q" ${dis}></label>
                <label class="campo"><span>Moneda</span><select name="moneda_id" ${dis}>${ctx.monedas.map((m) => `<option value="${m.id}" ${v.moneda_id === m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
                <label class="campo"><span>Saldo mínimo</span><input type="number" step="0.01" name="saldo_minimo" value="${v.saldo_minimo ?? 0}" ${dis}></label>
                <label class="campo"><span>Saldo inicial</span><input type="number" step="0.01" name="saldo_inicial" value="${v.saldo_inicial ?? 0}" ${dis}></label>
                <label class="campo"><span>Saldo inicial al</span><input type="date" name="fecha_saldo_inicial" value="${esc(v.fecha_saldo_inicial || '')}" ${dis}></label>
              </div>
              <fieldset class="bk-chequera">
                <legend><i class="ti ti-writing" aria-hidden="true"></i> Chequera</legend>
                <label class="campo"><span>Cheque inicial</span><input type="number" min="1" name="cheque_inicial" value="${v.cheque_inicial ?? ''}" ${dis}></label>
                <label class="campo"><span>Cheque final</span><input type="number" min="1" name="cheque_final" value="${v.cheque_final ?? ''}" ${dis}></label>
                <div class="ta-auto"><span>No. cheques</span><b data-ncheques>${nCheques}</b></div>
                <label class="campo"><span>Cheques utilizados</span><input type="number" min="0" name="cheques_utilizados" value="${v.cheques_utilizados ?? 0}" ${dis}></label>
                <label class="campo"><span>Número mínimo de cheques</span><input type="number" min="0" name="minimo_cheques" value="${v.minimo_cheques ?? 0}" ${dis}></label>
                <div class="ta-auto ${disponibles <= Number(v.minimo_cheques || 0) && nCheques ? 'ts-alerta' : ''}"><span>Cheques disponibles</span><b data-disponibles>${disponibles}</b></div>
                <label class="campo bk-ancho"><span>Formato de cheque (reporte)</span><input name="reporte" value="${esc(v.reporte || '')}" maxlength="60" ${dis}></label>
              </fieldset>
              <label class="campo"><span>Cuenta contable</span><input list="bk-contables" name="cuenta" value="${esc(cc ? cc.codigo : '')}" placeholder="Código de la cuenta de movimiento" ${dis}>
                <small class="bk-nombre-cuenta" data-nombre-cuenta>${esc(cc ? cc.nombre : '')}</small></label>
              <label class="pc-check"><input type="checkbox" name="activo" ${v.activo !== false ? 'checked' : ''} ${dis}> Activa</label>
              <p class="modal-error tk-error" role="alert"></p>
              ${ctx.admin ? `<div class="ta-boton">${c ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="eliminar-cuenta"><i class="ti ti-trash" aria-hidden="true"></i> Eliminar</button>' : ''}<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${c ? 'Guardar cambios' : 'Crear cuenta'}</button></div>` : ''}
              <datalist id="bk-contables">${contables.filter((x) => x.movimiento).map((x) => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('')}</datalist>
            </form>
          </div>
        </div>`;
    }

    function leer(form) {
      const el = form.elements;
      const num = (n) => el[n].value === '' ? null : Number(el[n].value);
      const cc = contables.find((x) => x.codigo === el.cuenta.value.trim() && x.movimiento);
      return {
        numero: el.numero.value.trim(), nombre: el.nombre.value.trim(), moneda_id: Number(el.moneda_id.value),
        saldo_minimo: num('saldo_minimo') || 0, saldo_inicial: num('saldo_inicial') || 0, fecha_saldo_inicial: el.fecha_saldo_inicial.value || window.BANCOS.fmt.hoy(),
        cheque_inicial: num('cheque_inicial'), cheque_final: num('cheque_final'), cheques_utilizados: num('cheques_utilizados') || 0, minimo_cheques: num('minimo_cheques') || 0,
        reporte: el.reporte.value.trim() || null, cuenta_id: cc ? cc.id : null, activo: el.activo.checked, _codigo: el.cuenta.value.trim()
      };
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      const d = leer(form);
      if (!d.numero || !d.nombre) { error.textContent = 'Escribe el número y el nombre de la cuenta bancaria.'; return; }
      if (d._codigo && !d.cuenta_id) { error.textContent = 'La cuenta contable no es una cuenta de movimiento del catálogo de la localidad.'; return; }
      delete d._codigo;
      const r = cuentaActual
        ? await sb.from('cuentas_bancarias').update(d).eq('id', cuentaActual.id).select('id').single()
        : await sb.from('cuentas_bancarias').insert({ ...d, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, banco_id: bancoActual.id }).select('id').single();
      if (r.error) { error.textContent = /cuentas_bancarias_localidad_id_banco_id_numero_key|duplicate/.test(r.error.message) ? 'Esa cuenta bancaria ya existe en este banco.' : window.UI.traducirError(r.error); return; }
      window.FIN.aviso(cuentaActual ? 'Cuenta bancaria guardada' : 'Cuenta bancaria creada');
      cuentaActual = { id: r.data.id };
      await consultar();
    }

    function formBanco(b) {
      window.UI.formulario({
        titulo: b ? `Modificar banco · ${b.nombre}` : 'Nuevo banco',
        valores: b || { codigo: Math.max(0, ...ctx.bancos.map((x) => x.codigo)) + 1, activo: true },
        campos: [
          { nombre: 'codigo', etiqueta: 'Código', tipo: 'numero', requerido: true },
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
          { nombre: 'siglas', etiqueta: 'Siglas' },
          { nombre: 'costo_transferencia', etiqueta: 'Costo de transferencias', tipo: 'numero', paso: 'any' },
          { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla' }
        ],
        alGuardar: async (d) => {
          d.nombre = d.nombre.toUpperCase();
          if (d.siglas) d.siglas = d.siglas.toUpperCase();
          const r = b ? await sb.from('bancos').update(d).eq('id', b.id) : await sb.from('bancos').insert(d);
          if (r.error) throw r.error;
          const { data } = await sb.from('bancos').select('*').order('codigo');
          ctx.bancos = data || [];
          window.FIN.aviso('Banco guardado');
          pintarMaestro();
          abrirBanco(ctx.bancos.find((x) => x.id === (b?.id || bancoActual?.id)) || bancoActual, cuentaActual?.id);
        }
      });
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { if (cambio === 'org') ctx.filtros('', ctx.admin ? '<button type="button" class="boton secundario-sm" data-accion="nuevo-banco"><i class="ti ti-plus" aria-hidden="true"></i> Banco</button>' : ''); cuentaActual = null; return consultar(); }
    });
    cont.addEventListener('input', (e) => {
      const form = e.target.closest('.bk-ficha');
      if (!form) return;
      if (e.target.name === 'cuenta') {
        const cc = contables.find((x) => x.codigo === e.target.value.trim());
        form.querySelector('[data-nombre-cuenta]').innerHTML = cc ? (cc.movimiento ? esc(cc.nombre) : '<span class="pc-error">Agrupa a otras cuentas: usa una de movimiento</span>') : e.target.value.trim() ? '<span class="pc-error">No existe en el catálogo</span>' : '';
      }
      if (['cheque_inicial', 'cheque_final', 'cheques_utilizados', 'minimo_cheques'].includes(e.target.name)) {
        const d = leer(form);
        const n = d.cheque_inicial && d.cheque_final ? d.cheque_final - d.cheque_inicial + 1 : 0;
        form.querySelector('[data-ncheques]').textContent = Math.max(0, n);
        form.querySelector('[data-disponibles]').textContent = Math.max(0, n - d.cheques_utilizados);
      }
    });
    cont.addEventListener('click', async (e) => {
      const eb = e.target.closest('[data-editar-banco]');
      if (eb) return formBanco(ctx.bancos.find((b) => String(b.id) === eb.dataset.editarBanco));
      const fb = e.target.closest('tr[data-banco]');
      if (fb) return abrirBanco(ctx.bancos.find((b) => String(b.id) === fb.dataset.banco));
      const fc = e.target.closest('tr[data-cuenta]');
      if (fc) { cuentaActual = cuentas.find((x) => String(x.id) === fc.dataset.cuenta); return pintarDetalle(); }
      const ac = e.target.closest('[data-accion]');
      if (!ac) return;
      if (ac.dataset.accion === 'nuevo-banco') return formBanco(null);
      if (ac.dataset.accion === 'nueva-cuenta') { cuentaActual = null; pintarDetalle(); return ctx.pDet.querySelector('[name=numero]')?.focus(); }
      if (ac.dataset.accion === 'eliminar-cuenta') {
        if (!confirm(`¿Eliminar la cuenta bancaria ${cuentaActual.numero}? Solo se puede si no tiene documentos.`)) return;
        const { error } = await sb.from('cuentas_bancarias').delete().eq('id', cuentaActual.id);
        if (error) return window.FIN.aviso(/foreign key|violates/.test(error.message) ? 'La cuenta tiene documentos bancarios: desactívala en lugar de eliminarla.' : window.UI.traducirError(error));
        window.FIN.aviso('Cuenta bancaria eliminada');
        cuentaActual = null;
        return consultar();
      }
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.bk-ficha')) { e.preventDefault(); guardar(e.target); } });

    iniciar();
  };
})();
