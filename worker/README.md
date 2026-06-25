# Monday Proxy — Cloudflare Worker

Proxy seguro entre el frontend (GitHub Pages) y la API de Monday.com.
El token de Monday vive como *secret* en Cloudflare y **nunca** llega al navegador.

## Setup (una sola vez)

```bash
cd worker
npm install

# 1) Iniciar sesión en Cloudflare (abre el navegador)
npx wrangler login

# 2) Cargar el token de Monday como secret (te lo pide por consola, no se ve)
npx wrangler secret put MONDAY_TOKEN

# 3) Desplegar
npx wrangler deploy
```

Al desplegar te da una URL del tipo:
`https://showroomquote-monday-proxy.<tu-subdominio>.workers.dev`

Esa es la URL a la que le pega el frontend (en vez de `api.monday.com`).

## Cómo lo llama el frontend

```js
fetch("https://showroomquote-monday-proxy.<tu-subdominio>.workers.dev", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "{ boards { id name } }" })
})
  .then(r => r.json())
  .then(console.log);
```

## Seguridad

- **CORS**: solo los dominios en `ALLOWED_ORIGINS` (en `src/index.js`) pueden usar el Worker.
- **Token**: cargado con `wrangler secret put`, encriptado en Cloudflare, fuera de git.
- Si cambia el dominio de producción, actualizá `ALLOWED_ORIGINS` y volvé a desplegar.

## Desarrollo local

```bash
npx wrangler dev
```
Para probar local, creá un archivo `.dev.vars` (ya está en `.gitignore`) con:
```
MONDAY_TOKEN=tu_token_de_prueba
```
