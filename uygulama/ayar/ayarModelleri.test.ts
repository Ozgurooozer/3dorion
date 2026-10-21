// uygulama/ayar/ayarModelleri.test.ts — Ayar paneli bölümlerinin saf mantığı (spec 34): pano satırı (yazım türü + neden), sayı adımı/girdisi,
// beyin listesi (M seçiciyle aynı gruplar), ses satırları (kilit, indirme sırası, silme), kilitli içgüdüler, açılış yetki anahtarları.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { panoKur, tel, type Dugme } from "../../protocol/pano.ts";
import { beyinGorunumu, boyutMetni, kilitliIcguduler, panoSatirlari, sayiAdimi, sayiOku, sesSatirlari } from "./ayarModelleri.ts";
import type { ModelKarti, SeciciDurumu } from "../../world/arayuz/modelSeciciCekirdek.ts";
import type { SesDurumu, SesSatiri } from "../../host/kopru.ts";
import { ICGUDULER } from "../../mind/icgudu.ts";
import { yetkiAnahtarlari } from "../kopruKur.ts";

// ── pano satırları ──
function pano() {
  const guvenli = tel<number>(100), tehlikeli = tel<number>(20), anahtar = tel<boolean>(true);
  const dugmeler: Dugme[] = [
    { ad: "a.guvenli", etiket: "güvenli", sinif: "guvenli", etki: "aninda", aralik: { en: 10, cok: 200 }, adim: 10, oku: guvenli, yaz: (d) => guvenli.yaz(d as number), aciklama: "g" },
    { ad: "a.tehlikeli", etiket: "tehlikeli", sinif: "tehlikeli", etki: "aninda", oku: tehlikeli, yaz: (d) => tehlikeli.yaz(d as number), uyari: () => "dikkat", aciklama: "t" },
    { ad: "a.olculmus", etiket: "ölçülmüş", sinif: "olculmus", etki: "aninda", kaynak: "ölçüm", oku: () => 5, aciklama: "o" },
    { ad: "a.sabit", etiket: "sabit", sinif: "sabit", etki: "aninda", oku: () => true, aciklama: "s" },
    { ad: "a.anahtar", etiket: "anahtar", sinif: "guvenli", etki: "sonraki_tur", oku: anahtar, yaz: (d) => anahtar.yaz(d === true), aciklama: "k" },
  ];
  return panoKur([{ ad: "a", etiket: "A", dugum: "a", dugmeler }]);
}

test("pano satırı: güvenli düğme serbest yazılır, aralığı ve adımı taşır", () => {
  const [s] = panoSatirlari(pano(), ["a.guvenli"]);
  assert.deepEqual([s!.yazim, s!.aralik, s!.adim], ["serbest", { en: 10, cok: 200 }, 10]);
});

test("pano satırı: tehlikeli düğme iki aşamalı TEYİTLE yazılır", () => {
  assert.equal(panoSatirlari(pano(), ["a.tehlikeli"])[0]!.yazim, "teyit");
});

test("pano satırı: ölçülmüş düğme bu panelden YAZILMAZ, nedeni söylenir", () => {
  const [s] = panoSatirlari(pano(), ["a.olculmus"]);
  assert.deepEqual([s!.yazim, /ölçüm kilidi/.test(s!.neden)], ["yok", true]);
});

test("pano satırı: sabit düğme salt okunur, nedeni panonun kendi cümlesi", () => {
  const [s] = panoSatirlari(pano(), ["a.sabit"]);
  assert.deepEqual([s!.yazim, s!.neden], ["yok", "sabit tel — testle kilitli, panelden değiştirilemez"]);
});

test("pano satırı: mantıksal değer anahtar türünde", () => {
  assert.equal(panoSatirlari(pano(), ["a.anahtar"])[0]!.tur, "anahtar");
});

test("pano satırları: istenen sırayla; panoda olmayan ad atlanır", () => {
  assert.deepEqual(panoSatirlari(pano(), ["a.sabit", "yok.boyle", "a.guvenli"]).map((s) => s.ad), ["a.sabit", "a.guvenli"]);
});

test("sayı adımı aralığa kırpılır", () => {
  assert.deepEqual([sayiAdimi(195, 10, 1, { en: 10, cok: 200 }), sayiAdimi(15, 10, -1, { en: 10, cok: 200 })], [200, 10]);
});

test("sayı girdisi: tam sayı olmayan ya da aralık dışı değer okunur bir hatayla reddedilir", () => {
  assert.deepEqual([sayiOku("12.5", null), sayiOku("500", { en: 10, cok: 200 }), sayiOku(" 120 ", { en: 10, cok: 200 })],
    [{ hata: "tam sayı yaz" }, { hata: "aralık 10–200" }, { deger: 120 }]);
});

// ── beyin ──
const kart = (ad: string, grup: ModelKarti["grup"], uygun = true): ModelKarti => ({ ad, baslik: ad.toUpperCase(), grup, aciklama: "", rozetler: [], uygun, ...(uygun ? {} : { sebep: "kurulu değil" }) });
const sakin = (aktif: string): SeciciDurumu => ({ aktif, istenen: aktif, gecis: "sakin" });

test("beyin listesi: M seçicinin grupları ve sırası (yerel önce)", () => {
  const g = beyinGorunumu([kart("bulut1", "bulut"), kart("yerel1", "yerel")], sakin("yerel1"));
  assert.deepEqual(g.gruplar.map((x) => x.baslik), ["Yerel · Ollama", "Bulut"]);
});

test("beyin listesi: seçilemeyen model gri ve nedeni etikette", () => {
  const g = beyinGorunumu([kart("yerel1", "yerel"), kart("yerel2", "yerel", false)], sakin("yerel1"));
  assert.deepEqual(g.gruplar[0]!.secenekler[1], { ad: "yerel2", etiket: "YEREL2 — kurulu değil", uygun: false });
});

test("beyin listesi: koşan beyin listede yoksa (tarama sürüyor) 'Şu an' grubu eklenir", () => {
  const g = beyinGorunumu([kart("yerel1", "yerel")], sakin("claude:haiku"));
  assert.deepEqual([g.gruplar[0]!.baslik, g.secili], ["Şu an", "claude:haiku"]);
});

test("beyin listesi: sağlık kontrolü sürerken seçili görünen HEDEF", () => {
  const g = beyinGorunumu([kart("a", "yerel"), kart("b", "yerel")], { aktif: "a", istenen: "b", gecis: "kontrol", hedef: "b" });
  assert.deepEqual([g.secili, g.durum], ["b", "B için sağlık kontrolü…"]);
});

test("beyin listesi: geçiş reddedilince koşan beyin seçili kalır ve neden kötü tonda", () => {
  const g = beyinGorunumu([kart("a", "yerel"), kart("b", "yerel")], { aktif: "a", istenen: "b", gecis: "reddedildi", hedef: "b", sebep: "yanıt yok" });
  assert.deepEqual([g.secili, g.ton], ["a", "kotu"]);
});

// ── ses ──
const satir = (ad: string, ek: Partial<SesSatiri> = {}): SesSatiri => ({
  ad, baslik: ad, dil: "tr_TR", kurulu: true, boyut: 63201294, beklenenBoyut: 63206254, katalogda: true, indirilebilir: false,
  indiriliyor: false, indirildi: false, silinebilir: false, silinemezNeden: "x", secili: false, etkin: false, ...ek,
});
const durum = (sesler: SesSatiri[], ek: Partial<SesDurumu> = {}): SesDurumu => ({
  sesler, bozuk: [], secili: null, etkin: sesler.find((s) => s.etkin)?.ad ?? null, kaynak: "varsayilan", kilit: null, uyari: null, piperVar: true, ...ek,
});

test("ses satırları: çalan ses başta ve Seç düğmesi yok", () => {
  const r = sesSatirlari(durum([satir("b"), satir("a", { etkin: true })]), null, null);
  assert.deepEqual([r[0]!.ad, r[0]!.sec], ["a", null]);
});

test("ses satırları: ORION_PIPER_MODEL kilidinde Seç gri ve neden kilit cümlesi", () => {
  const r = sesSatirlari(durum([satir("a", { etkin: true }), satir("b")], { kilit: "env zorluyor", kaynak: "env" }), null, null);
  assert.deepEqual(r[1]!.sec, { acik: false, neden: "env zorluyor" });
});

test("ses satırları: bir ses inerken öteki indirilebilir ses gri ('önce … bitsin')", () => {
  const r = sesSatirlari(durum([satir("x", { kurulu: false, indirilebilir: true }), satir("y", { kurulu: false, indirilebilir: true })]), null, "x");
  assert.deepEqual(r.map((s) => s.indir), [{ acik: false, neden: "iniyor…" }, { acik: false, neden: "önce x bitsin" }]);
});

test("ses satırları: indirme ilerlemesi onnx dosyasının oranı", () => {
  const r = sesSatirlari(durum([satir("x", { kurulu: false, indirilebilir: true })]), { ad: "x", dosya: "onnx", alinan: 25, toplam: 100 }, "x");
  assert.equal(r[0]!.ilerleme, 0.25);
});

test("ses satırları: Sil yalnız panelden indirilmiş seste görünür (elle kurulana hiç gösterilmez)", () => {
  const r = sesSatirlari(durum([satir("elle"), satir("indi", { indirildi: true, silinebilir: true, silinemezNeden: null })]), null, null);
  assert.deepEqual(r.map((s) => s.sil), [null, { acik: true, neden: "" }]);
});

test("boyut metni MB ile", () => {
  assert.equal(boyutMetni(63201294), "60.3 MB");
});

// ── refleksler ──
test("kilitli içgüdüler: ICGUDULER'deki ezilemezlerin TAMAMI (kopya liste değil, türev)", () => {
  assert.equal(kilitliIcguduler().length, Object.values(ICGUDULER).filter((i) => !i.ezilebilir).length);
});

test("kilitli içgüdüler: onay kapısı listede (insan denetimi panelden kapatılamaz)", () => {
  assert.equal(kilitliIcguduler().some((i) => i.kimlik === "onay.insan"), true);
});

test("yetki anahtarları: elle açılışta doğuştan komut açık, beceri ve mercek kapalı", () => {
  assert.deepEqual(yetkiAnahtarlari(""), { beceri: false, benlikSuzgec: false, komut: true });
});

test("yetki anahtarları: senaryoda (sessiz) doğuştan komut kapalı, ?komut=1 zorlar", () => {
  assert.deepEqual([yetkiAnahtarlari("?sessiz=1").komut, yetkiAnahtarlari("?sessiz=1&komut=1").komut], [false, true]);
});
