// brain-lab/viewer/vite.config.ts — the lab's dev server (`npm run lab`): four pages and a read-only data API.
//   /deney-odasi.html  watch a learner and its twin live the measured rooms (opens first)
//   /deneyler.html     results: verdicts, twins, falsification, what each subject learned
//   /guide.html        every term and number explained
//   /                  room + brain map (index.html)
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { labApi } from "./api.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: HERE,
  server: { open: "/deney-odasi.html" },
  plugins: [labApi(join(HERE, "../data"))],
  build: { rollupOptions: { input: {
    index: resolve(HERE, "index.html"), deneyler: resolve(HERE, "deneyler.html"),
    odasi: resolve(HERE, "deney-odasi.html"), guide: resolve(HERE, "guide.html"),
  } } },
});
