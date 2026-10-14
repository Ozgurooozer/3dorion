// world/level/gi/isikHacmiCekirdek.ts — IŞIK HACMİ (GI spike 1) SAF ÇEKİRDEĞİ: ızgara, atlas düzeni, üçgen voxelleme,
// ışık paketleme ve algoritmanın CPU REFERANSI (enjeksiyon, mip, koni izleme, ortam küpü). Babylon yok: node:test sınar.
//
// Neden (docs/arastirma/gercek-zamanli-gi-2026-10-14.md §4, "Işık Hacmi"): Ozyn "Lumen gibi, ışık verince aynı anda" istiyor.
// Ofisin geometrisi statik, değişen şey ışık. Bu yüzden iş ikiye bölünür:
//   BİR KEZ (bu dosya, CPU): ofisin üçgenleri 0,1 m voxellere yazılır — doluluk, albedo, ortalama normal, malzeme kimliği.
//   HER KARE (isikHacmiGlsl.ts, GPU): sahnedeki BÜTÜN ışıklar dolu voxellere enjekte edilir (görünürlük = voxel içinde ışın
//   yürütme; gölge haritası yok, çizim yok), ışıma 4 mip'e küçültülür, her yüzey-yakını voxelde 6 eksen yönünde koni izlenir
//   (ortam küpü = voxel başına yoğun prob ızgarası), malzeme eklentisi pikselde ortam küpünü okur.
// GPU kodu bu dosyadaki işlevlerin AYNISINI yapar; sabitler tek yerde (`HACIM`), GLSL şablonu onları buradan alır
// (kopya kural değil bekçi: `isikHacmi.test.ts` GLSL'in bu sabitleri taşıdığını sınar).
//
// Koordinatlar: voxel (i, j, k) = (x, y, z); hücre birimi: voxel i [i, i+1) aralığını kaplar, merkezi i + 0,5. Atlas: y dilimleri
// (j) yan yana karolar; karo en = nx, boy = nz (WebGL2'de 3B dokuya yazmak katman başına çizim ister, 2B atlas tek çizimdir).
"use strict";

export type Vec3 = [number, number, number];

/** Tek kaynak sayılar (GLSL bunları şablona gömer). Uzunluklar VOXEL biriminde, aksi yazmadıkça. */
export const HACIM = {
  /** Voxel boyu (m). Ofis duvarı 0,2 m → 2 voxel kalın (sızma için alt sınır, rapor §7). */
  voxel: 0.1,
  /** Izgara sınırına eklenen pay (m). */
  pay: 0.3,
  /** Işıma mip sayısı: L0..L3 = 0,1 / 0,2 / 0,4 / 0,8 m. */
  mipSayisi: 4,
  /** Toplanacak boş voxeller: bir yüzeye en çok bu kadar (Chebyshev) uzak olanlar. Malzeme örneği yüzeyin 0,75 voxel önünde
   *  alınır; trilineer okuma ±1 hücre dokunur → 2 yeter. */
  yakinYaricap: 2,
  /** Shader'daki ışık dizisinin boyu. Fazlası atlanır ve sayılır (sessiz değil). */
  isikSiniri: 16,
  /** Gölge ışını: adım (voxel), en çok adım, başlangıç ofseti (normal boyunca), nokta ışığın kendi armatüründen kaçış payı. */
  golgeAdimi: 1.0, golgeMaks: 128, golgeOfset: 1.0, armaturPayi: 2.0,
  /** Koni: tan(yarı açı), boş voxelde başlangıç, dolu voxelde başlangıç, adım = çap × oran, en uzun yol, doyma (önü kapandı).
   *  30°: ilk sürüm 45° idi (6 koni küreyi ~%88 örter) ama kaba mip'e çabuk çıkıp 1 voxellik duvarı ortalamada eritti — birim
   *  testinde 8 voxel ötedeki ışıyan duvarın %8'i görüldü, araya giren perde ışığı kesmedi (bkz. `koniIzle` doluluk düzeltmesi).
   *  Ortam küpü yön başına ORTALAMA ışıma ister; dar koni ortalamayı korur (düzgün ortamda E = L), yalnız seyrek örnekler. */
  koniTan: 0.577, koniBaslangic: 1.0, koniDoluBaslangic: 1.5, koniAdimOrani: 0.5, koniMaks: 48, koniDoyma: 0.95,
  /** Dolu voxel bu yöne bakmıyorsa (normal · yön < eşik) o yönde toplama yapılmaz (yüzeyin içine bakan koni). */
  arkaEsik: -0.5,
  /** Malzemede örnek noktası: yüzeyden normal boyunca bu kadar dışarı (sızmayı azaltır). */
  ornekOfset: 0.75,
} as const;

/** Ortam küpünün 6 yönü; blok sırası atlas ve shader ile aynı. */
export const YONLER: readonly Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// ── Izgara ve atlas ────────────────────────────────────────────────────────

export interface Izgara {
  /** Dünyada (0,0,0) hücresinin köşesi (m). */
  koken: Vec3;
  /** Voxel boyu (m). */
  voxel: number;
  /** Hücre sayısı (x, y, z). */
  n: Vec3;
}

/** Sınır kutusundan ızgara (pay eklenir, boyut yukarı yuvarlanır). */
export function izgaraKur(min: Vec3, max: Vec3, voxel: number = HACIM.voxel, pay: number = HACIM.pay): Izgara {
  const koken: Vec3 = [min[0] - pay, min[1] - pay, min[2] - pay];
  const n: Vec3 = [0, 0, 0];
  for (let e = 0; e < 3; e++) n[e] = Math.max(1, Math.ceil((max[e]! - min[e]! + 2 * pay) / voxel - 1e-9));
  return { koken, voxel, n };
}

export const voxelSayisi = (n: Vec3) => n[0] * n[1] * n[2];

/** Doğrusal indeks (CPU dizileri): y dilimi en dışta (atlasla aynı sıra). */
export const indeks = (n: Vec3, i: number, j: number, k: number) => i + n[0] * (k + n[2] * j);

/** Dünya noktası (m) → sürekli hücre koordinatı. */
export function hucreye(iz: Izgara, p: Vec3): Vec3 {
  return [(p[0] - iz.koken[0]) / iz.voxel, (p[1] - iz.koken[1]) / iz.voxel, (p[2] - iz.koken[2]) / iz.voxel];
}

export interface Atlas {
  /** Karo sütun / satır sayısı; karo = bir y dilimi (en nx, boy nz). */
  sutun: number;
  satir: number;
  /** Doku boyutu (teksel). */
  en: number;
  boy: number;
}

/** y dilimlerini yaklaşık kare bir 2B dokuya dizer. */
export function atlasDuzeni(n: Vec3): Atlas {
  const sutun = Math.max(1, Math.min(n[1], Math.round(Math.sqrt((n[1] * n[2]) / n[0]))));
  const satir = Math.ceil(n[1] / sutun);
  return { sutun, satir, en: sutun * n[0], boy: satir * n[2] };
}

/** Voxelin atlas tekseli (x sağa, y dokunun 0. satırından yukarı). */
export function atlasTekseli(a: Atlas, n: Vec3, i: number, j: number, k: number): [number, number] {
  return [(j % a.sutun) * n[0] + i, Math.floor(j / a.sutun) * n[2] + k];
}

/** Teksel → voxel (karonun dışındaki boş karolar null). Shader'daki çözümün aynısı. */
export function tekseldenVoxele(a: Atlas, n: Vec3, x: number, y: number): [number, number, number] | null {
  const tx = Math.floor(x / n[0]), ty = Math.floor(y / n[2]);
  const j = ty * a.sutun + tx;
  if (tx >= a.sutun || j >= n[1] || x < 0 || y < 0) return null;
  return [x - tx * n[0], j, y - ty * n[2]];
}

/** L. mip'in hücre sayısı. */
export const mipBoyutu = (n: Vec3, L: number): Vec3 => [
  Math.max(1, Math.ceil(n[0] / 2 ** L)), Math.max(1, Math.ceil(n[1] / 2 ** L)), Math.max(1, Math.ceil(n[2] / 2 ** L)),
];

/** Işınım (6 yön) atlası: L0 atlasından 3 × 2 blok. */
export const IRR_BLOK = { sutun: 3, satir: 2 } as const;

/** GPU dokularının bayt cinsinden beklenen boyu (VRAM tahmini; ölçüm DEĞİL). */
export function vramTahmini(iz: Izgara): { statik: number; isima: number; irr: number; tablo: number; toplam: number } {
  const a0 = atlasDuzeni(iz.n);
  const statik = 2 * a0.en * a0.boy * 4;                       // 2 × RGBA8
  let isima = 0;
  for (let L = 0; L < HACIM.mipSayisi; L++) { const a = atlasDuzeni(mipBoyutu(iz.n, L)); isima += a.en * a.boy * 8; } // RGBA16F
  const irr = IRR_BLOK.sutun * IRR_BLOK.satir * a0.en * a0.boy * 8;
  const tablo = 256 * 4 * 4;                                     // RGBA32F
  return { statik, isima, irr, tablo, toplam: statik + isima + irr + tablo };
}

// ── Voxelleme (bir kez, CPU) ──────────────────────────────────────────────

export interface VoxelBirikimi {
  izgara: Izgara;
  sayac: Uint32Array;
  albedo: Float32Array;     // 3 × N toplam
  normal: Float32Array;     // 3 × N toplam (alan ağırlıklı)
  malzeme: Uint8Array;
  oncelik: Float32Array;    // malzeme seçimi: ışıyan malzeme duvarı ezsin (neon şeridi tavana yapışık)
}

export interface VoxelVerisi {
  izgara: Izgara;
  dolu: Uint8Array;
  albedo: Float32Array;     // 3 × N ortalama
  normal: Float32Array;     // 3 × N birim ya da 0 (belirsiz: çift yüzlü ince parça)
  malzeme: Uint8Array;      // 0 = yok, 1..255
  yakin: Uint8Array;        // boş VE bir yüzeye `yakinYaricap` içinde
}

export function birikimKur(iz: Izgara): VoxelBirikimi {
  const N = voxelSayisi(iz.n);
  return {
    izgara: iz, sayac: new Uint32Array(N), albedo: new Float32Array(3 * N), normal: new Float32Array(3 * N),
    malzeme: new Uint8Array(N), oncelik: new Float32Array(N).fill(-1),
  };
}

export interface UcgenMalzemesi {
  /** 1..255 (ışıma tablosundaki satır). */
  indeks: number;
  albedo: Vec3;
  /** Aynı voxele düşen iki malzemeden önceliği büyük olan kalır (ışıma parlaklığı). */
  oncelik: number;
}

function yaz(b: VoxelBirikimi, p: Vec3, nrm: Vec3, m: UcgenMalzemesi): void {
  const iz = b.izgara;
  const i = Math.floor((p[0] - iz.koken[0]) / iz.voxel), j = Math.floor((p[1] - iz.koken[1]) / iz.voxel), k = Math.floor((p[2] - iz.koken[2]) / iz.voxel);
  if (i < 0 || j < 0 || k < 0 || i >= iz.n[0] || j >= iz.n[1] || k >= iz.n[2]) return;
  const v = indeks(iz.n, i, j, k);
  b.sayac[v]! += 1;
  b.albedo[3 * v]! += m.albedo[0]; b.albedo[3 * v + 1]! += m.albedo[1]; b.albedo[3 * v + 2]! += m.albedo[2];
  b.normal[3 * v]! += nrm[0]; b.normal[3 * v + 1]! += nrm[1]; b.normal[3 * v + 2]! += nrm[2];
  if (m.oncelik > b.oncelik[v]!) { b.oncelik[v] = m.oncelik; b.malzeme[v] = m.indeks; }
}

/**
 * Üçgeni yüzeyde ≤ voxel/2 aralıklı afin örgüyle örnekler; her örnek düştüğü voxele yazılır (yaklaşık tutucu: üçgenin
 * içinden geçtiği her voxel en az bir örnek alır, sıyırıp geçen çok ince kesitler kaçabilir — bilinen sınır).
 */
export function ucgenVoxelle(b: VoxelBirikimi, a: Vec3, c1: Vec3, c2: Vec3, nrm: Vec3, m: UcgenMalzemesi): void {
  const h = b.izgara.voxel * 0.5;
  const e1: Vec3 = [c1[0] - a[0], c1[1] - a[1], c1[2] - a[2]];
  const e2: Vec3 = [c2[0] - a[0], c2[1] - a[1], c2[2] - a[2]];
  const uz = Math.max(Math.hypot(...e1), Math.hypot(...e2), Math.hypot(c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]));
  const N = Math.max(1, Math.ceil(uz / h));
  for (let s = 0; s <= N; s++) {
    for (let t = 0; t <= N - s; t++) {
      const u = s / N, w = t / N;
      yaz(b, [a[0] + e1[0] * u + e2[0] * w, a[1] + e1[1] * u + e2[1] * w, a[2] + e1[2] * u + e2[2] * w], nrm, m);
    }
  }
}

/**
 * Bir mesh'in üçgenlerini voxeller. `dunya`: Babylon matrisi (`Matrix.m`, satır vektör düzeni: x' = m0 x + m4 y + m8 z + m12).
 * `normaller` verilirse köşe normallerinin ortalaması (dünyaya çevrilmiş) kullanılır — glTF'in sağ→sol el dönüşümü (z ayna)
 * sarma yönünü çevirir, köşe normali çevirmez; yoksa üçgenin çapraz çarpımı. Dönen: işlenen üçgen sayısı.
 */
export function meshVoxelle(
  b: VoxelBirikimi, konum: ArrayLike<number>, indeksler: ArrayLike<number> | null, dunya: ArrayLike<number>,
  m: UcgenMalzemesi, normaller: ArrayLike<number> | null = null,
): number {
  const M = dunya;
  const nok = (v: number): Vec3 => {
    const x = konum[3 * v]!, y = konum[3 * v + 1]!, z = konum[3 * v + 2]!;
    return [M[0]! * x + M[4]! * y + M[8]! * z + M[12]!, M[1]! * x + M[5]! * y + M[9]! * z + M[13]!, M[2]! * x + M[6]! * y + M[10]! * z + M[14]!];
  };
  const yon = (v: number): Vec3 => {
    const x = normaller![3 * v]!, y = normaller![3 * v + 1]!, z = normaller![3 * v + 2]!;
    return [M[0]! * x + M[4]! * y + M[8]! * z, M[1]! * x + M[5]! * y + M[9]! * z, M[2]! * x + M[6]! * y + M[10]! * z];
  };
  const ucgen = indeksler ? Math.floor(indeksler.length / 3) : Math.floor(konum.length / 9);
  for (let t = 0; t < ucgen; t++) {
    const i0 = indeksler ? indeksler[3 * t]! : 3 * t, i1 = indeksler ? indeksler[3 * t + 1]! : 3 * t + 1, i2 = indeksler ? indeksler[3 * t + 2]! : 3 * t + 2;
    const a = nok(i0), c1 = nok(i1), c2 = nok(i2);
    let nr: Vec3;
    if (normaller) {
      const n0 = yon(i0), n1 = yon(i1), n2 = yon(i2);
      nr = [n0[0] + n1[0] + n2[0], n0[1] + n1[1] + n2[1], n0[2] + n1[2] + n2[2]];
    } else {
      const e1 = [c1[0] - a[0], c1[1] - a[1], c1[2] - a[2]], e2 = [c2[0] - a[0], c2[1] - a[1], c2[2] - a[2]];
      nr = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    }
    const l = Math.hypot(...nr) || 1;
    ucgenVoxelle(b, a, c1, c2, [nr[0] / l, nr[1] / l, nr[2] / l], m);
  }
  return ucgen;
}

/** Birikimi bitirir: ortalama albedo, birim normal (ortalaması < 0,3 olan çift yönlü voxelde 0), yakınlık maskesi. */
export function birikimiBitir(b: VoxelBirikimi): VoxelVerisi {
  const iz = b.izgara, N = voxelSayisi(iz.n);
  const dolu = new Uint8Array(N), albedo = new Float32Array(3 * N), normal = new Float32Array(3 * N);
  for (let v = 0; v < N; v++) {
    const s = b.sayac[v]!;
    if (s === 0) continue;
    dolu[v] = 1;
    for (let c = 0; c < 3; c++) albedo[3 * v + c] = b.albedo[3 * v + c]! / s;
    const nx = b.normal[3 * v]! / s, ny = b.normal[3 * v + 1]! / s, nz = b.normal[3 * v + 2]! / s;
    const l = Math.hypot(nx, ny, nz);
    if (l >= 0.3) { normal[3 * v] = nx / l; normal[3 * v + 1] = ny / l; normal[3 * v + 2] = nz / l; }
  }
  return { izgara: iz, dolu, albedo, normal, malzeme: b.malzeme.slice(), yakin: yakinlikMaskesi(iz.n, dolu, HACIM.yakinYaricap) };
}

/** Boş voxellerden bir dolu voxele Chebyshev uzaklığı ≤ r olanlar (ayrışabilir en büyük süzgeci, eksen eksen). */
export function yakinlikMaskesi(n: Vec3, dolu: Uint8Array, r: number): Uint8Array {
  let a = dolu.slice();
  const eksen = (src: Uint8Array, e: 0 | 1 | 2) => {
    const out = new Uint8Array(src.length);
    for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) for (let i = 0; i < n[0]; i++) {
      if (!src[indeks(n, i, j, k)]) continue;
      for (let d = -r; d <= r; d++) {
        const ii = e === 0 ? i + d : i, jj = e === 1 ? j + d : j, kk = e === 2 ? k + d : k;
        if (ii < 0 || jj < 0 || kk < 0 || ii >= n[0] || jj >= n[1] || kk >= n[2]) continue;
        out[indeks(n, ii, jj, kk)] = 1;
      }
    }
    return out;
  };
  a = eksen(eksen(eksen(a, 0), 1), 2);
  for (let v = 0; v < a.length; v++) if (dolu[v]) a[v] = 0;
  return a;
}

// ── Işıklar ────────────────────────────────────────────────────────────────

/** Babylon `Light.getTypeID()` ile aynı sayılar. */
export const ISIK_TURU = { nokta: 0, yonlu: 1, spot: 2, yarikure: 3 } as const;
export type IsikTuru = (typeof ISIK_TURU)[keyof typeof ISIK_TURU];

/** Işığın GI'nin gördüğü hâli (Babylon'dan bağımsız). Renkler şiddetle çarpılmış. */
export interface IsikVerisi {
  tur: IsikTuru;
  /** Nokta/spot: konum (m). */
  konum: Vec3;
  /** Yönlü/spot: ışığın GİTTİĞİ yön (birim). Yarıküre: göğe doğru yön (Babylon `HemisphericLight.direction`). */
  yon: Vec3;
  /** diffuse × intensity. Yarıküre: gök rengi. */
  renk: Vec3;
  /** Nokta/spot menzili (m; Babylon Standard: doğrusal düşüş 1 − d/menzil). Sonsuz = Number.MAX_VALUE. */
  menzil: number;
  /** Spot: cos(açı/2). */
  cosYari: number;
  /** Spot üssü. */
  us: number;
  /** Yarıküre: zemin rengi × intensity. */
  zemin: Vec3;
}

/**
 * Işık GI'ye girsin mi? Kapalı ya da sıfır şiddetli ışık girmez; YARDIMCI ışık da girmez: `includedOnlyMeshes` listesi dolu
 * ama listedekilerin hiçbiri görünür değil (ör. GIRSM'in `gi_isik`'i yalnız görünmez bir yer tutucuyu "aydınlatır").
 * Üyelik listeleri (ofis/ova ayrımı) GI'yi BAĞLAMAZ: gerçek görünürlük voxelde bulunur.
 */
export function isikGecerliMi(x: { etkin: boolean; siddet: number; yalnizListesi: number; yalnizGorunen: number }): boolean {
  if (!x.etkin || !(x.siddet > 0)) return false;
  return !(x.yalnizListesi > 0 && x.yalnizGorunen === 0);
}

export interface IsikPaketi { a: Float32Array; b: Float32Array; c: Float32Array; d: Float32Array; sayi: number; atlanan: number }

/** Shader dizileri (vec4 × sınır): a = konum, tür · b = yön, cos(yarı açı) · c = renk, menzil · d = zemin, üs. */
export function isikPaketle(liste: readonly IsikVerisi[], sinir: number = HACIM.isikSiniri): IsikPaketi {
  const p: IsikPaketi = { a: new Float32Array(4 * sinir), b: new Float32Array(4 * sinir), c: new Float32Array(4 * sinir), d: new Float32Array(4 * sinir), sayi: 0, atlanan: 0 };
  for (const l of liste) {
    if (p.sayi >= sinir) { p.atlanan++; continue; }
    const o = 4 * p.sayi++;
    p.a.set([...l.konum, l.tur], o);
    p.b.set([...l.yon, l.cosYari], o);
    // Float32 MAX_VALUE'yu taşımaz (sonsuz olur): "sonsuz menzil" 1e30.
    p.c.set([...l.renk, Math.min(l.menzil, 1e30)], o);
    p.d.set([...l.zemin, l.us], o);
  }
  return p;
}

// ── CPU referansı: enjeksiyon ─────────────────────────────────────────────

const nokta3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Hücre koordinatındaki nokta dolu mu (en yakın voxel; ızgara dışı = boş). */
function doluMu(v: VoxelVerisi, q: Vec3): boolean | null {
  const n = v.izgara.n;
  const i = Math.floor(q[0]), j = Math.floor(q[1]), k = Math.floor(q[2]);
  if (i < 0 || j < 0 || k < 0 || i >= n[0] || j >= n[1] || k >= n[2]) return null;
  return v.dolu[indeks(n, i, j, k)] === 1;
}

/**
 * Görünürlük: `p`'den (hücre koordinatı) `yon` boyunca `uzunluk` voxel yürü; dolu voxele çarparsa 0. Izgaradan çıkmak = açık
 * (ızgara dışını bilmiyoruz: ofis dışı boş sayılır).
 */
export function gorunurluk(v: VoxelVerisi, p: Vec3, yon: Vec3, uzunluk: number): number {
  for (let t = 0; t < uzunluk; t += HACIM.golgeAdimi) {
    const d = doluMu(v, [p[0] + yon[0] * t, p[1] + yon[1] * t, p[2] + yon[2] * t]);
    if (d === null) return 1;
    if (d) return 0;
  }
  return 1;
}

/** Voxelin (i, j, k) bütün ışıklardan aldığı doğrudan ışık (albedo'suz, Babylon Standard düşüşüyle). */
export function dogrudanIsik(v: VoxelVerisi, i: number, j: number, k: number, isiklar: readonly IsikVerisi[]): Vec3 {
  const iz = v.izgara, vi = indeks(iz.n, i, j, k);
  const N: Vec3 = [v.normal[3 * vi]!, v.normal[3 * vi + 1]!, v.normal[3 * vi + 2]!];
  const normalVar = N[0] !== 0 || N[1] !== 0 || N[2] !== 0;
  const p: Vec3 = [i + 0.5, j + 0.5, k + 0.5];
  const out: Vec3 = [0, 0, 0];
  for (const l of isiklar) {
    let L: Vec3, uzunluk: number, siddet = 1;
    let renk = l.renk;
    if (l.tur === ISIK_TURU.nokta || l.tur === ISIK_TURU.spot) {
      const q = hucreye(iz, l.konum);
      const d: Vec3 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
      const dv = Math.hypot(...d);                      // voxel
      const dm = dv * iz.voxel;                         // m
      siddet = Math.max(0, 1 - dm / l.menzil);
      if (siddet <= 0) continue;
      L = dv > 0 ? [d[0] / dv, d[1] / dv, d[2] / dv] : [0, 1, 0];
      if (l.tur === ISIK_TURU.spot) {
        const c = -nokta3(L, l.yon);
        if (c < l.cosYari) continue;
        siddet *= Math.max(0, c) ** l.us;
      }
      uzunluk = dv - HACIM.armaturPayi;
    } else if (l.tur === ISIK_TURU.yonlu) {
      L = [-l.yon[0], -l.yon[1], -l.yon[2]];
      uzunluk = HACIM.golgeMaks;
    } else {
      L = l.yon;
      uzunluk = HACIM.golgeMaks;
      const h = normalVar ? 0.5 + 0.5 * nokta3(N, l.yon) : 0.5;
      renk = [l.zemin[0] + (l.renk[0] - l.zemin[0]) * h, l.zemin[1] + (l.renk[1] - l.zemin[1]) * h, l.zemin[2] + (l.renk[2] - l.zemin[2]) * h];
    }
    const ndl = l.tur === ISIK_TURU.yarikure ? 1 : normalVar ? Math.max(0, nokta3(N, L)) : 1;
    if (ndl <= 0) continue;
    const o = normalVar ? N : L;
    const bas: Vec3 = [p[0] + o[0] * HACIM.golgeOfset, p[1] + o[1] * HACIM.golgeOfset, p[2] + o[2] * HACIM.golgeOfset];
    const g = gorunurluk(v, bas, L, Math.min(uzunluk, HACIM.golgeMaks));
    if (g <= 0) continue;
    const s = siddet * ndl * g;
    out[0] += renk[0] * s; out[1] += renk[1] * s; out[2] += renk[2] * s;
  }
  return out;
}

/**
 * L0 ışıması (RGBA, voxel başına 4): dolu voxelde rgb = albedo × (doğrudan + sekme × önceki karenin ışınımı) + ışıma
 * (malzeme tablosundan, her kare canlı), a = 1; boş voxel 0.
 */
export function enjekte(
  v: VoxelVerisi, isiklar: readonly IsikVerisi[], isima: (malzeme: number) => Vec3,
  onceki: Float32Array | null = null, sekme = 0,
): Float32Array {
  const n = v.izgara.n, N = voxelSayisi(n);
  const out = new Float32Array(4 * N);
  for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) for (let i = 0; i < n[0]; i++) {
    const vi = indeks(n, i, j, k);
    if (!v.dolu[vi]) continue;
    const d = dogrudanIsik(v, i, j, k, isiklar);
    if (onceki && sekme > 0) {
      const e = ortamKupuVoxel(onceki, N, vi, [v.normal[3 * vi]!, v.normal[3 * vi + 1]!, v.normal[3 * vi + 2]!]);
      d[0] += sekme * e[0]; d[1] += sekme * e[1]; d[2] += sekme * e[2];
    }
    const em = isima(v.malzeme[vi]!);
    for (let c = 0; c < 3; c++) out[4 * vi + c] = v.albedo[3 * vi + c]! * d[c]! + em[c]!;
    out[4 * vi + 3] = 1;
  }
  return out;
}

// ── CPU referansı: mip, örnekleme, koni ───────────────────────────────────

export interface Seviye { veri: Float32Array; n: Vec3 }

/** 2 × 2 × 2 ortalama (tek boyutlu kenarda kenar hücresi tekrar). rgb önceden doluluk çarpımlı olduğundan ortalama doğru. */
export function mipKucult(s: Seviye): Seviye {
  const n2: Vec3 = [Math.max(1, Math.ceil(s.n[0] / 2)), Math.max(1, Math.ceil(s.n[1] / 2)), Math.max(1, Math.ceil(s.n[2] / 2))];
  const out = new Float32Array(4 * voxelSayisi(n2));
  for (let j = 0; j < n2[1]; j++) for (let k = 0; k < n2[2]; k++) for (let i = 0; i < n2[0]; i++) {
    const o = 4 * indeks(n2, i, j, k);
    for (let dj = 0; dj < 2; dj++) for (let dk = 0; dk < 2; dk++) for (let di = 0; di < 2; di++) {
      const ii = Math.min(2 * i + di, s.n[0] - 1), jj = Math.min(2 * j + dj, s.n[1] - 1), kk = Math.min(2 * k + dk, s.n[2] - 1);
      const q = 4 * indeks(s.n, ii, jj, kk);
      for (let c = 0; c < 4; c++) out[o + c]! += s.veri[q + c]! / 8;
    }
  }
  return { veri: out, n: n2 };
}

/** L0'dan `HACIM.mipSayisi` seviye. */
export function mipZinciri(L0: Seviye): Seviye[] {
  const s = [L0];
  while (s.length < HACIM.mipSayisi) s.push(mipKucult(s[s.length - 1]!));
  return s;
}

/** Trilineer örnek (hücre koordinatı, o seviyenin biriminde); ızgara dışı 0 (shader ile aynı kural). */
export function ornekle(s: Seviye, g: Vec3): [number, number, number, number] {
  const n = s.n;
  if (g[0] < 0 || g[1] < 0 || g[2] < 0 || g[0] > n[0] || g[1] > n[1] || g[2] > n[2]) return [0, 0, 0, 0];
  const c = [g[0] - 0.5, g[1] - 0.5, g[2] - 0.5];
  const out: [number, number, number, number] = [0, 0, 0, 0];
  const i0 = Math.floor(c[0]!), j0 = Math.floor(c[1]!), k0 = Math.floor(c[2]!);
  const fx = c[0]! - i0, fy = c[1]! - j0, fz = c[2]! - k0;
  for (let dj = 0; dj < 2; dj++) for (let dk = 0; dk < 2; dk++) for (let di = 0; di < 2; di++) {
    const ii = Math.min(Math.max(i0 + di, 0), n[0] - 1), jj = Math.min(Math.max(j0 + dj, 0), n[1] - 1), kk = Math.min(Math.max(k0 + dk, 0), n[2] - 1);
    const w = (di ? fx : 1 - fx) * (dj ? fy : 1 - fy) * (dk ? fz : 1 - fz);
    const q = 4 * indeks(n, ii, jj, kk);
    for (let ch = 0; ch < 4; ch++) out[ch]! += w * s.veri[q + ch]!;
  }
  return out;
}

/** Sürekli mip seviyesinde örnek: iki komşu seviye arası doğrusal (koni çapı seviyeyi seçer). */
function seviyeOrnekle(sv: readonly Seviye[], q0: Vec3, lvl: number): [number, number, number, number] {
  const a = Math.floor(lvl), f = lvl - a, b = Math.min(a + 1, sv.length - 1);
  const s = (L: number) => { const k = 2 ** L; return ornekle(sv[L]!, [q0[0] / k, q0[1] / k, q0[2] / k]); };
  const x = s(a);
  if (f <= 0 || b === a) return x;
  const y = s(b);
  return [x[0] + (y[0] - x[0]) * f, x[1] + (y[1] - x[1]) * f, x[2] + (y[2] - x[2]) * f, x[3] + (y[3] - x[3]) * f];
}

/**
 * Kaba hücrenin doluluk düzeltmesi: L seviyesindeki ortalama doluluk `a`, hücrenin derinliği boyunca (2^L ince katman)
 * yayılmış yoğunluk sayılır → geçirgenlik (1 − a)^(2^L). 1 voxellik duvarı 8³'lük hücrede a = 1/8'den α ≈ 0,66'ya çıkarır
 * (düzeltmesiz koni duvarın arkasını görüyordu); dolu blokta 1, ince sisle aynı. Renk aynı oranla (önceden çarpımlı).
 */
export function dolulukDuzelt(a: number, lvl: number): number {
  if (a <= 0) return 0;
  return 1 - (1 - Math.min(a, 0.999)) ** (2 ** lvl);
}

/**
 * Tek koni (Crassin 2011 kalıbı): `p` (L0 hücre koordinatı) noktasından `yon`a; çap = 2 · t · tan, seviye = log2(çap), önden
 * arkaya bileşim (renk += (1 − α) · örnek.rgb; α += (1 − α) · örnek.a). Dönen: koninin gördüğü ortalama ışıma.
 */
export function koniIzle(sv: readonly Seviye[], p: Vec3, yon: Vec3, baslangic: number): Vec3 {
  const c: Vec3 = [0, 0, 0];
  let a = 0, t = baslangic;
  const enUst = sv.length - 1;
  while (t < HACIM.koniMaks && a < HACIM.koniDoyma) {
    const cap = Math.max(1, 2 * t * HACIM.koniTan);
    const lvl = Math.min(Math.log2(cap), enUst);
    const s = seviyeOrnekle(sv, [p[0] + yon[0] * t, p[1] + yon[1] * t, p[2] + yon[2] * t], lvl);
    if (s[3] > 0) {
      const ad = dolulukDuzelt(s[3], lvl), o = ad / s[3];
      const k = 1 - a;
      c[0] += k * s[0] * o; c[1] += k * s[1] * o; c[2] += k * s[2] * o;
      a += k * ad;
    }
    t += cap * HACIM.koniAdimOrani;
  }
  return c;
}

/**
 * Işınım hacmi (6 yön × 3 kanal × voxel; blok b, voxel v → (b·N + v)·3): dolu ve yüzey-yakını voxellerde her yönde bir koni;
 * dolu voxelde yüzeyin içine bakan yön atlanır. Diğer voxeller 0 (malzeme onları okumaz).
 */
export function topla(v: VoxelVerisi, sv: readonly Seviye[]): Float32Array {
  const n = v.izgara.n, N = voxelSayisi(n);
  const out = new Float32Array(6 * 3 * N);
  for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) for (let i = 0; i < n[0]; i++) {
    const vi = indeks(n, i, j, k);
    const dolu = v.dolu[vi] === 1;
    if (!dolu && !v.yakin[vi]) continue;
    const Nv: Vec3 = [v.normal[3 * vi]!, v.normal[3 * vi + 1]!, v.normal[3 * vi + 2]!];
    for (let b = 0; b < 6; b++) {
      const d = YONLER[b]!;
      if (dolu && nokta3(Nv, d) < HACIM.arkaEsik) continue;
      const c = koniIzle(sv, [i + 0.5, j + 0.5, k + 0.5], d, dolu ? HACIM.koniDoluBaslangic : HACIM.koniBaslangic);
      out.set(c, (b * N + vi) * 3);
    }
  }
  return out;
}

/** Ortam küpü (Half-Life 2 kalıbı): E(n) = Σ n_i² · C(işaret_i, i). Normal 0 ise 6 yönün ortalaması. */
export function ortamKupu(c: (blok: number) => Vec3, n: Vec3): Vec3 {
  if (n[0] === 0 && n[1] === 0 && n[2] === 0) {
    const s: Vec3 = [0, 0, 0];
    for (let b = 0; b < 6; b++) { const x = c(b); s[0] += x[0] / 6; s[1] += x[1] / 6; s[2] += x[2] / 6; }
    return s;
  }
  const x = c(n[0] >= 0 ? 0 : 1), y = c(n[1] >= 0 ? 2 : 3), z = c(n[2] >= 0 ? 4 : 5);
  const a = n[0] * n[0], b = n[1] * n[1], d = n[2] * n[2];
  return [a * x[0] + b * y[0] + d * z[0], a * x[1] + b * y[1] + d * z[1], a * x[2] + b * y[2] + d * z[2]];
}

function ortamKupuVoxel(irr: Float32Array, N: number, vi: number, n: Vec3): Vec3 {
  return ortamKupu((b) => [irr[(b * N + vi) * 3]!, irr[(b * N + vi) * 3 + 1]!, irr[(b * N + vi) * 3 + 2]!], n);
}

/**
 * Malzemenin okuduğu GI (CPU referansı): dünya noktası `p` (m) ve birim normal `n`; örnek yüzeyin `ornekOfset` voxel önünde,
 * her yön bloğu trilineer. Malzeme bunu diffuse'a ekler (Standard: diffuseBase'e; PBR: finalDiffuse'a albedo ile).
 */
export function giOrnekle(iz: Izgara, irr: Float32Array, p: Vec3, n: Vec3): Vec3 {
  const N = voxelSayisi(iz.n);
  const g = hucreye(iz, [p[0] + n[0] * HACIM.ornekOfset * iz.voxel, p[1] + n[1] * HACIM.ornekOfset * iz.voxel, p[2] + n[2] * HACIM.ornekOfset * iz.voxel]);
  return ortamKupu((b) => {
    const s = ornekle({ veri: blokRgba(irr, N, b), n: iz.n }, g);
    return [s[0], s[1], s[2]];
  }, n);
}

/** Işınım hacminin tek bloğu RGBA (örnekleyici dört kanal bekler). */
function blokRgba(irr: Float32Array, N: number, b: number): Float32Array {
  const out = new Float32Array(4 * N);
  for (let v = 0; v < N; v++) { out[4 * v] = irr[(b * N + v) * 3]!; out[4 * v + 1] = irr[(b * N + v) * 3 + 1]!; out[4 * v + 2] = irr[(b * N + v) * 3 + 2]!; }
  return out;
}

// ── Atlas paketleme (GPU'ya yükleme) ──────────────────────────────────────

/**
 * Statik iki RGBA8 atlas: s0 = albedo.rgb, doluluk · s1 = dolu voxelde normal × 0,5 + 0,5 ve malzeme kimliği; BOŞ voxelde
 * s1.r = yakınlık bayrağı (toplama maskesi; boş voxelin normali/malzemesi yok, kanal boşa gitmesin).
 */
export function statikAtlaslar(v: VoxelVerisi): { s0: Uint8Array; s1: Uint8Array; atlas: Atlas } {
  const n = v.izgara.n, a = atlasDuzeni(n);
  const s0 = new Uint8Array(4 * a.en * a.boy), s1 = new Uint8Array(4 * a.en * a.boy);
  const b = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));
  for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) for (let i = 0; i < n[0]; i++) {
    const vi = indeks(n, i, j, k);
    const [x, y] = atlasTekseli(a, n, i, j, k);
    const o = 4 * (y * a.en + x);
    if (v.dolu[vi]) {
      s0[o] = b(v.albedo[3 * vi]!); s0[o + 1] = b(v.albedo[3 * vi + 1]!); s0[o + 2] = b(v.albedo[3 * vi + 2]!); s0[o + 3] = 255;
      s1[o] = b(v.normal[3 * vi]! * 0.5 + 0.5); s1[o + 1] = b(v.normal[3 * vi + 1]! * 0.5 + 0.5); s1[o + 2] = b(v.normal[3 * vi + 2]! * 0.5 + 0.5);
      s1[o + 3] = v.malzeme[vi]!;
    } else if (v.yakin[vi]) {
      s1[o] = 255;
    }
  }
  return { s0, s1, atlas: a };
}
