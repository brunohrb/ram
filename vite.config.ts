import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const BASE = '/ram/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Ram Connect',
        short_name: 'Ram',
        description: 'Controle remoto do seu Ram 1500 Rebel',
        theme_color: '#0d0d0d',
        background_color: '#0d0d0d',
        display: 'standalone',
        orientation: 'portrait',
        scope: BASE,
        start_url: BASE,
        icons: [
          { src: `${BASE}icons/icon-72x72.png`, sizes: '72x72', type: 'image/png' },
          { src: `${BASE}icons/icon-96x96.png`, sizes: '96x96', type: 'image/png' },
          { src: `${BASE}icons/icon-128x128.png`, sizes: '128x128', type: 'image/png' },
          { src: `${BASE}icons/icon-144x144.png`, sizes: '144x144', type: 'image/png' },
          { src: `${BASE}icons/icon-152x152.png`, sizes: '152x152', type: 'image/png' },
          { src: `${BASE}icons/icon-192x192.png`, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: `${BASE}icons/icon-384x384.png`, sizes: '384x384', type: 'image/png' },
          { src: `${BASE}icons/icon-512x512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          {
            name: 'Comandos Remotos',
            short_name: 'Comandos',
            description: 'Travar, destravar e partida remota',
            url: `${BASE}#/commands`,
            icons: [{ src: `${BASE}icons/icon-96x96.png`, sizes: '96x96' }],
          },
          {
            name: 'Localização',
            short_name: 'Localizar',
            description: 'Ver onde está o veículo',
            url: `${BASE}#/location`,
            icons: [{ src: `${BASE}icons/icon-96x96.png`, sizes: '96x96' }],
          },
          {
            name: 'Manutenção',
            short_name: 'Manutenção',
            description: 'Agenda de manutenção',
            url: `${BASE}#/maintenance`,
            icons: [{ src: `${BASE}icons/icon-96x96.png`, sizes: '96x96' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallback: `${BASE}index.html`,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/hisbbtddpoxufvghxqtm\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
          {
            urlPattern: /^https:\/\/[abc]?\.?tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 604800 },
            },
          },
        ],
      },
    }),
  ],
})
