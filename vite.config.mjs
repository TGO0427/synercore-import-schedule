import react from '@vitejs/plugin-react'

const TUNNEL_HOST = process.env.VITE_TUNNEL_HOST ?? "";

export default {
  plugins: [react()],
  server: {
    port: 3002,
    host: '0.0.0.0',
    // ✅ add the exact host string alongside your regex
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'f5797077a9ef.ngrok-free.app',
      /\.ngrok(-free)?\.app$/
    ],
    proxy: { '/api': { target: 'http://localhost:5001', changeOrigin: true, secure: false } },
    hmr: TUNNEL_HOST ? { protocol: 'wss', host: TUNNEL_HOST, clientPort: 443 } : true
  },
  build: { outDir: 'dist' }
}
// Deployment timestamp: 2025-10-06

