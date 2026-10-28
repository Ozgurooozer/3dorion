// host/grafDosyalari.js — DÜĞÜM GRAFİKLERİ (spec 35 dilim 1): Ozyn'in ve (dilim 4'te) Orion'un programları ve desenleri. Saf Node (fs + path).
//
// Klasör kullanıcı verisinde (`<userData>/orion-graf/`), repoda DEĞİL: programlar Ozyn'indir. Dosya başına bir grafik: `<grafın adı>.json`; olay grafiği
// mi desen mi dosyanın içindeki `tur` söyler (iki klasör yok: bir desen adı bir grafik adıyla çakışamasın, `desen.cagir` adla çağırır).
// Kurallar ortak çekirdekten (`dosyaKlasoru.js` `jsonKlasoru`: atomik yazım, yok/var, boyut, ad → `<ad>.json`); md deposunun ve NPC kayıtlarının
// (`npcDosyalari.js`, dilim 3) kopyası değil.
//
// BİÇİMİ BURASI DENETLEMEZ: kabuk protokolü import edemez (Kabuk alt-sistemi bağımsız, `tools/altSistemler.ts`). Renderer yazmadan önce `grafDogrula`dan
// geçirir (uygulama/graf/grafDeposu.ts); burası yalnız dosyayı güvenle tutar. AD KURALI `protocol/graf.ts` `grafAdiGecerli` ile AYNI olmalı (dosya adı
// grafın adıdır): kopya bilerek burada, ayrışırsa `grafDosyalari.test.ts` kırmızı yanar. NPC adı da bu kuralı kullanır (protokolde `npcAdiGecerli =
// grafAdiGecerli`): ikinci bir kopya yok.
import { jsonKlasoru, klasorDizini } from "./dosyaKlasoru.js";

export const GRAF_BOYUT_SINIRI = 256 * 1024;

/** Grafik adı: harf, rakam, _ ve -; boş değil, en çok 48 karakter (protocol/graf.ts `grafAdiGecerli` ile aynı; bekçi testte). */
export const grafAdiGecerli = (ad) => typeof ad === "string" && ad.length > 0 && ad.length <= 48 && /^[\p{L}\p{N}_-]+$/u.test(ad);

const klasor = jsonKlasoru({ adGecerli: grafAdiGecerli, boyutSiniri: GRAF_BOYUT_SINIRI, etiket: "grafik", adEtiketi: "grafik adı" });

/** Klasör yolu. Öncelik: `ORION_GRAF_DIZINI` > senaryo koşusu (`ORION_SMOKE=1`: geçici klasör) > `<userData>/orion-graf`. */
export function grafDizini(env, kullaniciVerisi, gecici, projeDizini) {
  return klasorDizini(env, "ORION_GRAF_DIZINI", "orion-graf", kullaniciVerisi, gecici, projeDizini);
}

/** Klasördeki grafikler (ad = dosya adı uzantısız), ada göre. */
export function grafListe(dizin) { return klasor.liste(dizin); }
export function grafOku(dizin, ad) { return klasor.oku(dizin, ad); }
export function grafYaz(dizin, ad, metin) { klasor.yaz(dizin, ad, metin); }
export function grafYeni(dizin, ad, metin) { klasor.yeni(dizin, ad, metin); }
/** Grafiği KALDIRIR (kalıcı silme değil: `.silinenler/` altına taşınır; Ozyn'in programı yanlış tıklamayla kaybolmasın). */
export function grafSil(dizin, ad, simdi) { klasor.kaldir(dizin, ad, simdi); }
