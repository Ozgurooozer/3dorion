// uygulama/sekans/editor/kameraIslemleri.ts — SEKANSTA KAMERA DÜZENLEME İŞLEMLERİ (spec 38 §7): kamera ekle/değiştir/sil, kesme ekle/değiştir/sil. SAF ve DEĞİŞTİRİLEMEZ.
// `sekansIslemleri.ts` ile aynı sözleşme: yeni sekans döner, sonuç `sekansDogrula`dan geçer (tavan, kimlik, kesme sırası nedenle reddedilir).
"use strict";
import type { Sonuc } from "../../../protocol/dogrula.ts";
import { sekansDogrula, SEKANS_SINIRLARI, type KameraGecisi, type KameraKesmesi, type Nokta3, type Sekans, type SekansKamerasi } from "../../../protocol/sekans.ts";

const hata = (m: string): { ok: false; hata: string } => ({ ok: false, hata: m });
const kopya = (s: Sekans): Sekans => structuredClone(s);
/** Boş diziyi alan olarak yazmaz (biçimin temiz kopyası da yazmaz). */
const duzelt = (s: Sekans): Sekans => { const { kameralar, kesmeler, ...geri } = s; return { ...geri, ...(kameralar?.length ? { kameralar } : {}), ...(kesmeler?.length ? { kesmeler } : {}) }; };
const bitir = (s: Sekans): Sonuc<Sekans> => sekansDogrula(duzelt(s));

function tekilKimlik(var_: readonly string[], taban: string): string {
  const t = taban.slice(0, 28);
  if (!var_.includes(t)) return t;
  for (let i = 2; ; i++) if (!var_.includes(`${t}_${i}`)) return `${t}_${i}`;
}

export interface KameraAlani { ad?: string; konum?: Nokta3; hedef?: Nokta3; fov?: number }

/** Yeni kamera ("Kamera 1", "Kamera 2"…). Ad verilmezse sıradaki. */
export function kameraEkle(s: Sekans, a: { konum: Nokta3; hedef: Nokta3; fov: number; ad?: string }): Sonuc<{ sekans: Sekans; id: string }> {
  const var_ = s.kameralar ?? [];
  const id = tekilKimlik(var_.map((k) => k.id), `kamera_${var_.length + 1}`);
  const ad = a.ad?.trim() || `Kamera ${var_.length + 1}`;
  const x = kopya(s);
  x.kameralar = [...(x.kameralar ?? []), { id, ad, konum: [...a.konum], hedef: [...a.hedef], fov: a.fov }];
  const r = bitir(x);
  return r.ok ? { ok: true, deger: { sekans: r.deger, id } } : r;
}

export function kameraAyarla(s: Sekans, id: string, alan: KameraAlani): Sonuc<Sekans> {
  if (!(s.kameralar ?? []).some((k) => k.id === id)) return hata(`kamera yok: '${id}'`);
  const x = kopya(s);
  x.kameralar = (x.kameralar ?? []).map((k): SekansKamerasi => (k.id === id ? { ...k, ...alan } : k));
  return bitir(x);
}

/** Kamerayı ve ona bağlı KESMELERİ kaldırır (kaç kesmenin gittiği söylenir: sessiz silme yok). */
export function kameraSil(s: Sekans, id: string): Sonuc<{ sekans: Sekans; kesme: number }> {
  if (!(s.kameralar ?? []).some((k) => k.id === id)) return hata(`kamera yok: '${id}'`);
  const x = kopya(s);
  const giden = (x.kesmeler ?? []).filter((k) => k.kamera === id).length;
  x.kameralar = (x.kameralar ?? []).filter((k) => k.id !== id);
  x.kesmeler = (x.kesmeler ?? []).filter((k) => k.kamera !== id);
  const r = bitir(x);
  return r.ok ? { ok: true, deger: { sekans: r.deger, kesme: giden } } : r;
}

/** `kare`ye kesme: o karede kesme varsa kamerası değişir (kesme sayısı artmaz). */
export function kesmeEkle(s: Sekans, kare: number, kamera: string, gecis: KameraGecisi = "kesme", gecisKare = 0): Sonuc<Sekans> {
  const x = kopya(s);
  const l = x.kesmeler ?? [];
  const yeni: KameraKesmesi = { kare, kamera, gecis, gecis_kare: gecis === "kesme" ? 0 : gecisKare };
  x.kesmeler = l.some((k) => k.kare === kare) ? l.map((k) => (k.kare === kare ? yeni : k)) : [...l, yeni].sort((a, b) => a.kare - b.kare);
  return bitir(x);
}

export function kesmeAyarla(s: Sekans, kare: number, alan: { kare?: number; kamera?: string; gecis?: KameraGecisi; gecis_kare?: number }): Sonuc<{ sekans: Sekans; kare: number }> {
  const l = s.kesmeler ?? [];
  const k = l.find((x) => x.kare === kare);
  if (!k) return hata(`karede kesme yok: ${kare}`);
  if (alan.kare !== undefined && alan.kare !== kare && l.some((x) => x.kare === alan.kare)) return hata(`kare ${alan.kare}'de zaten bir kesme var`);
  const x = kopya(s);
  x.kesmeler = (x.kesmeler ?? []).map((y) => (y.kare === kare ? { ...y, ...alan } : y)).sort((a, b) => a.kare - b.kare);
  const r = bitir(x);
  return r.ok ? { ok: true, deger: { sekans: r.deger, kare: alan.kare ?? kare } } : r;
}

export function kesmeSil(s: Sekans, kare: number): Sonuc<Sekans> {
  if (!(s.kesmeler ?? []).some((k) => k.kare === kare)) return hata(`karede kesme yok: ${kare}`);
  const x = kopya(s);
  x.kesmeler = (x.kesmeler ?? []).filter((k) => k.kare !== kare);
  return bitir(x);
}

export const KAMERA_SINIRI = { kamera: SEKANS_SINIRLARI.kamera, kesme: SEKANS_SINIRLARI.kesme } as const;
