// world/level/editor/cekirdek/yaslama.ts — Izgaraya / açıya / ölçeğe yaslama ve yüzey normaline hizalama. Saf.
//
// Yaslama ayarı editör ayarıdır (level dosyasına değil, tarayıcıya kaydedilir). Ctrl basılıyken sürüklemede
// yaslama GEÇİCİ olarak tersine döner (açıksa serbest, kapalıysa ızgaralı) — `etkin` bunu hesaplar.
"use strict";
import type { Vec3 } from "../../cekirdek/levelTanimi.ts";

export interface YaslamaAyari {
  /** Konum ızgarası açık mı ve adımı (m). Y ekseni ayrı adım (kat yüksekliği gibi). */
  konum: boolean;
  konumAdim: number;
  yAdim: number;
  /** Açı adımı (derece). */
  aci: boolean;
  aciAdim: number;
  /** Ölçek adımı (çarpan). */
  olcek: boolean;
  olcekAdim: number;
  /** Yerleştirme/sürüklemede yüzeye (zemin + nesneler) oturt; kapalıysa tutulan yükseklikte kalır. */
  yuzeyeOtur: boolean;
  /** Yüzeye otururken nesnenin yukarısını yüzey normaline çevir (yamaçta eğik dursun). */
  normaleHizala: boolean;
}

export const YASLAMA_VARSAYILAN: YaslamaAyari = {
  konum: true, konumAdim: 1, yAdim: 0.5,
  aci: true, aciAdim: 15,
  olcek: false, olcekAdim: 0.1,
  yuzeyeOtur: true, normaleHizala: false,
};

/** Adıma yaslar; adım ≤ 0 serbest. Kayan nokta artığı temizlenir (0.30000000000000004 → 0.3). */
export function yasla(v: number, adim: number): number {
  if (!(adim > 0)) return v;
  const r = Math.round(v / adim) * adim;
  return Math.round(r * 1e6) / 1e6 || 0;
}

/** Ctrl basılıyken yaslama tersine döner. */
export const etkin = (acik: boolean, ctrl: boolean): boolean => acik !== ctrl;

/** Konumu ızgaraya yaslar; `eksenler` hangi eksenlerin yaslanacağı (yüzeyde kayarken Y yüzeyden gelir). */
export function konumYasla(v: Vec3, a: YaslamaAyari, acik: boolean, eksenler: readonly [boolean, boolean, boolean] = [true, true, true]): Vec3 {
  if (!acik) return [...v];
  return [eksenler[0] ? yasla(v[0], a.konumAdim) : v[0], eksenler[1] ? yasla(v[1], a.yAdim) : v[1], eksenler[2] ? yasla(v[2], a.konumAdim) : v[2]];
}

const uzunluk = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
const birim = (v: Vec3): Vec3 => { const l = uzunluk(v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/**
 * Yüzey normaline hizalı dönüş (derece, Babylon Euler: rotation.x, .y, .z — yaw·pitch·roll): nesnenin yukarısı
 * (0,1,0) normale döner, ardından normal ÇEVRESİNDE `yaw` derece döner. Düz zeminde [0, yaw, 0].
 *
 * Hesap: Ry(yaw) ile eğim (yukarıyı normale çeviren en kısa dönüş) birleşik matris → Babylon Euler ayrıştırması
 * (Quaternion.toEulerAngles ile aynı sıra). Eğim, yaw'dan SONRA (dünyada) uygulanır.
 */
export function normaleHizaliDonus(normal: Vec3, yaw: number): Vec3 {
  const n = birim(normal);
  if (n[1] > 0.9999) return [0, yaw, 0];
  // Eğim dönüşü: eksen = yukarı × normal, açı = acos(yukarı·normal). Rodrigues ile matris (sütun vektörü düzeni).
  const eksen = birim([n[2], 0, -n[0]]);   // (0,1,0) × n = (1·n.z − 0, 0, 0 − 1·n.x)
  const aci = Math.acos(Math.max(-1, Math.min(1, n[1])));
  const [x, y, z] = eksen, c = Math.cos(aci), s = Math.sin(aci), t = 1 - c;
  const E = [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
  // Babylon (sol el) Y dönüşü, sütun vektörü düzeninde: [[c,0,s],[0,1,0],[−s,0,c]].
  const a = (yaw * Math.PI) / 180, cy = Math.cos(a), sy = Math.sin(a);
  const Y = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
  const R = E.map((satir) => [0, 1, 2].map((j) => satir[0]! * Y[0]![j]! + satir[1]! * Y[1]![j]! + satir[2]! * Y[2]![j]!));
  // R = Ry(β)·Rx(α)·Rz(γ) (Babylon yaw-pitch-roll) ayrıştırması: R[1][2] = −sin α.
  const sa = -R[1]![2]!;
  const alfa = Math.asin(Math.max(-1, Math.min(1, sa)));
  let beta: number, gama: number;
  if (Math.abs(sa) < 0.99999) { beta = Math.atan2(R[0]![2]!, R[2]![2]!); gama = Math.atan2(R[1]![0]!, R[1]![1]!); }
  else { beta = Math.atan2(-R[2]![0]!, R[0]![0]!); gama = 0; }
  const d = 180 / Math.PI;
  return [alfa * d, beta * d, gama * d];
}
