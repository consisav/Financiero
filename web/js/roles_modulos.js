// Catálogos · Iniciales · Roles módulos (diseño B): roles a la izquierda; a la derecha los usuarios
// del rol y la matriz de accesos por pantalla (ver, crear, modificar, anular, imprimir).
// Los permisos se definen por rol; cada usuario puede tener excepciones (usuario_accesos, null = hereda).
(function () {
  const { esc, fechaCorta, fecha, tabla, formulario } = window.UI;
  const ACCIONES = [
    { id: 'ver', nombre: 'Ver' }, { id: 'crear', nombre: 'Crear' }, { id: 'modificar', nombre: 'Modificar' },
    { id: 'anular', nombre: 'Anular' }, { id: 'imprimir', nombre: 'Imprimir' }
  ];
  const GRUPO_NOMBRE = { catalogos: 'Catálogos', registros: 'Registros', mantenimientos: 'Mantenimientos', procesos: 'Procesos', reportes: 'Reportes y gráficas', ayuda: 'Ayuda' };
  const ESTADOS = ['ACTIVO', 'SUSPENDIDO', 'FINALIZADO'];
  const vacio = () => ({ ver: false, crear: false, modificar: false, anular: false, imprimir: false });
  const estadoAsig = (e) => `<span class="estado ${e === 'ACTIVO' ? 'activo' : e === 'SUSPENDIDO' ? 'vencida' : 'inactivo'}">${e.charAt(0) + e.slice(1).toLowerCase()}</span>`;

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS['roles-modulos'] = async function (cont) {
    const sb = window.FIN.sb;
    const editable = window.FIN.esAdmin();
    const estado = {
      roles: [], asignaciones: [], opciones: [], usuarios: [],
      rol: null, asig: null, modo: 'rol', buscarRol: '', buscarPantalla: '',
      base: new Map(), exc: new Map(), borrador: null,
      abiertos: new Set(), excepcionesRol: 0
    };

    const [r, a, o, u] = await Promise.all([
      sb.from('roles_funcionales').select('*').order('codigo'),
      sb.from('rol_usuarios').select('*').order('fecha_inicio', { ascending: false }),
      sb.from('opciones_sistema').select('*, modulo:modulos_sistema(codigo, siglas, descripcion)').eq('activo', true).order('orden'),
      sb.rpc('usuarios_resumen')
    ]);
    const err = r.error || a.error || o.error;
    if (err) {
      cont.innerHTML = /roles_funcionales|opciones_sistema|rol_usuarios/.test(err.message)
        ? '<p class="vacio">Falta instalar en Supabase el script <b>20261102000011_roles_modulos.sql</b>.</p>'
        : `<p class="vacio">${esc(err.message)}</p>`;
      return;
    }
    Object.assign(estado, { roles: r.data, asignaciones: a.data, opciones: o.data, usuarios: u.data || [] });
    estado.rol = estado.roles.find((x) => x.activo) || estado.roles[0] || null;

    const usuario = (id) => estado.usuarios.find((x) => x.id === id) || { usuario: '', nombre: 'Usuario inactivo' };
    const asigDe = (rolId) => estado.asignaciones.filter((x) => x.rol_id === rolId);

    cont.innerHTML = `
      <div class="rm-grid">
        <aside class="panel rm-roles" id="rm-roles"></aside>
        <div class="rm-derecha">
          <section class="panel" id="rm-usuarios"></section>
          <section class="panel" id="rm-accesos"></section>
        </div>
      </div>`;
    const pRoles = cont.querySelector('#rm-roles');
    const pUsu = cont.querySelector('#rm-usuarios');
    const pAcc = cont.querySelector('#rm-accesos');

    // ---------- Datos de accesos ----------
    async function cargarAccesos() {
      estado.base = new Map();
      estado.exc = new Map();
      if (!estado.rol) return;
      const { data } = await sb.from('rol_accesos').select('*').eq('rol_id', estado.rol.id);
      (data || []).forEach((x) => estado.base.set(x.opcion_id, x));
      // Excepciones de todos los usuarios del rol, para el resumen.
      const ids = asigDe(estado.rol.id).map((x) => x.id);
      estado.excepcionesRol = 0;
      if (ids.length) {
        const c = await sb.from('usuario_accesos').select('opcion_id', { count: 'exact', head: true }).in('rol_usuario_id', ids);
        estado.excepcionesRol = c.count || 0;
      }
      if (estado.asig) {
        const e = await sb.from('usuario_accesos').select('*').eq('rol_usuario_id', estado.asig.id);
        (e.data || []).forEach((x) => estado.exc.set(x.opcion_id, x));
      }
      reiniciarBorrador();
    }

    function reiniciarBorrador() {
      const fuente = estado.modo === 'rol' ? estado.base : estado.exc;
      estado.borrador = new Map([...fuente].map(([k, v]) => [k, Object.fromEntries(ACCIONES.map((ac) => [ac.id, v[ac.id] ?? null]))]));
    }

    // Pantallas cuyo borrador difiere de lo guardado (rol: sin fila = todo falso; usuario: sin fila = todo null).
    function cambiosPendientes() {
      const fuente = estado.modo === 'rol' ? estado.base : estado.exc;
      const normal = (f) => ACCIONES.map((ac) => estado.modo === 'rol' ? !!(f && f[ac.id]) : (f && f[ac.id] !== undefined ? f[ac.id] : null)).join();
      const ids = new Set([...fuente.keys(), ...estado.borrador.keys()]);
      return [...ids].filter((id) => normal(fuente.get(id)) !== normal(estado.borrador.get(id))).length;
    }

    const delRol = (id) => estado.base.get(id) || vacio();
    function efectivo(id, ac) {
      if (estado.modo === 'rol') return !!(estado.borrador.get(id) || {})[ac];
      const ex = estado.borrador.get(id);
      return ex && ex[ac] !== null && ex[ac] !== undefined ? ex[ac] : !!delRol(id)[ac];
    }
    const esExcepcion = (id, ac) => {
      const ex = estado.modo === 'usuario' && estado.borrador.get(id);
      return !!ex && ex[ac] !== null && ex[ac] !== undefined && ex[ac] !== !!delRol(id)[ac];
    };

    // Fija una acción; ver es requisito de las demás y quitarlo quita todo.
    function fijar(id, ac, valor) {
      const aplicar = (accion, v) => {
        if (estado.modo === 'rol') {
          const fila = estado.borrador.get(id) || vacio();
          fila[accion] = v;
          estado.borrador.set(id, fila);
        } else {
          const fila = estado.borrador.get(id) || Object.fromEntries(ACCIONES.map((x) => [x.id, null]));
          fila[accion] = v === !!delRol(id)[accion] ? null : v;
          estado.borrador.set(id, fila);
        }
      };
      aplicar(ac, valor);
      if (valor && ac !== 'ver') aplicar('ver', true);
      if (!valor && ac === 'ver') ACCIONES.forEach((x) => aplicar(x.id, false));
    }

    // ---------- Pintar ----------
    function pintarRoles() {
      const q = estado.buscarRol.trim().toLowerCase();
      const lista = estado.roles.filter((x) => !q || x.nombre.toLowerCase().includes(q) || String(x.codigo).includes(q));
      pRoles.innerHTML = `
        <div class="panel-cab">
          <h2>Roles</h2>
          <div class="panel-acciones">${editable ? '<button type="button" class="boton primario-sm" data-accion="nuevo-rol">+ Rol</button>' : ''}</div>
        </div>
        <input type="search" class="buscar" data-buscar-rol placeholder="Buscar rol" value="${esc(estado.buscarRol)}">
        <ul class="rm-lista">
          ${lista.map((x) => `
            <li><button type="button" class="rm-rol ${estado.rol && x.id === estado.rol.id ? 'activo' : ''} ${x.activo ? '' : 'apagado'}" data-rol="${x.id}">
              <span class="rm-rol-cod">${x.codigo}</span>
              <span class="rm-rol-nombre">${esc(x.nombre)}${x.activo ? '' : ' <small>(inactivo)</small>'}${x.acceso_total ? ' <i class="ti ti-crown rm-corona" title="Acceso total" aria-label="Acceso total"></i>' : ''}</span>
              <span class="rm-rol-cuenta" title="Usuarios activos">${asigDe(x.id).filter((s) => s.estado === 'ACTIVO').length}</span>
            </button></li>`).join('') || '<li class="vacio">Sin roles</li>'}
        </ul>`;
    }

    function pintarUsuarios() {
      const rol = estado.rol;
      if (!rol) { pUsu.innerHTML = '<p class="vacio">Crea el primer rol con «+ Rol».</p>'; return; }
      pUsu.innerHTML = `
        <div class="panel-cab">
          <div>
            <h2>${esc(rol.nombre)} <small>· código ${rol.codigo}</small>${rol.acceso_total ? ' <span class="estado activo"><i class="ti ti-crown" aria-hidden="true"></i> Acceso total</span>' : ''}</h2>
            <p class="rm-desc">${esc(rol.descripcion || 'Sin descripción')}</p>
          </div>
          <div class="panel-acciones">
            ${editable ? '<button type="button" class="boton secundario-sm" data-accion="modificar-rol"><i class="ti ti-pencil" aria-hidden="true"></i> Modificar rol</button>' : ''}
            ${editable ? '<button type="button" class="boton primario-sm" data-accion="asignar">+ Asignar usuario</button>' : ''}
          </div>
        </div>
        ${tabla({
          id: 'asignaciones', editable, seleccionado: estado.asig && estado.asig.id,
          vacio: `Todavía no hay usuarios con el rol ${rol.nombre}.`,
          columnas: [
            { titulo: 'Usuario', valor: (f) => `<span class="codigo">${esc(usuario(f.perfil_id).usuario) || '—'}</span>`, clase: 'angosta' },
            { titulo: 'Nombre', valor: (f) => esc(usuario(f.perfil_id).nombre), clase: 'fuerte' },
            { titulo: 'Desde', valor: (f) => fechaCorta(f.fecha_inicio) },
            { titulo: 'Hasta', valor: (f) => fechaCorta(f.fecha_fin) || '—' },
            { titulo: 'Estado', valor: (f) => estadoAsig(f.estado) },
            { titulo: 'Asignado por', valor: (f) => `${esc(f.creado_por_nombre || 'sistema')} · ${fecha(f.creado_en).slice(0, 10)}` }
          ],
          filas: asigDe(rol.id)
        })}`;
    }

    // Un rol con acceso total no se edita pantalla por pantalla (sí las excepciones de sus usuarios).
    const editMatriz = () => editable && !(estado.modo === 'rol' && estado.rol && estado.rol.acceso_total);

    // Módulos de la matriz: comunes primero y luego por código del módulo.
    function modulosMatriz() {
      const mapa = new Map();
      for (const op of estado.opciones) {
        const k = String(op.modulo_id || 0);
        if (!mapa.has(k)) mapa.set(k, { clave: k, nombre: op.modulo ? op.modulo.descripcion : 'COMÚN A TODOS LOS MÓDULOS', siglas: op.modulo ? op.modulo.siglas : 'COM', orden: op.modulo ? op.modulo.codigo : 0, opciones: [] });
        mapa.get(k).opciones.push(op);
      }
      return [...mapa.values()].sort((a, b) => a.orden - b.orden);
    }

    // Casilla de tres estados: todas, algunas o ninguna de las pantallas tienen la acción.
    function triestado(ids, ac, datos, titulo) {
      const n = ids.filter((id) => efectivo(id, ac)).length;
      const marca = n === ids.length && n > 0 ? 'checked' : '';
      return `<input type="checkbox" class="tri" ${marca} data-indeterminado="${n > 0 && n < ids.length}" ${datos} ${editMatriz() ? '' : 'disabled'} aria-label="${esc(titulo)}" title="${esc(titulo)}">`;
    }

    function atajos(alcance, compacto) {
      if (!editMatriz()) return '';
      const b = (preset, icono, texto, titulo) => `<button type="button" class="${compacto ? 'atajo-mini' : 'boton secundario-sm atajo'}" data-preset="${preset}" data-alcance="${alcance}" title="${esc(titulo)}"><i class="ti ${icono}" aria-hidden="true"></i>${compacto ? '' : ' '}${texto}</button>`;
      return b('total', 'ti-checks', compacto ? 'Total' : 'Acceso total', 'Todas las acciones en todas las pantallas')
        + b('consulta', 'ti-eye', compacto ? 'Consulta' : 'Solo consulta', 'Solo Ver e Imprimir')
        + b('ninguno', 'ti-ban', compacto ? 'Ninguno' : 'Quitar todo', 'Sin acceso');
    }

    function pintarAccesos() {
      const rol = estado.rol;
      if (!rol) { pAcc.innerHTML = ''; return; }
      const q = estado.buscarPantalla.trim().toLowerCase();
      const usuarioSel = estado.asig ? usuario(estado.asig.perfil_id) : null;
      const todos = estado.opciones.map((x) => x.id);
      const conVer = todos.filter((id) => efectivo(id, 'ver')).length;
      const conModificar = todos.filter((id) => efectivo(id, 'modificar')).length;
      const excepciones = estado.modo === 'usuario'
        ? todos.filter((id) => ACCIONES.some((ac) => esExcepcion(id, ac.id))).length
        : estado.excepcionesRol;
      const activos = asigDe(rol.id).filter((x) => x.estado === 'ACTIVO').length;
      const modulos = modulosMatriz();
      const n = cambiosPendientes();

      pAcc.innerHTML = `
        <div class="panel-cab">
          <h2>Matriz de accesos</h2>
          <div class="segmentado" role="tablist">
            <button type="button" role="tab" class="${estado.modo === 'rol' ? 'activo' : ''}" data-modo="rol" aria-selected="${estado.modo === 'rol'}">Permisos del rol</button>
            <button type="button" role="tab" class="${estado.modo === 'usuario' ? 'activo' : ''}" data-modo="usuario" aria-selected="${estado.modo === 'usuario'}" ${usuarioSel ? '' : 'disabled title="Elige un usuario del rol"'}>Accesos de ${usuarioSel ? esc(usuarioSel.usuario || usuarioSel.nombre) : 'usuario'}</button>
          </div>
        </div>

        <div class="rm-kpis">
          <div class="rm-kpi"><span>Usuarios activos</span><b>${activos}</b></div>
          <div class="rm-kpi"><span>Pantallas con acceso</span><b>${conVer} <small>/ ${todos.length}</small></b></div>
          <div class="rm-kpi"><span>Pueden modificar</span><b>${conModificar}</b></div>
          <div class="rm-kpi ${excepciones ? 'aviso' : ''}"><span>${estado.modo === 'usuario' ? 'Excepciones del usuario' : 'Excepciones de usuarios'}</span><b>${excepciones}</b></div>
        </div>

        <p class="rm-ayuda">${estado.modo === 'rol'
          ? (rol.acceso_total ? `<b>${esc(rol.nombre)}</b> tiene <b>acceso total</b> a todo el sistema, también a las pantallas que se agreguen. Para limitarlo, quita «Acceso total» en Modificar rol.` : `Lo que marques aquí lo heredan todos los usuarios con el rol <b>${esc(rol.nombre)}</b>.`)
          : `Accesos finales de <b>${esc(usuarioSel.nombre)}</b>: los del rol más sus excepciones. Las celdas <span class="excepcion-muestra">resaltadas</span> son excepciones; al dejarlas igual que el rol vuelven a heredarse.`}</p>

        <div class="rm-atajos">
          ${editMatriz() ? `<span class="rm-atajos-titulo">Todo el sistema</span>${atajos('todo', false)}` : ''}
          ${editMatriz() && estado.modo === 'rol' && estado.roles.length > 1 ? `
            <label class="selector-org copiar">Copiar de <select data-copiar>
              <option value="">Otro rol…</option>
              ${estado.roles.filter((x) => x.id !== rol.id).map((x) => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}
            </select></label>` : ''}
        </div>

        <div class="rm-filtros">
          <input type="search" class="buscar" data-buscar-pantalla placeholder="Buscar pantalla" value="${esc(estado.buscarPantalla)}">
          <button type="button" class="boton secundario-sm" data-plegar-todo="abrir"><i class="ti ti-arrows-maximize" aria-hidden="true"></i> Expandir todo</button>
          <button type="button" class="boton secundario-sm" data-plegar-todo="cerrar"><i class="ti ti-arrows-minimize" aria-hidden="true"></i> Contraer todo</button>
        </div>

        <div class="rm-matriz">
          <table class="tabla matriz">
            <thead><tr>
              <th>Módulo · pantalla</th>
              <th class="rm-avance-col">Acceso</th>
              ${ACCIONES.map((ac) => `<th class="centrada"><label class="col-tri">${triestado(todos, ac.id, `data-tri-todo="${ac.id}"`, `${ac.nombre} en todo el sistema`)}<span>${ac.nombre}</span></label></th>`).join('')}
            </tr></thead>
            ${modulos.map((md) => {
              const ops = md.opciones.filter((x) => !q || x.nombre.toLowerCase().includes(q));
              if (q && !ops.length) return '';
              const ids = md.opciones.map((x) => x.id);
              const c = ids.filter((id) => efectivo(id, 'ver')).length;
              const pct = Math.round((c / ids.length) * 100);
              const abierto = q ? true : estado.abiertos.has(md.clave);
              let grupoActual = '';
              return `
                <tbody class="rm-modulo ${abierto ? 'abierto' : ''}">
                  <tr class="rm-modulo-cab">
                    <td><div class="rm-cab-celda">
                      <button type="button" class="rm-plegar" data-plegar="${md.clave}" aria-expanded="${abierto}">
                        <i class="ti ti-chevron-${abierto ? 'down' : 'right'}" aria-hidden="true"></i>
                        <span class="siglas">${esc(md.siglas)}</span> ${esc(md.nombre)} <small>${ids.length} pantallas</small>
                      </button>
                      <span class="rm-atajos-mini">${atajos(md.clave, true)}</span>
                    </div></td>
                    <td class="rm-avance-col">
                      <div class="rm-avance" title="${c} de ${ids.length} pantallas con acceso"><i style="width:${pct}%" class="${pct === 100 ? 'completo' : pct ? 'parcial' : ''}"></i></div>
                      <small>${c}/${ids.length}</small>
                    </td>
                    ${ACCIONES.map((ac) => `<td class="centrada">${triestado(ids, ac.id, `data-tri-modulo="${md.clave}|${ac.id}"`, `${ac.nombre} en ${md.nombre}`)}</td>`).join('')}
                  </tr>
                  ${abierto ? ops.map((op) => {
                    const g = `${op.grupo}|${op.subgrupo || ''}`;
                    const cab = g !== grupoActual ? `<tr class="grupo-matriz"><td colspan="${ACCIONES.length + 2}">${GRUPO_NOMBRE[op.grupo]}${op.subgrupo ? ` · ${esc(op.subgrupo)}` : ''}</td></tr>` : '';
                    grupoActual = g;
                    return cab + `
                      <tr data-op="${op.id}">
                        <td colspan="2"><button type="button" class="fila-todo" data-fila="${op.id}" ${editMatriz() ? '' : 'disabled'} title="Marcar o quitar toda la fila">${esc(op.nombre)}</button></td>
                        ${ACCIONES.map((ac) => `<td class="centrada ${esExcepcion(op.id, ac.id) ? 'excepcion' : ''}"><input type="checkbox" data-celda="${op.id}|${ac.id}" ${efectivo(op.id, ac.id) ? 'checked' : ''} ${editMatriz() ? '' : 'disabled'} aria-label="${ac.nombre} ${esc(op.nombre)}"></td>`).join('')}
                      </tr>`;
                  }).join('') : ''}
                </tbody>`;
            }).join('') || `<tbody><tr><td colspan="${ACCIONES.length + 2}" class="vacio">Sin pantallas con esa búsqueda.</td></tr></tbody>`}
          </table>
        </div>
        ${editMatriz() ? `
          <div class="barra-guardar rm-guardar">
            <span class="rm-cambios ${n ? 'pendientes' : ''}">${n ? `${n} pantalla${n === 1 ? '' : 's'} con cambios sin guardar` : 'Sin cambios'}</span>
            <button type="button" class="boton secundario-sm" data-accion="descartar" ${n ? '' : 'disabled'}>Descartar</button>
            <button type="button" class="boton primario-sm" data-accion="guardar-accesos" ${n ? '' : 'disabled'}>Guardar accesos</button>
          </div>` : ''}`;
      pAcc.querySelectorAll('[data-indeterminado=true]').forEach((x) => { x.indeterminate = true; });
    }

    // Atajos: total = todas las acciones; consulta = ver e imprimir; ninguno = sin acceso.
    function aplicarPreset(ids, preset) {
      for (const id of ids) {
        for (const ac of ACCIONES) {
          const v = preset === 'total' || (preset === 'consulta' && (ac.id === 'ver' || ac.id === 'imprimir'));
          if (!v) fijar(id, ac.id, false);
        }
        for (const ac of ACCIONES) {
          const v = preset === 'total' || (preset === 'consulta' && (ac.id === 'ver' || ac.id === 'imprimir'));
          if (v) fijar(id, ac.id, true);
        }
      }
    }

    // Marca o quita una acción en un conjunto de pantallas (si todas la tienen, se quita).
    function alternarAccion(ids, ac) {
      const todas = ids.every((id) => efectivo(id, ac));
      ids.forEach((id) => fijar(id, ac, !todas));
    }

    async function copiarDeRol(idRol) {
      const { data, error } = await sb.from('rol_accesos').select('*').eq('rol_id', idRol);
      if (error) { window.FIN.aviso(window.UI.traducirError(error)); return; }
      const origen = new Map((data || []).map((x) => [x.opcion_id, x]));
      for (const op of estado.opciones) {
        const f = origen.get(op.id) || vacio();
        estado.borrador.set(op.id, Object.fromEntries(ACCIONES.map((ac) => [ac.id, !!f[ac.id]])));
      }
      const r = estado.roles.find((x) => x.id === idRol);
      window.FIN.aviso(`Permisos copiados de ${r ? r.nombre : 'otro rol'}. Revisa y pulsa Guardar accesos.`);
    }

    function pintar() { pintarRoles(); pintarUsuarios(); pintarAccesos(); }

    // ---------- Guardar ----------
    async function guardarAccesos() {
      const boton = pAcc.querySelector('[data-accion=guardar-accesos]');
      boton.disabled = true;
      try {
        if (estado.modo === 'rol') {
          const poner = [], quitar = [];
          for (const [id, f] of estado.borrador) {
            if (ACCIONES.some((ac) => f[ac.id])) poner.push({ rol_id: estado.rol.id, opcion_id: id, ...Object.fromEntries(ACCIONES.map((ac) => [ac.id, !!f[ac.id]])) });
            else if (estado.base.has(id)) quitar.push(id);
          }
          if (poner.length) { const r1 = await sb.from('rol_accesos').upsert(poner, { onConflict: 'rol_id,opcion_id' }); if (r1.error) throw r1.error; }
          if (quitar.length) { const r2 = await sb.from('rol_accesos').delete().eq('rol_id', estado.rol.id).in('opcion_id', quitar); if (r2.error) throw r2.error; }
        } else {
          const poner = [], quitar = [];
          for (const [id, f] of estado.borrador) {
            if (ACCIONES.some((ac) => f[ac.id] !== null && f[ac.id] !== undefined)) poner.push({ rol_usuario_id: estado.asig.id, opcion_id: id, ...Object.fromEntries(ACCIONES.map((ac) => [ac.id, f[ac.id] ?? null])) });
            else if (estado.exc.has(id)) quitar.push(id);
          }
          if (poner.length) { const r1 = await sb.from('usuario_accesos').upsert(poner, { onConflict: 'rol_usuario_id,opcion_id' }); if (r1.error) throw r1.error; }
          if (quitar.length) { const r2 = await sb.from('usuario_accesos').delete().eq('rol_usuario_id', estado.asig.id).in('opcion_id', quitar); if (r2.error) throw r2.error; }
        }
        window.FIN.aviso('Accesos guardados');
        await cargarAccesos();
        pintar();
      } catch (e) {
        boton.disabled = false;
        window.FIN.aviso(window.UI.traducirError(e));
      }
    }

    function formRol(fila) {
      formulario({
        titulo: fila ? `Modificar rol · ${fila.nombre}` : 'Nuevo rol',
        valores: fila || { codigo: Math.max(0, ...estado.roles.map((x) => x.codigo)) + 1, activo: true, acceso_total: false },
        campos: [
          { nombre: 'codigo', etiqueta: 'Código', tipo: 'numero', requerido: true },
          { nombre: 'nombre', etiqueta: 'Rol', requerido: true, placeholder: 'Contador' },
          { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'area', ancho: 'completo' },
          { nombre: 'acceso_total', etiqueta: 'Acceso total a todo (incluye pantallas nuevas)', tipo: 'casilla', ancho: 'completo' },
          { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla' }
        ],
        alGuardar: async (d) => {
          d.nombre = d.nombre.toUpperCase();
          const res = fila ? await sb.from('roles_funcionales').update(d).eq('id', fila.id).select().single()
                           : await sb.from('roles_funcionales').insert(d).select().single();
          if (res.error) {
            if (/roles_funcionales_nombre|codigo_key/.test(res.error.message)) throw new Error('Ya existe un rol con ese código o nombre.');
            throw res.error;
          }
          const i = estado.roles.findIndex((x) => x.id === res.data.id);
          if (i >= 0) estado.roles[i] = res.data; else estado.roles.push(res.data);
          estado.roles.sort((x, y) => x.codigo - y.codigo);
          await elegirRol(res.data.id);
          window.FIN.aviso('Rol guardado');
        }
      });
    }

    function formAsignacion(fila) {
      const yaAsignados = new Set(asigDe(estado.rol.id).map((x) => x.perfil_id));
      const opciones = estado.usuarios.filter((x) => fila ? x.id === fila.perfil_id : !yaAsignados.has(x.id))
        .map((x) => ({ valor: x.id, texto: `${x.usuario || '—'} · ${x.nombre}` }));
      if (!fila && !opciones.length) { window.FIN.aviso('Todos los usuarios activos ya tienen este rol.'); return; }
      formulario({
        titulo: fila ? `Modificar asignación · ${usuario(fila.perfil_id).nombre}` : `Asignar usuario al rol ${estado.rol.nombre}`,
        valores: fila || { fecha_inicio: new Date().toISOString().slice(0, 10), estado: 'ACTIVO' },
        campos: [
          ...(fila ? [] : [{ nombre: 'perfil_id', etiqueta: 'Usuario', tipo: 'select', requerido: true, opciones, ancho: 'completo' }]),
          { nombre: 'fecha_inicio', etiqueta: 'Inicia con el rol', tipo: 'fecha', requerido: true },
          { nombre: 'fecha_fin', etiqueta: 'Termina (opcional)', tipo: 'fecha' },
          { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', requerido: true, opciones: ESTADOS.map((e) => ({ valor: e, texto: e.charAt(0) + e.slice(1).toLowerCase() })) }
        ],
        alGuardar: async (d) => {
          if (d.fecha_fin && d.fecha_fin < d.fecha_inicio) throw new Error('La fecha de fin no puede ser anterior a la de inicio.');
          if (!fila) d.rol_id = estado.rol.id;
          const res = fila ? await sb.from('rol_usuarios').update(d).eq('id', fila.id).select().single()
                           : await sb.from('rol_usuarios').insert(d).select().single();
          if (res.error) {
            if (/duplicate|unique/i.test(res.error.message)) throw new Error('Ese usuario ya tiene este rol.');
            throw res.error;
          }
          const i = estado.asignaciones.findIndex((x) => x.id === res.data.id);
          if (i >= 0) estado.asignaciones[i] = res.data; else estado.asignaciones.unshift(res.data);
          estado.asig = res.data;
          await cargarAccesos();
          pintar();
          window.FIN.aviso(fila ? 'Asignación guardada' : 'Usuario asignado');
        }
      });
    }

    const confirmarDescarte = () => !cambiosPendientes() || window.confirm('Hay cambios de accesos sin guardar. ¿Descartarlos?');

    async function elegirRol(id) {
      estado.rol = estado.roles.find((x) => x.id === id);
      estado.asig = null;
      estado.modo = 'rol';
      await cargarAccesos();
      pintar();
    }

    // ---------- Eventos ----------
    cont.addEventListener('click', async (e) => {
      const rolB = e.target.closest('[data-rol]');
      if (rolB) { if (confirmarDescarte()) await elegirRol(Number(rolB.dataset.rol)); return; }
      const modo = e.target.closest('[data-modo]');
      if (modo && !modo.disabled && modo.dataset.modo !== estado.modo) {
        if (!confirmarDescarte()) return;
        estado.modo = modo.dataset.modo;
        reiniciarBorrador();
        return pintarAccesos();
      }
      const preset = e.target.closest('[data-preset]');
      if (preset) {
        const alcance = preset.dataset.alcance;
        const ids = estado.opciones.filter((x) => alcance === 'todo' || String(x.modulo_id || 0) === alcance).map((x) => x.id);
        aplicarPreset(ids, preset.dataset.preset);
        return pintarAccesos();
      }
      const plegar = e.target.closest('[data-plegar]');
      if (plegar) {
        const k = plegar.dataset.plegar;
        if (estado.abiertos.has(k)) estado.abiertos.delete(k); else estado.abiertos.add(k);
        return pintarAccesos();
      }
      const todoP = e.target.closest('[data-plegar-todo]');
      if (todoP) {
        estado.abiertos = todoP.dataset.plegarTodo === 'abrir' ? new Set(modulosMatriz().map((x) => x.clave)) : new Set();
        return pintarAccesos();
      }
      const fila = e.target.closest('[data-fila]');
      if (fila) {
        const id = Number(fila.dataset.fila);
        const todo = ACCIONES.every((ac) => efectivo(id, ac.id));
        ACCIONES.forEach((ac) => fijar(id, ac.id, !todo));
        return pintarAccesos();
      }
      const a = e.target.closest('[data-accion]');
      if (a) {
        const ac = a.dataset.accion;
        if (ac === 'nuevo-rol') formRol();
        if (ac === 'modificar-rol') formRol(estado.rol);
        if (ac === 'asignar') formAsignacion();
        if (ac === 'guardar-accesos') guardarAccesos();
        if (ac === 'descartar') { reiniciarBorrador(); pintarAccesos(); }
        return;
      }
      const ed = e.target.closest('table[data-tabla=asignaciones] [data-editar]');
      if (ed) return formAsignacion(estado.asignaciones.find((x) => String(x.id) === ed.dataset.editar));
      const tr = e.target.closest('table[data-tabla=asignaciones] tr[data-id]');
      if (tr && (!estado.asig || Number(tr.dataset.id) !== estado.asig.id)) {
        if (!confirmarDescarte()) return;
        estado.asig = estado.asignaciones.find((x) => x.id === Number(tr.dataset.id));
        estado.modo = 'usuario';
        await cargarAccesos();
        pintarUsuarios();
        pintarAccesos();
      }
    });
    cont.addEventListener('change', (e) => {
      const celda = e.target.dataset.celda;
      if (celda) {
        const [id, ac] = celda.split('|');
        fijar(Number(id), ac, e.target.checked);
        return pintarAccesos();
      }
      // Casillas de tres estados: toda la columna del sistema o de un módulo.
      if (e.target.dataset.triTodo) {
        alternarAccion(estado.opciones.map((x) => x.id), e.target.dataset.triTodo);
        return pintarAccesos();
      }
      if (e.target.dataset.triModulo) {
        const [clave, ac] = e.target.dataset.triModulo.split('|');
        alternarAccion(estado.opciones.filter((x) => String(x.modulo_id || 0) === clave).map((x) => x.id), ac);
        return pintarAccesos();
      }
      if (e.target.matches('[data-copiar]') && e.target.value) {
        copiarDeRol(Number(e.target.value)).then(pintarAccesos);
      }
    });
    cont.addEventListener('input', (e) => {
      const restaurar = (sel) => { const el = cont.querySelector(sel); el.focus(); el.setSelectionRange(el.value.length, el.value.length); };
      if (e.target.matches('[data-buscar-rol]')) { estado.buscarRol = e.target.value; pintarRoles(); restaurar('[data-buscar-rol]'); }
      if (e.target.matches('[data-buscar-pantalla]')) { estado.buscarPantalla = e.target.value; pintarAccesos(); restaurar('[data-buscar-pantalla]'); }
    });

    // Al entrar, se abre el primer módulo de la matriz.
    const primero = modulosMatriz()[0];
    if (primero) estado.abiertos.add(primero.clave);
    await cargarAccesos();
    pintar();
  };
})();
