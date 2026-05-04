import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/**/*.property.{ts,tsx}',
    ],
    exclude: [
      'node_modules',
      '.next',
      'dist',
      'src/__tests__/integration/e2e/**', // E2E uruchamiane przez Playwright
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec,property}.{ts,tsx}',
        'src/__tests__/**',
        'src/app/**', // strony Next.js — pokryte przez E2E
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/content': path.resolve(__dirname, './content'),
    },
  },
});
