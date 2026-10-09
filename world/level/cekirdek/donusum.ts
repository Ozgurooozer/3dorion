// world/level/cekirdek/donusum.ts — Yerleşimin dönüş/ölçek biçimleri: dosyadaki kısa biçim ↔ editörün tam biçimi. Saf.
//
// Dosyada küçük kalsın diye iki biçim var (levelTanimi.ts NesneYeri): yalnız Y dönüşü SAYI, üç eksen [x, y, z];
// eşit ölçek SAYI, eksen başına [x, y, z]. Editör hep tam biçimle (Vec3) hesaplar, yazarken `kisa*` ile geri
// sıkıştırır — eski dosyalar ve elle yazılanlar değişmeden okunur.
"use strict";
import type { NesneYeri, Vec3 } from "./levelTanimi.ts";

/** Dönüş (derece) tam biçim: sayı → [0, y, 0]. */
export const donusVec = (d: NesneYeri["donus"]): Vec3 => (typeof d === "number" ? [0, d, 0] : [d[0], d[1], d[2]]);
/** Ölçek tam biçim: sayı → [s, s, s]. */
export const olcekVec = (o: NesneYeri["olcek"]): Vec3 => (typeof o === "number" ? [o, o, o] : [o[0], o[1], o[2]]);

/** Sayıyı dosyaya yazılacak kesinliğe yuvarlar (0,0001); -0 → 0. */
export const yuvarla = (v: number, basamak = 4): number => {
  const k = 10 ** basamak, r = Math.round(v * k) / k;
  return r === 0 ? 0 : r;
};
/** Açıyı (−180, 180] aralığına indirir: 370° ile 10° aynı dosya satırı olsun. */
export const aciIndir = (d: number): number => {
  const a = ((((d + 180) % 360) + 360) % 360) - 180;
  return a === -180 ? 180 : a;
};

/** Tam dönüş → dosya biçimi: X ve Z sıfırsa yalnız Y sayısı. */
export function kisaDonus(v: Vec3): NesneYeri["donus"] {
  const [x, y, z] = v.map((a) => yuvarla(aciIndir(a))) as Vec3;
  return x === 0 && z === 0 ? y : [x, y, z];
}
/** Tam ölçek → dosya biçimi: üç eksen eşitse tek sayı. */
export function kisaOlcek(v: Vec3): NesneYeri["olcek"] {
  const [x, y, z] = v.map((s) => yuvarla(s)) as Vec3;
  return x === y && y === z ? x : [x, y, z];
}
/** Konumu dosya kesinliğine yuvarlar (cm altı gürültü dosyaya girmesin). */
export const kisaKonum = (v: Vec3): Vec3 => [yuvarla(v[0], 3), yuvarla(v[1], 3), yuvarla(v[2], 3)];

const RAD = Math.PI / 180;
/** Babylon `rotation` (radyan) değerleri. */
export const donusRadyan = (d: NesneYeri["donus"]): Vec3 => donusVec(d).map((a) => a * RAD) as Vec3;
/** Babylon `rotation` (radyan) → derece. */
export const radyandanDerece = (r: Vec3): Vec3 => r.map((a) => a / RAD) as Vec3;
