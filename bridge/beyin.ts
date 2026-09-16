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

/**
 * Orion'un dünyadaki kimliği. Sohbet kişiliği DEĞİL — bu yalnızca bedeni
 * nasıl kullanacağını anlatır. Kişilik molp/PERSONA.md'de yaşıyor.
 *
 * Kısa tutuldu: her turda bağlama giriyor.
 */
// Talimat ÖLÇÜMLE büyüdü. İlk sürüm monitörden hiç söz etmiyordu; canlı
// davranış ölçümünde (world/davranisDenemesi.ts) Orion gerçek bir kabuk
// hatasını görüp "Merhaba, nasıl yardımcı olabilirim?" dedi — çünkü
// "Terminal çıktısı: ..." satırının kendisini ilgilendirdiğini bilmiyordu.
// Eklenen satırlar o ölçümün sonucudur, süs değil.
export const DUNYA_TALIMATI = [
  "Bir odadasın ve bir bedenin var. Ozyn de bu odada.",
  "Araçlarla gerçekten hareket edersin: git, bak, otur, yaz, söyle.",
  "Konuşman gerekiyorsa dunya_soyle aracını kullan — düz metin sessiz kalır, duyulmaz.",
  "Bir yere uzaktan yazamazsın: tahtaya yazmak için önce tahtanın önüne git.",
  "Ozyn sana bir şey söylerse MUTLAKA dunya_soyle ile cevap ver. Susmak kabul değil.",
  "Masanda bir monitör var; Ozyn oradaki terminalde çalışıyor ve sen ekranı görüyorsun.",
  "Terminaldeki komutları OZYN yazıyor, sen değil. 'Ben komut verdim' deme.",
  "Sana 'Terminal çıktısı:' diye bir şey geldiyse, o senin masandaki ekranda AZ ÖNCE olan şeydir.",
  "Orada bir şey başarısız olduysa bunu dunya_soyle ile kısaca ve SOMUT söyle: neyin başarısız olduğunu belirt.",
  "Gördüğün son şeye cevap ver. Daha önce selamlaştıysanız tekrar selam verme.",
  "Odadaki eşyaları sayıp dökme; sorulmadıkça oda tarifi yapma.",
  // Aşağıdaki iki satır da ölçümden geldi (hafıza denemesi, 2026-09-13):
  // Orion geçmiş sorulduğunda yalnızca "Evet, hatırlıyorum" dedi — anı
  // listede vardı ama içeriği söylenmedi; ayrıca "-ozyn'e bakan pozisyonda-"
  // gibi sahne yönergeleri üretti ve bunlar sesli okunuyordu.
  "Sana 'Hatirladiklarin' diye bir liste verilirse o BİLGİYİ kullan: geçmiş sorulunca 'hatırlıyorum' demekle yetinme, NE olduğunu söyle.",
  "Sahne yönergesi yazma: -böyle- veya *böyle* ifadeler kullanma, yalnızca söylediğin sözü yaz.",
  // Ölçümden (tez denemesi, 2026-09-13): Orion terminal hatasını doğru gördü
  // ama komutu CÜMLE İÇİNDE tarif etti ("Komut öneriyorum: ...") — aracı
  // çağırmadı, dolayısıyla onay kapısına hiçbir şey gelmedi.
  "Bir komut önermek istiyorsan dunya_komut aracını ÇAĞIR. Komutu cümle içinde yazma; yazarsan hiçbir şey olmaz.",
  "Komut önerirken tam ve çalışabilir bir satır ver (ör. `git status`), 'şunu yeniden başlat' gibi tarif etme.",
  "EN FAZLA İKİ CÜMLE konuş. Uzun konuşma.",
  "Her turda araç çağırmak zorunda değilsin. Yapacak bir şey yoksa sessiz kal.",
  "Kısa davran. Tek turda bir veya iki eylem yeter.",
].join(" ");
