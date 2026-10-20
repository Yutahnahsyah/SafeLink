import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Share only this frontend port. Express remains on the host's loopback interface.
  // https://vite.dev/config/server-options#server-proxy
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/realtime/socket.io': { target: 'http://127.0.0.1:5000', changeOrigin: false, ws: true },
      '^/api(?:/|$)': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('error', (_error, _request, response) => {
            if ('writeHead' in response && !response.headersSent && !response.destroyed) {
              response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
              response.end(JSON.stringify({ code: 'SERVER_ERROR', message: 'SafeLink API is temporarily unavailable. Please try again.' }));
            }
          });
        },
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1100,
  },
});
