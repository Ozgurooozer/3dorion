// mind/gozKomutlari.test.ts — "gözünle bak" söz kalıpları (token'sız yol): ne eşleşir, ne LLM'e gider.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { komutCoz } from "./komutSozlugu.ts";
import { niyetDogrula } from "../protocol/dogrula.ts";

const niyet = (soz: string) => komutCoz(soz)?.adimlar[0];

test("gözünle bak sözleri `sor gor` niyetine döner", () => {
  for (const s of ["gözünle bak", "Gözünle bi bak!", "gözlerinle bak", "Orion gözünle bakar mısın", "kendi gözünle bak", "bak gözünle", "gözünle bir bak bakalım", "lütfen gözünle gör"]) {
    assert.deepEqual(niyet(s), { tur: "sor", ne: "gor" }, s);
  }
});

test("program adı komut:goz (karar kaydı: hangi içgüdü)", () => {
  assert.equal(komutCoz("gözünle bak")?.program, "komut:goz");
});

test("soru, olumsuz, çıplak 'bak' ve karışık istek LLM'e gider (eşleşmez)", () => {
  for (const s of ["gözünle neyi görüyorsun", "gözünle bakma", "bak", "gözünle bak ve gece yap", "gözün var mı", "gözünle ilgili bir şey sor", "şuna bak"]) {
    assert.notEqual(komutCoz(s)?.program, "komut:goz", `yanlış eşleşme: ${s}`);
  }
});

test("üretilen niyet doğrulayıcıdan geçer", () => {
  assert.deepEqual(niyetDogrula({ tur: "sor", ne: "gor" }), { ok: true, deger: { tur: "sor", ne: "gor" } });
});
