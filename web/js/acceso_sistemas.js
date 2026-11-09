// Administración · Catálogos · Parámetros · Acceso Sistemas (script 170). Solo el Super Administrador Global.
// Módulos a los que tiene acceso cada organización y, si se quiere distinto, cada localidad (empresa):
// la localidad sin configuración propia usa la de su organización; sin ninguna, todos los módulos.
(function () {
  const { esc } = window.UI;
  window.PANTALLAS = window.PANTALLAS || {};

  window.PANTALLAS['acceso-sistemas'] = async function (cont) {
    if (!window.FIN.esGlobal()) {
      cont.innerHTML = '<section class="panel"><p class="vacio">Acceso Sistemas es solo para el Super Administrador Global.</p></section>';
      return;
    }
    const sb = window.FIN.sb;
    const desde = sb.__fromOriginal || sb.from.bind(sb);
    // Administración no se puede quitar: con ella se administra la empresa.
    const MODS = window.MODULOS.filter((m) => m.id !== 'administracion');
    const estado = { orgs: [], locs: [], filas: [], sel: null, marcados: null, cambios: false };

    const filaDe = (org, loc) => estado.filas.find((f) => f.organizacion_id === org && (f.localidad_id || null) === (loc || null));
    // Lo que aplica a un nodo: { modulos (null = todos), origen: 'propia' | 'organizacion' | 'todos' }.
    function efectivo(org, loc) {
      const p = filaDe(org, loc);
      if (p) return { modulos: p.modulos, origen: 'propia' };
      if (loc) { const o = filaDe(org, null); if (o) return { modulos: o.modulos, origen: 'organizacion' }; }
      return { modulos: null, origen: 'todos' };
    }
    const resumen = (e) => e.modulos === null || e.modulos.length >= MODS.length ? 'Todos' : `${e.modulos.filter((x) => MODS.some((m) => m.id === x)).length} de ${MODS.length}`;

    async function cargar() {
      const [o, l, a] = await Promise.all([
        desde('organizaciones').select('id, codigo, nombre, activo').order('codigo'),
        desde('localidades').select('id, codigo, nombre_comercial, organizacion_id, activo').order('codigo'),
        sb.from('acceso_sistemas').select('*')
      ]);
      const err = o.error || l.error || a.error;
      if (err) {
        cont.innerHTML = `<section class="panel"><p class="vacio">${esc(/acceso_sistemas/.test(err.message) ? 'Falta ejecutar el script 170 (Acceso Sistemas) en Supabase.' : err.message)}</p></section>`;
        return false;
      }
      estado.orgs = o.data; estado.locs = l.data; estado.filas = a.data;
      return true;
    }

    function elegir(org, loc) {
      estado.sel = { org, loc: loc || null };
      const e = efectivo(org, loc);
      estado.marcados = new Set(e.modulos === null ? MODS.map((m) => m.id) : e.modulos);
      estado.cambios = false;
      pintar();
    }

    function pintar() {
      const s = estado.sel;
      const org = estado.orgs.find((x) => x.id === s.org);
      const loc = s.loc && estado.locs.find((x) => x.id === s.loc);
      const e = efectivo(s.org, s.loc);
      const marcados = MODS.filter((m) => estado.marcados.has(m.id)).length;
      const todos = marcados === MODS.length;
      const quitados = MODS.filter((m) => !estado.marcados.has(m.id));
      const nodo = (oid, lid, titulo, sub) => {
        const ef = efectivo(oid, lid);
        const act = s.org === oid && (s.loc || null) === (lid || null);
        return `<button type="button" class="acs-nodo ${lid ? 'acs-loc' : 'acs-org'} ${act ? 'actual' : ''}" data-org="${oid}" data-loc="${lid || ''}">
          <span class="acs-nodo-txt"><b>${titulo}</b>${sub ? `<small>${sub}</small>` : ''}</span>
          <span class="acs-etq ${ef.origen}" title="${ef.origen === 'propia' ? 'Configuración propia' : ef.origen === 'organizacion' ? 'Usa la de su organización' : 'Sin restricción'}">${ef.origen === 'organizacion' ? '<i class="ti ti-arrow-up-left" aria-hidden="true"></i> ' : ''}${resumen(ef)}</span>
        </button>`;
      };
      const origenTxt = s.loc
        ? (e.origen === 'propia' ? 'Esta localidad tiene configuración propia.' : e.origen === 'organizacion' ? 'Usa la configuración de su organización. Al guardar, la localidad queda con configuración propia.' : 'Sin restricción: tiene todos los módulos.')
        : (e.origen === 'propia' ? 'Configuración de la organización: la usan sus localidades que no tienen una propia.' : 'Sin restricción: la organización y sus localidades tienen todos los módulos.');

      cont.innerHTML = `
        <div class="acs">
          <section class="panel acs-arbol">
            <div class="panel-cab"><h2>Organizaciones y localidades</h2></div>
            <div class="acs-lista">
              ${estado.orgs.map((o) => `
                <div class="acs-grupo">
                  ${nodo(o.id, null, `${esc(o.codigo)} · ${esc(o.nombre)}`, 'Toda la organización')}
                  ${estado.locs.filter((l) => l.organizacion_id === o.id).map((l) => nodo(o.id, l.id, `${esc(l.codigo)} · ${esc(l.nombre_comercial)}`, l.activo ? '' : 'Inactiva')).join('')}
                </div>`).join('')}
            </div>
            <p class="acs-nota"><i class="ti ti-info-circle" aria-hidden="true"></i> Una localidad sin configuración propia usa la de su organización; sin ninguna, todos los módulos. Administración siempre está disponible.</p>
          </section>
          <section class="panel acs-detalle">
            <div class="panel-cab">
              <h2><i class="ti ${loc ? 'ti-building-store' : 'ti-building'}" aria-hidden="true"></i> ${loc ? `${esc(loc.codigo)} · ${esc(loc.nombre_comercial)} <small>${esc(org.nombre)}</small>` : `${esc(org.codigo)} · ${esc(org.nombre)} <small>Toda la organización</small>`}</h2>
              <div class="panel-acciones">
                ${e.origen === 'propia' ? `<button type="button" class="boton" data-accion="quitar" title="${s.loc ? 'La localidad vuelve a usar la configuración de su organización' : 'La organización vuelve a tener todos los módulos'}"><i class="ti ti-eraser" aria-hidden="true"></i> ${s.loc ? 'Usar la de la organización' : 'Quitar restricción'}</button>` : ''}
                <button type="button" class="boton primario" data-accion="guardar" ${estado.cambios || e.origen !== 'propia' ? '' : 'disabled'}><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button>
              </div>
            </div>
            <p class="acs-origen ${e.origen}">${origenTxt}</p>
            <div class="acs-barra">
              <label class="pc-check acs-todos"><input type="checkbox" data-todos ${todos ? 'checked' : ''}> Todos los módulos</label>
              <span class="acs-cuenta"><b>${marcados}</b> de ${MODS.length} módulos${quitados.length && quitados.length <= 4 ? ` · todos menos ${quitados.map((m) => esc(m.corto)).join(', ')}` : ''}</span>
            </div>
            <div class="acs-mods">
              <label class="acs-mod fijo" data-color="${window.MODULOS[0].color}" title="Siempre disponible">
                <input type="checkbox" checked disabled>
                <span class="acs-ico"><i class="ti ${window.MODULOS[0].icono}" aria-hidden="true"></i></span>
                <span class="acs-mod-txt"><b>${esc(window.MODULOS[0].corto)}</b><small>Siempre disponible</small></span>
              </label>
              ${MODS.map((m) => `
                <label class="acs-mod ${estado.marcados.has(m.id) ? 'si' : ''}" data-color="${m.color}" title="${esc(m.descripcion || '')}">
                  <input type="checkbox" data-mod="${m.id}" ${estado.marcados.has(m.id) ? 'checked' : ''}>
                  <span class="acs-ico"><i class="ti ${m.icono}" aria-hidden="true"></i></span>
                  <span class="acs-mod-txt"><b>${esc(m.corto)}</b><small>${esc(m.descripcion || '')}</small></span>
                </label>`).join('')}
            </div>
          </section>
        </div>`;
      const todosChk = cont.querySelector('[data-todos]');
      todosChk.indeterminate = marcados > 0 && !todos;
    }

    cont.addEventListener('click', async (ev) => {
      const n = ev.target.closest('.acs-nodo');
      if (n) {
        if (estado.cambios && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) return;
        elegir(Number(n.dataset.org), n.dataset.loc ? Number(n.dataset.loc) : null);
        return;
      }
      const b = ev.target.closest('[data-accion]');
      if (!b) return;
      const s = estado.sel;
      const actual = filaDe(s.org, s.loc);
      b.disabled = true;
      let r;
      if (b.dataset.accion === 'guardar') {
        const datos = { organizacion_id: s.org, localidad_id: s.loc, modulos: MODS.filter((m) => estado.marcados.has(m.id)).map((m) => m.id),
          modificado_en: new Date().toISOString(), modificado_por: window.FIN.perfil().nombre || null };
        r = actual ? await sb.from('acceso_sistemas').update(datos).eq('id', actual.id) : await sb.from('acceso_sistemas').insert(datos);
      } else if (actual) {
        r = await sb.from('acceso_sistemas').delete().eq('id', actual.id);
      }
      if (r && r.error) { b.disabled = false; window.FIN.aviso(r.error.message); return; }
      window.FIN.aviso(b.dataset.accion === 'guardar' ? 'Acceso guardado. Se aplica al volver a entrar o cambiar de empresa.' : 'Configuración quitada');
      if (await cargar()) elegir(s.org, s.loc);
    });

    cont.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.matches('[data-todos]')) estado.marcados = new Set(t.checked ? MODS.map((m) => m.id) : []);
      else if (t.matches('[data-mod]')) { if (t.checked) estado.marcados.add(t.dataset.mod); else estado.marcados.delete(t.dataset.mod); }
      else return;
      estado.cambios = true;
      const scroll = cont.querySelector('.acs-lista')?.scrollTop;
      pintar();
      if (scroll) cont.querySelector('.acs-lista').scrollTop = scroll;
    });

    cont.innerHTML = '<section class="panel"><p class="vacio">Cargando…</p></section>';
    if (!(await cargar())) return;
    const p = window.FIN.perfil();
    const loc = estado.locs.find((x) => x.id === p.localidad_id);
    elegir(loc ? loc.organizacion_id : estado.orgs[0]?.id, null);
  };
})();
