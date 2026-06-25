/**
 * monday-client — transporte hacia Monday.com a través del Cloudflare Worker.
 *
 * En el entorno original de Monday Vibe, el SDK usaba monday.api() con la sesión
 * interna (por eso no pedía token). Acá, al ser una app externa en GitHub Pages,
 * mandamos las consultas GraphQL al Worker, que les agrega el token del lado del
 * servidor. El token NUNCA llega al navegador.
 */

// URL del Worker proxy desplegado en Cloudflare.
const WORKER_URL = 'https://showroomquote-monday-proxy.tomas-372.workers.dev';

/**
 * Ejecuta una consulta/mutación GraphQL contra Monday vía el Worker.
 * @param {string} query - GraphQL query o mutation.
 * @param {object} [variables] - Variables del GraphQL.
 * @returns {Promise<object>} - data de la respuesta.
 */
export async function mondayApi(query, variables = {}) {
  let resp;
  try {
    resp = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
  } catch (networkErr) {
    throw new Error(`Network error contacting Monday: ${networkErr.message}`);
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Monday proxy HTTP ${resp.status}: ${body}`);
  }

  const json = await resp.json();

  if (json.errors && json.errors.length > 0) {
    const msg = json.errors.map((e) => e.message).join(' | ');
    throw new Error(`Monday GraphQL error: ${msg}`);
  }

  return json.data;
}
