// uygulama/yolBaglanti.test.ts — YOL BAĞLANTI BEKÇİSİ: yolTipleri.ts'teki her olay konusunun hem bir YAYINCISI hem bir ABONESİ var mı.
//
// Neden: tip sistemi yanlış konu adını yakalar ama "kimse yayınlamıyor" ya da "kimse dinlemiyor" durumunu yakalamaz. Biri yayıncıyı (adaptörü) siler ya da aboneyi
// kaldırırsa konu sessizce ölür: HUD ipucu hiç çıkmaz, kapı geçişi hiç başlamaz, test yeşil kalır. Bu bekçi o ölümü kırmızıya çevirir.
// SINIR: statik metin taraması. Çalışma anında olayın gelip gelmediğini kanıtlamaz (onu canlı koşu ya da `*dene` senaryosu gösterir).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const BU = import.meta.dirname;

/** yolTipleri.ts içindeki `Olaylar` arayüzünün konu adları. */
export function tablodakiKonular(yolTipleri: string): string[] {
  const govde = /export interface Olaylar \{([\s\S]*?)\n\}/.exec(yolTipleri)?.[1] ?? "";
  return [...govde.matchAll(/^\s+"([^"]+)":/gm)].map((m) => m[1]!);
}

/** Kaynakların birleşiminde `yol.yayinla("konu"` ve `yol.dinle("konu"` kullanımları (`g.yol.dinle` de eşleşir). */
export function konuKullanimlari(kaynaklar: readonly string[]): { yayinlanan: Set<string>; dinlenen: Set<string> } {
  const yayinlanan = new Set<string>(), dinlenen = new Set<string>();
  for (const k of kaynaklar) {
    for (const m of k.matchAll(/\byol\.yayinla\(\s*"([^"]+)"/g)) yayinlanan.add(m[1]!);
    for (const m of k.matchAll(/\byol\.dinle\(\s*"([^"]+)"/g)) dinlenen.add(m[1]!);
  }
  return { yayinlanan, dinlenen };
}

/** Yayıncısı ya da abonesi olmayan konular. */
export function kopukKonular(konular: readonly string[], kaynaklar: readonly string[]): { yayincisiz: string[]; abonesiz: string[] } {
  const { yayinlanan, dinlenen } = konuKullanimlari(kaynaklar);
  return { yayincisiz: konular.filter((k) => !yayinlanan.has(k)), abonesiz: konular.filter((k) => !dinlenen.has(k)) };
}

const URETIM = fs.readdirSync(BU).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).map((f) => fs.readFileSync(path.join(BU, f), "utf8"));
const KONULAR = tablodakiKonular(fs.readFileSync(path.join(BU, "yolTipleri.ts"), "utf8"));

test("tablo okunuyor: Olaylar'da konu var (bekçi boş geçmiyor)", () => {
  assert.ok(KONULAR.length >= 3, `konu sayısı: ${KONULAR.length}`);
});

test("etkilesim.ipucu konusu tabloda (HUD ipucu yolu)", () => {
  assert.ok(KONULAR.includes("etkilesim.ipucu"));
});

test("her olay konusunun bir YAYINCISI var", () => {
  assert.deepEqual(kopukKonular(KONULAR, URETIM).yayincisiz, []);
});

test("her olay konusunun bir ABONESİ var", () => {
  assert.deepEqual(kopukKonular(KONULAR, URETIM).abonesiz, []);
});

test("bekçi kopuk konuyu yakalar: yayıncısı silinmiş konu", () => {
  const abone = 'yol.dinle("a.b", () => {});';
  assert.deepEqual(kopukKonular(["a.b"], [abone]).yayincisiz, ["a.b"]);
});

test("bekçi kopuk konuyu yakalar: aboneliği silinmiş konu", () => {
  const yayin = 'yol.yayinla("a.b", 1);';
  assert.deepEqual(kopukKonular(["a.b"], [yayin]).abonesiz, ["a.b"]);
});

test("bekçi `g.yol.dinle` ve başka dosyadaki yayını da sayar", () => {
  assert.deepEqual(kopukKonular(["a.b"], ['g.yol.dinle("a.b", () => {});', 'yol.yayinla("a.b", 1);']), { yayincisiz: [], abonesiz: [] });
});
