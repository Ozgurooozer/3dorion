// uygulama/yapi/sekans/editorBaglami.ts — Sekans editörünün DOM parçalarının (zaman çizelgesi, iz listesi, Ayrıntılar, oynatma düğmeleri) ortak bağlamı (spec 36).
// Parçalar birbirini doğrudan çağırmaz: denetimci (`sekansEditoru.ts`) bu arayüzü verir, parça sonuç bildirir ve yeniden çizim ister.
"use strict";
import type { KlipBulucu } from "../../../world/avatar/index.ts";
import type { KomutSonucu, SekansOturumu } from "../../sekans/editor/sekansOturumu.ts";

export type MesajTuru = "bilgi" | "iyi" | "uyari" | "hata";

export interface SekansBaglami {
  oturum(): SekansOturumu | null;
  /** Etkin sekmenin (sekansın) adı. */
  ad(): string | null;
  /** Klip kütüphanesi (bölüm adları, klip süreleri). Geçici sekans klipleri burada GÖRÜNMEZ. */
  klipler: KlipBulucu;
  ajanlar(): readonly string[];
  bildir(m: string, tur?: MesajTuru): void;
  /** Komut sonucunu söyle ve yeniden çiz. */
  sonuc(r: KomutSonucu | null): void;
  tazele(): void;
  /** Etkin sekmenin sekansı şu an oynuyor mu; oynuyorsa oynatıcının karesi. */
  oynayanKare(): number | null;
  /** Oynamayı durdur (scrub oynatmayı keser). */
  durdur(): void;
}
