import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    allowedHosts: ['pc.visitworld.me', 'h5.visitworld.me', 'seller.visitworld.me', 'biz.visitworld.me'],
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        h5: 'h5.html',
        seller: 'seller.html',
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
