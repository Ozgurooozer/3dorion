// world/avatar/iskeletSecim.ts — Hangi iskelet kullanılsın? SAF karar.
//
// NEDEN VAR: yedeğe düşme yalnızca YÜKLEME HATASINDA çalışıyordu. Yüklenen
// ama yüzü oynamayan bir model kabul edilip sadece uyarı basılıyordu. Sonuç:
// ölçülmüş ve çalışan TTS ağız senkronu (tepe_agiz=1.000) ekranda GÖRÜNMÜYOR.
//
// Bu projede avatar bir süs değil; konuşan bir varlık. Ağzı açılamayan bir yüz,
// bedenlenme iddiasını boşa çıkarır. Bu yüzden karar ölçütü "yüklendi mi"
// değil, "İFADE EDEBİLİYOR MU".
//
// Varlık SEÇİMİ (hangi VRM kullanılacak) bu dosyanın işi DEĞİL — o Ozyn'in
// kararı. Burada yalnızca "eldeki model işi görüyor mu" sorusu var.
//
// SAF: Babylon yok, dosya okuma yok. Girdi yetenek bildirimi, çıktı karar.
"use strict";
import type { IskeletBilgisi } from "./iskelet.ts";

export type IskeletSecimi = "vrm" | "prosedurel";

export interface SecimKarari {
  secim: IskeletSecimi;
  /** İnsan-okur gerekçe — log ve HUD için. Sessiz karar yok. */
  gerekce: string;
}

export interface SecimAyari {
  /**
   * Görünüşü ifadeye tercih eden kullanıcı için kaçış kapısı: VRM yetersiz
   * olsa bile kullanılır. Varsayılan false.
   */
  vrmZorla?: boolean;
}

/**
 * VRM yüklendi; kullanılsın mı yoksa prosedürele mi geçilsin?
 *
 * `vrmBilgi === null` → VRM hiç yüklenemedi, tek seçenek prosedürel.
 *
 * ÖLÇÜT: ağız desteği. Konuşma bu projenin çekirdek yeteneğidir (Piper TTS
 * kurulu ve ölçülü); ağzı oynamayan bir avatar konuşurken ölü görünür.
 * Göz kırpma önemli ama tek başına belirleyici değil — uyarı olarak geçer.
 */
export function iskeletSec(
  vrmBilgi: IskeletBilgisi | null,
  ayar: SecimAyari = {},
): SecimKarari {
  if (!vrmBilgi) {
    return { secim: "prosedurel", gerekce: "VRM yüklenemedi, prosedürel iskelet kullanılıyor" };
  }

  if (vrmBilgi.agizDestegi) {
    const eksik: string[] = [];
    if (!vrmBilgi.kirpmaDestegi) eksik.push("göz kırpma");
    if (!vrmBilgi.basDestegi) eksik.push("baş dönüşü");
    return {
      secim: "vrm",
      gerekce: eksik.length
        ? `VRM kullanılıyor (${vrmBilgi.kaynak}); eksik: ${eksik.join(", ")}`
        : `VRM kullanılıyor (${vrmBilgi.kaynak}), tüm yetenekler var`,
    };
  }

  if (ayar.vrmZorla) {
    return {
      secim: "vrm",
      gerekce: `VRM ZORLANDI (${vrmBilgi.kaynak}) — ağzı oynamıyor, konuşurken ölü görünecek`,
    };
  }

  return {
    secim: "prosedurel",
    gerekce:
      `'${vrmBilgi.kaynak}' ağız desteği sunmuyor (blend shape yok); konuşma ` +
      "görünmez olurdu. İfade edebilen prosedürel iskelete geçildi — " +
      "görünüşü tercih etmek için vrmZorla kullan.",
  };
}
