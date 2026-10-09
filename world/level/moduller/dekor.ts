// world/level/moduller/dekor.ts — Serpiştirilmiş dekor: ağaç, bank, sokak lambası (tohumlu rastgele, zemine oturur).
//
// Kaynak: Ozyn'in "Nightfall City" projesi (C:\Users\ozigo\Documents\3dtree, src/world/Props.js — Three.js,
// prosedürel, dosya asset'i yok). Ölçüler ve renkler oradan: ağaç = 6 kenarlı gövde (0,22→0,32 m, 3,6 m) + 8×6
// küre taç (r 1,7, dikeyde 1,2×); bank = oturak + ayak + sırt kutuları; lamba = 7,4 m direk + kol + başlık.
// Burada bizim lowpoly hattına çevrildi: flat geometri, renk ayardan (palet adı ya da hex), tacın köşeleri hafif
// bozulur (organik), tek mesh (tek çizim), gölge atar ve alır, stil eklentisi (toon, çizgi…) kendiliğinden işler.
// Zemine oturur → tanımda ZEMİNDEN SONRA gelmeli.
"use strict";
import { flatGeometri, meshKur, type Geometri, type Ucgen, type V3 } from "../cekirdek/geometri.ts";
import { karistir, type Renk } from "../cekirdek/renk.ts";
import { rastgele } from "../cekirdek/rastgele.ts";
import type { LevelModulu } from "../cekirdek/modul.ts";
import { karma, ornekle, seyrekOku } from "../cekirdek/arazi.ts";

export const DEKOR_VARSAYILAN = {
  agac: 22,
  bank: 4,
  lamba: 3,
  tohum: 31,
  /** Dağılım halkası (m): içi yürünen açıklık. */
  icYaricap: 10,
  disYaricap: 95,
  /** Nesneler arası en az uzaklık (m). */
  aralik: 5,
  agacOlcekMin: 0.8,
  agacOlcekMax: 1.5,
  /** Taç köşelerinin bozulması (0 = düzgün küre). */
  tacBozma: 0.18,
  govde: "#5a4632",
  tac: "#3f6631",
  tacAcik: "#5d8a3a",
  ahsap: "#6e5138",
  demir: "#33363a",
  /** Arazi fırçasının seyreltmesi (seyrek: [anahtar, 0–1, …]; 1 = bu hücrede hiç yok) ve hücre aralığı (m). */
  maske: [] as number[],
  maskeHucre: 2,
  lambaBasi: "#d8cfa0",
};
export type DekorAyari = typeof DEKOR_VARSAYILAN;

type Donustur = (p: V3) => V3;
/** Y ekseni çevresinde döndür, ölçekle, ötele. */
const donusum = (x: number, y: number, z: number, aci: number, olcek: number): Donustur => {
  const c = Math.cos(aci), s = Math.sin(aci);
  return ([px, py, pz]) => [x + (px * c + pz * s) * olcek, y + py * olcek, z + (-px * s + pz * c) * olcek];
};

/** Parçanın üçgenleri: yüz normali parça merkezinden dışa (yon ipucu). */
function parca(u: Ucgen[], ucgenler: [V3, V3, V3][], merkez: V3, renk: (i: number, t: [V3, V3, V3]) => Renk, d: Donustur): void {
  const m = d(merkez);
  ucgenler.forEach((t, i) => {
    const [a, b, c] = t.map(d) as [V3, V3, V3];
    const yon: V3 = [(a[0] + b[0] + c[0]) / 3 - m[0], (a[1] + b[1] + c[1]) / 3 - m[1], (a[2] + b[2] + c[2]) / 3 - m[2]];
    u.push({ a, b, c, renk: renk(i, t), yon });
  });
}

/** Kesik koni (silindir): `n` kenar, alt yarıçap r0, üst r1, y0'dan h boyunca; kapaklı. */
export function silindir(r0: number, r1: number, y0: number, h: number, n: number): [V3, V3, V3][] {
  const t: [V3, V3, V3][] = [];
  const k = (r: number, i: number, y: number): V3 => [Math.cos((i / n) * Math.PI * 2) * r, y, Math.sin((i / n) * Math.PI * 2) * r];
  for (let i = 0; i < n; i++) {
    const a0 = k(r0, i, y0), b0 = k(r0, i + 1, y0), a1 = k(r1, i, y0 + h), b1 = k(r1, i + 1, y0 + h);
    t.push([a0, b0, b1], [a0, b1, a1], [[0, y0 + h, 0], a1, b1], [[0, y0, 0], b0, a0]);
  }
  return t;
}

/** Kutu: merkez (cx, cy, cz), boyut (w, h, d). */
export function kutu(cx: number, cy: number, cz: number, w: number, h: number, d: number): [V3, V3, V3][] {
  const p = (sx: number, sy: number, sz: number): V3 => [cx + sx * w / 2, cy + sy * h / 2, cz + sz * d / 2];
  const yuz = (a: V3, b: V3, c: V3, e: V3): [V3, V3, V3][] => [[a, b, c], [a, c, e]];
  return [
    ...yuz(p(-1, -1, -1), p(1, -1, -1), p(1, 1, -1), p(-1, 1, -1)), ...yuz(p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1)),
    ...yuz(p(-1, -1, -1), p(-1, 1, -1), p(-1, 1, 1), p(-1, -1, 1)), ...yuz(p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1)),
    ...yuz(p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1)), ...yuz(p(-1, 1, -1), p(1, 1, -1), p(1, 1, 1), p(-1, 1, 1)),
  ];
}

/** Enlem-boylam küre (dilim × bant), köşeler bozulmuş (paylaşılan köşe: çatlak açılmaz), y'de basıklık. */
export function kure(r: number, dilim: number, bant: number, bozma: number, dikey: number, rnd: () => number): [V3, V3, V3][] {
  const k: V3[][] = [];
  for (let j = 0; j <= bant; j++) {
    const satir: V3[] = [];
    const teta = (j / bant) * Math.PI;
    for (let i = 0; i < dilim; i++) {
      const fi = (i / dilim) * Math.PI * 2;
      const s = j === 0 || j === bant ? 1 : 1 + (rnd() - 0.5) * 2 * bozma;
      satir.push([Math.sin(teta) * Math.cos(fi) * r * s, Math.cos(teta) * r * dikey * s, Math.sin(teta) * Math.sin(fi) * r * s]);
    }
    k.push(satir);
  }
  const t: [V3, V3, V3][] = [];
  for (let j = 0; j < bant; j++) {
    for (let i = 0; i < dilim; i++) {
      const i2 = (i + 1) % dilim;
      const a = k[j]![i]!, b = k[j]![i2]!, c = k[j + 1]![i2]!, d = k[j + 1]![i]!;
      if (j > 0) t.push([a, b, c]);
      if (j < bant - 1) t.push([a, c, d]);
    }
  }
  return t;
}

export interface DekorYeri { tur: "agac" | "bank" | "lamba"; x: number; z: number; aci: number; olcek: number }

/** Tohumlu yerleşim: halka içinde, aralarında en az `aralik` m (yer bulunamayan nesne atlanır). */
export function dekorYerleri(a: DekorAyari): DekorYeri[] {
  const rnd = rastgele(a.tohum);
  const yerler: DekorYeri[] = [];
  const istek: DekorYeri["tur"][] = [
    ...Array<DekorYeri["tur"]>(Math.max(0, Math.round(a.agac))).fill("agac"),
    ...Array<DekorYeri["tur"]>(Math.max(0, Math.round(a.bank))).fill("bank"),
    ...Array<DekorYeri["tur"]>(Math.max(0, Math.round(a.lamba))).fill("lamba"),
  ];
  for (const tur of istek) {
    for (let deneme = 0; deneme < 40; deneme++) {
      const aci = rnd() * Math.PI * 2, r = a.icYaricap + Math.sqrt(rnd()) * (a.disYaricap - a.icYaricap);
      const x = Math.cos(aci) * r, z = Math.sin(aci) * r;
      if (yerler.some((y) => Math.hypot(y.x - x, y.z - z) < a.aralik)) continue;
      const olcek = tur === "agac" ? a.agacOlcekMin + rnd() * (a.agacOlcekMax - a.agacOlcekMin) : 1;
      yerler.push({ tur, x, z, aci: rnd() * Math.PI * 2, olcek });
      break;
    }
  }
  return yerler;
}

export function dekorGeometrisi(a: DekorAyari, yukseklik: (x: number, z: number) => number, renk: (ad: string) => Renk): Geometri {
  const rnd = rastgele(a.tohum + 1);
  const govde = renk(a.govde), tac = renk(a.tac), tacAcik = renk(a.tacAcik), ahsap = renk(a.ahsap), demir = renk(a.demir), bas = renk(a.lambaBasi);
  const sabit = (r: Renk) => () => r;
  const u: Ucgen[] = [];
  const maske = seyrekOku(a.maske);
  for (const [n, y] of dekorYerleri(a).entries()) {
    // Maskeli nesne de üretilir (rastgele sırası bozulmasın), yalnız eklenmez.
    const dahil = !maske.size || karma(a.tohum * 131 + n) >= ornekle(maske, a.maskeHucre, y.x, y.z);
    const u0 = u.length;
    const d = donusum(y.x, yukseklik(y.x, y.z) - 0.1, y.z, y.aci, y.olcek);
    if (y.tur === "agac") {
      parca(u, silindir(0.32, 0.22, 0, 3.78, 6), [0, 1.9, 0], sabit(govde), d);
      // Taç: üst yüzler açık, alt yüzler koyu (pişmiş ışık değil — renk çeşitlemesi; ışığı ayrıca güneş verir).
      const tacRengi = (_: number, t: [V3, V3, V3]) => karistir(tac, tacAcik, 0.5 + (t[0][1] + t[1][1] + t[2][1]) / 3 / 4 + (rnd() - 0.5) * 0.4);
      const tac1 = kure(1.7, 8, 6, a.tacBozma, 1.2, rnd).map((t) => t.map((p) => [p[0], p[1] + 5.1, p[2]]) as [V3, V3, V3]);
      parca(u, tac1, [0, 5.1, 0], tacRengi, d);
      if (rnd() < 0.45) {
        // Kimi ağaca ikinci, küçük bir taç öbeği (siluet tekdüze olmasın).
        const ox = (rnd() - 0.5) * 1.6, oz = (rnd() - 0.5) * 1.6;
        const tac2 = kure(1.1, 7, 5, a.tacBozma, 1.1, rnd).map((t) => t.map((p) => [p[0] + ox, p[1] + 6.3, p[2] + oz]) as [V3, V3, V3]);
        parca(u, tac2, [ox, 6.3, oz], tacRengi, d);
      }
    } else if (y.tur === "bank") {
      parca(u, kutu(0, 0.8, 0, 2.4, 0.12, 0.6), [0, 0.8, 0], sabit(ahsap), d);
      parca(u, kutu(0, 0.43, 0, 2.2, 0.5, 0.1), [0, 0.43, 0], sabit(demir), d);
      parca(u, kutu(0, 1.2, -0.28, 2.4, 0.55, 0.1), [0, 1.2, -0.28], sabit(ahsap), d);
    } else {
      parca(u, silindir(0.18, 0.12, 0, 7.4, 6), [0, 3.7, 0], sabit(demir), d);
      parca(u, kutu(0, 7.3, 1.0, 0.16, 0.16, 2.2), [0, 7.3, 1.0], sabit(demir), d);
      const basi = kure(0.3, 8, 6, 0, 0.6, rnd).map((t) => t.map((p) => [p[0], p[1] + 7.15, p[2] * 1.6 + 1.9]) as [V3, V3, V3]);
      parca(u, basi, [0, 7.15, 1.9], sabit(bas), d);
    }
    if (!dahil) u.length = u0;
  }
  return flatGeometri(u);
}

export const dekorModulu: LevelModulu<DekorAyari> = {
  tur: "dekor",
  aciklama: "Ağaç, bank, sokak lambası (Nightfall City Props.js'ten), tohumlu rastgele, zemine oturur. Zeminden sonra gelmeli.",
  varsayilan: DEKOR_VARSAYILAN,
  veri: ["maske"],
  aralik: {
    agac: { min: 0, max: 200, adim: 1 }, bank: { min: 0, max: 40, adim: 1 }, lamba: { min: 0, max: 40, adim: 1 },
    tohum: { min: 0, max: 9999, adim: 1 }, icYaricap: { min: 0, max: 200, adim: 1 }, disYaricap: { min: 5, max: 300, adim: 1 },
    aralik: { min: 0, max: 30, adim: 0.5 }, agacOlcekMin: { min: 0.2, max: 3, adim: 0.05 }, agacOlcekMax: { min: 0.2, max: 4, adim: 0.05 },
    tacBozma: { min: 0, max: 0.6, adim: 0.01 }, maskeHucre: { min: 0.5, max: 10, adim: 0.5 },
  },
  kur(b, a) {
    const m = meshKur(b.sahne, "dekor", dekorGeometrisi(a, b.yukseklik, b.renk));
    const malzeme = b.malzeme("dekor", "isikli");
    m.material = malzeme;
    m.freezeWorldMatrix();
    b.golge(m, { atar: true, alir: true });
    return { meshler: [m], yokEt() { m.dispose(); malzeme.dispose(); } };
  },
};
