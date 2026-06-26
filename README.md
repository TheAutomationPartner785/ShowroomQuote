# Showroom Quote Pro

App web para que los vendedores de showroom armen presupuestos (quotes) sobre los
tableros de **Monday.com**, en un flujo guiado de 4 pasos. Es una réplica de una
"Monday Vibe" en producción, llevada a una app standalone que corre en **GitHub Pages**.

---

## Arquitectura

```
┌──────────────────┐      ┌────────────────────────┐      ┌──────────────┐
│   GitHub Pages   │      │   Cloudflare Worker    │      │  Monday API  │
│  (frontend SPA)  │ ───► │   (proxy + token)      │ ───► │  (GraphQL)   │
│  React + Vite    │ ◄─── │   token_monday_riggs   │ ◄─── │              │
│  SIN token       │      │   (secret encriptado)  │      │              │
└──────────────────┘      └────────────────────────┘      └──────────────┘
        público                  privado (CF)                  privado
```

- **Frontend**: sitio estático (React) servido en GitHub Pages. No tiene ni ve el token.
- **Cloudflare Worker**: intermediario que guarda el token de Monday y lo agrega a cada request.
- **Monday**: la fuente de datos real (leads, cuentas, catálogo de productos, subitems).

---

## Cloudflare Worker — qué y por qué

**El problema:** GitHub Pages es 100% estático. Cualquier cosa en el frontend (incluido
un token) viaja al navegador y es visible con F12. Si pusiéramos el token de Monday ahí,
cualquiera podría robarlo y acceder a todos los tableros.

**La solución:** un Worker de Cloudflare que actúa de **proxy**. El frontend le pega al
Worker (no a Monday). El Worker guarda el token como **secret encriptado** (`token_monday_riggs`)
y se lo agrega a la consulta del lado del servidor. **El token nunca llega al navegador.**

Seguridad adicional:
- **CORS restringido**: solo el dominio de GitHub Pages (y `localhost` en dev) pueden usar
  el Worker. Cualquier otro origen recibe `403`.
- El token vive solo en Cloudflare. El repo puede ser público sin riesgo.

> Código y setup del Worker: ver [`worker/README.md`](worker/README.md).
> URL del proxy: `https://showroomquote-monday-proxy.tomas-372.workers.dev`

---

## Flujo de negocio (4 pasos)

```
Step 1 ─► Step 2 ─► Step 3 ─► Step 4
Lead      Productos  Review    Confirm & Save
```

1. **Lead Selection** — Se busca/selecciona un lead existente (solo los que están en
   estado *"New Lead / Needs review"* o *"Appointment Booked"*) o se crea uno nuevo
   (walk-in). Se pueden editar datos del lead al vuelo (se guardan en Monday al instante).
2. **Add Products** — Se navega el catálogo (con filtros por Brand / Type / Family /
   Category y búsqueda), se elige cantidad y se arma el carrito. Los productos
   *"Discontinued"* se excluyen automáticamente.
3. **Review** — Se verifica el lead + la lista de productos con el cliente, con totales.
4. **Confirm & Save** — Se guardan los productos como **subitems** del lead en Monday y
   se setea el estado del lead a *"Prepare Quote"* (que dispara la automación de Monday).

### Lógica clave del guardado (Step 4)

- **1 producto = 1 subitem**, con la cantidad guardada en la columna *Qty* como valor
  (qty 10 → un subitem con Qty=10, **no** 10 subitems).
- **Consolidación**: si un producto aparece repetido en el carrito, se junta en una sola
  línea sumando cantidades.
- **Diff inteligente**: compara el carrito contra los subitems existentes del lead y solo
  hace lo necesario → *crear* los nuevos, *actualizar* los que cambiaron (qty/include),
  *archivar* los que ya no están. Evita duplicados y trabajo de más.
- **Renumerado**: los subitems se renombran 1, 2, 3… según el orden del carrito.
- **Deal Value**: solo los ítems marcados como *"Include"* suman al valor del negocio
  (los *"Exclude/Option"* se guardan pero no cuentan).

---

## Boards de Monday (modelo de datos)

| Board | ID | Uso |
|---|---|---|
| Leads \| End Customers | `9074819963` | Leads/clientes (item principal del quote) |
| └ Subitems (Quote Line Items) | `9074819997` | Cada producto del presupuesto |
| Accounts | `9074823630` | Dealers/cuentas (campo "Refer Out") |
| Product Catalog | `9229297776` | Catálogo de productos (marca, familia, MSRP) |
| Contacts | `9074823021` | (no usado por la app actualmente) |

El mapeo exacto **alias → columna real** (verificado contra los tableros) vive en
[`src/api/BoardSDK.js`](src/api/BoardSDK.js). Ojo: en Product Catalog la columna con id
literal `status` es **Brand**, y el estado del producto es `color_mkqkprx1`.

---

## Caché

Hoy está **desactivada** (comentada) en los hooks. La estrategia es **carga progresiva**:
los ítems se muestran apenas llega la primera página y el resto se sigue trayendo por
detrás (filtros y búsqueda usables al instante). Para reactivar la caché de 1 hora,
descomentar los bloques marcados en `useLeads.js` y `useProducts.js`.

---

## Estructura del proyecto

```
src/
├── api/
│   ├── BoardSDK.js        # SDK propio: replica la API de Monday Vibe, arma GraphQL
│   ├── monday-client.js   # Transporte: manda las queries al Worker
│   └── monday-storage.js  # Storage en localStorage (para la caché)
├── components/            # Header, StepIndicator, BottomActionBar, Step1-4, modales, tablas
├── hooks/                 # useLeads, useDealers, useProducts, useSubitems, withRetry
├── App.jsx               # Orquestador del wizard (estado de pasos, lead, carrito)
└── theme-tokens.css      # Variables de color/espaciado
worker/                   # Cloudflare Worker (proxy a Monday)
```

> **`BoardSDK.js`** es nuestra réplica del SDK que Monday genera en runtime (no se podía
> copiar). Expone la misma API fluida que usa el código (`board.items().where().execute()`,
> `board.item(id).update()`, `.subitem().create()`, etc.) pero por dentro habla con el Worker.

---

## Stack

React 18 · Vite 5 · Chakra UI v3 · lucide-react · Cloudflare Workers · Monday GraphQL API.

---

## Desarrollo y deploy

**Local:**
```bash
npm install
npm run dev          # http://localhost:8080
```

**Ramas:**
- `main` → código fuente (desarrollo).
- `git-hub-page` → build de producción que sirve GitHub Pages.

**Publicar a producción:**
```bash
npm run build        # genera dist/
# copiar el contenido de dist/ a la rama git-hub-page y pushear
```

### 🔗 Producción: https://theautomationpartner785.github.io/ShowroomQuote/

---

## Seguridad — pendientes recomendados

- Rotar el token de Monday y reemplazar el secret en Cloudflare.
- Activar 2FA en la cuenta de Cloudflare (es la última puerta del token).
