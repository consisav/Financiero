// Tickets: botones Modificar y Eliminar de cada fila (Generación, Asignación, Seguimiento y Cierre).
// Eliminar solo está habilitado para el Super Administrador: borra el ticket con todo lo suyo y
// sus archivos adjuntos.
(function () {
  const { esc } = window.UI;

  window.TICKETS = {
    // Columna de acciones de una fila del maestro.
    botones(t, { modificar = true, textoModificar = 'Modificar' } = {}) {
      const superAdmin = window.FIN.esSuperAdmin();
      return `
        <td class="tk-acciones">
          <button type="button" class="tk-accion-btn" data-modificar="${t.id}" ${modificar ? '' : 'disabled'} title="${esc(textoModificar)} el ticket ${esc(t.numero)}"><i class="ti ti-pencil" aria-hidden="true"></i> ${esc(textoModificar)}</button>
          <button type="button" class="tk-accion-btn peligro" data-eliminar="${t.id}" ${superAdmin ? '' : 'disabled'} title="${superAdmin ? `Eliminar el ticket ${esc(t.numero)}` : 'Solo el Super Administrador puede eliminar tickets'}"><i class="ti ti-trash" aria-hidden="true"></i> Eliminar</button>
        </td>`;
    },

    // Pide confirmación, quita los archivos del ticket y lo elimina. Devuelve true si se eliminó.
    async eliminar(t) {
      const sb = window.FIN.sb;
      if (!window.FIN.esSuperAdmin()) { window.FIN.aviso('Solo el Super Administrador puede eliminar tickets'); return false; }
      if (!confirm(`¿Eliminar el ticket ${t.numero}? Se borran también sus asignaciones, procesos, seguimiento, cierre y archivos adjuntos. No se puede deshacer.`)) return false;
      const { data: archivos } = await sb.from('ticket_adjuntos').select('ruta').eq('ticket_id', t.id);
      if (archivos && archivos.length) await sb.storage.from('tickets').remove(archivos.map((a) => a.ruta));
      const { error } = await sb.rpc('eliminar_ticket', { p_id: t.id });
      if (error) {
        window.FIN.aviso(/eliminar_ticket/.test(error.message) ? 'Falta instalar el script 32 (modificar y eliminar tickets) en Supabase.' : window.UI.traducirError(error));
        return false;
      }
      window.FIN.aviso(`Ticket ${t.numero} eliminado`);
      return true;
    }
  };
})();
