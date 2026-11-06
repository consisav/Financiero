// Compras · Catálogos · Generales · Parámetros módulo (script 101, diseño A): parámetros del módulo de
// compras de la empresa conectada, en tres bloques: encargados (compras, pedidos y facturación, cada uno
// con su usuario del sistema), inventario y ventas (quién recibe los traslados y la transacción principal
// de ventas) y avisos por correo (orden cotizada y orden autorizada). Una fila por empresa.
(function () {
  const { esc } = window.UI;
  const ENCARGADOS = [
    { k: 'compras', t: 'Compras', ayuda: 'Responsable de las compras y de firmar las órdenes.' },
    { k: 'pedidos', t: 'Pedidos', ayuda: 'Responsable de las solicitudes y pedidos.' },
    { k: 'facturacion', t: 'Facturación', ayuda: 'Responsable de recibir y registrar las facturas.' }
  ];
  const CAMPOS = ['encargado_compras', 'usuario_compras_id', 'encargado_pedidos', 'usuario_pedidos_id', 'encargado_facturacion', 'usuario_facturacion_id',
    'recibe_traslados', 'transaccion_ventas_id', 'avisos_cotizado', 'avisos_autorizado'];
  const correoValido = (c) => /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(c);

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['parametros-compras'] = async function (cont) {
    const sb = window.FIN.sb;
    const yo = window.FIN.perfil();
    const ed = window.FIN.puedeEditarCatalogos();
    cont.innerHTML = '<section class="panel pcm"><p class="vacio">Cargando…</p></section>';
    const panel = cont.querySelector('.pcm');
    if (!yo.localidad_id) { panel.innerHTML = '<p class="vacio">Conéctate a una empresa para ver sus parámetros.</p>'; return; }

    const [l, p, u, t] = await Promise.all([
      sb.from('localidades').select('id, codigo, nombre_comercial, organizacion_id, organizaciones(codigo, nombre)').eq('id', yo.localidad_id).maybeSingle(),
      sb.from('parametros_compras').select('*').eq('localidad_id', yo.localidad_id).maybeSingle(),
      sb.from('perfiles').select('id, usuario, nombre, activo').eq('organizacion_id', yo.organizacion_id).order('usuario', { nullsFirst: false }),
      sb.from('transacciones_contables').select('id, numero, descripcion, modulo, estado').eq('localidad_id', yo.localidad_id).order('numero')
    ]);
    if (p.error) {
      panel.innerHTML = `<p class="vacio">${/parametros_compras|schema cache|does not exist/.test(p.error.message) ? 'Falta instalar en Supabase el script <b>20261106000101_compras_generales_parametros.sql</b>.' : esc(p.error.message)}</p>`;
      return;
    }
    const emp = l.data;
    const usuarios = (u.data || []).filter((x) => x.activo !== false);
    const transacciones = (t.data || []).filter((x) => x.estado !== 'INACTIVO');
    let guardado = p.data || null;
    const vacio = Object.fromEntries(CAMPOS.map((k) => [k, null]));
    let datos = { ...vacio, ...(guardado || {}) };

    const valorDe = (k) => datos[k] ?? '';
    const cambios = () => CAMPOS.some((k) => String(valorDe(k)) !== String((guardado || vacio)[k] ?? ''));
    const opcUsuarios = (sel) => '<option value="">— Sin usuario —</option>' + usuarios.map((x) =>
      `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.usuario || '—')} · ${esc(x.nombre || '')}</option>`).join('');
    // Ventas primero, luego las demás transacciones de la empresa.
    const esVentas = (x) => /VENT|FAC/i.test(`${x.modulo || ''}`);
    const opcTransacciones = (sel) => {
      const fila = (x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${x.numero} · ${esc(x.descripcion)}</option>`;
      const v = transacciones.filter(esVentas), o = transacciones.filter((x) => !esVentas(x));
      return '<option value="">— Sin transacción —</option>'
        + (v.length ? `<optgroup label="Ventas">${v.map(fila).join('')}</optgroup>` : '')
        + (o.length ? `<optgroup label="${v.length ? 'Otras transacciones' : 'Transacciones de la empresa'}">${o.map(fila).join('')}</optgroup>` : '');
    };
    const dis = ed ? '' : 'disabled';

    function pintar() {
      const quien = guardado?.modificado_por_nombre || guardado?.creado_por_nombre;
      const cuando = guardado?.modificado_en || guardado?.creado_en;
      panel.innerHTML = `
        <header class="pcm-cab">
          <span class="tk-icono"><i class="ti ti-adjustments" aria-hidden="true"></i></span>
          <div class="pcm-titulo">
            <small>Compras · Catálogos · Generales</small>
            <h2>Parámetros del módulo de compras</h2>
          </div>
          <div class="pcm-empresa"><span>Empresa</span><b>${esc(emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '—')}</b>
            <small>${esc(emp?.organizaciones ? `${emp.organizaciones.codigo} · ${emp.organizaciones.nombre}` : '')}</small></div>
          <div class="pcm-acciones">
            <span class="pcm-estado ${cambios() ? 'pendientes' : ''}">${cambios() ? 'Cambios sin guardar' : guardado ? `Guardado${quien ? ` por ${esc(quien)}` : ''}${cuando ? ` · ${window.UI.fecha(cuando).slice(0, 10)}` : ''}` : 'Sin parámetros todavía'}</span>
            ${ed ? `<button type="button" class="boton secundario-sm" data-accion="descartar" ${cambios() ? '' : 'disabled'}>Descartar</button>
              <button type="button" class="boton primario-sm" data-accion="guardar" ${cambios() ? '' : 'disabled'}><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button>` : ''}
          </div>
        </header>
        <p class="modal-error pcm-error" role="alert"></p>
        <div class="pcm-bloques">
          <section class="pcm-bloque">
            <h3><i class="ti ti-user-check" aria-hidden="true"></i> Encargados</h3>
            <p class="pcm-ayuda">Nombre que aparece en los documentos y el usuario del sistema responsable.</p>
            ${ENCARGADOS.map((e) => `
              <div class="pcm-encargado">
                <span class="pcm-etq">${e.t}</span>
                <label class="campo"><span>Encargado de ${e.t.toLowerCase()}</span>
                  <input type="text" data-k="encargado_${e.k}" value="${esc(valorDe(`encargado_${e.k}`))}" maxlength="80" placeholder="Nombre del encargado" ${dis}></label>
                <label class="campo"><span>Usuario</span>
                  <select data-k="usuario_${e.k}_id" ${dis}>${opcUsuarios(datos[`usuario_${e.k}_id`])}</select></label>
                <small>${e.ayuda}</small>
              </div>`).join('')}
          </section>
          <section class="pcm-bloque">
            <h3><i class="ti ti-arrows-exchange" aria-hidden="true"></i> Inventario y ventas</h3>
            <p class="pcm-ayuda">Datos que usan los traslados entre bodegas y la facturación de lo comprado.</p>
            <label class="campo"><span>Recibe traslados</span>
              <input type="text" data-k="recibe_traslados" value="${esc(valorDe('recibe_traslados'))}" maxlength="80" placeholder="Nombre de quien recibe" ${dis}></label>
            <label class="campo"><span>Transacción principal de ventas</span>
              <select data-k="transaccion_ventas_id" ${dis}>${opcTransacciones(datos.transaccion_ventas_id)}</select></label>
            <p class="pcm-nota">${transacciones.length ? `${transacciones.length} transacciones contables de la empresa.` : 'La empresa aún no tiene transacciones contables (Contabilidad › Catálogos › Objetos contables).'}</p>
          </section>
          <section class="pcm-bloque">
            <h3><i class="ti ti-mail" aria-hidden="true"></i> Avisos por correo</h3>
            <p class="pcm-ayuda">A quién se avisa cuando una orden de compra cambia de estado. Varios correos, separados por coma.</p>
            <label class="campo"><span>Orden cotizada</span>
              <textarea data-k="avisos_cotizado" rows="3" placeholder="compras@empresa.com, gerencia@empresa.com" ${dis}>${esc(valorDe('avisos_cotizado'))}</textarea></label>
            <label class="campo"><span>Orden autorizada</span>
              <textarea data-k="avisos_autorizado" rows="3" placeholder="bodega@empresa.com" ${dis}>${esc(valorDe('avisos_autorizado'))}</textarea></label>
          </section>
        </div>`;
    }

    const estadoBotones = () => {
      const c = cambios();
      panel.querySelectorAll('[data-accion=guardar], [data-accion=descartar]').forEach((b) => { b.disabled = !c; });
      const e = panel.querySelector('.pcm-estado');
      if (e && c) { e.textContent = 'Cambios sin guardar'; e.classList.add('pendientes'); }
    };

    panel.addEventListener('input', (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      datos[k] = e.target.value === '' ? null : k === 'transaccion_ventas_id' ? Number(e.target.value) : e.target.value;
      // Al elegir el usuario, si el encargado está vacío se llena con su nombre.
      const m = k.match(/^usuario_(\w+)_id$/);
      if (m && e.target.value && !datos[`encargado_${m[1]}`]) {
        const x = usuarios.find((y) => y.id === e.target.value);
        if (x) { datos[`encargado_${m[1]}`] = (x.nombre || '').toUpperCase(); panel.querySelector(`[data-k=encargado_${m[1]}]`).value = datos[`encargado_${m[1]}`]; }
      }
      estadoBotones();
    });
    panel.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-accion]');
      if (!a) return;
      if (a.dataset.accion === 'descartar') { datos = { ...vacio, ...(guardado || {}) }; pintar(); return; }
      if (a.dataset.accion !== 'guardar') return;
      const err = panel.querySelector('.pcm-error');
      const malos = ['avisos_cotizado', 'avisos_autorizado'].flatMap((k) => String(datos[k] || '').split(/[,;\s]+/).filter(Boolean).filter((c) => !correoValido(c)));
      if (malos.length) { err.textContent = `Revisa estos correos: ${malos.join(', ')}.`; return; }
      err.textContent = '';
      a.disabled = true;
      const fila = { localidad_id: yo.localidad_id, organizacion_id: yo.organizacion_id, ...Object.fromEntries(CAMPOS.map((k) => [k, datos[k] === '' ? null : datos[k]])) };
      ['avisos_cotizado', 'avisos_autorizado'].forEach((k) => { if (fila[k]) fila[k] = fila[k].split(/[,;\s]+/).filter(Boolean).join(', '); });
      const res = guardado
        ? await sb.from('parametros_compras').update(fila).eq('id', guardado.id).select().single()
        : await sb.from('parametros_compras').insert(fila).select().single();
      if (res.error) { a.disabled = false; err.textContent = window.UI.traducirError(res.error); return; }
      guardado = res.data;
      datos = { ...vacio, ...guardado };
      pintar();
      window.FIN.aviso('Parámetros guardados');
    });

    pintar();
  };
})();
