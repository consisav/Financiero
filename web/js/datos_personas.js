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

  // ===================== Consulta Personas =====================
  // Resumen de las personas de la organización (la de la empresa elegida), como Consulta de Depósitos y de Notas: filtros
  // (tipo, estado, documento, empresa del registro y orden), el listado con sus totales y búsqueda, y abajo el detalle de
  // la persona elegida con sus posibles duplicados y los clientes con su mismo NIT o DPI. «Ver ficha» la abre en Datos
  // Personas. Reporte en Excel.
  const ORDENES_P = [['codigo:asc', 'Código ↑'], ['codigo:desc', 'Código ↓'], ['nombre:asc', 'Nombre A-Z'], ['nombre:desc', 'Nombre Z-A'], ['ingreso:desc', 'Ingreso ↓'], ['nacimiento:asc', 'Nacimiento ↑']];
  const DOCS = [['TODOS', 'Todos'], ['CON DPI', 'Con DPI'], ['SIN DPI', 'Sin DPI'], ['CON NIT', 'Con NIT'], ['SIN NIT', 'Sin NIT'], ['DUPLICADOS', 'Posibles duplicados']];
  const nombreCompleto = (p) => [p.nombres, p.apellidos].filter(Boolean).join(' ');
  const normal = (t) => String(t || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const telDe = (p) => (p.telefonos || []).map((t) => t.numero).filter(Boolean).join(' · ');

  window.PANTALLAS['consulta-personas'] = function (cont) {
    const ctx = montar(cont, { titulo: 'Consulta Personas', icono: 'ti-users', clase: 'bk-movimientos bk-consultar cb-apilado bk-consulta-cheques dpc-consulta', grupo: 'Registros' });
    const { sb } = ctx;
    const f = { tipo: '', estado: 'ACTIVAS', doc: 'TODOS', empresa: 'TODAS', orden: 'codigo', dir: 'asc', buscar: '' };
    let personas = [], cat = [], sel = null, detalle = { clientes: [] }, consulta = 0;
    const org = () => ctx.localidad(ctx.sel.loc)?.organizacion_id || ctx.sel.org;
    const tipoDe = (id) => cat.find((c) => c.id === id);
    const repetidos = new Map();

    function pintarFiltros() {
      const tipos = cat.filter((c) => c.tipo === 'TIPO');
      ctx.filtros(`
        <label class="campo"><span>Tipo de persona</span><select name="tipo"><option value="">Todos</option>${tipos.map((t) => `<option value="${t.id}" ${String(f.tipo) === String(t.id) ? 'selected' : ''}>${esc(`${t.codigo} · ${t.nombre}`)}</option>`).join('')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado">${['TODAS', 'ACTIVAS', 'INACTIVAS'].map((e) => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label class="campo"><span>Documento</span><select name="doc">${DOCS.map(([k, t]) => `<option value="${k}" ${f.doc === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><span>Registradas en</span><select name="empresa"><option value="TODAS" ${f.empresa === 'TODAS' ? 'selected' : ''}>Toda la organización</option><option value="ESTA" ${f.empresa === 'ESTA' ? 'selected' : ''}>Esta empresa</option></select></label>
        <label class="campo"><span>Ordenar por</span><select name="orden">${ORDENES_P.map(([k, t]) => `<option value="${k}" ${`${f.orden}:${f.dir}` === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`,
        '<a class="boton secundario-sm" href="#/administracion/datos-personas"><i class="ti ti-user-plus" aria-hidden="true"></i> Nueva persona</a><button type="button" class="boton cqc-excel" data-accion="excel" title="Reporte en Excel (.xlsx) con el encabezado de la empresa"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i><span><b>Generar Excel</b><small>Listado de personas</small></span></button>');
    }

    async function iniciar() {
      if (!(await ctx.cargarBase())) return;
      await consultar();
    }

    async function consultar(id = sel?.id) {
      const o = org();
      const yo = ++consulta;
      const [c, p] = await Promise.all([
        sb.from('personas_catalogos').select('*').eq('organizacion_id', o).order('tipo').order('codigo'),
        window.UI.todo(sb.from('personas').select('id, codigo, localidad_id, tipo_id, nombres, apellidos, dpi, nit, telefonos, correo, fecha_nacimiento, sexo, activo, persona_anterior, creado_en, fecha_ingreso_anterior, municipio_id, direccion').eq('organizacion_id', o).order('codigo'))
      ]);
      if (yo !== consulta) return;
      if (c.error || p.error) {
        pintarFiltros();
        ctx.pMae.innerHTML = `<p class="vacio">${esc(sinTabla(c.error || p.error) ? AVISO : window.UI.traducirError(c.error || p.error))}</p>`;
        ctx.pDet.innerHTML = '';
        return;
      }
      cat = c.data || []; personas = p.data || [];
      if (f.tipo && !tipoDe(Number(f.tipo))) f.tipo = '';
      // Posibles duplicados: mismo nombre completo, mismo DPI o mismo NIT (sin CF).
      repetidos.clear();
      const cuenta = new Map();
      const llaves = (x) => [`N${normal(nombreCompleto(x))}`, x.dpi ? `D${x.dpi}` : null, x.nit && !['CF', 'C/F'].includes(String(x.nit).toUpperCase()) ? `T${String(x.nit).toUpperCase()}` : null].filter(Boolean);
      personas.forEach((x) => llaves(x).forEach((k) => cuenta.set(k, (cuenta.get(k) || 0) + 1)));
      personas.forEach((x) => { const n = Math.max(...llaves(x).map((k) => cuenta.get(k))); if (n > 1) repetidos.set(x.id, n); });
      pintarFiltros();
      sel = personas.find((x) => x.id === id) || null;
      pintarMaestro();
      if (sel) await elegir(sel); else if (visibles()[0]) await elegir(visibles()[0]); else pintarDetalle();
    }

    const fechaIngreso = (p) => p.fecha_ingreso_anterior || p.creado_en || '';
    const visibles = () => {
      const q = normal(f.buscar);
      return personas.filter((p) => (!f.tipo || p.tipo_id === Number(f.tipo))
        && (f.estado === 'TODAS' || (f.estado === 'ACTIVAS') === !!p.activo)
        && (f.empresa === 'TODAS' || p.localidad_id === ctx.sel.loc)
        && (f.doc === 'TODOS' || (f.doc === 'CON DPI' && p.dpi) || (f.doc === 'SIN DPI' && !p.dpi) || (f.doc === 'CON NIT' && p.nit && !['CF', 'C/F'].includes(String(p.nit).toUpperCase()))
          || (f.doc === 'SIN NIT' && (!p.nit || ['CF', 'C/F'].includes(String(p.nit).toUpperCase()))) || (f.doc === 'DUPLICADOS' && repetidos.has(p.id)))
        && (!q || [nombreCompleto(p), p.dpi, p.nit, String(p.codigo), telDe(p), p.correo, p.persona_anterior].some((v) => normal(v).includes(q))))
        .sort((a, b) => {
          const v = (p) => (f.orden === 'nombre' ? normal(nombreCompleto(p)) : f.orden === 'ingreso' ? String(fechaIngreso(p)) : f.orden === 'nacimiento' ? (p.fecha_nacimiento || '9999') : p.codigo);
          const va = v(a), vb = v(b);
          const d = va < vb ? -1 : va > vb ? 1 : a.codigo - b.codigo;
          return f.dir === 'asc' ? d : -d;
        });
    };
    const ordenTh = (campo, texto, clase = '') => `<th class="${clase} cq-orden ${f.orden === campo ? 'activo' : ''}" data-ordenar="${campo}" title="Ordenar por ${texto.toLowerCase()}">${texto} <i class="ti ${f.orden === campo ? (f.dir === 'asc' ? 'ti-sort-ascending' : 'ti-sort-descending') : 'ti-arrows-sort'}" aria-hidden="true"></i></th>`;

    function pintarMaestro() {
      const filas = visibles();
      const MAX = 600;
      ctx.pMae.innerHTML = `
        <header class="tk-bandeja-cab cc-cab">
          <h2>Personas <small>${filas.length.toLocaleString('es-GT')}</small></h2>
          <div class="ta-totales pc-resumen">
            <span class="ta-total"><b>${filas.filter((p) => p.activo).length.toLocaleString('es-GT')}</b> activas</span>
            <span class="ta-total"><b>${filas.filter((p) => !p.activo).length}</b> inactivas</span>
            <span class="ta-total"><b>${filas.filter((p) => p.dpi).length.toLocaleString('es-GT')}</b> con DPI</span>
            <span class="ta-total sin"><b>${filas.filter((p) => !p.dpi).length.toLocaleString('es-GT')}</b> sin DPI</span>
            <span class="ta-total sin"><b>${filas.filter((p) => repetidos.has(p.id)).length}</b> posibles duplicados</span>
          </div>
          <label class="tk-buscar"><i class="ti ti-search" aria-hidden="true"></i><input type="search" data-buscar placeholder="Nombre, DPI, NIT, código, teléfono…" value="${esc(f.buscar)}" aria-label="Buscar personas"></label>
        </header>
        <div class="ta-tabla cc-tabla">
          <table class="cqc-tabla dpc-tabla"><colgroup><col style="width:74px"><col><col style="width:150px"><col style="width:160px"><col style="width:120px"><col style="width:150px"><col style="width:110px"><col style="width:116px"></colgroup>
            <thead><tr>${ordenTh('codigo', 'Código', 'num')}${ordenTh('nombre', 'Nombre · tipo')}<th>DPI · NIT</th><th>Teléfono · correo</th>${ordenTh('nacimiento', 'Nacimiento')}<th>Sistema anterior</th>${ordenTh('ingreso', 'Estado')}<th aria-label="Ver ficha"></th></tr></thead>
            <tbody>${filas.slice(0, MAX).map((p) => { const t = tipoDe(p.tipo_id); const edad = edadDe(p.fecha_nacimiento); return `<tr data-persona="${p.id}" class="${sel && sel.id === p.id ? 'actual' : ''} ${p.activo ? '' : 'pc-anulada'}" tabindex="0">
              <td class="num fuerte">${p.codigo}</td>
              <td class="cqc-quien" title="${esc(nombreCompleto(p))}"><b>${esc(nombreCompleto(p))}</b><small>${esc(t ? t.nombre : 'Sin tipo')}${repetidos.has(p.id) ? ` · <span class="dpc-dup">posible duplicado (${repetidos.get(p.id)})</span>` : ''}</small></td>
              <td>${esc(p.dpi || '—')}<small>${esc(p.nit ? `NIT ${p.nit}` : 'Sin NIT')}</small></td>
              <td title="${esc(telDe(p))}">${esc(telDe(p) || '—')}<small>${esc(p.correo || '')}</small></td>
              <td>${p.fecha_nacimiento ? esc(window.BANCOS.fmt.fechaDia(p.fecha_nacimiento)) : '—'}<small>${edad !== '' ? `${edad} años` : ''}</small></td>
              <td title="${esc(p.persona_anterior || '')}">${esc(p.persona_anterior || '—')}<small>${esc(ctx.localidad(p.localidad_id)?.codigo || '')}</small></td>
              <td class="cqc-estado"><span class="pc-marca ${p.activo ? 'aprobada' : 'anulada'}">${p.activo ? 'Activa' : 'Inactiva'}</span><small>${fechaIngreso(p) ? `Ingreso ${esc(window.BANCOS.fmt.fechaDia(String(fechaIngreso(p)).slice(0, 10)))}` : ''}</small></td>
              <td class="cq-acc"><button type="button" class="boton secundario-sm cqc-ver dpc-ver" data-ficha="${p.id}" title="Abrir la ficha en Datos Personas"><i class="ti ti-id" aria-hidden="true"></i> Ver ficha</button></td></tr>`; }).join('')
              || `<tr><td colspan="8" class="tk-vacio"><i class="ti ti-users" aria-hidden="true"></i>${personas.length ? 'No hay personas con estos parámetros.' : 'La organización aún no tiene personas: créalas en Datos Personas.'}</td></tr>`}
              ${filas.length > MAX ? `<tr><td colspan="8" class="tk-vacio">Se muestran las primeras ${MAX} de ${filas.length.toLocaleString('es-GT')}: usa la búsqueda o los filtros (el Excel lleva todas).</td></tr>` : ''}</tbody></table>
        </div>`;
    }

    async function elegir(p) {
      sel = p;
      detalle = { clientes: [], ficha: null };
      ctx.pMae.querySelectorAll('tr[data-persona]').forEach((tr) => tr.classList.toggle('actual', !!p && tr.dataset.persona === String(p.id)));
      if (!p) return pintarDetalle();
      ctx.pDet.innerHTML = ctx.vacio('Cargando la persona…', 'ti-loader-2');
      const docs = [p.nit && !['CF', 'C/F'].includes(String(p.nit).toUpperCase()) ? String(p.nit).toUpperCase() : null, p.dpi].filter(Boolean);
      const [fi, cl] = await Promise.all([
        sb.from('personas').select('*').eq('id', p.id).maybeSingle(),
        docs.length ? sb.from('clientes').select('id, codigo, nombre, documento, localidad_id').eq('organizacion_id', org()).in('documento', docs).limit(20) : Promise.resolve({ data: [] })
      ]);
      if (sel !== p) return;
      detalle = { ficha: fi.data || p, clientes: cl.data || [] };
      pintarDetalle();
    }

    function pintarDetalle() {
      const p = sel;
      if (!p) { ctx.pDet.innerHTML = ctx.vacio(personas.length ? 'Elige una persona para ver su detalle.' : 'Sin personas en la organización.', 'ti-users'); return; }
      const x = detalle.ficha || p;
      const t = tipoDe(x.tipo_id);
      const edad = edadDe(x.fecha_nacimiento);
      const cat2 = (id) => cat.find((c) => c.id === id)?.nombre;
      const nom = normal(nombreCompleto(x));
      const iguales = personas.filter((o) => o.id !== x.id && ((x.dpi && o.dpi === x.dpi) || (x.nit && !['CF', 'C/F'].includes(String(x.nit).toUpperCase()) && String(o.nit || '').toUpperCase() === String(x.nit).toUpperCase()) || normal(nombreCompleto(o)) === nom));
      const dato = (k, v) => `<div class="dpc-dato"><dt>${k}</dt><dd>${v ? esc(v) : '<span class="tk-tenue">—</span>'}</dd></div>`;
      ctx.pDet.innerHTML = `
        <div class="tk-form cq-ficha">
          <header class="tk-titulo cb-titulo">
            <span class="tk-icono dpc-av">${esc(iniciales(x))}</span>
            <div class="tk-titulo-texto"><small>Persona ${x.codigo} · ${esc(t ? t.nombre : 'Sin tipo')}${x.persona_anterior ? ` · sistema anterior ${esc(x.persona_anterior)}` : ''}</small><h2>${esc(nombreCompleto(x))}</h2></div>
            <dl class="cq-datos">
              <div><dt>DPI</dt><dd>${esc(x.dpi || '—')}</dd></div>
              <div><dt>NIT</dt><dd>${esc(x.nit || '—')}</dd></div>
              <div><dt>Nacimiento</dt><dd>${x.fecha_nacimiento ? `${esc(window.BANCOS.fmt.fechaDia(x.fecha_nacimiento))}${edad !== '' ? ` · ${edad} años` : ''}` : '—'}</dd></div>
              <div><dt>Estado</dt><dd>${x.activo ? 'Activa' : 'Inactiva'}</dd></div>
            </dl>
            <div class="tk-titulo-acciones"><a class="boton primario-sm" href="#/administracion/datos-personas/${x.id}"><i class="ti ti-id" aria-hidden="true"></i> Ver en Datos Personas</a></div>
          </header>
          <div class="cq-det">
            <section class="cb-bloque">
              <h3 class="ta-col-titulo"><i class="ti ti-user" aria-hidden="true"></i> Datos de la ficha</h3>
              <dl class="dpc-datos">
                ${dato('Facturar a', x.facturar_a)}${dato('Teléfonos', telDe(x))}${dato('Correo', x.correo)}${dato('Sexo · estado civil', [x.sexo, x.estado_civil].filter(Boolean).join(' · '))}
                ${dato('Dirección', x.direccion || x.direccion_casa)}${dato('Dirección factura', x.direccion_facturacion)}${dato('Nacionalidad', x.nacionalidad)}${dato('Escolaridad · profesión', [cat2(x.escolaridad_id), cat2(x.profesion_id)].filter(Boolean).join(' · ') || [x.escolaridad_anterior && `esc. ${x.escolaridad_anterior}`, x.profesion_anterior && `prof. ${x.profesion_anterior}`].filter(Boolean).join(' · '))}
                ${dato('Empresa · puesto', [x.empresa_labora, x.puesto].filter(Boolean).join(' · '))}${dato('Crédito', x.dias_credito || x.limite_credito ? `${x.dias_credito || 0} días · Q ${window.BANCOS.fmt.monto(x.limite_credito || 0)}` : '')}${dato('Cuenta contable', x.cuenta_codigo)}${dato('Registrada en', ctx.localidad(x.localidad_id) ? `${ctx.localidad(x.localidad_id).codigo} · ${ctx.localidad(x.localidad_id).nombre_comercial}` : '')}
              </dl>
            </section>
            <section class="cb-bloque">
              <h3 class="ta-col-titulo"><i class="ti ti-copy" aria-hidden="true"></i> Posibles duplicados y clientes asociados <small>${iguales.length + detalle.clientes.length}</small></h3>
              <div class="pc-lineas"><table><thead><tr><th>Tipo</th><th>Código</th><th>Nombre</th><th>DPI · NIT</th><th>Coincide en</th><th></th></tr></thead>
                <tbody>${[...iguales.map((o) => `<tr><td><span class="pc-tipo">persona</span></td><td class="fuerte">${o.codigo}</td><td class="cc-nombre">${esc(nombreCompleto(o))}</td><td>${esc(o.dpi || o.nit || '')}</td><td>${[x.dpi && o.dpi === x.dpi ? 'DPI' : '', x.nit && String(o.nit || '').toUpperCase() === String(x.nit).toUpperCase() ? 'NIT' : '', normal(nombreCompleto(o)) === nom ? 'nombre' : ''].filter(Boolean).join(', ')}</td><td><button type="button" class="rp-enlace dpc-ir" data-ir="${o.id}" title="Ver esta persona"><i class="ti ti-arrow-right" aria-hidden="true"></i></button></td></tr>`),
                  ...detalle.clientes.map((c) => `<tr><td><span class="pc-tipo">cliente</span></td><td class="fuerte">${esc(c.codigo)}</td><td class="cc-nombre">${esc(c.nombre)}</td><td>${esc(c.documento || '')}</td><td>${esc(ctx.localidad(c.localidad_id)?.codigo || '')}</td><td></td></tr>`)].join('') || '<tr><td colspan="6" class="tk-vacio">Sin duplicados ni clientes con el mismo NIT o DPI.</td></tr>'}</tbody></table></div>
            </section>
          </div>
        </div>`;
    }

    // ---------- Reporte en Excel (con el encabezado de la empresa) ----------
    function parametros() {
      const emp = ctx.localidad(ctx.sel.loc);
      const t = tipoDe(Number(f.tipo));
      return [`Organización de: ${emp ? `${emp.codigo} · ${emp.nombre_comercial}` : '—'}`, `Registradas en: ${f.empresa === 'TODAS' ? 'toda la organización' : 'esta empresa'}`, `Tipo: ${t ? t.nombre : 'Todos'}`,
        `Estado: ${f.estado}`, `Documento: ${DOCS.find(([k]) => k === f.doc)?.[1]}`, `Orden: ${ORDENES_P.find(([k]) => k === `${f.orden}:${f.dir}`)?.[1] || ''}`, ...(f.buscar.trim() ? [`Búsqueda: ${f.buscar.trim()}`] : [])];
    }
    async function excel() {
      const filas = visibles();
      if (!filas.length) return window.FIN.aviso('No hay personas con estos parámetros');
      const cargar = () => window.ExcelJS ? Promise.resolve(window.ExcelJS) : new Promise((ok, mal) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'; s.onload = () => ok(window.ExcelJS); s.onerror = () => mal(new Error('No se pudo cargar la librería de Excel')); document.head.appendChild(s); });
      const emp = ctx.localidad(ctx.sel.loc);
      const COLS = [['Código', 9], ['Nombres', 26], ['Apellidos', 26], ['Tipo', 16], ['DPI', 16], ['NIT', 13], ['Teléfonos', 22], ['Correo', 28], ['Nacimiento', 12], ['Edad', 7], ['Sexo', 11], ['Sistema anterior', 24], ['Empresa', 9], ['Estado', 10]];
      const datos = filas.map((p) => [p.codigo, p.nombres, p.apellidos || '', tipoDe(p.tipo_id)?.nombre || '', p.dpi || '', p.nit || '', telDe(p), p.correo || '', p.fecha_nacimiento ? window.BANCOS.fmt.fechaDia(p.fecha_nacimiento) : '', edadDe(p.fecha_nacimiento), p.sexo || '', p.persona_anterior || '', ctx.localidad(p.localidad_id)?.codigo || '', p.activo ? 'Activa' : 'Inactiva']);
      let ExcelJS;
      try { ExcelJS = await cargar(); } catch (err) { window.FIN.aviso(`${err.message}: se descarga en CSV`); return window.COMPRAS_CAT.descargarCsv(`personas_${emp?.codigo || ''}.csv`, [COLS.map((c) => c[0]), ...datos]); }
      window.FIN.aviso('Generando el reporte…');
      const yo = window.FIN.perfil();
      const ahora = new Date().toLocaleString('es-GT', { timeZone: 'America/Guatemala', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
      const { data: o } = await sb.from('organizaciones').select('nombre').eq('id', org()).maybeSingle();
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Financiero CONSISAV';
      const ws = wb.addWorksheet('Personas', { views: [{ state: 'frozen', ySplit: 7, showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
      ws.columns = COLS.map(([, ancho]) => ({ width: ancho }));
      const azul = 'FF1F3A5F', ultima = COLS.length;
      ws.mergeCells(1, 1, 1, 3); ws.getCell(1, 1).value = o?.nombre || ''; ws.getCell(1, 1).font = { bold: true, size: 13, color: { argb: azul } };
      ws.mergeCells(2, 1, 2, 3); ws.getCell(2, 1).value = emp ? `${emp.codigo} · ${emp.nombre_comercial}` : ''; ws.getCell(2, 1).font = { size: 10, color: { argb: 'FF555555' } };
      const par = parametros();
      ws.mergeCells(1, 4, 1, 10); ws.getCell(1, 4).value = 'Consulta Personas'; ws.getCell(1, 4).font = { bold: true, size: 14, color: { argb: azul } };
      [par.slice(0, 2).join('   ·   '), par.slice(2, 5).join('   ·   '), par.slice(5).join('   ·   ')].forEach((tx, i) => { ws.mergeCells(2 + i, 4, 2 + i, 10); ws.getCell(2 + i, 4).value = tx; ws.getCell(2 + i, 4).font = { size: 9.5, color: { argb: 'FF444444' } }; });
      for (let r = 1; r <= 4; r += 1) ws.getCell(r, 4).alignment = { horizontal: 'center' };
      ws.mergeCells(1, 11, 1, ultima); ws.getCell(1, 11).value = `Fecha: ${ahora}`;
      ws.mergeCells(2, 11, 2, ultima); ws.getCell(2, 11).value = `Usuario: ${(yo.usuario || '').toUpperCase()}${yo.nombre ? ` · ${yo.nombre}` : ''}`;
      [1, 2].forEach((r) => { ws.getCell(r, 11).alignment = { horizontal: 'right' }; ws.getCell(r, 11).font = { size: 9.5, color: { argb: 'FF444444' } }; });
      for (let c = 1; c <= ultima; c += 1) ws.getCell(5, c).border = { bottom: { style: 'medium', color: { argb: azul } } };
      ws.getRow(5).height = 6;
      const cab = ws.getRow(7);
      COLS.forEach(([tx], i) => { const c = cab.getCell(i + 1); c.value = tx; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: azul } }; });
      datos.forEach((d, i) => { const r = ws.getRow(8 + i); r.values = d; if (d[13] === 'Inactiva') r.font = { color: { argb: 'FF999999' } }; });
      const tg = ws.getRow(9 + datos.length);
      tg.getCell(2).value = `Total: ${datos.length.toLocaleString('es-GT')} personas (${filas.filter((p) => p.activo).length.toLocaleString('es-GT')} activas)`; tg.font = { bold: true };
      ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: ultima } };
      const buf = await wb.xlsx.writeBuffer();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = `personas_${emp?.codigo || ''}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      window.FIN.aviso(`Reporte generado: ${datos.length.toLocaleString('es-GT')} personas`);
    }

    cont.addEventListener('change', (e) => {
      const cambio = ctx.cambioOrgLoc(e);
      if (cambio === 'org') { sel = null; f.tipo = ''; return consultar(); }
      if (cambio === 'loc') { if (f.empresa === 'ESTA') { pintarMaestro(); return elegir(visibles()[0] || null); } return; }
      if (cambio === 'otro') {
        const n = e.target.name;
        if (['tipo', 'estado', 'doc', 'empresa'].includes(n)) { f[n] = e.target.value; pintarMaestro(); return elegir(visibles().find((p) => p.id === sel?.id) || visibles()[0] || null); }
        if (n === 'orden') { [f.orden, f.dir] = e.target.value.split(':'); return pintarMaestro(); }
      }
    });
    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-buscar]')) return;
      f.buscar = e.target.value;
      const pos = e.target.selectionStart;
      pintarMaestro();
      const b = ctx.pMae.querySelector('[data-buscar]'); b.focus(); b.setSelectionRange(pos, pos);
    });
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-buscar]')) e.preventDefault();
      if (e.key === 'Enter' && e.target.matches('tr[data-persona]')) e.target.click();
    });
    cont.addEventListener('click', (e) => {
      const v = e.target.closest('[data-ficha]');
      if (v) { location.hash = `#/administracion/datos-personas/${v.dataset.ficha}`; return; }
      const ir = e.target.closest('[data-ir]');
      if (ir) { const p = personas.find((x) => String(x.id) === ir.dataset.ir); if (p) { if (!visibles().includes(p)) { f.buscar = ''; f.doc = 'TODOS'; f.estado = 'TODAS'; f.tipo = ''; pintarFiltros(); } pintarMaestro(); return elegir(p); } }
      const th = e.target.closest('[data-ordenar]');
      if (th) { const campo = th.dataset.ordenar; f.dir = f.orden === campo && f.dir === 'asc' ? 'desc' : 'asc'; f.orden = campo; const o = ctx.pFil.querySelector('[name=orden]'); if (o) o.value = `${f.orden}:${f.dir}`; return pintarMaestro(); }
      const tr = e.target.closest('tr[data-persona]');
      if (tr && ctx.pMae.contains(tr)) return elegir(personas.find((p) => String(p.id) === tr.dataset.persona));
      if (e.target.closest('[data-accion]')?.dataset.accion === 'excel') return excel();
    });

    iniciar();
  };
})();
