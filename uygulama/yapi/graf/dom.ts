// uygulama/yapi/graf/dom.ts — GÖRSEL EDİTÖRÜN küçük DOM yardımcıları (spec 35 dilim 2b): öğe, düğme, ayar alanı girdisi. DOM katmanı.
//
// Ayar alanı girdisi düğümün içinde (satır içi) ve Ayrıntılar panelinde AYNI işlevden: tür (sayı/metin/bool, seçenekli liste) `alanlar.ts`in tanımından,
// yazılanın değere çevrilmesi ve doğrulaması da orada (sayı eval EDİLMEZ). Burada yalnız girdi öğesi kurulur; değişiklik `change` ile (her tuşta değil:
// yazarken grafiğe her harf ayrı geri al adımı olmasın).
"use strict";
import type { GrafDegeri } from "../../../protocol/graf.ts";
import { alanYazisi, type AlanTanimi } from "../../graf/editor/alanlar.ts";

export const el = <K extends keyof HTMLElementTagNameMap>(ad: K, sinif = "", metin = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(ad); if (sinif) e.className = sinif; if (metin) e.textContent = metin; return e;
};

export const dugme = (metin: string, sinif = "", ipucu = ""): HTMLButtonElement => {
  const b = el("button", `ge-dugme ${sinif}`.trim(), metin); b.type = "button"; if (ipucu) b.title = ipucu; return b;
};

/** Olayın hedefi bir yazı alanı mı (orada tuş harftir; editör komutları çalışmaz). */
export const yaziAlaniMi = (h: EventTarget | null): boolean => {
  const e = h as HTMLElement | null;
  if (!e?.matches) return false;
  if (e.isContentEditable || e.matches("textarea, select")) return true;
  return e.matches("input") && !e.matches("input[type=checkbox], input[type=radio], input[type=button], input[type=range]");
};

/**
 * Ayar alanının girdisi. `degisti(ham)` kullanıcı değeri bitirince (Enter, odak kaybı, seçim) çağrılır; kabul edilmezse çağıran `geriYukle` ile eski
 * değeri geri koyar. Geçerli değer seçeneklerde yoksa (bozuk JSON) listeye "(geçersiz) x" olarak eklenir: değer gizlenmesin.
 */
export function alanGirdisi(a: AlanTanimi, deger: GrafDegeri | undefined, degisti: (ham: string | boolean) => void): HTMLElement {
  if (a.tip === "bool") {
    const c = el("input"); c.type = "checkbox";
    c.checked = (deger ?? a.varsayilan) === true;
    c.addEventListener("change", () => degisti(c.checked));
    return c;
  }
  if (a.secenekler) {
    const s = el("select", "ge-alan");
    const mevcut = deger === undefined || deger === null ? (a.varsayilan === undefined ? null : String(a.varsayilan)) : String(deger);
    if (mevcut === null) { const o = el("option", "", "— seç —"); o.value = "\u0000"; o.disabled = true; o.selected = true; s.append(o); }
    else if (!a.secenekler.includes(mevcut)) { const o = el("option", "", `(geçersiz) ${mevcut}`); o.value = mevcut; o.selected = true; s.append(o); }
    for (const x of a.secenekler) { const o = el("option", "", x === "" ? "(hepsi / boş)" : x); o.value = x; if (x === mevcut) o.selected = true; s.append(o); }
    s.addEventListener("change", () => { if (s.value !== "\u0000") degisti(s.value); });
    return s;
  }
  const i = el("input", "ge-alan");
  i.type = "text"; i.spellcheck = false; i.autocomplete = "off";
  i.value = alanYazisi(deger);
  i.placeholder = a.varsayilan !== undefined && a.varsayilan !== null ? String(a.varsayilan) : a.tip === "sayi" ? "sayı" : "";
  if (a.tip === "sayi") i.inputMode = "decimal";
  i.title = `${a.ad}${a.aciklama ? ` — ${a.aciklama}` : ""}${a.en !== undefined || a.cok !== undefined ? ` (${a.en ?? "-∞"}–${a.cok ?? "∞"})` : ""}`;
  i.addEventListener("change", () => degisti(i.value));
  i.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); i.blur(); } });
  return i;
}
