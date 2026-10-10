// world/level/leveller.test.ts — BÜTÜN level dosyalarının ve şablonların bekçisi (spec 23 A).
//
// world/level/<ad>/<ad>.level.json ve world/level/sablon/*.level.json: geçerli tanım, modülleri kayıtlı ve
// ayarları şemaya uygun, renk başvuruları çözülüyor, zemine bağlı katmanlar zeminden sonra. Editörden kaydedilen
// bozuk dosya sayfayı açmaz — bu test aynı şeyi sahnesiz, her level için söyler. (Level'a özgü bütçe testleri
// kendi klasöründe: ova/ova.level.test.ts.)
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { levelTanimiDogrula, type LevelTanimi } from "./cekirdek/levelTanimi.ts";
import { ayarBirlestir } from "./cekirdek/modul.ts";
import { renkCoz } from "./cekirdek/renk.ts";
import { MODULLER } from "./moduller/index.ts";
import { levelListesi } from "../../host/levelDosyasi.js";

const KOK = path.dirname(fileURLToPath(import.meta.url));
const SABLON = path.join(KOK, "sablon");
const dosyalar: [string, string][] = [
  ...levelListesi(KOK).filter((l) => l.ad !== "sablon").map((l) => [l.ad, path.join(KOK, l.ad, `${l.ad}.level.json`)] as [string, string]),
  ...(fs.existsSync(SABLON) ? fs.readdirSync(SABLON).filter((f) => f.endsWith(".level.json")).map((f) => [`şablon ${f}`, path.join(SABLON, f)] as [string, string]) : []),
];

test("en az ova ve boş şablon denetleniyor (liste boş kalıp testler sessizce geçmesin)", () => {
  assert.ok(dosyalar.some(([a]) => a === "ova") && dosyalar.some(([a]) => a === "şablon bos.level.json"), dosyalar.map(([a]) => a).join(", "));
});

for (const [ad, yol] of dosyalar) {
  const d = levelTanimiDogrula(JSON.parse(fs.readFileSync(yol, "utf8")) as unknown);
  const tanim = (): LevelTanimi => { if (!d.ok) throw new Error(d.hata); return d.deger; };

  test(`${ad}: geçerli level tanımı`, () => { assert.ok(d.ok, d.ok ? "" : d.hata); });

  test(`${ad}: her katmanın modülü kayıtlı ve ayarı şemaya uyuyor`, () => {
    for (const k of tanim().katmanlar) {
      const m = MODULLER.get(k.tur);
      assert.ok(m, `bilinmeyen modül: ${k.tur}`);
      assert.doesNotThrow(() => ayarBirlestir(k.tur, m.varsayilan, k.ayar), k.ad);
    }
  });

  test(`${ad}: katman ayarlarındaki her renk başvurusu çözülüyor`, () => {
    const t = tanim();
    for (const k of t.katmanlar) {
      const a = ayarBirlestir(k.tur, MODULLER.get(k.tur)!.varsayilan, k.ayar);
      const metinler = Object.values(a).flatMap((x) => (Array.isArray(x) ? x : [x])).filter((x): x is string => typeof x === "string");
      for (const v of metinler) assert.doesNotThrow(() => renkCoz(v, t.palet), `${k.ad}: ${v}`);
    }
  });

  test(`${ad}: zemine bağlı açık katmanlar zeminden SONRA (katman sırası = bağımlılık sırası)`, () => {
    const acik = tanim().katmanlar.filter((k) => k.acik);
    const zemin = acik.findIndex((k) => k.tur === "zemin");
    const erken = acik.filter((k, i) => MODULLER.get(k.tur)?.zemineBagli !== false && zemin !== -1 && i < zemin).map((k) => k.ad);
    assert.deepEqual(erken, []);
  });
}
