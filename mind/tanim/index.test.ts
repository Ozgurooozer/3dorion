// mind/tanim/index.test.ts — TANIMLARIN kendisi sınanır.
//
// Buradaki testler kodun çalışıp çalışmadığını değil, panonun DOĞRU ŞEYİ
// ilan edip etmediğini sorar. Bir güvenlik teli yanlışlıkla "guvenli" ilan
// edilirse hiçbir şey çökmez — panel yalnızca ayarlanabilir görünür ve
// birisi S5'te onu gerçekten ayarlanabilir yapar. Kapı burası.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { panoKur, tel } from "../../protocol/pano.ts";
import { Dikkat } from "../dikkat.ts";
import { Hafiza } from "../hafiza.ts";
import { Ajanda } from "../ajanda.ts";
import { OnayKapisi } from "../onayKapisi.ts";
import {
  dikkatTanimi, hafizaTanimi, onayTanimi, ajandaTanimi, refleksTanimi, beyinTanimi,
} from "./index.ts";
import { DUGUMLER } from "../../world/surfaces/semaCekirdek.ts";

function tamPano() {
  const dikkat = new Dikkat();
  const hafiza = new Hafiza();
  const ajanda = new Ajanda();
  const onay = new OnayKapisi();
  const pano = panoKur([
    dikkatTanimi(dikkat), hafizaTanimi(hafiza), onayTanimi(onay),
    ajandaTanimi(ajanda), refleksTanimi(),
    beyinTanimi({ ad: () => "opencode:test", kesikSaniye: () => 0, yakinlikKurali: () => true }),
  ]);
  return { pano, dikkat, hafiza, ajanda, onay };
}

const tumDugmeler = (p: ReturnType<typeof tamPano>["pano"]) =>
  p.goruntu().flatMap((m) => m.dugmeler);

test("tüm tanımlar kurulur — ad çakışması ve kaynaksız ölçüm yok", () => {
  assert.doesNotThrow(() => tamPano());
});

test("MALİYET TAVANI panoda GÖRÜNÜR ve sabit — gizlenmiş tel savunulamaz", () => {
  // Projenin en pahalı hatası `tik`in beyne sızması olurdu. Panoda çizili
  // olmadığı sürece kimse onun varlığını bilmez, kaybolduğunu da fark etmez.
  const d = tumDugmeler(tamPano().pano).find((x) => x.ad === "dikkat.tik_yasagi");
  assert.ok(d, "tik yasağı panoda YOK");
  assert.equal(d.sinif, "sabit");
  assert.equal(d.yazilabilir, false);
  assert.equal(d.deger, true);
});

test("ONAY KAPISI panoda GÖRÜNÜR ve sabit — merkezi vaat kapatılamaz", () => {
  const hepsi = tumDugmeler(tamPano().pano);
  for (const ad of ["onay.zorunlu", "onay.ezilmez"]) {
    const d = hepsi.find((x) => x.ad === ad);
    assert.ok(d, `${ad} panoda YOK`);
    assert.equal(d.sinif, "sabit", `${ad} sabit değil`);
    assert.equal(d.yazilabilir, false, `${ad} yazılabilir`);
  }
});

test("YAKINLIK kuralı panoda görünür ve sabit", () => {
  const d = tumDugmeler(tamPano().pano).find((x) => x.ad === "beyin.yakinlik");
  assert.ok(d);
  assert.equal(d.sinif, "sabit");
});

test("her ÖLÇÜLMÜŞ düğmenin kaynağı var — kaynaksız ölçüm iddiası yasak", () => {
  for (const d of tumDugmeler(tamPano().pano)) {
    if (d.sinif !== "olculmus") continue;
    assert.ok(d.kaynak.length > 10, `${d.ad} kaynağı yetersiz: "${d.kaynak}"`);
  }
});

test("S4 SALT OKUNUR — sınıfı ne olursa olsun hiçbir düğme yazılabilir değil", () => {
  // S5'te BİLEREK düşecek: yazma yolunun açıldığı an bu test haber verir.
  for (const d of tumDugmeler(tamPano().pano)) {
    assert.equal(d.yazilabilir, false, `${d.ad} erken yazılabilir olmuş`);
  }
});

test("her modül GERÇEK bir şema düğümüne bağlı — kopuk modül yok", () => {
  const semaAdlari = new Set(DUGUMLER.map((d) => d.ad));
  for (const m of tamPano().pano.moduller()) {
    assert.ok(semaAdlari.has(m.dugum), `${m.ad} bilinmeyen düğüme bağlı: ${m.dugum}`);
  }
});

test("her düğmenin açıklaması var ve TEK SATIR — panel paragraf çizmez", () => {
  for (const d of tumDugmeler(tamPano().pano)) {
    assert.ok(d.aciklama.length > 25, `${d.ad} açıklaması çok kısa`);
    assert.ok(!d.aciklama.includes("\n"), `${d.ad} açıklaması çok satırlı`);
  }
});

test("TEL canlı: modül değişince pano da değişir, kopya yok", () => {
  // Panonun tek gerçek vaadi. Kopya tutan bir tasarım burada çöker.
  const { pano, hafiza } = tamPano();
  const oku = () => tumDugmeler(pano).find((x) => x.ad === "hafiza.sayi")!.deger;

  assert.equal(oku(), 0);
  hafiza.ekle("bir anı", "olay", 5);
  assert.equal(oku(), 1, "pano anı eklenmesini görmedi — kopya tutmuş");
});

test("ONAY zaman aşımı TELDEN okunur — canlı değişir", () => {
  let sure = 90_000;
  const onay = new OnayKapisi({ zamanAsimiMs: () => sure });
  const pano = panoKur([onayTanimi(onay)]);
  const oku = () => pano.goruntu()[0]!.dugmeler.find((x) => x.ad === "onay.zaman_asimi")!.deger;

  assert.equal(oku(), 90_000);
  sure = 30_000;
  assert.equal(oku(), 30_000, "pano zaman aşımını kopyalamış");
});

test("hiçbir düğme okuması pano görüntüsünü ÇÖKERTMEZ", () => {
  // Kare döngüsü güvenliği: gerçek tanımların hepsi sorunsuz okunmalı.
  const { pano } = tamPano();
  assert.doesNotThrow(() => pano.goruntu());
  for (const d of tumDugmeler(pano)) {
    assert.equal(d.hata, "", `${d.ad} okunamadı: ${d.hata}`);
    assert.notEqual(d.deger, null, `${d.ad} değeri null`);
  }
});

test("SABİT düğmeler ÖLÇÜM de taşıyabilir — sınıf tehlike, etki zaman", () => {
  // İki eksen bağımsız: `dikkat.penceredeki` sabit (yazılamaz) ama canlı
  // bir ölçüm. Bunları tek "seviye" alanında birleştiren tasarım bu satırı
  // ifade edemezdi.
  const { pano, dikkat } = tamPano();
  const d = tumDugmeler(pano).find((x) => x.ad === "dikkat.penceredeki")!;
  assert.equal(d.sinif, "sabit");
  assert.equal(d.deger, 0);
  assert.equal(dikkat.penceredekiMesaj, 0);
});

// ── S5 KAPISI: panelden yazma KARAR YOLUNU değiştirir mi? ────────────────
//
// "Farklı hissettiriyor" kabul edilmiyor. Aynı algı dizisi, aynı saat,
// yalnızca panelden değiştirilen tek ayar — ve `dusen` sayacındaki fark.

test("S5 KAPISI: panelden tekrar penceresi değişince DÜŞEN sayısı ölçülür", () => {
  const t0 = 1_000_000;
  let saat = t0;
  const tekrarTeli = tel(4000);
  const dikkat = new Dikkat({ tekrarPenceresiMs: tekrarTeli, simdi: () => saat });
  const pano = panoKur([dikkatTanimi(dikkat, { tekrar: tekrarTeli })]);

  // `duydum` seçildi çünkü VARSAYILAN_KANAL'da "beyin": yerel kanallı bir
  // algı 2. adımda düşer ve HİÇBİR sayacı artırmaz — ölçüm sessizce sıfır
  // çıkar. Aleti, cevabı bilinen girdide koşmadan metriğe güvenmek burada
  // yanlış sonuca götürürdü.
  const akit = () => {
    for (let i = 0; i < 6; i++) {
      saat += 1000;
      dikkat.karar({ tur: "duydum", metin: "ayni cumle", kesin: true });
    }
  };

  // Sayaçlar KÜMÜLATİF: `sifirla()` pencere durumunu temizler ama sayacı
  // sıfırlamaz. Ham sayıyı karşılaştırmak "düşen değişmedi" gibi yanlış bir
  // sonuç verirdi — karşılaştırma DELTA üzerinden yapılmalı.
  const once = { ...dikkat.sayac() };
  akit();
  const sonra = { ...dikkat.sayac() };
  const genis = { gecen: sonra.gecen - once.gecen, dusen: sonra.dusen - once.dusen };

  // Panelden yaz — doğrudan modüle değil, PANO üzerinden.
  const sonuc = pano.yaz("dikkat.tekrar", 0);
  assert.equal(sonuc.oldu, true, `panelden yazılamadı: ${sonuc.sebep}`);
  assert.equal(dikkat.tekrarPenceresiMs, 0, "karar yolu yeni değeri görmüyor");

  dikkat.sifirla();
  saat += 60_000;                       // bütçe penceresi temizlensin
  const once2 = { ...dikkat.sayac() };
  akit();
  const sonra2 = { ...dikkat.sayac() };
  const dar = { gecen: sonra2.gecen - once2.gecen, dusen: sonra2.dusen - once2.dusen };

  console.log(`[S5-OLCUM] 6 aynı algı, tekrar=4000ms -> geçen=${genis.gecen} düşen=${genis.dusen}`);
  console.log(`[S5-OLCUM] 6 aynı algı, tekrar=0ms    -> geçen=${dar.gecen} düşen=${dar.dusen}`);

  // KONTROL: geniş pencerede gerçekten yutma OLMALI, yoksa test pozitif
  // üretemiyor demektir ve "fark yok" sonucu okunamaz.
  assert.ok(genis.dusen > 0, "geniş pencerede hiç tekrar yutulmamış — ölçüm geçersiz");
  assert.equal(dar.dusen, 0, "pencere 0'ken hâlâ tekrar yutuluyor");
  assert.ok(dar.gecen > genis.gecen,
    "ayar değişti ama beyne giden mesaj artmadı — yazma karar yolunu etkilemiyor");
});

test("wired tanımda 'guvenli' düğmeler yazılabilir, diğerleri DEĞİL", () => {
  const tekrarTeli = tel(4000);
  const dikkat = new Dikkat({ tekrarPenceresiMs: tekrarTeli });
  const pano = panoKur([dikkatTanimi(dikkat, { tekrar: tekrarTeli })]);
  const g = Object.fromEntries(
    pano.goruntu()[0]!.dugmeler.map((d) => [d.ad, d]));

  assert.equal(g["dikkat.tekrar"]!.yazilabilir, true, "telli güvenli düğme açılmamış");
  assert.equal(g["dikkat.tik_yasagi"]!.yazilabilir, false, "MALİYET TAVANI yazılabilir olmuş");
  assert.equal(g["dikkat.azami"]!.yazilabilir, false, "tehlikeli düğme S5'te açılmış");

  // Tel TAKILMAYAN güvenli düğme salt okunur kalır — sessizce açılmaz.
  assert.equal(g["dikkat.terminal_kis"]!.yazilabilir, false,
    "telsiz düğme yazılabilir görünüyor");
});

test("MALİYET TAVANINA yazmak panodan da REDDEDİLİR", () => {
  const tekrarTeli = tel(4000);
  const dikkat = new Dikkat({ tekrarPenceresiMs: tekrarTeli });
  const pano = panoKur([dikkatTanimi(dikkat, { tekrar: tekrarTeli })]);
  const s = pano.yaz("dikkat.tik_yasagi", false);
  assert.equal(s.oldu, false);
  assert.match(s.sebep, /sabit/);
});

// ── S6 KAPISI: bekleyen öneri, zaman aşımı kısaltılınca ÖLMEMELİ ─────────
//
// S0'da onarılan gizli hata buydu: son tarih öneri anında donmasaydı,
// paneldeki bir sürgü hareketi bekleyen öneriyi ANINDA düşürür ve denetim
// izine meşru bir "dustu" yazardı — yani iz yalan söylerdi.

test("S6 KAPISI: panelden süre kısaltmak BEKLEYEN öneriyi düşürmez", () => {
  let saat = 1_000_000;
  const sureTeli = tel(90_000);
  const onay = new OnayKapisi({ zamanAsimiMs: sureTeli, simdi: () => saat });
  const pano = panoKur([onayTanimi(onay, { zamanAsimi: sureTeli })]);

  onay.oner("k1", "git status", "yazım hatası düzeltmesi");
  assert.equal(onay.durum, "bekliyor");

  // Panelden 90 sn -> 10 sn. Teyit zorunlu ve uyarı CANLI olmalı.
  const istek = pano.teyitIste("onay.zaman_asimi", 10_000);
  assert.equal(istek.oldu, false, "teyitsiz yazılmış");
  const t = pano.bekleyenTeyit();
  assert.ok(t, "tehlikeli yazma teyit açmadı");
  assert.match(t.uyari, /ONU ETKİLEMEZ/, "canlı uyarı bekleyen öneriyi söylemiyor");
  assert.equal(pano.teyitliYaz(t.jeton).oldu, true);
  assert.equal(onay.zamanAsimiMs, 10_000, "tel yazılmamış");

  // 10 sn geçir: YENİ süre dolmuş olurdu ama öneri ÖZGÜN son tarihine bağlı.
  saat += 15_000;
  assert.equal(onay.tikle(saat), null, "öneri yeni süreyle erken düşürüldü");
  assert.equal(onay.durum, "bekliyor", "öneri hayatta kalmalıydı");

  // Özgün 90 sn dolunca DÜŞER — ve izde TEK "dustu" olmalı.
  saat += 80_000;
  const dusen = onay.tikle(saat);
  assert.ok(dusen, "özgün süre dolunca düşmeliydi");
  assert.equal(onay.durum, "bos");
  const izdeDusen = onay.gecmis().filter((k) => k.karar === "dustu");
  assert.equal(izdeDusen.length, 1, `izde ${izdeDusen.length} 'dustu' var, 1 olmalı`);
  assert.equal(onay.sayac().onaylanan, 0, "düşen öneri onay sayılmış");
});

test("S6: HAFIZA budaması ayarın YAN ETKİSİ değil, ayrı eylem", () => {
  const kapTeli = tel(300);
  const h = new Hafiza({ kapasite: kapTeli });
  const pano = panoKur([hafizaTanimi(h, { kapasite: kapTeli })]);
  for (let i = 0; i < 40; i++) h.ekle(`ani ${i}`, "olay", 5);
  assert.equal(h.sayi, 40);

  pano.teyitIste("hafiza.kapasite", 25);
  const t = pano.bekleyenTeyit()!;
  assert.match(t.uyari, /40 anı var/, "uyarı canlı sayıyı söylemiyor");
  assert.match(t.uyari, /15 tanesi KALICI/, "uyarı kaç anının gideceğini söylemiyor");

  // Eylem SEÇİLMEDEN: kapasite düşer ama anı SİLİNMEZ (budama tembel).
  assert.equal(pano.teyitliYaz(t.jeton).oldu, true);
  assert.equal(h.kapasite, 25);
  assert.equal(h.sayi, 40, "eylem seçilmeden anı silinmiş");

  // Eylem seçilerek: şimdi silinir.
  assert.equal(h.buda(), 15);
  assert.equal(h.sayi, 25);
});

test("S6: DİKKAT tavanı uyarısı pencereye göre CANLI değişir", () => {
  let saat = 1_000_000;
  const azamiTeli = tel(20);
  const d = new Dikkat({ dakikaBasinaAzami: azamiTeli, simdi: () => saat });
  const pano = panoKur([dikkatTanimi(d, { azami: azamiTeli })]);

  const uyariAl = (yeni: number) => {
    pano.teyitIptal();
    pano.teyitIste("dikkat.azami", yeni);
    return pano.bekleyenTeyit()!.uyari;
  };

  assert.match(uyariAl(10), /pencerede 0 mesaj/, "boş pencerede sayı yanlış");
  // Pencereyi doldur: farklı metinler, yoksa tekrar süzgecine takılır.
  for (let i = 0; i < 12; i++) {
    saat += 5000;
    d.karar({ tur: "duydum", metin: `cumle ${i}`, kesin: true });
  }
  const u = uyariAl(5);
  assert.match(u, /pencerede 12 mesaj/, `uyarı canlı değil: ${u}`);
  assert.match(u, /sn beyne hiçbir şey gitmez/);
  pano.teyitIptal();
});

// ── BEYİN SEÇİCİ: panodan geçiş ──────────────────────────────────────────
//
// `mind/` → `bridge/` bağımlılığı yasak olduğu için gerçek `SecilebilirBeyin`
// burada kullanılamaz; onun sözleşmesini taklit eden küçük bir sahte yeter.
// Gerçek sınıfın davranışı `bridge/secilebilirBeyin.test.ts`te sınanıyor.

function sahteSecim(baslangic = "opencode") {
  const durum = { istenen: baslangic, aktif: baslangic, surer: false };
  return {
    durum,
    secim: {
      istenen: () => durum.istenen,
      iste: (ad: string) => {
        if (durum.surer) return "geçiş sürüyor";
        if (!["opencode", "yerel"].includes(ad)) return `böyle bir beyin yok: ${ad}`;
        durum.istenen = ad; durum.surer = true;
        return "";
      },
      secenekler: () => ["opencode", "yerel"],
      durum: () => durum.surer ? `${durum.aktif} → ${durum.istenen} kontrol` : durum.aktif,
    },
  };
}

test("BEYİN SEÇİMİ panodan teyitle yapılır, doğrudan yazılamaz", () => {
  const { durum, secim } = sahteSecim();
  const p = panoKur([beyinTanimi({
    ad: () => "opencode:ling", kesikSaniye: () => 0, yakinlikKurali: () => true, secim,
  })]);

  // Doğrudan yazma: tehlikeli sınıf, reddedilir.
  assert.match(p.yaz("beyin.model", "yerel").sebep, /teyit/);
  assert.equal(durum.istenen, "opencode");

  p.teyitIste("beyin.model", "yerel");
  const t = p.bekleyenTeyit();
  assert.ok(t, "teyit açılmadı");
  assert.match(t.uyari, /TAŞINMAZ/, "bağlam kaybı uyarısı yok");
  assert.match(t.uyari, /opencode:ling/, "uyarı şu an koşan beyni söylemiyor");

  const s = p.teyitliYaz(t.jeton);
  assert.equal(s.oldu, true, s.sebep);
  assert.equal(durum.istenen, "yerel");
});

test("SEÇİCİ reddederse sebep panoya ulaşır — 'oturmadı' diye yutulmaz", () => {
  const { durum, secim } = sahteSecim();
  durum.surer = true;                                // geçiş sürüyor
  const p = panoKur([beyinTanimi({
    ad: () => "opencode:ling", kesikSaniye: () => 0, yakinlikKurali: () => true, secim,
  })]);
  p.teyitIste("beyin.model", "yerel");
  const s = p.teyitliYaz(p.bekleyenTeyit()!.jeton);
  assert.equal(s.oldu, false);
  assert.match(s.sebep, /geçiş sürüyor/, `asıl sebep kayboldu: ${s.sebep}`);
});

test("SEÇİLEN ile KOŞAN ayrı görünür", () => {
  const { durum, secim } = sahteSecim();
  const p = panoKur([beyinTanimi({
    ad: () => "opencode:ling", kesikSaniye: () => 0, yakinlikKurali: () => true, secim,
  })]);
  secim.iste("yerel");
  const g = Object.fromEntries(p.goruntu()[0]!.dugmeler.map((d) => [d.ad, d]));
  assert.equal(g["beyin.model"]!.deger, "yerel");
  assert.match(String(g["beyin.aktif"]!.deger), /opencode → yerel/);
  assert.deepEqual(g["beyin.model"]!.secenekler, ["opencode", "yerel"]);
  assert.equal(g["beyin.aktif"]!.yazilabilir, false);
  void durum;
});

test("SEÇİCİSİZ kurulumda beyin.model salt okunur kalır (eski davranış)", () => {
  const p = panoKur([beyinTanimi({
    ad: () => "opencode:ling", kesikSaniye: () => 0, yakinlikKurali: () => true,
  })]);
  const d = p.goruntu()[0]!.dugmeler.find((x) => x.ad === "beyin.model")!;
  assert.equal(d.deger, "opencode:ling");
  assert.equal(d.yazilabilir, false);
  assert.match(p.teyitIste("beyin.model", "x").sebep, /yazıcısı yok/);
});
