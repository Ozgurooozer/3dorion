// world/arayuz/menu/menuModeli.test.ts — bağlam menüsü çekirdeği: yol birleştirme, koşullar, gri+neden, taşma, ayraç, hatalar, klavye gezinmesi.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { menuKur, sonrakiSatir, type MenuBaglami, type MenuKatkisi, type MenuOgesi, type MenuDugumu } from "./menuModeli.ts";

type B = MenuBaglami & { hedef: { tur: string }; oturuyor?: boolean };
const oge = (yol: string[], kimlik: string, ek: Partial<MenuOgesi<string>> = {}): MenuOgesi<string> => ({ yol, kimlik, uygun: true, eylem: kimlik, ...ek });
const katki = (kimlik: string, hedefler: string[] | "hepsi", ogeler: MenuOgesi<string>[], kosul?: (b: B) => boolean): MenuKatkisi<B, string> =>
  ({ kimlik, hedefler, ogeler: () => ogeler, ...(kosul ? { kosul } : {}) });
const ad = (d: MenuDugumu<string>): string => (d.tur === "ayrac" ? "—" : d.ad);
const adlar = (l: MenuDugumu<string>[]): string[] => l.map(ad);
const alt = (d: MenuDugumu<string> | undefined): MenuDugumu<string>[] => { assert.equal(d?.tur, "alt"); return (d as Extract<MenuDugumu<string>, { tur: "alt" }>).ogeler; };

const zemin: B = { hedef: { tur: "zemin" } };

test("iki ayrı katkı aynı alt menünün altında BİRLEŞİR", () => {
  const m = menuKur(zemin, [
    katki("a", "hepsi", [oge(["Orion", "Git"], "git")]),
    katki("b", "hepsi", [oge(["Orion", "Bak"], "bak")]),
  ]);
  assert.deepEqual(adlar(m), ["Orion"]);
  assert.deepEqual(adlar(alt(m[0])), ["Bak", "Git"]);   // sıra eşit → ada göre
});

test("hedef türü uymayan katkı HİÇ görünmez; 'hepsi' her hedefte görünür", () => {
  const k = [katki("yalnız-orion", ["orion"], [oge(["Dur"], "dur")]), katki("her", "hepsi", [oge(["Özellikler"], "oz")])];
  assert.deepEqual(adlar(menuKur(zemin, k)), ["Özellikler"]);
  assert.deepEqual(adlar(menuKur({ hedef: { tur: "orion" } }, k)), ["Dur", "Özellikler"]);
});

test("koşulu tutmayan katkı görünmez; tutan görünür", () => {
  const k = [katki("kalk", ["orion"], [oge(["Kalk"], "kalk")], (b) => b.oturuyor === true)];
  assert.deepEqual(menuKur({ hedef: { tur: "orion" }, oturuyor: false }, k), []);
  assert.deepEqual(adlar(menuKur({ hedef: { tur: "orion" }, oturuyor: true }, k)), ["Kalk"]);
});

test("yapılamayan öğe GİZLENMEZ: gri ve nedenli; uygun öğenin nedeni null", () => {
  const m = menuKur(zemin, [katki("a", "hepsi", [oge(["Git"], "git", { uygun: false, neden: "engel var" }), oge(["Bak"], "bak", { neden: "yok sayılır" })])]);
  const git = m.find((d) => d.tur === "eylem" && d.ad === "Git");
  const bak = m.find((d) => d.tur === "eylem" && d.ad === "Bak");
  assert.deepEqual([git?.tur === "eylem" && git.uygun, git?.tur === "eylem" && git.neden], [false, "engel var"]);
  assert.deepEqual([bak?.tur === "eylem" && bak.uygun, bak?.tur === "eylem" && bak.neden], [true, null]);
});

test("alt menünün bütün yaprakları gri ise alt menü de gri; biri uygunsa uygun", () => {
  const hepsiGri = menuKur(zemin, [katki("a", "hepsi", [oge(["X", "a"], "a", { uygun: false }), oge(["X", "b"], "b", { uygun: false })])]);
  assert.equal(hepsiGri[0]?.tur === "alt" && hepsiGri[0].uygun, false);
  const biriUygun = menuKur(zemin, [katki("a", "hepsi", [oge(["X", "a"], "a", { uygun: false }), oge(["X", "b"], "b")])]);
  assert.equal(biriUygun[0]?.tur === "alt" && biriUygun[0].uygun, true);
});

test("sıra: küçük sayı önce; alt menünün sırası en küçük çocuğununkidir", () => {
  const m = menuKur(zemin, [katki("a", "hepsi", [
    oge(["Zeta"], "z", { sira: 10 }), oge(["Alfa"], "a", { sira: 50 }),
    oge(["Orta", "x"], "x", { sira: 5 }),
  ])]);
  assert.deepEqual(adlar(m), ["Orta", "Zeta", "Alfa"]);
});

test("grup değişince araya AYRAÇ girer; baş ve sonda ayraç olmaz", () => {
  const m = menuKur(zemin, [katki("a", "hepsi", [
    oge(["A"], "a", { sira: 1, grup: "g1" }), oge(["B"], "b", { sira: 2, grup: "g1" }),
    oge(["C"], "c", { sira: 3, grup: "g2" }),
  ])]);
  assert.deepEqual(adlar(m), ["A", "B", "—", "C"]);
});

test("taşma: azami üstünde öğe 'Diğer ▸'e gider; toplam öğe kaybolmaz", () => {
  const ogeler = Array.from({ length: 6 }, (_, i) => oge([`O${i}`], `o${i}`, { sira: i }));
  const m = menuKur(zemin, [katki("a", "hepsi", ogeler)], { azamiOge: 4 });
  assert.deepEqual(adlar(m), ["O0", "O1", "O2", "Diğer"]);
  assert.deepEqual(adlar(alt(m[3])), ["O3", "O4", "O5"]);
});

test("azami sınırda taşma yok: tam azami öğe düz görünür", () => {
  const ogeler = Array.from({ length: 4 }, (_, i) => oge([`O${i}`], `o${i}`, { sira: i }));
  assert.deepEqual(adlar(menuKur(zemin, [katki("a", "hepsi", ogeler)], { azamiOge: 4 })), ["O0", "O1", "O2", "O3"]);
});

test("kısayol ipucu yaprağa taşınır, yoksa null", () => {
  const m = menuKur(zemin, [katki("a", "hepsi", [oge(["Otur"], "otur", { kisayol: "F" }), oge(["Bak"], "bak")])]);
  const k = Object.fromEntries(m.flatMap((d) => (d.tur === "eylem" ? [[d.ad, d.kisayol]] : [])));
  assert.deepEqual(k, { Otur: "F", Bak: null });
});

test("eylem yükü olduğu gibi döner (çekirdek yorumlamaz)", () => {
  const yuk = { niyet: "git" };
  const m = menuKur(zemin, [{ kimlik: "a", hedefler: "hepsi", ogeler: () => [{ yol: ["Git"], kimlik: "git", uygun: true, eylem: yuk }] }]);
  assert.equal(m[0]?.tur === "eylem" && m[0].eylem, yuk);
});

test("aynı kimlik iki kez katkılanırsa HATA (sessiz ezme yok)", () => {
  assert.throws(() => menuKur(zemin, [katki("a", "hepsi", [oge(["X"], "ayni")]), katki("b", "hepsi", [oge(["Y"], "ayni")])]), /iki kez/);
});

test("aynı ad hem eylem hem alt menü olursa HATA (iki sırayla da)", () => {
  assert.throws(() => menuKur(zemin, [katki("a", "hepsi", [oge(["Orion"], "o1"), oge(["Orion", "Git"], "o2")])]), /hem eylem hem alt menü/);
  assert.throws(() => menuKur(zemin, [katki("a", "hepsi", [oge(["Orion", "Git"], "o2"), oge(["Orion"], "o1")])]), /hem eylem hem alt menü/);
});

test("boş yol ya da boş parça HATA", () => {
  assert.throws(() => menuKur(zemin, [katki("a", "hepsi", [oge([], "x")])]), /boş yol/);
  assert.throws(() => menuKur(zemin, [katki("a", "hepsi", [oge(["A", " "], "y")])]), /boş yol/);
});

test("hiç katkı yoksa menü boş", () => {
  assert.deepEqual(menuKur(zemin, []), []);
});

// ── klavye ──
const k3 = menuKur(zemin, [katki("a", "hepsi", [
  oge(["A"], "a", { sira: 1, grup: "1" }), oge(["B"], "b", { sira: 2, grup: "1", uygun: false }), oge(["C"], "c", { sira: 3, grup: "2" }),
])]);   // A, B(gri), ayraç, C

test("klavye: aşağı gri satırı ve ayracı ATLAR, sona gelince başa sarar", () => {
  assert.equal(sonrakiSatir(k3, null, 1), 0);
  assert.equal(sonrakiSatir(k3, 0, 1), 3);
  assert.equal(sonrakiSatir(k3, 3, 1), 0);
});

test("klavye: yukarı sondan başlar ve geriye sarar", () => {
  assert.equal(sonrakiSatir(k3, null, -1), 3);
  assert.equal(sonrakiSatir(k3, 0, -1), 3);
  assert.equal(sonrakiSatir(k3, 3, -1), 0);
});

test("klavye: etkileşilebilir satır yoksa ya da liste boşsa null", () => {
  const hepsiGri = menuKur(zemin, [katki("a", "hepsi", [oge(["A"], "a", { uygun: false })])]);
  assert.equal(sonrakiSatir(hepsiGri, null, 1), null);
  assert.equal(sonrakiSatir([], null, 1), null);
});

test("taşma sınırı: azami+1 öğe TAM bir fazlalıkla taşar (Diğer'de 2 öğe)", () => {
  const ogeler = Array.from({ length: 5 }, (_, i) => oge([`O${i}`], `o${i}`, { sira: i }));
  const m = menuKur(zemin, [katki("a", "hepsi", ogeler)], { azamiOge: 4 });
  assert.deepEqual(adlar(m), ["O0", "O1", "O2", "Diğer"]);
  assert.deepEqual(adlar(alt(m[3])), ["O3", "O4"]);
});
