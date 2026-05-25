import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const BASE = '/ram/rafa/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Jeep Connect',
        short_name: 'Jeep',
        description: 'Controle remoto do seu Jeep Commander',
        theme_color: '#0d0d0d',
        background_color: '#0d0d0d',
        display: 'standalone',
        orientation: 'portrait',
        scope: BASE,
        start_url: BASE,
        icons: [
          { src: `${BASE}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: `${BASE}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallback: `${BASE}index.html`,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/hisbbtddpoxufvghxqtm\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-api', expiration: { maxEntries: 50, maxAgeSeconds: 300 } },
          },
          {
            urlPattern: /^https:\/\/[abc]?\.?tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 500, maxAgeSeconds: 604800 } },
          },
        ],
      },
    }),
  ],
})
