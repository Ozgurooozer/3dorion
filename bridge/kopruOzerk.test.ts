// bridge/kopruOzerk.test.ts — Kendiliğinden (köken=inisiyatif) tur: dar araç kümesi, zincir 0, neden ve bütçe (T2-K3/K4/K5).
//
// H2 (ön-kayıt 001): sahte beyin HER turda `dunya_sor` çağırmaya zorlansa bile her inisiyatif olayı EN FAZLA 1 model turu
// üretir (12 Ekim taban: 2,06). Ozyn'in kendi turları değişmez: tam araç kümesi, 1 takip turu.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "./beyin.ts";
import { OZERK_ARACLAR, araclariUret } from "./araclar.ts";
import { KARAR_ONEKI, KararKaydi, type KararSatiri, type UyanisSatiri } from "../mind/kararKaydi.ts";

class SorBeyni implements Beyin {
  readonly ad = "sor-israrcisi";
  gordugu: BeyinGirdisi[] = [];
  cevap: BeyinCikti;
  constructor(cevap: BeyinCikti = { metin: "", cagrilar: [{ ad: "dunya_sor", girdi: { ne: "onumde" } }] }) { this.cevap = cevap; }
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> { this.gordugu.push(structuredClone(g)); return structuredClone(this.cevap); }
}
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

function kur(beyin: Beyin, ek: Record<string, unknown> = {}) {
  const satirlar: KararSatiri[] = [];
  const gonderilen: { id: string; tur: string }[] = [];
  const butce: { sureMs: number; token: number | undefined; eylemli: boolean }[] = [];
  const k = new Kopru({
    beyin, toplamaMs: 5, dunyaDurumu: () => "oda",
    niyetGonder: (n, id) => { gonderilen.push({ id, tur: n.tur }); },
    inisiyatifButcesi: { sonuc: (_t, sureMs, token, eylemli) => { butce.push({ sureMs, token, eylemli }); } },
    kararKaydi: new KararKaydi({ yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1))) }),
    ...ek,
  });
  return { k, gonderilen, butce, uyanislar: () => satirlar.filter((s): s is UyanisSatiri => s.tur === "uyanis") };
}
const olay = (neden = "sessizlik") => ({ tur: "olay" as const, ad: "nobody has spoken for 15 minutes", ayrinti: { kaynak: "inisiyatif", neden, derinlik: 0 } });
const adlar = (g: BeyinGirdisi) => g.araclar.map((a) => a.ad).sort();

test("H2 düşman: model sor'a ısrar etse bile inisiyatif olayı TEK model turu üretir ve sor sunulmaz", async () => {
  const b = new SorBeyni();
  const { k } = kur(b);
  k.algi(olay());
  await bekle(60);
  // Dünya (varsa) cevabı gordum olarak yollar; araç sunulmadığı için model sor çağırsa bile köprü onu reddeder.
  k.algi({ tur: "gordum", ne: "onumde", metin: "masa" });
  await bekle(60);
  assert.equal(b.gordugu.length, 1, "inisiyatif olayı başına model turu");
  assert.deepEqual(adlar(b.gordugu[0]!), [...OZERK_ARACLAR].sort());
});

test("özerk tur: komut, git, otur, sor, odaklan, yaz sunulmaz (Ozyn yokken bir şey çalıştıramaz)", async () => {
  const b = new SorBeyni();
  const { k } = kur(b);
  k.algi(olay());
  await bekle(60);
  const sunulan = new Set(adlar(b.gordugu[0]!));
  for (const yasak of ["dunya_komut", "dunya_git", "dunya_otur", "dunya_sor", "dunya_odaklan", "dunya_yaz", "dunya_hatirla"]) {
    assert.equal(sunulan.has(yasak), false, yasak);
  }
});

// Sözleşme yalnız modele gösterilen listede değil köprüde de uygulanır (2026-10-13 sondası: sunulmayan komut ve sor
// dünyaya gidiyordu; H2 testi yalnız tur sayısına baktığı için görmemişti).
for (const [ad, girdi, niyet] of [
  ["dunya_komut", { metin: "git status", gerekce: "Ozyn yokken" }, "komut"],
  ["dunya_sor", { ne: "onumde" }, "sor"],
] as const) {
  test(`özerk tur: sunulmayan ${ad} YAPISAL çağrılsa da dünyaya gitmez ve reddedilir`, async () => {
    const { k, gonderilen, uyanislar } = kur(new SorBeyni({ metin: "", cagrilar: [{ ad, girdi }] }));
    k.algi(olay());
    await bekle(60);
    assert.deepEqual([gonderilen.some((g) => g.tur === niyet), uyanislar()[0]?.reddedilen], [false, 1]);
  });

  test(`özerk tur: sunulmayan ${ad} METİN içinde yazılsa da dünyaya gitmez ve konuşulmaz`, async () => {
    const konusulan: string[] = [];
    const { k, gonderilen } = kur(new SorBeyni({ metin: JSON.stringify({ name: ad, arguments: girdi }), cagrilar: [] }));
    k.konusmaDinle((m) => konusulan.push(m));
    k.algi(olay());
    await bekle(60);
    assert.deepEqual([gonderilen.some((g) => g.tur === niyet), konusulan], [false, []]);
  });
}

test("Ozyn'in kendi turu DEĞİŞMEZ: tam araç kümesi ve 1 takip turu (gordum cevabı)", async () => {
  const b = new SorBeyni();
  const { k } = kur(b);
  k.algi({ tur: "duydum", metin: "ne görüyorsun", kesin: true });
  await bekle(60);
  // Flash yokken (emirHedefleri verilmedi) `dunya_emret` sunulmaz: Orion'un araç yüzeyi Flash'tan ÖNCEKİYLE aynı (bkz. kopruEmir.test.ts).
  assert.equal(adlar(b.gordugu[0]!).length, araclariUret().filter((a) => a.ad !== "dunya_emret").length, "Ozyn turunda tüm araçlar (emret hariç)");
  k.algi({ tur: "gordum", ne: "onumde", metin: "masa" });
  await bekle(60);
  assert.equal(b.gordugu.length, 2, "Ozyn turunun takip turu hâlâ var");
});

test("geri alma: ozerkTur=false eski davranışa döner (tam araç kümesi, 1 takip turu)", async () => {
  const b = new SorBeyni();
  const { k } = kur(b, { ozerkTur: false });
  k.algi(olay());
  await bekle(60);
  assert.equal(adlar(b.gordugu[0]!).includes("dunya_komut"), true);
  k.algi({ tur: "gordum", ne: "onumde", metin: "masa" });
  await bekle(60);
  assert.equal(b.gordugu.length, 2);
});

test("uyanış satırı: neden yazılır; eylemsiz uyanış eylemli=false ve bütçe GERÇEK sonuçla beslenir", async () => {
  const b = new SorBeyni({ metin: "", cagrilar: [] });
  const { k, uyanislar, butce } = kur(b);
  k.algi(olay("acik_is"));
  await bekle(60);
  const u = uyanislar()[0]!;
  assert.deepEqual([u.koken, u.neden, u.eylemli], ["inisiyatif", "acik_is", false]);
  assert.deepEqual(butce.map((x) => x.eylemli), [false]);
});

test("özerk turda REDDEDİLEN sor uyanışı eylemli saymaz: bütçe boş uyanış görür (devre kesici çalışabilsin)", async () => {
  const b = new SorBeyni();
  const { k, uyanislar, butce } = kur(b);
  k.algi(olay());
  await bekle(60);
  assert.ok(uyanislar()[0]?.cagrilar.includes("dunya_sor"), "model sor çağırmalıydı");
  assert.deepEqual([uyanislar()[0]?.eylemli, butce[0]?.eylemli], [false, false]);
});

test("Ozyn turunda yalnız sor (bakış) da Ozyn'e görünür eylem değildir", async () => {
  const b = new SorBeyni();
  const { k, uyanislar } = kur(b);
  k.algi({ tur: "duydum", metin: "ne görüyorsun", kesin: true });
  await bekle(60);
  assert.equal(uyanislar()[0]?.eylemli, false);
});

test("söz üreten kendiliğinden uyanış eylemli=true sayılır", async () => {
  const b = new SorBeyni({ metin: "", cagrilar: [{ ad: "dunya_soyle", girdi: { metin: "Az önceki komutu onaylamadın." } }] });
  const { k, uyanislar, butce } = kur(b);
  k.konusmaDinle(() => {});
  k.algi(olay("acik_is"));
  await bekle(60);
  assert.deepEqual([uyanislar()[0]?.eylemli, butce[0]?.eylemli], [true, true]);
});

test("Ozyn kökenli uyanış bütçeyi BESLEMEZ (bütçe yalnız kendiliğinden uyanışlar içindir)", async () => {
  const b = new SorBeyni({ metin: "", cagrilar: [] });
  const { k, butce } = kur(b);
  k.algi({ tur: "duydum", metin: "merhaba nasılsın", kesin: true });
  await bekle(60);
  assert.equal(butce.length, 0);
});

/** Ozyn'e bir komut önerisi yaptırır; önerinin niyet kimliğini döndürür. */
async function komutOner() {
  const b = new SorBeyni({ metin: "", cagrilar: [{ ad: "dunya_komut", girdi: { metin: "git status", gerekce: "Ozyn depo durumunu sordu" } }] });
  const kurulum = kur(b);
  kurulum.k.algi({ tur: "duydum", metin: "git durumuna bak", kesin: true });
  await bekle(60);
  const komut = kurulum.gonderilen.find((g) => g.tur === "komut");
  assert.ok(komut, "komut önerisi gönderilmedi: " + JSON.stringify(kurulum.gonderilen));
  return { k: kurulum.k, id: komut.id };
}

test("açık iş: onay kapısında düşen öneri (kod=onay_dustu) acikIs olur ve BİR kez hatırlandı işaretlenir", async () => {
  const { k, id } = await komutOner();
  assert.equal(k.acikIs(), null);
  k.algi({ tur: "sonuc", sonuc: { niyet_id: id, durum: "hata", kod: "onay_dustu", not: "oneri zaman asimina ugradi; Ozyn karar vermedi" } });
  const is = k.acikIs();
  assert.ok(is && /git status/.test(is.ozet), "düşen öneri açık iş olmadı");
  k.acikIsAnildi(is.anahtar);
  assert.equal(k.acikIs(), null, "aynı iş ikinci kez açık iş");
});

test("açık iş YAPISAL alandan tanınır: not metni ne derse desin kod=onay_dustu yeter", async () => {
  const { k, id } = await komutOner();
  k.algi({ tur: "sonuc", sonuc: { niyet_id: id, durum: "hata", kod: "onay_dustu", not: "proposal expired" } });
  assert.notEqual(k.acikIs(), null);
});

test("açık iş: notunda 'zaman asimi' geçse bile kodsuz hata açık iş DEĞİLDİR", async () => {
  const { k, id } = await komutOner();
  k.algi({ tur: "sonuc", sonuc: { niyet_id: id, durum: "hata", not: "oneri zaman asimina ugradi; Ozyn karar vermedi" } });
  assert.equal(k.acikIs(), null);
});

test("açık iş: Ozyn'in reddettiği komut açık iş DEĞİLDİR", async () => {
  const { k, id } = await komutOner();
  k.algi({ tur: "sonuc", sonuc: { niyet_id: id, durum: "hata", not: "Ozyn komutu reddetti." } });
  assert.equal(k.acikIs(), null);
});
