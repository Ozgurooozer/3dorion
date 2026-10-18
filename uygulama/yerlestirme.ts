// uygulama/yerlestirme.ts — OYUN İÇİ ASSET YERLEŞTİRME DURUMU (spec 30): menüden eklenen nesneler ve taşınan level nesneleri. SAF (Babylon ve DOM yok).
//
// Level DOSYASI (`ova.level.json`) Ozyn'indir ve burada yazılmaz. Yerleştirmeler ayrı bir kayıtta (`yerlestirmeKaydi.ts`) durur ve açılışta level'ın
// ÜSTÜNE uygulanır: `tanimaUygula` level'ın o anki yerleşim listesini alır, önceki "yer-*" kimlikli eklemeleri atar, taşıma geçersiz kılmalarını işler ve güncel
// eklemeleri sona koyar. Bu yüzden idempotenttir (iki kez uygulamak ekleme çoğaltmaz) ve level'ın başka alanlarına (ışık, stil) dokunmaz.
// Konum = varlığın TABAN ORTASI (katalog pivotu); yükseklik çağıranın verdiği zemin yüksekliğidir.
"use strict";
import type { NesneYeri, Vec3 } from "../world/level/cekirdek/levelTanimi.ts";
import { yeniId } from "../world/level/cekirdek/kimlik.ts";

/** Menüden eklenen yerleşimin kimlik öneki: bu önekli her nesne benimdir (level dosyasındakiler değil). */
export const EKLENEN_ONEKI = "yer-";

/** `donus`/`olcek` level tanımındaki `NesneYeri` ile AYNI biçim (sayı ya da [x, y, z]): bir level nesnesini kopyalarken hiçbir şey kaybolmaz. */
export interface Yerlesim { id: string; varlik: string; konum: Vec3; donus: number | Vec3; olcek: number | Vec3 }

/** Bir nesnenin dönüşümünde yapılan değişiklik (verilmeyen alan olduğu gibi kalır). */
export interface Degisim { konum?: Vec3; donus?: number | Vec3; olcek?: number | Vec3 }

export interface YerlestirmeDurumu {
  eklenen: Yerlesim[];
  /** Level dosyasındaki bir nesnenin yeni konumu/dönüşü/ölçeği (dosya değişmez, kayıtta durur). */
  degisen: Record<string, Degisim>;
}

export const bosDurum = (): YerlestirmeDurumu => ({ eklenen: [], degisen: {} });

const kopyala = (v: number | Vec3): number | Vec3 => (typeof v === "number" ? v : [v[0], v[1], v[2]]);

export const eklenenMi = (id: string): boolean => id.startsWith(EKLENEN_ONEKI);

/** Yeni yerleşim ekle; kimlik benzersiz ("yer-1", "yer-2"…). Yeni durum ve kimlik döner (girdi değişmez). */
export function ekle(d: YerlestirmeDurumu, varlik: string, konum: Vec3, donus: number | Vec3 = 0, olcek: number | Vec3 = 1): { durum: YerlestirmeDurumu; id: string } {
  const id = yeniId(d.eklenen.map((e) => e.id), EKLENEN_ONEKI);
  return { durum: { ...d, eklenen: [...d.eklenen, { id, varlik, konum: [...konum], donus: kopyala(donus), olcek: kopyala(olcek) }] }, id };
}

/** Bir nesnenin konum/dönüş/ölçeğini değiştir: eklenen ise kendi kaydı, level nesnesi ise geçersiz kılma (alan alan birleşir). Yeni durum döner. */
export function donustur(d: YerlestirmeDurumu, id: string, y: Degisim): YerlestirmeDurumu {
  const al = (): Degisim => ({ ...(y.konum ? { konum: [...y.konum] as Vec3 } : {}), ...(y.donus !== undefined ? { donus: kopyala(y.donus) } : {}), ...(y.olcek !== undefined ? { olcek: kopyala(y.olcek) } : {}) });
  if (eklenenMi(id)) {
    if (!d.eklenen.some((e) => e.id === id)) throw new Error(`yerleştirme: "${id}" eklenenler arasında yok`);
    return { ...d, eklenen: d.eklenen.map((e) => (e.id === id ? { ...e, ...al() } : e)) };
  }
  return { ...d, degisen: { ...d.degisen, [id]: { ...d.degisen[id], ...al() } } };
}

/** Eklenen bir nesneyi kaldır (level nesnesi KALDIRILAMAZ: hata). */
export function kaldir(d: YerlestirmeDurumu, id: string): YerlestirmeDurumu {
  if (!eklenenMi(id)) throw new Error(`yerleştirme: "${id}" level nesnesi, kaldırılamaz (yalnız menüden eklenenler)`);
  return { ...d, eklenen: d.eklenen.filter((e) => e.id !== id) };
}

/** Level'ın güncel yerleşim listesinin ÜSTÜNE uygula (saf, idempotent). */
export function tanimaUygula(nesneler: readonly NesneYeri[], d: YerlestirmeDurumu): NesneYeri[] {
  const taban = nesneler.filter((n) => !(n.id && eklenenMi(n.id)));
  const tasinmis = taban.map((n): NesneYeri => {
    const g = n.id ? d.degisen[n.id] : undefined;
    return g ? { ...n, ...(g.konum ? { konum: [...g.konum] as Vec3 } : {}), ...(g.donus !== undefined ? { donus: kopyala(g.donus) } : {}), ...(g.olcek !== undefined ? { olcek: kopyala(g.olcek) } : {}) } : n;
  });
  const eklenenler = d.eklenen.map((e): NesneYeri => ({ id: e.id, varlik: e.varlik, konum: [...e.konum], donus: kopyala(e.donus), olcek: kopyala(e.olcek) }));
  return [...tasinmis, ...eklenenler];
}

// ── kayıt biçimi (doğrulamalı: bozuk kayıt yerleştirmeyi sessizce bozmaz) ──
const sayiMi = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const vecMi = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(sayiMi);
const donusMu = (v: unknown): v is number | Vec3 => sayiMi(v) || vecMi(v);
const olcekMi = (v: unknown): v is number | Vec3 => (sayiMi(v) && v > 0) || (vecMi(v) && v.every((n) => n > 0));

export function durumuYaz(d: YerlestirmeDurumu): string { return JSON.stringify({ surum: 2, ...d }); }

/** Kayıt metninden durum; boş ise boş durum; bozuksa HATA (çağıran uyarı basıp boşla devam eder). */
export function durumuOku(metin: string | null): YerlestirmeDurumu {
  if (!metin) return bosDurum();
  const v: unknown = JSON.parse(metin);
  if (typeof v !== "object" || v === null) throw new Error("yerleştirme kaydı nesne değil");
  const o = v as Record<string, unknown>;
  if (o["surum"] !== 1 && o["surum"] !== 2) throw new Error(`yerleştirme kaydı sürümü desteklenmiyor: ${String(o["surum"])}`);
  if (!Array.isArray(o["eklenen"])) throw new Error("yerleştirme kaydı: eklenen dizisi yok");
  const kimlikler = new Set<string>();
  const eklenen = o["eklenen"].map((x, i): Yerlesim => {
    const e = x as Record<string, unknown>;
    if (typeof e !== "object" || e === null || typeof e["id"] !== "string" || !eklenenMi(e["id"]) || typeof e["varlik"] !== "string" || !vecMi(e["konum"]) || !donusMu(e["donus"]) || !olcekMi(e["olcek"])) {
      throw new Error(`yerleştirme kaydı: eklenen[${i}] bozuk`);
    }
    if (kimlikler.has(e["id"])) throw new Error(`yerleştirme kaydı: yinelenen kimlik ${e["id"]}`);
    kimlikler.add(e["id"]);
    return { id: e["id"], varlik: e["varlik"], konum: e["konum"], donus: e["donus"], olcek: e["olcek"] };
  });
  const degisen: Record<string, Degisim> = {};
  // Sürüm 1: yalnız konum ("tasinan"); sürüm 2: konum/dönüş/ölçek ("degisen"). İkisi de okunur, yazılan hep 2.
  for (const [alan, kok] of [["tasinan", o["tasinan"]], ["degisen", o["degisen"]]] as const) {
    if (typeof kok !== "object" || kok === null) continue;
    for (const [id, k] of Object.entries(kok)) {
      if (alan === "tasinan") {
        if (!vecMi(k)) throw new Error(`yerleştirme kaydı: tasinan["${id}"] bozuk`);
        degisen[id] = { ...degisen[id], konum: k };
        continue;
      }
      const g = k as Record<string, unknown> | null;
      if (typeof g !== "object" || g === null || (g["konum"] !== undefined && !vecMi(g["konum"])) || (g["donus"] !== undefined && !donusMu(g["donus"])) || (g["olcek"] !== undefined && !olcekMi(g["olcek"]))) {
        throw new Error(`yerleştirme kaydı: degisen["${id}"] bozuk`);
      }
      degisen[id] = { ...degisen[id], ...(g["konum"] !== undefined ? { konum: g["konum"] as Vec3 } : {}), ...(g["donus"] !== undefined ? { donus: g["donus"] as number | Vec3 } : {}), ...(g["olcek"] !== undefined ? { olcek: g["olcek"] as number | Vec3 } : {}) };
    }
  }
  return { eklenen, degisen };
}
