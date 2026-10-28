// protocol/eklenti.test.ts — eklenti kaydının sessizce yanlış okunabileceği yerler: bozuk JSON, yabancı sürüm, bozuk girdi, ortam ayrıştırma.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { EKLENTI_SURUMU, eklentiKimligiGecerli, kayitDogrula, ortamKaydi } from "./eklenti.ts";

test("kimlik: küçük harf/rakam/tire; büyük harf, boşluk, alt çizgi, baş/son tire, 49 karakter olmaz", () => {
  for (const id of ["ajanda", "hafiza-yonlendirici", "a1", "x".repeat(48)]) assert.equal(eklentiKimligiGecerli(id), true, id);
  for (const id of ["", "Ajanda", "a b", "a_b", "-a", "a-", "a--b", "x".repeat(49), 5, null]) assert.equal(eklentiKimligiGecerli(id), false, String(id));
});

test("kayıt: boş/yok → varsayılan ve UYARI YOK; bozuk JSON, nesne olmayan, yabancı sürüm, durumsuz → varsayılan + NEDEN", () => {
  for (const ham of [null, undefined, ""]) { const r = kayitDogrula(ham); assert.deepEqual(r.kayit, { surum: EKLENTI_SURUMU, durum: {} }); assert.deepEqual(r.uyarilar, []); }
  assert.match(kayitDogrula("{bozuk").uyarilar[0] ?? "", /bozuk JSON/);
  assert.match(kayitDogrula("[1]").uyarilar[0] ?? "", /nesne değil/);
  assert.match(kayitDogrula(JSON.stringify({ surum: 99, durum: {} })).uyarilar[0] ?? "", /sürümü 99/);
  assert.match(kayitDogrula(JSON.stringify({ surum: EKLENTI_SURUMU })).uyarilar[0] ?? "", /'durum' yok/);
});

test("kayıt: geçerli girdiler korunur (bilinmeyen kimlik DAHİL); bozuk kimlik ve girdi atılır, nedeni söylenir; seçenek yalnız metinse", () => {
  const r = kayitDogrula(JSON.stringify({ surum: EKLENTI_SURUMU, durum: {
    ajanda: { acik: false }, "dusunme-kipi": { acik: true, secenek: "dogrulayici" }, "gelecek-eklenti": { acik: true },
    "Kotu Ad": { acik: true }, bozuk: { acik: "evet" }, yok: null, sayi: { acik: true, secenek: 5 },
  } }));
  assert.deepEqual(r.kayit.durum, { ajanda: { acik: false }, "dusunme-kipi": { acik: true, secenek: "dogrulayici" }, "gelecek-eklenti": { acik: true }, sayi: { acik: true } });
  assert.equal(r.uyarilar.length, 3);
  assert.ok(r.uyarilar.some((u) => /Kotu Ad/.test(u)) && r.uyarilar.some((u) => /bozuk/.test(u)) && r.uyarilar.some((u) => /yok/.test(u)));
});

test("ortam: id:1, id:0, id=secenek; geçersiz parçalar atılır ve söylenir; boş metin boş kayıt", () => {
  const r = ortamKaydi("ajanda:0, flash:1,dusunme-kipi=dogrulayici,Kotu:1,x,y:2");
  assert.deepEqual(r.kayit.durum, { ajanda: { acik: false }, flash: { acik: true }, "dusunme-kipi": { acik: true, secenek: "dogrulayici" } });
  assert.equal(r.uyarilar.length, 3);
  assert.deepEqual(ortamKaydi(undefined).kayit.durum, {});
  assert.deepEqual(ortamKaydi("").uyarilar, []);
});
