// uygulama/nesneSecimiBaglanti.test.ts — NESNE SEÇİMİ kökte BAĞLI mı (spec 28): giris.ts'te her halka var mı.
//
// Neden: parçaların hepsi ayrı ayrı testli ama onları bağlayan kompozisyon kökü başsız sürülemez. Biri bir halkayı silerse (imleç oyuncuya verilmez, söz sözlüğüne
// seçili geçmez, vurgu abone olmaz) her birim test yeşil kalır ve özellik sessizce ölür. Bu bekçi o kopukluğu kırmızıya çevirir.
// SINIR: statik metin taraması; çalışma anında özelliğin çalıştığını kanıtlamaz (onu canlı koşu gösterir).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const GIRIS = fs.readFileSync(path.join(import.meta.dirname, "giris.ts"), "utf8").replace(/\r\n/g, "\n");

/** Her halka: ne olduğu → giris.ts'te aranan ifade. */
const HALKALAR: readonly [string, RegExp][] = [
  ["imleç kipi kuruluyor", /const imlec = imlecKipiKur\(/],
  ["imleç oyuncuya veriliyor (Tab/Esc oyuncuda)", /new Oyuncu\([^)]*\{[\s\S]*?\bimlec,/],
  ["seçim durumu değişimi yola duyuruyor", /yol\.yayinla\("nesne\.secildi"/],
  ["vurgu seçim olayına abone", /yol\.dinle\("nesne\.secildi"/],
  ["fare → seçim bağlanıyor", /nesneSecimiKur\(\{/],
  ["fare ışını gerçek kameradan", /fareIsini\(sahne, rig\.kamera,/],
  ["sağ tık menüsü Orion'a TEK eylem yolundan gidiyor", /nesneEtkilesimiKur\(\{ niyetiYurut,/],
  ["menüdeki 'ben yapayım' oyuncunun etkileşimine bağlı", /oyuncu\.etkilesimBaslat\(/],
  ["söz sözlüğü seçiliyi köprüden alıyor", /secili: seciliSoz,/],
  ["beynin bağlamı seçiliyi alıyor", /secili: seciliBeyne,/],
  ["HUD imleç kipini ve seçiliyi gösteriyor", /imlec: \(\) => imlec\.acik, secili: \(\) => secim\.oku\(\)/],
];

for (const [ad, desen] of HALKALAR) {
  test(`kökte bağlı: ${ad}`, () => {
    assert.match(GIRIS, desen);
  });
}

test("söz sözlüğü ve beynin bağlamı AYNI menü verisinden beslenir (nesneEylemleri)", () => {
  const govde = /function seciliOrionEylemleri\(\)[\s\S]*?\n}\n/.exec(GIRIS)?.[0] ?? "";
  assert.ok(govde.includes("nesneEylemleri("), "seciliOrionEylemleri menü kaynağını (nesneEylemleri) kullanmıyor");
  assert.ok(GIRIS.includes("seciliDurumu(b.n, b.eylemler)"), "beyin bağlamı menü verisinden beslenmiyor");
  assert.ok(GIRIS.includes("seciliSozOlustur(b.n.ad, b.eylemler)"), "söz sözlüğü menü verisinden beslenmiyor");
});
