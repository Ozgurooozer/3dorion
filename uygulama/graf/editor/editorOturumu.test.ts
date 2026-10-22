// uygulama/graf/editor/editorOturumu.test.ts — sekme oturumu ve komutları: her komut TEK geri al adımı, red grafiği değiştirmez, budanan/değişen bağ
// söylenir, açılıştaki otomatik yerleşim kirli saymaz.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { grafDogrula, type Graf, type GrafBagi, type GrafDugumu } from "../../../protocol/graf.ts";
import type { PinOrtami } from "../dugumKaydi.ts";
import { grafKutuphanesi } from "../kutuphane.ts";
import {
  ayarKomutu, bagKaldirKomutu, bagKomutu, dugumEkleKomutu, geriAl, kopyalaKomutu, oturumKur, silKomutu, tasiKomutu, uygula, yapistirKomutu, yinele,
} from "./editorOturumu.ts";

const KAYIT = grafKutuphanesi();
const ORTAM: PinOrtami = { desen: () => null, buGraf: null, ajanlar: () => ["orion", "flash"] };
const bag = (a: string, b: string, c: string, d: string): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] });
const graf = (dugumler: GrafDugumu[], baglar: GrafBagi[] = []): Graf => {
  const r = grafDogrula({ surum: 1, ad: "deneme", tur: "olay", dugumler, baglar });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
const oturum = (g: Graf) => oturumKur(g, KAYIT, () => ORTAM);
const ILK = () => graf([{ id: "b", tip: "olay.basla", konum: [0, 0] }, { id: "bek", tip: "akis.bekle", konum: [300, 0] }], [bag("b", "sonra", "bek", "giris")]);

test("açılışta konumsuz düğümler yerleşir ama sekme KİRLİ DEĞİL", () => {
  const o = oturum(graf([{ id: "b", tip: "olay.basla" }]));
  assert.deepEqual([o.graf().dugumler[0]!.konum, o.gecmis.kirli()], [[0, 0], false]);
});

test("palette'ten ekle + sürüklenen pine bağla TEK adım: bir Ctrl+Z ikisini birden geri alır", () => {
  const o = oturum(ILK());
  const r = dugumEkleKomutu(o, KAYIT, { tip: "veri.sayi", ayar: {} }, { x: 200, y: 100 }, { dugum: "bek", pin: "ms", yon: "giris", tip: "sayi" });
  const eklenmis = [o.graf().dugumler.length, o.graf().baglar.at(-1)];
  geriAl(o);
  assert.deepEqual([r.ok, eklenmis, o.graf().dugumler.length, o.graf().baglar.length], [true, [3, bag("sayi", "deger", "bek", "ms")], 2, 1]);
});

test("palette'ten eklenen düğüm uyumlu pini yoksa yine eklenir, bağ kurulmadığı NEDENİYLE söylenir", () => {
  const o = oturum(ILK());
  const r = dugumEkleKomutu(o, KAYIT, { tip: "veri.metin", ayar: {} }, { x: 0, y: 0 }, { dugum: "bek", pin: "ms", yon: "giris", tip: "sayi" });
  assert.deepEqual([r.ok, r.mesaj, o.graf().dugumler.length], [true, "bağlanamadı: uyumlu pin yok", 3]);
});

test("eklenen düğüm seçili olur", () => {
  const o = oturum(ILK());
  dugumEkleKomutu(o, KAYIT, { tip: "akis.bekle", ayar: {} }, { x: 0, y: 0 });
  assert.deepEqual([...o.secim], ["bekle"]);
});

test("sil: seçili düğüm ve bağları gider, mesaj sayıları söyler; seçim boşalır", () => {
  const o = oturum(ILK());
  o.secim.add("bek");
  const r = silKomutu(o);
  assert.deepEqual([r.mesaj, o.graf().baglar.length, o.secim.size], ["1 düğüm ve 1 bağ silindi (Ctrl+Z geri getirir)", 0, 0]);
});

test("seçim yokken sil nedenle reddedilir ve geçmişe adım girmez", () => {
  const o = oturum(ILK());
  assert.deepEqual([silKomutu(o).ok, o.gecmis.boyut()], [false, 1]);
});

test("uyumsuz bağ reddedilir, grafik ve geçmiş DEĞİŞMEZ", () => {
  const o = oturum(graf([{ id: "m", tip: "veri.metin" }, { id: "bek", tip: "akis.bekle" }]));
  const once = o.graf();
  const r = bagKomutu(o, { dugum: "m", pin: "deger", yon: "cikis" }, { dugum: "bek", pin: "ms", yon: "giris" });
  assert.deepEqual([r, o.graf() === once, o.gecmis.boyut()], [{ ok: false, mesaj: "tür uyuşmuyor: metin → sayı" }, true, 1]);
});

test("bağ çekmek dolu girişteki eski bağı değiştirir ve bunu SÖYLER", () => {
  const o = oturum(graf([{ id: "s1", tip: "veri.sayi" }, { id: "s2", tip: "veri.sayi" }, { id: "bek", tip: "akis.bekle" }], [bag("s1", "deger", "bek", "ms")]));
  const r = bagKomutu(o, { dugum: "s2", pin: "deger", yon: "cikis" }, { dugum: "bek", pin: "ms", yon: "giris" });
  assert.match(r.mesaj ?? "", /eski bağ değiştirildi: s1\.deger → bek\.ms/);
});

test("ayar değişince pini kalkan bağ budanır ve mesajda yazılır", () => {
  const o = oturum(graf([{ id: "git", tip: "ajan.git", ayar: { hedef: "konum", kim: "flash" } }, { id: "k", tip: "veri.konum" }], [bag("k", "konum", "git", "konum")]));
  const r = ayarKomutu(o, KAYIT, "git", "hedef", "ozyn");
  assert.match(r.mesaj ?? "", /1 bağ kaldırıldı — k\.konum → git\.konum/);
});

test("kopyala + yapıştır yeni kimliklerle; yapıştırılanlar seçili; yinele/geri al çalışır", () => {
  const o = oturum(ILK());
  o.secim = new Set(["b", "bek"]);
  const pano = kopyalaKomutu(o);
  yapistirKomutu(o, pano, { x: 0, y: 300 });
  const secili = [...o.secim];
  geriAl(o); yinele(o);
  assert.deepEqual([secili, o.graf().dugumler.length], [["basla", "bekle"], 4]);
});

test("taşı tek adımdır; sıfır kaydırma adım değildir", () => {
  const o = oturum(ILK());
  tasiKomutu(o, new Set(["b"]), 0, 0);
  tasiKomutu(o, new Set(["b"]), 20, 40);
  assert.deepEqual([o.gecmis.boyut(), o.graf().dugumler[0]!.konum], [2, [20, 40]]);
});

test("bağ kaldır: geri al bağı geri getirir", () => {
  const o = oturum(ILK());
  bagKaldirKomutu(o, bag("b", "sonra", "bek", "giris"));
  geriAl(o);
  assert.equal(o.graf().baglar.length, 1);
});

test("red edilen işlem sonucu grafiği değiştirmez (uygula)", () => {
  const o = oturum(ILK());
  assert.deepEqual([uygula(o, { ok: false, hata: "biçim: x" }), o.gecmis.boyut()], [{ ok: false, mesaj: "biçim: x" }, 1]);
});

test("denetim yapılı hataları düğüme eşler (eksik ayar → o düğüm)", () => {
  const o = oturum(graf([{ id: "b", tip: "olay.basla" }, { id: "soz", tip: "ajan.soyle", ayar: { kim: "flash" } }], [bag("b", "sonra", "soz", "giris")]));
  assert.deepEqual(o.denetle().map((h) => h.dugum), ["soz"]);
});

test("başka dosya (desen) değişince çözüm önbelleği unutulur: Desen düğümünün yeni pini görünür", () => {
  const desenler: Graf[] = [grafDogrulaDesen([])];
  const o = oturumKur(graf([{ id: "c", tip: "desen.cagir", ayar: { desen: "d" } }]), KAYIT, () => ({ ...ORTAM, desen: (ad) => desenler.find((x) => x.ad === ad) ?? null }));
  const once = o.cozum().get("c")?.pinler.girisler.map((p) => p.ad);
  desenler[0] = grafDogrulaDesen([{ ad: "kim", tip: "ajan" }]);
  const unutmadan = o.cozum().get("c")?.pinler.girisler.map((p) => p.ad);
  o.cozumuUnut();
  assert.deepEqual([once, unutmadan, o.cozum().get("c")?.pinler.girisler.map((p) => p.ad)], [["giris"], ["giris"], ["giris", "kim"]]);
});

function grafDogrulaDesen(girisler: { ad: string; tip: "ajan" }[]): Graf {
  const r = grafDogrula({ surum: 1, ad: "d", tur: "fonksiyon", girisler, dugumler: [{ id: "g", tip: "fonksiyon.giris" }], baglar: [] });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
}
