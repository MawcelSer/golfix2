import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import fs from "node:fs";
import path from "node:path";

const certDir = path.resolve(__dirname, "../../certs");
const hasCerts = fs.existsSync(path.join(certDir, "localhost.pem"));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Golfix",
        short_name: "Golfix",
        description: "GPS distances et suivi de parcours en temps réel",
        theme_color: "#0F2818",
        background_color: "#0F2818",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.mapbox\.com/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "mapbox-tiles",
              expiration: { maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/api\/v1\/courses\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "course-api",
              networkTimeoutSeconds: 5,
              expiration: { maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    https: hasCerts
      ? {
          key: fs.readFileSync(path.join(certDir, "localhost-key.pem")),
          cert: fs.readFileSync(path.join(certDir, "localhost.pem")),
        }
      : undefined,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
