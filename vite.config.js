import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwind()],
  // IMPORTANT: app is served from this subfolder in WordPress
  base: '/budget-dashboard-fs/',
});
