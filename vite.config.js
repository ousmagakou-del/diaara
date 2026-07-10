import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],

  // ─── Perf : strip console.* et debugger en build production ───
  // 169 occurrences console.log/warn dans le code source -> bytes inutiles
  // en prod + fuite d'info debug. Dev = on garde les logs pour debug local.
  ...(command === 'build' && {
    esbuild: { drop: ['console', 'debugger'] },
  }),

  build: {
    // Warning limit à 600 kB — les chunks vendor-* atteignent naturellement
    // cette taille sans que ce soit un problème (ils sont cache-first 1 an).
    chunkSizeWarningLimit: 600,
    // ─── Perf : split les grosses libs dans des chunks separes ───
    // Vite 8 utilise Rolldown -> manualChunks DOIT etre une fonction.
    // Avantages :
    //  - le navigateur cache les vendors entre 2 deploys (longue duree)
    //  - le client lambda ne telecharge pas @zxing s'il n'ouvre pas le scan
    //  - splits fins → plus de parallélisation HTTP/2 au 1er load
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase'))     return 'vendor-supabase'
          if (id.includes('@zxing'))        return 'vendor-zxing'
          if (id.includes('leaflet'))       return 'vendor-leaflet'
          if (id.includes('@tanstack'))     return 'vendor-tanstack'
          if (id.includes('idb-keyval'))    return 'vendor-idb'
          if (id.includes('posthog-js'))    return 'vendor-posthog'
          if (id.includes('@sentry'))       return 'vendor-sentry'
          if (id.includes('web-vitals'))    return 'vendor-webvitals'
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'vendor-react'
          }
        },
      },
    },
  },
}))
