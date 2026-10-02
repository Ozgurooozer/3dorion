// tools/tipKacisi.test.ts — Üretim kodunda `as unknown as` yalnız bilinen sınırlarda (spec 14 R5).
//
// `as unknown as` tip denetimini tamamen kapatır. R5'ten önce üretimde 18 tane vardı. Çoğu
// `window` kancasının her yazanda ve okuyanda ayrı ayrı yazılmış tipiydi; biri değişince
// diğerleri sessizce eski kalıyordu. Artık o kancalar `uygulama/pencereKancalari.ts`'te tiplidir.
// Kalanlar gerçek sınırlardır ve aşağıda gerekçeleriyle listelenir. Yeni bir kaçış buraya
// gerekçesiyle eklenmeden geçemez (kural değil, bekçi — CLAUDE.md "Kopya kod").
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = fileURLToPath(new URL("..", import.meta.url));
const KATMANLAR = ["protocol", "world", "voice", "mind", "bridge", "host", "uygulama"];

/** İzinli kaçışlar: dosya → gerekçe. */
const IZINLI: Record<string, string> = {
  "world/surfaces/yuzey.ts": "tuval2d: Babylon ICanvasRenderingContext → tarayıcının CanvasRenderingContext2D (tek sınır)",
  "world/surfaces/sema-deneme.ts": "tarayıcı deneme sayfası: sahte Pano (yalnız `npm run dev`)",
  "mind/beceriHafizasi.ts": "yerlestir: yuva yolu çalışma anında bulunur, birleşik Niyet tipine indeks yazılır",
};

function dosyalar(dizin: string): string[] {
  const out: string[] = [];
  for (const ad of readdirSync(dizin)) {
    const yol = join(dizin, ad);
    if (statSync(yol).isDirectory()) out.push(...dosyalar(yol));
    else if (ad.endsWith(".ts") && !ad.endsWith(".test.ts") && !ad.endsWith(".d.ts")) out.push(yol);
  }
  return out;
}

const kacanlar = KATMANLAR.flatMap((k) => dosyalar(join(KOK, k)))
  .filter((f) => readFileSync(f, "utf8").split("\n").some((l) => !l.trimStart().startsWith("//") && l.includes("as unknown as")))
  .map((f) => relative(KOK, f).split(sep).join("/"));

test("üretimde izinsiz `as unknown as` yok", () => {
  assert.deepEqual(kacanlar.filter((f) => !(f in IZINLI)), []);
});

test("izin listesinde artık kaçışı olmayan dosya yok", () => {
  assert.deepEqual(Object.keys(IZINLI).filter((f) => !kacanlar.includes(f)), []);
});
