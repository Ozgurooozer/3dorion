// world/avatar/yurutucuKlip.test.ts — KLİPLİ JEST yürütücüde (spec 35 Dilim 5a): süreli sonuç (basladi → bitti), döngü, kesilme kuralları
// (yeni jest/klip ve `dur` keser, `git` kesmez), bilinmeyen klip, uygulanamayan izlerin bildirimi. Saf: Babylon yok, zaman elle ilerler (20 Hz).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { klipDogrula, type AnimasyonKlibi, type Uzuv } from "../../protocol/animasyon.ts";
import type { Niyet, NiyetSonucu } from "../../protocol/niyet.ts";
import { Yurutucu, type YurutucuAyari } from "./yurutucu.ts";
import { klipKutuphanesiKur } from "./klipKutuphanesi.ts";

function klip(ad: string, sure: number, dongu = false, uzuvlar: Uzuv[] = ["sag_kol"]): AnimasyonKlibi {
  const r = klipDogrula({ surum: 1, ad, jest: "el_salliyor", sure, dongu, izler: uzuvlar.map((uzuv) => ({ uzuv, kanal: "donme_z", anahtarlar: [{ t: 0, deger: 0 }] })) });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
}

function kur(ek: Partial<YurutucuAyari> = {}) {
  const kutuphane = klipKutuphanesiKur();
  kutuphane.doldur([klip("salla", 1), klip("dongu", 0.5, true), klip("iki", 1, false, ["sag_kol", "sag_on_kol"])]);
  const y = new Yurutucu({ klipler: kutuphane, ...ek });
  const sonuclar: NiyetSonucu[] = [];
  const k = {
    y, sonuclar,
    niyet(n: Niyet, id: string) { y.niyet(n, id); return k; },
    /** n tik (her biri 50 ms). */
    tik(n = 1) { for (let i = 0; i < n; i++) sonuclar.push(...y.ilerle(0.05)); return k; },
    durumlar: (id: string) => sonuclar.filter((s) => s.niyet_id === id).map((s) => s.durum),
  };
  return k;
}
const salla = (klipAdi = "salla"): Niyet => ({ tur: "jest", jest: "el_salliyor", klip: klipAdi });

test("klipli jest SÜRELİ: önce yalnız 'basladi', süre dolmadan 'bitti' YOK", () => {
  const k = kur().niyet(salla(), "j1").tik(19);       // 0.95 sn < 1 sn
  assert.deepEqual(k.durumlar("j1"), ["basladi"]);
});

test("klip süresi dolunca 'bitti' (grafiğin 'bitene kadar bekle'si bunu bekler)", () => {
  const k = kur().niyet(salla(), "j1").tik(21);
  assert.deepEqual(k.durumlar("j1"), ["basladi", "bitti"]);
});

test("klip oynarken görünüm klibi taşır ve DÜZ jesti boşaltır (klip jestin yerine geçer); bitince ikisi de boş", () => {
  const k = kur().niyet(salla(), "j1").tik(2);
  const g = k.y.gorunum();
  assert.deepEqual([g.klip?.klip.ad, g.klip?.jest, g.jest, Number(g.klip?.gecen.toFixed(3))], ["salla", "el_salliyor", null, 0.1]);
  k.tik(30);
  assert.deepEqual([k.y.gorunum().klip, k.y.gorunum().jest], [null, null]);
});

test("DÖNGÜLÜ klip kendiliğinden bitmez (30 sn sonra hâlâ oynuyor)", () => {
  const k = kur().niyet(salla("dongu"), "j1").tik(600);
  assert.deepEqual([k.durumlar("j1"), k.y.gorunum().klip?.klip.ad], [["basladi"], "dongu"]);
});

test("'dur' klibi KESER: klip 'iptal', dur 'bitti'", () => {
  const k = kur().niyet(salla("dongu"), "j1").tik(3).niyet({ tur: "dur" }, "d1").tik();
  assert.deepEqual([k.durumlar("j1"), k.durumlar("d1"), k.y.gorunum().klip], [["basladi", "iptal"], ["bitti"], null]);
  assert.match(k.sonuclar.find((s) => s.niyet_id === "j1" && s.durum === "iptal")?.not ?? "", /'dongu' klibi kesildi \(dur\)/);
});

test("yeni DÜZ jest klibi keser (en son jest kazanır) ve kendi jestini oynatır", () => {
  const k = kur().niyet(salla(), "j1").tik(3).niyet({ tur: "jest", jest: "gülümsüyor" }, "j2").tik();
  assert.deepEqual([k.durumlar("j1"), k.durumlar("j2"), k.y.gorunum().jest, k.y.gorunum().klip], [["basladi", "iptal"], ["bitti"], "gülümsüyor", null]);
});

test("yeni KLİP eskisini keser: eski 'iptal', yeni baştan başlar", () => {
  const k = kur().niyet(salla(), "j1").tik(10).niyet(salla("iki"), "j2").tik();
  assert.deepEqual([k.durumlar("j1"), k.durumlar("j2"), k.y.gorunum().klip?.klip.ad, Number(k.y.gorunum().klip?.gecen.toFixed(3))], [["basladi", "iptal"], ["basladi"], "iki", 0.05]);
});

test("'git' klibi KESMEZ (yürürken el sallanır): ikisi birlikte sürer", () => {
  const k = kur().niyet(salla("dongu"), "j1").niyet({ tur: "git", hedef: { tip: "nokta", x: 2, y: 0, z: 0 } }, "g1").tik(5);
  assert.deepEqual([k.durumlar("j1"), k.durumlar("g1"), k.y.gorunum().klip?.klip.ad, k.y.gorunum().poz], [["basladi"], ["basladi"], "dongu", "yürüyor"]);
});

test("bilinmeyen klip: nedenli 'hata', yüklüler sayılır; oynayan klip KESİLMEZ", () => {
  const k = kur().niyet(salla(), "j1").tik(2).niyet(salla("yok_boyle"), "j2").tik();
  const h = k.sonuclar.find((s) => s.niyet_id === "j2");
  assert.deepEqual([h?.durum, h?.not, k.durumlar("j1"), k.y.gorunum().klip?.klip.ad], ["hata", "bilinmeyen klip: 'yok_boyle' (yüklü: salla, dongu, iki).", ["basladi"], "salla"]);
});

test("kütüphanesiz beden: klipli jest nedenli 'hata' (düz jeste SESSİZCE düşmez)", () => {
  const y = new Yurutucu();
  y.niyet(salla(), "j1");
  const s = y.ilerle(0.05);
  assert.deepEqual([s.map((x) => x.durum), y.gorunum().jest], [["hata"], null]);
  assert.match(s[0]!.not ?? "", /klip kütüphanesi bağlanmadı/);
});

test("uygulanamayan izler 'basladi' sonucunda adlarıyla (uzuv kümesi verilince)", () => {
  const k = kur({ klipUzuvlari: new Set<Uzuv>(["sag_kol"]) }).niyet(salla("iki"), "j1").tik();
  assert.deepEqual(k.sonuclar[0], { niyet_id: "j1", durum: "basladi", veri: { klip: "iki", sure: 1, dongu: false, atlanan: ["sag_on_kol.donme_z"] } });
});

test("kütüphane SONRADAN dolarsa (asenkron yükleme) çağrı anında bulunur", () => {
  const kutuphane = klipKutuphanesiKur();
  const y = new Yurutucu({ klipler: kutuphane });
  kutuphane.doldur([klip("gec", 1)]);
  y.niyet(salla("gec"), "j1");
  assert.deepEqual(y.ilerle(0.05).map((s) => s.durum), ["basladi"]);
});

test("düz jest DEĞİŞMEDİ: anında 'bitti', klip yok", () => {
  const k = kur().niyet({ tur: "jest", jest: "el_salliyor" }, "j1").tik();
  assert.deepEqual([k.durumlar("j1"), k.y.gorunum().jest, k.y.gorunum().klip], [["bitti"], "el_salliyor", null]);
});
