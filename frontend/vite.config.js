import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'AshaAI',
        short_name: 'AshaAI',
        description: 'The Complete Digital Work Companion for ASHA Health Workers',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Add a cache version — increment this on every deploy
        cacheId: 'ashaai-v2',
        // Clean up old caches automatically
        cleanupOutdatedCaches: true,
        // Skip waiting — new SW activates immediately instead of waiting
        skipWaiting: true,
        clientsClaim: true,
        // Cache all the assets to enable offline mode
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff}'],
        runtimeCaching: [
          {
            // Firestore and API calls — always try network first
            urlPattern: /^https:\/\/(firestore\.googleapis\.com|.*\.run\.app).*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxAgeSeconds: 300 }
            }
          },
          {
            // Static assets — cache first, long TTL
            urlPattern: /\.(?:js|css|woff2|png|svg|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-cache-v2',
              expiration: { maxEntries: 60, maxAgeSeconds: 86400 }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {}
});
