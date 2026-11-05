// Edge Function «manual-modulo»: genera con Claude el manual de un módulo como presentación.
// Recibe la estructura del módulo (grupos, subgrupos y pantallas con su descripción) y ejemplos de la
// información que ya existe; devuelve las diapositivas en JSON. Solo la llama un usuario con sesión
// (verify_jwt) y que sea administrador. La clave de Anthropic vive en los secretos de Supabase
// (ANTHROPIC_API_KEY), nunca en el repositorio ni en el navegador.
// Instalación (panel de Supabase): Edge Functions › Deploy a new function › nombre «manual-modulo» ›
// pegar este archivo › Deploy; luego Edge Functions › Secrets › ANTHROPIC_API_KEY = la clave de Anthropic.
import Anthropic from "npm:@anthropic-ai/sdk@1.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Esquema de la presentación (salida estructurada).
const texto = { type: "string" };
const lista = { type: "array", items: { type: "string" } };
const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["titulo", "resumen", "diapositivas"],
  properties: {
    titulo: texto,
    resumen: texto,
    diapositivas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tipo", "titulo", "subtitulo", "puntos", "pasos", "ejemplo", "nota"],
        properties: {
          tipo: { type: "string", enum: ["portada", "indice", "concepto", "pantalla", "pasos", "ejemplo", "consejos", "cierre"] },
          titulo: texto,
          subtitulo: texto,
          puntos: lista,
          pasos: lista,
          ejemplo: {
            type: "object",
            additionalProperties: false,
            required: ["titulo", "columnas", "filas"],
            properties: { titulo: texto, columnas: lista, filas: { type: "array", items: lista } },
          },
          nota: texto,
        },
      },
    },
  },
};

const SISTEMA = `Eres el redactor de manuales de usuario de CONSISAV Financiero, un sistema contable, financiero y
administrativo para empresas de Guatemala (quetzales, SAT, FEL, NIT, IVA 12 %). Escribes en español de
Guatemala, claro y profesional, para usuarios de negocio (contadores, compras, bancos), no para programadores.

Con la estructura del módulo y los ejemplos de datos reales que recibes, arma un manual en forma de
presentación de 12 a 22 diapositivas:
- portada (título del módulo y para qué sirve), índice (los grupos del menú), una diapositiva «concepto» con
  el flujo general del módulo;
- por cada pantalla importante una diapositiva «pantalla» (qué hace, sus campos y botones principales) y,
  cuando la operación tiene varios pasos, una «pasos» con los pasos numerados de operación tal como se
  hacen en el sistema (menú › grupo › opción, botones Nueva, Modificar, Guardar, Procesar, Imprimir…);
- diapositivas «ejemplo» que usen los datos reales recibidos (tablas de 2 a 5 filas con sus columnas);
- una de «consejos» (validaciones, errores comunes, buenas prácticas) y un «cierre».
Usa solo las pantallas y datos que recibes; no inventes pantallas, campos ni cifras. Puntos breves (máximo
6 por diapositiva, de una línea). Los campos que no apliquen a una diapositiva van vacíos ("" o []), y
«ejemplo» lleva titulo "" y listas vacías cuando no hay tabla.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Método no permitido" }, 405);
  try {
    // Solo un administrador con sesión puede generar el manual (cada generación consume la API).
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: admin, error: e1 } = await sb.rpc("puede_editar_catalogos");
    if (e1 || !admin) return responder({ error: "Solo un administrador puede generar el manual con IA." }, 403);
    if (!Deno.env.get("ANTHROPIC_API_KEY")) return responder({ error: "Falta el secreto ANTHROPIC_API_KEY en Supabase (Edge Functions › Secrets)." }, 500);

    const { modulo, estructura, ejemplos } = await req.json();
    if (!modulo?.nombre || !Array.isArray(estructura)) return responder({ error: "Faltan los datos del módulo." }, 400);

    const client = new Anthropic();
    const stream = client.beta.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
      system: SISTEMA,
      messages: [{
        role: "user",
        content: `Módulo: ${modulo.nombre}\nDescripción: ${modulo.descripcion ?? ""}\n\n` +
          `Estructura del menú (grupos, subgrupos y pantallas):\n${JSON.stringify(estructura, null, 1)}\n\n` +
          `Ejemplos de la información que existe hoy en el sistema (pocas filas por tabla):\n${JSON.stringify(ejemplos ?? {}, null, 1)}`,
      }],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") return responder({ error: "El modelo no pudo generar el manual de este módulo." }, 422);
    if (msg.stop_reason === "max_tokens") return responder({ error: "El manual quedó incompleto (límite de salida); inténtalo de nuevo." }, 502);
    const bloque = msg.content.find((b) => b.type === "text");
    if (!bloque || bloque.type !== "text") return responder({ error: "Respuesta vacía del modelo." }, 502);
    const manual = JSON.parse(bloque.text);
    return responder({ manual, modelo: msg.model, uso: msg.usage });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return responder({ error: "La clave ANTHROPIC_API_KEY no es válida." }, 500);
    if (err instanceof Anthropic.RateLimitError) return responder({ error: "Límite de uso de la API alcanzado; inténtalo en unos minutos." }, 429);
    if (err instanceof Anthropic.APIError) return responder({ error: `Error de la API (${err.status}): ${err.message}` }, 502);
    return responder({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
