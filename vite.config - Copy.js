import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const LAN_IP = '192.168.1.116'; // update if your PC IP changes
const MODE = (process.env.VITE_DEV_HOST || 'lan').toLowerCase(); // 'localhost' | 'lan'
const useLan = MODE === 'lan';

const CERT_DIR = path.resolve(__dirname, 'certs');
const KEY_LOCAL = path.join(CERT_DIR, 'localhost-key.pem');
const CERT_LOCAL = path.join(CERT_DIR, 'localhost-cert.pem');
const hasLocalCert = fs.existsSync(KEY_LOCAL) && fs.existsSync(CERT_LOCAL);

const localHttps = hasLocalCert
  ? {
      key: fs.readFileSync(KEY_LOCAL),
      cert: fs.readFileSync(CERT_LOCAL),
    }
  : false;

const rewriteBudgetBase = {
  name: 'rewrite-budget-base',
  configureServer(server) {
    return () => {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next();

        if (req.url === '/budget-dashboard-fs' || req.url === '/budget-dashboard-fs/') {
          req.url = '/';
        } else if (req.url.startsWith('/budget-dashboard-fs/')) {
          const isAsset = /\.\w+$/.test(req.url.split('?')[0]);
          if (!isAsset) req.url = '/';
        }

        next();
      });
    };
  },
};

export default defineConfig({
  plugins: [react(), rewriteBudgetBase],
  base: '/budget-dashboard-fs/',
  server: {
    host: useLan ? '0.0.0.0' : '127.0.0.1',
    port: 4174,
    strictPort: true,
    https: useLan ? false : localHttps,
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
      },
    },
    hmr: {
      host: useLan ? LAN_IP : 'localhost',
      port: 4174,
      protocol: useLan ? 'ws' : hasLocalCert ? 'wss' : 'ws',
    },
  },
  preview: {
    host: useLan ? '0.0.0.0' : '127.0.0.1',
    port: 4174,
    strictPort: true,
    https: useLan ? false : localHttps,
  },
  build: {
    manifest: 'manifest.json',
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
});