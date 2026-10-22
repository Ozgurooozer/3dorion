// host/npcDosyalari.js — NPC KAYITLARI (spec 35 dilim 3, NPC sınıfı): bir ajan + onu süren grafikler + örnek başına parametreler. Saf Node (fs + path).
//
// Klasör kullanıcı verisinde (`<userData>/orion-npc/<ad>.json`), repoda DEĞİL: NPC'ler Ozyn'in dünyasıdır. Kurallar grafiklerinkiyle AYNI çekirdekten
// (`dosyaKlasoru.js` `jsonKlasoru`: atomik yazım, yok/var, boyut, SİLME = `.silinenler/`e TAŞIMA); kopya kod yok.
//
// BİÇİMİ BURASI DENETLEMEZ (kabuk protokolü import edemez): renderer yazmadan önce `npcDogrula`dan geçirir (uygulama/graf/npcDeposu.ts). AD KURALI
// protokolün `npcAdiGecerli`siyle AYNI olmalı — o da `grafAdiGecerli`dir; burada da grafiklerin kopyası (`grafDosyalari.js`) KULLANILIR, üçüncü bir kopya
// yazılmaz. Ayrışırsa `npcDosyalari.test.ts` kırmızı yanar. ÇALIŞTIRMA/DİNLEME kanalı YOK: NPC'yi dinlemeye almak yalnız Ozyn'in renderer'daki tıklaması.
import { jsonKlasoru, klasorDizini } from "./dosyaKlasoru.js";
import { grafAdiGecerli } from "./grafDosyalari.js";

/** NPC kaydı küçüktür (en çok 8 grafik adı + 32 kısa parametre): 16 KB bol. */
export const NPC_BOYUT_SINIRI = 16 * 1024;
export const npcAdiGecerli = grafAdiGecerli;

const klasor = jsonKlasoru({ adGecerli: npcAdiGecerli, boyutSiniri: NPC_BOYUT_SINIRI, etiket: "NPC", adEtiketi: "NPC adı" });

/** Klasör yolu. Öncelik: `ORION_NPC_DIZINI` > senaryo koşusu (`ORION_SMOKE=1`: geçici klasör) > `<userData>/orion-npc`. */
export function npcDizini(env, kullaniciVerisi, gecici) {
  return klasorDizini(env, "ORION_NPC_DIZINI", "orion-npc", kullaniciVerisi, gecici);
}

export function npcListe(dizin) { return klasor.liste(dizin); }
export function npcOku(dizin, ad) { return klasor.oku(dizin, ad); }
export function npcYaz(dizin, ad, metin) { klasor.yaz(dizin, ad, metin); }
export function npcYeni(dizin, ad, metin) { klasor.yeni(dizin, ad, metin); }
/** NPC kaydını KALDIRIR (kalıcı silme değil: `.silinenler/` altına taşınır). */
export function npcSil(dizin, ad, simdi) { klasor.kaldir(dizin, ad, simdi); }
