// host/grafDosyalari.test.ts — düğüm grafiği dosyaları: ad kuralı (protokolle AYNI), yok/var, atomik yazım, liste, dizin, boyut.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GRAF_BOYUT_SINIRI, grafAdiGecerli, grafDizini, grafListe, grafOku, grafYaz, grafYeni } from "./grafDosyalari.js";
import { grafAdiGecerli as protokolAdi, GRAF_SINIRLARI } from "../protocol/graf.ts";

function gecici(): string { return fs.mkdtempSync(path.join(os.tmpdir(), "orion-graf-test-")); }
const kod = (f: () => unknown): string | undefined => { try { f(); } catch (e) { return (e as { kod?: string }).kod; } return undefined; };

test("AD KURALI protokolünkiyle AYNI (kabuk protokolü import edemez; kopya ayrışırsa burası kırmızı)", () => {
  const ornekler: unknown[] = ["ornek", "Selamla_2", "ağaç-kes", "çay", "a", "a".repeat(GRAF_SINIRLARI.ad), "a".repeat(GRAF_SINIRLARI.ad + 1),
    "", " ", "a b", "../x", "x/y", "x\\y", ".gizli", "x.json", "x..y", "😀", null, 5, undefined];
  assert.deepEqual(ornekler.map((x) => grafAdiGecerli(x)), ornekler.map((x) => protokolAdi(x)));
});

test("dizin: env > senaryo (geçici) > kullanıcı verisi", () => {
  assert.equal(grafDizini({ ORION_GRAF_DIZINI: "/x" }, "/u", "/t"), "/x");
  assert.equal(grafDizini({ ORION_SMOKE: "1" }, "/u", "/t"), path.join("/t", "orion-graf-deneme"));
  assert.equal(grafDizini({}, "/u", "/t"), path.join("/u", "orion-graf"));
});

test("yeni → oku → yaz: dosya '<ad>.json'; varsa 'var', yoksa 'yok'; .tmp artığı kalmaz", () => {
  const d = gecici();
  grafYeni(d, "ornek", "{\"a\":1}");
  assert.equal(fs.existsSync(path.join(d, "ornek.json")), true);
  assert.equal(grafOku(d, "ornek"), "{\"a\":1}");
  grafYaz(d, "ornek", "{\"a\":2}");
  assert.equal(grafOku(d, "ornek"), "{\"a\":2}");
  assert.deepEqual([kod(() => grafYeni(d, "ornek", "x")), kod(() => grafYaz(d, "yok", "x")), kod(() => grafOku(d, "yok"))], ["var", "yok", "yok"]);
  assert.deepEqual(fs.readdirSync(d).filter((f) => f.endsWith(".tmp")), []);
});

test("klasör gezme yok: geçersiz ad 'gecersiz-ad', dışarıya dosya yazılmaz", () => {
  const d = gecici();
  for (const ad of ["../kacis", "a/b", "x.json", ""]) assert.equal(kod(() => grafYeni(d, ad, "x")), "gecersiz-ad", ad);
  assert.equal(fs.existsSync(path.join(d, "..", "kacis.json")), false);
});

test("liste: yalnız geçerli adlı .json dosyaları, uzantısız ad, ada göre", () => {
  const d = gecici();
  grafYeni(d, "zeta", "{}"); grafYeni(d, "alfa", "{}");
  fs.writeFileSync(path.join(d, "not.txt"), "x");
  fs.writeFileSync(path.join(d, "kötü ad.json"), "{}");
  assert.deepEqual(grafListe(d).map((x) => x.ad), ["alfa", "zeta"]);
});

test("boyut sınırı ve metin olmayan içerik reddedilir, dosya değişmez", () => {
  const d = gecici();
  grafYeni(d, "a", "kalsın");
  assert.equal(kod(() => grafYaz(d, "a", "x".repeat(GRAF_BOYUT_SINIRI + 1))), "cok-buyuk");
  assert.equal(kod(() => grafYaz(d, "a", 5 as unknown as string)), "gecersiz-icerik");
  assert.equal(grafOku(d, "a"), "kalsın");
});
