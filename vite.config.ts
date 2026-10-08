import { defineConfig, type Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";
import { levelTanimiDogrula } from "./world/level/cekirdek/levelTanimi.ts";

/**
 * Level paneli "Kaydet" (spec 17 düzeni, YALNIZ geliştirme sunucusu): POST /__level/kaydet?ad=<ad> gövdesi
 * level tanımı → doğrulanır → world/level/<ad>/<ad>.level.json'a yazılır. Yalnız VAR OLAN level dosyası
 * güncellenir (yeni dosya açılmaz), ad yalnız küçük harf/rakam/tire. Geçersiz tanım yazılmaz; hata döner.
 */
function levelKaydet(): Plugin {
  return {
    name: "level-kaydet",
    apply: "serve",
    configureServer(sunucu) {
      sunucu.middlewares.use("/__level/kaydet", (istek, yanit) => {
        const bitir = (kod: number, m: string) => { yanit.statusCode = kod; yanit.end(m); };
        if (istek.method !== "POST") return bitir(405, "yalnız POST");
        const ad = new URL(istek.url ?? "", "http://x").searchParams.get("ad") ?? "";
        if (!/^[a-z0-9-]+$/.test(ad)) return bitir(400, "geçersiz level adı");
        const dosya = path.resolve("world/level", ad, `${ad}.level.json`);
        if (!fs.existsSync(dosya)) return bitir(404, `level dosyası yok: ${path.relative(".", dosya)}`);
        let govde = "";
        istek.on("data", (p: Buffer) => { govde += p.toString("utf8"); });
        istek.on("end", () => {
          let v: unknown;
          try { v = JSON.parse(govde); } catch { return bitir(400, "JSON değil"); }
          const d = levelTanimiDogrula(v);
          if (!d.ok) return bitir(422, d.hata);
          fs.writeFileSync(dosya, JSON.stringify(d.deger, null, 2) + "\n", "utf8");
          bitir(200, path.relative(".", dosya));
        });
      });
    },
  };
}

export default defineConfig({
  root: ".",
  base: "./",                 // Electron file:// yüklemesi için göreli yol zorunlu
  publicDir: "assets",
  build: { outDir: "dist", emptyOutDir: true, target: "esnext", sourcemap: true },
  server: { port: 5273, strictPort: true },
  plugins: [levelKaydet()],
});
