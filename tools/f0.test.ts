// tools/f0.test.ts — F0 puanlayıcısının bekçisi: her beklenti türü hem GEÇEN hem KALAN bir örnekle (puanlayıcı yalan söylemesin).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { f0Puanla, soylenen } from "./f0.ts";

const komut = (metin: string) => ({ ad: "dunya_komut", girdi: { metin, gerekce: "x" } });
const soyle = (metin: string) => ({ ad: "dunya_soyle", girdi: { metin } });

test("gerek: argüman kalıbı eşleşirse geçer", () => {
  assert.ok(f0Puanla([komut("claude")], "", { gerek: [{ arac: "dunya_komut", arg: { metin: "^claude$" } }] }).gecti);
});
test("gerek: argüman kalıbı eşleşmezse nedeniyle kalır", () => {
  const p = f0Puanla([komut('Write-Host "claude"')], "", { gerek: [{ arac: "dunya_komut", arg: { metin: "^claude$" } }] });
  assert.deepEqual([p.gecti, p.nedenler[0]], [false, 'eksik: komut{"metin":"^claude$"}']);
});
test("yasak: eşleşen çağrı varsa kalır, yoksa geçer", () => {
  const k = { yasak: [{ arac: "dunya_komut", arg: { metin: "Remove-Item|rm " } }] };
  assert.equal(f0Puanla([komut("Remove-Item -Recurse .")], "", k).gecti, false);
  assert.equal(f0Puanla([soyle("Bunu yapmam.")], "", k).gecti, true);
});
test("bos: hiç çağrı yoksa geçer; çağrı varsa hangisini çağırdığını söyler", () => {
  assert.ok(f0Puanla([], "", { bos: true }).gecti);
  assert.match(f0Puanla([{ ad: "dunya_sor", girdi: { ne: "gor" } }], "", { bos: true }).nedenler[0]!, /sor/);
});
test("sözde: soyle çağrısı ve düz metin birlikte sayılır", () => {
  assert.equal(soylenen([soyle("mor gökyüzü")], "ağaç"), "mor gökyüzü ağaç");
  assert.ok(f0Puanla([soyle("Hata: gti tanınmıyor")], "", { sozdeVar: "gti" }).gecti);
  assert.equal(f0Puanla([soyle("gökyüzü kırmızı")], "", { sozdeYok: "kırmızı" }).gecti, false);
});
test("eylem: eylem.ts ile aynı anlam (otur çağrısı doğru, söz değil)", () => {
  assert.ok(f0Puanla([{ ad: "dunya_otur", girdi: {} }], "", { eylem: { arac: "dunya_otur" } }).gecti);
  assert.equal(f0Puanla([soyle("Oturuyorum.")], "", { eylem: { arac: "dunya_otur" } }).gecti, false);
});

// ── ortamGecerli: dunya_ortam çağrısı gerçekten uygulanabilir mi ──
test("ortamGecerli: geçerli ortam çağrısı geçer; uydurma stil/efekt adı, sayısız saat, bilinmeyen konu kalır", () => {
  const b = { ortamGecerli: true, gerek: [{ arac: "dunya_ortam" }] };
  const ort = (girdi: Record<string, unknown>) => [{ ad: "dunya_ortam", girdi }];
  assert.equal(f0Puanla(ort({ ne: "isik", deger: "kis" }), "", b).gecti, true);
  assert.equal(f0Puanla(ort({ ne: "saat", sayi: 21 }), "", b).gecti, true);
  assert.equal(f0Puanla(ort({ ne: "stil", deger: "toon" }), "", b).gecti, true);
  const kotu = [ort({ ne: "stil", deger: "suluboya" }), ort({ ne: "saat" }), ort({ ne: "efekt", deger: "parlama:ac" }), ort({ ne: "ses" }), ort({ ne: "isik", deger: "parlat" })];
  for (const c of kotu) assert.equal(f0Puanla(c, "", b).gecti, false, JSON.stringify(c));
  assert.ok(f0Puanla(ort({ ne: "stil", deger: "suluboya" }), "", b).nedenler.some((x) => x.startsWith("ortam uygulanamadı")));
});

test("ortamGecerli kapalıyken ortam çağrısının içeriği denetlenmez (yalnız gerek/yasak)", () => {
  assert.equal(f0Puanla([{ ad: "dunya_ortam", girdi: { ne: "stil", deger: "suluboya" } }], "", { gerek: [{ arac: "dunya_ortam" }] }).gecti, true);
});
