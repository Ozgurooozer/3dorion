// uygulama/yapi/ortak/dok/dokDuzeni.test.ts — dok düzeni modeli (spec 39 D3): taşıma, izin kuralı + ret nedeni, kapat/aç, boyut sınırı, kalıcılık toleransı.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { ac, boyutAyarla, BOYUT_SINIRI, etkinYap, kapat, kayitHatalari, oku, panelBolgesi, serilestir, tasi, varsayilanDuzen, yuzerKonumla, YUZER_VARSAYILAN } from "./dokDuzeni.ts";
import type { Duzen, PanelKaydi, Sonuc } from "./dokDuzeni.ts";

const K: readonly PanelKaydi[] = [
  { id: "ayrinti", ad: "Ayrıntılar", bolgeler: ["sol", "sag", "alt", "yuzer"], varsayilan: "sag" },
  { id: "rig", ad: "Rig", bolgeler: ["sol", "sag"], varsayilan: "sag" },
  { id: "kamera", ad: "Kamera", bolgeler: ["sag", "yuzer"], varsayilan: "sag" },
  { id: "icerik", ad: "İçerik", bolgeler: ["sol", "alt", "yuzer"], varsayilan: "alt" },
];
const tamam = (s: Sonuc): Duzen => { assert.ok(s.ok, s.ok ? "" : s.neden); return s.duzen; };

test("varsayılan: paneller varsayılan bölgesinde, kayıt sırasıyla; ilk panel etkin; boş bölgede etkin null", () => {
  const d = varsayilanDuzen(K);
  assert.deepEqual(d.gruplar, { sol: [], sag: ["ayrinti", "rig", "kamera"], alt: ["icerik"], yuzer: [] });
  assert.deepEqual(d.etkin, { sol: null, sag: "ayrinti", alt: "icerik" });
  assert.deepEqual(d.kapali, []);
  assert.equal(d.boyut.sag, BOYUT_SINIRI.sag.varsayilan);
});

test("taşı: izinli bölgeye geçer, eski bölgeden çıkar, hedefte etkin olur, kaynakta etkin komşuya düşer", () => {
  const d = tamam(tasi(varsayilanDuzen(K), K, "ayrinti", "sol"));
  assert.deepEqual(d.gruplar.sol, ["ayrinti"]);
  assert.deepEqual(d.gruplar.sag, ["rig", "kamera"]);
  assert.equal(d.etkin.sol, "ayrinti");
  assert.equal(d.etkin.sag, "rig");
});

test("taşı: sıra belirtilirse o yere girer; sınır dışı sıra kırpılır; aynı bölgede yeniden sıralar", () => {
  let d = varsayilanDuzen(K);
  d = tamam(tasi(d, K, "kamera", "sag", 0));
  assert.deepEqual(d.gruplar.sag, ["kamera", "ayrinti", "rig"]);
  d = tamam(tasi(d, K, "kamera", "sag", 99));
  assert.deepEqual(d.gruplar.sag, ["ayrinti", "rig", "kamera"]);
  d = tamam(tasi(d, K, "rig", "sag", -5));
  assert.deepEqual(d.gruplar.sag, ["rig", "ayrinti", "kamera"]);
  d = tamam(tasi(d, K, "kamera", "sag", -1));   // splice'ın negatif sırası SONDAN sayar; model 0'a kırpar
  assert.deepEqual(d.gruplar.sag, ["kamera", "rig", "ayrinti"]);
});

test("taşı: izinsiz bölge REDDEDİLİR, nedeni panel adını ve izinli bölgeleri söyler, düzen değişmez", () => {
  const d = varsayilanDuzen(K);
  const s = tasi(d, K, "rig", "alt");
  assert.equal(s.ok, false);
  if (!s.ok) {
    assert.equal(s.ret, "bolge-izinsiz");
    assert.match(s.neden, /Rig paneli alt bölgeye bırakılamaz/);
    assert.match(s.neden, /izinli bölgeler sol, sağ$/);
  }
  assert.deepEqual(d.gruplar.sag, ["ayrinti", "rig", "kamera"]);
});

test("taşı: bilinmeyen panel ve bilinmeyen bölge ayrı ret kodu", () => {
  const d = varsayilanDuzen(K);
  const a = tasi(d, K, "yok", "sol"), b = tasi(d, K, "rig", "orta" as never);
  assert.ok(!a.ok && a.ret === "bilinmeyen-panel");
  assert.ok(!b.ok && b.ret === "bilinmeyen-bolge");
});

test("taşı: giriş düzeni DEĞİŞMEZ (değişmez veri); her panel tam bir yerde", () => {
  const d = varsayilanDuzen(K);
  const onceki = JSON.stringify(d);
  const y = tamam(tasi(d, K, "ayrinti", "yuzer"));
  assert.equal(JSON.stringify(d), onceki);
  const hepsi = [...y.gruplar.sol, ...y.gruplar.sag, ...y.gruplar.alt, ...y.gruplar.yuzer, ...y.kapali].sort();
  assert.deepEqual(hepsi, ["ayrinti", "icerik", "kamera", "rig"]);
});

test("yüzer: ilk taşımada varsayılan konum yazılır; konum sınırlanır, sayı olmayan eskisini korur", () => {
  let d = tamam(tasi(varsayilanDuzen(K), K, "kamera", "yuzer"));
  assert.deepEqual(d.yuzerKonum.kamera, YUZER_VARSAYILAN);
  d = yuzerKonumla(d, "kamera", { x: 10, y: -50, g: 5, yuk: Number.NaN });
  assert.deepEqual(d.yuzerKonum.kamera, { x: 10, y: 0, g: 160, yuk: YUZER_VARSAYILAN.yuk });
  assert.equal(yuzerKonumla(d, "rig", { x: 1 }), d, "yüzer olmayan panel: aynı düzen");
});

test("kapat: panel gruptan çıkar, kapali'ya girer, etkin komşuya düşer; kapalıyı tekrar kapatmak etkisiz", () => {
  let d = kapat(varsayilanDuzen(K), "ayrinti");
  assert.deepEqual(d.kapali, ["ayrinti"]);
  assert.deepEqual(d.gruplar.sag, ["rig", "kamera"]);
  assert.equal(d.etkin.sag, "rig");
  assert.equal(kapat(d, "ayrinti"), d);
  d = kapat(d, "icerik");
  assert.equal(d.etkin.alt, null);
});

test("aç: kapalı panel varsayılan bölgesinde açılır ve etkin olur; açıksa yalnız etkin yapar, sırası bozulmaz", () => {
  let d = kapat(varsayilanDuzen(K), "rig");
  d = tamam(ac(d, K, "rig"));
  assert.deepEqual(d.kapali, []);
  assert.deepEqual(d.gruplar.sag, ["ayrinti", "kamera", "rig"]);
  assert.equal(d.etkin.sag, "rig");
  d = tamam(ac(d, K, "ayrinti"));
  assert.deepEqual(d.gruplar.sag, ["ayrinti", "kamera", "rig"]);
  assert.equal(d.etkin.sag, "ayrinti");
  assert.ok(!ac(d, K, "yok").ok);
});

test("kapalı panel bir bölgeye taşınınca (sürükle) açılır", () => {
  const d = tamam(tasi(kapat(varsayilanDuzen(K), "rig"), K, "rig", "sol"));
  assert.deepEqual(d.kapali, []);
  assert.deepEqual(d.gruplar.sol, ["rig"]);
});

test("etkinYap: aynı bölgedeki sekmeyi etkin yapar; yüzer/bilinmeyen/zaten etkin: aynı düzen", () => {
  const d = varsayilanDuzen(K);
  assert.equal(etkinYap(d, "kamera").etkin.sag, "kamera");
  assert.equal(etkinYap(d, "ayrinti"), d);
  assert.equal(etkinYap(d, "yok"), d);
  const y = tamam(tasi(d, K, "kamera", "yuzer"));
  assert.equal(etkinYap(y, "kamera"), y, "yüzer panelin kenar-etkin kaydı yok: düzen aynı nesne");
});

test("boyut: bölgeye göre sınırlanır, yuvarlanır, NaN varsayılana düşer, aynı değer aynı nesne", () => {
  const d = varsayilanDuzen(K);
  assert.equal(boyutAyarla(d, "sag", 5).boyut.sag, BOYUT_SINIRI.sag.en_az);
  assert.equal(boyutAyarla(d, "sag", 99999).boyut.sag, BOYUT_SINIRI.sag.en_cok);
  assert.equal(boyutAyarla(d, "alt", 99999).boyut.alt, BOYUT_SINIRI.alt.en_cok);
  assert.equal(boyutAyarla(d, "sol", 250.6).boyut.sol, 251);
  assert.equal(boyutAyarla(d, "sol", Number.NaN).boyut.sol, BOYUT_SINIRI.sol.varsayilan);
  assert.equal(boyutAyarla(d, "sag", d.boyut.sag), d);
});

test("kayıt tutarlılığı: yinelenen kimlik, izinli bölgesi yok, varsayılan izinsiz → hata listesi", () => {
  assert.deepEqual(kayitHatalari(K), []);
  const h = kayitHatalari([{ id: "a", ad: "A", bolgeler: ["sol"], varsayilan: "sag" }, { id: "a", ad: "B", bolgeler: [], varsayilan: "sol" }]);
  assert.equal(h.length, 4);
  assert.match(h.join("|"), /yinelenen panel kimliği: a/);
  assert.match(h.join("|"), /izinli bölge yok/);
  assert.match(h.join("|"), /varsayılan bölge \(sag\) izinli değil/);
});

test("kalıcılık: serileştir → oku gidiş-dönüş AYNI düzen (taşınmış, kapalı, yüzer, boyutlu)", () => {
  let d = varsayilanDuzen(K);
  d = tamam(tasi(d, K, "ayrinti", "sol"));
  d = tamam(tasi(d, K, "kamera", "yuzer"));
  d = yuzerKonumla(d, "kamera", { x: 300, y: 200, g: 400, yuk: 250 });
  d = kapat(d, "rig");
  d = boyutAyarla(boyutAyarla(d, "sol", 333), "alt", 200);
  assert.deepEqual(oku(serilestir(d), K), d);
});

test("oku: bozuk/boş/yanlış sürüm metni varsayılana düşer", () => {
  const v = varsayilanDuzen(K);
  for (const m of [null, undefined, "", "{", "[]", "null", '{"surum":2}', '{"gruplar":{}}', "5"]) assert.deepEqual(oku(m, K), v, String(m));
  // Sürümsüz/yanlış sürümlü ama DOLU kayıt kabul edilmez (başka bir biçimin kalıntısı olabilir).
  const dolu = { gruplar: { sol: ["ayrinti"], sag: ["rig", "kamera"], alt: ["icerik"], yuzer: [] }, kapali: [], boyut: { sol: 400 } };
  assert.deepEqual(oku(JSON.stringify(dolu), K), v);
  assert.deepEqual(oku(JSON.stringify({ ...dolu, surum: 2 }), K), v);
  assert.deepEqual(oku(JSON.stringify({ ...dolu, surum: 1 }), K).gruplar.sol, ["ayrinti"], "aynı kayıt sürüm 1 ile kabul");
});

test("oku: bilinmeyen panel düşer, yinelenen tek kalır, yeni kayıtlı panel varsayılan bölgesine eklenir", () => {
  const m = JSON.stringify({ surum: 1, gruplar: { sol: ["ayrinti", "eski", "ayrinti"], sag: ["ayrinti"], alt: [], yuzer: [] }, kapali: [] });
  const d = oku(m, K);
  assert.deepEqual(d.gruplar.sol, ["ayrinti"]);
  assert.deepEqual(d.gruplar.sag, ["rig", "kamera"]);
  assert.deepEqual(d.gruplar.alt, ["icerik"]);
  assert.equal(panelBolgesi(d, "eski"), null);
});

test("oku: izinsiz bölgedeki panel varsayılan bölgesine döner; kapalıda ve grupta birden olan grupta kalır", () => {
  const m = JSON.stringify({ surum: 1, gruplar: { sol: [], sag: [], alt: ["rig"], yuzer: [] }, kapali: ["rig", "kamera", "yok", "kamera"] });
  const d = oku(m, K);
  assert.deepEqual(d.gruplar.sag.includes("rig"), true, "rig alt'a izinsiz: varsayılan sağ");
  assert.deepEqual(d.kapali, ["kamera"], "grupta olan kapalıda sayılmaz, bilinmeyen ve yineleneni atar");
  assert.ok(!d.gruplar.sag.includes("kamera"));
});

test("oku: boyut sınırlanır, etkin sekme grupta yoksa ilkine düşer, yüzer konum sınırlanır", () => {
  const m = JSON.stringify({ surum: 1, gruplar: { sol: [], sag: ["ayrinti", "rig"], alt: [], yuzer: ["kamera"] }, etkin: { sag: "kamera" }, boyut: { sol: 1, sag: 99999, alt: "x" }, kapali: ["icerik"], yuzerKonum: { kamera: { x: 5, y: -9, g: 1, yuk: 500 } } });
  const d = oku(m, K);
  assert.equal(d.boyut.sol, BOYUT_SINIRI.sol.en_az);
  assert.equal(d.boyut.sag, BOYUT_SINIRI.sag.en_cok);
  assert.equal(d.boyut.alt, BOYUT_SINIRI.alt.varsayilan);
  assert.equal(d.etkin.sag, "ayrinti");
  assert.deepEqual(d.yuzerKonum.kamera, { x: 5, y: 0, g: 160, yuk: 500 });
  assert.deepEqual(d.kapali, ["icerik"]);
});

test("başlangıçta kapalı panel: varsayılan düzende ve kayıttan sonra eklenince KAPALI listesinde, hiçbir bölgede değil; açınca varsayılan bölgesine girer; kayıtlı düzen korunur", () => {
  const B: readonly PanelKaydi[] = [...K.slice(0, 3), { id: "icerik", ad: "İçerik", bolgeler: ["sol", "sag", "alt", "yuzer"], varsayilan: "alt", baslangicKapali: true }];
  const d = varsayilanDuzen(B);
  assert.deepEqual(d.kapali, ["icerik"]);
  assert.deepEqual(d.gruplar.alt, []);
  assert.equal(d.etkin.alt, null, "boş alt bölge açılmaz");
  assert.equal(panelBolgesi(d, "icerik"), null);
  const acilmis = tamam(ac(d, B, "icerik"));
  assert.deepEqual(acilmis.gruplar.alt, ["icerik"]);
  assert.deepEqual(acilmis.kapali, []);
  // kayıttan sonra eklenen başlangıçta-kapalı panel kapalı gelir (kullanıcının düzeni bölge açmaz)
  const eski = serilestir(varsayilanDuzen(K.slice(0, 3)));
  const o = oku(eski, B);
  assert.deepEqual(o.kapali, ["icerik"]);
  assert.deepEqual(o.gruplar.alt, []);
  // kullanıcı açıp kaydettiyse sonraki okumada AÇIK kalır (başlangıç yalnız ilk kez)
  assert.deepEqual(oku(serilestir(acilmis), B).gruplar.alt, ["icerik"]);
  // bozuk kayıt → varsayılan (yine kapalı)
  assert.deepEqual(oku("{bozuk", B).kapali, ["icerik"]);
});
