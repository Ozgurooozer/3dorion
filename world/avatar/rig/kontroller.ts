// world/avatar/rig/kontroller.ts — KONTROL KAYDI (spec 38 §3): Control Rig'in kontrol noktaları, kanonik iskeletten ÜRETİLİR. SAF: Babylon yok.
//
// Unreal Control Rig / Maya HumanIK'te olduğu gibi her uzvun ekranda bir KONTROL ŞEKLİ vardır: omurga ve baş halka, pelvis sekizgen disk, el/ayak kutu.
// Şekil, boyut ve ad bir TABLOYLA tanımlanır (`TASARIM`); yeni kontrol türü = tabloya bir satır (kod değil). Hangi uzvun kontrolü olduğu kanonik yapıdan
// gelir (`iskelet/kanonik.ts`): yeni bir uzuv kanonik iskelete eklenince tasarım satırı yoksa varsayılan halka çıkar, kontrol kaybolmaz.
// Renk Unreal kuralı: orta sarı, SAĞ kırmızı, SOL mavi (taraf = gövdenin kendi tarafı).
"use strict";
import type { Uzuv } from "../../../protocol/animasyon.ts";
import { KANONIK_ZINCIRLER, kanonikUzuvlar, uzuvZinciri, type ZincirAdi } from "../iskelet/kanonik.ts";

export const KONTROL_SEKILLERI = ["halka", "kutu", "disk"] as const;
export type KontrolSekli = (typeof KONTROL_SEKILLERI)[number];
export type KontrolTarafi = "orta" | "sag" | "sol";

export interface Kontrol {
  /** Tekil kimlik (`k_<uzuv>`). */
  id: string;
  uzuv: Uzuv;
  /** Ekranda ve panelde görünen Türkçe ad. */
  ad: string;
  zincir: ZincirAdi | null;
  taraf: KontrolTarafi;
  sekil: KontrolSekli;
  /** Şeklin yarıçapı (metre; Orion boyuna göre). */
  yaricap: number;
}

interface Tasarim { sekil: KontrolSekli; yaricap: number; ad: string }

/** Şekil tablosu (spec 38 §3). Yeni görünüm = yeni satır. */
const TASARIM: Readonly<Partial<Record<Uzuv, Tasarim>>> = {
  kalca: { sekil: "disk", yaricap: 0.2, ad: "Pelvis" },
  govde: { sekil: "halka", yaricap: 0.17, ad: "Omurga" },
  gogus: { sekil: "halka", yaricap: 0.19, ad: "Göğüs" },
  boyun: { sekil: "halka", yaricap: 0.07, ad: "Boyun" },
  bas: { sekil: "halka", yaricap: 0.12, ad: "Baş" },
  sag_kol: { sekil: "halka", yaricap: 0.055, ad: "Sağ omuz" }, sol_kol: { sekil: "halka", yaricap: 0.055, ad: "Sol omuz" },
  sag_on_kol: { sekil: "halka", yaricap: 0.045, ad: "Sağ dirsek" }, sol_on_kol: { sekil: "halka", yaricap: 0.045, ad: "Sol dirsek" },
  sag_el: { sekil: "kutu", yaricap: 0.05, ad: "Sağ el" }, sol_el: { sekil: "kutu", yaricap: 0.05, ad: "Sol el" },
  sag_bacak: { sekil: "halka", yaricap: 0.08, ad: "Sağ kalça" }, sol_bacak: { sekil: "halka", yaricap: 0.08, ad: "Sol kalça" },
  sag_diz: { sekil: "halka", yaricap: 0.06, ad: "Sağ diz" }, sol_diz: { sekil: "halka", yaricap: 0.06, ad: "Sol diz" },
  sag_ayak: { sekil: "kutu", yaricap: 0.07, ad: "Sağ ayak" }, sol_ayak: { sekil: "kutu", yaricap: 0.07, ad: "Sol ayak" },
};

const tarafi = (u: Uzuv): KontrolTarafi => (u.startsWith("sag_") ? "sag" : u.startsWith("sol_") ? "sol" : "orta");

export const kontrolKimligi = (u: Uzuv): string => `k_${u}`;

/** Kontrol kaydı: kanonik uzuv başına bir kontrol, ebeveyn önce (kök pelvis ilk). */
export function kontrolleriUret(): Kontrol[] {
  return kanonikUzuvlar().map((u) => {
    const t = TASARIM[u];
    return { id: kontrolKimligi(u), uzuv: u, ad: t?.ad ?? u, zincir: uzuvZinciri(u)?.zincir.ad ?? null, taraf: tarafi(u), sekil: t?.sekil ?? "halka", yaricap: t?.yaricap ?? 0.06 };
  });
}

export const KONTROLLER: readonly Kontrol[] = kontrolleriUret();

export const kontrolBul = (id: string): Kontrol | null => KONTROLLER.find((k) => k.id === id) ?? null;
export const uzuvKontrolu = (u: Uzuv): Kontrol | null => KONTROLLER.find((k) => k.uzuv === u) ?? null;

/** Bir zincirin kontrolleri, kökten uca (zincir seçimi: "sol kolun hepsi"). */
export function zincirKontrolleri(ad: ZincirAdi): Kontrol[] {
  const z = KANONIK_ZINCIRLER.find((x) => x.ad === ad);
  return z ? z.uzuvlar.map((u) => uzuvKontrolu(u)!).filter(Boolean) : [];
}

/** Şekil rengi (#rrggbb): Unreal kuralı. Seçilince açılır. */
export function kontrolRengi(taraf: KontrolTarafi, secili: boolean): string {
  const t = { orta: ["#e0b020", "#fff060"], sag: ["#d83030", "#ff7060"], sol: ["#3060d8", "#70a0ff"] } as const;
  return t[taraf][secili ? 1 : 0];
}
