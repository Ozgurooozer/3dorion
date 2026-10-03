// bridge/komutProgrami.test.ts — Doğuştan programın yürütme planı (spec 14 R7).
//
// Köprü üzerinden davranış bridge/kopruKomut.test.ts'te (değişmeden geçiyor). Burada plan tek başına.
import { test } from "node:test";
import assert from "node:assert/strict";
import { programPlani } from "./komutProgrami.ts";
import { niyetKaynagi } from "../mind/durumKodu.ts";
import type { Niyet } from "../protocol/niyet.ts";

const BOZUK = JSON.parse('{"tur":"poz","poz":"uçuyor"}') as Niyet;
const GIT_OTUR = {
  program: "komut:git_otur",
  adimlar: [{ tur: "git", hedef: { tip: "capa", ad: "sandalye" } }, { tur: "otur" }] as Niyet[],
};

/** Sıralı sahte kimlik: k1, k2, … */
function sayacli() {
  let i = 0;
  return () => `k${++i}`;
}

test("her adım sırayla kimlik alır", () => {
  const p = programPlani(GIT_OTUR, sayacli());
  assert.deepEqual(p.adimlar.map((a) => a.id), ["k1", "k2"]);
});

test("varsayılan kimlik `komut` önekini taşır", () => {
  const p = programPlani(GIT_OTUR);
  assert.deepEqual(p.adimlar.map((a) => niyetKaynagi(a.id)), ["komut", "komut"]);
});

test("geçmiş çağrıları gerçek araç adı ve girdisiyle kurulur", () => {
  const p = programPlani(GIT_OTUR, sayacli());
  // Model geçmişi JSON olarak görür. Doğrulayıcı `otur`a `capa: undefined` ekler; JSON'da yoktur.
  assert.deepEqual(JSON.parse(JSON.stringify(p.cagrilar)), [
    { ad: "dunya_git", girdi: { hedef: { tip: "capa", ad: "sandalye" } } },
    { ad: "dunya_otur", girdi: {} },
  ]);
});

test("kayıt niyetleri adımlarla aynı kimliği taşır", () => {
  const p = programPlani(GIT_OTUR, sayacli());
  assert.deepEqual(p.niyetler.map((n) => n.id), p.adimlar.map((a) => a.id));
});

test("geçerli planda hata yok", () => {
  assert.equal(programPlani(GIT_OTUR, sayacli()).hata, undefined);
});

test("geçersiz adım hatayı adıyla söyler", () => {
  const p = programPlani({ program: "komut:bozuk", adimlar: [{ tur: "otur" }, BOZUK] }, sayacli());
  assert.match(p.hata ?? "", /^gecersiz adim "poz"/);
});

test("geçersiz adımda yalnız ÖNCEKİ geçerli adımların çağrısı kalır", () => {
  const p = programPlani({ program: "komut:bozuk", adimlar: [{ tur: "otur" }, BOZUK, { tur: "kalk" }] }, sayacli());
  assert.deepEqual(p.cagrilar.map((c) => c.ad), ["dunya_otur"]);
});
