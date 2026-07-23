import { defineConfig } from 'vite'

export default defineConfig({
  root: 'public',
  base: './',
  build: {
    outDir: '../www',
    emptyOutDir: true
  },
  server: {
    port: 3000
  }
})
