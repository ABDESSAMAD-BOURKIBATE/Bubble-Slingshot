import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/slingshot/',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'background.png', 'bubble_slingshot_icon.png'],
        manifest: {
          name: 'Bubble Slingshot',
          short_name: 'Slingshot',
          description: 'A fun and interactive bubble slingshot game powered by AI.',
          theme_color: '#0f172a',
          background_color: '#0a0a09',
          display: 'fullscreen',
          icons: [
            {
              src: 'bubble_slingshot_icon.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'bubble_slingshot_icon.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'bubble_slingshot_icon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
