// host/dosyaKlasoru.js — KULLANICI VERİSİNDEKİ METİN DOSYASI KLASÖRÜ: ortak çekirdek (spec 35 dilim 1'de md deposundan genelleştirildi). Saf Node (fs + path).
//
// Kullanıcıları: Orion'un md dosyaları (`mdDosyalari.js`, spec 32), düğüm grafikleri (`grafDosyalari.js`, spec 35) ve NPC kayıtları (`npcDosyalari.js`,
// spec 35 dilim 3; son ikisi `jsonKlasoru` üstünden: kayıt başına bir `<ad>.json`). Hepsi aynı kurallarla
// yazılır; KOPYA YOK — ikinci bir deponun kendi atomik yazımını, ad denetimini, yok/var ayrımını yeniden yazması kuralların ayrışması demekti.
// KURALLAR (mdDosyalari.test.ts + grafDosyalari.test.ts):
//   1. ATOMİK YAZIM: önce `.tmp`, sonra yeniden adlandırma: yarıda kalan yazım hedefe dokunmaz.
//   2. YAZ var olanı günceller (yoksa `yok`: yanlış adla yeni dosya doğmasın); YENİ yalnız yoksa yazar (varsa `var`: başkasının üstüne yazılmaz). SİLME = KALDIR (`kaldir`): dosya kalıcı silinmez, klasörün `.silinenler/` altına `<ad>.<zaman>` olarak taşınır (yanlış tıklama geri alınabilir, Ozyn'in programı kaybolmaz).
//   3. AD kuralı kullanıcının (`adGecerli`); klasör gezme her kuralda yasak olmalı (yol ayracı, `..`). Boyut sınırı kullanıcının.
//   4. Klasör yeri: env değişkeni > senaryo koşusu (`ORION_SMOKE=1`: geçici klasör, gerçek veriye yazılmaz) > kullanıcı verisi.
import fs from "node:fs";
import path from "node:path";

/** Kodlu hata: IPC sonucu `kod`u taşır (arayüz "yok / var / geçersiz ad" ayrımını koddan yapar, metinden değil). */
export const kodluHata = (kod, mesaj) => Object.assign(new Error(mesaj), { kod });

export function atomikYaz(hedef, metin) {
  const gecici = `${hedef}.tmp`;
  fs.writeFileSync(gecici, metin, "utf8");
  fs.renameSync(gecici, hedef);
}

/**
 * Klasör yolu. Öncelik: `env[envAdi]` > senaryo koşusu (`ORION_SMOKE=1`: `<gecici>/<klasor>-deneme`) > `<kullaniciVerisi>/<klasor>`.
 * @param {Record<string, string | undefined>} env
 */
export function klasorDizini(env, envAdi, klasor, kullaniciVerisi, gecici) {
  if (env[envAdi]) return env[envAdi];
  if (env.ORION_SMOKE === "1") return path.join(gecici, `${klasor}-deneme`);
  return path.join(kullaniciVerisi, klasor);
}

/**
 * Bir dosya türünün klasör işlemleri.
 * @param {{ adGecerli: (ad: unknown) => boolean, boyutSiniri: number, etiket: string, adEtiketi: string }} t
 *   `etiket` hata metninde dosyanın adı ("md dosyası", "grafik"); `adEtiketi` geçersiz ad metninde ("md adı").
 */
export function dosyaKlasoru(t) {
  const yol = (dizin, ad) => {
    if (!t.adGecerli(ad)) throw kodluHata("gecersiz-ad", `geçersiz ${t.adEtiketi}: ${JSON.stringify(ad)}`);
    return path.join(dizin, ad);
  };
  const boyutDene = (metin) => {
    if (typeof metin !== "string") throw kodluHata("gecersiz-icerik", "içerik metin olmalı");
    if (Buffer.byteLength(metin, "utf8") > t.boyutSiniri) throw kodluHata("cok-buyuk", `içerik ${t.boyutSiniri / 1024} KB sınırını aşıyor`);
  };
  return {
    yol,
    /** Klasördeki geçerli adlı dosyalar (ada göre değil, okuma sırasıyla; sıralama kullanıcının). */
    liste(dizin) {
      fs.mkdirSync(dizin, { recursive: true });
      return fs.readdirSync(dizin).filter((ad) => t.adGecerli(ad)).map((ad) => {
        const s = fs.statSync(path.join(dizin, ad));
        return { ad, boyut: s.size, degisti: Math.round(s.mtimeMs) };
      });
    },
    oku(dizin, ad) {
      const p = yol(dizin, ad);
      if (!fs.existsSync(p)) throw kodluHata("yok", `${t.etiket} yok: ${ad}`);
      return fs.readFileSync(p, "utf8");
    },
    /** Var olanı günceller (yoksa `yok`). */
    yaz(dizin, ad, metin) {
      const p = yol(dizin, ad);
      boyutDene(metin);
      if (!fs.existsSync(p)) throw kodluHata("yok", `${t.etiket} yok: ${ad} (yeni dosya için YENİ)`);
      atomikYaz(p, metin);
    },
    /** Dosyayı `.silinenler/` altına taşır (kalıcı silme yok); yoksa `yok`. Listede artık görünmez. */
    kaldir(dizin, ad, simdi = Date.now) {
      const p = yol(dizin, ad);
      if (!fs.existsSync(p)) throw kodluHata("yok", `${t.etiket} yok: ${ad}`);
      const cop = path.join(dizin, ".silinenler");
      fs.mkdirSync(cop, { recursive: true });
      fs.renameSync(p, path.join(cop, `${ad}.${simdi()}`));
    },
    /** Yeni dosya; varsa `var`. */
    yeni(dizin, ad, metin = "") {
      const p = yol(dizin, ad);
      boyutDene(metin);
      fs.mkdirSync(dizin, { recursive: true });
      if (fs.existsSync(p)) throw kodluHata("var", `zaten var: ${ad}`);
      atomikYaz(p, metin);
    },
  };
}

const JSON_UZANTISI = ".json";

/**
 * KAYIT BAŞINA BİR `<ad>.json` DOSYASI olan klasör (spec 35: düğüm grafikleri `grafDosyalari.js`, dilim 3'te NPC kayıtları `npcDosyalari.js`). Ad
 * uzantısızdır (kaydın adı = dosyanın adı); liste uzantısız adla, ada göre sıralı. İkinci tür kendi ad→dosya çevirisini yazsaydı, aşağıdaki hata
 * (geçersiz adı çekirdeğe bırakmak) orada yeniden doğabilirdi — KOPYA YOK, ikisi de buradan.
 * @param {{ adGecerli: (ad: unknown) => boolean, boyutSiniri: number, etiket: string, adEtiketi: string }} t  `adGecerli` KAYDIN adının kuralı (uzantısız).
 */
export function jsonKlasoru(t) {
  const klasor = dosyaKlasoru({
    adGecerli: (d) => typeof d === "string" && d.endsWith(JSON_UZANTISI) && t.adGecerli(d.slice(0, -JSON_UZANTISI.length)),
    boyutSiniri: t.boyutSiniri, etiket: t.etiket, adEtiketi: t.adEtiketi,
  });
  /**
   * Kayıt adını dosya adına çevirir; geçersiz ad BURADA `gecersiz-ad` hatasıdır. Geçersiz adı olduğu gibi çekirdeğe bırakmak yanlıştı (dilim 1 testinde
   * yakalandı): "x.json" kayıt adı olarak geçersizdir ama DOSYA adı olarak geçerlidir, yani "x" kaydının üstüne yazılırdı.
   */
  const dosya = (ad) => {
    if (!t.adGecerli(ad)) throw kodluHata("gecersiz-ad", `geçersiz ${t.adEtiketi}: ${JSON.stringify(ad)} (harf, rakam, _ ve -; en çok 48)`);
    return `${ad}${JSON_UZANTISI}`;
  };
  return {
    /** Klasördeki kayıtlar (ad = dosya adı uzantısız), ada göre. */
    liste: (dizin) => klasor.liste(dizin).map((d) => ({ ...d, ad: d.ad.slice(0, -JSON_UZANTISI.length) })).sort((a, b) => a.ad.localeCompare(b.ad, "tr")),
    oku: (dizin, ad) => klasor.oku(dizin, dosya(ad)),
    yaz: (dizin, ad, metin) => klasor.yaz(dizin, dosya(ad), metin),
    yeni: (dizin, ad, metin) => klasor.yeni(dizin, dosya(ad), metin),
    /** KALDIRIR (kalıcı silme değil: `.silinenler/<ad>.json.<zaman>`). */
    kaldir: (dizin, ad, simdi) => klasor.kaldir(dizin, dosya(ad), simdi),
  };
}
