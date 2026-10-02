// uygulama/zihinDuvari.test.ts — Köprünün bildirimleri duvarda doğru yere mi düşüyor? (spec 14 R4)
//
// Duvar sahtedir: şema ve günlük yalnız ne yazıldığını kaydeder. Köprü yok (avatar yüklenmeden
// önceki hâl); canlı satır ve hafıza bulutu o durumda sessiz kalmalı.
import { test } from "node:test";
import assert from "node:assert/strict";
import { zihinDuvariniBagla } from "./zihinDuvari.ts";

function duvarKur() {
  const kayit = {
    gunluk: [] as string[],
    durum: [] as string[],
    vurulan: [] as string[],
    hafizaKaynagi: null as (() => readonly unknown[]) | null,
  };
  const d = zihinDuvariniBagla({
    sema: {
      ariza: () => {},
      not: () => {},
      durumYaz: (m) => { kayit.durum.push(m); },
      vur: (ad, not) => { kayit.vurulan.push(`${ad}:${not ?? ""}`); },
      hafizaBagla: (k) => { kayit.hafizaKaynagi = k; },
    },
    gunluk: {
      ekle: (seviye, kaynak, metin) => { kayit.gunluk.push(`${seviye}|${kaynak}|${metin}`); },
      canli: () => {},
    },
    kopru: () => null,
    kesikSn: () => 0,
    kisaAd: (ad) => ad,
  });
  return { kayit, d };
}

test("düşünme başlayınca alt şeritte 'düşünüyor' yazar", () => {
  const { kayit, d } = duvarKur();
  d.asamaDinle("beyin");
  d.durdur();
  assert.deepEqual(kayit.durum, ["düşünüyor"]);
});

test("düşünme bitince süre notu alt şeride geçer", () => {
  const { kayit, d } = duvarKur();
  d.asamaDinle("beyin:bitti", "2,1 sn");
  d.durdur();
  assert.deepEqual(kayit.durum, ["son düşünce 2,1 sn"]);
});

test("başka aşama şemada kendi düğümünü vurur", () => {
  const { kayit, d } = duvarKur();
  d.asamaDinle("hafiza", "3 anı");
  d.durdur();
  assert.deepEqual(kayit.vurulan, ["hafiza:3 anı"]);
});

test("iç ses günlüğe 'iç ses' kaynağıyla düşer", () => {
  const { kayit, d } = duvarKur();
  d.icSesDinle("Ozyn yaklaştı.");
  d.durdur();
  assert.deepEqual(kayit.gunluk, ["bilgi|iç ses|Ozyn yaklaştı."]);
});

test("söz-eylem uçurumu günlüğe uyarı olarak düşer", () => {
  const { kayit, d } = duvarKur();
  d.sozEylemDinle(["otur"], "Oturuyorum Ozyn.");
  d.durdur();
  assert.deepEqual(kayit.gunluk, ['uyari|söz-eylem|"Oturuyorum Ozyn." dedi ama otur yapmadı']);
});

test("köprü yokken hafıza bulutu boş", () => {
  const { kayit, d } = duvarKur();
  d.durdur();
  assert.deepEqual(kayit.hafizaKaynagi?.(), []);
});
