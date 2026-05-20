import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

export default defineConfig({
  root: '.',
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom', '@tanstack/react-router'],
  },
  build: {
    outDir: 'dist-spa',
    rollupOptions: {
      input: './index.spa.html',
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
})
