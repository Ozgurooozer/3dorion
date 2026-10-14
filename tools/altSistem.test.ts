// tools/altSistem.test.ts — ALT-SİSTEM SINIR BEKÇİSİ (mimari raporu A3, 2026-10-14).
//
// Tablo `tools/altSistemler.ts`'te. Dört kural:
//   1. YÖN     bir ürün alt-sistemi yalnız `izinli` (tip için `tipIzinli`) alt-sistemlerden import eder;
//   2. YÜZEY   başka bir alt-sistemden yalnız onun `kamu` dosyalarını import eder;
//   3. ÜRÜN    ürün kodu tools/ ve brain-lab/'ı hiç import etmez — istisnasız;
//   4. ÇÖZÜLÜR her göreli import diskte bir dosyaya çözülür (tsc'nin görmediği .js/.mjs/.cjs dahil).
// 1–2'yi bugün çiğneyen kenarlar `ISTISNALAR`'da gerekçeli; liste yalnız küçülür (düzelen kenar
// listede kalırsa da kırmızı). Katman yönünü ayrıca `tools/mimari.test.ts` sınar; bu bekçi world/
// içindeki alt-sistemleri de ayırır. Testler kapsam dışı (bir test iki alt-sistemi birlikte sınayabilir).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { KOK, ithaller, kaynaklar, depoYolu } from "./ithaller.ts";
import { ALT_SISTEMLER, ISTISNALAR, altSistemi } from "./altSistemler.ts";

const URUN_KLASORLERI = ["protocol", "world", "voice", "mind", "bridge", "host", "uygulama"];

interface Ihlal { anahtar: string; tur: "yön" | "yüzey" | "ürün dışı" }

/** Göreli importun hedefi: dosyanın klasörüne göre çözülür; Vite soneki (`?url`, `?raw`) ayıklanır. */
function hedef(dosya: string, yol: string): string {
  return path.resolve(path.dirname(dosya), yol.replace(/\?[^/]*$/, ""));
}

/** Bir ürün dosyasının alt-sistem ihlalleri. Ürün dışı ya da tabloda olmayan dosya için boş. */
export function ihlaller(dosya: string, metin: string): Ihlal[] {
  const kaynak = depoYolu(dosya);
  const sa = altSistemi(kaynak);
  if (!sa?.urun) return [];
  const c: Ihlal[] = [];
  for (const i of ithaller(metin)) {
    const h = depoYolu(hedef(dosya, i.yol));
    const st = altSistemi(h);
    if (!st || st === sa) continue;
    const anahtar = `${kaynak} → ${h}`;
    if (!st.urun) { c.push({ anahtar, tur: "ürün dışı" }); continue; }
    const yonIzinli = sa.izinli.includes("*") || sa.izinli.includes(st.ad) || (i.tipMi && !!sa.tipIzinli?.includes(st.ad));
    if (!yonIzinli) c.push({ anahtar, tur: "yön" });
    if (st.kamu !== null && !st.kamu.includes(h)) c.push({ anahtar, tur: "yüzey" });
  }
  return c;
}

/** Diskte bulunmayan göreli import hedefleri. */
export function cozulmeyenler(dosya: string, metin: string): string[] {
  return ithaller(metin).map((i) => i.yol).filter((y) => {
    const h = hedef(dosya, y);
    return !fs.existsSync(h) || fs.statSync(h).isDirectory();
  });
}

const satir = (i: Ihlal): string => `${i.anahtar} (${i.tur})`;
const urunDosyalari = URUN_KLASORLERI.flatMap((k) => kaynaklar(path.join(KOK, k), { testler: false }));
const hepsi = urunDosyalari.flatMap((d) => ihlaller(d, fs.readFileSync(d, "utf8")));

// ── Gerçek tarama ────────────────────────────────────────────────────────────

test("ALT-SİSTEM BEKÇİSİ: yön ve yüzey ihlalleri yalnız gerekçeli istisna listesinde", () => {
  assert.deepEqual(hepsi.filter((i) => i.tur !== "ürün dışı" && !(i.anahtar in ISTISNALAR)).map(satir), []);
});

test("ürün kodu tools/ ve brain-lab/'ı import etmez (istisnasız)", () => {
  assert.deepEqual(hepsi.filter((i) => i.tur === "ürün dışı").map(satir), []);
});

test("istisna listesinde artık ihlali olmayan kenar yok (liste yalnız küçülür)", () => {
  assert.deepEqual(Object.keys(ISTISNALAR).filter((k) => !hepsi.some((i) => i.anahtar === k)), []);
});

test("tablo tutarlı: kamu dosyaları var ve kendi alt-sistemine ait, izinli adlar tabloda", () => {
  const adlar = new Set(ALT_SISTEMLER.map((a) => a.ad));
  const sorun = ALT_SISTEMLER.flatMap((a) => [
    ...(a.kamu ?? []).filter((d) => !fs.existsSync(path.join(KOK, d)) || altSistemi(d) !== a).map((d) => `${a.ad} kamu: ${d}`),
    ...[...a.izinli, ...(a.tipIzinli ?? [])].filter((ad) => ad !== "*" && !adlar.has(ad)).map((ad) => `${a.ad} izinli: ${ad}`),
  ]);
  assert.deepEqual(sorun, []);
});

test("alt-sistem taraması boş geçmez: yüzlerce ürün dosyası okunur", () => {
  assert.ok(urunDosyalari.length >= 250,`yalnız ${urunDosyalari.length} dosya bulundu`);
});

test("her göreli import diskte bir dosyaya çözülür (testler, tools/ ve brain-lab/ dahil)", () => {
  // Bekçi testleri sentetik örnekleri METİN olarak taşır (var olmayan ../mind/y.ts gibi): hariç.
  const sentetik = ["tools/mimari.test.ts", "world/bagimlilik.test.ts", "tools/altSistem.test.ts"].map((d) => path.join(KOK, d));
  const atla = [...sentetik, path.join(KOK, "brain-lab", "archive"), path.join(KOK, "brain-lab", "data")];
  const dosyalar = [...URUN_KLASORLERI, "tools", "brain-lab"]
    .flatMap((k) => kaynaklar(path.join(KOK, k), { testler: true, atla }))
    .concat(path.join(KOK, "vite.config.ts"));
  const kirik = dosyalar.flatMap((d) => cozulmeyenler(d, fs.readFileSync(d, "utf8")).map((y) => `${depoYolu(d)} → ${y}`));
  assert.deepEqual(kirik, []);
  assert.ok(dosyalar.length >= 600, `yalnız ${dosyalar.length} dosya tarandı`);
});

// ── Kalibrasyon: her kural, bozulunca yakalar (sentetik kaynaklar) ─────────────

const yap = (yol: string): string => path.join(KOK, ...yol.split("/"));

test("kalibrasyon: dosya en uzun eşleşen kalıbın alt-sistemine aittir", () => {
  assert.deepEqual(
    ["world/giris.ts", "world/varlik.ts", "world/level/oda.ts", "world/level/cekirdek/x.ts",
      "world/level/editorSayfasi.ts", "world/level/editor/cekirdek/x.ts", "world/arayuz/x.ts", "vite.config.ts"]
      .map((d) => altSistemi(d)?.ad ?? null),
    ["Uygulama", "Sahne", "Sahne", "Level", "Editör", "Editör", "Yüzeyler", null]);
});

test("kalibrasyon YÖN: izinsiz alt-sisteme bağlanmak yakalanır (kamu dosyası bile olsa)", () => {
  assert.deepEqual(ihlaller(yap("world/level/cekirdek/x.ts"), 'import { a } from "../../avatar/index.ts";').map(satir),
    ["world/level/cekirdek/x.ts → world/avatar/index.ts (yön)"]);
});

test("kalibrasyon YÜZEY: kamu dışı dosyaya uzanmak yakalanır, kamu dosyası serbest", () => {
  const d = yap("uygulama/x.ts");
  assert.deepEqual([
    ihlaller(d, 'import { Yurutucu } from "../world/avatar/yurutucu.ts";').map(satir),
    ihlaller(d, 'import { avatarKur } from "../world/avatar/index.ts";').map(satir),
  ], [["uygulama/x.ts → world/avatar/yurutucu.ts (yüzey)"], []]);
});

test("kalibrasyon TİP: yalnız tip izinli alt-sistemden değer almak yakalanır", () => {
  const d = yap("world/surfaces/x.ts");
  assert.deepEqual([
    ihlaller(d, 'import type { PtyCikti } from "../../host/kopru.ts";').length,
    ihlaller(d, 'import { yaz } from "../../host/kopru.ts";').map(satir),
  ], [0, ["world/surfaces/x.ts → host/kopru.ts (yön)"]]);
});

test("kalibrasyon ÜRÜN: kompozisyon kökü bile tools/ ya da brain-lab/'ı alamaz; tools/ taranmaz", () => {
  assert.deepEqual([
    ihlaller(yap("world/giris.ts"), 'import { f0 } from "../tools/f0.ts";').map(satir),
    ihlaller(yap("uygulama/x.ts"), 'const m = await import("../brain-lab/brain-ir/orion.ts");').map(satir),
    ihlaller(yap("tools/x.ts"), 'import { Yurutucu } from "../world/avatar/yurutucu.ts";').length,
  ], [["world/giris.ts → tools/f0.ts (ürün dışı)"], ["uygulama/x.ts → brain-lab/brain-ir/orion.ts (ürün dışı)"], 0]);
});

test("kalibrasyon ÇÖZÜLÜR: var olmayan hedef yakalanır, `?url` soneki ayıklanır", () => {
  const d = yap("world/giris.ts");
  assert.deepEqual([
    cozulmeyenler(d, 'import ovaAdresi from "./level/ova/ova.level.json?url";'),
    cozulmeyenler(d, 'import "./yok.ts";\nconst k = require("../host/yok.cjs");'),
  ], [[], ["./yok.ts", "../host/yok.cjs"]]);
});
