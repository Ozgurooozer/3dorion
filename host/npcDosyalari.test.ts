// host/npcDosyalari.test.ts — NPC kayıt dosyaları (spec 35 dilim 3): ad kuralı (protokolle AYNI), yok/var, liste, dizin, boyut, SİL = KALDIR (.silinenler).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { NPC_BOYUT_SINIRI, npcAdiGecerli, npcDizini, npcListe, npcOku, npcSil, npcYaz, npcYeni } from "./npcDosyalari.js";
import { grafAdiGecerli } from "./grafDosyalari.js";
import { npcAdiGecerli as protokolAdi } from "../protocol/npc.ts";
import { GRAF_SINIRLARI } from "../protocol/graf.ts";

function gecici(): string { return fs.mkdtempSync(path.join(os.tmpdir(), "orion-npc-test-")); }
const kod = (f: () => unknown): string | undefined => { try { f(); } catch (e) { return (e as { kod?: string }).kod; } return undefined; };

test("AD KURALI protokolünkiyle AYNI ve grafiklerin kopyasının KENDİSİ (üçüncü kopya yok)", () => {
  const ornekler: unknown[] = ["nobetci", "kapi_2", "çay-ocağı", "a".repeat(GRAF_SINIRLARI.ad), "a".repeat(GRAF_SINIRLARI.ad + 1),
    "", "a b", "../x", "x/y", "x\\y", ".gizli", "x.json", "@ben", null, 5];
  assert.deepEqual(ornekler.map((x) => npcAdiGecerli(x)), ornekler.map((x) => protokolAdi(x)));
  assert.equal(npcAdiGecerli, grafAdiGecerli);
});

test("dizin: env > senaryo (geçici) > kullanıcı verisi; grafiklerin klasöründen AYRI", () => {
  assert.equal(npcDizini({ ORION_NPC_DIZINI: "/x" }, "/u", "/t"), "/x");
  assert.equal(npcDizini({ ORION_SMOKE: "1" }, "/u", "/t"), path.join("/t", "orion-npc-deneme"));
  assert.equal(npcDizini({}, "/u", "/t"), path.join("/u", "orion-npc"));
  assert.equal(npcDizini({ ORION_GRAF_DIZINI: "/g" }, "/u", "/t"), path.join("/u", "orion-npc"));
});

test("yeni → oku → yaz: '<ad>.json'; varsa 'var', yoksa 'yok'; geçersiz ad 'gecersiz-ad' ve klasör dışına yazılmaz", () => {
  const d = gecici();
  npcYeni(d, "nobetci", "{\"a\":1}");
  assert.equal(fs.existsSync(path.join(d, "nobetci.json")), true);
  npcYaz(d, "nobetci", "{\"a\":2}");
  assert.equal(npcOku(d, "nobetci"), "{\"a\":2}");
  assert.deepEqual([kod(() => npcYeni(d, "nobetci", "x")), kod(() => npcYaz(d, "yok", "x")), kod(() => npcOku(d, "yok"))], ["var", "yok", "yok"]);
  for (const ad of ["../kacis", "x.json", ""]) assert.equal(kod(() => npcYeni(d, ad, "x")), "gecersiz-ad", ad);
  assert.equal(fs.existsSync(path.join(d, "..", "kacis.json")), false);
  assert.deepEqual(fs.readdirSync(d).filter((f) => f.endsWith(".tmp")), []);
});

test("liste: yalnız geçerli adlı .json, uzantısız ad, ada göre; boyut sınırı aşan yazım reddedilir", () => {
  const d = gecici();
  npcYeni(d, "zeta", "{}"); npcYeni(d, "alfa", "{}");
  fs.writeFileSync(path.join(d, "not.txt"), "x");
  assert.deepEqual(npcListe(d).map((x) => x.ad), ["alfa", "zeta"]);
  assert.equal(kod(() => npcYaz(d, "alfa", "x".repeat(NPC_BOYUT_SINIRI + 1))), "cok-buyuk");
  assert.equal(npcOku(d, "alfa"), "{}");
});

test("BEKÇİ: NPC kanalları yalnız dosya işlemleri (liste/oku/yaz/yeni/sil) — dinleme/çalıştırma kanalı YOK (Ozyn'in tıklaması renderer'da)", () => {
  const require = createRequire(import.meta.url);
  const { CAGRI } = require("./kanallar.cjs") as { CAGRI: Record<string, string> };
  assert.deepEqual(Object.keys(CAGRI).filter((k) => k.startsWith("npc")).sort(), ["npcListe", "npcOku", "npcSil", "npcYaz", "npcYeni"]);
  assert.deepEqual(Object.values(CAGRI).filter((v) => /dinle|calistir|çalıştır/i.test(v) && /^(npc|graf):/.test(v)), []);
});

test("SİL = KALDIR: dosya listeden gider, .silinenler altında zaman damgalı kopya KALIR (kalıcı silme yok)", () => {
  const d = gecici();
  npcYeni(d, "nobetci", "{\"a\":1}");
  npcSil(d, "nobetci", () => 7);
  assert.deepEqual(npcListe(d), []);
  assert.equal(fs.readFileSync(path.join(d, ".silinenler", "nobetci.json.7"), "utf8"), "{\"a\":1}");
  assert.deepEqual([kod(() => npcSil(d, "nobetci")), kod(() => npcSil(d, "../x"))], ["yok", "gecersiz-ad"]);
});
