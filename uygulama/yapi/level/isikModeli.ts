// uygulama/yapi/level/isikModeli.ts — IŞIK DÜZENLEME İŞLEMLERİ (spec 42 Y4; Unreal Place Actors ▸ Lights + Details). SAF (DOM/Babylon yok).
//
// Her işlem tanımı DEĞİŞTİRMEZ, yenisini döner; sonuç `levelTanimiDogrula`dan geçer (tavan, renk, kimlik hataları nedeniyle döner, sessiz düzeltme yok). Uygulama `level.ayarla(yeni)` ile yapılır
// (level kendi doğrular, bozuksa eski hâline döner). Diske yalnız ışık listesi yazılır (`diskeYaz`): oyun içi geçici ayarlar (G penceresi, ortam komutları) level dosyasına sızmaz.
"use strict";
import { ISIK_TAVANI, levelTanimiDogrula, type IsikAktoru, type LevelTanimi, type Vec3 } from "../../../world/level/cekirdek/levelTanimi.ts";
import type { Sonuc } from "./yeniLevelModeli.ts";

/** Yeni nokta ışığın başlangıç değerleri (sıcak beyaz, ev lambası ölçeği). */
export const YENI_ISIK = { renk: "#ffd9a0", siddet: 1.5, menzil: 8 } as const;

/** "Nokta ışık N": listede kullanılmayan ilk sayı. */
function bosAd(mevcut: readonly IsikAktoru[]): string {
  const adlar = new Set(mevcut.map((i) => i.ad));
  for (let n = 1; ; n++) { const ad = `Nokta ışık ${n}`; if (!adlar.has(ad)) return ad; }
}

export function yeniNoktaIsik(konum: Vec3, mevcut: readonly IsikAktoru[]): IsikAktoru {
  return { tur: "nokta", ad: bosAd(mevcut), konum: [...konum], ...YENI_ISIK };
}

const dogrula = (t: LevelTanimi): Sonuc<LevelTanimi> => { const d = levelTanimiDogrula(t); return d.ok ? { ok: true, deger: d.deger } : { ok: false, neden: d.hata }; };
const liste = (t: LevelTanimi): IsikAktoru[] => [...(t.isiklar ?? [])];

/** Işık ekler. Kimliği yoksa `levelKur` doldurur; burada (kimliğe göre seçim için) boş `i<sayı>` verilir. */
export function isikEkle(t: LevelTanimi, isik: IsikAktoru): Sonuc<{ tanim: LevelTanimi; id: string }> {
  const mevcut = liste(t);
  if (mevcut.length >= ISIK_TAVANI) return { ok: false, neden: `en çok ${ISIK_TAVANI} ışık` };
  const kullanilan = new Set([...mevcut.map((i) => i.id), ...(t.nesneler ?? []).map((n) => n.id)]);
  let n = 1; while (kullanilan.has(`i${n}`)) n++;
  const id = `i${n}`;
  const d = dogrula({ ...t, isiklar: [...mevcut, { ...isik, id }] });
  return d.ok ? { ok: true, deger: { tanim: d.deger, id } } : d;
}

type Yama = Partial<Omit<IsikAktoru, "id" | "tur">>;
export function isikGuncelle(t: LevelTanimi, id: string, yama: Yama): Sonuc<LevelTanimi> {
  const mevcut = liste(t);
  const i = mevcut.findIndex((x) => x.id === id);
  if (i < 0) return { ok: false, neden: `ışık yok: ${id}` };
  mevcut[i] = { ...mevcut[i]!, ...yama };
  return dogrula({ ...t, isiklar: mevcut });
}

export function isikSil(t: LevelTanimi, id: string): Sonuc<LevelTanimi> {
  const mevcut = liste(t);
  if (!mevcut.some((x) => x.id === id)) return { ok: false, neden: `ışık yok: ${id}` };
  return dogrula({ ...t, isiklar: mevcut.filter((x) => x.id !== id) });
}

/**
 * Diskteki level metnine YALNIZ ışık listesini yazar (öbür alanlar diskteki hâliyle kalır). Liste boşsa `isiklar` alanı kalkar (dosya eski biçime döner). Sonuç doğrulanır.
 */
export function diskeYaz(diskMetni: string, isiklar: readonly IsikAktoru[]): Sonuc<string> {
  let ham: unknown;
  try { ham = JSON.parse(diskMetni); } catch { return { ok: false, neden: "level dosyası JSON değil" }; }
  if (typeof ham !== "object" || ham === null || Array.isArray(ham)) return { ok: false, neden: "level dosyası nesne değil" };
  const yeni: Record<string, unknown> = { ...(ham as Record<string, unknown>) };
  if (isiklar.length) yeni["isiklar"] = isiklar.map((i) => ({ ...i })); else delete yeni["isiklar"];
  const d = levelTanimiDogrula(yeni);
  if (!d.ok) return { ok: false, neden: d.hata };
  return { ok: true, deger: JSON.stringify(yeni, null, 2) + "\n" };
}
