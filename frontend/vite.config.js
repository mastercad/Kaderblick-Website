
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';

// Get git commit hash for build info
let commitHash = '';
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  commitHash = 'unknown';
}

export default defineConfig({
  define: {
    __BUILD_COMMIT__: JSON.stringify(commitHash),
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // Service Worker auch im Dev-Modus aktivieren (für Push-Tests)
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: 'Kaderblick Fußballverein',
        short_name: 'Kaderblick',
        start_url: '.',
        display: 'standalone',
        background_color: '#4e4e4e',
        theme_color: '#B5AD9D',
        description: 'Die Vereinsapp für Mitglieder, Teams und Fans.',
        icons: [
          {
            src: '/images/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/images/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB - Hauptbundle ist >2MB
        globPatterns: ['**/*.{js,css,html,png,svg,ico,json}'],
        globIgnores: [
          'uploads/**',
        ]
      }
    }),
  ],
  /* Wahrscheinlich sinnfrei, bleibt aber erstmal drin, der login modal für google sso jetzt erstmal so funktioniert */
  server: {
    middlewareMode: false,
    setupMiddlewares(middlewares) {
      middlewares.use((req, res, next) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
        next();
      });
      return middlewares;
    }
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('react-big-calendar') || id.includes('/moment/') || id.includes('/moment-timezone')) {
            return 'calendar-vendor';
          }

          if (id.includes('@tiptap') || id.includes('/prosemirror-') || id.includes('/orderedmap/') || id.includes('/rope-sequence/') || id.includes('/w3c-keyname/')) {
            return 'editor-vendor';
          }

          if (id.includes('@mui/icons-material')) {
            return 'mui-icons-vendor';
          }

          if (id.includes('@mui/x-charts') || id.includes('chart.js') || id.includes('react-chartjs-2')) {
            return 'charts-vendor';
          }

          if (id.includes('@dnd-kit') || id.includes('@hello-pangea/dnd')) {
            return 'dnd-vendor';
          }

          if (id.includes('html2canvas') || id.includes('react-easy-crop') || id.includes('qrcode.react')) {
            return 'media-vendor';
          }

          if (id.includes('workbox')) {
            return 'pwa-vendor';
          }

          if (id.includes('/lodash/') || id.includes('/lodash-es/')) {
            return 'lodash-vendor';
          }

          if (id.includes('/react-icons/')) {
            return 'icons-vendor';
          }

          if (id.includes('/linkifyjs/')) {
            return 'linkify-vendor';
          }

          if (id.includes('/react-youtube/') || id.includes('/youtube-player/')) {
            return 'youtube-vendor';
          }

          if (id.includes('/@popperjs/core/')) {
            return 'popper-vendor';
          }

          if (id.includes('@mui') || id.includes('@emotion')) {
            return 'mui-vendor';
          }

          if (id.includes('react-router')) {
            return 'router-vendor';
          }

          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'react-vendor';
          }

          return 'vendor';
        }
      }
    }
  }
})
