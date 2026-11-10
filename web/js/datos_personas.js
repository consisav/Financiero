// Administración · Registros · Datos Personas (script 182): la ficha general de datos de una persona por organización,
// para referenciarla desde otras pantallas (clientes, empleados, pacientes, proveedores y médicos).
//   Diseño en tarjetas, todo a la vista: encabezado (tipo, código, centro de costo, nombres y apellidos), datos generales,
//   identificación, dirección de casa y teléfonos, información laboral, crédito y cuenta contable, nombres por separado
//   y contactos.
//   Ayudas: edad calculada; el DPI (CUI) se valida con su dígito verificador y de él salen el departamento y el municipio
//   de extensión; el NIT se valida (módulo 11); los nombres y apellidos se separan solos; avisa si ya existe una persona
//   con el mismo DPI, NIT o nombre; muestra los clientes de la empresa con el mismo NIT o DPI.
//   window.PERSONAS: abrir(id), buscar(texto) y etiqueta(persona), para usar la ficha desde otras pantallas.
(function () {
  const { esc } = window.UI;
  const { montar } = window.BANCOS;
  window.PANTALLAS = window.PANTALLAS || {};
  const AVISO = 'Falta ejecutar en Supabase el script 182 (Datos Personas).';
  const sinTabla = (e) => e && /personas/.test(e.message || '') && /exist|schema cache|relation/i.test(e.message || '');
  const ESTADOS_CIVILES = ['SOLTERO', 'CASADO', 'UNIDO', 'DIVORCIADO', 'VIUDO'];
  const TIPOS_TEL = ['CELULAR', 'CASA', 'TRABAJO', 'OTRO'];
  const etiqueta = (p) => `${[p.nombres, p.apellidos].filter(Boolean).join(' ')}${p.dpi ? ` · DPI ${p.dpi}` : p.nit ? ` · NIT ${p.nit}` : ''} — ${p.codigo}`;
  const iniciales = (p) => (`${(p.nombres || '').trim()[0] || ''}${(p.apellidos || '').trim()[0] || (p.nombres || '').trim().split(/\s+/)[1]?.[0] || ''}` || '?').toUpperCase();
  const edadDe = (f) => {
    if (!f) return '';
    const n = new Date(`${f}T00:00:00`), h = new Date();
    let a = h.getFullYear() - n.getFullYear();
    if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a -= 1;
    return a >= 0 && a < 130 ? a : '';
  };
  // CUI (DPI): 13 dígitos = 8 de número + verificador + 2 de departamento + 2 de municipio.
  function validarDpi(v) {
    const d = String(v || '').replace(/\D/g, '');
    if (!d) return { ok: true, vacio: true };
    if (d.length !== 13) return { ok: false, msg: `El DPI tiene ${d.length} dígitos; debe tener 13.` };
    const suma = [...d.slice(0, 8)].reduce((s, c, i) => s + Number(c) * (i + 2), 0);
    if (suma % 11 !== Number(d[8])) return { ok: false, msg: 'El dígito verificador del DPI no coincide: revísalo.' };
    const depto = Number(d.slice(9, 11)), muni = Number(d.slice(11, 13));
    if (!depto || depto > 22 || !muni) return { ok: false, msg: 'El DPI no trae un departamento o municipio válido.' };
    return { ok: true, depto, muni };
  }
  // NIT de Guatemala: número + verificador (0-9 o K), módulo 11. CF = consumidor final.
  function validarNit(v) {
    const s = String(v || '').toUpperCase().replace(/[\s-]/g, '');
    if (!s || s === 'CF' || s === 'C/F') return true;
    if (!/^\d+[\dK]$/.test(s)) return false;
    const cuerpo = s.slice(0, -1), ver = s.slice(-1);
    const suma = [...cuerpo].reverse().reduce((t, c, i) => t + Number(c) * (i + 2), 0);
    const r = (11 - (suma % 11)) % 11;
    return ver === (r === 10 ? 'K' : String(r));
  }
  const partes = (texto) => { const p = String(texto || '').trim().toUpperCase().split(/\s+/).filter(Boolean); return [p[0] || '', p.slice(1).join(' ')]; };

  window.PERSONAS = {
    etiqueta,
    abrir: (id) => { location.hash = `#/administracion/datos-personas/${id || ''}`; },
    async buscar(texto, organizacionId) {
      const sb = window.FIN.sb;
      const t = String(texto || '').trim().replace(/[%,()]/g, ' ');
      let q = sb.from('personas').select('id, codigo, nombres, apellidos, dpi, nit, tipo_id, telefonos, correo, organizacion_id').eq('activo', true).limit(25);
      if (organizacionId) q = q.eq('organizacion_id', organizacionId);
      if (t) q = q.or(`nombres.ilike.%${t}%,apellidos.ilike.%${t}%,dpi.ilike.%${t}%,nit.ilike.%${t}%`);
      const r = await q.order('nombres');
      return r.data || [];
    }
  };

  window.PANTALLAS['datos-personas'] = function (cont, m, extra) {
    const ctx = montar(cont, { titulo: 'Datos Personas', icono: 'ti-id', clase: 'bk-movimientos bm-solo dp-pantalla', grupo: 'Registros' });
    const { sb } = ctx;
    const est = { personas: [], cat: [], paises: [], deptos: [], munis: [], cuentas: [], p: null, clientes: [], cargada: null, cambios: false };
    const vacia = () => ({ id: null, codigo: null, tipo_id: est.cat.find((c) => c.tipo === 'TIPO')?.id || null, nombres: '', apellidos: '', telefonos: [{ numero: '', tipo: 'CELULAR', ext: '', area: '' }], contactos: [], activo: true, nacionalidad: 'GUATEMALTECA', pais_id: est.paises.find((x) => x.iso2 === 'GT')?.id || null, mostrar_entre_companias: false });
    const catDe = (tipo) => est.cat.filter((c) => c.tipo === tipo && c.activo !== false);
    const deptoPorCodigo = (cod, paisId) => est.deptos.find((d) => d.codigo === cod && (!paisId || d.pais_id === paisId));
    const muniPorCodigo = (deptoId, cod) => est.munis.find((x) => x.departamento_id === deptoId && (x.codigo === cod || x.codigo % 100 === cod));

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      const [pa, de, mu] = await Promise.all([
        sb.from('paises').select('id, codigo, nombre, iso2').eq('activo', true).order('nombre'),
        sb.from('departamentos').select('id, pais_id, codigo, nombre').order('codigo'),
        window.UI.todo(sb.from('municipios').select('id, departamento_id, codigo, nombre').order('codigo'))
      ]);
      est.paises = pa.data || []; est.deptos = de.data || []; est.munis = mu.data || [];
      await cargarOrg(extra ? Number(extra) : null);
    }

    async function cargarOrg(abrirId) {
      const org = ctx.sel.org;
      const [c, p] = await Promise.all([
        sb.from('personas_catalogos').select('*').eq('organizacion_id', org).order('tipo').order('codigo'),
        window.UI.todo(sb.from('personas').select('id, codigo, nombres, apellidos, dpi, nit, tipo_id, activo').eq('organizacion_id', org).order('codigo'))
      ]);
      if (c.error || p.error) {
        const err = c.error || p.error;
        ctx.pDet.innerHTML = `<p class="vacio">${esc(sinTabla(err) ? AVISO : window.UI.traducirError(err))}</p>`;
        pintarFiltros();
        return;
      }
      est.cat = c.data || []; est.personas = p.data || [];
      await cargarCuentas();
      if (abrirId) await abrir(abrirId); else { est.p = vacia(); est.clientes = []; pintar(); }
    }

    // Cuentas contables de movimiento del catálogo activo de la localidad elegida.
    async function cargarCuentas() {
      est.cuentas = [];
      if (!ctx.sel.loc) return;
      const k = await sb.from('catalogos_cuentas').select('id').eq('localidad_id', ctx.sel.loc).eq('activo', true).order('version', { ascending: false }).limit(1);
      const cat = k.data?.[0]?.id;
      if (!cat) return;
      const r = await window.UI.todo(sb.from('cuentas').select('id, codigo, nombre, integra, vigente').eq('catalogo_id', cat).eq('vigente', true).order('codigo'));
      est.cuentas = (r.data || []).filter((x) => !x.integra || String(x.codigo).length >= 8);
    }

    async function abrir(id) {
      const r = await sb.from('personas').select('*').eq('id', id).maybeSingle();
      // Persona de otra organización (enlace desde otra pantalla): se cambia a su organización.
      if (r.data && r.data.organizacion_id !== ctx.sel.org && ctx.organizaciones.some((o) => o.id === r.data.organizacion_id)) {
        ctx.sel.org = r.data.organizacion_id;
        ctx.sel.loc = ctx.localidades.find((x) => x.id === r.data.localidad_id)?.id || ctx.localidades.find((x) => x.organizacion_id === ctx.sel.org)?.id || null;
        return cargarOrg(id);
      }
      if (r.error || !r.data) { window.FIN.aviso(r.error ? window.UI.traducirError(r.error) : 'No se encontró la persona.'); est.p = vacia(); }
      else est.p = { ...r.data, telefonos: (r.data.telefonos || []).length ? r.data.telefonos : [{ numero: '', tipo: 'CELULAR', ext: '', area: '' }], contactos: r.data.contactos || [] };
      est.cambios = false;
      pintar();
      clientesAsociados();
    }

    function pintarFiltros() {
      const orgs = ctx.organizaciones, locs = ctx.localidades.filter((x) => x.organizacion_id === ctx.sel.org);
      const b = (accion, icono, texto, clase = 'secundario-sm') => `<button type="button" class="boton ${clase}" data-accion="${accion}"><i class="ti ${icono}" aria-hidden="true"></i> ${texto}</button>`;
      ctx.pFil.innerHTML = `
        <div class="ta-titulo"><span class="tk-icono"><i class="ti ti-id" aria-hidden="true"></i></span><div><small>Registros</small><h2>Datos Personas</h2></div></div>
        <label class="campo"><span>Organización</span><select name="org">${orgs.map((o) => `<option value="${o.id}" ${o.id === ctx.sel.org ? 'selected' : ''}>${esc(String(o.codigo))} · ${esc(o.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Localidad (cuentas contables)</span><select name="loc">${locs.map((l) => `<option value="${l.id}" ${l.id === ctx.sel.loc ? 'selected' : ''}>${esc(l.codigo)} · ${esc(l.nombre_comercial)}</option>`).join('')}</select></label>
        <label class="campo dp-buscar"><span>Buscar persona (${est.personas.length})</span><input name="buscar" list="dp-personas" placeholder="Nombre, apellido, DPI, NIT o código" autocomplete="off">
          <datalist id="dp-personas">${est.personas.map((p) => `<option ${p.activo ? '' : 'label="Inactiva" '}value="${esc(etiqueta(p))}"></option>`).join('')}</datalist></label>
        <div class="oc-extra dp-acciones">${b('nueva', 'ti-user-plus', 'Nueva persona')}${est.p?.id ? b('activo', est.p.activo ? 'ti-user-off' : 'ti-user-check', est.p.activo ? 'Desactivar' : 'Activar') : ''}${b('guardar', 'ti-device-floppy', 'Guardar', 'primario-sm')}</div>`;
    }

    const v = (k) => esc(est.p?.[k] ?? '');
    const sel = (name, opciones, actual, vacio = '—') => `<select name="${name}"><option value="">${vacio}</option>${opciones.map(([val, txt]) => `<option value="${val}" ${String(val) === String(actual ?? '') ? 'selected' : ''}>${esc(txt)}</option>`).join('')}</select>`;
    const fila = (etq, control, clase = '') => `<label class="dp-f ${clase}"><span>${etq}</span>${control}</label>`;
    const inp = (name, extra = '') => `<input name="${name}" value="${v(name)}" ${extra}>`;

    function pintar() {
      pintarFiltros();
      const p = est.p;
      const tipo = est.cat.find((c) => c.id === p.tipo_id);
      const edad = edadDe(p.fecha_nacimiento);
      const dpi = validarDpi(p.dpi), nitOk = validarNit(p.nit);
      const deptosDe = (paisId) => est.deptos.filter((d) => !paisId || d.pais_id === paisId);
      const munisDe = (deptoId) => est.munis.filter((x) => x.departamento_id === deptoId);
      const gt = est.paises.find((x) => x.iso2 === 'GT')?.id;
      const dup = duplicados();
      ctx.pDet.innerHTML = `
        <form class="dp" autocomplete="off" novalidate>
          <section class="dp-cab">
            <div class="dp-avatar" aria-hidden="true">${esc(iniciales(p))}</div>
            <div class="dp-cab-campos">
              ${fila('Tipo de persona', sel('tipo_id', catDe('TIPO').map((c) => [c.id, `${c.codigo} · ${c.nombre}`]), p.tipo_id, 'Elegir'), 'dp-tipo')}
              ${fila('Código', `<input value="${p.codigo || 'Nuevo'}" readonly tabindex="-1">`, 'dp-cod')}
              ${fila('Centro de costo', inp('centro_costo'), 'dp-cc')}
              ${fila('Nombres', inp('nombres', 'required placeholder="Juan Manuel"'), 'dp-nom')}
              ${fila('Apellidos', inp('apellidos', 'placeholder="Saquich Xicara"'), 'dp-ape')}
            </div>
            <div class="dp-sellos">
              ${tipo ? `<span class="dp-sello azul">${esc(tipo.nombre)}</span>` : ''}
              <span class="dp-sello ${p.activo ? 'verde' : 'gris'}">${p.activo ? 'Activa' : 'Inactiva'}</span>
              ${edad !== '' ? `<span class="dp-sello">${edad} años</span>` : ''}
              ${p.creado_en || p.persona_anterior ? `<small>${[p.persona_anterior ? `<span title="Empresa y código en el sistema anterior">Anterior ${esc(p.persona_anterior.length > 34 ? `${p.persona_anterior.slice(0, 34)}…` : p.persona_anterior)}</span>` : '', p.creado_en ? `Ingreso ${esc(window.UI.fecha(p.creado_en))} ${esc(p.creado_por_nombre || '')}${p.modificado_en ? ` · Actualización ${esc(window.UI.fecha(p.modificado_en))} ${esc(p.modificado_por_nombre || '')}` : ''}` : ''].filter(Boolean).join(' · ')}</small>` : ''}
            </div>
          </section>
          ${dup.length ? `<div class="dp-aviso"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Ya existe ${dup.map((x) => `<button type="button" class="dp-link" data-abrir="${x.p.id}">${esc(etiqueta(x.p))}</button> <em>(mismo ${x.por})</em>`).join(', ')}.</div>` : ''}
          <div class="dp-grid">
            <section class="dp-card">
              <h3><i class="ti ti-user" aria-hidden="true"></i> Datos generales</h3>
              ${fila('Facturar a', inp('facturar_a', `placeholder="${esc([p.nombres, p.apellidos].filter(Boolean).join(' ') || 'Nombre completo')}"`))}
              <div class="dp-2">${fila('Vendedor', inp('vendedor'))}${fila('Zona de venta', inp('zona_venta'))}</div>
              ${fila('Dirección factura', inp('direccion_facturacion'))}
              <div class="dp-2 dp-2b">${fila('Dirección cobro', inp('direccion_cobro'))}${fila('Zona', `<input name="zona" type="number" min="0" max="25" value="${v('zona')}">`)}</div>
              <div class="dp-2">${fila('Fecha de nacimiento', `<input type="date" name="fecha_nacimiento" value="${v('fecha_nacimiento')}">`)}${fila('Edad', `<input value="${edad}" readonly tabindex="-1">`)}</div>
              <div class="dp-2">${fila('Nacionalidad', inp('nacionalidad'))}${fila(`NIT ${p.nit && !nitOk ? '<b class="dp-mal">no válido</b>' : ''}`, inp('nit', 'placeholder="4751663 o CF"'), p.nit && !nitOk ? 'dp-error' : '')}</div>
              <div class="dp-2">${fila('Escolaridad', sel('escolaridad_id', catDe('ESCOLARIDAD').map((c) => [c.id, `${c.codigo} · ${c.nombre}`]), p.escolaridad_id))}${fila('Estado civil', sel('estado_civil', ESTADOS_CIVILES.map((x) => [x, x]), p.estado_civil))}</div>
              <div class="dp-2">${fila('Profesión', sel('profesion_id', catDe('PROFESION').map((c) => [c.id, `${c.codigo} · ${c.nombre}`]), p.profesion_id))}${fila('Sexo', sel('sexo', [['MASCULINO', 'Masculino'], ['FEMENINO', 'Femenino']], p.sexo))}</div>
              ${fila('Correo', `<input type="email" name="correo" value="${v('correo')}" placeholder="nombre@empresa.com">`)}
            </section>

            <section class="dp-card">
              <h3><i class="ti ti-id-badge-2" aria-hidden="true"></i> Documento de identificación</h3>
              ${fila(`DPI ${p.dpi ? (dpi.ok ? '<b class="dp-bien"><i class="ti ti-circle-check" aria-hidden="true"></i> válido</b>' : '<b class="dp-mal">revisar</b>') : ''}`, inp('dpi', 'inputmode="numeric" placeholder="13 dígitos"'), dpi.ok ? '' : 'dp-error')}
              ${!dpi.ok ? `<p class="dp-nota mal">${esc(dpi.msg)}</p>` : ''}
              <div class="dp-2">${fila('Departamento', sel('dpi_departamento_id', deptosDe(gt).map((d) => [d.id, d.nombre]), p.dpi_departamento_id))}${fila('Municipio', sel('dpi_municipio_id', munisDe(p.dpi_departamento_id).map((x) => [x.id, x.nombre]), p.dpi_municipio_id))}</div>
              <h3 class="dp-sub"><i class="ti ti-home" aria-hidden="true"></i> Dirección de casa</h3>
              <div class="dp-2">${fila('País', sel('pais_id', est.paises.map((x) => [x.id, x.nombre]), p.pais_id))}${fila('Departamento', sel('departamento_id', deptosDe(p.pais_id).map((d) => [d.id, d.nombre]), p.departamento_id))}</div>
              <div class="dp-2">${fila('Municipio', sel('municipio_id', munisDe(p.departamento_id).map((x) => [x.id, x.nombre]), p.municipio_id))}${fila('Aldea', inp('aldea'))}</div>
              ${fila('Dirección', inp('direccion'))}
              <h3 class="dp-sub"><i class="ti ti-phone" aria-hidden="true"></i> Teléfonos <button type="button" class="dp-mas" data-accion="tel-mas" title="Agregar teléfono" aria-label="Agregar teléfono"><i class="ti ti-plus" aria-hidden="true"></i></button></h3>
              <table class="dp-tels"><thead><tr><th>#</th><th>Teléfono</th><th>Tipo</th><th>Ext.</th><th>Área</th><th></th></tr></thead><tbody>
                ${p.telefonos.map((t, i) => `<tr data-tel="${i}"><td>${i + 1}</td><td><input name="tel-numero" value="${esc(t.numero || '')}" inputmode="tel"></td>
                  <td><select name="tel-tipo">${TIPOS_TEL.map((x) => `<option ${x === t.tipo ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
                  <td><input name="tel-ext" value="${esc(t.ext || '')}"></td><td><input name="tel-area" value="${esc(t.area || '')}"></td>
                  <td><button type="button" class="dp-quitar" data-quitar-tel="${i}" aria-label="Quitar teléfono ${i + 1}"><i class="ti ti-x" aria-hidden="true"></i></button></td></tr>`).join('')}
              </tbody></table>
              <h3 class="dp-sub"><i class="ti ti-address-book" aria-hidden="true"></i> Contactos y clientes asociados <button type="button" class="dp-mas" data-accion="contacto-mas" title="Agregar contacto" aria-label="Agregar contacto"><i class="ti ti-plus" aria-hidden="true"></i></button></h3>
              ${p.contactos.map((c, i) => `<div class="dp-contacto" data-contacto="${i}"><input name="con-nombre" value="${esc(c.nombre || '')}" placeholder="Nombre"><input name="con-parentesco" value="${esc(c.parentesco || '')}" placeholder="Parentesco"><input name="con-telefono" value="${esc(c.telefono || '')}" placeholder="Teléfono"><button type="button" class="dp-quitar" data-quitar-contacto="${i}" aria-label="Quitar contacto"><i class="ti ti-x" aria-hidden="true"></i></button></div>`).join('')}
              <div class="dp-asociados">${est.clientes.length ? est.clientes.map((c) => `<span class="dp-sello azul" title="${esc(c.localidad || '')}"><i class="ti ti-building-store" aria-hidden="true"></i> ${esc(c.codigo)} · ${esc(c.nombre)}</span>`).join('') : `<small>${p.nit || p.dpi ? 'Sin clientes con el mismo NIT o DPI en la organización.' : 'Escribe el NIT o el DPI para ver los clientes asociados.'}</small>`}</div>
            </section>

            <section class="dp-card">
              <h3><i class="ti ti-briefcase" aria-hidden="true"></i> Información laboral</h3>
              <div class="dp-2 dp-2b">${fila('Empresa', inp('empresa_labora'))}${fila('Años', `<input name="tiempo_laborar" type="number" min="0" max="80" value="${v('tiempo_laborar')}">`)}</div>
              ${fila('Dirección', inp('direccion_laboral'))}
              <div class="dp-2">${fila('Ingresos Q', `<input name="ingresos" type="number" step="0.01" min="0" value="${v('ingresos')}" class="num">`)}${fila('Puesto', inp('puesto'))}</div>
              <div class="dp-2">${fila('Otros ingresos Q', `<input name="otros_ingresos" type="number" step="0.01" min="0" value="${v('otros_ingresos')}" class="num">`)}${fila('Concepto', inp('concepto_otros_ingresos'))}</div>
              <label class="dp-check"><input type="checkbox" name="mostrar_entre_companias" ${p.mostrar_entre_companias ? 'checked' : ''}> Mostrar en el reporte «Entre compañías»</label>
              <h3 class="dp-sub"><i class="ti ti-calculator" aria-hidden="true"></i> Crédito y cuenta contable</h3>
              ${fila('Cuenta contable', `<input name="cuenta" list="dp-cuentas" value="${esc(p.cuenta_codigo ? `${p.cuenta_codigo}${est.cuentas.find((c) => c.codigo === p.cuenta_codigo) ? ` · ${est.cuentas.find((c) => c.codigo === p.cuenta_codigo).nombre}` : ''}` : '')}" placeholder="Código o nombre de la cuenta"><datalist id="dp-cuentas">${est.cuentas.map((c) => `<option value="${esc(`${c.codigo} · ${c.nombre}`)}"></option>`).join('')}</datalist>`)}
              <div class="dp-2">${fila('Días de crédito', `<input name="dias_credito" type="number" min="0" value="${v('dias_credito')}">`)}${fila('Límite de crédito Q', `<input name="limite_credito" type="number" step="0.01" min="0" value="${v('limite_credito')}" class="num">`)}</div>
              <h3 class="dp-sub"><i class="ti ti-forms" aria-hidden="true"></i> Nombres por separado</h3>
              <div class="dp-2 dp-4">${fila('1er nombre', inp('primer_nombre'))}${fila('2do nombre', inp('segundo_nombre'))}${fila('1er apellido', inp('primer_apellido'))}${fila('2do apellido', inp('segundo_apellido'))}</div>
              ${fila('Apellido de casada', inp('apellido_casada'))}
              ${fila('Observaciones', inp('observaciones'))}
            </section>
          </div>
        </form>`;
      ctx.ajustarAlto();
    }

    // Personas con el mismo DPI, NIT o nombre completo (sin contar la abierta).
    function duplicados() {
      const p = est.p, out = [];
      const nom = (x) => `${x.nombres || ''} ${x.apellidos || ''}`.trim().toUpperCase().replace(/\s+/g, ' ');
      const dpi = String(p.dpi || '').replace(/\D/g, ''), nit = String(p.nit || '').toUpperCase().replace(/[\s-]/g, '');
      for (const x of est.personas) {
        if (x.id === p.id) continue;
        if (dpi && x.dpi === dpi) out.push({ p: x, por: 'DPI' });
        else if (nit && !['CF', 'C/F'].includes(nit) && (x.nit || '').toUpperCase() === nit) out.push({ p: x, por: 'NIT' });
        else if (nom(p).length > 5 && nom(x) === nom(p)) out.push({ p: x, por: 'nombre' });
      }
      return out.slice(0, 3);
    }

    async function clientesAsociados() {
      const p = est.p;
      est.clientes = [];
      const nit = String(p.nit || '').toUpperCase().replace(/[\s-]/g, ''), dpi = String(p.dpi || '').replace(/\D/g, '');
      const docs = [nit && !['CF', 'C/F'].includes(nit) ? nit : null, dpi || null].filter(Boolean);
      if (docs.length) {
        const r = await sb.from('clientes').select('id, codigo, nombre, documento, localidad_id').eq('organizacion_id', ctx.sel.org).in('documento', docs).limit(10);
        est.clientes = (r.data || []).map((c) => ({ ...c, localidad: ctx.localidad(c.localidad_id)?.nombre_comercial }));
      }
      const caja = ctx.pDet.querySelector('.dp-asociados');
      if (caja) caja.innerHTML = est.clientes.length ? est.clientes.map((c) => `<span class="dp-sello azul" title="${esc(c.localidad || '')}"><i class="ti ti-building-store" aria-hidden="true"></i> ${esc(c.codigo)} · ${esc(c.nombre)}</span>`).join('') : `<small>${docs.length ? 'Sin clientes con el mismo NIT o DPI en la organización.' : 'Escribe el NIT o el DPI para ver los clientes asociados.'}</small>`;
    }

    // Lee el formulario a est.p (sin volver a pintar).
    function leer() {
      const f = ctx.pDet.querySelector('form.dp');
      if (!f) return;
      const p = est.p;
      const num = (x) => (x === '' || x == null ? null : Number(x));
      f.querySelectorAll('input[name], select[name]').forEach((el) => {
        const n = el.name;
        if (/^(tel|con)-|^cuenta$/.test(n)) return;
        if (el.type === 'checkbox') p[n] = el.checked;
        else if (/_id$/.test(n) || ['zona', 'tiempo_laborar', 'dias_credito'].includes(n)) p[n] = num(el.value);
        else if (['ingresos', 'otros_ingresos', 'limite_credito'].includes(n)) p[n] = num(el.value);
        else p[n] = el.value.trim() || null;
      });
      p.telefonos = [...f.querySelectorAll('[data-tel]')].map((tr) => ({ numero: tr.querySelector('[name=tel-numero]').value.trim(), tipo: tr.querySelector('[name=tel-tipo]').value, ext: tr.querySelector('[name=tel-ext]').value.trim(), area: tr.querySelector('[name=tel-area]').value.trim() }));
      p.contactos = [...f.querySelectorAll('[data-contacto]')].map((d) => ({ nombre: d.querySelector('[name=con-nombre]').value.trim(), parentesco: d.querySelector('[name=con-parentesco]').value.trim(), telefono: d.querySelector('[name=con-telefono]').value.trim() }));
      const cta = (f.querySelector('[name=cuenta]')?.value || '').trim();
      const cod = cta.split('·')[0].trim();
      const c = est.cuentas.find((x) => x.codigo === cod) || est.cuentas.find((x) => `${x.codigo} · ${x.nombre}` === cta);
      p.cuenta_codigo = c ? c.codigo : (cod || null);
      p.cuenta_id = c ? c.id : null;
    }

    // Ayudas al escribir: separa nombres, decodifica el DPI y limpia el municipio al cambiar el departamento.
    function inteligente(campo) {
      const p = est.p;
      if (campo === 'nombres') { const [a, b] = partes(p.nombres); p.primer_nombre = a || null; p.segundo_nombre = b || null; }
      if (campo === 'apellidos') { const [a, b] = partes(p.apellidos); p.primer_apellido = a || null; p.segundo_apellido = b || null; }
      if (campo === 'dpi') {
        const d = validarDpi(p.dpi);
        const gt = est.paises.find((x) => x.iso2 === 'GT')?.id;
        if (d.ok && d.depto) {
          const dep = deptoPorCodigo(d.depto, gt);
          if (dep) { p.dpi_departamento_id = dep.id; p.dpi_municipio_id = muniPorCodigo(dep.id, d.muni)?.id || null; }
        }
      }
      if (campo === 'dpi_departamento_id') p.dpi_municipio_id = null;
      if (campo === 'pais_id') { p.departamento_id = null; p.municipio_id = null; }
      if (campo === 'departamento_id') p.municipio_id = null;
    }

    async function guardar() {
      leer();
      const p = est.p;
      if (!p.nombres) return window.FIN.aviso('Escribe los nombres de la persona.');
      const d = validarDpi(p.dpi);
      if (!d.ok) return window.FIN.aviso(d.msg);
      if (p.nit && !validarNit(p.nit) && !confirm(`El NIT ${p.nit} no pasa la validación. ¿Guardarlo de todos modos?`)) return;
      // El DPI no se repite; el NIT puede compartirse (familias, empresas): solo se confirma.
      const dup = duplicados();
      const porDpi = dup.find((x) => x.por === 'DPI');
      if (porDpi) return window.FIN.aviso(`Ya existe ${etiqueta(porDpi.p)} con el mismo DPI.`);
      const porNit = dup.find((x) => x.por === 'NIT');
      if (porNit && !confirm(`${etiqueta(porNit.p)} ya tiene el NIT ${p.nit}. ¿Guardar de todos modos?`)) return;
      const datos = { ...p };
      ['id', 'codigo', 'creado_por', 'creado_por_nombre', 'creado_en', 'modificado_por', 'modificado_por_nombre', 'modificado_en'].forEach((k) => delete datos[k]);
      datos.organizacion_id = ctx.sel.org;
      datos.localidad_id = ctx.sel.loc || null;
      datos.telefonos = (p.telefonos || []).filter((t) => t.numero);
      datos.contactos = (p.contactos || []).filter((c) => c.nombre || c.telefono);
      const r = p.id ? await sb.from('personas').update(datos).eq('id', p.id).select().single() : await sb.from('personas').insert(datos).select().single();
      if (r.error) {
        const m = r.error.message || '';
        return window.FIN.aviso(sinTabla(r.error) ? AVISO : /personas_dpi/.test(m) ? 'Ya existe una persona con ese DPI en la organización.' : /personas_nit/.test(m) ? 'Ya existe una persona con ese NIT en la organización.' : window.UI.traducirError(r.error));
      }
      window.FIN.aviso(`${p.id ? 'Datos guardados' : 'Persona creada'}: ${etiqueta(r.data)}`);
      const i = est.personas.findIndex((x) => x.id === r.data.id);
      const corta = { id: r.data.id, codigo: r.data.codigo, nombres: r.data.nombres, apellidos: r.data.apellidos, dpi: r.data.dpi, nit: r.data.nit, tipo_id: r.data.tipo_id, activo: r.data.activo };
      if (i >= 0) est.personas[i] = corta; else est.personas.push(corta);
      history.replaceState(null, '', `#/administracion/datos-personas/${r.data.id}`);
      await abrir(r.data.id);
    }

    ctx.pFil.addEventListener('change', async (e) => {
      const n = e.target.name;
      if (n === 'org') { ctx.sel.org = Number(e.target.value); ctx.sel.loc = ctx.localidades.find((x) => x.organizacion_id === ctx.sel.org)?.id || null; return cargarOrg(); }
      if (n === 'loc') { ctx.sel.loc = Number(e.target.value); leer(); await cargarCuentas(); return pintar(); }
      if (n === 'buscar') {
        const val = e.target.value.trim();
        const p = est.personas.find((x) => etiqueta(x) === val) || est.personas.find((x) => String(x.codigo) === val || x.dpi === val.replace(/\D/g, '') || (x.nit || '').toUpperCase() === val.toUpperCase());
        if (p) { history.replaceState(null, '', `#/administracion/datos-personas/${p.id}`); return abrir(p.id); }
      }
    });
    ctx.pFil.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'nueva') { est.p = vacia(); est.clientes = []; history.replaceState(null, '', '#/administracion/datos-personas'); pintar(); ctx.pDet.querySelector('[name=nombres]')?.focus(); }
      if (a === 'guardar') guardar();
      if (a === 'activo' && est.p?.id) { leer(); est.p.activo = !est.p.activo; guardar(); }
    });
    ctx.pDet.addEventListener('change', (e) => {
      const n = e.target.name;
      if (!n) return;
      leer();
      inteligente(n);
      if (['nit', 'dpi'].includes(n)) clientesAsociados();
      if (['tipo_id', 'nombres', 'apellidos', 'fecha_nacimiento', 'dpi', 'dpi_departamento_id', 'pais_id', 'departamento_id', 'nit'].includes(n)) pintar();
      est.cambios = true;
    });
    ctx.pDet.addEventListener('click', (e) => {
      const ab = e.target.closest('[data-abrir]');
      if (ab) { history.replaceState(null, '', `#/administracion/datos-personas/${ab.dataset.abrir}`); return abrir(Number(ab.dataset.abrir)); }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      const qt = e.target.closest('[data-quitar-tel]'), qc = e.target.closest('[data-quitar-contacto]');
      if (!a && !qt && !qc) return;
      leer();
      if (a === 'tel-mas') est.p.telefonos.push({ numero: '', tipo: 'CELULAR', ext: '', area: '' });
      if (a === 'contacto-mas') est.p.contactos.push({ nombre: '', parentesco: '', telefono: '' });
      if (qt) { est.p.telefonos.splice(Number(qt.dataset.quitarTel), 1); if (!est.p.telefonos.length) est.p.telefonos.push({ numero: '', tipo: 'CELULAR', ext: '', area: '' }); }
      if (qc) est.p.contactos.splice(Number(qc.dataset.quitarContacto), 1);
      pintar();
    });

    iniciar();
  };
})();
