import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  root: 'src',
  base: '/statement-converter-web/',
  plugins: [svelte()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
  },
  test: {
    // Run tests with the Node environment so fs is available for fixture loading
    environment: 'node',
    include: ['test/**/*.test.ts'],
    root: 'src',
  },
});
