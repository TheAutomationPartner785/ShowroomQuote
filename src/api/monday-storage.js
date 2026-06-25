/**
 * monday-storage — reemplazo del storage de Monday usando localStorage.
 *
 * En Monday Vibe el storage era una API del SDK inyectada en runtime. Acá, al
 * correr en GitHub Pages, persistimos en localStorage del navegador, manteniendo
 * EXACTAMENTE la misma interfaz que usa la app:
 *
 *   const { value, version } = await storage().key('k').get();
 *   await storage().key('k').version(version).set(data);
 *   await storage().key('k').del();
 *
 * La ventana de caché (1 hora) la controlan los hooks vía el timestamp guardado
 * dentro de `value`; este módulo solo persiste y versiona.
 */

const PREFIX = 'sqp_'; // Showroom Quote Pro

function readRaw(fullKey) {
  try {
    const raw = localStorage.getItem(fullKey);
    if (!raw) return { value: null, version: 0 };
    const parsed = JSON.parse(raw);
    return { value: parsed.value ?? null, version: parsed.version ?? 0 };
  } catch (err) {
    console.error('[monday-storage] read failed:', err);
    return { value: null, version: 0 };
  }
}

export function storage() {
  return {
    key(key) {
      const fullKey = PREFIX + key;
      return {
        async get() {
          return readRaw(fullKey);
        },
        version(version) {
          return {
            async set(data) {
              const nextVersion = (Number(version) || 0) + 1;
              try {
                localStorage.setItem(
                  fullKey,
                  JSON.stringify({ value: data, version: nextVersion })
                );
              } catch (err) {
                console.error('[monday-storage] write failed:', err);
              }
              return { version: nextVersion };
            },
          };
        },
        async del() {
          try {
            localStorage.removeItem(fullKey);
          } catch (err) {
            console.error('[monday-storage] delete failed:', err);
          }
          return { success: true };
        },
      };
    },
  };
}
