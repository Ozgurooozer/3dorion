// uygulama/graf/editor/palet.test.ts — düğüm paleti: kütüphaneden KENDİLİĞİNDEN beslenir, arama, PİN UYUMU süzgeci (sürüklenen pine uymayan düğüm
// görünmez), desenler tek tek öğe, grafik türüne uymayan düğüm önerilmez, yeni düğümün ilk ayarı.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { grafDogrula, type Graf } from "../../../protocol/graf.ts";
import { DugumKaydi, type PinOrtami } from "../dugumKaydi.ts";
import { uyumlu } from "../grafTurDenetimi.ts";
import { grafKutuphanesi, yeniDesenSablonu } from "../kutuphane.ts";
import { KATEGORI_SIRASI, paletGrupla, paletOgeleri, paletSuz, yeniDugumAyari } from "./palet.ts";

const KAYIT = grafKutuphanesi();
const SELAMLA = yeniDesenSablonu("selamla");
const ORTAM: PinOrtami = { desen: (ad) => (ad === "selamla" ? SELAMLA : null), buGraf: null, ajanlar: () => ["orion", "flash"] };
const OGELER = paletOgeleri(KAYIT, ORTAM, "olay", ["selamla"]);
const tipler = (l: readonly { tip: string }[]) => l.map((o) => o.tip);

test("palet kütüphanedeki her düğüm türünü listeler (desen.cagir hariç: o desen başına öğedir; olay grafiğinde fonksiyon giriş/dönüşü yok)", () => {
  const beklenen = KAYIT.hepsi().map((t) => t.tip).filter((t) => !["desen.cagir", "fonksiyon.giris", "fonksiyon.donus"].includes(t)).sort();
  assert.deepEqual(tipler(OGELER).filter((t) => t !== "desen.cagir").sort(), beklenen);
});

test("yeni kayıt KENDİLİĞİNDEN görünür: kütüphaneye eklenen türü palet ayrı liste yazılmadan listeler", () => {
  const k = new DugumKaydi<unknown>();
  k.kaydet({ tip: "yeni.tur", ad: "Yeni şey", kategori: "ajan", saf: false, aciklama: "deneme", pinler: () => ({ girisler: [], cikislar: [] }), calistir: () => ({}) });
  assert.deepEqual(tipler(paletOgeleri(k, ORTAM, "olay", [])), ["yeni.tur"]);
});

test("her desen ayrı öğedir, ayarı dolu ve pinleri desenin pinleri", () => {
  const o = OGELER.find((x) => x.anahtar === "desen.cagir:selamla");
  assert.deepEqual([o?.ayar, o?.pinler?.girisler.map((p) => p.ad)], [{ desen: "selamla" }, ["giris", "kim"]]);
});

test("desen kendini önermez (desen kendini çağıramaz)", () => {
  const l = paletOgeleri(KAYIT, ORTAM, "fonksiyon", ["selamla"], "selamla");
  assert.equal(l.some((o) => o.anahtar === "desen.cagir:selamla"), false);
});

test("desen grafiğinde ▶ Başla ve dünya olayları önerilmez, Fonksiyon girişi önerilir", () => {
  const l = tipler(paletOgeleri(KAYIT, ORTAM, "fonksiyon", []));
  assert.deepEqual([l.includes("olay.basla"), l.includes("olay.ozyn_yaklasti"), l.includes("fonksiyon.giris")], [false, false, true]);
});

test("arama: bütün sözcükler ad/tür/açıklamada geçmeli; Türkçe büyük-küçük harf duyarsız", () => {
  assert.deepEqual(tipler(paletSuz(OGELER, { arama: "DEĞİŞKEN oku" })), ["degisken.oku"]);
});

test("PİN UYUMU: sayı ÇIKIŞINDAN sürüklenince listedeki her öğenin uyumlu bir GİRİŞİ var", () => {
  const l = paletSuz(OGELER, { pin: { yon: "cikis", tip: "sayi" } });
  const uymayan = l.filter((o) => !o.pinler!.girisler.some((p) => uyumlu("sayi", p.tip))).map((o) => o.tip);
  assert.deepEqual(uymayan, []);
});

test("PİN UYUMU: akış çıkışından sürüklenince saf düğüm (Sayı) görünmez, Bekle görünür", () => {
  const l = tipler(paletSuz(OGELER, { pin: { yon: "cikis", tip: "akis" } }));
  assert.deepEqual([l.includes("veri.sayi"), l.includes("akis.bekle")], [false, true]);
});

test("PİN UYUMU: bool GİRİŞİNE (Eğer.koşul) sürüklenince bool çıkışlı düğümler: Gün vakti var, Metin birleştir yok", () => {
  const l = tipler(paletSuz(OGELER, { pin: { yon: "giris", tip: "bool" } }));
  assert.deepEqual([l.includes("saat.gun_vakti"), l.includes("metin.birlestir")], [true, false]);
});

test("ilk ayar: değişken düğümü örnek adla gelir (pinleri çözülür)", () => {
  const r = yeniDugumAyari(KAYIT.al("degisken.oku")!, ORTAM);
  assert.deepEqual([r.ayar, r.pinler?.cikislar.map((p) => p.tip)], [{ ad: "sayac" }, ["sayi"]]);
});

test("ilk ayar: zorunlu seçenekli ayar (Ajan seç) ilk seçenekle dolar", () => {
  assert.deepEqual(yeniDugumAyari(KAYIT.al("ajan.sec")!, ORTAM).ayar, { ajan: "orion" });
});

test("gruplar kategori sırasıyla ve boş grup yok", () => {
  const dolu = KATEGORI_SIRASI.filter((k) => OGELER.some((o) => o.kategori === k));
  assert.deepEqual(paletGrupla(OGELER).map((g) => g.kategori), dolu);
});

test("dünya değişkenleri 'Dünya değişkenleri' grubunda: Saat, Konum, Ajan durumu, Ozyn durumu, Ozyn'e mesafe, En yakın nesne", () => {
  const dunya = paletGrupla(OGELER).find((g) => g.kategori === "dunya")!;
  assert.deepEqual(dunya.ogeler.map((o) => o.tip).sort(), ["ajan.durum", "nesne.en_yakin", "ozyn.durum", "ozyn.mesafe", "saat.simdi", "veri.konum"]);
});

test("palet öğesinin ilk ayarıyla eklenen düğüm biçimden geçer (her öğe)", () => {
  const bozuk = OGELER.filter((o) => !grafDogrula({ surum: 1, ad: "x", tur: "olay", dugumler: [{ id: "n", tip: o.tip, ayar: o.ayar }], baglar: [] } satisfies Partial<Graf>).ok);
  assert.deepEqual(bozuk.map((o) => o.tip), []);
});
