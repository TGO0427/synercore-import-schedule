import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const TUNNEL_HOST = process.env.VITE_TUNNEL_HOST ?? "";

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(process.env.VITE_SENTRY_DSN),
  },
  server: {
    port: 3002,
    host: '0.0.0.0',
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'f5797077a9ef.ngrok-free.app',
      /\.ngrok(-free)?\.app$/
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false
      }
    },
    hmr: TUNNEL_HOST ? { protocol: 'wss', host: TUNNEL_HOST, clientPort: 443 } : true
  },
  build: {
    outDir: 'dist',
    minify: 'terser',
    target: 'ES2020',
    sourcemap: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 600,
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true
      },
      format: {
        comments: false
      }
    },
    rollupOptions: {
      input: {
        main: './index.html',
        supplier: './supplier.html'
      },
      output: {
        manualChunks: (id) => {
          // Split node_modules into separate chunks
          if (id.includes('node_modules')) {
            if (id.includes('react')) {
              return 'react-vendor';
            }
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory') || id.includes('react-smooth')) {
              return 'recharts-vendor';
            }
            if (id.includes('chart.js') || id.includes('react-chartjs') || id.includes('jspdf')) {
              return 'chart-vendor';
            }
            if (id.includes('zustand') || id.includes('socket.io')) {
              return 'state-vendor';
            }
            return 'vendor';
          }
          // Split components
          if (id.includes('components')) {
            return 'components';
          }
          // Split pages/routes
          if (id.includes('pages') || id.includes('app')) {
            return 'pages';
          }
          // Split utils
          if (id.includes('utils') || id.includes('services')) {
            return 'utils';
          }
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
})
// Deployment timestamp: 2025-10-06

