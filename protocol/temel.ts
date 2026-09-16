// protocol/temel.ts — Dünya Protokolü'nün taşıyıcı katmanı.
//
// Bu dizin hiçbir şeye bağımlı DEĞİLDİR: ne Babylon'a, ne Orion çekirdeğine,
// ne Electron'a. Beyin ile beden arasındaki tek sözleşme burada tanımlı.
// Motor değişirse (Babylon → Three) yalnızca world/ yeniden yazılır; beyin
// tarafı bu dosyalara baktığı için etkilenmez.
//
// Taşıma biçimi molp `core/mesh` protokolüyle uyumlu tutuldu: bir zarf,
// mesh kanalında `tur: "SAHNE"` mesajının `govde` alanı olarak seyahat edebilir.
"use strict";

/** Protokol sürümü. Kırıcı değişiklikte artar; alıcı uyumsuz sürümü reddeder. */
export const SURUM = 1 as const;

/**
 * Algının hangi tüketiciye gittiği.
 *
 * `yerel`  — yalnızca world/ ve mind/ içinde dolaşır. 20Hz akabilir, bedava.
 * `beyin`  — LLM bağlamına girer. TOKEN MALİYETİ VARDIR.
 *
 * KATI KURAL: hiçbir yüksek frekanslı algı doğrudan `beyin` kanalına yazılmaz.
 * Terfi kararını mind/dikkat verir — anlamlı değişim yoksa mesaj üretilmez.
 * Bu kural projenin maliyet tavanıdır; ihlali "AI dünyada yaşıyor" iddiasını
 * saniyede binlerce token'a çevirir.
 */
export type Kanal = "yerel" | "beyin";

/** Dünyada bir hedef gösterme biçimleri. */
export type Hedef =
  | { tip: "oyuncu" }
  | { tip: "nesne"; ad: string }
  | { tip: "capa";  ad: string }
  | { tip: "nokta"; x: number; y: number; z: number };

/**
 * Sahnede sabit, isimle anılan noktalar. world/level bunları kaydeder.
 *
 * Birliğe değer EKLEMEK kırıcı değildir (bkz. SOZLESME.md "Değiştirme kuralı"),
 * çıkarmak kırıcıdır. `monitor` T1'den sonra eklendi: `OyuncuDurumu.etkilesim`
 * zaten bu adı anıyordu ve `odaklan` niyeti onu hedef alıyor.
 */
export type CapaAdi =
  | "masa" | "sandalye" | "tahta" | "pencere" | "kapi" | "oda_ortasi" | "monitor"
  // Zihin duvarı (sağ duvar): Orion'un kendi işleyişini gösteren yüzeyler.
  // Orion oraya YÜRÜYEBİLİR — kendi durumuna bakmak bir eylemdir.
  | "sema" | "gunluk" | "admin";

export interface Vec3 { x: number; y: number; z: number }

/** Her protokol mesajının dış kabuğu. */
export interface Zarf<G> {
  v:     typeof SURUM;
  id:    string;
  ts:    number;
  /** "niyet" = beyin→dünya, "algi" = dünya→beyin/yerel */
  yon:   "niyet" | "algi";
  govde: G;
}

let _sayac = 0;

/** Çakışmayan, sıralanabilir, bağımlılıksız kimlik. */
export function kimlik(onek = "m"): string {
  _sayac = (_sayac + 1) % 0xffff;
  return `${onek}_${Date.now().toString(36)}_${_sayac.toString(36)}`;
}

export function zarfla<G>(yon: Zarf<G>["yon"], govde: G): Zarf<G> {
  return { v: SURUM, id: kimlik(yon === "niyet" ? "n" : "a"), ts: Date.now(), yon, govde };
}
