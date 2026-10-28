// host/birakYollari.cjs — Explorer'dan bırakılan dosyaların GERÇEK yolları (preload'da çalışır; Electron'a bağımlı değil, `yolAl` dışarıdan gelir → testli).
//
// NEDEN: `webUtils.getPathForFile(File)` yalnız sayfanın KENDİ File nesnesiyle çalışır. Renderer File'ı `contextBridge` fonksiyon argümanı olarak
// yollayınca nesne köprüden geçerken kopyalanır/kimliğini yitirebilir ve yol alınamaz ("Unable to retrieve the file path"); hata preload'da
// fırlar, renderer'da yutulur ve bırakma SESSİZCE hiçbir şey yapmaz. Bu yüzden yol, bırakma olayı daha sayfaya ulaşmadan (yakalama aşaması) buradan,
// olayın kendi File'larından okunur ve saklanır; renderer'ın `icerikBirakAktar` çağrısı saklanan yolları tüketir.
"use strict";

/** Saklanan yolların ömrü (ms): bırakma olayı ile renderer'ın IPC çağrısı aynı olay döngüsünde olur; eskimiş yol başka bırakmaya karışmasın. */
const OMUR_MS = 5000;

/**
 * `hedef` (window) üzerinde yakalama aşamasında `drop` dinler. `yolAl(file)` yolu döner (hata fırlatabilir: o dosya atlanır).
 * `al(dosyalar)`: önce saklanan yolları tüketir (varsa), yoksa verilen File'ları doğrudan çözmeyi dener. Hiç yol yoksa boş dizi.
 */
function birakYollariKur(hedef, yolAl, simdi = Date.now) {
  let son = null;   // { yollar: string[], t: number }
  const coz = (dosyalar) => {
    const yollar = [];
    for (const f of Array.from(dosyalar ?? [])) {
      try { const y = yolAl(f); if (typeof y === "string" && y) yollar.push(y); } catch { /* bu dosyanın yolu yok: atla */ }
    }
    return yollar;
  };
  hedef.addEventListener("drop", (e) => {
    const dosyalar = e?.dataTransfer?.files;
    if (!dosyalar || dosyalar.length === 0) return;
    const yollar = coz(dosyalar);
    if (yollar.length) son = { yollar, t: simdi() };
  }, true);
  return {
    al(dosyalar) {
      const s = son; son = null;
      if (s && simdi() - s.t <= OMUR_MS) return s.yollar;
      return coz(dosyalar);
    },
  };
}

module.exports = { birakYollariKur, OMUR_MS };
