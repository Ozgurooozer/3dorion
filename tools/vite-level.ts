// tools/vite-level.ts — Level editörünün GELİŞTİRME sunucusu uç noktaları (spec 22 hazır yapı, spec 23 A).
//
// Dosya işlemleri host/levelDosyasi.js'te (atomik yazım, ad kuralı, var olanı ezmeme) — Electron ana süreci de
// aynı modülü kullanacak; burada yalnız HTTP'ye çeviri ve İÇERİK DOĞRULAMASI (host world'ü import edemez):
//   GET  /__level/liste              → [{ ad, bayt, degisme }]    (world/level/<ad>/<ad>.level.json)
//   GET  /__level/sablonlar          → ["bos", …]                 (world/level/sablon/<ad>.level.json)
//   POST /__level/kaydet?ad=<ad>     → var olanı günceller (yoksa 404)
//   POST /__level/yeni?ad=<ad>       → yeni level (varsa 409)
//   GET  /__level/hazir[?ad=<ad>]    → hazır yapı listesi / içeriği
//   POST /__level/hazir?ad=<ad>[&ez=1] → hazır yapı yaz (varsa ve ez yoksa 409)
// Gövde doğrulanmadan yazılmaz (422). Silme yok.
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import fs from "node:fs";
import { levelTanimiDogrula } from "../world/level/cekirdek/levelTanimi.ts";
import { parcaOku } from "../world/level/editor/cekirdek/pano.ts";
import { levelListesi, levelKaydet, levelOlustur, hazirListesi, hazirKaydet, hazirYolu, LEVEL_UZANTISI } from "../host/levelDosyasi.js";

const LEVEL_KOKU = path.resolve("world/level");
const SABLON_KLASORU = path.join(LEVEL_KOKU, "sablon");
const HAZIR_KLASORU = path.join(LEVEL_KOKU, "hazir");

const bitir = (y: ServerResponse, kod: number, govde: string, tur = "text/plain; charset=utf-8") => {
  y.statusCode = kod; y.setHeader("content-type", tur); y.end(govde);
};
const json = (y: ServerResponse, v: unknown) => bitir(y, 200, JSON.stringify(v), "application/json");
const govdeOku = (i: IncomingMessage) => new Promise<string>((tamam) => {
  let g = ""; i.on("data", (p: Buffer) => { g += p.toString("utf8"); }); i.on("end", () => tamam(g));
});
/** host/levelDosyasi.js hatası (kod alanı) → HTTP; başka hata 500. */
const hataYaz = (y: ServerResponse, err: unknown) => {
  const kod = (err as { kod?: number }).kod;
  bitir(y, typeof kod === "number" ? kod : 500, err instanceof Error ? err.message : String(err));
};
/** Level gövdesini doğrular; geçerliyse 2 boşluklu JSON metni. */
const levelMetni = (govde: string): { ok: true; metin: string } | { ok: false; kod: number; hata: string } => {
  let v: unknown;
  try { v = JSON.parse(govde); } catch { return { ok: false, kod: 400, hata: "JSON değil" }; }
  const d = levelTanimiDogrula(v);
  return d.ok ? { ok: true, metin: JSON.stringify(d.deger, null, 2) + "\n" } : { ok: false, kod: 422, hata: d.hata };
};

export function levelUcNoktalari(): Plugin {
  return {
    name: "level-uc-noktalari",
    apply: "serve",
    configureServer(sunucu) {
      sunucu.middlewares.use("/__level", (istek, yanit, sonraki) => {
        const url = new URL(istek.url ?? "", "http://x");
        const yolAdi = url.pathname.replace(/^\//, ""), ad = url.searchParams.get("ad") ?? "";
        const yap = async () => {
          if (yolAdi === "liste" && istek.method === "GET") return json(yanit, levelListesi(LEVEL_KOKU).filter((l) => l.ad !== "sablon"));
          if (yolAdi === "sablonlar" && istek.method === "GET") {
            const l = fs.existsSync(SABLON_KLASORU) ? fs.readdirSync(SABLON_KLASORU).filter((f) => f.endsWith(LEVEL_UZANTISI)).map((f) => f.slice(0, -LEVEL_UZANTISI.length)) : [];
            return json(yanit, l.sort());
          }
          if ((yolAdi === "kaydet" || yolAdi === "yeni") && istek.method === "POST") {
            const m = levelMetni(await govdeOku(istek));
            if (!m.ok) return bitir(yanit, m.kod, m.hata);
            const yazilan = yolAdi === "kaydet" ? levelKaydet(LEVEL_KOKU, ad, m.metin) : levelOlustur(LEVEL_KOKU, ad, m.metin);
            return bitir(yanit, 200, path.relative(".", yazilan));
          }
          if (yolAdi === "hazir") {
            if (istek.method === "GET" && !url.searchParams.has("ad")) return json(yanit, hazirListesi(HAZIR_KLASORU));
            const yol = hazirYolu(HAZIR_KLASORU, ad);
            if (istek.method === "GET") return fs.existsSync(yol) ? bitir(yanit, 200, fs.readFileSync(yol, "utf8"), "application/json") : bitir(yanit, 404, "yok");
            if (istek.method === "POST") {
              let p;
              try { p = parcaOku(await govdeOku(istek)); } catch (err) { return bitir(yanit, 422, err instanceof Error ? err.message : String(err)); }
              return bitir(yanit, 200, path.relative(".", hazirKaydet(HAZIR_KLASORU, ad, JSON.stringify({ ...p, ad }, null, 2) + "\n", url.searchParams.get("ez") === "1")));
            }
          }
          sonraki();
        };
        yap().catch((err: unknown) => hataYaz(yanit, err));
      });
    },
  };
}
