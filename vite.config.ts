import { defineConfig, type Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";
import { levelTanimiDogrula } from "./world/level/cekirdek/levelTanimi.ts";
import { parcaOku } from "./world/level/editor/cekirdek/pano.ts";

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

/**
 * Hazır yapılar (spec 22, YALNIZ geliştirme sunucusu): world/level/hazir/<ad>.hazir.json — editörde gruptan
 * kaydedilen nesne takımları (biçim: editor/cekirdek/pano.ts "parça").
 *   GET  /__level/hazir            → ad listesi (JSON dizi)
 *   GET  /__level/hazir?ad=<ad>    → parça
 *   POST /__level/hazir?ad=<ad>    → doğrula ve yaz; dosya varsa 409 (üstüne yazmak için &ez=1)
 * Ad: harf/rakam/tire (Türkçe harf olur), boşluk yok.
 */
function hazirYapilar(): Plugin {
  const KLASOR = path.resolve("world/level/hazir");
  return {
    name: "level-hazir",
    apply: "serve",
    configureServer(sunucu) {
      sunucu.middlewares.use("/__level/hazir", (istek, yanit) => {
        const bitir = (kod: number, m: string, tur = "text/plain; charset=utf-8") => { yanit.statusCode = kod; yanit.setHeader("content-type", tur); yanit.end(m); };
        const q = new URL(istek.url ?? "", "http://x").searchParams;
        const ad = q.get("ad");
        if (istek.method === "GET" && ad === null) {
          const l = fs.existsSync(KLASOR) ? fs.readdirSync(KLASOR).filter((f) => f.endsWith(".hazir.json")).map((f) => f.slice(0, -".hazir.json".length)).sort() : [];
          return bitir(200, JSON.stringify(l), "application/json");
        }
        if (!ad || !/^[\p{L}\p{N}-]+$/u.test(ad)) return bitir(400, "geçersiz hazır yapı adı (harf, rakam, tire)");
        const dosya = path.join(KLASOR, `${ad}.hazir.json`);
        if (istek.method === "GET") return fs.existsSync(dosya) ? bitir(200, fs.readFileSync(dosya, "utf8"), "application/json") : bitir(404, "yok");
        if (istek.method !== "POST") return bitir(405, "GET ya da POST");
        if (fs.existsSync(dosya) && q.get("ez") !== "1") return bitir(409, `zaten var: ${ad} (üstüne yazmak için onayla)`);
        let govde = "";
        istek.on("data", (p: Buffer) => { govde += p.toString("utf8"); });
        istek.on("end", () => {
          try {
            const p = parcaOku(govde);
            fs.mkdirSync(KLASOR, { recursive: true });
            fs.writeFileSync(dosya, JSON.stringify({ ...p, ad }, null, 2) + "\n", "utf8");
            bitir(200, path.relative(".", dosya));
          } catch (err) { bitir(422, err instanceof Error ? err.message : String(err)); }
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
  plugins: [levelKaydet(), hazirYapilar()],
});
