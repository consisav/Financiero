// Caja y Bancos · Bancos · Conciliación bancaria, por empresa (organización y localidad), con el
// diseño de los depósitos:
//   Parámetros: empresa, año y mes.
//   Encabezado: banco y cuenta bancaria (se elige aquí), período, saldo según el banco (se digita)
//   y su valor en quetzales, control (estado, usuario, cierre, imagen del estado de cuenta) y los
//   saldos de la conciliación (contable, diferencia, sistema, conciliados, en circulación).
//   Pestañas: movimientos del mes para marcarlos conciliados, resumen del mes, detalle de
//   diferencias y las cuentas de la empresa con el estado de su conciliación.
//   Una conciliación guardada abre en consulta: «Modificar» la habilita; «Cerrar» la bloquea
//   hasta «Reversar cierre».
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir, adjunto, pestanas: barraPestanas, activarPestana } = window.BANCOS;
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const TIPOS = { DEPOSITO: 'Depósito', NOTA_CREDITO: 'Nota de crédito', NOTA_DEBITO: 'Nota de débito', CHEQUE: 'Cheque' };
  // Documentos que salen de la cuenta.
  const egreso = (m) => m.tipo === 'NOTA_DEBITO' || m.tipo === 'CHEQUE';
  const IMAGEN = { que: 'del estado de cuenta', ayuda: 'Estado de cuenta del banco del mes (imagen o PDF, hasta 10 MB)' };

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['conciliacion-bancaria'] = function (cont) {
    // Opción A: arriba las cuentas del mes en tarjetas; debajo la conciliación como una ecuación
    // (según banco ± en circulación = ajustado, frente al contable) con el control a la derecha, y
    // los movimientos con filtros (del mes, en circulación, conciliados, todos; tipo y búsqueda).
    const ctx = montar(cont, { titulo: 'Conciliación bancaria', icono: 'ti-scale', clase: 'bk-movimientos bk-conc bc-a' });
    const fm = { vista: 'CIRCULACION', tipo: '', buscar: '' };
    const PASO = 300;           // filas de movimientos que se pintan a la vez («Ver más» agrega otras)
    let limite = PASO;
    const { sb } = ctx;
    const [a0, m0] = fmt.hoy().split('-').map(Number);
    const f = { anio: a0, mes: m0 };
    let cuentas = [];
    let concs = {};         // conciliación del mes por cuenta bancaria
    let actual = null;      // cuenta bancaria elegida
    let conc = null;        // conciliación de la cuenta y el mes
    let movs = [];          // movimientos de la cuenta en el mes y anteriores sin conciliar
    let difs = [];          // { descripcion, valor_real, valor_conta }
    let saldoContable = 0;
    let saldoSistema = 0;
    let pestana = 'MOVIMIENTOS';
    let modificando = false;
    let imagenNueva = null;
    let quitarImagen = false;

    const finMes = () => new Date(Date.UTC(f.anio, f.mes, 0)).toISOString().slice(0, 10);
    const iniMes = () => `${f.anio}-${String(f.mes).padStart(2, '0')}-01`;
    const tc = (cb) => ctx.moneda(cb.moneda_id)?.cambio || 1;
    const local = (cb) => ctx.moneda(cb.moneda_id)?.iso === 'GTQ';
    const cerrada = () => conc?.estado === 'CERRADA';
    const editable = () => ctx.admin && !cerrada() && (!conc || modificando);
    const empresa = () => { const l = ctx.localidad(ctx.sel.loc); return l ? `${l.codigo} · ${l.nombre_comercial}` : ''; };
    const imagen = (extra = {}) => ({ nuevo: imagenNueva, ruta: conc?.comprobante_ruta, nombre: conc?.comprobante_nombre, tipo: conc?.comprobante_tipo, quitar: quitarImagen, ...IMAGEN, ...extra });
    const dato = (etq, val) => `<div class="bm-dato"><dt>${etq}</dt><dd>${val || '<span class="tk-tenue">—</span>'}</dd></div>`;

    function pintarFiltros() {
      const anios = []; for (let a = a0 + 1; a >= a0 - 6; a--) anios.push(a);
      ctx.filtros(`
        <label class="campo"><span>Año</span><select name="anio">${anios.map((a) => `<option ${f.anio === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <label class="campo"><span>Mes</span><select name="mes">${MESES.map((n, i) => `<option value="${i + 1}" ${f.mes === i + 1 ? 'selected' : ''}>${String(i + 1).padStart(2, '0')} · ${n}</option>`).join('')}</select></label>`);
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      pintarFiltros();
      await consultar();
    }

    async function consultar() {
      cuentas = await ctx.cuentasBancarias();
      concs = {};
      if (cuentas.length) {
        const { data } = await sb.from('conciliaciones').select('*').in('cuenta_bancaria_id', cuentas.map((c) => c.id)).eq('anio', f.anio).eq('mes', f.mes);
        (data || []).forEach((c) => { concs[c.cuenta_bancaria_id] = c; });
      }
      if (!actual || !cuentas.some((c) => c.id === actual.id)) actual = cuentas[0] || null;
      else actual = cuentas.find((c) => c.id === actual.id);
      pintarMaestro();
      await abrir(actual, modificando);
    }

    // Cuentas de la empresa en tarjetas, con el estado de su conciliación del mes.
    function pintarMaestro() {
      const cerradas = Object.values(concs).filter((c) => c.estado === 'CERRADA').length;
      const abiertas = Object.values(concs).length - cerradas;
      ctx.pMae.innerHTML = `
        <div class="bca-cuentas">
          <div class="bca-cuentas-cab"><h2>Cuentas · ${MESES[f.mes - 1]} ${f.anio}</h2>
            <span class="bca-cuenta-res"><b>${cerradas}</b> cerradas · <b>${abiertas}</b> abiertas · <b>${cuentas.length - cerradas - abiertas}</b> sin generar</span></div>
          <div class="bca-tarjetas" role="list">
            ${cuentas.map((c) => {
              const k = concs[c.id];
              const b = ctx.banco(c.banco_id);
              const mon = ctx.moneda(c.moneda_id);
              return `<button type="button" role="listitem" class="bca-tarjeta ${actual && actual.id === c.id ? 'actual' : ''} ${!k ? 'sin' : k.estado === 'CERRADA' ? 'cerrada' : 'abierta'}" data-cuenta="${c.id}" title="${esc(`${b?.nombre || ''} · ${c.numero} · ${c.nombre}`)}">
                <span class="bk-cod">${b?.codigo ?? ''}</span>
                <span class="bca-t-txt"><b>${esc(c.numero)} · ${esc(b?.siglas || b?.nombre || '')}</b><small>${esc(c.nombre)}${mon && mon.iso !== 'GTQ' ? ` · ${esc(mon.simbolo || mon.iso)}` : ''}</small></span>
                <span class="bca-t-est">${!k ? 'Sin generar' : k.estado === 'CERRADA' ? '<i class="ti ti-lock" aria-hidden="true"></i> Cerrada' : 'Abierta'}${k?.origen_anterior ? '<small>Sistema anterior</small>' : ''}</span>
              </button>`;
            }).join('') || '<p class="tk-vacio">La empresa no tiene cuentas bancarias: créalas en Bancos · Cuentas bancarias.</p>'}
          </div>
        </div>`;
    }

    // Movimientos según el filtro: del mes, en circulación (sin conciliar, de cualquier fecha), conciliados o todos.
    const delMes = (m) => m.fecha >= iniMes();
    const vistas = () => ({
      CIRCULACION: movs.filter((m) => !m.conciliado),
      MES: movs.filter(delMes),
      CONCILIADOS: movs.filter((m) => m.conciliado),
      TODOS: movs
    });
    const filtrados = () => {
      const q = fm.buscar.trim().toLowerCase();
      return vistas()[fm.vista].filter((m) => (!fm.tipo || m.tipo === fm.tipo)
        && (!q || [m.numero_documento, m.folio, m.tercero_nombre, m.deposito_por, m.descripcion, fmt.fechaDia(m.fecha)].some((v) => String(v || '').toLowerCase().includes(q))));
    };
    function pintarMovs() {
      const caja = ctx.pDet.querySelector('[data-movs]');
      if (!caja) return;
      const ed = editable();
      const ls = filtrados();
      const vis = ls.slice(0, limite);
      caja.innerHTML = `<table><thead><tr><th class="bca-ck">Conciliado</th><th>Tipo</th><th class="num">Folio</th><th>Documento</th><th>Fecha</th><th>Cliente / proveedor · descripción</th><th class="num">Valor</th><th class="num">Valor Q</th></tr></thead>
        <tbody>${vis.map((m) => `<tr class="${!delMes(m) ? 'bc-anterior' : ''} ${m.conciliado ? 'bca-conc' : ''}"><td class="bca-ck"><input type="checkbox" data-conciliar="${m.id}" ${m.conciliado ? 'checked' : ''} ${ed ? '' : 'disabled'} aria-label="Conciliado"></td>
          <td><span class="bca-tipo bca-${m.tipo}">${esc(TIPOS[m.tipo])}</span></td><td class="num">${m.folio}</td><td>${esc(m.numero_documento || '')}</td><td>${esc(fmt.fechaDia(m.fecha))}${!delMes(m) ? ' <small class="bca-ant">anterior</small>' : ''}</td>
          <td class="bca-quien" title="${esc(m.descripcion || '')}"><b>${esc(m.tercero_nombre || m.deposito_por || '—')}</b><small>${esc(m.descripcion || '')}</small></td>
          <td class="num ${egreso(m) ? 'pc-rojo' : ''}">${egreso(m) ? '−' : ''}${fmt.monto(m.valor_cuenta)}</td><td class="num">${fmt.monto(m.valor_ml)}</td></tr>`).join('')
          || `<tr><td colspan="8" class="tk-vacio">${movs.length ? 'No hay movimientos con este filtro.' : 'Sin movimientos en el mes ni en circulación.'}</td></tr>`}</tbody></table>
        ${ls.length > vis.length ? `<p class="bca-mas">Mostrando ${vis.length.toLocaleString('es-GT')} de ${ls.length.toLocaleString('es-GT')} · <button type="button" class="rp-enlace" data-ver-mas>Ver ${Math.min(PASO, ls.length - vis.length)} más</button> · usa la búsqueda o el tipo para encontrarlos</p>` : ''}`;
      const n = ctx.pDet.querySelector('[data-movs-n]');
      if (n) n.textContent = `${ls.length.toLocaleString('es-GT')} · Q ${fmt.monto(ls.reduce((s, m) => s + (egreso(m) ? -1 : 1) * Number(m.valor_ml), 0))}`;
    }

    async function abrir(cb, editar = false) {
      actual = cb;
      conc = cb ? concs[cb.id] || null : null;
      modificando = !!conc && editar && ctx.admin && !cerrada();
      imagenNueva = null;
      quitarImagen = false;
      movs = []; difs = []; saldoContable = 0; saldoSistema = 0;
      limite = PASO;
      if (cb) {
        ctx.pDet.innerHTML = ctx.vacio('Cargando la conciliación…', 'ti-loader-2');
        // Movimientos del mes y los de meses anteriores que siguen sin conciliar (en circulación), por
        // páginas de 1,000 (el servidor devuelve como máximo 1,000 filas por consulta).
        const todos = async () => {
          const lista = [];
          for (let p = 0; p < 30000; p += 1000) {
            const { data, error } = await sb.from('movimientos_bancarios').select('*').eq('cuenta_bancaria_id', cb.id).eq('estado', 'ACTIVO').lte('fecha', finMes())
              .or(`fecha.gte.${iniMes()},conciliado.eq.false`).order('fecha').order('folio').order('id').range(p, p + 999);
            if (error) break;
            lista.push(...(data || []));
            if ((data || []).length < 1000) break;
          }
          return lista;
        };
        const [m, d, sc, ss] = await Promise.all([
          todos(),
          conc ? sb.from('conciliacion_diferencias').select('*').eq('conciliacion_id', conc.id).order('id') : { data: [] },
          sb.rpc('saldo_contable_cuenta_bancaria', { p_cuenta: cb.id, p_anio: f.anio, p_mes: f.mes }),
          sb.rpc('saldo_cuenta_bancaria', { p_cuenta: cb.id, p_hasta: finMes() })
        ]);
        if (actual !== cb) return;
        movs = m;
        difs = (d.data || []).map((x) => ({ descripcion: x.descripcion, valor_real: Number(x.valor_real), valor_conta: Number(x.valor_conta) }));
        saldoContable = Number(sc.data || 0);
        saldoSistema = Number(ss.data || 0);
      }
      pintarDetalle();
      ctx.pMae.querySelectorAll('[data-cuenta]').forEach((x) => x.classList.toggle('actual', !!cb && x.dataset.cuenta === String(cb.id)));
    }

    // Resumen por tipo: emitidos en el mes, conciliados y en circulación.
    function resumen() {
      const delMes = movs.filter((m) => m.fecha >= iniMes());
      const fila = (txt, ls) => ({ txt, n: ls.length, q: ls.reduce((s, m) => s + Number(m.valor_ml), 0), ml: ls.reduce((s, m) => s + Number(m.valor_cuenta), 0) });
      return [
        fila('Depósitos emitidos', delMes.filter((m) => m.tipo === 'DEPOSITO')),
        fila('Notas de crédito', delMes.filter((m) => m.tipo === 'NOTA_CREDITO')),
        fila('Notas de débito', delMes.filter((m) => m.tipo === 'NOTA_DEBITO')),
        fila('Cheques emitidos', delMes.filter((m) => m.tipo === 'CHEQUE')),
        fila('Conciliados', movs.filter((m) => m.conciliado)),
        fila('Depósitos en circulación', movs.filter((m) => !m.conciliado && m.tipo === 'DEPOSITO')),
        fila('Notas de crédito en circulación', movs.filter((m) => !m.conciliado && m.tipo === 'NOTA_CREDITO')),
        fila('Notas de débito en circulación', movs.filter((m) => !m.conciliado && m.tipo === 'NOTA_DEBITO')),
        fila('Cheques en circulación', movs.filter((m) => !m.conciliado && m.tipo === 'CHEQUE'))
      ];
    }

    function pintarDetalle(valores) {
      const cb = actual;
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.'); return; }
      if (!cb) { ctx.pDet.innerHTML = ctx.vacio('La empresa no tiene cuentas bancarias: créalas en Bancos · Cuentas bancarias.'); return; }
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const puede = ctx.admin && conc && !cerrada() && !modificando;
      const t = tc(cb);
      const banco = ctx.banco(cb.banco_id);
      const mon = ctx.moneda(cb.moneda_id);
      const v = valores || { saldo_banco: conc ? Number(conc.saldo_banco) : saldoSistema, observaciones: conc?.observaciones || '', fecha: conc?.fecha || fmt.hoy() };
      const bancoQ = fmt.redondear(v.saldo_banco * t);
      const contaQ = saldoContable;
      const contaMl = local(cb) ? contaQ : fmt.redondear(contaQ / t);
      const conciliados = movs.filter((m) => m.conciliado).length;
      const res = resumen();
      const marca = !conc ? '<span class="pc-marca pendiente">Sin generar</span>' : cerrada() ? '<span class="pc-marca definitiva"><i class="ti ti-lock" aria-hidden="true"></i> Cerrada</span>' : '<span class="pc-marca aprobada">Abierta</span>';
      // Ecuación de la conciliación: según banco + ingresos en circulación − egresos en circulación = ajustado.
      const pend = movs.filter((m) => !m.conciliado);
      const ingCirc = pend.filter((m) => !egreso(m)).reduce((s, m) => s + Number(m.valor_ml), 0);
      const egrCirc = pend.filter(egreso).reduce((s, m) => s + Number(m.valor_ml), 0);
      const ajustado = fmt.redondear(bancoQ + ingCirc - egrCirc);
      const dif = fmt.redondear(ajustado - contaQ);
      const vs = vistas();
      const ant = conc?.origen_anterior;
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form bm-form bc-form bca-form" novalidate data-ing="${ingCirc}" data-egr="${egrCirc}">
          <header class="tk-titulo bm-titulo">
            <span class="tk-icono"><i class="ti ti-scale" aria-hidden="true"></i></span>
            <div class="tk-titulo-texto"><small>${esc(banco?.nombre || '')} · ${esc(empresa())}</small><h2>Conciliación ${esc(cb.numero)} · ${MESES[f.mes - 1]} ${f.anio}</h2></div>
            <div class="tk-marcas">${marca}${ant ? '<span class="pc-marca">Sistema anterior</span>' : ''}${modificando ? '<span class="pc-marca pendiente"><i class="ti ti-pencil" aria-hidden="true"></i> Modificando</span>' : ''}</div>
            <div class="tk-titulo-acciones">
              ${conc && !modificando ? '<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Reporte</button>' : ''}
              ${ctx.admin && cerrada() ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="reversar"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Reversar cierre</button>' : ''}
              ${puede ? '<button type="button" class="boton secundario-sm" data-accion="cerrar"><i class="ti ti-lock" aria-hidden="true"></i> Cerrar conciliación</button>' : ''}
              ${puede ? '<button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}
              ${modificando ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button>' : ''}
              ${ed ? `<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${conc ? 'Guardar cambios' : 'Generar conciliación'}</button>` : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>

          <div class="bca-cabecera ${ed ? 'editando' : 'consulta'}">
            <section class="bca-ecuacion">
              <div class="bca-datos">
                <label class="campo"><span>Saldo según banco (${esc(mon?.simbolo || '')})</span><input type="number" step="0.01" name="saldo_banco" value="${v.saldo_banco}" ${dis}></label>
                <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(v.fecha)}" ${dis}></label>
                <label class="campo bca-obs"><span>Observaciones</span><input name="observaciones" value="${esc(v.observaciones || '')}" maxlength="500" ${dis}></label>
              </div>
              <div class="bca-pasos">
                <div><span>Según banco Q</span><b data-banco-q>${fmt.monto(bancoQ)}</b><small>${local(cb) ? 'Estado de cuenta' : `al cambio ${t}`}</small></div>
                <i class="bca-op">+</i>
                <div><span>Ingresos en circulación</span><b>${fmt.monto(ingCirc)}</b><small>Depósitos y notas de crédito</small></div>
                <i class="bca-op">−</i>
                <div><span>Egresos en circulación</span><b>${fmt.monto(egrCirc)}</b><small>Cheques y notas de débito</small></div>
                <i class="bca-op">=</i>
                <div class="bca-ajustado"><span>Saldo ajustado</span><b data-ajustado>${fmt.monto(ajustado)}</b><small>Debe igualar al contable</small></div>
                <i class="bca-op">vs</i>
                <div><span>Contable Q</span><b>${fmt.monto(contaQ)}</b><small>${local(cb) ? 'Partidas hasta el mes' : `${esc(mon?.simbolo || '')} ${fmt.monto(contaMl)}`}</small></div>
              </div>
              <div class="bca-resultado ${dif ? 'descuadre' : 'cuadra'}" data-resultado>
                <i class="ti ${dif ? 'ti-alert-triangle' : 'ti-circle-check'}" aria-hidden="true"></i>
                <span data-dif-txt>${dif ? 'Diferencia' : 'Cuadra'}</span><b data-dif>Q ${fmt.monto(dif)}</b>
                <small>Saldo en el sistema Q ${fmt.monto(saldoSistema)} · ${conciliados.toLocaleString('es-GT')} de ${movs.length.toLocaleString('es-GT')} movimientos conciliados</small>
              </div>
            </section>

            <section class="bm-bloque bm-control bca-control">
              <h3 class="ta-col-titulo"><i class="ti ti-shield-check" aria-hidden="true"></i> Control</h3>
              <dl>
                ${dato('Estado', conc ? esc(conc.estado) : 'Sin generar')}
                ${dato('Usuario', esc(conc?.usuario || (ctx.yo.usuario || '').toUpperCase()))}
                ${dato('Moneda', esc(mon?.nombre || ''))}
                ${dato('Actualiza', conc?.modificado_en ? `${esc(conc.modificado_por_nombre || '')} <small>${esc(fmt.fechaHora(conc.modificado_en))}</small>` : '')}
                ${dato('Fecha cierre', conc?.fecha_cierre ? `${esc(fmt.fechaHora(conc.fecha_cierre))}<small>${esc(conc.cerrada_por || '')}</small>` : '')}
                ${dato('Generada', conc?.creado_en ? esc(fmt.fechaHora(conc.creado_en)) : '')}
              </dl>
              ${conc ? adjunto.html(imagen({ ed, puede })) : '<div class="bm-comprobante"><span class="bm-sin-imagen"><i class="ti ti-info-circle" aria-hidden="true"></i> Genera la conciliación para adjuntar el estado de cuenta</span></div>'}
            </section>
          </div>

          <section class="bm-pestanas bca-pestanas">
            <div class="bm-tabs-barra">
              ${barraPestanas([
                { id: 'MOVIMIENTOS', texto: 'Movimientos', icono: 'ti-checklist', n: movs.length },
                { id: 'RESUMEN', texto: 'Resumen del mes', icono: 'ti-list-numbers' },
                { id: 'DIFERENCIAS', texto: 'Detalle de diferencias', icono: 'ti-arrows-diff', n: difs.length },
                ...(ant ? [{ id: 'ANTERIOR', texto: 'Totales del sistema anterior', icono: 'ti-history' }] : [])
              ], pestana)}
              ${ed ? '<span class="bm-aplicado"><i class="ti ti-hand-click" aria-hidden="true"></i> Marca los movimientos que aparecen en el estado de cuenta</span>' : ''}
            </div>
            <div class="bm-panel" data-panel="MOVIMIENTOS" ${pestana === 'MOVIMIENTOS' ? '' : 'hidden'}>
              <div class="bca-filtros">
                <div class="bca-chips" role="radiogroup" aria-label="Movimientos que se muestran">
                  ${[['CIRCULACION', 'En circulación'], ['MES', 'Del mes'], ['CONCILIADOS', 'Conciliados'], ['TODOS', 'Todos']].map(([k, tx]) => `<button type="button" role="radio" aria-checked="${fm.vista === k}" class="bca-chip ${fm.vista === k ? 'activo' : ''}" data-vista="${k}">${tx} <b>${vs[k].length.toLocaleString('es-GT')}</b></button>`).join('')}
                </div>
                <select class="bca-tipo-sel" data-filtro-tipo aria-label="Tipo de documento"><option value="">Todos los tipos</option>${Object.entries(TIPOS).map(([k, tx]) => `<option value="${k}" ${fm.tipo === k ? 'selected' : ''}>${tx}</option>`).join('')}</select>
                <label class="tk-buscar bca-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar-mov placeholder="Documento, folio, cliente o proveedor…" value="${esc(fm.buscar)}" aria-label="Buscar movimientos"></label>
                <span class="bca-suma" data-movs-n></span>
              </div>
              <div class="pc-lineas bca-movs" data-movs></div>
            </div>
            <div class="bm-panel" data-panel="RESUMEN" ${pestana === 'RESUMEN' ? '' : 'hidden'}>
              <div class="pc-lineas"><table><thead><tr><th></th><th class="num">Cantidad</th><th class="num">Valor Q</th><th class="num">En la cuenta ${esc(mon?.simbolo || '')}</th></tr></thead>
                <tbody>${res.map((r) => `<tr><td>${esc(r.txt)}</td><td class="num">${r.n}</td><td class="num">${fmt.monto(r.q)}</td><td class="num">${fmt.monto(r.ml)}</td></tr>`).join('')}</tbody></table></div>
            </div>
            <div class="bm-panel" data-panel="DIFERENCIAS" ${pestana === 'DIFERENCIAS' ? '' : 'hidden'}>
              <div class="pc-lineas"><table><thead><tr><th>Descripción</th><th class="num">Valor real Q</th><th class="num">Valor conta Q</th><th class="num">Diferencia</th><th>${ed ? '<button type="button" class="rp-enlace" data-accion="diferencia"><i class="ti ti-plus" aria-hidden="true"></i> Agregar</button>' : ''}</th></tr></thead>
                <tbody>${difs.map((x, i) => `<tr data-dif="${i}"><td><input data-campo="descripcion" value="${esc(x.descripcion)}" maxlength="200" ${dis} aria-label="Descripción"></td><td class="num"><input type="number" step="0.01" data-campo="valor_real" value="${x.valor_real || ''}" ${dis} aria-label="Valor real"></td><td class="num"><input type="number" step="0.01" data-campo="valor_conta" value="${x.valor_conta || ''}" ${dis} aria-label="Valor contable"></td><td class="num" data-dif-valor>${fmt.monto(x.valor_real - x.valor_conta)}</td><td>${ed ? `<button type="button" class="icono-boton" data-quitar-dif="${i}" aria-label="Quitar"><i class="ti ti-x" aria-hidden="true"></i></button>` : ''}</td></tr>`).join('') || `<tr><td colspan="5" class="tk-vacio">Sin diferencias registradas.${ed ? ' Usa «Agregar».' : ''}</td></tr>`}</tbody></table></div>
            </div>
            ${ant ? `<div class="bm-panel" data-panel="ANTERIOR" ${pestana === 'ANTERIOR' ? '' : 'hidden'}>
              <p class="bca-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> Totales del mes tal como los calculó el sistema anterior${conc.fecha_inicial ? `, del ${esc(fmt.fechaDia(conc.fecha_inicial))} al ${esc(fmt.fechaDia(conc.fecha_final))}` : ''}.</p>
              <div class="pc-lineas"><table><thead><tr><th></th><th class="num">Cantidad</th><th class="num">Valor Q</th><th class="num">Valor otra moneda</th></tr></thead>
                <tbody>${[
                  ['Cheques emitidos', 'numero_cheques', 'valor_cheques', 'mi_valor_cheques'], ['Cheques anulados', 'cheques_anulados', 'valor_cheques_anulados', 'mi_valor_cheques_anulados'],
                  ['Cheques cobrados', 'cheques_cobrados', 'valor_cheques_cobrados', 'mi_valor_cheques_cobrados'], ['Cheques en circulación', 'cheques_circulacion', 'valor_cheques_circulacion', 'mi_valor_cheques_circulacion'],
                  ['Depósitos', 'numero_depositos', 'valor_depositos', 'mi_valor_depositos'], ['Depósitos en circulación', 'depositos_circulacion', 'valor_depositos_circulacion', 'mi_valor_depositos_circulacion'],
                  ['Notas de crédito', 'notas_cre', 'valor_notas_cre', 'mi_valor_notas_cre'], ['Notas de crédito en circulación', 'notas_cre_circulacion', 'valor_notas_cre_circulacion', 'mi_valor_notas_cre_circulacion'],
                  ['Notas de débito', 'notas_de', 'valor_notas_de', 'mi_valor_notas_de'], ['Notas de débito en circulación', 'notas_de_circulacion', 'valor_notas_de_circulacion', 'mi_valor_notas_de_circulacion'],
                  ['Saldo anterior', null, 'saldo_anterior', 'mi_saldo_anterior'], ['Saldo según banco', null, 'saldo_banco_ml', 'mi_saldo_segun_banco'],
                  ['Saldo actual', null, 'saldo_actual', 'mi_saldo_actual'], ['Diferencias', null, 'diferencias', 'mi_diferencias']
                ].map(([tx, nn, vq, vm], i) => `<tr class="${i >= 10 ? 'bca-saldo' : ''}"><td>${tx}</td><td class="num">${nn ? (conc[nn] ?? '—') : ''}</td><td class="num">${conc[vq] != null ? fmt.monto(conc[vq]) : '—'}</td><td class="num">${conc[vm] != null ? fmt.monto(conc[vm]) : '—'}</td></tr>`).join('')}</tbody></table></div>
            </div>` : ''}
          </section>
        </form>`;
      pintarMovs();
      adjunto.miniatura(ctx.pDet, imagen());
    }

    function leer(form) {
      ctx.pDet.querySelectorAll('tr[data-dif]').forEach((tr) => {
        const x = difs[Number(tr.dataset.dif)];
        x.descripcion = tr.querySelector('[data-campo=descripcion]').value.trim();
        x.valor_real = fmt.redondear(tr.querySelector('[data-campo=valor_real]').value);
        x.valor_conta = fmt.redondear(tr.querySelector('[data-campo=valor_conta]').value);
      });
      return { fecha: form.elements.fecha.value || fmt.hoy(), saldo_banco: fmt.redondear(form.elements.saldo_banco.value), observaciones: form.elements.observaciones.value.trim() || null };
    }
    const repintar = () => { const form = ctx.pDet.querySelector('.bc-form'); if (form) pintarDetalle(leer(form)); };

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      const v = leer(form);
      const d = { ...v, saldo_banco_ml: fmt.redondear(v.saldo_banco * tc(actual)), saldo_contable: saldoContable, saldo_contable_ml: local(actual) ? saldoContable : fmt.redondear(saldoContable / tc(actual)) };
      const r = conc
        ? await sb.from('conciliaciones').update(d).eq('id', conc.id).select('id').single()
        : await sb.from('conciliaciones').insert({ ...d, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc, cuenta_bancaria_id: actual.id, anio: f.anio, mes: f.mes }).select('id').single();
      if (r.error) { error.textContent = window.UI.traducirError(r.error); return; }
      const id = r.data.id;
      const del = await sb.from('conciliacion_diferencias').delete().eq('conciliacion_id', id);
      if (del.error) { error.textContent = window.UI.traducirError(del.error); return; }
      const ds = difs.filter((x) => x.descripcion);
      if (ds.length) { const ins = await sb.from('conciliacion_diferencias').insert(ds.map((x) => ({ conciliacion_id: id, ...x }))); if (ins.error) { error.textContent = window.UI.traducirError(ins.error); return; } }
      const okImagen = await adjunto.guardar({ tabla: 'conciliaciones', id, carpeta: `${ctx.sel.loc}/conciliaciones/${id}`, nuevo: imagenNueva, quitar: quitarImagen, anterior: conc?.comprobante_ruta });
      window.FIN.aviso(`${conc ? 'Conciliación guardada' : 'Conciliación generada'}${okImagen ? '' : ' · la imagen no se pudo subir (¿falta el script 46?)'}`);
      modificando = false;
      await consultar();
    }

    function reporte() {
      const cb = actual;
      const res = resumen();
      imprimir(`Conciliación ${cb.numero}`, `
        <h1>Conciliación bancaria</h1>
        <h2>${esc(empresa())} · ${esc(ctx.banco(cb.banco_id)?.nombre || '')} ${esc(cb.numero)} · ${MESES[f.mes - 1]} ${f.anio}${cerrada() ? ' · CERRADA' : ''}</h2>
        <div class="cab"><div><b>Según banco</b>${esc(ctx.moneda(cb.moneda_id)?.simbolo || '')} ${fmt.monto(conc.saldo_banco)} · Q ${fmt.monto(conc.saldo_banco_ml)}</div><div><b>Contable</b>Q ${fmt.monto(conc.saldo_contable)}</div><div><b>Diferencia</b>Q ${fmt.monto(conc.saldo_banco_ml - conc.saldo_contable)}</div><div><b>Elaboró</b>${esc(conc.usuario || '')}</div>
          <div><b>Saldo en el sistema</b>${fmt.monto(saldoSistema)}</div><div><b>Fecha</b>${esc(fmt.fechaDia(conc.fecha))}</div><div><b>Cierre</b>${esc(conc.fecha_cierre ? fmt.fechaHora(conc.fecha_cierre) : '—')}</div><div><b>Estado de cuenta</b>${esc(conc.comprobante_nombre || 'Sin imagen')}</div>
          ${conc.observaciones ? `<div style="grid-column:1/-1"><b>Observaciones</b>${esc(conc.observaciones)}</div>` : ''}</div>
        <table><thead><tr><th></th><th class="n">Cantidad</th><th class="n">Valor Q</th><th class="n">En la cuenta ${esc(ctx.moneda(cb.moneda_id)?.simbolo || '')}</th></tr></thead><tbody>${res.map((r) => `<tr><td>${esc(r.txt)}</td><td class="n">${r.n}</td><td class="n">${fmt.monto(r.q)}</td><td class="n">${fmt.monto(r.ml)}</td></tr>`).join('')}</tbody></table>
        <h3>Movimientos en circulación</h3><table><thead><tr><th>Tipo</th><th>Folio</th><th>Documento</th><th>Fecha</th><th class="n">Valor</th></tr></thead><tbody>${movs.filter((m) => !m.conciliado).map((m) => `<tr><td>${esc(TIPOS[m.tipo])}</td><td>${m.folio}</td><td>${esc(m.numero_documento || '')}</td><td>${esc(fmt.fechaDia(m.fecha))}</td><td class="n">${fmt.monto(m.valor_cuenta)}</td></tr>`).join('') || '<tr><td colspan="5">Ninguno</td></tr>'}</tbody></table>
        ${difs.length ? `<h3>Detalle de diferencias</h3><table><thead><tr><th>Descripción</th><th class="n">Valor real</th><th class="n">Valor conta</th><th class="n">Diferencia</th></tr></thead><tbody>${difs.map((x) => `<tr><td>${esc(x.descripcion)}</td><td class="n">${fmt.monto(x.valor_real)}</td><td class="n">${fmt.monto(x.valor_conta)}</td><td class="n">${fmt.monto(x.valor_real - x.valor_conta)}</td></tr>`).join('')}</tbody></table>` : ''}
        <div class="firmas"><div>Elaboró</div><div>Revisó</div><div>Autorizó</div></div>`);
    }

    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { actual = null; modificando = false; pintarFiltros(); return consultar(); }
      if (cambio === 'otro') { f[e.target.name] = Number(e.target.value); modificando = false; return consultar(); }
      if (e.target.matches('[data-filtro-tipo]')) { fm.tipo = e.target.value; limite = PASO; return pintarMovs(); }
      if (e.target.matches('[data-comprobante]')) {
        const archivo = e.target.files[0];
        if (!archivo) return;
        const malo = adjunto.validar(archivo);
        if (malo) return window.FIN.aviso(malo);
        imagenNueva = archivo;
        quitarImagen = false;
        return repintar();
      }
      const ck = e.target.closest('[data-conciliar]');
      if (ck) {
        const { error } = await sb.rpc('procesar_movimiento_bancario', { p_id: Number(ck.dataset.conciliar), p_accion: ck.checked ? 'CONCILIAR' : 'DESCONCILIAR' });
        if (error) { ck.checked = !ck.checked; return window.FIN.aviso(window.UI.traducirError(error)); }
        const m = movs.find((x) => String(x.id) === ck.dataset.conciliar);
        if (m) m.conciliado = ck.checked;
        return repintar();
      }
    });
    cont.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar-mov]')) { fm.buscar = e.target.value; limite = PASO; return pintarMovs(); }
      const form = e.target.closest('.bc-form');
      if (!form) return;
      if (e.target.name === 'saldo_banco') {
        const bq = fmt.redondear(Number(e.target.value || 0) * tc(actual));
        form.querySelector('[data-banco-q]').textContent = `Q ${fmt.monto(bq)}`;
        const aj = fmt.redondear(bq + Number(form.dataset.ing || 0) - Number(form.dataset.egr || 0));
        const df = fmt.redondear(aj - saldoContable);
        form.querySelector('[data-ajustado]').textContent = fmt.monto(aj);
        form.querySelector('[data-dif]').textContent = `Q ${fmt.monto(df)}`;
        form.querySelector('[data-dif-txt]').textContent = df ? 'Diferencia' : 'Cuadra';
        const rs = form.querySelector('[data-resultado]'); rs.classList.toggle('cuadra', !df); rs.classList.toggle('descuadre', !!df);
        rs.querySelector('.ti').className = `ti ${df ? 'ti-alert-triangle' : 'ti-circle-check'}`;
      }
      const tr = e.target.closest('tr[data-dif]');
      if (tr) { leer(form); const x = difs[Number(tr.dataset.dif)]; tr.querySelector('[data-dif-valor]').textContent = fmt.monto(x.valor_real - x.valor_conta); }
    });
    cont.addEventListener('click', async (e) => {
      const tab = e.target.closest('[data-pestana]');
      if (tab) { pestana = tab.dataset.pestana; return activarPestana(ctx.pDet, pestana); }
      const fc = e.target.closest('[data-cuenta]');
      if (fc && ctx.pMae.contains(fc)) { if (modificando) return window.FIN.aviso('Guarda o cancela la conciliación antes de cambiar de cuenta'); return abrir(cuentas.find((c) => String(c.id) === fc.dataset.cuenta)); }
      const vi = e.target.closest('[data-vista]');
      if (vi) { fm.vista = vi.dataset.vista; limite = PASO; ctx.pDet.querySelectorAll('[data-vista]').forEach((x) => { x.classList.toggle('activo', x === vi); x.setAttribute('aria-checked', String(x === vi)); }); return pintarMovs(); }
      if (e.target.closest('[data-ver-mas]')) { limite += PASO; return pintarMovs(); }
      const ac = e.target.closest('[data-accion]');
      if (ac) {
        const a = ac.dataset.accion;
        if (a === 'imprimir') return reporte();
        if (a === 'modificar') { modificando = true; return repintar(); }
        if (a === 'cancelar') return abrir(actual);
        if (a === 'ver-comprobante') return adjunto.ver(imagen());
        if (a === 'quitar-comprobante') { if (imagenNueva) imagenNueva = null; else quitarImagen = true; return repintar(); }
        if (a === 'diferencia') { const form = ctx.pDet.querySelector('.bc-form'); const v = leer(form); difs.push({ descripcion: '', valor_real: 0, valor_conta: 0 }); pestana = 'DIFERENCIAS'; return pintarDetalle(v); }
        if (a === 'cerrar' || a === 'reversar') {
          if (a === 'cerrar' && !confirm(`¿Cerrar la conciliación de ${MESES[f.mes - 1]} ${f.anio}? Ya no se podrá modificar hasta reversar el cierre.`)) return;
          const { error } = await sb.rpc('cerrar_conciliacion', { p_id: conc.id, p_cerrar: a === 'cerrar' });
          if (error) return window.FIN.aviso(window.UI.traducirError(error));
          window.FIN.aviso(a === 'cerrar' ? 'Conciliación cerrada' : 'Cierre reversado');
          return consultar();
        }
      }
      const qd = e.target.closest('[data-quitar-dif]');
      if (qd) { const form = ctx.pDet.querySelector('.bc-form'); const v = leer(form); difs.splice(Number(qd.dataset.quitarDif), 1); return pintarDetalle(v); }
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.bc-form')) { e.preventDefault(); guardar(e.target); } });

    iniciar();
  };
})();
