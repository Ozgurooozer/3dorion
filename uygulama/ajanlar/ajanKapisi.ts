// uygulama/ajanlar/ajanKapisi.ts — BİR AJANIN OZYN'İN ELİNE AÇILAN KAPISI ve "elle" kimlik öneki (spec 35 dilim 1'de graf/grafYetenegi.ts'teydi; spec 36).
//
// Kapı ajanın kavramıdır, program motorunun değil: iki kullanıcısı var — düğüm grafiği (`uygulama/graf/grafYetenegi.ts`) ve sekans oynatıcısı
// (`uygulama/sekans/oynatici.ts`). Sekans graf motorunu içe aktarmadığı için (spec 36, `tools/sekansYonBekcisi.test.ts`) arayüz buraya taşındı;
// graf onu buradan alır ve yeniden dışa verir (eski içe aktarmalar değişmedi). Kopya yok.
//
// TEK EYLEM YOLU: `niyet` ajanın KENDİ yoludur (Orion: `niyetiYurut` — yakınlık kuralı, şema, kısaltma aynı yerde; Flash: `AjanKaydi.niyet` = kendi
// bedeni). Kapıyı kompozisyon kökü kurar (`giris.ts` `grafKapisi`); burada yalnız biçim var.
"use strict";
import type { Niyet, NiyetSonucu } from "../../protocol/niyet.ts";
import type { AjanGovdesi } from "./ajanGovdesi.ts";

/**
 * Ozyn'in elinden (▶ grafik, ▶ sekans) giden niyetlerin kimlik öneki: hatası Orion'un LLM'ini uyandırmaz (`mind/refleks.ts` `refleks.sonuc.elle_hata`),
 * benlik "Ozyn yaptı" der (`mind/benlik.ts` `eden`). (`program` öneki Orion'u her hatada uyandırırdı.)
 */
export const ELLE_NIYET_ONEKI = "elle";

/** Bir ajanın Ozyn'in programlarına (grafik, sekans) açtığı kapı (bedeni olan ajan). */
export interface AjanKapisi {
  readonly id: string;
  readonly ad: string;
  /** Ajanın TEK eylem yolu (Orion: `niyetiYurut`; Flash: kendi beden kapısı). */
  niyet(n: Niyet, id: string): void;
  /** Bedenin niyet sonuçları. */
  sonucDinle(cb: (s: NiyetSonucu) => void): () => void;
  /** Söz hattı: söylenince (çalınınca/okununca) çözülür; söyleyemezse fırlatır. */
  soyle(metin: string): Promise<void>;
  /** Sözü kes (■). Verilmezse söz kesilmez (altyazı kendi süresinde gider). */
  sus?(): void;
  /** Gövdenin anlık durumu (okuma). Verilmezse Dünya değişkeni düğümleri bu ajan için nedenle düşer. */
  govde?(): AjanGovdesi | null;
}
