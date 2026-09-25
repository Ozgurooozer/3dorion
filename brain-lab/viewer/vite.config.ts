// brain-lab/viewer/vite.config.ts — the lab's dev server (`npm run lab`): two pages and a read-only data API.
//   /                 room + brain map (index.html)
//   /deneyler.html    experiment dashboard (results, falsification, subjects)
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { labApi } from "./api.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: HERE,
  plugins: [labApi(join(HERE, "../data"))],
  build: { rollupOptions: { input: { index: resolve(HERE, "index.html"), deneyler: resolve(HERE, "deneyler.html") } } },
});
