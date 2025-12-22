import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Asegura que la salida sea en la carpeta 'dist' para Netlify
    outDir: 'dist',
    // Optimiza la generación de assets
    assetsDir: 'assets',
  },
  // Define que la carpeta public contiene los archivos estáticos de la PWA
  publicDir: 'public',
})
