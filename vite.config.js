import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IMPORTANT: base must match the subfolder you deploy to under LocalWP.
// This ensures index.html points to /budget-dashboard-fs/assets/* instead of /assets/*.
export default defineConfig({
  plugins: [react()],
  base: '/budget-dashboard-fs/',

  server: {
    port: 4174,
    strictPort: true,
    proxy: {
      // PHP api.php via /php-api  ->  http://localhost:10007/api.php
      '/php-api': {
        target: 'http://localhost:10007',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/php-api/, '/api.php'),
      },

      // WP REST via ?rest_route= using a SIMPLE prefix key (no regex keys)
      // /rest-proxy/budget/v1/state  ->  http://localhost:10007/?rest_route=/budget/v1/state
      '/rest-proxy': {
        target: 'http://localhost:10007',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/rest-proxy/, '/?rest_route='),
      },
    },
  },
});
