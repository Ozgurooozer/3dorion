// host/levelDosyasi.js — Level ve hazır yapı DOSYALARI (spec 23 A): listele, oku, kaydet, oluştur. Saf Node (fs + path).
//
// TEK YER: geliştirmede vite ara yazılımı (tools/vite-level.ts) kullanır; Electron'da editör açılınca ana süreç
// (main.js, IPC `level:*`) aynı modülü kullanacak — yalnız kök klasör değişir (geliştirme: repo `world/level`,
// paket: kullanıcı verisi `levels/`). İki ayrı yazım kodu olmasın diye.
//
// KURALLAR (levelDosyasi.test.ts):
//   1. ATOMİK YAZIM: önce `.tmp`, sonra yeniden adlandırma (hafizaDosyasi.js ile aynı): yarıda kalan yazım hedefe
//      dokunmaz.
//   2. KAYDET var olanı günceller (yoksa 404: yanlış adla yeni level doğmasın); OLUŞTUR yalnız yoksa yazar (varsa
//      409: başka level'ın üstüne yazılmasın). Silme YOK — geri alınamaz, elle yapılır.
//   3. AD kuralı: level adı küçük harf/rakam/tire (klasör ve URL adı); hazır yapı adı harf/rakam/tire (Türkçe harf olur).
//   İçerik DOĞRULAMASI burada değil (host world'ü import etmez): çağıran doğrular (levelTanimiDogrula, parcaOku).
import fs from "node:fs";
import path from "node:path";

export const LEVEL_UZANTISI = ".level.json";
export const HAZIR_UZANTISI = ".hazir.json";

/** HTTP/IPC tarafında koda çevrilen hata. */
const hata = (kod, mesaj) => Object.assign(new Error(mesaj), { kod });

/** @param {string} ad */
export const levelAdiGecerli = (ad) => typeof ad === "string" && /^[a-z0-9][a-z0-9-]{0,47}$/.test(ad);
/** @param {string} ad */
export const hazirAdiGecerli = (ad) => typeof ad === "string" && /^[\p{L}\p{N}][\p{L}\p{N}-]{0,63}$/u.test(ad);

/** @param {string} kok @param {string} ad */
export function levelYolu(kok, ad) {
  if (!levelAdiGecerli(ad)) throw hata(400, `geçersiz level adı: ${ad} (küçük harf, rakam, tire)`);
  return path.join(kok, ad, `${ad}${LEVEL_UZANTISI}`);
}

/**
 * Kökteki level'lar: `<ad>/<ad>.level.json` olan klasörler, ada göre sıralı.
 * @param {string} kok
 * @returns {{ ad: string; bayt: number; degisme: number }[]}
 */
export function levelListesi(kok) {
  if (!fs.existsSync(kok)) return [];
  return fs.readdirSync(kok, { withFileTypes: true })
    .filter((d) => d.isDirectory() && levelAdiGecerli(d.name))
    .map((d) => ({ ad: d.name, yol: path.join(kok, d.name, `${d.name}${LEVEL_UZANTISI}`) }))
    .filter((l) => fs.existsSync(l.yol))
    .map((l) => { const s = fs.statSync(l.yol); return { ad: l.ad, bayt: s.size, degisme: s.mtimeMs }; })
    .sort((a, b) => a.ad.localeCompare(b.ad));
}

/** Önce `.tmp`, sonra yeniden adlandırma. Üst klasör yoksa açılır. @param {string} yol @param {string} metin */
export function atomikYaz(yol, metin) {
  fs.mkdirSync(path.dirname(yol), { recursive: true });
  const gecici = `${yol}.tmp`;
  fs.writeFileSync(gecici, metin, "utf8");
  fs.renameSync(gecici, yol);
}

/** @param {string} kok @param {string} ad @returns {string} */
export function levelOku(kok, ad) {
  const yol = levelYolu(kok, ad);
  if (!fs.existsSync(yol)) throw hata(404, `level yok: ${ad}`);
  return fs.readFileSync(yol, "utf8");
}

/** Var olan level'ı günceller. @param {string} kok @param {string} ad @param {string} metin @returns {string} yazılan yol */
export function levelKaydet(kok, ad, metin) {
  const yol = levelYolu(kok, ad);
  if (!fs.existsSync(yol)) throw hata(404, `level dosyası yok: ${ad} (yeni level için "oluştur")`);
  atomikYaz(yol, metin);
  return yol;
}

/** Yeni level; aynı adda varsa 409. @param {string} kok @param {string} ad @param {string} metin @returns {string} */
export function levelOlustur(kok, ad, metin) {
  const yol = levelYolu(kok, ad);
  if (fs.existsSync(yol)) throw hata(409, `bu adda level zaten var: ${ad}`);
  atomikYaz(yol, metin);
  return yol;
}

/** Klasördeki hazır yapı adları (sıralı). @param {string} klasor @returns {string[]} */
export function hazirListesi(klasor) {
  if (!fs.existsSync(klasor)) return [];
  return fs.readdirSync(klasor).filter((f) => f.endsWith(HAZIR_UZANTISI)).map((f) => f.slice(0, -HAZIR_UZANTISI.length)).sort();
}

/** @param {string} klasor @param {string} ad */
export function hazirYolu(klasor, ad) {
  if (!hazirAdiGecerli(ad)) throw hata(400, `geçersiz hazır yapı adı: ${ad} (harf, rakam, tire)`);
  return path.join(klasor, `${ad}${HAZIR_UZANTISI}`);
}

/** Hazır yapı yazar; varsa ve `ez` değilse 409. @param {string} klasor @param {string} ad @param {string} metin @param {boolean} ez */
export function hazirKaydet(klasor, ad, metin, ez) {
  const yol = hazirYolu(klasor, ad);
  if (fs.existsSync(yol) && !ez) throw hata(409, `zaten var: ${ad} (üstüne yazmak için onayla)`);
  atomikYaz(yol, metin);
  return yol;
}
