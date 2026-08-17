import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '');
  const frontendPort = Number(env.FRONTEND_PORT) || 5173;
  const backendPort = Number(env.BACKEND_PORT) || 3001;

  return {
    plugins: [react(), tailwindcss()],
    envDir: projectRoot,
    server: {
      port: frontendPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: frontendPort,
      strictPort: true,
    },
  };
});
