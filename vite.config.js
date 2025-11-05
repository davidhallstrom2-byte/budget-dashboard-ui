import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const LAN_IP = '192.168.1.116'; // update if your PC IP changes
const MODE = (process.env.VITE_DEV_HOST || 'localhost').toLowerCase(); // 'localhost' | 'lan'

const CERT_DIR = path.resolve(__dirname, 'certs');
const KEY_LOCAL = path.join(CERT_DIR, 'localhost-key.pem');
const CERT_LOCAL = path.join(CERT_DIR, 'localhost-cert.pem');
const KEY_LAN = path.join(CERT_DIR, `${LAN_IP}-key.pem`);
const CERT_LAN = path.join(CERT_DIR, `${LAN_IP}-cert.pem`);

const useLan = MODE === 'lan';
const keyPath = useLan ? KEY_LAN : KEY_LOCAL;
const certPath = useLan ? CERT_LAN : CERT_LOCAL;
const hasCert = fs.existsSync(keyPath) && fs.existsSync(certPath);

// Rewrite so /budget-dashboard-fs/* works in dev + HTTP to HTTPS redirect
const rewriteBudgetBase = {
  name: 'rewrite-budget-base',
  configureServer(server) {
    return () => {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        
        // HTTP to HTTPS redirect (301) - Check if request came via HTTP
        // This works when Vite is behind a proxy or when accessed via non-standard ports
        const protocol = req.headers['x-forwarded-proto'] || (req.connection.encrypted ? 'https' : 'http');
        
        if (hasCert && protocol === 'http') {
          const host = req.headers.host || (useLan ? `${LAN_IP}:4174` : 'localhost:4174');
          // Remove any port number and add :4174 for HTTPS
          const hostWithoutPort = host.split(':')[0];
          const redirectUrl = `https://${hostWithoutPort}:4174${req.url}`;
          
          console.log(`[HTTP→HTTPS Redirect] ${req.url} → ${redirectUrl}`);
          res.writeHead(301, { 
            'Location': redirectUrl,
            'Content-Type': 'text/plain'
          });
          res.end(`Redirecting to ${redirectUrl}`);
          return;
        }
        
        // Budget base path rewrite
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
    https: hasCert
      ? {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
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
      host: useLan ? LAN_IP : 'localhost',
      port: 4174,
      protocol: hasCert ? (useLan ? 'wss' : 'wss') : 'ws',
    },
  },
  preview: {
    host: useLan ? '0.0.0.0' : '127.0.0.1',
    port: 4174,
    strictPort: true,
    https: hasCert
      ? {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        }
      : false,
  },
});