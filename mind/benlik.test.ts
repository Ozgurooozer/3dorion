// mind/benlik.test.ts — Anlık benlik (spec 12 Faz 1–2): kayıt, yaş, meşgul (tek kaynak), izdüşüm, kim yaptı.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { AnlikBenlik, mesgulMu, izdusum, eden, niyetOzeti, durumSatiri, AZAMI_YAS, type BedenOkumasi } from "./benlik.ts";

function kur(beden: BedenOkumasi | null = { poz: "duruyor", oturuyor: false }) {
  let saat = 1_000_000;
  const b = new AnlikBenlik({ simdi: () => saat, beden: () => beden });
  return { b, ilerle: (ms: number) => { saat += ms; } };
}

// ── Yapıyorum / bekliyorum ──────────────────────────────────────────────────

test("gönderilen beden niyeti 'yapıyorum'a girer, sonucu gelince çıkar", () => {
  const { b } = kur();
  b.niyetGonderildi("n_1", { tur: "git", hedef: { tip: "capa", ad: "tahta" } });
  const once = b.oku().yapiyorum.map((y) => y.ozet);
  b.sonucGeldi({ niyet_id: "n_1", durum: "bitti" });
  assert.deepEqual({ once, sonra: b.oku().yapiyorum.length, son: b.oku().son.bitenNiyet?.durum },
    { once: ["git → tahta"], sonra: 0, son: "bitti" });
});

test("'basladi' sonucu niyeti bitirmez", () => {
  const { b } = kur();
  b.niyetGonderildi("n_1", { tur: "otur" });
  b.sonucGeldi({ niyet_id: "n_1", durum: "basladi" });
  assert.equal(b.oku().yapiyorum.length, 1);
});

test("söz ve bakış 'yapıyorum'a girmez (sonucu beklenmez)", () => {
  const { b } = kur();
  b.niyetGonderildi("n_1", { tur: "soyle", metin: "Merhaba" });
  b.niyetGonderildi("n_2", { tur: "sor", ne: "onumde" });
  assert.equal(b.oku().yapiyorum.length, 0);
});

test("ÖNERİ YAŞAM DÖNGÜSÜ: önerildi → onay bekleniyor → onaylandı → sonuç bekleniyor → bitti", () => {
  const { b } = kur();
  const adimlar: string[] = [];
  const yaz = () => adimlar.push(`${b.oku().bekliyorum?.ne ?? "-"}/${b.oku().son.bitenNiyet?.durum ?? "-"}`);
  b.niyetGonderildi("n_k", { tur: "komut", metin: "git status", gerekce: "durum" }); yaz();
  b.sonucGeldi({ niyet_id: "n_k", durum: "bitti", not: "Ozyn onayladi" }); yaz();
  b.terminalBitti("git status", 0); yaz();
  assert.deepEqual(adimlar, ["onay/-", "komut_sonucu/bitti", "-/bitti"]);
});

test("reddedilen öneri beklemeyi kapatır, sonuç beklenmez", () => {
  const { b } = kur();
  b.niyetGonderildi("n_k", { tur: "komut", metin: "rm x", gerekce: "-" });
  b.sonucGeldi({ niyet_id: "n_k", durum: "hata", not: "Ozyn komutu reddetti" });
  assert.deepEqual({ bekliyor: b.oku().bekliyorum, son: b.oku().son.bitenNiyet?.durum }, { bekliyor: null, son: "hata" });
});

test("başka bir komutun bloğu onaylanan komutun sonucunu kapatmaz (yanlış eşleşme yok)", () => {
  const { b } = kur();
  b.niyetGonderildi("n_k", { tur: "komut", metin: "git status", gerekce: "-" });
  b.sonucGeldi({ niyet_id: "n_k", durum: "bitti" });
  b.terminalBitti("ls", 0);
  assert.equal(b.oku().bekliyorum?.ne, "komut_sonucu");
});

test("onaylanan komut hata koduyla biterse son niyet 'hata'", () => {
  const { b } = kur();
  b.niyetGonderildi("n_k", { tur: "komut", metin: "pyhton", gerekce: "-" });
  b.sonucGeldi({ niyet_id: "n_k", durum: "bitti" });
  b.terminalBitti("pyhton", 1);
  assert.deepEqual({ durum: b.oku().son.bitenNiyet?.durum, not: b.oku().son.bitenNiyet?.not }, { durum: "hata", not: "çıkış kodu 1" });
});

// ── Yaş ─────────────────────────────────────────────────────────────────────

test("sonucu hiç dönmeyen niyet azami yaşta BOŞA ÇIKAR", () => {
  const { b, ilerle } = kur();
  b.niyetGonderildi("n_1", { tur: "git", hedef: { tip: "oyuncu" } });
  ilerle(AZAMI_YAS.niyet + 1);
  const g = b.oku();
  assert.deepEqual({ yapiyorum: g.yapiyorum.length, son: g.son.bitenNiyet?.durum }, { yapiyorum: 0, son: "bosa_cikti" });
});

test("onay beklemesi onay kapısının süresinde düşer", () => {
  const { b, ilerle } = kur();
  b.niyetGonderildi("n_k", { tur: "komut", metin: "x", gerekce: "-" });
  ilerle(AZAMI_YAS.onay + 1);
  assert.equal(b.oku().bekliyorum, null);
});

test("'son' alanları azami yaştan sonra görünmez", () => {
  const { b, ilerle } = kur();
  b.soyledi("Merhaba");
  ilerle(AZAMI_YAS.son + 1);
  assert.equal(b.oku().son.soz, undefined);
});

test("okuma dondurulmuştur: dışarıdan değiştirilemez", () => {
  const { b } = kur();
  b.niyetGonderildi("n_1", { tur: "otur" });
  const g = b.oku();
  assert.throws(() => (g.yapiyorum as unknown as unknown[]).push({}));
});

test("bozuk gövde okuması benliği durdurmaz: beden null", () => {
  const b = new AnlikBenlik({ beden: () => { throw new Error("avatar yok"); } });
  assert.equal(b.oku().beden, null);
});

// ── Meşgul: TEK KAYNAK, bugünkünün aynısı (spec 12 Faz 1 kapısı) ─────────────

test("EŞDEĞERLİK: (Ozyn monitörde ∨ mesgulMu) her kombinasyonda bugünkü `mesgul` ifadesiyle aynı", () => {
  const POZLAR = ["duruyor", "yürüyor", "koşuyor", "oturuyor", "el_salliyor"];
  for (const monitor of [false, true]) for (const dusunuyor of [false, true]) for (const poz of POZLAR) {
    // world/giris.ts, Faz 4'ten önceki ifade (birebir):
    const eski = monitor || dusunuyor || poz === "yürüyor" || poz === "koşuyor";
    const b = new AnlikBenlik({ beden: () => ({ poz, oturuyor: poz === "oturuyor" }) });
    if (dusunuyor) b.dusunceBasladi("x", "dis");
    const yeni = monitor || mesgulMu(b.oku()).mesgul;
    assert.equal(yeni, eski, `monitor=${monitor} dusunuyor=${dusunuyor} poz=${poz}`);
  }
});

test("meşgul sebebini söyler", () => {
  const b = new AnlikBenlik({ beden: () => ({ poz: "yürüyor", oturuyor: false }) });
  assert.deepEqual(mesgulMu(b.oku()), { mesgul: true, sebep: "yuruyor" });
});

// ── İzdüşüm (modele GİTMEZ bu fazda; duvar okur) ────────────────────────────

test("izdüşüm: yapılacak ya da beklenecek bir şey yoksa satır yok", () => {
  assert.equal(izdusum(kur().b.oku()), null);
});

test("izdüşüm: yürüyüş ve onay bekleyen öneri, yaşlarıyla, tek satır", () => {
  const { b, ilerle } = kur();
  b.niyetGonderildi("n_1", { tur: "git", hedef: { tip: "capa", ad: "tahta" } });
  b.niyetGonderildi("n_k", { tur: "komut", metin: "git status", gerekce: "-" });
  ilerle(4000);
  assert.equal(izdusum(b.oku()), "You are doing: git → tahta (4 sec). Waiting for Ozyn to approve `git status` (4 sec).");
});

// ── Kim yaptı (ALGI merceği, Faz 2) ─────────────────────────────────────────

test("eden: sonuç kimlik önekinden — Ozyn'in tuşu ozyn, Orion'un önekleri ben", () => {
  const g = kur().b.oku();
  const izgara: [string, string][] = [["elle_x", "ozyn"], ["n_x", "ben"], ["komut_x", "ben"], ["program_x", "ben"], ["refleks_x", "ben"], ["ajanda_x", "ben"], ["dene_x", "dunya"]];
  for (const [id, beklenen] of izgara) {
    assert.equal(eden({ tur: "sonuc", sonuc: { niyet_id: id, durum: "hata" } }, g), beklenen, id);
  }
});

test("eden (B8): Orion yürürken gelen 'Ozyn yaklaştı' ben, dururken ozyn", () => {
  const yuruyor = kur({ poz: "yürüyor", oturuyor: false }).b.oku();
  const duruyor = kur({ poz: "duruyor", oturuyor: false }).b.oku();
  const a = { tur: "olay" as const, ad: "ozyn_yaklasti" };
  assert.deepEqual([eden(a, yuruyor), eden(a, duruyor)], ["ben", "ozyn"]);
});

test("eden: onaylanmış komutun sonucu beklenirken terminal ortak, değilse ozyn", () => {
  const { b } = kur();
  const t = { tur: "terminal" as const, kuyruk: "PS> git status", kesildi: false, kod: 0 };
  const once = eden(t, b.oku());
  b.niyetGonderildi("n_k", { tur: "komut", metin: "git status", gerekce: "-" });
  b.sonucGeldi({ niyet_id: "n_k", durum: "bitti" });
  assert.deepEqual([once, eden(t, b.oku())], ["ozyn", "ortak"]);
});

test("eden: söz ozyn, bakış cevabı ben, inisiyatif olayı ben", () => {
  const g = kur().b.oku();
  assert.deepEqual([
    eden({ tur: "duydum", metin: "x", kesin: true }, g),
    eden({ tur: "gordum", ne: "onumde", metin: "masa" }, g),
    eden({ tur: "olay", ad: "sessizlik", ayrinti: { kaynak: "inisiyatif" } }, g),
  ], ["ozyn", "ben", "ben"]);
});

// ── Bekçiler ────────────────────────────────────────────────────────────────

test("benlik diske gitmez: modül dosya, depolama ya da host bilmez", () => {
  const kaynak = fs.readFileSync(new URL("./benlik.ts", import.meta.url), "utf8");
  for (const yasak of ["node:fs", "localStorage", "../host/", "kararKaydi", "hafiza"]) {
    assert.ok(!kaynak.includes(`from "${yasak}`) && !kaynak.includes(`${yasak}.`), yasak);
  }
});

test("niyet özetleri okunur", () => {
  assert.deepEqual([
    niyetOzeti({ tur: "git", hedef: { tip: "oyuncu" } }),
    niyetOzeti({ tur: "yaz", metin: "merhaba" }),
    niyetOzeti({ tur: "odaklan", capa: "monitor" }),
  ], ["git → Ozyn", 'yaz "merhaba"', "odaklan → monitor"]);
});

// ── Canlı satır (spec 13 Faz 5) ─────────────────────────────────────────────

test("canlı satır: düşünürken saniye sayacı ve kısa model adı, amber", () => {
  const { b, ilerle } = kur();
  b.dusunceBasladi("yerel:ornith-32k:latest", "dis");
  ilerle(3200);
  b.dusunceBasladi("yerel:ornith-32k:latest", "dis");   // aynı tur: başlangıç değişmez
  assert.deepEqual(durumSatiri(b.oku()), { metin: "● düşünüyor 3,2 sn · ornith-32k:latest", ton: "uyari" });
});

test("canlı satır: iş yaparken ve onay beklerken", () => {
  const { b, ilerle } = kur();
  b.niyetGonderildi("n_1", { tur: "git", hedef: { tip: "capa", ad: "tahta" } });
  b.niyetGonderildi("n_k", { tur: "komut", metin: "git status", gerekce: "-" });
  ilerle(2000);
  assert.deepEqual(durumSatiri(b.oku()), { metin: "▶ git → tahta (2,0 sn)  ⏳ onayını bekliyor: `git status` (2,0 sn)", ton: "iyi" });
});

test("canlı satır: boşta, son biten işiyle", () => {
  const { b, ilerle } = kur();
  b.niyetGonderildi("n_1", { tur: "otur" });
  b.sonucGeldi({ niyet_id: "n_1", durum: "bitti" });
  ilerle(5000);
  assert.deepEqual(durumSatiri(b.oku()), { metin: "○ boşta · son: otur ✓ (5,0 sn önce)", ton: "bilgi" });
});
