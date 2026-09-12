"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi, AracCagrisi } from "./beyin.ts";
import type { Niyet } from "../protocol/niyet.ts";

/** Sahte beyin: ne döndüreceğini test belirler, ne gördüğünü test okur. */
class SahteBeyin implements Beyin {
  readonly ad = "sahte";
  gordugu: BeyinGirdisi[] = [];
  cevaplar: BeyinCikti[] = [];
  gecikmeMs = 0;
  patlasin = false;

  constructor(...cevaplar: BeyinCikti[]) { this.cevaplar = cevaplar; }
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> {
    this.gordugu.push(structuredClone(g));
    if (this.gecikmeMs) await new Promise((r) => setTimeout(r, this.gecikmeMs));
    if (this.patlasin) throw new Error("beyin çöktü");
    return this.cevaplar.shift() ?? { metin: "", cagrilar: [] };
  }
}

const cagri = (ad: string, girdi: unknown): AracCagrisi => ({ ad, girdi });
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

function kur(beyin: Beyin, ek: Record<string, unknown> = {}) {
  const niyetler: { n: Niyet; id: string }[] = [];
  const k = new Kopru({
    beyin,
    niyetGonder: (n, id) => niyetler.push({ n, id }),
    dunyaDurumu: () => "Oda: masa, tahta. Ozyn 2m uzakta.",
    toplamaMs: 20,
    ...ek,
  });
  return { k, niyetler };
}

test("konuşma beyni uyandırır ve araç çağrısı niyete dönüşür", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_git", { hedef: { tip: "capa", ad: "tahta" } })] });
  const { k, niyetler } = kur(b);
  k.algi({ tur: "duydum", metin: "tahtaya gider misin", kesin: true });
  await bekle(60);
  assert.equal(niyetler.length, 1);
  assert.equal(niyetler[0]!.n.tur, "git");
  assert.equal(b.gordugu.length, 1);
});

test("tik beyni ASLA uyandırmaz", async () => {
  const b = new SahteBeyin();
  const { k } = kur(b);
  for (let i = 0; i < 50; i++) {
    k.algi({ tur: "tik", t: i, dt: 0.05, orion: {} as never, oyuncu: {} as never });
  }
  await bekle(80);
  assert.equal(b.gordugu.length, 0, "tik beyni uyandırdı — maliyet tavanı kırıldı");
});

test("geçersiz araç çağrısı niyet üretmez ve modele geri beslenir", async () => {
  const b = new SahteBeyin(
    { metin: "", cagrilar: [cagri("dunya_poz", { poz: "zıplıyor" })] },
    { metin: "", cagrilar: [] },
  );
  const { k, niyetler } = kur(b);
  k.algi({ tur: "duydum", metin: "zıpla", kesin: true });
  await bekle(120);
  assert.equal(niyetler.length, 0);
  assert.equal(k.sayac().reddedilenCagri, 1);
  // İkinci turda reddin gerekçesi modele gitmiş olmalı
  const ikinci = b.gordugu[1];
  assert.ok(ikinci, "ikinci düşünme turu olmadı");
  assert.ok(ikinci!.ozetler.some((o) => o.includes("reddedildi")), ikinci!.ozetler.join(" | "));
});

test("uydurma araç adı reddedilir", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_ucmak", {})] });
  const { k, niyetler } = kur(b);
  k.algi({ tur: "duydum", metin: "uç", kesin: true });
  await bekle(60);
  assert.equal(niyetler.length, 0);
  assert.equal(k.sayac().reddedilenCagri, 1);
});

test("soyle niyeti konuşma dinleyicisine ulaşır", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_soyle", { metin: "merhaba Ozyn" })] });
  const { k, niyetler } = kur(b);
  const duyulan: string[] = [];
  k.konusmaDinle((m) => duyulan.push(m));
  k.algi({ tur: "duydum", metin: "selam", kesin: true });
  await bekle(60);
  assert.deepEqual(duyulan, ["merhaba Ozyn"]);
  assert.equal(niyetler.length, 1);
});

test("düz metin duyulmaz — konuşmak bir eylemdir", async () => {
  const b = new SahteBeyin({ metin: "içimden geçirdim", cagrilar: [] });
  const { k } = kur(b);
  const duyulan: string[] = [];
  k.konusmaDinle((m) => duyulan.push(m));
  k.algi({ tur: "duydum", metin: "selam", kesin: true });
  await bekle(60);
  assert.deepEqual(duyulan, []);
});

test("beyin çökerse dünya durmaz, hata sayılır", async () => {
  const b = new SahteBeyin();
  b.patlasin = true;
  const { k, niyetler } = kur(b);
  k.algi({ tur: "duydum", metin: "selam", kesin: true });
  await bekle(60);
  assert.equal(k.sayac().hata, 1);
  assert.equal(niyetler.length, 0);
  // Köprü hâlâ çalışır durumda olmalı
  b.patlasin = false;
  b.cevaplar.push({ metin: "", cagrilar: [cagri("dunya_kalk", {})] });
  k.algi({ tur: "duydum", metin: "kalk", kesin: true });
  await bekle(60);
  assert.equal(niyetler.length, 1);
});

test("düşünme sürerken gelen girdi kaybolmaz, sonra işlenir", async () => {
  const b = new SahteBeyin(
    { metin: "", cagrilar: [] },
    { metin: "", cagrilar: [cagri("dunya_kalk", {})] },
  );
  b.gecikmeMs = 80;
  const { k, niyetler } = kur(b);
  k.algi({ tur: "duydum", metin: "birinci", kesin: true });
  await bekle(10);
  k.algi({ tur: "duydum", metin: "ikinci", kesin: true });
  await bekle(300);
  assert.equal(b.gordugu.length, 2, "ikinci girdi yutuldu");
  assert.equal(niyetler.length, 1);
});

test("başarısız niyet sonucu beyne ulaşır — Orion yapamadığını öğrenir", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [] });
  const { k } = kur(b);
  k.sonuc({ niyet_id: "x", durum: "hata", not: "ulaşılamaz hedef" });
  await bekle(80);
  assert.equal(b.gordugu.length, 1);
  assert.ok(b.gordugu[0]!.ozetler.join(" ").includes("hata"));
});

test("başarılı sonuç beyni uyandırmaz — gürültü değil", async () => {
  const b = new SahteBeyin();
  const { k } = kur(b);
  k.sonuc({ niyet_id: "x", durum: "bitti" });
  await bekle(80);
  assert.equal(b.gordugu.length, 0);
});

test("araç yüzeyi ve dünya durumu her düşünmede modele verilir", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [] });
  const { k } = kur(b);
  k.algi({ tur: "duydum", metin: "selam", kesin: true });
  await bekle(60);
  const g = b.gordugu[0]!;
  assert.ok(g.araclar.length >= 13, `araç sayısı: ${g.araclar.length}`);
  assert.match(g.dunya, /Oda:/);
});

test("geçmiş sınırı aşılmaz — bağlam sonsuz büyümez", async () => {
  const b = new SahteBeyin();
  const { k } = kur(b, { gecmisSiniri: 4 });
  for (let i = 0; i < 10; i++) {
    b.cevaplar.push({ metin: `cevap ${i}`, cagrilar: [] });
    k.algi({ tur: "duydum", metin: `soru ${i}`, kesin: true });
    await bekle(30);
  }
  const son = b.gordugu.at(-1)!;
  assert.ok(son.gecmis.length <= 4, `geçmiş ${son.gecmis.length}`);
});

test("durdur sonrası algı işlenmez", async () => {
  const b = new SahteBeyin();
  const { k } = kur(b);
  k.durdur();
  k.algi({ tur: "duydum", metin: "selam", kesin: true });
  await bekle(60);
  assert.equal(b.gordugu.length, 0);
});

test("ısrarla geçersiz çağrı üreten model sonsuz döngüye sokmaz", async () => {
  const b = new SahteBeyin();
  // Her turda geçersiz çağrı döndür — bitmek bilmeyen bir düzeltme döngüsü adayı
  b.dusun = async (g) => {
    b.gordugu.push(structuredClone(g));
    return { metin: "", cagrilar: [cagri("dunya_poz", { poz: "zıplıyor" })] };
  };
  const sessiz = console.warn;
  console.warn = () => {};
  const { k, niyetler } = kur(b);
  k.algi({ tur: "duydum", metin: "zıpla", kesin: true });
  await bekle(400);
  console.warn = sessiz;
  assert.equal(niyetler.length, 0);
  // Kalkan 2 turda devreye girer: ilk tur + en çok 2 düzeltme turu
  assert.ok(b.gordugu.length <= 4, `döngü kesilmedi, ${b.gordugu.length} tur döndü`);
  assert.ok(b.gordugu.length >= 2, "hiç düzeltme şansı verilmedi");
});
