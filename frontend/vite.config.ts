import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// En desarrollo, las peticiones a /api se redirigen al backend FastAPI.
// Cambia BACKEND_URL si tu servidor Python corre en otro puerto.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000';

// `npm run dev:https` (modo "https") sirve la app con un certificado autofirmado:
// el navegador del teléfono solo permite usar la cámara en https o en localhost.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'https' ? [basicSsl()] : [])],
  server: {
    host: true,
    proxy: {
      '/api': { target: BACKEND_URL, changeOrigin: true },
    },
  },
}));
