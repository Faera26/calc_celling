import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rreqijywlhsodppwebjy.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_aVVYUkx_p3xW3a--cm57oA_s-n5IsFU'

export default defineConfig({
  server: {
    proxy: {
      '/supabase-rest': {
        target: supabaseUrl,
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/supabase-rest/, '/rest/v1'),
        headers: {
          apikey: supabaseAnonKey,
          Accept: 'application/json',
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({ 
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      workbox: {
        globIgnores: ['**/normalized_catalog.json'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      },
      manifest: {
        name: 'Расчет потолков',
        short_name: 'Смета',
        description: 'Приложение для расчета стоимости натяжных потолков',
        theme_color: '#00897b',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
