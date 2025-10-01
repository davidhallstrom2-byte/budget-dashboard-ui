import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/budget-dashboard-fs/',
  server: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
    proxy: {
      '/wp-json': {
        target: 'http://main-dashboard.local',
        changeOrigin: true,
        secure: false,
      },
      '/budget-dashboard-fs/save.php': {
        target: 'http://main-dashboard.local',
        changeOrigin: true,
        secure: false,
      }
    }
  },
});