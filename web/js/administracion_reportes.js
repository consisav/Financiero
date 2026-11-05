// Administración · Reportes y gráficas: Organizaciones y localidades, Módulos y sub módulos, Roles
// módulos y Listado de usuarios. Antes de ejecutar cada reporte se eligen sus parámetros:
// organización (una o todas), localidad (una o todas) y, si el reporte maneja fecha, la fecha inicial
// y final. El resultado se ve en pantalla y se imprime (PDF) o se descarga (Excel).
(function () {
  const { esc } = window.UI;
  const { fmt, imprimir } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const VENTA = { MEDICAMENTOS: 'Medicamentos', PERECEDEROS: 'Perecederos', 'NO PERECEDEROS': 'No perecederos' };
  const ACC = ['ver', 'crear', 'modificar', 'anular', 'imprimir'];
  const GRUPO = { catalogos: 'Catálogos', registros: 'Registros', mantenimientos: 'Mantenimientos', procesos: 'Procesos', reportes: 'Reportes y gráficas', ayuda: 'Ayuda', tickets: 'Tickets', bancos: 'Bancos', cheques: 'Cheques', cajas: 'Cajas' };
  const si = (b) => (b ? '✓' : '');
  const dentro = (f, p) => { const d = String(f || '').slice(0, 10); return (!p.desde || d >= p.desde) && (!p.hasta || d <= p.hasta); };

  // cfg: { id, titulo, icono, descripcion, fecha (etiqueta del filtro de fecha o null), ejecutar(p, datos) → { columnas, filas, grupos?, resumen } }
  function reporte(cont, cfg) {
    const sb = window.FIN.sb;
    const [y] = fmt.hoy().split('-');
    const p = { org: '', loc: '', desde: cfg.fecha ? `${y}-01-01` : '', hasta: cfg.fecha ? fmt.hoy() : '', formato: 'PDF' };
    let orgs = [], locs = [], resultado = null;
    cont.innerHTML = `<div class="ra-espacio"><section class="panel ra-panel cl-clasico">
        <div class="cl-banda">${esc(cfg.titulo)}</div>
        <form class="ra-param" novalidate></form>
        <div class="ra-resultado" data-resultado><div class="tk-vacio ta-elige"><i class="ti ${cfg.icono}" aria-hidden="true"></i>Elige los parámetros y presiona «Ejecutar reporte».</div></div>
      </section></div>`;
    const form = cont.querySelector('.ra-param');
    const caja = cont.querySelector('[data-resultado]');
    const nombreOrg = () => (p.org ? orgs.find((o) => String(o.id) === p.org)?.nombre : 'TODAS');
    const nombreLoc = () => (p.loc ? locs.find((l) => String(l.id) === p.loc)?.nombre_comercial : 'TODAS');
    const filtroTxt = () => `Organización: ${nombreOrg()} · Localidad: ${nombreLoc()}${cfg.fecha ? ` · ${cfg.fecha}: ${p.desde ? fmt.fechaDia(p.desde) : 'inicio'} al ${p.hasta ? fmt.fechaDia(p.hasta) : 'hoy'}` : ''}`;

    function pintarParam() {
      const ls = locs.filter((l) => !p.org || String(l.organizacion_id) === p.org);
      form.innerHTML = `
        <div class="ra-ayuda"><i class="ti ${cfg.icono}" aria-hidden="true"></i><span>${esc(cfg.descripcion)}</span></div>
        <label class="campo"><span>Organización</span><select name="org"><option value="">TODAS</option>${orgs.map((o) => `<option value="${o.id}" ${String(o.id) === p.org ? 'selected' : ''}>${o.codigo} · ${esc(o.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Localidad</span><select name="loc"><option value="">TODAS</option>${ls.map((l) => `<option value="${l.id}" ${String(l.id) === p.loc ? 'selected' : ''}>${esc(l.codigo)} · ${esc(l.nombre_comercial)}</option>`).join('')}</select></label>
        ${cfg.fecha ? `<label class="campo"><span>Fecha inicial</span><input type="date" name="desde" value="${p.desde}" max="${p.hasta || ''}"></label>
          <label class="campo"><span>Fecha final</span><input type="date" name="hasta" value="${p.hasta}" min="${p.desde || ''}"></label>` : ''}
        <label class="campo"><span>Formato</span><select name="formato"><option ${p.formato === 'PDF' ? 'selected' : ''}>PDF</option><option ${p.formato === 'EXCEL' ? 'selected' : ''}>EXCEL</option></select></label>
        <div class="ra-acc">
          <button type="submit" class="boton primario-sm"><i class="ti ti-player-play" aria-hidden="true"></i> Ejecutar reporte</button>
          <button type="button" class="boton secundario-sm" data-accion="imprimir" ${resultado ? '' : 'disabled'}><i class="ti ti-printer" aria-hidden="true"></i> Imprimir</button>
        </div>`;
    }
    async function iniciar() {
      const [o, l] = await Promise.all([
        sb.from('organizaciones').select('id, codigo, nombre').order('codigo'),
        sb.from('localidades').select('id, organizacion_id, codigo, correlativo, nombre_comercial').order('organizacion_id').order('correlativo')
      ]);
      orgs = o.data || []; locs = l.data || [];
      pintarParam();
    }
    async function ejecutar() {
      caja.innerHTML = '<div class="tk-vacio ta-elige"><i class="ti ti-loader-2" aria-hidden="true"></i>Generando el reporte…</div>';
      try {
        resultado = await cfg.ejecutar(p, { sb, orgs, locs });
      } catch (err) { resultado = null; caja.innerHTML = `<p class="vacio">${esc(window.UI.traducirError(err))}</p>`; pintarParam(); return; }
      pintarParam();
      pintarResultado();
    }
    function pintarResultado() {
      const r = resultado;
      const n = r.filas.length;
      caja.innerHTML = `
        <div class="ra-cab"><b>${esc(cfg.titulo)}</b><span class="tk-tenue">${esc(filtroTxt())}</span>${(r.resumen || []).map(([t, v]) => `<span class="ra-tarjeta"><small>${esc(t)}</small><b>${esc(String(v))}</b></span>`).join('')}</div>
        <div class="pc-lineas ra-tabla"><table>
          <thead><tr>${r.columnas.map((c) => `<th class="${c.num ? 'num' : c.chk ? 'cc-det' : ''}">${esc(c.t)}</th>`).join('')}</tr></thead>
          <tbody>${r.filas.map((f) => f.grupo ? `<tr class="ra-grupo"><td colspan="${r.columnas.length}">${esc(f.grupo)}</td></tr>`
            : `<tr class="${f.nivel ? `ra-n${f.nivel}` : ''} ${f.inactivo ? 'pc-anulada' : ''}">${r.columnas.map((c, i) => `<td class="${c.num ? 'num' : c.chk ? 'cc-det' : ''} ${c.fuerte ? 'fuerte' : ''}">${esc(String(f.c[i] ?? ''))}</td>`).join('')}</tr>`).join('')
            || `<tr><td colspan="${r.columnas.length}" class="tk-vacio">Sin datos con esos parámetros.</td></tr>`}</tbody>
          <tfoot><tr><td colspan="${r.columnas.length}">${r.filas.filter((f) => !f.grupo).length} registro(s)</td></tr></tfoot>
        </table></div>`;
      if (!n) return;
    }
    function imprimirReporte() {
      const r = resultado;
      if (!r) return;
      const filas = r.filas.filter((f) => !f.grupo);
      if (p.formato === 'EXCEL') {
        const cab = r.agrupaPor ? [r.agrupaPor, ...r.columnas.map((c) => c.t)] : r.columnas.map((c) => c.t);
        let g = '';
        const datos = [];
        r.filas.forEach((f) => { if (f.grupo) g = f.grupo; else datos.push(r.agrupaPor ? [g, ...f.c] : f.c); });
        return window.COMPRAS_CAT.descargarCsv(`${cfg.id}_${fmt.hoy()}.csv`, [cab, ...datos]);
      }
      imprimir(cfg.titulo, `<h1>${esc(cfg.titulo)}</h1><h2>${esc(filtroTxt())} · generado el ${esc(fmt.fechaHora(new Date()))}</h2>
        ${(r.resumen || []).length ? `<div class="cab">${r.resumen.map(([t, v]) => `<div><b>${esc(t)}</b>${esc(String(v))}</div>`).join('')}</div>` : ''}
        <table><thead><tr>${r.columnas.map((c) => `<th class="${c.num ? 'n' : ''}">${esc(c.t)}</th>`).join('')}</tr></thead>
        <tbody>${r.filas.map((f) => f.grupo ? `<tr class="s"><td colspan="${r.columnas.length}">${esc(f.grupo)}</td></tr>` : `<tr>${f.c.map((v, i) => `<td class="${r.columnas[i].num ? 'n' : ''}">${esc(String(v ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="${r.columnas.length}">${filas.length} registro(s)</td></tr></tfoot></table>`);
    }

    form.addEventListener('change', (e) => {
      const n = e.target.name;
      p[n] = e.target.value;
      if (n === 'org') { if (p.loc && !locs.some((l) => String(l.id) === p.loc && String(l.organizacion_id) === p.org) && p.org) p.loc = ''; pintarParam(); }
      if (n === 'loc' && p.loc && !p.org) { p.org = String(locs.find((l) => String(l.id) === p.loc)?.organizacion_id || ''); pintarParam(); }
      if ((n === 'desde' || n === 'hasta') && p.desde && p.hasta && p.hasta < p.desde) { if (n === 'desde') p.hasta = p.desde; else p.desde = p.hasta; pintarParam(); }
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); ejecutar(); });
    cont.addEventListener('click', (e) => { if (e.target.closest('[data-accion=imprimir]')) imprimirReporte(); });
    iniciar();
  }

  // Usuarios que cumplen organización y localidad.
  async function usuariosDe(sb, p) {
    let q = sb.from('perfiles').select('*').order('usuario', { nullsFirst: false }).order('nombre');
    if (p.org) q = q.eq('organizacion_id', Number(p.org));
    if (p.loc) q = q.eq('localidad_id', Number(p.loc));
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  // ---------- 1. Organizaciones y localidades ----------
  window.PANTALLAS['reporte-organizaciones'] = (cont) => reporte(cont, {
    id: 'organizaciones_localidades', titulo: 'Organizaciones y localidades', icono: 'ti-building', fecha: 'Fecha de alta',
    descripcion: 'Organizaciones con sus localidades (empresas): datos fiscales, venta de productos, ubicación y estado.',
    async ejecutar(p, { sb }) {
      let qo = sb.from('organizaciones').select('*, municipio:municipios(nombre)').order('codigo');
      if (p.org) qo = qo.eq('id', Number(p.org));
      let ql = sb.from('localidades').select('*, municipio:municipios(nombre)').order('correlativo');
      if (p.org) ql = ql.eq('organizacion_id', Number(p.org));
      if (p.loc) ql = ql.eq('id', Number(p.loc));
      const [o, l] = await Promise.all([qo, ql]);
      if (o.error) throw o.error;
      if (l.error) throw l.error;
      const ls = (l.data || []).filter((x) => dentro(x.creado_en, p));
      const filas = [];
      (o.data || []).forEach((og) => {
        const suyas = ls.filter((x) => x.organizacion_id === og.id);
        if (p.loc && !suyas.length) return;
        filas.push({ grupo: `${og.codigo} · ${og.nombre}${og.representante_legal ? ` · Rep. legal: ${og.representante_legal}` : ''}${og.telefonos ? ` · Tel. ${og.telefonos}` : ''}${og.activo ? '' : ' · INACTIVA'}` });
        suyas.forEach((x) => filas.push({ inactivo: !x.activo, c: [x.codigo, x.nombre_comercial, x.razon_social || '', x.nit || '', VENTA[x.tipo_venta] || '', x.telefonos || '', x.municipio?.nombre || '', x.empresa_anterior || '', x.activo ? 'Activa' : 'Inactiva', fmt.fechaDia(x.creado_en)] }));
      });
      return { agrupaPor: 'Organización', columnas: [{ t: 'Código', fuerte: true }, { t: 'Nombre comercial', fuerte: true }, { t: 'Razón social' }, { t: 'NIT' }, { t: 'Venta de productos' }, { t: 'Teléfonos' }, { t: 'Municipio' }, { t: 'Empresa anterior' }, { t: 'Estado' }, { t: 'Alta' }],
        filas, resumen: [['Organizaciones', filas.filter((f) => f.grupo).length], ['Localidades', ls.filter((x) => !p.org || x.organizacion_id === Number(p.org)).length], ['Activas', ls.filter((x) => x.activo).length]] };
    }
  });

  // ---------- 2. Módulos y sub módulos ----------
  window.PANTALLAS['reporte-modulos'] = (cont) => reporte(cont, {
    id: 'modulos_submodulos', titulo: 'Módulos y sub módulos', icono: 'ti-apps', fecha: null,
    descripcion: 'Módulos del sistema con sus sub módulos y opciones, y cuántos usuarios de la organización y localidad tienen acceso a cada opción.',
    async ejecutar(p, { sb }) {
      const [m, o, us, ru, rf, ra] = await Promise.all([
        sb.from('modulos_sistema').select('*').order('codigo'), sb.from('opciones_sistema').select('*').order('orden'),
        usuariosDe(sb, p), sb.from('rol_usuarios').select('rol_id, perfil_id, estado'), sb.from('roles_funcionales').select('id, acceso_total, activo'), sb.from('rol_accesos').select('rol_id, opcion_id, ver')
      ]);
      for (const r of [m, o, ru, rf, ra]) if (r.error) throw r.error;
      const ids = new Set(us.filter((u) => u.activo).map((u) => u.id));
      const asign = (ru.data || []).filter((x) => x.estado === 'ACTIVO' && ids.has(x.perfil_id));
      const total = new Set(), porOpcion = new Map();
      asign.forEach((a) => {
        const rol = (rf.data || []).find((r) => r.id === a.rol_id);
        if (!rol?.activo) return;
        if (rol.acceso_total) { total.add(a.perfil_id); return; }
        (ra.data || []).filter((x) => x.rol_id === rol.id && x.ver).forEach((x) => { const s = porOpcion.get(x.opcion_id) || new Set(); s.add(a.perfil_id); porOpcion.set(x.opcion_id, s); });
      });
      const conAcceso = (opId) => new Set([...total, ...(porOpcion.get(opId) || [])]).size;
      const mods = m.data || [], ops = o.data || [];
      const filas = [];
      const linea = (md, nivel) => {
        const suyas = ops.filter((x) => x.modulo_id === md.id);
        filas.push({ nivel, inactivo: !md.activo, c: [md.siglas, `${nivel === 2 ? '↳ ' : ''}${md.descripcion}`, nivel === 1 ? 'Módulo' : 'Sub módulo', '', '', suyas.length, md.activo ? 'Activo' : 'Inactivo'] });
        suyas.forEach((x) => filas.push({ nivel: 3, inactivo: !x.activo, c: ['', x.nombre, GRUPO[x.grupo] || x.grupo, x.subgrupo || '', x.clave, conAcceso(x.id), x.activo ? 'Activa' : 'Inactiva'] }));
      };
      mods.filter((x) => !x.modulo_mayor_id).forEach((md) => { linea(md, 1); mods.filter((s) => s.modulo_mayor_id === md.id).forEach((s) => linea(s, 2)); });
      return { columnas: [{ t: 'Siglas', fuerte: true }, { t: 'Módulo / opción' }, { t: 'Grupo' }, { t: 'Subgrupo' }, { t: 'Clave' }, { t: 'Opciones · usuarios con acceso', num: true }, { t: 'Estado' }],
        filas, resumen: [['Módulos', mods.filter((x) => !x.modulo_mayor_id).length], ['Sub módulos', mods.filter((x) => x.modulo_mayor_id).length], ['Opciones', ops.length], ['Usuarios activos', ids.size]] };
    }
  });

  // ---------- 3. Roles módulos ----------
  window.PANTALLAS['reporte-roles'] = (cont) => reporte(cont, {
    id: 'roles_modulos', titulo: 'Roles módulos', icono: 'ti-shield-lock', fecha: 'Vigencia de la asignación',
    descripcion: 'Cada rol con sus usuarios asignados (de la organización y localidad, vigentes en el rango) y las opciones a las que da acceso.',
    async ejecutar(p, { sb, orgs, locs }) {
      const [rf, ru, ra, o, m, us] = await Promise.all([
        sb.from('roles_funcionales').select('*').order('codigo'), sb.from('rol_usuarios').select('*').order('fecha_inicio'), sb.from('rol_accesos').select('*'),
        sb.from('opciones_sistema').select('id, modulo_id, grupo, subgrupo, nombre, orden').order('orden'), sb.from('modulos_sistema').select('id, siglas'), usuariosDe(sb, p)
      ]);
      for (const r of [rf, ru, ra, o, m]) if (r.error) throw r.error;
      const usr = new Map(us.map((u) => [u.id, u]));
      // Vigente en el rango: empieza antes del final y no termina antes del inicio.
      const vigente = (a) => (!p.hasta || String(a.fecha_inicio || '') <= p.hasta) && (!p.desde || !a.fecha_fin || String(a.fecha_fin) >= p.desde);
      const filas = [];
      let asignados = 0;
      (rf.data || []).forEach((rol) => {
        const asig = (ru.data || []).filter((a) => a.rol_id === rol.id && usr.has(a.perfil_id) && vigente(a));
        const acc = (ra.data || []).filter((x) => x.rol_id === rol.id && ACC.some((k) => x[k]));
        if ((p.org || p.loc) && !asig.length) return;
        filas.push({ grupo: `${rol.codigo} · ${rol.nombre}${rol.acceso_total ? ' · ACCESO TOTAL' : ''}${rol.activo ? '' : ' · INACTIVO'} · ${asig.length} usuario(s) · ${rol.acceso_total ? 'todas las' : acc.length} opción(es)` });
        asig.forEach((a) => { const u = usr.get(a.perfil_id); asignados++; const lc = locs.find((l) => l.id === u.localidad_id); filas.push({ nivel: 1, c: ['Usuario', u.usuario || '', u.nombre || '', `${orgs.find((x) => x.id === u.organizacion_id)?.codigo || ''} ${lc ? `· ${lc.codigo}` : ''}`, fmt.fechaDia(a.fecha_inicio), fmt.fechaDia(a.fecha_fin), a.estado, '', '', '', '', ''] }); });
        if (!rol.acceso_total) acc.forEach((x) => { const op = (o.data || []).find((y) => y.id === x.opcion_id); if (!op) return; filas.push({ nivel: 3, c: ['Opción', (m.data || []).find((y) => y.id === op.modulo_id)?.siglas || '', op.nombre, [GRUPO[op.grupo] || op.grupo, op.subgrupo].filter(Boolean).join(' › '), '', '', '', si(x.ver), si(x.crear), si(x.modificar), si(x.anular), si(x.imprimir)] }); });
      });
      return { agrupaPor: 'Rol', columnas: [{ t: 'Tipo' }, { t: 'Usuario / módulo', fuerte: true }, { t: 'Nombre / opción' }, { t: 'Org. · loc. / grupo' }, { t: 'Inicio' }, { t: 'Fin' }, { t: 'Estado' }, { t: 'Ver', chk: true }, { t: 'Crear', chk: true }, { t: 'Modificar', chk: true }, { t: 'Anular', chk: true }, { t: 'Imprimir', chk: true }],
        filas, resumen: [['Roles', filas.filter((f) => f.grupo).length], ['Asignaciones', asignados]] };
    }
  });

  // ---------- 4. Listado de usuarios ----------
  window.PANTALLAS['reporte-usuarios'] = (cont) => reporte(cont, {
    id: 'listado_usuarios', titulo: 'Listado de usuarios', icono: 'ti-users', fecha: 'Fecha de alta',
    descripcion: 'Usuarios del sistema con su organización, localidad, rol, roles funcionales vigentes, vencimiento de clave y estado.',
    async ejecutar(p, { sb, orgs, locs }) {
      const [us, roles, ru, rf] = await Promise.all([usuariosDe(sb, p), sb.from('roles').select('id, nombre'), sb.from('rol_usuarios').select('rol_id, perfil_id, estado'), sb.from('roles_funcionales').select('id, codigo, nombre')]);
      const lista = us.filter((u) => dentro(u.creado_en, p));
      const filas = [];
      let og = null;
      lista.slice().sort((a, b) => (a.organizacion_id || 0) - (b.organizacion_id || 0) || String(a.usuario || '').localeCompare(String(b.usuario || ''))).forEach((u) => {
        if (u.organizacion_id !== og) { og = u.organizacion_id; const o = orgs.find((x) => x.id === og); filas.push({ grupo: o ? `${o.codigo} · ${o.nombre}` : 'Sin organización' }); }
        const lc = locs.find((l) => l.id === u.localidad_id);
        const funcionales = (ru.data || []).filter((a) => a.perfil_id === u.id && a.estado === 'ACTIVO').map((a) => (rf.data || []).find((r) => r.id === a.rol_id)?.codigo).filter(Boolean).join(', ');
        const vence = u.fecha_vence_clave && String(u.fecha_vence_clave).slice(0, 10) < fmt.hoy();
        filas.push({ inactivo: !u.activo, c: [u.usuario || '', u.nombre || '', u.correo || '', lc ? `${lc.codigo} · ${lc.nombre_comercial}` : '', (roles.data || []).find((r) => r.id === u.rol_id)?.nombre || '', funcionales, u.empleado || '', fmt.fechaDia(u.fecha_vence_clave) + (vence ? ' (vencida)' : ''), u.activo ? 'Activo' : 'Inactivo', fmt.fechaDia(u.creado_en)] });
      });
      return { agrupaPor: 'Organización', columnas: [{ t: 'Usuario', fuerte: true }, { t: 'Nombre' }, { t: 'Correo' }, { t: 'Localidad' }, { t: 'Rol' }, { t: 'Roles funcionales' }, { t: 'Empleado' }, { t: 'Vence clave' }, { t: 'Estado' }, { t: 'Alta' }],
        filas, resumen: [['Usuarios', lista.length], ['Activos', lista.filter((u) => u.activo).length], ['Inactivos', lista.filter((u) => !u.activo).length]] };
    }
  });
})();
