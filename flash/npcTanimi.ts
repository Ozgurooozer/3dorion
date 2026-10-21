// flash/npcTanimi.ts — NPC TANIMI: bir LLM'siz ajanın kimliği VERİDİR (spec 33).
//
// Oyunlardaki NPC gibi: "zekâ" kural + veri + diyalog seçenekleri. Flash'ın neyi bildiği ve neyi yapabildiği burada yazar; ikinci bir
// NPC = ikinci bir tanım, kod değil. Ajan sayısı veriyle ölçeklenir, model maliyetiyle değil (plan: ileride 300 ajan).
//
// `komutlar` iki işe yarar: anlamadığı sözde "şunu mu demek istedin" önerisinin adayları ve "bildiklerim" listesi. Her örnek Flash'ın
// LLM'siz yolundan GERÇEKTEN geçmelidir (komut sözlüğü / takip / sohbet) ve doğurduğu her niyet `bedenNiyetleri`nde olmalıdır —
// yoksa Flash yapamayacağı bir şeyi önerir. Bekçi: flash/npcTanimi.test.ts (örnekler gerçek Flash köprüsünden geçirilir).
"use strict";
import type { Niyet, NiyetTur } from "../protocol/niyet.ts";

export interface NpcKomutu {
  /** Gösterilen biçim ("otur", "bana gel"): öneri ve "bildiklerim" listesi bunu söyler. */
  readonly soz: string;
  /** Yalnız EŞLEŞTİRME için başka biçimler (mikrofon İngilizce çözer: "sit down"). Gösterilmez. */
  readonly esler?: readonly string[];
}

export interface NpcTanimi {
  /** Ajan kimliği (uygulama/ajanlar/ajanKaydi.ts ile aynı). */
  readonly id: string;
  /** Görünen ad. */
  readonly ad: string;
  /** Bedenin ve çipin rengi (#rrggbb). */
  readonly renk: string;
  /** Bildiği komutlar, öneri sırasıyla (öncelikli olan önce). */
  readonly komutlar: readonly NpcKomutu[];
  /** Bedeninin yürütebildiği niyetler. Dışındaki niyet (odaklan, komut, yaz…) "yapamam" sonucuyla döner. */
  readonly bedenNiyetleri: ReadonlySet<NiyetTur>;
  /** Dünya olaylarına bedensel tepkiler (algı → niyet). Beden boşken verilir; sözsüz: NPC her kıpırtıya konuşmaz. */
  readonly tepkiler?: readonly NpcTepkisi[];
}

/** Bir dünya olayına (`world/olayUretici.ts` adları) verilen bedensel tepki: VERİ, kod değil. Niyet `bedenNiyetleri` içinde olmalı (bekçi: npcTanimi.test.ts). */
export interface NpcTepkisi {
  readonly olay: string;
  readonly niyet: Niyet;
}

/**
 * ORION FLASH: Orion'un bedeni (başka renk), Orion'un LLM'siz refleksleri, HİÇ model çağrısı yok.
 * Renk: sıcak amber — Orion'un soğuk camgöbeği vurgusundan uzak, iki beden odada bir bakışta ayrılsın.
 */
export const FLASH: NpcTanimi = {
  id: "flash",
  ad: "Flash",
  renk: "#ffb347",
  komutlar: [
    { soz: "otur", esler: ["sit down", "take a seat"] },
    // "stand up"/"get up" eş YAZILMAZ: tam hâlleri zaten komut sözlüğünde, yakınlıkta ise "getir"/"standart"ı "kalk"a çekiyorlardı (keşif).
    { soz: "kalk" },
    { soz: "bana gel", esler: ["come here", "come to me"] },
    { soz: "dur", esler: ["stop"] },
    { soz: "bana bak", esler: ["look at me"] },
    { soz: "beni takip et", esler: ["follow me"] },
    { soz: "takibi bırak" },
    { soz: "pencereye bak", esler: ["look at the window"] },
    { soz: "tahtaya git", esler: ["go to the board"] },
    { soz: "kapıya git", esler: ["go to the door"] },
    { soz: "masaya git", esler: ["go to the desk"] },
  ],
  bedenNiyetleri: new Set<NiyetTur>(["git", "otur", "kalk", "dur", "poz", "jest", "bak", "al", "birak"]),
  // Ozyn yaklaşınca ona döner, uzaklaşınca serbest bakışa geçer. Söz YOK: konuşmak LLM'siz ajanda kural işidir (grafik), refleks değil.
  tepkiler: [
    { olay: "ozyn_yaklasti", niyet: { tur: "bak", hedef: { tip: "oyuncu" } } },
    { olay: "ozyn_uzaklasti", niyet: { tur: "bak", hedef: null } },
  ],
};
