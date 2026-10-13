// world/level/stil/ortamKomutu.test.ts — Orion'un `ortam` niyetinin level tanımına dönüşümü (saf çekirdek).
// Kalıp stil.test.ts: ornekTanim() → dönüşüm → levelTanimiDogrula().ok.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ortamUygula, saatYazisi, EFEKT_GRUPLARI, SHADER_ADLARI, type OrtamKomutu } from "./ortamKomutu.ts";
import { ornekTanim } from "../cekirdek/ornekTanim.ts";
import { levelTanimiDogrula } from "../cekirdek/levelTanimi.ts";
import { onayarAdi } from "./stilTanimi.ts";

const komut = (ne: OrtamKomutu["ne"], deger?: string, sayi?: number): OrtamKomutu =>
  ({ tur: "ortam", ne, ...(deger !== undefined ? { deger } : {}), ...(sayi !== undefined ? { sayi } : {}) });
const dogru = (t: unknown) => { const d = levelTanimiDogrula(t); assert.ok(d.ok, d.ok ? "" : d.hata); };

test("stil: önayar uygulanır, sonuç geçerli, girdi değişmez", () => {
  const t = ornekTanim(), onceki = JSON.stringify(t);
  const s = ortamUygula(t, komut("stil", "toon"));
  assert.equal(onayarAdi(s.tanim), "toon");
  assert.equal(s.pahali, false);
  dogru(s.tanim);
  assert.equal(JSON.stringify(t), onceki);
});

test("stil: Türkçe/büyük harf farkı tolere edilir, bilinmeyen ad geçerli adları söyleyerek fırlatır", () => {
  assert.equal(onayarAdi(ortamUygula(ornekTanim(), komut("stil", " TOON ")).tanim), "toon");
  assert.throws(() => ortamUygula(ornekTanim(), komut("stil", "suluboya")), /geçerli: .*toon/);
});

test("renk: palet düzeni uygulanır ve pahalı diye işaretlenir", () => {
  const t = ornekTanim(); t.palet = { gokUfuk: "#000000", gokOrta: "#000000" };
  const s = ortamUygula(t, komut("renk", "pastel"));
  assert.equal(s.pahali, true);
  assert.equal(s.tanim.palet.gokUfuk, "#f4b3c2");
});

test("saat: 0–24'e sarılır, zaman akışını durdurur, zaman yoksa kurar", () => {
  const t = ornekTanim();
  assert.equal(t.zaman, undefined);
  const s = ortamUygula(t, komut("saat", undefined, 27.5));
  assert.equal(s.tanim.zaman?.saat, 3.5);
  assert.equal(s.tanim.zaman?.akiyor, false);
  assert.match(s.not, /03:30/);
  dogru(s.tanim);
});

test("saat_kaydir: canlı saatten ileri/geri, gece yarısını aşar", () => {
  const t = ornekTanim();
  assert.equal(ortamUygula(t, komut("saat_kaydir", undefined, 2), { saat: 23 }).tanim.zaman?.saat, 1);
  assert.equal(ortamUygula(t, komut("saat_kaydir", undefined, -3), { saat: 1 }).tanim.zaman?.saat, 22);
});

test("saat_kaydir: tanımdaki saat bayatsa canlı saat kazanır", () => {
  const t = ornekTanim(); t.zaman = { saat: 6, hiz: 0.1, akiyor: true, egim: 35, dunya: 0 };
  assert.equal(ortamUygula(t, komut("saat_kaydir", undefined, 1), { saat: 15 }).tanim.zaman?.saat, 16);
});

test("saat: sayi yoksa fırlatır (sessiz varsayılan yok)", () => {
  assert.throws(() => ortamUygula(ornekTanim(), komut("saat")), /sayi gerekli/);
});

test("saatYazisi", () => {
  assert.equal(saatYazisi(21), "21:00");
  assert.equal(saatYazisi(18.5), "18:30");
  assert.equal(saatYazisi(23.999), "00:00");
  assert.equal(saatYazisi(-1), "23:00");
});

test("isik: kıs pozlamayı düşürür, aç artırır, ikisi de aralığa sıkışır", () => {
  const t = ornekTanim();   // pozlama 1
  const kis = ortamUygula(t, komut("isik", "kis")).tanim.ortam.tonlama.pozlama;
  assert.ok(kis < 1 && kis > 0.7, `kis=${kis}`);
  const ac = ortamUygula(t, komut("isik", "ac")).tanim.ortam.tonlama.pozlama;
  assert.ok(ac > 1 && ac < 1.5, `ac=${ac}`);
  const cokKis = ortamUygula(t, komut("isik", "kis", 4)).tanim.ortam.tonlama.pozlama;
  assert.equal(cokKis, Math.round(1 / 1.25 ** 4 * 1000) / 1000);
  t.ortam.tonlama.pozlama = 0.26;
  assert.equal(ortamUygula(t, komut("isik", "kis", 4)).tanim.ortam.tonlama.pozlama, 0.25);   // alt sınır
  t.ortam.tonlama.pozlama = 2.9;
  assert.equal(ortamUygula(t, komut("isik", "ac", 4)).tanim.ortam.tonlama.pozlama, 3);       // üst sınır
});

test("isik: sıcak/soğuk renk eğrisini açar, aynı yöne basınca artar, ters yöne basınca baştan başlar", () => {
  let t = ortamUygula(ornekTanim(), komut("isik", "sicak")).tanim;
  assert.equal(t.stil?.son.egri.acik, true);
  assert.equal(t.stil?.son.egri.parlakTon, 40);
  assert.equal(t.stil?.son.egri.parlakYogunluk, 20);
  t = ortamUygula(t, komut("isik", "sicak", 2)).tanim;
  assert.equal(t.stil?.son.egri.parlakYogunluk, 60);
  t = ortamUygula(t, komut("isik", "soguk")).tanim;
  assert.equal(t.stil?.son.egri.parlakTon, 210);
  assert.equal(t.stil?.son.egri.parlakYogunluk, 20);
  dogru(t);
});

test("isik: bilinmeyen değer fırlatır", () => {
  assert.throws(() => ortamUygula(ornekTanim(), komut("isik", "parlat")), /kis, ac, sicak, soguk/);
});

test("sis: aç/kapat/yoğun/hafif, aralığa sıkışır", () => {
  const t = ornekTanim();   // kapalı, 0.01
  assert.equal(ortamUygula(t, komut("sis", "ac")).tanim.ortam.sis.acik, true);
  assert.equal(ortamUygula(t, komut("sis", "yogun")).tanim.ortam.sis.yogunluk, 0.016);
  assert.equal(ortamUygula(t, komut("sis", "hafif")).tanim.ortam.sis.yogunluk, 0.00625);
  t.ortam.sis.yogunluk = 0.04;
  assert.equal(ortamUygula(t, komut("sis", "yogun")).tanim.ortam.sis.yogunluk, 0.05);
  assert.equal(ortamUygula(t, komut("sis", "kapat")).tanim.ortam.sis.acik, false);
});

test("efekt: grup:ac|kapat ve yalın ad (= aç); her grup geçerli sonuç üretir", () => {
  const t = ornekTanim();
  assert.equal(ortamUygula(t, komut("efekt", "bloom:ac")).tanim.stil?.son.bloom.acik, true);
  assert.equal(ortamUygula(t, komut("efekt", "bloom")).tanim.stil?.son.bloom.acik, true);
  const acik = ortamUygula(t, komut("efekt", "ao:ac")).tanim;
  assert.equal(ortamUygula(acik, komut("efekt", "ao:kapat")).tanim.stil?.son.ao.acik, false);
  for (const g of EFEKT_GRUPLARI) dogru(ortamUygula(t, komut("efekt", `${g}:ac`)).tanim);
  assert.throws(() => ortamUygula(t, komut("efekt", "parlama:ac")), /geçersiz/);
  assert.throws(() => ortamUygula(t, komut("efekt", "bloom:belki")), /geçersiz/);
});

test("shader: aç/kapat; yoksa eklenir, varsa değişir; bilinmeyen ad fırlatır", () => {
  const t = ornekTanim();
  const a = ortamUygula(t, komut("shader", "atmosfer:ac")).tanim;
  assert.deepEqual(a.shaderlar, [{ tur: "atmosfer", acik: true, ayar: {} }]);
  const k = ortamUygula(a, komut("shader", "atmosfer:kapat")).tanim;
  assert.deepEqual(k.shaderlar, [{ tur: "atmosfer", acik: false, ayar: {} }]);
  assert.equal(ortamUygula(t, komut("shader", "firca")).tanim.shaderlar?.[0]?.acik, true);
  assert.throws(() => ortamUygula(t, komut("shader", "sepya:ac")), /geçerli: gokZamani/);
});

test("SHADER_ADLARI gerçek shader kaydıyla aynı (ayrışırsa kırılır)", async () => {
  const { SHADERLAR } = await import("../shader/moduller/index.ts");
  assert.deepEqual([...SHADER_ADLARI].sort(), [...SHADERLAR.keys()].sort());
});

test("akis ve dunya", () => {
  const t = ornekTanim();
  const a = ortamUygula(t, komut("akis", "ac"), { saat: 9 }).tanim.zaman!;
  assert.equal(a.akiyor, true);
  assert.equal(a.saat, 9);
  assert.equal(ortamUygula(t, komut("dunya", "siberpunk")).tanim.zaman?.dunya, 1);
  assert.equal(ortamUygula(t, komut("dunya", undefined, 3)).tanim.zaman?.dunya, 3);
  assert.throws(() => ortamUygula(t, komut("dunya", "uzay")), /geçerli: ova, siberpunk/);
  assert.throws(() => ortamUygula(t, komut("dunya", undefined, 9)), /geçersiz/);
});

test("sifirla: açılış tanımına döner; açılış verilmezse fırlatır", () => {
  const ilk = ornekTanim();
  const degisik = ortamUygula(ortamUygula(ilk, komut("stil", "toon")).tanim, komut("isik", "kis")).tanim;
  const s = ortamUygula(degisik, komut("sifirla"), { ilk });
  assert.deepEqual(s.tanim, ilk);
  assert.notEqual(s.tanim, ilk, "kopya dönmeli");
  assert.throws(() => ortamUygula(degisik, komut("sifirla")), /açılış tanımı yok/);
});

test("her komut girdi tanımı değiştirmez ve sonuç geçerli kalır", () => {
  const komutlar = [
    komut("stil", "anime90"), komut("renk", "gunduz"), komut("saat", undefined, 20), komut("saat_kaydir", undefined, 5),
    komut("isik", "kis"), komut("isik", "sicak"), komut("sis", "yogun"), komut("efekt", "gi:ac"), komut("akis", "kapat"), komut("dunya", "buyu"),
  ];
  for (const k of komutlar) {
    const t = ornekTanim(), onceki = JSON.stringify(t);
    dogru(ortamUygula(t, k, { saat: 12 }).tanim);
    assert.equal(JSON.stringify(t), onceki, `${k.ne} girdiyi değiştirdi`);
  }
});

// Gerçek level: ova'daki her komut sonrası tanım yine geçerli (modül ayarı, palet başvurusu, stil biçimi bozulmaz).
test("gerçek ova tanımında her komut geçerli sonuç verir", () => {
  const yol = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "ova", "ova.level.json");
  const d = levelTanimiDogrula(JSON.parse(fs.readFileSync(yol, "utf8")) as unknown);
  assert.ok(d.ok, d.ok ? "" : d.hata);
  if (!d.ok) return;
  const komutlar = [
    komut("stil", "toon"), komut("stil", "piksel"), komut("renk", "pastel"), komut("saat", undefined, 21), komut("saat_kaydir", undefined, -4),
    komut("isik", "kis", 3), komut("isik", "sicak"), komut("sis", "yogun"), komut("efekt", "bloom:kapat"), komut("akis", "ac"), komut("dunya", "ortacag"),
  ];
  for (const k of komutlar) dogru(ortamUygula(d.deger, k, { saat: 12, ilk: d.deger }).tanim);
});
