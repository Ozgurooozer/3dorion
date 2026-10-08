// mind/sohbetKipi.ts — Sohbet kipleri ve onları açan sözler (spec 16 F5b). Saf.
//
//   standart  Varsayılan: yakın pencere + sorulunca hafıza ve durum defteri (spec 16 F5).
//   temiz     Bağlama hafıza, durum defteri ve önceki konuşma GİRMEZ; bu sohbet hafızaya ve durum
//             defterinin söz satırlarına YAZILMAZ (gizli sekme gibi). Modeli çıplak denemek ve hafızayı
//             kirletmeden bir şey sınamak için. Pencere yalnız bu sohbetin kendi sözlerini taşır.
//   "yeni sohbet" bir kip değil, EYLEMDİR: konuşma penceresi sıfırlanır, kip standarda döner; uzun
//             hafıza ve durum defteri kalır — sorulursa yine hatırlanır. Konu değişince eski laf küçük
//             modelin kafasını karıştırmasın diye.
//
// SÖZ TAM EŞLEŞMEYLE (içgüdü `kopru.sohbet`): doğuştan komut gibi LLM uyanmaz, ama komut sözlüğünden
// de katıdır — cümlenin TAMAMI listedeki ifadelerden biri olmalı. "yeni sohbet nasıl açılır" bir
// sorudur, kip değiştirmez. Noktalama ve büyük/küçük harf ile Türkçe harfler önemsizdir.
"use strict";
import { sadelestir } from "./hafizaYonlendirici.ts";

export type SohbetKipi = "standart" | "temiz";
export type SohbetEylemi = "yeni" | "temiz" | "normal";

/** Tek kaynak: her eylemi açan ifadeler (sadeleştirilmiş, noktalamasız yazılır). Testler buradan türer. */
export const SOHBET_IFADELERI: Readonly<Record<SohbetEylemi, readonly string[]>> = {
  yeni: ["yeni sohbet", "yeni bir sohbet", "yeni sohbet baslat", "yeni sohbet ac", "sohbeti sifirla", "new chat", "new conversation", "start a new chat"],
  temiz: ["temiz sohbet", "temiz sohbet baslat", "temiz sohbet ac", "gizli sohbet", "clean chat", "clean conversation", "private chat"],
  normal: ["normal sohbet", "standart sohbet", "normal sohbete don", "temiz sohbeti kapat", "temiz sohbetten cik", "normal chat", "standard chat", "exit clean chat"],
};

/** Orion'un eylemi onaylarken söylediği (sabit; model uyanmaz). */
export const SOHBET_ONAYI: Readonly<Record<SohbetEylemi, string>> = {
  yeni: "Tamam, yeni sohbet. Az önceki konuşmayı bir kenara koydum; sorarsan hatırlarım.",
  temiz: "Temiz sohbet: hafızamı kullanmıyorum ve bu konuşmayı hafızama yazmıyorum.",
  normal: "Normal sohbete döndüm.",
};

const normal = (m: string) => sadelestir(m).replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();

/** Söz bir sohbet eylemi mi? Yalnız TAM eşleşme. */
export function sohbetEylemi(metin: string): SohbetEylemi | null {
  const m = normal(metin);
  for (const [e, ifadeler] of Object.entries(SOHBET_IFADELERI) as [SohbetEylemi, readonly string[]][]) {
    if (ifadeler.includes(m)) return e;
  }
  return null;
}

/** Eylemin sonunda geçilen kip. */
export function sonrakiKip(e: SohbetEylemi): SohbetKipi {
  return e === "temiz" ? "temiz" : "standart";
}
