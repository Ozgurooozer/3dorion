// uygulama/yapi/level/bilesenDetayModeli.ts — DETAILS "BİLEŞENLER" + "HİYERARŞİ" SATIRLARI (spec 45 B7). SAF (DOM yok): çizici `bilesenDetayPaneli.ts`.
//
// Bir aktörün bileşen listesini (her bileşenin şema alanları, o bileşenin yayınladığı olaylar), "bileşen ekle" seçeneklerini ve üst/soket seçeneklerini üretir.
// Yazma burada YOK: panel `uygulama/aktor/bilesenIslemleri.ts` işlemlerini kullanır (şema + tanım doğrulaması orada).
"use strict";
import { aktorBul, type Sonuc } from "../../../world/level/cekirdek/bilesen.ts";
import { BEDEN_ONEKI, BILESEN_TAVANI, BILESEN_TURLERI, bilesenAyari, bilesenTuru, type BilesenKaydi } from "../../../world/level/cekirdek/bilesenKaydi.ts";
import type { LevelTanimi } from "../../../world/level/cekirdek/levelTanimi.ts";
import { BEDEN_SOKETLERI } from "../../aktor/bedenSoketleri.ts";
import type { DetaySatiri } from "./detayModeli.ts";
import { kisaVarlikAdi } from "./nesneModeli.ts";

export type BilesenAlanSatiri = Extract<DetaySatiri, { tur: "alan" }>;

export interface BilesenSatiri {
  id: string;
  tur: string;
  /** Başlıkta görünen: bileşenin `ad`ı, yoksa türün etiketi. */
  baslik: string;
  etiket: string;
  /** Bu türün yayınladığı yerleşik olaylar (graf `olay.aktor_olayi` bunları dinler). */
  olaylar: readonly string[];
  alanlar: BilesenAlanSatiri[];
}
export interface EklenebilirTur { tur: string; etiket: string }
export interface UstSecenegi { deger: string; etiket: string }
export interface HiyerarsiSatiri {
  ust: string | null;
  soket: string | null;
  /** Üst olabilecekler: kendisi ve soyundan gelenler hariç level aktörleri + beden üstleri. */
  ustSecenekleri: UstSecenegi[];
  /** Seçili üstün soketleri (level aktöründe `soket` bileşenleri, bedende `BEDEN_SOKETLERI`); soketsiz üst = boş liste. */
  soketSecenekleri: string[];
  /** `ust`un level'da ya da beden olarak karşılığı yok mu (tanım doğrulaması reddeder; yine de göster). */
  eksik: boolean;
}
export interface BilesenBolumu {
  bilesenler: BilesenSatiri[];
  ekleyebilir: EklenebilirTur[];
  dolu: boolean;
  hiyerarsi: HiyerarsiSatiri;
}

/** Details'te beden üstü olarak sunulan bedenler (Flash'ın kimliği çalışma anında, burada yalnız ana beden; başkası `ust` alanına elle yazılırsa korunur). */
export const BEDEN_USTLERI: readonly UstSecenegi[] = [{ deger: `${BEDEN_ONEKI}orion`, etiket: "Orion'un bedeni" }];

type Kayit = { id?: string; ad?: string; varlik?: string; ust?: string; soket?: string; bilesenler?: BilesenKaydi[] };

const kayitlar = (t: LevelTanimi): Kayit[] => [...(t.nesneler ?? []), ...(t.isiklar ?? [])];
const adi = (k: Kayit): string => (k.ad && k.ad.length ? k.ad : k.varlik ? kisaVarlikAdi(k.varlik) : k.id ?? "?");

/** `id`nin soyundan gelen (çocuk, torun…) aktör kimlikleri; döngülü veride de biter. */
export function soyKimlikleri(t: LevelTanimi, id: string): Set<string> {
  const soy = new Set<string>();
  const hepsi = kayitlar(t);
  const kuyruk = [id];
  while (kuyruk.length) {
    const u = kuyruk.shift()!;
    for (const k of hepsi) if (k.id && k.ust === u && !soy.has(k.id) && k.id !== id) { soy.add(k.id); kuyruk.push(k.id); }
  }
  return soy;
}

/** Üstün soket adları: level aktöründe `soket` bileşenleri, bedende bilinen kemik soketleri. */
export function soketAdlari(t: LevelTanimi, ust: string): string[] {
  if (ust.startsWith(BEDEN_ONEKI)) return Object.keys(BEDEN_SOKETLERI);
  const k = kayitlar(t).find((x) => x.id === ust);
  return (k?.bilesenler ?? []).flatMap((b) => (b.tur === "soket" && typeof b.ayar?.["ad"] === "string" ? [b.ayar["ad"]] : []));
}

/** Aktörün Bileşenler + Hiyerarşi bölümü; aktör yoksa nedenli hata. */
export function bilesenBolumu(t: LevelTanimi, id: string): Sonuc<BilesenBolumu> {
  const y = aktorBul(t, id);
  if (!y) return { ok: false, neden: `aktör yok: ${id}` };
  const veri: Kayit = y.tur === "nesne" ? t.nesneler![y.sira]! : t.isiklar![y.sira]!;
  const bilesenler: BilesenSatiri[] = (veri.bilesenler ?? []).map((b) => {
    const bt = bilesenTuru(b.tur);
    const ayar = bilesenAyari(b);
    return {
      id: b.id, tur: b.tur, baslik: b.ad ?? bt?.etiket ?? b.tur, etiket: bt?.etiket ?? b.tur, olaylar: bt?.olaylar ?? [],
      alanlar: (bt?.alanlar ?? []).map((a): BilesenAlanSatiri => ({
        tur: "alan", ad: a.ad, etiket: a.etiket, tip: a.tip, deger: ayar[a.ad] ?? a.varsayilan,
        ...(a.en !== undefined ? { en: a.en } : {}), ...(a.cok !== undefined ? { cok: a.cok } : {}), ...(a.adim !== undefined ? { adim: a.adim } : {}), ...(a.birim ? { birim: a.birim } : {}),
        ...(a.secenekler?.length ? { secenekler: a.secenekler } : {}),
      })),
    };
  });
  const soy = soyKimlikleri(t, id);
  const ustSecenekleri: UstSecenegi[] = [
    ...kayitlar(t).filter((k) => k.id && k.id !== id && !soy.has(k.id)).map((k) => ({ deger: k.id!, etiket: `${adi(k)} (${k.id})` })),
    ...BEDEN_USTLERI,
  ];
  const ust = veri.ust ?? null;
  const soket = veri.soket ?? null;
  return {
    ok: true,
    deger: {
      bilesenler,
      ekleyebilir: BILESEN_TURLERI.filter((x) => !x.rezerve).map((x) => ({ tur: x.tur, etiket: x.etiket })),
      dolu: bilesenler.length >= BILESEN_TAVANI,
      hiyerarsi: {
        ust, soket, ustSecenekleri,
        soketSecenekleri: ust ? soketAdlari(t, ust) : [],
        // Beden üstü level'da doğrulanmaz (çalışma anında çözülür): yalnız level aktörü olmayan düz kimlik "eksik" sayılır.
        eksik: ust !== null && !ust.startsWith(BEDEN_ONEKI) && !kayitlar(t).some((k) => k.id === ust),
      },
    },
  };
}
