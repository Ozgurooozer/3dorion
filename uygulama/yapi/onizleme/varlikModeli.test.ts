// uygulama/yapi/onizleme/varlikModeli.test.ts — varlık önizlemesinin saf mantığı (spec 39 D5): karakter tanımı doğrulama, kemik ağacı sırası, üçgen/ölçü/sayı metni, önizleme türü.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { karakterTanimiOku, kemikAgaci, olcuMetni, onizlemeTuru, sayiMetni, ucgenSayisi } from "./varlikModeli.ts";

const T = (o: unknown): string => JSON.stringify(o);

test("karakter tanımı: geçerli tanım okunur (ad, beden adresi, iskelet); ad yoksa dosya adı, boşluklar kırpılır, 64'e kısalır", () => {
  const r = karakterTanimiOku(T({ tur: "karakter", ad: "  Orion ", beden: "Engine/orion-lowpoly.glb", iskelet: "kanonik" }), "X");
  assert.deepEqual(r, { ok: true, tanim: { ad: "Orion", beden: "Engine/orion-lowpoly.glb", iskelet: "kanonik" } });
  assert.deepEqual(karakterTanimiOku(T({ tur: "karakter", beden: "Content/Characters/F/f.GLB" }), "Flash"), { ok: true, tanim: { ad: "Flash", beden: "Content/Characters/F/f.GLB", iskelet: null } });
  assert.deepEqual(karakterTanimiOku(T({ tur: "karakter", ad: "   ", beden: "Engine/a.glb" }), "Dosya"), { ok: true, tanim: { ad: "Dosya", beden: "Engine/a.glb", iskelet: null } });
  const uzun = karakterTanimiOku(T({ tur: "karakter", ad: "a".repeat(100), beden: "Engine/a.glb" }), "X");
  assert.ok(uzun.ok && uzun.tanim.ad.length === 64);
  const sayi = karakterTanimiOku(T({ tur: "karakter", beden: "Engine/a.glb", iskelet: 5 }), "X");
  assert.ok(sayi.ok && sayi.tanim.iskelet === null, "iskelet metin değilse yok sayılır");
});

test("karakter tanımı: bozuk JSON, nesne olmayan, yanlış tür, beden yok/boş/geçersiz adres/.glb değil → NEDENİ söyleyen ret", () => {
  const ret = (m: string): string => { const r = karakterTanimiOku(m, "X"); assert.equal(r.ok, false, m); return r.ok ? "" : r.neden; };
  assert.match(ret("{bozuk"), /JSON okunamadı/);
  assert.match(ret("[]"), /nesne değil/);
  assert.match(ret("null"), /nesne değil/);
  assert.match(ret("5"), /nesne değil/);
  assert.match(ret(T({ tur: "model", beden: "Engine/a.glb" })), /tür 'karakter' olmalı/);
  assert.match(ret(T({ beden: "Engine/a.glb" })), /tür 'karakter' olmalı/);
  assert.match(ret(T({ tur: "karakter" })), /'beden' yok/);
  assert.match(ret(T({ tur: "karakter", beden: "" })), /'beden' yok/);
  assert.match(ret(T({ tur: "karakter", beden: 5 })), /'beden' yok/);
  assert.match(ret(T({ tur: "karakter", beden: "../x.glb" })), /adresi geçersiz/);
  assert.match(ret(T({ tur: "karakter", beden: "Engine/../x.glb" })), /adresi geçersiz/);
  assert.match(ret(T({ tur: "karakter", beden: "orion.glb" })), /adresi geçersiz/);
  assert.match(ret(T({ tur: "karakter", beden: "Engine/a.fbx" })), /\.glb dosyası olmalı/);
  assert.match(ret(T({ tur: "karakter", beden: "Engine/a.glb.png" })), /\.glb dosyası olmalı/);
});

test("kemik ağacı: ata önce, çocuklar kendi sırasıyla, derinlik ve çocuk sayısı doğru", () => {
  const g = kemikAgaci([
    { ad: "kalca", ust: null }, { ad: "omurga", ust: "kalca" }, { ad: "bas", ust: "omurga" }, { ad: "sol_bacak", ust: "kalca" }, { ad: "sol_ayak", ust: "sol_bacak" }, { ad: "sag_bacak", ust: "kalca" },
  ]);
  assert.deepEqual(g.map((k) => [k.ad, k.derinlik, k.cocuk]), [["kalca", 0, 3], ["omurga", 1, 1], ["bas", 2, 0], ["sol_bacak", 1, 1], ["sol_ayak", 2, 0], ["sag_bacak", 1, 0]]);
});

test("kemik ağacı: sıra karışık gelse de ata önce; listede olmayan ata → kök; kendi atası → kök; yinelenen ad bir kez", () => {
  const g = kemikAgaci([{ ad: "el", ust: "kol" }, { ad: "kol", ust: "omuz" }, { ad: "omuz", ust: "yok-boyle-kemik" }, { ad: "kendi", ust: "kendi" }, { ad: "omuz", ust: "kol" }]);
  assert.deepEqual(g.map((k) => [k.ad, k.derinlik, k.cocuk]), [["omuz", 0, 1], ["kol", 1, 1], ["el", 2, 0], ["kendi", 0, 0]], "kendi atası olan kemik kendi çocuğu sayılmaz");
  assert.deepEqual(kemikAgaci([]), []);
});

test("kemik ağacı: döngü (A→B→A) sonsuz döngüye girmez ve kemikler KAYBOLMAZ", () => {
  const g = kemikAgaci([{ ad: "A", ust: "B" }, { ad: "B", ust: "A" }, { ad: "kok", ust: null }]);
  assert.deepEqual(g.map((k) => k.ad).sort(), ["A", "B", "kok"]);
  assert.equal(g.length, 3);
});

test("üçgen sayısı: indeks/3 aşağı yuvarlanır, negatif/NaN 0", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 6, 45000, -3].map(ucgenSayisi), [0, 0, 0, 1, 1, 2, 15000, 0]);
  assert.equal(ucgenSayisi(Number.NaN), 0);
  assert.equal(ucgenSayisi(Infinity), 0, "sonsuz indeks sayısı geçersiz");
});

test("ölçü ve sayı metni: iki ondalık metre; geçersiz değer 0; binlik ayraç", () => {
  assert.equal(olcuMetni([0.5234, 1.7449, 0.3]), "0.52 × 1.74 × 0.30 m");
  assert.equal(olcuMetni([Number.NaN, -1, Infinity]), "0.00 × 0.00 × 0.00 m");
  assert.deepEqual([0, 999, 1000, 15000, 1234567, 12.6].map(sayiMetni), ["0", "999", "1 000", "15 000", "1 234 567", "13"]);
});

test("önizleme türü: karakter tanımı, glb, görsel; başkası null; büyük/küçük harf fark etmez", () => {
  assert.deepEqual(["Content/C/O.karakter.json", "Engine/a.GLB", "Content/A/b.PNG", "Content/A/b.jpg", "Content/A/b.jpeg", "Content/A/b.webp", "Content/S/a.json", "Engine/a.gltf", "Engine/a.vrm", "x"].map(onizlemeTuru),
    ["karakter", "model", "gorsel", "gorsel", "gorsel", "gorsel", null, null, null, null]);
});
