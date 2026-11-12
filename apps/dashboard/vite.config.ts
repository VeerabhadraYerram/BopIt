import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');

function getPairingToken(): string {
  try {
    const tokenPath = path.resolve(rootDir, '.local/pairing-token');
    if (fs.existsSync(tokenPath)) {
      return fs.readFileSync(tokenPath, 'utf8').trim();
    }
  } catch {}
  return '';
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'channel3-dev-bridge',
      configureServer(server) {
        server.middlewares.use('/api/channel3/state', (_req, res) => {
          try {
            const statePath = path.resolve(rootDir, '.local/commerce-state.json');
            if (fs.existsSync(statePath)) {
              const content = fs.readFileSync(statePath, 'utf8');
              res.setHeader('Content-Type', 'application/json');
              res.end(content);
              return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ watches: [], events: [], deliveries: [] }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err?.message || 'Failed to read commerce state' }));
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
      '/api/commerce': {
        target: 'http://127.0.0.1:4317',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && !('headersSent' in res && res.headersSent)) {
              try {
                (res as any).writeHead(503, { 'Content-Type': 'application/json' });
                (res as any).end(JSON.stringify({
                  error: 'Recognition server offline (127.0.0.1:4317)',
                  message: 'Recognition server not running on port 4317. Start with npm start in another terminal.'
                }));
              } catch {}
            }
          });
          proxy.on('proxyReq', (proxyReq) => {
            const token = getPairingToken();
            if (token && !proxyReq.getHeader('x-bopit-token')) {
              proxyReq.setHeader('x-bopit-token', token);
            }
          });
        }
      },
      '/api/products': {
        target: 'http://127.0.0.1:4317',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && !('headersSent' in res && res.headersSent)) {
              try {
                (res as any).writeHead(503, { 'Content-Type': 'application/json' });
                (res as any).end(JSON.stringify({
                  error: 'Recognition server offline (127.0.0.1:4317)',
                  message: 'Recognition server not running on port 4317. Start with npm start in another terminal.'
                }));
              } catch {}
            }
          });
          proxy.on('proxyReq', (proxyReq) => {
            const token = getPairingToken();
            if (token && !proxyReq.getHeader('x-bopit-token')) {
              proxyReq.setHeader('x-bopit-token', token);
            }
          });
        }
      }
    }
  },
  build: { outDir: 'dist', emptyOutDir: true }
});
