// uygulama/graf/durumDugumleri.test.ts — değişkenler (oku/yaz/artır, tür, tavanlar, ad alanı), Ve/Veya/Değil, Gün vakti, Metin birleştir (spec 35 dilim 2).
//
// Dünya sahte: `test.yaz` düğümü girdisini günlüğe yazar (yorumlayici.test.ts ile aynı yöntem): "hangi dal yürüdü, ne söylendi" tek dizide görünür.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { grafDogrula, type Graf, type GrafBagi, type GrafDugumu } from "../../protocol/graf.ts";
import { gununVakti } from "../../mind/zaman.ts";
import { AKIS_GIRIS, AKIS_SONRA, DugumKaydi } from "./dugumKaydi.ts";
import { cekirdekDugumler } from "./cekirdekDugumler.ts";
import { durumDugumleri, gunVaktiAdi } from "./durumDugumleri.ts";
import { DEGISKEN_AZAMI, DEGISKEN_METIN_AZAMI, DURUM_ALANI_AZAMI, GrafDurumDeposu } from "./grafDurumu.ts";
import { grafTurDenetle } from "./grafTurDenetimi.ts";
import { grafCalistir } from "./yorumlayici.ts";

interface Sahte { gunluk: string[] }
function kayit(): DugumKaydi<Sahte> {
  const k = new DugumKaydi<Sahte>();
  for (const t of cekirdekDugumler<Sahte>()) k.kaydet(t);
  for (const t of durumDugumleri<Sahte>()) k.kaydet(t);
  k.kaydet({
    tip: "test.yaz", ad: "Yaz", kategori: "ajan", saf: false, aciklama: "günlüğe yazar",
    pinler: () => ({ girisler: [AKIS_GIRIS, { ad: "metin", tip: "herhangi" }], cikislar: [AKIS_SONRA] }),
    calistir: async (c) => { c.yetenek.gunluk.push(String(await c.giris("metin"))); return { sonra: "sonra" }; },
  });
  return k;
}
const graf = (dugumler: GrafDugumu[], baglar: [string, string, string, string][], ek: Partial<Graf> = {}): Graf => {
  const r = grafDogrula({ surum: 1, ad: "deneme", tur: "olay", dugumler, ...ek, baglar: baglar.map(([a, b, c, d]): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] })) });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
const basla: GrafDugumu = { id: "b", tip: "olay.basla" };
const yaz = (id: string, metin?: string): GrafDugumu => ({ id, tip: "test.yaz", ...(metin !== undefined ? { ayar: { metin } } : {}) });
const denetle = (g: Graf) => grafTurDenetle(g, kayit(), { desen: () => null, buGraf: null });

async function kos(g: Graf, ek: { depo?: GrafDurumDeposu; saat?: number; desenler?: Graf[]; alansiz?: boolean } = {}) {
  const y: Sahte = { gunluk: [] };
  const depo = ek.depo ?? new GrafDurumDeposu();
  const c = grafCalistir(g, {
    kayit: kayit(), desen: (ad) => ek.desenler?.find((d) => d.ad === ad) ?? null, yetenek: y, uyu: async () => {},
    ...(ek.alansiz ? {} : { degiskenler: depo.alan(g.ad) }), saat: () => ek.saat ?? 10,
  });
  return { sonuc: await c.sonuc, gunluk: y.gunluk, depo };
}

/** Başla → artır(ziyaret) → yaz(ziyaret'in yeni değeri). */
const sayac = () => graf([basla, { id: "a", tip: "degisken.artir", ayar: { ad: "ziyaret" } }, yaz("y")],
  [["b", "sonra", "a", "giris"], ["a", "sonra", "y", "giris"], ["a", "deger", "y", "metin"]]);

// ── değişkenler ──
test("Artır: hiç yazılmamış sayaç 0'dan başlar, her çalışmada bir artar; alan çalışmalar arasında KALIR", async () => {
  const depo = new GrafDurumDeposu();
  const g = sayac();
  const bir = await kos(g, { depo });
  const iki = await kos(g, { depo });
  assert.deepEqual([bir.gunluk, iki.gunluk, depo.ozet("deneme")], [["1"], ["2"], { ziyaret: 2 }]);
});

test("Yaz → Oku: aynı çalışmada yazılanı okur (metin ve doğru/yanlış)", async () => {
  const g = graf([basla, { id: "w", tip: "degisken.yaz", ayar: { ad: "parola", tip: "metin", deger: "Ay ışığı" } },
    { id: "o", tip: "degisken.oku", ayar: { ad: "parola", tip: "metin" } }, yaz("y")],
  [["b", "sonra", "w", "giris"], ["w", "sonra", "y", "giris"], ["o", "deger", "y", "metin"]]);
  assert.deepEqual((await kos(g)).gunluk, ["Ay ışığı"]);
});

test("Oku: hiç yazılmamış değişken türünün sıfırı (sayı 0, metin \"\", bool false)", async () => {
  const g = graf([basla, { id: "s", tip: "akis.sira", ayar: { cikis: 3 } }, yaz("y1"), yaz("y2"), yaz("y3"),
    { id: "o1", tip: "degisken.oku", ayar: { ad: "a", tip: "sayi" } }, { id: "o2", tip: "degisken.oku", ayar: { ad: "b", tip: "metin" } }, { id: "o3", tip: "degisken.oku", ayar: { ad: "c", tip: "bool" } }],
  [["b", "sonra", "s", "giris"], ["s", "0", "y1", "giris"], ["s", "1", "y2", "giris"], ["s", "2", "y3", "giris"], ["o1", "deger", "y1", "metin"], ["o2", "deger", "y2", "metin"], ["o3", "deger", "y3", "metin"]]);
  assert.deepEqual((await kos(g)).gunluk, ["0", "", "false"]);
});

test("başka türle yazılmış değişkeni okumak HATA (sessiz dönüşüm yok), hangi düğüm olduğu döner", async () => {
  const depo = new GrafDurumDeposu();
  depo.alan("deneme").yaz("ziyaret", "çok");
  const r = await kos(sayac(), { depo });
  assert.deepEqual([r.sonuc.durum, r.sonuc.hataDugumu, /'ziyaret' sayı değil/.test(r.sonuc.hata ?? "")], ["hata", "a", true]);
});

test("Eğer'e bağlanan Oku'nun türü denetimde: metin değişkeni bool girişe bağlanamaz", () => {
  const g = graf([basla, { id: "o", tip: "degisken.oku", ayar: { ad: "x", tip: "metin" } }, { id: "e", tip: "akis.eger" }], [["b", "sonra", "e", "giris"], ["o", "deger", "e", "kosul"]]);
  assert.match(denetle(g).join(), /tür uyuşmuyor/);
});

test("denetim: ad yok / geçersiz ad / yanlış türde ayar.deger", () => {
  const h = (d: GrafDugumu) => denetle(graf([basla, d], [["b", "sonra", d.id, "giris"]])).join();
  assert.match(h({ id: "w", tip: "degisken.yaz", ayar: { deger: 1 } }), /değişken adı verilmedi/);
  assert.match(h({ id: "w", tip: "degisken.yaz", ayar: { ad: "iki kelime", deger: 1 } }), /değişken adı geçersiz/);
  assert.match(h({ id: "w", tip: "degisken.yaz", ayar: { ad: "x", tip: "sayi", deger: "bir" } }), /deger: sayı olmalı/);
});

test("ad alanı GRAFİK BAŞINA: başka adlı grafik aynı değişkeni görmez", async () => {
  const depo = new GrafDurumDeposu();
  await kos(sayac(), { depo });
  const baska = await kos(graf(sayac().dugumler, sayac().baglar.map((b) => [b.kaynak[0], b.kaynak[1], b.hedef[0], b.hedef[1]]), { ad: "barmen" }), { depo });
  assert.deepEqual([baska.gunluk, depo.ozet("deneme"), depo.ozet("barmen")], [["1"], { ziyaret: 1 }, { ziyaret: 1 }]);
});

test("desen çağıranın alanını görür (desen fonksiyondur)", async () => {
  const depo = new GrafDurumDeposu();
  const desen = graf([{ id: "g", tip: "fonksiyon.giris" }, { id: "a", tip: "degisken.artir", ayar: { ad: "n" } }, { id: "d", tip: "fonksiyon.donus" }],
    [["g", "sonra", "a", "giris"], ["a", "sonra", "d", "giris"]], { ad: "say", tur: "fonksiyon" });
  const g = graf([basla, { id: "c", tip: "desen.cagir", ayar: { desen: "say" } }], [["b", "sonra", "c", "giris"]]);
  await kos(g, { depo, desenler: [desen] });
  assert.deepEqual([depo.ozet("deneme"), depo.ozet("say")], [{ n: 1 }, {}]);
});

test("değişken alanı verilmeyen çalışma: değişken düğümü nedenle düşer", async () => {
  const r = await kos(sayac(), { alansiz: true });
  assert.match(r.sonuc.hata ?? "", /değişken alanı yok/);
});

test("tavan: grafik başına DEGISKEN_AZAMI ad; aşan yazma düşer, var olanı güncellemek serbest", () => {
  const a = new GrafDurumDeposu().alan("g");
  for (let i = 0; i < DEGISKEN_AZAMI; i++) a.yaz(`d${i}`, i);
  assert.throws(() => a.yaz("fazla", 1), new RegExp(`en çok ${DEGISKEN_AZAMI} değişken`));
  a.yaz("d0", 99);
  assert.equal(a.oku("d0"), 99);
});

test("tavan: metin uzunluğu, sonsuz sayı, null", () => {
  const a = new GrafDurumDeposu().alan("g");
  assert.throws(() => a.yaz("m", "x".repeat(DEGISKEN_METIN_AZAMI + 1)), /en çok 200 karakter/);
  assert.throws(() => a.yaz("s", Infinity), /sonlu/);
  assert.throws(() => a.yaz("n", null), /yalnız sayı, metin/);
});

test("tavan: en çok DURUM_ALANI_AZAMI grafiğin alanı; okumak alan açmaz; sıfırla alanı boşaltır", () => {
  const d = new GrafDurumDeposu();
  for (let i = 0; i < DURUM_ALANI_AZAMI; i++) d.alan(`g${i}`).yaz("x", 1);
  assert.equal(d.alan("yeni").oku("x"), undefined);
  assert.throws(() => d.alan("yeni").yaz("x", 1), /grafiğin durumu tutulur/);
  assert.equal(d.sifirla("g0"), true);
  d.alan("yeni").yaz("x", 1);
  assert.deepEqual(d.ozet("yeni"), { x: 1 });
});

// ── mantık + Eğer + Karşılaştır ──
test("Ve / Veya / Değil Eğer'le: (ziyaret > 1) VE DEĞİL(gece) doğru dalı seçer", async () => {
  const depo = new GrafDurumDeposu();
  depo.alan("deneme").yaz("ziyaret", 2);
  const g = graf([basla,
    { id: "o", tip: "degisken.oku", ayar: { ad: "ziyaret" } }, { id: "bir", tip: "veri.sayi", ayar: { deger: 1 } },
    { id: "k", tip: "veri.karsilastir", ayar: { islem: ">" } }, { id: "v", tip: "saat.gun_vakti", ayar: { vakit: "gece" } },
    { id: "d", tip: "mantik.degil" }, { id: "ve", tip: "mantik.ve" }, { id: "e", tip: "akis.eger" }, yaz("evet", "tekrar gelen, gündüz"), yaz("hayir", "değil")],
  [["b", "sonra", "e", "giris"], ["o", "deger", "k", "a"], ["bir", "deger", "k", "b"], ["v", "sonuc", "d", "a"], ["k", "sonuc", "ve", "a"], ["d", "sonuc", "ve", "b"],
    ["ve", "sonuc", "e", "kosul"], ["e", "dogru", "evet", "giris"], ["e", "yanlis", "hayir", "giris"]]);
  assert.deepEqual((await kos(g, { depo, saat: 10 })).gunluk, ["tekrar gelen, gündüz"]);
  assert.deepEqual((await kos(g, { depo, saat: 23 })).gunluk, ["değil"]);
});

test("Veya: biri doğruysa doğru; bool olmayan giriş HATA (kısa devre bozuk girişi gizlemez)", async () => {
  const ornek = (a: boolean, b: boolean | string) => graf([basla, { id: "a", tip: "veri.bool", ayar: { deger: a } },
    typeof b === "boolean" ? { id: "bb", tip: "veri.bool", ayar: { deger: b } } : { id: "bb", tip: "veri.metin", ayar: { deger: b } },
    { id: "v", tip: "mantik.veya" }, { id: "e", tip: "akis.eger" }, yaz("d", "D"), yaz("y", "Y")],
  [["b", "sonra", "e", "giris"], ["a", "deger", "v", "a"], ["bb", "deger", "v", "b"], ["v", "sonuc", "e", "kosul"], ["e", "dogru", "d", "giris"], ["e", "yanlis", "y", "giris"]]);
  assert.deepEqual([(await kos(ornek(false, true))).gunluk, (await kos(ornek(false, false))).gunluk], [["D"], ["Y"]]);
  // metin → bool girişi denetimde yakalanır (tür); denetimi atlayıp çalışma anı savunmasını görmek için doğrudan çalıştırılamaz: denetim önce gelir.
  assert.match(denetle(ornek(true, "evet")).join(), /tür uyuşmuyor/);
});

// ── gün vakti ──
test("gunVaktiAdi: mind/zaman.ts gununVakti sınırlarıyla (05 sabah, 12 öğle, 17 akşam, 21 gece, 03 gece)", () => {
  assert.deepEqual([3, 4.99, 5, 11.9, 12, 16.9, 17, 20.9, 21, 23.9].map(gunVaktiAdi), ["gece", "gece", "sabah", "sabah", "ogle", "ogle", "aksam", "aksam", "gece", "gece"]);
});

test("BEKÇİ: gununVakti'nin bütün sözleri eşlenmiş (yeni bir söz gelirse burası kırmızı, gece'ye sessizce düşmez)", () => {
  const sozler = new Set(Array.from({ length: 24 * 4 }, (_, i) => gununVakti(i / 4)));
  assert.deepEqual([...sozler].sort(), ["afternoon", "evening", "morning", "night", "the middle of the night"]);
  for (let i = 0; i < 24 * 4; i++) assert.doesNotThrow(() => gunVaktiAdi(i / 4));
});

test("Gün vakti düğümü: 'vakit' çıkışı Söyle'ye gider, 'sonuc' sorulan vakit mi", async () => {
  const g = graf([basla, { id: "v", tip: "saat.gun_vakti", ayar: { vakit: "aksam" } }, yaz("y1"), yaz("y2")],
    [["b", "sonra", "y1", "giris"], ["y1", "sonra", "y2", "giris"], ["v", "vakit", "y1", "metin"], ["v", "sonuc", "y2", "metin"]]);
  assert.deepEqual((await kos(g, { saat: 18 })).gunluk, ["aksam", "true"]);
  assert.match(denetle(graf([basla, { id: "v", tip: "saat.gun_vakti", ayar: { vakit: "ikindi" } }], [])).join(), /'ikindi' geçersiz/);
});

// ── metin ──
test("Metin birleştir: \"Ziyaret: \" + sayaç", async () => {
  const g = graf([basla, { id: "a", tip: "degisken.artir", ayar: { ad: "z" } }, { id: "m", tip: "metin.birlestir", ayar: { a: "Ziyaret: " } }, yaz("y")],
    [["b", "sonra", "a", "giris"], ["a", "sonra", "y", "giris"], ["a", "deger", "m", "b"], ["m", "metin", "y", "metin"]]);
  assert.deepEqual((await kos(g)).gunluk, ["Ziyaret: 1"]);
});
