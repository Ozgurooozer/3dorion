// world/level/cekirdek/arazi.ts — Arazi düzenleme ızgarası (spec 22 Faz 7): SEYREK hücre verisi + fırça işlemleri. Saf.
//
// Zemin kendi yükseklik FARKINI (`zemin.duzenleme`), çim/kaya/dekor kendi SEYRELTMESİNİ (`maske`, 0 = dokunulmamış,
// 1 = hiç yok) bu biçimde taşır: modül ayarında düz `number[]` — [anahtar, değer, anahtar, değer, …], yalnız sıfırdan
// farklı hücreler. Dosya küçük kalır (5 m'lik bir fırça vuruşu ~80 hücre), ayar birleştirici ve panel düz dizi
// görür (uzun dizi panelde gösterilmez — alanlar.ts). Hücre (i, j) = dünyada (i·hucre, j·hucre); değer arası
// çift doğrusal — boş hücre 0.
//
// Fırça işlemleri değişen hücrelerin kutusunu (Bolge) döner: modüller yalnız o bölgeyi yeniden yerleştirir.
"use strict";
import type { Bolge } from "./modul.ts";

const OFSET = 2048, GENIS = 4096;
/** Hücre (i, j) → tek sayı anahtar (|i|, |j| < 2048; 2 m hücrede ±4 km). */
export const anahtar = (i: number, j: number): number => (i + OFSET) * GENIS + (j + OFSET);
export const coz = (k: number): [number, number] => [Math.floor(k / GENIS) - OFSET, (k % GENIS) - OFSET];

export type Seyrek = Map<number, number>;

/** Düz diziden (anahtar, değer çiftleri). Bozuk çift FIRLATIR (sessizce yutulmaz). */
export function seyrekOku(dizi: readonly number[]): Seyrek {
  if (dizi.length % 2 !== 0) throw new Error("arazi verisi: çift sayıda eleman olmalı (anahtar, değer)");
  const m: Seyrek = new Map();
  for (let i = 0; i < dizi.length; i += 2) {
    const k = dizi[i]!, v = dizi[i + 1]!;
    if (!Number.isInteger(k) || !Number.isFinite(v)) throw new Error(`arazi verisi: bozuk çift ${i / 2}`);
    if (v !== 0) m.set(k, v);
  }
  return m;
}

/** Düz diziye: anahtara göre sıralı, değer `basamak`a yuvarlı, sıfırlar atılır (dosya farkı kararlı). */
export function seyrekYaz(m: Seyrek, basamak = 2): number[] {
  const k = 10 ** basamak;
  const cikti: number[] = [];
  for (const a of [...m.keys()].sort((x, y) => x - y)) {
    const v = Math.round(m.get(a)! * k) / k;
    if (v !== 0) cikti.push(a, v);
  }
  return cikti;
}

/** (x, z)'de çift doğrusal değer (boş hücre 0). */
export function ornekle(m: Seyrek, hucre: number, x: number, z: number): number {
  if (m.size === 0) return 0;
  const fx = x / hucre, fz = z / hucre;
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
  const d = (a: number, b: number) => m.get(anahtar(a, b)) ?? 0;
  return (d(i, j) * (1 - tx) + d(i + 1, j) * tx) * (1 - tz) + (d(i, j + 1) * (1 - tx) + d(i + 1, j + 1) * tx) * tz;
}

/** İki verinin farklı olduğu hücrelerin kutusu (değer bir hücre ötesine sızar: ±hucre). Fark yoksa null. */
export function farkBolgesi(a: Seyrek, b: Seyrek, hucre: number): Bolge | null {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  const bak = (k: number) => {
    if ((a.get(k) ?? 0) === (b.get(k) ?? 0)) return;
    const [i, j] = coz(k);
    x0 = Math.min(x0, (i - 1) * hucre); x1 = Math.max(x1, (i + 1) * hucre);
    z0 = Math.min(z0, (j - 1) * hucre); z1 = Math.max(z1, (j + 1) * hucre);
  };
  for (const k of a.keys()) bak(k);
  for (const k of b.keys()) bak(k);
  return x0 === Infinity ? null : { x0, z0, x1, z1 };
}

export const bolgeBirlesim = (a: Bolge | null, b: Bolge | null): Bolge | null =>
  !a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), z0: Math.min(a.z0, b.z0), x1: Math.max(a.x1, b.x1), z1: Math.max(a.z1, b.z1) };
export const bolgedeMi = (b: Bolge, x: number, z: number, pay = 0): boolean => x >= b.x0 - pay && x <= b.x1 + pay && z >= b.z0 - pay && z <= b.z1 + pay;

export type AraziIslemi = "yukselt" | "alcalt" | "duzle" | "yumusat" | "asindir" | "puruz" | "rampa" | "sifirla";
export type MaskeIslemi = "sil" | "boya";
/**
 * Düşüş eğrisi (Unreal Landscape fırçalarıyla aynı dört biçim; u = sertlik sınırından kenara 0→1):
 * yumuşak = smoothstep · doğrusal = 1−u · küre = √(1−u²) (yumuşak başlar, sert biter) · uç = 1−√(1−(1−u)²)
 * (sert başlar, yumuşak biter).
 */
export type Dusus = "yumusak" | "dogrusal" | "kure" | "uc";

export interface AraziFircasi {
  x: number; z: number;
  /** Yarıçap (m). */
  yaricap: number;
  /** Bir damganın etkisi: yükselt/alçalt/pürüz için m, diğerlerinde 0–1 oran. */
  guc: number;
  /** Tam etkili iç bölge oranı 0–1 (0 = merkezden kenara düşer, 1 = düz silindir). */
  sertlik: number;
  dusus?: Dusus;
}

/** Merkezden uzaklığa göre ağırlık (0–1). */
export function agirlik(d: number, yaricap: number, sertlik: number, dusus: Dusus = "yumusak"): number {
  const t = d / Math.max(1e-6, yaricap);
  if (t >= 1) return 0;
  const ic = Math.min(0.999, Math.max(0, sertlik));
  if (t <= ic) return 1;
  const u = (t - ic) / (1 - ic);
  switch (dusus) {
    case "dogrusal": return 1 - u;
    case "kure": return Math.sqrt(Math.max(0, 1 - u * u));
    case "uc": return 1 - Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)));
    default: return 1 - u * u * (3 - 2 * u);
  }
}

interface Hucre { i: number; j: number; w: number; x: number; z: number }

/** Fırçanın kapsadığı hücreler ve ağırlıkları. */
function hucreler(f: AraziFircasi, hucre: number): Hucre[] {
  const l: Hucre[] = [];
  const r = Math.ceil(f.yaricap / hucre);
  const ci = Math.round(f.x / hucre), cj = Math.round(f.z / hucre);
  for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) {
    const x = i * hucre, z = j * hucre;
    const w = agirlik(Math.hypot(x - f.x, z - f.z), f.yaricap, f.sertlik, f.dusus);
    if (w > 0) l.push({ i, j, w, x, z });
  }
  return l;
}

/** Düzle/yumuşat/aşındır/pürüz ayrıntıları (Unreal Landscape araçlarının karşılıkları). */
export interface AraziSecenekleri {
  /** Düzle hedefi (m): vuruşun başladığı (ya da "her damgada" ise imlecin altındaki) toplam yükseklik. */
  hedef?: number;
  /** Düzle yalnız yükseltsin / yalnız alçaltsın / ikisi (Unreal Flatten Mode). */
  duzleKip?: "ikisi" | "yukselt" | "alcalt";
  /** Eğime göre düzle (Use Slope Flatten): hedef, başlangıç noktasından geçen ve oradaki normale dik DÜZLEM. */
  egim?: { x: number; z: number; y: number; nx: number; ny: number; nz: number };
  /** Yumuşatma çekirdeği yarıçapı (hücre; Filter Kernel Radius). */
  cekirdek?: number;
  /** Isıl erozyon: dinlenme (talus) açısı (derece) ve damga başına yineleme. */
  talus?: number;
  yineleme?: number;
  /** Pürüz: gürültü ölçeği (m) ve tohumu. */
  puruzOlcek?: number;
  tohum?: number;
}

/** Sürekli değer gürültüsü (pürüz için; tohumlu, saf). */
function deger(x: number, z: number, tohum: number): number {
  const h = (a: number, b: number) => {
    let k = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(tohum, 2246822519)) >>> 0;
    k = Math.imul(k ^ (k >>> 13), 1274126177) >>> 0;
    return ((k ^ (k >>> 16)) >>> 0) / 4294967296;
  };
  const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  return (h(i, j) * (1 - su) + h(i + 1, j) * su) * (1 - sv) + (h(i, j + 1) * (1 - su) + h(i + 1, j + 1) * su) * sv;
}

/**
 * Yükseklik farkına bir damga (yerinde değiştirir). `taban(x, z)` düzenlemesiz arazi yüksekliği (düzle, yumuşat,
 * aşındır TOPLAM yükseklikle çalışır). Rampa ayrı: `rampaUygula`.
 */
export function araziDamgasi(m: Seyrek, hucre: number, f: AraziFircasi, islem: AraziIslemi, taban: (x: number, z: number) => number, s: AraziSecenekleri = {}): void {
  const l = hucreler(f, hucre);
  const toplam = (i: number, j: number) => taban(i * hucre, j * hucre) + (m.get(anahtar(i, j)) ?? 0);
  const yaz = (k: number, v: number) => { if (Math.abs(v) < 0.005) m.delete(k); else m.set(k, v); };
  const oran = Math.min(1, f.guc);
  if (islem === "asindir") { asindir(m, l, toplam, yaz, hucre, oran, s.talus ?? 35, s.yineleme ?? 4); return; }
  // Yumuşat okumaları damga ÖNCESİ değerlerden (sıraya bağlı olmasın): çekirdek dairesindeki toplam yüksekliklerin ortalaması.
  const kr = Math.max(1, Math.round(s.cekirdek ?? 1));
  const ortalama = islem === "yumusat" ? new Map(l.map((h) => {
    let t = 0, n = 0;
    for (let a = -kr; a <= kr; a++) for (let b = -kr; b <= kr; b++) { if (a * a + b * b > kr * kr) continue; t += toplam(h.i + a, h.j + b); n++; }
    return [anahtar(h.i, h.j), t / n] as const;
  })) : null;
  for (const h of l) {
    const k = anahtar(h.i, h.j), v = m.get(k) ?? 0, simdi = taban(h.x, h.z) + v;
    let yeni = v;
    if (islem === "yukselt") yeni = v + f.guc * h.w;
    else if (islem === "alcalt") yeni = v - f.guc * h.w;
    else if (islem === "duzle") {
      const e = s.egim;
      const hedef = e && Math.abs(e.ny) > 1e-3 ? e.y - (e.nx * (h.x - e.x) + e.nz * (h.z - e.z)) / e.ny : (s.hedef ?? simdi);
      let d = (hedef - simdi) * oran * h.w;
      if (s.duzleKip === "yukselt") d = Math.max(0, d); else if (s.duzleKip === "alcalt") d = Math.min(0, d);
      yeni = v + d;
    } else if (islem === "yumusat") yeni = v + (ortalama!.get(k)! - simdi) * oran * h.w;
    else if (islem === "puruz") yeni = v + (deger(h.x / (s.puruzOlcek ?? 4), h.z / (s.puruzOlcek ?? 4), s.tohum ?? 1) - 0.5) * 2 * f.guc * h.w;
    else if (islem === "sifirla") yeni = v * (1 - oran * h.w);
    else continue;
    yaz(k, yeni);
  }
}

/**
 * Isıl erozyon (Musgrave, Kolb ve Mace 1989): eğimi dinlenme açısını aşan hücreden en alçak komşusuna, fazlanın
 * yarısı kadar malzeme kayar (oran × ağırlıkla). Birkaç yineleme: sivri tepeler yayılır, uçurum ayağı yığılır.
 * Malzeme korunur (biri ne kadar kaybederse komşu o kadar alır).
 */
function asindir(m: Seyrek, l: Hucre[], toplam: (i: number, j: number) => number, yaz: (k: number, v: number) => void,
  hucre: number, oran: number, talus: number, yineleme: number): void {
  const esik = Math.tan((talus * Math.PI) / 180) * hucre;
  const KOMSU = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  for (let y = 0; y < yineleme; y++) {
    for (const h of l) {
      const ht = toplam(h.i, h.j);
      let enAlt: readonly [number, number] | null = null, enFark = esik;
      for (const [a, b] of KOMSU) { const d = ht - toplam(h.i + a, h.j + b); if (d > enFark) { enFark = d; enAlt = [a, b]; } }
      if (!enAlt) continue;
      const kay = ((enFark - esik) / 2) * oran * h.w;
      const k1 = anahtar(h.i, h.j), k2 = anahtar(h.i + enAlt[0], h.j + enAlt[1]);
      yaz(k1, (m.get(k1) ?? 0) - kay);
      yaz(k2, (m.get(k2) ?? 0) + kay);
    }
  }
}

/**
 * Rampa (Unreal Ramp): A'dan B'ye düz eğimli yol. Yarı genişlik içinde hedef A ile B yüksekliği arasında doğrusal;
 * yanlara doğru (sertlik/düşüş) mevcut araziye karışır. Uçlarda kesilir (yalnız 0 ≤ t ≤ 1).
 */
export function rampaUygula(m: Seyrek, hucre: number, a: { x: number; z: number; y: number }, b: { x: number; z: number; y: number },
  yariGenislik: number, sertlik: number, dusus: Dusus, taban: (x: number, z: number) => number): void {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
  if (l2 < 1e-6) return;
  const pay = yariGenislik + hucre;
  const i0 = Math.floor((Math.min(a.x, b.x) - pay) / hucre), i1 = Math.ceil((Math.max(a.x, b.x) + pay) / hucre);
  const j0 = Math.floor((Math.min(a.z, b.z) - pay) / hucre), j1 = Math.ceil((Math.max(a.z, b.z) + pay) / hucre);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const x = i * hucre, z = j * hucre;
    const t = ((x - a.x) * dx + (z - a.z) * dz) / l2;
    if (t < 0 || t > 1) continue;
    const w = agirlik(Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)), yariGenislik, sertlik, dusus);
    if (w <= 0) continue;
    const k = anahtar(i, j), v = m.get(k) ?? 0;
    const yeni = v + (a.y + (b.y - a.y) * t - (taban(x, z) + v)) * w;
    if (Math.abs(yeni) < 0.005) m.delete(k); else m.set(k, yeni);
  }
}

/** Seyreltme maskesine bir damga: "sil" 1'e (içerik kalkar), "boya" 0'a (geri gelir). */
export function maskeDamgasi(m: Seyrek, hucre: number, f: AraziFircasi, islem: MaskeIslemi): void {
  for (const h of hucreler(f, hucre)) {
    const k = anahtar(h.i, h.j), v = m.get(k) ?? 0;
    const hedef = islem === "sil" ? 1 : 0;
    const yeni = Math.max(0, Math.min(1, v + (hedef - v) * Math.min(1, f.guc) * h.w));
    if (yeni < 0.01) m.delete(k); else m.set(k, yeni);
  }
}

/** Tutam/nesne kimliğinden belirleyici 0–1 (maske eşiği; tohum sırasını bozmaz). */
export const karma = (i: number): number => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
