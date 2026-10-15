// world/surfaces/duvar/kuralGrafigi.test.ts — Kural grafiği yerleşimi (Markov hafıza aşama 2, ön kayıt G1–G4).
// world mind'i import etmez (K4): burada `grafik()`in ŞEKLİNDE sentetik grafik kurulur; gerçek tabloyla ölçüm tools/kural-grafigi-olc.ts.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { kuralYerlesimi, kisalt, type Alan, type KuralGrafigiVerisi, type Yerlesim, type Kutu } from "./kuralGrafigi.ts";

/** `grafik()` ile aynı şekil: giriş → grup… → yaz; her grubun kuralları (`icerir`); at kuralları "cikis:at"a. */
function sentetik(gruplar: readonly { id: string; kurallar: readonly { id: string; at?: boolean }[] }[]): KuralGrafigiVerisi {
  const dugumler: KuralGrafigiVerisi["dugumler"][number][] = [{ id: "giris", tur: "giris", etiket: "algı" }];
  const kenarlar: KuralGrafigiVerisi["kenarlar"][number][] = [];
  let onceki = "giris";
  for (const g of gruplar) {
    dugumler.push({ id: `grup:${g.id}`, tur: "grup", etiket: g.id });
    kenarlar.push({ kimden: onceki, kime: `grup:${g.id}`, tur: "sonra" });
    onceki = `grup:${g.id}`;
    for (const k of g.kurallar) {
      dugumler.push({ id: k.id, tur: "kural", etiket: k.id, aciklama: "a", kosul: "k", sonuc: "s", grup: g.id });
      kenarlar.push({ kimden: `grup:${g.id}`, kime: k.id, tur: "icerir" });
      if (k.at) kenarlar.push({ kimden: k.id, kime: "cikis:at", tur: "at" });
    }
  }
  dugumler.push({ id: "cikis:yaz", tur: "cikis", etiket: "yaz" }, { id: "cikis:at", tur: "cikis", etiket: "reddet" });
  kenarlar.push({ kimden: onceki, kime: "cikis:yaz", tur: "sonra" });
  return { dugumler, kenarlar };
}

/** Bugünkü tablonun şekli: ELE 3 (hepsi at), İÇERİK 2, ÖNEM 9. */
const GRAFIK = sentetik([
  { id: "ele", kurallar: [{ id: "e1", at: true }, { id: "e2", at: true }, { id: "e3", at: true }] },
  { id: "icerik", kurallar: [{ id: "i1" }, { id: "i2" }] },
  { id: "onem", kurallar: Array.from({ length: 9 }, (_, i) => ({ id: `o${i + 1}` })) },
]);

const BOYUTLAR: readonly [number, number][] = [[1024, 512], [910, 512], [640, 360]];
const alanOlarak = (g: number, y: number): Alan => ({ x: 10, y: 50, g: g - 20, yuk: y - 50 - 55 });

const kesisir = (a: Kutu, b: Kutu) => a.x < b.x + b.g && b.x < a.x + a.g && a.y < b.y + b.yuk && b.y < a.y + a.yuk;
const ucta = (k: Kutu, p: { x: number; y: number }) => p.x >= k.x - 0.5 && p.x <= k.x + k.g + 0.5 && p.y >= k.y - 0.5 && p.y <= k.y + k.yuk + 0.5;

test("G1: her düğüm tam bir kez yerleşir, kutular kesişmez, hepsi alanın içinde (üç boyut)", () => {
  for (const [g, y] of BOYUTLAR) {
    const alan = alanOlarak(g, y), yerlesim: Yerlesim = kuralYerlesimi(GRAFIK, alan);
    assert.deepEqual(yerlesim.kutular.map((k) => k.id).sort(), GRAFIK.dugumler.map((d) => d.id).sort(), `${g}×${y}: düğüm kümesi`);
    for (let i = 0; i < yerlesim.kutular.length; i++) {
      const k = yerlesim.kutular[i]!;
      assert.ok(k.x >= alan.x - 0.5 && k.y >= alan.y - 0.5 && k.x + k.g <= alan.x + alan.g + 0.5 && k.y + k.yuk <= alan.y + alan.yuk + 0.5, `${g}×${y}: dışarıda ${k.id}`);
      for (let j = i + 1; j < yerlesim.kutular.length; j++) {
        const b = yerlesim.kutular[j]!;
        // Grup başlığı ile kendi kuralları arasında girinti vardır ama kutular ayrıdır; kesişme sayılmaz.
        assert.equal(kesisir(k, b), false, `${g}×${y}: ${k.id} ile ${b.id} kesişiyor`);
      }
    }
  }
});

test("G2: her kenar bir ok çizgisi olur; uçları ilgili kutuların kenarında", () => {
  for (const [g, y] of BOYUTLAR) {
    const yerlesim = kuralYerlesimi(GRAFIK, alanOlarak(g, y));
    const kutu = new Map(yerlesim.kutular.map((k) => [k.id, k]));
    assert.equal(yerlesim.oklar.length, GRAFIK.kenarlar.length, "ok sayısı = kenar sayısı");
    for (const ok of yerlesim.oklar) {
      assert.ok(ok.noktalar.length >= 2, `${ok.kimden}→${ok.kime}: çizgi yok`);
      assert.ok(ucta(kutu.get(ok.kimden)!, ok.noktalar[0]!), `${g}×${y}: ${ok.kimden}→${ok.kime} başlangıcı kutuda değil`);
      assert.ok(ucta(kutu.get(ok.kime)!, ok.noktalar[ok.noktalar.length - 1]!), `${g}×${y}: ${ok.kimden}→${ok.kime} bitişi kutuda değil`);
    }
  }
});

test("G3: tabloya kural eklenince kutu ve ok da eklenir (çizim kodu aynı)", () => {
  const once = kuralYerlesimi(GRAFIK, alanOlarak(1024, 512));
  const buyuk = sentetik([
    { id: "ele", kurallar: [{ id: "e1", at: true }, { id: "e2", at: true }, { id: "e3", at: true }] },
    { id: "icerik", kurallar: [{ id: "i1" }, { id: "i2" }, { id: "yeni" }] },
    { id: "onem", kurallar: Array.from({ length: 9 }, (_, i) => ({ id: `o${i + 1}` })) },
  ]);
  const sonra = kuralYerlesimi(buyuk, alanOlarak(1024, 512));
  assert.deepEqual([sonra.kutular.length - once.kutular.length, sonra.oklar.length - once.oklar.length], [1, 1]);
  assert.ok(sonra.kutular.some((k) => k.id === "yeni"));
});

test("G4: kisalt kutu genişliğini aşmaz ve kısaltıldığını '…' ile söyler", () => {
  const olcer = { measureText: (t: string) => ({ width: t.length * 7 }) as TextMetrics };
  assert.equal(kisalt(olcer, "kisa", 100), "kisa");
  const k = kisalt(olcer, "ortam-hata.yazilmaz-cok-uzun-bir-kimlik", 100);
  assert.ok(k.endsWith("…") && k.length * 7 <= 100, k);
});

test("at kuralları 'reddet' kutusuna giden kırmızı oka sahiptir; reddet kutusu ilk sütunda", () => {
  const y = kuralYerlesimi(GRAFIK, alanOlarak(1024, 512));
  const atlar = y.oklar.filter((o) => o.tur === "at");
  assert.deepEqual(atlar.map((o) => o.kimden), ["e1", "e2", "e3"]);
  const reddet = y.kutular.find((k) => k.id === "cikis:at")!, giris = y.kutular.find((k) => k.id === "giris")!;
  assert.equal(reddet.x, giris.x);
});
