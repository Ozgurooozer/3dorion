// mind/onayKapisi.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OnayKapisi } from "./onayKapisi.ts";

function saatli(t0 = 1_000_000) {
  let t = t0;
  return { simdi: () => t, ilerle(ms: number) { t += ms; } };
}

test("öneri bekler, onaylanmadan komut ÇIKMAZ", () => {
  const k = new OnayKapisi();
  assert.equal(k.durum, "bos");
  k.oner("n1", "npm test", "testleri koşmak için");
  assert.equal(k.durum, "bekliyor");
  assert.equal(k.bekleyen?.komut, "npm test");
});

test("onayla() komutu döner ve kapıyı boşaltır", () => {
  const k = new OnayKapisi();
  k.oner("n1", "npm test", "gerekçe");
  const o = k.onayla();
  assert.equal(o?.komut, "npm test");
  assert.equal(k.durum, "bos");
  assert.equal(k.sayac().onaylanan, 1);
});

test("reddet() komutu ÇALIŞTIRMAZ, kapıyı boşaltır", () => {
  const k = new OnayKapisi();
  k.oner("n1", "rm -rf .", "gerekçe");
  const o = k.reddet();
  assert.equal(o?.komut, "rm -rf .");
  assert.equal(k.durum, "bos");
  assert.equal(k.sayac().reddedilen, 1);
  assert.equal(k.sayac().onaylanan, 0);
});

test("bekleyen öneri EZİLEMEZ — ikinci öneri reddedilir", () => {
  // Kritik: model arka arkaya öneri gönderirse kullanıcı bir komutu okurken
  // ekran değişir ve onay tuşu BAŞKA komuta basmış olur.
  const k = new OnayKapisi();
  assert.equal(k.oner("n1", "npm test", "g").kabul, true);
  const ikinci = k.oner("n2", "rm -rf .", "g");
  assert.equal(ikinci.kabul, false);
  assert.match(ikinci.sebep ?? "", /zaten onay bekleyen/);
  assert.equal(k.bekleyen?.komut, "npm test", "ilk öneri korunmalı");
  assert.equal(k.sayac().ezilmeyeCalisan, 1);
});

test("ZAMAN AŞIMI onaylamaz, DÜŞÜRÜR", () => {
  // "Beklerken kabul edildi" diye bir sey olmamali.
  const s = saatli();
  const k = new OnayKapisi({ zamanAsimiMs: 5000, simdi: s.simdi });
  k.oner("n1", "rm -rf .", "g");
  s.ilerle(5001);
  const dusen = k.tikle();
  assert.equal(dusen?.komut, "rm -rf .");
  assert.equal(k.durum, "bos");
  assert.equal(k.sayac().dusen, 1);
  assert.equal(k.sayac().onaylanan, 0, "zaman aşımı ASLA onay sayılmaz");
});

test("süresi dolmuş öneri onaylanamaz", () => {
  const s = saatli();
  const k = new OnayKapisi({ zamanAsimiMs: 5000, simdi: s.simdi });
  k.oner("n1", "rm -rf .", "g");
  s.ilerle(9999);
  assert.equal(k.onayla(), null, "süresi geçmiş öneri onaylanamamalı");
  assert.equal(k.sayac().onaylanan, 0);
  assert.equal(k.sayac().dusen, 1);
});

test("boş kapıda onay/ret null döner, çökmez", () => {
  const k = new OnayKapisi();
  assert.equal(k.onayla(), null);
  assert.equal(k.reddet(), null);
});

test("boş komut önerilemez", () => {
  const k = new OnayKapisi();
  assert.equal(k.oner("n1", "   ", "g").kabul, false);
  assert.equal(k.durum, "bos");
});

test("risk sınıflandırması öneriye İLİŞTİRİLİR — onay ekranı bilgilendirsin", () => {
  const k = new OnayKapisi();
  k.oner("n1", "Remove-Item -Recurse -Force dist", "eski derlemeyi sil");
  assert.equal(k.bekleyen?.risk.seviye, "yikici");
  k.reddet();
  k.oner("n2", "git status", "duruma bak");
  assert.equal(k.bekleyen?.risk.seviye, "okur");
});

test("her karar DENETİM İZİNE yazılır", () => {
  const s = saatli();
  const k = new OnayKapisi({ zamanAsimiMs: 5000, simdi: s.simdi });
  k.oner("n1", "npm test", "g"); s.ilerle(100); k.onayla();
  k.oner("n2", "rm -rf .", "g"); s.ilerle(200); k.reddet();
  k.oner("n3", "npm i", "g"); s.ilerle(6000); k.tikle();

  const g = k.gecmis();
  assert.deepEqual(g.map((x) => x.karar), ["onay", "ret", "dustu"]);
  assert.equal(g[0]?.sureMs, 100);
  assert.deepEqual(g.map((x) => x.oneri.komut), ["npm test", "rm -rf .", "npm i"]);
});

test("denetim izi sınırsız büyümez", () => {
  const k = new OnayKapisi();
  for (let i = 0; i < 250; i++) { k.oner(`n${i}`, `komut${i}`, "g"); k.reddet(); }
  assert.ok(k.gecmis().length <= 200, `gecmis=${k.gecmis().length}`);
});

test("bekleyen() kopya döner — dışarıdan bozulamaz", () => {
  const k = new OnayKapisi();
  k.oner("n1", "npm test", "g");
  const b = k.bekleyen!;
  b.komut = "rm -rf .";
  assert.equal(k.bekleyen?.komut, "npm test", "bekleyen öneri dışarıdan değiştirilememeli");
});

// ── PANEL TUZAĞI: canlı ayar değişikliği bekleyen öneriyi bozamaz ─────────
//
// Devre panosu `zamanAsimiMs`'i CANLI değiştirebilecek. Bugünkü kontrol
// ÖZGÜN damgayı GÜNCEL süreyle karşılaştırıyor:
//     simdi - o.an < this._zamanAsimi()
// Süre kısalırsa bekleyen öneri bir sonraki tikle/oner/onayla çağrısında
// DÜŞER ve denetim izine "dustu" diye geçer — yani Ozyn'in gördüğü öneri,
// Ozyn hiçbir şey yapmadan, meşru bir zaman aşımı kılığında yok olur.
// Bu dosyanın başlığındaki 2. ve 4. ilkenin İKİSİNİ BİRDEN çiğner.
//
// SÖZLEŞME: son tarih öneri anında DONDURULUR; ayar SONRAKİ öneriye uygulanır.

test("bekleyen öneri varken zaman aşımı KISALTILIRSA öneri düşmez", () => {
  let zamanAsimi = 90_000;
  const s = saatli();
  const kapi = new OnayKapisi({ zamanAsimiMs: () => zamanAsimi, simdi: s.simdi });

  assert.equal(kapi.oner("n1", "git status", "durumu göreyim").kabul, true);

  s.ilerle(10_000);
  zamanAsimi = 1;                       // panelden kısaltıldı

  assert.equal(kapi.tikle(), null, "kısaltma bekleyen öneriyi düşürdü");
  assert.equal(kapi.durum, "bekliyor");
  assert.equal(kapi.sayac().dusen, 0, "sahte zaman aşımı denetim izine girdi");

  s.ilerle(79_000);                     // toplam 89 sn — ÖZGÜN süre dolmadı
  assert.equal(kapi.tikle(), null);
  assert.equal(kapi.durum, "bekliyor");

  s.ilerle(2_000);                      // 91 sn — özgün süre doldu
  assert.equal(kapi.tikle()?.id, "n1");
  assert.equal(kapi.gecmis().at(-1)?.karar, "dustu");
});

test("kısaltma ONAYLA/REDDET yollarından da öneriyi kaçırmaz", () => {
  // `_zamanAsimiKontrol` yalnızca tikle'den değil oner/onayla/reddet'ten de
  // çağrılıyor. Tuzak dört kapıda birden kapalı olmalı.
  for (const yol of ["onayla", "reddet"] as const) {
    let zamanAsimi = 90_000;
    const s = saatli();
    const kapi = new OnayKapisi({ zamanAsimiMs: () => zamanAsimi, simdi: s.simdi });
    kapi.oner("n1", "npm test", "testleri koşayım");
    s.ilerle(10_000);
    zamanAsimi = 1;
    const o = yol === "onayla" ? kapi.onayla() : kapi.reddet();
    assert.equal(o?.id, "n1", `${yol}: öneri kısaltma yüzünden kayboldu`);
    assert.equal(kapi.sayac().dusen, 0, `${yol}: sahte düşme`);
  }
});

test("zaman aşımı UZATILIRSA da bekleyen öneri uzamaz — son tarih dondurulmuştur", () => {
  // Ozyn'e gösterilen son tarih bir sözleşmedir. Geriye dönük uzatmak,
  // basmak üzere olduğu tuşun anlamını değiştirir.
  let zamanAsimi = 10_000;
  const s = saatli();
  const kapi = new OnayKapisi({ zamanAsimiMs: () => zamanAsimi, simdi: s.simdi });
  kapi.oner("n1", "rm -rf build", "temizlik");
  s.ilerle(5_000);
  zamanAsimi = 600_000;                 // panelden uzatıldı
  s.ilerle(6_000);                      // özgün 10 sn doldu
  assert.equal(kapi.tikle()?.id, "n1", "uzatma bekleyen öneriyi geriye dönük uzattı");
});

test("yeni ayar SONRAKİ öneriye uygulanır", () => {
  let zamanAsimi = 90_000;
  const s = saatli();
  const kapi = new OnayKapisi({ zamanAsimiMs: () => zamanAsimi, simdi: s.simdi });
  kapi.oner("n1", "ls", "bakayım");
  zamanAsimi = 5_000;
  s.ilerle(90_001);
  kapi.tikle();                         // n1 ÖZGÜN süresiyle düştü
  assert.equal(kapi.durum, "bos");

  kapi.oner("n2", "pwd", "neredeyim");
  s.ilerle(4_999);
  assert.equal(kapi.tikle(), null, "yeni süre erken uygulandı");
  s.ilerle(2);
  assert.equal(kapi.tikle()?.id, "n2", "yeni süre sonraki öneriye uygulanmadı");
});

test("sayı olarak verilen zaman aşımı aynen çalışır — geriye uyum", () => {
  const s = saatli();
  const kapi = new OnayKapisi({ zamanAsimiMs: 5_000, simdi: s.simdi });
  kapi.oner("n1", "ls", "bak");
  s.ilerle(4_999);
  assert.equal(kapi.tikle(), null);
  s.ilerle(2);
  assert.equal(kapi.tikle()?.id, "n1");
});

test("panel kapıyı KALDIRAMAZ: elle düşürme asla onay değildir", () => {
  const s = saatli();
  const kapi = new OnayKapisi({ simdi: s.simdi });
  kapi.oner("n1", "git push --force", "aceleci");
  assert.equal(kapi.elleDusur("Ozyn panodan iptal etti")?.id, "n1");
  assert.equal(kapi.durum, "bos");
  assert.equal(kapi.sayac().onaylanan, 0, "elle düşürme onaya dönüştü");
  assert.equal(kapi.sayac().dusen, 0, "elle iptal zaman aşımı gibi kaydedildi");
  assert.equal(kapi.sayac().elleDusurulen, 1);
  assert.equal(kapi.gecmis().at(-1)?.karar, "elle_dusuruldu");
});

test("boş kapıda elle düşürme null döner, sayaç kirletmez", () => {
  const kapi = new OnayKapisi();
  assert.equal(kapi.elleDusur(), null);
  assert.equal(kapi.sayac().elleDusurulen, 0);
});

test("son tarih ÖNERİ ANINDA hesaplanır ve öneride görünür", () => {
  // Panel bunu gösterecek: "kalan 47 sn". Değer dışarıdan okunabilmeli.
  const s = saatli(1_000_000);
  const kapi = new OnayKapisi({ zamanAsimiMs: 30_000, simdi: s.simdi });
  kapi.oner("n1", "ls", "bak");
  assert.equal(kapi.bekleyen?.sonTarih, 1_030_000);
});
