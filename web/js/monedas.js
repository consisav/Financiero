// Catálogos · Parámetros · Tipos de cambio (maestro - detalle).
// Maestro: monedas. Detalle: tipos de cambio de la moneda seleccionada, del más reciente al más
// antiguo, con la tasa de venta y la de compra expresadas en otra moneda ("cambio"), que por
// defecto es la moneda de integración de Parámetros generales. "Tasa cambio actual" graba en ese
// momento la compra y venta de todas las monedas con referencia de Banco Industrial (script 18).
(function () {
  const { esc, tabla, formulario, filtrar } = window.UI;

  const normal = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
  const valor = (n) => Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  const zona = { timeZone: 'America/Guatemala' };
  const fecha = (t) => new Date(t).toLocaleDateString('es-GT', { ...zona, day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  const hora = (t) => new Date(t).toLocaleTimeString('es-GT', { ...zona, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['monedas-y-tipos-de-cambio'] = async function (cont) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    const estado = { monedas: [], sel: null, tasas: [], buscar: '', integracion: null };

    cont.innerHTML = '<section class="panel" id="tc-monedas"></section><section class="panel" id="tc-tasas"></section>';
    const pMon = cont.querySelector('#tc-monedas');
    const pTas = cont.querySelector('#tc-tasas');
    const monedaDe = (id) => estado.monedas.find((m) => m.id === id) || {};

    // Moneda de integración de la localidad del usuario (Parámetros generales); si no hay, la código 1.
    async function monedaIntegracion() {
      const loc = (window.FIN.perfil() || {}).localidad_id;
      let nombre = null;
      if (loc) {
        const { data } = await sb.from('parametros_generales').select('moneda_integracion').eq('localidad_id', loc).maybeSingle();
        nombre = data && data.moneda_integracion;
      }
      return estado.monedas.find((m) => nombre && normal(m.nombre) === normal(nombre))
        || estado.monedas.find((m) => m.codigo === 1) || estado.monedas[0] || null;
    }

    async function cargar(seleccion) {
      const { data, error } = await sb.from('monedas').select('*').order('codigo');
      if (error) {
        cont.innerHTML = error.code === 'PGRST205' || /monedas/.test(error.message)
          ? '<p class="vacio">Falta instalar en Supabase el script <b>20261103000015_monedas_y_tipos_de_cambio.sql</b>. Ejecútalo en el SQL Editor y recarga esta página.</p>'
          : `<p class="vacio">${esc(error.message)}</p>`;
        return;
      }
      estado.monedas = data;
      estado.integracion = await monedaIntegracion();
      const previo = seleccion || (estado.sel && estado.sel.id);
      estado.sel = data.find((m) => m.id === previo) || data[0] || null;
      pintarMonedas();
      await cargarTasas();
    }

    async function cargarTasas() {
      if (!estado.sel) { estado.tasas = []; pintarTasas(); return; }
      const { data, error } = await sb.from('tipos_cambio').select('*').eq('moneda_id', estado.sel.id).order('fecha', { ascending: false });
      if (error) { pTas.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      estado.tasas = data;
      pintarTasas();
    }

    function pintarMonedas() {
      pMon.innerHTML = `
        <div class="panel-cab">
          <h2>Tipos de cambio monedas</h2>
          <div class="panel-acciones">
            ${estado.integracion ? `<span class="tc-integra" title="Moneda de integración de Parámetros generales"><i class="ti ti-coins" aria-hidden="true"></i> Integración: <b>${esc(estado.integracion.nombre)}</b></span>` : ''}
            ${editable ? '<button type="button" class="boton secundario-sm" data-accion="tasa-actual" title="Graba la compra y venta de este momento con referencia de Banco Industrial"><i class="ti ti-refresh" aria-hidden="true"></i> Tasa cambio actual</button>' : ''}
            ${editable ? '<button type="button" class="boton primario-sm" data-accion="nueva-moneda">+ Moneda</button>' : ''}
          </div>
        </div>
        <input type="search" class="buscar" data-buscar placeholder="Buscar moneda" value="${esc(estado.buscar)}">
        ${tabla({
          id: 'monedas', editable, seleccionado: estado.sel && estado.sel.id, vacio: 'Todavía no hay monedas.',
          columnas: [
            { titulo: 'Moneda', valor: (f) => f.codigo, clase: 'angosta' },
            { titulo: 'Nombre', valor: (f) => esc(f.nombre), clase: 'fuerte' },
            { titulo: 'Símbolo', valor: (f) => esc(f.simbolo), clase: 'centrada angosta' },
            { titulo: 'ISO', valor: (f) => esc(f.iso || ''), clase: 'angosta' },
            { titulo: 'Lugar geográfico', valor: (f) => esc(f.lugar_geografico || '') },
            { titulo: 'Estado', valor: (f) => window.UI.estado(f.activo) }
          ],
          filas: estado.monedas
        })}`;
      filtrar(pMon, estado.buscar);
    }

    function pintarTasas() {
      const m = estado.sel;
      if (!m) { pTas.innerHTML = ''; return; }
      const cambio = (id) => { const x = monedaDe(id); return `<span title="${esc(x.nombre || '')}">${x.codigo ?? ''} ${esc(x.simbolo || '')}</span>`; };
      pTas.innerHTML = `
        <div class="panel-cab">
          <h2>Tipos de cambio <small>de ${esc(m.nombre)} (${esc(m.simbolo)})</small></h2>
          <div class="panel-acciones">${editable ? '<button type="button" class="boton primario-sm" data-accion="nueva-tasa">+ Tipo de cambio</button>' : ''}</div>
        </div>
        <div class="tabla-desplazable">
          <table class="tabla tc-tabla">
            <thead>
              <tr class="tc-grupos"><th colspan="3">Parámetros</th><th colspan="2">Tasa venta</th><th colspan="2">Tasa compra</th>${editable ? '<th class="acciones" rowspan="2"></th>' : ''}</tr>
              <tr><th>Fecha</th><th>Hora</th><th>Usuario</th><th class="tc-ini">Cambio</th><th class="num">Valor</th><th class="tc-ini">Cambio</th><th class="num">Valor</th></tr>
            </thead>
            <tbody>
              ${estado.tasas.length ? estado.tasas.map((t, i) => `
                <tr class="${i === 0 ? 'tc-vigente' : ''}">
                  <td>${fecha(t.fecha)}</td><td>${hora(t.fecha)}</td><td>${esc(t.usuario || '')}</td>
                  <td class="tc-ini">${cambio(t.moneda_venta_id)}</td><td class="num">${valor(t.valor_venta)}</td>
                  <td class="tc-ini">${cambio(t.moneda_compra_id)}</td><td class="num">${valor(t.valor_compra)}</td>
                  ${editable ? `<td class="acciones"><button type="button" class="icono-editar" data-editar-tasa="${t.id}" aria-label="Modificar tipo de cambio"><i class="ti ti-pencil" aria-hidden="true"></i></button></td>` : ''}
                </tr>`).join('') : `<tr><td colspan="8" class="vacio">${esc(m.nombre)} todavía no tiene tipos de cambio.</td></tr>`}
            </tbody>
          </table>
        </div>`;
    }

    function formMoneda(fila) {
      formulario({
        titulo: fila ? `Modificar moneda · ${fila.nombre}` : 'Nueva moneda',
        valores: fila || { codigo: Math.max(0, ...estado.monedas.map((x) => x.codigo)) + 1, activo: true },
        campos: [
          { nombre: 'codigo', etiqueta: 'Moneda', tipo: 'numero', requerido: true },
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
          { nombre: 'simbolo', etiqueta: 'Símbolo', requerido: true, max: 5 },
          { nombre: 'iso', etiqueta: 'Código ISO (GTQ, USD, EUR…)', max: 3, patron: '[A-Za-z]{3}' },
          { nombre: 'lugar_geografico', etiqueta: 'Lugar geográfico' },
          { nombre: 'activo', etiqueta: 'Activa', tipo: 'casilla' }
        ],
        alGuardar: async (d) => {
          d.nombre = d.nombre.toUpperCase();
          if (d.lugar_geografico) d.lugar_geografico = d.lugar_geografico.toUpperCase();
          d.iso = d.iso ? d.iso.toUpperCase() : null;
          const r = fila ? await sb.from('monedas').update(d).eq('id', fila.id).select('id').single()
                         : await sb.from('monedas').insert(d).select('id').single();
          if (r.error) {
            if (/duplicate|unique/i.test(r.error.message)) throw new Error('Ya existe una moneda con ese código o nombre.');
            throw r.error;
          }
          window.FIN.aviso('Moneda guardada');
          await cargar(r.data.id);
        }
      });
    }

    function formTasa(fila) {
      const m = estado.sel;
      const opciones = estado.monedas.filter((x) => x.activo || (fila && [fila.moneda_venta_id, fila.moneda_compra_id].includes(x.id)))
        .map((x) => ({ valor: x.id, texto: `${x.codigo} · ${x.nombre} (${x.simbolo})` }));
      const base = estado.integracion && estado.integracion.id;
      const ultimo = estado.tasas[0];
      formulario({
        titulo: fila ? `Modificar tipo de cambio · ${m.nombre} del ${fecha(fila.fecha)}` : `Nuevo tipo de cambio · ${m.nombre}`,
        valores: fila || {
          moneda_venta_id: base, moneda_compra_id: base,
          valor_venta: ultimo ? Number(ultimo.valor_venta) : null, valor_compra: ultimo ? Number(ultimo.valor_compra) : null
        },
        campos: [
          { nombre: 'moneda_venta_id', etiqueta: 'Tasa venta · cambio', tipo: 'select-numero', opciones, requerido: true },
          { nombre: 'valor_venta', etiqueta: 'Tasa venta · valor', tipo: 'numero', paso: 'any', requerido: true },
          { nombre: 'moneda_compra_id', etiqueta: 'Tasa compra · cambio', tipo: 'select-numero', opciones, requerido: true },
          { nombre: 'valor_compra', etiqueta: 'Tasa compra · valor', tipo: 'numero', paso: 'any', requerido: true }
        ],
        alGuardar: async (d) => {
          if (!(d.valor_venta > 0) || !(d.valor_compra > 0)) throw new Error('Los valores de venta y compra deben ser mayores que cero.');
          if (!fila) d.moneda_id = m.id;
          const r = fila ? await sb.from('tipos_cambio').update(d).eq('id', fila.id) : await sb.from('tipos_cambio').insert(d);
          if (r.error) throw r.error;
          window.FIN.aviso('Tipo de cambio guardado');
          await cargarTasas();
        }
      });
    }

    // Compra y venta de este momento con referencia de Banco Industrial, para todas las monedas.
    async function tasaActual(boton) {
      boton.disabled = true;
      const texto = boton.innerHTML;
      boton.innerHTML = '<i class="ti ti-loader-2" aria-hidden="true"></i> Consultando Banco Industrial…';
      const { data, error } = await sb.rpc('actualizar_tasas_banco_industrial');
      boton.disabled = false;
      boton.innerHTML = texto;
      if (error) {
        window.FIN.aviso(/actualizar_tasas_banco_industrial|schema cache/.test(error.message)
          ? 'Falta instalar en Supabase el script 20261103000018_tasa_cambio_actual_banco_industrial.sql.'
          : window.UI.traducirError(error));
        return;
      }
      const usd = (data.monedas || []).find((x) => x.iso === 'USD');
      window.FIN.aviso(`Tipos de cambio actualizados (${(data.monedas || []).length} monedas)${usd ? ` · Dólar: compra Q${usd.compra} · venta Q${usd.venta}` : ''}`);
      await cargarTasas();
    }

    cont.addEventListener('click', (e) => {
      const a = e.target.closest('[data-accion]');
      if (a && a.dataset.accion === 'tasa-actual') return tasaActual(a);
      if (a && a.dataset.accion === 'nueva-moneda') return formMoneda();
      if (a && a.dataset.accion === 'nueva-tasa') return formTasa();
      const et = e.target.closest('[data-editar-tasa]');
      if (et) return formTasa(estado.tasas.find((t) => String(t.id) === et.dataset.editarTasa));
      const ed = e.target.closest('[data-editar]');
      if (ed) return formMoneda(estado.monedas.find((x) => String(x.id) === ed.dataset.editar));
      const fila = e.target.closest('[data-tabla="monedas"] tr[data-id]');
      if (fila && (!estado.sel || String(estado.sel.id) !== fila.dataset.id)) {
        estado.sel = estado.monedas.find((x) => String(x.id) === fila.dataset.id);
        pMon.querySelectorAll('tr[data-id]').forEach((tr) => tr.classList.toggle('seleccionada', tr === fila));
        cargarTasas();
      }
    });
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-tabla="monedas"] tr[data-id]')) e.target.click();
    });
    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-buscar]')) return;
      estado.buscar = e.target.value;
      filtrar(pMon, estado.buscar);
    });

    cargar();
  };
})();
