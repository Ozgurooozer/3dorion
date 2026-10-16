// uygulama/seciliSoz.test.ts — MENÜ ↔ SÖZ tutarlılığı, GERÇEK veriyle (spec 28 Faz 4): seçili nesne için menüdeki Orion eylemleri ile "buraya otur" sözü aynı sonucu verir.
//
// Birim testler sözü sahte fixture'larla, menüyü gerçek çapalarla sınar; ikisini birbirine bağlayan bu dosya: gerçek bank/sandalye/tahta → `nesneEylemleri` →
// `seciliSozOlustur` → `komutCoz`. Biri ayrışırsa (menüde uygun, sözde gri gibi) burada kırmızı olur.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { komutCoz } from "../mind/komutSozlugu.ts";
import { seciliSozOlustur } from "./nesneEtkilesimi.ts";
import { nesneEylemleri } from "../world/yer/nesneEylemleri.ts";
import { tumCapalar } from "../world/level/capalar.ts";
import { BANK_CAPASI, BANK_NESNESI } from "../world/level/bank.ts";
import { NESNELER } from "../world/level/nesneKaydi.ts";

const CAPALAR = [...tumCapalar(), BANK_CAPASI];
const YAKIN = { x: BANK_CAPASI.durak.x, z: BANK_CAPASI.durak.z };
const secili = (n: (typeof NESNELER)[number]) => seciliSozOlustur(n.ad, nesneEylemleri(n, { capalar: CAPALAR, oyuncu: YAKIN }));

test("GERÇEK bank seçiliyken 'buraya otur' → Orion bankın çapasıyla OTURUR (menüdeki 'Otur' ile aynı niyet)", () => {
  const p = komutCoz("buraya otur", { secili: secili(BANK_NESNESI) });
  assert.deepEqual([p?.program, p?.adimlar], ["komut:sec_otur", [{ tur: "otur", capa: "bank" }]]);
});

test("GERÇEK sandalye seçiliyken 'buraya otur' → sandalyeye oturur", () => {
  const sandalye = NESNELER.find((n) => n.id === "sandalye")!;
  assert.deepEqual(komutCoz("buraya otur", { secili: secili(sandalye) })?.adimlar, [{ tur: "otur", capa: "sandalye" }]);
});

test("GERÇEK tahta seçiliyken 'buraya otur' → Orion oturamaz (tahtada 'otur' eylemi yok), 'bunu yapamam' der", () => {
  const tahta = NESNELER.find((n) => n.id === "tahta")!;
  const p = komutCoz("buraya otur", { secili: secili(tahta) });
  assert.equal(p?.program, "komut:sec_yapamam");
});

test("GERÇEK bank: 'bununla etkileşime gir' → birincil eylem OTUR; 'buraya git' → bankın çapasına gider", () => {
  const s = secili(BANK_NESNESI);
  assert.deepEqual(komutCoz("bununla etkileşime gir", { secili: s })?.adimlar, [{ tur: "otur", capa: "bank" }]);
  assert.deepEqual(komutCoz("buraya git", { secili: s })?.adimlar, [{ tur: "git", hedef: { tip: "capa", ad: "bank" } }]);
});

test("menüdeki UYGUN her Orion eyleminin, söz sözlüğündeki karşılığı AYNI niyeti verir (ayrışma yok)", () => {
  const SOZ: Record<string, string> = { "orion.git": "buraya git", "orion.bak": "buna bak", "orion.otur": "buraya otur" };
  for (const n of [...NESNELER, BANK_NESNESI]) {
    const eylemler = nesneEylemleri(n, { capalar: CAPALAR, oyuncu: YAKIN }).filter((e) => e.kim === "orion" && e.uygun && SOZ[e.kimlik]);
    for (const e of eylemler) {
      const p = komutCoz(SOZ[e.kimlik]!, { secili: seciliSozOlustur(n.ad, nesneEylemleri(n, { capalar: CAPALAR, oyuncu: YAKIN })) });
      assert.deepEqual(p?.adimlar, [e.niyet], `${n.id}/${e.kimlik}: söz ile menü ayrıştı`);
    }
  }
});

test("seciliSozOlustur yalnız ORION eylemlerini taşır ('ben yapayım' sözde yok)", () => {
  const s = secili(BANK_NESNESI);
  assert.ok(s.eylemler.every((e) => e.kimlik.startsWith("orion.")));
});
