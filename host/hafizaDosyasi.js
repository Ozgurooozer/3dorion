// host/hafizaDosyasi.js — Orion'un hafızasının diskteki yeri (spec 07 K4).
//
// NEDEN DOSYA. Hafıza renderer'ın `localStorage`'ındaydı: tarayıcı profiline
// ve köke bağlı — profil temizlenirse hafıza gider, kök değişirse iki ayrı
// hafıza oluşur, ölçüm araçları ve dış beyin ona hiç erişemez. Burada host'un
// sahip olduğu düz bir JSON dosyası: okunabilir, yedeklenebilir, diff'lenebilir.
//
// NEDEN SQLITE DEĞİL. 26 kayıt, sorgu ihtiyacı yok; `better-sqlite3` Electron
// için yerel derleme ister — gerçek bir bakım yükü. Bu boyutta atomik JSON
// doğru araç. Kayıt sayısı onbinlere çıkarsa ya da sorgu gerekirse yeniden bak.
//
// İKİ KURAL, ikisi de test edildi (hafizaDosyasi.test.ts):
//   1. ATOMİK YAZIM: önce `.tmp`'ye, sonra yeniden adlandırma. Yarıda kalan
//      yazım hedef dosyaya hiç dokunmaz; ya eski hâli kalır ya yeni hâli.
//   2. BOZUK ≠ BOŞ: okunamayan dosya "boş hafıza" SAYILMAZ. Sayılsaydı bir
//      sonraki yazım gerçek hafızayı boş diziyle ezerdi — sessiz ve geri
//      dönüşsüz. Bozuk dosya silinmez, yanına taşınır: kurtarılabilir kalır.
//
// Saf Node (fs + path). Electron'a bağlı değil: testte doğrudan koşar.
import fs from "node:fs";
import path from "node:path";

/**
 * Hafıza dosyasının yolu. Öncelik: `ORION_HAFIZA_DOSYASI` > senaryo koşusu (`ORION_SMOKE=1`) >
 * gerçek dosya.
 *
 * SENARYO YALITIMI (spec 16 F0): senaryolar eskiden GERÇEK hafızaya yazıyordu — `hafizadene`nin
 * deneme cümlesi bir koşudan sonra hafızada kalıyor, önemi her koşuda artıyor, sonraki hatırlama
 * ölçüsünü kirletiyordu; mikrofon denemesindeki yanlış duymalar da Ozyn'in hafızasına karıştı.
 * Senaryo koşusu artık her açılışta BOŞ, geçici bir dosyayla başlar (süreç kimliğiyle ayrık).
 * Aynı hafızayla koşmak gerekirse `ORION_HAFIZA_DOSYASI` açıkça verilir.
 *
 * @param {Record<string, string | undefined>} env
 * @param {string} kullaniciDizini  app.getPath("userData")
 * @param {string} geciciDizin      os.tmpdir()
 * @param {number} [pid]
 * @returns {string}
 */
export function hafizaYolu(env, kullaniciDizini, geciciDizin, pid = process.pid) {
  if (env.ORION_HAFIZA_DOSYASI) return env.ORION_HAFIZA_DOSYASI;
  if (env.ORION_SMOKE === "1") return path.join(geciciDizin, `orion-hafiza-senaryo-${pid}.json`);
  return path.join(kullaniciDizini, "orion-hafiza.json");
}

/**
 * @typedef {{durum: "yok"} | {durum: "var", kayitlar: unknown[]} | {durum: "bozuk", tasindi: string}} DosyaDurumu
 */

/**
 * @param {string} yol
 * @returns {DosyaDurumu}
 */
export function hafizaDosyasiOku(yol) {
  let ham;
  try {
    ham = fs.readFileSync(yol, "utf8");
  } catch (e) {
    if (e && e.code === "ENOENT") return { durum: "yok" };
    throw e;   // izin hatası vb. — sessizce "yok" demek göçü yanlış tetikler
  }
  try {
    const j = JSON.parse(ham);
    if (Array.isArray(j)) return { durum: "var", kayitlar: j };
  } catch { /* aşağıda bozuk olarak ele alınır */ }

  // BOZUK: sil DEĞİL, taşı. İçinde kurtarılabilir anı olabilir.
  const tasindi = `${yol}.bozuk-${Date.now()}.json`;
  fs.renameSync(yol, tasindi);
  console.warn(`[hafiza] dosya bozuktu, korundu: ${tasindi}`);
  return { durum: "bozuk", tasindi };
}

/**
 * Atomik yazım: geçici dosya + yeniden adlandırma.
 *
 * Windows'ta `fs.renameSync` hedefin üstüne yazar (MoveFileEx,
 * REPLACE_EXISTING) — POSIX'teki gibi tek adımda yer değiştirir.
 *
 * @param {string} yol
 * @param {unknown[]} kayitlar
 */
export function hafizaDosyasiYaz(yol, kayitlar) {
  fs.mkdirSync(path.dirname(yol), { recursive: true });
  const gecici = `${yol}.tmp`;
  fs.writeFileSync(gecici, JSON.stringify(kayitlar), "utf8");
  fs.renameSync(gecici, yol);
}
