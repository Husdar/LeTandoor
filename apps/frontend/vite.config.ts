import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Le Tandoor — Gestion",
        short_name: "Le Tandoor",
        description: "Gestion des commandes, du plan de salle et des performances du restaurant Le Tandoor",
        theme_color: "#6E1423",
        background_color: "#FAF3E7",
        display: "standalone",
        orientation: "landscape",
        icons: [],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
});
