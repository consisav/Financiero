// Catálogos · Parámetros · Tipos de cambio (maestro - detalle).
// Maestro: monedas. Detalle: tipos de cambio de la moneda seleccionada, del más reciente al más
// antiguo, con la tasa de venta y la de compra expresadas en otra moneda ("cambio"), que por
// defecto es la moneda de integración de Parámetros generales. "Tasa cambio actual" graba en ese
// momento la compra y venta de todas las monedas con referencia de Banco Industrial (script 18).
// Actualización automática (script 111): frecuencia diaria, semanal o mensual, día de la semana (y semana del
// mes) y hora, como el backup programado. La hace el servidor (pg_cron) aunque nadie esté conectado; el resultado
// de cada actualización (exitoso, o el error con su detalle) se ve en el bloque y en su historial.
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

    cont.innerHTML = '<section class="panel" id="tc-monedas"></section><section class="panel tc-prog" id="tc-prog"></section><section class="panel" id="tc-tasas"></section>';
    const pProg = cont.querySelector('#tc-prog');
    let programacion = null;   // tasas_programacion (undefined = falta el script 111)
    let ejecuciones = [];
    const prog = {};           // cambios aún sin guardar
    const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const SEMANAS = [[1, 'Primer'], [2, 'Segundo'], [3, 'Tercer'], [4, 'Cuarto'], [5, 'Último']];
    const fh = (t) => t ? `${fecha(t)} ${hora(t)}` : '—';

    async function cargarProgramacion() {
      const [p, e] = await Promise.all([
        sb.from('tasas_programacion').select('*').eq('id', 1).maybeSingle(),
        sb.from('tasas_ejecuciones').select('*').order('inicio', { ascending: false }).limit(8)
      ]);
      programacion = p.error ? undefined : p.data || null;
      ejecuciones = e.error ? [] : e.data || [];
      pintarProgramacion();
    }

    function pintarProgramacion() {
      if (programacion === undefined) { pProg.innerHTML = '<p class="vacio">Para la actualización automática falta instalar en Supabase el script <b>20261106000111_tasas_cambio_programadas.sql</b>.</p>'; return; }
      const p = { activo: false, frecuencia: 'DIARIA', dia_semana: 1, semana_mes: 1, hora: '07:00', ...(programacion || {}), ...prog };
      const dis = editable ? '' : 'disabled';
      const res = (estado, detalle) => estado === 'ERROR'
        ? `<details class="bu-det"><summary><span class="pc-marca anulada">Error</span> <small class="bu-error">ver detalle</small></summary><pre>${esc(detalle || '')}</pre></details>`
        : estado ? `<span class="pc-marca aprobada">Exitoso</span>` : '';
      pProg.innerHTML = `
        <div class="tcp-fila">
          <h2 class="tcp-tit" title="La hace el servidor (Supabase) a la hora indicada, aunque nadie esté conectado: graba la compra y venta de todas las monedas con referencia de Banco Industrial, igual que «Tasa cambio actual»."><i class="ti ti-calendar-time" aria-hidden="true"></i> Actualización automática</h2>
          <label class="pc-check tcp-activo"><input type="checkbox" name="p_activo" ${p.activo ? 'checked' : ''} ${dis}> ${p.activo ? 'Activa' : 'Inactiva'}</label>
          <div class="bu-frecuencia tcp-frec" role="radiogroup" aria-label="Frecuencia">${['DIARIA', 'SEMANAL', 'MENSUAL'].map((f) => `<label class="${p.frecuencia === f ? 'marcada' : ''}"><input type="radio" name="p_frecuencia" value="${f}" ${p.frecuencia === f ? 'checked' : ''} ${dis}> ${f.charAt(0) + f.slice(1).toLowerCase()}</label>`).join('')}</div>
          ${p.frecuencia === 'MENSUAL' ? `<label class="campo"><span>Semana del mes</span><select name="p_semana" ${dis}>${SEMANAS.map(([v, t]) => `<option value="${v}" ${Number(p.semana_mes) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
          ${p.frecuencia !== 'DIARIA' ? `<label class="campo"><span>Día de la semana</span><select name="p_dia" ${dis}>${DIAS.map((d, i) => `<option value="${i + 1}" ${Number(p.dia_semana) === i + 1 ? 'selected' : ''}>${d}</option>`).join('')}</select></label>` : ''}
          <label class="campo"><span>Hora de ejecución</span><input type="time" name="p_hora" value="${esc(String(p.hora || '07:00').slice(0, 5))}" ${dis}></label>
          <div class="bm-dato"><dt>Próxima</dt><dd><b>${programacion?.activo && programacion?.proximo ? esc(fh(programacion.proximo)) : '—'}</b></dd></div>
          <div class="bm-dato"><dt>Última</dt><dd><b>${esc(fh(programacion?.ultimo))}</b> ${res(programacion?.ultimo_estado, programacion?.ultimo_detalle)}</dd></div>
          ${editable ? `<div class="tcp-acc"><button type="button" class="boton primario-sm" data-guardar-prog><i class="ti ti-calendar-check" aria-hidden="true"></i> Guardar</button>
            <button type="button" class="boton secundario-sm" data-probar title="Actualiza ahora en el servidor para comprobar que funciona"><i class="ti ti-player-play" aria-hidden="true"></i> Probar ahora</button></div>` : ''}
        </div>
        ${ejecuciones.length ? `<details class="tcp-hist"><summary><i class="ti ti-history" aria-hidden="true"></i> Resultado de las últimas actualizaciones automáticas (${ejecuciones.length})</summary>
          <div class="pc-lineas"><table><thead><tr><th>Fecha y hora</th><th>Origen</th><th>Usuario</th><th>Resultado</th><th>Detalle</th></tr></thead>
            <tbody>${ejecuciones.map((x) => `<tr class="${x.estado === 'ERROR' ? 'bu-fila-error' : ''}"><td>${esc(fh(x.inicio))}</td><td>${x.origen === 'PRUEBA' ? 'Prueba' : '<span class="pc-tipo">Automático</span>'}</td><td>${esc(x.usuario || '')}</td><td>${res(x.estado, '')}</td><td class="tcp-det">${esc(x.detalle || '')}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
`;
    }
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
      await Promise.all([cargarTasas(), cargarProgramacion()]);
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

    cont.addEventListener('change', (e) => {
      if (!pProg.contains(e.target)) return;
      const n = e.target.name;
      if (n === 'p_activo') { prog.activo = e.target.checked; return pintarProgramacion(); }
      if (n === 'p_frecuencia') { prog.frecuencia = e.target.value; return pintarProgramacion(); }
      if (n === 'p_dia') prog.dia_semana = Number(e.target.value);
      if (n === 'p_semana') prog.semana_mes = Number(e.target.value);
      if (n === 'p_hora') prog.hora = e.target.value;
    });
    cont.addEventListener('click', async (e) => {
      if (e.target.closest('[data-guardar-prog]')) {
        const p = { activo: false, frecuencia: 'DIARIA', dia_semana: 1, semana_mes: 1, hora: '07:00', ...(programacion || {}), ...prog };
        if (!p.hora) return window.FIN.aviso('Indica la hora de la actualización automática');
        const { error } = await sb.from('tasas_programacion').update({ activo: !!p.activo, frecuencia: p.frecuencia, dia_semana: p.frecuencia === 'DIARIA' ? null : Number(p.dia_semana),
          semana_mes: p.frecuencia === 'MENSUAL' ? Number(p.semana_mes || 1) : null, hora: p.hora }).eq('id', 1);
        if (error) return window.FIN.aviso(window.UI.traducirError(error));
        Object.keys(prog).forEach((k) => delete prog[k]);
        await cargarProgramacion();
        window.FIN.aviso(programacion?.activo ? `Actualización automática programada · próxima ${fh(programacion.proximo)}` : 'Actualización automática desactivada');
        return;
      }
      if (e.target.closest('[data-probar]')) {
        const b = e.target.closest('[data-probar]'); b.disabled = true; b.innerHTML = '<i class="ti ti-loader-2" aria-hidden="true"></i> Consultando Banco Industrial…';
        const { data, error } = await sb.rpc('probar_tasas_programado');
        if (error) { window.FIN.aviso(window.UI.traducirError(error)); await cargarProgramacion(); return; }
        await Promise.all([cargarProgramacion(), cargarTasas()]);
        window.FIN.aviso(data === 'EXITOSO' ? 'Actualización de prueba: exitosa' : 'La actualización de prueba tuvo un error: mira el detalle');
        return;
      }
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
