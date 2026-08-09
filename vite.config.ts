import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/**
 * Подпапка, в которой приложение лежит на хостинге: am29-10.github.io/finance/.
 * При переезде в корень домена достаточно поменять эту константу.
 */
const base = '/finance/'

/**
 * Две цели сборки из одного кода.
 *
 * `vite build` — сайт для GitHub Pages: живёт в подпапке, работает через
 * service worker, обновляется сам при заходе.
 *
 * `vite build --mode app` — начинка для APK: файлы лежат внутри приложения и
 * открываются по схеме `https://localhost`, поэтому пути обязаны быть
 * относительными, а service worker не нужен — кеширует уже сама оболочка,
 * и лишний слой только мешает обновлению после переустановки.
 */
export default defineConfig(({ mode }) => {
  const isApp = mode === 'app'

  return {
  base: isApp ? './' : base,
  build: { outDir: isApp ? 'dist-app' : 'dist' },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    !isApp &&
    VitePWA({
      registerType: 'autoUpdate',
      // Регистрируем service worker сами (src/lib/updates.ts): встроенный скрипт
      // не перезагружает экран, когда приехала новая версия, и человек продолжает
      // видеть старую, пока не закроет приложение и не откроет заново.
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Кошелёк — учёт финансов',
        short_name: 'Кошелёк',
        description: 'Доходы, расходы, бюджет и аналитика',
        lang: 'ru',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F5F7FA',
        theme_color: '#2E7D6B',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        // Заставки запуска показывает система ещё до того, как дело дойдёт до
        // service worker: в его кеше они пролежали бы без дела, раздувая объём,
        // который приложение скачивает при первом заходе.
        globIgnores: ['**/splash/*'],
        navigateFallback: `${base}index.html`,
      },
      devOptions: { enabled: true },
    }),
  ],
  server: { host: true },
  }
})
