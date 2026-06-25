/**
 * Cloudflare Worker — Proxy seguro hacia la API de Monday.com
 *
 * El frontend (GitHub Pages) le pega a este Worker en lugar de pegarle
 * directo a Monday. El token vive como secret en Cloudflare (env.MONDAY_TOKEN)
 * y NUNCA viaja al navegador.
 *
 * Flujo:  navegador  ->  este Worker (agrega el token)  ->  api.monday.com
 */

// Dominios autorizados a usar este Worker (CORS).
// Solo estos orígenes pueden hacer requests; cualquier otro recibe 403.
const ALLOWED_ORIGINS = [
  "https://theautomationpartner785.github.io", // GitHub Pages (producción)
  "http://localhost:8080",                      // desarrollo local
  "http://127.0.0.1:8080",
];

const MONDAY_API_URL = "https://api.monday.com/v2";

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    // 1) Preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // 2) Solo aceptamos POST
    if (request.method !== "POST") {
      return json({ error: "Método no permitido. Usá POST." }, 405, origin);
    }

    // 3) Bloqueo por origen: si no está en la lista, no pasa
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: "Origen no autorizado." }, 403, origin);
    }

    // 4) El token tiene que estar configurado como secret en Cloudflare
    //    (el nombre del secret en Cloudflare es token_monday_riggs)
    if (!env.token_monday_riggs) {
      return json({ error: "token_monday_riggs no configurado en el Worker." }, 500, origin);
    }

    // 5) Tomamos el body (la consulta GraphQL) tal cual lo manda el frontend
    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Body inválido: se esperaba JSON." }, 400, origin);
    }

    // 6) Reenviamos a Monday agregando el token del lado del servidor
    try {
      const mondayResp = await fetch(MONDAY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": env.token_monday_riggs,
          "API-Version": "2024-10",
        },
        body: JSON.stringify(payload),
      });

      const data = await mondayResp.text();
      return new Response(data, {
        status: mondayResp.status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(origin),
        },
      });
    } catch (err) {
      return json({ error: "Fallo al contactar Monday.", detail: String(err) }, 502, origin);
    }
  },
};

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}
