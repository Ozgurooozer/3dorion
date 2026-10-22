// uygulama/graf/benAjani.ts — "@ben" (spec 35 dilim 3, NPC sınıfı): ajan ayarındaki özel değer = "BU GRAFİĞİ ÇALIŞTIRAN NPC". SAF.
//
// Unreal'da Blueprint'in "Self"i: aynı nöbetçi grafiği iki NPC'de çalışır, her biri kendi bedenini, kendi olaylarını, kendi değişkenlerini görür. Grafiğe
// "flash" yazmak grafiği tek bir ajana kilitlerdi (bugün olay düğümlerinin `ajan` ayarı sabit); `@ben` onu bir SINIF yapar.
//
// ÇÖZÜM YERİ: çalışma başında, çalışmanın BAĞLAMINDA (`DugumCalismasi.ben`, denetimde `PinOrtami.ben`). Grafiğin kopyasında "@ben"i "flash"a çevirmek
// YAPILMADI: dinleyicinin dondurduğu kopya (ve desen kopyaları, `desenleriDondur`) Ozyn'in onayladığı metnin aynısı kalsın; aynı kopya iki NPC'de çalışır.
// ÇÖZÜLEMEZSE (▶ ile elle çalıştırma, NPC'siz dinleme) NEDENLİ HATA: sessizce "flash"a ya da ilk ajana düşmek yanlış bedeni sürerdi.
// Kullanan ayarlar: olay düğümlerinin `ajan`ı, `ajan.sec`in `ajan`ı, ajan kapsamlı değişkenin `kim`i (dilim 3). Eylem düğümlerinin `kim` AYARI `@ben`
// almaz (bağla: Ajan seç @ben ya da olayın `ajan` çıkışı) — tek giriş yolu, denetimi tek yerde.
"use strict";
import type { GrafDegeri } from "../../protocol/graf.ts";
import type { NpcBaglami, PinOrtami } from "./dugumKaydi.ts";

/** Ayrılmış ajan değeri. `@` ajan kimliğinde geçemez (kimlik ad kuralıyla: harf, rakam, _ ve -), çakışma olmaz. */
export const BEN = "@ben";

const NEDEN = "grafik bir NPC sınıfı: yalnız NPC şeridinden '⚡ NPC'yi dinlemeye al' ile çalışır (▶ ve NPC'siz dinleme kimin 'ben' olduğunu bilmez)";

/** Ajan ayarlarının seçenekleri: defterdeki ajanlar + `@ben`. `@ben`in bu çalışmada çözülüp çözülmediğine `benDenetle` bakar (nedenli mesaj orada). */
export const benliAjanSecenekleri = (o: PinOrtami): readonly string[] => [...(o.ajanlar?.() ?? []), BEN];

/** Denetim (pin çözümü): ayar `@ben` ise ve bu çalışmanın NPC'si yoksa (null) NEDENLE fırlatır. Kontrol et'te (undefined) geçerli. */
export function benDenetle(deger: GrafDegeri | undefined, o: PinOrtami, alan: string): void {
  if (deger === BEN && o.ben === null) throw new Error(`${alan}: '${BEN}' çözülemez — ${NEDEN}`);
}

/** NPC bağlamı ister (npc.parametre): bu çalışmanın NPC'si yoksa (null) NEDENLE fırlatır. Kontrol et'te (undefined) geçerli. */
export function npcGerekli(o: PinOrtami, ne: string): void {
  if (o.ben === null) throw new Error(`${ne} yalnız bir NPC'nin çalışmasında okunur — ${NEDEN}`);
}

/** Çalışma anı: ajan değeri `@ben` ise NPC'nin ajanı; NPC yoksa NEDENLİ hata. Başka değer aynen. */
export function ajanCoz(v: unknown, ben: NpcBaglami | null): unknown {
  if (v !== BEN) return v;
  if (!ben) throw new Error(`'${BEN}' çözülemez — ${NEDEN}`);
  return ben.ajan;
}
