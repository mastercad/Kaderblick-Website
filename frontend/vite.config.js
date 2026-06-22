
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function appShellManifestTransform(entries) {
  const entriesByUrl = new Map(entries.map(entry => [entry.url, entry]));
  const keep = new Set(['index.html', 'manifest.webmanifest', 'registerSW.js']);
  const queue = ['index.html'];

  while (queue.length > 0) {
    const currentUrl = queue.shift();
    if (!currentUrl) continue;

    let source;
    try {
      source = readFileSync(resolve('dist', currentUrl), 'utf8');
    } catch {
      continue;
    }

    const references = currentUrl.endsWith('.css')
      ? [...source.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match => match[1])
      : [...source.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]);

    for (const reference of references) {
      if (/^(?:data:|https?:)/.test(reference)) continue;
      const cleanUrl = new URL(reference, `https://app.local/${currentUrl}`).pathname.replace(/^\//, '');
      // Modern service-worker capable browsers can use AVIF or WebP. Avoid
      // precaching the 357 KB legacy JPEG in addition to both modern formats.
      if (cleanUrl === 'images/landing_page/background_central.jpg') continue;
      if (!entriesByUrl.has(cleanUrl) || keep.has(cleanUrl)) continue;
      keep.add(cleanUrl);
    }
  }

  return {
    manifest: entries.filter(entry => keep.has(entry.url)),
    warnings: [],
  };
}

// Get git commit hash for build info
let commitHash;
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
        name: 'Kaderblick – Vereinssoftware für Fußballvereine',
        short_name: 'Kaderblick',
        start_url: '/',
        display: 'standalone',
        background_color: '#4e4e4e',
        theme_color: '#B5AD9D',
        lang: 'de',
        description: 'Vereinssoftware für Fußballvereine: Kalender, Spielanalyse, Formationen, Kommunikation und Berichte in einer modernen Web-App.',
        categories: ['sports', 'productivity'],
        icons: [
          {
            src: '/images/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/images/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/images/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/images/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/images/kaderblick_website_appicon.png',
            sizes: 'any',
            type: 'image/png',
          },
        ]
      },
      injectManifest: {
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,avif,webp,woff,woff2,svg,ico,json,webmanifest}'],
        globIgnores: [
          'uploads/**',
        ],
        manifestTransforms: [appShellManifestTransform],
      }
    }),
  ],
  /* Wahrscheinlich sinnfrei, bleibt aber erstmal drin, der login modal für google sso jetzt erstmal so funktioniert */
  server: {
    proxy: {
      // Proxy /uploads/ zum API-Container damit fetchAsDataUri() ohne CORS-Probleme
      // auf Hintergrundbilder von Poster-Vorlagen zugreifen kann.
      '/uploads': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8881',
        changeOrigin: true,
      },
    },
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
  }
})
