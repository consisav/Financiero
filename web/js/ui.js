// Componentes de interfaz compartidos por las pantallas de catálogos:
// tablas con selección, ventana de formulario, ubicación en cascada y formatos.
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function fecha(f) {
    if (!f) return '';
    return new Date(f).toLocaleString('es-GT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  }

  function romano(n) {
    const v = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let r = '';
    for (const [k, s] of v) while (n >= k) { r += s; n -= k; }
    return r;
  }

  const estado = (activo) => `<span class="estado ${activo ? 'activo' : 'inactivo'}">${activo ? 'Activo' : 'Inactivo'}</span>`;
  const bandera = (iso2) => iso2 ? `<span class="iso">${esc(iso2)}</span>` : '';

  // Barra de auditoría: "Grabado por X el … · Última modificación por Y el …"
  function auditoria(fila, editable, acciones) {
    if (!fila) return '';
    return `
      <div class="auditoria">
        ${estado(fila.activo)}
        <span>Grabado por <b>${esc(fila.creado_por_nombre || 'sistema')}</b> el <b>${fecha(fila.creado_en)}</b></span>
        ${fila.modificado_en ? `<span>Última modificación por <b>${esc(fila.modificado_por_nombre || 'sistema')}</b> el <b>${fecha(fila.modificado_en)}</b></span>` : ''}
        <span class="auditoria-acciones">
          ${editable ? `<button type="button" class="boton primario-sm" data-accion="${acciones}-modificar">Modificar</button>` : ''}
          <button type="button" class="boton secundario-sm" data-accion="${acciones}-actualizar">Actualizar</button>
        </span>
      </div>`;
  }

  // columnas: [{ titulo, valor: (fila) => html, clase }]
  function tabla({ id, columnas, filas, seleccionado, editable, vacio }) {
    return `
      <div class="tabla-desplazable">
        <table class="tabla catalogo" data-tabla="${id}">
          <thead><tr>${columnas.map((c) => `<th class="${c.clase || ''}">${esc(c.titulo)}</th>`).join('')}${editable ? '<th class="acciones"></th>' : ''}</tr></thead>
          <tbody>
            ${filas.length ? filas.map((f) => `
              <tr data-id="${f.id}" class="${f.id === seleccionado ? 'seleccionada' : ''} ${f.activo === false ? 'apagada' : ''}" tabindex="0">
                ${columnas.map((c) => `<td class="${c.clase || ''}">${c.valor(f)}</td>`).join('')}
                ${editable ? `<td class="acciones"><button type="button" class="icono-editar" data-editar="${f.id}" aria-label="Modificar"><i class="ti ti-pencil" aria-hidden="true"></i></button></td>` : ''}
              </tr>`).join('') : `<tr><td colspan="${columnas.length + 1}" class="vacio">${esc(vacio || 'Sin registros')}</td></tr>`}
          </tbody>
        </table>
      </div>`;
  }

  // ---------- Ventana de formulario ----------
  // campos: [{ nombre, etiqueta, tipo: texto|numero|correo|area|select|casilla, opciones: [{valor, texto}], requerido, ancho: 'completo' }]
  function formulario({ titulo, campos, valores = {}, alGuardar, alPreparar }) {
    const velo = document.createElement('div');
    velo.className = 'modal-velo';
    velo.innerHTML = `
      <form class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <header class="modal-cab"><h2>${esc(titulo)}</h2><button type="button" class="icono-boton" data-cerrar aria-label="Cerrar"><i class="ti ti-x" aria-hidden="true"></i></button></header>
        <div class="modal-cuerpo">
          ${campos.map((c) => campo(c, valores[c.nombre])).join('')}
        </div>
        <p class="modal-error" role="alert"></p>
        <footer class="modal-pie">
          <button type="button" class="boton secundario-sm" data-cerrar>Cancelar</button>
          <button type="submit" class="boton primario-sm">Guardar</button>
        </footer>
      </form>`;
    document.body.appendChild(velo);
    const form = velo.querySelector('form');
    const cerrar = () => velo.remove();
    velo.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrar));
    velo.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
    if (alPreparar) alPreparar(form);
    const primero = form.querySelector('input:not([type=checkbox]), select, textarea');
    if (primero) primero.focus();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const datos = {};
      for (const c of campos) {
        const el = form.elements[c.nombre];
        if (c.tipo === 'casilla') datos[c.nombre] = el.checked;
        else if (c.tipo === 'numero' || c.tipo === 'select-numero') datos[c.nombre] = el.value === '' ? null : Number(el.value);
        else datos[c.nombre] = el.value.trim() === '' ? null : el.value.trim();
      }
      const boton = form.querySelector('[type=submit]');
      boton.disabled = true;
      form.querySelector('.modal-error').textContent = '';
      try { await alGuardar(datos); cerrar(); }
      catch (err) { form.querySelector('.modal-error').textContent = traducirError(err); }
      finally { boton.disabled = false; }
    });
  }

  function campo(c, valor) {
    const req = c.requerido ? 'required' : '';
    const ancho = c.ancho === 'completo' ? ' completo' : '';
    if (c.tipo === 'casilla') {
      return `<label class="campo casilla${ancho}"><input type="checkbox" name="${c.nombre}" ${valor !== false ? 'checked' : ''}> ${esc(c.etiqueta)}</label>`;
    }
    let control;
    if (c.tipo === 'area') control = `<textarea name="${c.nombre}" rows="2" ${req}>${esc(valor)}</textarea>`;
    else if (c.tipo === 'select' || c.tipo === 'select-numero') {
      control = `<select name="${c.nombre}" ${req}>${opciones(c.opciones || [], valor, c.vacio)}</select>`;
    } else {
      const tipo = c.tipo === 'numero' ? 'number' : c.tipo === 'correo' ? 'text' : 'text';
      control = `<input type="${tipo}" name="${c.nombre}" value="${esc(valor)}" ${req} ${c.placeholder ? `placeholder="${esc(c.placeholder)}"` : ''} ${c.max ? `maxlength="${c.max}"` : ''}>`;
    }
    return `<label class="campo${ancho}"><span>${esc(c.etiqueta)}${c.requerido ? ' *' : ''}</span>${control}</label>`;
  }

  function opciones(lista, valor, vacio = 'Seleccionar…') {
    return `<option value="">${esc(vacio)}</option>` + lista.map((o) =>
      `<option value="${esc(o.valor)}" ${String(o.valor) === String(valor ?? '') ? 'selected' : ''}>${esc(o.texto)}</option>`).join('');
  }

  // País → departamento → municipio en un formulario abierto.
  async function cascadaUbicacion(form, valores) {
    const sb = window.FIN.sb;
    const [p, d, m] = ['pais_id', 'departamento_id', 'municipio_id'].map((n) => form.elements[n]);
    async function cargar(sel, tabla, filtro, id, valor) {
      sel.innerHTML = opciones([], null, id ? 'Cargando…' : 'Seleccionar…');
      if (!id) return;
      const { data } = await sb.from(tabla).select('id, nombre').eq(filtro, id).eq('activo', true).order('nombre');
      sel.innerHTML = opciones((data || []).map((x) => ({ valor: x.id, texto: x.nombre })), valor);
    }
    const { data: paises } = await sb.from('paises').select('id, nombre').eq('activo', true).order('codigo');
    p.innerHTML = opciones((paises || []).map((x) => ({ valor: x.id, texto: x.nombre })), valores.pais_id);
    await cargar(d, 'departamentos', 'pais_id', valores.pais_id, valores.departamento_id);
    await cargar(m, 'municipios', 'departamento_id', valores.departamento_id, valores.municipio_id);
    p.addEventListener('change', async () => { await cargar(d, 'departamentos', 'pais_id', p.value); m.innerHTML = opciones([]); });
    d.addEventListener('change', () => cargar(m, 'municipios', 'departamento_id', d.value));
  }

  function traducirError(err) {
    const t = (err && err.message) || '';
    if (/duplicate key|unique/i.test(t)) return 'Ya existe un registro con ese código.';
    if (/row-level security/i.test(t)) return 'Tu rol no tiene permiso para guardar en este catálogo.';
    if (/violates foreign key/i.test(t)) return 'Revisa los valores seleccionados.';
    if (/null value/i.test(t)) return 'Completa los campos obligatorios.';
    return t || 'No se pudo guardar. Intenta de nuevo.';
  }

  // Filtra filas de una tabla ya pintada según un texto de búsqueda.
  function filtrar(contenedor, texto) {
    const q = texto.trim().toLowerCase();
    contenedor.querySelectorAll('tbody tr[data-id]').forEach((tr) => {
      tr.hidden = q !== '' && !tr.textContent.toLowerCase().includes(q);
    });
  }

  window.UI = { esc, fecha, romano, estado, bandera, auditoria, tabla, formulario, cascadaUbicacion, traducirError, filtrar };
})();
