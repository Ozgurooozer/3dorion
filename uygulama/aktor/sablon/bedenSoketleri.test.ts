// uygulama/aktor/sablon/bedenSoketleri.test.ts — soket adı → uzuv → dünya matrisi (spec 45 B5). Saf: avatar yerine sahte kaynak.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { UZUVLAR, type Uzuv } from "../../../protocol/animasyon.ts";
import { BEDEN_SOKETLERI, bedenSoketiCozucu, bedenSoketiVarMi, type BedenKaynagi } from "./bedenSoketleri.ts";

/** Konum = uzvun UZUVLAR sırası (x ekseni): hangi uzva sorulduğu matristen okunur. */
const sahte = (eksik: Uzuv[] = []): BedenKaynagi => ({
  uzuvDunyaMatrisi: (u) => (eksik.includes(u) ? null : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, UZUVLAR.indexOf(u), 2, 3, 1]),
});

test("her soket gerçek bir uzva eşlenir (yazım hatası tabloda yakalanır)", () => {
  for (const [soket, uzuv] of Object.entries(BEDEN_SOKETLERI)) assert.ok((UZUVLAR as readonly string[]).includes(uzuv), `${soket} → ${uzuv}`);
});

test("el_sag → sag_el matrisi; konum matristen okunur", () => {
  const c = bedenSoketiCozucu((ad) => (ad === "orion" ? sahte() : null));
  const m = c("orion", "el_sag")!;
  assert.deepEqual([m.m[12], m.m[13], m.m[14]], [UZUVLAR.indexOf("sag_el"), 2, 3]);
  assert.equal(c("orion", "el_sol")!.m[12], UZUVLAR.indexOf("sol_el"));
});

test("çözülemeyen her durum null: bilinmeyen beden, bilinmeyen soket, uzuvsuz gövde, bozuk matris", () => {
  const c = bedenSoketiCozucu((ad) => (ad === "orion" ? sahte(["sag_el"]) : ad === "bozuk" ? { uzuvDunyaMatrisi: () => [1, 2, 3] } : null));
  assert.equal(c("yok", "el_sag"), null);
  assert.equal(c("orion", "uydurma_soket"), null);
  assert.equal(c("orion", "el_sag"), null);
  assert.equal(c("bozuk", "el_sag"), null);
  assert.equal(c("orion", "toString"), null, "prototip adı soket sayılmaz");
});

test("iki beden ayrı çözülür; her çağrı taze matris okur (kaynak değişince sonuç değişir)", () => {
  let x = 1;
  const c = bedenSoketiCozucu((ad) => ({ uzuvDunyaMatrisi: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ad === "orion" ? x : -x, 0, 0, 1] }));
  assert.equal(c("orion", "bas")!.m[12], 1); assert.equal(c("flash1", "bas")!.m[12], -1);
  x = 5;
  assert.equal(c("orion", "bas")!.m[12], 5);
});

test("bedenSoketiVarMi: tür koruması", () => {
  assert.equal(bedenSoketiVarMi("el_sag"), true); assert.equal(bedenSoketiVarMi("el"), false);
});

test("tablo sabit: level JSON'u bu adlara güvenir; bir adın uzvu değişirse bilerek değişir (eski level'ları sessizce kaydırmaz)", () => {
  assert.deepEqual({ ...BEDEN_SOKETLERI }, {
    el_sag: "sag_el", el_sol: "sol_el", on_kol_sag: "sag_on_kol", on_kol_sol: "sol_on_kol", kol_sag: "sag_kol", kol_sol: "sol_kol",
    ayak_sag: "sag_ayak", ayak_sol: "sol_ayak", bas: "bas", boyun: "boyun", gogus: "gogus", govde: "govde", kalca: "kalca", sirt: "gogus",
  });
});
