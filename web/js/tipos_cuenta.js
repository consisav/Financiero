// Contabilidad · Tipos de cuentas: naturaleza (debe-haber / haber-debe) y efecto en el resultado del ejercicio.
// Cada organización y localidad (empresa) tiene sus propios tipos; se pueden copiar de otra empresa.
(function () {
  const { esc, tabla, formulario, filtrar } = window.UI;

  const OPERACIONES = [{ valor: 'DEBE-HABER', texto: 'DEBE - HABER' }, { valor: 'HABER-DEBE', texto: 'HABER - DEBE' }];
  const RESULTADOS = ['NINGUNA', 'SUMAR', 'RESTAR'].map((v) => ({ valor: v, texto: v }));
  const marca = (si) => si ? '<i class="ti ti-square-check marca-si" aria-label="Sí"></i>' : '<i class="ti ti-square marca-no" aria-label="No"></i>';

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['tipos-cuenta'] = function (cont) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    let filas = [];
    let buscar = '';
    let orgs = [], locs = [];
    const yo = window.FIN.perfil();
    const sel = { org: yo.organizacion_id || null, loc: yo.localidad_id || null };
    const locsOrg = () => locs.filter((l) => l.organizacion_id === sel.org);

    cont.innerHTML = '<section class="panel" id="p-tipos"></section>';
    const panel = cont.querySelector('#p-tipos');

    async function iniciar() {
      const [o, l] = await Promise.all([
        sb.from('organizaciones').select('id, codigo, nombre').eq('activo', true).order('codigo'),
        sb.from('localidades').select('id, organizacion_id, codigo, correlativo, nombre_comercial').eq('activo', true).order('organizacion_id').order('correlativo')
      ]);
      orgs = o.data || []; locs = l.data || [];
      if (!orgs.some((x) => x.id === sel.org)) sel.org = orgs[0]?.id || null;
      if (!locsOrg().some((x) => x.id === sel.loc)) sel.loc = locsOrg()[0]?.id || null;
      await cargar();
    }
    async function cargar() {
      if (!sel.loc) { panel.innerHTML = '<p class="vacio">Elige la organización y la localidad (empresa).</p>'; return; }
      const { data, error } = await sb.from('tipos_cuenta').select('*').eq('localidad_id', sel.loc).order('codigo');
      if (error) { panel.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      filas = data;
      panel.innerHTML = `
        <div class="panel-cab">
          <h2>Tipos de cuentas contables</h2>
          <div class="panel-acciones">${editable ? '<button type="button" class="boton secundario-sm" data-accion="copiar" title="Copia los tipos que faltan desde otra empresa"><i class="ti ti-copy" aria-hidden="true"></i> Copiar de otra empresa</button><button type="button" class="boton primario-sm" data-accion="nuevo">+ Tipo de cuenta</button>' : ''}</div>
        </div>
        <div class="tc-empresa">
          <label class="campo"><span>Organización</span><select name="tc-org">${orgs.map((x) => `<option value="${x.id}" ${x.id === sel.org ? 'selected' : ''}>${x.codigo} · ${esc(x.nombre)}</option>`).join('')}</select></label>
          <label class="campo"><span>Localidad / empresa</span><select name="tc-loc">${locsOrg().map((x) => `<option value="${x.id}" ${x.id === sel.loc ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre_comercial)}</option>`).join('')}</select></label>
          <small class="tk-tenue">${filas.length} tipo(s) de cuenta de esta empresa</small>
        </div>
        <input type="search" class="buscar" data-buscar placeholder="Buscar tipo de cuenta" value="${esc(buscar)}">
        ${tabla({
          id: 'tipos', editable, vacio: 'Todavía no hay tipos de cuenta.',
          columnas: [
            { titulo: 'Tipo', valor: (f) => f.codigo, clase: 'angosta' },
            { titulo: 'Descripción', valor: (f) => esc(f.descripcion), clase: 'fuerte' },
            { titulo: 'Tipo de operación', valor: (f) => esc(f.tipo_operacion.replace('-', ' - ')) },
            { titulo: 'Operación resultado ejercicio', valor: (f) => esc(f.operacion_resultado) },
            { titulo: 'Incluye centro de costo', valor: (f) => marca(f.incluye_centro_costo), clase: 'centrada' },
            { titulo: 'Estado', valor: (f) => window.UI.estado(f.activo) }
          ],
          filas
        })}`;
      filtrar(panel, buscar);
    }

    function form(fila) {
      formulario({
        titulo: fila ? `Modificar tipo de cuenta · ${fila.descripcion}` : 'Nuevo tipo de cuenta',
        valores: fila || { codigo: Math.max(0, ...filas.map((x) => x.codigo)) + 1, tipo_operacion: 'DEBE-HABER', operacion_resultado: 'NINGUNA', activo: true },
        campos: [
          { nombre: 'codigo', etiqueta: 'Tipo', tipo: 'numero', requerido: true },
          { nombre: 'descripcion', etiqueta: 'Descripción', requerido: true },
          { nombre: 'tipo_operacion', etiqueta: 'Tipo de operación', tipo: 'select', opciones: OPERACIONES, requerido: true },
          { nombre: 'operacion_resultado', etiqueta: 'Operación resultado ejercicio', tipo: 'select', opciones: RESULTADOS, requerido: true },
          { nombre: 'incluye_centro_costo', etiqueta: 'Incluye centro de costo', tipo: 'casilla' },
          { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla' }
        ],
        alGuardar: async (d) => {
          d.descripcion = d.descripcion.toUpperCase();
          const r = fila ? await sb.from('tipos_cuenta').update(d).eq('id', fila.id) : await sb.from('tipos_cuenta').insert({ ...d, organizacion_id: sel.org, localidad_id: sel.loc });
          if (r.error) throw r.error;
          window.FIN.aviso('Tipo de cuenta guardado');
          await cargar();
        }
      });
    }

    cont.addEventListener('click', (e) => {
      if (e.target.closest('[data-accion=nuevo]')) return form();
      if (e.target.closest('[data-accion=copiar]')) return copiar();
      const ed = e.target.closest('[data-editar]');
      if (ed) form(filas.find((x) => String(x.id) === ed.dataset.editar));
    });
    cont.addEventListener('change', async (e) => {
      if (e.target.name === 'tc-org') { sel.org = Number(e.target.value); sel.loc = locsOrg()[0]?.id || null; return cargar(); }
      if (e.target.name === 'tc-loc') { sel.loc = Number(e.target.value); return cargar(); }
    });
    // Copia a esta empresa los tipos que le faltan de otra (mismo código).
    function copiar() {
      const otras = locs.filter((l) => l.id !== sel.loc);
      if (!otras.length) return window.FIN.aviso('No hay otra empresa de donde copiar');
      const og = (id) => orgs.find((o) => o.id === id);
      formulario({
        titulo: 'Copiar tipos de cuenta de otra empresa',
        valores: { origen: otras.find((l) => l.organizacion_id === sel.org)?.id || otras[0].id },
        campos: [{ nombre: 'origen', etiqueta: 'Empresa de origen', tipo: 'select-numero', requerido: true, opciones: otras.map((l) => ({ valor: l.id, texto: `${og(l.organizacion_id)?.codigo || ''} · ${l.codigo} · ${l.nombre_comercial}` })) }],
        alGuardar: async (d) => {
          const { data, error } = await sb.rpc('copiar_tipos_cuenta', { p_origen: Number(d.origen), p_destino: sel.loc });
          if (error) throw error;
          window.FIN.aviso(data ? `${data} tipo(s) de cuenta copiado(s)` : 'Esta empresa ya tiene todos los tipos de la empresa de origen');
          await cargar();
        }
      });
    }
    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-buscar]')) return;
      buscar = e.target.value;
      filtrar(panel, buscar);
    });

    iniciar();
  };
})();
