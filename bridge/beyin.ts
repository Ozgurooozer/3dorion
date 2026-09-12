// bridge/beyin.ts — Beyin arayüzü: algıdan niyete karar veren şey.
//
// Köprü, beynin KİM olduğunu bilmez. Yerel bir Ollama modeli, molp çekirdeği,
// terminaldeki Claude ya da testteki sahte bir beyin — hepsi bu arayüzü sunar.
// Böylece "hangi model" kararı mimariyi değil, tek bir satırı etkiler.
//
// Bağımlılık: yalnızca protocol/ ve araclar.ts. Babylon yok, Electron yok.
"use strict";
import type { AracTanimi } from "./araclar.ts";

export interface AracCagrisi {
  ad: string;
  girdi: unknown;
}

export interface BeyinGirdisi {
  /** Terfi etmiş algıların tek satırlık özetleri (mind/dikkat süzdü). */
  ozetler: string[];
  /** Dünyanın sıkıştırılmış anlık durumu. */
  dunya: string;
  /** Son konuşma turları — en yenisi sonda. */
  gecmis: { rol: "kullanici" | "orion"; metin: string }[];
  /** Modele sunulacak araçlar. */
  araclar: AracTanimi[];
}

export interface BeyinCikti {
  /** Modelin düz metni. Boş olabilir — her tur konuşmak zorunda değil. */
  metin: string;
  /** İstediği dünya eylemleri. Doğrulanmamıştır; köprü doğrular. */
  cagrilar: AracCagrisi[];
  /** Tanı için: hangi model, ne kadar sürdü, kaç token. */
  bilgi?: Record<string, unknown>;
}

export interface Beyin {
  readonly ad: string;
  /** Model ayakta mı? Yoksa köprü sessizce beklemek yerine söyler. */
  hazirMi(): Promise<boolean>;
  dusun(girdi: BeyinGirdisi): Promise<BeyinCikti>;
}

/**
 * Orion'un dünyadaki kimliği. Sohbet kişiliği DEĞİL — bu yalnızca bedeni
 * nasıl kullanacağını anlatır. Kişilik molp/PERSONA.md'de yaşıyor.
 *
 * Kısa tutuldu: her turda bağlama giriyor.
 */
export const DUNYA_TALIMATI = [
  "Bir odadasın ve bir bedenin var. Ozyn de bu odada.",
  "Araçlarla gerçekten hareket edersin: git, bak, otur, yaz, söyle.",
  "Konuşman gerekiyorsa dunya_soyle aracını kullan — düz metin sessiz kalır, duyulmaz.",
  "Bir yere uzaktan yazamazsın: tahtaya yazmak için önce tahtanın önüne git.",
  "Her turda araç çağırmak zorunda değilsin. Yapacak bir şey yoksa sessiz kal.",
  "Kısa davran. Tek turda bir veya iki eylem yeter.",
].join(" ");
