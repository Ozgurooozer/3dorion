// world/avatar/rig/halkaSecimi.ts — DÖNDÜRME HALKASI SEÇİMİ, EKRAN UZAYINDA (spec 38 §4). SAF: Babylon yok (izdüşüm dışarıdan).
//
// NEDEN MESH PICK DEĞİL: üç halka aynı merkezli büyük çemberler; kalın görünmez tıklama tüpleri üst üste biniyor ve ışın hangisini ÖNCE keserse onu seçiyordu
// (rigdene: Y/Z ile kesişen noktada X halkası yerine Z seçildi). İnce tüp ise 2 piksele düşüyordu. Çözüm: her halkanın dünyadaki çemberi örneklenir, ekrana
// düşürülür ve imlece EN YAKIN çizgi (en çok `esik` piksel) seçilir — kamera nerede olursa olsun tutma payı sabit pikseldir, kenardan bakan halka çizgiye iner
// ve yine seçilebilir. Dönüş: halka ve tutulan DÜNYA noktası (sürükleme teğeti bu noktadan hesaplanır, `surukleme.ts`).
"use strict";
import type { RigEkseni } from "./poz.ts";
import type { EkranaKoy, V3 } from "./surukleme.ts";

export interface HalkaDuzeni {
  merkez: V3;
  /** Gövde eksenlerinin DÜNYA yönleri (birim). */
  x: V3; y: V3; z: V3;
  /** Halka yarıçapı (m). */
  yaricap: number;
}

const SEGMENT = 64;
const topla = (a: V3, b: V3, c: V3, ka: number, kb: number): V3 => [a[0] + b[0] * ka + c[0] * kb, a[1] + b[1] * ka + c[1] * kb, a[2] + b[2] * ka + c[2] * kb];

/** Bir halkanın düzlemindeki iki eksen: X halkası YZ, Y halkası ZX, Z halkası XY düzleminde. */
function duzlemEksenleri(d: HalkaDuzeni, e: RigEkseni): [V3, V3] {
  return e === "x" ? [d.y, d.z] : e === "y" ? [d.z, d.x] : [d.x, d.y];
}

/** Noktanın doğru parçasına ekran uzaklığı ve parçadaki oran (0..1). */
function parcayaUzaklik(px: number, py: number, ax: number, ay: number, bx: number, by: number): { uzak: number; t: number } {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return { uzak: Math.hypot(px - (ax + dx * t), py - (ay + dy * t)), t };
}

/** İmlece en yakın halka (ekran çizgisine ≤ `esik` px) ve çember üzerindeki dünya noktası; yoksa null. Eşit uzaklıkta X, Y, Z sırası. */
export function enYakinHalka(d: HalkaDuzeni, ekranaKoy: EkranaKoy, x: number, y: number, esik: number): { eksen: RigEkseni; nokta: V3; uzaklik: number } | null {
  let en: { eksen: RigEkseni; nokta: V3; uzaklik: number } | null = null;
  for (const e of ["x", "y", "z"] as const) {
    const [u, v] = duzlemEksenleri(d, e);
    let onceki: V3 | null = null, oncekiEkran = { x: 0, y: 0 };
    for (let i = 0; i <= SEGMENT; i++) {
      const aci = (i / SEGMENT) * Math.PI * 2;
      const p = topla(d.merkez, u, v, Math.cos(aci) * d.yaricap, Math.sin(aci) * d.yaricap);
      const ek = ekranaKoy(p);
      if (onceki) {
        const r = parcayaUzaklik(x, y, oncekiEkran.x, oncekiEkran.y, ek.x, ek.y);
        if (r.uzak <= esik && (!en || r.uzak < en.uzaklik - 1e-9)) {
          en = { eksen: e, uzaklik: r.uzak, nokta: [onceki[0] + (p[0] - onceki[0]) * r.t, onceki[1] + (p[1] - onceki[1]) * r.t, onceki[2] + (p[2] - onceki[2]) * r.t] };
        }
      }
      onceki = p; oncekiEkran = ek;
    }
  }
  return en;
}

export interface OkDuzeni { merkez: V3; x: V3; y: V3; z: V3; /** Ok uzunluğu (m). */ uzunluk: number }

/** İmlece en yakın TAŞI oku (merkezden eksen yönünde `uzunluk` boyunca doğru parçası; ekranda ≤ `esik` px); yoksa null. Eşitlikte X, Y, Z sırası. */
export function enYakinOk(d: OkDuzeni, ekranaKoy: EkranaKoy, x: number, y: number, esik: number): { eksen: RigEkseni; uzaklik: number } | null {
  const a = ekranaKoy(d.merkez);
  let en: { eksen: RigEkseni; uzaklik: number } | null = null;
  for (const e of ["x", "y", "z"] as const) {
    const v = e === "x" ? d.x : e === "y" ? d.y : d.z;
    const b = ekranaKoy([d.merkez[0] + v[0] * d.uzunluk, d.merkez[1] + v[1] * d.uzunluk, d.merkez[2] + v[2] * d.uzunluk]);
    const r = parcayaUzaklik(x, y, a.x, a.y, b.x, b.y);
    if (r.uzak <= esik && (!en || r.uzak < en.uzaklik - 1e-9)) en = { eksen: e, uzaklik: r.uzak };
  }
  return en;
}
