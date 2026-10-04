// In sviluppo (npm start) inoltra le chiamate /api al backend Express rimuovendo il prefisso:
// /api/documents -> http://localhost:3000/documents. In Docker lo stesso compito lo svolge nginx.
const { createProxyMiddleware } = require('http-proxy-middleware');

// Le analisi AI possono durare alcuni minuti
const TIMEOUT_MS = 10 * 60 * 1000;

module.exports = function setupProxy(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: process.env.BACKEND_URL || 'http://localhost:3000',
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
      timeout: TIMEOUT_MS,
      proxyTimeout: TIMEOUT_MS,
    })
  );
};
