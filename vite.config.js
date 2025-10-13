import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const LAN_IP = '192.168.1.116';
const CERT_DIR = path.resolve(__dirname, 'certs');
const KEY_IP = path.join(CERT_DIR, `${LAN_IP}-key.pem`);
const CERT_IP = path.join(CERT_DIR, `${LAN_IP}-cert.pem`);

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

const hasIpCert = fs.existsSync(KEY_IP) && fs.existsSync(CERT_IP);

export default defineConfig({
  plugins: [react(), rewriteBudgetBase],
  base: '/budget-dashboard-fs/',
  server: {
    host: '0.0.0.0',
    port: 4174,
    strictPort: true,
    https: hasIpCert
      ? {
          key: fs.readFileSync(KEY_IP),
          cert: fs.readFileSync(CERT_IP),
        }
      : false,
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
      host: LAN_IP,
      port: 4174,
      protocol: hasIpCert ? 'wss' : 'ws',
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4174,
    strictPort: true,
    https: hasIpCert
      ? {
          key: fs.readFileSync(KEY_IP),
          cert: fs.readFileSync(CERT_IP),
        }
      : false,
  },
});
