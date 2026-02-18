import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const certDir = path.resolve(__dirname, "../../certs");
const hasCerts = fs.existsSync(path.join(certDir, "localhost.pem"));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
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
