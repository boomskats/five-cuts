import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'],
    manifest: {
      name: 'Five Cuts | Crosscut Fence Alignment',
      short_name: 'Five Cuts',
      description: 'Measure a fifth-cut strip to find how far to move your crosscut fence. Works offline and saves tests on your device.',
      theme_color: '#f5f1e7',
      background_color: '#f5f1e7',
      display: 'standalone',
      start_url: './',
      scope: './',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      clientsClaim: true,
      globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
      navigateFallback: 'index.html',
      cleanupOutdatedCaches: true,
    },
  })],
});
