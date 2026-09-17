// bridge/baglam.test.ts — bağlam sözleşmesinin iki kuralı.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { baglamMetni } from "./baglam.ts";
import type { BeyinGirdisi } from "./beyin.ts";

const girdi: BeyinGirdisi = {
  talimat: "T", sabit: "S", dunya: "D", ozetler: ["Baktın (onumde): yönetim terminali"],
  anilar: [], araclar: [],
  gecmis: [
    { rol: "kullanici", metin: "önünde ne var" },
    { rol: "orion", metin: "Bakıyorum." },
    { rol: "orion", metin: "Bakıyorum.", arac: true },
  ],
};

test("oturumlu beyinde geçmiş metne GİRMEZ — oturum zaten biliyor", () => {
  assert.doesNotMatch(baglamMetni(girdi).kullanici, /önünde ne var/);
});

test("durumsuz beyinde geçmiş girer, 'Baktın' satırından ÖNCE ve tekrarsız", () => {
  const k = baglamMetni(girdi, { gecmis: true }).kullanici;
  assert.match(k, /Ozyn: önünde ne var/);
  assert.equal(k.match(/Sen: Bakıyorum\./g)?.length, 1, "aynı söz iki kez yazıldı");
  assert.ok(k.indexOf("Ozyn:") < k.indexOf("Baktın"), "soru cevaptan sonra geldi");
});
