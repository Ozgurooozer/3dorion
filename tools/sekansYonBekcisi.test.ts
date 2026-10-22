// tools/sekansYonBekcisi.test.ts — SEKANS ALT KATMANLARININ YÖN BEKÇİSİ (spec 36; graf bekçisinin kalıbı: tools/grafYonBekcisi.test.ts).
//
// Tek yön: yapi/sekans/ (arayüz) → sekans/ (motor ve editör mantığı) → (protocol, ajanlar, world/avatar kamusu). Ortak parçalar TARAFSIZ klasörde:
// uygulama/duzenleyici/ (geri al, sekmeler, tuval matematiği, sayı kutusu) ve uygulama/yapi/ortak/ (DOM yardımcıları, sekme şeridi). Yasaklar:
//   • sekans/ graf motorunu (uygulama/graf/) içe AKTARMAZ ve graf/ sekansı içe AKTARMAZ (ikisi ayrı sistem; ortak ihtiyaç tarafsız klasöre çıkar, kopyalanmaz);
//   • sekans/ arayüzü (uygulama/yapi/) ve DOM'u bilmez (başsız testlenir); yapi/sekans/ graf'ın arayüzünü (yapi/graf/) ya da motorunu bilmez;
//   • tarafsız klasörler (duzenleyici/, yapi/ortak/) graf'ı da sekansı da bilmez; duzenleyici/ DOM'a dokunmaz;
//   • ajanlar/ ve arka katmanlar (bridge, mind, flash) sekansa uzanmaz (Orion'un araç yüzeyinde sekans YOK).
// Bugünkü ihlal sayısı SIFIR; liste yok (yeni ihlal doğrudan kırmızı).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { klasorMetinleri, yasakIthaller } from "./ithaller.ts";

const DOM = /\b(document|window)\s*\.(?!kopru)/;
const domKullananlar = (m: Map<string, string>): string[] =>
  [...m].filter(([, metin]) => DOM.test(metin.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""))).map(([d]) => d);

test("bekçi kalibrasyonu: sekans dosyası graf'tan içe aktarırsa (tip de olsa) yakalanır; yorumdaki örnek sayılmaz", () => {
  const m = new Map([
    ["uygulama/sekans/a.ts", 'import type { X } from "../graf/grafYetenegi.ts";'],
    ["uygulama/sekans/b.ts", '// import { Y } from "../graf/dugumKaydi.ts";\nimport { Z } from "../duzenleyici/gecmis.ts";'],
  ]);
  assert.deepEqual(yasakIthaller(m, ["uygulama/graf/"]), ["uygulama/sekans/a.ts → uygulama/graf/grafYetenegi.ts"]);
});

test("sekans/ graf motorunu ve arayüzü içe aktarmaz; DOM'a dokunmaz", () => {
  const s = klasorMetinleri("uygulama/sekans");
  assert.deepEqual([yasakIthaller(s, ["uygulama/graf/", "uygulama/yapi/"]), domKullananlar(s)], [[], []]);
});

test("graf/ ve graf arayüzü (yapi/graf/) sekansı içe aktarmaz", () => {
  assert.deepEqual([...yasakIthaller(klasorMetinleri("uygulama/graf"), ["uygulama/sekans/", "uygulama/yapi/sekans/"]),
    ...yasakIthaller(klasorMetinleri("uygulama/yapi/graf"), ["uygulama/sekans/", "uygulama/yapi/sekans/"])], []);
});

test("sekans arayüzü (yapi/sekans/) graf'ın motorunu da arayüzünü de içe aktarmaz", () => {
  assert.deepEqual(yasakIthaller(klasorMetinleri("uygulama/yapi/sekans"), ["uygulama/graf/", "uygulama/yapi/graf/"]), []);
});

test("tarafsız klasörler (duzenleyici/, yapi/ortak/) graf'ı ve sekansı bilmez; duzenleyici/ DOM'a dokunmaz", () => {
  const yasak = ["uygulama/graf/", "uygulama/sekans/", "uygulama/yapi/graf/", "uygulama/yapi/sekans/"];
  const d = klasorMetinleri("uygulama/duzenleyici");
  assert.deepEqual([yasakIthaller(d, yasak), yasakIthaller(klasorMetinleri("uygulama/yapi/ortak"), yasak), domKullananlar(d)], [[], [], []]);
});

test("ajanlar/ ve arka katmanlar (bridge, mind, flash) sekansa uzanmaz (Orion'un araç yüzeyinde sekans yok)", () => {
  const yasak = ["uygulama/sekans/", "uygulama/yapi/sekans/"];
  // Arka katmanların göreli yolu `../uygulama/...` olarak çözülür; kökten bakılır.
  assert.deepEqual(["uygulama/ajanlar", "bridge", "mind", "flash"].flatMap((k) => yasakIthaller(klasorMetinleri(k), yasak)), []);
});
