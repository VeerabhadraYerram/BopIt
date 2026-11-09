import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');

function attachPairingToken(proxy: any) {
  proxy.on('proxyReq', (proxyReq: any) => {
    // The local development bridge reads the pairing token from the BopIt server's
    // private state directory. It is attached server-side and never sent to the page.
    try {
      const tokenPath = path.resolve(rootDir, '.local/pairing-token');
      const token = fs.readFileSync(tokenPath, 'utf8').trim();
      if (token) proxyReq.setHeader('x-bopit-token', token);
    } catch {}
  });
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'bopit-dashboard-session-guard',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const pathname = (req.url || '').split('?')[0];
          if (!['/api/products', '/api/reporting', '/api/subscriptions'].some(prefix => pathname.startsWith(prefix))) return next();
          const authorization = req.headers.authorization;
          if (typeof authorization !== 'string' || !/^Bearer\s+\S+$/i.test(authorization)) {
            res.statusCode = 401; res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Sign in to access dashboard services.' })); return;
          }
          try {
            const identity = await fetch('http://127.0.0.1:4320/api/dashboard/v1/profile', { headers: { authorization } });
            const body = await identity.json().catch(() => null);
            const role = body?.data?.role;
            if (!identity.ok || !['creator', 'retailer'].includes(role)) {
              res.statusCode = identity.status === 401 ? 401 : 403; res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'A valid BopIt dashboard session is required.' })); return;
            }
            if (pathname.startsWith('/api/reporting') || pathname.startsWith('/api/subscriptions')) {
              res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Channel3 reporting and alerts are not linked to this dashboard account yet.' })); return;
            }
            return next();
          } catch {
            res.statusCode = 503; res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Dashboard identity service is unavailable.' }));
          }
        });
      }
    }
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/retail': { target: 'http://127.0.0.1:4320', changeOrigin: true },
      '/api/dashboard': { target: 'http://127.0.0.1:4320', changeOrigin: true },
      '/api/products': {
        target: 'http://127.0.0.1:4317',
        changeOrigin: true,
        configure: attachPairingToken
      },
      '/api/reporting': { target: 'http://127.0.0.1:4317', changeOrigin: true, configure: attachPairingToken },
      '/api/subscriptions': { target: 'http://127.0.0.1:4317', changeOrigin: true, configure: attachPairingToken }
    }
  },
  build: { outDir: 'dist', emptyOutDir: true }
});
