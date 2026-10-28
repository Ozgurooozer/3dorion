// host/sekansDosyalari.test.ts — sekans dosyaları (spec 36): ad kuralı (protokolle AYNI), yol kaçışı yok, yok/var, liste, dizin, boyut, SİL = KALDIR,
// ve kanal bekçisi (yalnız dosya işlemleri; OYNATMA kanalı yok).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { SEKANS_BOYUT_SINIRI, sekansAdiGecerli, sekansDizini, sekansListe, sekansOku, sekansSil, sekansYaz, sekansYeni } from "./sekansDosyalari.js";
import { grafAdiGecerli } from "./grafDosyalari.js";
import { sekansAdiGecerli as protokolAdi, SEKANS_SINIRLARI } from "../protocol/sekans.ts";

function gecici(): string { return fs.mkdtempSync(path.join(os.tmpdir(), "orion-sekans-test-")); }
const kod = (f: () => unknown): string | undefined => { try { f(); } catch (e) { return (e as { kod?: string }).kod; } return undefined; };

test("AD KURALI protokolünkiyle AYNI ve grafiklerin kopyasının KENDİSİ (üçüncü kopya yok)", () => {
  const ornekler: unknown[] = ["selamlasma", "dusun_onayla", "çay-ocağı", "a".repeat(SEKANS_SINIRLARI.ad), "a".repeat(SEKANS_SINIRLARI.ad + 1),
    "", "a b", "../x", "x/y", "x\\y", ".gizli", "x.json", "@ben", "C:", null, 5];
  assert.deepEqual(ornekler.map((x) => sekansAdiGecerli(x)), ornekler.map((x) => protokolAdi(x)));
  assert.equal(sekansAdiGecerli, grafAdiGecerli);
});

test("dizin: env > senaryo (geçici) > kullanıcı verisi; grafiklerin ve NPC'lerin klasöründen AYRI", () => {
  assert.deepEqual([sekansDizini({ ORION_SEKANS_DIZINI: "/x" }, "/u", "/t"), sekansDizini({ ORION_SMOKE: "1" }, "/u", "/t"), sekansDizini({ ORION_GRAF_DIZINI: "/g" }, "/u", "/t")],
    ["/x", path.join("/t", "orion-sekans-deneme"), path.join("/u", "orion-sekans")]);
  // spec 39: açık proje varsa projenin Content/Sequences'ı; env ve senaryo yine önce gelir (senaryo gerçek projeye yazmaz).
  assert.deepEqual([sekansDizini({}, "/u", "/t", "/p/Sequences"), sekansDizini({ ORION_SMOKE: "1" }, "/u", "/t", "/p/Sequences"), sekansDizini({ ORION_SEKANS_DIZINI: "/x" }, "/u", "/t", "/p/Sequences")],
    ["/p/Sequences", path.join("/t", "orion-sekans-deneme"), "/x"]);
});

test("yeni → oku → yaz: '<ad>.json'; varsa 'var', yoksa 'yok'; geçersiz ad 'gecersiz-ad' ve klasör DIŞINA yazılmaz", () => {
  const d = gecici();
  sekansYeni(d, "selam", "{\"a\":1}");
  sekansYaz(d, "selam", "{\"a\":2}");
  assert.deepEqual([sekansOku(d, "selam"), kod(() => sekansYeni(d, "selam", "x")), kod(() => sekansYaz(d, "yok", "x")), kod(() => sekansOku(d, "yok"))], ["{\"a\":2}", "var", "yok", "yok"]);
  for (const ad of ["../kacis", "..\\kacis", "x.json", "", "a/b"]) assert.equal(kod(() => sekansYeni(d, ad, "x")), "gecersiz-ad", ad);
  assert.deepEqual([fs.existsSync(path.join(d, "..", "kacis.json")), fs.readdirSync(d).filter((f) => f.endsWith(".tmp"))], [false, []]);
});

test("liste: yalnız geçerli adlı .json, uzantısız ad, ada göre; boyut sınırını aşan yazım reddedilir ve dosya değişmez", () => {
  const d = gecici();
  sekansYeni(d, "zeta", "{}"); sekansYeni(d, "alfa", "{}");
  fs.writeFileSync(path.join(d, "not.txt"), "x");
  assert.deepEqual([sekansListe(d).map((x) => x.ad), kod(() => sekansYaz(d, "alfa", "x".repeat(SEKANS_BOYUT_SINIRI + 1))), sekansOku(d, "alfa")], [["alfa", "zeta"], "cok-buyuk", "{}"]);
});

test("SİL = KALDIR: dosya listeden gider, .silinenler altında zaman damgalı kopya KALIR (kalıcı silme yok)", () => {
  const d = gecici();
  sekansYeni(d, "selam", "{\"a\":1}");
  sekansSil(d, "selam", () => 7);
  assert.deepEqual([sekansListe(d), fs.readFileSync(path.join(d, ".silinenler", "selam.json.7"), "utf8"), kod(() => sekansSil(d, "selam")), kod(() => sekansSil(d, "../x"))], [[], "{\"a\":1}", "yok", "gecersiz-ad"]);
});

test("BEKÇİ: sekans kanalları yalnız dosya işlemleri (liste/oku/yaz/yeni/sil) — OYNATMA/çalıştırma kanalı YOK (▶ Ozyn'in tıklaması renderer'da)", () => {
  const require = createRequire(import.meta.url);
  const { CAGRI } = require("./kanallar.cjs") as { CAGRI: Record<string, string> };
  assert.deepEqual(Object.keys(CAGRI).filter((k) => k.startsWith("sekans")).sort(), ["sekansListe", "sekansOku", "sekansSil", "sekansYaz", "sekansYeni"]);
  assert.deepEqual(Object.values(CAGRI).filter((v) => /^sekans:/.test(v) && /oynat|calistir|çalıştır|play/i.test(v)), []);
});
