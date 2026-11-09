// Certificación en línea con COFIDI (Edge Function «fel-cofidi», migración 166).
// window.FEL_COFIDI.enviar(sb, { origen: 'FACTURA'|'NOTA', id, proceso: 'CERTIFICAR'|'ANULAR'|'CONSULTAR', motivo })
// devuelve { ok, estado, mensaje, autorizacion, serie, numero_dte, ... } o lanza un Error con el motivo.
// Al certificar, si el último envío del documento se quedó sin respuesta, primero consulta en COFIDI para no
// certificarlo dos veces.
(function () {
  async function invocar(sb, body) {
    const { data, error } = await sb.functions.invoke('fel-cofidi', { body });
    if (error) {
      let detalle = error.message || String(error);
      try { const j = await error.context?.json?.(); if (j?.error) detalle = j.error; } catch (_) { /* sin cuerpo */ }
      if (error.context?.status === 404 || /Failed to send|not found|404/i.test(detalle)) throw new Error('La función «fel-cofidi» no está instalada en Supabase (Edge Functions).');
      throw new Error(detalle);
    }
    if (data && data.ok === false && data.error && !data.estado) throw new Error(data.error);
    return data;
  }

  async function enviar(sb, { origen, id, proceso = 'CERTIFICAR', motivo = null }) {
    if (proceso === 'CERTIFICAR') {
      const campo = origen === 'NOTA' ? 'nota_venta_id' : 'factura_venta_id';
      const { data: ult } = await sb.from('sat_fel_procesos').select('id, estado, http_status').eq(campo, id).eq('proceso', 'CERTIFICAR').order('id', { ascending: false }).limit(1).maybeSingle();
      if (ult && (ult.estado === 'ENVIADO' || (ult.estado === 'ERROR' && !ult.http_status))) {
        const c = await invocar(sb, { origen, id, proceso: 'CONSULTAR' });
        if (c?.ok) return c;
      }
    }
    return invocar(sb, { origen, id, proceso, motivo });
  }

  window.FEL_COFIDI = { enviar };
})();
