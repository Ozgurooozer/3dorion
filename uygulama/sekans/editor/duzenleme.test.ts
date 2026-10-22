// uygulama/sekans/editor/duzenleme.test.ts — sekans düzenleme (spec 36 S2): işlemler (değiştirilemez, biçimden geçer, kilit, çakışma), oturum (tek geri al
// adımı, sürükleme önizlemesi, yaslama, Shift eksen kısıtı, playhead), kısayollar (yazı alanında harf; ▶ kısayolu YOK), Ayrıntılar (1+1 REDDEDİLİR).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { sekansDogrula, type Sekans } from "../../../protocol/sekans.ts";
import { ayrintiAlanlari, ayrintiUygula, type AyrintiOrtami } from "./ayrintiAlanlari.ts";
import { sekansKomutu } from "./kisayollar.ts";
import { anahtarEkle, anahtarlariTasi, baglamaSil, bolumKirp, bolumTasi, bolumUzat, izBayrak, izSil, sureAyarla, uzuvIziEkle } from "./sekansIslemleri.ts";
import { sekansOturumuKur } from "./sekansOturumu.ts";

function sekans(): Sekans {
  const r = sekansDogrula({
    surum: 1, ad: "t", fps: 30, sure_kare: 120, baglamalar: [{ id: "b1", ajan: "orion" }],
    izler: [
      { id: "bas", baglama: "b1", tur: "uzuv", uzuv: "bas", kanal: "donme_x", anahtarlar: [{ kare: 0, deger: 0 }, { kare: 30, deger: 10 }, { kare: 60, deger: 0 }] },
      { id: "k", baglama: "b1", tur: "klip", bolumler: [{ klip: "el_salla", baslangic_kare: 10, uzunluk_kare: 40 }, { klip: "dusun", baslangic_kare: 70, uzunluk_kare: 30 }] },
    ],
  });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
}
const anahtarlar = (s: Sekans, iz = "bas") => { const x = s.izler.find((z) => z.id === iz); return x?.tur === "uzuv" ? x.anahtarlar.map((a) => [a.kare, a.deger]) : null; };
const bolumler = (s: Sekans) => { const x = s.izler.find((z) => z.id === "k"); return x?.tur === "klip" ? x.bolumler.map((b) => [b.baslangic_kare, b.uzunluk_kare, b.ofset_kare]) : null; };
const ok = <T>(r: { ok: true; deger: T } | { ok: false; hata: string }): T => { if (!r.ok) throw new Error(r.hata); return r.deger; };
const ORTAM: AyrintiOrtami = { klipler: ["el_salla", "dusun"], ajanlar: ["orion", "flash"], klipKaresi: (ad) => (ad === "el_salla" ? 72 : 90) };

test("işlemler DEĞİŞTİRİLEMEZ: eski sekans dokunulmadan kalır", () => {
  const s = sekans();
  const once = JSON.stringify(s);
  ok(anahtarEkle(s, "bas", 45, 3));
  assert.equal(JSON.stringify(s), once);
});

test("anahtar ekle: değer verilmezse izin O KAREDEKİ değeri (eğri değişmez); var olan karede değeri günceller", () => {
  const s = ok(anahtarEkle(sekans(), "bas", 15));
  assert.deepEqual([anahtarlar(s), anahtarlar(ok(anahtarEkle(s, "bas", 15, 7)))?.[1]], [[[0, 0], [15, 5], [30, 10], [60, 0]], [15, 7]]);
});

test("anahtar taşı: başka anahtarın üstüne düşen kayma nedenle reddedilir", () => {
  const r = anahtarlariTasi(sekans(), [{ iz: "bas", kare: 30 }], 30, 0);
  assert.deepEqual(r.ok ? "" : r.hata, "anahtar başka bir anahtarın üstüne düşer");
});

test("anahtar taşı: değer kanalın tavanına KISILIR (±180°), sekans dışına çıkan kare reddedilir", () => {
  const s = ok(anahtarlariTasi(sekans(), [{ iz: "bas", kare: 30 }], 0, 500)).sekans;
  const r = anahtarlariTasi(sekans(), [{ iz: "bas", kare: 60 }], 61, 0);
  assert.deepEqual([anahtarlar(s)?.[1], r.ok ? "" : r.hata], [[30, 180], "anahtar sekansın dışına çıkar (0–120)"]);
});

test("KİLİTLİ iz değiştirilemez (nedenle); kilit kilitliyken de açılabilir", () => {
  const k = ok(izBayrak(sekans(), "bas", "kilitli", true));
  const r = anahtarEkle(k, "bas", 5, 1);
  assert.deepEqual([r.ok ? "" : r.hata, ok(izBayrak(k, "bas", "kilitli", false)).izler[0]!.kilitli], ["'bas' izi kilitli (🔒): önce kilidi aç", false]);
});

test("bölüm taşı: komşu bölümle çakışan konum biçimce reddedilir", () => {
  const r = bolumTasi(sekans(), "k", 0, 25);   // 35–75, dusun 70'te başlıyor
  assert.match(r.ok ? "" : r.hata, /üst üste biniyor/);
});

test("bölüm uzat: sağ kenar uzunluğu değiştirir; KIRP: baş, uzunluk ve klip içi ofset birlikte kayar", () => {
  assert.deepEqual([bolumler(ok(bolumUzat(sekans(), "k", 0, 5)))?.[0], bolumler(ok(bolumKirp(sekans(), "k", 0, 6)))?.[0]], [[10, 45, 0], [16, 34, 6]]);
});

test("KIRP ofseti 0'ın altına inemez (klibin başından önce yok): sola kırpma ofset kadar", () => {
  assert.deepEqual(bolumler(ok(bolumKirp(sekans(), "k", 0, -5)))?.[0], [10, 40, 0]);
});

test("süre kısaltma: anahtar/bölüm dışarıda kalacaksa nedenle reddedilir (sessiz kırpma yok)", () => {
  const r = sureAyarla(sekans(), 90);
  assert.equal(r.ok ? "" : r.hata, "süre 90 kare olamaz: kare 100'e dek anahtar/bölüm var (önce onları taşı ya da sil)");
});

test("iz ekle: okunur tekil kimlik; aynı uzuv+kanal ikinci kez biçimce reddedilir", () => {
  const r = uzuvIziEkle(sekans(), "b1", "bas", "donme_x");
  const y = ok(uzuvIziEkle(sekans(), "b1", "sag_kol", "donme_z"));
  assert.deepEqual([r.ok ? "" : r.hata.includes("iki kez"), y.iz], [true, "sag_kol_dz"]);
});

test("bağlama sil: izleriyle gider ve kaç iz gittiği söylenir; kilitli iz varsa reddedilir", () => {
  const r = ok(baglamaSil(sekans(), "b1"));
  const k = baglamaSil(ok(izBayrak(sekans(), "k", "kilitli", true)), "b1");
  assert.deepEqual([r.iz, r.sekans.izler.length, k.ok], [2, 0, false]);
});

test("iz sil: kilitliyse reddedilir", () => {
  const r = izSil(ok(izBayrak(sekans(), "bas", "kilitli", true)), "bas");
  assert.equal(r.ok, false);
});

// ── oturum ──

test("SÜRÜKLEME TEK geri al adımı: birçok hareket + bırak → bir Ctrl+Z eski yere döner", () => {
  const o = sekansOturumuKur(sekans());
  o.gorunum = { x: 0, olcek: 2 }; o.yasla = false;
  o.anahtarSurukleBasla([{ iz: "bas", kare: 30 }]);
  for (const dx of [2, 6, 10, 14]) o.surukle(dx, 0, false);
  o.surukleBitir();
  const sonra = anahtarlar(o.sekans())?.[1];
  o.geriAl();
  assert.deepEqual([sonra, anahtarlar(o.sekans())?.[1], o.gecmis.boyut()], [[37, 10], [30, 10], 2]);
});

test("sürüklemede geçersiz ara konum önizlemeyi BOZMAZ: son geçerli hâlde kalır ve neden söylenir", () => {
  const o = sekansOturumuKur(sekans());
  o.gorunum = { x: 0, olcek: 1 }; o.yasla = false;
  o.anahtarSurukleBasla([{ iz: "bas", kare: 30 }]);
  o.surukle(10, 0, false);
  const r = o.surukle(30, 0, false);   // 60'taki anahtarın üstü
  assert.deepEqual([r?.ok, anahtarlar(o.sekans())?.[1]], [false, [40, 10]]);
});

test("Esc sürüklemeyi iptal eder: yığına bir şey girmez, sekans eski hâlinde", () => {
  const o = sekansOturumuKur(sekans());
  o.anahtarSurukleBasla([{ iz: "bas", kare: 30 }]);
  o.surukle(40, 0, false);
  o.surukleIptal();
  assert.deepEqual([anahtarlar(o.sekans())?.[1], o.gecmis.boyut()], [[30, 10], 1]);
});

test("Shift ile sürükleme: yatay baskınsa DEĞER değişmez (yalnız zaman)", () => {
  const o = sekansOturumuKur(sekans());
  o.gorunum = { x: 0, olcek: 1 }; o.yasla = false;
  o.anahtarSurukleBasla([{ iz: "bas", kare: 30 }]);
  o.surukle(12, -5, true);
  assert.deepEqual(anahtarlar(o.sekans())?.[1], [42, 10]);
});

test("dikey sürükleme değeri değiştirir: 1 px yukarı = +1°", () => {
  const o = sekansOturumuKur(sekans());
  o.anahtarSurukleBasla([{ iz: "bas", kare: 30 }]);
  o.surukle(0, -8, false);
  assert.deepEqual(anahtarlar(o.sekans())?.[1], [30, 18]);
});

test("YASLAMA: bölüm sürüklenirken komşu bölümün kenarına yapışır; kapalıyken yapışmaz", () => {
  const ac = sekansOturumuKur(sekans()), kapali = sekansOturumuKur(sekans());
  for (const o of [ac, kapali]) { o.gorunum = { x: 0, olcek: 4 }; o.kare = 0; o.yasla = o === ac; o.bolumSurukleBasla("k", 0, "sag"); o.surukle(4 * 19.2, 0, false); }
  assert.deepEqual([bolumler(ac.sekans())?.[0]?.[1], bolumler(kapali.sekans())?.[0]?.[1]], [60, 59]);
});

test("playhead: ←/→ kare adımı süre içinde kalır; Home/End aralığın başı/sonu", () => {
  const o = sekansOturumuKur(sekans());
  o.adim(-5);
  const a = o.kare;
  o.sona();
  const b = o.kare;
  o.adim(10);
  assert.deepEqual([a, b, o.kare], [0, 120, 120]);
});

test("önceki/sonraki anahtara atla: seçili izin anahtarları ve bölüm kenarları", () => {
  const o = sekansOturumuKur(sekans());
  o.secim = { tur: "iz", iz: "bas" }; o.kare = 31;
  o.anahtaraAtla(1);
  const ileri = o.kare;
  o.anahtaraAtla(-1); o.anahtaraAtla(-1);
  assert.deepEqual([ileri, o.kare], [60, 0]);
});

test("K: seçili UZUV izine playhead'de anahtar; iz seçili değilse nedenle", () => {
  const o = sekansOturumuKur(sekans());
  const r1 = o.anahtarEkle();
  o.secim = { tur: "iz", iz: "bas" }; o.kare = 45;
  const r2 = o.anahtarEkle();
  assert.deepEqual([r1.ok, r2.ok, anahtarlar(o.sekans())?.[2]], [false, true, [45, 5]]);
});

test("Delete: seçili anahtarlar tek adımda gider; Ctrl+Z hepsini geri getirir; kirli işareti", () => {
  const o = sekansOturumuKur(sekans());
  o.secim = { tur: "anahtar", refs: [{ iz: "bas", kare: 0 }, { iz: "bas", kare: 60 }] };
  o.sil();
  const sonra = anahtarlar(o.sekans())?.length, kirli = o.gecmis.kirli();
  o.geriAl();
  assert.deepEqual([sonra, kirli, anahtarlar(o.sekans())?.length, o.gecmis.kirli()], [1, true, 3, false]);
});

// ── kısayollar ──

test("kısayollar: Ctrl+S kaydet, ←/→ basılı tutunca tekrar eder, Shift+→ 10 kare, K anahtar", () => {
  assert.deepEqual([
    sekansKomutu({ key: "s", code: "KeyS", ctrlKey: true }, false), sekansKomutu({ key: "ArrowRight", code: "ArrowRight", repeat: true }, false),
    sekansKomutu({ key: "ArrowRight", code: "ArrowRight", shiftKey: true }, false), sekansKomutu({ key: "k", code: "KeyK" }, false),
  ], ["kaydet", "ileri1", "ileri10", "anahtarEkle"]);
});

test("YAZI ALANINDA tuş harftir: K, Delete, ← editör komutu değil; Ctrl+S ve Esc editörün", () => {
  assert.deepEqual([
    sekansKomutu({ key: "k", code: "KeyK" }, true), sekansKomutu({ key: "Delete", code: "Delete" }, true), sekansKomutu({ key: "ArrowLeft", code: "ArrowLeft" }, true),
    sekansKomutu({ key: "s", code: "KeyS", ctrlKey: true }, true), sekansKomutu({ key: "Escape", code: "Escape" }, true),
  ], [null, null, null, "kaydet", "alandanCik"]);
});

test("▶ OYNAT'IN KISAYOLU YOK: Boşluk ve Enter hiçbir komut değil (oynatmak yalnız düğmeye gerçek tık)", () => {
  assert.deepEqual([sekansKomutu({ key: " ", code: "Space" }, false), sekansKomutu({ key: "Enter", code: "Enter" }, false)], [null, null]);
});

// ── Ayrıntılar ──

test("Ayrıntılar: sayı kutusu '1+1' gibi İFADEYİ REDDEDER (eval yok); '2,5' kabul", () => {
  const s = sekans(), secim = { tur: "anahtar" as const, refs: [{ iz: "bas", kare: 30 }] };
  const deger = ayrintiAlanlari(s, secim, ORTAM).alanlar.find((a) => a.ad === "deger")!;
  const r1 = ayrintiUygula(s, secim, deger, "1+1"), r2 = ayrintiUygula(s, secim, deger, "2,5");
  assert.deepEqual([r1.ok ? "" : r1.hata, r2.ok ? anahtarlar(r2.deger.sekans)?.[1] : null], ["değer: sayı olmalı (gelen: \"1+1\"; ifade hesaplanmaz)", [30, 2.5]]);
});

test("Ayrıntılar: kare alanı TAMSAYI ister; kare değişince seçim yeni kareye taşınır", () => {
  const s = sekans(), secim = { tur: "anahtar" as const, refs: [{ iz: "bas", kare: 30 }] };
  const kare = ayrintiAlanlari(s, secim, ORTAM).alanlar.find((a) => a.ad === "kare")!;
  const r1 = ayrintiUygula(s, secim, kare, "12,5"), r2 = ayrintiUygula(s, secim, kare, "40");
  assert.deepEqual([r1.ok ? "" : r1.hata, r2.ok ? r2.deger.secim : null], ["kare: tamsayı olmalı (gelen: 12.5)", { tur: "anahtar", refs: [{ iz: "bas", kare: 40 }] }]);
});

test("Ayrıntılar: bölümün klibi kütüphanede yoksa bilgi satırı NEDENİNİ söyler", () => {
  const s = ok(sekansDogrula({ ...sekans(), izler: [{ id: "k", baglama: "b1", tur: "klip", bolumler: [{ klip: "kayip", baslangic_kare: 0, uzunluk_kare: 10 }] }] }));
  assert.match(ayrintiAlanlari(s, { tur: "bolum", iz: "k", i: 0 }, { ...ORTAM, klipKaresi: () => null }).bilgi[0]!, /kütüphanede YOK/);
});

test("Ayrıntılar (seçim yok): sekansın süresi ve aralığı; aralık başı sonundan büyükse biçim reddeder", () => {
  const s = sekans(), a = ayrintiAlanlari(s, { tur: "yok" }, ORTAM);
  const r = ayrintiUygula(s, { tur: "yok" }, a.alanlar.find((x) => x.ad === "aralik_bas")!, "119");
  const t = ayrintiUygula(s, { tur: "yok" }, a.alanlar.find((x) => x.ad === "aralik_bit")!, "100");
  assert.deepEqual([a.alanlar.map((x) => x.ad), r.ok, t.ok ? t.deger.sekans.aralik : null], [["aciklama", "sure_kare", "aralik_bas", "aralik_bit"], true, { bas: 0, bit: 100 }]);
});
