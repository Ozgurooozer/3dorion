// world/avatar/yolBulma.ts — Oda içi yol bulma: SAF matematik, Babylon YOK.
//
// Neden navmesh değil: oda 10×8 m ve içinde ÜÇ engel var (masa, sandalye,
// raf). Navmesh üretmek, saklamak ve hata ayıklamak bu boyut için ölü ağırlık.
// Bunun yerine **görüş-hattı (visibility) grafiği** kuruyoruz:
//
//   1. Her engelin AABB'si avatar yarıçapı kadar şişirilir.
//   2. Şişmiş kutuların dört köşesi birer düğüm olur (çarpışanlar atılır).
//   3. Başlangıç ve hedef de düğüm olur.
//   4. İki düğüm arasında hiçbir şişmiş kutuyu KESMEYEN doğru parçası varsa
//      aralarına kenar çekilir.
//   5. Dijkstra en kısa yolu verir.
//
// Düğüm sayısı 3 engel × 4 köşe + 2 = 14. O(N²) kenar kurulumu 196 test —
// 20 Hz'de bile ihmal edilebilir ve yalnızca `git` niyeti geldiğinde bir kez
// koşar, her tikte değil.
//
// Bu yaklaşımın DOĞRULANABİLİR olması asıl sebep: `yolBul` girdi→çıktı saf bir
// fonksiyondur. "Masanın öbür yanına git" testinde yol uzunluğunun düz
// çizgiden uzun olduğunu ölçebiliyoruz. Babylon çağrısının içine gömülmüş bir
// çarpışma-kaydırma döngüsü bunu ölçülemez hâle getirirdi.
"use strict";
import { ENGELLER, SINIR, carpisiyorMu, type Kutu } from "../level/olculer.ts";

/** Yön bileşeni bundan küçükse eksene paralel kabul edilir. */
const EPS = 1e-9;

/** Avatar gövde yarıçapı (XZ). Oyuncudan biraz geniş: omuzlar duvara sürtmesin. */
export const AVATAR_YARICAP = 0.34;

/**
 * Köşe düğümü, şişmiş kutunun kenarından bu kadar DIŞARI konur.
 * Sıfır olursa iki komşu köşe arasındaki kenar kutuya tam teğet geçer ve
 * kesişim testi onu (haklı olarak) reddeder — engelin etrafı dolaşılamaz.
 */
const KOSE_PAYI = 0.03;

export interface Nokta2 { x: number; z: number }

interface Dilim { minX: number; maxX: number; minZ: number; maxZ: number }

function sismisDilim(e: Kutu, yaricap: number): Dilim {
  return {
    minX: e.x - e.g / 2 - yaricap, maxX: e.x + e.g / 2 + yaricap,
    minZ: e.z - e.d / 2 - yaricap, maxZ: e.z + e.d / 2 + yaricap,
  };
}

/**
 * Doğru parçası ↔ şişmiş kutu kesişimi (2B slab yöntemi, XZ düzlemi).
 * Teğet geçiş (tam sınırda paralel) kesişim SAYILMAZ — köşe düğümleri
 * arasındaki kenarlar bu yüzden yaşar.
 */
export function parcaKutuKesisiyor(a: Nokta2, b: Nokta2, d: Dilim): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  let t0 = 0;
  let t1 = 1;

  if (Math.abs(dx) < EPS) {
    if (a.x <= d.minX || a.x >= d.maxX) return false;
  } else {
    let ta = (d.minX - a.x) / dx;
    let tb = (d.maxX - a.x) / dx;
    if (ta > tb) { const g = ta; ta = tb; tb = g; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return false;
  }

  if (Math.abs(dz) < EPS) {
    if (a.z <= d.minZ || a.z >= d.maxZ) return false;
  } else {
    let ta = (d.minZ - a.z) / dz;
    let tb = (d.maxZ - a.z) / dz;
    if (ta > tb) { const g = ta; ta = tb; tb = g; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return false;
  }

  return true;
}

/** Nokta duvar içi sınırlarda mı (engeller HARİÇ, yalnızca oda kabuğu). */
function odaIcinde(p: Nokta2, yaricap: number): boolean {
  return p.x - yaricap >= SINIR.minX && p.x + yaricap <= SINIR.maxX
      && p.z - yaricap >= SINIR.minZ && p.z + yaricap <= SINIR.maxZ;
}

/**
 * İki nokta arasında engelsiz görüş hattı var mı.
 *
 * Uç noktaların kendi geçerliliğini SORGULAMAZ (bkz. `yolBul`: başlangıç
 * noktası bir engelin içinde kalmış olabilir, bu durum ayrıca kurtarılır).
 * Yalnızca oda kabuğu ve engel kesişimi bakılır.
 */
export function serbestMi(
  a: Nokta2, b: Nokta2,
  yaricap = AVATAR_YARICAP,
  engeller: readonly Kutu[] = ENGELLER,
): boolean {
  if (!odaIcinde(a, yaricap) || !odaIcinde(b, yaricap)) return false;
  for (const e of engeller) {
    if (parcaKutuKesisiyor(a, b, sismisDilim(e, yaricap))) return false;
  }
  return true;
}

/** Nokta üzerinde durulabilir mi (duvar + engel). `carpisiyorMu`nun tersi. */
export function noktaSerbestMi(p: Nokta2, yaricap = AVATAR_YARICAP): boolean {
  return !carpisiyorMu(p.x, p.z, yaricap);
}

/** Şişmiş engel köşeleri — grafiğin sabit düğümleri. Çarpışanlar atılır. */
export function koseNoktalari(
  yaricap = AVATAR_YARICAP,
  engeller: readonly Kutu[] = ENGELLER,
): Nokta2[] {
  const out: Nokta2[] = [];
  for (const e of engeller) {
    const yx = e.g / 2 + yaricap + KOSE_PAYI;
    const yz = e.d / 2 + yaricap + KOSE_PAYI;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const p = { x: e.x + sx * yx, z: e.z + sz * yz };
        if (noktaSerbestMi(p, yaricap)) out.push(p);
      }
    }
  }
  return out;
}

/**
 * Verilen noktaya en yakın üzerinde DURULABİLİR nokta. Halka taraması:
 * yarıçapı adım adım büyütür, her halkada 16 açı dener. Bulamazsa `null`.
 *
 * İki yerde gerek: (a) hedef bir engelin içindeyse `mesafe` toleransı
 * dahilinde dışına çıkmak, (b) avatar bir şekilde engelin içinde kaldıysa
 * kendini kurtarmak.
 */
export function enYakinSerbest(
  p: Nokta2,
  yaricap = AVATAR_YARICAP,
  azami = 1.5,
  adim = 0.15,
): Nokta2 | null {
  if (noktaSerbestMi(p, yaricap)) return p;
  for (let r = adim; r <= azami + 1e-6; r += adim) {
    let enIyi: Nokta2 | null = null;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const q = { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r };
      if (noktaSerbestMi(q, yaricap)) { enIyi = q; break; }
    }
    if (enIyi) return enIyi;
  }
  return null;
}

function uzaklik(a: Nokta2, b: Nokta2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * `bas`tan `son`a yol. Dönen dizi ARA NOKTALARI ve hedefi içerir, `bas`ı
 * içermez. Doğrudan görüş varsa `[son]` döner.
 *
 * `null` = ulaşılamaz. Çağıran bunu `sonuc: "hata"`ya çevirmek ZORUNDADIR;
 * sessizce yerinde kalmak yasak (bkz. SOZLESME "güvenilmezlik varsayımı").
 */
export function yolBul(
  bas: Nokta2, son: Nokta2,
  yaricap = AVATAR_YARICAP,
  engeller: readonly Kutu[] = ENGELLER,
): Nokta2[] | null {
  if (!noktaSerbestMi(son, yaricap)) return null;

  // Başlangıç bir engelin içinde kaldıysa önce kendini kurtar; o kurtarma
  // noktası yolun ilk adımı olur (görüş hattı aranmaz, kısa bir kaçıştır).
  let onek: Nokta2[] = [];
  let kaynak = bas;
  if (!noktaSerbestMi(bas, yaricap)) {
    const kacis = enYakinSerbest(bas, yaricap);
    if (!kacis) return null;
    onek = [kacis];
    kaynak = kacis;
  }

  if (serbestMi(kaynak, son, yaricap, engeller)) return [...onek, son];

  const dugumler: Nokta2[] = [kaynak, ...koseNoktalari(yaricap, engeller), son];
  const n = dugumler.length;
  const sonIx = n - 1;

  // Komşuluk matrisi. n ≤ 14 — matris kurmak liste tutmaktan ucuz.
  const kenar: number[][] = [];
  for (let i = 0; i < n; i++) kenar.push(new Array<number>(n).fill(Infinity));
  for (let i = 0; i < n; i++) {
    const a = dugumler[i]!;
    for (let j = i + 1; j < n; j++) {
      const b = dugumler[j]!;
      if (!serbestMi(a, b, yaricap, engeller)) continue;
      const m = uzaklik(a, b);
      kenar[i]![j] = m;
      kenar[j]![i] = m;
    }
  }

  // Dijkstra — n küçük olduğu için düz tarama, öbek yok.
  const uzak = new Array<number>(n).fill(Infinity);
  const onceki = new Array<number>(n).fill(-1);
  const bitti = new Array<boolean>(n).fill(false);
  uzak[0] = 0;

  for (let adim = 0; adim < n; adim++) {
    let u = -1;
    let enAz = Infinity;
    for (let i = 0; i < n; i++) {
      if (!bitti[i] && uzak[i]! < enAz) { enAz = uzak[i]!; u = i; }
    }
    if (u < 0) break;
    if (u === sonIx) break;
    bitti[u] = true;
    for (let v = 0; v < n; v++) {
      const w = kenar[u]![v]!;
      if (w === Infinity) continue;
      const yeni = uzak[u]! + w;
      if (yeni < uzak[v]!) { uzak[v] = yeni; onceki[v] = u; }
    }
  }

  if (uzak[sonIx] === Infinity) return null;

  const geri: Nokta2[] = [];
  for (let i = sonIx; i > 0; i = onceki[i]!) {
    geri.push(dugumler[i]!);
    if (onceki[i]! < 0) return null; // bağlantı kopuk — teorik olarak olmaz
  }
  geri.reverse();
  return [...onek, ...geri];
}

/** Bir yolun toplam uzunluğu (başlangıç noktası dahil edilerek). */
export function yolUzunlugu(bas: Nokta2, yol: readonly Nokta2[]): number {
  let toplam = 0;
  let p = bas;
  for (const q of yol) { toplam += uzaklik(p, q); p = q; }
  return toplam;
}
