// mind/doktorKomutlari.test.ts — Orion Doktor söz kalıpları (token'sız yol): hangi söz hangi kapsamı ister, neler LLM'e gider.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { komutCoz } from "./komutSozlugu.ts";
import { niyetDogrula } from "../protocol/dogrula.ts";

const niyet = (soz: string) => komutCoz(soz)?.adimlar[0];

test("hızlı muayene sözleri: doktor, doktoru çağır, kendini kontrol et, muayene ol, hata kontrolü yap", () => {
  for (const s of ["doktor", "Doktoru çağır!", "kendini kontrol et", "kendini muayene et", "muayene ol", "hata kontrolü yap", "Orion hadi doktor", "lütfen kontrol et"]) {
    assert.deepEqual(niyet(s), { tur: "doktor" }, s);
  }
});

test("tam muayene sözleri kapsamı 'tam' yapar", () => {
  for (const s of ["tam muayene", "tam kontrol yap", "doktor tam", "kendini tam kontrol et", "Tam muayene ol"]) {
    assert.deepEqual(niyet(s), { tur: "doktor", kapsam: "tam" }, s);
  }
});

test("program adı komut:doktor (karar kaydı: hangi içgüdü)", () => {
  assert.equal(komutCoz("doktor")?.program, "komut:doktor");
});

test("serbest soru, olumsuz ve karışık istek LLM'e gider (eşleşmez)", () => {
  for (const s of ["doktor ne işe yarar", "kontrol etme", "doktoru çağır ve gece yap", "hastaneye git", "muayene olmak istemiyorum", "tam gaz"]) {
    assert.equal(niyet(s)?.tur === "doktor" ? s : null, null, `yanlış eşleşme: ${s}`);
  }
});

test("üretilen niyet doğrulayıcıdan geçer; uydurma kapsam reddedilir", () => {
  assert.deepEqual(niyetDogrula({ tur: "doktor" }), { ok: true, deger: { tur: "doktor" } });
  assert.deepEqual(niyetDogrula({ tur: "doktor", kapsam: "tam" }), { ok: true, deger: { tur: "doktor", kapsam: "tam" } });
  const k = niyetDogrula({ tur: "doktor", kapsam: "bilmem" });
  assert.equal(k.ok, false);
  assert.match(k.ok ? "" : k.hata, /doktor\.kapsam geçersiz/);
});
