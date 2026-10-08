// world/level/moduller/cim.ts — Çim: lowpoly ot tutamları, ince örnek (thin instance) ile TEK çizim çağrısı.
//
// Bir tutam = birkaç yaprak, yaprak = 3 üçgen (kök, gövde, uç); renk kökten uca üç basamak (piksel-sanat
// basamağı, yumuşak gradyan değil). Tutam yerel uzayda kök y = 0, uç y = 1 — rüzgâr eklentisi (cekirdek/ruzgar.ts)
// ucu yüksekliğin karesiyle sallar; boy örnek ölçeğinden gelir.
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
import { flatGeometri, meshKur, type Geometri, type Ucgen, type V3 } from "../cekirdek/geometri.ts";
import { karistir, type Renk } from "../cekirdek/renk.ts";
import { gurultu, rastgele } from "../cekirdek/rastgele.ts";
import type { LevelModulu } from "../cekirdek/modul.ts";

export const CIM_VARSAYILAN = {
  /** Denenecek tutam sayısı (açıklıklara düşenler konmaz). */
  sayi: 40000,
  /** Çim alanının yarıçapı (m). */
  yaricap: 70,
  /** 1 = alan başına eşit; büyüdükçe merkeze yığılır. */
  merkezYogunluk: 1.6,
  boyMin: 0.22,
  boyMax: 0.55,
  /** Yaprağın kök genişliği (m). */
  genislik: 0.07,
  /** Tutamdaki yaprak sayısı. */
  yaprak: 3,
  /** Yaprağın dışa yatması (yerel, boy 1 için). */
  yatma: 0.18,
  /** Öbek ölçeği (m): boy ve açıklık bu gürültüden. */
  lekeOlcek: 6,
  /** Öbek gürültüsü bunun altındaysa tutam yok (açıklık). 0 = her yer çim. */
  bosluk: 0.16,
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
  tohum: 4242,
};
export type CimAyari = typeof CIM_VARSAYILAN;

const yumusak = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1))); return t * t * (3 - 2 * t); };

/** Tek tutamın yerel geometrisi: kök y = 0, uç y = 1, normaller yukarı. */
export function tutamGeometrisi(a: CimAyari): Geometri {
  const rnd = rastgele(a.tohum + 1);
  const n = Math.max(1, Math.round(a.yaprak));
  const w = a.genislik, ton = (k: number): Renk => [k, k, k];
  const u: Ucgen[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 + rnd() * 0.8;
    const dx = Math.cos(t), dz = Math.sin(t);          // yatma yönü
    const px = -dz * w / 2, pz = dx * w / 2;            // yaprak düzlemi (yatmaya dik)
    const yat = a.yatma * (0.6 + rnd() * 0.8);
    const k = (s: number, y: number, d: number): V3 => [px * s + dx * d, y, pz * s + dz * d];
    const k0 = k(-1, 0, 0), k1 = k(1, 0, 0);                         // kök
    const g0 = k(-0.6, 0.5, yat * 0.35), g1 = k(0.6, 0.5, yat * 0.35); // gövde
    const uc = k(0, 1, yat);                                           // uç
    u.push({ a: k0, b: k1, c: g1, renk: ton(a.kokKoyuluk) }, { a: k0, b: g1, c: g0, renk: ton(a.govdeKoyuluk) }, { a: g0, b: g1, c: uc, renk: ton(1) });
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
    const x = Math.cos(aci) * r, z = Math.sin(aci) * r;
    const g = gurultu(x / a.lekeOlcek, z / a.lekeOlcek, a.tohum + 9);
    if (g < a.bosluk) continue;
    const boy = (a.boyMin + boyR * (a.boyMax - a.boyMin)) * (0.55 + 0.9 * g) * (1 - yumusak(a.yaricap * 0.75, a.yaricap, r));
    if (boy <= 0.01) continue;
    Quaternion.RotationYawPitchRollToRef(don, 0, 0, q);
    Matrix.ComposeToRef(olcek.set(1, boy, 1), q, yer.set(x, yukseklik(x, z), z), m);
    m.copyToArray(matris, adet * 16);
    const c = karistir(zeminRengi(x, z) ?? varsayilan, uc, ucR * a.ucKarisim);
    renkler.set([c[0] * parlak, c[1] * parlak, c[2] * parlak, 1], adet * 4);
    adet++;
  }
  return { matris: matris.subarray(0, adet * 16), renk: renkler.subarray(0, adet * 4), adet };
}

export const cimModulu: LevelModulu<CimAyari> = {
  tur: "cim",
  aciklama: "Rüzgârlı lowpoly çim (ince örnek, tek çizim; renk altındaki zeminden). Zeminden sonra gelmeli.",
  varsayilan: CIM_VARSAYILAN,
  aralik: {
    sayi: { min: 0, max: 200000, adim: 1000 }, yaricap: { min: 5, max: 250, adim: 1 }, merkezYogunluk: { min: 1, max: 4, adim: 0.05 },
    boyMin: { min: 0.02, max: 2, adim: 0.01 }, boyMax: { min: 0.02, max: 3, adim: 0.01 }, genislik: { min: 0.01, max: 0.4, adim: 0.005 },
    yaprak: { min: 1, max: 8, adim: 1 }, yatma: { min: 0, max: 0.8, adim: 0.01 }, lekeOlcek: { min: 0.5, max: 40, adim: 0.5 },
    bosluk: { min: 0, max: 0.9, adim: 0.01 }, kokKoyuluk: { min: 0, max: 1, adim: 0.01 }, govdeKoyuluk: { min: 0, max: 1, adim: 0.01 },
    ucKarisim: { min: 0, max: 1, adim: 0.01 }, renkOynama: { min: 0, max: 0.4, adim: 0.01 },
    ruzgarGuc: { min: 0, max: 1, adim: 0.01 }, ruzgarHiz: { min: 0, max: 8, adim: 0.1 }, ruzgarOlcek: { min: 0.005, max: 0.5, adim: 0.005 },
    ruzgarAci: { min: 0, max: 360, adim: 1 }, tohum: { min: 0, max: 9999, adim: 1 },
  },
  kur(b, a) {
    const m = meshKur(b.sahne, "cim", tutamGeometrisi(a));
    const o = cimOrnekleri(a, b.yukseklik, b.zeminRengi, b.renk);
    const malzeme = b.malzeme("cim", "isikli", {
      ciftYuz: true, ruzgar: { guc: a.ruzgarGuc, hiz: a.ruzgarHiz, olcek: a.ruzgarOlcek, aci: a.ruzgarAci },
    });
    m.material = malzeme;
    if (o.adet > 0) {
      m.thinInstanceSetBuffer("matrix", o.matris, 16, true);
      m.thinInstanceSetBuffer("color", o.renk, 4, true);
    } else {
      m.isVisible = false; // örneksiz ince örnek mesh'i tek tutamı merkeze çizerdi
    }
    // Sınır kutusu tek tutamınki; örnekler 70 m'ye yayılıyor — kırpma yanlış gizlemesin.
    m.alwaysSelectAsActiveMesh = true;
    m.freezeWorldMatrix();
    b.golge(m, { alir: true });
    return { meshler: [m], yokEt() { m.dispose(); malzeme.dispose(); } };
  },
};
