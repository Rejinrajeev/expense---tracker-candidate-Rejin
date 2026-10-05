import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// shared/ sits beside client/ and server/, so Vite needs to be told it may
// read from the repo root and how to resolve the "@shared" prefix.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const sharedDir = fileURLToPath(new URL("../shared", import.meta.url));

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: { "@shared": sharedDir },
  },

  server: {
    port: 5173,
    // Without this, Vite refuses to serve files above the client/ root.
    fs: { allow: [repoRoot] },
    // Lets the app call "/api/..." with no CORS and no hard-coded host.
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },

  build: { outDir: "dist", sourcemap: true },
});
