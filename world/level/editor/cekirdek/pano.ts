// world/level/editor/cekirdek/pano.ts — PARÇA: kopyala/yapıştır ve hazır yapı (prefab) için ortak biçim. Saf.
//
// Parça = nesne listesi, konumlar parçanın TABAN ORTASINA göre (seçimin x/z ortası, en alçak y). Yapıştırırken
// hedef konuma taşınır ve istenirse Y ekseninde döndürülür (konumlar döner, her nesnenin Y dönüşü eklenir).
// Aynı biçim sistem panosuna metin olarak gider (başka sekmedeki level'a yapıştırılabilir) ve hazır yapı
// dosyasına yazılır (world/level/hazir/<ad>.hazir.json).
"use strict";
import type { LevelTanimi, NesneYeri, Vec3 } from "../../cekirdek/levelTanimi.ts";
import { nesneHatasi } from "../../cekirdek/levelTanimi.ts";
import { donusVec } from "../../cekirdek/donusum.ts";
import { donusumYaz, nesneEkle, type Sonuc } from "./komutlar.ts";

export const PARCA_TURU = "3dorion-parca";

export interface Parca {
  tur: typeof PARCA_TURU;
  surum: 1;
  /** Hazır yapının adı (panoda yok). */
  ad?: string;
  nesneler: Omit<NesneYeri, "id">[];
}

/** Seçili nesnelerden parça (yoksa null). Kimlik ve kilit atılır; grup bağı kalır (aynı level'da korunur). */
export function parcaAl(t: LevelTanimi, idler: readonly string[], ad?: string): Parca | null {
  const k = new Set(idler);
  const secili = (t.nesneler ?? []).filter((n) => n.id && k.has(n.id));
  if (secili.length === 0) return null;
  const xs = secili.map((n) => n.konum[0]), zs = secili.map((n) => n.konum[2]);
  const merkez: Vec3 = [(Math.min(...xs) + Math.max(...xs)) / 2, Math.min(...secili.map((n) => n.konum[1])), (Math.min(...zs) + Math.max(...zs)) / 2];
  return {
    tur: PARCA_TURU, surum: 1, ...(ad ? { ad } : {}),
    nesneler: secili.map(({ id: _i, kilitli: _k, ...n }) => donusumYaz(n as NesneYeri, {
      konum: [n.konum[0] - merkez[0], n.konum[1] - merkez[1], n.konum[2] - merkez[2]],
    })),
  };
}

/** Babylon'un Y dönüşüyle aynı yönde (sol el): x' = x·c + z·s, z' = −x·s + z·c. */
const yDondurVec = (v: Vec3, derece: number): Vec3 => {
  const a = (derece * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
};

/**
 * Parçayı `konum`a koyar. `grup`: verilirse hepsi o gruba; verilmezse nesnenin kendi grubu bu level'da varsa
 * korunur, yoksa grupsuz. Yeni kimlikler döner (yeni seçim).
 */
export function parcaYerlestir(t: LevelTanimi, p: Parca, konum: Vec3, s: { donusY?: number; grup?: string } = {}): Sonuc {
  const donusY = s.donusY ?? 0;
  const varGrup = new Set((t.gruplar ?? []).map((g) => g.id));
  return nesneEkle(t, p.nesneler.map((n) => {
    const r = yDondurVec(n.konum, donusY);
    const d = donusVec(n.donus); d[1] += donusY;
    const { grup, ...geri } = n;
    const yeniGrup = s.grup ?? (grup && varGrup.has(grup) ? grup : undefined);
    return donusumYaz({ ...geri, ...(yeniGrup ? { grup: yeniGrup } : {}) } as NesneYeri, {
      konum: [konum[0] + r[0], konum[1] + r[1], konum[2] + r[2]], donus: d,
    });
  }));
}

export const parcaMetni = (p: Parca): string => JSON.stringify(p);

/** Metinden parça; biçim bozuksa hata FIRLATIR (yapıştırılan rastgele metin sessizce yutulmasın). */
export function parcaOku(v: unknown): Parca {
  const o = typeof v === "string" ? (JSON.parse(v) as unknown) : v;
  if (typeof o !== "object" || o === null) throw new Error("parça: nesne değil");
  const p = o as Record<string, unknown>;
  if (p["tur"] !== PARCA_TURU || p["surum"] !== 1) throw new Error(`parça: tur "${PARCA_TURU}" ve surum 1 olmalı`);
  if (!Array.isArray(p["nesneler"]) || p["nesneler"].length === 0) throw new Error("parça: nesneler boş");
  for (const [i, n] of p["nesneler"].entries()) {
    const e = nesneHatasi(n);
    if (e) throw new Error(`parça: nesneler[${i}]${e.alan ? `.${e.alan}` : ""}: ${e.neden}`);
  }
  if (p["ad"] !== undefined && typeof p["ad"] !== "string") throw new Error("parça: ad metin olmalı");
  return o as Parca;
}
