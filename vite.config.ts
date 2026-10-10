import { defineConfig } from "vite";
// Level editörü uç noktaları (yalnız geliştirme sunucusu): tools/vite-level.ts.
import { levelUcNoktalari } from "./tools/vite-level.ts";

export default defineConfig({
  root: ".",
  base: "./",                 // Electron file:// yüklemesi için göreli yol zorunlu
  publicDir: "assets",
  build: { outDir: "dist", emptyOutDir: true, target: "esnext", sourcemap: true },
  server: { port: 5273, strictPort: true },
  plugins: [levelUcNoktalari()],
});
