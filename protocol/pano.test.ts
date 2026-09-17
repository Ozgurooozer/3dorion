// protocol/pano.test.ts — panonun YALAN SÖYLEYEBİLECEĞİ yerler.
//
// Bu testler "pano çalışıyor mu"yu değil, panonun sessizce yanlış bilgi
// verebileceği durumları hedefler: kopya tutma, kaynaksız ölçüm iddiası,
// kare döngüsünü öldüren okuma hatası, erken açılmış yazma yolu.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { panoKur, tel, PanoKurulumHatasi } from "./pano.ts";
import type { Dugme, Modul } from "./pano.ts";

const dugme = (u: Partial<Dugme> & Pick<Dugme, "ad" | "oku">): Dugme => ({
  etiket: u.ad.toUpperCase(), sinif: "guvenli", etki: "aninda",
  aciklama: "deneme düğmesi", ...u,
});

const modul = (ad: string, dugmeler: Dugme[], dugum = "dikkat"): Modul =>
  ({ ad, etiket: ad.toUpperCase(), dugum, dugmeler });

test("TEL okunur, KOPYA tutulmaz — modül değişince pano da değişir", () => {
  // Panonun asıl vaadi bu. Değeri kurulum anında kopyalayan bir tasarım
  // burada çöker: `deger` 10'da donar ve panel, devre kesici atmış bir
  // modülü hâlâ sağlıklı gösterir.
  let canli = 10;
  const p = panoKur([modul("dikkat", [dugme({ ad: "azami", oku: () => canli })])]);

  assert.equal(p.goruntu()[0]!.dugmeler[0]!.deger, 10);
  canli = 3;
  assert.equal(p.goruntu()[0]!.dugmeler[0]!.deger, 3, "pano kopya tutmuş");
});

test("okuma FIRLATIRSA pano çökmez — kare döngüsü ölmemeli", () => {
  // Bir ayarın bozukluğu bütün odayı karartmamalı.
  const p = panoKur([modul("dikkat", [
    dugme({ ad: "bozuk", oku: () => { throw new Error("bağlantı yok"); } }),
    dugme({ ad: "saglam", oku: () => 7 }),
  ])]);

  let g!: ReturnType<typeof p.goruntu>;
  assert.doesNotThrow(() => { g = p.goruntu(); });
  const [bozuk, saglam] = g[0]!.dugmeler;
  assert.equal(bozuk!.deger, null);
  assert.match(bozuk!.hata, /bağlantı yok/);
  assert.equal(saglam!.deger, 7, "bozuk komşu sağlam düğmeyi düşürmemeli");
});

test("KAYNAKSIZ 'ölçülmüş' kurulumda reddedilir", () => {
  assert.throws(
    () => panoKur([modul("dikkat", [
      dugme({ ad: "esik", sinif: "olculmus", oku: () => 1000 }),
    ])]),
    PanoKurulumHatasi,
  );
  assert.throws(
    () => panoKur([modul("dikkat", [
      dugme({ ad: "esik", sinif: "olculmus", kaynak: "   ", oku: () => 1000 }),
    ])]),
    /kaynağı yok/,
    "boşluktan ibaret kaynak kaynak sayılmamalı",
  );
});

test("kaynaklı ölçüm geçer ve kaynak GÖRÜNTÜDE taşınır", () => {
  const p = panoKur([modul("dikkat", [
    dugme({ ad: "esik", sinif: "olculmus", kaynak: "tools/model-olcum.mjs", oku: () => 1000 }),
  ])]);
  assert.equal(p.goruntu()[0]!.dugmeler[0]!.kaynak, "tools/model-olcum.mjs");
});

test("AD ÇAKIŞMASI kurulumda çöker — iki düğme aynı teli göstermez", () => {
  assert.throws(() => panoKur([
    modul("a", [dugme({ ad: "azami", oku: () => 1 })]),
    modul("b", [dugme({ ad: "azami", oku: () => 2 })], "beyin"),
  ]), /iki kez tanımlı/);
});

test("SINIF KAPISI: S5'te yalnız 'guvenli' açık, diğerleri GEREKÇELİ kilitli", () => {
  // S5 yalnızca güvenli sınıfı açar; `tehlikeli` S6'nın iki aşamalı
  // teyidini, `olculmus` S7'nin kilidini bekler. Kapının tek yerde
  // toplanması önemli: dağılsaydı S6 açılırken S7 de yanlışlıkla açılırdı.
  const p = panoKur([modul("dikkat", [
    dugme({ ad: "a", sinif: "guvenli", oku: () => 1, yaz: () => {} }),
    dugme({ ad: "b", sinif: "tehlikeli", oku: () => 2, yaz: () => {} }),
    dugme({ ad: "c", sinif: "olculmus", kaynak: "olcum.ts", oku: () => 3, yaz: () => {} }),
    dugme({ ad: "d", sinif: "sabit", oku: () => true }),
    dugme({ ad: "e", sinif: "guvenli", oku: () => 5 }),      // yazıcısı yok
  ])]);
  const g = Object.fromEntries(p.goruntu()[0]!.dugmeler.map((d) => [d.ad, d]));
  assert.equal(g.a!.yazilabilir, true, "güvenli düğme açılmamış");
  assert.equal(g.b!.yazilabilir, false); assert.match(g.b!.kilitSebebi, /teyit/);
  assert.equal(g.c!.yazilabilir, false); assert.match(g.c!.kilitSebebi, /ölçüm kilidi/);
  assert.equal(g.d!.yazilabilir, false); assert.match(g.d!.kilitSebebi, /sabit/);
  assert.equal(g.e!.yazilabilir, false, "yazıcısız düğme yazılabilir görünmemeli");
});

test("SABİT düğmeye yazıcı koymak KURULUMDA çöker", () => {
  // Panelde kilitli görünüp programatik olarak değiştirilebilen bir
  // güvenlik teli, savunulamaz durumun ta kendisi.
  assert.throws(() => panoKur([modul("d", [
    dugme({ ad: "tik", sinif: "sabit", oku: () => true, yaz: () => {} }),
  ])]), /sabit ilan edildi ama yazıcısı var/);
});

test("KİLİTLİ düğmeye yazmak DEĞERİ DEĞİŞTİRMEZ", () => {
  let riskli = 20;
  const p = panoKur([modul("d", [
    dugme({ ad: "riskli", sinif: "tehlikeli", oku: () => riskli,
            yaz: (v) => { riskli = v as number; } }),
  ])]);
  const s = p.yaz("riskli", 5);
  assert.equal(s.oldu, false);
  assert.equal(riskli, 20, "kilitli düğme yine de yazılmış");
  assert.equal(s.deger, 20, "ret sonucunda ESKİ değer dönmeli");
});

test("ARALIK DIŞI reddedilir ve değer bozulmaz; SINIR değeri kabul edilir", () => {
  const t = tel(4000);
  const p = panoKur([modul("d", [
    dugme({ ad: "pencere", sinif: "guvenli", aralik: { en: 0, cok: 30000 },
            birim: "ms", oku: t, yaz: t.yaz }),
  ])]);
  for (const kotu of [-1, 30001]) {
    const s = p.yaz("pencere", kotu);
    assert.equal(s.oldu, false, `${kotu} kabul edildi`);
    assert.match(s.sebep, /aralık dışı/);
  }
  assert.equal(t(), 4000, "reddedilen yazma değeri bozmuş");
  assert.equal(p.yaz("pencere", 30000).oldu, true, "sınır değeri reddedilmemeli");
  assert.equal(t(), 30000);
});

test("TÜR UYUŞMAZLIĞI reddedilir — sayısal tel sessizce NaN olmamalı", () => {
  const t = tel(4000);
  const p = panoKur([modul("d", [
    dugme({ ad: "pencere", sinif: "guvenli", oku: t, yaz: t.yaz }),
  ])]);
  const s = p.yaz("pencere", "cok");
  assert.equal(s.oldu, false);
  assert.match(s.sebep, /tür uymuyor/);
  assert.equal(t(), 4000);
  assert.equal(p.yaz("pencere", NaN).oldu, false, "NaN kabul edildi");
  assert.equal(p.yaz("pencere", Infinity).oldu, false, "Infinity kabul edildi");
});

test("BİLİNMEYEN düğmeye yazmak çökmez, gerekçeli reddedilir", () => {
  const p = panoKur([modul("d", [dugme({ ad: "a", oku: () => 1 })])]);
  let s!: ReturnType<typeof p.yaz>;
  assert.doesNotThrow(() => { s = p.yaz("yok_boyle", 5); });
  assert.equal(s.oldu, false);
  assert.match(s.sebep, /böyle bir düğme yok/);
});

test("yazıcı FIRLATIRSA pano çökmez", () => {
  const p = panoKur([modul("d", [
    dugme({ ad: "a", sinif: "guvenli", oku: () => 1,
            yaz: () => { throw new Error("tel kopuk"); } }),
  ])]);
  let s!: ReturnType<typeof p.yaz>;
  assert.doesNotThrow(() => { s = p.yaz("a", 2); });
  assert.equal(s.oldu, false);
  assert.match(s.sebep, /tel kopuk/);
});

test("KOPYA güncelleyen tanım YAKALANIR — 'yazıldı ama oturmadı'", () => {
  // Panonun en sinsi hatası: yazma başarılı görünür, modül eski değerle
  // çalışmaya devam eder. Doğrulama okuması bunu yakalar.
  let kopya = 10;
  const gercek = 10;
  const p = panoKur([modul("d", [
    dugme({ ad: "sahte", sinif: "guvenli", oku: () => gercek,
            yaz: (v) => { kopya = v as number; } }),
  ])]);
  const s = p.yaz("sahte", 3);
  assert.equal(s.oldu, false, "kopya güncelleyen yazma başarılı sayılmış");
  assert.match(s.sebep, /oturmadı/);
  assert.equal(kopya, 3, "yazıcı gerçekten çağrılmış olmalı");
  assert.equal(s.deger, 10);
});

test("TEL: pano yazınca KARAR YOLU da yeni değeri okur", () => {
  // S5'in bütün sebebi bu. Kopya kullanan bir tasarım burada çöker:
  // `kararYolu()` eski sayıyı okumaya devam ederdi.
  const t = tel(4000);
  const kararYolu = () => t();                 // modülün içindeki okuma
  const p = panoKur([modul("d", [
    dugme({ ad: "pencere", sinif: "guvenli", aralik: { en: 0, cok: 30000 },
            oku: t, yaz: t.yaz }),
  ])]);
  assert.equal(kararYolu(), 4000);
  assert.equal(p.yaz("pencere", 9000).oldu, true);
  assert.equal(kararYolu(), 9000, "karar yolu eski değeri okuyor — tel kopmuş");
  assert.equal(p.goruntu()[0]!.dugmeler[0]!.deger, 9000);
});

test("SABİT düğmede yazıcı YOK — tip değil, veri düzeyinde de", () => {
  // `Dugme` arayüzünde hiç `yaz` yok; bu test onu VERİ olarak da doğrular ki
  // ileride bir alan eklenirse sabitlere sızması fark edilsin.
  const d = dugme({ ad: "tik_yasagi", sinif: "sabit", oku: () => true });
  assert.ok(!("yaz" in d), "sabit düğmeye yazıcı sızmış");
});

test("dugumun() yalnızca o şema durağının modüllerini verir", () => {
  const p = panoKur([
    modul("dikkat", [dugme({ ad: "a", oku: () => 1 })], "dikkat"),
    modul("hafiza", [dugme({ ad: "b", oku: () => 2 })], "hafiza"),
  ]);
  assert.deepEqual(p.dugumun("dikkat").map((m) => m.ad), ["dikkat"]);
  assert.deepEqual(p.goruntu("hafiza").map((m) => m.ad), ["hafiza"]);
  assert.deepEqual(p.goruntu("yok_boyle"), [], "bilinmeyen düğüm boş dönmeli");
});

test("boş pano çökmez", () => {
  const p = panoKur([]);
  assert.deepEqual(p.goruntu(), []);
  assert.deepEqual(p.moduller(), []);
});

// ── S6: İKİ AŞAMALI TEYİT ────────────────────────────────────────────────

function tehlikeliPano(baslangic = 20) {
  const t = tel(baslangic);
  let eylemKostu = 0;
  const p = panoKur([modul("d", [
    dugme({
      ad: "azami", sinif: "tehlikeli", etki: "sonraki_tur",
      aralik: { en: 1, cok: 120 }, oku: t, yaz: t.yaz,
      uyari: (y) => `pencerede 17 mesaj var; ${y}'a düşürürsen ~43 sn beyne hiçbir şey gitmez`,
      bagliEylemler: [{
        ad: "sifirla", etiket: "pencereyi sıfırla",
        aciklama: "bütçe penceresini boşaltır",
        calistir: () => { eylemKostu++; },
      }],
    }),
  ])]);
  return { p, t, kostu: () => eylemKostu };
}

test("TEHLİKELİ düğme doğrudan yaz() ile DEĞİŞMEZ — teyit zorunlu", () => {
  const { p, t } = tehlikeliPano();
  const s = p.yaz("azami", 5);
  assert.equal(s.oldu, false);
  assert.match(s.sebep, /teyit/);
  assert.equal(t(), 20, "teyitsiz yazma değeri değiştirmiş");
});

test("teyit iste → onayla: DEĞER DEĞİŞİR, uyarı CANLI hesaplanmıştır", () => {
  const { p, t } = tehlikeliPano();
  const istek = p.teyitIste("azami", 5);
  assert.equal(istek.oldu, false, "teyit isteği tek başına yazmamalı");
  assert.equal(t(), 20, "teyit istemek değeri hemen değiştirmiş");

  const bek = p.bekleyenTeyit();
  assert.ok(bek);
  assert.equal(bek.eski, 20);
  assert.equal(bek.yeni, 5);
  assert.match(bek.uyari, /17 mesaj/, "uyarı canlı hesaplanmamış");
  assert.match(bek.uyari, /5'a/, "uyarı YENİ değeri içermiyor");
  assert.deepEqual(bek.eylemler.map((e) => e.ad), ["sifirla"]);

  const s = p.teyitliYaz(bek.jeton);
  assert.equal(s.oldu, true, s.sebep);
  assert.equal(t(), 5);
  assert.equal(p.bekleyenTeyit(), null, "onaydan sonra teyit kalmamalı");
});

test("YANLIŞ JETON reddedilir, değer değişmez, teyit AYAKTA kalır", () => {
  const { p, t } = tehlikeliPano();
  p.teyitIste("azami", 5);
  const s = p.teyitliYaz("uydurma-jeton");
  assert.equal(s.oldu, false);
  assert.match(s.sebep, /jeton/);
  assert.equal(t(), 20);
  assert.ok(p.bekleyenTeyit(), "geçersiz onay meşru teyidi düşürmemeli");
});

test("BEKLEYEN TEYİT EZİLEMEZ — ikinci istek reddedilir", () => {
  // Onay kapısıyla aynı kural: ekranda okuduğun teyit, onayladığın teyittir.
  const { p } = tehlikeliPano();
  p.teyitIste("azami", 5);
  const ilkJeton = p.bekleyenTeyit()!.jeton;
  const ikinci = p.teyitIste("azami", 100);
  assert.equal(ikinci.oldu, false);
  assert.match(ikinci.sebep, /bekleyen teyit/);
  assert.equal(p.bekleyenTeyit()!.jeton, ilkJeton, "teyit ezilmiş");
  assert.equal(p.bekleyenTeyit()!.yeni, 5);
});

test("BAĞLI EYLEM yalnızca SEÇİLİRSE çalışır — ayarın yan etkisi değil", () => {
  // `Hafiza.kapasite` düşürmek anıları hemen silmemeli: budama ayrı bir
  // eylemdir ve kullanıcı onu ayrıca istemiş olmalı.
  const a = tehlikeliPano();
  a.p.teyitIste("azami", 5);
  a.p.teyitliYaz(a.p.bekleyenTeyit()!.jeton);
  assert.equal(a.kostu(), 0, "seçilmeyen eylem çalışmış");

  const b = tehlikeliPano();
  b.p.teyitIste("azami", 5);
  b.p.teyitliYaz(b.p.bekleyenTeyit()!.jeton, ["sifirla"]);
  assert.equal(b.kostu(), 1, "seçilen eylem çalışmamış");
});

test("teyit İPTAL edilince değer değişmez ve jeton ölür", () => {
  const { p, t } = tehlikeliPano();
  p.teyitIste("azami", 5);
  const jeton = p.bekleyenTeyit()!.jeton;
  p.teyitIptal();
  assert.equal(p.bekleyenTeyit(), null);
  assert.equal(p.teyitliYaz(jeton).oldu, false, "iptal edilen jeton hâlâ geçerli");
  assert.equal(t(), 20);
});

test("ARALIK DIŞI teyit HİÇ AÇILMAZ — boş onay kutusu gösterilmez", () => {
  const { p } = tehlikeliPano();
  const s = p.teyitIste("azami", 999);
  assert.equal(s.oldu, false);
  assert.match(s.sebep, /aralık dışı/);
  assert.equal(p.bekleyenTeyit(), null);
});

test("UYARI hesabı çökerse teyit AÇILMAZ", () => {
  const t = tel(20);
  const p = panoKur([modul("d", [
    dugme({ ad: "a", sinif: "tehlikeli", oku: t, yaz: t.yaz,
            uyari: () => { throw new Error("hesap patladı"); } }),
  ])]);
  const s = p.teyitIste("a", 5);
  assert.equal(s.oldu, false);
  assert.match(s.sebep, /uyarı hesaplanamadı/);
  assert.equal(p.bekleyenTeyit(), null, "uyarısız teyit açılmış");
  assert.equal(t(), 20);
});

test("GÜVENLİ düğme teyit İSTEMEZ — gereksiz sürtünme eklenmemeli", () => {
  const t = tel(4000);
  const p = panoKur([modul("d", [
    dugme({ ad: "a", sinif: "guvenli", oku: t, yaz: t.yaz }),
  ])]);
  assert.match(p.teyitIste("a", 1000).sebep, /teyit istemiyor/);
  assert.equal(p.yaz("a", 1000).oldu, true, "güvenli düğme doğrudan yazılmalı");
});

test("SABİT düğme için teyit de açılmaz", () => {
  const p = panoKur([modul("d", [
    dugme({ ad: "tik", sinif: "sabit", oku: () => true }),
  ])]);
  assert.equal(p.teyitIste("tik", false).oldu, false);
  assert.equal(p.bekleyenTeyit(), null);
});

// ── S7: ÖLÇÜM KİLİDİ ─────────────────────────────────────────────────────

function olculmusPano() {
  const t = tel(1000);
  const p = panoKur([modul("d", [
    dugme({ ad: "esik", sinif: "olculmus", kaynak: "mind/refleks-olcum.ts",
            aralik: { en: 100, cok: 10000 }, oku: t, yaz: t.yaz,
            uyari: (y) => `ölçümle seçilen 1000 ms, ${y} ms ile değiştirilecek` }),
  ])]);
  return { p, t };
}

test("KİLİTLİYKEN ölçülmüş düğme ne yazılır ne teyit açar", () => {
  const { p, t } = olculmusPano();
  assert.equal(p.kilitAcikMi(), false, "kilit varsayılan olarak AÇIK gelmemeli");
  assert.equal(p.goruntu()[0]!.dugmeler[0]!.yazilabilir, false);
  assert.match(p.yaz("esik", 500).sebep, /ölçüm kilidi/);
  assert.match(p.teyitIste("esik", 500).sebep, /ölçüm kilidi/);
  assert.equal(p.bekleyenTeyit(), null);
  assert.equal(t(), 1000);
});

test("GEREKÇESİZ kilit açılmaz — tek tuşluk formalite olmamalı", () => {
  const { p } = olculmusPano();
  for (const g of ["", "   ", "\t\n"]) {
    assert.equal(p.kilitAc(g), false, `"${g}" kabul edildi`);
  }
  assert.equal(p.kilitAcikMi(), false);
  assert.equal(p.olcumDisi(), false, "açılmayan kilit damga bırakmış");
});

test("kilit açılınca yine TEYİT gerekir — 'açtım artık serbest' değil", () => {
  const { p, t } = olculmusPano();
  assert.equal(p.kilitAc("refleks eşiğini yeni donanımda yeniden ölçeceğim"), true);
  assert.equal(p.goruntu()[0]!.dugmeler[0]!.yazilabilir, false,
    "kilit açılınca doğrudan yazılabilir olmuş");
  assert.match(p.goruntu()[0]!.dugmeler[0]!.kilitSebebi, /teyit/);
  assert.match(p.yaz("esik", 500).sebep, /teyit/);
  assert.equal(t(), 1000);

  const istek = p.teyitIste("esik", 500);
  assert.equal(istek.oldu, false);
  const bek = p.bekleyenTeyit();
  assert.ok(bek, "kilit açıkken teyit açılmadı");
  assert.match(bek.uyari, /ölçümle seçilen 1000 ms/);
  assert.equal(p.teyitliYaz(bek.jeton).oldu, true);
  assert.equal(t(), 500);
});

test("ÖLÇÜM DIŞI damgası kilit KAPANSA da silinmez", () => {
  // Aç, değiştir, kapat → panel yeniden tertemiz görünseydi damga anlamsız
  // olurdu. Bu oturum artık ölçüm dışıdır.
  const { p } = olculmusPano();
  p.kilitAc("deneme");
  assert.equal(p.olcumDisi(), true);
  assert.equal(p.kilitGerekcesi(), "deneme");
  p.kilitKapat();
  assert.equal(p.kilitAcikMi(), false, "kapat çalışmadı");
  assert.equal(p.olcumDisi(), true, "DAMGA SİLİNMİŞ — ölçüm dışı oturum temiz görünüyor");
  assert.equal(p.kilitGerekcesi(), "deneme", "gerekçe kaybolmuş");
});

test("kilit SABİT ve TEHLİKELİ düğmeleri etkilemez — eksenler karışmaz", () => {
  const t = tel(20);
  const p = panoKur([modul("d", [
    dugme({ ad: "sbt", sinif: "sabit", oku: () => true }),
    dugme({ ad: "thl", sinif: "tehlikeli", oku: t, yaz: t.yaz, uyari: () => "dikkat" }),
  ])]);
  p.kilitAc("ölçüm kilidini açıyorum");
  const g = Object.fromEntries(p.goruntu()[0]!.dugmeler.map((d) => [d.ad, d]));
  assert.equal(g.sbt!.yazilabilir, false, "ölçüm kilidi SABİT teli açmış");
  assert.match(g.sbt!.kilitSebebi, /sabit/);
  assert.match(g.thl!.kilitSebebi, /teyit/, "tehlikeli düğme kilitten etkilenmiş");
  assert.match(p.yaz("sbt", false).sebep, /sabit/);
});

// ── SEÇENEK LİSTESİ ───────────────────────────────────────────────────────

test("SEÇENEK DIŞI metin reddedilir — iki yazma yolunda da", () => {
  // Beyin düğmesine "gpt-99" yazılabilseydi seçici kendi listesinde bulamaz,
  // pano ise "yazıldı" derdi. Kural iki yolda da (doğrudan ve teyitli) aynı.
  const g = tel<string>("a");
  const t = tel<string>("a");
  const p = panoKur([modul("d", [
    dugme({ ad: "guv", sinif: "guvenli", oku: g, yaz: (v) => g.yaz(v as string),
            secenekler: () => ["a", "b"] }),
    dugme({ ad: "thl", sinif: "tehlikeli", oku: t, yaz: (v) => t.yaz(v as string),
            secenekler: () => ["a", "b"], uyari: () => "bağlam kaybolur" }),
  ])]);

  assert.match(p.yaz("guv", "gpt-99").sebep, /geçersiz seçenek/);
  assert.equal(g(), "a");
  assert.equal(p.yaz("guv", "b").oldu, true);

  assert.match(p.teyitIste("thl", "gpt-99").sebep, /geçersiz seçenek/);
  assert.equal(p.bekleyenTeyit(), null, "geçersiz seçenek için teyit açıldı");
});

test("seçenekler CANLI okunur ve fırlatırsa görüntü çökmez", () => {
  let liste = ["a"];
  const p = panoKur([modul("d", [
    dugme({ ad: "x", oku: () => "a", secenekler: () => liste }),
    dugme({ ad: "y", oku: () => "a", secenekler: () => { throw new Error("liste yok"); } }),
  ])]);
  assert.deepEqual(p.goruntu()[0]!.dugmeler[0]!.secenekler, ["a"]);
  liste = ["a", "b"];
  assert.deepEqual(p.goruntu()[0]!.dugmeler[0]!.secenekler, ["a", "b"], "liste kopyalanmış");
  assert.deepEqual(p.goruntu()[0]!.dugmeler[1]!.secenekler, []);
});
