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

  const v = (x) => (x === null || x === undefined ? '' : esc(x));
  const fecha = (n, p, et) => `<label class="campo-linea"><span>${et}</span><input type="date" name="${n}" value="${v(p[n])}"></label>`;
  const numero = (n, p, et, paso = '0.01') => `<label class="campo-linea"><span>${et}</span><input type="number" step="${paso}" min="0" name="${n}" value="${v(p[n])}"></label>`;
  const texto = (n, p, et, extra = '') => `<label class="campo-linea"><span>${et}</span><input type="text" name="${n}" value="${v(p[n])}" ${extra}></label>`;
  const mes = (n, p, et) => `<label class="campo-linea"><span>${et}</span><select name="${n}">${MESES.map((m, i) => `<option value="${i + 1}" ${p[n] === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>`;
  const casilla = (n, p, et) => `<label class="casilla-linea"><input type="checkbox" name="${n}" ${p[n] ? 'checked' : ''}> ${et}</label>`;

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS.parametros = async function (cont, m) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    const estado = { orgs: [], locs: [], org: null, loc: null, param: null, firmantes: [], usuarios: [], version: null, pestana: 'autorizaciones' };

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
      cont.innerHTML = `<p class="vacio">Los parámetros son por localidad: primero crea una en <a href="#/${m.id}/organizaciones">Catálogos · Organizaciones</a>.</p>`;
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
      cont.innerHTML = `
        <form id="f-parametros" class="parametros">
          <section class="panel cabecera-param">
            <div class="panel-cab">
              <h2>Parámetros</h2>
              <div class="panel-acciones">
                <label class="selector-org">Organización <select data-org>${estado.orgs.map((x) => `<option value="${x.id}" ${x.id === estado.org ? 'selected' : ''}>${x.codigo} · ${esc(x.nombre)}</option>`).join('')}</select></label>
                <label class="selector-org">Localidad <select data-loc>${locsOrg.map((x) => `<option value="${x.id}" ${x.id === estado.loc ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre_comercial)}</option>`).join('')}</select></label>
              </div>
            </div>
            ${estado.param && estado.param.id
              ? window.UI.auditoria({ ...estado.param, activo: true }, false, 'param')
              :`<p class="aviso-param"><i class="ti ti-info-circle" aria-hidden="true"></i> Esta localidad todavía no tiene parámetros. Se muestran valores sugeridos${editable ? '; revísalos y pulsa Guardar cambios' : ''}.</p>`}
          </section>

          <div class="param-grid">
            <section class="panel">
              <div class="panel-cab"><h2>Parámetros de tiempo</h2></div>
              ${numero('anio_actual', p, 'Año actual', '1')}
              ${mes('mes_actual', p, 'Mes actual')}
              ${fecha('proximo_cierre', p, 'Próximo cierre')}
              ${fecha('ultimo_cierre', p, 'Último cierre')}
              ${fecha('inicio_periodo_actual', p, 'Inicio período actual')}
              ${fecha('fin_periodo_actual', p, 'Fin período actual')}
              ${fecha('inicio_periodo_fiscal', p, 'Inicio período fiscal')}
              ${fecha('fin_periodo_fiscal', p, 'Fin período fiscal')}
            </section>

            <div class="param-columna">
              <section class="panel">
                <div class="panel-cab"><h2>Parámetros de uso de pantallas</h2></div>
                <div class="uso-pantallas">
                  <div>
                    ${casilla('aplicar_iva', p, 'Aplicar IVA')}
                    ${casilla('incluir_centros_costo', p, 'Incluir centros de costo')}
                  </div>
                  <fieldset class="radios">
                    <legend>Modo de migración de estados de cuenta de bancos</legend>
                    <label><input type="radio" name="migracion_bancos" value="MANUAL" ${p.migracion_bancos !== 'AUTOMATICA' ? 'checked' : ''}> Manual</label>
                    <label><input type="radio" name="migracion_bancos" value="AUTOMATICA" ${p.migracion_bancos === 'AUTOMATICA' ? 'checked' : ''}> Automática</label>
                  </fieldset>
                </div>
              </section>
              <div class="param-dos">
                <section class="panel">
                  <div class="panel-cab"><h2>Impuestos básicos (%)</h2></div>
                  ${[1, 2, 3, 4].map((i) => `
                    <div class="impuesto">
                      <span>Impuesto ${i}</span>
                      <input type="number" step="0.01" min="0" name="impuesto${i}" value="${v(p['impuesto' + i])}" aria-label="Porcentaje impuesto ${i}">
                      <input type="text" name="nombre_impuesto${i}" value="${v(p['nombre_impuesto' + i])}" aria-label="Nombre impuesto ${i}">
                    </div>`).join('')}
                </section>
                <section class="panel">
                  <div class="panel-cab"><h2>Impuestos combustible · IDP</h2></div>
                  ${numero('idp_super', p, 'Súper')}
                  ${numero('idp_regular', p, 'Regular')}
                  ${numero('idp_diesel', p, 'Diésel')}
                </section>
              </div>
            </div>
          </div>

          <section class="panel">
            <div class="param-otros">
              ${numero('valor_cheques_autorizacion', p, 'Valor de cheques para solicitar autorización')}
              ${texto('moneda_integracion', p, 'Moneda integración')}
              ${texto('moneda_ingreso', p, 'Moneda ingreso información')}
              ${texto('nit', p, 'NIT', 'placeholder="8136624-8"')}
              ${mes('primer_mes_contable', p, 'Primer mes contable')}
              ${mes('ultimo_mes_contable', p, 'Último mes contable')}
              <label class="campo-linea"><span>Versión actual nomenclatura</span><input type="text" value="${estado.version || '—'}" readonly tabindex="-1"></label>
            </div>
          </section>

          <section class="panel">
            <div class="pestanas" role="tablist">
              <button type="button" role="tab" class="pestana ${estado.pestana === 'autorizaciones' ? 'activa' : ''}" data-pestana="autorizaciones" aria-selected="${estado.pestana === 'autorizaciones'}">Autorizaciones</button>
              <button type="button" role="tab" class="pestana ${estado.pestana === 'cuentas' ? 'activa' : ''}" data-pestana="cuentas" aria-selected="${estado.pestana === 'cuentas'}">Cuentas estados financieros</button>
            </div>
            <div ${estado.pestana === 'autorizaciones' ? '' : 'hidden'}>
              <div class="tabla-desplazable">
                <table class="tabla firmantes">
                  <thead><tr><th>Firma como</th><th>Personas que firman</th><th>Cargo</th><th># Registro</th><th>Usuario</th><th></th></tr></thead>
                  <tbody>
                    ${firmantes.map((f, i) => `
                      <tr data-fila="${i}">
                        <td><select name="tipo">${TIPOS_FIRMA.map((t) => `<option ${t === f.tipo ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
                        <td><input type="text" name="nombre" value="${v(f.nombre)}" aria-label="Nombre"></td>
                        <td><input type="text" name="cargo" value="${v(f.cargo)}" aria-label="Cargo"></td>
                        <td><input type="text" name="registro" value="${v(f.registro)}" aria-label="Número de registro"></td>
                        <td><select name="perfil_id" aria-label="Usuario"><option value="">—</option>${estado.usuarios.map((u) => `<option value="${u.id}" ${u.id === f.perfil_id ? 'selected' : ''}>${esc(u.usuario || '')} ${esc(u.nombre)}</option>`).join('')}</select></td>
                        <td class="acciones"><button type="button" class="icono-editar" data-quitar-firmante="${i}" aria-label="Quitar firmante"><i class="ti ti-trash" aria-hidden="true"></i></button></td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>
              ${editable ? '<button type="button" class="boton secundario-sm agregar-firmante" data-accion="agregar-firmante">+ Firmante</button>' : ''}
            </div>
            <div ${estado.pestana === 'cuentas' ? '' : 'hidden'}>
              <p class="vacio">Aquí se asignarán las cuentas contables que alimentan el balance general y el estado de resultados (utilidad del ejercicio, capital, etc.), cuando se definan.</p>
            </div>
          </section>

          ${editable ? `
            <div class="barra-guardar">
              <p class="modal-error" role="alert"></p>
              <button type="submit" class="boton primario-sm">Guardar cambios</button>
            </div>` : ''}
        </form>`;
      // Solo lectura: se puede cambiar de localidad y de pestaña, pero no los valores.
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
      [1, 2, 3, 4].forEach((i) => { d['nombre_impuesto' + i] = (form.elements['nombre_impuesto' + i].value.trim() || ['IVA', 'ISR', 'OTRO', 'INGUAT'][i - 1]).toUpperCase(); });
      d.aplicar_iva = form.elements.aplicar_iva.checked;
      d.incluir_centros_costo = form.elements.incluir_centros_costo.checked;
      d.migracion_bancos = form.querySelector('[name=migracion_bancos]:checked').value;
      const firmantes = [...form.querySelectorAll('tr[data-fila]')].map((tr) => ({
        tipo: tr.querySelector('[name=tipo]').value,
        nombre: tr.querySelector('[name=nombre]').value.trim().toUpperCase() || null,
        cargo: tr.querySelector('[name=cargo]').value.trim().toUpperCase() || null,
        registro: tr.querySelector('[name=registro]').value.trim() || null,
        perfil_id: tr.querySelector('[name=perfil_id]').value || null
      })).filter((f) => f.nombre || f.cargo || f.registro || f.perfil_id);
      return { d, firmantes };
    }

    // Conserva lo escrito en pantalla al agregar o quitar firmantes antes de guardar.
    function recordarFirmantes(form) {
      estado.firmantesEditados = true;
      estado.firmantes =[...form.querySelectorAll('tr[data-fila]')].map((tr) => ({
        tipo: tr.querySelector('[name=tipo]').value, nombre: tr.querySelector('[name=nombre]').value,
        cargo: tr.querySelector('[name=cargo]').value, registro: tr.querySelector('[name=registro]').value,
        perfil_id: tr.querySelector('[name=perfil_id]').value || null
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
      const pes = e.target.closest('[data-pestana]');
      if (pes) { recordarFirmantes(form); estado.pestana = pes.dataset.pestana; return pintar(); }
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
