// uygulama/ayar/ayarModelleri.ts — AJAN AYAR PANELİ bölümlerinin SAF mantığı (spec 34): DOM yok, testli (`ayarModelleri.test.ts`).
//
// Bölümler (`uygulama/ayar/*Bolumu.ts`) bunları çizer. Burada İKİNCİ BİR YAZMA YOLU YOK: her değer kendi tek kaynağından okunur ve oraya yazılır —
// beyin seçimi M seçicinin kaynağından (`seciciKaynagiKur`, devre panosunun teyit yolu), bağlam/dikkat/ajanda ayarları devre panosunun düğmelerinden
// (`pano.yaz` / `teyitIste`: sınıf kapısı, aralık, günlük satırı aynen), ses host'un ses yöneticisinden (host/sesler.js), notlar md deposundan.
"use strict";
import type { Deger, Dugme, DugmeGoruntu, Pano } from "../../protocol/pano.ts";
import { kartHali, suzVeGrupla, type ModelKarti, type SeciciDurumu } from "../../world/arayuz/modelSeciciCekirdek.ts";
import type { SesDurumu, SesIndirmeIlerlemesi } from "../../host/kopru.ts";
import { ICGUDULER, type Icgudu } from "../../mind/icgudu.ts";

// ── devre panosu satırları ──────────────────────────────────────────────────────

/** Satırın panelden nasıl değişeceği: serbest (`pano.yaz`), teyit (`teyitIste` → uyarı → `teyitliYaz`) ya da hiç (salt okunur, neden yazılır). */
export type Yazim = "serbest" | "teyit" | "yok";

export interface PanoSatiri {
  ad: string;
  etiket: string;
  birim: string;
  aciklama: string;
  tur: "sayi" | "anahtar" | "metin";
  deger: Deger | null;
  yazim: Yazim;
  /** `yazim: "yok"` ise neden (panelde aynen). */
  neden: string;
  aralik: { en: number; cok: number } | null;
  adim: number;
  /** Okuma hatası (doluysa değer yok). */
  hata: string;
}

/**
 * Düğme + görüntüsü → panel satırı. `olculmus` düğme BU PANELDEN değişmez: kilidi gerekçeyle yönetim terminalinden açılır (devrePanosu.ts
 * ÖLÇÜM KİLİDİ) ve duvarda damga bırakır; burada ikinci bir kapı açmak o sürtünmeyi atlatırdı.
 */
export function panoSatiri(d: Dugme, g: DugmeGoruntu): PanoSatiri {
  const tur = typeof g.deger === "number" ? "sayi" : typeof g.deger === "boolean" ? "anahtar" : "metin";
  let yazim: Yazim = "yok";
  let neden = g.kilitSebebi;
  if (g.yazilabilir) { yazim = "serbest"; neden = ""; }
  else if (d.sinif === "tehlikeli" && typeof d.yaz === "function") { yazim = "teyit"; neden = ""; }
  else if (d.sinif === "olculmus") neden = "ölçümle seçildi — yalnız ölçüm kilidi gerekçeyle açılınca, duvardan";
  return {
    ad: g.ad, etiket: g.etiket, birim: g.birim, aciklama: g.aciklama, tur, deger: g.deger, yazim, neden,
    aralik: d.aralik ? { en: d.aralik.en, cok: d.aralik.cok } : null, adim: g.adim > 0 ? g.adim : 1, hata: g.hata,
  };
}

/** İstenen düğmeler, istenen sırayla (panoda olmayan ad atlanır: tel takılmamış kurulum, ör. senaryolar). */
export function panoSatirlari(pano: Pick<Pano, "moduller" | "goruntu">, adlar: readonly string[]): PanoSatiri[] {
  const dugmeler = new Map(pano.moduller().flatMap((m) => m.dugmeler.map((d) => [d.ad, d] as const)));
  const goruntu = new Map(pano.goruntu().flatMap((m) => m.dugmeler.map((g) => [g.ad, g] as const)));
  return adlar.flatMap((ad) => { const d = dugmeler.get(ad), g = goruntu.get(ad); return d && g ? [panoSatiri(d, g)] : []; });
}

/** −/+ düğmesi: bir adım, aralığa kırpılmış. */
export function sayiAdimi(deger: number, adim: number, yon: 1 | -1, aralik: { en: number; cok: number } | null): number {
  const yeni = deger + yon * adim;
  return aralik ? Math.min(aralik.cok, Math.max(aralik.en, yeni)) : yeni;
}

/** Elle yazılan sayı: tam sayı ve aralık içi mi (pano da reddeder; burada erken ve okunur söylemek için). */
export function sayiOku(metin: string, aralik: { en: number; cok: number } | null): { deger: number } | { hata: string } {
  const t = metin.trim().replace(/\s/g, "");
  if (!/^-?\d+$/.test(t)) return { hata: "tam sayı yaz" };
  const n = Number(t);
  if (aralik && (n < aralik.en || n > aralik.cok)) return { hata: `aralık ${aralik.en}–${aralik.cok}` };
  return { deger: n };
}

// ── beyin (M seçicinin kaynağı) ──────────────────────────────────────────────────

export interface BeyinSecenegi { ad: string; etiket: string; uygun: boolean }
export interface BeyinGrubu { baslik: string; secenekler: BeyinSecenegi[] }
export interface BeyinGorunumu {
  gruplar: BeyinGrubu[];
  /** Listede seçili görünen (istenen; geçiş sürerken hedef). */
  secili: string;
  durum: string;
  ton: "notr" | "iyi" | "kotu";
}

/** Açılır liste için gruplar (M seçiciyle AYNI sıra ve gruplar: `suzVeGrupla`). Koşan beyin listede yoksa (tarama bitmedi) "Şu an" grubu eklenir. */
export function beyinGorunumu(kartlar: readonly ModelKarti[], d: SeciciDurumu): BeyinGorunumu {
  const gruplar: BeyinGrubu[] = suzVeGrupla(kartlar, "").map((g) => ({
    baslik: g.baslik,
    secenekler: g.kartlar.map((k) => {
      const hal = kartHali(k, d);
      const ek = hal === "aktif" ? " · düşünüyor" : hal === "kontrol" ? " · kontrol…" : hal === "uygunsuz" ? ` — ${k.sebep ?? "seçilemez"}` : "";
      return { ad: k.ad, etiket: `${k.baslik}${ek}`, uygun: k.uygun };
    }),
  }));
  if (!kartlar.some((k) => k.ad === d.istenen)) gruplar.unshift({ baslik: "Şu an", secenekler: [{ ad: d.istenen, etiket: d.istenen, uygun: true }] });
  const baslik = (ad: string) => kartlar.find((k) => k.ad === ad)?.baslik ?? ad;
  if (d.gecis === "kontrol") return { gruplar, secili: d.hedef ?? d.istenen, durum: `${baslik(d.hedef ?? d.istenen)} için sağlık kontrolü…`, ton: "notr" };
  if (d.gecis === "reddedildi") return { gruplar, secili: d.aktif, durum: `${baslik(d.hedef ?? "?")} geçilemedi: ${d.sebep ?? "sebep yok"} · ${baslik(d.aktif)} düşünüyor`, ton: "kotu" };
  return { gruplar, secili: d.istenen, durum: `düşünen: ${baslik(d.aktif)}`, ton: "iyi" };
}

// ── ses ─────────────────────────────────────────────────────────────────────────

export const boyutMetni = (b: number | null): string => (b === null ? "" : b >= 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export interface SesSatirGorunumu {
  ad: string;
  baslik: string;
  /** İkinci satır: dil · boyut · durum. */
  alt: string;
  etkin: boolean;
  /** Seç düğmesi: null = gösterme (zaten çalıyor/kurulu değil), metin = gri ve nedeni. */
  sec: { acik: boolean; neden: string } | null;
  indir: { acik: boolean; neden: string } | null;
  sil: { acik: boolean; neden: string } | null;
  /** İndirme sürüyorsa 0..1. */
  ilerleme: number | null;
}

/**
 * Ses satırları. Kural: kilitli (ORION_PIPER_MODEL) iken hiçbir ses seçilemez ve nedeni yazar; bir indirme sürerken ikinci indirme gri;
 * silme yalnız host'un `silinebilir` dediğine açık. Çalan ses başa, sonra kurulu olanlar, sonra indirilebilirler.
 */
export function sesSatirlari(d: SesDurumu, ilerleme: SesIndirmeIlerlemesi | null, simdiIndirilen: string | null): SesSatirGorunumu[] {
  const suruyor = simdiIndirilen ?? d.sesler.find((s) => s.indiriliyor)?.ad ?? null;
  const sira = (s: SesDurumu["sesler"][number]) => (s.etkin ? 0 : s.kurulu ? 1 : 2);
  return [...d.sesler].sort((a, b) => sira(a) - sira(b)).map((s) => {
    const parcalar = [s.dil, boyutMetni(s.kurulu ? s.boyut : s.beklenenBoyut)];
    if (s.etkin) parcalar.push(d.kaynak === "env" ? "çalıyor (ORION_PIPER_MODEL)" : "çalıyor");
    else if (!s.kurulu) parcalar.push("indirilebilir");
    const indiriliyor = suruyor === s.ad;
    return {
      ad: s.ad, baslik: s.baslik, alt: parcalar.filter(Boolean).join(" · "), etkin: s.etkin,
      sec: !s.kurulu || s.etkin ? null : d.kilit ? { acik: false, neden: d.kilit } : !d.piperVar ? { acik: false, neden: "piper.exe bulunamadı" } : { acik: true, neden: "" },
      indir: !s.indirilebilir ? null : indiriliyor ? { acik: false, neden: "iniyor…" } : suruyor ? { acik: false, neden: `önce ${suruyor} bitsin` } : { acik: true, neden: "" },
      sil: !s.kurulu || !s.indirildi ? null : { acik: s.silinebilir, neden: s.silinemezNeden ?? "" },
      ilerleme: indiriliyor ? (ilerleme && ilerleme.ad === s.ad && ilerleme.dosya === "onnx" && ilerleme.toplam > 0 ? Math.min(1, ilerleme.alinan / ilerleme.toplam) : 0) : null,
    };
  });
}

// ── refleksler: kilitli güvenlik içgüdüleri ─────────────────────────────────────────

const KATMAN_ADI: Readonly<Record<Icgudu["katman"], string>> = {
  kayit: "kayıt", kopru: "köprü", dikkat: "dikkat", refleks: "refleks", onay: "onay kapısı", mercek: "mercek",
};

export interface KilitliIcgudu { kimlik: string; katman: string; aciklama: string }

/**
 * `ezilebilir: false` içgüdüler (maliyet tavanı, sözleşme, insan denetimi): panelde YALNIZ GÖSTERİLİR. Bunlar anahtar değil KURALDIR —
 * açılıp kapanabilseler "insan denetimi deneyimle gevşemez" sözü (mind/icgudu.ts) bir tıkla bozulurdu. Liste `ICGUDULER`den türer (kopya yok).
 */
export function kilitliIcguduler(): KilitliIcgudu[] {
  return (Object.entries(ICGUDULER) as [string, Icgudu][])
    .filter(([, i]) => !i.ezilebilir)
    .map(([kimlik, i]) => ({ kimlik, katman: KATMAN_ADI[i.katman], aciklama: i.aciklama }));
}
