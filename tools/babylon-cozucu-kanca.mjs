// tools/babylon-cozucu-kanca.mjs — çözücü kancasının kendisi.
// Bkz. babylon-cozucu.mjs (neden gerekli).

/** `@babylonjs/paket/alt/yol` → `.js` ekle (zaten uzantılıysa dokunma). */
export async function resolve(belirtec, baglam, sonraki) {
  // Yalnızca GERÇEK modül uzantıları sayılır. Genel `\.[a-z]+$` denemesi
  // `Maths/math.vector` gibi yolları "uzantılı" sanıp atlıyordu.
  if (belirtec.startsWith("@babylonjs/") && !/\.(js|mjs|cjs|json|ts)$/i.test(belirtec)) {
    // `@babylonjs/loaders/glTF` gibi DİZİN importları `/index.js` ister (oyuncuBeden.ts bunu kullanır).
    for (const aday of [`${belirtec}.js`, `${belirtec}/index.js`]) {
      try { return await sonraki(aday, baglam); } catch { /* sıradaki aday */ }
    }
    // İkisi de yoksa asıl hatayı göster — kanca hatayı gizlememeli.
  }
  return sonraki(belirtec, baglam);
}
