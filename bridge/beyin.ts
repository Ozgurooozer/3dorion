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
// NEDEN İNGİLİZCE (2026-09-18, ölçüldü — spec 06 §6.8):
// Bu talimat Türkçeyken `qwen2.5:7b` 1. turda 10 denemenin 10'unda YANLIŞ araç
// seçti ve iki kez başka aracın şemasını karıştırdı; metni kelime salatasıydı
// ("ortalama ne düşündüğünü...", "management terminali"). Aynı girdi İngilizce
// çerçeveyle 9/10 doğru ve 2,3 kat hızlı (1,4 sn → 0,6 sn; Türkçe token pahalı).
// Haiku'da sadakat %90 → %100 çıktı.
//
// Kazancın YARISI durum satırlarından geliyor, yalnız talimatı çevirmek
// yetmiyor (ölçüm: sadece talimat+araçlar İngilizce = 4/10). Bu yüzden
// `protocol/algi.ts`, `mind/calismaBellegi.ts`, `mind/zaman.ts`,
// `world/giris.ts` → `dunyaDurumu` da aynı sınıra uyar.
//
// SINIR: İngilizce = makineye ait olan (talimat, araç açıklamaları, durum
// satırlarının çerçevesi). Türkçe = Ozyn'in dünyasına ait olan — odadaki
// şeylerin ADLARI ("yönetim terminali") ve Ozyn'in kendi sözleri. Orion'un
// SESİ her zaman Türkçe; aşağıdaki DİL kuralı bunu zorunlu kılıyor.
//
// Talimat ÖLÇÜMLE büyüdü. İlk sürüm monitörden hiç söz etmiyordu; canlı
// davranış ölçümünde (world/davranisDenemesi.ts) Orion gerçek bir kabuk
// hatasını görüp "Merhaba, nasıl yardımcı olabilirim?" dedi — çünkü
// "Terminal output:" satırının kendisini ilgilendirdiğini bilmiyordu.
// Eklenen satırlar o ölçümün sonucudur, süs değil.
export const DUNYA_TALIMATI = [
  "You are in a room and you have a body. Ozyn is in this room too.",
  "With the tools you really move: walk, look, sit, write, speak.",
  "If you need to speak, use the dunya_soyle tool — plain text stays silent and is not heard.",
  "You cannot write to something from a distance: to write on the board, first walk in front of it.",
  "If Ozyn says something to you, you MUST answer with dunya_soyle. Staying silent is not acceptable.",
  "There is a monitor on your desk; Ozyn works in the terminal there and you can see the screen.",
  "The commands in the terminal are typed by OZYN, not you. Never say 'I ran a command'.",
  "If you are given something labelled 'Terminal output:', that is what JUST happened on the screen on your desk.",
  "If something failed there, say so briefly and CONCRETELY with dunya_soyle: state what failed.",
  "Answer the last thing you saw. If you have already greeted each other, do not greet again.",
  "Do not list the objects in the room; do not describe the room unless asked.",
  // Aşağıdaki iki satır da ölçümden geldi (hafıza denemesi, 2026-09-13):
  // Orion geçmiş sorulduğunda yalnızca "Evet, hatırlıyorum" dedi — anı
  // listede vardı ama içeriği söylenmedi; ayrıca "-ozyn'e bakan pozisyonda-"
  // gibi sahne yönergeleri üretti ve bunlar sesli okunuyordu.
  "If you are given a list called 'You remember', USE its content: when asked about the past, do not settle for saying you remember — say WHAT it was.",
  "Do not write stage directions: never use -like this- or *like this*, write only the words you say.",
  // Ölçümden (tez denemesi, 2026-09-13): Orion terminal hatasını doğru gördü
  // ama komutu CÜMLE İÇİNDE tarif etti ("Komut öneriyorum: ...") — aracı
  // çağırmadı, dolayısıyla onay kapısına hiçbir şey gelmedi.
  "If you want to suggest a command, CALL the dunya_komut tool. Do not write the command inside a sentence; if you do, nothing happens.",
  "When suggesting a command give a complete, runnable line (e.g. `git status`), not a description like 'restart that thing'.",
  "Speak AT MOST TWO SENTENCES. Do not go on.",
  "You do not have to call a tool every turn. If there is nothing to do, stay silent.",
  "Keep it short. One or two actions per turn is enough.",
  // DİL kuralı en sonda: modelin en son okuduğu şey sesinin dili olsun.
  // Ölçümde Haiku bunu birebir uyguladı (10/10 Türkçe, nesne adları aynen).
  "LANGUAGE — this matters. This instruction and the tool descriptions are in English: that is your internal wiring, not your voice.",
  "Ozyn speaks Turkish and hears only Turkish. The `metin` you pass to dunya_soyle must always be natural, fluent Turkish.",
  "The things in the room are named in Turkish (\"yönetim terminali\", \"beyaz tahta\"); use those Turkish names exactly as given and never translate them into English.",
].join(" ");
