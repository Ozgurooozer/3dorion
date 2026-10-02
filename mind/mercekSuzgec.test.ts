// mind/mercekSuzgec.test.ts — Süzgeç merceği (spec 12 Faz 4): beklenen cevap ve yan ürün.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { suzgecMercegi } from "./mercekSuzgec.ts";
import { AnlikBenlik } from "./benlik.ts";

function onayliKomut(komut: string) {
  const b = new AnlikBenlik({ beden: () => ({ poz: "oturuyor", oturuyor: true }) });
  b.niyetGonderildi("n_k", { tur: "komut", metin: komut, gerekce: "-" });
  b.sonucGeldi({ niyet_id: "n_k", durum: "bitti" });
  return b.oku();
}
const terminal = (kuyruk: string, kod = 0) => ({ tur: "terminal" as const, kuyruk, kesildi: false, kod });

test("GERÇEK (ortak test 3): onaylanan `ls` sonucu BEKLENEN CEVAP → geçir", () => {
  const m = suzgecMercegi(terminal("PS C:\\Users\\ozigo> ls\nd----- 10.09.2026 .crush"), onayliKomut("ls"));
  assert.deepEqual(m && { oneri: m.oneri, kural: m.kural }, { oneri: "gecir", kural: "benlik.beklenen_cevap" });
});

test("komut satırı başka bir komutsa (Ozyn araya girdi) eşleşmez", () => {
  assert.equal(suzgecMercegi(terminal("PS C:\\Users\\ozigo> git log"), onayliKomut("git status")), null);
});

test("komut beklenmiyorsa terminal için söyleyecek bir şey yok (bugünkü karar)", () => {
  const b = new AnlikBenlik().oku();
  assert.equal(suzgecMercegi(terminal("PS> ls"), b), null);
});

test("onay henüz verilmediyse (yalnız öneri) terminal beklenen cevap değil", () => {
  const b = new AnlikBenlik();
  b.niyetGonderildi("n_k", { tur: "komut", metin: "ls", gerekce: "-" });
  assert.equal(suzgecMercegi(terminal("PS> ls"), b.oku()), null);
});

test("B8: Orion yürürken 'Ozyn yaklaştı' YAN ÜRÜN → süz", () => {
  const b = new AnlikBenlik({ beden: () => ({ poz: "yürüyor", oturuyor: false }) }).oku();
  const m = suzgecMercegi({ tur: "olay", ad: "ozyn_yaklasti", ayrinti: { mesafe: 1.7 } }, b);
  assert.deepEqual(m && { oneri: m.oneri, kural: m.kural }, { oneri: "suz", kural: "benlik.yan_urun" });
});

test("Orion dururken 'Ozyn yaklaştı' Ozyn'in hareketidir: söyleyecek bir şey yok", () => {
  const b = new AnlikBenlik({ beden: () => ({ poz: "duruyor", oturuyor: false }) }).oku();
  assert.equal(suzgecMercegi({ tur: "olay", ad: "ozyn_yaklasti" }, b), null);
});

test("konuşma ve hata ASLA süzülmez: mercek söze ve sonuca dokunmaz", () => {
  const b = new AnlikBenlik({ beden: () => ({ poz: "yürüyor", oturuyor: false }) }).oku();
  assert.deepEqual([
    suzgecMercegi({ tur: "duydum", metin: "dur", kesin: true }, b),
    suzgecMercegi({ tur: "sonuc", sonuc: { niyet_id: "n_x", durum: "hata", not: "yol yok" } }, b),
  ], [null, null]);
});
