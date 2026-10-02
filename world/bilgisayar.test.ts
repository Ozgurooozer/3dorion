// world/bilgisayar.test.ts — "Bilgisayarı aç" programı (spec 13 Faz 2a).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { bilgisayariAc, type BilgisayarBaglami } from "./bilgisayar.ts";
import type { NiyetSonucu } from "../protocol/niyet.ts";

/** Sahte dünya: ne yapıldığını sırayla yazar. */
function dunya(ayar: { oturuyor?: boolean; acik?: boolean; oturSonucu?: NiyetSonucu["durum"]; acilmaz?: boolean } = {}) {
  const yapilan: string[] = [];
  let oturuyor = ayar.oturuyor ?? false, acik = ayar.acik ?? false;
  const b: BilgisayarBaglami = {
    oturuyorMu: () => oturuyor,
    otur: async () => {
      yapilan.push("otur");
      const durum = ayar.oturSonucu ?? "bitti";
      if (durum === "bitti") oturuyor = true;
      return { niyet_id: "x", durum, ...(durum === "hata" ? { not: "yol yok" } : {}) };
    },
    monitorAcikMi: () => acik,
    monitorAc: async () => {
      yapilan.push("monitorAc");
      if (ayar.acilmaz) throw new Error("pty yok");
      acik = true;
    },
  };
  return { b, yapilan };
}

test("ayaktayken: önce oturur, sonra monitörü açar", async () => {
  const { b, yapilan } = dunya();
  const s = await bilgisayariAc(b);
  assert.deepEqual({ yapilan, durum: s.durum }, { yapilan: ["otur", "monitorAc"], durum: "bitti" });
});

test("zaten oturuyorsa yeniden oturmaz", async () => {
  const { b, yapilan } = dunya({ oturuyor: true });
  await bilgisayariAc(b);
  assert.deepEqual(yapilan, ["monitorAc"]);
});

test("monitör zaten açıksa yeniden açmaz", async () => {
  const { b, yapilan } = dunya({ oturuyor: true, acik: true });
  const s = await bilgisayariAc(b);
  assert.deepEqual({ yapilan, durum: s.durum }, { yapilan: [], durum: "bitti" });
});

test("oturamazsa monitörü açmaz ve sebebi söyler", async () => {
  const { b, yapilan } = dunya({ oturSonucu: "hata" });
  const s = await bilgisayariAc(b);
  assert.deepEqual({ yapilan, durum: s.durum, not: s.not }, { yapilan: ["otur"], durum: "hata", not: "masaya oturamadım: yol yok" });
});

test("oturma kesilirse (iptal) program hata ile biter", async () => {
  const { b } = dunya({ oturSonucu: "iptal" });
  assert.equal((await bilgisayariAc(b)).durum, "hata");
});

test("terminal açılamazsa fırlatmaz, hata notu döner", async () => {
  const { b } = dunya({ oturuyor: true, acilmaz: true });
  const s = await bilgisayariAc(b);
  assert.deepEqual(s, { durum: "hata", not: "terminal açılamadı: pty yok" });
});

test("başarı notu beyne komutun onaylı olduğunu ve kabuğu söyler", async () => {
  const { b } = dunya();
  const s = await bilgisayariAc(b);
  assert.match(s.not, /dunya_komut/);
  assert.match(s.not, /PowerShell/);
});
