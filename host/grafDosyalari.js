// host/grafDosyalari.js — DÜĞÜM GRAFİKLERİ (spec 35 dilim 1): Ozyn'in ve (dilim 4'te) Orion'un programları ve desenleri. Saf Node (fs + path).
//
// Klasör kullanıcı verisinde (`<userData>/orion-graf/`), repoda DEĞİL: programlar Ozyn'indir. Dosya başına bir grafik: `<grafın adı>.json`; olay grafiği
// mi desen mi dosyanın içindeki `tur` söyler (iki klasör yok: bir desen adı bir grafik adıyla çakışamasın, `desen.cagir` adla çağırır).
// Kurallar ortak çekirdekten (`dosyaKlasoru.js`: atomik yazım, yok/var, boyut); md deposunun kopyası değil.
//
// BİÇİMİ BURASI DENETLEMEZ: kabuk protokolü import edemez (Kabuk alt-sistemi bağımsız, `tools/altSistemler.ts`). Renderer yazmadan önce `grafDogrula`dan
// geçirir (uygulama/graf/grafDeposu.ts); burası yalnız dosyayı güvenle tutar. AD KURALI `protocol/graf.ts` `grafAdiGecerli` ile AYNI olmalı (dosya adı
// grafın adıdır): kopya bilerek burada, ayrışırsa `grafDosyalari.test.ts` kırmızı yanar.
import { dosyaKlasoru, klasorDizini, kodluHata } from "./dosyaKlasoru.js";

export const GRAF_BOYUT_SINIRI = 256 * 1024;
const UZANTI = ".json";

/** Grafik adı: harf, rakam, _ ve -; boş değil, en çok 48 karakter (protocol/graf.ts `grafAdiGecerli` ile aynı; bekçi testte). */
export const grafAdiGecerli = (ad) => typeof ad === "string" && ad.length > 0 && ad.length <= 48 && /^[\p{L}\p{N}_-]+$/u.test(ad);

const dosyaAdiGecerli = (d) => typeof d === "string" && d.endsWith(UZANTI) && grafAdiGecerli(d.slice(0, -UZANTI.length));
const klasor = dosyaKlasoru({ adGecerli: dosyaAdiGecerli, boyutSiniri: GRAF_BOYUT_SINIRI, etiket: "grafik", adEtiketi: "grafik adı" });

/**
 * Grafik adını dosya adına çevirir; geçersiz ad BURADA `gecersiz-ad` hatasıdır. Geçersiz adı olduğu gibi çekirdeğe bırakmak yanlıştı (testte yakalandı):
 * "x.json" grafik adı olarak geçersizdir ama DOSYA adı olarak geçerlidir, yani "x" grafiğinin üstüne yazılırdı.
 */
function dosya(ad) {
  if (!grafAdiGecerli(ad)) throw kodluHata("gecersiz-ad", `geçersiz grafik adı: ${JSON.stringify(ad)} (harf, rakam, _ ve -; en çok 48)`);
  return `${ad}${UZANTI}`;
}

/** Klasör yolu. Öncelik: `ORION_GRAF_DIZINI` > senaryo koşusu (`ORION_SMOKE=1`: geçici klasör) > `<userData>/orion-graf`. */
export function grafDizini(env, kullaniciVerisi, gecici) {
  return klasorDizini(env, "ORION_GRAF_DIZINI", "orion-graf", kullaniciVerisi, gecici);
}

/** Klasördeki grafikler (ad = dosya adı uzantısız), ada göre. */
export function grafListe(dizin) {
  return klasor.liste(dizin).map((d) => ({ ...d, ad: d.ad.slice(0, -UZANTI.length) })).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
}
export function grafOku(dizin, ad) { return klasor.oku(dizin, dosya(ad)); }
export function grafYaz(dizin, ad, metin) { klasor.yaz(dizin, dosya(ad), metin); }
export function grafYeni(dizin, ad, metin) { klasor.yeni(dizin, dosya(ad), metin); }
