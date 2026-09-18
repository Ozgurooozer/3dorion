"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi, AracCagrisi } from "./beyin.ts";
import type { Niyet } from "../protocol/niyet.ts";
import type { Algi } from "../protocol/algi.ts";

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

// KURAL DEĞİŞTİ (2026-09-12, ölçümle) — eski hali: "düz metin ASLA duyulmaz".
//
// O kural canlı davranış ölçümünde kırıldı: Orion gerçek bir kabuk hatasını
// doğru teşhis etti ("Terminal'da yanlış bir komut girildi") ama dunya_soyle
// çağırmadı; kullanıcı mutlak sessizlik duydu ve Orion bozuk göründü.
//
// Dışarıdan bakınca "iç düşünce" ile "cevap vermek isteyip aracı unutmak"
// AYIRT EDİLEMEZ; ikisi de araçsız düz metindir. İki hatadan hangisinin daha
// kötü olduğu soruldu: ara sıra bir düşünceyi sesli söylemek zararsız, doğrudan
// sorulduğunda susmak ürünü bozuk gösteriyor. Kural buna göre daraltıldı:
// araç ÇAĞRILDIYSA metin hâlâ duyulmaz (eyleme eşlik eden iç ses), yalnızca
// HİÇ araç yoksa kurtarılır.
//
// Değerlendirilip seçilmeyen almaşık: modele "aracı çağır" diye geri besleyip
// bir tur daha döndürmek. Reddedildi — her seferinde 2-3 sn ek gecikme getirir
// ve 7B modelin ikinci turda da çağıracağı garanti değil; garanti olmayan bir
// düzeltme için kullanıcıyı bekletmek kötü takas.
test("araç yokken düz metin KURTARILIR — kullanıcı sessizlik duymamalı", async () => {
  const b = new SahteBeyin({ metin: "içimden geçirdim", cagrilar: [] });
  const { k } = kur(b);
  const duyulan: string[] = [];
  k.konusmaDinle((m) => duyulan.push(m));
  k.algi({ tur: "duydum", metin: "selam", kesin: true });
  await bekle(60);
  assert.deepEqual(duyulan, ["içimden geçirdim"]);
  assert.equal(k.sayac().kurtarilanMetin, 1);
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

// ── Düz metin kurtarma (ölçümden doğdu) ────────────────────────────────────
test("araç çağrılmadıysa düz metin konuşmaya çevrilir — kullanıcı sessizlik duymaz", async () => {
  const beyin = new SahteBeyin({ metin: "Terminalde komut bulunamadı hatası var.", cagrilar: [] });
  const soylenen: string[] = [];
  const k = new Kopru({ beyin, niyetGonder: () => {}, dunyaDurumu: () => "oda", toplamaMs: 5 });
  k.konusmaDinle((m) => soylenen.push(m));
  k.algi({ tur: "duydum", metin: "ne oldu?", kesin: true });
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(soylenen, ["Terminalde komut bulunamadı hatası var."]);
  assert.equal(k.sayac().kurtarilanMetin, 1);
});

test("araç ÇAĞRILDIYSA düz metin seslendirilmez — iç düşünce gürültü olmasın", async () => {
  const beyin = new SahteBeyin({
    metin: "Şimdi ona bakayım.",
    cagrilar: [{ ad: "dunya_bak", girdi: { hedef_tip: "oyuncu" } }],
  });
  const soylenen: string[] = [];
  const k = new Kopru({ beyin, niyetGonder: () => {}, dunyaDurumu: () => "oda", toplamaMs: 5 });
  k.konusmaDinle((m) => soylenen.push(m));
  k.algi({ tur: "duydum", metin: "selam", kesin: true });
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(soylenen, [], "eyleme eşlik eden metin konuşulmamalı");
  assert.equal(k.sayac().kurtarilanMetin, 0);
});

// ── Uzun vadeli hafıza ─────────────────────────────────────────────────────
test("hafıza: 12 turluk pencere dışında kalan bilgi yine de hatırlanır", async () => {
  // ESKİ DAVRANIS: gecmisSiniri=12 asildiginda ilk tur sessizce dusuyordu.
  const b = new SahteBeyin();
  const { k } = kur(b, { toplamaMs: 5, gecmisSiniri: 4, hafizaGetirme: 3 });

  k.algi({ tur: "duydum", metin: "sifrem kirmizi balik", kesin: true });
  await bekle(30);
  // Pencereyi tasir: 10 alakasiz tur.
  for (let i = 0; i < 10; i++) {
    k.algi({ tur: "duydum", metin: `alakasiz konu ${i}`, kesin: true });
    await bekle(12);
  }
  k.algi({ tur: "duydum", metin: "sifrem neydi", kesin: true });
  await bekle(40);

  const son = b.gordugu[b.gordugu.length - 1];
  const anilar = (son?.anilar ?? []).join(" ");
  assert.match(anilar, /kirmizi balik/, "eski ama ilgili bilgi anilarla gelmeli");
});

test("hafıza kapalıyken (0) anı gönderilmez", async () => {
  const b = new SahteBeyin();
  const { k } = kur(b, { toplamaMs: 5, hafizaGetirme: 0 });
  k.algi({ tur: "duydum", metin: "bir sey", kesin: true });
  await bekle(30);
  assert.deepEqual(b.gordugu[b.gordugu.length - 1]?.anilar ?? [], []);
});

test("hafıza sayacı görünür — kaç anı tutuluyor", async () => {
  const b = new SahteBeyin();
  const { k } = kur(b, { toplamaMs: 5 });
  k.algi({ tur: "duydum", metin: "birinci", kesin: true });
  await bekle(20);
  k.algi({ tur: "duydum", metin: "ikinci", kesin: true });
  await bekle(20);
  assert.equal(k.sayac().hafiza, 2);
});

test("konusmaDinle ÇOKLU — ikinci dinleyici birinciyi silmez", async () => {
  // Gerçek hatadan doğdu: ölçüm dinleyicisi kuruldu, sonra üretim dinleyicisi
  // bağlanınca ilki SESSİZCE silindi ve ölçüm "cevap boş" sandı.
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_soyle", { metin: "merhaba" })] });
  const { k } = kur(b, { toplamaMs: 5 });
  const a: string[] = [], c: string[] = [];
  k.konusmaDinle((m) => a.push(m));
  k.konusmaDinle((m) => c.push(m));
  k.algi({ tur: "duydum", metin: "selam", kesin: true });
  await bekle(40);
  assert.deepEqual(a, ["merhaba"]);
  assert.deepEqual(c, ["merhaba"], "ikinci dinleyici birinciyi ezmemeli");
});

test("konusmaDinle abonelikten çıkarır", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_soyle", { metin: "x" })] });
  const { k } = kur(b, { toplamaMs: 5 });
  const a: string[] = [];
  const birak = k.konusmaDinle((m) => a.push(m));
  birak();
  k.algi({ tur: "duydum", metin: "selam", kesin: true });
  await bekle(40);
  assert.deepEqual(a, []);
});

test("bir dinleyicinin hatası diğerlerini kesmez", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_soyle", { metin: "y" })] });
  const { k } = kur(b, { toplamaMs: 5 });
  const saglam: string[] = [];
  k.konusmaDinle(() => { throw new Error("bozuk dinleyici"); });
  k.konusmaDinle((m) => saglam.push(m));
  k.algi({ tur: "duydum", metin: "selam", kesin: true });
  await bekle(40);
  assert.deepEqual(saglam, ["y"]);
});

test("hafızaya BİÇİM değil İÇERİK yazılır — kalıp ilgiyi zehirlemesin", async () => {
  // Canlı ölçümde tüm anılar 'Ozyn dedi: "..."' olarak saklandığı için
  // ortak önek yüzünden sorgu ne olursa olsun hep aynı üç anı dönüyordu.
  const b = new SahteBeyin();
  const { k } = kur(b, { toplamaMs: 5, hafizaGetirme: 2 });
  k.algi({ tur: "duydum", metin: "terminal suzgeci uzerinde calisiyorum", kesin: true });
  await bekle(30);
  k.algi({ tur: "duydum", metin: "kahve ictim", kesin: true });
  await bekle(30);
  k.algi({ tur: "duydum", metin: "suzgec nasil gidiyor", kesin: true });
  await bekle(40);

  const anilar = (b.gordugu.at(-1)?.anilar ?? []);
  assert.ok(!anilar.some((a) => a.includes("Ozyn dedi")), "anıda kalıp olmamalı: " + anilar.join(" | "));
  assert.match(anilar.join(" "), /suzgeci/, "ilgili anı gelmeli");
});

test("GERİLEME: gürültü bloğu, ardından gelen GERÇEK hatanın yuvasını yemez", async () => {
  // Canlı tez denemesinde bulundu: terminalin acilis afisi once dikkat'in
  // terminal kisma yuvasini harciyor, sonra icerik suzgeci onu atiyordu;
  // 2.5 sn icinde gelen gercek hata dikkat tarafindan kisilip dusuyordu.
  // Sira duzeltildi: suzgec ONCE calisir, yuva bosa gitmez.
  const b = new SahteBeyin();
  const { k } = kur(b, {
    toplamaMs: 5,
    // Gercek uygulamadaki suzgec gibi: rutin cikti elenir, hata gecer.
    suzgec: (a: Algi) => a.tur !== "terminal" || (a.kod !== undefined && a.kod !== 0),
  });

  k.algi({ tur: "terminal", kuyruk: "acilis afisi", kesildi: false, kod: 0 });
  await bekle(15);
  k.algi({ tur: "terminal", kuyruk: "komut bulunamadi", kesildi: false, kod: 1 });
  await bekle(60);

  const gorulen = b.gordugu.flatMap((g) => g.ozetler).join(" ");
  assert.match(gorulen, /komut bulunamadi/, "gercek hata beyne ULASMALI");
  assert.equal(k.sayac().suzulen, 1, "gurultu suzgecte elenmis olmali");
});

// ── SORUNUN CEVABI BEYNE ULAŞIR ───────────────────────────────────────────
// Canlıda bulunan hata: Orion `sor` gönderiyor, algı hizmeti doğru cevabı
// üretiyor, ama cevap `sonuc` olarak döndüğü için "rutin başarı" sayılıp
// süzülüyordu. Orion soruyor ve cevabı hiç duymuyordu.
//
// Bu testler canlı koşuya değil, DETERMİNİSTİK yola bakar: modelin o turda
// `BAK:` üretip üretmemesi kaprisli, ama cevabın beyne ulaşması olmak zorunda.

test("`gordum` beynin ÖNÜNE düşer — cevap süzülmez", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [] });
  const { k } = kur(b);
  k.algi({ tur: "gordum", ne: "onumde", metin: "yönetim terminali (birkaç adım ötede)" });
  await bekle(60);
  assert.equal(b.gordugu.length, 1, "beyin hic uyanmadi");
  const ozetler = b.gordugu[0]!.ozetler.join(" | ");
  assert.match(ozetler, /yönetim terminali/, `cevap beyne ulasmadi: "${ozetler}"`);
});

test("cevabın İÇERİĞİ taşınır — sabit kalıp değil", async () => {
  // Hafızaya/bağlama "Baktın (onumde)" gibi sabit bir kalıp yazmak ilgi
  // skorunu zehirler: her cevap aynı öneki paylaşırsa benzerlik içerikten
  // değil biçimden gelir. Aynı hata daha önce `Ozyn dedi:` önekiyle yaşandı.
  const b = new SahteBeyin({ metin: "", cagrilar: [] });
  const { k } = kur(b);
  k.algi({ tur: "gordum", ne: "yakin", metin: "beyaz tahta, monitör" });
  await bekle(60);
  const ozetler = b.gordugu[0]!.ozetler.join(" | ");
  assert.match(ozetler, /beyaz tahta, monitör/, "icerik kaybolmus");
});

test("AYNI turda iki farklı soru birbirini düşürmez", async () => {
  // `onumde` ve `yakin` ayrı sorulardır; ikisi de aynı "gordum" türünden
  // geldiği için tekrar sanılıp biri atılırsa Orion yarım bilgiyle konuşur.
  const b = new SahteBeyin({ metin: "", cagrilar: [] });
  const { k } = kur(b);
  k.algi({ tur: "gordum", ne: "onumde", metin: "monitör" });
  k.algi({ tur: "gordum", ne: "yakin", metin: "masa, sandalye" });
  await bekle(60);
  const ozetler = b.gordugu.at(-1)!.ozetler.join(" | ");
  assert.match(ozetler, /monitör/, "ilk soru dustu");
  assert.match(ozetler, /masa, sandalye/, "ikinci soru dustu");
});

test("BAŞARILI niyet sonucu hâlâ süzülür — kural yalnızca `gordum` için gevşedi", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [] });
  const { k } = kur(b, {
    suzgec: (a: Algi, ozet: string) => a.tur === "gordum" || /hata/.test(ozet),
  });
  k.algi({ tur: "sonuc", sonuc: { niyet_id: "n1", durum: "bitti" } });
  await bekle(60);
  assert.equal(b.gordugu.length, 0, "rutin basari beyni uyandirmamali");
});

// ── HAFIZA OTURUMLAR ARASI ────────────────────────────────────────────────

test("depo verilirse anılar YÜKLENİR ve beynin önüne çıkar", async () => {
  const kayit = [{ metin: "Ozyn dün git kullanıyordu", tur: "olay", onem: 6,
                   olusma: Date.now() - 86400000, sonErisim: Date.now() - 86400000 }];
  const b = new SahteBeyin({ metin: "", cagrilar: [] });
  const { k } = kur(b, {
    hafizaGetirme: 3,
    hafizaDeposu: { oku: () => kayit, yaz: () => {} },
  });
  k.algi({ tur: "duydum", metin: "git hakkinda ne biliyorsun", kesin: true });
  await bekle(60);
  const anilar = (b.gordugu[0]?.anilar ?? []).join(" | ");
  assert.match(anilar, /dün git/, `onceki oturumun anisi gelmedi: "${anilar}"`);
});

test("BOZUK depo dünyayı çökertmez — hafızasız ama ÇALIŞIR", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [] });
  const { k } = kur(b, {
    hafizaDeposu: { oku: () => { throw new Error("kayit bozuk"); }, yaz: () => {} },
  });
  k.algi({ tur: "duydum", metin: "selam", kesin: true });
  await bekle(60);
  assert.equal(b.gordugu.length, 1, "bozuk depo beyni engellememeli");
});

test("durdur() bekleyen hafıza yazmasını TAMAMLAR — son anılar kaybolmaz", async () => {
  const yazilan: unknown[][] = [];
  const b = new SahteBeyin({ metin: "", cagrilar: [] });
  const { k } = kur(b, {
    hafizaDeposu: { oku: () => [], yaz: (a: unknown[]) => { yazilan.push(a); } },
  });
  k.algi({ tur: "duydum", metin: "bunu hatirla", kesin: true });
  await bekle(60);
  assert.equal(yazilan.length, 0, "kisma penceresi icinde henuz yazilmamis olmali");

  k.durdur();                       // kapanış: bekleyen yazma tamamlanmalı
  assert.equal(yazilan.length, 1, "kapanista yazilmadi");
  assert.ok((yazilan[0] as { metin: string }[]).some((x) => /hatirla/.test(x.metin)));
});

test("yazma KISILIR — her anıda serileştirme yapılmaz", async () => {
  const yazilan: unknown[][] = [];
  const b = new SahteBeyin({ metin: "", cagrilar: [] });
  const { k } = kur(b, {
    hafizaDeposu: { oku: () => [], yaz: (a: unknown[]) => { yazilan.push(a); } },
  });
  for (let i = 0; i < 5; i++) {
    k.algi({ tur: "duydum", metin: `mesaj ${i}`, kesin: true });
    await bekle(5);
  }
  assert.equal(yazilan.length, 0, "kisma penceresi icinde yazma olmamali");
  k.durdur();
  assert.equal(yazilan.length, 1, "bes ani icin TEK yazma yeterli");
});

// ── DURUM ≠ ANI (spec 06 K2) ──────────────────────────────────────────────

test("GÖRDÜM kalıcı hafızaya YAZILMAZ — o ana ait bir gözlem", async () => {
  // Yazıldığı için dünkü gözlem bugün "hatırlanan bilgi" diye geri geliyor ve
  // Orion onu anlatıyordu. [ÖLÇÜLDÜ] sadakat %50 → %100.
  const b = new SahteBeyin();
  const { k } = kur(b);
  k.algi({ tur: "gordum", ne: "onumde", metin: "yönetim terminali (birkaç adım ötede)" });
  await bekle(60);
  assert.equal(k.hafiza.sayi, 0, "anlık gözlem kalıcı hafızaya sızdı");
});

test("GÖRDÜM 'ŞİMDİ' satırı olarak dünya metnine girer, yaşıyla", async () => {
  const b = new SahteBeyin();
  const { k } = kur(b);
  k.algi({ tur: "gordum", ne: "onumde", metin: "yönetim terminali" });
  await bekle(60);
  const d = b.gordugu.at(-1)!.dunya;
  // Çerçeve İngilizce, nesne adı Türkçe (spec 06 §6.8).
  assert.match(d, /in front of you: yönetim terminali \(you looked \d+ sec ago\)/);
  assert.match(d, /Oda: masa, tahta/, "dünya durumu kaybolmamalı");
});

test("KONUŞMA hâlâ hafızaya yazılır — kural yalnızca DURUMA uygulanır", async () => {
  const b = new SahteBeyin();
  const { k } = kur(b);
  k.algi({ tur: "duydum", metin: "yarın toplantı var", kesin: true });
  await bekle(60);
  assert.equal(k.hafiza.sayi, 1, "olay hafızaya yazılmadı — fazla kısıtlandı");
});

test("YENİ gözlem ESKİSİNİ siler — iki yer birden 'önümde' olamaz", async () => {
  const b = new SahteBeyin();
  const { k } = kur(b);
  k.algi({ tur: "gordum", ne: "onumde", metin: "beyaz tahta" });
  await bekle(40);
  k.algi({ tur: "gordum", ne: "onumde", metin: "yönetim terminali" });
  // İkinci bakış kendi başına beyni UYANDIRMAZ (zincir bütçesi, 2026-09-19);
  // ama çalışma belleğinin üstüne yazar. Niyet aynı kalıyor: yeni gözlem
  // eskisini siler. Gözlem yolu değişti — gerçek bir tetik sonrası turda bak.
  k.algi({ tur: "duydum", metin: "şimdi ne görüyorsun", kesin: true });
  await bekle(60);
  const d = b.gordugu.at(-1)!.dunya;
  assert.match(d, /yönetim terminali/);
  assert.doesNotMatch(d, /beyaz tahta/, "eski gözlem ŞİMDİ'de kaldı");
});

test("ANILAR zaman etiketiyle sunulur (spec 06 K3)", async () => {
  // Zamansız anı, model için şimdiki bilgiden ayırt edilemez.
  const b = new SahteBeyin();
  const { k } = kur(b, { hafizaGetirme: 3 });
  k.algi({ tur: "duydum", metin: "kırmızı kalem nerede", kesin: true });
  await bekle(60);
  k.algi({ tur: "duydum", metin: "kırmızı kalem lazım", kesin: true });
  await bekle(60);
  const anilar = b.gordugu.at(-1)!.anilar ?? [];
  assert.ok(anilar.length > 0, "anı getirilmedi");
  for (const a of anilar) assert.match(a, /^\[(just now|\d+ (minutes|hours|days) ago)\] /, `zamansız anı: ${a}`);
});

// ── ZİNCİR BÜTÇESİ: bakışın cevabı beyni sonsuza kadar uyandırmaz ──────────
//
// NAİF ÇÖZÜMDEN ÖNCE yazıldı. Canlıda bulundu (2026-09-19, inisiyatif denemesi):
// `gordum` her zaman beyne terfi ediyor ("beyin cevabı kendisi istedi") ve
// Haiku her turda hem BAKIP hem KONUŞUYORDU. Sonuç: tek tetik → 5 tur,
// Orion 4 kez "Bakıyorum" dedi. Maliyet tavanı testi UYANMALARI sayıyordu,
// TURLARI değil — o yüzden kaçırdı.

/** Her turda bakan ve konuşan beyin — canlıda Haiku'nun yaptığı. */
function bakipKonusanBeyin(n = 20): SahteBeyin {
  return new SahteBeyin(...Array.from({ length: n }, () => ({
    metin: "",
    cagrilar: [cagri("dunya_sor", { ne: "dunya" }), cagri("dunya_soyle", { metin: "Bakıyorum." })],
  })));
}

/** Dünyayı oynar: beynin her `sor` niyetine bir `gordum` ile cevap verir. */
async function dunyayiOyna(k: Kopru, niyetler: { n: Niyet; id: string }[], tur = 25): Promise<void> {
  let islenen = 0;
  for (let i = 0; i < tur; i++) {
    await bekle(40);
    for (; islenen < niyetler.length; islenen++) {
      const n = niyetler[islenen]!.n;
      // Her cevap farklı metin: dikkat'in tekrar süzgeci zinciri YANLIŞ
      // SEBEPTEN kesmesin — ölçülen şey bütçe olmalı.
      if (n.tur === "sor") k.algi({ tur: "gordum", ne: n.ne, metin: `nesne ${islenen}` });
    }
  }
}

test("ZİNCİR: tek tetik en fazla 1 takip turu doğurur — bakış döngüsü yok", async () => {
  const b = bakipKonusanBeyin();
  const { k, niyetler } = kur(b);
  k.algi({ tur: "olay", ad: "kendiliginden" });
  await dunyayiOyna(k, niyetler);
  assert.equal(b.gordugu.length, 2, `tek tetik ${b.gordugu.length} tur dogurdu (beklenen: tetik + 1 takip)`);
});

test("ZİNCİR: bütçesi biten cevap KAYBOLMAZ — çalışma belleğine yazılır", async () => {
  const b = bakipKonusanBeyin();
  const { k, niyetler } = kur(b);
  k.algi({ tur: "olay", ad: "kendiliginden" });
  await dunyayiOyna(k, niyetler);
  // Zincir kesildi; yeni bir dış tetik gelince beyin SON bakışı bilmeli.
  k.algi({ tur: "duydum", metin: "ne gördün", kesin: true });
  await dunyayiOyna(k, niyetler, 6);
  const sonGirdi = b.gordugu.find((g) => g.ozetler.some((o) => o.includes("ne gördün")));
  assert.ok(sonGirdi, "yeni tetik beyni uyandirmadi");
  assert.match(sonGirdi.dunya, /in the room: nesne \d+/, "kesilen bakisin cevabi calisma belleginden dustu");
});

test("ZİNCİR: soru-cevap BOZULMAZ — soru turu, bakış, cevap turu", async () => {
  const b = new SahteBeyin(
    { metin: "", cagrilar: [cagri("dunya_sor", { ne: "onumde" })] },
    { metin: "", cagrilar: [cagri("dunya_soyle", { metin: "Önümde yönetim terminali var." })] },
  );
  const { k, niyetler } = kur(b);
  k.algi({ tur: "duydum", metin: "önünde ne var", kesin: true });
  await dunyayiOyna(k, niyetler);
  assert.equal(b.gordugu.length, 2, "cevap turu hic gelmedi — soru-cevap kirildi");
  assert.ok(b.gordugu[1]!.ozetler.some((o) => o.startsWith("You looked")), "cevap turu bakisin sonucunu gormedi");
});

test("ZİNCİR: yeni bir dış tetik bütçeyi YENİLER", async () => {
  const b = bakipKonusanBeyin();
  const { k, niyetler } = kur(b);
  k.algi({ tur: "olay", ad: "birinci" });
  await dunyayiOyna(k, niyetler);
  const ilk = b.gordugu.length;
  k.algi({ tur: "olay", ad: "ikinci" });
  await dunyayiOyna(k, niyetler);
  assert.equal(b.gordugu.length - ilk, 2, "ikinci tetik takip turu alamadi — butce yenilenmedi");
});

// ── İNİSİYATİF ZİNCİRİNDE SUSMA İLANI ──────────────────────────────────────
//
// NAİF ÇÖZÜMDEN ÖNCE yazıldı. Ölçüldü (2026-09-19, Haiku, n=10): kendiliğinden
// düşünme turunda model 3/10 "Sessiz kalıyorum…" diye SESLİ söylüyor.
// "susacağını söyleme" diye açıkça yazmak bunu DEĞİŞTİRMEDİ (yine 3/10).
// Model susmayı seçmiş; ilanı düşmeli. Ama YALNIZCA inisiyatif zincirinde —
// Ozyn "neden konuşmuyorsun" derse aynı cümle bir CEVAPTIR.

const inisiyatifOlayi = (): Algi => ({ tur: "olay", ad: "sessizlik", ayrinti: { kaynak: "inisiyatif" } });

test("SUSMA İLANI: inisiyatif turunda 'Sessiz kalıyorum…' söylenmez ve dünyaya gitmez", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_soyle", { metin: "Sessiz kalıyorum. Ozyn çalışıyor." })] });
  const { k, niyetler } = kur(b);
  const duyulan: string[] = [];
  k.konusmaDinle((m) => duyulan.push(m));
  k.algi(inisiyatifOlayi());
  await bekle(80);
  assert.equal(b.gordugu.length, 1, "inisiyatif beyni uyandirmadi");
  assert.deepEqual(duyulan, [], "susma ilani SESLI soylendi");
  assert.ok(!niyetler.some((x) => x.n.tur === "soyle"), "susma ilani dunyaya soyle niyeti olarak gitti");
  assert.equal(k.sayac().yutulanSusma, 1);
});

test("SUSMA İLANI: bakış sonrası TAKİP turu da inisiyatif zincirine aittir", async () => {
  const b = new SahteBeyin(
    { metin: "", cagrilar: [cagri("dunya_sor", { ne: "dunya" })] },
    { metin: "", cagrilar: [cagri("dunya_soyle", { metin: "Sessiz kalıyorum, yapacak bir şey yok." })] },
  );
  const { k, niyetler } = kur(b);
  const duyulan: string[] = [];
  k.konusmaDinle((m) => duyulan.push(m));
  k.algi(inisiyatifOlayi());
  await dunyayiOyna(k, niyetler, 8);
  assert.equal(b.gordugu.length, 2);
  assert.deepEqual(duyulan, [], "takip turunda susma ilani soylendi");
});

test("SUSMA İLANI yanlış pozitif YOK: Ozyn sorunca aynı cümle bir CEVAPTIR", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_soyle", { metin: "Sessiz kalıyorum çünkü seni bölmek istemedim." })] });
  const { k } = kur(b);
  const duyulan: string[] = [];
  k.konusmaDinle((m) => duyulan.push(m));
  k.algi({ tur: "duydum", metin: "neden konuşmuyorsun", kesin: true });
  await bekle(80);
  assert.deepEqual(duyulan, ["Sessiz kalıyorum çünkü seni bölmek istemedim."], "soru-cevapta cevap yutuldu");
});

test("İNİSİYATİF turunda GERÇEK içerik söylenir — yalnızca ilan düşer", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_soyle", { metin: "Tahtada dünkü not hâlâ duruyor." })] });
  const { k } = kur(b);
  const duyulan: string[] = [];
  k.konusmaDinle((m) => duyulan.push(m));
  k.algi(inisiyatifOlayi());
  await bekle(80);
  assert.deepEqual(duyulan, ["Tahtada dünkü not hâlâ duruyor."]);
});

test("SUSMA İLANI: Ozyn araya girerse köken DIŞ olur — cevap düşmez", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_soyle", { metin: "Sessiz kalıyorum, dinliyorum." })] });
  b.gecikmeMs = 0;
  const { k } = kur(b);
  const duyulan: string[] = [];
  k.konusmaDinle((m) => duyulan.push(m));
  k.algi(inisiyatifOlayi());
  k.algi({ tur: "duydum", metin: "orada mısın", kesin: true });   // aynı toplama penceresinde
  await bekle(80);
  assert.deepEqual(duyulan, ["Sessiz kalıyorum, dinliyorum."], "Ozyn konusmusken cevap inisiyatif sanildi");
});
