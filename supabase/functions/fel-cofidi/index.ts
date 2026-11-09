// Edge Function «fel-cofidi»: certifica, anula y consulta DTE en línea con el certificador COFIDI.
// Es la versión en la nube de PK_FEL_DTE.p_crearDocEnvio + p_sendRequest (UTL_HTTP) del sistema anterior:
//   1. Con la sesión del usuario llama a sat_fel_preparar (valida permisos y el documento, y arma el XML del DTE).
//   2. Arma el sobre SOAP RequestTransaction (xmlns http://www.fact.com.mx/schema/ws) con el Requestor y el usuario
//      de COFIDI, el NIT emisor y el XML en Base64, y lo envía al web service configurado en sat_fel_conexiones.
//   3. Con la llave de servicio registra la respuesta (sat_fel_registrar_respuesta): autorización, serie, número,
//      fecha de certificación y XML certificado, y actualiza la factura o nota.
// Credenciales: nunca en tablas, en el repositorio ni en el navegador. Van en Edge Functions › Secrets:
//   COFIDI_REQUESTOR y COFIDI_USUARIO (o <prefijo>_REQUESTOR_<localidad_id> / <prefijo>_USUARIO_<localidad_id>
//   si cada establecimiento tiene las suyas; el prefijo es sat_fel_conexiones.secreto).
// Instalación: Edge Functions › Deploy a new function › nombre «fel-cofidi» › pegar este archivo › Deploy.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const x = (t: unknown) =>
  String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function base64Utf8(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function secreto(prefijo: string, nombre: string, localidad: number): string | undefined {
  return Deno.env.get(`${prefijo}_${nombre}_${localidad}`) ?? Deno.env.get(`${prefijo}_${nombre}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Método no permitido" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let procesoId: number | null = null;
  try {
    const { origen, id, proceso = "CERTIFICAR", motivo = null } = await req.json();
    if (!["FACTURA", "NOTA"].includes(origen) || !Number(id)) return responder({ error: "Indica el documento (FACTURA o NOTA) y su id." }, 400);

    // 1. Preparar con la sesión del usuario (permisos y validaciones en la base de datos).
    const usuario = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: prep, error: e1 } = await usuario.rpc("sat_fel_preparar", { p_origen: origen, p_id: Number(id), p_proceso: proceso, p_motivo: motivo });
    if (e1) return responder({ error: e1.message }, 400);
    procesoId = prep.id;

    // 2. Conexión y credenciales.
    const { data: cx } = await admin.from("sat_fel_conexiones").select("*").eq("localidad_id", prep.localidad_id).maybeSingle();
    const falla = async (msg: string) => {
      const { data } = await admin.rpc("sat_fel_registrar_respuesta", { p_id: procesoId, p_http: null, p_respuesta: null, p_error: msg });
      return responder({ ...(data ?? {}), ok: false, error: msg }, 200);
    };
    if (!cx || !cx.activo || !cx.url) return await falla("La conexión con COFIDI de este establecimiento no está configurada o activa (Integraciones SAT › Conexión FEL).");
    const requestor = secreto(cx.secreto || "COFIDI", "REQUESTOR", prep.localidad_id);
    const user = secreto(cx.secreto || "COFIDI", "USUARIO", prep.localidad_id);
    if (!requestor || !user) return await falla(`Faltan los secretos ${cx.secreto || "COFIDI"}_REQUESTOR y ${cx.secreto || "COFIDI"}_USUARIO en Supabase (Edge Functions › Secrets).`);

    // Datos según el tipo de conexión del sistema anterior: 1 certificar (Data1 identificador, Data2 XML, Data3 no. interno),
    // 2 anular (Data1 identificador, Data2 XML), 3 consultar (Data1 no. interno).
    let data1 = "", data2 = "", data3 = "", transaccion = cx.transaccion;
    if (proceso === "CERTIFICAR") { data1 = cx.dato_certificar; data2 = base64Utf8(prep.xml); data3 = prep.no_interno; }
    else if (proceso === "ANULAR") { data1 = cx.dato_anular; data2 = base64Utf8(prep.xml); }
    else { data1 = prep.no_interno; transaccion = cx.transaccion_consulta || cx.transaccion; }

    const sobre = `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><RequestTransaction xmlns="http://www.fact.com.mx/schema/ws">`
      + `<Requestor>${x(requestor)}</Requestor><Transaction>${x(transaccion)}</Transaction><Country>GT</Country><Entity>${x(prep.nit_emisor)}</Entity>`
      + `<User>${x(requestor)}</User><UserName>${x(user)}</UserName><Data1>${x(data1)}</Data1><Data2>${x(data2)}</Data2><Data3>${x(data3)}</Data3>`
      + `</RequestTransaction></soap:Body></soap:Envelope>`;

    // 3. Enviar (60 s como el sistema anterior) y registrar la respuesta.
    await admin.rpc("sat_fel_marcar_enviado", { p_id: procesoId });
    const headers: Record<string, string> = { "Content-Type": "text/xml; charset=utf-8" };
    if (cx.soap_action) headers["SOAPAction"] = cx.soap_action;
    let status = 0, texto = "";
    try {
      const r = await fetch(cx.url, { method: "POST", headers, body: sobre, signal: AbortSignal.timeout(60000) });
      status = r.status; texto = await r.text();
    } catch (e) {
      return await falla(`No hubo respuesta de COFIDI (${(e as Error).message}). Usa «Consultar en COFIDI» antes de volver a certificar.`);
    }
    const { data: res, error: e2 } = await admin.rpc("sat_fel_registrar_respuesta", { p_id: procesoId, p_http: status, p_respuesta: texto, p_error: status === 200 ? null : `COFIDI respondió HTTP ${status}.` });
    if (e2) return responder({ ok: false, error: e2.message, proceso: procesoId }, 500);
    return responder(res);
  } catch (e) {
    if (procesoId) await admin.rpc("sat_fel_registrar_respuesta", { p_id: procesoId, p_http: null, p_respuesta: null, p_error: (e as Error).message });
    return responder({ ok: false, error: (e as Error).message }, 500);
  }
});
