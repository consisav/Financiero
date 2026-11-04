// Contabilidad · Procesos · Cierre de mes: los 12 meses del año de una empresa (localidad) con sus
// partidas (vigentes, por aprobar, descuadradas y anuladas) y su estado.
//   Cerrar: administrador, con todas las partidas vigentes del mes aprobadas y cuadradas.
//   Reabrir: solo el Super Administrador, con motivo.
//   Con el mes cerrado sus partidas ya no se registran ni modifican (lo exige la base de datos).
(function () {
  const { esc } = window.UI;
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monto = (n) => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fechaCorta = (f) => f ? new Date(f).toLocaleString('es-GT', { timeZone: 'America/Guatemala', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '';
  const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['cierre-de-mes'] = function (cont) {
    const sb = window.FIN.sb;
    const yo = window.FIN.perfil();
    const admin = window.FIN.puedeEditarCatalogos();
    const superAdmin = window.FIN.esSuperAdmin();
    const [anioHoy, mesHoy] = hoy().split('-').map(Number);
    const f = { loc: yo.localidad_id || null, anio: anioHoy };
    let organizaciones = [];
    let localidades = [];
    let meses = [];

    cont.innerHTML = `
      <div class="cm-espacio">
        <section class="cm-filtros"></section>
        <section class="cm-meses" aria-live="polite"></section>
      </div>`;
    const pFil = cont.querySelector('.cm-filtros');
    const pMes = cont.querySelector('.cm-meses');
    const localidad = (id) => localidades.find((l) => l.id === id);

    async function iniciar() {
      const [o, l, prueba] = await Promise.all([
        sb.from('organizaciones').select('id, codigo, nombre').eq('activo', true).order('codigo'),
        sb.from('localidades').select('id, codigo, correlativo, nombre_comercial, organizacion_id').eq('activo', true).order('organizacion_id').order('correlativo'),
        sb.from('cierres_mes').select('id').limit(1)
      ]);
      if (prueba.error) {
        cont.innerHTML = `<section class="panel"><p class="vacio">${/cierres_mes/.test(prueba.error.message) ? 'Falta instalar el script 50 (cierre de mes) en Supabase.' : esc(prueba.error.message)}</p></section>`;
        return;
      }
      organizaciones = o.data || [];
      localidades = l.data || [];
      if (!localidad(f.loc)) f.loc = localidades[0]?.id || null;
      pintarFiltros();
      await consultar();
    }

    function pintarFiltros() {
      const grupos = organizaciones.map((o) => ({ o, locs: localidades.filter((x) => x.organizacion_id === o.id) })).filter((g) => g.locs.length);
      const anios = []; for (let a = anioHoy + 1; a >= anioHoy - 6; a--) anios.push(a);
      pFil.innerHTML = `
        <div class="pq-marca-titulo"><span class="tk-icono"><i class="ti ti-calendar-check" aria-hidden="true"></i></span><div><small>Procesos</small><h2>Cierre de mes</h2></div></div>
        <label class="campo"><span>Empresa</span><select name="loc">${grupos.map((g) => `<optgroup label="${g.o.codigo} · ${esc(g.o.nombre)}">${g.locs.map((x) => `<option value="${x.id}" ${f.loc === x.id ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre_comercial)}</option>`).join('')}</optgroup>`).join('') || '<option value="">Sin localidades</option>'}</select></label>
        <label class="campo"><span>Año</span><select name="anio">${anios.map((a) => `<option ${f.anio === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <div class="cm-resumen" data-resumen></div>
        <p class="cm-regla"><i class="ti ti-info-circle" aria-hidden="true"></i> Para cerrar, todas las partidas vigentes del mes deben estar aprobadas y cuadradas. Un mes cerrado solo se consulta e imprime; reabrirlo es del Super Administrador.</p>`;
    }

    async function consultar() {
      if (!f.loc) { pMes.innerHTML = '<div class="tk-vacio"><i class="ti ti-building" aria-hidden="true"></i>Elige la empresa.</div>'; return; }
      const partidas = [];
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await sb.from('partidas').select('mes, estado, aprobada, total_debe, total_haber').eq('localidad_id', f.loc).eq('anio', f.anio).range(desde, desde + 999);
        if (error) { pMes.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
        partidas.push(...data);
        if (data.length < 1000) break;
      }
      const { data: cierres } = await sb.from('cierres_mes').select('*').eq('localidad_id', f.loc).eq('anio', f.anio);
      meses = MESES.map((nombre, i) => {
        const ps = partidas.filter((p) => p.mes === i + 1);
        const vig = ps.filter((p) => p.estado === 'VIGENTE');
        return {
          mes: i + 1, nombre,
          cierre: (cierres || []).find((c) => c.mes === i + 1) || null,
          vigentes: vig.length,
          pendientes: vig.filter((p) => !p.aprobada).length,
          descuadradas: vig.filter((p) => Number(p.total_debe) !== Number(p.total_haber)).length,
          anuladas: ps.length - vig.length,
          debe: vig.reduce((s, p) => s + Number(p.total_debe), 0)
        };
      });
      pintar();
    }

    function pintar() {
      const cerrados = meses.filter((m) => m.cierre?.cerrado).length;
      pFil.querySelector('[data-resumen]').innerHTML = `<span><b>${cerrados}</b> cerrados</span><span><b>${12 - cerrados}</b> abiertos</span>`;
      pMes.innerHTML = meses.map((m) => {
        const c = m.cierre;
        const cerrado = !!c?.cerrado;
        const listo = !m.pendientes && !m.descuadradas;
        const futuro = f.anio > anioHoy || (f.anio === anioHoy && m.mes > mesHoy);
        const boton = cerrado
          ? `<button type="button" class="boton secundario-sm rp-peligro" data-reabrir="${m.mes}" ${superAdmin ? '' : 'disabled title="Solo el Super Administrador reabre un mes"'}><i class="ti ti-lock-open" aria-hidden="true"></i> Reabrir</button>`
          : `<button type="button" class="boton primario-sm" data-cerrar="${m.mes}" ${admin && listo ? '' : `disabled title="${!admin ? 'Solo un administrador cierra el mes' : 'Aprueba y cuadra todas las partidas del mes antes de cerrarlo'}"`}><i class="ti ti-lock" aria-hidden="true"></i> Cerrar mes</button>`;
        return `
          <article class="cm-mes ${cerrado ? 'cerrado' : 'abierto'} ${f.anio === anioHoy && m.mes === mesHoy ? 'actual' : ''}">
            <header><span class="cm-num">${String(m.mes).padStart(2, '0')}</span><h3>${m.nombre}</h3>
              <span class="cm-estado"><i class="ti ${cerrado ? 'ti-lock' : 'ti-lock-open'}" aria-hidden="true"></i> ${cerrado ? 'Cerrado' : futuro ? 'Por venir' : 'Abierto'}</span></header>
            <dl>
              <div><dt>Partidas</dt><dd>${m.vigentes}</dd></div>
              <div class="${m.pendientes ? 'aviso' : ''}"><dt>Por aprobar</dt><dd>${m.pendientes}</dd></div>
              <div class="${m.descuadradas ? 'error' : ''}"><dt>Descuadradas</dt><dd>${m.descuadradas}</dd></div>
              <div><dt>Anuladas</dt><dd>${m.anuladas}</dd></div>
            </dl>
            <p class="cm-monto"><span>Movimiento</span><b>Q ${monto(m.debe)}</b></p>
            <footer>
              <small>${cerrado ? `Cerrado por ${esc(c.cerrado_por || '')} · ${esc(fechaCorta(c.cerrado_en))}` : c?.reabierto_en ? `Reabierto por ${esc(c.reabierto_por || '')} · ${esc(fechaCorta(c.reabierto_en))}` : listo ? (m.vigentes ? 'Listo para cerrar' : 'Sin partidas') : 'Pendiente de aprobar o cuadrar'}</small>
              ${boton}
            </footer>
          </article>`;
      }).join('');
    }

    async function accion(mes, tipo) {
      const loc = localidad(f.loc);
      const nombre = `${MESES[mes - 1]} ${f.anio} de ${loc ? `${loc.codigo} · ${loc.nombre_comercial}` : 'la empresa'}`;
      let motivo = null;
      if (tipo === 'CERRAR' && !confirm(`¿Cerrar ${nombre}? Sus partidas ya no se podrán registrar ni modificar.`)) return;
      if (tipo === 'REABRIR') {
        motivo = prompt(`Motivo para reabrir ${nombre}:`);
        if (motivo === null) return;
      }
      const { error } = await sb.rpc('cerrar_mes', { p_loc: f.loc, p_anio: f.anio, p_mes: mes, p_accion: tipo, p_motivo: motivo });
      if (error) return window.FIN.aviso(window.UI.traducirError(error));
      window.FIN.aviso(tipo === 'CERRAR' ? `${MESES[mes - 1]} cerrado` : `${MESES[mes - 1]} reabierto`);
      await consultar();
    }

    cont.addEventListener('change', (e) => {
      if (e.target.name === 'loc') f.loc = e.target.value ? Number(e.target.value) : null;
      else if (e.target.name === 'anio') f.anio = Number(e.target.value);
      else return;
      consultar();
    });
    cont.addEventListener('click', (e) => {
      const c = e.target.closest('[data-cerrar]');
      if (c) return accion(Number(c.dataset.cerrar), 'CERRAR');
      const r = e.target.closest('[data-reabrir]');
      if (r) return accion(Number(r.dataset.reabrir), 'REABRIR');
    });

    iniciar();
  };
})();
