// uygulama/yapi/graf/hataAyiklamaBolumu.ts — SAĞ PANELDE "HATA AYIKLAMA" BÖLÜMÜ (spec 43 A4). DOM katmanı.
//
// Duraklama bildirimi (hangi çalışma hangi düğümde durdu) + o grafın bellekteki değişkenleri (izleme) + çalışma günlüğü (son düğümler: girdi → çıktı · süre; hata satırı kırmızı).
// Günlük satırına tıklamak düğüme gider. Hiçbir şey yazmaz/çalıştırmaz: Devam/Adım araç çubuğunda (`calistirmaDugmeleri.ts`, yalnız gerçek tıklama).
"use strict";
import { gunlukMetni } from "../../graf/calismaGunlugu.ts";
import type { EditorBaglami } from "./editorBaglami.ts";
import { dugme, el } from "./dom.ts";

/** Ekranda gösterilen son satır sayısı (tampon 200; panel kısa kalsın). */
export const GORUNEN_SATIR = 40;

export function hataAyiklamaBolumu(b: EditorBaglami): HTMLElement | null {
  const ayiklayici = b.ayiklayici(), gunluk = b.gunluk();
  if (!ayiklayici && !gunluk) return null;
  const kok = el("div", "ge-ayikla");
  kok.append(el("div", "ge-baslik2", "Hata ayıklama"));
  const duran = ayiklayici?.duraklamalar() ?? [];
  if (duran.length) {
    const y = duran[0]!;
    const kutu = el("div", "ge-duraklama", `⏸ ${y.kaynak} · '${y.graf}' · ${y.id} düğümünde duraklatıldı${duran.length > 1 ? ` (+${duran.length - 1} çalışma daha)` : ""}`);
    kutu.title = "Araç çubuğunda ⏵ Devam / ⏭ Adım / ■ Durdur";
    kok.append(kutu);
    const v = Object.entries(b.degiskenler(y.graf));
    kok.append(el("div", "ge-soluk", v.length ? `Değişkenler: ${v.map(([k, d]) => `${k}=${JSON.stringify(d)}`).join(" · ")}` : "Değişken yok (bu grafın bellekte değişkeni yok)"));
  } else if (ayiklayici?.adimModu()) {
    kok.append(el("div", "ge-soluk", "Adım modu açık: sıradaki akışlı düğümde durur."));
  }
  if (gunluk) {
    const satirlar = gunluk.satirlar();
    const bas = el("div", "ge-soluk", `Günlük: ${satirlar.length ? `son ${Math.min(GORUNEN_SATIR, satirlar.length)} / ${satirlar.length} düğüm` : "boş (bir grafı ▶ ile çalıştır)"}`);
    if (satirlar.length) {
      const temizle = dugme("Temizle", "", "Günlüğü boşalt");
      temizle.addEventListener("click", () => { temizle.blur(); gunluk.temizle(); });
      bas.append(" ", temizle);
    }
    kok.append(bas);
    const liste = el("div", "ge-gunluk");
    for (const s of satirlar.slice(-GORUNEN_SATIR)) {
      const r = el("div", s.hata !== undefined ? "ge-hata" : "", gunlukMetni(s));
      r.title = `${s.kaynak} · '${s.graf}' (tıkla: düğüme git)`;
      if (s.id !== "-") r.addEventListener("click", () => { if (b.ad() === s.graf) b.dugumeGit(s.id); });
      liste.append(r);
    }
    kok.append(liste);
    liste.scrollTop = liste.scrollHeight;
  }
  return kok;
}
