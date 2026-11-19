import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/web",
  plugins: [react(), tailwindcss()],
  // Locally the API runs on its own server (pnpm dev:api).
  server: { proxy: { "/api/": "http://localhost:8787" } },
  build: { outDir: "../../dist/web", emptyOutDir: true },
});
