import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue()],
  preview: {
    port: 4173,
    strictPort: true,
    proxy: { '/v1': { target: 'http://127.0.0.1:3002', ws: true } },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/v1': { target: 'http://127.0.0.1:3001', ws: true } },
    fs: {
      strict: true,
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem}',
        '**/.git/**',
        '**/.local/**',
        '**/storage/**',
        '**/backups/**',
      ],
    },
  },
  build: {
    outDir: '../../dist/web',
    // Keep hashed chunks needed by tabs that were open before a local rebuild.
    emptyOutDir: false,
    manifest: true,
    target: ['es2022', 'safari16', 'chrome107'],
  },
});
