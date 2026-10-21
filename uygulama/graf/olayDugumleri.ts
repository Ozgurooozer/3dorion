// uygulama/graf/olayDugumleri.ts — DÜNYA OLAYI DÜĞÜMLERİ (spec 35 dilim 2): "⚡ Ozyn yaklaştı", "uzaklaştı", "sana baktı", "yüzeye geçti/çıktı".
//
// Bir olay düğümü grafiğin ▶ Başla'dan sonraki İKİNCİ tür girişidir: akış girişi yoktur, `sonra`sı olay gelince yürür. Olaylar bir AJANIN gövdesine
// göredir (`uygulama/ajanlar/ajanAlgisi.ts`: Flash'ın gözü — "Ozyn FLASH'A yaklaştı"); hangi ajanın olayı dinlendiği `ajan` ayarıdır. Adlar ve eşikler
// `world/olayUretici.ts`'in (histerezis + 4 sn soğuma): burada ikinci bir mesafe kuralı YOK.
//
// GÜVENLİK: olay düğümü grafiği KENDİ KENDİNE çalıştırmaz. Olay yalnız Ozyn'in Graf sekmesinde gerçek tıklamayla DİNLEMEYE ALDIĞI grafiği yürütür
// (`grafDinleyici.ts`); dinlemede olmayan grafiğin olay düğümü ölü koddur. ▶ Çalıştır olay düğümünden başlamaz (yalnız Başla'dan).
//
// Çıkışlar: `sonra` (akış), `ajan` (olayın ajanı: eylem düğümlerinin `kim`ine bağlanır) ve olayın verisi (`mesafe` sayı / `yuzey` metin).
"use strict";
import type { Graf, PinTanimi } from "../../protocol/graf.ts";
import { AKIS_SONRA, type AyarTanimi, type DugumTanimi, type PinOrtami } from "./dugumKaydi.ts";

interface OlayTanimi {
  tip: string;
  /** `world/olayUretici.ts` olay adı. */
  olay: string;
  ad: string;
  aciklama: string;
  veri: readonly PinTanimi[];
}

/** Tablo: düğüm türü ↔ dünya olayı. Protokolün hareket olaylarının HEPSİ burada (bekçi: olayDugumleri.test.ts `HAREKET_OLAYLARI` ile karşılaştırır). */
export const OLAY_TANIMLARI: readonly OlayTanimi[] = [
  { tip: "olay.ozyn_yaklasti", olay: "ozyn_yaklasti", ad: "⚡ Ozyn yaklaştı", aciklama: "Ozyn ajanın yanına geldi (1.8 m'nin içine girdi).", veri: [{ ad: "mesafe", tip: "sayi" }] },
  { tip: "olay.ozyn_uzaklasti", olay: "ozyn_uzaklasti", ad: "⚡ Ozyn uzaklaştı", aciklama: "Ozyn ajanın yanından ayrıldı (2.6 m'nin dışına çıktı).", veri: [{ ad: "mesafe", tip: "sayi" }] },
  { tip: "olay.ozyn_bakti", olay: "ozyn_sana_bakti", ad: "⚡ Ozyn sana baktı", aciklama: "Yakındaki Ozyn ajana döndü (bakış konisinin içine aldı).", veri: [] },
  { tip: "olay.ozyn_yuzeye_gecti", olay: "ozyn_yuzeye_gecti", ad: "⚡ Ozyn yüzeye geçti", aciklama: "Ozyn bir yüzeye odaklandı (monitör, tahta…).", veri: [{ ad: "yuzey", tip: "metin" }] },
  { tip: "olay.ozyn_yuzeyden_cikti", olay: "ozyn_yuzeyden_cikti", ad: "⚡ Ozyn yüzeyden çıktı", aciklama: "Ozyn yüzeyden ayrıldı.", veri: [{ ad: "yuzey", tip: "metin" }] },
];

const AJAN_AYARI: AyarTanimi = { ad: "ajan", tip: "metin", secenekler: (o: PinOrtami) => o.ajanlar?.() ?? [], aciklama: "olayın kime göre olduğu (Flash: Ozyn Flash'a yaklaştı)" };

export function olayDugumleri<Y>(): DugumTanimi<Y>[] {
  return OLAY_TANIMLARI.map((t): DugumTanimi<Y> => ({
    tip: t.tip, ad: t.ad, kategori: "olay", olay: true, dunyaOlayi: t.olay, saf: false,
    aciklama: `${t.aciklama} Grafik ⚡ DİNLEMEYE ALININCA (Graf sekmesi, senin tıklamanla) bu olayda buradan yürür; ▶ Çalıştır buradan başlamaz.`,
    ayarlar: [AJAN_AYARI],
    pinler: (a) => {
      if (typeof a["ajan"] !== "string" || !a["ajan"]) throw new Error("olayın ajanı seçilmedi (ayar.ajan: örn. \"flash\")");
      return { girisler: [], cikislar: [AKIS_SONRA, { ad: "ajan", tip: "ajan" }, ...t.veri] };
    },
    calistir: (c) => {
      // Olay düğümü yalnız çalışmanın girişi olarak yürür (akış girişi yok); tetik başka düğümünse bu bir yorumlayıcı hatasıdır, sessiz geçmesin.
      if (c.tetik?.dugum !== c.dugumId) throw new Error("olay düğümü yalnız kendi olayıyla başlar (grafiği ⚡ dinlemeye al)");
      const cikti: Record<string, unknown> = { ajan: c.ayar["ajan"] };
      for (const p of t.veri) cikti[p.ad] = c.tetik.veri[p.ad];
      return { cikti, sonra: "sonra" };
    },
  }));
}

/** Grafiğin dinlediği olaylar: hangi düğüm, hangi ajanın hangi olayı. Ajan ayarı olmayan düğüm atlanır (denetim onu zaten hata sayar). */
export function olayTetikleri(g: Graf): { dugum: string; ajan: string; olay: string }[] {
  const l: { dugum: string; ajan: string; olay: string }[] = [];
  for (const d of g.dugumler) {
    const t = OLAY_TANIMLARI.find((x) => x.tip === d.tip);
    const ajan = d.ayar?.["ajan"];
    if (t && typeof ajan === "string" && ajan) l.push({ dugum: d.id, ajan, olay: t.olay });
  }
  return l;
}
