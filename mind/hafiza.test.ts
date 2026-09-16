// mind/hafiza.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hafiza, kelimeIlgisi, kuralOnemi, BOZULMA } from "./hafiza.ts";

function saatli(baslangic = 1_000_000) {
  let t = baslangic;
  return { simdi: () => t, saatIlerlet(saat: number) { t += saat * 3_600_000; } };
}

test("doğrulanmış sabit: bozulma katsayısı 0.995", () => {
  // Generative Agents (arXiv:2304.03442): "Our decay factor is 0.995".
  assert.equal(BOZULMA, 0.995);
});

test("boş hafıza boş döner, çökmez", () => {
  assert.deepEqual(new Hafiza().getir("herhangi"), []);
});

test("aynı metin ikinci kez EKLENMEZ, tazelenir ve önemi artar", () => {
  const s = saatli();
  const h = new Hafiza({ simdi: s.simdi });
  h.ekle("Ozyn terminal süzgecini soruyor", "konusma", 5);
  h.ekle("Ozyn terminal süzgecini soruyor", "konusma", 5);
  assert.equal(h.sayi, 1, "tekrar yeni anı değildir");
  assert.equal(h.sonAniler()[0]?.onem, 6, "tekrar eden olay daha kayda değer");
});

test("İLGİ: sorguyla örtüşen anı, örtüşmeyenden önce gelir", () => {
  const s = saatli();
  const h = new Hafiza({ simdi: s.simdi });
  h.ekle("Ozyn monitör süzgecini sordu", "konusma", 5);
  h.ekle("kedi bahçede uyuyor", "olay", 5);
  const r = h.getir("süzgeç nasıl çalışıyor", 1);
  assert.match(r[0]?.ani.metin ?? "", /süzgec|süzgeç/i);
});

test("TAZELİK: eşit önem ve ilgide yeni anı öne geçer", () => {
  const s = saatli();
  const h = new Hafiza({ simdi: s.simdi });
  h.ekle("alfa kaydı", "olay", 5);
  s.saatIlerlet(48);
  h.ekle("beta kaydı", "olay", 5);
  const r = h.getir("kayıt", 2);
  assert.equal(r[0]?.ani.metin, "beta kaydı");
});

test("ÖNEM: eşit tazelik ve ilgide önemli anı öne geçer", () => {
  const s = saatli();
  const h = new Hafiza({ simdi: s.simdi });
  h.ekle("önemsiz kayıt", "olay", 1);
  h.ekle("kritik kayıt", "olay", 10);
  const r = h.getir("kayıt", 2);
  assert.equal(r[0]?.ani.metin, "kritik kayıt");
});

test("getir() seçilen anıları TAZELER — makale 'recently accessed' der", () => {
  const s = saatli();
  const h = new Hafiza({ simdi: s.simdi });
  h.ekle("eski ama erişilen", "olay", 5);
  s.saatIlerlet(100);
  h.ekle("yeni kayıt", "olay", 5);

  h.getir("eski ama erişilen", 1);          // eskiyi tazele
  const r = h.getir("kayıt", 2);
  // Tazelendiği için artık tazelik bileşeni düşük değil.
  const eski = r.find((x) => x.ani.metin === "eski ama erişilen");
  assert.ok(eski, "anı hâlâ durmalı");
  assert.ok((eski?.parca.tazelik ?? 0) > 0.5, "erişim onu tazelemiş olmalı");
});

test("skor üç bileşenin TOPLAMI — tüm α = 1", () => {
  const s = saatli();
  const h = new Hafiza({ simdi: s.simdi });
  h.ekle("bir kayıt", "olay", 5);
  h.ekle("başka kayıt", "olay", 5);
  for (const r of h.getir("kayıt", 2)) {
    const beklenen = r.parca.tazelik + r.parca.onem + r.parca.ilgi;
    assert.ok(Math.abs(r.skor - beklenen) < 1e-9, "skor bileşen toplamı olmalı");
  }
});

test("kapasite aşılınca EN DÜŞÜK skorlu atılır, kör FIFO değil", () => {
  const s = saatli();
  const h = new Hafiza({ kapasite: 3, simdi: s.simdi });
  h.ekle("kritik ve eski", "konusma", 10);
  s.saatIlerlet(1);
  for (const m of ["dolgu1", "dolgu2", "dolgu3", "dolgu4"]) {
    h.ekle(m, "olay", 1);
    s.saatIlerlet(0.1);
  }
  assert.equal(h.sayi, 3);
  const metinler = h.sonAniler(10).map((a) => a.metin);
  assert.ok(metinler.includes("kritik ve eski"), "önemli anı FIFO ile atılmamalı");
});

test("yansıma eşiği: biriken önem 150'yi geçince tetiklenir", () => {
  // Generative Agents: reflection, son anıların önem toplamı 150'yi aşınca.
  const h = new Hafiza();
  assert.equal(h.yansimaGerek(), false);
  for (let i = 0; i < 19; i++) h.ekle(`kayıt ${i}`, "konusma", 8);
  assert.equal(h.birikenOnem, 152);
  assert.equal(h.yansimaGerek(), true);
  h.yansimaYapildi();
  assert.equal(h.yansimaGerek(), false);
});

test("kelimeIlgisi dolgu kelimelere aldanmaz", () => {
  // İki cümlede de "bir/bu/ve" var ama konu bambaşka.
  const d = kelimeIlgisi("bu bir ve şu", "bu bir ve şu");
  assert.ok(d === 0 || d > 0, "dolgu-only karşılaştırma çökmemeli");
  assert.equal(kelimeIlgisi("terminal süzgeci", "kedi uyuyor"), 0);
  assert.ok(kelimeIlgisi("terminal süzgeci", "terminal süzgeci nasıl") > 0.5);
});

test("kuralOnemi: konuşma en yüksek, rutin terminal en düşük", () => {
  assert.equal(kuralOnemi("konusma", "selam"), 8);
  assert.equal(kuralOnemi("terminal", "herhangi", 1), 7, "başarısızlık önemli");
  assert.equal(kuralOnemi("terminal", "dosya listesi", 0), 2, "rutin başarı önemsiz");
  assert.equal(kuralOnemi("terminal", "ℹ tests 232", 0), 5, "test sonucu orta");
  assert.ok(kuralOnemi("konusma", "x") > kuralOnemi("olay", "x"));
});

test("önem 1-10 arasına kısılır, bozuk girdi çökertmez", () => {
  const h = new Hafiza();
  h.ekle("a", "olay", 99);
  h.ekle("b", "olay", -5);
  const o = h.sonAniler(2).map((x) => x.onem).sort();
  assert.deepEqual(o, [1, 10]);
});

test("ŞU ANKİ girdi anı olarak geri gelmez — hatırlamak önümüzdeki şey değildir", () => {
  // Gerçek hatadan doğdu: köprü algıyı önce hafızaya yazıp sonra sorgu
  // olarak kullaniyordu; soru kendisini ilk siradan getirip asil aranan
  // eski aniyi listeden disari itiyordu.
  const h = new Hafiza();
  h.ekle("sifrem kirmizi balik", "konusma", 8);
  h.ekle("sifrem neydi", "konusma", 8);
  const r = h.getir("sifrem neydi", 1, ["sifrem neydi"]);
  assert.equal(r[0]?.ani.metin, "sifrem kirmizi balik");
});

test("sorgu tüm anıları kapsıyorsa boş döner, çökmez", () => {
  const h = new Hafiza();
  h.ekle("tek ani", "olay", 5);
  assert.deepEqual(h.getir("sorgu", 3, ["tek ani"]), []);
});

// ── KALICI HAFIZA ─────────────────────────────────────────────────────────
// Önceden hafıza yalnızca bellekteydi: her açılışta Orion Ozyn'i ilk kez
// görüyordu. "Odada yaşayan biri" iddiası dünü hatırlamayan biriyle tutmaz.

test("dok/yukle turu: anılar oturumlar arası taşınır", () => {
  const h1 = new Hafiza();
  h1.ekle("Ozyn git kullanıyor", "olay", 5);
  h1.ekle("tahtaya T6 bitti yazdım", "dusunce", 7);

  const h2 = new Hafiza();
  assert.equal(h2.yukle(h1.dok()), 2);
  assert.equal(h2.sayi, 2);
  assert.match(h2.getir("git", 1)[0]?.ani.metin ?? "", /git/);
});

test("yukle BİRLEŞTİRİR, ezmez — yükleme sırasında oluşan anı kaybolmaz", () => {
  const eski = new Hafiza();
  eski.ekle("dünkü not", "olay", 5);

  const yeni = new Hafiza();
  yeni.ekle("bugünkü not", "olay", 5);
  yeni.yukle(eski.dok());

  const metinler = yeni.dok().map((a) => a.metin);
  assert.ok(metinler.includes("dünkü not"));
  assert.ok(metinler.includes("bugünkü not"), "mevcut ani ezilmis");
});

test("AYNI anı iki kez yüklenmez", () => {
  const h = new Hafiza();
  h.ekle("tek not", "olay", 5);
  const dokum = h.dok();
  assert.equal(h.yukle(dokum), 0, "zaten var olan ani tekrar eklenmemeli");
  assert.equal(h.sayi, 1);
});

test("BOZUK kayıt hafızayı öldürmez — sağlamlar yüklenir", () => {
  const h = new Hafiza();
  const n = h.yukle([
    { metin: "sağlam", tur: "olay", onem: 5, olusma: Date.now(), sonErisim: Date.now() },
    null, "çöp", 42,
    { metin: "", onem: 5 },                 // boş metin
    { metin: "önemsiz", onem: "beş" },      // önem sayı değil
    { onem: 5 },                            // metin yok
  ]);
  assert.equal(n, 1, "yalnizca saglam kayit yuklenmeli");
  assert.equal(h.dok()[0]?.metin, "sağlam");
});

test("GELECEK tarihli damga şimdiye çekilir — tazelik hesabı bozulmasın", () => {
  const simdi = 1_000_000;
  const h = new Hafiza({ simdi: () => simdi });
  h.yukle([{ metin: "saati bozuk", tur: "olay", onem: 5,
             olusma: simdi + 999_999, sonErisim: simdi + 999_999 }]);
  const a = h.dok()[0]!;
  assert.ok(a.olusma <= simdi, "gelecek damga kabul edilmemeli");
  assert.ok(a.sonErisim <= simdi);
});

test("dok() KOPYA döner — dışarıdan bozulamaz", () => {
  const h = new Hafiza();
  h.ekle("dokunma", "olay", 5);
  const d = h.dok();
  d[0]!.metin = "bozuldu";
  assert.equal(h.dok()[0]?.metin, "dokunma");
});
