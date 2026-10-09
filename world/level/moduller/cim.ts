// world/level/moduller/cim.ts — Çim: kavisli lowpoly ot tutamları, ince örnek (thin instance) + hücre + mesafe detayı (LOD).
//
// Yaprak = KAVİSLİ ŞERİT: `dilim` halka, genişlik uca doğru daralır, uç tek köşe (dilim=4 → 7 üçgen). Renk dilim başına
// üç basamak (kök/gövde/uç; piksel-sanat basamağı, yumuşak gradyan değil). Tutam yerel uzayda kök y = 0, uç y = 1 — rüzgâr
// eklentisi (cekirdek/ruzgar.ts) ucu yüksekliğin karesiyle sallar; boy örnek ölçeğinden gelir.
//
// Optimizasyon: tutamlar `hucre` metrelik karelere bölünür; her hücre kendi mesh'i (kamera dışı hücre kırpılır) ve 3 detay
// seviyesi: yakın = tam tutam, orta = az yaprak/dilim + yarı sayı, uzak = 2 yaprak + çeyrek sayı (kalan tutamlar daha geniş:
// yoğunluk hissi korunur). Hepsi tek malzeme; görünen hücre başına bir çizim.
//
// Canlılık: boy dağılımı geniş (çoğu kısa, az sayıda UZUN tutam), tutam genişliği, yatışı ve eğimi tutam başına oynar.
//
// Renk: tutam altındaki ZEMİN lekesinin rengini alır (`baglam.zeminRengi`), uca doğru `uc` rengine karışır —
// çayır lekeleri çimle sürer. Normal yukarı sabit: çim zeminle aynı ışığı alır (yaprak yaprak parlayıp
// kararmaz), gölgeyi zeminle aynı yerde gösterir.
//
// Dağılım tohumlu: merkeze (yürünen yer) yığılır, gürültü öbekleri uzun/kısa ot ve açıklık verir, alanın
// kenarında boy sıfıra iner (çim alanının sınırı çizgi gibi görünmesin). Zeminden SONRA gelmeli.
"use strict";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { flatGeometri, meshKur, type Geometri, type Ucgen, type V3 } from "../cekirdek/geometri.ts";
import { karistir, type Renk } from "../cekirdek/renk.ts";
import { gurultu, rastgele } from "../cekirdek/rastgele.ts";
import type { LevelModulu } from "../cekirdek/modul.ts";

export const CIM_VARSAYILAN = {
  /** Denenecek tutam sayısı (açıklıklara düşenler konmaz). */
  sayi: 500000,
  /** Çim alanının yarıçapı (m). */
  yaricap: 70,
  /** 1 = alan başına eşit; büyüdükçe merkeze yığılır. */
  merkezYogunluk: 1.6,
  boyMin: 0.14,
  boyMax: 0.5,
  /** Uzun tutam payı ve boy çarpanı (canlılık: kısa otun arasında boy atanlar). */
  uzunOran: 0.07,
  uzunCarpan: 1.9,
  /** Yaprağın kök genişliği (m). */
  genislik: 0.07,
  /** Tutam başına genişlik oynaması (0 = hepsi aynı). */
  genislikOynama: 0.3,
  /** Tutamdaki yaprak sayısı (yakın seviye). */
  yaprak: 5,
  /** Yaprağın dilim sayısı (kavis çözünürlüğü; yakın seviye). */
  dilim: 4,
  /** Tutamın zemine göre rastgele eğimi (radyan, en çok). */
  egilme: 0.2,
  /** Yaprağın dışa yatması (yerel, boy 1 için). */
  yatma: 0.18,
  /** Öbek ölçeği (m): boy ve açıklık bu gürültüden. */
  lekeOlcek: 6,
  /** Öbek gürültüsü bunun altındaysa tutam yok (açıklık). 0 = her yer çim. */
  bosluk: 0.06,
  /** Kökün ve gövdenin renk çarpanı (uç 1). */
  kokKoyuluk: 0.55,
  govdeKoyuluk: 0.78,
  /** Uç rengi ve en çok ne kadar karışacağı. */
  uc: "cimUc",
  ucKarisim: 0.4,
  /** Zemin yoksa tutam rengi. */
  renk: "cimOrta",
  /** Tutam başına parlaklık oynaması. */
  renkOynama: 0.08,
  ruzgarGuc: 0.16,
  ruzgarHiz: 1.8,
  ruzgarOlcek: 0.05,
  ruzgarAci: 35,
  /** Hücre kenarı (m): kırpma ve detay seviyesi hücre başına. */
  hucre: 16,
  /** Orta ve uzak detay seviyesinin başladığı uzaklık (m, hücre merkezinden). */
  mesafe1: 24,
  mesafe2: 55,
  tohum: 4242,
};
export type CimAyari = typeof CIM_VARSAYILAN;

const yumusak = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1))); return t * t * (3 - 2 * t); };

/** Detay seviyesi başına tutam: 0 = yakın (ayardaki), 1 = orta, 2 = uzak. */
const seviyeAyari = (a: CimAyari, seviye: number): { yaprak: number; dilim: number } => {
  if (seviye <= 0) return { yaprak: Math.max(1, Math.round(a.yaprak)), dilim: Math.max(1, Math.round(a.dilim)) };
  if (seviye === 1) return { yaprak: Math.max(2, Math.ceil(a.yaprak * 0.6)), dilim: 2 };
  return { yaprak: 2, dilim: 1 };
};

/** Bir yaprağın üçgen sayısı: 2·dilim − 1 (son halka tek köşe). */
export const yaprakUcgeni = (dilim: number) => 2 * dilim - 1;

/** Tek tutamın yerel geometrisi (seviye 0 = en ayrıntılı): kök y = 0, uç y = 1, normaller yukarı. */
export function tutamGeometrisi(a: CimAyari, seviye = 0): Geometri {
  const rnd = rastgele(a.tohum + 1);
  const { yaprak: n, dilim } = seviyeAyari(a, seviye);
  const w = a.genislik, ton = (k: number): Renk => [k, k, k];
  // Uzak seviyelerde kök rengi açılır: küçücük koyu kök, uzaktan benek gibi görünür (görüntüyle yakalandı).
  const aciklik = 0.3 * seviye;
  const basamak = (t: number) => { const k = t < 0.34 ? a.kokKoyuluk : t < 0.67 ? a.govdeKoyuluk : 1; return k + (1 - k) * aciklik; };
  const u: Ucgen[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 + rnd() * 0.8;
    const dx = Math.cos(t), dz = Math.sin(t);          // yatma yönü
    const px = -dz, pz = dx;                            // yaprak düzlemi (yatmaya dik)
    const yat = a.yatma * (0.6 + rnd() * 0.8);
    const boy = i === 0 ? 1 : 0.65 + rnd() * 0.35;     // en uzun yaprak tam 1 (rüzgâr/ölçek sözleşmesi)
    // Halka k: yükseklik boy·t, yatma t² ile (kavis), yarı genişlik uca doğru daralır; son halka tek köşe.
    const halka = (k: number): V3[] => {
      const h = k / dilim, d = yat * h * h, y = boy * h;
      if (k === dilim) return [[dx * d, y, dz * d]];
      const yar = (w / 2) * (1 - h * 0.9);
      return [[-px * yar + dx * d, y, -pz * yar + dz * d], [px * yar + dx * d, y, pz * yar + dz * d]];
    };
    for (let k = 0; k < dilim; k++) {
      const alt = halka(k), ust = halka(k + 1), renk = ton(basamak((k + 0.5) / dilim));
      if (ust.length === 1) u.push({ a: alt[0]!, b: alt[1]!, c: ust[0]!, renk });
      else u.push({ a: alt[0]!, b: alt[1]!, c: ust[1]!, renk }, { a: alt[0]!, b: ust[1]!, c: ust[0]!, renk });
    }
  }
  const g = flatGeometri(u);
  for (let i = 0; i < g.normal.length; i += 3) g.normal.set([0, 1, 0], i);
  return g;
}

export interface CimOrnekleri { matris: Float32Array; renk: Float32Array; adet: number }

/** Tutam yerleri: dünya matrisleri (16) ve renkler (rgba). Saf; tohumla belirleyici. */
export function cimOrnekleri(
  a: CimAyari, yukseklik: (x: number, z: number) => number, zeminRengi: (x: number, z: number) => Renk | null, renk: (ad: string) => Renk,
): CimOrnekleri {
  const rnd = rastgele(a.tohum);
  const N = Math.max(0, Math.round(a.sayi));
  const matris = new Float32Array(N * 16), renkler = new Float32Array(N * 4);
  const varsayilan = renk(a.renk), uc = renk(a.uc);
  const m = new Matrix(), q = new Quaternion(), olcek = new Vector3(), yer = new Vector3();
  let adet = 0;
  for (let i = 0; i < N; i++) {
    // Her deneme aynı sayıda rnd() çeker: bir ayar açıklığı değiştirince geri kalan tutamlar yerinden oynamasın.
    const aci = rnd() * Math.PI * 2, r = a.yaricap * Math.pow(rnd(), a.merkezYogunluk / 2);
    const don = rnd() * Math.PI * 2, boyR = rnd(), ucR = rnd(), parlak = 1 + (rnd() - 0.5) * 2 * a.renkOynama;
    const uzunR = rnd(), genR = rnd(), egR = rnd(), egR2 = rnd();
    const x = Math.cos(aci) * r, z = Math.sin(aci) * r;
    const g = gurultu(x / a.lekeOlcek, z / a.lekeOlcek, a.tohum + 9);
    if (g < a.bosluk) continue;
    const uzun = uzunR < a.uzunOran ? a.uzunCarpan : 1;
    const boy = (a.boyMin + boyR * (a.boyMax - a.boyMin)) * (0.55 + 0.9 * g) * uzun * (1 - yumusak(a.yaricap * 0.75, a.yaricap, r));
    if (boy <= 0.01) continue;
    const gen = 1 + (genR - 0.5) * 2 * a.genislikOynama;
    Quaternion.RotationYawPitchRollToRef(don, (egR - 0.5) * 2 * a.egilme, (egR2 - 0.5) * 2 * a.egilme, q);
    Matrix.ComposeToRef(olcek.set(gen, boy, gen), q, yer.set(x, yukseklik(x, z), z), m);
    m.copyToArray(matris, adet * 16);
    const c = karistir(zeminRengi(x, z) ?? varsayilan, uc, ucR * a.ucKarisim);
    renkler.set([c[0] * parlak, c[1] * parlak, c[2] * parlak, 1], adet * 4);
    adet++;
  }
  return { matris: matris.subarray(0, adet * 16), renk: renkler.subarray(0, adet * 4), adet };
}

export interface CimHucresi { ix: number; iz: number; idx: number[] }

/** Tutam indekslerini `hucre` metrelik karelere böler. Saf. */
export function cimHucreleri(o: CimOrnekleri, hucre: number): CimHucresi[] {
  const harita = new Map<string, CimHucresi>();
  for (let i = 0; i < o.adet; i++) {
    const ix = Math.floor(o.matris[i * 16 + 12]! / hucre), iz = Math.floor(o.matris[i * 16 + 14]! / hucre);
    const anahtar = `${ix},${iz}`;
    const h = harita.get(anahtar) ?? { ix, iz, idx: [] };
    h.idx.push(i);
    harita.set(anahtar, h);
  }
  return [...harita.values()];
}

/**
 * Seçili tutamlardan her `adim`.'sini alır, yatay ölçeği `genislik` kat büyütür (seyrekleşen çim boş görünmesin).
 * Boy, konum, dönüş ve renk aynı kalır. adim 1 + genislik 1 = düz seçim. Saf.
 */
export function cimAltKume(o: CimOrnekleri, idx: readonly number[], adim: number, genislik: number): CimOrnekleri {
  const secili = idx.filter((_, k) => k % adim === 0);
  const matris = new Float32Array(secili.length * 16), renk = new Float32Array(secili.length * 4);
  secili.forEach((i, k) => {
    matris.set(o.matris.subarray(i * 16, i * 16 + 16), k * 16);
    for (const c of [0, 1, 2, 8, 9, 10]) matris[k * 16 + c] = matris[k * 16 + c]! * genislik;   // x ve z eksen sütunları
    renk.set(o.renk.subarray(i * 4, i * 4 + 4), k * 4);
  });
  return { matris, renk, adet: secili.length };
}

export const cimModulu: LevelModulu<CimAyari> = {
  tur: "cim",
  aciklama: "Rüzgârlı lowpoly çim (kavisli yaprak, hücre + mesafe detayı; renk altındaki zeminden). Zeminden sonra gelmeli.",
  varsayilan: CIM_VARSAYILAN,
  aralik: {
    sayi: { min: 0, max: 1500000, adim: 5000 }, yaricap: { min: 5, max: 250, adim: 1 }, merkezYogunluk: { min: 1, max: 4, adim: 0.05 },
    boyMin: { min: 0.02, max: 2, adim: 0.01 }, boyMax: { min: 0.02, max: 3, adim: 0.01 }, genislik: { min: 0.01, max: 0.4, adim: 0.005 },
    uzunOran: { min: 0, max: 0.5, adim: 0.01 }, uzunCarpan: { min: 1, max: 4, adim: 0.05 }, genislikOynama: { min: 0, max: 0.8, adim: 0.01 },
    yaprak: { min: 1, max: 8, adim: 1 }, dilim: { min: 1, max: 6, adim: 1 }, egilme: { min: 0, max: 0.8, adim: 0.01 },
    yatma: { min: 0, max: 0.8, adim: 0.01 }, lekeOlcek: { min: 0.5, max: 40, adim: 0.5 },
    bosluk: { min: 0, max: 0.9, adim: 0.01 }, kokKoyuluk: { min: 0, max: 1, adim: 0.01 }, govdeKoyuluk: { min: 0, max: 1, adim: 0.01 },
    ucKarisim: { min: 0, max: 1, adim: 0.01 }, renkOynama: { min: 0, max: 0.4, adim: 0.01 },
    ruzgarGuc: { min: 0, max: 1, adim: 0.01 }, ruzgarHiz: { min: 0, max: 8, adim: 0.1 }, ruzgarOlcek: { min: 0.005, max: 0.5, adim: 0.005 },
    ruzgarAci: { min: 0, max: 360, adim: 1 },
    hucre: { min: 4, max: 64, adim: 1 }, mesafe1: { min: 5, max: 200, adim: 1 }, mesafe2: { min: 10, max: 400, adim: 1 },
    tohum: { min: 0, max: 9999, adim: 1 },
  },
  kur(b, a) {
    const o = cimOrnekleri(a, b.yukseklik, b.zeminRengi, b.renk);
    const malzeme = b.malzeme("cim", "isikli", {
      ciftYuz: true, ruzgar: { guc: a.ruzgarGuc, hiz: a.ruzgarHiz, olcek: a.ruzgarOlcek, aci: a.ruzgarAci },
    });
    const meshler: Mesh[] = [];
    // Seviye geometrileri bir kez üretilir; hücre başına her seviye ayrı mesh (kendi örnek tamponu), seviye 1/2 ana mesh'in
    // LOD'u. Örneksiz ince örnek mesh'i tek tutamı merkeze çizerdi: boş hücre hiç kurulmaz (cimHucreleri yalnız dolu verir).
    const geo = [0, 1, 2].map((s) => tutamGeometrisi(a, s));
    const hazirla = (ad: string, g: Geometri, e: CimOrnekleri): Mesh => {
      const m = meshKur(b.sahne, ad, g);
      m.material = malzeme;
      m.thinInstanceSetBuffer("matrix", e.matris, 16, true);
      m.thinInstanceSetBuffer("color", e.renk, 4, true);
      m.thinInstanceRefreshBoundingInfo(true);         // sınır kutusu hücrenin tutamları: kamera dışı hücre kırpılır
      // Çizgi efektine girmez: binlerce yaprak gürültü kenarı üretir, rüzgâr kayması gbuffer'da yok (stil/efektler.ts).
      m.metadata = { cizgisiz: true };
      m.freezeWorldMatrix();
      b.golge(m, { alir: true });
      meshler.push(m);
      return m;
    };
    for (const h of cimHucreleri(o, a.hucre)) {
      const ad = `cim_${h.ix}_${h.iz}`;
      const yakin = hazirla(ad, geo[0]!, cimAltKume(o, h.idx, 1, 1));
      yakin.addLODLevel(a.mesafe1, hazirla(`${ad}_orta`, geo[1]!, cimAltKume(o, h.idx, 2, 1.5)));
      yakin.addLODLevel(a.mesafe2, hazirla(`${ad}_uzak`, geo[2]!, cimAltKume(o, h.idx, 4, 2.4)));
    }
    return { meshler, yokEt() { for (const m of meshler) m.dispose(); malzeme.dispose(); } };
  },
};
