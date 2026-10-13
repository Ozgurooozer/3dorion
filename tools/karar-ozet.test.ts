// tools/karar-ozet.test.ts — Taban çizgisi sayıları bilinen bir kayıtta doğru mu.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { KARAR_ONEKI, KararKaydi, type UyanisBilgisi } from "../mind/kararKaydi.ts";
import { kayitOku, zincirKur } from "../mind/kararZinciri.ts";
import { ozetCikar } from "./karar-ozet.ts";

const UYANIS: UyanisBilgisi = {
  algilar: [], geriBesleme: 0, beyin: "sahte", sureMs: 100, koken: "dis", takip: false,
  anilar: 0, dunya: "oda", cagrilar: [], niyetler: [], reddedilen: 0, kurtarilan: 0,
  konusulanMetin: false, yutulanSoz: 0,
};

/**
 * Bilinen kayıt: iki olay LLM'i uyandırır (biri eylemle, biri boşa), bir terminal
 * gürültüsü süzülür, bir komut önerisi reddedilir, eylemden sonra Ozyn konuşur.
 */
function bilinenOzet() {
  let t = 0;
  const satirlar: string[] = [];
  const k = new KararKaydi({ oturum: "o1", simdi: () => t, yaz: (s) => satirlar.push(s.slice(KARAR_ONEKI.length + 1)) });
  k.oturumBasi("sahte");
  const a1 = k.algi({ tur: "olay", ad: "oyuncu_odaya_girdi" }, "Event: oyuncu_odaya_girdi", { gecti: true, kural: "refleks.olay.dunya" });
  t = 1_000; k.uyanis({ ...UYANIS, algilar: [a1], sureMs: 200, niyetler: [{ id: "n_1", tur: "komut" }] });
  t = 2_000; k.algi({ tur: "sonuc", sonuc: { niyet_id: "n_1", durum: "hata", not: "Ozyn komutu reddetti." } }, "Intent n_1 → hata", { gecti: true, kural: "refleks.sonuc.hata" });
  t = 3_000; k.algi({ tur: "duydum", metin: "hayır", kesin: true }, 'Ozyn said: "hayır"', { gecti: true, kural: "kopru.konusma" });
  t = 4_000; k.algi({ tur: "terminal", kuyruk: "resolving", kesildi: false }, "In Ozyn's terminal:\nresolving", { gecti: false, kural: "refleks.terminal.gurultu" });
  const a2 = k.algi({ tur: "olay", ad: "monitor_acildi" }, "Event: monitor_acildi", { gecti: true, kural: "refleks.olay.dunya" });
  t = 5_000; k.uyanis({ ...UYANIS, algilar: [a2], sureMs: 400 });
  return ozetCikar(zincirKur(kayitOku(satirlar.join("\n")).satirlar));
}

test("uyanışların kaçı eylemle bitti", () => {
  const o = bilinenOzet();
  assert.deepEqual({ uyanis: o.uyanis, eylemli: o.eylemliUyanis }, { uyanis: 2, eylemli: 1 });
});

test("tetikleyen içgüdüye göre uyanış ve eylem sayılır", () => {
  assert.deepEqual(bilinenOzet().tetikleyenler, [{ kural: "refleks.olay.dunya", uyanis: 2, eylem: 1 }]);
});

test("algı türüne göre geçen ve düşen sayılır", () => {
  assert.deepEqual(bilinenOzet().turler.terminal, { toplam: 1, gecti: 0 });
});

test("reddedilen komut önerisi onay sayımında görünür", () => {
  assert.deepEqual(bilinenOzet().onay, { reddedildi: 1 });
});

test("eylemli uyanıştan sonra Ozyn konuştuysa tepki sayılır", () => {
  assert.equal(bilinenOzet().tepkili, 1);
});

test("beyin süresi yüzdelikleri en yakın sıra yöntemiyle: iki uyanışta ortanca küçüğü, %90 büyüğü", () => {
  const o = bilinenOzet();
  assert.deepEqual({ ortanca: o.sureOrtanca, yuzde90: o.sure90 }, { ortanca: 200, yuzde90: 400 });
});

test("boş kayıtta süreler yok, sayılar sıfır", () => {
  const o = ozetCikar(zincirKur([]));
  assert.deepEqual({ uyanis: o.uyanis, ortanca: o.sureOrtanca, eylemli: o.eylemliUyanis }, { uyanis: 0, ortanca: null, eylemli: 0 });
});

test("refleks turları (spec 10, Faz D) bitişe göre sayılır; refleksi olmayan kayıtta boş", () => {
  const satirlar: string[] = [];
  const k = new KararKaydi({ oturum: "o1", simdi: () => 1_000, yaz: (s) => satirlar.push(s.slice(KARAR_ONEKI.length + 1)) });
  for (const bitis of ["basari", "hata", "basari", "kesildi"] as const) k.refleks({ algi: "a1", beceri: "B1", niyetler: [], bitis, sureMs: 1 });
  assert.deepEqual(
    { refleks: ozetCikar(zincirKur(kayitOku(satirlar.join("\n")).satirlar)).refleks, bos: bilinenOzet().refleks },
    { refleks: { basari: 2, hata: 1, kesildi: 1 }, bos: {} },
  );
});

/**
 * Kendiliğinden uyanışlar (OB5/OB14/OB18): biri açık işi hatırlatır (söz, token 900), biri sessizlikte boşa uyanır
 * (sor çağırır); Ozyn ilkinden sonra konuşur. Girdi satırı yalnız ilk uyanıştan önce var.
 */
function inisiyatifKaydi(girdiYaz = true) {
  let t = 0;
  const satirlar: string[] = [];
  const k = new KararKaydi({ oturum: "o1", simdi: () => t, yaz: (s) => satirlar.push(s.slice(KARAR_ONEKI.length + 1)) });
  k.oturumBasi("sahte");
  if (girdiYaz) k.girdi({ bas: 0, pencereMs: 60_000, tus: 4, fare: 9, soz: 0 });
  t = 120_000;
  k.uyanis({ ...UYANIS, koken: "inisiyatif", neden: "acik_is", sureMs: 1500, cagrilar: ["dunya_soyle", "dunya_hatirla"],
    niyetler: [{ id: "n_1", tur: "soyle" }], baglam: { token: 900 } as UyanisBilgisi["baglam"] });
  t = 130_000; k.algi({ tur: "duydum", metin: "tamam", kesin: true }, 'Ozyn said: "tamam"', { gecti: true, kural: "kopru.konusma" });
  t = 2 * 3600_000;
  k.uyanis({ ...UYANIS, koken: "inisiyatif", neden: "sessizlik", sureMs: 2500, cagrilar: ["dunya_sor"] });
  return ozetCikar(zincirKur(kayitOku(satirlar.join("\n")).satirlar));
}

test("kendiliğinden uyanış: neden, eylem, tepki, maliyet ve sor sayılır", () => {
  const i = inisiyatifKaydi().inisiyatif;
  assert.deepEqual(
    { uyanis: i.uyanis, neden: i.neden, eylemli: i.eylemli, tepkili: i.tepkili, token: i.token, modelMs: i.modelMs, sorlu: i.sorlu },
    { uyanis: 2, neden: { acik_is: 1, sessizlik: 1 }, eylemli: 1, tepkili: 1, token: 900, modelMs: 4000, sorlu: 1 });
});

test("varlık kanıtı: önceki 10 dk'da girdi olan uyanış sayılır; 2 saat sonrakinde girdi yok", () => {
  assert.equal(inisiyatifKaydi().inisiyatif.varlikli, 1);
});

test("varlık kanıtı: kayıtta hiç girdi satırı yoksa ölçülemez (null), sıfır değil", () => {
  assert.equal(inisiyatifKaydi(false).inisiyatif.varlikli, null);
});

test("hatirla çağrısı olan uyanış sayılır (OB18)", () => {
  assert.deepEqual(inisiyatifKaydi().hatirla, { uyanis: 1, cagri: 1 });
});
