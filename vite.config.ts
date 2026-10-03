import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const MB = 1024 * 1024

// Modelos on-device: se descargan una vez con WiFi y se sirven desde caché (modo avión).
const modelCache = (name: string, maxEntries: number) => ({
  handler: 'CacheFirst' as const,
  options: {
    cacheName: name,
    expiration: { maxEntries, maxAgeSeconds: 60 * 60 * 24 * 365 },
    cacheableResponse: { statuses: [0, 200] },
  },
})

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: false, // se registra en src/main.tsx con virtual:pwa-register
      // Los íconos ya entran por globPatterns; evitar entradas duplicadas en el precache.
      includeAssets: [],
      includeManifestIcons: false,
      manifest: {
        name: 'Pahtli — Triaje sin internet',
        short_name: 'Pahtli',
        description: 'Triaje de salud para promotoras rurales. Funciona sin internet.',
        lang: 'es-MX',
        dir: 'ltr',
        start_url: '/#/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1f6f4a',
        background_color: '#fbf8f3',
        categories: ['medical', 'health'],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // App shell + chunks lazy (tablero) + runtimes wasm/onnx que emita el build.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,wasm,onnx,json,woff2}'],
        // El LLM (WebLLM, ~12 MB de JS) es opcional y solo nivel A: no se precachea para no cobrarle
        // esa descarga a todos. Se guarda en caché la primera vez que se descarga el modelo (regla abajo).
        globIgnores: ['**/node_modules/**', 'assets/llm.worker-*.js', 'assets/webllm-*.js'],
        maximumFileSizeToCacheInBytes: 60 * MB,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          // Chunks del LLM excluidos del precache (nombres con hash => inmutables).
          { urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/assets\/(llm\.worker|webllm)-[\w-]+\.js$/.test(url.pathname), ...modelCache('pahtli-llm-chunks', 10) },
          // Pesos de Hugging Face y libs wasm de WebLLM: NO se cachean aquí. transformers.js ("transformers-cache")
          // y WebLLM ("webllm/*") ya los guardan en Cache Storage y los leen de ahí sin red; cachearlos
          // también en el SW duplicaría ~0.8 GB en el celular.
          // Runtime ONNX/wasm de transformers.js servido desde CDN
          { urlPattern: ({ url }) => url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'unpkg.com', ...modelCache('pahtli-runtime-cdn', 60) },
          // Teselas del mapa del tablero (solo para verlas sin señal si ya se cargaron)
          {
            urlPattern: ({ url }) => /tile\.openstreetmap\.org$/.test(url.hostname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'pahtli-tiles', expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm', '@huggingface/transformers'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 7000,
    rolldownOptions: {
      output: {
        // Nombre estable para el chunk de WebLLM (se excluye del precache por nombre).
        codeSplitting: { groups: [{ name: 'webllm', test: /node_modules[\\/]@mlc-ai[\\/]/ }] },
      },
    },
  },
})
