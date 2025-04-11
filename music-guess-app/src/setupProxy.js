const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api', // Proxy all requests starting with /api
    createProxyMiddleware({
      target: 'http://localhost:5000', // Your backend server address
      changeOrigin: true, // Needed for virtual hosted sites
    })
  );
}; 