// uygulama/sekans/editor/zamanVeDuzen.test.ts — zaman ekseni (kare↔piksel, İMLEÇ MERKEZLİ yakınlaştırma, sığdır, cetvel, yaslama, eksen kısıtı) ve
// görünüm modeli (satırlar — sol sütunla zaman çizelgesi AYNI y —, anahtar elmasları, bölüm kutuları ve kenar vuruşu, kutu seçimi). Tolerans 1e-9 px.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { sekansDogrula, type Sekans } from "../../../protocol/sekans.ts";
import { DUZEN, anahtarKonumlari, anahtarVurus, bolumKutulari, bolumVurus, izSatiri, kesmeKutulari, kesmeVurus, kutudakiAnahtarlar, satirBul, satirlar } from "./izDuzeni.ts";
import {
  ZAMAN_OLCEGI, araligaSigdir, cetvelAdimi, cetvelIsaretleri, eksenKisiti, kareX, kareYazisi, kareyiYasla, sureYazisi, xKare, xTamKare, zamanYakinlastir,
} from "./zamanEkseni.ts";

const TOL = 1e-9;

function sekans(): Sekans {
  const r = sekansDogrula({
    surum: 1, ad: "t", fps: 30, sure_kare: 120,
    baglamalar: [{ id: "b1", ajan: "orion" }, { id: "b2", ajan: "flash" }],
    izler: [
      { id: "bas", baglama: "b1", tur: "uzuv", uzuv: "bas", kanal: "donme_x", anahtarlar: [{ kare: 0, deger: 0 }, { kare: 30, deger: 10 }] },
      { id: "k", baglama: "b2", tur: "klip", bolumler: [{ klip: "el_salla", baslangic_kare: 10, uzunluk_kare: 40 }] },
      { id: "kol", baglama: "b1", tur: "uzuv", uzuv: "sag_kol", kanal: "donme_z", anahtarlar: [{ kare: 60, deger: 90 }] },
    ],
  });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
}

test("kare ↔ piksel gidiş-dönüş", () => {
  const g = { x: 37, olcek: 3.5 };
  assert.ok(Math.abs(xKare(g, kareX(g, 45)) - 45) < TOL);
});

test("İMLEÇ MERKEZLİ yakınlaştırma: imlecin altındaki kare yakınlaşmadan sonra da imlecin altında", () => {
  const g = { x: 20, olcek: 4 };
  const imlec = 333;
  const once = xKare(g, imlec);
  assert.ok(Math.abs(xKare(zamanYakinlastir(g, imlec, 2.5), imlec) - once) < TOL);
});

test(`ölçek sınırlı (${ZAMAN_OLCEGI.en}–${ZAMAN_OLCEGI.cok} px/kare); sınıra dayanınca da imlecin altındaki kare yerinde`, () => {
  const g = zamanYakinlastir({ x: 0, olcek: 30 }, 100, 10);
  assert.deepEqual([g.olcek, Math.abs(xKare(g, 100) - 100 / 30) < TOL], [ZAMAN_OLCEGI.cok, true]);
});

test("scrub kareye oturur: x'in en yakın TAMSAYI karesi, [0, süre] içinde", () => {
  const g = { x: 10, olcek: 4 };
  assert.deepEqual([xTamKare(g, 10 + 4 * 12.4, 120), xTamKare(g, -50, 120), xTamKare(g, 9999, 120)], [12, 0, 120]);
});

test("aralığa sığdır: aralık kenar boşluklu sığar (bas ve bit ekranın içinde)", () => {
  const g = araligaSigdir(30, 90, 624);
  assert.deepEqual([kareX(g, 30), kareX(g, 90)], [24, 600]);
});

test("cetvel: büyük işaretler en az 70 px aralıklı ve etiketli ('1 sn' = 30 kare)", () => {
  const g = { x: 0, olcek: 3 };
  const buyukler = cetvelIsaretleri(g, 400, 120).filter((i) => i.etiket);
  assert.deepEqual([cetvelAdimi(3).buyuk, buyukler.map((i) => i.etiket)], [30, ["0 sn", "1 sn", "2 sn", "3 sn", "4 sn"]]);
});

test("süre/kare yazısı Türkçe virgüllü: 45 kare = '1,5 sn'", () => assert.equal(kareYazisi(45), "kare 45 · 1,5 sn"));
test("sureYazisi iki ondalık: 1 kare = 0,03 sn", () => assert.equal(sureYazisi(1), "0,03 sn"));

test("YASLAMA açık: eşik içindeki komşu kareye yapışır; kapalı: yalnız tamsayıya yuvarlanır", () => {
  const g = { x: 0, olcek: 4 };   // 6 px eşik = 1.5 kare
  assert.deepEqual([kareyiYasla(28.8, g, true, [30, 40]), kareyiYasla(28.8, g, false, [30, 40]), kareyiYasla(25.2, g, true, [30])], [30, 29, 25]);
});

test("Shift eksen kısıtı: baskın eksen kalır, öteki sıfırlanır; Shift'siz ikisi de", () => {
  assert.deepEqual([eksenKisiti(12, 5, true), eksenKisiti(3, -9, true), eksenKisiti(3, -9, false)], [{ dx: 12, dy: 0 }, { dx: 0, dy: -9 }, { dx: 3, dy: -9 }]);
});

test("satırlar: en üstte KAMERA satırı, sonra bağlama başlığı + o bağlamanın izleri (dosya sırasıyla), y aralıksız artar", () => {
  const l = satirlar(sekans());
  const k = DUZEN.satir;   // kamera satırı yüksekliği
  assert.deepEqual(l.map((s) => [s.tur === "kamera" ? "#kamera" : s.tur === "iz" ? s.iz.id : `#${s.baglama.id}`, s.y]),
    [["#kamera", 0], ["#b1", k], ["bas", k + DUZEN.baslik], ["kol", k + DUZEN.baslik + DUZEN.satir], ["#b2", k + DUZEN.baslik + 2 * DUZEN.satir], ["k", k + 2 * DUZEN.baslik + 2 * DUZEN.satir]]);
});

test("HİZALAMA: bir izin elması ve bölümü, sol sütundaki AYNI satırın ortasında", () => {
  const l = satirlar(sekans()), g = { x: 0, olcek: 2 };
  const kol = izSatiri(l, "kol")!, k = izSatiri(l, "k")!;
  const elmas = anahtarKonumlari(l, g).find((a) => a.iz === "kol")!, kutu = bolumKutulari(l, g)[0]!;
  assert.deepEqual([elmas.y, kutu.y + kutu.h / 2], [kol.y + kol.h / 2, k.y + k.h / 2]);
});

test("satırBul: y'deki satır; satırların altında null", () => {
  const l = satirlar(sekans());
  assert.deepEqual([satirBul(l, DUZEN.satir + DUZEN.baslik + 3)?.tur === "iz", satirBul(l, 3)?.tur === "kamera", satirBul(l, 10_000)], [true, true, null]);
});

test("anahtar vuruşu: 7 px içindeki EN YAKIN elmas; uzakta null", () => {
  const l = satirlar(sekans()), g = { x: 0, olcek: 2 };
  const y = izSatiri(l, "bas")!.y + DUZEN.satir / 2;
  assert.deepEqual([anahtarVurus(anahtarKonumlari(l, g), 63, y), anahtarVurus(anahtarKonumlari(l, g), 45, y)], [{ iz: "bas", kare: 30 }, null]);
});

test("kutu seçimi: kutunun içindeki anahtarlar (iki izden)", () => {
  const l = satirlar(sekans()), g = { x: 0, olcek: 2 };
  assert.deepEqual(kutudakiAnahtarlar(anahtarKonumlari(l, g), { x: 50, y: 0, g: 80, h: 200 }), [{ iz: "bas", kare: 30 }, { iz: "kol", kare: 60 }]);
});

test("bölüm vuruşu: sol kenar KIRP, sağ kenar UZAT, iç TAŞI; dışarıda null", () => {
  const l = satirlar(sekans()), g = { x: 0, olcek: 2 };   // bölüm 10–50 kare → 20–100 px
  const k = bolumKutulari(l, g), y = izSatiri(l, "k")!.y + DUZEN.satir / 2;
  assert.deepEqual([bolumVurus(k, 22, y)?.bolge, bolumVurus(k, 98, y)?.bolge, bolumVurus(k, 60, y)?.bolge, bolumVurus(k, 150, y)], ["sol", "sag", "ic", null]);
});

test("dar bölümde iç bölge kalır (kenar en çok üçte bir): ortasından tutunca TAŞI", () => {
  const l = satirlar(sekans()), g = { x: 0, olcek: 0.3 };   // 40 kare → 12 px
  const k = bolumKutulari(l, g)[0]!;
  assert.equal(bolumVurus([k], k.x + k.g / 2, k.y + 2)?.bolge, "ic");
});

test("kesme kutuları: her kesme kendi karesinden sonrakine (sonuncu sekansın sonuna) uzanır, kamera satırında", () => {
  const s0 = sekans();
  const s = { ...s0, kameralar: [{ id: "a", ad: "A", konum: [0, 1, 3], hedef: [0, 1, 0], fov: 50 }], kesmeler: [{ kare: 10, kamera: "a", gecis: "kesme", gecis_kare: 0 }, { kare: 40, kamera: "a", gecis: "yumusak", gecis_kare: 10 }] } as typeof s0;
  const l = satirlar(s), g = { x: 0, olcek: 2 };
  const k = kesmeKutulari(s, l, g);
  assert.deepEqual(k.map((b) => [b.kare, b.x, b.g]), [[10, 20, 60], [40, 80, (s.sure_kare - 40) * 2]]);
  assert.ok(k.every((b) => b.y >= 0 && b.y + b.h <= DUZEN.satir), "kamera satırının içinde");
  assert.equal(kesmeVurus(k, 30, 10), 10);
  assert.equal(kesmeVurus(k, 90, 10), 40);
  assert.equal(kesmeVurus(k, 5, 10), null, "ilk kesmeden önce boş");
  assert.equal(kesmeVurus(k, 30, 100), null, "kamera satırı dışı");
});

test("kesme kutuları: kesmesiz sekansta boş", () => {
  const s = sekans();
  assert.deepEqual(kesmeKutulari(s, satirlar(s), { x: 0, olcek: 2 }), []);
});
