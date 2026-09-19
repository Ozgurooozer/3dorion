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
  /**
   * Değişmeyen dünya bilgisi (çapa adları gibi). Sistem mesajına girer,
   * her tura TEKRAR EDİLMEZ.
   *
   * Neden ayrı: bu liste her turun sonuna eklendiğinde model onu son gördüğü
   * şey sanıp geri okuyor — canlı ölçümde Orion, terminal hatası sorulduğunda
   * odadaki eşyaları sayıp döktü. Sabit bilgi sabit yerde durmalı.
   */
  sabit?: string;
  /**
   * Uzun vadeli hafızadan getirilen ilgili anılar (mind/hafiza.ts).
   *
   * Kısa geçmiş penceresinden AYRI: pencere "az önce", anılar "daha önce".
   * Boş olabilir — hafıza kapalıysa ya da ilgili anı yoksa.
   */
  anilar?: string[];
  /** Terfi etmiş algıların tek satırlık özetleri (mind/dikkat süzdü). */
  ozetler: string[];
  /** Dünyanın sıkıştırılmış anlık durumu. */
  dunya: string;
  /** Son konuşma turları — en yenisi sonda. */
  /**
   * Son konuşma turları — en yenisi sonda.
   *
   * `arac: true` = bu söz gerçekte bir `dunya_soyle` ARAÇ ÇAĞRISIYDI.
   * Ölçümle bulundu: Orion'un sözlerini düz `assistant` metni olarak
   * göstermek modele "asistan düz metin yazar" örüntüsünü öğretiyor ve
   * bozuk çıktıya yol açıyor (`orlda_komut {...}` gibi). Doğru temsil
   * edilince çıktı geçerli kalıyor.
   */
  gecmis: { rol: "kullanici" | "orion"; metin: string; arac?: boolean }[];
  /**
   * Bu tur için kurulmuş sistem talimatı (bridge/talimat.ts).
   *
   * Neden girdiyle geliyor: talimat artık SABİT değil, o turda gelen algıya
   * göre daralıyor. Sabit bir metin olarak durduğunda 18 satıra büyümüştü ve
   * kurallar birbiriyle yarışmaya başlamıştı.
   */
  talimat?: string;
  /**
   * Duruma gore few-shot ornekler (bridge/ornekler.ts). Mesaj dizisine
   * sistem mesajindan SONRA, gecmisten ONCE girer.
   */
  ornekler?: { role: "user" | "assistant" | "tool"; content: string;
               tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[] }[];
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

// TALİMAT BURADA DEĞİL: tek kaynağı `bridge/talimat.ts` → `talimatUret`.
// Burada `DUNYA_TALIMATI` diye ikinci bir kopya vardı; yalnızca `ollama.ts`te
// talimat boş gelirse devreye giren bir yedekti — canlıya hiç gitmiyordu.
// 2026-09-18'de İngilizceye O çevrildi, canlının kullandığı talimat.ts ise
// Türkçe kaldı (2026-09-19'da fark edildi). Silindi; yedek `TEMEL_TALIMAT`.
