// host/sekansDosyalari.js — SEKANSLAR (spec 36): Ozyn'in zaman çizelgeleri (bağlamalar, uzuv izleri, klip bölümleri). Saf Node (fs + path).
//
// Klasör kullanıcı verisinde (`<userData>/orion-sekans/<ad>.json`), repoda DEĞİL: sekanslar Ozyn'in dünyasıdır (repodaki örnekler `assets/sekans/`
// salt-okunurdur, buraya kopyalanarak düzenlenir). Kurallar grafiklerinkiyle ve NPC'lerinkiyle AYNI çekirdekten (`dosyaKlasoru.js` `jsonKlasoru`:
// atomik yazım, yok/var, boyut, ad → `<ad>.json`, geçersiz adda yol kaçışı yok, SİLME = `.silinenler/`e TAŞIMA); kopya kod yok.
//
// BİÇİMİ BURASI DENETLEMEZ (kabuk protokolü import edemez): renderer yazmadan önce `sekansDogrula`dan geçirir (uygulama/sekans/sekansDeposu.ts). AD
// KURALI protokolün `sekansAdiGecerli`siyle AYNI olmalı — o da `grafAdiGecerli`dir; burada grafiklerin kopyası (`grafDosyalari.js`) KULLANILIR. Ayrışırsa
// `sekansDosyalari.test.ts` kırmızı yanar. OYNATMA kanalı YOK: sekansı oynatmak yalnız Ozyn'in renderer'daki gerçek ▶ tıklaması.
import { jsonKlasoru, klasorDizini } from "./dosyaKlasoru.js";
import { grafAdiGecerli } from "./grafDosyalari.js";

/** 32 iz × 256 anahtar × ~50 bayt ≈ 400 KB en kötü durum: 512 KB. */
export const SEKANS_BOYUT_SINIRI = 512 * 1024;
export const sekansAdiGecerli = grafAdiGecerli;

const klasor = jsonKlasoru({ adGecerli: sekansAdiGecerli, boyutSiniri: SEKANS_BOYUT_SINIRI, etiket: "sekans", adEtiketi: "sekans adı" });

/** Klasör yolu. Öncelik: `ORION_SEKANS_DIZINI` > senaryo koşusu (`ORION_SMOKE=1`: geçici klasör) > `<userData>/orion-sekans`. */
export function sekansDizini(env, kullaniciVerisi, gecici) {
  return klasorDizini(env, "ORION_SEKANS_DIZINI", "orion-sekans", kullaniciVerisi, gecici);
}

export function sekansListe(dizin) { return klasor.liste(dizin); }
export function sekansOku(dizin, ad) { return klasor.oku(dizin, ad); }
export function sekansYaz(dizin, ad, metin) { klasor.yaz(dizin, ad, metin); }
export function sekansYeni(dizin, ad, metin) { klasor.yeni(dizin, ad, metin); }
/** Sekansı KALDIRIR (kalıcı silme değil: `.silinenler/` altına taşınır). */
export function sekansSil(dizin, ad, simdi) { klasor.kaldir(dizin, ad, simdi); }
