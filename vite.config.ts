import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    // NOTA: removemos manualChunks customizados — Vite/Rollup já fazem
    // splitting automatico por dynamic import (lazy admin pages).
    // Splittar React + libs em chunks separados manualmente quebra
    // ordem de inicializacao (createContext de undefined).
  },
}));
