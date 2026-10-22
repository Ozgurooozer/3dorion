// uygulama/yapi/ortak/dom.ts — EDİTÖRLERİN ORTAK küçük DOM yardımcıları: öğe, düğme yapıcı, "olay bir yazı alanında mı". DOM katmanı.
//
// İki kullanıcısı var: düğüm grafiği editörü (`uygulama/yapi/graf/`, spec 35 dilim 2b) ve sekans editörü (`uygulama/yapi/sekans/`, spec 36). Önce graf
// editörünün `dom.ts`indeydi; sekans editörü ikinci kopyayı yazmasın diye buraya çıkarıldı (graf'ın dom.ts'i bunları yeniden dışa verir). Burada
// TÜRE ÖZGÜ hiçbir şey yok: graf'ın ayar alanı girdisi (`alanGirdisi`) graf'ın dom.ts'inde kaldı.
"use strict";

export const el = <K extends keyof HTMLElementTagNameMap>(ad: K, sinif = "", metin = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(ad); if (sinif) e.className = sinif; if (metin) e.textContent = metin; return e;
};

/** Düğme yapıcı: her editör kendi taban sınıfıyla (`ge-dugme`, `sk-dugme`) bir kez kurar. */
export const dugmeYap = (taban: string) => (metin: string, sinif = "", ipucu = ""): HTMLButtonElement => {
  const b = el("button", `${taban} ${sinif}`.trim(), metin); b.type = "button"; if (ipucu) b.title = ipucu; return b;
};

/**
 * "Ne yapabilirim" şeridi: ilk açılışta görünür, "Anladım" saklanır (`anahtar`; depo yoksa her açılışta görünür: zararsız, kalıcı durum değil).
 * Graf ve sekans editörü ortak (kendi anahtarı, metni ve sınıfıyla).
 */
export function ipucuSeridi(anahtar: string, metin: string, sinif: string, dugme: (metin: string, sinif?: string, ipucu?: string) => HTMLButtonElement): HTMLElement {
  const kok = el("div", sinif);
  const gizli = (() => { try { return localStorage.getItem(anahtar) === "1"; } catch { return false; } })();
  if (gizli) kok.style.display = "none";
  const anladim = dugme("Anladım", "", "Bu ipucunu bir daha gösterme");
  anladim.addEventListener("click", () => { kok.style.display = "none"; try { localStorage.setItem(anahtar, "1"); } catch { /* depo yok: yalnız bu oturum */ } });
  kok.append(el("span", "", metin), anladim);
  return kok;
}

/** Olayın hedefi bir yazı alanı mı (orada tuş harftir; editör komutları çalışmaz). */
export const yaziAlaniMi = (h: EventTarget | null): boolean => {
  const e = h as HTMLElement | null;
  if (!e?.matches) return false;
  if (e.isContentEditable || e.matches("textarea, select")) return true;
  return e.matches("input") && !e.matches("input[type=checkbox], input[type=radio], input[type=button], input[type=range]");
};
