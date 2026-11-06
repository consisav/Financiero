// Catálogos · Iniciales · Parámetros generales: un registro por localidad con parámetros de
// tiempo, uso de pantallas, impuestos, monedas y las personas que firman (autorizaciones).
// Se edita en la misma pantalla y se guarda con "Guardar cambios".
(function () {
  const { esc } = window.UI;
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const TIPOS_FIRMA = ['Contador general', 'Representante legal', 'Auditor', 'Otro'];

  // Valores iniciales para una localidad sin parámetros (tasas vigentes en Guatemala).
  function porDefecto() {
    const h = new Date();
    const anio = h.getFullYear();
    return {
      anio_actual: anio, mes_actual: h.getMonth() + 1,
      inicio_periodo_actual: `${anio}-01-01`, fin_periodo_actual: `${anio}-12-31`,
      inicio_periodo_fiscal: `${anio}-01-01`, fin_periodo_fiscal: `${anio}-12-31`,
      aplicar_iva: true, incluir_centros_costo: false, migracion_bancos: 'MANUAL',
      impuesto1: 12, nombre_impuesto1: 'IVA', impuesto2: 5, nombre_impuesto2: 'ISR',
      impuesto3: 0, nombre_impuesto3: 'OTRO', impuesto4: 10, nombre_impuesto4: 'INGUAT',
      idp_super: 4.7, idp_regular: 4.6, idp_diesel: 1.3,
      moneda_integracion: 'Quetzales', moneda_ingreso: 'Quetzales', primer_mes_contable: 1, ultimo_mes_contable: 12
    };
  }

  // Parámetros adicionales del sistema anterior (script 85), por bloque: [columna, etiqueta, tipo]
  // con tipo n = número, i = entero, t = texto, d = fecha.
  const GRUPOS = {
    cuentas: [
      ['cuenta_principal_ingresos', 'Cuenta principal de ingresos', 't'], ['cuenta_principal_egresos', 'Cuenta principal de egresos', 't'],
      ['cuenta_resultado_ejercicio', 'Cuenta resultado del ejercicio', 't'], ['cuenta_principal_ganancia', 'Cuenta principal de ganancia', 't'],
      ['cuenta_principal_perdida', 'Cuenta principal de pérdida', 't'], ['cuenta_dummy', 'Cuenta dummy', 't'],
      ['cuenta_dif_cambiario', 'Cuenta diferencial cambiario', 't'], ['cuenta_idp', 'Cuenta IDP', 't'],
      ['cta_iva_retenido', 'Cuenta IVA retenido', 't'], ['cta_isr_retenido', 'Cuenta ISR retenido', 't'],
      ['cta_iva_factura_especial', 'Cuenta IVA fact. especial', 't'], ['cta_isr_factura_especial', 'Cuenta ISR fact. especial', 't']
    ],
    nomina: [
      ['pct_igss', '% IGSS laboral', 'n'], ['cuota_patronal', '% Cuota patronal', 'n'], ['pct_irtra', '% IRTRA', 'n'],
      ['pct_indemnizacion', '% Indemnización', 'n'], ['pct_aguinaldo', '% Aguinaldo', 'n'], ['pct_bono14', '% Bono 14', 'n'],
      ['pct_vacaciones', '% Vacaciones', 'n']
    ],
    retenciones: [
      ['pct_retencion', '% Retención', 'n'], ['pct_retencion_agente', '% Retención agente', 'n'], ['no_establecimiento', 'No. establecimiento', 'i'],
      ['no_ini_retencion', 'No. inicial de retención', 'i'], ['no_fin_retencion', 'No. final de retención', 'i'], ['registro_contador', 'Registro del contador', 't'],
      ['correo_retenciones', 'Correo de retenciones', 't'], ['correo_copia_o_ret', 'Correo copia', 't'], ['correo_aviso_nocuadre', 'Correo aviso no cuadre', 't'],
      ['nombre_envio', 'Nombre de envío', 't'], ['puesto_envio', 'Puesto de envío', 't'], ['prefijo_archivo', 'Prefijo de archivo', 't'],
      ['sufijo_archivo', 'Sufijo de archivo', 't']
    ],
    otros: [
      ['cheque_inicial', 'Cheque inicial', 'i'], ['cheque_final', 'Cheque final', 'i'],
      ['fecha_ini_anticipos', 'Inicio de anticipos', 'd'], ['meses_max_presenta_compras', 'Meses máx. compras', 'i'],
      ['version_actual_nomenclatura', 'Versión nomencl. ant.', 'i'], ['fecha_version', 'Fecha de la versión', 'd'],
      ['nombre_planillas', 'Nombre de planillas', 't'], ['nombre_caja_chica', 'Nombre caja chica', 't'],
      ['descripcion_poliza_resultados', 'Póliza de resultados', 't'], ['descripcion_poliza_balance', 'Póliza de balance', 't'],
      ['descripcion_poliza_distrib', 'Póliza de distribución', 't'], ['descripcion_poliza_apertura', 'Póliza de apertura', 't'],
      ['path_retenciones', 'Ruta retenciones', 't'], ['path_retenciones_net', 'Ruta retenciones (red)', 't'],
      ['path_retenciones_envio', 'Ruta envío retenciones', 't'], ['path_archivos', 'Ruta de archivos', 't'],
      ['path_backup_bdd', 'Ruta respaldo BD', 't'], ['path_backup_apl', 'Ruta respaldo aplicación', 't']
    ]
  };

  const v = (x) => (x === null || x === undefined ? '' : esc(x));
  const fecha = (n, p, et) => `<label class="campo-linea"><span>${et}</span><input type="date" name="${n}" value="${v(p[n])}"></label>`;
  const numero = (n, p, et, paso = '0.01') => `<label class="campo-linea"><span>${et}</span><input type="number" step="${paso}" min="0" name="${n}" value="${v(p[n])}"></label>`;
  const texto = (n, p, et, extra = '') => `<label class="campo-linea"><span>${et}</span><input type="text" name="${n}" value="${v(p[n])}" ${extra}></label>`;
  const mes = (n, p, et) => `<label class="campo-linea"><span>${et}</span><select name="${n}">${MESES.map((m, i) => `<option value="${i + 1}" ${p[n] === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>`;
  const campoGrupo = ([n, et, tipo], p) => tipo === 'd' ? fecha(n, p, et)
    : tipo === 'n' ? numero(n, p, et) : tipo === 'i' ? numero(n, p, et, '1') : texto(n, p, et);
  const casilla = (n, p, et) => `<label class="casilla-linea"><input type="checkbox" name="${n}" ${p[n] ? 'checked' : ''}> ${et}</label>`;

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS.parametros = async function (cont, m) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    const estado = { orgs: [], locs: [], org: null, loc: null, param: null, firmantes: [], usuarios: [], version: null };

    const [o, l, us] = await Promise.all([
      sb.from('organizaciones').select('id, codigo, nombre').eq('activo', true).order('codigo'),
      sb.from('localidades').select('id, organizacion_id, codigo, nombre_comercial, nit').eq('activo', true).order('codigo'),
      sb.rpc('usuarios_resumen')
    ]);
    if (o.error || l.error) { cont.innerHTML = `<p class="vacio">${esc((o.error || l.error).message)}</p>`; return; }
    estado.orgs = o.data;
    estado.locs = l.data;
    estado.usuarios = us.data || [];
    if (!estado.locs.length) {
      cont.innerHTML = `<p class="vacio">Los parámetros son por localidad: primero crea una en <a href="#/administracion/organizaciones">Administración · Catálogos · Organizaciones</a>.</p>`;
      return;
    }
    const yo = window.FIN.perfil();
    const inicial = estado.locs.find((x) => x.id === yo.localidad_id) || estado.locs[0];
    estado.org = inicial.organizacion_id;
    estado.loc = inicial.id;

    async function cargar() {
      const [p, cat] = await Promise.all([
        sb.from('parametros_generales').select('*, parametros_firmantes(*)').eq('localidad_id', estado.loc).maybeSingle(),
        sb.from('catalogos_cuentas').select('version').eq('localidad_id', estado.loc).eq('activo', true).order('version', { ascending: false }).limit(1)
      ]);
      if (p.error) { cont.innerHTML = `<p class="vacio">${esc(p.error.message)}</p>`; return; }
      estado.param = p.data;
      estado.firmantesEditados = false;
      estado.firmantes =p.data ? (p.data.parametros_firmantes || []).sort((a, b) => a.orden - b.orden) : [];
      estado.version = cat.error ? null : (cat.data[0] || {}).version || null;
      pintar();
    }

    function pintar() {
      const p = estado.param || porDefecto();
      const locsOrg = estado.locs.filter((x) => x.organizacion_id === estado.org);
      const locAct = estado.locs.find((x) => x.id === estado.loc);
      if (!p.nit && locAct && locAct.nit) p.nit = locAct.nit;
      const firmantes = estado.firmantes.length || estado.firmantesEditados ? estado.firmantes
        : [{ tipo: 'Contador general' }, { tipo: 'Representante legal' }];
      const org = estado.orgs.find((x) => x.id === estado.org) || {};
      const bloque = (titulo, icono, cuerpo, clase = '') => `
            <section class="pg-b ${clase}"><h3><i class="ti ${icono}" aria-hidden="true"></i> ${titulo}</h3>${cuerpo}</section>`;
      const grupo = (id) => GRUPOS[id].map((c) => campoGrupo(c, p)).join('');
      cont.innerHTML = `
        <form id="f-parametros" class="parametros pg">
          <header class="pg-barra">
            <label class="us-filtro"><span>Organización</span><select data-org>${estado.orgs.map((x) => `<option value="${x.id}" ${x.id === estado.org ? 'selected' : ''}>${x.codigo} · ${esc(x.nombre)}</option>`).join('')}</select></label>
            <label class="us-filtro"><span>Localidad</span><select data-loc>${locsOrg.map((x) => `<option value="${x.id}" ${x.id === estado.loc ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre_comercial)}</option>`).join('')}</select></label>
            ${estado.param && estado.param.id
              ? `<span class="pg-audit">Grabado por <b>${esc(estado.param.creado_por_nombre || 'sistema')}</b> el ${window.UI.fecha(estado.param.creado_en)}${estado.param.modificado_en ? ` · modificado por <b>${esc(estado.param.modificado_por_nombre || 'sistema')}</b> el ${window.UI.fecha(estado.param.modificado_en)}` : ''}</span>`
              : `<span class="pg-aviso"><i class="ti ti-info-circle" aria-hidden="true"></i> ${esc(org.nombre || '')} · ${esc(locAct ? locAct.codigo : '')} todavía no tiene parámetros: se muestran valores sugeridos${editable ? '; revísalos y pulsa Guardar cambios' : ''}.</span>`}
            <p class="modal-error" role="alert"></p>
            <button type="button" class="icono-boton" data-accion="param-actualizar" title="Actualizar" aria-label="Actualizar"><i class="ti ti-refresh" aria-hidden="true"></i></button>
            ${editable ? '<button type="submit" class="boton primario-sm"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar cambios</button>' : ''}
          </header>

          <div class="pg-grid">
            ${bloque('Tiempo', 'ti-calendar', `
              ${numero('anio_actual', p, 'Año actual', '1')}
              ${mes('mes_actual', p, 'Mes actual')}
              ${fecha('ultimo_cierre', p, 'Último cierre')}
              ${fecha('proximo_cierre', p, 'Próximo cierre')}
              ${fecha('inicio_periodo_actual', p, 'Inicio período actual')}
              ${fecha('fin_periodo_actual', p, 'Fin período actual')}
              ${fecha('inicio_periodo_fiscal', p, 'Inicio período fiscal')}
              ${fecha('fin_periodo_fiscal', p, 'Fin período fiscal')}`)}
            ${bloque('Impuestos · IDP · uso', 'ti-receipt-tax', `
              ${[1, 2, 3, 4].map((i) => `
                <div class="pg-imp">
                  <span>Impuesto ${i}</span>
                  <input type="text" name="nombre_impuesto${i}" value="${v(p['nombre_impuesto' + i])}" aria-label="Nombre impuesto ${i}">
                  <input type="number" step="0.01" min="0" name="impuesto${i}" value="${v(p['impuesto' + i])}" aria-label="Porcentaje impuesto ${i}"><em>%</em>
                </div>`).join('')}
              <div class="pg-idp"><span>IDP</span>
                ${[['idp_super', 'Súper'], ['idp_regular', 'Regular'], ['idp_diesel', 'Diésel']].map(([n, et]) => `<label>${et}<input type="number" step="0.01" min="0" name="${n}" value="${v(p[n])}"></label>`).join('')}
              </div>
              <div class="pg-uso">
                ${casilla('aplicar_iva', p, 'Aplicar IVA')}
                ${casilla('incluir_centros_costo', p, 'Centros de costo')}
              </div>
              <div class="pg-uso" role="radiogroup" aria-label="Modo de migración de estados de cuenta de bancos">
                <span>Migración estados de cuenta</span>
                <label><input type="radio" name="migracion_bancos" value="MANUAL" ${p.migracion_bancos !== 'AUTOMATICA' ? 'checked' : ''}> Manual</label>
                <label><input type="radio" name="migracion_bancos" value="AUTOMATICA" ${p.migracion_bancos === 'AUTOMATICA' ? 'checked' : ''}> Automática</label>
              </div>`)}
            ${bloque('General', 'ti-building', `
              ${texto('nit', p, 'NIT', 'placeholder="8136624-8"')}
              ${texto('moneda_integracion', p, 'Moneda integración')}
              ${texto('moneda_ingreso', p, 'Moneda ingreso información')}
              ${mes('primer_mes_contable', p, 'Primer mes contable')}
              ${mes('ultimo_mes_contable', p, 'Último mes contable')}
              ${numero('valor_cheques_autorizacion', p, 'Valor cheques a autorizar')}
              <label class="campo-linea"><span>Versión actual nomenclatura</span><input type="text" value="${estado.version || '—'}" readonly tabindex="-1"></label>`)}
            ${bloque('Nómina', 'ti-users', grupo('nomina'))}
            ${bloque('Cuentas estados financieros', 'ti-report-money', grupo('cuentas'))}
            ${bloque('Retenciones', 'ti-receipt', grupo('retenciones'))}
            <div class="pg-ancho">
              ${bloque('Autorizaciones · personas que firman', 'ti-signature', `
                <table class="pg-firmantes">
                  <thead><tr><th>Firma como</th><th>Persona que firma</th><th>Cargo</th><th># Registro</th><th>Usuario</th><th></th></tr></thead>
                  <tbody>
                    ${firmantes.map((f, i) => `
                      <tr data-fila="${i}" data-anterior="${v(f.usuario_anterior)}">
                        <td><select name="tipo">${TIPOS_FIRMA.map((t) => `<option ${t === f.tipo ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
                        <td><input type="text" name="nombre" value="${v(f.nombre)}" aria-label="Nombre"></td>
                        <td><input type="text" name="cargo" value="${v(f.cargo)}" aria-label="Cargo"></td>
                        <td><input type="text" name="registro" value="${v(f.registro)}" aria-label="Número de registro"></td>
                        <td><select name="perfil_id" aria-label="Usuario"><option value="">${f.usuario_anterior ? `${v(f.usuario_anterior)} (sin cuenta)` : '—'}</option>${estado.usuarios.map((u) => `<option value="${u.id}" ${u.id === f.perfil_id ? 'selected' : ''}>${esc(u.usuario || '')} ${esc(u.nombre)}</option>`).join('')}</select></td>
                        <td class="acciones"><button type="button" class="icono-editar" data-quitar-firmante="${i}" aria-label="Quitar firmante"><i class="ti ti-trash" aria-hidden="true"></i></button></td>
                      </tr>`).join('')}
                  </tbody>
                </table>
                ${editable ? '<button type="button" class="rp-enlace" data-accion="agregar-firmante"><i class="ti ti-plus" aria-hidden="true"></i> Agregar firmante</button>' : ''}`, 'pg-autoriza')}
              ${bloque('Otros', 'ti-dots', `<div class="pg-dos">${grupo('otros')}</div>`)}
            </div>
          </div>
        </form>`;
      // Solo lectura: se puede cambiar de localidad, pero no los valores.
      if (!editable) {
        cont.querySelectorAll('#f-parametros input, #f-parametros select, [data-quitar-firmante]').forEach((el) => {
          if (!el.matches('[data-org], [data-loc]')) el.disabled = true;
        });
      }
    }

    // Lee el formulario respetando los firmantes agregados o quitados en pantalla.
    function leer(form) {
      const d = {};
      const num = (n) => form.elements[n].value === '' ? null : Number(form.elements[n].value);
      const txt = (n) => form.elements[n].value.trim() || null;
      ['anio_actual', 'mes_actual', 'impuesto1', 'impuesto2', 'impuesto3', 'impuesto4', 'idp_super', 'idp_regular', 'idp_diesel',
        'valor_cheques_autorizacion', 'primer_mes_contable', 'ultimo_mes_contable'].forEach((n) => { d[n] = num(n); });
      ['proximo_cierre', 'ultimo_cierre', 'inicio_periodo_actual', 'fin_periodo_actual', 'inicio_periodo_fiscal', 'fin_periodo_fiscal',
        'moneda_integracion', 'moneda_ingreso', 'nit'].forEach((n) => { d[n] = txt(n); });
      Object.values(GRUPOS).flat().forEach(([n, , tipo]) => { if (form.elements[n]) d[n] = tipo === 'n' || tipo === 'i' ? num(n) : txt(n); });
      [1, 2, 3, 4].forEach((i) => { d['nombre_impuesto' + i] = (form.elements['nombre_impuesto' + i].value.trim() || ['IVA', 'ISR', 'OTRO', 'INGUAT'][i - 1]).toUpperCase(); });
      d.aplicar_iva = form.elements.aplicar_iva.checked;
      d.incluir_centros_costo = form.elements.incluir_centros_costo.checked;
      d.migracion_bancos = form.querySelector('[name=migracion_bancos]:checked').value;
      const firmantes = [...form.querySelectorAll('tr[data-fila]')].map((tr) => ({
        tipo: tr.querySelector('[name=tipo]').value,
        nombre: tr.querySelector('[name=nombre]').value.trim().toUpperCase() || null,
        cargo: tr.querySelector('[name=cargo]').value.trim().toUpperCase() || null,
        registro: tr.querySelector('[name=registro]').value.trim() || null,
        perfil_id: tr.querySelector('[name=perfil_id]').value || null,
        usuario_anterior: tr.dataset.anterior || null
      })).filter((f) => f.nombre || f.cargo || f.registro || f.perfil_id);
      return { d, firmantes };
    }

    // Conserva lo escrito en pantalla al agregar o quitar firmantes antes de guardar.
    function recordarFirmantes(form) {
      estado.firmantesEditados = true;
      estado.firmantes =[...form.querySelectorAll('tr[data-fila]')].map((tr) => ({
        tipo: tr.querySelector('[name=tipo]').value, nombre: tr.querySelector('[name=nombre]').value,
        cargo: tr.querySelector('[name=cargo]').value, registro: tr.querySelector('[name=registro]').value,
        perfil_id: tr.querySelector('[name=perfil_id]').value || null, usuario_anterior: tr.dataset.anterior || null
      }));
      const { d } = leer(form);
      estado.param = { ...(estado.param || {}), ...d };
    }

    async function guardar(form) {
      const error = form.querySelector('.modal-error');
      error.textContent = '';
      const { d, firmantes } = leer(form);
      for (const [ini, fin, nombre] of [['inicio_periodo_actual', 'fin_periodo_actual', 'actual'], ['inicio_periodo_fiscal', 'fin_periodo_fiscal', 'fiscal']]) {
        if (d[ini] && d[fin] && d[fin] < d[ini]) { error.textContent = `El fin del período ${nombre} no puede ser anterior a su inicio.`; return; }
      }
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      try {
        const existente = estado.param && estado.param.id;
        const r = existente
          ? await sb.from('parametros_generales').update(d).eq('id', estado.param.id).select('id').single()
          : await sb.from('parametros_generales').insert({ ...d, organizacion_id: estado.org, localidad_id: estado.loc }).select('id').single();
        if (r.error) throw r.error;
        const id = r.data.id;
        const borrar = await sb.from('parametros_firmantes').delete().eq('parametros_id', id);
        if (borrar.error) throw borrar.error;
        if (firmantes.length) {
          const ins = await sb.from('parametros_firmantes').insert(firmantes.map((f, i) => ({ ...f, parametros_id: id, orden: i + 1 })));
          if (ins.error) throw ins.error;
        }
        window.FIN.aviso('Parámetros guardados');
        await cargar();
      } catch (err) {
        error.textContent = window.UI.traducirError(err);
      } finally {
        boton.disabled = false;
      }
    }

    cont.addEventListener('submit', (e) => { e.preventDefault(); guardar(e.target); });
    cont.addEventListener('change', (e) => {
      if (e.target.matches('[data-org]')) {
        estado.org = Number(e.target.value);
        estado.loc = (estado.locs.find((x) => x.organizacion_id === estado.org) || {}).id;
        cargar();
      } else if (e.target.matches('[data-loc]')) {
        estado.loc = Number(e.target.value);
        cargar();
      }
    });
    cont.addEventListener('click', async (e) => {
      const form = cont.querySelector('#f-parametros');
      const q = e.target.closest('[data-quitar-firmante]');
      if (q) { recordarFirmantes(form); estado.firmantes.splice(Number(q.dataset.quitarFirmante), 1); return pintar(); }
      const a = e.target.closest('[data-accion]');
      if (!a) return;
      if (a.dataset.accion === 'agregar-firmante') { recordarFirmantes(form); estado.firmantes.push({ tipo: 'Otro' }); pintar(); }
      if (a.dataset.accion === 'param-actualizar') { await cargar(); window.FIN.aviso('Datos actualizados'); }
    });

    cargar();
  };
})();
