import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// La app se sirve desde GitHub Pages en /ShowroomQuote/ (rama git-hub-page).
// En dev se sirve en la raíz. El puerto 8080 coincide con la allowlist de CORS
// del Cloudflare Worker (ALLOWED_ORIGINS), para poder pegarle a Monday en local.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ShowroomQuote/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@api': fileURLToPath(new URL('./src/api', import.meta.url)),
    },
  },
  server: {
    port: 8080,
    strictPort: true,
  },
}));
