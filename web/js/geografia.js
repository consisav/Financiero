// Catálogo común Geografía: países → estados / departamentos → ciudades / municipios, y regiones por país.
(function () {
  const { esc, romano, bandera, tabla, formulario, filtrar } = window.UI;

  window.PANTALLAS = window.PANTALLAS || {};
  window.PANTALLAS.geografia = function (cont) {
    const sb = window.FIN.sb;
    const editable = window.FIN.puedeEditarCatalogos();
    const estado = { paises: [], pais: null, deptos: [], depto: null, municipios: [], buscar: {} };

    cont.innerHTML = `
      <section class="panel" id="p-paises"></section>
      <section class="panel" id="p-deptos"></section>
      <section class="panel" id="p-municipios"></section>`;
    const pPaises = cont.querySelector('#p-paises');
    const pDeptos = cont.querySelector('#p-deptos');
    const pMunis = cont.querySelector('#p-municipios');

    const cabecera = (titulo, buscar, clave, botones) => `
      <div class="panel-cab">
        <h2>${titulo}</h2>
        <div class="panel-acciones">${editable ? botones : ''}</div>
      </div>
      <input type="search" class="buscar" data-buscar="${clave}" placeholder="${esc(buscar)}" value="${esc(estado.buscar[clave] || '')}">`;

    // ---------- Países ----------
    async function cargarPaises(seleccion) {
      const { data, error } = await sb.from('paises').select('*').order('codigo');
      if (error) { pPaises.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      estado.paises = data;
      estado.pais = data.find((p) => p.id === seleccion) || estado.pais && data.find((p) => p.id === estado.pais.id) || data.find((p) => p.iso2 === 'GT') || data[0] || null;
      pintarPaises();
      await cargarDeptos();
    }

    function pintarPaises() {
      pPaises.innerHTML = cabecera('Países', 'Buscar país', 'paises', '<button type="button" class="boton primario-sm" data-accion="nuevo-pais">+ País</button>') +
        tabla({
          id: 'paises', editable, seleccionado: estado.pais && estado.pais.id,
          columnas: [
            { titulo: 'Cód.', valor: (f) => f.codigo, clase: 'angosta' },
            { titulo: 'País', valor: (f) => `${bandera(f.iso2)} ${esc(f.nombre)}`, clase: 'fuerte' },
            { titulo: 'Prefijo', valor: (f) => esc(f.iso2) },
            { titulo: 'Cód. tel.', valor: (f) => esc(f.cod_tel) },
            { titulo: 'Idioma', valor: (f) => esc(f.idioma) },
            { titulo: 'Moneda', valor: (f) => esc(f.moneda) }
          ],
          filas: estado.paises
        });
      filtrar(pPaises, estado.buscar.paises || '');
    }

    function formPais(fila) {
      formulario({
        titulo: fila ? `Modificar país · ${fila.nombre}` : 'Nuevo país',
        valores: fila || { codigo: siguiente(estado.paises), activo: true },
        campos: [
          { nombre: 'codigo', etiqueta: 'Código', tipo: 'numero', requerido: true },
          { nombre: 'nombre', etiqueta: 'País', requerido: true },
          { nombre: 'iso2', etiqueta: 'Prefijo (ISO, 2 letras)', requerido: true, max: 2, placeholder: 'GT' },
          { nombre: 'cod_tel', etiqueta: 'Código telefónico', placeholder: '+502' },
          { nombre: 'idioma', etiqueta: 'Idioma', placeholder: 'Español' },
          { nombre: 'moneda', etiqueta: 'Moneda', placeholder: 'GTQ' },
          { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla' }
        ],
        alGuardar: async (d) => {
          d.iso2 = (d.iso2 || '').toUpperCase();
          const r = fila ? await sb.from('paises').update(d).eq('id', fila.id).select().single()
                         : await sb.from('paises').insert(d).select().single();
          if (r.error) throw r.error;
          window.FIN.aviso('País guardado');
          await cargarPaises(r.data.id);
        }
      });
    }

    // ---------- Estados / departamentos ----------
    async function cargarDeptos(seleccion) {
      if (!estado.pais) { pDeptos.innerHTML = ''; pMunis.innerHTML = ''; return; }
      const { data, error } = await sb.from('departamentos')
        .select('*, region:regiones(codigo, nombre), municipios(count)')
        .eq('pais_id', estado.pais.id).order('codigo');
      if (error) { pDeptos.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      estado.deptos = data;
      const previo = seleccion || (estado.depto && estado.depto.id);
      estado.depto = data.find((x) => x.id === previo) || data[0] || null;
      pintarDeptos();
      await cargarMunicipios();
    }

    function pintarDeptos() {
      pDeptos.innerHTML = cabecera(`Estados / departamentos de ${esc(estado.pais.nombre)}`, 'Buscar estado o departamento', 'deptos',
        '<button type="button" class="boton secundario-sm" data-accion="regiones">Regiones</button> <button type="button" class="boton primario-sm" data-accion="nuevo-depto">+ Departamento</button>') +
        tabla({
          id: 'deptos', editable, seleccionado: estado.depto && estado.depto.id,
          vacio: 'Este país todavía no tiene estados o departamentos.',
          columnas: [
            { titulo: 'Cód.', valor: (f) => f.codigo, clase: 'angosta' },
            { titulo: 'Estado / departamento', valor: (f) => esc(f.nombre), clase: 'fuerte' },
            { titulo: 'Región', valor: (f) => f.region ? `Región ${romano(f.region.codigo)} · ${esc(f.region.nombre)}` : '—' },
            { titulo: 'Cód. tel.', valor: (f) => esc(f.cod_tel) },
            { titulo: 'Cód. postal', valor: (f) => esc(f.cod_postal) },
            { titulo: 'Municipios', valor: (f) => (f.municipios && f.municipios[0] ? f.municipios[0].count : 0) }
          ],
          filas: estado.deptos
        });
      filtrar(pDeptos, estado.buscar.deptos || '');
    }

    async function formDepto(fila) {
      const { data: regiones } = await sb.from('regiones').select('id, codigo, nombre').eq('pais_id', estado.pais.id).order('codigo');
      formulario({
        titulo: fila ? `Modificar departamento · ${fila.nombre}` : `Nuevo departamento de ${estado.pais.nombre}`,
        valores: fila || { codigo: siguiente(estado.deptos), cod_tel: estado.pais.cod_tel, activo: true },
        campos: [
          { nombre: 'codigo', etiqueta: 'Código', tipo: 'numero', requerido: true },
          { nombre: 'nombre', etiqueta: 'Estado / departamento', requerido: true },
          { nombre: 'region_id', etiqueta: 'Región', tipo: 'select-numero', vacio: 'Sin región',
            opciones: (regiones || []).map((r) => ({ valor: r.id, texto: `Región ${romano(r.codigo)} · ${r.nombre}` })) },
          { nombre: 'cod_tel', etiqueta: 'Código telefónico' },
          { nombre: 'cod_postal', etiqueta: 'Código postal' },
          { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla' }
        ],
        alGuardar: async (d) => {
          d.pais_id = estado.pais.id;
          const r = fila ? await sb.from('departamentos').update(d).eq('id', fila.id).select().single()
                         : await sb.from('departamentos').insert(d).select().single();
          if (r.error) throw r.error;
          window.FIN.aviso('Departamento guardado');
          await cargarDeptos(r.data.id);
        }
      });
    }

    // ---------- Ciudades / municipios ----------
    async function cargarMunicipios() {
      if (!estado.depto) { pMunis.innerHTML = ''; return; }
      const { data, error } = await sb.from('municipios').select('*').eq('departamento_id', estado.depto.id).order('codigo');
      if (error) { pMunis.innerHTML = `<p class="vacio">${esc(error.message)}</p>`; return; }
      estado.municipios = data;
      pMunis.innerHTML = cabecera(`Ciudades / municipios de ${esc(estado.depto.nombre)}`, 'Buscar ciudad o municipio', 'municipios',
        '<button type="button" class="boton primario-sm" data-accion="nuevo-municipio">+ Municipio</button>') +
        tabla({
          id: 'municipios', editable,
          vacio: 'Este departamento todavía no tiene ciudades o municipios.',
          columnas: [
            { titulo: 'Cód.', valor: (f) => f.codigo, clase: 'angosta' },
            { titulo: 'Ciudad / municipio', valor: (f) => esc(f.nombre), clase: 'fuerte' },
            { titulo: 'Cód. postal', valor: (f) => esc(f.cod_postal) || '—' },
            { titulo: 'Estado', valor: (f) => window.UI.estado(f.activo) }
          ],
          filas: data
        });
      filtrar(pMunis, estado.buscar.municipios || '');
    }

    function formMunicipio(fila) {
      const base = estado.depto.codigo * 100;
      formulario({
        titulo: fila ? `Modificar municipio · ${fila.nombre}` : `Nuevo municipio de ${estado.depto.nombre}`,
        valores: fila || { codigo: Math.max(base, ...estado.municipios.map((x) => x.codigo)) + 1, activo: true },
        campos: [
          { nombre: 'codigo', etiqueta: 'Código', tipo: 'numero', requerido: true },
          { nombre: 'nombre', etiqueta: 'Ciudad / municipio', requerido: true },
          { nombre: 'cod_postal', etiqueta: 'Código postal' },
          { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla' }
        ],
        alGuardar: async (d) => {
          d.departamento_id = estado.depto.id;
          const r = fila ? await sb.from('municipios').update(d).eq('id', fila.id)
                         : await sb.from('municipios').insert(d);
          if (r.error) throw r.error;
          window.FIN.aviso('Municipio guardado');
          await cargarDeptos(estado.depto.id);
        }
      });
    }

    // ---------- Regiones del país ----------
    async function verRegiones() {
      const { data, error } = await sb.from('regiones').select('*').eq('pais_id', estado.pais.id).order('codigo');
      if (error) { window.FIN.aviso(error.message); return; }
      const velo = document.createElement('div');
      velo.className = 'modal-velo';
      velo.innerHTML = `
        <div class="modal ancho" role="dialog" aria-modal="true" aria-label="Regiones">
          <header class="modal-cab"><h2>Regiones de ${esc(estado.pais.nombre)}</h2><button type="button" class="icono-boton" data-cerrar aria-label="Cerrar"><i class="ti ti-x" aria-hidden="true"></i></button></header>
          <div class="modal-lista">
            ${tabla({
              id: 'regiones', editable, vacio: 'Este país todavía no tiene regiones.',
              columnas: [
                { titulo: 'Cód.', valor: (f) => f.codigo, clase: 'angosta' },
                { titulo: 'Región', valor: (f) => `Región ${romano(f.codigo)} · ${esc(f.nombre)}`, clase: 'fuerte' },
                { titulo: 'Estado', valor: (f) => window.UI.estado(f.activo) }
              ],
              filas: data
            })}
          </div>
          <footer class="modal-pie">
            ${editable ? '<button type="button" class="boton primario-sm" data-nueva>+ Región</button>' : ''}
            <button type="button" class="boton secundario-sm" data-cerrar>Cerrar</button>
          </footer>
        </div>`;
      document.body.appendChild(velo);
      const cerrar = () => velo.remove();
      velo.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrar));
      velo.addEventListener('click', (e) => {
        const ed = e.target.closest('[data-editar]');
        if (ed) { cerrar(); formRegion(data.find((x) => String(x.id) === ed.dataset.editar), data); }
        if (e.target.closest('[data-nueva]')) { cerrar(); formRegion(null, data); }
      });
    }

    function formRegion(fila, lista) {
      formulario({
        titulo: fila ? `Modificar región · ${fila.nombre}` : `Nueva región de ${estado.pais.nombre}`,
        valores: fila || { codigo: siguiente(lista), activo: true },
        campos: [
          { nombre: 'codigo', etiqueta: 'Número de región', tipo: 'numero', requerido: true },
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
          { nombre: 'activo', etiqueta: 'Activa', tipo: 'casilla' }
        ],
        alGuardar: async (d) => {
          d.pais_id = estado.pais.id;
          const r = fila ? await sb.from('regiones').update(d).eq('id', fila.id) : await sb.from('regiones').insert(d);
          if (r.error) throw r.error;
          window.FIN.aviso('Región guardada');
          await cargarDeptos();
          verRegiones();
        }
      });
    }

    const siguiente = (lista) => Math.max(0, ...lista.map((x) => x.codigo)) + 1;

    // ---------- Eventos ----------
    cont.addEventListener('click', async (e) => {
      const accion = e.target.closest('[data-accion]');
      if (accion) {
        const a = accion.dataset.accion;
        if (a === 'nuevo-pais') formPais();
        if (a === 'nuevo-depto') formDepto();
        if (a === 'nuevo-municipio') formMunicipio();
        if (a === 'regiones') verRegiones();
        return;
      }
      const ed = e.target.closest('[data-editar]');
      const t = e.target.closest('table[data-tabla]');
      if (!t) return;
      const lista = { paises: estado.paises, deptos: estado.deptos, municipios: estado.municipios }[t.dataset.tabla];
      if (ed) {
        const fila = lista.find((x) => String(x.id) === ed.dataset.editar);
        ({ paises: formPais, deptos: formDepto, municipios: formMunicipio })[t.dataset.tabla](fila);
        return;
      }
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const fila = lista.find((x) => String(x.id) === tr.dataset.id);
      if (t.dataset.tabla === 'paises' && fila !== estado.pais) { estado.pais = fila; estado.depto = null; pintarPaises(); await cargarDeptos(); }
      if (t.dataset.tabla === 'deptos' && fila !== estado.depto) { estado.depto = fila; pintarDeptos(); await cargarMunicipios(); }
    });

    cont.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('tr[data-id]')) e.target.click();
    });

    cont.addEventListener('input', (e) => {
      const clave = e.target.dataset.buscar;
      if (!clave) return;
      estado.buscar[clave] = e.target.value;
      filtrar(e.target.closest('.panel'), e.target.value);
    });

    cargarPaises();
  };
})();
