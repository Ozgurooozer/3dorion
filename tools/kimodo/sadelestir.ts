// tools/kimodo/sadelestir.ts — EULER, SADELEŞTİRME ve DÖNGÜ (spec 37 §5). SAF.
//
//   • Euler: her uzvun kare dizisi ÖNCEKİ KAREYE EN YAKIN çözümle (matris.ts `matristenEuler`; ±180 sarma ve YXZ'nin ikinci çözümü), gimbal yakınında y
//     tutulur. Biçimin tavanı ±180°: süreklilik değeri dışarı iterse 360 sarılır ve SAYILIR (o karede doğrusal ara değer kolu tur attırır — uyarı).
//   • Sadeleştirme: kanal başına Ramer–Douglas–Peucker; anahtarlar arası doğrusal ara değerin kare değerinden sapması ≤ tolerans (derece; öteleme için
//     tolerans × 0,005 m). Kanal başına bağımsız: bir dönmenin açı hatası ≤ 3 × tolerans (üç Euler bileşeninin hatası toplanır).
//   • Döngü: en çok benzeyen iki kare (i, j) arası. Benzerlik = eklem konumlarının (kalçaya göre, gövde uzayı) kare ortalama farkı (m) + 0,1 sn × hız
//     farkı (m/sn) — aynı duruş VE aynı yöne gidiş (adımın evresi). Kapanış farkı R(i)·R(j)⁻¹ segmente doğrusal yayılır (son kare ilk kareye eşit).
"use strict";
import { carp, devrik, kesirliDonme, matristenEuler, type Euler, type M3, type V3 } from "./matris.ts";

/** RDP: korunan kare dizinleri (uçlar dahil). Ara değer doğrusal; sapma dikey (değer) farkıdır. */
export function rdp(degerler: readonly number[], tolerans: number): number[] {
  const n = degerler.length;
  if (n <= 2) return [...Array(n).keys()];
  const tut = new Uint8Array(n);
  tut[0] = 1; tut[n - 1] = 1;
  const yigin: [number, number][] = [[0, n - 1]];
  while (yigin.length) {
    const [a, b] = yigin.pop()!;
    let enK = -1, enS = tolerans;
    for (let i = a + 1; i < b; i++) {
      const tah = degerler[a]! + ((degerler[b]! - degerler[a]!) * (i - a)) / (b - a);
      const s = Math.abs(degerler[i]! - tah);
      if (s > enS) { enS = s; enK = i; }
    }
    if (enK >= 0) { tut[enK] = 1; yigin.push([a, enK], [enK, b]); }
  }
  const l: number[] = [];
  for (let i = 0; i < n; i++) if (tut[i]) l.push(i);
  return l;
}

export interface EulerDizisi { x: number[]; y: number[]; z: number[]; sarma: number; gimbal: number }

/** Matris dizisi → sürekli Euler dizisi (derece). */
export function eulerDizisi(l: readonly M3[]): EulerDizisi {
  const d: EulerDizisi = { x: [], y: [], z: [], sarma: 0, gimbal: 0 };
  let onceki: Euler = { x: 0, y: 0, z: 0 };
  for (const m of l) {
    const e = matristenEuler(m, onceki);
    if (e.gimbal) d.gimbal++;
    onceki = { x: e.x, y: e.y, z: e.z };
    for (const k of ["x", "y", "z"] as const) {
      let v = e[k];
      if (Math.abs(v) > 180) { v -= 360 * Math.round(v / 360); d.sarma++; }
      d[k].push(v);
    }
  }
  return d;
}

export interface DonguSecimi { bas: number; bit: number; benzerlik: number }

/**
 * En iyi döngü: `konumlar` eklem başına kare dizisi (gövde uzayı, metre; kalçaya göre). Aday çiftler j − i ≥ `enAz` (ve uçlardan bir kare içeride: hız merkezi
 * farkla). En küçük benzerlik değeri kazanır; ondan en çok %5 kötü adaylar arasında EN UZUN seçilir (aynı kalite, daha çok adım).
 */
export function donguBul(konumlar: readonly (readonly V3[])[], fps: number, enAz = 20): DonguSecimi | null {
  const n = konumlar[0]?.length ?? 0;
  const hiz = konumlar.map((l) => l.map((_, k) => {
    const a = l[Math.max(0, k - 1)]!, b = l[Math.min(n - 1, k + 1)]!;
    return [(b[0] - a[0]) * fps / 2, (b[1] - a[1]) * fps / 2, (b[2] - a[2]) * fps / 2] as V3;
  }));
  const kof = (l: readonly (readonly V3[])[], i: number, j: number) => {
    let t = 0;
    for (const e of l) { const a = e[i]!, b = e[j]!; t += (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; }
    return Math.sqrt(t / l.length);
  };
  const adaylar: DonguSecimi[] = [];
  for (let i = 1; i < n - 1; i++) for (let j = i + enAz; j < n - 1; j++) adaylar.push({ bas: i, bit: j, benzerlik: kof(konumlar, i, j) + 0.1 * kof(hiz, i, j) });
  if (!adaylar.length) return null;
  const enIyi = Math.min(...adaylar.map((a) => a.benzerlik));
  return adaylar.filter((a) => a.benzerlik <= enIyi * 1.05 + 1e-9).sort((a, b) => (b.bit - b.bas) - (a.bit - a.bas) || a.benzerlik - b.benzerlik)[0]!;
}

/** Dönme dizisinin [bas, bit] parçası, kapanış farkı yayılmış: çıkış L+1 kare (L = bit − bas), son = ilk. */
export function donguyuKapat(l: readonly M3[], bas: number, bit: number): M3[] {
  const L = bit - bas;
  const kapanis = carp(l[bas]!, devrik(l[bit]!));   // Q(1)·R(bit) = R(bas)
  return Array.from({ length: L + 1 }, (_, k) => carp(kesirliDonme(kapanis, k / L), l[bas + k]!));
}

/** Sayı dizisinin [bas, bit] parçası, kapanış farkı doğrusal yayılmış. */
export function sayiDongusu(l: readonly number[], bas: number, bit: number): number[] {
  const L = bit - bas, d = l[bit]! - l[bas]!;
  return Array.from({ length: L + 1 }, (_, k) => l[bas + k]! - (d * k) / L);
}
