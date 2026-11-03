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
      rol: null, asig: null, modo: 'rol', filtroModulo: '', buscarRol: '', buscarPantalla: '',
      base: new Map(), exc: new Map(), borrador: null
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
    const nombreModulo = (op) => op.modulo ? op.modulo.descripcion : 'COMÚN A TODOS LOS MÓDULOS';

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
              <span class="rm-rol-nombre">${esc(x.nombre)}${x.activo ? '' : ' <small>(inactivo)</small>'}</span>
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
            <h2>${esc(rol.nombre)} <small>· código ${rol.codigo}</small></h2>
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

    function pintarAccesos() {
      const rol = estado.rol;
      if (!rol) { pAcc.innerHTML = ''; return; }
      const q = estado.buscarPantalla.trim().toLowerCase();
      const modulos = [...new Map(estado.opciones.map((x) => [x.modulo_id || 0, x.modulo ? `${x.modulo.siglas} · ${x.modulo.descripcion}` : 'Comunes'])).entries()];
      const visibles = estado.opciones.filter((x) =>
        (estado.filtroModulo === '' || String(x.modulo_id || 0) === estado.filtroModulo) &&
        (!q || x.nombre.toLowerCase().includes(q)));
      const usuarioSel = estado.asig ? usuario(estado.asig.perfil_id) : null;
      const conAcceso = estado.opciones.filter((x) => efectivo(x.id, 'ver')).length;
      let grupoActual = '';
      pAcc.innerHTML = `
        <div class="panel-cab">
          <h2>Matriz de accesos</h2>
          <div class="segmentado" role="tablist">
            <button type="button" role="tab" class="${estado.modo === 'rol' ? 'activo' : ''}" data-modo="rol" aria-selected="${estado.modo === 'rol'}">Permisos del rol</button>
            <button type="button" role="tab" class="${estado.modo === 'usuario' ? 'activo' : ''}" data-modo="usuario" aria-selected="${estado.modo === 'usuario'}" ${usuarioSel ? '' : 'disabled title="Elige un usuario del rol"'}>Accesos de ${usuarioSel ? esc(usuarioSel.usuario || usuarioSel.nombre) : 'usuario'}</button>
          </div>
        </div>
        <p class="rm-ayuda">${estado.modo === 'rol'
          ? `Lo que marques aquí lo heredan todos los usuarios con el rol <b>${esc(rol.nombre)}</b>. ${conAcceso} de ${estado.opciones.length} pantallas con acceso.`
          : `Accesos finales de <b>${esc(usuarioSel.nombre)}</b>: los del rol más sus excepciones. Las celdas <span class="excepcion-muestra">resaltadas</span> son excepciones; al dejarlas igual que el rol vuelven a heredarse.`}</p>
        <div class="rm-filtros">
          <label class="selector-org">Módulo <select data-filtro-modulo>
            <option value="">Todos</option>
            ${modulos.map(([id, n]) => `<option value="${id}" ${String(id) === estado.filtroModulo ? 'selected' : ''}>${esc(n)}</option>`).join('')}
          </select></label>
          <input type="search" class="buscar" data-buscar-pantalla placeholder="Buscar pantalla" value="${esc(estado.buscarPantalla)}">
        </div>
        <div class="tabla-desplazable rm-matriz">
          <table class="tabla catalogo matriz">
            <thead><tr>
              <th>Pantalla</th>
              ${ACCIONES.map((ac) => `<th class="centrada"><button type="button" class="col-todo" data-columna="${ac.id}" ${editable ? '' : 'disabled'} title="Marcar o quitar en las pantallas visibles">${ac.nombre}</button></th>`).join('')}
            </tr></thead>
            <tbody>
              ${visibles.map((op) => {
                const g = `${op.modulo_id || 0}|${op.grupo}`;
                const cab = g !== grupoActual ? `<tr class="grupo-matriz"><td colspan="${ACCIONES.length + 1}">${esc(nombreModulo(op))} · ${GRUPO_NOMBRE[op.grupo]}${op.subgrupo ? ` · ${esc(op.subgrupo)}` : ''}</td></tr>` : '';
                grupoActual = g;
                return cab + `
                  <tr data-op="${op.id}">
                    <td><button type="button" class="fila-todo" data-fila="${op.id}" ${editable ? '' : 'disabled'} title="Marcar o quitar toda la fila">${esc(op.nombre)}</button></td>
                    ${ACCIONES.map((ac) => `<td class="centrada ${esExcepcion(op.id, ac.id) ? 'excepcion' : ''}"><input type="checkbox" data-celda="${op.id}|${ac.id}" ${efectivo(op.id, ac.id) ? 'checked' : ''} ${editable ? '' : 'disabled'} aria-label="${ac.nombre} ${esc(op.nombre)}"></td>`).join('')}
                  </tr>`;
              }).join('') || `<tr><td colspan="${ACCIONES.length + 1}" class="vacio">Sin pantallas con este filtro.</td></tr>`}
            </tbody>
          </table>
        </div>
        ${editable ? (() => {
          const n = cambiosPendientes();
          return `
          <div class="barra-guardar rm-guardar">
            <span class="rm-cambios ${n ? 'pendientes' : ''}">${n ? `${n} pantalla${n === 1 ? '' : 's'} con cambios sin guardar` : 'Sin cambios'}</span>
            <button type="button" class="boton secundario-sm" data-accion="descartar" ${n ? '' : 'disabled'}>Descartar</button>
            <button type="button" class="boton primario-sm" data-accion="guardar-accesos" ${n ? '' : 'disabled'}>Guardar accesos</button>
          </div>`;
        })() : ''}`;
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
        valores: fila || { codigo: Math.max(0, ...estado.roles.map((x) => x.codigo)) + 10, activo: true },
        campos: [
          { nombre: 'codigo', etiqueta: 'Código', tipo: 'numero', requerido: true },
          { nombre: 'nombre', etiqueta: 'Rol', requerido: true, placeholder: 'Contador' },
          { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'area', ancho: 'completo' },
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
      const col = e.target.closest('[data-columna]');
      if (col) {
        const ids = [...pAcc.querySelectorAll('tr[data-op]')].map((tr) => Number(tr.dataset.op));
        const todos = ids.every((id) => efectivo(id, col.dataset.columna));
        ids.forEach((id) => fijar(id, col.dataset.columna, !todos));
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
      if (e.target.matches('[data-filtro-modulo]')) { estado.filtroModulo = e.target.value; pintarAccesos(); }
    });
    cont.addEventListener('input', (e) => {
      const restaurar = (sel) => { const el = cont.querySelector(sel); el.focus(); el.setSelectionRange(el.value.length, el.value.length); };
      if (e.target.matches('[data-buscar-rol]')) { estado.buscarRol = e.target.value; pintarRoles(); restaurar('[data-buscar-rol]'); }
      if (e.target.matches('[data-buscar-pantalla]')) { estado.buscarPantalla = e.target.value; pintarAccesos(); restaurar('[data-buscar-pantalla]'); }
    });

    await cargarAccesos();
    pintar();
  };
})();
