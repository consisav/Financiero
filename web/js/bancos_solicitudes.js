// Caja y Bancos · Cheques · Solicitud de cheques, con el diseño de los documentos bancarios:
//   Encabezado en tarjetas: tipo de solicitud y empresa; requisición (número, formulario, fecha y
//   estado); importe (moneda, valor de cambio, monto y monto en quetzales); beneficiario
//   (proveedor, empleado, beneficiario); solicitud (departamento, solicitante, descripción general
//   del pago, observaciones) y control (ingreso, modificación, aprobación y cheque emitido).
//   Pestañas: Solicitar cheque (fecha y número de requisición con el que se da seguimiento, y el
//   avance de la solicitud), Listado de solicitudes y Ayuda.
//   Una solicitud aprobada se emite en Cheques · Emisión de cheques.
(function () {
  const { esc } = window.UI;
  const { montar, fmt, imprimir } = window.BANCOS;

  const TIPOS = ['ANTICIPOS', 'PAGO A PROVEEDORES', 'REEMBOLSO', 'VIÁTICOS', 'PLANILLA', 'CAJA CHICA', 'OTROS'];
  const ESTADOS = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'EMITIDA', 'ANULADA'];
  const CLASE = { PENDIENTE: 'pendiente', APROBADA: 'aprobada', RECHAZADA: 'anulada', EMITIDA: 'definitiva', ANULADA: 'anulada' };
  const marca = (e) => `<span class="pc-marca ${CLASE[e] || 'pendiente'}">${esc(e.charAt(0) + e.slice(1).toLowerCase())}</span>`;

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['solicitud-de-cheques'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Solicitud de cheques', icono: 'ti-file-dollar', clase: 'bk-movimientos bk-solicitudes', grupo: 'Cheques' });
    const { sb, yo } = ctx;
    const [anio, mes] = fmt.hoy().split('-');
    const f = { tipo: '', estado: '', desde: `${anio}-${mes}-01`, hasta: fmt.hoy() };
    let solicitudes = [];
    let cuentas = [];
    let actual = null;
    let modificando = false;
    let pestana = 'SOLICITAR';
    let buscar = '';

    const propia = (s) => s && s.perfil_id === yo.id;
    const puedeModificar = (s) => s && s.estado === 'PENDIENTE' && (ctx.admin || propia(s));
    const editable = () => !actual || (modificando && puedeModificar(actual));
    const req = (s) => String(s.numero).padStart(5, '0');

    function pintarFiltros() {
      ctx.filtros(`
        <label class="campo"><span>Tipo de solicitud</span><select name="tipo"><option value="">Todos</option>${TIPOS.map((t) => `<option ${f.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado"><option value="">Todos</option>${ESTADOS.map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${f.desde}" max="${f.hasta}"></label>
        <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${f.hasta}" min="${f.desde}"></label>`);
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const prueba = await sb.from('solicitudes_cheque').select('id').limit(1);
      if (prueba.error) {
        ctx.espacio.innerHTML = `<section class="panel"><p class="vacio">${/solicitudes_cheque/.test(prueba.error.message) ? 'Falta instalar el script 52 (solicitud de cheques) en Supabase.' : esc(prueba.error.message)}</p></section>`;
        return;
      }
      cuentas = await ctx.cuentasBancarias();
      pintarFiltros();
      await consultar();
    }

    async function consultar() {
      if (!ctx.sel.loc) { solicitudes = []; pintarMaestro(); return abrir(null); }
      let q = sb.from('solicitudes_cheque').select('*').eq('localidad_id', ctx.sel.loc).gte('fecha', f.desde).lte('fecha', f.hasta).order('numero', { ascending: false });
      if (f.tipo) q = q.eq('tipo_solicitud', f.tipo);
      if (f.estado) q = q.eq('estado', f.estado);
      const { data, error } = await q;
      if (error) { ctx.pMae.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      solicitudes = data;
      if (actual && !solicitudes.some((s) => s.id === actual.id)) actual = null;
      pintarMaestro();
      await abrir(actual ? solicitudes.find((s) => s.id === actual.id) : solicitudes[0] || null);
    }

    const empresaDe = (s) => {
      const loc = ctx.localidad(s ? s.localidad_id : ctx.sel.loc);
      const org = ctx.organizaciones.find((o) => o.id === (s ? s.organizacion_id : ctx.sel.org));
      return { org: org ? org.nombre : '', loc: loc ? `${loc.codigo} · ${loc.nombre_comercial}` : '' };
    };

    function pintarMaestro() {
      const q = buscar.trim().toLowerCase();
      const filas = solicitudes.filter((s) => !q || [s.numero, s.formulario, s.beneficiario, s.descripcion, s.solicitante, s.cheque_numero].some((v) => String(v || '').toLowerCase().includes(q)));
      const vivas = solicitudes.filter((s) => s.estado !== 'ANULADA' && s.estado !== 'RECHAZADA');
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab tg-cab">
          <h2>Solicitudes <small>${solicitudes.length}</small></h2>
          <div class="ta-totales pc-resumen"><span class="ta-total"><b>Q ${fmt.monto(vivas.reduce((t, s) => t + Number(s.monto_ml), 0))}</b> solicitado</span><span class="ta-total sin"><b>${solicitudes.filter((s) => s.estado === 'PENDIENTE').length}</b> pendientes</span><span class="ta-total"><b>${solicitudes.filter((s) => s.estado === 'APROBADA').length}</b> por emitir</span></div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Buscar requisición, beneficiario…" value="${esc(buscar)}" aria-label="Buscar solicitudes"></label>
        </header>
        <div class="ta-tabla">
          <table>
            <thead><tr><th>Requisición</th><th>Fecha</th><th>Tipo</th><th>Beneficiario</th><th>Descripción</th><th class="num">Monto</th><th class="num">Monto Q</th><th>Solicitante</th><th>Estado</th><th>Cheque</th></tr></thead>
            <tbody>
              ${filas.map((s) => `<tr class="${actual && actual.id === s.id ? 'actual' : ''} ${s.estado === 'ANULADA' ? 'pc-anulada' : ''}" data-sol="${s.id}" tabindex="0">
                <td class="fuerte">${req(s)}</td><td>${esc(fmt.fechaDia(s.fecha))}</td><td>${esc(s.tipo_solicitud)}</td><td>${esc(s.beneficiario)}</td>
                <td class="ta-desc" title="${esc(s.descripcion)}">${esc(s.descripcion)}</td>
                <td class="num">${esc(ctx.moneda(s.moneda_id)?.simbolo || '')} ${fmt.monto(s.monto)}</td><td class="num">${fmt.monto(s.monto_ml)}</td>
                <td>${esc(s.solicitante || '')}</td><td>${marca(s.estado)}</td><td>${s.cheque_numero ? `<span class="pc-tipo">${esc(s.cheque_numero)}</span>` : '<span class="tk-tenue">—</span>'}</td></tr>`).join('')
                || `<tr><td colspan="10" class="tk-vacio"><i class="ti ti-file-dollar" aria-hidden="true"></i>${solicitudes.length ? 'Ninguna solicitud coincide con la búsqueda.' : 'No hay solicitudes en ese rango de fechas.'}</td></tr>`}
            </tbody>
          </table>
        </div>`;
    }

    function abrir(s, editar = false) {
      actual = s;
      modificando = !!s && editar && puedeModificar(s);
      if (!s) pestana = 'SOLICITAR';
      pintarDetalle();
      ctx.pMae.querySelectorAll('tr[data-sol]').forEach((tr) => tr.classList.toggle('actual', !!s && tr.dataset.sol === String(s.id)));
    }

    const pestanas = () => [
      { id: 'SOLICITAR', texto: 'Solicitar cheque', icono: 'ti-send' },
      { id: 'LISTADO', texto: 'Listado de solicitudes', icono: 'ti-list-search', n: solicitudes.length },
      { id: 'AYUDA', texto: 'Ayuda', icono: 'ti-help' }
    ];

    // Avance de la solicitud: solicitada → aprobada → cheque emitido.
    function avance(s) {
      const paso = (ok, txt, det, icono, mal = false) => `<li class="${ok ? 'hecho' : ''} ${mal ? 'mal' : ''}"><i class="ti ${icono}" aria-hidden="true"></i><div><b>${txt}</b><small>${det || '—'}</small></div></li>`;
      if (!s) return '';
      const rechazo = s.estado === 'RECHAZADA' || s.estado === 'ANULADA';
      return `<ol class="bs-avance">
        ${paso(true, 'Solicitada', `${esc(s.solicitante || '')} · ${esc(fmt.fechaHora(s.creado_en))}`, 'ti-send')}
        ${rechazo ? paso(true, s.estado === 'RECHAZADA' ? 'Rechazada' : 'Anulada', `${esc(s.aprobado_por || '')} ${esc(s.motivo || '')}`, 'ti-ban', true)
                  : paso(!!s.aprobado_en, 'Aprobada', s.aprobado_en ? `${esc(s.aprobado_por || '')} · ${esc(fmt.fechaHora(s.aprobado_en))}` : 'Pendiente de aprobación', 'ti-circle-check')}
        ${paso(s.estado === 'EMITIDA', 'Cheque emitido', s.cheque_numero ? `Cheque ${esc(s.cheque_numero)} · ${esc(fmt.fechaDia(s.cheque_fecha))}` : 'Se emite en Emisión de cheques', 'ti-writing')}
      </ol>`;
    }

    function pintarDetalle(v0) {
      const s = actual;
      if (!ctx.sel.loc) { ctx.pDet.innerHTML = ctx.vacio('Elige la empresa.', 'ti-file-dollar'); return; }
      const ed = editable();
      const dis = ed ? '' : 'disabled';
      const base = ctx.monedaBase();
      const v = v0 || (s ? { ...s } : { tipo_solicitud: 'PAGO A PROVEEDORES', formulario: '', fecha: fmt.hoy(), moneda_id: base?.id, tipo_cambio: base?.cambio || 1, monto: '', proveedor_codigo: '', proveedor_nombre: '', empleado_codigo: '', empleado_nombre: '', beneficiario: '', departamento_codigo: '', departamento_nombre: '', descripcion: '', observaciones: '' });
      const montoMl = fmt.redondear(Number(v.monto || 0) * Number(v.tipo_cambio || 1));
      const emp = empresaDe(s);
      const dato = (etq, val, extra = '') => `<div class="bm-dato ${extra}"><dt>${etq}</dt><dd>${val || '<span class="tk-tenue">—</span>'}</dd></div>`;
      const consulta = s && !modificando;
      const estado = s ? s.estado : 'PENDIENTE';
      const cb = s?.cuenta_bancaria_id ? cuentas.find((c) => c.id === s.cuenta_bancaria_id) : null;
      ctx.pDet.innerHTML = `
        <form class="tk-form ta-form bm-form bs-form" novalidate>
          <header class="tk-titulo bm-titulo">
            <div class="tk-titulo-texto"><small>Solicitud de cheques · ${esc(emp.org)} › ${esc(emp.loc)}</small><h2>${s ? `Requisición ${req(s)}` : 'Nueva solicitud de cheque'}</h2></div>
            <div class="tk-marcas">${s ? marca(s.estado) : '<span class="pc-marca pendiente">Sin solicitar</span>'}${modificando ? '<span class="pc-marca pendiente"><i class="ti ti-pencil" aria-hidden="true"></i> Modificando</span>' : ''}</div>
            <div class="tk-titulo-acciones">
              ${consulta ? '<button type="button" class="boton secundario-sm" data-accion="nuevo"><i class="ti ti-plus" aria-hidden="true"></i> Nueva</button>' : ''}
              ${consulta ? '<button type="button" class="boton secundario-sm" data-accion="imprimir"><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>' : ''}
              ${consulta && ctx.admin && ['PENDIENTE', 'APROBADA', 'RECHAZADA'].includes(s.estado) ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="anular"><i class="ti ti-ban" aria-hidden="true"></i> Anular</button>' : ''}
              ${consulta && ctx.admin && ['APROBADA', 'RECHAZADA'].includes(s.estado) ? '<button type="button" class="boton secundario-sm" data-accion="pendiente"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Regresar a pendiente</button>' : ''}
              ${consulta && ctx.admin && s.estado === 'PENDIENTE' ? '<button type="button" class="boton secundario-sm rp-peligro" data-accion="rechazar"><i class="ti ti-x" aria-hidden="true"></i> Rechazar</button><button type="button" class="boton secundario-sm" data-accion="aprobar"><i class="ti ti-circle-check" aria-hidden="true"></i> Aprobar</button>' : ''}
              ${consulta && s.estado === 'APROBADA' && ctx.admin ? '<button type="button" class="boton primario-sm" data-accion="emitir" title="Abre Emisión de cheques con esta solicitud"><i class="ti ti-writing" aria-hidden="true"></i> Emitir cheque</button>' : ''}
              ${consulta && puedeModificar(s) ? '<button type="button" class="boton primario-sm" data-accion="modificar"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar</button>' : ''}
              ${modificando ? '<button type="button" class="boton secundario-sm" data-accion="cancelar"><i class="ti ti-x" aria-hidden="true"></i> Cancelar</button><button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar cambios</button>' : ''}
            </div>
          </header>
          <p class="modal-error tk-error" role="alert"></p>
          ${s && s.motivo && ['RECHAZADA', 'ANULADA'].includes(s.estado) ? `<p class="tk-aviso bm-anulado"><i class="ti ti-ban" aria-hidden="true"></i> ${s.estado === 'RECHAZADA' ? 'Rechazada' : 'Anulada'}${s.aprobado_por ? ` por ${esc(s.aprobado_por)}` : ''}: ${esc(s.motivo)}</p>` : ''}

          <div class="bs-cabecera ${ed ? 'editando' : 'consulta'}">
            <section class="bs-tipo">
              <label class="campo"><span>Tipo de solicitud *</span><select name="tipo_solicitud" ${dis}>${TIPOS.map((t) => `<option ${v.tipo_solicitud === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
              <div class="bs-empresa"><small>Organización</small><b title="${esc(emp.org)}">${esc(emp.org)}</b><small>Empresa</small><b title="${esc(emp.loc)}">${esc(emp.loc)}</b></div>
            </section>
            <section class="bs-req">
              <div class="bs-req-num"><span>No. requisición</span><b>${s ? req(s) : 'Automático'}</b></div>
              <label class="campo"><span># Formulario</span><input name="formulario" value="${esc(v.formulario || '')}" maxlength="30" ${dis}></label>
              <label class="campo"><span>Fecha *</span><input type="date" name="fecha" value="${esc(v.fecha)}" ${dis}></label>
              <div class="bs-estado"><span>Estado</span>${marca(estado)}</div>
            </section>
            <section class="bm-importe bs-importe">
              <label class="campo"><span>Moneda</span><select name="moneda_id" ${dis}>${ctx.monedas.map((m) => `<option value="${m.id}" ${v.moneda_id === m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
              <label class="campo"><span>Valor cambio</span><input type="number" step="any" min="0" name="tipo_cambio" value="${esc(String(v.tipo_cambio ?? 1))}" ${dis}></label>
              <label class="campo"><span>Monto *</span><input type="number" step="0.01" min="0" name="monto" value="${esc(String(v.monto ?? ''))}" ${dis}></label>
              <div class="bm-ml"><span>Monto en quetzales</span><b data-monto-ml>Q ${fmt.monto(montoMl)}</b></div>
            </section>

            <section class="bm-bloque bs-benef">
              <h3 class="ta-col-titulo"><i class="ti ti-user-dollar" aria-hidden="true"></i> Beneficiario</h3>
              <div class="bs-campos">
                <label class="campo"><span>Proveedor</span><input name="proveedor_codigo" value="${esc(v.proveedor_codigo || '')}" maxlength="20" placeholder="Código" ${dis}></label>
                <label class="campo bs-c3"><span>Nombre del proveedor</span><input name="proveedor_nombre" value="${esc(v.proveedor_nombre || '')}" maxlength="150" ${dis}></label>
                <label class="campo"><span>Empleado</span><input name="empleado_codigo" value="${esc(v.empleado_codigo || '')}" maxlength="20" placeholder="Código" ${dis}></label>
                <label class="campo bs-c3"><span>Nombre del empleado</span><input name="empleado_nombre" value="${esc(v.empleado_nombre || '')}" maxlength="150" ${dis}></label>
                <label class="campo bs-c4"><span>Beneficiario (a favor de) *</span><input name="beneficiario" value="${esc(v.beneficiario || '')}" maxlength="150" placeholder="Nombre que se imprime en el cheque" ${dis}></label>
              </div>
            </section>
            <section class="bm-bloque bs-sol">
              <h3 class="ta-col-titulo"><i class="ti ti-clipboard-text" aria-hidden="true"></i> Solicitud</h3>
              <div class="bs-campos">
                <label class="campo"><span>Depto. solicita</span><input name="departamento_codigo" value="${esc(v.departamento_codigo || '')}" maxlength="20" placeholder="Código" ${dis}></label>
                <label class="campo"><span>Departamento</span><input name="departamento_nombre" value="${esc(v.departamento_nombre || '')}" maxlength="100" ${dis}></label>
                <div class="campo bs-c2"><span>Solicitante</span><input value="${esc(s ? s.solicitante || '' : (yo.nombre || yo.usuario || '').toUpperCase())}" disabled aria-label="Solicitante"></div>
                <label class="campo bs-c4"><span>Descripción general del pago *</span><input name="descripcion" value="${esc(v.descripcion || '')}" maxlength="300" ${dis}></label>
                <label class="campo bs-c4"><span>Observaciones</span><input name="observaciones" value="${esc(v.observaciones || '')}" maxlength="300" ${dis}></label>
              </div>
            </section>
            <section class="bm-bloque bm-control bs-control">
              <h3 class="ta-col-titulo"><i class="ti ti-shield-check" aria-hidden="true"></i> Control</h3>
              <dl>
                ${dato('Ingreso', s ? `${esc(s.creado_por_nombre || s.solicitante || '')} <small>${esc(fmt.fechaHora(s.creado_en))}</small>` : `<span>${esc((yo.usuario || '').toUpperCase())}</span> <small data-reloj>${esc(fmt.fechaHora(new Date()))}</small>`, 'bm-c2')}
                ${dato('Modificó', s?.modificado_en && s.modificado_en !== s.creado_en ? `${esc(s.modificado_por_nombre || '')} <small>${esc(fmt.fechaHora(s.modificado_en))}</small>` : '', 'bm-c2')}
                ${dato(s?.estado === 'RECHAZADA' ? 'Rechazó' : 'Aprobó', s?.aprobado_por ? esc(s.aprobado_por) : '')}
                ${dato('Fecha aprueba', s?.aprobado_en ? esc(fmt.fechaHora(s.aprobado_en)) : '')}
                ${dato('Cheque', s?.cheque_numero ? `<b>${esc(s.cheque_numero)}</b>${cb ? ` <small>${esc(cb.numero)}</small>` : ''}` : '')}
                ${dato('Fecha cheque', s?.cheque_fecha ? esc(fmt.fechaDia(s.cheque_fecha)) : '')}
              </dl>
            </section>
          </div>

          <section class="bm-pestanas">
            <div class="bm-tabs-barra">
              <div class="rp-pestanas" role="tablist">${pestanas().map((p) => `<button type="button" role="tab" data-pestana="${p.id}" class="${pestana === p.id ? 'activa' : ''}" aria-selected="${pestana === p.id}"><i class="ti ${p.icono}" aria-hidden="true"></i> ${esc(p.texto)}${p.n ? ` <b>${p.n}</b>` : ''}</button>`).join('')}</div>
            </div>
            <div class="bm-panel bs-solicitar" data-panel="SOLICITAR" ${pestana === 'SOLICITAR' ? '' : 'hidden'}>
              <div class="bs-requisicion">
                <div class="bs-req-campos">
                  <div><span>Fecha</span><b>${esc(fmt.fechaDia(s ? s.fecha : v.fecha))}</b></div>
                  <div><span># De requisición cheque</span><b class="bs-req-grande">${s ? req(s) : '—'}</b></div>
                </div>
                <p><i class="ti ti-info-circle" aria-hidden="true"></i> Con este número deberá darle seguimiento a su solicitud.</p>
              </div>
              <div class="bs-accion">
                ${!s ? `<button type="submit" class="boton primario-sm bs-solicitar-btn"><i class="ti ti-send" aria-hidden="true"></i> Solicitar cheque</button><small>Se registra como pendiente de aprobación y recibe su número de requisición.</small>` : avance(s)}
              </div>
            </div>
            <div class="bm-panel bm-listado" data-panel="LISTADO" ${pestana === 'LISTADO' ? '' : 'hidden'}></div>
            <div class="bm-panel bs-ayuda" data-panel="AYUDA" ${pestana === 'AYUDA' ? '' : 'hidden'}>
              <ol>
                <li><b>Solicitar:</b> llena el tipo, el beneficiario, el monto y la descripción del pago y presiona «Solicitar cheque». Recibes el número de requisición.</li>
                <li><b>Aprobar o rechazar:</b> un administrador revisa la solicitud pendiente. Mientras está pendiente, quien la hizo puede modificarla.</li>
                <li><b>Emitir:</b> con la solicitud aprobada, «Emitir cheque» abre Emisión de cheques con sus datos; al registrar el cheque la solicitud queda <i>Emitida</i> con el número del cheque.</li>
                <li><b>Anular:</b> si el cheque se anula, la solicitud regresa a <i>Aprobada</i> para emitir otro.</li>
              </ol>
            </div>
          </section>
        </form>`;
      ctx.pDet.querySelector('[data-panel=LISTADO]').appendChild(ctx.pMae);
    }

    function leer(form) {
      const el = form.elements;
      const t = (n) => el[n].value.trim() || null;
      return {
        tipo_solicitud: el.tipo_solicitud.value, formulario: t('formulario'), fecha: el.fecha.value,
        moneda_id: Number(el.moneda_id.value), tipo_cambio: Number(el.tipo_cambio.value) || 1, monto: fmt.redondear(el.monto.value),
        proveedor_codigo: t('proveedor_codigo'), proveedor_nombre: t('proveedor_nombre'), empleado_codigo: t('empleado_codigo'), empleado_nombre: t('empleado_nombre'),
        beneficiario: el.beneficiario.value.trim(), departamento_codigo: t('departamento_codigo'), departamento_nombre: t('departamento_nombre'),
        descripcion: el.descripcion.value.trim(), observaciones: t('observaciones')
      };
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      const v = leer(form);
      if (!v.beneficiario) { error.textContent = 'Escribe el beneficiario (a favor de quién es el cheque).'; return form.elements.beneficiario.focus(); }
      if (!v.monto || v.monto <= 0) { error.textContent = 'Escribe el monto de la solicitud.'; return form.elements.monto.focus(); }
      if (!v.descripcion) { error.textContent = 'Escribe la descripción general del pago.'; return form.elements.descripcion.focus(); }
      if (!v.fecha) { error.textContent = 'Escribe la fecha.'; return; }
      error.textContent = '';
      const boton = form.querySelector('[type=submit]');
      if (boton) boton.disabled = true;
      try {
        if (actual) {
          const r = await sb.from('solicitudes_cheque').update(v).eq('id', actual.id);
          if (r.error) throw r.error;
          window.FIN.aviso(`Solicitud ${req(actual)} guardada`);
          actual = { id: actual.id };
        } else {
          const r = await sb.from('solicitudes_cheque').insert({ ...v, organizacion_id: ctx.sel.org, localidad_id: ctx.sel.loc }).select('id, numero').single();
          if (r.error) throw r.error;
          window.FIN.aviso(`Cheque solicitado · requisición ${req(r.data)}: con este número dé seguimiento a su solicitud`);
          actual = { id: r.data.id };
          // La solicitud nueva queda a la vista aunque su fecha esté fuera del rango.
          if (v.fecha < f.desde) f.desde = v.fecha;
          if (v.fecha > f.hasta) f.hasta = v.fecha;
          f.estado = ''; f.tipo = '';
          pintarFiltros();
        }
        modificando = false;
        await consultar();
      } catch (err) {
        error.textContent = window.UI.traducirError(err);
      } finally {
        if (boton) boton.disabled = false;
      }
    }

    async function procesar(accion) {
      let motivo = null;
      if (accion === 'RECHAZAR' || accion === 'ANULAR') {
        motivo = prompt(`Motivo ${accion === 'RECHAZAR' ? 'del rechazo' : 'de la anulación'} de la solicitud ${req(actual)}:`);
        if (motivo === null) return;
      }
      if (accion === 'APROBAR' && !confirm(`¿Aprobar la solicitud ${req(actual)} por ${ctx.moneda(actual.moneda_id)?.simbolo || 'Q'} ${fmt.monto(actual.monto)} a favor de ${actual.beneficiario}?`)) return;
      const { error } = await sb.rpc('procesar_solicitud_cheque', { p_id: actual.id, p_accion: accion, p_motivo: motivo });
      if (error) { const e = ctx.pDet.querySelector('.modal-error'); if (e) e.textContent = window.UI.traducirError(error); return; }
      window.FIN.aviso({ APROBAR: 'Solicitud aprobada', RECHAZAR: 'Solicitud rechazada', ANULAR: 'Solicitud anulada', PENDIENTE: 'La solicitud regresó a pendiente' }[accion]);
      await consultar();
    }

    function imprimirSolicitud() {
      const s = actual;
      const emp = empresaDe(s);
      const mon = ctx.moneda(s.moneda_id);
      imprimir(`Solicitud ${req(s)}`, `
        <h1>Solicitud de cheque · requisición ${req(s)}</h1>
        <h2>${esc(emp.org)} › ${esc(emp.loc)} · ${esc(s.estado)}</h2>
        <div class="cab">
          <div><b>Tipo de solicitud</b>${esc(s.tipo_solicitud)}</div><div><b>Fecha</b>${esc(fmt.fechaDia(s.fecha))}</div><div><b># Formulario</b>${esc(s.formulario || '')}</div><div><b>Estado</b>${esc(s.estado)}</div>
          <div><b>Monto</b>${esc(mon?.simbolo || '')} ${fmt.monto(s.monto)}</div><div><b>Monto en quetzales</b>Q ${fmt.monto(s.monto_ml)}</div><div><b>Moneda · cambio</b>${esc(mon?.nombre || '')} · ${s.tipo_cambio}</div><div><b>Cheque</b>${esc(s.cheque_numero || '')}</div>
          <div style="grid-column:span 2"><b>Beneficiario</b>${esc(s.beneficiario)}</div><div style="grid-column:span 2"><b>Proveedor · empleado</b>${esc([s.proveedor_codigo, s.proveedor_nombre, s.empleado_codigo, s.empleado_nombre].filter(Boolean).join(' · '))}</div>
          <div style="grid-column:span 2"><b>Departamento</b>${esc([s.departamento_codigo, s.departamento_nombre].filter(Boolean).join(' · '))}</div><div style="grid-column:span 2"><b>Solicitante</b>${esc(s.solicitante || '')}</div>
          <div style="grid-column:1/-1"><b>Descripción general del pago</b>${esc(s.descripcion)}</div>
          ${s.observaciones ? `<div style="grid-column:1/-1"><b>Observaciones</b>${esc(s.observaciones)}</div>` : ''}</div>
        <div class="firmas"><div>Solicitó: ${esc(s.solicitante || '')}</div><div>Aprobó: ${esc(s.aprobado_por || '')}</div><div>Recibió</div></div>`);
    }

    // ---------- Eventos ----------
    cont.addEventListener('change', async (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org' || cambio === 'loc') { actual = null; cuentas = await ctx.cuentasBancarias(); pintarFiltros(); return consultar(); }
      if (cambio === 'otro') {
        f[e.target.name] = e.target.value;
        if (f.desde && f.hasta && f.hasta < f.desde) { if (e.target.name === 'desde') f.hasta = f.desde; else f.desde = f.hasta; }
        pintarFiltros();
        actual = null;
        return consultar();
      }
      const form = e.target.closest('.bs-form');
      if (!form) return;
      if (e.target.name === 'moneda_id') form.elements.tipo_cambio.value = ctx.moneda(Number(e.target.value))?.cambio || 1;
      if (['moneda_id', 'tipo_cambio', 'monto'].includes(e.target.name)) {
        const v = leer(form);
        form.querySelector('[data-monto-ml]').textContent = `Q ${fmt.monto(v.monto * v.tipo_cambio)}`;
      }
      // El beneficiario sale del proveedor o del empleado si está vacío.
      if (['proveedor_nombre', 'empleado_nombre'].includes(e.target.name) && !form.elements.beneficiario.value.trim()) form.elements.beneficiario.value = e.target.value.toUpperCase();
    });
    cont.addEventListener('input', (e) => {
      if (e.target.matches('[data-buscar]')) {
        buscar = e.target.value;
        const pos = e.target.selectionStart;
        pintarMaestro();
        const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
        return;
      }
      const form = e.target.closest('.bs-form');
      if (form && ['monto', 'tipo_cambio'].includes(e.target.name)) {
        const v = leer(form);
        form.querySelector('[data-monto-ml]').textContent = `Q ${fmt.monto(v.monto * v.tipo_cambio)}`;
      }
    });
    cont.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-buscar]')) e.preventDefault(); });
    cont.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-pestana]');
      if (tab) {
        pestana = tab.dataset.pestana;
        ctx.pDet.querySelectorAll('[data-pestana]').forEach((b) => { b.classList.toggle('activa', b === tab); b.setAttribute('aria-selected', b === tab); });
        ctx.pDet.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== pestana; });
        return;
      }
      const fila = e.target.closest('tr[data-sol]');
      if (fila) { pestana = 'SOLICITAR'; return abrir(solicitudes.find((s) => String(s.id) === fila.dataset.sol)); }
      const ac = e.target.closest('[data-accion]');
      if (!ac) return;
      const a = ac.dataset.accion;
      if (a === 'nuevo') { abrir(null); return ctx.pDet.querySelector('[name=beneficiario]')?.focus(); }
      if (a === 'modificar') { modificando = true; pintarDetalle(); return ctx.pDet.querySelector('[name=beneficiario]')?.focus(); }
      if (a === 'cancelar') return abrir(actual);
      if (a === 'imprimir') return imprimirSolicitud();
      if (a === 'emitir') {
        try { sessionStorage.setItem('fin.solicitud-cheque', String(actual.id)); } catch (err) { /* sin almacenamiento: se elige a mano */ }
        location.hash = '#/caja-bancos/emision-de-cheques';
        return;
      }
      return procesar({ aprobar: 'APROBAR', rechazar: 'RECHAZAR', anular: 'ANULAR', pendiente: 'PENDIENTE' }[a]);
    });
    cont.addEventListener('submit', (e) => { if (e.target.matches('.bs-form')) { e.preventDefault(); guardar(e.target); } });

    const reloj = setInterval(() => {
      if (!ctx.pDet.isConnected) return clearInterval(reloj);
      const c = ctx.pDet.querySelector('[data-reloj]');
      if (c) c.textContent = fmt.fechaHora(new Date());
    }, 1000);

    iniciar();
  };
})();
