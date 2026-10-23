// uygulama/yapi/ortak/menuCubugu.ts — MENÜ ÇUBUĞU (DOM; spec 38 §6): Dosya / Düzen / Görünüm… açılır menüler. Model `menuModeli.ts`te (satır çözümü, ayırıcılar).
//
// DAVRANIŞ (masaüstü uygulaması gibi): menü adına tık açar, başka bir menü adının üstüne gelmek (biri açıkken) ona geçer, satıra tık çalıştırır ve kapatır,
// dışarı tık / Esc kapatır. Pasif satır soluk ve tıklanamaz. Menü her açılışta ve her `ciz()`de yeniden çözülür (etkin/işaretli durumu güncel).
// TUŞ: Esc editörün kendi işleyicisinden ÖNCE `kapat()`e sorulur (açık menü varsa Esc yalnız onu kapatır; editör gizlenmez).
"use strict";
import { menuSatiriniCalistir, menuyuCoz, type Menu } from "./menuModeli.ts";
import { el } from "./dom.ts";

export interface MenuCubugu {
  kok: HTMLElement;
  /** Menüleri yeniden çöz (durum değişti). */
  ciz(): void;
  /** Açık menüyü kapat; açık olan vardıysa true (Esc zinciri: editör ancak false dönünce gizler). */
  kapat(): boolean;
}

export function menuCubuguKur(menuler: () => readonly Menu[]): MenuCubugu {
  const kok = el("div", "kb-menucubugu");
  let acik: string | null = null;

  function ciz(): void {
    const onceki = acik;
    kok.replaceChildren();
    for (const m of menuler()) {
      const c = menuyuCoz(m);
      const kap = el("div", "kb-menu"); kap.dataset.acik = onceki === m.ad ? "1" : "0";
      const d = el("button", "kb-menu-dugme", m.ad); d.type = "button"; d.dataset.soluk = c.etkinVar ? "0" : "1";
      d.addEventListener("click", () => { acik = acik === m.ad ? null : m.ad; ciz(); });
      d.addEventListener("pointerenter", () => { if (acik && acik !== m.ad) { acik = m.ad; ciz(); } });
      const liste = el("div", "kb-acilir");
      for (const s of c.satirlar) {
        if (s.tur === "ayirici") { liste.append(el("div", "kb-ayirici")); continue; }
        const o = el("div", "kb-oge"); o.dataset.etkin = s.etkin ? "1" : "0"; if (s.ipucu) o.title = s.ipucu;
        o.append(el("span", "kb-tik", s.isaretli ? "✓" : ""), el("span", "kb-oge-ad", s.etiket), el("span", "kb-kisayol", s.kisayol));
        o.addEventListener("click", (e) => { e.stopPropagation(); acik = null; menuSatiriniCalistir(s, e); ciz(); });
        liste.append(o);
      }
      kap.append(d, liste);
      kok.append(kap);
    }
  }

  // Dışarı tık menüyü kapatır (menü çubuğunun içi hariç).
  addEventListener("pointerdown", (e) => { if (acik && !kok.contains(e.target as Node | null)) { acik = null; ciz(); } }, { capture: true });
  return {
    kok, ciz,
    kapat() { if (acik === null) return false; acik = null; ciz(); return true; },
  };
}
