import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: "./",                 // Electron file:// yüklemesi için göreli yol zorunlu
  publicDir: "assets",
  build: { outDir: "dist", emptyOutDir: true, target: "esnext", sourcemap: true },
  server: { port: 5273, strictPort: true },
});
