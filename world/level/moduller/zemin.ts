// world/level/moduller/zemin.ts — Zemin: hafif dalgalı lowpoly ızgara, lekeli çayır renkleri, gölge alır.
//
// Merkez (yürünen yer) neredeyse düz, dışa doğru dalgalanır. Renk üçgen başına gürültü bandından, paletin
// çim renklerinden. GÖL: `golDerinlik` > 0 ise (golX, golZ) çevresinde yumuşak bir çanak oyulur ve tabanı toprak renginde
// olur; su yüzeyi ayrı bir katman (su.ts, aynı merkez/yarıçapı ayrı ayarlar — level dosyasında birlikte yazılır). `yukseklik(x, z)` dışarı açık: kamera ve ileride çim/kaya yerleşimi zemine oturur.
//
// ARAZİ DÜZENLEME (spec 22 Faz 7): `duzenleme` = editörün arazi fırçasıyla çizilen yükseklik FARKI (seyrek hücre
// verisi, cekirdek/arazi.ts; `duzenlemeHucre` m aralıklı, çift doğrusal). Gürültü tabanının üstüne eklenir. Yalnız
// bu alan değişince mesh yıkılmaz: değişen bölgenin köşeleri yerinde oynar (`ayarGuncelle`) ve bölge zemine bağlı
// katmanlara bildirilir (çim yalnız o hücrelerini yeniler). Mesh ızgarası `bolum`dan: ince düzenleme için bolum'u artır.
"use strict";
import { flatGeometri, meshKur, type Geometri, type Ucgen, type V3 } from "../cekirdek/geometri.ts";
import { gurultu } from "../cekirdek/rastgele.ts";
import type { Renk } from "../cekirdek/renk.ts";
import type { Bolge, LevelModulu } from "../cekirdek/modul.ts";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { farkBolgesi, ornekle, seyrekOku } from "../cekirdek/arazi.ts";

export const ZEMIN_VARSAYILAN = {
  /** Yarı genişlik (m): sis kenarı göstermesin diye geniş. */
  yaricap: 320,
  /** Kenar başına bölüm; üçgen = 2·bölüm². */
  bolum: 110,
  tepeYukseklik: 2.2,
  tepeOlcek: 55,
  /** Bu yarıçapın içi neredeyse düz (yürünen yer). */
  duzYaricap: 40,
  /** Renk lekesi ölçeği (m). */
  lekeOlcek: 9,
  /** Renk bantları: gürültü eşiklerine göre (renkler.length = esikler.length + 1). */
  renkler: ["cimKoyu", "cimOrta", "cimAcik", "cimUc"],
  esikler: [0.3, 0.62, 0.86],
  /** Göl: merkez (m), yarıçap (m), derinlik (m; 0 = göl yok). */
  golX: -30,
  golZ: -32,
  golYaricap: 16,
  golDerinlik: 0,
  tohum: 1907,
  /** Arazi fırçasının yükseklik farkı (seyrek: [anahtar, m, …]; editör yazar) ve hücre aralığı (m). */
  duzenleme: [] as number[],
  duzenlemeHucre: 2,
};
export type ZeminAyari = typeof ZEMIN_VARSAYILAN;

const yumusak = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1))); return t * t * (3 - 2 * t); };

/** (x, z) → yükseklik (m): taban + arazi fırçası farkı. */
export function zeminYuksekligi(a: ZeminAyari): (x: number, z: number) => number {
  const taban = zeminTabanYuksekligi(a);
  const d = seyrekOku(a.duzenleme), h = a.duzenlemeHucre;
  return d.size ? (x, z) => taban(x, z) + ornekle(d, h, x, z) : taban;
}

/** (x, z) → düzenlemesiz yükseklik (m). İki oktav; merkez düz, dışa doğru dalga (düzle/yumuşat bunu taban alır). */
export function zeminTabanYuksekligi(a: ZeminAyari): (x: number, z: number) => number {
  const s = a.tepeOlcek;
  return (x, z) => {
    const g = 0.65 * gurultu(x / s, z / s, a.tohum) + 0.35 * gurultu(x / (s * 0.37), z / (s * 0.37), a.tohum + 7);
    const merkez = Math.min(1, Math.hypot(x, z) / Math.max(1e-6, a.duzYaricap));
    const arazi = (g - 0.5) * 2 * a.tepeYukseklik * (0.25 + 0.75 * merkez);
    if (a.golDerinlik <= 0) return arazi;
    const k = 1 - yumusak(a.golYaricap * 0.35, a.golYaricap * 1.1, Math.hypot(x - a.golX, z - a.golZ));   // çanak: ortası derin
    return arazi * (1 - k) - a.golDerinlik * k;
  };
}

/** (x, z) → paletteki renk ADI (gürültü bandı). */
export function zeminRenkAdi(a: ZeminAyari, x: number, z: number): string {
  if (a.golDerinlik > 0 && Math.hypot(x - a.golX, z - a.golZ) < a.golYaricap * 1.06) return "toprak";   // göl tabanı ve kıyı
  const g = gurultu(x / a.lekeOlcek, z / a.lekeOlcek, a.tohum + 3);
  const i = a.esikler.findIndex((e) => g < e);
  return a.renkler[i === -1 ? a.renkler.length - 1 : i]!;
}

export function zeminGeometrisi(a: ZeminAyari, renk: (ad: string) => Renk, y = zeminYuksekligi(a)): Geometri {
  const adim = (2 * a.yaricap) / a.bolum;
  const nokta = (i: number, j: number): V3 => { const x = -a.yaricap + i * adim, z = -a.yaricap + j * adim; return [x, y(x, z), z]; };
  const u: Ucgen[] = [];
  for (let i = 0; i < a.bolum; i++) {
    for (let j = 0; j < a.bolum; j++) {
      const p00 = nokta(i, j), p10 = nokta(i + 1, j), p01 = nokta(i, j + 1), p11 = nokta(i + 1, j + 1);
      // Köşegen dama tahtası gibi değişir: düzenli ızgara izi kırılır.
      const capraz = (i + j) % 2 === 0;
      const ucgenler: [V3, V3, V3][] = capraz ? [[p00, p10, p11], [p00, p11, p01]] : [[p00, p10, p01], [p10, p11, p01]];
      for (const [a0, b0, c0] of ucgenler) {
        const cx = (a0[0] + b0[0] + c0[0]) / 3, cz = (a0[2] + b0[2] + c0[2]) / 3;
        u.push({ a: a0, b: b0, c: c0, renk: renk(zeminRenkAdi(a, cx, cz)), yon: [0, 1, 0] });
      }
    }
  }
  return flatGeometri(u);
}

export const zeminModulu: LevelModulu<ZeminAyari> = {
  tur: "zemin",
  aciklama: "Lowpoly çayır zemini (dalgalı ızgara, lekeli renk, gölge alır).",
  varsayilan: ZEMIN_VARSAYILAN,
  veri: ["duzenleme"],
  zemineBagli: false,
  aralik: {
    yaricap: { min: 50, max: 600, adim: 10 }, bolum: { min: 8, max: 400, adim: 1 }, duzenlemeHucre: { min: 0.5, max: 10, adim: 0.5 },
    tepeYukseklik: { min: 0, max: 20, adim: 0.1 }, tepeOlcek: { min: 5, max: 200, adim: 1 },
    duzYaricap: { min: 1, max: 200, adim: 1 }, lekeOlcek: { min: 1, max: 60, adim: 0.5 },
    esikler: { min: 0, max: 1, adim: 0.01 }, tohum: { min: 0, max: 9999, adim: 1 },
    golX: { min: -300, max: 300, adim: 1 }, golZ: { min: -300, max: 300, adim: 1 }, golYaricap: { min: 2, max: 120, adim: 0.5 }, golDerinlik: { min: 0, max: 8, adim: 0.05 },
  },
  kur(b, a0) {
    if (a0.renkler.length !== a0.esikler.length + 1) throw new Error("zemin: renkler.length = esikler.length + 1 olmalı");
    let a = a0;
    const taban = zeminTabanYuksekligi(a);
    let duz = seyrekOku(a.duzenleme);
    const yuk = (x: number, z: number) => taban(x, z) + ornekle(duz, a.duzenlemeHucre, x, z);
    const m = meshKur(b.sahne, "zemin", zeminGeometrisi(a, b.renk, yuk));
    const malzeme = b.malzeme("zemin", "isikli");
    m.material = malzeme;
    m.freezeWorldMatrix();
    b.golge(m, { alir: true });
    const konum = m.getVerticesData(VertexBuffer.PositionKind) as Float32Array;
    const normal = m.getVerticesData(VertexBuffer.NormalKind) as Float32Array;
    /** Bölgedeki dörtgenlerin köşe yüksekliklerini ve yüz normallerini yeniden hesaplar (geometri sırası: dörtgen (i, j) → 2 üçgen × 3 köşe). */
    const koseleriGuncelle = (bolge: Bolge) => {
      const adim = (2 * a.yaricap) / a.bolum;
      const ic = (v: number) => Math.floor((v + a.yaricap) / adim);
      const i0 = Math.max(0, ic(bolge.x0) - 1), i1 = Math.min(a.bolum - 1, ic(bolge.x1) + 1);
      const j0 = Math.max(0, ic(bolge.z0) - 1), j1 = Math.min(a.bolum - 1, ic(bolge.z1) + 1);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        for (let t = 0; t < 2; t++) {
          const o = ((i * a.bolum + j) * 2 + t) * 9;
          for (let k = 0; k < 3; k++) konum[o + k * 3 + 1] = yuk(konum[o + k * 3]!, konum[o + k * 3 + 2]!);
          const e1x = konum[o + 3]! - konum[o]!, e1y = konum[o + 4]! - konum[o + 1]!, e1z = konum[o + 5]! - konum[o + 2]!;
          const e2x = konum[o + 6]! - konum[o]!, e2y = konum[o + 7]! - konum[o + 1]!, e2z = konum[o + 8]! - konum[o + 2]!;
          let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
          const l = Math.hypot(nx, ny, nz) || 1;
          if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }   // zemin yukarı bakar
          for (let k = 0; k < 3; k++) normal.set([nx / l, ny / l, nz / l], o + k * 3);
        }
      }
      m.setVerticesData(VertexBuffer.PositionKind, konum, true);
      m.setVerticesData(VertexBuffer.NormalKind, normal, true);
      m.refreshBoundingInfo();
    };
    return {
      meshler: [m], yukseklik: yuk, renk: (x, z) => b.renk(zeminRenkAdi(a, x, z)),
      ayarGuncelle(yeniHam) {
        const yeni = yeniHam as ZeminAyari;
        // Yalnız arazi farkı değiştiyse yerinde; başka her ayar (bolum, tohum, göl…) yık-kur.
        if (JSON.stringify({ ...yeni, duzenleme: 0 }) !== JSON.stringify({ ...a, duzenleme: 0 })) return false;
        const yeniDuz = seyrekOku(yeni.duzenleme);
        const bolge = farkBolgesi(duz, yeniDuz, a.duzenlemeHucre);
        duz = yeniDuz; a = yeni;
        if (bolge) koseleriGuncelle(bolge);
        return bolge;
      },
      yokEt() { m.dispose(); malzeme.dispose(); },
    };
  },
};
