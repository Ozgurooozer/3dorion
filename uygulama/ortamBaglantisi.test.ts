// uygulama/ortamBaglantisi.test.ts — ortam komutunun ömrü: level yokken açık hata, level varken uygular, hata hâlinde
// level değişmez, sıfırla açılış tanımına döner, dinleyiciler yalnız başarıyı duyar.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ortamBaglantisiKur, OVADA_DEGILIM, type OrtamLevel } from "./ortamBaglantisi.ts";
import { ornekTanim } from "../world/level/cekirdek/ornekTanim.ts";
import type { LevelTanimi } from "../world/level/cekirdek/levelTanimi.ts";
import type { OrtamKomutu } from "../world/level/stil/ortamKomutu.ts";

const k = (ne: OrtamKomutu["ne"], deger?: string, sayi?: number): OrtamKomutu =>
  ({ tur: "ortam", ne, ...(deger !== undefined ? { deger } : {}), ...(sayi !== undefined ? { sayi } : {}) });

/** Sahte level: tanımı tutar, `ayarla` isteğe bağlı fırlatır, saat dışarıdan. */
function sahteLevel(saat = 12, atar = false, ad = "deneme"): OrtamLevel & { tanimlar: LevelTanimi[] } {
  let t = ornekTanim(); t.ad = ad;
  const tanimlar: LevelTanimi[] = [];
  return {
    tanimlar,
    tanim: () => structuredClone(t),
    ayarla(y) { if (atar) throw new Error("level tanımı geçersiz — deneme"); t = y as LevelTanimi; tanimlar.push(t); },
    dunya: { get saat() { return saat; } },
  };
}

test("level yokken açık hata verir (sessiz yutma yok)", () => {
  const b = ortamBaglantisiKur();
  assert.equal(b.kullanilabilirMi(), false);
  assert.deepEqual(b.uygula(k("stil", "toon")), { ok: false, not: OVADA_DEGILIM });
});

test("level bağlıyken uygular ve ne yaptığını söyler", () => {
  const b = ortamBaglantisiKur(), l = sahteLevel();
  b.ova(l);
  assert.equal(b.kullanilabilirMi(), true);
  const s = b.uygula(k("saat", undefined, 21));
  assert.equal(s.ok, true);
  assert.match(s.not, /21:00/);
  assert.equal(l.tanim().zaman?.saat, 21);
});

test("canlı saat komuta geçer (saat_kaydir)", () => {
  const b = ortamBaglantisiKur(), l = sahteLevel(10);
  b.ova(l);
  b.uygula(k("saat_kaydir", undefined, 3));
  assert.equal(l.tanim().zaman?.saat, 13);
});

test("geçersiz değerde ok:false ve level DEĞİŞMEZ; hata metni seçenekleri söyler", () => {
  const b = ortamBaglantisiKur(), l = sahteLevel();
  b.ova(l);
  const s = b.uygula(k("stil", "suluboya"));
  assert.equal(s.ok, false);
  assert.match(s.not, /geçerli: .*toon/);
  assert.equal(l.tanimlar.length, 0);
});

test("level.ayarla fırlatırsa ok:false ve dinleyici çağrılmaz", () => {
  const b = ortamBaglantisiKur();
  b.ova(sahteLevel(12, true));
  let duyulan = 0;
  b.dinle(() => { duyulan++; });
  const s = b.uygula(k("isik", "kis"));
  assert.equal(s.ok, false);
  assert.match(s.not, /geçersiz/);
  assert.equal(duyulan, 0);
});

test("sifirla bağlandığı andaki tanıma döner; ova değişince yeni açılış alınır", () => {
  const b = ortamBaglantisiKur(), l = sahteLevel();
  b.ova(l);
  const ilk = l.tanim();
  b.uygula(k("stil", "toon")); b.uygula(k("isik", "kis"));
  assert.notDeepEqual(l.tanim(), ilk);
  assert.equal(b.uygula(k("sifirla")).ok, true);
  assert.deepEqual(l.tanim(), ilk);
  b.ova(null);
  assert.equal(b.uygula(k("sifirla")).ok, false);
});

test("dinleyici yalnız başarıyı duyar, abonelik iptal edilir", () => {
  const b = ortamBaglantisiKur();
  b.ova(sahteLevel());
  const duyulan: string[] = [];
  const iptal = b.dinle((komut) => duyulan.push(komut.ne));
  b.uygula(k("stil", "cel")); b.uygula(k("stil", "yok"));
  iptal();
  b.uygula(k("isik", "ac"));
  assert.deepEqual(duyulan, ["stil"]);
});

test("ova yeniden kurulunca açılış tanımı YENİ level'dan alınır (eski sıfırlama hedefi kalmaz)", () => {
  const b = ortamBaglantisiKur();
  const a = sahteLevel();
  b.ova(a); b.uygula(k("stil", "toon")); b.ova(null);
  const ikinci = sahteLevel(12, false, "ikinci");   // farklı açılış tanımı: eski hedef kalırsa sifirla yanlış level'a döner
  b.ova(ikinci);
  b.uygula(k("isik", "kis"));
  b.uygula(k("sifirla"));
  assert.equal(ikinci.tanim().ad, "ikinci");
  assert.equal(ikinci.tanim().ortam.tonlama.pozlama, 1);
});
