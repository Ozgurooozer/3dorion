// uygulama/graf/yorumlayici.test.ts — grafik yorumlayıcısı ve tür denetimi: akış, veri, tekrar, eğer, bekle, desen (alt-grafik), durdurma, tavanlar.
//
// Dünya sahte: `test.yaz` düğümü girdisini yeteneğin günlüğüne yazar (ajan eylemlerinin yerine). Böylece "ne sırayla ne yapıldı" tek bir dizide görünür.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { grafDogrula, type Graf, type GrafBagi, type GrafDugumu } from "../../protocol/graf.ts";
import { AKIS_GIRIS, AKIS_SONRA, DugumKaydi } from "./dugumKaydi.ts";
import { cekirdekDugumler } from "./cekirdekDugumler.ts";
import { grafTurDenetle } from "./grafTurDenetimi.ts";
import { grafCalistir, type CalismaOlayi } from "./yorumlayici.ts";

interface SahteYetenek { gunluk: string[] }

function kayit(): DugumKaydi<SahteYetenek> {
  const k = new DugumKaydi<SahteYetenek>();
  for (const t of cekirdekDugumler<SahteYetenek>()) k.kaydet(t);
  k.kaydet({
    tip: "test.yaz", ad: "Yaz", kategori: "ajan", saf: false, aciklama: "günlüğe yazar",
    pinler: () => ({ girisler: [AKIS_GIRIS, { ad: "metin", tip: "herhangi" }], cikislar: [AKIS_SONRA] }),
    calistir: async (c) => { c.yetenek.gunluk.push(String(await c.giris("metin"))); return { sonra: "sonra" }; },
  });
  k.kaydet({
    tip: "test.patla", ad: "Patla", kategori: "ajan", saf: false, aciklama: "hata fırlatır",
    pinler: () => ({ girisler: [AKIS_GIRIS], cikislar: [AKIS_SONRA] }),
    calistir: () => { throw new Error("bilerek bozuk"); },
  });
  return k;
}

const graf = (dugumler: GrafDugumu[], baglar: [string, string, string, string][], ek: Partial<Graf> = {}): Graf => {
  const r = grafDogrula({ surum: 1, ad: "deneme", tur: "olay", dugumler, ...ek, baglar: baglar.map(([a, b, c, d]): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] })) });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
const yaz = (id: string, metin: string): GrafDugumu => ({ id, tip: "test.yaz", ayar: { metin } });
const basla: GrafDugumu = { id: "b", tip: "olay.basla" };

async function kos(g: Graf, desenler: Graf[] = [], ek: { sinir?: { adim?: number; sureMs?: number; derinlik?: number }; olay?: (o: CalismaOlayi) => void; uyu?: (ms: number) => Promise<void> } = {}) {
  const y: SahteYetenek = { gunluk: [] };
  const c = grafCalistir(g, { kayit: kayit(), desen: (ad) => desenler.find((d) => d.ad === ad) ?? null, yetenek: y, uyu: ek.uyu ?? (async () => {}), ...ek });
  return { sonuc: await c.sonuc, gunluk: y.gunluk };
}

// ── akış ──
test("Başla → Yaz → Yaz: sırayla yürür ve 'bitti' döner", async () => {
  const r = await kos(graf([basla, yaz("a", "bir"), yaz("c", "iki")], [["b", "sonra", "a", "giris"], ["a", "sonra", "c", "giris"]]));
  assert.deepEqual([r.sonuc.durum, r.gunluk], ["bitti", ["bir", "iki"]]);
});

test("bağsız akış çıkışında dal biter (sessiz değil: sonuç 'bitti', yapılan kadarı yapılmış)", async () => {
  const r = await kos(graf([basla, yaz("a", "bir"), yaz("c", "kopuk")], [["b", "sonra", "a", "giris"]]));
  assert.deepEqual(r.gunluk, ["bir"]);
});

test("Sıra: 0, 1, 2 dalları sırayla, her biri bitince öteki", async () => {
  const r = await kos(graf([basla, { id: "s", tip: "akis.sira", ayar: { cikis: 3 } }, yaz("x", "0"), yaz("y", "1"), yaz("z", "2")],
    [["b", "sonra", "s", "giris"], ["s", "0", "x", "giris"], ["s", "1", "y", "giris"], ["s", "2", "z", "giris"]]));
  assert.deepEqual(r.gunluk, ["0", "1", "2"]);
});

test("Tekrar: gövde n kez, 'indeks' veri pini her turda 0'dan artar; sonra 'bitti'", async () => {
  const r = await kos(graf([basla, { id: "t", tip: "akis.tekrar", ayar: { sayi: 3 } }, { id: "g", tip: "test.yaz" }, yaz("son", "bitti")],
    [["b", "sonra", "t", "giris"], ["t", "govde", "g", "giris"], ["t", "indeks", "g", "metin"], ["t", "bitti", "son", "giris"]]));
  assert.deepEqual(r.gunluk, ["0", "1", "2", "bitti"]);
});

test("Eğer: koşul saf düğümden (Karşılaştır 2 < 5) okunur, doğru dal yürür", async () => {
  const r = await kos(graf([basla, { id: "e", tip: "akis.eger" }, { id: "k", tip: "veri.karsilastir", ayar: { a: 2, b: 5, islem: "<" } }, yaz("d", "doğru"), yaz("y", "yanlış")],
    [["b", "sonra", "e", "giris"], ["k", "sonuc", "e", "kosul"], ["e", "dogru", "d", "giris"], ["e", "yanlis", "y", "giris"]]));
  assert.deepEqual(r.gunluk, ["doğru"]);
});

test("bağsız veri girişi ayardan okunur; saf düğüm (Metin) bağdan", async () => {
  const r = await kos(graf([basla, { id: "a", tip: "test.yaz" }, { id: "m", tip: "veri.metin", ayar: { deger: "bağdan" } }],
    [["b", "sonra", "a", "giris"], ["m", "deger", "a", "metin"]]));
  assert.deepEqual(r.gunluk, ["bağdan"]);
});

// ── desen (alt-grafik) ──
const desen = (): Graf => graf(
  [{ id: "g", tip: "fonksiyon.giris" }, { id: "y", tip: "test.yaz" }, { id: "d", tip: "fonksiyon.donus" }, { id: "m", tip: "veri.metin", ayar: { deger: "tamam" } }],
  [["g", "sonra", "y", "giris"], ["g", "kim", "y", "metin"], ["y", "sonra", "d", "giris"], ["m", "deger", "d", "sonuc"]],
  { ad: "selamla", tur: "fonksiyon", girisler: [{ ad: "kim", tip: "metin" }], cikislar: [{ ad: "sonuc", tip: "metin" }] });

test("DESEN: kaydedilmiş alt-grafik tek düğüm olarak çağrılır; girişi alır, çıktısı sonraki düğüme gider", async () => {
  const r = await kos(graf([basla, { id: "c", tip: "desen.cagir", ayar: { desen: "selamla", kim: "Flash" } }, { id: "y", tip: "test.yaz" }],
    [["b", "sonra", "c", "giris"], ["c", "sonra", "y", "giris"], ["c", "sonuc", "y", "metin"]]), [desen()]);
  assert.deepEqual([r.sonuc.durum, r.gunluk], ["bitti", ["Flash", "tamam"]]);
});

test("DESEN aynı grafikte iki kez kullanılabilir (yeniden kullanım: 'x'i al'ı her seferinde yazmamak)", async () => {
  const r = await kos(graf([basla, { id: "c1", tip: "desen.cagir", ayar: { desen: "selamla", kim: "Orion" } }, { id: "c2", tip: "desen.cagir", ayar: { desen: "selamla", kim: "Flash" } }],
    [["b", "sonra", "c1", "giris"], ["c1", "sonra", "c2", "giris"]]), [desen()]);
  assert.deepEqual(r.gunluk, ["Orion", "Flash"]);
});

test("desen tek başına çalışmaz (yalnız çağrılır): nedenle hata", async () => {
  const r = await kos(desen());
  assert.match(r.sonuc.hata ?? "", /desen/);
});

test("desen derinlik tavanı: birbirini çağıran desenler sonsuza gitmez, nedenle durur", async () => {
  const ping = graf([{ id: "g", tip: "fonksiyon.giris" }, { id: "c", tip: "desen.cagir", ayar: { desen: "pong" } }], [["g", "sonra", "c", "giris"]], { ad: "ping", tur: "fonksiyon" });
  const pong = graf([{ id: "g", tip: "fonksiyon.giris" }, { id: "c", tip: "desen.cagir", ayar: { desen: "ping" } }], [["g", "sonra", "c", "giris"]], { ad: "pong", tur: "fonksiyon" });
  const r = await kos(graf([basla, { id: "c", tip: "desen.cagir", ayar: { desen: "ping" } }], [["b", "sonra", "c", "giris"]]), [ping, pong]);
  assert.match(r.sonuc.hata ?? "", /derinlik tavanı/);
});

// ── güvence ──
test("tür denetimi çalışmadan ÖNCE: hatalı grafik HİÇ başlamaz (ilk düğüm bile yürümez)", async () => {
  const r = await kos(graf([basla, yaz("a", "olmamalı"), { id: "m", tip: "veri.sayi" }, { id: "e", tip: "akis.eger" }],
    [["b", "sonra", "a", "giris"], ["a", "sonra", "e", "giris"], ["m", "deger", "e", "kosul"]]));
  assert.deepEqual([r.sonuc.durum, r.gunluk], ["hata", []]);
});

test("düğüm hatası: hangi düğümde olduğu söylenir, sonrası yürümez", async () => {
  const r = await kos(graf([basla, { id: "p", tip: "test.patla" }, yaz("a", "olmamalı")], [["b", "sonra", "p", "giris"], ["p", "sonra", "a", "giris"]]));
  assert.deepEqual([r.sonuc.durum, r.sonuc.hataDugumu, r.gunluk], ["hata", "p", []]);
});

test("adım tavanı: çok uzun grafik nedenle durur", async () => {
  const r = await kos(graf([basla, { id: "t", tip: "akis.tekrar", ayar: { sayi: 50 } }, yaz("g", "x")], [["b", "sonra", "t", "giris"], ["t", "govde", "g", "giris"]]), [], { sinir: { adim: 20 } });
  assert.match(r.sonuc.hata ?? "", /adım tavanı/);
});

// Zaman aşımı ŞART: Durdur bozulursa bekleme hiç bitmez; test kırmızı yanmak yerine sonsuza dek asılı kalırdı (bozma denemesinde görüldü).
test("■ DURDUR: bekleme sırasında basılınca bekleme kesilir, sonraki düğüm yürümez, sonuç 'durdu'", { timeout: 2000 }, async () => {
  const y: SahteYetenek = { gunluk: [] };
  let uyandir: () => void = () => {};
  const c = grafCalistir(graf([basla, yaz("a", "önce"), { id: "w", tip: "akis.bekle", ayar: { ms: 5000 } }, yaz("z", "sonra")],
    [["b", "sonra", "a", "giris"], ["a", "sonra", "w", "giris"], ["w", "sonra", "z", "giris"]]),
  { kayit: kayit(), desen: () => null, yetenek: y, uyu: () => new Promise<void>((r) => { uyandir = r; }) });
  await new Promise((r) => setTimeout(r, 5));
  c.durdur();
  const s = await c.sonuc;
  uyandir();
  assert.deepEqual([s.durum, y.gunluk], ["durdu", ["önce"]]);
});

test("olaylar: her düğüm başlarken 'dugum' olayı yayılır (editördeki aktif düğüm vurgusu), sonunda 'bitti'", async () => {
  const olaylar: string[] = [];
  await kos(graf([basla, yaz("a", "x")], [["b", "sonra", "a", "giris"]]), [], { olay: (o) => olaylar.push(o.tur === "dugum" ? o.id : o.tur) });
  assert.deepEqual(olaylar, ["b", "a", "bitti"]);
});

// ── tür denetimi (Kontrol et) ──
const denetle = (g: Graf, desenler: Graf[] = []) => grafTurDenetle(g, kayit(), { desen: (ad) => desenler.find((d) => d.ad === ad) ?? null, buGraf: null });

test("denetim: bilinmeyen düğüm türü", () => {
  assert.match(denetle(graf([basla, { id: "x", tip: "uydurma.dugum" }], [])).join(), /bilinmeyen düğüm türü/);
});

test("denetim: olmayan pin, hangi pinlerin olduğunu söyler", () => {
  assert.match(denetle(graf([basla, yaz("a", "x")], [["b", "yok", "a", "giris"]])).join(), /'yok' adlı ÇIKIŞ pini yok \(çıkışlar: sonra\)/);
});

test("denetim: tür uyuşmazlığı (sayı → bool)", () => {
  assert.match(denetle(graf([basla, { id: "e", tip: "akis.eger" }, { id: "m", tip: "veri.sayi" }], [["b", "sonra", "e", "giris"], ["m", "deger", "e", "kosul"]])).join(), /tür uyuşmuyor/);
});

test("denetim: akış çıkışından iki bağ (dallanma Sıra ile)", () => {
  assert.match(denetle(graf([basla, yaz("a", "1"), yaz("c", "2")], [["b", "sonra", "a", "giris"], ["b", "sonra", "c", "giris"]])).join(), /Sıra/);
});

test("denetim: akış döngüsü (tekrar Tekrar düğümüyle olmalı)", () => {
  assert.match(denetle(graf([basla, yaz("a", "1"), yaz("c", "2")], [["b", "sonra", "a", "giris"], ["a", "sonra", "c", "giris"], ["c", "sonra", "a", "giris"]])).join(), /akış döngüsü/);
});

test("denetim: bağsız ve ayarsız veri girişi", () => {
  assert.match(denetle(graf([basla, { id: "a", tip: "test.yaz" }], [["b", "sonra", "a", "giris"]])).join(), /a\.metin: bağlı değil/);
});

test("denetim: ayar aralık dışı (Tekrar 500)", () => {
  assert.match(denetle(graf([basla, { id: "t", tip: "akis.tekrar", ayar: { sayi: 500 } }], [["b", "sonra", "t", "giris"]])).join(), /aralık dışı/);
});

test("denetim: olay grafiğinde Başla yoksa", () => {
  assert.match(denetle(graf([yaz("a", "x")], [])).join(), /tam bir '▶ Başla'/);
});

test("denetim: olmayan desen çağrısı nedenle", () => {
  assert.match(denetle(graf([basla, { id: "c", tip: "desen.cagir", ayar: { desen: "yok" } }], [["b", "sonra", "c", "giris"]])).join(), /'yok' adlı desen yok/);
});

test("denetim: geçerli grafikte hata listesi BOŞ", () => {
  assert.deepEqual(denetle(graf([basla, yaz("a", "x")], [["b", "sonra", "a", "giris"]])), []);
});
